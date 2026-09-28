# Forge

Forge is a personal AI you chat with in your browser. It runs on Claude, and it can:

- **Chat** about anything, and remember every chat so you can come back to it.
- **Build real files**, like games, apps, and pages. It shows them running next to the chat in a live preview.
- **Read and edit your files.** Attach files with the clip button (or drag them in) and ask it to change or fix them. Big files, even several megabytes, get read in pieces.
- **Look at images** you attach.
- **Fix its own bugs.** When the preview throws an error, press **Fix it**, or turn on auto-fix in Settings when you use an API key.
- **Playtest what it builds.** After every build (or when you press **Playtest**), it plays the game itself, like a tester:
  - **Eyes:** it takes screenshots, including 3D and WebGL canvases, and reads the text, buttons, console output and errors on screen.
  - **Hands:** it clicks, presses and holds keys, drags, types, and does mouse-look.
  - **Probes:** it runs one-line JavaScript checks, like reading `window.__game` for the score.
  - It fixes the bugs it finds, reloads, and keeps testing for up to 5 rounds. You can watch it play live, and **Stop** it at any time.
- **Take voice input.** Press the mic and talk. This needs Chrome or Edge on a computer; the Claude app blocks the microphone.
- **Read answers out loud** with the speaker button on any reply.
- **Download what it made**, as one HTML file or a `.zip` of the whole project.

## Brain cards

Brain cards are knowledge the AI reads before every answer (open them with the brain button).

- The built-in **Studio brain** card was written from six reference games: ANT WORK 2, Portal Gun, TIME, Shrink Resizer, Eight Billion, and AItok. It covers how those games are organized, how they render, make sound, handle controls and saves, and stay fast, so new builds aim for that level.
- **Study a file:** give it any file and the AI writes a new card from it.
- **Write a card:** type your own.

**Settings → Instructions** is where you tell it how to talk to you. By default it's set to talk like a friend, use emojis, explain things simply, and hunt bugs hard. **Settings → Your AI's name** renames it.

## How to run it

**Inside Claude.** Open the published Forge link in the Claude app or on claude.ai. It uses your Claude plan, so there's nothing to set up. Pick **Max** brain power in Settings for Claude's smartest model.

**On your own computer.** Download this `forge` folder, keep `vendor/` next to `index.html`, and open `index.html` in Chrome or Edge. Then:

1. Open **Settings** and choose **Anthropic API key**.
2. Paste a key from console.anthropic.com. It stays in your browser and is sent only to the Anthropic API.
3. The default is Claude Fable 5.1 at **max** effort, which is the smartest setting. Opus 5 and Sonnet 5 are cheaper and faster. API use is billed to your Anthropic account.

## Good to know

- Forge can't be smarter than the Claude model it runs on. Picking the strongest model and max effort, plus the brain cards, is how it gets its best results.
- Chats are saved in your browser (IndexedDB). Clearing site data deletes them, so download anything you want to keep.
- The preview runs in a locked-down frame, so the games it builds can't touch your chats or your API key.
- `vendor/anthropic-sdk.js` is the official Anthropic TypeScript SDK (v0.128.0), bundled into one file so the page works without a build step. How to rebuild it is written at the top of that file.
