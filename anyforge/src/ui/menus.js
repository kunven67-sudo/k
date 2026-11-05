// Menus are written once as plain lists (spec) and drawn two ways: as GS3-kit HTML on PC, and on a floating
// panel in VR (ui/vrpanel.js). Same buttons, same order, same behavior.
import { game } from '../game.js';

const root = () => document.getElementById('menus');
export const stack = [];
let nav = null;
const listeners = [];
export function onMenuChange(f) { listeners.push(f); }
export function isOpen() { return stack.length > 0; }
export function top() { return stack[stack.length - 1] || null; }

export function open(menu) {
  stack.push(menu);
  render();
  game.sound('ui_open', null, 0.5);
  listeners.forEach((f) => f());
}
export function close() {
  const m = stack.pop();
  if (m && m.onClose) m.onClose();
  render();
  game.sound('ui_back', null, 0.5);
  listeners.forEach((f) => f());
}
export function closeAll() {
  while (stack.length) { const m = stack.pop(); if (m.onClose) m.onClose(); }
  render();
  listeners.forEach((f) => f());
}
export function replace(menu) { stack.pop(); stack.push(menu); render(); listeners.forEach((f) => f()); }
export function refresh() { render(true); listeners.forEach((f) => f()); }

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function render(keepFocus) {
  const r = root();
  let focusIdx = -1;
  if (keepFocus && nav && nav.current()) {
    const all = [...r.querySelectorAll('.gs3-item, .gs3-btn, .gs3-toggle, .gs3-slider, [data-gs3-nav]')];
    focusIdx = all.indexOf(nav.current());
  }
  const scrollEl = r.querySelector('.gs3-panel');
  const scroll = scrollEl ? scrollEl.scrollTop : 0;
  if (nav) { nav.stop(); nav = null; }
  r.textContent = '';
  const m = top();
  if (!m || game.inVR) return;
  const screen = el('div', 'gs3-screen' + (m.cls ? ' ' + m.cls : ''));
  const panel = el('div', 'gs3-panel' + (m.wide ? ' wide' : ''));
  screen.appendChild(panel);
  if (m.logo) { const lg = el('div', 'logo'); lg.innerHTML = 'ANY<b>FORGE</b>'; panel.appendChild(lg); }
  else if (m.title) panel.appendChild(el('h1', 'gs3-title', m.title));
  if (m.sub) panel.appendChild(el('p', 'gs3-sub', m.sub));
  let menuBox = null;
  const box = () => { if (!menuBox) { menuBox = el('div', 'gs3-menu'); panel.appendChild(menuBox); } return menuBox; };
  for (const it of m.items()) {
    if (!it) continue;
    switch (it.type) {
      case 'heading': menuBox = null; panel.appendChild(el('div', 'af-h', it.text)); break;
      case 'note': panel.appendChild(el('p', 'af-note', it.text)); break;
      case 'button': {
        const b = el('button', 'gs3-item', it.label);
        if (it.value != null) { const v = el('span', 'gs3-value', it.value); b.appendChild(v); }
        if (it.disabled) b.disabled = true;
        b.onclick = () => { game.sound('ui_click', null, 0.5); it.on(); };
        box().appendChild(b);
        break;
      }
      case 'toggle': {
        const row = el('div', 'gs3-item', it.label);
        const t = el('button', 'gs3-toggle');
        t.setAttribute('aria-pressed', it.get() ? 'true' : 'false');
        t.setAttribute('aria-label', it.label);
        t.setAttribute('data-manual', '');
        const flip = () => { it.set(!it.get()); t.setAttribute('aria-pressed', it.get() ? 'true' : 'false'); game.sound('ui_toggle', null, 0.5); if (it.refresh) refresh(); };
        t.onclick = (e) => { e.stopPropagation(); flip(); };
        row.onclick = flip;
        row.appendChild(t);
        box().appendChild(row);
        break;
      }
      case 'slider': {
        const row = el('div', 'gs3-item', it.label);
        const s = el('input', 'gs3-slider');
        s.type = 'range'; s.min = it.min; s.max = it.max; s.step = it.step; s.value = it.get();
        const num = el('span', 'af-num', fmt(it, it.get()));
        s.oninput = () => { it.set(Number(s.value)); num.textContent = fmt(it, Number(s.value)); };
        s.onchange = () => { game.sound('ui_click', null, 0.3); if (it.refresh) refresh(); };
        row.appendChild(s); row.appendChild(num);
        box().appendChild(row);
        break;
      }
      case 'choice': {
        const row = el('div', 'gs3-item', it.label);
        const wrap = el('div', 'af-choice');
        for (const [v, l] of it.options) {
          const b = el('button', 'gs3-btn' + (it.get() === v ? ' sel' : ''), l);
          b.onclick = (e) => { e.stopPropagation(); it.set(v); game.sound('ui_click', null, 0.5); refresh(); };
          wrap.appendChild(b);
        }
        row.appendChild(wrap);
        box().appendChild(row);
        break;
      }
      case 'swatches': {
        const row = el('div', 'gs3-item', it.label);
        const wrap = el('div', 'af-swatches');
        for (const c of it.colors) {
          const b = el('button', 'af-sw' + (String(it.get()).toLowerCase() === c.toLowerCase() ? ' sel' : ''));
          b.style.background = c;
          b.setAttribute('data-gs3-nav', '');
          b.setAttribute('aria-label', c);
          b.onclick = (e) => { e.stopPropagation(); it.set(c); game.sound('ui_click', null, 0.4); refresh(); };
          wrap.appendChild(b);
        }
        row.appendChild(wrap);
        box().appendChild(row);
        break;
      }
      case 'tabs': {
        menuBox = null;
        const wrap = el('div', 'af-tabs');
        for (const [v, l] of it.tabs) {
          const b = el('button', 'gs3-btn' + (it.get() === v ? ' sel' : ''), l);
          b.onclick = () => { it.set(v); game.sound('ui_select', null, 0.4); refresh(); };
          wrap.appendChild(b);
        }
        panel.appendChild(wrap);
        break;
      }
      case 'grid': {
        menuBox = null;
        const g = el('div', 'af-grid');
        for (const t of it.tiles) {
          const b = el('button', 'af-tile' + (t.sel ? ' sel' : ''));
          b.setAttribute('data-gs3-nav', '');
          if (t.img) { const im = el('img'); im.src = t.img; im.alt = ''; b.appendChild(im); }
          b.appendChild(el('span', '', t.label));
          if (t.sub) b.appendChild(el('small', '', t.sub));
          b.title = t.tip || '';
          b.onclick = () => { game.sound('ui_ok', null, 0.4); t.on(); };
          g.appendChild(b);
        }
        panel.appendChild(g);
        break;
      }
      case 'row': {
        menuBox = null;
        const wrap = el('div', 'gs3-row');
        for (const bt of it.buttons) {
          const b = el('button', 'gs3-btn' + (bt.primary ? ' primary' : ''), bt.label);
          b.onclick = () => { game.sound('ui_click', null, 0.5); bt.on(); };
          wrap.appendChild(b);
        }
        panel.appendChild(wrap);
        break;
      }
      case 'keys': {
        menuBox = null;
        const g = el('div', 'af-keys');
        for (const [k, d] of it.rows) { g.appendChild(el('b', '', k)); g.appendChild(el('span', '', d)); }
        panel.appendChild(g);
        break;
      }
      case 'live': {
        // a line that updates by itself (heartbeat)
        const row = el('div', 'gs3-item', it.label);
        const v = el('span', 'gs3-value ' + (it.cls || ''), it.get());
        row.appendChild(v);
        box().appendChild(row);
        const tick = () => { if (!document.contains(v)) return; v.textContent = it.get(); setTimeout(tick, 250); };
        setTimeout(tick, 250);
        break;
      }
    }
  }
  r.appendChild(screen);
  panel.scrollTop = scroll;
  if (window.GS3Console) {
    const all = [...screen.querySelectorAll('.gs3-item, .gs3-btn, .gs3-toggle, .gs3-slider, [data-gs3-nav]')].filter((x) => x.getBoundingClientRect().width > 0);
    nav = window.GS3Console.nav(screen, { back: m.noBack ? null : () => close(), first: focusIdx >= 0 ? all[focusIdx] : undefined });
  }
}
function fmt(it, v) { return it.fmt ? it.fmt(v) : String(v); }
