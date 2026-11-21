// Ground mesh: nested grids around you (each one twice as fine as the one outside it), so the ground
// stays sharp from 1.5 km away down to whatever size you shrink to. Textures switch by how close you look:
// meadow -> leaf litter -> soil -> sand -> bare mineral, all real Poly Haven scans.
import * as THREE from 'three';

const RES = 64, S0 = 24;
const BANDS = 8;

export class Terrain {
  constructor(land, T, parent) {
    this.land = land; this.T = T; this.parent = parent; this.levels = [];
    this.O = { x: 0, z: 0 };
    this.uniformsShared = {
      tG: { value: T.grass }, tGn: { value: T.grassN }, tD: { value: T.dirt }, tR: { value: T.rock }, tRn: { value: T.rockN },
      tS: { value: T.soil }, tSn: { value: T.soilN }, tL: { value: T.leaves }, tSa: { value: T.sand }, tM: { value: T.mineral }, tMn: { value: T.mineralN },
      uOff: { value: Array.from({ length: BANDS }, () => new THREE.Vector2()) }, uOff2: { value: new THREE.Vector2() },
    };
    const idx = [];
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
      const a = j * (RES + 1) + i, b = a + 1, c = a + RES + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    this.index = idx;
  }
  makeMaterial() {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
    const U = { ...this.uniformsShared, uHole: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) } };
    m.userData.U = U;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 cov; varying vec3 vRel; varying vec2 vCov;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRel = position; vCov = cov;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying vec3 vRel; varying vec2 vCov;
