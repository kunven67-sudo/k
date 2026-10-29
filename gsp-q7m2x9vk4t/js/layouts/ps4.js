/* PS4 style: the blue wave theme, a row of game tiles in the middle (the picked one is bigger with its
   name above it and "Start" on it), and the function row of small icons at the top. */
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, art, status, playLabel, infoLine, saveSize, fmtBytes, systemItems, clockText } from './common.js';
import { waves } from './waves.js';

export function make(root, ctx) {
  let zone = 'row';
  let sel = 0;
  let fsel = 0;
  let items = [];
  let visible = false;
  const sys = systemItems(ctx);

  const canvas = h('canvas.ps4-waves');
  const funcRow = h('div.ps4-func');
  const clock = h('div.ps4-clock');
  const title = h('div.ps4-title');
  const track = h('div.ps4-track');
  const info = h('div.ps4-info');
  const probe = h('div.ps4-probe');
  root.appendChild(h('div.ps4', canvas, h('div.ps4-top', funcRow, clock), title, h('div.ps4-row', track), info, probe));
  const wave = waves(canvas, { mode: 'ps4' });

  function build() {
    items = recentGames().map(function (g) { return { g: g }; });
    items.push({ lib: true });
    sel = Math.min(sel, items.length - 1);
    funcRow.textContent = '';
    sys.forEach(function (s, i) {
      const b = h('button.ps4-fbtn', { onclick: function () { fsel = i; zone = 'func'; paint(); Sound.press(); s.run(); } }, h('span', { html: icon(s.icon) }), h('span.ps4-flabel', s.name));
      funcRow.appendChild(b);
    });
    track.textContent = '';
    items.forEach(function (it, i) {
      const t = it.lib ? h('div.ps4-tile.lib', h('div.cart', { html: icon('grid') })) : h('div.ps4-tile', art(it.g), h('div.ps4-start', 'Start'));
      if (it.g && status(it.g)) t.appendChild(h('div.ps4-badge', status(it.g)));
      t.addEventListener('click', function () { if (sel === i && zone === 'row') activate(); else { sel = i; zone = 'row'; Sound.move(); paint(); } });
      t.addEventListener('dblclick', function () { sel = i; activate(); });
      t.addEventListener('contextmenu', function (e) { e.preventDefault(); if (it.g) ctx.options(it.g.id); });
      track.appendChild(t);
    });
    paint();
  }

  function paint() {
    Array.from(track.children).forEach(function (t, i) { t.classList.toggle('sel', i === sel); t.classList.toggle('ring', i === sel && zone === 'row'); });
    Array.from(funcRow.children).forEach(function (b, i) { b.classList.toggle('focus', zone === 'func' && i === fsel); });
    const small = probe.getBoundingClientRect().width || 120;
    track.style.transform = 'translateX(' + (-sel * (small + 12)) + 'px)';
    const it = items[sel];
    if (!it) return;
    if (it.lib) {
      title.textContent = 'Library';
      info.textContent = St.games.size + ' games and apps';
      Music.want(null);
      return;
    }
    title.textContent = it.g.name;
    info.textContent = infoLine(it.g);
    Music.want(it.g.music);
    const t = track.children[sel];
    const lab = t && t.querySelector('.ps4-start');
    if (lab) lab.textContent = playLabel(it.g);
    saveSize(it.g.id, function (n) { if (items[sel] === it && n) info.textContent = infoLine(it.g) + '  ·  Saved data ' + fmtBytes(n); });
  }

  function activate() {
    const it = items[sel];
    if (!it) return;
    if (it.lib) { Sound.press(); ctx.openLibrary(); return; }
    ctx.play(it.g.id, track.children[sel]);
  }

  function key(a) {
    if (zone === 'func') {
      if (a === 'left' || a === 'right') { const n = Math.max(0, Math.min(sys.length - 1, fsel + (a === 'left' ? -1 : 1))); if (n !== fsel) { fsel = n; Sound.move(); paint(); } return true; }
      if (a === 'down' || a === 'back') { zone = 'row'; Sound.move(); paint(); return true; }
      if (a === 'ok') { Sound.press(); sys[fsel].run(); return true; }
      return true;
    }
    if (a === 'left' || a === 'right') { const n = Math.max(0, Math.min(items.length - 1, sel + (a === 'left' ? -1 : 1))); if (n !== sel) { sel = n; Sound.move(); paint(); } return true; }
    if (a === 'up') { zone = 'func'; Sound.move(); paint(); return true; }
    if (a === 'ok') { activate(); return true; }
    if (a === 'options') { const it = items[sel]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    return true;
  }

  const tick = setInterval(function () { clock.textContent = clockText(); }, 5000);
  clock.textContent = clockText();
  void tick;
  onState(function (w) { if (visible && (w === 'lib' || w === 'running')) build(); });

  return {
    show: function () { visible = true; root.hidden = false; wave.start(); build(); },
    hide: function () { visible = false; root.hidden = true; wave.stop(); },
    key: key,
    blurRow: function () {},
    takeFocus: function () { zone = 'row'; paint(); },
    refreshSaves: function () { paint(); }
  };
}
