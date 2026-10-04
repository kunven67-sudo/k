// All the 2D stuff: the watch-screen main menu, the HUD watch, prompts, toasts, touch controls.
import { input } from '../core/input.js';
import { settings, saveSettings } from '../core/settings.js';
import { sfx, resumeAudio } from '../core/audio.js';
import { SKIN_TONES, HAIR_STYLES } from '../player/avatar.js';
import { formatSize, compareSize } from '../player/watch.js';

const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const clock = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.hud = $(`<div class="hud" style="display:none">
      <div class="crosshair"></div>
      <div class="charge"><i></i></div><div class="mode-tag"></div>
      <div class="prompt"></div>
      <div class="toasts"></div>
      <div class="hud-watch"><div class="hw-top"><span class="hw-clock"></span><span class="hw-temp"></span></div>
        <div class="hw-size">1.75 m</div><div class="hw-cmp"></div>
        <div class="hw-bar"><i style="width:100%"></i></div>
        <div class="hw-batt"><span>❤ <b class="hw-hp">100</b></span><span>🔋 <b class="hw-bt">100%</b></span></div></div>
      <div class="tool-bar"></div>
      <div class="stats"></div>
      <div class="hurt"></div><div class="flash"></div>
    </div>`);
    this.fadeEl = $('<div class="fade"></div>');
    this.root.append(this.hud, this.fadeEl);
    this.el = (sel) => this.hud.querySelector(sel);
    this.menuEl = null;
    this.toastBox = this.el('.toasts');
    this._t = 0;
    if (matchMedia('(pointer: coarse)').matches) this.buildTouch();
    input.onUnlock = () => { if (this.game.playing && !this.game.panelOpen && !input.isTouch()) this.openMenu('pause'); };
  }

  hideBoot() { const b = document.getElementById('boot'); b.classList.add('gone'); setTimeout(() => b.remove(), 700); }
  setBoot(text) { const e = document.getElementById('boot-sub'); if (e) e.textContent = text; }

  // ---------------- the watch menu ----------------
  openMenu(page = 'home') {
    this.game.playing = false; input.enabled = false; input.exitLock();
    this.hud.style.display = 'none';
    if (this.menuEl) this.menuEl.remove();
    this.menuEl = $(`<div class="watch-wrap"><div class="watch"><div class="watch-crown"></div><div class="watch-screen">
      <div class="ws-top"><span class="ws-clock">${clock()}</span><span>${this.game.started ? '🔋 ' + Math.round(this.game.watch.battery * 100) + '%' : '● ● ●'}</span></div>
      <div class="ws-title">SHRINKBOX</div><div class="ws-sub"></div><div class="ws-body"></div></div></div></div>`);
    this.root.append(this.menuEl);
    this.page(page);
  }
  closeMenu() {
    if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; }
    this.hud.style.display = '';
    this.game.playing = true; input.enabled = true;
    resumeAudio();
    input.requestLock();
  }
  page(name) {
    const body = this.menuEl.querySelector('.ws-body'), sub = this.menuEl.querySelector('.ws-sub');
    body.innerHTML = '';
    const btn = (label, hint, fn, cls = '') => { const b = $(`<button class="ws-btn click ${cls}"><span>${label}</span><small>${hint || ''}</small></button>`); b.onclick = () => { sfx.click(0.3); fn(); }; body.append(b); return b; };
    const back = (to) => { const b = btn('← Back', '', () => this.page(to)); b.classList.add('ws-back'); };
    const g = this.game;
    if (name === 'home' || name === 'pause') {
      sub.textContent = name === 'pause' ? 'paused' : 'a mystery watch from the basement';
      if (name === 'pause') btn('▶ Resume', 'Esc', () => this.closeMenu());
      btn(name === 'pause' ? '💾 Save / Load' : '▶ Play', 'save slots', () => this.page('slots'));
      btn('🧍 Character', 'look', () => this.page('character'));
      btn('⚙️ Settings', 'graphics, controls', () => this.page('settings'));
      btn('🎮 Controls', 'keys', () => this.page('controls'));
    } else if (name === 'slots') {
      sub.textContent = 'save slots';
      for (let i = 1; i <= 3; i++) {
        const info = g.saves.info(i);
        btn(info ? `Slot ${i}` : `Slot ${i} — empty`, info ? info : 'new game', () => {
          if (!g.started || !info) { g.startGame(i, !!info); this.closeMenu(); }
          else { this.page2 = i; this.slotPage(i); }
        });
      }
      back(g.started ? 'pause' : 'home');
    } else if (name === 'settings') {
      sub.textContent = 'settings';
      const row = (label, el) => { const r = $(`<div class="ws-row"><label>${label}</label></div>`); r.append(el); body.append(r); return el; };
      const sel = (opts, val, fn) => { const s = $(`<select class="click">${opts.map((o) => `<option ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select>`); s.onchange = () => fn(s.value); return s; };
      const range = (min, max, step, val, fn) => { const r = $(`<input type="range" class="click" min="${min}" max="${max}" step="${step}" value="${val}">`); r.oninput = () => fn(parseFloat(r.value)); return r; };
      row('Graphics', sel(['auto', 'low', 'medium', 'high', 'ultra'], settings.quality, (v) => { settings.quality = v; saveSettings(); this.toast('Graphics change applies after reload', 3); }));
      row('Mouse speed', range(0.2, 3, 0.05, settings.sensitivity, (v) => { settings.sensitivity = v; saveSettings(); }));
      row('Field of view', range(55, 100, 1, settings.fov, (v) => { settings.fov = v; saveSettings(); }));
      row('Volume', range(0, 1, 0.01, settings.volume, (v) => { settings.volume = v; saveSettings(); }));
      row('Invert look', sel(['no', 'yes'], settings.invertY ? 'yes' : 'no', (v) => { settings.invertY = v === 'yes'; saveSettings(); }));
      row('Show FPS', sel(['no', 'yes'], settings.showFps ? 'yes' : 'no', (v) => { settings.showFps = v === 'yes'; saveSettings(); }));
      back(g.started ? 'pause' : 'home');
    } else if (name === 'controls') {
      sub.textContent = 'controls';
      body.append($(`<div class="ws-keys">
        <div><b>WASD</b> move · <b>Mouse</b> look</div><div><b>Space</b> jump · <b>Shift</b> run · <b>Ctrl/C</b> crouch</div>
        <div><b>Hold F</b> shrink · <b>Hold G</b> grow</div><div><b>V</b> 1st / 3rd person · <b>L</b> watch light</div>
        <div><b>E</b> use / grab · <b>Q</b> spawn menu</div><div><b>1-4</b> tools · <b>Scroll</b> shrink/grow mode</div>
        <div><b>Click</b> use tool (hold = charge)</div><div><b>R</b> rotate held · <b>Esc</b> pause</div>
        <div style="margin-top:6px;color:#8aa3b8">Controller: LB shrink · RB grow · RT tool · LT alt · A jump · X use · Y spawn · D-pad mode/tools</div></div>`));
      back(g.started ? 'pause' : 'home');
    } else if (name === 'character') {
      sub.textContent = 'your look';
      const L = g.look;
      const row = (label, el) => { const r = $(`<div class="ws-row"><label>${label}</label></div>`); r.append(el); body.append(r); return el; };
      const swatches = (list, val, fn) => {
        const d = $('<div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end"></div>');
        for (const c of list) { const s = $(`<button class="click" style="width:22px;height:22px;border-radius:50%;border:2px solid ${c === val ? '#4ef2ff' : 'transparent'};background:${c}"></button>`); s.onclick = () => { fn(c); this.page('character'); }; d.append(s); }
        return d;
      };
      const color = (val, fn) => { const c = $(`<input type="color" class="click" value="${val}">`); c.oninput = () => fn(c.value); return c; };
      const sel = (opts, val, fn) => { const s = $(`<select class="click">${opts.map((o) => `<option ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select>`); s.onchange = () => fn(s.value); return s; };
      const range = (min, max, step, val, fn) => { const r = $(`<input type="range" class="click" min="${min}" max="${max}" step="${step}" value="${val}">`); r.onchange = () => fn(parseFloat(r.value)); return r; };
      const set = (k) => (v) => { L[k] = v; g.applyLook(); };
      row('Skin', swatches(SKIN_TONES, L.skin, set('skin')));
      row('Face', sel(['round', 'long', 'square'], L.face, set('face')));
      row('Eyes', color(L.eyes, set('eyes')));
      row('Hair style', sel(HAIR_STYLES, L.hairStyle, set('hairStyle')));
      row('Hair color', color(L.hair, set('hair')));
      row('Top', sel(['hoodie', 'shirt'], L.topStyle, set('topStyle')));
      row('Top color', color(L.top, set('top')));
      row('Pants', color(L.pants, set('pants')));
      row('Shoes', color(L.shoes, set('shoes')));
      row('Height', range(0.85, 1.12, 0.01, L.height, set('height')));
      row('Body', range(0.85, 1.25, 0.01, L.build, set('build')));
      back(g.started ? 'pause' : 'home');
    }
  }
  slotPage(i) {
    const body = this.menuEl.querySelector('.ws-body'), g = this.game;
    body.innerHTML = '';
    const mk = (label, fn, cls = '') => { const b = $(`<button class="ws-btn click ${cls}"><span>${label}</span></button>`); b.onclick = () => { sfx.click(0.3); fn(); }; body.append(b); };
    mk(`💾 Save into slot ${i}`, () => { g.saves.save(i); this.toast(`Saved to slot ${i}`); this.page('slots'); });
    mk(`📂 Load slot ${i}`, () => { g.saves.load(i); this.closeMenu(); });
    mk(`🗑️ Delete slot ${i}`, () => { g.saves.remove(i); this.page('slots'); }, 'danger');
    mk('← Back', () => this.page('slots'));
  }

  // ---------------- HUD ----------------
  update(dt) {
    const g = this.game, p = g.player;
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 0.1;
      this.el('.hw-clock').textContent = clock();
      const real = p.height / (g.unit || 1);
      this.el('.hw-size').textContent = formatSize(real);
      this.el('.hw-cmp').textContent = compareSize(real);
      this.el('.hw-bar > i').style.width = p.health + '%';
      this.el('.hw-hp').textContent = Math.ceil(p.health);
      this.el('.hw-bt').textContent = Math.round(g.watch.battery * 100) + '%';
      this.el('.hw-temp').textContent = g.inside && g.inside.temp ? Math.round(g.inside.temp) + '°C' : '';
      if (settings.showFps) this.el('.stats').textContent = `${Math.round(1 / Math.max(1e-3, g.dtAvg))} fps\n${g.engine.renderer.info.render.calls} draws`;
      else this.el('.stats').textContent = '';
      if (g.viewModel) g.viewModel.drawWatch(formatSize(real), new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), g.watch.mode > 0 ? '#ffc46b' : '#4ef2ff');
    }
    const w = this.el('.hud-watch');
    w.classList.toggle('glow', g.watch.changing);
    w.classList.toggle('grow', g.watch.mode > 0);
  }
  prompt(text) {
    const el = this.el('.prompt');
    if (text) { el.innerHTML = text; el.classList.add('on'); } else el.classList.remove('on');
    this.el('.crosshair').classList.toggle('hot', !!text);
  }
  toast(text, secs = 4) {
    const t = $(`<div class="toast">${text}</div>`);
    this.toastBox.append(t);
    while (this.toastBox.children.length > 4) this.toastBox.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, secs * 1000);
  }
  flash(a = 0.6) { const f = this.el('.flash'); f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
  hurtFlash(a) { const h = this.el('.hurt'); h.style.boxShadow = `inset 0 0 160px rgba(255,0,0,${0.3 + a * 0.5})`; setTimeout(() => { h.style.boxShadow = 'inset 0 0 120px rgba(255,0,0,0)'; }, 160); }
  fade(on) { this.fadeEl.classList.toggle('on', on); }
  setCharge(v, mode) {
    const c = this.el('.charge');
    c.classList.toggle('on', v > 0); c.classList.toggle('grow', mode > 0);
    c.firstElementChild.style.width = (v * 100) + '%';
  }
  setModeTag(text, grow) { const m = this.el('.mode-tag'); m.textContent = text || ''; m.classList.toggle('grow', !!grow); }
  setTools(tools, sel) {
    const bar = this.el('.tool-bar'); bar.innerHTML = '';
    tools.forEach((t, i) => bar.append($(`<div class="tool ${i === sel ? 'sel' : ''}"><span class="k">${i + 1}</span>${t.icon}<small>${t.name}</small></div>`)));
  }

  // ---------------- spawn menu (Q) ----------------
  openSpawnMenu(cats, items, spawner) {
    const g = this.game;
    g.panelOpen = true; input.enabled = false; input.exitLock();
    let cat = this._spawnCat || cats[0][0];
    const wrap = $(`<div class="panel-wrap"><div class="panel">
      <div class="panel-head"><span>📦 Spawn</span><span style="display:flex;gap:10px;align-items:center">
        <button class="ws-btn click size-tog" style="width:auto;padding:6px 12px"></button><button class="click x">✕</button></span></div>
      <div class="tabs"></div><div class="grid"></div></div></div>`);
    const tabs = wrap.querySelector('.tabs'), grid = wrap.querySelector('.grid'), tog = wrap.querySelector('.size-tog');
    const close = () => { wrap.remove(); g.panelOpen = false; if (g.playing) { input.enabled = true; input.requestLock(); } };
    const setTog = () => { tog.textContent = spawner.mySize ? '🔍 Your size' : '📏 Real size'; };
    tog.onclick = () => { spawner.mySize = !spawner.mySize; setTog(); }; setTog();
    const draw = () => {
      tabs.innerHTML = ''; grid.innerHTML = '';
      for (const [id, label] of cats) { const b = $(`<button class="tab click ${id === cat ? 'sel' : ''}">${label}</button>`); b.onclick = () => { cat = this._spawnCat = id; draw(); }; tabs.append(b); }
      for (const it of items.filter((i) => i.cat === cat)) {
        const c = $(`<button class="cell click"><span class="ic">${it.icon}</span>${it.name}</button>`);
        c.onclick = () => { close(); setTimeout(() => spawner.spawnInFront(it.id), 30); };
        grid.append(c);
      }
    };
    draw();
    wrap.querySelector('.x').onclick = close;
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
    this.root.append(wrap);
    this.closePanel = close;
  }

  // ---------------- touch ----------------
  buildTouch() {
    const t = $(`<div class="touch"><div class="stick"><i></i></div>
      <div class="tbtns">
        <button class="tbtn" data-a="shrink">F</button><button class="tbtn" data-a="grow">G</button><button class="tbtn" data-a="use">E</button>
        <button class="tbtn" data-a="crouch">⬇</button><button class="tbtn" data-a="fire">●</button><button class="tbtn" data-a="jump">⤒</button>
      </div>
      <div class="ttop"><button class="tbtn" data-a="camera">👁</button><button class="tbtn" data-a="light">💡</button><button class="tbtn" data-a="spawn">＋</button><button class="tbtn" data-a="sprint">🏃</button><button class="tbtn" data-a="pause">☰</button></div></div>`);
    this.hud.append(t);
    for (const b of t.querySelectorAll('[data-a]')) {
      const a = b.dataset.a;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); input.touchPress(a); b.classList.add('on'); });
      const up = (e) => { e.preventDefault(); input.touchRelease(a); b.classList.remove('on'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    }
    const stick = t.querySelector('.stick'), knob = stick.firstElementChild;
    let sid = null, cx = 0, cy = 0;
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); });
    const move = (e) => {
      if (e.pointerId !== sid) return;
      let dx = (e.clientX - cx) / 55, dy = (e.clientY - cy) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      input.touch.move.x = dx; input.touch.move.y = -dy; knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    };
    stick.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; input.touch.move.x = input.touch.move.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    // drag anywhere else to look
    let lid = null, lx = 0, ly = 0;
    const canvas = this.game.engine.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => { if (lid === null) { lid = e.pointerId; lx = e.clientX; ly = e.clientY; } input.mode = 'touch'; });
    canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; input.touch.look.x += (e.clientX - lx) * 2.2; input.touch.look.y += (e.clientY - ly) * 2.2; lx = e.clientX; ly = e.clientY; });
    const lend = (e) => { if (e.pointerId === lid) lid = null; };
    canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend);
  }
}
