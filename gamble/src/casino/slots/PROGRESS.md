# Slots lane (C) — progress

Owner: lane C. Files: `src/casino/slots/**`, `dev/slots.html|js`, `tools/slot-sim.mjs`.

## Checklist
- [ ] Math: PAR sheets per theme (`math/*.js`) + `tools/slot-sim.mjs` ≥ 10M spins each
- [ ] Symbol art (canvas) per theme
- [ ] Cabinets: video upright + retro mechanical stepper, swivel stool
- [ ] Play flow: bills / TITO in, credits, bet/lines, spin/lever, reels, rollup, big win, free spins
- [ ] Cash out → TITO print; hand pay ≥ $1,200 with W-2G
- [ ] createSlotBank (row / back-to-back), seatNpc/unseatNpc
- [ ] Dev page `dev/slots.html`
- [ ] Perf numbers for a bank of 8

## Decisions
- Maker name (invented): TBD

## How to view
- `http://127.0.0.1:8765/gamble/dev/slots.html`

## Gaps / requests to other lanes
