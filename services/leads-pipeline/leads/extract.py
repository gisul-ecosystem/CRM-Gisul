"""Rule-based extraction from HTML: emails, phones, decision makers, useful links.

No ML involved. Methods, roughly from most to least reliable:
  emails : mailto: links -> Cloudflare-obfuscated -> 'name [at] domain' -> plain regex
  phones : tel: links -> phonenumbers matcher on visible text
  people : JSON-LD Person/founder -> 'Name, Title' / 'Name is the CEO' text patterns
           -> card layout (name next to a title inside the same container)
"""
import json
import re
from typing import List
from urllib.parse import urljoin, urlparse

import phonenumbers
from bs4 import BeautifulSoup

from . import profile as _profile
from . import training as _training
from .early import founded_year
from .geo import page_signals
from .util import clean_name, extract_domain, looks_like_name

# ---------------------------------------------------------------- titles
_ATOM = (
    r"co-?founders?|founders?|ceo|chief executive officer|cto|chief technology officer|"
    r"cio|chief information officer|chief ai officer|chief scientist|managing director|"
    r"president|owner|"
    r"head of (?:ai|ml|machine learning|engineering|infrastructure|infra|platform|data|devops|research|"
    r"it|technology|studio|production|r&d|pipeline|rendering|cloud|cloud infrastructure|mlops|"
    r"ml infrastructure|ai infrastructure)|"
    r"studio head|vfx supervisor|cg supervisor|pipeline supervisor|technical director|it head|"
    r"it manager|game director|chief operating officer|coo|"
    r"vp,? (?:of )?(?:engineering|ai|infrastructure)|vice president,? (?:of )?engineering|"
    r"director of (?:engineering|ai|ml|infrastructure|technology)"
)
if _profile.current() == _profile.TRAINING:  # directors, heads of training, academic heads...
    _ATOM = _training.TITLE_ATOMS
TITLE_RE = re.compile(
    rf"\b(?:{_ATOM})(?:\s*(?:&|and|/|,)\s*(?:{_ATOM}))*\b", re.I
)
EXCLUDE_RE = re.compile(r"\b(advisor|adviser|investor|former|ex-|alumn|board member|mentor)\b", re.I)

NAME_TOK = r"[A-ZÀ-ÖØ-Þ][^\W\d_]+(?:['’\-][^\W\d_]+)?"
NAME_PAT = rf"{NAME_TOK}(?:\s+{NAME_TOK}){{1,3}}"
_T = f"(?i:{TITLE_RE.pattern})"  # title part is case-insensitive; names stay case-sensitive
# 'Jane Doe, CEO' / 'Jane Doe - Co-founder' / 'Jane Doe | CTO' / 'Jane Doe (Founder)'
# an optional degree may sit between name and title: 'Digvijay Singh, MSE Co-founder & CEO'
_DEGREE = r"(?:(?:Ph\.?\s?D|M\.?\s?D|MBA|MSE|MSc|MS|M\.?\s?Tech|B\.?\s?Tech|BE|ME|CA|CFA)\.?,?\s+)?"
NAME_THEN_TITLE = re.compile(rf"({NAME_PAT})\s*(?:,|-|–|—|\||\()\s*{_DEGREE}({_T})")
# 'Jane Doe is the CEO' / 'Jane Doe, our CTO'
NAME_IS_TITLE = re.compile(
    rf"({NAME_PAT})\s*(?:,|is|serves as|joined as|—|–|-)\s*(?i:the\s+|our\s+|a\s+|an\s+)?({_T})"
)
# 'CEO: Jane Doe' / 'Founder - Jane Doe'
TITLE_THEN_NAME = re.compile(rf"({_T})\s*(?::|-|–|—|\|)\s*({NAME_PAT})")

