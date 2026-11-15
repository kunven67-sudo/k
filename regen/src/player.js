// You: Remy (real Mixamo human), first/third person (V), walking/running, limping when a leg is gone,
// hands that grab and swing weapons (two-bone IK), and what happens when you get hurt.
import * as THREE from 'three';
import { RegenBody, LIMBS } from './body.js';
import { retargetClips } from './retarget.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4();

// Two-bone IK: rotate upper + lower so `end` reaches `target`, elbow/knee bends toward `pole`. All world space.
export function solveIK(upper, lower, end, target, pole) {
  const a = upper.getWorldPosition(new THREE.Vector3()), b = lower.getWorldPosition(new THREE.Vector3()), c = end.getWorldPosition(new THREE.Vector3());
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const toT = _a.subVectors(target, a); let d = toT.length();
  d = THREE.MathUtils.clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3); toT.normalize();
  const cosA = THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const pd = _b.subVectors(pole, a); pd.addScaledVector(toT, -pd.dot(toT)); if (pd.lengthSq() < 1e-8) pd.set(0, -1, 0); pd.normalize();
  const bWant = new THREE.Vector3().copy(a).addScaledVector(toT, l1 * cosA).addScaledVector(pd, l1 * sinA);
  rotateBoneToward(upper, b.clone().sub(a).normalize(), bWant.clone().sub(a).normalize());
  upper.updateMatrixWorld(true);
  const b2 = lower.getWorldPosition(new THREE.Vector3()), c2 = end.getWorldPosition(new THREE.Vector3());
  const tWant = a.clone().addScaledVector(toT, d);
  rotateBoneToward(lower, c2.clone().sub(b2).normalize(), tWant.sub(b2).normalize());
  lower.updateMatrixWorld(true);
}
function rotateBoneToward(bone, from, to) {
  _q.setFromUnitVectors(from, to);
  const pw = bone.parent.getWorldQuaternion(_q2);
  const bw = bone.getWorldQuaternion(new THREE.Quaternion());
  bw.premultiply(_q);
  bone.quaternion.copy(pw.invert().multiply(bw));
}
export function setBoneWorldQuat(bone, wq) {
  const pw = bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(pw.invert().multiply(wq)); bone.updateMatrixWorld(true);
}

