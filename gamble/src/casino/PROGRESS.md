# Casino lane A (floor, cage, NPCs, world integration) — PROGRESS

Owner: lane A. See CONTRACT.md for ownership. Lanes B (tables) / C (slots) own their dirs.

## Status
- [x] 1. layout.js + index.js `buildEldoradoInterior`, hooked into world/compose.js (after reno; zones,
      interactables, spawns merged; `player` passed from states/world.js), real entrance doors
      (interior/doors.js: Virginia ×3 pairs, 4th St ×2 pairs, chamfer ×2 pairs; drag / E / walk-into,
      closers, colliders follow the leaves). eldorado.js: `openDoors` now leaves the openings 'void'.
- [~] 2. Room: floor (carpet grid + marble, baked light pools), walls (wainscot, damask, cornice,
      pilasters, sconces, EXIT signs), coffered ceiling + lit coffers + eye domes, dome w/ fresco,
      columns, 12 crystal chandeliers, fountain (bronze figures baked from Humans, water shaders,
      spray, coins, coin toss) — DONE. Foyer podium/guard, bar, signage, restrooms, elevators,
      escalator, closed tables, car display — IN PROGRESS. Lighting tuning pass pending.
- [~] 3. Stations placed via factories (stubs today): 3 tables + 15 slot banks (110 machines). NPC
      players / staff pending (npcs.js).
- [ ] 4. cage.js: cashier dialog (buy chips / cash out / TITO), TITO kiosk, ATM, items.js canvases
- [~] 5. Ambience: interior/sounds.js (amb.casino bed scaled by NPCs, machine/table chatter,
      'casino-floor' music, 'casino.fountain' loop, door leak). Needs listening pass.
- [x] 6. dev/casino.html|js (?spawn=foyer|pit|cage|slots|fountain|bar|classic|fourth|entrance, ?quality=)
- [ ] perf numbers

## Decisions
- FLOOR_Y = 0.16 (1 cm carpet above the 0.15 sidewalk); dropped ceiling 4.2 m (CEIL_Y 4.36), coffers 4.8 m
  grid centred on the fountain (-46, 50); dome R 9.5 + saucer cap to y 7.05 (shell slab at 7.15).
- All interior statics in ONE StaticBatch chunk ('casino') → one draw call per material.
- Light pool (interior/lights.js) has the same size as the motel night pool per tier; compose.js swaps
  their visibility so the scene's light count never changes (no shader recompiles). Medium = 4.
- Inside: sky hemi → warm fill, sun off, interior PMREM env swapped in (same size as the sky's),
  sun shadow map stops updating deep inside; city children hidden when > 16 m from every door.
- Floor light is baked into vertex colours from a Spots list (downlights, chandeliers, machines,
  tables, dome) — the floor is baked LAST (C.addBaked) after every station registered its spot.
- Zone ambience: zones carry `ambience: 'self'`; sounds.js patches Ambience.prototype._target at
  runtime so the motel/street beds stay out (request below to make that native).

## How to view
- http://127.0.0.1:8765/gamble/dev/casino.html?spawn=foyer (pit, cage, slots, fountain, bar, classic, fourth, entrance)
- &quality=low|medium|high|ultra. Console: __casino, __casinoPerf(), __sim(sec,{keys,look}).
- Screenshot wrapper: scratchpad/casinoA/cs.sh name 'query' 'steps'.

## Known gaps / requests
- player lane: `surface.js` returns 'concrete' in the casino — please map venue 'eldorado' to 'carpet'
  (marble areas: foyer x>-21 z41..59, fountain ring r<9.65 around (-46,50) → 'tile').
- player lane: Ambience should natively skip zones with `ambience: 'self'` (then drop the patch).
- world state: indoor bloom is forced to 0.22; the casino would like ~0.35 (machines glow).
