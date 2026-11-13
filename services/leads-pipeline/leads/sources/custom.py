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

ENGINES = {
    "duckduckgo": {
        "url": "https://html.duckduckgo.com/html/?q={q}",
        "rows": """els => els.map(e => {
            const a = e.querySelector('a.result__a');
            const p = e.querySelector('.result__snippet');
            return {url: a ? a.href : '', title: a ? a.innerText : '', snippet: p ? p.innerText : ''};
        })""",
        "selector": ".result",
    },
    "bing": {
        "url": "https://www.bing.com/search?setlang=en&count={count}&q={q}",
        "rows": """els => els.map(e => {
            const a = e.querySelector('h2 a');
            const p = e.querySelector('.b_caption p, p');
            return {url: a ? a.href : '', title: a ? a.innerText : '', snippet: p ? p.innerText : ''};
        })""",
        "selector": "li.b_algo",
    },
}
ENGINE_DOMAINS = {"bing.com", "duckduckgo.com", "microsoft.com", "msn.com"}
BLOCK_WORDS = ("captcha", "unusual traffic", "verify you are human", "are you a robot", "anomaly",
               "if this persists")
STOP_WORDS = {"in", "the", "and", "for", "with", "of", "a", "an", "near", "best", "top"}


def real_url(url: str) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    if parsed.hostname and parsed.hostname.endswith("bing.com") and parsed.path.startswith("/ck/"):
        token = (query.get("u") or [""])[0]
        if token.startswith("a1"):
            raw = token[2:]
            try:
                return base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8", "replace")
            except (ValueError, UnicodeDecodeError):
                return ""
        return ""
    if parsed.hostname and parsed.hostname.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        return (query.get("uddg") or [""])[0]
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

    def _read(self, spec: Dict, q: str):
        body = (self._page.inner_text("body") or "").lower()
        if any(word in body for word in BLOCK_WORDS) or "captcha" in self._page.url.lower():
            return "check", None
        rows = self._page.eval_on_selector_all(spec["selector"], spec["rows"])
        return ("rows", rows) if related(rows, q) else ("unrelated", None)

    def search(self, engine: str, q: str) -> Optional[List[Dict]]:
        spec = ENGINES[engine]
        url = spec["url"].format(q=quote_plus(q), count=CUSTOM_SEARCH["results_per_query"])
        try:
            self._page.goto(url, wait_until="domcontentloaded")
            self._page.wait_for_timeout(CUSTOM_SEARCH["settle_ms"])
            state, rows = self._read(spec, q)
            if state != "check" or not self.headed:
                return rows
            wait = CUSTOM_SEARCH["check_wait_seconds"]
            log.warning("custom search: %s shows a check. Solve it in the browser viewer on the Custom search "
                        "page; waiting up to %d s", engine, wait)
            end = time.time() + wait
            while time.time() < end:
                self._page.wait_for_timeout(CUSTOM_SEARCH["check_poll_ms"])
                if "q=" not in self._page.url:
                    continue
                state, rows = self._read(spec, q)
                if state == "rows":
                    log.info("custom search: check passed, searching goes on")
                    return rows
            log.warning("custom search: nobody solved the %s check in time", engine)
            return None
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
    skip = _lists(getattr(s, "profile", "gpu"))[2] | SEA_SKIP
    apis = providers(s)
    log.info("custom search %r: %d searches, up to %d companies, using %s", spec["name"], len(spec["queries"]),
             want, apis[0][0] if apis else "the browser (DuckDuckGo, then Bing)")

    browser = BrowserSearch(s.data_dir / CUSTOM_SEARCH["browser_profile_dir"])
    engines = list(ENGINES)
    browser_ready = None

    def rows_for(q: str):
        nonlocal apis, engines, browser_ready
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
        if browser_ready is None:
            browser_ready = browser.start()
        if not browser_ready:
            return "", None
        while engines:
            rows = browser.search(engines[0], q)
            if rows is not None:
                return engines[0], rows
            log.warning("custom search: %s blocked the automated browser (CAPTCHA, error page or unrelated "
                        "results)", engines[0])
            engines = engines[1:]
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
                log.warning("custom search: every search engine blocked the automated browser, so the rest of "
                            "the searches stop. Set SERPER_API_KEY (2,500 free searches) in Settings for "
                            "reliable custom searches.")
                break
            searched += 1
            new = 0
            for r in rows:
                url = real_url(r.get("url", ""))
                d = extract_domain(url)
                if not d or d in seen or d in skip or d in ENGINE_DOMAINS or is_blocked(d):
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
            log.info("custom search %r via %s: %d new websites", q, via, new)
            time.sleep(random.uniform(*CUSTOM_SEARCH["pause_seconds"]))
    finally:
        browser.close()
        record_found(s.data_dir, spec, len(out), searched)
    log.info("custom search %r: %d companies from %d searches", spec["name"], len(out), searched)
    return out
