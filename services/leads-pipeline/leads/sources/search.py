"""Organisations found through web search, for each profile with its own search list.

  training  small / medium institutes: "<course> training institute in <city>" (training.py)
  gpu       startups that rent GPUs: "<kind of startup> in <city>" (GPU_TOPICS x GPU_CITIES below)

Neither profile's searches, skip list or memory of searched queries touch the other's (the
memory is in each profile's own state.json). It runs "<topic> in <city>" through a search API - Serper
(SERPER_API_KEY, 2,500 free searches, no card), Tavily (TAVILY_API_KEY, 1,000 free a month, no
card) or Brave (BRAVE_API_KEY), first key set wins - takes each result's website once, and skips listings, social
media, marketplaces and large brands (training.SEARCH_SKIP). Every site is then checked like
any other: Indian, runs training in lab-heavy subjects, small / medium size. Each query runs
once; SEARCH_DISCOVERY_PER_RUN caps how many a run uses (Brave: $5 free credit ~ 1,000 a month).
"""
import itertools
import logging
import re
import time
from typing import List

from .. import training
from ..geo import COUNTRIES, city_country
from ..config import Settings
from ..fetch import Fetcher
from ..people_search import BRAVE_URL, PAUSE
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)


_NOT_A_NAME = re.compile(r"startups?\b|companies|\bstudios? in\b|"
                         r"training|course|courses|institute in|classes in|best|top \d*|certification|"
                         r"online|near me|fees|placement|\bin [A-Z]", re.I)


def name_from_title(title: str, domain: str) -> str:
    """'Best DevOps Training in Pune | XYZ Academy' -> 'XYZ Academy'; else from the domain."""
    for part in re.split(r"\s+[|\-–—:]\s+", title or ""):
        part = part.strip()
        if 2 <= len(part) <= 50 and not _NOT_A_NAME.search(part):
            return part
    return domain.split(".")[0].replace("-", " ").title()


# ---------------------------------------------------------------- GPU leads' own search list
GPU_TOPICS = ["AI startup", "machine learning startup", "computer vision startup", "generative AI startup",
              "deep learning company", "LLM startup", "VFX studio", "animation studio",
              "game development studio", "drone startup", "robotics startup", "AI drug discovery startup",
              "medical imaging AI startup", "video analytics company", "AR VR startup",
              "3D visualization studio", "architectural rendering studio", "autonomous vehicle startup"]
GPU_CITIES = ["Bengaluru", "Hyderabad", "Pune", "Chennai", "Mumbai", "Delhi", "Gurugram", "Noida", "Kolkata",
              "Ahmedabad", "Kochi", "Jaipur", "Chandigarh", "Coimbatore", "Thiruvananthapuram", "Indore"]
# startup databases, news, listings, freelancer and job sites, big tech: not the startups themselves
GPU_SKIP = {
    "tracxn.com", "crunchbase.com", "f6s.com", "wellfound.com", "angel.co", "yourstory.com", "inc42.com",
    "entrackr.com", "economictimes.indiatimes.com", "startupindia.gov.in", "ycombinator.com", "clutch.co",
    "goodfirms.co", "designrush.com", "upwork.com", "fiverr.com", "glassdoor.co.in", "glassdoor.com",
    "ambitionbox.com", "linkedin.com", "facebook.com", "instagram.com", "youtube.com", "x.com", "twitter.com",
    "medium.com", "wikipedia.org", "justdial.com", "sulekha.com", "indiamart.com", "naukri.com", "indeed.com",
    "foundit.in", "zaubacorp.com", "tofler.in", "google.com", "microsoft.com", "amazon.com", "amazon.in",
    "nvidia.com", "ibm.com", "accenture.com", "tcs.com", "infosys.com", "wipro.com", "seedtable.com",
    "startupblink.com", "topstartups.io", "builtin.com", "theorg.com", "cbinsights.com", "pitchbook.com",
    "owler.com", "zoominfo.com", "rocketreach.co", "apollo.io", "signalhire.com", "contactout.com",
    "techcrunch.com", "analyticsindiamag.com", "quora.com", "reddit.com", "github.com", "huggingface.co",
    "thehindu.com", "livemint.com", "business-standard.com", "moneycontrol.com", "vccircle.com",
    "techcircle.in", "the-ken.com", "ensun.io", "datalabs.in", "startuptalky.com", "indianstartupnews.com",
}


# Southeast Asian startup databases, news, job boards, listings and marketplaces (both profiles)
SEA_SKIP = {
    "e27.co", "techinasia.com", "vulcanpost.com", "dailysocial.id", "techsauce.co", "thestar.com.my",
    "straitstimes.com", "theedgemalaysia.com", "businesstimes.com.sg", "bangkokpost.com", "nst.com.my",
    "jobstreet.com", "jobstreet.com.my", "jobstreet.co.id", "jobsdb.com", "jobthai.com", "kalibrr.com",
    "mycareersfuture.gov.sg", "glints.com", "glassdoor.sg", "yellowpages.my", "sgpbusiness.com",
    "recordowl.com", "opengovsg.com", "ctoscredit.com.my", "mudah.my", "lazada.com.my", "lazada.sg",
    "lazada.co.th", "lazada.co.id", "shopee.com.my", "shopee.sg", "shopee.co.th", "shopee.co.id",
    "tokopedia.com", "grab.com", "agoda.com", "tripadvisor.com", "tripadvisor.com.sg", "sortlist.com",
    "skillsfuture.gov.sg", "myskillsfuture.gov.sg", "hrdcorp.gov.my", "coursera.org", "udemy.com",
}


