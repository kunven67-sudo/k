// Tiny DOM helpers so the UI code stays readable.

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(3)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

// append that skips null/false (DOM append would print "null")
export function put(parent, ...kids) { for (const c of kids.flat(3)) if (c != null && c !== false) parent.append(c); return parent; }

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

export function btn(label, onClick, cls = '') {
  return h('button', { class: 'btn ' + cls, onclick: (e) => { e.stopPropagation(); onClick(e); } }, label);
}

// segmented choice: options [[value, label], ...]
export function seg(options, value, onChange) {
  const wrap = h('div', { class: 'seg' });
  const draw = (v) => {
    clear(wrap);
    for (const [val, label] of options) wrap.append(h('button', { class: v === val ? 'on' : '', onclick: () => { onChange(val); draw(val); } }, label));
  };
  draw(value);
  return wrap;
}

export function slider(min, max, step, value, onInput, fmt = (v) => v) {
  const out = h('span', { class: 'muted', style: { minWidth: '44px', display: 'inline-block', textAlign: 'right' } }, fmt(value));
  const inp = h('input', { type: 'range', min, max, step, value });
  inp.addEventListener('input', () => { const v = Number(inp.value); out.textContent = fmt(v); onInput(v); });
  return h('span', { class: 'row', style: { gap: '6px' } }, inp, out);
}

export function toggle(value, onChange) {
  return seg([[true, 'On'], [false, 'Off']], value, onChange);
}

export function setrow(label, control, hint) {
  return h('div', { class: 'setrow' }, h('div', {}, label, hint ? h('div', { class: 'muted' }, hint) : null), control);
}

export function hex(c) { return '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6); }
export function unhex(s) { return parseInt(String(s).replace('#', ''), 16); }

export function colorInput(value, onChange) {
  const inp = h('input', { type: 'color', value: hex(value), style: { width: '44px', height: '28px', border: 'none', background: 'none', cursor: 'pointer' } });
  inp.addEventListener('input', () => onChange(unhex(inp.value)));
  return inp;
}
