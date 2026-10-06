// Procedural locomotion: walking, running, idling, turning in place, crouching, airborne.
//
// The Human never moves itself: gameplay moves `human.root` and this layer *measures* that
// motion (velocity, acceleration, turn rate) and animates on top:
//   - a gait cycle whose cadence/stride come from speed and leg length,
//   - true foot planting: a stance foot is pinned to its world contact point (it never slides)
//     with heel-strike and toe-off roll; swing feet travel on an arc to a predicted landing point
//     that is raycast against the world (setFootIK) so steps and curbs are climbed,
//   - idle re-stepping: when turning in place or drifting, feet take small corrective steps,
//   - hip bob/sway/drop, counter-rotating shoulders, arm swing, lean into acceleration (spring,
//     so starts have anticipation and stops overshoot), lean into turns,
//   - walk styles (swagger, bouncy, slouchy, stiff) and moods (drunk, tired, happy, sad,
//     angry, nervous) that reshape all of the above,
//   - breathing, weight shifts and micro-motion while idle.
// Outputs: offsets into a Pose plus world-space ankle targets for leg IK.

import * as THREE from 'three';
import { clamp, damp, lerp, smoothstep, wrapAngle } from '../../core/util.js';
import { Rng } from '../../core/rng.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();

// Style presets: multipliers/additions applied to the base gait.
const STYLES = {
  natural: {},
  swagger: { armSwing: 1.45, shoulderRoll: 2.0, hipSway: 1.6, chestUp: 0.08, cadence: 0.92, stride: 1.08, elbow: 0.15, armOut: 0.08 },
  bouncy: { bob: 2.2, lift: 1.35, cadence: 1.07, toeOff: 1.4, armSwing: 1.15 },
  slouchy: { slouch: 0.22, headDown: 0.12, armSwing: 0.5, lift: 0.6, cadence: 0.95, stride: 0.88, shuffle: 1 },
  stiff: { rot: 0.4, armSwing: 0.3, elbow: -0.15, bob: 0.6, hipSway: 0.5, cadence: 1.03 },
};

export class Locomotion {
  constructor(human) {
    this.h = human;
    const d = human.rig.dims;
    const j = d.j;
    this.s = d.s;
    this.legLen = j['thigh.L'].distanceTo(j['shin.L']) + j['shin.L'].distanceTo(j['foot.L']);
    this.hipY = j['thigh.L'].y;
    this.ankleH = j['foot.L'].y;
    this.spread = Math.abs(j['foot.L'].x);
    this.heelBack = (j['foot.L'].z - j['heel.L'].z) * 0.9;
    this.ballFwd = j['toe.L'].z - j['foot.L'].z;
    this.rng = new Rng(human.params.seed * 31 + 7);
    this.style = STYLES[human.params.walkStyle] || STYLES.natural;
    this.mood = { drunk: 0, tired: 0, happy: 0, sad: 0, angry: 0, nervous: 0, injured: 0 };
    this.intent = { speed: 0, turnRate: 0, grounded: true, crouch: 0, sprint: false };
    this.footIK = null;
    // Measured motion.
    this.prevPos = null;
    this.prevYaw = 0;
    this.vel = new THREE.Vector3();
    this.accel = new THREE.Vector3();
    this.speed = 0;
    this.yawRate = 0;
    this.yaw = 0;
    this.phase = 0;
    this.moveBlend = 0;
    this.runBlend = 0;
    this.crouch = 0;
    this.air = 0;
    this.leanSpring = { x: 0, v: 0 };
    this.sideSpring = { x: 0, v: 0 };
    this.hipsDy = 0;
    this.time = this.rng.next() * 100;
    this.shift = { t: 0, side: 0, target: 0, timer: 3 + this.rng.next() * 4 };
    this.feet = {
      L: this._foot(1),
      R: this._foot(-1),
    };
    this.initialized = false;
  }

  _foot(sx) {
    return {
      sx,
      plant: new THREE.Vector3(),
      yaw: 0,
      normal: new THREE.Vector3(0, 1, 0),
      swing: false,
      from: new THREE.Vector3(),
      fromYaw: 0,
      target: new THREE.Vector3(),
      targetYaw: 0,
      targetNormal: new THREE.Vector3(0, 1, 0),
      t: 0,
      dur: 0.4,
      lift: 0.06,
      roll: 0,
      ankle: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      toeRoll: 0,
      contact: 1,
    };
  }

  setIntent(o) {
    Object.assign(this.intent, o);
  }

  setMood(m) {
    Object.assign(this.mood, m);
  }

