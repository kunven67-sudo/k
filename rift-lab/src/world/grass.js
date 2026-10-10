// Grass blades around you, placed on the exact ground height, swaying in the wind,
// pushed aside where you walk. Thinner in the forest (leaf litter), none on rock or in water.
// Colors follow the season (green summer, golden-tipped fall).

import * as THREE from 'three';
import { N, WORLD_SIZE } from './terrainGen.js';
import { settings } from '../core/settings.js';

function makeClump(blades, segs, seed) {
  // a few curved blades fanning out from one spot
  const pos = [], nrm = [], blade = [];
  const idx = [];
  let v = 0;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let b = 0; b < blades; b++) {
    const ang = rnd() * Math.PI * 2;
    const off = Math.sqrt(rnd()) * 0.24;
    const ox = Math.cos(ang) * off, oz = Math.sin(ang) * off;
    const facing = rnd() * Math.PI;
    const fx = Math.cos(facing), fz = Math.sin(facing);
    const lean = 0.15 + rnd() * 0.35;
    const h = 0.3 + rnd() * 0.42;
    const w = 0.016 + rnd() * 0.012;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const width = w * (1 - t * 0.92);
      const y = h * t;
      const bend = lean * t * t;
      const cx = ox + Math.cos(ang) * bend, cz = oz + Math.sin(ang) * bend;
      pos.push(cx - fx * width, y, cz - fz * width, cx + fx * width, y, cz + fz * width);
      const nx = -fz, nz = fx;
      nrm.push(nx, 0.6, nz, nx, 0.6, nz);
      blade.push(t, b / blades, t, b / blades);
      if (k < segs) {
        idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      }
      v += 2;
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(blade, 2));
  g.setIndex(idx);
  return g;
}

export class Grass {
  constructor({ gen }) {
    this.gen = gen;
    // exact ground height (R) + water level (G) for the GPU
    const data = new Float32Array(N * N * 2);
    for (let k = 0; k < N * N; k++) { data[k * 2] = gen.H[k]; data[k * 2 + 1] = gen.W[k]; }
    this.heightTex = new THREE.DataTexture(data, N, N, THREE.RGFormat, THREE.FloatType);
    this.heightTex.minFilter = this.heightTex.magFilter = THREE.NearestFilter;
    this.heightTex.needsUpdate = true;
    this.mapsTex = new THREE.DataTexture(gen.maps, gen.mapsRes, gen.mapsRes, THREE.RGBAFormat);
    this.mapsTex.minFilter = this.mapsTex.magFilter = THREE.LinearFilter;
    this.mapsTex.needsUpdate = true;

    this.group = new THREE.Group();
    this.group.name = 'grass';
    this.layers = [
      this.makeLayer({ cell: 0.42, grid: 150, inner: 0, blades: 11, segs: 3, scale: 1.0 }),
      this.makeLayer({ cell: 1.2, grid: 118, inner: 30, blades: 16, segs: 2, scale: 1.25 }),
    ];
    this.applyDensity();
  }