export class Player {
  constructor(gltf, animGltf, layers, ctx) {
    this.ctx = ctx; // {scene, camera, physics, fx, audio}
    this.group = new THREE.Group(); ctx.scene.add(this.group);
    const model = gltf.scene;
    const h = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    model.scale.setScalar(1.8 / h); model.updateMatrixWorld(true);
    const clips = retargetClips(animGltf.animations, animGltf.scene, model, 'mixamorig:Hips'); // before turning him
    model.rotation.y = Math.PI; // the moves face -Z: turn so you face +Z
    this.holder = new THREE.Group(); this.holder.add(model); this.group.add(this.holder);
    this.group.updateMatrixWorld(true);
    this.model = model;
    this.body = new RegenBody({ scene: model }, layers, ctx);
    this.mixer = new THREE.AnimationMixer(model);
    this.acts = {};
    for (const c of clips) { const a = this.mixer.clipAction(c); a.play(); a.weight = 0; this.acts[c.name] = a; }
    this.acts.Idle.weight = 1;
    this.B = this.body.bones;
    for (const n of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (const s of ['Left', 'Right']) for (let i = 1; i <= 3; i++) { const b = this.B[s + 'Hand' + n + i]; if (b) (this.fingers ||= []).push([b, s, n, i]); }
    // movement state
    this.pos = this.group.position; this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.ground = true;
    this.view = 'first'; this.camDist = 3.2; this.drop = 0; this.bob = 0; this.stagger = 0;
    this.weapon = null; this.shield = null; this.swing = 0; this.swingDir = 1; this.throwT = 0; this.blocking = false; this.aim = 0;
    this.lastHurt = 0; this.recoil = 0;
  }

  forward(v = new THREE.Vector3()) { return v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  right(v = new THREE.Vector3()) { return v.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  lookDir(v = new THREE.Vector3()) { const cp = Math.cos(this.pitch); return v.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp); }
  legs() { return this.body.amount('lLeg') + this.body.amount('rLeg'); }
  canUseRight() { return this.body.amount('rArm') >= 1; }
  canUseLeft() { return this.body.amount('lArm') >= 1; }

  update(dt, input, physics) {
    // ---- look
    this.yaw -= input.dx; this.pitch = THREE.MathUtils.clamp(this.pitch - input.dy, -1.45, 1.45);
    // ---- move
    const L = this.legs(), lL = this.body.amount('lLeg'), rL = this.body.amount('rLeg');
    let speed = input.walk ? 1.7 : input.sprint ? 7.2 : 4.6;
    let mode = 'normal';
    if (L < 2) {
      if (Math.max(lL, rL) >= 1) { mode = 'hop'; speed *= 0.38; }
      else if (L > 0) { mode = 'knees'; speed = 1.4; }
      else { mode = 'crawl'; speed = 1.1; }
    }
    if (this.stagger > 0) { speed *= 0.3; this.stagger -= dt; }
    const f = this.forward(_a), r = this.right(_b);
    const want = _c.set(0, 0, 0).addScaledVector(f, input.fwd).addScaledVector(r, input.side);
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(speed);
    const k = this.ground ? Math.min(1, dt * 10) : Math.min(1, dt * 2);
    this.vel.x += (want.x - this.vel.x) * k; this.vel.z += (want.z - this.vel.z) * k;
    if (input.jump && this.ground && mode !== 'crawl') { this.vel.y = mode === 'normal' ? 5.2 : 3; this.ground = false; }
    this.vel.y -= 9.81 * dt;
    this.pos.addScaledVector(this.vel, dt);
    physics.pushWalker(this.pos, 0.35, 1.8 - this.drop);
    const floor = physics.floorAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= floor) {
      if (!this.ground && this.vel.y < -14) this.onFall && this.onFall(-this.vel.y);
      this.pos.y = floor; this.vel.y = 0; this.ground = true;
    } else if (this.pos.y > floor + 0.05) this.ground = false;
    const R = 195; const hl = Math.hypot(this.pos.x, this.pos.z); if (hl > R) { this.pos.x *= R / hl; this.pos.z *= R / hl; }
    // ---- body pose
    this.group.rotation.y = this.yaw;
    const hs = Math.hypot(this.vel.x, this.vel.z), fwdSpeed = this.vel.x * f.x + this.vel.z * f.z;
    const wantDrop = mode === 'crawl' ? 0.95 : mode === 'knees' ? 0.47 : 0;
    this.drop += (wantDrop - this.drop) * Math.min(1, dt * 4);
    let bobY = 0;
    if (mode === 'hop' && hs > 0.2 && this.ground) { this.bob += dt * 7; bobY = Math.abs(Math.sin(this.bob)) * 0.12; }
    this.holder.position.y = -this.drop + bobY;
    this.holder.rotation.x = mode === 'crawl' ? 0.25 : 0;
    // animation weights
    const run = THREE.MathUtils.clamp((hs - 2.2) / 2.2, 0, 1), walk = THREE.MathUtils.clamp(hs / 1.6, 0, 1) * (1 - run);
    const A = this.acts, blend = Math.min(1, dt * 8);
    A.Idle.weight += ((1 - walk - run) - A.Idle.weight) * blend;
    A.Walk.weight += (walk - A.Walk.weight) * blend; A.Run.weight += (run - A.Run.weight) * blend;
    const dirSign = fwdSpeed < -0.3 ? -1 : 1;
    A.Walk.timeScale = dirSign * Math.max(0.6, hs / 1.7) * (mode === 'normal' ? 1 : 0.7);
    A.Run.timeScale = dirSign * Math.max(0.7, hs / 5.0);
    if (A.TPose) A.TPose.weight = 0;
    this.mixer.update(dt);
    this.group.updateMatrixWorld(true);
    this.poseArms(dt, input);
    this.body.uniforms.uHideHead.value = this.view === 'first' ? 1 : 0;
    this.body.update(dt);
    this.group.updateMatrixWorld(true);
  }

  // where the eyes are
  eye(v = new THREE.Vector3()) {
    this.B.Head.getWorldPosition(v); v.y += 0.07; v.addScaledVector(this.forward(_d), 0.1); return v;
  }

  placeCamera(cam, shake = 0) {
    const e = new THREE.Euler(this.pitch, this.yaw + Math.PI, 0, 'YXZ');
    const recoil = this.recoil; this.recoil *= 0.85;
    e.x += recoil;
    if (this.view === 'first') {
      this.eye(cam.position);
      cam.quaternion.setFromEuler(e);
    } else {
      const piv = _a.copy(this.pos); piv.y += 1.55 - this.drop * 0.9;
      cam.quaternion.setFromEuler(e);
      const back = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion), side = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
      cam.position.copy(piv).addScaledVector(back, this.camDist).addScaledVector(side, 0.55);
      if (cam.position.y < 0.25) cam.position.y = 0.25;
    }
    if (shake > 0) { cam.position.x += (Math.random() - 0.5) * shake * 0.12; cam.position.y += (Math.random() - 0.5) * shake * 0.12; }
  }

