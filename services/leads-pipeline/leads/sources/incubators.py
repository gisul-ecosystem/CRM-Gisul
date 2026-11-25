"""Discovery from Indian incubator portfolio pages (list in leads/incubators.csv).

Startups from Indian incubators get far fewer free cloud/GPU credits than YC companies, so
they are more likely to pay for vGPUs. Each portfolio page is fetched politely (robots.txt
honoured) and every outbound link to another website is taken as a startup. The page does not
say what a startup does, so the segment is set later from its own website; with
REQUIRE_SEGMENT=1 startups whose site shows no GPU-related segment are dropped there.

The order of the list does not matter: every startup remembers its incubator, each incubator's
yield (startups that turned out to be GPU-type leads) is measured from the sheet, and each run
serves the best incubators first. New incubators get a fair first try; ones that give nothing
after PAUSE_AFTER checked startups are paused (and come back if their numbers improve).
"""
import csv
import logging
from pathlib import Path
from typing import Dict, List

from bs4 import BeautifulSoup

from ..config import Settings
from ..fetch import Fetcher
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)

LIST_FILE = Path(__file__).resolve().parent.parent / "incubators.csv"
# Links on portfolio pages that are never startups (app stores, maps, link hubs, site builders)
SKIP = {"wa.me", "whatsapp.com", "play.google.com", "apps.apple.com", "goo.gl", "maps.app.goo.gl",
        "wix.com", "wordpress.org", "elementor.com", "squarespace.com", "webflow.io",
        "website-files.com", "zohoexternal.com", "jotform.com", "typeform.com", "mailchimp.com",
        "spotify.com", "issuu.com", "slideshare.net", "scribd.com", "startupindia.gov.in"}


