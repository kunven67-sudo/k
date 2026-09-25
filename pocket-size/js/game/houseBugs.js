// Bugs that actually live in houses, at true scale next to a 1.8cm person: sugar ants in the
// kitchen, house flies and fruit flies, silverfish in the bathroom, a daddy long-legs in the
// corner, bed bugs and a house centipede under the bed, a moth by the window, a ladybug.
import * as THREE from 'three';
import { Creature, hexapod, insectLeg, glossy, angDiff } from './creature.js';
import { Ant, ellipsoid, makeWeb } from './bugs.js';
import { sfx, loop } from '../core/audio.js';
import * as TX from '../core/textures.js';
import { G } from './state.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class SugarAnt extends Ant {
  constructor() {
    super();
    this.name = 'Sugar Ant';
    this.maxHp = this.hp = 8;
    this.dmg = 3;
    this.speed = 5;
    this.deathCause = 'housebugs';
    this.body.radius = 0.25; this.body.height = 0.25; this.body.stepHeight = 0.3;
    this.attackRange = 0.8;
    this.aggroRange = 4;
    this.loot = [];
    this.group.scale.setScalar(0.45);
  }
}

export class HouseFly extends Creature {
  constructor(tiny = false) {
    super({ name: tiny ? 'Fruit Fly' : 'House Fly', hp: tiny ? 3 : 14, radius: tiny ? 0.15 : 0.4, height: tiny ? 0.2 : 0.5, speed: tiny ? 5 : 10, damage: tiny ? 0 : 2, deathCause: 'housebugs', flying: true });
    this.isBug = true;
    this.tiny = tiny;
    this.passive = tiny;
    this.aggroRange = 9; this.leashRange = 70; this.attackRange = 1; this.attackDelay = 2.5;
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.6; this.group.add(b);
    const dark = new THREE.MeshStandardMaterial({ color: tiny ? 0x9a7a4a : 0x2a2a2e, roughness: 0.6 });
    ellipsoid(0.16, 1, 0.9, 1.1, dark, 0, 0.02, 0.05, b);
    ellipsoid(0.17, 1, 0.8, 1.3, new THREE.MeshStandardMaterial({ color: tiny ? 0xb08a50 : 0x4a4a50, roughness: 0.5 }), 0, 0, -0.22, b);
    ellipsoid(0.12, 1.2, 1, 0.9, dark, 0, 0.03, 0.26, b);
    const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x9a1a10, roughness: 0.25, clearcoat: 1 });
    [-1, 1].forEach((s) => ellipsoid(0.08, 0.8, 1.1, 1, eyeM, 0.08 * s, 0.05, 0.3, b));
    const wingM = new THREE.MeshPhysicalMaterial({ color: 0xe8eef8, transparent: true, opacity: 0.3, roughness: 0.1, side: THREE.DoubleSide, iridescence: 1, depthWrite: false });
    this.wings = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.5), wingM); w.geometry.translate(0, -0.25, 0); w.position.set(0.08 * s, 0.12, 0.05); w.rotation.set(-Math.PI / 2 + 0.25, 0, s * 0.5); b.add(w); return w; });
    for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1; const L = insectLeg(dark, [0.12, 0.2, 0.16], 0.012); L.position.set(0.06 * s, -0.08, 0.1 - Math.floor(i / 2) * 0.08); L.rotation.set(0, 0, s * 0.8); L.joints[1].rotation.z = -s * 1.1; b.add(L); }
    if (tiny) this.group.scale.setScalar(0.4);
    this.orbit = Math.random() * 6;
    this.registerFlash();
    this.buzz = null;
  }
  brain(dt, level, player) {
    const pp = player.body.pos;
    const d = this.dist3(pp);
    this.attackCd = Math.max(0, this.attackCd - dt);
    if (!this.passive && player.mode !== 'dead' && (d < this.aggroRange || this.aggro) && this.home.distanceTo(pp) < this.leashRange) {
      // circle the player's head, darting in now and then
      this.orbit += dt * 2.4;
      const r = 1.8 + Math.sin(this.orbit * 1.7) * 0.8;
      const tx = pp.x + Math.cos(this.orbit) * r, tz = pp.z + Math.sin(this.orbit) * r;
      this.steer(dt, tx, tz, this.speed, 9, pp.y + 1.6 + Math.sin(this.orbit * 2.3) * 0.6);
      if (d < this.attackRange + 1 && this.attackCd <= 0 && Math.random() < 0.3) { this.attackCd = this.attackDelay; player.damage(this.dmg, this.deathCause); }
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0 || !this.wanderTo) { this.wanderT = 0.6 + Math.random() * 1.5; this.wanderTo = this.home.clone().add(V((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 30)); }
      this.steer(dt, this.wanderTo.x, this.wanderTo.z, this.speed * 0.6, 8, this.wanderTo.y);
    }
  }
  animate(dt) {
    this.wings.forEach((w, i) => { w.rotation.y = Math.sin(G.time * 110 + i) * 0.7; });
    if (this.tiny) return;
    const d = G.player ? this.dist3(G.player.body.pos) : 99;
    if (d < 18 && !this.buzz && G.level && G.level.audioReady) this.buzz = loop('flybuzz', { pos: this.body.pos, ref: 3, vol: 0.6 });
    if (this.buzz) { this.buzz.setPos(this.body.pos); if (d > 24) { this.buzz.stop(); this.buzz = null; } }
  }
  die() { super.die(); if (this.buzz) { this.buzz.stop(); this.buzz = null; } }
}

