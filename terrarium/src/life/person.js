// One person (tiny or normal size). Body + health + needs + feelings + memory.
// Thinking/acting lives in ai.js; talking in talk/brain.js.
import * as THREE from 'three';
import { Body, poseTargets, J, bodyRestYaw } from './body.js';
import { makeLook, randomTraits, randomName, voiceFor, JOBS, JOB_KEYS, LAST } from './looks.js';
import { TINY } from './items.js';
import { clamp, lerp, rand, nextId, bumpId, angleDiff, damp } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { settings } from '../core/settings.js';

const NEEDS = ['hunger', 'thirst', 'energy', 'social', 'fun', 'hygiene', 'warmth', 'bladder'];
// how many game-days a full bar lasts
const LASTS = { hunger: 1.6, thirst: 1.0, energy: 0.8, social: 1.0, fun: 1.2, hygiene: 2.5, warmth: 0.25, bladder: 0.3 };
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export const CAUSE = {
  bleed: 'bled out', starve: 'starved', thirst: 'died of thirst', sick: 'died of sickness', fall: 'died from a fall', crush: 'got crushed',
  burn: 'burned to death', drown: 'drowned', freeze: 'froze to death', explode: 'got blown apart', bug: 'was killed by a bug', poison: 'was poisoned',
};

export class Person {
  constructor(game, opts = {}) {
    this.game = game;
    this.id = opts.id || nextId();
    bumpId(this.id);
    const age = opts.age || 'adult';
    this.age = age;
    this.kid = age === 'kid' || age === 'baby';
    this.sex = opts.sex || (rand() < 0.5 ? 'm' : 'f');
    this.job = opts.job || (this.kid ? null : rand.pick(JOB_KEYS));
    this.look = opts.look || makeLook({ sex: this.sex, job: this.job, age });
    this.name = opts.name || randomName(this.sex);
    this.last = opts.last || rand.pick(LAST);
    this.traits = opts.traits || randomTraits(rand, 4);
    this.voice = opts.voice || voiceFor(this.look);
    this.ageYears = opts.ageYears ?? (age === 'baby' ? 0 : age === 'kid' ? 6 + ((rand() * 6) | 0) : 19 + ((rand() * 45) | 0));
    this.growDays = opts.growDays || 0;
    this.scale = opts.scale ?? 1;
    this.pos = (opts.pos || new THREE.Vector3()).clone();
    this.yaw = opts.yaw ?? rand() * Math.PI * 2;
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.state = 'alive';
    this.loc = opts.loc || 'cage';
    this.health = 100;
    this.bleed = 0;            // health per game-minute
    this.wounds = [];
    this.bandaged = 0;
    this.sick = null;          // {kind, sev, t}
    this.needs = {};
    for (const n of NEEDS) this.needs[n] = 70 + rand() * 30;
    this.op = opts.op ?? -10;  // what they think of you (-100 hate .. 100 love)
    this.fear = opts.fear ?? 55;
    this.faith = 0;
    this.loveYou = 0;
    this.rel = new Map();      // id -> {f: friendship, l: love}
    this.partner = null; this.married = false;
    this.parents = opts.parents || []; this.kids = [];
    this.tribe = null;
    this.inv = { wood: 0, stone: 0, fiber: 0, food: 0, metal: 0, clay: 0, powder: 0, electric: 0, money: 0, bandage: 0, medicine: 0 };
    this.holding = null;       // Item in hand (tool/weapon)
    this.mem = [];
    this.thought = '';
    this.task = null;
    this.order = null;
    this.emotion = null;       // {kind, t} from gadgets/potions
    this.ko = 0; this.frozen = 0; this.stun = 0; this.stuck = 0; this.asleep = false; this.grief = 0;
    this.speedMul = 1; this.invisible = 0; this.shield = 0; this.burning = 0; this.floatT = 0; this.bouncy = 0;
    this.mind = null;          // mind control: {mode:'body'|'orders'}
    this.objectForm = null;    // object gun: {type}
    this.money = 0;
    this.kills = 0;
    this.title = '';
    this.cause = null;
    this.deathT = 0;
    this.buried = false;
    this.lastSpeak = -99;
    this.bornDay = opts.bornDay || 1;
    this.anim = { phase: rand() * 6, speed: 0, action: null, at: 0, crouch: 0, lying: false, air: false, limp: -1 };
    this.path = null; this.goal = null; this.run = false;
    this.thinkT = rand() * 1.2;
    this.home = null;
    this.carryCorpse = null;
    this.held = false;
    this.remembersPlayerAs = null; // name you told them
    this.limbsLost = 0;
    this.body = new Body(this.look, game.sink, { pos: this.pos, yaw: this.yaw, scale: this.scale });
    this.body.groundFn = (x, z, y) => game.groundAt(x, z, y, this);
    this.body.dead = false;
    this.has = (t) => this.traits.includes(t);
  }

  // ------------------------------------------------------------- basic facts
  get sc() { return this.scale * this.look.height; }
  get height() { return 1.75 * this.sc; }
  get gEff() { return 9.8 * Math.sqrt(Math.max(this.sc, 1e-4)); }
  get alive() { return this.state === 'alive'; }
  get busyBody() { return this.held || this.loc === 'bottle' || this.loc === 'jar' || this.loc === 'table' || this.objectForm; }
  get fullName() { return `${this.name} ${this.last}`; }
  get jobLabel() { return this.kid ? (this.age === 'baby' ? 'Baby' : 'Kid') : (JOBS[this.job] ? JOBS[this.job].label : 'Nobody'); }
  skill(k) { return (JOBS[this.job] && JOBS[this.job][k]) || 0.5; }
  get inCage() { return this.game.cage.insideBox(this.pos, -0.001); }
  get canHoldRight() { return this.body.limbOK('r', 'hand'); }
  get canHoldLeft() { return this.body.limbOK('l', 'hand'); }
  get handsLeft() { return (this.canHoldLeft ? 1 : 0) + (this.canHoldRight ? 1 : 0); }
  get legsLeft() { return (this.body.limbOK('l', 'leg') ? 1 : 0) + (this.body.limbOK('r', 'leg') ? 1 : 0); }
  headPos(out = new THREE.Vector3()) { return this.body.P(J.head, out); }
  center(out = new THREE.Vector3()) { return this.body.P(J.pelvis, out); }
  dist(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }
  relOf(o) { const id = typeof o === 'number' ? o : o.id; let r = this.rel.get(id); if (!r) { r = { f: 0, l: 0 }; this.rel.set(id, r); } return r; }

