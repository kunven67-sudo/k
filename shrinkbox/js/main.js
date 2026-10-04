// SHRINKBOX - a realistic shrinking sandbox. Boot + the main game loop.
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { initPhysics, world, step as physicsStep, setLengthUnit } from './core/physics.js';
import { input } from './core/input.js';
import { initAudio, resumeAudio, setEnclosure, sfx } from './core/audio.js';
import { settings } from './core/settings.js';
import { UI } from './ui/ui.js';
import { Player } from './player/player.js';
import { Avatar, ViewModel, LOOK_DEFAULT } from './player/avatar.js';
import { Watch } from './player/watch.js';
import { things } from './world/thing.js';
import { buildBedroom } from './world/bedroom.js';
import { buildOutside, updateOutside } from './world/outside.js';
import { buildXbox } from './world/objects/xbox.js';
import { buildSodaCan } from './world/objects/sodacan.js';
import { buildController } from './world/objects/controller.js';
import { buildPhone } from './world/objects/phone.js';
import { buildTV } from './world/objects/tv.js';
import { Saves } from './game/saves.js';

const STEP = 1 / 60;
const LOOK_KEY = 'shrinkbox.look';

class Game {
  constructor() {
    this.time = 0;
    this.interactables = [];
    this.sfx = sfx;
    this.money = 40;
    this.playing = false;
    this.started = false;
    this.dtAvg = 1 / 60;
    try { this.look = { ...LOOK_DEFAULT, ...JSON.parse(localStorage.getItem(LOOK_KEY) || '{}') }; } catch { this.look = { ...LOOK_DEFAULT }; }
  }

  async boot() {
    this.engine = new Engine(document.getElementById('game'));
    this.ui = new UI(this);
    this.ui.setBoot('starting physics...');
    await initPhysics();
    input.attach(this.engine.renderer.domElement);
    this.ui.setBoot('building your room...');
    await new Promise((r) => setTimeout(r, 30));
    this.spawn = { pos: [-0.45, 0.02, -0.25], yaw: -2.4 };
    buildBedroom(this);
    buildOutside(this);
    this.tv = buildTV(this, [1.15, 0.5, 1.66], Math.PI);
    this.xbox = buildXbox(this, [0.47, 0.5, 1.6], Math.PI);
    this.soda = buildSodaCan(this, [-0.22, 0.575, -1.64]);
    this.phone = buildPhone(this, [-0.1, 0.575, -1.47], 0.2);
    this.controller = buildController(this, [1.25, 0.6, -0.15], 2.6);
    this.player = new Player(this, this.spawn);
    this.avatar = new Avatar(this.look);
    this.engine.scene.add(this.avatar.root);
    this.viewModel = new ViewModel(this.look);
    this.engine.camera.add(this.viewModel.root);
    this.watch = new Watch(this);
    this.saves = new Saves(this);
    // night? turn the light on so you're not in the dark
    if (this.engine.updateDaylight(new THREE.Vector3(), 1) < 0.3) this.setRoomLight(true);
    // settle physics so things rest naturally
    for (let i = 0; i < 30; i++) world.step();
    for (const t of things) t.sync();
    this.ui.hideBoot();
    this.ui.openMenu('home');
    addEventListener('pointerdown', () => { initAudio(); resumeAudio(); }, { once: false });
    addEventListener('keydown', () => { initAudio(); resumeAudio(); });
    this.last = performance.now();
    this.acc = 0;
    this.engine.renderer.setAnimationLoop(() => this.frame());
  }

  startGame(slot, load) {
    this.slot = slot;
    if (load) this.saves.load(slot);
    else if (!this.started) this.ui.toast('🕹️ WASD to move · hold <kbd>F</kbd> to shrink · hold <kbd>G</kbd> to grow', 7);
    this.started = true;
  }

  applyLook() {
    this.avatar.setLook(this.look);
    this.viewModel.setLook(this.look);
    try { localStorage.setItem(LOOK_KEY, JSON.stringify(this.look)); } catch { /* ignore */ }
  }