export class Silverfish extends Creature {
  constructor() {
    super({ name: 'Silverfish', hp: 15, radius: 0.45, height: 0.3, speed: 11, damage: 5, deathCause: 'housebugs' });
    this.isBug = true;
    this.aggroRange = 0; this.leashRange = 60; this.attackRange = 1.1; this.attackDelay = 0.9;
    const m = new THREE.MeshPhysicalMaterial({ color: 0xb4bcc6, metalness: 0.7, roughness: 0.28, clearcoat: 0.8, emissive: 0x000000 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.14; this.group.add(b);
    this.segs = [];
    for (let i = 0; i < 7; i++) { const r = 0.2 - i * 0.022; const seg = ellipsoid(r, 1.1, 0.45, 0.9, m, 0, 0, 0.4 - i * 0.16, b); this.segs.push(seg); }
    const fil = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.5 });
    [-0.35, 0, 0.35].forEach((a) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.015, 0.6, 4), fil); f.position.set(Math.sin(a) * 0.2, 0, -0.9); f.rotation.set(Math.PI / 2, 0, 0); f.rotation.y = a; b.add(f); });
    [-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.7, 4), fil); a.position.set(0.1 * s, 0.05, 0.75); a.rotation.set(Math.PI / 2 - 0.2, 0, s * 0.4); b.add(a); });
    this.legs = hexapod(b, fil, { spread: 0.35, length: 0.22, y: -0.02, z0: 0.1, z1: 0.35, radius: 0.012 });
    this.registerFlash();
  }
  brain(dt, level, player) {
    // Silverfish are skittish: they dart away unless you hit them.
    if (this.aggro) { super.brain(dt, level, player); return; }
    const pp = player.body.pos;
    const d = this.distTo(pp);
    if (d < 9 && player.mode !== 'dead') {
      const ax = this.body.pos.x - pp.x, az = this.body.pos.z - pp.z, l = Math.hypot(ax, az) || 1;
      this.steer(dt, this.body.pos.x + (ax / l) * 10 + Math.sin(G.time * 5) * 3, this.body.pos.z + (az / l) * 10, this.speed, 8);
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0 || !this.wanderTo) { this.wanderT = 1 + Math.random() * 3; this.wanderTo = V(this.home.x + (Math.random() - 0.5) * 30, 0, this.home.z + (Math.random() - 0.5) * 30); }
      this.steer(dt, this.wanderTo.x, this.wanderTo.z, this.speed * 0.4, 6);
    }
  }
  animate(dt) {
    const sp = Math.hypot(this.body.vel.x, this.body.vel.z);
    this.legs(dt, sp * 0.4);
    this.segs.forEach((s, i) => { s.position.x = Math.sin(G.time * 14 - i * 0.8) * 0.03 * Math.min(1, sp / 4); });
  }
  onAttack() { sfx('hiss', { pos: this.body.pos, vol: 0.3 }); }
}

