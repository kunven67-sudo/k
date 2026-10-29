/* The layer on top of games.
   Quick menu (F1 / PS / Xbox button, anywhere, even in games): go home, switch between Quick Resume games,
   screenshot, mute, Do Not Disturb, full screen, settings, power.
   Corner pop-ups: small, top right, ~3 seconds, never the middle. */
import { h, $, css } from './dom.js';
import { icon, setIconSet } from './icons.js';
import { pushHandler, moveFocus, setFocus } from './input.js';
import { Sound } from './sound.js';
import { makeToaster } from './toast.js';
import { anyModal } from './modal.js';
import { askBoost, boostResultText } from './booster-ui.js';
import { styleById, buttonPack } from './styles.js';

let menuOpen = false;
let hangOpen = false;
let dnd = false;
let muted = false;
let lastToggle = 0;
let cur = null;
let games = new Map();
let state = { active: null, running: [] };

function mode() {
  if (menuOpen || hangOpen || anyModal()) return 'menu';
  if ($('#toasts').children.length) return 'toast';
  return 'off';
}
let lastMode = 'off';
function syncMode() {
  const m = mode();
  if (m !== lastMode) { lastMode = m; window.gs.send('overlay:mode', m); }
}

const toaster = makeToaster($('#toasts'), function () { syncMode(); });
function toast(t) {
  if (dnd) return;
  toaster(t);
  syncMode();
}

async function loadGames() {
  try {
    const r = await window.gs.invoke('lib:list');
    games = new Map(r.games.map(function (g) { return [g.id, g]; }));
  } catch (e) { /* keep old */ }
}

/* the quick menu + pop-ups over games look and sound like the picked console too */
function applyLook(s) {
  Sound.setVolume(typeof s.menuSounds === 'number' ? s.menuSounds : 0.7);
  const st = styleById(s.homeStyle);
  document.body.dataset.style = st.id;
  document.body.dataset.skin = st.skin || '';
  setIconSet(st.skin || '');
  const bs = s.buttonSounds || 'style';
  Sound.usePack(buttonPack(bs === 'style' ? st.pack : bs));
  document.documentElement.style.setProperty('--fs', String((s.textSize || 100) / 100));
  document.body.classList.toggle('bold', !!s.boldText);
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
}
window.gs.invoke('settings:get').then(applyLook);
window.gs.on('settings:changed', applyLook);

/* ---------- quick menu ---------- */
async function openMenu() {
  if (menuOpen) return;
  menuOpen = true;
  syncMode();
  await loadGames();
  state = await window.gs.invoke('games:state');
  render();
  $('#qm').hidden = false;
  Sound.open();
}
function closeMenu(silent) {
  if (!menuOpen) return;
  menuOpen = false;
  $('#qm').hidden = true;
  $('#qm-sub').hidden = true;
  if (!silent) Sound.back();
  syncMode();
}
function toggle() {
  const now = performance.now();
  if (now - lastToggle < 300) return;
  lastToggle = now;
  if (menuOpen) closeMenu(); else openMenu();
}

