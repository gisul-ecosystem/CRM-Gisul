from pathlib import Path
from typing import List

from .. import rules
from ..config import Settings
from ..fetch import Fetcher
from ..store import Candidate, Store
from . import directories

ROOT = Path(__file__).resolve().parent.parent


def list_file() -> Path:
    name = getattr(rules.current(), "DIRECTORY_FILE", None)
    return ROOT / name if name else directories.LIST_FILE


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    path = list_file()
    return directories.discover(s, fetcher, store, limit, list_file=path) if path.exists() else []
