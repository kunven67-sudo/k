// Real eyes: an eyeball with a bulging clear cornea (IOR 1.376) that refracts the iris behind it
// (so the iris shifts as you move and the shine slides across it), a detailed procedural iris
// (radial fibers, crypts, the collarette ring, a dark limbal ring), a pupil that opens in the dark
// (2-8 mm) and a not-quite-white sclera with faint vessels.
import * as THREE from 'three';
import { NOISE_GLSL } from './skin.js';

const geoCache = new Map();
function eyeGeometry(R) {
  const key = R.toFixed(6);
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.SphereGeometry(R, 64, 40);
  g.rotateX(Math.PI / 2); // poles on Z: the front of the eye looks down +Z
  const p = g.attributes.position, v = new THREE.Vector3();
  const thC = 0.68; // cornea edge (rad from the front)
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const th = Math.acos(THREE.MathUtils.clamp(v.z / R, -1, 1));
    if (th < thC) { const k = 1 - (th / thC) ** 2; v.multiplyScalar(1 + 0.075 * k * k); p.setXYZ(i, v.x, v.y, v.z); }
  }
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

const VERT_PRE = /* glsl */`
varying vec3 vEyeP;
varying vec3 vEyeV;
`;
const VERT_MAIN = /* glsl */`
vEyeP = position;
vEyeV = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz - position;
`;
const FRAG_PRE = /* glsl */`
varying vec3 vEyeP;
varying vec3 vEyeV;
uniform float uR;          // eyeball radius (model units)
uniform float uPupil;      // pupil radius as a fraction of the iris radius
uniform vec3 uIris;        // iris base color
uniform vec3 uIris2;       // iris accent (collarette / flecks)
uniform float uSeedE;
uniform float uLid;        // how much the upper lid shades the eye
${NOISE_GLSL}
vec3 eyeIris(vec2 q) {
  float r = length(q); float a = atan(q.y, q.x);
  vec3 cs = vec3(cos(a), sin(a), 0.0);
  float fib = sk_vnoise(cs * 9.0 + vec3(0.0, 0.0, r * 2.5 + uSeedE)) * 0.55 + sk_vnoise(cs * 31.0 + vec3(0.0, 0.0, r * 6.0 + uSeedE * 3.0)) * 0.45;
  vec3 c = uIris * (0.62 + 0.75 * fib);
  // collarette: lighter, warmer ring around the pupil
  float col = smoothstep(0.18, 0.0, abs(r - (uPupil + 0.17))) * (0.6 + 0.4 * sk_vnoise(cs * 14.0 + uSeedE));
  c = mix(c, uIris2, col * 0.6);
  // crypts: small dark pits
  vec3 cc = sk_cell(vec3(q * 9.0, uSeedE * 5.0));
  c *= 1.0 - smoothstep(0.32, 0.12, cc.x) * step(cc.z, 0.35) * smoothstep(0.95, 0.5, r) * 0.45;
  // dark limbal ring at the outer edge
  c *= mix(1.0, 0.28, smoothstep(0.72, 0.98, r));
  // pupil (slightly soft edge)
  c = mix(c, vec3(0.006), smoothstep(uPupil + 0.02, uPupil - 0.015, r));
  return c;
}
`;
const FRAG_COLOR = /* glsl */`
{
  vec3 P = vEyeP / uR;                 // unit eyeball, +Z forward
  vec3 Vd = normalize(vEyeV);
  float irisR = 0.5, zI = 0.78;        // iris radius and plane (unit sphere)
  float th = acos(clamp(normalize(P).z, -1.0, 1.0));
  vec3 col;
  // sclera: warm off-white, faint vessels toward the corners, darker deep in the socket
  float side = abs(P.x);
  float ves = smoothstep(0.6, 0.95, sk_vnoise(P * 18.0 + uSeedE)) * smoothstep(0.25, 0.75, side) * (1.0 - smoothstep(0.55, 0.0, th));
  vec3 scl = vec3(0.86, 0.82, 0.78) * (0.97 + 0.05 * sk_vnoise(P * 9.0));
  scl = mix(scl, vec3(0.75, 0.32, 0.3), ves * 0.35);
  scl = mix(scl, vec3(0.86, 0.7, 0.68), smoothstep(0.55, 0.95, side) * 0.25);
  col = scl;
  if (P.z > 0.55) {
    // refract the view ray through the cornea onto the iris plane
    vec3 n = normalize(P * vec3(1.0, 1.0, 1.0));
    vec3 dir = refract(-Vd, n, 1.0 / 1.376);
    float t = (zI - P.z) / min(dir.z, -0.05);
    vec3 q = P + dir * t;
    vec2 iq = q.xy / irisR;
    float ir = length(iq);
    vec3 irc = eyeIris(iq);
    float inIris = smoothstep(1.03, 0.97, ir);
    // where the view ray misses the iris it lands on the white
    col = mix(scl, irc, inIris * smoothstep(0.5, 0.62, P.z));
  }
  // the upper lid shades the top of the eye; the socket darkens the edges
  col *= mix(1.0, 0.55, uLid * smoothstep(0.15, 0.7, P.y));
  col *= mix(1.0, 0.7, smoothstep(0.55, 0.95, side) * 0.6);
  diffuseColor.rgb = col;
}
`;

