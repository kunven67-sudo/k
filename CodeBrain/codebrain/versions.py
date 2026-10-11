"""💾 Automatic backups: a copy of your file every time you Run or Save, so you can go back."""

import difflib
import hashlib
import json
import time
from pathlib import Path

from codebrain.paths import brain_dir

KEEP = 50   # versions kept per file


def _folder_for(path):
    path = Path(path).resolve()
    key = hashlib.sha1(str(path).lower().encode("utf-8")).hexdigest()[:10]
    folder = brain_dir() / "versions" / f"{path.stem}-{key}"
    folder.mkdir(parents=True, exist_ok=True)
    info = folder / "file.json"
    if not info.exists():
        info.write_text(json.dumps({"path": str(path)}), encoding="utf-8")
    return folder


def list_versions(path):
    """Newest first: list of (version_path, time_text, line_count)."""
    folder = _folder_for(path)
    result = []
    for v in sorted(folder.glob("*.py"), reverse=True):
        stamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(v.stat().st_mtime))
        try:
            lines = len(v.read_text(encoding="utf-8", errors="replace").splitlines())
        except OSError:
            lines = 0
        result.append((v, stamp, lines))
    return result


def save_version(path, code, reason="run"):
    """Keep a copy (skips it if nothing changed since the last copy). Returns the new version path or None."""
    if not code.strip():
        return None
    existing = list_versions(path)
    if existing:
        try:
            if existing[0][0].read_text(encoding="utf-8") == code:
                return None
        except OSError:
            pass
    folder = _folder_for(path)
    name = time.strftime("%Y%m%d-%H%M%S") + f"-{time.time_ns() % 1_000_000_000:09d}-{reason}.py"
    target = folder / name
    target.write_text(code, encoding="utf-8")
    for old, _stamp, _lines in existing[KEEP - 1:]:
        old.unlink(missing_ok=True)
    return target


def diff(old_code, new_code, old_name="old version", new_name="now"):
    """Lines starting with + were added, - were removed."""
    return "".join(difflib.unified_diff(old_code.splitlines(True), new_code.splitlines(True),
                                        fromfile=old_name, tofile=new_name))
