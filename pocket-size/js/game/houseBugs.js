// Bugs that actually live in houses, at true scale next to a 1.8cm person: sugar ants in the
// kitchen, house flies and fruit flies, silverfish in the bathroom, a daddy long-legs in the
// corner, bed bugs and a house centipede under the bed, a moth by the window, a ladybug.
import * as THREE from 'three';
import { Creature, angDiff } from './creature.js';
import { Ant, Flea, makeWeb } from './bugs.js';
import * as A from './anatomy.js';
import { sfx, loop } from '../core/audio.js';
import * as TX from '../core/textures.js';
import { G } from './state.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class SugarAnt extends Ant {
  constructor() {
    super({ color: 0x4a2a14, legColor: 0x5a3a1e, gasterHair: 0xb09070 });
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

// House fly thorax: grey with four dark stripes. Abdomen: yellowish, chequered.
const FLY_TH = () => A.patternMap('flyth', (c, w, h) => {
  c.fillStyle = '#6e6e70'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#1c1c1e';
  [0.41, 0.47, 0.53, 0.59].forEach((u) => c.fillRect(w * u - 2, h * 0.05, 4, h * 0.85));
  c.fillStyle = '#2a2a2c'; c.fillRect(0, 0, w * 0.25, h); c.fillRect(w * 0.75, 0, w * 0.25, h);
});
const FLY_AB = () => A.patternMap('flyab', (c, w, h) => {
  c.fillStyle = '#8a7a58'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#2a2622'; c.fillRect(w * 0.46, 0, w * 0.08, h);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { if ((i + j) % 2) continue; c.fillStyle = 'rgba(30,28,26,0.55)'; c.fillRect((j / 6) * w, (i / 4) * h, w / 6, h / 4); }
  c.fillStyle = '#1e1c1a'; c.fillRect(0, 0, w * 0.2, h); c.fillRect(w * 0.8, 0, w * 0.2, h);
});

export class HouseFly extends Creature {
  constructor(tiny = false) {
    super({ name: tiny ? 'Fruit Fly' : 'House Fly', hp: tiny ? 3 : 14, radius: tiny ? 0.15 : 0.4, height: tiny ? 0.2 : 0.5, speed: tiny ? 5 : 10, damage: tiny ? 0 : 2, deathCause: 'housebugs', flying: true });
    this.isBug = true;
    this.tiny = tiny;
    this.passive = tiny;
    this.aggroRange = 9; this.leashRange = 70; this.attackRange = 1; this.attackDelay = 2.5;
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.6; this.group.add(b);
    const th = tiny ? A.cuticleMat(0xa8844e, { rough: 0.8, coat: 0.3, hair: true }) : A.cuticleMat(0xffffff, { rough: 0.9, coat: 0.2, hair: true, map: FLY_TH() });
    const ab = tiny ? A.cuticleMat(0x9a6e3c, { rough: 0.7, coat: 0.5, hair: true }) : A.cuticleMat(0xffffff, { rough: 0.8, coat: 0.45, hair: true, map: FLY_AB() });
    const lm = A.cuticleMat(tiny ? 0x7a5a36 : 0x161618, { rough: 0.8, coat: 0.3, hair: true });
    const TH = { len: 0.36, rad: 0.17, peak: 0.5, p: 0.45 };
    const thm = A.part(TH, th, b, 0, 0.04, 0.04, 0.15);
    const AB = { len: 0.4, rad: 0.18, peak: 0.55, p: 0.5, ridges: 4, ridgeDepth: 0.06, flat: 0.8 };
    const abm = A.part(AB, ab, b, 0, 0.0, -0.3, -0.1);
    if (!tiny) {
      const bristle = A.hairMat(0x0c0c0c);
      A.hairs(TH, { count: 45, len: 0.07, r: 0.004, lay: 0.7, minUp: 0, seed: 21 }, bristle, thm);
      A.hairs(AB, { count: 40, len: 0.05, r: 0.0035, lay: 1.2, minUp: -0.3, seed: 22 }, bristle, abm);
    }
    A.part({ len: 0.14, rad: 0.15, p: 0.4, wide: 1.25, flat: 1.05 }, lm, b, 0, 0.0, 0.27);
    const em = A.eyeMat(tiny ? 0xc01e0c : 0x7a1a0c, 30);
    [-1, 1].forEach((s) => A.eye(0.1, em, b, 0.1 * s, 0.03, 0.29, 0.75, 1.1, 1));
    A.tube([[0, -0.1, 0.3], [0, -0.18, 0.32], [0, -0.24, 0.3]], { r0: 0.025, r1: 0.04, segs: 8 }, lm, b);
    [-1, 1].forEach((s) => A.tube(A.mirror([[0.03, 0.04, 0.35], [0.05, 0.02, 0.38], [0.06, -0.03, 0.39]], s), { r0: 0.012, r1: 0.02, segs: 6 }, lm, b));
    this.wings = A.wingPair(b, A.wingMat('fly', tiny ? 0xfff4e0 : 0xf0f0ff), { length: 0.52, width: 0.24, x: 0.08, y: 0.13, z: 0.08 });
    this.gait = A.legSet(b, [
      [0.06, -0.1, 0.12, 0.3, 0.35],
      [0.07, -0.1, 0.04, 0.36, 0.02],
      [0.06, -0.1, -0.04, 0.32, -0.3],
    ], { mat: lm, coxa: 0.04, femur: 0.2, tibia: 0.22, tarsus: 0.18, r: 0.018, radial: 5 }, { hangDrop: 0.28, fit: false });
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
    A.poseWings(this.wings, 0.35, Math.sin(G.time * 110) * 0.9);
    this.gait.update(dt, 0, true);
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
    const m = A.cuticleMat(0xaab2bc, { rough: 0.5, metal: 0.55, coat: 0.8, coatRough: 0.2, repeat: 4, bump: 0.7 });
    const fil = A.cuticleMat(0x8a929c, { rough: 0.7, coat: 0.4, hair: true });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.13; this.group.add(b);
    // a carrot of overlapping scaly plates, wide at the front, tapering to three tail filaments
    this.segs = [];
    for (let i = 0; i < 10; i++) {
      const r = 0.2 * (1 - i * 0.075);
      this.segs.push(A.part({ len: 0.17, rad: r, p: 0.35, flat: 0.32, wide: 1.1 }, m, b, 0, 0.01 - i * 0.002, 0.36 - i * 0.1));
    }
    A.part({ len: 0.14, rad: 0.1, flat: 0.45, wide: 1.2 }, m, b, 0, 0.0, 0.47);
    [-1, 1].forEach((s) => A.tube(A.mirror([[0.04, 0.02, 0.54], [0.15, 0.08, 0.75], [0.3, 0.1, 1.0], [0.45, 0.05, 1.25]], s), { r0: 0.012, r1: 0.005, segs: 30, beads: 20, beadAmt: 0.2 }, fil, b));
    [-0.4, 0, 0.4].forEach((a) => A.tube([[0, 0.01, -0.58], [Math.sin(a) * 0.25, 0.03, -0.62 - Math.cos(a) * 0.25], [Math.sin(a) * 0.55, 0.02, -0.62 - Math.cos(a) * 0.55]], { r0: 0.012, r1: 0.004, segs: 16, beads: 12, beadAmt: 0.2 }, fil, b));
    this.gait = A.legSet(b, [
      [0.1, -0.03, 0.36, 0.3, 0.46],
      [0.11, -0.03, 0.26, 0.34, 0.24],
      [0.1, -0.03, 0.16, 0.32, 0.0],
    ], { mat: fil, coxa: 0.03, femur: 0.12, tibia: 0.12, tarsus: 0.08, r: 0.014, radial: 5 }, { stride: 0.16, lift: 0.04, speedRef: 11 });
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
    this.gait.update(dt, sp);
    this.segs.forEach((s, i) => { s.position.x = Math.sin(G.time * 14 - i * 0.8) * 0.03 * Math.min(1, sp / 4) * (i / 9); });
  }
  onAttack() { sfx('hiss', { pos: this.body.pos, vol: 0.3 }); }
}

// House centipede: yellow-grey with three dark stripes, 15 pairs of very long banded legs.
const CENTI = () => A.patternMap('centi', (c, w, h) => {
  c.fillStyle = '#b8a47a'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#3a2e4a';
  [0.5, 0.38, 0.62].forEach((u) => c.fillRect(w * u - 5, 0, 10, h));
  c.fillStyle = 'rgba(58,46,74,0.5)'; c.fillRect(0, 0, w * 0.2, h); c.fillRect(w * 0.8, 0, w * 0.2, h);
});

export class HouseCentipede extends Creature {
  constructor() {
    super({ name: 'House Centipede', hp: 45, radius: 1.3, height: 0.8, speed: 12.5, damage: 15, deathCause: 'centipede' });
    this.isBug = true;
    this.aggroRange = 16; this.leashRange = 90; this.attackRange = 2.2; this.attackDelay = 1.2;
    this.knockback = 1;
    const m = A.cuticleMat(0xffffff, { rough: 0.8, coat: 0.4, hair: true, map: CENTI() });
    const legM = A.bandedMat(0xd6c49a, 0x4a3a5a, { bands: 3, width: 0.08 });
    const antM = A.cuticleMat(0xa89870, { rough: 0.8, coat: 0.2, hair: true });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.55; this.group.add(b);
    const N = 15, table = [];
    for (let i = 0; i < N; i++) {
      const z = 1.3 - i * 0.19;
      A.part({ len: 0.23, rad: 0.14, p: 0.35, flat: 0.42, wide: 1.25 }, m, b, 0, 0, z);
      table.push([0.13, -0.02, z, 1.0, z + (i < 7 ? 0.45 - i * 0.05 : -0.1 - (i - 7) * 0.08), { femur: 0.7 + i * 0.03, tibia: 0.95 + i * 0.05, tarsus: 0.6 + i * 0.04 }]);
    }
    A.part({ len: 0.22, rad: 0.13, flat: 0.6, wide: 1.1 }, m, b, 0, 0.02, 1.5);
    const em = A.eyeMat(0x1a1420, 16);
    [-1, 1].forEach((s) => A.eye(0.045, em, b, 0.1 * s, 0.05, 1.52));
    [-1, 1].forEach((s) => {
      A.tube(A.mirror([[0.05, 0.03, 1.6], [0.8, 0.4, 2.6], [1.6, 0.2, 3.8], [2.2, -0.1, 4.6]], s), { r0: 0.016, r1: 0.006, segs: 40, beads: 30, beadAmt: 0.15 }, antM, b);
      A.tube(A.mirror([[0.1, 0.0, -1.4], [0.9, 0.3, -2.6], [1.5, 0.1, -3.8], [1.8, -0.2, -4.4]], s), { r0: 0.02, r1: 0.006, segs: 30, beads: 12, beadAmt: 0.2 }, legM, b);
    });
    this.gait = A.legSet(b, table, { mat: legM, femur: 0.8, tibia: 1.1, tarsus: 0.7, r: 0.022, radial: 5, tarsusAngle: -0.3, shadow: false }, { stride: 0.55, lift: 0.18, speedRef: 12, reach: 0.86 }, A.WAVE(N));
    this.registerFlash();
  }
  animate(dt) { this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z), !this.body.grounded && this.body.vel.y < -4); }
  onAggro() { sfx('hiss', { pos: this.body.pos, vol: 0.9 }); if (G.player) G.player.shake += 0.3; }
  onAttack() { sfx('crunch', { pos: this.body.pos }); }
}

