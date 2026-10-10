// Table controls (DOM, inside the Station's UI layer): clay-chip action buttons with key hints, a
// brass status plaque, toasts and small card-table panels (cash change, wheel-chip buy-in).
// Every press clicks (ui.* sounds) and everything is reachable by mouse, keys and touch.
import { injectStyle } from '../../../core/util.js';
import { uiSound, vary } from '../../../ui/sfx.js';

const CSS = `
.tbl-ui { position:absolute; inset:0; pointer-events:none; font-family: Inter, system-ui, sans-serif; color:#f4ead2; }
.tbl-bar { position:absolute; left:50%; bottom:max(14px, env(safe-area-inset-bottom)); transform:translateX(-50%);
  display:flex; gap:10px; align-items:flex-end; pointer-events:auto; max-width:calc(100vw - 24px); flex-wrap:wrap; justify-content:center; }
.tbl-btn { all:unset; box-sizing:border-box; cursor:pointer; position:relative; width:76px; height:76px; border-radius:50%;
  display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
  font: 400 19px/1 "Bebas Neue", Inter, sans-serif; letter-spacing:.06em; color:#fff;
  background:
    radial-gradient(circle at 50% 50%, var(--in) 0 52%, transparent 53%),
    repeating-conic-gradient(from 8deg, var(--spot) 0 18deg, var(--base) 18deg 60deg);
  box-shadow: 0 0 0 2px rgba(0,0,0,.55), 0 6px 0 rgba(0,0,0,.45), 0 10px 18px rgba(0,0,0,.45), inset 0 2px 2px rgba(255,255,255,.35), inset 0 -3px 5px rgba(0,0,0,.35);
  text-shadow: 0 1px 0 rgba(0,0,0,.5); transition: transform .12s ease, filter .12s ease, opacity .2s ease;
  --base:#a51c25; --spot:#f3ead6; --in:#8e141c; }
.tbl-btn::before { content:''; position:absolute; inset:9px; border-radius:50%; border:1.5px dashed rgba(255,240,210,.45); pointer-events:none; }
.tbl-btn .k { font: 600 10px/1 Inter, system-ui, sans-serif; letter-spacing:.08em; opacity:.75; margin-top:4px; }
.tbl-btn:hover, .tbl-btn:focus-visible { transform: translateY(-3px); filter: brightness(1.12); }
.tbl-btn:active { transform: translateY(3px); box-shadow: 0 0 0 2px rgba(0,0,0,.55), 0 2px 0 rgba(0,0,0,.45), 0 4px 8px rgba(0,0,0,.45), inset 0 2px 2px rgba(255,255,255,.3); }
.tbl-btn[disabled] { opacity:.32; pointer-events:none; filter:saturate(.4); }
.tbl-btn.green { --base:#1c7a3b; --spot:#f3ead6; --in:#14602d; }
.tbl-btn.black { --base:#1d1d20; --spot:#efe7d2; --in:#141416; }
.tbl-btn.blue { --base:#2b58a8; --spot:#efe7d2; --in:#20447f; }
.tbl-btn.gold { --base:#c99a2e; --spot:#2a1d08; --in:#a67a1c; color:#1e1405; text-shadow:none; }
.tbl-btn.purple { --base:#5a2a8a; --spot:#f2d24a; --in:#46206c; }
.tbl-btn.small { width:60px; height:60px; font-size:15px; }
.tbl-btn.small::before { inset:7px; }
.tbl-btn.wide { width:auto; min-width:96px; height:48px; border-radius:24px; padding:0 16px;
  background: linear-gradient(180deg, #f2d78c, #c39a3e 55%, #9c7425); color:#2a1a06; text-shadow:none; }
.tbl-btn.wide::before { inset:4px; border-radius:20px; border-color: rgba(60,40,10,.35); }
.tbl-plaque { position:absolute; top:max(12px, env(safe-area-inset-top)); left:50%; transform:translateX(-50%); pointer-events:none;
  padding:7px 16px 8px; border-radius:12px; background: linear-gradient(180deg, rgba(26,18,10,.82), rgba(12,8,5,.82));
  box-shadow: 0 0 0 1px rgba(216,178,90,.55), 0 8px 20px rgba(0,0,0,.4); text-align:center; white-space:nowrap; }
.tbl-plaque .t { font: 700 14px/1.1 "Playfair Display", Georgia, serif; color:#e8cf8a; letter-spacing:.04em; }
.tbl-plaque .s { font: 500 11px/1.3 Inter, sans-serif; color:#d9cdb0; opacity:.85; }
.tbl-status { position:absolute; left:50%; bottom:calc(max(14px, env(safe-area-inset-bottom)) + 92px); transform:translateX(-50%);
  display:flex; gap:8px; pointer-events:none; flex-wrap:wrap; justify-content:center; max-width:calc(100vw - 24px); }
.tbl-pill { padding:5px 11px 6px; border-radius:999px; background: rgba(10,8,6,.66); box-shadow: 0 0 0 1px rgba(216,178,90,.4);
  font: 600 13px/1.1 Inter, sans-serif; color:#f3e7c6; white-space:nowrap; }
.tbl-pill b { color:#f2d27a; font-weight:700; }
.tbl-pill.hl { background: rgba(120,22,28,.8); box-shadow: 0 0 0 1px rgba(255,210,150,.6); }
.tbl-hint { position:absolute; left:50%; top:calc(max(12px, env(safe-area-inset-top)) + 52px); transform:translateX(-50%); pointer-events:none;
  font: 500 12px/1.3 Inter, sans-serif; color:#efe3c4; opacity:.8; text-shadow:0 1px 2px rgba(0,0,0,.8); text-align:center; max-width:90vw; }
.tbl-toast { position:absolute; left:50%; top:38%; transform:translate(-50%,-50%) scale(.96); pointer-events:none; opacity:0;
  padding:10px 18px; border-radius:12px; background: rgba(20,10,8,.88); box-shadow: 0 0 0 1px rgba(216,178,90,.6), 0 10px 30px rgba(0,0,0,.5);
  font: 600 15px/1.2 Inter, sans-serif; color:#f6e6c0; transition: opacity .2s ease, transform .2s ease; }
.tbl-toast.in { opacity:1; transform:translate(-50%,-50%) scale(1); }
.tbl-panel { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); pointer-events:auto; width:min(420px, calc(100vw - 28px));
  padding:18px 18px 16px; border-radius:26px; box-sizing:border-box;
  background: radial-gradient(90% 70% at 50% 30%, #1d7a51 0%, #136140 50%, #0b3f29 100%);
  box-shadow: 0 0 0 3px #c9a24f, 0 0 0 7px #3e1111, 0 0 0 9px #6b4424, 0 30px 60px rgba(0,0,0,.6); text-align:center; }
.tbl-panel h3 { margin:0 0 4px; font: 700 20px/1.2 "Playfair Display", Georgia, serif; color:#f2d688; }
.tbl-panel .sub { font: 500 12px/1.3 Inter, sans-serif; color:#e6dcc0; opacity:.85; margin-bottom:12px; }
.tbl-panel .row { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin:8px 0; }
.tbl-panel .lbl { font: 600 11px/1 Inter, sans-serif; letter-spacing:.1em; text-transform:uppercase; color:#e8cf8a; opacity:.85; margin-top:10px; }
.tbl-seg { all:unset; cursor:pointer; padding:9px 13px; border-radius:10px; font: 600 14px/1 Inter, sans-serif; color:#f4ead2;
  background: rgba(0,0,0,.25); box-shadow: inset 0 0 0 1.5px rgba(242,214,140,.4); }
.tbl-seg[aria-pressed="true"] { background: linear-gradient(180deg, #f2d78c, #c39a3e); color:#2a1a06; box-shadow:none; }
.tbl-seg[disabled] { opacity:.35; pointer-events:none; }
@media (max-width: 640px) {
  .tbl-btn { width:62px; height:62px; font-size:16px; }
  .tbl-btn::before { inset:7px; }
  .tbl-btn.small { width:52px; height:52px; font-size:13px; }
  .tbl-status { bottom: calc(max(14px, env(safe-area-inset-bottom)) + 140px); }
  .tbl-bar { bottom: calc(max(14px, env(safe-area-inset-bottom)) + 52px); gap:7px; }
}
`;

