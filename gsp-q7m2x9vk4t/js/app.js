/* Game System 3 — the screens. */
import { h, $, css } from './dom.js';
import { icon, setIconSet } from './icons.js';
import { St, wire, loadLibrary, loadSettings, setRunning, onState, hasApps, setSetting, PHONE } from './state.js';
import { pushHandler, setFocus, moveFocus, onPadKind, setPaused, setIdle, fire } from './input.js';
import { Sound } from './sound.js';
import { Music } from './music.js';
import { Bg } from './bg.js';
import { makeToaster } from './toast.js';
import { makeHome } from './home.js';
import { makeLibrary } from './library.js';
import { makeSaved } from './saved.js';
import { makeSettings } from './settings.js';
import { makeOptions } from './gameopts.js';
import { initAdd, openAdd, openGs2, handleResults, wireDrop } from './addgames.js';
import { anyModal, modal, menu, confirm } from './modal.js';
import { askBoost, boostResultText } from './booster-ui.js';
import { refreshOwn } from './ownmusic.js';
import { openTasks } from './taskmgr.js';
import { openBackpack } from './backpack.js';
import { openPhoneCopy } from './phonecopy.js';
import { addLogo } from './covermaker.js';
import { currentHoliday, endsText } from './holidays.js';
import { STYLES, styleById, buttonPack } from './styles.js';
import { make as makePs4 } from './layouts/ps4.js';
import { make as makeXmb } from './layouts/xmb.js';
import { make as makePs2 } from './layouts/ps2.js';
import { make as makeXbox } from './layouts/xbox.js';
import { make as makeNxe } from './layouts/nxe.js';
import { make as makeBlades } from './layouts/blades.js';
import { make as makeSwitch } from './layouts/switch.js';
import { make as makeWii } from './layouts/wii.js';
import { make as make3ds } from './layouts/threeds.js';
import { make as makeSteam } from './layouts/steam.js';
import { make as makeDc } from './layouts/dreamcast.js';

const toast = makeToaster($('#toasts'));
initAdd(toast);

let screen = 'home';
let topFocus = null; /* element in the top bar that has focus, or null */
let launching = null;

const ctx = {
  toast: toast,
  play: play,
  options: function (id) { opts.open(id); },
  openLibrary: function () { go('library'); },
  openAdd: openAdd,
  openGs2: function () { openGs2(); },
  openSaved: function (id) { go('saved', id); },
  openSettings: function (cat) { go('settings', null, cat ? { cat: cat } : null); },
  search: function () { go('library', null, { search: true }); },
  tasks: function () { openTasks(toast); },
  backpack: function () { openBackpack(toast); },
  phone: function () { openPhoneCopy(toast); },
  phoneHelp: function () {
    modal({ title: 'Copy from my PC', lead: 'On your PC open Game System 3: Settings > System > Copy to my phone. A code shows up. Point this phone\'s camera at it, tap the link, then "Copy to my phone". Phone and PC on the same Wi-Fi.', actions: [{ label: 'OK', kind: 'primary', default: true }] });
  },
  power: function () {
    if (PHONE) {
      menu('Game System 3', [
        { label: 'Full screen', icon: 'expand', onClick: function () { window.gs.invoke('win:fullscreen'); } },
        { label: 'Copy from my PC', icon: 'phone', onClick: function () { ctx.phoneHelp(); } }
      ].concat(window.gs.canInstall && window.gs.canInstall() ? [{ label: 'Add to home screen', icon: 'download', desc: 'Opens like an app, and your phone won\'t clear your games to free up space', onClick: function () { window.gs.invoke('win:install'); } }] : []));
      return;
    }
    menu('Power', [
      { label: 'Quit Game System 3', icon: 'power', desc: 'Closes all the way', onClick: function () { window.gs.invoke('power:quit'); } },
      { label: 'Task manager', icon: 'monitor', desc: 'See what\'s running on your PC and close it', onClick: function () { openTasks(toast); } },
      { label: 'BACKPACK', icon: 'box', desc: 'Get disk space back (clean up, find what\'s big, pack)', onClick: function () { openBackpack(toast); } },
      { label: 'Restart Game System 3', icon: 'restart', onClick: function () { window.gs.invoke('power:restart'); } }
    ], { cls: 'm-power' });
  },
  savesChanged: function (id) { home.refreshSaves(id); }
};
const opts = makeOptions(ctx);

