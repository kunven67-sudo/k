// Loading screens. Three flavours, picked by `kind` (or at random):
//   'newspaper' — today's edition of The Truckee Times (headlines from your own life + Reno color)
//   'tip'       — a useless-but-true tip of the house on a dealer's card
//   'slot'      — a tiny free slot machine to play while you wait (imaginary credits)
//
//   const l = showLoading({ kind: 'newspaper' });
//   l.setProgress(0.4); l.setStatus('Paving Virginia Street'); await l.close();
//
// Mounted on #app above the fade layer, so it survives engine.go() clearing the state's UI root.

import { el, injectStyle } from '../core/util.js';
import { t } from '../core/i18n.js';
import { settings } from '../core/settings.js';
import { clock } from '../core/clock.js';
import './strings.js';
import { NOISE, ensureStyles } from './styles.js';
import { randomTip, headlines } from './tips.js';
import { uiSound, vary } from './sfx.js';
import { button } from './kit.js';

const CSS = /* css */ `
.ld { position: absolute; inset: 0; z-index: 150; display: grid; place-items: center; grid-template-columns: minmax(0,1fr);
  padding: calc(16px + var(--safe-top)) calc(14px + var(--safe-right)) calc(64px + var(--safe-bottom)) calc(14px + var(--safe-left));
  background: radial-gradient(110% 80% at 50% 40%, #241a14 0%, #0d0907 70%, #050403 100%); font-size: calc(16px * var(--text-scale));
  opacity: 0; transition: opacity .35s ease; box-sizing: border-box; }
.ld.in { opacity: 1; } .ld.out { opacity: 0; pointer-events: none; }
/* progress: a brass thread with a rolling chip */
.ld-bar { position: absolute; left: 50%; bottom: calc(26px + var(--safe-bottom)); translate: -50% 0; width: min(420px, 78vw); }
.ld-status { display: flex; justify-content: space-between; margin-bottom: 9px; font: 400 .85em/1 var(--font-display); letter-spacing: .3em; color: #d9c08a; }
.ld-status b { font-weight: 400; color: #f6e2a6; }
.ld-track { position: relative; height: 3px; border-radius: 3px; background: rgba(242,214,140,.15); }
.ld-fill { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: 3px; background: linear-gradient(90deg, #8a6a2a, #f6dc92); box-shadow: 0 0 10px #f6dc9266; transition: width .4s ease; }
.ld-chip { position: absolute; top: 50%; left: 0; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; transition: left .4s ease;
  background: radial-gradient(circle, #b3202a 0 38%, #f4ecd8 39% 46%, #b3202a 47%), repeating-conic-gradient(#f4ecd8 0 12deg, #b3202a 12deg 45deg);
  box-shadow: 0 2px 5px rgba(0,0,0,.6); animation: ldRoll 1.2s linear infinite; }
@keyframes ldRoll { to { rotate: 360deg; } }

/* ---------- The Truckee Times ---------- */
.np { position: relative; width: min(760px, 100%); max-height: 100%; overflow: hidden; padding: 22px 26px 26px; color: #1d1a16; box-sizing: border-box;
  background: ${NOISE.paper}, radial-gradient(120% 90% at 30% 20%, #efe6cf, #e1d3b0 70%, #cdbb92);
  box-shadow: 0 30px 70px rgba(0,0,0,.7), 0 0 0 1px #b9a679; rotate: -1.4deg; transform-origin: 50% 60%;
  animation: npIn .9s cubic-bezier(.2,1.25,.35,1) both; }
@keyframes npIn { from { transform: rotate(-200deg) scale(.15); opacity: 0; } 60% { opacity: 1; } }
/* fold crease + coffee ring */
.np::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 30px; margin-top: -15px; pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(80,60,30,.10) 45%, rgba(255,255,255,.18) 55%, transparent); }
.np::after { content: ''; position: absolute; right: 9%; bottom: 12%; width: 120px; height: 120px; border-radius: 50%; pointer-events: none;
  box-shadow: inset 0 0 0 5px rgba(110,70,30,.14), inset 0 0 0 9px rgba(110,70,30,.05); rotate: 20deg; scale: 1 .93; }
.np-top { display: flex; justify-content: space-between; font: 400 .72em/1.2 var(--font-type); letter-spacing: .04em; border-bottom: 1px solid #1d1a16; padding-bottom: 6px; }
.np-name { margin: 10px 0 2px; text-align: center; font: 700 3.3em/1 var(--font-western); letter-spacing: .01em; }
.np-motto { text-align: center; font: italic 400 .9em/1.3 var(--font-casino); }
.np-rule { margin: 10px 0 14px; border-top: 3px double #1d1a16; border-bottom: 1px solid #1d1a16; height: 3px; }
.np-lead { font: 700 2.15em/1.02 var(--font-casino); text-align: center; text-wrap: balance; }
.np-deck { margin: 8px auto 14px; max-width: 46ch; text-align: center; font: italic 400 1em/1.35 var(--font-casino); color: #3a3329; }
.np-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-top: 1px solid #1d1a16; padding-top: 12px; }
.np-col { padding: 0 12px; border-left: 1px solid rgba(29,26,22,.4); } .np-col:first-child { border-left: 0; padding-left: 0; } .np-col:last-child { padding-right: 0; }
.np-col h3 { margin: 0 0 6px; font: 700 1.02em/1.15 var(--font-casino); }
.np-col p { margin: 0; font: 400 .8em/1.4 var(--font-type); color: #3a3329; }
.np-weather { margin-top: 14px; padding-top: 8px; border-top: 1px solid #1d1a16; font: 400 .74em/1.3 var(--font-type); text-align: center; }

/* ---------- Tip card ---------- */
.tipc { position: relative; width: min(520px, 100%); padding: 34px 34px 30px; text-align: center; border-radius: 18px; box-sizing: border-box;
  background: ${NOISE.paper}, linear-gradient(170deg, #fbf4e3, #efe2c4); color: #2a1d10;
  box-shadow: 0 0 0 1px #c7b48e, 0 0 0 7px #fbf4e3, 0 0 0 8px #b99c63, 0 30px 70px rgba(0,0,0,.7);
  animation: tipIn .8s cubic-bezier(.2,1.4,.4,1) both; }
@keyframes tipIn { from { transform: perspective(900px) rotateY(180deg) translateY(30px); opacity: 0; } 40% { opacity: 1; } }
.tipc .k { font: 400 .8em/1 var(--font-display); letter-spacing: .36em; color: #9b1c22; }
.tipc .q { margin: 14px 0 0; font: italic 400 1.45em/1.35 var(--font-casino); text-wrap: balance; }
.tipc .suit { position: absolute; font: 700 26px/1 var(--font-casino); color: #9b1c22; }
.tipc .suit.a { left: 16px; top: 14px; } .tipc .suit.b { right: 16px; bottom: 14px; rotate: 180deg; }

/* ---------- Free slot ---------- */
.fs { position: relative; width: min(440px, 100%); padding: 22px 22px 20px; border-radius: 26px 26px 18px 18px; text-align: center; box-sizing: border-box;
  background: linear-gradient(180deg, #6b0f17, #3b070c 60%, #22040a); box-shadow: 0 0 0 3px #c99b3e, 0 0 0 5px #4a3410, 0 30px 70px rgba(0,0,0,.7), inset 0 2px 0 rgba(255,200,180,.3); }
.fs-title { font: 400 1.6em/1 var(--font-neon); color: #ffd9e2; text-shadow: 0 0 6px #ff3b6b, 0 0 18px #ff2050; }
.fs-sub { margin: 6px 0 14px; font: 400 .78em/1 var(--font-display); letter-spacing: .3em; color: #f2d688; }
.fs-win { display: flex; gap: 8px; padding: 10px; border-radius: 12px; background: #0b0605; box-shadow: inset 0 3px 10px #000, 0 0 0 2px #c99b3e; }
.fs-reel { position: relative; flex: 1; height: 96px; overflow: hidden; border-radius: 6px;
  background: linear-gradient(180deg, #8d8577, #fdfaf1 30%, #fdfaf1 70%, #8d8577); }
.fs-reel::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.45), transparent 28%, transparent 72%, rgba(0,0,0,.45)); pointer-events: none; }
.fs-strip { position: absolute; left: 0; right: 0; top: 0; will-change: transform; }
.fs-sym { height: 96px; display: grid; place-items: center; font: 400 54px/1 var(--font-western); }
.fs-sym.s7 { color: #c3121f; text-shadow: 0 2px 0 #5c070d; }
.fs-sym.bar { font: 400 30px/1 var(--font-display); letter-spacing: .08em; color: #fff; }
.fs-sym.bar span { background: #111; padding: 6px 8px 3px; border-radius: 4px; box-shadow: 0 0 0 2px #111, 0 0 0 3px #c99b3e; }
.fs-sym.star { color: #d89a12; text-shadow: 0 2px 0 #7a5208; font-family: var(--font-casino); }
.fs-sym.heart { color: #c3121f; font-family: var(--font-casino); }
.fs-sym.club { color: #156b3d; font-family: var(--font-casino); }
.fs-sym.dollar { color: #1b7a3f; font-family: var(--font-casino); font-weight: 700; }
.fs-line { position: absolute; left: 4px; right: 4px; top: 50%; height: 2px; background: #ff2b4a99; box-shadow: 0 0 8px #ff2b4a; pointer-events: none; }
.fs-msg { min-height: 1.4em; margin: 12px 0 10px; font: 400 1.05em/1.3 var(--font-display); letter-spacing: .14em; color: #f6e2a6; }
.fs-msg.win { color: #fff; text-shadow: 0 0 10px #ffd34d; animation: fsBlink .35s steps(2) 6; }
@keyframes fsBlink { 50% { opacity: .35; } }
.fs-cred { margin-top: 10px; font: 400 .8em/1 var(--font-display); letter-spacing: .24em; color: #d9b98a; }
@media (max-width: 640px) {
  .np { padding: 16px 16px 18px; } .np-name { font-size: 2.2em; } .np-lead { font-size: 1.5em; }
  .np-cols { grid-template-columns: 1fr; } .np-col { border-left: 0; padding: 8px 0; border-top: 1px dotted rgba(29,26,22,.4); }
  .np-col:nth-child(n+3) { display: none; } .np-top span:nth-child(2) { display: none; }
}
@media (prefers-reduced-motion: reduce) { .np, .tipc { animation: none; } }
`;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const loc = () => (settings.get('language') === 'es' ? 'es-ES' : 'en-US');

