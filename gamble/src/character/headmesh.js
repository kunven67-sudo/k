// Head mesh: a warped direction grid shot from PROJ onto the head SDF (headsdf.js).
//
// - Columns = azimuth around the vertical axis (dense on the face, sparse at the back).
// - Rows = elevation, dense from brow to chin. One row lies exactly on the mouth slit and is
//   split (upper copy follows the head, lower copy the jaw), so the mouth can open.
// - Bottom row = the neck seam (matches the body's top ring, tucked 0.5 mm inside).
// - Verts that land on an eyeball are pulled behind it; the ones bordering the lid are snapped
//   onto the almond opening curve so the depth buffer draws a clean lid margin.
// - (u, v) grid coordinates double as the face-paint UVs.
// Output is in head unit space; meshbuild.js scales/places it on the skeleton.

import { buildLidPatch, makeCoverTest } from './eyelids.js';
import { headSDF, eyeAngles, eyeOpening, faceBonePositions, neckSeamY, PROJ } from './headsdf.js';

const { sin, cos, atan2, hypot, abs, max, min, exp, PI } = Math;
const D2R = PI / 180;
const sstep = (a, b, x) => {
  const t = min(1, max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const HEAD_BONES = [
  'head', 'neck', 'jaw', 'lip.U', 'lip.D', 'nose',
  'lidU.L', 'lidU.R', 'lidD.L', 'lidD.R', 'corner.L', 'corner.R', 'cheek.L', 'cheek.R',
  'brow.in.L', 'brow.in.R', 'brow.out.L', 'brow.out.R',
];
const HB = new Map(HEAD_BONES.map((n, i) => [n, i]));

// Grid columns x rows (the magnifier warp concentrates them on the face). Budget: head ~8k tris high.
export const HEAD_RES = { low: [40, 32], medium: [60, 48], high: [64, 50], ultra: [104, 84] };

/** Column azimuth from s in [-1, 1): face magnified. */
export const colAz = (s) => PI * (0.36 * s + 0.64 * s * s * s);

/**
 * Grid magnifiers: (az, el) fisheye warps that pull grid lines toward the eyes, nose and mouth
 * so those areas get ~2.5x the vertex density without raising the vertex count.
 */
export function makeWarp(L) {
  const mags = [];
  for (const e of L.eyes) {
    const q = [e.c[0] - PROJ[0], e.c[1] - PROJ[1], e.c[2] - PROJ[2]];
    mags.push({ az: atan2(q[0], q[2]), el: atan2(q[1], hypot(q[0], q[2])), ra: 25 * D2R, re: 16 * D2R, a: 0.62 });
  }
  {
    const q = [0, L.noseTipY - PROJ[1], L.noseTipZ - PROJ[2]];
    mags.push({ az: 0, el: atan2(q[1], q[2]) - 2 * D2R, ra: 13 * D2R, re: 10 * D2R, a: 0.4 });
  }
  mags.push({ az: 0, el: L.mouthElev, ra: 24 * D2R, re: 9 * D2R, a: 0.55 });
  return (az, el) => {
    for (const m of mags) {
      const dx = (az - m.az) / m.ra;
      const dy = (el - m.el) / m.re;
      const r = hypot(dx, dy);
      if (r >= 1 || r < 1e-9) continue;
      const hr = r * (1 - m.a * (1 - r) * (1 - r));
      const k = hr / r;
      az = m.az + dx * k * m.ra;
      el = m.el + dy * k * m.re;
    }
    return [az, el];
  };
}

/** March from outside along -dir towards PROJ; returns distance from PROJ to the surface. */
function castRay(sdf, dx, dy, dz, t0 = 0.3) {
  // Warm start (t0 from a neighbouring ray) must begin outside the surface.
  let t = t0;
  let f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
  while (f <= 0 && t < 0.3) {
    t = Math.min(0.3, t + 0.04);
    f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
  }
  let prevT = t;
  for (let i = 0; i < 160 && f > 1e-5; i++) {
    prevT = t;
    t -= max(f * 0.7, 2e-4);
    if (t <= 0.002) return 0.002;
    f = sdf(PROJ[0] + dx * t, PROJ[1] + dy * t, PROJ[2] + dz * t);
  }
  // Refine between prevT (outside) and t (inside).
  let a = t;
  let b = prevT;
  for (let i = 0; i < 14; i++) {
    const m = (a + b) * 0.5;
    if (sdf(PROJ[0] + dx * m, PROJ[1] + dy * m, PROJ[2] + dz * m) > 0) b = m;
    else a = m;
  }
  return (a + b) * 0.5;
}

function rowDensity(eDeg) {
  // Rows per degree (relative): sparse scalp, dense face, medium neck.
  if (eDeg > 40) return 0.35;
  if (eDeg > 22) return 0.35 + ((40 - eDeg) / 18) * 0.65;
  if (eDeg > -58) return 1.0;
  return 0.75;
}

/** Elevations from e0 down to e1 (inclusive both), n samples, spaced by rowDensity. */
function distributeRows(e0, e1, n) {
  const N = 400;
  const cum = [0];
  for (let i = 1; i <= N; i++) {
    const e = e0 + ((e1 - e0) * (i - 0.5)) / N;
    cum.push(cum[i - 1] + rowDensity(e / D2R));
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    const target = (cum[N] * k) / (n - 1);
    let i = 1;
    while (i < N && cum[i] < target) i++;
    const f = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    out.push(e0 + ((e1 - e0) * (i - 1 + f)) / N);
  }
  return out;
}

/**
 * Build the head grid for layout L (with L.neck set). Returns typed arrays in unit space:
 * { pos, nrm, uv, weights (dense HEAD_BONES), index, nv, eyeMask, info }.
 */
export function buildHeadGrid(L, tier = 'high') {
  const sdf = headSDF(L);
  const [C, R] = HEAD_RES[tier] || HEAD_RES.high;
  const top = 86 * D2R;
  // Rows: top -> mouth (exact) -> neck cut (per column).
  const nTop = Math.round(R * 0.56);
  const nBot = R - nTop;
  const rowsTop = distributeRows(top, L.mouthElev, nTop + 1); // includes mouth row last
  const mouthRow = nTop;
  // Per-column neck-cut elevation: where the ray meets the neck seam height.
  const cols = [];
  for (let i = 0; i <= C; i++) {
    const s = -1 + (2 * i) / C;
    const az = colAz(s);
    const sa = sin(az);
    const ca = cos(az);
    let lo = -88 * D2R;
    let hi = -35 * D2R;
    const seamY = neckSeamY(L.neck, az);
    for (let it = 0; it < 13; it++) {
      const m = (lo + hi) * 0.5;
      const dx = cos(m) * sa;
      const dy = sin(m);
      const dz = cos(m) * ca;
      const t = castRay(sdf, dx, dy, dz);
      if (PROJ[1] + dy * t < seamY) lo = m;
      else hi = m;
    }
    cols.push({ s, az, sa, ca, cut: (lo + hi) * 0.5 });
  }
  const rowsBotByCol = cols.map((c) => distributeRows(L.mouthElev, c.cut, nBot + 1).slice(1));
  const nRows = nTop + 1 + nBot;
  const NC = C + 1; // seam column duplicated for UVs
  const nGrid = NC * nRows;
  // Mouth split: duplicate mouth-row verts inside the mouth.
  const warp0 = makeWarp(L);
  const mouthCols = [];
  for (let i = 0; i < NC; i++) if (abs(warp0(cols[i].az, L.mouthElev)[0]) < L.mouthAz * 0.985) mouthCols.push(i);
  const nv = nGrid + mouthCols.length + 1; // + crown pole
  const pos = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const elevOf = new Float32Array(nv);
  const rowOf = new Int32Array(nv);
  const colOf = new Int32Array(nv);
  const vid = (r, c) => r * NC + c;
  const warp = makeWarp(L);
  const azOf = new Float32Array(nv);
  let tPrev = new Float32Array(NC).fill(0.3);
  let tRow = new Float32Array(NC);
  for (let r = 0; r < nRows; r++) {
    if (r > 0) [tPrev, tRow] = [tRow, tPrev];
    for (let c = 0; c < NC; c++) {
      const cc = cols[c];
      const e0 = r <= nTop ? rowsTop[r] : rowsBotByCol[c][r - nTop - 1];
      const [az, e] = r === nRows - 1 ? [cc.az, e0] : warp(cc.az, e0);
      const dx = cos(e) * sin(az);
      const dy = sin(e);
      const dz = cos(e) * cos(az);
      azOf[vid(r, c)] = az;
      // Warm start from the row above / column to the left (+5 cm so protrusions are not missed).
      const tl = c > 0 ? tRow[c - 1] : 0.3;
      const tu = r > 0 ? tPrev[c] : 0.3;
      let t = castRay(sdf, dx, dy, dz, Math.min(0.3, Math.max(tl, tu) + 0.05));
      tRow[c] = t;
      const v = vid(r, c);
      if (r === nRows - 1) t *= 0.996; // tuck the seam inside the body ring
      pos[v * 3] = PROJ[0] + dx * t;
      pos[v * 3 + 1] = PROJ[1] + dy * t;
      pos[v * 3 + 2] = PROJ[2] + dz * t;
      uv[v * 2] = c / C;
      uv[v * 2 + 1] = 1 - r / (nRows - 1);
      elevOf[v] = e;
      rowOf[v] = r;
      colOf[v] = c;
    }
  }
  const split = new Map();
  mouthCols.forEach((c, k) => {
    const src = vid(mouthRow, c);
    const dst = nGrid + k;
    pos.copyWithin(dst * 3, src * 3, src * 3 + 3);
    uv.copyWithin(dst * 2, src * 2, src * 2 + 2);
    elevOf[dst] = elevOf[src];
    rowOf[dst] = mouthRow;
    colOf[dst] = c;
    split.set(src, dst);
  });
  const pole = nv - 1;
  {
    const t = castRay(sdf, 0, 1, 0);
    pos[pole * 3 + 1] = PROJ[1] + t;
    pos[pole * 3] = PROJ[0];
    pos[pole * 3 + 2] = PROJ[2];
    uv[pole * 2] = 0.5;
    uv[pole * 2 + 1] = 1;
    rowOf[pole] = -1;
  }
  // Triangles (CCW seen from outside). Faces below the mouth row use the split copies.
  const idx = [];
  for (let r = 0; r < nRows - 1; r++) {
    for (let c = 0; c < C; c++) {
      let a = vid(r, c);
      let b = vid(r, c + 1);
      const d = vid(r + 1, c);
      const e = vid(r + 1, c + 1);
      if (r === mouthRow) {
        a = split.get(a) ?? a;
        b = split.get(b) ?? b;
      }
      idx.push(a, d, b, b, d, e);
    }
  }
  for (let c = 0; c < C; c++) idx.push(pole, vid(0, c), vid(0, c + 1));

  // Normals from the field gradient.
  const nrm = new Float32Array(nv * 3);
  const h = 4e-4;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    const gx = sdf(x + h, y, z) - sdf(x - h, y, z);
    const gy = sdf(x, y + h, z) - sdf(x, y - h, z);
    const gz = sdf(x, y, z + h) - sdf(x, y, z - h);
    const l = hypot(gx, gy, gz) || 1;
    nrm[v * 3] = gx / l;
    nrm[v * 3 + 1] = gy / l;
    nrm[v * 3 + 2] = gz / l;
  }
  // Seam row: horizontal outward normals so it shades like the body ring below.
  for (let c = 0; c < NC; c++) {
    const v = vid(nRows - 1, c);
    const l = hypot(nrm[v * 3], nrm[v * 3 + 2]) || 1;
    nrm[v * 3] /= l;
    nrm[v * 3 + 1] = 0;
    nrm[v * 3 + 2] /= l;
  }

  // Eyelid patches replace the grid around each eye.
  const patches = L.eyes.map((e) => ({ e, ...buildLidPatch(L, e, sdf, tier === 'low' ? 28 : 44, castRay) }));
  const covered = makeCoverTest(patches);
  const cov = new Uint8Array(nv);
  for (let v = 0; v < nv; v++) cov[v] = covered(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) ? 1 : 0;
  const keptIdx = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (cov[idx[i]] && cov[idx[i + 1]] && cov[idx[i + 2]]) continue;
    keptIdx.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  const eyeMask = new Int8Array(nv);
  for (const [src, dst] of split) azOf[dst] = azOf[src];
  const gridW = headWeights(L, pos, nv, eyeMask, rowOf, mouthRow, split, azOf);
  // Append the patches.
  const pv = patches.reduce((n, pp) => n + pp.nv, 0);
  const NB = HEAD_BONES.length;
  const P2 = new Float32Array((nv + pv) * 3);
  const N2 = new Float32Array((nv + pv) * 3);
  const U2 = new Float32Array((nv + pv) * 2);
  const W2 = new Float32Array((nv + pv) * NB);
  P2.set(pos);
  N2.set(nrm);
  U2.set(uv);
  W2.set(gridW);
  const toUV = makeGridUV(L, C, nRows, rowsTop, rowsBotByCol, cols);
  let off = nv;
  for (const pp of patches) {
    P2.set(pp.pos, off * 3);
    N2.set(pp.nrm, off * 3);
    const az = new Float32Array(pp.nv);
    for (let v = 0; v < pp.nv; v++) {
      const qx = pp.pos[v * 3] - PROJ[0];
      const qy = pp.pos[v * 3 + 1] - PROJ[1];
      const qz = pp.pos[v * 3 + 2] - PROJ[2];
      az[v] = atan2(qx, qz);
      const [u, vv] = toUV(az[v], atan2(qy, hypot(qx, qz)));
      U2[(off + v) * 2] = u;
      U2[(off + v) * 2 + 1] = vv;
    }
    const pw = headWeights(L, pp.pos, pp.nv, new Int8Array(pp.nv), new Int32Array(pp.nv).fill(-2), mouthRow, new Map(), az, true);
    const s = pp.e.side > 0 ? 'L' : 'R';
    const iU = HB.get(`lidU.${s}`);
    const iD = HB.get(`lidD.${s}`);
    for (let v = 0; v < pp.nv; v++) {
      const lw = pp.lidW[v];
      const k = abs(lw);
      const o = v * NB;
      for (let bI = 0; bI < NB; bI++) pw[o + bI] *= 1 - k;
      pw[o + (lw >= 0 ? iU : iD)] += k;
    }
    W2.set(pw, off * NB);
    for (const t of pp.index) keptIdx.push(t + off);
    off += pp.nv;
  }
  const weights = W2;
  const nvAll = nv + pv;
  return { pos: P2, nrm: N2, uv: U2, weights, index: keptIdx, nv: nvAll, info: { C, R: nRows, mouthRow, nGrid, cols, rowsTop, toUV } };
}

/** Inverse of the grid mapping: (az, el) of a direction from PROJ -> face-paint UV. */
export function makeGridUV(L, C, nRows, rowsTop, rowsBotByCol, cols) {
  const warp = makeWarp(L);
  const mouthRow = rowsTop.length - 1;
  return (az, el) => {
    // Undo the magnifiers (fixed point).
    let a0 = az;
    let e0 = el;
    for (let i = 0; i < 12; i++) {
      const [wa, we] = warp(a0, e0);
      a0 += az - wa;
      e0 += el - we;
    }
    // Inverse column warp (Newton).
    let sv = a0 / PI;
    for (let i = 0; i < 8; i++) {
      const f = colAz(sv) - a0;
      const df = PI * (0.36 + 1.92 * sv * sv);
      sv -= f / df;
    }
    sv = Math.max(-1, Math.min(1, sv));
    const u = (sv + 1) * 0.5;
    let r;
    if (e0 >= rowsTop[mouthRow]) {
      let i = 0;
      while (i < mouthRow - 1 && rowsTop[i + 1] > e0) i++;
      r = i + (rowsTop[i] - e0) / (rowsTop[i] - rowsTop[i + 1] || 1);
    } else {
      const bot = rowsBotByCol[Math.round(u * C)];
      let prev = rowsTop[mouthRow];
      r = mouthRow;
      for (let i = 0; i < bot.length; i++) {
        if (bot[i] <= e0) {
          r = mouthRow + i + (prev - e0) / (prev - bot[i] || 1);
          break;
        }
        prev = bot[i];
        r = mouthRow + i + 1;
      }
    }
    return [u, 1 - Math.min(nRows - 1, Math.max(0, r)) / (nRows - 1)];
  };
}

/** Vertical centre of the opening at horizontal angle h. */
function findCenter(L, e, h) {
  let best = 0;
  let bv = -1;
  for (let v = -0.6; v <= 0.6; v += 0.02) {
    const o = eyeOpening(L, e, h, v);
    if (o > bv) {
      bv = o;
      best = v;
    }
  }
  return best;
}

function headWeights(L, pos, nv, eyeMask, rowOf, mouthRow, split, azOf, isPatch = false) {
  const NB = HEAD_BONES.length;
  const W = new Float32Array(nv * NB);
  const FB = faceBonePositions(L);
  const splitLower = new Set(split.values());
  const g = (x, y, z, p, r) => exp(-((x - p[0]) ** 2 + (y - p[1]) ** 2 + (z - p[2]) ** 2) / (r * r));
  const neckY = L.neck.y;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    const w = new Float32Array(NB);
    const set = (n, val) => {
      w[HB.get(n)] += val;
    };
    // Neck: bottom of the grid follows the neck bone.
    const neckW = 1 - sstep(neckY + 0.012, neckY + 0.075, y);
    // Jaw: below the mouth, in front of the ear; the lower copy of the split row is lip.D/jaw.
    const inMouthCol = abs(azOf[v]) < L.mouthAz * 1.1 && rowOf[v] >= 0;
    let below;
    if (rowOf[v] === mouthRow && inMouthCol) below = splitLower.has(v) ? 1 : 0;
    else if (rowOf[v] > mouthRow && inMouthCol) below = 1;
    else below = sstep(L.mouthY + 0.006, L.mouthY - 0.03, y);
    const front = sstep(-0.075, -0.015, z);
    let jaw = below * front * (1 - neckW * 0.7);
    // Lips.
    const lipU = rowOf[v] <= mouthRow && !splitLower.has(v) ? g(x, y, z, [0, L.mouthY + 0.004, L.mouthZ], 0.016) * (1 - below) : 0;
    const lipD = below > 0.5 ? g(x, y, z, [0, L.mouthY - 0.006, L.mouthZ], 0.017) : 0;
    set('lip.U', lipU * 0.9);
    if (lipD > 0) {
      set('lip.D', lipD * 0.85);
      jaw *= 1 - lipD * 0.85;
    }
    for (const side of ['L', 'R']) {
      const cp = FB[`corner.${side}`];
      set(`corner.${side}`, g(x, y, z, cp, 0.011) * 0.9);
      set(`cheek.${side}`, g(x, y, z, FB[`cheek.${side}`], 0.022) * 0.85);
      if (y > L.eyeY + 0.008) {
        set(`brow.in.${side}`, g(x, y, z, FB[`brow.in.${side}`], 0.014) * 0.9);
        set(`brow.out.${side}`, g(x, y, z, FB[`brow.out.${side}`], 0.016) * 0.9);
      }
    }
    set('nose', g(x, y, z, [0, L.noseTipY, L.noseTipZ - 0.006], 0.013) * 0.9);
    // Lids (grid verts near the eyes; the patches set their own lid weights).
    for (const e of isPatch ? [] : L.eyes) {
      const s = e.side > 0 ? 'L' : 'R';
      const [hA, vA, r] = eyeAngles(L, e, x, y, z);
      if (z < e.c[2] - 0.006) continue;
      const center = findCenterCached(L, e, hA);
      const upper = vA >= center;
      if (eyeMask[v] === e.side) {
        set(upper ? `lidU.${s}` : `lidD.${s}`, 1);
        continue;
      }
      const rr = r - (L.eyeR + L.lidT);
      let k = 1 - sstep(0.0012, 0.0075, rr);
      const edge = abs(hA) / L.lidHalfW;
      k *= 1 - sstep(0.9, 1.25, edge);
      if (k > 0) set(upper ? `lidU.${s}` : `lidD.${s}`, k * (upper ? 1 : 0.85));
    }
    // Normalise: remaining weight goes to head/jaw/neck.
    let sum = 0;
    for (let b = 0; b < NB; b++) sum += w[b];
    if (sum > 1) {
      for (let b = 0; b < NB; b++) w[b] /= sum;
      sum = 1;
    }
    const rest = 1 - sum;
    const jw = jaw * rest;
    const nw = neckW * (rest - jw) * (z < 0.02 || y < neckY + 0.03 ? 1 : 0.4);
    set('jaw', jw);
    set('neck', nw);
    set('head', rest - jw - nw);
    W.set(w, v * NB);
  }
  return W;
}

const _centerCache = new Map();
function findCenterCached(L, e, h) {
  const k = `${e.side}:${Math.round(h * 200)}:${L.lidUpper.toFixed(4)}:${L.tilt.toFixed(4)}`;
  let c = _centerCache.get(k);
  if (c === undefined) {
    c = findCenter(L, e, h);
    if (_centerCache.size > 4000) _centerCache.clear();
    _centerCache.set(k, c);
  }
  return c;
}
