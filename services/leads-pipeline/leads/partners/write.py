import hashlib

import anthropic
import json
import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional

from .config import PARTNERS
from .extract import format_value, is_recent, usd_millions

log = logging.getLogger("leads.partners")
SCORE = PARTNERS["score"]
WRITE = PARTNERS["write"]
LLM = PARTNERS["llm"]
NUMBER = re.compile(r"\d+(?:[.,]\d+)?")


def lead_evidence(company: Dict) -> Dict:
    return max(company["evidence"], key=lambda e: (SCORE["signal"].get(e["signal"], 0),
                                                   e.get("value_millions") or 0, e.get("date") or ""))


def score(company: Dict, months: int) -> int:
    evs = company["evidence"]
    dates = [e["date"] for e in evs if e.get("date")]
    pts = 0
    if any(is_recent(d, months) for d in dates):
        pts += SCORE["recent"]
    elif not dates:
        pts += SCORE["undated"]
    pts += max(SCORE["signal"].get(s, 0) for s in company["signals"])
    values = [usd_millions(e["value_millions"], e.get("currency") or "") for e in evs
              if e.get("value_millions") is not None]
    if values:
        pts += SCORE["value"]
        if max(values) >= SCORE["big_value_millions"]:
            pts += SCORE["big_value"]
    pts += min(len(company["sectors"]), SCORE["sector_cap"]) * SCORE["sector_each"]
    if company["agencies"]:
        pts += SCORE["agency"]
    if len({e["url"] for e in evs}) > 1:
        pts += SCORE["many_sources"]
    if company["people"]:
        pts += SCORE["person"]
    if company.get("sizeFit") == "yes":
        pts += SCORE["size_fit"]
    return pts


def _sector_labels(ids: List[str]) -> str:
    labels = [PARTNERS["sectors"][s]["phrase"] for s in ids]
    if len(labels) <= 1:
        return "".join(labels) or "engineering"
    return ", ".join(labels[:-1]) + " and " + labels[-1]


def _month(date: str) -> str:
    try:
        return datetime.strptime(date[:7], "%Y-%m").strftime("%b %Y")
    except ValueError:
        return ""


def _sentence(text: str) -> str:
    text = text.strip()
    return text if not text or text[-1] in ".!?" else text + "."


def _cut(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit - 1].rsplit(" ", 1)[0] + "…"


def facts(company: Dict) -> Dict[str, str]:
    ev = lead_evidence(company)
    value = format_value(ev.get("value_millions"), ev.get("currency") or "")
    agency = ev.get("agency") or (company["agencies"][0] if company["agencies"] else "")
    return {"signal": ev["signal"], "value": value, "agency": agency, "date": _month(ev.get("date") or ""),
            "sectors": _sector_labels(company["sectors"])}


def template(company: Dict, past_work: str) -> Dict[str, str]:
    f = facts(company)
    parts = {
        "value": f["value"] or "a government contract",
        "from_agency": f" from {f['agency']}" if f["agency"] else "",
        "with_agency": f" with {f['agency']}" if f["agency"] else "",
        "for_value": f" worth {f['value']}" if f["value"] else "",
        "value_or_new": f["value"] or "new",
        "agency": f["agency"] or "government clients",
    }
    verb = WRITE["verbs"][f["signal"]].format(**parts)
    when = f" ({f['date']})" if f["date"] else ""
    level = PARTNERS["contacts"][company["companyType"]]["label"]
    size = (company.get("size") or {}).get("label") or ""
    kind = "Listed company" if company["companyType"] == "listed" else (size or "Not shown as listed")
    why = f"{company['company']} {verb}{when}. Fields: {f['sectors']}. {kind}: contact {level}."
    opener = WRITE["hook_openers"][f["signal"]].format(**parts)
    body = WRITE["hook_body"].format(sectors=f["sectors"])
    hook = " ".join(x for x in (opener, body, _sentence(past_work), WRITE["hook_close"]) if x)
    return {"why": _cut(why, WRITE["max_why_chars"]), "hook": _cut(hook, WRITE["max_hook_chars"])}


