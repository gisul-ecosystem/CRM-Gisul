"""Discovery from competitor cloud & compute provider testimonials and case studies.

Crawls cloud providers competing with Racko (E2E Networks, Yotta, JarvisLabs, RunPod,
Lambda Labs, CoreWeave, Hyperstack, Nebius, Together AI, etc.) listed in leads/competitors.csv.
Recursively fetches their customer testimonials and case studies, extracts client company
details, domain, decision makers, and testimonial quotes, and tags them as competitor clients.

Competitor clients represent prime sales prospects because they are actively renting and paying
for cloud GPUs, VMs, and compute infrastructure right now.
"""
import csv
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..config import Settings
from ..fetch import Fetcher
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)

LIST_FILE = Path(__file__).resolve().parent.parent / "competitors.csv"

# Domains that are never client websites (social networks, CDNs, developer tools, site builders)
SKIP_DOMAINS = frozenset({
    "twitter.com", "x.com", "linkedin.com", "facebook.com", "instagram.com", "youtube.com",
    "github.com", "medium.com", "wa.me", "whatsapp.com", "play.google.com", "apps.apple.com",
    "goo.gl", "maps.app.goo.gl", "wix.com", "wordpress.org", "elementor.com", "squarespace.com",
    "webflow.io", "typeform.com", "mailchimp.com", "slack.com", "discord.gg", "discord.com",
    "zoom.us", "calendly.com", "linktr.ee", "notion.site", "substack.com", "google.com",
    "microsoft.com", "apple.com", "amazon.com", "aws.amazon.com", "cloudflare.com", "nvidia.com",
    "vimeo.com", "docker.com", "kubernetes.io", "reddit.com", "tiktok.com", "schema.org"
})

MAX_FOLLOW_PER_PROVIDER = 25  # case study pages read per cloud provider per run
PAUSE_AFTER = 40              # checked clients with no good lead before a provider is paused

_TITLE_PATTERNS = [
    re.compile(r"^(?:case study|customer story|success story)\s*[:|-]\s*([A-Za-z0-9\s&.-]{2,35})", re.I),
    re.compile(r"^([A-Za-z0-9\s&.-]{2,35})\s+(?:case study|customer story|success story)", re.I),
    re.compile(r"^how\s+([A-Za-z0-9\s&.-]{2,35}?)\s+(?:uses|used|accelerates|accelerated|scales|scaled|trains|trained|builds|built|reduced|cuts|cut|achieved|deployed|powers|partners)", re.I),
    re.compile(r"([A-Za-z0-9\s&.-]{2,35}?)\s+(?:leverages|partners with|migrates to|deploys)\b", re.I),
]

_ATTRIBUTION_RE = re.compile(
    r"(?:[-\u2013\u2014~|]|\bby\b|\bfrom\b)\s*"
    r"((?:Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Prof\.?)?\s*[A-Z][a-zA-Z\s.]{2,30}?)\s*"
    r"[,|\-\u2013\u2014/]\s*"
    r"((?:co-?founder|founder|ceo|cto|cfo|coo|chief [a-z]+ officer|head of [a-z\s]+|director|vp|president)[a-zA-Z\s&/-]*?)"
    r"(?:\s+at\s+|\s+of\s+|,\s*|$)",
    re.I
)

_SUBPAGE_PATH_RE = re.compile(
    r"/(?:case-stud(?:y|ies)|customers?|success-stor(?:y|ies)|testimonials?|client-stories|clients|stories)/",
    re.I
)


