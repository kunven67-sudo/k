"""Small secrets kept on this PC (the year-long sign-in code, the Gmail app password).

Windows: locked with Windows' own DPAPI (only your Windows user on this PC can unlock them; a copied file is
useless elsewhere). Other systems (tests): stored as-is in a file only you can read.
Secrets never go into logs, chats, memory or exports.
"""
from __future__ import annotations

import base64
import os
import platform
from pathlib import Path

from .jsonio import atomic_write_json, read_json

IS_WINDOWS = platform.system() == "Windows"


def _lock(text: str) -> str:
    raw = text.encode("utf-8")
    if IS_WINDOWS:
        try:
            import win32crypt  # type: ignore
            blob = win32crypt.CryptProtectData(raw, "OVERDRIVE", None, None, None, 0)
            return "dpapi:" + base64.b64encode(blob).decode()
        except Exception:
            pass
    return "plain:" + base64.b64encode(raw).decode()


def _unlock(stored: str) -> str:
    kind, _, b64 = str(stored or "").partition(":")
    try:
        blob = base64.b64decode(b64)
    except Exception:
        return ""
    if kind == "dpapi" and IS_WINDOWS:
        try:
            import win32crypt  # type: ignore
            return win32crypt.CryptUnprotectData(blob, None, None, None, 0)[1].decode("utf-8")
        except Exception:
            return ""
    if kind == "plain":
        return blob.decode("utf-8", "replace")
    return ""


class SecretBox:
    def __init__(self, data_dir: Path):
        self.path = Path(data_dir) / "secrets.json"

    def _all(self) -> dict:
        d = read_json(self.path, {})
        return d if isinstance(d, dict) else {}

    def set(self, name: str, value: str) -> None:
        d = self._all()
        if value:
            d[name] = _lock(value)
        else:
            d.pop(name, None)
        atomic_write_json(self.path, d)
        try:
            os.chmod(self.path, 0o600)
        except OSError:
            pass

    def get(self, name: str) -> str:
        v = self._all().get(name)
        return _unlock(v) if v else ""

    def has(self, name: str) -> bool:
        return name in self._all()
