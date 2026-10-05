// Streets & ground for the downtown slice.
//
// The ground plane is split on every road edge / sidewalk line / reserved-lot edge into a grid of
// cells, each classified as road (y = 0), sidewalk or lot (raised by the 15 cm curb), trench
// (sunken rail cut) or void (reserved for another builder: only a collider at y = 0).
// From that grid we emit:
//   - asphalt with concrete gutter pans along every curb,
//   - sidewalks with real bevelled curbs and rounded (radius 4 m) corners at intersections,
//   - lane paint (double yellow, dashed lanes, parking stalls), worn continental crosswalks,
//     stop bars, storm drains, manholes and utility lids,
//   - the downtown train trench with board-formed walls, ballast, two tracks, top fences and the
//     Virginia St bridge deck + parapets,
//   - exact colliders for all of it (curbs climbable through the character autostep).

import * as THREE from 'three';
import { ROADS, roadRect, BOUNDS, TRENCH, RESERVED, CURB_H, WALK_W } from './layout.js';
import { mat } from '../../gfx/materials.js';
import { offsetMat, paintMat } from '../shared/kinds.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Rng } from '../../core/rng.js';

const CURB_W = 0.16;
const CORNER_R = WALK_W;

/**
 * @param {object} ctx { batch, colliders, decals, props, rng }
 * @param {object} opts { surfaces: [{x0,x1,z0,z1,kind}] lot surface overrides }
 */
