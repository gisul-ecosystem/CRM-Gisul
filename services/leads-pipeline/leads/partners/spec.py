import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .config import PARTNERS

LIMITS = PARTNERS["limits"]


class SpecError(ValueError):
    pass


def _ids(value, allowed: Dict, label: str) -> List[str]:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise SpecError(f"{label}: send a list.")
    unknown = [v for v in value if v not in allowed]
    if unknown:
        raise SpecError(f"{label}: unknown choice '{unknown[0]}'.")
    picked = [k for k in allowed if k in value]
    if not picked:
        raise SpecError(f"{label}: pick at least one.")
    return picked


def _words(value, label: str) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise SpecError(f"{label}: send a list of words.")
    words = [re.sub(r"\s+", " ", v).strip() for v in value if v.strip()]
    if len(words) > LIMITS["max_words"]:
        raise SpecError(f"{label}: at most {LIMITS['max_words']} words.")
    long = [w for w in words if len(w) > LIMITS["max_term_chars"]]
    if long:
        raise SpecError(f"{label}: '{long[0][:20]}…' is longer than {LIMITS['max_term_chars']} characters.")
    return list(dict.fromkeys(words))


def _int(value, label: str, lo: int, hi: int, default: int) -> int:
    if value in (None, ""):
        return default
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise SpecError(f"{label}: must be a whole number.")
    if not lo <= n <= hi:
        raise SpecError(f"{label}: must be between {lo} and {hi}.")
    return n


def _size(value) -> str:
    if value in (None, ""):
        return LIMITS["default_size"]
    if value not in PARTNERS["sizes"]:
        raise SpecError(f"Company size: unknown choice '{value}'.")
    return value


def slug_of(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "partners"


def build_queries(spec: Dict) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    seen = set()
    must = " ".join([f'"{w}"' if " " in w else w for w in spec.get("mustHave", [])] +
                    list(PARTNERS["search"]["negative"]))
    for signal in spec["signals"]:
        cfg = PARTNERS["signals"][signal]
        for country in spec["countries"]:
            if cfg.get("countries") and country not in cfg["countries"]:
                continue
            place = PARTNERS["countries"][country]
            templates = place.get("queries", {}).get(signal) or cfg["queries"]
            for sector in spec["sectors"]:
                term = PARTNERS["sectors"][sector][place.get("sector_term", "query")]
                for template in templates:
                    q = template.format(sector=term, country=country, gov=place["gov"], award=place["award"],
                                        client_agencies=place["client_agencies"])
                    if must:
                        q = f"{q} {must}"
                    key = q.lower()
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append({"q": q, "signal": signal, "country": country, "sector": sector,
                                "mode": cfg["mode"]})
    return out[:LIMITS["max_queries"]]


def parse_spec(data: Dict) -> Dict:
    name = re.sub(r"\s+", " ", str(data.get("name") or "")).strip()
    if not name:
        raise SpecError("Name: give the search a name.")
    if len(name) > LIMITS["max_name_chars"]:
        raise SpecError(f"Name: at most {LIMITS['max_name_chars']} characters.")
    past = re.sub(r"\s+", " ", str(data.get("pastWork") or "")).strip()
    if len(past) > LIMITS["max_past_work_chars"]:
        raise SpecError(f"Our past work: at most {LIMITS['max_past_work_chars']} characters.")
    months = _int(data.get("months"), "Contracts since", min(LIMITS["months"]), max(LIMITS["months"]),
                  LIMITS["default_months"])
    spec = {
        "name": name,
        "slug": slug_of(name),
        "countries": _ids(data.get("countries"), PARTNERS["countries"], "Countries"),
        "sectors": _ids(data.get("sectors"), PARTNERS["sectors"], "Fields"),
        "signals": _ids(data.get("signals"), PARTNERS["signals"], "Signals"),
        "months": months,
        "pastWork": past,
        "mustHave": _words(data.get("mustHave"), "Must mention"),
        "exclude": _words(data.get("exclude"), "Leave out"),
        "companies": _int(data.get("companies"), "How many companies", 1, LIMITS["max_companies"],
                          LIMITS["default_companies"]),
        "useModel": bool(data.get("useModel")),
        "enrichContacts": bool(data.get("enrichContacts")),
        "size": _size(data.get("size")),
        "keepUnknownSize": bool(data.get("keepUnknownSize")),
    }
    spec["queries"] = build_queries(spec)
    if not spec["queries"] and not datasets_for(spec):
        raise SpecError("These signals do not apply to the chosen countries. Pick another signal.")
    return spec


DATASET_SIGNALS = {"contract", "register"}


def datasets_for(spec: Dict) -> List[Dict[str, str]]:
    if not DATASET_SIGNALS & set(spec["signals"]):
        return []
    return [{"country": c, "dataset": PARTNERS["countries"][c]["dataset"]}
            for c in spec["countries"] if PARTNERS["countries"][c]["dataset"]]


def folder(data_dir: Path) -> Path:
    return data_dir / PARTNERS["files"]["dir"]


def write_spec(base: Path, spec: Dict) -> Dict:
    base.mkdir(parents=True, exist_ok=True)
    stamped = {**spec, "id": f"{datetime.now():%Y%m%d-%H%M%S}-{spec['slug']}",
               "startedAt": datetime.now().isoformat(timespec="seconds")}
    path = base / PARTNERS["files"]["spec"]
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(stamped, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)
    return stamped


def read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def read_spec(base: Path) -> Optional[Dict]:
    return read_json(base / PARTNERS["files"]["spec"], None)


def read_history(base: Path) -> List[Dict]:
    rows = read_json(base / PARTNERS["files"]["history"], [])
    return rows if isinstance(rows, list) else []


def record_run(base: Path, entry: Dict) -> None:
    rows = [r for r in read_history(base) if r.get("id") != entry["id"]]
    rows.insert(0, entry)
    write_json(base / PARTNERS["files"]["history"], rows[:LIMITS["history_size"]])


def run_path(base: Path, run_id: str) -> Optional[Path]:
    if not re.fullmatch(r"[0-9]{8}-[0-9]{6}-[a-z0-9-]{1,40}", run_id or ""):
        return None
    return base / PARTNERS["files"]["runs"] / f"{run_id}.json"
