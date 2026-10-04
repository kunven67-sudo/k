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
import { BodyWorld } from './world/body.js';
import { NanoWorld, NU, NANO_MIN_H, NANO_EXIT_H } from './world/nano.js';
import { MAX_S } from './player/watch.js';
import { Avatar, ViewModel, LOOK_DEFAULT } from './player/avatar.js';
import { Watch } from './player/watch.js';
import { things, Thing } from './world/thing.js';
import { buildBedroom } from './world/bedroom.js';
import { buildHouse } from './world/house.js';
import { furnishHouse } from './world/furniture.js';
import { buildVillage } from './world/village.js';
import { Person, reply } from './world/people.js';
import { buildParents, parentReply } from './world/parents.js';
import { buildOutside, updateOutside } from './world/outside.js';
import { buildXbox } from './world/objects/xbox.js';
import { buildSodaCan } from './world/objects/sodacan.js';
import { buildController } from './world/objects/controller.js';
import { buildPhone } from './world/objects/phone.js';
import { buildTV } from './world/objects/tv.js';
import { Saves } from './game/saves.js';
import { LightPool } from './core/lightpool.js';
import { Economy } from './game/economy.js';
import { PhoneUI } from './ui/phoneui.js';
import { Pets } from './world/pets.js';
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
    this.lightPool = new LightPool(this.engine.scene, 3, 6);
    buildBedroom(this);
    buildHouse(this);
    furnishHouse(this);
    this.people = [];
    this.village = buildVillage(this);
    buildParents(this);
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
    this.economy = new Economy(this);
    this.phoneUI = new PhoneUI(this);
    this.pets = new Pets(this);
    this.quakeT = 600 + Math.random() * 1800;
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
    else if (!this.started) {
      this.ui.toast('⌚ Yesterday you found this strange watch in an old crate in the basement...', 6);
      setTimeout(() => this.ui.toast('🕹️ WASD to move · hold <kbd>F</kbd> to shrink · hold <kbd>G</kbd> to grow', 7), 2500);
    }
    this.started = true;
  }

  applyLook() {
    this.avatar.setLook(this.look);
    this.viewModel.setLook(this.look);
    try { localStorage.setItem(LOOK_KEY, JSON.stringify(this.look)); } catch { /* ignore */ }
  }

  // holding F at the watch's limit in the germ world: break the rule and go to the ATOMS
  onMinHold(t) {
    if (!this.micro || this.nano) return;
    if (t > 1.5 && !this._nanoWarn) { this._nanoWarn = true; this.ui.toast('⚠️ The watch flashes RED: "Prototype 7 - DO NOT use below 1.5 µm". Keep holding F...', 5); sfx.beep(400, 0.3, 0.3); }
    if (t > 4.5) this.enterNano();
  }
  enterNano() {
    const p = this.player;
    this.nanoAnchor = { feet: p.feet.clone() };
    this.nano = new NanoWorld(this, this.micro.kind);
    const k = NU / MU, sp = this.nano.spawnPoint();
    p.vel.set(0, 0, 0);
    p.useWorld(this.nano.world, sp, p.s * k);
    this.unit = NU;
    this.nano.rebuildGround(sp.x, sp.z, p.height);
    this.engine.setScene(this.nano.scene, this.rig());
    this.ui.flash(0.9); sfx.zap(0.6);
    this.ui.toast('⚛️ THE MOLECULE WORLD. The blue + red things zooming past are air molecules (N₂ and O₂) - for real they fly at 500 m/s. Keep shrinking to see atoms.', 8);
  }
  exitNano() {
    const p = this.player, k = NU / MU;
    p.vel.set(0, 0, 0);
    p.useWorld(this.micro.world, this.nanoAnchor.feet.clone(), p.s / k);
    this.unit = MU;
    this.engine.setScene(this.micro.scene, this.rig());
    this.nano.dispose(); this.nano = null; this._nanoWarn = false;
    this.ui.flash(0.4);
  }

  leaveElsewhere() {
    if (this.nano) this.exitNano();
    if (this.body) { const b = this.body; this.body = null; this.player.useWorld(world, this.bodyAnchor.point.clone(), this.player.s); this.engine.setScene(this.engine.scene, this.rig()); b.dispose(); }
    if (this.micro) this.exitMicro();
  }

  knockedOut(why) {
    if (this.dead) return;
    this.dead = true;
    this.leaveElsewhere();
    const bill = { fall: 1850, fan: 640, burn: 920, 'electric shock': 2400 }[why] || 1200;
    this.ui.fade(true);
    setTimeout(() => {
      const p = this.player;
      p.setScale(1); p.feet.set(...this.spawn.pos); p.vel.set(0, 0, 0); p.health = 100;
      this.economy.add(-bill, `Hospital bill (${why})`);
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
    this.pets.update(STEP);
    if (this.micro && !this.nano) this.micro.preStep(p);
    if (this.body) this.body.preStep(p);
    p.update(STEP);
    if (this.nano) this.nano.update(STEP, p);
    else if (this.micro) this.micro.update(STEP, p);
    if (this.body) this.body.update(STEP, p);
    else if (!this.micro) this.checkBodyEntry();
    setLengthUnit(Math.max(0.0005, Math.min(1, this.realS())));
    physicsStep();
    this.checkMicro();
  }

  realS() { return this.player.s / this.unit; }
  get elsewhere() { return !!(this.micro || this.body); } // the player is in the germ world or inside a body
  allThings() { return things; }

  // west coast: small earthquakes happen now and then (most are tiny)
  updateQuake(dt) {
    this.quakeT -= dt;
    if (this.quakeT > 0 && !this.quake) return;
    if (!this.quake) { this.quake = { t: 0, len: 4 + Math.random() * 6, mag: 2.3 + Math.random() * 1.6 }; this.ui.toast(`🌎 Earthquake! Magnitude ${this.quake.mag.toFixed(1)}`, 4); }
    const q = this.quake; q.t += dt;
    const k = Math.sin(Math.min(1, q.t / q.len) * Math.PI) * (q.mag - 2) * 0.5;
    this.player.shake = Math.max(this.player.shake, k * 0.7);
    if (Math.random() < 0.5) for (const t of things) if (t.type === 'dynamic' && t.body && Math.random() < 0.15) { const m = t.mass * k * 0.15; t.body.applyImpulse({ x: (Math.random() - 0.5) * m, y: 0, z: (Math.random() - 0.5) * m }, true); }
    if (q.t > q.len) { this.quake = null; this.quakeT = 1800 + Math.random() * 3600; setTimeout(() => this.economy.text('Weather', `Earthquake M${q.mag.toFixed(1)} detected near you. No damage expected.`), 3000); }
  }

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
      const ctx = { ratio, held: pp.held, sameSize: ratio < 3 && this.time - (this.watch.lastChange ?? -99) < 30 };
      setTimeout(() => pp.say(pp.isParent ? parentReply(pp, text, ctx) : reply(pp, text, ctx)), 500 + Math.random() * 500);
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
  macroFeet() { return this.micro ? this.microAnchor.point : this.body ? this.bodyAnchor.point : this.player.feet; }

  sizeLimits() {
    if (this.body) return { min: ENTER_H * 0.97 / BASE_H, max: 0.006 / BASE_H, msg: '🛑 Growing inside a person would seriously hurt them. The watch won\'t allow it.' };
    if (this.nano) return { min: NANO_MIN_H * NU / BASE_H, max: 1e15, msg: '⚛️ You are ONE ATOM tall. This is as small as anything gets.' };
    if (this.micro) return { min: MICRO_MIN_H * MU / BASE_H, max: 1e9, msg: '🦠 You are as small as a bacterium! The watch beeps a warning... keep holding F to go below its limit?' };
    return { min: ENTER_H * 0.97 / BASE_H, max: MAX_S, msg: '🔬 Stand on something solid to shrink into the germ world' };
  }

  checkMicro() {
    const p = this.player, real = p.height / this.unit;
    if (this.body) return;
    if (this.nano) { if (real > NANO_EXIT_H) this.exitNano(); return; }
    if (!this.micro && real < ENTER_H && p.grounded) this.enterMicro();
    else if (this.micro && real > EXIT_H) this.exitMicro();
  }

  rig() { return [this.watch.light, this.watch.sparks, this.avatar.root]; }

  // growing into the ceiling as a giant: CRASH through the roof
  onGrowBlocked(p, t) {
    if (this.elsewhere || this.roofBroken) return;
    if (this.realS() > 1.25 && t > 1.0 && p.feet.y + p.height > 2.3 && p.feet.y > -0.5) this.breakRoof();
  }
  breakRoof() {
    this.roofBroken = true;
    const scene = this.engine.scene;
    // the bedroom ceiling + the attic floor + the roof come apart
    for (const c of this.room.colliders) if (c.part && c.part.pos[1] > 2.45) c.setEnabled(false);
    for (const m of this.room.group.children) if (m.material && m.material.name === 'ceiling') m.visible = false;
    if (this.attic) this.attic.remove(scene);
    if (this.roofMesh) this.roofMesh.visible = false;
    // flying debris: drywall chunks, boards and shingles
    const at = this.player.head(new THREE.Vector3());
    for (let i = 0; i < 18; i++) {
      const d = new Thing({ name: i % 3 ? 'drywall chunk' : 'roof board', type: 'dynamic', density: 600, pos: [at.x + (Math.random() - 0.5) * 2, 2.9 + Math.random() * 0.8, at.z + (Math.random() - 0.5) * 2], rot: [Math.random(), Math.random(), Math.random()], surface: 'paint' });
      d.box(i % 3 ? [0.3 + Math.random() * 0.4, 0.013, 0.2 + Math.random() * 0.3] : [1.2, 0.025, 0.14], [0, 0, 0], i % 3 ? 'ceiling' : 'lightWood');
      d.build(scene); d.spawned = true;
      d.body.setLinvel({ x: (Math.random() - 0.5) * 4, y: 2 + Math.random() * 3, z: (Math.random() - 0.5) * 4 }, true);
    }
    sfx.thud(1, 0.5); setTimeout(() => sfx.thud(1, 0.7), 120); sfx.whoosh(true, 0.8, 1.2);
    this.player.shake = 1; this.ui.flash(0.4);
    this.ui.toast('💥 CRASH! You broke through the roof! Keep growing - the whole neighborhood is out there.', 6);
    for (const pa of this.parents || []) if (!pa.away) pa.say('WHAT WAS THAT?!');
    setTimeout(() => this.economy.text('Mom', 'WHY IS THERE A HOLE IN THE ROOF?!?!'), 6000);
  }

  // ---- the body journey ----
  // breathed in through the nose, or crawling into a sleeping parent's ear (mouth = eating/drinking, see parents.js)
  checkBodyEntry() {
    const p = this.player;
    if (p.height > 0.004 || !this.parents) return;
    const c = p.center(new THREE.Vector3());
    for (const pa of this.parents) {
      if (pa.away || pa.shrunk) continue;
      const f = pa.faceSpots();
      if (c.distanceTo(f.nose) < 0.035) { this.enterBody(pa, 'nose'); return; }
      if (c.distanceTo(f.ear) < 0.02) { this.enterBody(pa, 'ear'); return; }
    }
  }
  enterBody(parent, entry) {
    const p = this.player;
    this.bodyAnchor = { point: p.feet.clone(), parent };
    this.body = new BodyWorld(this, parent, entry);
    const sp = this.body.spawnPoint();
    p.vel.set(0, 0, 0);
    p.useWorld(this.body.world, sp, p.s);
    p.yaw = entry === 'ear' ? Math.PI / 2 : entry === 'nose' ? Math.PI : Math.PI;
    this.engine.setScene(this.body.scene, this.rig());
    this.watch.lightOn = true;
    this.ui.flash(0.6);
    const msg = { mouth: `😮 ${parent.name} put you in their MOUTH!`, nose: `🌬️ ${parent.name} breathed you in! You\'re in their nose.`, ear: `👂 You crawled into ${parent.name}\'s ear canal.` }[entry];
    this.ui.toast(msg, 5);
    parent.say(entry === 'nose' ? '*sniff* ...weird.' : entry === 'ear' ? '*scratches ear in sleep*' : 'Mm.');
  }
  exitBody(how) {
    const p = this.player, pa = this.bodyAnchor.parent, f = pa.faceSpots();
    const s = p.s;
    let feet, vel = new THREE.Vector3(), msg;
    if (how === 'poop') {
      const tl = this.toilet; feet = tl ? tl.group.localToWorld(new THREE.Vector3(0, 0.205, 0.08)) : p.feet.clone();
      msg = '🚽 ...and out the other end. You\'re in the TOILET. Gross! Climb out before someone flushes!';
      p.sticky = 0.8;
    } else if (how === 'cough') { feet = f.mouth.clone(); vel = f.fwd.clone().multiplyScalar(1.5).add(new THREE.Vector3(0, 0.5, 0)); msg = `😷 ${pa.name} COUGHED you out!`; pa.say('*COUGH COUGH* ...went down the wrong pipe.'); }
    else if (how === 'sneeze') { feet = f.nose.clone(); vel = f.fwd.clone().multiplyScalar(4).add(new THREE.Vector3(0, 1, 0)); msg = `🤧 AH-CHOO! ${pa.name} sneezed you out at 160 km/h!`; pa.say('AH... AH... CHOO!'); sfx.whoosh(false, 0.8, 0.4); }
    else { feet = f.ear.clone(); msg = '👂 You crawled back out of the ear.'; }
    p.useWorld(world, feet, s);
    p.vel.copy(vel);
    this.engine.setScene(this.engine.scene, this.rig());
    this.body.dispose(); this.body = null;
    this.ui.flash(0.5); this.ui.toast(msg, 5);
  }

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
      if (input.pressed('phone')) this.phoneUI.toggle();
      this.economy.update(dt);
      this.updateQuake(dt);
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
    this.lightPool.update(this.micro ? this.microAnchor.point : p.head(new THREE.Vector3()));
    // inside something (Xbox, wall, phone...) the sky/room bounce light can't reach you: much darker
    if (this.inside && !this.micro) { this.engine.sky.intensity *= 0.12; this.engine.scene.environmentIntensity *= 0.12; }
    this.engine.render();
    if (this.takePhoto) { try { this.takePhoto(this.engine.renderer.domElement.toDataURL('image/png')); } catch { /* blocked */ } this.takePhoto = null; }
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