/* ---------- the home screen: Game System 3's own, or a console style ---------- */
const ownHome = makeHome($('#home'), ctx);
const MAKERS = { ps4: makePs4, xmb: makeXmb, ps2: makePs2, xbox: makeXbox, nxe: makeNxe, blades: makeBlades, switch: makeSwitch, wii: makeWii, '3ds': make3ds, steam: makeSteam, dreamcast: makeDc };
const built = { own: ownHome };
let layoutName = 'own';
function layoutOf(name) {
  if (!built[name]) {
    const root = h('section.screen.home-layout', { hidden: true, id: 'home-' + name });
    $('#screens').appendChild(root);
    built[name] = MAKERS[name](root, ctx, St.settings.homeStyle);
  }
  return built[name];
}
function curHome() { return layoutOf(layoutName); }
const home = {
  show: function () { curHome().show(); },
  hide: function () { Object.keys(built).forEach(function (k) { built[k].hide(); }); },
  key: function (a) { return curHome().key(a); },
  blurRow: function () { const l = curHome(); if (l.blurRow) l.blurRow(); },
  takeFocus: function () { const l = curHome(); if (l.takeFocus) l.takeFocus(); },
  refreshSaves: function (id) { const l = curHome(); if (l.refreshSaves) l.refreshSaves(id); }
};
let styleId = null;
function applyStyle() {
  const st = styleById(St.settings.homeStyle);
  const changed = st.id !== styleId;
  styleId = st.id;
  document.body.dataset.style = st.id;
  /* every screen (not just home) wears the console's look */
  document.body.dataset.skin = st.skin || '';
  setIconSet(st.skin || '');
  if (changed) window.gs.send('kit:look', { style: st.id, skin: st.skin || '', name: st.name });
  const hb = St.settings.homeBackground || 'style';
  Bg.setMode(hb === 'style' ? (st.bg || 'game') : hb);
  const bs = St.settings.buttonSounds || 'style';
  Sound.usePack(buttonPack(bs === 'style' ? st.pack : bs));
  /* holidays: their theme + music come by themselves (your own music pick still wins) */
  const hol = currentHoliday(St.info && St.info.now ? new Date(St.info.now) : new Date(), St.settings.holidaysOff);
  document.body.dataset.holiday = hol ? hol.theme : '';
  const chip = $('#holiday');
  chip.hidden = !hol;
  if (hol) chip.textContent = hol.name + '  ·  ' + endsText(hol, St.info && St.info.now ? new Date(St.info.now) : new Date());
  const mm = St.settings.menuMusic || 'style';
  Music.setBase(mm === 'off' ? null : mm === 'style' ? ((hol && hol.music) || st.music) : mm);
  const next = st.layout;
  if (next !== layoutName || (changed && next === 'xmb')) {
    const wasHome = screen === 'home' && !$('#app').hidden;
    home.hide();
    if (next === 'xmb' && built.xmb) { built.xmb.hide(); delete built.xmb; const old = $('#home-xmb'); if (old) old.remove(); }
    layoutName = next;
    if (wasHome) { curHome().show(); }
  }
  document.body.classList.toggle('console-home', screen === 'home' && layoutName !== 'own');
  if (changed) {
    renderTabs();
    /* the home drew itself before the new look was on: draw it again in the new look (PS5 logo title, icons) */
    if (screen === 'home' && !$('#app').hidden && !St.active) curHome().show();
  }
}
function gameStartSound() {
  /* a console's startup chime never plays when a game starts (older versions let you pick one) */
  const v = St.settings.gameStartSound || 'style';
  return v === 'style' || /^boot-/.test(v) ? styleById(St.settings.homeStyle).gameStart : v;
}
const library = makeLibrary($('#library'), ctx);
const saved = makeSaved($('#saved'), ctx);
const settings = makeSettings($('#settings'), ctx);
const SCREENS = { home: home, library: library, saved: saved, settings: settings };

