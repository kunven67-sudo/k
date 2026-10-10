# Slots lane (C) — progress

Owner: lane C. Files: `src/casino/slots/**`, `dev/slots.html|js`, `tools/slot-sim.mjs`.

## Checklist
- [x] Math: PAR sheets per theme (`math/*.js`) + `tools/slot-sim.mjs` ≥ 10M spins each (see table below)
- [x] Symbol art (canvas) per theme — `art/{classic,west,space,dragon}.js`, atlases `art/atlas.js`, signage `art/signage.js` (review: `dev/slots.html?view=symbols`)
- [~] Cabinets: assembled in `index.js` (first screenshots OK: bank of 4 West renders, NPC seated). Geometry (`cabinet/video.js`, `cabinet/stepper.js`, `cabinet/stool.js`, LED/button materials `cabinet/materials.js`), stepper drums `reels3d.js`, video screen `screen.js`, sounds `sound.js` — NOT yet assembled/viewed (next: machine.js + index.js bank + dev room)
- [~] Play flow written (`machine.js` director, `ui.js` wallet/bar, keys) — being debugged (screen canvas: reels not visible yet)
- [~] Cash out → TITO print; hand pay ≥ $1,200 with W-2G (`handpay.js`) — written, untested
- [~] createSlotBank (row / back-to-back), seatNpc/unseatNpc — written, row tested
- [~] Dev page `dev/slots.html` (room, all themes, player, NPCs, `?view=symbols|signs|screen`, `__step`)
- [ ] Perf numbers for a bank of 8

## Decisions
- Maker name (invented): **Silverlode Gaming** ("SILVERLODE"). Titles: Classic Fruit = *Sierra Sevens* (1-line, 3-coin
  buy-a-pay top award) and *Sierra Sevens Triple Line*; Wild West = *Bounty Gulch Gold*; Space = *Saucer Stampede*;
  Dragon = *Golden Pearl Dragon*.
- Math is pure JS shared by game + sim (`math/engine.js` video 5×3, `math/classic.js` stepper, `math/themes.js` PARs).
  Outcomes in game: `fairRandom` via `math/index.js fairRng`. Reel strips are generated deterministically from the
  symbol counts in the PAR (seeded `Rng`), scatters spaced ≥ 3 stops apart (never two in one reel window).
- Classic stepper: 22 physical stops, virtual reels 67–68 stops, weights tuned by exact enumeration; blanks next
  to the wild carry 7–9 virtual stops each (near misses just above/below the line).
- Video: Wild West 25 lines, sticky-wild free spins (8/12/20, +5 retrigger); Space 243 ways (25-credit unit),
  UFO wilds on reels 2–4 expand over the reel (free spins: ×2/×3/×4 for 1/2/3 expanded reels); Dragon 30 lines,
  6+ flaming pearls → hold & spin (3 respins, reset on new pearl, 15 independent cells), pearl values 0.5–10× bet,
  MINI 15× / MINOR 50× coins, full screen = MAJOR 500×; 8 free spins on pearl-rich reels.

## Verified math (tools/slot-sim.mjs, 10 M spins per theme; classic also exact enumeration)

| Theme | RTP | Hit freq | Feature | Max win seen | Volatility (σ/spin) |
|---|---|---|---|---|---|
| Sierra Sevens 1-line | exact 90.01 % (1–2 coins), 90.88 % (3 coins) | 12.63 % | top 1 in 76,313 (1000/2000/5000) | 5000 cr | 9.4–10.6 (high) |
| Sierra Sevens 3-line | exact 90.49 / 90.45 / 90.46 % (1/2/3 lines) | 12.4 / 24.4 / 35.9 % | top 1 in 309,808 per centre line | 1010 cr | 8.9 → 5.3 |
| Bounty Gulch Gold | 90.90 % ± 0.46 | 29.45 % | free spins 1 in 219, avg 46.6× | 1242× bet | 7.5 (medium-high) |
| Saucer Stampede | 92.86 % ± 0.51 | 33.13 % | free spins 1 in 234, avg 39.0× | 3550× bet | 8.3 (medium) |
| Golden Pearl Dragon | 91.45 % ± 0.57 | 25.37 % | hold & spin 1 in 121 (avg 29.9×), free spins 1 in 239 (avg 19.9×) | 1103× bet | 9.2 (high) |

Run: `node gamble/tools/slot-sim.mjs all 1e7` (4 workers, ~10 s).


## How to view
- `http://127.0.0.1:8765/gamble/dev/slots.html`

## Gaps / requests to other lanes
