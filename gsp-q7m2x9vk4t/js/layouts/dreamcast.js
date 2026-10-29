/* Dreamcast style: the BIOS main menu with its four big buttons (Play, File, Music, Settings) on deep blue
   with the orange swirl, and the time + date along the bottom. Play opens the game picker. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, clockText, dateText } from './common.js';

export function make(root, ctx) {
  let view = 'menu';
  let msel = 0;
  let gsel = 0;
  let games = [];
  let visible = false;

  const OPTS = [
    { name: 'Play', icon: 'play', run: function () { openGames(); } },
    { name: 'File', icon: 'save', run: function () { ctx.openSaved(); } },
    { name: 'Music', icon: 'music', run: function () { ctx.openSettings('look'); } },
    { name: 'Settings', icon: 'gear', run: function () { ctx.openSettings(); } }
  ];
  const menuEl = h('div.dc-menu');
  const gamesEl = h('div.dc-games', { hidden: true });
  const foot = h('div.dc-foot');
  root.appendChild(h('div.dc', h('div.dc-swirl'), menuEl, gamesEl, foot));

  function build() {
    games = recentGames();
    gsel = Math.min(gsel, games.length);
    paint();
  }

  function paint() {
    foot.textContent = '';
    foot.appendChild(h('span', dateText({ year: 'numeric', month: '2-digit', day: '2-digit' })));
    foot.appendChild(h('span', clockText()));
    if (view === 'menu') {
      menuEl.hidden = false;
      gamesEl.hidden = true;
      menuEl.textContent = '';
      OPTS.forEach(function (o, i) {
        const b = h('button.dc-opt' + (i === msel ? '.focus' : ''), h('span.dc-oic', { html: icon(o.icon) }), h('span.dc-on', o.name));
        b.addEventListener('mouseenter', function () { if (msel !== i) { msel = i; Sound.move(); paint(); } });
        b.addEventListener('click', function () { msel = i; Sound.press(); o.run(); });
        menuEl.appendChild(b);
      });
      Music.want(null);
      return;
    }
    menuEl.hidden = true;
    gamesEl.hidden = false;
    gamesEl.textContent = '';
    const list = games.concat([null]);
    const cur = list[gsel];
    gamesEl.appendChild(h('div.dc-gtitle', cur ? cur.name : 'Game Library', h('small', cur ? (status(cur) || infoLine(cur)) : St.games.size + ' games and apps')));
    const grid = h('div.dc-grid');
    list.forEach(function (g, i) {
      const c = g ? h('div.dc-cell', h('div.cart', { style: { backgroundImage: css(g.cover) } }, g.cover ? null : h('div.cnoart', g.name))) : h('div.dc-cell.lib', { html: icon('grid') });
      if (i === gsel) c.classList.add('focus');
      c.addEventListener('click', function () { if (gsel === i) activate(); else { gsel = i; Sound.move(); paint(); } });
      c.addEventListener('dblclick', function () { gsel = i; activate(); });
      if (g) c.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.options(g.id); });
      grid.appendChild(c);
    });
    gamesEl.appendChild(grid);
    const back = h('button.dc-back', h('span', { html: icon('back') }), 'Back');
    back.addEventListener('click', function () { view = 'menu'; Sound.back(); paint(); });
    gamesEl.appendChild(back);
    const f = grid.children[gsel];
    if (f) f.scrollIntoView({ block: 'nearest' });
    Music.want(cur ? cur.music : null);
  }

  function openGames() { view = 'games'; paint(); }

  function activate() {
    if (view === 'menu') { Sound.press(); OPTS[msel].run(); return; }
    const g = games[gsel];
    if (!g) { Sound.press(); ctx.openLibrary(); return; }
    ctx.play(g.id, gamesEl.querySelector('.dc-cell.focus'));
  }

  function key(a) {
    if (view === 'menu') {
      const col = msel % 2, row = Math.floor(msel / 2);
      let n = msel;
      if (a === 'left' && col === 1) n = msel - 1;
      if (a === 'right' && col === 0) n = msel + 1;
      if (a === 'up' && row === 1) n = msel - 2;
      if (a === 'down' && row === 0) n = msel + 2;
      if (n !== msel) { msel = n; Sound.move(); paint(); return true; }
      if (a === 'ok') { activate(); return true; }
      return true;
    }
    const total = games.length + 1;
    const grid = gamesEl.querySelector('.dc-grid');
    let cols = 1;
    if (grid && grid.children.length > 1) { const top = grid.children[0].offsetTop; while (cols < grid.children.length && grid.children[cols].offsetTop === top) cols++; }
    let n = gsel;
    if (a === 'left') n--; else if (a === 'right') n++; else if (a === 'up') n -= cols; else if (a === 'down') n += cols;
    else if (a === 'ok') { activate(); return true; }
    else if (a === 'back') { view = 'menu'; Sound.back(); paint(); return true; }
    else if (a === 'options') { const g = games[gsel]; if (g) { Sound.open(); ctx.options(g.id); } return true; }
    else return true;
    n = Math.max(0, Math.min(total - 1, n));
    if (n !== gsel) { gsel = n; Sound.move(); paint(); }
    return true;
  }

  setInterval(function () { if (visible) { const s = foot.children; if (s[1]) s[1].textContent = clockText(); } }, 5000);
  onState(function (w) { if (visible && (w === 'lib' || w === 'running')) build(); });

  return {
    show: function () { visible = true; root.hidden = false; build(); },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blurRow: function () {},
    takeFocus: function () { paint(); },
    refreshSaves: function () {}
  };
}
