"""🧪 Secret test runs: CodeBrain runs ITS OWN code for a few seconds before showing it to you.

Safety first:
- It runs in a temporary copy of your project (your real files are never touched).
- pygame windows are invisible; ursina windows are tiny + minimized; sound is off.
- Code that deletes files, runs other programs or uses the internet is NOT test-run.
"""

import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from codebrain.runner import _env, error_summary, python_exe

SECONDS_2D = 3
SECONDS_3D = 8          # ursina needs a few seconds just to start

_DANGER = re.compile(
    r"\b(os\s*\.\s*(remove|unlink|rmdir|removedirs|system|popen|rename|replace|chmod|kill|startfile|exec\w*)"
    r"|shutil\s*\.\s*(rmtree|move|copy\w*)|subprocess|socket|urllib|requests|http\.client|ftplib|smtplib"
    r"|ctypes|winreg|webbrowser|multiprocessing|__import__|(?<!\.)\beval\s*\(|(?<!\.)\bexec\s*\("
    r"|\.unlink\s*\(|\.rmdir\s*\()"
)
_ASSET_TYPES = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".wav", ".ogg", ".mp3", ".ttf", ".otf", ".json",
                ".txt", ".csv", ".obj", ".glb", ".gltf", ".py"}
_MAX_COPY = 60 * 1024 * 1024

LAUNCHER = r'''
import os, sys

def _main():
    os.environ["SDL_VIDEODRIVER"] = "dummy"      # pygame: no window at all
    os.environ["SDL_AUDIODRIVER"] = "dummy"      # no sound
    target = sys.argv[1]
    with open(target, encoding="utf-8") as f:
        src = f.read()
    if "ursina" in src:
        try:
            import ursina.main as um
            original = um.Ursina.__new__

            def tiny(proxy_cls, *a, **k):
                try:
                    app = original(proxy_cls, *a, **{**k, "size": (240, 180), "borderless": True})
                except TypeError:
                    app = original(proxy_cls, *a, **k)
                try:
                    from panda3d.core import WindowProperties
                    props = WindowProperties()
                    props.setMinimized(True)
                    app.win.requestProperties(props)
                except Exception:
                    pass
                return app
            um.Ursina.__new__ = staticmethod(tiny)
        except Exception:
            pass
    code = compile(src, target, "exec")
    sys.argv = [target]
    sys.path.insert(0, os.path.dirname(os.path.abspath(target)))
    # Run as the REAL __main__ module (ursina looks for update() there).
    main = sys.modules["__main__"].__dict__
    for key in [k for k in main if k != "__builtins__"]:
        del main[key]
    main.update(__name__="__main__", __file__=target)
    exec(code, main)

_main()
'''


def is_safe(code):
    """(True, '') if the code is OK to test-run, else (False, why)."""
    m = _DANGER.search(code)
    if m:
        return False, f"uses '{m.group(0).strip()}'"
    return True, ""


def _copy_project(src_folder, dest):
    total = 0
    for p in Path(src_folder).rglob("*"):
        if not p.is_file() or p.suffix.lower() not in _ASSET_TYPES:
            continue
        if {"__pycache__", ".venv", "venv", ".git"} & set(p.parts):
            continue
        total += p.stat().st_size
        if total > _MAX_COPY:
            break
        target = dest / p.relative_to(src_folder)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, target)


class TestResult:
    def __init__(self, status, error=""):
        self.status = status      # "ok" | "alive" (still running = fine for games) | "crash" | "skipped"
        self.error = error

    @property
    def crashed(self):
        return self.status == "crash"


def test_run(files, main_name, project_folder=None, seconds=None):
    """Run main_name for a few seconds in a temp copy of the project. files = {name: code} from the answer."""
    for code in files.values():
        safe, why = is_safe(code)
        if not safe:
            return TestResult("skipped", why)
    main_code = files[main_name]
    if seconds is None:
        seconds = SECONDS_3D if "ursina" in main_code else SECONDS_2D
    with tempfile.TemporaryDirectory(prefix="codebrain-test-") as tmp:
        tmp = Path(tmp)
        if project_folder and Path(project_folder).is_dir():
            _copy_project(project_folder, tmp)
        for name, code in files.items():
            target = (tmp / name).resolve()
            if tmp.resolve() not in target.parents:
                return TestResult("skipped", "a file path points outside the project")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(code, encoding="utf-8")
        launcher = tmp / "_codebrain_testrun.py"
        launcher.write_text(LAUNCHER, encoding="utf-8")
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        proc = subprocess.Popen([python_exe(), "-u", str(launcher), str(tmp / main_name)], cwd=str(tmp),
                                stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                                env=_env(), creationflags=flags)
        try:
            _out, err = proc.communicate(input=b"1\n" * 200, timeout=seconds)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()
            return TestResult("alive")
        err = err.decode("utf-8", "replace").replace(str(tmp) + ("\\" if sys.platform == "win32" else "/"), "")
        if proc.returncode == 0 or "Traceback" not in err:
            return TestResult("ok")
        lines, skip = [], False
        for line in error_summary(err).splitlines():      # hide the test-run launcher from the error
            if "_codebrain_testrun" in line:
                skip = True
                continue
            if skip and line.startswith("    "):
                continue
            skip = False
            lines.append(line)
        summary = "\n".join(lines)
        if summary.rstrip().endswith(("EOFError", "EOFError: EOF when reading a line")):
            return TestResult("ok")      # it was just waiting for typing (input())
        return TestResult("crash", summary)
