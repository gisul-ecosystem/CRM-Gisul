import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional

from ..people_search import company_keys
from .config import PARTNERS

log = logging.getLogger("leads.partners")
UNIFERS = PARTNERS["unifers"]
DAY_S = 86400


def unifers_key() -> str:
    return (os.getenv("UNIFERS_API_KEY") or "").strip()


def _url(path: str) -> str:
    return (os.getenv("UNIFERS_API_URL") or UNIFERS["default_url"]).strip().rstrip("/") + path


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _texts(value) -> List[str]:
    return [v.strip() for v in value if isinstance(v, str) and v.strip()] if isinstance(value, list) else []


def _post(fetcher, path: str, body: Dict, stats: Dict) -> Optional[Dict]:
    headers = {"X-API-Key": unifers_key(), "Content-Type": "application/json", "Accept": "application/json"}
    status, data = fetcher.post_json(_url(path), body, headers=headers, timeout=UNIFERS["timeout_s"])
    if status == 404:
        return {}
    if status != 200 or not isinstance(data, dict) or data.get("error") is not False:
        message = data.get("message") if isinstance(data, dict) else ""
        log.warning("partners: Unifers %s answered HTTP %s %s", path, status, message or "")
        stats["unifers_failed"] += 1
        return None
    people = data.get("peopleData")
    if not isinstance(people, dict):
        log.warning("partners: Unifers %s sent no peopleData", path)
        stats["unifers_failed"] += 1
        return None
    stats["unifers_calls"] += 1
    stats["unifers_credits"] += int(data.get("creditsCharged") or 0)
    return {"people": people, "fields": data.get("fields") if isinstance(data.get("fields"), dict) else {}}


def _profile(people: Dict) -> Dict:
    company = people.get("company") if isinstance(people.get("company"), dict) else {}
    place = ", ".join(x for x in (_text(people.get("city")), _text(people.get("stateName")),
                                  _text(people.get("country"))) if x)
    return {"fullName": _text(people.get("fullName")),
            "title": _text(people.get("jobTitle")),
            "headline": _text(people.get("headline")),
            "employer": _text(company.get("name")) or _text(people.get("companyName")),
            "employerDomain": _text(company.get("websiteDomain")),
            "location": place}


def _works_at(profile: Dict, company: Dict) -> Optional[bool]:
    if not profile["employer"] and not profile["employerDomain"]:
        return None
    keys = [k for k in company_keys(company["company"], company.get("domain", "")) if len(k) >= 4]
    seen = re.sub(r"[^a-z0-9]", "", f"{profile['employer']} {profile['employerDomain']}".lower())
    return any(k in seen for k in keys)


def _fresh(hit: Dict) -> bool:
    try:
        at = datetime.fromisoformat(hit["at"])
    except (KeyError, TypeError, ValueError):
        return False
    return (datetime.now() - at).total_seconds() <= UNIFERS["repeat_days"] * DAY_S


def _missing(person: Dict) -> Dict[str, bool]:
    return {field: bool(UNIFERS["reveal"].get(field)) and not (person.get(field) or "").strip()
            for field in ("email", "phone")}


def _lookup(fetcher, url: str, company: Dict, stats: Dict, want: Dict[str, bool]) -> Optional[Dict]:
    found = _post(fetcher, UNIFERS["enrich_path"], {"linkedin": url, "fallback": UNIFERS["fallback"]}, stats)
    if found is None:
        return None
    out = {"at": datetime.now().isoformat(timespec="seconds"), "profile": {}, "worksThere": None,
           "email": "", "phone": "", "emailStatus": "", "phoneStatus": ""}
    if found:
        out["profile"] = _profile(found["people"])
        out["worksThere"] = _works_at(out["profile"], company)
    if out["worksThere"] is False:
        return out
    if not any(want.values()):
        return out
    shown = _post(fetcher, UNIFERS["reveal_path"],
                  {"linkedin": url, "revealContacts": want, "fallback": UNIFERS["fallback"]}, stats)
    if not shown:
        return out
    people, fields = shown["people"], shown["fields"]
    emails = _texts(people.get("professionalEmails"))
    if UNIFERS["use_personal_email"]:
        emails += _texts(people.get("personalEmails"))
    phones = _texts(people.get("mobiles"))
    out.update(email=emails[0] if emails else "", phone=phones[0] if phones else "",
               emailStatus=_text(fields.get("email")), phoneStatus=_text(fields.get("phone")))
    return out


def enrich_people(fetcher, companies: List[Dict], cache: Dict, stats: Dict) -> None:
    if not unifers_key():
        log.info("partners: no UNIFERS_API_KEY; contacts stay as found in search")
        return
    store = cache.setdefault("unifers", {})
    for company in companies:
        kept = []
        for person in company["people"]:
            kept.append(person)
            want = _missing(person)
            if not any(want.values()):
                stats["unifers_skipped"] += 1
                continue
            url = person["linkedin"]
            hit = store.get(url)
            if hit and _fresh(hit):
                stats["unifers_cached"] += 1
            else:
                if stats["unifers_people"] >= UNIFERS["max_people"]:
                    continue
                stats["unifers_people"] += 1
                hit = _lookup(fetcher, url, company, stats, want)
                if hit is None:
                    continue
                store[url] = hit
            profile = hit["profile"]
            person.update(
                name=profile.get("fullName") or person["name"],
                title=profile.get("title") or person["title"],
                headline=profile.get("headline", ""),
                location=profile.get("location", ""),
                employer=profile.get("employer", ""),
                worksThere=hit["worksThere"],
                email=(person.get("email") or "").strip() or hit["email"],
                phone=(person.get("phone") or "").strip() or hit["phone"],
                enriched=True,
            )
            if hit["worksThere"] is False:
                kept.pop()
                stats["unifers_moved"] += 1
        company["people"] = kept
    log.info("partners: Unifers: %d people looked up, %d from cache, %d skipped (email and phone known), "
             "%d credits", stats["unifers_people"], stats["unifers_cached"], stats["unifers_skipped"],
             stats["unifers_credits"])
