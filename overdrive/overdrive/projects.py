"""Your projects (Piece 3): every game / app / tool folder in the workspace, with a Done switch.

A project is a folder that holds real files: a top-level folder of the workspace, or one level down inside
a group folder (games/, apps/, tools/, mods/...). Done projects are skipped by the bug hunt. A project
nobody touched for a while can be marked done by itself (setting auto_done: always / ask / never).
"""
from __future__ import annotations

import time
from pathlib import Path

from .jsonio import atomic_write_json, read_json, utc_now_iso

GROUP_DIRS = {"games", "apps", "tools", "mods", "projects", "sites", "scripts", "experiments"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "_chat-pictures", "_overdrive-dev", ".godot", "Library",
             "Temp", "obj", ".vs", ".idea"}
MARKERS = {"index.html", "main.py", "package.json", "project.godot", "Cargo.toml", "go.mod", "main.lua",
           "manifest.json", "CMakeLists.txt", "pyproject.toml", "game.py", "app.py"}
MAX_SCAN_FILES = 4000


def _has_files(d: Path) -> bool:
    try:
        return any(p.is_file() for p in d.iterdir())
    except OSError:
        return False


def discover(workspace: Path) -> list[Path]:
    out: list[Path] = []
    try:
        tops = sorted(p for p in workspace.iterdir() if p.is_dir() and p.name not in SKIP_DIRS
                      and not p.name.startswith("."))
    except OSError:
        return out
    for top in tops:
        names = {p.name for p in top.iterdir()} if top.exists() else set()
        if top.name.lower() in GROUP_DIRS and not (names & MARKERS):
            subs = [p for p in sorted(top.iterdir()) if p.is_dir() and p.name not in SKIP_DIRS and not p.name.startswith(".")]
            out.extend(s for s in subs if _has_files(s) or any(x.is_dir() for x in s.iterdir()))
            continue
        out.append(top)
    return out


def last_change(folder: Path) -> float:
    """Newest file time inside a project (stops after MAX_SCAN_FILES files)."""
    newest, n = 0.0, 0
    for p in folder.rglob("*"):
        # only the part INSIDE the project counts (a "Temp" or "Library" higher up in the path is fine)
        if any(part in SKIP_DIRS for part in p.relative_to(folder).parts[:-1]):
            continue
        try:
            if p.is_file():
                newest = max(newest, p.stat().st_mtime)
                n += 1
                if n >= MAX_SCAN_FILES:
                    break
        except OSError:
            continue
    return newest


class Projects:
    def __init__(self, workspace: Path, data_dir: Path):
        self.workspace = Path(workspace)
        self.path = Path(data_dir) / "projects.json"
        self.state: dict[str, dict] = read_json(self.path, {}) or {}

    def _save(self) -> None:
        atomic_write_json(self.path, self.state)

    def name_of(self, folder: Path) -> str:
        return folder.relative_to(self.workspace).as_posix()

    def list(self, with_times: bool = True) -> list[dict]:
        out = []
        for f in discover(self.workspace):
            name = self.name_of(f)
            st = self.state.get(name, {})
            item = {"name": name, "done": bool(st.get("done")), "done_since": st.get("done_since"),
                    "done_by": st.get("done_by", ""), "asked": st.get("asked")}
            if with_times:
                t = last_change(f)
                item["changed"] = t
                item["changed_days"] = round((time.time() - t) / 86400, 1) if t else None
            out.append(item)
        return out

    def folder(self, name: str) -> Path | None:
        for f in discover(self.workspace):
            if self.name_of(f) == name:
                return f
        return None

    def set_done(self, name: str, done: bool, by: str = "you") -> dict:
        if self.folder(name) is None:
            raise ValueError(f"no project called {name!r}")
        st = self.state.setdefault(name, {})
        st["done"] = bool(done)
        st["done_since"] = utc_now_iso() if done else None
        st["done_by"] = by if done else ""
        st.pop("asked", None)
        self._save()
        return {"name": name, **st}

    def is_done(self, name: str) -> bool:
        return bool(self.state.get(name, {}).get("done"))

    def auto_done(self, mode: str, days: int) -> dict:
        """Projects untouched for `days`: mode always = mark done now; ask = list them to ask you once;
        never = nothing. Returns {"marked": [...], "ask": [...]}."""
        res: dict[str, list[str]] = {"marked": [], "ask": []}
        if mode == "never":
            return res
        for p in self.list():
            if p["done"] or p["changed_days"] is None or p["changed_days"] < days:
                continue
            if mode == "always":
                self.set_done(p["name"], True, by="OVERDRIVE (not touched for a while)")
                res["marked"].append(p["name"])
            elif not p.get("asked"):
                self.state.setdefault(p["name"], {})["asked"] = utc_now_iso()
                res["ask"].append(p["name"])
        if res["ask"]:
            self._save()
        return res
