// The fake Windows 11: their wallpaper, their desktop icons, their pinned apps, Start, clock, calendar,
// quick settings, right-click menus and app windows. Looks real, but none of it touches their real PC.
import { el, esc, canvas, clamp, DPR, loadImage } from './util.js';
import { ico } from './icons.js';
import { audio } from './audio.js';

const CELL_W = 76, CELL_H = 86;

export class Desktop {
  constructor(look, game) {
    this.look = look; this.game = game; this.wins = []; this.z = 10; this.sel = new Set();
    this.wall = document.getElementById('wall'); this.wctx = this.wall.getContext('2d');
    this.desk = document.getElementById('desk'); this.tb = document.getElementById('taskbar');
    this.start = document.getElementById('startmenu'); this.cal = document.getElementById('calendar'); this.quick = document.getElementById('quick');
    this.ctx = document.getElementById('ctxmenu'); this.winLayer = document.getElementById('windows');
    this.winLayer.style.zIndex = 10;
    this.volume = 62;
  }
  async build() {
    const L = this.look;
    document.documentElement.classList.toggle('light', !!L.light);
    if (L.accentRaw) document.documentElement.style.setProperty('--accent', L.light ? L.accentRaw : lighten(L.accentRaw));
    this.wallImg = L.wallpaper ? await loadImage(L.wallpaper) : null;
    if (!this.wallImg) this.wallImg = await defaultWallpaper();
    this.paintWall();
    this.buildIcons(); this.buildTaskbar(); this.buildStart(); this.bindDesk();
    this.tick(); clearInterval(this.clockT); this.clockT = setInterval(() => this.tick(), 1000);
  }
  // ---------- wallpaper (a canvas so it can be torn, burned and blown open) ----------
  paintWall() {
    const d = DPR(), W = innerWidth, H = innerHeight; this.wall.width = W * d; this.wall.height = H * d;
    const x = this.wctx; x.setTransform(d, 0, 0, d, 0, 0); x.globalCompositeOperation = 'source-over';
    x.fillStyle = this.look.wallColor || '#000'; x.fillRect(0, 0, W, H);
    const im = this.wallImg; if (!im) return;
    const st = this.look.wallpaperStyle, iw = im.width, ih = im.height;
    if (st === 'tile') { for (let yy = 0; yy < H; yy += ih) for (let xx = 0; xx < W; xx += iw) x.drawImage(im, xx, yy); return; }
    if (st === 'center') { x.drawImage(im, (W - iw) / 2, (H - ih) / 2); return; }
    if (st === 'stretch') { x.drawImage(im, 0, 0, W, H); return; }
    const s = st === 'fit' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
    x.drawImage(im, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  }
  // cut a hole in the wallpaper and give back the torn piece as a texture
  tearWall(poly, keep = true) {
    const d = DPR(); let tex = null, bb = null;
    if (keep) {
      bb = bounds(poly); tex = canvas(bb.w * d, bb.h * d); const t = tex.getContext('2d');
      t.scale(d, d); t.translate(-bb.x0, -bb.y0); t.beginPath(); poly.forEach((p, i) => i ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1])); t.closePath(); t.clip();
      t.drawImage(this.wall, 0, 0, this.wall.width, this.wall.height, 0, 0, innerWidth, innerHeight);
    }
    const x = this.wctx; x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath();
    poly.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill(); x.restore();
    // a thin torn-paper edge
    x.save(); x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 2.5; x.beginPath();
    poly.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); x.restore();
    return { tex, bb };
  }
  burnWall(px, py, r, amt = 1) { // burn marks + burn holes on the wallpaper
    const x = this.wctx; x.save(); x.globalCompositeOperation = 'source-atop';
    const g = x.createRadialGradient(px, py, 0, px, py, r * 1.6); g.addColorStop(0, `rgba(20,10,5,${0.55 * amt})`); g.addColorStop(1, 'rgba(20,10,5,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r * 1.6, 0, 7); x.fill(); x.restore();
    if (amt > 0.6) { x.save(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(px, py, r * 0.55 * amt, 0, 7); x.fill(); x.restore(); }
  }
  scorchLine(x1, y1, x2, y2, w = 5) {
    const x = this.wctx; x.save(); x.globalCompositeOperation = 'source-atop'; x.lineCap = 'round';
    x.strokeStyle = 'rgba(25,12,6,0.75)'; x.lineWidth = w * 2.2; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
    x.strokeStyle = 'rgba(255,120,30,0.5)'; x.lineWidth = w * 0.6; x.stroke(); x.restore();
  }
  wallAlphaAt(px, py) { try { const d = DPR(); return this.wctx.getImageData(px * d | 0, py * d | 0, 1, 1).data[3]; } catch (e) { return 0; } }
  // ---------- desktop icons ----------
  buildIcons() {
    this.desk.innerHTML = '';
    const items = [{ name: 'Recycle Bin', icon: this.look.recycle || null, recycle: true }, ...this.look.desktop];
    const rows = Math.max(1, Math.floor((innerHeight - 48 - 4) / CELL_H));
    items.forEach((it, i) => {
      const d = el('div', 'dicon'); d.dataset.rip = 'icon';
      d.style.left = (2 + Math.floor(i / rows) * CELL_W) + 'px'; d.style.top = (4 + (i % rows) * CELL_H) + 'px';
      d.innerHTML = (it.icon ? `<img src="${it.icon}">` : `<div class="gen">${esc((it.name || '?')[0].toUpperCase())}</div>`) + `<div class="lbl">${esc(it.name)}</div>`;
      d._app = it;
      d.addEventListener('pointerdown', (e) => {
        if (e.button === 2) return;
        if (!e.ctrlKey) this.clearSel(); this.sel.add(d); d.classList.add('sel');
      });
      d.addEventListener('dblclick', () => { this.openApp(it); });
      d.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); if (!this.sel.has(d)) { this.clearSel(); this.sel.add(d); d.classList.add('sel'); } this.iconMenu(e.clientX, e.clientY, d); });
      this.desk.appendChild(d);
    });
  }
  clearSel() { for (const d of this.sel) d.classList.remove('sel'); this.sel.clear(); }
  bindDesk() {
    const box = document.getElementById('select-box');
    this.desk.onpointerdown = (e) => {
      if (e.target !== this.desk || e.button !== 0) return;
      this.closeFlyouts(); this.clearSel();
      const sx = e.clientX, sy = e.clientY; let moved = false, held = false;
      const holdT = setTimeout(() => { if (!moved) { held = true; this.game.onWallHold(sx, sy, e.pointerId); } }, 380);
      const mv = (ev) => {
        if (held) return;
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { moved = true; clearTimeout(holdT); }
        if (!moved) return;
        const x0 = Math.min(sx, ev.clientX), y0 = Math.min(sy, ev.clientY), w = Math.abs(ev.clientX - sx), h = Math.abs(ev.clientY - sy);
        Object.assign(box.style, { display: 'block', left: x0 + 'px', top: y0 + 'px', width: w + 'px', height: h + 'px' });
        for (const d of this.desk.children) {
          const r = d.getBoundingClientRect(); const hit = r.right > x0 && r.left < x0 + w && r.bottom > y0 && r.top < y0 + h;
          d.classList.toggle('sel', hit); if (hit) this.sel.add(d); else this.sel.delete(d);
        }
      };
      const up = () => { clearTimeout(holdT); box.style.display = 'none'; removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    };
    this.desk.oncontextmenu = (e) => { if (e.target !== this.desk) return; e.preventDefault(); this.closeFlyouts(); this.deskMenu(e.clientX, e.clientY); };
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#ctxmenu')) this.hideMenu();
      if (!e.target.closest('.flyout') && !e.target.closest('#taskbar') && !e.target.closest('.powermenu')) this.closeFlyouts();
    }, true);
  }
  // ---------- taskbar ----------
  buildTaskbar() {
    const L = this.look, tb = this.tb;
    tb.classList.toggle('left', L.taskbarAlign === 'left');
    const c = tb.querySelector('.tb-center'); c.innerHTML = '';
    const startB = el('div', 'tbtn tb-start', '<div class="winlogo"><i></i><i></i><i></i><i></i></div>'); startB.dataset.rip = 'tbtn';
    startB.onclick = () => this.toggleStart(); c.appendChild(startB);
    if (L.searchMode === 2 || L.searchMode === 3) { const s = el('div', 'tsearch', ico('search', 16) + '<span class="ph">Search</span>'); s.dataset.rip = 'tbtn'; s.onclick = () => this.toggleStart(true); c.appendChild(s); }
    else if (L.searchMode === 1) { const s = el('div', 'tbtn', ico('search', 20)); s.dataset.rip = 'tbtn'; s.onclick = () => this.toggleStart(true); c.appendChild(s); }
    if (L.taskView) { const t = el('div', 'tbtn', '<div class="taskview"><i></i><i></i></div>'); t.dataset.rip = 'tbtn'; t.onclick = () => this.showDesktop(); c.appendChild(t); }
    this.pinBtns = new Map();
    const pins = L.pinned.length ? L.pinned : defaultPins();
    for (const p of pins) this.addTaskBtn(p, true);
    // tray
    const r = tb.querySelector('.tb-right'); r.innerHTML = '';
    const chev = el('div', 'tray-btn tray-chev', ico('chevup', 16)); chev.dataset.rip = 'tray'; r.appendChild(chev);
    this.micInd = el('div', 'tray-btn mic-ind', ico('mic', 16) + '<div class="mic-lvl"></div>'); this.micInd.dataset.rip = 'mic'; this.micInd.style.display = 'none'; r.appendChild(this.micInd);
    this.micInd.onclick = () => this.game.hud && this.game.hud.toggleMicPower();
    const sys = el('div', 'tray-btn tray-sys', ico(L.network === 'wifi' ? 'wifi' : 'ethernet', 16) + ico('volume', 16)); sys.dataset.rip = 'tray';
    sys.onclick = () => this.toggleQuick(); r.appendChild(sys);
    this.clockEl = el('div', 'tray-btn tray-clock', '<div class="tm"></div><div class="dt"></div>'); this.clockEl.dataset.rip = 'clock';
    this.clockEl.onclick = () => this.toggleCal(); this.clockEl.ondblclick = () => this.game.armClockBomb && this.game.armClockBomb(this.clockEl);
    r.appendChild(this.clockEl);
    const bell = el('div', 'tray-btn tray-bell', ico('bell', 16)); bell.dataset.rip = 'tray'; bell.onclick = () => this.toggleCal(); r.appendChild(bell);
    const sd = el('div', 'show-desk'); sd.onclick = () => this.showDesktop(); r.appendChild(sd);
  }
  addTaskBtn(app, pinned) {
    const c = this.tb.querySelector('.tb-center');
    const b = el('div', 'tbtn', (app.icon ? `<img src="${app.icon}">` : `<div class="gen" style="width:24px;height:24px;border-radius:4px;background:#444;color:#fff;font:600 12px var(--font);display:flex;align-items:center;justify-content:center">${esc((app.name || '?')[0])}</div>`) + '<div class="run" style="display:none"></div>');
    b.dataset.rip = 'tbtn'; b.title = app.name; b._app = app; b._pinned = pinned;
    b.onclick = () => {
      const w = this.wins.find(w => w.app.name === app.name && !w.closed);
      if (!w) return this.openApp(app);
      if (w.min) this.unminimize(w); else if (w.el.style.zIndex == this.z) this.minimize(w); else this.focus(w);
    };
    c.appendChild(b); this.pinBtns.set(app.name, b); return b;
  }
  tick() {
    if (!this.clockEl || this.clockEl.classList.contains('ripped')) return;
    const n = new Date();
    this.clockEl.querySelector('.tm').textContent = n.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    this.clockEl.querySelector('.dt').textContent = n.toLocaleDateString();
    if (this.clockEl._bomb !== undefined) this.clockEl.querySelector('.tm').textContent = '0:' + String(Math.max(0, this.clockEl._bomb)).padStart(2, '0');
  }
  setMic(on, level = 0) {
    if (!this.micInd || this.micInd.classList.contains('ripped')) return;
    this.micInd.style.display = on ? 'flex' : 'none';
    this.micInd.querySelector('.mic-lvl').style.transform = `scaleX(${clamp(level, 0, 1)})`;
  }
  // ---------- Start menu ----------
  buildStart() {
    const L = this.look, s = this.start; s.classList.toggle('left', L.taskbarAlign === 'left');
    const apps = L.start.length ? L.start : defaultPins();
    const pinned = pickPinned(L, apps);
    s.innerHTML = `<div class="sm-search">${ico('search', 16)}<input placeholder="Search for apps, settings, and documents"></div>
      <div class="sm-head"><span>Pinned</span><span class="sm-all">All ${ico('chevright', 12)}</span></div>
      <div class="sm-grid"></div>
      <div class="sm-head"><span>Recommended</span><span class="sm-all">More ${ico('chevright', 12)}</span></div>
      <div class="sm-rec"></div>
      <div class="sm-allapps" style="display:none"></div>
      <div class="sm-foot"><div class="sm-user"><div class="sm-avatar">${ico('person', 18)}</div><span>${esc(L.user)}</span></div><div class="sm-power">${ico('power', 16)}</div></div>`;
    const g = s.querySelector('.sm-grid');
    for (const a of pinned.slice(0, 18)) {
      const d = el('div', 'sm-app', (a.icon ? `<img src="${a.icon}">` : `<div style="width:32px;height:32px;border-radius:6px;background:#3a3a3a"></div>`) + `<span>${esc(a.name)}</span>`);
      d.onclick = () => { this.closeFlyouts(); this.openApp(a); }; g.appendChild(d);
    }
    const rec = s.querySelector('.sm-rec');
    const recs = L.desktop.filter(d => !/\.lnk$/i.test(d.name)).slice(0, 6);
    const ago = ['Recently added', '2h ago', 'Yesterday at 9:41 PM', 'Monday', 'Nov 20', 'Nov 18'];
    recs.forEach((a, i) => { const d = el('div', 'it', (a.icon ? `<img src="${a.icon}">` : '') + `<div><b>${esc(a.name)}</b><small>${ago[i]}</small></div>`); d.onclick = () => { this.closeFlyouts(); this.openApp(a); }; rec.appendChild(d); });
    // "All" apps list
    const all = s.querySelector('.sm-allapps'); let letter = '';
    for (const a of apps) {
      const l = (a.name[0] || '#').toUpperCase(); if (l !== letter) { letter = l; all.appendChild(el('div', 'letter', esc(/[A-Z]/.test(l) ? l : '#'))); }
      const r = el('div', 'row', (a.icon ? `<img src="${a.icon}">` : '<span style="width:24px"></span>') + esc(a.name)); r.onclick = () => { this.closeFlyouts(); this.openApp(a); }; all.appendChild(r);
    }
    const [allBtn] = s.querySelectorAll('.sm-all');
    allBtn.onclick = () => { const on = all.style.display === 'none'; all.style.display = on ? 'block' : 'none'; g.style.display = on ? 'none' : 'grid'; rec.style.display = on ? 'none' : 'grid'; s.querySelectorAll('.sm-head')[1].style.display = on ? 'none' : 'flex'; allBtn.innerHTML = on ? ico('chevright', 12, 'transform:rotate(180deg)') + ' Back' : 'All ' + ico('chevright', 12); };
    const inp = s.querySelector('input');
    inp.oninput = () => { const q = inp.value.toLowerCase(); if (!q) { allBtn.onclick(); allBtn.onclick(); return; } all.style.display = 'block'; g.style.display = 'none'; rec.style.display = 'none'; for (const r of all.children) r.style.display = r.classList.contains('letter') ? 'none' : (r.textContent.toLowerCase().includes(q) ? 'flex' : 'none'); };
    s.querySelector('.sm-power').onclick = (e) => this.powerMenu(e.currentTarget);
    s.dataset.rip = 'start';
  }
  toggleStart(search) {
    const open = !this.start.classList.contains('open'); this.closeFlyouts();
    if (open) { this.start.classList.add('open'); this.start.style.display = 'flex'; if (search) setTimeout(() => this.start.querySelector('input').focus(), 50); }
  }
  powerMenu(anchor) {
    document.querySelectorAll('.powermenu').forEach(m => m.remove());
    const r = anchor.getBoundingClientRect();
    const m = el('div', 'powermenu', `<div data-a="lock">${ico('lock', 16)} Lock</div><div data-a="sleep">${ico('sleep', 16)} Sleep</div><div data-a="shutdown">${ico('power', 16)} Shut down</div><div data-a="restart">${ico('restart', 16)} Restart</div>`);
    document.body.appendChild(m); m.style.left = (r.left - 60) + 'px'; m.style.top = (r.top - m.offsetHeight - 6) + 'px';
    m.onclick = (e) => { const a = e.target.closest('[data-a]')?.dataset.a; m.remove(); this.closeFlyouts(); if (a) this.game.power(a); };
  }
  // ---------- calendar + quick settings ----------
  toggleCal() {
    const open = !this.cal.classList.contains('open'); this.closeFlyouts(); if (!open) return;
    const n = new Date(), y = n.getFullYear(), mo = n.getMonth();
    const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate(), prevDays = new Date(y, mo, 0).getDate();
    let cells = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => `<span class="dow">${d}</span>`).join('');
    for (let i = 0; i < 42; i++) {
      const dn = i - first + 1;
      if (dn < 1) cells += `<span class="dim">${prevDays + dn}</span>`; else if (dn > days) cells += `<span class="dim">${dn - days}</span>`;
      else cells += `<span class="${dn === n.getDate() ? 'today' : ''}">${dn}</span>`;
    }
    this.cal.innerHTML = `<div class="cal-head">${n.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}<span>${ico('chevup', 12)}</span></div>
      <div class="cal-month">${n.toLocaleDateString([], { month: 'long', year: 'numeric' })}<span>${ico('up', 14)} &nbsp; ${ico('up', 14, 'transform:rotate(180deg)')}</span></div><div class="cal-grid">${cells}</div>`;
    this.cal.classList.add('open'); this.cal.dataset.rip = 'fly';
  }
  toggleQuick() {
    const open = !this.quick.classList.contains('open'); this.closeFlyouts(); if (!open) return;
    const net = this.look.network === 'wifi';
    const tiles = [[net ? 'wifi' : 'ethernet', net ? 'Wi-Fi' : 'Network', true], ['bt', 'Bluetooth', true], ['airplane', 'Airplane mode', false], ['sun', 'Night light', false], ['access', 'Accessibility', false], ['moon', 'Focus', false]];
    this.quick.innerHTML = `<div class="q-tiles">${tiles.map(t => `<div class="q-tile ${t[2] ? 'on' : ''}"><div class="b">${ico(t[0], 16)}</div>${t[1]}</div>`).join('')}</div>
      <div class="q-slider">${ico('volume', 16)}<div class="track"><div class="fill" style="width:${this.volume}%"></div><div class="knob" style="left:${this.volume}%"></div></div></div>
      <div class="q-foot">${ico('settings', 16)}<span style="margin-left:auto">${ico('settings', 16)}</span></div>`;
    this.quick.querySelectorAll('.q-tile').forEach(t => t.onclick = () => t.classList.toggle('on'));
    const tr = this.quick.querySelector('.track');
    const setV = (e) => { const r = tr.getBoundingClientRect(); this.volume = Math.round(clamp((e.clientX - r.left) / r.width, 0, 1) * 100); tr.querySelector('.fill').style.width = this.volume + '%'; tr.querySelector('.knob').style.left = this.volume + '%'; audio.setVolume(this.volume / 78); };
    tr.parentElement.onpointerdown = (e) => { setV(e); const mv = (ev) => setV(ev); addEventListener('pointermove', mv); addEventListener('pointerup', () => removeEventListener('pointermove', mv), { once: true }); };
    this.quick.classList.add('open'); this.quick.dataset.rip = 'fly';
  }
  closeFlyouts() { for (const f of [this.start, this.cal, this.quick]) { f.classList.remove('open'); if (f === this.start) f.style.display = ''; } document.querySelectorAll('.powermenu').forEach(m => m.remove()); }
  // ---------- right-click menus ----------
  showMenu(x, y, rows) {
    const m = this.ctx; m.innerHTML = '';
    for (const r of rows) {
      if (r === '-') { m.appendChild(el('div', 'sep')); continue; }
      const d = el('div', 'row', (r.icon ? ico(r.icon, 16) : '<span style="width:16px"></span>') + `<span>${esc(r.t)}</span>` + (r.k ? `<span class="k">${esc(r.k)}</span>` : ''));
      d.onclick = () => { this.hideMenu(); r.fn && r.fn(); }; m.appendChild(d);
    }
    m.classList.add('open'); m.style.left = Math.min(x, innerWidth - m.offsetWidth - 4) + 'px'; m.style.top = Math.min(y, innerHeight - m.offsetHeight - 4) + 'px';
  }
  hideMenu() { this.ctx.classList.remove('open'); }
  deskMenu(x, y) {
    this.showMenu(x, y, [
      { t: 'View', icon: 'view', k: '›' }, { t: 'Sort by', icon: 'sort', k: '›' }, { t: 'Refresh', icon: 'refresh', fn: () => this.refreshIcons() }, '-',
      { t: 'New', icon: 'add', k: '›', fn: () => this.openApp({ name: 'Notepad', notepad: true }) }, '-',
      { t: 'Display settings', icon: 'desktop', fn: () => this.openApp({ name: 'Settings', settings: true }) },
      { t: 'Personalize', icon: 'settings', fn: () => this.openApp({ name: 'Settings', settings: true }) }, '-',
      { t: 'Open in Terminal', icon: 'more', fn: () => this.openApp({ name: 'Terminal', terminal: true }) },
      { t: 'Show more options', icon: 'more' },
    ]);
  }
  iconMenu(x, y, d) {
    const it = d._app;
    this.showMenu(x, y, [
      { t: 'Open', icon: 'folder', k: 'Enter', fn: () => this.openApp(it) }, '-',
      { t: 'Cut', icon: 'cut' }, { t: 'Copy', icon: 'copy' }, { t: 'Rename', icon: 'rename' }, { t: 'Share', icon: 'share' },
      { t: 'Delete', icon: 'del', k: 'Del', fn: () => { if (!it.recycle) { d.remove(); audio.win('recycle', 0.7); } } }, '-',
      { t: 'Properties', icon: 'settings', k: 'Alt+Enter', fn: () => this.openApp({ ...it, name: it.name + ' Properties', props: true }) },
    ]);
  }
  refreshIcons() { this.desk.style.opacity = 0; setTimeout(() => this.desk.style.opacity = 1, 120); }
  // ---------- app windows ----------
  appKind(a) {
    const n = (a.name || '').toLowerCase();
    if (a.notepad || /notepad/.test(n)) return 'notepad';
    if (a.recycle || /file explorer|^explorer|this pc|documents|downloads|pictures|^music|^videos/.test(n) || a.folder) return 'explorer';
    return 'app';
  }
  openApp(a) {
    this.closeFlyouts();
    const kind = this.appKind(a);
    const W = innerWidth, H = innerHeight - 48;
    const w = Math.min(kind === 'notepad' ? 900 : 1100, W - 80), h = Math.min(kind === 'notepad' ? 560 : 680, H - 60);
    const n = this.wins.filter(q => !q.closed).length;
    const x = Math.round((W - w) / 2 + (n % 6) * 26 - 60), y = Math.round((H - h) / 2 + (n % 6) * 26 - 40);
    const e = el('div', 'fwin opening'); e.dataset.rip = 'win';
    const icon = a.icon || (a.recycle ? this.look.recycle : null) || explorerIcon(this.look);
    e.innerHTML = `<div class="title">${icon ? `<img src="${icon}">` : '<span style="width:38px"></span>'}<span class="t">${esc(a.recycle ? 'Recycle Bin' : a.name)}</span>
      <div class="cap m">${ico('min', 10)}</div><div class="cap M">${ico('max', 10)}</div><div class="cap x">${ico('close', 10)}</div></div><div class="body"></div>`;
    Object.assign(e.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', zIndex: ++this.z });
    const body = e.querySelector('.body');
    if (kind === 'explorer') body.appendChild(this.explorer(a));
    else if (kind === 'notepad') body.innerHTML = `<div class="notepad"><div class="menu"><span>File</span><span>Edit</span><span>View</span></div><textarea spellcheck="false"></textarea><div class="st"><span>Ln 1, Col 1</span><span>100%</span><span>Windows (CRLF)</span><span>UTF-8</span></div></div>`;
    else body.innerHTML = `<div class="splash">${icon ? `<img src="${icon}">` : ''}<div class="spin"></div></div>`;
    this.winLayer.appendChild(e);
    const win = { el: e, app: a, x, y, w, h, max: false, min: false, closed: false };
    this.wins.push(win);
    if (kind === 'app') win.nrT = setTimeout(() => { if (!win.closed) e.classList.add('notresp'); }, 7000 + Math.random() * 5000);
    setTimeout(() => e.classList.remove('opening'), 250);
    // taskbar button
    let tbtn = this.pinBtns.get(a.name);
    if (!tbtn || tbtn.classList.contains('ripped')) { tbtn = this.addTaskBtn({ name: a.name, icon }, false); }
    win.tbtn = tbtn; tbtn.querySelector('.run').style.display = 'block';
    this.focus(win);
    // window controls
    const title = e.querySelector('.title');
    e.querySelector('.cap.x').onclick = () => this.closeWin(win);
    e.querySelector('.cap.m').onclick = () => this.minimize(win);
    e.querySelector('.cap.M').onclick = () => this.toggleMax(win);
    title.ondblclick = (ev) => { if (!ev.target.closest('.cap')) this.toggleMax(win); };
    e.addEventListener('pointerdown', () => this.focus(win));
    title.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.cap') || ev.button !== 0) return;
      const sx = ev.clientX, sy = ev.clientY, ox = win.x, oy = win.y; let last = [sx, sy, performance.now()], speed = 0;
      const mv = (m) => {
        if (win.max && Math.hypot(m.clientX - sx, m.clientY - sy) > 8) { this.toggleMax(win); win.x = m.clientX - win.w / 2; }
        if (!win.max) { win.x = ox + m.clientX - sx; win.y = Math.max(0, oy + m.clientY - sy); e.style.left = win.x + 'px'; e.style.top = win.y + 'px'; }
        const t = performance.now(), dt = Math.max(1, t - last[2]); const v = Math.hypot(m.clientX - last[0], m.clientY - last[1]) / dt * 1000; speed = speed * 0.6 + v * 0.4; last = [m.clientX, m.clientY, t];
        if (speed > 3600 && this.game.yankWindow) { up(); this.game.yankWindow(win, m); }
      };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
    audio.play('pop_click', { vol: 0.15, rate: 1.4 });
    return win;
  }
  explorer(a) {
    const isBin = !!a.recycle;
    const files = isBin ? [] : this.look.desktop;
    const w = el('div', 'exp');
    w.innerHTML = `<div class="exp-bar"><div class="nb">${ico('back', 16)}</div><div class="nb">${ico('fwd', 16)}</div><div class="nb">${ico('up', 16)}</div><div class="nb">${ico('refresh', 16)}</div>
      <div class="exp-addr">${ico(isBin ? 'del' : 'desktop', 16)} ${ico('chevright', 10)} ${esc(isBin ? 'Recycle Bin' : 'Desktop')}</div><div class="exp-srch">Search ${esc(isBin ? 'Recycle Bin' : 'Desktop')} ${ico('search', 14)}</div></div>
      <div class="exp-main"><div class="exp-side"><div>${ico('home', 16)} Home</div><div>${ico('pictures', 16)} Gallery</div><div style="height:14px"></div><div>${ico('desktop', 16)} Desktop</div><div>${ico('download', 16)} Downloads</div><div>${ico('doc', 16)} Documents</div><div>${ico('pictures', 16)} Pictures</div><div>${ico('music', 16)} Music</div><div>${ico('video', 16)} Videos</div></div>
      <div class="exp-files">${files.map(f => `<div class="f">${f.icon ? `<img src="${f.icon}">` : ''}<span>${esc(f.name)}</span></div>`).join('') || `<div style="grid-column:1/-1;padding:30px;color:var(--text2);font-size:13px">${isBin ? 'This folder is empty.' : ''}</div>`}</div></div>
      <div class="exp-status">${files.length} items</div>`;
    return w;
  }
  focus(w) { if (w.closed) return; w.el.style.zIndex = ++this.z; for (const q of this.wins) if (q.tbtn) q.tbtn.classList.toggle('active', q === w && !q.min); }
  toggleMax(w) {
    w.max = !w.max; const e = w.el; e.classList.toggle('max', w.max);
    if (w.max) Object.assign(e.style, { left: '0px', top: '0px', width: innerWidth + 'px', height: (innerHeight - 48) + 'px' });
    else Object.assign(e.style, { left: w.x + 'px', top: w.y + 'px', width: w.w + 'px', height: w.h + 'px' });
    e.querySelector('.cap.M').innerHTML = ico(w.max ? 'restore' : 'max', 10);
  }
  minimize(w) {
    const e = w.el, b = w.tbtn?.getBoundingClientRect(); w.min = true;
    if (b) { const r = e.getBoundingClientRect(); e.style.transformOrigin = `${b.left + b.width / 2 - r.left}px ${b.top - r.top}px`; }
    e.classList.add('minimizing'); e.style.transform = 'scale(0.1)'; e.style.pointerEvents = 'none';
    if (w.tbtn) w.tbtn.classList.remove('active');
  }
  unminimize(w) { const e = w.el; w.min = false; e.style.transform = ''; e.style.opacity = ''; e.style.pointerEvents = ''; setTimeout(() => e.classList.remove('minimizing'), 230); e.classList.remove('minimizing'); e.style.opacity = 1; this.focus(w); }
  showDesktop() { const open = this.wins.filter(w => !w.closed && !w.min); if (open.length) open.forEach(w => this.minimize(w)); else this.wins.filter(w => !w.closed && w.min).forEach(w => this.unminimize(w)); }
  closeWin(w, instant) {
    if (w.closed) return; w.closed = true; clearTimeout(w.nrT);
    if (w.tbtn) { if (!this.wins.some(q => q !== w && !q.closed && q.tbtn === w.tbtn)) { w.tbtn.querySelector('.run').style.display = 'none'; w.tbtn.classList.remove('active'); if (!w.tbtn._pinned) w.tbtn.remove(); } }
    if (instant) { w.el.remove(); return; }
    w.el.classList.add('closing'); setTimeout(() => w.el.remove(), 160);
  }
  // after a restart: everything back like new
  async rebuild() {
    for (const w of this.wins) { clearTimeout(w.nrT); w.el.remove(); } this.wins = [];
    document.querySelectorAll('.ripped').forEach(e => e.classList.remove('ripped'));
    this.tb.style.display = ''; this.tb.classList.remove('ripped');
    this.paintWall(); this.buildIcons(); this.buildTaskbar(); this.buildStart(); this.tick();
  }
}

