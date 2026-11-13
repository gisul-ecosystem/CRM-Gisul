"""JSON API for the CRM: status, runs, leads, downloads and settings. Started with python -m leads.web."""
import json
import os
import re
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from flask import Flask, jsonify, request, send_file
from .config import DEFAULT_COUNTRIES
from .custom_search import CUSTOM_SEARCH, SpecError, parse_spec, read_history, write_spec
from .geo import COUNTRIES
from .people_search import google_url
from .profile import GPU, LABELS, OWN_KEYS, TRAINING, COMPETITORS, env_name
from .segments import GPU_SEGMENTS, TRAINING_SEGMENTS, COMPETITOR_SEGMENTS
from .store import fill_country, to_xlsx

try:
    import fcntl
except ImportError:  # Windows
    fcntl = None
    import msvcrt

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ["seeds", "incubators", "search", "maps", "funding", "github", "huggingface", "hn"]  # GPU; yc stays off
TRAINING_SOURCES = ["seeds", "directories", "search", "maps", "funding", "github"]  # its own lists only
COMPETITORS_SOURCES = ["competitors", "seeds", "search"]
SEGMENTS = GPU_SEGMENTS
INTENTS = ["high", "medium", "low"]
PREVIEW_COLUMNS = ["company", "country", "full_name", "title", "email", "verified_status", "intent", "segment",
                   "score", "ready"]
LOG_LINES = 80

# .env settings the page can change: key -> (kind, label, extra)
FLAGS = {
    "INDIA_ONLY": "Only companies in the countries ticked below",
    "EARLY_ONLY": "Only early-stage startups",
    "DOMAIN_AGE": "Use the website's domain registration year as founding year (drops old companies)",
    "REQUIRE_SEGMENT": "Drop companies with no GPU-type segment (seed lists always kept)",
    "RENDER_JS": "Open JavaScript-built pages in a headless browser",
}
NUMBERS = {  # key -> (label, min, max)
    "MAX_AGE_YEARS": ("Max company age (years)", 1, 50),
    "MAX_TEAM_SIZE": ("Max team size", 1, 100000),
    "BATCH_SIZE": ("Companies per run", 1, 5000),
    "WORKERS": ("Websites read at the same time (1 = one by one)", 1, 16),
    "ROUND_SIZE": ("Companies per round (each round is added to the sheet when done)", 10, 5000),
    "MIN_SCORE": ("Score needed for ready=yes", 0, 20),
    "DOMAIN_DELAY": ("Seconds between requests to one site", 0.5, 60),
    "MAX_PEOPLE": ("Decision makers kept per company", 1, 10),
    "SEARCH_DISCOVERY_PER_RUN": ("Web searches for new organisations per run (Serper, Tavily or Brave key)", 0, 1000),
    "MAPS_PER_RUN": ("Google Maps searches per run (Serper key; 1 credit each)", 0, 1000),
    "SEARCH_MAX_PER_RUN": ("People searches per run (Brave free credit: ~1,000 a month, so 30/day)", 0, 5000),
}
TEXTS = {
    "USER_AGENT": "Bot name and contact (User-Agent)",
    "REACHER_URL": "Reacher URL (empty = MX check only)",
    "RUN_AT": "Daily run time, HH:MM (empty = off; Docker uses this, a plain server uses cron)",
}
# Each tab of the page is one profile (profile.py): its own data, settings, sources and rules.
TRAINING_FLAGS = {  # target countries only: always on for this profile, so not a checkbox
    "SMALL_ONLY": "Only small & medium organisations (drops 50k+ learners, 10+ branches, 300+ staff, listed companies)",
    "REQUIRE_SEGMENT": "Drop organisations that do not run training (seed lists always kept)",
    "EARLY_ONLY": "Only young organisations (usually off: institutes of any age need labs)",
    "RENDER_JS": "Open JavaScript-built pages in a headless browser",
}
COMPETITORS_FLAGS = {
    "INDIA_ONLY": "Only companies in the countries ticked below",
    "EARLY_ONLY": "Only early-stage companies (usually off: companies of any age rent GPUs)",
    "REQUIRE_SEGMENT": "Drop companies with no competitor/cloud segment",
    "RENDER_JS": "Open JavaScript-built pages in a headless browser",
}
PROFILES = {
    GPU: dict(label=LABELS[GPU], sources=SOURCES, segments=GPU_SEGMENTS, flags=FLAGS, exempt=True,
              intent="Renting intent", flag_defaults={}, noun="startups", startup_fields=True,
              incubators="Incubators, best first", list_file="leads/incubators.csv", list_col="Incubator"),
    TRAINING: dict(label=LABELS[TRAINING], sources=TRAINING_SOURCES, segments=TRAINING_SEGMENTS,
                   flags=TRAINING_FLAGS, exempt=False, intent="Need for lab VMs",
                   flag_defaults={"EARLY_ONLY": "0"}, noun="organisations", startup_fields=False,
                   incubators="Directory pages, best first", list_file="leads/training_directories.csv",
                   list_col="Directory page"),
    COMPETITORS: dict(label=LABELS[COMPETITORS], sources=COMPETITORS_SOURCES, segments=COMPETITOR_SEGMENTS,
                      flags=COMPETITORS_FLAGS, exempt=True, intent="Renting intent",
                      flag_defaults={"EARLY_ONLY": "0"}, noun="clients", startup_fields=True,
                      incubators="Competitor Cloud Providers, best first", list_file="leads/competitors.csv",
                      list_col="Provider"),
}
SECRETS = {"GITHUB_TOKEN": "GitHub token",
           "SERPER_API_KEY": "Serper API key (training search: 2,500 free searches, no card)",
           "TAVILY_API_KEY": "Tavily API key (training search: 1,000 free a month, no card)",
           "BRAVE_API_KEY": "Brave Search API key (people search; also training search if no Serper/Tavily key)"}
