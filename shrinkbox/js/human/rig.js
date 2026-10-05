// Procedural animation for the realistic humans: walk + run cycles (hips, knees, ankles, toes,
// pelvis bob/sway/twist, counter-rotating spine, swinging arms), idle life (breathing, weight
// shifts, sway), sitting, crouching, cowering, waving, being carried, falling, plus the face:
// blinks, eye darts (saccades), looking at things (head + eyes, lids follow), talking and moods.
import * as THREE from 'three';
import { E, NEXPR } from './expr.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4();
const smooth = (a, b, k) => a + (b - a) * k;

const MOODS = {
  neutral: {},
  smile: { 'mouth-corner-puller': 0.65, 'eye-left-slit': 0.22, 'eye-right-slit': 0.22, 'mouth-open': 0.05 },
  fear: { 'eye-left-opened-up': 0.75, 'eye-right-opened-up': 0.75, 'eyebrows-left-inner-up': 0.85, 'eyebrows-right-inner-up': 0.85, 'eyebrows-left-up': 0.35, 'eyebrows-right-up': 0.35, 'mouth-retraction': 0.45, 'mouth-open': 0.18 },
  angry: { 'eyebrows-left-down': 0.85, 'eyebrows-right-down': 0.85, 'nose-compression': 0.35, 'mouth-compression': 0.55, 'eye-left-slit': 0.25, 'eye-right-slit': 0.25 },
  sad: { 'eyebrows-left-inner-up': 0.65, 'eyebrows-right-inner-up': 0.65, 'mouth-depression': 0.6 },
  surprise: { 'eye-left-opened-up': 1, 'eye-right-opened-up': 1, 'eyebrows-left-up': 1, 'eyebrows-right-up': 1, 'mouth-open': 0.45 },
  sleep: { 'eye-left-closure': 1, 'eye-right-closure': 1 },
};

export class HumanRig {
  constructor(sk, model) {
    this.sk = sk; this.model = model;
    const B = (n) => sk.byName[n];
    this.b = B;
    this.list = sk.skeleton.bones;
    this.rootRest = B('root').position.clone();
    // A-pose: how far the upper arms already hang below horizontal
    const ua = B('upperarm01.L').userData; const d = ua.tail.clone().sub(ua.head).normalize();
    this.armDown = Math.atan2(-d.y, Math.abs(d.x)); // rad below horizontal
    // leg lengths (for keeping feet on the floor)
    this.legLen = B('upperleg01.L').userData.head.distanceTo(B('foot.L').userData.head);
    this.ankleRest = B('foot.L').userData.head.y;
    // finger hinge directions: a positive curl must move each fingertip toward the palm
    this.fingerSign = {};
    const dorsal = model.dorsal;
    for (const b of this.list) {
      const n = b.name; if (!/^(finger|metacarpal)/.test(n)) continue;
      const u = b.userData; const side = n.endsWith('.L') ? 'L' : 'R';
      _q.setFromAxisAngle(u.x, 0.2); const dir = u.tail.clone().sub(u.head); const moved = dir.clone().applyQuaternion(_q).sub(dir);
      this.fingerSign[n] = moved.dot(dorsal[side]) > 0 ? -1 : 1;
    }
    // pose state
    this.pose = new Map(); // bone -> [x, y, z]
    this.phase = 0; this.t = 0; this.blend = {}; this.rootOff = new THREE.Vector3();
    this.face = new Float32Array(NEXPR);
    this.eyeYaw = 0; this.eyePitch = 0; this.sacT = 0; this.sacYaw = 0; this.sacPitch = 0;
    this.blinkT = 2 + Math.random() * 3; this.blinkPh = -1;
    this.headYaw = 0; this.headPitch = 0;
    this.shift = 0; this.shiftT = 0; this.shiftTarget = 0;
    this.breath = Math.random() * 6;
    this.w = { walk: 0, run: 0, sit: 0, cower: 0, wave: 0, held: 0, air: 0, crouch: 0, lie: 0 };
    this.talkPh = 0; this.moodW = {};
  }

