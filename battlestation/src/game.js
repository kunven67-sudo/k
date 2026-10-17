import * as THREE from 'three';
import { Renderer } from './core/renderer.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Physics } from './core/physics.js';
import { Interact } from './core/interact.js';
import { buildHouse } from './world/house.js';
import { buildLighting } from './world/lighting.js';
import { roomAt } from './world/layout.js';
import { RoomEnv } from './world/envmap.js';
import { buildDesk } from './world/desk.js';
import { buildBedroom } from './world/bedroom.js';
import { Player } from './player/player.js';
import { Rig } from './pc/rig.js';
import { UI } from './ui.js';
import { Scanner } from './pc/scanner.js';

const $ = id => document.getElementById(id);

export class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.clockOverride = null;
    this.holding = null;
    this.started = false;
  }

  progress(frac, text) {
    $('loadbar').firstElementChild.style.width = Math.round(frac * 100) + '%';
    if (text) $('loadtext').textContent = text;
  }

  now() {
    if (this.clockOverride) return this.clockOverride;
    const t = this.params.get('time');
    if (t) { const d = new Date(); const [h, m] = t.split(':').map(Number); d.setHours(h, m || 0, 0, 0); return d; }
    return new Date();
  }

  async boot() {
    this.progress(0.02, 'Starting the graphics card');
    const canvas = $('view');
    this.renderer = new Renderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 200);
    this.camera.position.set(2.7, 1.6, 3.5);
    this.scene.add(this.camera);
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.physics = new Physics();
    this.interact = new Interact(this.camera);
    this.settings = { sens: 1, seatFov: 60, seatLow: 0.13 };
    this.ui = new UI(this);
    const q = this.params.get('q');
    this.renderer.set(q || this.ui.settings.quality);
    this.renderer.setup(this.scene, this.camera);
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); });

    this.progress(0.1, 'Building the house');
    this.house = await buildHouse(this);
    this.progress(0.3, 'Setting up your desk');
    this.desk = await buildDesk(this);
    this.desk.chair.syncCollider();
    this.progress(0.33, 'Making your bed');
    this.bedroom = await buildBedroom(this);
    this.progress(0.38, 'Making you');
    this.bed = { pelvis: this.bedroom.pelvis.clone(), headDir: new THREE.Vector3(0, 0, 1) };
    this.player = new Player(this);
    await this.player.init();
    this.progress(0.42, 'Turning on the lights');
    this.lights = buildLighting(this, this.house);
    this.bedroom.fan.glow.material = this.lights.glowMat;
    this.lights.rooms.bedroom.glows.push(this.bedroom.fan.glow);
    const lp = this.params.get('lights');
    if (lp !== null) this.lights.setRoom('bedroom', lp === '1');
    this.progress(0.46, 'Plugging in your PC');
    this.rig = new Rig(this);
    this.scanner = new Scanner(this);
    await this.scanner.boot();
    this.wireRoom();
    this.ui.apply();

    this.progress(0.5, 'Letting the light bounce around the room');
    this.env = new RoomEnv(this.renderer.gl, this.scene);
    this.lights.update(this.now(), this.house);
    if (this.params.get('env') !== '0') this.env.all(); // dev: env=0 skips it for quick logic tests
    this.scene.environmentIntensity = 1.0;
    this.progress(1, 'Ready');
    this.last = performance.now();
    $('loading').classList.add('hidden');

    this.wireInput();
    const st = this.params.get('state');
    if (st) this.devState(st);
    else {
      this.player.state = 'bed';
      this.bedroom.setCovered(true, true);
      this.lids(0, 0);
      this.ui.showStart(() => this.wakeUp());
    }
    this.loop();
  }

  devState(st) {
    this.started = true;
    this.input.enabled = true;
    if (st === 'sit') { this.player.state = 'sit'; if (this.params.get('pc') === 'on') this.os.go('desktop'); }
    else if (st === 'bed') { this.player.state = 'bed'; this.bedroom.setCovered(true, true); }
    else if (st === 'walk') { const [x, z, yaw, pitch] = (this.params.get('at') || '3,3,1.57,0').split(',').map(Number); this.player.standAt(x, z, yaw); this.player.pitch = pitch || 0; this.bedroom.setCovered(false, true); }
    else this.player.state = 'none';
    this.devCamera();
  }

  // ------------------------------------------------------------------ waking up
  lids(top, dur) {
    const l = $('lids');
    l.style.setProperty('--lid', dur + 's');
    l.style.setProperty('--lt', (-top * 100) + '%');
    l.style.setProperty('--lb', (top * 100) + '%');
  }

  async wakeUp() {
    this.started = true;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(900);
    this.lids(0.35, 1.8); await wait(2100);
    this.lids(0.05, 0.35); await wait(500);
    this.lids(0.6, 1.2); await wait(1500);
    this.lids(0.1, 0.25); await wait(300);
    this.lids(1, 1.6);
    await wait(1600);
    if (this.player.state === 'bed') this.hint('Press W to get up');
  }

  hint(text, ms = 5000) {
    const h = $('hint');
    h.textContent = text;
    h.classList.add('on');
    clearTimeout(this._hintT);
    if (ms) this._hintT = setTimeout(() => h.classList.remove('on'), ms);
  }

  toast(text, ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove('on'), ms);
  }

  // ------------------------------------------------------------------ room things that need the player
  wireRoom() {
    const it = this.interact, p = this.player, d = this.desk, B = this.bedroom;
    it.add(d.chair.group, { label: () => 'Sit down', range: 2.0, enabled: () => p.state === 'walk', use: () => p.sitDown() });
    it.add(d.keyboard.group, { label: () => 'Sit down', range: 2.0, enabled: () => p.state === 'walk', solid: false, use: () => p.sitDown() });
    it.add(B.sofa, { label: () => 'Sit on the couch', range: 2.2, enabled: () => p.state === 'walk', use: () => p.sitCouch() });
    it.add(this.bedroom.duvet.mesh, { label: () => 'Get in bed', range: 2.2, enabled: () => p.state === 'walk', use: () => p.lieDown() });
  }

  // ------------------------------------------------------------------ input
  wireInput() {
    const inp = this.input, ui = this.ui;
    inp.on('key', (e, down) => this.onKey(e, down));
    inp.on('mouse', (b, down) => this.onMouse(b, down));
    inp.on('wheel', (s) => this.onWheel(s));
    inp.on('lock', (locked) => this.onLock(locked));
    $('view').addEventListener('click', () => { if (this.started && !ui.menuOpen && !inp.locked) ui.lockIn(); });
  }

  onKey(e, down) {
    const ui = this.ui, p = this.player, st = p.state;
    if (e.code === 'F1') { if (down) ui.menuOpen ? ui.closeMenu() : ui.openMenu(); return true; }
    if (ui.menuOpen || !this.started) return true;
    if (st === 'sit') {
      if (ui.seat.hud) {
        if (down && e.code === 'Escape') ui.exitSeatHud();
        if (down && (e.code === 'Enter' || e.code === 'Space')) ui.seatClick();
        return true;
      }
      if (down) { if (!e.repeat) { p.hands.keyDown(e.code, false); this.keySound(e.code); } } else p.hands.keyUp(e.code);
      this.os.key(e, down);
      return true;
    }
    if (e.code === 'Escape' && down) { if (st === 'look') { p.backToPc(); return true; } ui.openMenu(); return true; }
    if (e.code === 'KeyE') this.useKey(down);
    if (down && !e.repeat) {
      if (st === 'bed' && ['KeyW', 'Space', 'KeyA', 'KeyD', 'KeyS'].includes(e.code)) p.getUp();
      else if (st === 'couch' && ['KeyW', 'Space', 'KeyS'].includes(e.code)) p.leaveCouch();
      else if (st === 'look' && ['KeyW', 'KeyS'].includes(e.code)) p.standUp();
    }
    return true;
  }

  onMouse(b, down) {
    const ui = this.ui, p = this.player;
    if (ui.menuOpen || !this.started) return;
    if (p.state === 'sit') {
      if (ui.seat.hud) { if (down && b === 0) ui.seatClick(); return; }
      p.hands.mouseButton(b, down);
      this.os.mouseButton(b, down);
      const m = this.desk.mouse.group.getWorldPosition(new THREE.Vector3());
      this.audio.play(down ? 'mouse_down.ogg' : 'mouse_up.ogg', { pos: m, vol: 0.32, jitter: 0.05, ref: 0.3 });
      return;
    }
    if (b === 0) this.useKey(down);
    if (b === 2 && down && p.state === 'look') p.backToPc();
  }

  onWheel(steps) {
    if (this.ui.menuOpen || this.player.state !== 'sit' || this.ui.seat.hud) return;
    this.player.hands.wheel(steps);
    this.os.wheel(steps);
    const now = performance.now();
    if (now - (this._wheelT || 0) > 45) { this._wheelT = now; this.audio.play('wheel.ogg', { pos: this.desk.mouse.group.getWorldPosition(new THREE.Vector3()), vol: 0.14, jitter: 0.08, ref: 0.3 }); }
  }

  onLock(locked) {
    const ui = this.ui, st = this.player.state;
    if (!this.started) return;
    if (!locked && !ui.menuOpen) {
      // real cursor is free: at the PC that means "show the bar above the screen", anywhere else = pause
      if (st === 'sit' || st === 'look') { ui.exitSeatHud(); ui.setSeatbar('show'); }
      else ui.openMenu('resume');
      for (const code of [...this.input.keys]) this.onKey({ code, key: '', repeat: false, synthetic: true }, false);
      this.input.keys.clear();
    } else if (locked && st === 'sit' && !ui.seat.hud) ui.setSeatbar('hide');
  }

  // the real mouse moving while you sit at the PC
  pcMouse(dx, dy) {
    const ui = this.ui;
    if (ui.seat.hud) { ui.seatHud(dx, dy); return; }
    this.os.mouseMove(dx, dy);
    this.player.hands.mouseMove(dx, dy, this.os.cursor);
    if (this.os.hudEscape > 45) ui.enterSeatHud();
  }

  keySound(code) {
    const kb = this.desk.keyboard;
    const pos = kb.keys[code] ? kb.keyWorld(code) : kb.group.getWorldPosition(new THREE.Vector3());
    const name = code === 'Space' ? 'space.ogg' : (code === 'Enter' || code === 'NumpadEnter') ? 'enter.ogg' : `key${1 + Math.floor(Math.random() * 12)}.ogg`;
    this.audio.play(name, { pos, vol: 0.26, jitter: 0.07, ref: 0.35 });
  }

  // E / left click on what you're looking at. Some things want you to hold.
  useKey(down) {
    if (down) {
      const it = this.interact.current;
      if (!it) return;
      if (it.hold && (!it.hold.enabled || it.hold.enabled())) this.holding = { it, t: 0 };
      else it.use();
    } else if (this.holding) {
      if (!this.holding.done && this.holding.t < 0.45) this.holding.it.use();
      this.holding = null;
    }
  }

  footstep(pos, fast) {
    const room = roomAt(pos.x, pos.z);
    const tile = room === 'kitchen' || room === 'bathroom';
    const n = 1 + Math.floor(Math.random() * 4);
    this.audio.play(tile ? `step_tile${n}.ogg` : `step_wood${n}.ogg`, { pos: pos.clone().setY(0.05), vol: fast ? 0.5 : 0.35, jitter: 0.06 });
  }

  onPlayerState(s, prev) {
    const ui = this.ui;
    $('xhair').style.display = s === 'sit' ? 'none' : '';
    if (s === 'sit') {
      ui.setSeatbar('hide');
      if (!this._sitHint) { this._sitHint = true; this.hint(this.os.on ? 'Your real mouse + keyboard are the PC\'s now. Push the mouse up past the screen to get up.' : 'The PC is off. Push the mouse up past the top of the screen to look around, then press its power button.', 7000); }
    } else if (s === 'look') ui.setSeatbar('show');
    else { ui.exitSeatHud(); ui.setSeatbar('hide'); }
    if (prev === 'sit') { for (const code of [...this.player.hands.held.keys()]) this.player.hands.keyUp(code); }
    if (prev === 'bed' && s !== 'bed') this.bedroom.setCovered(false);
    if (s === 'bed') this.bedroom.setCovered(true);
    $('hint').classList.remove('on');
  }

  devCamera() {
    const c = this.params.get('cam'), l = this.params.get('look');
    if (c) this.camera.position.set(...c.split(',').map(Number));
    if (l) this.camera.lookAt(new THREE.Vector3(...l.split(',').map(Number)));
    const f = this.params.get('fov');
    if (f) { this.camera.fov = +f; this.camera.updateProjectionMatrix(); }
  }

  // dev: render one frame and hand back the picture (headless screenshots)
  snap(type = 'image/png') {
    this.renderer.render();
    return this.renderer.gl.domElement.toDataURL(type, 0.92);
  }

  loop() {
    if (window.__pause) { requestAnimationFrame(() => this.loop()); return; }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.renderer.render();
    this.renderer.track(dt);
    this.frames = (this.frames || 0) + 1;
    if (this.frames === 3) window.__ready = true;
    requestAnimationFrame(() => this.loop());
  }

  update(dt) {
    this.t = (this.t || 0) + dt;
    this.lights.update(this.now(), this.house);
    for (const d of Object.values(this.house.doors)) d.update(dt);
    this.rig.update(dt);
    this.desk.update(dt, this.t, this.os.on && this.os.state !== 'sleep');
    this.bedroom.update(dt);
    const p = this.player;
    if (p.state !== 'none') p.update(dt, this.input);
    if (this.params.get('freecam')) { p.avatar.hideHead(false); this.devCamera(); }
    // what you're looking at (not while your eyes are on the monitors)
    if (p.state !== 'sit' && p.state !== 'none' && !p.trans) {
      const it = this.interact.update();
      if (this.holding) {
        if (this.holding.it !== it) this.holding = null;
        else if (!this.holding.done) {
          this.holding.t += dt;
          if (this.holding.t >= this.holding.it.hold.time) { this.holding.done = true; this.holding.it.hold.done(); }
        }
      }
      this.ui.prompt(it, this.holding?.t);
    } else this.ui.prompt(null);
    for (const w of Object.values(this.house.windows)) w.blinds?.update(dt);
    this.audio.update(this.camera);
    this.ui.update();
    this.room = roomAt(this.camera.position.x, this.camera.position.z) || this.room || 'bedroom';
    this.scene.environment = this.env.update(this.room, this.envDirty);
    this.envDirty = false;
  }
}
