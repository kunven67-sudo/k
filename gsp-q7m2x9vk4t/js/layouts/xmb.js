/* PS3 / PSP style: the XMB. Categories go left/right in a line, their items go up/down in a column,
   with the slowly twisting wave behind (its color changes every month, like the real one). */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, systemItems, clockText, dateText } from './common.js';
import { waves, xmbColor } from './waves.js';

export function make(root, ctx, variant) {
  let cats = [];
  let ci = 1;
  const ii = {};
  let visible = false;

  const canvas = h('canvas.xmb-waves');
  const clock = h('div.xmb-clock');
  const bar = h('div.xmb-bar');
  const list = h('div.xmb-list');
  root.appendChild(h('div.xmb' + (variant === 'psp' ? '.psp' : ''), canvas, clock, bar, list));
  const wave = waves(canvas, { mode: 'xmb', color: xmbColor() });

  function build() {
    const sys = systemItems(ctx);
    const games = recentGames();
    const apps = games.filter(function (g) { return g.kind === 'app'; });
    cats = [
      { name: 'Settings', icon: 'gear', items: sys.filter(function (s) { return s.id !== 'lib'; }).map(function (s) { return { name: s.name, sub: '', icon: s.icon, run: s.run }; }) },
      { name: 'Game', icon: 'pad', items: [{ name: 'Game Library', sub: St.games.size + ' games and apps', icon: 'grid', run: function () { ctx.openLibrary(); } }]
        .concat(games.filter(function (g) { return g.kind !== 'app'; }).map(function (g) { return { g: g }; })) }
    ];
    if (apps.length) cats.push({ name: 'Apps', icon: 'box', items: apps.map(function (g) { return { g: g }; }) });
    cats.push({ name: 'Photo', icon: 'image', items: [
      { name: 'Screenshots', sub: 'Documents\\Game System 3\\Captures', icon: 'camera', run: function () { window.gs.invoke('shell:open', 'captures'); } },
      { name: 'Saved Data', sub: 'Back up, restore, delete', icon: 'save', run: function () { ctx.openSaved(); } }
    ] });
    ci = Math.min(ci, cats.length - 1);
    cats.forEach(function (c, k) { if (ii[k] == null) ii[k] = c.name === 'Game' && c.items.length > 1 ? 1 : 0; ii[k] = Math.min(ii[k], c.items.length - 1); });
    bar.textContent = '';
    cats.forEach(function (c, k) {
      const el = h('div.xmb-cat', h('span', { html: icon(c.icon) }), h('div.xmb-cname', c.name));
      el.addEventListener('click', function () { if (ci !== k) { ci = k; Sound.move(); paint(); } });
      bar.appendChild(el);
    });
    paint();
  }

  function itemEl(it, selected) {
    let pic, name, sub;
    if (it.g) {
      pic = h('div.xmb-pic', { style: { backgroundImage: css(it.g.cover) } });
      if (!it.g.cover) pic.appendChild(h('div.cnoart', it.g.name));
      name = it.g.name;
      sub = status(it.g) || (selected ? infoLine(it.g) : '');
    } else {
      pic = h('div.xmb-pic.ic', { html: icon(it.icon) });
      name = it.name;
      sub = selected ? it.sub : '';
    }
    return h('div.xmb-item' + (selected ? '.sel' : ''), pic, h('div.xmb-txt', h('div.xmb-name', name), sub ? h('div.xmb-sub', sub) : null));
  }

  function paint() {
    Array.from(bar.children).forEach(function (el, k) { el.classList.toggle('on', k === ci); });
    /* the chosen category sits at a fixed spot; the line slides */
    const cw = bar.children[0] ? bar.children[0].getBoundingClientRect().width : 120;
    bar.style.transform = 'translateX(' + (-ci * (cw + 34)) + 'px)';
    const c = cats[ci];
    list.textContent = '';
    if (!c) return;
    const k = ii[ci] || 0;
    const above = h('div.xmb-above');
    const below = h('div.xmb-below');
    c.items.forEach(function (it, n) {
      const el = itemEl(it, n === k);
      el.addEventListener('click', function () { if (ii[ci] === n) activate(); else { ii[ci] = n; Sound.move(); paint(); } });
      el.addEventListener('dblclick', function () { ii[ci] = n; activate(); });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); if (it.g) ctx.options(it.g.id); });
      (n < k ? above : below).appendChild(el);
    });
    list.appendChild(above);
    list.appendChild(below);
    const it = c.items[k];
    Music.want(it && it.g ? it.g.music : null);
  }

  function activate() {
    const c = cats[ci];
    const it = c && c.items[ii[ci] || 0];
    if (!it) return;
    if (it.g) { ctx.play(it.g.id, list.querySelector('.xmb-item.sel .xmb-pic')); return; }
    Sound.press();
    it.run();
  }

  function key(a) {
    const c = cats[ci];
    if (a === 'left' || a === 'right') {
      const n = Math.max(0, Math.min(cats.length - 1, ci + (a === 'left' ? -1 : 1)));
      if (n !== ci) { ci = n; Sound.move(); paint(); }
      return true;
    }
    if (a === 'up' || a === 'down') {
      if (!c) return true;
      const n = Math.max(0, Math.min(c.items.length - 1, (ii[ci] || 0) + (a === 'up' ? -1 : 1)));
      if (n !== ii[ci]) { ii[ci] = n; Sound.move(); paint(); }
      return true;
    }
    if (a === 'ok') { activate(); return true; }
    if (a === 'options') { const it = c && c.items[ii[ci] || 0]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    return true;
  }

  list.addEventListener('wheel', function (e) { if (Math.abs(e.deltaY) > 10) key(e.deltaY > 0 ? 'down' : 'up'); }, { passive: true });
  setInterval(function () { clock.textContent = dateText({ month: 'numeric', day: 'numeric' }) + '   ' + clockText(); }, 5000);
  clock.textContent = dateText({ month: 'numeric', day: 'numeric' }) + '   ' + clockText();
  onState(function (w) { if (visible && (w === 'lib' || w === 'running')) build(); });

  return {
    show: function () { visible = true; root.hidden = false; wave.setColor(xmbColor()); wave.start(); build(); },
    hide: function () { visible = false; root.hidden = true; wave.stop(); },
    key: key,
    blurRow: function () {},
    takeFocus: function () { paint(); },
    refreshSaves: function () { paint(); }
  };
}
