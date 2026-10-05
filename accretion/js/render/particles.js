// Particles: dusty disks and belts (orbiting on the GPU), dust motes around the
// camera, debris rocks, and effects (ejecta, lava sparks, jets, tails, plasma).
import * as THREE from 'three';
import { RNG, hash32 } from '../core/rng.js';
import { G } from '../core/constants.js';
import { LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG, NOISE } from './glsl.js';

// ---------------------------------------------------------------- disks & belts
const DISK_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute float aA;
attribute float aTh;
attribute float aH;
attribute float aSz;
attribute float aV;
uniform vec3 uCenterRel;
uniform vec3 uE1; uniform vec3 uE2; uniform vec3 uN;
uniform float uTime;
uniform float uGM;
uniform float uInvS;
uniform float uFocal;
uniform float uLum;
uniform float uCompress;
uniform float uKind;     // 0 dust disk, 1 rocky belt, 2 icy belt
uniform vec3 uStarCol;
uniform vec2 uGap;       // a gap cleared by your own gravity: radius, half-width (km)
uniform float uDim;      // fewer grains are noticed when you're huge
varying vec3 vCol;
varying float vA;
void main() {
  float w = sqrt(uGM / (aA * aA * aA));
  float th = aTh + w * uTime;
  vec3 local = aA * (cos(th) * uE1 + sin(th) * uE2) + aH * uN;
  vec3 rel = uCenterRel + local * uInvS;
  vec4 mv = modelViewMatrix * vec4(rel, 1.0);
  float distU = max(-mv.z, 1e-6);
  float distKm = distU / uInvS;
  // starlight falls off with the real distance from the star
  float aReal = aA * uCompress / 1.496e8;
  float light = uLum / (aReal * aReal + 0.01);
  vec3 toCam = normalize(-mv.xyz);
  vec3 fromStar = normalize((modelViewMatrix * vec4(rel, 1.0)).xyz - (modelViewMatrix * vec4(uCenterRel, 1.0)).xyz);
  float cosS = dot(fromStar, toCam);
  // Henyey-Greenstein: dust scatters light mostly forward
  float g = uKind < 0.5 ? 0.55 : 0.2;
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosS, 1.5);
  float sizeKm = aSz * (uKind < 0.5 ? aA * 0.05 : aA * 0.012);
  float px = sizeKm / distKm * uFocal;
  // very close grains would be screen-sized blurs: fade them out (dust much sooner than rocks)
  float fade = uKind < 0.5 ? (1.0 - smoothstep(22.0, 80.0, px)) : (1.0 - smoothstep(60.0, 260.0, px));
  vec3 base = uKind < 0.5 ? mix(vec3(0.95, 0.62, 0.38), vec3(1.0, 0.85, 0.7), aV) : uKind < 1.5 ? mix(vec3(0.55, 0.5, 0.46), vec3(0.75, 0.68, 0.6), aV) : mix(vec3(0.7, 0.8, 0.9), vec3(0.9, 0.95, 1.0), aV);
  // near the star the dust is hot enough to glow
  float hot = (1.0 - smoothstep(0.04, 0.25, aReal)) * (uKind < 0.5 ? 1.0 : 0.0);
  vCol = base * uStarCol * (uKind < 0.5 ? 0.035 : 0.25) * min(light, 20.0) * min(hg, 5.0) + vec3(1.0, 0.4, 0.15) * hot * 0.4;
  vA = fade * (uKind < 0.5 ? 0.6 : 0.9);
  if (uGap.y > 0.0 && uKind < 0.5) vA *= mix(0.05, 1.0, smoothstep(uGap.y * 0.55, uGap.y, abs(aA - uGap.x)));
  vA *= uDim;
  gl_PointSize = clamp(px, uKind < 0.5 ? 1.0 : 1.0, 260.0);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;
