// Real bugs at real size. To a 3 cm person a praying mantis is a monster twice their height.
import * as THREE from 'three';
import { std } from '../world/materials.js';
import { rand, clamp, angleDiff, nextId, bumpId, lerp } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { CAGE } from '../world/cage.js';

// len = body length in meters
export const BUGS = {
  mantis: { label: 'Praying mantis', len: 0.08, hp: 120, speed: 0.05, hunter: true, legs: 4, color: 0x7fae4a, dmg: 34, cut: true, price: 12, meat: 6 },
  spider: { label: 'Jumping spider', len: 0.014, hp: 45, speed: 0.06, hunter: true, legs: 8, color: 0x2a2420, dmg: 14, poison: true, price: 8, meat: 2, jumper: true },
  beetle: { label: 'Rhino beetle', len: 0.04, hp: 140, speed: 0.025, legs: 6, color: 0x2a1a10, dmg: 10, price: 10, meat: 6, rideable: true },
  roach: { label: 'Cockroach', len: 0.03, hp: 50, speed: 0.12, legs: 6, color: 0x5a2e14, dmg: 4, scavenger: true, price: 3, meat: 3 },
  ant: { label: 'Ant', len: 0.006, hp: 10, speed: 0.04, legs: 6, color: 0x3a1a10, dmg: 2, scavenger: true, price: 1, meat: 1 },
  grasshopper: { label: 'Grasshopper', len: 0.035, hp: 40, speed: 0.04, legs: 6, color: 0x6a9a3a, dmg: 2, price: 3, meat: 4, hopper: true },
  // pets (bought on the lab computer). Real sizes: to a 3 cm person a hamster is a fluffy bear.
  cat: { label: 'Cat', len: 0.46, hp: 300, speed: 0.55, hunter: true, legs: 4, color: 0x8a6a4a, dmg: 30, pet: true, price: 150, meat: 20, desc: 'Hunts anything small that moves. Stares at the cage all day.', names: ['Whiskers', 'Mr. Biscuit', 'Shadow', 'Luna', 'Tiger', 'Pickles'] },
  dog: { label: 'Dog', len: 0.72, hp: 420, speed: 0.95, legs: 4, color: 0xb08050, dmg: 26, pet: true, price: 200, meat: 30, follows: true, desc: 'Follows you around and sniffs the cage. A tiny person on the floor looks like a snack.', names: ['Max', 'Buddy', 'Rocky', 'Bella', 'Duke', 'Chewie'] },
  hamster: { label: 'Hamster', len: 0.12, hp: 60, speed: 0.22, legs: 4, color: 0xd8a060, dmg: 9, pet: true, price: 30, meat: 6, desc: 'Drop it in the cage: to them it\'s a fluffy monster that steals food.', names: ['Nugget', 'Peanut', 'Fluffy', 'Cheeks'] },
  snake: { label: 'Corn snake', len: 0.9, hp: 220, speed: 0.16, hunter: true, legs: 0, color: 0xd06a30, dmg: 22, pet: true, price: 120, meat: 15, swallow: true, desc: 'Swallows tiny people whole.', names: ['Noodle', 'Slinky', 'Kaa', 'Danger Noodle'] },
  lizard: { label: 'Bearded dragon', len: 0.42, hp: 160, speed: 0.22, hunter: true, legs: 4, color: 0xc0a060, dmg: 18, pet: true, price: 60, meat: 10, desc: 'Eats bugs. And small people.', names: ['Spike', 'Rex', 'Ziggy', 'Godzilla'] },
  parrot: { label: 'Parrot', len: 0.34, hp: 80, speed: 0.3, legs: 2, color: 0x30b040, dmg: 10, pet: true, price: 180, meat: 5, talker: true, desc: 'Repeats things people say. Loud.', names: ['Captain', 'Kiwi', 'Polly', 'Mango'] },
  tarantula: { label: 'Tarantula', len: 0.11, hp: 90, speed: 0.08, hunter: true, legs: 8, color: 0x2a1a14, dmg: 20, poison: true, pet: true, price: 90, meat: 4, desc: 'A big hairy spider with venom.', names: ['Fang', 'Hairy Larry', 'Rosie'] },
};

function ell(rx, ry, rz, mat) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), mat); m.scale.set(rx, ry, rz); m.castShadow = true; return m; }
function seg(len, r, mat) { const g = new THREE.CylinderGeometry(r * 0.7, r, len, 6); g.translate(0, -len / 2, 0); const m = new THREE.Mesh(g, mat); m.castShadow = true; return m; }

