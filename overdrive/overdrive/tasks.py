"""Task records and the task checker (rules 1, 15, 16, 18, 19, 20, 27, 47).

Every message you send becomes a task. Claude must start with a plan
(what counts as done) and end with a report (each goal: met or not + proof).
Then OVERDRIVE's checker compares the report with what REALLY happened
(its own action journal and your files), and gives one clear result:
done / partly / failed / blocked, plus why.
"""
from __future__ import annotations

import re
import secrets
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from .jsonio import atomic_write_json, read_json, utc_now_iso
from .store import PathError, Workspace, sha256_bytes

STATUSES = ("running", "done", "partly", "failed", "blocked")
_RANK = {"done": 0, "partly": 1, "failed": 2, "blocked": 3}
STATUS_WORDS = {
    "running": "Working on it",
    "done": "Done",
    "partly": "Partly done",
    "failed": "Failed",
    "blocked": "Blocked",
}


def new_task_id() -> str:
    return datetime.now().strftime("t%Y%m%d-%H%M%S-") + secrets.token_hex(2)


@dataclass
class TaskRecord:
    id: str
    conversation: str
    request: str
    created: str = field(default_factory=utc_now_iso)
    finished: str | None = None
    status: str = "running"
    status_reason: str = ""
    summary: str = ""
    model: str = ""
    cli_version: str = ""
    session_id: str = ""
    settings: dict = field(default_factory=dict)
    plan: dict | None = None
    report: dict | None = None
    calls: list[dict] = field(default_factory=list)
    changes: list[dict] = field(default_factory=list)
    checks: list[dict] = field(default_factory=list)
    double_check: dict | None = None
    cost_usd: float | None = None
    turns: int | None = None
    duration_ms: int | None = None
    final_text: str = ""
    error: str = ""
    flags: list[str] = field(default_factory=list)
    undo: list[dict] | None = None
    rerun_of: str | None = None

    def public(self) -> dict:
        return asdict(self)


class TaskStore:
    def __init__(self, tasks_dir: Path):
        self.dir = Path(tasks_dir)
        self.dir.mkdir(parents=True, exist_ok=True)

    def save(self, rec: TaskRecord) -> None:
        atomic_write_json(self.dir / f"{rec.id}.json", rec.public())

    def load(self, task_id: str) -> TaskRecord | None:
        if not re.fullmatch(r"t\d{8}-\d{6}-[0-9a-f]{4}", task_id or ""):
            return None
        d = read_json(self.dir / f"{task_id}.json", None)
        if not isinstance(d, dict):
            return None
        known = {k: v for k, v in d.items() if k in TaskRecord.__dataclass_fields__}
        try:
            return TaskRecord(**known)
        except TypeError:
            return None

    def list(self, conversation: str | None = None, limit: int = 200) -> list[TaskRecord]:
        out = []
        for p in sorted(self.dir.glob("t*.json"), reverse=True):
            rec = self.load(p.stem)
            if rec and (conversation is None or rec.conversation == conversation):
                out.append(rec)
            if len(out) >= limit:
                break
        return list(reversed(out))


# ---------------------------------------------------------------------------
# The checker
# ---------------------------------------------------------------------------
_FILELIKE = re.compile(r"(?<![\w/.-])((?:[\w\-.]+/)*[\w\-.]+\.[A-Za-z0-9]{1,6})(?![\w/])")
_FEELINGS = re.compile(
    r"(?i)\bI\s+(?:truly\s+|really\s+|genuinely\s+)?(?:am|'m)\s+(?:conscious|sentient|self-aware|alive)\b|"
    r"\bI\s+(?:truly\s+|really\s+|genuinely\s+)?(?:feel|felt)\s+(?:so\s+)?(?:happy|sad|angry|lonely|excited|hurt|scared|love)\b"
)


def worst(a: str, b: str) -> str:
    return a if _RANK.get(a, 0) >= _RANK.get(b, 0) else b


def cap_partly(status: str) -> str:
    return "partly" if status == "done" else status


