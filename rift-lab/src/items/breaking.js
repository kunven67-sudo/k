// Realistic breaking + impact sounds. The physics engine reports how hard things hit
// (newtons). Each part breaks the way its material really does:
//   glass / ceramic / bulbs -> shatter into shards + tiny glittering bits
//   wood -> the part snaps off (big boards split in two) + splinters
//   particle board -> crumbles off in chunks (cheap stuff breaks easier)
//   marble / plastic -> cracks in two
//   metal -> dents (doesn't fall apart)
//   fabric / leather / foam -> just thuds

import * as THREE from 'three';
import { physicalOf, material } from './materials.js';
import { partQuat } from './builder.js';

// force (N) a part of "average" size can take before it breaks
const BREAK_FORCE = { glass: 2600, mirror: 2200, ceramic: 7000, bulb: 250, wood: 6500, paint: 6500, board: 2600, marble: 16000, plastic: 4200, metal: 9000 };

export function breakForce(part) {
  const kind = (part.mat || 'wood').split(':')[0];
  const base = BREAK_FORCE[kind];
  if (!base) return Infinity;
  let area;
  if (part.s === 'box') { const s = [...part.size].sort((a, b) => a - b); area = s[0] * s[1]; } // weakest cross-section
  else if (part.s === 'cyl' || part.s === 'cone') area = Math.PI * Math.max(part.r, part.r2 || 0) ** 2;
  else area = 0.004;
  const k = Math.min(4, Math.max(0.35, Math.sqrt(area / 0.0025)));
  return base * k;
}