export function buildBug(type) {
  const d = BUGS[type];
  const L = d.len;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const mat = std(d.color, type === 'beetle' || type === 'roach' ? 0.3 : 0.6, type === 'beetle' ? 0.3 : 0);
  const dark = std(new THREE.Color(d.color).multiplyScalar(0.6).getHex(), 0.5);
  const eye = std(0x111111, 0.2);
  const legs = [];
  const add = (o, x, y, z) => { o.position.set(x, y, z); body.add(o); return o; };
  let headZ = L * 0.45, hipY = L * 0.12, legLen = L * 0.5;
  switch (type) {
    case 'mantis': {
      add(ell(L * 0.07, L * 0.07, L * 0.32, mat), 0, L * 0.2, -L * 0.18);   // abdomen
      add(ell(L * 0.04, L * 0.04, L * 0.2, mat), 0, L * 0.26, L * 0.12).rotation.x = -0.6; // long thorax
      const h = add(ell(L * 0.06, L * 0.05, L * 0.05, mat), 0, L * 0.37, L * 0.24);
      for (const s of [-1, 1]) { const e = ell(L * 0.025, L * 0.03, L * 0.025, std(0x9acd5a, 0.3)); e.position.set(s * L * 0.05, L * 0.01, 0.0); h.add(e); }
      // wings
      for (const s of [-1, 1]) { const w = ell(L * 0.05, L * 0.006, L * 0.3, std(0x8ab85a, 0.5, 0, { transparent: true, opacity: 0.85 })); w.position.set(s * L * 0.03, L * 0.28, -L * 0.14); w.rotation.y = s * 0.08; body.add(w); }
      // raptor arms (the scary ones)
      for (const s of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(s * L * 0.035, L * 0.3, L * 0.2);
        const up = seg(L * 0.17, L * 0.018, mat); up.rotation.x = -2.3; arm.add(up);
        const fore = seg(L * 0.15, L * 0.014, dark); fore.position.set(0, -L * 0.115, L * 0.12); fore.rotation.x = 0.9; arm.add(fore);
        body.add(arm); legs.push({ g: arm, raptor: true, side: s });
      }
      headZ = L * 0.24; hipY = L * 0.2; legLen = L * 0.35;
      for (const [z, s] of [[0.05, -1], [0.05, 1], [-0.08, -1], [-0.08, 1]]) legs.push(makeLeg(body, s, L * z, hipY, legLen, mat));
      break;
    }
    case 'spider': {
      add(ell(L * 0.32, L * 0.28, L * 0.36, mat), 0, L * 0.35, -L * 0.3);
      const ceph = add(ell(L * 0.28, L * 0.22, L * 0.26, dark), 0, L * 0.35, L * 0.12);
      for (const [x, r] of [[-0.09, 0.08], [0.09, 0.08], [-0.2, 0.045], [0.2, 0.045]]) { const e = ell(L * r, L * r, L * r * 0.6, eye); e.position.set(L * x, L * 0.05, L * 0.24); ceph.add(e); }
      // fuzzy stripe
      add(ell(L * 0.33, L * 0.1, L * 0.2, std(0xd8d8d8, 0.9)), 0, L * 0.55, -L * 0.3);
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) legs.push(makeLeg(body, s, L * (0.22 - i * 0.09), L * 0.35, L * (0.7 + (i === 0 ? 0.15 : 0)), dark, 0.5 + i * 0.25));
      headZ = L * 0.3;
      break;
    }
    case 'beetle': {
      add(ell(L * 0.24, L * 0.16, L * 0.32, mat), 0, L * 0.2, -L * 0.08);
      add(ell(L * 0.2, L * 0.13, L * 0.14, mat), 0, L * 0.2, L * 0.24);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(L * 0.04, L * 0.3, 8), mat); horn.position.set(0, L * 0.32, L * 0.38); horn.rotation.x = -0.5; body.add(horn);
      for (const s of [-1, 1]) for (const z of [0.18, 0.02, -0.15]) legs.push(makeLeg(body, s, L * z, L * 0.14, L * 0.45, dark));
      headZ = L * 0.38;
      break;
    }
    case 'roach': {
      add(ell(L * 0.22, L * 0.08, L * 0.5, mat), 0, L * 0.1, 0);
      add(ell(L * 0.18, L * 0.06, L * 0.12, std(0x7a4a24, 0.4)), 0, L * 0.13, L * 0.38);
      for (const s of [-1, 1]) { const a = seg(L * 0.9, L * 0.01, dark); a.position.set(s * L * 0.06, L * 0.15, L * 0.5); a.rotation.set(-1.4, 0, s * 0.3); body.add(a); }
      for (const s of [-1, 1]) for (const z of [0.25, 0.0, -0.25]) legs.push(makeLeg(body, s, L * z, L * 0.08, L * 0.42, dark));
      headZ = L * 0.5;
      break;
    }
    case 'grasshopper': {
      add(ell(L * 0.1, L * 0.11, L * 0.42, mat), 0, L * 0.18, -L * 0.05);
      add(ell(L * 0.09, L * 0.11, L * 0.1, mat), 0, L * 0.2, L * 0.36);
      for (const s of [-1, 1]) { const big = seg(L * 0.45, L * 0.04, mat); big.position.set(s * L * 0.1, L * 0.22, -L * 0.05); big.rotation.set(1.2, 0, s * 0.2); body.add(big); }
      for (const s of [-1, 1]) for (const z of [0.25, 0.1]) legs.push(makeLeg(body, s, L * z, L * 0.12, L * 0.3, dark));
      headZ = L * 0.42;
      break;
    }
    case 'cat': case 'dog': case 'hamster': case 'lizard': {
      const fur = std(d.color, type === 'lizard' ? 0.6 : 0.95);
      const belly = std(new THREE.Color(d.color).lerp(new THREE.Color(0xffffff), 0.45).getHex(), 0.95);
      const legH = type === 'dog' ? 0.32 : type === 'cat' ? 0.24 : type === 'lizard' ? 0.08 : 0.07;
      const bodyLen = type === 'lizard' ? 0.42 : type === 'hamster' ? 0.38 : 0.48;
      add(ell(L * (type === 'lizard' ? 0.13 : type === 'hamster' ? 0.24 : 0.12), L * (type === 'hamster' ? 0.2 : 0.11), L * bodyLen * 0.5, fur), 0, L * (legH + 0.1), 0);
      add(ell(L * 0.09, L * 0.05, L * bodyLen * 0.4, belly), 0, L * (legH + 0.04), 0);
      const head = add(new THREE.Group(), 0, L * (legH + (type === 'lizard' ? 0.12 : 0.2)), L * bodyLen * 0.55);
      head.add(ell(L * (type === 'hamster' ? 0.15 : 0.09), L * (type === 'lizard' ? 0.05 : 0.085), L * 0.1, fur));
      if (type === 'dog') { const sn = ell(L * 0.05, L * 0.045, L * 0.08, belly); sn.position.set(0, -L * 0.02, L * 0.1); head.add(sn); const nose = ell(L * 0.02, L * 0.015, L * 0.015, std(0x111111, 0.3)); nose.position.set(0, -L * 0.005, L * 0.18); head.add(nose); }
      if (type === 'cat') { const nose = ell(L * 0.012, L * 0.01, L * 0.01, std(0xd07080, 0.4)); nose.position.set(0, -L * 0.01, L * 0.1); head.add(nose); }
      if (type === 'lizard') { const beard = ell(L * 0.08, L * 0.03, L * 0.06, std(0x8a6a30, 0.8)); beard.position.set(0, -L * 0.04, L * 0.02); head.add(beard); }
      for (const sx of [-1, 1]) {
        const eye = ell(L * 0.018, L * 0.02, L * 0.012, std(type === 'cat' ? 0xc0e040 : 0x111111, 0.15)); eye.position.set(sx * L * (type === 'hamster' ? 0.08 : 0.04), L * 0.025, L * 0.085); head.add(eye);
        if (type === 'cat') { const ear = new THREE.Mesh(new THREE.ConeGeometry(L * 0.03, L * 0.07, 6), fur); ear.position.set(sx * L * 0.045, L * 0.08, 0); head.add(ear); }
        if (type === 'dog') { const ear = ell(L * 0.03, L * 0.07, L * 0.02, std(new THREE.Color(d.color).multiplyScalar(0.7).getHex(), 0.95)); ear.position.set(sx * L * 0.07, L * 0.01, -L * 0.01); ear.rotation.z = sx * 0.3; head.add(ear); }
        if (type === 'hamster') { const ear = ell(L * 0.04, L * 0.04, L * 0.015, belly); ear.position.set(sx * L * 0.08, L * 0.1, -L * 0.02); head.add(ear); }
      }
      if (type !== 'hamster') { const tail = seg(L * (type === 'lizard' ? 0.6 : type === 'cat' ? 0.5 : 0.3), L * (type === 'lizard' ? 0.05 : 0.025), fur); tail.position.set(0, L * (legH + 0.12), -L * bodyLen * 0.48); tail.rotation.x = type === 'dog' ? -0.6 : type === 'cat' ? -0.3 : -1.5; body.add(tail); body.userData = { tail }; }
      for (const sx of [-1, 1]) for (const z of [0.32, -0.32]) {
        const hip = new THREE.Group(); hip.position.set(sx * L * (type === 'lizard' ? 0.12 : 0.08), L * (legH + 0.06), L * bodyLen * z);
        const leg = seg(L * (legH + 0.06), L * (type === 'lizard' ? 0.025 : 0.03), fur); if (type === 'lizard') leg.rotation.z = sx * 1.1; hip.add(leg); body.add(hip);
        legs.push({ g: hip, side: sx, z });
      }
      headZ = L * bodyLen * 0.6;
      break;
    }
    case 'snake': {
      const scales = std(d.color, 0.45);
      const band = std(0xf0d0a0, 0.5);
      const segs = [];
      for (let i = 0; i < 16; i++) {
        const r = L * 0.028 * (i === 0 ? 1.3 : 1 - i / 22);
        const m = ell(r, r * 0.85, L * 0.04, i % 3 === 1 ? band : scales);
        m.position.set(0, r, L * (0.32 - i * 0.045));
        body.add(m); segs.push(m);
      }
      for (const sx of [-1, 1]) { const e = ell(L * 0.008, L * 0.008, L * 0.006, std(0x111111, 0.2)); e.position.set(sx * L * 0.022, L * 0.045, L * 0.35); body.add(e); }
      root.userData = { legs: [], headZ: L * 0.35, segs };
      return root;
    }
    case 'parrot': {
      const feather = std(d.color, 0.7);
      add(ell(L * 0.11, L * 0.16, L * 0.12, feather), 0, L * 0.3, 0);
      const head = add(ell(L * 0.08, L * 0.08, L * 0.08, std(0xe0d020, 0.7)), 0, L * 0.5, L * 0.04);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(L * 0.03, L * 0.07, 8), std(0x2a2a2a, 0.4)); beak.position.set(0, -L * 0.01, L * 0.08); beak.rotation.x = 1.9; head.add(beak);
      for (const sx of [-1, 1]) { const e = ell(L * 0.015, L * 0.015, L * 0.01, std(0x111111, 0.2)); e.position.set(sx * L * 0.05, L * 0.02, L * 0.04); head.add(e); const w = ell(L * 0.03, L * 0.14, L * 0.1, std(0x2050d0, 0.7)); w.position.set(sx * L * 0.1, L * 0.3, -L * 0.02); body.add(w); }
      const tail = ell(L * 0.04, L * 0.02, L * 0.22, std(0xd03030, 0.7)); tail.position.set(0, L * 0.18, -L * 0.18); tail.rotation.x = 0.6; body.add(tail);
      for (const sx of [-1, 1]) legs.push(makeLeg(body, sx, 0, L * 0.16, L * 0.2, std(0x6a6a6a, 0.6), 0.2));
      headZ = L * 0.1;
      break;
    }
    case 'tarantula': {
      const hair = std(d.color, 0.98);
      add(ell(L * 0.3, L * 0.26, L * 0.34, hair), 0, L * 0.32, -L * 0.3);
      add(ell(L * 0.26, L * 0.18, L * 0.26, std(0x3a2418, 0.95)), 0, L * 0.3, L * 0.1);
      for (const sx of [-1, 1]) { const f = ell(L * 0.05, L * 0.05, L * 0.08, std(0x111111, 0.4)); f.position.set(sx * L * 0.05, L * 0.24, L * 0.36); body.add(f); }
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) legs.push(makeLeg(body, sx, L * (0.22 - i * 0.09), L * 0.3, L * (0.95 + (i === 0 ? 0.1 : 0)), std(0x3a2418, 0.98), 0.55 + i * 0.22));
      headZ = L * 0.3;
      break;
    }
    default: { // ant
      add(ell(L * 0.18, L * 0.16, L * 0.26, mat), 0, L * 0.18, -L * 0.3);
      add(ell(L * 0.09, L * 0.08, L * 0.17, mat), 0, L * 0.18, 0.0);
      const h = add(ell(L * 0.13, L * 0.12, L * 0.13, mat), 0, L * 0.2, L * 0.25);
      for (const s of [-1, 1]) { const a = seg(L * 0.35, L * 0.015, dark); a.position.set(s * L * 0.05, L * 0.08, L * 0.08); a.rotation.set(-1.0, 0, s * 0.5); h.add(a); }
      for (const s of [-1, 1]) for (const z of [0.08, 0.0, -0.08]) legs.push(makeLeg(body, s, L * z, L * 0.15, L * 0.42, dark));
      headZ = L * 0.3;
    }
  }
  root.userData = { legs, headZ };
  return root;
}