DEFAULTS = {"MAX_AGE_YEARS": "5", "MAX_TEAM_SIZE": "50", "BATCH_SIZE": "200", "MIN_SCORE": "5",
            "DOMAIN_DELAY": "3", "SEARCH_MAX_PER_RUN": "30", "MAX_PEOPLE": "5", "ROUND_SIZE": "200", "WORKERS": "6", "SEARCH_DISCOVERY_PER_RUN": "40", "MAPS_PER_RUN": "40"}  # same as config.py, for an older .env without these lines
LISTS = {"SEGMENTS": list(SEGMENTS), "SKIP_SOURCES": SOURCES, "EARLY_EXEMPT_SEGMENTS": list(SEGMENTS),
         "COUNTRIES": list(COUNTRIES)}
OTHER_COUNTRY = "Other / unknown"  # filter choice: rows whose country is none of COUNTRIES
SETTING_KEYS = set(FLAGS) | set(TRAINING_FLAGS) | set(COMPETITORS_FLAGS) | set(NUMBERS) | set(TEXTS) | set(SECRETS) | set(LISTS)
SHARED_KEYS = {"USER_AGENT", "REACHER_URL"} | set(SECRETS)  # edited on the GPU tab, used by both tabs
STARTUP_NUMBERS = {"MAX_AGE_YEARS", "MAX_TEAM_SIZE"}  # early-stage limits: GPU tab only
TRAINING_NUMBERS = set()  # (search discovery is on both tabs now, each with its own value)