function render() {
  const cards = $('#qm-cards');
  const ctrls = $('#qm-ctrls');
  cards.textContent = '';
  ctrls.textContent = '';
  const active = state.active ? games.get(state.active) : null;
  $('#qm-title').textContent = active ? active.name : 'Game System 3';
  const card = function (cls, bg, kick, name, fn) {
    const c = h('button.qcard' + cls, { 'data-f': '', style: bg ? { backgroundImage: css(bg) } : null, onclick: function () { Sound.press(); fn(); } },
      h('div.ql', h('div.qk', kick), h('div.qn', name)));
    return c;
  };
  const homeCard = h('button.qcard.small', { 'data-f': '', onclick: function () { Sound.press(); closeMenu(true); window.gs.invoke('games:home'); window.gs.send('overlay:action', { type: 'home' }); } },
    h('span', { html: icon('home') }), h('div.ql', h('div.qn', 'Home')));
  cards.appendChild(homeCard);
  let first = homeCard;
  if (active) {
    const now = card('.now', active.cover, 'Playing now', active.name, function () { closeMenu(true); });
    cards.appendChild(now);
    first = now;
  }
  (state.running || []).filter(function (r) { return r.id !== state.active; }).forEach(function (r) {
    const g = games.get(r.id);
    if (!g) return;
    cards.appendChild(card('', g.cover, 'Quick Resume', g.name, function () { closeMenu(true); window.gs.invoke('games:launch', g.id); }));
  });
  const libCard = h('button.qcard.small', { 'data-f': '', onclick: function () { Sound.press(); closeMenu(true); window.gs.invoke('games:home'); window.gs.send('overlay:action', { type: 'library' }); } },
    h('span', { html: icon('grid') }), h('div.ql', h('div.qn', 'Library')));
  cards.appendChild(libCard);

  const ctrl = function (ic, label, fn, on, cls) {
    return h('button.qctrl' + (on ? '.on' : '') + (cls || ''), { 'data-f': '', onclick: function () { Sound.press(); fn(); } }, h('span', { html: icon(ic) }), h('span.qlab', label));
  };
  ctrls.appendChild(ctrl('camera', 'Screenshot', function () { closeMenu(true); setTimeout(function () { window.gs.invoke('shot:take'); }, 180); }));
  if (active) {
    ctrls.appendChild(ctrl(muted ? 'mute' : 'volume', muted ? 'Unmute' : 'Mute game', function () { muted = !muted; window.gs.invoke('games:mute', muted); render(); refocusLabel(muted ? 'Unmute' : 'Mute game'); }, muted));
  }
  ctrls.appendChild(ctrl('dnd', 'Do Not Disturb', function () {
    dnd = !dnd;
    render();
    refocusLabel('Do Not Disturb');
  }, dnd));
  ctrls.appendChild(ctrl('expand', 'Full screen', function () { window.gs.invoke('win:fullscreen'); }));
  ctrls.appendChild(ctrl('gear', 'Settings', function () { closeMenu(true); window.gs.invoke('games:home'); window.gs.send('overlay:action', { type: 'settings' }); }));
  if (active) ctrls.appendChild(ctrl('x', 'Close game', function () { closeMenu(true); window.gs.invoke('games:close', active.id); }, false, '.danger'));
  ctrls.appendChild(ctrl('power', 'Power', function () { powerMenu(); }));
  cur = setFocus($('#qm'), cur && document.contains(cur) ? cur : first);
}

function refocusLabel(label) {
  const el = Array.from(document.querySelectorAll('.qctrl')).find(function (b) { return b.textContent === label; });
  if (el) cur = setFocus($('#qm'), el);
}

function powerMenu() {
  const sub = $('#qm-sub');
  sub.textContent = '';
  const b = function (ic, label, fn) { return h('button.qctrl', { 'data-f': '', onclick: function () { Sound.press(); fn(); } }, h('span', { html: icon(ic) }), h('span.qlab', label)); };
  const quit = b('power', 'Quit', function () { window.gs.invoke('power:quit'); });
  sub.appendChild(quit);
  sub.appendChild(b('restart', 'Restart', function () { window.gs.invoke('power:restart'); }));
  sub.hidden = false;
  cur = setFocus($('#qm'), quit);
}

/* ---------- a game that froze ---------- */
function showHang(info) {
  if (hangOpen) return;
  hangOpen = true;
  const box = $('#hang');
  box.textContent = '';
  const wait = h('button.btn', { 'data-f': '', onclick: function () { closeHang(); } }, 'Wait');
  const close = h('button.btn.primary', { 'data-f': '', onclick: function () { closeHang(); window.gs.invoke('games:close', info.id); } }, h('span', { html: icon('x') }), 'Close it');
  box.appendChild(h('div.qm-dim'));
  box.appendChild(h('div.modal.hang-card',
    h('h2', info.name + ' isn\'t responding'),
    h('p.lead', 'It might come back by itself in a few seconds. If you close it, it opens from its last save next time.'),
    h('div.actions', wait, close)));
  box.hidden = false;
  syncMode();
  cur = setFocus(box, close);
  Sound.error();
}
function closeHang() {
  hangOpen = false;
  $('#hang').hidden = true;
  syncMode();
}

