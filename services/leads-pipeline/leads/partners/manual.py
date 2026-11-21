import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

from .config import PARTNERS
from .spec import read_json, run_path, run_rows, write_json
from .unifers import enrich_person, unifers_key

log = logging.getLogger("leads.partners")
UNIFERS = PARTNERS["unifers"]
PROFILE = re.compile(r"^(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([^/?#\s]+)/?(?:[?#].*)?$", re.I)
SLUG_TAIL = re.compile(r"(?:-[0-9a-z]*\d[0-9a-z]*)+$", re.I)
OUTCOME_MESSAGE = {
    "known": "already has an email and a phone",
    "limit": "was not looked up: the limit for one request is reached",
    "failed": "could not be looked up in Unifers",
}


class EnrichError(ValueError):
    pass


def profile_url(raw: str) -> str:
    m = PROFILE.match((raw or "").strip())
    if not m:
        raise EnrichError("Give a LinkedIn profile link, like https://www.linkedin.com/in/jane-tan.")
    return f"https://www.linkedin.com/in/{m.group(1)}"


def _name_from(url: str) -> str:
    slug = url.rstrip("/").rsplit("/", 1)[-1]
    return " ".join(w.capitalize() for w in SLUG_TAIL.sub("", slug).split("-") if w)


def parse_items(data: Dict) -> List[Dict[str, str]]:
    items = data.get("items")
    if not isinstance(items, list) or not items:
        raise EnrichError("Pick at least one contact to enrich.")
    if len(items) > UNIFERS["manual_max"]:
        raise EnrichError(f"Enrich at most {UNIFERS['manual_max']} contacts at a time.")
    out = []
    for item in items:
        if not isinstance(item, dict):
            raise EnrichError("Each contact needs a run, a company and a LinkedIn link.")
        run, key = str(item.get("run") or ""), str(item.get("key") or "")
        if not run or not key:
            raise EnrichError("Each contact needs a run and a company.")
        out.append({"run": run, "key": key, "linkedin": profile_url(str(item.get("linkedin") or ""))})
    return out


def _person(row: Dict, url: str) -> Dict:
    for person in row.get("people") or []:
        if (person.get("linkedin") or "").rstrip("/").lower() == url.lower():
            return person
    person = {"name": _name_from(url), "title": "", "linkedin": url, "added": True}
    row.setdefault("people", []).append(person)
    return person


def enrich_items(base: Path, fetcher, items: List[Dict[str, str]]) -> Dict:
    if not unifers_key():
        raise EnrichError("Set the Unifers API key on the Settings page, GPU leads tab, to enrich contacts.")
    cache_path = base / PARTNERS["files"]["cache"]
    cache = read_json(cache_path, {})
    store = cache.setdefault("unifers", {})
    stats: Dict[str, int] = defaultdict(int)
    runs: Dict[str, Optional[Dict]] = {}
    changed: Dict[str, Dict] = {}
    notes: List[str] = []
    for item in items:
        path = run_path(base, item["run"])
        if path is None:
            notes.append(f"{item['linkedin']}: no such run")
            continue
        if item["run"] not in runs:
            data = read_json(path, None)
            runs[item["run"]] = data if isinstance(data, dict) else None
        data = runs[item["run"]]
        row = next((r for r in (data or {}).get("rows") or [] if r.get("key") == item["key"]), None)
        if row is None:
            notes.append(f"{item['linkedin']}: the company is not in that run")
            continue
        person = _person(row, item["linkedin"])
        company = {"company": row.get("company") or "", "domain": row.get("domain") or ""}
        outcome = enrich_person(fetcher, person, company, store, stats, UNIFERS["manual_max"])
        if outcome in OUTCOME_MESSAGE:
            notes.append(f"{person.get('name') or item['linkedin']} {OUTCOME_MESSAGE[outcome]}")
        changed[item["run"]] = data
    for run, data in changed.items():
        write_json(run_path(base, run), data)
    write_json(cache_path, cache)
    log.info("partners: manual Unifers enrichment: %d looked up, %d from cache, %d credits",
             stats["unifers_people"], stats["unifers_cached"], stats["unifers_credits"])
    rows = [row for data in changed.values() for row in run_rows(data)
            if any(row["key"] == i["key"] and i["run"] == data.get("id") for i in items)]
    return {"rows": rows, "credits": stats["unifers_credits"], "lookedUp": stats["unifers_people"],
            "fromCache": stats["unifers_cached"], "notes": notes}
