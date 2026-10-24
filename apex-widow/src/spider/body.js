// Builds a spider's 3D body from its species. Units = body lengths (the group gets scaled to the real size).
// Local axes: +Z forward (head), +Y up, +X left side. Origin = the ground point under the sternum.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const LEG_FRAC = [0.07, 0.04, 0.27, 0.10, 0.21, 0.21, 0.10]; // coxa trochanter femur patella tibia metatarsus tarsus
const SEG_R = [[0.040, 0.036], [0.035, 0.031], [0.031, 0.025], [0.026, 0.023], [0.023, 0.017], [0.016, 0.011], [0.011, 0.0055]];
const HIP_ANG = [0.52, 1.12, 1.78, 2.42];   // where each leg pair leaves the sternum (radians from forward)
export const FOOT_ANG = [0.46, 1.05, 1.92, 2.28]; // where each foot rests (leg IV swings out beside the big abdomen)
export const FOOT_REACH = [0.66, 0.7, 0.68, 0.72]; // fraction of the leg length the foot sits out

const _c = new THREE.Color();

// ------------------------------------------------------------------ small textures made once
let microNormal = null;
function getMicroNormal() {
  if (microNormal) return microNormal;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), img = g.createImageData(N, N);
  // height field: fine pores + soft bumps, turned into a tangent-space normal map
  const h = new Float32Array(N * N);
  for (let k = 0; k < 2600; k++) {
    const cx = Math.random() * N, cy = Math.random() * N, r = 0.8 + Math.random() * 2.2, d = Math.random() < 0.7 ? -1 : 0.6;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const px = ((Math.floor(cx) + x) % N + N) % N, py = ((Math.floor(cy) + y) % N + N) % N;
      const dd = (x * x + y * y) / (r * r); if (dd < 1) h[py * N + px] += d * (1 - dd) * (1 - dd);
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const dx = h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N];
    const dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
    let nx = -dx * 0.6, ny = -dy * 0.6, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    img.data[i * 4] = (nx * 0.5 + 0.5) * 255; img.data[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; img.data[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  microNormal = new THREE.CanvasTexture(cv);
  microNormal.wrapS = microNormal.wrapT = THREE.RepeatWrapping;
  microNormal.colorSpace = THREE.NoColorSpace;
  return microNormal;
}

// ------------------------------------------------------------------ the chitin shader
// One patched MeshPhysicalMaterial does: species patterns (hourglass, violin...), hair roughness, molt paleness,
// hunter-vision heat, and every eaten power's look. All smoothsteps go low->high (Windows GPUs need that).
const CHITIN_PARS_V = /* glsl */`
attribute vec3 unit; attribute float aHair; varying vec3 vUnit; varying float vHair; varying vec3 vLocal;`;
const CHITIN_MAIN_V = /* glsl */`
vUnit = unit; vHair = aHair; vLocal = position;`;
const CHITIN_PARS_F = /* glsl */`
varying vec3 vUnit; varying float vHair; varying vec3 vLocal;
uniform float uPart; uniform float uPattern; uniform vec3 uPatColor; uniform vec3 uPatColor2; uniform float uSoft; uniform float uHeat;
uniform float uTime; uniform float uElec; uniform float uLava; uniform float uRad; uniform float uStars; uniform float uVoid; uniform float uFrost; uniform float uAlien;
float awH(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float awN(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(awH(i), awH(i + vec3(1,0,0)), f.x), mix(awH(i + vec3(0,1,0)), awH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(awH(i + vec3(0,0,1)), awH(i + vec3(1,0,1)), f.x), mix(awH(i + vec3(0,1,1)), awH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float awVor(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z)); vec3 o = vec3(awH(i + g), awH(i + g + 11.7), awH(i + g + 23.1));
    float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return d2 - d1; }
float band01(float x, float a, float b, float w){ return smoothstep(a - w, a, x) * (1.0 - smoothstep(b, b + w, x)); }`;
const CHITIN_COLOR_F = /* glsl */`
vec3 U = vUnit; float notHair = 1.0 - vHair; float pat = 0.0;
if (uPattern > 0.5 && uPattern < 1.5 && uPart > 0.5 && uPart < 1.5) {
  // black widow: red hourglass on the belly (two triangles tip to tip) + a small red dot above the spinnerets
  float under = smoothstep(0.42, 0.68, -U.y);
  float zc = U.z + 0.02; float az = abs(zc);
  float hw = 0.035 + 0.62 * az;
  float tri = (1.0 - smoothstep(hw - 0.025, hw + 0.012, abs(U.x))) * (1.0 - smoothstep(0.25, 0.29, az));
  float waist = 0.55 + 0.45 * smoothstep(0.0, 0.05, az);
  pat = under * tri * waist;
  float dotm = 1.0 - smoothstep(0.05, 0.075, length(vec2(U.x, U.z + 0.86)));
  pat = max(pat, dotm * smoothstep(-0.2, 0.1, -U.y) * 0.9);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, pat * notHair);
}
if (uPattern > 1.5 && uPattern < 2.5 && uPart < 0.5) {
  // brown recluse: dark violin on the carapace, neck pointing back
  float top = smoothstep(0.25, 0.55, U.y);
  float zz = U.z;
  float w = mix(0.07, 0.36, smoothstep(-0.1, 0.55, zz));
  float v = (1.0 - smoothstep(w - 0.04, w, abs(U.x))) * band01(zz, -0.75, 0.92, 0.06);
  pat = top * v;
  diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, pat * notHair);
}
if (uPattern > 2.5 && uPattern < 3.5) {
  // tarantula: radial dark rays on the carapace, light rim of hair
  if (uPart < 0.5) { float a = atan(U.x, U.z + 1e-4); float r = length(U.xz);
    float ray = 0.5 + 0.5 * cos(a * 8.0); pat = smoothstep(0.55, 0.95, ray) * smoothstep(0.15, 0.6, r) * smoothstep(0.0, 0.5, U.y);
    diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, pat * 0.6);
    diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor2, smoothstep(0.75, 0.95, r) * 0.5); }
}
if (uPattern > 4.5 && uPattern < 5.5) {
  // spitting spider: black lyre marks and spots on yellow
  float n = awN(U * 7.0 + uPart * 5.0); float s = smoothstep(0.62, 0.7, n);
  float lyre = uPart < 0.5 ? (1.0 - smoothstep(0.05, 0.08, abs(abs(U.x) - 0.18 - 0.1 * U.z))) * smoothstep(0.2, 0.5, U.y) : 0.0;
  diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, max(s, lyre) * notHair);
}
if (uPattern > 5.5 && uPattern < 6.5) {
  // bark spider: mottled grey-brown like tree bark
  float n = awN(U * 9.0) * 0.6 + awN(U * 23.0) * 0.4;
  diffuseColor.rgb *= mix(0.55, 1.35, n);
  diffuseColor.rgb = mix(diffuseColor.rgb, uPatColor, smoothstep(0.72, 0.8, awN(U * 5.0 + 3.0)) * 0.7);
}
if (uPattern > 6.5 && uPattern < 7.5 && uPart > 0.5 && uPart < 1.5) {
  // peacock spider: rainbow fan on top of the abdomen
  float top = smoothstep(0.0, 0.35, U.y);
  float r = length(vec2(U.x * 1.2, U.z - 0.05));
  vec3 fan = mix(vec3(0.05, 0.25, 1.2), vec3(1.4, 0.35, 0.05), smoothstep(0.25, 0.45, r));
  fan = mix(fan, vec3(1.2, 0.05, 0.08), smoothstep(0.5, 0.7, r));
  fan = mix(fan, vec3(0.1, 0.9, 1.1), (1.0 - smoothstep(0.08, 0.12, abs(U.x))) * smoothstep(0.1, 0.25, r) * 0.6);
  diffuseColor.rgb = mix(diffuseColor.rgb, fan, top * notHair);
}
// molt: soft new skin is pale cream, then darkens
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.76, 0.66), uSoft);`;
const CHITIN_ROUGH_F = /* glsl */`
roughnessFactor = mix(roughnessFactor, 0.92, max(vHair, uSoft * 0.8));`;
const CHITIN_COAT_F = /* glsl */`
#ifdef USE_CLEARCOAT
material.clearcoat *= (1.0 - vHair) * (1.0 - uSoft * 0.85);
#endif`;
const CHITIN_EMIT_F = /* glsl */`
{
  vec3 P = vLocal * 24.0; vec3 E = vec3(0.0);
  if (uLava > 0.01) { float v = awVor(P * 0.8); float c = 1.0 - smoothstep(0.02, 0.09, v); float fl = 0.7 + 0.3 * sin(uTime * 3.0 + P.x);
    E += vec3(2.6, 0.75, 0.08) * c * fl * uLava * 3.0; }
  if (uElec > 0.01) { float n = awN(P * 0.7 + vec3(0.0, uTime * 4.0, 0.0)); float l = 1.0 - smoothstep(0.0, 0.04, abs(n - 0.5));
    float flick = step(0.35, awN(vec3(uTime * 13.0, P.y * 0.2, 0.0))); E += vec3(0.6, 1.4, 3.2) * l * flick * uElec * 3.0; }
  if (uRad > 0.01) { float s = smoothstep(0.62, 0.72, awN(P * 0.5)); E += vec3(0.6, 2.4, 0.3) * s * (0.6 + 0.4 * sin(uTime * 2.0)) * uRad * 2.0; }
  if (uStars > 0.01) { float st = smoothstep(0.985, 1.0, awH(floor(P * 3.0))); float neb = awN(P * 0.25 + uTime * 0.05);
    E += (vec3(2.0, 1.8, 1.4) * st * 4.0 + vec3(0.9, 0.3, 1.1) * neb * neb * 0.8) * uStars; }
  if (uAlien > 0.01) { float v = awVor(P * 0.5 + vec3(0.0, 0.0, uTime * 0.3)); E += vec3(0.1, 2.2, 1.6) * (1.0 - smoothstep(0.02, 0.06, v)) * uAlien * 2.0; }
  if (uFrost > 0.01) { float f = smoothstep(0.55, 0.75, awN(P * 1.3)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.9, 1.0), f * uFrost * 0.7); E += vec3(0.3, 0.6, 0.9) * f * uFrost * 0.3; }
  if (uVoid > 0.01 && uPart > 0.5 && uPart < 1.5) {
    // black hole belly: the top of the abdomen becomes a swirling disc with a burning ring
    vec2 q = vec2(vUnit.x, vUnit.z + 0.05); float r = length(q); float a = atan(q.y, q.x + 1e-4);
    float top = smoothstep(0.1, 0.4, vUnit.y);
    float ring = (1.0 - smoothstep(0.0, 0.08, abs(r - 0.36))) * (0.7 + 0.3 * sin(a * 6.0 - uTime * 5.0 + r * 30.0));
    float hole = 1.0 - smoothstep(0.24, 0.3, r);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.0), hole * top * uVoid);
    E += vec3(2.4, 1.2, 3.4) * ring * top * uVoid * 2.5;
  }
  if (uHeat > 0.01) E += vec3(2.2, 0.6, 0.15) * uHeat * (0.6 + 0.4 * notHair);
  totalEmissiveRadiance += E;
}`;

const chitinUniformsList = [];
export function makeChitin({ color, rough, coat, part, pattern = 0, patColor = 0xb0100c, patColor2 = 0xe0c090, quality = 'high', micro = 0.14, coatAmt = 1 }) {
  const hi = quality !== 'low';
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, vertexColors: true, roughness: rough, metalness: 0.0,
    clearcoat: hi ? coatAmt : 0.0, clearcoatRoughness: coat, ior: 1.5, specularIntensity: 0.45,
    normalMap: getMicroNormal(), normalScale: new THREE.Vector2(micro, micro),
  });
  const u = {
    uPart: { value: part }, uPattern: { value: pattern }, uPatColor: { value: new THREE.Color(patColor) }, uPatColor2: { value: new THREE.Color(patColor2) },
    uSoft: { value: 0 }, uHeat: { value: 0 }, uTime: { value: 0 },
    uElec: { value: 0 }, uLava: { value: 0 }, uRad: { value: 0 }, uStars: { value: 0 }, uVoid: { value: 0 }, uFrost: { value: 0 }, uAlien: { value: 0 },
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + CHITIN_PARS_V)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + CHITIN_MAIN_V);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + CHITIN_PARS_F)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + CHITIN_COLOR_F)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + CHITIN_ROUGH_F)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + CHITIN_COAT_F)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + CHITIN_EMIT_F);
  };
  m.customProgramCacheKey = () => 'chitin' + (hi ? 1 : 0);
  chitinUniformsList.push(u);
  return m;
}

