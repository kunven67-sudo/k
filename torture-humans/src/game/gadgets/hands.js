// What you hold and use: shrink ray, catching jar (more gadgets plug in here).
// The item is placed relative to the camera (so aiming is exact), and the right
// arm is solved with IK to the item's grip, so your real hand holds it in both
// first and third person.
import * as THREE from 'three';
import { solveTwoBone } from '../engine/anim.js';
import { shrinkRayModel, jarModel } from './models.js';
import { GROUP, groups } from '../engine/physics.js';

const CHARGE_TIME = 1.2;   // s to full charge
const RANGE = 40;          // m
const TINY = 0.05;         // shrunk people are 1/20 size (about 9 cm)
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
// item axes expressed in hand space: item X -> hand -Y, item Y -> hand +Z, item Z -> hand -X
const GRIP = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0),
));
const GRIP_INV = GRIP.clone().invert();
const PALM = new THREE.Vector3(0.075, 0.03, 0.0); // grip center seen from the wrist: out along the palm, a bit in front of it

const smooth = (t) => t * t * (3 - 2 * t);

class Item {
  constructor(name, model, { hold = new THREE.Vector3(0.2, -0.2, -0.45) } = {}) {
    this.name = name;
    this.model = model;
    this.hold = hold; // camera-space position of the grip
  }
  update() {}
}

class ShrinkRay extends Item {
  constructor(ctx) {
    super('Shrink ray', shrinkRayModel(), { hold: new THREE.Vector3(0.17, -0.17, -0.42) });
    this.gripPoint = new THREE.Vector3(0, -0.03, 0.012);      // middle of the handle
    this.ctx = ctx;
    this.charge = 0;
    this.charging = false;
    this.cooldown = 0;
    this.beam = this.makeBeam();
    ctx.scene.add(this.beam);
  }

  makeBeam() {
    const mat = new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 12, 1, true), mat);
    const glowMat = mat.clone();
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 16, 1, true), glowMat);
    const beam = new THREE.Group();
    beam.add(core, glow);
    beam.visible = false;
    beam.userData = { mats: [mat, glowMat], life: 0 };
    return beam;
  }

  onDown() {
    if (this.cooldown <= 0) this.charging = true;
  }

  onUp() {
    if (!this.charging) return;
    this.charging = false;
    if (this.charge > 0.35) this.fire(this.charge);
    this.charge = 0;
  }

  fire(power) {
    const { camera, physics, player } = this.ctx;
    this.cooldown = 0.6;
    const from = this.model.localToWorld(this.model.userData.muzzle.clone());
    const dir = camera.getWorldDirection(new THREE.Vector3());
    // aim from the eye (what you see is what you hit), draw the beam from the muzzle
    const hit = physics.raycast(camera.position, dir, RANGE, { exclude: player.body.collider });
    const to = hit ? hit.point : camera.position.clone().addScaledVector(dir, RANGE);
    const b = this.beam;
    b.visible = true;
    b.userData.life = 0.28;
    const len = from.distanceTo(to);
    b.position.copy(from).lerp(to, 0.5);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    b.scale.set(0.6 + power, len, 0.6 + power);
    this.model.userData.light.intensity = 25;
    const target = hit?.owner;
    if (target?.shrink && !target.tiny) target.shrink(TINY, { power });
    this.ctx.events?.emit?.('shrink-ray-fired', { hit: !!target });
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.charging) this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
    const u = this.model.userData;
    const hum = this.charging ? this.charge : 0;
    u.coreMat.emissiveIntensity = 0.4 + hum * 9 + Math.sin(performance.now() / 40) * hum * 0.8;
    u.lensMat.emissiveIntensity = 0.3 + hum * 5;
    u.light.intensity = Math.max(hum * 4, u.light.intensity * Math.exp(-dt * 12));
    for (const [i, c] of u.coils.entries()) c.rotation.z += dt * hum * (6 + i * 3);
    const b = this.beam;
    if (b.userData.life > 0) {
      b.userData.life -= dt;
      const k = Math.max(0, b.userData.life / 0.28);
      b.userData.mats[0].opacity = k;
      b.userData.mats[1].opacity = k * 0.35;
      if (b.userData.life <= 0) b.visible = false;
    }
  }
}

