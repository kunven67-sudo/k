"""The schedule (Piece 3): jobs for later, like a calendar. "Work on this Friday at 3", "build it when my
5-hour usage resets", "every morning, check my projects".

A job is a message OVERDRIVE sends itself at that time (in a new chat or a chat you pick, in Chat or Build
mode). If the PC was off at that time, it runs when OVERDRIVE is back (or is skipped, your pick per job).
Jobs Claude suggests always ask you first; you can pause, change, delete or run any job yourself.
"""
from __future__ import annotations

import secrets
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from .jsonio import atomic_write_json, read_json, utc_now_iso

REPEATS = ("once", "daily", "weekly")
WHENS = ("time", "usage_reset")
MAX_JOBS = 100


def parse_local(s: str) -> datetime:
    """'2026-11-20T15:30' (the PC's local time) -> datetime."""
    try:
        return datetime.fromisoformat(str(s).strip()[:16])
    except ValueError:
        raise ValueError("Pick a date and time.")


class Schedule:
    def __init__(self, data_dir: Path):
        self.path = Path(data_dir) / "schedule.json"
        self.jobs: list[dict] = [j for j in (read_json(self.path, []) or []) if isinstance(j, dict) and j.get("id")]

    def _save(self) -> None:
        atomic_write_json(self.path, self.jobs)

    def get(self, jid: str) -> dict | None:
        return next((j for j in self.jobs if j["id"] == jid), None)

    @staticmethod
    def clean(d: dict) -> dict:
        text = str(d.get("text") or "").strip()
        if not text:
            raise ValueError("Say what it should do.")
        if len(text) > 8000:
            raise ValueError("That's too long for a job (8,000 characters max).")
        when = str(d.get("when") or "time")
        if when not in WHENS:
            raise ValueError("unknown 'when'")
        repeat = str(d.get("repeat") or "once")
        if repeat not in REPEATS:
            raise ValueError("unknown repeat")
        out: dict[str, Any] = {
            "title": " ".join(str(d.get("title") or text).split())[:80],
            "text": text, "when": when, "repeat": repeat if when == "time" else "once",
            "mode": d.get("mode") if d.get("mode") in ("chat", "build") else "chat",
            "conversation": str(d.get("conversation") or ""),
            "missed": d.get("missed") if d.get("missed") in ("run", "skip") else "run",
            "enabled": bool(d.get("enabled", True)),
        }
        if when == "time":
            at = parse_local(d.get("at") or "")
            out["at"] = at.strftime("%Y-%m-%dT%H:%M")
        return out

    def add(self, d: dict, by: str = "you") -> dict:
        if len(self.jobs) >= MAX_JOBS:
            raise ValueError(f"The schedule is full ({MAX_JOBS} jobs). Delete some old ones.")
        job = self.clean(d)
        if job["when"] == "time" and parse_local(job["at"]) < datetime.now() - timedelta(minutes=1) and job["repeat"] == "once":
            raise ValueError("That time already passed. Pick a time in the future.")
        job.update(id="j" + secrets.token_hex(4), created=utc_now_iso(), by=by, runs=[], last_run=None)
        self.jobs.append(job)
        self._save()
        return job

    def update(self, jid: str, d: dict) -> dict:
        job = self.get(jid)
        if job is None:
            raise ValueError("no such job")
        merged = self.clean({**job, **d})
        job.update(merged)
        self._save()
        return job

    def delete(self, jid: str) -> None:
        before = len(self.jobs)
        self.jobs = [j for j in self.jobs if j["id"] != jid]
        if len(self.jobs) == before:
            raise ValueError("no such job")
        self._save()

    def next_time(self, job: dict) -> datetime | None:
        if job["when"] != "time":
            return None
        return parse_local(job["at"])

    def due(self, now: datetime, reset_check, started_at: float) -> list[dict]:
        """Jobs to run now. A time job is due when its time has come; usage_reset jobs when the 5-hour
        window has reset since the job was made."""
        out = []
        for j in self.jobs:
            if not j.get("enabled"):
                continue
            if j["when"] == "time":
                at = parse_local(j["at"])
                if at > now:
                    continue
                missed_while_off = at.timestamp() < started_at - 60 and not j.get("last_run")
                if missed_while_off and j["missed"] == "skip":
                    self._advance(j, now, skipped=True)
                    continue
                out.append(j)
            elif reset_check(j):
                out.append(j)
        return out

    def _advance(self, job: dict, now: datetime, skipped: bool = False) -> None:
        if job["when"] == "time" and job["repeat"] != "once":
            step = timedelta(days=1 if job["repeat"] == "daily" else 7)
            at = parse_local(job["at"])
            while at <= now:
                at += step
            job["at"] = at.strftime("%Y-%m-%dT%H:%M")
        else:
            job["enabled"] = False
            job["finished"] = True
        if skipped:
            job.setdefault("runs", []).append({"ts": utc_now_iso(), "skipped": True})
        self._save()

    def mark_ran(self, job: dict, task_id: str, conversation: str, now: datetime | None = None) -> None:
        job["last_run"] = utc_now_iso()
        job.setdefault("runs", []).append({"ts": job["last_run"], "task": task_id, "conversation": conversation})
        del job["runs"][:-20]
        if not job.get("conversation"):
            job["conversation_made"] = conversation
        self._advance(job, now or datetime.now())


