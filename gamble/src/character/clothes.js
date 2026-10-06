// Garments built from the body cage: a garment is a set of cage faces (selected by part/ring/
// column tags), pushed outward along the cage normals by its fabric thickness + ease, then
// subdivided exactly like the body. Same topology + same subdivided bone weights as the skin
// underneath, so clothes deform with the body and never intersect it; covered skin triangles
// are hidden. Open edges get a folded hem (visible fabric thickness) and every vertex knows
// its distance to the nearest hem (stitch lines, fraying, denim fading in the shader).
//
// Skirts and dresses use a free-hanging tube (not leg-following) with weights blended between
// the hips and thighs.

import * as THREE from 'three';
import { PART, tagPart, tagRing, tagCol, BODY_BONES, CAGE_ATTR } from './bodycage.js';
import { subdivide, pushToLimit, compact, triangulate, orientFaces } from './subdiv.js';

const P = PART;
const isArm = (pt) => pt === P.armL || pt === P.armR;
const isLeg = (pt) => pt === P.legL || pt === P.legR;
const isFoot = (pt) => pt === P.footL || pt === P.footR;
const isHand = (pt) => pt === P.handL || pt === P.handR;
// Torso columns: 0 and 15 straddle the front midline, 7/8 the back midline.
const frontMid = (c) => c === 0 || c === 15;
const front3 = (c) => c <= 1 || c >= 14;

/**
 * Garment catalogue. select(part, ring, col) picks cage faces; off(part, ring, col, y) is the
 * offset from the skin (m, at scale 1). `fabric` picks the cloth material. `layer` orders
 * overlapping garments (higher = outside).
 */
