"""Single-sheet Excel store + a small JSON state file.

The workbook has ONE sheet ('leads'), one row per decision maker (or one row per
company until a person is found). Writes are atomic: we write a temp file and
rename it over the real one, so a crash can never leave a half-written workbook.
"""
import io
import json
import logging
import os
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Union

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

log = logging.getLogger(__name__)

SHEET = "leads"
COLUMNS = [
    "company", "domain", "company_linkedin", "india", "country", "segment", "intent", "intent_score",
    "intent_signals", "early", "founded", "stage",
    "team_size", "source", "source_ref", "signal", "signal_url", "date_found",
    "full_name", "title", "linkedin_url",
    "email", "email_type", "email_source", "email_candidates", "verified_status",
    "phone", "score", "ready", "status", "last_updated",
]

# Pipeline statuses, in order. Terminal: 'verified', 'no_contact'.
DISCOVERED = "discovered"
PEOPLE_FOUND = "people_found"   # named decision maker(s) found
SCRAPED = "scraped"             # site scraped, no named person (company-level row)
EMAIL_FOUND = "email_found"     # we have at least one candidate address to verify
VERIFIED = "verified"
NO_CONTACT = "no_contact"       # nothing usable found; kept for the record

_COL_WIDTHS = {
    "company": 24, "domain": 22, "company_linkedin": 34, "segment": 18, "intent": 8, "intent_score": 8, "intent_signals": 50, "early": 7, "founded": 9, "stage": 12, "team_size": 10, "india": 7, "country": 11, "source": 18, "source_ref": 22, "signal": 40,
    "signal_url": 30, "date_found": 12, "full_name": 22, "title": 22, "linkedin_url": 30,
    "email": 30, "email_type": 11, "email_source": 16, "email_candidates": 30,
    "verified_status": 14, "phone": 16, "score": 7, "ready": 7, "status": 14,
    "last_updated": 18,
}


def fill_country(df: pd.DataFrame) -> pd.DataFrame:
    """Sheets from before the country column: companies marked Indian are in India."""
    if "country" not in df.columns:
        df["country"] = ""
    df.loc[(df["country"] == "") & (df["india"] == "yes"), "country"] = "India"
    return df


class Candidate:
    """A company found by a discovery source."""

    def __init__(self, name, domain, source, signal, signal_url="", source_ref="", india="",
                 segment="", founded=None, stage="", team_size=None, phone="",
                 person_name="", person_title=""):
        self.name = name or domain
        self.domain = domain
        self.source = source
        self.signal = signal
        self.signal_url = signal_url
        self.source_ref = source_ref
        self.india = india  # 'yes' / 'no' / '' (unknown) / 'global' (from a global list: any country) -- see geo.py
        self.segment = segment if isinstance(segment, str) else ", ".join(segment)  # segments.py
        self.founded = founded      # year, if the source knows it   -- see early.py
        self.stage = stage          # last funding round, normalised
        self.team_size = team_size
        self.phone = phone          # if the source lists one (e.g. Google Maps)
        self.person_name = person_name
        self.person_title = person_title


def _strip_hon(name: str) -> str:
    import re as _re
    return _re.sub(r"^(?:dr|mr|mrs|ms|miss|prof|er|sri|shri|smt)\.?\s+", "", name or "", flags=_re.I)


def to_xlsx(df: pd.DataFrame, dest: Union[Path, None] = None) -> io.BytesIO:
    """Plain Excel file (filters, frozen header). Text from websites starting with '=' is stored
    as text, never as a live formula. Written to dest if given (atomically), else returned."""
    wb = Workbook()
    ws = wb.active
    ws.title = SHEET
    cols = list(df.columns)
    ws.append(cols)
    for row in df.itertuples(index=False):
        ws.append(list(row))
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            if isinstance(cell.value, str) and cell.value.startswith("="):
                cell.data_type = "s"
    ws.freeze_panes = "A2"
    if cols:
        ws.auto_filter.ref = ws.dimensions
    for i, col in enumerate(cols, 1):
        width = max([len(str(col))] + [len(str(v)) for v in df[col].head(200)]) if len(df) else len(col)
        ws.column_dimensions[get_column_letter(i)].width = min(max(width + 2, 8), 50)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    if dest is not None:
        tmp = dest.with_suffix(".tmp")
        tmp.write_bytes(buf.getvalue())
        os.replace(tmp, dest)
        buf.seek(0)
    return buf


