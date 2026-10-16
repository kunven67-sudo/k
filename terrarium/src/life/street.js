// Life outside: people walking, cars driving, witnesses, police, missing posters, your car.
import * as THREE from 'three';
import { STREET } from '../world/street.js';
import { roundedBox } from '../world/materials.js';
import { textTexture } from '../world/builder.js';
import { STREET_JOBS } from './looks.js';
import { TINY } from './items.js';
import { rand, clamp, angleDiff, nextId } from '../core/util.js';
import { sfx, setLoop } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { act, actPressed, input } from '../core/input.js';

const _v = new THREE.Vector3();
const G0 = STREET.ground;
const CAR_COLORS = [0xc0392b, 0x2471a3, 0xf4f6f7, 0x17202a, 0x7f8c8d, 0xd4ac0d, 0x1e8449, 0x6c3483, 0xba4a00, 0x34495e];

function buildCar(color, police = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: police ? 0x1a1f2a : color, roughness: 0.25, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a38, roughness: 0.1, metalness: 0.4 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(roundedBox(1.8, 0.6, 4.2, 0.18), paint, 0, 0.6, 0);
  add(roundedBox(1.6, 0.55, 2.2, 0.22), glass, 0, 1.12, -0.15);
  add(roundedBox(1.62, 0.12, 2.0, 0.06), paint, 0, 1.4, -0.15);
  if (police) { add(new THREE.BoxGeometry(1.82, 0.25, 1.3), new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.3 }), 0, 0.68, -0.2); g.userData.lights = [add(new THREE.BoxGeometry(0.4, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2020, emissiveIntensity: 2 }), -0.3, 1.52, -0.15), add(new THREE.BoxGeometry(0.4, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x2050ff, emissiveIntensity: 2 }), 0.3, 1.52, -0.15)]; }
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const t = add(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 18), tire, x, 0.36, z); t.rotation.z = Math.PI / 2;
    const r = add(new THREE.CylinderGeometry(0.2, 0.2, 0.27, 12), rim, x, 0.36, z); r.rotation.z = Math.PI / 2;
  }
  for (const x of [-0.6, 0.6]) {
    add(new THREE.BoxGeometry(0.35, 0.14, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 0.6 }), x, 0.65, 2.1);
    add(new THREE.BoxGeometry(0.35, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2020, emissiveIntensity: 0.5 }), x, 0.7, -2.1);
  }
  return g;
}

export class Car {
  constructor(game, opts = {}) {
    this.game = game;
    this.id = opts.id || nextId();
    this.isCar = true;
    this.police = !!opts.police;
    this.color = opts.color ?? rand.pick(CAR_COLORS);
    this.mesh = buildCar(this.color, this.police);
    game.scene.add(this.mesh);
    this.pos = (opts.pos || new THREE.Vector3()).clone();
    this.yaw = opts.yaw ?? 0;
    this.speed = opts.speed ?? 0;
    this.cruise = opts.cruise ?? 8 + rand() * 4;
    this.lane = opts.lane ?? null;
    this.scale = opts.scale ?? 1;
    this.occupants = [];
    this.held = false;
    this.parked = !!opts.parked;
    this.mine = !!opts.mine;
    this.vy = 0;
    this.frozenT = 0;
    this.name = this.police ? 'Police car' : 'Car';
    this.syncMesh();
  }

  get length() { return 4.2 * this.scale; }
  get size() { return this.length; }
  get radius() { return this.length * 0.5; }
  get inCage() { return this.game.cage.inside(this.pos.x, this.pos.z) && this.pos.y < this.game.cageTopY; }
  has() { return false; }

  setScale(s) {
    const k = s / this.scale;
    this.scale = s;
    // everyone inside shrinks with the car
    for (const p of this.occupants) { p.scale *= k; p.body.rescale(p.scale); }
    this.syncMesh();
  }