export function createEyeMaterial({ iris = '#4a3121', seed = 0 } = {}) {
  const c = new THREE.Color(iris);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.025, ior: 1.376, specularIntensity: 0.6 });
  const accent = c.clone().lerp(new THREE.Color(0.62, 0.45, 0.22), 0.35).multiplyScalar(1.15);
  const u = mat.userData.u = {
    uR: { value: 0.0125 }, uPupil: { value: 0.32 }, uIris: { value: c }, uIris2: { value: accent },
    uSeedE: { value: (seed % 97) * 0.731 }, uLid: { value: 0.8 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERT_PRE + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_MAIN);
    sh.fragmentShader = FRAG_PRE + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR);
  };
  mat.customProgramCacheKey = () => 'mh-eye-1';
  return mat;
}

export function createEye(R, mat) {
  mat.userData.u.uR.value = R;
  const m = new THREE.Mesh(eyeGeometry(R), mat);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

// pupil size from how bright it is (lux-ish 0..1 brightness) -> fraction of iris radius
export function pupilFor(brightness) {
  const mm = THREE.MathUtils.lerp(7.5, 2.2, THREE.MathUtils.clamp(brightness, 0, 1));
  return mm / 2 / 6; // pupil radius / iris radius (iris ~ 12 mm across)
}

// Eyelashes on MakeHuman's lash strips: each strip gets ~70 (upper) or ~35 (lower) curved, tapering
// lashes drawn in the shader, so they follow the eyelids when blinking.
export function createLashMaterial(topo, color = '#120c08') {
  // the two strips of each eye live in two separate uv islands; find their bounds
  const uv = topo.uv.array, vs = [];
  for (let i = 1; i < uv.length; i += 2) vs.push(uv[i]);
  const mid = (Math.min(...vs) + Math.max(...vs)) / 2;
  const b = [[1e9, -1e9, 1e9, -1e9], [1e9, -1e9, 1e9, -1e9]];
  for (let i = 0; i < uv.length; i += 2) { const k = uv[i + 1] > mid ? 0 : 1; const B = b[k]; B[0] = Math.min(B[0], uv[i]); B[1] = Math.max(B[1], uv[i]); B[2] = Math.min(B[2], uv[i + 1]); B[3] = Math.max(B[3], uv[i + 1]); }
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, side: THREE.DoubleSide, alphaTest: 0.35 });
  mat.alphaToCoverage = true;
  const u = mat.userData.u = { uLash0: { value: new THREE.Vector4(...b[0]) }, uLash1: { value: new THREE.Vector4(...b[1]) }, uMid: { value: mid } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec2 vLashUv;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLashUv = uv;');
    sh.fragmentShader = `varying vec2 vLashUv; uniform vec4 uLash0; uniform vec4 uLash1; uniform float uMid;\n${NOISE_GLSL}\n` + sh.fragmentShader.replace('#include <alphatest_fragment>', `
    {
      bool lower = vLashUv.y > uMid;           // the strip below the eye
      vec4 B = lower ? uLash0 : uLash1;
      float u = (vLashUv.x - B.x) / (B.y - B.x), v = (vLashUv.y - B.z) / (B.w - B.z);
      float t = lower ? 1.0 - v : v;           // 0 at the lid, 1 at the tips
      float N = lower ? 30.0 : 56.0;
      float x = u * N, a = 0.0;
      for (int k = -1; k <= 1; k++) {
        float cell = floor(x) + float(k); vec3 h = sk_hash(vec3(cell, lower ? 7.0 : 3.0, 1.0));
        float len = (0.55 + 0.45 * h.z) * (0.7 + 0.3 * sin(3.14159 * clamp(u, 0.0, 1.0))) * (lower ? 0.55 : 1.0);
        float c = cell + 0.5 + (h.x - 0.5) * 0.7 + t * (h.y - 0.5) * 1.6 + t * t * (u - 0.5) * 2.0;
        float w = mix(lower ? 0.22 : 0.42, 0.08, clamp(t / len, 0.0, 1.0));
        a = max(a, smoothstep(w, w * 0.35, abs(x - c)) * step(t, len));
      }
      diffuseColor.a *= a;
    }
    #include <alphatest_fragment>`);
  };
  mat.customProgramCacheKey = () => 'mh-lash-1';
  return mat;
}
