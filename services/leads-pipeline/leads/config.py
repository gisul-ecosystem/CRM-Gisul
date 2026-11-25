"""Settings, read from environment variables (and a .env file if present).

The training profile (profile.py) reads .env.training for its own filters and takes only the
shared connection settings (bot name, tokens, Reacher...) from .env."""
import os
from dataclasses import dataclass
from pathlib import Path

from . import profile as _profile
from .geo import country_names

# Target countries when .env has no COUNTRIES line
DEFAULT_COUNTRIES = {_profile.GPU: "India,Malaysia,Singapore,Thailand,Indonesia",
                     _profile.TRAINING: "India,Malaysia,Singapore,Thailand,Indonesia",
                     _profile.COMPETITORS: "India"}


def _load_dotenv(path: Path = Path(".env"), skip=frozenset()) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() not in skip:
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


PROFILE = _profile.current()
_BASE_ENV = Path(os.getenv("ENV_FILE") or ".env")  # ENV_FILE: e.g. inside a Docker volume
if PROFILE == _profile.GPU:
    _load_dotenv(_BASE_ENV)
else:
    _load_dotenv(_BASE_ENV.with_name(_profile.env_name(PROFILE)))
    _load_dotenv(_BASE_ENV, skip=_profile.OWN_KEYS)  # shared connection settings only


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def _flag(name: str, default: str = "1") -> bool:
    return os.getenv(name, default).strip().lower() not in ("0", "false", "no", "")


@dataclass
class Settings:
    data_dir: Path
    github_token: str
    hf_token: str
    user_agent: str
    default_region: str
    batch_size: int
    domain_delay: float
    reacher_url: str
    reacher_secret: str
    max_candidates: int
    min_score: int
    alert_webhook_url: str
    india_only: bool = True  # drop companies with no presence in `countries` (INDIA_ONLY, the old name)
    countries: tuple = ("India",)  # target countries (geo.COUNTRIES), COUNTRIES in .env
    early_only: bool = True  # drop companies with evidence they are not early-stage
    domain_age: bool = False  # look up domain registration years (domain_age.py) as founding evidence
    max_age_years: int = 5   # founded longer ago than this = not early
    max_team_size: int = 50
    require_segment: bool = True  # drop companies whose site shows no GPU-related segment
    render_js: bool = True  # headless-browser fallback for JavaScript-only pages
    request_timeout: int = 15
    max_page_bytes: int = 1_500_000
    max_attempts: int = 3  # failed fetches before a domain is rejected
    max_people: int = 5       # decision makers kept per company
    round_size: int = 200     # companies taken through every step before they are added to the sheet
    workers: int = 6          # websites read at the same time (each site still gets one request at a time)
    early_exempt: tuple = ("vfx_animation", "gaming", "arch_viz", "competitor_clients")  # studios and competitor clients rent GPUs at any age
    brave_api_key: str = ""   # people search (people_search.py); empty = off
    serper_api_key: str = ""  # training search discovery: Serper (2,500 free searches, no card)
    tavily_api_key: str = ""  # training search discovery: Tavily (1,000 free a month, no card)
    search_max_per_run: int = 30  # Brave: $5 free credit a month = ~1,000 searches; 30/day stays inside it
    profile: str = "gpu"      # see profile.py
    small_only: bool = False  # training: drop large organisations (training.size_verdict)
    search_discovery_per_run: int = 0  # training: web searches for new organisations per run
    maps_per_run: int = 0     # Google Maps searches (Serper Places) per run, each profile its own


def _data_dir() -> Path:
    if PROFILE == _profile.GPU:
        return Path(os.getenv("DATA_DIR", "./data"))
    return Path(os.getenv(f"{PROFILE.upper()}_DATA_DIR") or Path(os.getenv("DATA_DIR") or "./data") / PROFILE)


def load_settings() -> Settings:
    gpu = PROFILE == _profile.GPU
    return Settings(
        profile=PROFILE,
        small_only=_flag("SMALL_ONLY", "1") if PROFILE == _profile.TRAINING else False,
        search_discovery_per_run=_int("SEARCH_DISCOVERY_PER_RUN", 40 if gpu else 60),  # each profile's own
        maps_per_run=_int("MAPS_PER_RUN", 40 if gpu else 60),
        data_dir=_data_dir(),
        github_token=os.getenv("GITHUB_TOKEN", ""),
        hf_token=os.getenv("HF_TOKEN", ""),
        user_agent=os.getenv("USER_AGENT", "GPULeadBot/1.0 (+mailto:you@example.com)"),
        default_region=os.getenv("DEFAULT_REGION", "IN"),
        batch_size=_int("BATCH_SIZE", 200),
        domain_delay=_float("DOMAIN_DELAY", 3.0),
        reacher_url=os.getenv("REACHER_URL", ""),
        reacher_secret=os.getenv("REACHER_SECRET", ""),
        max_candidates=_int("MAX_CANDIDATES", 4),
        min_score=_int("MIN_SCORE", 5),
        alert_webhook_url=os.getenv("ALERT_WEBHOOK_URL", ""),
        india_only=True if PROFILE == _profile.TRAINING else _flag("INDIA_ONLY", "1"),
        countries=country_names(os.getenv("COUNTRIES") or DEFAULT_COUNTRIES[PROFILE]) or ("India",),
        early_only=_flag("EARLY_ONLY", "1" if gpu else "0"),  # competitor clients & institutes can be any age
        domain_age=_flag("DOMAIN_AGE", "1" if gpu else "0"),
        require_segment=_flag("REQUIRE_SEGMENT"),
        render_js=_flag("RENDER_JS"),
        max_age_years=_int("MAX_AGE_YEARS", 5),
        max_team_size=_int("MAX_TEAM_SIZE", 50),
        max_people=_int("MAX_PEOPLE", 5),
        round_size=_int("ROUND_SIZE", 200),
        workers=max(1, _int("WORKERS", 6)),
        early_exempt=tuple(x.strip() for x in os.getenv(
            "EARLY_EXEMPT_SEGMENTS", "vfx_animation,gaming,arch_viz,competitor_clients" if gpu else "").split(",") if x.strip()),
        brave_api_key=os.getenv("BRAVE_API_KEY", ""),
        serper_api_key=os.getenv("SERPER_API_KEY", ""),
        tavily_api_key=os.getenv("TAVILY_API_KEY", ""),
        search_max_per_run=_int("SEARCH_MAX_PER_RUN", 30),
    )
