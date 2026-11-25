"""Discovery from Indian startup funding news (RSS): Entrackr, Inc42, YourStory.

A startup in a GPU-hungry segment that has just raised money is about to spend on compute.
The round named in the story (seed, Series A, ...) is recorded as the company's stage.
The feeds only carry the latest ~20-50 stories, so this source relies on running daily.

The articles don't link to the company's website, so the domain is found by trying the
obvious candidates (desible.ai, curvet.ai, sunfox.com, ...) and accepting one only if its
home page actually carries the company name.
"""
import logging
import re
import socket
from typing import List

from bs4 import BeautifulSoup

from ..config import Settings
from ..fetch import Fetcher
from ..early import round_stage
from ..segments import classify
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)

FEEDS = {
    "entrackr": "https://entrackr.com/rss",
    "inc42": "https://inc42.com/feed/",
    "yourstory": "https://yourstory.com/feed",
    "et_startups": "https://economictimes.indiatimes.com/tech/startups/rssfeeds/78570540.cms",
    "inc42_buzz": "https://inc42.com/buzz/feed/",
    "techcrunch_india": "https://techcrunch.com/tag/india/feed/",
    "businessline_tech": "https://www.thehindubusinessline.com/info-tech/feeder/default.rss",
}
TLDS = ("ai", "com", "in", "co.in", "io")
MAX_GUESSES = 8

_VERB = re.compile(
    r"\s+(?:raises|raised|secures|bags|mops up|nets|picks up|closes|lands|to raise)\b", re.I)
_LEADS = re.compile(
    r"\bleads?\b.*?\b(?:round|funding|investment|series\s+[a-f]|seed)\s+in\s+(.+)$", re.I)
_DESCRIPTOR = re.compile(
    r"^.*\b(?:startup|start-up|platform|brand|company|firm|maker|provider|player|unicorn|"
    r"marketplace|app|lender|fintech|edtech|healthtech|medtech|saas)\s+", re.I)
_OWNER = re.compile(r"^.*?(?:-backed|-owned|-led|’s|'s)\s+", re.I)
_SKIP = re.compile(
    r"\b(?:fund\s+(?:i|ii|iii|iv|v|vi)\b|ipo|weekly|funding report|this week|first close|"
    r"final close)", re.I)
_PARKED = re.compile(r"\bfor sale\b|buy this domain|\bparked\b|hugedomains|\bsedo\b|dan\.com|afternic", re.I)


def company_from_headline(title: str) -> str:
    """'Agentic AI startup Desible.ai raises Rs 32 Cr ...' -> 'Desible.ai' ('' if no match)."""
    t = re.sub(r"^\s*(?:exclusive|breaking)\s*:\s*", "", title or "", flags=re.I).strip()
    if _SKIP.search(t):
        return ""
    m = _LEADS.search(t)
    if m:
        name = m.group(1)
    else:
        m = _VERB.search(t)
        if not m:
            return ""
        name = t[: m.start()]
    name = _OWNER.sub("", name) or name
    name = _DESCRIPTOR.sub("", name) or name
    name = name.strip(" ,:;-–—'\"")
    if not name or len(name.split()) > 4 or not name[0].isupper():
        return ""
    return name


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def guess_domains(name: str) -> List[str]:
    """Likely domains for a company name, most likely first."""
    low = name.lower().strip()
    out = []
    if " " not in low and re.search(r"\.[a-z]{2,}$", low):
        out.append(low)  # the name is already a domain: 'Desible.ai'
    slug = _norm(re.sub(r"\.[a-z]{2,}$", "", low))
    stem = re.sub(r"(?:technologies|technology|tech|labs|ai|india)$", "", slug)
    bases = [b for b in dict.fromkeys([stem, slug]) if len(b) >= 4]
    for b in bases:
        for tld in TLDS:
            out.append(f"{b}.{tld}")
    return list(dict.fromkeys(out))[:MAX_GUESSES]


def page_matches(html: str, name: str) -> bool:
    """Does this home page belong to `name`? Checks title / site name / top of the page."""
    soup = BeautifulSoup(html, "lxml")
    head = " ".join(
        [soup.title.get_text(" ") if soup.title else ""]
        + [m.get("content", "") for m in soup.find_all("meta", attrs={"property": "og:site_name"})]
    )
    top = soup.get_text(" ")[:3000]
    if _PARKED.search(head) or _PARKED.search(top[:500]):
        return False
    key = _norm(re.sub(r"\.[a-z]{2,}$", "", name.lower()))
    stem = re.sub(r"(?:technologies|technology|tech|labs|ai|india)$", "", key)
    return any(k and len(k) >= 3 and (k in _norm(head) or k in _norm(top)) for k in (key, stem))


def _resolves(host: str) -> bool:
    """Quick check that something answers on port 443, so dead guesses cost seconds, not retries."""
    try:
        socket.create_connection((host, 443), timeout=5).close()
        return True
    except (UnicodeError, OSError):
        return False


def resolve_domain(fetcher: Fetcher, name: str) -> str:
    for d in guess_domains(name):
        if is_blocked(d) or not _resolves(d):
            continue
        html = fetcher.get_html(f"https://{d}/") or fetcher.get_html(f"https://www.{d}/")
        if html and page_matches(html, name):
            return extract_domain(d)
    return ""


def parse_feed(xml: str) -> List[dict]:
    soup = BeautifulSoup(xml or "", "xml")
    items = []
    for it in soup.find_all("item"):
        body = " ".join(x.get_text(" ") for x in it.find_all(["description", "encoded", "content"]))
        items.append({
            "title": (it.title.get_text(strip=True) if it.title else ""),
            "link": (it.link.get_text(strip=True) if it.link else ""),
            "date": (it.pubDate.get_text(strip=True)[:16] if it.pubDate else ""),
            "text": BeautifulSoup(body, "lxml").get_text(" ")[:1500],
        })
    return items


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    seen = store.state["cursors"].get("funding_seen", [])
    seen_set = set(seen)
    out: List[Candidate] = []
    for feed, url in FEEDS.items():
        xml = fetcher.get_html(url)
        if not xml:
            log.warning("funding feed %s unavailable", feed)
            continue
        for item in parse_feed(xml):
            if len(out) >= limit:
                break
            link = item["link"]
            if not link or link in seen_set:
                continue
            seen_set.add(link)
            seen.append(link)
            name = company_from_headline(item["title"])
            # Only the headline and the opening sentence describe the company; later mentions are
            # usually incidental ("will use the funds to strengthen its AI-powered tech").
            lead = re.split(r"(?<=[.!?])\s", item["text"].strip(), maxsplit=1)[0][:400]
            segs = classify([name, item["title"]], lead) if name else []
            if not segs:
                continue
            domain = resolve_domain(fetcher, name)
            if not domain:
                log.info("funding: no website found for %r (%s)", name, link)
                continue
            out.append(Candidate(
                name=name,
                domain=domain,
                source="funding",
                signal=f"Funding news ({feed}, {item['date']}): {item['title']}"[:250],
                signal_url=link,
                source_ref=f"news:{feed}",
                # Name was literally the domain ('Desible.ai'): trust it. A guessed domain could
                # be a namesake abroad, so leave it to the scrape stage to confirm it's Indian.
                india="yes" if domain == name.lower() else "",
                segment=segs,
                stage=round_stage(f"{item['title']} {lead}"),
            ))
    store.state["cursors"]["funding_seen"] = seen[-3000:]
    return out
