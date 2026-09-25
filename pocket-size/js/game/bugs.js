// Backyard wildlife at true scale for a 1.8cm person: carpenter ants, mosquitoes, ground beetles,
// velvet mites, fleas, ticks, wolf spiders + spiderlings, and the Brood Mother.
import * as THREE from 'three';
import { Creature, hexapod, insectLeg, glossy, damp, angDiff } from './creature.js';
import * as TX from '../core/textures.js';
import { sfx, loop } from '../core/audio.js';
import { ui } from '../core/ui.js';
import { G } from './state.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function ellipsoid(r, sx, sy, sz, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export class Ant extends Creature {
  constructor() {
    super({ name: 'Carpenter Ant', hp: 30, radius: 0.55, height: 0.55, speed: 7.5, damage: 8, deathCause: 'bugs' });
    this.isBug = true;
    this.aggroRange = 7; this.leashRange = 45;
    this.attackRange = 1.2; this.attackDelay = 0.9;
    this.loot = [['ant_part', 1], ['chitin', 1]]; this.lootChance = 0.8;
    const m = glossy(0x16100c, 0.35);
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.32; this.group.add(b);
    ellipsoid(0.26, 1, 0.85, 1.35, m, 0, 0.02, -0.42, b);
    ellipsoid(0.13, 1, 0.9, 1.7, m, 0, 0.02, 0.02, b);
    ellipsoid(0.07, 1, 1, 1, m, 0, 0.1, -0.12, b);
    const head = ellipsoid(0.17, 1.15, 0.9, 1, m, 0, 0.05, 0.36, b);
    this.mand = [];
    [-1, 1].forEach((s) => {
      const md = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 5), m); md.position.set(0.07 * s, -0.04, 0.52); md.rotation.set(Math.PI / 2, 0, s * 0.5); b.add(md); this.mand.push(md);
      const ant = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.06 * s, 0.1, 0.45), V(0.2 * s, 0.35, 0.55), V(0.3 * s, 0.25, 0.85)]), 10, 0.012, 4), m); b.add(ant);
    });
    void head;
    this.legs = hexapod(b, m, { spread: 0.5, length: 0.45, y: -0.02, z0: -0.12, z1: 0.16, radius: 0.025 });
    this.registerFlash();
  }
  animate(dt) { this.legs(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); this.mand.forEach((m, i) => { m.rotation.z = (i ? 1 : -1) * (0.4 + Math.sin(G.time * 12) * 0.2 * (this.state === 'chase' ? 1 : 0)); }); }
  onAttack() { sfx('crunch', { pos: this.body.pos, vol: 0.4 }); }
}

export class Mosquito extends Creature {
  constructor() {
    super({ name: 'Mosquito', hp: 24, radius: 0.5, height: 0.6, speed: 9, damage: 12, deathCause: 'bugs', flying: true });
    this.isBug = true;
    this.aggroRange = 15; this.leashRange = 60;
    this.attackRange = 1.3; this.attackDelay = 1.6;
    this.loot = [['mosquito_needle', 1]]; this.lootChance = 0.9;
    const m = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.6 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 1.2; this.group.add(b);
    ellipsoid(0.1, 0.9, 0.8, 3.2, new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.5 }), 0, 0, -0.35, b).rotation.x = 0.35;
    ellipsoid(0.13, 1, 0.9, 1.1, m, 0, 0.05, 0.05, b);
    ellipsoid(0.07, 1, 1, 1, m, 0, 0.02, 0.2, b);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.015, 0.35, 5), m); needle.rotation.x = Math.PI / 2 + 0.5; needle.position.set(0, -0.06, 0.36); b.add(needle);
    const wingM = new THREE.MeshPhysicalMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.28, roughness: 0.1, side: THREE.DoubleSide, iridescence: 1, depthWrite: false });
    this.wings = [-1, 1].map((s) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.6), wingM); w.position.set(0.1 * s, 0.1, -0.05); w.rotation.set(-Math.PI / 2 + 0.2, 0, s * 0.3); w.geometry.translate(0, -0.3, 0); b.add(w); return w; });
    for (let i = 0; i < 6; i++) { const s = i % 2 ? 1 : -1; const L = insectLeg(m, [0.3, 0.5, 0.5], 0.01); L.position.set(0.05 * s, -0.03, 0.02 + (Math.floor(i / 2) - 1) * 0.06); L.rotation.set(0, (Math.floor(i / 2) - 1) * 0.6 * s, s * 0.9); L.joints[1].rotation.z = -s * 1.2; b.add(L); }
    this.registerFlash();
    this.whine = null;
  }
  animate(dt) {
    this.wings.forEach((w, i) => { w.rotation.y = Math.sin(G.time * 90 + i) * 0.6; });
    this.bodyG.position.y = 1.2 + Math.sin(G.time * 3 + this.home.x) * 0.2;
    const d = G.player ? this.dist3(G.player.body.pos) : 99;
    if (d < 25 && !this.whine) this.whine = loop('whine', { pos: this.body.pos, ref: 3, vol: 0.5 });
    if (this.whine) { this.whine.setPos(this.body.pos); if (d > 30) { this.whine.stop(); this.whine = null; } }
  }
  die() { super.die(); if (this.whine) { this.whine.stop(); this.whine = null; } }
  onAttack() { sfx('buzz', { pos: this.body.pos }); }
}

