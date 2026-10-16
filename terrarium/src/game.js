// The game: owns every living thing and object, runs the frame, and answers the questions the
// other modules ask (what's under the crosshair, how high is the ground, who's near, etc).
import * as THREE from 'three';
import { World } from './world/world.js';
import { CAGE, NAT } from './world/cage.js';
import { LAB, STAIRS } from './world/lab.js';
import { HOUSE } from './world/house.js';
import { FX } from './fx/fx.js';
import { InstancedSink } from './life/render.js';
import { Person } from './life/person.js';
import { Body, J } from './life/body.js';
import { makeLook, randomName, JOB_KEYS, randomTraits } from './life/looks.js';
import { Item, ITEMS, TINY } from './life/items.js';
import { Bug, BUGS } from './life/bugs.js';
import { Society } from './life/society.js';
import { AI } from './life/ai.js';
import { CageNav } from './life/nav.js';
import { StreetLife, Car } from './life/street.js';
import { Talk } from './talk/talk.js';
import { Gadgets, makeObjectMesh } from './gadgets/gadgets.js';
import { STARTERS, CORES } from './gadgets/parts.js';
import { buildGadgetModel } from './gadgets/model.js';
import { Player } from './player/player.js';
import { settings } from './core/settings.js';
import { sfx, setLoop } from './core/audio.js';
import { actPressed, input } from './core/input.js';
import { rand, clamp, nextId, lerp } from './core/util.js';
import { textTexture } from './world/builder.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const STEP = 1 / 30;

// ray vs sphere with a little aim assist (the sphere grows with distance so tiny things can be hit)
function raySphere(o, d, c, r, assist = 0) {
  const ox = c.x - o.x, oy = c.y - o.y, oz = c.z - o.z;
  const t0 = ox * d.x + oy * d.y + oz * d.z;
  if (t0 < -r) return null;
  const d2 = ox * ox + oy * oy + oz * oz - t0 * t0;
  const R = r + Math.max(0, t0) * assist;
  if (d2 > R * R) return null;
  const t = t0 - Math.sqrt(R * R - d2);
  return Math.max(0, t);
}

const PERSON_SPHERES = [[J.head, 0.13], [J.neck, 0.12], [J.pelvis, 0.15], [J.lEl, 0.07], [J.rEl, 0.07], [J.lHa, 0.07], [J.rHa, 0.07], [J.lKn, 0.08], [J.rKn, 0.08], [J.lFt, 0.07], [J.rFt, 0.07]];

export class Game {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.settings = settings;
    this.time = 0;
    this.mode = 'creative';
    this.money = 0;
    this.worldName = 'My lab';
    this.worldId = null;
    this.people = [];
    this.bugs = [];
    this.items = [];
    this.ids = new Map();
    this.missiles = [];
    this.blueprints = [];
    this.potions = [];
    this.backpack = [];
    this.news = [];
    this.brush = null;
    this.driving = null;
    this.chamber = null;
    this.exp = null;           // person on the experiment table
    this.zone = 'lab';
    this.over = false;
    this.running = false;
    this.customLook = null;