export const GARMENTS = {
  tshirt: {
    fabric: 'jersey', layer: 1,
    select: (pt, r, c) => (pt === P.torso && r >= 1 && !(r === 8 && front3(c))) || (isArm(pt) && r <= 2),
    off: (pt, r) => (isArm(pt) ? 0.012 + r * 0.002 : r <= 2 ? 0.014 : 0.009),
  },
  tank: {
    fabric: 'jersey', layer: 1,
    select: (pt, r, c) => pt === P.torso && r >= 1 && !(r >= 6 && r <= 7 && ((c >= 2 && c <= 5) || (c >= 10 && c <= 13))) && !(r === 8 && (front3(c) || c === 7 || c === 8)),
    off: (pt, r) => (r <= 2 ? 0.012 : 0.007),
  },
  button: {
    fabric: 'oxford', layer: 1,
    select: (pt, r) => (pt === P.torso && r >= 1) || (isArm(pt) && r <= 7),
    off: (pt, r) => (isArm(pt) ? (r === 7 ? 0.009 : 0.013) : r <= 2 ? 0.015 : 0.01),
    collar: true, placket: true, cuffs: true,
  },
  polo: {
    fabric: 'pique', layer: 1,
    select: (pt, r) => (pt === P.torso && r >= 1) || (isArm(pt) && r <= 2),
    off: (pt, r) => (isArm(pt) ? 0.013 : r <= 2 ? 0.015 : 0.01),
    collar: true, placket: true,
  },
  hoodie: {
    fabric: 'fleece', layer: 2,
    select: (pt, r) => (pt === P.torso && r >= 0) || (isArm(pt) && r <= 7),
    off: (pt, r) => (isArm(pt) ? (r === 7 ? 0.014 : 0.024) : r <= 2 ? 0.03 : 0.02),
    hood: true, cuffs: true,
  },
  dealer: {
    fabric: 'oxford', layer: 1, color: 'white',
    select: (pt, r) => (pt === P.torso && r >= 1) || (isArm(pt) && r <= 7),
    off: (pt, r) => (isArm(pt) ? (r === 7 ? 0.009 : 0.012) : r <= 2 ? 0.013 : 0.009),
    collar: true, cuffs: true,
    extra: [{ garment: 'dealerVest' }],
    bowtie: true,
  },
  dealerVest: {
    fabric: 'satin', layer: 2,
    select: (pt, r, c) => pt === P.torso && r >= 1 && r <= 8 && !(r >= 6 && ((c >= 2 && c <= 5) || (c >= 10 && c <= 13))) && !(r >= 6 && front3(c)) && !(r === 8 && (c === 1 || c === 14)),
    off: (pt, r) => (r <= 2 ? 0.022 : 0.016),
  },
  security: {
    fabric: 'twill', layer: 1,
    select: (pt, r) => (pt === P.torso && r >= 1) || (isArm(pt) && r <= 2),
    off: (pt, r) => (isArm(pt) ? 0.015 : r <= 2 ? 0.017 : 0.012),
    collar: true, placket: true, badge: true, backText: 'SECURITY', epaulettes: true,
  },
  clerk: {
    fabric: 'pique', layer: 1,
    select: (pt, r) => (pt === P.torso && r >= 1) || (isArm(pt) && r <= 2),
    off: (pt, r) => (isArm(pt) ? 0.013 : r <= 2 ? 0.015 : 0.01),
    collar: true, placket: true, nameTag: true,
  },
  // Bottoms.
  jeans: {
    fabric: 'denim', layer: 0,
    select: (pt, r) => (pt === P.torso && r <= 1) || pt === P.crotch || (isLeg(pt) && r <= 8),
    off: (pt, r) => (isLeg(pt) ? (r >= 6 ? 0.016 : 0.009) : 0.008),
    belt: true,
  },
  slacks: {
    fabric: 'wool', layer: 0,
    select: (pt, r) => (pt === P.torso && r <= 1) || pt === P.crotch || (isLeg(pt) && r <= 8),
    off: (pt, r) => (isLeg(pt) ? (r >= 5 ? 0.02 : 0.012) : 0.009),
    belt: true, crease: true,
  },
  cargo: {
    fabric: 'canvas', layer: 0,
    select: (pt, r) => (pt === P.torso && r <= 1) || pt === P.crotch || (isLeg(pt) && r <= 8),
    off: (pt, r) => (isLeg(pt) ? (r >= 5 ? 0.022 : 0.016) : 0.01),
    belt: true, pockets: true,
  },
  shorts: {
    fabric: 'canvas', layer: 0,
    select: (pt, r) => (pt === P.torso && r <= 1) || pt === P.crotch || (isLeg(pt) && r <= 2),
    off: (pt, r) => (isLeg(pt) ? 0.014 + r * 0.004 : 0.009),
    belt: true,
  },
  skirt: {
    fabric: 'crepe', layer: 0,
    select: (pt, r) => pt === P.torso && r <= 2 && r >= 1,
    off: () => 0.01,
    skirt: { length: 0.42, flare: 1.12 },
  },
  // Outerwear (open front).
  jacket: {
    fabric: 'nylon', layer: 3,
    select: (pt, r, c) => ((pt === P.torso && r >= 1) || (isArm(pt) && r <= 7)) && !(pt === P.torso && frontMid(c)),
    off: (pt, r) => (isArm(pt) ? (r === 7 ? 0.018 : 0.03) : r <= 2 ? 0.034 : 0.026),
    cuffs: true, collar: true,
  },
  'denim-jacket': {
    fabric: 'denim', layer: 3,
    select: (pt, r, c) => ((pt === P.torso && r >= 2) || (isArm(pt) && r <= 7)) && !(pt === P.torso && frontMid(c)),
    off: (pt, r) => (isArm(pt) ? (r === 7 ? 0.016 : 0.026) : r <= 3 ? 0.03 : 0.024),
    cuffs: true, collar: true,
  },
  'leather-jacket': {
    fabric: 'leather', layer: 3,
    select: (pt, r, c) => ((pt === P.torso && r >= 2) || (isArm(pt) && r <= 7)) && !(pt === P.torso && frontMid(c)),
    off: (pt, r) => (isArm(pt) ? (r === 7 ? 0.016 : 0.026) : r <= 3 ? 0.03 : 0.024),
    cuffs: true, collar: true,
  },
  blazer: {
    fabric: 'wool', layer: 3,
    select: (pt, r, c) => ((pt === P.torso && r >= 1) || (isArm(pt) && r <= 7)) && !(pt === P.torso && (frontMid(c) || (r >= 5 && front3(c)))),
    off: (pt, r) => (isArm(pt) ? (r === 7 ? 0.016 : 0.024) : r <= 2 ? 0.03 : 0.024),
    collar: true,
  },
  vest: {
    fabric: 'wool', layer: 2,
    select: (pt, r, c) => pt === P.torso && r >= 1 && !(r >= 6 && ((c >= 2 && c <= 5) || (c >= 10 && c <= 13))) && !(r >= 6 && front3(c)),
    off: (pt, r) => (r <= 2 ? 0.024 : 0.018),
  },
  // Shoes: from the foot cage (+ ankle/shin rings for boots).
  sneakers: {
    fabric: 'sneaker', layer: 0, shoe: { sole: 0.03, toe: 1.0 },
    select: (pt, r) => isFoot(pt) || (isLeg(pt) && r === 8),
    off: (pt) => (isFoot(pt) ? 0.011 : 0.006),
  },
  boots: {
    fabric: 'leather', layer: 0, shoe: { sole: 0.034, toe: 1.02 },
    select: (pt, r) => isFoot(pt) || (isLeg(pt) && r >= 6),
    off: (pt) => (isFoot(pt) ? 0.013 : 0.01),
  },
};
GARMENTS.dress = {
  fabric: 'crepe', layer: 1,
  select: (pt, r, c) => pt === P.torso && r >= 2 && !(r >= 7 && ((c >= 2 && c <= 5) || (c >= 10 && c <= 13))) && !(r === 8 && front3(c)),
  off: (pt, r) => (r <= 3 ? 0.012 : 0.007),
  skirt: { length: 0.52, flare: 1.18 },
};
GARMENTS.belt = { fabric: 'leather', layer: 0, select: (pt, r) => pt === P.torso && r === 1, off: () => 0.0165 };
GARMENTS['dress-shoes'] = { fabric: 'leather', layer: 0, shoe: { sole: 0.022, toe: 1.06 }, select: (pt, r) => isFoot(pt) || (isLeg(pt) && r === 8), off: (pt) => (isFoot(pt) ? 0.009 : 0.005) };
GARMENTS.cowboy = { fabric: 'leather', layer: 0, shoe: { sole: 0.026, toe: 1.14, heel: 0.03 }, select: (pt, r) => isFoot(pt) || (isLeg(pt) && r >= 6), off: (pt, r) => (isFoot(pt) ? 0.012 : 0.012 + (r - 6) * 0.004) };
GARMENTS.slides = { fabric: 'rubber', layer: 0, shoe: { sole: 0.02, toe: 1.0, open: true }, select: (pt, r, c) => isFoot(pt) && r >= 1 && r <= 3, off: () => 0.006 };