  push(v) { this.vel = (this.vel || new THREE.Vector3()).copy(v); this.airborne = true; }

  dropped(vel) { this.vel = vel.clone(); this.airborne = true; this.parked = true; this.speed = 0; }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.mesh.scale.setScalar(this.scale);
    for (const p of this.occupants) { p.pos.copy(this.pos); p.body.hidden = true; }
  }

  update(dt) {
    const g = this.game;
    if (this.held) { this.syncMesh(); return; }
    if (this.frozenT > 0) { this.frozenT -= dt; return; }
    // flying / falling (thrown, pushed, dropped)
    const gy = g.groundAt(this.pos.x, this.pos.z, this.pos.y + this.length * 0.3);
    if (this.airborne || this.pos.y > gy + 0.001 * this.scale) {
      const v = this.vel || (this.vel = new THREE.Vector3());
      v.y -= 9.8 * Math.sqrt(this.scale) * dt;
      this.pos.addScaledVector(v, dt);
      const ng = g.groundAt(this.pos.x, this.pos.z, this.pos.y + this.length * 0.3);
      if (this.pos.y <= ng) {
        const hard = -v.y / Math.sqrt(9.8 * Math.sqrt(this.scale) * this.length);
        this.pos.y = ng; this.airborne = false; v.set(0, 0, 0);
        if (hard > 3) { sfx('crack', { vol: g.audibleVol(this.pos, 1) }); for (const p of this.occupants) p.hurt({ dmg: hard * 10, type: 'crush', cause: 'died in a car crash' }); }
        // landed in the cage: the people inside climb out
        if (this.inCage && this.occupants.length) this.unload();
      }
      if (this.inCage) g.cage.pushOut(this.pos, this.length * 0.35, 1);
      this.syncMesh();
      return;
    }
    this.pos.y = gy;
    if (this.mine && g.driving === this) { this.drive(dt); this.syncMesh(); return; }
    if (this.parked || this.scale < 0.6) { this.speed = Math.max(0, this.speed - dt * 10); this.syncMesh(); return; }
    // follow the lane
    let target = this.cruise;
    const fwd = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    // brake for people / the player / other cars ahead
    const ahead = this.pos.clone().addScaledVector(fwd, 6);
    for (const p of g.streetLife.walkers) if (p.alive && p.scale > 0.3 && Math.hypot(p.pos.x - ahead.x, p.pos.z - ahead.z) < 3.2) target = 0;
    if (Math.hypot(g.player.pos.x - ahead.x, g.player.pos.z - ahead.z) < 3 * Math.max(1, g.player.scale) && g.player.scale > 0.3) { target = 0; if (!this.honk || g.time - this.honk > 4) { this.honk = g.time; sfx('horn', { vol: g.audibleVol(this.pos, 1) }); } }
    for (const c of g.streetLife.cars) if (c !== this && !c.held && c.pos.distanceTo(ahead) < 4 && Math.abs(angleDiff(c.yaw, this.yaw)) < 0.5) target = Math.min(target, c.speed * 0.8);
    this.speed += clamp(target - this.speed, -12 * dt, 4 * dt);
    this.pos.addScaledVector(fwd, this.speed * dt);
    // wrap around the ends of the road (far away in the fog)
    const R = STREET.road;
    if (this.lane === 'east' && this.pos.x > R.x1 - 3) this.pos.x = R.x0 + 3;
    if (this.lane === 'west' && this.pos.x < R.x0 + 3) this.pos.x = R.x1 - 3;
    if (this.lane === 'north' && this.pos.z < STREET.cross.z0 + 3) this.pos.z = STREET.cross.z1 - 3;
    if (this.lane === 'south' && this.pos.z > STREET.cross.z1 - 3) this.pos.z = STREET.cross.z0 + 3;
    if (this.police && this.mesh.userData.lights) { const on = Math.sin(g.time * 12) > 0; this.mesh.userData.lights[0].material.emissiveIntensity = on ? 3 : 0.2; this.mesh.userData.lights[1].material.emissiveIntensity = on ? 0.2 : 3; }
    this.syncMesh();
  }

  drive(dt) {
    const g = this.game;
    let thr = 0, steer = 0;
    if (!input.typing) { if (act('forward')) thr = 1; if (act('back')) thr = -0.6; if (act('left')) steer = 1; if (act('right')) steer = -1; }
    this.speed += (thr * 14 - this.speed * 0.6 * (thr ? 0.2 : 1)) * dt;
    if (act('jump')) this.speed *= Math.pow(0.1, dt);
    this.speed = clamp(this.speed, -6, 22);
    this.yaw += steer * dt * clamp(this.speed / 6, -1, 1) * 1.2;
    const fwd = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const next = this.pos.clone().addScaledVector(fwd, this.speed * dt);
    const test = next.clone();
    g.world.colliders.resolve(test, 1.2, 1.4, 0.4);
    if (test.distanceTo(next) > 0.05) { if (Math.abs(this.speed) > 6) { sfx('crack', { vol: 0.8 }); g.player.camShake = 0.5; } this.speed *= -0.3; }
    else this.pos.copy(next);
    // run people over (they're real people)
    for (const p of g.streetLife.walkers) {
      if (!p.alive || p.kid || p.scale < 0.3) continue;
      if (Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < 1.6 && Math.abs(this.speed) > 3) {
        p.hurt({ dmg: Math.abs(this.speed) * 6, type: 'blunt', from: 'player', dir: fwd.clone().setY(0.4), point: p.center(new THREE.Vector3()), cause: 'was hit by your car' });
        g.witness('hit-and-run', p.pos, p);
      }
    }
    setLoop('engine', 0.15 + Math.abs(this.speed) / 40);
    g.player.pos.copy(this.pos).add(_v.set(0, 0.2, 0));
  }

  unload() {
    const g = this.game;
    for (const p of this.occupants) {
      p.loc = g.cage.inside(this.pos.x, this.pos.z) ? 'cage' : 'world';
      p.body.hidden = false;
      const off = new THREE.Vector3((rand() - 0.5) * this.length * 0.6, 0, (rand() - 0.5) * this.length * 0.6);
      p.pos.copy(this.pos).add(off);
      p.body.teleport(p.pos.x - p.body.p[6], p.pos.y - p.body.p[7] + p.height * 0.5, p.pos.z - p.body.p[8]);
      p.street = false;
      p.say(rand.pick(['Where... where are we?!', 'What happened to the car?!', 'Oh my god. OH MY GOD.', 'Is this a fish tank?!']), { kind: 'scared' });
      g.feed(`${p.name} climbed out of the shrunken car`, '', p);
    }
    this.occupants = [];
    this.parked = true;
  }

  remove() { this.game.scene.remove(this.mesh); }
  save() { return { id: this.id, p: this.pos.toArray(), yaw: this.yaw, s: this.scale, color: this.color, police: this.police, parked: this.parked, mine: this.mine, lane: this.lane }; }
}