  makeLayer(o) {
    const geo = makeClump(o.blades, o.segs, 1234 + o.blades);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    const uniforms = {
      tHeight: { value: this.heightTex }, tMaps: { value: this.mapsTex },
      uOrigin: { value: new THREE.Vector3() }, uCell: { value: o.cell }, uGrid: { value: o.grid },
      uInner: { value: o.inner }, uOuter: { value: (o.grid * o.cell) / 2 },
      uTime: { value: 0 }, uWind: { value: 0.6 }, uSeason: { value: 0.75 }, uScale: { value: o.scale },
      uPlayer: { value: new THREE.Vector3(0, -999, 0) }, uDensity: { value: 1 },
      uWorldSize: { value: WORLD_SIZE }, uN: { value: N },
    };
    mat.userData.uniforms = uniforms;
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D tHeight; uniform sampler2D tMaps;
          uniform vec3 uOrigin; uniform float uCell; uniform float uGrid; uniform float uInner; uniform float uOuter;
          uniform float uTime; uniform float uWind; uniform float uSeason; uniform float uScale; uniform vec3 uPlayer;
          uniform float uDensity; uniform float uWorldSize; uniform float uN;
          attribute vec2 aBlade;
          varying vec3 vGrassCol; varying float vTip;
          vec2 gHash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
          float H(ivec2 c) { return texelFetch(tHeight, clamp(c, ivec2(0), ivec2(int(uN) - 1)), 0).r; }
          float groundAt(vec2 w) {
            vec2 f = (w + uWorldSize * 0.5) / 2.0;
            vec2 i = floor(f); vec2 uv = f - i; ivec2 c = ivec2(i);
            float a = H(c), b = H(c + ivec2(0, 1)), cc = H(c + ivec2(1, 0)), d = H(c + ivec2(1, 1));
            if (uv.x + uv.y <= 1.0) return a + (cc - a) * uv.x + (b - a) * uv.y;
            return d + (b - d) * (1.0 - uv.x) + (cc - d) * (1.0 - uv.y);
          }
          float waterAt(vec2 w) {
            vec2 f = (w + uWorldSize * 0.5) / 2.0;
            return texelFetch(tHeight, clamp(ivec2(f + 0.5), ivec2(0), ivec2(int(uN) - 1)), 0).g;
          }
          vec3 gPos; float gKeep;
        `)
        .replace('#include <beginnormal_vertex>', `
          int gid = gl_InstanceID;
          int gg = int(uGrid);
          vec2 cellIdx = vec2(float(gid % gg), float(gid / gg)) - uGrid * 0.5;
          vec2 cellW = floor(uOrigin.xz / uCell) + cellIdx;
          vec2 rnd = gHash(cellW);
          vec2 wpos = (cellW + rnd) * uCell;
          vec2 rel = wpos - uOrigin.xz;
          float dist = length(rel);
          vec4 mp = texture2D(tMaps, (wpos + uWorldSize * 0.5) / uWorldSize);
          float forest = mp.r, moist = mp.g, rock = mp.b;
          float dens = (1.0 - smoothstep(0.25, 0.7, rock)) * (1.0 - smoothstep(0.35, 0.85, forest) * 0.88) * uDensity;
          float ground = groundAt(wpos);
          float water = waterAt(wpos);
          gKeep = step(rnd.y * 0.999, dens) * step(water, ground - 0.05);
          gKeep *= step(uInner, dist) * step(dist, uOuter);
          float fade = smoothstep(uOuter, uOuter * 0.72, dist) * smoothstep(uInner * 0.8, uInner * 1.15 + 0.01, dist + (uInner < 0.5 ? 99.0 : 0.0));
          float sz = mix(0.55, 1.15, fract(rnd.x * 7.31)) * uScale * mix(0.75, 1.3, moist) * (1.0 - forest * 0.4) * max(fade, 0.0);
          float ang = rnd.x * 6.2831;
          float ca = cos(ang), sa = sin(ang);
          vec3 lp = position * sz;
          lp.xz *= uCell > 1.0 ? 2.2 : 1.0;
          lp.xz = mat2(ca, -sa, sa, ca) * lp.xz;
          float t = aBlade.x;
          // wind: gusts roll across the meadow
          float gust = sin(wpos.x * 0.06 + uTime * 1.3) * 0.5 + sin(wpos.y * 0.045 - uTime * 0.9 + 1.7) * 0.5;
          float sway = uWind * (0.18 + 0.22 * gust) + sin(uTime * 3.1 + rnd.x * 30.0) * 0.04 * uWind;
          vec2 windDir = normalize(vec2(1.0, 0.35));
          lp.xz += windDir * sway * t * t * sz;
          // walked-on grass leans away from you
          vec2 away = wpos - uPlayer.xz;
          float pd = length(away);
          float push = smoothstep(1.1, 0.0, pd) * step(abs(uPlayer.y - ground), 2.0);
          lp.xz += normalize(away + 1e-4) * push * 0.45 * t * sz;
          lp.y *= 1.0 - push * 0.45;
          gPos = vec3(wpos.x, ground - 0.03, wpos.y) + lp;
          if (gKeep < 0.5) gPos = vec3(0.0, -1e5, 0.0);
          vec3 objectNormal = normalize(vec3(mat2(ca, -sa, sa, ca) * normal.xz, normal.y));
          objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), 0.55));
          // color: dark base -> lighter tip, golden in fall, some dry blades
          float dry = smoothstep(0.55, 0.95, fract(rnd.y * 13.7)) * 0.6 + uSeason * 0.35;
          vec3 baseC = vec3(0.02, 0.035, 0.01);
          vec3 tipGreen = vec3(0.11, 0.2, 0.04);
          vec3 tipDry = vec3(0.36, 0.3, 0.12);
          vGrassCol = mix(baseC, mix(tipGreen, tipDry, clamp(dry, 0.0, 1.0)), smoothstep(0.0, 0.9, t)) * mix(0.8, 1.15, rnd.x);
          vTip = t;
        `)
        .replace('#include <begin_vertex>', 'vec3 transformed = gPos;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGrassCol;\nvarying float vTip;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vGrassCol;');
    };
    mat.customProgramCacheKey = () => 'riftlab-grass-v1';
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.layer = o;
    this.group.add(mesh);
    return mesh;
  }

  applyDensity() {
    const d = settings.grassDensity;
    for (const m of this.layers) {
      const o = m.userData.layer;
      m.geometry.instanceCount = d <= 0 ? 0 : o.grid * o.grid;
      m.material.userData.uniforms.uDensity.value = Math.min(d, 1);
      m.visible = d > 0;
    }
  }

  update(dt, camera, playerPos, season, wind) {
    for (const m of this.layers) {
      const u = m.material.userData.uniforms;
      u.uOrigin.value.copy(camera.position);
      u.uTime.value += dt;
      u.uSeason.value = season;
      u.uWind.value = wind;
      if (playerPos) u.uPlayer.value.copy(playerPos);
    }
  }
}
