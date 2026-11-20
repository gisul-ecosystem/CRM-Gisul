import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from .config import DAY_S, PARTNERS

log = logging.getLogger("leads.partners")
SEARCH = PARTNERS["search"]
GEBIZ = PARTNERS["gebiz"]


def search_apis(settings) -> List[Tuple[str, str]]:
    keys = (("serper", settings.serper_api_key), ("tavily", settings.tavily_api_key),
            ("brave", settings.brave_api_key))
    return [(name, key.strip().strip('"\'')) for name, key in keys if (key or "").strip()]


def _row(title, snippet, url, date="", source="") -> Dict[str, str]:
    return {"title": title or "", "snippet": snippet or "", "url": url or "", "date": date or "",
            "source": source or ""}


def _serper(fetcher, key: str, q: str, mode: str, gl: str, months: int):
    url = SEARCH["serper_news"] if mode == "news" else SEARCH["serper_web"]
    body = {"q": q, "num": SEARCH["results_per_query"], "gl": gl}
    if months <= SEARCH["recent_months"]:
        body["tbs"] = "qdr:y"
    status, data = fetcher.post_json(url, body, headers={"X-API-KEY": key, "Content-Type": "application/json"})
    items = (data or {}).get("news" if mode == "news" else "organic", []) if isinstance(data, dict) else []
    return status, [_row(r.get("title"), r.get("snippet"), r.get("link"), r.get("date"), r.get("source"))
                    for r in items], data