def read_list(path: Path = LIST_FILE) -> List[dict]:
    lines = [ln for ln in path.read_text(encoding="utf-8").splitlines()
             if ln.strip() and not ln.lstrip().startswith("#")]
    return [{k.strip(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(lines)]


PAUSE_AFTER = 40  # checked startups with no good lead before an incubator is paused


def yields(df, state: dict, source: str = "incubator") -> Dict[str, dict]:
    """Per listed page, from the sheet and state: listed (organisations taken from it), checked
    (website read: kept or rejected), kept (in the sheet after the filters), good (high/medium
    intent), ready (rows ready to contact), score and status. `source` picks the list:
    'incubator' (incubators.csv) or 'directory' (training_directories.csv)."""
    key, ref_prefix = ("incubator_of", "inc:") if source == "incubator" else (f"{source}_of", f"{source}:")
    origin = dict(state.get(key, {}))
    if len(df):  # organisations found before origins were recorded
        for ref, dom in zip(df["source_ref"], df["domain"]):
            if ref.startswith(ref_prefix):
                origin.setdefault(dom, ref[len(ref_prefix):])
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
        # good leads per checked startup, smoothed so an untested incubator starts with a fair score
        y["score"] = round((y["good"] + 0.5 * y["kept"] + 1) / (y["checked"] + 4), 3)
        y["status"] = ("paused" if y["checked"] >= PAUSE_AFTER and y["good"] == 0 and y["ready"] == 0
                       else "learning" if y["checked"] < 10 else "active")
    return out


def ranked(incubators: List[dict], measured: Dict[str, dict]) -> List[dict]:
    """Best measured yield first; never-tried incubators get the fair default score (0.25)."""
    def score(inc):
        return measured.get(inc["incubator"], {}).get("score", 0.25)
    return sorted(incubators, key=score, reverse=True)


def startups_on_page(html: str, page_url: str) -> List[tuple]:
    """[(name, domain)] for outbound links on a portfolio page, in page order, deduplicated."""
    own = extract_domain(page_url)
    soup = BeautifulSoup(html, "lxml")
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href.startswith(("http://", "https://")):
            continue
        d = extract_domain(href)
        if not d or d == own or d in seen or d in SKIP or is_blocked(d):
            continue
        seen.add(d)
        img = a.find("img")
        name = (a.get_text(" ", strip=True) or (img.get("alt", "").strip() if img else "")).strip(" ↗→›»")
        looks_like_url = "://" in name or name.lower().startswith("www.") or extract_domain(name) == d
        if not name or looks_like_url or len(name) > 60 or name.lower() in (
                "website", "visit", "visit website", "know more", "read more", "learn more", "link"):
            name = d.split(".")[0].replace("-", " ").title()
        out.append((name, d))
    return out


MAX_FOLLOW = 150  # startup pages read per list per run


def _followed(fetcher: Fetcher, html, inc: dict, store: Store) -> List[tuple]:
    """Lists that give each startup its own page on the list's site (e.g. /portfolio/agnikul):
    read those pages (path starting with the `follow` column) and take each startup's website.
    Startup pages already read are remembered, so later runs only read new ones."""
    from urllib.parse import urljoin, urlparse
    if not html:
        return []
    own = extract_domain(inc["url"])
    done = store.state["cursors"].setdefault("follow_done", {}).setdefault(inc["incubator"], [])
    done_set = set(done)
    pages = []
    for a in BeautifulSoup(html, "lxml").find_all("a", href=True):
        url = urljoin(inc["url"], a["href"]).split("#")[0].rstrip("/")
        path = urlparse(url).path
        if (extract_domain(url) == own and path.startswith(inc["follow"].rstrip("/") + "/")
                and url != inc["url"].rstrip("/") and url not in done_set and url not in pages):
            pages.append(url)
    found = []
    for url in pages[:MAX_FOLLOW]:
        sub = fetcher.get_html(url)
        done.append(url)
        for name, domain in (startups_on_page(sub, url) if sub else []):
            if domain not in SKIP:  # the first outside link on a startup's page is its website
                found.append((name, domain))
                break
    return found


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int, list_file: Path = LIST_FILE,
             source: str = "incubator", india: str = "yes", signal: str = "Incubated at {name}",
             skip: frozenset = frozenset()) -> List[Candidate]:
    """Startups (or any organisations) linked from the pages in `list_file`. The defaults are for
    Indian incubators; sources/directories.py reuses this for training-partner directories."""
    cursor, ref = ("incubator_seen", "inc:") if source == "incubator" else (f"{source}_seen", f"{source}:")
    seen = set(store.state["cursors"].get(cursor, []))
    origin = store.state.setdefault("incubator_of" if source == "incubator" else f"{source}_of", {})
    measured = yields(store.df, store.state, source)
    out: List[Candidate] = []
    for inc in ranked(read_list(list_file), measured):
        if len(out) >= limit:
            break
        y = measured.get(inc["incubator"], {})
        if y.get("status") == "paused":
            log.info("incubator %s paused: %d startups checked, none a good lead", inc["incubator"], y["checked"])
            continue
        html = fetcher.get_html(inc["url"])
        if inc.get("follow"):  # one page per startup on the list's own site (VC portfolios)
            found = _followed(fetcher, html, inc, store)
        else:
            found = startups_on_page(html, inc["url"]) if html else []
        if len(found) < 5 and not inc.get("follow") and hasattr(fetcher, "render"):
            # list built by JavaScript: render it and keep clicking "Load more"
            rendered = fetcher.render(inc["url"], expand=True)
            if rendered:
                found = max(found, startups_on_page(rendered, inc["url"]), key=len)
        if not found:
            log.warning("incubator page gave no startups: %s", inc["url"])
            continue
        log.info("incubator %s: %d links", inc["incubator"], len(found))
        found = [(n, d) for n, d in found if d not in skip]
        for name, domain in found:
            origin.setdefault(domain, inc["incubator"])  # also fills in startups seen before origins were kept
            if domain in seen:
                continue
            seen.add(domain)  # remembered so later runs move on to the rest of the list
            origin[domain] = inc["incubator"]
            out.append(Candidate(
                name=name,
                domain=domain,
                source=source,
                signal=signal.format(name=inc["incubator"]),
                signal_url=inc["url"],
                source_ref=f"{ref}{inc['incubator']}",
                india="" if inc.get("india") == "check" else (inc.get("india") or india),  # check = site decides
            ))
            if len(out) >= limit:
                break
    store.state["cursors"][cursor] = sorted(seen)
    return out
