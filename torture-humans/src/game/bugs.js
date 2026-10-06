// Bugs living in the terrarium, at real size: ants (3 mm) marching in a line
// between their nest and whatever food is lying around, beetles (1-1.5 cm)
// trundling about, and a spider (2 cm body, legs as wide as a tiny person is
// tall). Legs are animated with a real alternating-tripod gait (insects) or
// a wave gait (spider). Tiny people are scared of the spider and run.
import * as THREE from 'three';
import { TANK } from './cageworld.js';

const UP = new THREE.Vector3(0, 1, 0);

// a leg: two segments that bend at the "knee"
function legMesh(len, thick, mat) {
  const g = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.8, thick, len * 0.45, 5).translate(0, len * 0.225, 0), mat);
  const knee = new THREE.Group();
  knee.position.y = len * 0.45;
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.4, thick * 0.8, len * 0.6, 5).translate(0, len * 0.3, 0), mat);
  knee.add(lower);
  upper.add(knee);
  g.add(upper);
  g.userData = { upper, knee };
  return g;
}

function insect({ kind, size }) {
  const g = new THREE.Group();
  const shell = kind === 'beetle'
    ? new THREE.MeshPhysicalMaterial({ color: 0x1b2a1e, roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }) // (no iridescence: the shadow-cascade shader chunk does not support it)
    : kind === 'spider' ? new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.8 })
      : new THREE.MeshStandardMaterial({ color: 0x2a0f08, roughness: 0.45 });
  const parts = kind === 'spider'
    ? [[-0.25, 0.3, 0.4, 0.85], [0.3, 0.2, 0.26, 0.6]]               // abdomen, cephalothorax (z offset, y, radius, squash)
    : kind === 'beetle' ? [[-0.1, 0.25, 0.45, 0.6], [0.32, 0.22, 0.2, 0.7], [0.5, 0.2, 0.13, 0.8]]
      : [[-0.3, 0.22, 0.24, 0.9], [0.0, 0.2, 0.12, 0.8], [0.25, 0.22, 0.15, 0.9]];
  for (const [z, y, r, squash] of parts) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), shell);
    m.scale.set(1, squash, kind === 'beetle' && r > 0.3 ? 1.4 : 1.15);
    m.position.set(0, y, z);
    m.castShadow = true;
    g.add(m);
  }
  if (kind === 'spider') {
    // eyes glint
    const eye = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.5 });
    for (const x of [-0.05, 0.05, -0.1, 0.1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), eye); e.position.set(x, 0.3, 0.52 + Math.abs(x) * -0.2); g.add(e); }
  }
  const legMat = shell;
  const legs = [];
  const n = kind === 'spider' ? 4 : 3;
  for (let side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const len = kind === 'spider' ? 1.7 : kind === 'beetle' ? 0.55 : 0.45;
      const leg = legMesh(len, kind === 'spider' ? 0.025 : 0.03, legMat);
      const z = kind === 'spider' ? 0.42 - i * 0.07 : (kind === 'beetle' ? 0.32 : 0.0) + 0.12 - i * 0.12;
      leg.position.set(side * 0.12, 0.2, z);
      // splay out sideways, spread front-to-back
      leg.userData.base = new THREE.Euler(0, (i - (n - 1) / 2) * (kind === 'spider' ? -0.6 : -0.45) * side, side * (kind === 'spider' ? -0.9 : -1.25), 'YZX');
      leg.userData.side = side;
      leg.userData.phase = (i % 2 === 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0); // tripod: alternate legs move together
      if (kind === 'spider') leg.userData.phase = i * Math.PI / 2 + (side > 0 ? Math.PI : 0); // wave gait
      g.add(leg);
      legs.push(leg);
    }
  }
  // antennae (ants, beetles)
  if (kind !== 'spider') {
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.35, 4).translate(0, 0.175, 0), legMat);
      a.position.set(s * 0.05, 0.28, kind === 'beetle' ? 0.6 : 0.38);
      a.rotation.set(1.0, 0, s * -0.5);
      g.add(a);
    }
  }
  g.scale.setScalar(size);
  g.userData = { legs, kind };
  return g;
}

