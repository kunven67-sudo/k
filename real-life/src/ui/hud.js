// Clean HUD (master list §32): a small dot crosshair, a hint when you look at something you
// can use ("E  Open fridge"), small need icons only when a need gets low, and toasts.
//
//   const hud = new Hud(uiRoot)
//   hud.setHint('Open fridge', 'E') / hud.setHint(null)
//   hud.toast('Found $0.25 in the couch')
//   hud.setNeeds([{ id, label, value }])     // shows only the low ones
//   hud.subtitle('Mom', 'Breakfast is ready!', 3)

import { el, injectStyle } from '../core/util.js';
import { settings } from '../core/settings.js';
import { input } from '../core/input.js';
import { device } from '../core/quality.js';

injectStyle('hud', `
/* #ui-root > * turns pointer events on for every UI root; the HUD covers the whole screen, so
   it must let clicks through to the game (clicking the game is what locks the mouse to turn). */
#ui-root > .hud, .hud { position: fixed; inset: 0; pointer-events: none; z-index: 20; font-family: var(--font-round); color: #fff; }
.hud-dot { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; border-radius: 50%;
  background: rgba(255,255,255,.92); box-shadow: 0 0 0 1.5px rgba(0,0,0,.35); transition: transform .12s ease, background .12s ease; }
.hud-dot.on { transform: scale(1.7); background: #fff; }
.hud-click { position: absolute; left: 50%; top: 56%; transform: translateX(-50%); padding: 7px 14px; border-radius: 999px; background: rgba(10,10,14,.55);
  font-size: 14px; letter-spacing: .02em; opacity: 0; transition: opacity .25s ease; }
.hud-click.on { opacity: 1; }
.hud-hint { position: absolute; left: 50%; top: calc(50% + 26px); transform: translateX(-50%); display: flex; gap: 8px; align-items: center;
  font-size: 15px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,.7); white-space: nowrap; opacity: 0; transition: opacity .12s ease; }
.hud-hint.on { opacity: 1; }
.hud-key { display: inline-grid; place-items: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 6px; font-size: 12px; font-weight: 700;
  background: rgba(255,255,255,.95); color: #16151a; box-shadow: 0 2px 0 rgba(0,0,0,.35); text-shadow: none; }
.hud-hint .alt { opacity: .85; font-weight: 500; margin-left: 6px; }
.hud-needs { position: absolute; left: 18px; bottom: 18px; display: flex; gap: 8px; }
.hud-need { display: flex; align-items: center; gap: 6px; padding: 6px 10px 6px 8px; border-radius: 999px; background: rgba(22,21,26,.62);
  font-size: 13px; font-weight: 600; backdrop-filter: blur(4px); }
.hud-need .bar { width: 46px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.2); overflow: hidden; }
.hud-need .bar i { display: block; height: 100%; background: var(--warn, #f5b942); }
.hud-need.bad .bar i { background: var(--bad, #ef5b4c); }
.hud-toasts { position: absolute; left: 50%; top: 22px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; align-items: center; }
.hud-toast { padding: 9px 16px; border-radius: 12px; background: rgba(22,21,26,.78); font-size: 14px; font-weight: 500; backdrop-filter: blur(6px);
  animation: hudIn .25s ease both; max-width: 70vw; text-align: center; }
.hud-toast.out { animation: hudOut .35s ease both; }
@keyframes hudIn { from { opacity: 0; transform: translateY(-8px); } }
@keyframes hudOut { to { opacity: 0; transform: translateY(-8px); } }
.hud-sub { position: absolute; left: 50%; bottom: 13vh; transform: translateX(-50%); max-width: min(760px, 86vw); text-align: center;
  font-size: calc(18px * var(--text-scale, 1)); font-weight: 500; line-height: 1.35; text-shadow: 0 2px 4px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,.9); }
.hud-sub b { color: #ffd38a; font-weight: 700; }
.hud-clock { position: absolute; right: 18px; top: 16px; font-size: 13px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,.7); opacity: .85; }
.hud-fade { position: fixed; inset: 0; background: #000; opacity: 0; transition: opacity .6s ease; pointer-events: none; z-index: 30; }
`);

const NEED_ICONS = { hunger: '🍔', thirst: '💧', energy: '😴', bladder: '🚽', hygiene: '🧼', fun: '🎮', social: '💬' };
void NEED_ICONS;

export class Hud {
  constructor(root) {
    this.root = el('div', { class: 'hud' });
    this.dot = el('div', { class: 'hud-dot' });
    this.clickHint = el('div', { class: 'hud-click' }, ['Click to look around']);
    this.hint = el('div', { class: 'hud-hint' });
    this.needs = el('div', { class: 'hud-needs' });
    this.toasts = el('div', { class: 'hud-toasts' });
    this.sub = el('div', { class: 'hud-sub' });
    this.clockEl = el('div', { class: 'hud-clock' });
    this.root.append(this.dot, this.clickHint, this.hint, this.needs, this.toasts, this.sub, this.clockEl);
    root.appendChild(this.root);
    this._hintKey = '';
    this._subT = 0;
  }

  setVisible(v) {
    this.root.style.display = v ? '' : 'none';
  }

  setHint(text, key = 'E', alt = null) {
    const k = text ? `${key}|${text}|${alt?.key}|${alt?.text}` : '';
    if (k === this._hintKey) return;
    this._hintKey = k;
    this.dot.classList.toggle('on', !!text);
    if (!text || settings.get('hudHints') === false) {
      this.hint.classList.remove('on');
      return;
    }
    this.hint.replaceChildren(el('span', { class: 'hud-key' }, [key]), el('span', {}, [text]));
    if (alt) this.hint.append(el('span', { class: 'hud-key' }, [alt.key]), el('span', { class: 'alt' }, [alt.text]));
    this.hint.classList.add('on');
  }

  toast(text, ms = 3200) {
    const t = el('div', { class: 'hud-toast' }, [text]);
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 400);
    }, ms);
  }

  /** needs: [{ id, label, value 0..1 }] — only low ones are shown. */
  setNeeds(list) {
    const low = list.filter((n) => n.value < 0.3);
    const key = low.map((n) => `${n.id}:${Math.round(n.value * 20)}`).join(',');
    if (key === this._needKey) return;
    this._needKey = key;
    this.needs.replaceChildren(
      ...low.map((n) =>
        el('div', { class: `hud-need${n.value < 0.12 ? ' bad' : ''}` }, [el('span', {}, [n.label]), el('span', { class: 'bar' }, [el('i', { style: `width:${Math.round(n.value * 100)}%` })])]),
      ),
    );
  }

  subtitle(who, text, seconds = 3) {
    if (settings.get('subtitles') === false) return;
    this.sub.replaceChildren(...(who ? [el('b', {}, [`${who}: `])] : []), document.createTextNode(text));
    this._subT = seconds;
  }

  setClock(text) {
    if (this.clockEl.textContent !== text) this.clockEl.textContent = text;
  }

  update(dt) {
    // Mouse not locked (start of the game, after Esc / a menu): say how to get it back.
    const showClick = !device.isTouch && input.wantPointerLock && !input.pointerLocked && this.dot.style.display !== 'none';
    if (showClick !== this._clickShown) {
      this._clickShown = showClick;
      this.clickHint.classList.toggle('on', showClick);
    }
    if (this._subT > 0) {
      this._subT -= dt;
      if (this._subT <= 0) this.sub.replaceChildren();
    }
  }

  dispose() {
    this.root.remove();
  }
}
