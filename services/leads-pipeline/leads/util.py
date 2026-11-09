"""Small shared helpers: logging, domain handling, name validation."""
import contextlib
import logging
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import tldextract

_extract = tldextract.TLDExtract(suffix_list_urls=())  # use bundled list, no network

_BLOCKLIST_FILE = Path(__file__).parent / "blocklist.txt"
_ESTABLISHED_FILE = Path(__file__).parent / "established.txt"
_BAD_TLDS = {"edu", "gov", "mil", "int"}
_BAD_SUFFIX_PARTS = ("ac.", "edu.", "gov.", "sch.")


def setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        stream=sys.stdout,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _load_blocklist(path: Path = _BLOCKLIST_FILE) -> set:
    out = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip().lower()
        if line and not line.startswith("#"):
            out.add(line)
    return out


BLOCKLIST = _load_blocklist()
ESTABLISHED = _load_blocklist(_ESTABLISHED_FILE)  # past the early stage: dropped when EARLY_ONLY=1


def extract_domain(url_or_host: str) -> str:
    """Return the registered domain (example.co.in) or '' if not parseable."""
    if not url_or_host:
        return ""
    s = url_or_host.strip()
    if "://" not in s:
        s = "http://" + s
    host = urlparse(s).hostname or ""
    ext = _extract(host)
    if not ext.domain or not ext.suffix:
        return ""
    return f"{ext.domain}.{ext.suffix}".lower()


def host_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def is_blocked(domain: str, extra: set = frozenset()) -> bool:
    """True for big companies, platforms, job boards, free hosts, edu/gov."""
    if not domain:
        return True
    d = domain.lower()
    if d in BLOCKLIST or d in extra:
        return True
    suffix = _extract(d).suffix
    if suffix.split(".")[-1] in _BAD_TLDS:
        return True
    if any(suffix.startswith(p) for p in _BAD_SUFFIX_PARTS):
        return True
    return False


_NAME_STOPWORDS = {
    "our", "team", "meet", "the", "about", "us", "company", "contact", "careers", "join",
    "founder", "founders", "co", "ceo", "cto", "cio", "coo", "cfo", "chief", "head", "of",
    "and", "officer", "executive", "president", "director", "managing", "owner", "partner",
    "engineer", "engineering", "product", "marketing", "sales", "design", "designer",
    "leadership", "advisor", "advisors", "board", "investor", "investors", "read", "more",
    "linkedin", "twitter", "github", "email", "view", "profile", "learn", "get", "started",
    "privacy", "terms", "login", "sign", "blog", "pricing", "docs", "home", "careers",
    "ai", "inc", "llc", "ltd", "pvt", "private", "limited", "technologies", "labs",
    # seen as fake "names" next to titles on live sites ("Global Strategy", "CDSCO Approved")
    "global", "strategy", "strategic", "partnership", "partnerships", "approved", "technical",
    "transfer", "north", "south", "east", "west", "america", "europe", "asia", "india", "africa",
    "cloud", "google", "microsoft", "amazon", "organic", "farmer", "research", "development",
    "business", "operations", "solutions", "services", "innovation", "scientific", "clinical",
    "medical", "regulatory", "quality", "finance", "human", "resources", "corporate", "affairs",
    "international", "national", "group", "team's", "office", "lab", "laboratory", "center",
    "centre", "institute", "university", "foundation", "ventures", "capital", "fund",
    # button labels and descriptions taken for names ("Find Guests", "Serial Entrepreneur")
    "find", "guest", "guests", "serial", "entrepreneur", "entrepreneurs", "speaker", "speakers",
    "visit", "website", "watch", "video", "podcast", "episode", "news", "press", "media", "events",
    "event", "webinar", "download", "brochure", "apply", "now", "here", "click", "explore", "see",
    "all", "know", "story", "stories", "case", "study", "studies", "award", "awards", "winner",
    # seen on training sites next to titles ("Toll Free No", "UX Researcher", "Career Paths In")
    "corporation", "corp", "researcher", "career", "careers", "paths", "path", "toll", "free", "no",
    "health", "course", "courses", "program", "programme", "batch", "admission", "admissions",
    "student", "students", "learner", "learners", "placement", "placements", "online", "campus",
    "block", "chain", "alliance", "alliances", "cohort", "cohorts", "next", "science", "sciences",
    "life", "academic", "academics", "certificate", "degree", "diploma", "late",
    # job titles read as names ("Senior Consultant", "Solution Architect", "S Manager")
    "senior", "junior", "consultant", "consultants", "solution", "solutions", "architect", "manager",
    "managers", "executive", "associate", "analyst", "specialist", "coordinator", "trainer", "trainers",
    "faculty", "mentor", "mentors", "instructor", "developer", "lead", "intern", "counsellor", "counselor",
}
_HONORIFIC = re.compile(r"^(?:dr|mr|mrs|ms|miss|prof|er|sri|shri|smt)\.?\s+", re.I)


def person_key(name: str) -> str:
    """'Dr. Chintan Raval' and 'CHINTAN RAVAL' are the same person."""
    n = re.sub(r"\s+", " ", (name or "")).strip()
    while _HONORIFIC.match(n):
        n = _HONORIFIC.sub("", n, count=1)
    return n.lower()

_TOKEN_RE = re.compile(r"^[^\W\d_][^\W\d_'’.\-]*(?:['’\-][^\W\d_]+)*\.?$", re.UNICODE)


def looks_like_name(text: str) -> bool:
    """Heuristic: 2-4 capitalised alphabetic tokens, none of them a stopword."""
    text = (text or "").strip().strip(",.:;-–—|")
    if not text or len(text) > 50:
        return False
    tokens = text.split()
    if not 2 <= len(tokens) <= 4:
        return False
    for t in tokens:
        if not _TOKEN_RE.match(t):
            return False
        if not t[0].isupper():
            return False
        if t.lower().strip(".") in _NAME_STOPWORDS:
            return False
    return True


def clean_name(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip().strip(",.:;-–—|()[]")


def split_name(full_name: str):
    """Return (first, last) lowercase ASCII-ish parts for email patterns."""
    import unicodedata

    parts = [p for p in re.split(r"\s+", clean_name(full_name)) if p]
    parts = [p for p in parts if not re.match(r"^(dr|mr|mrs|ms|prof)\.?$", p, re.I)]
    if len(parts) < 2:
        return "", ""

    def norm(s):
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z]", "", s.lower())

    return norm(parts[0]), norm(parts[-1])


class TimeLimit(BaseException):
    """Raised when time_limit() runs out. A BaseException, so the many `except Exception`
    blocks inside scraping code cannot swallow it."""


@contextlib.contextmanager
def time_limit(seconds: int):
    """Abort the block after `seconds` (Linux/macOS, main thread). Elsewhere it does nothing."""
    import signal
    import threading

    if not hasattr(signal, "SIGALRM") or threading.current_thread() is not threading.main_thread():
        yield
        return

    def _expired(signum, frame):
        raise TimeLimit()

    old = signal.signal(signal.SIGALRM, _expired)
    signal.alarm(max(1, int(seconds)))
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)
