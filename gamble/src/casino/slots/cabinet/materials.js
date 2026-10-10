// Shared slot-floor materials.
//
//   ledMaterial()     one material for every LED strip, candle and bezel glow in a bank: each
//                     vertex carries its machine index (aIdx) and a position along the strip
//                     (aPhase); per-machine colour / level / mode live in uniform arrays, so a
//                     whole bank of edge lighting is ONE draw call and a jackpot can still make a
//                     single machine strobe.
//   buttonMaterial()  instanced deck buttons with per-instance label rects (iUv) and glow (iGlow)
//                     sampled from one shared label atlas.
//   cabinetMats(theme) the PBR kinds (materials.js) a cabinet is built from, cached per theme.

import * as THREE from 'three';
import { mat } from '../../../gfx/materials.js';

export const MAX_MACHINES = 16;

export const THEME_LOOK = {
  'classic-fruit': { body: 0x8e0f16, accent: 0xd8b25a, led: 0xffd9a0, led2: 0xff4a3a, glass: 0xfff1d6 },
  'wild-west': { body: 0x4e2a14, accent: 0xd89a3a, led: 0xffa53a, led2: 0xff5a1a, glass: 0xffd9a0 },
  space: { body: 0x1b1446, accent: 0x5ad8ff, led: 0x38d9ff, led2: 0xff3ea5, glass: 0xc8f0ff },
  dragon: { body: 0x6e0a12, accent: 0xe8b84a, led: 0xffc040, led2: 0xff3a1a, glass: 0xffe0a0 },
};

/** Candle (tower light) colour by denomination. */
export const DENOM_CANDLE = { 0.01: 0x3aff6a, 0.05: 0xff3a3a, 0.25: 0xffd23a, 1: 0x3a8aff };

export function ledMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: Array.from({ length: MAX_MACHINES }, () => new THREE.Color(1, 1, 1)) },
    uColor2: { value: Array.from({ length: MAX_MACHINES }, () => new THREE.Color(1, 0.3, 0.2)) },
    // x = level, y = mode (0 steady, 1 chase, 2 strobe celebration, 3 slow breathe), z = candle flash, w = service
    uState: { value: Array.from({ length: MAX_MACHINES }, () => new THREE.Vector4(1, 3, 0, 0)) },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      attribute float aIdx;
      attribute float aPhase;
      attribute float aKind;   // 0 strip (colour 1), 1 strip (colour 2), 2 candle top, 3 candle base, 4 static glow (vertex colour)
      attribute vec3 aCol;
      varying float vIdx; varying float vPhase; varying float vKind; varying vec3 vCol;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main() {
        vIdx = aIdx; vPhase = aPhase; vKind = aKind; vCol = aCol;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor[${MAX_MACHINES}];
      uniform vec3 uColor2[${MAX_MACHINES}];
      uniform vec4 uState[${MAX_MACHINES}];
      varying float vIdx; varying float vPhase; varying float vKind; varying vec3 vCol;
      #include <logdepthbuf_pars_fragment>
      void main() {
        #include <logdepthbuf_fragment>
        int i = int(vIdx + 0.5);
        vec4 st = uState[i];
        vec3 c1 = uColor[i];
        vec3 c2 = uColor2[i];
        float lvl = st.x;
        float mode = st.y;
        vec3 col;
        if (vKind > 3.5) {
          col = vCol;
        } else if (vKind > 2.5) {
          // candle base: denomination colour, flashes when attendant called
          float f = st.z > 0.5 ? step(0.5, fract(uTime * 1.6)) * 1.6 + 0.2 : 1.0;
          col = vCol * f;
        } else if (vKind > 1.5) {
          // candle top: white, on when service / hand pay
          float f = st.w > 0.5 ? (0.4 + 1.8 * step(0.5, fract(uTime * 1.6 + 0.5))) : 0.12;
          col = vec3(1.0, 0.97, 0.9) * f;
        } else {
          vec3 base = vKind > 0.5 ? c2 : c1;
          float k = 1.0;
          if (mode < 0.5) k = 1.0;
          else if (mode < 1.5) k = 0.55 + 0.45 * sin(vPhase * 18.0 - uTime * 6.0);
          else if (mode < 2.5) { k = 0.35 + 1.4 * step(0.5, fract(uTime * 5.0 + vPhase * 3.0)); base = mix(c1, c2, step(0.5, fract(uTime * 2.5))); }
          else k = 0.7 + 0.3 * sin(uTime * 1.3 + vPhase * 2.0);
          col = base * lvl * k;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  m.name = 'slot-led';
  return m;
}

/** Attach the LED attributes to a geometry (all vertices share idx / kind; phase runs along `axis`). */
export function ledAttrs(geo, idx, kind, { axis = 'y', color = null, phase0 = 0, phaseScale = 1 } = {}) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const a = new Float32Array(n).fill(idx);
  const k = new Float32Array(n).fill(kind);
  const p = new Float32Array(n);
  const c = new Float32Array(n * 3);
  const col = new THREE.Color(color ?? 0xffffff);
  for (let i = 0; i < n; i++) {
    p[i] = phase0 + pos.getComponent(i, axis === 'x' ? 0 : axis === 'y' ? 1 : 2) * phaseScale;
    c[i * 3] = col.r;
    c[i * 3 + 1] = col.g;
    c[i * 3 + 2] = col.b;
  }
  geo.setAttribute('aIdx', new THREE.BufferAttribute(a, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(k, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(p, 1));
  geo.setAttribute('aCol', new THREE.BufferAttribute(c, 3));
  for (const key of Object.keys(geo.attributes)) if (!['position', 'aIdx', 'aKind', 'aPhase', 'aCol'].includes(key)) geo.deleteAttribute(key);
  return geo;
}

/** Deck buttons: label atlas + per-instance rect and glow. */
export function buttonMaterial(atlas) {
  const m = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.28, metalness: 0.0, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 1 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 iUv;\nattribute float iGlow;\nvarying float vGlow;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = iUv.xy + uv * iUv.zw;\n#endif\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv = iUv.xy + uv * iUv.zw;\n#endif\nvGlow = iGlow;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;');
  };
  m.name = 'slot-buttons';
  return m;
}

const cabCache = new Map();
/** PBR materials for cabinets of a theme (cached; materials.js bakes each kind once). */
export function cabinetMats(theme) {
  let c = cabCache.get(theme);
  if (c) return c;
  const look = THEME_LOOK[theme];
  c = {
    body: mat('car-paint', { color: look.body, wear: 0.08, dirt: 0.12 }),
    dark: mat('metal-painted', { color: 0x17171a, wear: 0.25, dirt: 0.3 }),
    black: mat('plastic', { color: 0x0e0e10, wear: 0.2, dirt: 0.25 }),
    chrome: mat('chrome', { wear: 0.15, dirt: 0.12 }),
    gold: mat('brass', { wear: 0.2, dirt: 0.15 }),
    rubber: mat('rubber', { color: 0x141416 }),
    deck: mat('leather', { color: 0x141012, wear: 0.35, dirt: 0.2 }),
  };
  cabCache.set(theme, c);
  return c;
}
