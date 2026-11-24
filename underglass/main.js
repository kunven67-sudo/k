// UNDERGLASS - main process. One full screen window: a fake Windows 11 made to look like THEIR PC.
'use strict';
const { app, BrowserWindow, ipcMain, screen, globalShortcut, nativeImage, session } = require('electron');
const fs = require('fs'), path = require('path');

const TEST = process.env.UG_TEST || '';
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
if (TEST) app.setPath('userData', process.env.UG_DATA || path.join(require('os').tmpdir(), 'ug-test-' + process.pid));
if (!TEST && !app.requestSingleInstanceLock()) app.quit();

let win = null, look = null;
const dataDir = () => app.getPath('userData');
const fileOf = (n) => path.join(dataDir(), n);
function readJSON(n, def) { try { return JSON.parse(fs.readFileSync(fileOf(n), 'utf8')); } catch (e) { return def; } }
function writeJSON(n, v) { try { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(fileOf(n) + '.tmp', JSON.stringify(v)); fs.renameSync(fileOf(n) + '.tmp', fileOf(n)); return true; } catch (e) { return false; } }

function createWindow() {
  const d = screen.getPrimaryDisplay();
  win = new BrowserWindow({
    x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
    frame: false, fullscreen: !TEST, backgroundColor: '#f4f4f4', show: false, title: 'UNDERGLASS',
    icon: path.join(__dirname, 'assets', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('closed', () => { win = null; });
  win.webContents.on('before-input-event', (e, inp) => { // block reload / dev keys so nothing breaks the fake PC
    if (inp.control && ['r', 'w'].includes((inp.key || '').toLowerCase())) e.preventDefault();
    if (inp.key === 'F5') e.preventDefault();
  });
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(perm === 'media'));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === 'media');
  ipcMain.handle('pc-look', async () => {
    if (!look) { try { look = await require('./pclook').read(app, nativeImage); } catch (e) { look = { error: String(e), desktop: [], pinned: [], start: [], cursors: {} }; } }
    return look;
  });
  // a picture of part of the fake desktop (what a piece looks like when it gets ripped off)
  ipcMain.handle('capture', async (e, r) => {
    if (!win) return null;
    try {
      const im = await win.webContents.capturePage({ x: Math.floor(r.x), y: Math.floor(r.y), width: Math.max(1, Math.ceil(r.w)), height: Math.max(1, Math.ceil(r.h)) });
      return im.toDataURL();
    } catch (err) { return null; }
  });
  ipcMain.handle('load', (e, n) => readJSON(n, null));
  ipcMain.handle('save', (e, n, v) => writeJSON(n, v));
  ipcMain.on('quit', () => app.quit());
  ipcMain.on('minimize', () => { if (win) { win.setFullScreen(false); win.minimize(); } });
  ipcMain.on('restore-full', () => { if (win && !TEST) win.setFullScreen(true); });
  createWindow();
  win.on('restore', () => { if (!TEST) win.setFullScreen(true); });
  // panic / quit key (plain hotkey, no keyboard hooks)
  globalShortcut.register('Control+Shift+Q', () => app.quit());
  if (TEST) require(TEST)({ app, win, ipcMain });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('will-quit', () => { try { globalShortcut.unregisterAll(); } catch (e) { } });
app.on('window-all-closed', () => app.quit());
