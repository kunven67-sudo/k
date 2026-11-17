"""OVERDRIVE changes itself (Piece 3, their pick: "Yes, like that").

You say "add a setting for X". In Build mode it:
1. self_update: copies its OWN app code into the workspace (_overdrive-dev/overdrive), so it never edits the
   running app directly;
2. edits that copy, then self_update_check: runs its own self-tests on the copy and lists every file it changed;
3. self_update_install: shows you the changed files + test result on a Yes/No card. Yes = the current version is
   backed up, the changed files go in, and OVERDRIVE restarts.
If the new version fails to start, the next start puts the backup back by itself and tells you. Settings > "Its
own versions" can also go back to any older version by hand.
"""
from __future__ import annotations

import filecmp
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Callable

from .jsonio import atomic_write_json, read_json, utc_now_iso

APP_PKG = Path(__file__).resolve().parent            # .../app/overdrive (the running code)
IGNORE = shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo")
MAX_TRIES = 2


def _files(root: Path) -> dict[str, Path]:
    return {p.relative_to(root).as_posix(): p for p in root.rglob("*")
            if p.is_file() and "__pycache__" not in p.parts and p.suffix not in (".pyc", ".pyo")}


def fingerprint(root: Path) -> str:
    """One hash of every file's name AND contents (so a change after the check is noticed)."""
    import hashlib
    h = hashlib.sha256()
    for rel, p in sorted(_files(root).items()):
        h.update(rel.encode())
        h.update(b"\0")
        h.update(p.read_bytes())
    return h.hexdigest()


def run_selftests(app_root: Path, timeout: int = 600) -> dict:
    """Run the copy's own self-tests (no Claude Code tests) in a separate Python. Never touches your data."""
    with tempfile.TemporaryDirectory(prefix="overdrive-selfcheck-") as tmp:
        env = {k: v for k, v in os.environ.items() if not k.startswith("OVERDRIVE_")}
        env["OVERDRIVE_HOME"] = tmp
        flags = 0x08000000 if os.name == "nt" else 0
        try:
            # The Windows build's Python has a fixed path list (python3*._pth) that ignores the working folder,
            # so put the COPY first by hand: otherwise this would quietly test the old code.
            boot = ("import sys; sys.path.insert(0, sys.argv[1]); import overdrive; "
                    "assert overdrive.__file__.startswith(sys.argv[1]), overdrive.__file__; "
                    "from overdrive.__main__ import main; sys.exit(main(['selftest', '--no-e2e']))")
            r = subprocess.run([sys.executable, "-c", boot, str(app_root)], cwd=str(app_root), env=env,
                               capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout,
                               creationflags=flags)
        except subprocess.TimeoutExpired:
            return {"ok": False, "summary": f"the tests took longer than {timeout // 60} minutes", "output": ""}
        out = (r.stdout or "") + (r.stderr or "")
        last = [ln for ln in out.splitlines() if ln.startswith("passed ")]
        fails = [ln.strip() for ln in out.splitlines() if "[FAIL]" in ln][:20]
        return {"ok": r.returncode == 0, "summary": last[-1] if last else "the tests didn't run (it may not even start)",
                "failures": fails, "output": out[-4000:]}