  mood() {
    const n = this.needs;
    let m = 0;
    m += (n.hunger - 50) * 0.35 + (n.thirst - 50) * 0.35 + (n.energy - 50) * 0.2 + (n.social - 50) * 0.2 + (n.fun - 50) * 0.2 + (n.hygiene - 50) * 0.08 + (n.warmth - 50) * 0.2;
    m += (this.health - 80) * 0.5;
    if (this.sick) m -= 15;
    m -= this.limbsLost * 12;
    m -= this.grief * 30;
    if (this.partner) m += 10;
    if (this.has('grumpy')) m -= 10;
    if (this.has('funny') || this.has('calm')) m += 6;
    if (this.loc === 'jar') m -= 25;
    if (this.emotion) {
      const e = this.emotion.kind;
      if (e === 'joy' || e === 'love' || e === 'calm') m += 40;
      if (e === 'sad' || e === 'fear') m -= 40;
      if (e === 'rage' || e === 'hate') m -= 20;
    }
    return clamp(m, -100, 100);
  }

  feeling() {
    if (!this.alive) return 'dead';
    if (this.ko > 0) return 'knocked out';
    if (this.asleep) return 'asleep';
    if (this.emotion) return { joy: 'happy', love: 'in love', calm: 'calm', sad: 'sad', fear: 'terrified', rage: 'furious', hate: 'hateful' }[this.emotion.kind] || this.emotion.kind;
    const m = this.mood();
    if (this.fear > 75) return 'terrified';
    if (this.grief > 0.3) return 'grieving';
    if (m > 50) return 'happy';
    if (m > 15) return 'okay';
    if (m > -20) return 'meh';
    if (m > -50) return 'upset';
    return 'miserable';
  }

  remember(kind, text, val = 0, who = null) {
    const w = this.game.world;
    this.mem.push({ kind, text, val, who, day: w.day, time: w.time });
    if (this.mem.length > 40) this.mem.shift();
  }

  // ------------------------------------------------------------- talk
  say(text, opts = {}) {
    if (!text) return;
    this.lastSpeak = this.game.time;
    this.game.speak(this, text, opts);
  }

  // ------------------------------------------------------------- damage
  // hit: {dmg, type: blade|blunt|pierce|shot|fire|crush|fall|bite|shock|explode, point, dir, from (Person|'player'|bug), part}
  hurt(hit) {
    if (!this.alive) { this.goreOnCorpse(hit); return; }
    if (this.kid) { // kids can never be hurt
      this.fear = Math.min(100, this.fear + 20);
      if (hit.dir) this.body.push(_v.copy(hit.dir).multiplyScalar(this.height * 0.5));
      return;
    }
    if (this.shield > 0) { this.game.fx.ring(this.center(_v), 0x60c0ff, this.height * 0.6, 0.3); return; }
    const g = this.game;
    const gore = settings.gore;
    let dmg = hit.dmg;
    if (this.frozen > 0 && (hit.type === 'blunt' || hit.type === 'crush' || hit.type === 'explode') && dmg > 25) { this.shatter(); return; }
    const point = hit.point || this.center(_v.clone());
    const part = hit.part || this.partAt(point);
    const s = this.height;
    if (part === 'head') dmg *= 1.6;
    if (this.has('strong')) dmg *= 0.85;
    this.health -= dmg;
    this.stun = Math.max(this.stun, 0.25);
    if (dmg > 3) sfx(hit.type === 'blade' ? 'slice' : hit.type === 'shot' ? 'hit' : 'hit', { vol: g.audibleVol(this.pos, 0.8), pitch: 1 + (1 - this.sc) * 0.4 });
    // blood
    const bloody = gore !== 'none' && hit.type !== 'shock' && hit.type !== 'fire';
    if (bloody && dmg > 4) {
      g.fx.blood(point, hit.dir || new THREE.Vector3(0, 1, 0), s, clamp(dmg / 40, 0.2, 1.5));
      this.bleed += (hit.type === 'blade' || hit.type === 'pierce' || hit.type === 'shot') ? dmg * 0.008 : dmg * 0.002;
      this.wounds.push({ part, type: hit.type });
      if (this.wounds.length > 12) this.wounds.shift();
    }
    // cutting off limbs: depends on the weapon and where it hits
    if (gore === 'max' && hit.type !== 'blunt' && hit.type !== 'fall' && hit.type !== 'fire' && hit.type !== 'shock') {
      const cutPower = (hit.type === 'blade' ? 1 : hit.type === 'explode' ? 0.9 : hit.type === 'shot' ? 0.5 : hit.type === 'bite' ? 0.7 : 0.25) * dmg;
      const joint = this.jointFor(part, point);
      const need = joint === 'neck' ? 55 : joint === 'waist' ? 80 : joint.includes('Shoulder') || joint.includes('Hip') ? 38 : 26;
      if (joint && cutPower > need * (0.7 + rand() * 0.6)) this.cutOff(joint, hit);
    }
    // knock down
    const knock = (hit.type === 'blunt' || hit.type === 'explode' || hit.type === 'crush') ? dmg / 25 : dmg / 60;
    if (hit.dir && (knock > 0.5 || this.legsLeft === 0)) {
      this.body.ragdoll(0.8 + knock);
      this.body.impulse(point, _v2.copy(hit.dir).multiplyScalar(s * (1 + knock) * 2), s * 0.5);
    }
    if (hit.type === 'fire') { this.burning = Math.max(this.burning, 3); }
    // feelings
    if (hit.from === 'player') this.hurtByPlayer(dmg);
    else if (hit.from && hit.from.id && hit.from !== this) {
      const r = this.relOf(hit.from); r.f -= dmg * 1.5; r.l = Math.max(0, r.l - dmg);
      this.remember('hurt', `${hit.from.name} hurt me`, -dmg, hit.from.id);
      this.lastAttacker = hit.from;
      this.lastAttackT = g.time;
    }
    if (this.health <= 0) this.die(hit.cause || (hit.from === 'player' ? 'killed by you' : hit.from && hit.from.name ? `killed by ${hit.from.name}` : hit.type === 'fall' ? CAUSE.fall : 'died'), hit);
    else if (dmg > 6 && this.ko <= 0) {
      const scream = this.has('brave') ? ['Argh!', 'Ugh!', 'You little...'] : ['AAAH!', 'OW OW OW!', 'Help me!', 'Please no!'];
      if (g.time - this.lastSpeak > 1.2) this.say(rand.pick(scream), { kind: 'scared', scream: true });
    }
  }

