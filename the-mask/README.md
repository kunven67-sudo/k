# THE MASK

A VR sandbox for Quest 3 (also plays on PC and phones): a cartoon clockmaker's room on a rainy night. Put on the mask
and time starts looping. Everything you do (your moves, your voice, your shots) becomes a copy of you that does it all
again. Spawn people and crazy gadgets and mess around with yourselves.

## Play
- `play/index.html` is the built game. Quest link: https://kunven67-sudo.github.io/k/the-mask/play/ (press **Play in VR**).
- `npm run build -- --onefile "THE MASK.html"` also makes one offline file (PC browser, Game System 3, phone).

## How it works
- **Auto loop** (default): the room loops every 15-90 s. When the clock goes round, time rewinds: a new copy of you
  appears, every older copy starts over with it, and (if *Rewind the room* is on) people and stuff go back to where
  they were. **Record button** mode: press to record, press again, that copy loops on its own.
- Copies: KayKit hooded body + your mask + your gloves, two-bone IK with stretchy arms to your exact hand spots,
  walk animations from your head speed, your voice from their mouth (3D sound), your shots fired again.
- People: Knight, Barbarian, Mage, Rogue. Walk around, bleed (no gore), fight back or run, get thrown, get back up.
- Gadgets: Blaster, Black Hole Gun, Time Stopper (freeze), Size Ray (giant / tiny), Float Ray, Copy Ray (clone).
- Menus use the Game System 3 kit (`game/gs3kit/`), the same menus float in VR. Trophies report to Game System 3.

## Code
`game/src/`: `main.js` (start + frame loop + quality), `loop.js` (recording, rewind), `copies.js`, `player.js`,
`people.js`, `props.js`, `gadgets.js`, `physics.js` (cannon-es), `room.js`, `mask.js`, `hands.js`, `ui.js`, `audio.js`
(all sounds made live), `voice.js` (mic), `blood.js`, `fx.js`, `input.js`.

Dev: `npm i`, serve this folder (`npm run serve`), open `/game/index.html`. Tests (real input): `tools/play.cjs`
(keyboard + mouse), `tools/vrtest.cjs` (Meta's Quest emulator IWER), `tools/phonetest.cjs` (touch).

Art: KayKit Furniture Bits, Halloween Bits, Character Pack Adventures by Kay Lousberg (CC0), see `tools/prep-assets.mjs`.
The mask, gloves, gadgets, clock, room shell, window and rain are made in code for this game.