function makeLeg(body, side, z, y, len, mat, spread = 0.9) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.0001, y, z);
  const upper = seg(len * 0.5, len * 0.04, mat);
  upper.rotation.z = side * spread;
  hip.add(upper);
  const lower = seg(len * 0.6, len * 0.03, mat);
  lower.position.set(side * Math.sin(spread) * len * 0.5, -Math.cos(spread) * len * 0.5, 0);
  lower.rotation.z = -side * 0.35;
  hip.add(lower);
  body.add(hip);
  return { g: hip, side, upper, lower, z };
}

export class Bug {
  constructor(game, type, pos, opts = {}) {
    this.game = game;
    this.id = opts.id || nextId(); bumpId(this.id);
    this.type = type;
    this.def = BUGS[type];
    this.isBug = true;
    this.pos = pos.clone();
    this.yaw = rand() * Math.PI * 2;
    this.scale = opts.scale ?? 1;
    this.hp = opts.hp ?? this.def.hp * this.scale;
    this.alive = opts.alive ?? true;
    this.meat = opts.meat ?? this.def.meat;
    this.hunger = opts.hunger ?? 50 + rand() * 30;
    this.mesh = buildBug(type);
    this.mesh.scale.setScalar(this.scale);
    game.world.lab.add(this.mesh);
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.state = 'wander';
    this.t = 0; this.phase = rand() * 6;
    this.target = null;
    this.grabbed = null;
    this.tame = opts.tame || 0;
    this.held = false;
    this.name = this.def.label;
  }