  knockedOut(why) {
    if (this.dead) return;
    this.dead = true;
    const bill = { fall: 1850, fan: 640, burn: 920, 'electric shock': 2400 }[why] || 1200;
    this.ui.fade(true);
    setTimeout(() => {
      const p = this.player;
      p.setScale(1); p.feet.set(...this.spawn.pos); p.vel.set(0, 0, 0); p.health = 100;
      this.money -= bill;
      this.ui.fade(false);
      this.ui.toast(`🏥 You woke up in the hospital (${why}). The bill: $${bill.toLocaleString()}. Mom drove you home.`, 7);
      this.dead = false;
    }, 1600);
  }

  // one fixed physics step of the whole world
  tick() {
    const p = this.player;
    this.inside = null; this.insideEcho = 0;
    p.inLiquid = null;
    for (const t of things) t.update(STEP, this);
    p.update(STEP);
    setLengthUnit(Math.max(0.0005, Math.min(1, p.s)));
    physicsStep();
  }

  // fast-forward without rendering (used by tests / debugging)
  simulate(seconds) {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) { this.time += STEP; this.tick(); }
    for (const t of things) t.sync();
  }

  // Look at something + press E to use it (light switch, door, power buttons...)
  findInteractable() {
    const p = this.player, s = p.s;
    const reach = 1.9 * s;
    const hit = p.aim(reach * 1.5);
    const cam = this.engine.camera.position;
    let best = null, bestD = Infinity;
    for (const it of this.interactables) {
      let pos = it.pos, k = 1;
      if (it.local && it.thing) { pos = it.thing.group.localToWorld(it.local.clone()); k = it.thing.scale; }
      else if (it.thing && it.thing.type !== 'fixed' && it.pos) { k = it.thing.scale; }
      const r = it.radius * k;
      const dc = cam.distanceTo(pos);
      if (dc > reach + r) continue;
      // must be roughly where you're looking
      const dir = pos.clone().sub(cam).normalize();
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.engine.camera.quaternion);
      const ang = fwd.angleTo(dir);
      if (ang > Math.atan2(r * 1.2, dc) + 0.08) continue;
      if (hit && hit.dist < dc - r * 1.5) continue; // something in the way
      if (dc < bestD) { bestD = dc; best = it; }
    }
    return best;
  }

  frame() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.dtAvg += (dt - this.dtAvg) * 0.05;
    input.poll(dt);
    const p = this.player;
    if (input.pressedAny('pause') && this.started) {
      if (this.playing) this.ui.openMenu('pause'); else if (this.ui.menuEl) this.ui.closeMenu();
    }
    if (this.playing) {
      this.time += dt;
      // interact
      const it = this.findInteractable();
      this.ui.prompt(it ? `<kbd>E</kbd>${typeof it.name === 'function' ? it.name() : it.name}` : null);
      if (it && input.pressed('use')) it.use();
      this.watch.update(dt);
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 4) { this.tick(); this.acc -= STEP; n++; }
      if (n === 4) this.acc = 0;
      for (const t of things) t.sync();
      setEnclosure(!!this.inside, this.insideEcho || (this.inside ? 0.4 : 0));
      this.ui.update(dt);
    }
    // camera + bodies
    p.updateCamera(this.engine.camera, dt);
    const cam = this.engine.camera;
    if (cam.far < 3000 * Math.max(1, p.s)) { cam.far = 3000 * Math.max(1, p.s); cam.updateProjectionMatrix(); }
    const s = p.s;
    this.avatar.root.visible = p.view === 'third';
    this.avatar.root.position.copy(p.feet);
    this.avatar.root.scale.setScalar(s);
    this.avatar.root.rotation.y = p.yaw + Math.PI;
    const hs = Math.hypot(p.vel.x, p.vel.z) / s;
    this.avatar.animate(dt, hs, p.grounded, p.crouchT);
    this.viewModel.root.visible = p.view === 'first' && this.playing;
    this.viewModel.root.scale.setScalar(s);
    this.viewModel.update(dt, this.watch.mode !== 0 || input.held('use') === 'watch', p.headBob, this.time);
    // light & sky
    const day = this.engine.updateDaylight(p.center(new THREE.Vector3()), s);
    updateOutside(this, day);
    this.engine.render();
    input.endFrame();
  }
}

const game = new Game();
window.__game = game; // handy for debugging in the console
import * as PHYS from './core/physics.js';
window.__phys = PHYS;
window.__input = input;
game.boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot-sub'); if (b) b.textContent = 'Error: ' + e.message;
});
void settings;
