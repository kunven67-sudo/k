# Game System 3 console kit

Every new game made for the player uses this kit, so its menus look like the console picked in
Game System 3 (PS5, Xbox, Switch, PS4) and switch the moment another console is picked. Outside
Game System 3 (a browser, the phone) the menus use Game System 3's own look.

## Put it in a game
1. Copy this whole `kit` folder into the game as `gs3kit/` (it has its own fonts, ~170 KB).
2. In the game's `<head>`: `<script src="gs3kit/gs3-console.js"></script>` (it loads the CSS itself).
3. Build menus with the classes below. Try a look in a browser: `index.html?look=ps5` (`xbox`, `switch`, `ps4`).

## Pieces
- `.gs3-screen` full-screen dim layer that holds a menu (`hidden` to close it)
- `.gs3-panel` the box; `.gs3-title`, `.gs3-sub`
- `.gs3-menu` a list of `.gs3-item` lines (`<span class="gs3-value">` on the right for a value)
- `.gs3-toggle` on/off (`aria-pressed="true"`; flips itself when clicked), `.gs3-slider` (`<input type="range">`)
- `.gs3-row` of `.gs3-btn` (`.primary` for the main one). As the last thing in a panel: Switch puts them across the bottom, Xbox stacks them.
- `GS3Console.hints(el, [['ok','Select'], ['back','Back']])` draws that console's own buttons (✕ ○ / A B / Enter Esc).

## JS (window.GS3Console)
- `nav(root, { back, first, onMove })` arrow keys + controller (d-pad, stick, A/Cross = OK, B/Circle = back) move the highlight in `root`. Returns `{ focus(el), act(action), stop() }`. Open a new menu = `nav()` it; close it = `stop()`.
- `look()` 'ps5' | 'xbox' | 'switch' | 'ps4' | '' ; `name()`; `onChange(fn)`
- `theme()` colors + font of the look, for games that draw menus on a canvas
- `press(el)` the console's click squish (buttons/items do it by themselves)

`demo.html` = a full pause menu + "Quit?" question, use it as the starting point.
Game System 3 gives games `GameSystem.console` + `<html data-gs3-console>`; the kit reads those.

## Trophies (inside Game System 3)

Tell Game System 3 the game's trophies once when it starts, then unlock them when they happen. Platinum (all of
them) is added by itself, and the pop-up + sound look like the picked console (Xbox looks show them as achievements
with Gamerscore). Outside Game System 3 these calls do nothing.

```js
if (window.GameSystem && GameSystem.trophies) {
  GameSystem.trophies([
    { id: 'win1', name: 'First Win', desc: 'Win a round.', grade: 'bronze' },
    { id: 'boss', name: 'Boss Down', desc: 'Beat the boss.', grade: 'gold' },
    { id: 'secret', name: '???', desc: 'Find the secret room.', grade: 'silver', hidden: true }
  ]);
}
// later:
if (window.GameSystem && GameSystem.unlock) GameSystem.unlock('boss');
```
