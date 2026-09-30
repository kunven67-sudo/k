// Climbing the lab ladder: real hand-over-hand climbing, no cutscene.
// While climbing, the body moves along the ladder (W up, S down) and the limbs
// are placed by IK on the actual rungs: each hand/foot stays planted on its rung
// and then swings in a small arc to the next one, left hand with right foot,
// right hand with left foot, like a real person. At the top you climb out
// through the hatch; from the bedroom you can climb back down.
import * as THREE from 'three';
import { solveTwoBone } from './engine/anim.js';

const SPEED = 0.55;         // m/s up/down (a calm real climbing speed)
const STANDOFF = 0.36;      // body center distance from the rungs
const EXIT_TIME = 1.1;      // seconds to climb out over the top
const _v = new THREE.Vector3();

const smooth = (t) => t * t * (3 - 2 * t);

export class LadderClimb {
  // ladder: THREE.Group with userData.rungs (local y) — rails along X, climber on its -Z side
  constructor(player, ladder, { topFloorY }) {
    this.player = player;
    this.ladder = ladder;
    this.rungs = ladder.userData.rungs.slice();
    this.spacing = this.rungs[1] - this.rungs[0];
    this.topFloorY = topFloorY;
    this.active = false;
    this.mode = null;       // 'climb' | 'exitTop' | 'enterTop' | 'enterBottom'
    this.feetY = 0;
    this.t = 0;
    this.limbs = {};
  }

  // world positions of the ladder frame
  get base() { return this.ladder.getWorldPosition(new THREE.Vector3()); }
  climbPos(feetY) { const b = this.base; return new THREE.Vector3(b.x, feetY, b.z - STANDOFF); }
  topStandPos() { const b = this.base; return new THREE.Vector3(b.x, this.topFloorY, b.z + 0.55); }
  get maxFeet() { return this.topFloorY - 0.95; } // hands reach the rail tops here

  // can the player start climbing from where they stand?
  prompt() {
    if (this.active) return null;
    const f = this.player.feet;
    const b = this.base;
    const dx = f.x - b.x;
    if (Math.abs(f.y - 0) < 0.3 && Math.abs(dx) < 0.6 && f.z < b.z && b.z - f.z < 1.0) return 'bottom';
    if (Math.abs(f.y - this.topFloorY) < 0.3 && Math.abs(dx) < 0.7 && f.z > b.z - 0.1 && f.z - b.z < 1.1) return 'top';
    return null;
  }

  start(where) {
    const p = this.player;
    this.active = true;
    p.frozen = true;
    p.velocity.set(0, 0, 0);
    this.from = p.feet.clone();
    this.fromYaw = p.bodyYaw;
    this.t = 0;
    if (where === 'bottom') {
      this.mode = 'enterBottom';
      this.feetY = 0.0;
    } else {
      this.mode = 'enterTop';
      this.feetY = this.maxFeet;
    }
  }

  stop(finalFeet) {
    const p = this.player;
    this.active = false;
    this.mode = null;
    p.frozen = false;
    this.setFeet(finalFeet);
  }

  setFeet(v) {
    const p = this.player;
    const center = { x: v.x, y: v.y + p.body.height / 2, z: v.z };
    p.body.body.setTranslation(center, true);
    p.body.body.setNextKinematicTranslation(center);
    p.prevPos.copy(p.currPos);
    p.currPos.set(center.x, center.y, center.z);
  }

  // facing the ladder = looking +Z = yaw PI
  faceLadder(k) {
    const p = this.player;
    let d = Math.PI - p.bodyYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.bodyYaw += d * k;
  }

