"""Email verification: MX lookup (always) + Reacher SMTP probing (if configured)."""
import logging
import time
from typing import List, Tuple

import dns.exception
import dns.resolver
import requests

from .config import Settings

log = logging.getLogger(__name__)

VALID, RISKY, INVALID, UNVERIFIED = "valid", "risky", "invalid", "unverified"
# Mail hosts that answer "no such mailbox" to probes from servers they don't trust, even for real
# people (seen live: Microsoft 365 rejected an existing address). Their "invalid" means "unknown";
# their "valid" is still believed.
UNTRUSTED_INVALID_MX = ("protection.outlook.com", "outlook.com", "hotmail.com")
REACHER_TIMEOUT = 45   # seconds per check; a mail server that never answers would hold a worker
SLOW_AFTER = 2         # timeouts on one domain before its other addresses are not probed


class Verifier:
    def __init__(self, settings: Settings, store_state: dict):
        self.s = settings
        self.catch_all = store_state.setdefault("catch_all", {})  # domain -> bool, persisted
        self._mx_cache: dict = {}
        self._resolver = dns.resolver.Resolver()
        self._resolver.lifetime = 6
        self._resolver.timeout = 3
        self.reacher_ok = bool(settings.reacher_url)
        self._timeouts: dict = {}  # domain -> Reacher timeouts this run

    # ---------- MX ----------
    def has_mx(self, domain: str) -> bool:
        if domain in self._mx_cache:
            return self._mx_cache[domain]
        ok = False
        try:
            ok = len(self._resolver.resolve(domain, "MX")) > 0
        except (dns.resolver.NoAnswer, dns.resolver.NXDOMAIN, dns.resolver.NoNameservers):
            try:  # RFC 5321: fall back to the A record as an implicit MX
                ok = len(self._resolver.resolve(domain, "A")) > 0
            except dns.exception.DNSException:
                ok = False
        except dns.exception.DNSException:
            ok = False
        self._mx_cache[domain] = ok
        return ok

    # ---------- Reacher ----------
    def _reacher(self, email: str) -> Tuple[str, bool]:
        """Returns (status, is_catch_all). Status in valid/risky/invalid/unknown."""
        headers = {"Content-Type": "application/json"}
        if self.s.reacher_secret:
            headers["x-reacher-secret"] = self.s.reacher_secret
        try:
            r = requests.post(
                self.s.reacher_url, json={"to_email": email}, headers=headers, timeout=REACHER_TIMEOUT
            )
            data = r.json()
        except requests.Timeout as e:
            dom = email.rsplit("@", 1)[-1]
            self._timeouts[dom] = self._timeouts.get(dom, 0) + 1
            log.warning("Reacher call failed for %s: %s", email, e)
            return "unknown", False
        except (requests.RequestException, ValueError) as e:
            log.warning("Reacher call failed for %s: %s", email, e)
            return "unknown", False
        reach = (data.get("is_reachable") or "unknown").lower()
        smtp = data.get("smtp") or {}
        catch_all = bool(smtp.get("is_catch_all"))
        if catch_all:
            return "risky", True
        mx_hosts = [h.lower().rstrip(".") for h in (data.get("mx") or {}).get("records") or []]
        if reach == "invalid" and any(h.endswith(UNTRUSTED_INVALID_MX) for h in mx_hosts):
            return "unknown", False
        return {"safe": VALID, "risky": RISKY, "invalid": INVALID}.get(reach, "unknown"), False

    # ---------- main entry ----------
    def verify(self, domain: str, candidates: List[str]) -> Tuple[str, str]:
        """Pick the best address from candidates. Returns (email, status).

        email is '' when nothing is usable. Status is valid/risky/invalid/unverified.
        """
        candidates = [c for c in candidates if c]
        if not candidates:
            return "", INVALID
        if not self.has_mx(domain):
            return "", INVALID
        if not self.reacher_ok:
            return candidates[0], UNVERIFIED  # MX-only: we can't confirm the mailbox exists
        if self.catch_all.get(domain):
            return candidates[0], RISKY
        first_unknown = ""
        for cand in candidates[: self.s.max_candidates]:
            if self._timeouts.get(domain, 0) >= SLOW_AFTER:  # mail server never answers: stop waiting
                log.info("%s: mail server does not answer checks; keeping %s unverified", domain, candidates[0])
                return first_unknown or candidates[0], UNVERIFIED
            status, catch_all = self._reacher(cand)
            time.sleep(1.0)
            if catch_all:
                self.catch_all[domain] = True
                return candidates[0], RISKY
            if status == VALID:
                self.catch_all[domain] = False
                return cand, VALID
            if status == RISKY:
                return cand, RISKY
            if status == "unknown" and not first_unknown:
                first_unknown = cand
        if first_unknown:
            return first_unknown, UNVERIFIED
        return "", INVALID
