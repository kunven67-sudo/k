import * as THREE from 'three';
import { FONT, MONO, font, rr, fillRR, strokeRR, text, inside, icon, startLogo, defaultWallpaper } from './gfx.js';
import { APPS, appFor } from './apps/index.js';

// The in-game operating system. It draws onto the two monitor canvases (one virtual desktop
// across both screens), runs windows/apps, and goes through a real power cycle:
// off -> POST logo -> loading dots -> lock screen -> sign in -> desktop -> shut down.
const TB = 48;              // taskbar height
const TITLE = 32;           // window title bar height

export class OS {
  constructor(game, monitors) {
    this.g = game;
    this.hw = game.hw;
    const [m1, m2] = monitors;
    this.displays = [
      { mon: m1, x: 0, y: 0, w: m1.res[0], h: m1.res[1], g: m1.ctx },
      { mon: m2, x: m1.res[0], y: Math.round((m1.res[1] - m2.res[1]) / 2), w: m2.res[0], h: m2.res[1], g: m2.ctx },
    ];
    this.W = this.displays[1].x + this.displays[1].w;
    this.cursor = { x: 800, y: 450, kind: 'arrow', visible: true };
    this.windows = [];
    this.focus = null;
    this.state = 'off';
    this.stateT = 0;
    this.dirty = true;
    this.user = { name: 'You' };
    this.theme = { dark: true, accent: '#4cc2ff', align: 'center' };
    this.pins = null;           // taskbar pins: [{name, icon, app, path}]
    this.desktopItems = null;
    this.startApps = null;
    this.menu = null;           // start menu / flyout / context menu
    this.toasts = [];
    this.clipboard = '';
    this.dirtyShutdown = false;
    this.files = null;
    this.selIcon = -1;
    this.lastClick = { t: 0, x: 0, y: 0 };
    this.wallpaper = null;
    this.wallpaperBlur = null;
    this.load = { cpu: 0, gpu: 0 };
    this.hudEscape = 0;
    this.nextId = 1;
    this.setWallpaper(null);
    this.restore();
  }

  // ------------------------------------------------------------------ persistence
  restore() {
    try {
      const s = JSON.parse(localStorage.getItem('bs_os') || 'null');
      if (s) {
        Object.assign(this.theme, s.theme || {});
        if (s.user) this.user.name = s.user;
        this.files = s.files || null;
        this.dirtyShutdown = !!s.dirtyShutdown;
        this.notes = s.notes || null;
      }
    } catch (e) { /* first run */ }
    if (!this.files) this.files = defaultFiles();
  }

  save() {
    try { localStorage.setItem('bs_os', JSON.stringify({ theme: this.theme, user: this.user.name, files: this.files, dirtyShutdown: this.dirtyShutdown })); } catch (e) { /* storage full or blocked */ }
  }

  setWallpaper(img) {
    const d = this.displays[0];
    const c = document.createElement('canvas');
    c.width = this.W; c.height = d.h;
    const g = c.getContext('2d');
    if (img) {
      // fill each display like Windows "Fill"
      for (const disp of this.displays) {
        const s = Math.max(disp.w / img.width, disp.h / img.height);
        const w = img.width * s, h = img.height * s;
        g.drawImage(img, disp.x + (disp.w - w) / 2, (disp.h - h) / 2, w, h);
      }
    } else {
      const wp = defaultWallpaper(1600, 900, this.theme.dark);
      g.drawImage(wp, 0, 0, d.w, d.h);
      g.drawImage(wp, this.displays[1].x, 0, this.displays[1].w, d.h);
    }
    this.wallpaper = c;
    const b = document.createElement('canvas');
    b.width = Math.round(c.width / 4); b.height = Math.round(c.height / 4);
    const bg = b.getContext('2d');
    bg.filter = 'blur(10px)';
    bg.drawImage(c, -20, -20, b.width + 40, b.height + 40);
    this.wallpaperBlur = b;
    this.dirty = true;
  }

  // ------------------------------------------------------------------ power
  get on() { return !['off', 'sleep'].includes(this.state); }

  powerButton(hold = false) {
    if (!this.g.desk.cables.pcPower.plugged) return; // no power at all
    if (this.state === 'off') this.go('post');
    else if (this.state === 'sleep') this.go('lock');
    else if (hold) this.hardOff();
    else this.shutdown(false);
  }

  hardOff() {
    // pulling the plug / holding the button: instant death, Windows notices next time
    if (this.state === 'off') return;
    this.dirtyShutdown = !['shutting'].includes(this.state);
    this.windows = []; this.focus = null; this.menu = null;
    this.state = 'off';
    this.save();
    this.g.onPcPower?.(false);
    this.dirty = true;
  }

  shutdown(restart) { this.menu = null; this.restartAfter = restart; this.go('shutting'); }

  sleep() { this.menu = null; this.go('sleep'); }

  go(s) {
    this.state = s;
    this.stateT = 0;
    this.dirty = true;
    if (s === 'post') { this.g.onPcPower?.(true); this.loginDone = false; }
    if (s === 'desktop' && !this.loginDone) {
      this.loginDone = true;
      // the apps you had open on your real PC start up again, sitting on the taskbar
      for (const it of this.openAtLogin || []) { const w = this.launch(it); if (w) { w.min = true; if (this.focus === w) this.focus = null; } }
      if (!this.welcomed) { this.welcomed = true; setTimeout(() => this.notify('Welcome', `Signed in as ${this.user.name}.`), 1200); }
    }
  }

