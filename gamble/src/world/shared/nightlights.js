// Night lighting for outdoor areas without hundreds of real lights.
//
// Every light source a builder registers ({pos, color, intensity, distance, kind, height,
// width?, flicker?, ground?}) gets three cheap representations:
//   1. A ground light pool — an additive, radially-faded quad on the pavement under the source
//      (instanced, one draw call for the whole city). This is what you see down the block.
//   2. A wet-street reflection streak — a camera-facing, view-stretched additive quad anchored on
//      the ground under/in front of the source (instanced). Strength follows uWet, so on a rainy
//      night every lamp and neon sign smears a shimmering column of colour toward the viewer.
//   3. Near the viewer, a real (shadowless) PointLight from a small fixed pool (tier-sized) so
//      characters, cars and walls next to you are lit properly. Pool lights fade between sources
//      as you walk; the pool size never changes, so no shader recompiles.
//
//   const nl = new NightLights(scene, lights, { tier });
//   nl.update(dt, { night, wet, viewer, camera, time })

import * as THREE from 'three';
import { canvasTexture } from '../../gfx/textures.js';
import { damp } from '../../core/util.js';

const POOL_SIZE = { low: 2, medium: 4, high: 6, ultra: 8 };

function radialTexture() {
  return canvasTexture('light-pool', 128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.62)');
    grd.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { srgb: false });
}

