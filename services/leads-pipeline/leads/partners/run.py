import logging
import re
from collections import defaultdict
from datetime import datetime
from typing import Dict, List

from bs4 import BeautifulSoup

from ..custom_search import CUSTOM_SEARCH
from .config import PARTNERS
from .extract import (clean_company, client_agency, display_name, enrich_from_page, evidence_from,
                      evidence_from_site, find_sectors, format_value, has_word, is_public_site, short_name, usd_millions,
                      without_name)
from .resolve import find_domain, find_people, find_size, find_size_web, merge, parent_name, size_fit
from .sources import SearchCache, cached_search, gebiz_awards, search_apis, usaspending_awards
from .spec import datasets_for, folder, read_json, read_spec, record_run, run_path, write_json
from .unifers import enrich_people
from .write import lead_evidence, model_config, polish, score, template

log = logging.getLogger("leads.partners")
FILES = PARTNERS["files"]
ENRICH = PARTNERS["enrich"]


def _skip_domains() -> Dict[str, set]:
    listing = set(CUSTOM_SEARCH["own_domains"]) | set(CUSTOM_SEARCH["listing_domains"])
    news, media = set(), set()
    for c in PARTNERS["countries"].values():
        news |= set(c["news_sites"])
        media |= set(c["news_sites"]) | set(c["registers"])
    return {"evidence": listing - news, "domain": listing | media}


def _dataset_awards(fetcher, dataset: str, terms: List[str], spec: Dict, stats: Dict, seen: set) -> List[Dict]:
    small = PARTNERS["sizes"][spec["size"]]["max"] is not None
    if dataset == "usaspending":
        return usaspending_awards(fetcher, terms, spec["months"], small, stats, seen)
    return gebiz_awards(fetcher, terms, spec["months"], stats, seen)


def _datasets(fetcher, spec: Dict, stats: Dict) -> List[Dict]:
    out = []
    floor = PARTNERS["sizes"][spec["size"]]["min_award_millions"]
    for target in datasets_for(spec):
        seen: set = set()
        kept = 0
        for sector in spec["sectors"]:
            terms = list(PARTNERS["sectors"][sector]["terms"])
            for ev in _dataset_awards(fetcher, target["dataset"], terms, spec, stats, seen):
                ev["company"] = clean_company(display_name(ev["company"]), ev["country"])
                text = ev.pop("text")
                if any(has_word(text, w) for w in PARTNERS["gebiz"]["not_ict_words"]):
                    continue
                ict = any(has_word(text, w) for w in PARTNERS["gebiz"]["ict_words"])
                ev["sectors"] = find_sectors(text, spec["sectors"]) or ([sector] if ict else [])
                if ev["company"] and ev["sectors"] and (ev.get("value_millions") or 0) >= floor:
                    out.append(ev)
                    kept += 1
        log.info("partners: %s (%s) -> %d awards kept", target["dataset"], target["country"], kept)
    return out


def _verify_sites(fetcher, evidence: List[Dict], stats: Dict) -> List[Dict]:
    out = []
    for ev in evidence:
        if not ev.pop("needs_page", False):
            out.append(ev)
            continue
        if stats["site_pages"] >= ENRICH["site_fetches"]:
            continue
        html = fetcher.get_html(ev["url"])
        stats["site_pages"] += 1
        if not html:
            continue
        text = without_name(BeautifulSoup(html, "lxml").get_text(" ", strip=True), ev["company"])
        ev["agency"] = client_agency(text, ev["country"])
        if ev["agency"]:
            out.append(ev)
    return out


def _enrich_pages(fetcher, evidence: List[Dict], spec: Dict, stats: Dict) -> None:
    for ev in evidence:
        if stats["pages"] >= ENRICH["page_fetches"]:
            return
        if ev["url"].startswith((PARTNERS["gebiz"]["source_url"], PARTNERS["usaspending"]["source_url"])):
            continue
        if ev.get("domain") or (ev.get("value_millions") is not None and ev.get("agency") and ev.get("date")):
            continue
        html = fetcher.get_html(ev["url"])
        stats["pages"] += 1
        if html:
            enrich_from_page(ev, BeautifulSoup(html, "lxml").get_text(" ", strip=True), spec)


EMPTY_SIZE = {"low": None, "high": None, "label": "", "linkedin": "", "hq": ""}


def _wrong_page(c: Dict, found: Dict) -> bool:
    hq = found.get("hq")
    if not hq or hq == c["country"] or found.get("parent"):
        return False
    local = any(home == c["country"] and re.search(rx, c["company"], re.I)
                for rx, home in PARTNERS["company"]["legal_forms"])
    return local or not found.get("exact")


