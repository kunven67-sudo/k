// Everything on top of the 3D view: the start screen, the use prompt, the bar above your monitors
// while you sit at the PC, toasts, and the pause menu (settings, your look, PC parts, controls).
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICONS = {
  back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1.5" y="2.5" width="13" height="8.5" rx="1"/><path d="M5.5 14h5M8 11v3"/></svg>',
  look: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/></svg>',
  stand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="2.8" r="1.6"/><path d="M8 5v5M5 7.5h6M8 10l-2.5 4.5M8 10l2.5 4.5"/></svg>',
  menu: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 4h12M2 8h12M2 12h12"/></svg>',
};

export class UI {
  constructor(g) {
    this.g = g;
    this.menuOpen = false;
    this.tab = 'resume';
    this.seat = { hud: false, x: 0, hot: -1 };
    this.settings = Object.assign({
      quality: 'auto', sens: 1, seatFov: 60, seatLow: 0.13, volume: 0.9, ambient: 0.8, outages: true, keylock: true, fpsShow: false,
    }, load('bs_settings'));
    this.outfit = load('bs_outfit');
    this.buildSeatbar();
    $('menu').addEventListener('click', e => this.menuClick(e));
    $('menu').addEventListener('input', e => this.menuInput(e));
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) this.keylocked = false; });
  }

  apply() {
    const g = this.g, s = this.settings;
    g.settings.sens = s.sens; g.settings.seatFov = s.seatFov; g.settings.seatLow = s.seatLow;
    g.audio.setVolume('master', s.volume); g.audio.setVolume('ambient', s.ambient);
    if (g.router) g.router.outagesOn = s.outages;
    if (g.renderer.setting !== s.quality && !g.params.get('q')) g.renderer.set(s.quality);
    if (this.outfit && g.player?.avatar) g.player.avatar.applyOutfit(this.outfit);
  }

  saveSettings() { save('bs_settings', this.settings); this.apply(); }

  // ------------------------------------------------------------------ start screen
  showStart(onGo) {
    $('start').classList.remove('hidden');
    const go = async () => {
      $('start').removeEventListener('click', go);
      $('start').classList.add('hidden');
      await this.g.audio.start();
      this.apply();
      this.g.input.enabled = true;
      this.lockIn();
      onGo();
    };
    $('start').addEventListener('click', go);
  }

  // pointer lock, plus fullscreen + keyboard lock so Esc / Windows key go to the in-game PC
  async lockIn() {
    const g = this.g;
    if (this.settings.keylock && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { /* not allowed */ }
    }
    if (document.fullscreenElement && navigator.keyboard?.lock && this.settings.keylock) {
      try { await navigator.keyboard.lock(); this.keylocked = true; } catch (e) { this.keylocked = false; }
    }
    g.input.lock();
  }

  // ------------------------------------------------------------------ prompt
  prompt(it, hold) {
    const el = $('prompt');
    if (!it) { if (this._p !== '') { el.innerHTML = ''; this._p = ''; } return; }
    const label = typeof it.label === 'function' ? it.label() : it.label;
    let html = `<kbd>E</kbd>${esc(label)}`;
    if (it.hold && (!it.hold.enabled || it.hold.enabled())) {
      const k = hold ? Math.min(1, hold / it.hold.time) : 0;
      html += `<div class="hold"><span>${esc(it.hold.label)}</span><i style="width:${(k * 100).toFixed(1)}%"></i></div>`;
    }
    if (html !== this._p) { el.innerHTML = html; this._p = html; }
  }

  // ------------------------------------------------------------------ the bar above the monitors
  buildSeatbar() {
    const items = [['back', 'Back to PC'], ['look', 'Look around'], ['stand', 'Stand up'], ['menu', 'Menu']];
    $('seatbar').innerHTML = items.map(([k, t]) => `<button data-act="${k}">${ICONS[k]}<span>${t}</span></button>`).join('');
    $('seatbar').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.seatAct(b.dataset.act); });
    this.seatButtons = [...$('seatbar').querySelectorAll('button')];
  }

  // shown while seated whenever the mouse is "above the screen" (or the real cursor is free)
  setSeatbar(mode) {
    const el = $('seatbar');
    el.classList.toggle('show', mode === 'show');
    el.classList.toggle('peek', mode === 'peek');
    this.seatMode = mode;
    const back = this.seatButtons[0].querySelector('span');
    back.textContent = this.g.player.state === 'look' ? 'Back to PC' : 'Back to PC';
  }

  // in-game cursor pushed past the top edge: drive a cursor over the bar with the mouse
  seatHud(dx, dy) {
    const s = this.seat, el = $('seatbar');
    const r = el.getBoundingClientRect();
    s.x = Math.max(r.left + 6, Math.min(r.right - 6, s.x + dx));
    s.y = Math.max(r.top + 4, s.y + dy);
    if (s.y > r.bottom + 10) { this.exitSeatHud(); return; }
    const vc = $('vcursor');
    vc.style.left = s.x + 'px'; vc.style.top = Math.min(s.y, r.bottom) + 'px';
    s.hot = this.seatButtons.findIndex(b => { const q = b.getBoundingClientRect(); return s.x >= q.left && s.x <= q.right; });
    this.seatButtons.forEach((b, i) => b.classList.toggle('hot', i === s.hot));
  }

  enterSeatHud() {
    const s = this.seat;
    s.hud = true;
    this.setSeatbar('show');
    const r = $('seatbar').getBoundingClientRect();
    s.x = (r.left + r.right) / 2; s.y = r.bottom - 14;
    const vc = $('vcursor');
    if (!vc.src) vc.src = arrowDataURL();
    vc.style.display = 'block';
    this.seatHud(0, 0);
  }

  exitSeatHud() {
    this.seat.hud = false;
    $('vcursor').style.display = 'none';
    this.seatButtons.forEach(b => b.classList.remove('hot'));
    this.setSeatbar(this.g.player.state === 'look' ? 'show' : 'hide');
    if (this.g.os) this.g.os.hudEscape = 0;
  }

  seatClick() { const i = this.seat.hot; if (i >= 0) this.seatAct(this.seatButtons[i].dataset.act); }

  seatAct(act) {
    const g = this.g, p = g.player;
    this.exitSeatHud();
    if (act === 'back') { if (p.state === 'look') p.backToPc(); this.setSeatbar('hide'); this.lockIn(); }
    else if (act === 'look') { p.lookAround(); this.setSeatbar('show'); this.lockIn(); }
    else if (act === 'stand') { p.standUp(); this.setSeatbar('hide'); this.lockIn(); }
    else if (act === 'menu') this.openMenu('resume');
  }

  // ------------------------------------------------------------------ pause menu
  openMenu(tab = 'resume') {
    this.menuOpen = true;
    this.tab = tab;
    this.g.input.unlock();
    this.renderMenu();
    $('menu').classList.remove('hidden');
  }

  closeMenu() {
    this.menuOpen = false;
    $('menu').classList.add('hidden');
    this.lockIn();
  }

  renderMenu() {
    const tabs = [['resume', 'Resume'], ['settings', 'Settings'], ['you', 'You'], ['pc', 'Your PC'], ['parts', 'PC parts'], ['controls', 'Controls']];
    const nav = `<nav><div class="logo">BATTLESTATION</div>${tabs.map(([k, t]) => `<button data-tab="${k}" class="${k === this.tab ? 'on' : ''}">${t}</button>`).join('')}<div class="grow"></div><button data-act="reset">Start over</button></nav>`;
    $('menu').innerHTML = `<div class="panel">${nav}<section>${this.section()}</section></div>`;
  }

  section() {
    const g = this.g, s = this.settings;
    const seg = (key, opts) => `<span class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-val="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</span>`;
    const range = (key, min, max, step) => `<input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}">`;
    if (this.tab === 'resume') {
      return `<h3>Paused</h3><p class="muted">Your room keeps going in the background: the PC stays on, the internet box keeps blinking.</p>
        <div style="display:flex;gap:10px;margin-top:20px"><button class="btn primary" data-act="resume">Resume</button></div>
        <h4>Right now</h4><div class="spec">
        <div>Graphics</div><div>${esc(g.renderer.setting === 'auto' ? 'Auto (' + g.renderer.level + ')' : g.renderer.level)} &middot; ${Math.round(g.renderer.fps || 0)} fps</div>
        <div>Your real GPU</div><div>${esc(g.hw?.realGpu.name || '?')}</div>
        <div>Internet box</div><div>${esc(netText(g))}</div></div>`;
    }
    if (this.tab === 'settings') {
      return `<h3>Settings</h3>
        <h4>Graphics</h4>
        <div class="row"><label>Quality<div class="note">Auto starts at High and steps down if your graphics card can't keep up.</div></label>${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']])}</div>
        <div class="row"><label>Show FPS</label>${seg('fpsShow', [[false, 'Off'], [true, 'On']])}</div>
        <h4>Mouse + view</h4>
        <div class="row"><label>Mouse sensitivity (walking)</label>${range('sens', 0.2, 3, 0.05)}</div>
        <div class="row"><label>Field of view at the PC</label>${range('seatFov', 40, 80, 1)}</div>
        <div class="row"><label>How low you look at the PC<div class="note">Higher = more of your hands and keyboard in view.</div></label>${range('seatLow', 0, 0.35, 0.01)}</div>
        <div class="row"><label>Fullscreen + keyboard lock<div class="note">Esc and the Windows key go to the in-game PC. Hold Esc to leave fullscreen.</div></label>${seg('keylock', [[true, 'On'], [false, 'Off']])}</div>
        <h4>Sound</h4>
        <div class="row"><label>Volume</label>${range('volume', 0, 1, 0.01)}</div>
        <div class="row"><label>Room sounds (fans, hum, outside)</label>${range('ambient', 0, 1, 0.01)}</div>
        <h4>Internet box</h4>
        <div class="row"><label>Random internet outages<div class="note">Sometimes the internet just dies for a few minutes, like real life.</div></label>${seg('outages', [[true, 'On'], [false, 'Off']])}</div>`;
    }
    if (this.tab === 'you') {
      const o = g.player.avatar.outfit;
      const sw = (key, cols) => `<span class="swatches">${cols.map(c => `<button data-fit="${key}" data-val="${c}" style="background:#${c.toString(16).padStart(6, '0')}" class="${o[key] === c ? 'on' : ''}"></button>`).join('')}</span>`;
      const fs = (key, opts) => `<span class="seg">${opts.map(([v, t]) => `<button data-fit="${key}" data-val="${v}" class="${String(o[key]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</span>`;
      return `<h3>You</h3><p class="muted">Look down at yourself or in the bathroom mirror to see it.</p>
        <div class="row"><label>Skin</label>${fs('skin', [['light', 'Light'], ['tan', 'Tan'], ['brown', 'Brown'], ['dark', 'Dark']])}</div>
        <div class="row"><label>Sleeves</label>${fs('sleeves', [['long', 'Hoodie'], ['short', 'T-shirt']])}</div>
        <div class="row"><label>Top color</label>${sw('top', [0x232428, 0x5b5d61, 0xe8e6e1, 0x7a1f24, 0x1f3a5f, 0x2f4f3a, 0x6b4f9a, 0xc96a1b])}</div>
        <div class="row"><label>Pants</label>${fs('pants', [['joggers', 'Joggers'], ['jeans', 'Jeans']])}</div>
        <div class="row"><label>Pants color</label>${sw('pantsColor', [0x5b5d61, 0x1d1e21, 0x2c3e5a, 0x6b6250, 0x8a8f96])}</div>
        <div class="row"><label>Shoes</label>${fs('shoes', [[true, 'On'], [false, 'Socks']])}</div>
        <div class="row"><label>Watch</label>${fs('watch', [[true, 'On'], [false, 'Off']])}</div>`;
    }
    if (this.tab === 'pc') {
      const hw = g.hw, scan = g.scan;
      return `<h3>Your PC</h3>
        <p class="muted">${scan ? 'Loaded from your real PC scan.' : 'This is what your browser lets the game see. Scan your PC to get everything: your taskbar, apps, games, wallpaper and exact parts.'}</p>
        <div class="spec">
          <div>Graphics card</div><div>${esc(hw.realGpu.name)}${hw.realGpu.vram ? ' &middot; ' + hw.realGpu.vram + ' GB' : ''}</div>
          <div>Processor</div><div>${esc(hw.cpuName)} (${hw.threads} threads)</div>
          <div>Memory</div><div>${esc(hw.ramText())}</div>
          <div>System</div><div>${esc(hw.osName)} &middot; ${esc(hw.computerName)}</div>
          <div>Screen</div><div>${esc(hw.screen)}</div>
          ${scan ? `<div>Taskbar</div><div>${scan.pins?.length || 0} pinned apps</div><div>Games</div><div>${(scan.steam?.length || 0) + (scan.epic?.length || 0)} found</div>` : ''}
        </div>
        <h4>Scan my real PC</h4>
        ${g.scanner ? g.scanner.helpHTML() : '<p class="muted">Scanner not available.</p>'}`;
    }
    if (this.tab === 'parts') {
      const hw = g.hw, t = g.desk.tower;
      const part = (p, i) => `<div class="row"><label>${esc(p.kind === 'gpu' ? p.name : p.name || p.gb + ' GB')}<div class="note">${p.kind === 'gpu' ? `${p.vram} GB &middot; about ${Math.round(p.score / 10 * 10) / 10}x a GT 1030${p.yours ? ' &middot; your real card' : ''}` : `${p.sticks} sticks${p.yours ? ' &middot; your real RAM' : ''}`}</div></label><button class="btn" data-swap="${i}">Install</button></div>`;
      return `<h3>PC parts</h3>
        <p class="muted">${t.panelOpen < 0.5 ? 'Open the side panel on the PC first (walk up to it and press E).' : g.os.on ? 'The PC is still on. Swapping parts now will crash it.' : 'PC is off and open. Pick a part to put in.'}</p>
        <h4>In the PC now</h4>
        <div class="spec"><div>Graphics card</div><div>${esc(hw.parts.gpu.name)}${hw.parts.gpu.yours ? ' (your real one)' : ''}</div><div>Memory</div><div>${esc(hw.ramText())}</div></div>
        <h4>Box of spare parts</h4>${hw.box.map(part).join('')}
        <p class="muted" style="margin-top:16px">The in-game parts change how fast the in-game games run. The room itself always runs on your real graphics card.</p>
        <div id="swapmsg" class="muted"></div>`;
    }
    if (this.tab === 'controls') {
      return `<h3>Controls</h3><div class="spec">
        <div>Walk</div><div><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> &middot; <kbd>Shift</kbd> faster &middot; <kbd>Ctrl</kbd> crouch</div>
        <div>Use / pick up</div><div><kbd>E</kbd> or left click. Some things you hold <kbd>E</kbd> (like the power button).</div>
        <div>At the PC</div><div>Your real mouse moves the in-game mouse, your real keyboard types on the in-game keyboard.</div>
        <div>Leave the PC</div><div>Push the mouse up past the top of the screen, or press <kbd>Esc</kbd>${this.keylocked ? ' (hold it)' : ''}. Then pick Stand up / Look around.</div>
        <div>Menu</div><div><kbd>F1</kbd> anytime, <kbd>Esc</kbd> while walking</div></div>`;
    }
    return '';
  }

  menuClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const g = this.g;
    if (b.dataset.tab) { this.tab = b.dataset.tab; this.renderMenu(); return; }
    if (b.dataset.act === 'resume') { this.closeMenu(); return; }
    if (b.dataset.act === 'reset') {
      if (confirm('Start over? This forgets your in-game PC files, parts and settings.')) { for (const k of ['bs_os', 'bs_rig', 'bs_settings', 'bs_outfit']) localStorage.removeItem(k); location.reload(); }
      return;
    }
    if (b.dataset.set) {
      let v = b.dataset.val;
      if (v === 'true') v = true; else if (v === 'false') v = false;
      this.settings[b.dataset.set] = v;
      this.saveSettings(); this.renderMenu(); return;
    }
    if (b.dataset.fit) {
      let v = b.dataset.val;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
      g.player.avatar.applyOutfit({ [b.dataset.fit]: v });
      this.outfit = { ...g.player.avatar.outfit };
      save('bs_outfit', this.outfit); this.renderMenu(); return;
    }
    if (b.dataset.swap !== undefined) {
      const msg = g.rig.swap(g.hw.box[+b.dataset.swap]);
      this.renderMenu();
      const m = $('swapmsg'); if (m) m.textContent = msg;
      return;
    }
    if (b.dataset.scan) { g.scanner?.action(b.dataset.scan); setTimeout(() => this.renderMenu(), 400); }
  }

  menuInput(e) {
    const r = e.target.dataset.range;
    if (!r) return;
    this.settings[r] = +e.target.value;
    this.saveSettings();
  }

  update() {
    const f = $('fps');
    if (this.settings.fpsShow) { if (!f) { const d = document.createElement('div'); d.id = 'fps'; $('hud').appendChild(d); } else f.textContent = Math.round(this.g.renderer.fps || 0) + ' fps'; }
    else if (f) f.remove();
  }
}

function netText(g) {
  const r = g.router;
  if (!r) return '?';
  if (!r.power) return 'Unplugged';
  if (!r.booted()) return 'Starting up';
  if (!r.wan) return 'No internet cable';
  if (!r.wanUp()) return r.realOnline ? 'Connecting / outage' : 'Your real internet is down';
  return 'Online';
}

function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') || undefined; } catch (e) { return undefined; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked */ } }

let _arrow;
function arrowDataURL() {
  if (_arrow) return _arrow;
  const c = document.createElement('canvas'); c.width = 18; c.height = 18;
  const g = c.getContext('2d');
  g.beginPath(); g.moveTo(1, 1); g.lineTo(1, 14); g.lineTo(4.5, 11); g.lineTo(7, 16.5); g.lineTo(9.3, 15.5); g.lineTo(7, 10.3); g.lineTo(11.5, 10.3); g.closePath();
  g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.2; g.stroke();
  return (_arrow = c.toDataURL());
}
