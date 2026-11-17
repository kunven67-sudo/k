"""Start with Windows (Piece 3): one entry in your own startup list (HKCU ... Run). No admin rights.
OVERDRIVE then starts hidden (no window) so it can work while you're away and pick up after a power cut;
open OVERDRIVE.exe to see it."""
from __future__ import annotations

import platform
import sys
from pathlib import Path

RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
NAME = "OVERDRIVE"


def launcher() -> Path | None:
    """OVERDRIVE.exe next to the bundled python folder (the Windows build)."""
    exe = Path(sys.executable).resolve().parent.parent / "OVERDRIVE.exe"
    return exe if exe.is_file() else None


def apply(on: bool) -> str:
    """Add or remove the startup entry. Returns a note for you ("" = done)."""
    if platform.system() != "Windows":
        return "Start with Windows only works on Windows."
    exe = launcher()
    if on and exe is None:
        return "Start with Windows needs the OVERDRIVE.exe build (it isn't running from it)."
    import winreg  # type: ignore[import-not-found]
    try:
        # CreateKeyEx opens the startup list, or makes it first on a PC where it doesn't exist yet
        with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as k:
            if on:
                winreg.SetValueEx(k, NAME, 0, winreg.REG_SZ, f'"{exe}" --background')
            else:
                try:
                    winreg.DeleteValue(k, NAME)
                except FileNotFoundError:
                    pass
    except OSError as e:
        return f"Windows didn't let OVERDRIVE change the startup list: {e}"
    return ""