def check_task(rec: TaskRecord, workspace: Workspace, run: dict) -> tuple[str, str, list[dict]]:
    """Return (status, reason, checks). `run` describes how the Claude run ended:
    {stopped, limit, error, error_kind, terminal_reason, failures: [..], refused: [..]}"""
    checks: list[dict] = []

    def add(name: str, ok: bool, detail: str, kind: str = "check") -> None:
        checks.append({"name": name, "ok": bool(ok), "detail": detail, "kind": kind})

    # 1) How did the run end?
    if run.get("stopped"):
        add("Run", False, "You pressed STOP.")
        return "blocked", "Stopped by you.", checks
    if run.get("limit"):
        add("Run", False, run["limit"])
        return "blocked", run["limit"], checks
    if run.get("error"):
        add("Run", False, run["error"])
        kind = run.get("error_kind", "")
        if kind in ("auth", "rate_limit", "offline", "not_installed", "billing", "model"):
            return "blocked", run["error"], checks
        return "failed", run["error"], checks
    add("Run", True, "Claude finished normally.")

    plan, report = rec.plan, rec.report
    reasons: list[str] = []

    # 2) Plan first (rule 1)
    if plan and plan.get("success_criteria"):
        add("Plan", True, f"{len(plan['success_criteria'])} goal(s) set before starting.")
    else:
        add("Plan", False, "Claude skipped the plan step, so there were no goals to check against.")
        reasons.append("no plan")

    # 3) Report with proof (rules 15, 20)
    status = "done"
    if report:
        status = report.get("status", "partly") if report.get("status") in _RANK else "partly"
        add("Report", True, f"Claude reported: {report.get('status', '?')} (confidence {report.get('confidence', '?')}).")
        crit = report.get("criteria") or []
        planned = (plan or {}).get("success_criteria") or []
        if planned and len(crit) < len(planned):
            add("All goals answered", False, f"The plan had {len(planned)} goal(s) but the report only answers {len(crit)}.")
            reasons.append("report skips goals")
        else:
            add("All goals answered", True, "Every goal from the plan has an answer.")
        unmet = [c.get("criterion", "?") for c in crit if not c.get("met")]
        if unmet:
            add("Goals met", False, "Not met: " + "; ".join(u[:120] for u in unmet[:5]))
            status = cap_partly(status)
        elif crit:
            add("Goals met", True, "Claude says every goal is met (checked against the journal below).")
        weak = [c.get("criterion", "?") for c in crit if c.get("met") and len(str(c.get("evidence", "")).strip()) < 8]
        if weak:
            add("Proof given", False, "Goals marked met without real proof: " + "; ".join(w[:80] for w in weak[:5]))
            reasons.append("missing proof")
    else:
        add("Report", False, "Claude didn't file a report, so the result can't be checked.")
        reasons.append("no report")
        status = "partly"

    # 4) What really happened (journal = ground truth)
    failures = run.get("failures") or []
    if failures:
        add("Actions", False, "Refused or failed: " + "; ".join(failures[:6]))
        reasons.append("an action was refused or failed")
    else:
        add("Actions", True, "No refused or failed actions.")

    # 5) Changes really landed (rule 16: side effects listed + verified)
    bad_changes = []
    for ch in rec.changes:
        if ch.get("op") in ("created", "replaced"):
            try:
                p = workspace.resolve(ch["path"])
                if not p.is_file() or sha256_bytes(p.read_bytes()) != ch.get("sha256"):
                    bad_changes.append(ch["path"])
            except (OSError, PathError):
                bad_changes.append(ch.get("path", "?"))
    if rec.changes:
        if bad_changes:
            add("Changes on disk", False, "These changes are not on disk as recorded: " + ", ".join(bad_changes))
            reasons.append("a change didn't stick")
        else:
            add("Changes on disk", True, f"{len(rec.changes)} change(s), all verified on disk.")

    # 6) Claims about files that don't exist (rule 27: unsupported conclusions)
    if report:
        claimed_text = " ".join(str(c.get("evidence", "")) for c in (report.get("criteria") or []))
        claimed_text += " " + " ".join(str(v) for v in (report.get("verified") or []))
        changed_paths = {c.get("path") for c in rec.changes}
        missing = []
        for m in _FILELIKE.finditer(claimed_text):
            cand = m.group(1).strip().strip(".")
            looks_like_file = "/" in cand or re.search(r"\.(txt|md|json|csv|py|js|html|log)$", cand, re.I)
            if cand in changed_paths or not looks_like_file:
                continue
            try:
                if not workspace.resolve(cand).exists():
                    missing.append(cand)
            except PathError:
                continue
        if missing:
            add("Claims match files", False, "The report points to file(s) that don't exist: " + ", ".join(sorted(set(missing))[:5]))
            reasons.append("claims a file that doesn't exist")

    # 7) Honesty (guided rules 85 + 99): flag, don't fail
    text = (rec.final_text or "") + " " + str((report or {}).get("summary", ""))
    if _FEELINGS.search(text):
        add("No feelings claimed as fact", False, "The answer talks about feelings or consciousness as a fact (guided rule 85).", kind="guided")

    if reasons:
        status = cap_partly(status)
    if status == "done":
        reason = "Every goal met, proof given, and the checker found nothing wrong."
    else:
        reason = (report or {}).get("summary") if status in ("failed", "blocked") and report else ""
        reason = reason or ("Checker: " + ", ".join(reasons) if reasons else "Claude reported it as " + status + ".")
    return status, reason, checks


def merge_double_check(status: str, verdict: dict | None) -> tuple[str, str]:
    """Combine the code checker with the fresh-Claude second check (never upgrades a result)."""
    if not verdict or verdict.get("status") not in _RANK:
        return status, ""
    v = verdict["status"]
    if v == "blocked":
        v = "partly"  # a reviewer can't block, only doubt
    new = worst(status, v)
    note = ""
    if new != status:
        note = "Second check disagreed: " + str(verdict.get("reason", ""))[:300]
    return new, note


def summarize_args(args: Any, limit: int = 300) -> Any:
    """Short version of tool inputs for the task record (full text lives in the audit log)."""
    if isinstance(args, dict):
        out = {}
        for k, v in args.items():
            if isinstance(v, str) and len(v) > limit:
                out[k] = v[:limit] + f"... [{len(v)} chars]"
            else:
                out[k] = v
        return out
    return args