def read_list(path: Path = LIST_FILE) -> List[dict]:
    """Read cloud & compute provider list from CSV."""
    if not path.exists():
        return []
    lines = [ln for ln in path.read_text(encoding="utf-8").splitlines()
             if ln.strip() and not ln.lstrip().startswith("#")]
    return [{k.strip(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(lines)]


def yields(df, state: dict) -> Dict[str, dict]:
    """Calculate lead yields per competitor cloud provider (listed, checked, kept, good, ready)."""
    origin = dict(state.get("competitor_of", {}))
    if len(df):
        for ref, dom in zip(df["source_ref"], df["domain"]):
            if ref.startswith("comp:"):
                origin.setdefault(dom, ref[len("comp:"):])
    rejected = state.get("rejected", {})
    firms = df.drop_duplicates("domain").set_index("domain") if len(df) else None
    ready = df.loc[df["ready"] == "yes", "domain"].value_counts() if len(df) else {}
    out: Dict[str, dict] = {}
    for dom, name in origin.items():
        y = out.setdefault(name, {"listed": 0, "checked": 0, "kept": 0, "good": 0, "ready": 0})
        y["listed"] += 1
        if dom in rejected:
            y["checked"] += 1
        elif firms is not None and dom in firms.index and firms.at[dom, "status"] != "discovered":
            y["checked"] += 1
            y["kept"] += 1
            y["good"] += firms.at[dom, "intent"] in ("high", "medium")
            y["ready"] += int(ready.get(dom, 0))
    for y in out.values():
        y["score"] = round((y["good"] + 0.5 * y["kept"] + 1) / (y["checked"] + 4), 3)
        y["status"] = ("paused" if y["checked"] >= PAUSE_AFTER and y["good"] == 0 and y["ready"] == 0
                       else "learning" if y["checked"] < 10 else "active")
    return out


def ranked(competitors: List[dict], measured: Dict[str, dict]) -> List[dict]:
    """Ranks competitors by yield; unvisited ones start with fair default score (0.35)."""
    def score(comp):
        return measured.get(comp["provider"], {}).get("score", 0.35)
    return sorted(competitors, key=score, reverse=True)


def _clean_name(raw: str) -> str:
    """Normalize extracted company name."""
    name = re.sub(r"^(?:visit|about|client|case study:?|logo)\s+", "", raw or "", flags=re.I).strip()
    name = re.sub(r"\s+logo$", "", name, flags=re.I).strip()
    return name[:50]


def extract_outbound_client_domain(soup: BeautifulSoup, own_domain: str) -> Tuple[str, str]:
    """Find the most plausible client domain and company name from outbound links."""
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith(("http://", "https://")):
            continue
        d = extract_domain(href)
        if not d or d == own_domain or d in SKIP_DOMAINS or is_blocked(d):
            continue
        # Check if text or aria-label looks like the company
        img = a.find("img")
        name = a.get_text(" ", strip=True) or (img.get("alt", "").strip() if img else "")
        name = _clean_name(name)
        if not name or len(name) > 50 or "://" in name:
            name = d.split(".")[0].replace("-", " ").title()
        return d, name
    return "", ""


def extract_person_and_quote(soup: BeautifulSoup) -> Tuple[str, str, str]:
    """Extract (person_name, person_title, quote_snippet) from testimonial quotes/attribution."""
    for tag in soup.find_all(["blockquote", "q", "cite", "footer", "figcaption", "p", "div"]):
        text = tag.get_text(" ", strip=True)
        if len(text) < 10 or len(text) > 800:
            continue
        m = _ATTRIBUTION_RE.search(text)
        if m:
            person_name = m.group(1).strip()
            person_title = m.group(2).strip()
            person_name = re.sub(r"^(?:dr|mr|mrs|ms|prof)\.?\s+", "", person_name, flags=re.I).strip()
            quote = text[:200]
            return person_name, person_title, quote
    return "", "", ""


def extract_company_from_title(title: str) -> str:
    """Extract client company name from case study title."""
    clean = title.strip()
    for pat in _TITLE_PATTERNS:
        m = pat.search(clean)
        if m:
            return _clean_name(m.group(1))
    return ""


def parse_case_study(html: str, page_url: str, provider: dict) -> Optional[dict]:
    """Parse one case study or testimonial page to extract client details."""
    if not html:
        return None
    own_domain = extract_domain(provider["url"])
    soup = BeautifulSoup(html, "lxml")

    # 1. Title / Heading
    h1 = soup.find("h1")
    title_text = h1.get_text(" ", strip=True) if h1 else ""
    if not title_text:
        title_tag = soup.find("title")
        title_text = title_tag.get_text(" ", strip=True) if title_tag else ""
    client_name = extract_company_from_title(title_text)

    # 2. Outbound domain (the client's website)
    client_domain, link_name = extract_outbound_client_domain(soup, own_domain)
    if not client_name and link_name:
        client_name = link_name

    # 3. Decision maker & testimonial quote
    person_name, person_title, quote = extract_person_and_quote(soup)

    # 4. If no outbound link found, look for domain mentioned in text
    if not client_domain:
        text = soup.get_text(" ")
        m_dom = re.search(r"\b([a-zA-Z0-9-]{3,30}\.(?:com|in|ai|io|co\.in|tech|net))\b", text)
        if m_dom:
            cand_dom = extract_domain("https://" + m_dom.group(1))
            if cand_dom and cand_dom != own_domain and cand_dom not in SKIP_DOMAINS and not is_blocked(cand_dom):
                client_domain = cand_dom

    # If domain still missing but we have client name, derive domain if clean
    if not client_domain and client_name and " " not in client_name and len(client_name) >= 3:
        # e.g. "Peptris" -> "peptris.com" (site scrape stage verifies reachable)
        client_domain = f"{client_name.lower()}.com"

    if not client_domain:
        return None

    if not client_name:
        client_name = client_domain.split(".")[0].replace("-", " ").title()

    summary = quote if quote else f"Case study on cloud compute usage: {title_text[:120]}"

    return {
        "name": client_name,
        "domain": client_domain,
        "person_name": person_name,
        "person_title": person_title,
        "signal": f"Client of {provider['provider']}: {summary}",
        "signal_url": page_url,
    }


def find_case_study_subpages(html: str, index_url: str, provider: dict) -> List[str]:
    """Find all case-study and customer story links on a cloud provider's testimonials page."""
    if not html:
        return []
    own_domain = extract_domain(index_url)
    follow_prefix = provider.get("follow", "").strip().rstrip("/")
    soup = BeautifulSoup(html, "lxml")
    subpages = []
    seen = set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        url = urljoin(index_url, href).split("#")[0].split("?")[0].rstrip("/")
        if not url or url in seen or url == index_url.rstrip("/"):
            continue
        parsed = urlparse(url)
        if extract_domain(url) != own_domain:
            continue
        path = parsed.path
        if follow_prefix and path.startswith(follow_prefix + "/"):
            seen.add(url)
            subpages.append(url)
        elif not follow_prefix and _SUBPAGE_PATH_RE.search(path) and len(path.strip("/").split("/")) >= 2:
            seen.add(url)
            subpages.append(url)

    return subpages


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int,
             list_file: Path = LIST_FILE) -> List[Candidate]:
    """Discover competitor clients from cloud provider testimonials and case studies."""
    cursor = "competitors_seen"
    seen = set(store.state["cursors"].get(cursor, []))
    origin = store.state.setdefault("competitor_of", {})
    followed_state = store.state["cursors"].setdefault("competitors_followed", {})
    measured = yields(store.df, store.state)
    out: List[Candidate] = []

    for comp in ranked(read_list(list_file), measured):
        if len(out) >= limit:
            break
        y = measured.get(comp["provider"], {})
        if y.get("status") == "paused":
            log.info("competitor provider %s paused (no good leads after %d checked)", comp["provider"], y["checked"])
            continue

        url = comp.get("testimonials_url") or comp["url"]
        log.info("checking competitor testimonials: %s (%s)", comp["provider"], url)
        html = fetcher.get_html(url)
        if not html and hasattr(fetcher, "render"):
            html = fetcher.render(url, expand=True)

        if not html:
            log.warning("competitor page unreachable: %s", url)
            continue

        # 1. Extract clients present directly on the main testimonials page (cards, quotes, logos)
        card_clients = []
        soup = BeautifulSoup(html, "lxml")
        own_domain = extract_domain(url)
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href.startswith(("http://", "https://")):
                continue
            d = extract_domain(href)
            if not d or d == own_domain or d in SKIP_DOMAINS or is_blocked(d):
                continue
            name = a.get_text(" ", strip=True) or d.split(".")[0].replace("-", " ").title()
            card_clients.append({"name": name, "domain": d, "person_name": "", "person_title": "",
                                 "signal": f"Client testimonial on {comp['provider']}", "signal_url": url})

        # 2. Find and recursively follow detailed case study subpages
        subpages = find_case_study_subpages(html, url, comp)
        done_subpages = set(followed_state.setdefault(comp["provider"], []))
        todo_subpages = [sp for sp in subpages if sp not in done_subpages]

        for sp in todo_subpages[:MAX_FOLLOW_PER_PROVIDER]:
            if len(out) >= limit:
                break
            done_subpages.add(sp)
            followed_state[comp["provider"]].append(sp)
            sub_html = fetcher.get_html(sp)
            if not sub_html and hasattr(fetcher, "render"):
                sub_html = fetcher.render(sp)
            parsed = parse_case_study(sub_html, sp, comp)
            if parsed:
                card_clients.append(parsed)

        # 3. Add extracted clients to candidate list
        for c in card_clients:
            dom = c["domain"]
            origin.setdefault(dom, comp["provider"])
            if dom in seen or is_blocked(dom):
                continue
            seen.add(dom)
            origin[dom] = comp["provider"]
            out.append(Candidate(
                name=c["name"],
                domain=dom,
                source="competitors",
                signal=c["signal"],
                signal_url=c["signal_url"],
                source_ref=f"comp:{comp['provider']}",
                india=comp.get("india") or "check",
                segment="competitor_clients",
                person_name=c.get("person_name", ""),
                person_title=c.get("person_title", ""),
            ))
            if len(out) >= limit:
                break

    store.state["cursors"][cursor] = sorted(seen)
    return out
