"""Hand-maintained company lists: every leads/seeds/*.csv file is a source.

The file name becomes the source label (indiaai.csv -> 'indiaai'). Columns:
    company, domain, segment, founded, signal, signal_url, india
Only company and domain are required; india defaults to 'yes', and segment defaults to the
file name when that is a segment (gaming.csv -> 'gaming'). Lines starting with '#'
are comments. Use this for lists you collect by hand, e.g. the IndiaAI Mission selections
or companies you looked up on the Startup India portal.
"""
import csv
import logging
from pathlib import Path
from typing import List

from .. import profile as _profile
from ..config import Settings
from ..fetch import Fetcher
from ..segments import SEGMENTS
from ..store import Candidate, Store
from ..util import extract_domain

log = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parent.parent / (
    "seeds_training" if _profile.current() == _profile.TRAINING else "seeds")


def read_seed_file(path: Path) -> List[Candidate]:
    lines = [ln for ln in path.read_text(encoding="utf-8-sig").splitlines()
             if ln.strip() and not ln.lstrip().startswith("#")]
    out = []
    for row in csv.DictReader(lines):
        row = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}
        domain = extract_domain(row.get("domain", ""))
        if not domain:
            if any(row.values()):
                log.warning("seeds/%s: skipping row without a usable domain: %s", path.name, row)
            continue
        out.append(Candidate(
            name=row.get("company") or domain,
            domain=domain,
            source=path.stem,
            signal=row.get("signal") or f"Listed in seeds/{path.name}",
            signal_url=row.get("signal_url", ""),
            source_ref=f"seed:{path.stem}",
            india=row.get("india") or "yes",
            segment=row.get("segment") or (path.stem if path.stem in SEGMENTS else ""),
            founded=int(row["founded"]) if row.get("founded", "").isdigit() else None,
        ))
    return out


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int, seed_dir: Path = SEED_DIR) -> List[Candidate]:
    out: List[Candidate] = []
    for path in sorted(seed_dir.glob("*.csv")):
        out += read_seed_file(path)
    return out  # no limit: the lists are short and add_candidate skips known domains
