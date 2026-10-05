// The sky: the real-scale galaxy as seen from wherever you are.
//  - Far light (the Milky Way's glow, dust lanes, nebulae, distant giants,
//    other galaxies) is rendered into a cube map and refreshed as you travel
//    or as time passes. All of it is placed in light-years, galaxy frame.
//  - Real nearby stars (the same ones you can fly to) are drawn live, so they
//    shift with parallax as you move between them.
//  - Andromeda is drawn live too: it grows as it falls toward us.
import * as THREE from 'three';
import { RNG, hash32 } from '../core/rng.js';
import { GALAXY, LY, armDensity, stellarDensity } from '../world/galaxy.js';
import { stellarState, imfInverse, imfCDF, msLifetimeYears } from '../world/stellar.js';
import { blackbody, clamp } from '../core/phys.js';
import { NOISE, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

// faintest star flux drawn (solar luminosities per square light-year): a bit below naked eye
const F_MIN = 2e-5;
const BRIGHT_MAX = 3000; // ly: beyond this, starlight is part of the glow

// ---------------------------------------------------------------- cube shaders

const STAR_VERT = /* glsl */ `
attribute vec3 color;
attribute float lum;
uniform vec3 uCam;
uniform float uFluxK;
uniform float uNearR;
uniform float uFarR;
uniform float uFade;
varying vec3 vCol;
varying float vA;
void main() {
  vec3 rel = position - uCam;
  float d = max(length(rel), 1e-3);
  float flux = lum / (d * d) * uFluxK * uFade;
  float b = pow(flux, 0.45);
  b *= smoothstep(uNearR, uNearR * 1.35, d) * (1.0 - smoothstep(uFarR * 0.8, uFarR, d));
  vCol = color;
  vA = clamp(b, 0.0, 1.6);
  gl_PointSize = clamp(1.0 + sqrt(max(b, 0.0)) * 1.6, 1.0, 6.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(normalize(rel) * 1000.0, 1.0);
  if (b < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const STAR_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = (exp(-r * r * 3.0) - 0.0498) / 0.9502 * vA;
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

const HAZE_VERT = /* glsl */ `
attribute vec3 color;
attribute float wsize;
attribute float bright;
uniform vec3 uCam;
uniform float uFocal;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uFade;
varying vec3 vCol;
varying float vA;
void main() {
  vec3 rel = position - uCam;
  float d = max(length(rel), 1.0);
  float px = wsize / d * uFocal;
  // near puffs would be resolved into separate stars, so they fade out
  float fade = (1.0 - smoothstep(uFadeNear, uFadeFar, px)) * smoothstep(0.4, 1.5, px);
  vCol = color;
  vA = bright * fade * uFade;
  gl_PointSize = clamp(px, 1.0, uFadeFar);
  gl_Position = projectionMatrix * viewMatrix * vec4(normalize(rel) * 1000.0, 1.0);
  if (vA < 0.0005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const HAZE_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = (exp(-r * r * 2.5) - 0.0821) / 0.9179 * vA;
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;
const DUST_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = (exp(-r * r * 2.2) - 0.1108) / 0.8892 * vA;
  gl_FragColor = vec4(vCol, clamp(a, 0.0, 1.0));
}
`;

const NEB_VERT = /* glsl */ `
attribute vec3 color;
attribute float wsize;
attribute float bright;
attribute float aSeed;
uniform vec3 uCam;
uniform float uFocal;
uniform float uFade;
varying vec3 vCol;
varying float vA;
varying float vSeed;
void main() {
  vec3 rel = position - uCam;
  float d = max(length(rel), 1.0);
  float px = wsize / d * uFocal;
  float fade = (1.0 - smoothstep(220.0, 420.0, px)) * smoothstep(0.5, 3.0, px);
  vCol = color;
  vA = bright * fade * uFade;
  vSeed = aSeed;
  gl_PointSize = clamp(px, 1.0, 420.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(normalize(rel) * 1000.0, 1.0);
  if (vA < 0.0005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;
const NEB_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
varying float vSeed;
${NOISE}
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  vec3 q = vec3(c * 2.6, vSeed);
  float n = fbm(q + fbm(q * 1.7 + 3.1, 3) * 0.6, 4) * 0.5 + 0.5;
  float fil = pow(1.0 - abs(snoise(q * 2.2 + n)), 5.0);
  float base = (exp(-r * r * 2.2) - 0.1108) / 0.8892;
  float a = base * vA * (0.15 + 1.1 * n * n + 0.9 * fil);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;
const NEB_DUST_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vA;
varying float vSeed;
${NOISE}
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float n = fbm(vec3(c * 3.0, vSeed), 4) * 0.5 + 0.5;
  float base = (exp(-r * r * 2.2) - 0.1108) / 0.8892;
  gl_FragColor = vec4(vCol, clamp(base * vA * smoothstep(0.35, 0.75, n), 0.0, 1.0));
}
`;

// a spiral galaxy smudge (also used for Andromeda)
const GAL_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH_VERT}
}
`;
const GAL_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
uniform float uSeed;
uniform float uTilt;
uniform float uBright;
uniform float uSpiral;
varying vec2 vUv;
${NOISE}
void main() {
  ${LOGDEPTH_FRAG}
  vec2 p = vUv * 2.0 - 1.0;
  p.y /= max(uTilt, 0.08);
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  float arms = 0.5 + 0.5 * cos(2.0 * (ang - log(r + 0.05) * 3.0));
  arms = mix(0.5, arms, uSpiral);
  float core = exp(-r * r * 40.0);
  float n = snoise(vec3(p * 6.0, uSeed));
  float disk = exp(-r * 3.5) * (0.4 + 0.6 * arms) * (0.8 + 0.4 * n);
  float lane = smoothstep(0.25, 0.6, arms) * smoothstep(0.1, 0.4, r) * (0.5 + 0.5 * snoise(vec3(p * 14.0, uSeed + 3.0)));
  vec3 col = vec3(1.0, 0.85, 0.65) * core * 1.6 + mix(vec3(1.0, 0.86, 0.7), vec3(0.65, 0.75, 1.0), arms * r) * disk * 0.35;
  col *= 1.0 - lane * 0.35 * uSpiral;
  col *= smoothstep(1.0, 0.85, r);
  gl_FragColor = vec4(col * uBright, 1.0);
}
`;

// ---------------------------------------------------------------- live near stars

const NEAR_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute vec3 color;
attribute float lum;
attribute float rad;
uniform vec3 uOff;
uniform float uFluxK;
uniform float uFocal;
uniform float uExposure;
varying vec3 vCol;
varying float vB;
varying float vSize;
void main() {
  vec3 rel = position - uOff;
  float d = max(length(rel), 1e-9);
  float flux = lum / (d * d) * uFluxK * pow(uExposure, 0.55);
  float b = min(pow(flux, 0.42), 4.0);
  // close stars are real 3D bodies; their point fades away as you arrive
  b *= smoothstep(0.13, 0.2, d);
  float diskPx = rad / (d * ${LY.toExponential(4)}) * uFocal;
  b *= 1.0 - smoothstep(0.8, 2.5, diskPx);
  vB = b;
  vCol = color;
  float size = clamp(2.0 + b * 7.0, 2.0, 72.0);
  vSize = size;
  gl_PointSize = size;
  vec4 mv = viewMatrix * vec4(normalize(rel) * 1.0e9, 1.0);
  gl_Position = projectionMatrix * mv;
  if (b < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  ${LOGDEPTH_VERT}
}
`;
const NEAR_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
uniform float uTint;
uniform vec3 uTintCol;
varying vec3 vCol;
varying float vB;
varying float vSize;
float spike(vec2 d, float ang, float w) {
  vec2 dir = vec2(cos(ang), sin(ang));
  float along = abs(dot(d, dir));
  float across = abs(d.x * dir.y - d.y * dir.x);
  return exp(-across / w) * max(1.0 - along * 2.0, 0.0);
}
void main() {
  ${LOGDEPTH_FRAG}
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float px = vSize;
  float core = exp(-r * r * px * 0.9);
  float halo = max(exp(-r * 4.0) - 0.0183, 0.0) * 0.15;
  float sp = 0.0;
  if (px > 12.0) {
    float w = 1.2 / px;
    for (int i = 0; i < 3; i++) sp += spike(c, float(i) * 1.0471976 + 1.5707963, w);
    sp += 0.35 * spike(c, 0.0, w * 0.8);
    sp *= smoothstep(12.0, 40.0, px) * 0.6;
  }
  float a = (core * min(vB, 3.0) + (halo + sp) * vB);
  vec3 col = mix(vCol, uTintCol, uTint);
  gl_FragColor = vec4(col * a, 1.0);
}
`;

// colour of the diffuse glow: yellow bulge, bluish arms, dust reddens it
function glowColor(x, z, rng) {
  const r = Math.hypot(x, z);
  const bulge = Math.exp(-r / (GALAXY.Rb * 2.2));
  const arm = armDensity(x, z);
  const base = [
    0.95 * (1 - arm * 0.25) + 0.05,
    0.84 * (1 - arm * 0.12) + 0.06,
    0.68 + arm * 0.32,
  ];
  const warm = [1.0, 0.8, 0.55];
  const c = base.map((v, i) => v * (1 - bulge) + warm[i] * bulge);
  // dust lanes sit along the inner edges of the arms
  const t = Math.atan2(z, x);
  const lead = armDensity(r * Math.cos(t - 0.07), r * Math.sin(t - 0.07));
  const dust = clamp(lead * 1.3 - arm * 0.6, 0, 1) * (0.5 + rng.next() * 0.5) * clamp(r / 4000, 0, 1);
  return { color: c, dust, bulge, arm };
}

export class Sky {
  constructor(renderer, galaxy, shared, quality) {
    this.renderer = renderer;
    this.galaxy = galaxy;
    this.shared = shared;
    this.quality = quality;
    const size = quality === 'high' ? 1024 : quality === 'low' ? 384 : 768;
    this.cubeSize = size;
    const opts = { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.targets = [new THREE.WebGLCubeRenderTarget(size, opts), new THREE.WebGLCubeRenderTarget(size, opts)];
    this.front = 0;
    this.cubeCam = new THREE.CubeCamera(1, 1e7, this.targets[1]);
    this.cubeScene = new THREE.Scene();
    this.focalCube = size / 2;
    this.uCam = { value: new THREE.Vector3() };
    this.uNearR = { value: 200 };
    this.uFade = { value: 1 };
    this.lastCube = null;
    this.lastCubeTime = -1;
    this.face = -1;
    this.counts = {
      faint: quality === 'high' ? 170000 : quality === 'low' ? 60000 : 120000,
      haze: quality === 'high' ? 46000 : quality === 'low' ? 16000 : 32000,
    };
    this.layers = {};
    this.builtMerged = -1;
    this.brightAt = null;
    this.nebAt = null;
    this.nearAt = null;
    this.nearTimer = 0;
    this.nearMax = quality === 'high' ? 24000 : quality === 'low' ? 9000 : 16000;
    this.buildGalaxies();
    this.buildNear();
    this.buildAndromeda();
    this.tint = 0;
  }

  get texture() {
    return this.targets[this.front].texture;
  }

  // ---------------------------------------------------------------- layers

  replace(key, obj) {
    const old = this.layers[key];
    if (old) {
      this.cubeScene.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
    this.layers[key] = obj;
    if (obj) this.cubeScene.add(obj);
  }

  points(P, attrs, vert, frag, uniforms, blending, order) {
    uniforms.uFade = this.uFade;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    for (const [k, [arr, n]] of Object.entries(attrs)) g.setAttribute(k, new THREE.BufferAttribute(arr, n));
    const m = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms,
      transparent: true, depthWrite: false, depthTest: false, blending,
    });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false;
    o.renderOrder = order;
    return o;
  }

  // the unresolved glow of a hundred billion stars, and the dust in front of it
  buildGlow() {
    const g = this.galaxy;
    const rng = new RNG(hash32(g.seed, 502));
    const n = this.counts.haze;
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n), B = new Float32Array(n);
    const dP = [], dC = [], dS = [], dB = [];
    for (let i = 0; i < n; i++) {
      const p = g.samplePoint(rng);
      P.set(p, i * 3);
      const hc = glowColor(p[0], p[2], rng);
      const dim = 1 - hc.dust * 0.7;
      C[i * 3] = hc.color[0] * dim; C[i * 3 + 1] = hc.color[1] * dim * (1 - hc.dust * 0.1); C[i * 3 + 2] = hc.color[2] * dim * (1 - hc.dust * 0.3);
      S[i] = rng.range(260, 700) * (1 + hc.bulge * 1.8);
      B[i] = 0.05 * (0.55 + hc.bulge * 1.6 + hc.arm * 0.3) * rng.range(0.6, 1.2);
      if (hc.dust > 0.2 && rng.chance(0.4)) {
        dP.push(p[0] + rng.normal() * 120, p[1] * 0.35, p[2] + rng.normal() * 120);
        dC.push(0.018, 0.011, 0.007);
        dS.push(rng.range(380, 900));
        dB.push(0.22 * hc.dust);
      }
    }
    // the merger leaves a big round glow of stars (an elliptical galaxy)
    const nm = Math.round(n * 0.25 * g.merged);
    const mP = [], mC = [], mS = [], mB = [];
    for (let i = 0; i < nm; i++) {
      const v = rng.unitVector();
      const r = 9000 * Math.pow(rng.next(), 1.6) * 2.5;
      mP.push(v.x * r, v.y * r * 0.7, v.z * r);
      mC.push(1.0, 0.82, 0.62);
      mS.push(rng.range(500, 1400));
      mB.push(0.045 * g.merged);
    }
    const u = () => ({ uCam: this.uCam, uFocal: { value: this.focalCube }, uFadeNear: { value: 45 }, uFadeFar: { value: 110 } });
    this.replace('haze', this.points(P, { color: [C, 3], wsize: [S, 1], bright: [B, 1] }, HAZE_VERT, HAZE_FRAG, u(), THREE.AdditiveBlending, 1));
    if (nm) {
      this.replace('ellip', this.points(new Float32Array(mP), { color: [new Float32Array(mC), 3], wsize: [new Float32Array(mS), 1], bright: [new Float32Array(mB), 1] }, HAZE_VERT, HAZE_FRAG, u(), THREE.AdditiveBlending, 1));
    } else this.replace('ellip', null);
    if (dP.length) {
      this.replace('dust', this.points(new Float32Array(dP), { color: [new Float32Array(dC), 3], wsize: [new Float32Array(dS), 1], bright: [new Float32Array(dB), 1] }, HAZE_VERT, DUST_FRAG, u(), THREE.NormalBlending, 2));
    }
    this.buildFaint(rng);
    this.builtMerged = g.merged;
  }

  // grainy field of faint distant stars
  buildFaint(rng) {
    const g = this.galaxy;
    const n = this.counts.faint;
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), L = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      P.set(g.samplePoint(rng), i * 3);
      const u = rng.next();
      // the faint stars you can see far away are mostly giants
      const T = u < 0.55 ? rng.range(3300, 4800) : u < 0.88 ? rng.range(4800, 7000) : rng.range(7000, 22000);
      C.set(blackbody(T), i * 3);
      L[i] = u < 0.55 ? rng.logRange(20, 600) : u < 0.88 ? rng.logRange(2, 60) : rng.logRange(50, 8000);
    }
    this.replace('faint', this.points(P, { color: [C, 3], lum: [L, 1] }, STAR_VERT, STAR_FRAG,
      { uCam: this.uCam, uFluxK: { value: 1.3e4 }, uNearR: { value: BRIGHT_MAX }, uFarR: { value: 1e7 } }, THREE.AdditiveBlending, 3));
  }

  // bright stars between the live near stars and the glow, drawn statistically
  buildBright(camLy) {
    const g = this.galaxy;
    const SC = 250;
    const nr = Math.ceil(BRIGHT_MAX / SC);
    const bi = Math.floor(camLy[0] / SC), bj = Math.floor(camLy[1] / SC), bk = Math.floor(camLy[2] / SC);
    const P = [], C = [], L = [];
    const cap = this.quality === 'low' ? 25000 : 60000;
    const ny = Math.min(nr, 6);
    for (let a = -nr; a <= nr; a++) for (let b = -ny; b <= ny; b++) for (let c = -nr; c <= nr; c++) {
      const cx = (bi + a + 0.5) * SC, cy = (bj + b + 0.5) * SC, cz = (bk + c + 0.5) * SC;
      const d = Math.hypot(cx - camLy[0], cy - camLy[1], cz - camLy[2]);
      if (d > BRIGHT_MAX + SC) continue;
      const rho = stellarDensity(cx, cy, cz, g.merged);
      const dEff = Math.max(d - SC * 0.9, this.uNearR.value);
      const mMin = Math.max(1.0, Math.pow(F_MIN * dEff * dEff, 1 / 3.5));
      const above = 1 - imfCDF(mMin);
      const alive = Math.min(1, (msLifetimeYears(mMin) * 1.12) / GALAXY.ageDisk);
      const lam = rho * SC * SC * SC * above * alive;
      if (lam < 0.02) continue;
      const rng = new RNG(hash32(hash32(g.seed, 7001 + bi + a), bj + b, bk + c));
      let k = lam < 30 ? poisson(rng, lam) : Math.round(lam + Math.sqrt(lam) * rng.normal());
      k = Math.min(k, 400);
      const c0 = imfCDF(mMin);
      for (let q = 0; q < k; q++) {
        const m = imfInverse(c0 + rng.next() * (1 - c0));
        const life = msLifetimeYears(m) * 1.12;
        const st = stellarState(m, rng.next() * Math.min(life, GALAXY.ageDisk));
        if (!st || st.phase === 'bh' || st.phase === 'ns' || st.phase === 'wd') continue;
        const x = cx + rng.range(-0.5, 0.5) * SC, y = cy + rng.range(-0.5, 0.5) * SC, z = cz + rng.range(-0.5, 0.5) * SC;
        P.push(x, y, z);
        C.push(...blackbody(st.temp));
        L.push(st.lum);
      }
      if (L.length > cap) break;
    }
    this.replace('bright', this.points(new Float32Array(P), { color: [new Float32Array(C), 3], lum: [new Float32Array(L), 1] }, STAR_VERT, STAR_FRAG,
      { uCam: this.uCam, uFluxK: { value: 1.5e4 }, uNearR: this.uNearR, uFarR: { value: BRIGHT_MAX } }, THREE.AdditiveBlending, 3));
    this.brightAt = [...camLy];
    this.brightMerged = g.merged;
  }

  buildNebulae(camLy) {
    const g = this.galaxy;
    const rng = new RNG(hash32(g.seed, 503));
    const P = [], C = [], S = [], B = [], Sd = [];
    const dP = [], dC = [], dS = [], dB = [], dSd = [];
    for (const nb of g.nebulaeNear(camLy[0], camLy[1], camLy[2], 9000)) {
      if (nb.massLeft <= 0.02) continue;
      const nr = new RNG(nb.seed);
      const k = 60 + Math.round(60 * Math.min(1, nb.r / 80));
      const emis = nb.emission * Math.sqrt(nb.massLeft);
      for (let i = 0; i < k; i++) {
        const v = nr.unitVector();
        const d = nb.r * Math.pow(nr.next(), 0.7) * 0.9;
        const x = nb.x + v.x * d, y = nb.y + v.y * d * 0.6, z = nb.z + v.z * d;
        const t = nr.next();
        let c;
        if (t < 0.6) c = [1.0, 0.18, 0.26];          // hydrogen-alpha red
        else if (t < 0.78) c = [0.25, 0.85, 0.75];    // oxygen teal
        else c = [0.45, 0.6, 1.0];                    // dust reflecting blue starlight
        P.push(x, y, z);
        C.push(...c);
        S.push(nb.r * nr.range(0.35, 0.8));
        B.push(0.03 * emis * nr.range(0.4, 1.0));
        Sd.push(nr.range(0, 100));
        if (nr.chance(0.45)) {
          dP.push(x + v.x * nb.r * 0.1, y, z + v.z * nb.r * 0.1);
          dC.push(0.02, 0.01, 0.006);
          dS.push(nb.r * nr.range(0.15, 0.4));
          dB.push(0.55);
          dSd.push(nr.range(0, 100));
        }
      }
    }
    void rng;
    const u = () => ({ uCam: this.uCam, uFocal: { value: this.focalCube } });
    this.replace('neb', P.length ? this.points(new Float32Array(P), { color: [new Float32Array(C), 3], wsize: [new Float32Array(S), 1], bright: [new Float32Array(B), 1], aSeed: [new Float32Array(Sd), 1] }, NEB_VERT, NEB_FRAG, u(), THREE.AdditiveBlending, 4) : null);
    this.replace('nebDust', dP.length ? this.points(new Float32Array(dP), { color: [new Float32Array(dC), 3], wsize: [new Float32Array(dS), 1], bright: [new Float32Array(dB), 1], aSeed: [new Float32Array(dSd), 1] }, NEB_VERT, NEB_DUST_FRAG, u(), THREE.NormalBlending, 5) : null);
    this.nebAt = [...camLy];
    this.nebTime = g.time;
  }

  buildGalaxies() {
    const rng = new RNG(hash32(this.galaxy.seed, 504));
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 6; i++) {
      const v = rng.unitVector();
      if (Math.abs(v.y) < 0.3) v.y += 0.45 * Math.sign(v.y || 1);
      const l = Math.hypot(v.x, v.y, v.z);
      const m = new THREE.ShaderMaterial({
        vertexShader: GAL_VERT, fragmentShader: GAL_FRAG,
        uniforms: { uSeed: { value: rng.range(0, 100) }, uTilt: { value: rng.range(0.15, 0.9) }, uBright: { value: 0.5 }, uSpiral: { value: rng.chance(0.7) ? 1 : 0 } },
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, m);
      const dist = 5000;
      mesh.position.set((v.x / l) * dist, (v.y / l) * dist, (v.z / l) * dist);
      mesh.lookAt(0, 0, 0);
      mesh.rotateZ(rng.range(0, Math.PI));
      const s = rng.range(14, 40);
      mesh.scale.set(s, s, s);
      mesh.renderOrder = 0;
      mesh.userData.galaxy = true;
      this.cubeScene.add(mesh);
    }
  }

  // ---------------------------------------------------------------- live near stars

  buildNear() {
    const n = this.nearMax;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('lum', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('rad', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.nearMat = new THREE.ShaderMaterial({
      vertexShader: NEAR_VERT, fragmentShader: NEAR_FRAG,
      uniforms: {
        uOff: { value: new THREE.Vector3() }, uFluxK: { value: 0.5 }, uFocal: { value: 800 },
        uExposure: this.shared.uExposure, uTint: { value: 0 }, uTintCol: { value: new THREE.Color(1, 1, 1) },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.nearPoints = new THREE.Points(geo, this.nearMat);
    this.nearPoints.frustumCulled = false;
    this.nearPoints.renderOrder = -10;
    this.nearList = [];
  }

  // compatibility name used by the renderer to add the live layer to the scene
  get systemPoints() {
    return this.nearPoints;
  }

  refreshNear(world, camLocal, camLy) {
    const g = this.galaxy;
    // pick a radius that keeps the count sensible: tiny in the crowded core
    const rho = stellarDensity(camLy[0], camLy[1], camLy[2], g.merged);
    const R = clamp(Math.cbrt(this.nearMax / (0.06 * 4.19 * Math.max(rho, 1e-6))), 25, 300);
    this.uNearR.value = R;
    const list = g.starsNear(camLocal, world.O, R * LY, (dKm) => {
      const d = Math.max(dKm / LY, 1);
      return Math.max(0.08, Math.pow(F_MIN * d * d, 1 / 3.5));
    }, 3000);
    const geo = this.nearPoints.geometry;
    const P = geo.attributes.position.array, C = geo.attributes.color.array, Lm = geo.attributes.lum.array, Rd = geo.attributes.rad.array;
    // keep the brightest as seen from here
    const cands = [];
    for (const s of list) {
      const st = g.starNow(s.rec);
      if (!st || st.lum <= 0) continue;
      const dl = Math.max(s.d / LY, 1e-3);
      cands.push({ s, st, f: (st.phase === 'ns' ? 1e-4 : st.lum) / (dl * dl) });
    }
    if (cands.length > this.nearMax) cands.sort((a, b) => b.f - a.f);
    let k = 0;
    const refs = [];
    for (const { s, st } of cands) {
      if (k >= this.nearMax) break;
      P[k * 3] = (s.x - camLocal.x) / LY; P[k * 3 + 1] = (s.y - camLocal.y) / LY; P[k * 3 + 2] = (s.z - camLocal.z) / LY;
      const c = blackbody(st.temp);
      C[k * 3] = c[0]; C[k * 3 + 1] = c[1]; C[k * 3 + 2] = c[2];
      // white dwarfs and neutron stars are too faint to see from far away
      Lm[k] = st.phase === 'ns' ? 1e-4 : st.lum;
      Rd[k] = st.radius;
      refs.push({ rec: s.rec, st, x: s.x, y: s.y, z: s.z });
      k++;
    }
    geo.setDrawRange(0, k);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.lum.needsUpdate = true;
    geo.attributes.rad.needsUpdate = true;
    this.nearAt = { ly: [...camLy] };
    this.nearList = refs;
    this.nearCount = k;
  }

  // ---------------------------------------------------------------- Andromeda

  buildAndromeda() {
    const m = new THREE.ShaderMaterial({
      vertexShader: GAL_VERT, fragmentShader: GAL_FRAG,
      uniforms: { uSeed: { value: 31.7 }, uTilt: { value: 0.28 }, uBright: { value: 1 }, uSpiral: { value: 1 } },
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    this.andromeda = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    this.andromeda.frustumCulled = false;
    this.andromeda.renderOrder = -20;
  }

  updateAndromeda(camLy, exposure) {
    const g = this.galaxy;
    const a = g.andromeda;
    const mesh = this.andromeda;
    if (!a.alive || g.merged >= 1) { mesh.visible = false; return; }
    const [ax, ay, az] = g.andromedaPos();
    const dx = ax - camLy[0], dy = ay - camLy[1], dz = az - camLy[2];
    const d = Math.hypot(dx, dy, dz);
    const R = 110000; // ly across
    const ang = Math.min(Math.atan(R / Math.max(d, 1)) * 2.2, 2.6);
    const D = 1e10;
    mesh.position.set((dx / d) * D, (dy / d) * D, (dz / d) * D);
    mesh.lookAt(0, 0, 0);
    mesh.rotation.z += 0.6;
    const s = Math.tan(Math.min(ang, 2.6) / 2) * 2 * D;
    mesh.scale.set(s, s, s);
    // integrated light: about magnitude 3.4 today, brightening as it falls in
    const near = clamp(2.5e6 / Math.max(d, 1e4), 1, 250);
    mesh.material.uniforms.uBright.value = clamp(0.25 * Math.pow(exposure, 0.35) * Math.pow(near, 0.25), 0.05, 4) * (1 - g.merged);
    mesh.visible = true;
  }

  // ---------------------------------------------------------------- frame

  // camLocal: camera position in local km; camLy: the same point in galaxy light-years
  update(world, camLocal, camLy, focalMain, dtReal, force = false) {
    const g = this.galaxy;
    const hard = force;
    this.nearMat.uniforms.uFocal.value = focalMain;
    // live near stars
    this.nearTimer -= dtReal;
    const movedNear = this.nearAt ? Math.hypot(camLy[0] - this.nearAt.ly[0], camLy[1] - this.nearAt.ly[1], camLy[2] - this.nearAt.ly[2]) : Infinity;
    if (force || movedNear > this.uNearR.value * 0.04 || this.nearTimer <= 0) {
      this.refreshNear(world, camLocal, camLy);
      this.nearTimer = world.deep ? 0.35 : 20;
    }
    const o = this.nearAt.ly;
    this.nearMat.uniforms.uOff.value.set(camLy[0] - o[0], camLy[1] - o[1], camLy[2] - o[2]);
    this.updateAndromeda(camLy, this.shared.uExposure.value);

    // far layers
    if (Math.abs(g.merged - this.builtMerged) > 0.08 || this.builtMerged < 0) this.buildGlow();
    const movedB = this.brightAt ? Math.hypot(camLy[0] - this.brightAt[0], camLy[1] - this.brightAt[1], camLy[2] - this.brightAt[2]) : Infinity;
    if (movedB > 150 || this.brightMerged !== g.merged) { this.buildBright(camLy); force = true; }
    const movedN = this.nebAt ? Math.hypot(camLy[0] - this.nebAt[0], camLy[1] - this.nebAt[1], camLy[2] - this.nebAt[2]) : Infinity;
    if (movedN > 800 || Math.abs(g.time - this.nebTime) > 2e7) { this.buildNebulae(camLy); force = force || movedN > 800; }
    const movedC = this.lastCube ? Math.hypot(camLy[0] - this.lastCube[0], camLy[1] - this.lastCube[1], camLy[2] - this.lastCube[2]) : Infinity;
    const aged = Math.abs(g.time - this.lastCubeTime) > Math.max(5e6, Math.abs(g.time) * 0.08);
    // the far future: star formation stops, stars burn out, other galaxies slip over the horizon
    const T = 13.8e9 + g.time;
    const fade = T < 1e11 ? 1 : Math.max(0, 1 - Math.log10(T / 1e11) / 3);
    if (Math.abs(fade - this.uFade.value) > 0.01 || (fade === 0 && this.uFade.value !== 0)) {
      this.uFade.value = fade;
      const gk = T < 1e11 ? 1 : Math.max(0, 1 - Math.log10(T / 1e11));
      for (const o of this.cubeScene.children) if (o.userData.galaxy) o.material.uniforms.uBright.value = 0.5 * gk;
      force = true;
    }
    if (this.face < 0 && (movedC > 25 || force || aged)) {
      this.face = 0;
      this.pendingPos = [...camLy];
    }
    if (this.face >= 0 && (hard || !this.lastCube)) {
      // first frame or a jump: render all faces now
      while (this.face >= 0) this.renderFace();
      return;
    }
    if (this.face >= 0) this.renderFace();
  }

  renderFace() {
    const r = this.renderer;
    const p = this.pendingPos;
    this.uCam.value.set(p[0], p[1], p[2]);
    const back = this.targets[1 - this.front];
    const cams = this.cubeCam.children;
    if (this.face === 0) {
      this.cubeCam.renderTarget = back;
      if (this.cubeCam.coordinateSystem !== r.coordinateSystem) {
        this.cubeCam.coordinateSystem = r.coordinateSystem;
        this.cubeCam.updateCoordinateSystem();
      }
    }
    const prev = r.getRenderTarget();
    const prevAuto = r.autoClear;
    r.autoClear = true;
    r.setRenderTarget(back, this.face);
    r.setClearColor(0x000000, 1);
    r.render(this.cubeScene, cams[this.face]);
    r.setRenderTarget(prev);
    r.autoClear = prevAuto;
    this.face++;
    if (this.face >= 6) {
      this.face = -1;
      this.front = 1 - this.front;
      this.lastCube = p;
      this.lastCubeTime = this.galaxy.time;
      this.onSwap?.(this.texture);
    }
  }

  dispose() {
    for (const k of Object.keys(this.layers)) this.replace(k, null);
    for (const t of this.targets) t.dispose();
    this.nearPoints.geometry.dispose();
    this.nearMat.dispose();
    this.andromeda.geometry.dispose();
    this.andromeda.material.dispose();
  }
}

function poisson(rng, lam) {
  const L = Math.exp(-lam);
  let k = 0, p = 1;
  do { k++; p *= rng.next(); } while (p > L);
  return k - 1;
}
