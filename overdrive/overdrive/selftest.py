"""Self-tests (rules 53, 55, 93).

The same tests run in development (pytest) and on your PC (Status tab ->
Run self-tests). Each test says which blueprint rules it proves. Results are
saved, compared with the last run, and new failures are flagged as regressions.
End-to-end tests run the REAL Claude Code against a fake Claude on your own PC
(127.0.0.1), so they cost $0 and use none of your Claude usage.
"""
from __future__ import annotations

import importlib
import os
import shutil
import tempfile
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from . import VERSION
from .jsonio import atomic_write_json, read_json, utc_now_iso


@dataclass
class TestInfo:
    name: str
    rules: tuple[int, ...]
    needs_cli: bool
    fn: Callable[[], None]
    title: str


TESTS: dict[str, TestInfo] = {}
CLI: str | None = None          # Claude Code path for end-to-end tests (set by run_all / pytest)


def covers(*rules: int, cli: bool = False, title: str = ""):
    def deco(fn: Callable[[], None]) -> Callable[[], None]:
        TESTS[fn.__name__] = TestInfo(fn.__name__, tuple(rules), cli, fn,
                                      title or (fn.__doc__ or fn.__name__).strip().splitlines()[0])
        return fn
    return deco


def load_all() -> dict[str, TestInfo]:
    for mod in ("core_tests", "e2e_tests"):
        importlib.import_module(f"overdrive.selftests.{mod}")
    return TESTS


class TempDir:
    """A throwaway folder for one test (deleted afterwards)."""

    def __enter__(self) -> Path:
        self.path = Path(tempfile.mkdtemp(prefix="overdrive-test-"))
        return self.path

    def __exit__(self, *exc) -> None:
        shutil.rmtree(self.path, ignore_errors=True)


def run_one(t: TestInfo) -> dict:
    t0 = time.perf_counter()
    try:
        t.fn()
        ok, err = True, ""
    except Exception as e:
        ok = False
        tb = traceback.format_exception(type(e), e, e.__traceback__)
        err = (str(e) or type(e).__name__)[:300] + "\n" + "".join(tb[-3:])[-1500:]
    return {"ok": ok, "ms": int((time.perf_counter() - t0) * 1000), "error": err, "rules": list(t.rules),
            "title": t.title}


def run_all(data_dir: Path | None = None, include_e2e: bool = True, cli: str | None = None,
            only: set[str] | None = None, progress: Callable[[str, dict], None] | None = None) -> dict:
    global CLI
    from .brain import find_cli
    load_all()
    CLI = cli or find_cli(os.environ.get("OVERDRIVE_TEST_CLI", ""))
    results: dict[str, dict] = {}
    for name, t in TESTS.items():
        if only and name not in only:
            continue
        if t.needs_cli and (not include_e2e or not CLI):
            why = "end-to-end tests turned off" if not include_e2e else "Claude Code is not installed"
            results[name] = {"ok": None, "skipped": why, "ms": 0, "error": "", "rules": list(t.rules), "title": t.title}
        else:
            results[name] = run_one(t)
        if progress:
            progress(name, results[name])
    summary = {"when": utc_now_iso(), "version": VERSION, "cli": CLI,
               "passed": sum(1 for r in results.values() if r["ok"] is True),
               "failed": sum(1 for r in results.values() if r["ok"] is False),
               "skipped": sum(1 for r in results.values() if r["ok"] is None),
               "results": results}
    if data_dir is not None:
        path = Path(data_dir) / "selftest-results.json"
        before = read_json(path, {}) or {}
        prev = before.get("results", {}) if isinstance(before, dict) else {}
        summary["regressions"] = sorted(n for n, r in results.items()
                                        if r["ok"] is False and (prev.get(n) or {}).get("ok") is True)
        summary["previous"] = {"when": before.get("when"), "passed": before.get("passed"), "failed": before.get("failed")}
        if only:  # partial run: keep the other results from before
            merged = dict(prev)
            merged.update(results)
            summary["results"] = merged
            summary["passed"] = sum(1 for r in merged.values() if r.get("ok") is True)
            summary["failed"] = sum(1 for r in merged.values() if r.get("ok") is False)
            summary["skipped"] = sum(1 for r in merged.values() if r.get("ok") is None)
        atomic_write_json(path, summary)
    return summary


def latest_results(data_dir: Path) -> dict:
    d = read_json(Path(data_dir) / "selftest-results.json", {}) or {}
    return d if isinstance(d, dict) else {}
