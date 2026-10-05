// Facial expressions: MakeHuman's expression shapes (blink, smile, frown, brows, mouth open...)
// packed into ONE shared texture that every person's face reads in the vertex shader, so dozens of
// people can blink and talk without each carrying its own copy of the data.
import * as THREE from 'three';
import { humanData } from './data.js';
import { topology } from './body.js';

export const EXPR = [
  'eye-left-closure', 'eye-right-closure', 'eye-left-opened-up', 'eye-right-opened-up', 'eye-left-slit', 'eye-right-slit',
  'eyebrows-left-down', 'eyebrows-right-down', 'eyebrows-left-inner-up', 'eyebrows-right-inner-up', 'eyebrows-left-up', 'eyebrows-right-up',
  'mouth-open', 'mouth-corner-puller', 'mouth-depression', 'mouth-pursing', 'mouth-retraction', 'mouth-elevation', 'nose-compression', 'mouth-compression',
];
export const NEXPR = EXPR.length;
export const E = Object.fromEntries(EXPR.map((n, i) => [n, i]));
const W = 1024;

let shared = null;
function exprShared() {
  if (shared) return shared;
  const H = humanData();
  const slotOf = new Int32Array(H.nv).fill(-1); let slots = 0;
  const T = EXPR.map((n) => H.target('x/' + n));
  for (const t of T) if (t) for (const v of t.idx) if (slotOf[v] < 0) slotOf[v] = slots++;
  const rows = Math.ceil(slots / W);
  const data = new Float32Array(W * rows * NEXPR * 4);
  T.forEach((t, e) => {
    if (!t) return;
    for (let i = 0; i < t.idx.length; i++) {
      const s = slotOf[t.idx[i]], x = s % W, y = Math.floor(s / W) + e * rows, o = (y * W + x) * 4;
      data[o] = t.d[i * 3]; data[o + 1] = t.d[i * 3 + 1]; data[o + 2] = t.d[i * 3 + 2];
    }
  });
  const tex = new THREE.DataTexture(data, W, rows * NEXPR, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  shared = { slotOf, rows, tex, attrs: {} };
  return shared;
}

/** per-vertex slot attribute for a mesh group (shared by everyone) */
export function exprAttribute(group) {
  const S = exprShared();
  if (S.attrs[group]) return S.attrs[group];
  const t = topology(group); const a = new Float32Array(t.n);
  for (let l = 0; l < t.n; l++) a[l] = S.slotOf[t.src[l]];
  return (S.attrs[group] = new THREE.BufferAttribute(a, 1));
}

const VERT_PRE = /* glsl */`
attribute float aExpr;
uniform sampler2D uExprTex;
uniform float uExprW[${NEXPR}];
uniform float uExprScale;
uniform int uExprRows;
`;
const VERT_MAIN = /* glsl */`
if (aExpr >= 0.0) {
  int s = int(aExpr + 0.5); ivec2 b = ivec2(s % ${W}, s / ${W});
  vec3 eo = vec3(0.0);
  for (int e = 0; e < ${NEXPR}; e++) { float w = uExprW[e]; if (w != 0.0) eo += w * texelFetch(uExprTex, b + ivec2(0, e * uExprRows), 0).xyz; }
  transformed += eo * uExprScale;
}
`;

/** Adds expression support to a material (chains with any existing onBeforeCompile). */
export function withExpressions(mat, weights, scale) {
  const S = exprShared();
  const u = { uExprTex: { value: S.tex }, uExprW: { value: weights }, uExprScale: { value: scale }, uExprRows: { value: S.rows } };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERT_PRE + sh.vertexShader.replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\n' + VERT_MAIN);
  };
  const key = mat.customProgramCacheKey?.() || '';
  mat.customProgramCacheKey = () => key + '+expr';
  return u;
}
