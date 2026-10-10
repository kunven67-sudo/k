// Renders the land and gives it physics. The render triangles and the physics
// triangles are built from the SAME heights with the SAME diagonal, so what you
// see is exactly what you stand on (no floating, no sinking, no invisible bumps).

import * as THREE from 'three';
import { N, CELL, HALF, WORLD_SIZE, heightAt } from './terrainGen.js';
import { smoothstep } from '../core/noise.js';

const CHUNK_CELLS = 64;
const CV = CHUNK_CELLS + 1;          // vertices per chunk side
const CHUNKS = (N - 1) / CHUNK_CELLS; // 16
const SKIRT = 10;

export class Terrain {
  constructor({ gen, RAPIER, physicsWorld, textures }) {
    this.gen = gen;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    this.chunks = [];
    this.material = makeTerrainMaterial(textures, gen);
    this.buildChunks();
    this.buildOuterRing();
    if (RAPIER && physicsWorld) this.buildColliders(RAPIER, physicsWorld);
  }

  height(x, z) { return heightAt(this.gen.H, x, z); }

  normal(x, z, out = new THREE.Vector3()) {
    const e = 0.5;
    out.set(this.height(x - e, z) - this.height(x + e, z), 2 * e, this.height(x, z - e) - this.height(x, z + e));
    return out.normalize();
  }

  buildChunks() {
    const H = this.gen.H;
    const indexCache = [1, 2, 4].map((s) => buildIndex(s));
    for (let cz = 0; cz < CHUNKS; cz++) {
      for (let cx = 0; cx < CHUNKS; cx++) {
        const i0 = cx * CHUNK_CELLS, j0 = cz * CHUNK_CELLS;
        const count = CV * CV + 4 * CV;
        const pos = new Float32Array(count * 3);
        const nrm = new Float32Array(count * 3);
        let minY = Infinity, maxY = -Infinity;
        const put = (k, i, j, dy) => {
          const gi = i0 + i, gj = j0 + j;
          const h = H[gj * N + gi] + dy;
          pos[k * 3] = gi * CELL - HALF;
          pos[k * 3 + 1] = h;
          pos[k * 3 + 2] = gj * CELL - HALF;
          // smooth normal from neighbors (same on both sides of a chunk border)
          const l = H[gj * N + Math.max(gi - 1, 0)], r = H[gj * N + Math.min(gi + 1, N - 1)];
          const u = H[Math.max(gj - 1, 0) * N + gi], d = H[Math.min(gj + 1, N - 1) * N + gi];
          let nx = l - r, ny = 2 * CELL, nz = u - d;
          const len = Math.hypot(nx, ny, nz);
          nrm[k * 3] = nx / len; nrm[k * 3 + 1] = ny / len; nrm[k * 3 + 2] = nz / len;
          if (h < minY) minY = h;
          if (h > maxY) maxY = h;
        };
        for (let j = 0; j < CV; j++) for (let i = 0; i < CV; i++) put(j * CV + i, i, j, 0);
        // skirts: copies of the 4 edges, pushed down, to hide LOD cracks
        let k = CV * CV;
        for (let i = 0; i < CV; i++) put(k++, i, 0, -SKIRT);
        for (let i = 0; i < CV; i++) put(k++, i, CHUNK_CELLS, -SKIRT);
        for (let j = 0; j < CV; j++) put(k++, 0, j, -SKIRT);
        for (let j = 0; j < CV; j++) put(k++, CHUNK_CELLS, j, -SKIRT);

        const posAttr = new THREE.BufferAttribute(pos, 3);
        const nrmAttr = new THREE.BufferAttribute(nrm, 3);
        const center = new THREE.Vector3((i0 + CHUNK_CELLS / 2) * CELL - HALF, (minY + maxY) / 2, (j0 + CHUNK_CELLS / 2) * CELL - HALF);
        const radius = Math.hypot(CHUNK_CELLS * CELL * 0.71, (maxY - minY) / 2 + SKIRT);
        const lods = indexCache.map((index, li) => {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', posAttr);
          g.setAttribute('normal', nrmAttr);
          g.setIndex(index);
          g.boundingSphere = new THREE.Sphere(center.clone(), radius);
          g.boundingBox = new THREE.Box3(new THREE.Vector3(center.x - 64, minY - SKIRT, center.z - 64), new THREE.Vector3(center.x + 64, maxY, center.z + 64));
          const m = new THREE.Mesh(g, this.material);
          m.receiveShadow = true;
          m.castShadow = li === 0;
          m.matrixAutoUpdate = false;
          m.visible = li === 2;
          this.group.add(m);
          return m;
        });
        this.chunks.push({ cx, cz, center, lods, lod: 2 });
      }
    }
  }

