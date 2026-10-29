/* Xbox 360 (Blades, 2005) style: big colored "blades" you flip left and right (Games, Media, System),
   each with a menu list on the left and a framed picture of what's picked on the right. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, systemItems } from './common.js';

export function make(root, ctx) {
  let blades = [];
  let bi = 0;
  const li = {};
  let visible = false;

  const tabs = h('div.bl-tabs');
  const body = h('div.bl-body');
  root.appendChild(h('div.bl', h('div.bl-glow'), tabs, body));

  function build() {
    const all = recentGames();
    const sys = systemItems(ctx);
    blades = [{ name: 'Games', cls: 'g', items: [{ name: 'Game Library', icon: 'grid', run: function () { ctx.openLibrary(); } }].concat(all.filter(function (g) { return g.kind !== 'app'; }).map(function (g) { return { g: g }; })) }];
    const apps = all.filter(function (g) { return g.kind === 'app'; });
    if (apps.length) blades.push({ name: 'Apps', cls: 'a', items: apps.map(function (g) { return { g: g }; }) });
    blades.push({ name: 'Media', cls: 'm', items: sys.filter(function (s) { return s.id === 'shots' || s.id === 'saved'; }).map(function (s) { return { name: s.name, icon: s.icon, run: s.run }; }) });
    blades.push({ name: 'System', cls: 's', items: sys.filter(function (s) { return s.id === 'settings' || s.id === 'add' || s.id === 'power'; }).map(function (s) { return { name: s.name, icon: s.icon, run: s.run }; }) });
    bi = Math.min(bi, blades.length - 1);
    blades.forEach(function (b, k) { if (li[k] == null) li[k] = b.cls === 'g' && b.items.length > 1 ? 1 : 0; li[k] = Math.min(li[k], b.items.length - 1); });
    paint();
  }

  function paint(dir) {
    tabs.textContent = '';
    blades.forEach(function (b, k) {
      const t = h('div.bl-tab.' + b.cls + (k === bi ? '.on' : ''), b.name);
      t.addEventListener('click', function () { if (k !== bi) { const d = k > bi ? 1 : -1; bi = k; Sound.move(); paint(d); } });
      tabs.appendChild(t);
    });
    const b = blades[bi];
    body.textContent = '';
    if (!b) return;
    const panel = h('div.bl-panel.' + b.cls + (dir ? (dir > 0 ? '.in-r' : '.in-l') : ''));
    const menu = h('div.bl-menu');
    const k = li[bi] || 0;
    b.items.forEach(function (it, n) {
      const row = h('div.bl-item' + (n === k ? '.on' : ''), it.g ? it.g.name : it.name);
      row.addEventListener('click', function () { if (li[bi] === n) activate(); else { li[bi] = n; Sound.move(); paint(); } });
      if (it.g) row.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.options(it.g.id); });
      menu.appendChild(row);
    });
    const it = b.items[k];
    const pic = h('div.bl-pic');
    if (it && it.g) {
      pic.appendChild(h('div.cart', { style: { backgroundImage: css(it.g.cover) } }, it.g.cover ? null : h('div.cnoart', it.g.name)));
      Music.want(it.g.music);
    } else if (it) {
      pic.appendChild(h('div.bl-ic', { html: icon(it.icon) }));
      Music.want(null);
    }
    const desc = h('div.bl-desc', it && it.g ? (status(it.g) || infoLine(it.g)) : '');
    panel.appendChild(h('div.bl-title', b.name.toLowerCase()));
    panel.appendChild(h('div.bl-split', menu, h('div.bl-right', pic, desc)));
    body.appendChild(panel);
    const on = menu.querySelector('.bl-item.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  function activate() {
    const b = blades[bi];
    const it = b && b.items[li[bi] || 0];
    if (!it) return;
    if (it.g) { ctx.play(it.g.id, body.querySelector('.bl-pic')); return; }
    Sound.press();
    it.run();
  }

  function key(a) {
    const b = blades[bi];
    if (a === 'left' || a === 'right') {
      const n = Math.max(0, Math.min(blades.length - 1, bi + (a === 'left' ? -1 : 1)));
      if (n !== bi) { const d = n > bi ? 1 : -1; bi = n; Sound.move(); paint(d); }
      return true;
    }
    if (a === 'up' || a === 'down') {
      const n = Math.max(0, Math.min(b.items.length - 1, (li[bi] || 0) + (a === 'up' ? -1 : 1)));
      if (n !== li[bi]) { li[bi] = n; Sound.move(); paint(); }
      return true;
    }
    if (a === 'ok') { activate(); return true; }
    if (a === 'options') { const it = b.items[li[bi] || 0]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    return true;
  }

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
