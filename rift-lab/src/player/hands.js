// Your hands. Hold left-click to grab what you're looking at: it's pulled toward your hand
// by a spring that can only push so hard (your real strength), so light things lift,
// heavy things drag, and a fridge barely budges. Drawers slide + doors swing because
// you're pulling on their real hinges. Let go while swinging to toss; hold right-click
// to wind up a proper throw (heavier = shorter).

import * as THREE from 'three';
import { input } from '../core/input.js';
import { clamp } from '../core/noise.js';

const REACH = 2.3;            // meters from your eyes
const HAND_FORCE = 430;       // newtons: about 40 kg held at arm's length, like a strong-ish adult
const THROW_IMPULSE = 48;     // N·s from a full wind-up
const MAX_THROW_SPEED = 24;   // m/s (a good fastball)

export class Hands {
  constructor({ physics, camera, items, player }) {
    this.physics = physics;
    this.camera = camera;
    this.items = items;
    this.player = player;
    this.R = physics.RAPIER;
    this.aim = null;
    this.held = null;
    this.charge = 0;
    this.enabled = true;
    this.events = [];
    this._dir = new THREE.Vector3();
    this.unhook = physics.onStep((h) => this.fixedStep(h));
  }

  lookDir() { return this.camera.getWorldDirection(this._dir); }

  // per rendered frame
  update(dt) {
    if (!this.enabled || !input.locked) { if (this.held) this.release(false); this.aim = null; return; }
    const cam = this.camera.position, dir = this.lookDir();
    const hit = this.physics.castRay({ x: cam.x, y: cam.y, z: cam.z }, { x: dir.x, y: dir.y, z: dir.z }, REACH, this.player.collider);
    this.aim = null;
    if (hit) {
      const col = hit.collider;
      const item = this.items.itemOfCollider(col);
      const body = col.parent();
      if (item && body) {
        const p = { x: cam.x + dir.x * hit.timeOfImpact, y: cam.y + dir.y * hit.timeOfImpact, z: cam.z + dir.z * hit.timeOfImpact };
        this.aim = { item, body, collider: col, point: p, dist: hit.timeOfImpact, movable: body.isDynamic() };
      }
    }
    if (input.mousePressed(0) && this.aim && this.aim.movable && !this.held) this.grab(this.aim);
    if (this.held && !input.mouse(0)) this.release(false);
    if (this.held) {
      if (input.wheel) this.held.dist = clamp(this.held.dist - input.wheel * 0.12, 0.55, REACH);
      if (input.mouse(2)) this.charge = Math.min(1, this.charge + dt / 0.8);
      else if (this.charge > 0) { this.throw(); }
    } else this.charge = 0;
  }

  grab(a) {
    const body = a.body;
    const t = body.translation(), r = body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w).invert();
    const local = new THREE.Vector3(a.point.x - t.x, a.point.y - t.y, a.point.z - t.z).applyQuaternion(q);
    this.held = { body, item: a.item, local, dist: Math.max(0.55, a.dist), angDamp: body.angularDamping() };
    body.setAngularDamping(3.5);
    body.wakeUp();
    this.events.push({ type: 'grab', item: a.item, mass: body.mass() });
  }

  release(thrown) {
    const h = this.held;
    if (!h) return;
    h.body.setAngularDamping(h.angDamp);
    this.held = null;
    this.charge = 0;
    this.events.push({ type: thrown ? 'throw' : 'drop', item: h.item });
  }

  throw() {
    const h = this.held;
    if (!h) return;
    const m = h.body.mass();
    // you can only throw what you can lift
    if (m * 9.81 < HAND_FORCE * 0.9) {
      const dir = this.lookDir();
      const speed = Math.min(MAX_THROW_SPEED, (THROW_IMPULSE * this.charge) / m);
      const j = m * speed;
      h.body.applyImpulse({ x: dir.x * j, y: dir.y * j + m * 0.8 * this.charge, z: dir.z * j }, true);
    }
    this.release(true);
  }

  fixedStep(h) {
    const held = this.held;
    if (!held) return;
    const body = held.body;
    if (typeof body.isValid === 'function' && !body.isValid()) { this.held = null; return; }
    const cam = this.camera.position;
    const dir = this.lookDir();
    const target = new THREE.Vector3().copy(cam).addScaledVector(dir, held.dist);
    const t = body.translation(), r = body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const anchor = held.local.clone().applyQuaternion(q).add(new THREE.Vector3(t.x, t.y, t.z));
    const lv = body.linvel(), av = body.angvel();
    const com = body.worldCom ? body.worldCom() : t;
    const rel = new THREE.Vector3(anchor.x - com.x, anchor.y - com.y, anchor.z - com.z);
    const vAnchor = new THREE.Vector3(lv.x, lv.y, lv.z).add(new THREE.Vector3(av.x, av.y, av.z).cross(rel));
    const m = Math.min(body.mass(), 60);
    const w = 11;
    const F = target.sub(anchor).multiplyScalar(m * w * w).addScaledVector(vAnchor, -2 * m * w * 0.9);
    F.y += Math.min(body.mass(), 60) * 9.81; // hold it up against gravity (if you're strong enough)
    const len = F.length();
    if (len > HAND_FORCE) F.multiplyScalar(HAND_FORCE / len);
    body.applyImpulseAtPoint({ x: F.x * h, y: F.y * h, z: F.z * h }, { x: anchor.x, y: anchor.y, z: anchor.z }, true);
    // it slipped out of your hand (too far away)
    if (anchor.distanceTo(cam) > REACH + 0.9) this.release(false);
  }

  get carryMass() { return this.held ? this.held.body.mass() : 0; }

  dispose() { this.release(false); this.unhook(); }
}