// ------------------------------------------------------------------ geometry helpers
function addAttr(g, unitFn, hair) {
  const n = g.attributes.position.count, unit = new Float32Array(n * 3), h = new Float32Array(n).fill(hair);
  const p = g.attributes.position;
  for (let i = 0; i < n; i++) { const u = unitFn(p.getX(i), p.getY(i), p.getZ(i), i); unit[i * 3] = u[0]; unit[i * 3 + 1] = u[1]; unit[i * 3 + 2] = u[2]; }
  g.setAttribute('unit', new THREE.BufferAttribute(unit, 3));
  g.setAttribute('aHair', new THREE.BufferAttribute(h, 1));
  return g;
}
function paint(g, color) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3); _c.set(color).convertSRGBToLinear();
  for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function clean(g) { // same attribute set everywhere so merges work
  const keep = ['position', 'normal', 'uv', 'color', 'unit', 'aHair'];
  for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}

// a sphere bent into a body part. fn(ux,uy,uz) returns [x,y,z]
function blob(fn, ws, hs) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const p = g.attributes.position, unit = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    // three's sphere has +Y up; our "forward" is +Z, sphere poles stay up/down which suits a body
    const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
    unit[i * 3] = ux; unit[i * 3 + 1] = uy; unit[i * 3 + 2] = uz;
    const r = fn(ux, uy, uz); p.setXYZ(i, r[0], r[1], r[2]);
  }
  g.setAttribute('unit', new THREE.BufferAttribute(unit, 3));
  g.setAttribute('aHair', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  g.computeVertexNormals();
  return g;
}

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// hairs sprouting from a surface: thin 3-sided cones
function hairsOn(baseGeo, count, len, color, { dirBias = null, along = null, tilt = 0.55, minY = -2 } = {}) {
  if (count <= 0) return null;
  const pos = baseGeo.attributes.position, nrm = baseGeo.attributes.normal;
  const parts = [];
  const cone = new THREE.ConeGeometry(1, 1, 3, 1, true); cone.translate(0, 0.5, 0);
  const tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const P = new THREE.Vector3(), N = new THREE.Vector3(), D = new THREE.Vector3();
  const idx = baseGeo.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  for (let k = 0; k < count; k++) {
    const t = Math.floor(Math.random() * triCount);
    const ia = idx ? idx.getX(t * 3) : t * 3, ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    let r1 = Math.random(), r2 = Math.random(); if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
    P.set(0, 0, 0).addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, ia), 1 - r1 - r2)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, ib), r1).addScaledVector(new THREE.Vector3().fromBufferAttribute(pos, ic), r2);
    if (P.y < minY) continue;
    N.set(0, 0, 0).addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, ia), 1 - r1 - r2)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, ib), r1).addScaledVector(new THREE.Vector3().fromBufferAttribute(nrm, ic), r2).normalize();
    D.copy(N);
    if (along) D.addScaledVector(along, tilt + Math.random() * 0.3); // lean toward the tip, like real setae
    if (dirBias) D.addScaledVector(dirBias, 0.4);
    D.x += (Math.random() - 0.5) * 0.35; D.y += (Math.random() - 0.5) * 0.35; D.z += (Math.random() - 0.5) * 0.35;
    D.normalize();
    const L = len * (0.55 + Math.random() * 0.9), R = len * 0.045;
    q.setFromUnitVectors(up, D);
    tmpM.compose(P, q, new THREE.Vector3(R, L, R));
    const h = cone.clone().applyMatrix4(tmpM);
    parts.push(h);
  }
  if (!parts.length) return null;
  const g = mergeGeometries(parts.map(p => clean(paint(addAttr(p, () => [0, 9, 0], 1), color))));
  return g;
}

