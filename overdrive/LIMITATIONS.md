# Known limitations (Stage 1)

Honest list. Stage 1 is the core engine and safety system, not the full OVERDRIVE.

## What it can't do yet
- No web browsing, no running programs, no screen/mouse/keyboard control, no images/audio/video.
- No long-term memory: each chat remembers itself (through Claude Code's session), but nothing carries between chats.
- No planning engine yet beyond "plan first, report last" (Stage 4), no agent teams (Stage 6), no schedules (Stage 8).
- File tools: text files only, only inside `OVERDRIVE\workspace`, 5 MB read / 1,000,000 characters write.
- One task at a time.

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
