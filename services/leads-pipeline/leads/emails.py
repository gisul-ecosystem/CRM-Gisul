"""Email candidate generation and selection."""
from typing import List, Optional

from .extract import GENERIC_LOCALS, is_generic
from .util import split_name

# Preferred generic mailboxes, best first. These reach a human at small startups.
GENERIC_PREFERENCE = ["founders", "hello", "contact", "hi", "team", "info", "sales", "support"]


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
    """Generic mailboxes on the company's own domain, best first."""
    own = [e for e in site_emails if e.endswith("@" + domain) or e.endswith("." + domain)]
    generic = [e for e in own if is_generic(e)]

    def key(e):
        local = e.split("@")[0].lower()
        return GENERIC_PREFERENCE.index(local) if local in GENERIC_PREFERENCE else 99

    return sorted(generic, key=key)


def own_personal_emails(site_emails: List[str], domain: str) -> List[str]:
    """Personal-looking (non-generic) addresses on the company's domain."""
    return [e for e in site_emails
            if (e.endswith("@" + domain) or e.endswith("." + domain)) and not is_generic(e)]
