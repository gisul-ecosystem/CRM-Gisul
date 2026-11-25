"""Customer segments: the kinds of early-stage startup that rent vGPUs (cloud GPU instances
and virtual GPU workstations).

Each segment has
  fit    -- how well it fits vGPU (0-3); added to the lead score
  short  -- regex for short texts (names, headlines, tags, one-liners)
  strong -- regex for long texts (descriptions, article bodies), where a passing mention is noise
  github -- words to look for in GitHub org names (location search)
  topics -- GitHub repo topics that signal the segment (topic search)

Turn segments on/off with SEGMENTS=ai,gaming,... in .env (default: all).

The training profile (profile.py) has its own segments, the kinds of organisation that need
VMs for training labs (training.py); a process uses the set for its profile.
"""
import os
import re
from dataclasses import dataclass, field
from typing import Iterable, List

from . import profile as _profile
from . import training as _training
from .geo import AI_RE, STRONG_AI_RE


@dataclass
class Segment:
    label: str
    fit: int
    short: re.Pattern
    strong: re.Pattern
    github: List[str] = field(default_factory=list)
    topics: List[str] = field(default_factory=list)


def _rx(words: str) -> re.Pattern:
    return re.compile(rf"\b(?:{words})\b", re.I)


_VFX = _rx(r"vfx|visual effects|animation|animated (?:films?|series|content)|cgi|3d animation|"
           r"post[- ]production|motion graphics|compositing|animation studio")
_GAME = _rx(r"game studio|games studio|gaming studio|game development|game developers?|"
            r"video games?|mobile games?|pc games?|console games?|unreal engine|unity3d|esports")
_GAME_SHORT = _rx(_GAME.pattern[len(r"\b(?:"):-len(r")\b")] + r"|gaming|games")  # "Gaming startup X raises"
_ARCH = _rx(r"architectural (?:visuali[sz]ation|rendering|renders?|animation|walkthroughs?)|"
            r"archviz|arch[- ]viz|3d (?:architectural )?rendering|cgi rendering|"
            r"3d walkthroughs?|real estate (?:3d|cgi|renders?)")
# Computational life sciences only: wet-lab biotech (cell therapy, fermentation, diagnostics kits)
# does not rent GPUs, so plain "biotech" / "therapeutics" are deliberately not in this list.
_LIFE_WORDS = (r"(?:ai|ml|machine learning|computational|in[- ]silico)[- ](?:driven |based |powered |led )?"
               r"(?:drug discovery|drug design|biology|chemistry|pathology|radiology)|"
               r"drug discovery platform|computational (?:biology|chemistry)|bioinformatics|"
               r"genomics?|genome sequencing|proteomics|multi[- ]?omics|single[- ]cell|"
               r"protein (?:design|folding|structure prediction|language models?)|"
               r"molecular (?:modelling|modeling|dynamics|simulation)|structural biology|cryo[- ]?em|"
               r"medical imaging|radiology|digital pathology|imaging ai")
_LIFE = _rx(_LIFE_WORDS)
# short texts (headlines, org names) may say just "drug discovery"; long texts need a computational phrase
_LIFE_SHORT = _rx(_LIFE_WORDS + r"|drug discovery|drug design")
_DRONE = _rx(r"drones?|uavs?|unmanned aerial|unmanned (?:aircraft|vehicles?)|robotics|robots?|"
             r"autonomous (?:vehicles?|systems|navigation|mobile robots?)|aerospace")
_VIDEO = _rx(r"video analytics|video intelligence|surveillance|cctv|anpr|alpr|"
             r"face recognition|facial recognition|vision ai|ai cameras?|intelligent video")
_QUANT = _rx(r"quant(?:itative)? (?:trading|research|finance|fund)|quant firm|hft|"
             r"high[- ]frequency trading|algorithmic trading|algo trading|market making|"
             r"proprietary trading|prop(?:rietary)? trading firm")
_XR = _rx(r"augmented reality|virtual reality|mixed reality|ar/vr|xr|metaverse|digital twins?|"
          r"3d (?:configurators?|content|modell?ing|scanning|engine|design)|photogrammetry|"
          r"gaussian splatting|nerfs?|cad|cae|engineering simulation|simulation software|"
          r"virtual production")
_COMPETITOR_CLIENT = _rx(
    r"client of|customer of|powered by (?:e2e|runpod|yotta|jarvislabs|jarvis labs|lambdalabs|lambda labs|"
    r"coreweave|hyperstack|nebius|together ai|tensordock|vast\.ai|cruso|netweb|"
    r"neysa|aic ?cloud|aiccloud|cyfuture|spheron|krutrim)|"
    r"case study|customer story|success story|migrated to|migrated from (?:aws|gcp|azure)|"
    r"hosted on (?:e2e|runpod|yotta|jarvislabs|jarvis labs|coreweave|hyperstack|neysa|aic ?cloud|aiccloud)|"
    r"uses (?:e2e networks|yotta|jarvislabs|jarvis labs|runpod|lambda labs|coreweave|hyperstack|tensordock|neysa|aic ?cloud|aiccloud)|"
    r"compute partner|gpu partner|cloud partner"
)