def _size_of(c: Dict, apis, fetcher, scache, stats: Dict) -> None:
    names = [short_name(c["company"])]
    parent = parent_name(c["company"])
    if parent != names[0]:
        names.append(parent)
    for name in names:
        is_parent = name != names[0]
        if not apis or stats["size_lookups"] >= ENRICH["size_lookups"]:
            return
        stats["size_lookups"] += 1
        found = {**find_size(c, apis, fetcher, scache, stats, name), "parent": is_parent}
        if _wrong_page(c, found):
            found = {**EMPTY_SIZE, "parent": is_parent}
        if found["low"] is not None or found["hq"]:
            c["size"] = found
            return
        if found["linkedin"] and c["size"].get("low") is None:
            c["size"] = found
        for variant in range(len(PARTNERS["size"]["web_queries"])):
            if stats["size_lookups"] >= ENRICH["size_lookups"]:
                return
            stats["size_lookups"] += 1
            web = {**find_size_web(c, apis, fetcher, scache, stats, name, variant), "parent": is_parent}
            if web["low"] is not None and not _wrong_page(c, web):
                c["size"] = {**web, "linkedin": c["size"].get("linkedin", ""), "parent": is_parent}
                if web["high"] is not None or web["hq"]:
                    return
                break


def _by_size(companies: List[Dict], apis, fetcher, scache, spec: Dict, stats: Dict) -> List[Dict]:
    band = PARTNERS["sizes"][spec["size"]]
    if band["max"] is None:
        return companies[:spec["companies"]]
    kept: List[Dict] = []
    dropped = 0
    for c in companies:
        if len(kept) >= spec["companies"]:
            break
        _size_of(c, apis, fetcher, scache, stats)
        c["sizeFit"] = size_fit(c["size"], band)
        hq = c["size"].get("hq")
        if hq and hq != c["country"]:
            c["sizeFit"] = "no"
        if c["sizeFit"] == "unknown" and len(c["evidence"]) >= PARTNERS["size"]["many_awards"]:
            c["sizeFit"] = "no"
        top = max((usd_millions(e.get("value_millions"), e.get("currency") or "") for e in c["evidence"]),
                  default=0)
        if top >= PARTNERS["size"]["sme_award_max_millions"]:
            c["sizeFit"] = "no"
        if c["size"].get("high") is not None and c["size"]["high"] <= PARTNERS["size"]["sme_max"]:
            c["companyType"] = "sme"
        if c["sizeFit"] == "yes" or (c["sizeFit"] in ("maybe", "unknown") and spec["keepUnknownSize"]):
            kept.append(c)
        else:
            dropped += 1
            stats["size_unknown" if c["sizeFit"] in ("maybe", "unknown") else "size_too_big"] += 1
    log.info("partners: %s: %d kept, %d dropped by size", band["label"], len(kept), dropped)
    return kept


def public_row(c: Dict) -> Dict:
    weights = PARTNERS["score"]["signal"]
    evs = sorted(c["evidence"], key=lambda e: (weights.get(e["signal"], 0), e.get("date") or ""), reverse=True)
    lead = lead_evidence(c)
    return {
        "key": c["key"],
        "company": c["company"],
        "country": c["country"],
        "domain": c["domain"],
        "size": c["size"]["label"],
        "sizeFit": c["sizeFit"],
        "companyLinkedin": c["size"]["linkedin"],
        "companyType": c["companyType"],
        "contactLevel": PARTNERS["contacts"][c["companyType"]]["label"],
        "signals": c["signals"],
        "sectors": c["sectors"],
        "agencies": c["agencies"],
        "value": format_value(lead.get("value_millions"), lead.get("currency") or ""),
        "date": lead.get("date") or "",
        "score": c["score"],
        "people": c["people"],
        "why": c["why"],
        "hook": c["hook"],
        "polished": c.get("polished", False),
        "evidence": [{"title": e["title"], "url": e["url"], "source": e["source"], "date": e.get("date") or "",
                      "signal": e["signal"], "agency": e.get("agency") or "",
                      "value": format_value(e.get("value_millions"), e.get("currency") or "")}
                     for e in evs[:ENRICH["evidence_per_company"]]],
    }


