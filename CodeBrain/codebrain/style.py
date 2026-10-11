"""🎨 Learns YOUR coding style from code that runs without errors, so CodeBrain writes like you."""

import ast
import json
import re
from pathlib import Path

from codebrain.paths import brain_dir

# What each kind of Python thing means in kid-friendly words (for "skills you've used")
CONCEPTS = {
    "for_loop": "for loops", "while_loop": "while loops", "if": "if/else", "function": "functions",
    "class": "classes", "list": "lists", "dict": "dictionaries", "fstring": "f-strings",
    "list_comp": "list comprehensions", "try": "try/except", "import_random": "random numbers",
    "pygame": "pygame (2D)", "ursina": "ursina (3D)", "raycast": "raycasts", "file_io": "saving files",
    "lambda": "lambdas", "global": "global variables",
}


def _naming(name):
    if name.startswith("_") or name.isupper() or len(name) < 3:
        return None
    if "_" in name and name.lower() == name:
        return "snake_case"
    if re.match(r"^[a-z]+[A-Z]", name):
        return "camelCase"
    if name.lower() == name:
        return None   # one word, tells us nothing
    return None


def analyze(code):
    """Return the style features found in one program (or None if it can't be parsed)."""
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return None
    f = {"naming": {}, "indent": {}, "quotes": {}, "concepts": set(), "comment_lines": 0, "code_lines": 0,
         "window_sizes": []}

    def vote(bucket, key):
        if key:
            f[bucket][key] = f[bucket].get(key, 0) + 1

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            f["concepts"].add("function")
            vote("naming", _naming(node.name))
        elif isinstance(node, ast.ClassDef):
            f["concepts"].add("class")
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            vote("naming", _naming(node.id))
        elif isinstance(node, ast.For):
            f["concepts"].add("for_loop")
        elif isinstance(node, ast.While):
            f["concepts"].add("while_loop")
        elif isinstance(node, ast.If):
            f["concepts"].add("if")
        elif isinstance(node, ast.List):
            f["concepts"].add("list")
        elif isinstance(node, ast.Dict):
            f["concepts"].add("dict")
        elif isinstance(node, ast.JoinedStr):
            f["concepts"].add("fstring")
        elif isinstance(node, (ast.ListComp, ast.DictComp, ast.SetComp)):
            f["concepts"].add("list_comp")
        elif isinstance(node, ast.Try):
            f["concepts"].add("try")
        elif isinstance(node, ast.Lambda):
            f["concepts"].add("lambda")
        elif isinstance(node, ast.Global):
            f["concepts"].add("global")
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            mods = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or ""]
            for m in mods:
                root = m.split(".")[0]
                if root in ("pygame", "ursina"):
                    f["concepts"].add(root)
                if root == "random":
                    f["concepts"].add("import_random")
                if root in ("json", "pathlib", "pickle"):
                    f["concepts"].add("file_io")
        elif isinstance(node, ast.Call):
            func = node.func
            name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
            if name == "raycast":
                f["concepts"].add("raycast")
            if name == "open":
                f["concepts"].add("file_io")
            if name == "set_mode" and node.args and isinstance(node.args[0], ast.Tuple):
                try:
                    f["window_sizes"].append(tuple(ast.literal_eval(node.args[0])))
                except ValueError:
                    pass

    for line in code.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            f["comment_lines"] += 1
            continue
        f["code_lines"] += 1
        if line.startswith("\t"):
            vote("indent", "tabs")
        elif line.startswith(" "):
            width = len(line) - len(line.lstrip(" "))
            vote("indent", "4 spaces" if width % 4 == 0 else "2 spaces" if width % 2 == 0 else None)
    for m in re.finditer(r"(?<![\w'\"])([\"'])(?!\1\1)", code):
        vote("quotes", "double" if m.group(1) == '"' else "single")
    f["concepts"] = sorted(f["concepts"])
    return f


class StyleProfile:
    def __init__(self, path=None):
        self.path = Path(path) if path else brain_dir() / "style.json"
        self.data = {"programs": 0, "naming": {}, "indent": {}, "quotes": {}, "concepts": {},
                     "comment_lines": 0, "code_lines": 0, "window_sizes": {}}
        if self.path.exists():
            try:
                self.data.update(json.loads(self.path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                pass

    def save(self):
        self.path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")

    def reset(self):
        self.path.unlink(missing_ok=True)
        self.__init__(self.path)

    def learn(self, code):
        """Learn from a program that ran OK. Returns True if it learned something."""
        f = analyze(code)
        if not f or f["code_lines"] < 5:
            return False
        d = self.data
        d["programs"] += 1
        for bucket in ("naming", "indent", "quotes"):
            for k, v in f[bucket].items():
                d[bucket][k] = d[bucket].get(k, 0) + v
        for c in f["concepts"]:
            d["concepts"][c] = d["concepts"].get(c, 0) + 1
        d["comment_lines"] += f["comment_lines"]
        d["code_lines"] += f["code_lines"]
        for size in f["window_sizes"]:
            key = "x".join(str(n) for n in size)
            d["window_sizes"][key] = d["window_sizes"].get(key, 0) + 1
        self.save()
        return True

    @staticmethod
    def _winner(votes, min_share=0.7, min_votes=5):
        total = sum(votes.values())
        if total < min_votes:
            return None
        best = max(votes, key=votes.get)
        return best if votes[best] / total >= min_share else None

    def summary_lines(self):
        """Plain-English facts about the user's style (empty until it has seen ~2 programs)."""
        d = self.data
        if d["programs"] < 2:
            return []
        lines = []
        naming = self._winner(d["naming"])
        if naming:
            lines.append(f"name things in {naming}")
        indent = self._winner(d["indent"])
        if indent:
            lines.append(f"indent with {indent}")
        quotes = self._winner(d["quotes"], min_share=0.75)
        if quotes:
            lines.append(f"use {quotes} quotes for strings")
        if d["code_lines"] >= 30:
            ratio = d["comment_lines"] / max(1, d["code_lines"])
            lines.append("write lots of comments" if ratio > 0.25 else
                         "write few comments" if ratio < 0.05 else "write some comments")
        if d["window_sizes"]:
            size = max(d["window_sizes"], key=d["window_sizes"].get)
            if d["window_sizes"][size] >= 2:
                lines.append(f"usually make {size} pygame windows")
        return lines

    def skills(self, min_times=2):
        """Concepts the user has used in programs that WORKED (at least min_times)."""
        return [CONCEPTS[c] for c, n in sorted(self.data["concepts"].items(), key=lambda kv: -kv[1])
                if n >= min_times and c in CONCEPTS]

    def prompt_text(self):
        lines = self.summary_lines()
        skills = self.skills()
        if not lines and not skills:
            return ""
        out = [f"THE USER'S CODING STYLE (learned from {self.data['programs']} of their programs that worked):"]
        if lines:
            out.append("- They " + "; ".join(lines) + ". MATCH this style in code you write for them.")
        if skills:
            out.append("- They've already used these successfully: " + ", ".join(skills) +
                       ". Don't over-explain those basics; spend explanations on NEW things.")
        return "\n".join(out)
