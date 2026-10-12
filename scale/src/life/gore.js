// Blood and bits. A small pool of droplets that fly, fall with gravity and leave stains where they
// land (stains stay, up to a limit; the oldest fade first). Sizes follow whatever got hurt, so a
// mantis bite on a 4 mm you makes 4 mm-you-sized drops.
import * as THREE from 'three';
import { std } from '../render/materials.js';
import { settings } from '../core/settings.js';

const MAX_DROPS = 160;
const MAX_STAINS = 120;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Gore {
  constructor(game) {
    this.game = game;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    this.blood = std({ color: 0x4a0306, roughness: 0.18, metalness: 0.0 }, { detail: 'food' });
    this.glitch = std({ color: 0x0a2a30, emissive: 0x2ef2ff, emissiveIntensity: 2.2, roughness: 0.4 });
    this.drops = new THREE.InstancedMesh(geo, this.blood, MAX_DROPS);
    this.shards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.glitch, 40);
    const disc = new THREE.CircleGeometry(1, 14);
    disc.rotateX(-Math.PI / 2);
    this.stains = new THREE.InstancedMesh(disc, std({ color: 0x3a0205, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, { detail: 'food' }), MAX_STAINS);
    for (const im of [this.drops, this.shards, this.stains]) {
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = true;
      game.scene.add(im);
    }
    this.live = []; // { p, v, r, life, shard }
    this.stainList = []; // { p, r }
    game.updatables.add(this);
  }

  // A burst of blood at `at`, going roughly along `dir`, sized for a body `size` meters tall.
  burst(at, dir, size, amount = 12, { glitch = false } = {}) {
    const g = settings.get('gore');
    if (g === 'off') return;
    const n = Math.round(amount * (g === 'max' ? 1.6 : 1));
    const k = this.live.length;
    for (let i = 0; i < n && this.live.length < MAX_DROPS + 40; i++) {
      // Spread comes from the hit itself (direction plus a fan around it), not dice.
      const a = (i / n) * Math.PI * 2 + k;
      const fan = 0.6 + 0.4 * Math.sin(i * 2.399);
      const v = new THREE.Vector3(dir.x + Math.cos(a) * fan, dir.y + 0.6 + Math.sin(i * 1.7) * 0.4, dir.z + Math.sin(a) * fan);
      v.normalize().multiplyScalar(Math.sqrt(size) * (1.2 + (i % 3) * 0.5));
      const shard = glitch && i % 4 === 0;
      this.live.push({ p: at.clone(), v, r: size * (0.012 + (i % 4) * 0.006), life: 2.5, shard, ground: null });
    }
  }

  update(dt) {
    const physics = this.game.physics;
    let d = 0, s = 0;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.life -= dt;
      const vt = Math.max(0.3, 20 * Math.sqrt(b.r));
      b.v.y -= 9.81 * dt;
      b.v.multiplyScalar(Math.max(0, 1 - (9.81 / vt) * dt * 0.5));
      const step = b.v.length() * dt;
      if (step > 0) {
        const dir = _p.copy(b.v).normalize();
        const hit = physics.raycast(b.p, dir, step + b.r, { predicate: (c) => physics.ownerOf(c) !== this.game.player });
        if (hit) {
          if (!b.shard) this._stain(hit.point, hit.normal, b.r * 2.2);
          this.live.splice(i, 1);
          continue;
        }
        b.p.addScaledVector(b.v, dt);
      }
      if (b.life <= 0) {
        this.live.splice(i, 1);
        continue;
      }
      _q.identity();
      if (b.shard) {
        if (s < 40) {
          _q.setFromAxisAngle(_p.set(1, 1, 0).normalize(), b.life * 9);
          this.shards.setMatrixAt(s++, _m.compose(b.p, _q, _s.setScalar(b.r * 1.3)));
        }
      } else if (d < MAX_DROPS) {
        // Stretch drops along their motion like real flying blood.
        const sp = b.v.length();
        _q.setFromUnitVectors(UP, _p.copy(b.v).normalize());
        this.drops.setMatrixAt(d++, _m.compose(b.p, _q, _s.set(b.r, b.r * (1 + Math.min(2, sp * 0.15 / Math.sqrt(b.r + 1e-4))), b.r)));
      }
    }
    this.drops.count = d;
    this.shards.count = s;
    this.drops.instanceMatrix.needsUpdate = true;
    this.shards.instanceMatrix.needsUpdate = true;
  }

  _stain(point, normal, r) {
    if (this.stainList.length >= MAX_STAINS) this.stainList.shift();
    this.stainList.push({ p: point.clone().addScaledVector(normal, r * 0.02), n: normal.clone(), r });
    for (let i = 0; i < this.stainList.length; i++) {
      const st = this.stainList[i];
      _q.setFromUnitVectors(UP, st.n);
      this.stains.setMatrixAt(i, _m.compose(st.p, _q, _s.set(st.r, 1, st.r * (0.8 + (i % 3) * 0.15))));
    }
    this.stains.count = this.stainList.length;
    this.stains.instanceMatrix.needsUpdate = true;
  }
}