  // Mountains keep going past the edge of the playable land, so there is never an edge
  // you can see or fall off. Coarse (32 m) but with real physics too.
  buildOuterRing() {
    const SIZE = 8192, C = 32, R = SIZE / C + 1;
    const gen = this.gen;
    const h = new Float32Array(R * R);
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const x = i * C - SIZE / 2, z = j * C - SIZE / 2;
      const inside = Math.min(HALF - Math.abs(x), HALF - Math.abs(z)); // >0 inside the play area
      let y;
      if (inside > C) {
        y = heightAt(gen.H, x, z) - 80; // hidden under the detailed land
      } else {
        const out = Math.max(0, -inside);
        y = gen.baseHeight(x, z);
        // far away the mountains slowly give way to distant hills
        const fade = smoothstep(2600, 900, out);
        y = y * (0.35 + 0.65 * fade) + (1 - fade) * 20;
        if (inside > -C) y = heightAt(gen.H, Math.max(-HALF, Math.min(HALF, x)), Math.max(-HALF, Math.min(HALF, z)));
      }
      h[j * R + i] = y;
    }
    this.outer = { h, R, C, SIZE };
    const pos = new Float32Array(R * R * 3), nrm = new Float32Array(R * R * 3);
    for (let j = 0; j < R; j++) for (let i = 0; i < R; i++) {
      const k = j * R + i;
      pos[k * 3] = i * C - SIZE / 2; pos[k * 3 + 1] = h[k]; pos[k * 3 + 2] = j * C - SIZE / 2;
      const l = h[j * R + Math.max(i - 1, 0)], r = h[j * R + Math.min(i + 1, R - 1)];
      const u = h[Math.max(j - 1, 0) * R + i], d = h[Math.min(j + 1, R - 1) * R + i];
      const nx = l - r, ny = 2 * C, nz = u - d, len = Math.hypot(nx, ny, nz);
      nrm[k * 3] = nx / len; nrm[k * 3 + 1] = ny / len; nrm[k * 3 + 2] = nz / len;
    }
    const idx = [];
    for (let j = 0; j < R - 1; j++) for (let i = 0; i < R - 1; i++) {
      const x = i * C - SIZE / 2, z = j * C - SIZE / 2;
      if (x > -HALF + C && x + C < HALF - C && z > -HALF + C && z + C < HALF - C) continue; // under the play area
      const a = j * R + i, b = (j + 1) * R + i, c = j * R + i + 1, d = (j + 1) * R + i + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.name = 'outer-mountains';
    this.group.add(mesh);
  }

  buildColliders(RAPIER, world) {
    const H = this.gen.H;
    for (const ch of this.chunks) {
      const i0 = ch.cx * CHUNK_CELLS, j0 = ch.cz * CHUNK_CELLS;
      // Rapier layout: index = ix * (rows + 1) + iz, rows run along z.
      const heights = new Float32Array(CV * CV);
      for (let ix = 0; ix < CV; ix++) for (let iz = 0; iz < CV; iz++) heights[ix * CV + iz] = H[(j0 + iz) * N + (i0 + ix)];
      const desc = RAPIER.ColliderDesc.heightfield(CHUNK_CELLS, CHUNK_CELLS, heights, { x: CHUNK_CELLS * CELL, y: 1, z: CHUNK_CELLS * CELL })
        .setTranslation((i0 + CHUNK_CELLS / 2) * CELL - HALF, 0, (j0 + CHUNK_CELLS / 2) * CELL - HALF)
        .setFriction(0.9);
      ch.collider = world.createCollider(desc);
      ch.collider.userData = { surface: 'ground' };
    }
    const { h, R, C, SIZE } = this.outer;
    const oh = new Float32Array(R * R);
    for (let ix = 0; ix < R; ix++) for (let iz = 0; iz < R; iz++) oh[ix * R + iz] = h[iz * R + ix];
    world.createCollider(RAPIER.ColliderDesc.heightfield(R - 1, R - 1, oh, { x: SIZE, y: 1, z: SIZE }).setFriction(0.9));
  }

