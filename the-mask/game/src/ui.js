// THE MASK - menus (Game System 3 kit look on PC/phone, the same menus on a floating panel in VR), the HUD,
// hints and little pop-up messages.
import * as THREE from 'three';
import { G, on, emit, clamp } from './game.js';
import { S, saveSettings } from './settings.js';
import { CATALOG } from './props.js';
import { GADGETS, GADGET_IDS } from './gadgets.js';
import { TYPES } from './chars.js';
import { voice } from './voice.js';
import { audio } from './audio.js';

const PEOPLE = [['knight', 'Knight'], ['barbarian', 'Barbarian'], ['mage', 'Mage'], ['rogue', 'Rogue'], ['random', 'Someone']];
const TABS = [['spawn', 'Spawn'], ['loop', 'Loop'], ['room', 'Room'], ['settings', 'Settings'], ['help', 'How to play']];
const cycle = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];
const onOff = (b) => (b ? 'On' : 'Off');

/* ---------- the menus, once, for both PC and VR ---------- */
function pageItems(page) {
  if (page === 'spawn') {
    const t = (label, act) => ({ type: 'tile', label, act });
    return [
      { type: 'head', label: 'People' }, ...PEOPLE.map(([id, n]) => t(n, () => ui.spawn({ kind: 'person', id }))),
      { type: 'head', label: 'Gadgets' }, ...GADGETS.map((g) => t(g.name, () => ui.spawn({ kind: 'gadget', id: g.id }))),
      { type: 'head', label: 'Stuff' }, ...CATALOG.map((c) => t(c.name, () => ui.spawn({ kind: 'prop', id: c.id })))
    ];
  }
  if (page === 'loop') {
    const L = G.loop, auto = L.mode === 'auto';
    const list = [
      { type: 'choice', label: 'Copies of you', value: () => (L.mode === 'auto' ? 'Auto loop' : 'Record button'), act: () => L.setMode(L.mode === 'auto' ? 'record' : 'auto') },
      ...(auto ? [
        { type: 'choice', label: 'Loop length', value: () => S.loopLen + ' seconds', act: () => { S.loopLen = cycle([15, 30, 45, 60, 90], S.loopLen); } },
        { type: 'choice', label: 'Rewind the room too', value: () => onOff(S.rewindRoom), act: () => { S.rewindRoom = !S.rewindRoom; G.loop.takeSnapshot(); } }
      ] : []),
      { type: 'choice', label: 'Copies say what you said', value: () => (S.voice && voice.on ? 'On' : voice.denied ? 'Mic blocked' : 'Off'), act: async () => { if (S.voice && voice.on) { S.voice = false; voice.disable(); } else { S.voice = true; await voice.enable(); } } },
      { type: 'choice', label: 'Most copies at once', value: () => String(S.maxCopies), act: () => { S.maxCopies = cycle([2, 4, 6, 8, 10, 12], S.maxCopies); } },
      auto ? { type: 'button', label: 'Start the next loop now', act: () => { ui.close(); L.pressRecord(); } }
        : { type: 'button', label: () => (L.recording ? 'Stop recording' : 'Start recording'), act: () => { ui.close(); L.pressRecord(); } },
      { type: 'button', label: 'Remove the newest copy', act: () => L.removeLast() },
      { type: 'button', label: 'Remove all copies', act: () => L.clearCopies() }
    ];
    return list;
  }
  if (page === 'room') {
    return [
      { type: 'button', label: 'Remove all people', act: () => G.people.clear() },
      { type: 'button', label: 'Remove the stuff you spawned', act: () => G.props.clearSpawned() },
      { type: 'button', label: 'Remove gadgets on the floor', act: () => G.gadgets.clear() },
      { type: 'button', label: 'Clean up the blood', act: () => G.blood.clear() },
      { type: 'choice', label: 'Blood', value: () => onOff(S.blood), act: () => { S.blood = !S.blood; } },
      { type: 'choice', label: 'Rain', value: () => onOff(S.rain), act: () => { S.rain = !S.rain; audio.applyVolumes(); } },
      { type: 'choice', label: 'Lightning', value: () => onOff(S.lightning), act: () => { S.lightning = !S.lightning; } }
    ];
  }
  if (page === 'settings') {
    const vol = (label, key) => ({ type: 'slider', label, get: () => S[key], set: (v) => { S[key] = v; audio.applyVolumes(); } });
    return [
      { type: 'choice', label: 'Graphics', value: () => ({ auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' })[S.quality] + (S.quality === 'auto' ? ' (' + G.quality.levelName() + ')' : ''), act: () => { S.quality = cycle(['auto', 'low', 'medium', 'high', 'ultra'], S.quality); G.quality.apply(); } },
      vol('Volume', 'master'), vol('Sound effects', 'sfx'), vol('Copies\' voices', 'voices'), vol('Rain + room', 'ambience'),
      ...(G.xr || G.xrSupported ? [
        { type: 'choice', label: 'VR turning', value: () => (S.turn === 'snap' ? 'Snap' : 'Smooth'), act: () => { S.turn = S.turn === 'snap' ? 'smooth' : 'snap'; } },
        { type: 'choice', label: 'Snap turn angle', value: () => S.snapAngle + '°', act: () => { S.snapAngle = cycle([30, 45, 60, 90], S.snapAngle); } },
        { type: 'choice', label: 'VR walk speed', value: () => S.moveSpeed.toFixed(1) + ' m/s', act: () => { S.moveSpeed = cycle([1.5, 2.2, 3, 4], S.moveSpeed); } }
      ] : []),
      ...(G.xr ? [] : [
        { type: 'slider', label: 'Look speed', get: () => (S.sens - 0.2) / 2.8, set: (v) => { S.sens = 0.2 + v * 2.8; } },
        { type: 'choice', label: 'Upside-down look', value: () => onOff(S.invertY), act: () => { S.invertY = !S.invertY; } },
        { type: 'choice', label: 'Show FPS', value: () => onOff(S.showFps), act: () => { S.showFps = !S.showFps; } }
      ])
    ];
  }
  if (page === 'help') {
    const vr = G.xr || (G.xrSupported && !G.started);
    const lines = vr ? [
      'Grip: grab, let go to throw. Grab the mask off the stand and bring it to your face.',
      'Trigger: shoot the gadget in that hand. Empty hand: make a fist and punch.',
      'Left stick: walk. Right stick: turn.',
      'Y: this menu. A: next loop now (or record, in Record mode). B: spawn the same thing again. X: next gadget into your left hand.',
      'Look at your left watch: the teal hand is the loop. When it goes all the way round, time rewinds and a copy of you appears.'
    ] : G.touch ? [
      'Left thumb: walk. Right thumb: look around.',
      'Grab picks up what you look at (the mask goes on your face). Use shoots or throws. Punch punches.',
      'Rec: next loop now (or record, in Record mode). Menu: spawn people, gadgets and stuff.'
    ] : [
      'Mouse: look. WASD: walk. Shift: run. Space: jump. C: crouch.',
      'E: grab / drop. Left click: shoot, throw, or punch. Right click: punch with your left hand.',
      '1: empty hands. 2 to 7: Blaster, Black Hole Gun, Time Stopper, Size Ray, Float Ray, Copy Ray. Mouse wheel: switch. Q: put it away.',
      'R: next loop now (or record, in Record mode). F: spawn the same thing again. Tab: this menu. Esc: pause.',
      'Grab the mask off the stand to put it on. The clock (and your watch) shows the loop: when it goes round, time rewinds and a copy of you does everything you just did.'
    ];
    return lines.map((l) => ({ type: 'text', label: l }));
  }
  return [];
}

/* ---------- PC / phone menus (Game System 3 kit) ---------- */
const $ = (s) => document.querySelector(s);
let menuEl, titleEl, hudEl, hintEl, toastEl, fpsEl, crossEl, nav = null, tab = 'spawn', lastHint = '';
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
const lbl = (it) => (typeof it.label === 'function' ? it.label() : it.label);

function renderMenu() {
  const items = pageItems(tab);
  let html = `<div class="gs3-panel wide"><div class="tabs">${TABS.map(([id, n]) => `<button class="gs3-btn ${id === tab ? 'primary' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>`;
  if (tab === 'spawn') {
    html += '<div class="spawn">';
    for (const [i, it] of items.entries()) html += it.type === 'head' ? `<h2 class="gs3-sub head">${esc(it.label)}</h2>` : `<button class="gs3-item tile" data-i="${i}">${esc(lbl(it))}</button>`;
    html += '</div>';
  } else {
    html += '<div class="gs3-menu">';
    for (const [i, it] of items.entries()) {
      if (it.type === 'text') html += `<p class="gs3-sub help">${esc(it.label)}</p>`;
      else if (it.type === 'slider') html += `<div class="gs3-item">${esc(lbl(it))}<input class="gs3-slider" type="range" min="0" max="20" value="${Math.round(it.get() * 20)}" data-i="${i}"></div>`;
      else html += `<button class="gs3-item" data-i="${i}">${esc(lbl(it))}${it.value ? `<span class="gs3-value">${esc(it.value())}</span>` : ''}</button>`;
    }
    html += '</div>';
  }
  html += `<div class="gs3-row"><button class="gs3-btn primary" data-close>Back to the room</button></div></div>`;
  menuEl.innerHTML = html;
  menuEl.onclick = async (e) => {
    const t = e.target.closest('[data-tab],[data-i],[data-close]'); if (!t) return;
    audio.play('ui');
    if (t.dataset.close !== undefined) { ui.close(); return; }
    if (t.dataset.tab) { tab = t.dataset.tab; renderMenu(); return; }
    const it = items[+t.dataset.i]; if (!it || it.type === 'slider') return;
    await it.act(); saveSettings();
    if (G.ui.isOpen()) { const keep = +t.dataset.i; renderMenu(); const el = menuEl.querySelector(`[data-i="${keep}"]`); if (el && nav) nav.focus(el); }
  };
  menuEl.oninput = (e) => { const it = items[+e.target.dataset.i]; if (it && it.set) { it.set(e.target.value / 20); saveSettings(); } };
  if (nav) nav.stop();
  nav = window.GS3Console ? GS3Console.nav(menuEl, { back: () => ui.close() }) : null;
}

export const ui = {
  vrMenuOpen: false,
  init(root) {
    root.insertAdjacentHTML('beforeend', `
      <div id="hud"><div id="loopinfo"></div><div id="fps"></div></div>
      <div id="cross"></div><div id="hint"></div><div id="toast"></div>
      <div class="gs3-screen" id="menu" hidden></div>
      <div class="gs3-screen" id="title" hidden></div>`);
    menuEl = $('#menu'); titleEl = $('#title'); hudEl = $('#loopinfo'); hintEl = $('#hint'); toastEl = $('#toast'); fpsEl = $('#fps'); crossEl = $('#cross');
    on('maskOn', () => this.toast(G.loop.mode === 'auto' ? 'The mask is on. Time is looping.' : 'The mask is on. Press record to make a copy.'));
    on('copyMade', () => this.toast(`A copy of you (${G.loop.copies.length})`));
    on('recState', (r) => this.toast(r ? 'Recording...' : 'Recording stopped'));
  },
  isOpen() { return !menuEl.hidden; },
  open(which = tab) {
    if (G.xr) { this.toggleVRMenu(true); return; }
    tab = which; G.paused = true; menuEl.hidden = false; renderMenu();
    if (document.pointerLockElement) document.exitPointerLock();
  },
  close() {
    if (G.xr) { this.toggleVRMenu(false); return; }
    menuEl.hidden = true; G.paused = false; if (nav) { nav.stop(); nav = null; }
    const c = G.renderer.domElement; if (!G.touch && !G.noLock && c.requestPointerLock) { try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* needs a click */ } }
  },
  // title screen
  title({ vr, onPlay, onVR }) {
    titleEl.hidden = false;
    const items = [];
    const draw = () => {
      titleEl.innerHTML = `<div class="gs3-panel"><h1 class="gs3-title">THE MASK</h1>
        <p class="gs3-sub">Put on the mask. Do anything. Then watch yourself do it all again.</p>
        <div class="gs3-menu">
          ${vr ? '<button class="gs3-item" data-a="vr">Play in VR<span class="gs3-value">Quest</span></button>' : ''}
          <button class="gs3-item" data-a="play">Play${vr ? ' on the screen' : ''}</button>
          <button class="gs3-item" data-a="mic">Copies say what you said<span class="gs3-value">${S.voice && voice.on ? 'On' : voice.denied ? 'Mic blocked' : S.voice ? 'Tap to allow mic' : 'Off'}</span></button>
          <button class="gs3-item" data-a="settings">Settings</button>
          <button class="gs3-item" data-a="help">How to play</button>
        </div></div>`;
      if (nav) nav.stop();
      nav = window.GS3Console ? GS3Console.nav(titleEl, {}) : null;
    };
    draw(); void items;
    titleEl.onclick = async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      audio.init(); audio.play('ui');
      const a = b.dataset.a;
      if (a === 'play' || a === 'vr') {
        titleEl.hidden = true; if (nav) { nav.stop(); nav = null; }
        if (S.voice && !voice.on && a === 'play') voice.enable();
        a === 'vr' ? onVR() : onPlay();
      } else if (a === 'mic') { if (S.voice && voice.on) { S.voice = false; voice.disable(); } else { S.voice = true; await voice.enable(); } saveSettings(); draw(); }
      else { titleEl.hidden = true; tab = a; menuEl.hidden = false; renderMenu(); const back = menuEl.querySelector('[data-close]'); back.textContent = 'Back'; back.onclick = (ev) => { ev.stopPropagation(); menuEl.hidden = true; nav && nav.stop(); this.title({ vr, onPlay, onVR }); }; }
    };
  },
  toast(msg, sec = 2.6) {
    toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => toastEl.classList.remove('on'), sec * 1000);
    vrCard.toast(msg, sec);
  },
  hint(msg) { if (msg === lastHint) return; lastHint = msg; hintEl.textContent = msg; hintEl.classList.toggle('on', !!msg); vrCard.hint(msg); },
  // spawn from the menu (or again with F / B)
  async spawn(what) {
    const P = G.player; P.lastSpawn = what;
    if (what.kind === 'gadget') {
      if (G.xr) {
        const h = !P.hands[1].gadget && !P.hands[1].held ? P.hands[1] : !P.hands[0].gadget && !P.hands[0].held ? P.hands[0] : null;
        if (h) P.equip(h, G.gadgets.spawn(what.id, h.pos.clone())); else { const { p } = P.spawnFront(0.8); G.gadgets.spawn(what.id, p.setY(1.0)); }
      } else P.takeOut(P.hands[1], what.id);
      this.toast(GADGETS.find((g) => g.id === what.id).name);
    } else if (what.kind === 'person') {
      const { p, yaw } = P.spawnFront(1.8); const who = G.people.spawn(what.id, p, yaw);
      this.toast(PEOPLE.find((x) => x[0] === what.id)[1] + (G.xr ? '' : '  (F: another one)'));
      void who;
    } else {
      const { p, yaw } = P.spawnFront(1.3); p.y = 0.9; const c = CATALOG.find((x) => x.id === what.id);
      await G.props.spawn(what.id, p, yaw);
      this.toast(c.name + (G.xr ? '' : '  (F: another one)'));
    }
    if (!G.xr && this.isOpen()) this.close();
  },
  cycleGadget(h) {
    const cur = h.gadget ? GADGET_IDS.indexOf(h.gadget.gid) + 1 : 0, n = (cur + 1) % (GADGET_IDS.length + 1);
    if (n === 0) G.player.holster(h); else G.player.takeOut(h, GADGET_IDS[n - 1]);
  },
  // every frame: HUD text, hints, crosshair, VR panel
  update(dt, fps) {
    const L = G.loop;
    let info = '';
    if (!G.wearing) info = '';
    else if (L.mode === 'auto') info = `LOOP ${fmt(L.loopT)} / ${fmt(S.loopLen)}   ·   ${L.copies.length} ${L.copies.length === 1 ? 'copy' : 'copies'}`;
    else info = (L.recording ? `REC ${fmt(L.recT)}` : 'Record mode') + `   ·   ${L.copies.length} ${L.copies.length === 1 ? 'copy' : 'copies'}`;
    hudEl.textContent = info; hudEl.classList.toggle('rec', L.mode === 'record' && L.recording);
    fpsEl.textContent = S.showFps ? Math.round(fps) + ' FPS' : '';
    // what to do next
    const P = G.player; let h = '';
    if (!G.wearing) {
      const held = P.hands.some((x) => x.held && x.held.special === 'mask');
      h = G.xr ? (held ? 'Bring the mask to your face' : 'Grab the mask on the table (grip)') : G.touch ? 'Look at the mask on the table and tap Grab' : (held ? '' : 'Look at the mask on the table and press E');
    } else if (!L.copies.length) h = L.mode === 'auto' ? (G.xr ? 'Do something! When your watch goes round, a copy of you appears' : 'Do something! When the clock goes round, a copy of you appears') : (G.xr ? 'Press A to record, A again to stop' : 'Press R to record, R again to stop');
    else if (!this.usedMenu) h = G.xr ? 'Press Y for the menu: spawn people and gadgets' : G.touch ? 'Tap Menu to spawn people and gadgets' : 'Press Tab to spawn people and gadgets';
    this.hint(G.started && !G.paused ? h : '');
    // crosshair: shows when you can grab what you look at
    if (!G.xr && G.started) {
      crossEl.hidden = false;
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(P.headQuat);
      if ((this._ct = (this._ct || 0) + dt) > 0.1) {
        this._ct = 0;
        const hit = G.hitTest(P.headPos, f, 2.6, 'you');
        crossEl.classList.toggle('grab', !!(hit && hit.ent && hit.ent.kind !== 'copy' && !P.hands.some((x) => x.held)));
      }
    } else crossEl.hidden = true;
    vrCard.update(dt);
    if (this.vrMenuOpen) vrPanel.update();
  },
  /* ---------- VR ---------- */
  toggleVRMenu(force) {
    this.vrMenuOpen = force !== undefined ? force : !this.vrMenuOpen;
    if (this.vrMenuOpen) { vrPanel.show(); this.usedMenu = true; } else vrPanel.hide();
    audio.play(this.vrMenuOpen ? 'ui' : 'ui_back');
  },
  vrPointer(o, d, click) { vrPanel.pointer(o, d, click); },
  buildVR(scene) { vrPanel.build(scene); vrCard.build(); }
};
function fmt(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }

