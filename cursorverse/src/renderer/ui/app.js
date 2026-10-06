// CursorVerse UI shell: sidebar, quick toggles, background and page router.
import { h, $, toast } from './lib.js';
import { state, initState, onSettings, set, refreshMyCursors } from './state.js';
import { backgroundLayer } from './components.js';
import { nav } from './nav.js';

import home from './pages/home.js';
import cursors from './pages/cursors.js';
import customize from './pages/customize.js';
import editor from './pages/editor.js';
import effects from './pages/effects.js';
import sounds from './pages/sounds.js';
import music from './pages/music.js';
import browser from './pages/browser.js';
import backgrounds from './pages/backgrounds.js';
import appsPage from './pages/apps.js';
import voice from './pages/voice.js';
import presets from './pages/presets.js';
import settingsPage from './pages/settings.js';
import helpPage from './pages/help.js';
import { helpButton, startTour } from './help-ui.js';
import { initHelpMode, setHelpMode, isHelpMode, toggleBotPanel } from './help-mode.js';

const PAGES = [home, cursors, customize, editor, effects, sounds, music, browser, backgrounds, appsPage, voice, presets, settingsPage, helpPage];
const cv = window.cv;

let current = null;
let cleanup = null;
let bg = null;

export function go(id, arg) {
  const page = PAGES.find((p) => p.id === id) || home;
  cleanup?.();
  cleanup = null;
  current = page;
  for (const b of document.querySelectorAll('#side button')) b.classList.toggle('active', b.dataset.id === page.id);
  const main = $('#main');
  const browserEl = $('#browser-page');
  if (page.persistent) {
    main.classList.add('hidden');
    browserEl.classList.remove('hidden');
    page.show?.(browserEl, arg);
    bg?.pause(true);
    return;
  }
  browser.hide?.();
  browserEl.classList.add('hidden');
  main.classList.remove('hidden');
  bg?.pause(false);
  main.replaceChildren();
  main.scrollTop = 0;
  cleanup = page.render(main, arg) || null;
  addHelpButton(main, page);
}

// Every page head gets a "❓ What does this do?" button.
function addHelpButton(main, page) {
  const head = main.querySelector('.page-head');
  const btn = page.id !== 'help' && helpButton(page.id);
  if (head && btn) head.append(btn);
}

function rerender() {
  if (!current || current.persistent) return;
  const main = $('#main');
  const scroll = main.scrollTop;
  cleanup?.();
  main.replaceChildren();
  cleanup = current.render(main) || null;
  addHelpButton(main, current);
  main.scrollTop = scroll;
}

function buildSide() {
  const side = $('#side');
  side.replaceChildren(
    ...PAGES.map((p) => h('button', { dataset: { id: p.id }, onclick: () => go(p.id) }, h('span', { class: 'emoji' }, p.emoji), p.title)),
    h('div', { class: 'ver' }, `v${state.info.version || ''} · made with 💜`),
  );
}

function buildQuick() {
  const s = state.settings;
  const m = state.music;
  const q = (label, emoji, on, fn, title) => h('button', { class: `qbtn ${on ? 'on' : 'off'}`, onclick: fn, title }, emoji, label);
  $('#quick').replaceChildren(
    q('Cursor', '🖱️', s.cursor.enabled, () => set({ cursor: { enabled: !s.cursor.enabled } }), 'Custom cursor on/off'),
    q('Effects', '✨', s.effectsEnabled, () => set({ effectsEnabled: !s.effectsEnabled }), 'Trails and click effects on/off'),
    q('Sounds', '🔊', s.sounds.enabled, () => set({ sounds: { enabled: !s.sounds.enabled } }), 'Typing sounds on/off'),
    q('Voice', '🎤', s.voice.enabled, () => set({ voice: { enabled: !s.voice.enabled } }), 'Voice control on/off'),
    h('div', { class: 'qbtn mini-player' },
      h('button', { class: 'qbtn', style: { border: 'none', padding: '0 4px', background: 'none' }, onclick: () => cv.music.cmd({ action: 'toggle' }), title: 'Play / pause' }, m.playing ? '⏸' : '▶'),
      h('button', { class: 'qbtn', style: { border: 'none', padding: '0 4px', background: 'none' }, onclick: () => cv.music.cmd({ action: 'next' }), title: 'Next song' }, '⏭'),
      h('span', { class: 'name', onclick: () => go('music') }, m.name || 'Music')),
    h('button', { class: 'qbtn on', onclick: async () => { await cv.presets.random(); toast('🎲 New random combo!', 'good'); }, title: 'Random cursor, trail, click effect and sounds' }, '🎲', 'Random'),
    h('button', { id: 'help-mode-btn', class: `qbtn ${isHelpMode() ? 'helping' : 'on'}`, onclick: () => setHelpMode(!isHelpMode()), title: 'Help mode: click anything to see what it does' }, '❓', isHelpMode() ? 'Exit help' : 'Help mode'),
    h('button', { class: 'qbtn on help-exempt', onclick: () => toggleBotPanel(), title: 'Ask the help bot a question' }, '🤖', 'Ask'),
    state.update?.status === 'available' ? h('button', { class: 'qbtn update', onclick: () => go('settings'), title: 'A new version is ready' }, '⬆', `Update ${state.update.latest}`) : null,
  );
}

