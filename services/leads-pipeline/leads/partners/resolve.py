import re
from collections import Counter
from typing import Dict, List, Optional, Tuple

from ..people_search import _LINKEDIN_SUFFIX, _PARTS, _PROFILE, _plain, company_keys, quote_name
from ..util import clean_name, looks_like_name
from .config import PARTNERS
from .extract import company_key, domain_of, is_listed, place_country, short_name
from .sources import cached_search

CONTACTS = PARTNERS["contacts"]
TITLE_RX = re.compile(CONTACTS["titles"], re.I)
EXCLUDE_RX = re.compile(CONTACTS["exclude"], re.I)


def merge(evidence: List[Dict]) -> List[Dict]:
    groups: Dict[str, Dict] = {}
    for ev in evidence:
        key = company_key(ev["company"])
        g = groups.setdefault(key, {"key": key, "names": Counter(), "country": Counter(), "evidence": [],
                                    "urls": set()})
        g["names"][ev["company"]] += 1
        g["country"][ev["country"]] += 1
        if ev["url"] in g["urls"]:
            continue
        g["urls"].add(ev["url"])
        g["evidence"].append(ev)
    out = []
    for g in groups.values():
        names = [n for n, _ in g["names"].most_common()]
        evs = g["evidence"]
        out.append({
            "key": g["key"],
            "company": max(names[:3], key=len),
            "names": names,
            "country": g["country"].most_common(1)[0][0],
            "evidence": evs,
            "signals": list(dict.fromkeys(e["signal"] for e in evs)),
            "sectors": list(dict.fromkeys(s for e in evs for s in e["sectors"])),
            "agencies": list(dict.fromkeys(e["agency"] for e in evs if e.get("agency"))),
            "companyType": "listed" if is_listed(names, evs) else "sme",
            "domain": next((e["domain"] for e in evs if e.get("domain")), ""),
            "people": [],
            "size": {"low": None, "high": None, "label": "", "linkedin": "", "hq": ""},
            "sizeFit": "unknown",
        })
    return out


def find_domain(company: Dict, apis, fetcher, cache, skip_domains: set, stats: Dict) -> str:
    q = f"{quote_name(short_name(company['company']))} {company['country']} official website"
    rows = cached_search(cache, apis, fetcher, q, "web", company["country"], 24, stats)
    stems = [w for w in company["key"].split() if len(w) >= 3]
    for row in rows:
        host = domain_of(row["url"])
        if not host or host in skip_domains:
            continue
        stem = host.split(".")[0]
        if len(stem) >= 3 and any(s in stem or stem in s for s in stems):
            return host
    return ""


SIZE = PARTNERS["size"]
COMPANY_PAGE = re.compile(r"^https?://(?:[a-z]{2,3}\.)?linkedin\.com/company/([^/?#]+)", re.I)


def _n(text: str) -> int:
    return int(text.replace(",", ""))


def parse_size(text: str) -> Optional[Tuple[int, Optional[int]]]:
    end = len(text.rstrip(" .…,;"))
    for pattern, kind in SIZE["patterns"]:
        for m in re.finditer(pattern, text, re.I):
            low = _n(m.group(1))
            if m.end() >= end and not (kind == "plus_or_exact" and low in SIZE["plus_marks"]):
                continue
            if kind == "band":
                return low, _n(m.group(2))
            if kind == "plus":
                return low, None
            if kind == "plus_or_exact":
                if low in SIZE["plus_marks"]:
                    return low, None
                continue
            if low > 0:
                return low, low
    return None


def _label(low: int, high: Optional[int]) -> str:
    if high is None:
        return f"{low:,}+ employees"
    return f"{low:,} employees" if low == high else f"{low:,}-{high:,} employees"


def _match(row: Dict, key: str, country: str) -> int:
    m = COMPANY_PAGE.match(row.get("url") or "")
    if not m:
        return 0
    title = re.sub(r"[^a-z0-9]", "", (row.get("title") or "").split("|")[0].split(":")[0].lower())
    slug = re.sub(r"[^a-z0-9]", "", m.group(1).lower())
    points = 0
    if title == key or slug == key:
        points += 4
    elif title.startswith(key) or slug.startswith(key):
        points += 2
    elif key in title or key in slug:
        points += 1
    else:
        return 0
    code = PARTNERS["countries"].get(country, {}).get("code", "")
    if code and re.match(rf"^https?://{code}\.linkedin\.com/", row.get("url") or "", re.I):
        points += 1
    return points


def _hq(row: Dict) -> str:
    text = f"{row.get('title', '')} {row.get('snippet', '')}"
    m = re.search(SIZE["headquarters"], text, re.I)
    if m:
        found = place_country(m.group(1))
        if found:
            return found
    sub = re.match(r"^https?://([a-z]{2})\.linkedin\.com/", row.get("url") or "", re.I)
    if not sub:
        return ""
    code = sub.group(1).lower()
    return next((n for n, c in PARTNERS["countries"].items() if c["code"] == code), "other")


def parent_name(name: str) -> str:
    words = short_name(name).replace("(", " ").replace(")", " ").split()
    while len(words) > 1 and words[-1].lower() in SIZE["parent_tails"]:
        words.pop()
    return " ".join(words)