const DISK_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
uniform float uExposure;
uniform float uKind;
varying vec3 vCol;
varying float vA;
void main() {
  ${LOGDEPTH_FRAG}
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  // falloff that reaches exactly zero at the sprite edge (no square corners)
  float k = uKind < 0.5 ? 2.6 : 7.0;
  float a = (exp(-r * r * k) - exp(-k)) / (1.0 - exp(-k));
  gl_FragColor = vec4(vCol * a * vA * uExposure, 1.0);
}
`;

export class DiskCloud {
  constructor(entry, shared, quality) {
    const det = entry.detail;
    const star = entry.star;
    this.entry = entry;
    this.objects = [];
    const q = quality === 'high' ? 1.4 : quality === 'low' ? 0.5 : 1;
    const rng = new RNG(hash32(entry.sys.seed, 901));
    if (det.disk) this.objects.push(this.make(rng, 0, det.disk.inner, det.disk.outer, det.disk.thickness, Math.round(60000 * q), det.disk.gaps, shared, star));
    for (const b of det.belts) {
      this.objects.push(this.make(rng, b.kind === 'ice' ? 2 : 1, b.inner, b.outer, b.thickness * 0.6, Math.round(14000 * q * b.density), [], shared, star));
    }
  }

  make(rng, kind, inner, outer, thick, n, gaps, shared, star) {
    const aA = new Float32Array(n), aTh = new Float32Array(n), aH = new Float32Array(n), aSz = new Float32Array(n), aV = new Float32Array(n);
    let i = 0;
    while (i < n) {
      // surface density ~ 1/r, with ringlets like HL Tauri's
      const a = inner * Math.pow(outer / inner, rng.next());
      let keep = 1;
      for (const g of gaps) if (Math.abs(a - g.r) < g.w) keep *= 0.08 + 0.92 * Math.pow(Math.abs(a - g.r) / g.w, 3);
      if (kind === 0) keep *= 0.65 + 0.35 * Math.sin(Math.log(a / inner) * 11.0);
      if (rng.next() > keep) continue;
      aA[i] = a;
      aTh[i] = rng.range(0, Math.PI * 2);
      // disks flare: thicker further out
      const flare = kind === 0 ? Math.pow(a / outer, 0.25) : 1;
      aH[i] = rng.normal() * a * thick * flare * 0.5;
      aSz[i] = rng.range(0.5, 1.5);
      aV[i] = rng.next();
      i++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
    geo.setAttribute('aTh', new THREE.BufferAttribute(aTh, 1));
    geo.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
    geo.setAttribute('aSz', new THREE.BufferAttribute(aSz, 1));
    geo.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
    const det = this.entry.detail;
    const mat = new THREE.ShaderMaterial({
      vertexShader: DISK_VERT, fragmentShader: DISK_FRAG,
      uniforms: {
        uCenterRel: { value: new THREE.Vector3() },
        uE1: { value: new THREE.Vector3(det.basis.e1.x, det.basis.e1.y, det.basis.e1.z) },
        uE2: { value: new THREE.Vector3(det.basis.e2.x, det.basis.e2.y, det.basis.e2.z) },
        uN: { value: new THREE.Vector3(det.normal.x, det.normal.y, det.normal.z) },
        uTime: { value: 0 },
        uGM: { value: G * (star ? star.mass : 2e30) },
        uInvS: { value: 1 },
        uFocal: { value: 800 },
        uLum: { value: star ? Math.max(star.lum || 1, 0.02) : 1 },
        uCompress: { value: 10 },
        uKind: { value: kind },
        uStarCol: { value: new THREE.Color(1, 1, 1) },
        uGap: { value: new THREE.Vector2(0, 0) },
        uDim: { value: 1 },
        uExposure: shared.uExposure,
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  update(cam, S, focal, simTime, starColor, gap = null, dim = 1) {
    const s = this.entry.star && this.entry.star.alive ? this.entry.star : this.entry.pos;
    for (const o of this.objects) {
      const u = o.material.uniforms;
      u.uCenterRel.value.set((s.x - cam.x) / S, (s.y - cam.y) / S, (s.z - cam.z) / S);
      u.uInvS.value = 1 / S;
      u.uFocal.value = focal;
      // orbits use time modulo a long period to keep float precision
      u.uTime.value = simTime % 3.0e7;
      if (starColor) u.uStarCol.value.setRGB(starColor[0], starColor[1], starColor[2]);
      if (gap) u.uGap.value.set(gap.r, gap.w); else u.uGap.value.set(0, 0);
      // seen from a star's size, the disk is a faint glow rather than a blizzard of grains
      u.uDim.value = Math.min(1, Math.max(0.08, Math.pow(6e4 / Math.max(S, 1), 0.8))) * dim;
      const star = this.entry.star;
      if (star && star.alive) u.uGM.value = G * star.mass;
    }
  }

  dispose() {
    for (const o of this.objects) {
      o.geometry.dispose();
      o.material.dispose();
      o.removeFromParent();
    }
  }
}

// ---------------------------------------------------------------- dust motes
const MOTE_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute float aEnd;
uniform vec3 uOffset;
uniform float uBox;
uniform vec3 uStreak;
varying float vA;
void main() {
  // wrap each mote into a box around the camera so the field never runs out
  vec3 p = mod(position - uOffset, uBox) - uBox * 0.5;
  p -= uStreak * aEnd;
  float d = length(p) / (uBox * 0.5);
  vA = (1.0 - aEnd * 0.9) * (1.0 - smoothstep(0.6, 1.0, d)) * smoothstep(0.02, 0.12, d);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;
const MOTE_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
uniform vec3 uColor;
uniform float uExposure;
varying float vA;
void main() {
  ${LOGDEPTH_FRAG}
  gl_FragColor = vec4(uColor * vA * uExposure, 1.0);
}
`;

