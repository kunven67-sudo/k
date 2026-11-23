// MOUSE HAZARD: main process. Control panel + see-through overlay that covers the screen while an effect runs.
'use strict';
const { app, BrowserWindow, ipcMain, screen, desktopCapturer, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const W = require('./win32')();

const TEST = process.env.MH_TEST || '';
const FAKE = TEST && process.platform !== 'win32'; // Linux picture tests keep the overlay up
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
if (FAKE) app.commandLine.appendSwitch('force-device-scale-factor', '1');

if (!TEST && !app.requestSingleInstanceLock()) { app.quit(); }

let panel = null, overlay = null, guard = null;
let overlayReady = false, overlayShown = false, cursorHidden = false, overlayDisplay = null;
let backupTimer = null, endAt = 0;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
let settings = { seconds: 5, volume: 0.8, stack: true, panic: true };
try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))); } catch (e) {}
function saveSettings() { try { fs.writeFileSync(settingsFile(), JSON.stringify(settings)); } catch (e) {} }

function freeEverything() { // put the mouse fully back to normal
  try { W.clip(null); } catch (e) {}
  if (cursorHidden) { try { W.restoreAll(); } catch (e) {} cursorHidden = false; }
}

function physRect(d) {
  try { if (process.platform === 'win32') return screen.dipToScreenRect(null, d.bounds); } catch (e) {}
  const s = d.scaleFactor || 1; return { x: Math.round(d.bounds.x * s), y: Math.round(d.bounds.y * s), width: Math.round(d.bounds.width * s), height: Math.round(d.bounds.height * s) };
}

function displayInfo(d) {
  const pr = physRect(d), s = pr.width / d.bounds.width;
  return { id: d.id, bounds: d.bounds, phys: pr, scale: s,
    floor: Math.round((d.workArea.y + d.workArea.height - d.bounds.y) * s) }; // top of the taskbar, in overlay pixels
}

function createOverlay(d) {
  overlayReady = false; overlayDisplay = d;
  overlay = new BrowserWindow({
    x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
    transparent: true, frame: false, show: false, alwaysOnTop: true, skipTaskbar: true, focusable: false,
    resizable: false, movable: false, minimizable: false, maximizable: false, hasShadow: false, enableLargerThanScreen: true,
    backgroundColor: '#00000000', title: 'MOUSE HAZARD overlay',
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false, backgroundThrottling: false },
  });
  overlay.setIgnoreMouseEvents(true);
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.loadFile('overlay.html');
  overlay.webContents.on('render-process-gone', () => { freeEverything(); overlayReady = false; overlayShown = false; try { overlay.destroy(); } catch (e) {} overlay = null; });
  overlay.on('closed', () => { overlay = null; overlayShown = false; });
}

function ensureOverlay(d) {
  if (overlay && overlayDisplay && overlayDisplay.id !== d.id && !overlayShown) { overlay.destroy(); overlay = null; }
  if (!overlay) createOverlay(d);
  return new Promise(res => { const t = setInterval(() => { if (overlayReady) { clearInterval(t); res(); } }, 20); });
}

async function grabScreen(d) { // a still picture of the screen, so water/ice/lensing can bend what is really behind them
  if (FAKE) return null;
  try {
    const pr = physRect(d);
    const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: pr.width, height: pr.height } });
    const s = srcs.find(x => String(x.display_id) === String(d.id)) || srcs[0];
    if (!s) return null;
    const sz = s.thumbnail.getSize();
    return { w: sz.width, h: sz.height, bgra: s.thumbnail.toBitmap() };
  } catch (e) { return null; }
}

