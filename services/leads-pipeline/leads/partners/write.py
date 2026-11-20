import hashlib
import json
import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional

from .config import PARTNERS
from .extract import format_value, is_recent

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
    values = [e["value_millions"] for e in evs if e.get("value_millions") is not None]
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
    endpoint = (os.getenv("AZURE_OPENAI_ENDPOINT") or "").strip().rstrip("/")
    key = (os.getenv("AZURE_OPENAI_API_KEY") or "").strip()
    deployment = (os.getenv("AZURE_OPENAI_DEPLOYMENT") or "").strip()
    if not (endpoint and key and deployment):
        return None
    return {"url": endpoint + LLM["path"], "key": key, "deployment": deployment}


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


def _ask(fetcher, cfg: Dict, user: str, rows: int, stats: Dict):
    body = {"model": cfg["deployment"],
            "messages": [{"role": "system", "content": LLM["system"]}, {"role": "user", "content": user}],
            "max_completion_tokens": LLM["tokens_base"] + LLM["tokens_per_row"] * rows,
            "temperature": LLM["temperature"],
            "response_format": {"type": "json_object"}}
    headers = {"api-key": cfg["key"], "Content-Type": "application/json"}
    status, data = fetcher.post_json(cfg["url"], body, headers=headers, timeout=LLM["timeout_s"])
    if status == 400 and "temperature" in json.dumps(data or {}):
        body.pop("temperature")
        status, data = fetcher.post_json(cfg["url"], body, headers=headers, timeout=LLM["timeout_s"])
    if status != 200 or not isinstance(data, dict):
        log.warning("partners: the model answered HTTP %s: %s", status, json.dumps(data or {})[:300])
        return []
    usage = data.get("usage") or {}
    stats["prompt_tokens"] += int(usage.get("prompt_tokens") or 0)
    stats["completion_tokens"] += int(usage.get("completion_tokens") or 0)
    stats["model_calls"] += 1
    try:
        content = data["choices"][0]["message"]["content"]
        return json.loads(content).get("r") or []
    except (KeyError, IndexError, TypeError, ValueError):
        log.warning("partners: the model reply was not the expected JSON")
        return []


def polish(fetcher, companies: List[Dict], past_work: str, cache: Dict, stats: Dict) -> None:
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
    answers = {a.get("i"): a for a in _ask(fetcher, cfg, user, len(todo), stats) if isinstance(a, dict)}
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