export class NightLights {
  constructor(scene, lights, { tier } = {}) {
    this.scene = scene;
    this.lights = lights;
    this.group = new THREE.Group();
    this.group.name = 'night-lights';
    scene.add(this.group);
    this.uniforms = {
      uNight: { value: 0 },
      uWet: { value: 0 },
      uTime: { value: 0 },
      uPoolK: { value: 1 },
    };
    this._buildPools();
    this._buildStreaks();
    const n = POOL_SIZE[tier?.name] ?? 4;
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.castShadow = false;
      l.userData = { src: null, target: 0 };
      this.group.add(l);
      this.pool.push(l);
    }
    this._t = 0;
    this._sel = 0;
  }

  _buildPools() {
    const src = this.lights.filter((l) => l.ground !== false && l.kind !== 'neon-high');
    const n = src.length;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const col = new Float32Array(n * 3);
    const mat = new THREE.MeshBasicMaterial({
      map: radialTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -12,
      fog: true,
      toneMapped: true,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = this.uniforms.uNight;
      sh.uniforms.uWet = this.uniforms.uWet;
      sh.uniforms.uPoolK = this.uniforms.uPoolK;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uWet; uniform float uPoolK;')
        .replace('#include <opaque_fragment>', `
          // Wet pavement scatters less light diffusely (more goes into the reflection streaks).
          outgoingLight *= uNight * uPoolK * (1.0 - uWet * 0.35);
          #include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => 'light-pools';
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color();
    src.forEach((l, i) => {
      const r = (l.distance ?? 12) * (l.kind === 'street' ? 0.95 : l.kind === 'neon' ? 0.55 : 0.75);
      const gy = l.groundY ?? (l.pos.y > 2 ? groundYAt(l) : l.pos.y - 1);
      // Pools sit under the source, pushed slightly out for wall-mounted signs.
      const p = l.groundPos || new THREE.Vector3(l.pos.x, gy + 0.02, l.pos.z);
      m4.makeScale(r * 2, 1, r * 2).setPosition(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m4);
      // Pool brightness ∝ source intensity / height² (inverse square to the ground), clamped.
      const hgt = Math.max(1.5, l.pos.y - gy);
      const k = Math.min(1.4, ((l.intensity ?? 10) / (hgt * hgt)) * 1.9) * (l.poolK ?? 1);
      c.set(l.color).multiplyScalar(k);
      mesh.setColorAt(i, c);
      void col;
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.name = 'light-pools';
    this.group.add(mesh);
    this.pools = mesh;
  }

  _buildStreaks() {
    const src = this.lights.filter((l) => l.reflect !== false);
    const n = src.length;
    const geo = new THREE.PlaneGeometry(1, 1);
    // Instance data: anchor (xyz), height of source above ground, width, colour*intensity.
    const aAnchor = new Float32Array(n * 4);
    const aCol = new Float32Array(n * 4);
    src.forEach((l, i) => {
      const gy = l.groundY ?? (l.pos.y > 2 ? groundYAt(l) : l.pos.y - 1);
      const a = l.groundPos || new THREE.Vector3(l.pos.x, gy, l.pos.z);
      aAnchor[i * 4] = a.x;
      aAnchor[i * 4 + 1] = gy + 0.025;
      aAnchor[i * 4 + 2] = a.z;
      aAnchor[i * 4 + 3] = Math.max(1, l.pos.y - gy);
      const c = new THREE.Color(l.color);
      const k = Math.min(3.5, (l.intensity ?? 10) / 8) * (l.reflectK ?? 1);
      aCol[i * 4] = c.r * k;
      aCol[i * 4 + 1] = c.g * k;
      aCol[i * 4 + 2] = c.b * k;
      aCol[i * 4 + 3] = l.width ?? (l.kind === 'neon' ? 1.6 : 0.55);
    });
    geo.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(aAnchor, 4));
    geo.setAttribute('aCol', new THREE.InstancedBufferAttribute(aCol, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, ...THREE.UniformsLib.fog },
      vertexShader: /* glsl */ `
        attribute vec4 aAnchor;
        attribute vec4 aCol;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vFade;
        #include <fog_pars_vertex>
        void main() {
          vec3 anchor = aAnchor.xyz;
          float hgt = aAnchor.w;
          vec3 toCam = cameraPosition - anchor;
          vec2 dirXZ = normalize(toCam.xz + 1e-4);
          float dist = length(toCam.xz);
          // Reflection of a point at height h seen from eye height e lands at distance d*h/(h+e)
          // from the anchor toward the viewer; stretch the streak over that span (+ rain smear).
          float eye = max(cameraPosition.y - anchor.y, 0.3);
          float reach = min(dist * 0.92, dist * hgt / (hgt + eye) * 1.35 + 0.6);
          vec2 side = vec2(-dirXZ.y, dirXZ.x);
          float w = aCol.w * (0.7 + 0.3 * clamp(dist / 30.0, 0.0, 1.0));
          vec2 p = anchor.xz + dirXZ * (position.y + 0.5) * reach + side * position.x * w;
          vec3 world = vec3(p.x, anchor.y, p.y);
          vUv = vec2(position.x + 0.5, position.y + 0.5);
          vCol = aCol.rgb;
          vFade = smoothstep(2.0, 6.0, dist) * (1.0 - smoothstep(90.0, 160.0, dist));
          vec4 mvPosition = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        uniform float uWet;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vCol;
        varying float vFade;
        #include <fog_pars_fragment>
        float h1(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          float across = 1.0 - abs(vUv.x * 2.0 - 1.0);
          across = pow(across, 1.6);
          // Brightest near the anchor (base of the reflection), fading toward the viewer.
          float along = (1.0 - vUv.y) * smoothstep(0.0, 0.08, vUv.y);
          along = pow(along, 1.4) + smoothstep(0.85, 1.0, 1.0 - vUv.y) * 0.4;
          // Rain ripples break the column into shimmering bands.
          float band = 0.6 + 0.4 * sin(vUv.y * 38.0 - uTime * 3.0 + h1(floor(vUv.y * 12.0)) * 6.0);
          float ripple = mix(1.0, band, 0.7);
          float a = across * along * ripple * vFade * uNight * uWet;
          gl_FragColor = vec4(vCol * a * 1.15, 1.0);
          #include <fog_fragment>
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: true,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    mesh.count = n;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    mesh.name = 'wet-reflections';
    this.group.add(mesh);
    this.streaks = mesh;
  }

  update(dt, { night = 0, wet = 0, viewer, time = 0 }) {
    this.uniforms.uNight.value = night;
    this.uniforms.uWet.value = wet;
    this.uniforms.uTime.value = time;
    this.pools.visible = night > 0.01;
    this.streaks.visible = night > 0.01 && wet > 0.01;
    this._t += dt;
    // Re-pick the nearest sources a few times per second.
    if (this._t > 0.25 && viewer && night > 0.01) {
      this._t = 0;
      const scored = [];
      for (const l of this.lights) {
        if (l.realLight === false) continue;
        const d = l.pos.distanceTo(viewer);
        const reach = (l.distance ?? 12) * 1.6 + 6;
        if (d > reach + 30) continue;
        scored.push({ l, s: d / (Math.sqrt(l.intensity ?? 10) + 0.5) });
      }
      scored.sort((a, b) => a.s - b.s);
      const want = new Set(scored.slice(0, this.pool.length).map((x) => x.l));
      // Keep lights already assigned to wanted sources; free the rest.
      const free = [];
      for (const pl of this.pool) {
        if (pl.userData.src && want.has(pl.userData.src)) want.delete(pl.userData.src);
        else free.push(pl);
      }
      for (const src of want) {
        const pl = free.find((f) => f.intensity < 0.05) || free.shift();
        if (!pl) break;
        const i = free.indexOf(pl);
        if (i >= 0) free.splice(i, 1);
        pl.userData.src = src;
        pl.position.copy(src.pos);
        if (src.offset) pl.position.add(src.offset);
        pl.color.set(src.color);
        pl.distance = (src.distance ?? 12) * 1.25;
        pl.decay = 1.6;
      }
      for (const pl of free) pl.userData.src = null;
    }
    for (const pl of this.pool) {
      const src = pl.userData.src;
      let target = 0;
      if (src && night > 0.01) {
        target = (src.intensity ?? 10) * night;
        if (src.flicker) target *= Math.sin(time * 47 + src.pos.x) * Math.sin(time * 13) > 0.6 ? 0.15 : 1;
      }
      pl.intensity = damp(pl.intensity, target, 0.12, dt);
      pl.visible = true;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.pools.geometry.dispose();
    this.streaks.geometry.dispose();
    this.streaks.material.dispose();
  }
}

// Ground height under a light: builders can pass groundY; default sidewalk/road heuristic.
function groundYAt(l) {
  return l.groundY ?? 0.0;
}
