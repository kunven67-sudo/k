# Lane B — tables (blackjack + roulette) — PROGRESS

Owner: lane B. Files: `src/casino/tables/**`, `dev/tables.html|js`, `tools/tables-selftest.mjs`.

## Checklist
- [x] rules/blackjack.js — Shoe (6D, cut ~75 %, burn, Hi-Lo running/true count), totals, H17/S17
      dealer rule, basic strategy (6D DAS no-surrender, H17 + S17 variants), settle, legal actions,
      headless `simulateRound`
- [x] rules/roulette.js — American wheel order, every bet incl. top line / trios / zero splits,
      layout geometry (metres) + hit test, exact edge
- [x] tools/tables-selftest.mjs — house edges verified (see below)
- [x] kit: cardart.js (canvas pips, court figures, Eldorado back), cards.js (1 instanced mesh,
      2×1024² atlases), chips3d.js (1 instanced mesh, Nevada colours, inlay, piles), furniture.js
      (rail sweeps, chairs, printed felt, colliders), hands.js (TableHands), people.js (dealer, NPCs,
      speech bubbles + TTS), ui.js (clay-chip buttons), tween.js, bills.js, sfx.js
- [x] blackjack-geo.js (table statics) + blackjack.js (BlackjackTable) — written, NOT yet run
- [ ] index.js factories wired (still the stub!)
- [ ] dev/tables.html|js room + player + `?game=&sit=1`
- [ ] blackjack visual review / iteration
- [ ] RouletteTable (wheel.js, roulette-geo.js, roulette.js)
- [ ] perf numbers, mobile screenshots

## Verified house edges (tools/tables-selftest.mjs)
- Blackjack H17 ($5 table), 4,000,000 hands: **0.585 % ± 0.058**; 100k hands: −0.32 % ± 0.37 (noise)
- Blackjack S17 ($25 table), 4,000,000 hands: **0.384 % ± 0.058**
- Roulette exact enumeration: every bet 5.263 %, top line 7.895 %; Monte Carlo 1M spins ≈ 5.3 % ± 0.1

## Decisions
- Outcomes: only `fairShuffle` (shoe) and `fairInt(0,37)` (wheel). Seeded Rng only for looks/NPCs.
- Split aces: one card each, no re-split; 21 after a split is not a blackjack. Peek on A/10.
- Seated hands: the character 'seated' hold pins hands to the thighs at 0.9 weight, so
  `kit/hands.js` wraps `human.animator.actions.update` while installed (replicates the seated body,
  supplies table hands; one-shots still win). Request below.
- Feet (seat.pos) sit 0.12 m outside the rail; the table hull ends at the rail's inner edge so the
  KCC capsule doesn't start inside a collider. Chair colliders are disabled while sat on.
- Felt print = 2 × 1024² canvases (left/right halves) on uv0 + felt fibre maps on uv1.

## How to view
- `http://127.0.0.1:8765/gamble/dev/tables.html?view=art` card + chip atlases
- `…?view=props` cards and chips on felt

## Gaps / requests to shared owners
- character: an official seated-hands hook (`human.setSeatedHands(fn)` or a configurable 'seated'
  hold) would replace the actions.update wrapper in kit/hands.js.
- engine: a depth-of-field uniform in the film pass would allow a real shallow-DOF close-up; for
  now the tables only raise `uVignette` while seated.
