"""Is a company an early-stage startup?

Evidence, from whichever source has it:
  founded    year founded (seed lists, CIN incorporation year, "founded in 2021", copyright
             years on the website, YC batch year)
  stage      last funding round (pre-seed / seed / angel / pre-series a / series a / series b...),
             or what the company's own website says about its funding (site_evidence): a
             large fund as investor ('big investor') or a large amount raised ('raised $5M+')
  team_size  headcount (YC; "team of 200" on the website)

The `early` column is 'yes' (evidence it is early), 'no' (evidence it is not) or ''
(unknown). EARLY_ONLY=1 drops 'no'. Thresholds come from settings: MAX_AGE_YEARS,
MAX_TEAM_SIZE; Series A and later count as not early (we look for pre-seed to pre-Series A
companies: past that they have cloud deals and credits of their own).
"""
import re
from datetime import date
from typing import Optional, Tuple

_ROUNDS = [  # (regex, normalised name, early?)
    (r"pre[- ]?seed", "pre-seed", True),
    (r"angel", "angel", True),
    (r"(?<!pre-)(?<!pre )(?<!pre)seed", "seed", True),  # not the 'seed' inside 'pre-seed'
    (r"pre[- ]?series[- ]?a", "pre-series a", True),
    (r"(?<!pre-)(?<!pre )series[- ]?a\b", "series a", False),
    (r"series[- ]?b", "series b", False),
    (r"series[- ]?c", "series c", False),
    (r"series[- ]?[d-h]\b", "series d+", False),
    (r"\bipo\b|listed on (?:the )?(?:nse|bse)|public listing|pre[- ]ipo", "ipo", False),
]
_ROUND_RES = [(re.compile(rf"\b(?:{rx})", re.I), name, early) for rx, name, early in _ROUNDS]
EARLY_ROUNDS = {name for _, name, early in _ROUNDS if early}
BIG_INVESTOR, RAISED_BIG = "big investor", "raised $5M+"
# Later evidence wins when facts are merged (store.merge_evidence)
STAGE_ORDER = [n for _, n, _ in _ROUNDS[:5]] + [BIG_INVESTOR, RAISED_BIG] + [n for _, n, _ in _ROUNDS[5:]]

# Funds that back grown companies (seed funds left out on purpose): a startup naming one as its
# investor is past the stage we look for. Case-sensitive, matched only in funding sentences.
BIG_INVESTORS = [
    "Peak XV", "Sequoia", "Lightspeed", "Accel", "Tiger Global", "SoftBank", "Khosla", "Bessemer",
    "General Catalyst", "Prosus", "Elevation Capital", "Nexus Venture", "Matrix Partners", "Z47",
    "Temasek", "GIC", "Andreessen", "a16z", "Insight Partners", "Steadview", "Alpha Wave", "Tencent",
    "Jungle Ventures", "Openspace", "Vertex Growth", "Granite Asia", "GGV", "Northstar", "Alpha JWC",
]
MAX_RAISED_USD_M = 5  # raised this much or more: not early
_FUNDING_SENTENCE = re.compile(
    r"[^.!?\n]{0,250}\b(?:raised?|raises|raising|funding|funded|round|backed|investors?|invested|"
    r"led by|participation|secured|bags)\b[^.!?\n]{0,250}", re.I)
_BIG_RE = re.compile(r"\b(?:" + "|".join(re.escape(n) for n in BIG_INVESTORS) + r")\b")
_AMOUNT_RE = re.compile(r"(?:US\$|\$|USD|INR|Rs\.?|₹)\s?(\d+(?:\.\d+)?)\s?(million|mn|m|crore|cr|billion|bn)\b", re.I)
_TO_USD_M = {"million": 1, "mn": 1, "m": 1, "crore": 0.12, "cr": 0.12, "billion": 1000, "bn": 1000}
_TEAM_RE = re.compile(
    r"\b(?:we are|we're|our team (?:of|is)|team of|family of)\s+(?:over\s+|more than\s+)?(\d{2,5})\b"
    r"|\b(\d{2,5})\s*\+?\s*[- ](?:member|strong) team\b", re.I)

_CIN_RE = re.compile(r"\b[LU]\d{5}[A-Z]{2}((?:19|20)\d{2})(?:PTC|PLC|OPC|FTC|NPL|ULL|ULT)\d{6}\b")
# Only words that state a founding date. "since" / "started" / "launched" are left out on purpose:
# testimonials and case studies use them ("I have known the founders since 2017").
_FOUNDED_RE = re.compile(
    r"\b(?:founded|established|incorporated|est\.)\s+(?:in\s+)?"
    r"(?:[A-Z][a-z]+\s+)?((?:19|20)\d{2})\b", re.I)
_COPYRIGHT_RE = re.compile(r"(?:©|&copy;|\(c\)|copyright)\s*((?:19|20)\d{2})\s*[-–—]\s*(?:19|20)\d{2}", re.I)


def round_stage(text: str) -> str:
    """Latest funding round named in the text, normalised ('' if none). Later rounds win
    ('Series B after a seed round' -> 'series b')."""
    found = [(i, name) for i, (rx, name, _) in enumerate(_ROUND_RES) if rx.search(text or "")]
    return max(found)[1] if found else ""


def site_evidence(text: str) -> Tuple[str, Optional[int]]:
    """(stage, team_size) from a company's own pages. Only sentences about funding are read for
    rounds, investors and amounts (a bare "seed" or "angel" elsewhere means nothing)."""
    funding = " . ".join(m.group(0) for m in _FUNDING_SENTENCE.finditer(text or ""))
    stage = round_stage(funding)
    if stage in ("", "series a") or stage in EARLY_ROUNDS:  # a later round already says enough
        raised = max((float(n) * _TO_USD_M[u.lower()] for n, u in _AMOUNT_RE.findall(funding)), default=0)
        if _BIG_RE.search(funding):
            stage = BIG_INVESTOR
        elif raised >= MAX_RAISED_USD_M:
            stage = RAISED_BIG
    teams = [int(a or b) for a, b in _TEAM_RE.findall(text or "")]
    return stage, max(teams) if teams else None


def founded_year(text: str) -> Optional[int]:
    """Best guess at the founding year from page text: CIN > 'founded in' > copyright range."""
    text = text or ""
    this_year = date.today().year
    for rx in (_CIN_RE, _FOUNDED_RE, _COPYRIGHT_RE):
        years = [int(m.group(1)) for m in rx.finditer(text)]
        years = [y for y in years if 1950 <= y <= this_year]
        if years:
            return min(years)
    return None


def year_from_batch(batch: str) -> Optional[int]:
    m = re.search(r"((?:19|20)\d{2})", batch or "")
    return int(m.group(1)) if m else None


def verdict(founded: Optional[int] = None, stage: str = "", team_size: Optional[int] = None,
            max_age_years: int = 8, max_team: int = 150) -> str:
    """'no' if any evidence says mature, 'yes' if there is evidence it is early, else ''."""
    oldest_ok = date.today().year - max_age_years
    if founded and founded < oldest_ok:
        return "no"
    if stage and stage not in EARLY_ROUNDS:
        return "no"
    if team_size and team_size > max_team:
        return "no"
    if founded or stage or team_size:
        return "yes"
    return ""