export class HouseCentipede extends Creature {
  constructor() {
    super({ name: 'House Centipede', hp: 45, radius: 1.3, height: 0.8, speed: 12.5, damage: 15, deathCause: 'centipede' });
    this.isBug = true;
    this.aggroRange = 16; this.leashRange = 90; this.attackRange = 2.2; this.attackDelay = 1.2;
    this.knockback = 1;
    const m = new THREE.MeshPhysicalMaterial({ color: 0xb8a070, roughness: 0.5, clearcoat: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a3048, roughness: 0.6 });
    const legM = new THREE.MeshStandardMaterial({ color: 0xc8b890, roughness: 0.5 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.7; this.group.add(b);
    this.legs = [];
    const N = 15;
    for (let i = 0; i < N; i++) {
      const z = 1.3 - i * 0.19;
      ellipsoid(0.13, 1.3, 0.45, 0.8, i % 2 ? m : dark, 0, 0, z, b);
      for (const s of [-1, 1]) {
        const L = insectLeg(legM, [0.9 + i * 0.03, 1.2 + i * 0.05], 0.02);
        L.position.set(0.12 * s, 0, z);
        L.rotation.set(0, (i / N - 0.5) * 0.8 * s, s * 1.2);
        L.joints[1].rotation.z = -s * 1.5;
        b.add(L);
        this.legs.push({ L, s, i });
      }
    }
    ellipsoid(0.14, 1.2, 0.6, 1, dark, 0, 0.02, 1.48, b);
    const antM = new THREE.MeshStandardMaterial({ color: 0x9a8a60 });
    [-1, 1].forEach((s) => {
      b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.05 * s, 0.03, 1.55), V(0.8 * s, 0.4, 2.6), V(1.6 * s, 0.2, 3.8)]), 16, 0.012, 4), antM));
      b.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.05 * s, 0.03, -1.4), V(0.9 * s, 0.3, -2.6), V(1.5 * s, 0.1, -3.8)]), 16, 0.012, 4), antM));
    });
    this.registerFlash();
  }
  animate(dt) {
    const sp = Math.hypot(this.body.vel.x, this.body.vel.z);
    const t = G.time * (4 + sp * 1.4);
    for (const g of this.legs) {
      const ph = t - g.i * 0.55 + (g.s > 0 ? Math.PI : 0);
      g.L.rotation.y = (g.i / 15 - 0.5) * 0.8 * g.s + Math.sin(ph) * 0.35 * Math.min(1, sp / 3);
      g.L.rotation.z = g.s * (1.2 - Math.max(0, Math.cos(ph)) * 0.25 * Math.min(1, sp / 3));
    }
  }
  onAggro() { sfx('hiss', { pos: this.body.pos, vol: 0.9 }); if (G.player) G.player.shake += 0.3; }
  onAttack() { sfx('crunch', { pos: this.body.pos }); }
}

