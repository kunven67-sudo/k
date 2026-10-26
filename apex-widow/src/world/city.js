// New Halvern: a rainy East Coast city around the VOSS tower. Streets on a 110 m grid (90 m blocks, 20 m streets),
// thousands of instanced buildings with lit rooms behind the windows, painted road markings, raised sidewalks,
// the harbor to the east with a suspension bridge to the far shore.
import * as THREE from 'three';
import { makeFacadeMaterial } from './facade.js';
import { rng } from '../core/util.js';
import { texture, hasAsset } from '../core/assets.js';

export const PITCH = 110, BLOCK = 90, ROAD = 7, CURB = 0.15, NB = 11; // blocks from -NB..NB
export const SHORE = 1300, FAR_SHORE = 2450;

const _inv = new THREE.Vector3();

// ------------------------------------------------------------------ collision: block slabs + building boxes in a grid
class CityGrid {
  constructor() { this.cells = new Map(); this.all = []; }
  key(i, j) { return i * 1000 + j; }
  add(b) { // b = {min, max, ...}
    this.all.push(b);
    const i0 = Math.floor((b.min.x + PITCH / 2) / PITCH), i1 = Math.floor((b.max.x + PITCH / 2) / PITCH);
    const j0 = Math.floor((b.min.z + PITCH / 2) / PITCH), j1 = Math.floor((b.max.z + PITCH / 2) / PITCH);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = this.key(i, j); if (!this.cells.has(k)) this.cells.set(k, []); this.cells.get(k).push(b); }
  }
  // ray vs boxes in the cells the ray passes (2D DDA over x/z)
  probe(o, d, far, size) {
    let best = null;
    const test = (list) => {
      for (const b of list) {
        if (b.gone || size > b.maxSize) continue;
        const h = rayBox(o, d, b.min, b.max, best ? best.distance : far);
        if (h) best = { point: new THREE.Vector3().copy(o).addScaledVector(d, h.t), normal: h.n, distance: h.t, tag: b.tag || 'city', obj: b };
      }
    };
    let ci = Math.floor((o.x + PITCH / 2) / PITCH), cj = Math.floor((o.z + PITCH / 2) / PITCH);
    const stepI = d.x > 0 ? 1 : -1, stepJ = d.z > 0 ? 1 : -1;
    const nx = (ci + (stepI > 0 ? 1 : 0)) * PITCH - PITCH / 2, nz = (cj + (stepJ > 0 ? 1 : 0)) * PITCH - PITCH / 2;
    let tMaxX = Math.abs(d.x) > 1e-12 ? (nx - o.x) / d.x : Infinity, tMaxZ = Math.abs(d.z) > 1e-12 ? (nz - o.z) / d.z : Infinity;
    const tDX = Math.abs(d.x) > 1e-12 ? PITCH / Math.abs(d.x) : Infinity, tDZ = Math.abs(d.z) > 1e-12 ? PITCH / Math.abs(d.z) : Infinity;
    let t = 0;
    for (let guard = 0; guard < 400 && t <= far; guard++) {
      const L = this.cells.get(this.key(ci, cj)); if (L) test(L);
      if (best && best.distance <= Math.min(tMaxX, tMaxZ)) break;
      if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDX; ci += stepI; } else { t = tMaxZ; tMaxZ += tDZ; cj += stepJ; }
    }
    return best;
  }
  closest(p, maxD, size) {
    let best = null;
    const i0 = Math.floor((p.x - maxD + PITCH / 2) / PITCH), i1 = Math.floor((p.x + maxD + PITCH / 2) / PITCH);
    const j0 = Math.floor((p.z - maxD + PITCH / 2) / PITCH), j1 = Math.floor((p.z + maxD + PITCH / 2) / PITCH);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const L = this.cells.get(this.key(i, j)); if (!L) continue;
      for (const b of L) {
        if (b.gone || size > b.maxSize) continue;
        const q = new THREE.Vector3(Math.max(b.min.x, Math.min(p.x, b.max.x)), Math.max(b.min.y, Math.min(p.y, b.max.y)), Math.max(b.min.z, Math.min(p.z, b.max.z)));
        const dist = q.distanceTo(p); if (dist > maxD || (best && dist >= best.distance)) continue;
        const n = dist > 1e-9 ? new THREE.Vector3().subVectors(p, q).divideScalar(dist) : new THREE.Vector3(0, 1, 0);
        best = { point: q, normal: n, distance: dist, obj: b };
      }
    }
    return best;
  }
}
function rayBox(o, d, mn, mx, far) {
  let t0 = 0, t1 = far, ax = -1, sg = 1;
  for (let k = 0; k < 3; k++) {
    const c = k === 0 ? 'x' : k === 1 ? 'y' : 'z';
    const iv = 1 / (d[c] || 1e-12);
    let ta = (mn[c] - o[c]) * iv, tb = (mx[c] - o[c]) * iv, s = -1;
    if (ta > tb) { const tt = ta; ta = tb; tb = tt; s = 1; }
    if (ta > t0) { t0 = ta; ax = k; sg = s; }
    if (tb < t1) t1 = tb;
    if (t0 > t1) return null;
  }
  if (ax < 0) return null;
  const n = new THREE.Vector3(); n.setComponent(ax, sg);
  return { t: t0, n };
}

