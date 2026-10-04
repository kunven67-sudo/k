// SHRINKBOX - a realistic shrinking sandbox. Boot + the main game loop.
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { initPhysics, world, step as physicsStep, setLengthUnit, R as RAPIER_NS, handleToThing } from './core/physics.js';
import * as PH from './core/physics.js';
import { input } from './core/input.js';
import { initAudio, resumeAudio, setEnclosure, sfx } from './core/audio.js';
import { settings } from './core/settings.js';
import { UI } from './ui/ui.js';
import { Player, BASE_H } from './player/player.js';
import { MicroWorld, MU, ENTER_H, EXIT_H, MICRO_MIN_H, microKind } from './world/micro.js';
import { MAX_S } from './player/watch.js';
import { Avatar, ViewModel, LOOK_DEFAULT } from './player/avatar.js';
import { Watch } from './player/watch.js';
import { things } from './world/thing.js';
import { buildBedroom } from './world/bedroom.js';
import { buildVillage } from './world/village.js';
import { Person, reply } from './world/people.js';
import { buildOutside, updateOutside } from './world/outside.js';
import { buildXbox } from './world/objects/xbox.js';
import { buildSodaCan } from './world/objects/sodacan.js';
import { buildController } from './world/objects/controller.js';
import { buildPhone } from './world/objects/phone.js';
import { buildTV } from './world/objects/tv.js';
import { Saves } from './game/saves.js';
import { Tools } from './game/tools.js';
import { Spawner, catalog, CATEGORIES } from './game/spawner.js';

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
    this.unit = 1;      // world units per meter (1 in the room, 10000 in the germ world)
    this.micro = null;
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
    this.people = [];
    this.village = buildVillage(this);
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
    this.tools = new Tools(this);
    this.spawner = new Spawner(this);
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
    this.inside = this.micro ? this.microInside : null; this.insideEcho = 0;
    p.inLiquid = null;
    for (const t of things) t.update(STEP, this);
    for (const pp of this.people) pp.update(STEP);
    if (this.micro) this.micro.preStep(p);
    p.update(STEP);
    if (this.micro) this.micro.update(STEP, p);
    setLengthUnit(Math.max(0.0005, Math.min(1, this.realS())));
    physicsStep();
    this.checkMicro();
  }

  realS() { return this.player.s / this.unit; }

  // ---- talking to people ----
  personInView() {
    if (this.tools.heldPerson) return this.tools.heldPerson;
    const p = this.player, cam = this.engine.camera;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = null, bestScore = Infinity;
    for (const pp of this.people) {
      const d = pp.feet.clone().add(new THREE.Vector3(0, pp.height * 0.8, 0)).sub(cam.position);
      const dist = d.length();
      if (dist > pp.height * 40 + p.height * 3) continue;
      const ang = fwd.angleTo(d.normalize());
      if (ang > 0.6) continue;
      const score = dist * (1 + ang * 3);
      if (score < bestScore) { bestScore = score; best = pp; }
    }
    return best;
  }
  startTalk() {
    const pp = this.personInView();
    if (!pp) { this.ui.toast('💬 Get closer to someone and look at them to talk', 2); return; }
    this.ui.openChat((text) => {
      this.ui.toast(`🗨️ You: ${text}`, 3);
      pp.talking = 8; pp.wave = text.match(/\b(hi|hello|hey|yo|wsp)\b/i) ? 2 : 0;
      const ratio = this.player.height / pp.height;
      setTimeout(() => pp.say(reply(pp, text, { ratio, held: pp.held, sameSize: ratio < 3 && this.time - (this.watch.lastChange ?? -99) < 30 })), 500 + Math.random() * 500);
    });
  }
  speak(text, person) {
    if (!window.speechSynthesis) return;
    const d = person.feet.distanceTo(this.macroFeet());
    const hear = person.height * 60 + this.player.height / this.unit * 0.6;
    if (d > hear || this.micro) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.pitch = Math.min(2, person.voicePitch); u.rate = 1.12; u.volume = settings.volume * Math.max(0.2, 1 - d / hear);
      const voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith('en'));
      if (voices.length) u.voice = voices[Math.floor(person.voicePitch * 97) % voices.length];
      speechSynthesis.speak(u);
    } catch { /* no voice */ }
  }
  macroFeet() { return this.micro ? this.microAnchor.point : this.player.feet; }

  sizeLimits() {
    if (this.micro) return { min: MICRO_MIN_H * MU / BASE_H, max: 1e9, msg: '🦠 You are as small as a bacterium now! (molecules + atoms come in a later update)' };
    return { min: ENTER_H * 0.97 / BASE_H, max: MAX_S, msg: '🔬 Stand on something solid to shrink into the germ world' };
  }

  checkMicro() {
    const p = this.player, real = p.height / this.unit;
    if (!this.micro && real < ENTER_H && p.grounded) this.enterMicro();
    else if (this.micro && real > EXIT_H) this.exitMicro();
  }

  rig() { return [this.watch.light, this.watch.sparks, this.avatar.root]; }

  enterMicro() {
    const p = this.player;
    const c = p.center(new THREE.Vector3());
    const ray = new RAPIER_NS.Ray(c, { x: 0, y: -1, z: 0 });
    const hit = world.castRayAndGetNormal(ray, p.height * 2, true, RAPIER_NS.QueryFilterFlags.EXCLUDE_SENSORS, p.moveGroups, p.collider);
    if (!hit) return;
    const thing = handleToThing.get(hit.collider.handle);
    const kind = microKind(hit.collider, thing);
    const point = c.clone(); point.y -= hit.timeOfImpact;
    const DIRT = { carpet: 0.6, fabric: 0.85, plastic: 0.6, glass: 0.8, metal: 0.45, pcb: 0.35, wood: 0.3, paint: 0.2, paper: 0.4, food: 0.6, liquid: 0 };
    const dirt = thing && thing.dirt !== null && thing.dirt !== undefined ? thing.dirt : DIRT[kind] ?? 0.4;
    const lit = this.roomLight.on || this.lamp.on;
    const brightness = this.inside ? 0.03 : lit ? 0.9 : Math.max(0.1, this.engine.daylight || 0);
    this.microInside = this.inside;
    this.micro = new MicroWorld(this, { point, kind, dirt, thing, brightness });
    const sp = this.micro.spawnPoint();
    this.microAnchor = { point: point.clone(), spawn: sp.clone() };
    p.vel.multiplyScalar(MU);
    this.unit = MU;
    p.useWorld(this.micro.world, sp, p.s * MU);
    p.grounded = false;
    this.micro.terrain.rebuild(sp.x, sp.z, p.height);
    this.engine.setScene(this.micro.scene, this.rig());
    this.ui.flash(0.5);
    const names = { carpet: 'carpet fibres', fabric: 'bed sheet threads', plastic: 'plastic', glass: 'glass', metal: 'metal', pcb: 'circuit board', wood: 'wood', paint: 'wall paint', paper: 'cardboard', food: 'food', liquid: 'soda surface' };
    this.ui.toast(`🔬 Germ world: you're on the ${names[kind]} at ${(ENTER_H * 1000).toFixed(2)} mm tall` + (dirt > 0.3 ? ' · it\'s dirty here 🦠' : ''), 5);
  }

  exitMicro() {
    const p = this.player, a = this.microAnchor;
    const disp = p.feet.clone().sub(a.spawn).divideScalar(MU);
    const feet = new THREE.Vector3(a.point.x + disp.x, a.point.y + 0.00002, a.point.z + disp.z);
    p.vel.divideScalar(MU);
    this.unit = 1;
    p.useWorld(world, feet, p.s / MU);
    this.engine.setScene(this.engine.scene, this.rig());
    this.micro.dispose(); this.micro = null;
    this.ui.flash(0.4);
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
      if (this.panelOpen) this.ui.closePanel?.();
      else if (this.playing) this.ui.openMenu('pause'); else if (this.ui.menuEl) this.ui.closeMenu();
    }
    if (this.playing) {
      this.time += dt;
      // interact
      const it = this.tools.held ? null : this.findInteractable();
      let prompt = it ? `<kbd>E</kbd>${typeof it.name === 'function' ? it.name() : it.name}` : null;
      if (!prompt && this.tools.tool === 'hands') {
        if (this.tools.held) prompt = `<kbd>E</kbd>drop · <kbd>Click</kbd>throw · <kbd>R</kbd>spin`;
        else { const h = p.aim(2.2 * p.s); if (h && h.thing && h.thing.type === 'dynamic') prompt = `<kbd>E</kbd>pick up ${h.thing.name}`; }
      }
      this.ui.prompt(prompt);
      this.usedInteractThisFrame = false;
      if (it && input.pressed('use')) { it.use(); this.usedInteractThisFrame = true; }
      if (input.pressed('spawn')) this.ui.openSpawnMenu(CATEGORIES, catalog(), this.spawner);
      if (input.pressed('talk')) this.startTalk();
      this.watch.update(dt);
      this.tools.update(dt);
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 4) { this.tick(); this.acc -= STEP; n++; }
      if (n === 4) this.acc = 0;
      for (const t of things) t.sync();
      setEnclosure(!!this.inside, this.insideEcho || (this.inside ? 0.4 : 0));
      this.ui.update(dt);
    }
    this.ui.updateBubbles(this.engine.camera);
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
    const day = this.engine.updateDaylight(this.micro ? this.microAnchor.point : p.center(new THREE.Vector3()), this.realS());
    updateOutside(this, day);
    // inside something (Xbox, wall, phone...) the sky/room bounce light can't reach you: much darker
    if (this.inside && !this.micro) { this.engine.sky.intensity *= 0.12; this.engine.scene.environmentIntensity *= 0.12; }
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
void settings; void PH;
