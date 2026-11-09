"""Two independent lead profiles in one app.

  gpu       startups likely to rent vGPUs (the original pipeline): data/, .env
  training  organisations that need VMs for training labs and courses: data/training/, .env.training

A run belongs to one profile, chosen with PROFILE=training (or --profile training) before the
package is imported. Each profile has its own data folder (sheet, state, day sheets, lock, log),
its own filter settings, sources, segments, intent signals and decision-maker titles. Only the
engine and the connection settings (bot name, tokens, Reacher) are shared.
"""
import os
import sys

GPU, TRAINING, COMPETITORS = "gpu", "training", "competitors"
LABELS = {GPU: "GPU leads", TRAINING: "Training-lab leads", COMPETITORS: "Competitor clients"}

# Settings each profile keeps for itself. The training profile never takes these from .env
# (the GPU profile's file); everything else there (bot name, tokens, Reacher...) is shared.
OWN_KEYS = {
    "INDIA_ONLY", "EARLY_ONLY", "MAX_AGE_YEARS", "MAX_TEAM_SIZE", "EARLY_EXEMPT_SEGMENTS",
    "SEGMENTS", "REQUIRE_SEGMENT", "SKIP_SOURCES", "BATCH_SIZE", "ROUND_SIZE", "WORKERS",
    "MIN_SCORE", "MAX_PEOPLE", "SEARCH_MAX_PER_RUN", "DOMAIN_DELAY", "RENDER_JS", "RUN_AT",
    "DATA_DIR", "SMALL_ONLY", "SEARCH_DISCOVERY_PER_RUN", "MAPS_PER_RUN", "COUNTRIES", "DOMAIN_AGE",
}


def current() -> str:
    """The profile of this process: --profile on the command line, else PROFILE, else gpu."""
    argv = sys.argv
    if "--profile" in argv:
        i = argv.index("--profile")
        if i + 1 < len(argv) and argv[i + 1] in LABELS:
            return argv[i + 1]
    p = (os.getenv("PROFILE") or GPU).strip().lower()
    return p if p in LABELS else GPU


def env_name(profile: str) -> str:
    return ".env" if profile == GPU else f".env.{profile}"
