// Streaming lawn: tens of thousands of instanced, wind-swayed grass blades generated in chunks
// around the player (deterministic per chunk, so the lawn never "reshuffles"). Cutting grass
// with the axe removes blades inside cut circles.
import * as THREE from 'three';
import { hash2, mulberry32 } from '../core/noise.js';
import { addWind } from '../core/materials.js';

const CHUNK = 16;

function bladeGeometry(segments = 5) {
  const g = new THREE.PlaneGeometry(1, 1, 1, segments);
  g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const x = p.getX(i);
    const taper = Math.pow(1 - y, 0.8);
    p.setX(i, x * taper);
    p.setZ(i, y * y * 0.35); // natural forward curl
    const c = 0.28 + y * 0.72;
    col.push(c, c, c);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function clumpGeometry() {
  const parts = [];
  const base = bladeGeometry(3);
  for (let i = 0; i < 4; i++) {
    const b = base.clone();
    const m = new THREE.Matrix4().makeRotationY(i * 1.7).multiply(new THREE.Matrix4().makeTranslation(Math.cos(i * 2.3) * 0.5, 0, Math.sin(i * 2.3) * 0.5)).multiply(new THREE.Matrix4().makeScale(1, 0.75 + (i % 2) * 0.35, 1));
    b.applyMatrix4(m);
    parts.push(b);
  }
  // merge manually
  let count = 0; parts.forEach((p) => { count += p.attributes.position.count; });
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const idx = [];
  let off = 0;
  parts.forEach((p) => {
    pos.set(p.attributes.position.array, off * 3); nor.set(p.attributes.normal.array, off * 3); col.set(p.attributes.color.array, off * 3);
    for (let i = 0; i < p.index.count; i++) idx.push(p.index.getX(i) + off);
    off += p.attributes.position.count;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export class Grass {
  constructor(scene, { groundFn, exclude, density = 1, nearR = 56, farR = 130, height = [5, 12] }) {
    this.groundFn = groundFn;
    this.exclude = exclude;
    this.density = density;
    this.nearR = nearR; this.farR = farR;
    this.height = height;
    this.cuts = [];
    this.cache = new Map();
    this.lastKey = null;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
    addWind(mat, 1.1, 1, true);
    this.mat = mat;
    const nearMax = Math.ceil(Math.PI * nearR * nearR * 1.35 * density) + 500;
    const farMax = Math.ceil(Math.PI * (farR * farR - nearR * nearR) * 0.16 * density) + 500;
    this.near = new THREE.InstancedMesh(bladeGeometry(5), mat, nearMax);
    this.far = new THREE.InstancedMesh(clumpGeometry(), mat, farMax);
    for (const m of [this.near, this.far]) {
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.count * 3), 3);
      m.frustumCulled = false;
      m.castShadow = false; m.receiveShadow = true;
      m.count = 0;
      scene.add(m);
    }
    this.near.castShadow = density >= 0.8;
    this.nearMax = nearMax; this.farMax = farMax;
  }

  cut(x, z, r = 2.2) {
    this.cuts.push([x, z, r]);
    if (this.cuts.length > 400) this.cuts.shift();
    // invalidate affected chunks
    const c0x = Math.floor((x - r) / CHUNK), c1x = Math.floor((x + r) / CHUNK), c0z = Math.floor((z - r) / CHUNK), c1z = Math.floor((z + r) / CHUNK);
    for (let a = c0x; a <= c1x; a++) for (let b = c0z; b <= c1z; b++) { this.cache.delete(`n${a},${b}`); this.cache.delete(`f${a},${b}`); }
    this.lastKey = null;
  }

  // Is there uncut lawn grass at (x, z)?
  hasGrass(x, z) {
    if (this.exclude(x, z)) return false;
    for (const [cx, cz, r] of this.cuts) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
    return true;
  }

  chunk(kind, cx, cz) {
    const key = `${kind}${cx},${cz}`;
    let c = this.cache.get(key);
    if (c) return c;
    const rnd = mulberry32(Math.floor(hash2(cx, cz, kind === 'n' ? 11 : 23) * 4294967295));
    const dens = kind === 'n' ? 1.3 * this.density : 0.15 * this.density;
    const n = Math.round(CHUNK * CHUNK * dens);
    const mats = [], cols = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const x = (cx + rnd()) * CHUNK, z = (cz + rnd()) * CHUNK;
      const yaw = rnd() * Math.PI * 2, lean = (rnd() - 0.5) * 0.35, hr = rnd(), cr = rnd();
      if (this.exclude(x, z)) continue;
      let cutHere = false;
      for (const [ccx, ccz, r] of this.cuts) if ((x - ccx) ** 2 + (z - ccz) ** 2 < r * r) { cutHere = true; break; }
      const h = this.height[0] + hr * (this.height[1] - this.height[0]);
      const y = this.groundFn(x, z);
      p.set(x, y - 0.1, z);
      e.set(lean, yaw, lean * 0.5);
      q.setFromEuler(e);
      if (cutHere) s.set(kind === 'n' ? 0.7 : 2.4, 0.6 + hr * 0.3, 1); // stubble
      else s.set(kind === "n" ? 0.38 + cr * 0.3 : 2, h * (kind === "n" ? 1 : 0.85), 1);
      m.compose(p, q, s);
      mats.push(...m.elements);
      // greens with some dry, yellowed blades
      const dry = cr > 0.9 ? 1 : 0;
      cols.push(dry ? 0.62 : 0.2 + cr * 0.12, dry ? 0.56 : 0.42 + cr * 0.2, dry ? 0.26 : 0.1 + cr * 0.05);
    }
    c = { mats: new Float32Array(mats), cols: new Float32Array(cols) };
    this.cache.set(key, c);
    if (this.cache.size > 900) { const first = this.cache.keys().next().value; this.cache.delete(first); }
    return c;
  }

  update(pos) {
    const pcx = Math.floor(pos.x / CHUNK), pcz = Math.floor(pos.z / CHUNK);
    const key = `${pcx},${pcz}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const fill = (mesh, kind, rMin, rMax, max) => {
      let count = 0;
      const R = Math.ceil(rMax / CHUNK);
      const arr = mesh.instanceMatrix.array, carr = mesh.instanceColor.array;
      for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) {
        const ccx = pcx + a, ccz = pcz + b;
        const dx = (ccx + 0.5) * CHUNK - pos.x, dz = (ccz + 0.5) * CHUNK - pos.z;
        const d = Math.hypot(dx, dz);
        if (d > rMax + CHUNK * 0.7 || d < rMin - CHUNK * 0.7) continue;
        const c = this.chunk(kind, ccx, ccz);
        const n = c.mats.length / 16;
        if (count + n > max) break;
        arr.set(c.mats, count * 16);
        carr.set(c.cols, count * 3);
        count += n;
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    };
    fill(this.near, 'n', 0, this.nearR, this.nearMax);
    fill(this.far, 'f', this.nearR, this.farR, this.farMax);
  }

  setVisible(v) { this.near.visible = this.far.visible = v; }
}
