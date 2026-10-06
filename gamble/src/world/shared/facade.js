// Windows that look like windows: interior-mapped glass and procedural tower facades.
//
// Every glass pane is a quad whose UVs run 0..1 across the pane; the pane's size in metres and a
// per-pane seed ride in the vertex colour (r = width/10, g = height/10, b = seed). The fragment
// shader casts the view ray into a virtual room behind the glass ("interior mapping") and shades
// floor / ceiling / walls / furniture silhouettes / curtains / blinds, lit or dark per room.
// The glass itself stays a real PBR surface (sky reflections + Fresnel from scene.environment).
//
//   glassMat({ style: 'room' | 'shop' | 'office' | 'dark', tint })
//   paneGeometry(w, h, seed)   → PlaneGeometry carrying the size/seed attributes
//   towerFacadeMat({ wall: material, cell: [sx, sy], win: [wx, wy], y0, y1, style, frame })
//     → the wall material with a window grid baked in by shader (every window interior-mapped,
//       lit at random with a time-of-day dependent fraction). Uses world position, so any box
//       works — no UV setup, no repetition.
//   FACADE.uNight / uTime / uLit  — shared uniforms the world updates once per frame.

import * as THREE from 'three';

export const FACADE = {
  uNight: { value: 0 }, // 0 day .. 1 night
  uTime: { value: 0 },
  uLit: { value: 0.45 }, // fraction of rooms with lights on
  uWet: { value: 0 },
};

