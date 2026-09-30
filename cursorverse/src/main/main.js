// CursorVerse main process: windows, tray, settings, cursor swapping, effects
// overlay, key sounds, voice control, hotkeys and the browser session.
const {
  app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, session, screen, dialog, shell,
  powerMonitor, Notification,
} = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const { DEFAULTS, withDefaults, mergePatch } = require('./defaults');
const { JsonFile } = require('./store');
const library = require('./library');
const win32 = require('./win32');
const { OverlayManager, Hud } = require('./overlay');
const { InputHook, keyName } = require('./input');
const { VoiceController } = require('./voice');
const { AdBlock } = require('./adblock');
const apps = require('./apps');

app.setName('CursorVerse');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
library.registerSchemes();

// Only one CursorVerse at a time (two would fight over the system cursor).
// Launching a different exe (like a newly downloaded version) takes over from
// the running one instead of silently closing itself.
const MY_EXE = String(process.env.PORTABLE_EXECUTABLE_FILE || process.execPath).toLowerCase();
let gotLock = app.requestSingleInstanceLock({ exe: MY_EXE });

async function waitForLock(ms) {
  const until = Date.now() + ms;
  while (!gotLock && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 250));
    gotLock = app.requestSingleInstanceLock({ exe: MY_EXE });
  }
  return gotLock;
}

const SRC = path.join(__dirname, '..');
const startHidden = process.argv.includes('--hidden');
const isTest = !!process.env.CURSORVERSE_TEST;

let userData;
let settingsFile, myCursorsFile, historyFile;
let settings = structuredClone(DEFAULTS);
let myCursors = [];
let history = [];

let uiWin = null;
let engineWin = null;
let tray = null;
let overlay = null;
let hud = null;
let input = null;
let voice = null;
let adblock = null;
let shared = null; // lazily imported ESM data (presets, packs, effects...)
let quitting = false;

const state = {
  foreground: null,
  allowedMain: true,
  allowedVoice: true,
  cursorApplied: false,
  cursorFiles: null,       // { key, files: {normal, link, busy}, size }
  cursorStatus: { ok: true, message: '' },
  music: { playing: false, track: null, name: '', genre: '', position: 0, duration: 0 },
  hotkeyFailures: [],
  pttCapture: null,
  engineReady: false,
};

// ------------------------------------------------------------------ helpers

async function loadShared() {
  if (shared) return shared;
  const imp = (f) => import(pathToFileURL(path.join(SRC, 'shared', f)).href);
  const [presets, packs, effects, lib, bgs, tracks] = await Promise.all([
    imp('presets.mjs'), imp('sound-packs.mjs'), imp('effects.mjs'), imp('cursor-library.mjs'), imp('backgrounds.mjs'), imp('music-tracks.mjs'),
  ]);
  shared = { presets, packs, effects, lib, bgs, tracks };
  return shared;
}

function sendUi(ch, data) {
  if (uiWin && !uiWin.isDestroyed()) uiWin.webContents.send(ch, data);
}
function sendEngine(ch, data) {
  if (engineWin && !engineWin.isDestroyed() && state.engineReady) engineWin.webContents.send(ch, data);
}

function ownExes() {
  const list = [apps.exeName(process.execPath)];
  if (process.env.PORTABLE_EXECUTABLE_FILE) list.push(apps.exeName(process.env.PORTABLE_EXECUTABLE_FILE));
  return list;
}

function exePathForLogin() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

// ------------------------------------------------------------------ settings

function setSettings(patch, { from = 'ui' } = {}) {
  const before = settings;
  settings = withDefaults(mergePatch(settings, patch));
  settingsFile.save(settings);
  const changed = Object.keys(patch || {});
  applySideEffects(before, changed);
  sendUi('settings:changed', { settings, changed, from });
  sendEngine('settings', settings);
  refreshTray();
  return settings;
}

