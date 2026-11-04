// THE MASK - a copy of you: the hooded body (KayKit Rogue_Hooded, CC0) wearing your mask and your gloves, replaying
// a recording of you (head + both hands + what you held + when you fired). Arms reach your exact hand spots with
// stretchy cartoon arms (two-bone IK), the body walks under your head with the right walk animation.
import * as THREE from 'three';
import { G, damp, clamp, rand, unlock, mergeStatic, emit } from './game.js';
import { world, CANNON, GROUP } from './physics.js';
import { makeBody } from './chars.js';
import { ghostify } from './toon.js';
import { buildMask } from './mask.js';
import { buildHand } from './hands.js';
import { audio } from './audio.js';
import { fx } from './fx.js';
import { mountGlove, mountGadget, buildGadgetModel, GADGET_IDS } from './mounts.js';

export const COPY_SCALE = 0.85;
const FACE_H = 1.662 * COPY_SCALE;                        // face height when standing (m)
const FACE_FROM_PIVOT = new THREE.Vector3(0, 0.421, 0.52).multiplyScalar(COPY_SCALE); // face vs head bone
const GLOVE_SCALE = 1.45;
export const FRAME_HZ = 30, F = 27; // floats per frame, see loop.js
export const COLORS = [0x3fd0c4, 0xff6f8e, 0xb47cff, 0x6fa8ff, 0xffb347, 0x8fffc8, 0xff8f5a, 0xe8e46a, 0xd17cff, 0x5ae0ff, 0xff5ad1, 0xa8ff5a];

const Y = new THREE.Vector3(0, 1, 0), FLIP = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
let rest = null; // head bone rest rotation (relative to the body)

function measure(body) {
  body.root.updateMatrixWorld(true);
  const rootQ = body.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const headQ = rootQ.clone().multiply(body.bones.head.getWorldQuaternion(new THREE.Quaternion()));
  return { headQ };
}

/* two-bone IK with stretch: a = upper arm, b = forearm, c = wrist. pole = where the elbow should point */
function ik(a, b, c, target, pole, maxStretch = 2.2) {
  const A = a.getWorldPosition(new THREE.Vector3()), B = b.getWorldPosition(new THREE.Vector3()), C = c.getWorldPosition(new THREE.Vector3());
  const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
  const toT = _v.subVectors(target, A); const d = Math.max(1e-4, toT.length());
  let s = 1;
  if (d > (l1 + l2) * 0.98) s = Math.min(maxStretch, d / ((l1 + l2) * 0.98));
  a.scale.set(1, s, 1); c.scale.set(1, 1 / s, 1);
  const L1 = l1 * s, L2 = l2 * s, dc = Math.min(d, (L1 + L2) * 0.999);
  const dir = toT.clone().divideScalar(d);
  const cosA = clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  const bend = _v2.subVectors(pole, A); bend.addScaledVector(dir, -bend.dot(dir));
  if (bend.lengthSq() < 1e-6) bend.set(0, -1, 0); bend.normalize();
  const elbow = A.clone().addScaledVector(dir, cosA * L1).addScaledVector(bend, sinA * L1);
  rotateBoneTo(a, B, A, elbow);
  a.updateMatrixWorld(true);
  const B2 = b.getWorldPosition(new THREE.Vector3()), C2 = c.getWorldPosition(new THREE.Vector3());
  rotateBoneTo(b, C2, B2, target);
  b.updateMatrixWorld(true);
}
// turn `bone` so the point `cur` (world) swings around `pivot` toward `want`
function rotateBoneTo(bone, cur, pivot, want) {
  const from = _v3.subVectors(cur, pivot).normalize(), to = new THREE.Vector3().subVectors(want, pivot).normalize();
  const delta = _q.setFromUnitVectors(from, to);
  const wq = bone.getWorldQuaternion(new THREE.Quaternion());
  const pq = bone.parent.getWorldQuaternion(_q2);
  bone.quaternion.copy(pq.invert().multiply(delta.multiply(wq)));
}