_PRIORITY = [
    (re.compile(r"founder|ceo|chief executive|owner|president|managing director", re.I), 0),
    (re.compile(r"cto|chief technology|cio|chief information|chief ai|chief scientist|studio head|"
                r"head of (?:it|technology|studio|infrastructure|infra|platform|devops|cloud|ml|ai|"
                r"machine learning|mlops)|vp,? (?:of )?(?:engineering|infrastructure)|it head|"
                r"vfx supervisor|technical director", re.I), 1),
]
if _profile.current() == _profile.TRAINING:
    _PRIORITY = _training.PRIORITY


def find_title(text: str) -> str:
    """First decision-maker title in the text, or ''. Ignores advisors/investors/former."""
    if not text or EXCLUDE_RE.search(text):
        return ""
    m = TITLE_RE.search(text)
    return m.group(0).strip() if m else ""


def title_priority(title: str) -> int:
    for rx, rank in _PRIORITY:
        if rx.search(title or ""):
            return rank
    return 2


# ---------------------------------------------------------------- emails
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}")
_OBFUSCATED_RE = re.compile(
    r"([A-Za-z0-9._%+\-]+)\s*[\[\(\{]\s*at\s*[\]\)\}]\s*([A-Za-z0-9\-]+(?:\s*[\[\(\{]?\s*(?:dot|\.)\s*[\]\)\}]?\s*[A-Za-z0-9\-]+)+)",
    re.I,
)
_JUNK_EMAIL = re.compile(
    r"(\.(png|jpe?g|gif|svg|webp|css|js)$|@2x|example\.|sentry|wixpress|your(name|email)|"
    r"yourdomain|domain\.com|email\.com$|^user@|^name@|^test@|noreply|no-reply|donotreply)",
    re.I,
)
GENERIC_LOCALS = {
    "info", "hello", "contact", "support", "sales", "team", "admin", "hi", "office", "mail",
    "enquiries", "enquiry", "inquiries", "inquiry", "founders", "careers", "jobs", "press",
    "media", "help", "billing", "privacy", "legal", "partners", "partnerships", "business",
    "biz", "marketing", "hey", "general", "customercare", "care", "feedback", "accounts",
}


def decode_cfemail(hexstr: str) -> str:
    """Decode Cloudflare's data-cfemail obfuscation."""
    try:
        key = int(hexstr[:2], 16)
        return "".join(chr(int(hexstr[i : i + 2], 16) ^ key) for i in range(2, len(hexstr), 2))
    except (ValueError, IndexError):
        return ""


def _valid_email(e: str) -> bool:
    return bool(e) and not _JUNK_EMAIL.search(e) and len(e) < 80 and "@" in e


def is_generic(email: str) -> bool:
    return email.split("@")[0].lower() in GENERIC_LOCALS


def find_emails(soup: BeautifulSoup) -> List[tuple]:
    """Return [(email, method)] with duplicates removed (first method wins)."""
    found, seen = [], set()

    def add(e, how):
        e = e.strip().strip(".,;:<>()[]\"'").lower()
        if _valid_email(e) and e not in seen:
            seen.add(e)
            found.append((e, how))

    for a in soup.find_all("a", href=True):
        h = a["href"]
        if h.lower().startswith("mailto:"):
            add(h[7:].split("?")[0], "mailto")
        elif "email-protection#" in h:
            add(decode_cfemail(h.split("#")[-1]), "cloudflare")
    for tag in soup.find_all(attrs={"data-cfemail": True}):
        add(decode_cfemail(tag["data-cfemail"]), "cloudflare")

    text = soup.get_text(" ")
    for m in _OBFUSCATED_RE.finditer(text):
        domain = re.sub(r"\s*[\[\(\{]?\s*dot\s*[\]\)\}]?\s*", ".", m.group(2), flags=re.I).replace(" ", "")
        add(f"{m.group(1)}@{domain}", "obfuscated")
    for m in _EMAIL_RE.finditer(text):
        add(m.group(0), "text")
    return found