/* ---------- top bar ---------- */
function renderTabs() {
  const tabs = $('#tabs');
  tabs.textContent = '';
  const list = [];
  if (screen === 'home') {
    list.push({ k: 'game', label: 'Games' });
    /* a real PS5 calls its second tab Media */
    if (hasApps()) list.push({ k: 'app', label: document.body.dataset.skin === 'ps5' ? 'Media' : 'Apps' });
  } else {
    list.push({ k: 'back', label: { library: 'Game Library', saved: 'Saved Data', settings: 'Settings' }[screen] });
  }
  list.forEach(function (t) {
    const b = h('button.tab' + ((screen === 'home' ? St.tab === t.k : true) ? '.on' : ''), { 'data-nav': 'top', dataset: { tab: t.k }, onclick: function () {
      if (t.k === 'back') { go('home'); return; }
      if (St.tab !== t.k) { St.tab = t.k; Sound.move(); renderTabs(); home.show(); }
    } }, screen === 'home' ? t.label : h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '10px' } }, h('span', { html: icon('back'), style: { width: '18px', display: 'inline-flex' } }), t.label));
    tabs.appendChild(b);
  });
}
$('#btn-add').innerHTML = icon('plus');
$('#btn-search').innerHTML = icon('search');
$('#btn-settings').innerHTML = icon('gear');
$('#btn-power').innerHTML = icon('power');
$('#btn-power').addEventListener('click', function () { Sound.press(); ctx.power(); });
/* the profile picture at the top right (PS5, PS4, Xbox looks): opens the same Power menu, like a console's profile menu */
$('#avatar').innerHTML = icon('user');
$('#avatar').addEventListener('click', function () { Sound.press(); ctx.power(); });
$('#btn-add').addEventListener('click', function () { Sound.open(); openAdd(); });
$('#btn-search').addEventListener('click', function () { Sound.press(); go('library', null, { search: true }); });
$('#btn-settings').addEventListener('click', function () { Sound.press(); go('settings'); });

/* only what's on screen (a console look can hide the top right, like the PS5's Settings) */
function topItems() { return Array.from(document.querySelectorAll('.topbar [data-nav="top"]')).filter(function (x) { return x.offsetParent !== null; }); }
function focusTop(el) {
  topItems().forEach(function (x) { x.classList.remove('focus'); });
  topFocus = el;
  if (el) el.classList.add('focus');
}
function leaveTop() {
  focusTop(null);
  const s = SCREENS[screen];
  if (s.takeFocus) s.takeFocus();
}

/* ---------- screens ---------- */
function go(name, arg, opt) {
  if (launching) return;
  const prev = screen;
  if (prev !== name) Sound.press();
  Object.keys(SCREENS).forEach(function (k) { if (k !== name) SCREENS[k].hide(); });
  screen = name;
  document.body.dataset.screen = name;
  focusTop(null);
  renderTabs();
  document.body.classList.toggle('console-home', name === 'home' && layoutName !== 'own');
  /* only the home screen shows a game's art; Library, Settings, Saved Data show the console's own background */
  if (name !== 'home') { Bg.set(null); Music.want(null); }
  if (name === 'home') home.show();
  else if (name === 'library') library.show(opt);
  else if (name === 'saved') saved.show(arg);
  else if (name === 'settings') settings.show(opt);
  hints();
}

