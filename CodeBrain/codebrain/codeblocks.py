"""Find the ```python code``` blocks inside CodeBrain's answers."""

import re

_BLOCK = re.compile(r"```[ \t]*([\w+-]*)[^\n]*\n(.*?)(?:```|\Z)", re.S)


def find_blocks(text):
    """Return a list of (language, code, start, end) for each fenced block."""
    return [(m.group(1).lower(), m.group(2).rstrip("\n"), m.start(), m.end()) for m in _BLOCK.finditer(text)]


def best_code(text):
    """The code you'd want in the editor: the biggest Python block in the answer."""
    blocks = [b for b in find_blocks(text) if b[0] in ("python", "py", "python3", "")]
    if not blocks:
        return None
    return max(blocks, key=lambda b: len(b[1]))[1]