  update(camera) {
    const cp = camera.position;
    for (const ch of this.chunks) {
      const d = Math.hypot(ch.center.x - cp.x, ch.center.z - cp.z);
      const lod = d < 230 ? 0 : d < 560 ? 1 : 2;
      if (lod !== ch.lod) {
        ch.lods[ch.lod].visible = false;
        ch.lods[lod].visible = true;
        ch.lod = lod;
      }
    }
  }

  dispose() {
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.material.dispose();
  }
}

function buildIndex(s) {
  const idx = [];
  const at = (i, j) => j * CV + i;
  for (let j = 0; j < CHUNK_CELLS; j += s) {
    for (let i = 0; i < CHUNK_CELLS; i += s) {
      const a = at(i, j), b = at(i, j + s), c = at(i + s, j), d = at(i + s, j + s);
      idx.push(a, b, c, b, d, c);
    }
  }
  // skirts (both windings so they show from any side)
  const base = CV * CV;
  const edge = (startSkirt, getMain) => {
    for (let t = 0; t < CHUNK_CELLS; t += s) {
      const m0 = getMain(t), m1 = getMain(t + s);
      const s0 = base + startSkirt + t, s1 = base + startSkirt + t + s;
      idx.push(m0, s0, m1, m1, s0, s1, m0, m1, s0, m1, s1, s0);
    }
  };
  edge(0, (t) => at(t, 0));
  edge(CV, (t) => at(t, CHUNK_CELLS));
  edge(CV * 2, (t) => at(0, t));
  edge(CV * 3, (t) => at(CHUNK_CELLS, t));
  return idx;
}

