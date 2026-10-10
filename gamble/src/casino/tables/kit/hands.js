// Table hands: precise, table-space control of a Human's hands for dealing, chip handling and the
// blackjack hand signals (DESIGN §20, §39).
//
// The character module's 'seated' hold pins both hands to the thighs at 0.9 weight, which would
// drag any table gesture halfway back to the lap. While installed, TableHands takes over the
// seated hold (same hips / spine / thigh pose, see anim/actions.js 'seated') and supplies its own
// hands instead: resting on the rail, or moving along timed paths in world space. One-shot
// actions (cheer, facepalm, shrug…) still play on top and win by their own weight.
// (Request for the character owner: an official `human.setSeatedHands(fn)` hook would replace
// this wrapper — see tables/PROGRESS.md.)
//
//   const hands = new TableHands(human, { tweens, seated: true, seatHeight: 0.5 });
//   hands.rest('R', worldPos);                     // where the hand idles
//   await hands.move('R', target, 0.35, { shape: 'pinch', lift: 0.04 });
//   hands.follow('R', () => card.worldPos);        // track a moving object
//   hands.release('R');                            // back to rest
//   hands.dispose();

import * as THREE from 'three';
import { clamp } from '../../../core/util.js';
import { ease } from './tween.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

/** Hand orientation in root space: fingers direction f, palm normal p (actions.js convention). */
export function orient(f, p, out = new THREE.Quaternion()) {
  const Y = new THREE.Vector3(...f).normalize();
  let Z = new THREE.Vector3(...p);
  Z.addScaledVector(Y, -Z.dot(Y)).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize();
  Z = new THREE.Vector3().crossVectors(X, Y);
  return out.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

export const ORIENT = {
  palmDown: orient([0, -0.25, 1], [0, -1, 0]),
  palmDownIn: orient([0, -0.2, 1], [0, -1, 0.15]),
  point: orient([0, -0.45, 1], [0, -1, 0]),
  sideSweep: orient([0, -0.1, 1], [1, -0.4, 0]),
  cardGrip: orient([0, -0.15, 1], [0, -1, 0.1]),
};

class Ctl {
  constructor() {
    this.pos = new THREE.Vector3(); // world target
    this.rest = null; // world rest point (Vector3) or null = no control
    this.restRot = ORIENT.palmDown;
    this.active = false; // explicit target (move / follow / set)
    this.follow = null;
    this.shape = 'relaxed';
    this.rot = ORIENT.palmDown;
    this.w = 0;
    this.cur = new THREE.Vector3();
    this.inited = false;
  }
}

export class TableHands {
  constructor(human, { tweens, seated = false, seatHeight = 0.5, reachLean = true } = {}) {
    this.h = human;
    this.tw = tweens;
    this.seated = seated;
    this.seatHeight = seatHeight;
    this.reachLean = reachLean;
    this.enabled = true;
    this.lean = 0;
    this.leanTarget = 0;
    this.yaw = 0;
    this.ctl = { L: new Ctl(), R: new Ctl() };
    const ap = human.animator?.actions;
    this.ap = ap;
    if (!ap) return;
    this._orig = ap.update;
    const self = this;
    ap.update = function (dt, pose) {
      const hold = ap.hold;
      const ours = self.enabled && self.seated && hold && hold.name === 'seated';
      if (ours) ap.hold = null;
      self._orig.call(ap, dt, pose);
      if (ours) {
        if (ap.hold === null) ap.hold = hold;
        hold.t += dt;
        self._seatedBody(pose, hold, dt);
      }
      if (self.enabled) self._apply(pose, dt);
    };
  }

  dispose() {
    if (this.ap && this._orig) this.ap.update = this._orig;
    this._orig = null;
  }

  _seatedBody(pose, hold, dt) {
    const ap = this.ap;
    const h = hold.opts?.height ?? this.seatHeight;
    const w = hold.w ?? 1;
    const drop = ap.hipY - (h + 0.07 * ap.s);
    this._drop = drop * w;
    this._back = 0.13 * ap.s * w;
    const breath = Math.sin(hold.t * 1.4) * 0.01;
    pose.hips.y += -drop * w;
    pose.hips.z += -0.13 * ap.s * w;
    pose.add('spine', (0.1 + breath) * w, 0, 0);
    pose.add('chest', (-0.02 + breath) * w, 0, 0);
    pose.add('neck', 0.12 * w, 0, 0);
    pose.addSym('thigh', 0, 0, 0.04 * w);
    void dt;
  }

  /** Rest point for a hand (world). null = leave the hand to the character module. */
  rest(side, worldPos, rot = ORIENT.palmDown) {
    const c = this.ctl[side];
    c.rest = worldPos ? (c.rest || new THREE.Vector3()).copy(worldPos) : null;
    c.restRot = rot;
  }

  /** Jump the target (still smoothed by the IK weight fade). */
  set(side, worldPos, { shape = 'relaxed', rot = ORIENT.palmDown } = {}) {
    const c = this.ctl[side];
    c.active = true;
    c.follow = null;
    c.pos.copy(worldPos);
    c.shape = shape;
    c.rot = rot;
  }

  /** Track a moving point every frame. */
  follow(side, fn, { shape = 'pinch', rot = ORIENT.cardGrip } = {}) {
    const c = this.ctl[side];
    c.active = true;
    c.follow = fn;
    c.shape = shape;
    c.rot = rot;
  }

  release(side) {
    const c = this.ctl[side];
    c.active = false;
    c.follow = null;
    c.shape = 'relaxed';
  }

  /** Where the hand currently is (world). */
  current(side, out = new THREE.Vector3()) {
    const c = this.ctl[side];
    if (c.inited) return out.copy(c.cur);
    return this.h.bones[`hand.${side}`].getWorldPosition(out);
  }

  /**
   * Move a hand to `to` (world) in `dur` seconds along a lifted arc; resolves on arrival. The hand
   * then holds there until released or moved again.
   */
  move(side, to, dur = 0.35, { shape = 'relaxed', rot = ORIENT.palmDown, lift = 0.03, e = ease.inOut } = {}) {
    const c = this.ctl[side];
    const from = this.current(side, new THREE.Vector3());
    const dest = to.clone();
    c.active = true;
    c.follow = null;
    c.shape = shape;
    c.rot = rot;
    return this.tw.to(dur, (k) => {
      c.pos.lerpVectors(from, dest, k);
      c.pos.y += 4 * lift * k * (1 - k);
    }, e);
  }

  /** Tap the felt twice at `at` (the blackjack "hit" signal). */
  async tap(side, at, n = 2) {
    const up = at.clone();
    up.y += 0.045;
    await this.move(side, up, 0.22, { shape: 'point', rot: ORIENT.point, lift: 0.02 });
    for (let i = 0; i < n; i++) {
      const down = at.clone();
      down.y += 0.012;
      await this.move(side, down, 0.09, { shape: 'point', rot: ORIENT.point, lift: 0, e: ease.in });
      await this.move(side, up, 0.12, { shape: 'point', rot: ORIENT.point, lift: 0, e: ease.out });
    }
  }

  /** Flat hand waved side to side over the cards (the "stand" signal). */
  async waveOff(side, at, across) {
    const a = at.clone().addScaledVector(across, -0.06);
    a.y += 0.06;
    const b = at.clone().addScaledVector(across, 0.06);
    b.y += 0.06;
    await this.move(side, a, 0.24, { shape: 'flat', rot: ORIENT.palmDown, lift: 0.02 });
    await this.move(side, b, 0.16, { shape: 'flat', rot: ORIENT.palmDown, lift: 0.0 });
    await this.move(side, a, 0.16, { shape: 'flat', rot: ORIENT.palmDown, lift: 0.0 });
  }

  _apply(pose, dt) {
    const root = this.h.root;
    root.updateWorldMatrix(true, false);
    _m.copy(root.matrixWorld).invert();
    let reach = 0;
    let yaw = 0;
    for (const S of ['L', 'R']) {
      const c = this.ctl[S];
      const want = c.active || c.rest ? 1 : 0;
      c.w += (want - c.w) * (1 - Math.exp(-dt * 9));
      if (c.w < 0.002) {
        c.inited = false;
        continue;
      }
      let target;
      let rot;
      let shape;
      if (c.active) {
        if (c.follow) c.pos.copy(c.follow());
        target = c.pos;
        rot = c.rot;
        shape = c.shape;
      } else if (c.rest) {
        target = c.rest;
        rot = c.restRot;
        shape = 'relaxed';
      } else {
        target = c.inited ? c.cur : this.h.bones[`hand.${S}`].getWorldPosition(_v2);
        rot = c.rot;
        shape = 'relaxed';
      }
      // Critically damped follow: paths are already smooth; this only hides target jumps.
      if (!c.inited) {
        this.h.bones[`hand.${S}`].getWorldPosition(c.cur);
        c.inited = true;
      }
      c.cur.lerp(target, 1 - Math.exp(-dt * (c.active ? 30 : 10)));
      _v.copy(c.cur).applyMatrix4(_m); // root space
      const ph = pose.hand[S];
      if (ph.w > 0.001) {
        // A one-shot action is using this hand: it wins by its own weight.
        const aw = ph.w;
        ph.pos.lerpVectors(_v, ph.pos, aw);
        ph.w = Math.max(aw, c.w);
      } else {
        ph.pos.copy(_v);
        ph.w = c.w;
        ph.shape = shape;
        ph.shapeW = c.w;
        ph.rot = rot;
      }
      // Reaching far → lean in.
      // Shoulder in root space (rest pose this early in the frame, so apply the seated drop).
      const sh = this.h.bones[`upperarm.${S}`].getWorldPosition(_v2).applyMatrix4(_m);
      if (this.seated) {
        sh.y -= this._drop || 0;
        sh.z -= this._back || 0;
      }
      const dx = _v.x - sh.x;
      const dz = _v.z - sh.z;
      const dist = Math.hypot(dx, dz, (_v.y - sh.y) * 0.6);
      if (c.active) {
        // Seated players lean a little; a standing dealer bends over the layout.
        const r = this.seated ? clamp((dist - 0.48) * 1.0, 0, 0.14) : clamp((dist - 0.4) * 1.6, 0, 0.42);
        reach = Math.max(reach, r * c.w);
        yaw += clamp(Math.atan2(dx, Math.max(0.05, dz)) * 0.25, -0.3, 0.3) * c.w;
      }
    }
    if (this.reachLean) {
      this.leanTarget = reach;
      this.lean += (this.leanTarget - this.lean) * (1 - Math.exp(-dt * 6));
      this.yaw += (yaw - this.yaw) * (1 - Math.exp(-dt * 6));
      pose.add('spine', this.lean * 0.55, this.yaw * 0.4, 0);
      pose.add('chest', this.lean * 0.45, this.yaw * 0.6, 0);
    }
    void _q;
  }
}