export class StreetLife {
  constructor(game) {
    this.game = game;
    this.walkers = [];
    this.cars = [];
    this.wanted = 0;
    this.wantedT = 0;
    this.posters = [];
    this.missing = [];
    this.spawnT = 0;
    this.police = [];
  }

  setup() {
    const g = this.game;
    // your car in the driveway
    this.myCar = new Car(g, { pos: g.world.driveway.clone(), yaw: Math.PI, color: 0x2f6a8a, parked: true, mine: true });
    this.cars.push(this.myCar);
    g.world.interactables.push({ id: 'mycar', label: 'Your car (drive)', pos: g.world.driveway.clone().add(new THREE.Vector3(0, 1, 0)), r: 2.4, zone: 'street', car: this.myCar });
    for (let i = 0; i < 6; i++) this.spawnCar(true);
    for (const s of g.world.parkingSpots.slice(0, 5)) { const c = new Car(g, { pos: s.clone(), yaw: Math.PI, parked: true }); this.cars.push(c); if (rand() < 0.3) this.fillCar(c, 1); }
    for (let i = 0; i < 12; i++) this.spawnWalker(true);
  }

  spawnCar(anywhere = false) {
    const g = this.game;
    const R = STREET.road, X = STREET.cross;
    const lane = rand.pick(['east', 'west', 'east', 'west', 'north', 'south']);
    let pos, yaw;
    if (lane === 'east') { pos = new THREE.Vector3(anywhere ? R.x0 + rand() * (R.x1 - R.x0) : R.x0 + 4, G0, 16); yaw = Math.PI / 2; }
    else if (lane === 'west') { pos = new THREE.Vector3(anywhere ? R.x0 + rand() * (R.x1 - R.x0) : R.x1 - 4, G0, 20); yaw = -Math.PI / 2; }
    else if (lane === 'north') { pos = new THREE.Vector3(30, G0, anywhere ? X.z0 + rand() * (X.z1 - X.z0) : X.z1 - 4); yaw = Math.PI; }
    else { pos = new THREE.Vector3(26, G0, anywhere ? X.z0 + rand() * (X.z1 - X.z0) : X.z0 + 4); yaw = 0; }
    if (this.cars.some((c) => c.pos.distanceTo(pos) < 10)) return null;
    const c = new Car(g, { pos, yaw, lane });
    this.cars.push(c);
    this.fillCar(c, 1 + (rand() < 0.4 ? 1 : 0) + (rand() < 0.15 ? 1 : 0));
    return c;
  }

