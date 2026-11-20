import re
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import tldextract

from .config import PARTNERS

COMPANY = PARTNERS["company"]
SUFFIX = COMPANY["suffix"]
WORD = r"[A-Z0-9][A-Za-z0-9&'.\-]*"
CONNECT = r"(?:\s+(?:of|and|&|dan))?"
VERBS = (r"wins?|won|bags?|secures?|secured|clinch(?:es|ed)?|lands?|landed|nabs?|gets?|receives?|received|inks?|"
         r"signs?|signed|awarded|named|appointed|selected|partners|joins|teams up|ties up|bagged|snags?|accepts?")
LEGAL = r"(?:,?\s+(?:Inc|LLC|L\.L\.C|Corp|Ltd|FZ-?LLC|FZE)\.?)?"
HEAD_COMPANY = re.compile(
    rf"^\s*((?:{WORD})(?:{CONNECT}\s+{WORD}){{0,5}}?{LEGAL})(?:'s|’s)?"
    rf"(?:\s+(?:unit|arm|subsidiary|consortium|JV))?"
    rf"\s+(?i:{VERBS}|announced as (?:the )?recipient of|named (?:as )?(?:the )?recipient of)\b")
AWARDS_COMPANY = re.compile(
    rf"\b(?i:awards?|selects?|taps|picks|chooses|contracts|engages|partners with|teams up with|"
    rf"collaborates with|ties up with|signs (?:an? )?(?:\w+ )?(?:agreement|mou|deal|contract|partnership) with|"
    rf"inks (?:an? )?(?:\w+ )?(?:agreement|mou|deal|contract|partnership) with)\s+"
    rf"((?:{WORD})(?:{CONNECT}\s+{WORD}){{0,5}}?{LEGAL})"
    rf"\s+(?i:a|an|nearly|up to|over|\$|US\$|AED|RM|S\$|\d|contract|deal|to|for|with|as|in|on)\b")
SUFFIX_COMPANY = re.compile(rf"\b((?:{WORD}\s+){{0,4}}{WORD}(?:\s+\(\w+\))?(?:\s+{SUFFIX}){{1,2}})(?![A-Za-z])")
SITE_TAIL = re.compile(r"\s+[|\-–—]\s+[^|\-–—]{2,40}$")
MONEY = re.compile(
    r"(?<![A-Za-z])(RM|S\$|SGD|USD|US\$|AED|Dhs?|A\$|AUD|INR|Rs\.?|₹|SAR|QAR|QR|Rp\.?|IDR|THB|\$)\s?"
    r"(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?"
    r"(trillion|triliun|billion|miliar|bil|bln|million|juta|mil|mln|mn|crore|cr|lakh|tn|b|m|k)?(?![A-Za-z])",
    re.I)
UNITS = {"trillion": 1_000_000, "triliun": 1_000_000, "tn": 1_000_000, "billion": 1000, "miliar": 1000,
         "bil": 1000, "bln": 1000, "b": 1000, "million": 1, "juta": 1, "mil": 1, "mln": 1, "mn": 1, "m": 1,
         "crore": 10, "cr": 10, "lakh": 0.1, "k": 0.001}
CURRENCY = {"rm": "RM", "s$": "S$", "sgd": "S$", "usd": "US$", "us$": "US$", "aed": "AED", "dh": "AED",
            "dhs": "AED", "a$": "A$", "aud": "A$", "inr": "₹", "rs": "₹", "rs.": "₹", "₹": "₹", "sar": "SAR",
            "qar": "QAR", "qr": "QAR", "rp": "Rp", "rp.": "Rp", "idr": "Rp", "thb": "THB"}


def usd_millions(value_millions, currency: str) -> float:
    rate = PARTNERS["size"]["usd_per_unit"].get(currency or "", 1)
    return (value_millions or 0) * rate


def _currency(symbol: str, country: str) -> str:
    if symbol != "$":
        return CURRENCY[symbol.lower()]
    own = PARTNERS["countries"].get(country, {}).get("currency", "")
    return own if own.endswith("$") else "US$"
MONTHS = {m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct",
                                      "nov", "dec"), 1)}
URL_DATE = re.compile(r"/(20\d\d)/(0[1-9]|1[0-2])(?:/([0-3]\d))?/")
ISO_DATE = re.compile(r"\b(20\d\d)-(0[1-9]|1[0-2])-([0-3]\d)\b")
MDY = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+([0-3]?\d),?\s+(20\d\d)\b", re.I)
DMY = re.compile(r"\b([0-3]?\d)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(20\d\d)\b", re.I)
AGO = re.compile(r"\b(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago\b", re.I)
AGO_DAYS = {"minute": 0, "hour": 0, "day": 1, "week": 7, "month": 30, "year": 365}


