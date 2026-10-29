/* Nintendo 3DS / DS style: two screens. The top screen shows the picked game big with its banner,
   the bottom screen is the grid of little icons (plus the system buttons along its top edge). */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, systemItems, clockText, dateText } from './common.js';

const COLS = 6;

export function make(root, ctx) {
  let zone = 'grid';
  let sel = 0;
  let tsel = 0;
  let items = [];
  let visible = false;
  const sys = systemItems(ctx);

  const topArt = h('div.ds-topart');
  const banner = h('div.ds-banner');
  const topBar = h('div.ds-topbar');
  const tools = h('div.ds-tools');
  const grid = h('div.ds-grid');
  root.appendChild(h('div.ds',
    h('div.ds-screen.top', topBar, topArt, banner),
    h('div.ds-hinge'),
    h('div.ds-screen.bottom', tools, grid)));

  function build() {
    items = recentGames().map(function (g) { return { g: g }; });
    items.push({ lib: true });
    sel = Math.min(sel, items.length - 1);
    tools.textContent = '';
    sys.forEach(function (s, i) {
      const b = h('button.ds-tool', { html: icon(s.icon), title: s.name });
      b.addEventListener('click', function () { zone = 'tools'; tsel = i; paint(); Sound.press(); s.run(); });
      tools.appendChild(b);
    });
    grid.textContent = '';
    items.forEach(function (it, i) {
      const c = it.lib ? h('div.ds-icon.lib', { html: icon('grid') }) : h('div.ds-icon', { style: { backgroundImage: css(it.g.cover) } }, it.g.cover ? null : h('div.cnoart', it.g.name.slice(0, 14)));
      c.addEventListener('click', function () { if (zone === 'grid' && sel === i) activate(); else { zone = 'grid'; sel = i; Sound.move(); paint(); } });
      c.addEventListener('dblclick', function () { sel = i; activate(); });
      if (it.g) c.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.options(it.g.id); });
      grid.appendChild(c);
    });
    paint();
  }

  function paint() {
    topBar.textContent = '';
    topBar.appendChild(h('span', dateText({ month: 'numeric', day: 'numeric' })));
    topBar.appendChild(h('span', clockText()));
    Array.from(grid.children).forEach(function (c, i) { c.classList.toggle('focus', zone === 'grid' && i === sel); });
    Array.from(tools.children).forEach(function (b, i) { b.classList.toggle('focus', zone === 'tools' && i === tsel); });
    const it = zone === 'grid' ? items[sel] : null;
    banner.textContent = '';
    if (zone === 'tools') {
      topArt.style.backgroundImage = 'none';
      topArt.textContent = '';
      topArt.appendChild(h('div.ds-sysbig', { html: icon(sys[tsel].icon) }));
      banner.appendChild(h('div.ds-bn', sys[tsel].name));
      Music.want(null);
    } else if (it && it.lib) {
      topArt.style.backgroundImage = 'none';
      topArt.textContent = '';
      topArt.appendChild(h('div.ds-sysbig', { html: icon('grid') }));
      banner.appendChild(h('div.ds-bn', 'Game Library'));
      banner.appendChild(h('div.ds-bs', St.games.size + ' games and apps'));
      Music.want(null);
    } else if (it) {
      topArt.textContent = '';
      topArt.style.backgroundImage = css(it.g.cover);
      if (!it.g.cover) topArt.appendChild(h('div.cnoart', it.g.name));
      banner.appendChild(h('div.ds-bn', it.g.name));
      banner.appendChild(h('div.ds-bs', status(it.g) || infoLine(it.g)));
      Music.want(it.g.music);
    }
    const c = grid.children[sel];
    if (c) c.scrollIntoView({ block: 'nearest' });
  }

  function activate() {
    if (zone === 'tools') { Sound.press(); sys[tsel].run(); return; }
    const it = items[sel];
    if (!it) return;
    if (it.lib) { Sound.press(); ctx.openLibrary(); return; }
    ctx.play(it.g.id, topArt);
  }

  function key(a) {
    if (zone === 'tools') {
      if (a === 'left' || a === 'right') { const n = Math.max(0, Math.min(sys.length - 1, tsel + (a === 'left' ? -1 : 1))); if (n !== tsel) { tsel = n; Sound.move(); paint(); } return true; }
      if (a === 'down' || a === 'back') { zone = 'grid'; Sound.move(); paint(); return true; }
      if (a === 'ok') { activate(); return true; }
      return true;
    }
    let n = sel;
    if (a === 'left') n = sel - 1;
    else if (a === 'right') n = sel + 1;
    else if (a === 'up') { if (sel < COLS) { zone = 'tools'; Sound.move(); paint(); return true; } n = sel - COLS; }
    else if (a === 'down') n = Math.min(items.length - 1, sel + COLS);
    else if (a === 'ok') { activate(); return true; }
    else if (a === 'options') { const it = items[sel]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    else return true;
    n = Math.max(0, Math.min(items.length - 1, n));
    if (n !== sel) { sel = n; Sound.move(); paint(); }
    return true;
  }

  setInterval(function () { if (visible) { const s = topBar.children; if (s[1]) s[1].textContent = clockText(); } }, 5000);
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