/* ---------- playing (PS5-style: the tile zooms to fill the screen, then the game is there) ---------- */
async function play(id, fromEl, skipCheck) {
  if (launching) return;
  const g = St.games.get(id);
  if (!g) return;
  launching = id;
  Sound.launch(gameStartSound());
  Music.pause();
  const L = $('#launch');
  L.textContent = '';
  const art = fromEl && (fromEl.classList.contains('art') ? fromEl : fromEl.querySelector('.art'));
  const r = art ? art.getBoundingClientRect() : { left: innerWidth / 2 - 80, top: innerHeight / 2 - 80, width: 160, height: 160 };
  const zoom = h('div.zoom', { style: { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', backgroundImage: css(g.cover) } });
  const resuming = St.running.some(function (x) { return x.id === id; });
  const name = h('div.lname', g.name, h('small', resuming ? 'Resuming' : 'Starting'));
  L.appendChild(zoom);
  L.appendChild(name);
  L.appendChild(h('div.spinner.lspin'));
  L.style.background = 'transparent';
  L.hidden = false;
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { zoom.classList.add('full'); L.classList.add('show'); L.style.background = '#000'; L.style.transition = 'background .42s'; });
  });
  const wait = new Promise(function (res) { setTimeout(res, St.settings.reduceMotion ? 60 : resuming ? 420 : 650); });
  await wait;
  const res = await window.gs.invoke('games:launch', id, { skipCheck: !!skipCheck });
  if (res && res.needBoost) {
    /* heavy game, busy PC: ask before it opens */
    L.hidden = true;
    L.classList.remove('show');
    launching = null;
    const ans = await askBoost({
      title: g.name + ' is a heavy one',
      lead: 'Your PC is busy right now (CPU ' + res.busy.cpu + '%, ' + (res.busy.freeMb >= 1024 ? (res.busy.freeMb / 1024).toFixed(1) + ' GB' : res.busy.freeMb + ' MB') + ' memory free). Want me to close the stuff slowing it down first? Next time I\'ll do it by myself.',
      procs: res.procs
    });
    if (!ans) { Music.resume(); return; }
    if (!ans.yes) await window.gs.invoke('booster:pref', id, 'never');
    await play(id, fromEl, true);
    if (ans.yes) {
      const r = await window.gs.invoke('booster:run', id, ans.keys, ans.power);
      window.gs.invoke('overlay:toast', { kind: 'good', icon: 'zap', text: boostResultText(r) }).catch(function () {});
    }
    return;
  }
  if (!res || !res.ok) {
    L.hidden = true;
    L.classList.remove('show');
    launching = null;
    Music.resume();
    Sound.error();
    if (res && res.error === 'missing') {
      modal({
        title: g.name + ' is missing',
        lead: 'Its folder was moved or deleted. Show me where it is now, or remove it from the library.',
        actions: [
          { label: 'Remove it', kind: 'danger', onClick: function () { opts.remove(id); } },
          { label: 'Find its folder', kind: 'primary', default: true, onClick: async function () { await window.gs.invoke('lib:relink', id); await loadLibrary(); } }
        ]
      });
    } else toast({ kind: 'bad', title: 'Couldn\'t start ' + g.name, text: (res && res.error) || 'Something went wrong.' });
    return;
  }
  setPaused(true);
  /* the launch screen stays behind the game so coming back looks clean */
  setTimeout(function () { L.hidden = true; L.classList.remove('show'); launching = null; }, 600);
}

function onBackHome() {
  setPaused(false);
  Sound.home();
  Music.resume();
  if (screen === 'home') home.show();
  hints();
  /* an update showed up while playing (or was missed): remind on the way back */
  if (St.update) setTimeout(function () { if (!St.active && St.update) updateCard(St.update); }, 1200);
}

/* ---------- keys + controller ---------- */
pushHandler(function (action) {
  if (launching) return true;
  if (St.active) return true;
  if (action === 'guide') { window.gs.send('quickmenu:toggle'); return true; }
  const s = SCREENS[screen];
  if (topFocus) {
    const items = topItems();
    const i = items.indexOf(topFocus);
    if (action === 'left' || action === 'right') {
      const n = items[i + (action === 'left' ? -1 : 1)];
      if (n) { focusTop(n); Sound.move(); }
      return true;
    }
    if (action === 'down' || action === 'back') { leaveTop(); Sound.move(); return true; }
    if (action === 'ok') { topFocus.click(); return true; }
    if (action === 'up') return true;
  }
  const used = s.key(action);
  if (used !== false) return true;
  if (action === 'up') {
    if (s.blurRow) s.blurRow(); else if (s.blur) s.blur();
    focusTop(topItems()[0]);
    Sound.move();
    return true;
  }
  if (action === 'back' && screen !== 'home') { go('home'); Sound.back(); return true; }
  if ((action === 'prev' || action === 'next') && screen === 'home' && hasApps()) {
    St.tab = St.tab === 'game' ? 'app' : 'game';
    Sound.move();
    renderTabs();
    home.show();
    return true;
  }
  return true;
});