# ---------------------------------------------------------------- phones
def find_phones(soup: BeautifulSoup, region: str, dialled_only: bool = False) -> List[str]:
    """Phone numbers in tel: links and the visible text. dialled_only: only those that show their
    country (tel: links, or text written with + / 00): a bare 10-digit ID or date in the text
    can read as a valid local number of `region`, which is no evidence of a country."""
    out, seen = [], set()

    def add(num):
        try:
            if phonenumbers.is_valid_number(num):
                s = phonenumbers.format_number(num, phonenumbers.PhoneNumberFormat.INTERNATIONAL)
                if s not in seen:
                    seen.add(s)
                    out.append(s)
        except Exception:
            pass

    for a in soup.find_all("a", href=True):
        if a["href"].lower().startswith("tel:"):
            raw = a["href"][4:].strip()
            try:
                add(phonenumbers.parse(raw, region))
            except phonenumbers.NumberParseException:
                continue
    text = soup.get_text(" ")
    for m in phonenumbers.PhoneNumberMatcher(text, region, leniency=phonenumbers.Leniency.VALID):
        if not dialled_only or m.raw_string.strip().startswith(("+", "00")):
            add(m.number)
    return out


# ---------------------------------------------------------------- people
def _walk_jsonld(node, out: list):
    if isinstance(node, list):
        for n in node:
            _walk_jsonld(n, out)
    elif isinstance(node, dict):
        t = node.get("@type")
        types = t if isinstance(t, list) else [t]
        if "Person" in types and node.get("name"):
            title = node.get("jobTitle") or ""
            out.append((clean_name(node["name"]), title, node.get("sameAs")))
        for key in ("founder", "founders", "employee", "member", "author"):
            val = node.get(key)
            if val:
                if key in ("founder", "founders"):
                    items = val if isinstance(val, list) else [val]
                    for it in items:
                        if isinstance(it, str):
                            out.append((clean_name(it), "Founder", None))
                        elif isinstance(it, dict) and it.get("name"):
                            out.append((clean_name(it["name"]), it.get("jobTitle") or "Founder", it.get("sameAs")))
                else:
                    _walk_jsonld(val, out)
        for v in node.values():
            if isinstance(v, (dict, list)):
                _walk_jsonld(v, out)


def _linkedin_in(node) -> str:
    if node is None:
        return ""
    for a in node.find_all("a", href=True):
        if "linkedin.com/in/" in a["href"]:
            return a["href"].split("?")[0]
    return ""


_COMPANY_LI_RE = re.compile(r"linkedin\.com/company/([A-Za-z0-9_%.\-]+)", re.I)


def find_company_linkedin(soup: BeautifulSoup) -> List[str]:
    """Company LinkedIn pages linked from this page (usually the footer), normalised."""
    out = []
    for a in soup.find_all("a", href=True):
        m = _COMPANY_LI_RE.search(a["href"])
        slug = m.group(1).strip(".").lower() if m else ""
        if slug and slug != "linkedin":
            out.append(f"https://www.linkedin.com/company/{slug}")
    return out