function applyTheme() {
  const s = state.settings;
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.style.setProperty('--accent', s.accent || '');
  if (!s.accent) document.documentElement.style.removeProperty('--accent');
  cv.app.titlebar(s.theme);
}

function applyBackground() {
  const s = state.settings;
  if (!bg) bg = backgroundLayer($('#bg'), s.background.app, s.lowPower);
  else bg.update(s.background.app);
}

async function start() {
  nav.go = go;
  initHelpMode(() => buildQuick());
  document.body.append(h('div', { class: 'help-mode-banner help-exempt' }, '❓ Help mode: click anything with a blue outline to see what it does · Esc to exit'));
  nav.refresh = rerender;
  await initState();
  applyTheme();
  applyBackground();
  buildSide();
  buildQuick();
  browser.mount($('#browser-page'), go);
  go('home');
  if (state.settings.firstRun) set({ firstRun: false });
  // everyone sees the tour once (you can replay it from ❓ Help)
  if (!state.settings.tourDone) setTimeout(() => startTour(() => set({ tourDone: true })), 900);

  const updatedToast = (u) => { if (u?.status === 'updated') toast(`🎉 Updated to ${u.current}!`, 'good', 6000); };
  state.update = await cv.update.state();
  updatedToast(state.update);
  cv.update.onState((u) => {
    if (u?.status !== state.update?.status) updatedToast(u);
    state.update = u;
    buildQuick();
    current?.onUpdate?.(u);
  });
  buildQuick();

  onSettings((s, changed, from) => {
    if (changed.includes('theme') || changed.includes('accent')) applyTheme();
    if (changed.includes('background') || changed.includes('lowPower')) {
      if (changed.includes('lowPower')) { bg?.destroy(); bg = null; }
      applyBackground();
      browser.onSettings?.(s, changed);
    }
    if (changed.includes('browser')) browser.onSettings?.(s, changed);
    buildQuick();
    if (changed.includes('music') && from === 'music') { current?.onMusic?.(); return; }
    // changes made outside this page (tray, hotkeys, random, presets) redraw it
    if (from !== 'local') {
      if (current?.onSettings) current.onSettings(s, changed); else rerender();
    } else if (changed.includes('myCursors')) {
      if (current?.onMyCursors) current.onMyCursors(); else rerender();
    }
  });

  cv.on.nav((page) => go(page));
  cv.on.openTab((url) => { go('browser'); browser.openTab(url); });
  cv.on.browserShortcut((name) => browser.shortcut(name));
  cv.cursor.onStatus((st) => { if (!st.ok && st.message) toast(`⚠️ ${st.message}`, 'bad', 6000); });
  cv.hotkeys.onStatus((fails) => { if (fails.length) console.warn('hotkeys not registered:', fails); });

  // Global app shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 't' && !e.shiftKey) { e.preventDefault(); go('browser'); browser.newTab(); }
  });
}

export { refreshMyCursors };
start().catch((err) => {
  console.error(err);
  document.body.append(h('div', { class: 'bad-box', style: { position: 'fixed', top: '60px', left: '240px', zIndex: 99 } }, `Something broke while starting: ${err.message}`));
});
