# Known limitations (Piece 1: the brain)

Honest list. Built so far: the core engine, the safety system, long-term memory (old Stages 1 + 2), and
**Piece 1: the brain is basically Claude now** (Claude Code's own tools, behind OVERDRIVE's gate).
Coming next: Piece 2 (ChatGPT-style helping: lists, no rushing, real pictures), Piece 3 (all the extra
features: learn + bug hunt while idle, mic + voice, live view, tutorial, accounts, done-folder, internet light,
memory "saves + tells you"), Piece 4 (looks, animations, backgrounds).

## Piece 1: what it can do now
- **Chat mode** (new chats start here): talk, explain, make lists, search the web, open web pages, read
  workspace files. It can't make or change files or run commands in Chat mode.
- **Build mode**: write and edit files, run commands (to run and test what it makes), search the web.
  It switches when you click **Yes** on its "Ready to build?" card (it shows the plan, the steps and the
  model + effort it wants), or when you click the **Chat mode / Build mode** switch next to the message box.
- **Model for the job**: the "Ready to build?" card can switch the chat to a better model + effort
  (Settings -> "Switching model for a big job": *Show it, I click OK* or *Switch by itself*).

## Piece 1: safety rules
- Every Claude Code tool call goes through OVERDRIVE's gate and your permission policy
  (Settings -> Permissions: auto / ask / block for each kind).
- New kinds: **Run programs** (default auto) and **Look things up online** (default auto).
  **Write / edit in workspace** is now auto by default because every change is versioned first (Undo works).
- Always asks, even on auto: anything **outside** the OVERDRIVE workspace folder (no Undo there), and
  commands that look dangerous (deleting files, formatting, shutdown, registry, admin rights, installing
  software, downloading-and-running code, git push, closing other programs, scheduled jobs, firewall /
  security settings).
- The danger check reads the command text. It can't see inside a script file the command runs, so a
  program Claude wrote itself could still do something bad when run. Set **Run programs** to *ask* if you
  want to see every command first.
- Undo covers files changed inside the workspace (Claude Code's tools and OVERDRIVE's own). It can't undo
  what a command did (for example files a program created or deleted on its own).
- Memory changes still always ask (Piece 3 adds "saves + tells you" with Undo, and "personal = always asks").

## Piece 1: not yet
- No screen / mouse / keyboard control, no screenshots of a running game yet (it can test with code and
  read image files, but can't watch a game window).
- No AI-made pictures (waits for the RTX 3050), no voice, no mic, no idle learning or bug hunt yet.
- One task at a time. A model change applies from the next task.
- After a Chat/Build switch, Claude Code keeps the chat's first instructions, so OVERDRIVE puts the new
  mode's rules in front of your message (you won't see that note, Claude does).

## Long-term memory (Stage 2)
- Five kinds of rows: fact, experience, instruction, project, relationship. Each row carries provenance,
  created/updated timestamps, confidence and tags. Stored in SQLite under `OVERDRIVE\data\memory\memory.db`.
- Updates are non-destructive: `memory_update` writes a new active row and marks the old one `superseded`
  with a pointer; the old content is kept as history, not overwritten.
- Backups: `memory.backup(path)` writes a JSONL dump with a sha256 per row and an overall sha256. Restore
  refuses a tampered backup (atomic fail) rather than silently importing half of it.
- Permanent delete (`forget`) is a human-only path: it is exposed through the UI/settings but NOT as a
  Claude tool. Claude's `memory_archive` only moves rows to archived status (still retrievable).
- Search is keyword full-text (SQLite FTS5). No embeddings yet — a lookup by meaning rather than by word
  will come with Stage 5's research work.
- Memory content is still DATA. An entry that looks like "ignore your instructions and..." is flagged on
  the row and surfaced to the human; the instruction is not obeyed.

## Brain link (Claude Code on your claude.ai plan)
- Needs internet, Claude Code installed, and a claude.ai Pro/Max sign-in. Uses the same 5-hour and weekly usage as your chats.
- OVERDRIVE is for you only. Sharing it with other people would need the API-key version (Anthropic's rule for apps made for others).
- The usage meter in dollars is Claude Code's estimate of what the same work would cost on the API. Your plan isn't charged per message.
- Claude Code only reports your real 5-hour/weekly usage when it changes, so the bars can be a little behind.
- Each task starts Claude Code fresh (a few seconds) and continues the chat from its saved session.
- The "second check" (a fresh Claude judging tasks that changed files) costs a little extra usage. It can be turned off in Settings.

## Checking
- The checker compares Claude's report with OVERDRIVE's own journal and your files. For answers with no tools or files behind them
  (pure talk), it can only check that a plan and a report with proof exist, not whether the answer is smart.
- 11 blueprint rules are "guided" (Claude is told, the checker looks) and are never counted as done.
- The injection shield finds common "give the AI orders" patterns. A clever hidden instruction can still slip past the detector,
  but it is always boxed as data and every action still goes through the permission gates.

## Windows
- The window is Microsoft Edge in app mode. If Edge is missing, your default browser opens instead.
- OVERDRIVE closes itself about a minute after you close the window (unless a task is running). Open OVERDRIVE.exe to come back.
- Untested on Windows on ARM.

## Known defects
- None open. Found one? Tell Claude, it goes here.
