"""Polite HTTP fetching: robots.txt, per-domain delay, retries, size caps.

Safe to share between worker threads: each thread gets its own HTTP session, and a lock per
website keeps the pause between requests to that site, whichever worker makes them."""
import logging
import threading
import time
from typing import Optional
from urllib import robotparser
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .config import Settings

log = logging.getLogger(__name__)


class Fetcher:
    def __init__(self, settings: Settings):
        self.s = settings
        self._local = threading.local()  # one requests.Session per thread
        self._lock = threading.Lock()
        self._host_locks: dict = {}
        self._last_hit: dict = {}
        self._robots: dict = {}
        self._dead: set = set()  # hosts that refused or timed out this run: not tried again
        self._renderer = None  # browser for the main thread
        self._render_pool = None  # browsers shared by worker threads

    @property
    def session(self) -> requests.Session:
        sess = getattr(self._local, "session", None)
        if sess is None:
            sess = self._local.session = self._new_session()
        return sess

    def _new_session(self) -> requests.Session:
        sess = requests.Session()
        sess.headers.update(
            {
                "User-Agent": self.s.user_agent,
                "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
                "Accept-Language": "en",
            }
        )
        # Retry busy servers (429/5xx) and one failed connect; never re-wait on a read timeout.
        retry = Retry(
            total=2,
            connect=1,
            read=0,
            backoff_factor=1.5,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=True,
        )
        adapter = HTTPAdapter(max_retries=retry)
        sess.mount("http://", adapter)
        sess.mount("https://", adapter)
        return sess

    def render(self, url: str, expand: bool = False) -> Optional[str]:
        """Same page through a headless browser (see render.py); None when unavailable.
        Worker threads share a small pool of browsers (Playwright objects belong to one thread)."""
        if threading.current_thread() is not threading.main_thread():
            if self._render_pool is None:
                with self._lock:
                    if self._render_pool is None:
                        from .render import RenderPool
                        self._render_pool = RenderPool(self.s, self)
            return self._render_pool.render(url, expand=expand)
        if self._renderer is None:
            from .render import Renderer
            self._renderer = Renderer(self.s, self)
        return self._renderer.html(url, expand=expand)

    def close(self) -> None:
        if self._renderer is not None:
            self._renderer.close()
        if self._render_pool is not None:
            self._render_pool.close()

    def reset_renderer(self) -> None:
        """After a page froze the headless browser: drop it; the next render starts a fresh one."""
        from .util import TimeLimit, time_limit

        r, self._renderer = self._renderer, None
        if r is not None:
            try:
                with time_limit(20):
                    r.close()
            except TimeLimit:
                log.warning("headless browser did not close; JavaScript pages are skipped for the rest of this run")
                from .render import Renderer
                self._renderer = Renderer(self.s, self)
                self._renderer._broken = True

    def _timeout(self):
        return (5, self.s.request_timeout)  # (connect, read) seconds

    def _mark_dead(self, host: str, err: Exception) -> None:
        if isinstance(err, (requests.ConnectionError, requests.Timeout)):
            self._dead.add(host)

    def _host_lock(self, host: str) -> threading.Lock:
        with self._lock:
            return self._host_locks.setdefault(host, threading.Lock())

    def _wait(self, host: str) -> None:
        """Keep DOMAIN_DELAY between requests to one host, across all worker threads."""
        with self._host_lock(host):
            last = self._last_hit.get(host)
            if last is not None:
                gap = time.time() - last
                if gap < self.s.domain_delay:
                    time.sleep(self.s.domain_delay - gap)
            self._last_hit[host] = time.time()

    def _robots_for(self, scheme: str, host: str) -> robotparser.RobotFileParser:
        key = f"{scheme}://{host}"
        if key in self._robots:
            return self._robots[key]
        rp = robotparser.RobotFileParser()
        try:
            self._wait(host)
            r = self.session.get(f"{key}/robots.txt", timeout=self._timeout())
            if r.status_code == 200 and len(r.content) < 500_000:
                rp.parse(r.text.splitlines())
            else:
                rp.parse([])  # no usable robots.txt: everything allowed
        except requests.RequestException as e:
            self._mark_dead(host, e)
            rp.parse([])
        self._robots[key] = rp
        return rp

    def allowed(self, url: str) -> bool:
        p = urlparse(url)
        rp = self._robots_for(p.scheme or "https", p.hostname or "")
        return rp.can_fetch(self.s.user_agent, url)

    def get_html(self, url: str) -> Optional[str]:
        """Fetch a page politely. Returns HTML text, or None on any failure."""
        p = urlparse(url)
        if not p.hostname or p.hostname in self._dead:
            return None
        if not self.allowed(url) or p.hostname in self._dead:
            log.debug("robots.txt disallows %s", url)
            return None
        self._wait(p.hostname)
        try:
            r = self.session.get(url, timeout=self._timeout(), stream=True, allow_redirects=True)
        except requests.RequestException as e:
            log.debug("fetch failed %s: %s", url, e)
            self._mark_dead(p.hostname, e)
            return None
        try:
            if r.status_code != 200:
                return None
            ctype = r.headers.get("Content-Type", "")
            if "html" not in ctype and "xml" not in ctype and ctype:
                return None
            chunks, size, started = [], 0, time.time()
            for chunk in r.iter_content(65536):
                size += len(chunk)
                if size > self.s.max_page_bytes or time.time() - started > 2 * self.s.request_timeout:
                    break  # too big, or a server dripping bytes slowly
                chunks.append(chunk)
            raw = b"".join(chunks)
            enc = r.encoding or "utf-8"
            try:
                return raw.decode(enc, errors="replace")
            except LookupError:
                return raw.decode("utf-8", errors="replace")
        finally:
            r.close()

    def post_json(self, url: str, payload: dict, headers: Optional[dict] = None,
                  timeout: Optional[int] = None):
        """For APIs that take a JSON body. Returns (status_code, json_or_None)."""
        try:
            r = self.session.post(url, json=payload, headers=headers or {},
                                  timeout=timeout or self.s.request_timeout)
        except requests.RequestException as e:
            log.warning("API request failed %s: %s", url, e)
            return 0, None
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, None

    def get_json(self, url: str, headers: Optional[dict] = None, params: Optional[dict] = None,
                 timeout: Optional[int] = None):
        """For APIs (no robots check). Returns (status_code, json_or_None, response_headers)."""
        try:
            r = self.session.get(
                url, headers=headers or {}, params=params,
                timeout=timeout or self.s.request_timeout,
            )
        except requests.RequestException as e:
            log.warning("API request failed %s: %s", url, e)
            return 0, None, {}
        try:
            return r.status_code, r.json(), r.headers
        except ValueError:
            return r.status_code, None, r.headers