@lru_cache(maxsize=None)
def _word_rx(word: str) -> re.Pattern:
    stem = word.endswith("*")
    body = re.escape(word.rstrip("*").lower())
    return re.compile(rf"(?<![a-z0-9]){body}" + ("" if stem else r"(?:s|es)?(?![a-z0-9])"), re.I)


def has_word(text: str, word: str) -> bool:
    return bool(_word_rx(word).search(text))


def company_key(name: str) -> str:
    words = re.sub(r"[^a-z0-9& ]+", " ", (name or "").lower()).split()
    strip = set(COMPANY["strip_words"]) | {c.lower() for c in PARTNERS["countries"]} | {"m", "s"}
    kept = [w for w in words if w not in strip]
    return " ".join(kept or words)


@lru_cache(maxsize=None)
def _agency_names(country: str) -> frozenset:
    agencies = PARTNERS["countries"].get(country, {}).get("agencies", {})
    names = {label.lower() for label in agencies} | {a.lower() for aliases in agencies.values() for a in aliases}
    return frozenset(names | {company_key(n) for n in names})


def clean_company(raw: str, country: str = "") -> str:
    name = re.sub(r"\s+", " ", raw or "").strip(" ,.:;'\"’()-")
    name = re.sub(COMPANY["place_prefix"], "", name, flags=re.I)
    name = re.sub(r"^(?:the|a|an)\s+", "", name, flags=re.I)
    name = re.sub(r"(?:'s|’s)$", "", name)
    words = name.split()
    if not words or len(words) > COMPANY["max_name_words"]:
        return ""
    if re.fullmatch(r"\$?\d[\d.,]*[bmk%]?", words[0], re.I):
        return ""
    key = company_key(name)
    if len(key.replace(" ", "")) < COMPANY["min_key_chars"]:
        return ""
    if key in COMPANY["not_companies"] or name.lower() in COMPANY["not_companies"]:
        return ""
    if all(w.lower() in COMPANY["not_companies"] for w in key.split()):
        return ""
    if any(key == v or key.startswith(v + " ") for v in COMPANY["big_vendors"]):
        return ""
    if country and any(re.search(rx, name, re.I) and home != country for rx, home in COMPANY["legal_forms"]):
        return ""
    if key.split()[-1] in COMPANY["agency_tails"]:
        return ""
    if country and (key in _agency_names(country) or name.lower() in _agency_names(country)):
        return ""
    if any(has_word(name, w) for w in COMPANY["gov_words"]) or re.match(COMPANY["gov_acronym"], name):
        return ""
    if words[0].lower() in COMPANY["verb_starts"]:
        return ""
    if _starts_with_place(name) and not re.search(COMPANY["legal_form"], name, re.I):
        return ""
    return name


def _starts_with_place(name: str) -> bool:
    low = name.lower()
    places = [p for c in PARTNERS["countries"].values() for p in c["places"]] + list(PARTNERS["other_places"])
    return any(re.match(rf"{re.escape(p)}(?![a-z0-9])", low) for p in places)


def find_company(title: str, snippet: str, country: str = "") -> str:
    head = SITE_TAIL.sub("", title or "").strip()
    for text in (head, snippet or ""):
        order = (AWARDS_COMPANY, HEAD_COMPANY) if re.search(COMPANY["partner_verbs"], text, re.I) \
            else (HEAD_COMPANY, AWARDS_COMPANY)
        for rx in order:
            m = rx.search(text)
            if m:
                name = clean_company(m.group(1), country)
                if name:
                    return name
    for text in (head, snippet or ""):
        for m in SUFFIX_COMPANY.finditer(text):
            before = text[:m.start()].split()
            prev = before[-1].lower() if before else ""
            legal = re.search(COMPANY["legal_form"], m.group(1), re.I)
            if prev in COMPANY["verb_starts"] or (prev in COMPANY["suffix_skip_after"] and not legal):
                continue
            name = clean_company(m.group(1), country)
            if name:
                return name
    return ""


def find_value(text: str, country: str = "") -> Tuple[Optional[float], str]:
    best: Tuple[Optional[float], str] = (None, "")
    for m in MONEY.finditer(text or ""):
        number = float(m.group(2).replace(",", ""))
        unit = (m.group(3) or "").lower()
        if unit:
            millions = number * UNITS[unit]
        elif number >= 100_000:
            millions = number / 1_000_000
        else:
            continue
        if best[0] is None or millions > best[0]:
            best = (round(millions, 2), _currency(m.group(1), country))
    return best


