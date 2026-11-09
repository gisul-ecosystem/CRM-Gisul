"""Discovery from GitHub organisations.

Two ways in:
  * topic search    -- orgs with recently active public repos on GPU-heavy topics
                       (each segment in segments.py lists its topics)
  * location search -- orgs whose profile says they are in India and whose name/description
    matches a segment. Org profiles are public even when every repo is private, so this finds
    companies that publish no code at all.
The org's creation year is used as (weak) age evidence: an org made in 2012 means the
company is not a young startup.
"""
import logging
import time
from datetime import date, timedelta
from typing import List, Optional

from ..config import Settings
from ..fetch import Fetcher
from ..geo import is_indian_domain, location_verdict
from ..segments import SEGMENTS, classify, enabled
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)

API = "https://api.github.com"
MAX_FOLLOWERS = 5000  # larger orgs are rarely startup leads
LOCATIONS = ["India", "Bengaluru", "Bangalore", "Mumbai", "Delhi", "Gurugram", "Noida",
             "Hyderabad", "Pune", "Chennai"]


SEGMENTS_BY_TOPIC = {t: name for name, seg in SEGMENTS.items() for t in seg.topics}


def topics() -> dict:
    """{topic: segment} for the enabled segments."""
    return {t: name for name in enabled() for t in SEGMENTS[name].topics}


def location_queries() -> List[str]:
    words = list(dict.fromkeys(w for name in enabled() for w in SEGMENTS[name].github))
    return [f"{w} in:name type:org location:{loc}" for loc in LOCATIONS for w in words]


def _headers(s: Settings) -> dict:
    h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if s.github_token:
        h["Authorization"] = f"Bearer {s.github_token}"
    return h


def _out_of_quota(headers) -> bool:
    try:
        return int(headers.get("X-RateLimit-Remaining", "1")) <= 0
    except ValueError:
        return False


def _normalise_url(blog: str) -> str:
    blog = (blog or "").strip()
    if not blog:
        return ""
    return blog if "://" in blog else "https://" + blog


def _india(org: dict, domain: str) -> str:
    v = location_verdict(org.get("location") or "")
    return "yes" if v == "yes" or is_indian_domain(domain) else v


def _created_year(org: dict) -> Optional[int]:
    y = (org.get("created_at") or "")[:4]
    return int(y) if y.isdigit() else None


def org_to_candidate(org: dict, repo: dict, topic: str):
    """Pure function (easy to test): org JSON + repo JSON -> Candidate or None."""
    if (org.get("followers") or 0) > MAX_FOLLOWERS:
        return None
    domain = extract_domain(_normalise_url(org.get("blog", "")))
    if is_blocked(domain):
        return None
    stars = repo.get("stargazers_count", 0)
    return Candidate(
        name=org.get("name") or org.get("login"),
        domain=domain,
        source="github",
        signal=f"Active GitHub org on topic:{topic} ({repo.get('full_name')}, {stars} stars)",
        signal_url=repo.get("html_url", ""),
        source_ref=f"gh:{org.get('login')}",
        india=_india(org, domain),
        segment=SEGMENTS_BY_TOPIC.get(topic, ""),
        founded=_created_year(org),
    )


def located_org_to_candidate(org: dict):
    """Org found by location search -> Candidate, if it looks Indian and matches a segment."""
    if (org.get("followers") or 0) > MAX_FOLLOWERS:
        return None
    desc = (org.get("description") or "").strip()
    segs = classify([org.get("name") or "", org.get("login") or "", desc])
    if not segs:
        return None
    domain = extract_domain(_normalise_url(org.get("blog", "")))
    if is_blocked(domain) or _india(org, domain) != "yes":
        return None
    return Candidate(
        name=org.get("name") or org.get("login"),
        domain=domain,
        source="github",
        signal=f"GitHub org in {org.get('location')}" + (f": {desc[:100]}" if desc else ""),
        signal_url=org.get("html_url") or f"https://github.com/{org.get('login')}",
        source_ref=f"gh:{org.get('login')}",
        india="yes",
        segment=segs,
        founded=_created_year(org),
    )


def _fetch_org(fetcher: Fetcher, hdrs: dict, login: str):
    """Returns (org_json_or_None, rate_limited)."""
    code, org, h = fetcher.get_json(f"{API}/orgs/{login}", headers=hdrs)
    if code == 200 and org:
        return org, False
    return None, code in (403, 429) or _out_of_quota(h)