// the street level ground: an analytic plane at y = 0 (except under the tower, which has real floors + a pit)
class Ground {
  constructor(city) { this.city = city; }
  probe(o, d, far) {
    if (d.y >= -1e-9) { if (o.y >= 0) return null; }
    const t = (0 - o.y) / d.y; if (t < 0 || t > far) return null;
    const x = o.x + d.x * t, z = o.z + d.z * t;
    if (Math.abs(x) < 22.4 && Math.abs(z) < 22.4) return null;
    if (x > SHORE && x < FAR_SHORE) return null; // the harbor (water)
    return { point: new THREE.Vector3(x, 0, z), normal: new THREE.Vector3(0, o.y >= 0 ? 1 : -1, 0), distance: t, tag: 'street' };
  }
  closest(p, maxD) {
    if (Math.abs(p.x) < 22.4 && Math.abs(p.z) < 22.4) return null;
    if (p.x > SHORE && p.x < FAR_SHORE) return null;
    const dist = Math.abs(p.y); if (dist > maxD) return null;
    return { point: new THREE.Vector3(p.x, 0, p.z), normal: new THREE.Vector3(0, p.y >= 0 ? 1 : -1, 0), distance: dist };
  }
}

export class City {
  constructor(zone) {
    this.zone = zone; this.scene = zone.scene;
    this.grid = new CityGrid();
    this.fixtures = [];
    this.buildings = [];
    this.rain = 0.6;
  }
  async build() {
    const S = this.scene, R = rng(8008);
    this.zone.collision.analytic.push(this.grid, new Ground(this));
    // ---------- ground: asphalt with painted markings (one huge plane)
    const gmat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.9 });
    if (hasAsset('tex/asphalt_col.webp')) {
      gmat.map = await texture('tex/asphalt_col.webp', { aniso: 16 }); gmat.normalMap = await texture('tex/asphalt_nrm.webp', { srgb: false, aniso: 16 });
      const arm = await texture('tex/asphalt_arm.webp', { srgb: false }); gmat.roughnessMap = arm;
    }
    gmat.onBeforeCompile = (sh) => {
      sh.uniforms.uWet = { value: this.rain };
      this.groundU = sh.uniforms;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vGW; uniform float uWet;
          float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1,0)), f.x), mix(gh(i + vec2(0,1)), gh(i + vec2(1,1)), f.x), f.y); }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 gw = vGW.xz;
          vec2 uvA = gw / 4.0;
          // nearest street centre lines (streets every 110 m, offset 55 m from the block centres)
          vec2 u = gw - 55.0; vec2 c = u - 110.0 * floor(u / 110.0 + 0.5);
          vec2 ac = abs(c);
          float paint = 0.0; vec3 pcol = vec3(0.92);
          // N-S streets (run along z): |c.x| < 7, away from crossings
          if (ac.x < 7.0 && ac.y > 10.5) {
            if (ac.x > 0.08 && ac.x < 0.2) { paint = 1.0; pcol = vec3(0.9, 0.68, 0.12); }
            if (abs(ac.x - 3.5) < 0.06 && fract(gw.y / 9.0) < 0.34) paint = 1.0;
            if (ac.y < 11.0 && c.x * sign(c.y) < 0.0) paint = 1.0;
          }
          if (ac.y < 7.0 && ac.x > 10.5) {
            if (ac.y > 0.08 && ac.y < 0.2) { paint = 1.0; pcol = vec3(0.9, 0.68, 0.12); }
            if (abs(ac.y - 3.5) < 0.06 && fract(gw.x / 9.0) < 0.34) paint = 1.0;
            if (ac.x < 11.0 && c.y * sign(c.x) > 0.0) paint = 1.0;
          }
          // crosswalks (zebra) just outside each crossing
          if (ac.x < 7.0 && ac.y > 7.4 && ac.y < 10.2 && fract(gw.x / 1.1) < 0.5) paint = 1.0;
          if (ac.y < 7.0 && ac.x > 7.4 && ac.x < 10.2 && fract(gw.y / 1.1) < 0.5) paint = 1.0;
          paint *= 0.75 + 0.25 * gn(gw * 3.0); // worn paint
          diffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.55, 0.56, 0.58), pcol, paint * 0.85);
          float puddle = smoothstep(0.55, 0.7, gn(gw * 0.35) * 0.7 + gn(gw * 1.7) * 0.3) * uWet;
          diffuseColor.rgb *= 1.0 - 0.35 * uWet - 0.25 * puddle;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.06, puddle);
          roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.45, uWet);`);
    };
    const gsz = 12000;
    const ggeo = new THREE.PlaneGeometry(gsz, gsz, 1, 1); ggeo.rotateX(-Math.PI / 2);
    // cut the harbor out: build the ground as 2 strips around the water
    const west = new THREE.PlaneGeometry(SHORE + gsz / 2, gsz); west.rotateX(-Math.PI / 2); west.translate((SHORE - gsz / 2) / 2, 0, 0);
    const east = new THREE.PlaneGeometry(gsz / 2 - FAR_SHORE, gsz); east.rotateX(-Math.PI / 2); east.translate((FAR_SHORE + gsz / 2) / 2, 0, 0);
    for (const g of [west, east]) { const uv = g.attributes.uv, p = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 4, -p.getZ(i) / 4); }
    for (const g of [west, east]) { const m = new THREE.Mesh(g, gmat); m.receiveShadow = true; m.name = 'street'; S.add(m); }
    this.gmat = gmat;
    // ---------- blocks: raised sidewalk slabs + buildings
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 0.75 });
    if (hasAsset('tex/sidewalk_col.webp')) { sideMat.map = await texture('tex/sidewalk_col.webp', { aniso: 16 }); sideMat.normalMap = await texture('tex/sidewalk_nrm.webp', { srgb: false }); }
    const slabG = []; const blds = [];
    for (let i = -NB; i <= NB; i++) for (let j = -NB; j <= NB; j++) {
      const cx = i * PITCH, cz = j * PITCH;
      if (cx + BLOCK / 2 > SHORE) continue;
      const r = Math.hypot(cx, cz);
      const park = (i >= -9 && i <= -6 && j >= 4 && j <= 7);
      const stadium = (i >= -7 && i <= -6 && j >= -8 && j <= -7);
      // the tower block's slab goes around the tower (the lobby floor is at street level)
      const pieces = (i === 0 && j === 0) ? [[-45, -45, 45, -22.3], [-45, 22.3, 45, 45], [-45, -22.3, -22.3, 22.3], [22.3, -22.3, 45, 22.3]] : [[cx - BLOCK / 2, cz - BLOCK / 2, cx + BLOCK / 2, cz + BLOCK / 2]];
      for (const [ax, az, bx, bz] of pieces) {
        const g = new THREE.BoxGeometry(bx - ax, CURB, bz - az); g.translate((ax + bx) / 2, CURB / 2, (az + bz) / 2);
        const uv = g.attributes.uv, p = g.attributes.position;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) / 3 + p.getY(k) / 3, p.getZ(k) / 3);
        slabG.push(g);
        this.grid.add({ min: new THREE.Vector3(ax, -0.01, az), max: new THREE.Vector3(bx, CURB, bz), maxSize: 1e9, tag: 'sidewalk', slab: true });
      }
      if (i === 0 && j === 0) continue; // the VOSS tower block (plaza)
      if (park || stadium) continue;
      // lots: split the block into 1-4 buildings with a 3 m sidewalk around
      const down = Math.max(0, 1 - r / 700), mid = Math.max(0, 1 - r / 1300);
      const lots = R() < 0.3 ? [[0, 0, 84, 84]] : R() < 0.5 ? [[-21.5, 0, 41, 84], [21.5, 0, 41, 84]] : [[-21.5, -21.5, 41, 41], [21.5, -21.5, 41, 41], [-21.5, 21.5, 41, 41], [21.5, 21.5, 41, 41]];
      for (const [lx, lz, w, d] of lots) {
        const style = down > 0.25 ? (R() < 0.75 ? 0 : 2) : mid > 0.2 ? (R() < 0.6 ? 1 : 2) : (R() < 0.8 ? 1 : 2);
        let h = style === 0 ? 40 + R() * (60 + 220 * down * down) : style === 1 ? 12 + R() * (20 + 40 * mid) : 18 + R() * (30 + 90 * down);
        if (R() < 0.05 * down) h += 120;
        const inset = R() * 4;
        const bw = w - inset * 2, bd = d - inset * 2;
        blds.push({ x: cx + lx, z: cz + lz, w: bw, d: bd, h, style, seed: R() * 100, fh: style === 1 ? 3.2 : style === 2 ? 3.8 : 4.0 });
        // setback towers: a narrower top section on tall ones
        if (h > 120 && R() < 0.6) blds.push({ x: cx + lx, z: cz + lz, w: bw * 0.62, d: bd * 0.62, h: h * (0.25 + R() * 0.25), y0: h, style, seed: R() * 100, fh: 4.0 });
      }
    }
    const slab = new THREE.Mesh(mergeAll(slabG), sideMat); slab.receiveShadow = true; S.add(slab);
    // ---------- buildings: one instanced draw for all of them
    const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(box, makeFacadeMaterial({ instanced: true }), blds.length);
    const aB = new Float32Array(blds.length * 4);
    const M = new THREE.Matrix4();
    blds.forEach((b, k) => {
      const y0 = (b.y0 || 0) + CURB;
      M.makeScale(b.w, b.h, b.d); M.setPosition(b.x, y0, b.z); im.setMatrixAt(k, M);
      aB.set([b.style, b.seed, b.fh, y0], k * 4);
      b.index = k; b.y0 = y0;
      b.box = { min: new THREE.Vector3(b.x - b.w / 2, y0, b.z - b.d / 2), max: new THREE.Vector3(b.x + b.w / 2, y0 + b.h, b.z + b.d / 2), maxSize: 1e9, tag: 'building', bld: b };
      this.grid.add(b.box);
    });
    box.setAttribute('aBld', new THREE.InstancedBufferAttribute(aB, 4));
    im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
    S.add(im); this.bim = im; this.blds = blds;
    // ---------- the VOSS plaza (granite) with planters + street lamps around the tower block
    await this.buildPlaza();
    // ---------- street lamps along every street (the nearest ones are real lights)
    this.buildLamps();
    // ---------- harbor water + the bridge + far shore
    this.buildWater(); this.buildBridge();
    // fog / haze
    this.scene.fog = new THREE.FogExp2(0x101418, 0.00055);
  }

  // street lamps: posts drawn near the camera (instanced), a warm glowing dot for every lamp in the city, and every
  // lamp is a fixture so the light pool lights the street wherever you are
  buildLamps() {
    const L = [];
    for (let i = -NB; i <= NB; i++) for (let j = -NB; j <= NB; j++) {
      const cx = i * PITCH, cz = j * PITCH;
      if (cx + BLOCK / 2 > SHORE || (i === 0 && j === 0)) continue;
      for (const e of [-1, 1]) for (const k of [-30, 0, 30]) {
        L.push({ x: cx + k, z: cz + e * 44.3, ox: 0, oz: e * 1.2, rot: e > 0 ? 0 : Math.PI });
        L.push({ x: cx + e * 44.3, z: cz + k, ox: e * 1.2, oz: 0, rot: e > 0 ? Math.PI / 2 : -Math.PI / 2 });
      }
    }
    this.lamps = L;
    for (const l of L) this.fixtures.push({ p: new THREE.Vector3(l.x + l.ox, CURB + 7.1, l.z + l.oz), color: 0xffb070, i: 7, r: 32 });
    const poleG = mergeAll([
      (() => { const g = new THREE.CylinderGeometry(0.07, 0.11, 7.5, 8); g.translate(0, CURB + 3.75, 0); return g; })(),
      (() => { const g = new THREE.BoxGeometry(0.1, 0.08, 1.3); g.translate(0, CURB + 7.45, 0.6); return g; })(),
      (() => { const g = new THREE.BoxGeometry(0.28, 0.12, 0.5); g.translate(0, CURB + 7.35, 1.2); return g; })(),
    ]);
    const headG = new THREE.BoxGeometry(0.22, 0.02, 0.42); headG.translate(0, CURB + 7.28, 1.2);
    const poleM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.6 });
    const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffc890, emissiveIntensity: 3 });
    this.lampPole = new THREE.InstancedMesh(poleG, poleM, 700); this.lampHead = new THREE.InstancedMesh(headG, headM, 700);
    for (const m of [this.lampPole, this.lampHead]) { m.count = 0; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; this.scene.add(m); }
    // far away: warm glowing dots
    const pos = new Float32Array(L.length * 3);
    L.forEach((l, k) => pos.set([l.x + l.ox, CURB + 7.25, l.z + l.oz], k * 3));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uH: { value: 800 } },
      vertexShader: /* glsl */`uniform float uH; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float d = -mv.z; gl_PointSize = clamp(uH * 0.9 / max(d, 1.0), 1.5, 10.0); vA = clamp((d - 60.0) / 120.0, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; float a = 1.0 - smoothstep(0.0, 1.0, r); gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * a * a * 2.5 * vA, 1.0); }`,
    });
    this.lampDots = new THREE.Points(g, pm); this.lampDots.frustumCulled = false; this.scene.add(this.lampDots);
    this.lampT = 0;
  }
  updateLamps(dt) {
    const cam = this.zone.game.camera.position;
    this.lampT -= dt; if (this.lampT > 0) return; this.lampT = 0.5;
    const R2 = 380 * 380, M = new THREE.Matrix4(); let n = 0;
    for (const l of this.lamps) {
      const dx = l.x - cam.x, dz = l.z - cam.z; if (dx * dx + dz * dz > R2 || n >= 700) continue;
      M.makeRotationY(l.rot); M.setPosition(l.x, 0, l.z);
      this.lampPole.setMatrixAt(n, M); this.lampHead.setMatrixAt(n, M); n++;
    }
    this.lampPole.count = this.lampHead.count = n;
    this.lampPole.instanceMatrix.needsUpdate = true; this.lampHead.instanceMatrix.needsUpdate = true;
    this.lampDots.material.uniforms.uH.value = this.zone.game.renderer.size().h;
  }

  // a building got bitten: lower it (instance matrix + collision box), or remove it
  setBuilding(b) {
    const M = new THREE.Matrix4().makeScale(b.w, Math.max(0.01, b.h), b.d); M.setPosition(b.x, b.y0, b.z);
    this.bim.setMatrixAt(b.index, M); this.bim.instanceMatrix.needsUpdate = true;
    b.box.max.y = b.y0 + b.h;
  }
  removeBuilding(b) {
    b.gone = true; b.box.gone = true;
    const M = new THREE.Matrix4().makeScale(0, 0, 0); this.bim.setMatrixAt(b.index, M); this.bim.instanceMatrix.needsUpdate = true;
  }

  async buildPlaza() {
    const S = this.scene, mats = this.zone.mats;
    const { Batch, Kit } = await import('./kit.js');
    const B = new Batch(mats);
    for (const [ax, az, bx, bz] of [[-45, -45, 45, -22.3], [-45, 22.3, 45, 45], [-45, -22.3, -22.3, 22.3], [22.3, -22.3, 45, 22.3]]) B.box(bx - ax, 0.04, bz - az, 'brushedconcrete', (ax + bx) / 2, CURB + 0.02, (az + bz) / 2, 'STRUCT');
    // planters with trees + benches on the plaza
    for (const [x, z] of [[-32, -32], [32, -32], [-32, 32], [32, 32], [-32, 0], [32, 0]]) {
      B.box(4, 0.6, 4, 'concrete', x, CURB + 0.3, z, 'FURN', 0, 0.05);
      B.box(3.7, 0.05, 3.7, 'soil', x, CURB + 0.58, z, 'PROP');
      B.cyl(0.18, 0.28, 4.5, 'wood', x, CURB + 2.8, z, 'FURN', 10);
      for (let k = 0; k < 9; k++) B.add(new THREE.IcosahedronGeometry(1.3 + Math.random() * 0.6, 1), 'plant', { p: [x + (Math.random() - 0.5) * 2.4, CURB + 5.2 + Math.random() * 1.8, z + (Math.random() - 0.5) * 2.4] }, 'PROP');
    }
    // street lamps along the 4 sidewalks of the tower block + the blocks across
    for (let k = -3; k <= 3; k++) for (const [ax, az] of [[1, 0], [0, 1]]) for (const sd of [-1, 1]) {
      const along = k * 13, x = ax ? along : sd * 43.5, z = ax ? sd * 43.5 : along;
      B.cyl(0.07, 0.11, 7.5, 'darkmetal', x, CURB + 3.75, z, 'PROP', 10);
      const ox = ax ? 0 : -sd * 1.2, oz = ax ? -sd * 1.2 : 0;
      B.box(Math.abs(ox) + 0.12, 0.08, Math.abs(oz) + 0.12, 'darkmetal', x + ox / 2, CURB + 7.45, z + oz / 2, 'PROP');
      B.box(0.5, 0.12, 0.28, 'darkmetal', x + ox, CURB + 7.35, z + oz, 'PROP');
      B.box(0.42, 0.02, 0.22, 'lightWarm', x + ox, CURB + 7.28, z + oz, null);
      this.fixtures.push({ p: new THREE.Vector3(x + ox, CURB + 7.1, z + oz), color: 0xffb070, i: 7, r: 32 });
    }
    // hydrants, trash cans, a mailbox, newspaper boxes, bus stop shelter on the south street
    for (const [x, z] of [[-40, -44.3], [40, 44.3]]) { B.cyl(0.13, 0.15, 0.6, 'paintRed', x, CURB + 0.3, z, 'SMALL', 12); B.add(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'paintRed', { p: [x, CURB + 0.6, z] }, 'SMALL'); }
    for (const [x, z] of [[-20, -44], [20, -44], [44, 15], [-44, -15]]) { B.cyl(0.32, 0.3, 0.9, 'darkPlastic', x, CURB + 0.45, z, 'PROP', 16); }
    B.box(0.5, 1.1, 0.45, 'paintBlue', -8, CURB + 0.55, -44.2, 'PROP', 0, 0.06);
    B.box(4.5, 0.08, 1.6, 'glassDark', 10, CURB + 2.6, -43.5, 'PROP'); B.box(4.5, 2.3, 0.05, 'glass', 10, CURB + 1.3, -42.8, 'PROP');
    for (const x of [7.9, 12.1]) B.box(0.06, 2.5, 0.06, 'darkmetal', x, CURB + 1.25, -43.5, 'PROP');
    B.box(2.8, 0.45, 0.4, 'darkmetal', 10, CURB + 0.45, -42.95, 'PROP');
    // steam vents (manholes) in the street with steam (the steam is an effect in fx)
    this.steam = [[-55, -30], [55, 22], [-12, -55], [30, 55]].map(([x, z]) => new THREE.Vector3(x, 0.02, z));
    for (const p of this.steam) B.cyl(0.45, 0.45, 0.03, 'darkmetal', p.x, 0.015, p.z, 'SMALL', 24);
    const g = new THREE.Group(); await B.build(g, { shadows: true }); S.add(g);
    this.zone.addSolids(B, 'plaza');
    // parked cars around the tower block (real models)
    await this.parkCars();
  }

  async parkCars() {
    const { gltf, hasAsset: has } = await import('../core/assets.js');
    const names = ['Taxi', 'NormalCar1', 'NormalCar2', 'SUV', 'SportsCar', 'Cop'];
    this.carModels = {};
    for (const n of names) {
      if (!has(`cars/${n}.glb`)) continue;
      try { const g = await gltf(`cars/${n}.glb`); this.carModels[n] = g.scene; } catch (e) { /* ignore */ }
    }
    const R = rng(77);
    this.parked = [];
    const spots = [];
    for (let k = -4; k <= 4; k++) { spots.push([k * 9 + 2, -48.2, Math.PI / 2], [k * 9 - 2, 48.2, -Math.PI / 2], [-48.2, k * 9, 0], [48.2, k * 9 + 3, Math.PI]); }
    for (const [x, z, rot] of spots) {
      if (R() < 0.35) continue;
      const n = R() < 0.35 ? 'Taxi' : names[1 + Math.floor(R() * 4)];
      const src = this.carModels[n]; if (!src) continue;
      const car = src.clone(true);
      fitCar(car, n === 'SUV' ? 4.8 : 4.5);
      car.position.set(x, 0, z); car.rotation.y = rot;
      car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(car);
      car.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(car);
      this.grid.add({ min: bb.min.clone(), max: bb.max.clone(), maxSize: 1e9, tag: 'car', car });
      this.parked.push(car);
    }
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(FAR_SHORE - SHORE, 12000, 1, 1); geo.rotateX(-Math.PI / 2); geo.translate((SHORE + FAR_SHORE) / 2, -2.5, 0);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x0a1418, roughness: 0.08, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = { value: 0 }; this.waterU = sh.uniforms;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWW; uniform float uT;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 wp = vWW.xz;
          vec2 g1 = vec2(sin(wp.x * 0.11 + uT * 1.3) + sin(wp.y * 0.07 - uT * 0.9), cos(wp.y * 0.13 + uT * 1.1) + cos(wp.x * 0.05 + uT * 0.7));
          vec2 g2 = vec2(sin(wp.x * 0.9 + wp.y * 0.4 + uT * 3.1), cos(wp.y * 0.8 - wp.x * 0.3 + uT * 2.7));
          vec3 wn = normalize(vec3(g1 * 0.06 + g2 * 0.025, 1.0));
          normal = normalize((viewMatrix * vec4(wn.x, wn.z, wn.y, 0.0)).xyz);`);
    };
    const w = new THREE.Mesh(geo, mat); w.name = 'harbor'; this.scene.add(w); this.water = w;
    // quay walls
    for (const x of [SHORE, FAR_SHORE]) { const q = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 12000), new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.9 })); q.position.set(x + (x === SHORE ? 2 : -2), -2.5, 0); this.scene.add(q); }
    this.zone.collision.analytic.push({ probe: (o, d, far) => {
      if (Math.abs(d.y) < 1e-9) return null; const t = (-2.5 - o.y) / d.y; if (t < 0 || t > far) return null;
      const x = o.x + d.x * t; if (x <= SHORE || x >= FAR_SHORE) return null;
      return { point: new THREE.Vector3(x, -2.5, o.z + d.z * t), normal: new THREE.Vector3(0, 1, 0), distance: t, tag: 'water' };
    } });
    // far shore: low brick skyline backdrop (instanced)
    const n = 220, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), makeFacadeMaterial({ instanced: true }), n);
    const aB = new Float32Array(n * 4), M = new THREE.Matrix4(), R = rng(99);
    for (let k = 0; k < n; k++) {
      const x = FAR_SHORE + 60 + R() * 900, z = (R() - 0.5) * 5000, w = 20 + R() * 40, h = 10 + R() * 45;
      M.makeScale(w, h, 20 + R() * 40); M.setPosition(x, 0, z); im.setMatrixAt(k, M); aB.set([1, R() * 100, 3.2, 0], k * 4);
    }
    im.geometry.setAttribute('aBld', new THREE.InstancedBufferAttribute(aB, 4)); im.frustumCulled = false;
    this.scene.add(im);
  }

  buildBridge() {
    // a suspension bridge across the harbor at z = 0 (deck 52 m up, towers 150 m)
    const S = this.scene, G = new THREE.Group(); G.name = 'bridge';
    const steel = new THREE.MeshStandardMaterial({ color: 0x5a5e62, roughness: 0.55, metalness: 0.7 });
    const deckM = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.8 });
    const x0 = SHORE - 150, x1 = FAR_SHORE + 150, deckY = 52, W = 28;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 3, W), deckM); deck.position.set((x0 + x1) / 2, deckY, 0); G.add(deck);
    const truss = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 6, 1), steel); truss.position.set((x0 + x1) / 2, deckY - 3.5, W / 2); G.add(truss);
    const truss2 = truss.clone(); truss2.position.z = -W / 2; G.add(truss2);
    const towers = [SHORE + 230, FAR_SHORE - 230];
    for (const tx of towers) {
      for (const sz of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(9, 160, 8), steel); leg.position.set(tx, 80 - 2.5, sz * (W / 2 + 3)); G.add(leg); }
      for (const y of [deckY + 30, deckY + 75, 150]) { const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 6, W + 14), steel); beam.position.set(tx, y, 0); G.add(beam); }
      // red aircraft lights on top
      this.fixtures.push({ p: new THREE.Vector3(tx, 159, 0), color: 0xff2010, i: 0.5, r: 30, blink: true });
    }
    // main cables (catenary between the towers + down to the anchorages), suspenders
    const cableM = new THREE.MeshStandardMaterial({ color: 0x8a8e92, roughness: 0.4, metalness: 0.8 });
    for (const sz of [-1, 1]) {
      const pts = [];
      const a = towers[0], b = towers[1], top = 155, sag = 95;
      pts.push(new THREE.Vector3(x0 + 20, deckY + 2, sz * (W / 2 + 3)));
      for (let k = 0; k <= 40; k++) { const t = k / 40, x = a + (b - a) * t; pts.push(new THREE.Vector3(x, top - sag * 4 * t * (1 - t), sz * (W / 2 + 3))); }
      pts.push(new THREE.Vector3(x1 - 20, deckY + 2, sz * (W / 2 + 3)));
      const curve = new THREE.CatmullRomCurve3(pts);
      G.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.9, 8), cableM));
      const susp = [];
      for (let x = a + 15; x < b; x += 15) { const t = (x - a) / (b - a), y = top - sag * 4 * t * (1 - t); const g = new THREE.CylinderGeometry(0.12, 0.12, y - deckY, 4); g.translate(x, (y + deckY) / 2, sz * (W / 2 + 3)); susp.push(g); }
      G.add(new THREE.Mesh(mergeAll(susp), cableM));
    }
    // lamps along the deck
    for (let x = x0 + 50; x < x1; x += 120) this.fixtures.push({ p: new THREE.Vector3(x, deckY + 9, 0), color: 0xffc080, i: 1.2, r: 30 });
    G.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
    S.add(G); this.bridge = G;
    this.grid.add({ min: new THREE.Vector3(x0, deckY - 1.5, -W / 2), max: new THREE.Vector3(x1, deckY + 1.5, W / 2), maxSize: 1e9, tag: 'bridge' });
    for (const tx of towers) for (const sz of [-1, 1]) this.grid.add({ min: new THREE.Vector3(tx - 4.5, -3, sz * (W / 2 + 3) - 4), max: new THREE.Vector3(tx + 4.5, 157, sz * (W / 2 + 3) + 4), maxSize: 1e9, tag: 'bridge' });
  }

  update(dt, dtReal) {
    if (this.lampPole) this.updateLamps(dtReal);
    if (this.waterU) this.waterU.uT.value += dtReal;
    if (this.groundU) this.groundU.uWet.value = this.rain;
    const s = this.zone.game.player ? this.zone.game.player.sizeM : 0.004;
    if (this.scene.fog) this.scene.fog.density = 0.00055 / Math.max(1, Math.sqrt(s / 10));
  }
}

function mergeAll(geos) {
  let n = 0; for (const g of geos) n += (g.index ? g.toNonIndexed() : g).attributes.position.count;
  const nonIdx = geos.map(g => g.index ? g.toNonIndexed() : g);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of nonIdx) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); r.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return r;
}

// scale a car model so its length is L metres and its wheels sit on y = 0
export function fitCar(obj, L) {
  obj.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3());
  const len = Math.max(sz.x, sz.z), k = L / len;
  obj.scale.multiplyScalar(k);
  obj.updateMatrixWorld(true);
  const bb2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= bb2.min.y;
  // models face +z or +x: make them face +x (along their length) so rotation.y works the same for all
  if (sz.z > sz.x) obj.userData.alongZ = true;
  return obj;
}
