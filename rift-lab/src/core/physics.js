// Rapier physics world with a fixed 60 Hz step (stable, same result on every PC).

import RAPIER from 'rapier';
import * as THREE from 'three';

let ready = null;
export function initPhysics() {
  if (!ready) ready = RAPIER.init().then(() => RAPIER);
  return ready;
}

export class Physics {
  constructor(RAPIER) {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.acc = 0;
    this.stepHooks = new Set();
    this.forceHooks = new Set();
    this.queue = new RAPIER.EventQueue(true);
  }

  // fn(event) for every hard contact (impacts) reported by the engine
  onForce(fn) { this.forceHooks.add(fn); return () => this.forceHooks.delete(fn); }

  // fn(dt) runs once per fixed step, before the physics step
  onStep(fn) { this.stepHooks.add(fn); return () => this.stepHooks.delete(fn); }

  update(dt) {
    this.acc += Math.min(dt, 0.1);
    let steps = 0;
    const h = this.world.timestep;
    while (this.acc >= h && steps < 5) {
      for (const fn of this.stepHooks) fn(h);
      this.world.step(this.queue);
      this.guardGround();
      this.queue.drainContactForceEvents((e) => { for (const fn of this.forceHooks) fn(e); });
      this.queue.drainCollisionEvents(() => {});
      this.acc -= h;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    return this.acc / h; // interpolation alpha
  }

  // The engine's CCD misses small, fast things against the terrain heightfield (they tunnel through).
  // The terrain is a height function, so nothing real can have its middle under it: anything that
  // ends up there is put back on the surface and its fall stops (a tiny bounce, real friction).
  setGround(heightAt) { this.groundAt = heightAt; }

  guardGround() {
    const hAt = this.groundAt;
    if (!hAt) return;
    const q = this._gq ||= new THREE.Quaternion(), c = this._gc ||= new THREE.Vector3(), v = this._gv ||= new THREE.Vector3();
    const each = this.world.forEachActiveRigidBody ? 'forEachActiveRigidBody' : 'forEachRigidBody';
    this.world[each]((b) => {
      if (!b.isDynamic()) return;
      const bb = b.userData?.item?.bounds || b.userData?.bounds;
      if (!bb || bb.isEmpty()) return;
      const t = b.translation(), r = b.rotation();
      q.set(r.x, r.y, r.z, r.w);
      bb.getCenter(c).applyQuaternion(q);
      const cy = c.y;
      c.x += t.x; c.y += t.y; c.z += t.z;
      const gy = hAt(c.x, c.z);
      if (!(c.y < gy)) return;
      // how far its lowest corner hangs below its middle, as it's turned right now
      let below = 0;
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        v.set(x, y, z).applyQuaternion(q);
        below = Math.max(below, cy - v.y);
      }
      const lift = gy + below + 0.003 - c.y;
      b.setTranslation({ x: t.x, y: t.y + lift, z: t.z }, true);
      const lv = b.linvel(), av = b.angvel();
      b.setLinvel({ x: lv.x * 0.6, y: Math.max(0, -lv.y) * 0.12, z: lv.z * 0.6 }, true);
      b.setAngvel({ x: av.x * 0.5, y: av.y * 0.5, z: av.z * 0.5 }, true);
    });
  }

  castRay(origin, dir, maxToi, excludeCollider) {
    const ray = new this.RAPIER.Ray(origin, dir);
    return this.world.castRay(ray, maxToi, true, undefined, undefined, excludeCollider);
  }

  free() { this.queue.free(); this.world.free(); this.stepHooks.clear(); this.forceHooks.clear(); }
}