export function buildGround(ctx, opts = {}) {
  const { batch, colliders } = ctx;
  const rng = new Rng('reno-ground');
  const roads = ROADS.map((r) => ({ ...r, rect: roadRect(r) }));
  const surfaces = opts.surfaces || [];
  const voids = [RESERVED.eldoradoInterior, RESERVED.starlite];

  // ---- grid breakpoints ----
  const xsSet = new Set([BOUNDS.x0, BOUNDS.x1]);
  const zsSet = new Set([BOUNDS.z0, BOUNDS.z1, TRENCH.z0, TRENCH.z1]);
  const addX = (x) => x > BOUNDS.x0 && x < BOUNDS.x1 && xsSet.add(+x.toFixed(3));
  const addZ = (z) => z > BOUNDS.z0 && z < BOUNDS.z1 && zsSet.add(+z.toFixed(3));
  for (const r of roads) {
    const R = r.rect;
    [R.x0, R.x1, R.x0 - WALK_W, R.x1 + WALK_W].forEach(addX);
    [R.z0, R.z1, R.z0 - WALK_W, R.z1 + WALK_W].forEach(addZ);
  }
  for (const v of voids) {
    addX(v.x0);
    addX(v.x1);
    addZ(v.z0);
    addZ(v.z1);
  }
  for (const s of surfaces) {
    addX(s.x0);
    addX(s.x1);
    addZ(s.z0);
    addZ(s.z1);
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const zs = [...zsSet].sort((a, b) => a - b);
  const NX = xs.length - 1;
  const NZ = zs.length - 1;

  const inRect = (x, z, R, pad = 0) => x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad;
  const onBridge = (x) => Math.abs(x) < 11 + 1e-3;
  const cells = [];
  const cell = (i, j) => (i < 0 || j < 0 || i >= NX || j >= NZ ? null : cells[j * NX + i]);
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const z0 = zs[j];
      const z1 = zs[j + 1];
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      let type = 'lot';
      const inTrench = cz > TRENCH.z0 && cz < TRENCH.z1;
      if (roads.some((r) => inRect(cx, cz, r.rect))) type = 'road';
      else if (inTrench && !onBridge(cx)) type = 'trench';
      else if (voids.some((v) => inRect(cx, cz, v))) type = 'void';
      else if (roads.some((r) => inRect(cx, cz, r.rect, WALK_W))) type = 'walk';
      if (type === 'road' && inTrench && !onBridge(cx)) type = 'trench';
      const surf = surfaces.find((s) => inRect(cx, cz, s));
      cells.push({ i, j, x0, x1, z0, z1, cx, cz, type, surf: surf?.kind || null, bridge: inTrench && onBridge(cx) });
    }
  }

  // ---- materials ----
  const M = {
    asphalt: mat('asphalt', { seed: 3 }),
    walk: mat('sidewalk', { seed: 5 }),
    curb: mat('curb', { seed: 2 }),
    curbRed: mat('curb', { seed: 2, color: 0xa3352b }),
    gutter: offsetMat(mat('concrete', { seed: 11, dirt: 0.65 }), -1),
    lot: mat('concrete', { seed: 4, dirt: 0.6, wear: 0.6 }),
    parking: mat('asphalt', { seed: 9, wear: 0.75, dirt: 0.6 }),
    dirt: mat('dirt', { seed: 6 }),
    gravel: mat('gravel', { seed: 3 }),
    wall: mat('board-concrete', { seed: 2 }),
    ballast: mat('ballast'),
    steel: mat('steel', { wear: 0.6, dirt: 0.5 }),
    rail: mat('steel', { seed: 3, wear: 0.9, dirt: 0.2 }),
    tie: mat('concrete', { seed: 21, dirt: 0.7 }),
    iron: mat('metal-painted', { color: 0x2a2826, wear: 0.6, dirt: 0.6, seed: 4 }),
    fence: mat('metal-painted', { color: 0x1d1f20, wear: 0.4, dirt: 0.3, seed: 8 }),
  };
  const surfMat = (c) => {
    if (c.type === 'walk') return M.walk;
    if (c.surf === 'parking') return M.parking;
    if (c.surf === 'dirt') return M.dirt;
    if (c.surf === 'gravel') return M.gravel;
    if (c.surf === 'sidewalk') return M.walk;
    return M.lot;
  };

  const planeGeo = (w, d) => new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  const flat = (x0, x1, z0, z1, y, material, o = {}) => {
    const g = planeGeo(x1 - x0, z1 - z0);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    batch.add(g, material, { castShadow: false, receiveShadow: true, ...o });
  };

  // ---- corners: walk cells with road on one X side and one Z side ----
  for (const c of cells) {
    if (c.type !== 'walk') continue;
    const L = cell(c.i - 1, c.j)?.type === 'road';
    const Rr = cell(c.i + 1, c.j)?.type === 'road';
    const U = cell(c.i, c.j - 1)?.type === 'road';
    const D = cell(c.i, c.j + 1)?.type === 'road';
    const sq = Math.abs(c.x1 - c.x0 - WALK_W) < 0.01 && Math.abs(c.z1 - c.z0 - WALK_W) < 0.01;
    if ((L || Rr) && (U || D) && sq) {
      c.corner = { cx: L ? c.x1 : c.x0, cz: U ? c.z1 : c.z0, sx: L ? -1 : 1, sz: U ? -1 : 1 };
    }
  }

  // ---- surfaces ----
  for (const c of cells) {
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    if (c.type === 'road') {
      flat(c.x0, c.x1, c.z0, c.z1, 0, M.asphalt);
    } else if (c.type === 'walk' || c.type === 'lot') {
      if (c.corner) buildCorner(c);
      else {
        // Inset the top where a curb runs along an edge (the curb has its own bevelled top).
        const e = edgesToRoad(c);
        flat(c.x0 + (e.W ? CURB_W : 0), c.x1 - (e.E ? CURB_W : 0), c.z0 + (e.N ? CURB_W : 0), c.z1 - (e.S ? CURB_W : 0), CURB_H, surfMat(c));
      }
    } else if (c.type === 'trench') {
      flat(c.x0, c.x1, c.z0, c.z1, -TRENCH.depth, M.ballast);
    }
    if (c.bridge && (c.type === 'road' || c.type === 'walk')) {
      // Bridge deck underside + edge beams visible from the trench.
      batch.box(c.cx, -0.75, c.cz, w, 1.2, d, M.wall);
    }
  }

  function edgesToRoad(c) {
    return {
      W: cell(c.i - 1, c.j)?.type === 'road',
      E: cell(c.i + 1, c.j)?.type === 'road',
      N: cell(c.i, c.j - 1)?.type === 'road',
      S: cell(c.i, c.j + 1)?.type === 'road',
    };
  }

  // ---- colliders: merge runs of equal height per row ----
  const heightOf = (c) => (c.type === 'walk' || c.type === 'lot' ? CURB_H : c.type === 'trench' ? null : 0);
  for (let j = 0; j < NZ; j++) {
    let run = null;
    const flush = () => {
      if (!run) return;
      const top = run.h;
      colliders.aabb(run.x0, top - 1, zs[j], run.x1, top, zs[j + 1]);
      run = null;
    };
    for (let i = 0; i < NX; i++) {
      const c = cell(i, j);
      const h = c.corner ? 'corner' : heightOf(c);
      if (h === null || h === 'corner') {
        flush();
        if (h === 'corner') colliders.aabb(c.x0, -1, c.z0, c.x1, 0, c.z1); // road part; raised sector trimesh added in buildCorner
        continue;
      }
      if (run && run.h === h) run.x1 = c.x1;
      else {
        flush();
        run = { x0: c.x0, x1: c.x1, h };
      }
    }
    flush();
  }

  // ---- curbs + gutters along every walk/lot edge that meets a road ----
  const curbRuns = []; // {axis, fixed, a0, a1, side} side: +1 → sidewalk on +side
  for (const c of cells) {
    if (!(c.type === 'walk' || c.type === 'lot') || c.corner) continue;
    const e = edgesToRoad(c);
    if (e.W) curbRuns.push({ axis: 'z', fixed: c.x0, a0: c.z0, a1: c.z1, side: 1 });
    if (e.E) curbRuns.push({ axis: 'z', fixed: c.x1, a0: c.z0, a1: c.z1, side: -1 });
    if (e.N) curbRuns.push({ axis: 'x', fixed: c.z0, a0: c.x0, a1: c.x1, side: 1 });
    if (e.S) curbRuns.push({ axis: 'x', fixed: c.z1, a0: c.x0, a1: c.x1, side: -1 });
  }
  // Merge collinear touching runs.
  curbRuns.sort((a, b) => (a.axis + a.fixed + a.side).localeCompare(b.axis + b.fixed + b.side) || a.a0 - b.a0);
  const merged = [];
  for (const r of curbRuns) {
    const last = merged[merged.length - 1];
    if (last && last.axis === r.axis && last.fixed === r.fixed && last.side === r.side && Math.abs(last.a1 - r.a0) < 1e-3) last.a1 = r.a1;
    else merged.push({ ...r });
  }
  ctx.curbs = merged; // other builders (red curbs at hydrants, bus stops) can read these
  for (const r of merged) {
    const len = r.a1 - r.a0;
    const geo = new RoundedBoxGeometry(r.axis === 'x' ? len : CURB_W, CURB_H + 0.01, r.axis === 'x' ? CURB_W : len, 2, 0.025);
    const off = r.side * CURB_W / 2;
    const mid = (r.a0 + r.a1) / 2;
    const [x, z] = r.axis === 'x' ? [mid, r.fixed + off] : [r.fixed + off, mid];
    batch.add(geo, M.curb, { matrix: new THREE.Matrix4().makeTranslation(x, (CURB_H + 0.01) / 2 - 0.005, z), castShadow: false, grime: 0.5 });
    // Gutter pan on the road side.
    const gw = 0.55;
    const go = -r.side * gw / 2;
    const [gx, gz] = r.axis === 'x' ? [mid, r.fixed + go] : [r.fixed + go, mid];
    const g = planeGeo(r.axis === 'x' ? len : gw, r.axis === 'x' ? gw : len);
    g.translate(gx, 0.004, gz);
    batch.add(g, M.gutter, { castShadow: false });
  }

  // ---- rounded intersection corner ----
  function buildCorner(c) {
    const { cx, cz, sx, sz } = c.corner;
    // Corner sector centred at (cx, cz) (the sidewalk-side corner of the cell), radius R,
    // spanning the quadrant pointing toward the road (sx, sz).
    const R = CORNER_R;
    const segs = 18;
    const pts = (r) => {
      const out = [];
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        // from direction (0, sz) to (sx, 0)
        const ang = t * Math.PI / 2;
        out.push([cx + sx * Math.sin(ang) * r, cz + sz * Math.cos(ang) * r]);
      }
      return out;
    };
    // Sidewalk top (sector of radius R - curb width).
    const inner = pts(R - CURB_W);
    const top = new THREE.BufferGeometry();
    const tp = [cx, CURB_H, cz];
    for (const [x, z] of inner) tp.push(x, CURB_H, z);
    const ti = [];
    for (let k = 1; k <= segs; k++) ti.push(0, k, k + 1);
    top.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    top.setIndex(fixWinding(tp, ti));
    top.computeVertexNormals();
    batch.add(top, M.walk, { castShadow: false });
    // Curb band (top ring + outer face).
    const outer = pts(R);
    const bp = [];
    const bi = [];
    for (let k = 0; k <= segs; k++) {
      bp.push(inner[k][0], CURB_H + 0.005, inner[k][1], outer[k][0], CURB_H + 0.005, outer[k][1], outer[k][0], 0, outer[k][1]);
    }
    for (let k = 0; k < segs; k++) {
      const a = k * 3;
      const b = (k + 1) * 3;
      bi.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
    const band = new THREE.BufferGeometry();
    band.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    band.setIndex(fixWindingBand(bp, bi, cx, cz));
    band.computeVertexNormals();
    batch.add(band, M.curb, { castShadow: false });
    // Asphalt filling the rest of the square (cell minus the disc).
    const far = [cx + sx * WALK_W, cz + sz * WALK_W];
    const ap = [far[0], 0, far[1]];
    for (const [x, z] of outer) ap.push(x, 0, z);
    // add the two square corners adjacent to the far corner
    ap.push(cx + sx * WALK_W, 0, cz, cx, 0, cz + sz * WALK_W);
    const ai = [];
    const nOuter = outer.length;
    const cornerA = nOuter + 1; // (cx+sx*W, cz)
    const cornerB = nOuter + 2; // (cx, cz+sz*W)
    for (let k = 1; k < nOuter; k++) ai.push(0, k, k + 1);
    ai.push(0, nOuter, cornerA); // last outer point is (cx+sx*R, cz) → fan to corner A
    ai.push(0, cornerB, 1); // first outer point is (cx, cz+sz*R)
    const asp = new THREE.BufferGeometry();
    asp.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
    asp.setIndex(fixWinding(ap, ai));
    asp.computeVertexNormals();
    batch.add(asp, M.asphalt, { castShadow: false });
    // Gutter along the arc.
    const gOut = pts(R + 0.55);
    const gp = [];
    const gi = [];
    for (let k = 0; k <= segs; k++) gp.push(outer[k][0], 0.004, outer[k][1], gOut[k][0], 0.004, gOut[k][1]);
    for (let k = 0; k < segs; k++) {
      const a = k * 2;
      gi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    gg.setIndex(fixWinding(gp, gi));
    gg.computeVertexNormals();
    batch.add(gg, M.gutter, { castShadow: false });
    // Collider: raised sector as a trimesh (exact rounded curb).
    const shape = new THREE.Shape();
    shape.moveTo(cx, cz);
    for (const [x, z] of outer) shape.lineTo(x, z);
    shape.lineTo(cx, cz);
    const ex = new THREE.ExtrudeGeometry(shape, { depth: CURB_H + 1, bevelEnabled: false });
    // rotateX(+90°) maps (x, y, z) → (x, -z, y): shape y becomes world z, extrusion goes down.
    ex.rotateX(Math.PI / 2);
    const exMesh = new THREE.Mesh(ex);
    exMesh.position.y = CURB_H;
    colliders.trimesh(exMesh);
  }

  // ---- lane paint, crosswalks, stop bars ----
  buildMarkings(ctx, roads, M, rng);

  // ---- trench walls, tracks, fences, bridge parapets ----
  buildTrench(ctx, cells, cell, M, rng);

  // ---- drains, manholes, utility lids ----
  buildStreetHardware(ctx, merged, roads, M, rng);

  // Far ground beyond the built area (seen only through fog): a ring around the bounds so it
  // never sits under (and z-fights with) the streets.
  const farMat = mat('dirt', { seed: 12 });
  const E = 1500;
  const B = BOUNDS;
  for (const [x0, x1, z0, z1] of [
    [B.x0 - E, B.x1 + E, B.z0 - E, B.z0], [B.x0 - E, B.x1 + E, B.z1, B.z1 + E],
    [B.x0 - E, B.x0, B.z0, B.z1], [B.x1, B.x1 + E, B.z0, B.z1],
  ]) flat(x0, x1, z0, z1, 0, farMat, { chunk: 'landmark' });

  return { cells, xs, zs };
}

