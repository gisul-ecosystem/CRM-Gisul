"""Discovery from Hugging Face: organisations publishing new models.

NOTE: the Hub's JSON endpoints are lightly documented. Field names for an
organisation's website are probed defensively (several likely keys), with an
HTML fallback. Verify against the live API on first run and adjust if needed.
"""
import logging
import re
from typing import List, Optional

from bs4 import BeautifulSoup

from ..config import Settings
from ..fetch import Fetcher
from ..store import Candidate, Store
from ..util import extract_domain, is_blocked

log = logging.getLogger(__name__)

API = "https://huggingface.co/api"
PIPELINES = [
    "text-generation", "text-to-image", "text-to-video", "image-text-to-text",
    "text-to-speech", "automatic-speech-recognition",
]
WEBSITE_KEYS = ("website", "websiteUrl", "website_url", "homepage", "url", "link")
SKIP_HOSTS = ("huggingface.co", "hf.co", "github.com", "twitter.com", "x.com", "linkedin.com",
              "discord.gg", "discord.com", "youtube.com", "medium.com")


def _headers(s: Settings) -> dict:
    return {"Authorization": f"Bearer {s.hf_token}"} if s.hf_token else {}


def website_from_overview(data: dict) -> str:
    """Pull a website URL out of an org overview JSON, whatever the key is called."""
    for k in WEBSITE_KEYS:
        v = data.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def website_from_html(html: str) -> str:
    """Fallback: first outbound link on the org page that isn't a social/code host."""
    soup = BeautifulSoup(html, "lxml")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("http"):
            continue
        d = extract_domain(href)
        if d and not any(d == h or d.endswith("." + h) for h in SKIP_HOSTS) and not is_blocked(d):
            return href
    return ""


def authors_from_models(models: list) -> List[tuple]:
    """[(org, example_model_id)] from a models-list response."""
    seen, out = set(), []
    for m in models or []:
        mid = m.get("id") or m.get("modelId") or ""
        if "/" not in mid:
            continue
        org = mid.split("/")[0]
        if org not in seen:
            seen.add(org)
            out.append((org, mid))
    return out


def discover(s: Settings, fetcher: Fetcher, store: Store, limit: int) -> List[Candidate]:
    seen = set(store.state["cursors"].get("hf_orgs_seen", []))
    out: List[Candidate] = []
    hdrs = _headers(s)

    for pipe in PIPELINES:
        if len(out) >= limit:
            break
        code, models, _ = fetcher.get_json(
            f"{API}/models",
            headers=hdrs,
            params={"pipeline_tag": pipe, "sort": "createdAt", "direction": -1, "limit": 100},
            timeout=30,
        )
        if code != 200 or not isinstance(models, list):
            log.warning("hf models %s -> HTTP %s", pipe, code)
            continue
        for org, model_id in authors_from_models(models):
            if org in seen:
                continue
            seen.add(org)
            ocode, overview, _ = fetcher.get_json(f"{API}/organizations/{org}/overview", headers=hdrs)
            if ocode != 200 or not isinstance(overview, dict):
                continue  # 404 usually means it's a personal account, not an org
            site = website_from_overview(overview)
            if not site:
                html = fetcher.get_html(f"https://huggingface.co/{org}")
                site = website_from_html(html) if html else ""
            domain = extract_domain(site)
            if is_blocked(domain):
                continue
            out.append(
                Candidate(
                    name=overview.get("fullname") or org,
                    domain=domain,
                    source="huggingface",
                    signal=f"Publishing {pipe} models on Hugging Face ({model_id})",
                    signal_url=f"https://huggingface.co/{model_id}",
                    source_ref=f"hf:{org}",
                    segment="ai",
                )
            )
            if len(out) >= limit:
                break
    store.state["cursors"]["hf_orgs_seen"] = sorted(seen)[-5000:]
    return out