  fixedUpdate(dt, { jump = false } = {}) {
    const p = this.player;
    const inp = p.input;
    if (this.mode === 'enterBottom' || this.mode === 'enterTop') {
      this.t += dt / (this.mode === 'enterTop' ? EXIT_TIME : 0.45);
      const k = smooth(Math.min(1, this.t));
      const target = this.climbPos(this.feetY);
      if (this.mode === 'enterTop') {
        // turn around, step over the top and lower yourself onto the rungs
        const mid = new THREE.Vector3(target.x, this.topFloorY + 0.05, (this.from.z + target.z) / 2);
        const a = this.from.clone().lerp(mid, Math.min(1, k * 2));
        const pos = k < 0.5 ? a : mid.clone().lerp(target, (k - 0.5) * 2);
        this.setFeet(pos);
      } else {
        this.setFeet(this.from.clone().lerp(target, k));
      }
      this.faceLadder(Math.min(1, k * 1.5));
      if (this.t >= 1) { this.mode = 'climb'; }
      return;
    }
    if (this.mode === 'exitTop') {
      this.t += dt / EXIT_TIME;
      const k = smooth(Math.min(1, this.t));
      const start = this.climbPos(this.maxFeet);
      const end = this.topStandPos();
      // up first (pulling on the rails), then forward over the edge
      const up = new THREE.Vector3(start.x, this.topFloorY + 0.03, start.z);
      const pos = k < 0.55 ? start.clone().lerp(up, k / 0.55) : up.clone().lerp(end, (k - 0.55) / 0.45);
      this.setFeet(pos);
      if (this.t >= 1) this.stop(end);
      return;
    }
    // climbing
    const mv = inp.moveVector();
    const dir = Math.abs(mv.y) > 0.2 ? Math.sign(mv.y) : 0;
    const before = this.feetY;
    this.feetY = THREE.MathUtils.clamp(this.feetY + dir * SPEED * p.scale * dt, 0, this.maxFeet);
    this.climbSpeed = (this.feetY - before) / dt;
    this.setFeet(this.climbPos(this.feetY));
    this.faceLadder(1);
    // off the bottom: stepping backward onto the floor
    if (dir < 0 && this.feetY <= 0.001) {
      const b = this.base;
      this.stop(new THREE.Vector3(b.x, 0, b.z - STANDOFF - 0.25));
      return;
    }
    // at the top and still going up: climb out
    if (dir > 0 && this.feetY >= this.maxFeet - 0.001) { this.mode = 'exitTop'; this.t = 0; }
    // jump off
    if (jump && this.mode === 'climb') {
      this.active = false;
      this.mode = null;
      p.frozen = false;
      p.velocity.set(0, 1.5, -1.5);
      p.grounded = false;
    }
  }

  // ---- limb placement (after the animation mixer)

  // for a limb stepping one rung at a time: rung index + 0..1 swing progress
  limbStep(offset) {
    const u = (this.feetY + offset - this.rungs[0]) / this.spacing;
    const k = Math.floor(u);
    const f = u - k;
    const swingStart = 0.55; // planted for 55% of the cycle, then moves to the next rung
    const s = f < swingStart ? 0 : smooth((f - swingStart) / (1 - swingStart));
    const idx = THREE.MathUtils.clamp(k, 0, this.rungs.length - 1);
    const next = THREE.MathUtils.clamp(k + 1, 0, this.rungs.length - 1);
    return { from: this.rungs[idx], to: this.rungs[next], s };
  }

  applyIK() {
    if (!this.active) return;
    const ch = this.player.character;
    const b = this.base;
    const B = ch.bones;
    ch.root.updateMatrixWorld(true);
    let weight = 1;
    if (this.mode === 'enterBottom' || this.mode === 'enterTop') weight = smooth(Math.min(1, this.t));
    if (this.mode === 'exitTop') weight = 1 - smooth(Math.min(1, this.t * 1.4));
    if (weight <= 0.001) return;
    const half = this.spacing / 2;
    const top = this.rungs[this.rungs.length - 1];
    const limbs = [
      // [upper, lower, end, x offset, height offset over the feet, isHand]
      ['L_UpperArm', 'L_Forearm', 'L_Hand', -0.17, 1.42, true],
      ['R_UpperArm', 'R_Forearm', 'R_Hand', 0.17, 1.42 + half, true],
      ['R_Thigh', 'R_Calf', 'R_Foot', 0.1, 0.02, false],
      ['L_Thigh', 'L_Calf', 'L_Foot', -0.1, 0.02 + half, false],
    ];
    // facing +Z, the character's left side is +X
    for (const [u, l, e, xo, ho, hand] of limbs) {
      const upper = B[`Bip01_${u}`];
      const lower = B[`Bip01_${l}`];
      const end = B[`Bip01_${e}`];
      if (!upper || !lower || !end) continue;
      const st = this.limbStep(ho);
      let y = THREE.MathUtils.lerp(st.from, st.to, st.s);
      // hands above the last rung hold the rail tops
      if (hand) y = Math.min(y, top + 0.9);
      const lift = Math.sin(st.s * Math.PI) * (hand ? 0.1 : 0.12); // arc away from the ladder while moving
      const side = u.startsWith('L') ? 1 : -1;
      // wrist just below/behind the rung (palm wraps it); ankle above/behind (ball of the foot on it)
      const target = _v.set(b.x + Math.abs(xo) * side, b.y + y + (hand ? -0.02 : 0.09), b.z - (hand ? 0.06 : 0.1) - lift);
      const shoulder = upper.getWorldPosition(new THREE.Vector3());
      const pole = hand
        ? shoulder.clone().add(new THREE.Vector3(side * 0.6, -0.6, -0.4))   // elbows out and down
        : shoulder.clone().add(new THREE.Vector3(side * 0.1, 0.4, 0.8));    // knees toward the ladder
      solveTwoBone(upper, lower, end, target.clone(), weight, pole);
    }
  }
}