class SelfMod:
    def __init__(self, home: Path, workspace: Path, data_dir: Path, app_pkg: Path = APP_PKG,
                 runner: Callable[[Path], dict] = run_selftests):
        self.app_pkg = Path(app_pkg)
        self.dev_root = Path(workspace) / "_overdrive-dev"
        self.dev_pkg = self.dev_root / "overdrive"
        self.backups = Path(home) / "versions" / "app"
        self.state_path = Path(data_dir) / "selfmod.json"
        self.runner = runner

    def state(self) -> dict:
        return read_json(self.state_path, {}) or {}

    def _set(self, **kv) -> dict:
        st = self.state()
        st.update(kv)
        atomic_write_json(self.state_path, st)
        return st

    # 1. a copy to work on
    def prepare(self, plan: str) -> Path:
        if self.dev_root.exists():
            shutil.rmtree(self.dev_root)
        shutil.copytree(self.app_pkg, self.dev_pkg, ignore=IGNORE)
        for doc in ("LIMITATIONS.md", "README.md", "SETUP.md"):          # its tests check the help docs too
            src = self.app_pkg.parent / doc
            if src.is_file():
                shutil.copy2(src, self.dev_root / doc)
        self._set(step="editing", plan=plan[:2000], started=utc_now_iso(), check=None)
        return self.dev_pkg

    # 2. what changed + its own tests
    def changes(self) -> dict:
        if not self.dev_pkg.is_dir():
            raise ValueError("There's no copy to check. Call self_update first.")
        old, new = _files(self.app_pkg), _files(self.dev_pkg)
        changed = sorted(k for k in new if k in old and not filecmp.cmp(old[k], new[k], shallow=False))
        added = sorted(k for k in new if k not in old)
        removed = sorted(k for k in old if k not in new)
        return {"changed": changed, "added": added, "removed": removed}

    def check(self) -> dict:
        diff = self.changes()
        if not any(diff.values()):
            res = {"ok": False, "summary": "nothing was changed in the copy", "diff": diff}
        else:
            res = dict(self.runner(self.dev_root), diff=diff)
        res["fingerprint"] = fingerprint(self.dev_pkg)
        self._set(step="checked", check=res, checked=utc_now_iso())
        return res

    # 3. install (after your Yes), with a backup
    def install(self) -> dict:
        st = self.state()
        chk = st.get("check") or {}
        if st.get("step") != "checked" or not chk.get("ok"):
            raise ValueError("It can only install a change that passed its own tests (run self_update_check first).")
        if chk.get("diff") != self.changes() or chk.get("fingerprint") != fingerprint(self.dev_pkg):
            raise ValueError("The copy changed after it was checked. Run self_update_check again.")
        stamp = time.strftime("%Y%m%d-%H%M%S")
        backup = self.backups / stamp / "overdrive"
        shutil.copytree(self.app_pkg, backup, ignore=IGNORE)
        diff = chk["diff"]
        for rel in diff["changed"] + diff["added"]:
            dst = self.app_pkg / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(self.dev_pkg / rel, dst)
        for rel in diff["removed"]:
            try:
                (self.app_pkg / rel).unlink()
            except OSError:
                pass
        self._set(step="installed", backup=str(backup), installed=utc_now_iso(), tries=0, plan=st.get("plan", ""))
        return {"backup": str(backup), **diff}

    def restore(self, backup: Path, why: str) -> None:
        backup = Path(backup)
        if not (backup / "__init__.py").is_file():
            raise ValueError("that backup is missing")
        keep = self.backups / ("before-restore-" + time.strftime("%Y%m%d-%H%M%S")) / "overdrive"
        shutil.copytree(self.app_pkg, keep, ignore=IGNORE)
        for rel in _files(self.app_pkg):
            if rel not in _files(backup):
                (self.app_pkg / rel).unlink(missing_ok=True)
        for rel, src in _files(backup).items():
            dst = self.app_pkg / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
        self._set(step="restored", restored=utc_now_iso(), why=why, restored_from=str(backup))

    def versions(self) -> list[dict]:
        if not self.backups.is_dir():
            return []
        out = []
        for d in sorted(self.backups.iterdir(), reverse=True):
            if (d / "overdrive" / "__init__.py").is_file():
                out.append({"name": d.name, "path": str(d / "overdrive")})
        return out

    # startup safety: a new version that won't start goes back by itself
    def on_start(self) -> str:
        st = self.state()
        if st.get("step") != "installed":
            return ""
        tries = int(st.get("tries", 0)) + 1
        self._set(tries=tries)
        if tries > MAX_TRIES and st.get("backup"):
            self.restore(Path(st["backup"]), "the new version didn't start")
            return "rolled_back"
        return "trying"

    def started_ok(self) -> None:
        if self.state().get("step") == "installed":
            self._set(step="running", confirmed=utc_now_iso())


def restart_command() -> list[str]:
    return [sys.executable, "-E", "-s", "-X", "utf8", "-m", "overdrive", "--restarted"]


