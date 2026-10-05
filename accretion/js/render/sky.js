// The sky: the galaxy as seen from wherever you are. Unresolved starlight and
// nebulae are rendered into a cube map (refreshed as you travel), and the real
// star systems are drawn live so nearby ones shift as you move.
import * as THREE from 'three';
import { RNG, hash32 } from '../core/rng.js';
import { GALAXY, diskDensity, armDensity, hazeColor } from '../world/galaxy.js';
import { blackbody } from '../core/phys.js';
import { NOISE, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

function splitHiLo(v) {
  const hi = Math.fround(v);
  return [hi, v - hi];
}

// ----- shaders for points placed at real galaxy positions (relative to eye)
const RTE = /* glsl */ `
attribute vec3 posHi;
attribute vec3 posLo;
uniform vec3 uCamHi;
uniform vec3 uCamLo;
vec3 rteRel() { return (posHi - uCamHi) + (posLo - uCamLo); }
`;

const FAINT_VERT = /* glsl */ `
${RTE}
attribute vec3 color;
attribute float lum;
uniform float uFocal;
uniform float uFluxK;
varying vec3 vCol;
varying float vA;
void main() {
  vec3 rel = rteRel();
  float d = length(rel);
  float flux = lum / (d * d) * uFluxK;
  float b = clamp(pow(flux, 0.45), 0.0, 6.0);
  vCol = color;
  vA = clamp(b, 0.0, 1.0);
  gl_PointSize = clamp(1.0 + sqrt(b) * 1.3, 1.0, 5.0);
  vec4 mv = viewMatrix * vec4(normalize(rel) * 1000.0, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;
const FAINT_FRAG = /* glsl */ `
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
${RTE}
attribute vec3 color;
attribute float wsize;
attribute float bright;
uniform float uFocal;
varying vec3 vCol;
varying float vA;
void main() {
  vec3 rel = rteRel();
  float d = length(rel);
  float px = wsize / max(d, 1.0) * uFocal;
  // haze has constant surface brightness; huge nearby puffs fade out
  // near puffs would be resolved into separate stars, so they fade out
  float fade = (1.0 - smoothstep(45.0, 110.0, px)) * smoothstep(0.4, 1.5, px);
  vCol = color;
  vA = bright * fade;
  gl_PointSize = clamp(px, 1.0, 110.0);
  vec4 mv = viewMatrix * vec4(normalize(rel) * 1000.0, 1.0);
  gl_Position = projectionMatrix * mv;
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
  gl_FragColor = vec4(vCol, a);
}
`;

// nebulae: wispy, filamentary clouds rather than smooth puffs
const NEB_VERT = /* glsl */ `
${RTE}
attribute vec3 color;
attribute float wsize;
attribute float bright;
attribute float aSeed;
uniform float uFocal;
varying vec3 vCol;
varying float vA;
varying float vSeed;
void main() {
  vec3 rel = rteRel();
  float d = length(rel);
  float px = wsize / max(d, 1.0) * uFocal;
  float fade = (1.0 - smoothstep(180.0, 360.0, px)) * smoothstep(0.5, 3.0, px);
  vCol = color;
  vA = bright * fade;
  vSeed = aSeed;
  gl_PointSize = clamp(px, 1.0, 360.0);
  vec4 mv = viewMatrix * vec4(normalize(rel) * 1000.0, 1.0);
  gl_Position = projectionMatrix * mv;
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
  gl_FragColor = vec4(vCol, base * vA * smoothstep(0.35, 0.75, n));
}
`;

// live star systems: real stars with telescope spikes when bright
const SYS_VERT = /* glsl */ `
${RTE}
${LOGDEPTH_VERT_PARS}
attribute vec3 color;
attribute float lum;
attribute float rad;
uniform float uFluxK;
uniform float uFocal;
uniform float uExposure;
uniform float uHideNear;
varying vec3 vCol;
varying float vB;
varying float vSize;
void main() {
  vec3 rel = rteRel();
  float d = length(rel);
  float flux = lum / (d * d) * uFluxK * uExposure;
  float b = min(pow(flux, 0.42), 4.0);
  // when a star is close enough to have a real disk on screen, the 3D body takes over
  float diskPx = rad / d * uFocal;
  float hide = (1.0 - smoothstep(uHideNear, uHideNear * 1.4, d)) + smoothstep(0.8, 2.5, diskPx);
  b *= clamp(1.0 - hide, 0.0, 1.0);
  vB = b;
  vCol = color;
  float size = clamp(2.0 + b * 7.0, 2.0, 72.0);
  vSize = size;
  gl_PointSize = size;
  vec4 mv = viewMatrix * vec4(normalize(rel) * 1.0e9, 1.0);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;
const SYS_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
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
  if (vB < 0.002) discard;
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
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

// far-off galaxies: a spiral smudge
const GAL_FRAG = /* glsl */ `
uniform float uSeed;
uniform float uTilt;
varying vec2 vUv;
${NOISE}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.y /= max(uTilt, 0.08);
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  float arms = 0.5 + 0.5 * cos(2.0 * (ang - log(r + 0.05) * 3.0));
  float core = exp(-r * r * 40.0);
  float disk = exp(-r * 3.5) * (0.4 + 0.6 * arms) * (0.8 + 0.4 * snoise(vec3(p * 6.0, uSeed)));
  vec3 col = vec3(1.0, 0.85, 0.65) * core * 1.6 + mix(vec3(1.0, 0.86, 0.7), vec3(0.65, 0.75, 1.0), arms * r) * disk * 0.35;
  gl_FragColor = vec4(col * 0.5, 1.0);
}
`;
const GAL_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export class Sky {
  constructor(renderer, galaxy, shared, quality) {
    this.renderer = renderer;
    this.galaxy = galaxy;
    this.shared = shared;
    const size = quality === 'high' ? 1024 : quality === 'low' ? 384 : 768;
    this.cubeSize = size;
    const opts = { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.targets = [new THREE.WebGLCubeRenderTarget(size, opts), new THREE.WebGLCubeRenderTarget(size, opts)];
    this.front = 0;
    this.cubeCam = new THREE.CubeCamera(1, 1e7, this.targets[1]);
    this.cubeScene = new THREE.Scene();
    this.focalCube = size / 2;
    this.camHi = new THREE.Vector3();
    this.camLo = new THREE.Vector3();
    this.lastPos = null;
    this.face = -1;
    this.counts = { faint: quality === 'high' ? 160000 : quality === 'low' ? 50000 : 110000, haze: quality === 'high' ? 42000 : quality === 'low' ? 14000 : 30000 };
    this.buildFaint();
    this.buildHaze();
    this.buildNebulae();
    this.buildGalaxies();
    this.buildSystems();
  }

  get texture() {
    return this.targets[this.front].texture;
  }

  rteAttrs(geo, n, getPos) {
    const hi = new Float32Array(n * 3), lo = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = getPos(i);
      for (let k = 0; k < 3; k++) {
        const [h, l] = splitHiLo(p[k]);
        hi[i * 3 + k] = h; lo[i * 3 + k] = l;
      }
    }
    geo.setAttribute('posHi', new THREE.BufferAttribute(hi, 3));
    geo.setAttribute('posLo', new THREE.BufferAttribute(lo, 3));
    // dummy position attribute (three needs one for draw counts)
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  }

  rteUniforms(extra = {}) {
    return { uCamHi: { value: this.camHi }, uCamLo: { value: this.camLo }, ...extra };
  }

  sampleGalaxyPoint(rng) {
    const R = GALAXY.radius;
    for (let t = 0; t < 200; t++) {
      const r = R * Math.sqrt(rng.next()) * 1.1;
      const a = rng.range(0, Math.PI * 2);
      const x = r * Math.cos(a), z = r * Math.sin(a);
      if (rng.next() < diskDensity(x, z) / 3.4) {
        const h = GALAXY.thickness * (0.5 + 2.2 * Math.exp(-r / GALAXY.bulge));
        return [x, rng.normal() * h * 0.6, z];
      }
    }
    return [0, 0, 0];
  }

  buildFaint() {
    const n = this.counts.faint;
    const rng = new RNG(hash32(this.galaxy.seed, 501));
    const pts = [];
    const col = new Float32Array(n * 3), lum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pts.push(this.sampleGalaxyPoint(rng));
      // mostly dim red/orange stars, a few bright blue ones
      const u = rng.next();
      const T = u < 0.6 ? rng.range(3000, 4500) : u < 0.9 ? rng.range(4500, 6500) : rng.range(6500, 20000);
      const c = blackbody(T);
      col.set(c, i * 3);
      lum[i] = u < 0.6 ? rng.logRange(0.01, 0.3) : u < 0.9 ? rng.logRange(0.3, 3) : rng.logRange(3, 2000);
    }
    const geo = new THREE.BufferGeometry();
    this.rteAttrs(geo, n, (i) => pts[i]);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('lum', new THREE.BufferAttribute(lum, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: FAINT_VERT, fragmentShader: FAINT_FRAG,
      uniforms: this.rteUniforms({ uFocal: { value: this.focalCube }, uFluxK: { value: 2.2e19 } }),
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const pts3 = new THREE.Points(geo, mat);
    pts3.frustumCulled = false;
    pts3.renderOrder = 3;
    this.cubeScene.add(pts3);
  }

  buildHaze() {
    const n = this.counts.haze;
    const rng = new RNG(hash32(this.galaxy.seed, 502));
    const pts = [];
    const col = new Float32Array(n * 3), size = new Float32Array(n), bright = new Float32Array(n);
    const dustPts = [], dustCol = [], dustSize = [], dustB = [];
    for (let i = 0; i < n; i++) {
      const p = this.sampleGalaxyPoint(rng);
      pts.push(p);
      const hc = hazeColor(p[0], p[2], rng);
      const r = Math.hypot(p[0], p[2]);
      const bulge = Math.exp(-r / GALAXY.bulge);
      const c = hc.color;
      const dim = 1 - hc.dust * 0.75;
      col[i * 3] = c[0] * dim; col[i * 3 + 1] = c[1] * dim * (1 - hc.dust * 0.1); col[i * 3 + 2] = c[2] * dim * (1 - hc.dust * 0.25);
      size[i] = rng.range(1.6e9, 4e9) * (1 + bulge * 1.5);
      bright[i] = 0.05 * (0.6 + bulge * 1.2) * rng.range(0.6, 1.2);
      // dust lanes trace the inner edges of the arms
      if (hc.dust > 0.25 && rng.chance(0.35)) {
        dustPts.push([p[0] + rng.normal() * 1e9, p[1] * 0.4, p[2] + rng.normal() * 1e9]);
        dustCol.push(0.02, 0.012, 0.008);
        dustSize.push(rng.range(3e9, 7e9));
        dustB.push(0.18 * hc.dust);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.rteAttrs(geo, n, (i) => pts[i]);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('wsize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('bright', new THREE.BufferAttribute(bright, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG,
      uniforms: this.rteUniforms({ uFocal: { value: this.focalCube } }),
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    });
    const haze = new THREE.Points(geo, mat);
    haze.frustumCulled = false;
    haze.renderOrder = 1;
    this.cubeScene.add(haze);

    const dn = dustPts.length;
    if (dn) {
      const dg = new THREE.BufferGeometry();
      this.rteAttrs(dg, dn, (i) => dustPts[i]);
      dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dustCol), 3));
      dg.setAttribute('wsize', new THREE.BufferAttribute(new Float32Array(dustSize), 1));
      dg.setAttribute('bright', new THREE.BufferAttribute(new Float32Array(dustB), 1));
      const dm = new THREE.ShaderMaterial({
        vertexShader: HAZE_VERT, fragmentShader: DUST_FRAG,
        uniforms: this.rteUniforms({ uFocal: { value: this.focalCube } }),
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending,
      });
      const dust = new THREE.Points(dg, dm);
      dust.frustumCulled = false;
      dust.renderOrder = 2;
      this.cubeScene.add(dust);
    }
  }

  buildNebulae() {
    const rng = new RNG(hash32(this.galaxy.seed, 503));
    const pts = [], col = [], size = [], bright = [];
    const dpts = [], dcol = [], dsize = [], dbr = [];
    for (const nb of this.galaxy.nebulae) {
      const k = 120;
      const emis = nb.emission;
      for (let i = 0; i < k; i++) {
        const v = rng.unitVector();
        const d = nb.r * Math.pow(rng.next(), 0.7) * 0.9;
        const x = nb.x + v.x * d, y = nb.y + v.y * d * 0.6, z = nb.z + v.z * d;
        const t = rng.next();
        let c;
        if (t < 0.6) c = [1.0, 0.18, 0.26];          // hydrogen-alpha red
        else if (t < 0.78) c = [0.25, 0.85, 0.75];    // oxygen teal
        else c = [0.45, 0.6, 1.0];                    // dust reflecting blue starlight
        pts.push([x, y, z]);
        col.push(...c);
        size.push(nb.r * rng.range(0.35, 0.8));
        bright.push(0.022 * emis * rng.range(0.4, 1.0));
        if (rng.chance(0.45)) {
          dpts.push([x + v.x * nb.r * 0.1, y, z + v.z * nb.r * 0.1]);
          dcol.push(0.02, 0.01, 0.006);
          dsize.push(nb.r * rng.range(0.15, 0.4));
          dbr.push(0.5);
        }
      }
    }
    const add = (P, C, S, B, frag, blending, order) => {
      const g = new THREE.BufferGeometry();
      this.rteAttrs(g, P.length, (i) => P[i]);
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(C), 3));
      g.setAttribute('wsize', new THREE.BufferAttribute(new Float32Array(S), 1));
      g.setAttribute('bright', new THREE.BufferAttribute(new Float32Array(B), 1));
      g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(P.map(() => rng.range(0, 100))), 1));
      const m = new THREE.ShaderMaterial({
        vertexShader: NEB_VERT, fragmentShader: frag,
        uniforms: this.rteUniforms({ uFocal: { value: this.focalCube } }),
        transparent: true, depthWrite: false, depthTest: false, blending,
      });
      const o = new THREE.Points(g, m);
      o.frustumCulled = false;
      o.renderOrder = order;
      this.cubeScene.add(o);
      return o;
    };
    this.nebulaPoints = add(pts, col, size, bright, NEB_FRAG, THREE.AdditiveBlending, 4);
    if (dpts.length) add(dpts, dcol, dsize, dbr, NEB_DUST_FRAG, THREE.NormalBlending, 5);
  }

  buildGalaxies() {
    const rng = new RNG(hash32(this.galaxy.seed, 504));
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 5; i++) {
      const v = rng.unitVector();
      if (Math.abs(v.y) < 0.25) v.y += 0.4 * Math.sign(v.y || 1);
      const l = Math.hypot(v.x, v.y, v.z);
      const m = new THREE.ShaderMaterial({
        vertexShader: GAL_VERT, fragmentShader: GAL_FRAG,
        uniforms: { uSeed: { value: rng.range(0, 100) }, uTilt: { value: rng.range(0.15, 0.9) } },
        transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, m);
      const dist = 5000;
      mesh.position.set((v.x / l) * dist, (v.y / l) * dist, (v.z / l) * dist);
      mesh.lookAt(0, 0, 0);
      mesh.rotateZ(rng.range(0, Math.PI));
      const s = i === 0 ? 140 : rng.range(18, 50);
      mesh.scale.set(s, s, s);
      mesh.renderOrder = 0;
      mesh.userData.galaxy = true;
      this.cubeScene.add(mesh);
    }
  }

  buildSystems() {
    const sys = this.galaxy.systems;
    const n = sys.length;
    const col = new Float32Array(n * 3), lum = new Float32Array(n), rad = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const s = sys[i];
      col.set(s.star.color, i * 3);
      lum[i] = s.star.lum;
      rad[i] = s.star.radius;
    }
    const geo = new THREE.BufferGeometry();
    this.rteAttrs(geo, n, (i) => [sys[i].x, sys[i].y, sys[i].z]);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('lum', new THREE.BufferAttribute(lum, 1));
    geo.setAttribute('rad', new THREE.BufferAttribute(rad, 1));
    this.sysMat = new THREE.ShaderMaterial({
      vertexShader: SYS_VERT, fragmentShader: SYS_FRAG,
      uniforms: this.rteUniforms({
        uFluxK: { value: 6e18 }, uFocal: { value: 800 }, uExposure: this.shared.uExposure, uHideNear: { value: 0 },
      }),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.systemPoints = new THREE.Points(geo, this.sysMat);
    this.systemPoints.frustumCulled = false;
    this.systemPoints.renderOrder = -10;
  }

  // dead or exploded systems should vanish from the sky
  refreshSystemLum() {
    const attr = this.systemPoints.geometry.getAttribute('lum');
    const sys = this.galaxy.systems;
    let changed = false;
    for (let i = 0; i < sys.length; i++) {
      const st = sys[i].state;
      const want = st && (st.starEaten || st.remnant) ? 0 : sys[i].star.lum;
      if (attr.array[i] !== want) { attr.array[i] = want; changed = true; }
    }
    if (changed) attr.needsUpdate = true;
  }

  setCamera(x, y, z) {
    const [hx, lx] = splitHiLo(x), [hy, ly] = splitHiLo(y), [hz, lz] = splitHiLo(z);
    this.camHi.set(hx, hy, hz);
    this.camLo.set(lx, ly, lz);
  }

  // re-render the cube a face at a time when we've moved far enough
  update(camWorld, focalMain, force = false) {
    this.sysMat.uniforms.uFocal.value = focalMain;
    const moved = this.lastPos ? Math.hypot(camWorld.x - this.lastPos.x, camWorld.y - this.lastPos.y, camWorld.z - this.lastPos.z) : Infinity;
    if (this.face < 0 && (moved > 4e8 || force)) {
      this.face = 0;
      this.pendingPos = { ...camWorld };
    }
    if (force && this.face >= 0) {
      // render all faces now (first frame / teleport)
      while (this.face >= 0) this.renderFace();
      return;
    }
    if (this.face >= 0) this.renderFace();
  }

  renderFace() {
    const r = this.renderer;
    const p = this.pendingPos;
    // the cube scene uses its own camera-relative uniforms
    const saveHi = this.camHi.clone(), saveLo = this.camLo.clone();
    this.setCamera(p.x, p.y, p.z);
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
    this.camHi.copy(saveHi); this.camLo.copy(saveLo);
    this.face++;
    if (this.face >= 6) {
      this.face = -1;
      this.front = 1 - this.front;
      this.lastPos = p;
      this.onSwap?.(this.texture);
    }
  }
}

export { armDensity };
