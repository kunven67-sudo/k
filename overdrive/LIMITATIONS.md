# Known limitations (Stage 2)

Honest list. Stages 1 + 2 are shipped: the core engine, the safety system, and long-term memory.

## What it can't do yet
- No web browsing, no running programs, no screen/mouse/keyboard control, no images/audio/video.
- No planning engine yet beyond "plan first, report last" (Stage 4), no agent teams (Stage 6), no schedules (Stage 8).
- File tools: text files only, only inside `OVERDRIVE\workspace`, 5 MB read / 1,000,000 characters write.
- One task at a time.

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
