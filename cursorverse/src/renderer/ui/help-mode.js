// Help mode: everything clickable gets a blue outline; clicking something
// explains it instead of doing it. Also the 🤖 help bot panel.
import { h, button } from './lib.js';
import { PAGE_HELP } from './help-data.js';
import { askBot } from './help-bot.js';
import { nav } from './nav.js';

const INTERACTIVE = [
  'button', 'a', 'input', 'select', 'textarea', 'label.toggle', '.chip', '.cur-card', '.bg-card', '.dial-tile', '.tab',
  '.swatch', '.tool', '.theme-card', '.preset', '.frame-thumb', '.slider', 'canvas.ed-canvas', 'details > summary', '.item[style*="cursor"]',
].join(',');

let on = false;
let bubble = null;
let onChange = () => {};

const clean = (t) => String(t || '').replace(/[^\p{L}\p{N}\s'+/-]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const textOf = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

function currentPage() {
  return document.querySelector('#side button.active')?.dataset.id || 'home';
}

// Best matching entry in the page's help for a control's label.
function findItem(label, pageId) {
  const l = clean(label);
  if (!l || l.length < 2) return null;
  let best = null;
  const pages = [pageId, ...Object.keys(PAGE_HELP).filter((p) => p !== pageId)];
  for (const [i, id] of pages.entries()) {
    for (const [name, what] of PAGE_HELP[id]?.items || []) {
      const n = clean(name), w = clean(what);
      if (n.length < 2) continue; // all-emoji names would match everything
      let sc = 0;
      if (n === l) sc = 10;
      else if (n.includes(l) || l.includes(n)) sc = 7;
      else if (w.includes(l)) sc = 4;
      if (i > 0) sc -= 3; // prefer the page you're on
      if (sc > (best?.sc || 0)) best = { name, what, sc, page: id };
    }
  }
  return best && best.sc >= 4 ? best : null;
}

export function explain(el) {
  const pageId = currentPage();
  const sectionTitle = textOf(el.closest('section.card')?.querySelector('h3'));
  const where = sectionTitle ? `In the "${sectionTitle}" box.` : '';
  if (el.dataset?.help) return { name: textOf(el) || 'This', text: el.dataset.help, where };

  const side = el.closest('#side button');
  if (side) {
    const p = PAGE_HELP[side.dataset.id];
    return { name: textOf(side), text: p ? `${p.what} Click it to open that page.` : 'Opens that page.', where: 'Left menu.' };
  }
  if (el.closest('#quick')) {
    const b = el.closest('.qbtn, button');
    return { name: textOf(b) || 'Quick switch', text: `${b?.title || 'A quick switch'}. Always here at the top, on every page.`, where: 'Top bar.' };
  }
  const card = el.closest('.cur-card');
  if (card) {
    const name = textOf(card.querySelector('.name'));
    return { name, text: `The "${name}" cursor. Click it to use it on your whole PC right away.${card.querySelector('.badge') ? ' ANIM = it moves by itself.' : ''}`, where };
  }
  const toggle = el.closest('label.toggle');
  if (toggle) {
    const name = textOf(toggle.querySelector('b'));
    const desc = textOf(toggle.querySelector('small'));
    const item = findItem(name, pageId);
    return { name: name || 'Switch', text: `An on/off switch. ${item ? item.what : desc || ''}`.trim(), where };
  }
  const slider = el.closest('.slider');
  if (slider) {
    const name = textOf(slider.querySelector('.slider-top span'));
    const item = findItem(name, pageId);
    return { name, text: `Drag it to change "${name}". ${item ? item.what : ''}`.trim(), where };
  }
  if (el.matches('select') || el.closest('select')) {
    const label = textOf(el.closest('label')?.querySelector('span'));
    const item = findItem(label, pageId);
    return { name: label || 'Drop-down list', text: `Pick an option from the list. ${item ? item.what : ''}`.trim(), where };
  }
  if (el.matches('input, textarea')) {
    const ph = el.getAttribute('placeholder') || '';
    const item = findItem(ph, pageId);
    return { name: ph || 'Text box', text: item ? item.what : `Type here${ph ? `: ${ph.toLowerCase()}` : ''}.`, where };
  }
  const target = el.closest(INTERACTIVE) || el;
  const label = target.title || textOf(target);
  const item = findItem(label, pageId) || (sectionTitle ? findItem(sectionTitle, pageId) : null);
  if (item) return { name: label, text: item.what, where };
  if (target.matches('.chip')) return { name: label, text: `One of the choices${sectionTitle ? ` for "${sectionTitle}"` : ''}. The glowing one is picked. Click to pick "${label}".`, where };
  return { name: label || 'This', text: target.title && target.title !== label ? target.title : `A button. Click it to ${label ? `"${label}"` : 'use it'}.`, where };
}

function showBubble(el) {
  bubble?.remove();
  const info = explain(el);
  const r = el.getBoundingClientRect();
  bubble = h('div', { class: 'help-bubble card help-exempt' },
    h('small', {}, '❓ What this does'),
    h('h3', { style: { margin: '4px 0 6px' } }, info.name.slice(0, 60)),
    h('p', { style: { margin: '0 0 6px' } }, info.text),
    info.where ? h('small', { class: 'muted' }, info.where) : null,
    h('div', { class: 'row', style: { marginTop: '10px', justifyContent: 'space-between' } },
      h('small', { class: 'muted' }, 'Click another blue thing, or'),
      button('Exit help mode', () => setHelpMode(false), 'small primary')));
  document.body.append(bubble);
  const bw = 320, bh = bubble.offsetHeight;
  const left = Math.min(Math.max(8, r.left), innerWidth - bw - 8);
  const top = r.bottom + 10 + bh < innerHeight ? r.bottom + 10 : Math.max(8, r.top - bh - 10);
  Object.assign(bubble.style, { left: `${left}px`, top: `${top}px` });
  document.querySelectorAll('.help-picked').forEach((x) => x.classList.remove('help-picked'));
  el.classList.add('help-picked');
}

// Capture-phase guard: in help mode, clicks explain instead of acting.
function guard(e) {
  if (!on) return;
  if (e.target.closest?.('.help-exempt, #help-mode-btn')) return;
  if (e.type === 'keydown') {
    if (e.key === 'Escape') setHelpMode(false);
    return;
  }
  const el = e.target.closest?.(INTERACTIVE);
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if (e.type === 'click') showBubble(el.closest('label.toggle, .slider, .cur-card, .bg-card, .dial-tile') || el);
}

export function setHelpMode(v) {
  on = !!v;
  document.body.classList.toggle('help-mode', on);
  if (!on) {
    bubble?.remove();
    bubble = null;
    document.querySelectorAll('.help-picked').forEach((x) => x.classList.remove('help-picked'));
  }
  onChange(on);
}

export function isHelpMode() { return on; }

export function initHelpMode(changed) {
  onChange = changed || onChange;
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'change', 'input', 'focusin']) {
    document.addEventListener(type, guard, true);
  }
  document.addEventListener('keydown', guard, true);
}

