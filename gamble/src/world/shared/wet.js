// Rain: wet surfaces, puddles and falling rain.
//
//   makeWet(material, { puddles: 0..1, porous: 0..1 })  patches a ground material in place so it
//     darkens and turns glossy with WET.uWet, with world-space puddles (near-mirror patches that
//     catch the sky / env map and the reflection streaks) that grow with uPuddle.
//   wetBatch(group, test)  patches every mesh material under `group` that passes test(material).
//   new Rain(scene, { tier }) .update(dt, camera, amount)   GPU rain streaks around the camera.
//   WET.uWet / uPuddle / uTime — set by the world each frame (wetness lags rain: streets stay wet
//   for a while after the rain stops, like real life).

import * as THREE from 'three';
import { TileNoise } from '../../gfx/noise.js';

export const WET = {
  uWet: { value: 0 },
  uPuddle: { value: 0 },
  uTime: { value: 0 },
};

let puddleTex = null;
function puddleTexture() {
  if (puddleTex) return puddleTex;
  const S = 256;
  const N = new TileNoise(2718);
  const d = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const big = N.fbm(u, v, { freq: 3, octaves: 5 }) * 0.5 + 0.5;
      const mid = N.fbm(u + 0.3, v + 0.7, { freq: 9, octaves: 3 }) * 0.5 + 0.5;
      const i = (y * S + x) * 4;
      d[i] = Math.round(big * 255);
      d[i + 1] = Math.round(mid * 255);
      d[i + 2] = 0;
      d[i + 3] = 255;
    }
  }
  puddleTex = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  puddleTex.wrapS = puddleTex.wrapT = THREE.RepeatWrapping;
  puddleTex.magFilter = THREE.LinearFilter;
  puddleTex.minFilter = THREE.LinearMipmapLinearFilter;
  puddleTex.generateMipmaps = true;
  puddleTex.needsUpdate = true;
  return puddleTex;
}

const patched = new WeakSet();

export function makeWet(material, { puddles = 1, porous = 0.5 } = {}) {
  if (patched.has(material)) return material;
  patched.add(material);
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.onBeforeCompile = (sh, r) => {
    prev?.call(material, sh, r);
    sh.uniforms.uWet = WET.uWet;
    sh.uniforms.uPuddle = WET.uPuddle;
    sh.uniforms.tPuddle = { value: puddleTexture() };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWetPos;\nvarying float vWetUp;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWetPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWetUp = normalize(mat3(modelMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWetPos; varying float vWetUp; uniform float uWet; uniform float uPuddle; uniform sampler2D tPuddle;
        float wetPuddle() {
          vec4 pn = texture2D(tPuddle, vWetPos.xz / 23.0);
          float m = pn.r * 0.75 + pn.g * 0.25;
          // Puddles grow as rain continues (threshold drops with uPuddle).
          // Only flat, up-facing surfaces hold water (no puddles on walls or curb faces).
          return smoothstep(0.66 - uPuddle * 0.14, 0.7 - uPuddle * 0.14, m) * ${puddles.toFixed(2)} * smoothstep(0.85, 0.97, vWetUp);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float wPud = wetPuddle() * uWet;
        // Wet porous surfaces darken (water fills the pores); standing water darkens a bit more.
        diffuseColor.rgb *= 1.0 - uWet * ${(0.25 + porous * 0.3).toFixed(2)} - wPud * 0.15;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.38 + 0.06, uWet);
        roughnessFactor = mix(roughnessFactor, 0.03, wPud);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // Standing water is flat: blend the surface normal back toward the geometric normal.
        normal = normalize(mix(normal, nonPerturbedNormal, wPud));`);
  };
  material.customProgramCacheKey = () => `wet|${prevKey ? prevKey() : material.type}|${puddles}|${porous}`;
  material.needsUpdate = true;
  return material;
}

/** Patch every (unique) material under a group whose test(material) is true. */
export function wetBatch(group, test, opts) {
  const seen = new Set();
  group.traverse((o) => {
    if (!o.isMesh || !o.material || seen.has(o.material)) return;
    seen.add(o.material);
    const r = test(o.material);
    if (r) makeWet(o.material, typeof r === 'object' ? r : opts);
  });
}

// ---- Falling rain ----------------------------------------------------------------------------

export class Rain {
  constructor(scene, { tier } = {}) {
    const count = { low: 2500, medium: 5000, high: 9000, ultra: 14000 }[tier?.name] ?? 6000;
    const geo = new THREE.BufferGeometry();
    // Each drop is a thin quad (2 triangles) built in the vertex shader from a seed.
    const seeds = new Float32Array(count * 6 * 4);
    for (let i = 0; i < count; i++) {
      const sx = Math.random();
      const sy = Math.random();
      const sz = Math.random();
      const s = Math.random();
      for (let k = 0; k < 6; k++) {
        const o = (i * 6 + k) * 4;
        seeds[o] = sx;
        seeds[o + 1] = sy;
        seeds[o + 2] = sz;
        seeds[o + 3] = k + s * 0.5; // corner index + per-drop speed jitter in the fraction
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(seeds, 4));
    this.uniforms = {
      uTime: { value: 0 },
      uAmount: { value: 0 },
      uWind: { value: new THREE.Vector2(0.9, 0.3) },
      uCenter: { value: new THREE.Vector3() },
      uLight: { value: new THREE.Color(0.6, 0.62, 0.66) },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uAmount; uniform vec2 uWind; uniform vec3 uCenter;
        varying float vA; varying float vV;
        void main() {
          vec3 seed = position.xyz;
          float corner = floor(position.w);
          float jitter = fract(position.w) * 2.0;
          const vec3 box = vec3(36.0, 22.0, 36.0);
          float speed = 9.0 + jitter * 3.0;
          vec3 p;
          p.y = mod(seed.y * box.y - uTime * speed - uCenter.y, box.y) + uCenter.y - box.y * 0.35;
          p.xz = mod(seed.xz * box.xz + uWind * (uTime * 1.0) - uCenter.xz + box.xz * 0.5, box.xz) + uCenter.xz - box.xz * 0.5;
          // Streak: oriented along velocity, camera-facing width.
          vec3 vel = normalize(vec3(uWind.x * 0.12, -1.0, uWind.y * 0.12));
          float len = 0.55 + jitter * 0.25;
          vec3 toCam = normalize(cameraPosition - p);
          vec3 side = normalize(cross(vel, toCam)) * 0.006;
          float c = corner;
          float along = (c == 1.0 || c == 2.0 || c == 4.0) ? 1.0 : 0.0;
          float s = (c == 0.0 || c == 1.0 || c == 3.0) ? -1.0 : 1.0;
          vec3 world = p + vel * len * along + side * s;
          // Fewer drops when it's drizzling: discard a fraction by seed.
          vA = step(seed.x * 0.999, uAmount) * smoothstep(0.0, 4.0, length(cameraPosition - p));
          vV = along;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLight; varying float vA; varying float vV;
        void main() {
          if (vA < 0.01) discard;
          float a = vA * (0.25 + 0.35 * vV);
          gl_FragColor = vec4(uLight * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.name = 'rain';
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.scene = scene;
    this.t = 0;
  }

  update(dt, camera, amount, lightColor) {
    this.t += dt;
    this.uniforms.uTime.value = this.t;
    this.uniforms.uAmount.value = amount;
    this.uniforms.uCenter.value.copy(camera.position);
    if (lightColor) this.uniforms.uLight.value.copy(lightColor);
    this.mesh.visible = amount > 0.01;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
