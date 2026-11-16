"""Piece 1: Claude Code's own tools, behind OVERDRIVE's gate.

In Build mode Claude gets the same hands Claude Code has: read / search files,
write and edit files, run commands (to run and test what it makes), and look
things up on the web. Every call still goes through OVERDRIVE's gate:

- each tool call gets a risk class (read, write, run, web, destructive...),
- your permission policy decides auto / ask / block for that class,
- anything outside the OVERDRIVE workspace folder always asks first,
- commands that look dangerous always ask first, even if "run" is on auto,
- file changes inside the workspace are versioned, so Undo can put them back.

Chat mode only gets the look-only tools (read, search, web, to-do list).
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .permissions import Risk

# Claude Code built-in tool names (Claude Code ignores names it doesn't have on this PC).
READ_TOOLS = ("Read", "Glob", "Grep", "LS", "NotebookRead")
EDIT_TOOLS = ("Write", "Edit", "MultiEdit", "NotebookEdit")
RUN_TOOLS = ("Bash", "PowerShell")
WEB_TOOLS = ("WebSearch", "WebFetch")
INTERNAL_TOOLS = ("TodoWrite",)

CHAT_TOOLS = ["AskUserQuestion", "TodoWrite", "Read", "Glob", "Grep", "WebSearch", "WebFetch"]
BUILD_TOOLS = ["AskUserQuestion", "TodoWrite", "Read", "Glob", "Grep", "Write", "Edit", "MultiEdit",
               "NotebookEdit", "Bash", "PowerShell", "WebSearch", "WebFetch"]

TITLES = {
    "Read": "Read a file", "Glob": "Find files", "Grep": "Search inside files", "LS": "List a folder",
    "NotebookRead": "Read a notebook", "Write": "Write a file", "Edit": "Edit a file",
    "MultiEdit": "Edit a file", "NotebookEdit": "Edit a notebook", "Bash": "Run a command",
    "PowerShell": "Run a PowerShell command", "WebSearch": "Search the web", "WebFetch": "Open a web page",
    "TodoWrite": "Update its to-do list",
}

# Commands that always need your Yes, even when "Run programs" is on auto.
_DANGER = [
    (r"\brm\s|\bunlink\b|\bshred\b", "deletes files"),
    (r"\brmdir\b|\brd\s+/s\b|\bdel\s|\berase\b|rmtree|os\.remove", "deletes files"),
    (r"Remove-Item\b", "deletes files"),
    (r"\bformat(\.com)?\s+[a-zA-Z]:", "formats a drive"),
    (r"\b(diskpart|mkfs|dd\s+if=|fdisk|bcdedit|vssadmin|cipher\s+/w)\b", "touches disks or system storage"),
    (r"\b(shutdown|restart-computer|stop-computer|reboot|poweroff|logoff)\b", "shuts down or restarts the PC"),
    (r"\breg(\.exe)?\s+(add|delete|import)\b|Set-ItemProperty\s+.*HK(LM|CU)|New-ItemProperty\s+.*HK(LM|CU)",
     "changes the Windows registry"),
    (r"\b(sudo|runas|Start-Process\b.*-Verb\s+RunAs)\b", "asks for admin rights"),
    (r"\b(curl|wget|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^|]*\|\s*(sh|bash|iex|Invoke-Expression|python)",
     "downloads and runs code straight from the internet"),
    (r"\b(git\s+push|npm\s+publish|twine\s+upload|gh\s+release)\b", "sends things off your PC"),
    (r"\b(schtasks|New-ScheduledTask|Register-ScheduledTask|crontab)\b", "creates a scheduled job"),
    (r"\b(netsh|Set-NetFirewall|New-NetFirewallRule|Disable-NetAdapter)\b", "changes network settings"),
    (r"\b(Set-ExecutionPolicy|Set-MpPreference|Add-MpPreference)\b", "changes Windows security settings"),
    (r"\b(taskkill|Stop-Process|pkill|killall)\b", "closes other programs"),
    (r"\bchmod\s+(-R\s+)?[0-7]*7[0-7]*\s+/|\bchown\s+-R\b", "changes permissions on many files"),
    (r">\s*/dev/sd|>\s*\\\\\.\\PhysicalDrive", "writes straight to a disk"),
    (r"\b(pip|npm|winget|choco|scoop|apt(-get)?)\s+(install|i|add)\b", "installs software"),
]
_DANGER_RE = [(re.compile(p, re.IGNORECASE), why) for p, why in _DANGER]


@dataclass
class Verdict:
    risk: Risk
    title: str
    force_ask: bool = False        # ask even if the policy for this risk is "auto"
    why: str = ""                  # shown on the Yes/No card
    path: Path | None = None       # the file it touches (file tools)
    inside: bool = True            # path inside the workspace?
    needs_network: bool = False


def is_builtin(name: str) -> bool:
    return name in READ_TOOLS or name in EDIT_TOOLS or name in RUN_TOOLS or name in WEB_TOOLS \
        or name in INTERNAL_TOOLS


def _inside(root: Path, p: Path) -> bool:
    try:
        real_root = root.resolve()
        real = p.resolve()
    except (OSError, RuntimeError):
        return False
    return real == real_root or real_root in real.parents


def target_path(name: str, inp: dict, root: Path) -> Path | None:
    raw = inp.get("file_path") or inp.get("notebook_path") or inp.get("path")
    if raw is None:
        return Path(root) if name in ("Glob", "Grep", "LS") else None
    if not isinstance(raw, str) or not raw.strip():
        return Path(root)
    s = os.path.expandvars(os.path.expanduser(raw.strip()))
    p = Path(s)
    if not p.is_absolute():
        p = Path(root) / p
    return p


def danger(command: str) -> list[str]:
    found = []
    for rx, why in _DANGER_RE:
        if rx.search(command or "") and why not in found:
            found.append(why)
    return found


def classify(name: str, inp: dict, root: Path) -> Verdict | None:
    """Risk verdict for one Claude Code tool call, or None if OVERDRIVE doesn't allow that tool."""
    root = Path(root)
    title = TITLES.get(name, name)
    if name in INTERNAL_TOOLS:
        return Verdict(Risk.INTERNAL, title)
    if name in WEB_TOOLS:
        return Verdict(Risk.WEB, title, needs_network=True)
    if name in RUN_TOOLS:
        cmd = str(inp.get("command", ""))
        bad = danger(cmd)
        if bad:
            return Verdict(Risk.RUN, title, force_ask=True,
                           why="This command " + " and ".join(bad) + ", so OVERDRIVE always asks first.")
        return Verdict(Risk.RUN, title)
    if name in READ_TOOLS or name in EDIT_TOOLS:
        p = target_path(name, inp, root)
        if p is None:
            return Verdict(Risk.DESTRUCTIVE if name in EDIT_TOOLS else Risk.READ, title, force_ask=True,
                           why="No file path was given.")
        inside = _inside(root, p)
        if name in READ_TOOLS:
            if inside:
                return Verdict(Risk.READ, title, path=p, inside=True)
            return Verdict(Risk.READ, title, force_ask=True, path=p, inside=False,
                           why="This is outside the OVERDRIVE workspace folder, so OVERDRIVE asks first.")
        if not inside:
            return Verdict(Risk.DESTRUCTIVE, title, force_ask=True, path=p, inside=False,
                           why="This changes a file OUTSIDE the OVERDRIVE workspace (no Undo there).")
        if p.exists() and not p.is_file():
            return Verdict(Risk.DESTRUCTIVE, title, force_ask=True, path=p, why="That path is a folder, not a file.")
        # Inside the workspace every change is versioned first, so Undo can put it back.
        return Verdict(Risk.WRITE, title, path=p, inside=True)
    return None


