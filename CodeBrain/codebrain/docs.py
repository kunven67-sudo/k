"""📖 Offline docs for pygame + ursina, built from the libraries installed on YOUR PC.

Used for 3 things:
1. Before answering, CodeBrain looks up the real functions you're asking about (fewer made-up functions).
2. Self-check catches calls to functions that don't exist (pygame.display.set_window -> doesn't exist!).
3. The 📖 Docs window lets you search it yourself.

The index is built in a separate Python process (python -m codebrain --build-docs) and saved to
brain/docs_index.json. It rebuilds by itself when pygame or ursina gets updated.
"""

import inspect
import json
import re
import subprocess
import sys
from pathlib import Path

from codebrain.paths import brain_dir

INDEX_VERSION = 2
LIBS = ("pygame", "ursina")
_WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def index_path():
    return brain_dir() / "docs_index.json"


def installed_versions():
    from importlib import metadata
    versions = {}
    for lib in LIBS:
        try:
            versions[lib] = metadata.version(lib)
        except metadata.PackageNotFoundError:
            versions[lib] = None
    return versions


# ====================================================================== building (runs in its own process)
def _first_line(obj):
    doc = inspect.getdoc(obj) or ""
    for line in doc.splitlines():
        line = line.strip()
        if line and not line.startswith(("/*", "*")):
            return line[:160]
    return ""


def _signature(obj):
    try:
        if inspect.isclass(obj) and "__init__" in vars(obj):
            sig = inspect.signature(obj.__init__)
            params = list(sig.parameters.values())[1:]          # drop self
            return str(sig.replace(parameters=params))
        return str(inspect.signature(obj))
    except (TypeError, ValueError):
        return ""


def _own_attributes(cls, prefix):
    """Attributes the library itself defines (not the hundreds inherited from the Panda3D engine)."""
    names = {}
    for klass in reversed(cls.__mro__):
        if getattr(klass, "__module__", "").startswith(prefix):
            for n in vars(klass):
                if not n.startswith("_"):
                    names[n] = klass
    return names


def _instance_attributes(cls):
    """Names set with self.x = ... in __init__ (like FirstPersonController.speed)."""
    try:
        src = inspect.getsource(cls.__init__)
    except (OSError, TypeError):
        return []
    seen = []
    for name in re.findall(r"self\.([a-z]\w*)\s*=", src):
        if name not in seen:
            seen.append(name)
    return seen


def _public(names):
    return [n for n in names if not n.startswith("_")]


def build_index():
    """Inspect pygame + ursina and write the index file. Returns number of entries."""
    import importlib
    import pkgutil
    import types

    entries, members, star = [], {}, {}
    seen = set()          # the same class can be reachable by several names (pygame.Rect = pygame.rect.Rect)

    def add(name, obj, kind):
        if id(obj) in seen:
            return
        seen.add(id(obj))
        sig = _signature(obj) if callable(obj) else ""
        doc = _first_line(obj) if callable(obj) or inspect.ismodule(obj) else ""
        entries.append({"name": name, "kind": kind, "sig": sig, "doc": doc})

    def add_class(full, cls, prefix):
        if id(cls) in seen:
            return
        add(full, cls, "class")
        attrs = _instance_attributes(cls)
        if attrs:
            doc = entries[-1]["doc"]
            entries[-1]["doc"] = (doc + "  " if doc else "") + "attributes: " + ", ".join(attrs[:25])
        for attr, owner in _own_attributes(cls, prefix).items():
            if owner is not cls:
                continue          # inherited: already listed under the parent class (Entity.animate_position)
            value = vars(owner)[attr]
            if isinstance(value, (staticmethod, classmethod)):
                value = value.__func__
            if isinstance(value, property):
                entries.append({"name": f"{full}.{attr}", "kind": "property", "sig": "", "doc": ""})
            elif callable(value):
                entries.append({"name": f"{full}.{attr}", "kind": "method", "sig": _signature(value),
                                "doc": _first_line(value)})

    # ---- pygame
    try:
        import pygame
        members["pygame"] = _public(dir(pygame))
        for name in members["pygame"]:
            obj = getattr(pygame, name, None)
            if isinstance(obj, types.ModuleType) and obj.__name__.startswith("pygame"):
                mod_name = f"pygame.{name}"
                members[mod_name] = _public(dir(obj))
                for sub in members[mod_name]:
                    sub_obj = getattr(obj, sub, None)
                    if inspect.isclass(sub_obj) and getattr(sub_obj, "__module__", "").startswith("pygame"):
                        add_class(f"{mod_name}.{sub}", sub_obj, "pygame")
                    elif callable(sub_obj):
                        add(f"{mod_name}.{sub}", sub_obj, "function")
            elif inspect.isclass(obj):
                add_class(f"pygame.{name}", obj, "pygame")
            elif callable(obj):
                add(f"pygame.{name}", obj, "function")
        star["pygame.locals"] = _public(dir(importlib.import_module("pygame.locals")))
    except Exception as e:  # pygame missing or broken
        print("pygame skipped:", e, file=sys.stderr)

    # ---- ursina
    try:
        import ursina
        namespace = {}
        exec("from ursina import *", namespace)
        star["ursina"] = _public(namespace)
        members["ursina"] = star["ursina"]
        for name in star["ursina"]:
            obj = namespace[name]
            if inspect.isclass(obj) and getattr(obj, "__module__", "").startswith("ursina"):
                add_class(f"ursina.{name}", obj, "ursina")
            elif inspect.isfunction(obj) and getattr(obj, "__module__", "").startswith("ursina"):
                add(f"ursina.{name}", obj, "function")
        for pkg_name in ("ursina.prefabs", "ursina.shaders"):
            pkg = importlib.import_module(pkg_name)
            for info in pkgutil.iter_modules(pkg.__path__):
                mod_name = f"{pkg_name}.{info.name}"
                try:
                    mod = importlib.import_module(mod_name)
                except Exception:
                    continue
                members[mod_name] = _public(dir(mod))
                for attr in members[mod_name]:
                    obj = getattr(mod, attr, None)
                    if inspect.isclass(obj) and getattr(obj, "__module__", "") == mod_name:
                        add_class(f"{mod_name}.{attr}", obj, "ursina")
    except Exception as e:
        print("ursina skipped:", e, file=sys.stderr)

    data = {"index_version": INDEX_VERSION, "versions": installed_versions(), "entries": entries,
            "members": members, "star": star}
    index_path().write_text(json.dumps(data), encoding="utf-8")
    return len(entries)


