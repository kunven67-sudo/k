// Table games (lane B) — factory API from ../CONTRACT.md.
//
//   createBlackjackTable({ engine, physics, tier, casino, id, position, yaw, limits: { min, max }, rng, npcs })
//   createRouletteTable({ engine, physics, tier, casino, id, position, yaw, limits: { min, max, insideMin }, rng, npcs })
//     → Station subclass: { group, interactables, update(dt, ctx), dispose(), footprint: { w, d } }
//
// Both build their own group (placed at `position` / `yaw`), add static colliders to `physics` and
// run their own dealer + NPC players. Extras lane A may use: `table.pitBoss = human` (anchor for pit
// boss lines), `table.devSpeed` (animation speed multiplier).
export { createBlackjackTable, BlackjackTable } from './blackjack.js';
export { createRouletteTable, RouletteTable } from './roulette.js';