/* ---------- VR: the same menus on a floating panel, pointed at with the right controller ---------- */
const PW = 1024, PH = 760, PM = 0.86; // canvas px, meters wide
const vrPanel = window.__vrPanel = {
  build(scene) {
    this.c = document.createElement('canvas'); this.c.width = PW; this.c.height = PH; this.k = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PM, PM * PH / PW), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, fog: false, toneMapped: false }));
    this.mesh.visible = false; this.mesh.renderOrder = 20; scene.add(this.mesh);
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]);
    this.laser = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x9fe8e0, transparent: true, opacity: 0.8 })); this.laser.visible = false; scene.add(this.laser);
    this.dot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); this.dot.visible = false; scene.add(this.dot);
    this.tab = 'spawn'; this.hover = -1; this.rects = []; this.ray = new THREE.Raycaster(); this.scroll = 0;
  },
  show() {
    const P = G.player, f = new THREE.Vector3(0, 0, -1).applyQuaternion(P.headQuat); f.y = 0; f.normalize();
    this.mesh.position.copy(P.headPos).addScaledVector(f, 0.85); this.mesh.position.y -= 0.12;
    this.mesh.lookAt(P.headPos.x, this.mesh.position.y + 0.05, P.headPos.z);
    this.mesh.visible = true; this.dirty = true;
  },
  hide() { this.mesh.visible = false; this.laser.visible = false; this.dot.visible = false; },
  update() { if (this.dirty) this.draw(); },
  pointer(o, d, click) {
    this.ray.set(o, d);
    const hit = this.ray.intersectObject(this.mesh, false)[0];
    this.laser.visible = true; this.laser.position.copy(o);
    this.laser.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d); this.laser.scale.z = hit ? hit.distance : 1.5;
    this.dot.visible = !!hit;
    let h = -1;
    if (hit) {
      this.dot.position.copy(hit.point).addScaledVector(d, -0.003); this.dot.quaternion.copy(this.mesh.quaternion);
      const x = hit.uv.x * PW, y = (1 - hit.uv.y) * PH; this.lastXY = [x, y];
      h = this.rects.findIndex((r) => x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6);
      if (click && h >= 0) { this.press(this.rects[h], x); }
      if (this.rects[h] && this.rects[h].slider && G.player.hands[1].trigDown) this.press(this.rects[h], x);
    }
    if (h !== this.hover) { this.hover = h; this.dirty = true; if (h >= 0) G.player.haptic(1, 0.15, 12); }
  },
  async press(r, x) {
    if (r.tab) { this.tab = r.tab; this.scroll = 0; audio.play('ui'); }
    else if (r.close) { ui.toggleVRMenu(false); return; }
    else if (r.scroll) { this.scroll = Math.max(0, this.scroll + r.scroll); audio.play('ui'); }
    else if (r.slider) { r.it.set(clamp((x - r.sx) / r.sw, 0, 1)); saveSettings(); }
    else if (r.it) { audio.play('ui'); G.player.haptic(1, 0.3, 20); await r.it.act(); saveSettings(); }
    this.dirty = true;
  },
  draw() {
    this.dirty = false;
    const k = this.k, th = window.GS3Console ? GS3Console.theme() : {}, font = th.font || 'sans-serif';
    const text = th.text || '#f3f4f7', text2 = th.text2 || 'rgba(243,244,247,.66)', panel = th.panel || 'rgba(24,26,32,.96)';
    const btn = th.button || 'rgba(255,255,255,.1)', focus = th.focus || '#fff', focusText = th.focusText || '#0b0c10';
    k.clearRect(0, 0, PW, PH);
    rr(k, 0, 0, PW, PH, 28); k.fillStyle = panel; k.fill();
    this.rects = [];
    // tabs
    let x = 24;
    k.font = `600 26px ${font}`; k.textBaseline = 'middle';
    for (const [id, n] of TABS) {
      const w = k.measureText(n).width + 44, r = { x, y: 22, w, h: 56, tab: id };
      const hov = this.rects.length === this.hover;
      rr(k, x, 22, w, 56, 28); k.fillStyle = id === this.tab || hov ? focus : btn; k.fill();
      k.fillStyle = id === this.tab || hov ? focusText : text; k.fillText(n, x + 22, 51);
      this.rects.push(r); x += w + 12;
    }
    { const r = { x: PW - 78, y: 22, w: 56, h: 56, close: true }; const hov = this.rects.length === this.hover; rr(k, r.x, r.y, 56, 56, 28); k.fillStyle = hov ? focus : btn; k.fill(); k.strokeStyle = hov ? focusText : text; k.lineWidth = 4; k.beginPath(); k.moveTo(r.x + 18, r.y + 18); k.lineTo(r.x + 38, r.y + 38); k.moveTo(r.x + 38, r.y + 18); k.lineTo(r.x + 18, r.y + 38); k.stroke(); this.rects.push(r); }
    const items = pageItems(this.tab);
    const top = 100, bottom = PH - 24;
    if (this.tab === 'spawn') {
      const cols = 4, cw = (PW - 48 - 12 * (cols - 1)) / cols, chh = 58;
      let y = top - this.scroll, c = 0;
      for (const it of items) {
        if (it.type === 'head') { if (c) { y += chh + 10; c = 0; } if (y > top - 40 && y < bottom - 20) { k.font = `600 22px ${font}`; k.fillStyle = text2; k.fillText(it.label, 28, y + 18); } y += 40; continue; }
        const rx = 24 + c * (cw + 12);
        if (y >= top - 2 && y + chh <= bottom) {
          const hov = this.rects.length === this.hover;
          rr(k, rx, y, cw, chh, 14); k.fillStyle = hov ? focus : btn; k.fill();
          k.font = `600 23px ${font}`; k.fillStyle = hov ? focusText : text; k.fillText(it.label, rx + 18, y + chh / 2, cw - 30);
          this.rects.push({ x: rx, y, w: cw, h: chh, it });
        }
        c++; if (c === cols) { c = 0; y += chh + 10; }
      }
      const full = y + chh + this.scroll - top;
      if (full > bottom - top) this.scrollButtons(k, full - (bottom - top), font, text, btn, focus, focusText);
    } else {
      let y = top;
      for (const it of items) {
        const hov = this.rects.length === this.hover;
        if (it.type === 'text') { k.font = `400 22px ${font}`; k.fillStyle = text2; y = wrap(k, it.label, 28, y + 16, PW - 56, 30) + 16; continue; }
        const h = 58;
        rr(k, 24, y, PW - 48, h, 14); k.fillStyle = hov && it.type !== 'slider' ? focus : 'rgba(255,255,255,0.04)'; k.fill();
        k.font = `600 24px ${font}`; k.fillStyle = hov && it.type !== 'slider' ? focusText : text; k.fillText(lbl(it), 44, y + h / 2);
        if (it.type === 'slider') {
          const sx = PW - 380, sw = 320, v = it.get();
          rr(k, sx, y + h / 2 - 5, sw, 10, 5); k.fillStyle = 'rgba(255,255,255,0.18)'; k.fill();
          rr(k, sx, y + h / 2 - 5, sw * v, 10, 5); k.fillStyle = th.accent || '#6aa8ff'; k.fill();
          k.beginPath(); k.arc(sx + sw * v, y + h / 2, hov ? 17 : 14, 0, 7); k.fillStyle = '#fff'; k.fill();
          this.rects.push({ x: sx - 20, y, w: sw + 40, h, it, slider: true, sx, sw });
        } else {
          if (it.value) { k.font = `400 22px ${font}`; k.fillStyle = hov ? focusText : text2; const v = it.value(); k.fillText(v, PW - 44 - k.measureText(v).width, y + h / 2); }
          this.rects.push({ x: 24, y, w: PW - 48, h, it });
        }
        y += h + 8;
      }
    }
    this.tex.needsUpdate = true;
  },
  scrollButtons(k, max, font, text, btn, focus, focusText) {
    this.scroll = Math.min(this.scroll, max);
    for (const [dy, label, y] of [[-200, 'Up', PH - 88], [200, 'Down', PH - 88]]) {
      const x = dy < 0 ? PW - 300 : PW - 160, r = { x, y, w: 130, h: 56, scroll: dy };
      const hov = this.rects.length === this.hover;
      rr(k, x, y, 130, 56, 28); k.fillStyle = hov ? focus : btn; k.fill();
      k.font = `600 24px ${font}`; k.fillStyle = hov ? focusText : text; k.fillText(label, x + 65 - k.measureText(label).width / 2, y + 28);
      this.rects.push(r);
    }
  }
};
function rr(k, x, y, w, h, r) { k.beginPath(); k.moveTo(x + r, y); k.arcTo(x + w, y, x + w, y + h, r); k.arcTo(x + w, y + h, x, y + h, r); k.arcTo(x, y + h, x, y, r); k.arcTo(x, y, x + w, y, r); k.closePath(); }
function wrap(k, s, x, y, w, lh) {
  let line = '';
  for (const word of s.split(' ')) { const t = line ? line + ' ' + word : word; if (k.measureText(t).width > w && line) { k.fillText(line, x, y); y += lh; line = word; } else line = t; }
  k.fillText(line, x, y); return y;
}

