"""Audit log: every step written down, secrets blanked out (rules 21, 42, 72).

One JSON line per event in logs/audit-YYYY-MM-DD.jsonl (UTC days). Lines are
only ever appended. Each line carries the hash of the line before it, so any
edit or deleted line breaks the chain and `verify()` finds it.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .jsonio import canonical_json, utc_now_iso
from .redact import redact

GENESIS = "0" * 64
MAX_STRING = 4000
_FILE_RE = re.compile(r"^audit-(\d{4}-\d{2}-\d{2})\.jsonl$")


def _shorten(obj: Any, depth: int = 0) -> Any:
    """Cut very long strings (keeping a hash of the full text) so logs stay readable."""
    if depth > 40:
        return "[cut: too deep]"
    if isinstance(obj, str):
        if len(obj) > MAX_STRING:
            digest = hashlib.sha256(obj.encode("utf-8", "replace")).hexdigest()[:16]
            return obj[: MAX_STRING // 2] + f"\n...[cut {len(obj) - MAX_STRING // 2} chars, sha256:{digest}]"
        return obj
    if isinstance(obj, dict):
        return {str(k): _shorten(v, depth + 1) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        items = [_shorten(v, depth + 1) for v in obj[:500]]
        if len(obj) > 500:
            items.append(f"[cut {len(obj) - 500} more items]")
        return items
    if obj is None or isinstance(obj, (bool, int, float)):
        return obj
    return str(obj)


def _entry_hash(entry: dict) -> str:
    body = {k: v for k, v in entry.items() if k != "h"}
    return hashlib.sha256(canonical_json(body).encode("utf-8")).hexdigest()


class AuditLog:
    def __init__(self, logs_dir: Path):
        self.dir = Path(logs_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._listeners: list[Callable[[dict], None]] = []
        self.seq, self.head = 0, GENESIS
        self.recovered_note: str | None = None
        self._recover_head()

    # ---- writing -------------------------------------------------------
    def _files(self) -> list[Path]:
        return sorted(p for p in self.dir.iterdir() if _FILE_RE.match(p.name))

    def _recover_head(self) -> None:
        files = self._files()
        for f in reversed(files):
            lines = f.read_bytes().splitlines()
            for i in range(len(lines) - 1, -1, -1):
                try:
                    e = json.loads(lines[i])
                    self.seq, self.head = int(e["seq"]), str(e["h"])
                    if i != len(lines) - 1:
                        self.recovered_note = f"{f.name}: {len(lines) - 1 - i} unreadable line(s) at the end (crash during a write?)"
                    return
                except Exception:
                    continue

    def on_write(self, fn: Callable[[dict], None]) -> None:
        self._listeners.append(fn)

    def write(self, kind: str, data: dict | None = None, task: str | None = None) -> dict:
        with self._lock:
            entry = {
                "seq": self.seq + 1,
                "ts": utc_now_iso(),
                "task": task,
                "kind": kind,
                "data": _shorten(redact(data or {})),
                "prev": self.head,
            }
            entry["h"] = _entry_hash(entry)
            day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            path = self.dir / f"audit-{day}.jsonl"
            line = json.dumps(entry, ensure_ascii=False, sort_keys=True) + "\n"
            with open(path, "a", encoding="utf-8", newline="\n") as f:
                f.write(line)
                f.flush()
                os.fsync(f.fileno())
            self.seq, self.head = entry["seq"], entry["h"]
        for fn in list(self._listeners):
            try:
                fn(entry)
            except Exception:
                pass
        return entry

    # ---- reading -------------------------------------------------------
    def days(self) -> list[str]:
        return [_FILE_RE.match(p.name).group(1) for p in self._files()]  # type: ignore[union-attr]

    def read(self, day: str | None = None, task: str | None = None, kinds: set[str] | None = None,
             query: str | None = None, limit: int = 500) -> list[dict]:
        files = self._files()
        if day:
            files = [f for f in files if f.name == f"audit-{day}.jsonl"]
        out: list[dict] = []
        q = (query or "").lower().strip()
        for f in reversed(files):
            for raw in reversed(f.read_text(encoding="utf-8", errors="replace").splitlines()):
                try:
                    e = json.loads(raw)
                except Exception:
                    continue
                if task and e.get("task") != task:
                    continue
                if kinds and e.get("kind") not in kinds:
                    continue
                if q and q not in raw.lower():
                    continue
                out.append(e)
                if len(out) >= limit:
                    return out
        return out

    def verify(self) -> dict:
        """Walk every line and recheck the hash chain."""
        prev, count, last_seq = GENESIS, 0, 0
        files = self._files()
        for f in files:
            lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
            for i, raw in enumerate(lines, 1):
                if not raw.strip():
                    continue
                try:
                    e = json.loads(raw)
                except Exception:
                    if f == files[-1] and i == len(lines):
                        return {"ok": True, "entries": count, "files": len(files),
                                "warning": f"{f.name} line {i}: last line is unreadable (crash during a write)"}
                    return {"ok": False, "entries": count, "files": len(files), "broken_at": f"{f.name} line {i}",
                            "reason": "unreadable line"}
                if e.get("prev") != prev:
                    return {"ok": False, "entries": count, "files": len(files), "broken_at": f"{f.name} line {i}",
                            "reason": "chain link does not match the line before (a line was removed or changed)"}
                if _entry_hash(e) != e.get("h"):
                    return {"ok": False, "entries": count, "files": len(files), "broken_at": f"{f.name} line {i}",
                            "reason": "line content was changed after it was written"}
                if int(e.get("seq", 0)) != last_seq + 1:
                    return {"ok": False, "entries": count, "files": len(files), "broken_at": f"{f.name} line {i}",
                            "reason": "line numbers jump (a line is missing)"}
                prev, last_seq = e["h"], int(e["seq"])
                count += 1
        return {"ok": True, "entries": count, "files": len(files)}