function makeTerrainMaterial(textures, gen) {
  const mapsTex = new THREE.DataTexture(gen.maps, gen.mapsRes, gen.mapsRes, THREE.RGBAFormat);
  mapsTex.magFilter = THREE.LinearFilter;
  mapsTex.minFilter = THREE.LinearFilter;
  mapsTex.wrapS = mapsTex.wrapT = THREE.ClampToEdgeWrapping;
  mapsTex.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 });
  mat.userData.uniforms = {
    tAlbedo: { value: textures.albedo },
    tNormal: { value: textures.normal },
    tMaps: { value: mapsTex },
    uWorldSize: { value: WORLD_SIZE },
    uWaterLevel: { value: gen.lake.level },
    uSeason: { value: 0.78 }, // 0 spring .. 1 late fall, drives grass color
    uWetness: { value: 0 },   // rain
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTWorld;\nvarying vec3 vTNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTWorld = (modelMatrix * vec4(position, 1.0)).xyz;\nvTNormal = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        precision highp sampler2DArray;
        uniform sampler2DArray tAlbedo;
        uniform sampler2DArray tNormal;
        uniform sampler2D tMaps;
        uniform float uWorldSize;
        uniform float uWaterLevel;
        uniform float uSeason;
        uniform float uWetness;
        varying vec3 vTWorld;
        varying vec3 vTNormal;
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1, 0)), u.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), u.x), u.y);
        }
        // Sample a layer twice at different scales/rotations to hide tiling.
        vec4 layerA(float L, vec2 p, float scale) {
          vec4 a = texture(tAlbedo, vec3(p / scale, L));
          vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p;
          vec4 b = texture(tAlbedo, vec3(q / (scale * 2.7), L));
          float m = tNoise(p * 0.02);
          return mix(a, (a + b) * 0.5, smoothstep(0.3, 0.7, m));
        }
        vec4 layerN(float L, vec2 p, float scale) { return texture(tNormal, vec3(p / scale, L)); }
      `)
      .replace('#include <map_fragment>', `
        vec2 wp = vTWorld.xz;
        vec2 muv = (wp + uWorldSize * 0.5) / uWorldSize;
        vec4 maps = texture(tMaps, muv);
        vec3 N0 = normalize(vTNormal);
        float slope = 1.0 - N0.y;
        float macro = tNoise(wp * 0.008) * 0.6 + tNoise(wp * 0.031) * 0.4;

        // blend weights
        float wRock = max(maps.b, smoothstep(0.32, 0.5, slope));
        float shore = 1.0 - smoothstep(0.25, 1.6, vTWorld.y - uWaterLevel);
        float wMud = max(smoothstep(0.86, 0.97, maps.g) * (1.0 - wRock), shore * (1.0 - wRock));
        // ragged, natural edge where the forest floor meets the meadow
        float edgeN = tNoise(wp * 0.11) * 0.65 + tNoise(wp * 0.37) * 0.35;
        float wLitter = smoothstep(0.08, 0.78, maps.r + (edgeN - 0.5) * 0.55) * (1.0 - wRock) * (1.0 - wMud);
        float wDirt = smoothstep(0.62, 0.8, macro) * 0.55 * (1.0 - wRock) * (1.0 - wMud) + smoothstep(0.18, 0.32, slope) * 0.6;
        float wGrass = max(0.0, 1.0 - wRock - wMud - wLitter - wDirt);

        vec4 gA = layerA(0.0, wp, 3.0);
        vec4 lA = layerA(1.0, wp, 3.5);
        vec4 dA = layerA(2.0, wp, 4.5);
        vec4 mA = layerA(4.0, wp, 4.0);
        // rock: triplanar so cliffs don't stretch
        vec3 bw = pow(abs(N0), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec4 rA = texture(tAlbedo, vec3(vTWorld.zy / 7.0, 3.0)) * bw.x + texture(tAlbedo, vec3(vTWorld.xz / 7.0, 3.0)) * bw.y + texture(tAlbedo, vec3(vTWorld.xy / 7.0, 3.0)) * bw.z;

        // height-based blending (pebbles poke through grass, leaves sit on top...)
        vec4 gN = layerN(0.0, wp, 3.0), lN = layerN(1.0, wp, 3.5), dN = layerN(2.0, wp, 4.5), mN = layerN(4.0, wp, 4.0);
        vec4 rN = texture(tNormal, vec3(vTWorld.xz / 7.0, 3.0));
        vec4 hw = vec4(wGrass * (0.5 + gN.a), wLitter * (0.5 + lN.a), wDirt * (0.5 + dN.a), wMud * (0.5 + mN.a));
        float hr = wRock * (0.5 + rN.a);
        float mx = max(max(max(hw.x, hw.y), max(hw.z, hw.w)), hr) - 0.25;
        hw = max(hw - mx, 0.0); hr = max(hr - mx, 0.0);
        float hs = hw.x + hw.y + hw.z + hw.w + hr + 1e-4;
        hw /= hs; hr /= hs;

        // season tint on grass (greener spring/summer, golden in fall)
        vec3 grassCol = gA.rgb * mix(vec3(0.85, 1.05, 0.8), vec3(1.08, 0.98, 0.78), uSeason);
        vec3 col = grassCol * hw.x + lA.rgb * hw.y + dA.rgb * hw.z + mA.rgb * hw.w + rA.rgb * hr;
        col *= 0.86 + 0.28 * macro;
        // damp ground near water + rain makes things darker
        float wet = max(wMud * 0.6, uWetness * 0.5);
        col *= 1.0 - wet * 0.35;
        diffuseColor.rgb *= col;
        float tRough = 0.95 * (hw.x + hw.y + hw.z) + mix(0.8, 0.35, wet) * hw.w + 0.82 * hr;
        tRough = mix(tRough, 0.3, uWetness * 0.6);
        vec3 tnBlend = (gN.xyz * hw.x + lN.xyz * hw.y + dN.xyz * hw.z + mN.xyz * hw.w + rN.xyz * hr) * 2.0 - 1.0;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', `
        // tangent-space detail (x -> world x, y -> world z) bent onto the smooth terrain normal
        vec3 wN = normalize(N0 + vec3(tnBlend.x, 0.0, tnBlend.y) * 0.9);
        normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
      `);
  };
  mat.customProgramCacheKey = () => 'riftlab-terrain-v1';
  return mat;
}
