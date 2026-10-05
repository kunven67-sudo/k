// Per-vertex skin "regions" for the shader, found once from the base mesh: where the lips, ears,
// nostrils, eyelids, brows, scalp, palms/soles, knuckles and fingernails are. Uses MakeHuman's own
// targets (a target that moves only the ears tells us which vertices ARE the ears) and the bones.
import * as THREE from 'three';
import { humanData } from './data.js';
import { topology } from './body.js';

let cache = null;

function targetMask(H, name, lo, hi) {
  const out = new Map(); const t = H.target(name); if (!t) return out;
  let mx = 0; const mag = new Float32Array(t.idx.length);
  for (let i = 0; i < t.idx.length; i++) { mag[i] = Math.hypot(t.d[i * 3], t.d[i * 3 + 1], t.d[i * 3 + 2]); mx = Math.max(mx, mag[i]); }
  for (let i = 0; i < t.idx.length; i++) { const m = THREE.MathUtils.smoothstep(mag[i] / mx, lo, hi); if (m > 0) out.set(t.idx[i], m); }
  return out;
}

export function skinRegions() {
  if (cache) return cache;
  const H = humanData(), P = H.base, nv = H.nv;
  const topo = topology('body');
  // ---- source-vertex fields ----
  const red = new Float32Array(nv), pores = new Float32Array(nv).fill(0.18), thin = new Float32Array(nv), lips = new Float32Array(nv);
  const browT = new Float32Array(nv).fill(-1), browS = new Float32Array(nv);
  const brow = new Float32Array(nv), scalp = new Float32Array(nv), palm = new Float32Array(nv), ear = new Float32Array(nv);
  const nailU = new Float32Array(nv).fill(-1), nailD = new Float32Array(nv), nailL = new Float32Array(nv);
  const put = (arr, m, k = 1, mode = 'max') => { for (const [v, x] of m) arr[v] = mode === 'max' ? Math.max(arr[v], x * k) : arr[v] + x * k; };
  const lipM = targetMask(H, 'd/mouth-upperlip-volume-incr', 0.12, 0.45); for (const [v, x] of targetMask(H, 'd/mouth-lowerlip-volume-incr', 0.12, 0.45)) lipM.set(v, Math.max(lipM.get(v) || 0, x));
  const earM = new Map([...targetMask(H, 'd/l-ear-trans-up', 0.5, 0.95), ...targetMask(H, 'd/r-ear-trans-up', 0.5, 0.95)]);
  const noseM = targetMask(H, 'd/nose-trans-up', 0.3, 0.9);
  const nostrilM = targetMask(H, 'd/nose-nostrils-width-incr', 0.2, 0.7);
  const tipM = targetMask(H, 'd/nose-point-up', 0.3, 0.9);
  const cheekM = new Map([...targetMask(H, 'd/l-cheek-trans-up', 0.05, 0.6), ...targetMask(H, 'd/r-cheek-trans-up', 0.05, 0.6)]);
  const foreM = targetMask(H, 'd/forehead-trans-forward', 0.15, 0.6);
  const chinM = targetMask(H, 'd/chin-height-incr', 0.4, 0.95);
  const lidM = new Map([...targetMask(H, 'x/eye-left-closure', 0.08, 0.4), ...targetMask(H, 'x/eye-right-closure', 0.08, 0.4)]);
  const browM = targetMask(H, 'd/eyebrows-trans-up', 0.02, 0.5);
  put(lips, lipM);
  put(ear, earM); put(red, earM, 0.45); put(thin, earM, 1);
  put(red, noseM, 0.3); put(red, tipM, 0.55); put(thin, nostrilM, 0.75);
  put(red, cheekM, 0.55); put(red, lipM, 1); put(red, lidM, 0.25); put(red, chinM, 0.15);
  put(thin, lidM, 0.7);
  // eyebrows: an arched band above each eye (the brow target alone also covers the forehead)
  for (const eg of ['eyeL', 'eyeR']) {
    const ev = [...new Set(topology(eg).src)];
    const c = [0, 1, 2].map((k) => ev.reduce((s2, v) => s2 + P[v * 3 + k], 0) / ev.length);
    const side = Math.sign(c[0]) || 1;
    for (const [v, bm] of browM) {
      const dx = (P[v * 3] - c[0]) * side, dy = P[v * 3 + 1] - c[1], dz = P[v * 3 + 2] - c[2];
      if (dz < -0.05) continue;
      const t = (dx + 0.17) / 0.43;
      const yc = 0.185 + 0.045 * Math.sin(Math.min(1, Math.max(0, t)) * Math.PI * 0.85) - 0.025 * t;
      const hh = 0.042 * (1 - 0.55 * Math.min(1, Math.max(0, t)));
      const m = THREE.MathUtils.smoothstep(hh - Math.abs(dy - yc), -0.01, hh * 0.45) * THREE.MathUtils.smoothstep(t, -0.04, 0.06) * THREE.MathUtils.smoothstep(1.06 - t, 0, 0.12);
      const mm = m * THREE.MathUtils.smoothstep(bm, 0.0, 0.25);
      if (Math.abs(dy - yc) < hh * 1.6 && t > -0.1 && t < 1.15 && mm >= brow[v]) { browT[v] = t; browS[v] = (dy - yc) / hh; }
      if (mm > 0) brow[v] = Math.max(brow[v], mm);
    }
  }
  // pores: T-zone (nose, forehead, chin) > cheeks > rest of face > body; none on lips/eyelids
  const face = new Map([...foreM, ...cheekM, ...chinM, ...noseM]);
  for (const [v, x] of face) pores[v] = Math.max(pores[v], 0.45 + 0.2 * x);
  for (const [v, x] of noseM) pores[v] = Math.max(pores[v], 0.6 + 0.4 * x);
  for (const [v, x] of foreM) pores[v] = Math.max(pores[v], 0.5 + 0.35 * x);
  for (const [v, x] of chinM) pores[v] = Math.max(pores[v], 0.5 + 0.3 * x);
  for (const [v, x] of lipM) pores[v] *= 1 - x;
  for (const [v, x] of lidM) pores[v] *= 1 - 0.85 * x;
  // ---- joints in the base mesh ----
  const J = H.joints.map((list) => { const c = new THREE.Vector3(); for (const v of list) c.x += P[v * 3], c.y += P[v * 3 + 1], c.z += P[v * 3 + 2]; return c.multiplyScalar(1 / list.length); });
  const bone = Object.fromEntries(H.bones.map((b, i) => [b.name, { i, head: J[b.head], tail: J[b.tail] }]));
  // dominant bone per vertex
  const dom = new Int16Array(nv); for (let v = 0; v < nv; v++) dom[v] = H.skinIdx[v * 4];
  const nameOf = H.bones.map((b) => b.name);
  // vertex normals of the base mesh (for palm/sole + nails)
  const nrm = new Float32Array(nv * 3);
  for (let i = 0; i < topo.stri.length; i += 3) {
    const a = topo.stri[i] * 3, b = topo.stri[i + 1] * 3, c = topo.stri[i + 2] * 3;
    const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (const q of [a, b, c]) { nrm[q] += n[0]; nrm[q + 1] += n[1]; nrm[q + 2] += n[2]; }
  }
  const N = (v) => new THREE.Vector3(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]).normalize();
  const Pv = (v) => new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
  // the back of each hand: normal of the knuckle plane, pointing away from the thumb tip (which sits palm-side)
  const dorsal = {};
  for (const s of ['L', 'R']) {
    const w = bone[`wrist.${s}`].head, i2 = bone[`finger2-1.${s}`].head, i5 = bone[`finger5-1.${s}`].head, thumb = bone[`finger1-3.${s}`].tail;
    const n = i2.clone().sub(w).cross(i5.clone().sub(w)).normalize();
    if (thumb.clone().sub(w).dot(n) > 0) n.negate();
    dorsal[s] = n;
  }
  const bodyVerts = new Set(topo.src);
  for (const v of bodyVerts) {
    const bn = nameOf[dom[v]] || '';
    const p = Pv(v), n = N(v);
    const side = bn.endsWith('.L') ? 'L' : 'R';
    // palms + finger pads lighter; soles too
    if (/^(wrist|metacarpal|finger)/.test(bn)) {
      const d = n.dot(dorsal[side]);
      palm[v] = THREE.MathUtils.smoothstep(-d, 0.1, 0.6);
      thin[v] = Math.max(thin[v], /^finger/.test(bn) ? 0.45 : 0.1);
      pores[v] = /^finger/.test(bn) ? 0.08 : pores[v];
    }
    if (/^(foot|toe)/.test(bn)) palm[v] = THREE.MathUtils.smoothstep(-n.y, 0.55, 0.85);
    // knuckles, elbows, knees: a bit redder/darker
    for (const k of ['finger2-2', 'finger3-2', 'finger4-2', 'finger5-2', 'finger2-1', 'finger3-1', 'finger4-1', 'finger5-1', 'finger2-3', 'finger3-3', 'finger4-3', 'finger5-3']) {
      const b = bone[`${k}.${side}`]; if (!b) continue;
      const d = p.distanceTo(b.head); const dd = n.dot(dorsal[side]);
      if (dd > 0.2 && d < 0.12) red[v] = Math.max(red[v], 0.35 * (1 - d / 0.12));
    }
    for (const [k, r] of [['lowerarm01', 0.35], ['lowerleg01', 0.45]]) {
      const b = bone[`${k}.${side}`]; const d = p.distanceTo(b.head);
      if (d < r) red[v] = Math.max(red[v], 0.25 * (1 - d / r));
    }
    // fingernails: on the back of the last finger segment, toward the tip
    const m = /^finger([2-5])-3/.exec(bn) || /^finger(1)-3/.exec(bn);
    if (m) {
      const b = bone[bn]; const ax = b.tail.clone().sub(b.head); const len = ax.length(); ax.normalize();
      const rel = p.clone().sub(b.head); const u = rel.dot(ax) / len;
      const radial = rel.clone().addScaledVector(ax, -rel.dot(ax)).normalize();
      const dors = dorsal[side].clone().addScaledVector(ax, -dorsal[side].dot(ax)).normalize();
      const lat = ax.clone().cross(dors);
      nailU[v] = u; nailD[v] = radial.dot(dors); nailL[v] = radial.dot(lat);
    }
  }
  // scalp: everything above a real hairline (high at the forehead, receding at the temples,
  // down to the sideburns at the ears and to the nape at the back), measured as an angle around
  // the head's center (between the ears)
  const earC = new THREE.Vector3(); let ne = 0;
  for (const [v, x] of earM) if (x > 0.5) { earC.add(Pv(v)); ne++; }
  earC.multiplyScalar(1 / Math.max(1, ne)); earC.x = 0;
  const headB = bone.head.head; void headB;
  const deg = Math.PI / 180;
  const lerpT = (x, pts) => { for (let i = 0; i < pts.length - 1; i++) { const [a, ya] = pts[i], [b, yb] = pts[i + 1]; if (x <= b) return ya + (yb - ya) * THREE.MathUtils.smoothstep(x, a, b); } return pts[pts.length - 1][1]; };
  const hairline = [[0, 38], [32, 38], [62, 24], [80, 14], [100, -4], [125, -22], [180, -46]];
  for (const v of bodyVerts) {
    const bn = nameOf[dom[v]] || '';
    if (!/^(head|neck0[23])$/.test(bn)) continue;
    const p = Pv(v).sub(earC);
    const az = Math.abs(Math.atan2(p.x, p.z)) / deg, el = Math.atan2(p.y, Math.hypot(p.x, p.z)) / deg;
    const th = lerpT(az, hairline);
    scalp[v] = THREE.MathUtils.smoothstep(el - th, -2, 5) * (1 - THREE.MathUtils.smoothstep(ear[v], 0.05, 0.3));
  }
  for (const v of bodyVerts) { if (scalp[v] > 0) pores[v] = Math.max(pores[v] * (1 - scalp[v]), 0.1); }
  // mean curvature-ish per vertex: how fast the normal turns per mm (drives the subsurface lookup)
  const curv = new Float32Array(nv), cnt = new Float32Array(nv);
  for (let i = 0; i < topo.stri.length; i += 3) for (let e = 0; e < 3; e++) {
    const a = topo.stri[i + e], b = topo.stri[i + (e + 1) % 3];
    const na = N(a), nb = N(b), d = Pv(a).distanceTo(Pv(b)) * 100; // dm -> mm
    if (d < 1e-6) continue;
    const k = na.distanceTo(nb) / d; curv[a] += k; curv[b] += k; cnt[a]++; cnt[b]++;
  }
  for (let v = 0; v < nv; v++) if (cnt[v]) curv[v] /= cnt[v];
  // ---- render-vertex attributes for the body group ----
  const n = topo.n, A = new Float32Array(n * 4), B = new Float32Array(n * 4), C = new Float32Array(n * 4), D = new Float32Array(n * 2);
  for (let l = 0; l < n; l++) {
    const s = topo.src[l];
    A[l * 4] = Math.min(1, red[s]); A[l * 4 + 1] = Math.min(1, pores[s]); A[l * 4 + 2] = Math.min(1, thin[s]); A[l * 4 + 3] = lips[s];
    B[l * 4] = brow[s]; B[l * 4 + 1] = scalp[s]; B[l * 4 + 2] = palm[s]; B[l * 4 + 3] = ear[s];
    C[l * 4] = nailU[s]; C[l * 4 + 1] = nailD[s]; C[l * 4 + 2] = nailL[s]; C[l * 4 + 3] = curv[s];
    D[l * 2] = browT[s]; D[l * 2 + 1] = browS[s];
  }
  cache = {
    aSkinA: new THREE.BufferAttribute(A, 4), aSkinB: new THREE.BufferAttribute(B, 4), aNail: new THREE.BufferAttribute(C, 4), // xyz = nail coords, w = curvature (1/mm)
    aBrow: new THREE.BufferAttribute(D, 2), // position along (0 inner .. 1 outer) and across the brow
    scalp, brow, lips, palm, dorsal,
  };
  return cache;
}
