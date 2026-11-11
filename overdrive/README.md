# OVERDRIVE (Stages 1 + 2: Core + Memory)

A personal AI agent for your Windows PC. **The brain is Claude**, reached through Claude Code (Anthropic's official
app) signed in with your claude.ai account: no API key, no extra money. Stage 1 is the engine + safety system that
every later part of OVERDRIVE plugs into; Stage 2 adds long-term memory on top.

## What Stage 1 does

| Part | What it does |
|---|---|
| Claude Code link | runs Claude Code in script mode, continues chats, records the exact model + Claude Code version per task |
| Tool system | every tool declares inputs (checked before running), risk class, internet use, status, limitations, self-test |
| Permission gates | read = auto, write = asks, change/replace/delete + send off PC + spend money = always ask (locked) |
| Audit log | append-only, hash-chained, secrets blanked; "Verify chain" finds any edit |
| Injection shield | file text reaches Claude boxed as data; order-like text is flagged to you |
| Task checker | plan first (checkable goals), report last (proof per goal), then checked against the journal + your files |
| Safe saving | atomic saves, never overwrites (old versions kept), Undo per task |
| Limits | steps/minutes/usage caps, pause at your Claude usage %, STOP button |
| Status page | the 5,000 blueprint points: green only when the area exists and its tests pass on your PC |
| Window | chat, Yes/No + question cards, status, logs, tools (work offline), settings, setup |

Tools in Stage 1: `get_time`, `calculator`, `list_folder`, `read_text_file`, `write_text_file` (+ `task_plan`,
`task_report`, and Claude asking you questions).

## What Stage 2 adds (Memory)

Five kinds of memory rows, every one with provenance: `fact`, `experience`, `instruction`, `project`, `relationship`.
Stored in SQLite with FTS5 full-text search under `OVERDRIVE\data\memory\memory.db`. Writes are gated and
non-destructive: `memory_update` supersedes the old row and keeps it as history. Backups write a sha256 per row + an
overall sha256; restore refuses a tampered backup. The boot digest (active instructions, open projects, people
OVERDRIVE knows) is added to the system prompt so the agent carries state between chats.

New tools in Stage 2: `memory_remember`, `memory_recall`, `memory_list`, `memory_update`, `memory_archive`.
Permanent delete (`forget`) is a human-only path via the UI — Claude's tools can archive but not delete.

## The blueprint, honestly

The 5,000-point blueprint is 100 rules x 50 areas (same 100 rules in every area). Stages 1 + 2 make **59 rules real**
(each proven by a self-test), **11 are guided** (Claude is told + the checker looks; never counted), **30 wait** for
later stages. The core runs 10 areas (Reasoning basics, Security, Reliability, Resource limits, Transparency, plus
Long-term / Episodic / Semantic / Procedural memory and Memory maintenance), so the honest count is
**590 / 5,000** points, shown live on the Status page.

Build order (from the blueprint): 1 Core -> 2 Memory (**done**) -> 3 PC control + sandbox -> 4 Planning -> 5 Research
-> 6 Agent teams -> 7 Images/audio/video -> 8 Curiosity + schedules -> 9 Personality -> 10 Benchmarks.

## Run it

- Windows: unzip `OVERDRIVE-windows.zip`, open `OVERDRIVE.exe`, follow Setup. See [SETUP.md](SETUP.md).
- Dev: `pip install -r requirements.txt`, then `python -m overdrive` (window) or `python -m overdrive selftest`.

Tests: 69 self-tests (`overdrive/selftests/`), including end-to-end runs of the real Claude Code against a fake
Claude on 127.0.0.1 ($0). The same tests run from the Status page on your PC. `node build/ui_check.cjs` clicks
through the whole window in a real browser.

## Layout

```
overdrive/            the app (agent.py = engine, brain.py = Claude Code link, server.py + ui/ = window)
overdrive/selftests/  self-tests (each names the blueprint rules it proves)
overdrive/data/       blueprint.json (100 rules x 50 areas)
build/                Windows build (embeddable Python + Go launcher), demo server, UI check
```

Limits and known issues: [LIMITATIONS.md](LIMITATIONS.md). OVERDRIVE is for personal use on your own PC.
