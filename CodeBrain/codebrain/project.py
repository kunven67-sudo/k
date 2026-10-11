"""🗂️ Whole-project awareness: which other files in your game folder CodeBrain should read."""

import re
from pathlib import Path

from codebrain.paths import projects_dir

_IMPORT = re.compile(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w., ]+))", re.M)
_FILE_HEADER = re.compile(r"^\s*#\s*(?:file\s*:\s*)?([\w./\\-]+\.py)\s*$", re.I)
WHOLE_PROJECT_WORDS = ("whole project", "all files", "all my files", "every file", "all the files", "entire project")
SKIP_DIRS = {"__pycache__", ".venv", "venv", ".git"}


def project_folder(path):
    """Your game's folder: projects/<game>/ (or the file's own folder if it's elsewhere)."""
    path = Path(path).resolve()
    root = projects_dir().resolve()
    try:
        rel = path.relative_to(root)
    except ValueError:
        return path.parent
    return root / rel.parts[0] if len(rel.parts) > 1 else path.parent


def project_files(folder, limit=80):
    files = []
    for p in sorted(Path(folder).rglob("*.py")):
        if not SKIP_DIRS & set(p.parts):
            files.append(p)
        if len(files) >= limit:
            break
    return files


def local_imports(code, folder):
    """Files in this folder that the code imports (import enemies -> enemies.py)."""
    found = []
    for a, b in _IMPORT.findall(code or ""):
        for name in (a or b).split(","):
            name = name.strip().split(" as ")[0].strip()
            if not name:
                continue
            base = Path(folder, *name.split("."))
            for candidate in (base.with_suffix(".py"), base / "__init__.py"):
                if candidate.exists() and candidate not in found:
                    found.append(candidate)
    return found


def mentioned(message, files):
    text = (message or "").lower()
    return [f for f in files if f.name.lower() in text or re.search(rf"\b{re.escape(f.stem.lower())}\b", text)]


def build_context(message, current_path, code, budget):
    """Text describing the rest of the project, at most `budget` characters."""
    if not current_path or budget < 500:
        return ""
    current = Path(current_path).resolve()
    folder = project_folder(current)
    files = [f for f in project_files(folder) if f.resolve() != current]
    if not files:
        return ""
    wants_all = any(w in (message or "").lower() for w in WHOLE_PROJECT_WORDS)
    picked = files if wants_all else []
    for f in mentioned(message, files) + local_imports(code, current.parent):
        if f.resolve() != current and f not in picked:
            picked.append(f)

    lines = [f"OTHER FILES IN THIS PROJECT (folder '{folder.name}'):"]
    lines += [f"- {f.relative_to(folder)}" for f in files]
    text = "\n".join(lines)
    for f in picked:
        try:
            content = f.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        block = f"\n\n(File \"{f.relative_to(folder)}\":)\n```python\n{content}\n```"
        if len(text) + len(block) > budget:
            room = budget - len(text) - 200
            if room > 800:
                text += f"\n\n(File \"{f.relative_to(folder)}\", start only:)\n```python\n{content[:room]}\n# ...cut off\n```"
            break
        text += block
    return text[:budget]


def file_blocks(reply):
    """Code blocks in an answer that say which file they belong to ('# file: enemies.py' on the first line)."""
    from codebrain.codeblocks import find_blocks
    result = []
    for lang, code, _s, _e in find_blocks(reply):
        if lang not in ("python", "py", "python3", ""):
            continue
        first = code.split("\n", 1)[0]
        m = _FILE_HEADER.match(first)
        if m:
            result.append((m.group(1).replace("\\", "/"), code))
    return result


def safe_target(folder, name):
    """Where to save 'name' inside folder. None if it tries to escape the folder (../../bad.py)."""
    folder = Path(folder).resolve()
    target = (folder / name).resolve()
    try:
        target.relative_to(folder)
    except ValueError:
        return None
    return target
