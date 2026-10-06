// Pose: the per-frame description every animation layer writes into.
//
//   rot      Euler offsets (radians, XYZ) per bone, applied on top of the rest pose. Bone axes
//            follow rig.js: +X flexes a limb toward its front (hip/shoulder/elbow flexion,
//            spine bend forward, head nod down, finger curl, toes up); knees bend with −X.
//            Left/right poses mirror as (x, −y, −z).
//   hips     hips offset in root space (m)
//   hand     per side: IK target in root space + weight, and a finger shape blend
//   feet     locomotion owns the feet; layers can lower `footLock` to let poses move the legs
//
// Layers combine with blend(): lerp toward another pose under a per-bone mask.

import * as THREE from 'three';

export const MIRROR = (name) => (name.endsWith('.L') ? name.slice(0, -2) + '.R' : name.endsWith('.R') ? name.slice(0, -2) + '.L' : name);

export class Pose {
  constructor(boneNames) {
    this.names = boneNames;
    this.index = new Map(boneNames.map((n, i) => [n, i]));
    this.rot = new Float32Array(boneNames.length * 3);
    this.hips = new THREE.Vector3();
    this.hand = {
      L: { pos: new THREE.Vector3(), w: 0, shape: 'relaxed', shapeW: 0, rot: null },
      R: { pos: new THREE.Vector3(), w: 0, shape: 'relaxed', shapeW: 0, rot: null },
    };
    this.footLock = 1; // 1 = locomotion feet (IK planted), 0 = pose-driven legs
    this.lookW = 1; // how much look-at may turn the head
  }

  reset() {
    this.rot.fill(0);
    this.hips.set(0, 0, 0);
    for (const s of ['L', 'R']) {
      const h = this.hand[s];
      h.w = 0;
      h.shapeW = 0;
      h.shape = 'relaxed';
      h.rot = null;
    }
    this.footLock = 1;
    this.lookW = 1;
    return this;
  }

  /** Add an Euler offset (radians) to a bone. */
  add(name, x = 0, y = 0, z = 0) {
    const i = this.index.get(name);
    if (i === undefined) return this;
    this.rot[i * 3] += x;
    this.rot[i * 3 + 1] += y;
    this.rot[i * 3 + 2] += z;
    return this;
  }

  /** Add to both sides; values are for the LEFT bone and mirrored onto the right. */
  addSym(base, x = 0, y = 0, z = 0) {
    this.add(`${base}.L`, x, y, z);
    this.add(`${base}.R`, x, -y, -z);
    return this;
  }

  get(name) {
    const i = this.index.get(name);
    return i === undefined ? null : [this.rot[i * 3], this.rot[i * 3 + 1], this.rot[i * 3 + 2]];
  }

  copy(o) {
    this.rot.set(o.rot);
    this.hips.copy(o.hips);
    for (const s of ['L', 'R']) {
      const a = this.hand[s];
      const b = o.hand[s];
      a.pos.copy(b.pos);
      a.w = b.w;
      a.shape = b.shape;
      a.shapeW = b.shapeW;
      a.rot = b.rot;
    }
    this.footLock = o.footLock;
    this.lookW = o.lookW;
    return this;
  }

  /** this = lerp(this, o, w · mask(bone)). mask: Float32Array per bone (or null = all). */
  blend(o, w, mask = null) {
    if (w <= 0) return this;
    const n = this.names.length;
    for (let i = 0; i < n; i++) {
      const k = mask ? w * mask[i] : w;
      if (k <= 0) continue;
      this.rot[i * 3] += (o.rot[i * 3] - this.rot[i * 3]) * k;
      this.rot[i * 3 + 1] += (o.rot[i * 3 + 1] - this.rot[i * 3 + 1]) * k;
      this.rot[i * 3 + 2] += (o.rot[i * 3 + 2] - this.rot[i * 3 + 2]) * k;
    }
    const hw = mask ? w * mask[this.index.get('hips')] : w;
    this.hips.lerp(o.hips, hw);
    for (const s of ['L', 'R']) {
      const a = this.hand[s];
      const b = o.hand[s];
      const sw = mask ? w * mask[this.index.get(`hand.${s}`)] : w;
      if (b.w > 0) {
        if (a.w <= 0) a.pos.copy(b.pos);
        else a.pos.lerp(b.pos, sw);
        a.w += (b.w - a.w) * sw;
        if (b.rot) a.rot = b.rot;
      } else a.w *= 1 - sw;
      if (b.shapeW > 0) {
        if (sw >= a.shapeW || a.shapeW <= 0) a.shape = b.shape;
        a.shapeW += (b.shapeW - a.shapeW) * sw;
      }
    }
    this.footLock += (o.footLock - this.footLock) * hw;
    this.lookW += (o.lookW - this.lookW) * w;
    return this;
  }
}

/** Per-bone masks used by actions. */
export function makeMasks(names) {
  const m = (pred) => Float32Array.from(names, (n) => pred(n));
  const isArm = (n, s) => /^(clavicle|upperarm|forearm|hand|index|middle|ring|pinky|thumb|upperarmFat)/.test(n) && n.endsWith(`.${s}`);
  const isLeg = (n) => /^(thigh|shin|foot|toe)/.test(n);
  return {
    full: m(() => 1),
    upper: m((n) => (isLeg(n) || n === 'hips' || n === 'root' ? 0 : n === 'spine' ? 0.7 : 1)),
    armR: m((n) => (isArm(n, 'R') ? 1 : n === 'chest' || n === 'spine' ? 0.4 : n === 'neck' || n === 'head' ? 0.5 : 0)),
    armL: m((n) => (isArm(n, 'L') ? 1 : n === 'chest' || n === 'spine' ? 0.4 : n === 'neck' || n === 'head' ? 0.5 : 0)),
    arms: m((n) => (isArm(n, 'L') || isArm(n, 'R') ? 1 : n === 'chest' || n === 'spine' ? 0.5 : n === 'neck' || n === 'head' ? 0.6 : 0)),
    head: m((n) => (n === 'neck' || n === 'head' ? 1 : n === 'chest' ? 0.3 : 0)),
  };
}