export class Bugs {
  constructor({ cage, settings }) {
    this.cage = cage;
    this.tiny = cage.tiny;
    this.world = cage.tiny.world;
    this.list = [];
    const density = Math.max(0.3, settings.get('graphics.particles') ?? 1);
    // the ant nest: a little mound by a rock, away from the pond and lava
    this.nest = this.randomDry(0.6);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 1 }));
    mound.scale.y = 0.45;
    mound.position.set(this.nest.x, this.tiny.surfaceY(this.nest.x, this.nest.z) - 0.002, this.nest.z);
    mound.userData.noCollide = true;
    mound.receiveShadow = true;
    this.world.add(mound);
    for (let i = 0; i < Math.round(14 * density); i++) this.add('ant', 0.0045 + Math.random() * 0.001, this.nest.clone());
    for (let i = 0; i < 3; i++) this.add('beetle', 0.012 + Math.random() * 0.006, this.randomDry());
    this.add('spider', 0.018, this.randomDry());
  }

  randomDry(keepOut = 0.2) {
    for (let i = 0; i < 60; i++) {
      const x = (Math.random() - 0.5) * (TANK.w - 0.2), z = (Math.random() - 0.5) * (TANK.d - 0.2);
      if (this.cage.isWalkable(x, z) && Math.abs(x) < keepOut + 1.3) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0.2, 0, 0.2);
  }

  add(kind, size, at) {
    const mesh = insect({ kind, size });
    mesh.position.set(at.x, this.tiny.surfaceY(at.x, at.z), at.z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.world.add(mesh);
    const speed = { ant: 0.03, beetle: 0.012, spider: 0.05 }[kind];
    this.list.push({ kind, mesh, size, speed, target: null, wait: Math.random() * 3, gait: Math.random() * 10, carrying: false });
  }

  // where ants go: food lying around (from the colony), else wandering near the nest
  foodSpot(bug) {
    const c = this.cage.colony;
    if (!c) return null;
    let best = null, bd = 0.9;
    for (const p of c.pieces) {
      if (p.kind !== 'food' || p.state !== 'ground') continue;
      const d = Math.hypot(p.mesh.position.x - this.nest.x, p.mesh.position.z - this.nest.z);
      if (d < bd) { bd = d; best = p.mesh.position; }
    }
    return best;
  }

  update(dt) {
    dt = Math.min(0.1, dt);
    for (const b of this.list) {
      const m = b.mesh;
      if (b.wait > 0) { b.wait -= dt; this.animate(b, 0, dt); continue; }
      if (!b.target) {
        if (b.kind === 'ant') {
          // nest -> food -> nest, in a line (they follow the same trail)
          const food = this.foodSpot(b);
          b.target = b.carrying || !food ? this.nest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.01, 0, (Math.random() - 0.5) * 0.01)) : food.clone();
          if (!food && !b.carrying) b.target = this.nest.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3));
        } else {
          const t = m.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4));
          t.x = THREE.MathUtils.clamp(t.x, -TANK.w / 2 + 0.08, TANK.w / 2 - 0.08);
          t.z = THREE.MathUtils.clamp(t.z, -TANK.d / 2 + 0.08, TANK.d / 2 - 0.08);
          b.target = this.cage.isWalkable(t.x, t.z) ? t : null;
          if (!b.target) { b.wait = 0.5; continue; }
        }
      }
      const to = b.target.clone().sub(m.position).setY(0);
      const d = to.length();
      if (d < 0.004) {
        if (b.kind === 'ant') b.carrying = !b.carrying;
        b.target = null;
        b.wait = b.kind === 'ant' ? 0.3 + Math.random() : 1 + Math.random() * 4;
        continue;
      }
      // turn toward the target, walk forward (a little wiggle like real insects)
      const want = Math.atan2(to.x, to.z) + Math.sin(b.gait * 0.7) * (b.kind === 'ant' ? 0.25 : 0.1);
      let dy = want - m.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      m.rotation.y += dy * Math.min(1, dt * 6);
      const step = Math.min(d, b.speed * dt);
      m.position.x += Math.sin(m.rotation.y) * step;
      m.position.z += Math.cos(m.rotation.y) * step;
      if (!this.cage.isWalkable(m.position.x, m.position.z)) { m.position.x -= Math.sin(m.rotation.y) * step; m.position.z -= Math.cos(m.rotation.y) * step; b.target = null; }
      m.position.y = this.tiny.surfaceY(m.position.x, m.position.z);
      this.animate(b, step / dt, dt);
      // tiny people near the spider get scared and run
      if (b.kind === 'spider' && this.cage.colony) {
        for (const r of this.cage.colony.residents.values()) {
          if (r.dead || !r.agent) continue;
          const dist = r.worldPos().distanceTo(this.cage.group.localToWorld(m.position.clone()));
          if (dist < 0.12) {
            r.h.emotion.fear = Math.min(1, r.h.emotion.fear + dt * 0.8);
            if (dist < 0.07 && !r.doing.startsWith('running') && !r.doing.startsWith('fighting')) r.interrupt(r.fleeFrom(this.cage.group.localToWorld(m.position.clone())));
          }
        }
      }
    }
  }

  // legs: each lifts and swings forward in its phase; the body bobs a little
  animate(b, speed, dt) {
    b.gait += dt * (speed / b.size) * 2.2;
    const moving = speed > 0.0005 ? 1 : 0;
    for (const leg of b.mesh.userData.legs) {
      const ph = b.gait + leg.userData.phase;
      const base = leg.userData.base;
      const swing = Math.sin(ph) * 0.35 * moving;
      const lift = Math.max(0, Math.cos(ph)) * 0.35 * moving;
      leg.rotation.set(base.x, base.y + swing * leg.userData.side, base.z + lift * leg.userData.side * -1, 'YZX');
      leg.userData.knee.rotation.z = -(b.kind === 'spider' ? 1.5 : 1.2) * leg.userData.side * (1 - lift * 0.5); // knees bend down to the ground
    }
  }
}