export class CellarSpider extends Creature {
  constructor() {
    super({ name: 'Daddy Long-Legs', hp: 25, radius: 1, height: 2.2, speed: 4, damage: 9, deathCause: 'spider' });
    this.isBug = true; this.isSpider = true;
    this.aggroRange = 7; this.leashRange = 25; this.attackRange = 1.8; this.attackDelay = 1.5;
    const m = A.cuticleMat(0xd8c8a8, { rough: 0.55, coat: 0.6, transparent: true, opacity: 0.9 });
    const legM = A.bandedMat(0x9a8a6a, 0xe8dcc0, { bands: 1, width: 0.05, offset: 0.97 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 2.1; this.group.add(b);
    A.part({ len: 0.26, rad: 0.13, flat: 0.7 }, m, b, 0, 0, 0.08);
    A.part({ len: 0.52, rad: 0.15, peak: 0.55, p: 0.55 }, m, b, 0, 0.08, -0.3, -0.45);
    A.part({ len: 0.08, rad: 0.05 }, A.ocellusMat(0x1a1210), b, 0, 0.08, 0.2);
    this.gait = A.legSet(b, [
      [0.05, -0.03, 0.13, 1.6, 2.2],
      [0.07, -0.03, 0.09, 2.4, 0.8],
      [0.07, -0.03, 0.05, 2.4, -0.8],
      [0.05, -0.03, 0.01, 1.7, -2.2],
    ], { mat: legM, coxa: 0.03, femur: 1.5, tibia: 1.8, tarsus: 1.9, r: 0.02, radial: 5, tarsusAngle: -0.8 }, { stride: 0.6, lift: 0.3, speedRef: 4, reach: 0.7 }, A.TETRAPOD);
    this.registerFlash();
  }
  animate(dt) {
    // cellar spiders "whirl" when disturbed: the body bobs quickly on planted legs
    this.bodyG.position.y = 2.1 + (this.state === 'chase' ? Math.sin(G.time * 18) * 0.12 : Math.sin(G.time * 1.5) * 0.03);
    this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z));
  }
}

