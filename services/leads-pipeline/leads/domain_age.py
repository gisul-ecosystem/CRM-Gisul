"""The year a company's website domain was first registered: a free stand-in for its founding
year, so recently started companies can be told from old ones before their site is read.

Asked from the domain's own registry over RDAP (the registry list comes from IANA), or WHOIS for
the few endings without RDAP. Answers are kept in state["domain_year"] (0 = no answer), so each
domain is asked once. A domain can be older than the company (bought second-hand), so this is
evidence like a copyright year, not proof.
"""
import logging
import re
import socket
import threading
import time
from typing import Optional

import requests

log = logging.getLogger(__name__)
BOOTSTRAP = "https://data.iana.org/rdap/dns.json"
WHOIS = {"io": "whois.nic.io", "co": "whois.registry.co", "my": "whois.mynic.my"}  # no RDAP
_CREATED_RE = re.compile(r"(?:Creation Date|Created|Registered Date|Record created)[^:\n]*:\s*((?:19|20)\d{2})", re.I)
PAUSE = 1.0  # seconds between questions to one registry


class DomainAge:
    def __init__(self, state: dict, user_agent: str):
        self.cache = state.setdefault("domain_year", {})
        self.headers = {"User-Agent": user_agent, "Accept": "application/rdap+json"}
        self._rdap: Optional[dict] = None
        self._last: dict = {}
        self._lock = threading.Lock()

    def _servers(self) -> dict:
        if self._rdap is None:
            try:
                boot = requests.get(BOOTSTRAP, headers=self.headers, timeout=30).json()
                self._rdap = {tld: urls[0] for tlds, urls in boot["services"] for tld in tlds}
            except (requests.RequestException, ValueError, KeyError) as e:
                log.warning("domain age: IANA registry list unavailable (%s); skipping this run", e)
                self._rdap = {}
        return self._rdap

    def _wait(self, host: str) -> None:
        with self._lock:
            gap = PAUSE - (time.time() - self._last.get(host, 0))
            if gap > 0:
                time.sleep(gap)
            self._last[host] = time.time()

    def _ask_rdap(self, base: str, domain: str) -> int:
        self._wait(base)
        r = requests.get(base.rstrip("/") + "/domain/" + domain, headers=self.headers, timeout=25)
        if r.status_code != 200:
            return 0
        for e in r.json().get("events", []):
            if e.get("eventAction") == "registration" and (e.get("eventDate") or "")[:4].isdigit():
                return int(e["eventDate"][:4])
        return 0

    def _ask_whois(self, server: str, domain: str) -> int:
        self._wait(server)
        with socket.create_connection((server, 43), timeout=15) as s:
            s.sendall((domain + "\r\n").encode())
            data = b""
            while len(data) < 200_000 and (chunk := s.recv(4096)):
                data += chunk
        m = _CREATED_RE.search(data.decode("utf-8", "replace"))
        return int(m.group(1)) if m else 0

    def year(self, domain: str) -> Optional[int]:
        """Registration year of the registered domain (e.g. acme.co.in), or None if unknown."""
        if domain in self.cache:
            return self.cache[domain] or None
        tld = domain.rsplit(".", 1)[-1].lower()
        year = 0
        try:
            if tld in WHOIS:
                year = self._ask_whois(WHOIS[tld], domain)
            elif self._servers().get(tld):
                year = self._ask_rdap(self._servers()[tld], domain)
        except (requests.RequestException, ValueError, OSError) as e:
            log.debug("domain age %s: %s", domain, e)
            return None  # not remembered: asked again next run
        self.cache[domain] = year
        return year or None
