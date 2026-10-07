// Shared front-end components (card-table look, see styles.js). Every interactive piece plays a
// sound on hover/press and is reachable by mouse, keyboard and touch. Text comes from callers
// (already translated with t()).

import { el } from '../core/util.js';
import { ensureStyles } from './styles.js';
import { uiSound, vary } from './sfx.js';

// ---------------------------------------------------------------- sound helpers

let lastHover = 0;
/** Hover tick, rate-limited so sweeping the mouse across a row isn't a machine gun. */
export function hoverSound() {
  const now = performance.now();
  if (now - lastHover < 70) return;
  lastHover = now;
  uiSound('ui.hover', { rate: vary(0.08), gain: 0.5 });
}
export const clickSound = () => uiSound('ui.click', { rate: vary() });

function withSounds(node) {
  node.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && hoverSound());
  node.addEventListener('focus', () => node.matches(':focus-visible') && hoverSound());
  return node;
}

// ---------------------------------------------------------------- icons (stroked SVG, 24x24)

export const ICONS = {
  graphics: 'M3 6h18v11H3z M8 21h8 M12 17v4 M6 14l4-4 3 3 2-2 3 3',
  audio: 'M4 9v6h4l5 4V5L8 9z M16 9a4 4 0 0 1 0 6 M18.5 6.5a7.5 7.5 0 0 1 0 11',
  controls: 'M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4z M7 11v3 M5.5 12.5h3 M16 12h.01 M18 13.5h.01',
  content: 'M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z',
  voice: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z M5 11a7 7 0 0 0 14 0 M12 18v3 M8 21h8',
  language: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9 M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9',
  access: 'M12 4.5a1.5 1.5 0 1 0 0 .01 M5 8l7 1.5L19 8 M12 9.5V14 M12 14l-3 6 M12 14l3 6',
};

export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', ICONS[name] || '');
  svg.appendChild(p);
  return svg;
}

// ---------------------------------------------------------------- basic controls

/** Brass plaque button. */
export function button(label, onClick, { ghost = false, sound = 'ui.click' } = {}) {
  const b = withSounds(el('button', { class: `gx-btn${ghost ? ' ghost' : ''}`, type: 'button', text: label }));
  b.addEventListener('click', () => {
    if (sound) uiSound(sound, { rate: vary() });
    onClick?.();
  });
  return b;
}

/** On/off toggle: a chip that slides along a felt slot. */
export function toggle(value, onChange, { on = 'ON', off = 'OFF' } = {}) {
  const b = withSounds(el('button', { class: 'gx-toggle', type: 'button', role: 'switch', 'data-on': on, 'data-off': off }));
  b.appendChild(el('span', { class: 'k' }));
  const set = (v) => b.setAttribute('aria-checked', String(!!v));
  set(value);
  b.addEventListener('click', () => {
    const v = b.getAttribute('aria-checked') !== 'true';
    set(v);
    uiSound('ui.toggle', { rate: v ? 1.08 : 0.92 });
    onChange?.(v);
  });
  b.setValue = set;
  return b;
}

/** Range slider with a chip thumb and a live readout. */
export function slider({ min = 0, max = 1, step = 0.01, value = 0, format = (v) => String(v), onChange }) {
  const input = el('input', { class: 'gx-range', type: 'range', min, max, step, value });
  const out = el('output', { text: format(value) });
  const wrap = el('div', { class: 'gx-slider' }, [input, out]);
  let lastTick = 0;
  const paint = () => {
    const v = Number(input.value);
    input.style.setProperty('--p', `${((v - min) / (max - min)) * 100}%`);
    out.textContent = format(v);
  };
  paint();
  withSounds(input);
  input.addEventListener('input', () => {
    paint();
    const now = performance.now();
    if (now - lastTick > 45) {
      lastTick = now;
      // Pitch follows the value, like a dial with detents.
      uiSound('ui.slider', { rate: 0.8 + ((Number(input.value) - min) / (max - min)) * 0.5, gain: 0.6 });
    }
    onChange?.(Number(input.value));
  });
  wrap.setValue = (v) => {
    input.value = v;
    paint();
  };
  return wrap;
}

/** A row of betting spots — choose one. options: [{value, label}] */
export function segmented(options, value, onChange) {
  const wrap = el('div', { class: 'gx-seg', role: 'radiogroup' });
  const buttons = options.map((o) => {
    const b = withSounds(el('button', { type: 'button', role: 'radio', text: o.label }));
    b.addEventListener('click', () => {
      select(o.value);
      uiSound('ui.chip-place', { rate: vary(0.1) });
      onChange?.(o.value);
    });
    b.addEventListener('keydown', (e) => {
      const i = options.findIndex((x) => x.value === o.value);
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      const n = options[(i + d + options.length) % options.length];
      buttons[options.indexOf(n)].focus();
      buttons[options.indexOf(n)].click();
    });
    wrap.appendChild(b);
    return b;
  });
  const select = (v) => options.forEach((o, i) => buttons[i].setAttribute('aria-checked', String(o.value === v)));
  select(value);
  wrap.setValue = select;
  return wrap;
}

