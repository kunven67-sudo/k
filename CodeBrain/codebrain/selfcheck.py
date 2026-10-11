"""🔄 Self-check: CodeBrain checks its own code for mistakes before you rely on it.

It catches: broken Python (syntax/indentation), typos in names (pyflakes), and imports of
libraries that aren't installed (made-up ones). It does NOT run the code - that's your ▶ Run button.
"""

import ast
import importlib.util
import sys
import textwrap
from pathlib import Path

from codebrain.codeblocks import find_blocks

PY_LANGS = ("python", "py", "python3", "")


def _looks_complete(code):
    """Only check full programs/modules, not tiny fragments like 'x += 1'."""
    lines = [l for l in code.splitlines() if l.strip() and not l.strip().startswith("#")]
    if len(lines) < 3:
        return False
    top = [l for l in lines if not l[0].isspace()]
    return any(l.startswith(("import ", "from ", "def ", "class ")) for l in top)


def _missing_modules(tree, project_folder=None):
    missing = []
    for node in ast.walk(tree):
        names = []
        if isinstance(node, ast.Import):
            names = [a.name.split(".")[0] for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            names = [node.module.split(".")[0]]
        for name in names:
            if name in missing or name in sys.builtin_module_names:
                continue
            if project_folder and (Path(project_folder, name + ".py").exists() or Path(project_folder, name).is_dir()):
                continue   # the user's own file, like enemies.py
            try:
                if importlib.util.find_spec(name) is None:
                    missing.append(name)
            except (ImportError, ValueError):
                missing.append(name)
    return missing


def defined_names(code):
    """Names a file defines at the top (variables, functions, classes, imports).
    Returns None if it uses 'from x import *' (then we can't know every name)."""
    try:
        tree = ast.parse(code or "")
    except SyntaxError:
        return set()
    names = set()
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.add(node.name)
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            for a in node.names:
                if a.name == "*":
                    return None
                names.add((a.asname or a.name).split(".")[0])
        elif isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign, ast.For, ast.With)):
            for sub in ast.walk(node):
                if isinstance(sub, ast.Name) and isinstance(sub.ctx, ast.Store):
                    names.add(sub.id)
    return names


def _has_imports(tree):
    return any(isinstance(n, (ast.Import, ast.ImportFrom)) for n in tree.body)


def _name_problems(tree, filename, known=()):
    try:
        from pyflakes import checker, messages
    except ImportError:
        return []      # pyflakes not installed -> only syntax + import checks
    wanted = (messages.UndefinedName, messages.UndefinedLocal, messages.UndefinedExport)
    problems = []
    for msg in checker.Checker(tree, filename, builtins=set(known)).messages:
        if isinstance(msg, wanted):
            problems.append(f"line {msg.lineno}: {msg.message % msg.message_args}")
    return problems


def check_code(code, project_folder=None, filename="answer.py", other_files=(), editor_code=None):
    """Return a list of problems in one piece of code (empty list = looks good).

    editor_code = the user's open file: a piece of code meant to be ADDED to it may use its names."""
    code = textwrap.dedent(code)
    try:
        tree = ast.parse(code, filename)
    except SyntaxError as e:
        return [f"line {e.lineno}: {e.msg} (the code can't even start)"]
    problems = []
    others = set(other_files)
    missing = [m for m in _missing_modules(tree, project_folder) if m not in others]
    if missing:
        problems.append("imports a library that isn't installed: " + ", ".join(missing) +
                        " (only the standard library, pygame and ursina are available)")
    # Typo check: for whole programs (own imports), or pieces that go into a file whose names we know.
    known = defined_names(editor_code) if editor_code else set()
    if _has_imports(tree):
        problems += _name_problems(tree, filename, known or ())
    elif editor_code and known is not None:
        problems += _name_problems(tree, filename, known)
    return problems


def check_reply(reply, project_folder=None, editor_code=None):
    """Check every complete-looking python block in an answer. Returns ['block 1: ...', ...]."""
    from codebrain.project import file_blocks
    blocks = [(lang, code) for lang, code, _s, _e in find_blocks(reply) if lang in PY_LANGS]
    # files the answer itself creates (# file: enemies.py) count as existing modules
    created = {Path(name).stem for name, _ in file_blocks(reply)}
    problems = []
    for n, (_lang, code) in enumerate(blocks, start=1):
        if not _looks_complete(code):
            continue
        for p in check_code(code, project_folder, other_files=created, editor_code=editor_code):
            problems.append(f"code block {n}, {p}")
    return problems
