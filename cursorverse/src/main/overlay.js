// Click-through, always-on-top transparent windows (one per screen) that draw
// the cursor trail, click effects and idle effects over every app.
const { BrowserWindow, screen } = require('electron');
const path = require('path');

const PRELOAD = path.join(__dirname, '..', 'preload', 'overlay-preload.js');

class OverlayManager {
  constructor() {
    this.windows = new Map(); // displayId -> { win, bounds }
    this.config = null;
    this.visible = false;
    this.wanted = false;
    this.timer = null;
    this.last = { x: NaN, y: NaN };
    this.onDisplaysChanged = () => { if (this.wanted) { this.destroyAll(); this.ensure(); } };
    screen.on('display-added', this.onDisplaysChanged);
    screen.on('display-removed', this.onDisplaysChanged);
    screen.on('display-metrics-changed', this.onDisplaysChanged);
  }

  // enabled: effects switched on at all; visible: the target app is in front.
  update(config, enabled, visible) {
    this.config = config;
    this.wanted = !!enabled;
    if (!this.wanted) { this.destroyAll(); return; }
    this.ensure();
    this.broadcast('fx:config', config);
    this.setVisible(visible);
  }

  ensure() {
    for (const d of screen.getAllDisplays()) {
      if (this.windows.has(d.id)) continue;
      const b = d.bounds;
      const win = new BrowserWindow({
        x: b.x, y: b.y, width: b.width, height: b.height,
        transparent: true, frame: false, resizable: false, movable: false, focusable: false,
        skipTaskbar: true, hasShadow: false, show: false, alwaysOnTop: true, type: 'toolbar',
        backgroundColor: '#00000000', enableLargerThanScreen: true,
        webPreferences: { preload: PRELOAD, backgroundThrottling: false, contextIsolation: true, sandbox: true },
      });
      win.setIgnoreMouseEvents(true);
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.loadURL(`cv://app/renderer/overlay/overlay.html?x=${b.x}&y=${b.y}`);
      win.webContents.once('did-finish-load', () => {
        if (win.isDestroyed()) return;
        win.webContents.send('fx:config', this.config);
        win.webContents.send('fx:visible', this.visible);
        if (this.visible) win.showInactive();
      });
      this.windows.set(d.id, { win, bounds: b });
    }
    if (!this.timer) this.timer = setInterval(() => this.poll(), 16);
  }

  setVisible(v) {
    v = !!v;
    if (v === this.visible) return;
    this.visible = v;
    for (const { win } of this.windows.values()) {
      if (win.isDestroyed()) continue;
      win.webContents.send('fx:visible', v);
      if (v) win.showInactive(); else win.hide();
    }
  }

  poll() {
    if (!this.visible) return;
    const p = screen.getCursorScreenPoint();
    if (p.x === this.last.x && p.y === this.last.y) return;
    this.last = p;
    this.broadcast('fx:pos', p);
  }

  click(button) {
    if (!this.visible) return;
    const p = screen.getCursorScreenPoint();
    this.broadcast('fx:click', { x: p.x, y: p.y, button });
  }

  broadcast(ch, data) {
    for (const { win } of this.windows.values()) if (!win.isDestroyed()) win.webContents.send(ch, data);
  }

  destroyAll() {
    clearInterval(this.timer);
    this.timer = null;
    for (const { win } of this.windows.values()) if (!win.isDestroyed()) win.destroy();
    this.windows.clear();
    this.visible = false;
  }
}

// Small floating bubble near the cursor for voice feedback ("Did you say P?").
class Hud {
  constructor() {
    this.win = null;
    this.hideTimer = null;
    this.enabled = true;
  }

  ensure() {
    if (this.win && !this.win.isDestroyed()) return this.win;
    this.win = new BrowserWindow({
      width: 340, height: 96, transparent: true, frame: false, resizable: false, focusable: false,
      skipTaskbar: true, hasShadow: false, show: false, alwaysOnTop: true, type: 'toolbar', backgroundColor: '#00000000',
      webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true },
    });
    this.win.setIgnoreMouseEvents(true);
    this.win.setAlwaysOnTop(true, 'screen-saver');
    this.win.loadURL('cv://app/renderer/overlay/hud.html');
    this.ready = new Promise((r) => this.win.webContents.once('did-finish-load', r));
    return this.win;
  }

  async show(state, autoHideMs = 0) {
    if (!this.enabled) return;
    const win = this.ensure();
    await this.ready;
    if (win.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(p).workArea;
    const [w, h] = win.getSize();
    const x = Math.min(Math.max(area.x, p.x + 24), area.x + area.width - w);
    const y = Math.min(Math.max(area.y, p.y + 24), area.y + area.height - h);
    win.setPosition(Math.round(x), Math.round(y));
    win.webContents.send('hud:state', state);
    win.showInactive();
    clearTimeout(this.hideTimer);
    if (autoHideMs) this.hideTimer = setTimeout(() => this.hide(), autoHideMs);
  }

  flash(state, ms = 1400) { return this.show(state, ms); }

  hide() {
    clearTimeout(this.hideTimer);
    if (this.win && !this.win.isDestroyed()) this.win.hide();
  }

  destroy() {
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }
}

module.exports = { OverlayManager, Hud };
