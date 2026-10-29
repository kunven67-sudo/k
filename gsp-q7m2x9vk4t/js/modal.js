/* Pop-up cards: menus, yes/no questions, typing a name. Keyboard + controller work in all of them. */
import { h } from './dom.js';
import { icon } from './icons.js';
import { pushHandler, moveFocus, setFocus, focusables } from './input.js';
import { Sound } from './sound.js';

const root = () => document.getElementById('modals');
const open = [];

export function anyModal() { return open.length > 0; }

export function modal(opts) {
  const box = h('div.modal' + (opts.wide ? '.wide' : ''));
  const wrap = h('div.modal-wrap' + (opts.cls ? '.' + opts.cls : ''), box);
  let cur = null;
  let closed = false;
  const api = {
    box: box,
    close: function (val) {
      if (closed) return;
      closed = true;
      off();
      wrap.remove();
      const i = open.indexOf(api);
      if (i >= 0) open.splice(i, 1);
      if (opts.onClose) opts.onClose(val);
    },
    focus: function (el) { cur = setFocus(box, el); },
    refocus: function () {
      const list = focusables(box);
      if (!cur || list.indexOf(cur) < 0) cur = setFocus(box, box.querySelector('[data-default]') || list[0] || null);
    }
  };
  if (opts.title) box.appendChild(h('h2', opts.title));
  if (opts.lead) box.appendChild(h('p.lead', opts.lead));
  if (opts.body) box.appendChild(opts.body);
  if (opts.actions && opts.actions.length) {
    const row = h('div.actions');
    opts.actions.forEach(function (a) {
      const b = h('button.btn' + (a.kind ? '.' + a.kind : ''), { 'data-f': '', 'data-default': a.default ? '' : null, onclick: function () {
        Sound.press();
        const r = a.onClick ? a.onClick(api) : undefined;
        if (r !== false) api.close(a.value);
      } }, a.icon ? h('span', { html: icon(a.icon) }) : null, a.label);
      row.appendChild(b);
    });
    box.appendChild(row);
  }
  wrap.addEventListener('pointerdown', function (e) { if (e.target === wrap && opts.dismissible !== false) { Sound.back(); api.close(); } });
  box.addEventListener('mousemove', function (e) {
    const el = e.target.closest('[data-f]');
    if (el && el !== cur && box.contains(el)) cur = setFocus(box, el);
  });
  const off = pushHandler(function (action, ev) {
    if (opts.onKey && opts.onKey(action, ev, api) === true) return true;
    if (action === 'back') {
      if (opts.dismissible === false) return true;
      Sound.back();
      api.close();
      return true;
    }
    if (action === 'ok') {
      if (cur && cur.tagName === 'INPUT' && cur.type === 'text') { if (opts.onEnter) opts.onEnter(api); return true; }
      if (cur) { cur.click(); }
      return true;
    }
    if (/^(up|down|left|right)$/.test(action)) {
      if (cur && cur.type === 'range' && (action === 'left' || action === 'right')) {
        cur.value = Number(cur.value) + (action === 'left' ? -1 : 1) * Number(cur.step || 1);
        cur.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      const next = moveFocus(box, cur, action);
      if (next) { cur = setFocus(box, next); Sound.move(); }
      return true;
    }
    return true; /* nothing behind a pop-up reacts */
  });
  root().appendChild(wrap);
  open.push(api);
  Sound.open();
  requestAnimationFrame(function () { api.refocus(); });
  return api;
}

export function confirm(opts) {
  return new Promise(function (resolve) {
    modal({
      title: opts.title, lead: opts.text, body: opts.body,
      onClose: function (v) { resolve(v === true); },
      actions: [
        { label: opts.no || 'Cancel', value: false, default: !opts.yesDefault },
        { label: opts.yes || 'OK', value: true, kind: opts.danger ? 'danger' : 'primary', default: !!opts.yesDefault, icon: opts.yesIcon }
      ]
    });
  });
}

export function alertBox(title, text) {
  return new Promise(function (resolve) {
    modal({ title: title, lead: text, onClose: function () { resolve(); }, actions: [{ label: 'OK', kind: 'primary', default: true }] });
  });
}

export function prompt(opts) {
  return new Promise(function (resolve) {
    const input = h('input.field', { type: 'text', value: opts.value || '', placeholder: opts.placeholder || '', 'data-f': '', 'data-default': '', maxlength: opts.max || 120, spellcheck: 'false' });
    let result = null;
    const m = modal({
      title: opts.title, lead: opts.text, body: input,
      onClose: function () { resolve(result); },
      onEnter: function (api) { result = input.value.trim() || null; api.close(); },
      actions: [
        { label: 'Cancel' },
        { label: opts.ok || 'Save', kind: 'primary', onClick: function () { result = input.value.trim() || null; } }
      ]
    });
    setTimeout(function () { m.focus(input); input.select(); }, 30);
  });
}

/* a list of choices; items: {label, icon, desc, danger, onClick} */
export function menu(title, items, opts) {
  const list = h('div.menu-list');
  let m = null;
  items.filter(Boolean).forEach(function (it) {
    list.appendChild(h('button.menu-item' + (it.danger ? '.danger' : ''), {
      'data-f': '',
      onclick: function () { Sound.press(); m.close(); if (it.onClick) setTimeout(it.onClick, 0); }
    }, h('span', { html: icon(it.icon || 'arrowRight') }), it.label, it.desc ? h('span.d', it.desc) : null));
  });
  m = modal({ title: title, lead: opts && opts.lead, body: list, cls: opts && opts.cls });
  return m;
}