export class BedBug extends Creature {
  constructor() {
    super({ name: 'Bed Bug', hp: 12, radius: 0.35, height: 0.2, speed: 3.5, damage: 4, deathCause: 'housebugs' });
    this.isBug = true;
    this.aggroRange = 6; this.leashRange = 30; this.attackRange = 0.9; this.attackDelay = 1.3;
    const m = A.cuticleMat(0x7a2e16, { rough: 0.7, coat: 0.6, hair: true, bump: 0.5 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.13; this.group.add(b);
    const AB = { len: 0.5, rad: 0.26, peak: 0.45, p: 0.45, flat: 0.3, ridges: 6, ridgeDepth: 0.05 };
    const ab = A.part(AB, m, b, 0, 0.02, -0.1);
    A.hairs(AB, { count: 50, len: 0.016, r: 0.0022, lay: 1.6, minUp: 0, seed: 31 }, A.hairMat(0x6a3a20), ab);
    A.part({ len: 0.14, rad: 0.17, p: 0.35, flat: 0.3, wide: 1.25 }, m, b, 0, 0.03, 0.2);
    A.part({ len: 0.12, rad: 0.07, flat: 0.6 }, m, b, 0, 0.02, 0.32);
    const em = A.eyeMat(0x2a0a06, 10);
    [-1, 1].forEach((s) => {
      A.eye(0.025, em, b, 0.065 * s, 0.03, 0.31);
      A.tube(A.mirror([[0.04, 0.02, 0.37], [0.1, 0.04, 0.45], [0.14, 0.03, 0.55]], s), { r0: 0.01, r1: 0.008, segs: 12, beads: 4, beadAmt: 0.35 }, m, b);
    });
    this.gait = A.legSet(b, [
      [0.08, -0.03, 0.18, 0.28, 0.3],
      [0.1, -0.03, 0.1, 0.32, 0.06],
      [0.1, -0.03, 0.02, 0.3, -0.2],
    ], { mat: m, femur: 0.13, tibia: 0.13, tarsus: 0.07, r: 0.014, radial: 5 }, { stride: 0.12, lift: 0.04, speedRef: 3.5 });
    this.registerFlash();
  }
  animate(dt) { this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); }
}

// Brown house moth: fore and hind wing painted on one sheet per side, covered in scales.
const MOTH_WING = () => TX.drawn('mothwing2', 256, 192, (c, w, h) => {
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#7a6a52';
  c.beginPath(); c.moveTo(6, h * 0.52); c.bezierCurveTo(w * 0.3, h * 0.98, w * 0.72, h * 0.98, w * 0.7, h * 0.56); c.closePath(); c.fill();
  const g = c.createLinearGradient(0, 0, w, h * 0.5);
  g.addColorStop(0, '#6a5a44'); g.addColorStop(0.5, '#a08868'); g.addColorStop(1, '#8a7456');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(4, h * 0.46); c.bezierCurveTo(w * 0.4, h * 0.08, w * 0.8, h * 0.03, w - 4, h * 0.1); c.lineTo(w * 0.86, h * 0.56); c.bezierCurveTo(w * 0.6, h * 0.62, w * 0.3, h * 0.6, 4, h * 0.52); c.closePath(); c.fill();
  c.save(); c.clip();
  c.strokeStyle = 'rgba(50,38,26,0.6)'; c.lineWidth = 3;
  [0.38, 0.62].forEach((x) => { c.beginPath(); for (let y = 0; y <= 1; y += 0.05) c.lineTo(w * x + Math.sin(y * 18) * 5 + y * 20, h * (0.05 + y * 0.55)); c.stroke(); });
  c.fillStyle = 'rgba(40,30,20,0.7)'; c.beginPath(); c.ellipse(w * 0.55, h * 0.3, 9, 6, 0.4, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '30,22,14' : '220,200,170'},0.12)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
  c.restore();
  c.strokeStyle = 'rgba(200,180,150,0.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(w * 0.86, h * 0.56); c.bezierCurveTo(w * 0.6, h * 0.66, w * 0.3, h * 0.64, 4, h * 0.54); c.stroke();
});

