"""While you're away (Piece 3). When the PC has had no mouse or keyboard input for a while:

1. BUG HUNT (zero usage): checks your projects one by one on the PC (bughunt.py). Only looks, fixes nothing.
2. LEARN (uses a little usage, capped): it picks a topic tied to your projects or something it wants to get
   better at, reads about it on the web, and saves a few short lessons to memory. Capped at 5% or 10% of
   your 5-hour Claude limit per day (your pick), and it never starts when your usage is already high.
When you come back it tells you what happened ("While you were away: learned 3 things, found 10 bugs").
Both have an on/off switch. Your own messages always go first: a learning run stops when you send one.
"""
from __future__ import annotations

import asyncio
import ctypes
import platform
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from .bughunt import BugBook, hunt_project
from .jsonio import atomic_write_json, read_json, utc_now_iso

LEARN_GAP_S = 40 * 60          # at most one learning run every 40 minutes
LEARN_GUESS_PCT = 2.5          # when Claude Code doesn't report the 5-hour meter, count each run as this much
AWAY_TITLE = "While you were away"

LEARN_PROMPT = """LEARN TIME. The human is away from the PC, so you're running by yourself to get smarter for them \
(they turned this on, with a small daily usage cap).
1. Pick ONE topic. Best: something that helps one of the human's open projects or plans (check memory_recall / \
memory_list first), or something you got wrong or want to get better at.{wants}
2. Look it up: WebSearch, then read 1-3 good sources with WebFetch. Real facts only.
3. Save at most 3 short lessons with memory_remember (kind fact or experience, tags: learned + the topic). Each one \
must be useful later and must not repeat something already in memory.
4. End with 2-3 plain lines: what you learned and how it helps. Keep the whole run short: no long reports."""


def idle_seconds() -> float | None:
    """Seconds since the last mouse/keyboard input on this PC (Windows GetLastInputInfo; no hooks).
    None = can't tell on this system (then OVERDRIVE never thinks you're away)."""
    if platform.system() != "Windows":
        return None
    try:
        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]
        info = LASTINPUTINFO()
        info.cbSize = ctypes.sizeof(info)
        if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):  # type: ignore[attr-defined]
            return None
        now = ctypes.windll.kernel32.GetTickCount() & 0xFFFFFFFF           # type: ignore[attr-defined]
        return ((now - info.dwTime) & 0xFFFFFFFF) / 1000.0
    except Exception:
        return None


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