/* hints at the bottom right: keyboard, or PlayStation / Xbox buttons when a controller is plugged in */
let pad = null;
const GLYPH = {
  ps: { ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 7l10 10M17 7 7 17"/></svg>', back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="6"/></svg>', options: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5.5 19 17.5H5z"/></svg>' },
  xbox: { ok: 'A', back: 'B', options: 'Y' }
};
function hints() {
  const el = $('#hints');
  el.textContent = '';
  const k = function (g, text, isPad) { return h('span.hint', h('span.key' + (isPad ? '.pad' : ''), { html: g }), text); };
  if (pad) {
    const G = GLYPH[pad];
    el.appendChild(k(G.ok, screen === 'home' ? 'Play' : 'Select', true));
    el.appendChild(k(G.back, 'Back', true));
    el.appendChild(k(G.options, 'Options', true));
    el.appendChild(k(pad === 'ps' ? 'PS' : 'X', 'Quick menu', true));
  } else {
    el.appendChild(k('Enter', screen === 'home' ? 'Play' : 'Select'));
    el.appendChild(k('Esc', 'Back'));
    el.appendChild(k('F1', 'Quick menu'));
    el.appendChild(k('F12', 'Screenshot'));
  }
}
onPadKind(function (k) { pad = k; hints(); });

/* ---------- clock ---------- */
function tick() {
  $('#clock').textContent = new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
setInterval(tick, 5000);
tick();
/* a holiday starts or ends at midnight, even while resting for days */
let lastDay = new Date().getDate();
setInterval(function () { const d = new Date().getDate(); if (d !== lastDay) { lastDay = d; applyStyle(); } }, 60000);

/* ---------- settings that change how the screens look/sound ---------- */
function applySettings() {
  const s = St.settings;
  Sound.setVolume(typeof s.menuSounds === 'number' ? s.menuSounds : 0.7);
  Music.set(s.homeMusic !== false, typeof s.homeMusicVolume === 'number' ? s.homeMusicVolume : 0.35);
  document.documentElement.style.setProperty('--fs', String((s.textSize || 100) / 100));
  document.body.classList.toggle('bold', !!s.boldText);
  document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
  applyStyle();
}
onState(function (w) {
  if (w === 'settings') applySettings();
  if (w === 'lib' && screen === 'home') renderTabs();
});

/* ---------- messages from the app ---------- */
window.gs.on('games:state', function (s) {
  const wasActive = St.active;
  setRunning(s);
  if (wasActive && !s.active) onBackHome();
  if (s.active) setPaused(true);
});
window.gs.on('import:auto', function (r) { handleResults(r); });
window.gs.on('toast', function (t) { toast(t); });
/* a heads-up when the PC is almost full, or Game System 3 sits inside OneDrive (it uploads every game) */
setTimeout(async function () {
  try {
    const [g, drives] = await Promise.all([window.gs.invoke('storage:gs3'), window.gs.invoke('storage:drives')]);
    const full = (drives || []).find(function (d) { return d.size && (d.size - d.free) / d.size >= 0.92; });
    if (g && g.inOneDrive) toast({ kind: 'warn', icon: 'box', title: 'Game System 3 is inside OneDrive', text: 'OneDrive uploads every game and backup. BACKPACK can move it out in one click.', timeout: 15000, button: { label: 'Fix it', onClick: function () { openBackpack(toast); } } });
    else if (full) toast({ kind: 'warn', icon: 'box', title: full.name + ' is ' + Math.round((full.size - full.free) / full.size * 100) + '% full', text: 'BACKPACK can get space back without touching your videos.', timeout: 15000, button: { label: 'Open', onClick: function () { openBackpack(toast); } } });
  } catch (e) { /* not important */ }
}, 9000);
/* a cover made by itself: put the game's name on it */
window.gs.on('covers:auto', async function (id) {
  await loadLibrary();
  const g = St.games.get(id);
  if (!g || !g.cover) return;
  try { await addLogo(g, g.logo); await loadLibrary(); } catch (e) { /* keeps the plain cover */ }
});
/* a newer Game System 3 installer showed up in Downloads */
function updateCard(u) {
  St.update = u;
  toast({ kind: 'good', icon: 'download', title: 'Update ready', text: 'Game System 3 ' + u.version + ' is in your Downloads. Your games and saves stay.', timeout: 20000,
    button: { label: 'Install', onClick: installUpdate } });
}
async function installUpdate() {
  const ok = await confirm({ title: 'Install Game System 3 ' + St.update.version + '?', text: 'Game System 3 saves your Quick Resume games, closes, and the update installs. Takes about a minute.', yes: 'Install now' });
  if (ok) window.gs.invoke('app:update-install');
}
ctx.installUpdate = installUpdate;
window.gs.on('update:ready', function (u) { if (!St.active) updateCard(u); else St.update = u; });
window.gs.on('game:crashed', function (c) {
  onBackHome();
  Sound.error();
  modal({
    title: c.name + ' keeps crashing',
    lead: 'It stopped because ' + c.why + '. I tried restarting it from its last save but it stopped again.',
    actions: [{ label: 'OK' }, { label: 'Try again', kind: 'primary', default: true, onClick: function () { play(c.id); } }]
  });
});
window.gs.on('game:loadfail', function (f) {
  toast({ kind: 'warn', title: f.name + ' didn\'t load', text: f.desc || 'It couldn\'t open its page.', timeout: 6000 });
});
window.gs.on('games:quit', function () { onBackHome(); });
window.gs.on('overlay:action', function (a) {
  if (a && a.type === 'settings') { go('settings'); }
  if (a && a.type === 'library') { go('library'); }
  if (a && a.type === 'home') { if (screen !== 'home') go('home'); }
});
/* not the window you're using (another app, minimized, resting): everything sleeps = ~0% CPU */
window.gs.on('app:active', function (on) {
  document.body.classList.toggle('idle', !on);
  setIdle(!on);
  Music.sleep(!on);
  window.dispatchEvent(new CustomEvent('gs-idle', { detail: !on }));
});

/* ---------- boot ---------- */
async function boot() {
  if (PHONE) document.body.classList.add('phone');
  wire();
  wireDrop();
  const infoP = window.gs.invoke('app:info');
  await Promise.all([loadSettings(), loadLibrary(), refreshOwn()]);
  St.info = await infoP;
  setRunning(await window.gs.invoke('games:state'));
  /* menu music waits until the startup sound is done */
  Music.pause();
  applySettings();
  const bootEl = $('#boot');
  const reduce = !!St.settings.reduceMotion;
  let done = false;
  let soundEl = null;
  let musicStarted = false;
  const t0 = performance.now();
  function startMusic() {
    if (musicStarted) return;
    musicStarted = true;
    let wait = 0;
    if (soundEl && isFinite(soundEl.duration)) wait = Math.max(0, soundEl.duration * 1000 - (performance.now() - t0) - 600);
    setTimeout(function () { if (!St.active) Music.resume(); }, wait);
  }
  function finish() {
    if (done) return;
    done = true;
    $('#app').hidden = false;
    renderTabs();
    go('home');
    bootEl.classList.add('gone');
    setTimeout(function () { bootEl.remove(); }, 700);
    window.removeEventListener('keydown', skip, true);
    window.removeEventListener('pointerdown', skip, true);
    startMusic();
    setTimeout(whatsNew, 1200);
  }
  function skip(e) { e.preventDefault(); e.stopPropagation(); finish(); }
  window.addEventListener('keydown', skip, true);
  window.addEventListener('pointerdown', skip, true);
  await document.fonts.ready.catch(function () {});
  if (done) return;
  const st = styleById(St.settings.homeStyle);
  const snd = (St.settings.startupSound || 'style') === 'style' ? st.boot : St.settings.startupSound;
  let ms = 3100;
  if (st.id !== 'gs3') {
    /* the console's own startup look; its startup sound keeps playing while the home screen fades in */
    bootEl.textContent = '';
    bootEl.style.background = '#000';
    bootEl.appendChild(consoleBoot(st));
    ms = 4300;
  }
  bootEl.classList.add('play');
  if (St.settings.bootSound) {
    if (snd === 'gs3') Sound.boot();
    else if (snd && snd !== 'none') soundEl = Sound.playLong(snd, 0.9);
  }
  setTimeout(finish, reduce ? 900 : ms);
}

/* after an update: what's new (once) */
const NOTES = {
  '3.1.0': [
    ['image', 'Console styles', 'Make the home screen look and sound like a PS5, PS4, PS3, PSP, PS2, Xbox Series, Xbox One, Xbox 360, Switch, Wii, 3DS, Steam or Dreamcast. Settings > Look and sound.'],
    ['music', 'Real console sounds', 'Real startup sounds, menu music and button sounds, with pickers for each.'],
    ['zap', 'Game Booster', 'When a game lags I can close what\'s slowing your PC down, give it max power, and turn it down if it still lags.'],
    ['download', 'Update ready', 'Download a new Game System 3 installer and I offer to install it in one click.']
  ],
  '3.1.1': [
    ['check', 'Fixed', 'The little corner pop-ups over games (screenshot saved, Boosted, Quick Resume notes) show up again, and the Update ready card works.']
  ],
  '3.1.2': [
    ['music', 'Real PS5 + PS4 home music', 'The PS5 and PS4 styles now play the real home menu music. GameCube Menu music is in the Menu music picker too.'],
    ['volume', 'Real button sounds', 'Real PS5, PS4, Xbox, Switch and GameCube clicks. New picker: Settings > Look and sound > Button sounds (use any console\'s clicks with any style).'],
    ['check', 'Fixed', 'Console styles played Game System 3\'s own select sound instead of the console\'s. Menu music now picks up where it left off instead of starting over.']
  ],
  '3.2.0': [
    ['image', 'Cover maker', 'Change cover: crop any picture (drag, zoom) and the game\'s name goes on it as a real logo, font matched to the game. Name on cover can be switched off per game.'],
    ['music', 'Your own music', 'Settings > Look and sound > Menu music > Add your own songs. One on repeat or all shuffled, each one leveled so it\'s not too loud.'],
    ['info', 'Game page', 'A game\'s menu > Game page: time played, last played, saved data and its screenshots, all in one place.'],
    ['download', 'Updates fixed', 'The Update ready card comes back if you missed it, and Settings > Updates can install an installer from anywhere.']
  ],
  '3.2.1': [
    ['grid', 'Auto tags', 'Every game gets tags by itself (3D, 2D, FNF, Shooter, Racing, Horror, Clicker, Sandbox, Retro...). Tap a tag in the Library to see only those games.'],
    ['sparkle', 'Holidays', 'Free themes + music by themselves: Halloween all October (it\'s on now), Christmas all December, New Year, and birthdays. Off switches in Settings > Look and sound > Holidays.']
  ],
  '3.2.2': [
    ['moon', 'Almost no CPU in the background', 'When Game System 3 isn\'t the window you\'re using, it sleeps: no animations, music fades out, nothing running. Back the moment you click it.'],
    ['power', 'Easy to close', 'Power button at the top right (Quit, Restart, Task manager).'],
    ['monitor', 'Task manager', 'See what\'s running on your PC and end it, even apps that hide in the taskbar corner like Discord.'],
    ['save', 'Small backups', 'Backups keep only your saves now (no game files), and the old big ones were made small.'],
    ['image', 'Console backgrounds', 'PS5 shows its own background when you\'re not on a game, Xbox always does. Library, Settings and Saved Data show the console\'s background too.'],
    ['volume', 'Fixed: game start sound', 'Starting a game plays that console\'s real sound now, never a startup sound.'],
    ['grid', 'Fixed: wrong tags', 'Tags come from the game\'s name and title now (code words like "flex-shrink" made FNF 2 "Shrinking"). Every game was re-tagged. On a game page: tap a tag to take it off, + Tag to add one.']
  ],
  '3.3.0': [
    ['box', 'BACKPACK: get your space back', 'Power > BACKPACK. Clean up junk (temp files, caches, old installers, crash files, Recycle Bin), see what\'s big with search + filters, pack folders smaller without deleting anything. Your videos are protected.'],
    ['upload', 'Out of OneDrive', 'If Game System 3 was inside OneDrive, it uploaded every game and backup. BACKPACK moves it out in one click, and new installs never go there.'],
    ['zap', 'Fixed: squished game when it lags', 'The lag fix only caps the frame rate now. It used to draw the game smaller, which left it stuck in a corner.']
  ],
  '3.3.1': [
    ['upload', 'Change its files', 'A game\'s menu > Change its files: give a game new files (a fresh download, a fixed version, even a .zip) and its saves, cover and play time stay.']
  ],
  '3.4.0': [
    ['image', 'The whole thing looks like the console now', 'PS5, Xbox, Switch and PS4 styles now change EVERY screen, not just the home: Library, Settings, Saved Data, every pop-up, the corner notifications, the game page, the power menu and the quick menu over games.'],
    ['grid', 'Real console icons + fonts', 'Each console gets its own icons (Xbox uses Microsoft\'s own Fluent icons) and a font that looks like the real one.'],
    ['pad', 'Real highlight + click animations', 'PS5: a white frame that softly breathes. Xbox: the green frame. Switch: the pulsing cyan frame. PS4: the white outline. Pressing something squishes like on the real console.'],
    ['zap', 'Quick menu = the real thing', 'Over a game, F1 / the PS or Xbox button opens the PS5 Control Center, the Xbox Guide, the Switch Quick Settings or the PS4 Quick Menu, depending on your style.'],
    ['sparkle', 'Real PS5 background + new Xbox home', 'The PS5 style uses the real PS5 background (dark with gold sparkles). The Xbox style has the 2023 Xbox Home with the quick icons at the top.'],
    ['power', 'Rest mode is gone', 'The X button and Power > Quit just close Game System 3. It already sleeps at almost 0% CPU when you\'re not using it, so hiding in the taskbar corner wasn\'t worth the confusion.']
  ],
  '3.5.0': [
    ['phone', 'Game System 3 on your phone', 'Settings > System > Copy to my phone: scan the code with your phone\'s camera, tap "Copy to my phone", and your games, saves, covers and console sounds go to Game System 3 on the phone. Same console looks. Works with no internet after that. Copying again only brings what\'s new, and the save you played last (PC or phone) wins.'],
    ['pad', 'New games match the console', 'Games made from now on use the console kit: their menus look like the console you picked here and switch when you pick another one.'],
    ['text', 'Real PlayStation text + PS5 Settings', 'PS5 and PS4 use a font much closer to Sony\'s own (wide letters, one-loop g). PS5 Settings looks like the real one now: thin title, filled icons, thin lines between rows, a thin frame on the picked row, values on the right.']
  ]
};
function newerV(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}
async function whatsNew() {
  const w = await window.gs.invoke('app:whatsnew');
  if (!w || !w.last || w.last === w.now) return; /* brand new install: nothing to tell */
  /* everything new since the version you had */
  const items = [];
  Object.keys(NOTES).sort(function (a, b) { return newerV(a, b) ? 1 : -1; }).forEach(function (v) {
    if (newerV(v, w.last) && !newerV(v, w.now)) items.push.apply(items, NOTES[v]);
  });
  if (!items.length) return;
  const list = h('ul.result-list');
  items.forEach(function (n) { list.appendChild(h('li', h('span.ok-ic', { html: icon(n[0]) }), h('span', h('b', n[1]), ' ', n[2]))); });
  modal({ title: 'New in Game System 3 ' + w.now, body: list, actions: [{ label: 'Nice', kind: 'primary', default: true }] });
}

function consoleBoot(st) {
  const W = {
    ps5: ['ps', 'PS5'], ps4: ['ps ps4', 'PS4'], ps3: ['ps3', 'PS3'], psp: ['psp', 'PSP'], ps2: ['ps2', 'PS2'],
    xbox: ['xb', 'XBOX'], xboxone: ['xb', 'XBOX ONE'], x360nxe: ['xb', 'XBOX 360'], x360blades: ['xb', 'XBOX 360'],
    switch: ['sw', 'Nintendo Switch'], wii: ['wii', 'Wii'], '3ds': ['ds', 'Nintendo 3DS'], steam: ['st', 'STEAM'], dreamcast: ['dc', 'Dreamcast']
  }[st.id] || ['ps', st.name];
  const w = h('div.w');
  if (st.id === 'switch') w.appendChild(h('span.jc', h('i'), h('i')));
  if (st.id === 'dreamcast') w.appendChild(h('span.sw2'));
  w.appendChild(h('span', W[1]));
  return h('div.cboot.' + W[0].split(' ').join('.'), w);
}
boot();
