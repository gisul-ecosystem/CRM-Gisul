"""Discovery from the Y Combinator company directory: Indian, early-stage, in a segment.

Uses the community-maintained public mirror of the directory (yc-oss/api), which is
rebuilt daily from ycombinator.com/companies and served as plain JSON.
"""
import logging
from typing import List

from ..config import Settings
from ..fetch import Fetcher
from ..early import year_from_batch
from ..geo import location_verdict
from ..segments import classify
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)

ALL_COMPANIES = "https://yc-oss.github.io/api/companies/all.json"


def company_to_candidate(c: dict, india_only: bool = True, early_only: bool = True):
    """Pure function: one directory entry -> Candidate or None. Team size and batch year
    go on the candidate; the early-stage verdict itself is made by the discover stage."""
    if c.get("status") != "Active":  # skips Inactive, Acquired and Public (listed)
        return None
    if early_only and c.get("stage") == "Growth":
        return None
    india = "yes" if "India" in (c.get("regions") or []) else location_verdict(c.get("all_locations") or "")
    if india_only and india != "yes":
        return None
    tags = " ".join((c.get("tags") or []) + (c.get("industries") or []))
    segs = classify([tags, c.get("one_liner") or ""], c.get("long_description") or "")
    if not segs:
        return None
    domain = extract_domain(c.get("website") or "")
    if is_blocked(domain):
        return None
    one_liner = (c.get("one_liner") or "").strip()
    return Candidate(
        name=c.get("name") or domain,
        domain=domain,
        source="yc",
        signal=f"YC {c.get('batch')} ({c.get('team_size') or '?'} people): {one_liner}"[:200],
        signal_url=c.get("url") or "",
        source_ref=f"yc:{c.get('slug')}",
        india=india,
        segment=segs,
        founded=year_from_batch(c.get("batch") or ""),
        team_size=c.get("team_size") or None,
    )


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    code, data, _ = fetcher.get_json(ALL_COMPANIES, timeout=60)
    if code != 200 or not isinstance(data, list):
        log.warning("YC directory -> HTTP %s", code)
        return []
    seen = set(store.state["cursors"].get("yc_seen", []))
    out: List[Candidate] = []
    for c in data:
        slug = c.get("slug") or ""
        if not slug or slug in seen:
            continue
        cand = company_to_candidate(c, s.india_only, s.early_only)
        if cand:
            out.append(cand)
            seen.add(slug)  # only matches are remembered, so later runs pick up the rest
            if len(out) >= limit:
                break
    store.state["cursors"]["yc_seen"] = sorted(seen)
    return out