export class Copy {
  constructor(rec, color) {
    this.kind = 'copy'; this.rec = rec; this.color = color;
    this.b = makeBody('hooded');
    if (!rest) rest = measure(this.b);
    ghostify(this.b.root, color); this.fades = [this.b.root.userData.ghost.fade];
    this.b.root.scale.setScalar(COPY_SCALE);
    this.group = new THREE.Group(); this.group.name = 'copy';
    this.root = new THREE.Group(); this.root.add(this.b.root); this.root.userData.ent = this; this.group.add(this.root);
    // the mask on its face (same mask as yours, merged into a few meshes, clock hands still move)
    this.b.root.updateMatrixWorld(true);
    const mask = buildMask(); mergeStatic(mask);
    mask.position.set(0, 1.662, 0.52); mask.scale.setScalar(0.616 / 0.172);
    this.b.root.add(mask); this.b.root.updateMatrixWorld(true);
    this.b.bones.head.attach(mask);
    ghostify(mask, color); this.fades.push(mask.userData.ghost.fade);
    mask.traverse((o) => { if (o.isMesh) o.material.opacity = 0.97; });
    this.mask = mask;
    // gloves + held gadgets
    this.hands = [0, 1].map((i) => {
      const obj = new THREE.Group();
      const glove = buildHand(i ? 'right' : 'left'); mountGlove(glove, i, GLOVE_SCALE); ghostify(glove, color); this.fades.push(glove.userData.ghost.fade); obj.add(glove);
      this.group.add(obj);
      const body = new CANNON.Body({ mass: 1, type: CANNON.Body.KINEMATIC, shape: new CANNON.Sphere(0.06 * GLOVE_SCALE), collisionFilterGroup: GROUP.HAND, collisionFilterMask: GROUP.PROP | GROUP.PERSON });
      world.addBody(body);
      return { obj, glove, body, gadgets: {}, shown: 0, prev: new THREE.Vector3(), vel: new THREE.Vector3(), cool: new Map() };
    });
    G.scene.add(this.group);
    this.yaw = 0; this.t = 0; this.lastT = 0; this.gone = false; this.goneT = 0; this.frozen = 0; this.floating = false; this.floatY = 0;
    this.size = 1; this.knock = new THREE.Vector3(); this.flinch = 0; this.anim = '';
    this.facePos = new THREE.Vector3(); this.bodyPos = new THREE.Vector3(); this.first = true;
    this.k = FACE_H / Math.max(1.0, rec.eyeH || 1.6);
    this.voice = null;
  }
  get pos() { return this.bodyPos; }

  // recorded values at time t (lerped)
  sample(t, out) {
    const r = this.rec, n = r.frames.length / F;
    const f = clamp(t * FRAME_HZ, 0, n - 1.001), i = Math.floor(f), u = f - i, a = i * F, b = Math.min(n - 1, i + 1) * F, d = r.frames;
    for (let k = 0; k < F; k++) out[k] = d[a + k] + (d[b + k] - d[a + k]) * u;
    // quats: proper slerp
    for (const o of [3, 10, 19]) {
      _q.set(d[a + o], d[a + o + 1], d[a + o + 2], d[a + o + 3]); _q2.set(d[b + o], d[b + o + 1], d[b + o + 2], d[b + o + 3]);
      _q.slerp(_q2, u); out[o] = _q.x; out[o + 1] = _q.y; out[o + 2] = _q.z; out[o + 3] = _q.w;
    }
    out[25] = d[a + 25]; out[26] = d[a + 26]; // held gadget: no blending
    return out;
  }

