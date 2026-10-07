# Game System 2.0

Your games and apps, one system. Drop in games, play them, and they continue exactly where you left off, even after your PC turns off. Apps (music, notes, websites…) open in windows next to it all.

## Put it on your website (Netlify)

1. Get the `game-system-2` folder onto your PC (download it from GitHub, or use the zip Claude sent you and right-click → **Extract All**).
2. Go to **app.netlify.com** and click your site (`gamesystem2`).
3. Open the **Deploys** tab.
4. Drag the **`game-system-2` folder** (the folder itself, not a zip) into the box that says "drag and drop your site output folder here".
5. Wait about 30 seconds, then open your site.

Netlify keeps your old versions in **Deploys**, so you can always click an old one and publish it again if you need to go back.

**Getting updates:** after you put a new version on Netlify, Game System notices by itself the next time you open it and shows **Update ready → Reload now** (the bell has it too). Want to check right away? **Settings → App → Check for updates**. Your games, saves and settings stay; only Game System itself updates.

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

## A game starts at its title screen instead of where I was

That game doesn't use the Save Kit. It may remember your progress, but it can't remember which screen you were on, so it always opens at its own title screen. Game System can't change that from the outside, but an AI can fix the game's code:

1. Open the game's details (the **...** button) and press **Make it continue where I left off**. While playing, the quick menu also has a **Fix this** button.
2. Press **Copy the message**. It holds the instructions and your game's code.
3. Paste it into ChatGPT, Claude or any AI chat.
4. Copy all the code the AI sends back, press **Paste the new code**, paste it, and press **Save upgrade**.

Your saves stay. If the new code breaks something, open the upgrade window again and press **Undo last upgrade**.

To always skip the "Continue?" popup: **Settings → Start-up & resume → When I come back to a game → Jump right in**, or tick the box on the popup.

## Make it look how you want

- **Three looks on every screen** (Home, Library, Apps): small icons, big cards, or a list. Use the buttons at the top, and the slider to make things bigger or smaller. Each screen remembers its own look.
- **Move things around:** on PC, just drag a game to a new spot. On a phone, hold your finger on it, then drag. Hold and let go without moving = options.
- **Folders like a phone:** drop a game right on top of another one (wait for the green glow) to make a folder. Click a folder to open it right where it is. Drag things out to take them out. Folders can hold games and apps, and can have their own picture.
- **Keyboard / controller:** open a game's options (right-click, hold, or the X button) → **Move**, then use the arrows or d-pad. Enter / A when done.
- **Library** has every game AND app, in your own order. **Home** shows what you played last.
- **Home layouts** (Settings → Home & Library): **Console** (big showcase + rows you can drag into any order), **All games**, or **List + details**.

### Themes

**Settings → Look → Theme** changes everything: colors and glow, the moving background, the letters, the menu sounds and the title screen.

- **Neon synthwave**: retro sun and grid
- **Hacker**: falling green code, terminal letters, 8-bit blips
- **Lava**: embers flying up from a glowing bottom, deep warm sounds
- **Ice**: snow and a soft aurora, frosty glass, bell sounds
- **Gold, Galaxy, Prism**: bonus themes you unlock by leveling up (see Trophies below)
- **Make your own**: describe it ("purple galaxy with pink stars") or pick a picture. The free AI can help (what you type is sent to Pollinations); with it off, Game System makes it right on your device.

**Settings → Sound → Menu music** plays chill music that matches your theme. It stops while you play a game or use the Music app. **Colors follow the game** tints the menu with the selected game's colors.

### Continue or start over

Every game says what it does: **Continues where you left off** (it saves, with "Saved 2 min ago") or **Starts at its title screen**. Games with a save show **CONTINUE** and a small **New game** button. Games that can't continue show **Make it continue** (see below).

### Simple or Pro

The first time you open Game System it asks **Simple or Pro**. Simple hides the code editor, the error console, raw save data and advanced settings. Switch anytime in **Settings → Simple or Pro**.