let starting = Promise.resolve();
function startEffect(id, seconds) {
  starting = starting.then(async () => {
    const cur = screen.getCursorScreenPoint();
    const d = overlayShown && overlayDisplay ? overlayDisplay : screen.getDisplayNearestPoint(cur);
    await ensureOverlay(d);
    const info = displayInfo(d);
    let shot = null;
    if (!overlayShown) {
      shot = await grabScreen(d);
      overlay.webContents.send('screen', shot ? { w: shot.w, h: shot.h, bgra: shot.bgra } : null);
    }
    overlay.webContents.send('start', { id, seconds, display: info, stack: settings.stack, volume: settings.volume });
    if (!overlayShown) { overlay.showInactive(); overlay.setAlwaysOnTop(true, 'screen-saver'); overlayShown = true; }
    endAt = Math.max(endAt, Date.now() + seconds * 1000);
    armBackup();
  }).catch(e => console.error(e));
}

function armBackup() { // if the overlay ever gets stuck, the mouse gets freed anyway
  clearTimeout(backupTimer);
  backupTimer = setTimeout(() => { freeEverything(); if (overlay) overlay.webContents.send('stop', { hard: true }); }, Math.max(0, endAt - Date.now()) + 8000);
}

function stopAll() {
  freeEverything();
  if (overlay) overlay.webContents.send('stop', { hard: false });
  if (panel) panel.webContents.send('stopped');
}

ipcMain.on('overlay-ready', () => { overlayReady = true; });
ipcMain.on('cursor-hide', () => { if (!cursorHidden && !FAKE) { if (W.hideAll() > 0) cursorHidden = true; } });
ipcMain.on('cursor-show', () => { if (cursorHidden) { W.restoreAll(); cursorHidden = false; } });
ipcMain.on('overlay-idle', () => {
  freeEverything(); clearTimeout(backupTimer); endAt = 0;
  if (overlay && overlayShown && !FAKE) { overlay.hide(); overlayShown = false; }
  if (panel) panel.webContents.send('stopped');
});
ipcMain.on('effect-state', (e, s) => { if (panel) panel.webContents.send('effect-state', s); });
ipcMain.on('start', (e, m) => startEffect(m.id, Math.max(1, Math.min(600, m.seconds || settings.seconds))));
ipcMain.on('stop', () => stopAll());
ipcMain.on('settings', (e, s) => { Object.assign(settings, s); saveSettings(); if (overlay) overlay.webContents.send('settings', settings); });
ipcMain.handle('get-settings', () => settings);
ipcMain.handle('get-cursors', () => cursorPics);
ipcMain.on('win', (e, a) => { if (!panel) return; if (a === 'min') panel.minimize(); if (a === 'close') app.quit(); });

let cursorPics = {}, cursorHandles = {};
app.whenReady().then(() => {
  freeEverything(); try { W.restoreAll(); } catch (e) {} // in case an earlier run was killed mid-effect
  try { cursorPics = W.captureCursors(); cursorHandles = W.systemHandles(); } catch (e) { cursorPics = {}; }
  ipcMain.handle('cursor-handles', () => cursorHandles);
  try { guard = fork(path.join(__dirname, 'guard.js'), [], { stdio: 'ignore', detached: true, windowsHide: true }); } catch (e) {}
  if (settings.panic !== false) globalShortcut.register('Control+Shift+F12', stopAll);

  panel = new BrowserWindow({
    width: 1280, height: 820, minWidth: 980, minHeight: 640, frame: false, show: false, backgroundColor: '#0b0d0f',
    title: 'MOUSE HAZARD', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
  });
  panel.loadFile('panel.html');
  panel.once('ready-to-show', () => { if (!TEST) panel.show(); });
  panel.on('closed', () => { panel = null; app.quit(); });
  createOverlay(screen.getDisplayNearestPoint(screen.getCursorScreenPoint()));
  if (TEST) require(TEST)({ app, getPanel: () => panel, getOverlay: () => overlay, startEffect, stopAll, ipcMain, W, state: () => ({ cursorHidden, overlayShown }) });
});

function shutdown() { freeEverything(); try { globalShortcut.unregisterAll(); } catch (e) {} if (guard) { try { guard.send('bye'); } catch (e) {} } }
app.on('will-quit', shutdown);
process.on('exit', () => { freeEverything(); });
process.on('uncaughtException', e => { freeEverything(); console.error(e); });
app.on('window-all-closed', () => app.quit());