function newspaper() {
  const h = headlines();
  let date = '';
  try {
    date = clock.format({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, loc());
  } catch {
    date = new Date().toLocaleDateString(loc(), { dateStyle: 'full' });
  }
  uiSound('ui.paper', { rate: vary(0.1) });
  return el('div', { class: 'np' }, [
    el('div', { class: 'np-top' }, [el('span', { text: date }), el('span', { text: t('ui.paper.edition') }), el('span', { text: t('ui.paper.price') })]),
    el('div', { class: 'np-name', text: t('ui.paper.name') }),
    el('div', { class: 'np-motto', text: t('ui.paper.motto') }),
    el('div', { class: 'np-rule' }),
    el('div', { class: 'np-lead', text: h.lead.head }),
    el('div', { class: 'np-deck', text: h.lead.deck }),
    el('div', { class: 'np-cols' }, h.side.map((s) => el('div', { class: 'np-col' }, [el('h3', { text: s.head }), el('p', { text: s.deck })]))),
    el('div', { class: 'np-weather', text: t('ui.paper.weather') }),
  ]);
}

function tipCard() {
  const suit = pick(['♠', '♥', '♦', '♣']);
  uiSound('ui.card-flip', { rate: vary(0.1) });
  return el('div', { class: 'tipc' }, [
    el('span', { class: 'suit a', text: suit }),
    el('span', { class: 'suit b', text: suit }),
    el('div', { class: 'k', text: t('ui.load.tip').toUpperCase() }),
    el('p', { class: 'q', text: randomTip() }),
  ]);
}

// ---- free slot: 3 reels, symbol weights, imaginary credits ----
const SYMS = [
  { id: 's7', html: '7', w: 1, pay: 50 },
  { id: 'bar', html: '<span>BAR</span>', w: 2, pay: 20 },
  { id: 'star', html: '★', w: 3, pay: 12 },
  { id: 'dollar', html: '$', w: 4, pay: 8 },
  { id: 'heart', html: '♥', w: 5, pay: 5 },
  { id: 'club', html: '♣', w: 5, pay: 4 },
];
const STRIP = SYMS.flatMap((s) => Array(s.w).fill(s));
function freeSlot() {
  let credits = 100;
  let spinning = false;
  const reels = [0, 1, 2].map(() => {
    const strip = el('div', { class: 'fs-strip' });
    // Long strip of random symbols; the result is written into the last cell before each spin.
    const cells = Array.from({ length: 24 }, () => {
      const s = pick(STRIP);
      const c = el('div', { class: `fs-sym ${s.id}`, html: s.html });
      strip.appendChild(c);
      return c;
    });
    return { strip, cells, node: el('div', { class: 'fs-reel' }, [strip]) };
  });
  const msg = el('div', { class: 'fs-msg', text: t('ui.load.free').toUpperCase() });
  const cred = el('div', { class: 'fs-cred', text: t('ui.load.credits', { n: credits }) });
  const spinBtn = button(t('ui.load.spin'), () => spin(), { sound: null });
  function spin() {
    if (spinning) return;
    spinning = true;
    credits -= 5;
    cred.textContent = t('ui.load.credits', { n: credits });
    msg.className = 'fs-msg';
    msg.textContent = '· · ·';
    uiSound('slot.lever', { rate: vary() });
    const result = [0, 1, 2].map(() => pick(STRIP));
    // Gentle nudge toward near-misses and the odd win so it's fun while loading.
    if (Math.random() < 0.18) result[1] = result[2] = result[0];
    reels.forEach((r, i) => {
      const last = r.cells[r.cells.length - 1];
      last.className = `fs-sym ${result[i].id}`;
      last.innerHTML = result[i].html;
      r.strip.style.transition = 'none';
      r.strip.style.transform = 'translateY(0)';
      void r.strip.offsetHeight;
      const ms = 900 + i * 380;
      r.strip.style.transition = `transform ${ms}ms cubic-bezier(.25,.1,.25,1.08)`;
      r.strip.style.transform = `translateY(${-(r.cells.length - 1) * 96}px)`;
      setTimeout(() => uiSound('slot.reel-stop', { rate: vary(0.08) }), ms);
    });
    setTimeout(() => {
      // Prepare the next spin: copy the result to the top so the reset is seamless.
      reels.forEach((r, i) => {
        r.cells[0].className = `fs-sym ${result[i].id}`;
        r.cells[0].innerHTML = result[i].html;
        r.strip.style.transition = 'none';
        r.strip.style.transform = 'translateY(0)';
      });
      const same = result[0].id === result[1].id && result[1].id === result[2].id;
      if (same) {
        const n = result[0].pay * 5;
        credits += n;
        msg.className = 'fs-msg win';
        msg.textContent = (result[0].id === 's7' ? t('ui.load.big') : t('ui.load.win', { n })).toUpperCase();
        uiSound(result[0].id === 's7' ? 'slot.win-big' : 'slot.win-small');
      } else {
        msg.textContent = t('ui.load.lose').toUpperCase();
      }
      cred.textContent = t('ui.load.credits', { n: credits });
      spinBtn.textContent = t('ui.load.spinAgain');
      spinning = false;
    }, 900 + 2 * 380 + 120);
  }
  const node = el('div', { class: 'fs' }, [
    el('div', { class: 'fs-title', text: 'Gamble' }),
    el('div', { class: 'fs-sub', text: t('ui.load.free').toUpperCase() }),
    el('div', { class: 'fs-win', style: { position: 'relative' } }, [...reels.map((r) => r.node), el('div', { class: 'fs-line' })]),
    msg,
    spinBtn,
    cred,
  ]);
  const onKey = (e) => {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      spin();
    }
  };
  window.addEventListener('keydown', onKey);
  node.dispose = () => window.removeEventListener('keydown', onKey);
  return node;
}

