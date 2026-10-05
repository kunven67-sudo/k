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
    if (p.scale > 3 || p.ladder?.active || p.ladder?.prompt?.()) return;
    const small = p.scale < 0.5; // tiny you: only big things (shop doors) and by distance, not aim
    const eye = this.camera.position;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    let best = null, bestScore = Infinity;
    for (const it of this.list) {
      if (it.when && !it.when()) continue;
      if (small && !it.anyScale) continue;
      const at = typeof it.at === 'function' ? it.at() : it.at;
      if (!at) continue;
      const to = at.clone().sub(eye);
      if (small) to.y = 0;
      const d = to.length();
      if (d > (typeof it.radius === 'function' ? it.radius() : it.radius ?? 1.6)) continue;
      if (small) { if (d < bestScore) { best = it; bestScore = d; } continue; }
      const ang = Math.acos(THREE.MathUtils.clamp(to.normalize().dot(dir), -1, 1));
      if (ang > 0.6) continue;
      const score = ang + d * 0.2;
      if (score < bestScore) { best = it; bestScore = score; }
    }
    this.current = best;
    if (best && this.input.pressed('interact')) best.use();
  }
}
