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
from . import training as _training
from .extract import find_title, title_priority
from .util import clean_name, looks_like_name

log = logging.getLogger(__name__)

BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
PAUSE = 1.1  # one search a second: polite, and well under the plan's rate limit
TITLES = '(founder OR co-founder OR CEO OR CTO OR "chief technology officer" OR "head of AI")'
if _profile.current() == _profile.TRAINING:
    TITLES = _training.SEARCH_TITLES

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
    name = company.strip()
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


def find_people(api_key: str, fetcher, company: str, domain: str, limit: int = 3) -> Tuple[List[dict], str]:
    """(people, status). status: ok | off | rate_limited | error"""
    if not api_key:
        return [], "off"
    status, data, _ = fetcher.get_json(
        BRAVE_URL, params={"q": query_for(company), "count": 20, "country": "IN", "search_lang": "en"},
        headers={"X-Subscription-Token": api_key, "Accept": "application/json"})
    time.sleep(PAUSE)
    if status == 429:
        return [], "rate_limited"
    if status != 200 or not isinstance(data, dict):
        log.warning("people search failed for %s: HTTP %s", company, status)
        return [], "error"
    keys = company_keys(company, domain)
    found: Dict[str, dict] = {}
    for r in (data.get("web") or {}).get("results") or []:
        p = parse_result(r.get("title", ""), r.get("description", ""), r.get("url", ""), keys)
        if p and p["name"].lower() not in found:
            found[p["name"].lower()] = p
    people = sorted(found.values(), key=lambda p: title_priority(p["title"]))
    return people[:limit], "ok"
