"""Renting intent: evidence that a company runs GPU workloads and pays for compute itself.

Scored from the text of the company's own pages and the titles of its open jobs. Each signal
adds (or, for evidence against, removes) points; the matched words are kept so the sheet can
say *why* a company scored high. Tune the weights here.

  intent_score >= HIGH  -> 'high'
  intent_score >= MEDIUM -> 'medium'
  otherwise              -> 'low'
"""
import re
from typing import Iterable, List, Tuple

from . import profile as _profile
from . import training as _training

HIGH, MEDIUM = 5, 2


def _rx(words: str) -> re.Pattern:
    return re.compile(rf"\b(?:{words})\b", re.I)


# (name shown in the sheet, pattern, points) for page text
TEXT_SIGNALS = [
    ("mentions GPUs", _rx(r"gpus?|cuda|tensor cores?|nvidia (?:a100|h100|h200|l40s?|l4|a10g?|rtx)|"
                         r"a100|h100|h200|l40s|rtx ?[2-5]0[6-9]0"), 3),
    ("trains own models", _rx(r"fine-?tun(?:e|es|ed|ing)|pre-?train(?:s|ed|ing)?|"
                              r"train(?:s|ed|ing)? (?:our|its|their|custom|proprietary|in-house|own|large) "
                              r"(?:[a-z-]+ )?models?|foundation models?|in-house models?|"
                              r"proprietary (?:ai |ml |deep learning )?models?|our own (?:llms?|models?)|"
                              r"model training|distributed training"), 3),
    ("NVIDIA Inception member", _rx(r"nvidia inception"), 3),
    ("rendering / virtual workstations", _rx(r"render farms?|gpu rendering|real-?time rendering|path tracing|"
                                             r"unreal engine|virtual workstations?|remote workstations?|vdi|"
                                             r"cloud rendering"), 3),
    # How AI startups actually describe themselves (seen on live sites): weaker than "we train
    # on GPUs", but evidence they run their own models rather than call someone else's API.
    ("builds AI models", _rx(r"proprietary (?:ai|ml|deep learning) (?:platform|engine|models?|algorithms?)|"
                             r"neural networks?|deep learning|large language models?|llms?|"
                             r"(?:our|own|custom|in-house|clinically validated|state-of-the-art|novel) "
                             r"(?:ai|ml|deep learning|computer vision|predictive|prediction|foundation) models?|"
                             r"ai models?|ml models?|computer vision models?|"
                             r"(?:drug response|prediction|predictive) models?"), 2),
    ("runs inference / simulation", _rx(r"inference (?:at scale|engine|pipeline|server)|model serving|"
                                        r"real-?time inference|edge ai|on-?prem(?:ise)? ai|"
                                        r"digital twins?|cfd|molecular dynamics|3d reconstruction|"
                                        r"gaussian splatting|photogrammetry|simulation (?:engine|platform)"), 2),
    ("uses competitor cloud (E2E, Neysa, Jarvis Labs, AIC Cloud, Yotta, RunPod, etc.)", _rx(
        r"e2e networks?|neysa|aic ?cloud|aiccloud|jarvislabs|jarvis labs|yotta|runpod|"
        r"lambda labs?|coreweave|hyperstack|nebius|together ai|tensordock|vast\.ai|cruso|netweb|"
        r"cyfuture|spheron|krutrim"), 3),
    ("already rents cloud compute", _rx(r"aws|amazon web services|google cloud|gcp|microsoft azure|azure|"
                                        r"sagemaker|vertex ai|runpod|lambda labs|e2e networks|yotta|"
                                        r"jarvislabs|coreweave"), 1),
    ("large datasets", _rx(r"petabytes?|terabytes? of|millions of (?:images|videos|hours)|"
                           r"large[- ]scale datasets?"), 1),
    # evidence against renting GPUs
    ("uses hosted AI APIs (OpenAI etc.)", _rx(r"powered by (?:openai|gpt-?[345]o?|chatgpt|gemini|claude)|"
                                              r"built (?:on|with) (?:openai|gpt-?[345]o?|chatgpt)|"
                                              r"openai api|gpt-?4o? api"), -2),
    ("has large cloud credits", _rx(r"aws activate|microsoft for startups|founders hub|"
                                    r"google for startups cloud"), -1),
]

ML_JOB = _rx(r"ml|machine learning|mlops|ai|deep learning|computer vision|cv|nlp|llm|research scientist|"
             r"applied scientist|data scientist|cuda|gpu|graphics|rendering|3d|unreal|unity|"
             r"simulation|robotics|perception|platform|infrastructure|devops|sre")
JOBS_POINTS, JOBS_MAX_LISTED = 3, 3

if _profile.current() == _profile.TRAINING:  # need for lab VMs instead of GPU renting
    TEXT_SIGNALS, ML_JOB = _training.SIGNALS, _training.JOB


def evaluate(texts: Iterable[str], job_titles: Iterable[str] = ()) -> Tuple[int, str, List[str]]:
    """(score, 'high'|'medium'|'low', ['mentions GPUs: H100', ...]) for one company."""
    text = " ".join(t for t in texts if t)
    score, why = 0, []
    for name, rx, pts in TEXT_SIGNALS:
        hits = sorted({m.group(0).strip() for m in rx.finditer(text)}, key=str.lower)
        if hits:
            score += pts
            why.append(f"{name}: {', '.join(hits[:3])}")
    ml_jobs = [t for t in dict.fromkeys(job_titles) if t and ML_JOB.search(t)]
    if ml_jobs:
        score += JOBS_POINTS
        more = f" (+{len(ml_jobs) - JOBS_MAX_LISTED} more)" if len(ml_jobs) > JOBS_MAX_LISTED else ""
        why.append(f"hiring ML/infra: {'; '.join(ml_jobs[:JOBS_MAX_LISTED])}{more}")
    label = "high" if score >= HIGH else "medium" if score >= MEDIUM else "low"
    return score, label, why