def preview(name: str, inp: dict, v: Verdict, root: Path) -> dict:
    """What the Yes/No card shows."""
    out: dict[str, Any] = {}
    if v.path is not None:
        try:
            out["path"] = Path(v.path).resolve().relative_to(Path(root).resolve()).as_posix()
        except ValueError:
            out["path"] = str(v.path)
    if name in RUN_TOOLS:
        out["command"] = str(inp.get("command", ""))[:2000]
        if inp.get("description"):
            out["what"] = str(inp["description"])[:300]
    elif name == "Write":
        text = str(inp.get("content", ""))
        lines = text.splitlines()
        out["lines"] = len(lines)
        out["preview"] = "\n".join(lines[:40]) + (f"\n... ({len(lines) - 40} more lines)" if len(lines) > 40 else "")
    elif name in ("Edit", "MultiEdit"):
        edits = inp.get("edits") if name == "MultiEdit" else [inp]
        shown = []
        for e in (edits or [])[:5]:
            if isinstance(e, dict):
                shown.append({"old": str(e.get("old_string", ""))[:600], "new": str(e.get("new_string", ""))[:600]})
        out["edits"] = shown
    elif name == "WebFetch":
        out["url"] = str(inp.get("url", ""))[:500]
    elif name == "WebSearch":
        out["query"] = str(inp.get("query", ""))[:300]
    if v.inside and v.risk == Risk.WRITE:
        out["reversible"] = "Yes: the old version is saved first, and Undo puts it back."
    if v.why:
        out["why"] = v.why
    return out
