
// ---------- fighters (you and every knight share this) ----------
let soldierGLTF = null;
const fighters = [];

// hit zones: from bone, to bone, radius, armor key, base hp, severs at bone, damage multiplier
const PARTS = {
  head:   { a: 'Head', b: 'HeadTop_End', r: 0.12, key: 'head', hp: 40, sever: 'Head', mult: 1.3 },
  neck:   { a: 'Neck', b: 'Head', r: 0.075, key: 'neck', hp: 32, sever: 'Head', mult: 1.5 },
  chest:  { a: 'Spine1', b: 'Neck', r: 0.19, key: 'chest', hp: 95, mult: 1 },
  belly:  { a: 'Hips', b: 'Spine1', r: 0.18, key: 'belly', hp: 85, mult: 1 },
  luarm:  { a: 'LeftArm', b: 'LeftForeArm', r: 0.065, key: 'uarm', hp: 52, sever: 'LeftArm', mult: 0.85, side: 'L' },
  lfarm:  { a: 'LeftForeArm', b: 'LeftHand', r: 0.058, key: 'farm', hp: 42, sever: 'LeftForeArm', mult: 0.85, side: 'L' },
  ruarm:  { a: 'RightArm', b: 'RightForeArm', r: 0.065, key: 'uarm', hp: 52, sever: 'RightArm', mult: 0.85, side: 'R' },
  rfarm:  { a: 'RightForeArm', b: 'RightHand', r: 0.058, key: 'farm', hp: 42, sever: 'RightForeArm', mult: 0.85, side: 'R' },
  lthigh: { a: 'LeftUpLeg', b: 'LeftLeg', r: 0.085, key: 'thigh', hp: 62, sever: 'LeftUpLeg', mult: 0.85, side: 'L', leg: true },
  lshin:  { a: 'LeftLeg', b: 'LeftFoot', r: 0.066, key: 'shin', hp: 52, sever: 'LeftLeg', mult: 0.85, side: 'L', leg: true },
  rthigh: { a: 'RightUpLeg', b: 'RightLeg', r: 0.085, key: 'thigh', hp: 62, sever: 'RightUpLeg', mult: 0.85, side: 'R', leg: true },
  rshin:  { a: 'RightLeg', b: 'RightFoot', r: 0.066, key: 'shin', hp: 52, sever: 'RightLeg', mult: 0.85, side: 'R', leg: true },
};
// which parts disappear when a bone is cut
const SUBTREE = {
  Head: ['head', 'neck'], LeftArm: ['luarm', 'lfarm'], LeftForeArm: ['lfarm'], RightArm: ['ruarm', 'rfarm'], RightForeArm: ['rfarm'],
  LeftUpLeg: ['lthigh', 'lshin'], LeftLeg: ['lshin'], RightUpLeg: ['rthigh', 'rshin'], RightLeg: ['rshin'],
};
const PART_NAMES = { head: 'head', neck: 'neck', chest: 'chest', belly: 'stomach', luarm: 'left arm', lfarm: 'left forearm', ruarm: 'right arm', rfarm: 'right forearm', lthigh: 'left thigh', lshin: 'left shin', rthigh: 'right thigh', rshin: 'right shin' };

