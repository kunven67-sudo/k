// Clothes cut from MakeHuman's fitted bodysuit helper ("tights"), so they fit every body shape:
// t-shirt, hoodie, long sleeves, jeans, shorts, sweatpants, socks and sneakers. Each piece is
// offset to its real thickness, smoothed so it drapes instead of hugging, gets a real hem (the
// fabric's edge has thickness) and a real fabric surface: jersey knit for tees, 3x1 indigo twill
// for jeans (white weft showing, lighter inside), brushed fleece for hoodies, rib knit for socks.
import * as THREE from 'three';
import { humanData } from './data.js';
import { topology, sourceNormals } from './body.js';
import { NOISE_GLSL } from './skin.js';

// ---------- garment coordinates on the base mesh (computed once) ----------
let base = null;
function garmentBase() {
  if (base) return base;
  const H = humanData(), P = H.base;
  const T = topology('tights');
  const J = H.joints.map((list) => { const c = new THREE.Vector3(); for (const v of list) c.x += P[v * 3], c.y += P[v * 3 + 1], c.z += P[v * 3 + 2]; return c.multiplyScalar(1 / list.length); });
  const bone = Object.fromEntries(H.bones.map((b) => [b.name, { head: J[b.head], tail: J[b.tail] }]));
  const names = H.bones.map((b) => b.name);
  const verts = [...new Set(T.src)];
  const n = H.nv;
  const armC = new Float32Array(n).fill(-1), legC = new Float32Array(n).fill(-1), part = new Int8Array(n).fill(-1);
  const fu = new Float32Array(n), fv = new Float32Array(n);
  const tmp = new THREE.Vector3();
  // a chain of segments: returns [coordinate along (0, 1, 2...), distance along (dm), closest segment]
  const chain = (p, pts) => {
    let best = null;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], ab = b.clone().sub(a), L = ab.length(); ab.normalize();
      const t = THREE.MathUtils.clamp(tmp.copy(p).sub(a).dot(ab) / L, i === 0 ? -0.6 : 0, i === pts.length - 2 ? 1.6 : 1);
      const d = tmp.copy(a).addScaledVector(ab, t * L).distanceTo(p);
      if (!best || d < best.d) best = { d, c: i + t, seg: i, along: t * L, axis: ab, a };
    }
    return best;
  };
  const spineTop = bone['neck01'].head, spineBot = bone['root'].head;
  for (const v of verts) {
    const p = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    const bn = names[H.skinIdx[v * 4]] || 'root';
    const side = p.x >= 0 ? 'L' : 'R';
    const isArm = /^(shoulder01|upperarm|lowerarm|wrist|finger|metacarpal)/.test(bn);
    const isLeg = /^(upperleg|lowerleg|foot|toe)/.test(bn) || (/^pelvis/.test(bn) && p.y < bone[`upperleg01.${side}`].head.y - 0.25);
    let axis, ref, a0;
    if (isArm) {
      const c = chain(p, [bone[`upperarm01.${side}`].head, bone[`lowerarm01.${side}`].head, bone[`wrist.${side}`].head, bone[`finger3-1.${side}`].head]);
      armC[v] = c.c; part[v] = side === 'L' ? 1 : 2; axis = c.axis; a0 = c.a; fv[v] = (c.along + c.seg * 3) * 100;
      ref = new THREE.Vector3(0, 0, 1);
    } else if (isLeg) {
      const c = chain(p, [bone[`upperleg01.${side}`].head, bone[`lowerleg01.${side}`].head, bone[`foot.${side}`].head, bone[`toe3-1.${side}`].head]);
      legC[v] = c.c; part[v] = side === 'L' ? 3 : 4; axis = c.axis; a0 = c.a; fv[v] = (c.along + c.seg * 5) * 100;
      ref = new THREE.Vector3(0, 0, 1);
    } else {
      part[v] = 0; axis = spineTop.clone().sub(spineBot).normalize(); a0 = spineBot; fv[v] = tmp.copy(p).sub(a0).dot(axis) * 100;
      ref = new THREE.Vector3(1, 0, 0); // the wrap (seam) sits on the left side, like a real side seam
    }
    // around the axis, in mm (angle x radius)
    const r = tmp.copy(p).sub(a0); r.addScaledVector(axis, -r.dot(axis));
    const rad = r.length();
    const x = ref.clone().addScaledVector(axis, -ref.dot(axis)).normalize(), y = axis.clone().cross(x);
    fu[v] = Math.atan2(r.dot(y), r.dot(x)) * rad * 100;
  }
  base = { armC, legC, part, fu, fv, bone, verts, J };
  return base;
}