// ------------------------------------------------------------------ leg segment
// built along +Y from 0 to len, joint knob at the end. Local +Z = the leg's top (dorsal) side.
function legSegment(len, r0, r1, sp, segIndex, legColor, bandColor, bandAmt, hairN, hairLen, spines, hairColor, radial) {
  const pts = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let r = r0 + (r1 - r0) * t;
    r *= 1 + 0.05 * Math.sin(Math.PI * t);         // slight muscle bulge
    if (t < 0.05) r *= 0.94 + 0.06 * (t / 0.05);   // slight neck at the joint (soft membrane)
    pts.push(new THREE.Vector2(Math.max(r, 0.0015), len * t));
  }
  pts.unshift(new THREE.Vector2(0.0001, -r0 * 0.15));
  pts.push(new THREE.Vector2(0.0001, len + r1 * 0.2));
  const g = new THREE.LatheGeometry(pts, radial);
  g.rotateY(Math.PI / radial);
  // slightly flattened sideways like real leg segments
  g.scale(0.9, 1, 1);
  // colour: joints darker/banded for some species
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  const a = new THREE.Color(legColor).convertSRGBToLinear(), b = new THREE.Color(bandColor).convertSRGBToLinear();
  for (let i = 0; i < n; i++) {
    const t = g.attributes.position.getY(i) / len;
    const band = bandAmt * (sm(0.78, 0.96, t));
    col[i * 3] = a.r + (b.r - a.r) * band; col[i * 3 + 1] = a.g + (b.g - a.g) * band; col[i * 3 + 2] = a.b + (b.b - a.b) * band;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  addAttr(g, (x, y, z) => [x / Math.max(r0, 1e-4), y / len, z / Math.max(r0, 1e-4)], 0);
  g.computeVertexNormals();
  const parts = [clean(g)];
  const axis = new THREE.Vector3(0, 1, 0);
  const hg = hairsOn(g, hairN, hairLen, hairColor, { along: axis, tilt: 0.9 });
  if (hg) parts.push(hg);
  // macrosetae: a few long stiff spines on the underside of tibia + metatarsus
  if (spines > 0 && (segIndex === 4 || segIndex === 5 || segIndex === 2)) {
    const cnt = Math.round(spines * (segIndex === 2 ? 3 : 6));
    const cone = new THREE.ConeGeometry(1, 1, 3, 1, true); cone.translate(0, 0.5, 0);
    for (let k = 0; k < cnt; k++) {
      const t = 0.15 + 0.75 * (k + Math.random() * 0.5) / cnt;
      const ang = Math.PI * (0.6 + Math.random() * 0.8) * (Math.random() < 0.5 ? -1 : 1) - Math.PI / 2; // mostly ventral (-Z)
      const r = r0 + (r1 - r0) * t;
      const P = new THREE.Vector3(Math.cos(ang) * r * 0.9, len * t, Math.sin(ang) * r);
      const D = new THREE.Vector3(Math.cos(ang), 1.6, Math.sin(ang)).normalize();
      const L = r * (2.2 + Math.random()), R = r * 0.11;
      const m = new THREE.Matrix4().compose(P, new THREE.Quaternion().setFromUnitVectors(axis, D), new THREE.Vector3(R, L, R));
      parts.push(clean(paint(addAttr(cone.clone().applyMatrix4(m), () => [0, 9, 0], 1), hairColor)));
    }
  }
  return mergeGeometries(parts);
}

