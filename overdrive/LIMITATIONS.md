# Known limitations (Piece 2: ChatGPT mode)

Honest list. Built so far: the core engine, the safety system, long-term memory (old Stages 1 + 2),
**Piece 1: the brain is basically Claude** (Claude Code's own tools, behind OVERDRIVE's gate) and
**Piece 2: ChatGPT mode** (lists, tables, real pictures, no rushing, copy pieces, chat rename/delete/search).
Coming next: Piece 3 (all the extra features: learn + bug hunt while idle, mic + voice, live view, tutorial,
accounts, done-folder, internet light, memory "saves + tells you", import your memory, schedules), Piece 4
(looks, animations, backgrounds).

## Piece 2: what it can do now
- **Talk like ChatGPT** (Settings, on by default): in Chat mode it answers with clear numbered lists, small
  tables, bold key words and headings, digs into your idea, gives options with its own pick, and never pushes
  "ready to build?". It only offers to build when you clearly say you want it made.
- **Pictures** (Settings: Real / Both / AI-made / Off): it shows real pictures of what it's talking about,
  right under its answer (2-6 per answer), with the title, who made it, the license and the source page.
  Click one to see it big (arrow keys = next, Esc = close, "Save picture" = download). It can also show a
  picture file from the workspace (for example a screenshot of a game it made).
- **Copy pieces**: every paragraph, list item, table and code block has a number + copy button. Or type
  `copy 1 and 2`, `copy 2-4`, `copy code`, `copy table`, `copy last` or `copy all` in the message box: it
  copies from the last answer and is never sent to Claude (no usage). "Copy" under every answer copies all of it.
- **Its own ideas** (Settings, on): after plans, option lists and builds it ends with "My ideas:".
- **Chats**: search box (finds chat names AND what was said in them), rename (pencil, or double-click the
  title), delete (bin). **Edit** under your message puts it back in the box to change and resend.
- **Settings search**: type "pictures", "copy", "usage"... and only those settings show.

## Piece 2: limits (honest)
- **AI-made pictures aren't built yet.** They need a picture model running on a real graphics card (the RTX
  3050 plan). Picking "AI-made only" makes OVERDRIVE say so instead of faking it; "Both" shows real ones for now.
- Real pictures come from **Openverse** and **Wikimedia Commons** (free, open licenses, no account). Great for
  real things (engines, animals, places, art styles); weak for brand-new products, memes, or exact screenshots
  of other games. Openverse has a daily limit for apps without an account; when it's hit (or a library is
  down), OVERDRIVE uses the other one. Some licenses ask for credit if you publish the picture: the credit is shown with it.
- Pictures are saved once in `OVERDRIVE\data\pictures` (so old chats still show them offline). Only real
  JPEG/PNG/GIF/WebP files are kept; SVG and anything else is refused. There's no auto-clean of that folder yet.
- Edit + resend sends a **new** message; it doesn't rewrite the old part of the chat like ChatGPT's branches
  (Claude Code can't fork a chat's history from inside OVERDRIVE yet).
- Deleting a chat removes its messages and task records for good. Files it made stay in the workspace, and
  the audit log keeps a record that the chat existed (the log can never be edited).
- Talk-style switches reach an ongoing chat on your next message (OVERDRIVE adds a short note, because Claude
  Code keeps a chat's first instructions).
- Not built yet: mic / voice, uploading your own pictures into the chat, picture editing, tutorial (Piece 3).

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