class Away:
    def __init__(self, od: Any, idle_fn: Callable[[], float | None] = idle_seconds):
        self.od = od
        self.idle_fn = idle_fn
        self.dir = od.paths.data / "away"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.dir / "state.json"
        self.state: dict = read_json(self.state_path, {}) or {}
        self.state.setdefault("learn_days", {})
        self.state.setdefault("reports", [])
        self.bugs = BugBook(od.paths.data)
        self.away = False
        self.since: float | None = None
        self.session: dict = {}
        self.hunt_task: asyncio.Task | None = None
        self.hunting: str = ""
        self.learn_task_id: str = ""
        self.learn_before: float | None = None
        self.last_tick = 0.0
        self.last_auto_done = ""

    # ------------------------------------------------------------------ state
    def _save(self) -> None:
        keep = sorted(self.state["learn_days"])[-30:]
        self.state["learn_days"] = {k: self.state["learn_days"][k] for k in keep}
        self.state["reports"] = self.state["reports"][-30:]
        atomic_write_json(self.state_path, self.state)

    def learn_used_today(self) -> float:
        return float(self.state["learn_days"].get(_today(), {}).get("pct", 0.0))

    def five_hour(self) -> float | None:
        e = self.od.usage.rate_limits.get("five_hour") or {}
        u = e.get("utilization")
        resets = e.get("resets_at")
        if isinstance(resets, (int, float)) and resets < time.time():
            return 0.0
        return float(u) * 100 if isinstance(u, (int, float)) else None

    def public(self) -> dict:
        s = self.od.settings
        return {"away": self.away, "since": self.since, "hunting": self.hunting,
                "learning": bool(self.learn_task_id), "learn_used_pct": round(self.learn_used_today(), 2),
                "learn_cap_pct": int(s.get("away_learn_cap")), "idle_known": self.idle_fn() is not None,
                "reports": self.state["reports"][-10:], "conversation": self.state.get("conversation", ""),
                "bugs_open": len(self.bugs.open_bugs())}

    # ------------------------------------------------------------------ the loop
    async def run(self, every: float = 20.0) -> None:
        while True:
            try:
                await self.tick()
            except Exception as e:  # the away loop must never take OVERDRIVE down
                self.od.audit.write("away_error", {"error": repr(e)[:500]})
            await asyncio.sleep(every)

    async def tick(self) -> None:
        s = self.od.settings
        self.last_tick = time.time()
        self._auto_done_daily()
        self._finish_learn_if_done()
        idle = self.idle_fn()
        now_away = idle is not None and idle >= 60 * int(s.get("away_after_min"))
        if self.away and not now_away:
            self.came_back()
        elif now_away and not self.away:
            self.went_away()
        if not self.away:
            return
        if s.get("away_bugs") and (self.hunt_task is None or self.hunt_task.done()):
            nxt = self.next_project()
            if nxt:
                self.hunt_task = asyncio.create_task(self._hunt(nxt))
        if s.get("away_learn") and not self.learn_task_id and self.od.current is None:
            ok, _why = self.can_learn()
            if ok:
                await self.start_learning()

    def went_away(self) -> None:
        self.away, self.since = True, time.time()
        self.session = {"from": utc_now_iso(), "learned": [], "bugs_new": 0, "bugs_fixed": 0, "checked": [],
                        "learn_pct": 0.0, "learn_runs": 0}
        self.od.audit.write("away_start", {})
        self.od.events.publish("away", away=self.public())

    def came_back(self) -> dict | None:
        self.away = False
        sess, self.session = self.session, {}
        if not sess:
            return None
        sess["to"] = utc_now_iso()
        sess["minutes"] = round((time.time() - (self.since or time.time())) / 60)
        sess["seen"] = False
        self.since = None
        interesting = sess["learned"] or sess["bugs_new"] or sess["bugs_fixed"] or sess["checked"]
        if interesting:
            self.state["reports"].append(sess)
            self._save()
            self.od.events.publish("away_report", report=sess)
        self.od.audit.write("away_end", {k: sess[k] for k in ("minutes", "bugs_new", "bugs_fixed", "learn_runs")})
        self.od.events.publish("away", away=self.public())
        return sess if interesting else None

    def mark_seen(self) -> None:
        for r in self.state["reports"]:
            r["seen"] = True
        self._save()

    # ------------------------------------------------------------------ bug hunt
    def scope(self) -> list[str]:
        s = self.od.settings
        names = [p["name"] for p in self.od.projects.list(with_times=False) if not p["done"]]
        if s.get("bug_scope") == "picked":
            picked = set(s.get("bug_picked") or [])
            names = [n for n in names if n in picked]
        return names

    def next_project(self) -> str:
        names = self.scope()
        if not names:
            return ""
        checked = {n: (self.bugs.data.get(n) or {}).get("checked") or "" for n in names}
        done_now = set(self.session.get("checked", []))
        todo = [n for n in names if n not in done_now]
        if not todo:
            return ""                     # every project in scope was checked this time away
        return min(todo, key=lambda n: checked[n])

    async def _hunt(self, name: str) -> None:
        folder = self.od.projects.folder(name)
        if folder is None:
            return
        self.hunting = name
        self.od.events.publish("away", away=self.public())
        try:
            res = await asyncio.to_thread(hunt_project, folder, name, lambda: not self.away, 0.02)
            if res["stopped"]:
                return                    # you came back mid-check: it finishes next time
            counts = self.bugs.record(name, res["bugs"])
            if self.session:
                self.session["checked"].append(name)
                self.session["bugs_new"] += counts["new"]
                self.session["bugs_fixed"] += counts["fixed"]
            self.od.audit.write("bug_hunt", {"project": name, "files": res["files"], **counts})
        finally:
            self.hunting = ""
            self.od.events.publish("away", away=self.public())

    async def hunt_now(self, name: str) -> dict:
        """The "Check now" button: same free checks, right away, for one project."""
        folder = self.od.projects.folder(name)
        if folder is None:
            raise ValueError(f"no project called {name!r}")
        res = await asyncio.to_thread(hunt_project, folder, name)
        counts = self.bugs.record(name, res["bugs"])
        self.od.audit.write("bug_hunt", {"project": name, "files": res["files"], "by": "you", **counts})
        return {"files": res["files"], **counts}

    # ------------------------------------------------------------------ learning
    def can_learn(self) -> tuple[bool, str]:
        s = self.od.settings
        cap = float(s.get("away_learn_cap"))
        if self.learn_used_today() >= cap:
            return False, f"today's learning cap is used ({cap:.0f}% of your 5-hour limit)"
        fh = self.five_hour()
        if fh is not None and fh >= min(float(s.get("pause_at_usage_pct")), 80.0):
            return False, "your 5-hour usage is already high"
        last = float(self.state.get("last_learn", 0) or 0)
        if time.time() - last < LEARN_GAP_S:
            return False, "it learned a little while ago"
        ok, why = self.od.usage.can_start(s)
        if not ok:
            return False, why
        return True, ""

    def conversation(self):
        cid = self.state.get("conversation", "")
        conv = self.od.conversations.get(cid)
        if conv is None:
            conv = self.od.new_conversation(AWAY_TITLE)
            conv.model, conv.effort = "sonnet", "medium"     # learning is light work: the cheaper model
            self.od._save_conversations()
            self.state["conversation"] = conv.id
            self._save()
        return conv

    async def start_learning(self) -> str:
        conv = self.conversation()
        conv.mode = "chat"
        wants = ""
        if getattr(self.od, "feelings", None) is not None:
            w = self.od.feelings.wants_text()
            if w:
                wants = "\nThings you said you want to get better at: " + w
        self.learn_before = self.five_hour()
        self.state["last_learn"] = time.time()
        self._save()
        rec = await self.od.send(LEARN_PROMPT.format(wants=wants), conv.id, background=True)
        self.learn_task_id = rec.id
        self.od.events.publish("away", away=self.public())
        return rec.id

    def _finish_learn_if_done(self) -> None:
        if not self.learn_task_id:
            return
        cur = self.od.current
        if cur is not None and cur.rec.id == self.learn_task_id:
            return
        rec = self.od.task_store.load(self.learn_task_id)
        self.learn_task_id = ""
        after = self.five_hour()
        if self.learn_before is not None and after is not None and after >= self.learn_before:
            used = after - self.learn_before
        else:
            used = LEARN_GUESS_PCT
        day = self.state["learn_days"].setdefault(_today(), {"pct": 0.0, "runs": 0})
        day["pct"] = round(day["pct"] + used, 3)
        day["runs"] += 1
        self._save()
        learned = [m["title"] for m in (rec.memory_changes if rec else []) if m.get("op") == "remember"]
        if self.session:
            self.session["learned"].extend(learned)
            self.session["learn_pct"] = round(self.session["learn_pct"] + used, 2)
            self.session["learn_runs"] += 1
        self.od.audit.write("away_learned", {"task": rec.id if rec else "", "used_pct": used, "learned": learned})
        self.od.events.publish("away", away=self.public())

    # ------------------------------------------------------------------ done projects
    def _auto_done_daily(self) -> None:
        if self.last_auto_done == _today():
            return
        self.last_auto_done = _today()
        s = self.od.settings
        res = self.od.projects.auto_done(s.get("auto_done"), int(s.get("auto_done_days")))
        if res["marked"] or res["ask"]:
            self.od.events.publish("projects_done", **res)
            self.od.audit.write("projects_auto_done", res)