  fillCar(c, n) {
    const g = this.game;
    for (let i = 0; i < n; i++) {
      const p = g.spawnPerson({ scale: 1, pos: c.pos.clone(), street: true, job: rand.pick(STREET_JOBS), op: -20, fear: 30, loc: 'car' });
      p.inCar = c;
      p.body.hidden = true;
      c.occupants.push(p);
    }
  }

  spawnWalker(anywhere = false) {
    const g = this.game;
    const R = STREET.road;
    const side = rand() < 0.5 ? STREET.walkNear : STREET.walkFar;
    const x = anywhere ? R.x0 + 10 + rand() * (R.x1 - R.x0 - 20) : rand() < 0.5 ? R.x0 + 6 : R.x1 - 6;
    const p = g.spawnPerson({ scale: 1, pos: new THREE.Vector3(x, G0 + 0.1, side + (rand() - 0.5) * 1.2), street: true, job: rand.pick(STREET_JOBS), op: -20, fear: 25, loc: 'world' });
    p.walkDir = rand() < 0.5 ? 1 : -1;
    p.lane = side;
    this.walkers.push(p);
    // sometimes a parent walks with a kid (kids can't be zapped or grabbed)
    if (rand() < 0.22) {
      const kid = g.spawnPerson({ scale: 1, age: 'kid', pos: p.pos.clone().add(new THREE.Vector3(0.6, 0, 0.4)), street: true, parents: [p.id], last: p.last, op: 0, fear: 20, loc: 'world' });
      kid.walkDir = p.walkDir; kid.lane = side; kid.parentRef = p;
      p.kids.push(kid.id);
      this.walkers.push(kid);
    }
    return p;
  }

