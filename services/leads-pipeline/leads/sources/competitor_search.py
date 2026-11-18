import logging
import re
import time
from datetime import date, timedelta
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..config import Settings
from ..custom_search import CUSTOM_SEARCH
from ..fetch import Fetcher
from ..people_search import PAUSE
from ..store import Store
from ..util import extract_domain, is_blocked
from . import search

log = logging.getLogger(__name__)

COMPETITOR_SEARCH = {
    "provider_topics": (
        "GPU cloud provider",
        "rent H100 GPU cloud",
        "GPU as a service",
        "AI cloud infrastructure provider",
        "bare metal GPU servers",
        "cloud GPU rental for AI training",
        "sovereign AI cloud",
        "GPU cloud for LLM inference",
    ),
    "alternative_queries": (
        "alternatives to {provider} GPU cloud",
    ),
    "provider_queries_per_run": 6,
    "alternative_queries_per_run": 3,
    "new_providers_per_run": 10,
    "max_found_providers": 80,
    "case_study_query": 'site:{domain} "case study" OR customer OR "success story"',
    "mention_query": '"{provider}" GPU "case study" OR "powered by" OR "we use" OR "partnered with" -site:{domain}',
    "repeat_days": 30,
    "min_provider_words": 3,
    "provider_words": (
        r"\bgpu cloud\b", r"\bcloud gpus?\b", r"\bgpu instances?\b", r"\bh100\b", r"\bh200\b", r"\ba100\b",
        r"\bl40s\b", r"\bb200\b", r"\bbare[- ]metal\b", r"\bgpu servers?\b", r"\bper hour\b", r"/hr\b",
        r"\bon-demand\b", r"\bai cloud\b", r"\bgpu-as-a-service\b", r"\bgpu as a service\b",
        r"\binference\b", r"\bfine-?tun\w*", r"\bkubernetes\b", r"\bvirtual machines?\b",
    ),
    "usage_words": r"\b(?:uses?|using|used|powered by|partner\w*|migrat\w*|runs? on|built on|trained on|"
                   r"deployed on|chose|selects?|selected|customer|case study|success story)\b",
    "not_a_client_title": r"\balternatives?\b|\bvs\.?\b|\bversus\b|\breview\w*\b|\bpricing\b|\btop \d+\b|"
                          r"\bbest\b|\bcompare\w*\b|\bcomparison\b|\bcoupon\b|\bpromo\b",
    "index_path": r"/(?:case-stud(?:y|ies)|customers?|customer-stories|success-stor(?:y|ies)|testimonials?|"
                  r"client-stories|clients)/?$",
    "skip_domains": (
        "aws.amazon.com", "amazon.com", "azure.microsoft.com", "microsoft.com", "cloud.google.com", "google.com",
        "oracle.com", "ibm.com", "nvidia.com", "alibabacloud.com", "digitalocean.com", "github.com",
        "youtube.com", "reddit.com", "quora.com", "news.ycombinator.com", "ycombinator.com",
    ),
}

_PROVIDER_WORDS = [re.compile(w, re.I) for w in COMPETITOR_SEARCH["provider_words"]]
_USAGE = re.compile(COMPETITOR_SEARCH["usage_words"], re.I)
_NOT_A_CLIENT = re.compile(COMPETITOR_SEARCH["not_a_client_title"], re.I)
_INDEX_PATH = re.compile(COMPETITOR_SEARCH["index_path"], re.I)
_STATE_PROVIDERS = "competitor_providers_found"
_STATE_QUERIES = "competitor_search_done"


def _skip_domains() -> Set[str]:
    return (set(COMPETITOR_SEARCH["skip_domains"]) | set(CUSTOM_SEARCH["own_domains"])
            | set(CUSTOM_SEARCH["listing_domains"]) | search.GPU_SKIP | search.SEA_SKIP | search.GULF_SKIP)


class SearchBudget:
    def __init__(self, s: Settings, store: Store):
        self.apis = search.providers(s)
        self.left = max(0, int(getattr(s, "search_discovery_per_run", 0) or 0))
        self.done: Dict[str, str] = store.state["cursors"].setdefault(_STATE_QUERIES, {})
        self.stopped = not self.apis or self.left <= 0
        if self.stopped:
            log.info("competitor search: off (needs SERPER_API_KEY, TAVILY_API_KEY or BRAVE_API_KEY, "
                     "and SEARCH_DISCOVERY_PER_RUN > 0)")
        else:
            log.info("competitor search: using %s, up to %d searches this run", self.apis[0][0], self.left)

    def fresh(self, q: str) -> bool:
        last = self.done.get(q)
        if not last:
            return True
        try:
            return date.fromisoformat(last) <= date.today() - timedelta(days=COMPETITOR_SEARCH["repeat_days"])
        except ValueError:
            return True

    def run(self, q: str, fetcher: Fetcher) -> Optional[List[dict]]:
        if self.stopped or self.left <= 0 or not self.fresh(q):
            return None
        name, key = self.apis[0]
        status, rows = search.run_query(name, key, fetcher, q)
        time.sleep(PAUSE)
        while status in search.SWITCH and len(self.apis) > 1:
            log.warning("competitor search: %s cannot search now (HTTP %s); switching to %s",
                        name, status, self.apis[1][0])
            self.apis = self.apis[1:]
            name, key = self.apis[0]
            status, rows = search.run_query(name, key, fetcher, q)
            time.sleep(PAUSE)
        if status in search.SWITCH:
            log.warning("competitor search: %s limit or credit used up (HTTP %s)", name, status)
            self.stopped = True
            return None
        if status != 200:
            log.warning("competitor search %r failed: HTTP %s", q, status)
            return None
        self.left -= 1
        self.done[q] = date.today().isoformat()
        return rows


