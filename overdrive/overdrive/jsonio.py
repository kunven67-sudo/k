"""Safe file saving (rule 38: handle errors without corrupting data).

Every save goes to a temp file first, is flushed to disk, then swapped in
with one atomic rename. A crash mid-save leaves the old file intact.
A broken JSON file is moved aside (never overwritten) so it can be inspected.
"""
from __future__ import annotations

import json
import os
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

# Windows antivirus / search indexer can lock a file for a moment. Retry a few
# times (bounded, rule 39) before giving up.
_RETRIES = 4


def _retry(fn: Callable[[], Any]) -> Any:
    for attempt in range(_RETRIES + 1):
        try:
            return fn()
        except PermissionError:
            if attempt == _RETRIES:
                raise
            time.sleep(0.05 * (3 ** attempt))


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.{secrets.token_hex(4)}.tmp")
    try:
        with open(tmp, "wb") as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        _retry(lambda: os.replace(tmp, path))
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def atomic_write_text(path: Path, text: str) -> None:
    atomic_write_bytes(path, text.encode("utf-8"))


def atomic_write_json(path: Path, obj: Any) -> None:
    atomic_write_bytes(path, json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=False).encode("utf-8"))


class BrokenFile(Exception):
    pass


def read_json(path: Path, default: Any = None, on_broken: Callable[[Path, Path], None] | None = None) -> Any:
    """Read JSON. Missing file -> default. Broken file -> moved aside, default returned."""
    path = Path(path)
    try:
        raw = _retry(lambda: path.read_bytes())
    except FileNotFoundError:
        return default
    try:
        return json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        aside = path.with_name(f"{path.name}.broken-{stamp}")
        try:
            os.replace(path, aside)
        except OSError:
            aside = path
        if on_broken:
            on_broken(path, aside)
        return default


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def canonical_json(obj: Any) -> str:
    """Stable JSON text (sorted keys, no spaces) for hashing and comparing."""
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)
