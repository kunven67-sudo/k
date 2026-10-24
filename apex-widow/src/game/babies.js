// Your babies: lay a papery egg sac at your lair, hundreds of spiderlings hatch, some eat each other (real widows do),
// the survivors grow with you and follow your orders: follow, guard the lair, hunt, attack what you aim at.
import * as THREE from 'three';
import { rand, clamp } from '../core/util.js';

export class Babies {
  constructor(game) { this.game = game; this.list = []; this.sacs = []; this.order = 'follow'; this.count = 0; }
  reset(n = 0) { for (const b of this.list) b.mesh.removeFromParent(); this.list = []; this.sacs = []; this.count = n; this.pendingRestore = n; }
  attach(scene) {
    this.scene = scene;
    if (!this.geo) {
      const g = new THREE.SphereGeometry(1, 8, 6); g.scale(0.5, 0.42, 0.75);
      this.geo = g; this.mat = new THREE.MeshPhysicalMaterial({ color: 0x0a0808, roughness: 0.2, clearcoat: 1 });
    }
    for (const b of this.list) scene.add(b.mesh);
    if (this.pendingRestore) { const n = this.pendingRestore; this.pendingRestore = 0; for (let i = 0; i < n; i++) this.spawnOne(); }
  }
  layEggs() {
    const G = this.game, p = G.player;
    if (!G.growth.lair || G.growth.lair.pos.distanceTo(p.pos) > p.s * 12) { G.hud.toast('Lay eggs at your lair.', 1.5); return; }
    if (p.hunger < 0.6) { G.hud.toast('You need to be well fed to make eggs.', 1.5); return; }
    p.hunger -= 0.4;
    const m = new THREE.Mesh(new THREE.SphereGeometry(p.s * 0.6, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xd8c8a0, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xfff0d0) }));
    m.position.copy(p.pos).addScaledVector(p.up, p.s * 0.6); this.scene.add(m);
    this.sacs.push({ mesh: m, t: 90, size: p.sizeM });
    G.hud.toast('Egg sac spun. It will hatch in about a minute and a half. Guard it.', 3);
  }
  spawnOne(at) {
    const G = this.game, p = G.player;
    const m = new THREE.Mesh(this.geo, this.mat); m.castShadow = true;
    const pos = (at || p.pos).clone().add(new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).multiplyScalar(p.s * 2));
    const b = { mesh: m, pos, vel: new THREE.Vector3(), size: 0.35, phase: rand(0, 6) };
    this.list.push(b); if (this.scene) this.scene.add(m);
    this.count = this.list.length;
    return b;
  }
  command() {
    const G = this.game;
    if (!this.list.length) { this.layEggs(); return; }
    const orders = ['follow', 'guard', 'hunt', 'attack'];
    this.order = orders[(orders.indexOf(this.order) + 1) % orders.length];
    G.hud.toast(`Babies: ${this.order.toUpperCase()}`, 1.5);
  }
  update(dt) {
    const G = this.game, p = G.player; if (!p || !this.scene) return;
    for (let i = this.sacs.length - 1; i >= 0; i--) {
      const S = this.sacs[i]; S.t -= dt;
      if (S.t <= 0) {
        S.mesh.removeFromParent(); this.sacs.splice(i, 1);
        const n = 14 + Math.floor(Math.random() * 10);
        for (let k = 0; k < n; k++) this.spawnOne(S.mesh.position);
        G.hud.toast(`${n} spiderlings hatched. ${Math.floor(n * 0.2)} were eaten by their brothers and sisters. The rest are yours. (B = give orders)`, 4);
        this.list.splice(0, Math.floor(n * 0.2)).forEach(b => b.mesh.removeFromParent());
        this.count = this.list.length;
      }
    }
    const s = p.s;
    for (const b of this.list) {
      // they follow you at a distance, scuttling with you; hunters go for the nearest prey
      let target = p.pos;
      if (this.order === 'guard' && G.growth.lair) target = G.growth.lair.pos;
      if ((this.order === 'hunt' || this.order === 'attack') && G.zone.creatures) { const c = G.zone.creatures.nearest(b.pos, s * 30, c => c.alive); if (c) { target = c.pos; if (c.pos.distanceTo(b.pos) < s * 0.5) c.hurt(dt * 3 * b.size, dt * 6); } }
      const to = target.clone().sub(b.pos); const d = to.length();
      const want = d > s * 3 ? to.normalize().multiplyScalar(s * 6) : new THREE.Vector3();
      b.vel.lerp(want, 1 - Math.exp(-dt * 3));
      b.pos.addScaledVector(b.vel, dt);
      const h = G.probe(b.pos.clone().add(new THREE.Vector3(0, s, 0)), new THREE.Vector3(0, -1, 0), s * 3, s * 0.3);
      if (h) b.pos.y = h.point.y;
      b.mesh.position.copy(b.pos); b.mesh.scale.setScalar(s * b.size * 0.5);
      if (b.vel.lengthSq() > 1e-12) b.mesh.rotation.y = Math.atan2(b.vel.x, b.vel.z);
    }
  }
}