/* ---------- keys ---------- */
pushHandler(function (action) {
  const root = hangOpen ? $('#hang') : menuOpen ? $('#qm') : null;
  if (!root) return false;
  if (action === 'guide') { if (!hangOpen) toggle(); return true; }
  if (action === 'back') {
    if (hangOpen) { closeHang(); return true; }
    if (!$('#qm-sub').hidden) { $('#qm-sub').hidden = true; refocusLabel('Power'); Sound.back(); return true; }
    closeMenu();
    return true;
  }
  if (action === 'ok') { if (cur) cur.click(); return true; }
  if (/^(up|down|left|right)$/.test(action)) {
    const next = moveFocus(root, cur, action);
    if (next) { cur = setFocus(root, next); Sound.move(); }
    return true;
  }
  return true;
});
document.addEventListener('pointerdown', function (e) {
  /* clicking the dim area closes the menu */
  if (menuOpen && e.target.classList.contains('qm-dim')) closeMenu();
});
document.addEventListener('mousemove', function (e) {
  const el = e.target.closest && e.target.closest('[data-f]');
  if (el && el !== cur) { cur = setFocus(hangOpen ? $('#hang') : $('#qm'), el); }
});

/* ---------- messages ---------- */
window.gs.on('quickmenu:toggle', toggle);
window.gs.on('games:state', function (s) {
  const wasActive = state.active;
  state = s;
  if (wasActive && !s.active) dnd = false;
  if (wasActive !== s.active) muted = false; /* each game starts with its sound on */
  if (menuOpen) render();
  if (hangOpen && !s.active) closeHang();
});
window.gs.on('toast', function (t) { toast(t); });
window.gs.on('shot', function (s) {
  Sound.shutter();
  const f = $('#flash');
  if (!menuOpen && !hangOpen) { window.gs.send('overlay:mode', 'flash'); lastMode = 'flash'; }
  f.hidden = true;
  void f.offsetWidth;
  f.hidden = false;
  setTimeout(function () { f.hidden = true; syncMode(); }, 330);
  if (!dnd) toaster({ kind: 'shot', thumb: s.thumb, title: 'Screenshot saved', text: s.name, timeout: 3500 });
});
window.gs.on('game:hang', showHang);

/* the game is lagging: ask (the game keeps running behind) */
window.gs.on('booster:ask', async function (q) {
  if (menuOpen) closeMenu(true);
  lastMode = 'menu';
  window.gs.send('overlay:mode', 'menu');
  const ans = await askBoost({
    title: q.name + ' is lagging',
    lead: 'It\'s running at about ' + q.fps + ' FPS. Want me to close the stuff slowing your PC down? Next time I\'ll do it by myself.',
    procs: q.procs
  });
  syncMode();
  lastMode = mode();
  window.gs.send('overlay:mode', lastMode);
  if (!ans) return;
  if (ans.yes) {
    const r = await window.gs.invoke('booster:run', q.id, ans.keys, ans.power);
    toaster({ kind: 'good', icon: 'zap', text: boostResultText(r), timeout: 3500 });
  } else {
    await window.gs.invoke('booster:pref', q.id, 'never');
    toaster({ kind: 'info', text: 'OK, I won\'t ask about ' + q.name + ' again. You can change it in its menu.', timeout: 4000 });
  }
  syncMode();
});
window.gs.on('game:hang-over', function () { if (hangOpen) closeHang(); });

setInterval(function () { $('#qm-clock').textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }, 5000);
$('#qm-clock').textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
