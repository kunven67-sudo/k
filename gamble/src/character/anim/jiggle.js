// Secondary motion: spring "jiggle" bones (MAX jiggle — design bible §1).
//
// Each jiggle bone keeps a damped spring in world space that chases the point its animated pose
// wants to be at; the lag (clamped) becomes a positional offset in the parent's space, so the
// skinned flesh around it sloshes after every step, stop, landing, laugh or slap. Stiffness,
// damping and travel are per bone; amplitude scales with how much soft tissue there is (fat,
// belly, chest, age), so slim people barely wobble and heavy people really move.

import * as THREE from 'three';
import { clamp } from '../../core/util.js';

const _w = new THREE.Vector3();
const _off = new THREE.Vector3();
const _pq = new THREE.Quaternion();
const _ps = new THREE.Vector3();

export class Jiggle {
  constructor(human) {
    this.h = human;
    const p = human.params;
    const s = human.rig.dims.s;
    const old = clamp((p.age - 40) / 45, 0, 1);
    const belly = clamp(p.belly * 0.6 + p.fat * 0.7, 0, 1.2);
    const soft = clamp(p.fat * 0.9 + 0.15 + old * 0.2 - p.muscle * 0.2, 0.08, 1.2);
    const chest = clamp(p.chest * (0.6 + p.fat * 0.6), 0, 1.2);
    // [bone, frequency Hz, damping ratio, travel (m), gain]
    const defs = [
      ['belly', 2.6, 0.22, 0.03 * s * belly + 0.004, 0.9 + belly],
      ['breast.L', 3.2, 0.2, 0.022 * s * chest + 0.002, 1.1],
      ['breast.R', 3.2, 0.2, 0.022 * s * chest + 0.002, 1.1],
      ['butt.L', 3.4, 0.25, 0.016 * s * soft, 0.9],
      ['butt.R', 3.4, 0.25, 0.016 * s * soft, 0.9],
      ['upperarmFat.L', 3.6, 0.22, 0.012 * s * soft, 1.0],
      ['upperarmFat.R', 3.6, 0.22, 0.012 * s * soft, 1.0],
      ['cheek.L', 5.0, 0.25, 0.004 * s * (0.3 + soft), 1.0],
      ['cheek.R', 5.0, 0.25, 0.004 * s * (0.3 + soft), 1.0],
    ];
    this.springs = defs
      .filter(([name]) => human.bones[name])
      .map(([name, hz, zeta, travel, gain]) => ({
        bone: human.bones[name],
        k: (2 * Math.PI * hz) ** 2,
        c: 2 * zeta * 2 * Math.PI * hz,
        travel,
        gain,
        x: new THREE.Vector3(),
        v: new THREE.Vector3(),
        init: false,
      }));
    this.extraChains = []; // hair / cloth chains registered by hair.js / clothes.js
    this.scale = 1;
  }

  /** Call after the final pose has been written and world matrices updated. */
  update(dt) {
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (const s of this.springs) {
      const b = s.bone;
      b.updateWorldMatrix(true, false);
      _w.setFromMatrixPosition(b.matrixWorld); // where the pose wants it
      if (!s.init || s.x.distanceTo(_w) > 1) {
        s.x.copy(_w);
        s.v.set(0, 0, 0);
        s.init = true;
      }
      for (let i = 0; i < n; i++) {
        s.v.x += (s.k * (_w.x - s.x.x) - s.c * s.v.x) * h;
        s.v.y += (s.k * (_w.y - s.x.y) - s.c * s.v.y + 0) * h;
        s.v.z += (s.k * (_w.z - s.x.z) - s.c * s.v.z) * h;
        s.x.addScaledVector(s.v, h);
      }
      // Lag → offset (world), amplified and clamped, then into the parent's space.
      _off.subVectors(s.x, _w).multiplyScalar(s.gain * this.scale);
      const L = _off.length();
      const max = s.travel * this.scale;
      if (L > max) {
        _off.multiplyScalar(max / L);
        // Clamp the spring state too so it does not keep accumulating beyond the limit.
        s.x.copy(_w).addScaledVector(_off, 1 / (s.gain * this.scale || 1));
      }
      b.parent.matrixWorld.decompose(_ps, _pq, _ps);
      _off.applyQuaternion(_pq.invert());
      b.position.add(_off);
      b.updateMatrixWorld(true);
    }
    for (const c of this.extraChains) c.update(dt);
  }
}