  get size() { return this.def.len * this.scale; }
  get inCage() { return this.game.cage.inside(this.pos.x, this.pos.z) && this.pos.y < this.game.cageTopY; }
  get height() { return this.size * 0.4; }
  has() { return false; }
  skill() { return 0.5 + (this.def.hunter ? 1 : 0); }
  center(out = new THREE.Vector3()) { return out.copy(this.pos).add(new THREE.Vector3(0, this.size * 0.25, 0)); }
  headPos(out = new THREE.Vector3()) { return this.center(out); }
  dist(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }

  hurt(dmg, from, type) {
    if (!this.alive) return;
    this.hp -= dmg;
    const g = this.game;
    if (settings.gore !== 'none') g.fx.burst(this.center(new THREE.Vector3()), [0x9ac040, 0xc0d860], 5, this.size, 0.6);
    sfx('splat', { vol: g.audibleVol(this.pos, 0.5), pitch: 2 });
    if (from && from.id && this.def.hunter) this.target = from; // turns on whoever hits it
    else if (!this.def.hunter) { this.state = 'flee'; this.fleeFrom = from && from.pos ? from.pos.clone() : null; this.t = 0; }
    if (this.hp <= 0) this.die(from);
  }

  die(from) {
    this.alive = false;
    this.release();
    this.mesh.rotation.z = Math.PI; // legs up
    this.mesh.position.y += this.size * 0.15;
    const g = this.game;
    if (from && from.remember && from.alive) { g.feed(`${from.name} killed a ${this.def.label.toLowerCase()}`, '', from); from.remember('kill', `I killed a ${this.def.label.toLowerCase()}`, 6); }
    else if (from && from.name === 'you') g.feed(`You killed a ${this.def.label.toLowerCase()}`, '');
  }

