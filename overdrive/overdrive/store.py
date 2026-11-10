"""Safe file work inside your workspace (rules 17, 32, 38, 41, 50, 91, 92).

- File tools only see ~/OVERDRIVE/workspace. Paths that try to escape it
  (.., drive letters, links pointing outside, Windows device names) are refused.
- Nothing is ever overwritten silently: replacing a file first saves the old
  copy into ~/OVERDRIVE/versions (outside the workspace, so Claude can't touch it).
- Every change is recorded so a task can be undone. Undo never deletes:
  it moves things into versions.
"""
from __future__ import annotations

import difflib
import hashlib
import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from .jsonio import atomic_write_bytes, utc_now_iso

MAX_READ_BYTES = 5 * 1024 * 1024
MAX_WRITE_CHARS = 1_000_000
_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
_BAD_CHARS = re.compile(r'[<>"|?*\x00-\x1f]')


class PathError(ValueError):
    pass


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def decode_text(raw: bytes) -> tuple[str, str]:
    """Decode file bytes. Returns (text, encoding note)."""
    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        return raw.decode("utf-16", errors="replace"), "utf-16"
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw[3:].decode("utf-8", errors="replace"), "utf-8 (with BOM)"
    try:
        return raw.decode("utf-8"), "utf-8"
    except UnicodeDecodeError:
        return raw.decode("cp1252", errors="replace"), "windows-1252 (not valid utf-8)"


def looks_binary(raw: bytes) -> bool:
    head = raw[:8192]
    if head.startswith((b"\xff\xfe", b"\xfe\xff")):
        return False
    return b"\x00" in head


