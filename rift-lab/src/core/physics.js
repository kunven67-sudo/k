// Rapier physics world with a fixed 60 Hz step (stable, same result on every PC).

import RAPIER from 'rapier';

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
  }

  // fn(dt) runs once per fixed step, before the physics step
  onStep(fn) { this.stepHooks.add(fn); return () => this.stepHooks.delete(fn); }

  update(dt) {
    this.acc += Math.min(dt, 0.1);
    let steps = 0;
    const h = this.world.timestep;
    while (this.acc >= h && steps < 5) {
      for (const fn of this.stepHooks) fn(h);
      this.world.step();
      this.acc -= h;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    return this.acc / h; // interpolation alpha
  }

  castRay(origin, dir, maxToi, excludeCollider) {
    const ray = new this.RAPIER.Ray(origin, dir);
    return this.world.castRay(ray, maxToi, true, undefined, undefined, excludeCollider);
  }

  free() { this.world.free(); }
}