function bounds(p) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of p) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
function lighten(hex) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const k = 0.45; r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k); return `rgb(${r},${g},${b})`; }
function defaultPins() { return [{ name: 'File Explorer' }, { name: 'Microsoft Edge' }, { name: 'Microsoft Store' }]; }
function explorerIcon(L) { const fe = [...L.pinned, ...L.start].find(a => /file explorer/i.test(a.name)); return fe ? fe.icon : null; }
function pickPinned(L, apps) {
  const out = [], seen = new Set(); const add = (a) => { if (a && !seen.has(a.name)) { seen.add(a.name); out.push(a); } };
  L.pinned.forEach(add);
  const favs = /edge|chrome|word|excel|outlook|store|photos|settings|notepad|calculator|paint|clock|spotify|discord|steam|xbox|terminal|snipping|camera|calendar|mail|media/i;
  apps.filter(a => favs.test(a.name)).forEach(add); L.desktop.filter(d => d.icon).forEach(add); apps.forEach(add);
  return out;
}
async function defaultWallpaper() { // no real wallpaper found (tests on Linux): a plain Windows-blue gradient
  const c = canvas(1920, 1080), x = c.getContext('2d'); const g = x.createRadialGradient(1200, 560, 50, 960, 540, 1300);
  g.addColorStop(0, '#5aa7e8'); g.addColorStop(0.35, '#1b63b8'); g.addColorStop(1, '#06204a'); x.fillStyle = g; x.fillRect(0, 0, 1920, 1080); return c;
}
