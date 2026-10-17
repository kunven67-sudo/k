import * as THREE from '../three.js';

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Things you can press E on. Picks whatever is closest to the crosshair. */
export class Interact {
  constructor(physics) {
    this.physics = physics;
    this.items = [];
    this.current = null;
  }

  add(item) {
    this.items.push(item);
    return item;
  }

  remove(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    if (this.current === item) this.current = null;
  }

  _pos(item) {
    if (typeof item.pos === 'function') return item.pos(_p);
    return item.pos;
  }

  update(camera) {
    camera.getWorldDirection(_dir);
    const o = camera.position;
    let best = null;
    let bestScore = Infinity;
    for (const it of this.items) {
      if (it.enabled && !it.enabled()) continue;
      const pos = this._pos(it);
      _v.subVectors(pos, o);
      const t = _v.dot(_dir);
      const range = it.range ?? 2.6;
      if (t < 0.15 || t > range + it.radius) continue;
      const perp = _v.addScaledVector(_dir, -t).length();
      if (perp > it.radius) continue;
      const score = t + perp * 1.5;
      if (score >= bestScore) continue;
      if (!it.noLos) {
        // stop just short of the target so its own collider doesn't block the view
        const target = pos.clone().addScaledVector(_dir, -Math.min(0.45, t * 0.5));
        if (!this.physics.lineOfSight(o, target)) continue;
      }
      best = it;
      bestScore = score;
    }
    this.current = best;
    return best;
  }
}
