"""Runs your Python code (only when YOU press Run) and catches errors for Bug Detective 🔍."""

import os
import queue
import re
import subprocess
import sys
import threading
from pathlib import Path


def python_exe():
    """The Python that runs your code. pythonw.exe (no console) -> use python.exe instead."""
    exe = Path(sys.executable)
    if exe.name.lower() == "pythonw.exe":
        console = exe.with_name("python.exe")
        if console.exists():
            return str(console)
    return str(exe)


def _env():
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    env["PYTHONUNBUFFERED"] = "1"
    env["PYGAME_HIDE_SUPPORT_PROMPT"] = "1"
    return env


class RunResult:
    def __init__(self, returncode, stdout, stderr, stopped=False):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr
        self.stopped = stopped

    @property
    def crashed(self):
        return not self.stopped and (self.returncode != 0 or "Traceback (most recent call last)" in self.stderr)

    @property
    def error_text(self):
        return error_summary(self.stderr)


def error_summary(stderr):
    """Return the traceback part of stderr (what Bug Detective needs)."""
    idx = stderr.rfind("Traceback (most recent call last)")
    if idx != -1:
        return stderr[idx:].strip()
    lines = [l for l in stderr.strip().splitlines() if l.strip()]
    return "\n".join(lines[-15:])


def error_line_number(error, filename=None):
    """Find which line of YOUR file crashed (last mention in the traceback)."""
    hits = re.findall(r'File "([^"]+)", line (\d+)', error)
    for path, line in reversed(hits):
        if filename is None or Path(path).name == Path(filename).name:
            return int(line)
    return None


class CodeRun:
    """A running program. Output arrives in .events as (kind, text) where kind is 'out' | 'err' | 'done'."""

    def __init__(self, path, cwd=None):
        self.path = Path(path)
        self.events = queue.Queue()
        self._out, self._err = [], []
        self.stopped = False
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        self.proc = subprocess.Popen(
            [python_exe(), "-u", str(self.path)],
            cwd=str(cwd or self.path.parent),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env=_env(), creationflags=flags,
        )
        self._threads = [
            threading.Thread(target=self._pump, args=(self.proc.stdout, "out", self._out), daemon=True),
            threading.Thread(target=self._pump, args=(self.proc.stderr, "err", self._err), daemon=True),
        ]
        for t in self._threads:
            t.start()
        threading.Thread(target=self._wait, daemon=True).start()

    def _pump(self, stream, kind, sink):
        while True:
            chunk = stream.read1(4096) if hasattr(stream, "read1") else stream.read(1)
            if not chunk:
                break
            text = chunk.decode("utf-8", "replace").replace("\r\n", "\n")
            sink.append(text)
            self.events.put((kind, text))

    def _wait(self):
        code = self.proc.wait()
        for t in self._threads:
            t.join(timeout=2)
        for stream in (self.proc.stdin, self.proc.stdout, self.proc.stderr):
            try:
                stream.close()
            except OSError:
                pass
        self.result = RunResult(code, "".join(self._out), "".join(self._err), self.stopped)
        self.events.put(("done", self.result))

    def send_input(self, text):
        """Type something into the program (for input())."""
        try:
            self.proc.stdin.write((text + "\n").encode("utf-8"))
            self.proc.stdin.flush()
        except (OSError, ValueError):
            pass

    def stop(self):
        if self.proc.poll() is None:
            self.stopped = True
            self.proc.kill()

    @property
    def running(self):
        return self.proc.poll() is None


def run_blocking(path, timeout=None, input_text=None):
    """Run a file and wait for it to finish (used by tests + terminal mode checks)."""
    proc = subprocess.run(
        [python_exe(), "-u", str(path)], cwd=str(Path(path).parent),
        input=(input_text or "").encode("utf-8"), capture_output=True, env=_env(), timeout=timeout,
    )
    return RunResult(proc.returncode, proc.stdout.decode("utf-8", "replace"),
                     proc.stderr.decode("utf-8", "replace"))


def run_interactive(path):
    """Terminal mode: the program talks to your terminal directly; we still catch the error text."""
    proc = subprocess.Popen([python_exe(), "-u", str(path)], cwd=str(Path(path).parent),
                            stderr=subprocess.PIPE, env=_env())
    err_parts = []

    def pump():
        for chunk in iter(lambda: proc.stderr.read1(4096), b""):
            text = chunk.decode("utf-8", "replace")
            err_parts.append(text)
            sys.stderr.write(text)
            sys.stderr.flush()

    t = threading.Thread(target=pump, daemon=True)
    t.start()
    stopped = False
    try:
        code = proc.wait()
    except KeyboardInterrupt:
        stopped = True
        proc.kill()
        code = proc.wait()
    t.join(timeout=2)
    proc.stderr.close()
    return RunResult(code, "", "".join(err_parts), stopped)
