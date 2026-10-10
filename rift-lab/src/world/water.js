// Lake + river surfaces. Built on the same 2 m grid as the land, at the real water
// level of each spot (the river surface slopes downhill), with flow direction per
// vertex so ripples move downstream. Shallow edges are see-through, deep water is dark.

import * as THREE from 'three';
import { N, CELL, HALF } from './terrainGen.js';
import { makeWaterNormal } from './textures.js';

export class Water {
  constructor({ gen }) {
    this.gen = gen;
    this.normalTex = makeWaterNormal(gen.seed);
    this.material = makeWaterMaterial(this.normalTex);
    this.mesh = this.build();
    this.mesh.name = 'water';
  }

  build() {
    const { H, W, river } = this.gen;
    const vIndex = new Int32Array(N * N).fill(-1);
    const pos = [], depth = [], flow = [];
    const level = (i, j) => {
      const k = j * N + i;
      if (W[k] > -1e8) return W[k];
      // extend the surface one cell past the shore so it meets the ground cleanly
      let best = -1e9;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
        best = Math.max(best, W[jj * N + ii]);
      }
      return best;
    };
    const vert = (i, j) => {
      const k = j * N + i;
      if (vIndex[k] >= 0) return vIndex[k];
      const y = level(i, j);
      const x = i * CELL - HALF, z = j * CELL - HALF;
      pos.push(x, y, z);
      depth.push(Math.max(0, y - H[k]));
      const hit = river.grid.nearest(x, z, 12);
      if (hit) {
        const l = Math.hypot(hit.dir.x, hit.dir.z) || 1;
        const speed = 0.6 + 1.6 * Math.min(1, (hit.point.depth < 0.8 ? 1.4 : 0.7));
        flow.push((hit.dir.x / l) * speed, (hit.dir.z / l) * speed);
      } else flow.push(0, 0);
      vIndex[k] = pos.length / 3 - 1;
      return vIndex[k];
    };
    const idx = [];
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = j * N + i, b = (j + 1) * N + i, c = j * N + i + 1, d = (j + 1) * N + i + 1;
        if (W[a] < -1e8 && W[b] < -1e8 && W[c] < -1e8 && W[d] < -1e8) continue;
        const va = vert(i, j), vb = vert(i, j + 1), vc = vert(i + 1, j), vd = vert(i + 1, j + 1);
        idx.push(va, vb, vc, vb, vd, vc);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(depth, 1));
    g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material);
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    return mesh;
  }

  update(dt, sky) {
    const u = this.material.userData.uniforms;
    u.uTime.value += dt;
    u.uNight.value = sky.state.night;
  }
}

function makeWaterMaterial(normalTex) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0f2a2e, roughness: 0.04, metalness: 0, transparent: true, opacity: 1,
    side: THREE.DoubleSide, envMapIntensity: 1.0, ior: 1.333, specularIntensity: 1,
  });
  mat.userData.uniforms = { tRipple: { value: normalTex }, uTime: { value: 0 }, uNight: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, mat.userData.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aDepth;\nattribute vec2 aFlow;\nvarying float vDepth;\nvarying vec2 vFlow;\nvarying vec3 vWWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDepth = aDepth;\nvFlow = aFlow;\nvWWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tRipple;\nuniform float uTime;\nuniform float uNight;\nvarying float vDepth;\nvarying vec2 vFlow;\nvarying vec3 vWWorld;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float dpt = vDepth;
        // shallow = clear + a bit brown from the bed, deep = dark green-blue
        vec3 shallowCol = vec3(0.10, 0.13, 0.09);
        vec3 deepCol = vec3(0.012, 0.045, 0.05);
        diffuseColor.rgb = mix(shallowCol, deepCol, smoothstep(0.0, 3.0, dpt));
        float speed = length(vFlow);
        float foam = smoothstep(1.2, 2.2, speed) * 0.25 + smoothstep(0.25, 0.0, dpt) * 0.15;
        diffuseColor.rgb += foam * (0.6 - 0.5 * uNight);
      `)
      .replace('#include <normal_fragment_maps>', `
        vec2 p = vWWorld.xz;
        vec2 fl = vFlow;
        float t = uTime;
        // two layers of ripples drifting (downstream on the river, with the breeze on the lake)
        vec2 drift = length(fl) > 0.01 ? fl : vec2(0.05, 0.03);
        vec3 n1 = texture2D(tRipple, p / 9.0 + drift * t / 9.0).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(tRipple, p / 3.7 - drift.yx * t / 5.0 + 0.37).xyz * 2.0 - 1.0;
        vec3 rn = normalize(vec3(n1.xy + n2.xy * 0.6, 3.2 - length(fl) * 0.8));
        vec3 wN = normalize(vec3(rn.x, rn.z, rn.y));
        normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);
        if (!gl_FrontFacing) normal = -normal;
      `)
      .replace('#include <opaque_fragment>', `
        // see-through near the shore, Fresnel makes grazing angles reflective
        vec3 vdir = normalize(vViewPosition);
        float fres = pow(1.0 - abs(dot(normal, -vdir)), 5.0);
        float alpha = clamp(smoothstep(0.0, 1.6, vDepth) * 0.75 + 0.2 + fres * 0.6, 0.0, 1.0);
        alpha *= smoothstep(0.0, 0.08, vDepth + 0.02);
        diffuseColor.a = alpha;
        #include <opaque_fragment>
      `);
  };
  mat.customProgramCacheKey = () => 'riftlab-water-v1';
  return mat;
}