# ====================================================================== using it
class Docs:
    def __init__(self, path=None):
        self.path = Path(path) if path else index_path()
        self.data = None
        self.load()

    def load(self):
        try:
            self.data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            self.data = None
        return self.data is not None

    @property
    def ready(self):
        return self.data is not None

    def stale(self):
        return (not self.ready or self.data.get("index_version") != INDEX_VERSION
                or self.data.get("versions") != installed_versions())

    def rebuild(self, timeout=180):
        """Build the index in a separate Python (importing ursina here would slow CodeBrain down)."""
        from codebrain.runner import _env, python_exe
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        env = _env()
        env["SDL_VIDEODRIVER"] = "dummy"
        subprocess.run([python_exe(), "-m", "codebrain", "--build-docs"], cwd=str(Path(__file__).parent.parent),
                       env=env, capture_output=True, timeout=timeout, creationflags=flags)
        return self.load()

    # ---- lookups
    def members(self, dotted):
        return set(self.data["members"].get(dotted, [])) if self.ready else None

    def star_names(self, module):
        return set(self.data["star"].get(module, [])) if self.ready else None

    def search(self, query, limit=12):
        """Find entries for words/dotted names in the query. Exact names first."""
        if not self.ready or not query:
            return []
        words = {w.lower() for w in _WORD.findall(query) if len(w) > 2}
        dotted = {d.lower() for d in re.findall(r"[A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)+", query)}
        if not words and not dotted:
            return []
        scored = []
        for e in self.data["entries"]:
            name = e["name"].lower()
            last = name.rsplit(".", 1)[-1]
            score = 0
            if any(name.endswith(d) for d in dotted):
                score += 10
            if last in words:
                score += 6 if len(last) > 3 else 3
                score += 3 * sum(1 for w in words if w != last and w in name)   # "Vector2 normalize"
            elif any(w in last for w in words if len(w) > 4):
                score += 2
            if score and e["kind"] == "class":
                score += 1
            if score:
                scored.append((score, -len(name), e))
        scored.sort(key=lambda s: (-s[0], -s[1]))
        return [e for _, _, e in scored[:limit]]

    @staticmethod
    def format(entry):
        line = entry["name"] + (entry["sig"] or "")
        return f"{line}  - {entry['doc']}" if entry["doc"] else line

    def prompt_text(self, query, max_chars=1800):
        hits = self.search(query)
        if not hits:
            return ""
        out = ["REAL pygame/ursina API on the user's PC (looked up offline; use these exact names):"]
        for e in hits:
            line = "- " + self.format(e)
            if sum(len(l) for l in out) + len(line) > max_chars:
                break
            out.append(line)
        return "\n".join(out) if len(out) > 1 else ""


def run_build():
    count = build_index()
    print(f"📖 Docs ready: {count} pygame + ursina entries")