// swing paths in the fighter's own space: +Z is forward, -X is the right side
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const GUARD = { h: V(-0.12, 1.12, 0.36), b: V(0.25, 0.9, 0.35).normalize(), yaw: 0, pitch: 0 };
const GUARD_RUN = { h: V(-0.24, 1.0, 0.12), b: V(-0.25, 0.55, -0.8).normalize(), yaw: 0, pitch: 0 };
const GUARD_BLOCK = { h: V(-0.05, 1.42, 0.38), b: V(0.95, 0.3, 0.1).normalize(), yaw: 0.1, pitch: 0 };
const SWINGS = {
  R: [[0, GUARD], [0.3, { h: V(-0.42, 1.42, 0.02), b: V(-0.75, 0.35, -0.55), yaw: -0.5, pitch: 0 }], [0.45, { h: V(-0.06, 1.3, 0.68), b: V(-0.25, 0.02, 1), yaw: 0, pitch: 0.05 }], [0.62, { h: V(0.36, 1.22, 0.42), b: V(0.9, -0.1, 0.45), yaw: 0.55, pitch: 0.05 }], [1, GUARD]],
  L: [[0, GUARD], [0.3, { h: V(0.32, 1.45, 0.08), b: V(0.75, 0.35, -0.5), yaw: 0.45, pitch: 0 }], [0.45, { h: V(0.0, 1.3, 0.68), b: V(0.25, 0.02, 1), yaw: 0, pitch: 0.05 }], [0.62, { h: V(-0.38, 1.2, 0.42), b: V(-0.9, -0.1, 0.45), yaw: -0.5, pitch: 0.05 }], [1, GUARD]],
  U: [[0, GUARD], [0.3, { h: V(-0.08, 1.9, 0.02), b: V(0, 0.45, -0.9), yaw: -0.1, pitch: -0.18 }], [0.45, { h: V(-0.04, 1.45, 0.55), b: V(0, 0.25, 1), yaw: 0, pitch: 0.15 }], [0.62, { h: V(-0.04, 0.85, 0.5), b: V(0, -0.8, 0.55), yaw: 0, pitch: 0.38 }], [1, GUARD]],
  D: [[0, GUARD], [0.3, { h: V(-0.42, 1.0, 0.05), b: V(-0.7, -0.35, -0.5), yaw: -0.45, pitch: 0.3 }], [0.45, { h: V(-0.05, 0.85, 0.55), b: V(-0.1, -0.45, 0.9), yaw: 0, pitch: 0.45 }], [0.62, { h: V(0.38, 0.8, 0.3), b: V(0.8, -0.5, 0.2), yaw: 0.5, pitch: 0.4 }], [1, GUARD]],
  S: [[0, GUARD], [0.3, { h: V(-0.15, 1.22, 0.0), b: V(0, 0.12, 1), yaw: -0.25, pitch: 0 }], [0.45, { h: V(-0.06, 1.28, 0.8), b: V(0, 0.05, 1), yaw: 0.12, pitch: 0.12 }], [0.62, { h: V(-0.06, 1.28, 0.72), b: V(0, 0.05, 1), yaw: 0.1, pitch: 0.1 }], [1, GUARD]],
};
for (const k in SWINGS) for (const [, p] of SWINGS[k]) p.b.normalize();
const ACTIVE_FROM = 0.33, ACTIVE_TO = 0.63;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
function aimBone(b, childWorld, targetWorld) {
  b.getWorldPosition(_v1);
  _v2.copy(childWorld).sub(_v1).normalize();
  _v3.copy(targetWorld).sub(_v1).normalize();
  if (_v2.lengthSq() < 1e-8 || _v3.lengthSq() < 1e-8) return;
  _q1.setFromUnitVectors(_v2, _v3);
  b.getWorldQuaternion(_q2);
  _q1.multiply(_q2);
  b.parent.getWorldQuaternion(_q2).invert();
  b.quaternion.copy(_q2.multiply(_q1));
  b.updateMatrixWorld(true);
}
function rotateBoneWorld(b, axis, angle) {
  _q1.setFromAxisAngle(axis, angle);
  b.getWorldQuaternion(_q2);
  _q1.multiply(_q2);
  b.parent.getWorldQuaternion(_q2).invert();
  b.quaternion.copy(_q2.multiply(_q1));
  b.updateMatrixWorld(true);
}
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _H = new THREE.Vector3(), _T = new THREE.Vector3(), _P = new THREE.Vector3(), _E2 = new THREE.Vector3();
function solveArm(upper, fore, hand, target, pole) {
  upper.getWorldPosition(_S); fore.getWorldPosition(_E); hand.getWorldPosition(_H);
  const a = _S.distanceTo(_E), b = _E.distanceTo(_H);
  _T.copy(target).sub(_S);
  const d = Math.min(Math.max(_T.length(), 0.05), a + b - 0.002);
  _T.normalize();
  const cosA = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
  const sinA = Math.sqrt(1 - cosA * cosA);
  _P.copy(pole).addScaledVector(_T, -pole.dot(_T)).normalize();
  _E2.copy(_S).addScaledVector(_T, a * cosA).addScaledVector(_P, a * sinA);
  aimBone(upper, _E, _E2);
  hand.getWorldPosition(_H);
  _T.multiplyScalar(d).add(_S);
  aimBone(fore, _H, _T);
}
// closest distance between segments p1-q1 and p2-q2; also returns the point on the first one
function segSeg(p1, q1, p2, q2, outPoint) {
  const d1 = _v1.copy(q1).sub(p1), d2 = _v2.copy(q2).sub(p2), r = _v3.copy(p1).sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-8 && e <= 1e-8) { s = t = 0; }
  else if (a <= 1e-8) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else {
    const c = d1.dot(r);
    if (e <= 1e-8) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); }
      else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    }
  }
  const cx = p1.x + d1.x * s, cy = p1.y + d1.y * s, cz = p1.z + d1.z * s;
  const dx = p2.x + d2.x * t, dy = p2.y + d2.y * t, dz = p2.z + d2.z * t;
  if (outPoint) outPoint.set((cx + dx) / 2, (cy + dy) / 2, (cz + dz) / 2);
  return Math.hypot(cx - dx, cy - dy, cz - dz);
}