  // AI for normal-size people on the street
  updatePerson(p, dt) {
    const g = this.game;
    const pl = g.player;
    if (p.inCar) { p.pos.copy(p.inCar.pos); return; }
    p.anim.action = null;
    // panic: run away from the scientist after seeing something
    if (p.panicT > 0) {
      p.panicT -= dt;
      const away = _v.set(p.pos.x - pl.pos.x, 0, p.pos.z - pl.pos.z).normalize();
      p.moveTo(p.pos.clone().addScaledVector(away, 8), true);
      if (p.calling && settings.witnesses === 'police') { p.anim.action = 'talk'; }
      if (rand() < dt * 0.6 && g.time - p.lastSpeak > 3) p.say(rand.pick(p.kid ? ['MOMMY!', 'DADDY HELP!', 'Help!'] : ['HELP! SOMEBODY HELP!', 'Did you SEE that?!', 'Call the police!', 'RUN!', 'What the hell was that?!']), { kind: 'scared', scream: true });
      return;
    }
    // kids stay with their parent
    if (p.kid && p.parentRef) {
      const par = p.parentRef;
      if (par.alive && par.scale > 0.3 && !par.held && par.loc !== 'bottle') { const d = p.dist(par.pos); if (d > 1.2) p.moveTo(par.pos.clone().add(_v.set(0.5, 0, 0.5)), d > 4); else p.stop(); return; }
      // parent got taken: the kid cries and looks for them
      if (!p.lostCried) { p.lostCried = true; p.say(rand.pick(['MOM?! MOM WHERE ARE YOU?!', 'DAD?! DADDY!', 'Where did my mom go?!']), { kind: 'scared', scream: true }); }
      p.anim.action = 'cry'; p.stop();
      return;
    }
    // stop and stare at a giant
    if (pl.scale > 2.5 && p.dist(pl.pos) < pl.height * 3) { this.panic(p, 'giant'); return; }
    // normal walking along the sidewalk
    if (!p.goal || p.arrived()) {
      const R = STREET.road;
      let tx = p.pos.x + p.walkDir * (10 + rand() * 20);
      if (tx > R.x1 - 6 || tx < R.x0 + 6) { // walked off the end: comes back later as someone new
        if (!p.seenByPlayer || p.dist(pl.pos) > 40) { g.removePerson(p); return; }
        p.walkDir *= -1; tx = p.pos.x + p.walkDir * 10;
      }
      // sometimes pop into a shop or stop at the bus stop
      if (rand() < 0.08) { const door = rand.pick(g.world.shopDoors); tx = door.x; p.moveTo(new THREE.Vector3(door.x, 0, door.z), false); p.enteringShop = true; return; }
      p.moveTo(new THREE.Vector3(tx, 0, p.lane + (rand() - 0.5) * 1.2), false);
    }
    if (p.enteringShop && p.arrived(1.2)) { if (p.dist(pl.pos) > 25) { g.removePerson(p); return; } p.enteringShop = false; }
    if (rand() < dt * 0.02 && g.time - p.lastSpeak > 20 && p.dist(pl.pos) < 12) p.say(rand.pick(['Nice day.', 'Ugh, Mondays.', 'Have you seen the news? People keep going missing around here.', 'I need coffee.', 'Is that guy in a lab coat?', 'Hm.']), { kind: 'chat' });
    if (pl.form === 'scientist' && p.dist(pl.pos) < 3 && !p.greeted && pl.scale > 0.7 && pl.scale < 1.6) { p.greeted = true; p.say(rand.pick(['Hey neighbor.', 'Morning.', 'Nice coat.', 'You\'re the guy from 1428, right?']), { kind: 'chat' }); }
  }

  panic(p, why) {
    if (p.panicT > 0) return;
    p.panicT = 8 + rand() * 6;
    p.fear = 100;
    if (!p.kid && rand() < 0.5 && settings.witnesses === 'police') p.calling = true;
  }