class Jar extends Item {
  constructor(ctx) {
    super('Jar', jarModel(), { hold: new THREE.Vector3(0.16, -0.22, -0.4) });
    this.gripPoint = new THREE.Vector3(0, 0.085, 0);          // hold it around the middle
    this.palm = new THREE.Vector3(0.06, 0.07, 0);              // palm against the side of a 13 cm jar
    this.ctx = ctx;
    this.swoop = null;      // catching animation state
    this.inside = null;     // the tiny human caught in it
  }

  onDown() {
    if (this.swoop) return;
    const { camera, physics, player } = this.ctx;
    if (this.inside) {
      // near the terrarium: drop them in
      const cage = this.ctx.cage;
      if (cage && cage.canDropFrom(camera.position)) {
        const h = this.inside;
        this.inside = null;
        // where in the tank are you pointing? (people don't block the aim)
        const aimHit = physics.raycast(camera.position, camera.getWorldDirection(new THREE.Vector3()), 3, { exclude: player.body.collider, filterGroups: groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP) });
        cage.drop(h, camera.position, aimHit?.point || null);
        return;
      }
      return;
    }
    // where on the ground are we aiming (max 1.8 m away)
    const dir = camera.getWorldDirection(new THREE.Vector3());
    // aim at the floor/table under them: people (even tiny ones) don't block the aim
    const floorOnly = groups(GROUP.PLAYER, GROUP.WORLD | GROUP.PROP);
    const hit = physics.raycast(camera.position, dir, 1.8 * player.scale + 1.5, { exclude: player.body.collider, filterGroups: floorOnly });
    if (!hit || hit.normal.y < 0.6) return;
    this.swoop = { t: 0, target: hit.point.clone(), start: this.model.position.clone() };
  }

  update(dt) {
    if (!this.swoop) return;
    // a fast swoop down: 0.28 s down (opening first), a short hold, then back up
    const s = this.swoop;
    s.t += dt;
    const down = 0.28;
    if (s.t >= down && !s.checked) {
      s.checked = true;
      const { r } = this.model.userData;
      // anyone tiny under the opening gets caught
      let best = null;
      for (const h of this.ctx.humans) {
        if (!h.tiny || h.captured) continue;
        const d = Math.hypot(h.position.x - s.target.x, h.position.z - s.target.z);
        if (d < r * 0.95 && Math.abs(h.position.y - s.target.y) < 0.2 && (!best || d < best.d)) best = { h, d };
      }
      if (best) {
        this.inside = best.h;
        best.h.captureInto(this.model, { watcher: this.ctx.camera });
      }
      s.result = best ? 'caught' : 'missed';
      if (!best) this.lastMiss = { target: s.target.clone(), near: this.ctx.humans.filter((h) => h.tiny).map((h) => ({ d: Math.hypot(h.position.x - s.target.x, h.position.z - s.target.z), dy: h.position.y - s.target.y, state: h.state })) };
    }
    if (s.t >= down + 0.35) this.swoop = null;
  }

  // world transform of the jar while swooping (overrides the normal hold pose)
  swoopPose() {
    const s = this.swoop;
    if (!s) return null;
    const down = 0.28;
    const k = s.t < down ? smooth(s.t / down) : s.t < down + 0.15 ? 1 : 1 - smooth((s.t - down - 0.15) / 0.2);
    return { k, target: s.target };
  }
}

export class Hands {
  constructor(ctx) {
    this.ctx = ctx;
    this.items = [new ShrinkRay(ctx), new Jar(ctx)];
    this.index = 0;
    for (const it of this.items) { it.model.visible = false; ctx.scene.add(it.model); }
    this.current.model.visible = true;
  }

  get current() {
    return this.items[this.index];
  }

  select(i) {
    if (i === this.index || !this.items[i]) return;
    this.current.onUp?.();
    this.current.model.visible = false;
    this.index = i;
    this.current.model.visible = true;
  }

