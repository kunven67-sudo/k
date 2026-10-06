// Animator: the per-frame animation pipeline of one Human.
//
//   1. restore the rest pose
//   2. base layer: locomotion / idle (or a held state such as seated / lying)
//   3. action layer: one-shots and transitions (actions.js), blended with per-bone masks
//   4. look-at (chest → neck → head distribution; the eyes lead)
//   5. write the pose to the bones (Euler offsets on rest rotations, hips offset)
//   6. leg IK to the planted/swinging ankle targets + foot/toe orientation
//   7. hand IK (actions or setHandTarget) + finger shapes
//   8. face (expressions, visemes, blinks, gaze) — after the head is final
//   9. jiggle springs (soft tissue, hair guides, loose clothes) on the final pose

import * as THREE from 'three';
import { Pose, makeMasks } from './pose.js';
import { Locomotion } from './locomotion.js';
import { Face } from './face.js';
import { Jiggle } from './jiggle.js';
import { solveTwoBone, setWorldQuaternion } from './ik.js';
import { ActionPlayer } from './actions.js';
import { clamp, damp } from '../../core/util.js';

// Finger shapes: per finger [mcp, pip, dip] curl (rad, + toward the palm) + spread (rad).
export const HAND_SHAPES = {
  relaxed: { index: [0.22, 0.3, 0.18], middle: [0.28, 0.36, 0.2], ring: [0.32, 0.4, 0.22], pinky: [0.38, 0.45, 0.25], thumb: [0.12, 0.18, 0.12], spread: 0.02 },
  fist: { index: [1.35, 1.55, 0.95], middle: [1.4, 1.6, 0.95], ring: [1.42, 1.6, 0.95], pinky: [1.45, 1.55, 0.9], thumb: [0.55, 0.55, 0.7], spread: -0.05 },
  point: { index: [0.0, 0.05, 0.02], middle: [1.35, 1.55, 0.9], ring: [1.4, 1.55, 0.9], pinky: [1.45, 1.5, 0.9], thumb: [0.5, 0.5, 0.6], spread: 0 },
  grip: { index: [0.95, 1.05, 0.55], middle: [1.0, 1.1, 0.55], ring: [1.05, 1.1, 0.5], pinky: [1.1, 1.05, 0.5], thumb: [0.55, 0.35, 0.3], spread: -0.03 },
  pinch: { index: [0.55, 0.75, 0.35], middle: [0.65, 0.9, 0.5], ring: [0.8, 1.0, 0.5], pinky: [0.9, 1.0, 0.5], thumb: [0.55, 0.45, 0.35], spread: 0 },
  open: { index: [0.02, 0.04, 0.02], middle: [0.02, 0.04, 0.02], ring: [0.03, 0.05, 0.03], pinky: [0.04, 0.06, 0.04], thumb: [-0.1, 0.0, 0.05], spread: 0.12 },
  flat: { index: [0.0, 0.0, 0.0], middle: [0.0, 0.0, 0.0], ring: [0.0, 0.0, 0.0], pinky: [0.0, 0.0, 0.0], thumb: [0.05, 0.05, 0.05], spread: 0.01 },
  flip: { index: [1.4, 1.55, 0.9], middle: [-0.05, 0.0, 0.0], ring: [1.42, 1.55, 0.9], pinky: [1.45, 1.5, 0.9], thumb: [0.6, 0.5, 0.6], spread: 0 },
  phone: { index: [0.55, 0.6, 0.3], middle: [0.85, 0.9, 0.45], ring: [0.95, 0.95, 0.45], pinky: [1.0, 0.95, 0.45], thumb: [0.15, 0.1, 0.1], spread: 0 },
  cup: { index: [0.45, 0.5, 0.3], middle: [0.5, 0.55, 0.3], ring: [0.55, 0.55, 0.3], pinky: [0.6, 0.55, 0.3], thumb: [0.25, 0.25, 0.2], spread: 0.02 },
  claw: { index: [0.5, 0.9, 0.8], middle: [0.5, 0.95, 0.8], ring: [0.55, 0.95, 0.8], pinky: [0.6, 0.95, 0.8], thumb: [0.3, 0.4, 0.4], spread: 0.15 },
  thumbsUp: { index: [1.4, 1.55, 0.95], middle: [1.42, 1.6, 0.95], ring: [1.45, 1.6, 0.95], pinky: [1.45, 1.55, 0.9], thumb: [-0.3, -0.1, 0.0], spread: 0 },
};
const FINGER_NAMES = ['index', 'middle', 'ring', 'pinky', 'thumb'];

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _left = new THREE.Vector3();