  // Ground query: footIK callback (x, y, z) → {y, normal} | null; default: flat at root height.
  _ground(x, yHint, z, out, nrm) {
    if (this.footIK) {
      const r = this.footIK(x, yHint, z);
      if (r) {
        out.set(x, r.y, z);
        if (r.normal) nrm.copy(r.normal);
        else nrm.set(0, 1, 0);
        return;
      }
    }
    out.set(x, this.rootPos.y, z);
    nrm.set(0, 1, 0);
  }

  /** Ideal standing position of a foot (world) for the current root transform. */
  _ideal(f, out) {
    const st = this.style;
    const wide = 1 + this.mood.drunk * 0.5 + (st.shuffle ? 0.1 : 0);
    out.set(f.sx * this.spread * wide, 0, f.sx * 0.0 + (f === this.feet.L ? 0.012 : -0.012) * this.s).applyQuaternion(this.rootQ).add(this.rootPos);
    return out;
  }

  update(dt, pose) {
    const h = this.h;
    this.time += dt;
    this.rootPos = h.root.getWorldPosition(this._rp || (this._rp = new THREE.Vector3()));
    this.rootQ = h.root.getWorldQuaternion(this._rq || (this._rq = new THREE.Quaternion()));
    const fwd = _v.set(0, 0, 1).applyQuaternion(this.rootQ);
    const yaw = Math.atan2(fwd.x, fwd.z);
    if (!this.initialized) {
      this.prevPos = this.rootPos.clone();
      this.prevYaw = yaw;
      for (const f of Object.values(this.feet)) {
        this._ideal(f, f.plant);
        this._ground(f.plant.x, f.plant.y + 0.4, f.plant.z, f.plant, f.normal);
        f.yaw = yaw;
      }
      this.initialized = true;
    }
    // --- measure motion.
    const raw = _v2.subVectors(this.rootPos, this.prevPos).divideScalar(Math.max(dt, 1e-4));
    raw.y = 0;
    if (raw.length() > 15) raw.set(0, 0, 0); // teleport
    const prevVel = this.vel.clone();
    this.vel.x = damp(this.vel.x, raw.x, 0.06, dt);
    this.vel.z = damp(this.vel.z, raw.z, 0.06, dt);
    this.accel.subVectors(this.vel, prevVel).divideScalar(Math.max(dt, 1e-4));
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    const yr = wrapAngle(yaw - this.prevYaw) / Math.max(dt, 1e-4);
    this.yawRate = damp(this.yawRate, clamp(yr, -8, 8), 0.1, dt);
    this.yaw = yaw;
    this.prevPos.copy(this.rootPos);
    this.prevYaw = yaw;
    if (this.rootPos.distanceTo(this.feet.L.plant) > 3) this.initialized = false; // teleported

    const st = this.style;
    const mood = this.mood;
    const it = this.intent;
    this.crouch = damp(this.crouch, it.crouch ? 1 : 0, 0.12, dt);
    this.air = damp(this.air, it.grounded === false ? 1 : 0, it.grounded === false ? 0.06 : 0.04, dt);
    const speed = this.speed;
    const moving = speed > 0.12 || (it.speed > 0.2 && speed > 0.05);
    this.moveBlend = damp(this.moveBlend, moving ? 1 : 0, 0.12, dt);
    this.runBlend = damp(this.runBlend, smoothstep(2.4, 3.8, speed), 0.15, dt);
    const run = this.runBlend;
    const legK = this.legLen / 0.75;
    const cadence = clamp((0.6 + 0.26 * speed / legK) * (st.cadence || 1) * (1 + mood.nervous * 0.12 - mood.tired * 0.1), 0.55, 1.75);
    const duty = lerp(0.6, 0.36, run);
    if (moving) this.phase = (this.phase + cadence * dt) % 1;

    // --- feet.
    const right = _v2.set(1, 0, 0).applyQuaternion(this.rootQ); // character's left is +X; "right" vector = +X side
    const heading = speed > 0.1 ? Math.atan2(this.vel.x, this.vel.z) : yaw;
    for (const [name, f] of Object.entries(this.feet)) {
      const local = (this.phase + (name === 'L' ? 0 : 0.5)) % 1;
      const other = name === 'L' ? this.feet.R : this.feet.L;
      if (moving) {
        // Lift when the cycle says so (and the other foot is down, so we never fly when walking).
        if (!f.swing && local >= duty && local < duty + 0.25 && (run > 0.5 || !other.swing)) this._startSwing(f, (1 - duty) / cadence, speed);
      } else if (!f.swing && !other.swing) {
        // Idle: correct posture with a small step when the foot drifted / body turned.
        const ideal = this._ideal(f, _tmpA);
        const d = Math.hypot(ideal.x - f.plant.x, ideal.z - f.plant.z);
        const yawErr = Math.abs(wrapAngle(yaw - f.yaw));
        const otherErr = Math.hypot(this._ideal(other, _tmpB).x - other.plant.x, _tmpB.z - other.plant.z) + Math.abs(wrapAngle(yaw - other.yaw)) * 0.3;
        if ((d > 0.16 * this.s || yawErr > 0.55) && d + yawErr * 0.3 >= otherErr) this._startSwing(f, 0.36, 0);
      }
      if (f.swing) {
        f.t += dt / f.dur;
        // Predict landing: under the hip at mid-stance → half a stance ahead of the root.
        const tl = Math.max(0, (1 - f.t) * f.dur);
        const stanceTravel = speed * (moving ? duty / cadence : 0);
        const hd = moving ? heading : yaw;
        const drunkN = mood.drunk * 0.09 * Math.sin(this.time * 1.7 + f.sx * 2);
        _tmpA.set(
          this.rootPos.x + this.vel.x * tl + Math.sin(hd) * stanceTravel * 0.5,
          this.rootPos.y,
          this.rootPos.z + this.vel.z * tl + Math.cos(hd) * stanceTravel * 0.5,
        );
        const sp = this.spread * (1 + mood.drunk * 0.5) * (moving ? 1 - run * 0.55 : 1) + drunkN;
        _tmpA.x += Math.cos(hd) * f.sx * sp;
        _tmpA.z += -Math.sin(hd) * f.sx * sp;
        this._ground(_tmpA.x, Math.max(f.from.y, this.rootPos.y) + 0.45, _tmpA.z, f.target, f.targetNormal);
        f.targetYaw = (moving ? heading : yaw) + f.sx * 0.1;
        if (f.t >= 1) {
          f.swing = false;
          f.plant.copy(f.target);
          f.normal.copy(f.targetNormal);
          f.yaw = f.targetYaw;
          f.t = 1;
          this.h.animator?.onFootstep?.(f === this.feet.L ? 'L' : 'R', f.plant, speed);
        }
      }
      // Pose the foot: ankle target + orientation.
      this._poseFoot(f, local, duty, moving, speed);
    }

    // --- hips: bob, sway, drop; constrained so planted feet stay reachable.
    const stride = clamp(speed / (cadence * this.legLen * 1.6), 0, 1.3);
    const bobAmp = this.s * (0.012 + 0.02 * stride) * (st.bob || 1) * (1 + mood.happy * 0.6) * this.moveBlend;
    const ph = this.phase * TAU;
    let bob = -bobAmp * Math.cos(2 * ph) * (1 - run) + bobAmp * 1.5 * Math.cos(2 * ph) * run;
    const sway = this.s * (0.016 + 0.012 * this.h.params.hips) * (st.hipSway || 1) * Math.sin(ph) * this.moveBlend * (1 - run * 0.6);
    // Idle weight shifting.
    this.shift.timer -= dt;
    if (this.shift.timer <= 0) {
      this.shift.timer = 3 + this.rng.next() * 6;
      this.shift.target = this.rng.pick([-1, -0.5, 0, 0.5, 1]);
    }
    this.shift.side = damp(this.shift.side, this.shift.target, 0.6, dt);
    const idle = 1 - this.moveBlend;
    const shiftX = this.shift.side * 0.022 * this.s * idle;
    const breath = Math.sin(this.time * TAU * (0.22 + mood.nervous * 0.15 + this.air * 0)) ;
    const crouchDrop = this.crouch * this.legLen * 0.32;
    let dy = bob - crouchDrop - (0.012 + 0.03 * stride) * this.s * this.moveBlend - this.air * 0.0 - mood.tired * 0.01;
    // Leg reach constraint (hip joints vs ankle targets).
    for (const f of Object.values(this.feet)) {
      const hipW = _tmpB.set(f.sx * this.spread, this.hipY, 0).applyQuaternion(this.rootQ).add(this.rootPos);
      const horiz = Math.hypot(f.ankle.x - hipW.x, f.ankle.z - hipW.z);
      const L = this.legLen * 0.985;
      const maxY = f.ankle.y + Math.sqrt(Math.max(0, L * L - horiz * horiz));
      dy = Math.min(dy, maxY - hipW.y);
    }
    if (this.air > 0.5) dy = this.air * 0.04;
    this.hipsDy = dy < this.hipsDy ? dy : damp(this.hipsDy, dy, 0.08, dt);
    pose.hips.y += this.hipsDy;
    pose.hips.x += sway * 1 + shiftX + mood.drunk * 0.03 * Math.sin(this.time * 0.9) * this.s;
    pose.hips.z += -this.crouch * 0.06 * this.s;

    // --- upper body.
    const rotK = st.rot ?? 1;
    const swingA = (0.16 + 0.32 * stride) * (st.armSwing || 1) * (1 + mood.happy * 0.3 - mood.sad * 0.4 - mood.tired * 0.3) * rotK * this.moveBlend;
    const twist = (0.05 + 0.08 * stride) * rotK * this.moveBlend;
    // Acceleration lean (spring → anticipation on start, overshoot on stop).
    const fwdAcc = this.accel.x * Math.sin(yaw) + this.accel.z * Math.cos(yaw);
    const fwdSpeed = this.vel.x * Math.sin(yaw) + this.vel.z * Math.cos(yaw);
    const leanTarget = clamp(fwdAcc * 0.035, -0.18, 0.22) + fwdSpeed * 0.035 + run * 0.12;
    springStep2(this.leanSpring, leanTarget, 90, 11, dt);
    const sideTarget = clamp(-this.yawRate * speed * 0.06, -0.3, 0.3);
    springStep2(this.sideSpring, sideTarget, 60, 10, dt);
    const lean = this.leanSpring.x;
    const slouch = (st.slouch || 0) + mood.sad * 0.15 + mood.tired * 0.12 + this.crouch * 0.25 - mood.happy * 0.03 - (st.chestUp || 0);
    // Hips: twist with stride, drop on the swing side, tilt forward when running.
    pose.add('hips', lean * 0.3 + run * 0.06 + this.crouch * 0.25, Math.sin(ph) * twist, -Math.sin(ph) * 0.05 * rotK * this.moveBlend * (st.hipSway || 1) - this.sideSpring.x * 0.3 + this.shift.side * 0.035 * idle);
    pose.add('spine', lean * 0.45 + slouch * 0.5, -Math.sin(ph) * twist * 0.7, this.sideSpring.x * 0.5 - this.shift.side * 0.02 * idle);
    const roll = (st.shoulderRoll || 1) * 0.6;
    pose.add('chest', lean * 0.25 + slouch * 0.5 + breath * 0.012, -Math.sin(ph) * twist * roll, this.sideSpring.x * 0.3 + mood.drunk * 0.08 * Math.sin(this.time * 1.3));
    // Head: stabilise against the body's motion and look where we're going.
    pose.add('neck', -lean * 0.4 - slouch * 0.35 + (st.headDown || 0) + mood.sad * 0.12, Math.sin(ph) * twist * 0.5, -this.sideSpring.x * 0.4);
    pose.add('head', -lean * 0.3 - slouch * 0.25 + mood.sad * 0.1 + mood.tired * 0.06, Math.sin(ph) * twist * 0.4 + this.yawRate * 0.05, -this.sideSpring.x * 0.3 + mood.drunk * 0.1 * Math.sin(this.time * 0.8));
    // Arms: relax from the bind A-pose to hanging, then swing opposite to the legs.
    const fat = this.h.params.fat;
    const hang = 0.5 - fat * 0.12 - (st.armOut || 0) - this.crouch * 0.05;
    const elbow0 = 0.22 + (st.elbow || 0) + run * 0.9 + mood.angry * 0.2;
    for (const [side, sgn] of [['L', 1], ['R', -1]]) {
      const sw = Math.sin(ph) * swingA * sgn; // left arm forward when the right leg is forward
      pose.addSymSide?.(side);
      const name = `upperarm.${side}`;
      const fwdSw = Math.max(0, sw);
      const zSign = side === 'L' ? 1 : -1;
      pose.add(name, sw + run * 0.15, 0, -hang * zSign);
      pose.add(`forearm.${side}`, elbow0 + fwdSw * 0.6 + breath * 0.01, -0.35 * zSign, 0);
      pose.add(`hand.${side}`, 0.05, 0, 0.1 * zSign);
      pose.add(`clavicle.${side}`, 0, sw * 0.08, (breath * 0.012 - slouch * 0.12) * zSign);
    }
    // Legs: crouch flexion (IK does the rest).
    // Airborne: tuck legs (feet are released from IK by the animator via `this.air`).
    if (this.air > 0.01) {
      pose.addSym('thigh', 0.45 * this.air, 0, 0);
      pose.addSym('shin', -0.75 * this.air, 0, 0);
      pose.addSym('upperarm', -0.3 * this.air, 0, -0.25 * this.air);
    }
  }

