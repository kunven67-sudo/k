// Everything lying on the land: real scanned boulders, rocks, plants, grass, stones, bark, moss,
// then (as you shrink) gravel, sand grains, silt, bacteria and viruses. All placed by the land's seed,
// so the same spot always has the same stuff.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cellRand } from './noise.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

// split a loaded glTF scene into separate variants (one per mesh), each sitting on y=0, centered
export function variantsFrom(gltf, filter, upNormals = false) {
  const out = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh || (filter && !filter(o.name))) return;
    const g = o.geometry.clone();
    // compressed files keep positions as small integers: turn them into real numbers before moving them
    for (const k of Object.keys(g.attributes)) { const a = g.attributes[k]; if (!(a.array instanceof Float32Array)) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); } }
    g.applyMatrix4(o.matrixWorld); g.computeBoundingBox();
    const b = g.boundingBox, c = new THREE.Vector3(); b.getCenter(c);
    g.translate(-c.x, -b.min.y, -c.z); g.computeBoundingBox(); g.computeBoundingSphere();
    if (upNormals) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) { const y = g.attributes.position.getY(i) / Math.max(1e-6, g.boundingBox.max.y); n.setXYZ(i, n.getX(i) * 0.25, 1, n.getZ(i) * 0.25); } g.normalizeNormals?.(); }
    const m = o.material; if (m.map) m.map.anisotropy = 4;
    if (m.alphaTest > 0 || m.transparent) { m.transparent = false; m.alphaTest = 0.45; m.side = THREE.DoubleSide; }
    nearFade(m, upNormals);
    if (upNormals) { m.normalScale?.set(0.5, 0.5); m.aoMapIntensity = 0.5; }
    out.push({ geo: g, mat: m, size: g.boundingBox.getSize(new THREE.Vector3()), name: o.name });
  });
  return out;
}

