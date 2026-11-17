"""The bug hunt (Piece 3): free checks that run on your PC while you're away. Zero Claude usage.

It only LOOKS, it never fixes or changes anything. Per project it checks:
- Python files: does every .py file compile (syntax errors)? The code is compiled, never run.
- JavaScript files: `node --check` when Node is installed (syntax errors).
- JSON files: do they load?
- HTML pages: do the local files they point to (scripts, styles, pictures, sounds) exist?
- Log files changed in the last 2 weeks: crash / error lines (Traceback, Exception, ERROR, FATAL).
- Crash dump files (.dmp).
- Pictures bigger than 4096 px: they can lag or not load on a 2 GB graphics card.
Findings are kept per project; one that's gone next time is marked fixed. Slow on purpose (one file at a time).
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import struct
import subprocess
import time
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable
from urllib.parse import unquote, urlparse

from .jsonio import atomic_write_json, read_json, utc_now_iso
from .projects import SKIP_DIRS

MAX_FILES = 3000
MAX_TEXT = 3_000_000
LOG_DAYS = 14
ERR_RE = re.compile(r"Traceback \(most recent call last\)|\bException\b|\bERROR\b|\bFATAL\b|Unhandled|segmentation fault",
                    re.I)
BIG_PX = 4096


def _bug(kind: str, file: str, message: str, line: int | None = None, severity: str = "bug") -> dict:
    return {"kind": kind, "file": file, "line": line, "message": message[:400], "severity": severity}


def check_python(path: Path, rel: str) -> list[dict]:
    try:
        src = path.read_bytes()
    except OSError:
        return []
    if len(src) > MAX_TEXT:
        return []
    try:
        compile(src, rel, "exec", dont_inherit=True)
    except SyntaxError as e:
        return [_bug("syntax", rel, f"Python syntax error: {e.msg}", e.lineno)]
    except (ValueError, UnicodeDecodeError) as e:
        return [_bug("syntax", rel, f"Python file can't be read: {e}")]
    return []


def check_json(path: Path, rel: str) -> list[dict]:
    try:
        raw = path.read_bytes()
        if len(raw) > MAX_TEXT:
            return []
        json.loads(raw.decode("utf-8-sig"))
    except json.JSONDecodeError as e:
        return [_bug("json", rel, f"Broken JSON: {e.msg}", e.lineno)]
    except (OSError, UnicodeDecodeError) as e:
        return [_bug("json", rel, f"JSON file can't be read: {e}")]
    return []


_NODE: list[str | None] = []


def node_path() -> str | None:
    if not _NODE:
        _NODE.append(shutil.which("node"))
    return _NODE[0]


def check_js(path: Path, rel: str) -> list[dict]:
    node = node_path()
    if not node or path.stat().st_size > MAX_TEXT:
        return []
    flags = 0x08000000 if hasattr(subprocess, "STARTUPINFO") else 0
    try:
        r = subprocess.run([node, "--check", str(path)], capture_output=True, text=True, timeout=20,
                           creationflags=flags)
    except (OSError, subprocess.TimeoutExpired):
        return []
    if r.returncode == 0:
        return []
    err = (r.stderr or "").strip().splitlines()
    line = None
    m = re.search(r":(\d+)\s*$", err[0]) if err else None
    if m:
        line = int(m.group(1))
    msg = next((e for e in err if "Error" in e), err[-1] if err else "syntax error")
    return [_bug("syntax", rel, f"JavaScript: {msg.strip()}", line)]


class _Refs(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[tuple[str, int]] = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ("src", "href") and v and not (tag == "a" and k == "href"):
                self.refs.append((v, self.getpos()[0]))


def check_html(path: Path, rel: str) -> list[dict]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return []
    if len(text) > MAX_TEXT:
        return []
    p = _Refs()
    try:
        p.feed(text)
    except Exception:
        return []
    out = []
    for ref, line in p.refs:
        u = urlparse(ref)
        if u.scheme or ref.startswith(("//", "#", "data:", "mailto:", "javascript:")):
            continue
        target = (path.parent / unquote(u.path)).resolve() if u.path else None
        if target is not None and u.path and not target.exists():
            out.append(_bug("missing", rel, f"Points to a file that isn't there: {u.path}", line))
    return out


def check_log(path: Path, rel: str) -> list[dict]:
    try:
        if time.time() - path.stat().st_mtime > LOG_DAYS * 86400:
            return []
        with open(path, "rb") as f:
            f.seek(max(0, path.stat().st_size - 200_000))
            tail = f.read().decode("utf-8", errors="replace").splitlines()
    except OSError:
        return []
    hits = [(i, ln.strip()) for i, ln in enumerate(tail) if ERR_RE.search(ln)]
    if not hits:
        return []
    last = hits[-1][1]
    return [_bug("log", rel, f"{len(hits)} error line(s) in the log, last one: {last[:240]}", severity="warning")]


def image_size(path: Path) -> tuple[int, int] | None:
    try:
        with open(path, "rb") as f:
            head = f.read(64 * 1024)
    except OSError:
        return None
    if head[:8] == b"\x89PNG\r\n\x1a\n" and len(head) >= 24:
        return struct.unpack(">II", head[16:24])
    if head[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(head):
            if head[i] != 0xFF:
                i += 1
                continue
            marker = head[i + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack(">HH", head[i + 5:i + 9])
                return w, h
            seg = struct.unpack(">H", head[i + 2:i + 4])[0]
            i += 2 + seg
    return None


def check_image(path: Path, rel: str) -> list[dict]:
    wh = image_size(path)
    if wh and max(wh) > BIG_PX:
        return [_bug("heavy", rel, f"Picture is {wh[0]}x{wh[1]} px: can lag or fail to load on a 2 GB graphics card "
                                   "(4096 px or less is safer)", severity="warning")]
    return []


CHECKS: dict[str, Callable[[Path, str], list[dict]]] = {
    ".py": check_python, ".json": check_json, ".js": check_js, ".mjs": check_js, ".html": check_html,
    ".htm": check_html, ".log": check_log, ".png": check_image, ".jpg": check_image, ".jpeg": check_image,
}


def hunt_project(folder: Path, name: str, should_stop: Callable[[], bool] = lambda: False,
                 pause: float = 0.0) -> dict:
    """Check one project. Returns {"bugs": [...], "files": n, "stopped": bool}."""
    bugs: list[dict] = []
    n = 0
    for p in sorted(folder.rglob("*")):
        if should_stop():
            return {"bugs": bugs, "files": n, "stopped": True}
        if any(part in SKIP_DIRS for part in p.relative_to(folder).parts):
            continue
        if not p.is_file() or p.is_symlink():
            continue
        rel = f"{name}/{p.relative_to(folder).as_posix()}"
        ext = p.suffix.lower()
        if ext == ".dmp":
            bugs.append(_bug("crash", rel, "A crash dump: the program crashed here at some point."))
            continue
        fn = CHECKS.get(ext)
        if fn is None:
            continue
        n += 1
        if n > MAX_FILES:
            break
        try:
            bugs.extend(fn(p, rel))
        except Exception as e:  # one weird file never stops the hunt
            bugs.append(_bug("checker", rel, f"Couldn't check this file: {e!r}"[:300], severity="warning"))
        if pause:
            time.sleep(pause)
    return {"bugs": bugs, "files": n, "stopped": False}


def bug_id(b: dict) -> str:
    return hashlib.sha1(f"{b['kind']}|{b['file']}|{b.get('line')}|{b['message']}".encode()).hexdigest()[:12]


class BugBook:
    """Everything the hunt found, per project. New / still there / fixed."""

    def __init__(self, data_dir: Path):
        self.path = Path(data_dir) / "away" / "bugs.json"
        self.data: dict = read_json(self.path, {}) or {}

    def save(self) -> None:
        atomic_write_json(self.path, self.data)

    def record(self, project: str, found: list[dict]) -> dict:
        now = utc_now_iso()
        proj = self.data.setdefault(project, {"bugs": {}, "checked": None})
        seen_ids = set()
        new = 0
        for b in found:
            i = bug_id(b)
            seen_ids.add(i)
            old = proj["bugs"].get(i)
            if old is not None and old.get("dismissed"):
                continue                       # you said "not a bug": it stays hidden
            if old is None or old.get("fixed"):
                proj["bugs"][i] = dict(b, id=i, first_seen=now, last_seen=now, fixed=False)
                new += 1
            else:
                old["last_seen"] = now
        fixed = 0
        for i, b in proj["bugs"].items():
            if i not in seen_ids and not b.get("fixed") and not b.get("dismissed"):
                b["fixed"], b["fixed_seen"] = True, now
                fixed += 1
        proj["checked"] = now
        self.save()
        return {"new": new, "fixed": fixed, "open": sum(1 for b in proj["bugs"].values() if not b.get("fixed"))}

    def open_bugs(self, project: str | None = None) -> list[dict]:
        out = []
        for name, proj in self.data.items():
            if project and name != project:
                continue
            out.extend(dict(b, project=name) for b in proj["bugs"].values() if not b.get("fixed"))
        out.sort(key=lambda b: (b["severity"] != "bug", b["project"], b["file"], b.get("line") or 0))
        return out

    def dismiss(self, bid: str) -> bool:
        for proj in self.data.values():
            if bid in proj["bugs"]:
                proj["bugs"][bid]["fixed"] = True
                proj["bugs"][bid]["dismissed"] = True
                self.save()
                return True
        return False
