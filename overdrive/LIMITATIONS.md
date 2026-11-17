# Known limitations (Piece 3: the rest)

Honest list. Built so far: the core engine, the safety system, long-term memory, **Piece 1** (the brain is
Claude Code's own tools, behind OVERDRIVE's gate), **Piece 2** (ChatGPT mode) and **Piece 3** (everything
below). Coming next: Piece 4 (looks: moving backgrounds, anime-style backgrounds, animations).

## Piece 3: what it can do now
- **Memory**: one memory. Import your old notes once (folder or .zip, or a memory-pack.zip next to OVERDRIVE is
  read on first start), sorted into Rules / Projects / About me / People / Experiences. Normal things save by
  themselves and show "Saved to memory" with Undo; personal things and new rules always ask first. Memory page:
  search, pin (pinned = always in its mind), edit (old text kept), archive, delete.
- **Voice**: mic button (Ctrl+Space) types what you say; voice mode (Ctrl+Shift+Space) talks back out loud with
  Edge's voices, in Chat and Build mode; Ctrl+M mutes; no wake word. Its voice follows its mood a little.
- **Talk while it works**: messages you type or say while it's busy wait and go in right after the step.
- **By the way box** (Ctrl+B): a quick side question answered right away on the side by a separate quick Claude
  run; the main job never stops, slows or sees it.
- **While you're away**: zero-usage bug hunt of your projects + learning capped at 5% or 10% of your 5-hour
  limit a day (your pick). "While you were away" report when you're back. Your messages always go first.
- **Projects**: Done switch (skipped by the bug hunt), Versions (time machine: every version kept, open an old
  copy next to the new one, or go back).
- **Schedule**: jobs at a day/time, every day/week, or "when my 5-hour usage resets"; it can suggest one (asks).
- **Accounts**: several claude.ai accounts, one click to switch (never by itself); chats carry over.
- **Internet light** + a "SIGNAL LOST" banner that stays until you close it.
- **Chats**: smart short names, newest on top, Done folder, the real Edit (rewinds the chat; Claude forgets the
  old branch), drop/paste/attach pictures (Claude really looks at them), Quick read line, "Do this one" buttons on
  its ideas, drafts survive crashes, import your claude.ai chats (export zip: real dates, folder per account,
  "First chat ever").
- **Power-cut proof**: "I was in the middle of X" + Keep going (by itself after 25 s if you want).
- **Builds**: real CC0 assets (textures, models, skies, sounds), game eyes + hands (Windows), no-lag rule for your
  PC, Blender when installed, rules check before handing over, usage guess + "Schedule it for later", Live view.
- **Feelings, wants, its own upgrades** (Mind panel), and **it changes itself** (copy, its own tests, your Yes,
  restart, automatic go-back if the new version won't start).
- **Looks**: black or white, font, text size, accent color. First-start tour.

## Piece 3: limits (honest)
- Voice uses Edge's speech typing and Edge's voices. The "Natural" voices and speech typing need the internet;
  the offline voices sound more robotic. Edge asks for the microphone once.
- Away detection, game eyes, the PC check and Start with Windows only work on Windows. Some games read keys in a
  way window messages can't reach (raw input): then game eyes can look but not play. Web games: open them and use
  the window title; keys may not reach the page. The "live view" is steps + screenshots, not a full video of a
  hidden desktop yet.
- The learning cap is measured with Claude Code's 5-hour meter when it reports it; when it doesn't, each learning
  run counts as 2.5% (on the safe side). Learning reads web pages, it doesn't watch videos.
- The bug hunt only looks (syntax, broken files, missing files, logs, crashes, giant pictures); it can't find
  gameplay bugs by itself. Game eyes in Build mode can.
- Accounts: each needs its own sign-in once. If a chat's saved history can't be copied to the other account, that
  chat starts fresh (it tells you).
- Imported claude.ai chats are history to read and search; Claude can't continue inside the old claude.ai chat
  itself, so "Keep going" starts a new chat with the end of the old one.
- Feelings are OVERDRIVE's own moods built from what happened. Nobody can prove an AI truly feels. Upgrades change
  its instructions and settings, not the Claude model's brain.
- Changing itself runs its offline self-tests on the copy; the ones that need Claude Code are skipped there.
- The schedule, away mode and power-cut resume only run while OVERDRIVE is running (Keep running is on by
  default; turn on Start with Windows on the While away page).

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
  JPEG/PNG/GIF/WebP files are kept; SVG and anything else is refused. Clean-up: Settings > Chats > Chat pictures.
- Deleting a chat removes its messages and task records for good. Files it made stay in the workspace, and
  the audit log keeps a record that the chat existed (the log can never be edited).
- Talk-style switches reach an ongoing chat on your next message (OVERDRIVE adds a short note, because Claude
  Code keeps a chat's first instructions).
- Not built yet: editing pictures (AI pictures need the graphics card plan).

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
