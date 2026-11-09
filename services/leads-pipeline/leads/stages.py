"""The four pipeline stages + scoring. Each stage is resumable via the `status` column.

discovered --scrape--> people_found | scraped | no_contact
people_found/scraped --emails--> email_found | no_contact
email_found --verify--> verified | no_contact
"""
import logging
import re
import time
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, as_completed, wait
from typing import Iterable, Optional
from urllib.parse import urljoin

from . import emails as em
from .config import Settings
from .extract import DEFAULT_PATHS, parse_page, title_priority
from .fetch import Fetcher
from .domain_age import DomainAge
from .early import site_evidence, verdict as early_verdict
from .geo import country_verdict, phone_region
from .intent import evaluate as evaluate_intent
from .jobs import CAREERS_RE, boards_in_links, open_job_titles
from .people_search import find_people
from .render import looks_empty
from .segments import classify
from .score import is_ready, score_row
from . import profile as _profile
from .segments import qualifies
from . import training as _training
from .sources import competitors, directories, funding, github, hackernews, huggingface, incubators, maps, search, seeds, yc
from .store import (DISCOVERED, EMAIL_FOUND, NO_CONTACT, PEOPLE_FOUND, SCRAPED, VERIFIED,
                    Store)
from .util import ESTABLISHED, TimeLimit, extract_domain, is_blocked, person_key, time_limit
from .verify import Verifier

log = logging.getLogger(__name__)

GPU_SOURCES = {"seeds": seeds, "incubators": incubators, "search": search, "maps": maps, "yc": yc,
               "funding": funding, "github": github, "huggingface": huggingface, "hn": hackernews}
# Training profile: only its own lists - seeds_training/, training_directories.csv - plus
# edtech / skilling news and GitHub academies (same engine, training rules in training.py).
# It never reads the GPU profile's lists (seeds/, incubators.csv).
TRAINING_SOURCES = {"seeds": seeds, "directories": directories, "search": search, "maps": maps,
                    "funding": funding, "github": github}
# Competitors profile: cloud & compute provider testimonials/case studies (leads/competitors.csv)
COMPETITORS_SOURCES = {"competitors": competitors, "seeds": seeds, "search": search}

if _profile.current() == _profile.TRAINING:
    SOURCES = TRAINING_SOURCES
elif _profile.current() == _profile.COMPETITORS:
    SOURCES = COMPETITORS_SOURCES
else:
    SOURCES = GPU_SOURCES
MAX_PAGES_PER_SITE = 6
MAX_PEOPLE_PER_COMPANY = 3


def max_people(s: Settings) -> int:
    return getattr(s, "max_people", MAX_PEOPLE_PER_COMPANY) or MAX_PEOPLE_PER_COMPANY


def refresh_early(s: Settings, store: Store, domain: str) -> str:
    """Recompute the `early` column from the row's evidence; drop the company if it is
    clearly not early-stage and EARLY_ONLY is on."""
    rows = store.domain_indices(domain)
    if not rows:
        return ""
    r = store.df.loc[rows[0]]
    # e.g. VFX / game studios rent GPUs at any age: their age is not held against them, but a
    # large team or big funding still is
    exempt = set(getattr(s, "early_exempt", ())) & set((r["segment"] or "").split(", "))
    v = early_verdict(None if exempt else int(r["founded"] or 0) or None, r["stage"],
                      int(r["team_size"] or 0) or None, s.max_age_years, s.max_team_size)
    for j in rows:
        store.df.at[j, "early"] = v
    if v == "no" and s.early_only:
        store.reject(domain, "not-early")
        store.drop_domain(domain)
    return v


RECHECK_AGES_PER_RUN = 300  # domain registration years looked up for companies already in the sheet


def _domain_ages(s: Settings, store: Store):
    """DomainAge when the profile uses domain registration years (DOMAIN_AGE=1), else None."""
    return DomainAge(store.state, s.user_agent) if s.early_only and getattr(s, "domain_age", False) else None


