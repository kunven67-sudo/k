# OVERDRIVE setup and dependencies

## On your PC (Windows 10 1809+ or 11, 64-bit)

1. Unzip `OVERDRIVE-windows.zip` anywhere (for example your Desktop) and open **OVERDRIVE.exe**.
2. The Setup screen checks two things and fixes them with one button each:
   - **Claude Code** (Anthropic's official app, free). Install button = `winget install --id Anthropic.ClaudeCode -e`.
     Backup button = Anthropic's PowerShell installer `irm https://claude.ai/install.ps1 | iex`.
   - **Sign in** with your claude.ai account (Pro/Max plan). A browser page opens; click Allow.
3. Done. OVERDRIVE runs on your claude.ai plan's usage. No API key, no extra money.

Your stuff lives in `C:\Users\<you>\OVERDRIVE\` (workspace, versions, logs, data). Deleting the app folder never deletes it.

## What OVERDRIVE uses (all free)

| Part | What it is | License |
|---|---|---|
| Python 3.13 (embedded, inside the zip) | runs OVERDRIVE | PSF |
| claude-agent-sdk | Anthropic's official library to drive Claude Code | MIT |
| Claude Code | the brain link (installed on your PC, signed in with claude.ai) | Anthropic terms |
| mcp, anyio, jsonschema, starlette, uvicorn (+ their dependencies) | tool connection, input checks, the local window server | MIT / BSD |
| Microsoft Edge (already on Windows) | shows the window in app mode | - |
| OVERDRIVE.exe | tiny launcher written in Go; starts Python with no console window | MIT |

Exact versions: `requirements.txt`. The bundled Claude Code copy inside claude-agent-sdk is removed from the zip
(saves ~300 MB); OVERDRIVE uses the Claude Code you install, which keeps itself updated.

## For developers

```
pip install -r requirements.txt
python -m overdrive              # window
python -m overdrive selftest     # all self-tests (end-to-end ones need Claude Code installed)
pytest                           # same tests through pytest
python build/build_windows.py    # portable Windows zip (needs Go for the launcher)
```

Environment variables: `OVERDRIVE_HOME` (data folder), `OVERDRIVE_NO_WINDOW=1` (server only),
`OVERDRIVE_PORT` (fixed port), `OVERDRIVE_TEST_CLI` (Claude Code path for tests).