  release() {
    if (this.grabbed) { const p = this.grabbed; p.body.unpin(); p.body.ragT = Math.min(p.body.ragT, 1); p.grabbedBy = null; this.grabbed = null; }
  }

  update(dt) {
    const g = this.game;
    if (!this.alive) { this.mesh.position.copy(this.pos); this.mesh.position.y = g.groundAt(this.pos.x, this.pos.z, this.pos.y + this.size) + this.size * 0.12; return; }
    if (this.held) { this.animLegs(dt, 3); return; }
    if (this.frozenT > 0) { this.frozenT -= dt; return; }
    this.hunger = Math.max(0, this.hunger - dt * 0.05);
    this.t += dt;
    const sp = this.def.speed * this.scale;
    let want = null, run = false;
    // a giant hand close by scares everything except a hungry mantis
    switch (this.state) {
      case 'wander':
        if (!this.dest || this.t > 6 || Math.hypot(this.dest.x - this.pos.x, this.dest.z - this.pos.z) < this.size * 0.5) {
          this.t = 0;
          this.dest = new THREE.Vector3(this.pos.x + (rand() - 0.5) * this.size * 12, 0, this.pos.z + (rand() - 0.5) * this.size * 12);
          const pl = g.player;
          if (this.def.follows && pl.height > 1 && Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) < 25 && Math.abs(pl.pos.y - this.pos.y) < 2) this.dest = new THREE.Vector3(pl.pos.x + (rand() - 0.5) * 1.5, 0, pl.pos.z + (rand() - 0.5) * 1.5);
          if (this.def.talker && rand() < 0.3) this.squawk();
          if (this.inCage) { this.dest.x = clamp(this.dest.x, CAGE.x0 + 0.02, CAGE.x1 - 0.02); this.dest.z = clamp(this.dest.z, CAGE.z0 + 0.02, CAGE.z1 - 0.02); }
          if (rand() < 0.3) this.dest = null;
        }
        if (this.dest) want = this.dest;
        // hunters look for prey when hungry
        if (this.def.hunter && this.hunger < 60 && rand() < dt * 2) {
          const mine = this.inCage;
          const prey = g.people.filter((p) => p.alive && !p.kid && !p.objectForm && !p.busyBody && p.inCage === mine && p.height < this.size * (this.def.pet ? 0.5 : 1.4) && p.dist(this.pos) < this.size * 8).sort((a, b) => a.dist(this.pos) - b.dist(this.pos))[0];
          if (prey) { this.target = prey; this.state = 'stalk'; this.t = 0; }
        }
        if (this.def.scavenger && rand() < dt) {
          const body = g.people.find((p) => !p.alive && !p.buried && p.dist(this.pos) < this.size * 15 && !p.objectForm);
          if (body) { this.target = body; this.state = 'scavenge'; this.t = 0; }
        }
        if (this.target && this.target.alive && this.def.hunter) this.state = 'stalk';
        // a tiny YOU looks like food too
        if (this.def.hunter && this.hunger < 70 && rand() < dt) {
          const pl = g.player;
          if (!pl.possess && pl.height < this.size * 1.4 && Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z) < this.size * 8 && Math.abs(pl.pos.y - this.pos.y) < this.size * 2) { this.state = 'stalkPlayer'; this.t = 0; }
        }
        break;
      case 'stalkPlayer': {
        const pl = g.player;
        const d = Math.hypot(pl.pos.x - this.pos.x, pl.pos.z - this.pos.z);
        if (pl.height > this.size * 1.6 || d > this.size * 14 || Math.abs(pl.pos.y - this.pos.y) > this.size * 3 || pl.health <= 0 || this.t > 40) { this.state = 'wander'; break; }
        this.face(pl.pos, dt);
        if (d < this.size * (this.type === 'mantis' ? 0.6 : 0.4)) {
          if (this.t > 0.9) {
            this.t = 0;
            if (this.type === 'mantis') pl.frozen = Math.max(pl.frozen, 0.7);
            pl.takeHit(this.def.dmg * (0.7 + rand() * 0.6) * 0.6, this, this.def.cut ? 'blade' : 'pierce');
            sfx('bite', { vol: 0.8 });
            if (this.def.poison && rand() < 0.4) { pl.frozen = Math.max(pl.frozen, 1.5); g.toast('The spider\'s venom! You can\'t move!'); }
          }
          break;
        }
        want = pl.pos; run = d < this.size * 2 && this.type !== 'mantis';
        if (this.def.jumper && d < this.size * 5 && this.t > 1) { this.jump(pl.pos); this.t = 0; }
        break;
      }
      case 'stalk': {
        const t = this.target;
        if (!t || !t.alive || t.busyBody || t.kid || t.inCage !== this.inCage) { this.state = 'wander'; this.target = null; break; }
        const d = t.dist(this.pos);
        // mantis: slow creep, then strike
        if (d < this.size * (this.type === 'mantis' ? 0.55 : 0.35)) { this.state = 'attack'; this.t = 0; break; }
        want = t.pos; run = d < this.size * 2 && this.type !== 'mantis';
        if (this.def.jumper && d < this.size * 5 && this.t > 1) { this.jump(t.pos); this.t = 0; }
        if (this.t > 30) { this.state = 'wander'; this.target = null; }
        break;
      }
      case 'attack': {
        const t = this.target;
        if (!t || !t.alive || t.busyBody) { this.release(); this.state = 'eat'; this.t = 0; break; }
        this.face(t.pos, dt);
        if (!this.grabbed && t.dist(this.pos) > this.size * 0.9) { this.state = 'stalk'; break; }
        if (this.type === 'mantis' && !this.grabbed && !t.kid) {
          // grab with the raptor arms
          this.grabbed = t; t.grabbedBy = this;
          t.body.ragdoll(99);
          t.say(rand.pick(['AAAH! GET IT OFF ME!', 'HELP! HELP!', 'NO NO NO NO']), { kind: 'scared', scream: true });
          g.feed(`A mantis grabbed ${t.name}!`, 'bad', t);
        }
        if (this.grabbed) {
          const hold = this.mesh.localToWorld(new THREE.Vector3(0, this.size * 0.3, this.size * 0.42));
          t.body.pin(1, hold);
        }
        if (this.def.swallow && t.height < this.size * 0.3 && !t.kid) {
          // swallowed whole
          g.feed(`The ${this.def.label.toLowerCase()} swallowed ${t.name} whole`, 'bad', t);
          t.say('NO NO NO NO-', { kind: 'scared', scream: true });
          t.die('was swallowed whole by a snake', { from: this });
          g.removePerson(t, true);
          this.hunger = 100; this.target = null; this.state = 'wander'; this.release();
          sfx('squish', { vol: g.audibleVol(this.pos, 0.8), pitch: 0.6 });
          break;
        }
        if (this.t > 0.9) {
          this.t = 0;
          const dir = new THREE.Vector3(Math.sin(this.yaw), 0.3, Math.cos(this.yaw));
          const parts = ['head', 'torso', 'lArm', 'rArm', 'lLeg', 'rLeg'];
          const dmg = this.def.dmg * (0.7 + rand() * 0.6);
          t.hurt({ dmg, type: this.def.cut ? 'bite' : 'pierce', from: this, dir, point: t.center(new THREE.Vector3()), part: rand.pick(parts), cause: 'was killed by a bug' });
          if (this.def.poison && t.alive && rand() < 0.5) { t.getSick('poison', 0.7); t.stun = 3; }
          sfx('bite', { vol: g.audibleVol(this.pos, 0.6) });
          if (!t.alive) { this.release(); this.state = 'eat'; this.t = 0; this.hunger = Math.min(100, this.hunger + 10); }
        }
        break;
      }
      case 'eat': case 'scavenge': {
        const t = this.target;
        if (!t || t.alive || t.buried) { this.state = 'wander'; this.target = null; break; }
        if (t.dist(this.pos) > this.size * 0.5) { want = t.pos; break; }
        if (this.t > 2) {
          this.t = 0;
          this.hunger = Math.min(100, this.hunger + 15);
          if (settings.gore === 'max' && rand() < 0.4) { const j = rand.pick(['lShoulder', 'rShoulder', 'lHip', 'rHip', 'lElbow', 'rElbow', 'lKnee', 'rKnee']); if (t.body.sever(j)) g.fx.blood(t.center(new THREE.Vector3()), new THREE.Vector3(0, 1, 0), t.height, 0.4); }
          t.eaten = (t.eaten || 0) + 1;
          if (this.hunger > 95) { this.state = 'wander'; this.target = null; }
        }
        break;
      }
      case 'flee': {
        if (this.fleeFrom) { const away = new THREE.Vector3(this.pos.x - this.fleeFrom.x, 0, this.pos.z - this.fleeFrom.z).normalize(); want = this.pos.clone().addScaledVector(away, this.size * 4); run = true; }
        if (this.t > 3) this.state = 'wander';
        break;
      }
      default: this.state = 'wander';
    }
    // move
    const sx = want ? want.x - this.pos.x : 0, sz = want ? want.z - this.pos.z : 0;
    const d = Math.hypot(sx, sz);
    const v = want && d > this.size * 0.2 ? sp * (run ? 2 : 1) * ((this.state === 'stalk' || this.state === 'stalkPlayer') && this.type === 'mantis' ? 0.4 : 1) : 0;
    const airborne = this.pos.y > g.groundAt(this.pos.x, this.pos.z, this.pos.y + this.size * 0.3) + this.size * 0.05;
    if (airborne) { /* keep flying the way it jumped */ } else if (v) { this.vel.set(sx / d * v, 0, sz / d * v); this.face(want, dt); } else this.vel.multiplyScalar(0.8);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    if (this.inCage || g.cage.inside(this.pos.x, this.pos.z)) g.cage.pushOut(this.pos, this.size * 0.3, this.size * 0.5);
    else g.world.colliders.resolve(this.pos, this.size * 0.3, this.size * 0.3, this.size * 0.2);
    // ground / gravity
    const gy = g.groundAt(this.pos.x, this.pos.z, this.pos.y + this.size * 0.3);
    if (this.pos.y > gy + 1e-4) { this.vy -= 9.8 * Math.sqrt(Math.max(this.size / 1.75, 0.002)) * dt; this.pos.y += this.vy * dt; if (this.pos.y < gy) { this.pos.y = gy; this.vy = 0; } }
    else { this.pos.y = gy; this.vy = 0; }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.animLegs(dt, v / Math.max(sp, 1e-6));
  }

  // the parrot repeats something a person said nearby (or something it heard you say)
  squawk() {
    const g = this.game;
    const heard = g.news.slice(-12).filter((n) => n.text.length < 60);
    const line = heard.length && Math.random() < 0.5 ? heard[Math.floor(Math.random() * heard.length)].text.toUpperCase() : ['HELLO!', 'PRETTY BIRD!', 'LET US OUT! LET US OUT!', 'BRAWK!', 'WHO\'S A GOOD SCIENTIST?', 'CRACKER!'][Math.floor(Math.random() * 6)];
    if (g.ui && g.audibleVol(this.pos, 1) > 0.05) { g.ui.bubble({ name: this.name, objectForm: null, held: false, headPos: (o) => this.center(o).add(new THREE.Vector3(0, this.size * 0.5, 0)), pos: this.pos, height: this.size, game: g, isPet: true }, line, 'chat', 3); sfx('bite', { vol: g.audibleVol(this.pos, 0.6), pitch: 2.4 }); }
  }

  jump(at) {
    this.vy = Math.sqrt(2 * 9.8 * this.size * 3) * 0.7;
    this.pos.y += 0.0005;
    const d = new THREE.Vector3(at.x - this.pos.x, 0, at.z - this.pos.z);
    this.vel.copy(d.multiplyScalar(2.2));
  }

  face(p, dt) { this.yaw += angleDiff(this.yaw, Math.atan2(p.x - this.pos.x, p.z - this.pos.z)) * Math.min(1, dt * 6); }

  animLegs(dt, speed) {
    this.phase += dt * (6 + speed * 14);
    const segs = this.mesh.userData.segs;
    if (segs) { segs.forEach((m, i) => { m.position.x = Math.sin(this.phase * 0.5 - i * 0.55) * this.def.len * 0.05 * (0.3 + Math.min(1, speed)); }); }
    const tail = this.mesh.children[0] && this.mesh.children[0].userData.tail;
    if (tail) tail.rotation.z = Math.sin(this.phase * 0.4) * 0.4;
    const legs = this.mesh.userData.legs;
    let i = 0;
    for (const l of legs) {
      if (l.raptor) { l.g.rotation.x = this.state === 'attack' ? Math.sin(this.phase * 2) * 0.6 - 0.3 : 0.15 + Math.sin(this.phase * 0.3) * 0.05; continue; }
      const off = (i % 2 ? Math.PI : 0) + Math.floor(i / 2) * 0.6;
      l.g.rotation.y = Math.sin(this.phase + off) * 0.35 * Math.min(1, speed + 0.1);
      l.g.rotation.x = Math.max(0, Math.cos(this.phase + off)) * 0.25 * Math.min(1, speed);
      i++;
    }
    if (this.type === 'mantis') this.mesh.children[0].rotation.z = Math.sin(this.phase * 0.25) * 0.05; // the creepy sway
  }

  remove() { this.release(); this.game.world.lab.remove(this.mesh); }

  save() { return { id: this.id, type: this.type, p: this.pos.toArray(), s: this.scale, hp: this.hp, alive: this.alive, meat: this.meat, hunger: this.hunger, tame: this.tame }; }
}

export { lerp };
