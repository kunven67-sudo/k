# Casino — build contract (Eldorado, first casino)

Read first: `DESIGN.md` §9 (gambling), §19–§20 (TITO, table realism), §27, §39 (physical chips,
lever, card peeks), §41, §46 (quality bar), §49 (content limits), golden rules at the top;
`ARCHITECTURE.md` §0, §2–§8. This file decides everything those leave open for the casino.

## Lanes and ownership (never edit another lane's files; ask in your PROGRESS.md instead)

| Lane | Owns |
|---|---|
| A · floor | `src/casino/index.js`, `src/casino/layout.js`, `src/casino/interior/**`, `src/casino/cage.js`, `src/casino/npcs.js`, `src/casino/strings.js`, `dev/casino.html|js`; small edits allowed in `src/world/compose.js`, `src/world/reno/index.js` + `eldorado.js` (door hookup only), `src/states/world.js` (pass `player` in the world.update ctx; nothing else), `src/life/items.js` (pocket canvases for `tito` and `chips` items) |
| B · tables | `src/casino/tables/**`, `dev/tables.html|js` |
| C · slots | `src/casino/slots/**`, `dev/slots.html|js` |
| shared (core, don't edit — ask) | `src/casino/chips.js`, `src/casino/station.js`, `src/casino/tickets.js`, this file |

## Shared modules (already written)

- `chips.js` — `chips.counts/total/buyIn/pay/take/removeCounts/removeAll/colorUp`, `DENOMS`
  (Nevada colours, $2.50 pink for 3:2), `CHIP_RADIUS` 19.5 mm, `CHIP_THICKNESS` 3.3 mm. Chips are
  per casino. Emits `chips:changed`.
- `station.js` — `Station` base class: seats, sit/stand, close-up camera blend, pointer picking
  while seated (`onPointer(type, raycaster, ev)`), DOM layer `this.ui` with a Stand Up button.
  Every playable spot (slot, table seat, video poker) is a Station subclass.
- `tickets.js` — TITO vouchers as pocket items: `tickets.print/list/take/isValid/total`.
- Money: `addCash(delta, reason)` / `slice('money')` from `src/life/state.js` (cash in pockets).
- Randomness: **only** `fairRandom / fairInt / fairShuffle` from `src/core/rng.js` for outcomes.
  Seeded `Rng` only for visuals (layout, NPC looks).

## Factory API (lane A calls these; B and C implement them)

All positions are world metres; `position` = floor point (y = floor height), `yaw` = rotation
about +Y of the station's local frame. Local frame convention: **the player side is local +Z**
(chairs/stools are at +Z, the dealer / machine face is toward −Z). Factories place their own
group, add their own static colliders to `physics` (owner = the seat descriptor where useful) and
return the station(s). `ctx` passed to update = `{ camera, player, clock }`.

```js
// src/casino/tables/index.js  (lane B)
createBlackjackTable({ engine, physics, tier, casino, id, position, yaw, limits: { min, max }, rng, npcs })
createRouletteTable({ engine, physics, tier, casino, id, position, yaw, limits: { min, max, insideMin }, rng, npcs })
//   → Station subclass: { group, interactables, update(dt, ctx), dispose(), footprint: { w, d } }
// src/casino/slots/index.js  (lane C)
createSlotBank({ engine, physics, tier, casino, id, theme, count, arrangement, position, yaw, rng, denom })
//   theme: 'classic-fruit' | 'wild-west' | 'space' | 'dragon'; arrangement: 'row' | 'back-to-back'
//   → { group, machines: SlotMachine[], interactables, update(dt, ctx), dispose(), footprint }
//   machine.seatNpc(human) / machine.unseatNpc() — NPC sits and plays (visual + quiet sound)
```

Footprint budgets (incl. chairs/stools and the dealer's space): blackjack ≤ 3.6 × 3.2 m, roulette
≤ 4.4 × 3.2 m, slot machine pitch 0.78 m and depth ≤ 2.0 m for a row (≤ 3.8 m back-to-back).
`npcs` = how many seats NPC players fill (lane A passes a tier-based number).

Until B/C land, `tables/index.js` and `slots/index.js` contain stubs with the same signatures
(a placeholder box), so lane A can lay out the floor from the start.

## Floor plan (lane A; world coords, floor at y = 0.15)

Shell interior: x ∈ [−79.6, −12.4], z ∈ [12.4, 99.6], first-floor slab underside at y = 7.
Entrances: Virginia St main doors on the east wall at z 44.6–55.4 (centre z = 50); the chamfer
corner door near (−14.5, 14.5); the 4th St side door at x −47.5…−42.5 on the north wall (z = 12).

- Foyer (east, x −20…−12.4, z 42…58): marble, security podium (ID check: under 21 → turned
  away; `save.life.character.age`), players club desk nearby.
- Centre: a grand original fountain under a dome around (−46, 50) — the Eldorado's real
  landmark is its bronze "Fountain of Fortune"; make our own original design with the same
  spirit (bronze figures, marble basin, real water motion/sound).
- Table pit: south of the fountain, around (−46, 72): 2 blackjack ($5–$500 and $25–$2,000),
  1 roulette ($5 min, $1 inside), a pit podium in the middle, covered "closed" tables for later
  games (craps, baccarat, three card poker) — realistic and leaves room to grow.
- Slot floor: the north half (z 16…40) and the east strip, banks of the four themes with
  carpeted aisles ≥ 2.4 m; the classic lever machines in their own corner.
- Cage: on the west wall around (−77, 51), barred/glass windows, a cashier NPC, TITO kiosks + an
  ATM beside it.
- Bar along the south-east, restrooms corridor (doors, closed for now) south-west, hotel
  elevators north-west ("Hotel guests" — not usable yet), escalator up to the skyway near the
  4th St door (not usable yet). No clocks and no windows on the floor (real casino trick).

## Game rules (real house edge; DESIGN golden rule 1 = the most realistic option)

- Blackjack: 6-deck shoe, cut card at ~75 %, dealer hits soft 17 on the $5 table, stands on the
  $25 table, blackjack pays 3:2, double on any two cards, double after split, split to 4 hands,
  split aces get one card each, no surrender, insurance/even money offered on a dealer ace. Real
  shoe state (card counting works), burn card after the shuffle. Hand signals (tap = hit,
  wave = stand) are what the character does when you press Hit / Stand.
- Roulette: American double-zero wheel (real pocket order), all standard bets incl. the 0-00-1-2-3
  top line, payouts 35:1 … 1:1, outcome `fairInt(0, 37)` chosen at the spin, the ball's path
  (orbit, slowdown, drop, deflectors, rattle) choreographed to land in that pocket; dolly on the
  winner, dealer clears losers and pays winners. No more bets when the ball slows.
- Slots: published PAR sheets per theme with **88–95 % RTP**, virtual reel mapping (legal
  near-misses via weighted blanks), paylines/ways, wilds/scatters/free spins on video themes,
  Monte-Carlo verified (≥ 10 M spins, node script under `tools/`), results in PROGRESS.md.
  Bills ($1/$5/$20/$100 from cash) and TITO in; cash out prints a ticket. Jackpots ≥ $1,200 lock
  the machine for a hand pay with a W-2G (attendant walks over).
- Chips: buy at the cage (or cash at a table: the dealer exchanges bills for chips), drag
  chips physically onto bet spots, click a stack to bet it, ALL IN pushes everything. Payouts
  arrive as chips (`chips.pay`). Leaving a table colours you up.

## Quality bar (non-negotiable, §46)

Looks like a shipped studio game, not a prototype: real proportions (blackjack table 0.76 m
felt height, chip 39 mm, card 63 × 88 mm), PBR materials from `gfx/materials.js` (felt, wood,
brass, leather, carpet-casino…) or new kinds via `registerKind`, bevelled edges, contact
shadows, lighting that sells the room (warm, dim, pools of light on the felt), real-sounding
audio from `src/audio` (names in ARCHITECTURE §5 — `chip.*`, `card.*`, `roulette.*`, `slot.*`,
`cage.drawer`, `cash.*`, `coins.*`), animations with anticipation and settle. Phones (tier
medium/low) must stay smooth: merge statics per material, instance repeated parts, canvas
textures ≤ 1024², real lights budget ≤ 6 on medium.

All text through `t()` (English + Spanish). No emoji in game art — draw symbols with canvas
paths/gradients. Content limits §49 apply (NPCs may be rude, never slurs).

## Working rules (all lanes)

- Write your first file within 6 tool calls; keep `src/casino/<lane>/PROGRESS.md` (lane A:
  `src/casino/PROGRESS.md`) updated after every milestone — sessions can die at any moment.
- Screenshots: always `flock <scratchpad>/shot.lock` around `tools/shot.mjs` (one SwiftShader run
  at a time across all lanes). Server: `cd /home/user/k && (setsid nohup python3 -m http.server
  8765 --bind 127.0.0.1 >/dev/null 2>&1 < /dev/null &)` if it's down.
- Don't `git commit` — the lead commits checkpoints.
- Zero console errors on your dev page; look at your screenshots critically before calling
  anything done.