export function ensureTableStyles() {
  injectStyle('tbl-ui-css', CSS);
}

export function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** A clay-chip button. `key` = keyboard hint shown under the label. */
export function chipButton(label, onClick, { color = '', key = '', small = false, wide = false } = {}) {
  const b = h('button', `tbl-btn ${color}${small ? ' small' : ''}${wide ? ' wide' : ''}`);
  b.type = 'button';
  const l = h('span', '', label);
  b.append(l);
  if (key) b.append(h('span', 'k', key));
  b.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && uiSound('ui.hover', { rate: vary(0.08), gain: 0.4 }));
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    uiSound('ui.chip-place', { rate: vary() });
    onClick?.();
  });
  b.setLabel = (t) => (l.textContent = t);
  return b;
}

export function segButton(label, onClick) {
  const b = h('button', 'tbl-seg', label);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    uiSound('ui.click', { rate: vary() });
    onClick?.();
  });
  return b;
}

/** Controller for one table's UI layer. */
export class TableUI {
  constructor(root) {
    ensureTableStyles();
    this.root = h('div', 'tbl-ui');
    root.append(this.root);
    this.plaque = h('div', 'tbl-plaque');
    this.plaqueT = h('div', 't');
    this.plaqueS = h('div', 's');
    this.plaque.append(this.plaqueT, this.plaqueS);
    this.hintEl = h('div', 'tbl-hint');
    this.status = h('div', 'tbl-status');
    this.bar = h('div', 'tbl-bar');
    this.toastEl = h('div', 'tbl-toast');
    this.root.append(this.plaque, this.hintEl, this.status, this.bar, this.toastEl);
    this.panelEl = null;
    this._toastT = null;
  }

  setPlaque(title, sub) {
    this.plaqueT.textContent = title;
    this.plaqueS.textContent = sub || '';
  }

  hint(text) {
    this.hintEl.textContent = text || '';
  }

  /** Replace the action bar with these buttons. */
  setButtons(list) {
    this.bar.replaceChildren(...list.filter(Boolean));
  }

  /** Status pills: [{ text (html-safe pieces via b), hl }]. */
  setStatus(items) {
    this.status.replaceChildren(
      ...items.filter(Boolean).map((it) => {
        const p = h('div', `tbl-pill${it.hl ? ' hl' : ''}`);
        if (it.label) {
          p.append(document.createTextNode(`${it.label} `));
          const b = h('b', '', it.value);
          p.append(b);
        } else p.textContent = it.value;
        return p;
      })
    );
  }

  toast(text, ms = 1800) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('in');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('in'), ms);
  }

  /** A small card-table panel; returns its element (closePanel() removes it). */
  panel(title, sub) {
    this.closePanel();
    const p = h('div', 'tbl-panel');
    p.append(h('h3', '', title));
    if (sub) p.append(h('div', 'sub', sub));
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.append(p);
    this.panelEl = p;
    return p;
  }

  closePanel() {
    this.panelEl?.remove();
    this.panelEl = null;
  }

  dispose() {
    clearTimeout(this._toastT);
    this.root.remove();
  }
}