  bsod(code = 'VIDEO_TDR_FAILURE') { this.windows = []; this.menu = null; this.bsodCode = code; this.dirtyShutdown = true; this.go('bsod'); }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    this.stateT += dt;
    const st = this.state;
    if (st === 'post' && this.stateT > 2.6) this.go('boot');
    else if (st === 'boot' && this.stateT > (this.dirtyShutdown ? 9 : 4.5)) { this.dirtyShutdown = false; this.save(); this.go('lock'); }
    else if (st === 'welcome' && this.stateT > 1.8) this.go('desktop');
    else if (st === 'shutting' && this.stateT > 2.4) {
      this.windows = []; this.focus = null; this.save();
      if (this.restartAfter) this.go('post'); else { this.state = 'off'; this.dirty = true; this.g.onPcPower?.(false); }
    } else if (st === 'bsod' && this.stateT > 7) this.go('post');
    if (['post', 'boot', 'welcome', 'shutting', 'bsod'].includes(st)) this.dirty = true;
    if (st === 'lock' || st === 'login') { if (Math.floor(this.stateT) !== this._sec) { this._sec = Math.floor(this.stateT); this.dirty = true; } }
    // apps
    let cpu = 0.02, gpu = 0.01;
    for (const w of this.windows) {
      if (w.app.update && w.app.update(dt, w)) this.dirty = true;
      cpu += w.app.cpuLoad || 0.005; gpu += w.app.gpuLoad || 0;
    }
    this.load.cpu = Math.min(1, cpu); this.load.gpu = Math.min(1, gpu);
    // clock tick on the taskbar
    const m = new Date().getMinutes();
    if (m !== this._min) { this._min = m; this.dirty = true; }
    this.toasts = this.toasts.filter(t => (t.t += dt) < 6);
    if (this.toasts.length) this.dirty = true;
    // monitors: signal only while the PC is doing something
    const sig1 = !['off', 'sleep'].includes(st);
    const sig2 = sig1 && !['post', 'boot', 'bsod'].includes(st);
    this.displays[0].mon.signal = sig1;
    this.displays[1].mon.signal = sig2;
    if (this.dirty) { this.draw(); this.dirty = false; }
    this.updateCursorImage();
  }

  // ------------------------------------------------------------------ drawing
  draw() {
    for (const [i, d] of this.displays.entries()) {
      const g = d.g;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.textBaseline = 'alphabetic';
      const st = this.state;
      if (st === 'off' || st === 'sleep') { g.fillStyle = '#000'; g.fillRect(0, 0, d.w, d.h); }
      else if (st === 'post') this.drawPost(g, d, i);
      else if (st === 'boot' || st === 'welcome' || st === 'shutting') this.drawSpinner(g, d, i);
      else if (st === 'bsod') this.drawBsod(g, d, i);
      else if (st === 'lock' || st === 'login') this.drawLock(g, d, i);
      else this.drawDesktop(g, d, i);
      d.mon.markDirty();
    }
  }

  drawPost(g, d, i) {
    g.fillStyle = '#000'; g.fillRect(0, 0, d.w, d.h);
    if (i) return;
    const brand = (this.hw.board || 'Motherboard').split(' ')[0].toUpperCase();
    font(g, 64, 700); g.fillStyle = '#e6e6e6'; g.textAlign = 'center';
    g.fillText(brand, d.w / 2, d.h / 2 - 10);
    font(g, 18, 400); g.fillStyle = '#9a9a9a';
    g.fillText(this.hw.board || '', d.w / 2, d.h / 2 + 30);
    g.textAlign = 'left'; font(g, 15, 400, MONO); g.fillStyle = '#bbb';
    g.fillText('Press DEL or F2 to enter UEFI BIOS setting', 30, d.h - 40);
    g.fillText(`${this.hw.cpuName}   ${this.hw.parts.ram.gb} GB RAM   ${this.hw.parts.gpu.name}`, 30, d.h - 18);
  }

  drawSpinner(g, d, i) {
    g.fillStyle = this.state === 'welcome' ? this.accentBg() : '#000';
    g.fillRect(0, 0, d.w, d.h);
    if (i) return;
    if (this.state === 'welcome') { g.drawImage(this.wallpaperBlur, 0, 0, this.W, d.h); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, d.w, d.h); }
    const cx = d.w / 2, cy = d.h * (this.state === 'boot' ? 0.62 : 0.55);
    // the "spinning dots"
    const t = this.stateT;
    for (let k = 0; k < 5; k++) {
      const ph = ((t * 0.9 - k * 0.12) % 1.6 + 1.6) % 1.6;
      const a = ph < 1 ? (ph * ph) * Math.PI * 2 * 0.8 + ph * Math.PI * 2 * 0.2 : Math.PI * 2;
      const alpha = ph < 1.05 ? 1 : 0;
      g.fillStyle = `rgba(255,255,255,${alpha})`;
      g.beginPath(); g.arc(cx + Math.sin(a) * 22, cy - Math.cos(a) * 22, 3, 0, Math.PI * 2); g.fill();
    }
    g.textAlign = 'center'; font(g, 22, 400); g.fillStyle = '#fff';
    if (this.state === 'shutting') g.fillText(this.restartAfter ? 'Restarting' : 'Shutting down', cx, cy + 70);
    else if (this.state === 'welcome') { g.drawImage(icon('user', 160), cx - 80, cy - 270); font(g, 30, 600); g.fillText(this.user.name, cx, cy - 70); font(g, 22); g.fillText('Welcome', cx, cy + 70); }
    else {
      startLogo(g, cx - 55, d.h * 0.3, 110, this.theme.accent);
      if (this.dirtyShutdown && this.stateT > 1.2) {
        font(g, 18); g.fillStyle = '#ddd';
        const pct = Math.min(100, Math.floor((this.stateT - 1.2) / 7.4 * 100));
        g.fillText(`Scanning and repairing drive (C:): ${pct}% complete`, cx, cy + 80);
      }
    }
  }

  drawBsod(g, d, i) {
    g.fillStyle = '#0063b1'; g.fillRect(0, 0, d.w, d.h);
    if (i) return;
    g.fillStyle = '#fff'; g.textAlign = 'left';
    font(g, 120, 300); g.fillText(':(', 150, 260);
    font(g, 26, 300);
    g.fillText('Your PC ran into a problem and needs to restart. We\'re', 150, 340);
    g.fillText('just collecting some error info, and then we\'ll restart for you.', 150, 376);
    font(g, 26, 300); g.fillText(`${Math.min(100, Math.floor(this.stateT / 6 * 100))}% complete`, 150, 440);
    font(g, 15, 400);
    g.fillText('If you call a support person, give them this info:', 150, 520);
    g.fillText('Stop code: ' + this.bsodCode, 150, 545);
  }

  drawLock(g, d, i) {
    g.drawImage(this.state === 'login' ? this.wallpaperBlur : this.wallpaper, d.x, 0, d.w, d.h, 0, 0, d.w, d.h);
    if (this.state === 'login') { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, d.w, d.h); }
    if (i) return;
    const now = new Date();
    g.textAlign = 'center'; g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12;
    if (this.state === 'lock') {
      font(g, 150, 600);
      g.fillText(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: this.theme.clock24 === undefined ? undefined : !this.theme.clock24 }).replace(/\s?[AP]M/i, ''), d.w / 2, 260);
      font(g, 30, 400);
      g.fillText(now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }), d.w / 2, 310);
      font(g, 16, 400); g.fillText('Press any key or click to sign in', d.w / 2, d.h - 60);
    } else {
      g.shadowBlur = 0;
      if (this.user.pic && !this.user.picImg) { const im = new Image(); im.onload = () => { this.dirty = true; }; im.src = 'data:image/jpeg;base64,' + this.user.pic; this.user.picImg = im; }
      if (this.user.picImg?.complete && this.user.picImg.naturalWidth) {
        g.save(); g.beginPath(); g.arc(d.w / 2, d.h / 2 - 140, 90, 0, Math.PI * 2); g.clip();
        g.drawImage(this.user.picImg, d.w / 2 - 90, d.h / 2 - 230, 180, 180); g.restore();
      } else g.drawImage(icon('user', 180), d.w / 2 - 90, d.h / 2 - 230);
      font(g, 32, 600); g.fillText(this.user.name, d.w / 2, d.h / 2 + 5);
      const b = this.signBtn = { x: d.w / 2 - 70, y: d.h / 2 + 40, w: 140, h: 36 };
      fillRR(g, b.x, b.y, b.w, b.h, 6, inside(this.cursor.x, this.cursor.y, b.x, b.y, b.w, b.h) ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.2)');
      font(g, 15, 600); g.fillText('Sign in', d.w / 2, b.y + 24);
    }
    g.shadowBlur = 0;
    // network + power at the bottom right
    g.drawImage(this.netIcon(22), d.w - 90, d.h - 50);
    g.drawImage(icon('power', 22), d.w - 50, d.h - 50);
  }

  accentBg() { return '#0b2a4a'; }

  drawDesktop(g, d, i) {
    g.drawImage(this.wallpaper, d.x, 0, d.w, d.h, 0, 0, d.w, d.h);
    g.save();
    g.translate(-d.x, -d.y);
    if (i === 0) this.drawIcons(g);
    for (const w of this.windows) if (!w.min) this.drawWindow(g, w);
    g.restore();
    if (i === 0) {
      this.drawTaskbar(g, d);
      g.save(); g.translate(-d.x, -d.y);
      if (this.menu) this.drawMenu(g);
      this.drawToasts(g, d);
      g.restore();
    }
  }

  // ---------- desktop icons
  iconCells() {
    const items = this.desktopItems || defaultDesktop();
    const cells = [];
    const cw = 84, ch = 90;
    const rows = Math.floor((this.displays[0].h - TB - 8) / ch);
    items.forEach((it, k) => cells.push({ it, x: 8 + Math.floor(k / rows) * cw, y: 6 + (k % rows) * ch, w: cw - 4, h: ch - 4 }));
    return cells;
  }

  drawIcons(g) {
    const cells = this.iconCells();
    cells.forEach((c, k) => {
      const hover = inside(this.cursor.x, this.cursor.y, c.x, c.y, c.w, c.h);
      if (k === this.selIcon) fillRR(g, c.x, c.y, c.w, c.h, 4, 'rgba(120,180,255,0.32)');
      else if (hover) fillRR(g, c.x, c.y, c.w, c.h, 4, 'rgba(255,255,255,0.12)');
      const img = this.itemIcon(c.it, 48);
      g.drawImage(img, c.x + (c.w - 48) / 2, c.y + 6, 48, 48);
      font(g, 12.5, 400); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 3; g.shadowOffsetY = 1;
      const words = c.it.name;
      text(g, words, c.x + c.w / 2, c.y + 70, c.w - 4, 'center');
      g.shadowBlur = 0; g.shadowOffsetY = 0;
    });
  }

  itemIcon(it, size) {
    if (it.img) return it.img;
    if (it.iconData && !it._img) { const im = new Image(); im.onload = () => { it.img = im; this.dirty = true; }; im.src = 'data:image/png;base64,' + it.iconData; it._img = true; }
    const a = APPS[it.app];
    if (a) return icon(a.icon, size);
    return icon('game', size, (it.name || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() + '|' + colorFor(it.name));
  }

  // ---------- windows
  drawWindow(g, w) {
    const focused = this.focus === w;
    const r = w.max ? 0 : 8;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = focused ? 30 : 16; g.shadowOffsetY = 6;
    fillRR(g, w.x, w.y, w.w, w.h, r, this.theme.dark ? '#202020' : '#f3f3f3');
    g.restore();
    strokeRR(g, w.x, w.y, w.w, w.h, r, focused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)');
    // title bar
    const dark = this.theme.dark;
    g.save();
    rr(g, w.x, w.y, w.w, w.h, r); g.clip();
    g.fillStyle = dark ? (focused ? '#1c1c1c' : '#262626') : (focused ? '#eaeaea' : '#f0f0f0');
    g.fillRect(w.x, w.y, w.w, TITLE);
    g.drawImage(this.itemIcon(w, 16), w.x + 10, w.y + 8, 16, 16);
    font(g, 12.5, 400); g.fillStyle = dark ? (focused ? '#fff' : '#999') : '#222';
    text(g, w.title, w.x + 34, w.y + 21, w.w - 200);
    // caption buttons
    const bx = w.x + w.w - 138;
    const hov = (k) => inside(this.cursor.x, this.cursor.y, bx + k * 46, w.y, 46, TITLE);
    for (let k = 0; k < 3; k++) {
      if (hov(k)) { g.fillStyle = k === 2 ? '#c42b1c' : 'rgba(255,255,255,0.1)'; g.fillRect(bx + k * 46, w.y, 46, TITLE); }
      g.strokeStyle = dark ? '#ddd' : '#333'; g.lineWidth = 1;
      const cx = bx + k * 46 + 23, cy = w.y + 16;
      g.beginPath();
      if (k === 0) { g.moveTo(cx - 5, cy + 0.5); g.lineTo(cx + 5, cy + 0.5); }
      else if (k === 1) { if (w.max) { g.rect(cx - 4.5, cy - 2.5, 7, 7); g.moveTo(cx - 2.5, cy - 4.5); g.lineTo(cx + 4.5, cy - 4.5); g.lineTo(cx + 4.5, cy + 2.5); } else g.rect(cx - 4.5, cy - 4.5, 9, 9); }
      else { g.moveTo(cx - 5, cy - 5); g.lineTo(cx + 5, cy + 5); g.moveTo(cx + 5, cy - 5); g.lineTo(cx - 5, cy + 5); }
      g.stroke();
    }
    // client area
    g.translate(w.x, w.y + TITLE);
    g.beginPath(); g.rect(0, 0, w.w, w.h - TITLE); g.clip();
    try { w.app.draw(g, w.w, w.h - TITLE, this); } catch (e) { console.error(e); }
    g.restore();
  }

  // ---------- taskbar
  taskItems() {
    const pins = this.pins || defaultPins();
    const items = pins.map(p => ({ ...p }));
    for (const w of this.windows) {
      const k = items.findIndex(p => p.app === w.appId && (!p.path || p.path === w.path) && !p.wins?.length);
      if (k >= 0 && !items[k].wins) items[k].wins = [w];
      else if (k >= 0) items[k].wins.push(w);
      else items.push({ name: w.title, app: w.appId, iconData: w.iconData, img: w.img, wins: [w] });
    }
    return items;
  }

  taskbarLayout() {
    const d = this.displays[0];
    const items = this.taskItems();
    const n = 3 + items.length;
    const iw = 44;
    const total = n * iw;
    const x0 = this.theme.align === 'left' ? 8 : Math.round(d.w / 2 - total / 2);
    const slots = [];
    slots.push({ kind: 'start', x: x0 });
    slots.push({ kind: 'search', x: x0 + iw });
    slots.push({ kind: 'taskview', x: x0 + iw * 2 });
    items.forEach((it, k) => slots.push({ kind: 'app', it, x: x0 + iw * (3 + k) }));
    return { slots, y: d.h - TB, iw };
  }

  drawTaskbar(g, d) {
    const y = d.h - TB;
    g.drawImage(this.wallpaperBlur, 0, y / 4, d.w / 4 * (d.w / this.W) * (this.W / d.w), TB / 4, 0, y, d.w, TB);
    g.fillStyle = this.theme.dark ? 'rgba(28,28,28,0.86)' : 'rgba(240,240,240,0.85)'; g.fillRect(0, y, d.w, TB);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, y, d.w, 1);
    const L = this.taskbarLayout();
    for (const s of L.slots) {
      const hover = inside(this.cursor.x, this.cursor.y, s.x, y, L.iw, TB);
      const active = s.kind === 'start' && this.menu?.type === 'start';
      if (hover || active) fillRR(g, s.x + 2, y + 4, L.iw - 4, TB - 8, 5, 'rgba(255,255,255,0.09)');
      if (s.kind === 'start') startLogo(g, s.x + 12, y + 14, 20, this.theme.accent);
      else if (s.kind === 'search') g.drawImage(icon('search', 20), s.x + 12, y + 14, 20, 20);
      else if (s.kind === 'taskview') g.drawImage(icon('taskview', 22), s.x + 11, y + 13, 22, 22);
      else {
        g.drawImage(this.itemIcon(s.it, 24), s.x + 10, y + 12, 24, 24);
        if (s.it.wins?.length) {
          const isF = s.it.wins.includes(this.focus);
          fillRR(g, s.x + L.iw / 2 - (isF ? 8 : 3), y + TB - 6, isF ? 16 : 6, 3, 1.5, isF ? this.theme.accent : '#9a9a9a');
        }
      }
    }
    // system tray: net, volume, clock
    const now = new Date();
    font(g, 12, 400); g.fillStyle = this.theme.dark ? '#fff' : '#111'; g.textAlign = 'right';
    g.fillText(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: this.theme.clock24 === undefined ? undefined : !this.theme.clock24 }), d.w - 14, y + 21);
    g.fillText(now.toLocaleDateString(), d.w - 14, y + 38);
    const tx = d.w - 160;
    this.trayBox = { x: tx, y, w: 70, h: TB };
    if (inside(this.cursor.x, this.cursor.y, tx, y, 70, TB) || this.menu?.type === 'quick') fillRR(g, tx, y + 4, 70, TB - 8, 5, 'rgba(255,255,255,0.09)');
    g.drawImage(this.netIcon(18), tx + 10, y + 15);
    drawSpeaker(g, tx + 42, y + 24);
  }

  netIcon(size) {
    const st = this.g.router.status(this.hw.netAdapter !== 'ethernet-only');
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d'); g.scale(size / 20, size / 20);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 1.6; g.lineCap = 'round';
    if (st.link === 'ethernet') { g.strokeRect(3, 4, 14, 9); g.fillRect(6, 13, 8, 3); g.beginPath(); g.moveTo(10, 16); g.lineTo(10, 19); g.stroke(); }
    else if (st.link === 'wifi') {
      const bars = Math.ceil(this.g.router.signal() * 4);
      for (let k = 0; k < 4; k++) { g.globalAlpha = k < bars ? 1 : 0.3; g.beginPath(); g.arc(10, 17, 3 + k * 4, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }
      g.globalAlpha = 1;
    } else { g.globalAlpha = 0.45; g.beginPath(); for (let k = 0; k < 4; k++) g.arc(10, 17, 3 + k * 4, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); g.globalAlpha = 1; }
    if (!st.internet) {
      // the little "no internet" globe / X
      g.fillStyle = '#1c1c1c'; g.beginPath(); g.arc(15, 15, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = st.link ? '#ffd166' : '#ff6b6b'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(12.6, 12.6); g.lineTo(17.4, 17.4); g.moveTo(17.4, 12.6); g.lineTo(12.6, 17.4); g.stroke();
    }
    return c;
  }

  // ---------- menus (start, quick settings, context)
  drawMenu(g) {
    const m = this.menu;
    const dark = this.theme.dark;
    const bg = dark ? 'rgba(36,36,36,0.97)' : 'rgba(245,245,245,0.97)';
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 30;
    fillRR(g, m.x, m.y, m.w, m.h, 8, bg);
    g.restore();
    strokeRR(g, m.x, m.y, m.w, m.h, 8, 'rgba(255,255,255,0.1)');
    g.fillStyle = dark ? '#fff' : '#111';
    if (m.type === 'start') this.drawStart(g, m);
    else if (m.type === 'quick') this.drawQuick(g, m);
    else if (m.type === 'context' || m.type === 'powermenu') {
      font(g, 13, 400);
      m.items.forEach((it, k) => {
        const iy = m.y + 6 + k * 32;
        if (inside(this.cursor.x, this.cursor.y, m.x + 4, iy, m.w - 8, 30)) fillRR(g, m.x + 4, iy, m.w - 8, 30, 4, 'rgba(255,255,255,0.08)');
        g.fillStyle = it.disabled ? '#777' : (dark ? '#fff' : '#111');
        text(g, it.label, m.x + 16, iy + 20, m.w - 30);
      });
    }
  }

  startItems() {
    const list = this.startApps || defaultStart();
    return list;
  }

  drawStart(g, m) {
    const dark = this.theme.dark;
    // search box
    fillRR(g, m.x + 32, m.y + 26, m.w - 64, 36, 18, dark ? '#1e1e1e' : '#fff');
    strokeRR(g, m.x + 32, m.y + 26, m.w - 64, 36, 18, 'rgba(255,255,255,0.12)');
    g.drawImage(icon('search', 16), m.x + 46, m.y + 36, 16, 16);
    font(g, 13); g.fillStyle = '#9a9a9a'; text(g, m.query || 'Search for apps, settings, and documents', m.x + 72, m.y + 49, m.w - 120);
    font(g, 14, 600); g.fillStyle = dark ? '#fff' : '#111';
    g.fillText(m.all ? 'All apps' : 'Pinned', m.x + 56, m.y + 100);
    const allBtn = { x: m.x + m.w - 130, y: m.y + 84, w: 90, h: 24 };
    fillRR(g, allBtn.x, allBtn.y, allBtn.w, allBtn.h, 4, 'rgba(255,255,255,0.07)');
    font(g, 12); g.fillText(m.all ? '‹ Back' : 'All apps ›', allBtn.x + 14, allBtn.y + 16);
    m.allBtn = allBtn;
    m.cells = [];
    let list = this.startItems();
    if (m.query) list = list.filter(a => a.name.toLowerCase().includes(m.query.toLowerCase()));
    if (m.all || m.query) {
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      const top = m.y + 120, rowH = 36, maxRows = Math.floor((m.h - 210) / rowH);
      const scroll = Math.max(0, Math.min(m.scroll || 0, sorted.length - maxRows));
      sorted.slice(scroll, scroll + maxRows).forEach((it, k) => {
        const c = { x: m.x + 40, y: top + k * rowH, w: m.w - 80, h: rowH - 2, it };
        if (inside(this.cursor.x, this.cursor.y, c.x, c.y, c.w, c.h)) fillRR(g, c.x, c.y, c.w, c.h, 4, 'rgba(255,255,255,0.07)');
        g.drawImage(this.itemIcon(it, 24), c.x + 8, c.y + 5, 24, 24);
        font(g, 13); g.fillStyle = dark ? '#fff' : '#111'; text(g, it.name, c.x + 44, c.y + 22, c.w - 60);
        m.cells.push(c);
      });
    } else {
      const cols = 6, cw = (m.w - 64) / cols, ch = 84;
      list.slice(0, 18).forEach((it, k) => {
        const c = { x: m.x + 32 + (k % cols) * cw, y: m.y + 118 + Math.floor(k / cols) * ch, w: cw, h: ch - 4, it };
        if (inside(this.cursor.x, this.cursor.y, c.x, c.y, c.w, c.h)) fillRR(g, c.x + 4, c.y, c.w - 8, c.h, 4, 'rgba(255,255,255,0.07)');
        g.drawImage(this.itemIcon(it, 32), c.x + c.w / 2 - 16, c.y + 10, 32, 32);
        font(g, 12); g.fillStyle = dark ? '#fff' : '#111'; text(g, it.name, c.x + c.w / 2, c.y + 62, c.w - 8, 'center');
        m.cells.push(c);
      });
      // recommended: recent files
      font(g, 14, 600); g.fillStyle = dark ? '#fff' : '#111'; g.fillText('Recommended', m.x + 56, m.y + 400);
      const rec = this.recentFiles().slice(0, 4);
      if (!rec.length) { font(g, 12.5); g.fillStyle = '#9a9a9a'; g.fillText('Files you use will show up here.', m.x + 56, m.y + 430); }
      rec.forEach((f, k) => {
        const c = { x: m.x + 40 + (k % 2) * ((m.w - 80) / 2), y: m.y + 416 + Math.floor(k / 2) * 52, w: (m.w - 80) / 2 - 8, h: 46, file: f };
        if (inside(this.cursor.x, this.cursor.y, c.x, c.y, c.w, c.h)) fillRR(g, c.x, c.y, c.w, c.h, 4, 'rgba(255,255,255,0.07)');
        g.drawImage(icon(f.app === 'notepad' ? 'notepad' : 'file', 28), c.x + 8, c.y + 9, 28, 28);
        font(g, 12.5); g.fillStyle = dark ? '#fff' : '#111'; text(g, f.name, c.x + 46, c.y + 21, c.w - 56);
        font(g, 11); g.fillStyle = '#9a9a9a'; text(g, 'Recently edited', c.x + 46, c.y + 37, c.w - 56);
        m.cells.push(c);
      });
    }
    // bottom: user + power
    g.fillStyle = dark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)'; g.fillRect(m.x, m.y + m.h - 64, m.w, 64);
    g.drawImage(icon('user', 32), m.x + 48, m.y + m.h - 48, 32, 32);
    font(g, 13); g.fillStyle = dark ? '#fff' : '#111'; g.fillText(this.user.name, m.x + 90, m.y + m.h - 27);
    const pb = { x: m.x + m.w - 84, y: m.y + m.h - 52, w: 40, h: 40 };
    if (inside(this.cursor.x, this.cursor.y, pb.x, pb.y, pb.w, pb.h)) fillRR(g, pb.x, pb.y, pb.w, pb.h, 4, 'rgba(255,255,255,0.08)');
    g.drawImage(icon('power', 20), pb.x + 10, pb.y + 10, 20, 20);
    m.powerBtn = pb;
  }

  drawQuick(g, m) {
    const r = this.g.router;
    const st = r.status(true);
    const dark = this.theme.dark;
    font(g, 14, 600); g.fillStyle = dark ? '#fff' : '#111';
    g.fillText('Network', m.x + 20, m.y + 34);
    const line = (y, a, b, col) => { font(g, 13); g.fillStyle = dark ? '#fff' : '#111'; g.fillText(a, m.x + 20, y); font(g, 12); g.fillStyle = col || '#9a9a9a'; g.fillText(b, m.x + 20, y + 18); };
    const state = st.link === 'ethernet' ? 'Ethernet' : st.link === 'wifi' ? r.ssid : 'Not connected';
    line(m.y + 66, state, st.internet ? 'Connected, secured' : st.link ? (st.state === 'connecting' ? 'Identifying…' : 'No internet') : 'No connections available', st.internet ? '#6ccb5f' : '#ffd166');
    // wifi networks
    font(g, 12, 600); g.fillStyle = '#9a9a9a'; g.fillText('Wi-Fi networks', m.x + 20, m.y + 120);
    m.nets = [];
    const nets = r.wifiUp() ? [{ ssid: r.ssid, bars: Math.ceil(r.signal() * 4), ours: true }] : [];
    nets.push({ ssid: 'Garcia_Family', bars: 2 }, { ssid: 'HomeNet-2.4G', bars: 1 }, { ssid: 'definitely_not_a_van', bars: 1 });
    nets.forEach((n, k) => {
      const c = { x: m.x + 12, y: m.y + 130 + k * 40, w: m.w - 24, h: 36, n };
      if (inside(this.cursor.x, this.cursor.y, c.x, c.y, c.w, c.h)) fillRR(g, c.x, c.y, c.w, c.h, 4, 'rgba(255,255,255,0.07)');
      font(g, 13); g.fillStyle = dark ? '#fff' : '#111'; g.fillText(n.ssid, c.x + 40, c.y + 16);
      font(g, 11); g.fillStyle = '#9a9a9a';
      g.fillText(n.ours ? (st.link === 'wifi' ? 'Connected' : (r.pcKnowsWifi ? 'Secured' : 'Secured, enter password')) : 'Secured', c.x + 40, c.y + 31);
      g.strokeStyle = dark ? '#fff' : '#111'; g.lineWidth = 1.3;
      for (let b = 0; b < 4; b++) { g.globalAlpha = b < n.bars ? 1 : 0.25; g.beginPath(); g.arc(c.x + 20, c.y + 26, 2 + b * 3.4, -Math.PI * 0.75, -Math.PI * 0.25); g.stroke(); }
      g.globalAlpha = 1;
      m.nets.push(c);
    });
    if (m.pass !== undefined) {
      const y = m.y + m.h - 92;
      font(g, 12); g.fillStyle = '#9a9a9a'; g.fillText(`Enter the network security key for ${r.ssid}`, m.x + 20, y);
      fillRR(g, m.x + 20, y + 10, m.w - 40, 32, 4, dark ? '#1a1a1a' : '#fff');
      strokeRR(g, m.x + 20, y + 10, m.w - 40, 32, 4, this.theme.accent);
      font(g, 14, 400, MONO); g.fillStyle = dark ? '#fff' : '#111'; g.fillText(m.pass + (Math.floor(performance.now() / 500) % 2 ? '|' : ''), m.x + 30, y + 32);
      if (m.passErr) { font(g, 11); g.fillStyle = '#ff6b6b'; g.fillText(m.passErr, m.x + 20, y + 60); }
      this.dirty = true;
    }
  }

  drawToasts(g, d) {
    this.toasts.forEach((t, k) => {
      const w = 360, h = 86, x = d.w - w - 14, y = d.h - TB - 14 - (k + 1) * (h + 10) + 10;
      const a = Math.min(1, t.t * 4, (6 - t.t) * 3);
      g.globalAlpha = a;
      fillRR(g, x, y, w, h, 8, this.theme.dark ? '#2b2b2b' : '#f9f9f9');
      strokeRR(g, x, y, w, h, 8, 'rgba(255,255,255,0.1)');
      font(g, 14, 600); g.fillStyle = this.theme.dark ? '#fff' : '#111'; text(g, t.title, x + 18, y + 32, w - 36);
      font(g, 13); g.fillStyle = '#bbb'; text(g, t.body, x + 18, y + 58, w - 36);
      g.globalAlpha = 1;
    });
  }

  notify(title, body) { this.toasts.push({ title, body, t: 0 }); this.dirty = true; this.g.audio?.beep(880, 0.06, { vol: 0.02, type: 'sine' }); }

  recentFiles() { return Object.values(this.files).filter(f => f.type === 'file' && f.edited).sort((a, b) => b.edited - a.edited); }

  // ------------------------------------------------------------------ windows API
  open(appId, args = {}) {
    const A = APPS[appId];
    if (!A) return null;
    if (A.single) { const ex = this.windows.find(w => w.appId === appId); if (ex) { this.raise(ex); ex.min = false; return ex; } }
    const d = this.displays[0];
    const w = A.w || 900, h = A.h || 600;
    const off = (this.windows.length % 6) * 28;
    const win = {
      id: this.nextId++, appId, title: args.title || A.title, x: Math.round((d.w - w) / 2 + off - 60), y: Math.round(Math.max(10, (d.h - TB - h) / 2 + off - 40)),
      w, h, min: false, max: false, path: args.path, iconData: args.iconData, img: args.img, name: args.title || A.title, app: null,
    };
    win.app = new A(this, win, args);
    this.windows.push(win);
    this.focus = win;
    this.dirty = true;
    this.g.pcActivity?.();
    return win;
  }

  close(w) {
    w.app.close?.();
    if (this.capture === w) this.capture = null;
    this.windows = this.windows.filter(x => x !== w);
    if (this.focus === w) this.focus = this.windows.filter(x => !x.min).at(-1) || null;
    this.dirty = true;
  }

  raise(w) { this.windows = this.windows.filter(x => x !== w); this.windows.push(w); this.focus = w; this.dirty = true; }

  maximize(w) {
    if (w.max) { Object.assign(w, w.prev); w.max = false; }
    else {
      w.prev = { x: w.x, y: w.y, w: w.w, h: w.h };
      const d = this.displayAt(w.x + w.w / 2, w.y + 10);
      Object.assign(w, { x: d.x, y: d.y, w: d.w, h: d.h - (d === this.displays[0] ? TB : 0) });
      w.max = true;
    }
    this.dirty = true;
  }

  displayAt(x, y) { return this.displays.find(d => inside(x, y, d.x, d.y, d.w, d.h)) || this.displays[0]; }

  msgbox(title, body, opts = {}) { return this.open('msgbox', { title, body, ...opts }); }

  // launch something from the desktop / taskbar / start
  launch(it) {
    if (!it) return;
    this.menu = null;
    if (it.app && APPS[it.app]) return this.open(it.app, { title: it.app === 'realapp' || it.app === 'library' ? it.name : undefined, path: it.path, iconData: it.iconData, img: it.img, item: it });
    const app = appFor(it);
    return this.open(app, { title: it.name, path: it.path, iconData: it.iconData, img: it.img, item: it });
  }

  // ------------------------------------------------------------------ input
  hitWindow(x, y) {
    for (let k = this.windows.length - 1; k >= 0; k--) { const w = this.windows[k]; if (!w.min && inside(x, y, w.x, w.y, w.w, w.h)) return w; }
    return null;
  }

  mouseMove(dx, dy) {
    if (this.capture && this.state === 'desktop' && this.windows.includes(this.capture)) { this.capture.app.look?.(dx, dy); return; }
    this.capture = null;
    const c = this.cursor;
    c.x = Math.max(0, Math.min(this.W - 1, c.x + dx));
    c.y += dy;
    const dd = c.x < this.displays[1].x ? this.displays[0] : this.displays[1];
    // pushing up past the top edge goes to the bar above the monitors (the game watches hudEscape)
    // only in the middle of the top edge, so flicking up to a menu or a close button never triggers it
    const mid = c.x > dd.x + dd.w * 0.22 && c.x < dd.x + dd.w * 0.78 && !this.drag;
    if (c.y < dd.y) { if (mid) this.hudEscape += dd.y - c.y; c.y = dd.y; } else if (dy > 0 || !mid) this.hudEscape = 0;
    this.hudEscapeT = performance.now();
    c.y = Math.min(dd.y + dd.h - 1, c.y);
    if (this.drag) {
      const w = this.drag.w;
      if (this.drag.mode === 'move') {
        if (w.max && (Math.abs(c.x - this.drag.sx) > 8 || Math.abs(c.y - this.drag.sy) > 8)) { this.maximize(w); w.x = c.x - w.w / 2; this.drag.ox = w.w / 2; }
        w.x = Math.round(c.x - this.drag.ox); w.y = Math.round(Math.max(0, c.y - this.drag.oy));
      } else {
        const A = APPS[w.appId];
        w.w = Math.max(A.minW || 320, Math.round(this.drag.w0 + c.x - this.drag.sx));
        w.h = Math.max(A.minH || 200, Math.round(this.drag.h0 + c.y - this.drag.sy));
      }
      this.dirty = true;
    } else if (this.state === 'desktop') {
      const w = this.hitWindow(c.x, c.y);
      if (w && c.y > w.y + TITLE) w.app.mouse?.('move', c.x - w.x, c.y - w.y - TITLE, -1, this.buttons);
      // hover highlights change: redraw at most ~30x per second
      const now = performance.now();
      if (now - (this._hov || 0) > 33) { this._hov = now; this.dirty = true; }
    } else if (this.state === 'login') this.dirty = true;
  }

  mouseButton(b, down) {
    if (this.capture && this.state === 'desktop' && this.windows.includes(this.capture)) { this.capture.app.captureClick?.(b, down); return; }
    const { x, y } = this.cursor;
    this.buttons = down ? (this.buttons | (1 << b)) : (this.buttons & ~(1 << b));
    if (this.state === 'lock') { if (down) this.go('login'); return; }
    if (this.state === 'login') {
      const s = this.signBtn;
      if (down && s && inside(x, y, s.x, s.y, s.w, s.h)) this.go('welcome');
      return;
    }
    if (this.state !== 'desktop') return;
    if (!down) {
      if (this.drag) { this.drag = null; this.dirty = true; }
      const w = this.hitWindow(x, y);
      if (w && y > w.y + TITLE) w.app.mouse?.('up', x - w.x, y - w.y - TITLE, b);
      return;
    }
    this.dirty = true;
    const now = performance.now();
    const dbl = b === 0 && now - this.lastClick.t < 420 && Math.hypot(x - this.lastClick.x, y - this.lastClick.y) < 6;
    this.lastClick = { t: dbl ? 0 : now, x, y };
    // menus first
    if (this.menu && this.clickMenu(x, y, b)) return;
    // taskbar
    const d0 = this.displays[0];
    if (x < d0.w && y >= d0.h - TB) { this.clickTaskbar(x, y, b); return; }
    // windows
    const w = this.hitWindow(x, y);
    if (w) {
      if (this.focus !== w) this.raise(w);
      if (y < w.y + TITLE) {
        const bx = w.x + w.w - 138;
        if (b === 0 && x >= bx) { const k = Math.floor((x - bx) / 46); if (k === 0) { w.min = true; this.focus = null; } else if (k === 1) this.maximize(w); else this.close(w); return; }
        if (dbl) { this.maximize(w); return; }
        if (b === 0) this.drag = { w, mode: 'move', ox: x - w.x, oy: y - w.y, sx: x, sy: y };
        return;
      }
      if (b === 0 && !w.max && x > w.x + w.w - 14 && y > w.y + w.h - 14) { this.drag = { w, mode: 'size', sx: x, sy: y, w0: w.w, h0: w.h }; return; }
      w.app.mouse?.(dbl ? 'dbl' : 'down', x - w.x, y - w.y - TITLE, b);
      return;
    }
    this.focus = null;
    // desktop icons
    const cells = this.iconCells();
    const k = cells.findIndex(c => inside(x, y, c.x, c.y, c.w, c.h));
    this.selIcon = k;
    if (k >= 0 && dbl) this.launch(cells[k].it);
    else if (b === 2) this.menu = { type: 'context', x, y, w: 220, h: 6 * 2 + 4 * 32, items: [
      { label: 'Refresh', act: () => { this.dirty = true; } },
      { label: 'Personalize', act: () => this.open('settings', { page: 'personal' }) },
      { label: 'Display settings', act: () => this.open('settings', { page: 'display' }) },
      { label: 'Open in Terminal', act: () => this.open('terminal') },
    ] };
  }

  clickTaskbar(x, y, b) {
    const L = this.taskbarLayout();
    if (this.trayBox && inside(x, y, this.trayBox.x, this.trayBox.y, this.trayBox.w, this.trayBox.h)) { this.toggleQuick(); return; }
    for (const s of L.slots) {
      if (!inside(x, y, s.x, L.y, L.iw, TB)) continue;
      if (b === 2) { this.menu = { type: 'context', x: s.x, y: L.y - 6 - 2 * 32 - 12, w: 200, h: 12 + 2 * 32, items: [{ label: 'Task Manager', act: () => this.open('taskmgr') }, { label: 'Taskbar settings', act: () => this.open('settings', { page: 'personal' }) }] }; return; }
      if (s.kind === 'start') { this.toggleStart(); return; }
      if (s.kind === 'search') { this.toggleStart(true); return; }
      if (s.kind === 'taskview') { for (const w of this.windows) w.min = false; this.dirty = true; return; }
      const wins = s.it.wins;
      if (wins?.length) {
        const w = wins.at(-1);
        if (this.focus === w && !w.min) { w.min = true; this.focus = null; } else { w.min = false; this.raise(w); }
      } else this.launch(s.it);
      this.menu = null;
      return;
    }
    if (b === 2) this.menu = { type: 'context', x, y: L.y - 6 - 32 - 12, w: 200, h: 12 + 32, items: [{ label: 'Task Manager', act: () => this.open('taskmgr') }] };
    else this.menu = null;
  }

  toggleStart(search) {
    if (this.menu?.type === 'start') { this.menu = null; return; }
    const d = this.displays[0];
    const w = 640, h = 690;
    const x = this.theme.align === 'left' ? 12 : Math.round(d.w / 2 - w / 2);
    this.menu = { type: 'start', x, y: d.h - TB - h - 12, w, h, query: '', all: false, search };
  }

  toggleQuick() {
    if (this.menu?.type === 'quick') { this.menu = null; return; }
    const d = this.displays[0];
    this.menu = { type: 'quick', x: d.w - 372, y: d.h - TB - 420 - 12, w: 360, h: 420 };
  }

  clickMenu(x, y, b) {
    const m = this.menu;
    if (!inside(x, y, m.x, m.y, m.w, m.h)) {
      this.menu = null;
      // clicking the start button again just closes the menu
      const d0 = this.displays[0];
      if (m.type === 'start' && y >= d0.h - TB) { const L = this.taskbarLayout(); if (inside(x, y, L.slots[0].x, L.y, L.iw, TB)) return true; }
      return false;
    }
    if (m.type === 'context' || m.type === 'powermenu') {
      const k = Math.floor((y - m.y - 6) / 32);
      const it = m.items[k];
      if (it && !it.disabled) { this.menu = null; it.act(); }
      return true;
    }
    if (m.type === 'start') {
      if (m.allBtn && inside(x, y, m.allBtn.x, m.allBtn.y, m.allBtn.w, m.allBtn.h)) { m.all = !m.all; m.scroll = 0; return true; }
      if (m.powerBtn && inside(x, y, m.powerBtn.x, m.powerBtn.y, m.powerBtn.w, m.powerBtn.h)) {
        this.menu = { type: 'powermenu', x: m.powerBtn.x - 120, y: m.powerBtn.y - 112, w: 160, h: 12 + 3 * 32, items: [
          { label: 'Sleep', act: () => this.sleep() }, { label: 'Shut down', act: () => this.shutdown(false) }, { label: 'Restart', act: () => this.shutdown(true) }] };
        return true;
      }
      const c = (m.cells || []).find(c2 => inside(x, y, c2.x, c2.y, c2.w, c2.h));
      if (c?.it) this.launch(c.it);
      else if (c?.file) { this.menu = null; this.open('notepad', { path: c.file.path }); }
      return true;
    }
    if (m.type === 'quick') {
      const c = (m.nets || []).find(c2 => inside(x, y, c2.x, c2.y, c2.w, c2.h));
      const r = this.g.router;
      if (c) {
        if (c.n.ours) { if (r.pcKnowsWifi) { r.lan = r.lan; this.notify('Wi-Fi', `Connected to ${r.ssid}`); } else { m.pass = ''; m.passErr = ''; } }
        else { m.pass = undefined; this.notify('Wi-Fi', `Can't connect to ${c.n.ssid}. You don't know that password.`); }
      }
      return true;
    }
    return true;
  }

  wheel(steps) {
    if (this.state !== 'desktop') return;
    const { x, y } = this.cursor;
    if (this.menu?.type === 'start' && (this.menu.all || this.menu.query)) { this.menu.scroll = Math.max(0, (this.menu.scroll || 0) + Math.sign(steps) * 2); this.dirty = true; return; }
    const w = this.hitWindow(x, y);
    if (w && y > w.y + TITLE) { w.app.wheel?.(steps, x - w.x, y - w.y - TITLE); this.dirty = true; }
  }

  key(e, down) {
    if (!down) { if (this.focus?.app.keyUp) this.focus.app.keyUp(e); return; }
    const st = this.state;
    if (st === 'sleep') { this.go('lock'); return; }
    if (st === 'lock') { this.go('login'); return; }
    if (st === 'login') { if (e.code === 'Enter' || e.code === 'Space') this.go('welcome'); return; }
    if (st !== 'desktop') return;
    this.dirty = true;
    const m = this.menu;
    // typing a Wi-Fi password
    if (m?.type === 'quick' && m.pass !== undefined) {
      if (e.code === 'Enter') { if (m.pass === this.g.router.password) { this.g.router.pcKnowsWifi = true; this.notify('Wi-Fi', `Connected to ${this.g.router.ssid}`); this.menu = null; } else m.passErr = 'The network security key isn\'t correct. Look at the sticker on the router.'; }
      else if (e.code === 'Backspace') m.pass = m.pass.slice(0, -1);
      else if (e.code === 'Escape') m.pass = undefined;
      else if (e.key.length === 1) m.pass += e.key;
      return;
    }
    if (m?.type === 'start') {
      if (e.code === 'Escape' || e.code === 'MetaLeft' || e.code === 'MetaRight') { this.menu = null; return; }
      if (e.code === 'Enter') { let list = this.startItems(); if (m.query) list = list.filter(a => a.name.toLowerCase().includes(m.query.toLowerCase())); if (list[0]) this.launch(list[0]); return; }
      if (e.code === 'Backspace') { m.query = m.query.slice(0, -1); return; }
      if (e.key.length === 1 && !e.ctrlKey) { m.query += e.key; return; }
    }
    if (e.code === 'MetaLeft' || e.code === 'MetaRight') { this.toggleStart(); return; }
    if (e.code === 'Escape' && m) { this.menu = null; return; }
    if (e.ctrlKey && e.shiftKey && e.code === 'Escape') { this.open('taskmgr'); return; }
    if (e.altKey && e.code === 'F4') { if (this.focus) this.close(this.focus); else this.shutdown(false); return; }
    if (e.altKey && e.code === 'Tab') { const vis = this.windows.filter(w => !w.min); if (vis.length > 1) this.raise(vis[0]); return; }
    if (e.metaKey && e.code === 'KeyE') { this.open('explorer'); return; }
    if (e.metaKey && e.code === 'KeyR') { this.open('terminal'); return; }
    if (e.metaKey && e.code === 'KeyD') { for (const w of this.windows) w.min = true; this.focus = null; return; }
    if (this.focus && !this.focus.min) this.focus.app.key?.(e);
  }

  updateCursorImage() {
    const c = this.cursor;
    let kind = 'arrow';
    if (this.state === 'desktop') {
      const w = this.hitWindow(c.x, c.y);
      if (w && c.y > w.y + TITLE) kind = w.app.cursor?.(c.x - w.x, c.y - w.y - TITLE) || 'arrow';
      if (this.drag?.mode === 'size') kind = 'arrow';
    } else if (this.state === 'boot' || this.state === 'welcome') kind = 'busy';
    const visible = !['off', 'sleep', 'post', 'bsod', 'shutting'].includes(this.state) && !(this.state === 'boot') && !(this.capture && this.windows.includes(this.capture));
    if (kind !== this._kind) { this._kind = kind; this.g.pcCursorKind?.(kind); }
    const [hx, hy] = this.hot || [1, 1]; // the image's click point (middle for the crosshair)
    for (const d of this.displays) {
      const on = visible && inside(c.x, c.y, d.x, d.y, d.w, d.h);
      d.mon.setCursor(c.x - d.x - hx, c.y - d.y - hy, on);
    }
  }
}

