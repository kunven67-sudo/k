// Sky: physically-based atmosphere, real sun / moon / stars, Reno's mountains, clouds, haze, and
// the lights that follow from them.
//
//   const sky = createSky(scene, renderer, { tier });
//   sky.update(clock, weather, focus?)   // every frame; weather = { cloudCover, rain, fog }
//   sky.sunLight / sky.hemi              // the shadow-casting key light + sky/ground fill
//   sky.setCity(lat, lon)                // other cities (Vegas, Tahoe, Macau...) reuse the sky
//   sky.setLightPollution(0..1)          // 0 = desert (Milky Way), 1 = casino floor glare
//   sky.state                            // { night, dusk, sunDir, moonDir, ... } for world lights
//
// How it works
// - Single-scattering atmosphere (Rayleigh + Mie + ozone, Nishita-style ray march) is rendered
//   into a small equirect LUT on the GPU whenever the sun/moon move a little. The dome samples it,
//   so the per-pixel cost of the sky is a couple of texture reads. The same model runs on the CPU
//   (few samples) to colour the sun light, hemisphere light and fog consistently with the dome.
// - Mountains are not geometry: a 1-D horizon profile texture (two layers: the far Sierra Nevada /
//   Virginia Range and the near foothills / Peavine) is shaded inside the dome shader with fake
//   slope normals, snow above a seasonal snow line, and aerial perspective taken from the LUT.
//   They are therefore part of the environment map too, and cost nothing in geometry.
// - Stars are real: ~45 named bright stars (Orion, Big Dipper, Cassiopeia...) with real RA/Dec
//   plus a seeded field concentrated along the galactic plane, rotated by local sidereal time.
//   Light pollution sets the limiting magnitude, so downtown shows a few hundred, the desert
//   thousands plus the Milky Way.
// - The moon is a lit sphere impostor: lighting it with the real sun direction gives the
//   correct phase AND the correct orientation of the terminator for free.
// - scene.environment is a PMREM of the sky regenerated occasionally (sun moved / weather).

import * as THREE from 'three';
import { sunPosition, moonPosition, RENO } from '../core/clock.js';
import { TileNoise } from './noise.js';
import { Rng } from '../core/rng.js';
import { clamp, lerp, smoothstep } from '../core/util.js';

const GOLD_HOUR = new THREE.Color(1.0, 0.66, 0.36);
const DEG = Math.PI / 180;
const DOME_R = 900;

// ---- Atmosphere model (shared by GLSL and JS) ---------------------------------------------------

const ATMO = {
  Re: 6360e3,
  Ra: 6420e3,
  ground: 6360e3 + 1370, // Truckee Meadows valley floor
  eye: 6360e3 + 1372,
  bR: [5.802e-6, 13.558e-6, 33.1e-6],
  HR: 8000,
  bM: 2.1e-5,
  HM: 1200,
  g: 0.78,
  bO: [0.65e-6, 1.881e-6, 0.085e-6],
  sunI: 22,
};

// Ray / sphere (centered at origin) intersection; returns [t0, t1] or null.
function raySphere(oy, dx, dy, dz, r) {
  // origin = (0, oy, 0)
  const b = oy * dy;
  const c = oy * oy - r * r;
  const d = b * b - c;
  if (d < 0) return null;
  const s = Math.sqrt(d);
  return [-b - s, -b + s];
}

function ozone(h) {
  return Math.max(0, 1 - Math.abs(h - 25000) / 15000);
}

// Optical depth from height `oy` along (dx,dy,dz) to the top of the atmosphere (null = hits ground).
function opticalDepth(oy, dx, dy, dz, steps = 8) {
  const g = raySphere(oy, dx, dy, dz, ATMO.ground - 200);
  if (g && g[0] > 0) return null;
  const a = raySphere(oy, dx, dy, dz, ATMO.Ra);
  const len = a[1];
  const ds = len / steps;
  let r = 0;
  let m = 0;
  let o = 0;
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * ds;
    const px = dx * t;
    const py = oy + dy * t;
    const pz = dz * t;
    const h = Math.hypot(px, py, pz) - ATMO.Re;
    r += Math.exp(-h / ATMO.HR) * ds;
    m += Math.exp(-h / ATMO.HM) * ds;
    o += ozone(h) * ds;
  }
  return [r, m, o];
}

// Transmittance from the eye toward a direction (sun colour at the ground).
function transmittance(dir, haze) {
  const od = opticalDepth(ATMO.eye, dir.x, Math.max(dir.y, -0.2), dir.z, 16);
  if (!od) return [0, 0, 0];
  const bm = ATMO.bM * haze;
  return [0, 1, 2].map((i) => Math.exp(-(ATMO.bR[i] * od[0] + bm * 1.11 * od[1] + ATMO.bO[i] * od[2])));
}

// Single-scattered radiance along `dir` from a light in direction `L` with intensity I.
function scatterJS(dir, L, I, haze, steps = 12) {
  const oy = ATMO.eye;
  const a = raySphere(oy, dir.x, dir.y, dir.z, ATMO.Ra);
  let tMax = a[1];
  const gnd = raySphere(oy, dir.x, dir.y, dir.z, ATMO.ground);
  if (gnd && gnd[0] > 0) tMax = Math.min(tMax, gnd[0]);
  tMax = Math.min(tMax, 400e3);
  const ds = tMax / steps;
  const bm = ATMO.bM * haze;
  let odR = 0;
  let odM = 0;
  let odO = 0;
  const sumR = [0, 0, 0];
  const sumM = [0, 0, 0];
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * ds;
    const px = dir.x * t;
    const py = oy + dir.y * t;
    const pz = dir.z * t;
    const r = Math.hypot(px, py, pz);
    const h = r - ATMO.Re;
    const dR = Math.exp(-h / ATMO.HR) * ds;
    const dM = Math.exp(-h / ATMO.HM) * ds;
    odR += dR;
    odM += dM;
    odO += ozone(h) * ds;
    // Light ray from the sample point (rotate frame so the sample is "up").
    const ux = px / r;
    const uy = py / r;
    const uz = pz / r;
    const mu = L.x * ux + L.y * uy + L.z * uz;
    // Equivalent ray: from height r along a direction with the same angle to local up.
    const sinT = Math.sqrt(Math.max(0, 1 - mu * mu));
    const lod = opticalDepth(r, sinT, mu, 0, 6);
    if (!lod) continue;
    for (let c = 0; c < 3; c++) {
      const tau = ATMO.bR[c] * (odR + lod[0]) + bm * 1.11 * (odM + lod[1]) + ATMO.bO[c] * (odO + lod[2]);
      const att = Math.exp(-tau);
      sumR[c] += dR * att;
      sumM[c] += dM * att;
    }
  }
  const mu = dir.x * L.x + dir.y * L.y + dir.z * L.z;
  const pR = (3 / (16 * Math.PI)) * (1 + mu * mu);
  const g = ATMO.g;
  const pM = (3 / (8 * Math.PI)) * ((1 - g * g) * (1 + mu * mu)) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5));
  return [0, 1, 2].map((c) => I * (sumR[c] * ATMO.bR[c] * pR + sumM[c] * bm * pM));
}