def find_date(*texts: str, url: str = "", now: Optional[datetime] = None) -> str:
    now = now or datetime.now()
    m = URL_DATE.search(url or "")
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3) or '01'}"
    for text in texts:
        if not text:
            continue
        m = ISO_DATE.search(text)
        if m:
            return m.group(0)
        m = MDY.search(text)
        if m:
            return _ymd(m.group(3), m.group(1), m.group(2))
        m = DMY.search(text)
        if m:
            return _ymd(m.group(3), m.group(2), m.group(1))
        m = AGO.search(text)
        if m:
            return (now - timedelta(days=int(m.group(1)) * AGO_DAYS[m.group(2).lower()])).strftime("%Y-%m-%d")
    return ""


def _ymd(year: str, month: str, day: str) -> str:
    try:
        return datetime(int(year), MONTHS[month[:3].lower()], int(day)).strftime("%Y-%m-%d")
    except ValueError:
        return ""


def find_agency(text: str, country: str) -> str:
    agencies = PARTNERS["countries"].get(country, {}).get("agencies", {})
    for label, aliases in agencies.items():
        if any(has_word(text, a) for a in aliases):
            return label
    return ""


def without_name(text: str, company: str) -> str:
    out = re.sub(re.escape(company), " ", text, flags=re.I)
    first = company.split()[0] if company.split() else ""
    return re.sub(rf"\b{re.escape(first)}\b", " ", out, flags=re.I) if len(first) >= 3 else out


def display_name(name: str) -> str:
    if not name.isupper():
        return name
    forms = COMPANY["display_forms"]

    def word(m: re.Match) -> str:
        w = m.group(0)
        low = w.lower()
        if low in forms:
            return forms[low] if m.start() else forms[low].capitalize()
        word_like = low in COMPANY["display_small_words"] or re.match(COMPANY["display_word_shape"], low)
        if (len(w) <= 3 and not word_like) or not re.search(r"[aeiouy]", low):
            return w
        return w.capitalize()

    name = re.sub(r"\s+", " ", name).strip()
    return re.sub(r"[A-Za-z]+", word, name)


def short_name(name: str) -> str:
    stripped = re.sub(rf"(?:\s+{COMPANY['suffix']})+\s*$", "", name, flags=re.I).strip(" ,.")
    stripped = re.sub(r"\s*\((?:singapore|malaysia|m|s|asia pacific|sea)\)\s*", " ", stripped, flags=re.I).strip()
    return stripped or name


def find_sectors(text: str, wanted: List[str]) -> List[str]:
    return [s for s in wanted if any(has_word(text, w) for w in PARTNERS["sectors"][s]["words"])]


def find_signal(text: str, preferred: str, wanted: List[str]) -> str:
    counts = {s: sum(has_word(text, w) for w in PARTNERS["signals"][s]["words"]) for s in wanted}
    best = max(counts.values(), default=0)
    if not best:
        return ""
    if counts.get(preferred) == best:
        return preferred
    return next(s for s in wanted if counts[s] == best)


def domain_of(url: str) -> str:
    ext = tldextract.extract(url or "")
    return f"{ext.domain}.{ext.suffix}".lower() if ext.domain and ext.suffix else ""


def is_recent(date: str, months: int, now: Optional[datetime] = None) -> Optional[bool]:
    if not date:
        return None
    try:
        when = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return None
    return when >= (now or datetime.now()) - timedelta(days=months * 31)


def place_country(text: str) -> str:
    counts = {name: sum(has_word(text, w) for w in c["places"]) for name, c in PARTNERS["countries"].items()}
    best = max(counts, key=counts.get)
    if counts[best]:
        return best
    return "other" if any(has_word(text, w) for w in PARTNERS["other_places"]) else ""


def article_country(text: str, host: str, query_country: str) -> str:
    counts = {name: sum(has_word(text, w) for w in c["places"]) for name, c in PARTNERS["countries"].items()}
    for name, c in PARTNERS["countries"].items():
        if host in c["news_sites"] or host.rsplit(".", 1)[-1] == c["code"]:
            counts[name] += 1
    best = max(counts, key=counts.get)
    if counts[best] > counts[query_country]:
        return best
    if counts[query_country]:
        return query_country
    return "" if any(has_word(text, w) for w in PARTNERS["other_places"]) else query_country


def evidence_from(row: Dict[str, str], hit: Dict[str, str], spec: Dict, skip_domains: set) -> Optional[Dict]:
    url = row.get("url") or ""
    host = domain_of(url)
    if not host or host in skip_domains:
        return None
    text = f"{row.get('title', '')} {row.get('snippet', '')}"
    if any(has_word(text, w) for w in spec["exclude"]):
        return None
    country = article_country(text, host, hit["country"])
    if not country:
        return None
    company = find_company(row.get("title", ""), row.get("snippet", ""), country)
    if not company:
        return None
    signal = find_signal(text, hit["signal"], spec["signals"])
    sectors = find_sectors(without_name(text, company), spec["sectors"])
    if not signal or not sectors:
        return None
    value, currency = find_value(text, country)
    date = find_date(row.get("date", ""), row.get("snippet", ""), url=url)
    if is_recent(date, spec["months"]) is False:
        return None
    return {
        "company": company,
        "country": country,
        "signal": signal,
        "sectors": sectors,
        "agency": find_agency(text, country),
        "value_millions": value,
        "currency": currency,
        "date": date,
        "title": (row.get("title") or "")[:240],
        "snippet": (row.get("snippet") or "")[:PARTNERS["enrich"]["snippet_chars"]],
        "url": url,
        "source": row.get("source") or host,
    }