/** Area-weighted normals of the full cage (so garment boundaries offset consistently). */
function cageNormals(cage) {
  const { nv, D, data, quads } = cage;
  const N = new Float32Array(nv * 3);
  for (let f = 0; f < quads.length; f += 4) {
    const a = quads[f] * D;
    const b = quads[f + 1] * D;
    const c = quads[f + 2] * D;
    const d = quads[f + 3] * D;
    // Quad normal = (c - a) x (d - b).
    const ux = data[c] - data[a];
    const uy = data[c + 1] - data[a + 1];
    const uz = data[c + 2] - data[a + 2];
    const vx = data[d] - data[b];
    const vy = data[d + 1] - data[b + 1];
    const vz = data[d + 2] - data[b + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (let i = 0; i < 4; i++) {
      const v = quads[f + i];
      N[v * 3] += nx;
      N[v * 3 + 1] += ny;
      N[v * 3 + 2] += nz;
    }
  }
  for (let v = 0; v < nv; v++) {
    const l = Math.hypot(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) || 1;
    N[v * 3] /= l;
    N[v * 3 + 1] /= l;
    N[v * 3 + 2] /= l;
  }
  return N;
}

/**
 * Build one garment. Returns { geometry, hidden: Set(tags of covered body faces) } or null.
 * `extraOff` grows every offset (outer layers over inner ones).
 */
export function buildGarment(rec, rig, spec, { level = rec.level, extraOff = 0, s = 1 } = {}) {
  const cage = rec.bodyCage;
  const { tags, quads, nv, D } = cage;
  const nf = tags.length;
  const N = cageNormals(cage);
  const sel = new Uint8Array(nf);
  let any = false;
  for (let f = 0; f < nf; f++) {
    const t = tags[f];
    if (spec.select(tagPart(t), tagRing(t), tagCol(t))) {
      sel[f] = 1;
      any = true;
    }
  }
  if (!any) return null;
  // Per-vertex offset = max over adjacent selected faces.
  const off = new Float32Array(nv);
  const touched = new Uint8Array(nv);
  const unselectedV = new Uint8Array(nv);
  for (let f = 0; f < nf; f++) {
    for (let i = 0; i < 4; i++) {
      const v = quads[f * 4 + i];
      if (sel[f]) {
        const t = tags[f];
        const o = (spec.off(tagPart(t), tagRing(t), tagCol(t)) + extraOff) * s;
        off[v] = Math.max(off[v], o);
        touched[v] = 1;
      } else unselectedV[v] = 1;
    }
  }
  // Body faces fully inside the garment (not touching its border) get hidden.
  const hidden = new Set();
  for (let f = 0; f < nf; f++) {
    if (!sel[f]) continue;
    let border = false;
    for (let i = 0; i < 4; i++) if (unselectedV[quads[f * 4 + i]]) border = true;
    if (!border) hidden.add(tags[f]);
  }
  // Offset copy of the cage, then keep the selected faces.
  const data = new Float32Array(cage.data);
  for (let v = 0; v < nv; v++) {
    if (!touched[v]) continue;
    data[v * D] += N[v * 3] * off[v];
    data[v * D + 1] += N[v * 3 + 1] * off[v];
    data[v * D + 2] += N[v * 3 + 2] * off[v];
  }
  let g = compact({ nv, D, data, quads: new Int32Array(quads), tags: new Int32Array(tags) }, (f) => sel[f] === 1).cage;
  if (spec.skirt) g = addSkirt(g, rig, spec.skirt, s);
  orientFaces(g);
  for (let i = 0; i < level; i++) g = subdivide(g);
  pushToLimit(g);
  if (spec.shoe) shapeShoe(g, spec.shoe, s, rig);
  return { geometry: toGeometry(g, rig, spec), hidden };
}

/** Free-hanging skirt tube appended below the garment's lowest ring. */
function addSkirt(g, rig, sk, s) {
  // Find the boundary loop with the lowest average y (the waist edge of the selection).
  const loops = boundaryLoops(g);
  if (!loops.length) return g;
  loops.sort((a, b) => avgY(g, a) - avgY(g, b));
  const loop = loops[0];
  const D = g.D;
  const n = loop.length;
  const y0 = avgY(g, loop);
  const yEnd = Math.max(0.25 * s, y0 - sk.length * s);
  const rings = 5;
  const data = Array.from(g.data);
  const quads = Array.from(g.quads);
  const tags = Array.from(g.tags);
  let prev = loop;
  const wOff = 3 + CAGE_ATTR;
  const bi = (name) => BODY_BONES.indexOf(name);
  const cx = loop.reduce((a, v) => a + g.data[v * D], 0) / n;
  const cz = loop.reduce((a, v) => a + g.data[v * D + 2], 0) / n;
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    const ids = [];
    for (let i = 0; i < n; i++) {
      const v = loop[i];
      const x = g.data[v * D];
      const z = g.data[v * D + 2];
      const fl = 1 + (sk.flare - 1) * t;
      const nvId = data.length / D;
      const row = new Array(D).fill(0);
      row[0] = cx + (x - cx) * fl;
      row[1] = y0 + (yEnd - y0) * t;
      row[2] = cz + (z - cz) * fl;
      // Weights: hips at the waist, sliding toward the thigh on that side further down.
      const side = x > 0 ? 'L' : 'R';
      const ws = Math.min(0.75, t * 0.9) * Math.min(1, Math.abs(x - cx) / (0.06 * s));
      row[wOff + bi('hips')] = 1 - ws;
      row[wOff + bi(`thigh.${side}`)] = ws;
      data.push(...row);
      ids.push(nvId);
    }
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      quads.push(prev[i], prev[i2], ids[i2], ids[i]);
      tags.push((PART.torso << 16) | (0 << 8));
    }
    prev = ids;
  }
  return { nv: data.length / D, D, data: Float32Array.from(data), quads: Int32Array.from(quads), tags: Int32Array.from(tags) };
}

