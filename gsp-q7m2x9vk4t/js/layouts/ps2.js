/* PS2 style: the deep blue "Browser" with glowing towers of cubes floating in the dark, game icons that
   slowly turn, and "System Configuration" at the top. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, systemItems } from './common.js';

export function make(root, ctx) {
  let zone = 'grid';
  let sel = 0;
  let tsel = 0;
  let items = [];
  let visible = false;
  const sys = systemItems(ctx);

  const towers = h('div.ps2-towers');
  for (let i = 0; i < 9; i++) {
    const tw = h('div.ps2-tower', { style: { left: (6 + i * 11) + '%', animationDelay: (-i * 1.7) + 's', height: (18 + (i * 37) % 46) + '%' } });
    towers.appendChild(tw);
  }
  const head = h('div.ps2-head');
  const titleBox = h('div.ps2-titlebox');
  const grid = h('div.ps2-grid');
  root.appendChild(h('div.ps2', towers, h('div.ps2-fog'), head, titleBox, grid));

  function build() {
    items = recentGames().map(function (g) { return { g: g }; });
    items.push({ lib: true });
    sel = Math.min(sel, items.length - 1);
    head.textContent = '';
    head.appendChild(h('div.ps2-browser', 'Browser'));
    const tools = h('div.ps2-tools');
    sys.forEach(function (s, i) {
      if (s.id === 'lib') return;
      const b = h('button.ps2-tool', { dataset: { i: String(i) }, onclick: function () { Sound.press(); s.run(); } }, h('span', { html: icon(s.icon) }), s.id === 'settings' ? 'System Configuration' : s.name);
      tools.appendChild(b);
    });
    head.appendChild(tools);
    grid.textContent = '';
    items.forEach(function (it, i) {
      let cell;
      if (it.lib) cell = h('div.ps2-cell.lib', h('div.ps2-icon', { html: icon('grid') }), h('div.ps2-name', 'Game Library'));
      else {
        const ic = h('div.ps2-icon', { style: { backgroundImage: css(it.g.cover) } });
        if (!it.g.cover) ic.appendChild(h('div.cnoart', it.g.name));
        cell = h('div.ps2-cell', ic, h('div.ps2-name', it.g.name));
      }
      cell.style.animationDelay = (-i * 0.9) + 's';
      cell.addEventListener('click', function () { if (sel === i && zone === 'grid') activate(); else { sel = i; zone = 'grid'; Sound.move(); paint(); } });
      cell.addEventListener('dblclick', function () { sel = i; activate(); });
      cell.addEventListener('contextmenu', function (e) { e.preventDefault(); if (it.g) ctx.options(it.g.id); });
      grid.appendChild(cell);
    });
    paint();
  }

  function cols() {
    const kids = grid.children;
    if (kids.length < 2) return 1;
    const top = kids[0].offsetTop;
    let n = 0;
    while (n < kids.length && kids[n].offsetTop === top) n++;
    return Math.max(1, n);
  }

  function paint() {
    Array.from(grid.children).forEach(function (c, i) { c.classList.toggle('sel', i === sel && zone === 'grid'); c.classList.toggle('picked', i === sel); });
    const tools = head.querySelectorAll('.ps2-tool');
    tools.forEach(function (b, i) { b.classList.toggle('focus', zone === 'tools' && i === tsel); });
    const it = items[sel];
    titleBox.textContent = '';
    if (!it) return;
    if (it.lib) { titleBox.appendChild(h('div.ps2-t1', 'Game Library')); titleBox.appendChild(h('div.ps2-t2', St.games.size + ' games and apps')); Music.want(null); }
    else {
      titleBox.appendChild(h('div.ps2-t1', it.g.name));
      titleBox.appendChild(h('div.ps2-t2', status(it.g) || infoLine(it.g)));
      Music.want(it.g.music);
    }
    const c = grid.children[sel];
    if (c) c.scrollIntoView({ block: 'nearest' });
  }

  function activate() {
    const it = items[sel];
    if (!it) return;
    if (it.lib) { Sound.press(); ctx.openLibrary(); return; }
    ctx.play(it.g.id, grid.children[sel].querySelector('.ps2-icon'));
  }

  function key(a) {
    const tools = head.querySelectorAll('.ps2-tool');
    if (zone === 'tools') {
      if (a === 'left' || a === 'right') { const n = Math.max(0, Math.min(tools.length - 1, tsel + (a === 'left' ? -1 : 1))); if (n !== tsel) { tsel = n; Sound.move(); paint(); } return true; }
      if (a === 'down' || a === 'back') { zone = 'grid'; Sound.move(); paint(); return true; }
      if (a === 'ok') { tools[tsel].click(); return true; }
      return true;
    }
    const c = cols();
    let n = sel;
    if (a === 'left') n = sel - 1;
    else if (a === 'right') n = sel + 1;
    else if (a === 'up') { if (sel - c < 0) { zone = 'tools'; Sound.move(); paint(); return true; } n = sel - c; }
    else if (a === 'down') n = Math.min(items.length - 1, sel + c);
    else if (a === 'ok') { activate(); return true; }
    else if (a === 'options') { const it = items[sel]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    else return true;
    n = Math.max(0, Math.min(items.length - 1, n));
    if (n !== sel) { sel = n; Sound.move(); paint(); }
    return true;
  }

  onState(function (w) { if (visible && (w === 'lib' || w === 'running')) build(); });

  return {
    show: function () { visible = true; root.hidden = false; build(); },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blurRow: function () {},
    takeFocus: function () { zone = 'grid'; paint(); },
    refreshSaves: function () { paint(); }
  };
}
