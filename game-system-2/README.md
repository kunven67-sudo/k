# Game System 2.0

Your games, one system. Drop in games, play them, and they continue exactly where you left off, even after your PC turns off.

## Put it on your website (Netlify)

1. Get the `game-system-2` folder onto your PC (download it from GitHub, or use the zip Claude sent you and right-click → **Extract All**).
2. Go to **app.netlify.com** and click your site (`gamesystem2`).
3. Open the **Deploys** tab.
4. Drag the **`game-system-2` folder** (the folder itself, not a zip) into the box that says "drag and drop your site output folder here".
5. Wait about 30 seconds, then open your site.

Netlify keeps your old versions in **Deploys**, so you can always click an old one and publish it again if you need to go back.

## Move your old games over

Your old games are files in the old Netlify folder. To bring them in:

1. Open Game System 2.0 and click **Add** → **Import my old games**.
2. Pick the old folder you used to drag onto Netlify. If you lost it: Netlify → your site → **Deploys** → click your last deploy → download it, then unzip it.
3. Game System finds every game in there, names them, and grabs cover pictures. Check the list and click **Import**.

Your old folder is never changed or deleted.

## Put your games on the website (so they work on any computer)

Games you add are saved in your browser. To put them on the website too:

1. **Settings** → **Build website folder**.
2. Unzip the file it downloads (right-click → **Extract All**).
3. Drag that folder onto Netlify (same steps as above).

Every computer that opens your site now gets those games. Saves stay in each browser. Use a backup to move saves.

## Backups

**Settings** or **Saves** → **Back up everything** downloads one `.zip` with all your games, saves and stats. Keep it on Google Drive or a USB stick. To restore, use **Restore a backup** and pick that zip (no need to unzip it).

## Making games with AI

Click **Rules for AI games** (on Home or in Settings) and copy the rules into the AI chat **before** you describe your game. That makes the AI:

- put everything in one `.html` file, so nothing goes missing
- use the Save Kit, so the game continues where you left off
- send the whole file instead of "the rest stays the same"

When you paste AI code with **Add** → **Paste code**, Game System checks it:

- **Red lines** show syntax errors.
- **"The AI's code got cut off"** means the AI stopped halfway. Click **Copy "continue" message**, paste it to the AI, then use **Glue on more code** to add the rest. Repeated lines are removed automatically.
- **"The AI skipped some code"** means it wrote something like `// rest of the code stays the same`. Ask it for the full file.

## While playing

- **F2** (or move the mouse to the very top of the screen) opens the quick menu: resume, save now, fullscreen, screenshot as cover, errors, edit code, reload, start over, quit.
- A red badge in the corner means the game had an error. Click it to see what broke and **Copy errors for AI** to get a fix.
- Controller: the **Home/Guide** button opens the quick menu.

## Menus

- Arrow keys or a controller move around. **Enter** / **A** picks. **Esc** / **B** goes back.
- **/** searches your games. **[** and **]** switch tabs. Controller **LB**/**RB** switch tabs too.
- Right-click a game for more options.

## The Save Kit (for game makers)

Inside Game System every game gets `window.GameSystem`:

```js
const saved = GameSystem.load();          // your saved state, or null
if (saved) { /* put everything back */ }

GameSystem.autoSave(() => ({ /* everything needed to continue */ }));  // saved every few seconds and when closing
GameSystem.save(state);                   // save right now
GameSystem.clear();                       // delete the save (new game)
GameSystem.onPause(fn); GameSystem.onResume(fn);   // quick menu opened / closed
```

For games that should also work outside Game System, paste `kit/save-kit.js` at the top of the game's script.

Each game also gets its own private `localStorage`, `sessionStorage` and IndexedDB, so games can't overwrite each other's saves.

## Files

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/` | The app |
| `sw.js` | Service worker: serves games from the browser at `play/<game>/`, keeps the app working offline |
| `kit/gs2-kit.js` | Added to every game automatically (Save Kit, private saves, error reporting) |
| `kit/save-kit.js` | Copy-paste Save Kit for AI-made games |
| `games/games.json` | Games that come with the website (made by **Build website folder**) |
| `vendor/` | CodeMirror (code editor) and Acorn (syntax checker), MIT licensed |
| `fonts/` | Orbitron and Chakra Petch, SIL Open Font License |

Opening `index.html` straight from your PC works for single-file games, but the full system (multi-file games, offline mode) needs it on a website like Netlify.