// ---------- garment styles ----------
// each returns how far "inside" the garment a tights vertex is (>0 inside, in dm), 0 = the hem line
export const GARMENTS = {
  tee: { kind: 'knit', thick: 0.0028, smooth: 2, inside: (b, v, y) => Math.min(b.part[v] <= 2 ? 1 : -1, b.armC[v] >= 0 ? (0.42 - b.armC[v]) * 1.5 : 1, y - b.hemY + 0.1, b.neckY - y - 0.04 * b.neckFront(v)) },
  longsleeve: { kind: 'knit', thick: 0.003, smooth: 2, inside: (b, v, y) => Math.min(b.part[v] <= 2 ? 1 : -1, b.armC[v] >= 0 ? (1.94 - b.armC[v]) * 1.5 : 1, y - b.hemY + 0.1, b.neckY - y - 0.04 * b.neckFront(v)) },
  hoodie: { kind: 'fleece', thick: 0.0065, smooth: 4, inside: (b, v, y) => Math.min(b.part[v] <= 2 ? 1 : -1, b.armC[v] >= 0 ? (1.9 - b.armC[v]) * 1.5 : 1, y - b.hemY + 0.25, b.neckY - y + 0.12) },
  jeans: { kind: 'denim', thick: 0.0035, smooth: 3, inside: (b, v, y) => Math.min(b.part[v] === 1 || b.part[v] === 2 ? -1 : 1, b.part[v] >= 3 ? (1.93 - b.legC[v]) * 1.2 : 1, b.waistY - y) },
  shorts: { kind: 'twill', thick: 0.003, smooth: 3, inside: (b, v, y) => Math.min(b.part[v] === 1 || b.part[v] === 2 ? -1 : 1, b.part[v] >= 3 ? (0.58 - b.legC[v]) * 1.2 : 1, b.waistY - y) },
  sweats: { kind: 'fleece', thick: 0.005, smooth: 4, inside: (b, v, y) => Math.min(b.part[v] === 1 || b.part[v] === 2 ? -1 : 1, b.part[v] >= 3 ? (1.9 - b.legC[v]) * 1.2 : 1, b.waistY - y + 0.05) },
  socks: { kind: 'rib', thick: 0.0018, smooth: 1, inside: (b, v) => (b.part[v] >= 3 ? b.legC[v] - 1.72 : -1) },
  shoe: { kind: 'shoe', thick: 0.006, smooth: 7, inside: (b, v) => (b.part[v] >= 3 ? b.legC[v] - 1.86 : -1) },
};