def _add_domain_year(ages, store: Store, domain: str) -> None:
    """The domain's registration year as founding evidence (the earliest year known wins)."""
    year = ages.year(domain) if ages else None
    if year:
        store.merge_evidence(domain, founded=year)


def recheck_sheet(s: Settings, store: Store) -> dict:
    """Companies already in the sheet, checked again against today's rules (blocklist.txt and the
    early-stage limits and established.txt change): those that no longer fit leave the sheet.
    Companies with no founding year get their domain's registration year (a few hundred a run)."""
    counts = {"blocked": 0, "not_early": 0}
    ages, asked = _domain_ages(s, store), 0
    for domain in list(dict.fromkeys(store.df["domain"])):
        if (ages and asked < RECHECK_AGES_PER_RUN and domain not in ages.cache
                and not store.df.loc[store.domain_indices(domain)[0], "founded"]):
            _add_domain_year(ages, store, domain)
            asked += 1
        if is_blocked(domain):
            store.reject(domain, "blocked")
            store.drop_domain(domain)
            counts["blocked"] += 1
        elif s.early_only and domain in ESTABLISHED:
            store.reject(domain, "not-early")
            store.drop_domain(domain)
            counts["not_early"] += 1
        elif refresh_early(s, store, domain) == "no" and s.early_only:
            counts["not_early"] += 1
    if any(counts.values()):
        log.info("recheck: removed %d blocked and %d no longer early-stage companies from the sheet",
                 counts["blocked"], counts["not_early"])
    return counts


# ------------------------------------------------------------------ 1. discover
# Run only when asked for with --sources: YC companies get large free cloud/GPU credits from
# YC's partners, so they are poor vGPU prospects.
OFF_BY_DEFAULT = {"yc"}


def discover_stage(s: Settings, store: Store, fetcher: Fetcher, only: Optional[Iterable[str]] = None) -> dict:
    counts = {}
    ages = _domain_ages(s, store)
    for name, mod in SOURCES.items():
        if (only and name not in only) or (not only and name in OFF_BY_DEFAULT):
            continue
        new = merged = not_early = 0
        try:
            cands = mod.discover(s, fetcher, store, s.batch_size)
        except Exception:
            log.exception("discovery source %s crashed; continuing", name)
            cands = []
        for c in cands:
            if is_blocked(c.domain) or (s.early_only and c.domain in ESTABLISHED) or (s.india_only and c.india == "no" and tuple(getattr(s, "countries", ("India",))) == ("India",)):
                continue
            r = store.add_candidate(c)
            if r == "new":  # how old the company is, before its site is read
                _add_domain_year(ages, store, c.domain)
            if r != "skipped" and refresh_early(s, store, c.domain) == "no" and s.early_only:
                not_early += 1
                continue
            new += r == "new"
            merged += r == "merged"
        counts[name] = {"found": len(cands), "new": new, "merged": merged, "not_early": not_early}
        log.info("discover[%s]: found=%d new=%d merged=%d not_early=%d",
                 name, len(cands), new, merged, not_early)
    return counts


# ------------------------------------------------------------------ 2. scrape
def _from_seed_list(source: str) -> bool:
    """Hand-picked companies (leads/seeds/*.csv) are kept even when no segment is detected."""
    stems = {p.stem for p in seeds.SEED_DIR.glob("*.csv")}
    return any(x in stems for x in source.split(", "))


MAX_RENDERS_PER_SITE = 3  # headless-browser page loads per company (they take ~5 s each)


def _get(fetcher: Fetcher, url: str, budget: list) -> Optional[str]:
    """Plain fetch; if the page is a JavaScript shell, render it instead (while budget lasts)."""
    html = fetcher.get_html(url)
    if budget[0] > 0 and hasattr(fetcher, "render") and looks_empty(html):
        budget[0] -= 1
        html = fetcher.render(url) or html
    return html