  update(dt, t) {
    if (this.frozen) { this.frozen -= dt; if (this.frozen <= 0) { this.frozen = 0; this.setTint(0); audio.play('unfreeze', this.facePos, 0.5); } else return; }
    if (this.gone) { this.goneT -= dt; if (this.goneT <= 0 && this.goneT > -50) this.comeBack(); return; }
    const jumped = Math.abs(t - this.lastT) > 0.5 || this.first;
    const prevT = this.lastT; this.lastT = t; this.t = t;
    const s = this.sample(t, this.buf || (this.buf = new Float32Array(F)));
    const s2 = this.sample(Math.max(0, t - 0.1), this.buf2 || (this.buf2 = new Float32Array(F)));
    const size = this.size;

    // head + where the body faces
    const H = new THREE.Vector3(s[0], s[1], s[2]); // (not a shared temp: ik() below reuses those)
    const Qc = new THREE.Quaternion(s[3], s[4], s[5], s[6]);
    const Qm = Qc.clone().multiply(FLIP); // camera looks down -Z, the body faces +Z
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(Qm); fwd.y = 0;
    const want = fwd.lengthSq() > 1e-4 ? Math.atan2(fwd.x, fwd.z) : this.yaw;
    let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (jumped) this.yaw = want; else this.yaw += dy * Math.min(1, dt * (Math.abs(dy) > 1.0 ? 8 : 3));
    this.floatY = damp(this.floatY, this.floating ? 1.1 + Math.sin(G.t * 1.3) * 0.08 : 0, 2, dt);
    const lift = this.floatY;
    const face = new THREE.Vector3(H.x, H.y * this.k * size + lift, H.z).add(this.knock);
    this.knock.multiplyScalar(Math.exp(-5 * dt));

    // root: put the body under the head so the face lands on `face`
    const off = FACE_FROM_PIVOT.clone().multiplyScalar(size).applyQuaternion(Qm);
    this.root.position.set(face.x - off.x, lift, face.z - off.z);
    this.root.quaternion.setFromAxisAngle(Y, this.yaw);
    this.root.scale.setScalar(size);

    // walk animation from how fast the head moved
    const vel = _v3.set(s[0] - s2[0], 0, s[2] - s2[2]).multiplyScalar(10);
    if (jumped || t > this.rec.dur - 0.05) vel.set(0, 0, 0); // standing still at the end of the recording
    const sp = vel.length(), lf = vel.x * Math.sin(this.yaw) + vel.z * Math.cos(this.yaw), ls = vel.x * Math.cos(this.yaw) - vel.z * Math.sin(this.yaw);
    let anim = 'Idle', speed = 1;
    if (sp > 0.25) {
      if (lf < -0.4 * sp) { anim = 'Walking_Backwards'; speed = clamp(sp / 1.1, 0.6, 1.8); }
      else if (Math.abs(ls) > 0.75 * sp) { anim = ls > 0 ? 'Running_Strafe_Left' : 'Running_Strafe_Right'; speed = clamp(sp / 2.6, 0.4, 1.4); }
      else if (sp > 2.4) { anim = 'Running_A'; speed = clamp(sp / 3.5, 0.6, 1.5); }
      else { anim = 'Walking_A'; speed = clamp(sp / 1.2, 0.5, 1.8); }
    }
    if (this.floating) anim = 'Jump_Idle';
    this.b.play(anim, { speed: speed / Math.sqrt(size), fade: 0.25 });
    this.b.mixer.update(dt);
    this.root.updateMatrixWorld(true);

    // head bone looks where you looked
    const head = this.b.bones.head;
    const want3 = Qm.clone().multiply(rest.headQ);
    _q.copy(head.parent.getWorldQuaternion(_q2)).invert().multiply(want3);
    head.quaternion.copy(_q);
    if (this.flinch > 0) { this.flinch -= dt; head.rotateX(-this.flinch * 1.5); }
    head.updateMatrixWorld(true);
    this.mask.getWorldPosition(this.facePos);
    this.b.bones.chest.getWorldPosition(this.bodyPos);
    this.mask.userData.update && this.mask.userData.update(G.loop.clockDate, G.loop.frac);

    // gloves exactly where yours were (moved down like the face), arms stretch to reach them
    this.b.bones.handl.scale.setScalar(0.02); this.b.bones.handr.scale.setScalar(0.02);
    for (let i = 0; i < 2; i++) {
      const o = i ? 16 : 7, hd = this.hands[i];
      hd.obj.position.set(s[o], s[o + 1] - (H.y - face.y + lift) + lift, s[o + 2]).add(this.knock);
      hd.obj.quaternion.set(s[o + 3], s[o + 4], s[o + 5], s[o + 6]);
      hd.obj.scale.setScalar(size);
      hd.obj.updateMatrixWorld(true);
      hd.glove.userData.pose(s[o + 7], s[o + 8], s[o + 8] < 0.1 && s[o + 7] > 0.5);
      const wrist = hd.glove.getWorldPosition(new THREE.Vector3());
      const side = i ? 'r' : 'l';
      const sideDir = new THREE.Vector3(i ? -1 : 1, 0, 0).applyQuaternion(this.root.quaternion);
      const pole = this.b.bones['upperarm' + side].getWorldPosition(new THREE.Vector3()).addScaledVector(sideDir, 0.4).add(new THREE.Vector3(0, -0.6, 0)).addScaledVector(fwd.clone().normalize(), -0.3);
      ik(this.b.bones['upperarm' + side], this.b.bones['lowerarm' + side], this.b.bones['wrist' + side], wrist, pole);
      // held gadget
      const gi = Math.round(s[25 + i]);
      if (gi !== hd.shown) {
        for (const m of Object.values(hd.gadgets)) m.visible = false;
        if (gi > 0) { const id = GADGET_IDS[gi - 1]; if (!hd.gadgets[id]) { const m = buildGadgetModel(id); mountGadget(m, i); ghostify(m, this.color); hd.obj.add(m); hd.gadgets[id] = m; } hd.gadgets[id].visible = true; }
        hd.shown = gi;
      }
      // punches: the glove moves, things near it get hit
      const wp = hd.obj.position;
      if (!jumped) hd.vel.subVectors(wp, hd.prev).divideScalar(Math.max(dt, 1e-3)); else hd.vel.set(0, 0, 0);
      hd.prev.copy(wp);
      hd.body.position.set(wp.x, wp.y, wp.z); hd.body.velocity.set(hd.vel.x, hd.vel.y, hd.vel.z);
      if (hd.vel.length() > 2.3) this.punchCheck(hd, wp);
    }

    // replay trigger pulls that happened between the last frame and now
    if (!jumped && t > prevT) for (const e of this.rec.events) {
      if (e.t > prevT && e.t <= t && e.type === 'fire') {
        const hd = this.hands[e.hand], m = hd.gadgets[e.gid];
        if (!m) continue;
        m.updateMatrixWorld(true);
        const origin = m.localToWorld(m.userData.muzzle.clone());
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
        G.gadgets.fire(e.gid, origin, dir, this);
      }
    }
    if (this.voice) this.voice.move(this.facePos);
    // see-through when it's right in your face (you standing where you stood)
    if (G.player) { const d = Math.min(G.player.headPos.distanceTo(this.facePos), G.player.headPos.distanceTo(this.bodyPos)); const f = clamp((d - 0.35) / 0.6, 0.12, 1); for (const u of this.fades) u.value = f; }
    this.first = false;
  }
  punchCheck(hd, wp) {
    const sp = hd.vel.length();
    for (const p of G.people.list) {
      if (p.removed || (hd.cool.get(p) || 0) > G.t) continue;
      for (const s of p.spheres()) {
        if (s.c.distanceTo(wp) < s.r + 0.08 * GLOVE_SCALE) {
          hd.cool.set(p, G.t + 0.35);
          const dir = hd.vel.clone().normalize();
          audio.play('punch', wp, clamp(sp / 6, 0.4, 1));
          p.hurt(clamp((sp - 1.5) * 7, 6, 40), dir, wp.clone(), 'punch', this);
          if (p.state === 'tumble') p.push(dir, sp * 12);
          emit('copyHit', p, this);
          break;
        }
      }
    }
    // your past self can punch you too
    const me = G.player;
    if (me && (hd.cool.get(me) || 0) < G.t && me.headPos.distanceTo(wp) < 0.22) { hd.cool.set(me, G.t + 0.6); emit('playerHit', this, hd.vel.clone().normalize()); }
  }
  setTint(k) { this.group.traverse((o) => { if (o.isMesh && o.material.emissive) { if (!o.userData.e0) o.userData.e0 = o.material.emissive.clone(); o.material.emissive.copy(o.userData.e0).lerp(new THREE.Color(0x9fd8ff), k); } }); }
  // got punched: stagger
  hit(dir, strength = 1) {
    if (this.gone) return;
    this.knock.addScaledVector(dir.clone().setY(0).normalize(), 0.35 * strength); this.flinch = 0.25;
    audio.play('glitch', this.facePos, 0.6); fx.burst(this.facePos, this.color, 10, 1.5, { life: 0.4, sz: 0.03 });
    unlock('punchme');
  }
  // got shot / eaten: breaks into time shards, comes back later
  shot(dir, point) { this.shatter(false); }
  shatter(eaten) {
    if (this.gone) return;
    this.gone = true; this.goneT = G.loop.mode === 'auto' ? 999 : 3; // auto loop: back at the next loop
    this.group.visible = false;
    for (const h of this.hands) { h.body.position.set(0, -10, 0); h.body.velocity.setZero(); }
    fx.shards(this.facePos, this.color, 50); fx.shards(this.bodyPos, this.color, 30);
    audio.play('shatter', this.facePos, 1);
    if (this.voice) this.voice.mute(true);
  }
  comeBack() {
    this.gone = false; this.goneT = 0; this.group.visible = true; this.first = true;
    fx.burst(this.facePos, this.color, 30, -1.5, { life: 0.5, sz: 0.03 });
    if (this.voice) this.voice.mute(false);
  }
  freeze(sec = 6) { this.frozen = sec; this.setTint(0.6); if (this.voice) this.voice.pause(sec); for (const h of this.hands) h.body.velocity.setZero(); }
  unfreeze() { this.frozen = 0.0001; }
  setSize(s) { this.size = s; }
  setFloat(on) { this.floating = on; }
  dispose() {
    G.scene.remove(this.group);
    for (const h of this.hands) world.removeBody(h.body);
    if (this.voice) this.voice.stop();
    this.group.traverse((o) => { if (o.isMesh && o.material) o.material.dispose(); });
  }
}
