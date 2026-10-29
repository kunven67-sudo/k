/* Wii style: 12 channels per page, the gray clock bar at the bottom with the Wii button, the hand pointer.
   Picking a channel opens its big preview with "Wii Menu" and "Start", just like the real thing. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, systemItems } from './common.js';
import { menu } from '../modal.js';

const PER = 12;

export function make(root, ctx) {
  let sel = 0;
  let page = 0;
  let items = [];
  let preview = null; /* index of the opened channel */
  let pbtn = 1;
  let bar = -1;        /* -1 = channels, 0 = Wii button, 1 = mail button */
  let visible = false;

  const grid = h('div.wii-grid');
  const arrows = [h('button.wii-arrow.l', { html: icon('back') }), h('button.wii-arrow.r', { html: icon('back') })];
  const clockEl = h('div.wii-clock');
  const dateEl = h('div.wii-date');
  const wiiBtn = h('button.wii-round.wii-b', 'Wii');
  const mailBtn = h('button.wii-round.wii-m', { html: icon('save') });
  const pv = h('div.wii-preview', { hidden: true });
  root.appendChild(h('div.wii', h('div.wii-page', grid), arrows[0], arrows[1],
    h('div.wii-bar', h('div.wii-curve', { html: '<svg viewBox="0 0 1000 120" preserveAspectRatio="none"><path d="M0 46 C 300 46 340 8 500 8 C 660 8 700 46 1000 46 L1000 120 L0 120 Z" fill="currentColor"/></svg>' }), wiiBtn, h('div.wii-time', clockEl, dateEl), mailBtn),
    pv));
  arrows[0].addEventListener('click', function () { turn(-1); });
  arrows[1].addEventListener('click', function () { turn(1); });
  wiiBtn.addEventListener('click', function () { bar = 0; paint(); Sound.press(); wiiMenu(); });
  mailBtn.addEventListener('click', function () { bar = 1; paint(); Sound.press(); ctx.openSaved(); });

  function pages() { return Math.max(1, Math.ceil(items.length / PER)); }

  function build() {
    items = [{ lib: true }].concat(recentGames().map(function (g) { return { g: g }; }));
    sel = Math.min(sel, items.length - 1);
    page = Math.min(page, pages() - 1);
    paint();
  }

  function paint() {
    grid.textContent = '';
    const start = page * PER;
    for (let i = 0; i < PER; i++) {
      const it = items[start + i];
      const idx = start + i;
      let ch;
      if (!it) ch = h('div.wii-ch.empty');
      else if (it.lib) ch = h('div.wii-ch.disc', h('div.wii-discart', h('div.wii-disc'), h('div.wii-dlabel', 'Game Library')));
      else ch = h('div.wii-ch', h('div.cart', { style: { backgroundImage: css(it.g.cover) } }, it.g.cover ? null : h('div.cnoart', it.g.name)));
      if (it && idx === sel && bar < 0) ch.classList.add('focus');
      if (it) {
        ch.addEventListener('mouseenter', function () { if (sel !== idx) { sel = idx; bar = -1; Sound.move(); markFocus(); } });
        ch.addEventListener('click', function () { sel = idx; open(idx); });
        if (it.g) ch.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.options(it.g.id); });
      }
      grid.appendChild(ch);
    }
    arrows[0].hidden = page === 0;
    arrows[1].hidden = page >= pages() - 1;
    wiiBtn.classList.toggle('focus', bar === 0);
    mailBtn.classList.toggle('focus', bar === 1);
    tick();
    const it = items[sel];
    Music.want(it && it.g ? it.g.music : null);
  }
  function markFocus() {
    Array.from(grid.children).forEach(function (c, i) { c.classList.toggle('focus', page * PER + i === sel && bar < 0); });
    wiiBtn.classList.toggle('focus', bar === 0);
    mailBtn.classList.toggle('focus', bar === 1);
  }

  function turn(d) {
    const p = Math.max(0, Math.min(pages() - 1, page + d));
    if (p === page) return;
    page = p;
    sel = Math.min(items.length - 1, page * PER + (sel % PER));
    Sound.move();
    grid.classList.remove('slide-l', 'slide-r');
    void grid.offsetWidth;
    grid.classList.add(d > 0 ? 'slide-r' : 'slide-l');
    paint();
  }

  /* the channel preview: big picture + "Wii Menu" / "Start" */
  function open(idx) {
    const it = items[idx];
    if (!it) return;
    if (it.lib) { Sound.press(); ctx.openLibrary(); return; }
    Sound.press();
    preview = idx;
    pbtn = 1;
    pv.textContent = '';
    const g = it.g;
    const back = h('button.wii-pbtn', 'Wii Menu');
    const go = h('button.wii-pbtn', status(g) === 'Quick Resume' ? 'Resume' : 'Start');
    back.addEventListener('click', closePreview);
    go.addEventListener('click', function () { const el = pv.querySelector('.wii-pv-art'); closePreview(true); ctx.play(g.id, el); });
    pv.appendChild(h('div.wii-pv-art', { style: { backgroundImage: css(g.cover) } }, g.cover ? null : h('div.cnoart', g.name)));
    pv.appendChild(h('div.wii-pv-name', g.name, h('small', infoLine(g))));
    pv.appendChild(h('div.wii-pv-btns', back, go));
    pv.hidden = false;
    paintPreview();
  }
  function paintPreview() { pv.querySelectorAll('.wii-pbtn').forEach(function (b, i) { b.classList.toggle('focus', i === pbtn); }); }
  function closePreview(quiet) { preview = null; pv.hidden = true; if (quiet !== true) Sound.back(); }

  function wiiMenu() {
    const sys = systemItems(ctx).filter(function (s) { return s.id !== 'saved'; });
    menu('Wii Menu', sys.map(function (s) { return { label: s.name, icon: s.icon, onClick: s.run }; }));
  }

  function key(a) {
    if (preview != null) {
      if (a === 'left' || a === 'right') { const n = a === 'left' ? 0 : 1; if (n !== pbtn) { pbtn = n; Sound.move(); paintPreview(); } return true; }
      if (a === 'ok') { pv.querySelectorAll('.wii-pbtn')[pbtn].click(); return true; }
      if (a === 'back') { closePreview(); return true; }
      return true;
    }
    if (bar >= 0) {
      if (a === 'left' || a === 'right') { bar = a === 'left' ? 0 : 1; Sound.move(); markFocus(); return true; }
      if (a === 'up' || a === 'back') { bar = -1; Sound.move(); markFocus(); return true; }
      if (a === 'ok') { (bar === 0 ? wiiBtn : mailBtn).click(); return true; }
      return true;
    }
    const col = sel % 4, rowN = Math.floor((sel % PER) / 4);
    if (a === 'left') {
      if (col === 0) { if (page > 0) { turn(-1); sel = Math.min(items.length - 1, page * PER + rowN * 4 + 3); markFocus(); } return true; }
      sel--; Sound.move(); markFocus(); return true;
    }
    if (a === 'right') {
      if (col === 3 || sel + 1 >= items.length) { if (page < pages() - 1) { turn(1); sel = Math.min(items.length - 1, page * PER + rowN * 4); markFocus(); } return true; }
      sel++; Sound.move(); markFocus(); return true;
    }
    if (a === 'up') { if (rowN > 0) { sel -= 4; Sound.move(); markFocus(); } return true; }
    if (a === 'down') {
      if (rowN < 2 && sel + 4 < items.length) { sel += 4; Sound.move(); markFocus(); }
      else { bar = 0; Sound.move(); markFocus(); }
      return true;
    }
    if (a === 'ok') { open(sel); return true; }
    if (a === 'options') { const it = items[sel]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    if (a === 'prev' || a === 'next') { turn(a === 'prev' ? -1 : 1); return true; }
    return true;
  }

  function tick() {
    const d = new Date();
    clockEl.textContent = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
    dateEl.textContent = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
  }
  setInterval(function () { if (visible) tick(); }, 5000);
  root.addEventListener('wheel', function (e) { if (Math.abs(e.deltaY) > 20 && preview == null) turn(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  onState(function (w) { if (visible && preview == null && (w === 'lib' || w === 'running')) build(); });

  return {
    show: function () { visible = true; root.hidden = false; build(); },
    hide: function () { visible = false; root.hidden = true; closePreview(true); },
    key: key,
    blurRow: function () {},
    takeFocus: function () { markFocus(); },
    refreshSaves: function () {}
  };
}
