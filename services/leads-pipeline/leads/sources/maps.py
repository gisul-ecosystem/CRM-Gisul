"""Businesses listed on Google Maps, through Serper's Places search (SERPER_API_KEY).

Each profile has its own list ("<kind> in <city>"): GPU leads look for AI / ML / computer-vision
companies and startups, VFX, animation, game and rendering studios, drone and robotics firms;
training-lab leads for IT training institutes (same course topics as its web search). A listing
gives the business's website and phone; the website is then read and checked like any other
(India, GPU-type work / lab-heavy training, size), and the Maps phone is kept when the site shows
none. Listings without a website are skipped (the pipeline works from websites). Each query runs
once; MAPS_PER_RUN caps how many a run uses (1 Serper credit each). Never scrapes maps.google.com.
"""
import itertools
import logging
import time
from typing import List

from .. import training
from ..config import Settings
from ..fetch import Fetcher
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked
from ..geo import COUNTRIES
from .search import GPU_CITIES, GPU_SKIP, PAUSE, SEA_SKIP, query_country, target_cities

log = logging.getLogger(__name__)
PLACES_URL = "https://google.serper.dev/places"

GPU_MAPS_TOPICS = ["AI company", "AI startup", "machine learning company", "computer vision company",
                   "generative AI company", "data science company", "VFX studio", "animation studio",
                   "game development studio", "3D rendering studio", "architectural visualization studio",
                   "drone company", "robotics company"]


def queries(profile: str, countries=("India",)) -> List[str]:
    if profile == "training":
        cities, topics = training.CITIES, training.TOPICS
    else:
        cities, topics = GPU_CITIES, GPU_MAPS_TOPICS
    return [f"{t} in {c}" for c, t in itertools.product(target_cities(cities, countries), topics)]


def places(fetcher: Fetcher, key: str, q: str):
    """(status, [listing]) for one Maps query."""
    status, data = fetcher.post_json(PLACES_URL, {"q": q, "gl": COUNTRIES[query_country(q)]["code"].lower()},
                                     headers={"X-API-KEY": key, "Content-Type": "application/json"})
    rows = (data or {}).get("places", []) if isinstance(data, dict) else []
    return status, rows


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    key = getattr(s, "serper_api_key", "")
    budget = getattr(s, "maps_per_run", 0)
    if not key or budget <= 0:
        log.info("maps: off (needs SERPER_API_KEY and MAPS_PER_RUN > 0)")
        return []
    profile = getattr(s, "profile", "gpu")
    skip = (training.SEARCH_SKIP if profile == "training" else GPU_SKIP) | SEA_SKIP
    done = set(store.state["cursors"].get("maps_done", []))
    seen = set(store.state["cursors"].get("maps_seen", []))
    out: List[Candidate] = []
    used = 0
    for q in queries(profile, getattr(s, "countries", ("India",))):
        if q in done:
            continue
        if used >= budget or len(out) >= limit:
            break
        status, rows = places(fetcher, key, q)
        time.sleep(PAUSE)
        if status in (400, 401, 402, 403, 429):
            log.warning("maps: Serper cannot search now (HTTP %s); the rest wait for the next run", status)
            break
        if status != 200:
            log.warning("maps %r failed: HTTP %s", q, status)
            continue
        used += 1
        done.add(q)
        new = 0
        for p in rows:
            d = extract_domain(p.get("website") or "")
            if not d or d in seen or d in skip or is_blocked(d):
                continue
            seen.add(d)
            new += 1
            where = ", ".join(x for x in (p.get("category"), p.get("address")) if x)
            out.append(Candidate(name=(p.get("title") or d)[:80], domain=d, source="maps",
                                 signal=f"Google Maps: {q}" + (f" ({where})" if where else ""),
                                 signal_url=p.get("website", ""), source_ref=f"maps:{q}",
                                 phone=p.get("phoneNumber", "")))
            if len(out) >= limit:
                break
        log.info("maps %r: %d new businesses with a website", q, new)
    store.state["cursors"]["maps_done"] = sorted(done)
    store.state["cursors"]["maps_seen"] = sorted(seen)
    return out