def reset_passed(rate_limits: dict, since: float) -> bool:
    """Has the 5-hour usage window reset since `since` (a job's creation)?"""
    e = rate_limits.get("five_hour") or {}
    r = e.get("resets_at")
    if isinstance(r, (int, float)):
        return since < r <= time.time()
    u = e.get("utilization")
    return isinstance(u, (int, float)) and u < 0.05 and e.get("seen", 0) > since


# ---------------------------------------------------------------- the tool Claude uses (always asks you first)
def make_schedule_tool(od):
    from .permissions import Risk
    from .tools import ToolResult, ToolSpec

    async def handler(args: dict, ctx) -> ToolResult:
        try:
            job = od.schedule.add({**args, "conversation": ctx.task.conversation if args.get("same_chat") and ctx.task else ""},
                                  by="OVERDRIVE (you said Yes)")
        except ValueError as e:
            return ToolResult(text=f"Couldn't schedule it: {e}", is_error=True)
        od.events.publish("schedule", jobs=od.schedule.jobs)
        when = job.get("at", "").replace("T", " at ") if job["when"] == "time" else "when the 5-hour usage resets"
        return ToolResult(text=f"Scheduled “{job['title']}” for {when} ({job['repeat']}, {job['mode']} mode). "
                               "The human can see, change or delete it on the Schedule page.")

    def preview(args: dict, ctx) -> dict:
        when = str(args.get("at", "")).replace("T", " at ") if args.get("when", "time") == "time" else "when your 5-hour usage resets"
        return {"plan": f"{args.get('title') or ''}\n\n{args.get('text', '')}",
                "steps": [f"When: {when}", f"Repeat: {args.get('repeat', 'once')}", f"Mode: {args.get('mode', 'chat')}",
                          "If the PC is off then: " + ("skip it" if args.get("missed") == "skip" else "run it when the PC is back")],
                "model": "uses your usage when it runs", "note": "Yes = add it to your Schedule (you can change or delete it there)."}

    return ToolSpec(
        name="schedule_job", title="Schedule a job for later",
        description=("Put a job on the human's schedule (like a calendar): OVERDRIVE sends itself `text` at that time "
                     "and does it. Use when the human wants something done later, on a certain day, every day/week, "
                     "or 'when my usage resets'. 'at' is the PC's local time like 2026-11-20T15:30 (check get_time "
                     "first). The human always says Yes first."),
        schema={"type": "object", "properties": {
            "title": {"type": "string", "minLength": 1, "maxLength": 80},
            "text": {"type": "string", "minLength": 1, "maxLength": 8000, "description": "What to do, as a full message."},
            "when": {"type": "string", "enum": ["time", "usage_reset"]},
            "at": {"type": "string", "pattern": r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$"},
            "repeat": {"type": "string", "enum": ["once", "daily", "weekly"]},
            "mode": {"type": "string", "enum": ["chat", "build"]},
            "missed": {"type": "string", "enum": ["run", "skip"]},
            "same_chat": {"type": "boolean", "description": "true = run it in this chat, false = a new chat"},
            "reason": {"type": "string", "maxLength": 400}},
            "required": ["title", "text"], "additionalProperties": False},
        risk=Risk.INTERNAL, handler=handler, preview=preview, selftest="test_schedule_jobs",
        limitations=["Runs only while OVERDRIVE is running (turn on Keep running / Start with Windows).",
                     "A job that runs uses your usage like a normal message."])