def _add_careers_page(s: Settings, fetcher: Fetcher, own: str, parsed: list, visited: set, budget: list) -> None:
    """Read one careers/jobs page on the company's own site (open roles = buying signal)."""
    for p in parsed:
        for url in p["hrefs"]:
            if url in visited or not CAREERS_RE.search(url) or extract_domain(url) != own:
                continue
            visited.add(url)
            h = _get(fetcher, url, budget)
            if h:
                parsed.append(parse_page(h, url, phone_region(url, s.default_region)))
            return


_GH_ORG = re.compile(r"^https?://(?:www\.)?github\.com/([A-Za-z0-9][A-Za-z0-9-]{0,38})/?$")
_GH_NOT_ORG = {"about", "features", "pricing", "login", "join", "topics", "sponsors", "orgs", "apps", "marketplace"}


def _github_org(parsed) -> str:
    """The GitHub account a company's own site links to most (footer 'GitHub' icon)."""
    hits = Counter()
    for p in parsed:
        for h in p.get("hrefs", []):
            m = _GH_ORG.match(h.strip())
            if m and m.group(1).lower() not in _GH_NOT_ORG:
                hits[m.group(1)] += 1
    return hits.most_common(1)[0][0] if hits else ""


def _job_titles(fetcher: Fetcher, parsed: list) -> list:
    boards = boards_in_links(h for p in parsed for h in p["hrefs"])
    return open_job_titles(fetcher, boards) if boards and hasattr(fetcher, "get_json") else []


def _score_intent(store: Store, domain: str, parsed: list, titles: list) -> None:
    """Renting-intent columns from page text and open ML/infra jobs (see intent.py)."""
    score, label, why = evaluate_intent([p["text"] for p in parsed], titles)
    for j in store.domain_indices(domain):
        store.set(j, intent=label, intent_score=score, intent_signals="; ".join(why))


def _fetch_home(fetcher: Fetcher, domain: str, budget: list):
    for url in (f"https://{domain}/", f"https://www.{domain}/", f"http://{domain}/"):
        html = _get(fetcher, url, budget)
        if html:
            return html, url
    return None, None


PRECHECK_PAGES = 3  # pages read before deciding whether the rest of the site is worth reading
_PAGE_ORDER = re.compile(r"about|company|who-we-are|contact|team|leadership|people|founder", re.I)


def _site_info(store: Store, domain: str) -> dict:
    """What a worker needs to know about a company (workers never touch the sheet)."""
    i = store.domain_indices(domain)[0]
    r = store.df.loc[i]
    return {"domain": domain, "india": r["india"], "has_segment": bool(r["segment"]),
            "source": r["source"], "ref": r["source_ref"]}


def _region(s: Settings, domain: str, phones, signals):
    """(country, in a target country). Training: a mentioned city is not enough (foreign firms with
    an India page passed) - it needs the country's domain ending, phone code or company registration."""
    if getattr(s, "profile", "gpu") == "training":
        signals = [x for x in signals if not x.endswith("place")]
    return country_verdict(domain, phones, signals, getattr(s, "countries", ("India",)))


def _pre_marked_out(s: Settings, india: str) -> bool:
    """A source said the company is Indian (india=yes), but India is not a target country."""
    return india == "yes" and "India" not in getattr(s, "countries", ("India",))


def _india_and_segment(s: Settings, info: dict, parsed: list) -> str:
    """'not_india' / 'no_segment' / '' from the pages read so far (same rules as _apply_site)."""
    phones = [ph for p in parsed for ph in p.get("dialled", p["phones"])]
    signals = [x for p in parsed for x in p["india"]]
    if s.india_only and info["india"] != "global" and (
            _pre_marked_out(s, info["india"]) if info["india"] == "yes"
            else not _region(s, info["domain"], phones, signals)[1]):
        return "not_india"
    if (s.require_segment and not info["has_segment"] and not _from_seed_list(info["source"])
            and not classify(long_text=" ".join(p["text"] for p in parsed[:PRECHECK_PAGES]))):
        return "no_segment"
    if getattr(s, "small_only", False) and _training.size_verdict(" ".join(p["text"] for p in parsed)):
        return "too_large"
    return ""


