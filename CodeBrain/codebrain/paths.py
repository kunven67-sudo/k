"""Where CodeBrain keeps your stuff: a "CodeBrain" folder on your Desktop."""

import os
import sys
from pathlib import Path


def _windows_desktop():
    """Ask Windows where the Desktop really is (it can be inside OneDrive)."""
    try:
        import ctypes
        from ctypes import wintypes

        buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        CSIDL_DESKTOPDIRECTORY = 0x10
        if ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOPDIRECTORY, None, 0, buf) == 0:
            return Path(buf.value)
    except Exception:
        pass
    return None


def desktop_dir() -> Path:
    if sys.platform == "win32":
        found = _windows_desktop()
        if found and found.exists():
            return found
        for candidate in (Path.home() / "OneDrive" / "Desktop", Path.home() / "Desktop"):
            if candidate.exists():
                return candidate
    desktop = Path.home() / "Desktop"
    return desktop if desktop.exists() else Path.home()


def home_dir() -> Path:
    """The main CodeBrain folder. Set CODEBRAIN_HOME to put it somewhere else."""
    override = os.environ.get("CODEBRAIN_HOME")
    base = Path(override) if override else desktop_dir() / "CodeBrain"
    base.mkdir(parents=True, exist_ok=True)
    return base


def projects_dir() -> Path:
    path = home_dir() / "projects"
    path.mkdir(parents=True, exist_ok=True)
    return path


def brain_dir() -> Path:
    """Hidden-ish folder for memories, XP and settings."""
    path = home_dir() / "brain"
    path.mkdir(parents=True, exist_ok=True)
    return path