  update(dt) {
    const { input, camera, player } = this.ctx;
    if (player.ladder?.active) { this.current.model.visible = false; return; } // both hands on the ladder
    this.current.model.visible = true;
    for (let i = 0; i < this.items.length; i++) if (input.pressed(`item${i + 1}`)) this.select(i);
    if (input.pressed('nextItem')) this.select((this.index + 1) % this.items.length);
    if (input.pressed('prevItem')) this.select((this.index + this.items.length - 1) % this.items.length);
    if (input.pressed('primary')) this.current.onDown?.();
    if (input.released('primary')) this.current.onUp?.();

    const item = this.current;
    item.update(dt);
    // hold pose: camera space, scaled with you when you're tiny
    const s = player.scale;
    const pose = item.swoopPose?.();
    // where the item is held: first person = fixed spot in view; third person =
    // in front of your own chest, pointing where you aim (the camera is behind you)
    let holdWorld;
    let aimQ = camera.quaternion;
    if (player.mode === 'first') {
      holdWorld = camera.localToWorld(item.hold.clone().multiplyScalar(s));
    } else {
      aimQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
      const chest = player.character.bones.Bip01_Spine2?.getWorldPosition(new THREE.Vector3()) ?? player.feet.clone().setY(player.feet.y + 1.35 * s);
      holdWorld = chest.add(new THREE.Vector3(0.14, 0.02, -0.38).multiplyScalar(s).applyQuaternion(aimQ));
    }
    item.model.scale.setScalar(s);
    if (pose) {
      // jar: flip upside down and slam over the target spot
      const over = pose.target.clone();
      item.model.position.copy(holdWorld).lerp(over, pose.k);
      const up = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * pose.k, this.ctx.player.yaw, 0, 'YXZ'));
      item.model.quaternion.copy(up);
      if (pose.k > 0.5) item.model.position.y = over.y + item.model.userData.h * s;
    } else {
      item.model.position.copy(holdWorld);
      item.model.quaternion.copy(aimQ);
      if (item instanceof Jar) item.model.quaternion.multiply(_q.setFromEuler(new THREE.Euler(-0.15, 0, 0)));
    }
    item.model.updateMatrixWorld(true);
    this.solveArm();
  }

  // Right hand onto the item's grip, with the hand turned the way a real hand holds it.
  // Rocketbox hand bone: +X along the fingers, +Z from pinky to index, palm faces +Y.
  // Holding a pistol: pinky->index runs up the handle (item +Y), the palm presses on the
  // handle's right side (palm normal = item -X), so the fingers point forward (item -Z).
  solveArm() {
    const ch = this.ctx.player.character;
    const B = ch.bones;
    const upper = B.Bip01_R_UpperArm;
    const lower = B.Bip01_R_Forearm;
    const hand = B.Bip01_R_Hand;
    if (!upper || !lower || !hand) return;
    const item = this.current;
    const s = this.ctx.player.scale;
    ch.root.updateMatrixWorld(true);
    const qItem = item.model.getWorldQuaternion(new THREE.Quaternion());
    const qHand = qItem.clone().multiply(GRIP_INV);
    const grip = item.model.localToWorld((item.gripPoint || new THREE.Vector3()).clone());
    // wrist = grip point minus the palm offset (in hand space, meters)
    const palm = (item.palm || PALM).clone().multiplyScalar(s).applyQuaternion(qHand);
    const wrist = grip.clone().sub(palm);
    const shoulder = upper.getWorldPosition(new THREE.Vector3());
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(qItem);
    const pole = shoulder.clone().addScaledVector(right, 0.4).add(new THREE.Vector3(0, -0.6, 0));
    solveTwoBone(upper, lower, hand, wrist, 1, pole);
    // turn the hand itself
    const parentQ = hand.parent.getWorldQuaternion(new THREE.Quaternion());
    hand.quaternion.copy(parentQ.invert().multiply(qHand));
    hand.updateMatrixWorld(true);
    // fingers around the grip: tight on the pistol grip, open wider for the fat jar
    const it = this.current;
    ch.grip('R', it instanceof Jar ? 0.55 : 0.95, { thumb: it instanceof Jar ? 0.4 : 0.8 });
    // the index finger rests on the trigger, and pulls it while charging
    if (it instanceof ShrinkRay) {
      const idx = B.Bip01_R_Finger1;
      if (idx) idx.rotation.z -= 0.55 - (it.charging ? 0.25 : 0);
    }
  }
}