const INTERIOR_GLSL = /* glsl */ `
  float ih1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  float ih2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // Casino floor seen through entrance glass: patterned carpet, a ceiling of warm downlights,
  // rows of slot machines with flickering screens, always lit (casinos never close).
  vec4 interiorCasino(vec2 p, vec2 sz, vec3 rd, float seed, float time) {
    float depth = 16.0;
    vec3 lo = vec3(-6.0, -0.15, -depth);
    vec3 hi = vec3(sz.x + 6.0, 4.6, 0.0);
    vec3 ro = vec3(p, 0.0);
    rd.z = min(rd.z, -1e-3);
    vec3 ird = 1.0 / rd;
    vec3 tf = max((lo - ro) * ird, (hi - ro) * ird);
    float t = min(min(tf.x, tf.y), tf.z);
    vec3 h = ro + rd * t;
    vec3 col;
    float fog = clamp(t / 22.0, 0.0, 1.0);
    if (abs(tf.y - t) < 1e-4 && h.y < 0.0) {
      vec2 q = h.xz / 0.9;
      vec2 c = fract(q) - 0.5;
      float motif = smoothstep(0.32, 0.28, length(c)) * 0.6 + step(0.45, abs(c.x)) * 0.4;
      col = mix(vec3(0.18, 0.05, 0.06), vec3(0.55, 0.38, 0.12), motif) * 0.9;
      // Slot machine bases cast pools of screen light onto the carpet.
      col += vec3(0.5, 0.3, 0.6) * 0.15 * (0.5 + 0.5 * sin(h.x * 2.0 + time));
    } else if (abs(tf.y - t) < 1e-4) {
      vec2 q = fract(h.xz / vec2(1.6, 1.6)) - 0.5;
      col = vec3(0.08, 0.06, 0.05) + vec3(2.6, 2.0, 1.3) * smoothstep(0.12, 0.0, length(q));
      col += vec3(1.2, 0.9, 0.5) * 0.3;
    } else {
      // Walls: rows of machines (screens + button decks), signage glow above.
      float bank = floor((abs(tf.x - t) < 1e-4 ? h.z : h.x) / 0.75);
      float r = ih1(bank + seed * 7.0);
      vec3 scr = vec3(0.5 + 0.5 * sin(r * 20.0 + time * (1.0 + r)), 0.5 + 0.5 * sin(r * 13.0 + 2.0), 0.6 + 0.4 * sin(r * 7.0 + time * 0.7));
      float y = h.y;
      col = vec3(0.05, 0.04, 0.05);
      col = mix(col, scr * 2.2, step(0.9, y) * step(y, 1.55) * step(0.08, fract((abs(tf.x - t) < 1e-4 ? h.z : h.x) / 0.75)));
      col = mix(col, vec3(1.6, 1.0, 0.35), step(1.9, y) * step(y, 2.2));
      col = mix(col, vec3(0.25, 0.08, 0.06), step(2.2, y));
    }
    col = mix(col, vec3(0.35, 0.22, 0.12), fog * 0.6);
    return vec4(col, 1.0);
  }
  // style: 0 hotel/motel room, 1 shop, 2 office, 3 dark/abandoned
  // p: point on the pane (m, from bottom-left), sz: pane size (m), rd: ray in pane space
  // (x right, y up, z out of the glass toward the viewer). Returns rgb radiance, a = lit amount.
  vec4 interiorRoom(vec2 p, vec2 sz, vec3 rd, float seed, float style, float night, float litFrac, float time) {
    if (style > 3.5) return interiorCasino(p, sz, rd, seed, time);
    float depth = style > 0.5 && style < 1.5 ? 7.0 : (style > 1.5 && style < 2.5 ? 5.0 : 3.6);
    float sill = style > 0.5 && style < 1.5 ? 0.35 : 0.9;
    vec3 lo = vec3(-0.7, -sill, -depth);
    vec3 hi = vec3(sz.x + 0.7, sz.y + 0.45, 0.0);
    vec3 ro = vec3(p, 0.0);
    rd.z = min(rd.z, -1e-3);
    vec3 ird = 1.0 / rd;
    vec3 t1 = (lo - ro) * ird;
    vec3 t2 = (hi - ro) * ird;
    vec3 tf = max(t1, t2);
    float t = min(min(tf.x, tf.y), tf.z);
    vec3 h = ro + rd * t;
    float r1 = ih1(seed * 91.7 + 1.3);
    float r2 = ih1(seed * 57.3 + 4.1);
    float r3 = ih1(seed * 13.1 + 7.7);
    bool lit = r1 < litFrac;
    if (style > 2.5) lit = false;
    if (style > 0.5 && style < 1.5) lit = true; // shops keep the lights on
    // Wall colours: tired motel beige / teal / mint / grey.
    vec3 wallC = mix(vec3(0.62, 0.55, 0.45), vec3(0.42, 0.55, 0.52), step(0.6, r2));
    wallC = mix(wallC, vec3(0.55, 0.5, 0.48), step(0.85, r2));
    vec3 floorC = mix(vec3(0.22, 0.17, 0.13), vec3(0.3, 0.26, 0.22), r3);
    vec3 ceilC = vec3(0.72, 0.7, 0.66);
    vec3 col;
    float fx = abs(tf.x - t) < 1e-4 ? 1.0 : 0.0;
    float fy = abs(tf.y - t) < 1e-4 ? 1.0 : 0.0;
    float rel = clamp(-h.z / depth, 0.0, 1.0);
    if (fy > 0.5) {
      if (h.y < 0.0) {
        col = floorC;
        if (style > 0.5 && style < 1.5) {
          vec2 tile = floor(h.xz / 0.45);
          col = mix(vec3(0.62, 0.6, 0.55), vec3(0.3, 0.3, 0.3), mod(tile.x + tile.y, 2.0) * 0.6);
        }
      } else {
        col = ceilC;
        if (style > 0.5 && style < 1.5) {
          // Fluorescent troffers.
          vec2 q = fract(h.xz / vec2(1.8, 2.4));
          col += vec3(1.6, 1.7, 1.75) * step(0.3, q.x) * step(q.x, 0.7) * step(0.2, q.y) * step(q.y, 0.5) * (lit ? 1.0 : 0.0);
        } else {
          float d = length(h.xz - vec2(sz.x * 0.5, -depth * 0.45));
          col += vec3(1.4, 1.2, 0.9) * smoothstep(0.35, 0.0, d) * (lit ? 1.0 : 0.0);
        }
      }
    } else if (fx > 0.5) {
      col = wallC * 0.82;
      if (style > 0.5 && style < 1.5) {
        // Side shelving with merchandise.
        float shelf = step(0.82, fract((h.y + sill) / 0.42));
        float slot = floor(-h.z / 0.16) + floor((h.y + sill) / 0.42) * 17.0;
        vec3 prod = vec3(ih1(slot + seed), ih1(slot * 1.7 + seed), ih1(slot * 2.3 + seed));
        prod = mix(vec3(dot(prod, vec3(0.33))), prod, 0.45) * 0.55 + 0.12;
        col = mix(prod, vec3(0.62), shelf);
        col *= step(h.y + sill, 2.0) * 0.85 + 0.15;
      }
    } else {
      col = wallC;
      if (style < 0.5) {
        // Motel/hotel room: framed print + headboard / TV silhouette.
        vec2 q = h.xy - vec2(sz.x * 0.5, sz.y * 0.55);
        float art = step(abs(q.x), 0.45) * step(abs(q.y), 0.3);
        col = mix(col, vec3(r2, r3, 1.0 - r2) * 0.5 + 0.2, art);
        float bed = step(h.y, -sill + 0.75) * step(abs(h.x - sz.x * 0.5), 1.1);
        col = mix(col, vec3(0.35, 0.3, 0.28) * (0.8 + r3 * 0.4), bed);
      } else if (style < 1.5) {
        float shelf = step(0.8, fract((h.y + sill) / 0.42));
        float slot = floor(h.x / 0.13) + floor((h.y + sill) / 0.42) * 31.0;
        vec3 prod = vec3(ih1(slot + seed * 3.0), ih1(slot * 1.3 + seed), ih1(slot * 0.7 + seed * 2.0));
        prod = mix(vec3(dot(prod, vec3(0.33))), prod, 0.45) * 0.55 + 0.12;
        col = mix(prod, vec3(0.66), shelf);
        col = mix(col, wallC, step(2.1, h.y + sill));
      } else if (style < 2.5) {
        float cab = step(h.y, -sill + 1.0);
        col = mix(col, vec3(0.3), cab * 0.6);
      } else {
        col = vec3(0.15, 0.14, 0.13);
      }
    }
    // Light falloff into the room; lit colour per room (warm bulbs, cool LEDs, TV flicker).
    vec3 lightC = mix(vec3(1.0, 0.74, 0.46), vec3(0.85, 0.92, 1.0), step(0.72, r3));
    float tv = step(0.86, r2) * step(style, 0.5);
    float flick = 0.75 + 0.25 * sin(time * (7.0 + r3 * 9.0) + seed * 40.0) * sin(time * 2.3 + r1 * 30.0);
    lightC = mix(lightC, vec3(0.45, 0.6, 1.0) * flick, tv);
    float falloff = mix(1.0, 0.55, rel);
    float on = lit ? 1.0 : 0.0;
    // Daylight in the room is dim compared to outside; lit rooms glow at night.
    vec3 dayLight = vec3(0.16, 0.17, 0.18) * (1.0 - night);
    vec3 nightLight = lightC * on * falloff * (style > 0.5 && style < 1.5 ? 1.25 : 0.95);
    vec3 radiance = col * (dayLight + nightLight * mix(0.35, 1.0, night)) + col * 0.006;
    // Curtains / blinds in the glass plane (rooms and offices only).
    if (style < 0.5 || (style > 1.5 && style < 2.5)) {
      float cur = ih1(seed * 3.3 + 11.0);
      if (cur < 0.55) {
        float open = 0.12 + ih1(seed * 7.1) * 0.35;
        float edge = min(p.x, sz.x - p.x);
        float folds = 0.82 + 0.18 * sin(p.x * 28.0 + seed);
        float cover = step(edge, sz.x * (0.5 - open * 0.5));
        vec3 cc = mix(vec3(0.55, 0.42, 0.3), vec3(0.32, 0.36, 0.45), step(0.5, ih1(seed * 5.0))) * folds;
        vec3 glow = cc * (lightC * on * 0.85 * mix(0.3, 1.0, night) + vec3(0.12) * (1.0 - night));
        radiance = mix(radiance, glow, cover);
      } else if (cur < 0.8) {
        float slat = smoothstep(0.35, 0.55, fract(p.y / 0.06));
        float down = step(sz.y * (0.25 + ih1(seed * 9.0) * 0.6), p.y);
        vec3 bc = vec3(0.8, 0.78, 0.72) * (lightC * on * 0.7 * mix(0.35, 1.0, night) + vec3(0.18) * (1.0 - night));
        radiance = mix(radiance, bc, slat * down * 0.85);
      }
    }
    return vec4(radiance, on);
  }
`;

