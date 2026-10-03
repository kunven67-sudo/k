# 🤖 AI Play

Pick a game file, and an AI with feelings learns to play it.

**Easiest way:** download **`AI Play.html`** (in the main folder of this repo) and double-click it.
It opens in your browser (Chrome or Edge on Windows works best) and runs 100% offline.

## How to use
1. The first time, your first AI gets born. It picks its own name, look and personality (you can rename it).
2. Click **➕ Add game file** (one `.html` game) or **📂 Add game folder** (a game made of many files), or just drag it in.
3. Click the game. The AI looks at the screen, figures out the controls, and tries to get the best score.
   - It plays its **own copy** of the game with its **own save**, so your progress is never touched.
   - Games that load stuff from the internet get a copy saved, so they work offline later.

## Helping it (optional)
- Type tips in the chat: `space = jump`, `avoid red`, `get the yellow stuff`, `go right`, `don't press escape`.
- 👍 / 👎 buttons while it plays.
- **🎮 You play**: you play for a bit, it watches and copies you.
- **⌨️ Keys** tab: ⭐ keys that matter, 🚫 keys it shouldn't use.

## Its brain and feelings
- Nobody sets its feelings. They come from what happens in the game, run through the personality it was born with, and its personality slowly changes from experience.
- Its feelings change how it plays (mad = reckless, scared = careful, bored = tries random stuff, happy = shows off).
- It dreams between tries (replays memories to learn more), keeps a diary, and can watch a rival AI's best run.
- **Pain mode** (Settings, OFF by default): getting hit hurts. You get a pain meter, yelling, and it gets scared. It *acts* hurt; it's still code.

## 🧠 Gemini coach (optional, needs internet)
The baby brain still presses the keys. Gemini is its **coach**: it looks at the screen, makes plans, and talks smarter.
1. Get a free API key at **aistudio.google.com/apikey**.
2. Go to **⚙️ Settings → 🧠 Gemini coach**, paste the key, and click **💾 Save + test**. It picks the newest Flash model by itself.
3. Play a game. The coach:
   - reads the instructions first and writes game notes,
   - puts a 🎯 target on screen and a 📋 plan box, and teaches the baby brain keys,
   - understands normal sentences ("go to the door"), answers questions, and just talks (you can also hold 🎤 or the `` ` `` key to talk),
   - reads story text out loud (📖) and picks story choices on purpose,
   - looks at deaths to figure out what went wrong,
   - hunts trophies / achievements (a separate goal from winning),
   - writes a **📋 report card** when you stop (it's also saved in the diary).
- 🔒 The key is saved **only in this browser**. It's only ever sent to Google, and it's never in the code or on GitHub. Click **🗑️ Forget key** to delete it. (A game file you add could technically peek at it, so only add games you trust.)
- If the internet drops, or you hit the free limit, the baby brain just keeps playing alone.

## Good to know
- The free brain runs on your computer and starts like a baby. It gets good at simple 2D games (try the two practice games). Big 3D games are very hard for it.
- Everything is saved in your browser on that computer.

## For coders
Source is in `ai-play/` (`index.html`, `style.css`, `js/`). After changing it, rebuild the one-file version:
```
python3 ai-play/build-single-file.py
```