class Fighter {
  constructor(opt) {
    this.isPlayer = !!opt.player;
    this.tier = opt.tier;
    this.T = TIER[opt.tier];
    this.name = opt.name || this.T.name;
    this.root = new THREE.Group();
    this.root.rotation.order = 'YXZ';
    this.model = skeletonClone(soldierGLTF.scene);
    tintBody(this.model, opt.body);
    // armor + cape are fitted in the soldier's own pose first, then the whole thing is turned around
    this.armor = buildArmor(this.model, { tier: opt.player ? 1 : opt.tier, metal: opt.metal, rough: opt.rough, cloth: opt.cloth, leather: opt.leather, player: opt.player });
    if (opt.player) this.cape = new Cape(this.model, opt.cloth, this.armor.uniforms);
    this.model.rotation.y = Math.PI; // the soldier faces -Z, turn it to face +Z
    this.root.add(this.model);
    scene.add(this.root);
    if (this.cape) scene.add(this.cape.mesh);
    this.b = {};
    for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot']) this.b[n] = bone(this.model, n);
    this.b.HeadTop_End = this.model.getObjectByName('mixamorigHeadTop_End');
    this.mixer = new THREE.AnimationMixer(this.model);
    this.act = {};
    for (const clip of soldierGLTF.animations) this.act[clip.name] = this.mixer.clipAction(clip);
    this.w = { Idle: 1, Walk: 0, Run: 0 };
    for (const n of ['Idle', 'Walk', 'Run']) { this.act[n].play(); this.act[n].setEffectiveWeight(this.w[n]); this.act[n].time = Math.random() * this.act[n].getClip().duration; }
    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.vy = 0; this.grounded = true;
    this.facing = 0;
    this.speed = 0;
    this.maxHp = opt.player ? 100 : this.T.hp;
    this.hp = this.maxHp;
    this.parts = {};
    for (const k in PARTS) this.parts[k] = { hp: PARTS[k].hp * this.maxHp / 100, max: PARTS[k].hp * this.maxHp / 100, gone: false, wounds: 0 };
    this.bleed = 0;
    this.stamina = 100; this.staminaDelay = 0;
    this.armorHp = 100;
    this.alive = true; this.down = false;
    this.severed = [];
    this.attack = null;
    this.blocking = false; this.blockStart = 0;
    this.stagger = 0; this.dodge = 0; this.recoil = 0;
    this.blood = 0;
    this.heat = 0; this.heatTimer = 0;
    this.stepPhase = 0;
    this.prevBlade = null;
    this.setSword(opt.sword || SWORDS[0]);
    this.deathT = 0;
    this.lastHitBy = null;
    this.painT = 0;
    fighters.push(this);
  }
  setSword(def) {
    if (this.swordMesh) scene.remove(this.swordMesh);
    this.sword = def;
    this.swordMesh = makeSword(def, this.armor.uniforms);
    this.twoHanded = this.swordMesh.userData.gripLen > 0.16;
    scene.add(this.swordMesh);
    this.hasSword = true;
  }
  get dmgMult() { return 1 + this.heat * 0.05 + (this.isPlayer ? stats.str * 0.025 : 0); }
  get spdMult() {
    const arm = this.parts.ruarm.gone || this.parts.rfarm.gone ? 0.5 : 0.65 + 0.35 * Math.min(this.parts.ruarm.hp / this.parts.ruarm.max, this.parts.rfarm.hp / this.parts.rfarm.max);
    return (1 + this.heat * 0.03 + (this.isPlayer ? stats.spd * 0.012 : 0)) * Math.max(0.5, arm);
  }
  get legMult() {
    const l = Math.min(this.parts.lthigh.hp / this.parts.lthigh.max, this.parts.lshin.hp / this.parts.lshin.max);
    const r = Math.min(this.parts.rthigh.hp / this.parts.rthigh.max, this.parts.rshin.hp / this.parts.rshin.max);
    return 0.45 + 0.55 * Math.max(0, Math.min(l, r));
  }
  canAct() { return this.alive && !this.down && this.stagger <= 0 && this.recoil <= 0 && this.dodge <= 0; }
  startAttack(dir, kind = 'light') {
    if (!this.canAct() || this.attack || !this.hasSword) return false;
    const cost = (kind === 'heavy' ? 24 : 13) * Math.sqrt(this.sword.weight);
    if (this.stamina < cost * 0.5) return false;
    this.useStamina(cost);
    const base = (kind === 'heavy' ? 1.25 : 0.82) / (this.sword.speed * this.spdMult);
    this.attack = { dir, kind, t: 0, dur: base, hit: new Set(), swung: false, power: kind === 'heavy' ? 1.6 : kind === 'run' ? 1.3 : kind === 'slam' ? 1.8 : kind === 'finisher' ? 3 : 1 };
    this.blocking = false;
    return true;
  }
  useStamina(n) { this.stamina = Math.max(0, this.stamina - n); this.staminaDelay = 0.9; }
  // ---- per frame: animation, IK, sword placement ----
  animate(dt) {
    if (!this.alive || this.down) {
      // corpses and crawlers keep their last pose
      this.applySevered();
      this.placeSword();
      return;
    }
    const s = this.speed;
    const back = this.moveBack;
    const tIdle = 1 - smooth(0.15, 1.0, s), tRun = smooth(2.6, 4.2, s), tWalk = Math.max(0, 1 - tIdle - tRun);
    const k = Math.min(1, 10 * dt);
    this.w.Idle += (tIdle - this.w.Idle) * k; this.w.Walk += (tWalk - this.w.Walk) * k; this.w.Run += (tRun - this.w.Run) * k;
    const air = this.grounded ? 1 : 0.25;
    this.act.Idle.setEffectiveWeight(this.w.Idle);
    this.act.Walk.setEffectiveWeight(this.w.Walk);
    this.act.Walk.setEffectiveTimeScale((back ? -1 : 1) * Math.max(0.6, Math.min(1.7, s / 1.45)) * air);
    this.act.Run.setEffectiveWeight(this.w.Run);
    this.act.Run.setEffectiveTimeScale(Math.max(0.8, Math.min(1.6, s / 4.3)) * air);
    this.mixer.update(dt);
    // footsteps from the animation's own timing
    const cyc = this.w.Run > this.w.Walk ? this.act.Run : this.act.Walk;
    const ph = (cyc.time / cyc.getClip().duration) % 1;
    if (s > 0.4 && this.grounded && Math.floor(ph * 2) !== Math.floor(this.stepPhase * 2)) {
      const surf = this.pos.y < WATER_Y - 0.1 ? 'water' : pathDist(this.pos.x, this.pos.z) < 1.6 ? 'dirt' : 'grass';
      sfx.step(this.pos, surf, true, this.isPlayer ? 1 : 0.6);
    }
    this.stepPhase = ph;
    this.applySevered();
    this.root.updateMatrixWorld(true);
    this.pose(dt);
    this.placeSword();
  }
  applySevered() { for (const n of this.severed) this.b[n].scale.setScalar(0.0001); }
  // current upper-body target: guard, running carry, block, or a swing path
  target() {
    if (this.attack) {
      const keys = SWINGS[this.attack.dir];
      let t = Math.min(1, this.attack.t / this.attack.dur);
      if (this.attack.kind === 'heavy' && this.attack.hold) t = Math.min(t, 0.3);
      let i = 0; while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
      const [t0, A] = keys[i], [t1, B] = keys[i + 1];
      const f = smooth(0, 1, (t - t0) / (t1 - t0));
      return { h: _tgt.h.copy(A.h).lerp(B.h, f), b: _tgt.b.copy(A.b).lerp(B.b, f).normalize(), yaw: lerp(A.yaw, B.yaw, f), pitch: lerp(A.pitch, B.pitch, f), motion: _tgt.m.copy(B.b).sub(A.b) };
    }
    const g = this.blocking ? GUARD_BLOCK : this.speed > 3.5 ? GUARD_RUN : GUARD;
    if (!this.curPose) this.curPose = { h: g.h.clone(), b: g.b.clone(), yaw: 0, pitch: 0 };
    return { h: _tgt.h.copy(g.h), b: _tgt.b.copy(g.b), yaw: g.yaw, pitch: this.dodge > 0 ? 0.6 : g.pitch, motion: _tgt.m.set(0, 0, 1) };
  }
  pose(dt) {
    const tg = this.target();
    if (!this.curPose) this.curPose = { h: tg.h.clone(), b: tg.b.clone(), yaw: tg.yaw, pitch: tg.pitch };
    // swings follow their path exactly; guard changes ease in
    const k = this.attack ? 1 : Math.min(1, 12 * dt);
    const cp = this.curPose;
    cp.h.lerp(tg.h, k); cp.b.lerp(tg.b, k).normalize(); cp.yaw += (tg.yaw - cp.yaw) * k; cp.pitch += (tg.pitch - cp.pitch) * k;
    this.motionLocal = tg.motion;
    const up = _v1.set(0, 1, 0), right = _vr.set(-1, 0, 0).applyQuaternion(this.root.quaternion);
    if (Math.abs(cp.yaw) > 0.001) rotateBoneWorld(this.b.Spine1, up, cp.yaw * 0.6);
    if (Math.abs(cp.pitch) > 0.001) rotateBoneWorld(this.b.Spine, right, -cp.pitch * 0.7);
    if (!this.hasSword) return;
    // hands go where the swing path says
    this.handW = this.handW || new THREE.Vector3();
    this.bladeW = this.bladeW || new THREE.Vector3();
    this.handW.copy(cp.h).applyMatrix4(this.root.matrixWorld);
    this.bladeW.copy(cp.b).applyQuaternion(this.root.quaternion).normalize();
    const poleR = _vp.set(-0.6, -1, -0.25).applyQuaternion(this.root.quaternion);
    if (!this.parts.ruarm.gone && !this.parts.rfarm.gone) {
      _vt.copy(this.handW).addScaledVector(this.bladeW, -0.0);
      _vt2.copy(this.handW).sub(this.b.RightArm.getWorldPosition(_vt3)).normalize();
      _vt.addScaledVector(_vt2, -0.07);
      solveArm(this.b.RightArm, this.b.RightForeArm, this.b.RightHand, _vt, poleR);
    }
    if (this.twoHanded && !this.parts.luarm.gone && !this.parts.lfarm.gone) {
      const poleL = _vp.set(0.7, -1, -0.2).applyQuaternion(this.root.quaternion);
      _vt.copy(this.handW).addScaledVector(this.bladeW, -0.11);
      _vt2.copy(_vt).sub(this.b.LeftArm.getWorldPosition(_vt3)).normalize();
      _vt.addScaledVector(_vt2, -0.07);
      solveArm(this.b.LeftArm, this.b.LeftForeArm, this.b.LeftHand, _vt, poleL);
    }
  }
  placeSword() {
    if (!this.hasSword || !this.swordMesh.visible || !this.handW) return;
    if (!this.alive || this.down) return;
    const hand = this.b.RightHand.getWorldPosition(_vt), fore = this.b.RightForeArm.getWorldPosition(_vt2);
    const grip = _vt3.copy(hand).addScaledVector(_vt4.copy(hand).sub(fore).normalize(), 0.07);
    const Y = this.bladeW;
    const X = _vx.copy(this.motionLocal).applyQuaternion(this.root.quaternion);
    X.addScaledVector(Y, -X.dot(Y));
    if (X.lengthSq() < 1e-6) X.set(0, 0, 1).applyQuaternion(this.root.quaternion).addScaledVector(Y, -Y.z);
    X.normalize();
    const Z = _vz.crossVectors(X, Y).normalize();
    _m4.makeBasis(X, Y, Z);
    this.swordMesh.quaternion.setFromRotationMatrix(_m4);
    this.swordMesh.position.copy(grip);
  }
  bladeSeg(outA, outB) {
    outA.copy(this.swordMesh.position);
    outB.set(0, this.swordMesh.userData.tip, 0).applyQuaternion(this.swordMesh.quaternion).add(outA);
  }
  // ---- capsules for hit tests ----
  partSeg(k, A, B) {
    const p = PARTS[k];
    this.b[p.a].getWorldPosition(A); this.b[p.b].getWorldPosition(B);
  }
  // ---- taking a hit ----
  takeHit(k, raw, o) {
    if (!this.alive) return;
    const P = PARTS[k], part = this.parts[k];
    if (part.gone) return;
    const pierce = Math.min(0.95, (o.pierce || 0) + (o.stab ? 0.3 : 0));
    let armor = this.T.armor[P.key];
    if (this.isPlayer) armor *= 0.35 + 0.65 * (this.armorHp / 100);
    const through = 1 - armor * (1 - pierce);
    let dmg = raw * P.mult * through;
    const stopped = through < 0.45;
    if (stopped) dmg *= 0.55; // most of it goes into the plate as a blunt blow
    if (this.isPlayer) this.armorHp = Math.max(0, this.armorHp - raw * armor * 0.18);
    part.hp -= dmg; this.hp -= dmg;
    part.wounds++;
    this.lastHitBy = o.from;
    const at = o.point;
    if (stopped) { sfx.armorHit(at); gore.sparks(at, o.dir); }
    else {
      (o.stab ? sfx.stab : sfx.cut).call(sfx, at, Math.min(1.4, dmg / 25));
      this.bleed += dmg * (o.stab ? 0.035 : 0.025) * (o.cut || 1);
      gore.blood(at, o.dir, Math.min(60, 8 + dmg * 0.9), 2 + dmg * 0.05);
      this.blood = Math.min(1, this.blood + dmg * 0.006);
      if ((k === 'chest' || k === 'belly') && !o.stab && dmg > 26 && settings.gore >= 2) gore.gash(this, k, at);
    }
    if (o.from) o.from.blood = Math.min(1, o.from.blood + (stopped ? 0 : dmg * 0.004));
    // reactions
    if (dmg > 22 || o.power >= 1.6) { this.stagger = Math.max(this.stagger, 0.55); this.attack = null; }
    else if (dmg > 6) this.stagger = Math.max(this.stagger, 0.18);
    if (this.painT <= 0 && this.alive) {
      sfx.voice(this.pos, dmg > 25 ? 'scream' : dmg > 9 ? 'hurt' : 'grunt', this.voicePitch || 1);
      this.painT = dmg > 25 ? 1.0 : 0.4;
    }
    if (settings.dmgNums && !this.isPlayer) ui.damageNumber(at, dmg, !stopped);
    // cut through: only when the part is destroyed by an edge (stabs don't take limbs off)
    if (part.hp <= 0) {
      part.hp = 0;
      if (P.sever && !o.stab && settings.gore > 0) this.sever(P.sever, o);
      if (k === 'head' || k === 'neck') return this.die(o, k === 'neck' ? 'beheaded' : 'skull split');
      if (k === 'chest' || k === 'belly') return this.die(o, 'cut open');
    }
    if (this.hp <= 0) this.die(o, 'killed');
  }
  sever(boneName, o) {
    if (this.severed.includes(boneName)) return;
    const b = this.b[boneName];
    const childName = { Head: 'HeadTop_End', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot' }[boneName];
    const joint = b.getWorldPosition(new THREE.Vector3());
    const end = this.b[childName].getWorldPosition(new THREE.Vector3());
    const axis = end.clone().sub(joint).normalize();
    const r = boneName === 'Head' ? 0.07 : boneName.includes('Up') ? 0.08 : boneName.includes('Arm') && !boneName.includes('Fore') ? 0.06 : 0.052;
    // the cut-off piece: copies of every armor plate below the cut + flesh inside
    const piece = new THREE.Group();
    const center = joint.clone().lerp(end, 0.5);
    piece.position.copy(center);
    this.model.updateMatrixWorld(true);
    b.traverse(o2 => {
      if (o2.isMesh && o2.userData.armor) {
        const c = new THREE.Mesh(o2.geometry, o2.material);
        o2.matrixWorld.decompose(c.position, c.quaternion, c.scale);
        c.position.sub(center); c.castShadow = true;
        piece.add(c);
      }
    });
    const len = boneName === 'Head' ? 0.22 : joint.distanceTo(end) + (boneName.includes('Fore') ? 0.12 : boneName.endsWith('Leg') && !boneName.includes('Up') ? 0.1 : 0);
    const coreEnd = joint.clone().addScaledVector(axis, len);
    const core = new THREE.Mesh(cylBetween(joint.toArray(), coreEnd.toArray(), r * 0.95, r * 0.8, 10), ORGAN_MATS.flesh);
    core.position.sub(center); piece.add(core);
    const capOut = stumpCap(r, boneName === 'Head');
    capOut.position.copy(joint).sub(center).addScaledVector(axis, -0.002);
    capOut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().negate());
    piece.add(capOut);
    scene.add(piece);
    const fly = (o.dir ? o.dir.clone() : new THREE.Vector3()).multiplyScalar(2.5 + (o.power || 1) * 1.2);
    fly.y += 2.2 + Math.random() * 1.5;
    gore.piece(piece, fly, new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14), boneName === 'Head' ? 0.13 : 0.08, axis, joint.distanceTo(center), boneName === 'Head');
    // the stump left on the body
    const cap = stumpCap(r * 1.02, boneName === 'Head');
    cap.position.copy(joint).addScaledVector(axis, 0.004);
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    b.parent.attach(cap);
    const emitter = new THREE.Object3D();
    emitter.position.copy(joint);
    emitter.lookAt(joint.clone().add(axis));
    b.parent.attach(emitter);
    gore.emitter(emitter, this, boneName === 'Head' ? 7 : 5, boneName === 'Head' ? 1.6 : 1);
    this.severed.push(boneName);
    for (const pk of SUBTREE[boneName]) { this.parts[pk].gone = true; this.parts[pk].hp = 0; }
    this.bleed += boneName === 'Head' ? 50 : boneName.includes('Up') || boneName === 'LeftArm' || boneName === 'RightArm' ? 6 : 4;
    gore.blood(joint, axis, 70, 4.5);
    sfx.crack(joint); sfx.cut(joint, 1.4);
    if (this.alive && boneName !== 'Head') { sfx.voice(this.pos, 'scream', this.voicePitch || 1); this.painT = 1.4; }
    this.blood = Math.min(1, this.blood + 0.25);
    if (o.from) o.from.blood = Math.min(1, o.from.blood + 0.12);
    // lose the sword with the sword arm
    if (boneName === 'RightArm' || boneName === 'RightForeArm') this.dropSword();
    // lose a leg: go down and crawl
    if (boneName.includes('UpLeg') || boneName.endsWith('Leg')) this.goDown();
    if (this.isPlayer) ui.message('YOUR ' + PART_NAMES[SUBTREE[boneName][0]].toUpperCase() + ' IS GONE', 2.5);
  }
  dropSword() {
    if (!this.hasSword) return;
    this.hasSword = false; this.attack = null;
    const m = this.swordMesh;
    const g = new THREE.Group(); g.position.copy(m.position); g.quaternion.copy(m.quaternion);
    scene.remove(m); g.add(m); m.position.set(0, 0, 0); m.quaternion.identity();
    scene.add(g);
    gore.piece(g, new THREE.Vector3((Math.random() - 0.5) * 2, 1.5, (Math.random() - 0.5) * 2), new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), 0.03, new THREE.Vector3(0, 1, 0), 0, false, true);
  }
  goDown() {
    if (this.down || !this.alive) return;
    this.down = true; this.attack = null; this.blocking = false;
    this.fallDir = 1; // face down
    this.fallT = 0;
    sfx.thud(this.pos, 1);
  }
  die(o, how) {
    if (!this.alive) return;
    this.alive = false; this.attack = null; this.blocking = false;
    this.deathHow = how;
    if (!this.down) { this.fallDir = -1; this.fallT = 0; }
    this.down = true;
    sfx.voice(this.pos, 'death', this.voicePitch || 1);
    setTimeout(() => sfx.thud(this.pos, 1.2), 650);
    this.dropSword();
    // torso cut open: ribs show, organs spill out
    const torso = o && (o.part === 'chest' || o.part === 'belly') && !o.stab;
    if (torso && settings.gore >= 2) gore.openTorso(this, o);
    else if (o && o.stab && (o.part === 'chest' || o.part === 'belly') && settings.gore >= 2) gore.openTorso(this, o, true);
    gore.pool(this);
    if (o && o.from) o.from.onKill && o.from.onKill(this, how);
  }
  // falling over and lying still (procedural, no ragdoll)
  updateFall(dt) {
    if (!this.down || this.fallT === undefined) return;
    this.fallT = Math.min(1, this.fallT + dt * 1.6);
    const f = this.fallT * this.fallT;
    this.root.rotation.x = this.fallDir * f * Math.PI / 2 * 0.97;
    const g = groundH(this.pos.x, this.pos.z);
    this.pos.y = g + 0.11 * f;
  }
}
const _tgt = { h: new THREE.Vector3(), b: new THREE.Vector3(), m: new THREE.Vector3() };
const _vr = new THREE.Vector3(), _vp = new THREE.Vector3(), _vt = new THREE.Vector3(), _vt2 = new THREE.Vector3(), _vt3 = new THREE.Vector3(), _vt4 = new THREE.Vector3(), _vx = new THREE.Vector3(), _vz = new THREE.Vector3();

