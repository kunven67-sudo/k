"""Rules check + usage guess (Piece 3).

rules_check: before handing a build over, OVERDRIVE pulls your rules (pinned memory + every standing rule) and
your PC profile as a checklist, and fixes anything that breaks one. The checker notes when a build skipped it.

Usage guess: OVERDRIVE remembers how much of your 5-hour limit each finished job really used (when Claude Code
reports the meter). Before a big build, the "Ready to build?" card says "this kind of job used about X%"."""
from __future__ import annotations

import statistics
import time
from pathlib import Path

from .jsonio import atomic_write_json, read_json
from .permissions import Risk
from .tools import ToolResult, ToolSpec


def make_rules_tool(od) -> ToolSpec:
    async def handler(args: dict, ctx) -> ToolResult:
        rows = od.memory.list(("instruction",), limit=200)
        pinned = [r for r in od.memory.list(limit=200) if "pinned" in r.tags and r.kind != "instruction"]
        lines = ["CHECKLIST: go through every line; fix anything your work breaks BEFORE task_report."]
        if rows:
            lines.append("The human's rules:")
            lines += [f"  [ ] {r.title}" + (f" ({' '.join(r.content.split())[:200]})" if r.content.strip() != r.title else "")
                      for r in rows]
        if pinned:
            lines.append("Pinned (always keep in mind):")
            lines += [f"  [ ] {r.title}: {' '.join(r.content.split())[:200]}" for r in pinned]
        from .pcinfo import prompt_block
        lines.append(prompt_block(od.settings.get("pc_profile")))
        if not rows and not pinned:
            lines.append("(No rules saved in memory yet.)")
        return ToolResult(text="\n".join(lines))

    return ToolSpec(
        name="rules_check", title="Check the human's rules",
        description=("Get the human's rules (from memory) and their PC profile as a checklist. Call it near the end of "
                     "every build, before task_report, and fix anything that breaks a rule."),
        schema={"type": "object", "properties": {}, "additionalProperties": False},
        risk=Risk.READ, handler=handler, selftest="test_rules_check_and_usage_guess",
        limitations=["Only as good as the rules saved in memory."])


class UsageHistory:
    def __init__(self, data_dir: Path):
        self.path = Path(data_dir) / "usage-history.json"
        self.rows: list[dict] = read_json(self.path, []) or []

    def add(self, mode: str, model: str, pct: float, turns: int | None) -> None:
        self.rows.append({"mode": mode, "model": model, "pct": round(pct, 2), "turns": turns or 0, "ts": int(time.time())})
        self.rows = self.rows[-300:]
        atomic_write_json(self.path, self.rows)

    def guess(self, mode: str = "build", model: str = "") -> dict | None:
        same = [r["pct"] for r in self.rows if r["mode"] == mode and (not model or r["model"].find(model) >= 0)]
        if len(same) < 2:
            same = [r["pct"] for r in self.rows if r["mode"] == mode]
        if len(same) < 2:
            return None
        recent = same[-12:]
        return {"pct": round(statistics.median(recent), 1), "high": round(max(recent), 1), "n": len(recent)}
