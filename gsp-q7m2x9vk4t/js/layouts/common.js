/* Shared bits for the console home layouts. */
import { h, css, fmtAgo, fmtPlay, fmtBytes } from '../dom.js';
import { St, isRunning } from '../state.js';

/* every game you can see (games + apps), newest played first */
export function recentGames() {
  return Array.from(St.games.values()).filter(function (g) { return !g.hidden; }).sort(function (a, b) {
    return Math.max(b.lastPlayed, b.added) - Math.max(a.lastPlayed, a.added);
  });
}

export function art(g, cls) {
  const el = h('div.' + (cls || 'cart'), { style: { backgroundImage: css(g && g.cover) } });
  if (g && !g.cover) el.appendChild(h('div.cnoart', g.name));
  return el;
}

export function status(g) {
  if (St.active === g.id) return 'Playing';
  if (isRunning(g.id)) return 'Quick Resume';
  if (St.missing.has(g.id)) return 'Missing';
  return '';
}

export function playLabel(g) { return isRunning(g.id) ? 'Resume' : 'Start'; }

const sizes = new Map();
export function saveSize(id, cb) {
  if (sizes.has(id)) { cb(sizes.get(id)); return; }
  window.gs.invoke('saves:info', id).then(function (r) {
    if (!r || typeof r.size !== 'number') return;
    sizes.set(id, r.size);
    cb(r.size);
  });
}
export function forgetSave(id) { if (id) sizes.delete(id); else sizes.clear(); }

export function infoLine(g) {
  const bits = [];
  bits.push(g.lastPlayed ? 'Played ' + fmtAgo(g.lastPlayed).toLowerCase() : 'Never played');
  if (g.playTime > 0) bits.push(fmtPlay(g.playTime) + ' played');
  return bits.join('  ·  ');
}
export { fmtBytes };

export function clockText() { return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
export function dateText(opts) { return new Date().toLocaleDateString(undefined, opts || { weekday: 'short', month: 'numeric', day: 'numeric' }); }

/* a list you move through with left/right (or up/down), wrapping off */
export function clampIndex(i, n) { return Math.max(0, Math.min(n - 1, i)); }

/* the standard shortcuts every layout offers, so nothing is ever hard to find */
export function systemItems(ctx) {
  /* on the phone: no adding games or opening the screenshots folder (those are PC things) */
  if (window.gs && window.gs.platform === 'phone') return systemList(ctx).filter(function (x) { return x.id !== 'add' && x.id !== 'shots'; });
  return systemList(ctx);
}
function systemList(ctx) {
  return [
    { id: 'lib', name: 'Game Library', icon: 'grid', run: function () { ctx.openLibrary(); } },
    { id: 'add', name: 'Add games', icon: 'plus', run: function () { ctx.openAdd(); } },
    { id: 'saved', name: 'Saved Data', icon: 'save', run: function () { ctx.openSaved(); } },
    { id: 'shots', name: 'Screenshots', icon: 'camera', run: function () { window.gs.invoke('shell:open', 'captures'); } },
    { id: 'settings', name: 'Settings', icon: 'gear', run: function () { ctx.openSettings(); } },
    { id: 'power', name: 'Power', icon: 'power', run: function () { ctx.power(); } }
  ];
}