export class Moth extends Creature {
  constructor() {
    super({ name: 'Moth', hp: 6, radius: 0.5, height: 0.4, speed: 6, damage: 0, deathCause: 'housebugs', flying: true });
    this.isBug = true;
    this.passive = true;
    const wm = new THREE.MeshStandardMaterial({ map: MOTH_WING(), transparent: true, side: THREE.DoubleSide, roughness: 0.95, alphaTest: 0.2, emissive: 0x000000 });
    const fur = A.cuticleMat(0x8a7658, { rough: 1, coat: 0, hair: true, sheen: 1, sheenColor: 0xd8c8a8 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.4; this.group.add(b);
    const TH = { len: 0.26, rad: 0.1 };
    const th = A.part(TH, fur, b, 0, 0, 0.06);
    A.hairs(TH, { count: 120, len: 0.05, r: 0.005, lay: 0.6, minUp: -0.6, seed: 41 }, A.hairMat(0xa89478, 1), th);
    A.part({ len: 0.42, rad: 0.085, peak: 0.6, ridges: 5, ridgeDepth: 0.08 }, fur, b, 0, -0.01, -0.26);
    A.part({ len: 0.1, rad: 0.07 }, fur, b, 0, 0, 0.23);
    const em = A.eyeMat(0x14100c, 16);
    [-1, 1].forEach((s) => {
      A.eye(0.045, em, b, 0.05 * s, 0.01, 0.25);
      A.tube(A.mirror([[0.03, 0.05, 0.27], [0.12, 0.12, 0.4], [0.22, 0.14, 0.52]], s), { r0: 0.014, r1: 0.006, segs: 20, beads: 16, beadAmt: 0.5 }, fur, b);
    });
    this.wings = A.wingPair(b, wm, { length: 0.95, width: 0.72, x: 0.05, y: 0.05, z: 0.04 });
    this.gait = A.legSet(b, [
      [0.04, -0.06, 0.1, 0.2, 0.25],
      [0.05, -0.06, 0.05, 0.24, 0.02],
      [0.04, -0.06, 0.0, 0.22, -0.2],
    ], { mat: fur, femur: 0.12, tibia: 0.14, tarsus: 0.1, r: 0.014, radial: 5 }, { hangDrop: 0.15, fit: false });
    this.registerFlash();
  }
  brain(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0 || !this.wanderTo) { this.wanderT = 0.4 + Math.random(); this.wanderTo = this.home.clone().add(V((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 40)); }
    this.steer(dt, this.wanderTo.x, this.wanderTo.z, this.speed, 5, this.wanderTo.y);
  }
  animate(dt) {
    A.poseWings(this.wings, 0.25, Math.sin(G.time * 28) * 0.8);
    this.gait.update(dt, 0, true);
  }
}

const LADY = () => A.patternMap('ladybug', (c, w, h) => {
  c.fillStyle = '#c81c14'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#0c0c0c';
  [[0.35, 0.3, 11], [0.6, 0.62, 13], [0.3, 0.78, 9], [0.78, 0.35, 8]].forEach(([u, v, r]) => { c.beginPath(); c.ellipse(u * w, (1 - v) * h, r * 1.1, r * 1.6, 0, 0, Math.PI * 2); c.fill(); });
  c.fillRect(w * 0.94, 0, w * 0.06, h);
});
const LADY_PRO = () => A.patternMap('ladypro', (c, w, h) => {
  c.fillStyle = '#0c0c0c'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#d8d0bc';
  [0.3, 0.7].forEach((u) => { c.beginPath(); c.ellipse(u * w, h * 0.5, w * 0.05, h * 0.22, 0, 0, Math.PI * 2); c.fill(); });
}, 128, 64);

export class Ladybug extends Creature {
  constructor() {
    super({ name: 'Ladybug', hp: 10, radius: 0.4, height: 0.4, speed: 1.5, damage: 0, deathCause: 'housebugs' });
    this.isBug = true;
    this.passive = true;
    const shell = A.cuticleMat(0xffffff, { map: LADY(), rough: 0.35, coat: 1, coatRough: 0.04, bump: 0.12, side: THREE.DoubleSide });
    const black = A.cuticleMat(0x0e0e0e, { rough: 0.5, coat: 0.8, coatRough: 0.15 });
    const b = this.bodyG = new THREE.Group(); b.position.y = 0.13; this.group.add(b);
    A.part({ len: 0.58, rad: 0.3, flat: 0.35 }, black, b, 0, -0.02, -0.02);
    const EL = { len: 0.64, rad: 0.36, peak: 0.45, p: 0.38, flat: 0.8, radial: 22 };
    A.part({ ...EL, phi0: Math.PI / 2 - 0.15, phiLen: Math.PI / 2 + 0.15 }, shell, b, 0, 0.02, -0.03);
    A.part({ ...EL, phi0: Math.PI, phiLen: Math.PI / 2 + 0.15 }, shell, b, 0, 0.02, -0.03);
    A.part({ len: 0.16, rad: 0.21, p: 0.35, flat: 0.5, wide: 1.1 }, A.cuticleMat(0xffffff, { map: LADY_PRO(), rough: 0.4, coat: 1, coatRough: 0.06 }), b, 0, 0.04, 0.3);
    A.part({ len: 0.1, rad: 0.09, flat: 0.7 }, black, b, 0, -0.02, 0.38);
    [-1, 1].forEach((s) => A.tube(A.mirror([[0.05, 0, 0.42], [0.08, 0.02, 0.46], [0.1, 0.02, 0.5]], s), { r0: 0.008, r1: 0.012, segs: 6, club: 0.8 }, black, b));
    this.gait = A.legSet(b, [
      [0.1, -0.06, 0.14, 0.3, 0.3],
      [0.12, -0.06, 0.04, 0.34, 0.02],
      [0.11, -0.06, -0.06, 0.3, -0.24],
    ], { mat: black, femur: 0.1, tibia: 0.1, tarsus: 0.06, r: 0.013, radial: 5 }, { stride: 0.1, lift: 0.04, speedRef: 1.5 });
    this.registerFlash();
  }
  animate(dt) { this.gait.update(dt, Math.hypot(this.body.vel.x, this.body.vel.z)); }
}

// Fleas live in the carpet around Biscuit's bed and do everything they can to get onto him.
export class HouseFlea extends Flea {
  constructor() {
    super();
    this.isFlea = true;
    this.deathCause = 'housebugs';
    this.loot = [];
    this.dogCd = 4 + Math.random() * 8;
  }
  brain(dt, level, player) {
    this.dogCd = Math.max(0, this.dogCd - dt);
    const dog = level.refs && level.refs.dog;
    if (dog && this.dogCd <= 0 && !this.aggro && this.distTo(player.body.pos) > 6 && this.distTo(dog.body.pos) < 260) {
      this.steer(dt, dog.body.pos.x, dog.body.pos.z, this.speed, 6);
      this.hopT -= dt;
      if (this.hopT <= 0 && this.body.grounded) { this.hopT = 0.5 + Math.random(); this.body.vel.y = 11 + Math.random() * 5; }
      return;
    }
    super.brain(dt, level, player);
  }
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
  // Biscuit's corner: a fly that keeps buzzing round his nose, and fleas in the carpet by his bed
  { make: () => new HouseFly(), pos: [925, 28, 425] },
  ...[[885, 360], [1015, 370], [880, 505], [1012, 505], [950, 372]].map(([x, z]) => ({ make: () => new HouseFlea(), pos: [x, 0, z] })),
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
export function respawnHouseBugs(level, { awayFrom = null, minDist = 0 } = {}) {
  for (const hb of level.houseBugs || []) {
    if (hb.c.onDog) continue;
    if (!hb.c.dead && level.creatures.includes(hb.c)) continue;
    if (awayFrom && Math.hypot(hb.def.pos[0] - awayFrom.x, hb.def.pos[2] - awayFrom.z) < minDist) continue;
    if (hb.c.group.parent) hb.c.group.parent.remove(hb.c.group);
    const i = level.creatures.indexOf(hb.c); if (i >= 0) level.creatures.splice(i, 1);
    hb.c = hb.def.make();
    hb.c.place(...hb.def.pos);
    level.scene.add(hb.c.group);
    level.creatures.push(hb.c);
  }
}

export { angDiff };