uniform sampler2D tG, tGn, tD, tR, tRn, tS, tSn, tL, tSa, tM, tMn;
uniform vec2 uOff[${BANDS}]; uniform vec2 uOff2; uniform vec4 uHole;
vec3 gCol; vec3 gNor;
void band(int b, vec2 uv, vec2 dx, vec2 dy, float w) {
  vec3 c; vec3 n;
  if (b == 0) {
    vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * (vRel.xz / 37.0) + uOff2;
    vec2 dx2 = mat2(0.8, -0.6, 0.6, 0.8) * dx * (8.0 / 37.0), dy2 = mat2(0.8, -0.6, 0.6, 0.8) * dy * (8.0 / 37.0);
    vec3 g = mix(textureGrad(tG, uv, dx, dy).rgb, textureGrad(tG, uv2, dx2, dy2).rgb, 0.45);
    vec3 gn = textureGrad(tGn, uv, dx, dy).rgb;
    vec3 d = textureGrad(tD, uv * 2.0, dx * 2.0, dy * 2.0).rgb;
    vec3 r = textureGrad(tR, uv, dx, dy).rgb; vec3 rn = textureGrad(tRn, uv, dx, dy).rgb;
    g *= vec3(0.86, 0.98, 0.72);
    c = mix(mix(g, d, vCov.y * 0.85), r, vCov.x); n = mix(gn, rn, vCov.x);
  } else if (b == 1) {
    vec3 l = textureGrad(tL, uv, dx, dy).rgb, s = textureGrad(tS, uv, dx, dy).rgb, r = textureGrad(tR, uv, dx, dy).rgb;
    c = mix(mix(l, s, 0.35 + vCov.y * 0.5), r, vCov.x); n = mix(textureGrad(tSn, uv, dx, dy).rgb, textureGrad(tRn, uv, dx, dy).rgb, vCov.x);
  } else if (b == 2) {
    // what's under you decides what you see: rocky ground = sand, meadow ground = dark soil
    vec3 s = textureGrad(tS, uv, dx, dy).rgb, sa = textureGrad(tSa, uv, dx, dy).rgb;
    float m = clamp(vCov.x * 1.6 + 0.08, 0.0, 1.0);
    c = mix(s * vec3(0.82, 0.78, 0.72), sa, m); n = mix(textureGrad(tSn, uv, dx, dy).rgb, textureGrad(tMn, uv, dx, dy).rgb, m);
  } else if (b == 3) {
    float m = clamp(vCov.x * 1.6 + 0.05, 0.0, 1.0);
    vec3 humus = textureGrad(tS, uv * 1.7, dx * 1.7, dy * 1.7).rgb * vec3(0.62, 0.55, 0.48);
    c = mix(humus, textureGrad(tSa, uv, dx, dy).rgb * vec3(1.02, 0.98, 0.94), m); n = mix(textureGrad(tSn, uv * 1.7, dx * 1.7, dy * 1.7).rgb, textureGrad(tMn, uv, dx, dy).rgb, m);
  } else {
    float m = clamp(vCov.x * 1.6 + 0.05, 0.0, 1.0);
    vec3 clay = textureGrad(tS, uv * 2.3, dx * 2.3, dy * 2.3).rgb * vec3(0.7, 0.6, 0.5);
    c = mix(clay, textureGrad(tM, uv, dx, dy).rgb * vec3(0.95, 0.92, 0.86), m); n = textureGrad(tMn, uv, dx, dy).rgb;
  }
  gCol += c * w; gNor += (n * 2.0 - 1.0) * w;
}
`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (vRel.x > uHole.x && vRel.x < uHole.z && vRel.z > uHole.y && vRel.z < uHole.w) discard;`)
        .replace('#include <map_fragment>', `
{
  vec3 px = dFdx(vRel), py = dFdy(vRel);
  float foot = max(max(length(px), length(py)), 1e-12);
  float bf = clamp(log(8.0 / (foot * 700.0)) / log(10.0), 0.0, ${BANDS - 1}.0);
  int b0 = int(floor(bf)); float t = fract(bf); if (b0 >= ${BANDS - 1}) { b0 = ${BANDS - 2}; t = 1.0; }
  gCol = vec3(0.0); gNor = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    int b = b0 + i; float w = i == 0 ? 1.0 - t : t;
    if (w < 0.002) continue;
    float tile = 8.0 * pow(10.0, -float(b));
    vec2 uv = vRel.xz / tile + uOff[b];
    band(b, uv, px.xz / tile, py.xz / tile, w);
  }
  diffuseColor.rgb *= gCol;
}`)
        .replace('#include <normal_fragment_maps>', `
{
  vec3 Tv = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz); vec3 Bv = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  Tv = normalize(Tv - normal * dot(normal, Tv)); Bv = normalize(cross(normal, Tv));
  vec3 tn = gNor; tn.xy *= 1.35;
  normal = normalize(Tv * tn.x - Bv * tn.y + normal * max(tn.z, 0.2));
}`);
    };
    return m;
  }
  setOrigin(O) {
    this.O = { x: O.x, y: O.y || 0, z: O.z };
    for (let b = 0; b < BANDS; b++) { const tile = 8 * Math.pow(10, -b); this.uniformsShared.uOff.value[b].set(fmod(O.x, tile) / tile, fmod(O.z, tile) / tile); }
    // second macro sample (rotated): rotate O then fract
    const ox = O.x / 37, oz = O.z / 37;
    this.uniformsShared.uOff2.value.set(fmod(0.8 * ox - 0.6 * oz, 1), fmod(0.6 * ox + 0.8 * oz, 1));
    // keep already built levels where they are until they get rebuilt around the new origin
    for (const L of this.levels) { L.dirty = true; if (L.built) L.mesh.position.set(L.bO.x - this.O.x, L.mid - this.O.y, L.bO.z - this.O.z); }
  }
  // called every frame. P = your position (meters, absolute), k = your size (1 = normal).
  update(P, k, budget = 2, fast = 0) {
    const finest = Math.max(1.8 * k / 34, 1e-9);
    let n = 0; while (S0 / Math.pow(2, n) > finest && n < 40) n++;
    n = Math.max(n, 1);
    while (this.levels.length < n) this.levels.push(this.makeLevel(this.levels.length));
    for (let j = 0; j < this.levels.length; j++) {
      const L = this.levels[j];
      L.active = j < n && !(fast > 0 && L.s < Math.min(fast, S0 / 8));
      if (!L.active) { L.built = L.built && !L.stale; continue; }
      const step = L.s * 8;
      const cx = Math.round(P.x / step) * step, cz = Math.round(P.z / step) * step;
      if (cx !== L.cx || cz !== L.cz) { L.cx = cx; L.cz = cz; L.dirty = true; if (L.built && Math.max(Math.abs(cx - L.bcx), Math.abs(cz - L.bcz)) > RES / 4 * L.s) L.built = false; }
    }
    // only show an unbroken chain of built levels (outside in), so a missing middle level never leaves junk
    let chain = true;
    for (const L of this.levels) { L.show = chain && L.active && L.built; if (!L.show) chain = false; L.mesh.visible = L.show; }
    // holes: each level hides where the next finer one is drawn (using where that one was actually built)
    for (let j = 0; j < this.levels.length; j++) {
      const L = this.levels[j], F = this.levels[j + 1];
      const u = L.mesh.material.userData.U.uHole.value;
      if (F && F.show) {
        const h = RES / 2 * F.s - 2 * L.s;
        u.set(F.bcx - L.bO.x - h, F.bcz - L.bO.z - h, F.bcx - L.bO.x + h, F.bcz - L.bO.z + h);
      } else u.set(1e9, 1e9, -1e9, -1e9);
    }
    // build: first fill the chain (coarse to fine), then refresh moved levels (fine first)
    let done = 0;
    for (let j = 0; j < this.levels.length && done < budget; j++) { const L = this.levels[j]; if (L.active && !L.built) { this.build(L); done++; } }
    for (let j = this.levels.length - 1; j >= 0 && done < budget; j--) { const L = this.levels[j]; if (L.active && L.dirty) { this.build(L); done++; } }
    return done;
  }
  makeLevel(j) {
    const g = new THREE.BufferGeometry();
    const N = (RES + 1) * (RES + 1);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('cov', new THREE.BufferAttribute(new Float32Array(N * 2), 2));
    g.setIndex(this.index);
    const mat = this.makeMaterial();
    mat.polygonOffset = true; mat.polygonOffsetFactor = 1 + (30 - j) * 0.02; mat.polygonOffsetUnits = 1;
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.renderOrder = -1;
    this.parent.add(mesh);
    return { j, s: S0 / Math.pow(2, j), mesh, cx: NaN, cz: NaN, dirty: true, built: false, active: false, h: new Float64Array(N) };
  }
  build(L) {
    const s = L.s, half = RES / 2, land = this.land, O = this.O;
    const pos = L.mesh.geometry.attributes.position.array, nor = L.mesh.geometry.attributes.normal.array, cov = L.mesh.geometry.attributes.cov.array;
    const H = L.h, mw = s * 2;
    for (let j = 0; j <= RES; j++) for (let i = 0; i <= RES; i++) {
      const x = L.cx + (i - half) * s, z = L.cz + (j - half) * s, v = j * (RES + 1) + i;
      H[v] = land.height(x, z, mw);
      pos[v * 3] = x - O.x; pos[v * 3 + 1] = H[v]; pos[v * 3 + 2] = z - O.z;
      if (s > 0.5 || (i % 4 === 0 && j % 4 === 0)) { const c = land.cover(x, z); cov[v * 2] = c[0]; cov[v * 2 + 1] = c[1]; }
      else { const a = (j - (j % 4)) * (RES + 1) + (i - (i % 4)); cov[v * 2] = cov[a * 2]; cov[v * 2 + 1] = cov[a * 2 + 1]; }
    }
    // the y values can be huge compared to tiny cells: store them relative to the middle of the grid
    const mid = H[half * (RES + 1) + half];
    for (let v = 0; v < H.length; v++) pos[v * 3 + 1] = H[v] - mid;
    L.mesh.position.set(0, mid - (O.y || 0), 0); L.mid = mid; L.bO = { x: O.x, y: O.y || 0, z: O.z };
    for (let j = 0; j <= RES; j++) for (let i = 0; i <= RES; i++) {
      const v = j * (RES + 1) + i;
      const l = H[j * (RES + 1) + Math.max(0, i - 1)], r = H[j * (RES + 1) + Math.min(RES, i + 1)];
      const d = H[Math.max(0, j - 1) * (RES + 1) + i], u = H[Math.min(RES, j + 1) * (RES + 1) + i];
      const dx = (r - l) / ((Math.min(RES, i + 1) - Math.max(0, i - 1)) * s), dz = (u - d) / ((Math.min(RES, j + 1) - Math.max(0, j - 1)) * s);
      const inv = 1 / Math.hypot(dx, 1, dz);
      nor[v * 3] = -dx * inv; nor[v * 3 + 1] = inv; nor[v * 3 + 2] = -dz * inv;
    }
    const g = L.mesh.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.attributes.cov.needsUpdate = true;
    L.dirty = false; L.built = true; L.bcx = L.cx; L.bcz = L.cz;
  }
  dispose() { for (const L of this.levels) { L.mesh.geometry.dispose(); L.mesh.material.dispose(); this.parent.remove(L.mesh); } this.levels = []; }
}
export const fmod = (a, b) => a - Math.floor(a / b) * b;
