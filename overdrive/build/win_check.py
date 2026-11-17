"""Windows-only checks for Piece 3 (run by the Windows test machine inside the BUILT app's own Python).

  ..\\python\\python.exe -E -s -X utf8 ..\\..\\..\\win_check.py      (from build\\dist\\OVERDRIVE\\app)
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

fails: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS " if ok else "FAIL ") + name + (f": {detail}" if detail else ""), flush=True)
    if not ok:
        fails.append(name)


def main() -> int:
    import overdrive
    check("app loads from the built folder", "dist" in overdrive.__file__, overdrive.__file__)

    from overdrive.away import idle_seconds
    s = idle_seconds()
    check("away detection reads the idle time", isinstance(s, float) and s >= 0, repr(s))

    from overdrive import pcinfo
    p = pcinfo.profile()
    check("PC profile reads the CPU and RAM", bool(p["cpu"]) and p["cpu"] != "unknown" and (p["ram_gb"] or 0) > 0, repr(p))
    print("     no-lag block:", pcinfo.prompt_block().splitlines()[0], flush=True)

    # game eyes: a real window (a red Windows Forms window), screenshot ONLY it, press keys into it
    ps = ("Add-Type -AssemblyName System.Windows.Forms; $f = New-Object Windows.Forms.Form; $f.Text = 'OD eyes test'; "
          "$f.BackColor = 'Red'; $f.Width = 420; $f.Height = 300; $f.ShowDialog()")
    proc = subprocess.Popen(["powershell", "-NoProfile", "-Command", ps])
    try:
        from overdrive import gameeyes
        hwnd = None
        for _ in range(60):
            hits = gameeyes._window_by_title("OD eyes test")
            if hits:
                hwnd = hits[0]
                break
            time.sleep(0.5)
        check("game eyes finds the window", hwnd is not None)
        if hwnd:
            w, h, px = gameeyes.capture(hwnd)
            png = gameeyes.png_from_bgra(w, h, px)
            mid = (h // 2 * w + w // 2) * 4
            b, g, r = px[mid], px[mid + 1], px[mid + 2]
            check("game eyes screenshot is the red window", w > 100 and h > 100 and r > 200 and g < 60 and b < 60,
                  f"{w}x{h} rgb=({r},{g},{b}) png={len(png)} bytes")
            check("game eyes blank check sees one color", gameeyes.looks_blank(px))
            unknown = gameeyes.press(hwnd, ["W", "SPACE", "LEFT", "NOPE"], 30)
            check("game eyes key presses go to the window only", unknown == ["NOPE"], repr(unknown))
            gameeyes.click(hwnd, 10, 10)
    finally:
        proc.kill()

    # Start with Windows: add, read back, remove (needs OVERDRIVE.exe: the built folder has it)
    from overdrive import autostart
    note = autostart.apply(True)
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, autostart.RUN_KEY) as k:
            val = winreg.QueryValueEx(k, autostart.NAME)[0]
    except OSError:
        val = ""
    check("Start with Windows adds the startup entry", note == "" and "OVERDRIVE.exe" in val and "--background" in val, val or note)
    autostart.apply(False)
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, autostart.RUN_KEY) as k:
            winreg.QueryValueEx(k, autostart.NAME)
        gone = False
    except OSError:
        gone = True
    check("Start with Windows removes it again", gone)

    # changing itself: the copy's own tests must run the COPY, with the built app's locked-path Python
    from overdrive.selfmod import SelfMod, run_selftests
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        (t / "data").mkdir()
        sm = SelfMod(t / "home", t / "ws", t / "data")
        dev = sm.prepare("windows check")
        marker = dev / "selftests" / "zz_marker_tests.py"
        marker.write_text("from ..selftest import covers\n\n@covers(1, title='marker')\ndef test_marker_from_the_copy():\n"
                          "    pass\n", encoding="utf-8")
        init = (dev / "selftest.py").read_text(encoding="utf-8")
        (dev / "selftest.py").write_text(init.replace('"piece4_tests")', '"piece4_tests", "zz_marker_tests")'), encoding="utf-8")
        r = run_selftests(sm.dev_root, timeout=900)
        check("its own tests run on the copy (not the old code)", r["ok"] and "test_marker_from_the_copy" in r["output"],
              r["summary"] + " | " + "; ".join(r.get("failures", [])))
    print(f"\n{len(fails)} failed" if fails else "\nall Windows checks passed", flush=True)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
