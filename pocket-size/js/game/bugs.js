// Backyard wildlife at true scale for a 1.8cm person: carpenter ants, mosquitoes, ground beetles,
// velvet mites, fleas, ticks, wolf spiders + spiderlings, and the Brood Mother.
import * as THREE from 'three';
import { Creature, damp, angDiff } from './creature.js';
import * as A from './anatomy.js';
import { sfx, loop } from '../core/audio.js';
import { ui } from '../core/ui.js';
import { G } from './state.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Ant extends Creature {
  constructor({ color = 0x1c130d, legColor = 0x241710, gasterHair = 0x7a6448 } = {}) {
    super({ name: 'Carpenter Ant', hp: 30, radius: 0.55, height: 0.55, speed: 7.5, damage: 8, deathCause: 'bugs' });
    this.isBug = true;
    this.aggroRange = 7; this.leashRange = 45;
    this.attackRange = 1.2; this.attackDelay = 0.9;
    this.loot = [['ant_part', 1], ['chitin', 1]]; this.lootChance = 0.8;
    const m = A.cuticleMat(color, { rough: 0.7, coat: 0.7, coatRough: 0.22 });
    const gm = A.cuticleMat(color, { rough: 0.75, coat: 0.6, coatRough: 0.3, sheen: 0.5, sheenColor: gasterHair, hair: true, bump: 0.4 });
    const lm = A.cuticleMat(legColor, { rough: 0.8, coat: 0.4 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.34; this.group.add(b);
    // gaster (abdomen) with overlapping plates, tipped down a little
    const GA = { len: 0.62, rad: 0.24, peak: 0.55, p: 0.52, ridges: 4, ridgeDepth: 0.07, flat: 0.88 };
    const gaster = A.part(GA, gm, b, 0, 0.05, -0.5, -0.22);
    A.hairs(GA, { count: 40, len: 0.035, r: 0.0025, lay: 2.5, minUp: -0.2, seed: 3 }, A.hairMat(gasterHair), gaster);
    // petiole node, then the humped mesosoma (thorax)
    A.part({ len: 0.12, rad: 0.05 }, m, b, 0, -0.01, -0.16);
    A.part({ len: 0.1, rad: 0.06, flat: 1.5, wide: 0.7 }, m, b, 0, 0.04, -0.14);
    A.part({ len: 0.44, rad: 0.11, peak: 0.62, p: 0.48, flat: 1.05 }, m, b, 0, 0.0, 0.03, 0.12);
    A.part({ len: 0.2, rad: 0.1, flat: 0.9, wide: 1.1 }, m, b, 0, 0.05, 0.14);
    // heart-shaped head with compound eyes, jaws and elbowed antennae
    A.part({ len: 0.32, rad: 0.18, peak: 0.42, p: 0.42, wide: 1.08, flat: 0.78 }, m, b, 0, 0.04, 0.38, 0.1);
    const em = A.eyeMat(0x1a1a18, 18);
    [-1, 1].forEach((s) => A.eye(0.05, em, b, 0.16 * s, 0.08, 0.41, 0.7, 1, 1.2));
    this.mand = [];
    [-1, 1].forEach((s) => {
      const md = new THREE.Group(); md.position.set(0.075 * s, -0.04, 0.5); b.add(md);
      A.part({ len: 0.13, rad: 0.03, peak: 0.25, p: 0.7, flat: 0.45 }, lm, md, -0.02 * s, 0, 0.06, 0, -0.55 * s);
      this.mand.push(md);
      A.tube(A.mirror([[0.08, 0.1, 0.48], [0.14, 0.2, 0.53], [0.19, 0.27, 0.58], [0.26, 0.28, 0.72], [0.31, 0.2, 0.87], [0.34, 0.1, 0.97]], s), { r0: 0.015, r1: 0.024, segs: 24, beads: 10, beadAmt: 0.25, club: 0.25 }, lm, b);
    });
    // six legs on the mesosoma; the hind pair reach back past the waist
    this.gait = A.legSet(b, [
      [0.06, -0.07, 0.14, 0.56, 0.6],
      [0.07, -0.07, 0.04, 0.66, 0.02],
      [0.07, -0.07, -0.06, 0.6, -0.66],
    ], { mat: lm, coxa: 0.07, femur: 0.36, tibia: 0.38, tarsus: 0.24, r: 0.024, spines: 2, tarsusAngle: -0.45 }, { stride: 0.36, lift: 0.1, speedRef: 7.5 });
    this.registerFlash();
  }
  animate(dt) {
    this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z), !this.body.grounded && this.body.vel.y < -4);
    this.mand.forEach((m, i) => { m.rotation.y = (i ? -1 : 1) * (0.1 + (0.5 + 0.5 * Math.sin(G.time * 12)) * 0.35 * (this.state === 'chase' ? 1 : 0.15)); });
  }
  onAttack() { sfx('crunch', { pos: this.body.pos, vol: 0.4 }); }
}