  hurtByPlayer(dmg) {
    this.op = clamp(this.op - dmg * 0.9, -100, 100);
    this.fear = clamp(this.fear + dmg * 0.8, 0, 100);
    this.loveYou = Math.max(0, this.loveYou - dmg);
    this.remember('hurt', 'The giant hurt me', -dmg, 'player');
    this.lastAttacker = 'player';
    this.lastAttackT = this.game.time;
    // everyone who saw it
    for (const o of this.game.people) {
      if (o === this || !o.alive || o.kid || o.asleep) continue;
      if (o.dist(this.pos) > this.height * 25) continue;
      const r = o.relOf(this);
      o.op = clamp(o.op - dmg * (0.3 + Math.max(0, r.f) / 150 + r.l / 80), -100, 100);
      o.fear = clamp(o.fear + dmg * 0.3, 0, 100);
      if (dmg > 20) o.remember('saw', `The giant hurt ${this.name}`, -dmg / 2, 'player');
    }
  }

  partAt(p) {
    const b = this.body;
    const d = (i) => b.P(i, _v2).distanceToSquared(p);
    const cand = [
      ['head', d(J.head)], ['torso', Math.min(d(J.neck), d(J.pelvis))],
      ['lArm', Math.min(d(J.lEl), d(J.lHa))], ['rArm', Math.min(d(J.rEl), d(J.rHa))],
      ['lLeg', Math.min(d(J.lKn), d(J.lFt))], ['rLeg', Math.min(d(J.rKn), d(J.rFt))],
    ];
    cand.sort((a, c) => a[1] - c[1]);
    return cand[0][0];
  }

  jointFor(part, p) {
    const b = this.body;
    switch (part) {
      case 'head': return b.canCut('neck') ? 'neck' : null;
      case 'torso': return b.canCut('waist') && rand() < 0.35 ? 'waist' : null;
      case 'lArm': case 'rArm': {
        const s = part[0];
        const el = b.P(s === 'l' ? J.lEl : J.rEl, _v2.clone()), sh = b.P(s === 'l' ? J.lSh : J.rSh, _v2.clone());
        const j = p.distanceTo(el) < p.distanceTo(sh) * 0.9 ? s + 'Elbow' : s + 'Shoulder';
        return b.canCut(j) ? j : b.canCut(s + 'Shoulder') ? s + 'Shoulder' : null;
      }
      case 'lLeg': case 'rLeg': {
        const s = part[0];
        const kn = b.P(s === 'l' ? J.lKn : J.rKn, _v2.clone()), hp = b.P(s === 'l' ? J.lHip : J.rHip, _v2.clone());
        const j = p.distanceTo(kn) < p.distanceTo(hp) ? s + 'Knee' : s + 'Hip';
        return b.canCut(j) ? j : b.canCut(s + 'Hip') ? s + 'Hip' : null;
      }
      default: return null;
    }
  }

  cutOff(joint, hit = {}) {
    if (this.kid || settings.gore !== 'max') return false;
    const r = this.body.sever(joint);
    if (!r) return false;
    const g = this.game;
    this.limbsLost++;
    const at = this.body.P(r.base, _v.clone());
    g.fx.blood(at, hit.dir || new THREE.Vector3(0, 1, 0), this.height, 1.4);
    // the loose piece flies off a bit
    const fly = (hit.dir ? _v2.copy(hit.dir) : _v2.set(rand() - 0.5, 0.6, rand() - 0.5)).multiplyScalar(this.height * 1.5);
    for (const i of r.loose) { this.body.o[i * 3] -= fly.x / 60; this.body.o[i * 3 + 1] -= fly.y / 60; this.body.o[i * 3 + 2] -= fly.z / 60; }
    this.bleed += joint === 'neck' ? 100 : joint === 'waist' ? 60 : joint.includes('Shoulder') || joint.includes('Hip') ? 1.3 : 0.9;
    this.health -= joint === 'neck' ? 999 : joint === 'waist' ? 999 : 12;
    this.stumpBleed = (this.stumpBleed || []).concat([{ i: r.base, t: 30 }]);
    sfx('splat', { vol: g.audibleVol(this.pos, 1) });
    // drop what that hand was holding
    if (joint.startsWith('r') && (joint.includes('Shoulder') || joint.includes('Elbow')) && this.holding) g.dropHeld(this);
    if (this.alive) {
      this.fear = Math.min(100, this.fear + 40);
      this.remember('maimed', joint.includes('Hip') || joint.includes('Knee') ? 'I lost my leg' : 'I lost my arm', -60, hit.from === 'player' ? 'player' : hit.from && hit.from.id);
      const lines = ['MY ARM!', 'NOOO! MY ARM!', 'Oh god... oh god...', 'Somebody help me!'];
      const legLines = ['MY LEG! I can\'t feel my leg!', 'NO NO NO!', 'Help! I can\'t walk!'];
      this.say(rand.pick(joint.includes('Hip') || joint.includes('Knee') ? legLines : lines), { kind: 'scared', scream: true });
      g.feed(`${this.name} lost ${joint.includes('Hip') || joint.includes('Knee') ? 'a leg' : 'an arm'}`, 'bad', this);
    }
    if (this.health <= 0 && this.alive) this.die(joint === 'neck' ? 'lost their head' : joint === 'waist' ? 'got cut in half' : CAUSE.bleed, hit);
    return true;
  }