// things right in front of the camera dissolve instead of filling the screen
export function nearFade(m, foliage = false) {
  if (m.userData.nearFade) return; m.userData.nearFade = true;
  m.onBeforeCompile = sh => {
    // leaves: light both sides the same (no dark backs)
    if (foliage) sh.fragmentShader = sh.fragmentShader.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
{ float d = length(vViewPosition); float f = smoothstep(0.7, 2.2, d); float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); if (f < n) discard; }`);
  };
}

export class Scatter {
  constructor(land, parent) { this.land = land; this.parent = parent; this.classes = []; this.colliders = []; this.O = { x: 0, y: 0, z: 0 }; }
  add(def) {
    const C = { ...def, meshes: [], last: null, n: 0 };
    C.variants.forEach((v, i) => {
      nearFade(v.mat);
      const im = new THREE.InstancedMesh(v.geo, v.mat, def.cap || 2000);
      im.count = 0; im.castShadow = !!def.shadow; im.receiveShadow = true; im.frustumCulled = false;
      this.parent.add(im); C.meshes.push(im);
    });
    this.classes.push(C); return C;
  }
  setOrigin(O) { this.O = { ...O }; for (const C of this.classes) C.last = null; }
  update(P, k, maxBuilds = 3) {
    let builds = 0;
    this.colliders.length = 0;
    for (const C of this.classes) {
      const on = k >= C.kMin && k <= C.kMax;
      if (!on) { if (C.n) { C.meshes.forEach(m => m.count = 0); C.n = 0; } C.last = null; continue; }
      const R = Math.min(C.rMax, Math.max(C.rMin, C.rBH * 1.8 * k));
      const L = C.last;
      const need = !L || Math.hypot(P.x - L.x, P.z - L.z) > Math.max(C.cell * 1.5, R * 0.12) || Math.abs(Math.log(k / L.k)) > 0.15;
      if (need && builds < maxBuilds) { this.build(C, P, k, R); builds++; }
      if (C.collide) for (const c of C.cols || []) this.colliders.push(c);
    }
    return builds;
  }
  build(C, P, k, R) {
    const land = this.land, O = this.O, cell = C.cell;
    const counts = new Array(C.meshes.length).fill(0);
    const i0 = Math.floor((P.x - R) / cell), i1 = Math.floor((P.x + R) / cell);
    const j0 = Math.floor((P.z - R) / cell), j1 = Math.floor((P.z + R) / cell);
    const cols = []; const cap = C.cap || 2000;
    const wsum = C.variants.reduce((a, v) => a + (v.w || 1), 0);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const r = cellRand(i, j, C.id);
      if (r() > C.prob) continue;
      const x = (i + r()) * cell, z = (j + r()) * cell;
      const dx = x - P.x, dz = z - P.z; if (dx * dx + dz * dz > R * R) continue;
      if (C.where && !C.where(x, z, r)) continue;
      let pick = r() * wsum, vi = 0; for (; vi < C.variants.length - 1; vi++) { pick -= C.variants[vi].w || 1; if (pick <= 0) break; }
      if (counts[vi] >= cap) continue;
      const v = C.variants[vi];
      const sc = (C.sMin + (C.sMax - C.sMin) * Math.pow(r(), 1.6)) * (C.unit || 1);
      const h = v.size.y * sc, wide = Math.max(v.size.x, v.size.z) * sc;
      const y = land.height(x, z, Math.max(wide * 0.6, 1e-9)) - h * (C.sink || 0);
      const yaw = r() * Math.PI * 2, tilt = (r() - 0.5) * (C.tilt || 0), tilt2 = (r() - 0.5) * (C.tilt || 0);
      _e.set(tilt, yaw, tilt2); _q.setFromEuler(_e); _s.set(sc, sc * (C.squash ? 0.6 + r() * 0.5 : 1), sc);
      _p.set(x - O.x, y - O.y, z - O.z); _m.compose(_p, _q, _s);
      C.meshes[vi].setMatrixAt(counts[vi]++, _m);
      if (C.collide) cols.push({ x, z, y: y + h * (C.squash ? 0.8 : 1) * (1 - (C.sink || 0)) * 0.95 + h * (C.sink || 0) * 0, base: y, rx: v.size.x * sc * 0.45, rz: v.size.z * sc * 0.45, h: h * (1 - (C.sink || 0)), yaw, kind: C.kind || 'rock' });
    }
    C.meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
    C.n = counts.reduce((a, b) => a + b, 0); C.cols = cols;
    C.last = { x: P.x, z: P.z, k };
  }
  // the top of whatever you're standing on at x,z (meters). Returns -Infinity if nothing.
  topAt(x, z) {
    let best = -Infinity, kind = null;
    for (const c of this.colliders) {
      const dx = x - c.x, dz = z - c.z;
      const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
      const lx = (dx * cs - dz * sn) / c.rx, lz = (dx * sn + dz * cs) / c.rz;
      const d = lx * lx + lz * lz; if (d >= 1) continue;
      const top = c.base + c.h * Math.sqrt(1 - d);
      if (top > best) { best = top; kind = c.kind; }
    }
    return { top: best, kind };
  }
}

// ---------- shapes for the very small stuff (made from real measurements) ----------
export function grainGeo(seed = 1, detail = 2) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const p = g.attributes.position, v = new THREE.Vector3();
  const r = cellRand(seed, 7, 11), a = [r() * 9, r() * 9, r() * 9];
  const sx = 0.75 + r() * 0.5, sz = 0.75 + r() * 0.5;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 7 + a[0]) * Math.cos(v.y * 6 + a[1]) * Math.sin(v.z * 8 + a[2]) * 0.12 + Math.sin(v.x * 17 + v.z * 13 + a[1]) * 0.03;
    v.multiplyScalar(1 + n); v.x *= sx; v.z *= sz; v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('normal'); g.computeVertexNormals();
  g.computeBoundingBox(); const b = g.boundingBox; g.translate(0, -b.min.y, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
// bacterium (rod shaped, like the soil bacteria Bacillus: ~0.8 um wide, 2-4 um long), units = 1 um
export function bacteriumGeo(seed, flagella = true) {
  const r = cellRand(seed, 3, 5), len = 1.6 + r() * 2.2, rad = 0.38 + r() * 0.12;
  const body = new THREE.CapsuleGeometry(rad, len, 10, 18);
  const p = body.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const bend = Math.sin(v.y / len * 2.2 + r() * 0) * 0.08 * len; v.x += bend * (v.y / len); v.multiplyScalar(1 + Math.sin(v.y * 9 + v.x * 6) * 0.015); p.setXYZ(i, v.x, v.y, v.z); }
  body.rotateZ(Math.PI / 2);
  const parts = [body];
  if (flagella) for (let f = 0; f < 5; f++) {
    const pts = []; const sy = (r() - 0.5) * rad, sz = (r() - 0.5) * rad, dir = r() < 0.5 ? -1 : 1;
    for (let t = 0; t <= 24; t++) { const u = t / 24; pts.push(new THREE.Vector3(dir * (len / 2 + rad * 0.8 + u * (3 + r() * 2)), sy + Math.sin(u * 14 + f) * 0.25 * u, sz + Math.cos(u * 14 + f) * 0.25 * u)); }
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 4, false));
  }
  const g = mergeGeometries(parts.map(x => { x.deleteAttribute('uv'); return x.index ? x.toNonIndexed() : x; }));
  g.computeVertexNormals(); g.computeBoundingBox(); const b = g.boundingBox, c = new THREE.Vector3(); b.getCenter(c);
  g.translate(-c.x, -b.min.y, -c.z); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
// coccus clusters (round bacteria like Staphylococcus, ~1 um each)
export function coccusGeo(seed) {
  const r = cellRand(seed, 9, 2), parts = [];
  const n = 4 + Math.floor(r() * 9);
  const pts = [new THREE.Vector3()];
  for (let i = 1; i < n; i++) { const b = pts[Math.floor(r() * pts.length)]; const d = new THREE.Vector3(r() - 0.5, (r() - 0.3) * 0.6, r() - 0.5).normalize().multiplyScalar(0.92); pts.push(b.clone().add(d)); }
  for (const q of pts) { const s = new THREE.SphereGeometry(0.5 + r() * 0.06, 16, 12); s.translate(q.x, q.y, q.z); s.deleteAttribute('uv'); parts.push(s.toNonIndexed()); }
  const g = mergeGeometries(parts); g.computeVertexNormals(); g.computeBoundingBox(); const b = g.boundingBox, c = new THREE.Vector3(); b.getCenter(c);
  g.translate(-c.x, -b.min.y, -c.z); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
// bacteriophage (virus that eats bacteria, like T4: head ~0.1 um, total ~0.2 um), units = 0.1 um
export function phageGeo() {
  const parts = [];
  const head = new THREE.IcosahedronGeometry(0.42, 0); head.scale(0.85, 1.25, 0.85); head.translate(0, 1.55, 0); parts.push(head);
  const collar = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12); collar.translate(0, 1.0, 0); parts.push(collar);
  const tail = new THREE.CylinderGeometry(0.09, 0.09, 0.95, 12); tail.translate(0, 0.5, 0); parts.push(tail);
  const sheath = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12, 8); sheath.translate(0, 0.52, 0); parts.push(sheath);
  const plate = new THREE.CylinderGeometry(0.22, 0.26, 0.06, 6); plate.translate(0, 0.04, 0); parts.push(plate);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const pts = [new THREE.Vector3(c * 0.2, 0.05, s * 0.2), new THREE.Vector3(c * 0.55, 0.35, s * 0.55), new THREE.Vector3(c * 0.85, 0.0, s * 0.85)];
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 10, 0.022, 5, false));
  }
  const g = mergeGeometries(parts.map(x => { x.deleteAttribute('uv'); return x.index ? x.toNonIndexed() : x; }));
  g.computeVertexNormals(); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
