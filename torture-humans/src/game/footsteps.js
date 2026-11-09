// Footsteps for everyone (you have your own in audio.js): every person's foot
// that lands makes a step at that spot, on the right surface (grass, wood,
// concrete), louder and deeper the bigger they are. Tiny people patter, the
// pet rat scurries, bugs tick.
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _t = new THREE.Vector3();

export class Footsteps {
  constructor({ audio, humans, pets, bugs, camera, inHouse, inLab }) {
    Object.assign(this, { audio, humans, pets, bugs, camera, inHouse, inLab });
    this.feet = new Map(); // key -> previous height over the ground
  }

  surfaceAt(p) {
    if (this.inLab?.(p)) return 'floor';
    if (this.inHouse?.(p)) return 'wood';
    return p.y < 3.29 && p.y > 3.2 ? 'grass' : 'floor';
  }

  update(dt) {
    if (!this.audio?.ctx) return;
    const ear = this.camera.position;
    for (const h of this.humans) {
      if (!h.alive || h.dead || !h.character.root.visible) continue;
      if (!['idle', 'walking', 'caged', 'village'].includes(h.state)) continue;
      const root = h.character.root;
      root.getWorldPosition(_t);
      const s = root.getWorldScale(_v).x;
      // only people you could hear
      if (_t.distanceTo(ear) > Math.max(0.6, 30 * s)) continue;
      for (const side of ['L', 'R']) {
        const foot = h.character.bones[`Bip01_${side}_Foot`];
        if (!foot) continue;
        foot.getWorldPosition(_v);
        const height = (_v.y - _t.y) / s;          // in body meters (same for tiny people)
        const key = h.id * 2 + (side === 'L' ? 0 : 1);
        const prev = this.feet.get(key);
        this.feet.set(key, height);
        // the ankle drops through ~11.5 cm: that foot just landed
        if (prev !== undefined && prev >= 0.115 && height < 0.115 && (h.character.speed ?? 0) > 0.2) {
          this.audio.footstep(_v.clone(), s, this.surfaceAt(_t), h.character.speed > 2.2 ? 1.3 : 1);
        }
      }
    }
    // the rat's little feet
    for (const pet of this.pets?.list || []) {
      if (pet.kind !== 'rat' || !pet.agent) continue;
      const v = pet.agent.velocity();
      const sp = Math.hypot(v.x, v.z);
      if (sp < 0.08) continue;
      pet.stepD = (pet.stepD ?? 0) + sp * dt;
      if (pet.stepD > 0.05) { pet.stepD = 0; this.audio.footstep(pet.holder.position.clone(), 0.04, this.surfaceAt(pet.holder.position), 0.7); }
    }
    // bugs in the terrarium (only when you're close)
    for (const b of this.bugs?.list || []) {
      b.mesh.getWorldPosition(_v);
      if (_v.distanceTo(ear) > (b.kind === 'ant' ? 0.25 : 0.6)) continue;
      const g = Math.floor(b.gait * 2);
      if (g !== b.lastTick) { b.lastTick = g; this.audio.footstep(_v.clone(), b.size * 0.4, 'floor', b.kind === 'spider' ? 0.8 : 0.5); }
    }
  }
}
