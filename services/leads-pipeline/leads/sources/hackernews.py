"""Discovery from the monthly Hacker News 'Who is hiring?' threads (via the Algolia API).

A startup hiring ML / infra engineers is a strong signal of GPU demand.
"""
import logging
import re
from typing import List

from bs4 import BeautifulSoup

from ..config import Settings
from ..fetch import Fetcher
from ..geo import is_indian_domain, mentions_india
from ..segments import SEGMENTS, classify
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)

SEARCH = "https://hn.algolia.com/api/v1/search_by_date"
ITEM = "https://hn.algolia.com/api/v1/items/{id}"

# Strong ML / GPU keywords. Plain "AI" alone is too noisy, so it isn't enough by itself.
_STRONG = re.compile(
    r"\b(machine learning|mlops|ml engineer|llms?|gpus?|cuda|deep learning|computer vision|"
    r"diffusion|inference|fine-?tuning|pytorch|generative ai|nlp|model training|"
    r"large language models?|speech recognition|text-to-speech)\b",
    re.I,
)


def parse_posting(html: str, item_id: str):
    """One top-level comment -> (company, domain, keywords) or None."""
    soup = BeautifulSoup(html or "", "lxml")
    text = soup.get_text("\n").strip()
    if not text:
        return None
    kws = sorted({m.group(0).lower() for m in _STRONG.finditer(text)}
                 | {m.group(0).lower() for seg in SEGMENTS.values() for m in seg.strong.finditer(text)})
    if not kws:
        return None
    header = text.split("\n", 1)[0]
    company = header.split("|")[0].strip()
    company = re.sub(r"\s*\(.*?\)\s*$", "", company).strip()
    if not company or len(company) > 60:
        return None
    domain = ""
    for a in soup.find_all("a", href=True):
        d = extract_domain(a["href"])
        if d and not is_blocked(d):
            domain = d
            break
    if not domain:
        return None
    return company, domain, kws


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    code, data, _ = fetcher.get_json(
        SEARCH, params={"tags": "story,author_whoishiring", "hitsPerPage": 8}, timeout=30
    )
    if code != 200 or not data:
        log.warning("HN search -> HTTP %s", code)
        return []
    threads = [h for h in data.get("hits", []) if "who is hiring" in (h.get("title") or "").lower()]
    out: List[Candidate] = []
    for t in threads[:2]:  # this month + last month
        tid = t["objectID"]
        icode, item, _ = fetcher.get_json(ITEM.format(id=tid), timeout=60)
        if icode != 200 or not item:
            continue
        month = (t.get("title") or "").split("(")[-1].rstrip(")")
        for child in item.get("children", []):
            parsed = parse_posting(child.get("text") or "", str(child.get("id")))
            if not parsed:
                continue
            company, domain, kws = parsed
            text = BeautifulSoup(child.get("text") or "", "lxml").get_text(" ")
            india = "yes" if mentions_india(text) or is_indian_domain(domain) else ""
            if s.india_only and not india:
                continue  # most HN postings are US/EU; keep only ones that mention India
            out.append(
                Candidate(
                    name=company,
                    domain=domain,
                    source="hn_hiring",
                    signal=f"Hiring on HN ({month}): {', '.join(kws[:4])}",
                    signal_url=f"https://news.ycombinator.com/item?id={child.get('id')}",
                    source_ref=f"hn:{child.get('id')}",
                    india=india,
                    segment=classify(kws, text) or ["ai"],
                )
            )
            if len(out) >= limit:
                return out
    return out