const ATMO_GLSL = /* glsl */ `
  const float Re = ${ATMO.Re.toFixed(1)};
  const float Ra = ${ATMO.Ra.toFixed(1)};
  const float Rg = ${ATMO.ground.toFixed(1)};
  const float Reye = ${ATMO.eye.toFixed(1)};
  const vec3 bR = vec3(${ATMO.bR.map((x) => x.toExponential(4)).join(',')});
  const vec3 bO = vec3(${ATMO.bO.map((x) => x.toExponential(4)).join(',')});
  const float HR = ${ATMO.HR.toFixed(1)};
  const float HM = ${ATMO.HM.toFixed(1)};
  const float gM = ${ATMO.g};
  vec2 raySphere(float oy, vec3 d, float r) {
    float b = oy * d.y;
    float c = oy * oy - r * r;
    float disc = b * b - c;
    if (disc < 0.0) return vec2(-1.0, -1.0);
    float s = sqrt(disc);
    return vec2(-b - s, -b + s);
  }
  float ozone(float h) { return max(0.0, 1.0 - abs(h - 25000.0) / 15000.0); }
  // Returns optical depth (rayleigh, mie, ozone) to the top, or -1 if blocked by the planet.
  vec3 lightDepth(float r, float mu) {
    float sinT = sqrt(max(0.0, 1.0 - mu * mu));
    vec3 d = vec3(sinT, mu, 0.0);
    vec2 gnd = raySphere(r, d, Rg - 200.0);
    if (gnd.x > 0.0) return vec3(-1.0);
    float len = raySphere(r, d, Ra).y;
    float ds = len / 6.0;
    vec3 od = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      float t = (float(i) + 0.5) * ds;
      vec3 p = vec3(d.x * t, r + d.y * t, 0.0);
      float h = length(p) - Re;
      od += vec3(exp(-h / HR), exp(-h / HM), ozone(h)) * ds;
    }
    return od;
  }
`;

// LUT: equirect, u = azimuth (from north, clockwise), v = sign(x)*x^2 elevation mapping.
const LUT_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uSun;
  uniform vec3 uMoon;
  uniform float uSunI;
  uniform float uMoonI;
  uniform float uHaze;
  ${ATMO_GLSL}
  void main() {
    float az = vUv.x * 6.28318530718;
    float x = vUv.y * 2.0 - 1.0;
    float el = sign(x) * x * x * 1.5707963;
    vec3 d = vec3(cos(el) * sin(az), sin(el), -cos(el) * cos(az));
    float bM = ${ATMO.bM.toExponential(4)} * uHaze;
    vec2 a = raySphere(Reye, d, Ra);
    float tMax = a.y;
    vec2 gnd = raySphere(Reye, d, Rg);
    bool hitGround = gnd.x > 0.0;
    if (hitGround) tMax = min(tMax, gnd.x);
    tMax = min(tMax, 400000.0);
    const int N = 16;
    float ds = tMax / float(N);
    vec3 od = vec3(0.0);
    vec3 sRs = vec3(0.0), sMs = vec3(0.0), sRm = vec3(0.0), sMm = vec3(0.0);
    for (int i = 0; i < N; i++) {
      float t = (float(i) + 0.5) * ds;
      vec3 p = vec3(d.x * t, Reye + d.y * t, d.z * t);
      float r = length(p);
      float h = r - Re;
      float dR = exp(-h / HR) * ds;
      float dM = exp(-h / HM) * ds;
      od += vec3(dR, dM, ozone(h) * ds);
      vec3 up = p / r;
      vec3 ls = lightDepth(r, dot(up, uSun));
      if (ls.x >= 0.0) {
        vec3 tau = bR * (od.x + ls.x) + bM * 1.11 * (od.y + ls.y) + bO * (od.z + ls.z);
        vec3 att = exp(-tau);
        sRs += dR * att; sMs += dM * att;
      }
      if (uMoonI > 0.0) {
        vec3 lm = lightDepth(r, dot(up, uMoon));
        if (lm.x >= 0.0) {
          vec3 tau = bR * (od.x + lm.x) + bM * 1.11 * (od.y + lm.y) + bO * (od.z + lm.z);
          vec3 att = exp(-tau);
          sRm += dR * att; sMm += dM * att;
        }
      }
    }
    float muS = dot(d, uSun);
    float muM = dot(d, uMoon);
    float g2 = gM * gM;
    float pRs = 0.0596831 * (1.0 + muS * muS);
    float pMs = 0.1193662 * ((1.0 - g2) * (1.0 + muS * muS)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * gM * muS, 1.5));
    float pRm = 0.0596831 * (1.0 + muM * muM);
    float pMm = 0.1193662 * ((1.0 - g2) * (1.0 + muM * muM)) / ((2.0 + g2) * pow(1.0 + g2 - 2.0 * gM * muM, 1.5));
    vec3 col = uSunI * (sRs * bR * pRs + sMs * bM * pMs) + uMoonI * (sRm * bR * pRm + sMm * bM * pMm);
    if (hitGround) {
      // Sunlit valley floor seen through the haze (only matters for reflections / env map).
      vec3 tauV = bR * od.x + bM * 1.11 * od.y + bO * od.z;
      vec3 p = vec3(d.x * tMax, Reye + d.y * tMax, d.z * tMax);
      vec3 up = normalize(p);
      float ndl = max(dot(up, uSun), 0.0);
      vec3 ls = lightDepth(length(p), dot(up, uSun));
      vec3 sunT = ls.x >= 0.0 ? exp(-(bR * ls.x + bM * 1.11 * ls.y + bO * ls.z)) : vec3(0.0);
      col += exp(-tauV) * vec3(0.30, 0.26, 0.20) * sunT * ndl * uSunI * 0.318;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---- Dome shader ----------------------------------------------------------------------------

const DOME_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pin to the far plane
  }