// ------------------------------------------------------------------ help bot

export function botPanel({ floating = false } = {}) {
  const log = h('div', { class: 'bot-log' });
  const say = (who, text, extra = []) => {
    log.append(h('div', { class: `bot-msg ${who}` },
      h('div', { class: 'bot-text' }, ...String(text).split('**').map((part, i) => (i % 2 ? h('b', {}, part) : part))),
      ...extra));
    log.scrollTop = log.scrollHeight;
  };
  const input = h('input', { class: 'text', placeholder: 'Ask anything, like "how do I make my cursor bigger?"' });
  const send = () => {
    const q = input.value.trim();
    if (!q) return;
    input.value = '';
    say('me', q);
    const a = askBot(q);
    setTimeout(() => say('bot', a.heading ? `${a.heading}\n${a.text}` : a.text,
      a.related.length ? [h('div', { class: 'row', style: { marginTop: '6px' } }, a.related.map((r) => button(`Go to ${r.title}`, () => nav.go(r.page), 'small')))] : []), 150);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  say('bot', "Yo bro 👋 I'm the CursorVerse help bot. Ask me how to do anything in here.");
  return h('div', { class: `bot-panel help-exempt${floating ? ' floating card' : ''}` },
    floating ? h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, '🤖 Help bot'), button('✕', () => document.querySelector('.bot-panel.floating')?.remove(), 'small')) : null,
    log,
    h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, input, button('Ask', send, 'primary')),
    h('small', { class: 'muted' }, 'Works offline. It answers from CursorVerse\'s own help.'));
}

export function toggleBotPanel() {
  const open = document.querySelector('.bot-panel.floating');
  if (open) { open.remove(); return; }
  const p = botPanel({ floating: true });
  document.body.append(p);
  p.querySelector('input').focus();
}
