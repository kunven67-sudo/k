// Torture Humans desktop shell (Electron): one game window, game files served
// over the th:// protocol, one-click updates (same tested updater as CursorVerse).
const { app, BrowserWindow, protocol, net, ipcMain, shell, Notification } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { Updater, finishTarget, replaceExe, REPO } = require('./updater.cjs');
const { ensureAssets } = require('./assetpack.cjs');

app.setName('Torture Humans');
// the game wants the real GPU and no frame cap from the browser
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

protocol.registerSchemesAsPrivileged([
  { scheme: 'th', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

const isTest = !!process.env.TH_TEST;
const MY_EXE = String(process.env.PORTABLE_EXECUTABLE_FILE || process.execPath).toLowerCase();
const UPDATE_TARGET = process.env.PORTABLE_EXECUTABLE_FILE ? finishTarget(process.argv) : null;
let gotLock = app.requestSingleInstanceLock({ exe: MY_EXE });
let win = null;
let updater = null;
let quitting = false;
let userData = null;

// game files: dist/ (built by vite) inside the app, assets next to it
const APP_ROOT = path.join(__dirname, '..');
const DIST = path.join(APP_ROOT, 'dist');
// which asset pack this build expects (written by CI next to this file)
let PACK = null;
try { PACK = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets-pack.json'), 'utf8')); } catch { /* dev build */ }
let assetsDir = null;   // set once the pack is downloaded/unpacked
let assetsJob = null;

function assetsRoot() {
  if (process.env.TH_ASSETS) return process.env.TH_ASSETS;
  if (assetsDir) return assetsDir;
  return path.join(APP_ROOT, 'public', 'assets'); // dev: files straight from the repo
}

function ensureGameAssets() {
  if (process.env.TH_ASSETS || !PACK) return Promise.resolve({ ok: true, dir: assetsRoot() });
  assetsJob ??= ensureAssets({
    fetch: (url, opts) => net.fetch(url, opts),
    dir: path.join(userData, 'game-assets'),
    expected: PACK,
    baseUrl: process.env.TH_ASSETS_URL || `https://github.com/${REPO}/releases/download/torturehumans-v${app.getVersion()}`,
    onProgress: (p) => win?.webContents.send('assets:progress', p),
    log: updateLog,
  }).then((r) => { assetsDir = r.dir; return { ok: true, dir: r.dir, fresh: r.fresh }; })
    .catch((err) => { assetsJob = null; updateLog(`assets failed: ${err.message}`); return { ok: false, error: err.message }; });
  return assetsJob;
}

function safeJoin(root, rel) {
  const p = path.normalize(path.join(root, decodeURIComponent(rel)));
  return p.startsWith(path.normalize(root + path.sep)) || p === path.normalize(root) ? p : null;
}

function updateLog(line) {
  if (!userData) return;
  try { fs.appendFileSync(path.join(userData, 'update.log'), `${new Date().toISOString()} [${app.getVersion()} pid ${process.pid}] ${line}\n`); } catch { /* ignore */ }
}

async function waitForLock(ms) {
  const until = Date.now() + ms;
  while (!gotLock && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 250));
    gotLock = app.requestSingleInstanceLock({ exe: MY_EXE });
  }
  return gotLock;
}

app.on('second-instance', (e, argv, cwd, data) => {
  if (quitting) return;
  if (data?.exe && data.exe !== MY_EXE) {
    // a different copy (like the new version after an update) takes over
    updater?.handedOver();
    quitting = true;
    app.quit();
    return;
  }
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    title: 'Torture Humans',
    icon: path.join(APP_ROOT, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('th://')) e.preventDefault(); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.loadURL('th://game/index.html');
}

async function finishUpdate() {
  const me = process.env.PORTABLE_EXECUTABLE_FILE;
  updateLog(`finishing update: ${me} -> ${UPDATE_TARGET}`);
  const res = await replaceExe(me, UPDATE_TARGET, { log: updateLog });
  if (res.ok) {
    updater.set({ status: 'updated', error: null });
  } else {
    updater.set({ status: 'error', error: `You're on the new version, but the old file couldn't be replaced (${res.error?.code || 'unknown'}). Use this file from now on: ${me}` });
    shell.showItemInFolder(me);
  }
}

app.whenReady().then(async () => {
  if (!gotLock && !(await waitForLock(UPDATE_TARGET ? 60000 : 8000))) { app.exit(0); return; }
  userData = app.getPath('userData');

  protocol.handle('th', (req) => {
    const url = new URL(req.url);
    let file = null;
    if (url.host === 'game') {
      const rel = url.pathname.replace(/^\/+/, '');
      if (rel.startsWith('assets/')) file = safeJoin(assetsRoot(), rel.slice('assets/'.length));
      else file = safeJoin(DIST, rel || 'index.html');
    }
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });

  const updatesDir = path.join(userData, 'updates');
  updater = new Updater({
    fetch: (url, opts) => net.fetch(url, opts),
    currentVersion: (isTest && process.env.TH_FAKE_VERSION) || app.getVersion(),
    feedUrl: (isTest && process.env.TH_UPDATE_FEED) || null,
    exePath: UPDATE_TARGET || process.env.PORTABLE_EXECUTABLE_FILE || null,
    downloadDir: updatesDir,
    log: updateLog,
    showFile: (f) => shell.showItemInFolder(f),
  });
  updater.on('state', (st) => {
    win?.webContents.send('update:state', st);
    if (st.status === 'available' && Notification.isSupported() && !updater.notified) {
      updater.notified = true;
      new Notification({ title: `Torture Humans ${st.latest} is out`, body: 'Open Settings → Updates to install it.' }).show();
    }
  });
  ipcMain.handle('update:state', () => updater.state);
  ipcMain.handle('update:check', () => updater.check());
  ipcMain.handle('update:install', () => updater.updateNow());
  ipcMain.handle('app:info', () => ({ version: app.getVersion(), portable: !!process.env.PORTABLE_EXECUTABLE_FILE, platform: process.platform }));
  ipcMain.handle('assets:ensure', () => ensureGameAssets());
  ipcMain.handle('app:quit', () => { quitting = true; app.quit(); });
  ipcMain.handle('app:fullscreen', (e, on) => { win?.setFullScreen(!!on); return win?.isFullScreen(); });

  if (UPDATE_TARGET) finishUpdate().catch((err) => updateLog(`finish failed: ${err.stack || err}`));
  else if (!MY_EXE.startsWith(updatesDir.toLowerCase())) fs.rm(updatesDir, { recursive: true, force: true }, () => {});

  createWindow();
  if (updater.supported) {
    setTimeout(() => updater.check(), 10000);
    setInterval(() => updater.check(), 6 * 60 * 60 * 1000);
  }
  if (isTest && process.env.TH_AUTO_UPDATE && updater.supported) setTimeout(() => updater.updateNow(), 3000);
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => app.quit());
