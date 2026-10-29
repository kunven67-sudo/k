/* Xbox Series X|S / Xbox One style (the 2023 Xbox Home): your picture + gamertag top left, the quick-access icons
   (library, add, search, settings, power) at the top, the clock top right, a lot of room for the background,
   then the row of games (the one you played last is big) and a row of wide cards (My games & apps, Settings...).
   What's highlighted gets the green Xbox frame. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { Bg } from '../bg.js';
import { recentGames, status, systemItems, clockText } from './common.js';

export function make(root, ctx) {
  let row = 0;  /* -1 = quick-access icons, 0 = games, 1 = wide cards */
  let sel = { '-1': 0, 0: 0, 1: 0 };
  let games = [];
  let visible = false;
  let emptyMoved = false;
  const sys = systemItems(ctx);
  const QUICK = [
    { icon: 'grid9', name: 'My games & apps', run: function () { ctx.openLibrary(); } },
    { icon: 'plus', name: 'Add games', run: function () { ctx.openAdd(); } },
    { icon: 'search', name: 'Search', run: function () { ctx.search(); } },
    { icon: 'gear', name: 'Settings', run: function () { ctx.openSettings(); } },
    { icon: 'power', name: 'Power', run: function () { ctx.power(); } }
  ].filter(function (q) { return !(window.gs && window.gs.platform === 'phone' && q.icon === 'plus'); });

  const quick = h('div.xb-quick');
  QUICK.forEach(function (q, i) {
    const b = h('button.xb-qbtn', { title: q.name, html: icon(q.icon) });
    b.appendChild(h('span.xb-qtip', q.name));
    b.addEventListener('click', function () { row = -1; sel[-1] = i; paint(); Sound.press(); q.run(); });
    quick.appendChild(b);
  });
  const clock = h('div.xb-clock');
  const top = h('div.xb-top',
    h('div.xb-me', h('div.xb-avatar', { html: icon('user') }), h('div', h('div.xb-gt', 'Player'), h('div.xb-gs', h('span.xb-g', 'G'), 'Game System 3'))),
    quick, clock);
  const r1 = h('div.xb-row.games');
  const r2 = h('div.xb-row.sys');
  root.appendChild(h('div.xb', top, h('div.xb-rows', r1, r2)));

  function build() {
    games = recentGames().slice(0, 12);
    r1.textContent = '';
    games.forEach(function (g, i) {
      const t = h('div.xb-tile' + (i === 0 ? '.big' : ''), h('div.cart', { style: { backgroundImage: css(g.cover) } }, g.cover ? null : h('div.cnoart', g.name)),
        h('div.xb-tname', g.name),
        status(g) ? h('div.xb-badge', status(g)) : null);
      t.addEventListener('click', function () { if (row === 0 && sel[0] === i) activate(); else { row = 0; sel[0] = i; Sound.move(); paint(); } });
      t.addEventListener('dblclick', function () { row = 0; sel[0] = i; activate(); });
      t.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.options(g.id); });
      r1.appendChild(t);
    });
    if (!games.length) r1.appendChild(h('div.xb-empty', 'Add a game and it shows up here.'));
    r2.textContent = '';
    sys.forEach(function (s, i) {
      const t = h('div.xb-stile', h('span', { html: icon(s.id === 'lib' ? 'grid9' : s.icon) }), h('div', s.id === 'lib' ? 'My games & apps' : s.name));
      t.addEventListener('click', function () { row = 1; sel[1] = i; paint(); Sound.press(); s.run(); });
      r2.appendChild(t);
    });
    /* no games yet: the highlight waits on the cards row, and jumps back up to the games once there are some */
    if (!games.length && row === 0) { row = 1; emptyMoved = true; }
    else if (games.length && emptyMoved) { row = 0; sel[0] = 0; emptyMoved = false; }
    sel[0] = Math.min(sel[0], Math.max(0, games.length - 1));
    paint();
  }

  function paint() {
    Array.from(quick.children).forEach(function (t, i) { t.classList.toggle('focus', row === -1 && i === sel[-1]); });
    Array.from(r1.children).forEach(function (t, i) { t.classList.toggle('focus', row === 0 && i === sel[0]); });
    Array.from(r2.children).forEach(function (t, i) { t.classList.toggle('focus', row === 1 && i === sel[1]); });
    clock.textContent = clockText();
    /* the background shows the game you're on (or the one you played last while you're up in the icons) */
    const g = row === 0 ? games[sel[0]] : row === -1 ? games[0] : null;
    if (g) { Bg.set(g.cover); Music.want(g.music); } else { Bg.set(null); Music.want(null); }
    const t = row === 0 ? r1.children[sel[0]] : row === 1 ? r2.children[sel[1]] : null;
    if (t) t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function activate() {
    if (row === -1) { Sound.press(); QUICK[sel[-1]].run(); return; }
    if (row === 1) { Sound.press(); sys[sel[1]].run(); return; }
    const g = games[sel[0]];
    if (g) ctx.play(g.id, r1.children[sel[0]]);
  }

  function key(a) {
    const n = row === -1 ? QUICK.length : row === 0 ? games.length : sys.length;
    if (a === 'left' || a === 'right') {
      const k = Math.max(0, Math.min(n - 1, sel[row] + (a === 'left' ? -1 : 1)));
      if (k !== sel[row]) { sel[row] = k; Sound.move(); paint(); }
      return true;
    }
    if (a === 'down' && row < 1) { row = row === -1 && games.length ? 0 : 1; Sound.move(); paint(); return true; }
    if (a === 'up' && row > -1) { row = row === 1 && games.length ? 0 : -1; Sound.move(); paint(); return true; }
    if (a === 'ok') { activate(); return true; }
    if (a === 'back' && row !== 0 && games.length) { row = 0; Sound.back(); paint(); return true; }
    if (a === 'options' && row === 0 && games[sel[0]]) { Sound.open(); ctx.options(games[sel[0]].id); return true; }
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