def restart_now(app_root: Path) -> None:
    flags = 0x08000000 if os.name == "nt" else 0
    subprocess.Popen(restart_command(), cwd=str(app_root), creationflags=flags, close_fds=True,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def make_selfmod_tools(od) -> list:
    from .permissions import Risk
    from .tools import ToolResult, ToolSpec

    async def h_start(args: dict, ctx) -> ToolResult:
        if ctx.task is None or ctx.task.mode != "build":
            return ToolResult(text="Changing yourself needs Build mode: plan it with the human and call start_build first.",
                              is_error=True)
        import asyncio
        pkg = await asyncio.to_thread(od.selfmod.prepare, args["plan"])
        rel = pkg.relative_to(od.paths.workspace).as_posix()
        return ToolResult(text=(f"Your own app code is copied to {rel}/ (server.py = the window's server, agent.py = "
                                "the engine, settings.py = settings, prompts.py = your instructions, ui/index.html + "
                                "ui/app.js + ui/p3.js + ui/app.css = the window). Edit ONLY files in that copy. Keep the "
                                "self-tests passing (add one for a new feature in selftests/). Then call self_update_check."))

    async def h_check(args: dict, ctx) -> ToolResult:
        import asyncio
        try:
            res = await asyncio.to_thread(od.selfmod.check)
        except ValueError as e:
            return ToolResult(text=str(e), is_error=True)
        d = res["diff"]
        files = ", ".join(d["changed"] + [f"{x} (new)" for x in d["added"]] + [f"{x} (removed)" for x in d["removed"]])
        text = f"Self-tests on the copy: {res['summary']}. Files: {files or 'none'}."
        if not res["ok"]:
            text += " NOT ready to install. " + "; ".join(res.get("failures", [])) + "\n" + res.get("output", "")[-1500:]
        else:
            text += " Ready: call self_update_install (the human says Yes or No)."
        return ToolResult(text=text, is_error=not res["ok"])

    async def h_install(args: dict, ctx) -> ToolResult:
        import asyncio
        try:
            res = await asyncio.to_thread(od.selfmod.install)
        except ValueError as e:
            return ToolResult(text=str(e), is_error=True)
        od.restart_requested = True
        od.audit.write("self_update_installed", {k: res[k] for k in ("changed", "added", "removed", "backup")})
        return ToolResult(text="Installed. OVERDRIVE restarts by itself right after this answer (the old version is "
                               "backed up, and it goes back by itself if the new one won't start). Tell the human.")

    def install_preview(args: dict, ctx) -> dict:
        st = od.selfmod.state()
        chk = st.get("check") or {}
        d = chk.get("diff") or {"changed": [], "added": [], "removed": []}
        return {"plan": st.get("plan", "") + "\n\nWhy: " + str(args.get("why", "")),
                "steps": [f"changed: {x}" for x in d["changed"]] + [f"new: {x}" for x in d["added"]]
                + [f"removed: {x}" for x in d["removed"]] + [f"Its own tests: {chk.get('summary', 'not run')}"],
                "model": "no extra usage", "note": "Yes = back up this version, put the change in, restart. "
                "If the new version won't start, it goes back by itself."}

    plan_schema = {"type": "object", "properties": {"plan": {"type": "string", "minLength": 3, "maxLength": 2000}},
                   "required": ["plan"], "additionalProperties": False}
    return [
        ToolSpec(name="self_update", title="Start changing itself",
                 description=("Change OVERDRIVE ITSELF (add a setting, a feature, fix its own bug) when the human asks. "
                              "Copies your own app code into the workspace for you to edit. Build mode only. "
                              "Then edit the copy, call self_update_check, then self_update_install."),
                 schema=plan_schema, risk=Risk.INTERNAL, handler=h_start, selftest="test_self_update",
                 limitations=["Edits a copy; the running app only changes after the human's Yes and a restart."]),
        ToolSpec(name="self_update_check", title="Test its own change",
                 description="Run OVERDRIVE's own self-tests on the changed copy and list every file that changed.",
                 schema={"type": "object", "properties": {}, "additionalProperties": False}, risk=Risk.INTERNAL,
                 handler=h_check, selftest="test_self_update",
                 limitations=["Runs the offline self-tests only (not the ones that need Claude Code)."]),
        ToolSpec(name="self_update_install", title="Install its own change",
                 description="Ask the human to install the tested change (Yes/No card), then restart OVERDRIVE.",
                 schema={"type": "object", "properties": {"why": {"type": "string", "maxLength": 400}},
                         "additionalProperties": False}, risk=Risk.INTERNAL, handler=h_install, preview=install_preview,
                 selftest="test_self_update",
                 limitations=["Only a change that passed its own tests can be installed.",
                              "Goes back to the backup by itself if the new version fails to start twice."]),
    ]