def find_people(soup: BeautifulSoup) -> List[dict]:
    """Return [{'name','title','linkedin','how'}] for decision makers only."""
    people: dict = {}

    def add(name, title, how, linkedin=""):
        name = clean_name(name)
        title = re.sub(r"\s+", " ", title or "").strip()
        if not looks_like_name(name):
            return
        t = find_title(title)
        if not t:
            return
        key = name.lower()
        if key not in people or title_priority(t) < title_priority(people[key]["title"]):
            people[key] = {"name": name, "title": t, "linkedin": linkedin, "how": how}
        elif linkedin and not people[key]["linkedin"]:
            people[key]["linkedin"] = linkedin

    # 1) JSON-LD
    for sc in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(sc.string or sc.get_text() or "")
        except (ValueError, TypeError):
            continue
        found: list = []
        _walk_jsonld(data, found)
        for name, title, same_as in found:
            li = ""
            sa = same_as if isinstance(same_as, list) else [same_as] if same_as else []
            for u in sa:
                if isinstance(u, str) and "linkedin.com/in/" in u:
                    li = u
            add(name, title, "jsonld", li)

    # 2) text patterns over each short text block
    for s in soup.find_all(string=True):
        if s.parent and s.parent.name in ("script", "style", "noscript", "head", "title"):
            continue
        txt = re.sub(r"\s+", " ", str(s)).strip()
        if not txt or len(txt) > 300 or EXCLUDE_RE.search(txt) or not TITLE_RE.search(txt):
            continue
        for rx, order in ((NAME_THEN_TITLE, "nt"), (NAME_IS_TITLE, "nt"), (TITLE_THEN_NAME, "tn")):
            for m in rx.finditer(txt):
                name, title = (m.group(1), m.group(2)) if order == "nt" else (m.group(2), m.group(1))
                add(name, title, "text-pattern")

    # 3) card layout: a short title string with a name-like string nearby in the same container
    for s in soup.find_all(string=TITLE_RE):
        txt = re.sub(r"\s+", " ", str(s)).strip()
        if not txt or len(txt) > 90 or EXCLUDE_RE.search(txt):
            continue
        if s.parent and s.parent.name in ("script", "style", "noscript", "head", "title"):
            continue
        container = s.parent
        for _ in range(3):
            if container is None or container.name in ("body", "html", "[document]"):
                container = None
                break
            titles_here = [x for x in container.find_all(string=TITLE_RE)
                           if not EXCLUDE_RE.search(str(x)) and len(str(x).strip()) <= 90]
            if len(titles_here) > 1:
                container = None  # we've climbed into a multi-person block
                break
            strings = [str(x).strip() for x in container.find_all(string=True)
                       if x.parent.name not in ("script", "style", "noscript")]
            idx = next((i for i, x in enumerate(container.find_all(string=True)) if x is s), None)
            if idx is not None and len(strings) >= 2:
                order = []
                for off in range(1, len(strings)):
                    if idx - off >= 0:
                        order.append(idx - off)
                    if idx + off < len(strings):
                        order.append(idx + off)
                for j in order:
                    cand = strings[j]
                    if cand and looks_like_name(cand):
                        add(cand, txt, "card", _linkedin_in(container))
                        break
                else:
                    container = container.parent
                    continue
                break
            container = container.parent
    return list(people.values())


# ---------------------------------------------------------------- links
_LINK_KEYWORDS = re.compile(
    r"about|team|people|company|contact|founder|leadership|who-we-are|our-story|management|story",
    re.I,
)


def find_links(soup: BeautifulSoup, base_url: str, limit: int = 6) -> List[str]:
    """Same-site links that probably lead to team/about/contact pages."""
    base_domain = extract_domain(base_url)
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        url = urljoin(base_url, href).split("#")[0]
        p = urlparse(url)
        if p.scheme not in ("http", "https") or extract_domain(url) != base_domain:
            continue
        label = f"{p.path} {a.get_text(' ', strip=True)}"
        if _LINK_KEYWORDS.search(label) and url not in seen and len(p.path) < 60:
            seen.add(url)
            out.append(url)
            if len(out) >= limit:
                break
    return out


DEFAULT_PATHS = ("/about", "/team", "/contact", "/company", "/about-us", "/contact-us")


def parse_page(html: str, url: str, region: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ")
    return {
        "emails": find_emails(soup),
        "phones": find_phones(soup, region),
        "dialled": find_phones(soup, region, dialled_only=True),  # country evidence (geo.py)
        "people": find_people(soup),
        "links": find_links(soup, url),
        "india": page_signals(text),
        "founded": founded_year(text),
        "text": text[:20000],
        "hrefs": [urljoin(url, a["href"]) for a in soup.find_all("a", href=True)],
        "company_linkedin": find_company_linkedin(soup),
    }
