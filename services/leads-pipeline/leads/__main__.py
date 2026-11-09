"""Command line entry point:  python -m leads run | stats"""
import argparse
import dataclasses
import datetime
import json
import logging
import os
import sys
import traceback

import requests

try:
    import fcntl
except ImportError:  # Windows
    fcntl = None
    import msvcrt

from . import stages
from .config import load_settings
from .profile import GPU, LABELS
from .fetch import Fetcher
from .store import Store
from .util import setup_logging

log = logging.getLogger("leads")
ALL_STAGES = ["discover", "scrape", "people", "emails", "verify"]


def _alert(url: str, text: str) -> None:
    if not url:
        return
    try:
        requests.post(url, json={"text": text, "content": text}, timeout=10)
    except requests.RequestException:
        pass


def _try_lock(fh) -> bool:
    try:
        if fcntl:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        else:
            msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
        return True
    except OSError:  # BlockingIOError on POSIX, PermissionError on Windows
        return False


def cmd_run(args) -> int:
    s = load_settings()
    if args.batch:
        s.batch_size = args.batch
    s.data_dir.mkdir(parents=True, exist_ok=True)

    lock = open(s.data_dir / ".lock", "w")  # one run at a time per profile
    if not _try_lock(lock):
        log.warning("another %s run is in progress; exiting", s.profile)
        return 0
    log.info("profile: %s (%s), data in %s", s.profile, LABELS[s.profile], s.data_dir)

    fetcher = None
    try:
        store = Store(s.data_dir)
        store.backup()
        before = store.snapshot()
        fetcher = Fetcher(s)
        wanted = args.stages.split(",") if args.stages else ALL_STAGES
        only = args.sources.split(",") if args.sources else None
        skip = {x.strip() for x in os.getenv("SKIP_SOURCES", "").split(",") if x.strip()}
        if skip and not only:  # SKIP_SOURCES in .env: every default source except these
            only = sorted(set(stages.SOURCES) - set(stages.OFF_BY_DEFAULT) - skip)

        unknown = [st for st in wanted if st not in ALL_STAGES]
        if unknown:
            log.error("unknown stage %r", unknown[0])
            return 2
        from .people_search import google_url

        def with_find_link(df):  # no person yet: the same people search, for opening by hand
            df = df.copy()
            df["find_people"] = [google_url(c) if not n else "" for c, n in zip(df["company"], df["full_name"])]
            return df

        def publish():
            """Tidy, put finished companies into the day sheet, refresh the Latest run panel."""
            tidied = store.tidy_people()
            if tidied:
                stages.score_stage(s, store)
                redone = store.rewrite_day_sheets(tidied, extra=with_find_link)
                log.info("tidy: cleaned duplicate or non-person rows at %d companies%s", len(tidied),
                         f" (day sheets updated: {', '.join(redone)})" if redone else "")
            # companies already in a day sheet whose rows this run finished (e.g. emails checked
            # later): bring their day sheet up to date
            touched = set(store.df.loc[store.df["last_updated"] >= before["started"], "domain"])
            redone = store.rewrite_day_sheets(touched & set(store.state.get("delivered", {})), extra=with_find_link)
            days = store.deliver_new_companies(extra=with_find_link)
            store.save()
            if days:
                log.info("day sheets: %s", ", ".join(f"{d}: +{n} companies" for d, n in sorted(days.items())))
            today_file = s.data_dir / "new" / f"leads_{datetime.date.today().isoformat()}.xlsx"
            return store.write_run_summary(before, today_file if today_file.exists() else None)

        if "discover" in wanted:
            stages.recheck_sheet(s, store)
            stages.discover_stage(s, store, fetcher, only)
            stages.score_stage(s, store)
            store.save()

        # The rest runs in rounds of ROUND_SIZE companies: read sites, find people and emails, check them,
        # then publish, so finished companies reach the day sheet every round, not only at the end.
        enrich = [st for st in wanted if st != "discover"]
        attempted, searches_left, done_n, rnd = set(), s.search_max_per_run, 0, 0
        added = None
        while enrich:
            rnd += 1
            size = max(1, min(s.round_size or s.batch_size, s.batch_size - done_n))
            r = dataclasses.replace(s, batch_size=size, search_max_per_run=searches_left)
            before_round = len(attempted)
            for st in enrich:
                if st == "scrape":
                    stages.scrape_stage(r, store, fetcher, attempted,
                                        progress=f"{done_n + 1}-{done_n + size} of {s.batch_size}: ")
                elif st == "people":
                    searches_left -= stages.people_stage(r, store, fetcher)["searched"]
                elif st == "emails":
                    stages.emails_stage(r, store)
                elif st == "verify":
                    stages.verify_stage(r, store)
                stages.score_stage(s, store)
                store.save()  # save after every stage so progress is never lost
            done_n += len(attempted) - before_round
            added = publish()
            log.info("round %d done: %d of %d companies read; so far this run: +%d companies, "
                     "+%d people, +%d ready", rnd, done_n, s.batch_size, added["new_companies"],
                     added["new_people"], added["new_ready"])
            if "scrape" not in enrich or done_n >= s.batch_size or len(attempted) == before_round:
                break
        if added is None:
            added = publish()
        log.info("this run added: %d companies, %d people, %d ready leads%s", added["new_companies"],
                 added["new_people"], added["new_ready"],
                 f" -> {s.data_dir / 'new' / added['file']}" if added["file"] else "")
        log.info("done: %s", json.dumps(store.stats()))
        return 0
    except Exception as e:
        log.exception("pipeline crashed")
        _alert(s.alert_webhook_url, f"Lead pipeline crashed: {e}\n{traceback.format_exc()[-1500:]}")
        return 1
    finally:
        if fetcher is not None:
            fetcher.close()
        lock.close()


def cmd_stats(args) -> int:
    s = load_settings()
    print(json.dumps(Store(s.data_dir).stats(), indent=2))
    return 0


def main() -> int:
    setup_logging()
    p = argparse.ArgumentParser(prog="leads")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="run the pipeline")
    r.add_argument("--stages", help=f"comma list from {ALL_STAGES} (default: all)")
    r.add_argument("--sources", help=f"comma list from {list(stages.SOURCES)} (default: all)")
    r.add_argument("--batch", type=int, help="override BATCH_SIZE")
    st = sub.add_parser("stats", help="print counts from the workbook")
    for sp in (r, st):  # read before import by profile.current(); listed here for --help
        sp.add_argument("--profile", choices=list(LABELS), default=GPU,
                        help="gpu (default) or training: separate data, settings, sources and rules")
    r.set_defaults(func=cmd_run)
    st.set_defaults(func=cmd_stats)
    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
