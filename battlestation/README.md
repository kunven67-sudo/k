# BATTLESTATION

A first-person game about your own setup. You wake up in a stream room, walk to your desk and sit
down. From then on your real mouse IS the in-game mouse and your real keyboard IS the in-game
keyboard: every key you press is pressed by the matching finger on the in-game hands.

Everything is in one file: `dist/battlestation.html` (built, not committed). Open it in Chrome or Edge.

## What's in it
- Stream room: L-desk, two monitors, RGB keyboard with real key travel, mouse, glass PC tower,
  mic arm, ring light, foam, LED strip, gaming chair, bed, nightstand with a real-time clock,
  wardrobe, couch, 55" TV + console, ceiling fan with pull chains, plants, art.
- The in-game PC boots for real (logo, loading, lock screen, sign in) and has a desktop, taskbar,
  Start menu, browser with sites, a game library, three playable games, Notepad, Terminal,
  Task Manager, Settings, Explorer and Paint.
- The internet box: unplug its power or the cable and the internet dies; plug it back in and it
  takes about a minute to come back, like a real one. It also follows your real internet.
- Swap the graphics card / RAM from the box of spare parts (turn the PC off first, or it crashes).
- Scan your real PC: the in-game "Scan my real PC" app downloads a small scanner. Run it once and
  the in-game PC gets your real taskbar, desktop, Start menu, wallpaper, theme, Steam/Epic games
  and parts. The scanner only reads; it writes one file next to the game and sends nothing.
- The day outside and the light through the window follow your real clock.

## Controls
- WASD walk, Shift faster, Ctrl crouch, E / left click use (hold E for some things), F1 menu.
- At the PC: push the mouse past the top of the screen (or press Esc) for the bar above the
  screen: Back to PC / Look around / Stand up / Menu.

## Building
```
npm install
node tools/build.mjs          # dist/battlestation.html (everything inlined)
node tools/build.mjs --dev    # dist/dev.html + bundle.js (loads assets/ from disk)
node tools/flow.mjs           # plays through the main loop headless and reports errors
```

Assets: Poly Haven (CC0), MakeHuman / MPFB (CC0), OpenGameArt CC0 sound packs, three.js (MIT).
See CREDITS.md.
