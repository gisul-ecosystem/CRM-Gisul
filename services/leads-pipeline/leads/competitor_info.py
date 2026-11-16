"""What a competitor client buys, read from the competitor's case study or testimonial.

`competitor_of` reads the provider back from a row's source_ref ('comp:E2E Networks').
`services_in` names the services a case study mentions, most specific first, at most
MAX_SERVICES of them. Tune the words in SERVICES.
"""
import re
from typing import List

COMPETITOR_PREFIX = "comp:"
MAX_SERVICES = 3

SERVICES = [
    ("GPU cloud (H100/H200/B200)", r"\b(?:h100|h200|b200|gb200|blackwell|hopper)\b"),
    ("GPU cloud (A100/L40S/A10)", r"\b(?:a100|l40s?|a10g?|a6000|rtx\s?a?\d{4}|v100|t4)\b"),
    ("GPU cloud", r"\bgpu(?:s|\s+cloud|\s+servers?|\s+instances?|\s+clusters?|\s+compute|-as-a-service)?\b"),
    ("AI model training", r"\bmodel training\b|\btrain(?:s|ing|ed)?\b[^.]{0,40}?\b(?:llms?|models?)\b|\bfine-?tun(?:e|es|ing|ed)\b"),
    ("AI inference", r"\binference\b"),
    ("Bare metal servers", r"\bbare[- ]metal\b|\bdedicated servers?\b"),
    ("Virtual machines", r"\bvirtual machines?\b|\bvms?\b|\bcompute instances?\b|\bcloud servers?\b"),
    ("Kubernetes", r"\bkubernetes\b|\bk8s\b|\bmanaged containers?\b"),
    ("HPC", r"\bhpc\b|\bhigh[- ]performance computing\b|\bsupercomput\w*"),
    ("Object storage", r"\bobject storage\b|\bs3[- ]compatible\b|\bblock storage\b|\bstorage\b"),
    ("Colocation / data centre", r"\bcolocation\b|\bco-?location\b|\bdata ?cent(?:er|re) (?:space|hosting)\b|\bracks?\b"),
    ("Managed cloud", r"\bmanaged (?:cloud|services|hosting)\b|\bprivate cloud\b|\bhybrid cloud\b"),
    ("Backup / disaster recovery", r"\bbackup\b|\bdisaster recovery\b|\bdraas\b"),
    ("CDN / networking", r"\bcdn\b|\bcontent delivery\b|\bload balanc\w+\b"),
    ("Database hosting", r"\bmanaged (?:databases?|postgres|mysql|mongodb)\b|\bdbaas\b"),
]
_COMPILED = [(label, re.compile(pattern, re.I)) for label, pattern in SERVICES]


def competitor_of(source_ref: str) -> str:
    """'comp:E2E Networks' -> 'E2E Networks'; anything else -> ''."""
    ref = (source_ref or "").strip()
    return ref[len(COMPETITOR_PREFIX):].strip() if ref.startswith(COMPETITOR_PREFIX) else ""


def services_in(text: str) -> str:
    """'GPU cloud (H100/H200/B200), AI model training' from a case study's text."""
    found: List[str] = []
    for label, rx in _COMPILED:
        if rx.search(text or ""):
            if label == "GPU cloud" and any(f.startswith("GPU cloud") for f in found):
                continue
            found.append(label)
        if len(found) >= MAX_SERVICES:
            break
    return ", ".join(found)
