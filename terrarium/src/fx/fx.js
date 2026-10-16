// Particles: blood drops that land and leave splats, poofs, sparks, smoke, fire, beams, rain/snow.
import * as THREE from 'three';
import { quality } from '../core/quality.js';
import { rand, clamp } from '../core/util.js';

const MAXP = 2600;
const MAXD = 700;

export class FX {
  constructor(scene) {
    this.scene = scene;
    // particles: one instanced sphere mesh, per-particle color
    this.pGeo = new THREE.IcosahedronGeometry(1, 0);
    this.pMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0 });
    this.pMesh = new THREE.InstancedMesh(this.pGeo, this.pMat, MAXP);
    this.pMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.pMesh.frustumCulled = false;
    this.pMesh.count = 0;
    scene.add(this.pMesh);
    // glowing particles (fire, sparks, zaps)
    this.gMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    this.gMesh = new THREE.InstancedMesh(this.pGeo, this.gMat, 1200);
    this.gMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1200 * 3), 3);
    this.gMesh.frustumCulled = false;
    this.gMesh.count = 0;
    scene.add(this.gMesh);
    // decals (blood splats, scorch marks)
    this.dGeo = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
    this.dMat = new THREE.MeshStandardMaterial({ roughness: 0.25, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.dMesh = new THREE.InstancedMesh(this.dGeo, this.dMat, MAXD);
    this.dMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXD * 3), 3);
    this.dMesh.frustumCulled = false;
    this.dMesh.count = 0;
    this.dMesh.renderOrder = 1;
    scene.add(this.dMesh);
    this.parts = [];
    this.glows = [];
    this.decals = [];
    this.beams = [];
    this.groundFn = () => 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
  }

  // blood burst at pos, dir (spray direction), size = person size in m, amount 0..1
  blood(pos, dir, size, amount = 1, gore = true) {
    if (!gore) return;
    const n = Math.round((8 + amount * 26) * quality.p.blood);
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAXP) this.parts.shift();
      const sp = size * (1.2 + rand() * 2.2) * (0.5 + amount);
      this.parts.push({
        p: pos.clone(), v: new THREE.Vector3((dir ? dir.x : 0) * sp + (rand() - 0.5) * sp, (dir ? dir.y : 0.4) * sp + rand() * sp * 0.8, (dir ? dir.z : 0) * sp + (rand() - 0.5) * sp),
        r: size * (0.012 + rand() * 0.02), life: 3, col: rand() < 0.5 ? 0x8c0b14 : 0xb01020, g: 9.8 * Math.sqrt(size / 1.75), blood: true, size,
      });
    }
  }

  // a dribble from a stump (small, steady)
  drip(pos, size, dir) {
    if (this.parts.length >= MAXP) return;
    const sp = size * 0.6;
    this.parts.push({ p: pos.clone(), v: new THREE.Vector3((dir ? dir.x : 0) * sp + (rand() - 0.5) * sp * 0.3, (dir ? dir.y : 0) * sp, (dir ? dir.z : 0) * sp + (rand() - 0.5) * sp * 0.3), r: size * 0.012, life: 2, col: 0x9a0d18, g: 9.8 * Math.sqrt(size / 1.75), blood: true, size });
  }

  splat(pos, r, col = 0x7a0a12) {
    if (this.decals.length >= MAXD) this.decals.shift();
    this.decals.push({ p: pos.clone(), r, col, rot: rand() * 6.28, age: 0, sx: 0.7 + rand() * 0.6 });
  }

  // colored bits: poof clouds, debris, crumbs
  burst(pos, color, count, size, speed = 1, opts = {}) {
    count = Math.round(count * quality.p.particles);
    for (let i = 0; i < count; i++) {
      const list = opts.glow ? this.glows : this.parts;
      if (list.length >= (opts.glow ? 1200 : MAXP)) list.shift();
      const sp = size * speed * (0.5 + rand());
      const d = new THREE.Vector3(rand() - 0.5, rand() * (opts.up ?? 0.7), rand() - 0.5).normalize();
      list.push({ p: pos.clone(), v: d.multiplyScalar(sp * 3), r: size * (0.03 + rand() * 0.05) * (opts.big || 1), life: opts.life ?? (0.6 + rand() * 0.6), col: Array.isArray(color) ? color[(rand() * color.length) | 0] : color, g: opts.float ? -2 * size : (opts.g ?? 9.8 * Math.sqrt(size / 1.75)), drag: opts.drag ?? 0.92, shrink: true, size });
    }
  }

  fire(pos, size) {
    if (this.glows.length >= 1200) return;
    this.glows.push({ p: pos.clone().add(this.v.set((rand() - 0.5) * size * 0.3, 0, (rand() - 0.5) * size * 0.3)), v: new THREE.Vector3((rand() - 0.5) * size * 0.2, size * (0.8 + rand()), (rand() - 0.5) * size * 0.2), r: size * (0.06 + rand() * 0.06), life: 0.5 + rand() * 0.4, col: rand() < 0.5 ? 0xff7a10 : 0xffc040, g: 0, drag: 0.96, shrink: true, size });
  }

  // straight beam from a to b (shrink ray etc.)
  beam(a, b, color, width, life = 0.18) {
    const len = a.distanceTo(b);
    if (len < 1e-6) return;
    const geo = new THREE.CylinderGeometry(width, width, len, 8, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.frustumCulled = false;
    this.scene.add(m);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.35, width * 0.35, len, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    m.add(core);
    this.beams.push({ m, life, max: life });
  }

  ring(pos, color, radius, life = 0.5) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos);
    m.rotation.x = Math.PI / 2;
    m.scale.setScalar(radius * 0.2);
    this.scene.add(m);
    this.beams.push({ m, life, max: life, grow: radius });
  }

  update(dt) {
    const m = this.m, q = this.q, s = this.s, c = this.c;
    q.identity();
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.v.y -= p.g * dt;
      if (p.drag) p.v.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.p.addScaledVector(p.v, dt);
      const gy = this.groundFn(p.p.x, p.p.z, p.p.y + p.r * 4);
      if (p.p.y < gy + p.r * 0.5) {
        if (p.blood) {
          this.splat(this.v.set(p.p.x, gy + p.size * 0.0015 + 0.0001, p.p.z), p.r * (2 + rand() * 3), p.col);
          this.parts.splice(i, 1); continue;
        }
        p.p.y = gy + p.r * 0.5; p.v.multiplyScalar(0.3);
      }
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
    }
    for (const p of this.parts) {
      if (n >= MAXP) break;
      const r = p.shrink ? p.r * clamp(p.life * 2, 0, 1) : p.r;
      m.compose(p.p, q, s.setScalar(r));
      this.pMesh.setMatrixAt(n, m);
      this.pMesh.setColorAt(n, c.setHex(p.col));
      n++;
    }
    this.pMesh.count = n;
    this.pMesh.instanceMatrix.needsUpdate = true;
    if (this.pMesh.instanceColor) this.pMesh.instanceColor.needsUpdate = true;
    // glows
    n = 0;
    for (let i = this.glows.length - 1; i >= 0; i--) {
      const p = this.glows[i];
      p.life -= dt;
      if (p.life <= 0) { this.glows.splice(i, 1); continue; }
      p.v.y -= (p.g || 0) * dt;
      if (p.drag) p.v.multiplyScalar(Math.pow(p.drag, dt * 60));
      p.p.addScaledVector(p.v, dt);
    }
    for (const p of this.glows) {
      if (n >= 1200) break;
      m.compose(p.p, q, s.setScalar(p.r * clamp(p.life * 2.5, 0, 1)));
      this.gMesh.setMatrixAt(n, m);
      this.gMesh.setColorAt(n, c.setHex(p.col));
      n++;
    }
    this.gMesh.count = n;
    this.gMesh.instanceMatrix.needsUpdate = true;
    if (this.gMesh.instanceColor) this.gMesh.instanceColor.needsUpdate = true;
    // decals (slowly dry darker)
    n = 0;
    for (const d of this.decals) {
      d.age += dt;
      q.setFromAxisAngle(this.v.set(0, 1, 0), d.rot);
      m.compose(d.p, q, s.set(d.r * d.sx, 1, d.r));
      this.dMesh.setMatrixAt(n, m);
      c.setHex(d.col).multiplyScalar(clamp(1 - d.age / 400, 0.45, 1));
      this.dMesh.setColorAt(n, c);
      n++;
    }
    this.dMesh.count = n;
    this.dMesh.instanceMatrix.needsUpdate = true;
    if (this.dMesh.instanceColor) this.dMesh.instanceColor.needsUpdate = true;
    // beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      const k = clamp(b.life / b.max, 0, 1);
      b.m.material.opacity = k * 0.9;
      if (b.grow) b.m.scale.setScalar(b.grow * (1.2 - k));
      if (b.life <= 0) {
        this.scene.remove(b.m);
        b.m.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        this.beams.splice(i, 1);
      }
    }
  }

  clearDecals() { this.decals.length = 0; }

  save() { return this.decals.slice(-300).map((d) => [d.p.x, d.p.y, d.p.z, d.r, d.col]); }
  load(arr) { this.decals = (arr || []).map(([x, y, z, r, col]) => ({ p: new THREE.Vector3(x, y, z), r, col, rot: rand() * 6.28, age: 300, sx: 1 })); }
}
