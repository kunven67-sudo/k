"""Usage meter and caps (rules 46, 80).

OVERDRIVE runs on your claude.ai plan, so the real limits are your 5-hour and
weekly usage. Claude Code reports those as "rate limit" updates; OVERDRIVE
keeps the newest one and pauses new tasks before you hit the wall.
It also keeps its own meter: Claude Code's cost estimate per task (what the
same work would cost on the API, your plan is NOT charged per message).
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from .jsonio import atomic_write_json, read_json

LIMIT_NAMES = {
    "five_hour": "5-hour",
    "seven_day": "weekly",
    "seven_day_opus": "weekly (Opus)",
    "seven_day_sonnet": "weekly (Sonnet)",
    "overage": "extra usage",
}


def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


class Usage:
    def __init__(self, data_dir: Path):
        self.path = Path(data_dir) / "usage.json"
        self._lock = threading.Lock()
        d = read_json(self.path, {}) or {}
        self.days: dict[str, dict] = d.get("days", {}) if isinstance(d.get("days"), dict) else {}
        self.rate_limits: dict[str, dict] = d.get("rate_limits", {}) if isinstance(d.get("rate_limits"), dict) else {}

    def _save(self) -> None:
        # keep 60 days
        keep = sorted(self.days)[-60:]
        self.days = {k: self.days[k] for k in keep}
        atomic_write_json(self.path, {"days": self.days, "rate_limits": self.rate_limits})

    def add_task(self, cost_usd: float | None, turns: int | None) -> None:
        with self._lock:
            d = self.days.setdefault(_today(), {"cost_usd": 0.0, "tasks": 0, "turns": 0})
            d["cost_usd"] = round(d.get("cost_usd", 0.0) + float(cost_usd or 0.0), 6)
            d["tasks"] = d.get("tasks", 0) + 1
            d["turns"] = d.get("turns", 0) + int(turns or 0)
            self._save()

    def today(self) -> dict:
        return dict(self.days.get(_today(), {"cost_usd": 0.0, "tasks": 0, "turns": 0}))

    def update_rate_limit(self, info: dict) -> None:
        """Store a rate-limit update from Claude Code (fields can be missing)."""
        with self._lock:
            kind = info.get("rate_limit_type") or info.get("rateLimitType") or "general"
            util = info.get("utilization")
            entry = {
                "status": info.get("status") or "allowed",
                "utilization": float(util) if isinstance(util, (int, float)) else None,
                "resets_at": info.get("resets_at") or info.get("resetsAt"),
                "seen": int(time.time()),
            }
            self.rate_limits[str(kind)] = entry
            self._save()

    def public(self) -> dict:
        limits = []
        now = time.time()
        for kind, e in sorted(self.rate_limits.items()):
            resets = e.get("resets_at")
            if isinstance(resets, (int, float)) and resets < now and e.get("status") == "rejected":
                status = "allowed"  # window already reset
            else:
                status = e.get("status")
            limits.append({"type": kind, "name": LIMIT_NAMES.get(kind, kind), "status": status,
                           "utilization": e.get("utilization"), "resets_at": resets})
        return {"today": self.today(), "limits": limits}

    def can_start(self, settings) -> tuple[bool, str]:
        """Should a new task start? (False, reason) when a cap is hit."""
        today = self.today()
        cap = float(settings.get("daily_budget_usd"))
        if today.get("cost_usd", 0.0) >= cap:
            return False, (f"OVERDRIVE's daily usage cap is reached (about ${today['cost_usd']:.2f} of ${cap:.2f} "
                           "API-equivalent today). Raise it in Settings, or wait until tomorrow.")
        pct = int(settings.get("pause_at_usage_pct"))
        now = time.time()
        for kind, e in self.rate_limits.items():
            resets = e.get("resets_at")
            expired = isinstance(resets, (int, float)) and resets < now
            if expired:
                continue
            when = ""
            if isinstance(resets, (int, float)):
                when = " It resets at " + datetime.fromtimestamp(resets).strftime("%I:%M %p").lstrip("0") + "."
            if e.get("status") == "rejected":
                return False, f"Your Claude {LIMIT_NAMES.get(kind, kind)} limit is used up.{when}"
            util = e.get("utilization")
            if isinstance(util, (int, float)) and util * 100 >= pct:
                return False, (f"Your Claude {LIMIT_NAMES.get(kind, kind)} usage is at {util * 100:.0f}% "
                               f"(OVERDRIVE pauses at {pct}%, change it in Settings).{when}")
        return True, ""
