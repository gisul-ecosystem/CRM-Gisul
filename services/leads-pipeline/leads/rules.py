import importlib

from . import profile as _profile

MODULES = {_profile.GAMING: "gaming", _profile.AAPTOR: "aaptor", _profile.KANONKODE: "kanonkode"}


def for_profile(profile: str):
    name = MODULES.get(profile)
    return importlib.import_module(f"{__package__}.{name}") if name else None


def current():
    return for_profile(_profile.current())
