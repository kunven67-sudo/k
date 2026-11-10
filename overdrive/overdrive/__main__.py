"""Start OVERDRIVE.

  python -m overdrive              open the window (or bring back the running one)
  python -m overdrive selftest     run the self-tests in this terminal (--no-e2e to skip Claude Code tests)
  python -m overdrive --version
"""
from __future__ import annotations

import asyncio
import os
import platform
import sys
import traceback
from datetime import datetime
from pathlib import Path


def _message_box(title: str, text: str) -> None:
    if platform.system() == "Windows":
        try:
            import ctypes
            ctypes.windll.user32.MessageBoxW(None, text, title, 0x10)
            return
        except Exception:
            pass
    print(f"{title}: {text}", file=sys.stderr)


def _run_app() -> int:
    from .paths import default_home
    from .server import existing_instance, open_window, serve
    home = default_home()
    url = existing_instance(home)
    if url:  # already running: just bring the window back
        open_window(url, home / "data" / "window-profile")
        return 0
    from .agent import Overdrive
    od = Overdrive(home=home)
    asyncio.run(serve(od, open_ui=not os.environ.get("OVERDRIVE_NO_WINDOW")))
    return 0


def _run_selftest(args: list[str]) -> int:
    from . import selftest
    from .paths import Paths, default_home
    data = Paths(default_home()).ensure().data
    width = 0

    def progress(name: str, r: dict) -> None:
        mark = "PASS" if r["ok"] is True else ("skip" if r["ok"] is None else "FAIL")
        print(f"  [{mark}] {name} ({r.get('ms', 0)} ms) {r.get('skipped', '')}")
        if r["ok"] is False:
            print("        " + r["error"].replace("\n", "\n        ")[:1500])
        sys.stdout.flush()
    print("OVERDRIVE self-tests")
    s = selftest.run_all(data, include_e2e="--no-e2e" not in args, progress=progress)
    print(f"\npassed {s['passed']}, failed {s['failed']}, skipped {s['skipped']}"
          + (f", regressions: {', '.join(s['regressions'])}" if s.get("regressions") else ""))
    return 0 if s["failed"] == 0 else 1


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if "--version" in args:
        from . import VERSION
        print(f"OVERDRIVE {VERSION}")
        return 0
    try:
        if args and args[0] == "selftest":
            return _run_selftest(args[1:])
        return _run_app()
    except KeyboardInterrupt:
        return 130
    except Exception:
        text = traceback.format_exc()
        try:
            from .paths import default_home
            logs = default_home() / "logs"
            logs.mkdir(parents=True, exist_ok=True)
            crash = logs / f"crash-{datetime.now().strftime('%Y%m%d-%H%M%S')}.txt"
            crash.write_text(text, encoding="utf-8")
            where = str(crash)
        except Exception:
            where = "(could not write a crash file)"
        _message_box("OVERDRIVE couldn't start", f"Something went wrong while starting.\n\nDetails: {where}\n\n"
                                                 + text.strip().splitlines()[-1][:400])
        return 1


if __name__ == "__main__":
    sys.exit(main())