GPU_SEGMENTS = {
    # fit: AI training/inference is the core vGPU workload; VFX, arch-viz and AR/VR/3D need
    # virtual GPU workstations; quant/HFT mostly needs bare metal at the exchange.
    "ai": Segment("AI / ML", 3, AI_RE, STRONG_AI_RE,
                  ["ai", "ml", "llm", "intelligence"],
                  ["llm", "large-language-models", "llm-inference", "fine-tuning", "diffusion",
                   "stable-diffusion", "text-to-video", "generative-ai", "rag", "speech-synthesis"]),
    "vfx_animation": Segment("VFX / animation", 2, _VFX, _VFX,
                             ["vfx", "animation", "studios"],
                             ["vfx", "houdini", "nuke", "blender-addon", "animation-pipeline"]),
    "gaming": Segment("Game studio", 2, _GAME_SHORT, _GAME,
                      ["games", "gaming", "game"],
                      ["unreal-engine", "unity3d", "game-development", "godot"]),
    "arch_viz": Segment("Architectural rendering", 2, _ARCH, _ARCH,
                        ["render", "renders", "visualization"],
                        ["archviz", "architectural-visualization"]),
    "life_sciences": Segment("Drug discovery / medical imaging", 2, _LIFE_SHORT, _LIFE,
                             ["bio", "genomics", "omics", "imaging"],
                             ["drug-discovery", "bioinformatics", "computational-biology",
                              "medical-imaging", "molecular-dynamics"]),
    "drones_robotics": Segment("Drones / robotics", 1, _DRONE, _DRONE,
                               ["drone", "drones", "robotics", "aerospace"],
                               ["drones", "px4", "ardupilot", "ros2", "robotics", "uav"]),
    "video_analytics": Segment("Video analytics / surveillance", 2, _VIDEO, _VIDEO,
                               ["vision", "surveillance", "analytics"],
                               ["video-analytics", "surveillance", "anpr", "face-recognition"]),
    "quant": Segment("Quant / HFT trading", 1, _QUANT, _QUANT,
                     ["capital", "quant", "trading"],
                     ["algorithmic-trading", "high-frequency-trading", "quantitative-finance"]),
    "xr_3d": Segment("AR/VR, 3D & digital twins", 2, _XR, _XR,
                     ["xr", "vr", "3d", "twin"],
                     ["augmented-reality", "virtual-reality", "webxr", "digital-twin",
                      "photogrammetry", "gaussian-splatting", "nerf"]),
}


TRAINING_SEGMENTS = {
    # fit: platforms and institutes that run batches buy most lab VMs
    "upskilling": Segment("Online courses / upskilling / bootcamps", 3, _training.UPSKILLING, _training.UPSKILLING,
                          ["academy", "learning", "skills", "edu"], []),
    "training_institute": Segment("IT training institutes / training partners", 3, _training.INSTITUTE,
                                  _training.INSTITUTE, ["training", "institute", "academy"], []),
    "university": Segment("Universities / colleges", 2, _training.UNIVERSITY, _training.UNIVERSITY,
                          ["university", "college"], []),
    "corporate_training": Segment("Corporate training / L&D", 2, _training.CORPORATE, _training.CORPORATE,
                                  ["training", "learning"], []),
}

COMPETITOR_SEGMENTS = {
    "competitor_clients": Segment("Competitor cloud client", 3, _COMPETITOR_CLIENT, _COMPETITOR_CLIENT,
                                  ["cloud", "compute", "gpu", "infrastructure"],
                                  ["gpu-cloud", "cloud-compute", "cloud-gpu", "cloud-infrastructure"]),
    "ai": Segment("AI / ML", 3, AI_RE, STRONG_AI_RE,
                  ["ai", "ml", "llm", "intelligence"],
                  ["llm", "large-language-models", "llm-inference", "fine-tuning", "diffusion"]),
    "vfx_animation": Segment("VFX / animation", 2, _VFX, _VFX, ["vfx", "animation", "studios"], []),
    "gaming": Segment("Game studio", 2, _GAME_SHORT, _GAME, ["games", "gaming"], []),
    "xr_3d": Segment("AR/VR, 3D & digital twins", 2, _XR, _XR, ["xr", "vr", "3d", "twin"], []),
}

if _profile.current() == _profile.TRAINING:
    SEGMENTS = TRAINING_SEGMENTS
elif _profile.current() == _profile.COMPETITORS:
    SEGMENTS = COMPETITOR_SEGMENTS
else:
    SEGMENTS = GPU_SEGMENTS


def qualifies(text: str) -> bool:
    """Extra condition for the profile: training organisations must teach lab-heavy subjects."""
    return SEGMENTS is not TRAINING_SEGMENTS or _training.teaches_lab_topics(text)


def fit(segment_list: str) -> int:
    """Best vGPU fit among a row's segments ('ai, gaming' -> 3)."""
    return max((SEGMENTS[s.strip()].fit for s in (segment_list or "").split(",") if s.strip() in SEGMENTS),
               default=0)


def enabled() -> List[str]:
    raw = os.getenv("SEGMENTS", "").strip()
    if not raw:
        return list(SEGMENTS)
    wanted = [x.strip() for x in raw.split(",") if x.strip()]
    return [s for s in wanted if s in SEGMENTS]


def classify(short_texts: Iterable[str] = (), long_text: str = "", only: Iterable[str] = None) -> List[str]:
    """Segments matched by the texts, in SEGMENTS order. Short texts use the loose pattern,
    the long text the strict one."""
    shorts = [t for t in short_texts if t]
    names = list(only) if only is not None else enabled()
    out = []
    for name in names:
        seg = SEGMENTS[name]
        if any(seg.short.search(t) for t in shorts) or (long_text and seg.strong.search(long_text)):
            out.append(name)
    return out


def join(*lists: Iterable[str]) -> str:
    """Merge segment lists into the sheet's comma-separated form, keeping SEGMENTS order."""
    have = {x.strip() for lst in lists for x in (lst.split(",") if isinstance(lst, str) else lst) if x.strip()}
    return ", ".join(s for s in SEGMENTS if s in have)