  // corpses can still be cut / smashed
  goreOnCorpse(hit) {
    if (settings.gore !== 'max' || this.kid) return;
    if (hit.type === 'blade' && hit.dmg > 20) {
      const j = this.jointFor(hit.part || this.partAt(hit.point || this.center(_v)), hit.point || this.center(_v));
      if (j) { const r = this.body.sever(j); if (r) { this.game.fx.blood(this.body.P(r.base, _v.clone()), hit.dir, this.height, 0.8); this.body.wake(); } }
    }
    if (hit.dir) { this.body.wake(); this.body.impulse(hit.point || this.center(_v), _v2.copy(hit.dir).multiplyScalar(this.height * 2), this.height * 0.5); }
  }

  squish(from) {
    if (this.kid) { this.hurt({ dmg: 0, type: 'blunt', from }); return; }
    const g = this.game;
    const gy = g.groundAt(this.pos.x, this.pos.z, this.pos.y + this.height);
    const b = this.body;
    b.ragdoll(99);
    if (settings.gore !== 'none') {
      for (let i = 0; i < b.used; i++) {
        b.p[i * 3 + 1] = gy + this.height * 0.04; b.o[i * 3 + 1] = b.p[i * 3 + 1];
        b.p[i * 3] += (rand() - 0.5) * this.height * 0.4; b.p[i * 3 + 2] += (rand() - 0.5) * this.height * 0.4;
      }
      this.flat = true;
      g.fx.blood(this.center(_v.clone()), new THREE.Vector3(0, 0.3, 0), this.height, 2);
      for (let i = 0; i < 6; i++) g.fx.splat(_v.set(this.pos.x + (rand() - 0.5) * this.height * 0.8, gy + 0.0002, this.pos.z + (rand() - 0.5) * this.height * 0.8), this.height * (0.15 + rand() * 0.2));
    }
    sfx('squish', { vol: g.audibleVol(this.pos, 1.2) });
    if (from === 'player') this.hurtByPlayer(100);
    this.health = 0;
    this.die(CAUSE.crush, { from });
  }

  shatter() {
    // frozen solid + hard hit = shatters into ice pieces
    const g = this.game;
    g.fx.burst(this.center(_v.clone()), [0xcfeaff, 0xa8d8ff, 0xffffff], 40, this.height, 1.3);
    if (settings.gore === 'max') for (const j of ['lShoulder', 'rShoulder', 'lHip', 'rHip', 'neck']) this.body.sever(j);
    sfx('shatter', { vol: g.audibleVol(this.pos, 1.2) });
    this.frozen = 0;
    this.health = 0;
    this.die('shattered while frozen', {});
  }

  die(cause, hit = {}) {
    if (!this.alive) return;
    if (this.kid) { this.health = 1; return; }
    const g = this.game;
    this.state = 'dead';
    this.cause = cause;
    this.deathT = g.time;
    this.deathDay = g.world.day;
    this.body.dead = true;
    this.body.ragdoll(9999);
    this.body.face.closed = 1; this.body.face.open = 0.2; this.body.face.smile = -0.3;
    this.task = null; this.order = null;
    if (this.holding) g.dropHeld(this);
    g.onDeath(this, cause, hit);
  }

  // ------------------------------------------------------------- update
  update(dt, tick) {
    const g = this.game;
    const body = this.body;
    const H = this.height;
    // dead: just a ragdoll
    if (!this.alive) {
      body.bounds = this.inCageBounds();
      this.simBody(dt);
      this.pos.set(body.p[J.pelvis * 3], g.groundAt(body.p[J.pelvis * 3], body.p[J.pelvis * 3 + 2], body.p[J.pelvis * 3 + 1] + H), body.p[J.pelvis * 3 + 2]);
      return;
    }
    if (this.timeStop > 0) { this.timeStop -= dt; return; }
    this.timers(dt);
    if (tick) this.slowTick(tick);
    if (this.objectForm) { body.hidden = true; return; }
    body.hidden = this.invisible > 0 && !g.player.seesInvisible;
    if (this.held || this.loc === 'bottle' || this.loc === 'jar' || this.loc === 'table' || this.loc === 'car') {
      // controlled from outside (hand / bottle / jar)
      this.anim.action = this.loc === 'table' ? 'sleep' : this.held ? (this.ko > 0 ? null : 'struggle') : this.loc === 'jar' ? (this.mood() < -20 ? 'bang' : null) : 'cower';
      this.anim.at += dt;
      this.anim.speed = 0;
      this.anim.lying = this.loc === 'table';
      if (!this.held && this.loc !== 'table') this.animate(dt);
      else this.simBody(dt);
      return;
    }
    // ragdoll (knocked over / thrown / unconscious)
    if (body.mode === 'rag') {
      body.bounds = this.inCageBounds();
      this.simBody(dt);
      body.ragT -= dt;
      const cx = body.p[J.pelvis * 3], cz = body.p[J.pelvis * 3 + 2], cy = body.p[J.pelvis * 3 + 1];
      this.pos.set(cx, g.groundAt(cx, cz, cy + H * 0.5), cz);
      this.checkImpact(dt);
      const v = body.velocity(J.pelvis, _v, Math.max(dt, 1e-4)).length() / H;
      if (body.ragT <= 0 && this.ko <= 0 && this.frozen <= 0 && v < 1.5 && this.legsLeft > 0) {
        body.mode = 'anim';
        this.yaw = bodyRestYaw(body) + Math.PI;
        this.getup = 0.7;
        this.vy = 0;
      }
      return;
    }
    if (this.frozen > 0 || this.stuck > 0) { this.anim.speed = 0; this.animate(dt, this.frozen > 0 ? 0 : 1); return; }
    // brain
    if (!this.asleep || this.order) g.ai.update(this, dt);
    this.locomote(dt);
    this.animate(dt);
  }