// Pale bands at the back edge of each abdominal segment (Aedes-style).
const MOSQ_AB = () => A.patternMap('mosqab', (c, w, h) => {
  c.fillStyle = '#2e2620'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#cfc6b4';
  for (let i = 0; i < 7; i++) { const y = h * (1 - i / 7) - h * 0.035; c.fillRect(0, y, w, h * 0.03); }
  c.fillStyle = 'rgba(210,200,180,0.5)'; c.fillRect(0, 0, w * 0.08, h); c.fillRect(w * 0.92, 0, w * 0.08, h);
});

export class Mosquito extends Creature {
  constructor() {
    super({ name: 'Mosquito', hp: 24, radius: 0.5, height: 0.6, speed: 9, damage: 12, deathCause: 'bugs', flying: true });
    this.isBug = true;
    this.aggroRange = 15; this.leashRange = 60;
    this.attackRange = 1.3; this.attackDelay = 1.6;
    this.loot = [['mosquito_needle', 1]]; this.lootChance = 0.9;
    const m = A.cuticleMat(0x3a3028, { rough: 0.9, coat: 0.25, hair: true, sheen: 0.6, sheenColor: 0xc8c0b0 });
    const am = A.cuticleMat(0xffffff, { rough: 0.85, coat: 0.3, hair: true, map: MOSQ_AB() });
    const lm = A.bandedMat(0x241c16, 0xd8d0c0, { bands: 1, width: 0.07, offset: 0.97 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 1.2; this.group.add(b);
    A.part({ len: 0.66, rad: 0.075, peak: 0.6, p: 0.6, ridges: 7, ridgeDepth: 0.12 }, am, b, 0, -0.05, -0.42, -0.22);
    const TH = { len: 0.3, rad: 0.11, peak: 0.6, p: 0.45, flat: 1.15 };
    const th = A.part(TH, m, b, 0, 0.03, 0.02, 0.25);
    A.hairs(TH, { count: 30, len: 0.03, r: 0.003, lay: 1.5, minUp: 0.2, seed: 4 }, A.hairMat(0x1a1612), th);
    A.part({ len: 0.12, rad: 0.065 }, m, b, 0, -0.02, 0.2);
    const em = A.eyeMat(0x15151a, 20);
    [-1, 1].forEach((s) => A.eye(0.052, em, b, 0.04 * s, 0, 0.21));
    A.tube([[0, -0.04, 0.25], [0, -0.1, 0.38], [0, -0.17, 0.55], [0, -0.21, 0.66]], { r0: 0.012, r1: 0.005, segs: 14 }, m, b);
    [-1, 1].forEach((s) => {
      A.tube(A.mirror([[0.015, -0.04, 0.25], [0.03, -0.08, 0.33], [0.035, -0.1, 0.38]], s), { r0: 0.008, r1: 0.006, segs: 6 }, m, b);
      A.tube(A.mirror([[0.02, 0.02, 0.26], [0.1, 0.1, 0.4], [0.16, 0.14, 0.52]], s), { r0: 0.008, r1: 0.004, segs: 18, beads: 12, beadAmt: 0.45 }, m, b);
    });
    this.wings = A.wingPair(b, A.wingMat('mosquito', 0xeeeeff), { length: 0.62, width: 0.15, x: 0.06, y: 0.12, z: 0.04 });
    this.gait = A.legSet(b, [
      [0.04, -0.09, 0.07, 0.5, 0.6],
      [0.05, -0.09, 0.0, 0.62, 0.0],
      [0.04, -0.09, -0.06, 0.55, -0.7],
    ], { mat: lm, coxa: 0.05, femur: 0.48, tibia: 0.52, tarsus: 0.62, r: 0.011, radial: 5 }, { hangDrop: 0.7, fit: false });
    this.registerFlash();
    this.whine = null;
  }
  animate(dt) {
    A.poseWings(this.wings, 0.35, Math.sin(G.time * 90) * 0.8);
    this.gait.update(dt, 0, true);
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
    const col = horned ? 0x2a1a10 : 0x0e1318;
    const shell = A.cuticleMat(col, { rough: 0.55, coat: 1, coatRough: horned ? 0.28 : 0.1, iri: horned ? 0.15 : 0.75, side: THREE.DoubleSide, bump: 0.35 });
    const m = A.cuticleMat(col, { rough: 0.6, coat: 0.9, coatRough: horned ? 0.3 : 0.15, iri: horned ? 0 : 0.4 });
    const lm = A.cuticleMat(horned ? 0x1e140c : 0x0a0d10, { rough: 0.65, coat: 0.7, coatRough: 0.25 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.66; this.group.add(b);
    A.part({ len: 1.45, rad: 0.5, peak: 0.55, p: 0.5, flat: 0.58, ridges: 5, ridgeDepth: 0.04 }, lm, b, 0, -0.04, -0.3);
    // elytra: two hard wing covers with fine grooves, meeting in a seam down the back
    const EL = { len: 1.6, rad: 0.56, peak: 0.58, p: 0.44, flat: 0.72, grooves: horned ? 0 : 24, grooveDepth: 0.018, radial: 26 };
    A.part({ ...EL, phi0: 0.55, phiLen: Math.PI - 0.55 }, shell, b, 0, 0.06, -0.34);
    A.part({ ...EL, phi0: Math.PI, phiLen: Math.PI - 0.55 }, shell, b, 0, 0.06, -0.34);
    A.part({ len: 0.62, rad: 0.5, peak: 0.45, p: 0.32, flat: 0.62, wide: 1.08 }, m, b, 0, 0.06, 0.72);
    A.part({ len: 0.4, rad: 0.28, p: 0.4, flat: 0.6, wide: 1.1 }, m, b, 0, -0.04, 1.1, 0.25);
    const em = A.eyeMat(0x16110c, 20);
    [-1, 1].forEach((s) => A.eye(0.07, em, b, 0.25 * s, 0.0, 1.14, 0.7, 1, 1));
    if (horned) {
      A.tube([[0, 0.02, 1.2], [0, 0.25, 1.42], [0, 0.58, 1.5], [0, 0.82, 1.38]], { r0: 0.13, r1: 0.035, segs: 16, radial: 8 }, m, b);
      A.tube([[0, 0.3, 0.72], [0, 0.44, 0.88], [0, 0.5, 1.04]], { r0: 0.09, r1: 0.025, segs: 10, radial: 7 }, m, b);
      [-1, 1].forEach((s) => A.tube(A.mirror([[0.18, -0.06, 1.24], [0.26, -0.06, 1.34], [0.3, -0.04, 1.4]], s), { r0: 0.022, r1: 0.03, segs: 8, club: 1.2 }, lm, b));
    } else {
      [-1, 1].forEach((s) => {
        A.tube(A.mirror([[0.08, -0.08, 1.26], [0.17, -0.09, 1.42], [0.1, -0.1, 1.56], [0.02, -0.1, 1.6]], s), { r0: 0.05, r1: 0.012, segs: 12, radial: 6 }, lm, b);
        A.tube(A.mirror([[0.2, 0.0, 1.25], [0.38, 0.14, 1.5], [0.58, 0.2, 1.85], [0.74, 0.12, 2.15]], s), { r0: 0.026, r1: 0.02, segs: 30, beads: 11, beadAmt: 0.3 }, lm, b);
      });
    }
    this.gait = A.legSet(b, [
      [0.24, -0.2, 0.74, 1.0, 1.45],
      [0.3, -0.22, 0.26, 1.28, 0.3],
      [0.3, -0.22, -0.1, 1.15, -0.98],
    ], { mat: lm, coxa: 0.14, femur: 0.62, tibia: 0.66, tarsus: 0.48, r: 0.065, spines: 4, tarsusAngle: -0.35 }, { stride: 0.8, lift: 0.22, speedRef: 5 });
    this.registerFlash();
  }
  animate(dt) { this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z), !this.body.grounded && this.body.vel.y < -4); }
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
    const m = A.cuticleMat(0xc8141a, { rough: 1, coat: 0, hair: true, sheen: 1, sheenColor: 0xff6a5a, bump: 1 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.16; this.group.add(b);
    const BO = { len: 0.36, rad: 0.17, peak: 0.45, p: 0.42, flat: 0.8 };
    const bo = A.part(BO, m, b, 0, 0.03, -0.03);
    A.hairs(BO, { count: 380, len: 0.016, r: 0.0022, lay: 0.5, minUp: -0.2, seed: 9 }, A.hairMat(0xd82622, 0.95), bo);
    A.part({ len: 0.1, rad: 0.05 }, m, b, 0, -0.01, 0.16);
    this.gait = A.legSet(b, [
      [0.07, -0.03, 0.1, 0.25, 0.28],
      [0.09, -0.03, 0.04, 0.31, 0.08],
      [0.09, -0.03, -0.03, 0.31, -0.12],
      [0.07, -0.03, -0.09, 0.25, -0.3],
    ], { mat: m, coxa: 0.02, femur: 0.1, tibia: 0.1, tarsus: 0.07, r: 0.014, radial: 5 }, { stride: 0.1, lift: 0.04, speedRef: 4 }, A.TETRAPOD);
    this.registerFlash();
  }
  animate(dt) { this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); }
}

export class Flea extends Creature {
  constructor() {
    super({ name: 'Flea', hp: 10, radius: 0.18, height: 0.25, speed: 6, damage: 5, deathCause: 'bugs' });
    this.isBug = true;
    this.aggroRange = 7; this.leashRange = 25; this.attackRange = 0.7; this.attackDelay = 0.8;
    this.hopT = 0;
    const m = A.cuticleMat(0x5a2a10, { rough: 0.6, coat: 1, coatRough: 0.16, repeat: 5, bump: 0.3 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.2; this.group.add(b);
    // flattened side to side, glossy, with backward-pointing bristles
    const BO = { len: 0.4, rad: 0.14, peak: 0.42, p: 0.55, ridges: 7, ridgeDepth: 0.05, wide: 0.55, flat: 1.05 };
    const bo = A.part(BO, m, b, 0, 0.03, -0.04, 0.12);
    A.hairs(BO, { count: 45, len: 0.05, r: 0.003, lay: 2.2, minUp: -0.5, seed: 5 }, A.hairMat(0x2a1408), bo);
    A.part({ len: 0.13, rad: 0.07, peak: 0.4, wide: 0.6, flat: 0.95 }, m, b, 0, -0.03, 0.18, 0.5);
    [-1, 1].forEach((s) => A.eye(0.018, A.ocellusMat(0x0a0404), b, 0.035 * s, 0.0, 0.21));
    this.gait = A.legSet(b, [
      [0.03, -0.09, 0.12, 0.13, 0.2, { femur: 0.1, tibia: 0.1, tarsus: 0.08 }],
      [0.04, -0.09, 0.03, 0.15, 0.0, { femur: 0.11, tibia: 0.11, tarsus: 0.08 }],
      [0.04, -0.07, -0.06, 0.16, -0.16, { femur: 0.17, tibia: 0.2, tarsus: 0.12, r: 0.02, spines: 3 }],
    ], { mat: m, femur: 0.1, tibia: 0.1, tarsus: 0.08, r: 0.013, radial: 5 }, { stride: 0.1, lift: 0.05, speedRef: 6, hangDrop: 0.08 });
    this.registerFlash();
  }
  animate(dt) { this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z), !this.body.grounded); }
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
    const m = A.cuticleMat(0x4e2818, { rough: 0.75, coat: 0.6, coatRough: 0.28 });
    const sc = A.cuticleMat(0x1a0d08, { rough: 0.6, coat: 0.85, coatRough: 0.2 });
    const lm = A.bandedMat(0x5a3422, 0x24120a, { bands: 1, width: 0.2 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.2; this.group.add(b);
    this.belly = A.part({ len: 0.56, rad: 0.24, peak: 0.45, p: 0.42, flat: 0.42 }, m, b, 0, 0.02, -0.06);
    A.part({ len: 0.26, rad: 0.15, peak: 0.5, flat: 0.25, wide: 1.05 }, sc, b, 0, 0.075, 0.12);
    A.part({ len: 0.13, rad: 0.05, flat: 0.7 }, sc, b, 0, 0.0, 0.29);
    [-1, 1].forEach((s) => A.tube(A.mirror([[0.025, 0, 0.3], [0.045, -0.01, 0.36], [0.04, -0.03, 0.39]], s), { r0: 0.016, r1: 0.012, segs: 6 }, sc, b));
    this.gait = A.legSet(b, [
      [0.1, -0.03, 0.2, 0.36, 0.46],
      [0.12, -0.03, 0.14, 0.44, 0.18],
      [0.12, -0.03, 0.08, 0.44, -0.12],
      [0.1, -0.03, 0.02, 0.36, -0.38],
    ], { mat: lm, coxa: 0.03, femur: 0.18, tibia: 0.18, tarsus: 0.14, r: 0.016, radial: 5 }, { stride: 0.14, lift: 0.05, speedRef: 2.5 }, A.TETRAPOD);
    this.registerFlash();
  }
  animate(dt) { this.gait.update(dt, this.latched ? 0 : Math.hypot(this.body.vel.x, this.body.vel.z), this.latched); }
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
  onAttack() { this.latched = true; ui.toast('A tick is latched on. <b>Hit it</b> to knock it off.', 3000); }
  hit(d, from) { this.latched = false; return super.hit(d, from); }
  physics(dt, world) { if (!this.latched) super.physics(dt, world); }
}

// Wolf spider: striped carapace, chevroned abdomen, eight banded spiny legs and the big forward eyes.
function spiderRig(group, scale, color, pattern = true) {
  const col = new THREE.Color(color);
  const hex = (c) => '#' + c.getHexString();
  const dark = col.clone().multiplyScalar(0.42), light = col.clone().lerp(new THREE.Color(0xd8c8a8), 0.5);
  const carapace = pattern ? A.patternMap(`carapace${color}`, (c, w, h) => {
    c.fillStyle = hex(dark); c.fillRect(0, 0, w, h);
    c.fillStyle = hex(light);
    c.beginPath(); c.moveTo(w * 0.5, h * 0.02); c.bezierCurveTo(w * 0.62, h * 0.3, w * 0.58, h * 0.7, w * 0.5, h * 0.98); c.bezierCurveTo(w * 0.42, h * 0.7, w * 0.38, h * 0.3, w * 0.5, h * 0.02); c.fill();
    c.fillRect(w * 0.26, 0, w * 0.06, h); c.fillRect(w * 0.68, 0, w * 0.06, h);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,210'},0.12)`; c.fillRect(Math.random() * w, Math.random() * h, 1, 3); }
  }) : null;
  const abdomen = pattern ? A.patternMap(`spabd${color}`, (c, w, h) => {
    c.fillStyle = hex(col); c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, hex(dark)); g.addColorStop(0.3, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, hex(dark));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = hex(dark);
    c.beginPath(); c.moveTo(w * 0.5, h * 0.05); c.quadraticCurveTo(w * 0.6, h * 0.25, w * 0.5, h * 0.45); c.quadraticCurveTo(w * 0.4, h * 0.25, w * 0.5, h * 0.05); c.fill();
    c.strokeStyle = hex(dark); c.lineWidth = 5;
    for (let i = 0; i < 5; i++) { const y = h * (0.5 + i * 0.09); c.beginPath(); c.moveTo(w * 0.36, y - 8); c.lineTo(w * 0.5, y + 6); c.lineTo(w * 0.64, y - 8); c.stroke(); }
    c.fillStyle = hex(light);
    for (let i = 0; i < 5; i++) { const y = h * (0.52 + i * 0.09); c.fillRect(w * 0.33, y, 4, 4); c.fillRect(w * 0.66, y, 4, 4); }
    for (let i = 0; i < 1400; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,210'},0.1)`; c.fillRect(Math.random() * w, Math.random() * h, 1, 3); }
  }) : null;
  const pm = A.cuticleMat(pattern ? 0xffffff : color, { rough: 1, coat: 0.05, hair: true, sheen: 0.8, sheenColor: light.getHex(), map: carapace, bump: 0.9 });
  const am = A.cuticleMat(pattern ? 0xffffff : color, { rough: 1, coat: 0.05, hair: true, sheen: 0.8, sheenColor: light.getHex(), map: abdomen, bump: 0.9 });
  const lm = pattern ? A.bandedMat(col.getHex(), dark.getHex(), { bands: 1, width: 0.22, coat: 0.1 }) : A.cuticleMat(color, { rough: 0.9, coat: 0.1, hair: true });
  const hm = A.hairMat(light.clone().lerp(col, 0.5).getHex(), 0.9);
  const b = new THREE.Group(); b.position.y = 0.55 * scale; b.scale.setScalar(scale); group.add(b);
  const PR = { len: 0.85, rad: 0.36, peak: 0.42, p: 0.42, flat: 0.55, wide: 0.9 };
  const pro = A.part(PR, pm, b, 0, 0.06, 0.12, 0.12);
  A.part({ len: 0.16, rad: 0.06 }, pm, b, 0, 0.04, -0.34);
  const OP = { len: 1.15, rad: 0.5, peak: 0.55, p: 0.5, flat: 0.78 };
  const abd = A.part(OP, am, b, 0, 0.14, -0.9, 0.08);
  if (scale > 0.5) {
    A.hairs(PR, { count: 90, len: 0.06, r: 0.006, lay: 1.2, minUp: -0.1, seed: 11 }, hm, pro);
    A.hairs(OP, { count: 240, len: 0.07, r: 0.006, lay: 1.1, minUp: -0.4, seed: 12 }, hm, abd);
  }
  const eyeM = A.ocellusMat(0x060606, 0x020402);
  [[0.085, 0.24, 0.43, 0.07], [0.045, 0.15, 0.51, 0.028], [0.12, 0.14, 0.49, 0.03], [0.17, 0.25, 0.3, 0.055]].forEach(([x, y, z, r]) => {
    for (const s of [-1, 1]) A.eye(r, eyeM, b, x * s, y, z);
  });
  // chelicerae with fangs, and the pedipalps out front
  [-1, 1].forEach((s) => {
    A.part({ len: 0.26, rad: 0.08, peak: 0.6 }, pm, b, 0.075 * s, -0.04, 0.5, 1.15);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 6), eyeM); f.position.set(0.07 * s, -0.2, 0.56); f.rotation.x = Math.PI - 0.5; b.add(f);
  });
  const legs = A.legSet(b, [
    [0.1, -0.06, 0.44, 0.3, 0.85, { coxa: 0.05, femur: 0.24, tibia: 0.22, tarsus: 0.12, r: 0.04, spines: 0 }],
    [0.2, -0.04, 0.3, 0.95, 1.35, { femur: 0.75, tibia: 0.8, tarsus: 0.7 }],
    [0.26, -0.04, 0.15, 1.38, 0.55, { femur: 0.7, tibia: 0.75, tarsus: 0.65 }],
    [0.26, -0.04, -0.02, 1.38, -0.5, { femur: 0.66, tibia: 0.72, tarsus: 0.62 }],
    [0.2, -0.04, -0.16, 1.02, -1.48, { femur: 0.8, tibia: 0.9, tarsus: 0.8 }],
  ], { mat: lm, coxa: 0.12, femur: 0.7, tibia: 0.75, tarsus: 0.65, r: 0.055, spines: scale > 0.5 ? 5 : 0, tarsusAngle: -0.55, radial: scale > 0.5 ? 7 : 5 },
  { stride: 0.7, lift: 0.2, speedRef: 8 }, A.TETRAPOD);
  return {
    body: b, abd,
    animate(dt, speed, air = false) {
      legs.update(dt, speed, air);
      abd.position.y = 0.14 + Math.sin(G.time * 2) * 0.012;
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
    this.rig = spiderRig(this.group, 2 * scale, 0x5a4632);
    this.lungeT = 0;
    this.registerFlash();
  }
  animate(dt) { this.rig.animate(dt, Math.hypot(this.body.vel.x, this.body.vel.z), !this.body.grounded && this.body.vel.y < -2); }
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

export { damp, angDiff, spiderRig };