class Workspace:
    def __init__(self, root: Path, versions: Path):
        self.root = Path(root)
        self.versions = Path(versions)
        self.root.mkdir(parents=True, exist_ok=True)
        self.versions.mkdir(parents=True, exist_ok=True)

    # ---- paths ----------------------------------------------------------
    def resolve(self, rel: str) -> Path:
        if not isinstance(rel, str):
            raise PathError("path must be text")
        p = rel.strip().replace("\\", "/")
        if p in ("", ".", "./"):
            return self.root
        if len(p) > 240:
            raise PathError("path is too long (240 characters max)")
        if p.startswith("/") or p.startswith("//") or re.match(r"^[A-Za-z]:", p) or p.startswith("~"):
            raise PathError("use a path inside the OVERDRIVE workspace, like notes/todo.txt (no drive letters or leading /)")
        parts = [s for s in p.split("/") if s not in ("", ".")]
        if len(parts) > 20:
            raise PathError("too many folders deep (20 max)")
        for s in parts:
            if s == "..":
                raise PathError("'..' is not allowed: OVERDRIVE can only work inside its workspace folder")
            if ":" in s:
                raise PathError("':' is not allowed in file names")
            if _BAD_CHARS.search(s):
                raise PathError(f"name '{s}' has a character Windows does not allow (< > \" | ? * or control chars)")
            if s.endswith((".", " ")):
                raise PathError(f"name '{s}' ends with a dot or space (Windows would change it)")
            if s.split(".")[0].upper() in _RESERVED:
                raise PathError(f"'{s}' is a reserved Windows device name")
            if len(s) > 120:
                raise PathError("a file or folder name is too long (120 characters max)")
        target = self.root.joinpath(*parts)
        real_root = self.root.resolve()
        real = target.resolve()
        if real != real_root and real_root not in real.parents:
            raise PathError("that path leads outside the workspace (a link or shortcut?) and is blocked")
        return target

    def rel(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix() if path != self.root else "."

    # ---- reading --------------------------------------------------------
    def list(self, rel: str = ".", depth: int = 1, limit: int = 400) -> dict:
        base = self.resolve(rel)
        if not base.exists():
            raise PathError(f"'{rel}' does not exist")
        if not base.is_dir():
            raise PathError(f"'{rel}' is a file, not a folder")
        depth = max(1, min(int(depth), 4))
        entries, cut = [], False
        base_depth = len(base.relative_to(self.root).parts) if base != self.root else 0
        for dirpath, dirnames, filenames in os.walk(base):
            dp = Path(dirpath)
            level = len(dp.relative_to(self.root).parts) - base_depth if dp != self.root else 0
            dirnames.sort()
            if level + 1 >= depth:
                keep_dirs = []
            else:
                keep_dirs = [d for d in dirnames if not (dp / d).is_symlink()]
            for d in dirnames:
                entries.append({"path": self.rel(dp / d), "type": "folder"})
            for fn in sorted(filenames):
                fp = dp / fn
                try:
                    st = fp.stat()
                    entries.append({"path": self.rel(fp), "type": "file", "bytes": st.st_size,
                                    "modified": datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(timespec="seconds")})
                except OSError:
                    entries.append({"path": self.rel(fp), "type": "file", "bytes": None})
            dirnames[:] = keep_dirs
            if len(entries) >= limit:
                cut = True
                break
        return {"folder": self.rel(base), "entries": entries[:limit], "cut": cut}

    def read_text(self, rel: str, max_chars: int = 20000, offset: int = 0) -> dict:
        path = self.resolve(rel)
        if not path.exists():
            raise PathError(f"'{rel}' does not exist")
        if not path.is_file():
            raise PathError(f"'{rel}' is not a file")
        size = path.stat().st_size
        if size > MAX_READ_BYTES:
            raise PathError(f"'{rel}' is {size} bytes; the text reader stops at {MAX_READ_BYTES} bytes")
        raw = path.read_bytes()
        if looks_binary(raw):
            raise PathError(f"'{rel}' looks like a binary file (not text); Stage 1 can only read text files")
        text, enc = decode_text(raw)
        offset = max(0, int(offset))
        max_chars = max(1, min(int(max_chars), 200_000))
        chunk = text[offset: offset + max_chars]
        return {"path": self.rel(path), "text": chunk, "encoding": enc, "total_chars": len(text),
                "offset": offset, "returned_chars": len(chunk), "more": offset + len(chunk) < len(text),
                "sha256": sha256_bytes(raw)}

    def current_text(self, rel: str) -> str | None:
        try:
            path = self.resolve(rel)
            if path.is_file() and path.stat().st_size <= MAX_READ_BYTES:
                raw = path.read_bytes()
                if not looks_binary(raw):
                    return decode_text(raw)[0]
        except (OSError, PathError):
            pass
        return None

    # ---- writing --------------------------------------------------------
    def _snapshot(self, path: Path, reason: str, task: str | None) -> str:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        flat = self.rel(path).replace("/", "__")
        snap = self.versions / f"{stamp}__{flat}"
        shutil.copy2(path, snap)
        with open(self.versions / "index.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"ts": utc_now_iso(), "original": self.rel(path), "snapshot": snap.name,
                                "reason": reason, "task": task}, ensure_ascii=False) + "\n")
        return snap.name

    def create_text(self, rel: str, content: str, task: str | None = None) -> dict:
        if len(content) > MAX_WRITE_CHARS:
            raise PathError(f"text is too big ({len(content)} chars, max {MAX_WRITE_CHARS})")
        path = self.resolve(rel)
        if path == self.root:
            raise PathError("give a file name, like notes/todo.txt")
        if path.exists():
            raise PathError(f"'{self.rel(path)}' already exists. To change it use mode 'replace' "
                            "(asks the human first, old copy is kept), or pick a new name")
        if path.parent.exists() and not path.parent.is_dir():
            raise PathError("a file is in the way of that folder name")
        path.parent.mkdir(parents=True, exist_ok=True)
        self.resolve(self.rel(path.parent))  # re-check after creating folders
        data = content.encode("utf-8")
        atomic_write_bytes(path, data)
        return {"op": "created", "path": self.rel(path), "sha256": sha256_bytes(data), "bytes": len(data)}

    def replace_text(self, rel: str, content: str, task: str | None = None) -> dict:
        if len(content) > MAX_WRITE_CHARS:
            raise PathError(f"text is too big ({len(content)} chars, max {MAX_WRITE_CHARS})")
        path = self.resolve(rel)
        if not path.is_file():
            raise PathError(f"'{rel}' does not exist (use mode 'create' for a new file)")
        old = path.read_bytes()
        if looks_binary(old):
            raise PathError(f"'{rel}' is not a text file; refusing to replace it")
        data = content.encode("utf-8")
        if old == data:
            return {"op": "unchanged", "path": self.rel(path), "sha256": sha256_bytes(data)}
        snap = self._snapshot(path, "before replace", task)
        atomic_write_bytes(path, data)
        return {"op": "replaced", "path": self.rel(path), "snapshot": snap, "old_sha256": sha256_bytes(old),
                "sha256": sha256_bytes(data), "bytes": len(data)}

    def diff(self, rel: str, new_text: str, limit: int = 160) -> str:
        old = self.current_text(rel) or ""
        lines = list(difflib.unified_diff(old.splitlines(), new_text.splitlines(), "before", "after", lineterm="", n=2))
        if len(lines) > limit:
            lines = lines[:limit] + [f"... ({len(lines) - limit} more diff lines)"]
        return "\n".join(lines)

    def undo(self, changes: list[dict], task: str | None = None) -> list[dict]:
        """Reverse a task's changes, newest first. Never deletes: moves into versions."""
        results = []
        for ch in reversed(changes):
            op, rel = ch.get("op"), ch.get("path", "")
            try:
                path = self.resolve(rel)
                if op == "created":
                    if not path.is_file():
                        results.append({"path": rel, "result": "already gone"})
                        continue
                    if sha256_bytes(path.read_bytes()) != ch.get("sha256"):
                        results.append({"path": rel, "result": "skipped: file was changed after the task, kept it"})
                        continue
                    snap = self._snapshot(path, "undo: remove created file", task)
                    path.unlink()
                    results.append({"path": rel, "result": f"removed (copy kept in versions as {snap})"})
                elif op == "replaced":
                    if not path.is_file() or sha256_bytes(path.read_bytes()) != ch.get("sha256"):
                        results.append({"path": rel, "result": "skipped: file was changed after the task, kept it"})
                        continue
                    src = self.versions / ch["snapshot"]
                    if not src.is_file():
                        results.append({"path": rel, "result": "skipped: old copy is missing"})
                        continue
                    self._snapshot(path, "undo: before restoring old copy", task)
                    atomic_write_bytes(path, src.read_bytes())
                    results.append({"path": rel, "result": "restored the old version"})
                else:
                    results.append({"path": rel, "result": f"nothing to undo ({op})"})
            except (OSError, PathError) as e:
                results.append({"path": rel, "result": f"failed: {e}"})
        return results