  inCageBounds() {
    const C = this.game.cage;
    if (!C.inside(this.body.p[J.pelvis * 3], this.body.p[J.pelvis * 3 + 2], -0.002) || this.body.p[J.pelvis * 3 + 1] > this.game.cageTopY + 0.05) return null;
    return this.game.cageBounds;
  }

  timers(dt) {
    const g = this.game;
    if (this.ko > 0) { this.ko -= dt; if (this.body.mode !== 'rag') this.body.ragdoll(this.ko); this.body.face.closed = 1; if (this.ko <= 0) this.body.face.closed = 0; }
    if (this.frozen > 0) { this.frozen -= dt; this.body.setTint(0x9fd8ff, 0.6); if (this.frozen <= 0) { this.body.setTint(null); sfx('crack', { vol: g.audibleVol(this.pos, 0.5) }); } }
    else if (this.burning > 0) this.body.setTint(0x2a1a10, 0.5);
    else if (this.sick && this.sick.sev > 0.4) this.body.setTint(0x7ac060, 0.25);
    else this.body.setTint(null);
    if (this.stun > 0) this.stun -= dt;
    if (this.stuck > 0) this.stuck -= dt;
    if (this.invisible > 0) this.invisible -= dt;
    if (this.shield > 0) this.shield -= dt;
    if (this.bouncy > 0) this.bouncy -= dt;
    if (this.getup > 0) this.getup -= dt;
    if (this.emotion) { this.emotion.t -= dt; if (this.emotion.t <= 0) this.emotion = null; }
    if (this.speedT > 0) { this.speedT -= dt; if (this.speedT <= 0) this.speedMul = 1; }
    if (this.floatT > 0) {
      this.floatT -= dt;
      this.body.ragdoll(0.5);
      this.body.push(_v.set(0, this.gEff * 1.08 * dt * 60 / 60, 0), 1 / 60);
    }
    if (this.burning > 0) {
      this.burning -= dt;
      this.health -= dt * 6;
      if (Math.random() < dt * 20) g.fx.fire(this.center(_v.clone()), this.height);
      if (g.cage.isWater(this.pos.x, this.pos.z) || g.cage.weather.rain) this.burning = 0;
      if (this.health <= 0) this.die(CAUSE.burn, {});
    }
    // bleeding (stumps drip)
    if (this.bleed > 0) {
      // bleed = health lost per second; a bandage slows it way down
      this.health -= this.bleed * dt * (this.bandaged > 0 ? 0.08 : 1);
      this.bleed = Math.max(0, this.bleed - dt * (this.bleed < 1 ? 0.02 : 0.004) * (this.bandaged > 0 ? 20 : 1));
      if (settings.gore !== 'none' && Math.random() < dt * Math.min(12, this.bleed * 3) * (this.bandaged > 0 ? 0.1 : 1)) {
        const st = this.stumpBleed && this.stumpBleed.length ? rand.pick(this.stumpBleed) : null;
        g.fx.drip(st ? this.body.P(st.i, _v.clone()) : this.center(_v.clone()), this.height, null);
      }
      if (this.health <= 0) this.die(CAUSE.bleed, {});
    }
    if (this.bandaged > 0) this.bandaged -= dt;
  }