/** Shows a loading screen. Returns {setProgress(0..1), setStatus(text), close() → Promise}. */
export function showLoading({ kind } = {}) {
  ensureStyles();
  injectStyle('gx-loading-css', CSS);
  kind = kind || pick(['newspaper', 'tip', 'slot']);
  const content = kind === 'slot' ? freeSlot() : kind === 'tip' ? tipCard() : newspaper();
  const fill = el('div', { class: 'ld-fill' });
  const chip = el('div', { class: 'ld-chip' });
  const label = el('span', { text: t('ui.load.loading').toUpperCase() });
  const pctEl = el('b', { text: '0%' });
  const root = el('div', { class: 'ld', role: 'status', 'aria-live': 'polite' }, [
    content,
    el('div', { class: 'ld-bar' }, [el('div', { class: 'ld-status' }, [label, pctEl]), el('div', { class: 'ld-track' }, [fill, chip])]),
  ]);
  (document.getElementById('app') || document.body).appendChild(root);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('in')));
  return {
    kind,
    setProgress(p) {
      const v = Math.max(0, Math.min(1, p));
      fill.style.width = chip.style.left = `${v * 100}%`;
      pctEl.textContent = `${Math.round(v * 100)}%`;
    },
    setStatus(text) {
      label.textContent = String(text).toUpperCase();
    },
    close() {
      content.dispose?.();
      root.classList.add('out');
      return new Promise((res) =>
        setTimeout(() => {
          root.remove();
          res();
        }, 380),
      );
    },
  };
}
