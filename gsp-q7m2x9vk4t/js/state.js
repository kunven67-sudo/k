/* What the screens know: the game list, what's running, settings. Kept in sync with the app. */
const listeners = new Set();
/* Game System 3 on the phone (phone/gs.js stands in for the PC app) */
export const PHONE = !!(window.gs && window.gs.platform === 'phone');

export const St = {
  games: new Map(),
  layout: [],
  prefs: { sort: 'recent', hiddenOpen: false },
  missing: new Set(),
  running: [],
  active: null,
  settings: {},
  info: {},
  tab: 'game'
};

export function onState(fn) { listeners.add(fn); return function () { listeners.delete(fn); }; }
function emit(what) { listeners.forEach(function (fn) { try { fn(what); } catch (e) { console.error(e); } }); }

export async function loadLibrary() {
  const r = await window.gs.invoke('lib:list');
  St.games = new Map(r.games.map(function (g) { return [g.id, g]; }));
  St.layout = r.layout;
  St.prefs = r.prefs || St.prefs;
  St.missing = new Set(r.missing || []);
  emit('lib');
}

export async function loadSettings() {
  St.settings = await window.gs.invoke('settings:get');
  emit('settings');
}

export async function setSetting(patch) {
  St.settings = await window.gs.invoke('settings:set', patch);
  emit('settings');
}

export function setRunning(state) {
  St.running = state.running || [];
  St.active = state.active || null;
  emit('running');
}

export function isRunning(id) { return St.running.some(function (r) { return r.id === id; }); }

/* games for the current tab, newest played first (that's the home row) */
export function homeGames() {
  const list = Array.from(St.games.values()).filter(function (g) { return !g.hidden && (g.kind === 'app') === (St.tab === 'app'); });
  list.sort(function (a, b) {
    const ra = isRunning(a.id) ? 1 : 0, rb = isRunning(b.id) ? 1 : 0;
    return (Math.max(b.lastPlayed, b.added) - Math.max(a.lastPlayed, a.added)) || rb - ra;
  });
  return list;
}

export function hasApps() { return Array.from(St.games.values()).some(function (g) { return g.kind === 'app'; }); }

let wired = false;
export function wire() {
  if (wired) return;
  wired = true;
  window.gs.on('lib:changed', function () { loadLibrary(); });
  window.gs.on('games:state', function (s) { setRunning(s); });
  window.gs.on('settings:changed', function (s) { St.settings = s; emit('settings'); });
}
export { emit };