function applySideEffects(before, changed) {
  const has = (...k) => k.some((x) => changed.includes(x));
  if (has('target', 'voice')) state.foreground = '__recheck__';
  if (has('cursor')) requestCursorBuild();
  if (has('cursor', 'target')) updateCursorApplied();
  if (has('effectsEnabled', 'trail', 'click', 'idle', 'target', 'lowPower')) updateOverlay();
  if (has('sounds', 'effectsEnabled', 'click', 'voice')) updateInputHook();
  if (has('voice')) configureVoice();
  if (has('hotkeys')) registerHotkeys();
  if (has('startWithWindows')) applyLoginItem();
  if (has('browser') && before.browser.adblock !== settings.browser.adblock) adblock?.setEnabled(settings.browser.adblock);
}

// ------------------------------------------------------------------ cursor

let buildSeq = 0;
let buildInFlight = false;
let buildQueued = false;

function cursorScale() {
  try { return screen.getPrimaryDisplay().scaleFactor || 1; } catch { return 1; }
}

function requestCursorBuild() {
  if (!state.engineReady) return;
  if (buildInFlight) { buildQueued = true; return; }
  buildInFlight = true;
  const reqId = ++buildSeq;
  sendEngine('cursor:build', { reqId, cursor: settings.cursor, scale: cursorScale() });
  // safety net if the engine never answers
  setTimeout(() => { if (buildInFlight && reqId === buildSeq) { buildInFlight = false; if (buildQueued) { buildQueued = false; requestCursorBuild(); } } }, 15000);
}

function onCursorBuilt(msg) {
  buildInFlight = false;
  if (buildQueued) { buildQueued = false; requestCursorBuild(); }
  // a newer build is on its way; skip applying this in-between one
  if (msg.reqId !== buildSeq) return;
  if (msg.error) {
    state.cursorStatus = { ok: false, message: `Could not draw that cursor: ${msg.error}` };
    sendUi('cursor:status', state.cursorStatus);
    return;
  }
  const dir = path.join(userData, 'active-cursor');
  fs.mkdirSync(dir, { recursive: true });
  const hash = crypto.createHash('sha1');
  const files = {};
  for (const [variant, f] of Object.entries(msg.files)) hash.update(variant).update(Buffer.from(f.bytes));
  const key = hash.digest('hex').slice(0, 12);
  for (const [variant, f] of Object.entries(msg.files)) {
    const file = path.join(dir, `${variant}-${key}.${f.ext}`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(f.bytes));
    files[variant] = file;
  }
  // clean up older builds
  for (const name of fs.readdirSync(dir)) if (!name.includes(key)) { try { fs.unlinkSync(path.join(dir, name)); } catch { /* in use */ } }
  state.cursorFiles = { key, files, size: msg.size };
  state.cursorApplied = false; // force re-apply with the new files
  updateCursorApplied();
}

function updateCursorApplied() {
  const should = settings.cursor.enabled && state.allowedMain && !!state.cursorFiles;
  if (should) {
    if (state.cursorApplied === state.cursorFiles.key) return;
    if (!win32.IS_WIN) {
      state.cursorApplied = state.cursorFiles.key;
      state.cursorStatus = { ok: true, message: 'Preview only: system cursors change on Windows.' };
      sendUi('cursor:status', state.cursorStatus);
      return;
    }
    win32.restoreSystemCursors();
    const res = win32.applySystemCursors(state.cursorFiles.files, settings.cursor.replace, state.cursorFiles.size);
    state.cursorApplied = state.cursorFiles.key;
    state.cursorStatus = res.ok ? { ok: true, message: '' } : { ok: false, message: res.error || `Some cursors could not be set (${(res.failed || []).join(', ')})` };
    sendUi('cursor:status', state.cursorStatus);
  } else if (state.cursorApplied) {
    win32.restoreSystemCursors();
    state.cursorApplied = false;
  }
}

function restoreCursorNow() {
  if (win32.IS_WIN) win32.restoreSystemCursors();
  state.cursorApplied = false;
}

// ------------------------------------------------------------------ foreground app tracking

