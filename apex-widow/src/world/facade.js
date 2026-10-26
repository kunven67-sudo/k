// Building facades with fake rooms behind the windows ("interior mapping"): every window looks into a real-looking
// lit or dark office/apartment (ceiling light, back wall, floor, desks) that moves with parallax, while the glass on
// top reflects the sky. One material draws thousands of buildings (instanced boxes), each with its own style + seed.
//   aBld = (style, seed, floorH, baseY)   style 0 = glass tower, 1 = brick, 2 = concrete bands, 3 = dark glass (VOSS)
import * as THREE from 'three';

export const FACADE = { night: { value: 1 }, time: { value: 0 }, lockdown: { value: 0 } };

export function makeFacadeMaterial({ instanced = true } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.0, envMapIntensity: 1.0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = FACADE.night; sh.uniforms.uTime = FACADE.time; sh.uniforms.uLock = FACADE.lockdown;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aBld; flat varying vec4 vBld; varying vec3 vFW; varying vec3 vFN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 fW = vec4(transformed, 1.0);
        vec3 fN = objectNormal;
        #ifdef USE_INSTANCING
          fW = instanceMatrix * fW; fN = mat3(instanceMatrix) * fN;
        #endif
        fW = modelMatrix * fW; vFW = fW.xyz; vFN = normalize(mat3(modelMatrix) * fN); vBld = aBld;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight; uniform float uTime; uniform float uLock;
        flat varying vec4 vBld; varying vec3 vFW; varying vec3 vFN;
        float fh1(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        // one fake room behind a window. ro = point on the glass in room space, rd = view dir in room space
        vec3 room(vec3 ro, vec3 rd, vec3 size, float h, float lit, out float isLight) {
          vec3 inv = 1.0 / max(abs(rd), vec3(1e-4)) * sign(rd + 1e-6);
          vec3 tx = vec3(((rd.x > 0.0 ? size.x : 0.0) - ro.x) * inv.x, ((rd.y > 0.0 ? size.y : 0.0) - ro.y) * inv.y, (size.z - ro.z) * inv.z);
          float t = min(min(tx.x, tx.y), tx.z);
          vec3 p = ro + rd * t;
          vec3 c; isLight = 0.0;
          vec3 wallC = mix(vec3(0.78, 0.76, 0.72), vec3(0.62, 0.68, 0.74), fh1(vec2(h, 3.1)));
          if (t == tx.z) {                       // back wall: a picture / whiteboard / dark doorway
            c = wallC * (0.8 + 0.2 * fh1(floor(p.xy * 2.0) + h));
            if (abs(p.x - size.x * 0.5) < size.x * 0.18 && p.y > 0.9 && p.y < 1.9) c = mix(c, vec3(0.2, 0.35, 0.45), 0.6 * step(0.5, fh1(vec2(h, 7.7))));
            if (abs(p.x - size.x * 0.75) < 0.45 && p.y < 2.1) c *= 0.35;
          } else if (t == tx.y) {
            if (rd.y > 0.0) {                    // ceiling + light panel
              c = vec3(0.85);
              vec2 q = fract(vec2(p.x / 1.2, p.z / 1.8));
              if (q.x > 0.15 && q.x < 0.85 && q.y > 0.3 && q.y < 0.7) { c = vec3(1.0, 0.97, 0.9); isLight = 1.0; }
            } else {                             // floor: carpet / wood, desks as dark blocks
              c = mix(vec3(0.25, 0.27, 0.3), vec3(0.42, 0.3, 0.2), step(0.6, fh1(vec2(h, 1.3))));
              vec2 dq = fract(p.xz / vec2(1.8, 2.4));
              if (dq.x > 0.15 && dq.x < 0.85 && dq.y > 0.2 && dq.y < 0.55) c *= 0.45;
            }
          } else c = wallC * 0.9;                // side walls
          // desk / chair silhouettes near the glass
          float d0 = fh1(vec2(h, 5.5));
          if (d0 > 0.4 && p.y < 0.76 && p.z < size.z * 0.6) c *= 0.55;
          float fog = clamp(t / (size.z * 1.6), 0.0, 1.0);
          return c * (1.0 - fog * 0.35);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float fStyle = floor(vBld.x + 0.5), fSeed = floor(vBld.y * 16.0 + 0.5) / 16.0, fFH = max(vBld.z, 2.8), fBase = vBld.w;
        vec3 fNn = normalize(vFN);
        float fWin = 0.0; vec3 fRoom = vec3(0.0); float fLit = 0.0; float fMetal = 0.0; float fRough = 0.8; float fIsL = 0.0;
        if (abs(fNn.y) < 0.5) {
          vec3 fT = abs(fNn.x) > abs(fNn.z) ? vec3(0.0, 0.0, sign(fNn.x)) : vec3(-sign(fNn.z), 0.0, 0.0);
          float fu = dot(vFW, fT), fv = vFW.y - fBase;
          float bay = fStyle == 1.0 ? 2.6 : fStyle == 2.0 ? 3.0 : 1.5;
          vec2 g = vec2(fu / bay, fv / fFH);
          vec2 cell = floor(g);
          vec2 f = fract(g);
          // how many window cells fit in one pixel: far away = draw the average look instead of aliasing noise
          vec2 fwg = max(fwidth(g), vec2(1e-5));
          float fFar = smoothstep(0.22, 0.75, max(fwg.x, fwg.y));
          // window opening inside the cell (glass towers = nearly all glass), edges filtered to ~1 pixel
          vec2 w0 = fStyle == 3.0 ? vec2(0.02, 0.01) : fStyle == 0.0 ? vec2(0.03, 0.22) : fStyle == 1.0 ? vec2(0.22, 0.28) : vec2(0.08, 0.3);
          vec2 w1 = fStyle == 3.0 ? vec2(0.98, 0.714) : fStyle == 0.0 ? vec2(0.97, 0.92) : fStyle == 1.0 ? vec2(0.78, 0.82) : vec2(0.92, 0.78);
          vec2 ew = min(fwg, vec2(0.2));
          float wx = smoothstep(w0.x - ew.x, w0.x + ew.x, f.x) * (1.0 - smoothstep(w1.x - ew.x, w1.x + ew.x, f.x));
          float wy = smoothstep(w0.y - ew.y, w0.y + ew.y, f.y) * (1.0 - smoothstep(w1.y - ew.y, w1.y + ew.y, f.y));
          fWin = mix(wx * wy, (w1.x - w0.x) * (w1.y - w0.y), fFar) * step(0.0, fv);
          // offices at night: whole floors tend to be busy or empty (cleaners, late teams), then single rooms
          float rowH = fh1(vec2(cell.y * 1.37 + fSeed * 3.1, fSeed));
          float floorFrac = smoothstep(0.3, 0.95, rowH) * (0.45 + 0.55 * uNight);
          float ch = fh1(cell + fSeed * 17.0);
          float litNear = step(1.0 - floorFrac, ch) * (0.6 + 0.4 * fh1(cell.yx + fSeed));
          if (cell.y < 0.5 && fStyle != 3.0) { litNear = step(0.25, ch) * 1.2; floorFrac = 0.8; }
          float lit = mix(litNear, floorFrac * 0.75, fFar);
          if (uLock > 0.5 && fStyle == 3.0) lit = step(0.5, ch) * (0.5 + 0.5 * step(0.5, fract(uTime * 1.3 + ch)));
          vec3 V = normalize(vFW - cameraPosition);
          vec3 rd = vec3(dot(V, fT), V.y, dot(V, -fNn));
          vec3 rsize = vec3(bay * 2.0, fFH * 0.92, 7.0);
          float roomX = fract(cell.x * 0.5) * bay * 2.0;
          vec3 ro = vec3(roomX + f.x * bay, f.y * fFH * 0.92, 0.0);
          fRoom = fFar > 0.99 ? vec3(0.8, 0.74, 0.62) : mix(room(ro, rd, rsize, ch * 91.7 + fSeed, lit, fIsL), vec3(0.8, 0.74, 0.62), fFar);
          fIsL *= 1.0 - fFar;
          // blinds
          float bl = fh1(cell * 1.7 + fSeed);
          if (fFar < 0.5 && bl > 0.7 && f.y > mix(w1.y, w0.y, (bl - 0.7) * 2.5)) { fRoom = mix(vec3(0.7, 0.68, 0.62), vec3(0.2), step(0.5, fract(f.y * fFH * 14.0)) * 0.25); fIsL = 0.0; }
          fLit = lit;
          // frame/wall colours
          vec3 wallCol = fStyle == 1.0 ? mix(vec3(0.42, 0.2, 0.14), vec3(0.3, 0.16, 0.12), fh1(floor(vec2(fu * 4.0, fv * 13.0)))) :
                         fStyle == 2.0 ? vec3(0.55, 0.54, 0.5) : fStyle == 3.0 ? vec3(0.05, 0.055, 0.06) : vec3(0.18, 0.2, 0.22);
          // brick mortar lines
          if (fStyle == 1.0 && fFar < 0.5) { vec2 b = vec2(fu * 4.0 + 0.5 * step(0.5, fract(fv * 6.5)), fv * 13.0); vec2 bf = fract(b); if (bf.x < 0.06 || bf.y < 0.1) wallCol = vec3(0.55, 0.52, 0.48); }
          // spandrel band on glass towers (dark glass between floors)
          if ((fStyle == 0.0 || fStyle == 3.0) && fWin < 0.5) { wallCol = fStyle == 3.0 ? vec3(0.03) : vec3(0.08, 0.1, 0.12); fMetal = 0.6; fRough = 0.25; }
          // mullions
          if (fFar < 0.5 && fWin < 0.5 && (fStyle == 0.0 || fStyle == 3.0) && (f.x < w0.x || f.x > w1.x)) { wallCol = vec3(0.35, 0.37, 0.4); fMetal = 0.9; fRough = 0.35; }
          diffuseColor.rgb = mix(wallCol, fRoom * (0.15 + 0.85 * lit) * 0.35, fWin);
          fRough = mix(fRough, 0.05, fWin); fMetal = mix(fMetal, 0.0, fWin);
        } else {
          // roof: gravel/membrane with grime
          diffuseColor.rgb = vec3(0.32, 0.32, 0.33) * (0.8 + 0.2 * fh1(floor(vFW.xz * 1.5)));
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = fRough;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = fMetal;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // every room has its own colour of light: warm lamps, cold office tubes, a TV glow
        float fTemp = fh1(vec2(fSeed * 7.0, floor((vFW.y - fBase) / max(vBld.z, 2.8)) + floor(dot(vFW, abs(fNn.x) > abs(fNn.z) ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)) / 6.0) * 3.0));
        vec3 fTint = fTemp < 0.45 ? vec3(1.0, 0.78, 0.52) : fTemp < 0.9 ? vec3(0.86, 0.92, 1.0) : vec3(0.55, 0.7, 1.0);
        totalEmissiveRadiance += fWin * fRoom * fTint * fLit * (0.08 + 0.5 * uNight) * (1.0 + fIsL * 1.2);`);
  };
  m.customProgramCacheKey = () => 'facade' + (instanced ? 'I' : '');
  return m;
}

// attribute helper for one non-instanced mesh
export function setBld(geo, style, seed, floorH, baseY) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = style; a[i * 4 + 1] = seed; a[i * 4 + 2] = floorH; a[i * 4 + 3] = baseY; }
  geo.setAttribute('aBld', new THREE.BufferAttribute(a, 4));
  return geo;
}