// ---------- the combat pass: blades against bodies ----------
const _bA = new THREE.Vector3(), _bB = new THREE.Vector3(), _pA = new THREE.Vector3(), _pB = new THREE.Vector3(), _hit = new THREE.Vector3(), _sA = new THREE.Vector3(), _sB = new THREE.Vector3();
function updateAttack(f, dt) {
  const a = f.attack;
  if (!a) return;
  if (a.kind === 'heavy' && a.hold) { a.t = Math.min(a.t + dt, a.dur * 0.3); return; }
  a.t += dt;
  const t = a.t / a.dur;
  if (!a.swung && t >= ACTIVE_FROM - 0.06) { a.swung = true; sfx.swing(f.swordMesh.position, f.sword.weight, a.power); if (a.power > 1.2 || Math.random() < 0.35) sfx.voice(f.pos, 'exert', f.voicePitch || 1); }
  if (t >= ACTIVE_FROM && t <= ACTIVE_TO && f.hasSword) {
    f.bladeSeg(_bA, _bB);
    const prev = f.prevBlade;
    for (const o of fighters) {
      if (o === f || !o.alive || a.hit.has(o) || (f.isPlayer === o.isPlayer) || o.dodge > 0.1) continue;
      if (o.pos.distanceTo(f.pos) > 3.5) continue;
      let best = null, bestD = 1e9;
      // sweep: test the blade now and in-between last frame and now
      for (let s = 0; s <= 4; s++) {
        if (s > 0 && !prev) break;
        const lt = s / 4;
        _sA.copy(prev ? prev.a : _bA).lerp(_bA, s === 0 ? 1 : lt);
        _sB.copy(prev ? prev.b : _bB).lerp(_bB, s === 0 ? 1 : lt);
        for (const k in PARTS) {
          if (o.parts[k].gone) continue;
          o.partSeg(k, _pA, _pB);
          const d = segSeg(_sA, _sB, _pA, _pB, _hit) - PARTS[k].r;
          if (d < 0.03 && d < bestD) { bestD = d; best = { k, p: _hit.clone() }; }
        }
      }
      if (!best) continue;
      a.hit.add(o);
      const dir = o.pos.clone().sub(f.pos).setY(0).normalize();
      // block / parry check: target must face the attacker
      const fwd = new THREE.Vector3(Math.sin(o.facing), 0, Math.cos(o.facing));
      const facing = fwd.dot(dir.clone().negate()) > Math.cos(1.25);
      if (o.blocking && facing && o.hasSword && o.canAct() && a.kind !== 'finisher') {
        const parry = (now() - o.blockStart) < 0.2;
        sfx.clang(best.p, parry ? 1.4 : 1); gore.sparks(best.p, dir, parry ? 30 : 16);
        if (parry) { f.attack = null; f.stagger = 1.0; f.recoil = 0; sfx.voice(f.pos, 'grunt', f.voicePitch || 1); if (o.isPlayer) ui.message('PARRY', 0.8); }
        else {
          o.useStamina(f.sword.weight * a.power * 9);
          f.attack = null; f.recoil = 0.35;
          if (o.stamina <= 0) { o.blocking = false; o.stagger = 0.9; if (o.isPlayer) ui.message('GUARD BROKEN', 1); }
        }
        return;
      }
      const raw = f.sword.dmg * a.power * f.dmgMult * (0.85 + Math.random() * 0.3);
      const stab = a.dir === 'S';
      o.takeHit(best.k, raw, { pierce: f.sword.pierce + (a.power >= 1.6 ? 0.1 : 0), cut: f.sword.cut, stab, point: best.p, dir, from: f, power: a.power, part: best.k });
      if (f.isPlayer || o.isPlayer) shake(stab ? 0.15 : 0.25 * Math.min(2, a.power));
      f.heat = Math.min(10, f.heat + 1); f.heatTimer = 0;
      if (f.isPlayer) gainXp(raw);
      hitStop(0.05);
    }
  }
  f.prevBlade = f.prevBlade || { a: new THREE.Vector3(), b: new THREE.Vector3() };
  if (f.hasSword) { f.bladeSeg(f.prevBlade.a, f.prevBlade.b); }
  if (a.t >= a.dur) { f.attack = null; f.prevBlade = null; }
}
let clockNow = 0;
function now() { return clockNow; }