function tickForeground() {
  if (!win32.IS_WIN) return;
  const fg = win32.foregroundProcess();
  const p = fg?.path || null;
  if (p === state.foreground && fg) return;
  state.foreground = p;
  const main = apps.targetAllows(settings.target, p, ownExes());
  const vc = apps.targetAllows(settings.voice.target, p, ownExes());
  const changed = main !== state.allowedMain;
  state.allowedMain = main;
  state.allowedVoice = vc;
  if (changed) {
    updateCursorApplied();
    overlay?.setVisible(settings.effectsEnabled && main);
  }
}

// ------------------------------------------------------------------ overlay / input / voice

function effectsConfig() {
  return { trail: settings.trail, click: settings.click, idle: settings.idle, lowPower: settings.lowPower };
}

function updateOverlay() {
  if (!overlay) return;
  const anyEffect = settings.trail.enabled || settings.click.enabled || settings.idle.enabled;
  overlay.update(effectsConfig(), settings.effectsEnabled && anyEffect, state.allowedMain);
}

function updateInputHook() {
  if (!input) return;
  const need = settings.sounds.enabled
    || (settings.effectsEnabled && settings.click.enabled)
    || (settings.voice.enabled && settings.voice.mode === 'ptt')
    || !!state.pttCapture;
  input.setRunning(need);
}

function pttMatches(code, isMouse) {
  const k = settings.voice.pttKey;
  return k && ((k.type === 'mouse') === isMouse) && Number(k.keycode) === Number(code);
}

function configureVoice() {
  if (!voice) return;
  hud.enabled = settings.voice.showHud !== false;
  if (!win32.IS_WIN && settings.voice.enabled) {
    voice.setStatus('error', 'Voice control uses Windows speech, so it only works on Windows.');
    return;
  }
  voice.configure(settings.voice).catch((err) => voice.setStatus('error', err.message));
}

// ------------------------------------------------------------------ hotkeys & login item

const HOTKEY_ACTIONS = {
  toggleCursor: () => setSettings({ cursor: { enabled: !settings.cursor.enabled } }, { from: 'hotkey' }),
  toggleEffects: () => setSettings({ effectsEnabled: !settings.effectsEnabled }, { from: 'hotkey' }),
  toggleSounds: () => setSettings({ sounds: { enabled: !settings.sounds.enabled } }, { from: 'hotkey' }),
  toggleMusic: () => sendEngine('music:cmd', { action: 'toggle' }),
  nextTrack: () => sendEngine('music:cmd', { action: 'next' }),
  random: () => randomize(),
  toggleVoice: () => setSettings({ voice: { enabled: !settings.voice.enabled } }, { from: 'hotkey' }),
  openApp: () => showUi(),
};

function registerHotkeys() {
  globalShortcut.unregisterAll();
  const failures = [];
  for (const [name, accel] of Object.entries(settings.hotkeys)) {
    if (!accel || !HOTKEY_ACTIONS[name]) continue;
    try {
      if (!globalShortcut.register(accel, HOTKEY_ACTIONS[name])) failures.push(name);
    } catch {
      failures.push(name);
    }
  }
  state.hotkeyFailures = failures;
  sendUi('hotkeys:status', failures);
}

function applyLoginItem() {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!settings.startWithWindows, path: exePathForLogin(), args: ['--hidden'] });
  } catch (err) {
    console.error('[login item]', err);
  }
}

// ------------------------------------------------------------------ presets / random