export class Motes {
  constructor(shared, count = 900) {
    const pos = new Float32Array(count * 6);
    const end = new Float32Array(count * 2);
    const rng = new RNG(77);
    for (let i = 0; i < count; i++) {
      const x = rng.next(), y = rng.next(), z = rng.next();
      pos.set([x, y, z, x, y, z], i * 6);
      end[i * 2] = 0; end[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
      uniforms: {
        uOffset: { value: new THREE.Vector3() },
        uBox: { value: 1 },
        uStreak: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color(0.5, 0.45, 0.4) },
        uExposure: shared.uExposure,
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.base = geo.attributes.position.array.slice();
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    this.box = 1;
  }

  // camWorld in km; S render scale; boxR box size in render units
  update(camWorld, S, boxU, streakU, color, brightness) {
    // keep positions in [0, box) in render units, offset by camera position modulo box
    const pos = this.lines.geometry.attributes.position;
    if (this.box !== boxU) {
      const a = pos.array, b = this.base;
      for (let i = 0; i < a.length; i++) a[i] = b[i] * boxU;
      pos.needsUpdate = true;
      this.box = boxU;
    }
    const u = this.mat.uniforms;
    const ox = (camWorld.x / S) % boxU, oy = (camWorld.y / S) % boxU, oz = (camWorld.z / S) % boxU;
    u.uOffset.value.set(ox, oy, oz);
    u.uBox.value = boxU;
    u.uStreak.value.copy(streakU);
    u.uColor.value.setRGB(color[0] * brightness, color[1] * brightness, color[2] * brightness);
    this.lines.visible = brightness > 0.002;
  }
}

// ---------------------------------------------------------------- effects
const FX_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute vec4 aCol;    // rgb, alpha
attribute float aSize;  // world size in render units
uniform float uFocal;
varying vec4 vCol;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float px = aSize / max(-mv.z, 1e-6) * uFocal;
  vCol = aCol;
  vCol.a *= clamp(px / 1.5, 0.15, 1.0);
  gl_PointSize = clamp(px, 1.5, 300.0);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;
const FX_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
uniform float uExposure;
uniform float uSoft;
varying vec4 vCol;
void main() {
  ${LOGDEPTH_FRAG}
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = mix(1.0 - smoothstep(0.6, 1.0, r), (exp(-r * r * 3.0) - 0.0498) / 0.9502, uSoft) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * uExposure * (uSoft > 0.5 ? a : 1.0), uSoft > 0.5 ? 1.0 : a);
}
`;

export class Effects {
  constructor(shared, max = 16000) {
    this.max = max;
    this.shared = shared;
    // CPU state, positions in km (float64)
    this.px = new Float64Array(max); this.py = new Float64Array(max); this.pz = new Float64Array(max);
    this.vx = new Float64Array(max); this.vy = new Float64Array(max); this.vz = new Float64Array(max);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max); this.grow = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.glow = new Uint8Array(max);
    this.drag = new Float32Array(max);
    this.anchor = new Array(max).fill(null);
    this.free = [];
    for (let i = max - 1; i >= 0; i--) this.free.push(i);
    this.alive = new Set();
    this.glowPts = this.makePoints(1);
    this.dustPts = this.makePoints(0);
  }

  makePoints(soft) {
    const n = this.max;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FX_VERT, fragmentShader: FX_FRAG,
      uniforms: { uFocal: { value: 800 }, uExposure: this.shared.uExposure, uSoft: { value: soft } },
      transparent: true, depthWrite: false,
      blending: soft ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    p.renderOrder = soft ? 6 : 5;
    return p;
  }

  // anchor: a body whose motion the particle inherits (so effects stay put relative to it)
  spawn(o) {
    const i = this.free.pop();
    if (i === undefined) return -1;
    this.px[i] = o.x; this.py[i] = o.y; this.pz[i] = o.z;
    this.vx[i] = o.vx || 0; this.vy[i] = o.vy || 0; this.vz[i] = o.vz || 0;
    this.life[i] = 0; this.maxLife[i] = o.life || 1;
    this.size[i] = o.size; this.grow[i] = o.grow ?? 1;
    this.col[i * 3] = o.r; this.col[i * 3 + 1] = o.g; this.col[i * 3 + 2] = o.b;
    this.alpha[i] = o.a ?? 1;
    this.glow[i] = o.glow ? 1 : 0;
    this.drag[i] = o.drag || 0;
    this.anchor[i] = o.anchor || null;
    this.alive.add(i);
    return i;
  }

  // dtSim: simulated seconds this frame; dtReal for fading
  update(dtReal, dtSim, cam, S, focal) {
    const gp = this.glowPts.geometry, dp = this.dustPts.geometry;
    const gPos = gp.attributes.position.array, gCol = gp.attributes.aCol.array, gSz = gp.attributes.aSize.array;
    const dPos = dp.attributes.position.array, dCol = dp.attributes.aCol.array, dSz = dp.attributes.aSize.array;
    let gi = 0, di = 0;
    for (const i of this.alive) {
      this.life[i] += dtReal;
      const t = this.life[i] / this.maxLife[i];
      if (t >= 1) {
        this.alive.delete(i);
        this.free.push(i);
        this.anchor[i] = null;
        continue;
      }
      const an = this.anchor[i];
      if (an) {
        // move with the anchor body plus own drift relative to it
        this.px[i] += (an.vx + this.vx[i]) * dtSim;
        this.py[i] += (an.vy + this.vy[i]) * dtSim;
        this.pz[i] += (an.vz + this.vz[i]) * dtSim;
      } else {
        this.px[i] += this.vx[i] * dtSim;
        this.py[i] += this.vy[i] * dtSim;
        this.pz[i] += this.vz[i] * dtSim;
      }
      if (this.drag[i] > 0) {
        const k = Math.max(0, 1 - this.drag[i] * dtReal);
        this.vx[i] *= k; this.vy[i] *= k; this.vz[i] *= k;
      }
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      const a = this.alpha[i] * fade;
      const sz = (this.size[i] * (1 + (this.grow[i] - 1) * t)) / S;
      const x = (this.px[i] - cam.x) / S, y = (this.py[i] - cam.y) / S, z = (this.pz[i] - cam.z) / S;
      if (this.glow[i]) {
        gPos[gi * 3] = x; gPos[gi * 3 + 1] = y; gPos[gi * 3 + 2] = z;
        gCol[gi * 4] = this.col[i * 3]; gCol[gi * 4 + 1] = this.col[i * 3 + 1]; gCol[gi * 4 + 2] = this.col[i * 3 + 2]; gCol[gi * 4 + 3] = a;
        gSz[gi] = sz;
        gi++;
      } else {
        dPos[di * 3] = x; dPos[di * 3 + 1] = y; dPos[di * 3 + 2] = z;
        dCol[di * 4] = this.col[i * 3]; dCol[di * 4 + 1] = this.col[i * 3 + 1]; dCol[di * 4 + 2] = this.col[i * 3 + 2]; dCol[di * 4 + 3] = a;
        dSz[di] = sz;
        di++;
      }
    }
    for (const [geo, n] of [[gp, gi], [dp, di]]) {
      geo.setDrawRange(0, n);
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aCol.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    }
    this.glowPts.material.uniforms.uFocal.value = focal;
    this.dustPts.material.uniforms.uFocal.value = focal;
  }

  clear() {
    for (const i of this.alive) { this.free.push(i); this.anchor[i] = null; }
    this.alive.clear();
  }
}

// ---------------------------------------------------------------- debris rocks (instanced)
const ROCK_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute vec3 aTint;
attribute float aHot;
varying vec3 vN;
varying vec3 vTint;
varying float vHot;
void main() {
  mat3 m = mat3(instanceMatrix);
  vN = normalize(normalMatrix * (m * normal));
  vTint = aTint;
  vHot = aHot;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;
const ROCK_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
uniform vec3 uL0dir; uniform vec3 uL0col;
uniform float uExposure;
varying vec3 vN;
varying vec3 vTint;
varying float vHot;
void main() {
  ${LOGDEPTH_FRAG}
  vec3 N = normalize(vN);
  float nl = max(dot(N, uL0dir), 0.0);
  vec3 c = vTint * (nl * uL0col + 0.012);
  c += vec3(1.0, 0.4, 0.1) * vHot * 2.5;
  gl_FragColor = vec4(c * uExposure, 1.0);
}
`;

export function makeRockGeometry(seed = 1) {
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position;
  const rng = new RNG(seed);
  const bumps = [];
  for (let i = 0; i < 7; i++) bumps.push([rng.unitVector(), rng.range(-0.35, 0.3), rng.range(1.5, 4)]);
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize();
    let r = 1;
    for (const [d, a, k] of bumps) r += a * Math.pow(Math.max(0, v.x * d.x + v.y * d.y + v.z * d.z), k);
    pos.setXYZ(i, v.x * r, v.y * r * 0.8, v.z * r);
  }
  geo.computeVertexNormals();
  // the icosahedron is unindexed, so average normals of vertices that share a position
  const nrm = geo.attributes.normal;
  const sum = new Map();
  const key = (i) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const a = sum.get(k) || [0, 0, 0];
    a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i);
    sum.set(k, a);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = sum.get(key(i));
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  return geo;
}