export class CellarSpider extends Creature {
  constructor() {
    super({ name: 'Daddy Long-Legs', hp: 25, radius: 1, height: 2.2, speed: 4, damage: 9, deathCause: 'spider' });
    this.isBug = true; this.isSpider = true;
    this.aggroRange = 7; this.leashRange = 25; this.attackRange = 1.8; this.attackDelay = 1.5;
    const m = new THREE.MeshPhysicalMaterial({ color: 0xd8c8a8, roughness: 0.4, transparent: true, opacity: 0.85 });
    const legM = new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.6 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 2.1; this.group.add(b);
    ellipsoid(0.13, 1, 0.8, 1, m, 0, 0, 0.08, b);
    ellipsoid(0.16, 0.9, 0.9, 1.9, m, 0, 0.05, -0.28, b);
    this.legs = [];
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const L = insectLeg(legM, [1.4, 1.9, 1.7], 0.018);
      L.position.set(0.08 * s, 0, 0.12 - i * 0.07);
      const baseY = (i - 1.5) * 0.5 * s;
      L.rotation.set(0, baseY, s * 0.35);
      L.joints[1].rotation.z = -s * 1.9;
      L.joints[2].rotation.z = s * 0.3;
      b.add(L);
      this.legs.push({ L, s, i, baseY });
    }
    this.registerFlash();
  }
  animate(dt) {
    const sp = Math.hypot(this.body.vel.x, this.body.vel.z);
    // cellar spiders "whirl" when disturbed: the body bobs quickly
    this.bodyG.position.y = 2.1 + (this.state === 'chase' ? Math.sin(G.time * 18) * 0.12 : Math.sin(G.time * 1.5) * 0.03);
    this.legs.forEach((g) => { g.L.rotation.y = g.baseY + Math.sin(G.time * 5 + g.i + (g.s > 0 ? 1.5 : 0)) * 0.25 * Math.min(1, sp / 2); });
  }
}

export class BedBug extends Creature {
  constructor() {
    super({ name: 'Bed Bug', hp: 12, radius: 0.35, height: 0.2, speed: 3.5, damage: 4, deathCause: 'housebugs' });
    this.isBug = true;
    this.aggroRange = 6; this.leashRange = 30; this.attackRange = 0.9; this.attackDelay = 1.3;
    const m = glossy(0x7a2a14, 0.4);
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.12; this.group.add(b);
    ellipsoid(0.25, 1, 0.3, 1.3, m, 0, 0, -0.05, b);
    ellipsoid(0.1, 1.4, 0.5, 0.8, m, 0, 0, 0.3, b);
    this.legsA = hexapod(b, m, { spread: 0.45, length: 0.28, y: -0.02, z0: -0.1, z1: 0.2, radius: 0.015 });
    this.registerFlash();
  }
  animate(dt) { this.legsA(dt, Math.hypot(this.body.vel.x, this.body.vel.z) * 0.5); }
}

export class Moth extends Creature {
  constructor() {
    super({ name: 'Moth', hp: 6, radius: 0.5, height: 0.4, speed: 6, damage: 0, deathCause: 'housebugs', flying: true });
    this.isBug = true;
    this.passive = true;
    const tex = TX.drawn('mothwing', 128, 128, (c, w, h) => { const g = c.createRadialGradient(w * 0.3, h * 0.5, 4, w * 0.5, h * 0.5, w * 0.6); g.addColorStop(0, '#a08868'); g.addColorStop(1, '#6a5a44'); c.fillStyle = g; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.48, h * 0.4, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(40,30,20,0.6)'; c.beginPath(); c.arc(w * 0.6, h * 0.45, 9, 0, Math.PI * 2); c.fill(); });
    const wm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, roughness: 0.9, alphaTest: 0.1 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.4; this.group.add(b);
    ellipsoid(0.09, 1, 1, 3.2, new THREE.MeshStandardMaterial({ color: 0x7a6a50, roughness: 1 }), 0, 0, 0, b);
    this.wings = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), wm); w.geometry.translate(0.45 * s, 0, 0); w.rotation.x = -Math.PI / 2; b.add(w); return w; });
    this.registerFlash();
  }
  brain(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0 || !this.wanderTo) { this.wanderT = 0.4 + Math.random(); this.wanderTo = this.home.clone().add(V((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 40)); }
    this.steer(dt, this.wanderTo.x, this.wanderTo.z, this.speed, 5, this.wanderTo.y);
  }
  animate() { const f = Math.sin(G.time * 28); this.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * f * 0.8; }); }
}

