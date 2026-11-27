from pathlib import Path
from typing import List

from .. import rules
from ..config import Settings
from ..fetch import Fetcher
from ..store import Candidate, Store
from . import competitors

ROOT = Path(__file__).resolve().parent.parent


def list_file() -> Path:
    name = getattr(rules.current(), "COMPETITOR_FILE", None)
    return ROOT / name if name else competitors.LIST_FILE


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    return competitors.discover(s, fetcher, store, limit, list_file=list_file(), search=False)