  // ---- arms holding stuff
  frame() {
    // chest-centered frame that follows where you look
    const o = this.B.Spine2.getWorldPosition(new THREE.Vector3());
    const fw = this.lookDir(new THREE.Vector3()), rt = this.right(new THREE.Vector3()), up = new THREE.Vector3().crossVectors(rt, fw).multiplyScalar(-1).normalize();
    if (this.view === 'first') { this.eye(o); o.y -= 0.32; }
    return { o, fw, rt, up };
  }
  poseArms(dt, input) {
    const w = this.weapon, F = this.frame(), B = this.B;
    const P = (x, y, z) => F.o.clone().addScaledVector(F.rt, x).addScaledVector(F.up, y).addScaledVector(F.fw, z);
    // weapon placement: position of grip + blade direction + "edge" direction
    let grip = null, dir = null, edge = null, leftT = null;
    if (w && this.canUseRight()) {
      const kind = w.def.kind;
      if (kind === 'gun' || kind === 'rifle') {
        const rifle = kind === 'rifle';
        grip = this.view === 'first' ? P(0.12, rifle ? -0.06 : -0.08, rifle ? 0.3 : 0.38) : P(0.14, 0.02, rifle ? 0.3 : 0.4);
        if (this.aim > 0.5 && this.view === 'first') grip = P(0, -0.05, rifle ? 0.28 : 0.36);
        dir = F.fw.clone(); edge = F.up.clone();
        if (this.canUseLeft()) leftT = rifle ? grip.clone().addScaledVector(F.fw, 0.38).addScaledVector(F.rt, -0.03).addScaledVector(F.up, -0.02) : grip.clone().addScaledVector(F.rt, -0.04).addScaledVector(F.up, -0.03);
      } else if (kind === 'throw') {
        const t = this.throwT; // 0 idle, >0 throwing
        const back = t > 0 ? Math.sin(Math.min(1, t / 0.35) * Math.PI) : 0;
        grip = P(0.22, -0.12 + back * 0.4, 0.3 - back * 0.45);
        dir = F.up.clone().addScaledVector(F.fw, 0.4 - back).normalize(); edge = F.fw.clone();
      } else if (kind === 'shield') {
        grip = null;
      } else { // melee
        const s = this.swing > 0 ? 1 - this.swing / w.def.swing : 0; // 0..1 through the swing
        const side = this.swingDir;
        const keys = [ // [x, y, z, blade dir (in frame), edge]
          [0.22, -0.1, 0.32, [0.1, 0.9, 0.35]],
          [0.3 * side, 0.32, 0.05, [0.35 * side, 0.55, -0.7]],
          [-0.18 * side, -0.12, 0.5, [-0.75 * side, -0.05, 0.6]],
          [0.22, -0.1, 0.32, [0.1, 0.9, 0.35]],
        ];
        if (this.view === 'first') { keys[0] = keys[3] = [0.2, -0.16, 0.5, [-0.25, 0.6, 0.75]]; }
        let a, b2, u;
        if (s <= 0) { a = b2 = keys[0]; u = 0; } else if (s < 0.35) { a = keys[0]; b2 = keys[1]; u = s / 0.35; } else if (s < 0.6) { a = keys[1]; b2 = keys[2]; u = (s - 0.35) / 0.25; } else { a = keys[2]; b2 = keys[3]; u = (s - 0.6) / 0.4; }
        u = u * u * (3 - 2 * u);
        const L = (i) => a[i] + (b2[i] - a[i]) * u;
        grip = P(L(0), L(1), L(2));
        const bd = new THREE.Vector3().addScaledVector(F.rt, a[3][0] + (b2[3][0] - a[3][0]) * u).addScaledVector(F.up, a[3][1] + (b2[3][1] - a[3][1]) * u).addScaledVector(F.fw, a[3][2] + (b2[3][2] - a[3][2]) * u).normalize();
        dir = bd; edge = new THREE.Vector3().crossVectors(dir, F.rt).normalize();
      }
    }
    if (grip) {
      solveIK(B.RightArm, B.RightForeArm, B.RightHand, grip, P(0.7, -0.6, -0.3));
      this.gripHand(B.RightHand, dir, edge, 'Right');
      w.place(grip, dir, edge, this.view === 'first');
    } else if (w) w.hide();
    if (this.shield && this.canUseLeft()) {
      const up = this.blocking ? 1 : 0;
      this.aim = this.aim; // unchanged
      const sg = P(-0.26 + up * 0.08, -0.08 + up * 0.12, 0.3 + up * 0.12);
      solveIK(B.LeftArm, B.LeftForeArm, B.LeftHand, sg, P(-0.7, -0.6, -0.3));
      this.gripHand(B.LeftHand, F.up.clone(), F.fw.clone().negate(), 'Left');
      this.shield.place(sg, F.up.clone(), F.fw.clone().negate(), this.view === 'first', F.fw.clone());
      leftT = null;
    } else if (this.shield) this.shield.hide();
    if (leftT) {
      solveIK(B.LeftArm, B.LeftForeArm, B.LeftHand, leftT, P(-0.7, -0.7, -0.2));
      this.gripHand(B.LeftHand, dir, edge, 'Left');
    }
  }
  // turn the hand so the fist wraps the handle, and curl fingers
  gripHand(hand, dir, edge, side) {
    // Mixamo hand: +Y runs wrist -> fingers. Fingers point across the handle, palm faces the handle.
    const across = new THREE.Vector3().crossVectors(dir, edge).normalize();
    const y = across.multiplyScalar(side === 'Right' ? 1 : -1);
    const z = edge.clone().negate(); const x = new THREE.Vector3().crossVectors(y, z).normalize(); z.crossVectors(x, y);
    _m.makeBasis(x, y, z); _q.setFromRotationMatrix(_m);
    // hand bones have the model's scale/handedness baked in: keep a calibration offset
    setBoneWorldQuat(hand, _q.multiply(this.handFix || _q2.identity()));
    for (const [b, s, n, i] of this.fingers) if (s === side) { b.quaternion.setFromAxisAngle(_d.set(0, 0, 1), (n === 'Thumb' ? 0.4 : 1.25) * (side === 'Right' ? 1 : -1)); }
  }
}