### Settings and the bell

Settings has sections on the left and a search box. The **bell** at the top shows reminders (like "time for a backup") and news (like new games from your website).

## Trophies and your level

Game System gives you **trophies** for stuff you do: playing, collecting games, making folders, trying themes, and some **secret** ones (no spoilers). Each trophy gives points, and points level you up.

- A popup with a sound shows up when you unlock one. While you're in a game it's a small one in the corner so it doesn't get in the way.
- **Stats** has the **trophy room**: every trophy, how close you are (like "3 / 10"), and filters for Unlocked, Locked and Secret.
- Home has a **Trophies** row with your level and the trophies you're closest to.
- Levels unlock rewards: badge frames for your picture (bronze, silver, gold, diamond) and bonus themes: **Gold** (level 5), **Galaxy** (level 8) and **Prism** (level 12, rainbow everything). Check **Level rewards** to see them all.
- The first time, trophies you already earned (games you already have, time you already played) unlock quietly with one popup.
- Your trophies and picture are in your backups.

### Your profile

Click your name at the top right:

- **Your name** (what Game System calls you)
- **Profile picture**: upload one, make one with the **AI avatar** maker (describe it and pick a style; 18+ stuff is blocked and the free AI's safe filter is on), or **Draw one** in the Drawing app and hit **Use as picture** → **My profile picture**
- Your level, points, the next reward, and a button to the trophy room

## Screenshots and recording

Set it up in **Settings → Screenshots & recording**:

- **Pick your own keys** for screenshots and recording (like F8 and F9). They work everywhere, in games too.
- Or use the buttons in the in-game quick menu (**Take a screenshot**, **Record video**), the **floating camera button** (tap = screenshot, hold = record; shows on phones by default), or a controller's **View/Select** button (tap = screenshot, hold = record).
- Screenshots flash, make a camera sound, and show a little picture in the corner. Click it to open the Gallery, or hit **Use as cover** to make it the game's picture.
- While recording, a red **REC** timer shows at the top. Press your key again (or the stop button) to stop. Quitting the game stops it too.
- **Sound**: the game's sound, the game + your mic, or no sound. **Hear yourself** lets you hear your mic while recording (use headphones).
- **Quality** (Low / Medium / High / Ultra) and **Max length** are settings. Settings shows about how many MB a minute takes.
- Everything goes to the **Gallery** app, and also to your Downloads folder (you can turn that off). The Gallery is in your backups.

Games that draw on a canvas are recorded straight from the game (no popup). For the menus and games without a canvas, the browser asks what to share: pick **This tab** (turn on "Share tab audio" for sound). Phones can only screenshot and record canvas games.

## Apps

The **Apps** tab is like a phone home screen. Apps open in a **window** instead of full screen, so you can use a few at once:

- Drag a window by its top bar, resize it from the bottom-right corner, double-click the top bar to make it full size.
- The **–** button minimizes it to the taskbar at the bottom. Minimized apps keep running (music keeps playing, even while you play a game).
- Windows that were open come back after your PC restarts, and apps that use the Save Kit come back to the same spot.
- On a phone, apps fill the screen. The phone's **Back** button minimizes them.

Built-in apps:

| App | What it does |
|---|---|
| **Music** | Add your own songs (mp3, m4a, wav, ogg, flac…). Shuffle, repeat, a visualizer, keyboard controls. Songs are saved in this browser. |
| **Notes** | Notes that save while you type. Search, pin, download as .txt. |
| **Calculator** | Science buttons, history, keyboard typing. |
| **Drawing** | Brush, highlighter, shapes, fill bucket, undo. **Use as picture** turns your drawing into a game's picture, and the gallery button saves it to the Gallery. |
| **Gallery** | Your screenshots, recordings, drawings and photos, newest first (like a phone's camera roll). Filter by kind or game, look at them big, download, rename, delete several at once, or use one as a game's picture. |
| **Video** | Watch your recordings, your own video files (saved in this browser) and YouTube links. Remembers where you stopped in each video. The **mini player** button floats the video over your games. |
| **Timer** | Timers (with names, like "Pizza"), a stopwatch with laps, and alarms (once, school days, weekends, any days). When one goes off it pops up over everything, games too, with a sound. **+1 min** / **Snooze**, or **OK** (Esc and controller B work too). Timers keep counting when the app is closed, and the stopwatch keeps running. |
| **Code** | Write HTML, CSS and JavaScript and see it live next to your code. Errors show in the console with the line (click it to jump there). **Examples** has lessons and small games (Snake, Catch the stars, Quiz…). **Save as…** turns your project into a real game or app in Game System, and **Update it** puts your new code into the same game later. **Ask AI** copies your code with your question for any AI chat. |

Deleted a built-in app? The Apps tab has a **Bring them back** button.

Adding your own apps:

- **Add app** on the Apps tab works like adding games (files, folders, zips, pasted code).
- **Add a website** puts any website in your apps. Big sites like YouTube, Google or Discord refuse to show up inside other sites, so those open in their own popup window (you can change this in the app's options).
- When you import, every item has a **Game / App** switch. Importing your old folder sorts things automatically (anything in an "Apps" or "Tools" section of your old menu becomes an app).
- Any game can become an app (and back): right-click it → **Move to Apps** / **Move to Games**.

## Game pictures

Tap a game's big picture on Home (or **Change picture** in its options) to open the picture maker:

- **AI picture:** describe it and pick a style (Game cover art, Pixel art, 3D cartoon, Realistic). Uses the free Pollinations picture AI: no account, about one picture every 15 seconds. 18+ pictures are blocked. What you type is sent to their website.
- **Neon letters**, **Icon** and **Pattern:** drawn right on your device, pick a color.
- **My picture:** any picture from your PC or phone.
- **Emoji:** if you want one.

While playing, the quick menu also has **Use screenshot as cover**.

## On a phone

- The tabs are at the bottom of the screen.
- While playing, the small button at the top opens the quick menu. The phone's **Back** button opens it too, and pressing Back again goes back to Game System.
- Hold your finger on a game for its options.
- On iPhone, use **Share → Add to Home Screen**. Otherwise Safari can delete saved games you haven't opened in about a week.
- Games made only for keyboard and mouse won't have touch controls. The **Rules for AI games** ask the AI to add them.

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
- Controller **Start** jumps between open app windows.
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
GameSystem.offerPicture(canvas.toDataURL());       // let the player use a picture as a game's picture
```

The function you give `autoSave` gets a reason: `'auto'` (the timer, every few seconds) or `'exit'` / `'flush'` / `'manual'` (closing or saving now). Heavy apps can return a slightly older state for `'auto'` and an exact one for the others.

For games that should also work outside Game System, paste `kit/save-kit.js` at the top of the game's script.

Each game also gets its own private `localStorage`, `sessionStorage` and IndexedDB, so games can't overwrite each other's saves.

## Files

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/` | The app |
| `sw.js` | Service worker: serves games from the browser at `play/<game>/`, keeps the app working offline |
| `kit/gs2-kit.js` | Added to every game automatically (Save Kit, private saves, error reporting) |
| `kit/save-kit.js` | Copy-paste Save Kit for AI-made games |
| `games/games.json` | Games and apps that come with the website (made by **Build website folder**) |
| `games/gs2-*/` | The built-in apps (Music, Notes, Calculator, Drawing, Gallery, Video, Timer, Code) |
| `vendor/` | CodeMirror (code editor) and Acorn (syntax checker), MIT licensed |
| `fonts/` | Orbitron and Chakra Petch, SIL Open Font License |

Opening `index.html` straight from your PC works for single-file games, but the full system (multi-file games, offline mode) needs it on a website like Netlify.