def _entry(spec: Dict, status: str, stats: Dict, found: int = 0) -> Dict:
    return {
        "id": spec["id"], "name": spec["name"], "slug": spec["slug"], "startedAt": spec["startedAt"],
        "finishedAt": datetime.now().isoformat(timespec="seconds") if status != "running" else None,
        "status": status, "countries": spec["countries"], "sectors": spec["sectors"], "signals": spec["signals"],
        "queries": len(spec["queries"]), "searched": stats["searches"], "cached": stats["cached"],
        "found": found, "modelUsed": stats["model_calls"] > 0 or stats["model_cached"] > 0,
        "tokens": stats["prompt_tokens"] + stats["completion_tokens"],
        "sizeUnknown": stats["size_unknown"], "sizeTooBig": stats["size_too_big"],
        "unifersCredits": stats["unifers_credits"],
    }


def _prune(cache: Dict) -> None:
    llm = cache.get("llm") or {}
    extra = len(llm) - PARTNERS["llm"]["cache_size"]
    for key in list(llm)[:max(0, extra)]:
        llm.pop(key)
    SearchCache(cache).prune()


def run_partners(settings, fetcher) -> int:
    base = folder(settings.data_dir)
    spec = read_spec(base)
    if not spec:
        log.error("partners: no search to run; start one from the CRM")
        return 1
    stats: Dict[str, int] = defaultdict(int)
    record_run(base, _entry(spec, "running", stats))
    cache = read_json(base / FILES["cache"], {})
    try:
        rows = _run(settings, fetcher, spec, cache, stats)
    except Exception:
        log.exception("partners: the run failed")
        record_run(base, _entry(spec, "failed", stats))
        return 1
    finally:
        _prune(cache)
        write_json(base / FILES["cache"], cache)
    write_json(run_path(base, spec["id"]), {"id": spec["id"], "spec": spec, "rows": rows, "stats": dict(stats)})
    record_run(base, _entry(spec, "done", stats, len(rows)))
    log.info("partners: done. %d companies; %d searches (%d from cache); %d pages; %d model tokens",
             len(rows), stats["searches"], stats["cached"], stats["pages"],
             stats["prompt_tokens"] + stats["completion_tokens"])
    return 0


def _run(settings, fetcher, spec: Dict, cache: Dict, stats: Dict) -> List[Dict]:
    apis = search_apis(settings)
    scache = SearchCache(cache)
    skip = _skip_domains()
    if not apis:
        log.warning("partners: no Serper, Tavily or Brave key in Settings; only the free GeBIZ data is read")
    evidence: List[Dict] = []
    for hit in spec["queries"]:
        rows = cached_search(scache, apis, fetcher, hit["q"], hit["mode"], hit["country"], spec["months"], stats)
        site = PARTNERS["signals"][hit["signal"]].get("kind") == "site"
        kept = [ev for ev in ((evidence_from_site(r, hit, spec, skip["domain"]) if site
                               else evidence_from(r, hit, spec, skip["evidence"])) for r in rows) if ev]
        evidence += kept
        log.info("partners: %s -> %d results, %d kept", hit["q"], len(rows), len(kept))
    evidence = _verify_sites(fetcher, evidence, stats)
    evidence += _datasets(fetcher, spec, stats)
    _enrich_pages(fetcher, evidence, spec, stats)

    companies = [c for c in merge(evidence) if c["country"] in spec["countries"]]
    for c in companies:
        c["score"] = score(c, spec["months"])
    companies.sort(key=lambda c: c["score"], reverse=True)
    log.info("partners: %d companies after merging", len(companies))
    companies = _by_size(companies, apis, fetcher, scache, spec, stats)

    for i, c in enumerate(companies):
        if apis and not c["domain"] and i < ENRICH["domain_lookups"]:
            c["domain"] = find_domain(c, apis, fetcher, scache, skip["domain"], stats)
        if c["domain"] and is_public_site(f"https://{c['domain']}"):
            continue
        if apis and i < ENRICH["people_lookups"]:
            c["people"] = find_people(c, apis, fetcher, scache, stats)
        c["score"] = score(c, spec["months"])
    companies = [c for c in companies if not (c["domain"] and is_public_site(f"https://{c['domain']}"))]
    if spec["enrichContacts"]:
        enrich_people(fetcher, companies, cache, stats)
        for c in companies:
            c["score"] = score(c, spec["months"])
    companies.sort(key=lambda c: c["score"], reverse=True)

    for c in companies:
        c.update(template(c, spec["pastWork"]), polished=False)
    if spec["useModel"] and model_config():
        polish(companies, spec["pastWork"], cache, stats)
    return [public_row(c) for c in companies]