# ---------- .env ----------
def read_env(path: Path) -> Dict[str, str]:
    """Same parsing as config._load_dotenv."""
    out = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def write_env(path: Path, updates: Dict[str, str]) -> None:
    """Change KEY=value lines in place (comments and other keys untouched); add missing keys."""
    if not path.exists() and path.with_name(".env.example").exists():
        path.write_text(path.with_name(".env.example").read_text(encoding="utf-8"), encoding="utf-8")
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    left = dict(updates)
    for i, line in enumerate(lines):
        key = line.split("=", 1)[0].strip()
        if "=" in line and not line.lstrip().startswith("#") and key in left:
            lines[i] = f"{key}={left.pop(key)}"
    lines += [f"{k}={v}" for k, v in left.items()]
    tmp = path.with_suffix(".tmp")
    tmp.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def parse_settings(form, current: Dict[str, str], prof: str = GPU) -> Dict[str, str]:
    """Form -> validated .env values. Raises ValueError with a readable message. The training
    tab has no shared connection fields and no early-stage exemptions."""
    cfg = PROFILES[prof]
    out = {}
    for key in cfg["flags"]:
        out[key] = "1" if form.get(key) else "0"
    for key, (label, lo, hi) in NUMBERS.items():
        if key in STARTUP_NUMBERS and not cfg["startup_fields"]:
            continue
        if key in TRAINING_NUMBERS and cfg["startup_fields"]:
            continue
        raw = (form.get(key) or "").strip()
        try:
            val = float(raw)
        except ValueError:
            raise ValueError(f"{label}: '{raw}' is not a number")
        if not lo <= val <= hi:
            raise ValueError(f"{label}: must be between {lo} and {hi}")
        out[key] = raw if key == "DOMAIN_DELAY" else str(int(val))
    for key in TEXTS:
        if prof == GPU or key not in SHARED_KEYS:
            out[key] = (form.get(key) or "").strip()
    if out.get("RUN_AT") and not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", out["RUN_AT"]):
        raise ValueError("Daily run time: use HH:MM, e.g. 02:00")
    for key in SECRETS if prof == GPU else ():  # blank keeps the saved one; the page never shows it
        new = (form.get(key) or "").strip()
        out[key] = "" if form.get(key + "_clear") else (new or current.get(key, ""))
    lists = {"SEGMENTS": list(cfg["segments"]), "SKIP_SOURCES": cfg["sources"]}
    if cfg["exempt"]:
        lists["EARLY_EXEMPT_SEGMENTS"] = list(cfg["segments"])
    for key, allowed in lists.items():
        picked = [x for x in form.getlist(key) if x in allowed]
        if key == "EARLY_EXEMPT_SEGMENTS" and not picked:
            picked = ["none"]  # nothing exempt (an empty value would mean the default list)
        if key == "SEGMENTS" and len(picked) == len(allowed):
            picked = []  # all ticked = no restriction
        out[key] = ",".join(picked)
    if not out["SEGMENTS"] and not form.getlist("SEGMENTS"):
        raise ValueError("Tick at least one segment")
    out["COUNTRIES"] = ",".join(c for c in COUNTRIES if c in form.getlist("COUNTRIES"))
    if not out["COUNTRIES"]:
        raise ValueError("Tick at least one country")
    if set(out["SKIP_SOURCES"].split(",")) >= set(cfg["sources"]):
        raise ValueError("At least one source must stay on")
    for key, val in out.items():
        if "\n" in val or "\r" in val:
            raise ValueError(f"{key}: no line breaks allowed")
    return out


# ---------- sheet ----------
def load_sheet(xlsx: Path) -> pd.DataFrame:
    if not xlsx.exists():
        return pd.DataFrame()
    return pd.read_excel(xlsx, dtype=str, keep_default_na=False)


def _has_any(col: pd.Series, wanted: List[str]) -> pd.Series:
    wanted = set(wanted)
    return col.str.split(", ").apply(lambda xs: bool(wanted & set(xs)))


def row_key(df: pd.DataFrame) -> pd.Series:
    return df["domain"] + "|" + df["full_name"]


def ready_key(df: pd.DataFrame) -> pd.Series:
    return df["domain"] + "|" + df["full_name"] + "|" + df["email"]


