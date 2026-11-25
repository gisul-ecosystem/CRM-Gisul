"""Lead scoring. Simple, transparent points; tune the numbers to taste."""
import re

from . import profile as _profile
from . import training as _training
from .extract import title_priority
from .segments import fit as segment_fit

GPU_WORDS = re.compile(
    r"gpu|cuda|inference|training|fine-?tun|diffusion|llm|large language|deep learning|"
    r"render|vfx|animation|unreal|simulation|drug discovery|genomics|imaging|drone|robotics|"
    r"video analytics|surveillance|high[- ]frequency|algorithmic trading|"
    r"cloud gpu|gpu cloud|gpu instances?|virtual workstations?|vdi|remote workstations?|"
    r"sagemaker|vertex ai|kubernetes|mlops|model serving|virtual reality|digital twin", re.I)
MAX_SCORE = 20
INTENT_POINTS = {"high": 4, "medium": 2}  # renting intent (intent.py)
# Points per discovery source. Any other seeds/*.csv list gets SEED_POINTS.
SOURCE_POINTS = {
    "indiaai": 4,     # government-selected foundation-model builders
    "competitors": 4, # clients actively renting from competitor clouds
    "funding": 3,     # just raised money for AI
    "hn_hiring": 3,   # hiring ML/infra engineers
    "incubator": 2,   # Indian incubator portfolio: small credits, more likely to pay
    "github": 2, "huggingface": 2,
    "yc": 0,          # YC partners give large free cloud/GPU credits
}
SEED_POINTS = 2

if _profile.current() == _profile.TRAINING:  # its own sources and buying words
    SOURCE_POINTS, SEED_POINTS, GPU_WORDS = _training.SOURCE_POINTS, _training.SEED_POINTS, _training.SIGNAL_WORDS


def score_row(row) -> int:
    pts = 0
    sources = [x for x in (row.get("source") or "").split(", ") if x]
    pts += sum(SOURCE_POINTS.get(src, SEED_POINTS) for src in sources)
    if len(sources) >= 2:
        pts += 2
    if GPU_WORDS.search(row.get("signal") or ""):
        pts += 2
    pts += segment_fit(row.get("segment") or "")  # 0-3: how well the segment fits vGPU
    if row.get("full_name"):
        pts += 2
        if title_priority(row.get("title") or "") <= 1:
            pts += 1
    status = row.get("verified_status") or ""
    personal = row.get("email_type") == "personal"
    if row.get("email"):
        if status == "valid":
            pts += 2 if personal else 1
        elif personal and email_trusted(row):  # published on their site, not a guess
            pts += 1
    if row.get("phone"):
        pts += 1
    pts += INTENT_POINTS.get(row.get("intent") or "", 0)
    if row.get("early") == "yes":  # confirmed young (founding year / seed-Series A round)
        pts += 1
    return min(pts, MAX_SCORE)


def email_trusted(row) -> bool:
    """A mailbox check confirmed it, or it was published (website / GitHub profile).
    A pattern guess (firstname@domain) that no SMTP check confirmed is not trusted: without
    Reacher, or on a catch-all domain, nothing says the mailbox exists."""
    status = row.get("verified_status")
    if status == "valid":
        return True
    return status in ("risky", "unverified") and row.get("email_source") in ("website", "github")


def is_ready(row, min_score: int) -> bool:
    return (
        row.get("status") == "verified"
        and bool(row.get("email"))
        and email_trusted(row)
        and int(row.get("score") or 0) >= min_score
    )