  _startSwing(f, dur, speed) {
    f.swing = true;
    f.t = 0;
    f.dur = Math.max(0.16, dur);
    f.from.copy(f.plant);
    f.fromYaw = f.yaw;
    const st = this.style;
    f.lift = this.s * (0.05 + 0.045 * Math.min(speed, 3)) * (st.lift || 1) * (1 - this.mood.tired * 0.4) * (speed < 0.05 ? 0.7 : 1);
  }

  /** Compute the ankle target and foot orientation (heel strike → flat → toe-off). */
  _poseFoot(f, local, duty, moving, speed) {
    const st = this.style;
    let roll = 0; // + heel up (pivot on the ball), − toes up (pivot on the heel)
    let pos;
    let yaw;
    let nrm;
    if (f.swing) {
      const t = f.t;
      const e = t * t * (3 - 2 * t);
      pos = _tmpC.lerpVectors(f.from, f.target, e);
      const clear = Math.max(0, f.target.y - f.from.y);
      pos.y = lerp(f.from.y, f.target.y, smoothstep(0.1, 0.75, t)) + (f.lift + clear * 1.1) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8);
      yaw = f.fromYaw + wrapAngle(f.targetYaw - f.fromYaw) * e;
      nrm = _tmpD.copy(f.normal).lerp(f.targetNormal, e).normalize();
      // Toe-off pitch decays, then the toes come up for the heel strike.
      const toeOff = 0.55 * (st.toeOff || 1) * Math.min(1, speed / 1.6);
      roll = toeOff * (1 - smoothstep(0, 0.35, t)) - 0.22 * Math.min(1, speed / 1.2) * smoothstep(0.55, 0.95, t);
      f.contact = 0;
    } else {
      pos = _tmpC.copy(f.plant);
      yaw = f.yaw;
      nrm = _tmpD.copy(f.normal);
      if (moving) {
        const u = local / duty; // 0 heel strike … 1 toe off
        const strike = -0.22 * Math.min(1, speed / 1.2) * (1 - smoothstep(0, 0.18, u));
        const off = 0.55 * (st.toeOff || 1) * Math.min(1, speed / 1.6) * smoothstep(0.62, 1.0, u);
        roll = u < 0.5 ? strike : off;
      }
      f.contact = 1;
    }
    f.roll = damp(f.roll, roll, 0.03, 1 / 60);
    // Foot frame: forward (yaw) on the ground plane given by the normal.
    const fw = _tmpE.set(Math.sin(yaw), 0, Math.cos(yaw));
    fw.addScaledVector(nrm, -fw.dot(nrm)).normalize();
    const side = _tmpF.crossVectors(nrm, fw).normalize(); // +X-ish (left)
    const ankleRest = _tmpG.copy(pos).addScaledVector(nrm, this.ankleH);
    if (Math.abs(f.roll) > 1e-4) {
      const pivot = f.roll > 0 ? _tmpH.copy(pos).addScaledVector(fw, this.ballFwd) : _tmpH.copy(pos).addScaledVector(fw, -this.heelBack);
      // Heel up = rotate about the side axis so the heel rises.
      _q.setFromAxisAngle(side, f.roll);
      ankleRest.sub(pivot).applyQuaternion(_q).add(pivot);
      fw.applyQuaternion(_q);
    }
    f.ankle.copy(ankleRest);
    // Orientation: foot bone Y axis = forward (toward the toes), Z = up (rig convention).
    const up = _tmpI.crossVectors(fw, side).normalize();
    const m = _m.makeBasis(_tmpJ.crossVectors(fw, up).normalize(), fw, up);
    f.quat.setFromRotationMatrix(m);
    f.toeRoll = f.contact && f.roll > 0 ? -f.roll : f.swing ? -0.15 * Math.sin(Math.PI * f.t) : 0;
  }
}

const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();
const _tmpD = new THREE.Vector3();
const _tmpE = new THREE.Vector3();
const _tmpF = new THREE.Vector3();
const _tmpG = new THREE.Vector3();
const _tmpH = new THREE.Vector3();
const _tmpI = new THREE.Vector3();
const _tmpJ = new THREE.Vector3();
const _m = new THREE.Matrix4();
void UP;

function springStep2(s, target, k, c, dt) {
  // Semi-implicit spring, sub-stepped for stability at low frame rates.
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    s.v += (k * (target - s.x) - c * s.v) * h;
    s.x += s.v * h;
  }
  return s.x;
}
export { springStep2 };
