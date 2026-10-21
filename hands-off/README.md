# HANDS OFF

An idle game where the only rule is: **do nothing.** Literally nothing.

Your money grows on its own, faster and faster, upgrades buy themselves, and reality slowly
breaks around you. Touch the mouse, a key, the screen or a controller and everything resets to zero.

**Play:** open `dist/hands-off.html` in Chrome or Edge (one file, works offline except the fonts).

- Leaving is safe: press **X** (or tap the tiny X on a phone), close the tab, or walk away.
  The run keeps counting while it's closed.
- Every x1000 is a milestone (the money gets a new name), every 20 levels is a new world.
- Settings: graphics (Low / Auto / High / Insane), music + sound volume, big flashes on/off.

## Code

| file | what it does |
| --- | --- |
| `src/core.js` | endless numbers (stored as log10), economy, upgrades, saves, trophies |
| `src/gfx.js` | WebGL: the world (chrome blob, black hole, glitch cube, nebula) + the post pass that breaks it |
| `src/glyphs.js` | every icon, drawn in code (money, upgrades, trophies, cursor) |
| `src/audio.js` | all sound made live: hum -> phonk -> breakcore, drops, tape stop, glass |
| `src/main.js` | states, the hands-off guard, HUD, reset sequence, temptations, events, menus, tab lock |
| `src/style.css`, `src/body.html` | menus |

`python3 build.py` glues it into `dist/hands-off.html`.

Tests: `node test-core.js` (numbers/economy/saves), `node test-game.js` (headless Chromium: real
clicks, keys, touch, two tabs, offline, freezes), `node sim.js` (pacing table).