TITLE_PARTS = re.compile(r"\s+[|\-–—:·]\s+")


def is_public_site(url: str) -> bool:
    ext = tldextract.extract(url or "")
    parts = (ext.suffix or "").split(".") + (ext.domain or "").split(".")
    return bool({"gov", "mil", "edu", "ac"} & set(parts))


def name_from_site(title: str, host: str, country: str) -> str:
    stem = host.split(".")[0]
    for part in TITLE_PARTS.split(title or ""):
        part = re.sub(r"^(?:about(?:\s+us)?|welcome\s+to|home)\b\s*", "", part, flags=re.I).strip()
        tokens = [t for t in re.sub(r"[^a-z0-9 ]", " ", part.lower()).split() if len(t) >= 3]
        if any(t in stem or stem in t for t in tokens):
            name = clean_company(part, country)
            if name:
                return name
    return stem.capitalize() if len(stem) >= COMPANY["min_key_chars"] else ""


def company_page(url: str, title: str) -> bool:
    enrich = PARTNERS["enrich"]
    path = [p for p in (urlparse(url).path or "").lower().split("/") if p]
    first = re.sub(r"\.(?:html?|php|aspx?)$", "", path[0]) if path else ""
    if len(path) > 2 or first not in enrich["site_paths"]:
        return False
    if re.search(r"\(\s*20\d\d\s*\)|\b20\d\d\b", title or ""):
        return False
    return not any(has_word(title or "", w) for w in enrich["article_words"])


def client_agency(text: str, country: str) -> str:
    agency = find_agency(text, country)
    return "" if agency in PARTNERS["enrich"]["generic_agencies"] else agency


def evidence_from_site(row: Dict[str, str], hit: Dict[str, str], spec: Dict, skip_domains: set) -> Optional[Dict]:
    url = row.get("url") or ""
    host = domain_of(url)
    if not host or host in skip_domains or host in PARTNERS["enrich"]["extra_listing"] or is_public_site(url):
        return None
    if not company_page(url, row.get("title", "")):
        return None
    text = f"{row.get('title', '')} {row.get('snippet', '')}"
    if any(has_word(text, w) for w in spec["exclude"]):
        return None
    company = name_from_site(row.get("title", ""), host, hit["country"])
    if not company:
        return None
    agency = client_agency(without_name(text, company), hit["country"])
    return {
        "company": company,
        "country": hit["country"],
        "signal": hit["signal"],
        "sectors": find_sectors(without_name(text, company), spec["sectors"]) or [hit["sector"]],
        "agency": agency,
        "value_millions": None,
        "currency": "",
        "date": "",
        "title": (row.get("title") or "")[:240],
        "snippet": (row.get("snippet") or "")[:PARTNERS["enrich"]["snippet_chars"]],
        "url": url,
        "source": host,
        "domain": host,
        "needs_page": not agency,
    }


def enrich_from_page(ev: Dict, page_text: str, spec: Dict) -> Dict:
    text = page_text[:PARTNERS["enrich"]["page_chars"]]
    if ev.get("value_millions") is None:
        value, currency = find_value(text, ev["country"])
        if value is not None:
            ev["value_millions"], ev["currency"] = value, currency
    if not ev.get("agency"):
        ev["agency"] = find_agency(text, ev["country"])
    if not ev.get("date"):
        ev["date"] = find_date(text, url=ev["url"])
    ev["sectors"] = list(dict.fromkeys(ev["sectors"] + find_sectors(text, spec["sectors"])))
    return ev


def format_value(millions: Optional[float], currency: str) -> str:
    if millions is None:
        return ""
    if millions >= 1000:
        return f"{currency}{millions / 1000:.2f}".rstrip("0").rstrip(".") + " billion"
    if millions >= 1:
        return f"{currency}{millions:.2f}".rstrip("0").rstrip(".") + " million"
    return f"{currency}{millions * 1000:.0f}k"


def is_listed(names: List[str], evidence: List[Dict]) -> bool:
    text = " ".join(names + [f"{e.get('title', '')} {e.get('snippet', '')} {e.get('url', '')}" for e in evidence])
    if any(re.search(p, " ".join(names), re.I) for p in COMPANY["private_marks"]):
        return False
    return any(re.search(p, text, re.I) for p in COMPANY["listed_marks"])
