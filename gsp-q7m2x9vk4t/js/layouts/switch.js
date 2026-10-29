/* Nintendo Switch style: big square game tiles in a row (the picked one gets the glowing blue frame with
   its name above it), round buttons underneath, time + battery in the corner, Basic Black theme. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, systemItems, clockText } from './common.js';

export function make(root, ctx) {
  let row = 0;
  let sel = [0, 0];
  let items = [];
  let visible = false;
  const sys = systemItems(ctx);

  const clock = h('div.sw-clock');
  const name = h('div.sw-name');
  const track = h('div.sw-track');
  const btns = h('div.sw-btns');
  const blabel = h('div.sw-blabel');
  root.appendChild(h('div.sw',
    h('div.sw-top', h('div.sw-user', { html: icon('pad') }), h('div.sw-status', clock, h('span.sw-wifi', { html: icon('zap') }), h('span.sw-batt', h('i')))),
    h('div.sw-rowwrap', name, h('div.sw-row', track)),
    h('div.sw-btnwrap', btns, blabel),
    h('div.sw-bottom', h('span.sw-ctl', h('i'), h('i')), h('span.sw-hint', h('b', 'A'), ' OK'))));

  function build() {
    items = recentGames().slice(0, 12).map(function (g) { return { g: g }; });
    items.push({ lib: true });
    sel[0] = Math.min(sel[0], items.length - 1);
    track.textContent = '';
    items.forEach(function (it, i) {
      const t = it.lib ? h('div.sw-tile.lib', h('div.sw-lib', { html: icon('grid') }), h('div.sw-libt', 'All Software'))
        : h('div.sw-tile', h('div.cart', { style: { backgroundImage: css(it.g.cover) } }, it.g.cover ? null : h('div.cnoart', it.g.name)));
      if (it.g && status(it.g)) t.appendChild(h('div.sw-badge', status(it.g)));
      t.addEventListener('click', function () { if (row === 0 && sel[0] === i) activate(); else { row = 0; sel[0] = i; Sound.move(); paint(); } });
      t.addEventListener('dblclick', function () { row = 0; sel[0] = i; activate(); });
      t.addEventListener('contextmenu', function (e) { e.preventDefault(); if (it.g) ctx.options(it.g.id); });
      track.appendChild(t);
    });
    btns.textContent = '';
    sys.forEach(function (s, i) {
      const b = h('button.sw-btn.c-' + s.id, { html: icon(s.icon) });
      b.addEventListener('click', function () { row = 1; sel[1] = i; paint(); Sound.press(); s.run(); });
      btns.appendChild(b);
    });
    paint();
  }

  function paint() {
    clock.textContent = clockText();
    Array.from(track.children).forEach(function (t, i) { t.classList.toggle('focus', row === 0 && i === sel[0]); });
    Array.from(btns.children).forEach(function (b, i) { b.classList.toggle('focus', row === 1 && i === sel[1]); });
    const it = items[sel[0]];
    name.textContent = row === 0 && it ? (it.lib ? 'All Software' : it.g.name) : '';
    blabel.textContent = row === 1 ? (sel[1] === 0 ? 'All Software' : sys[sel[1]].name) : '';
    /* keep the picked tile on screen, like the real one */
    const t = track.children[sel[0]];
    if (t) {
      const tw = t.getBoundingClientRect().width + 14;
      const view = track.parentNode.getBoundingClientRect().width;
      const want = Math.max(0, sel[0] * tw - Math.max(0, view - tw * 2.2));
      track.style.transform = 'translateX(' + (-want) + 'px)';
      if (row === 0) {
        const r = t.getBoundingClientRect(), pr = track.parentNode.getBoundingClientRect();
        name.style.left = Math.max(0, (sel[0] * tw - want)) + 'px';
        void r; void pr;
      }
    }
    Music.want(row === 0 && it && it.g ? it.g.music : null);
  }

  function activate() {
    if (row === 1) { Sound.press(); sys[sel[1]].run(); return; }
    const it = items[sel[0]];
    if (!it) return;
    if (it.lib) { Sound.press(); ctx.openLibrary(); return; }
    ctx.play(it.g.id, track.children[sel[0]]);
  }

  function key(a) {
    const n = row === 0 ? items.length : sys.length;
    if (a === 'left' || a === 'right') {
      const k = Math.max(0, Math.min(n - 1, sel[row] + (a === 'left' ? -1 : 1)));
      if (k !== sel[row]) { sel[row] = k; Sound.move(); paint(); }
      return true;
    }
    if (a === 'down' && row === 0) { row = 1; sel[1] = Math.min(sel[1], sys.length - 1); Sound.move(); paint(); return true; }
    if (a === 'up' && row === 1) { row = 0; Sound.move(); paint(); return true; }
    if (a === 'ok') { activate(); return true; }
    if (a === 'options' && row === 0) { const it = items[sel[0]]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    return true;
  }

  setInterval(function () { if (visible) clock.textContent = clockText(); }, 5000);
  onState(function (w) { if (visible && (w === 'lib' || w === 'running')) build(); });

  return {
    show: function () { visible = true; root.hidden = false; build(); },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blurRow: function () {},
    takeFocus: function () { paint(); },
    refreshSaves: function () { paint(); }
  };
}
