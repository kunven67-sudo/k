"""Windows-only checks for Piece 4 (run by the Windows test machine, from build\\dist\\OVERDRIVE\\app):

  ..\\python\\python.exe -E -s -X utf8 ..\\..\\..\\win_check4.py <screenshots folder>

- OVERDRIVE.exe opens its OWN window (WebView2, class OverdriveWindow), not Edge; a second start brings the same
  window back (still one window); the window shows the real page (screenshot saved for a human to look at)
- minimizing makes the page sleep and it comes back
- its own ears: downloads the real speech engine + voice pack, then hears a test recording through the DLL engine
- sounddevice (the mic library) loads; secrets are locked with Windows DPAPI
"""
from __future__ import annotations

import ctypes
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

fails: list[str] = []
OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "shots").resolve()
OUT.mkdir(parents=True, exist_ok=True)
user32 = ctypes.windll.user32


def check(name: str, ok: bool, detail: str = "") -> None:
    print(("PASS " if ok else "FAIL ") + name + (f": {detail}" if detail else ""), flush=True)
    if not ok:
        fails.append(name)


def windows_of_class(cls: str) -> list[int]:
    found: list[int] = []
    proto = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    def cb(h, _):
        buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(h, buf, 256)
        if buf.value == cls and user32.IsWindowVisible(h):
            found.append(h)
        return True
    user32.EnumWindows(proto(cb), 0)
    return found


def shot(hwnd: int, name: str) -> tuple[int, int, bytes]:
    from overdrive import gameeyes
    w, h, px = gameeyes.capture(hwnd)
    (OUT / name).write_bytes(gameeyes.png_from_bgra(w, h, px))
    return w, h, px


def main() -> int:
    exe = Path(__file__).resolve().parent / "dist" / "OVERDRIVE" / "OVERDRIVE.exe"
    check("OVERDRIVE.exe is built", exe.is_file(), str(exe))
    home = Path(os.environ.get("OVERDRIVE_HOME", ""))
    env = dict(os.environ, OVERDRIVE_PORT="47121")
    env.pop("OVERDRIVE_NO_WINDOW", None)
    subprocess.Popen([str(exe)], env=env, cwd=str(exe.parent))
    hwnds: list[int] = []
    for _ in range(90):
        hwnds = windows_of_class("OverdriveWindow")
        if hwnds:
            break
        time.sleep(0.5)
    check("its own window opens (not Edge)", len(hwnds) == 1, repr(hwnds))
    edge = subprocess.run(["tasklist", "/FI", "IMAGENAME eq msedge.exe", "/FO", "CSV", "/NH"], capture_output=True, text=True).stdout
    print("     msedge processes (WebView2 uses msedgewebview2.exe, not msedge.exe):", edge.count("msedge.exe"), flush=True)
    if hwnds:
        hwnd = hwnds[0]
        user32.ShowWindow(hwnd, 9)
        time.sleep(9)                                   # the page loads + draws
        w, h, px = shot(hwnd, "own-window.png")
        import statistics
        sample = [px[i] for i in range(0, len(px), 4 * 97)]
        check("the window shows the page (not blank / white)", w > 500 and h > 400 and 5 < statistics.mean(sample) < 200
              and len(set(sample)) > 8, f"{w}x{h} mean={statistics.mean(sample):.0f} colors={len(set(sample))}")
        title = ctypes.create_unicode_buffer(256)
        user32.GetWindowTextW(hwnd, title, 256)
        check("window title", "OVERDRIVE" in title.value, title.value)
        # the page connected to OVERDRIVE (its live event stream)
        info = json.loads((home / "data" / "running.json").read_text(encoding="utf-8"))
        url = info["url"]
        tok = url.split("#t=")[1]
        req = urllib.request.Request(f"http://127.0.0.1:{info['port']}/api/state", headers={"X-OD-Token": tok})
        st = json.loads(urllib.request.urlopen(req, timeout=5).read())
        check("the window's page talks to OVERDRIVE", st.get("version", "").startswith("0.4"), st.get("version"))
        # a second start brings the same window back (still exactly one)
        subprocess.Popen([str(exe), "--window", url, "--data", str(home / "data" / "window")])
        time.sleep(4)
        check("starting again brings the same window back", windows_of_class("OverdriveWindow") == [hwnd],
              repr(windows_of_class("OverdriveWindow")))
        # minimize (page sleeps) and back
        user32.ShowWindow(hwnd, 6)
        time.sleep(2)
        check("minimized", bool(user32.IsIconic(hwnd)))
        user32.ShowWindow(hwnd, 9)
        time.sleep(3)
        w2, h2, px2 = shot(hwnd, "own-window-after-minimize.png")
        sample2 = [px2[i] for i in range(0, len(px2), 4 * 97)]
        check("it comes back after minimize", len(set(sample2)) > 8, f"{w2}x{h2}")
        user32.PostMessageW(hwnd, 0x0010, 0, 0)          # close it like the X button
        time.sleep(2)
        check("the X button closes it", not windows_of_class("OverdriveWindow"))
        place = home / "data" / "window" / "window-place.json"
        check("it remembers where the window was", place.is_file(), place.read_text() if place.is_file() else "")

    # its own ears: the real engine DLLs + voice pack from the internet, then a real recording
    from overdrive.voice import Voice
    evs: list = []
    with __import__("tempfile").TemporaryDirectory(ignore_cleanup_errors=True) as t:   # loaded DLLs can't be deleted
        v = Voice(Path(t), lambda typ, **k: evs.append(k))
        v.download("small")
        t0 = time.time()
        while v.downloading and time.time() - t0 < 300:
            time.sleep(0.5)
        check("voice pack + engine download", v.status()["ready"], v.last_error or json.dumps(v.status()))
        wav = Path(os.environ.get("OVERDRIVE_TEST_VOSK_WAV", ""))
        if v.status()["ready"] and wav.is_file():
            os.environ["OVERDRIVE_VOICE_WAV"], os.environ["OVERDRIVE_VOICE_FAST"] = str(wav), "1"
            sid = v.start("dict")
            t0 = time.time()
            while v.listening and time.time() - t0 < 60:
                time.sleep(0.2)
            finals = [e["text"] for e in evs if e.get("kind") == "final" and e.get("session") == sid]
            check("its own ears hear the recording (DLL engine)", any("zero" in f or "one" in f for f in finals),
                  repr(finals) + " " + repr([e for e in evs if e.get("kind") == "error"]))
            check("engine is the downloaded DLL", type(v.engine()).__name__ == "_CEngine", type(v.engine()).__name__)
    try:
        import sounddevice as sd
        devs = sd.query_devices()
        check("the mic library loads", True, f"{len(devs)} sound devices")
    except Exception as e:
        check("the mic library loads", False, repr(e))
    from overdrive.secretbox import SecretBox
    with __import__("tempfile").TemporaryDirectory() as t:
        b = SecretBox(Path(t))
        b.set("x", "sk-ant-oat01-secret-test-value-123456")
        raw = (Path(t) / "secrets.json").read_text()
        check("secrets are locked with Windows DPAPI", "dpapi:" in raw and "secret-test" not in raw
              and b.get("x") == "sk-ant-oat01-secret-test-value-123456")
    print(f"\n{len(fails)} failed" if fails else "\nall Piece 4 Windows checks passed", flush=True)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