export class Beetle extends Creature {
  constructor(horned = true) {
    super({ name: horned ? 'Rhino Beetle' : 'Ground Beetle', hp: 90, radius: 1.1, height: 1.0, speed: 5, damage: 20, deathCause: 'bugs' });
    this.isBug = true;
    this.aggroRange = 9; this.leashRange = 50;
    this.attackRange = 1.9; this.attackDelay = 2;
    this.knockback = 1.5;
    this.loot = horned ? [['beetle_horn', 1], ['chitin', 2]] : [['chitin', 2]];
    const m = glossy(horned ? 0x1a2230 : 0x10141a, 0.2);
    m.iridescence = 0.6; m.iridescenceIOR = 1.6;
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.55; this.group.add(b);
    ellipsoid(0.7, 1, 0.65, 1.35, m, 0, 0.05, -0.3, b);
    ellipsoid(0.45, 1.1, 0.6, 0.8, m, 0, 0.05, 0.6, b);
    ellipsoid(0.24, 1.1, 0.8, 0.9, m, 0, 0, 1.0, b);
    if (horned) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.8, 8), m); h.position.set(0, 0.25, 1.35); h.rotation.x = 0.9; b.add(h); }
    this.legs = hexapod(b, m, { spread: 1.3, length: 0.9, y: -0.2, z0: -0.4, z1: 0.6, radius: 0.05 });
    this.registerFlash();
  }
  animate(dt) { this.legs(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); }
  brain(dt, level, player) {
    super.brain(dt, level, player);
    if (this.state === 'chase' && this.distTo(player.body.pos) < 8 && this.attackCd <= 0.3) { this.body.vel.x *= 1.04; this.body.vel.z *= 1.04; }
  }
  onAttack() { sfx('rumble', { pos: this.body.pos, dur: 0.4, vol: 0.5 }); }
}

export class Mite extends Creature {
  constructor() {
    super({ name: 'Velvet Mite', hp: 6, radius: 0.2, height: 0.25, speed: 4, damage: 3, deathCause: 'bugs' });
    this.isBug = true;
    this.aggroRange = 5; this.leashRange = 20; this.attackRange = 0.6; this.attackDelay = 0.6;
    const m = new THREE.MeshStandardMaterial({ color: 0xd8161a, roughness: 1 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.14; this.group.add(b);
    ellipsoid(0.15, 1, 0.8, 1.2, m, 0, 0, 0, b);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), m); l.position.set(Math.cos(a) * 0.13, -0.05, Math.sin(a) * 0.13); l.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); b.add(l); }
    this.registerFlash();
  }
  animate() { this.bodyG.position.y = 0.14 + Math.abs(Math.sin(G.time * 20 + this.home.x)) * 0.02; }
}

export class Flea extends Creature {
  constructor() {
    super({ name: 'Flea', hp: 10, radius: 0.18, height: 0.25, speed: 6, damage: 5, deathCause: 'bugs' });
    this.isBug = true;
    this.aggroRange = 7; this.leashRange = 25; this.attackRange = 0.7; this.attackDelay = 0.8;
    this.hopT = 0;
    const m = glossy(0x5a3010, 0.3);
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.15; this.group.add(b);
    ellipsoid(0.12, 0.6, 1.1, 1.2, m, 0, 0, 0, b);
    [-1, 1].forEach((s) => { const l = insectLeg(m, [0.12, 0.18, 0.15], 0.015); l.position.set(0.05 * s, 0, -0.08); l.rotation.set(0.5, 0, s * 0.6); b.add(l); });
    this.registerFlash();
  }
  brain(dt, level, player) {
    super.brain(dt, level, player);
    this.hopT -= dt;
    if (this.hopT <= 0 && this.body.grounded) { this.hopT = 0.6 + Math.random() * 1.2; this.body.vel.y = 11 + Math.random() * 5; this.body.vel.x += (Math.random() - 0.5) * 8; this.body.vel.z += (Math.random() - 0.5) * 8; }
  }
}

