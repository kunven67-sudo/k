/* Xbox 360 (NXE) style: channels stacked up and down (Games, Apps, My Xbox), each one a line of cards
   in 3D that fan out to the right; the front card is the picked one. */
import { h, css } from '../dom.js';
import { icon } from '../icons.js';
import { St, onState } from '../state.js';
import { Sound } from '../sound.js';
import { Music } from '../music.js';
import { recentGames, status, infoLine, systemItems, clockText } from './common.js';

export function make(root, ctx) {
  let chans = [];
  let ci = 0;
  const pos = {};
  let visible = false;

  const stage = h('div.nxe-stage');
  const clock = h('div.nxe-clock');
  root.appendChild(h('div.nxe', h('div.nxe-sky'), stage, clock));

  function build() {
    const all = recentGames();
    const sys = systemItems(ctx);
    chans = [{ name: 'Games', color: '#4f9a1c', items: all.filter(function (g) { return g.kind !== 'app'; }).map(function (g) { return { g: g }; }).concat([{ name: 'Game Library', icon: 'grid', run: function () { ctx.openLibrary(); } }]) }];
    const apps = all.filter(function (g) { return g.kind === 'app'; });
    if (apps.length) chans.push({ name: 'Apps', color: '#2b78c2', items: apps.map(function (g) { return { g: g }; }) });
    chans.push({ name: 'My Xbox', color: '#c46a12', items: sys.map(function (s) { return { name: s.name, icon: s.icon, run: s.run }; }) });
    ci = Math.min(ci, chans.length - 1);
    chans.forEach(function (c, k) { pos[k] = Math.min(pos[k] || 0, c.items.length - 1); });
    paint();
  }

  function card(it, depth, k, chanIndex) {
    const el = h('div.nxe-card');
    if (it.g) {
      el.appendChild(h('div.cart', { style: { backgroundImage: css(it.g.cover) } }, it.g.cover ? null : h('div.cnoart', it.g.name)));
      if (status(it.g)) el.appendChild(h('div.nxe-badge', status(it.g)));
    } else {
      el.appendChild(h('div.nxe-sys', h('span', { html: icon(it.icon) }), h('div', it.name)));
    }
    /* the fan: cards behind the front one step right, up and back */
    const x = depth * 15.5, z = -depth * 150, ry = depth > 0 ? -18 : 0;
    el.style.transform = 'translate3d(' + x + 'vw,' + (-depth * 1.2) + 'vh,' + z + 'px) rotateY(' + ry + 'deg)';
    el.style.zIndex = String(50 - depth);
    el.style.opacity = depth > 4 ? '0' : String(1 - depth * 0.12);
    el.addEventListener('click', function () {
      if (chanIndex === ci && depth === 0) activate();
      else { ci = chanIndex; pos[ci] = k; Sound.move(); paint(); }
    });
    if (it.g) el.addEventListener('contextmenu', function (e) { e.preventDefault(); ctx.options(it.g.id); });
    return el;
  }

  function paint() {
    stage.textContent = '';
    clock.textContent = clockText();
    root.querySelector('.nxe-sky').style.setProperty('--chan', (chans[ci] || {}).color || '#4f9a1c');
    chans.forEach(function (c, k) {
      const off = k - ci;
      if (Math.abs(off) > 1) return;
      const lane = h('div.nxe-lane' + (off === 0 ? '.on' : ''), { style: { transform: 'translateY(' + (off * 64) + 'vh)' } });
      lane.appendChild(h('div.nxe-cname', c.name));
      const deck = h('div.nxe-deck');
      const p = pos[k] || 0;
      c.items.forEach(function (it, n) {
        const depth = n - p;
        if (depth < 0 || depth > 5) return;
        deck.appendChild(card(it, depth, n, k));
      });
      lane.appendChild(deck);
      const it = c.items[p];
      if (off === 0 && it) {
        lane.appendChild(h('div.nxe-info', h('div.nxe-t', it.g ? it.g.name : it.name), h('div.nxe-s', it.g ? (status(it.g) || infoLine(it.g)) : '')));
        Music.want(it.g ? it.g.music : null);
      }
      stage.appendChild(lane);
    });
  }

  function activate() {
    const c = chans[ci];
    const it = c && c.items[pos[ci] || 0];
    if (!it) return;
    if (it.g) { ctx.play(it.g.id, stage.querySelector('.nxe-lane.on .nxe-card')); return; }
    Sound.press();
    it.run();
  }

  function key(a) {
    const c = chans[ci];
    if (a === 'left' || a === 'right') {
      const n = Math.max(0, Math.min(c.items.length - 1, (pos[ci] || 0) + (a === 'left' ? -1 : 1)));
      if (n !== pos[ci]) { pos[ci] = n; Sound.move(); paint(); }
      return true;
    }
    if (a === 'up' || a === 'down') {
      const n = Math.max(0, Math.min(chans.length - 1, ci + (a === 'up' ? -1 : 1)));
      if (n !== ci) { ci = n; Sound.move(); paint(); }
      return true;
    }
    if (a === 'ok') { activate(); return true; }
    if (a === 'options') { const it = c.items[pos[ci] || 0]; if (it && it.g) { Sound.open(); ctx.options(it.g.id); } return true; }
    return true;
  }

  onState(function (w) { if (visible && (w === 'lib' || w === 'running')) build(); });
  setInterval(function () { if (visible) clock.textContent = clockText(); }, 5000);

  return {
    show: function () { visible = true; root.hidden = false; build(); },
    hide: function () { visible = false; root.hidden = true; },
    key: key,
    blurRow: function () {},
    takeFocus: function () { paint(); },
    refreshSaves: function () { paint(); }
  };
}
