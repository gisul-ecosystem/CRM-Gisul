"""Country detection and AI-keyword matching, shared by sources and the scrape stage.

A company's `india` column is 'yes' (evidence found), 'no' (evidence it is elsewhere, or
its website showed no Indian signal) or '' (not checked yet). Its `country` column names the
target country its website points to (COUNTRIES below), or the strongest other one found.
"""
import re
from typing import Iterable, List, Sequence, Tuple

from .util import _extract

PLACES = [
    "India", "Bengaluru", "Bangalore", "Mumbai", "New Delhi", "Delhi", "Gurugram", "Gurgaon",
    "Noida", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Cochin",
    "Thiruvananthapuram", "Trivandrum", "Coimbatore", "Indore", "Chandigarh", "Mohali",
    "Bhubaneswar", "Lucknow", "Mysuru", "Mysore", "Nagpur", "Surat", "Vadodara", "Goa",
    "Karnataka", "Maharashtra", "Telangana", "Tamil Nadu", "Kerala", "Gujarat", "Haryana",
]
_PLACE_RE = re.compile(r"\b(?:" + "|".join(re.escape(p) for p in PLACES) + r")\b", re.I)
# Company Identification Number, e.g. U72900KA2021PTC123456
_CIN_RE = re.compile(r"\b[LU]\d{5}[A-Z]{2}\d{4}(?:PTC|PLC|OPC|FTC|GOI|NPL|ULL|ULT)\d{6}\b")
_PVT_RE = re.compile(r"\b(?:pvt\.?|private)\s+(?:ltd\.?|limited)\b", re.I)

# For short texts (names, headlines, tags, one-liners), where a match means the company is AI.
AI_RE = re.compile(
    r"\b(?:ai|a\.i\.|genai|gen-ai|generative|agentic|llms?|ml|machine learning|"
    r"deep learning|neural|computer vision|nlp|robotics|autonomous|speech|voice ai|"
    r"foundation models?|gpus?|data cent(?:er|re)s?)\b",
    re.I,
)
# For long texts (article bodies, long descriptions), where a bare "AI" is often incidental.
STRONG_AI_RE = re.compile(
    r"\b(?:artificial intelligence|generative ai|genai|agentic ai|ai agents?|llms?|"
    r"large language models?|machine learning|deep learning|computer vision|foundation models?|"
    r"ai[- ](?:powered|native|first|led|driven|based|startup|platform|models?|infrastructure)|"
    r"gpus?|model training|inference)\b",
    re.I,
)


def mentions_india(text: str) -> bool:
    return bool(_PLACE_RE.search(text or ""))


def is_indian_domain(domain: str) -> bool:
    return _extract(domain or "").suffix.split(".")[-1] == "in"


def looks_ai(*texts: str) -> bool:
    """For short texts: names, headlines, tags."""
    return any(AI_RE.search(t or "") for t in texts)


def strongly_ai(text: str) -> bool:
    """For long texts: needs an unambiguous AI phrase, not just a passing 'AI'."""
    return bool(STRONG_AI_RE.search(text or ""))


def location_verdict(location: str) -> str:
    """For a free-text location field: 'yes', 'no' (set but not Indian) or '' (empty)."""
    if not (location or "").strip():
        return ""
    return "yes" if mentions_india(location) else "no"


def page_signals(text: str) -> List[str]:
    """Reasons a page looks Indian: registered-company markers or an Indian address."""
    out = []
    if _CIN_RE.search(text or ""):
        out.append("cin")
    if _PVT_RE.search(text or ""):
        out.append("pvt-ltd")
    if mentions_india(text):
        out.append("place")
    return out + region_signals(text)


def site_verdict(domain: str, phones: Iterable[str], signals: Iterable[str]) -> str:
    if (is_indian_domain(domain) or any(p.startswith("+91") for p in phones)
            or any(":" not in x for x in signals)):  # 'MY:place' etc. are other countries'
        return "yes"
    return "no"