/* ---------- VR: a little card above your left wrist with the hint / last message ---------- */
const vrCard = {
  build() {
    this.c = document.createElement('canvas'); this.c.width = 512; this.c.height = 160; this.k = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.0625), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, fog: false, depthTest: false }));
    this.mesh.renderOrder = 30; this.mesh.visible = false;
    G.player.hands[0].frame.add(this.mesh); this.mesh.position.set(0.0, 0.07, 0.03); this.mesh.rotation.set(-0.5, 0, 0);
    this.msg = ''; this.hintMsg = ''; this.tt = 0;
  },
  toast(m, sec) { this.msg = m; this.tt = sec; this.draw(); },
  hint(m) { this.hintMsg = m; this.draw(); },
  draw() {
    if (!this.k) return;
    const k = this.k, s = this.tt > 0 ? this.msg : this.hintMsg;
    k.clearRect(0, 0, 512, 160);
    if (s) {
      rr(k, 4, 4, 504, 152, 26); k.fillStyle = 'rgba(20,16,22,0.86)'; k.fill();
      k.fillStyle = '#f6edd8'; k.font = '600 30px ' + ((window.GS3Console && GS3Console.theme().font) || 'sans-serif'); k.textBaseline = 'middle';
      wrap(k, s, 24, s.length > 34 ? 52 : 80, 464, 38);
    }
    this.tex.needsUpdate = true;
    this.mesh.visible = G.xr && !!s;
  },
  update(dt) { if (this.tt > 0) { this.tt -= dt; if (this.tt <= 0) this.draw(); } if (this.mesh) this.mesh.visible = G.xr && !!(this.tt > 0 ? this.msg : this.hintMsg); }
};
