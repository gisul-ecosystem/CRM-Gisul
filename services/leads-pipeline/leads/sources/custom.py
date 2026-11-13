import base64
import logging
import os
import random
import re
import time
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import parse_qs, quote_plus, urlparse

from ..config import Settings
from ..custom_search import CUSTOM_SEARCH, read_spec, record_found
from ..fetch import Fetcher
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked
from .search import SEA_SKIP, SWITCH, _lists, name_from_title, providers, run_query

log = logging.getLogger(__name__)

GOOGLE_ROWS = """() => {
    const out = [];
    const seen = new Set();
    for (const h3 of document.querySelectorAll('#search a h3, #rso a h3')) {
        const a = h3.closest('a');
        if (!a || !a.href || seen.has(a.href)) continue;
        seen.add(a.href);
        const box = a.closest('div.MjjYud, div.g, div[data-hveid]') || a.parentElement;
        const snippet = box ? box.querySelector('.VwiC3b, [data-sncf], div[style*="-webkit-line-clamp"]') : null;
        out.push({url: a.href, title: h3.innerText, snippet: snippet ? snippet.innerText : ''});
    }
    return out;
}"""

ENGINES = {
    "google": {
        "home": "https://www.google.com/?hl=en",
        "box": 'textarea[name="q"], input[name="q"]',
        "rows": GOOGLE_ROWS,
        "next": "a#pnnext",
    },
    "duckduckgo": {
        "url": "https://html.duckduckgo.com/html/?q={q}",
        "rows": """() => Array.from(document.querySelectorAll('.result')).map(e => {
            const a = e.querySelector('a.result__a');
            const p = e.querySelector('.result__snippet');
            return {url: a ? a.href : '', title: a ? a.innerText : '', snippet: p ? p.innerText : ''};
        })""",
    },
    "bing": {
        "url": "https://www.bing.com/search?setlang=en&count={count}&q={q}",
        "rows": """() => Array.from(document.querySelectorAll('li.b_algo')).map(e => {
            const a = e.querySelector('h2 a');
            const p = e.querySelector('.b_caption p, p');
            return {url: a ? a.href : '', title: a ? a.innerText : '', snippet: p ? p.innerText : ''};
        })""",
    },
}
CONSENT_BUTTONS = ("Accept all", "I agree", "Reject all")
ENGINE_DOMAINS = {"google.com", "bing.com", "duckduckgo.com", "microsoft.com", "msn.com", "youtube.com"}
BLOCK_WORDS = ("captcha", "unusual traffic", "verify you are human", "are you a robot", "anomaly",
               "if this persists", "not a robot")
STOP_WORDS = {"in", "the", "and", "for", "with", "of", "a", "an", "near", "best", "top", "like"}


