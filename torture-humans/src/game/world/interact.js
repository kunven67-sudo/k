// Things you can use with E: light switches, the trash, mess to tidy, the fridge...
// Anything registers { at, radius, label, use, when? } and the closest one you're
// looking at shows its hint.
import * as THREE from 'three';

export class Interactables {
  constructor({ camera, player, input }) {
    Object.assign(this, { camera, player, input });
    this.list = [];
    this.current = null;
  }

  add(it) { this.list.push(it); return it; }
  remove(it) { const i = this.list.indexOf(it); if (i >= 0) this.list.splice(i, 1); }

  get hint() { return this.current ? `E  ${typeof this.current.label === 'function' ? this.current.label() : this.current.label}` : null; }

  update() {
    const p = this.player;
    this.current = null;
    if (p.scale < 0.5 || p.scale > 3 || p.ladder?.active || p.ladder?.prompt?.()) return;
    const eye = this.camera.position;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    let best = null, bestScore = Infinity;
    for (const it of this.list) {
      if (it.when && !it.when()) continue;
      const at = typeof it.at === 'function' ? it.at() : it.at;
      if (!at) continue;
      const to = at.clone().sub(eye);
      const d = to.length();
      if (d > (it.radius ?? 1.6)) continue;
      const ang = Math.acos(THREE.MathUtils.clamp(to.normalize().dot(dir), -1, 1));
      if (ang > 0.6) continue;
      const score = ang + d * 0.2;
      if (score < bestScore) { best = it; bestScore = score; }
    }
    this.current = best;
    if (best && this.input.pressed('interact')) best.use();
  }
}
