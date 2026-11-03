# THE MASK

A VR sandbox for Quest 3 (browser link): a cartoon clockmaker's room on a rainy night. Wear the mask, record
copies of yourself (your moves and your voice) that loop, spawn people and gadgets, and mess around.

Status: look preview (room, mask, gloves, copies). Gameplay comes next.

- `game/src/` game code (three.js): `room.js`, `mask.js`, `hands.js`, `copy.js`, `toon.js`
- `game/preview.html?shot=1..4` renders the preview pictures (serve this folder, open in a browser)
- Art: KayKit Furniture Bits, Halloween Bits, Character Pack Adventures by Kay Lousberg (CC0).
  The mask, gloves, clock, room shell, window and rain are made in code for this game.

Preview pictures: `npm i`, `npm run serve`, then
`node tools/shot.cjs "http://localhost:8765/game/preview.html?shot=1" shot1.png 1920 1080`