function avgY(g, loop) {
  return loop.reduce((a, v) => a + g.data[v * g.D + 1], 0) / loop.length;
}

/** Ordered boundary loops of a quad mesh. */
export function boundaryLoops(g) {
  const count = new Map();
  const nf = g.quads.length / 4;
  for (let f = 0; f < nf; f++) {
    for (let i = 0; i < 4; i++) {
      const a = g.quads[f * 4 + i];
      const b = g.quads[f * 4 + ((i + 1) & 3)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      count.set(k, (count.get(k) || 0) + 1);
    }
  }
  const next = new Map();
  for (let f = 0; f < nf; f++) {
    for (let i = 0; i < 4; i++) {
      const a = g.quads[f * 4 + i];
      const b = g.quads[f * 4 + ((i + 1) & 3)];
      const k = a < b ? `${a},${b}` : `${b},${a}`;
      if (count.get(k) === 1) next.set(b, a); // walk opposite to the face winding
    }
  }
  const loops = [];
  const seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let v = start;
    while (v !== undefined && !seen.has(v)) {
      seen.add(v);
      loop.push(v);
      v = next.get(v);
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

/** Flatten the sole, lengthen/point the toe, add a heel block (cowboy). */
function shapeShoe(g, shoe, s, rig) {
  const D = g.D;
  const sole = shoe.sole * s;
  for (const side of ['L', 'R']) {
    const ank = rig.worldP[`foot.${side}`];
    for (let v = 0; v < g.nv; v++) {
      const o = v * D;
      const x = g.data[o];
      if ((x > 0) !== (side === 'L')) continue;
      let y = g.data[o + 1];
      let z = g.data[o + 2];
      const fwd = z - ank.z;
      if (shoe.toe !== 1 && fwd > 0.08 * s) z = ank.z + 0.08 * s + (fwd - 0.08 * s) * shoe.toe;
      if (shoe.heel && fwd < -0.01 * s && y < 0.05 * s) y = Math.min(y, 0.05 * s);
      // Soles: squash everything below the sole line onto a flat bottom.
      if (y < sole) y = sole * 0.25 + (y / sole) * sole * 0.05;
      if (shoe.heel && fwd < -0.015 * s) y = Math.max(y, 0.0);
      g.data[o + 1] = Math.max(0.002, y);
      g.data[o + 2] = z;
    }
  }
}

/** Skinned BufferGeometry + per-vertex cloth data (hem distance, height, side). */
function toGeometry(g, rig, spec) {
  const { nv, D, data } = g;
  const boneIndex = rig.boneIndex;
  const pos = new Float32Array(nv * 3);
  const si = new Uint16Array(nv * 4);
  const sw = new Float32Array(nv * 4);
  const wOff = 3 + CAGE_ATTR;
  const NB = BODY_BONES.length;
  const bmap = BODY_BONES.map((n) => boneIndex.get(n) ?? 0);
  for (let v = 0; v < nv; v++) {
    const o = v * D;
    pos[v * 3] = data[o];
    pos[v * 3 + 1] = data[o + 1];
    pos[v * 3 + 2] = data[o + 2];
    const top = [0, 0, 0, 0];
    const tw = [0, 0, 0, 0];
    for (let b = 0; b < NB; b++) {
      const w = data[o + wOff + b];
      if (w <= tw[3]) continue;
      let k = 3;
      while (k > 0 && w > tw[k - 1]) {
        tw[k] = tw[k - 1];
        top[k] = top[k - 1];
        k--;
      }
      tw[k] = w;
      top[k] = b;
    }
    const sum = tw[0] + tw[1] + tw[2] + tw[3] || 1;
    for (let k = 0; k < 4; k++) {
      si[v * 4 + k] = bmap[top[k]];
      sw[v * 4 + k] = tw[k] / sum;
    }
  }
  // Hem distance: multi-source Dijkstra-lite over edges from boundary vertices.
  const hem = new Float32Array(nv).fill(1);
  const loops = boundaryLoops(g);
  const adj = Array.from({ length: nv }, () => []);
  for (let f = 0; f < g.quads.length; f += 4) {
    for (let i = 0; i < 4; i++) {
      const a = g.quads[f + i];
      const b = g.quads[f + ((i + 1) & 3)];
      adj[a].push(b);
    }
  }
  const dist = new Float32Array(nv).fill(1e9);
  let frontier = [];
  for (const l of loops) for (const v of l) {
    dist[v] = 0;
    frontier.push(v);
  }
  for (let it = 0; it < 12 && frontier.length; it++) {
    const nextF = [];
    for (const a of frontier) {
      for (const b of adj[a]) {
        const d = dist[a] + Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
        if (d < dist[b] - 1e-6) {
          dist[b] = d;
          nextF.push(b);
        }
      }
    }
    frontier = nextF;
  }
  for (let v = 0; v < nv; v++) hem[v] = Math.min(1, dist[v] / 0.05);
  const idx = triangulate(g);
  // Hem fold: an inner copy of each boundary loop, tucked 5 mm inside, joined by a strip.
  const extraPos = [];
  const extraSI = [];
  const extraSW = [];
  const extraHem = [];
  let nvx = nv;
  const geoN = new THREE.BufferGeometry();
  geoN.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoN.setIndex(idx);
  geoN.computeVertexNormals();
  const nrm = geoN.attributes.normal.array;
  for (const loop of loops) {
    const ids = [];
    for (const v of loop) {
      extraPos.push(pos[v * 3] - nrm[v * 3] * 0.004, pos[v * 3 + 1] - nrm[v * 3 + 1] * 0.004, pos[v * 3 + 2] - nrm[v * 3 + 2] * 0.004);
      for (let k = 0; k < 4; k++) {
        extraSI.push(si[v * 4 + k]);
        extraSW.push(sw[v * 4 + k]);
      }
      extraHem.push(0);
      ids.push(nvx++);
    }
    for (let i = 0; i < loop.length; i++) {
      const i2 = (i + 1) % loop.length;
      idx.push(loop[i], ids[i], loop[i2], loop[i2], ids[i], ids[i2]);
    }
  }
  const geo = new THREE.BufferGeometry();
  const allPos = new Float32Array(nvx * 3);
  allPos.set(pos);
  allPos.set(extraPos, nv * 3);
  const allSI = new Uint16Array(nvx * 4);
  allSI.set(si);
  allSI.set(extraSI, nv * 4);
  const allSW = new Float32Array(nvx * 4);
  allSW.set(sw);
  allSW.set(extraSW, nv * 4);
  const cloth = new Float32Array(nvx * 4);
  for (let v = 0; v < nvx; v++) {
    cloth[v * 4] = v < nv ? hem[v] : 0;
    cloth[v * 4 + 1] = allPos[v * 3 + 1];
    cloth[v * 4 + 2] = allPos[v * 3] > 0 ? 1 : 0;
    cloth[v * 4 + 3] = v < nv ? 0 : 1; // inner hem strip
  }
  geo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(allSI, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(allSW, 4));
  geo.setAttribute('aCloth', new THREE.BufferAttribute(cloth, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geoN.dispose();
  void spec;
  return geo;
}
