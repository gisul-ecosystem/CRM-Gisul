"""Open job titles from the public job-board feeds startups link to (Lever, Greenhouse, Ashby).

These feeds are published by the job-board companies for exactly this use: listing a
company's openings on other sites. Hiring ML / infrastructure people is one of the clearest
signs a startup is about to spend on GPU compute.
"""
import logging
import re
from typing import List, Set, Tuple

log = logging.getLogger(__name__)

BOARD_RE = [
    ("lever", re.compile(r"jobs\.lever\.co/([A-Za-z0-9._-]+)", re.I)),
    ("greenhouse", re.compile(r"(?:boards|job-boards)\.greenhouse\.io/([A-Za-z0-9._-]+)", re.I)),
    ("ashby", re.compile(r"jobs\.ashbyhq\.com/([A-Za-z0-9._%-]+)", re.I)),
]
FEEDS = {
    "lever": "https://api.lever.co/v0/postings/{slug}?mode=json",
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{slug}",
}
CAREERS_RE = re.compile(r"career|jobs|join[- ]?us|hiring|work[- ]with[- ]us|openings|vacanc", re.I)


def boards_in_links(hrefs) -> Set[Tuple[str, str]]:
    """{('lever', 'acme'), ...} found among a page's link targets."""
    out = set()
    for h in hrefs:
        for kind, rx in BOARD_RE:
            m = rx.search(h or "")
            if m and m.group(1).lower() not in ("embed", "v1", "jobs"):
                out.add((kind, m.group(1)))
    return out


def titles_from_feed(kind: str, data) -> List[str]:
    if kind == "lever" and isinstance(data, list):
        return [p.get("text", "") for p in data if isinstance(p, dict)]
    if kind in ("greenhouse", "ashby") and isinstance(data, dict):
        return [j.get("title", "") for j in data.get("jobs", []) if isinstance(j, dict)]
    return []


def open_job_titles(fetcher, boards) -> List[str]:
    titles: List[str] = []
    for kind, slug in sorted(boards)[:3]:
        code, data, _ = fetcher.get_json(FEEDS[kind].format(slug=slug), timeout=20)
        if code == 200:
            titles += titles_from_feed(kind, data)
        else:
            log.debug("job feed %s/%s -> HTTP %s", kind, slug, code)
    return [t.strip() for t in titles if t and t.strip()]
