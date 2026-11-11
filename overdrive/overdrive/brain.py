"""The Claude Code link: OVERDRIVE's brain (rules 72, 77, 100).

OVERDRIVE starts Claude Code (Anthropic's official CLI) in its script mode,
signed in with your claude.ai account. No API key and no extra money: it
runs on your claude.ai plan's usage.

Safety setup for every run:
- all of Claude Code's own tools are OFF except asking you questions,
- only OVERDRIVE's tools exist, and every call goes through OVERDRIVE's gate,
- your personal Claude Code settings/hooks/plugins are NOT loaded,
- API-key variables are removed so a run can never bill an API account.
"""
from __future__ import annotations

import asyncio
import json
import os
import platform
import re
import shutil
import subprocess
from pathlib import Path

IS_WINDOWS = platform.system() == "Windows"
NO_WINDOW = 0x08000000 if IS_WINDOWS else 0          # CREATE_NO_WINDOW
NEW_CONSOLE = 0x00000010 if IS_WINDOWS else 0        # CREATE_NEW_CONSOLE

# Variables that would switch Claude Code away from your claude.ai plan.
API_BILLING_VARS = (
    "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL",
    "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY",
)

INSTALL_HELP = {
    "winget": "winget install --id Anthropic.ClaudeCode -e --accept-source-agreements --accept-package-agreements",
    "powershell": "irm https://claude.ai/install.ps1 | iex",
}


def clean_env_for_plan() -> list[str]:
    """Remove API-billing variables from OVERDRIVE's own environment (inherited by Claude Code).
    Returns the names that were removed (values are never logged)."""
    removed = []
    for k in API_BILLING_VARS:
        if k in os.environ:
            os.environ.pop(k, None)
            removed.append(k)
    return removed


def candidate_paths() -> list[Path]:
    home = Path.home()
    out: list[Path] = []
    if IS_WINDOWS:
        for name in ("claude.exe",):
            hit = shutil.which(name)
            if hit:
                out.append(Path(hit))
        out.append(home / ".local" / "bin" / "claude.exe")
        local = Path(os.environ.get("LOCALAPPDATA", home / "AppData" / "Local"))
        out.append(local / "Microsoft" / "WinGet" / "Links" / "claude.exe")
        pk = local / "Microsoft" / "WinGet" / "Packages"
        if pk.is_dir():
            for d in sorted(pk.glob("Anthropic.ClaudeCode*")):
                out.extend(sorted(d.rglob("claude.exe")))
    else:
        hit = shutil.which("claude")
        if hit:
            out.append(Path(hit))
        out += [home / ".local" / "bin" / "claude", Path("/usr/local/bin/claude"), home / ".claude" / "local" / "claude"]
    seen, uniq = set(), []
    for p in out:
        key = str(p).lower() if IS_WINDOWS else str(p)
        if key not in seen:
            seen.add(key)
            uniq.append(p)
    return uniq


def find_cli(custom: str = "") -> str | None:
    if custom:
        p = Path(custom).expanduser()
        return str(p) if p.is_file() else None
    for p in candidate_paths():
        try:
            if p.is_file() and (not IS_WINDOWS or p.suffix.lower() == ".exe"):
                return str(p)
        except OSError:
            continue
    return None


async def _run(cmd: list[str], timeout: float = 25.0) -> tuple[int, str, str]:
    def go() -> tuple[int, str, str]:
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                           timeout=timeout, creationflags=NO_WINDOW, stdin=subprocess.DEVNULL)
        return r.returncode, r.stdout, r.stderr
    return await asyncio.to_thread(go)


async def cli_version(cli: str) -> str | None:
    try:
        code, out, _ = await _run([cli, "--version"])
    except (OSError, subprocess.SubprocessError):
        return None
    m = re.search(r"(\d+\.\d+\.\d+)", out or "")
    return m.group(1) if code == 0 and m else None


async def auth_status(cli: str) -> dict:
    """{'loggedIn': bool, 'method': str, 'plan_ok': bool, 'note': str}"""
    try:
        code, out, err = await _run([cli, "auth", "status"])
    except (OSError, subprocess.SubprocessError) as e:
        return {"loggedIn": False, "method": "unknown", "plan_ok": False, "note": f"couldn't run Claude Code: {e}"}
    try:
        j = json.loads(out)
    except json.JSONDecodeError:
        return {"loggedIn": False, "method": "unknown", "plan_ok": False,
                "note": (out or err or "no answer").strip()[:300]}
    method = str(j.get("authMethod") or "none")
    logged = bool(j.get("loggedIn"))
    note = ""
    plan_ok = logged and method in ("claude.ai", "oauth_token")
    if j.get("apiKeySource"):
        note = "An API key is set on this PC. OVERDRIVE removes it for its runs so it stays on your claude.ai plan."
    if logged and not plan_ok:
        note = (f"Claude Code is signed in with '{method}', not a claude.ai plan. Runs could be billed "
                "to an API account. Sign in with your claude.ai account instead.")
    return {"loggedIn": logged, "method": method, "plan_ok": plan_ok, "note": note}


def open_console(cmd: list[str] | str, title: str = "OVERDRIVE setup") -> None:
    """Open a VISIBLE terminal window running cmd (install / sign in), so you can see what happens."""
    if IS_WINDOWS:
        if isinstance(cmd, str):
            args = ["powershell.exe", "-NoProfile", "-NoExit", "-Command", cmd]
        else:
            args = ["cmd.exe", "/k", *cmd]
        subprocess.Popen(args, creationflags=NEW_CONSOLE, close_fds=True)
    else:
        shell = cmd if isinstance(cmd, str) else " ".join(cmd)
        for term in ("x-terminal-emulator", "gnome-terminal", "konsole", "xterm"):
            if shutil.which(term):
                subprocess.Popen([term, "-e", "bash", "-lc", shell + "; exec bash"])
                return
        raise OSError("no terminal app found; run this yourself: " + shell)


def classify_error(text: str) -> str:
    t = (text or "").lower()
    if any(s in t for s in ("not logged in", "please run /login", "invalid api key", "authentication", "oauth", "401")):
        return "auth"
    if any(s in t for s in ("usage limit", "rate limit", "rate_limit", "429", "limit reached")):
        return "rate_limit"
    if any(s in t for s in ("billing", "credit balance")):
        return "billing"
    if any(s in t for s in ("model", "not available", "not_found_error", "404")) and "model" in t:
        return "model"
    if any(s in t for s in ("enotfound", "econnrefused", "network", "getaddrinfo", "timed out", "offline", "socket")):
        return "offline"
    return "error"


FRIENDLY = {
    "auth": "Claude Code isn't signed in to your claude.ai account. Open Setup and press Sign in.",
    "rate_limit": "Your Claude usage limit is reached for now. OVERDRIVE will work again when it resets.",
    "billing": "Claude says this account has a billing problem. Check your claude.ai plan.",
    "model": "That model isn't available on your plan. Pick another model in Settings.",
    "offline": "Can't reach Claude (internet down?). Local tools still work in the Tools tab.",
    "not_installed": "Claude Code isn't installed yet. Open Setup and press Install.",
    "error": "Claude Code stopped with an error.",
}