def real_url(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    host = parsed.hostname or ""
    if host.endswith("bing.com") and parsed.path.startswith("/ck/"):
        token = (query.get("u") or [""])[0]
        if token.startswith("a1"):
            raw = token[2:]
            try:
                return base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8", "replace")
            except (ValueError, UnicodeDecodeError):
                return ""
        return ""
    if host.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        return (query.get("uddg") or [""])[0]
    if host.endswith("google.com") and parsed.path == "/url":
        return (query.get("q") or query.get("url") or [""])[0]
    return url


def related(rows: List[Dict], q: str) -> bool:
    terms = [t for t in re.findall(r"[a-z0-9]{3,}", q.lower()) if t not in STOP_WORDS]
    if not rows or not terms:
        return True
    hits = sum(1 for r in rows if any(t in f"{r.get('title', '')} {r.get('snippet', '')}".lower() for t in terms))
    return hits >= max(1, len(rows) // 5)


def matches(text: str, must: List[str], exclude: List[str]) -> bool:
    low = text.lower()
    if any(word.lower() in low for word in exclude):
        return False
    return not must or any(word.lower() in low for word in must)


def skipped_domain(domain: str, skip_domains) -> bool:
    return any(domain == d or domain.endswith(f".{d}") for d in skip_domains)


class BrowserSearch:
    def __init__(self, profile_dir: Optional[Path] = None):
        self._pw = self._browser = self._page = None
        self.profile_dir = profile_dir
        self.headed = bool(os.environ.get("DISPLAY"))

    def start(self) -> bool:
        try:
            from playwright.sync_api import sync_playwright
            self._pw = sync_playwright().start()
            if self.profile_dir:
                self.profile_dir.mkdir(parents=True, exist_ok=True)
                self._browser = self._pw.chromium.launch_persistent_context(
                    str(self.profile_dir), headless=not self.headed, locale="en-US",
                    viewport={"width": 1400, "height": 860})
                self._page = self._browser.pages[0] if self._browser.pages else self._browser.new_page()
            else:
                self._browser = self._pw.chromium.launch(headless=not self.headed)
                self._page = self._browser.new_page(locale="en-US")
            self._page.set_default_timeout(CUSTOM_SEARCH["page_timeout_ms"])
            log.info("custom search: Chromium started %s", "with a window in the browser viewer" if self.headed
                     else "headless (no screen, so no viewer)")
            return True
        except Exception as e:
            log.warning("custom search: Chromium is not available (%s)", e)
            self.close()
            return False

    def _read(self, engine: str, q: str):
        rows = self._page.evaluate(ENGINES[engine]["rows"]) or []
        if rows and related(rows, q):
            return "rows", rows
        url = self._page.url.lower()
        body = (self._page.inner_text("body") or "").lower()
        if "/sorry/" in url or "captcha" in url or any(word in body for word in BLOCK_WORDS):
            return "check", None
        return ("rows", rows) if not rows else ("unrelated", None)

    def _consent(self) -> None:
        for label in CONSENT_BUTTONS:
            button = self._page.get_by_role("button", name=label)
            try:
                if button.count() and button.first.is_visible():
                    button.first.click(timeout=3000)
                    self._page.wait_for_timeout(CUSTOM_SEARCH["settle_ms"])
                    return
            except Exception:
                return

    def _open(self, engine: str, q: str) -> None:
        spec = ENGINES[engine]
        if "home" in spec:
            self._page.goto(spec["home"], wait_until="domcontentloaded")
            self._page.wait_for_timeout(CUSTOM_SEARCH["settle_ms"])
            self._consent()
            box = self._page.locator(spec["box"]).first
            box.fill(q)
            box.press("Enter")
            self._page.wait_for_load_state("domcontentloaded")
        else:
            url = spec["url"].format(q=quote_plus(q), count=CUSTOM_SEARCH["results_per_query"])
            self._page.goto(url, wait_until="domcontentloaded")
        self._page.wait_for_timeout(CUSTOM_SEARCH["settle_ms"])

    def _wait_for_person(self, engine: str, q: str) -> Optional[List[Dict]]:
        wait = CUSTOM_SEARCH["check_wait_seconds"]
        log.warning("custom search: %s shows a check. Solve it in the browser viewer on the Custom search "
                    "page; waiting up to %d s", engine, wait)
        end = time.time() + wait
        while time.time() < end:
            self._page.wait_for_timeout(CUSTOM_SEARCH["check_poll_ms"])
            if "q=" not in self._page.url:
                continue
            state, rows = self._read(engine, q)
            if state == "rows" and rows:
                log.info("custom search: check passed, searching goes on")
                return rows
        log.warning("custom search: nobody solved the %s check in time", engine)
        return None

    def _more_pages(self, engine: str, q: str, rows: List[Dict]) -> List[Dict]:
        selector = ENGINES[engine].get("next")
        for _ in range(CUSTOM_SEARCH["google_pages"] - 1):
            if not selector:
                break
            link = self._page.locator(selector).first
            if not link.count():
                break
            link.click()
            self._page.wait_for_load_state("domcontentloaded")
            self._page.wait_for_timeout(CUSTOM_SEARCH["settle_ms"])
            state, more = self._read(engine, q)
            if state != "rows" or not more:
                break
            rows = rows + more
        return rows

    def search(self, engine: str, q: str) -> Optional[List[Dict]]:
        try:
            self._open(engine, q)
            state, rows = self._read(engine, q)
            if state == "check" and self.headed:
                rows = self._wait_for_person(engine, q)
            elif state != "rows":
                return None
            if rows is None:
                return None
            return self._more_pages(engine, q, rows)
        except Exception as e:
            log.warning("custom search: %s failed for %r: %s", engine, q, e)
            return []

    def close(self) -> None:
        for obj in (self._page, self._browser):
            try:
                if obj:
                    obj.close()
            except Exception:
                pass
        try:
            if self._pw:
                self._pw.stop()
        except Exception:
            pass
        self._pw = self._browser = self._page = None


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    spec = read_spec(s.data_dir)
    if not spec:
        log.info("custom search: no search saved; start one from the CRM")
        return []
    want = min(limit, int(spec.get("companies") or limit))
    must, exclude = spec.get("mustHave") or [], spec.get("exclude") or []
    skip = _lists(getattr(s, "profile", "gpu"))[2] | SEA_SKIP | ENGINE_DOMAINS
    skip_domains = list(dict.fromkeys([*CUSTOM_SEARCH["own_domains"], *(spec.get("skipDomains") or []),
                                       *CUSTOM_SEARCH["listing_domains"]]))
    mode = spec.get("searchWith") or CUSTOM_SEARCH["default_mode"]
    apis = providers(s)
    log.info("custom search %r: %d searches, up to %d companies, with %s; never returns %s", spec["name"],
             len(spec["queries"]), want,
             "the browser (Google, then DuckDuckGo, then Bing)" if mode == "browser" or not apis
             else f"the search API ({', '.join(name for name, _ in apis)})",
             ", ".join(d for d in skip_domains if d not in CUSTOM_SEARCH["listing_domains"]))

    browser = BrowserSearch(s.data_dir / CUSTOM_SEARCH["browser_profile_dir"])
    engines = list(ENGINES)
    state = {"browser": None}

    def from_api(q: str):
        nonlocal apis
        while apis:
            name, key = apis[0]
            status, rows = run_query(name, key, fetcher, q)
            if status == 200:
                return name, rows
            if status in SWITCH:
                log.warning("custom search: %s cannot search now (HTTP %s)", name, status)
                apis = apis[1:]
                continue
            log.warning("custom search %r via %s failed: HTTP %s", q, name, status)
            return name, []
        return "", None

    def from_browser(q: str):
        nonlocal engines
        if state["browser"] is None:
            state["browser"] = browser.start()
        if not state["browser"]:
            return "", None
        while engines:
            rows = browser.search(engines[0], q)
            if rows is not None:
                return engines[0], rows
            log.warning("custom search: %s blocked the automated browser (check not solved, error page or "
                        "unrelated results)", engines[0])
            engines = engines[1:]
        return "", None

    order = (from_browser, from_api) if mode == "browser" else (from_api, from_browser)

    def rows_for(q: str):
        for fetch_rows in order:
            via, rows = fetch_rows(q)
            if rows is not None:
                return via, rows
        return "", None

    out: List[Candidate] = []
    seen = set()
    searched = 0
    try:
        for q in spec["queries"]:
            if len(out) >= want:
                break
            via, rows = rows_for(q)
            if rows is None:
                log.warning("custom search: every engine and search API failed, so the rest of the searches stop")
                break
            searched += 1
            new = 0
            for r in rows:
                url = real_url(r.get("url", ""))
                d = extract_domain(url)
                if not d or d in seen or d in skip or is_blocked(d) or skipped_domain(d, skip_domains):
                    continue
                if not matches(f"{r.get('title', '')} {r.get('snippet', '')}", must, exclude):
                    continue
                seen.add(d)
                new += 1
                out.append(Candidate(name=name_from_title(r.get("title", ""), d), domain=d, source=spec["slug"],
                                     signal=f"Custom search {spec['name']}: {q}", signal_url=url,
                                     source_ref=f"custom:{q}"))
                if len(out) >= want:
                    break
            log.info("custom search %r via %s: %d results, %d new websites", q, via, len(rows), new)
            time.sleep(random.uniform(*CUSTOM_SEARCH["pause_seconds"]))
    finally:
        browser.close()
        record_found(s.data_dir, spec, len(out), searched)
    log.info("custom search %r: %d companies from %d searches", spec["name"], len(out), searched)
    return out
