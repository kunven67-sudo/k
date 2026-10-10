// Inverse kinematics helpers for the procedural animator.
//
// Bones are THREE.Bone objects in a normal hierarchy; solvers rotate them in world space and
// write back local quaternions, then refresh the chain's world matrices.

import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _t = new THREE.Vector3();
const _ac = new THREE.Vector3();
const _ab = new THREE.Vector3();
const _at = new THREE.Vector3();
const _ba = new THREE.Vector3();
const _bc = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _r = new THREE.Quaternion(); // rotation argument temp (never used inside rotateWorld)
const _qp = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _pole = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();

const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);

/** Apply a world-space rotation `rot` to `bone` (around its own pivot). */
export function rotateWorld(bone, rot) {
  bone.parent.getWorldQuaternion(_qp);
  _qi.copy(_qp).invert();
  // local' = parentW⁻¹ · rot · parentW · local
  bone.quaternion.premultiply(_q.copy(_qi).multiply(rot).multiply(_qp));
}

/** Set a bone's world rotation. */
export function setWorldQuaternion(bone, q) {
  bone.parent.getWorldQuaternion(_qp);
  bone.quaternion.copy(_qp.invert().multiply(q));
}

/**
 * Two-bone IK: rotate `upper` and `lower` so `end` (the bone at the chain tip) reaches `target`.
 * `pole` (world point) chooses the bend plane. `weight` blends from the current pose.
 * Returns how far the target remained out of reach (m), for hip-height correction.
 */
export function solveTwoBone(upper, lower, end, target, pole, weight = 1) {
  if (weight <= 0) return 0;
  upper.updateWorldMatrix(true, true);
  upper.getWorldPosition(_a);
  lower.getWorldPosition(_b);
  end.getWorldPosition(_c);
  _t.copy(target);
  if (weight < 1) _t.lerpVectors(_c, target, weight);
  const lab = _b.distanceTo(_a);
  const lcb = _c.distanceTo(_b);
  const eps = 1e-4;
  const want = _t.distanceTo(_a);
  const lat = Math.min(Math.max(want, eps), lab + lcb - eps * 10);
  _ac.subVectors(_c, _a).normalize();
  _ab.subVectors(_b, _a).normalize();
  _at.subVectors(_t, _a).normalize();
  _ba.subVectors(_a, _b).normalize();
  _bc.subVectors(_c, _b).normalize();
  const acab0 = Math.acos(clamp1(_ac.dot(_ab)));
  const babc0 = Math.acos(clamp1(_ba.dot(_bc)));
  const acab1 = Math.acos(clamp1((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat)));
  const babc1 = Math.acos(clamp1((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb)));
  // Bend plane from the pole (falls back to the current bend when the pole is degenerate).
  _pole.subVectors(pole, _a);
  _axis.crossVectors(_ac, _pole);
  if (_axis.lengthSq() < 1e-8) _axis.crossVectors(_ac, _ab);
  if (_axis.lengthSq() < 1e-8) _axis.set(1, 0, 0);
  _axis.normalize();
  // Make sure the current bend agrees with the pole plane before bending (removes twist flips).
  {
    _p1.copy(_ab).addScaledVector(_ac, -_ab.dot(_ac));
    _p2.copy(_pole).normalize().addScaledVector(_ac, -_pole.clone().normalize().dot(_ac));
    if (_p1.lengthSq() > 1e-8 && _p2.lengthSq() > 1e-8) {
      _p1.normalize();
      _p2.normalize();
      const ang = Math.acos(clamp1(_p1.dot(_p2)));
      const s = Math.sign(_p3.crossVectors(_p1, _p2).dot(_ac)) || 1;
      rotateWorld(upper, _r.setFromAxisAngle(_ac, ang * s));
      upper.updateWorldMatrix(false, true);
      lower.getWorldPosition(_b);
      end.getWorldPosition(_c);
      _ab.subVectors(_b, _a).normalize();
      _ba.subVectors(_a, _b).normalize();
      _bc.subVectors(_c, _b).normalize();
    }
  }
  // Bend axis must follow the actual bend side (b on the pole side of a→c).
  _axis.crossVectors(_ac, _ab);
  if (_axis.lengthSq() < 1e-8) _axis.crossVectors(_ac, _pole);
  _axis.normalize();
  rotateWorld(upper, _r.setFromAxisAngle(_axis, acab1 - acab0));
  rotateWorld(lower, _r.setFromAxisAngle(_axis, babc1 - babc0));
  upper.updateWorldMatrix(false, true);
  // Swing the whole chain onto the target direction.
  end.getWorldPosition(_c);
  _ac.subVectors(_c, _a).normalize();
  const swing = Math.acos(clamp1(_ac.dot(_at)));
  if (swing > 1e-5) {
    _axis.crossVectors(_ac, _at).normalize();
    rotateWorld(upper, _r.setFromAxisAngle(_axis, swing));
    upper.updateWorldMatrix(false, true);
  }
  return Math.max(0, want - (lab + lcb));
}
const _p3 = new THREE.Vector3();

/** Rotate `bone` (world) so its local `axis` points along `dir` (weighted). */
export function aimBone(bone, dir, axis = new THREE.Vector3(0, 1, 0), weight = 1) {
  bone.getWorldQuaternion(_q);
  const cur = _b.copy(axis).applyQuaternion(_q).normalize();
  const want = _c.copy(dir).normalize();
  const rot = new THREE.Quaternion().setFromUnitVectors(cur, want);
  if (weight < 1) rot.slerp(_qi.identity(), 1 - weight);
  rotateWorld(bone, rot);
}