# ---------------------------------------------------------------- target countries
# code, domain ending, phone code, company-registration markers, places (cities first: the search
# and Maps sources use `cities`; India's are kept in their own lists in search.py / training.py).
COUNTRIES = {
    "India": dict(code="IN", tld="in", phone="+91", cities=[]),
    "Malaysia": dict(code="MY", tld="my", phone="+60",
                     cities=["Kuala Lumpur", "Petaling Jaya", "Cyberjaya", "Penang", "Johor Bahru"],
                     places=["Malaysia", "Selangor", "Putrajaya", "Pulau Pinang", "Shah Alam", "Subang Jaya",
                             "Kota Kinabalu", "Kuching", "Ipoh", "Melaka"],
                     reg=r"\bSdn\.?\s*Bhd\.?|\bBerhad\b"),
    "Singapore": dict(code="SG", tld="sg", phone="+65", cities=["Singapore"], places=[],
                      reg=r"\bPte\.?\s+Ltd\.?|\bUEN\b"),
    "Thailand": dict(code="TH", tld="th", phone="+66", cities=["Bangkok", "Chiang Mai"],
                     places=["Thailand", "Phuket", "Nonthaburi", "Khon Kaen", "Pattaya", "Chon Buri"],
                     reg="บริษัท[^\n]{0,80}จำกัด|\\(Thailand\\)\\s+Co\\.?,?\\s+Ltd"),
    "Indonesia": dict(code="ID", tld="id", phone="+62",
                      cities=["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Tangerang"],
                      places=["Indonesia", "Denpasar", "Bali", "Medan", "Semarang", "Bekasi", "Depok", "Makassar"],
                      reg=r"\bJl\.\s+[A-Z]|\bPT\.?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,4}\s+(?:Tbk|Indonesia)\b"),
}
_OTHER = {name: (c["code"], re.compile(c["reg"], re.I if name != "Thailand" else 0),
                 re.compile(r"\b(?:" + "|".join(re.escape(p) for p in c["cities"] + c["places"]) + r")\b", re.I))
          for name, c in COUNTRIES.items() if name != "India"}
_BY_CODE = {c["code"]: name for name, c in COUNTRIES.items()}
_BY_TLD = {c["tld"]: name for name, c in COUNTRIES.items()}


def country_names(raw: str) -> Tuple[str, ...]:
    """'india, MY,singapore' -> ('India', 'Malaysia', 'Singapore'); unknown names are dropped."""
    out = []
    for part in (raw or "").split(","):
        p = part.strip().lower()
        name = next((n for n, c in COUNTRIES.items() if p in (n.lower(), c["code"].lower())), "")
        if name and name not in out:
            out.append(name)
    return tuple(out)


def city_country(city: str) -> str:
    return next((n for n, c in COUNTRIES.items() if city in c["cities"]), "India")


def phone_region(url: str, default: str) -> str:
    """Region for reading phone numbers written without a country code: the site's own country."""
    name = _BY_TLD.get(_extract(url or "").suffix.split(".")[-1])
    return COUNTRIES[name]["code"] if name else default


def region_signals(text: str) -> List[str]:
    """page_signals for the other target countries: 'MY:reg', 'MY:place', ..."""
    out = []
    for code, reg, place in _OTHER.values():
        if reg.search(text or ""):
            out.append(f"{code}:reg")
        if place.search(text or ""):
            out.append(f"{code}:place")
    return out


def site_countries(domain: str, phones: Iterable[str], signals: Iterable[str]) -> List[str]:
    """Countries a website points to, strongest evidence first (domain ending 3, phone code 2,
    company registration 2, a place named 1; signals come one list per page read, so the number
    of matching signals breaks ties). India's signals are page_signals' untagged ones."""
    signals, phones = list(signals), list(phones)
    tld = _extract(domain or "").suffix.split(".")[-1]
    points = {}
    for name, c in COUNTRIES.items():
        mine = [x for x in signals if (":" not in x) == (name == "India")
                and (name == "India" or x.startswith(c["code"] + ":"))]
        p = (3 if tld == c["tld"] else 0) + (2 if any(ph.startswith(c["phone"]) for ph in phones) else 0)
        p += 2 if any(not x.endswith("place") for x in mine) else 0
        p += 1 if any(x.endswith("place") for x in mine) else 0
        if p:
            points[name] = p + min(len(mine), 9) / 10  # a tie goes to the country on more pages
    return sorted(points, key=lambda n: -points[n])


def country_verdict(domain: str, phones: Iterable[str], signals: Iterable[str],
                    targets: Sequence[str]) -> Tuple[str, bool]:
    """(country, in a target country). Any evidence for a target country is enough (as for India
    before); the country shown is that target, else the strongest other country found."""
    found = site_countries(domain, phones, signals)
    hit = next((n for n in found if n in targets), "")
    return hit or (found[0] if found else ""), bool(hit)