  // once per ~0.5 s of game time: needs, sickness, temperature
  slowTick(dt) {
    const g = this.game;
    const day = 960; // seconds per game day at 1x
    const n = this.needs;
    const sleepMul = this.asleep ? 0.4 : 1;
    for (const k of Object.keys(LASTS)) {
      if (k === 'warmth') continue;
      let rate = 100 / (LASTS[k] * day);
      if (k === 'energy' && this.asleep) rate = -100 / (0.25 * day);
      if (k === 'hunger' && this.has('greedy')) rate *= 1.15;
      if (k === 'social' && this.has('loner')) rate *= 0.4;
      if (k === 'thirst' && g.cage.weather.heat && this.inCage) rate *= 2;
      if (this.robot) rate = 0;
      n[k] = clamp(n[k] - rate * dt * (k === 'energy' ? 1 : sleepMul), 0, 100);
    }
    // warmth: cold at night, snow, rain; fire/shelter warms
    const cold = this.inCage ? (g.cage.snowCover * 0.8 + (g.cage.weather.snow ? 0.5 : 0) + (g.cage.weather.rain && !this.sheltered ? 0.3 : 0) + (g.world.daylight < 0.05 ? 0.25 : 0) - (g.cage.weather.heat ? 1 : 0)) : 0;
    const nearFire = g.society.nearFire(this.pos, this.height * 4);
    const target = clamp(80 - cold * 70 + (nearFire ? 40 : 0) + (this.sheltered ? 20 : 0), 0, 100);
    n.warmth = lerp(n.warmth, target, clamp(dt / 40, 0, 1));
    // starving / thirst / freezing hurt
    if (n.hunger <= 0) { this.health -= dt * 0.12; if (this.health <= 0) return this.die(CAUSE.starve); }
    if (n.thirst <= 0) { this.health -= dt * 0.2; if (this.health <= 0) return this.die(CAUSE.thirst); }
    if (n.warmth < 8) { this.health -= dt * 0.15; if (this.health <= 0) return this.die(CAUSE.freeze); }
    // natural healing when fed and not bleeding
    if (this.bleed < 0.05 && n.hunger > 30 && n.thirst > 30 && this.health < 100) this.health = Math.min(100, this.health + dt * (this.asleep ? 0.12 : 0.04));
    // sickness
    if (this.sick) {
      const s = this.sick;
      s.t -= dt;
      this.health -= dt * s.sev * 0.08;
      if (Math.random() < dt * 0.05) { sfx('cough', { vol: g.audibleVol(this.pos, 0.5), pitch: 1.6 }); }
      // spreads to people close by
      if (s.kind === 'flu') for (const o of g.people) if (o !== this && o.alive && !o.sick && !o.kid && o.dist(this.pos) < this.height * 2 && Math.random() < dt * 0.01 * (1.5 - o.needs.hygiene / 100)) o.getSick('flu', 0.4);
      if (s.t <= 0) { this.sick = null; this.remember('sick', 'I got better', 10); }
      if (this.health <= 0) return this.die(CAUSE.sick);
    } else if (this.wounds.length && this.bandaged <= 0 && n.hygiene < 25 && Math.random() < dt * 0.002) this.getSick('infection', 0.6);
    if (this.grief > 0) this.grief = Math.max(0, this.grief - dt / 800);
    // fear fades, faith grows when fed
    this.fear = Math.max(this.has('coward') ? 25 : 5, this.fear - dt * 0.03);
    // kids grow up (setting)
    if (this.kid) {
      this.growDays += (dt / day) * settings.kidGrow;
      if (this.age === 'baby' && this.growDays > 1.2) this.growUp('kid');
      else if (this.age === 'kid' && this.growDays > 3.5) this.growUp('adult');
    }
  }

  getSick(kind, sev) {
    if (this.kid && kind !== 'flu') return;
    if (this.robot) return;
    this.sick = { kind, sev: Math.min(1, sev), t: 400 + sev * 900 };
    this.remember('sick', kind === 'poison' ? 'I ate something bad' : 'I feel sick', -15);
  }

  growUp(age) {
    const g = this.game;
    const old = this.look;
    const nl = makeLook({ sex: this.sex, age: age === 'adult' ? undefined : age, hair: old.hair, hairColor: old.hairColor, skin: old.skin });
    this.age = age;
    this.kid = age !== 'adult';
    if (!this.kid) { this.job = rand.pick(JOB_KEYS.filter((j) => j !== 'homeless')); this.traits = this.traits.length ? this.traits : randomTraits(); }
    this.look = nl;
    const pos = this.pos.clone();
    this.body.dispose();
    this.body = new Body(this.look, g.sink, { pos, yaw: this.yaw, scale: this.scale });
    this.body.groundFn = (x, z, y) => g.groundAt(x, z, y, this);
    this.voice = voiceFor(this.look);
    g.feed(age === 'adult' ? `${this.name} grew up` : `${this.name} is walking now`, 'warm', this);
  }

  // fall damage when a ragdoll hits the ground hard
  checkImpact(dt) {
    const imp = this.body.lastImpact;
    this.body.lastImpact = 0;
    if (!imp) return;
    const v = imp / Math.max(dt / 6, 1e-4);
    const rel = v / Math.sqrt(this.gEff * this.height);
    if (this.bouncy > 0 || this.loc === 'table') return;
    if (rel > 6.5) { this.hurt({ dmg: 60 + (rel - 6.5) * 25, type: 'fall', point: this.center(_v.clone()), cause: CAUSE.fall }); if (this.alive && rel > 7.5) this.breakLeg(); }
    else if (rel > 4.5) { this.hurt({ dmg: 20 + (rel - 4.5) * 10, type: 'fall', cause: CAUSE.fall }); if (this.alive && rand() < 0.6) this.breakLeg(); }
    else if (rel > 2.8) { this.hurt({ dmg: (rel - 2.8) * 6, type: 'fall', cause: CAUSE.fall }); }
  }

  breakLeg() {
    if (this.brokenLeg != null) return;
    this.brokenLeg = rand() < 0.5 ? 0 : 1;
    this.remember('hurt', 'I broke my leg', -30);
    this.say(rand.pick(['My leg! It\'s broken!', 'I think my leg is broken...', 'AAH my leg!']), { kind: 'scared' });
    this.game.feed(`${this.name} broke a leg`, 'bad', this);
  }