function drawSpeaker(g, x, y) {
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(x - 6, y - 3); g.lineTo(x - 3, y - 3); g.lineTo(x + 1, y - 7); g.lineTo(x + 1, y + 7); g.lineTo(x - 3, y + 3); g.lineTo(x - 6, y + 3); g.closePath(); g.fill();
  for (const r of [4, 7]) { g.beginPath(); g.arc(x + 2, y, r, -0.8, 0.8); g.stroke(); }
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
export function colorFor(s = '') { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return COLORS[Math.abs(h) % COLORS.length]; }

function defaultPins() {
  return [
    { name: 'File Explorer', app: 'explorer' }, { name: 'Browser', app: 'browser' }, { name: 'Steam', app: 'library' },
    { name: 'Notepad', app: 'notepad' }, { name: 'Terminal', app: 'terminal' },
  ];
}
function defaultDesktop() {
  return [
    { name: 'This PC', app: 'explorer', path: 'pc' }, { name: 'Recycle Bin', app: 'explorer', path: 'bin', kind: 'bin' },
    { name: 'Steam', app: 'library' }, { name: 'Browser', app: 'browser' }, { name: 'DUSTLINE', app: 'dustline' },
    { name: 'SKIRMISH', app: 'skirmish' }, { name: 'Mines', app: 'mines' }, { name: 'Scan my real PC', app: 'scanhelp' },
  ];
}
function defaultStart() {
  return [
    { name: 'Browser', app: 'browser' }, { name: 'File Explorer', app: 'explorer' }, { name: 'Settings', app: 'settings' },
    { name: 'Notepad', app: 'notepad' }, { name: 'Calculator', app: 'calc' }, { name: 'Terminal', app: 'terminal' },
    { name: 'Task Manager', app: 'taskmgr' }, { name: 'Steam', app: 'library' }, { name: 'Paint', app: 'paint' },
    { name: 'DUSTLINE', app: 'dustline' }, { name: 'SKIRMISH', app: 'skirmish' }, { name: 'Mines', app: 'mines' },
    { name: 'Scan my real PC', app: 'scanhelp' },
  ];
}
function defaultFiles() {
  const now = Date.now();
  return {
    'Documents/todo.txt': { type: 'file', name: 'todo.txt', path: 'Documents/todo.txt', app: 'notepad', content: 'clean the desk\nbuy a new graphics card (lol)\nreset the router if the internet dies again\n', edited: now - 86400000 },
  };
}