def find_size(company: Dict, apis, fetcher, cache, stats: Dict, name: str = "") -> Dict:
    name = name or short_name(company["company"])
    q = SIZE["query"].format(name=quote_name(name))
    rows = cached_search(cache, apis, fetcher, q, "web", company["country"], 24, stats)
    key = re.sub(r"[^a-z0-9]", "", company_key(name))
    ranked = sorted(((_match(r, key, company["country"]), i, r) for i, r in enumerate(rows)),
                    key=lambda t: (-t[0], t[1]))
    ranked = [(p, r) for p, _, r in ranked if p > 0]
    empty = {"low": None, "high": None, "label": "", "linkedin": "", "hq": ""}
    if not ranked:
        return empty
    best = ranked[0][0]
    page = COMPANY_PAGE.match(ranked[0][1]["url"]).group(1)
    url = f"https://www.linkedin.com/company/{page}"
    for points, row in ranked:
        if points < best:
            break
        band = parse_size(f"{row.get('title', '')} {row.get('snippet', '')}")
        if band:
            return {"low": band[0], "high": band[1], "label": _label(*band), "linkedin": url, "hq": _hq(row),
                    "exact": best >= SIZE["exact_points"]}
    return {**empty, "linkedin": url, "hq": _hq(ranked[0][1]), "exact": best >= SIZE["exact_points"]}


def find_size_web(company: Dict, apis, fetcher, cache, stats: Dict, name: str, variant: int = 0) -> Dict:
    q = SIZE["web_queries"][variant].format(name=name.replace('"', ""), country=company["country"])
    rows = cached_search(cache, apis, fetcher, q, "web", company["country"], 24, stats)
    key = re.sub(r"[^a-z0-9]", "", company_key(name))
    best: Optional[Tuple[int, Optional[int], str, str]] = None
    for row in rows:
        host = domain_of(row.get("url") or "")
        site = next((s for s in SIZE["web_sites"] if host == s or host.endswith("." + s)), "")
        linkedin = bool(COMPANY_PAGE.match(row.get("url") or ""))
        if not (site or linkedin):
            continue
        where = re.sub(r"[^a-z0-9]", "", f"{row.get('title', '')} {row.get('url', '')}".lower())
        if len(key) < 3 or key not in where:
            continue
        band = parse_size(f"{row.get('title', '')} {row.get('snippet', '')}")
        if not band:
            continue
        top = band[1] if band[1] is not None else float("inf")
        if best is None or top > (best[1] if best[1] is not None else float("inf")):
            hq = _hq(row) if linkedin else place_country(row.get("snippet") or "")
            best = (band[0], band[1], "LinkedIn" if linkedin else site, hq)
    if not best:
        return {"low": None, "high": None, "label": "", "linkedin": "", "hq": ""}
    return {"low": best[0], "high": best[1], "label": f"{_label(best[0], best[1])} ({best[2]})", "linkedin": "",
            "hq": best[3]}


def size_fit(size: Dict, band: Dict) -> str:
    if band["max"] is None:
        return "yes"
    low, high = size.get("low"), size.get("high")
    if low is None:
        return "unknown"
    top = high if high is not None else float("inf")
    if low >= band["min"] and top <= band["max"]:
        return "yes"
    if low > band["max"] or top < band["min"]:
        return "no"
    return "maybe"


def parse_person(row: Dict[str, str], keys: List[str]):
    m = _PROFILE.match(row.get("url") or "")
    if not m:
        return None
    head = _LINKEDIN_SUFFIX.sub("", _plain(row.get("title", "")))
    desc = _plain(row.get("snippet", ""))
    parts = _PARTS.split(head)
    name = clean_name(parts[0].split(",")[0])
    if not looks_like_name(name):
        return None
    rest = " ".join(parts[1:])
    norm = re.sub(r"[^a-z0-9]", "", f"{rest} {desc}".lower())
    if not any(k in norm for k in keys):
        return None
    text = rest or desc
    if EXCLUDE_RX.search(text):
        return None
    title = TITLE_RX.search(rest) or TITLE_RX.search(desc)
    if not title:
        return None
    return {"name": name, "title": title.group(0).strip(), "linkedin": f"https://www.linkedin.com/in/{m.group(1)}"}


def find_people(company: Dict, apis, fetcher, cache, stats: Dict) -> List[Dict]:
    level = CONTACTS[company["companyType"]]
    short = " ".join(short_name(company["company"]).split()[:4])
    q = f"site:linkedin.com/in {quote_name(short)} {level['query']}"
    rows = cached_search(cache, apis, fetcher, q, "web", company["country"], 24, stats)
    keys = company_keys(company["company"], company.get("domain", ""))
    keys += [re.sub(r"[^a-z0-9]", "", company["key"])]
    keys = [k for k in dict.fromkeys(keys) if len(k) >= 4]
    found: Dict[str, Dict] = {}
    for row in rows:
        p = parse_person(row, keys)
        if p and p["name"].lower() not in found:
            found[p["name"].lower()] = p
    return list(found.values())[:PARTNERS["enrich"]["people_per_company"]]