const _patched = new WeakSet();

function addCommonVertex(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nvarying vec3 vPane;')
    .replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWNrm = normalize(mat3(modelMatrix) * objectNormal);
      #ifdef USE_COLOR
        vPane = color.rgb;
      #else
        vPane = vec3(0.2, 0.2, 0.5);
      #endif`
    );
}

/**
 * Interior-mapped window glass.
 * @param {{style?:'room'|'shop'|'office'|'dark', tint?:number, reflect?:number}} o
 */
const glassCache = new Map();
export function glassMat({ style = 'room', tint = 0x9aa7ad, reflect = 1.0 } = {}) {
  const key = `${style}|${tint}|${reflect}`;
  if (glassCache.has(key)) return glassCache.get(key);
  const styleId = { room: 0, shop: 1, office: 2, dark: 3, casino: 4 }[style] ?? 0;
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(tint).multiplyScalar(0.06),
    roughness: 0.06,
    metalness: 0.0,
    envMapIntensity: reflect * 1.4,
    vertexColors: true,
  });
  m.name = `glass-${style}`;
  m.userData.tileMeters = 1;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = FACADE.uNight;
    shader.uniforms.uTime = FACADE.uTime;
    shader.uniforms.uLit = FACADE.uLit;
    addCommonVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vPane;
        uniform float uNight; uniform float uTime; uniform float uLit;
        ${INTERIOR_GLSL}`
      )
      .replace('#include <color_fragment>', '') // vertex colour carries pane data, not tint
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 N = normalize(vWNrm);
          vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N));
          vec3 B = cross(N, T);
          vec3 V = normalize(vWPos - cameraPosition);
          vec3 rd = vec3(dot(V, T), dot(V, B), dot(V, N));
          vec2 sz = max(vPane.rg * 10.0, vec2(0.2));
          vec2 pp = vUv * sz;
          vec4 room = interiorRoom(pp, sz, rd, floor(vPane.b * 997.0) + 1.0, ${styleId.toFixed(1)}, uNight, uLit, uTime);
          // Dirty glass: a little grime toward the bottom corners.
          float grime = smoothstep(0.35, 0.0, vUv.y) * 0.25;
          totalEmissiveRadiance += room.rgb * (1.0 - grime);
        }`
      );
    // vUv is only declared when a map is used; make sure we have it.
    if (!/varying vec2 vUv;/.test(shader.fragmentShader)) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vUv;');
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvUv = uv;');
    }
  };
  m.customProgramCacheKey = () => `glass-${styleId}`;
  glassCache.set(key, m);
  return m;
}

