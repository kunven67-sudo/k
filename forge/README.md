# Forge

Forge is a personal AI you chat with in your browser. It runs on Claude, and it can:

- **Chat** about anything, and remember every chat so you can come back to it.
- **Remember you between chats.** When it learns something lasting about you (your name, what you like to build, how you like it to talk), it saves it and shows a small "🧠 Remembered" note. You can see, add, and delete everything it remembers under **Brain → Memory**, or switch memory off.
- **Build real files**, like games, apps, and pages. It shows them running next to the chat in a live preview.
- **Read and edit your files.** Attach files with the clip button (or drag them in) and ask it to change or fix them. Big files, even several megabytes, get read in pieces.
- **Look at images** you attach.
- **Make pictures and videos.** It draws pictures, posters, logos and animations with code. Press 📸 next to the preview to save a PNG, or 🎬 to record a video (MP4 or WebM, with the game's sound). Press 🎬 again to stop and save. You can record yourself playing, too.
- **Run code to check its answers.** It has a JavaScript sandbox, like a mini computer. It runs code for math, data in your files, or testing a formula, then answers with the real result. A "⚙️ Ran code" note shows what it ran. The sandbox can't touch your chats or your key, and anything stuck stops after 15 seconds.
- **Fix its own bugs.** When the preview throws an error, press **Fix it**, or turn on auto-fix in Settings when you use an API key.
- **Playtest what it builds.** After every build (or when you press **Playtest**), it plays the game itself, like a tester:
  - **Eyes:** it takes exact screenshots of the real page (gradients, shadows, 3D and WebGL included). It can **zoom** in 3x on small text, and **watch** 4 frames in a row to catch motion and flicker. It also reads the frame rate (to catch lag), the text, the buttons, the console and the errors.
  - **Hands:** it clicks, presses and holds keys, drags, types, and does mouse-look.
  - **Code review first:** round 1 starts with it reading the code like a reviewer and fixing the bugs it can see before it plays.
  - **Probes:** it runs one-line JavaScript checks, like reading `window.__game` for the score.
  - **Test scripts:** it writes small test programs that run inside the game. For example, it can fast-forward 3 seconds and check that the score went up by 3, or that restart really resets everything. It gets back the result, anything the test logged, and any error.
  - It fixes the bugs it finds, reloads, and keeps testing: 8 rounds by default, up to 20 for a deep test (Settings → Playtesting). You can watch it play live, and **Stop** it at any time.
- **Take voice input.** Press the mic and talk. Where the browser's speech feature is blocked (like inside the Claude app), Forge switches to your device's own voice typing and tells you how: the 🎤 on your phone's keyboard, Fn twice on a Mac, or Windows + H.
- **Read answers out loud** with the speaker button on any reply.
- **Download what it made**, as one HTML file or a `.zip` of the whole project.

## Brain cards

Brain cards are knowledge the AI reads before every answer (open them with the brain button).

- The built-in **Studio brain** card was written from six reference games: ANT WORK 2, Portal Gun, TIME, Shrink Resizer, Eight Billion, and AItok. It covers how those games are organized, how they render, make sound, handle controls and saves, and stay fast, so new builds aim for that level.
- **Study a file:** give it any file and the AI writes a new card from it.
- **Write a card:** type your own.

**Settings → Instructions** is where you tell it how to talk to you. By default it's set to talk like a friend, use emojis, explain things simply, and hunt bugs hard. **Settings → Your AI's name** renames it.

## How to run it

**Free: inside Claude.** Open the published Forge link in the Claude app or on claude.ai. It runs on your Claude account, so there's no API key, nothing to set up, and no credits to buy. It counts toward your plan's normal message limits, like any chat with Claude, and every playtest round is one message. Pick **Max** brain power in Settings for Claude's smartest model. When you open Forge anywhere else, Settings shows an **Open Forge in Claude** button that takes you there.

**Paid: with an API key, on your own computer.** Download this `forge` folder, keep `vendor/` next to `index.html`, and open `index.html` in Chrome or Edge. Then:

1. Open **Settings** and choose **Anthropic API key**.
2. Paste a key from console.anthropic.com. It stays in your browser and is sent only to the Anthropic API.
3. The default is Claude Fable 5.1 at **max** effort, which is the smartest setting. Opus 5 and Sonnet 5 are cheaper and faster. API use is billed to your Anthropic account.
4. Optional: turn on **web search** in Settings so it can look things up when it needs fresh information. Each search costs extra, so it's off by default. Web search only works with an API key.

## Good to know

- Forge can't search the web inside the Claude app (only in paid API mode), and it has no real terminal: pages in the Claude app can't reach the internet or run programs outside the browser. The code sandbox covers math and data work.
- Big games are written in pieces: when a reply runs out of room, Forge continues the file up to 8 more times.
- Forge can't be smarter than the Claude model it runs on. Picking the strongest model and max effort, plus the brain cards, is how it gets its best results.
- Chats and memory are saved in your browser (IndexedDB, with a backup list in localStorage). If the browser clears only part of that storage, Forge rebuilds your chat list from what's left. Clearing all site data deletes them, so download anything you want to keep.
- Forge never saves passwords or API keys to memory, even when the AI tries to.
- The preview runs in a locked-down frame, so the games it builds can't touch your chats or your API key.
- `vendor/anthropic-sdk.js` is the official Anthropic TypeScript SDK (v0.128.0), bundled into one file so the page works without a build step. How to rebuild it is written at the top of that file.
