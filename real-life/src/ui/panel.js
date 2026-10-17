// Modal panels (fridge contents, checkout, receipt, pockets, talk...). While a panel is open the
// mouse is free and the player can't move. Esc / the X closes the top panel.
//
//   const p = openPanel({ title, sub, body: Node | () => Node, buttons: [{ text, kind, onClick }], wide, onClose })
//   p.setBody(node) / p.close()

import { el, injectStyle } from '../core/util.js';
import { input } from '../core/input.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';

injectStyle('panel', `
.rl-scrim { position: fixed; inset: 0; z-index: 40; display: grid; place-items: center; background: rgba(10,10,14,.35); backdrop-filter: blur(2px);
  animation: rlFade .18s ease both; pointer-events: auto; }
.rl-panel { width: min(440px, 92vw); max-height: 86vh; display: flex; flex-direction: column; background: var(--paper); color: var(--ink);
  border-radius: 20px; box-shadow: 0 24px 60px rgba(0,0,0,.45); overflow: hidden; font-family: var(--font-ui); animation: rlPop .22s cubic-bezier(.2,1.2,.4,1) both; }
.rl-panel.wide { width: min(720px, 94vw); }
.rl-head { display: flex; align-items: center; gap: 10px; padding: 16px 18px 10px; }
.rl-head h2 { margin: 0; font: 600 20px/1.1 var(--font-round); flex: 1; }
.rl-head .sub { display: block; font: 500 13px var(--font-ui); color: var(--muted); margin-top: 3px; }
.rl-x { width: 32px; height: 32px; border-radius: 10px; border: 0; background: var(--paper-2); color: var(--ink); font: 700 16px var(--font-ui); cursor: pointer; }
.rl-x:hover { background: #e4dccc; }
.rl-body { padding: 4px 18px 14px; overflow: auto; }
.rl-foot { display: flex; gap: 8px; padding: 12px 18px 16px; border-top: 1px solid #e8e1d3; flex-wrap: wrap; }
.rl-btn { flex: 1; min-width: 110px; padding: 11px 14px; border-radius: 12px; border: 0; cursor: pointer; font: 600 14px var(--font-ui);
  background: var(--paper-2); color: var(--ink); transition: transform .08s ease, background .12s ease; }
.rl-btn:hover { background: #e4dccc; }
.rl-btn:active { transform: translateY(1px); }
.rl-btn.go { background: var(--accent); color: #fff; }
.rl-btn.go:hover { background: #f06a48; }
.rl-btn.dim { opacity: .5; pointer-events: none; }
.rl-list { display: flex; flex-direction: column; gap: 6px; }
.rl-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 12px; background: #fff; border: 1px solid #eee6d6; }
.rl-row .name { flex: 1; font: 500 14px var(--font-ui); }
.rl-row .meta { font: 500 12px var(--font-ui); color: var(--muted); }
.rl-row button { padding: 7px 11px; border-radius: 9px; border: 0; cursor: pointer; font: 600 13px var(--font-ui); background: var(--ink); color: #fff; }
.rl-row button.soft { background: var(--paper-2); color: var(--ink); }
.rl-row button:disabled { opacity: .35; cursor: default; }
.rl-empty { padding: 18px; text-align: center; color: var(--muted); font: 500 14px var(--font-ui); }
.rl-note { font: 500 13px/1.4 var(--font-ui); color: #5c5764; margin: 6px 0 10px; }
@keyframes rlFade { from { opacity: 0; } }
@keyframes rlPop { from { opacity: 0; transform: translateY(10px) scale(.97); } }
`);

const stack = [];

export function panelOpen() {
  return stack.length > 0;
}

export function openPanel({ title = '', sub = '', body = null, buttons = [], wide = false, onClose = null, closable = true, className = '' } = {}) {
  const scrim = el('div', { class: 'rl-scrim' });
  const panel = el('div', { class: `rl-panel${wide ? ' wide' : ''} ${className}` });
  const head = el('div', { class: 'rl-head' }, [el('h2', {}, [title, sub ? el('span', { class: 'sub' }, [sub]) : null])]);
  if (closable) head.appendChild(el('button', { class: 'rl-x', onclick: () => api.close(), 'aria-label': 'Close' }, ['✕']));
  const bodyEl = el('div', { class: 'rl-body' });
  const foot = el('div', { class: 'rl-foot' });
  panel.append(head, bodyEl, foot);
  scrim.appendChild(panel);
  scrim.addEventListener('pointerdown', (e) => {
    if (e.target === scrim && closable) api.close();
  });
  document.getElementById('ui-root').appendChild(scrim);
  const api = {
    el: panel,
    closed: false,
    setBody(node) {
      bodyEl.replaceChildren(...[].concat(typeof node === 'function' ? node() : node).filter(Boolean));
    },
    setButtons(list) {
      foot.replaceChildren(
        ...list.map((b) =>
          el('button', { class: `rl-btn ${b.kind || ''} ${b.disabled ? 'dim' : ''}`, onclick: () => b.onClick?.(api) }, [b.text]),
        ),
      );
      foot.style.display = list.length ? '' : 'none';
    },
    setTitle(t, s) {
      head.querySelector('h2').replaceChildren(t, s ? el('span', { class: 'sub' }, [s]) : '');
    },
    close() {
      if (api.closed) return;
      api.closed = true;
      scrim.remove();
      const i = stack.indexOf(api);
      if (i >= 0) stack.splice(i, 1);
      if (!stack.length) {
        input.setPointerLock?.(true);
        bus.emit('panel:closed');
      }
      onClose?.();
    },
  };
  if (body) api.setBody(body);
  api.setButtons(buttons);
  stack.push(api);
  input.setPointerLock?.(false);
  document.exitPointerLock?.();
  audio.play?.('ui.open', { gain: 0.5 });
  bus.emit('panel:opened');
  return api;
}

export function closeTopPanel() {
  const top = stack[stack.length - 1];
  if (top) {
    top.close();
    return true;
  }
  return false;
}

/** A row: name + meta + optional buttons [{ text, onClick, soft, disabled }]. */
export function row(name, meta, buttons = []) {
  return el('div', { class: 'rl-row' }, [
    el('div', { class: 'name' }, [name, meta ? el('div', { class: 'meta' }, [meta]) : null]),
    ...buttons.map((b) => el('button', { class: b.soft ? 'soft' : '', disabled: b.disabled ? true : null, onclick: b.onClick }, [b.text])),
  ]);
}
