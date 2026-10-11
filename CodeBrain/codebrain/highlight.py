"""Colors for Python code in the editor (keywords green, strings yellow, ...)."""

import bisect
import keyword
import re

BUILTINS = ("print", "input", "len", "range", "int", "str", "float", "list", "dict", "set", "tuple",
            "abs", "min", "max", "sum", "round", "open", "enumerate", "zip", "sorted", "isinstance",
            "type", "super", "bool", "any", "all", "map", "filter", "reversed", "self", "True",
            "False", "None")

RULES = [
    ("keyword", re.compile(r"\b(?:" + "|".join(k for k in keyword.kwlist if k not in ("True", "False", "None")) + r")\b")),
    ("builtin", re.compile(r"\b(?:" + "|".join(BUILTINS) + r")\b")),
    ("number", re.compile(r"\b\d+(?:\.\d+)?\b")),
    ("defname", re.compile(r"(?<=\bdef )\w+|(?<=\bclass )\w+")),
    ("string", re.compile(r"[rRbBfF]{0,2}(?:\"\"\"[\s\S]*?(?:\"\"\"|$)|'''[\s\S]*?(?:'''|$)|\"[^\"\n]*\"?|'[^'\n]*'?)")),
    ("comment", re.compile(r"#[^\n]*")),
]


def spans(code):
    """Yield (tag, start_offset, end_offset). Strings/comments win over keywords inside them."""
    result = []
    taken = []  # (start, end) of strings + comments

    # Strings and comments first, scanning left to right so '#' inside a string isn't a comment.
    pattern = re.compile(RULES[4][1].pattern + "|" + RULES[5][1].pattern)
    for m in pattern.finditer(code):
        tag = "comment" if m.group().startswith("#") else "string"
        result.append((tag, m.start(), m.end()))
        taken.append((m.start(), m.end()))

    starts = [s for s, _ in taken]

    def inside(pos):
        i = bisect.bisect_right(starts, pos) - 1
        return i >= 0 and taken[i][0] <= pos < taken[i][1]

    for tag, rx in RULES[:4]:
        for m in rx.finditer(code):
            if not inside(m.start()):
                result.append((tag, m.start(), m.end()))
    return result


class IndexMapper:
    """Turns a character offset in Python text into a Tk 'line.col' index.

    Older Tk counts emojis as 2 characters, newer Tk as 1 - utf16 tells us which.
    """

    def __init__(self, text, utf16):
        self.lines = text.split("\n")
        self.starts = []
        pos = 0
        for line in self.lines:
            self.starts.append(pos)
            pos += len(line) + 1
        self.utf16 = utf16

    def index(self, offset):
        row = bisect.bisect_right(self.starts, offset) - 1
        col = offset - self.starts[row]
        if self.utf16:
            col = len(self.lines[row][:col].encode("utf-16-le")) // 2
        return f"{row + 1}.{col}"