const FAB_VERT = /* glsl */`
attribute vec2 aFab;
varying vec2 vFab;
varying vec3 vFabP;
`;
const FAB_FRAG_PRE = /* glsl */`
varying vec2 vFab;   // fabric coordinates in mm: around, along
varying vec3 vFabP;
uniform float uObjScaleF;
uniform float uWear;
uniform float uDirt;
uniform vec3 uWeft;
${NOISE_GLSL}
float gFabH; float gFabRough;
`;
// patterns: height (mm-ish units) + color tweaks. fw = mm per pixel
const FAB_FRAG = /* glsl */`
{
  vec2 q = vFab;
  float fw = max(length(dFdx(q)), length(dFdy(q)));
  float detail = 1.0 - smoothstep(0.25, 0.9, fw);
  float h = 0.0; vec3 col = diffuseColor.rgb;
  float nz = sk_vnoise(vec3(q * 0.08, 1.0));
  #if FAB_KIND == 0
    // jersey knit: little V-shaped loops, ~0.9 mm wide, ~0.7 mm tall
    vec2 s = q / vec2(0.9, 0.7);
    vec2 f = fract(s) - 0.5; float leg = abs(abs(f.x) - (0.25 - f.y * 0.35));
    h = (1.0 - smoothstep(0.05, 0.22, leg)) * 0.12;
    col *= 0.94 + 0.08 * sk_vnoise(vec3(s * 0.5, 2.0)) + 0.05 * (h / 0.12);
  #elif FAB_KIND == 1
    // denim: 3x1 right-hand twill, indigo warp along the leg, white weft peeking through
    float d = (q.x * 0.707 + q.y * 0.707) / 0.75;
    float rib = 0.5 + 0.5 * sin(d * 6.2832);
    float slub = sk_vnoise(vec3(q.x * 0.6, q.y * 0.05, 3.0));
    h = rib * 0.1 + slub * 0.03;
    float weft = smoothstep(0.75, 0.95, 1.0 - rib) * 0.35;
    col = mix(col * (0.85 + 0.3 * slub), uWeft, weft * detail * 0.6 + 0.06 * (1.0 - detail));
    // fading where it rubs: front of the thighs, knees
    col = mix(col, mix(col, uWeft, 0.18), uWear * smoothstep(0.6, 0.9, sk_vnoise(vec3(q * 0.012, 4.0))));
  #elif FAB_KIND == 2
    // brushed fleece: soft fuzzy surface, a faint knit underneath
    h = sk_vnoise(vec3(q * 1.6, 5.0)) * 0.06 + sk_vnoise(vec3(q * 4.0, 6.0)) * 0.03;
    col *= 0.95 + 0.08 * sk_vnoise(vec3(q * 0.4, 7.0));
  #elif FAB_KIND == 3
    // twill (khaki / chino shorts)
    float d = (q.x * 0.707 + q.y * 0.707) / 0.55;
    h = (0.5 + 0.5 * sin(d * 6.2832)) * 0.07;
    col *= 0.95 + 0.08 * sk_vnoise(vec3(q * 0.3, 8.0));
  #else
    // rib knit (socks, cuffs): vertical ribs ~2 mm
    h = (0.5 + 0.5 * sin(q.x / 2.0 * 6.2832)) * 0.25 + sk_vnoise(vec3(q * 1.2, 9.0)) * 0.03;
    col *= 0.93 + 0.1 * (h / 0.25);
  #endif
  // dirt + pilling from wear
  col *= 1.0 - uDirt * smoothstep(0.5, 0.9, sk_vnoise(vec3(q * 0.02, 11.0))) * 0.25;
  col *= 0.97 + 0.06 * nz;
  diffuseColor.rgb = col;
  gFabH = h * detail;
  gFabRough = 0.0;
}
`;
const FAB_NORMAL = /* glsl */`
  normal = sk_bump(-vViewPosition, normal, gFabH * 0.001 * uObjScaleF);
`;

const KINDS = { knit: 0, denim: 1, fleece: 2, twill: 3, rib: 4 };
export function createFabricMaterial(kind, color) {
  const c = new THREE.Color(color);
  const sheen = { knit: 0.45, denim: 0.25, fleece: 0.9, twill: 0.3, rib: 0.5 }[kind];
  const mat = new THREE.MeshPhysicalMaterial({ color: c, roughness: kind === 'denim' ? 0.82 : 0.9, sheen, sheenRoughness: kind === 'fleece' ? 0.75 : 0.6, sheenColor: c.clone().lerp(new THREE.Color(1, 1, 1), 0.25), side: THREE.FrontSide });
  mat.defines = { FAB_KIND: KINDS[kind] };
  const u = mat.userData.u = { uObjScaleF: { value: 1 }, uWear: { value: 0.5 }, uDirt: { value: 0.15 }, uWeft: { value: new THREE.Color(kind === 'denim' ? 0xd8d4c8 : 0xffffff) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = FAB_VERT + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFab = aFab; vFabP = position;');
    sh.fragmentShader = FAB_FRAG_PRE + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FAB_FRAG)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FAB_NORMAL);
  };
  mat.customProgramCacheKey = () => 'mh-fabric-' + kind;
  return mat;
}