  // ------------------------------------------------------------- moving
  moveTo(target, run = false, range = 0) {
    const g = this.game;
    this.goal = target.clone ? target.clone() : new THREE.Vector3(target.x, target.y || 0, target.z);
    this.goalRange = range;
    this.run = run;
    this.path = null;
    if (this.inCage && g.cage.inside(this.goal.x, this.goal.z) && Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) > 0.03) {
      const pth = g.nav.find(this.pos.x, this.pos.z, this.goal.x, this.goal.z);
      if (pth) this.path = pth.map(([x, z]) => new THREE.Vector3(x, 0, z));
    }
  }

  stop() { this.goal = null; this.path = null; }

  arrived(range) {
    if (!this.goal) return true;
    return Math.hypot(this.goal.x - this.pos.x, this.goal.z - this.pos.z) <= Math.max(range ?? this.goalRange ?? 0, this.height * 0.3);
  }

  baseSpeed() {
    let s = 1.35 * Math.pow(this.sc, 0.75);
    if (this.run) s *= 2.3;
    if (this.kid) s *= 0.8;
    if (this.legsLeft === 1) s *= 0.3;
    if (this.legsLeft === 0) s *= 0.12;
    if (this.brokenLeg != null) s *= 0.4;
    if (this.sick) s *= 0.7;
    if (this.needs.energy < 15) s *= 0.75;
    if (this.needs.warmth < 25) s *= 0.8;
    if (this.health < 30) s *= 0.7;
    if (this.loc === 'cage' && this.game.cage.isWater(this.pos.x, this.pos.z) && this.game.cage.waterDepth(this.pos.x, this.pos.z) > this.height * 0.35 && !this.game.cage.frozen) s *= 0.45;
    return s * this.speedMul;
  }

  locomote(dt) {
    const g = this.game;
    const H = this.height;
    let wantX = 0, wantZ = 0;
    if (this.goal) {
      let tgt = this.goal;
      if (this.path && this.path.length) {
        tgt = this.path[0];
        if (Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z) < Math.max(H * 0.4, 0.006)) { this.path.shift(); tgt = this.path[0] || this.goal; }
      }
      const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (this.arrived()) { this.goal = null; this.path = null; }
      else if (d > 1e-6) { wantX = dx / d; wantZ = dz / d; }
    }
    const sp = (this.stun > 0 ? 0.3 : 1) * this.baseSpeed();
    const accel = 1 - Math.exp(-dt * 10);
    this.vel.x = lerp(this.vel.x, wantX * sp, accel);
    this.vel.z = lerp(this.vel.z, wantZ * sp, accel);
    const step = this.vel.length() * dt;
    if (step > 0) {
      // substeps keep it from tunnelling through glass at high time speed
      const n = Math.min(8, Math.ceil(step / (H * 0.2)));
      for (let i = 0; i < n; i++) {
        this.pos.x += this.vel.x * dt / n; this.pos.z += this.vel.z * dt / n;
        this.collide();
      }
      if (wantX || wantZ) this.yaw += angleDiff(this.yaw, Math.atan2(this.vel.x, this.vel.z)) * Math.min(1, dt * 10);
    }
    // ground / falling
    const gy = g.groundAt(this.pos.x, this.pos.z, this.pos.y + H * 0.4, this);
    if (this.pos.y > gy + H * 0.02) {
      this.vy -= this.gEff * dt;
      this.pos.y += this.vy * dt;
      this.anim.air = true;
      if (this.pos.y <= gy) { this.landed(gy); }
      else if (this.vy < -Math.sqrt(2 * this.gEff * H * 1.2)) {
        // falling far: go floppy (and get hurt on landing)
        this.body.ragdoll(1.5);
        this.body.push(_v.set(this.vel.x, this.vy, this.vel.z));
        this.say(rand.pick(['WAAAAH!', 'AAAAAAH!', 'NOOOO!']), { kind: 'scared', scream: true });
      }
    } else {
      if (this.anim.air) this.landed(gy);
      this.pos.y = gy; this.vy = 0;
    }
    this.anim.speed = Math.hypot(this.vel.x, this.vel.z) / Math.max(1e-6, 1.35 * Math.pow(this.sc, 0.75));
    this.anim.phase += (Math.hypot(this.vel.x, this.vel.z) * dt) / (0.75 * H) * Math.PI;
  }

  landed(gy) {
    const H = this.height;
    const rel = -this.vy / Math.sqrt(this.gEff * H);
    this.pos.y = gy; this.anim.air = false;
    if (rel > 2.8) this.checkImpactDirect(rel);
    this.vy = 0;
  }

  checkImpactDirect(rel) {
    this.body.lastImpact = 0;
    if (rel > 6.5) this.hurt({ dmg: 60 + (rel - 6.5) * 25, type: 'fall', cause: CAUSE.fall });
    else if (rel > 4.5) { this.hurt({ dmg: 20 + (rel - 4.5) * 10, type: 'fall', cause: CAUSE.fall }); if (this.alive && rand() < 0.5) this.breakLeg(); }
    else this.hurt({ dmg: (rel - 2.8) * 6, type: 'fall', cause: CAUSE.fall });
  }

  collide() {
    const g = this.game;
    const r = this.height * 0.14;
    if (g.cage.inside(this.pos.x, this.pos.z, -0.01) && this.pos.y < g.cageTopY) {
      g.cage.pushOut(this.pos, r, this.height);
    } else {
      g.world.colliders.resolve(this.pos, r, this.height * 0.95, this.height * 0.25);
    }
    // people don't walk through each other
    for (const o of g.peopleNear(this.pos, this.height * 0.6)) {
      if (o === this || !o.alive || o.body.mode === 'rag' || o.busyBody) continue;
      const min = (this.height + o.height) * 0.12;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 1e-9 && Math.abs(this.pos.y - o.pos.y) < this.height * 0.5) { const push = (min - d) * 0.5; this.pos.x += (dx / d) * push; this.pos.z += (dz / d) * push; }
    }
  }

  // ------------------------------------------------------------- animation
  animate(dt, rateMul = 1) {
    const a = this.anim;
    a.at += dt;
    const st = this._st || (this._st = { pos: new THREE.Vector3() });
    st.pos.copy(this.pos);
    if (this.game.cage.inside(this.pos.x, this.pos.z) && this.game.cage.isWater(this.pos.x, this.pos.z) && !this.game.cage.frozen) {
      const depth = this.game.cage.waterDepth(this.pos.x, this.pos.z);
      st.pos.y += Math.max(0, depth - this.height * 0.75);
    }
    st.yaw = this.yaw;
    st.phase = a.phase;
    st.speed = Math.min(2.2, a.speed);
    st.action = a.action;
    st.at = a.at;
    st.crouch = a.crouch;
    st.lying = a.lying || this.asleep;
    st.air = a.air;
    st.limp = this.brokenLeg ?? (this.legsLeft === 1 ? (this.body.limbOK('l', 'leg') ? 1 : 0) : -1);
    poseTargets(this.body, st);
    // face
    const f = this.body.face;
    const m = this.mood();
    const e = this.emotion ? this.emotion.kind : null;
    f.angry = damp(f.angry, e === 'rage' || e === 'hate' || (this.task && this.task.type === 'fight') ? 1 : m < -40 ? 0.5 : 0, 5, dt);
    f.sad = damp(f.sad, e === 'sad' || this.grief > 0.3 || (m < -20 && !f.angry) ? 1 : 0, 4, dt);
    f.scared = damp(f.scared, e === 'fear' || this.fear > 70 || this.held ? 1 : 0, 5, dt);
    f.smile = damp(f.smile, e === 'joy' || e === 'love' ? 1 : clamp(m / 60, -0.8, 0.9), 4, dt);
    f.closed = this.asleep || this.ko > 0 ? 1 : 0;
    const talking = this.game.time - this.lastSpeak < 1.4;
    f.open = talking ? Math.abs(Math.sin(this.game.time * 18)) * 0.6 : this.held ? 0.7 : f.scared > 0.8 ? 0.4 : 0;
    // look at the player when they're near / held
    const pl = this.game.player;
    if (pl && (this.held || this.dist(pl.pos) < this.height * 12)) {
      const head = this.headPos(_v);
      const to = _v2.copy(pl.eye).sub(head);
      const yawTo = Math.atan2(to.x, to.z);
      this.body.lookYaw = clamp(angleDiff(this.yaw, yawTo), -1.1, 1.1);
      this.body.lookPitch = clamp(Math.atan2(to.y, Math.hypot(to.x, to.z)) * 0.5, -0.5, 0.6);
      f.lookY = clamp(to.y / (to.length() + 1e-6) * 2, -1, 1);
    } else { this.body.lookYaw = damp(this.body.lookYaw || 0, 0, 3, dt); this.body.lookPitch = 0; f.lookY = 0; }
    this.simBody(dt, rateMul);
  }

  simBody(dt, rateMul = 1) {
    const b = this.body;
    b.ground = this.pos.y;
    const step = Math.min(dt, 1 / 30);
    const n = Math.min(4, Math.max(1, Math.ceil(dt / step)));
    const rate = (this.getup > 0 ? 8 : 24) * rateMul * Math.pow(Math.max(this.sc, 1e-3), -0.2);
    for (let i = 0; i < n; i++) b.simulate(dt / n, this.gEff, rate);
  }

  // ------------------------------------------------------------- save
  save() {
    const o = {
      id: this.id, name: this.name, last: this.last, sex: this.sex, age: this.age, ageYears: this.ageYears, growDays: this.growDays, job: this.job,
      look: this.look, traits: this.traits, voice: this.voice, scale: this.scale, pos: this.pos.toArray(), yaw: this.yaw,
      state: this.state, cause: this.cause, health: this.health, bleed: this.bleed, needs: this.needs, op: this.op, fear: this.fear, faith: this.faith, loveYou: this.loveYou,
      rel: [...this.rel.entries()], partner: this.partner, married: this.married, parents: this.parents, kids: this.kids, tribe: this.tribe,
      inv: this.inv, mem: this.mem.slice(-20), sick: this.sick, cut: [...this.body.cut], brokenLeg: this.brokenLeg, money: this.money,
      loc: this.loc === 'held' ? 'cage' : this.loc, jar: this.jarId, home: this.home, kills: this.kills, title: this.title, buried: this.buried, playerName: this.remembersPlayerAs,
      holding: this.holding ? this.holding.type : null, objectForm: this.objectForm ? { type: this.objectForm.type, t: this.objectForm.t } : null, robot: this.robot, bornDay: this.bornDay, deathDay: this.deathDay,
    };
    return o;
  }

  static load(game, d) {
    const p = new Person(game, { id: d.id, name: d.name, sex: d.sex, age: d.age, job: d.job, look: d.look, traits: d.traits, voice: d.voice, scale: d.scale, pos: new THREE.Vector3(...d.pos), yaw: d.yaw, ageYears: d.ageYears, last: d.last, loc: d.loc, bornDay: d.bornDay });
    Object.assign(p, { health: d.health, bleed: d.bleed, needs: d.needs, op: d.op, fear: d.fear, faith: d.faith, loveYou: d.loveYou, partner: d.partner, married: d.married, parents: d.parents || [], kids: d.kids || [], tribe: d.tribe, inv: { ...p.inv, ...d.inv }, mem: d.mem || [], sick: d.sick, brokenLeg: d.brokenLeg ?? undefined, money: d.money || 0, home: d.home, kills: d.kills || 0, title: d.title || '', buried: d.buried, remembersPlayerAs: d.playerName, growDays: d.growDays || 0, objectForm: d.objectForm || null, robot: d.robot, deathDay: d.deathDay });
    p.rel = new Map(d.rel || []);
    for (const j of d.cut || []) { p.body.sever(j); p.limbsLost++; }
    if (d.state === 'dead') {
      p.state = 'dead'; p.cause = d.cause; p.body.dead = true; p.body.ragdoll(9999); p.body.face.closed = 1;
      for (let i = 0; i < 90; i++) p.body.simulate(1 / 60, p.gEff, 24);
      p.body.asleep = true;
    }
    return p;
  }
}

export function makeTinyPerson(game, opts) {
  return new Person(game, { scale: TINY, ...opts });
}