  // someone did something to someone on the street. Who saw it?
  witness(kind, at, victim) {
    const g = this.game;
    if (settings.witnesses === 'none') return;
    let seen = 0;
    for (const w of this.walkers) {
      if (!w.alive || w === victim || w.scale < 0.3 || w.inCar) continue;
      const d = w.pos.distanceTo(at);
      if (d > 28) continue;
      // can they see it? (rough: not through buildings)
      const hit = g.world.colliders.raycast(w.headPos(new THREE.Vector3()), at.clone().sub(w.headPos(new THREE.Vector3())).normalize(), d - 0.5);
      if (hit) continue;
      seen++;
      this.panic(w, kind);
    }
    if (seen && settings.witnesses === 'police') {
      this.wanted = Math.min(5, this.wanted + (kind === 'shrink' ? 1 : kind === 'hit-and-run' ? 2 : 0.5));
      this.wantedT = 90;
      if (this.wanted >= 1 && !this.police.length) this.callPolice();
      g.feed(seen > 1 ? `${seen} people saw that` : 'Someone saw that', 'bad');
    }
    if (victim && victim.street && !this.missing.includes(victim)) this.missing.push(victim);
  }

  callPolice() {
    const g = this.game;
    const c = new Car(g, { police: true, pos: new THREE.Vector3(STREET.road.x0 + 4, G0, 16), yaw: Math.PI / 2, lane: 'east', cruise: 14 });
    this.cars.push(c);
    for (let i = 0; i < 2; i++) {
      const cop = g.spawnPerson({ scale: 1, job: 'cop', pos: c.pos.clone(), street: true, loc: 'car', op: -30, fear: 0 });
      cop.inCar = c; cop.isCop = true; c.occupants.push(cop);
      this.police.push(cop);
    }
    this.policeCar = c;
    sfx('siren', { vol: 0.7 });
    g.toast('Someone called the police.');
  }