/** Build one garment for a body shape. Returns a BufferGeometry (skin-ready) + the tights vertices it covers. */
export function garmentGeometry(shape, style, under = []) {
  const H = humanData(), b = garmentBase(), G = GARMENTS[style];
  const T = topology('tights');
  const P = shape.pos, k = shape.k; // shape positions are in model units; garment logic is in base dm
  // body landmarks (base dm): hem, waist, neckline
  const J = b.J; const bn = b.bone;
  b.hemY = bn['upperleg01.L'].head.y + 0.2;
  b.waistY = bn['spine04'].head.y + 0.1;
  b.neckY = bn['neck01'].head.y - 0.05;
  b.neckFront = (v) => THREE.MathUtils.clamp((H.base[v * 3 + 2] - bn['neck01'].head.z) / 0.5, 0, 1) * 4;
  void J;
  const inside = new Map();
  for (const v of b.verts) inside.set(v, G.inside(b, v, H.base[v * 3 + 1]));
  // faces (source-vertex triangles) that touch the garment
  const tri = T.stri; const faces = [];
  for (let i = 0; i < tri.length; i += 3) {
    const a = tri[i], c = tri[i + 1], d = tri[i + 2];
    if (inside.get(a) > 0 || inside.get(c) > 0 || inside.get(d) > 0) faces.push(a, c, d);
  }
  // local vertices
  const local = new Map(), srcList = [];
  for (const v of faces) if (!local.has(v)) { local.set(v, srcList.length); srcList.push(v); }
  const n = srcList.length;
  const pos = new Float32Array(n * 3);
  for (let l = 0; l < n; l++) { const s = srcList[l]; pos[l * 3] = P[s * 3]; pos[l * 3 + 1] = P[s * 3 + 1]; pos[l * 3 + 2] = P[s * 3 + 2]; }
  // pull each outside vertex onto the hem line along its steepest edge into the garment
  const best = new Map();
  const HB = H.base;
  for (let i = 0; i < faces.length; i += 3) for (let e = 0; e < 3; e++) {
    const o = faces[i + e], fo = inside.get(o); if (fo > 0) continue;
    for (const w of [faces[i + (e + 1) % 3], faces[i + (e + 2) % 3]]) {
      const fi = inside.get(w); if (!(fi > 0)) continue;
      const dist = Math.hypot(HB[o * 3] - HB[w * 3], HB[o * 3 + 1] - HB[w * 3 + 1], HB[o * 3 + 2] - HB[w * 3 + 2]) || 1e-6;
      const slope = (fi - fo) / dist, cur = best.get(o);
      if (!cur || slope > cur.slope) best.set(o, { slope, w, t: fi / (fi - fo) });
    }
  }
  const onHem = new Uint8Array(n);
  for (const [o, { w, t }] of best) {
    const lo = local.get(o);
    for (let c = 0; c < 3; c++) pos[lo * 3 + c] = P[w * 3 + c] + (P[o * 3 + c] - P[w * 3 + c]) * t;
    onHem[lo] = 1;
  }
  const index = new Uint32Array(faces.length); for (let i = 0; i < faces.length; i++) index[i] = local.get(faces[i]);
  // normals, then thickness offset and smoothing (fabric drapes over small body details)
  const nrm = new Float32Array(n * 3);
  const accN = () => { nrm.fill(0); sourceNormals(pos, index, nrm); for (let l = 0; l < n; l++) { const x = nrm[l * 3], y = nrm[l * 3 + 1], z = nrm[l * 3 + 2], L = Math.hypot(x, y, z) || 1; nrm[l * 3] = x / L; nrm[l * 3 + 1] = y / L; nrm[l * 3 + 2] = z / L; } };
  accN();
  const thick = G.thick * 1.0;
  // layers: a top worn over pants sits outside them where they overlap
  const extra = new Float32Array(n);
  for (const us of under) {
    const U = GARMENTS[us];
    for (let l = 0; l < n; l++) { const sv = srcList[l]; const iu = U.inside(b, sv, H.base[sv * 3 + 1]); extra[l] = Math.max(extra[l], THREE.MathUtils.smoothstep(iu, -0.2, 0.05) * (U.thick + 0.0025)); }
  }
  for (let l = 0; l < n; l++) for (let c = 0; c < 3; c++) pos[l * 3 + c] += nrm[l * 3 + c] * (thick + 0.0015 + extra[l]);
  // neighbours
  const nb = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < index.length; i += 3) for (let e = 0; e < 3; e++) { const a = index[i + e], c = index[i + (e + 1) % 3]; nb[a].add(c); nb[c].add(a); }
  for (let it = 0; it < 3; it++) {
    const np = Float32Array.from(pos);
    for (let l = 0; l < n; l++) {
      if (onHem[l] !== 1) continue; let cnt = 0, sx = 0, sy = 0, sz = 0;
      for (const m of nb[l]) if (onHem[m] === 1) { sx += pos[m * 3]; sy += pos[m * 3 + 1]; sz += pos[m * 3 + 2]; cnt++; }
      if (cnt >= 2) { np[l * 3] = pos[l * 3] * 0.5 + sx / cnt * 0.5; np[l * 3 + 1] = pos[l * 3 + 1] * 0.5 + sy / cnt * 0.5; np[l * 3 + 2] = pos[l * 3 + 2] * 0.5 + sz / cnt * 0.5; }
    }
    pos.set(np);
  }
  for (let it = 0; it < G.smooth; it++) {
    const np = Float32Array.from(pos);
    for (let l = 0; l < n; l++) {
      if (onHem[l] === 1) continue; let cnt = 0, sx = 0, sy = 0, sz = 0;
      for (const m of nb[l]) { sx += pos[m * 3]; sy += pos[m * 3 + 1]; sz += pos[m * 3 + 2]; cnt++; }
      if (!cnt) continue;
      // smooth, but never sink back toward the body: only keep the tangential part + outward bulge
      const dx = sx / cnt - pos[l * 3], dy = sy / cnt - pos[l * 3 + 1], dz = sz / cnt - pos[l * 3 + 2];
      const dn = dx * nrm[l * 3] + dy * nrm[l * 3 + 1] + dz * nrm[l * 3 + 2];
      const kk = 0.5, inward = Math.min(0, dn);
      np[l * 3] += (dx - nrm[l * 3] * inward) * kk; np[l * 3 + 1] += (dy - nrm[l * 3 + 1] * inward) * kk; np[l * 3 + 2] += (dz - nrm[l * 3 + 2] * inward) * kk;
    }
    pos.set(np);
  }
  accN();
  // hem rim: the fabric's edge has thickness (boundary edges folded back toward the body)
  const edgeCount = new Map();
  for (let i = 0; i < index.length; i += 3) for (let e = 0; e < 3; e++) {
    const a = index[i + e], c = index[i + (e + 1) % 3]; const key = a < c ? a * 1e6 + c : c * 1e6 + a;
    edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
  }
  const rimVerts = new Map(); const extraPos = [], extraSrc = [], extraIdx = [];
  const rimOf = (l) => {
    if (rimVerts.has(l)) return rimVerts.get(l);
    const id = n + extraSrc.length; rimVerts.set(l, id);
    extraPos.push(pos[l * 3] - nrm[l * 3] * (thick + 0.002), pos[l * 3 + 1] - nrm[l * 3 + 1] * (thick + 0.002), pos[l * 3 + 2] - nrm[l * 3 + 2] * (thick + 0.002));
    extraSrc.push(srcList[l]); return id;
  };
  for (let i = 0; i < index.length; i += 3) for (let e = 0; e < 3; e++) {
    const a = index[i + e], c = index[i + (e + 1) % 3]; const key = a < c ? a * 1e6 + c : c * 1e6 + a;
    if (edgeCount.get(key) !== 1) continue;
    const ra = rimOf(a), rc = rimOf(c);
    extraIdx.push(c, a, ra, c, ra, rc); // facing outward like the edge's triangle
  }
  const N2 = n + extraSrc.length;
  const allPos = new Float32Array(N2 * 3); allPos.set(pos); allPos.set(extraPos, n * 3);
  const allSrc = new Uint16Array(N2); allSrc.set(srcList); allSrc.set(extraSrc, n);
  const allIdx = new Uint32Array(index.length + extraIdx.length); allIdx.set(index); allIdx.set(extraIdx, index.length);
  const g = new THREE.BufferGeometry();
  g.setIndex(new THREE.BufferAttribute(N2 < 65536 ? Uint16Array.from(allIdx) : allIdx, 1));
  g.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
  g.computeVertexNormals();
  const fab = new Float32Array(N2 * 2), si = new Uint16Array(N2 * 4), sw = new Float32Array(N2 * 4);
  for (let l = 0; l < N2; l++) {
    const s = allSrc[l]; fab[l * 2] = b.fu[s]; fab[l * 2 + 1] = b.fv[s];
    for (let q = 0; q < 4; q++) { si[l * 4 + q] = H.skinIdx[s * 4 + q]; sw[l * 4 + q] = H.skinW[s * 4 + q] / 255; }
  }
  g.setAttribute('aFab', new THREE.BufferAttribute(fab, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.userData.covers = new Set([...inside].filter(([, x]) => x > 0.06).map(([v]) => v));
  void k;
  return g;
}

// which body vertices sit under the clothes (so their triangles can be skipped: no poke-through)
let nearest = null;
export function bodyCoverMap() {
  if (nearest) return nearest;
  const H = humanData(), P = H.base;
  const tv = [...new Set(topology('tights').src)];
  const bv = [...new Set(topology('body').src)];
  // uniform grid over the tights vertices
  const cell = 0.25, grid = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (const v of tv) { const k = key(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]); (grid.get(k) || grid.set(k, []).get(k)).push(v); }
  nearest = new Int32Array(H.nv).fill(-1);
  for (const v of bv) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    let best = 0.12 * 0.12, bi = -1; // only body points within 1.2 cm of the suit count
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const list = grid.get(`${cx + i},${cy + j},${cz + k}`); if (!list) continue;
      for (const t of list) { const d = (P[t * 3] - x) ** 2 + (P[t * 3 + 1] - y) ** 2 + (P[t * 3 + 2] - z) ** 2; if (d < best) { best = d; bi = t; } }
    }
    nearest[v] = bi;
  }
  return nearest;
}

/** Body index buffer without the triangles fully hidden under the given garments. */
export function visibleBodyIndex(garmentGeos) {
  const near = bodyCoverMap();
  const covered = (s) => { const t = near[s]; if (t < 0) return false; for (const g of garmentGeos) if (g.userData.covers.has(t)) return true; return false; };
  const T = topology('body'); const idx = T.index.array, out = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = T.src[idx[i]], b = T.src[idx[i + 1]], c = T.src[idx[i + 2]];
    if (covered(a) && covered(b) && covered(c)) continue;
    out.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  return new THREE.BufferAttribute(Uint16Array.from(out), 1);
}