def found_providers(store: Store) -> List[dict]:
    return list(store.state.get(_STATE_PROVIDERS, {}).values())


def _provider_word_hits(text: str) -> int:
    return sum(1 for rx in _PROVIDER_WORDS if rx.search(text))


def _index_page(soup: BeautifulSoup, home: str, domain: str) -> str:
    for a in soup.find_all("a", href=True):
        url = urljoin(home, a["href"].strip()).split("#")[0].split("?")[0]
        if extract_domain(url) == domain and _INDEX_PATH.search(urlparse(url).path):
            return url
    return ""


def _provider_name(soup: BeautifulSoup, domain: str) -> str:
    title = soup.find("title")
    return search.name_from_title(title.get_text(" ", strip=True) if title else "", domain)


def check_provider(fetcher: Fetcher, domain: str) -> Optional[dict]:
    home = f"https://{domain}"
    html = fetcher.get_html(home)
    if not html and hasattr(fetcher, "render"):
        html = fetcher.render(home)
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")
    if _provider_word_hits(soup.get_text(" ")) < COMPETITOR_SEARCH["min_provider_words"]:
        return None
    index = _index_page(soup, home, domain)
    return {
        "provider": _provider_name(soup, domain),
        "url": home,
        "testimonials_url": index or home,
        "india": "yes" if domain.endswith(".in") else "check",
        "follow": urlparse(index).path.rstrip("/") if index else "",
        "found": date.today().isoformat(),
    }


def _provider_queries(s: Settings, known: List[dict]) -> Tuple[List[str], List[str]]:
    countries = list(getattr(s, "countries", ("India",)) or ("India",))
    topical = [f"{t} {c}" for c in countries for t in COMPETITOR_SEARCH["provider_topics"]]
    alternatives = [q.format(provider=p["provider"]) for p in known for q in COMPETITOR_SEARCH["alternative_queries"]]
    return topical, alternatives


def find_providers(s: Settings, fetcher: Fetcher, store: Store, budget: SearchBudget,
                   known: List[dict]) -> List[dict]:
    found: Dict[str, dict] = store.state.setdefault(_STATE_PROVIDERS, {})
    known_domains = {extract_domain(p["url"]) for p in known} | set(found)
    rejected: Dict[str, str] = store.state["cursors"].setdefault("competitor_providers_rejected", {})
    skip = _skip_domains()
    topical, alternatives = _provider_queries(s, known)
    plan = ([q for q in topical if budget.fresh(q)][:COMPETITOR_SEARCH["provider_queries_per_run"]]
            + [q for q in alternatives if budget.fresh(q)][:COMPETITOR_SEARCH["alternative_queries_per_run"]])
    added: List[dict] = []
    for q in plan:
        if len(added) >= COMPETITOR_SEARCH["new_providers_per_run"] or len(found) >= COMPETITOR_SEARCH["max_found_providers"]:
            break
        rows = budget.run(q, fetcher)
        if rows is None:
            if budget.stopped:
                break
            continue
        for r in rows:
            d = extract_domain(r.get("url", ""))
            if not d or d in known_domains or d in rejected or d in skip or is_blocked(d):
                continue
            if _NOT_A_CLIENT.search(r.get("title", "")) and not _provider_word_hits(r.get("snippet", "")):
                continue
            known_domains.add(d)
            info = check_provider(fetcher, d)
            if not info:
                rejected[d] = date.today().isoformat()
                continue
            found[d] = info
            added.append(info)
            log.info("competitor search: new provider %s (%s), customers page %s", info["provider"], d,
                     info["testimonials_url"])
            if len(added) >= COMPETITOR_SEARCH["new_providers_per_run"]:
                break
    return added


def case_study_urls(fetcher: Fetcher, budget: SearchBudget, provider: dict) -> List[str]:
    domain = extract_domain(provider["url"])
    rows = budget.run(COMPETITOR_SEARCH["case_study_query"].format(domain=domain), fetcher)
    urls = []
    for r in rows or []:
        url = (r.get("url") or "").split("#")[0].split("?")[0].rstrip("/")
        if url and extract_domain(url) == domain and urlparse(url).path.strip("/"):
            urls.append(url)
    return urls


def mentioned_clients(fetcher: Fetcher, budget: SearchBudget, provider: dict) -> List[dict]:
    domain = extract_domain(provider["url"])
    name = provider["provider"]
    rows = budget.run(COMPETITOR_SEARCH["mention_query"].format(provider=name, domain=domain), fetcher)
    skip = _skip_domains()
    out = []
    needle = name.lower()
    for r in rows or []:
        d = extract_domain(r.get("url", ""))
        title = r.get("title", "")
        text = f"{title} {r.get('snippet', '')}"
        if not d or d == domain or d in skip or is_blocked(d):
            continue
        if _NOT_A_CLIENT.search(title) or needle not in text.lower() or not _USAGE.search(text):
            continue
        out.append({"domain": d, "person_name": "", "person_title": "",
                    "signal": f"Mentions using {name}: {title[:120]}", "signal_url": r.get("url", ""),
                    "text": text})
    return out