def _lists(profile: str):
    """(cities, topics, skip) for a profile."""
    if profile == "training":
        return training.CITIES, training.TOPICS, training.SEARCH_SKIP | SEA_SKIP
    return GPU_CITIES, GPU_TOPICS, GPU_SKIP | SEA_SKIP


def target_cities(india_cities: List[str], countries=("India",)) -> List[str]:
    """Cities of the target countries, taking turns between countries (biggest city of each
    first), so a newly added country is searched from the next run on."""
    per = [india_cities if c == "India" else COUNTRIES[c]["cities"] for c in countries]
    return [c for row in itertools.zip_longest(*per) for c in row if c]


def queries(profile: str = "training", countries=("India",)) -> List[str]:
    """City by city: every topic in the biggest cities first."""
    cities, topics, _ = _lists(profile)
    return [f"{t} in {c}" for c, t in itertools.product(target_cities(cities, countries), topics)]


def query_country(q: str) -> str:
    """'AI startup in Kuala Lumpur' -> 'Malaysia'."""
    return city_country(q.rsplit(" in ", 1)[-1])


# Brave serves results by country only for some countries; the rest search everywhere
BRAVE_COUNTRIES = {"IN", "MY", "ID"}


SERPER_URL = "https://google.serper.dev/search"
TAVILY_URL = "https://api.tavily.com/search"


def providers(s: Settings):
    """[(name, key)] of the search APIs with a key, in order of use: Serper, Tavily, Brave."""
    return [(name, getattr(s, attr, "")) for name, attr in
            (("serper", "serper_api_key"), ("tavily", "tavily_api_key"), ("brave", "brave_api_key"))
            if getattr(s, attr, "")]


def provider(s: Settings):
    """(name, key) of the first search API with a key, or ('', '')."""
    found = providers(s)
    return found[0] if found else ("", "")


# Answers meaning "this provider cannot search now" (credit used up, rate limit, bad key):
# the next provider with a key takes over.
SWITCH = {400, 401, 402, 403, 429, 432, 433}


def run_query(name: str, key: str, fetcher: Fetcher, q: str):
    """(status, [{'url', 'title'}]) from one search, in the country of the query's city."""
    country = query_country(q)
    code = COUNTRIES[country]["code"]
    if name == "serper":
        status, data = fetcher.post_json(SERPER_URL, {"q": q, "gl": code.lower(), "num": 10},
                                         headers={"X-API-KEY": key, "Content-Type": "application/json"})
        rows = [{"url": r.get("link", ""), "title": r.get("title", "")} for r in (data or {}).get("organic", [])] \
            if isinstance(data, dict) else []
        return status, rows
    if name == "tavily":
        status, data = fetcher.post_json(TAVILY_URL, {"query": q, "max_results": 20, "search_depth": "basic",
                                                      "country": country.lower()},
                                         headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        rows = [{"url": r.get("url", ""), "title": r.get("title", "")} for r in (data or {}).get("results", [])] \
            if isinstance(data, dict) else []
        return status, rows
    status, data, _ = fetcher.get_json(
        BRAVE_URL, params={"q": q, "count": 20, "country": code if code in BRAVE_COUNTRIES else "ALL",
                            "search_lang": "en"},
        headers={"X-Subscription-Token": key, "Accept": "application/json"})
    rows = [{"url": r.get("url", ""), "title": r.get("title", "")}
            for r in ((data or {}).get("web") or {}).get("results") or []] if isinstance(data, dict) else []
    return status, rows


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    apis = providers(s)
    name, key = apis[0] if apis else ("", "")
    budget = getattr(s, "search_discovery_per_run", 0)
    if not key or budget <= 0:
        log.info("search: off (needs SERPER_API_KEY, TAVILY_API_KEY or BRAVE_API_KEY, "
                 "and SEARCH_DISCOVERY_PER_RUN > 0)")
        return []
    log.info("search: using %s, up to %d searches this run", name, budget)
    done = set(store.state["cursors"].get("search_done", []))
    seen = set(store.state["cursors"].get("search_seen", []))
    out: List[Candidate] = []
    used = 0
    profile = getattr(s, "profile", "training")
    skip = _lists(profile)[2]
    for q in queries(profile, getattr(s, "countries", ("India",))):
        if q in done:
            continue
        if used >= budget or len(out) >= limit:
            break
        status, rows = run_query(name, key, fetcher, q)
        time.sleep(PAUSE)
        while status in SWITCH and len(apis) > 1:  # e.g. Serper's free searches used up: Tavily next
            log.warning("search: %s cannot search now (HTTP %s); switching to %s", name, status, apis[1][0])
            apis = apis[1:]
            name, key = apis[0]
            status, rows = run_query(name, key, fetcher, q)
            time.sleep(PAUSE)
        if status in SWITCH:
            log.warning("search: %s limit or free credit used up (HTTP %s); the rest wait for the next run",
                        name, status)
            break
        if status != 200:
            log.warning("search %r failed: HTTP %s", q, status)
            continue
        used += 1
        done.add(q)
        new = 0
        for r in rows:
            d = extract_domain(r.get("url", ""))
            if not d or d in seen or d in skip or is_blocked(d):
                continue
            seen.add(d)
            new += 1
            out.append(Candidate(name=name_from_title(r.get("title", ""), d), domain=d, source="search", signal=f"Search: {q}",
                                 signal_url=r.get("url", ""), source_ref=f"search:{q}"))
            if len(out) >= limit:
                break
        log.info("search %r: %d new websites", q, new)
    store.state["cursors"]["search_done"] = sorted(done)
    store.state["cursors"]["search_seen"] = sorted(seen)
    return out
