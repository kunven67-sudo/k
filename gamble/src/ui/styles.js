// Shared front-end CSS (injected once). Card-table look: green baize felt, padded oxblood
// leather rail with brass piping, clay-chip tabs, engraved brass plaques. Everything is drawn
// with CSS gradients + an inline SVG noise (generated, no image files).

import { injectStyle } from '../core/util.js';

// Fine fiber noise for felt / leather / paper (SVG turbulence, alpha only).
const noise = (freq, alpha, oct = 3) =>
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${oct}' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${alpha} 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;

export const NOISE = { felt: noise(0.85, 0.55), leather: noise(0.35, 0.5, 4), paper: noise(0.6, 0.35, 4) };

const CSS = /* css */ `
:root { --text-scale: 1; }
.gx-overlay {
  position: absolute; inset: 0; display: grid; place-items: center;
  padding: calc(14px + var(--safe-top)) calc(12px + var(--safe-right)) calc(14px + var(--safe-bottom)) calc(12px + var(--safe-left));
  background: radial-gradient(120% 90% at 50% 40%, rgba(8,6,10,.35), rgba(4,3,5,.82));
  backdrop-filter: blur(5px) saturate(.9); -webkit-backdrop-filter: blur(5px) saturate(.9);
  opacity: 0; transition: opacity .28s ease; font-size: calc(16px * var(--text-scale));
}
.gx-overlay.in { opacity: 1; }
.gx-overlay.out { opacity: 0; pointer-events: none; }

/* ---------- The table: wood edge → padded leather rail → brass piping → felt ---------- */
.gx-table {
  position: relative; width: min(980px, 100%); max-height: 100%;
  display: flex; flex-direction: column;
  padding: 18px; border-radius: 46px;
  background:
    ${NOISE.leather},
    radial-gradient(140% 70% at 50% 0%, rgba(255,190,150,.16), transparent 55%),
    linear-gradient(180deg, #5a1d1a 0%, #3e1111 45%, #2a0b0b 100%);
  box-shadow:
    0 0 0 3px #1b0f08, 0 0 0 7px #6b4424, 0 0 0 8px #2a1709,
    0 30px 80px rgba(0,0,0,.75), 0 8px 18px rgba(0,0,0,.6),
    inset 0 2px 1px rgba(255,210,180,.25), inset 0 -6px 14px rgba(0,0,0,.6),
    inset 0 0 0 6px rgba(0,0,0,.14);
  transform: translateY(18px) scale(.97); transition: transform .45s cubic-bezier(.2,1.4,.4,1);
}
.gx-overlay.in .gx-table { transform: none; }
/* stitched seam around the rail */
.gx-table::before {
  content: ''; position: absolute; inset: 7px; border-radius: 40px; pointer-events: none;
  border: 1.5px dashed rgba(230,180,140,.28);
}
.gx-felt {
  position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column;
  border-radius: 30px; overflow: hidden;
  background:
    ${NOISE.felt},
    radial-gradient(90% 70% at 50% 35%, #1d7a51 0%, #136140 45%, #0b3f29 100%);
  box-shadow: 0 0 0 2px #c9a24f, 0 0 0 3px #5e4416, inset 0 0 60px rgba(0,0,0,.55), inset 0 10px 22px rgba(0,0,0,.45);
}
/* printed table arc, like a blackjack layout */
.gx-felt::after {
  content: ''; position: absolute; left: 50%; top: -260px; width: 900px; height: 520px; translate: -50% 0;
  border-radius: 50%; border: 2px solid rgba(242,214,140,.10); pointer-events: none;
}
.gx-head { position: relative; z-index: 1; text-align: center; padding: 18px 20px 4px; }
.gx-kicker { font: 400 .78em/1 var(--font-display); letter-spacing: .32em; color: #e7cf8f; opacity: .8; }
.gx-title {
  margin: 4px 0 0; font: 700 2.2em/1 var(--font-casino); color: #f6e7c1; letter-spacing: .01em;
  text-shadow: 0 2px 0 #08301f, 0 3px 10px rgba(0,0,0,.5);
}
.gx-body { position: relative; z-index: 1; flex: 1; min-height: 0; overflow: auto; padding: 8px 26px 18px; scrollbar-width: thin; scrollbar-color: #c9a24f33 transparent; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
.gx-foot { position: relative; z-index: 1; display: flex; gap: 12px; justify-content: center; align-items: center; padding: 10px 18px 18px; flex-wrap: wrap; }

/* ---------- Clay chips (tabs) ---------- */
.gx-tabs { position: relative; z-index: 1; display: flex; gap: 10px; justify-content: center; padding: 12px 14px 6px; overflow-x: auto; scrollbar-width: none; touch-action: pan-x; }
.gx-tabs::-webkit-scrollbar { display: none; }
.gx-tab { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 7px; min-width: 76px; outline: none; }
.gx-chip {
  --c: #b3202a; position: relative; width: 52px; height: 52px; border-radius: 50%; flex: none;
  background:
    radial-gradient(circle at 50% 50%, var(--c) 0 44%, transparent 45%),
    radial-gradient(circle at 50% 50%, #f4ecd8 0 47%, transparent 48%),
    repeating-conic-gradient(from 8deg, #f4ecd8 0 14deg, var(--c) 14deg 45deg),
    var(--c);
  box-shadow: 0 3px 0 rgba(0,0,0,.45), 0 6px 10px rgba(0,0,0,.35), inset 0 -2px 2px rgba(0,0,0,.35), inset 0 2px 2px rgba(255,255,255,.25);
  transition: transform .25s cubic-bezier(.3,1.6,.5,1), box-shadow .25s;
  display: grid; place-items: center;
}
.gx-chip::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: radial-gradient(70% 50% at 35% 25%, rgba(255,255,255,.35), transparent 60%); pointer-events: none; }
.gx-chip svg { position: relative; z-index: 1; width: 22px; height: 22px; fill: none; stroke: #f8efd9; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 1px 0 rgba(0,0,0,.4)); }
.gx-tab-label { font: 600 .72em/1.1 var(--font-ui); letter-spacing: .06em; text-transform: uppercase; color: #cfe3d4; opacity: .75; text-align: center; max-width: 92px; transition: color .2s, opacity .2s; }
.gx-tab:hover .gx-chip, .gx-tab:focus-visible .gx-chip { transform: translateY(-3px); }
.gx-tab[aria-selected="true"] .gx-chip { transform: translateY(-6px) scale(1.08); box-shadow: 0 0 0 2px #f2d688, 0 0 18px rgba(246,216,138,.55), 0 9px 14px rgba(0,0,0,.45); }
.gx-tab[aria-selected="true"] .gx-tab-label { color: #f6e2a6; opacity: 1; }
.gx-tab:focus-visible .gx-tab-label { text-decoration: underline; text-underline-offset: 4px; }

/* ---------- Setting rows ---------- */
.gx-section { animation: gxIn .35s ease both; }
@keyframes gxIn { from { opacity: 0; transform: translateY(8px); } }
.gx-row {
  display: grid; grid-template-columns: 1fr minmax(180px, 44%); gap: 8px 22px; align-items: center;
  padding: 13px 4px; border-bottom: 1px solid rgba(242,214,140,.10);
}
.gx-row:last-child { border-bottom: 0; }
.gx-row.focus { background: linear-gradient(90deg, transparent, rgba(242,214,140,.07), transparent); }
.gx-label { font: 700 1.08em/1.15 var(--font-casino); color: #f4e6c4; }
.gx-desc { margin-top: 3px; font: 400 .82em/1.35 var(--font-ui); color: #b9d2c2; opacity: .85; }
.gx-note { margin: 10px 4px 2px; font: italic 400 .9em/1.4 var(--font-casino); color: #e7d39a; opacity: .85; text-align: center; }
.gx-ctl { justify-self: end; width: 100%; display: flex; justify-content: flex-end; }

/* Toggle: a chip that slides along a felt slot */
.gx-toggle { all: unset; cursor: pointer; position: relative; width: 74px; height: 34px; border-radius: 20px; flex: none;
  background: linear-gradient(180deg, #072a1b, #0d3d28); box-shadow: inset 0 2px 5px rgba(0,0,0,.7), 0 1px 0 rgba(255,255,255,.08); }
.gx-toggle::before { content: attr(data-off); position: absolute; right: 11px; top: 50%; translate: 0 -50%; font: 400 .8em/1 var(--font-display); letter-spacing: .12em; color: #7ea08d; }
.gx-toggle[aria-checked="true"]::before { content: attr(data-on); left: 12px; right: auto; color: #f2d688; }
.gx-toggle .k { position: absolute; top: 3px; left: 3px; width: 28px; height: 28px; border-radius: 50%;
  background: radial-gradient(circle, #6e6a64 0 40%, #e9e1cf 41% 47%, #6e6a64 48%), repeating-conic-gradient(#e9e1cf 0 12deg, #6e6a64 12deg 45deg);
  box-shadow: 0 2px 4px rgba(0,0,0,.6); transition: left .28s cubic-bezier(.3,1.5,.5,1), background .2s; }
.gx-toggle[aria-checked="true"] .k { left: 43px; background: radial-gradient(circle, #b3202a 0 40%, #f4ecd8 41% 47%, #b3202a 48%), repeating-conic-gradient(#f4ecd8 0 12deg, #b3202a 12deg 45deg); }
.gx-toggle:focus-visible { box-shadow: inset 0 2px 5px rgba(0,0,0,.7), 0 0 0 2px #f2d688; }

/* Slider: brass rail + chip thumb */
.gx-slider { display: flex; align-items: center; gap: 12px; width: 100%; max-width: 300px; }
.gx-slider output { min-width: 46px; text-align: right; font: 400 1.05em/1 var(--font-display); letter-spacing: .06em; color: #f2d688; }
.gx-range { -webkit-appearance: none; appearance: none; flex: 1; height: 30px; background: transparent; cursor: pointer; margin: 0; touch-action: none; }
.gx-range::-webkit-slider-runnable-track { height: 8px; border-radius: 6px;
  background: linear-gradient(90deg, #f2d688 0 var(--p), #06261a var(--p)); box-shadow: inset 0 1px 3px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.08); }
.gx-range::-moz-range-track { height: 8px; border-radius: 6px; background: #06261a; box-shadow: inset 0 1px 3px rgba(0,0,0,.8); }
.gx-range::-moz-range-progress { height: 8px; border-radius: 6px; background: #f2d688; }
.gx-range::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; margin-top: -9px; border-radius: 50%; border: 0;
  background: radial-gradient(circle, #1f4fa3 0 38%, #f4ecd8 39% 46%, #1f4fa3 47%), repeating-conic-gradient(#f4ecd8 0 12deg, #1f4fa3 12deg 45deg);
  box-shadow: 0 2px 5px rgba(0,0,0,.6); transition: transform .15s; }
.gx-range::-moz-range-thumb { width: 26px; height: 26px; border-radius: 50%; border: 0;
  background: radial-gradient(circle, #1f4fa3 0 38%, #f4ecd8 39% 46%, #1f4fa3 47%), repeating-conic-gradient(#f4ecd8 0 12deg, #1f4fa3 12deg 45deg); box-shadow: 0 2px 5px rgba(0,0,0,.6); }
.gx-range:active::-webkit-slider-thumb, .gx-range:focus-visible::-webkit-slider-thumb { transform: scale(1.15); box-shadow: 0 0 0 3px #f2d68855, 0 2px 5px rgba(0,0,0,.6); }
.gx-range:focus { outline: none; }

/* Segmented: betting spots */
.gx-seg { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
.gx-seg button { all: unset; cursor: pointer; padding: 8px 13px; border-radius: 999px; font: 600 .8em/1 var(--font-ui); letter-spacing: .04em; color: #d9eadf;
  border: 1.5px solid rgba(242,214,140,.35); background: rgba(3,30,19,.35); transition: background .2s, color .2s, transform .15s, border-color .2s; }
.gx-seg button:hover { border-color: #f2d688; }
.gx-seg button:focus-visible { box-shadow: 0 0 0 2px #f2d688; }
.gx-seg button[aria-checked="true"] { background: linear-gradient(180deg, #f6dc92, #c99b3e); color: #2b1a05; border-color: #f6dc92; box-shadow: 0 2px 8px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.5); }
.gx-seg button:active { transform: scale(.96); }

/* ---------- Brass plaque buttons ---------- */
.gx-btn { all: unset; cursor: pointer; position: relative; padding: 12px 26px 11px; border-radius: 10px; min-width: 120px; text-align: center;
  font: 400 1.15em/1 var(--font-display); letter-spacing: .14em; color: #2b1a05;
  background: linear-gradient(180deg, #fbe7a8 0%, #e1b85c 38%, #b98a34 62%, #e7c06a 100%);
  box-shadow: 0 0 0 1px #6b4c14, 0 3px 0 #5a3d0f, 0 8px 16px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.7), inset 0 -2px 0 rgba(0,0,0,.15);
  text-shadow: 0 1px 0 rgba(255,240,200,.6); transition: transform .12s, filter .2s, box-shadow .12s; }
.gx-btn::before, .gx-btn::after { content: ''; position: absolute; top: 50%; width: 5px; height: 5px; margin-top: -2.5px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff4cf, #7a5716); box-shadow: 0 0 0 1px rgba(0,0,0,.25); }
.gx-btn::before { left: 8px; } .gx-btn::after { right: 8px; }
.gx-btn:hover, .gx-btn:focus-visible { filter: brightness(1.1); }
.gx-btn:focus-visible { box-shadow: 0 0 0 1px #6b4c14, 0 0 0 4px #f6e2a688, 0 3px 0 #5a3d0f, 0 8px 16px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.7); }
.gx-btn:active { transform: translateY(2px); box-shadow: 0 0 0 1px #6b4c14, 0 1px 0 #5a3d0f, 0 4px 8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.6); }
.gx-btn.ghost { color: #f2d688; background: rgba(0,0,0,.18); box-shadow: 0 0 0 1.5px rgba(242,214,140,.55); text-shadow: none; }
.gx-btn.ghost::before, .gx-btn.ghost::after { display: none; }
.gx-btn.ghost:focus-visible { box-shadow: 0 0 0 1.5px #f2d688, 0 0 0 4px #f6e2a644; }

/* ---------- Message card (dealer's card style) ---------- */
.gx-card { position: relative; width: min(460px, 100%); padding: 30px 30px 24px; border-radius: 18px; text-align: center; color: #2a1d10;
  background: ${NOISE.paper}, linear-gradient(170deg, #fbf4e3, #efe2c4);
  box-shadow: 0 0 0 1px #c7b48e, 0 0 0 7px #fbf4e3, 0 0 0 8px #b99c63, 0 30px 70px rgba(0,0,0,.7), 0 6px 14px rgba(0,0,0,.4);
  transform: translateY(24px) rotate(-1.2deg) scale(.96); transition: transform .5s cubic-bezier(.2,1.5,.4,1); }
.gx-overlay.in .gx-card { transform: rotate(-.4deg); }
.gx-card .pip { position: absolute; font: 700 22px/1 var(--font-casino); color: #9b1c22; }
.gx-card .pip.tl { left: 14px; top: 12px; } .gx-card .pip.br { right: 14px; bottom: 12px; rotate: 180deg; }
.gx-card h2 { margin: 6px 0 10px; font: 700 1.9em/1.05 var(--font-casino); color: #1c130a; }
.gx-card p { margin: 0 auto 8px; max-width: 34ch; font: 400 1em/1.5 var(--font-ui); color: #4a3a26; }
.gx-card .foot { margin-top: 4px; font: italic 400 .9em/1.4 var(--font-casino); color: #7b6646; }
.gx-card .acts { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 18px; }
.gx-card .gx-btn.ghost { color: #5a3d0f; box-shadow: 0 0 0 1.5px #b99c63; }

/* Key caps (controls tab) */
.gx-keys { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px 20px; padding: 8px 4px 4px; }
.gx-key { display: flex; justify-content: space-between; align-items: center; gap: 10px; font: 500 .86em/1.2 var(--font-ui); color: #d9eadf; }
.gx-key kbd { font: 600 .78em/1 var(--font-ui); color: #2b2117; padding: 5px 7px 4px; border-radius: 5px; min-width: 22px; text-align: center;
  background: linear-gradient(#f6efde, #d8ccb2); box-shadow: 0 2px 0 #8f8166, 0 3px 4px rgba(0,0,0,.4); }
.gx-subhead { margin: 18px 4px 2px; font: 400 .9em/1 var(--font-display); letter-spacing: .28em; color: #e7cf8f; opacity: .85; }

/* Toast (settings feedback) */
.gx-toast { position: absolute; left: 50%; bottom: calc(18px + var(--safe-bottom)); translate: -50% 20px; opacity: 0; padding: 10px 18px; border-radius: 999px;
  font: 500 .9em/1.2 var(--font-ui); color: #f6e7c1; background: rgba(10,8,6,.85); box-shadow: 0 0 0 1px #c9a24f66, 0 8px 20px rgba(0,0,0,.5); transition: .3s; pointer-events: none; }
.gx-toast.show { translate: -50% 0; opacity: 1; }

@media (max-width: 640px) {
  .gx-table { padding: 10px; border-radius: 28px; }
  .gx-table::before { inset: 4px; border-radius: 24px; }
  .gx-felt { border-radius: 20px; }
  .gx-title { font-size: 1.7em; }
  .gx-body { padding: 4px 14px 12px; }
  .gx-row { grid-template-columns: 1fr; gap: 8px; padding: 12px 2px; }
  .gx-ctl { justify-content: flex-start; }
  .gx-seg { justify-content: flex-start; }
  .gx-slider { max-width: none; }
  .gx-tabs { justify-content: flex-start; gap: 4px; padding: 10px 10px 4px; }
  .gx-tab { min-width: 66px; }
  .gx-chip { width: 44px; height: 44px; }
  .gx-tab-label { font-size: .64em; }
}
@media (prefers-reduced-motion: reduce) {
  .gx-table, .gx-card, .gx-chip, .gx-toggle .k { transition: none !important; }
}
`;

export function ensureStyles() {
  injectStyle('gx-kit-css', CSS);
}