export class Rocks {
  constructor(shared, max = 1200) {
    this.max = max;
    const geo = makeRockGeometry(5);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.hot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    geo.setAttribute('aTint', this.tint);
    geo.setAttribute('aHot', this.hot);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG,
      uniforms: { uL0dir: { value: new THREE.Vector3(1, 0, 0) }, uL0col: { value: new THREE.Color(1, 1, 1) }, uExposure: shared.uExposure },
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.s = new THREE.Vector3();
  }

  begin() { this.n = 0; }

  add(x, y, z, r, rot, seed, tint, hot) {
    if (this.n >= this.max) return;
    this.e.set(rot + seed, rot * 0.7 + seed * 2.1, seed * 3.3);
    this.q.setFromEuler(this.e);
    this.v.set(x, y, z);
    this.s.set(r, r, r);
    this.m.compose(this.v, this.q, this.s);
    this.mesh.setMatrixAt(this.n, this.m);
    this.tint.setXYZ(this.n, tint[0], tint[1], tint[2]);
    this.hot.setX(this.n, hot);
    this.n++;
  }

  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
    this.hot.needsUpdate = true;
  }
}

export { NOISE };

// ---------------------------------------------------------------- orbiters
// Small things on circular orbits drawn entirely on the GPU: your civilisation's
// satellites and stations, and the collectors of a Dyson swarm.
const ORB_VERT = /* glsl */ `
${LOGDEPTH_VERT_PARS}
attribute float aR;
attribute float aInc;
attribute float aNode;
attribute float aPh;
attribute float aSz;
attribute float aGlint;
uniform vec3 uCenter;
uniform float uScale;
uniform float uTime;      // in units of the orbit period at radius 1
uniform vec3 uSun;        // direction to the star (scene space)
uniform float uShadowR;   // radius of the body casting a shadow (in units of uScale)
uniform float uFocal;
varying float vB;
varying float vGlint;
void main() {
  float a = aPh + 6.2831853 * uTime / pow(aR, 1.5);
  vec3 n1 = vec3(cos(aNode), 0.0, sin(aNode));
  vec3 n2 = vec3(-sin(aNode) * cos(aInc), sin(aInc), cos(aNode) * cos(aInc));
  vec3 loc = aR * (cos(a) * n1 + sin(a) * n2);
  // in the shadow of the planet (or behind the star)?
  float along = dot(loc, uSun);
  float perp = length(loc - uSun * along);
  float lit = along > 0.0 || perp > uShadowR ? 1.0 : 0.0;
  vec3 pos = uCenter + loc * uScale;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  // a solar panel catches the light now and then
  float g = pow(max(0.0, sin(a * 3.0 + aGlint * 40.0)), 24.0);
  vB = lit * (0.35 + 0.65 * g);
  vGlint = g;
  gl_PointSize = clamp(aSz * (1.0 + g * 2.0), 1.0, 6.0);
  gl_Position = projectionMatrix * mv;
  if (vB < 0.01) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  ${LOGDEPTH_VERT}
}
`;
const ORB_FRAG = /* glsl */ `
${LOGDEPTH_FRAG_PARS}
uniform vec3 uColor;
uniform float uBright;
varying float vB;
varying float vGlint;
void main() {
  ${LOGDEPTH_FRAG}
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = (exp(-r * r * 3.0) - 0.0498) / 0.9502;
  gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.97, 0.9), vGlint) * a * vB * uBright, 1.0);
}
`;