def load_last_run(data_dir: Path) -> dict:
    try:
        return json.loads((data_dir / "new" / "last_run.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def filter_sheet(df: pd.DataFrame, args, last_run: Optional[dict] = None) -> pd.DataFrame:
    if df.empty:
        return df
    df = fill_country(df.copy())
    if args.get("latest"):  # rows the latest run added (new company/person, or newly ready)
        last_run = last_run or {}
        df = df[row_key(df).isin(set(last_run.get("new_rows", [])))
                | ready_key(df).isin(set(last_run.get("new_ready_keys", [])))]
    df["_score"] = pd.to_numeric(df["score"], errors="coerce").fillna(0)
    df["_intent"] = pd.to_numeric(df["intent_score"], errors="coerce").fillna(0)
    if args.get("ready"):
        df = df[df["ready"] == "yes"]
    if args.get("has_email"):
        df = df[df["email"] != ""]
    if args.get("no_email"):  # to complete by hand: phone, people, LinkedIn link, Find-on-LinkedIn link
        df = df[df["email"] == ""]
        if args.get("no_email") == "company":  # organisations where nothing at all has an email
            with_email = set(df.loc[df["email"] != "", "domain"])
            df = df[~df["domain"].isin(with_email)]
    if args.get("has_person"):
        df = df[df["full_name"] != ""]
    if args.get("early"):
        df = df[df["early"] == "yes"]
    intents = args.getlist("intent")
    if intents and set(intents) != set(INTENTS):
        df = df[df["intent"].isin(intents)]
    for key in ("segment", "source"):
        picked = args.getlist(key)
        if picked:
            df = df[_has_any(df[key], picked)]
    picked = args.getlist("country")
    if picked:
        df = df[df["country"].isin(picked) | (OTHER_COUNTRY in picked) & ~df["country"].isin(list(COUNTRIES))]
    try:
        df = df[df["_score"] >= float(args.get("min_score") or 0)]
    except ValueError:
        pass
    for key, col in (("since", "date_found"), ("updated", "last_updated")):
        day = (args.get(key) or "").strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            df = df[df[col].str[:10] >= day]
    df = df.sort_values(["_score", "_intent"], ascending=False)
    if args.get("per_company"):
        df = df.drop_duplicates("domain")
    return df.drop(columns=["_score", "_intent"])


def country_counts(df: pd.DataFrame) -> Dict[str, int]:
    """Companies per country, for the filter's labels."""
    if df.empty:
        return {}
    firms = fill_country(df.drop_duplicates("domain").copy())
    known = firms["country"].where(firms["country"].isin(list(COUNTRIES)), OTHER_COUNTRY)
    return known.value_counts().to_dict()


def summary(df: pd.DataFrame) -> dict:
    if df.empty:
        return {}
    firms = df.drop_duplicates("domain")
    return {
        "companies": len(firms),
        "people": int((df["full_name"] != "").sum()),
        "emails": int((df["email"] != "").sum()),
        "valid": int((df["verified_status"] == "valid").sum()),
        "ready": int((df["ready"] == "yes").sum()),
        "intent": {k: int((firms["intent"] == k).sum()) for k in INTENTS},
    }


class _Args(dict):
    """Minimal stand-in for request.args (get / getlist)."""

    def __init__(self, **kw):
        super().__init__(kw)

    def getlist(self, key):
        return [self[key]] if key in self else []


# ---------- runs ----------
class Runner:
    """One pipeline run started from the page; also notices runs started by cron (via the lock)."""

    def __init__(self, root: Path, env_path: Path, profile: str = GPU):
        self.root = root
        self.profile = profile
        self.base_env = env_path  # .env: the GPU profile's file, also holds the shared settings
        self.env_path = env_path if profile == GPU else env_path.with_name(env_name(profile))
        self.proc: Optional[subprocess.Popen] = None
        self.lock = threading.Lock()

    def data_dir(self) -> Path:
        """Same rule as config._data_dir: GPU in DATA_DIR, training in DATA_DIR/training."""
        base = Path(os.getenv("DATA_DIR") or read_env(self.base_env).get("DATA_DIR") or "./data")
        if self.profile != GPU:
            base = Path(os.getenv(f"{self.profile.upper()}_DATA_DIR") or base / self.profile)
        return base if base.is_absolute() else self.root / base

    def log_path(self) -> Path:
        return self.data_dir() / "leads.log"

    def ours_running(self) -> bool:
        return self.proc is not None and self.proc.poll() is None

    def any_running(self) -> bool:
        if self.ours_running():
            return True
        lock = self.data_dir() / ".lock"
        if not lock.exists():
            return False
        with open(lock, "a") as fh:  # the pipeline holds this lock for the whole run
            fh.seek(0)
            try:
                if fcntl:
                    fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    fcntl.flock(fh, fcntl.LOCK_UN)
                else:
                    msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
                    msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
                return False
            except OSError:
                return True

    def start(self, batch: int, sources: List[str], why: str = "from the web page") -> None:
        with self.lock:
            if self.any_running():
                raise RuntimeError("A run is already in progress")
            env = {k: v for k, v in os.environ.items() if k not in SETTING_KEYS | OWN_KEYS - {"DATA_DIR"}}
            env.update(PYTHONUNBUFFERED="1", PYTHONIOENCODING="utf-8", PROFILE=self.profile)
            cmd = [sys.executable, "-u", "-m", "leads", "run", "--profile", self.profile,
                   "--batch", str(batch), "--sources", ",".join(sources)]
            self.data_dir().mkdir(parents=True, exist_ok=True)
            log = open(self.log_path(), "a", encoding="utf-8")
            log.write(f"\n=== run started {why} {datetime.now():%Y-%m-%d %H:%M} "
                      f"(batch {batch}, sources {','.join(sources)})\n")
            log.flush()
            extra = {"start_new_session": True} if os.name == "posix" else {}
            self.proc = subprocess.Popen(cmd, cwd=self.root, env=env, stdout=log,
                                         stderr=subprocess.STDOUT, **extra)
            log.close()

    def stop(self) -> bool:
        with self.lock:
            if not self.ours_running():
                return False
            if os.name == "posix":  # the whole group, so the headless browser goes too
                os.killpg(self.proc.pid, signal.SIGTERM)
            else:
                self.proc.terminate()
            with open(self.log_path(), "a", encoding="utf-8") as log:
                log.write(f"=== run stopped from the web page {datetime.now():%Y-%m-%d %H:%M}\n")
            return True

    def tail(self, n: int = LOG_LINES) -> List[str]:
        path = self.log_path()
        if not path.exists():
            return []
        with open(path, "rb") as fh:
            fh.seek(0, 2)
            fh.seek(max(0, fh.tell() - 200_000))
            lines = fh.read().decode("utf-8", "replace").splitlines()
        return [ln for ln in lines if "urllib3" not in ln][-n:]



LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")
PAGE_SIZE = 25
MAX_PAGE_SIZE = 200
LEAD_FIELDS = ["company", "domain", "company_linkedin", "country", "segment", "intent", "intent_score",
               "intent_signals", "early", "founded", "stage", "team_size", "source", "signal", "signal_url",
               "date_found", "full_name", "title", "linkedin_url", "email", "email_type", "verified_status",
               "phone", "score", "ready", "status", "last_updated"]
SEARCH_FIELDS = ["company", "domain", "full_name", "title", "email"]
EXEMPT_DEFAULT = "vfx_animation,gaming,arch_viz,competitor_clients"


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


class JsonForm:
    def __init__(self, data: Dict[str, object]):
        self.data = data

    def get(self, key, default=None):
        value = self.data.get(key, default)
        if isinstance(value, bool):
            return "1" if value else ""
        if isinstance(value, (int, float)):
            return str(value)
        return value

    def getlist(self, key) -> List[str]:
        value = self.data.get(key)
        return [str(x) for x in value] if isinstance(value, list) else []


class SheetCache:
    def __init__(self):
        self.lock = threading.Lock()
        self.entries: Dict[Path, tuple] = {}

    def load(self, xlsx: Path) -> pd.DataFrame:
        stamp = xlsx.stat().st_mtime if xlsx.exists() else None
        with self.lock:
            cached = self.entries.get(xlsx)
            if cached and cached[0] == stamp:
                return cached[1]
        df = load_sheet(xlsx)
        if not df.empty:
            df = fill_country(df)
        with self.lock:
            self.entries[xlsx] = (stamp, df)
        return df


def flag_on(cfg: dict, env: Dict[str, str], key: str) -> bool:
    return (env.get(key) or cfg["flag_defaults"].get(key, "1")) not in ("0", "false", "no")


def number_keys(cfg: dict) -> List[str]:
    keys = []
    for key in NUMBERS:
        if key in STARTUP_NUMBERS and not cfg["startup_fields"]:
            continue
        if key in TRAINING_NUMBERS and cfg["startup_fields"]:
            continue
        keys.append(key)
    return keys


def text_keys(profile: str) -> List[str]:
    return [key for key in TEXTS if profile == GPU or key not in SHARED_KEYS]


def split_list(raw: str) -> List[str]:
    return [x for x in (raw or "").split(",") if x]


def settings_view(runner: Runner, base_env: Dict[str, str]) -> dict:
    profile = runner.profile
    cfg = PROFILES[profile]
    env = read_env(runner.env_path)
    segments = list(cfg["segments"])
    chosen = [s for s in split_list(env.get("SEGMENTS", "")) if s in segments]
    exempt_raw = env["EARLY_EXEMPT_SEGMENTS"] if "EARLY_EXEMPT_SEGMENTS" in env else EXEMPT_DEFAULT
    return {
        "profile": profile,
        "label": cfg["label"],
        "flags": [{"key": k, "label": label, "on": flag_on(cfg, env, k)} for k, label in cfg["flags"].items()],
        "numbers": [{"key": k, "label": NUMBERS[k][0], "min": NUMBERS[k][1], "max": NUMBERS[k][2],
                     "value": env.get(k) or DEFAULTS.get(k, "")} for k in number_keys(cfg)],
        "texts": [{"key": k, "label": TEXTS[k], "value": (base_env if k in SHARED_KEYS else env).get(k, "")}
                  for k in text_keys(profile)],
        "secrets": [{"key": k, "label": label, "set": bool(base_env.get(k))} for k, label in SECRETS.items()]
        if profile == GPU else [],
        "segments": {"options": segments, "selected": chosen or segments},
        "countries": {"options": list(COUNTRIES),
                      "selected": split_list(env.get("COUNTRIES") or DEFAULT_COUNTRIES[profile])},
        "sources": {"options": list(cfg["sources"]), "skipped": split_list(env.get("SKIP_SOURCES", ""))},
        "earlyExempt": {"options": segments, "selected": [s for s in split_list(exempt_raw) if s in segments]}
        if cfg["exempt"] else None,
    }


def settings_form(body: dict) -> JsonForm:
    data: Dict[str, object] = {}
    for key, value in (body.get("flags") or {}).items():
        data[key] = bool(value)
    for group in ("numbers", "texts", "secrets"):
        for key, value in (body.get(group) or {}).items():
            data[key] = str(value)
    for key in body.get("clearSecrets") or []:
        data[f"{key}_clear"] = True
    data["SEGMENTS"] = list(body.get("segments") or [])
    data["COUNTRIES"] = list(body.get("countries") or [])
    data["SKIP_SOURCES"] = list(body.get("skipSources") or [])
    data["EARLY_EXEMPT_SEGMENTS"] = list(body.get("earlyExempt") or [])
    return JsonForm(data)


def lead_rows(df: pd.DataFrame) -> List[Dict[str, str]]:
    rows = []
    for record in df.to_dict("records"):
        row = {c: str(record.get(c, "") or "") for c in LEAD_FIELDS}
        row["find_people"] = google_url(row["company"]) if not row["full_name"] else ""
        rows.append(row)
    return rows


def search_sheet(df: pd.DataFrame, query: str) -> pd.DataFrame:
    query = (query or "").strip().lower()
    if not query or df.empty:
        return df
    hit = pd.Series(False, index=df.index)
    for col in SEARCH_FIELDS:
        if col in df.columns:
            hit |= df[col].str.lower().str.contains(query, regex=False)
    return df[hit]


def empty_summary() -> dict:
    return {"companies": 0, "people": 0, "emails": 0, "valid": 0, "ready": 0, "intent": {k: 0 for k in INTENTS}}


def run_info(runner: Runner, sheets: SheetCache) -> dict:
    cfg = PROFILES[runner.profile]
    env = read_env(runner.env_path)
    xlsx = runner.data_dir() / "leads.xlsx"
    df = sheets.load(xlsx)
    last = load_last_run(runner.data_dir())
    return {
        "profile": runner.profile,
        "label": cfg["label"],
        "noun": cfg["noun"],
        "running": runner.any_running(),
        "ours": runner.ours_running(),
        "updated": datetime.fromtimestamp(xlsx.stat().st_mtime).isoformat(timespec="seconds")
        if xlsx.exists() else None,
        "summary": summary(df) or empty_summary(),
        "lastRun": {
            "started": last.get("started"),
            "finished": last.get("finished"),
            "newCompanies": int(last.get("new_companies") or 0),
            "newPeople": int(last.get("new_people") or 0),
            "newReady": int(last.get("new_ready") or 0),
        } if last else None,
        "runAt": env.get("RUN_AT", ""),
        "batch": int(env.get("BATCH_SIZE") or DEFAULTS["BATCH_SIZE"]),
        "maxBatch": NUMBERS["BATCH_SIZE"][2],
        "sources": list(cfg["sources"]),
        "dailySources": daily_sources(env, cfg["sources"]),
        "segments": list(cfg["segments"]),
        "countries": list(COUNTRIES) + [OTHER_COUNTRY],
        "intents": INTENTS,
    }


def create_app(root: Path = ROOT) -> Flask:
    app = Flask(__name__)
    env_path = env_file(root)
    runners = {p: Runner(root, env_path, p) for p in PROFILES}
    sheets = SheetCache()
    app.config["runner"] = runners[GPU]
    app.config["runners"] = runners

    def runner_for(value) -> Runner:
        profile = str(value or GPU)
        if profile not in runners:
            raise ApiError(400, "UNKNOWN_PROFILE", f"No profile called '{profile}'.")
        return runners[profile]

    def body() -> dict:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ApiError(400, "INVALID_BODY", "Send a JSON object.")
        return data

    def filtered(runner: Runner) -> pd.DataFrame:
        df = sheets.load(runner.data_dir() / "leads.xlsx")
        df = filter_sheet(df, request.args, load_last_run(runner.data_dir()))
        return search_sheet(df, request.args.get("q", ""))

    @app.errorhandler(ApiError)
    def api_error(error: ApiError):
        return jsonify(error=error.message, code=error.code), error.status

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify(error="No such endpoint.", code="NOT_FOUND"), 404

    @app.errorhandler(405)
    def wrong_method(_error):
        return jsonify(error="Wrong method for this endpoint.", code="METHOD_NOT_ALLOWED"), 405

    @app.errorhandler(Exception)
    def failed(error: Exception):
        app.logger.exception("request failed")
        return jsonify(error=str(error) or "The pipeline failed.", code="PIPELINE_ERROR"), 500

    @app.get("/api/health")
    def health():
        return jsonify(ok=True)

    @app.get("/api/status")
    def status():
        return jsonify(profiles=[run_info(r, sheets) for r in runners.values()])

    @app.get("/api/log")
    def run_log():
        runner = runner_for(request.args.get("profile"))
        return jsonify(profile=runner.profile, running=runner.any_running(), lines=runner.tail())

    @app.post("/api/run")
    def run():
        data = body()
        runner = runner_for(data.get("profile"))
        allowed = PROFILES[runner.profile]["sources"]
        picked = data.get("sources")
        sources = [s for s in picked if s in allowed] if isinstance(picked, list) else []
        if not sources:
            raise ApiError(400, "NO_SOURCES", "Pick at least one source.")
        limit = NUMBERS["BATCH_SIZE"][2]
        try:
            batch = int(data.get("batch") or 0)
        except (TypeError, ValueError):
            raise ApiError(400, "INVALID_BATCH", "The batch must be a whole number.")
        if not 1 <= batch <= limit:
            raise ApiError(400, "INVALID_BATCH", f"The batch must be between 1 and {limit}.")
        try:
            runner.start(batch, sources, why="from the CRM")
        except RuntimeError as error:
            raise ApiError(409, "RUN_IN_PROGRESS", str(error))
        return jsonify(ok=True, message=f"{LABELS[runner.profile]} run started.")

    @app.get("/api/custom-search")
    def custom_searches():
        runner = runner_for(request.args.get("profile"))
        limits = {k: CUSTOM_SEARCH[k] for k in ("max_name_chars", "max_what", "max_where", "max_words",
                                                 "max_term_chars", "max_queries", "max_companies",
                                                 "default_companies")}
        return jsonify(profile=runner.profile, running=runner.any_running(),
                       searches=read_history(runner.data_dir()), limits=limits)

    @app.post("/api/custom-search/preview")
    def custom_search_preview():
        data = body()
        try:
            spec = parse_spec({**data, "name": data.get("name") or "Preview"})
        except SpecError as error:
            raise ApiError(400, "INVALID_SEARCH", str(error))
        return jsonify(queries=spec["queries"], slug=spec["slug"], maxQueries=CUSTOM_SEARCH["max_queries"])

    @app.post("/api/custom-search")
    def custom_search_start():
        data = body()
        runner = runner_for(data.get("profile"))
        try:
            spec = parse_spec(data)
        except SpecError as error:
            raise ApiError(400, "INVALID_SEARCH", str(error))
        if runner.any_running():
            raise ApiError(409, "RUN_IN_PROGRESS", "A run is already in progress.")
        write_spec(runner.data_dir(), spec)
        try:
            runner.start(spec["companies"], ["custom"], why=f"for the custom search {spec['name']}")
        except RuntimeError as error:
            raise ApiError(409, "RUN_IN_PROGRESS", str(error))
        return jsonify(ok=True, message=f"Custom search {spec['name']} started: {len(spec['queries'])} searches, "
                                        f"up to {spec['companies']} companies.")

    @app.post("/api/stop")
    def stop():
        runner = runner_for(body().get("profile"))
        if not runner.stop():
            raise ApiError(409, "NOT_RUNNING", "No run started from the CRM is in progress.")
        return jsonify(ok=True, message="Run stopped. Work done so far is saved.")

    @app.get("/api/leads")
    def leads():
        runner = runner_for(request.args.get("profile"))
        df = filtered(runner)
        try:
            page = max(1, int(request.args.get("page") or 1))
            size = min(MAX_PAGE_SIZE, max(1, int(request.args.get("pageSize") or PAGE_SIZE)))
        except ValueError:
            raise ApiError(400, "INVALID_PAGE", "page and pageSize must be whole numbers.")
        rows = df.iloc[(page - 1) * size: page * size] if len(df) else df
        return jsonify(profile=runner.profile, total=int(len(df)), page=page, pageSize=size,
                       rows=lead_rows(rows) if len(rows) else [])

    @app.get("/api/download")
    def download():
        runner = runner_for(request.args.get("profile"))
        df = filtered(runner).copy()
        if len(df):
            df["find_people"] = [google_url(c) if not n else "" for c, n in zip(df["company"], df["full_name"])]
        prefix = "" if runner.profile == GPU else f"{runner.profile}_"
        name = f"{prefix}leads_{datetime.now():%Y-%m-%d}_{len(df)}rows.xlsx"
        return send_file(to_xlsx(df), as_attachment=True, download_name=name,
                         mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    @app.get("/api/settings")
    def get_settings():
        runner = runner_for(request.args.get("profile"))
        return jsonify(settings_view(runner, read_env(env_path)))

    @app.post("/api/settings")
    def save_settings():
        data = body()
        runner = runner_for(data.get("profile"))
        try:
            values = parse_settings(settings_form(data), read_env(env_path), runner.profile)
        except ValueError as error:
            raise ApiError(400, "INVALID_SETTINGS", str(error))
        if runner.profile != GPU and not runner.env_path.exists():
            runner.env_path.write_text("", encoding="utf-8")
        write_env(env_path if runner.profile == GPU else runner.env_path, values)
        return jsonify(settings_view(runner, read_env(env_path)))

    return app


def day_counts(state: dict) -> Dict[str, int]:
    out: Dict[str, int] = {}
    for d in (state.get("delivered") or {}).values():
        out[d] = out.get(d, 0) + 1
    return out


def env_file(root: Path) -> Path:
    p = Path(os.getenv("ENV_FILE") or ".env")
    return p if p.is_absolute() else root / p


def daily_sources(env: Dict[str, str], sources: Optional[List[str]] = None) -> List[str]:
    skip = set((env.get("SKIP_SOURCES") or "").split(","))
    return [s for s in (sources or SOURCES) if s not in skip]


def due(run_at: str, now: datetime, last_day: Optional[str]) -> bool:
    """True once per day, at or after RUN_AT."""
    if not re.fullmatch(r"\d\d:\d\d", run_at or ""):
        return False
    return now.strftime("%H:%M") >= run_at and last_day != now.strftime("%Y-%m-%d")


def scheduler(runner: Runner, started_late: bool) -> None:
    """Daily run inside the web process (Docker has no cron). RUN_AT is re-read every 30 s,
    so changing it on the page takes effect without a restart."""
    last_day = datetime.now().strftime("%Y-%m-%d") if started_late else None
    while True:
        env = read_env(runner.env_path)
        now = datetime.now()
        if due(env.get("RUN_AT", ""), now, last_day):
            last_day = now.strftime("%Y-%m-%d")
            try:
                runner.start(int(env.get("BATCH_SIZE") or 200),
                             daily_sources(env, PROFILES[runner.profile]["sources"]), why="by the RUN_AT schedule")
            except (RuntimeError, ValueError, OSError) as e:
                print(f"scheduled run skipped: {e}", file=sys.stderr)
        time.sleep(30)


def main() -> int:
    os.chdir(ROOT)
    env = read_env(env_file(ROOT))
    host = os.getenv("WEB_HOST") or env.get("WEB_HOST") or "127.0.0.1"
    port = int(os.getenv("WEB_PORT") or env.get("WEB_PORT") or 8501)
    in_docker = os.getenv("WEB_IN_DOCKER") == "1"
    if host not in LOCAL_HOSTS and not in_docker:
        print("WEB_HOST is not localhost. The API has no login: run it in Docker or on 127.0.0.1.", file=sys.stderr)
        return 1
    print(f"Leads API on http://{host}:{port}")
    app = create_app(ROOT)
    # Started after RUN_AT today (e.g. a restart at 10:00)? Wait for tomorrow rather than run now.
    for r in app.config["runners"].values():  # each tab has its own RUN_AT
        late = due(read_env(r.env_path).get("RUN_AT", ""), datetime.now(), None)
        threading.Thread(target=scheduler, args=(r, late), daemon=True).start()
    app.run(host=host, port=port, threaded=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