`;

const DOME_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform sampler2D tLut;
  uniform sampler2D tMount;
  uniform sampler2D tCloud;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uSunRad;       // sun disc radiance (already attenuated)
  uniform vec3 uSunLight;     // sunlight colour*intensity reaching the ground (for mountains/clouds)
  uniform vec3 uMoonLight;
  uniform vec3 uAmbient;      // sky ambient for mountains/clouds
  uniform float uSkyScale;
  uniform float uDay;         // 0 night .. 1 day
  uniform vec3 uNightBase;
  uniform vec3 uGlowColor;    // city light pollution colour
  uniform float uGlow;        // light pollution strength
  uniform float uCloud;
  uniform float uRain;
  uniform float uFog;
  uniform float uTime;
  uniform vec2 uWind;
  uniform float uSnowLine;    // degrees; far peaks above this are white
  uniform float uMilky;
  uniform mat3 uEqToWorld;
  uniform float uMoonGlow;

  #define PI 3.14159265359
  #define DEG 0.01745329252

  vec3 lut(vec3 d) {
    float az = atan(d.x, -d.z);
    if (az < 0.0) az += 2.0 * PI;
    float el = asin(clamp(d.y, -1.0, 1.0));
    float x = sign(el) * sqrt(abs(el) / 1.5707963);
    return texture2D(tLut, vec2(az / (2.0 * PI), x * 0.5 + 0.5)).rgb;
  }
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }

  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.x, -d.z);
    if (az < 0.0) az += 2.0 * PI;
    float u = az / (2.0 * PI);
    float el = asin(clamp(d.y, -1.0, 1.0));
    float pix = max(fwidth(el), 0.0004);

    vec3 sky = lut(d) * uSkyScale;
    // Night floor: airglow + scattered city light, strongest at the horizon.
    float horizon = exp(-max(el, 0.0) / 0.09);
    float horizonWide = exp(-max(el, 0.0) / 0.35);
    sky += uNightBase * (0.55 + 0.45 * horizonWide);
    sky += uGlowColor * uGlow * (horizon * 0.85 + horizonWide * 0.25);

    // Milky Way (only visible far from the casinos).
    if (uMilky > 0.001) {
      vec3 eq = transpose(uEqToWorld) * d;
      // Galactic north pole in equatorial coords (J2000).
      float b = dot(eq, vec3(-0.8676661, -0.1980764, 0.4559838));
      float band = exp(-b * b / 0.018);
      float n = vnoise(eq.xy * 9.0 + eq.z * 5.0) * 0.6 + vnoise(eq.yz * 23.0) * 0.4;
      sky += vec3(0.55, 0.6, 0.75) * band * (0.35 + n * 0.65) * uMilky * 0.03 * smoothstep(0.0, 0.25, el);
    }

    // Moon halo in haze.
    float mu = max(dot(d, uMoonDir), 0.0);
    sky += uMoonGlow * (pow(mu, 600.0) * 0.6 + pow(mu, 60.0) * 0.08) * vec3(0.75, 0.8, 0.95);

    // ---- Clouds (flat layer ~3 km up) ----
    vec3 col = sky;
    if (d.y > 0.0 && uCloud > 0.01) {
      vec2 cp = d.xz / (d.y + 0.08) * 0.45 + uWind * uTime;
      float c1 = texture2D(tCloud, cp * 0.35).r;
      float c2 = texture2D(tCloud, cp * 1.3 + 0.37).g;
      float shape = c1 * 0.72 + c2 * 0.28;
      float cover = mix(0.78, 0.18, uCloud);
      float dens = smoothstep(cover, cover + 0.22 + uRain * 0.3, shape);
      dens *= smoothstep(0.0, 0.12, d.y);
      // Self-shadowing toward the sun: sample offset in the sun direction.
      vec2 toSun = normalize(uSunDir.xz + 1e-4) * 0.06;
      float s2 = texture2D(tCloud, (cp + toSun) * 0.35).r * 0.72 + texture2D(tCloud, (cp + toSun) * 1.3 + 0.37).g * 0.28;
      float shadow = smoothstep(cover, cover + 0.35, s2);
      float fwd = pow(max(dot(d, uSunDir), 0.0), 8.0);
      vec3 lit = uSunLight * (0.95 - shadow * 0.55 + fwd * 0.8) + uMoonLight * 0.5;
      vec3 cloudCol = lit * 0.33 + uAmbient * 0.95;
      // City glow lights the underside of clouds at night (classic sodium-orange overcast).
      cloudCol += uGlowColor * uGlow * 1.1 * (0.5 + dens * 0.5);
      cloudCol = mix(cloudCol, cloudCol * vec3(0.55, 0.57, 0.6), uRain * 0.8);
      // Fade distant clouds into the horizon haze.
      float far = smoothstep(0.25, 0.0, d.y);
      cloudCol = mix(cloudCol, sky, far * 0.6);
      col = mix(col, cloudCol, dens * (0.9 + uRain * 0.1));
    }

    // ---- Sun disc (limb-darkened) ----
    float cs = dot(d, uSunDir);
    float sunR = 0.0058; // ~0.67 deg angular diameter (slightly enlarged for screen)
    float sd = acos(clamp(cs, -1.0, 1.0));
    if (sd < sunR * 1.6) {
      float r = sd / sunR;
      float limb = sqrt(max(0.0, 1.0 - r * r));
      float disc = smoothstep(1.0 + pix / sunR * 1.5, 1.0 - pix / sunR * 1.5, r);
      col += uSunRad * disc * (0.45 + 0.55 * limb) * (1.0 - uCloud * 0.9) * (1.0 - uRain);
    }

    // ---- Mountains (two silhouette layers) ----
    vec4 m = texture2D(tMount, vec2(u, 0.5));
    float du = 1.0 / 1024.0;
    vec4 mL = texture2D(tMount, vec2(u - du, 0.5));
    vec4 mR = texture2D(tMount, vec2(u + du, 0.5));
    float hFar = m.r * 12.0 * DEG;
    float hNear = m.g * 12.0 * DEG;
    vec3 horiz = vec3(sin(az), 0.0, -cos(az));
    vec3 tang = vec3(cos(az), 0.0, sin(az));
    vec3 hazeCol = lut(normalize(vec3(d.x, 0.035, d.z))) * uSkyScale + uNightBase + uGlowColor * uGlow * 0.9;
    float fogMix = clamp(uFog * 0.8 + uRain * 0.75, 0.0, 1.0);

    if (el < hFar + pix) {
      float slope = (mR.r - mL.r) * 12.0 * DEG / (2.0 * du * 2.0 * PI);
      float f = clamp(el / max(hFar, 1e-4), 0.0, 1.0);
      float gully = vnoise(vec2(az * 90.0, el * 260.0)) * 2.0 - 1.0;
      float gully2 = vnoise(vec2(az * 310.0, el * 900.0)) * 2.0 - 1.0;
      vec3 n = normalize(horiz * -0.55 + vec3(0.0, 0.55 + f * 0.2, 0.0) + tang * (-slope * 2.2 + gully * 0.7 + gully2 * 0.25));
      float ndl = max(dot(n, uSunDir), 0.0);
      float ndm = max(dot(n, uMoonDir), 0.0);
      // Forest/granite mix, snow above the snow line on the high peaks.
      float rock = smoothstep(0.35, 0.75, vnoise(vec2(az * 140.0, el * 420.0)) + f * 0.25);
      vec3 alb = mix(vec3(0.065, 0.075, 0.07), vec3(0.30, 0.28, 0.25), rock);
      float snowLine = uSnowLine * DEG;
      float snow = smoothstep(snowLine - 0.2 * DEG, snowLine + 0.4 * DEG, el + gully2 * 0.25 * DEG + gully * 0.35 * DEG) * step(snowLine, hFar);
      alb = mix(alb, vec3(0.85, 0.87, 0.9), snow);
      vec3 mc = alb * (uSunLight * ndl * 0.32 + uMoonLight * ndm * 0.32 + uAmbient * 0.85);
      mc = mix(mc, hazeCol, clamp(0.55 + (1.0 - f) * 0.15 + fogMix * 0.45, 0.0, 0.97));
      float a = smoothstep(hFar + pix, hFar - pix, el);
      col = mix(col, mc, a);
    }
    if (el < hNear + pix) {
      float slope = (mR.g - mL.g) * 12.0 * DEG / (2.0 * du * 2.0 * PI);
      float f = clamp(el / max(hNear, 1e-4), 0.0, 1.0);
      float gully = vnoise(vec2(az * 160.0, el * 520.0)) * 2.0 - 1.0;
      vec3 n = normalize(horiz * -0.6 + vec3(0.0, 0.5 + f * 0.25, 0.0) + tang * (-slope * 2.5 + gully * 0.8));
      float ndl = max(dot(n, uSunDir), 0.0);
      float ndm = max(dot(n, uMoonDir), 0.0);
      float sage = vnoise(vec2(az * 220.0, el * 700.0));
      vec3 alb = mix(vec3(0.26, 0.22, 0.16), vec3(0.36, 0.33, 0.25), sage);
      vec3 mc = alb * (uSunLight * ndl * 0.32 + uMoonLight * ndm * 0.3 + uAmbient * 0.8);
      // Scattered house lights on the near hills at night.
      // Neighbourhoods cluster on the lower slopes in a few directions (NW, SW, SE).
      vec2 cell = floor(vec2(az * 3000.0, el * 3000.0));
      float hood = smoothstep(0.55, 0.8, vnoise(vec2(az * 9.0, 0.5)));
      float lights = step(0.993 - hood * 0.012, hash12(cell)) * smoothstep(0.55, 0.05, f) * (1.0 - uDay);
      mc += mix(vec3(1.0, 0.72, 0.42), vec3(0.85, 0.9, 1.0), step(0.7, hash12(cell + 7.0))) * lights * 0.35;
      mc = mix(mc, hazeCol, clamp(0.3 + (1.0 - f) * 0.15 + fogMix * 0.55, 0.0, 0.95));
      float a = smoothstep(hNear + pix, hNear - pix, el);
      col = mix(col, mc, a);
    }
    if (el < 0.0) {
      // Below the hills (only seen in reflections): valley floor in haze.
      col = mix(col, hazeCol * 0.55, smoothstep(0.0, -0.02, el));
    }

    // Weather veil: rain/fog wash everything toward a flat grey of the current sky brightness.
    float lum = dot(sky, vec3(0.2126, 0.7152, 0.0722));
    vec3 veil = vec3(lum) * vec3(0.92, 0.95, 1.0) + uGlowColor * uGlow * 0.5;
    col = mix(col, veil, clamp(uRain * 0.55 + uFog * 0.5, 0.0, 0.9) * (0.4 + 0.6 * horizonWide));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ---- Stars --------------------------------------------------------------------------------

// Bright stars: [name, RA hours, Dec degrees, magnitude, B-V colour index].
const BRIGHT_STARS = [
  ['Sirius', 6.752, -16.72, -1.46, 0.0], ['Canopus', 6.399, -52.7, -0.74, 0.15],
  ['Arcturus', 14.261, 19.18, -0.05, 1.23], ['Vega', 18.616, 38.78, 0.03, 0.0],
  ['Capella', 5.278, 46.0, 0.08, 0.8], ['Rigel', 5.242, -8.2, 0.13, -0.03],
  ['Procyon', 7.655, 5.22, 0.34, 0.42], ['Betelgeuse', 5.919, 7.41, 0.5, 1.85],
  ['Altair', 19.846, 8.87, 0.77, 0.22], ['Aldebaran', 4.599, 16.51, 0.85, 1.54],
  ['Antares', 16.49, -26.43, 0.96, 1.83], ['Spica', 13.42, -11.16, 0.97, -0.23],
  ['Pollux', 7.755, 28.03, 1.14, 1.0], ['Fomalhaut', 22.961, -29.62, 1.16, 0.09],
  ['Deneb', 20.69, 45.28, 1.25, 0.09], ['Regulus', 10.139, 11.97, 1.35, -0.11],
  ['Castor', 7.577, 31.89, 1.58, 0.03], ['Bellatrix', 5.419, 6.35, 1.64, -0.22],
  ['Alnilam', 5.604, -1.2, 1.69, -0.18], ['Alnitak', 5.679, -1.94, 1.77, -0.2],
  ['Mintaka', 5.533, -0.3, 2.23, -0.22], ['Saiph', 5.796, -9.67, 2.09, -0.18],
  ['Polaris', 2.53, 89.26, 1.98, 0.6], ['Dubhe', 11.062, 61.75, 1.79, 1.07],
  ['Merak', 11.031, 56.38, 2.37, 0.03], ['Phecda', 11.897, 53.69, 2.44, 0.04],
  ['Megrez', 12.257, 57.03, 3.31, 0.08], ['Alioth', 12.9, 55.96, 1.77, -0.02],
  ['Mizar', 13.399, 54.93, 2.27, 0.02], ['Alkaid', 13.792, 49.31, 1.86, -0.19],
  ['Schedar', 0.675, 56.54, 2.24, 1.17], ['Caph', 0.153, 59.15, 2.28, 0.34],
  ['Gamma Cas', 0.945, 60.72, 2.15, -0.15], ['Ruchbah', 1.43, 60.24, 2.68, 0.13],
  ['Segin', 1.907, 63.67, 3.37, -0.15], ['Mirfak', 3.405, 49.86, 1.79, 0.48],
  ['Algol', 3.136, 40.96, 2.12, -0.05], ['Hamal', 2.12, 23.46, 2.0, 1.15],
  ['Alpheratz', 0.14, 29.09, 2.06, -0.11], ['Markab', 23.079, 15.21, 2.49, -0.03],
  ['Scheat', 23.063, 28.08, 2.42, 1.67], ['Algenib', 0.22, 15.18, 2.83, -0.23],
  ['Denebola', 11.818, 14.57, 2.14, 0.09], ['Alphard', 9.46, -8.66, 1.98, 1.44],
  ['Rasalhague', 17.582, 12.56, 2.08, 0.15], ['Kochab', 14.845, 74.16, 2.08, 1.47],
  ['Eltanin', 17.943, 51.49, 2.24, 1.52], ['Sadr', 20.37, 40.26, 2.23, 0.67],
  ['Albireo', 19.512, 27.96, 3.05, 1.13], ['Shaula', 17.56, -37.1, 1.62, -0.22],
  ['Nunki', 18.921, -26.3, 2.05, -0.13], ['Kaus Australis', 18.403, -34.38, 1.85, -0.03],
  ['Alcyone', 3.791, 24.1, 2.87, -0.09], ['Atlas', 3.819, 24.05, 3.62, -0.08],
  ['Electra', 3.747, 24.11, 3.7, -0.11], ['Maia', 3.763, 24.37, 3.87, -0.07],
  ['Merope', 3.772, 23.95, 4.18, -0.06], ['Taygeta', 3.754, 24.47, 4.3, -0.11],
  ['Menkalinan', 5.992, 44.95, 1.9, 0.08], ['Elnath', 5.438, 28.61, 1.65, -0.13],
  ['Alhena', 6.629, 16.4, 1.93, 0.0], ['Adhara', 6.977, -28.97, 1.5, -0.21],
  ['Wezen', 7.14, -26.39, 1.83, 0.68], ['Mirzam', 6.378, -17.96, 1.98, -0.24],
  ['Zubenelgenubi', 14.848, -16.04, 2.75, 0.15], ['Izar', 14.75, 27.07, 2.37, 0.97],
  ['Alphecca', 15.578, 26.71, 2.22, -0.02], ['Menkar', 3.038, 4.09, 2.54, 1.64],
  ['Diphda', 0.726, -17.99, 2.04, 1.02], ['Enif', 21.736, 9.88, 2.38, 1.52],
];

function bvToRgb(bv) {
  // Rough black-body tint for colour index (blue-white → orange-red).
  const t = clamp((bv + 0.4) / 2.4, 0, 1);
  const r = lerp(0.72, 1.0, smoothstep(0.0, 0.45, t));
  const g = lerp(0.82, 0.72, t) + (1 - Math.abs(t - 0.35) * 2) * 0.12;
  const b = lerp(1.0, 0.45, smoothstep(0.2, 1.0, t));
  return [r, clamp(g, 0, 1), b];
}

const STAR_VERT = /* glsl */ `
  attribute float aMag;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uLimit;     // limiting magnitude
  uniform float uVis;       // overall visibility (darkness)
  uniform float uTime;
  uniform float uPx;        // pixel ratio
  uniform sampler2D tMount;
  varying vec3 vColor;
  varying float vBright;
  void main() {
    vec3 wd = normalize(mat3(modelMatrix) * position);
    float el = asin(clamp(wd.y, -1.0, 1.0));
    float az = atan(wd.x, -wd.z);
    if (az < 0.0) az += 6.28318530718;
    vec4 m = texture2D(tMount, vec2(az / 6.28318530718, 0.5));
    float ridge = max(m.r, m.g) * 12.0 * 0.01745329252;
    // Atmospheric extinction near the horizon + twinkle (stronger low in the sky).
    float airmass = 1.0 / max(sin(max(el, 0.0)) + 0.025, 0.04);
    float mag = aMag + 0.18 * (airmass - 1.0);
    float tw = sin(uTime * (3.0 + aPhase * 5.0) + aPhase * 60.0) * sin(uTime * 1.7 + aPhase * 23.0);
    float twinkle = 1.0 + tw * (0.18 + 0.25 * smoothstep(0.6, 0.05, el));
    float b = clamp((uLimit - mag) / 2.2, 0.0, 1.0);
    b = b * b * twinkle * uVis;
    if (el < ridge + 0.002 || b < 0.004) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
    } else {
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
      gl_PointSize = (1.3 + max(0.0, 2.6 - mag) * 0.9) * uPx;
    }
    vColor = aColor;
    vBright = b * (1.0 + max(0.0, 1.5 - mag) * 0.7);
  }