class Particles {
  constructor(scene, ground) {
    this.ground = ground;
    this.max = 600;
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(this.geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 }), this.max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3), 3);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.p = [];
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
  }

  burst(at, count, { color = 0xffffff, size = 0.008, speed = 2, life = 25, vel = null } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.p.length >= this.max) this.p.shift();
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize();
      this.p.push({
        pos: at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.15)),
        vel: dir.multiplyScalar(speed * (0.3 + Math.random())).add(vel || new THREE.Vector3()),
        rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10),
        size: size * (0.5 + Math.random()), color: new THREE.Color(color).multiplyScalar(0.8 + Math.random() * 0.4), life, rest: false,
      });
    }
  }

  update(dt) {
    let n = 0;
    for (const p of this.p) {
      p.life -= dt;
      if (!p.rest) {
        p.vel.y -= 9.81 * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.rot.addScaledVector(p.spin, dt);
        const gy = this.ground(p.pos.x, p.pos.z) + p.size / 2;
        if (p.pos.y < gy) { p.pos.y = gy; p.vel.multiplyScalar(0.3); p.vel.y = Math.abs(p.vel.y) * 0.2; if (p.vel.lengthSq() < 0.02) p.rest = true; }
      }
    }
    this.p = this.p.filter((p) => p.life > 0);
    for (const p of this.p) {
      this.m.compose(p.pos, this.q.setFromEuler(this.e.set(p.rot.x, p.rot.y, p.rot.z)), new THREE.Vector3(p.size, p.size * 0.6, p.size));
      this.mesh.setMatrixAt(n, this.m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Breaking {
  constructor({ physics, items, scene, world, audio, onMessage }) {
    this.physics = physics;
    this.R = physics.RAPIER;
    this.items = items;
    this.scene = scene;
    this.audio = audio;
    this.onMessage = onMessage || (() => {});
    this.particles = new Particles(scene, (x, z) => world.height(x, z));
    this.debris = [];
    this.queue = [];
    this.lastSound = new Map();
    this.unhook = physics.onForce((e) => this.onForce(e));
    items.onCollider = (col, part, item) => this.arm(col, part, item);
  }

  // turn on force reports for a collider: only real impacts (well above its resting weight)
  arm(col, part, item) {
    const R = this.R;
    const restWeight = (item.spec.mass || 10) * 9.81;
    col.setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS);
    col.setContactForceEventThreshold(Math.min(breakForce(part) * 0.9, Math.max(160, restWeight * 2.5)));
  }

  onForce(e) {
    const w = this.physics.world;
    const f = e.totalForceMagnitude();
    const c1 = w.getCollider(e.collider1()), c2 = w.getCollider(e.collider2());
    for (const [c, other] of [[c1, c2], [c2, c1]]) {
      const item = c && this.items.itemOfCollider(c);
      if (!item) continue;
      const part = c.userData?.part;
      if (!part) continue;
      this.queue.push({ item, col: c, part, f, other });
    }
  }

  update(dt) {
    const q = this.queue;
    this.queue = [];
    const done = new Set();
    for (const ev of q) {
      const { item, col, part, f } = ev;
      if (!this.items.items.includes(item) || done.has(col.handle)) continue;
      const phys = physicalOf(part.mat || 'wood');
      // sound (max ~12 per second per item)
      const now = performance.now();
      if (now - (this.lastSound.get(item.uid) || 0) > 80) {
        this.lastSound.set(item.uid, now);
        this.impactSound(phys.sound, f, item.spec.mass || 10);
      }
      // lamps: a hard knock pops the bulb
      if (item.def?.power && item.lights?.length && f > 900 && !item.state?.bulbBroken) {
        (item.state ||= {}).bulbBroken = true;
        for (const L of item.lights) {
          L.mesh.visible = false;
          const p = new THREE.Vector3(); L.mesh.getWorldPosition(p);
          this.particles.burst(p, 40, { color: 0xf4f6f2, size: 0.006, speed: 1.5 });
        }
        this.shatterSound(0.5);
      }
      if (f > breakForce(part)) {
        done.add(col.handle);
        this.breakPart(item, col, part, f, phys.breaks, ev.other);
      }
    }
    this.particles.update(dt);
  }

  partMeshes(item, part) {
    const out = [];
    for (const g of Object.values(item.groups)) g.traverse((o) => { if (o.isMesh && o.userData.part === part) out.push(o); });
    return out;
  }

  partWorldPose(item, col) {
    const t = col.translation(), r = col.rotation();
    return { pos: new THREE.Vector3(t.x, t.y, t.z), quat: new THREE.Quaternion(r.x, r.y, r.z, r.w) };
  }

  breakPart(item, col, part, force, how, other) {
    if (how === 'dent') { this.dent(item, part, other, force); return; }
    if (!how || how === 'tear') return;
    const body = col.parent();
    const lv = body.linvel();
    const vel = new THREE.Vector3(lv.x, lv.y, lv.z);
    const pose = this.partWorldPose(item, col);
    // remove the part from the item
    this.items.byHandle.delete(col.handle);
    item.colliders = item.colliders.filter((c) => c !== col);
    this.physics.world.removeCollider(col, true);
    for (const m of this.partMeshes(item, part)) m.parent.remove(m);
    const idx = item.spec.parts.indexOf(part);
    (item.state ||= {}).broken = [...(item.state.broken || []), idx];
    body.wakeUp();
    const mat = part.mat || 'wood';
    if (how === 'shatter') {
      const size = part.s === 'box' ? part.size : [part.r * 2 || 0.1, part.h || 0.1, part.r * 2 || 0.1];
      const n = Math.round(Math.min(14, Math.max(5, (size[0] * size[2]) * 40)));
      for (let i = 0; i < n; i++) {
        const off = new THREE.Vector3((Math.random() - 0.5) * size[0], (Math.random() - 0.5) * (size[1] || 0.01), (Math.random() - 0.5) * size[2]).applyQuaternion(pose.quat);
        this.spawnShard(pose.pos.clone().add(off), mat, Math.max(0.025, Math.min(0.12, Math.sqrt(size[0] * size[2]) / 4)), vel);
      }
      this.particles.burst(pose.pos, 140, { color: mat.startsWith('glass') ? 0xe8f4f2 : 0xf6f6f3, size: 0.007, speed: 2.2, vel, life: 60 });
      this.shatterSound(Math.min(1.5, force / 3000));
      return;
    }
    // wood / board / marble / plastic: the part breaks off (big boards split in two)
    const long = part.s === 'box' ? Math.max(...part.size) : (part.h || 0.1);
    const color = mat.startsWith('wood') ? 0x9a7650 : mat.startsWith('board') ? 0xc9b28a : mat.startsWith('marble') ? 0xeeeeee : 0x888888;
    if (part.s === 'box' && long > 0.55) {
      const axis = part.size.indexOf(long);
      const cut = 0.35 + Math.random() * 0.3;
      for (const [lo, hi] of [[0, cut], [cut, 1]]) {
        const size = [...part.size];
        size[axis] = long * (hi - lo);
        const local = [0, 0, 0];
        local[axis] = (lo + hi - 1) / 2 * long;
        const p = pose.pos.clone().add(new THREE.Vector3(...local).applyQuaternion(pose.quat));
        this.spawnDebris({ ...part, size, p: [0, 0, 0], rot: null }, p, pose.quat, vel);
      }
    } else {
      this.spawnDebris({ ...part, p: [0, 0, 0], rot: null }, pose.pos, pose.quat, vel);
    }
    this.particles.burst(pose.pos, 50, { color, size: mat.startsWith('marble') ? 0.01 : 0.006, speed: 1.4, vel });
    this.crackSound(mat, Math.min(1.5, force / 6000));
    if (!item.colliders.some((c) => c.parent() === item.bodies.main)) this.onMessage(`The ${item.def.name} fell apart.`);
  }

  spawnDebris(part, pos, quat, vel) {
    const R = this.R, w = this.physics.world;
    const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }).setLinvel(vel.x, vel.y, vel.z).setCcdEnabled(true));
    const phys = physicalOf(part.mat || 'wood');
    let desc;
    if (part.s === 'box') { const r = Math.min(part.round ?? 0.004, ...part.size.map((s) => s / 2 - 1e-4)); desc = r > 0.0015 ? R.ColliderDesc.roundCuboid(part.size[0] / 2 - r, part.size[1] / 2 - r, part.size[2] / 2 - r, r) : R.ColliderDesc.cuboid(...part.size.map((s) => s / 2)); }
    else if (part.s === 'cyl') desc = R.ColliderDesc.cylinder(part.h / 2, part.r);
    else if (part.s === 'sphere') desc = R.ColliderDesc.ball(part.r);
    else if (part.s === 'capsule') desc = R.ColliderDesc.capsule(part.h / 2, part.r);
    else desc = R.ColliderDesc.ball(0.05);
    w.createCollider(desc.setDensity(phys.density * 0.8).setFriction(phys.friction), body);
    const geo = part.s === 'box' ? new THREE.BoxGeometry(...part.size) : part.s === 'cyl' ? new THREE.CylinderGeometry(part.r, part.r, part.h, 12) : part.s === 'cone' ? new THREE.CylinderGeometry(part.r2, part.r, part.h, 12) : new THREE.SphereGeometry(part.r || 0.05, 10, 8);
    const mesh = new THREE.Mesh(geo, material(part.mat || 'wood'));
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.debris.push({ body, mesh, part });
    this.trimDebris();
  }

  spawnShard(pos, mat, size, vel) {
    const R = this.R, w = this.physics.world;
    // an irregular flat-ish shard
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.6;
      const r = size * (0.4 + Math.random() * 0.6);
      pts.push(Math.cos(a) * r, (Math.random() - 0.5) * size * 0.15, Math.sin(a) * r);
    }
    const arr = new Float32Array(pts);
    const desc = R.ColliderDesc.convexHull(arr);
    if (!desc) return;
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14);
    const v = vel.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 1.8, (Math.random() - 0.5) * 2.5));
    const body = w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinvel(v.x, v.y, v.z).setAngvel(spin).setCcdEnabled(true));
    w.createCollider(desc.setDensity(2500).setFriction(0.3), body);
    const g = new THREE.BufferGeometry();
    const tri = [];
    // fan the hexagon top + bottom
    const P = (i) => [pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]];
    for (let i = 1; i < 5; i++) tri.push(...P(0), ...P(i), ...P(i + 1));
    g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    g.computeVertexNormals();
    const m = material(mat).clone();
    m.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(g, m);
    this.scene.add(mesh);
    this.debris.push({ body, mesh, part: { shard: true, pts, mat } });
    this.trimDebris();
  }

  trimDebris() {
    while (this.debris.length > 180) {
      const d = this.debris.shift();
      this.physics.world.removeRigidBody(d.body);
      this.scene.remove(d.mesh);
    }
  }

  dent(item, part, other, force) {
    const meshes = this.partMeshes(item, part);
    if (!meshes.length || !other) return;
    const ot = other.translation();
    const hit = new THREE.Vector3(ot.x, ot.y, ot.z);
    for (const mesh of meshes) {
      if (!mesh.userData.ownGeo) { mesh.geometry = mesh.geometry.clone(); mesh.userData.ownGeo = true; }
      const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
      const local = hit.clone().applyMatrix4(inv);
      const pos = mesh.geometry.attributes.position;
      let best = Infinity, bi = 0;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); const d = v.distanceToSquared(local); if (d < best) { best = d; bi = i; } }
      const c = new THREE.Vector3().fromBufferAttribute(pos, bi);
      const depth = Math.min(0.025, (force - breakForce(part)) / 60000 + 0.004);
      const n = c.clone().normalize();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const d = v.distanceTo(c);
        if (d < 0.08) { v.addScaledVector(n, -depth * (1 - d / 0.08) ** 2); pos.setXYZ(i, v.x, v.y, v.z); }
      }
      pos.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    this.impactSound('metal', force * 1.5, 50);
  }

  sync() {
    for (const d of this.debris) {
      const t = d.body.translation(), r = d.body.rotation();
      d.mesh.position.set(t.x, t.y, t.z);
      d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  serialize() {
    return this.debris.map((d) => {
      const t = d.body.translation(), r = d.body.rotation();
      return { part: d.part, t: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w] };
    });
  }

  restore(list) {
    for (const d of list || []) {
      const pos = new THREE.Vector3(...d.t), quat = new THREE.Quaternion(...d.q);
      if (d.part.shard) continue; // tiny shards aren't kept between sessions
      this.spawnDebris(d.part, pos, quat, new THREE.Vector3());
    }
  }

  // ---------- sounds ----------
  impactSound(kind, force, mass) {
    const a = this.audio;
    if (!a.ctx) return;
    const g = Math.min(0.5, 0.04 + force / Math.max(400, mass * 120));
    switch (kind) {
      case 'metal':
        for (const [f, d] of [[420, 0.5], [1130, 0.35], [2330, 0.25]]) a.tone({ freq: f * (0.9 + Math.random() * 0.2), dur: d, gain: g * 0.18, type: 'sine' });
        a.burst({ dur: 0.05, freq: 3000, q: 1, gain: g * 0.2 });
        break;
      case 'glass': case 'ceramic':
        for (const f of [1800, 3100, 4700]) a.tone({ freq: f * (0.95 + Math.random() * 0.1), dur: 0.25, gain: g * 0.1, type: 'sine' });
        break;
      case 'soft': a.burst({ dur: 0.12, freq: 180, type: 'lowpass', gain: g * 0.8, buffer: a.brown }); break;
      case 'cardboard': a.burst({ dur: 0.1, freq: 700, q: 1.2, gain: g * 0.6 }); break;
      case 'stone': a.burst({ dur: 0.16, freq: 150, type: 'lowpass', gain: g, buffer: a.brown }); a.burst({ dur: 0.04, freq: 2500, q: 2, gain: g * 0.3 }); break;
      case 'plastic': a.burst({ dur: 0.06, freq: 1400, q: 2, gain: g * 0.5 }); break;
      default: // wood knock
        a.burst({ dur: 0.08, freq: 650 + Math.random() * 300, q: 3, gain: g * 0.7 });
        a.tone({ freq: 170 + Math.random() * 60, freqEnd: 130, dur: 0.12, gain: g * 0.25, type: 'triangle' });
    }
  }

  shatterSound(k) {
    const a = this.audio;
    if (!a.ctx) return;
    a.burst({ dur: 0.5, freq: 3500, q: 0.5, gain: 0.35 * k });
    for (let i = 0; i < 18; i++) a.tone({ freq: 2500 + Math.random() * 5000, dur: 0.06 + Math.random() * 0.12, gain: 0.05 * k, delay: Math.random() * 0.6 });
  }

  crackSound(mat, k) {
    const a = this.audio;
    if (!a.ctx) return;
    a.burst({ dur: 0.07, freq: mat.startsWith('marble') ? 1500 : 2200, q: 1.5, gain: 0.4 * k });
    a.burst({ dur: 0.2, freq: 220, type: 'lowpass', gain: 0.35 * k, buffer: a.brown, delay: 0.01 });
  }

  dispose() {
    this.unhook();
    for (const d of this.debris) { this.physics.world.removeRigidBody(d.body); this.scene.remove(d.mesh); }
    this.scene.remove(this.particles.mesh);
  }
}

export { partQuat };