LEAD_KEY = ["domain", "full_name", "email"]


def _empty_row() -> dict:
    return {c: "" for c in COLUMNS}


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


class Store:
    def __init__(self, data_dir: Path):
        self.dir = Path(data_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.xlsx = self.dir / "leads.xlsx"
        self.state_path = self.dir / "state.json"
        self.df = self._load_df()
        self.state = self._load_state()

    # ---------- loading ----------
    def _load_df(self) -> pd.DataFrame:
        if self.xlsx.exists():
            df = pd.read_excel(self.xlsx, sheet_name=SHEET, dtype=str, keep_default_na=False)
            for c in COLUMNS:
                if c not in df.columns:
                    df[c] = ""
            return fill_country(df[COLUMNS].astype(object).reset_index(drop=True))
        return pd.DataFrame(columns=COLUMNS, dtype=object)

    def _load_state(self) -> dict:
        base = {"rejected": {}, "attempts": {}, "catch_all": {}, "cursors": {}}
        if self.state_path.exists():
            try:
                base.update(json.loads(self.state_path.read_text()))
            except json.JSONDecodeError:
                log.error("state.json is corrupt; starting with empty state")
        return base

    # ---------- saving ----------
    def save(self) -> None:
        df = self.df.copy()
        df["score"] = pd.to_numeric(df["score"], errors="coerce").fillna(0).astype(int)
        df = df.sort_values(["score", "date_found"], ascending=[False, False], kind="stable")
        tmp = self.dir / "leads.tmp.xlsx"
        with pd.ExcelWriter(tmp, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name=SHEET, index=False)
            ws = writer.sheets[SHEET]
            ws.freeze_panes = "C2"
            ws.auto_filter.ref = ws.dimensions
            header_fill = PatternFill("solid", fgColor="D9E2F3")
            for idx, name in enumerate(COLUMNS, start=1):
                cell = ws.cell(row=1, column=idx)
                cell.font = Font(name="Arial", bold=True, size=10)
                cell.fill = header_fill
                cell.alignment = Alignment(vertical="center")
                ws.column_dimensions[get_column_letter(idx)].width = _COL_WIDTHS.get(name, 16)
            body_font = Font(name="Arial", size=10)
            for row in ws.iter_rows(min_row=2):
                for cell in row:
                    cell.font = body_font
                    if isinstance(cell.value, str) and cell.value.startswith("="):
                        cell.data_type = "s"  # scraped text, never a live Excel formula
        os.replace(tmp, self.xlsx)
        self.state_path.write_text(json.dumps(self.state, indent=1, sort_keys=True))

    def row_keys(self) -> Set[str]:
        """One key per company-or-person row (company + person name)."""
        return set(self.df["domain"] + "|" + self.df["full_name"])

    def snapshot(self) -> dict:
        """What the sheet holds before a run, to report afterwards what the run added."""
        return {"started": _now(), "rows": self.row_keys(), "ready": self.ready_keys(),
                "domains": set(self.df["domain"]), "delivered": set(self.state.get("delivered", {}))}

    def tidy_people(self) -> Set[str]:
        """Remove person rows that are not real people or repeat someone: same person under another
        spelling ('Dr. X' / 'X'), or the same email twice at one company. A company never
        disappears: if its only row was a fake person it becomes a company-level row again.
        Returns the domains that changed."""
        from .util import clean_name, looks_like_name, person_key

        drop: List[int] = []
        changed: Set[str] = set()
        for dom, rows in self.df.groupby("domain", sort=False):
            seen_names, seen_emails = set(), set()
            order = rows.assign(_s=pd.to_numeric(rows["score"], errors="coerce").fillna(0)) \
                        .sort_values("_s", ascending=False, kind="stable").index
            kept = 0
            for i in order:
                name, email = self.df.at[i, "full_name"], self.df.at[i, "email"].lower()
                key = person_key(name)
                bad = name and not looks_like_name(clean_name(_strip_hon(name)))
                dup = (name and key in seen_names) or (email and email in seen_emails)
                if bad or dup:
                    drop.append(i)
                    continue
                kept += 1
                if name:
                    seen_names.add(key)
                if email:
                    seen_emails.add(email)
            if any(i in drop for i in rows.index):
                changed.add(dom)
            if kept == 0 and drop:  # keep the company: turn its first row back into a company row
                first = drop.pop(drop.index(rows.index[0])) if rows.index[0] in drop else drop.pop()
                self.set(first, full_name="", title="", linkedin_url="", email="", email_candidates="",
                         email_source="", email_type="", verified_status="", status=SCRAPED)
        if drop:
            self.df = self.df.drop(index=drop).astype(object).reset_index(drop=True)
        return changed

    def rewrite_day_sheets(self, domains: Set[str], extra=None) -> List[str]:
        """Bring the day sheets holding these (already delivered) companies up to date."""
        delivered = self.state.get("delivered", {})
        days = sorted({delivered[d] for d in domains if d in delivered})
        (self.dir / "new").mkdir(exist_ok=True)
        for day in days:
            out = self.dir / "new" / f"leads_{day}.xlsx"
            mine = [d for d, dd in delivered.items() if dd == day]
            rows = self.df[self.df["domain"].isin(mine)].copy()
            rows = rows.assign(_r=(rows["ready"] == "yes").astype(int),
                               _s=pd.to_numeric(rows["score"], errors="coerce").fillna(0))
            rows = rows.sort_values(["_r", "_s"], ascending=False).drop(columns=["_r", "_s"])
            if extra:
                rows = extra(rows)
            to_xlsx(rows, out)
        return days

    def deliver_new_companies(self, day: Optional[str] = None, extra=None) -> Dict[str, int]:
        """Each company goes into exactly one day sheet, data/new/leads_<day>.xlsx: the day it was
        first fully processed (website read, people and emails looked for). Later runs never put
        it in another day's sheet. Returns {day: companies added}. `extra(df)` may add columns.

        The first time (no record yet) every company already done is filed under the day it was
        found, so existing data becomes day sheets and is not repeated as 'new' today."""
        today = day or date.today().isoformat()
        first_time = "delivered" not in self.state
        delivered = self.state.setdefault("delivered", {})
        pending = set(self.df.loc[self.df["status"].isin([DISCOVERED, PEOPLE_FOUND, SCRAPED, EMAIL_FOUND]), "domain"])
        done = self.df[~self.df["domain"].isin(pending)]  # every row of the company is finished
        fresh = [d for d in done["domain"].drop_duplicates() if d not in delivered]
        by_day: Dict[str, List[str]] = {}
        for d in fresh:
            found = (done.loc[done["domain"] == d, "date_found"].iloc[0] or "")[:10]
            by_day.setdefault(found if first_time and found else today, []).append(d)
        folder = self.dir / "new"
        folder.mkdir(exist_ok=True)
        for d_day, domains in by_day.items():
            rows = self.df[self.df["domain"].isin(domains)].copy()
            out = folder / f"leads_{d_day}.xlsx"
            if out.exists():
                old = pd.read_excel(out, dtype=str, keep_default_na=False)
                rows = pd.concat([old[~old["domain"].isin(domains)], rows.astype(str)])
            rows = rows.assign(_r=(rows["ready"] == "yes").astype(int),
                               _s=pd.to_numeric(rows["score"], errors="coerce").fillna(0))
            rows = rows.sort_values(["_r", "_s"], ascending=False).drop(columns=["_r", "_s"])
            rows = rows[[c for c in COLUMNS if c in rows.columns]]
            if extra:
                rows = extra(rows)
            to_xlsx(rows, out)
            for dmn in domains:
                delivered[dmn] = d_day
        return {k: len(v) for k, v in by_day.items()}

    def write_run_summary(self, before: dict, new_file: Optional[Path]) -> dict:
        """data/new/last_run.json: what the latest run added, for the web page."""
        new_rows = sorted(self.row_keys() - before["rows"])
        new_ready = sorted(self.ready_keys() - before["ready"])
        summary = {
            "started": before["started"], "finished": _now(),
            # companies this run finished and put into a day sheet (found today or earlier)
            "new_companies": len(set(self.state.get("delivered", {})) - before.get("delivered", set()))
            if "delivered" in self.state else len(set(self.df["domain"]) - before["domains"]),
            "new_people": sum(1 for k in new_rows if not k.endswith("|")),
            "new_ready": len(new_ready),
            "new_rows": new_rows, "new_ready_keys": new_ready,
            "file": new_file.name if new_file else "",
        }
        folder = self.dir / "new"
        folder.mkdir(exist_ok=True)
        tmp = folder / "last_run.tmp"
        tmp.write_text(json.dumps(summary, indent=1), encoding="utf-8")
        os.replace(tmp, folder / "last_run.json")
        return summary

    def ready_keys(self) -> Set[str]:
        """Identity of every ready lead, to tell afterwards which ones a run added."""
        df = self.df[self.df["ready"] == "yes"]
        return set(df[LEAD_KEY].agg("|".join, axis=1))

    def write_new_leads(self, before: Set[str], day: Optional[str] = None) -> Optional[Path]:
        """Leads that became ready since `before` -> data/new/leads_<day>.xlsx (added to any
        earlier run that day). Returns the file, or None when nothing is new."""
        df = self.df[self.df["ready"] == "yes"]
        new = df[~df[LEAD_KEY].agg("|".join, axis=1).isin(before)] if len(df) else df
        if new.empty:
            return None
        folder = self.dir / "new"
        folder.mkdir(exist_ok=True)
        out = folder / f"leads_{day or date.today().isoformat()}.xlsx"
        if out.exists():
            old = pd.read_excel(out, dtype=str, keep_default_na=False)
            new = pd.concat([old, new.astype(str)]).drop_duplicates(LEAD_KEY, keep="last")
        new = new.assign(_s=pd.to_numeric(new["score"], errors="coerce").fillna(0))
        new = new.sort_values("_s", ascending=False).drop(columns="_s")
        to_xlsx(new[[c for c in COLUMNS if c in new.columns]], out)
        return out

    def backup(self, keep: int = 30) -> None:
        if not self.xlsx.exists():
            return
        bdir = self.dir / "backups"
        bdir.mkdir(exist_ok=True)
        target = bdir / f"leads-{date.today().isoformat()}.xlsx"
        if not target.exists():
            shutil.copy2(self.xlsx, target)
        old = sorted(bdir.glob("leads-*.xlsx"))
        for p in old[:-keep]:
            p.unlink(missing_ok=True)

    # ---------- state helpers ----------
    def reject(self, domain: str, reason: str) -> None:
        self.state["rejected"][domain] = reason

    def is_rejected(self, domain: str) -> bool:
        return domain in self.state["rejected"]

    def bump_attempts(self, domain: str) -> int:
        n = int(self.state["attempts"].get(domain, 0)) + 1
        self.state["attempts"][domain] = n
        return n

    # ---------- row helpers ----------
    def known_domains(self) -> set:
        return set(self.df["domain"]) | set(self.state["rejected"])

    def add_candidate(self, c: Candidate) -> str:
        """Add or merge. Returns 'new', 'merged' or 'skipped'."""
        if self.is_rejected(c.domain):
            return "skipped"
        existing = self.df.index[self.df["domain"] == c.domain]
        if len(existing):
            i = existing[0]
            if c.india == "yes":
                for j in existing:
                    self.df.at[j, "india"] = "yes"
            self.merge_evidence(c.domain, segment=c.segment, founded=c.founded, stage=c.stage,
                                team_size=c.team_size)
            person = getattr(c, "person_name", "") or ""
            title = getattr(c, "person_title", "") or ""
            if person and not self.df.at[i, "full_name"]:
                self.df.at[i, "full_name"] = person
                self.df.at[i, "title"] = title
                if self.df.at[i, "status"] in (DISCOVERED, SCRAPED):
                    self.df.at[i, "status"] = PEOPLE_FOUND
            sources = set(filter(None, self.df.at[i, "source"].split(", ")))
            if c.source not in sources:
                for j in existing:
                    self.df.at[j, "source"] = ", ".join(sorted(sources | {c.source}))
                    sig = self.df.at[j, "signal"]
                    self.df.at[j, "signal"] = f"{sig} | {c.signal}" if sig else c.signal
                return "merged"
            return "skipped"
        row = _empty_row()
        person = getattr(c, "person_name", "") or ""
        title = getattr(c, "person_title", "") or ""
        status = PEOPLE_FOUND if person else DISCOVERED
        row.update(
            company=c.name, domain=c.domain, india=c.india, segment=c.segment,
            founded=str(c.founded or ""), stage=c.stage or "", team_size=str(c.team_size or ""),
            source=c.source, source_ref=c.source_ref,
            signal=c.signal, signal_url=c.signal_url, date_found=date.today().isoformat(),
            full_name=person, title=title,
            status=status, last_updated=_now(), phone=getattr(c, "phone", "") or "",
        )
        self._append(row)
        return "new"

    def merge_evidence(self, domain: str, segment="", founded=None, stage="", team_size=None) -> None:
        """Fold new facts into every row of a domain: segments are unioned, the earliest founding
        year, the latest funding round and the largest team size win."""
        from .early import STAGE_ORDER as order
        from .segments import join

        for j in self.df.index[self.df["domain"] == domain]:
            if segment:
                self.df.at[j, "segment"] = join(self.df.at[j, "segment"], segment)
            old = int(self.df.at[j, "founded"] or 0)
            if founded and (not old or int(founded) < old):
                self.df.at[j, "founded"] = str(founded)
            old_stage = self.df.at[j, "stage"]
            if stage and (old_stage not in order or order.index(stage) > order.index(old_stage)):
                self.df.at[j, "stage"] = stage
            old_team = int(self.df.at[j, "team_size"] or 0)
            if team_size and int(team_size) > old_team:
                self.df.at[j, "team_size"] = str(team_size)

    def _append(self, row: dict) -> None:
        """Append a row. Rebuilds with object dtype so pandas 2.x and 3.x behave the same."""
        new = pd.DataFrame([[row[c] for c in COLUMNS]], columns=COLUMNS, dtype=object)
        self.df = pd.concat([self.df.astype(object), new], ignore_index=True)

    def drop_domain(self, domain: str) -> None:
        self.df = self.df[self.df["domain"] != domain].astype(object).reset_index(drop=True)

    def indices_with_status(self, statuses: Iterable[str]) -> List[int]:
        return list(self.df.index[self.df["status"].isin(list(statuses))])

    def domain_indices(self, domain: str) -> List[int]:
        return list(self.df.index[self.df["domain"] == domain])

    def set(self, idx: int, **fields) -> None:
        for k, v in fields.items():
            self.df.at[idx, k] = "" if v is None else str(v)
        self.df.at[idx, "last_updated"] = _now()

    def clone_row(self, idx: int, **fields) -> int:
        row = self.df.loc[idx].to_dict()
        row.update({k: ("" if v is None else str(v)) for k, v in fields.items()})
        row["last_updated"] = _now()
        self._append(row)
        return len(self.df) - 1

    def stats(self) -> dict:
        df = self.df
        return {
            "rows": len(df),
            "companies": df["domain"].nunique(),
            "by_status": df["status"].value_counts().to_dict(),
            "with_name": int((df["full_name"] != "").sum()),
            "with_email": int((df["email"] != "").sum()),
            "verified_valid": int((df["verified_status"] == "valid").sum()),
            "with_phone": int((df["phone"] != "").sum()),
            "ready": int((df["ready"] == "yes").sum()),
            "india_yes": int(df.loc[df["india"] == "yes", "domain"].nunique()),
            "early_yes": int(df.loc[df["early"] == "yes", "domain"].nunique()),
            "intent": df.drop_duplicates("domain")["intent"].replace("", "not scored").value_counts().to_dict()
                      if len(df) else {},
            "by_segment": df.drop_duplicates("domain")["segment"].str.split(", ").explode()
                            .replace("", "unknown").value_counts().to_dict() if len(df) else {},
            "by_source": df.drop_duplicates("domain")["source"].str.split(", ").explode()
                           .value_counts().to_dict() if len(df) else {},
            "rejected_domains": len(self.state["rejected"]),
        }