/** Plane (facing +Z) with pane size & seed packed in vertex colours for glassMat. */
export function paneGeometry(w, h, seed = Math.random()) {
  const g = new THREE.PlaneGeometry(w, h);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = w / 10;
    col[i * 3 + 1] = h / 10;
    col[i * 3 + 2] = (seed % 1 + 1) % 1;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * A wall material with a shader-generated window grid (hotel towers, garages, office blocks).
 * @param {object} o
 *   wall: base material (textured, world UV) · cell: [sx, sy] window pitch (m)
 *   win: [wx, wy] window size (m) · y0, y1: world y range with windows
 *   style: 'room'|'office'|'dark' · glass: tint hex · frame: frame/mullion colour hex
 *   mullions: vertical mullions per window · bands: horizontal spandrel colour (hex|null)
 */
export function towerFacadeMat(o) {
  const wall = o.wall;
  const m = wall.clone();
  m.userData = { ...wall.userData };
  m.name = `${wall.name}-facade`;
  const styleId = { room: 0, shop: 1, office: 2, dark: 3, casino: 4 }[o.style || 'room'] ?? 0;
  const U = {
    uCell: { value: new THREE.Vector2(...o.cell) },
    uWin: { value: new THREE.Vector2(...o.win) },
    uYR: { value: new THREE.Vector2(o.y0 ?? 6, o.y1 ?? 999) },
    uGlass: { value: new THREE.Color(o.glass ?? 0x6d7f8c) },
    uFrame: { value: new THREE.Color(o.frame ?? 0x3a3a3a) },
    uBand: { value: new THREE.Color(o.bands ?? 0x000000) },
    uBandOn: { value: o.bands != null ? 1 : 0 },
    uMull: { value: o.mullions ?? 1 },
    uSeed: { value: o.seed ?? 1 },
    uLitMul: { value: o.litMul ?? 1 },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, { uNight: FACADE.uNight, uTime: FACADE.uTime, uLit: FACADE.uLit });
    addCommonVertex(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vPane;
        uniform float uNight; uniform float uTime; uniform float uLit;
        uniform vec2 uCell; uniform vec2 uWin; uniform vec2 uYR; uniform vec3 uGlass; uniform vec3 uFrame;
        uniform vec3 uBand; uniform float uBandOn; uniform float uMull; uniform float uSeed; uniform float uLitMul;
        ${INTERIOR_GLSL}
        float fWin; vec2 fCellId; vec2 fLocal; vec3 fT; vec3 fN;`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          fN = normalize(vWNrm);
          fWin = 0.0;
          if (abs(fN.y) < 0.5) {
            fT = normalize(cross(vec3(0.0, 1.0, 0.0), fN));
            vec2 q = vec2(dot(vWPos, fT), vWPos.y - uYR.x);
            fCellId = floor(q / uCell);
            fLocal = q - fCellId * uCell;
            vec2 off = (uCell - uWin) * vec2(0.5, 0.45);
            vec2 inW = fLocal - off;
            vec2 aa = fwidth(q) * 1.2 + 1e-4;
            float wx = smoothstep(-aa.x, aa.x, inW.x) * smoothstep(-aa.x, aa.x, uWin.x - inW.x);
            float wy = smoothstep(-aa.y, aa.y, inW.y) * smoothstep(-aa.y, aa.y, uWin.y - inW.y);
            float inRange = step(uYR.x, vWPos.y) * step(vWPos.y, uYR.y - uCell.y * 0.1);
            fWin = wx * wy * inRange;
            // Horizontal spandrel band between floors.
            if (uBandOn > 0.5) {
              float band = step(fLocal.y, off.y * 0.7) * inRange;
              diffuseColor.rgb = mix(diffuseColor.rgb, uBand, band * 0.85);
            }
            // Frame + mullions.
            float fw = 0.06;
            float frame = (1.0 - smoothstep(fw - aa.x, fw + aa.x, min(inW.x, uWin.x - inW.x))) + (1.0 - smoothstep(fw - aa.y, fw + aa.y, min(inW.y, uWin.y - inW.y)));
            float mx = fract(inW.x / uWin.x * (uMull + 1.0));
            float mull = uMull > 0.5 ? 1.0 - smoothstep(0.02, 0.02 + aa.x / uWin.x * 3.0, min(mx, 1.0 - mx)) : 0.0;
            fLocal = inW;
            diffuseColor.rgb = mix(diffuseColor.rgb, uGlass * 0.07, fWin);
            diffuseColor.rgb = mix(diffuseColor.rgb, uFrame, clamp(frame + mull, 0.0, 1.0) * fWin);
            fWin *= 1.0 - clamp(frame + mull, 0.0, 1.0);
          }
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.05, fWin);`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.0, fWin);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (fWin > 0.001) {
          vec3 V = normalize(vWPos - cameraPosition);
          vec3 B = vec3(0.0, 1.0, 0.0);
          vec3 rd = vec3(dot(V, fT), dot(V, B), dot(V, fN));
          float seed = floor(fract(sin(dot(fCellId + uSeed * 13.0, vec2(12.9898, 78.233))) * 43758.5453) * 997.0) + 1.0;
          vec4 room = interiorRoom(fLocal, uWin, rd, seed, ${styleId.toFixed(1)}, uNight, uLit * uLitMul, uTime);
          totalEmissiveRadiance += room.rgb * fWin;
        }`
      );
    if (/#include <color_fragment>/.test(shader.fragmentShader) && wall.vertexColors) {
      // keep vertex tint for the wall
    }
  };
  m.customProgramCacheKey = () => `facade-${styleId}-${wall.vertexColors ? 1 : 0}-${m.map ? 1 : 0}`;
  return m;
}

/** Update shared facade uniforms (call once per frame from the world). */
export function updateFacades(night, timeSec, hourFloat) {
  FACADE.uNight.value = night;
  FACADE.uTime.value = timeSec;
  // Fraction of lit rooms over the night: evening peak, few at 3–5 AM.
  const h = hourFloat;
  let lit;
  if (h >= 17 || h < 1) lit = 0.55 - Math.max(0, (h >= 17 ? h - 21 : h + 3)) * 0.05;
  else if (h < 5) lit = 0.22 - (h - 1) * 0.03;
  else if (h < 9) lit = 0.2 + (h - 5) * 0.06;
  else lit = 0.35;
  FACADE.uLit.value = Math.max(0.1, Math.min(0.6, lit));
}
