"""Email candidate generation and selection."""
from typing import List, Optional

import tldextract

from .extract import GENERIC_LOCALS, is_generic
from .util import split_name

# Preferred generic mailboxes, best first. These reach a human at small startups.
GENERIC_PREFERENCE = ["founders", "hello", "contact", "hi", "team", "info", "sales", "support"]
# Free mailbox providers. Small firms (common in the Gulf) publish one of these as their only
# address; it is used only when the site shows nothing on the company's own domains.
FREE_MAIL = frozenset({"gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "live.com", "yahoo.com",
                       "yahoo.co.in", "ymail.com", "icloud.com", "aol.com", "protonmail.com", "proton.me",
                       "zohomail.com", "hotmail.co.uk", "outlook.sa", "yahoo.co.uk"})


def mail_domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower() if "@" in email else ""


def on_own_domain(email: str, domain: str) -> bool:
    return email.endswith("@" + domain) or email.endswith("." + domain)


def on_sibling_domain(email: str, domain: str) -> bool:
    """Same name, other ending: info@acme.com for acme.ae, sales@acme.ae for acme.com.sa."""
    mine, theirs = tldextract.extract(domain or ""), tldextract.extract(mail_domain(email))
    return bool(mine.domain) and len(mine.domain) >= 3 and mine.domain == theirs.domain \
        and mine.suffix != theirs.suffix


def company_addresses(site_emails: List[str], domain: str) -> List[str]:
    """Site addresses that belong to the company: its own domain first, then a sibling domain."""
    own = [e for e in site_emails if on_own_domain(e, domain)]
    return own or [e for e in site_emails if on_sibling_domain(e, domain)]


def free_mail_fallback(site_emails: List[str]) -> List[str]:
    """Free-mailbox addresses on the site, generic-looking ones first."""
    free = [e for e in site_emails if mail_domain(e) in FREE_MAIL]
    return sorted(free, key=lambda e: 0 if is_generic(e) else 1)


def pattern_candidates(full_name: str, domain: str, limit: int = 4) -> List[str]:
    """Likely addresses for a person, most common startup patterns first."""
    first, last = split_name(full_name)
    if not first or not last or not domain:
        return []
    pats = [
        f"{first}", f"{first}.{last}", f"{first[0]}{last}", f"{first}{last[0]}",
        f"{first[0]}.{last}", f"{first}_{last}", f"{first}{last}",
    ]
    seen, out = set(), []
    for p in pats:
        e = f"{p}@{domain}"
        if e not in seen:
            seen.add(e)
            out.append(e)
    return out[:limit]


def site_email_for_person(full_name: str, site_emails: List[str]) -> Optional[str]:
    """A personal-looking address found on the site whose local part contains the person's name."""
    first, last = split_name(full_name)
    for e in site_emails:
        if is_generic(e):
            continue
        local = e.split("@")[0].lower()
        local_alpha = "".join(ch for ch in local if ch.isalpha())
        if (first and len(first) >= 3 and first in local_alpha) or (
            last and len(last) >= 3 and last in local_alpha
        ):
            return e
    return None


def rank_generic(site_emails: List[str], domain: str) -> List[str]:
    """Generic mailboxes on the company's own (else sibling) domain, best first."""
    generic = ([e for e in site_emails if on_own_domain(e, domain) and is_generic(e)]
               or [e for e in site_emails if on_sibling_domain(e, domain) and is_generic(e)])

    def key(e):
        local = e.split("@")[0].lower()
        return GENERIC_PREFERENCE.index(local) if local in GENERIC_PREFERENCE else 99

    return sorted(generic, key=key)


def own_personal_emails(site_emails: List[str], domain: str) -> List[str]:
    """Personal-looking (non-generic) addresses on the company's own (else sibling) domain."""
    return [e for e in company_addresses(site_emails, domain) if not is_generic(e)]