def _fetch_site(s: Settings, fetcher: Fetcher, info: dict) -> dict:
    """The slow, network-only part of reading a company (runs in a worker thread). About,
    contact and team pages are read first; after PRECHECK_PAGES pages a company that is
    clearly not Indian or not GPU-type work is not read any further."""
    domain = info["domain"]
    budget = [MAX_RENDERS_PER_SITE]
    html, base = _fetch_home(fetcher, domain, budget)
    if not html:
        return {"status": "unreachable"}
    parsed = [parse_page(html, base, phone_region(base, s.default_region))]
    visited = {base}
    links = list(parsed[0]["links"]) + [urljoin(base, p) for p in DEFAULT_PATHS]
    links = sorted(dict.fromkeys(links), key=lambda u: 0 if _PAGE_ORDER.search(u) else 1)

    def read(upto: int) -> None:
        for url in links:
            if len(visited) >= upto:
                return
            if url in visited:
                continue
            visited.add(url)
            h = _get(fetcher, url, budget)
            if h:
                parsed.append(parse_page(h, url, phone_region(url, s.default_region)))

    read(PRECHECK_PAGES)
    early_out = _india_and_segment(s, info, parsed)
    if early_out:
        return {"status": early_out, "parsed": parsed}
    read(MAX_PAGES_PER_SITE)
    _add_careers_page(s, fetcher, domain, parsed, visited, budget)
    org = info["ref"][3:] if info["ref"].startswith("gh:") else _github_org(parsed)
    return {"status": "ok", "parsed": parsed, "titles": _job_titles(fetcher, parsed),
            "github": github.org_people(s, fetcher, org) if org else []}


def _scrape_domain(s: Settings, store: Store, fetcher: Fetcher, i: int) -> str:
    """Read one company and update the sheet (one worker: fetch, then apply)."""
    domain = store.df.at[i, "domain"]
    return _apply_site(s, store, domain, _fetch_site(s, fetcher, _site_info(store, domain)))


