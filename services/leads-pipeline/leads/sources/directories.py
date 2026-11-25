"""Training profile: organisations listed on public directory pages (leads/training_directories.csv),
e.g. a vendor's list of authorised training partners. Read exactly like the incubator pages
(robots.txt, headless browser for JavaScript lists); every outbound link is taken as an
organisation, and its own website decides later whether it qualifies. Add pages to the CSV.
"""
from pathlib import Path
from typing import List

from ..config import Settings
from ..fetch import Fetcher
from ..store import Candidate, Store
from . import incubators

LIST_FILE = Path(__file__).resolve().parent.parent / "training_directories.csv"
# links on directory pages that are never organisations (photos, video, social)
SKIP = frozenset({"flickr.com", "vimeo.com", "pinterest.com", "tumblr.com", "imgur.com", "soundcloud.com",
                  "bsky.app", "threads.net", "t.co", "discord.gg", "discord.com", "slack.com", "meetup.com",
                  "eventbrite.com", "zoom.us", "calendly.com", "linktr.ee", "github.io", "netlify.app"})


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int, list_file: Path = LIST_FILE) -> List[Candidate]:
    return incubators.discover(s, fetcher, store, limit, list_file=list_file, source="directory",
                               india="", signal="Listed on {name}", skip=SKIP)