  update(dt) {
    const g = this.game;
    const outside = g.zone === 'street' || g.zone === 'house';
    // cars
    for (const c of this.cars) c.update(dt);
    // keep the street busy
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 6;
      const adults = this.walkers.filter((p) => p.alive && p.scale > 0.3 && !p.kid).length;
      if (adults < 11) this.spawnWalker(false);
      const moving = this.cars.filter((c) => !c.parked && !c.mine && !c.police && c.scale > 0.6).length;
      if (moving < 6) this.spawnCar(false);
    }
    // police: park near your house, cops walk up and look around
    if (this.policeCar) {
      const c = this.policeCar;
      if (!c.parked && Math.abs(c.pos.x - 2) < 4 && c.lane === 'east') { c.parked = true; c.speed = 0; for (const cop of c.occupants) { cop.inCar = null; cop.body.hidden = false; cop.loc = 'world'; cop.pos.copy(c.pos).add(_v.set((rand() - 0.5) * 2, 0, -1.5)); cop.body.teleport(cop.pos.x - cop.body.p[6], cop.pos.y - cop.body.p[7] + 1, cop.pos.z - cop.body.p[8]); cop.patrolT = 60; } c.occupants = []; this.posterT = 0; }
      for (const cop of this.police) {
        if (!cop.alive || cop.inCar || cop.scale < 0.3) continue;
        cop.anim.action = null;
        const pl = g.player;
        const d = cop.dist(pl.pos);
        if (this.wanted >= 3 && d < 14 && pl.scale > 0.4 && pl.scale < 2.5 && g.zone === 'street') {
          cop.moveTo(pl.pos.clone(), true);
          if (rand() < dt * 0.5) cop.say(rand.pick(['STOP RIGHT THERE!', 'Hands where I can see them!', 'Freeze!']), { kind: 'angry' });
          if (d < 1.4) this.busted();
        } else if (!cop.goal || cop.arrived()) cop.moveTo(new THREE.Vector3(-6 + rand() * 14, 0, 8 + rand() * 6), false);
        cop.patrolT -= dt;
      }
      // cops leave after a while if nothing happens
      if (this.wanted <= 0 && this.police.every((cp) => cp.patrolT <= 0)) this.policeLeave();
    }
    if (this.wantedT > 0) { this.wantedT -= dt; if (this.wantedT <= 0) this.wanted = Math.max(0, this.wanted - 1), this.wantedT = this.wanted ? 60 : 0; }
    // missing posters go up for people you took
    this.posterT = (this.posterT || 0) - dt;
    if (this.missing.length && this.posterT <= 0) { this.posterT = 30; this.addPoster(this.missing.shift()); }
    // only draw street people when you can see the street
    for (const p of this.walkers) if (!p.inCar && p.scale > 0.3) p.body.hidden = !outside;
    if (outside) setLoop('traffic', 0.15); else setLoop('traffic', 0);
  }

  busted() {
    const g = this.game;
    g.toast('BUSTED! The cops took you in. You paid a fine and they let you go (no proof).');
    sfx('siren');
    if (g.mode === 'money') g.addMoney(-Math.min(g.money, 200 * this.wanted), 'Police fine');
    if (g.player.holding) g.player.drop(true);
    this.wanted = 0; this.wantedT = 0;
    g.player.pos.set(0, 3.45, 4.5);
    this.policeLeave();
  }

  policeLeave() {
    const g = this.game;
    for (const cop of this.police) if (cop.alive && cop.scale > 0.3) g.removePerson(cop);
    this.police = [];
    if (this.policeCar) { this.cars.splice(this.cars.indexOf(this.policeCar), 1); this.policeCar.remove(); this.policeCar = null; }
  }

  addPoster(p) {
    const g = this.game;
    const lamp = g.world.streetLamps[this.posters.length % g.world.streetLamps.length];
    if (!lamp) return;
    const c = document.createElement('canvas'); c.width = 256; c.height = 340;
    const x = c.getContext('2d');
    x.fillStyle = '#f4f0e4'; x.fillRect(0, 0, 256, 340);
    x.fillStyle = '#c0392b'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('MISSING', 128, 46);
    // a simple drawn face in their colors
    x.fillStyle = '#' + new THREE.Color(p.look.skin).getHexString(); x.beginPath(); x.arc(128, 140, 60, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#' + new THREE.Color(p.look.hairColor).getHexString(); x.beginPath(); x.arc(128, 115, 62, Math.PI, 0); x.fill();
    x.fillStyle = '#222'; x.beginPath(); x.arc(108, 140, 7, 0, 6.3); x.arc(148, 140, 7, 0, 6.3); x.fill();
    x.fillStyle = '#111'; x.font = 'bold 26px Arial'; x.fillText(`${p.name} ${p.last}`, 128, 240);
    x.font = '18px Arial'; x.fillText(`Age ${p.ageYears}. Last seen on this street.`, 128, 270); x.fillText('If you know anything call', 128, 300); x.fillText('555-0142', 128, 322);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
    m.position.set(lamp.position.x, G0 + 1.6, lamp.position.z < 18 ? lamp.position.z - 0.95 : lamp.position.z + 0.95);
    g.world.street.add(m);
    this.posters.push({ id: p.id, mesh: m });
    g.feed(`Missing posters for ${p.name} went up on the street`, 'warm');
  }

  enterCar(car) {
    const g = this.game;
    if (g.driving) { this.exitCar(); return; }
    if (g.player.scale > 1.6 || g.player.scale < 0.6) { g.toast('You\'re not the right size to drive.'); return; }
    g.driving = car;
    car.parked = false;
    g.toast('Driving. WASD to drive, Space to brake, E to get out.');
    sfx('door');
  }

  exitCar() {
    const g = this.game;
    const car = g.driving;
    if (!car) return;
    g.driving = null;
    car.parked = true; car.speed = 0;
    setLoop('engine', 0);
    g.player.pos.copy(car.pos).add(_v.set(Math.cos(car.yaw) * 1.6, 0.3, -Math.sin(car.yaw) * 1.6));
    sfx('door');
  }

  removeCar(c) { const i = this.cars.indexOf(c); if (i >= 0) this.cars.splice(i, 1); c.remove(); }
}

export { TINY, clamp };
