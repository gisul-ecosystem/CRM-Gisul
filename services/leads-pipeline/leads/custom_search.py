import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List

CUSTOM_SEARCH = {
    "max_name_chars": 60,
    "max_what": 10,
    "max_where": 15,
    "max_words": 10,
    "max_term_chars": 80,
    "max_queries": 30,
    "max_companies": 200,
    "default_companies": 50,
    "results_per_query": 30,
    "pause_seconds": (4, 9),
    "page_timeout_ms": 30000,
    "settle_ms": 1500,
    "read_retries": 3,
    "check_wait_seconds": 300,
    "check_poll_ms": 3000,
    "browser_profile_dir": "search-browser",
    "google_pages": 2,
    "search_modes": ("browser", "api"),
    "default_mode": "browser",
    "own_domains": ("racko.ai", "kanonkode.com", "aaptor.com", "gisul.co.in"),
    "listing_domains": (
        "sourceforge.net", "aimultiple.com", "g2.com", "capterra.com", "capterra.in", "clutch.co",
        "goodfirms.co", "trustradius.com", "getapp.com", "softwaresuggest.com", "techjockey.com",
        "gartner.com", "producthunt.com", "medium.com", "wikipedia.org", "justdial.com", "indiamart.com",
        "tracxn.com", "crunchbase.com", "linkedin.com", "facebook.com", "instagram.com", "x.com",
        "twitter.com", "quora.com", "reddit.com", "youtube.com", "glassdoor.com", "ambitionbox.com",
        "saasworthy.com", "slashdot.org", "alternativeto.net", "f6s.com", "builtin.com",
    ),
    "history_size": 50,
    "spec_file": "custom_search.json",
    "history_file": "custom_searches.json",
    "source_prefix": "custom-",
}


class SpecError(ValueError):
    pass


def _lines(value, limit: int, label: str) -> List[str]:
    items = value if isinstance(value, list) else str(value or "").splitlines()
    out = []
    for item in items:
        text = re.sub(r"\s+", " ", str(item)).strip()
        if not text:
            continue
        if len(text) > CUSTOM_SEARCH["max_term_chars"]:
            raise SpecError(f"{label}: keep each line under {CUSTOM_SEARCH['max_term_chars']} characters.")
        if text.lower() not in (x.lower() for x in out):
            out.append(text)
    if len(out) > limit:
        raise SpecError(f"{label}: at most {limit} lines.")
    return out


DOMAIN_RE = re.compile(r"\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b", re.I)


def mentioned_domains(lines: List[str]) -> List[str]:
    found = []
    for line in lines:
        for match in DOMAIN_RE.findall(line):
            domain = match.lower().removeprefix("www.")
            if domain not in found:
                found.append(domain)
    return found


def slug_of(name: str) -> str:
    return CUSTOM_SEARCH["source_prefix"] + (re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "search")


def build_queries(what: List[str], where: List[str]) -> List[str]:
    if not where:
        return list(what)
    queries = []
    for w in what:
        if any(p.lower() in w.lower() for p in where):
            queries.append(w)
        else:
            queries.extend(f"{w} in {p}" for p in where)
    return list(dict.fromkeys(queries))


def parse_spec(data: dict) -> Dict:
    name = re.sub(r"\s+", " ", str(data.get("name") or "")).strip()
    if not name:
        raise SpecError("Give the search a name.")
    if len(name) > CUSTOM_SEARCH["max_name_chars"]:
        raise SpecError(f"Keep the name under {CUSTOM_SEARCH['max_name_chars']} characters.")
    what = _lines(data.get("what"), CUSTOM_SEARCH["max_what"], "What to find")
    if not what:
        raise SpecError("Say what to find, one kind of company per line.")
    where = _lines(data.get("where"), CUSTOM_SEARCH["max_where"], "Where")
    must = _lines(data.get("mustHave"), CUSTOM_SEARCH["max_words"], "Must mention")
    exclude = _lines(data.get("exclude"), CUSTOM_SEARCH["max_words"], "Leave out")
    try:
        companies = int(data.get("companies") or CUSTOM_SEARCH["default_companies"])
    except (TypeError, ValueError):
        raise SpecError("How many companies must be a whole number.")
    if not 1 <= companies <= CUSTOM_SEARCH["max_companies"]:
        raise SpecError(f"How many companies: between 1 and {CUSTOM_SEARCH['max_companies']}.")
    mode = str(data.get("searchWith") or CUSTOM_SEARCH["default_mode"])
    if mode not in CUSTOM_SEARCH["search_modes"]:
        raise SpecError("Search with: pick the browser or the search API.")
    queries = build_queries(what, where)
    if len(queries) > CUSTOM_SEARCH["max_queries"]:
        raise SpecError(
            f"That makes {len(queries)} searches. Keep it to {CUSTOM_SEARCH['max_queries']}: "
            "fewer lines in What or Where.")
    return {"name": name, "slug": slug_of(name), "what": what, "where": where, "mustHave": must,
            "exclude": exclude, "companies": companies, "queries": queries, "searchWith": mode,
            "skipDomains": mentioned_domains(what + where)}


def write_spec(data_dir: Path, spec: Dict) -> Dict:
    data_dir.mkdir(parents=True, exist_ok=True)
    started = {**spec, "startedAt": datetime.now().isoformat(timespec="seconds"), "found": None}
    (data_dir / CUSTOM_SEARCH["spec_file"]).write_text(json.dumps(started, indent=2), encoding="utf-8")
    history = [h for h in read_history(data_dir)][: CUSTOM_SEARCH["history_size"] - 1]
    _write_history(data_dir, [started, *history])
    return started


def read_spec(data_dir: Path):
    path = data_dir / CUSTOM_SEARCH["spec_file"]
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def read_history(data_dir: Path) -> List[Dict]:
    path = data_dir / CUSTOM_SEARCH["history_file"]
    try:
        rows = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    except (OSError, ValueError):
        return []
    return [r for r in rows if isinstance(r, dict) and r.get("slug")]


def record_found(data_dir: Path, spec: Dict, found: int, searched: int) -> None:
    history = read_history(data_dir)
    for row in history:
        if row.get("slug") == spec.get("slug") and row.get("startedAt") == spec.get("startedAt"):
            row["found"] = found
            row["searched"] = searched
    _write_history(data_dir, history)


def _write_history(data_dir: Path, rows: List[Dict]) -> None:
    (data_dir / CUSTOM_SEARCH["history_file"]).write_text(json.dumps(rows, indent=2), encoding="utf-8")