async function randomize() {
  const s = await loadShared();
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const hue = () => `hsl(${Math.floor(Math.random() * 360)} 100% 60%)`;
  const toHex = (h) => {
    const c = h.match(/\d+/g).map(Number);
    const [hh, ss, ll] = [c[0], c[1] / 100, c[2] / 100];
    const f = (n) => { const k = (n + hh / 30) % 12; const a = ss * Math.min(ll, 1 - ll); return Math.round(255 * (ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
    return `#${[f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };
  const anims = ['none', 'none', 'none', 'pulse', 'wobble', 'float', 'rainbow'];
  const anim = pick(anims);
  setSettings({
    cursor: { id: pick(s.lib.CURSORS).id, anim: anim === 'rainbow' ? 'none' : anim, colorMode: anim === 'rainbow' ? 'rainbow' : 'original' },
    trail: { enabled: true, type: pick(s.effects.TRAILS).id, color: toHex(hue()), rainbow: Math.random() < 0.25 },
    click: { enabled: true, type: pick(s.effects.CLICKS).id, color: toHex(hue()), rainbow: Math.random() < 0.25 },
    sounds: { pack: pick(s.packs.SOUND_PACKS).id },
  }, { from: 'random' });
}

function applyPreset(preset) {
  if (!preset || typeof preset !== 'object') return settings;
  const patch = {};
  for (const k of ['cursor', 'trail', 'click', 'idle', 'effectsEnabled', 'theme']) if (preset[k] !== undefined) patch[k] = preset[k];
  if (preset.soundPack) patch.sounds = { pack: preset.soundPack };
  if (preset.background) patch.background = { app: preset.background };
  const out = setSettings(patch, { from: 'preset' });
  if (preset.track) sendEngine('music:cmd', { action: 'select', track: preset.track, play: true });
  return out;
}

// ------------------------------------------------------------------ windows

function createEngine() {
  engineWin = new BrowserWindow({
    show: false,
    width: 200, height: 200,
    webPreferences: {
      preload: path.join(SRC, 'preload', 'engine-preload.js'),
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  engineWin.loadURL('cv://app/renderer/engine/engine.html');
  engineWin.on('closed', () => { engineWin = null; state.engineReady = false; });
  engineWin.webContents.on('render-process-gone', (e, d) => {
    console.error('[engine] crashed', d.reason);
    state.engineReady = false;
    if (!quitting) setTimeout(() => { if (engineWin && !engineWin.isDestroyed()) engineWin.destroy(); createEngine(); }, 1000);
  });
}

const THEME_BAR = {
  neon: { color: '#0b0a1a', symbolColor: '#e9e6ff' },
  glass: { color: '#00000000', symbolColor: '#ffffff' },
  pixel: { color: '#1b1b2f', symbolColor: '#f8f8f2' },
};

function createUi() {
  uiWin = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 640,
    show: false,
    title: 'CursorVerse',
    backgroundColor: '#0b0a1a',
    icon: path.join(SRC, 'assets', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...(THEME_BAR[settings.theme] || THEME_BAR.neon), height: 40 },
    webPreferences: {
      preload: path.join(SRC, 'preload', 'ui-preload.js'),
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      spellcheck: false,
    },
  });
  uiWin.loadURL('cv://app/renderer/ui/index.html');
  uiWin.once('ready-to-show', () => {
    if (!(startHidden && settings.startHidden) || isTest) uiWin.show();
  });
  uiWin.on('close', (e) => {
    if (quitting || !settings.closeToTray) return;
    e.preventDefault();
    uiWin.hide();
    if (!settings.trayHintShown) {
      setSettings({ trayHintShown: true }, { from: 'main' });
      if (Notification.isSupported()) {
        new Notification({ title: 'CursorVerse is still running 😎', body: 'Your cursor, sounds and music keep going. Find me in the tray by the clock.' }).show();
      }
    }
  });
  uiWin.on('closed', () => { uiWin = null; });
  // keep the app page from being navigated away
  uiWin.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('cv://app/')) { e.preventDefault(); sendUi('browser:open-tab', url); }
  });
  uiWin.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) sendUi('browser:open-tab', url);
    return { action: 'deny' };
  });
}

function showUi(page) {
  if (!uiWin || uiWin.isDestroyed()) createUi();
  if (uiWin.isMinimized()) uiWin.restore();
  uiWin.show();
  uiWin.focus();
  if (page) sendUi('nav', page);
}

// ------------------------------------------------------------------ tray

function trayIcon() {
  const img = nativeImage.createFromPath(path.join(SRC, 'assets', 'tray.png'));
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

async function refreshTray() {
  if (!tray) return;
  const s = shared || await loadShared().catch(() => null);
  const presetItems = (s?.presets.BUILTIN_PRESETS || []).concat(settings.presets || []).map((p) => ({
    label: `${p.emoji || '⭐'} ${p.name}`, click: () => applyPreset(p),
  }));
  const menu = Menu.buildFromTemplate([
    { label: 'Open CursorVerse', click: () => showUi() },
    { type: 'separator' },
    { label: 'Custom cursor', type: 'checkbox', checked: settings.cursor.enabled, click: HOTKEY_ACTIONS.toggleCursor },
    { label: 'Trails & click effects', type: 'checkbox', checked: settings.effectsEnabled, click: HOTKEY_ACTIONS.toggleEffects },
    { label: 'Typing sounds', type: 'checkbox', checked: settings.sounds.enabled, click: HOTKEY_ACTIONS.toggleSounds },
    { label: 'Voice control', type: 'checkbox', checked: settings.voice.enabled, click: HOTKEY_ACTIONS.toggleVoice },
    { type: 'separator' },
    { label: state.music.playing ? `⏸ Pause music (${state.music.name || ''})` : '▶ Play music', click: HOTKEY_ACTIONS.toggleMusic },
    { label: '⏭ Next song', click: HOTKEY_ACTIONS.nextTrack },
    { label: 'Presets', submenu: presetItems.length ? presetItems : [{ label: 'none yet', enabled: false }] },
    { label: '🎲 Random combo', click: () => randomize() },
    { type: 'separator' },
    { label: 'Put normal cursor back', click: () => setSettings({ cursor: { enabled: false } }, { from: 'tray' }) },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  const cur = s?.lib.CURSOR_MAP.get(settings.cursor.id);
  tray.setToolTip(`CursorVerse${cur ? ` — ${cur.name}` : ''}`);
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.on('click', () => showUi());
  refreshTray();
}

// ------------------------------------------------------------------ IPC

function ipc() {
  const handle = (ch, fn) => ipcMain.handle(ch, (e, ...a) => fn(...a));

  handle('settings:get', () => settings);
  handle('settings:set', (patch) => setSettings(patch));
  handle('settings:reset', () => {
    settings = structuredClone(DEFAULTS);
    settings.firstRun = false;
    setSettings({}, { from: 'reset' });
    requestCursorBuild();
    updateOverlay();
    updateInputHook();
    configureVoice();
    registerHotkeys();
    return settings;
  });

  handle('mycursors:list', () => myCursors);
  handle('mycursors:save', (rec) => {
    if (!rec || typeof rec !== 'object' || !Array.isArray(rec.frames) || !rec.frames.length) throw new Error('bad cursor');
    rec.id = rec.id && String(rec.id).startsWith('custom:') ? rec.id : `custom:${crypto.randomBytes(5).toString('hex')}`;
    rec.updated = Date.now();
    const i = myCursors.findIndex((c) => c.id === rec.id);
    if (i >= 0) myCursors[i] = rec; else myCursors.push(rec);
    myCursorsFile.save(myCursors);
    sendEngine('mycursors', myCursors);
    if (settings.cursor.id === rec.id) requestCursorBuild();
    return rec;
  });
  handle('mycursors:delete', (id) => {
    myCursors = myCursors.filter((c) => c.id !== id);
    myCursorsFile.save(myCursors);
    sendEngine('mycursors', myCursors);
    if (settings.cursor.id === id) setSettings({ cursor: { id: DEFAULTS.cursor.id } });
    return myCursors;
  });

  handle('library:import', (kind, multi) => library.importFiles(uiWin, kind, multi));
  handle('library:remove', (rel) => library.removeFile(rel));

  handle('apps:list', async () => ({ running: await apps.listRunningApps(), common: apps.COMMON_APPS }));
  handle('apps:pick', () => new Promise((resolve) => {
    // wait for the user to click on another app, then report it
    if (!win32.IS_WIN) { resolve(null); return; }
    const mine = ownExes();
    const started = Date.now();
    const t = setInterval(() => {
      const fg = win32.foregroundProcess();
      const exe = apps.exeName(fg?.path);
      if (exe && !mine.includes(exe)) {
        clearInterval(t);
        showUi();
        resolve({ exe, name: exe.replace(/\.exe$/, ''), path: fg.path });
      } else if (Date.now() - started > 15000) { clearInterval(t); resolve(null); }
    }, 200);
  }));

  handle('history:list', () => history);
  handle('history:clear', () => { history = []; historyFile.save(history); return history; });
  handle('history:delete', (at) => { history = history.filter((h) => h.at !== at); historyFile.save(history); return history; });
  ipcMain.on('history:add', (e, item) => {
    if (!item || !/^https?:/i.test(item.url || '')) return;
    const last = history[0];
    if (last && last.url === item.url && Date.now() - last.at < 3000) { last.title = item.title || last.title; }
    else history.unshift({ url: String(item.url).slice(0, 2000), title: String(item.title || '').slice(0, 300), at: Date.now() });
    if (history.length > 5000) history.length = 5000;
    historyFile.save(history);
  });
  ipcMain.on('history:title', (e, { url, title }) => {
    const h = history.find((x) => x.url === url);
    if (h && title) { h.title = String(title).slice(0, 300); historyFile.save(history); }
  });

  ipcMain.on('music:cmd', (e, cmd) => sendEngine('music:cmd', cmd));
  handle('music:state', () => state.music);

  handle('preset:apply', (p) => applyPreset(p));
  handle('random', () => randomize());

  handle('cursor:restore', () => { setSettings({ cursor: { enabled: false } }); restoreCursorNow(); return true; });
  handle('cursor:status', () => state.cursorStatus);

  handle('voice:status', () => voice?.status || { state: 'off' });
  handle('voice:history', () => voice?.history || []);
  handle('ptt:capture', () => new Promise((resolve) => {
    state.pttCapture = resolve;
    updateInputHook();
    setTimeout(() => { if (state.pttCapture === resolve) { state.pttCapture = null; updateInputHook(); resolve(null); } }, 10000);
  }));

  handle('hotkeys:status', () => state.hotkeyFailures);

  handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    nativeOk: win32.available(),
    nativeError: win32.loadError() ? String(win32.loadError().message) : null,
    hookOk: !!input?.available,
    adblockCount: adblock?.blocked || 0,
    adblockError: adblock?.error || null,
    portable: !!process.env.PORTABLE_EXECUTABLE_FILE,
  }));
  handle('app:quit', () => { quitting = true; app.quit(); });
  handle('app:openDataFolder', () => shell.openPath(userData));

  handle('window:titlebar', (theme) => {
    if (uiWin && process.platform === 'win32') {
      try { uiWin.setTitleBarOverlay({ ...(THEME_BAR[theme] || THEME_BAR.neon), height: 40 }); } catch { /* older OS */ }
    }
  });

  // engine -> main
  ipcMain.on('engine:ready', () => {
    state.engineReady = true;
    sendEngine('settings', settings);
    sendEngine('mycursors', myCursors);
    requestCursorBuild();
    if (settings.music.autoplay) sendEngine('music:cmd', { action: 'play' });
  });
  ipcMain.on('cursor:built', (e, msg) => onCursorBuilt(msg));
  ipcMain.on('music:state', (e, st) => {
    const wasPlaying = state.music.playing;
    const oldName = state.music.name;
    state.music = st;
    sendUi('music:state', st);
    if (wasPlaying !== st.playing || oldName !== st.name) refreshTray();
  });
  ipcMain.on('engine:log', (e, m) => console.log('[engine]', m));
}

// ------------------------------------------------------------------ browser session

function setupBrowserSession() {
  const ses = session.fromPartition('persist:browser');
  const ua = ses.getUserAgent().replace(/\s?Electron\/\S+/i, '').replace(/\s?cursorverse\/\S+/i, '');
  ses.setUserAgent(ua);
  const ALLOW = new Set(['fullscreen', 'pointerLock', 'clipboard-sanitized-write', 'keyboardLock']);
  const ASK = { media: 'use your camera/microphone', geolocation: 'see your location', notifications: 'show notifications', 'clipboard-read': 'read your clipboard', midi: 'use MIDI devices', midiSysex: 'use MIDI devices' };
  const answers = new Map();
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    if (ALLOW.has(permission)) return callback(true);
    if (!ASK[permission]) return callback(false);
    let origin = '';
    try { origin = new URL(details.requestingUrl).origin; } catch { return callback(false); }
    const key = `${origin}|${permission}`;
    if (answers.has(key)) return callback(answers.get(key));
    dialog.showMessageBox(uiWin, {
      type: 'question', buttons: ['Allow', 'Block'], defaultId: 1, cancelId: 1,
      message: `${origin} wants to ${ASK[permission]}.`,
    }).then(({ response }) => { answers.set(key, response === 0); callback(response === 0); });
  });
  ses.setPermissionCheckHandler((wc, permission) => ALLOW.has(permission));
  adblock = new AdBlock(ses, userData);
  adblock.onCount = (n) => sendUi('adblock:count', n);
  if (settings.browser.adblock) adblock.setEnabled(true);
}

const BROWSER_KEYS = [
  [(i) => i.control && !i.shift && i.key.toLowerCase() === 't', 'new-tab'],
  [(i) => i.control && !i.shift && i.key.toLowerCase() === 'w', 'close-tab'],
  [(i) => i.control && i.shift && i.key.toLowerCase() === 't', 'reopen-tab'],
  [(i) => i.control && i.key.toLowerCase() === 'l', 'focus-address'],
  [(i) => i.control && i.key === 'Tab' && !i.shift, 'next-tab'],
  [(i) => i.control && i.key === 'Tab' && i.shift, 'prev-tab'],
  [(i) => i.key === 'F5' || (i.control && i.key.toLowerCase() === 'r'), 'reload'],
  [(i) => i.alt && i.key === 'ArrowLeft', 'back'],
  [(i) => i.alt && i.key === 'ArrowRight', 'forward'],
  [(i) => i.control && i.key.toLowerCase() === 'h', 'history'],
  [(i) => i.control && i.key.toLowerCase() === 'd', 'bookmark'],
  [(i) => i.key === 'F11', 'fullscreen'],
];

function secureWebContents() {
  app.on('web-contents-created', (e, wc) => {
    wc.on('will-attach-webview', (ev, webPreferences, params) => {
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.nodeIntegrationInSubFrames = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
      webPreferences.webSecurity = true;
      if (params.partition !== 'persist:browser' || !/^(https?:|about:blank)/i.test(params.src || 'about:blank')) ev.preventDefault();
    });
    if (wc.getType() === 'webview') {
      wc.setWindowOpenHandler(({ url }) => {
        if (/^https?:/i.test(url)) sendUi('browser:open-tab', url);
        return { action: 'deny' };
      });
      wc.on('before-input-event', (ev, input) => {
        if (input.type !== 'keyDown') return;
        for (const [test, name] of BROWSER_KEYS) {
          if (test(input)) { ev.preventDefault(); sendUi('browser:shortcut', name); return; }
        }
      });
    }
  });
}

// ------------------------------------------------------------------ startup

let lastShown = 0;
app.on('second-instance', (e, argv, cwd, data) => {
  if (data?.exe && data.exe !== MY_EXE) {
    // a different copy was started: step aside so it can run
    quitting = true;
    app.quit();
    return;
  }
  // the waiting copy retries for a few seconds; only pop the window once
  if (Date.now() - lastShown > 10000) { lastShown = Date.now(); showUi(); }
});

app.whenReady().then(async () => {
  if (!gotLock && !(await waitForLock(8000))) {
    // same exe started twice: the running one already showed its window
    app.exit(0);
    return;
  }
  userData = app.getPath('userData');
  settingsFile = new JsonFile(path.join(userData, 'settings.json'), null);
  myCursorsFile = new JsonFile(path.join(userData, 'my-cursors.json'), []);
  historyFile = new JsonFile(path.join(userData, 'history.json'), []);
  settings = withDefaults(settingsFile.data);
  myCursors = Array.isArray(myCursorsFile.data) ? myCursorsFile.data : [];
  history = Array.isArray(historyFile.data) ? historyFile.data : [];
  if (process.platform === 'win32') app.setAppUserModelId('com.kunven67.cursorverse');

  // a crash last time could have left our cursor on; start clean
  restoreCursorNow();

  library.handleProtocol(userData);
  secureWebContents();
  setupBrowserSession();
  ipc();

  overlay = new OverlayManager();
  hud = new Hud();
  voice = new VoiceController({
    win32,
    allowedNow: () => state.allowedVoice,
    hud: {
      show: (s) => hud.show(s),
      flash: (s, ms) => hud.flash(s, ms),
      hide: () => hud.hide(),
    },
  });
  voice.on('status', (st) => sendUi('voice:status', st));
  voice.on('level', (lv) => sendUi('voice:level', lv));
  voice.on('command', (c) => sendUi('voice:command', c));
  voice.on('heard', (h) => sendUi('voice:heard', h));

  input = new InputHook({
    key: (kind) => {
      if (state.pttCapture) return;
      if (settings.sounds.enabled && state.allowedMain) sendEngine('key', kind);
    },
    keyUp: (kind) => {
      if (settings.sounds.enabled && settings.sounds.keyUp && state.allowedMain) sendEngine('keyup', kind);
    },
    mouse: (button) => {
      if (state.pttCapture) return;
      if (settings.effectsEnabled && settings.click.enabled) overlay.click(button);
      if (settings.sounds.enabled && settings.sounds.mouseClicks && state.allowedMain) sendEngine('mouse', button);
    },
    ptt: (down, code, isMouse) => {
      if (state.pttCapture && down) {
        if (isMouse && code <= 2) return; // left/right click can't be the talk key
        const resolve = state.pttCapture;
        state.pttCapture = null;
        updateInputHook();
        resolve({ type: isMouse ? 'mouse' : 'key', keycode: code, label: isMouse ? `Mouse button ${code}` : keyName(code) });
        return;
      }
      if (settings.voice.enabled && settings.voice.mode === 'ptt' && pttMatches(code, isMouse)) voice.pushToTalk(down);
    },
  });

  createEngine();
  createUi();
  createTray();
  registerHotkeys();
  applyLoginItem();
  updateOverlay();
  updateInputHook();
  configureVoice();
  loadShared().then(refreshTray).catch((err) => console.error('[shared]', err));

  if (win32.IS_WIN) setInterval(tickForeground, 250);
  powerMonitor.on('resume', () => { state.cursorApplied = false; updateCursorApplied(); });
  powerMonitor.on('shutdown', () => restoreCursorNow());
  screen.on('display-metrics-changed', () => requestCursorBuild());
});

function cleanup() {
  try { globalShortcut.unregisterAll(); } catch { /* not ready */ }
  try { input?.setRunning(false); } catch { /* ignore */ }
  try { voice?.stop(); } catch { /* ignore */ }
  restoreCursorNow();
  settingsFile?.flush();
  myCursorsFile?.flush();
  historyFile?.flush();
}

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', cleanup);
app.on('window-all-closed', () => { /* keep running in the tray */ });
// a copy that never got the lock must not reset the running copy's cursor
process.on('exit', () => { if (gotLock) { try { restoreCursorNow(); } catch { /* ignore */ } } });
process.on('uncaughtException', (err) => {
  console.error('[main] uncaught', err);
  if (gotLock) { try { restoreCursorNow(); } catch { /* ignore */ } }
});