export class Ladybug extends Creature {
  constructor() {
    super({ name: 'Ladybug', hp: 10, radius: 0.4, height: 0.4, speed: 1.5, damage: 0, deathCause: 'housebugs' });
    this.isBug = true;
    this.passive = true;
    const tex = TX.drawn('ladybug', 256, 128, (c, w, h) => { c.fillStyle = '#d4201a'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.fillRect(w / 2 - 3, 0, 6, h); [[60, 40], [190, 40], [90, 90], [170, 90], [40, 95], [215, 95]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fill(); }); });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.05; this.group.add(b);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.15, clearcoat: 1 }));
    shell.scale.set(1, 0.8, 1.15); shell.castShadow = true; b.add(shell);
    ellipsoid(0.13, 1.2, 0.8, 0.8, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 0.05, 0.36, b);
    this.legsA = hexapod(b, new THREE.MeshStandardMaterial({ color: 0x111111 }), { spread: 0.4, length: 0.18, y: 0.02, z0: -0.1, z1: 0.12, radius: 0.012 });
    this.registerFlash();
  }
  animate(dt) { this.legsA(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); }
}

// Where every house bug lives. Spawned by the house, respawned after you die.
export const HOUSE_BUGS = [
  // kitchen: a sugar ant trail heading for the cereal crumbs, fruit flies over the fruit bowl, a fly
  ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ make: () => new SugarAnt(), pos: [705 + i * 8, 0, 812 - i * 3] })),
  ...[0, 1, 2].map((i) => ({ make: () => new HouseFly(true), pos: [656 + i * 5, 104, 866] })),
  { make: () => new HouseFly(), pos: [720, 55, 700] },
  // living room: a fly and a ladybug by the big plant
  { make: () => new HouseFly(), pos: [640, 40, 180] },
  { make: () => new Ladybug(), pos: [985, 0, 92] },
  // bathroom: silverfish around the tub and vanity, a daddy long-legs in the corner
  { make: () => new Silverfish(), pos: [92, 0, 690] },
  { make: () => new Silverfish(), pos: [110, 0, 820] },
  { make: () => new Silverfish(), pos: [255, 0, 832] },
  { make: () => new CellarSpider(), pos: [24, 0, 434] },
  // bedroom: the centipede and bed bugs under the bed, a moth near the window
  { make: () => new HouseCentipede(), pos: [100, 0, 118] },
  { make: () => new BedBug(), pos: [58, 0, 40] },
  { make: () => new BedBug(), pos: [150, 0, 70] },
  { make: () => new Moth(), pos: [330, 140, 60] },
];

export function spawnHouseBugs(level) {
  level.houseBugs = HOUSE_BUGS.map((def) => {
    const c = def.make();
    c.place(...def.pos);
    level.scene.add(c.group);
    level.creatures.push(c);
    return { def, c };
  });
  // the daddy long-legs' web in the bathroom corner
  const web = makeWeb(V(18, 16, 424), 13, V(1, 0, 1).normalize());
  level.scene.add(web);
}

// Bring back any house bugs that were squashed (used after you respawn).
export function respawnHouseBugs(level) {
  for (const hb of level.houseBugs || []) {
    if (!hb.c.dead && level.creatures.includes(hb.c)) continue;
    if (hb.c.group.parent) hb.c.group.parent.remove(hb.c.group);
    const i = level.creatures.indexOf(hb.c); if (i >= 0) level.creatures.splice(i, 1);
    hb.c = hb.def.make();
    hb.c.place(...hb.def.pos);
    level.scene.add(hb.c.group);
    level.creatures.push(hb.c);
  }
}

export { angDiff };