export class Orbiters {
  constructor(max, seed, kind) {
    this.max = max;
    this.kind = kind;
    const rng = new RNG(hash32(seed, kind === 'dyson' ? 77 : 78));
    const aR = new Float32Array(max), aInc = new Float32Array(max), aNode = new Float32Array(max);
    const aPh = new Float32Array(max), aSz = new Float32Array(max), aGl = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      if (kind === 'dyson') {
        aR[i] = rng.range(17, 27);
        aInc[i] = rng.normal() * 0.5;
        aSz[i] = rng.range(1, 1.8);
      } else if (i < 4) {
        // stations
        aR[i] = 1.06 + i * 0.01;
        aInc[i] = rng.range(0.4, 0.9);
        aSz[i] = 3.2;
      } else {
        const u = rng.next();
        aR[i] = u < 0.72 ? rng.range(1.03, 1.3) : u < 0.9 ? rng.range(2.5, 4.2) : 6.6 + rng.normal() * 0.02;
        aInc[i] = u > 0.9 ? 0.0 : rng.range(0, Math.PI);
        aSz[i] = rng.range(1, 1.6);
      }
      aNode[i] = rng.range(0, Math.PI * 2);
      aPh[i] = rng.range(0, Math.PI * 2);
      aGl[i] = rng.next();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setAttribute('aR', new THREE.BufferAttribute(aR, 1));
    geo.setAttribute('aInc', new THREE.BufferAttribute(aInc, 1));
    geo.setAttribute('aNode', new THREE.BufferAttribute(aNode, 1));
    geo.setAttribute('aPh', new THREE.BufferAttribute(aPh, 1));
    geo.setAttribute('aSz', new THREE.BufferAttribute(aSz, 1));
    geo.setAttribute('aGlint', new THREE.BufferAttribute(aGl, 1));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: ORB_VERT, fragmentShader: ORB_FRAG,
      uniforms: {
        uCenter: { value: new THREE.Vector3() }, uScale: { value: 1 }, uTime: { value: 0 },
        uSun: { value: new THREE.Vector3(1, 0, 0) }, uShadowR: { value: 1 }, uFocal: { value: 800 },
        uColor: { value: kind === 'dyson' ? new THREE.Color(0.55, 0.5, 0.42) : new THREE.Color(0.85, 0.88, 0.95) },
        uBright: { value: 1 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  set(count, center, scale, tUnits, sunDir, shadowR, bright) {
    this.points.geometry.setDrawRange(0, Math.min(this.max, Math.round(count)));
    this.points.visible = count >= 1;
    const u = this.mat.uniforms;
    u.uCenter.value.copy(center);
    u.uScale.value = scale;
    u.uTime.value = tUnits;
    u.uSun.value.copy(sunDir);
    u.uShadowR.value = shadowR;
    u.uBright.value = bright;
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
    this.points.removeFromParent();
  }
}