// ------------------------------------------------------------------ the whole spider
export function buildSpider(sp, { quality = 'high', hairMul = 1, fear = false } = {}) {
  const hi = quality !== 'low';
  const C = sp.carapace, A = sp.abdomen, Lg = sp.legs, h = sp.stance.height;
  const root = new THREE.Group(); root.name = 'spider';
  const body = new THREE.Group(); body.name = 'body'; root.add(body);   // bobs + tilts with the gait
  const hairColor = new THREE.Color(Lg.color).lerp(new THREE.Color(0x3a2c22), 0.25).getHex();
  const mats = {
    carapace: makeChitin({ color: C.color, rough: C.rough, coat: C.coat, part: 0, pattern: C.pattern, patColor: C.pattern === 2 ? 0x3a2214 : C.pattern === 5 ? 0x150c05 : 0x1a120c, patColor2: 0xd9b07a, quality }),
    abdomen: makeChitin({ color: A.color, rough: A.rough, coat: Math.max(A.coat, 0.09), part: 1, pattern: A.pattern, patColor: A.pattern === 1 ? 0xb3120d : A.pattern === 5 ? 0x150c05 : 0x2a1a10, quality, micro: A.hair > 0.3 ? 0.2 : 0.05 }),
    legs: makeChitin({ color: Lg.color, rough: Math.max(Lg.rough, 0.46), coat: 0.4, coatAmt: 0.3, part: 2, pattern: 0, quality, micro: 0.25 }), // legs are satin (fine hairs), not chrome
    eye: new THREE.MeshPhysicalMaterial({ color: 0x050404, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.6 }),
  };
  // ---- carapace (cephalothorax shell)
  const cz = C.len * 0.5 - 0.06;          // centre along Z
  const carG = blob((x, y, z) => {
    let X = x * C.wid / 2, Y = y * C.hgt / 2, Z = z * C.len / 2;
    if (y < 0) Y *= 0.32;                                   // flat underside sits on the sternum
    const head = sm(0.05, 0.85, z);
    X *= 1 - 0.3 * head;                                    // head is narrower than the thorax (pear shape)
    if (y > 0) Y += C.head * head * y + C.hgt * 0.12 * y * (1 - Math.abs(z));
    if (y > 0) Y -= C.hgt * 0.06 * Math.exp(-((x * x) / 0.012 + ((z + 0.12) ** 2) / 0.03)) * y; // fovea (thin groove)
    if (y > 0) { const a = Math.atan2(x, z); Y -= C.hgt * 0.014 * y * (0.5 + 0.5 * Math.cos(a * 8)) * sm(0.3, 0.9, Math.hypot(x, z)); } // radial grooves
    if (z > 0.86) Z = C.len / 2 * (0.86 + (z - 0.86) * 0.45); // blunt front (clypeus)
    return [X, Y, Z];
  }, hi ? 48 : 22, hi ? 32 : 14);
  const carMesh = new THREE.Mesh(carG, mats.carapace);
  paint(carG, C.color); clean(carG);
  carMesh.position.set(0, h + C.hgt * 0.3, cz);
  carMesh.castShadow = true; carMesh.receiveShadow = true;
  body.add(carMesh);
  // sternum (belly plate under the carapace)
  const stG = blob((x, y, z) => [x * C.wid * 0.36, y * 0.018, z * C.len * 0.38], 20, 10);
  paint(stG, new THREE.Color(C.color).multiplyScalar(0.8).getHex());
  const stM = new THREE.Mesh(clean(stG), mats.carapace); stM.position.set(0, h + 0.01, cz - 0.01); body.add(stM);
  // ---- abdomen
  const az = -0.06 - 0.025 - A.len * 0.5;
  const abG = blob((x, y, z) => {
    let X = x * A.wid / 2, Y = y * A.hgt / 2, Z = z * A.len / 2;
    const rear = sm(-0.2, -1.0, z);           // 0 front .. 1 back
    X *= 1 + 0.07 * rear; Y *= 1 + 0.05 * rear;
    const front = sm(0.65, 1.0, z);           // pinches into the pedicel
    X *= 1 - 0.42 * front; Y *= 1 - 0.38 * front; Y -= A.hgt * 0.08 * front;
    if (y > 0.2) Y -= A.hgt * 0.005 * Math.exp(-(((Math.abs(x) - 0.22) ** 2) / 0.003 + ((z - 0.25) ** 2) / 0.004)); // sigilla (tiny muscle dents)
    if (y > 0.2) Y -= A.hgt * 0.004 * Math.exp(-(((Math.abs(x) - 0.18) ** 2) / 0.003 + ((z + 0.05) ** 2) / 0.004));
    if (sp.abdomen.pattern === 6) Y += A.hgt * 0.06 * Math.max(0, y) * Math.exp(-(((Math.abs(x) - 0.3) ** 2) + (z - 0.2) ** 2) / 0.03); // bark bumps
    return [X, Y, Z];
  }, hi ? 56 : 24, hi ? 40 : 16);
  paint(abG, A.color);
  const abParts = [clean(abG)];
  if (A.hair > 0 && hi) {
    const hg = hairsOn(abG, Math.round(A.hair * 900 * hairMul), Lg.hairLen * 0.9, hairColor, { dirBias: new THREE.Vector3(0, 0, -1) });
    if (hg) abParts.push(hg);
  }
  const abMesh = new THREE.Mesh(mergeGeometries(abParts), mats.abdomen);
  const abPivot = new THREE.Group(); abPivot.position.set(0, h + 0.07, -0.07); body.add(abPivot); // hinge at the pedicel
  abMesh.position.set(0, A.hgt * 0.3, az + 0.07);
  abMesh.rotation.x = -sp.stance.abdTilt;
  abMesh.castShadow = true; abMesh.receiveShadow = true;
  abPivot.add(abMesh);
  // spinnerets
  const spinG = [];
  for (const [sx, sy, sz, s] of [[-0.022, -0.004, 0, 1], [0.022, -0.004, 0, 1], [-0.012, 0.012, -0.006, 0.8], [0.012, 0.012, -0.006, 0.8], [0, -0.012, 0.008, 0.6]]) {
    const c = new THREE.CylinderGeometry(0.007 * s, 0.012 * s, 0.028 * s, 7); c.rotateX(-1.25); c.translate(sx, sy, sz);
    spinG.push(clean(paint(addAttr(c, () => [0, -1, -1], 0), new THREE.Color(A.color).multiplyScalar(1.3).getHex())));
  }
  const spin = new THREE.Mesh(mergeGeometries(spinG), mats.abdomen);
  // spinnerets sit on the abdomen's rear underside (unit-sphere point (0,-0.45,-0.89) pushed through the same shape)
  spin.position.set(0, -A.hgt / 2 * 0.4, -A.len / 2 * 0.86);
  spin.rotation.x = 0.35;
  abMesh.add(spin);
  // body hair on the carapace for hairy species
  if (A.hair > 0.5 && hi) {
    const hg = hairsOn(carG, Math.round(A.hair * 350 * hairMul), Lg.hairLen * 0.7, hairColor, { dirBias: new THREE.Vector3(0, 0, -1), minY: -0.002 });
    if (hg) { const hm = new THREE.Mesh(hg, mats.carapace); carMesh.add(hm); }
  }
  // pedicel
  const ped = new THREE.Mesh(clean(paint(addAttr(new THREE.CylinderGeometry(0.022, 0.026, 0.07, 8).rotateX(Math.PI / 2), () => [0, 0, 0], 0), C.color)), mats.carapace);
  ped.position.set(0, h + 0.07, -0.08); body.add(ped);
  // ---- eyes
  const front = cz + C.len * 0.5 * 0.86, topY = h + C.hgt * 0.3 + C.hgt * 0.5 + C.head * 0.6;
  const eyePos = [];
  const es = sp.eyes.size;
  if (sp.eyes.layout === 'jumper') {
    eyePos.push([0.034, -0.035, -0.012, 2.1], [-0.034, -0.035, -0.012, 2.1], [0.075, -0.045, -0.02, 1.0], [-0.075, -0.045, -0.02, 1.0], [0.09, -0.01, -0.09, 0.45], [-0.09, -0.01, -0.09, 0.45], [0.1, 0.0, -0.16, 0.8], [-0.1, 0.0, -0.16, 0.8]);
  } else if (sp.eyes.layout === 'dyads') {
    eyePos.push([0.02, -0.004, -0.015, 1], [-0.02, -0.004, -0.015, 1], [0.05, -0.012, -0.03, 1], [-0.05, -0.012, -0.03, 1], [0.045, -0.005, -0.05, 0.9], [-0.045, -0.005, -0.05, 0.9]);
  } else if (sp.eyes.layout === 'cluster') {
    eyePos.push([0.012, 0.012, -0.03, 1.1], [-0.012, 0.012, -0.03, 1.1], [0.028, 0.006, -0.022, 0.9], [-0.028, 0.006, -0.022, 0.9], [0.026, 0.008, -0.048, 0.8], [-0.026, 0.008, -0.048, 0.8], [0.012, 0.012, -0.05, 0.7], [-0.012, 0.012, -0.05, 0.7]);
  } else {
    eyePos.push([0.018, -0.006, -0.012, 1.15], [-0.018, -0.006, -0.012, 1.15], [0.05, -0.016, -0.02, 1], [-0.05, -0.016, -0.02, 1], [0.022, -0.002, -0.05, 0.95], [-0.022, -0.002, -0.05, 0.95], [0.058, -0.008, -0.058, 1], [-0.058, -0.008, -0.058, 1]);
  }
  const eyeG = [];
  for (const [x, y, z, s] of eyePos) {
    const e = new THREE.SphereGeometry(es * s, hi ? 14 : 8, hi ? 10 : 6); e.translate(x, topY + y - (sp.eyes.layout === 'jumper' ? 0.02 : 0), front + z);
    eyeG.push(clean(paint(addAttr(e, () => [0, 0, 0], 0), 0x030303)));
  }
  const eyes = new THREE.Mesh(mergeGeometries(eyeG), mats.eye); body.add(eyes);
  // ---- chelicerae + fangs (the fangs open when biting)
  const chel = [], fangs = [];
  for (const sx of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(sx * 0.034, h + 0.06, front - 0.02);
    const cl = 0.1 * sp.fangs.size, cr = 0.028 * sp.fangs.size;
    const prof = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push(new THREE.Vector2(cr * (1 - 0.35 * t) * (0.85 + 0.15 * Math.sin(Math.PI * t)), -cl * t)); }
    prof.unshift(new THREE.Vector2(0.0001, 0.005)); prof.push(new THREE.Vector2(0.0001, -cl - 0.004));
    const cg = new THREE.LatheGeometry(prof, hi ? 10 : 6);
    const cm = new THREE.Mesh(clean(paint(addAttr(cg, () => [0, 0, 0], 0), C.color)), mats.carapace);
    g.add(cm);
    g.rotation.x = sp.fangs.down ? -0.25 : 0.35; // tarantula-type jaws point forward, widow's hang down
    // fang: a curved tapered tube
    const fg = new THREE.Group(); fg.position.set(0, -cl * 0.92, 0.004);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-sx * 0.012, -0.03 * sp.fangs.size, 0.02), new THREE.Vector3(-sx * 0.03, -0.035 * sp.fangs.size, -0.012));
    const tg = new THREE.TubeGeometry(curve, 8, 0.0075 * sp.fangs.size, 6, false);
    const tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) { /* taper toward the tip */ const t = Math.floor(i / 7) / 8; const p = curve.getPoint(Math.min(1, t)); const v = new THREE.Vector3(tp.getX(i), tp.getY(i), tp.getZ(i)).sub(p).multiplyScalar(1 - 0.85 * t).add(p); tp.setXYZ(i, v.x, v.y, v.z); }
    tg.computeVertexNormals();
    const fm = new THREE.Mesh(clean(paint(addAttr(tg, () => [0, 0, 0], 0), 0x1b0c08)), mats.legs);
    fg.add(fm); g.add(fg);
    body.add(g); chel.push(g); fangs.push(fg);
  }
  // ---- pedipalps (5 small segments, they twitch and tap)
  const palps = [];
  for (const sx of [1, -1]) {
    const segs = [];
    const lens = [0.05, 0.035, 0.04, 0.045, 0.05];
    let parent = body;
    const base = new THREE.Group(); base.position.set(sx * 0.062, h + 0.045, front - 0.05); body.add(base); parent = base;
    for (let i = 0; i < lens.length; i++) {
      const r0 = 0.014 - i * 0.0015, r1 = 0.012 - i * 0.0015;
      const sg = legSegment(lens[i], r0, r1, sp, 1, Lg.color, Lg.band, Lg.bandAmt, Math.round(Lg.hair * 20 * hairMul * (hi ? 1 : 0)), Lg.hairLen * 0.7, 0, hairColor, hi ? 8 : 5);
      const m = new THREE.Mesh(sg, mats.legs); m.castShadow = hi;
      const j = new THREE.Group(); j.add(m);
      if (i > 0) j.position.y = lens[i - 1];
      parent.add(j); segs.push(j); parent = j;
    }
    palps.push({ side: sx, segs, base });
  }
  // ---- legs
  const legs = [];
  for (const sx of [1, -1]) {
    for (let k = 0; k < 4; k++) {
      const T = Lg.len[k];
      const segs = [];
      const radial = hi ? 9 : 5;
      for (let s = 0; s < 7; s++) {
        const len = T * LEG_FRAC[s];
        const r0 = SEG_R[s][0] * Lg.thick, r1 = SEG_R[s][1] * Lg.thick;
        const hairN = Math.round(Lg.hair * hairMul * (hi ? 1 : 0.25) * len * (s >= 4 ? 520 : 380) * (Lg.hairLen > 0.04 ? 1.6 : 1));
        const g = legSegment(len, r0, r1, sp, s, Lg.color, Lg.band, Lg.bandAmt, hairN, Lg.hairLen * (s >= 5 ? 0.8 : 1), Lg.spines, hairColor, radial);
        const m = new THREE.Mesh(g, mats.legs);
        m.castShadow = true; m.receiveShadow = false; m.matrixAutoUpdate = false;
        body.add(m);
        segs.push({ mesh: m, len });
      }
      const ha = HIP_ANG[k];
      const hip = new THREE.Vector3(sx * Math.sin(ha) * C.wid * 0.38, h + 0.03, cz - 0.01 + Math.cos(ha) * C.len * 0.36);
      const fa = FOOT_ANG[k], reach = T * FOOT_REACH[k] * sp.stance.spread;
      const rest = new THREE.Vector3(hip.x + sx * Math.sin(fa) * reach, 0, hip.z + Math.cos(fa) * reach);
      legs.push({ side: sx, pair: k, T, segs, hip, rest, group: (k % 2 === 0) === (sx > 0) ? 0 : 1 });
    }
  }
  root.userData = { mats, body, abPivot, abMesh, carMesh, chel, fangs, palps, legs, eyes, front, topY, cz, az };
  root.traverse(o => { if (o.isMesh) { o.castShadow = o.castShadow || hi; } });
  if (fear) applyFearMode(root, true);
  return root;
}

// Spider fear mode: same game, but your spider turns into a soft cartoon blob with big friendly eyes
export function applyFearMode(root, on) {
  const ud = root.userData;
  if (!ud.fearStuff) {
    const toon = new THREE.MeshToonMaterial({ color: 0x7aa6ff });
    const eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff }), eyeB = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const g = new THREE.Group();
    for (const sx of [1, -1]) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), eyeW); w.position.set(sx * 0.055, ud.topY + 0.03, ud.front - 0.03);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), eyeB); b.position.set(sx * 0.055, ud.topY + 0.035, ud.front + 0.02);
      g.add(w, b);
    }
    g.visible = false; ud.body.add(g);
    ud.fearStuff = { toon, eyes: g, orig: new Map() };
  }
  const F = ud.fearStuff;
  root.traverse(o => {
    if (!o.isMesh || o.parent === F.eyes) return;
    if (on) { if (!F.orig.has(o)) F.orig.set(o, o.material); o.material = F.toon; }
    else if (F.orig.has(o)) o.material = F.orig.get(o);
  });
  F.eyes.visible = on; ud.eyes.visible = !on;
  for (const c of ud.chel) c.visible = !on;
}

export function chitinTick(t) { for (const u of chitinUniformsList) u.uTime.value = t; }