def _apply_site(s: Settings, store: Store, domain: str, packet: dict) -> str:
    """The quick part: checks and sheet updates from a fetched site (coordinator thread only)."""
    rows = store.domain_indices(domain)
    if not rows:
        return "rejected"
    i = rows[0]
    status = packet["status"]
    if status == "unreachable":
        n = store.bump_attempts(domain)
        if n >= s.max_attempts:
            store.reject(domain, "unreachable")
            store.drop_domain(domain)
            return "rejected"
        return "retry"
    if status in ("not_india", "no_segment", "too_large"):
        store.reject(domain, {"not_india": "not-india", "no_segment": "no-segment", "too_large": "too-large"}[status])
        store.drop_domain(domain)
        return status
    parsed = packet["parsed"]

    emails, phones, people, india_signals, company_li = {}, [], {}, [], Counter()
    dialled = []  # phones that show their country: country evidence
    for p in parsed:
        company_li.update(p["company_linkedin"])
        for e, how in p["emails"]:
            emails.setdefault(e, how)
        for ph in p["phones"]:
            if ph not in phones:
                phones.append(ph)
        dialled += p.get("dialled", p["phones"])
        for person in p["people"]:
            key = person_key(person["name"])
            if key not in people or title_priority(person["title"]) < title_priority(people[key]["title"]):
                people[key] = person
        india_signals += p["india"]

    india = store.df.at[i, "india"]
    if india == "yes":
        country, keep = "India", not _pre_marked_out(s, india)
    else:
        country, keep = _region(s, domain, dialled, india_signals)
    if not keep and s.india_only and india != "global":  # global lists: kept wherever they are
        store.reject(domain, "not-india")
        store.drop_domain(domain)
        return "not_india"
    if india != "yes":
        india = "yes" if country == "India" else "global" if india == "global" else "no"
    for j in store.domain_indices(domain):
        store.set(j, india=india, country=country)

    years = [p["founded"] for p in parsed if p["founded"]]
    # Fill the segment from the site only when no source said what the company does.
    site_segments = [] if store.df.at[i, "segment"] else classify(
        long_text=" ".join(p["text"] for p in parsed[:3]))
    stage, team = site_evidence(" ".join(p["text"] for p in parsed))  # funding / team size on the site
    store.merge_evidence(domain, segment=site_segments, founded=min(years) if years else None,
                         stage=stage, team_size=team)
    if refresh_early(s, store, domain) == "no" and s.early_only:
        return "not_early"
    if s.require_segment and not store.df.at[i, "segment"] and not _from_seed_list(store.df.at[i, "source"]):
        store.reject(domain, "no-segment")  # nothing on the site says it needs GPUs
        store.drop_domain(domain)
        return "no_segment"
    if not qualifies(" ".join(p["text"] for p in parsed)):  # training: must teach lab-heavy subjects
        store.reject(domain, "no-lab-courses")
        store.drop_domain(domain)
        return "no_segment"
    big = _training.size_verdict(" ".join(p["text"] for p in parsed)) if getattr(s, "small_only", False) else ""
    if big:  # training: small and medium organisations only
        log.debug("%s dropped, %s", domain, big)
        store.reject(domain, f"too-large ({big[7:60]})")
        store.drop_domain(domain)
        return "too_large"
    _score_intent(store, domain, parsed, packet.get("titles", []))
    if company_li:  # the page linked most often wins (footer links repeat on every page)
        for j in store.domain_indices(domain):
            store.set(j, company_linkedin=company_li.most_common(1)[0][0])

    for gp in packet.get("github", []):  # public members of the company's GitHub org
        key = person_key(gp["name"])
        if key not in people:
            people[key] = {"name": gp["name"], "title": gp["title"], "linkedin": "",
                           "how": gp["source"], "email": gp.get("email", "")}

    chosen = sorted(people.values(), key=lambda p: title_priority(p["title"]))[:max_people(s)]
    store.state.setdefault("work", {})[domain] = {"emails": [[e, h] for e, h in emails.items()]}
    store.state["attempts"].pop(domain, None)
    phone = phones[0] if phones else store.df.at[i, "phone"]  # keep a phone from the source (Maps)

    if chosen:
        for k, p in enumerate(chosen):
            fields = dict(full_name=p["name"], title=p["title"], linkedin_url=p.get("linkedin", ""),
                          phone=phone, status=PEOPLE_FOUND)
            if p.get("email"):
                fields.update(email=p["email"], email_source="github", email_type="personal")
            if k == 0:
                store.set(i, **fields)
            else:
                store.clone_row(i, **fields)
        return "people"
    if emails:
        store.set(i, phone=phone, status=SCRAPED)
        return "company_only"
    store.set(i, phone=phone, status=NO_CONTACT)
    return "nothing"


def scrape_stage(s: Settings, store: Store, fetcher: Fetcher, attempted: Optional[set] = None,
                 progress: str = "") -> dict:
    """Read up to batch_size waiting companies. `attempted` (kept across the rounds of one run)
    stops a site that failed this run being tried again in the next round."""
    counts = {"people": 0, "company_only": 0, "nothing": 0, "not_india": 0, "not_early": 0,
              "no_segment": 0, "too_large": 0, "retry": 0,
              "rejected": 0, "error": 0}
    attempted = attempted if attempted is not None else set()
    waiting = [store.df.at[i, "domain"] for i in store.indices_with_status([DISCOVERED])]
    domains = list(dict.fromkeys(d for d in waiting if d not in attempted))[: s.batch_size]
    attempted.update(domains)
    if getattr(s, "workers", 1) > 1 and len(domains) > 1:
        _scrape_parallel(s, store, fetcher, domains, counts, progress)
        log.info("scrape: %s", counts)
        return counts
    for n, d in enumerate(domains, 1):
        rows = store.domain_indices(d)
        if not rows:
            continue
        started = time.time()
        try:
            with time_limit(SITE_TIME_LIMIT):
                result = _scrape_domain(s, store, fetcher, rows[0])
        except TimeLimit:  # a site that hangs must not stop the whole run
            log.warning("scrape: %s took over %ds; skipped, will retry next run", d, SITE_TIME_LIMIT)
            result = "retry"
            fetcher.reset_renderer()
            if store.bump_attempts(d) >= s.max_attempts:
                store.reject(d, "too-slow")
                store.drop_domain(d)
        except Exception:
            log.exception("scrape crashed on %s; will retry next run", d)
            result = "error"
            if store.bump_attempts(d) >= s.max_attempts:
                store.reject(d, "scrape-error")
                store.drop_domain(d)
        counts[result] += 1
        log.info("scrape [%s%d/%d] %s: %s%s (%.0fs)", progress, n, len(domains), d, result,
                 _row_summary(store, d), time.time() - started)
        if n % SAVE_EVERY == 0:
            _checkpoint(s, store)
    log.info("scrape: %s", counts)
    return counts