export class Tick extends Creature {
  constructor() {
    super({ name: 'Tick', hp: 20, radius: 0.3, height: 0.3, speed: 2.5, damage: 4, deathCause: 'bugs' });
    this.isBug = true;
    this.aggroRange = 5; this.leashRange = 15; this.attackRange = 0.8; this.attackDelay = 1;
    this.latched = false;
    const m = glossy(0x3a1f14, 0.4);
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.2; this.group.add(b);
    this.belly = ellipsoid(0.22, 1, 0.55, 1.25, m, 0, 0, -0.05, b);
    ellipsoid(0.08, 1, 0.7, 1, glossy(0x1a0e0a), 0, 0, 0.25, b);
    for (let i = 0; i < 8; i++) { const s = i % 2 ? 1 : -1; const l = insectLeg(m, [0.12, 0.16, 0.14], 0.012); l.position.set(0.12 * s, 0, 0.1 - Math.floor(i / 2) * 0.07); l.rotation.set(0, 0, s * 1.2); l.joints[1].rotation.z = -s * 1.6; b.add(l); }
    this.registerFlash();
  }
  brain(dt, level, player) {
    if (this.latched) {
      const pp = player.body.pos;
      this.body.pos.set(pp.x + 0.3, pp.y + 0.9, pp.z);
      this.drainT = (this.drainT || 0) + dt;
      if (this.drainT > 1) { this.drainT = 0; player.damage(2, 'bugs'); this.belly.scale.multiplyScalar(1.03); }
      if (player.mode === 'dead') this.latched = false;
      return;
    }
    super.brain(dt, level, player);
  }
  onAttack() { this.latched = true; ui.toast('🕷️ A tick latched onto you! <b>Hit it</b> to knock it off.', 3000); }
  hit(d, from) { this.latched = false; return super.hit(d, from); }
  physics(dt, world) { if (!this.latched) super.physics(dt, world); }
}

// Spiders: 8 legs, stalk, lunge.
function spiderRig(group, scale, color, pattern = true) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.75, sheen: 0.8, sheenColor: new THREE.Color(0x8a7a60), sheenRoughness: 0.6 });
  if (pattern) {
    const tex = TX.fur({ color: 0x6a5a44, dark: 0x2a2018, seed: 77 });
    m.map = tex.map; m.normalMap = tex.normalMap;
  }
  const b = new THREE.Group(); b.position.y = 0.55 * scale; group.add(b);
  const abd = ellipsoid(0.55 * scale, 1, 0.85, 1.25, m, 0, 0.12 * scale, -0.75 * scale, b);
  const ceph = ellipsoid(0.4 * scale, 1, 0.7, 1.15, m, 0, 0.05 * scale, 0.1 * scale, b);
  void ceph;
  const eyeM = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.02, clearcoat: 1 });
  [[-0.12, 0.2, 0.52, 0.07], [0.12, 0.2, 0.52, 0.07], [-0.2, 0.28, 0.42, 0.05], [0.2, 0.28, 0.42, 0.05], [-0.07, 0.3, 0.46, 0.04], [0.07, 0.3, 0.46, 0.04]].forEach(([x, y, z, r]) => ellipsoid(r * scale, 1, 1, 1, eyeM, x * scale, y * scale, z * scale, b));
  const legs = [];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const L = insectLeg(m, [0.55 * scale, 0.75 * scale, 0.7 * scale], 0.06 * scale);
    L.position.set(0.25 * s * scale, 0.02 * scale, (0.3 - i * 0.18) * scale);
    const baseY = (i - 1.5) * 0.45 * s;
    L.rotation.set(0, baseY, s * 1.1);
    L.joints[1].rotation.z = -s * 1.7;
    L.joints[2].rotation.z = s * 0.5;
    b.add(L);
    legs.push({ L, s, i, baseY, phase: (i % 2 ? Math.PI : 0) + (s > 0 ? Math.PI : 0) });
  }
  [-1, 1].forEach((s) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.22 * scale, 6), eyeM); f.position.set(0.08 * s * scale, -0.08 * scale, 0.55 * scale); f.rotation.x = Math.PI / 2 + 0.6; b.add(f); });
  let t = 0;
  return {
    body: b, abd,
    animate(dt, speed) {
      t += dt * (3 + speed * 1.5);
      for (const g of legs) {
        const sw = Math.sin(t + g.phase) * 0.35 * Math.min(1, speed * 0.4);
        g.L.rotation.y = g.baseY + sw;
        g.L.rotation.z = g.s * (1.1 - Math.max(0, Math.cos(t + g.phase)) * 0.25 * Math.min(1, speed * 0.4));
      }
      abd.position.y = 0.12 * scale + Math.sin(G.time * 2) * 0.02 * scale;
    },
  };
}