`;
const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vBright;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float core = exp(-r * r * 5.0);
    gl_FragColor = vec4(vColor * vBright * core * 3.2, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ---- Moon ---------------------------------------------------------------------------------

const MOON_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;
const MOON_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uLight;     // sun direction in billboard space (x right, y up, z to viewer)
  uniform vec3 uTint;      // atmospheric tint * brightness
  uniform float uNight;    // 0 day (additive pale moon) .. 1 night (occludes stars)
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    float r2 = dot(vUv, vUv);
    float edge = fwidth(r2) * 1.5;
    float disc = smoothstep(1.0, 1.0 - edge, r2);
    if (disc <= 0.0) discard;
    vec3 n = vec3(vUv, sqrt(max(0.0, 1.0 - r2)));
    // Maria (dark basalt seas) + small craters: fixed to the lunar surface.
    vec2 sp = n.xy * 2.2;
    float maria = smoothstep(0.45, 0.7, vnoise(sp * 1.6 + vec2(1.3, 0.2)) * 0.7 + vnoise(sp * 3.5) * 0.3);
    maria *= smoothstep(-0.6, 0.4, n.y + 0.3 * n.x);
    float crater = smoothstep(0.82, 0.95, vnoise(sp * 14.0)) * 0.25;
    float albedo = 0.95 - maria * 0.38 + crater * 0.2 + vnoise(sp * 40.0) * 0.06;
    float ndl = dot(n, uLight);
    float lit = smoothstep(-0.03, 0.12, ndl) * (0.35 + 0.65 * max(ndl, 0.0));
    vec3 col = uTint * albedo * lit;
    col += uTint * 0.018 * albedo * uNight; // earthshine
    float a = disc * uNight * 0.97;
    gl_FragColor = vec4(col * disc, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// ---- Procedural inputs (mountain profile, cloud noise) ---------------------------------------

function buildMountainTexture() {
  const W = 1024;
  const N = new TileNoise(7331);
  const data = new Uint8Array(W * 4);
  // Gaussian bumps: [azimuthDeg, heightDeg, widthDeg]. Heights are exaggerated ~1.5x for drama
  // (real Mt Rose is ~4.5° from downtown) — still recognisably the Reno skyline.
  const far = [
    [222, 8.6, 8], [212, 7.6, 5], [231, 7.2, 6], [204, 6.2, 7], [240, 6.4, 10], [252, 5.8, 9],
    [266, 5.4, 8], [281, 4.6, 9], [196, 5.0, 8], [186, 3.6, 10],
    [335, 3.6, 12], [350, 2.8, 14], [12, 2.4, 16], [36, 2.9, 10], [58, 3.5, 9], [74, 3.0, 9],
    [100, 3.3, 12], [122, 3.8, 9], [140, 4.6, 8], [151, 4.9, 6], [166, 3.6, 8],
  ];
  const near = [
    [302, 6.2, 20], [318, 4.8, 12], [286, 4.0, 10], [248, 2.6, 12], [262, 2.9, 9], [232, 2.0, 8],
    [156, 1.9, 8], [146, 1.6, 6], [170, 1.4, 9], [118, 1.3, 10], [84, 1.5, 12], [40, 1.6, 14],
    [10, 1.7, 12], [345, 2.3, 10], [200, 1.2, 10],
  ];
  const bump = (list, a) => {
    let h = 0;
    for (const [c, hh, w] of list) {
      let dA = Math.abs(a - c);
      if (dA > 180) dA = 360 - dA;
      h = Math.max(h, hh * Math.exp(-(dA * dA) / (2 * w * w)));
    }
    return h;
  };
  for (let i = 0; i < W; i++) {
    const a = (i / W) * 360;
    const u = i / W;
    const sierra = smoothstep(170, 200, a) * (1 - smoothstep(285, 310, a));
    const rough = N.ridged(u, 0.31, { freq: 24, octaves: 5, gain: 0.55 });
    const fine = N.perlin(u * 160, 0.7, 160);
    let hf = 1.6 + bump(far, a) + (rough - 0.6) * (0.9 + sierra * 1.6) + fine * (0.12 + sierra * 0.2);
    hf = Math.max(0.6, hf) * 0.62;
    const roughN = N.fbm(u + 0.4, 0.8, { freq: 18, octaves: 4 });
    let hn = 0.55 + bump(near, a) + roughN * 0.45 + N.perlin(u * 90, 0.2, 90) * 0.08;
    hn = Math.max(0.3, hn) * 0.62;
    data[i * 4] = clamp(Math.round((hf / 12) * 255), 0, 255);
    data[i * 4 + 1] = clamp(Math.round((hn / 12) * 255), 0, 255);
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, data, W };
}

function buildCloudTexture(size) {
  const N = new TileNoise(4242);
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Billowy cumulus: worley-modulated fbm; detail channel for edges.
      const w = N.worley(u, v, 6);
      const base = N.fbm(u, v, { freq: 4, octaves: 5 }) * 0.5 + 0.5;
      const billow = 1 - smoothstep(0.0, 0.9, w.f1);
      const r = clamp(base * 0.7 + billow * 0.45 - 0.1, 0, 1);
      const g = clamp(N.fbm(u + 0.3, v + 0.6, { freq: 12, octaves: 4 }) * 0.5 + 0.5, 0, 1);
      const i = (y * size + x) * 4;
      data[i] = r * 255;
      data[i + 1] = g * 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// ---- Helpers --------------------------------------------------------------------------------

function dirFromAzEl(az, el, out = new THREE.Vector3()) {
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
}

// Greenwich mean sidereal time (radians) for a UTC epoch.
function gmst(utcMs) {
  const d = utcMs / 86400000 + 2440587.5 - 2451545.0;
  let g = (280.46061837 + 360.98564736629 * d) % 360;
  if (g < 0) g += 360;
  return g * DEG;
}

// Seasonal snow line on the Carson Range, in "screen degrees" of the exaggerated profile.
function snowLineFor(month) {
  // month 1..12 → snow line: low in mid-winter, gone by late summer.
  const table = [4.6, 4.6, 5.0, 5.6, 6.6, 7.6, 9.5, 12, 10, 7.6, 6.2, 5.0];
  return table[(month - 1 + 12) % 12] * 0.62;
}

// ---- The sky --------------------------------------------------------------------------------

class Sky {
  constructor(scene, renderer, tier) {
    this.scene = scene;
    this.renderer = renderer;
    this.tier = tier || { name: 'high', shadows: true, shadowMapSize: 2048 };
    this.lat = RENO.lat;
    this.lon = RENO.lon;
    this.lightPollution = 0.7; // downtown Reno
    this.weather = { cloudCover: 0.18, rain: 0, fog: 0 };
    this.state = {
      sunDir: new THREE.Vector3(0, 1, 0),
      moonDir: new THREE.Vector3(0, -1, 0),
      sunEl: 0,
      moonEl: 0,
      moonPhase: 0,
      moonIllum: 0,
      night: 0, // 0 = full day, 1 = full night (drive street lights / neon from this)
      dusk: 0, // golden-hour amount
      lightsOn: false,
      daylight: 1,
    };

    const tierName = this.tier.name;
    this._envEvery = { low: 40, medium: 18, high: 8, ultra: 5 }[tierName] ?? 10; // real seconds max
    this._lastEnvT = -1e9;
    this._lastLutSun = new THREE.Vector3(0, -2, 0);
    this._lastEnvSun = new THREE.Vector3(0, -2, 0);
    this._lastLutWeather = '';
    this._lastEnvWeather = '';
    this._time = 0;
    this._focus = new THREE.Vector3();
    this._camPos = new THREE.Vector3();

    // LUT
    const lutW = tierName === 'low' ? 128 : 256;
    this.lut = new THREE.WebGLRenderTarget(lutW, lutW / 2, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      magFilter: THREE.LinearFilter,
      minFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
    });
    this.lut.texture.wrapS = THREE.RepeatWrapping;
    this.lutMat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: LUT_FRAG,
      uniforms: {
        uSun: { value: new THREE.Vector3(0, 1, 0) },
        uMoon: { value: new THREE.Vector3(0, -1, 0) },
        uSunI: { value: ATMO.sunI },
        uMoonI: { value: 0 },
        uHaze: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.lutScene = new THREE.Scene();
    this.lutQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.lutMat);
    this.lutQuad.frustumCulled = false;
    this.lutScene.add(this.lutQuad);
    this.lutCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const mount = buildMountainTexture();
    this.mountTex = mount.tex;
    this._mountData = mount;
    this.cloudTex = buildCloudTexture(tierName === 'low' ? 128 : 256);

    // Dome
    this.uniforms = {
      tLut: { value: this.lut.texture },
      tMount: { value: this.mountTex },
      tCloud: { value: this.cloudTex },
      uSunDir: { value: this.state.sunDir },
      uMoonDir: { value: this.state.moonDir },
      uSunRad: { value: new THREE.Vector3() },
      uSunLight: { value: new THREE.Vector3() },
      uMoonLight: { value: new THREE.Vector3() },
      uAmbient: { value: new THREE.Vector3() },
      uSkyScale: { value: 1 },
      uDay: { value: 1 },
      uNightBase: { value: new THREE.Vector3() },
      uGlowColor: { value: new THREE.Vector3(1.0, 0.55, 0.28) },
      uGlow: { value: 0 },
      uCloud: { value: 0.2 },
      uRain: { value: 0 },
      uFog: { value: 0 },
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.0011, 0.0004) },
      uSnowLine: { value: 6.2 },
      uMilky: { value: 0 },
      uEqToWorld: { value: new THREE.Matrix3() },
      uMoonGlow: { value: 0 },
    };
    this.domeMat = new THREE.ShaderMaterial({
      vertexShader: DOME_VERT,
      fragmentShader: DOME_FRAG,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: true,
    });
    const domeGeo = new THREE.IcosahedronGeometry(DOME_R, 5);
    this.dome = this._makeDome(domeGeo);
    this.dome.name = 'sky-dome';
    scene.add(this.dome);

    // Stars
    this.stars = this._buildStars(tierName);
    scene.add(this.stars);

    // Moon
    this.moonMat = new THREE.ShaderMaterial({
      vertexShader: MOON_VERT,
      fragmentShader: MOON_FRAG,
      uniforms: {
        uLight: { value: new THREE.Vector3(0, 0, 1) },
        uTint: { value: new THREE.Vector3(1, 1, 1) },
        uNight: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      fog: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
    });
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.moonMat);
    this.moon.frustumCulled = false;
    this.moon.renderOrder = -998;
    this.moon.name = 'sky-moon';
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    this.moon.onBeforeRender = (r, s, camera) => {
      const md = this.state.moonDir;
      const dist = DOME_R * 0.92;
      this.moon.position.copy(camera.position).addScaledVector(md, dist);
      // Billboard basis facing the camera with world-up as reference.
      fwd.copy(md).negate();
      right.crossVectors(new THREE.Vector3(0, 1, 0), fwd);
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
      right.normalize();
      up.crossVectors(fwd, right).normalize();
      this.moon.matrix.makeBasis(right, up, fwd);
      const size = dist * Math.tan(0.95 * DEG);
      this.moon.matrix.scale(new THREE.Vector3(size, size, size));
      this.moon.matrix.setPosition(this.moon.position);
      this.moon.matrixWorld.copy(this.moon.matrix);
      const sd = this.state.sunDir;
      this.moonMat.uniforms.uLight.value.set(sd.dot(right), sd.dot(up), sd.dot(fwd));
    };
    this.moon.matrixAutoUpdate = false;
    scene.add(this.moon);

    // Lights
    this.sunLight = new THREE.DirectionalLight(0xffffff, 3);
    this.sunLight.name = 'sky-sun';
    this.sunLight.castShadow = !!this.tier.shadows;
    const sm = this.tier.shadowMapSize || 1024;
    this.sunLight.shadow.mapSize.set(sm, sm);
    this.shadowExtent = { low: 30, medium: 38, high: 48, ultra: 64 }[tierName] ?? 45;
    const sc = this.sunLight.shadow.camera;
    sc.left = -this.shadowExtent;
    sc.right = this.shadowExtent;
    sc.top = this.shadowExtent;
    sc.bottom = -this.shadowExtent;
    sc.near = 1;
    sc.far = 520;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = tierName === 'ultra' ? 0.025 : 0.04;
    this.sunLight.shadow.radius = 3;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a3f33, 0.6);
    this.hemi.name = 'sky-hemi';
    scene.add(this.hemi);

    scene.fog = new THREE.FogExp2(0xb8c4d0, 0.002);

    // Environment
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = this._makeDome(domeGeo, false);
    this.envScene.add(this.envDome);
    this.envRT = null;
    this.envIntensity = 1;

    this._eqToWorld = new THREE.Matrix4();
    this._eq3 = new THREE.Matrix3();
  }

  _makeDome(geo, trackCamera = true) {
    const m = new THREE.Mesh(geo, this.domeMat);
    m.frustumCulled = false;
    m.renderOrder = -1000;
    m.matrixAutoUpdate = false;
    m.onBeforeRender = (r, s, camera) => {
      m.matrix.makeTranslation(camera.position.x, camera.position.y, camera.position.z);
      m.matrixWorld.copy(m.matrix);
      if (trackCamera) this._camPos.copy(camera.position);
    };
    return m;
  }

  _buildStars(tierName) {
    const rng = new Rng(90210);
    const count = { low: 1200, medium: 2200, high: 3500, ultra: 5000 }[tierName] ?? 3000;
    const pos = [];
    const mag = [];
    const col = [];
    const phase = [];
    const R = DOME_R * 0.97;
    const push = (raH, decD, m, bv) => {
      const ra = raH * 15 * DEG;
      const dec = decD * DEG;
      pos.push(Math.cos(dec) * Math.cos(ra) * R, Math.cos(dec) * Math.sin(ra) * R, Math.sin(dec) * R);
      mag.push(m);
      col.push(...bvToRgb(bv));
      phase.push(rng.next());
    };
    for (const s of BRIGHT_STARS) push(s[1], s[2], s[3], s[4]);
    // Galactic → equatorial rotation (J2000) for concentrating faint stars along the Milky Way.
    const G = [
      [-0.0548755, 0.4941094, -0.8676661],
      [-0.873437, -0.44483, -0.1980764],
      [-0.4838350, 0.7469822, 0.4559838],
    ];
    for (let i = 0; i < count; i++) {
      // Magnitude distribution: many more faint stars (N ∝ 10^(0.5 m)).
      const m = 6.6 - Math.log10(1 + rng.next() * 9999) * 1.15;
      let x;
      let y;
      let z;
      if (rng.chance(0.45)) {
        const l = rng.next() * Math.PI * 2;
        const b = rng.gaussian(0, 0.12);
        const gx = Math.cos(b) * Math.cos(l);
        const gy = Math.cos(b) * Math.sin(l);
        const gz = Math.sin(b);
        // equatorial = T^T * galactic (G holds T^T row by row)
        x = G[0][0] * gx + G[0][1] * gy + G[0][2] * gz;
        y = G[1][0] * gx + G[1][1] * gy + G[1][2] * gz;
        z = G[2][0] * gx + G[2][1] * gy + G[2][2] * gz;
      } else {
        z = rng.range(-1, 1);
        const t = rng.next() * Math.PI * 2;
        const rr = Math.sqrt(1 - z * z);
        x = rr * Math.cos(t);
        y = rr * Math.sin(t);
      }
      const dec = Math.asin(z) / DEG;
      const ra = (Math.atan2(y, x) / DEG / 15 + 24) % 24;
      push(ra, dec, Math.max(2.6, m), rng.gaussian(0.6, 0.45));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aMag', new THREE.Float32BufferAttribute(mag, 1));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    this.starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uLimit: { value: 4 },
        uVis: { value: 0 },
        uTime: { value: 0 },
        uPx: { value: Math.min(window.devicePixelRatio || 1, 2) },
        tMount: { value: this.mountTex },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const pts = new THREE.Points(geo, this.starMat);
    pts.frustumCulled = false;
    pts.renderOrder = -999;
    pts.matrixAutoUpdate = false;
    pts.name = 'sky-stars';
    pts.onBeforeRender = (r, s, camera) => {
      pts.matrixWorld.copy(this._eqToWorld);
      pts.matrixWorld.setPosition(camera.position);
    };
    return pts;
  }

  setCity(lat, lon) {
    this.lat = lat;
    this.lon = lon;
    this._lastLutSun.set(0, -2, 0);
    this._lastEnvT = -1e9;
  }

  setLightPollution(v) {
    this.lightPollution = clamp(v, 0, 1);
  }

  // Equatorial (RA/Dec) → world rotation for the current sidereal time and latitude.
  _updateSidereal(utcMs) {
    const lst = gmst(utcMs) + this.lon * DEG;
    const phi = this.lat * DEG;
    // Columns: where the equatorial X (RA 0h), Y (RA 6h), Z (pole) axes point in world space.
    // Local frame after rotating by -LST: X' meridian, Y' east, Z' pole.
    const toWorld = (n, e, upv) => new THREE.Vector3(e, upv, -n);
    const Xp = toWorld(-Math.sin(phi), 0, Math.cos(phi));
    const Yp = toWorld(0, 1, 0);
    const Zp = toWorld(Math.cos(phi), 0, Math.sin(phi));
    const c = Math.cos(lst);
    const s = Math.sin(lst);
    // eq X = (cos lst) X' + (-sin lst) Y'  … rotate about pole by -LST
    const ex = Xp.clone().multiplyScalar(c).addScaledVector(Yp, -s);
    const ey = Xp.clone().multiplyScalar(s).addScaledVector(Yp, c);
    this._eqToWorld.makeBasis(ex, ey, Zp);
    this._eq3.setFromMatrix4(this._eqToWorld);
    this.uniforms.uEqToWorld.value.copy(this._eq3);
  }

  /**
   * @param {GameClock} clock
   * @param {{cloudCover?:number, rain?:number, fog?:number}} weather
   * @param {THREE.Vector3} [focus] point the shadow frustum follows (player); defaults to camera
   */
  update(clock, weather = {}, focus = null) {
    const now = performance.now() / 1000;
    const dt = this._lastNow ? Math.min(0.1, now - this._lastNow) : 0;
    this._lastNow = now;
    this._time += dt;
    const W = this.weather;
    W.cloudCover = clamp(weather.cloudCover ?? W.cloudCover, 0, 1);
    W.rain = clamp(weather.rain ?? W.rain, 0, 1);
    W.fog = clamp(weather.fog ?? W.fog, 0, 1);
    const cloud = Math.max(W.cloudCover, W.rain * 0.95);
    const haze = 1 + W.fog * 3 + W.rain * 2 + cloud * 0.5;

    const ms = clock.gameMs;
    const sun = sunPosition(ms, this.lat, this.lon);
    const moon = moonPosition(ms, this.lat, this.lon);
    const S = this.state;
    dirFromAzEl(sun.azimuth, sun.elevation, S.sunDir);
    dirFromAzEl(moon.azimuth, moon.elevation, S.moonDir);
    S.sunEl = sun.elevation / DEG;
    S.moonEl = moon.elevation / DEG;
    S.moonPhase = moon.phase;
    S.moonIllum = moon.illumination;
    this._updateSidereal(ms);

    // Day/night factors from sun elevation (degrees).
    const el = S.sunEl;
    const day = smoothstep(-7, 4, el); // 1 in daylight
    S.daylight = day;
    S.night = 1 - smoothstep(-8, 2, el);
    S.dusk = smoothstep(-6, 2, el) * (1 - smoothstep(6, 16, el));
    S.lightsOn = el < 3.5 || W.rain > 0.6;

    // Exposure compensation: the eye adapts — keep twilight and night readable, not black.
    const ev = lerp(1, 7.5, smoothstep(6, -7, el));
    const moonUp = smoothstep(-2, 4, S.moonEl);
    const moonI = ATMO.sunI * 2.2e-6 * 1e3 * S.moonIllum * moonUp; // artistic moonlight strength

    // ---- LUT refresh ----
    const wKey = `${haze.toFixed(2)}`;
    if (S.sunDir.distanceToSquared(this._lastLutSun) > (0.15 * DEG) ** 2 || wKey !== this._lastLutWeather || this._lutMoonDirty(S)) {
      this.lutMat.uniforms.uSun.value.copy(S.sunDir);
      this.lutMat.uniforms.uMoon.value.copy(S.moonDir);
      this.lutMat.uniforms.uMoonI.value = moonI;
      this.lutMat.uniforms.uHaze.value = haze;
      const prev = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.lut);
      this.renderer.render(this.lutScene, this.lutCam);
      this.renderer.setRenderTarget(prev);
      this._lastLutSun.copy(S.sunDir);
      this._lastLutMoon = S.moonDir.clone();
      this._lastLutWeather = wKey;
    }

    // ---- CPU colours (sun light, ambient, fog) ----
    const sunT = transmittance(S.sunDir, haze);
    const cloudDim = 1 - cloud * 0.72 - W.rain * 0.15;
    const skyScale = 0.62 * ev;
    const U = this.uniforms;
    U.uSkyScale.value = skyScale;
    U.uDay.value = day;
    // Sun disc radiance: very bright so bloom catches it; reddened by the atmosphere.
    const discK = 60 * smoothstep(-1.2, 0.5, el);
    U.uSunRad.value.set(sunT[0] * discK, sunT[1] * discK, sunT[2] * discK);
    const sunAbove = smoothstep(-1.5, 1.5, el);
    const sunL = 1.9 * ev * sunAbove;
    U.uSunLight.value.set(sunT[0] * sunL, sunT[1] * sunL, sunT[2] * sunL);
    const moonCol = [0.62, 0.7, 0.92];
    const moonL = 0.55 * S.moonIllum * moonUp * (1 - day);
    U.uMoonLight.value.set(moonCol[0] * moonL, moonCol[1] * moonL, moonCol[2] * moonL);

    // Sky ambient: zenith radiance (CPU model) for clouds/mountains and the hemisphere light.
    const zen = scatterJS(new THREE.Vector3(0, 1, 0), S.sunDir, ATMO.sunI, haze, 8);
    const hDir = new THREE.Vector3(S.sunDir.x, 0, S.sunDir.z);
    if (hDir.lengthSq() < 1e-6) hDir.set(0, 0, -1);
    hDir.normalize().y = 0.06;
    hDir.normalize();
    const hor = scatterJS(hDir, S.sunDir, ATMO.sunI, haze, 8);
    const hDirAnti = hDir.clone().set(-hDir.x, hDir.y, -hDir.z);
    const horAnti = scatterJS(hDirAnti, S.sunDir, ATMO.sunI, haze, 8);

    // Night base: deep blue airglow; light pollution: sodium + LED mix, stronger under clouds.
    const nightAmt = 1 - day;
    const lp = this.lightPollution;
    U.uNightBase.value.set(0.0035, 0.0055, 0.012).multiplyScalar(1 + moonUp * S.moonIllum * 1.5);
    U.uGlow.value = nightAmt * lp * (0.028 + cloud * 0.05 + W.fog * 0.04);
    U.uGlowColor.value.set(1.0, 0.62, 0.36);
    U.uAmbient.value.set(zen[0] * skyScale * 1.4 + 0.004, zen[1] * skyScale * 1.4 + 0.006, zen[2] * skyScale * 1.4 + 0.012);
    U.uCloud.value = cloud;
    U.uRain.value = W.rain;
    U.uFog.value = W.fog;
    U.uTime.value = this._time;
    U.uSnowLine.value = snowLineFor(clock.local?.month ?? 10);
    U.uMilky.value = (1 - lp) * smoothstep(-14, -18, el) * (1 - cloud) * (1 - moonUp * S.moonIllum * 0.8);
    U.uMoonGlow.value = moonUp * S.moonIllum * (0.08 + haze * 0.05) * (1 - day * 0.9);

    // Stars
    this.starMat.uniforms.uTime.value = this._time;
    this.starMat.uniforms.uVis.value = smoothstep(-4, -12, el) * (1 - cloud * 0.92) * (1 - W.fog * 0.8);
    const limit = lerp(6.4, 3.6, lp) - S.moonIllum * moonUp * 0.8;
    this.starMat.uniforms.uLimit.value = limit;

    // Moon
    const moonT = transmittance(S.moonDir, haze);
    const mk = lerp(0.9, 3.2, 1 - day) * moonUp;
    this.moonMat.uniforms.uTint.value.set(moonT[0] * mk * 1.05, moonT[1] * mk, moonT[2] * mk * 0.92);
    this.moonMat.uniforms.uNight.value = 1 - day;
    this.moon.visible = S.moonEl > -2;

    // ---- Key light: sun by day, moon by night ----
    const L = this.sunLight;
    const useMoon = el < -3;
    const keyDir = useMoon ? S.moonDir : S.sunDir;
    if (useMoon) {
      const mI = 0.38 * S.moonIllum * moonUp * cloudDim;
      L.color.setRGB(moonCol[0], moonCol[1], moonCol[2]);
      L.intensity = mI;
    } else {
      const mx = Math.max(sunT[0], sunT[1], sunT[2], 1e-4);
      L.color.setRGB(sunT[0] / mx, sunT[1] / mx, sunT[2] / mx);
      // Golden hour grade: the single-scattering model under-reddens a low desert sun (no dust
      // or smoke layer); push the key light toward amber in the last ~15 degrees.
      const gold = smoothstep(16, 3, el) * sunAbove * (1 - cloud * 0.6);
      L.color.lerp(GOLD_HOUR, gold * 0.5);
      // Physical irradiance falls with transmittance; ev keeps golden hour bright.
      const t = (sunT[0] * 0.2126 + sunT[1] * 0.7152 + sunT[2] * 0.0722);
      L.intensity = 3.4 * Math.min(1.25, t * lerp(1, 2.2, smoothstep(25, 2, el))) * sunAbove * cloudDim;
    }
    L.castShadow = !!this.tier.shadows && L.intensity > 0.02;

    // Shadow frustum follows the focus point, snapped to shadow texels (no shimmering).
    if (focus) this._focus.copy(focus);
    else this._focus.copy(this._camPos);
    this._placeKeyLight(keyDir);

    // Hemisphere: sky colour from zenith/horizon, ground = sunlit dusty asphalt bounce.
    const hs = skyScale * 1.25;
    const skyR = (zen[0] * 0.6 + hor[0] * 0.2 + horAnti[0] * 0.2) * hs;
    const skyG = (zen[1] * 0.6 + hor[1] * 0.2 + horAnti[1] * 0.2) * hs;
    const skyB = (zen[2] * 0.6 + hor[2] * 0.2 + horAnti[2] * 0.2) * hs;
    const nb = U.uNightBase.value;
    const glow = U.uGlow.value;
    const hemiSky = new THREE.Color(skyR + nb.x * 6 + glow * 1.0 + moonL * 0.25, skyG + nb.y * 6 + glow * 0.62 + moonL * 0.28, skyB + nb.z * 6 + glow * 0.36 + moonL * 0.34);
    const hemiI = Math.max(hemiSky.r, hemiSky.g, hemiSky.b, 1e-4);
    this.hemi.color.setRGB(hemiSky.r / hemiI, hemiSky.g / hemiI, hemiSky.b / hemiI);
    this.hemi.intensity = clamp(hemiI * 1.25, 0.06, 1.6) * lerp(1, 1.25, cloud);
    // Low sun: the whole bright western sky (not just the zenith sample) fills the shadows, so
    // flat ground doesn't sink to black at golden hour.
    this.hemi.intensity *= 1 + 0.7 * smoothstep(22, 3, el) * sunAbove;
    const bounce = sunAbove * 0.22;
    this.hemi.groundColor.setRGB(0.36 * (bounce + 0.15) + glow * 0.6, 0.31 * (bounce + 0.15) + glow * 0.4, 0.25 * (bounce + 0.15) + glow * 0.25);

    // Fog: colour of the horizon in the direction the camera is looking (approximated by the
    // average of sun-side and anti-sun horizon), density from haze + weather + tier distance.
    const fog = this.scene.fog;
    const fogK = skyScale * 0.95;
    const fr = (hor[0] * 0.45 + horAnti[0] * 0.55) * fogK + nb.x * 3 + glow * 1.7;
    const fg = (hor[1] * 0.45 + horAnti[1] * 0.55) * fogK + nb.y * 3 + glow * 1.15;
    const fb = (hor[2] * 0.45 + horAnti[2] * 0.55) * fogK + nb.z * 3 + glow * 0.7;
    fog.color.setRGB(fr, fg, fb);
    const lum = fr * 0.2126 + fg * 0.7152 + fb * 0.0722;
    fog.color.lerp(new THREE.Color(lum, lum, lum * 1.04), clamp(W.rain * 0.6 + W.fog * 0.5, 0, 0.8));
    const dd = this.tier.drawDistance || 360;
    const baseDensity = 1.1 / dd; // ~67% fog at draw distance on clear days hides chunk pop
    fog.density = baseDensity * (0.38 + W.fog * 2.4 + W.rain * 1.1) + 0.0003;

    // ---- Environment map ----
    this.envIntensity = clamp(0.25 + day * 0.85, 0.15, 1.1);
    this.scene.environmentIntensity = this.envIntensity;
    const envKey = `${haze.toFixed(1)}|${cloud.toFixed(2)}|${(1 - day).toFixed(1)}`;
    const elapsed = this._time - this._lastEnvT;
    const moved = S.sunDir.angleTo(this._lastEnvSun) > 2.5 * DEG;
    if (!this.envRT || (elapsed > 1.5 && (moved || envKey !== this._lastEnvWeather)) || elapsed > this._envEvery) {
      this._regenEnv();
      this._lastEnvT = this._time;
      this._lastEnvSun.copy(S.sunDir);
      this._lastEnvWeather = envKey;
    }
  }

  _lutMoonDirty(S) {
    if (S.night < 0.05) return false;
    return !this._lastLutMoon || S.moonDir.distanceToSquared(this._lastLutMoon) > (0.5 * DEG) ** 2;
  }

  _placeKeyLight(dir) {
    const L = this.sunLight;
    const f = this._focus;
    const d = dir.y < 0.06 ? new THREE.Vector3(dir.x, 0.06, dir.z).normalize() : dir;
    // Snap the focus in light space to whole shadow-map texels.
    const texel = (this.shadowExtent * 2) / L.shadow.mapSize.x;
    const lightRot = new THREE.Matrix4().lookAt(new THREE.Vector3(), d.clone().negate(), new THREE.Vector3(0, 1, 0));
    const inv = lightRot.clone().invert();
    const p = f.clone().applyMatrix4(inv);
    p.x = Math.round(p.x / texel) * texel;
    p.y = Math.round(p.y / texel) * texel;
    p.applyMatrix4(lightRot);
    L.target.position.copy(p);
    L.position.copy(p).addScaledVector(d, 250);
    L.target.updateMatrixWorld();
    L.updateMatrixWorld();
  }

  _regenEnv() {
    const old = this.envRT;
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 0.5, DOME_R * 2);
    this.scene.environment = this.envRT.texture;
    if (old) old.dispose();
  }

  dispose() {
    this.scene.remove(this.dome, this.stars, this.moon, this.sunLight, this.sunLight.target, this.hemi);
    this.lut.dispose();
    this.lutMat.dispose();
    this.domeMat.dispose();
    this.starMat.dispose();
    this.moonMat.dispose();
    this.stars.geometry.dispose();
    this.moon.geometry.dispose();
    this.dome.geometry.dispose();
    this.mountTex.dispose();
    this.cloudTex.dispose();
    this.envRT?.dispose();
    this.pmrem.dispose();
    if (this.scene.environment === this.envRT?.texture) this.scene.environment = null;
  }
}

/**
 * Create the sky for a scene.
 * @returns {{update(clock, weather, focus?), sunLight: THREE.DirectionalLight,
 *   hemi: THREE.HemisphereLight, setCity(lat, lon), setLightPollution(v), state, weather, dispose()}}
 */
export function createSky(scene, renderer, { tier } = {}) {
  const s = new Sky(scene, renderer, tier);
  return {
    update: (clock, weather, focus) => s.update(clock, weather, focus),
    sunLight: s.sunLight,
    hemi: s.hemi,
    setCity: (lat, lon) => s.setCity(lat, lon),
    setLightPollution: (v) => s.setLightPollution(v),
    get state() {
      return s.state;
    },
    get weather() {
      return s.weather;
    },
    get envIntensity() {
      return s.envIntensity;
    },
    dispose: () => s.dispose(),
    _impl: s,
  };
}

// Exposed for tests / other modules that want a matching colour (e.g. a window's view of the sky).
export { scatterJS as skyRadiance, transmittance as skyTransmittance, dirFromAzEl };
