"""Action journal for one task (rules 40, 41, 76, 12).

- An action that already succeeded is not done again (rule 40).
- The same denied/failed call over and over = stuck in a loop (rules 12, 41).
- Read results can be reused inside a task when nothing changed (rule 76).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .permissions import input_key


@dataclass
class Entry:
    tool: str
    args: dict
    risk: str
    decision: str = ""          # auto / yes / no / timeout / blocked / stopped / invalid
    ok: bool | None = None      # None = not run (yet)
    summary: str = ""
    changes: list[dict] = field(default_factory=list)
    reason: str = ""


class Journal:
    LOOP_LIMIT = 3              # same refused call 3 times = stuck

    def __init__(self) -> None:
        self.entries: list[Entry] = []
        self._done: dict[str, Entry] = {}
        self._refusals: dict[str, int] = {}
        self._cache: dict[str, tuple[str, str]] = {}
        self.changes: list[dict] = []

    def add(self, tool: str, args: dict, risk: str, decision: str, reason: str = "") -> Entry:
        e = Entry(tool=tool, args=args, risk=risk, decision=decision, reason=reason)
        self.entries.append(e)
        if decision in ("no", "timeout", "blocked", "invalid", "stopped"):
            k = input_key(tool, args)
            self._refusals[k] = self._refusals.get(k, 0) + 1
        return e

    def refusals(self, tool: str, args: dict) -> int:
        return self._refusals.get(input_key(tool, args), 0)

    def stuck(self, tool: str, args: dict) -> bool:
        return self.refusals(tool, args) >= self.LOOP_LIMIT

    def finish(self, entry: Entry, ok: bool, summary: str, changes: list[dict] | None = None,
               side_effect: bool = False) -> None:
        entry.ok, entry.summary = ok, summary[:500]
        if changes:
            entry.changes = [c for c in changes if c.get("op") not in (None, "unchanged")]
            self.changes.extend(entry.changes)
        if ok and side_effect:
            self._done[input_key(entry.tool, entry.args)] = entry

    def already_done(self, tool: str, args: dict) -> Entry | None:
        return self._done.get(input_key(tool, args))

    def cache_get(self, tool: str, args: dict, fingerprint: str) -> str | None:
        hit = self._cache.get(input_key(tool, args))
        if hit and hit[0] == fingerprint:
            return hit[1]
        return None

    def cache_put(self, tool: str, args: dict, fingerprint: str, text: str) -> None:
        self._cache[input_key(tool, args)] = (fingerprint, text)

    def side_effects(self) -> list[Entry]:
        return [e for e in self.entries if e.risk not in ("internal", "read")]

    def failures(self) -> list[Entry]:
        """Actions that were refused or failed. Not counted: OVERDRIVE's own bookkeeping, and inputs
        Claude got wrong and was told to fix (those are corrections, not refused actions)."""
        return [e for e in self.entries if e.risk not in ("internal", "invalid") and (e.ok is False or e.decision in
                ("no", "timeout", "blocked", "stopped"))]