def model_config() -> Optional[Dict[str, str]]:
    key = (os.getenv(LLM["key_env"]) or "").strip()
    if not key:
        return None
    return {"key": key, "model": LLM["model"]}


def _line(i: int, company: Dict) -> str:
    f = facts(company)
    label = PARTNERS["signals"][f["signal"]]["label"]
    return "|".join([str(i), company["company"], company["companyType"], label, f["value"], f["agency"],
                     f["date"], f["sectors"]])


def _numbers(text: str) -> set:
    return {n.replace(",", "") for n in NUMBER.findall(text or "")}


def _valid(out: Dict, allowed: set) -> bool:
    why, hook = str(out.get("w") or "").strip(), str(out.get("h") or "").strip()
    if not why or not hook:
        return False
    if len(why) > WRITE["max_why_chars"] or len(hook) > WRITE["max_hook_chars"]:
        return False
    return (_numbers(why) | _numbers(hook)) <= allowed


def _ask(cfg: Dict, user: str, rows: int, stats: Dict) -> List[Dict]:
    client = anthropic.Anthropic(api_key=cfg["key"], timeout=LLM["timeout_s"], max_retries=LLM["max_retries"])
    try:
        response = client.messages.create(
            model=cfg["model"],
            max_tokens=LLM["tokens_base"] + LLM["tokens_per_row"] * rows,
            system=LLM["system"],
            messages=[{"role": "user", "content": user}],
            thinking={"type": "disabled"},
            output_config={"effort": LLM["effort"], "format": {"type": "json_schema", "schema": LLM["schema"]}},
        )
    except anthropic.AuthenticationError:
        log.warning("partners: Claude rejected the %s; the templates stay", LLM["key_env"])
        return []
    except anthropic.RateLimitError:
        log.warning("partners: Claude rate limit reached; the templates stay")
        return []
    except anthropic.APIStatusError as error:
        log.warning("partners: Claude answered HTTP %s: %s", error.status_code, str(error.message)[:300])
        return []
    except anthropic.APIConnectionError as error:
        log.warning("partners: Claude did not answer: %s", error)
        return []
    stats["prompt_tokens"] += response.usage.input_tokens
    stats["completion_tokens"] += response.usage.output_tokens
    stats["model_calls"] += 1
    if response.stop_reason != "end_turn":
        log.warning("partners: Claude stopped with %s; the templates stay", response.stop_reason)
        return []
    text = next((block.text for block in response.content if block.type == "text"), "")
    try:
        return json.loads(text).get("r") or []
    except ValueError:
        log.warning("partners: the Claude reply was not the expected JSON")
        return []


def polish(companies: List[Dict], past_work: str, cache: Dict, stats: Dict) -> None:
    cfg = model_config()
    if not cfg:
        log.info("partners: no model configured; the templates stay")
        return
    store = cache.setdefault("llm", {})
    top = companies[:LLM["max_rows"]]
    lines = {i: _line(i, c) for i, c in enumerate(top)}
    keys = {i: hashlib.sha1(f"{LLM['system']}|{past_work}|{line}".encode()).hexdigest() for i, line in lines.items()}
    todo = []
    for i, company in enumerate(top):
        hit = store.get(keys[i])
        if hit is None:
            todo.append(i)
            continue
        stats["model_cached"] += 1
        if hit:
            company.update(why=hit["w"], hook=hit["h"], polished=True)
    if not todo:
        return
    user = (f"Our past work: {past_work or 'none given'}\n"
            "Rows (i|company|type|signal|value|agency|month|fields):\n" + "\n".join(lines[i] for i in todo))
    answers = {a.get("i"): a for a in _ask(cfg, user, len(todo), stats) if isinstance(a, dict)}
    for i in todo:
        out = answers.get(i)
        if not out:
            continue
        allowed = _numbers(lines[i]) | _numbers(past_work) | _numbers(WRITE["hook_close"])
        if _valid(out, allowed):
            top[i].update(why=out["w"].strip(), hook=out["h"].strip(), polished=True)
            store[keys[i]] = {"w": top[i]["why"], "h": top[i]["hook"]}
        else:
            stats["model_rejected"] += 1
            store[keys[i]] = {}
