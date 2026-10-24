// Procedural animation for a spider body built by body.js.
// - 8 legs, 7 segments each, solved with real leg geometry: the femur rises from the body, the knee (patella) sits
//   high, tibia + metatarsus come down and the tarsus touches the surface.
// - Tetrapod gait like real spiders: L1 R2 L3 R4 swing together, then R1 L2 R3 L4.
// - Feet are planted in the WORLD and found with raycasts, so they stick to floors, walls, ceilings and edges.
// - Body bobs, tilts to fit the feet, abdomen sways; palps twitch; fangs open on a bite; front legs "feel" when idle.
import * as THREE from 'three';
import { LEG_FRAC } from './body.js';

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _q = new THREE.Quaternion(), _bInv = new THREE.Matrix4();
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3(), _p4 = new THREE.Vector3(), _pm = new THREE.Matrix4();
const UPL = new THREE.Vector3(0, 1, 0);
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class SpiderRig {
  // probe(originWorld, dirWorld, maxDist) -> {point, normal} | null   (supplied by the world)
  constructor(root, species, probe) {
    this.root = root; this.sp = species; this.probe = probe;
    const ud = root.userData;
    this.ud = ud; this.body = ud.body;
    this.legs = ud.legs.map(L => ({
      ...L,
      foot: new THREE.Vector3(), footN: new THREE.Vector3(0, 1, 0), planted: false,
      stepping: false, t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), toN: new THREE.Vector3(0, 1, 0),
      lift: 0, idleT: Math.random() * 10, reachMax: L.T * 0.97,
    }));
    this.time = 0;
    this.vel = new THREE.Vector3();      // world velocity (m/s in zone units)
    this.lastPos = new THREE.Vector3();
    this.bob = 0; this.bodyTilt = new THREE.Quaternion();
    this.biting = 0;    // 0..1 fang open
    this.mode = 'walk'; // walk | air | dangle | molt | dead | swim | space
    this.airPose = 0;   // 0 = walking pose, 1 = legs pulled in (jump/fall)
    this.excite = 0;    // makes palps/legs twitch more (hunting)
    this.gaitScale = 1;
    this.initDone = false;
    this.deadT = 0;
  }

  get scale() { return this.root.scale.x; }

  // put every foot at its resting spot on the surface right away (after teleports / spawning)
  snapFeet() {
    this.root.updateMatrixWorld(true);
    for (const L of this.legs) {
      const hit = this._findFoot(L, 0);
      if (hit) { L.foot.copy(hit.point); L.footN.copy(hit.normal); L.planted = true; }
      else { L.foot.copy(_v1.copy(L.rest)).applyMatrix4(this.root.matrixWorld); L.planted = false; }
      L.stepping = false; L.lift = 0;
    }
    this.lastPos.copy(this.root.position);
    this.initDone = true;
  }

  // where this leg wants to stand right now (world), searching the surface
  _findFoot(L, lead) {
    const s = this.scale;
    const w = this.root.matrixWorld;
    const up = _v4.set(0, 1, 0).transformDirection(w);
    // ideal point = resting spot + a little ahead in the direction we're moving
    const ideal = _v1.copy(L.rest).applyMatrix4(w);
    if (lead > 0) ideal.addScaledVector(this.vel, lead);
    if (!this.probe) return null;
    // 1) straight down along the body's up
    const o = _v2.copy(ideal).addScaledVector(up, s * 0.6);
    let best = this.probe(o, _v3.copy(up).negate(), s * 1.4);
    // 2) from the hip outward toward the ideal point (catches walls in front: concave corners)
    const hipW = _v2.copy(L.hip).applyMatrix4(w);
    const toIdeal = _v3.copy(ideal).sub(hipW); const dl = toIdeal.length();
    if (dl > 1e-9) {
      toIdeal.divideScalar(dl);
      const h2 = this.probe(hipW, toIdeal, dl * 1.1);
      if (h2 && (!best || h2.point.distanceToSquared(ideal) < best.point.distanceToSquared(ideal) * 0.8)) best = h2;
    }
    // 3) wrap around a convex edge: from below the ideal point back toward under the body
    if (!best) {
      const below = _v2.copy(ideal).addScaledVector(up, -s * 0.35);
      const back = _v3.copy(this.root.position).sub(ideal).projectOnPlane(up).normalize();
      best = this.probe(below.addScaledVector(back, -s * 0.2), back, s * 1.0);
    }
    if (!best) return null;
    // too far for the leg to reach = no foothold
    const hip = _v2.copy(L.hip).applyMatrix4(w);
    if (best.point.distanceTo(hip) > L.reachMax * s * 1.05) return null;
    return { point: best.point.clone(), normal: best.normal.clone() };
  }

  // speedBL = how fast we move in body lengths per second (drives step timing)
  update(dt, speedBL = 0) {
    if (!this.initDone) this.snapFeet();
    this.time += dt;
    const s = this.scale;
    // velocity from position change (world units/s)
    if (dt > 0) {
      _v1.copy(this.root.position).sub(this.lastPos).divideScalar(Math.max(dt, 1e-4));
      if (_v1.length() > s * 80) _v1.set(0, 0, 0); // teleport: ignore
      this.vel.lerp(_v1, 1 - Math.exp(-12 * dt));
      this.lastPos.copy(this.root.position);
    }
    this.root.updateMatrixWorld(true);
    const w = this.root.matrixWorld;
    _inv.copy(w).invert();
    const speed = this.vel.length() / Math.max(s, 1e-9); // body lengths / s
    const sizeSlow = Math.pow(Math.max(s, 1e-6) / 0.006, 0.06);
    const stepDur = Math.min(0.32, Math.max(0.05, 0.2 * sizeSlow / (1 + 0.16 * speed))) * this.gaitScale;
    const thresh = Math.max(0.06, 0.1 + 0.022 * speed);   // body lengths of drift before a foot steps

    if (this.mode === 'walk' || this.mode === 'swim') {
      this.airPose = Math.max(0, this.airPose - dt * 6);
      // which group is allowed to lift: the one whose feet are worst, but only when the other group is down
      let busy = [0, 0], err = [0, 0];
      const ideals = [];
      for (const L of this.legs) {
        if (L.stepping) busy[L.group]++;
        const f = this._findFoot(L, stepDur * 0.9);
        ideals.push(f);
        if (f && L.planted) err[L.group] += L.foot.distanceTo(f.point) / s;
        else if (f && !L.planted) err[L.group] += 1;
      }
      for (let i = 0; i < this.legs.length; i++) {
        const L = this.legs[i], f = ideals[i];
        if (L.stepping) {
          if (f) { L.to.lerp(f.point, 0.35); L.toN.lerp(f.normal, 0.35).normalize(); }
          L.t += dt / stepDur;
          if (L.t >= 1) { L.stepping = false; L.foot.copy(L.to); L.footN.copy(L.toN); L.planted = true; L.lift = 0; if (this.onStep) this.onStep(L); }
          else {
            const e = L.t * L.t * (3 - 2 * L.t);
            L.foot.lerpVectors(L.from, L.to, e);
            L.lift = Math.sin(Math.PI * L.t) * s * (0.07 + 0.012 * Math.min(speed, 12));
            L.footN.lerpVectors(L.footN, L.toN, e).normalize();
          }
          continue;
        }
        if (!f) { // nothing to stand on: dangle the leg toward its rest pose
          if (L.planted && L.foot.distanceTo(_v1.copy(L.rest).applyMatrix4(w)) > s * 0.7) L.planted = false;
          if (!L.planted) L.foot.lerp(_v1.copy(L.rest).applyMatrix4(w).addScaledVector(_v2.set(0, 1, 0).transformDirection(w), s * 0.05), 1 - Math.exp(-10 * dt));
          continue;
        }
        const d = L.planted ? L.foot.distanceTo(f.point) / s : 9;
        const other = 1 - L.group;
        const allowed = busy[other] === 0 && (err[L.group] >= err[other] * 0.7 || speed < 0.3);
        if ((d > thresh && allowed) || d > thresh * 3.2 || !L.planted) {
          L.stepping = true; L.t = 0; L.from.copy(L.foot); L.to.copy(f.point); L.toN.copy(f.normal);
          busy[L.group]++;
        }
      }
    } else if (this.mode === 'air' || this.mode === 'dangle' || this.mode === 'space') {
      // legs pulled in (jump) or spread (falling / floating)
      this.airPose = Math.min(1, this.airPose + dt * 5);
      for (const L of this.legs) { L.planted = false; L.stepping = false; }
    }

    // ---- body height / tilt from the planted feet (in body space)
    let planted = 0; const avg = _v3.set(0, 0, 0);
    let front = 0, back = 0, left = 0, right = 0, nf = 0, nb = 0, nl = 0, nr = 0;
    for (const L of this.legs) {
      if (!L.planted && !L.stepping) continue;
      const p = _v1.copy(L.foot).applyMatrix4(_inv);
      planted++; avg.add(p);
      if (L.pair <= 1) { front += p.y; nf++; } else { back += p.y; nb++; }
      if (L.side > 0) { left += p.y; nl++; } else { right += p.y; nr++; }
    }
    let targetBob = 0, pitch = 0, roll = 0;
    if (planted >= 3) {
      avg.divideScalar(planted);
      targetBob = Math.max(-0.12, Math.min(0.12, avg.y));
      if (nf && nb) pitch = Math.atan2(front / nf - back / nb, 0.7) * 0.55;
      if (nl && nr) roll = Math.atan2(left / nl - right / nr, 0.6) * 0.45;
    }
    const gaitBob = this.mode === 'walk' ? Math.sin(this.time * Math.PI * 2 / Math.max(stepDur * 2, 0.08)) * 0.008 * Math.min(1, speed / 3) : 0;
    this.bob += (targetBob + gaitBob - this.bob) * (1 - Math.exp(-14 * dt));
    this.body.position.y = this.bob;
    const tq = _q.setFromEuler(new THREE.Euler(-pitch, 0, roll));
    this.body.quaternion.slerp(tq, 1 - Math.exp(-8 * dt));
    // abdomen sways and breathes
    const ab = this.ud.abPivot;
    const sway = Math.sin(this.time * 2.2) * 0.02 + Math.sin(this.time * 7.1) * 0.006 * Math.min(1, speed / 4);
    ab.rotation.set(-0.03 + Math.sin(this.time * 1.3) * 0.015 - Math.min(0.12, speed * 0.01), sway, sway * 0.4);
    const breathe = 1 + Math.sin(this.time * 1.7) * 0.006;
    this.ud.abMesh.scale.set(breathe, breathe, 1);

    // ---- solve every leg
    this.body.updateMatrixWorld(true);
    const bInv = _bInv.copy(this.body.matrixWorld).invert();
    for (const L of this.legs) this._solveLeg(L, bInv, dt, speed);
    // ---- palps + fangs
    this._palps(dt, speed);
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? 1 : -1;
      const open = this.biting;
      this.ud.fangs[i].rotation.set(-0.2 * open, 0, sx * 0.9 * open);
      this.ud.chel[i].rotation.z = sx * 0.12 * open;
    }
    this.biting = Math.max(0, this.biting - dt * 2.5);
  }

  _solveLeg(L, bInv, dt, speed) {
    // everything in BODY space (the body group can bob/tilt). Own scratch vectors: _place() uses others.
    const S = this._S || (this._S = Array.from({ length: 14 }, () => new THREE.Vector3()));
    const hip = L.hip;
    const upW = S[0].set(0, 1, 0);
    const foot = S[1].copy(L.foot).applyMatrix4(bInv);
    if (L.lift > 0) { const n = S[2].copy(L.footN).transformDirection(bInv); foot.addScaledVector(n, L.lift / this.scale); }
    // air pose: legs fold up toward the body (jump) / reach out and paddle (fall, float)
    if (this.airPose > 0.001 && !L.planted) {
      const a = this.airPose;
      const tuck = S[2].copy(L.rest).sub(hip).multiplyScalar(this.mode === 'air' ? 0.55 : 0.95).add(hip);
      tuck.y = this.mode === 'air' ? hip.y - 0.02 : hip.y - 0.08 + Math.sin(this.time * 9 + L.pair) * 0.03;
      foot.lerp(tuck, a);
    }
    // idle: front legs lift and tap ("feeling" the world), more when excited
    if (L.pair === 0 && L.planted && !L.stepping && speed < 0.4) {
      L.idleT += dt * (0.6 + this.excite * 2);
      const tap = Math.max(0, Math.sin(L.idleT * (L.side > 0 ? 1.3 : 1.1)));
      foot.y += tap * tap * 0.05 * (0.4 + this.excite);
      foot.z += tap * 0.02;
    }
    const segs = L.segs;
    const lc = segs[0].len, lt0 = segs[1].len, lf = segs[2].len, lp = segs[3].len, lti = segs[4].len, lm = segs[5].len, lta = segs[6].len;
    // horizontal direction hip -> foot
    const d = S[3].set(foot.x - hip.x, 0, foot.z - hip.z);
    let dh = d.length();
    if (dh < 1e-5) { d.set(L.rest.x - hip.x, 0, L.rest.z - hip.z); dh = Math.max(d.length(), 1e-6); }
    d.divideScalar(dh);
    // coxa: short, out and slightly down
    const c0 = S[4].copy(hip);
    const c1 = S[5].copy(c0).addScaledVector(d, lc * 0.94).addScaledVector(upW, -lc * 0.25);
    // trochanter continues along d, a little up
    const c2 = S[6].copy(c1).addScaledVector(d, lt0 * 0.85).addScaledVector(upW, lt0 * 0.4);
    // ankle (top of the metatarsus): above + inward of the foot; steeper when the foot is close
    const reach = Math.hypot(foot.x - c2.x, foot.z - c2.z);
    const maxR = lf + lp + lti + (lm + lta) * 0.7;
    const k = Math.min(1, Math.max(0, reach / maxR));
    const phi = 1.35 - 0.85 * k;                 // ~77deg tucked in, ~29deg stretched out
    const lmt = lm + lta * 0.9;
    const ankle = S[7].copy(foot).addScaledVector(d, -lmt * Math.cos(phi)).addScaledVector(upW, lmt * Math.sin(phi));
    // two-bone IK c2 -> knee -> ankle; femur = lf, patella+tibia = lp + lti; the knee bends UP
    const a = lf, b = lp + lti;
    const toA = S[8].subVectors(ankle, c2);
    let D = toA.length();
    if (D < 1e-6) { toA.copy(d); D = 1e-6; } else toA.divideScalar(D);
    D = Math.min(Math.max(D, Math.abs(a - b) + 1e-4), a + b - 1e-4);
    const cosA = (a * a + D * D - b * b) / (2 * a * D);
    const angA = Math.acos(Math.min(1, Math.max(-1, cosA)));
    const wv = S[9].copy(upW).addScaledVector(d, 0.25);
    wv.addScaledVector(toA, -wv.dot(toA));
    if (wv.lengthSq() < 1e-8) wv.copy(d);
    wv.normalize();
    const knee = S[10].copy(c2).addScaledVector(toA, Math.cos(angA) * a).addScaledVector(wv, Math.sin(angA) * a);
    // the ankle actually used = where the IK chain ends (if the target was out of reach, it falls short)
    const ka = S[11].subVectors(ankle, knee); const kal = ka.length();
    if (kal > 1e-6) ka.divideScalar(kal); else ka.copy(d);
    const ankleR = S[12].copy(knee).addScaledVector(ka, b);
    const patEnd = S[13].copy(knee).addScaledVector(ka, lp).addScaledVector(upW, lp * 0.06);
    // metatarsus + tarsus from the ankle down to the foot; the tarsus flattens toward the surface
    const tStart = S[2].copy(ankleR).lerp(foot, lm / (lm + lta)).addScaledVector(upW, lta * 0.15);
    this._place(segs[0], c0, c1, d);
    this._place(segs[1], c1, c2, d);
    this._place(segs[2], c2, knee, d);
    this._place(segs[3], knee, patEnd, d);
    this._place(segs[4], patEnd, ankleR, d);
    this._place(segs[5], ankleR, tStart, d);
    this._place(segs[6], tStart, foot, d);
  }

  // orient a +Y segment mesh from a to b; keep its +Z (top) side pointing up-ish
  _place(seg, a, b, side) {
    const y = _p1.subVectors(b, a); const len = y.length();
    if (len < 1e-7) return; y.divideScalar(len);
    const x = _p2.crossVectors(y, UPL);
    if (x.lengthSq() < 1e-6) x.crossVectors(y, side);
    x.normalize();
    const z = _p3.crossVectors(x, y).normalize();
    _pm.makeBasis(x, y, z);
    // segments keep their real length; stretch only a little if the IK clamps (hides gaps)
    const sy = Math.min(1.15, Math.max(0.85, len / seg.len));
    _pm.scale(_p4.set(1, sy, 1));
    _pm.setPosition(a);
    seg.mesh.matrix.copy(_pm);
    seg.mesh.matrixWorldNeedsUpdate = true;
  }

  _palps(dt, speed) {
    const t = this.time;
    for (const P of this.ud.palps) {
      const s = P.side, ex = this.excite;
      const tw = Math.sin(t * (2.5 + ex * 6) + s) * (0.12 + ex * 0.25);
      const segs = P.segs;
      segs[0].rotation.set(1.2 + tw * 0.5, 0, s * 0.35);
      segs[1].rotation.set(0.5 + tw * 0.3, 0, 0);
      segs[2].rotation.set(0.35 + tw * 0.4, 0, -s * 0.1);
      segs[3].rotation.set(0.3 - tw * 0.3, 0, 0);
      segs[4].rotation.set(0.35 + tw * 0.2 + this.biting * 0.6, 0, 0);
    }
  }

  bite() { this.biting = 1; }
}