    this.world = new World(scene);
    this.cage = this.world.cage;
    this.fx = new FX(scene);
    this.fx.groundFn = (x, z, y) => this.groundAt(x, z, y);
    this.sink = new InstancedSink(scene, 128);
    this.society = new Society(this);
    this.world.society = this.society;
    this.ai = new AI(this);
    this.talk = new Talk(this);
    this.gadgets = new Gadgets(this);
    this.nav = new CageNav(this.cage);
    this.nav.dirty = false;
    this.navT = 0;
    this.shore = [];
    this.shoreY = null;
    this.player = new Player(this, camera);
    scene.add(camera);
    this.streetLife = new StreetLife(this);
    this.ui = null; // set by main.js
    this.missileGeo = new THREE.SphereGeometry(1, 8, 6);
    this.missileMat = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.8 });
    this.graffitiMeshes = [];
    this.crackMeshes = [];
    this.birthT = 20;
    this.saveT = 120;
  }

  get cageTopY() { return CAGE.top; }
  get cageBounds() { return { x0: CAGE.x0, x1: CAGE.x1, z0: CAGE.z0, z1: CAGE.z1, y1: this.cage.lidOpen ? null : CAGE.top }; }

  // ------------------------------------------------------------- new / reset
  // opts: {name, mode, theme, count, empty, seed, money}
  newWorld(opts = {}) {
    this.reset();
    this.worldName = opts.name || 'My lab';
    this.worldId = opts.id || null;
    this.mode = opts.mode || 'creative';
    this.money = this.mode === 'money' ? (opts.money ?? 400) : 0;
    const theme = opts.theme || 'mixed';
    this.cage.generate(theme, opts.seed || ((Math.random() * 1e9) | 0));
    this.nav.rebuild();
    this.rebuildShore();
    const n = opts.count ?? 25;
    for (let i = 0; i < n; i++) this.spawnCagePerson();
    // a few starting resources so day one isn't hopeless
    this.society.stock.food = 10 + n;
    // the starter bugs
    if (!opts.demo) for (let i = 0; i < 3; i++) this.spawnBug('ant', this.randomCageSpot(), 1);
    // starter gadgets on the tool belt
    const pl = this.player;
    pl.hotbar = ['hand', 'bottle', null, null, null, null, null, null, 'headband'];
    STARTERS.forEach((bp, i) => { const c = JSON.parse(JSON.stringify(bp)); c.id = 'bp' + nextId(); c.charge = 1; if (i < 6) pl.hotbar[2 + i] = c; });
    this.blueprints = STARTERS.map((bp) => JSON.parse(JSON.stringify(bp)));
    pl.setGadgetMesh();
    this.world.time = 9.5; this.world.day = 1; this.world.speed = 1;
    this.streetLife.setup();
    this.feed(opts.demo ? '' : `Welcome to ${this.worldName}. ${n} tiny people live in the cage.`, 'warm');
    this.running = !opts.demo;
  }

  reset() {
    for (const p of [...this.people]) this.removePerson(p, true);
    for (const b of [...this.bugs]) this.removeBug(b);
    for (const it of [...this.items]) this.removeItem(it);
    for (const m of this.missiles) this.scene.remove(m.mesh);
    this.missiles = [];
    for (const c of [...this.streetLife.cars]) c.remove();
    for (const ps of this.streetLife.posters) ps.mesh.parent && ps.mesh.parent.remove(ps.mesh);
    const myCarInter = this.world.interactables.findIndex((i) => i.id === 'mycar');
    if (myCarInter >= 0) this.world.interactables.splice(myCarInter, 1);
    this.streetLife = new StreetLife(this);
    for (const b of [...this.society.buildings]) this.society.remove(b);
    this.society.group.parent && this.society.group.parent.remove(this.society.group);
    this.society = new Society(this);
    this.world.society = this.society;
    this.gadgets.clearAll();
    this.fx.clearDecals();
    this.cage.clearLava();
    this.cage.weather = { rain: 0, snow: 0, heat: 0, fog: 0, storm: 0, quake: 0, flood: 0, lava: 0, wind: 0, lamp: 'auto' };
    this.cage.setLid(false); this.cage.setHatch(false);
    this.cage.glassHP = 100; this.cage.cracks = []; this.cage.graffiti = []; this.cage.broken = false;
    for (const m of this.graffitiMeshes) m.parent && m.parent.remove(m);
    for (const m of this.crackMeshes) m.parent && m.parent.remove(m);
    this.graffitiMeshes = []; this.crackMeshes = [];
    for (const j of this.world.jars) { j.occupant = null; this.labelJar(j); }
    this.exp = null; this.chamber = null; this.driving = null; this.brush = null; this.follow = null; this.camView = null; this.job = null;
    this.news = []; this.unlocks = new Set(); this.bank = 0; this.listings = [];
    this.over = false;
    const pl = this.player;
    pl.holding = null; pl.bottle = []; pl.possess = null; pl.health = 100;
    pl.pos.set(0, 0, 2.6); pl.vel.set(0, 0, 0); pl.yaw = Math.PI; pl.pitch = -0.15;
    pl.form = 'scientist'; pl.disguise = null; pl.changeFormQuiet(); pl.setScale(1); pl.targetScale = 1;
    pl.needs = { hunger: 100, thirst: 100, energy: 100 };
    this.world.bookshelf.open = false; this.world.frontDoor.open = false;
  }

  randomCageSpot(margin = 0.06) {
    for (let i = 0; i < 60; i++) {
      const x = CAGE.x0 + margin + rand() * (CAGE.w - margin * 2), z = CAGE.z0 + margin + rand() * (CAGE.d - margin * 2);
      if (this.cage.isWater(x, z)) continue;
      if (this.cage.obstaclesNear(x, z, 0.01).some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.01)) continue;
      return new THREE.Vector3(x, this.cage.heightAt(x, z), z);
    }
    return new THREE.Vector3(0, this.cage.heightAt(0, -0.5), -0.5);
  }

  spawnCagePerson(opts = {}) {
    const pos = opts.pos || this.randomCageSpot();
    const p = this.spawnPerson({ scale: TINY, pos, loc: 'cage', op: -10 + rand() * 20, fear: 45 + rand() * 25, ...opts });
    return p;
  }

  // ------------------------------------------------------------- people
  spawnPerson(opts = {}) {
    const o = { ...opts };
    o.age = o.age || 'adult';
    o.sex = o.sex || (rand() < 0.5 ? 'm' : 'f');
    const kid = o.age === 'kid' || o.age === 'baby';
    if (!kid && !o.job) o.job = rand.pick(JOB_KEYS.filter((j) => j !== 'homeless' || rand() < 0.3));
    if (!o.look) o.look = makeLook({ sex: o.sex, job: o.job, age: o.age, ...(o.lookOpts || {}) });
    if (kid && !o.traits) o.traits = randomTraits(rand, 2).filter((t) => !['cruel', 'crazy', 'cusser', 'flirty', 'jealous'].includes(t));
    const p = new Person(this, o);
    p.street = !!o.street;
    if (o.name) p.name = o.name;
    this.people.push(p);
    this.ids.set(p.id, p);
    p._tick = rand() * 0.5;
    return p;
  }

  byId(id) { return id == null ? null : this.ids.get(id) || null; }

  removePerson(p, silent = false) {
    const i = this.people.indexOf(p);
    if (i < 0) return;
    this.people.splice(i, 1);
    this.ids.delete(p.id);
    this.releaseFromContainers({ kind: 'person', ref: p });
    if (p.holding) { const it = p.holding; p.holding = null; it.heldBy = null; this.removeItem(it); }
    if (p.objectForm && p.objectForm.mesh) this.scene.remove(p.objectForm.mesh);
    if (p.grabbedBy) p.grabbedBy.release();
    const sl = this.streetLife;
    for (const arr of [sl.walkers, sl.police]) { const k = arr.indexOf(p); if (k >= 0) arr.splice(k, 1); }
    for (const c of sl.cars) { const k = c.occupants.indexOf(p); if (k >= 0) c.occupants.splice(k, 1); }
    if (this.ui && this.ui.focusPerson === p) this.ui.focusPerson = null;
    if (this.player.possess === p) this.player.possess = null;
    p.body.dispose();
    if (!silent && this.ui) this.ui.forget(p);
  }

  // take something out of the hand / bottle / jar / table / chamber before moving it somewhere else
  releaseFromContainers(t) {
    const pl = this.player;
    const r = t.ref;
    if (pl.holding && pl.holding.ref === r) { pl.holding = null; pl.pinch = 0; }
    const bi = pl.bottle.findIndex((b) => b.ref === r);
    if (bi >= 0) pl.bottle.splice(bi, 1);
    for (const j of this.world.jars) if (j.occupant === r) { j.occupant = null; this.labelJar(j); }
    if (this.exp === r) this.exp = null;
    if (this.chamber && this.chamber.who === r) this.chamber = null;
    if (t.kind === 'person') {
      r.held = false;
      if (r.loc === 'bottle' || r.loc === 'jar' || r.loc === 'table' || r.loc === 'held') r.loc = 'world';
      r.body.unpin(); r.body.bounds = null;
      r.body.groundFn = (x, z, y) => this.groundAt(x, z, y, r);
    }
    if (t.kind === 'bug') r.held = false;
    if (t.kind === 'item' && r.heldBy && r.heldBy !== 'player' && r.heldBy !== 'bottle' && r.heldBy.holding === r) r.heldBy.holding = null;
    if (t.kind === 'item') r.heldBy = null;
    if (t.kind === 'car') r.held = false;
  }

  peopleNear(pos, r) {
    const out = [];
    const r2 = r * r;
    for (const p of this.people) {
      const dx = p.pos.x - pos.x;
      if (dx > r || dx < -r) continue;
      const dz = p.pos.z - pos.z;
      if (dz > r || dz < -r) continue;
      if (dx * dx + dz * dz > r2) continue;
      if (Math.abs(p.pos.y - pos.y) > Math.max(r, p.height) * 2 + 0.05) continue;
      out.push(p);
    }
    return out;
  }

  randomLook(sex) { return makeLook({ sex: sex || (rand() < 0.5 ? 'm' : 'f') }); }
  randomName(sex) { return randomName(sex); }

  clonePerson(r) {
    if (!r || r.kid) return null;
    const off = new THREE.Vector3(r.height * 0.5, 0, r.height * 0.2);
    let pos = r.pos.clone().add(off);
    if (r.held || r.loc === 'bottle' || r.loc === 'jar' || r.loc === 'table') pos = new THREE.Vector3(4.55, 0.9, -5.1);
    const c = this.spawnPerson({ name: r.name, last: r.last, sex: r.sex, age: r.age, job: r.job, look: JSON.parse(JSON.stringify(r.look)), traits: [...r.traits], voice: { ...r.voice }, scale: r.scale, pos, loc: this.cage.inside(pos.x, pos.z) && pos.y < CAGE.top ? 'cage' : 'world', op: r.op, fear: r.fear, ageYears: r.ageYears, parents: [...r.parents] });
    c.faith = r.faith; c.loveYou = r.loveYou; c.partner = r.partner; c.married = r.married; c.tribe = r.tribe; c.kids = [...r.kids];
    c.rel = new Map([...r.rel.entries()].map(([k, v]) => [k, { ...v }]));
    c.mem = r.mem.map((m) => ({ ...m }));
    c.needs = { ...r.needs };
    c.isClone = true; c.cloneOf = r.id;
    c.remembersPlayerAs = r.remembersPlayerAs;
    // both think they're the real one
    c.relOf(r).f = -15; r.relOf(c).f = -15;
    c.remember('clone', `There's someone who looks EXACTLY like me. I'm the real ${r.name}.`, -20, r.id);
    r.remember('clone', `The giant made a copy of me. I'm the real one.`, -20, c.id);
    this.fx.burst(c.center(new THREE.Vector3()), [0xb0ffb0, 0xffffff], 24, c.height, 1, { glow: true });
    sfx('machine');
    this.feed(`You cloned ${r.name}. The clone has the same memories and thinks they're the real one.`, 'warm', c);
    c.say(rand.pick(['Wait... why is there another me?', 'Who are YOU? I\'m ' + r.name + '!', 'I\'m the real one. I KNOW I\'m the real one.']), { kind: 'scared' });
    return c;
  }

  mutatePerson(r) {
    const L = { ...r.look };
    const what = rand.pick(['head', 'legs', 'skin', 'eyes', 'fat', 'muscle', 'tiny head']);
    if (what === 'head') L.headScale = Math.min(2.4, L.headScale * 1.5);
    if (what === 'tiny head') L.headScale = Math.max(0.5, L.headScale * 0.6);
    if (what === 'legs') L.legLen = Math.min(1.8, (L.legLen || 1) * 1.35);
    if (what === 'skin') L.skin = rand.pick([0x6ad06a, 0x6a8ad0, 0xd06ac0, 0xd0c040, 0x9a9a9a]);
    if (what === 'eyes') L.eyeSize = Math.min(2.4, L.eyeSize * 1.6);
    if (what === 'fat') L.fat = Math.min(1, L.fat + 0.6);
    if (what === 'muscle') { L.muscle = true; if (!r.traits.includes('strong')) r.traits.push('strong'); }
    r.look = L;
    this.rebuildBody(r);
    this.fx.burst(r.center(new THREE.Vector3()), 0x9aff3a, 24, r.height, 1, { glow: true });
    sfx('bubble', { pitch: 0.6 });
    r.say(rand.pick(['What did you DO to me?!', 'My body... it\'s WRONG!', 'AAAH! Look at me!']), { kind: 'scared', scream: true });
    r.remember('mutate', 'The giant mutated my body', -25, 'player');
    this.feed(`${r.name} mutated (${what})`, 'bad', r);
  }

  rebuildBody(p) {
    const cut = [...p.body.cut];
    const dead = p.body.dead;
    const pos = p.pos.clone();
    p.body.dispose();
    p.body = new Body(p.look, this.sink, { pos, yaw: p.yaw, scale: p.scale });
    p.body.groundFn = (x, z, y) => this.groundAt(x, z, y, p);
    p.body.dead = dead;
    for (const j of cut) p.body.sever(j);
    if (dead) { p.body.ragdoll(9999); p.body.face.closed = 1; }
  }

  // ------------------------------------------------------------- items + bugs
  spawnItem(type, pos, scale, extra = {}) {
    const def = ITEMS[type];
    if (!def) return null;
    const it = new Item(type, pos, scale ?? (def.big ? 1 : TINY), extra);
    if (extra.bp) it.bp = extra.bp;
    if (type === 'gadgetDrop' && it.bp) { this.decorateGadgetDrop(it); }
    this.scene.add(it.mesh);
    this.items.push(it);
    this.ids.set(it.id, it);
    return it;
  }

  decorateGadgetDrop(it) {
    // the dropped gadget looks like the real gadget
    const m = buildGadgetModel(it.bp);
    m.rotation.x = Math.PI / 2;
    m.position.y = 0.03;
    it.mesh.clear();
    it.mesh.add(m);
  }

  removeItem(it) {
    const i = this.items.indexOf(it);
    if (i < 0) return;
    this.items.splice(i, 1);
    this.ids.delete(it.id);
    this.releaseFromContainers({ kind: 'item', ref: it });
    for (const p of this.people) if (p.holding === it) p.holding = null;
    it.mesh.parent && it.mesh.parent.remove(it.mesh);
  }

  spawnBug(type, pos, scale = 1, extra = {}) {
    if (!BUGS[type]) return null;
    const b = new Bug(this, type, pos, { scale, ...extra });
    this.bugs.push(b);
    this.ids.set(b.id, b);
    return b;
  }

  removeBug(b) {
    const i = this.bugs.indexOf(b);
    if (i < 0) return;
    this.bugs.splice(i, 1);
    this.ids.delete(b.id);
    this.releaseFromContainers({ kind: 'bug', ref: b });
    b.remove();
  }

  // a person picks up / drops a tool or weapon
  giveHeld(p, it) {
    if (!it) return;
    if (p.holding && p.holding !== it) this.dropHeld(p);
    this.releaseFromContainers({ kind: 'item', ref: it });
    p.holding = it;
    it.heldBy = p;
    it.rest = false;
    this.attachHeld(p);
  }

  dropHeld(p) {
    const it = p.holding;
    if (!it) return;
    p.holding = null;
    it.heldBy = null;
    it.mesh.quaternion.identity();
    it.mesh.rotation.set(0, it.yaw, 0);
    p.body.P(J.rHa, it.pos);
    it.vel.set((rand() - 0.5) * p.height * 0.5, p.height * 0.3, (rand() - 0.5) * p.height * 0.5);
    it.rest = false;
  }

  // keep a held item in the person's right hand
  attachHeld(p) {
    const it = p.holding;
    if (!it) return;
    if (!this.items.includes(it)) { p.holding = null; return; }
    if (!p.canHoldRight || p.objectForm) { this.dropHeld(p); return; }
    const hand = p.body.P(J.rHa, _v);
    const el = p.body.P(J.rEl, _v2);
    const dir = _v3.copy(hand).sub(el);
    const len = dir.length();
    if (len < 1e-7) return;
    dir.divideScalar(len);
    it.mesh.quaternion.setFromUnitVectors(UP, dir);
    // grip a bit up the handle
    const grip = (it.def.r || 0.3) * it.scale * 0.35;
    it.pos.copy(hand).addScaledVector(dir, -grip);
    it.mesh.position.copy(it.pos);
    it.mesh.visible = !p.body.hidden;
  }

  onItemDropped(it) {
    // tiny people notice gifts that land in the cage
    if (this.cage.inside(it.pos.x, it.pos.z)) {
      it._watchLanding = true;
      if (it.def.res) this.society.note(it.def.res);
      if (it.pool) for (const k of Object.keys(it.pool)) this.society.note(k);
    }
  }

  // ------------------------------------------------------------- ground + picking
  groundAt(x, z, yTop, who = null, r = 0) {
    if (who && who.loc === 'jar' && who.jar) return who.jar.pos.y;
    if (who && who.loc === 'table') return this.world.expTable.pos.y;
    const g = this.world.colliders.groundAt(x, z, yTop, r).y;
    return g === -Infinity ? -100 : g;
  }

  entityVisible(pos) {
    const z = this.world.zoneAt(pos);
    const w = this.world;
    if (z === 'lab') return w.lab.visible;
    if (z === 'house') return w.house.visible;
    if (z === 'stairs') return true;
    return w.street.visible;
  }

  // what's along this ray? -> {kind: person|bug|item|car|player|building|ground|wall, ref, point, dist}
  pick(origin, dir, maxDist, opts = {}) {
    let best = null, bd = maxDist;
    const assist = opts.assist ?? (opts.grabbable ? 0.014 : 0.008);
    const hit = (kind, ref, t) => { if (t < bd) { bd = t; best = { kind, ref, dist: t, point: origin.clone().addScaledVector(dir, t) }; } };
    if (!opts.groundOnly) {
      for (const p of this.people) {
        if (p === opts.exclude || p.loc === 'bottle' || p.loc === 'car' || p.held || (p.body.hidden && !p.objectForm && !(p.invisible > 0))) continue;
        const H = p.height;
        if (p.objectForm) { const c = p.objectForm.mesh.position; const t = raySphere(origin, dir, _v.set(c.x, c.y + H * 0.5, c.z), H * 0.55, assist); if (t !== null) hit('person', p, t); continue; }
        const c = p.center(_v);
        if (raySphere(origin, dir, c, H * 1.0, assist) === null) continue;
        for (const [j, r] of PERSON_SPHERES) {
          if (j === J.head && p.body.headLoose) continue;
          const t = raySphere(origin, dir, p.body.P(j, _v2), r * H, assist);
          if (t !== null) hit('person', p, t);
        }
      }
      for (const b of this.bugs) {
        if (b.held || b === opts.exclude) continue;
        const t = raySphere(origin, dir, b.center(_v), b.size * 0.45, assist);
        if (t !== null) hit('bug', b, t);
      }
      for (const it of this.items) {
        if (it.heldBy || it === opts.exclude || !it.mesh.visible) continue;
        const t = raySphere(origin, dir, _v.copy(it.pos).addScaledVector(UP, it.radius * 0.4), it.radius * 0.8, assist * 0.6);
        if (t !== null) hit('item', it, t);
      }
      for (const c of this.streetLife.cars) {
        if (c.held || c === opts.exclude || this.driving === c) continue;
        const t = raySphere(origin, dir, _v.copy(c.pos).addScaledVector(UP, c.length * 0.15), c.length * 0.42, assist * 0.5);
        if (t !== null) hit('car', c, t);
      }
      if (!opts.notPlayer && !opts.grabbable) {
        const pl = this.player;
        const t = raySphere(origin, dir, _v.copy(pl.pos).addScaledVector(UP, pl.height * 0.5), pl.height * 0.3, 0);
        if (t !== null) hit('player', pl, t);
      }
      if (!opts.grabbable) {
        for (const b of this.society.buildings) {
          const gy = this.cage.heightAt(b.x, b.z);
          const h = b.h || 0.03;
          const t = raySphere(origin, dir, _v.set(b.x, gy + h * 0.45, b.z), Math.max(b.r * 0.9, h * 0.5), 0);
          if (t !== null) hit('building', b, t);
        }
      }
    }
    // the world: floors, walls, the cage ground. Gadget beams go through glass + the mesh lid.
    const skip = opts.grabbable ? null : (b) => b.tag === 'glass' || b.tag === 'lid';
    const w = this.world.colliders.raycast(origin, dir, bd, true, skip);
    if (w && w.dist < bd) {
      bd = w.dist;
      const ground = w.box === this.cage.terrainField || w.normal.y > 0.5;
      best = { kind: ground ? 'ground' : 'wall', ref: w.box, point: w.point, dist: w.dist, normal: w.normal };
    }
    return best;
  }

  targetsInRadius(center, r, opts = {}) {
    const out = [];
    for (const p of this.people) {
      if (p.held || p.loc === 'bottle' || p.loc === 'jar' || p.loc === 'car' || p === opts.exclude) continue;
      const c = p.center(_v);
      const d = c.distanceTo(center);
      if (d < r + p.height * 0.3) out.push({ kind: 'person', ref: p, point: c.clone(), d });
    }
    for (const b of this.bugs) { if (b.held) continue; const d = b.pos.distanceTo(center); if (d < r + b.size * 0.4) out.push({ kind: 'bug', ref: b, point: b.center(new THREE.Vector3()), d }); }
    for (const it of this.items) { if (it.heldBy) continue; const d = it.pos.distanceTo(center); if (d < r + it.radius * 0.5) out.push({ kind: 'item', ref: it, point: it.pos.clone(), d }); }
    for (const c of this.streetLife.cars) { if (c.held || this.driving === c) continue; const d = c.pos.distanceTo(center); if (d < r + c.length * 0.4) out.push({ kind: 'car', ref: c, point: c.pos.clone(), d }); }
    if (opts.includePlayer && !opts.notPlayer) { const pl = this.player; const d = pl.pos.distanceTo(center); if (d < r + pl.height * 0.2) out.push({ kind: 'player', ref: pl, point: pl.pos.clone(), d }); }
    out.sort((a, b) => a.d - b.d);
    return out;
  }

  targetsInCone(origin, dir, range, half, opts = {}) {
    const cos = Math.cos(half);
    return this.targetsInRadius(origin, range, opts).filter((t) => {
      const d = _v.copy(t.point).sub(origin);
      const l = d.length();
      return l > 1e-6 && d.dot(dir) / l > cos;
    });
  }

  // ------------------------------------------------------------- size + moving things
  maxScaleAt(r) {
    const H1 = 1.75 * (r.look ? r.look.height : 1);
    let ceil = this.world.colliders.ceilingAt(r.pos.x, r.pos.z, r.pos.y + r.height * 0.5, r.height * 0.1);
    if (r.inCage && !this.cage.lidOpen) ceil = Math.min(ceil, CAGE.top);
    const room = isFinite(ceil) ? (ceil - r.pos.y) * 0.95 : 14;
    return clamp(room / H1, 0.0015, 8);
  }

  setEntityScale(t, sc) {
    const r = t.ref;
    switch (t.kind) {
      case 'person':
        r.scale = sc; r.body.rescale(sc);
        if (r.objectForm) r.objectForm.mesh.scale.setScalar(r.height * (['shoe', 'book', 'brick', 'pillow'].includes(r.objectForm.type) ? 1.6 : 1));
        if (r.held && r.height > this.player.height * 0.4) this.player.drop(true);
        break;
      case 'bug': r.scale = sc; r.mesh.scale.setScalar(sc); break;
      case 'item': r.scale = sc; r.mesh.scale.setScalar(sc); r.rest = false; if (r.heldBy === 'player' && r.radius * 2 > this.player.height * 0.4) this.player.drop(true); break;
      case 'car': r.setScale(sc); if (r.held && r.length > this.player.height * 0.4) this.player.drop(true); break;
      case 'player': r.setScale(sc); r.targetScale = sc; break;
      default: break;
    }
  }

  moveEntity(t, dest) {
    const r = t.ref;
    if (t.kind !== 'player') this.releaseFromContainers(t);
    switch (t.kind) {
      case 'person': {
        const pel = r.body.P(J.pelvis, _v);
        const dy = dest.y + r.height * 0.5 - pel.y;
        r.body.teleport(dest.x - pel.x, dy, dest.z - pel.z);
        r.pos.copy(dest);
        r.vy = 0; r.stop(); r.task = null;
        r.loc = this.cage.inside(dest.x, dest.z) && dest.y < CAGE.top ? 'cage' : 'world';
        if (r.objectForm) r.objectForm.mesh.position.copy(dest);
        break;
      }
      case 'bug': r.pos.copy(dest); r.vy = 0; break;
      case 'item': r.pos.copy(dest); r.vel.set(0, 0, 0); r.rest = false; break;
      case 'car': r.pos.copy(dest); r.airborne = true; r.vel = new THREE.Vector3(); r.syncMesh(); break;
      case 'player': r.pos.copy(dest); r.vel.set(0, 0, 0); break;
      default: break;
    }
  }

  // ------------------------------------------------------------- talking + news
  speak(p, text, opts) { this.talk.speak(p, text, opts); }

  audibleVol(pos, base = 1) {
    const L = this.player.possess ? this.player.possess.headPos(_v3) : this.camera.position;
    const d = pos.distanceTo(L);
    const range = 3 + this.player.height * 7;
    let v = base * Math.pow(clamp(1 - d / range, 0, 1), 1.4);
    const za = this.world.zoneAt(pos), zb = this.zone;
    if (za !== zb && !(za === 'stairs' || zb === 'stairs') && !((za === 'house' && zb === 'street') || (za === 'street' && zb === 'house'))) v *= 0.12;
    return v;
  }

  feed(text, kind = '', who = null) {
    if (!text) return;
    const n = { text, kind, who: who && who.id != null ? who.id : null, day: this.world.day, time: this.world.time };
    this.news.push(n);
    if (this.news.length > 200) this.news.shift();
    if (this.ui) this.ui.feed(n);
  }

  toast(text) { if (this.ui) this.ui.toast(text); }

  addMoney(n, why = '') {
    if (this.mode !== 'money') return;
    this.money = Math.max(0, Math.round((this.money + n) * 100) / 100);
    if (this.ui && n) this.ui.moneyPop(n, why);
    if (n > 0) sfx('coin');
  }

  canAfford(n) { return this.mode !== 'money' || this.money >= n; }

  spend(n, why) {
    if (this.mode !== 'money') return true;
    if (this.money < n) { this.toast(`Not enough money. You need $${n}.`); sfx('error'); return false; }
    this.addMoney(-n, why);
    return true;
  }

  // ------------------------------------------------------------- violence + effects
  onDeath(p, cause, hit = {}) {
    const g = this;
    if (!p.street || p.inCage) g.feed(`${p.name} ${cause}`, 'bad', p);
    if (p.grabbedBy) p.grabbedBy.release();
    const killer = hit && hit.from && hit.from.id != null && hit.from !== p && this.people.includes(hit.from) ? hit.from : null;
    if (killer && killer.alive && !p.kid) {
      killer.kills++;
      this.ai.onKill(killer, p, killer.task || {});
    }
    this.society.onDeath(p);
    if (p.street && !p.inCage && hit && hit.from === 'player') this.streetLife.witness('murder', p.pos.clone(), p);
    // anyone close who saw it
    for (const o of this.peopleNear(p.pos, p.height * 18)) {
      if (o === p || !o.alive || o.asleep) continue;
      o.fear = Math.min(100, o.fear + (o.kid ? 30 : 15));
      if (hit && hit.from === 'player') o.remember('saw', `The giant killed ${p.name}`, -25, 'player');
    }
    if (this.ui) this.ui.onDeath(p);
  }

  explosion(at, radius, source = null, power = 30) {
    radius = Math.max(radius, 0.002);
    this.fx.burst(at, [0xffd060, 0xff7a10, 0x553322], 46, radius * 2, 1.6, { glow: true });
    this.fx.burst(at, [0x333333, 0x555555], 20, radius * 2, 0.7, { float: true, life: 1.4 });
    this.fx.ring(at, 0xff9a40, radius * 1.4, 0.4);
    for (let i = 0; i < 12; i++) this.fx.fire(at, radius * 1.5);
    sfx('explode', { vol: this.audibleVol(at, 1.2), pitch: clamp(1 / Math.sqrt(radius * 4), 0.4, 2.5) });
    for (const t of this.targetsInRadius(at, radius, { includePlayer: true })) {
      const k = clamp(1 - t.d / radius, 0, 1);
      const dir = t.point.clone().sub(at).normalize().add(_v.set(0, 0.6, 0)).normalize();
      if (t.kind === 'person') t.ref.hurt({ dmg: power * (0.4 + k * 1.2), type: 'explode', from: source === 'player' ? 'player' : source, point: t.point, dir });
      else if (t.kind === 'bug') t.ref.hurt(power * (0.4 + k), null, 'fire');
      else if (t.kind === 'item') { t.ref.vel.copy(dir).multiplyScalar(radius * 6 * k); t.ref.rest = false; }
      else if (t.kind === 'car') t.ref.push(dir.multiplyScalar(radius * 4 * k));
      else if (t.kind === 'player') { this.player.takeHit(power * k * clamp(radius / this.player.height, 0.1, 1.5), null, 'explode'); this.player.knock(dir.multiplyScalar(k)); }
    }
    // buildings + the ground
    for (const b of [...this.society.buildings]) if (Math.hypot(b.x - at.x, b.z - at.z) < radius + b.r && Math.abs(this.cage.heightAt(b.x, b.z) - at.y) < radius * 2) this.society.smash(b, source);
    if (this.cage.inside(at.x, at.z) && at.y < CAGE.top && radius > 0.01) { this.cage.brush(at.x, at.z, 'lower', Math.min(0.15, radius), 1, 0.25); this.cage.brush(at.x, at.z, 'paint:dirt', Math.min(0.15, radius * 1.2), 1, 1); this.nav.dirty = true; }
    if (this.cage.inside(at.x, at.z) && (Math.abs(at.x - CAGE.x0) < radius || Math.abs(at.x - CAGE.x1) < radius || Math.abs(at.z - CAGE.z0) < radius || Math.abs(at.z - CAGE.z1) < radius)) this.damageGlass(power * radius * 20, at);
    if (this.player.inCage || this.zone === this.world.zoneAt(at)) this.player.camShake = Math.max(this.player.camShake, clamp(radius / this.player.height, 0.05, 0.8) * (1 - clamp(at.distanceTo(this.player.pos) / (radius * 8), 0, 1)));
  }

  splash(at, radius) {
    this.fx.burst(at, [0x3a8aff, 0x9fd0ff, 0xffffff], 30, radius * 2, 1.1);
    sfx('splat', { vol: this.audibleVol(at, 0.6), pitch: 0.7 });
    for (const t of this.targetsInRadius(at, radius)) {
      if (t.kind === 'person') { const p = t.ref; p.burning = 0; p.needs.hygiene = Math.min(100, p.needs.hygiene + 40); if (p.alive && !p.kid && radius > p.height * 2) { p.body.ragdoll(0.6); p.body.push(t.point.clone().sub(at).setY(0.5).normalize().multiplyScalar(p.height * 2)); } }
    }
    for (const b of this.society.buildings) if (b.mesh.userData.flame && Math.hypot(b.x - at.x, b.z - at.z) < radius + b.r) b.wet = 30;
  }

  makeMoney(at, P, t) {
    const S = t && t.kind && t.kind !== 'ground' && t.kind !== 'wall' ? this.gadgets.sizeOf(t) : this.player.height;
    const sc = clamp(S / 1.75, TINY * 0.5, 1);
    const n = 3 + Math.round(P);
    for (let i = 0; i < n; i++) {
      const it = this.spawnItem('coin', at.clone().add(_v.set((rand() - 0.5) * S * 0.4, S * 0.3, (rand() - 0.5) * S * 0.4)), sc);
      if (it) { it.vel.set((rand() - 0.5) * S, S, (rand() - 0.5) * S); this.onItemDropped(it); }
    }
    this.fx.burst(at, [0x3ad06a, 0xd8b04a], 20, S, 0.9, { glow: true });
    sfx('coin');
    if (t && t.kind === 'person') { t.ref.money += n; t.ref.op = Math.min(100, t.ref.op + 3); }
  }

  // tiny people's guns / bows / tiny shrink rays
  shoot(p, target, w) {
    const from = p.body.P(J.rHa, new THREE.Vector3());
    const isPl = target === this.player;
    const to = isPl ? (this.player.inCage || this.player.height < p.height * 6 ? this.player.pos.clone().addScaledVector(UP, this.player.height * 0.6) : this.player.handPos.clone()) : target.center(new THREE.Vector3());
    const dist = from.distanceTo(to);
    const skill = (p.skill('fight') || 0.5) * (p.has('strong') ? 1.1 : 1);
    const hitChance = clamp(0.25 + skill * 0.45 - dist / ((w.reach || 10) * p.height / 1.75) * 0.25 + (p.has('smart') ? 0.08 : 0), 0.08, 0.92);
    const hits = rand() < hitChance;
    const end = hits ? to : to.clone().add(_v.set((rand() - 0.5) * dist * 0.2, (rand() - 0.5) * dist * 0.15, (rand() - 0.5) * dist * 0.2));
    const isShrink = w.proj === 'shrink' || w.type === 'gadget';
    if (w.proj === 'arrow') {
      this.missiles.push(this.makeMissile(from, end, p, w, hits ? target : null, 'arrow'));
      sfx('bow', { vol: this.audibleVol(from, 0.6) });
      return;
    }
    this.fx.beam(from, end, isShrink ? 0x63e6be : 0xffe0a0, p.height * (isShrink ? 0.02 : 0.008), isShrink ? 0.25 : 0.06);
    this.fx.burst(from, [0xffd080, 0xffffff], 4, p.height * 0.3, 0.6, { glow: true, life: 0.15 });
    sfx(isShrink ? 'shrink' : 'shot', { vol: this.audibleVol(from, isShrink ? 0.7 : 1), pitch: isShrink ? 2 : clamp(1 / Math.sqrt(p.sc * 4), 0.6, 3) });
    if (!hits) return;
    this.missileHit(p, w, target, end);
  }

  missileHit(p, w, target, at) {
    const dir = at.clone().sub(p.pos).normalize();
    if (target === this.player) {
      const pl = this.player;
      if (w.proj === 'shrink' || w.type === 'gadget') {
        if (p.holding && p.holding.bp) { this.gadgets.applyToPlayer(p.holding.bp); this.toast(`${p.name} used YOUR ${p.holding.bp.name} on you!`); }
        else { pl.setTargetScale(pl.scale * 0.6); this.toast(`${p.name} shot you with a tiny shrink ray!`); sfx('shrink'); }
        p.remember('zapGiant', 'I shrank the giant!', 30, 'player');
        return;
      }
      // a bullet from someone 1/50 your size is a bee sting; your size: deadly
      const ratio = clamp(p.height / pl.height, 0, 1);
      const dmg = (w.dmg || 10) * clamp(ratio * ratio * 3, 0.01, 1);
      if (!pl.inCage && pl.height > p.height * 6) pl.handHit(p, dmg * 4);
      else pl.takeHit(dmg, p, w.type || 'shot');
      return;
    }
    if (target.isBug) { target.hurt((w.dmg || 10) * 0.8, p, w.type === 'shot' ? 'pierce' : w.type); return; }
    if (target.hurt) {
      if ((w.proj === 'shrink' || w.type === 'gadget') && !target.kid) {
        if (p.holding && p.holding.bp) this.gadgets.apply(p.holding.bp, { kind: 'person', ref: target, point: at }, { bp: p.holding.bp, S: p.height / 1.75, color: 0x63e6be, source: p, dir });
        else this.gadgets.scaling.push({ t: { kind: 'person', ref: target, point: at }, from: target.scale, to: Math.max(0.0015, target.scale * 0.5), k: 0 });
        return;
      }
      target.hurt({ dmg: w.dmg || 10, type: w.type === 'shot' ? 'shot' : w.type || 'pierce', from: p, point: at, dir });
    }
  }

  makeMissile(from, to, p, w, target, kind) {
    const dist = from.distanceTo(to);
    const speed = (kind === 'arrow' ? 9 : 6) * Math.sqrt(Math.max(p.sc, 1e-3)) * 1.75;
    const tFlight = Math.max(0.15, dist / speed);
    const g = 9.8 * Math.sqrt(Math.max(p.sc, 1e-3));
    const vel = to.clone().sub(from).divideScalar(tFlight);
    vel.y += 0.5 * g * tFlight;
    const r = p.height * (kind === 'arrow' ? 0.02 : 0.05);
    const mesh = new THREE.Mesh(this.missileGeo, this.missileMat);
    mesh.scale.set(r, r, kind === 'arrow' ? r * 14 : r);
    mesh.position.copy(from);
    this.scene.add(mesh);
    return { pos: from.clone(), vel, g, life: tFlight + 1.5, p, w, target, mesh, kind, r };
  }

  // tiny people throwing stones/spears up at your hand
  throwAt(p, to) {
    const from = p.body.P(J.rHa, new THREE.Vector3()).addScaledVector(UP, p.height * 0.2);
    const w = p.holding && p.holding.def.weapon && p.holding.def.weapon.thrown ? p.holding.def.weapon : { dmg: 3, type: 'blunt' };
    const m = this.makeMissile(from, to, p, w, this.player, 'stone');
    m.toHand = true;
    this.missiles.push(m);
  }

  updateMissiles(dt) {
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.life -= dt;
      m.vel.y -= m.g * dt;
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      if (m.kind === 'arrow') m.mesh.quaternion.setFromUnitVectors(_v.set(0, 0, 1), _v2.copy(m.vel).normalize());
      let done = m.life <= 0;
      const pl = this.player;
      if (!done && m.toHand) {
        if (m.pos.distanceTo(pl.handPos) < Math.max(pl.height * 0.06, m.r * 3)) { pl.handHit(m.p, m.w.dmg || 3); done = true; }
      } else if (!done && m.target) {
        const c = m.target === pl ? _v.copy(pl.pos).addScaledVector(UP, pl.height * 0.6) : m.target.center(_v);
        const H = m.target.height || 0.1;
        if (m.pos.distanceTo(c) < H * 0.45) { this.missileHit(m.p, m.w, m.target, m.pos.clone()); done = true; }
      }
      if (!done && m.pos.y < this.groundAt(m.pos.x, m.pos.z, m.pos.y + m.r * 4)) done = true;
      if (done) { this.scene.remove(m.mesh); this.missiles.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------- the glass
  hitGlass(p, spot, power) {
    const at = new THREE.Vector3(spot.x, this.cage.heightAt(spot.x, spot.z) + p.height * 0.6, spot.z);
    const strength = settings.glassStrength || 2;
    sfx('glass', { vol: this.audibleVol(at, 0.4), pitch: 1.6 + rand() * 0.4 });
    if (!settings.escapes || !this.running) return;
    this.damageGlass(power * 0.05 / strength, at);
    if (this.cage.glassHP <= 0 && p.alive) this.escapeOut(p, spot);
  }

  damageGlass(amount, at) {
    const before = this.cage.glassHP;
    this.cage.damageGlass(amount, at);
    const hp = this.cage.glassHP;
    // a crack appears every 20 HP lost
    if (Math.floor(before / 20) !== Math.floor(hp / 20) && at) this.addCrack(at);
    if (before > 0 && hp <= 0) {
      this.feed('The glass CRACKED all the way through. They can get out!', 'bad');
      sfx('shatter');
      this.cage.broken = true;
    }
  }

  addCrack(at) {
    const pts = [];
    const s = 0.04 + rand() * 0.05;
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2; let x = 0, y = 0;
      for (let k = 0; k < 4; k++) { const nx = x + Math.cos(a + (rand() - 0.5)) * s * 0.3, ny = y + Math.sin(a + (rand() - 0.5)) * s * 0.3; pts.push(x, y, 0, nx, ny, 0); x = nx; y = ny; }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    const side = this.glassSide(at);
    m.position.copy(side.pos);
    m.rotation.y = side.rot;
    this.cage.group.add(m);
    this.crackMeshes.push(m);
  }

  glassSide(at) {
    const d = [Math.abs(at.z - CAGE.z1), Math.abs(at.z - CAGE.z0), Math.abs(at.x - CAGE.x0), Math.abs(at.x - CAGE.x1)];
    const i = d.indexOf(Math.min(...d));
    const pos = at.clone();
    let rot = 0;
    if (i === 0) { pos.z = CAGE.z1 - 0.001; rot = Math.PI; } else if (i === 1) { pos.z = CAGE.z0 + 0.001; rot = 0; }
    else if (i === 2) { pos.x = CAGE.x0 + 0.001; rot = Math.PI / 2; } else { pos.x = CAGE.x1 - 0.001; rot = -Math.PI / 2; }
    return { i, pos, rot };
  }

  repairGlass() {
    this.cage.glassHP = 100; this.cage.broken = false; this.cage.cracks = [];
    for (const m of this.crackMeshes) m.parent && m.parent.remove(m);
    this.crackMeshes = [];
  }

  // squeezed through the crack: now loose on the table outside the glass
  escapeOut(p, spot) {
    const side = this.glassSide(new THREE.Vector3(spot.x, 0, spot.z));
    const out = side.pos.clone();
    const m = p.height * 0.6;
    if (side.i === 0) out.z = CAGE.z1 + 0.02 + m; else if (side.i === 1) out.z = CAGE.z0 - 0.02 - m; else if (side.i === 2) out.x = CAGE.x0 - 0.02 - m; else out.x = CAGE.x1 + 0.02 + m;
    out.y = this.groundAt(out.x, out.z, CAGE.bottom + 0.05);
    this.moveEntity({ kind: 'person', ref: p }, out);
    p.loc = 'world';
    p.escaped = true;
    p.task = null;
    p.fear = Math.max(p.fear, 60);
    p.say(rand.pick(['I\'M OUT! I\'M OUT!', 'Freedom!', 'Come on, everyone, through the crack!', 'Run! RUN!']), { kind: 'scared', scream: true });
    this.feed(`${p.name} ESCAPED through the cracked glass!`, 'bad', p);
  }

  addGraffiti(p, spot, text) {
    const side = this.glassSide(new THREE.Vector3(spot.x, 0, spot.z));
    const gy = this.cage.heightAt(spot.x, spot.z);
    const H = p.height;
    side.pos.y = gy + H * 0.9;
    const col = p.tribe != null ? ((this.society.tribes.find((t) => t.id === p.tribe) || {}).color || '#d02020') : rand.pick(['#d02020', '#2040d0', '#20a040', '#f0f0f0', '#e0a020']);
    this.cage.graffiti.push({ x: side.pos.x, y: side.pos.y, z: side.pos.z, rot: side.rot, text, col, h: H });
    if (this.cage.graffiti.length > 14) this.cage.graffiti.shift();
    this.rebuildGraffiti();
    this.feed(`${p.name} wrote "${text}" on the glass`, text.includes('LOVE') ? 'love' : 'bad', p);
  }

  rebuildGraffiti() {
    for (const m of this.graffitiMeshes) { m.parent && m.parent.remove(m); m.material.map && m.material.map.dispose(); }
    this.graffitiMeshes = [];
    for (const g of this.cage.graffiti) {
      const tex = textTexture(g.text, { w: 512, h: 128, size: 70, bg: 'rgba(0,0,0,0)', color: g.col, font: '"Comic Sans MS", "Marker Felt", Arial' });
      const w = g.h * 3.2, h = w / 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(g.x, g.y, g.z);
      m.rotation.y = g.rot;
      m.renderOrder = 7;
      this.cage.group.add(m);
      this.graffitiMeshes.push(m);
    }
  }

  deadNearWater(spot) {
    for (const p of this.people) if (!p.alive && !p.buried && Math.hypot(p.pos.x - spot.x, p.pos.z - spot.z) < 0.08 && this.cage.isWater(p.pos.x, p.pos.z)) return true;
    return false;
  }

  // ------------------------------------------------------------- terrain brush (control panel)
  applyBrush(pt, dt) {
    const b = this.brush;
    if (!b) return;
    if (b.tool.startsWith('nat:') || b.tool === 'erase') {
      this.brushT = (this.brushT || 0) - dt;
      if (this.brushT > 0) return;
      this.brushT = 0.18;
      if (b.tool === 'erase') {
        const o = this.cage.nat.filter((n) => Math.hypot(n.x - pt.x, n.z - pt.z) < b.radius).sort((a, c) => Math.hypot(a.x - pt.x, a.z - pt.z) - Math.hypot(c.x - pt.x, c.z - pt.z))[0];
        if (o) { this.cage.removeNat(o); sfx('chop', { pitch: 1.5 }); }
      } else {
        const type = b.tool.slice(4);
        if (!NAT[type] || this.cage.isWater(pt.x, pt.z) && type !== 'rock') return;
        this.cage.addNat(type, pt.x + (rand() - 0.5) * b.radius, pt.z + (rand() - 0.5) * b.radius, 0.8 + rand() * 0.4);
        sfx('pick', { pitch: 0.8 });
      }
      this.cage.dirty = true;
      this.nav.dirty = true;
      return;
    }
    this.cage.brush(pt.x, pt.z, b.tool, b.radius, b.strength, dt);
    if (b.tool === 'raise' || b.tool === 'lower' || b.tool === 'smooth' || b.tool === 'flatten') { this.nav.dirty = true; this.shoreDirty = true; }
    // nature on top follows the ground
    for (const o of this.cage.nat) if (Math.hypot(o.x - pt.x, o.z - pt.z) < b.radius) this.cage.dirty = true;
  }

  rebuildShore() {
    const c = this.cage;
    const out = [];
    for (let k = 1; k < CAGE.nz - 1; k += 2) for (let i = 1; i < CAGE.nx - 1; i += 2) {
      const x = CAGE.x0 + i * CAGE.cell, z = CAGE.z0 + k * CAGE.cell;
      if (c.isWater(x, z)) continue;
      if (c.isWater(x + CAGE.cell * 2, z) || c.isWater(x - CAGE.cell * 2, z) || c.isWater(x, z + CAGE.cell * 2) || c.isWater(x, z - CAGE.cell * 2)) out.push({ x, z });
    }
    this.shore = out.length > 500 ? out.filter((_, i) => i % Math.ceil(out.length / 500) === 0) : out;
    this.shoreY = c.waterY;
    this.shoreDirty = false;
  }

  // ------------------------------------------------------------- dying (player)
  dropGearInCage(pos) {
    const pl = this.player;
    const S = pl.scale;
    let n = 0;
    for (let i = 0; i < pl.hotbar.length; i++) {
      const t = pl.hotbar[i];
      if (!t || typeof t !== 'object' || t.potion) continue;
      const it = this.spawnItem('gadgetDrop', pos.clone().add(_v.set((rand() - 0.5) * pl.height, pl.height * 0.3, (rand() - 0.5) * pl.height)), S, { bp: t });
      if (it) { it.vel.set((rand() - 0.5) * pl.height, pl.height, (rand() - 0.5) * pl.height); n++; }
      pl.hotbar[i] = null;
    }
    pl.setGadgetMesh();
    if (n) this.feed(`You dropped ${n} gadget${n > 1 ? 's' : ''} in the cage. They can pick them up and use them on you.`, 'bad');
  }

  gameOver(from) {
    this.over = true;
    this.running = false;
    if (this.ui) this.ui.gameOver(from);
  }

  // ------------------------------------------------------------- potions
  usePotion(tool, aim) {
    const pl = this.player;
    const hit = this.pick(aim.origin, aim.dir, pl.reach * 4, { notPlayer: true });
    const at = hit ? hit.point : aim.origin.clone().addScaledVector(aim.dir, pl.reach * 2);
    const bp = { id: 'potion', name: tool.name, body: 'wand', cores: tool.effects.filter((k) => CORES[k]), mod: 'burst', stats: { power: tool.power || 5, area: tool.area || 2, time: tool.time || 5, shots: 1 }, opts: { color: tool.color } };
    const r = pl.height * 0.06 * (1 + (tool.area || 2) * 0.3);
    this.fx.burst(at, [tool.color, 0xffffff], 30, r * 2, 1, { glow: true });
    sfx('glass', { pitch: 0.9 }); sfx('splat', { pitch: 1.4 });
    const ctx = { bp, S: pl.height / 1.75, color: tool.color, source: 'player', dir: aim.dir.clone() };
    const tg = hit && hit.kind !== 'ground' && hit.kind !== 'wall' ? [hit] : this.targetsInRadius(at, r);
    for (const t of tg) if (t.kind !== 'player') this.gadgets.apply(bp, t, ctx);
    if (!tg.length && hit) this.gadgets.applyGround(bp, hit, ctx);
    tool.uses = (tool.uses ?? 3) - 1;
    if (tool.uses <= 0) { pl.hotbar[pl.slot] = null; pl.setGadgetMesh(); this.toast(`${tool.name} is used up.`); }
  }

  drinkPotion(tool) {
    const pl = this.player;
    for (const k of tool.effects) {
      if (k === 'shrink') pl.setTargetScale(pl.scale * 0.5);
      else if (k === 'grow') pl.setTargetScale(Math.min(pl.maxScaleHere(), pl.scale * 2));
      else if (k === 'heal') pl.health = Math.min(100, pl.health + 40);
      else if (k === 'speed') pl.speedBoost = 20;
      else if (k === 'invisible') pl.invisibleT = 30;
      else if (k === 'poison') pl.takeHit(20, null, 'poison');
    }
    sfx('bubble');
    tool.uses = (tool.uses ?? 3) - 1;
    if (tool.uses <= 0) { pl.hotbar[pl.slot] = null; pl.setGadgetMesh(); }
    this.toast(`You drank the ${tool.name}.`);
  }

  // ------------------------------------------------------------- witnesses
  witness(kind, at, victim) {
    if (this.world.zoneAt(at) === 'street' || (victim && victim.street)) this.streetLife.witness(kind, at.clone(), victim);
  }

  // ------------------------------------------------------------- jars
  labelJar(j) {
    const o = j.occupant;
    const text = o ? (o.isBug ? o.def.label : o.name) : '';
    if (j.labelTex) j.labelTex.dispose();
    j.labelTex = text ? textTexture(text, { w: 256, h: 128, size: 40, bg: '#f0ead0', color: '#222' }) : null;
    j.labelMesh.material.map = j.labelTex;
    j.labelMesh.material.needsUpdate = true;
  }

  putInJar(j, t) {
    const r = t.ref;
    if (j.occupant) { this.toast('That jar is taken.'); return false; }
    const size = this.gadgets.sizeOf(t);
    if (size > 0.22) { this.toast('Too big for a jar.'); return false; }
    if (t.kind !== 'person' && t.kind !== 'bug') { this.toast('Jars are for people and bugs.'); return false; }
    this.releaseFromContainers(t);
    j.occupant = r;
    if (t.kind === 'person') {
      r.loc = 'jar'; r.jar = j; r.jarId = j.id; r.task = null; r.stop();
      const pel = r.body.P(J.pelvis, _v);
      r.body.teleport(j.pos.x - pel.x, j.pos.y + r.height * 0.5 - pel.y, j.pos.z - pel.z);
      r.pos.set(j.pos.x, j.pos.y, j.pos.z);
      r.body.ragdoll(0.6);
      if (r.alive) { r.say(rand.pick(['Let me out of here!', 'No no no, not a JAR!', 'I can\'t breathe in here!', 'Please...']), { kind: 'scared' }); r.remember('jar', 'The giant put me in a jar', -25, 'player'); r.op = Math.max(-100, r.op - 8); }
    } else { r.held = true; r.pos.copy(j.pos); r.mesh.position.copy(j.pos); }
    sfx('glass', { pitch: 1.2 });
    this.labelJar(j);
    this.feed(`You put ${t.kind === 'person' ? r.name : 'a ' + r.def.label.toLowerCase()} in a jar`, '', t.kind === 'person' ? r : null);
    return true;
  }

  takeFromJar(j) {
    const r = j.occupant;
    if (!r) return false;
    const t = { kind: r.isBug ? 'bug' : 'person', ref: r };
    j.occupant = null;
    this.labelJar(j);
    if (t.kind === 'person') { r.loc = 'world'; r.jar = null; r.jarId = null; r.body.bounds = null; }
    else r.held = false;
    if (!this.player.holding && this.player.tool === 'hand') { this.player.grabTarget(t); return true; }
    this.moveEntity(t, j.pos.clone().add(_v.set(-0.35, 0, 0)));
    return true;
  }

  updateJars(dt) {
    for (const j of this.world.jars) {
      const o = j.occupant;
      if (!o) continue;
      if (o.isBug) { o.pos.copy(j.pos); o.mesh.position.copy(j.pos); o.animLegs(dt, 0.3); continue; }
      if (!this.people.includes(o)) { j.occupant = null; this.labelJar(j); continue; }
      const R = j.radius * 0.85;
      o.body.bounds = { x0: j.pos.x - R, x1: j.pos.x + R, z0: j.pos.z - R, z1: j.pos.z + R, y1: j.top - 0.01 };
      o.pos.set(j.pos.x, j.pos.y, j.pos.z);
      // they bang on the glass
      if (o.alive && o.mood() < -20 && rand() < dt * 0.4 && this.audibleVol(j.pos, 1) > 0.05) { sfx('glass', { vol: this.audibleVol(j.pos, 0.25), pitch: 2.2 }); if (rand() < 0.3) o.say(rand.pick(['LET ME OUT!', 'Hello?! HELLO?!', 'Please, I\'ll do anything!', 'I\'m so hungry...']), { kind: 'scared' }); }
      // jar life: no food, no water (you feed them by hand)
    }
  }

  // ------------------------------------------------------------- shrink chamber + spawn machine
  startChamber(who) {
    if (this.chamber) { this.toast('The chamber is busy.'); return; }
    const spot = this.world.shrinkSpot;
    if (who === 'player') {
      this.chamber = { who: 'player', t: 0, from: this.player.scale, to: TINY };
      this.player.pos.set(spot.x, this.groundAt(spot.x, spot.z, spot.y + 1), spot.z);
      this.player.frozen = 3.4;
    } else {
      const p = who;
      this.releaseFromContainers({ kind: 'person', ref: p });
      this.moveEntity({ kind: 'person', ref: p }, new THREE.Vector3(spot.x, this.groundAt(spot.x, spot.z, spot.y + 1), spot.z));
      p.loc = 'chamber';
      p.task = null; p.stop();
      this.chamber = { who: p, t: 0, from: p.scale, to: TINY * (0.92 + rand() * 0.16) };
      if (p.alive) p.say(rand.pick(['What is this thing?', 'Hey, open the door!', 'What are you doing?!', 'Is this a... no. NO.']), { kind: 'scared' });
    }
    sfx('machine');
  }

  updateChamber(dt) {
    const c = this.chamber;
    const rings = this.world.machineRings;
    rings.shrink.material.emissiveIntensity = c ? 2 + Math.sin(this.time * 20) * 1.5 : 2;
    rings.spawn.rotation.z += dt * (this.spawnGlow > 0 ? 6 : 0.5);
    if (this.spawnGlow > 0) this.spawnGlow -= dt;
    if (!c) { rings.shrink.position.y = 0.22; return; }
    c.t += dt;
    const spot = this.world.shrinkSpot;
    rings.shrink.position.y = 0.22 + Math.abs(Math.sin(c.t * 2.2)) * 1.6;
    if (rand() < dt * 30) this.fx.burst(new THREE.Vector3(spot.x + (rand() - 0.5) * 0.6, 0.3 + rand() * 1.6, spot.z + (rand() - 0.5) * 0.6), [0x63e6be, 0xffffff], 1, 0.3, 0.3, { glow: true, life: 0.4 });
    const k = clamp((c.t - 1.0) / 2.0, 0, 1);
    const e = k * k * (3 - 2 * k);
    const sc = Math.exp(Math.log(c.from) + (Math.log(c.to) - Math.log(c.from)) * e) * (1 + (k < 1 && k > 0 ? Math.sin(k * 18) * 0.04 : 0));
    if (c.who === 'player') { this.player.setScale(sc); this.player.targetScale = sc; this.player.pos.x = spot.x; this.player.pos.z = spot.z; }
    else if (this.people.includes(c.who)) {
      const p = c.who;
      p.scale = sc; p.body.rescale(sc);
      const pel = p.body.P(J.pelvis, _v);
      p.body.pin(J.pelvis, _v2.set(spot.x, this.groundAt(spot.x, spot.z, 1) + p.height * 0.55, spot.z));
      void pel;
      if (c.t > 0.5 && c.t < 0.6 && p.alive) p.say('AAAAAAAAH!', { kind: 'scared', scream: true });
    } else { this.chamber = null; return; }
    if (c.t > 1 && !c.flash) { c.flash = true; sfx('shrink', { pitch: 0.6, vol: 0.9 }); }
    if (c.t > 3.4) {
      const tray = this.world.shrinkTray;
      sfx('poof');
      this.fx.burst(tray.clone(), [0x63e6be, 0xffffff], 20, 0.05, 0.5, { glow: true });
      if (c.who === 'player') {
        this.player.setScale(c.to); this.player.targetScale = c.to;
        this.player.pos.set(tray.x, tray.y, tray.z); this.player.vel.set(0, 0, 0);
        this.toast('You\'re tiny now. You\'re on the chamber tray. Hold X to grow back.');
      } else {
        const p = c.who;
        p.body.unpin();
        p.scale = c.to; p.body.rescale(c.to);
        p.loc = 'world';
        this.moveEntity({ kind: 'person', ref: p }, new THREE.Vector3(tray.x + (rand() - 0.5) * 0.12, tray.y, tray.z + (rand() - 0.5) * 0.06));
        p.street = false;
        p.fear = Math.max(p.fear, 75);
        p.op = Math.min(p.op, -15);
        p.remember('shrunk', 'The giant shrank me in a machine', -30, 'player');
        if (p.alive) p.say(rand.pick(['Why is everything so BIG?!', 'What did you do to me?!', 'I\'m... tiny. I\'m TINY!', 'Somebody wake me up...']), { kind: 'scared', scream: true });
        this.feed(`${p.name} came out of the shrink chamber tiny. They're on the tray.`, '', p);
      }
      this.chamber = null;
    }
  }

  // the spawn machine: makes a brand-new person (looks + personality picked by you, or random)
  spawnFromMachine(o = {}) {
    if (!this.spend(this.mode === 'money' ? 60 : 0, 'Spawn machine')) return null;
    const spot = this.world.spawnSpot;
    const pos = new THREE.Vector3(spot.x, this.groundAt(spot.x, spot.z, 1.2), spot.z);
    const p = this.spawnPerson({ pos, scale: 1, loc: 'world', name: o.name || undefined, sex: o.sex, age: 'adult', job: o.job, traits: o.traits && o.traits.length ? o.traits : undefined, look: o.look, op: 0, fear: 60 });
    p.fromMachine = true;
    p.yaw = Math.PI;
    this.spawnGlow = 2.5;
    this.fx.burst(pos.clone().addScaledVector(UP, 1), [0x63e6be, 0xffffff], 50, 1.2, 1.2, { glow: true });
    sfx('teleport', { pitch: 0.6 }); sfx('machine');
    p.say(rand.pick(['Where... where am I?', 'Hello? Is anyone there?', 'What is this place?', 'Why am I in a tube?']), { kind: 'scared' });
    this.feed(`The spawn machine made ${p.name} ${p.last} (${p.jobLabel})`, 'warm', p);
    if (o.shrink) setTimeout(() => { if (this.people.includes(p) && !this.chamber) this.startChamber(p); }, 1600);
    return p;
  }

  // ------------------------------------------------------------- experiment table
  putOnTable(p) {
    if (this.exp) { this.toast('Someone is already on the table.'); return false; }
    if (p.kid) { this.toast('Not kids. Never kids.'); return false; }
    if (p.height > 0.2) { this.toast('Too big for the tiny operating table.'); return false; }
    this.releaseFromContainers({ kind: 'person', ref: p });
    const at = this.world.expTable.pos;
    p.loc = 'table'; p.task = null; p.stop();
    const pel = p.body.P(J.pelvis, _v);
    p.body.teleport(at.x - pel.x, at.y + p.height * 0.1 - pel.y, at.z - pel.z);
    p.pos.set(at.x, at.y, at.z);
    p.yaw = Math.PI / 2;
    this.exp = p;
    if (p.alive) { p.say(rand.pick(['What are you going to do to me?!', 'No! Not the table!', 'Let me go!', 'Please, I have a family...']), { kind: 'scared', scream: true }); p.remember('table', 'The giant strapped me to a table', -20, 'player'); }
    sfx('click');
    return true;
  }

  updateExpTable(dt) {
    const p = this.exp;
    if (!p) return;
    if (!this.people.includes(p)) { this.exp = null; return; }
    const at = this.world.expTable.pos;
    p.pos.set(at.x, at.y, at.z);
    // strapped: pinned at the chest and hips, lying on their back
    p.body.mode = 'anim';
    p.anim.lying = true;
    void dt;
  }

  // ------------------------------------------------------------- interacting (E)
  findInteractable() {
    const pl = this.player;
    if (pl.possess || this.over) return null;
    if (pl.scale < 0.4 || pl.scale > 3) return null;
    const eye = pl.eye;
    const fwd = _v2.set(-Math.sin(pl.yaw) * Math.cos(pl.pitch), Math.sin(pl.pitch), -Math.cos(pl.yaw) * Math.cos(pl.pitch));
    let best = null, bs = Infinity;
    for (const it of this.world.interactables) {
      if (it.passive) continue;
      const d = eye.distanceTo(it.pos);
      const lim = it.r + pl.reach * 0.9;
      if (d > lim + 0.4) continue;
      const to = _v.copy(it.pos).sub(eye).normalize();
      const facing = to.dot(fwd);
      if (facing < 0.35 && d > it.r) continue;
      const score = d / lim + (1 - facing) * 1.2;
      if (score < bs) { bs = score; best = it; }
    }
    return best;
  }

  interact(it) {
    const pl = this.player;
    const held = pl.holding;
    const ui = this.ui;
    const w = this.world;
    switch (it.id) {
      case 'bookshelf': w.toggleDoor(w.bookshelf); break;
      case 'frontdoor': w.toggleDoor(w.frontDoor); break;
      case 'tv': this.tvOn = !this.tvOn; ui.tv(this.tvOn); sfx('click'); break;
      case 'fridge': {
        if (settings.yourNeeds) { pl.needs.hunger = Math.min(100, pl.needs.hunger + 45); pl.needs.thirst = Math.min(100, pl.needs.thirst + 45); }
        if (!pl.holding && pl.tool === 'hand') { const g = this.spawnItem(rand.pick(['grape', 'crumb', 'sugar', 'gummy']), pl.handHoldPoint(), 1); pl.grabTarget({ kind: 'item', ref: g }); this.toast(`You grabbed a ${g.def.label.toLowerCase()} from the fridge. You ate something too.`); }
        else this.toast('You ate a snack.');
        sfx('door');
        break;
      }
      case 'mycar': this.streetLife.enterCar(it.car); break;
      case 'panel': ui.open('panel'); break;
      case 'supply': ui.open('supply'); break;
      case 'workbench': ui.open('workbench'); break;
      case 'computer': ui.open('computer'); break;
      case 'chem': ui.open('chem'); break;
      case 'spawner': ui.open('spawner'); break;
      case 'charger': {
        let n = 0;
        for (const t of [...pl.hotbar, ...this.backpack]) if (t && typeof t === 'object' && !t.potion && (t.charge ?? 1) < 1) { t.charge = 1; n++; }
        sfx('electric'); this.toast(n ? `Charged ${n} gadget${n > 1 ? 's' : ''}.` : this.mode === 'money' ? 'Everything is already charged.' : 'Gadgets never run out in Creative mode.');
        break;
      }
      case 'cloner': {
        if (held && held.kind === 'person') {
          if (held.ref.kid) { this.toast('The machine won\'t clone kids.'); return; }
          if (!held.ref.alive) { this.toast('It can\'t clone a dead body.'); return; }
          if (!this.spend(this.mode === 'money' ? 80 : 0, 'Clone')) return;
          w.cloneRing.material.emissiveIntensity = 6;
          setTimeout(() => { w.cloneRing.material.emissiveIntensity = 2; }, 900);
          this.clonePerson(held.ref);
        } else if (held && held.kind === 'bug') { this.spawnBug(held.ref.type, new THREE.Vector3(4.55, 0.9, -5.1), held.ref.scale); sfx('machine'); this.toast('Cloned the bug. It\'s on the machine.'); }
        else this.toast('Hold a person (or a bug) in your hand, then use the clone machine.');
        break;
      }
      case 'shrinker': {
        const spot = w.shrinkSpot;
        if (held && held.kind === 'person') { if (held.ref.height < 0.3) { this.toast('They\'re already tiny. Drop them in the cage!'); return; } this.startChamber(held.ref); pl.holding = null; return; }
        const inside = this.people.find((p) => p.alive && !p.kid && p.height > 0.5 && Math.hypot(p.pos.x - spot.x, p.pos.z - spot.z) < 0.45);
        if (inside) { this.startChamber(inside); return; }
        if (Math.hypot(pl.pos.x - spot.x, pl.pos.z - spot.z) < 0.45) { this.startChamber('player'); return; }
        this.toast('Lead someone into the tube (tell them "follow me"), or step in yourself, then press E.');
        break;
      }
      case 'exptable': {
        if (held && held.kind === 'person') { if (this.putOnTable(held.ref)) pl.holding = null; }
        if (this.exp) ui.open('exptable');
        else this.toast('Hold a tiny person in your hand to strap them to the table.');
        break;
      }
      default:
        if (it.jar) {
          const j = it.jar;
          if (held && (held.kind === 'person' || held.kind === 'bug')) { if (this.putInJar(j, { kind: held.kind, ref: held.ref })) pl.holding = null; }
          else if (j.occupant) this.takeFromJar(j);
          else this.toast('An empty jar. Hold someone and press E to put them in.');
        }
    }
  }

  // ------------------------------------------------------------- the frame
  update(dt) {
    const pl = this.player;
    const w = this.world;
    this.time += dt;
    const sdt = dt * w.speed; // cage time
    // global keys
    if (this.running && !this.ui.modalOpen && !input.typing) {
      if (actPressed('interact')) {
        if (this.driving) this.streetLife.exitCar();
        else if (!pl.possess) { const it = this.findInteractable(); if (it) this.interact(it); }
      }
      if (actPressed('faster')) this.setSpeed(+1);
      if (actPressed('slower')) this.setSpeed(-1);
    }
    // you
    if (this.job) this.updateJob(dt);
    if (this.camView) this.updateCams(dt);
    else if (this.driving) this.updateDriving(dt);
    else if (this.follow) this.updateFollow(dt);
    else if (this.running && !this.over) pl.update(dt);
    this.zone = w.zoneAt(this.camera.position);
    this.hover = this.running && !this.driving ? this.findInteractable() : null;
    // the world + clock + cage weather
    w.update(dt, { playerPos: pl.pos, time: this.time, onStrike: (p) => this.lightningStrike(p), onNewDay: (d) => this.newDay(d) });
    w.setVisibility(this.zone, this.camera.position);
    // shore / nav upkeep
    if (this.shoreDirty || (this.shoreY !== null && Math.abs(this.cage.waterY - this.shoreY) > 0.003)) this.rebuildShore();
    this.navT -= dt;
    if (this.nav.dirty && this.navT <= 0) { this.nav.rebuild(); this.nav.dirty = false; this.navT = 1; }
    // people
    const steps = sdt > STEP ? Math.min(Math.ceil(sdt / STEP), this.people.length > 40 ? 3 : 5) : 1;
    for (const p of this.people) {
      if (p === pl.possess) { p.task = null; }
      const fast = p.inCage && !p.busyBody;
      const pdt = fast ? sdt : dt;
      if (pdt <= 0) continue;
      const n = fast ? steps : (pdt > STEP ? 2 : 1);
      for (let s = 0; s < n; s++) {
        const d = pdt / n;
        p._tick += d;
        let tick = 0;
        if (p._tick >= 0.5) { tick = p._tick; p._tick = 0; }
        if (p.inCar) { p.pos.copy(p.inCar.pos); }
        p.update(d, tick);
        if (p.inCage && p.alive) this.cageHazards(p, d);
      }
      if (p.holding) this.attachHeld(p);
    }
    this.updateJars(dt);
    this.updateExpTable(dt);
    this.updateChamber(dt);
    // bugs
    for (const b of this.bugs) { const bdt = b.inCage ? sdt : dt; if (bdt > 0) b.update(Math.min(bdt, 0.1)); b.mesh.visible = this.entityVisible(b.pos); }
    // items
    const iBounds = this.cageBounds;
    for (const it of this.items) {
      if (it.heldBy) { if (it.heldBy !== 'player' && it.heldBy !== 'bottle' && it.heldBy.body) it.mesh.visible = !it.heldBy.body.hidden && this.entityVisible(it.pos); else it.mesh.visible = true; continue; }
      const inC = this.cage.inside(it.pos.x, it.pos.z) && it.pos.y < CAGE.top + 0.01;
      const vy = it.vel.y;
      const wasRest = it.rest;
      it.update(Math.min(inC ? sdt : dt, 0.05), (x, z, y) => this.groundAt(x, z, y), inC, iBounds);
      if (!wasRest && it.rest && vy < -0.5) this.itemLanded(it, -vy);
      it.mesh.visible = this.entityVisible(it.pos);
    }
    // the society of the cage
    if (sdt > 0) {
      this.society.update(sdt);
      this.birthT -= sdt;
      if (this.birthT <= 0) { this.birthT = 15; this.society.tryBirths(); }
    }
    this.streetLife.update(dt);
    this.gadgets.update(dt);
    this.updateMissiles(sdt > 0 ? sdt : dt);
    this.fx.update(dt);
    // draw everyone
    for (const p of this.people) {
      const vis = this.entityVisible(p.pos) || p.held || p.loc === 'bottle';
      if (vis) { p.body.render(this.time); p._drawn = true; }
      else if (p._drawn) { p.body.hideAll(); p._drawn = false; }
      if (p.objectForm && p.objectForm.mesh) p.objectForm.mesh.visible = vis;
    }
    this.sink.flush();
    // sounds of the cage when you're near it
    const nearCage = this.zone === 'lab' && Math.hypot(pl.pos.x - (CAGE.x0 + CAGE.x1) / 2, pl.pos.z - (CAGE.z0 + CAGE.z1) / 2) < 4;
    setLoop('rain', nearCage && (this.cage.weather.rain || this.cage.weather.storm) ? 0.25 : 0);
    setLoop('wind', nearCage && this.cage.weather.wind ? 0.2 : 0);
    // autosave
    if (this.running && !this.over) { this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 180; if (this.ui) this.ui.autosave(); } }
  }

  // ------------------------------------------------------------- watching (follow cam, spy cams, computer jobs)
  updateFollow(dt) {
    const p = this.follow;
    const pl = this.player;
    if (!p || !this.people.includes(p)) { this.follow = null; return; }
    if (this.followYaw == null) { this.followYaw = pl.yaw; this.followPitch = -0.35; this.followDist = 3.2; }
    if (input.locked && !this.ui.modalOpen) {
      this.followYaw -= input.mouse.dx * 0.003 * settings.sensitivity;
      this.followPitch = clamp(this.followPitch - input.mouse.dy * 0.003 * settings.sensitivity, -1.35, 0.5);
    }
    if (input.mouse.wheel) this.followDist = clamp(this.followDist * (input.mouse.wheel > 0 ? 1.15 : 0.87), 0.7, 30);
    const target = p.objectForm ? _v.copy(p.objectForm.mesh.position).addScaledVector(UP, p.height * 0.5) : p.center(_v);
    const H = Math.max(p.height, 0.004);
    const yaw = this.followYaw, pitch = this.followPitch;
    const back = _v2.set(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let dist = H * this.followDist;
    const cg = this.cage.raycast(target, back, dist);
    if (cg !== null) dist = Math.max(H * 0.3, cg - H * 0.1);
    this.camera.position.copy(target).addScaledVector(back, dist);
    this.camera.lookAt(target);
    this.camera.near = clamp(H * 0.02, 0.00003, 0.05); this.camera.far = clamp(H * 900, 20, 1500); this.camera.updateProjectionMatrix();
    pl.vm.visible = false;
    if (pl.view === 'third' && !pl.creature) pl.body.render(this.time);
    void dt;
  }

  startCams(i) { this.camView = { i }; this.toast('Spy cameras: left/right arrows to switch, Esc to stop.'); }

  updateCams(dt) {
    const c = this.camView;
    const CAMS = this.ui.camList || [];
    if (input.pressed.has('ArrowRight')) c.i = (c.i + 1) % CAMS.length;
    if (input.pressed.has('ArrowLeft')) c.i = (c.i + CAMS.length - 1) % CAMS.length;
    if (input.pressed.has('Escape') || actPressed('interact')) { this.camView = null; return; }
    const cam = CAMS[c.i];
    if (!cam) { this.camView = null; return; }
    this.camera.position.set(...cam.pos);
    this.camera.lookAt(...cam.look);
    this.camera.near = cam.pos[1] < 1.5 ? 0.002 : 0.05; this.camera.far = 600; this.camera.updateProjectionMatrix();
    this.player.vm.visible = false;
    this.camLabel = cam.name;
    void dt;
  }

  startJob(j) {
    this.job = { ...j, t: j.hours * (960 / 24), prevSpeed: this.world.speed };
    this.world.speed = 20;
    this.player.frozen = 9999;
    this.toast(`Working: ${j.name}... (the cage keeps living at 20x)`);
  }

  updateJob(dt) {
    const j = this.job;
    j.t -= dt * this.world.speed;
    if (j.t <= 0) {
      this.world.speed = j.prevSpeed;
      this.player.frozen = 0;
      this.job = null;
      if (this.mode === 'money') this.addMoney(j.pay, j.name); else this.toast(`Finished: ${j.name}. (Pay only counts in Money mode.)`);
      sfx('cash');
    }
  }

  setSpeed(dir) {
    const S = [0, 0.25, 0.5, 1, 2, 5, 20];
    let i = S.indexOf(this.world.speed);
    if (i < 0) i = 3;
    i = clamp(i + dir, 0, S.length - 1);
    this.world.speed = S[i];
    this.toast(S[i] === 0 ? 'Cage time: PAUSED' : `Cage time: ${S[i]}x`);
    sfx('click');
  }

  updateDriving(dt) {
    const car = this.driving;
    const pl = this.player;
    if (!car || car.scale < 0.6) { this.streetLife.exitCar(); return; }
    pl.vel.set(0, 0, 0);
    // look around from the driver's seat
    if (input.locked && !this.ui.modalOpen) {
      pl.lookYaw = clamp((pl.lookYaw || 0) - input.mouse.dx * 0.0022 * settings.sensitivity, -2, 2);
      pl.pitch = clamp(pl.pitch - input.mouse.dy * 0.0022 * settings.sensitivity, -0.8, 0.6);
    }
    const s = car.scale;
    const seat = _v.set(0.38 * s, 1.18 * s, 0.25 * s).applyAxisAngle(UP, car.yaw).add(car.pos);
    this.camera.position.copy(seat);
    pl.yaw = car.yaw + Math.PI + (pl.lookYaw || 0);
    this.camera.rotation.set(pl.pitch, pl.yaw, 0, 'YXZ');
    this.camera.near = 0.05; this.camera.far = 1500; this.camera.updateProjectionMatrix();
    pl.vm.visible = false;
    pl.body.hideAll();
  }

  itemLanded(it, speed) {
    // a heavy thing dropped on tiny people crushes them
    const R = it.radius;
    for (const p of this.peopleNear(it.pos, R * 1.1)) {
      if (!p.alive || p.held || p.busyBody) continue;
      if (R < p.height * 0.5) continue;
      const rel = speed / Math.sqrt(9.8 * Math.max(p.height, 1e-3));
      if (rel < 1.5) continue;
      if (R > p.height * 3) p.squish(it.heldByLast === 'player' ? 'player' : null);
      else p.hurt({ dmg: rel * 12, type: 'blunt', point: p.center(new THREE.Vector3()), dir: new THREE.Vector3(0, -1, 0), cause: `was crushed by a falling ${it.def.label.toLowerCase()}` });
    }
    if (it.radius > 0.01) sfx('thud', { vol: this.audibleVol(it.pos, 0.5), pitch: clamp(0.04 / it.radius, 0.6, 3) });
  }

  // drowning, lava, quakes, wind (inside the cage)
  cageHazards(p, dt) {
    const c = this.cage;
    if (p.held || p.busyBody) return;
    // deep water
    if (!c.frozen && c.isWater(p.pos.x, p.pos.z) && c.waterDepth(p.pos.x, p.pos.z) > p.height * 0.95) {
      p.breath = (p.breath ?? 12) - dt * (p.has('athletic') ? 0.5 : 1);
      if (p.breath < 0) { p.health -= dt * 10; if (p.health <= 0) p.die('drowned', {}); }
      if (p.breath < 6 && rand() < dt * 0.6) p.say(rand.pick(['*glub*', 'Help! I can\'t swim!', '*gasp*']), { kind: 'scared', scream: true });
    } else p.breath = Math.min(12, (p.breath ?? 12) + dt * 3);
    // lava
    if (c.lavaPools.length && c.lavaAt(p.pos.x, p.pos.z)) { p.burning = 3; p.health -= dt * 25; if (p.health <= 0) p.die('burned to death in lava', {}); }
    // earthquake knocks people over
    if (c.weather.quake && rand() < dt * 0.35 && p.body.mode !== 'rag') { p.body.ragdoll(0.8 + rand()); p.body.push(_v.set((rand() - 0.5) * p.height * 2, p.height, (rand() - 0.5) * p.height * 2)); if (rand() < 0.3) p.say(rand.pick(['EARTHQUAKE!', 'The ground!', 'Get down!']), { kind: 'scared', scream: true }); }
    // wind from the fan (it blows toward -x)
    if (c.weather.wind && p.body.mode === 'rag') p.body.push(_v.set(-p.height * 0.6 * dt * 60 * 0.02, 0, 0));
  }

  lightningStrike(at) {
    sfx('thunder', { vol: this.zone === 'lab' ? 0.7 : 0.1 });
    this.fx.burst(at, [0xffffff, 0xbfd8ff], 30, 0.05, 1.5, { glow: true });
    for (let i = 0; i < 6; i++) this.fx.fire(at, 0.03);
    for (const p of this.peopleNear(at, 0.06)) if (p.alive) { p.hurt({ dmg: 70, type: 'shock', point: p.center(new THREE.Vector3()), cause: 'was struck by lightning' }); p.burning = 3; p.body.ragdoll(2); }
    const b = this.society.buildings.find((x) => Math.hypot(x.x - at.x, x.z - at.z) < x.r + 0.02);
    if (b && rand() < 0.5) this.society.smash(b, null);
  }

  newDay(d) {
    this.feed(`Day ${d} begins.`, 'warm');
    // money mode: the bank pays a little interest; listed gadgets sell
    if (this.mode === 'money' && this.ui) this.ui.dailyMoney && this.ui.dailyMoney(d);
  }

  // ------------------------------------------------------------- save / load
  save() {
    const pl = this.player;
    const tools = (arr) => arr.map((t) => (t && typeof t === 'object' ? JSON.parse(JSON.stringify(t)) : t));
    return {
      v: 1, name: this.worldName, mode: this.mode, money: this.money, time: this.world.time, day: this.world.day, speed: this.world.speed,
      player: { ...pl.save(), hotbar: tools(pl.hotbar), bottleLid: pl.bottleLid },
      backpack: tools(this.backpack), blueprints: this.blueprints, customLook: this.customLook,
      people: this.people.filter((p) => !(p.street && !p.inCage && p.scale > 0.3)).map((p) => p.save()),
      bugs: this.bugs.map((b) => b.save()),
      items: this.items.filter((it) => it.heldBy !== 'player' && it.heldBy !== 'bottle').map((it) => ({ ...it.save(), bp: it.bp, heldBy: it.heldBy && it.heldBy.id != null ? it.heldBy.id : null })),
      society: this.society.save(), cage: this.cage.save(), decals: this.fx.save(),
      jars: this.world.jars.map((j) => (j.occupant ? { id: j.id, who: j.occupant.id } : null)).filter(Boolean),
      street: { wanted: this.streetLife.wanted, missing: this.streetLife.posters.map((p) => p.id) },
      doors: { shelf: this.world.bookshelf.open, front: this.world.frontDoor.open },
      news: this.news.slice(-60), exp: this.exp ? this.exp.id : null,
      unlocks: [...(this.unlocks || [])], bank: this.bank || 0, listings: this.listings || [],
    };
  }

  load(d) {
    this.reset();
    this.worldName = d.name || 'My lab';
    this.mode = d.mode || 'creative';
    this.money = d.money || 0;
    this.world.time = d.time ?? 9.5; this.world.day = d.day || 1; this.world.speed = d.speed ?? 1;
    this.customLook = d.customLook || null;
    this.cage.load(d.cage);
    this.repairGlass();
    this.cage.glassHP = d.cage.glassHP ?? 100;
    this.blueprints = d.blueprints || [];
    this.backpack = d.backpack || [];
    for (const pd of d.people || []) {
      const p = Person.load(this, pd);
      p.street = false;
      p.objectForm = null;
      this.people.push(p); this.ids.set(p.id, p);
      p._tick = rand() * 0.5;
      if (pd.objectForm && pd.objectForm.type) this.gadgets.objectify(p, pd.objectForm.type, pd.objectForm.t ?? 1e9);
    }
    for (const bd of d.bugs || []) { const b = this.spawnBug(bd.type, new THREE.Vector3(...bd.p), bd.s, { id: bd.id, hp: bd.hp, alive: bd.alive, meat: bd.meat, hunger: bd.hunger, tame: bd.tame }); if (b && !bd.alive) b.die(); }
    for (const idt of d.items || []) {
      const it = this.spawnItem(idt.type, new THREE.Vector3(...idt.p), idt.s, { id: idt.id, pool: idt.pool, owner: idt.owner, yaw: idt.yaw, charge: idt.charge, bp: idt.bp });
      if (it && idt.heldBy != null) { const p = this.byId(idt.heldBy); if (p && p.alive) this.giveHeld(p, it); }
    }
    this.society.load(d.society || {});
    this.society.resolveRefs();
    this.fx.load(d.decals);
    for (const jd of d.jars || []) { const j = this.world.jars.find((x) => x.id === jd.id); const o = this.byId(jd.who); if (j && o) this.putInJar(j, { kind: o.isBug ? 'bug' : 'person', ref: o }); }
    for (const p of this.people) if (p.loc === 'jar' && !this.world.jars.some((j) => j.occupant === p)) p.loc = 'world';
    if (d.exp) { const p = this.byId(d.exp); if (p) this.putOnTable(p); }
    for (const p of this.people) if (p.loc === 'table' && this.exp !== p) p.loc = 'world';
    for (const p of this.people) if (p.loc === 'chamber' || p.loc === 'held' || p.loc === 'bottle' || p.loc === 'car') p.loc = this.cage.insideBox(p.pos) ? 'cage' : 'world';
    this.rebuildGraffiti();
    const pl = this.player;
    pl.load(d.player);
    pl.hotbar = d.player.hotbar || pl.hotbar;
    pl.bottleLid = d.player.bottleLid ?? true;
    pl.setGadgetMesh();
    this.world.bookshelf.open = !!(d.doors && d.doors.shelf); this.world.frontDoor.open = !!(d.doors && d.doors.front);
    this.streetLife.setup();
    this.streetLife.wanted = (d.street && d.street.wanted) || 0;
    this.news = d.news || [];
    this.unlocks = new Set(d.unlocks || []); this.bank = d.bank || 0; this.listings = d.listings || [];
    this.nav.rebuild();
    this.rebuildShore();
    this.running = true;
  }
}

export { CAGE, LAB, HOUSE, STAIRS, TINY, Car, makeObjectMesh, lerp };