/** Labelled setting row: name + one-line explanation on the left, control on the right. */
export function row(label, desc, control) {
  const r = el('div', { class: 'gx-row' }, [
    el('div', {}, [el('div', { class: 'gx-label', text: label }), desc ? el('div', { class: 'gx-desc', text: desc }) : null].filter(Boolean)),
    el('div', { class: 'gx-ctl' }, [control]),
  ]);
  r.addEventListener('focusin', () => r.classList.add('focus'));
  r.addEventListener('focusout', () => r.classList.remove('focus'));
  return r;
}

// ---------------------------------------------------------------- chip tabs

const CHIP_COLORS = ['#b3202a', '#1f4fa3', '#1d6b3a', '#2a2a2a', '#7a2f8f', '#c26a12', '#0f7c86'];

/** Clay casino chips as tabs. tabs: [{id, label, icon}] → element with .select(id) */
export function chipTabs(tabs, onSelect) {
  const bar = el('div', { class: 'gx-tabs', role: 'tablist' });
  const items = tabs.map((tab, i) => {
    const chip = el('span', { class: 'gx-chip', style: { '--c': CHIP_COLORS[i % CHIP_COLORS.length] } }, [icon(tab.icon)]);
    chip.style.setProperty('--c', CHIP_COLORS[i % CHIP_COLORS.length]);
    const b = withSounds(el('button', { class: 'gx-tab', type: 'button', role: 'tab' }, [chip, el('span', { class: 'gx-tab-label', text: tab.label })]));
    b.addEventListener('click', () => {
      if (b.getAttribute('aria-selected') === 'true') return;
      uiSound('ui.chip-place', { rate: vary(0.12) });
      select(tab.id);
      onSelect?.(tab.id);
    });
    bar.appendChild(b);
    return b;
  });
  const select = (id) =>
    items.forEach((b, i) => {
      const on = tabs[i].id === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    });
  // Arrow keys / Q-E cycle tabs (roving tabindex, like a real tab strip).
  bar.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const cur = items.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    const next = items[(cur + d + items.length) % items.length];
    next.focus();
    next.click();
  });
  bar.select = select;
  bar.cycle = (d) => {
    const cur = items.findIndex((b) => b.getAttribute('aria-selected') === 'true');
    items[(cur + d + items.length) % items.length].click();
  };
  return bar;
}

// ---------------------------------------------------------------- overlays

/** Dimmed, blurred full-screen layer. Escape / backdrop click call onDismiss. */
export function overlay(root, { onDismiss, className = '' } = {}) {
  ensureStyles();
  const node = el('div', { class: `gx-overlay ${className}` });
  root.appendChild(node);
  requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('in')));
  const onKey = (e) => {
    if (e.key === 'Escape' && onDismiss && node.isConnected && node === root.lastElementChild) {
      e.preventDefault();
      e.stopPropagation();
      onDismiss();
    }
  };
  window.addEventListener('keydown', onKey, true);
  node.addEventListener('pointerdown', (e) => e.target === node && onDismiss?.());
  return {
    el: node,
    close() {
      window.removeEventListener('keydown', onKey, true);
      node.classList.remove('in');
      node.classList.add('out');
      setTimeout(() => node.remove(), 320);
    },
  };
}

/**
 * Dealer's-card message. actions: [{label, value, ghost}] → Promise<value> (null when dismissed).
 * `body` may contain *emphasis*.
 */
export function showCard(root, { title, body, foot, actions = [], suit = '♦' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      ov.close();
      resolve(v);
    };
    const ov = overlay(root, {
      onDismiss: () => {
        uiSound('ui.back');
        finish(null);
      },
    });
    const p = el('p');
    // Tiny markdown: *word* → <em>, built with nodes (no innerHTML on translated text).
    String(body || '')
      .split(/(\*[^*]+\*)/)
      .forEach((part) => p.appendChild(part.startsWith('*') && part.endsWith('*') ? el('em', { text: part.slice(1, -1) }) : document.createTextNode(part)));
    const acts = el('div', { class: 'acts' }, actions.map((a) => button(a.label, () => finish(a.value), { ghost: a.ghost, sound: a.ghost ? 'ui.back' : 'ui.confirm' })));
    const card = el('div', { class: 'gx-card', role: 'dialog', 'aria-modal': 'true' }, [
      el('span', { class: 'pip tl', text: suit }),
      el('span', { class: 'pip br', text: suit }),
      el('h2', { text: title }),
      p,
      foot ? el('div', { class: 'foot', text: foot }) : null,
      acts,
    ].filter(Boolean));
    ov.el.appendChild(card);
    uiSound('ui.card-flip', { rate: vary(0.1) });
    setTimeout(() => acts.querySelector('button:not(.ghost)')?.focus() || acts.querySelector('button')?.focus(), 60);
  });
}

/** Small pill message at the bottom of `root`. */
export function toast(root, text, ms = 2200) {
  ensureStyles();
  const node = el('div', { class: 'gx-toast', text });
  root.appendChild(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 400);
  }, ms);
}

/** True on touch-first devices (used to pick "tap" vs "press a key" copy). */
export const isTouch = () => matchMedia('(pointer: coarse)').matches;