def _scrape_parallel(s: Settings, store: Store, fetcher: Fetcher, domains: list, counts: dict,
                     progress: str) -> None:
    """WORKERS threads fetch different companies at once; this (main) thread applies each
    result to the sheet as it arrives, so the sheet is only ever written by one thread. A
    company that takes longer than SITE_TIME_LIMIT is abandoned (retried next run) and, if
    workers get stuck, a fresh set of threads takes over."""
    total, done_n = len(domains), 0
    todo = iter(domains)
    pool = ThreadPoolExecutor(max_workers=s.workers, thread_name_prefix="site")
    pending: dict = {}
    stuck_in_pool = 0

    def submit_next() -> None:
        for d in todo:
            if store.domain_indices(d):
                pending[pool.submit(_fetch_site, s, fetcher, _site_info(store, d))] = (d, time.time())
                return

    def finish(d: str, result: str, started: float) -> None:
        nonlocal done_n
        done_n += 1
        counts[result] += 1
        log.info("scrape [%s%d/%d] %s: %s%s (%.0fs)", progress, done_n, total, d, result,
                 _row_summary(store, d), time.time() - started)
        if done_n % SAVE_EVERY == 0:
            _checkpoint(s, store)

    def failed(d: str, reason: str) -> str:
        if store.bump_attempts(d) >= s.max_attempts:
            store.reject(d, reason)
            store.drop_domain(d)
        return "retry" if reason == "too-slow" else "error"

    try:
        for _ in range(s.workers):
            submit_next()
        while pending:
            done, _ = wait(list(pending), timeout=5, return_when=FIRST_COMPLETED)
            for fut in done:
                d, started = pending.pop(fut)
                try:
                    result = _apply_site(s, store, d, fut.result())
                except Exception:
                    log.exception("scrape crashed on %s; will retry next run", d)
                    result = failed(d, "scrape-error")
                finish(d, result, started)
                submit_next()
            now = time.time()
            for fut, (d, started) in list(pending.items()):
                if now - started > SITE_TIME_LIMIT:
                    pending.pop(fut)
                    fut.cancel()
                    log.warning("scrape: %s took over %ds; skipped, will retry next run", d, SITE_TIME_LIMIT)
                    finish(d, failed(d, "too-slow"), started)
                    stuck_in_pool += 1
                    if stuck_in_pool >= max(1, s.workers // 2):  # too many frozen threads: new pool
                        old, pool, stuck_in_pool = pool, ThreadPoolExecutor(
                            max_workers=s.workers, thread_name_prefix="site"), 0
                        old.shutdown(wait=False)
                    submit_next()
    finally:
        pool.shutdown(wait=False)


SAVE_EVERY = 10  # companies between checkpoint saves during the slow stages
SITE_TIME_LIMIT = 180  # seconds one company may take in the scrape stage


def _row_summary(store: Store, domain: str) -> str:
    """' | 2 people, ai, early=yes' for the progress log ('' when the company was dropped)."""
    rows = store.domain_indices(domain)
    if not rows:
        return ""
    names = sum(1 for j in rows if store.df.at[j, "full_name"])
    r = store.df.loc[rows[0]]
    return f" | {names} people, {r['segment'] or 'no segment'}, early={r['early'] or '?'}"


def _checkpoint(s: Settings, store: Store) -> None:
    """Score and save mid-stage, so a long run shows results in the sheet as it goes."""
    score_stage(s, store)
    store.save()


# ------------------------------------------------------------------ 2b. people search
def people_stage(s: Settings, store: Store, fetcher: Fetcher) -> dict:
    """Companies whose website named nobody: look the decision makers up in public search results
    (people_search.py). Each company is searched once; best-scoring companies go first."""
    counts = {"searched": 0, "found": 0, "people": 0}
    if not s.brave_api_key:
        log.info("people search: off (set BRAVE_API_KEY to look up decision makers)")
        return counts
    done = store.state.setdefault("people_search", {})  # domain -> date searched
    df = store.df
    named = set(df.loc[df["full_name"] != "", "domain"])
    waiting = df[~df["status"].isin([DISCOVERED]) & ~df["domain"].isin(named)
                 & ~df["domain"].isin(list(done))]
    order = (waiting.assign(_s=waiting["score"].replace("", "0").astype(int))
             .sort_values("_s", ascending=False)["domain"].drop_duplicates().tolist())
    for n, domain in enumerate(order[: s.search_max_per_run], 1):
        rows = store.domain_indices(domain)
        if not rows:
            continue
        company = store.df.at[rows[0], "company"]
        people, status = find_people(s.brave_api_key, fetcher, company, domain, max_people(s))
        if status == "rate_limited":
            log.warning("people search: search API limit reached; the rest wait for the next run")
            break
        if status != "ok":
            continue
        done[domain] = time.strftime("%Y-%m-%d")
        counts["searched"] += 1
        if people:
            counts["found"] += 1
            counts["people"] += len(people)
            # an unworked company row takes the first person; otherwise add new rows
            base = next((j for j in rows if store.df.at[j, "status"] in (SCRAPED, NO_CONTACT)), None)
            for k, p in enumerate(people):
                fields = dict(full_name=p["name"], title=p["title"], linkedin_url=p["linkedin"],
                              email="", email_candidates="", email_source="", email_type="",
                              verified_status="", status=PEOPLE_FOUND)
                if k == 0 and base is not None:
                    store.set(base, **fields)
                else:
                    store.clone_row(base if base is not None else rows[0], **fields)
        log.info("people [%d/%d] %s: %s", n, min(len(order), s.search_max_per_run), company,
                 ", ".join(f"{p['name']} ({p['title']})" for p in people) or "nobody found")
        if n % SAVE_EVERY == 0:
            _checkpoint(s, store)
    log.info("people search: %s", counts)
    return counts


# ------------------------------------------------------------------ 3. emails
def emails_stage(s: Settings, store: Store) -> dict:
    counts = {"email_found": 0, "no_contact": 0}
    for i in store.indices_with_status([PEOPLE_FOUND, SCRAPED])[: s.batch_size * max(max_people(s), 3)]:
        row = store.df.loc[i]
        domain = row["domain"]
        work = store.state.get("work", {}).get(domain, {})
        site = [e for e, _ in work.get("emails", [])]
        generic = em.rank_generic(site, domain)
        cands, src, typ = [], "", ""

        if row["full_name"]:
            if row["email"]:
                cands, src, typ = [row["email"]], row["email_source"] or "github", "personal"
            else:
                m = em.site_email_for_person(row["full_name"], site)
                if m:
                    cands, src, typ = [m], "website", "personal"
                else:
                    cands = em.pattern_candidates(row["full_name"], domain, s.max_candidates)
                    src, typ = "pattern-guess", "personal"
            if not cands and generic:
                cands, src, typ = [generic[0]], "website", "generic"
        else:
            personal = em.own_personal_emails(site, domain)
            if personal:
                cands, src, typ = [personal[0]], "website", "personal"
            elif generic:
                cands, src, typ = [generic[0]], "website", "generic"

        if cands:
            store.set(i, email_candidates=", ".join(cands), email_source=src, email_type=typ,
                      status=EMAIL_FOUND)
            counts["email_found"] += 1
        else:
            store.set(i, status=NO_CONTACT)
            counts["no_contact"] += 1
    log.info("emails: %s", counts)
    return counts


# ------------------------------------------------------------------ 4. verify
VERIFY_WORKERS = 4  # companies whose emails are checked at the same time


def _verify_row(verifier: Verifier, domain: str, cands: list, src: str, typ: str, site: list):
    """(email, status, src, typ) for one row. Network only: safe in a worker thread."""
    email, status = verifier.verify(domain, cands)
    if not email and typ == "personal":  # fall back to a generic company mailbox
        generic = em.rank_generic(site, domain)
        if generic:
            email, status = verifier.verify(domain, [generic[0]])
            if email:
                src, typ = "website", "generic"
    return email, status, src, typ


def _verify_domain(verifier: Verifier, jobs: list) -> list:
    """All rows of one company, one after another (one company's mail server is not probed in
    parallel, and its catch-all answer is reused)."""
    out = []
    for i, domain, cands, src, typ, site in jobs:
        try:
            out.append((i, _verify_row(verifier, domain, cands, src, typ, site)))
        except Exception:
            log.exception("verify crashed on %s; will retry next run", domain)
            out.append((i, None))
    return out


def verify_stage(s: Settings, store: Store) -> dict:
    verifier = Verifier(s, store.state)
    counts = {"valid": 0, "risky": 0, "unverified": 0, "invalid": 0}
    # every person of the companies read this round (up to MAX_PEOPLE each), not one per company
    todo = store.indices_with_status([EMAIL_FOUND])[: s.batch_size * max(max_people(s), 3)]
    by_domain: dict = {}
    for i in todo:
        row = store.df.loc[i]
        domain = row["domain"]
        site = [e for e, _ in store.state.get("work", {}).get(domain, {}).get("emails", [])]
        cands = [c.strip() for c in row["email_candidates"].split(",") if c.strip()]
        by_domain.setdefault(domain, []).append((i, domain, cands, row["email_source"], row["email_type"], site))
    workers = min(VERIFY_WORKERS, max(1, getattr(s, "workers", 1)))
    def results():
        """Each company's results as soon as its checks finish (the log and the sheet move as
        the stage goes, instead of all at the end); only this thread writes the sheet."""
        if workers > 1 and len(by_domain) > 1:
            with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="verify") as pool:
                for fut in as_completed([pool.submit(_verify_domain, verifier, j) for j in by_domain.values()]):
                    yield from fut.result()
        else:
            for jobs in by_domain.values():
                yield from _verify_domain(verifier, jobs)

    for n, (i, res) in enumerate(results(), 1):
        if res is None:
            continue
        row = store.df.loc[i]
        email, status, src, typ = res
        if email:
            if src == "pattern-guess" and status == "valid":
                src = "pattern-verified"
            store.set(i, email=email, verified_status=status, email_source=src, email_type=typ,
                      status=VERIFIED)
        else:
            store.set(i, email="", verified_status="invalid", status=NO_CONTACT)
        counts[status if email else "invalid"] += 1
        log.info("verify [%d/%d] %s: %s %s", n, len(todo), row["full_name"] or row["domain"],
                 email or "no usable email", f"({status})" if email else "")
        if n % SAVE_EVERY == 0:
            _checkpoint(s, store)

    pending = set(store.df.loc[store.df["status"].isin([DISCOVERED, PEOPLE_FOUND, SCRAPED, EMAIL_FOUND]), "domain"])
    for d in list(store.state.get("work", {})):
        if d not in pending:
            store.state["work"].pop(d, None)
    log.info("verify: %s (reacher=%s)", counts, "on" if verifier.reacher_ok else "off, MX-only")
    return counts


# ------------------------------------------------------------------ 5. score
def score_stage(s: Settings, store: Store) -> dict:
    for i in store.df.index:
        row = store.df.loc[i].to_dict()
        sc = score_row(row)
        row["score"] = sc
        store.df.at[i, "score"] = str(sc)
        store.df.at[i, "ready"] = "yes" if is_ready(row, s.min_score) else ""
    return {"scored": len(store.df)}
