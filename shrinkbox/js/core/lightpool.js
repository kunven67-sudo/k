// A house has lots of lamps, but every extra light makes EVERY surface slower to draw.
// So we keep a small fixed set of real lights and give them to the lamps nearest to you.
// (The count never changes, which also avoids shader recompiles / stutters.)
import * as THREE from 'three';

export class LightPool {
  constructor(scene, nSpot = 3, nPoint = 5) {
    this.spots = []; this.points = []; this.lights = [];
    for (let i = 0; i < nSpot; i++) { const l = new THREE.SpotLight(0xffffff, 0, 9, 1.35, 0.9, 1.6); scene.add(l, l.target); this.spots.push(l); }
    for (let i = 0; i < nPoint; i++) { const l = new THREE.PointLight(0xffffff, 0, 7, 1.6); scene.add(l); this.points.push(l); }
  }
  // kind: 'spot' | 'point'. Returns a handle with .intensity you can change.
  add(o) { const h = { kind: 'point', color: 0xfff0d8, intensity: 0, distance: 7, decay: 1.6, angle: 1.35, penumbra: 0.9, target: null, ...o }; h.pos = h.pos.clone(); this.lights.push(h); return h; }
  update(focus) {
    for (const kind of ['spot', 'point']) {
      const slots = kind === 'spot' ? this.spots : this.points;
      const list = this.lights.filter((l) => l.kind === kind && l.intensity > 0)
        .map((l) => ({ l, d: l.pos.distanceToSquared(focus) / Math.max(0.01, l.intensity) }))
        .sort((a, b) => a.d - b.d);
      slots.forEach((s, i) => {
        const e = list[i];
        if (!e) { s.intensity = 0; return; }
        const l = e.l;
        s.position.copy(l.pos); s.color.set(l.color); s.intensity = l.intensity; s.distance = l.distance; s.decay = l.decay;
        if (kind === 'spot') { s.angle = l.angle; s.penumbra = l.penumbra; s.target.position.copy(l.target || l.pos.clone().setY(l.pos.y - 3)); }
      });
    }
  }
}