def _tavily(fetcher, key: str, q: str, mode: str, months: int):
    body = {"query": q, "max_results": SEARCH["results_per_query"], "search_depth": "basic",
            "topic": "news" if mode == "news" else "general"}
    if mode == "news":
        body["days"] = months * 31
    status, data = fetcher.post_json(SEARCH["tavily"], body,
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    items = (data or {}).get("results", []) if isinstance(data, dict) else []
    return status, [_row(r.get("title"), r.get("content"), r.get("url"), r.get("published_date"))
                    for r in items], data


def _brave(fetcher, key: str, q: str, gl: str):
    status, data, _ = fetcher.get_json(
        SEARCH["brave"], params={"q": q, "count": SEARCH["results_per_query"], "country": gl.upper(),
                                 "search_lang": "en"},
        headers={"X-Subscription-Token": key, "Accept": "application/json"})
    web = (data or {}).get("web") if isinstance(data, dict) else None
    items = (web or {}).get("results") or []
    return status, [_row(r.get("title"), r.get("description"), r.get("url"), r.get("age")) for r in items], data


def run_search(apis, fetcher, q: str, mode: str, country: str, months: int) -> Tuple[str, List[Dict]]:
    gl = PARTNERS["countries"].get(country, {}).get("code", "")
    for name, key in apis:
        if name == "serper":
            status, rows, data = _serper(fetcher, key, q, mode, gl, months)
        elif name == "tavily":
            status, rows, data = _tavily(fetcher, key, q, mode, months)
        else:
            status, rows, data = _brave(fetcher, key, q, gl)
        time.sleep(SEARCH["pause_seconds"])
        if status == 200:
            return name, rows
        msg = (data or {}).get("message") if isinstance(data, dict) else ""
        log.warning("partners: %s cannot search now (HTTP %s%s)", name, status, f" - {msg}" if msg else "")
    return "", []


class SearchCache:
    def __init__(self, cache: Dict):
        self.data = cache.setdefault("search", {})

    def _fresh(self, hit: Dict) -> bool:
        try:
            at = datetime.fromisoformat(hit["at"])
        except (KeyError, TypeError, ValueError):
            return False
        return (datetime.now() - at).total_seconds() <= SEARCH["repeat_days"] * DAY_S

    def get(self, key: str) -> Optional[List[Dict]]:
        hit = self.data.get(key)
        if not hit or not self._fresh(hit):
            return None
        return hit.get("rows") or []

    def prune(self) -> None:
        for key in [k for k, hit in self.data.items() if not self._fresh(hit)]:
            self.data.pop(key)

    def put(self, key: str, rows: List[Dict]) -> None:
        self.data[key] = {"at": datetime.now().isoformat(timespec="seconds"), "rows": rows}


def cached_search(cache: SearchCache, apis, fetcher, q: str, mode: str, country: str, months: int,
                  stats: Dict) -> List[Dict]:
    key = f"{mode}|{country}|{months <= SEARCH['recent_months']}|{q.lower()}"
    hit = cache.get(key)
    if hit is not None:
        stats["cached"] += 1
        return hit
    if not apis:
        return []
    used, rows = run_search(apis, fetcher, q, mode, country, months)
    if used:
        stats["searches"] += 1
        cache.put(key, rows)
    return rows


def _amount(value) -> Optional[float]:
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _gebiz_date(value: str) -> Optional[datetime]:
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d %b %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(str(value).strip()[:19], fmt)
        except ValueError:
            continue
    return None


USA = PARTNERS["usaspending"]


def usaspending_awards(fetcher, terms: List[str], months: int, small: bool, stats: Dict,
                       seen: set) -> List[Dict]:
    now = datetime.now()
    start = (now - timedelta(days=months * 31)).strftime("%Y-%m-%d")
    filters = {"keywords": terms, "time_period": [{"start_date": start, "end_date": now.strftime("%Y-%m-%d")}],
               "award_type_codes": USA["award_types"]}
    if small:
        filters["recipient_type_names"] = USA["small_business"]
    out: List[Dict] = []
    for page in range(1, USA["pages"] + 1):
        body = {"filters": filters, "fields": USA["fields"], "limit": USA["page_size"], "page": page,
                "sort": "Award Amount", "order": "desc"}
        status, data = fetcher.post_json(USA["url"], body, timeout=USA["timeout_s"],
                                         headers={"Content-Type": "application/json", "Accept": "application/json"})
        stats["usaspending_calls"] += 1
        if status != 200 or not isinstance(data, dict):
            log.warning("partners: USAspending answered HTTP %s for %s", status, ", ".join(terms))
            break
        for rec in data.get("results") or []:
            supplier = str(rec.get("Recipient Name") or "").strip()
            number = str(rec.get("Award ID") or "").strip()
            if not supplier or (supplier.lower(), number) in seen:
                continue
            seen.add((supplier.lower(), number))
            amount = _amount(rec.get("Award Amount"))
            ref = str(rec.get("generated_internal_id") or "").strip()
            out.append({
                "company": supplier,
                "country": "United States",
                "signal": PARTNERS["gebiz_signal"],
                "agency": str(rec.get("Awarding Agency") or "").strip(),
                "value_millions": round(amount / 1_000_000, 2) if amount else None,
                "currency": "US$",
                "date": str(rec.get("Start Date") or "")[:10],
                "title": str(rec.get("Description") or "").strip()[:240],
                "snippet": f"USAspending award {number}".strip(),
                "url": f"{USA['source_url']}{ref}" if ref else USA["source_url"],
                "source": "USAspending.gov",
                "text": str(rec.get("Description") or ""),
            })
        if not (data.get("page_metadata") or {}).get("hasNext"):
            break
    stats["usaspending_awards"] += len(out)
    return out


def _gebiz_records(fetcher, term: str, stats: Dict, cache: "SearchCache") -> List[Dict]:
    out: List[Dict] = []
    for page in range(GEBIZ["pages"]):
        key = f"gebiz|{term.lower()}|{page}"
        records = cache.get(key)
        if records is None:
            if stats["gebiz_blocked"]:
                break
            if stats["gebiz_calls"]:
                time.sleep(GEBIZ["delay_s"])
            params = {"resource_id": GEBIZ["resource_id"], "q": term, "limit": GEBIZ["page_size"],
                      "offset": page * GEBIZ["page_size"]}
            status, data, _ = fetcher.get_json(GEBIZ["url"], params=params)
            stats["gebiz_calls"] += 1
            if status != 200 or not isinstance(data, dict):
                stats["gebiz_blocked"] = 1
                log.warning("partners: GeBIZ dataset answered HTTP %s for '%s'; GeBIZ is skipped for the rest "
                            "of this run (data.gov.sg limits how often it can be asked)", status, term)
                break
            records = ((data.get("result") or {}).get("records")) or []
            cache.put(key, records)
        else:
            stats["gebiz_cached"] += 1
        out += records
        if len(records) < GEBIZ["page_size"]:
            break
    return out


def gebiz_awards(fetcher, terms: List[str], months: int, stats: Dict, seen: set,
                 cache: "SearchCache") -> List[Dict]:
    fields = GEBIZ["fields"]
    since = datetime.now() - timedelta(days=months * 31)
    out: List[Dict] = []
    for term in terms:
        records = _gebiz_records(fetcher, term, stats, cache)
        if records and fields["supplier"] not in records[0]:
            log.warning("partners: GeBIZ records have no '%s' field; fields are %s",
                        fields["supplier"], ", ".join(sorted(records[0])[:12]))
            continue
        for rec in records:
            supplier = str(rec.get(fields["supplier"]) or "").strip()
            state = str(rec.get(fields["status"]) or "").lower()
            if not supplier or supplier.lower() in ("na", "n/a", "unknown") or GEBIZ["status_word"] not in state:
                continue
            when = _gebiz_date(rec.get(fields["date"]) or "")
            if when and when < since:
                continue
            number = str(rec.get(fields["number"]) or "").strip()
            key = (supplier.lower(), number)
            if key in seen:
                continue
            seen.add(key)
            amount = _amount(rec.get(fields["amount"]))
            out.append({
                "company": supplier,
                "country": "Singapore",
                "signal": PARTNERS["gebiz_signal"],
                "agency": str(rec.get(fields["agency"]) or "").strip(),
                "value_millions": round(amount / 1_000_000, 2) if amount else None,
                "currency": "S$",
                "date": when.strftime("%Y-%m-%d") if when else "",
                "title": str(rec.get(fields["description"]) or "").strip()[:240],
                "snippet": f"GeBIZ award {number}".strip(),
                "url": f"{GEBIZ['source_url']}#{number}" if number else GEBIZ["source_url"],
                "source": "GeBIZ (data.gov.sg)",
                "text": str(rec.get(fields["description"]) or ""),
            })
    stats["gebiz_awards"] += len(out)
    return out