export class Spider extends Creature {
  constructor(scale = 1) {
    super({ name: 'Wolf Spider', hp: 120 * scale, radius: 1.2 * scale, height: 1.1 * scale, speed: 8, damage: 22, deathCause: 'spider' });
    this.isBug = true; this.isSpider = true;
    this.aggroRange = 12; this.leashRange = 40;
    this.attackRange = 2.2 * scale; this.attackDelay = 1.6;
    this.knockback = 1;
    this.loot = [['silk', 3], ['venom', 1]];
    this.rig = spiderRig(this.group, 2 * scale, 0x4a3a2a);
    this.lungeT = 0;
    this.registerFlash();
  }
  animate(dt) { this.rig.animate(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); }
  brain(dt, level, player) {
    super.brain(dt, level, player);
    this.lungeT -= dt;
    if (this.state === 'chase' && this.lungeT <= 0 && this.distTo(player.body.pos) < 7 && this.body.grounded) {
      this.lungeT = 3;
      const dx = player.body.pos.x - this.body.pos.x, dz = player.body.pos.z - this.body.pos.z, d = Math.hypot(dx, dz) || 1;
      this.body.vel.x = (dx / d) * 16; this.body.vel.z = (dz / d) * 16; this.body.vel.y = 6;
      sfx('hiss', { pos: this.body.pos });
    }
    // torches scare spiders
    if (G.inventory && G.inventory.selected() && G.inventory.selected().id === 'torch' && this.distTo(player.body.pos) < 5) {
      this.state = 'wander'; this.aggro = false;
      this.yaw = Math.atan2(this.body.pos.x - player.body.pos.x, this.body.pos.z - player.body.pos.z);
    }
  }
  onAggro() { sfx('hiss', { pos: this.body.pos, vol: 0.8 }); }
}

export class Spiderling extends Creature {
  constructor() {
    super({ name: 'Spiderling', hp: 8, radius: 0.3, height: 0.3, speed: 6, damage: 4, deathCause: 'spider' });
    this.isBug = true;
    this.aggroRange = 8; this.leashRange = 30; this.attackRange = 0.8; this.attackDelay = 0.8;
    this.rig = spiderRig(this.group, 0.4, 0x7a6a50, false);
    this.registerFlash();
  }
  animate(dt) { this.rig.animate(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); }
}

export class BroodMother extends Spider {
  constructor() {
    super(5.5);
    this.name = 'The Brood Mother';
    this.maxHp = this.hp = 900;
    this.dmg = 35;
    this.speed = 9;
    this.aggroRange = 26; this.leashRange = 120;
    this.attackRange = 7;
    this.isBoss = true;
    this.loot = [['silk', 12], ['venom', 4], ['chitin', 6]];
    this.spawnT = 6;
    this.revealed = false;
    this.group.traverse((o) => { if (o.isMesh && o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.6); } });
    this.registerFlash();
  }
  brain(dt, level, player) {
    if (!this.revealed) {
      if (this.distTo(player.body.pos) < 22 && Math.abs(player.body.pos.y - this.body.pos.y) < 10) { this.revealed = true; this.onReveal && this.onReveal(); }
      return;
    }
    super.brain(dt, level, player);
    ui.boss(this.name, this.hp / this.maxHp);
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.state === 'chase') {
      this.spawnT = 9;
      for (let i = 0; i < 3; i++) { const s = new Spiderling(); s.place(this.body.pos.x + (Math.random() - 0.5) * 6, this.body.pos.y + 1, this.body.pos.z + (Math.random() - 0.5) * 6); s.aggro = true; level.scene.add(s.group); level.creatures.push(s); }
      sfx('hiss', { pos: this.body.pos, vol: 1 });
    }
  }
  die() { super.die(); ui.boss(null); }
}

// A radial orb web between branches: visual + sticky zone.
export function makeWeb(center, radius, normal) {
  const g = new THREE.Group();
  const pts = [];
  const spokes = 16, rings = 12;
  for (let i = 0; i < spokes; i++) { const a = (i / spokes) * Math.PI * 2; pts.push(V(0, 0, 0), V(Math.cos(a) * radius, Math.sin(a) * radius, 0)); }
  for (let r = 1; r <= rings; r++) {
    const rr = (r / rings) * radius;
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * Math.PI * 2, a1 = ((i + 1) / spokes) * Math.PI * 2;
      const sag = 1 - Math.sin((i / spokes) * Math.PI) * 0.04;
      pts.push(V(Math.cos(a0) * rr * sag, Math.sin(a0) * rr * sag, 0), V(Math.cos(a1) * rr * sag, Math.sin(a1) * rr * sag, 0));
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.55 });
  const lines = new THREE.LineSegments(geo, mat);
  g.add(lines);
  // dew beads on the web catch the light
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transparent: true, opacity: 0.8, clearcoat: 1 }), 60);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * radius; mm.makeTranslation(Math.cos(a) * r, Math.sin(a) * r, 0); beads.setMatrixAt(i, mm); }
  g.add(beads);
  g.position.copy(center);
  g.lookAt(center.clone().add(normal));
  return g;
}

export { damp, angDiff, ellipsoid, spiderRig };
