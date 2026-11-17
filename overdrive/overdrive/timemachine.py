"""Time machine (Piece 3): every version of every project is kept. After each build that changed a project, the
whole project folder is saved as a zip (versions/projects/<project>/). "Open a copy" puts an old version next to
the new one (nothing is lost); "Go back to this one" saves the current version first, then restores the old one."""
from __future__ import annotations

import hashlib
import io
import re
import shutil
import time
import zipfile
from pathlib import Path, PurePosixPath

from .jsonio import atomic_write_json, read_json, utc_now_iso
from .projects import SKIP_DIRS

MAX_FILE = 60 * 1024 * 1024
MAX_TOTAL = 600 * 1024 * 1024


def _slug(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)[:80] or "project"


class TimeMachine:
    def __init__(self, home: Path, projects):
        self.root = Path(home) / "versions" / "projects"
        self.projects = projects

    def _dir(self, name: str) -> Path:
        d = self.root / _slug(name)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _index(self, name: str) -> list[dict]:
        return read_json(self._dir(name) / "index.json", []) or []

    def _files(self, folder: Path) -> list[Path]:
        out = []
        for p in sorted(folder.rglob("*")):
            rel = p.relative_to(folder)
            if any(part in SKIP_DIRS for part in rel.parts) or not p.is_file() or p.is_symlink():
                continue
            out.append(p)
        return out

    def snapshot(self, name: str, why: str, task: str = "") -> dict | None:
        """Save the project as it is now. Returns the new version, or None when nothing changed since the last one."""
        folder = self.projects.folder(name)
        if folder is None:
            return None
        files = self._files(folder)
        h = hashlib.sha256()
        total, skipped = 0, []
        keep = []
        for p in files:
            size = p.stat().st_size
            if size > MAX_FILE or total + size > MAX_TOTAL:
                skipped.append(p.relative_to(folder).as_posix())
                continue
            total += size
            keep.append(p)
            h.update(p.relative_to(folder).as_posix().encode())
            h.update(str(size).encode())
            h.update(str(int(p.stat().st_mtime)).encode())
        fp = h.hexdigest()
        idx = self._index(name)
        if idx and idx[-1].get("fingerprint") == fp:
            return None
        stamp = time.strftime("%Y%m%d-%H%M%S")
        zpath = self._dir(name) / f"{stamp}.zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for p in keep:
                z.write(p, p.relative_to(folder).as_posix())
        v = {"id": stamp, "when": utc_now_iso(), "why": why[:300], "task": task, "files": len(keep), "bytes": total,
             "fingerprint": fp, "skipped_big_files": skipped[:20]}
        idx.append(v)
        atomic_write_json(self._dir(name) / "index.json", idx[-200:])
        return v

    def versions(self, name: str) -> list[dict]:
        return list(reversed(self._index(name)))

    def _zip(self, name: str, vid: str) -> Path:
        if not re.fullmatch(r"\d{8}-\d{6}", vid or ""):
            raise ValueError("no such version")
        z = self._dir(name) / f"{vid}.zip"
        if not z.is_file():
            raise ValueError("that version's file is missing")
        return z

    def _extract(self, zpath: Path, dest: Path) -> int:
        n = 0
        with zipfile.ZipFile(zpath) as z:
            for info in z.infolist():
                rel = PurePosixPath(info.filename)
                if info.is_dir() or rel.is_absolute() or ".." in rel.parts:
                    continue
                out = dest / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(z.read(info))
                n += 1
        return n

    def open_copy(self, name: str, vid: str) -> str:
        """Put an old version NEXT TO the current one: <project> (version 2026-11-17 14.05)."""
        z = self._zip(name, vid)
        folder = self.projects.folder(name)
        base = folder.parent if folder is not None else self.projects.workspace
        label = f"{vid[:4]}-{vid[4:6]}-{vid[6:8]} {vid[9:11]}.{vid[11:13]}"
        dest = base / f"{PurePosixPath(name).name} (version {label})"
        n = 2
        while dest.exists():
            dest = base / f"{PurePosixPath(name).name} (version {label}) {n}"
            n += 1
        dest.mkdir(parents=True)
        self._extract(z, dest)
        return dest.relative_to(self.projects.workspace).as_posix()

    def go_back(self, name: str, vid: str) -> dict:
        """Make an old version the current one. The current one is saved first, so nothing is lost."""
        z = self._zip(name, vid)
        folder = self.projects.folder(name)
        if folder is None:
            raise ValueError("that project isn't there anymore")
        saved = self.snapshot(name, f"saved before going back to {vid}")
        for p in self._files(folder):
            p.unlink()
        for d in sorted((d for d in folder.rglob("*") if d.is_dir()), key=lambda d: len(d.parts), reverse=True):
            if not any(part in SKIP_DIRS for part in d.relative_to(folder).parts):
                try:
                    d.rmdir()
                except OSError:
                    pass
        n = self._extract(z, folder)
        return {"restored_files": n, "saved_first": saved["id"] if saved else (self._index(name)[-1]["id"] if self._index(name) else None)}

    def after_build(self, rec) -> list[str]:
        """After a build task: snapshot each project it changed."""
        touched = set()
        names = [p["name"] for p in self.projects.list(with_times=False)]
        for ch in rec.changes or []:
            path = str(ch.get("path") or "")
            for n in names:
                if path == n or path.startswith(n + "/"):
                    touched.add(n)
        made = []
        for n in sorted(touched):
            v = self.snapshot(n, rec.request[:200], rec.id)
            if v:
                made.append(n)
        return made
