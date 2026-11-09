// Small DOM helpers and form controls used by every page.

// Pages build content like `cond ? el : null`. The DOM would print that as the
// text "null", so append/replaceChildren skip null, undefined and false here.
for (const name of ['append', 'replaceChildren']) {
  const raw = Element.prototype[name];
  Element.prototype[name] = function patched(...kids) {
    return raw.apply(this, kids.filter((k) => k !== null && k !== undefined && k !== false));
  };
}

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, kids);
  return el;
}

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function throttle(fn, ms) {
  let last = 0, t = null, lastArgs = null;
  return (...a) => {
    lastArgs = a;
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...a); return; }
    clearTimeout(t);
    t = setTimeout(() => { last = Date.now(); fn(...lastArgs); }, ms - (now - last));
  };
}

let toastBox = null;
export function toast(msg, kind = 'info', ms = 2600) {
  if (!toastBox) { toastBox = h('div', { class: 'toasts' }); document.body.append(toastBox); }
  const t = h('div', { class: `toast ${kind}` }, msg);
  toastBox.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

export function section(title, ...kids) {
  return h('section', { class: 'card' }, title ? h('h3', {}, title) : null, ...kids);
}

export function row(...kids) {
  return h('div', { class: 'row' }, ...kids);
}

export function toggle({ label, checked, onChange, desc, big = false }) {
  const input = h('input', { type: 'checkbox', checked: !!checked, onchange: (e) => onChange(e.target.checked) });
  return h('label', { class: `toggle${big ? ' big' : ''}` },
    input, h('span', { class: 'knob' }),
    h('span', { class: 'toggle-text' }, h('b', {}, label), desc ? h('small', {}, desc) : null));
}

export function slider({ label, min, max, step = 1, value, onInput, format = (v) => v, live = true }) {
  const out = h('output', {}, format(value));
  const input = h('input', {
    type: 'range', min, max, step, value,
    oninput: (e) => { const v = Number(e.target.value); out.textContent = format(v); if (live) onInput(v); },
    onchange: (e) => { if (!live) onInput(Number(e.target.value)); },
  });
  return h('label', { class: 'slider' }, h('span', { class: 'slider-top' }, h('span', {}, label), out), input);
}

export function select({ label, options, value, onChange }) {
  const s = h('select', { onchange: (e) => onChange(e.target.value) },
    options.map((o) => h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  return h('label', { class: 'field' }, label ? h('span', {}, label) : null, s);
}

export function colorInput({ label, value, onChange }) {
  const input = h('input', { type: 'color', value: toHex(value), oninput: (e) => onChange(e.target.value) });
  return h('label', { class: 'color-field' }, input, h('span', {}, label));
}

export function chips({ options, value, onChange, multi = false, small = false }) {
  const box = h('div', { class: `chips${small ? ' small' : ''}` });
  for (const o of options) {
    const active = multi ? value.includes(o.value) : o.value === value;
    box.append(h('button', {
      class: `chip${active ? ' active' : ''}`, type: 'button', title: o.title || '',
      onclick: () => {
        if (multi) {
          const set = new Set(value);
          if (set.has(o.value)) set.delete(o.value); else set.add(o.value);
          onChange([...set]);
        } else onChange(o.value);
      },
    }, o.emoji ? h('span', { class: 'chip-emoji' }, o.emoji) : null, o.label));
  }
  return box;
}

export function button(label, onClick, cls = '') {
  return h('button', { class: `btn ${cls}`, type: 'button', onclick: onClick }, label);
}

export function toHex(c) {
  if (!c) return '#000000';
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return `#${c.slice(1).split('').map((x) => x + x).join('')}`;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = c;
  return ctx.fillStyle.startsWith('#') ? ctx.fillStyle : '#000000';
}

export function modal(title, body, actions = []) {
  const close = () => wrap.remove();
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'modal card' },
      h('h3', {}, title),
      body,
      h('div', { class: 'modal-actions' }, actions.map(([label, fn, cls]) => button(label, () => { if (fn?.() !== false) close(); }, cls)))));
  document.body.append(wrap);
  return close;
}

export function prompt(title, placeholder = '', initial = '') {
  return new Promise((resolve) => {
    const input = h('input', { type: 'text', class: 'text', placeholder, value: initial });
    let done = false;
    const close = modal(title, input, [
      ['Cancel', () => { done = true; resolve(null); }],
      ['OK', () => { done = true; resolve(input.value.trim() || null); }, 'primary'],
    ]);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { done = true; close(); resolve(input.value.trim() || null); }
      if (e.key === 'Escape') { done = true; close(); resolve(null); }
    });
    setTimeout(() => input.focus(), 30);
    void done;
  });
}

export function confirmBox(title, text, okLabel = 'Yes') {
  return new Promise((resolve) => {
    modal(title, h('p', {}, text), [['Cancel', () => resolve(false)], [okLabel, () => resolve(true), 'danger']]);
  });
}