def discover_by_location(s: Settings, fetcher: Fetcher, store: Store, seen: set, limit: int) -> List[Candidate]:
    """Rotates through the location queries (and their result pages) across runs."""
    queries = location_queries()
    if not queries:
        return []
    cur = store.state["cursors"]
    pages = cur.setdefault("github_loc_pages", {})
    start = int(cur.get("github_loc_idx", 0))
    hdrs = _headers(s)
    pause = 2.5 if s.github_token else 7.0
    per_run = 30 if s.github_token else 8  # search API: 30 req/min with a token, 10 without
    out: List[Candidate] = []
    for n in range(min(per_run, len(queries))):
        if len(out) >= limit:
            break
        qi = (start + n) % len(queries)
        q = queries[qi]
        page = int(pages.get(q, 1))
        code, data, rh = fetcher.get_json(
            f"{API}/search/users", headers=hdrs, params={"q": q, "per_page": 50, "page": page}
        )
        cur["github_loc_idx"] = (qi + 1) % len(queries)
        if code != 200 or not data:
            log.warning("github org search %r -> HTTP %s", q, code)
            if code in (403, 429) or _out_of_quota(rh):
                break
            continue
        items = data.get("items", [])
        # next run continues on the next page; wrap at the 1000-result search cap
        pages[q] = page + 1 if len(items) == 50 and page < 20 else 1
        for it in items:
            login = it.get("login", "")
            if not login or login in seen:
                continue
            seen.add(login)
            org, limited = _fetch_org(fetcher, hdrs, login)
            if limited:
                log.warning("github rate limit hit; stopping location search")
                return out
            cand = located_org_to_candidate(org) if org else None
            if cand:
                out.append(cand)
                if len(out) >= limit:
                    break
        time.sleep(pause)
    return out


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    seen = set(store.state["cursors"].get("github_orgs_seen", []))
    out: List[Candidate] = []
    if s.india_only:
        out = discover_by_location(s, fetcher, store, seen, limit)
    since = (date.today() - timedelta(days=30)).isoformat()
    pause = 2.5 if s.github_token else 7.0
    hdrs = _headers(s)

    for topic in topics():
        if len(out) >= limit:
            break
        q = f"topic:{topic} pushed:>{since} stars:5..5000"
        code, data, rh = fetcher.get_json(
            f"{API}/search/repositories",
            headers=hdrs,
            params={"q": q, "sort": "updated", "order": "desc", "per_page": 50},
        )
        if code != 200 or not data:
            log.warning("github search %s -> HTTP %s", topic, code)
            if code in (403, 429) or _out_of_quota(rh):
                log.warning("github rate limit hit; stopping github discovery")
                break
            continue
        for repo in data.get("items", []):
            owner = repo.get("owner", {})
            login = owner.get("login", "")
            if owner.get("type") != "Organization" or not login or login in seen:
                continue
            seen.add(login)
            org, limited = _fetch_org(fetcher, hdrs, login)
            if limited:
                log.warning("github rate limit hit; stopping")
                store.state["cursors"]["github_orgs_seen"] = sorted(seen)[-20000:]
                return out
            cand = org_to_candidate(org, repo, topic) if org else None
            if cand and not (s.india_only and cand.india == "no"):
                out.append(cand)
                if len(out) >= limit:
                    break
        time.sleep(pause)
    store.state["cursors"]["github_orgs_seen"] = sorted(seen)[-20000:]
    return out


def org_people(s: Settings, fetcher: Fetcher, login: str) -> list:
    """Public org members whose bio suggests a decision maker. Returns dicts."""
    from ..extract import find_title

    hdrs = _headers(s)
    code, members, rh = fetcher.get_json(
        f"{API}/orgs/{login}/public_members", headers=hdrs, params={"per_page": 30}
    )
    if code != 200 or not isinstance(members, list):
        return []
    people = []
    cap = 12 if s.github_token else 4
    for m in members[:cap]:
        ucode, u, uh = fetcher.get_json(f"{API}/users/{m.get('login')}", headers=hdrs)
        if ucode != 200 or not u:
            if ucode in (403, 429) or _out_of_quota(uh):
                break
            continue
        title = find_title(f"{u.get('bio') or ''} {u.get('company') or ''}")
        name = (u.get("name") or "").strip()
        if title and name and len(name.split()) >= 2:
            people.append(
                {
                    "name": name,
                    "title": title,
                    "email": (u.get("email") or "").strip(),
                    "source": f"github:{u.get('login')}",
                }
            )
    return people
