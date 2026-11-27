"""Decision makers from public search results, for companies whose website names nobody.

Runs  site:linkedin.com/in "Company" (founder OR CEO OR CTO ...)  through the Brave Search API
(key from api.search.brave.com; $5 free credit a month, ~1,000 searches) and reads only the search engine's titles and
snippets, e.g.  'Anand Budni - Chief Executive Officer - Peptris | LinkedIn'.  LinkedIn itself is
never opened. A result is kept only when its name looks like a person, it names this company,
and it carries a current decision-maker title (former / advisor / investor are skipped).
"""
import html
import logging
import re
import time
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import tldextract

from . import profile as _profile
from . import rules as _rules
from . import training as _training
from .extract import find_title, title_priority
from .util import clean_name, looks_like_name

log = logging.getLogger(__name__)

BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
PAUSE = 1.1  # one search a second: polite, and well under the plan's rate limit
TITLES = '(founder OR co-founder OR CEO OR CTO OR "chief technology officer" OR "head of AI")'
if _profile.current() == _profile.TRAINING:
    TITLES = _training.SEARCH_TITLES
elif _rules.current():
    TITLES = _rules.current().SEARCH_TITLES

_PROFILE = re.compile(r"^https?://(?:[a-z]{2,3}\.)?linkedin\.com/in/([^/?#]+)", re.I)
_TAGS = re.compile(r"<[^>]+>")
_LINKEDIN_SUFFIX = re.compile(r"\s*[|\-–—]\s*LinkedIn\s*$", re.I)
_PARTS = re.compile(r"\s+[-–—|·]\s+")
_NOISE = re.compile(r"\b(?:pvt|private|ltd|limited|llp|inc|technologies|technology|tech|labs?|"
                    r"solutions|india|software|systems|innovations?|ventures)\b\.?", re.I)


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def _plain(text: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(_TAGS.sub("", text or ""))).strip()


def query_for(company: str) -> str:
    name = re.split(r"\s*[:|\-–—]\s*", company.strip())[0].strip()
    words = name.split()
    if len(words) > 6:
        name = " ".join(words[:6])
    return f'site:linkedin.com/in {quote_name(name)} {TITLES}'


def quote_name(name: str) -> str:
    """Multi-word names in quotes; a one-word name (often just the domain, 'Celerisai') unquoted
    so 'Celeris AI' still matches."""
    return f'"{name}"' if " " in name else name


def google_url(company: str) -> str:
    """The same search in a normal browser, for checking by hand."""
    return "https://www.google.com/search?q=" + quote_plus(query_for(company))


def company_keys(company: str, domain: str) -> List[str]:
    """Normalised spellings that must appear in a result for it to count as this company."""
    keys = {_norm(company), _norm(_NOISE.sub(" ", company))}
    stem = tldextract.extract(domain or "").domain
    keys.add(_norm(stem))
    return [k for k in keys if len(k) >= 4]


def parse_result(title: str, description: str, url: str, keys: List[str]) -> Optional[Dict[str, str]]:
    m = _PROFILE.match(url or "")
    if not m:
        return None
    head = _LINKEDIN_SUFFIX.sub("", _plain(title))
    desc = _plain(description)
    parts = _PARTS.split(head)
    name = clean_name(parts[0].split(",")[0])  # 'Jane Doe, PhD' -> 'Jane Doe'
    if not looks_like_name(name):
        return None
    rest = " ".join(parts[1:])
    if not any(k in _norm(rest + " " + desc) for k in keys):
        return None
    job = find_title(rest) or find_title(desc)
    if not job:
        return None
    return {"name": name, "title": job, "linkedin": f"https://www.linkedin.com/in/{m.group(1)}"}


def brave_country(country: str) -> str:
    """Brave's country for a company's country: its own where Brave serves one, else everywhere
    (a Dubai company's founders are not in India-only results)."""
    from .geo import COUNTRIES
    from .sources.search import BRAVE_COUNTRIES
    code = COUNTRIES.get(country or "", {}).get("code", "")
    if not country:
        return "IN"
    return code if code in BRAVE_COUNTRIES else "ALL"


SERPER_URL = "https://google.serper.dev/search"
TAVILY_URL = "https://api.tavily.com/search"
# answers meaning "this key cannot search now" (limit, credit, key): try the next search API
SWITCH = {400, 401, 402, 403, 429, 432, 433}


def _search(name: str, key: str, fetcher, q: str, country: str):
    from .geo import COUNTRIES
    code = COUNTRIES.get(country or "", {}).get("code", "IN" if not country else "")
    clean_key = (key or "").strip().strip('"\'')
    if name == "serper":
        status, data = fetcher.post_json(
            SERPER_URL, {"q": q, "num": 20, **({"gl": code.lower()} if code else {})},
            headers={"X-API-KEY": clean_key, "Content-Type": "application/json"})
        rows = (data or {}).get("organic", []) if isinstance(data, dict) else []
        return status, [(r.get("title", ""), r.get("snippet", ""), r.get("link", "")) for r in rows], data
    if name == "tavily":
        status, data = fetcher.post_json(
            TAVILY_URL, {"query": q, "max_results": 20, "search_depth": "basic",
                         **({"country": (country or "India").lower()} if code else {})},
            headers={"Authorization": f"Bearer {clean_key}", "Content-Type": "application/json"})
        rows = (data or {}).get("results", []) if isinstance(data, dict) else []
        return status, [(r.get("title", ""), r.get("content", ""), r.get("url", "")) for r in rows], data
    status, data, _ = fetcher.get_json(
        BRAVE_URL, params={"q": q, "count": 20, "country": brave_country(country), "search_lang": "en"},
        headers={"X-Subscription-Token": clean_key, "Accept": "application/json"})
    rows = ((data or {}).get("web") or {}).get("results") or [] if isinstance(data, dict) else []
    return status, [(r.get("title", ""), r.get("description", ""), r.get("url", "")) for r in rows], data


def find_people(apis: List[Tuple[str, str]], fetcher, company: str, domain: str, limit: int = 3,
                country: str = "") -> Tuple[List[dict], str]:
    if not apis:
        return [], "off"
    status, rows = 0, []
    for name, key in apis:
        status, rows, data = _search(name, key, fetcher, query_for(company), country)
        time.sleep(PAUSE)
        if status not in SWITCH:
            break
        msg = (data or {}).get("message") if isinstance(data, dict) else ""
        log.warning("people search: %s cannot search now (HTTP %s%s)",
                    name, status, f" - {msg}" if msg else "")
    if status in SWITCH:
        return [], "rate_limited"
    if status != 200:
        log.warning("people search failed for %s: HTTP %s", company, status)
        return [], "error"
    keys = company_keys(company, domain)
    found: Dict[str, dict] = {}
    for title, description, url in rows:
        p = parse_result(title, description, url, keys)
        if p and p["name"].lower() not in found:
            found[p["name"].lower()] = p
    people = sorted(found.values(), key=lambda p: title_priority(p["title"]))
    return people[:limit], "ok"
