"""Headless-browser fallback for pages that build their content with JavaScript.

The plain fetcher is tried first everywhere; this is used only when a page comes back empty or
nearly empty. It drives a real Chromium (Playwright), started on first use and closed at the
end of the run, and keeps the same manners as the plain fetcher: robots.txt, the per-site
delay, the bot's user agent, and hosts that failed this run are skipped.

Optional: without `pip install playwright` + `playwright install chromium`, or with
RENDER_JS=0, every call returns None and the pipeline behaves as before.
"""
import logging
import queue
import re
import threading
from concurrent.futures import Future
from typing import Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

EXPAND_RE = re.compile(r"^\s*(load|show|view|see)\s+more\b", re.I)
MAX_EXPAND_CLICKS = 40
SKIP_RESOURCES = {"image", "media", "font"}


def looks_empty(html: Optional[str]) -> bool:
    """True when a fetched page is a JavaScript shell: little visible text, several scripts."""
    if not html:
        return True
    soup = BeautifulSoup(html, "lxml")
    scripts = len(soup.find_all("script"))
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return len(soup.get_text(" ").split()) < 120 and scripts >= 2


class Renderer:
    def __init__(self, settings, fetcher):
        self.s = settings
        self.fetcher = fetcher  # shares robots.txt cache, per-site delay and dead hosts
        self._pw = self._browser = self._ctx = None
        self._broken = not settings.render_js

    def available(self) -> bool:
        if self._broken:
            return False
        if self._ctx is None:
            try:
                from playwright.sync_api import sync_playwright
                self._pw = sync_playwright().start()
                self._browser = self._pw.chromium.launch()
                self._ctx = self._browser.new_context(user_agent=self.s.user_agent)
                # no browser call may wait forever on a misbehaving page
                self._ctx.set_default_timeout(20000)
                self._ctx.set_default_navigation_timeout(30000)
                self._ctx.route("**/*", lambda r: r.abort() if r.request.resource_type in SKIP_RESOURCES
                                else r.continue_())
                log.info("headless browser started for JavaScript pages")
            except Exception as e:  # not installed, or no browser binary
                log.warning("headless browser unavailable (%s); JavaScript pages will be skipped", e)
                self._broken = True
                self.close()
                return False
        return True

    def html(self, url: str, expand: bool = False) -> Optional[str]:
        """Rendered HTML of `url`, or None. expand=True keeps clicking 'Load more' buttons."""
        host = urlparse(url).hostname or ""
        if not host or host in self.fetcher._dead or not self.fetcher.allowed(url):
            return None
        if not self.available():
            return None
        self.fetcher._wait(host)
        page = self._ctx.new_page()
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2500)
            for _ in range(4):  # lazy-loaded content
                page.mouse.wheel(0, 5000)
                page.wait_for_timeout(400)
            if expand:
                self._expand(page)
            return page.content()
        except Exception as e:
            log.debug("render failed %s: %s", url, e)
            return None
        finally:
            page.close()

    def _expand(self, page) -> None:
        stale = 0
        for _ in range(MAX_EXPAND_CLICKS):
            before = page.eval_on_selector_all("a[href]", "els => els.length")
            btn = page.get_by_role("button", name=EXPAND_RE)
            if not btn.count():
                btn = page.get_by_text(EXPAND_RE)
            if not btn.count():
                return
            try:
                btn.first.scroll_into_view_if_needed(timeout=3000)
                btn.first.click(timeout=3000)
            except Exception:
                return
            page.wait_for_timeout(1500)
            if page.eval_on_selector_all("a[href]", "els => els.length") == before:
                stale += 1
                if stale >= 2:
                    return
            else:
                stale = 0

    def close(self) -> None:  # noqa: D401 - see RenderPool below
        for obj in (self._ctx, self._browser):
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
        self._pw = self._browser = self._ctx = None


class RenderPool:
    """Headless browsers for worker threads. A Playwright browser belongs to the thread that
    started it, so `size` render threads each own one browser and workers queue pages to them.
    This also caps memory (each Chromium uses ~200-300 MB). A render that does not finish within
    `timeout` seconds returns None and its thread is replaced, so one frozen page cannot block
    the workers."""

    MAX_THREADS = 6  # replacements included: stuck threads are abandoned, not reused

    def __init__(self, settings, fetcher, size: int = 2, timeout: int = 90):
        self.s, self.fetcher, self.timeout = settings, fetcher, timeout
        self.q: "queue.Queue" = queue.Queue()
        self._lock = threading.Lock()
        self._threads = []
        for _ in range(size):
            self._spawn()

    def _spawn(self) -> bool:
        with self._lock:
            if len(self._threads) >= self.MAX_THREADS:
                return False
            t = threading.Thread(target=self._loop, name=f"render-{len(self._threads) + 1}", daemon=True)
            self._threads.append(t)
        t.start()
        return True

    def _loop(self) -> None:
        r = Renderer(self.s, self.fetcher)
        try:
            while True:
                job = self.q.get()
                if job is None:
                    return
                url, expand, started, fut = job
                started.set()
                try:
                    fut.set_result(r.html(url, expand=expand))
                except Exception:  # never leave a worker waiting
                    fut.set_result(None)
        finally:
            r.close()

    def render(self, url: str, expand: bool = False) -> Optional[str]:
        started, fut = threading.Event(), Future()
        self.q.put((url, expand, started, fut))
        if not started.wait(timeout=self.timeout * 4):  # queue too long: give up on this page
            return None
        try:
            return fut.result(timeout=self.timeout)
        except Exception:
            log.warning("headless browser stuck on %s; starting a fresh one", url)
            self._spawn()
            return None

    def close(self) -> None:
        for _ in self._threads:
            self.q.put(None)