  add(name, x, y = 0, z = 0) {
    let p = this.pose.get(name); if (!p) { p = [0, 0, 0]; this.pose.set(name, p); }
    p[0] += x; p[1] += y; p[2] += z;
  }
  // both sides; mirror flips y/z
  both(name, x, y = 0, z = 0) { this.add(name + '.L', x, y, z); this.add(name + '.R', x, -y, -z); }
  curl(side, amt, thumb = amt * 0.6) {
    for (let f = 1; f <= 5; f++) for (let k = 1; k <= 3; k++) {
      const n = `finger${f}-${k}.${side}`, b = this.b(n); if (!b) continue;
      const a = (f === 1 ? thumb : amt) * (k === 1 ? 0.8 : 1) * this.fingerSign[n];
      const ax = b.userData.x; const p = this.pose.get(n) || [0, 0, 0];
      // store as axis-angle on the finger's own hinge, kept separately
      (this.fingers ||= new Map()).set(n, ((this.fingers.get(n)) || 0) + a); void p; void ax;
    }
  }

  /**
   * o = { state: 'idle'|'walk'|'run'|'sit'|'cower'|'wave'|'held'|'flee'|'sleep'|'lie',
   *       speed (1 = walk, 1.6+ = run), grounded, crouch 0..1, talking, mood, lookAt (world Vector3), brightness 0..1 }
   */
  update(dt, o) {
    const st = o.state || 'idle';
    this.t += dt;
    const W = this.w, k = Math.min(1, dt * 6);
    const spd = o.speed || 0;
    const moving = (st === 'walk' || st === 'flee' || st === 'run') && spd > 0.05;
    W.run = smooth(W.run, moving && spd > 1.35 ? 1 : 0, k);
    W.walk = smooth(W.walk, moving ? 1 - W.run : 0, k);
    W.sit = smooth(W.sit, st === 'sit' ? 1 : 0, k * 0.7);
    W.cower = smooth(W.cower, st === 'cower' ? 1 : 0, k);
    W.wave = smooth(W.wave, st === 'wave' ? 1 : 0, k);
    W.held = smooth(W.held, st === 'held' ? 1 : 0, k);
    W.air = smooth(W.air, o.grounded === false ? 1 : 0, k);
    W.crouch = smooth(W.crouch, o.crouch || 0, k);
    W.lie = smooth(W.lie, st === 'sleep' || st === 'lie' ? 1 : 0, k);
    // cycle: ~1.9 steps/s walking (stride ~0.75 m), ~2.8 running
    const cadence = W.run > 0.5 ? 2.9 : 1.8 * THREE.MathUtils.clamp(spd, 0.6, 1.4);
    if (moving) this.phase += dt * Math.PI * cadence;
    const ph = this.phase;
    this.pose.clear(); this.fingers?.clear(); this.rootOff.set(0, 0, 0);
    const T = this.t;
    // ---------- base: relaxed standing (arms down from the A-pose) ----------
    const lower = this.armDown - 1.42; // hang ~78 deg below horizontal (a little away from the hips)
    this.add('upperarm01.L', 0.05, 0, lower); this.add('upperarm01.R', 0.05, 0, -lower);
    this.both('lowerarm01', -0.18);
    this.add('wrist.L', 0, 0, 0.05); this.add('wrist.R', 0, 0, -0.05);
    this.curl('L', 0.28); this.curl('R', 0.28);
    // breathing (12-20 a minute; faster when scared or after running)
    const br = o.mood === 'fear' ? 0.45 : 0.27 + W.run * 0.25;
    this.breath += dt * br * Math.PI * 2;
    const bth = Math.sin(this.breath);
    this.add('spine02', -0.012 * bth); this.add('spine01', -0.008 * bth); this.both('clavicle', 0, 0, 0); this.add('clavicle.L', 0, 0, 0.012 * bth); this.add('clavicle.R', 0, 0, -0.012 * bth);
    this.add('neck01', 0.01 * bth);
    // idle weight shifts every few seconds + tiny sway
    this.shiftT -= dt;
    if (this.shiftT <= 0) { this.shiftT = 4 + Math.random() * 6; this.shiftTarget = Math.random() < 0.5 ? -1 : 1; }
    this.shift = smooth(this.shift, this.shiftTarget, Math.min(1, dt * 0.8));
    const idleW = (1 - W.walk - W.run) * (1 - W.sit) * (1 - W.held) * (1 - W.lie);
    const sh = this.shift * idleW;
    this.rootOff.x += sh * 0.018;
    this.add('root', 0, 0, sh * 0.03);
    this.add(sh > 0 ? 'lowerleg01.R' : 'lowerleg01.L', Math.abs(sh) * 0.12);
    this.add(sh > 0 ? 'upperleg01.R' : 'upperleg01.L', -Math.abs(sh) * 0.06);
    this.add('spine03', 0.0, 0, -sh * 0.025);
    this.add('spine05', 0.006 * Math.sin(T * 0.7) * idleW, 0, 0.004 * Math.sin(T * 0.53) * idleW);
    // ---------- walk / run ----------
    const wW = W.walk, rW = W.run;
    if (wW + rW > 0.01) {
      for (const [side, off] of [['L', 0], ['R', Math.PI]]) {
        const p = ph + off;
        const thigh = wW * (0.3 * Math.sin(p) + 0.04) + rW * (0.62 * Math.sin(p) + 0.18);
        const knee = wW * (0.08 + 0.62 * Math.max(0, Math.sin(p + 1.35)) ** 1.5) + rW * (0.25 + 1.45 * Math.max(0, Math.sin(p + 1.25)) ** 1.2);
        const ankle = wW * (0.16 * Math.sin(p - 0.9)) + rW * (0.3 * Math.sin(p - 0.8));
        this.add(`upperleg01.${side}`, -thigh);
        this.add(`lowerleg01.${side}`, knee);
        this.add(`foot.${side}`, ankle - knee * 0.1);
        for (let t = 1; t <= 5; t++) this.add(`toe${t}-1.${side}`, -Math.max(0, -Math.sin(p - 0.4)) * (0.35 * wW + 0.5 * rW));
        // arms swing opposite to the legs
        const sw = wW * 0.24 * Math.sin(p + Math.PI) + rW * 0.55 * Math.sin(p + Math.PI);
        this.add(`upperarm01.${side}`, -sw, 0, 0);
        this.add(`lowerarm01.${side}`, -(wW * (0.12 + Math.max(0, -sw) * 0.5) + rW * 1.25));
      }
      this.rootOff.y += -(wW * 0.018 + rW * 0.045) * (0.5 - 0.5 * Math.cos(2 * ph));
      this.rootOff.x += (wW * 0.012 + rW * 0.01) * Math.sin(ph);
      this.add('root', rW * 0.06, (wW * 0.07 + rW * 0.1) * Math.sin(ph), (wW * 0.035) * Math.sin(ph));
      this.add('spine04', 0, -(wW * 0.05 + rW * 0.08) * Math.sin(ph), 0);
      this.add('spine02', rW * 0.12 + wW * 0.02, -(wW * 0.04 + rW * 0.06) * Math.sin(ph), 0);
      this.add('neck01', -rW * 0.1, 0, 0);
      this.curl('L', rW * 0.6); this.curl('R', rW * 0.6);
    }
    // ---------- crouch / sit / cower / air ----------
    const cr = W.crouch + W.cower * 1.0;
    if (cr > 0.01) { this.both('upperleg01', -1.05 * cr); this.both('lowerleg01', 1.9 * cr); this.both('foot', -0.75 * cr); this.add('spine03', 0.35 * cr); }
    if (W.cower > 0.01) {
      const c = W.cower;
      this.add('upperarm01.L', -1.7 * c, -0.5 * c, -0.35 * c); this.add('upperarm01.R', -1.7 * c, 0.5 * c, 0.35 * c);
      this.both('lowerarm01', -2.0 * c); this.add('neck01', 0.4 * c); this.add('head', 0.25 * c);
      this.add('spine02', 0.25 * c);
    }
    if (W.sit > 0.01) {
      const s = W.sit;
      this.both('upperleg01', -1.5 * s); this.both('lowerleg01', 1.5 * s); this.both('foot', 0.05 * s);
      this.both('upperarm01', -0.45 * s); this.both('lowerarm01', -0.65 * s);
      this.add('spine04', -0.08 * s);
    }
    if (W.air > 0.01 && W.held < 0.5) {
      const a = W.air;
      this.both('lowerleg01', 0.45 * a); this.both('upperleg01', -0.25 * a);
      this.add('upperarm01.L', 0, 0, 0.5 * a); this.add('upperarm01.R', 0, 0, -0.5 * a);
    }
    // ---------- wave (right arm up, hand waving) ----------
    if (W.wave > 0.01) {
      const v = W.wave;
      this.add('upperarm01.R', -0.25 * v, 0, -(lower + 2.35) * v * 0.62);
      this.add('lowerarm01.R', -1.35 * v);
      this.add('wrist.R', 0, 0, Math.sin(T * 9) * 0.35 * v);
      this.add('lowerarm02.R', 0, Math.sin(T * 9) * 0.25 * v, 0);
      this.curl('R', -0.2 * v);
    }
    // ---------- carried in someone's hand: dangling legs kick, arms flail ----------
    if (W.held > 0.01) {
      const h = W.held;
      this.add('upperleg01.L', -(0.35 + Math.sin(T * 7) * 0.4) * h); this.add('upperleg01.R', -(0.35 - Math.sin(T * 7) * 0.4) * h);
      this.both('lowerleg01', 0.7 * h);
      this.add('upperarm01.L', -0.4 * h, 0, (1.2 + Math.sin(T * 5) * 0.3) * h); this.add('upperarm01.R', -0.4 * h, 0, -(1.2 + Math.sin(T * 5 + 1) * 0.3) * h);
      this.both('lowerarm01', -0.6 * h);
    }
    // ---------- look at something: head + neck take part, eyes the rest ----------
    let yaw = 0, pitch = 0;
    if (o.lookAt) {
      const head = this.b('head');
      head.updateWorldMatrix(true, false);
      _v.copy(o.lookAt); this.model.root.worldToLocal(_v);
      _v2.copy(head.userData.head).add(this.rootOff);
      _v.sub(_v2);
      yaw = Math.atan2(_v.x, _v.z); pitch = Math.atan2(-_v.y, Math.hypot(_v.x, _v.z));
      if (Math.abs(yaw) > 1.9) { yaw = 0; pitch = 0; } // behind me: don't snap round
    }
    this.headYaw = smooth(this.headYaw, THREE.MathUtils.clamp(yaw * 0.7, -1.0, 1.0), Math.min(1, dt * 4));
    this.headPitch = smooth(this.headPitch, THREE.MathUtils.clamp(pitch * 0.6, -0.5, 0.6), Math.min(1, dt * 4));
    const hy = this.headYaw * (1 - W.lie), hp = this.headPitch * (1 - W.lie);
    this.add('neck01', hp * 0.3, hy * 0.25); this.add('neck02', hp * 0.25, hy * 0.25); this.add('neck03', hp * 0.15, hy * 0.2); this.add('head', hp * 0.3, hy * 0.3);
    // eyes: whatever the head didn't cover + small saccades
    this.sacT -= dt;
    if (this.sacT <= 0) { this.sacT = 0.25 + Math.random() * (o.lookAt ? 1.6 : 0.9); this.sacYaw = (Math.random() - 0.5) * (o.lookAt ? 0.06 : 0.3); this.sacPitch = (Math.random() - 0.5) * (o.lookAt ? 0.04 : 0.16); }
    const ey = THREE.MathUtils.clamp(yaw - hy + this.sacYaw, -0.45, 0.45), ep = THREE.MathUtils.clamp(pitch - hp + this.sacPitch, -0.35, 0.4);
    this.eyeYaw = smooth(this.eyeYaw, ey, Math.min(1, dt * 30)); this.eyePitch = smooth(this.eyePitch, ep, Math.min(1, dt * 30));
    // ---------- apply bones ----------
    for (const b of this.list) b.quaternion.identity();
    for (const [n, a] of this.pose) { const b = this.b(n); if (b) b.quaternion.setFromEuler(_e.set(a[0], a[1], a[2], 'XYZ')); }
    if (this.fingers) for (const [n, a] of this.fingers) { const b = this.b(n); _q.setFromAxisAngle(b.userData.x, a); b.quaternion.premultiply(_q); }
    const root = this.b('root');
    root.position.copy(this.rootRest).add(this.rootOff);
    // keep the lower foot on the floor (unless sitting, carried or in the air)
    const ground = (1 - W.sit) * (1 - W.held) * (1 - W.air) * (1 - W.lie);
    if (ground > 0.01) {
      root.updateMatrixWorld(true);
      const parentInv = _m.copy(this.model.skelParent.matrixWorld).invert();
      let minY = Infinity;
      for (const s of ['L', 'R']) { _v.setFromMatrixPosition(this.b('foot.' + s).matrixWorld).applyMatrix4(parentInv); minY = Math.min(minY, _v.y); }
      root.position.y += (this.ankleRest - minY) * ground;
    }
    if (W.sit > 0.01) root.position.y -= this.legLen * 0.47 * W.sit;
    // ---------- face ----------
    const F = this.face; F.fill(0);
    const mood = MOODS[st === 'sleep' ? 'sleep' : (o.mood || 'neutral')] || {};
    for (const [n, w] of Object.entries(mood)) F[E[n]] += w;
    // blinks every 2-6 s (fast close, slower open); fewer when focused
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkPh < 0) { this.blinkPh = 0; this.blinkT = 2 + Math.random() * 4.5; }
    let blink = 0;
    if (this.blinkPh >= 0) { this.blinkPh += dt; const p = this.blinkPh; blink = p < 0.075 ? p / 0.075 : p < 0.12 ? 1 : 1 - (p - 0.12) / 0.16; if (p > 0.28) { this.blinkPh = -1; blink = 0; } }
    // lids follow the eyes: up = lids lift, down = lids drop
    const lidUp = Math.max(0, -this.eyePitch) * 1.4, lidDown = Math.max(0, this.eyePitch) * 0.9;
    for (const [c, o2] of [[E['eye-left-closure'], E['eye-left-opened-up']], [E['eye-right-closure'], E['eye-right-opened-up']]]) {
      F[c] = Math.min(1, F[c] + blink + lidDown + 0.05); F[o2] = Math.min(1, F[o2] + lidUp);
    }
    // talking: syllables ~6 a second
    if (o.talking) {
      this.talkPh += dt * (11 + Math.sin(T * 1.3) * 3);
      const s = Math.max(0, Math.sin(this.talkPh)) * (0.55 + 0.45 * Math.sin(this.talkPh * 0.37));
      F[E['mouth-open']] += 0.12 + s * 0.42;
      F[E['mouth-pursing']] += Math.max(0, Math.sin(this.talkPh * 0.53)) * 0.35;
      F[E['mouth-retraction']] += Math.max(0, Math.sin(this.talkPh * 0.71 + 1)) * 0.3;
    }
    // smooth the face a little so it never pops
    const prev = this.faceOut || (this.faceOut = new Float32Array(NEXPR));
    for (let i = 0; i < NEXPR; i++) prev[i] = (i <= 1) ? F[i] : smooth(prev[i], F[i], Math.min(1, dt * 12));
    return prev;
  }
}