export class Animator {
  constructor(human) {
    this.h = human;
    const names = human.rig.bones.map((b) => b.name);
    this.names = names;
    this.base = new Pose(names);
    this.act = new Pose(names);
    this.pose = new Pose(names);
    this.masks = makeMasks(names);
    this.loco = new Locomotion(human);
    this.face = new Face(human);
    this.jiggle = new Jiggle(human);
    this.actions = new ActionPlayer(this);
    this.look = { target: null, yaw: 0, pitch: 0, w: 0 };
    this.handTarget = { L: { pos: null, w: 0 }, R: { pos: null, w: 0 } };
    this.handShapeCur = { L: { ...flatShape(HAND_SHAPES.relaxed) }, R: { ...flatShape(HAND_SHAPES.relaxed) } };
    this.time = 0;
    // Foot orientation correction: world frame (fw, up) → the foot bone's bind rotation.
    this.footFix = {};
    for (const s of ['L', 'R']) {
      const frame0 = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)));
      this.footFix[s] = frame0.invert().multiply(human.rig.worldQ[`foot.${s}`].clone());
    }
    this.onFootstep = null; // (side, worldPos, speed) — sound hook
  }

  setLocomotion(o) {
    this.loco.setIntent(o);
  }

  setFootIK(fn) {
    this.loco.footIK = fn;
  }

  setHandTarget(side, pos) {
    const t = this.handTarget[side];
    if (!t) return;
    if (pos) {
      t.pos = (t.pos || new THREE.Vector3()).copy(pos);
      t.active = true;
    } else t.active = false;
  }

  lookAt(target) {
    this.look.target = target ? (this.look.target || new THREE.Vector3()).copy(target) : null;
    this.face.lookTarget = this.look.target;
  }

  play(name, opts) {
    return this.actions.play(name, opts);
  }

  update(dt) {
    const h = this.h;
    const rig = h.rig;
    this.time += dt;
    // 1. rest pose.
    for (const b of rig.bones) {
      const r = rig.rest[b.name];
      b.quaternion.copy(r.q);
      b.position.copy(r.p);
    }
    h.root.updateMatrixWorld(true);
    // 2. base layer.
    const base = this.base.reset();
    this.loco.update(dt, base);
    // 3. actions.
    const pose = this.pose.copy(base);
    this.actions.update(dt, pose);
    // 4. look-at (in root space, distributed along the spine).
    this._lookAt(dt, pose);
    // 5. write rotations.
    const rot = pose.rot;
    for (let i = 0; i < rig.bones.length; i++) {
      const x = rot[i * 3];
      const y = rot[i * 3 + 1];
      const z = rot[i * 3 + 2];
      if (x === 0 && y === 0 && z === 0) continue;
      rig.bones[i].quaternion.multiply(_q.setFromEuler(_e.set(x, y, z)));
    }
    h.bones.hips.position.add(pose.hips);
    h.root.updateMatrixWorld(true);
    // 6. legs.
    const lock = pose.footLock * (1 - this.loco.air);
    if (lock > 0.001) {
      for (const s of ['L', 'R']) {
        const f = this.loco.feet[s];
        const thigh = h.bones[`thigh.${s}`];
        const shin = h.bones[`shin.${s}`];
        const foot = h.bones[`foot.${s}`];
        // Knee pole: in front of the knee along the foot's heading, slightly outward.
        _v.set(Math.sin(f.yaw), 0, Math.cos(f.yaw));
        _left.set(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
        const pole = shin.getWorldPosition(_v2).addScaledVector(_v, 0.6).addScaledVector(_left, (s === 'L' ? 1 : -1) * 0.08);
        solveTwoBone(thigh, shin, foot, f.ankle, pole, lock);
        _q.copy(f.quat).multiply(this.footFix[s]);
        if (lock < 1) {
          foot.getWorldQuaternion(_q2);
          _q.slerp(_q2, 1 - lock);
        }
        setWorldQuaternion(foot, _q);
        foot.updateMatrixWorld(true);
        h.bones[`toe.${s}`].quaternion.multiply(_q.setFromEuler(_e.set(f.contact ? Math.max(0, f.roll) * lock : 0, 0, 0)));
      }
    }
    // 7. hands.
    for (const s of ['L', 'R']) {
      const ht = this.handTarget[s];
      ht.w = damp(ht.w, ht.active ? 1 : 0, 0.12, dt);
      const ph = pose.hand[s];
      let w = 0;
      let target = null;
      if (ht.w > 0.001 && ht.pos) {
        target = _v.copy(ht.pos);
        w = ht.w;
      }
      if (ph.w > 0.001) {
        const at = _v2.copy(ph.pos).applyMatrix4(h.root.matrixWorld);
        target = target ? target.lerp(at, ph.w / Math.max(1e-3, ph.w + w)) : _v.copy(at);
        w = Math.max(w, ph.w);
      }
      if (target && w > 0.001) {
        const up = h.bones[`upperarm.${s}`];
        const fa = h.bones[`forearm.${s}`];
        const hand = h.bones[`hand.${s}`];
        // Elbow pole: down, out and back from the shoulder.
        const sh = up.getWorldPosition(new THREE.Vector3());
        const pole = sh.clone().add(new THREE.Vector3((s === 'L' ? 0.35 : -0.35), -0.5, -0.35).applyQuaternion(h.root.getWorldQuaternion(_q2)));
        solveTwoBone(up, fa, hand, target, pole, w);
        if (ph.rot && ph.w > 0) {
          _q.copy(ph.rot).premultiply(h.root.getWorldQuaternion(_q2));
          const cur = hand.getWorldQuaternion(new THREE.Quaternion());
          cur.slerp(_q, ph.w);
          setWorldQuaternion(hand, cur);
          hand.updateMatrixWorld(true);
        }
      }
      this._fingers(s, ph, dt);
    }
    // 8. face.
    h.bones.head.updateWorldMatrix(true, false);
    this.face.update(dt, h.bones.head.getWorldQuaternion(_q));
    // 9. secondary motion.
    h.root.updateMatrixWorld(true);
    this.jiggle.update(dt);
  }

  _lookAt(dt, pose) {
    const lk = this.look;
    const h = this.h;
    let yaw = 0;
    let pitch = 0;
    if (lk.target) {
      const head = h.bones.head.getWorldPosition(_v);
      const d = _v2.subVectors(lk.target, head).applyQuaternion(h.root.getWorldQuaternion(_q).invert());
      yaw = clamp(Math.atan2(d.x, d.z), -1.35, 1.35);
      pitch = clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), -0.6, 0.7);
      // Too far behind: give up turning the head (eyes still try).
      if (Math.abs(Math.atan2(d.x, d.z)) > 2.2) yaw = 0;
    }
    const w = pose.lookW;
    // The head lags the eyes slightly.
    lk.yaw = damp(lk.yaw, yaw * w, 0.16, dt);
    lk.pitch = damp(lk.pitch, pitch * w, 0.16, dt);
    pose.add('chest', lk.pitch * 0.1, lk.yaw * 0.18, 0);
    pose.add('neck', lk.pitch * 0.35, lk.yaw * 0.35, 0);
    pose.add('head', lk.pitch * 0.55, lk.yaw * 0.47, -lk.yaw * 0.04);
  }

  _fingers(side, ph, dt) {
    const h = this.h;
    const cur = this.handShapeCur[side];
    const want = flatShape(HAND_SHAPES[ph.shapeW > 0 ? ph.shape : 'relaxed'] || HAND_SHAPES.relaxed);
    const rel = flatShape(HAND_SHAPES.relaxed);
    const k = ph.shapeW > 0 ? ph.shapeW : 0;
    for (const key in cur) {
      const target = rel[key] + (want[key] - rel[key]) * k;
      cur[key] = damp(cur[key], target, 0.05, dt);
    }
    const sgn = side === 'L' ? 1 : -1;
    for (const f of FINGER_NAMES) {
      for (let i = 0; i < 3; i++) {
        const b = h.bones[`${f}${i + 1}.${side}`];
        const spread = i === 0 ? cur.spread * ({ index: 1, middle: 0.2, ring: -0.6, pinky: -1.2, thumb: 0.5 }[f]) * sgn : 0;
        b.quaternion.multiply(_q.setFromEuler(_e.set(cur[`${f}${i}`], 0, spread)));
      }
    }
    h.bones[`hand.${side}`].updateMatrixWorld(true);
  }
}

function flatShape(s) {
  const o = { spread: s.spread };
  for (const f of FINGER_NAMES) for (let i = 0; i < 3; i++) o[`${f}${i}`] = s[f][i];
  return o;
}