// Make every triangle face up (+Y) for flat fans regardless of how the points were ordered.
function fixWinding(p, idx) {
  const out = [];
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k];
    const b = idx[k + 1];
    const c = idx[k + 2];
    const ax = p[a * 3];
    const az = p[a * 3 + 2];
    const bx = p[b * 3];
    const bz = p[b * 3 + 2];
    const cx = p[c * 3];
    const cz = p[c * 3 + 2];
    // y of cross((b-a),(c-a)) = (bz-az)(cx-ax) - (bx-ax)(cz-az); want > 0 for +Y normal
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    if (ny >= 0) out.push(a, b, c);
    else out.push(a, c, b);
  }
  return out;
}

// For the curb band: horizontal tris face up; vertical tris face away from the arc centre.
function fixWindingBand(p, idx, ox, oz) {
  const out = [];
  const v = (i) => new THREE.Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  for (let k = 0; k < idx.length; k += 3) {
    const a = v(idx[k]);
    const b = v(idx[k + 1]);
    const c = v(idx[k + 2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    const centroid = a.clone().add(b).add(c).divideScalar(3);
    const want = Math.abs(n.y) > Math.hypot(n.x, n.z)
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(centroid.x - ox, 0, centroid.z - oz);
    if (n.dot(want) >= 0) out.push(idx[k], idx[k + 1], idx[k + 2]);
    else out.push(idx[k], idx[k + 2], idx[k + 1]);
  }
  return out;
}

// ---- Markings -----------------------------------------------------------------------------

function buildMarkings(ctx, roads, M, rng) {
  const { batch } = ctx;
  const white = paintMat(0xe6e3d8, { wear: 0.35 });
  const yellow = paintMat(0xd9a521, { wear: 0.35 });
  const quad = (x, z, w, d, material, ry = 0) => {
    const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).rotateY(ry);
    g.translate(x, 0.012, z);
    batch.add(g, material, { castShadow: false, receiveShadow: true, uv: 2.5 });
  };
  // Intersections: where two road rects overlap.
  const inters = [];
  for (let a = 0; a < roads.length; a++) {
    for (let b = a + 1; b < roads.length; b++) {
      const A = roads[a].rect;
      const B = roads[b].rect;
      const x0 = Math.max(A.x0, B.x0);
      const x1 = Math.min(A.x1, B.x1);
      const z0 = Math.max(A.z0, B.z0);
      const z1 = Math.min(A.z1, B.z1);
      if (x1 > x0 && z1 > z0) inters.push({ x0, x1, z0, z1, a: roads[a], b: roads[b] });
    }
  }
  ctx.intersections = inters;
  const inInter = (x, z, pad) => inters.some((I) => x > I.x0 - pad && x < I.x1 + pad && z > I.z0 - pad && z < I.z1 + pad);

  for (const r of roads) {
    const along = r.axis === 'x';
    const from = r.from;
    const to = r.to;
    const pad = 4.6; // keep lines out of crosswalks
    const lineAt = (offset, material, dash, width = 0.12) => {
      // Lines along the road at lateral offset, skipping intersections (+ crosswalk pad).
      const step = dash ? dash[0] + dash[1] : 2;
      for (let s = from; s < to; s += step) {
        const len = dash ? dash[0] : step;
        const mid = s + len / 2;
        const [x, z] = along ? [mid, r.c + offset] : [r.c + offset, mid];
        if (inInter(x, z, pad)) continue;
        quad(x, z, along ? len : width, along ? width : len, material);
      }
    };
    if (r.lanes === 'virginia') {
      lineAt(-0.12, yellow, null);
      lineAt(0.12, yellow, null);
      lineAt(-3.5, white, [3, 9]);
      lineAt(3.5, white, [3, 9]);
    } else if (r.lanes === '4th') {
      lineAt(-0.12, yellow, null);
      lineAt(0.12, yellow, null);
      lineAt(-4.6, white, null, 0.1);
      lineAt(4.6, white, null, 0.1);
      // Parking stall ticks.
      for (let s = from + 3; s < to; s += 6.5) {
        for (const side of [-1, 1]) {
          const z = r.c + side * 5.8;
          if (inInter(s, z, pad + 2)) continue;
          quad(s, z, 0.1, 2.3, white);
        }
      }
    } else {
      lineAt(-0.1, yellow, [4, 6]);
    }
  }

  // Crosswalks (continental bars) + stop bars on each approach to signalised intersections.
  for (const I of inters) {
    const cx = (I.x0 + I.x1) / 2;
    const cz = (I.z0 + I.z1) / 2;
    const big = I.a.id === 'virginia' || I.b.id === 'virginia';
    // The four approaches: crosswalk strip just outside the box.
    const approaches = [
      { axis: 'x', pos: I.x0 - 2.2, span: [I.z0, I.z1], stop: I.x0 - 5.2 },
      { axis: 'x', pos: I.x1 + 2.2, span: [I.z0, I.z1], stop: I.x1 + 5.2 },
      { axis: 'z', pos: I.z0 - 2.2, span: [I.x0, I.x1], stop: I.z0 - 5.2 },
      { axis: 'z', pos: I.z1 + 2.2, span: [I.x0, I.x1], stop: I.z1 + 5.2 },
    ];
    for (const ap of approaches) {
      // Skip approaches that lead nowhere (road ends right at the intersection).
      const testX = ap.axis === 'x' ? ap.pos : cx;
      const testZ = ap.axis === 'z' ? ap.pos : cz;
      if (!roads.some((r) => testX > r.rect.x0 && testX < r.rect.x1 && testZ > r.rect.z0 && testZ < r.rect.z1)) continue;
      const [s0, s1] = ap.span;
      if (big) {
        for (let s = s0 + 0.5; s < s1 - 0.3; s += 1.2) {
          const w = 0.6;
          if (ap.axis === 'x') quad(ap.pos, s + w / 2, 3.0, w, white);
          else quad(s + w / 2, ap.pos, w, 3.0, white);
        }
      } else {
        // Two-line ladder.
        for (const o of [-1.4, 1.4]) {
          if (ap.axis === 'x') quad(ap.pos + o, (s0 + s1) / 2, 0.25, s1 - s0, white);
          else quad((s0 + s1) / 2, ap.pos + o, s1 - s0, 0.25, white);
        }
      }
      // Stop bar on the inbound half only.
      const half = (s1 - s0) / 2;
      const inboundSign = ap.axis === 'x' ? (ap.pos < cx ? 1 : -1) : (ap.pos < cz ? -1 : 1);
      const center = (s0 + s1) / 2 + (inboundSign * half) / 2;
      if (ap.axis === 'x') quad(ap.stop, center, 0.45, half - 0.4, white);
      else quad(center, ap.stop, half - 0.4, 0.45, white);
    }
  }
  void rng;
}

// ---- Trench -------------------------------------------------------------------------------

function buildTrench(ctx, cells, cell, M, rng) {
  const { batch, colliders } = ctx;
  const D = TRENCH.depth;
  // Walls: every trench cell edge that meets a non-trench cell.
  for (const c of cells) {
    if (c.type !== 'trench') continue;
    const nb = [
      [cell(c.i, c.j - 1), 'N'],
      [cell(c.i, c.j + 1), 'S'],
      [cell(c.i - 1, c.j), 'W'],
      [cell(c.i + 1, c.j), 'E'],
    ];
    for (const [n, dir] of nb) {
      if (!n || n.type === 'trench' || n.bridge) continue;
      const top = n.type === 'road' ? 0 : CURB_H;
      const h = D + top + 1.2; // into the bridge deck / ground
      const t = 0.6;
      if (dir === 'N' || dir === 'S') {
        const z = dir === 'N' ? c.z0 - t / 2 : c.z1 + t / 2;
        batch.box(c.cx, top - h / 2, z, c.x1 - c.x0, h, t, M.wall, { grime: 0.6, grimeBase: -D });
        colliders.box(c.cx, top - h / 2, z, c.x1 - c.x0, h, t);
      } else {
        const x = dir === 'W' ? c.x0 - t / 2 : c.x1 + t / 2;
        batch.box(x, top - h / 2, c.cz, t, h, c.z1 - c.z0, M.wall, { grime: 0.6, grimeBase: -D });
        colliders.box(x, top - h / 2, c.cz, t, h, c.z1 - c.z0);
      }
    }
    colliders.aabb(c.x0, -D - 1, c.z0, c.x1, -D, c.z1);
  }
  // Under the Virginia St bridge: ballast floor and the trench walls continue below the deck.
  for (const c of cells) {
    if (!c.bridge) continue;
    batch.add(new THREE.PlaneGeometry(c.x1 - c.x0, c.z1 - c.z0).rotateX(-Math.PI / 2).translate(c.cx, -D, c.cz), M.ballast, { castShadow: false });
    colliders.aabb(c.x0, -D - 1, c.z0, c.x1, -D, c.z1);
    const h = D - 1.3;
    for (const z of [TRENCH.z0 - 0.3, TRENCH.z1 + 0.3]) {
      batch.box(c.cx, -D + h / 2, z, c.x1 - c.x0, h, 0.6, M.wall, { grime: 0.6, grimeBase: -D });
      colliders.box(c.cx, -D + h / 2, z, c.x1 - c.x0, h, 0.6);
    }
  }

  // Tracks: two lines along X.
  const x0 = -150;
  const x1 = 300;
  const len = x1 - x0;
  for (const tz of [TRENCH.z0 + 3.1, TRENCH.z1 - 3.1]) {
    // Raised ballast shoulder.
    const shoulder = new THREE.CylinderGeometry(1.8, 1.8, len, 10, 1, true, -Math.PI / 2 - 0.9, 1.8);
    shoulder.rotateZ(Math.PI / 2);
    shoulder.scale(1, 0.18, 1);
    shoulder.translate((x0 + x1) / 2, -D - 0.02, tz);
    batch.add(shoulder, M.ballast, { castShadow: false });
    for (const rz of [-0.7175, 0.7175]) {
      // Rail: head + web + foot profile extruded along x.
      const s = new THREE.Shape();
      s.moveTo(-0.075, 0);
      s.lineTo(0.075, 0);
      s.lineTo(0.075, 0.012);
      s.lineTo(0.009, 0.03);
      s.lineTo(0.009, 0.13);
      s.lineTo(0.036, 0.14);
      s.lineTo(0.036, 0.172);
      s.lineTo(-0.036, 0.172);
      s.lineTo(-0.036, 0.14);
      s.lineTo(-0.009, 0.13);
      s.lineTo(-0.009, 0.03);
      s.lineTo(-0.075, 0.012);
      s.closePath();
      const rg = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
      rg.rotateY(Math.PI / 2);
      rg.translate(x0, -D + 0.33, tz + rz);
      batch.add(rg, M.rail, { castShadow: true });
    }
  }
  // Concrete ties: instanced.
  const tieGeo = new THREE.BoxGeometry(0.26, 0.2, 2.6);
  const n = Math.floor(len / 0.61) * 2;
  const ties = new THREE.InstancedMesh(tieGeo, M.tie, n);
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (const tz of [TRENCH.z0 + 3.1, TRENCH.z1 - 3.1]) {
    for (let x = x0 + 0.3; x < x1 && k < n; x += 0.61) {
      m4.makeRotationY((rng.next() - 0.5) * 0.02);
      m4.setPosition(x, -D + 0.23, tz);
      ties.setMatrixAt(k++, m4);
    }
  }
  ties.count = k;
  ties.receiveShadow = true;
  ties.castShadow = false;
  ties.name = 'rail-ties';
  ctx.extraMeshes.push(ties);

  // Top-of-wall parapet + tall black picket fence wherever ground meets the trench (not bridge).
  const fenceH = 1.9;
  const pickets = [];
  const parapet = (x, z, len, alongX, top) => {
    const [w, d] = alongX ? [len, 0.5] : [0.5, len];
    batch.box(x, top + 0.55, z, w, 1.1, d, M.wall, { grime: 0.5, grimeBase: top });
    batch.box(x, top + 1.18, z, alongX ? len : 0.12, 0.08, alongX ? 0.12 : len, M.steel);
    colliders.box(x, top + 0.7, z, w, 1.4, d);
  };
  for (const c of cells) {
    if (c.type !== 'trench') continue;
    // Bridge edges (east/west sides of the Virginia St deck): parapet on the deck.
    for (const [n, side] of [[cell(c.i - 1, c.j), -1], [cell(c.i + 1, c.j), 1]]) {
      if (!n?.bridge) continue;
      const top = n.type === 'road' ? 0 : CURB_H;
      parapet(side < 0 ? c.x0 - 0.25 : c.x1 + 0.25, c.cz, c.z1 - c.z0, false, top);
    }
    for (const [n, side] of [[cell(c.i, c.j - 1), -1], [cell(c.i, c.j + 1), 1]]) {
      if (!n || n.type === 'trench') continue;
      const top = n.type === 'road' ? 0 : CURB_H;
      const z = side < 0 ? c.z0 - 0.3 : c.z1 + 0.3;
      const w = c.x1 - c.x0;
      if (n.type === 'road') {
        parapet(c.cx, z, w, true, top);
        continue;
      }
      batch.box(c.cx, top + 0.3, z, w, 0.6, 0.5, M.wall, { grime: 0.5, grimeBase: top });
      // Rails.
      batch.box(c.cx, top + 0.62 + 0.05, z, w, 0.06, 0.06, M.fence);
      batch.box(c.cx, top + 0.6 + fenceH - 0.05, z, w, 0.06, 0.06, M.fence);
      for (let x = c.x0 + 0.06; x < c.x1; x += 0.14) pickets.push([x, top + 0.6, z]);
      // Posts every 2.4 m.
      for (let x = c.x0 + 1.2; x < c.x1; x += 2.4) batch.box(x, top + 0.6 + fenceH / 2, z, 0.08, fenceH, 0.08, M.fence);
      colliders.box(c.cx, top + 1.3, z, w, 2.6, 0.5);
    }
  }
  const pg = new THREE.BoxGeometry(0.022, fenceH, 0.022);
  pg.translate(0, fenceH / 2, 0);
  const pk = new THREE.InstancedMesh(pg, M.fence, pickets.length);
  pickets.forEach((p, i) => {
    m4.makeTranslation(p[0], p[1], p[2]);
    pk.setMatrixAt(i, m4);
  });
  pk.castShadow = true;
  pk.receiveShadow = true;
  pk.name = 'trench-pickets';
  ctx.extraMeshes.push(pk);
}

// ---- Drains, manholes, lids -------------------------------------------------------------------

function buildStreetHardware(ctx, curbs, roads, M, rng) {
  const { batch } = ctx;
  const grate = makeGrateGeometry();
  const lid = new THREE.CylinderGeometry(0.34, 0.34, 0.03, 28);
  const lidMat = mat('metal-painted', { color: 0x2b2a28, wear: 0.9, dirt: 0.5, seed: 31 });
  const ironMat = M.iron;
  // Storm drain grates in the gutter every ~45 m along each curb.
  for (const r of curbs) {
    const len = r.a1 - r.a0;
    if (len < 12) continue;
    const n = Math.max(1, Math.floor(len / 45));
    for (let k = 0; k < n; k++) {
      const a = r.a0 + ((k + 0.5) / n) * len + rng.range(-3, 3);
      const off = -r.side * 0.38;
      const [x, z] = r.axis === 'x' ? [a, r.fixed + off] : [r.fixed + off, a];
      const ry = r.axis === 'x' ? 0 : Math.PI / 2;
      batch.add(grate, ironMat, { matrix: new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0.006, z), castShadow: false, uv: 'keep' });
      // Curb-face inlet opening (dark slot) above the grate.
      const slot = new THREE.PlaneGeometry(0.9, 0.07);
      const face = r.axis === 'x' ? (r.side > 0 ? Math.PI : 0) : (r.side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const sx = r.axis === 'x' ? a : r.fixed - r.side * 0.005;
      const sz = r.axis === 'x' ? r.fixed - r.side * 0.005 : a;
      batch.add(slot, mat('rubber', { color: 0x0b0b0b }), { matrix: new THREE.Matrix4().makeRotationY(face).setPosition(sx, 0.07, sz), castShadow: false, uv: 'keep' });
    }
  }
  // Manholes in lanes.
  for (const r of roads) {
    const along = r.axis === 'x';
    const lo = Math.max(r.from, r.play[0]);
    const hi = Math.min(r.to, r.play[1]);
    for (let s = lo + 15; s < hi; s += rng.range(28, 55)) {
      const lat = rng.pick([-2.2, 2.2, -1.6, 1.8]);
      const [x, z] = along ? [s, r.c + lat] : [r.c + lat, s];
      if (z > TRENCH.z0 - 1 && z < TRENCH.z1 + 1) continue;
      batch.add(lid, lidMat, { matrix: new THREE.Matrix4().makeRotationY(rng.next() * 6).setPosition(x, 0.0, z), castShadow: false, uv: 0.7 });
    }
  }
}

function makeGrateGeometry() {
  const geos = [];
  const frame = new THREE.BoxGeometry(1.0, 0.02, 0.5);
  geos.push(frame);
  const g = new THREE.BufferGeometry();
  // Bars: a frame with 9 slots → build as boxes merged.
  const bars = [];
  for (let i = 0; i < 10; i++) {
    const b = new THREE.BoxGeometry(0.03, 0.025, 0.46);
    b.translate(-0.45 + i * 0.1, 0.012, 0);
    bars.push(b);
  }
  void g;
  const all = [frame, ...bars].map((x) => x.toNonIndexed());
  const pos = [];
  const nor = [];
  const uv = [];
  for (const a of all) {
    pos.push(...a.attributes.position.array);
    nor.push(...a.attributes.normal.array);
    uv.push(...a.attributes.uv.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
