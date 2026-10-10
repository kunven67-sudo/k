// The Eldorado floor's architecture: carpet and marble floors with baked light pools, finished
// walls (dark wood wainscot, damask, gilded cornice, marble pilasters, sconces), a coffered
// dropped ceiling with lit coffers, eye-in-the-sky domes and crystal chandeliers, the painted dome
// over the fountain, and marble columns. Everything static goes through the shared StaticBatch
// (one draw call per material); repeated small parts (crystals, bulbs, smoked domes) are instanced.
//
//   buildRoom(C)   C = { batch, colliders, M, spots, glows, pool, rng, tier, group, add, chandeliers }
import * as THREE from 'three';
import { tinted } from '../../world/shared/batch.js';
import {
  FLOOR_Y, CEIL_Y, CEIL_H, COFFER_DEPTH, SHELL, SKIN, CHAMFER, DOORS, DOOR_TOP, FOYER, FOUNTAIN, CAGE, BAR,
  RESTROOMS, ELEVATORS, ESCALATOR, COLUMNS, insideShell,
} from '../layout.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
export const CELL = 4.8;
export const XB = Array.from({ length: 15 }, (_, i) => +(SHELL.x0 + i * CELL).toFixed(3));
export const ZB = Array.from({ length: 18 }, (_, k) => +(50 + (k - 7) * CELL).toFixed(3)); // 16.4 … 98.0
const DOME_R = FOUNTAIN.domeR;

export function buildRoom(C) {
  buildFloor(C);
  buildWalls(C);
  const coffers = buildCeiling(C);
  buildDome(C);
  buildColumns(C);
  return { coffers };
}

// ---- helpers ----------------------------------------------------------------------------

/** Turn a closed mesh inside-out (normals and winding), for surfaces seen from inside. */
export function insideOut(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i += 3) {
    for (const a of [p, n, uv].filter(Boolean)) {
      const s = a.itemSize;
      for (let k = 0; k < s; k++) {
        const t = a.array[(i + 1) * s + k];
        a.array[(i + 1) * s + k] = a.array[(i + 2) * s + k];
        a.array[(i + 2) * s + k] = t;
      }
    }
  }
  if (n) for (let i = 0; i < n.array.length; i++) n.array[i] = -n.array[i];
  return g;
}

/** Local wall frame: x along the run (0 … len), y up (world y), z inward from the shell face. */
function wallFrame(ax, az, bx, bz) {
  const along = new THREE.Vector3(bx - ax, 0, bz - az);
  const len = along.length();
  along.normalize();
  const inward = new THREE.Vector3().crossVectors(along, UP);
  const m = new THREE.Matrix4().makeBasis(along, UP, inward).setPosition(ax, 0, az);
  return { m, len, along, inward, a: new THREE.Vector3(ax, 0, az) };
}

// ---- floor ------------------------------------------------------------------------------

const MARBLE_RECTS = [
  { x0: FOYER.x0, x1: SHELL.x1, z0: FOYER.z0, z1: FOYER.z1 }, // foyer
  { x0: SHELL.x0, x1: CAGE.front + 3.4, z0: CAGE.z0 - 1.0, z1: CAGE.z1 + 1.0 }, // cage counter apron
  { x0: RESTROOMS.x0, x1: RESTROOMS.x1, z0: RESTROOMS.z0, z1: RESTROOMS.z1 }, // restroom corridor
  { x0: ELEVATORS.x0, x1: ELEVATORS.x1, z0: ELEVATORS.z0, z1: ELEVATORS.z1 }, // elevator lobby
];
const RING_OUT = FOUNTAIN.ringR + 0.45;

export function inMarble(x, z) {
  for (const r of MARBLE_RECTS) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  return Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) <= RING_OUT;
}

function buildFloor(C) {
  const { M, add, colliders } = C;
  // Carpet: a 1.2 m grid (for the baked light) minus cells entirely under marble / outside.
  const cs = 1.2;
  const nx = Math.ceil((SHELL.x1 - SHELL.x0) / cs);
  const nz = Math.ceil((SHELL.z1 - SHELL.z0) / cs);
  const vx = (i) => Math.min(SHELL.x1, SHELL.x0 + i * cs);
  const vz = (j) => Math.min(SHELL.z1, SHELL.z0 + j * cs);
  const pos = [];
  const idx = [];
  const vid = new Map();
  const v = (i, j) => {
    const k = i * 10000 + j;
    let id = vid.get(k);
    if (id == null) {
      id = pos.length / 3;
      pos.push(vx(i), FLOOR_Y, vz(j));
      vid.set(k, id);
    }
    return id;
  };
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x0 = vx(i);
      const x1 = vx(i + 1);
      const z0 = vz(j);
      const z1 = vz(j + 1);
      const corners = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]];
      if (corners.every(([x, z]) => inMarble(x, z))) continue;
      if (corners.every(([x, z]) => !insideShell(x, z, -0.6))) continue;
      const a = v(i, j);
      const b = v(i + 1, j);
      const c = v(i, j + 1);
      const d = v(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
  }
  const carpet = new THREE.BufferGeometry();
  carpet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  carpet.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  carpet.setIndex(idx);
  C.addBaked(carpet, tinted(M.carpet), 1, wallShade, { castShadow: false });

  // Marble: foyer, cage apron, restroom corridor, elevator lobby (subdivided for the bake).
  const my = FLOOR_Y + 0.006;
  for (const r of MARBLE_RECTS) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const g = new THREE.PlaneGeometry(w, d, Math.max(1, Math.round(w / 1.2)), Math.max(1, Math.round(d / 1.2))).rotateX(-Math.PI / 2).translate((r.x0 + r.x1) / 2, my, (r.z0 + r.z1) / 2);
    C.addBaked(g, tinted(M.marble), 1.05, wallShade, { castShadow: false });
    // Brass edge strip where marble meets carpet (hides the joint).
    const strips = [];
    if (r.x0 > SHELL.x0 + 0.1) strips.push([r.x0, (r.z0 + r.z1) / 2, 0.035, d]);
    if (r.x1 < SHELL.x1 - 0.1) strips.push([r.x1, (r.z0 + r.z1) / 2, 0.035, d]);
    if (r.z0 > SHELL.z0 + 0.1) strips.push([(r.x0 + r.x1) / 2, r.z0, w, 0.035]);
    if (r.z1 < SHELL.z1 - 0.1) strips.push([(r.x0 + r.x1) / 2, r.z1, w, 0.035]);
    for (const [x, z, sw, sd] of strips) add(new THREE.BoxGeometry(sw, 0.012, sd).translate(x, FLOOR_Y + 0.004, z), M.brass, { castShadow: false });
  }
  // Fountain plaza: cream marble ring with a red-marble compass star and a dark border.
  const ring = new THREE.RingGeometry(FOUNTAIN.basinR - 0.1, FOUNTAIN.ringR, 120, 8).rotateX(-Math.PI / 2).translate(FOUNTAIN.x, my, FOUNTAIN.z);
  C.addBaked(ring, tinted(M.marble), 1.05, null, { castShadow: false });
  const border = new THREE.RingGeometry(FOUNTAIN.ringR, RING_OUT, 120, 1).rotateX(-Math.PI / 2).translate(FOUNTAIN.x, my, FOUNTAIN.z);
  C.addBaked(border, tinted(M.marbleDark), 0.9, null, { castShadow: false });
  for (const r of [FOUNTAIN.ringR + 0.02, RING_OUT - 0.02]) add(new THREE.RingGeometry(r - 0.02, r + 0.02, 120, 1).rotateX(-Math.PI / 2).translate(FOUNTAIN.x, my + 0.0015, FOUNTAIN.z), M.brass, { castShadow: false });
  // Star: 16 long thin rays (alternating red / green marble) between the basin and the border.
  const star = [];
  const starG = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + Math.PI / 16;
    const long = k % 2 === 0;
    const r0 = FOUNTAIN.basinR + 0.35;
    const r1 = long ? FOUNTAIN.ringR - 0.45 : FOUNTAIN.ringR - 1.9;
    const hw = long ? 0.42 : 0.3;
    const s = new THREE.Shape([new THREE.Vector2(r0, -hw), new THREE.Vector2(r1, 0), new THREE.Vector2(r0, hw)]);
    const g = new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(-a).translate(FOUNTAIN.x, my + 0.001, FOUNTAIN.z);
    (long ? star : starG).push(g);
  }
  for (const g of star) add(g, M.marbleRed, { castShadow: false });
  for (const g of starG) add(g, M.marbleGreen, { castShadow: false });

  // One floor collider for the whole room (the city leaves the casino volume at y = 0).
  colliders.aabb(SHELL.x0, FLOOR_Y - 1, SHELL.z0, SHELL.x1, FLOOR_Y, SHELL.z1);
}

/** Corners and wall bases sit in shadow: darken the bake within ~1.5 m of a wall. */
export function wallShade(x, _y, z) {
  const d = Math.min(x - SHELL.x0, SHELL.x1 - x, z - SHELL.z0, SHELL.z1 - z, (CHAMFER.a[0] - CHAMFER.a[1] - (x - z)) / Math.SQRT2);
  const k = Math.min(1, Math.max(0, d / 1.6));
  return 0.72 + 0.28 * k * k * (3 - 2 * k);
}

// ---- walls ------------------------------------------------------------------------------

function buildWalls(C) {
  const runs = [];
  const sq = Math.SQRT1_2;
  // Door openings along each run, in world coordinates [x, z] at each end.
  const vDoors = DOORS.virginia.map((d) => [[SHELL.x1, d.z0], [SHELL.x1, d.z1]]);
  const fDoor = [[DOORS.fourth.x0, SHELL.z0], [DOORS.fourth.x1, SHELL.z0]];
  const chA = new THREE.Vector2(...CHAMFER.a);
  const chDir = new THREE.Vector2(-sq, -sq);
  const cDoor = [chA.clone().addScaledVector(chDir, 1.23), chA.clone().addScaledVector(chDir, 5.5)].map((p) => [p.x, p.y]);
  // Areas where something stands against the wall: no pilasters / sconces there.
  const busy = [
    { x0: CAGE.x0 - 1, x1: CAGE.front + 0.6, z0: CAGE.z0 - 0.4, z1: CAGE.z1 + 0.4 },
    { x0: BAR.x0, x1: BAR.x1 + 0.6, z0: BAR.back - 0.6, z1: BAR.z1 + 1 },
    { x0: RESTROOMS.x0 - 1, x1: RESTROOMS.x1 + 0.4, z0: RESTROOMS.z0 - 0.4, z1: RESTROOMS.z1 + 1 },
    { x0: ELEVATORS.x0 - 1, x1: ELEVATORS.x1, z0: ELEVATORS.z0 - 1.6, z1: ELEVATORS.z1 },
    { x0: -71, x1: -58, z0: SHELL.z0 - 1, z1: 15 }, // north wall slot row
    { x0: -42, x1: -29, z0: SHELL.z0 - 1, z1: 15 },
    { x0: -16, x1: SHELL.x1 + 1, z0: 67, z1: 77 }, // Virginia wall slot row
  ];
  runs.push({ a: [SHELL.x0, SHELL.z0], b: [CHAMFER.b[0], SHELL.z0], doors: [fDoor] });
  runs.push({ a: [SHELL.x0, SHELL.z0], b: [SHELL.x0, SHELL.z1], doors: [] });
  runs.push({ a: [SHELL.x0, SHELL.z1], b: [SHELL.x1, SHELL.z1], doors: [] });
  runs.push({ a: [SHELL.x1, CHAMFER.a[1]], b: [SHELL.x1, SHELL.z1], doors: vDoors });
  runs.push({ a: CHAMFER.a, b: CHAMFER.b, doors: [cDoor] });
  for (const r of runs) wallRun(C, r, busy);
}

function wallRun(C, run, busy) {
  const { M, add, colliders, glows, pool, spots } = C;
  let f = wallFrame(run.a[0], run.a[1], run.b[0], run.b[1]);
  // Inward must point at the room centre; otherwise walk the run the other way.
  const toC = new THREE.Vector3(-46 - run.a[0], 0, 56 - run.a[1]);
  if (f.inward.dot(toC) < 0) f = wallFrame(run.b[0], run.b[1], run.a[0], run.a[1]);
  const L = f.len;
  const sOf = ([x, z]) => new THREE.Vector3(x - f.a.x, 0, z - f.a.z).dot(f.along);
  const gaps = run.doors.map(([p, q]) => [Math.min(sOf(p), sOf(q)), Math.max(sOf(p), sOf(q))]).sort((a, b) => a[0] - b[0]);
  const solid = [];
  let s = 0;
  for (const [g0, g1] of gaps) {
    if (g0 > s) solid.push([s, g0]);
    s = g1;
  }
  if (s < L) solid.push([s, L]);
  const m = f.m;
  const box = (x0, x1, y0, y1, z0, z1, mat, o = {}) => {
    if (x1 - x0 < 0.005) return;
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).applyMatrix4(m);
    add(g, mat, o);
  };
  const F = FLOOR_Y;
  const top = CEIL_Y;
  const zs = SKIN;
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(m);
  for (const [a, b] of solid) {
    // Wallpaper field, wainscot, base, chair rail, cornice.
    box(a, b, F + 1.16, top - 0.34, 0, zs, M.wallpaper, { castShadow: false });
    box(a, b, F, F + 1.12, 0, zs + 0.045, M.wood);
    box(a, b, F, F + 0.14, 0, zs + 0.065, M.marbleDark);
    box(a, b, F + 1.1, F + 1.17, 0, zs + 0.08, M.wood);
    box(a, b, F + 1.07, F + 1.085, 0, zs + 0.06, M.gold, { castShadow: false });
    box(a, b, top - 0.36, top - 0.26, 0, zs + 0.05, M.plaster);
    box(a, b, top - 0.26, top - 0.245, 0, zs + 0.075, M.gold, { castShadow: false });
    box(a, b, top - 0.245, top - 0.12, 0, zs + 0.13, M.plaster);
    box(a, b, top - 0.12, top + 0.02, 0, zs + 0.22, M.plaster);
    // Raised wainscot panels.
    const n = Math.floor((b - a - 0.3) / 1.25);
    const off = (b - a - n * 1.25) / 2;
    for (let i = 0; i < n; i++) {
      const x = a + off + i * 1.25 + 0.625;
      box(x - 0.52, x + 0.52, F + 0.3, F + 0.95, zs + 0.045, zs + 0.062, M.wood);
      box(x - 0.47, x + 0.47, F + 0.34, F + 0.91, zs + 0.062, zs + 0.066, M.woodLight, { castShadow: false });
    }
    colliders.local(m, (a + b) / 2, (F + top) / 2, (zs + 0.09) / 2, b - a, top - F, zs + 0.09);
    // Pilasters every ~6.4 m with sconces between them (skipped where furniture stands).
    const np = Math.max(0, Math.floor((b - a - 1.2) / 6.4));
    const step = np ? (b - a) / (np + 1) : 0;
    const isBusy = (x) => {
      const p = toWorld(x, 0, 0.5);
      return busy.some((r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1);
    };
    for (let i = 1; i <= np; i++) {
      const x = a + i * step;
      if (isBusy(x)) continue;
      box(x - 0.29, x + 0.29, F, top - 0.36, 0, zs + 0.13, M.marbleSlab);
      box(x - 0.34, x + 0.34, F, F + 0.32, 0, zs + 0.17, M.marbleDark);
      box(x - 0.35, x + 0.35, top - 0.6, top - 0.36, 0, zs + 0.17, M.gold);
      box(x - 0.31, x + 0.31, top - 0.66, top - 0.6, 0, zs + 0.15, M.gold);
      box(x - 0.2, x + 0.2, F + 1.6, F + 2.9, zs + 0.13, zs + 0.135, M.gold, { castShadow: false }); // inlay frame line
      colliders.local(m, x, (F + top) / 2, (zs + 0.17) / 2, 0.7, top - F, zs + 0.17);
    }
    // Sconces halfway between pilasters (and at least one per long run).
    const sconceXs = [];
    if (np) for (let i = 0; i <= np; i++) sconceXs.push(a + (i + 0.5) * step);
    else if (b - a > 2.2) sconceXs.push((a + b) / 2);
    for (const x of sconceXs) {
      if (isBusy(x) || x - a < 0.8 || b - x < 0.8) continue;
      sconce(C, m, x, F + 2.25);
    }
  }
  // Door surrounds: marble architrave + gilded keystone; header wall above the opening.
  for (const [g0, g1] of gaps) {
    const yTop = DOOR_TOP;
    box(g0, g1, yTop, top - 0.34, 0, zs, M.wallpaper, { castShadow: false });
    box(g0, g1, top - 0.36, top - 0.26, 0, zs + 0.05, M.plaster);
    box(g0, g1, top - 0.26, top - 0.245, 0, zs + 0.075, M.gold, { castShadow: false });
    box(g0, g1, top - 0.245, top - 0.12, 0, zs + 0.13, M.plaster);
    box(g0, g1, top - 0.12, top + 0.02, 0, zs + 0.22, M.plaster);
    box(g0 - 0.24, g0, F, yTop + 0.26, 0, zs + 0.09, M.marbleSlab);
    box(g1, g1 + 0.24, F, yTop + 0.26, 0, zs + 0.09, M.marbleSlab);
    box(g0 - 0.24, g1 + 0.24, yTop, yTop + 0.26, 0, zs + 0.09, M.marbleSlab);
    box(g0 - 0.3, g1 + 0.3, yTop + 0.26, yTop + 0.33, 0, zs + 0.13, M.gold);
    const kx = (g0 + g1) / 2;
    box(kx - 0.13, kx + 0.13, yTop - 0.02, yTop + 0.3, zs + 0.09, zs + 0.12, M.gold);
    // Reveal liners (shell wall thickness) so the opening never shows bare stucco from inside.
    for (const gx of [g0, g1]) {
      const p = toWorld(gx, (F + yTop) / 2, -0.2);
      void p;
    }
    // EXIT sign over every door (real code requirement), always lit.
    exitSign(C, m, kx, yTop + 0.62, zs + 0.03);
    // Warm wash over the architrave.
    glows.add(toWorld(kx, yTop + 0.2, zs + 0.14), f.inward, [g1 - g0 + 1.6, 1.4], 0xffcf90, 0.18);
  }
  void pool;
  void spots;
}

function sconce(C, m, x, y) {
  const { M, add, glows, pool, spots } = C;
  const loc = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(m);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const place = (g, lx, ly, lz) => g.applyQuaternion(q).translate(...loc(lx, ly, lz).toArray());
  const z0 = SKIN;
  add(place(new THREE.BoxGeometry(0.13, 0.32, 0.025), x, y, z0 + 0.0125), M.brass);
  add(place(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8).rotateX(Math.PI / 2), x, y - 0.04, z0 + 0.09), M.brass);
  for (const s of [-1, 1]) {
    add(place(new THREE.TorusGeometry(0.1, 0.009, 6, 16, Math.PI).rotateZ(Math.PI), x + s * 0.1, y - 0.04, z0 + 0.16), M.brass);
    add(place(new THREE.CylinderGeometry(0.02, 0.026, 0.06, 10), x + s * 0.2, y - 0.01, z0 + 0.16), M.brass);
    // Pleated fabric shade, glowing from inside.
    add(place(new THREE.CylinderGeometry(0.055, 0.085, 0.13, 14, 1, true), x + s * 0.2, y + 0.11, z0 + 0.16), M.lampSoft, { castShadow: false });
  }
  const inward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  glows.wash(loc(x, y + 0.25, z0 + 0.012), inward, 1.5, 2.1, 0xffc88a, 0.75);
  spots.add(loc(x, 0, z0 + 0.8).x, loc(x, 0, z0 + 0.8).z, 1.2, 0.1, 0xffc88a);
  pool.add({ pos: loc(x, y + 0.1, z0 + 0.45), color: 0xffc98e, intensity: 1.6, distance: 4.5, weight: 0.35 });
}

function exitSign(C, m, x, y, z) {
  const { add, M } = C;
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  const p = new THREE.Vector3(x, y, z + 0.03).applyMatrix4(m);
  add(new THREE.BoxGeometry(0.42, 0.18, 0.05).applyQuaternion(q).translate(p.x, p.y, p.z), M.black);
  const face = new THREE.PlaneGeometry(0.38, 0.14).applyQuaternion(q);
  const fp = new THREE.Vector3(x, y, z + 0.056).applyMatrix4(m);
  add(face.translate(fp.x, fp.y, fp.z), C.signs.exit, { uv: 'keep', castShadow: false });
}

// ---- ceiling ------------------------------------------------------------------------------

function buildCeiling(C) {
  const { M, add, glows, spots, pool } = C;
  const outline = [[SHELL.x0, SHELL.z0], [CHAMFER.b[0], SHELL.z0], [SHELL.x1, CHAMFER.a[1]], [SHELL.x1, SHELL.z1], [SHELL.x0, SHELL.z1]];
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
  const dome = new THREE.Path();
  dome.absarc(FOUNTAIN.x, FOUNTAIN.z, DOME_R, 0, Math.PI * 2, false);
  shape.holes.push(dome);
  const W = ESCALATOR.well;
  shape.holes.push(new THREE.Path([new THREE.Vector2(W.x0, W.z0), new THREE.Vector2(W.x1, W.z0), new THREE.Vector2(W.x1, W.z1), new THREE.Vector2(W.x0, W.z1)]));
  const coffers = [];
  const inset = 0.4;
  for (let i = 1; i < XB.length - 2; i++) {
    for (let k = 0; k < ZB.length - 1; k++) {
      const x0 = XB[i];
      const x1 = XB[i + 1];
      const z0 = ZB[k];
      const z1 = ZB[k + 1];
      // Keep a soffit ring around the dome and around the escalator well.
      const nx = Math.max(x0, Math.min(FOUNTAIN.x, x1));
      const nz = Math.max(z0, Math.min(FOUNTAIN.z, z1));
      if (Math.hypot(nx - FOUNTAIN.x, nz - FOUNTAIN.z) < DOME_R + 0.9) continue;
      if (x1 > W.x0 - 0.6 && x0 < W.x1 + 0.6 && z1 > W.z0 - 0.6 && z0 < W.z1 + 0.6) continue;
      const c = { i, k, x0: x0 + inset, x1: x1 - inset, z0: z0 + inset, z1: z1 - inset, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 };
      coffers.push(c);
      shape.holes.push(new THREE.Path([new THREE.Vector2(c.x0, c.z0), new THREE.Vector2(c.x1, c.z0), new THREE.Vector2(c.x1, c.z1), new THREE.Vector2(c.x0, c.z1)]));
    }
  }
  // Soffit (beam bottoms) facing down.
  const soffit = new THREE.ShapeGeometry(shape, 24).rotateX(Math.PI / 2).translate(0, CEIL_Y, 0);
  add(soffit, M.plaster, { castShadow: false });
  // Each coffer: stepped sides, gilded beads, a warm panel that glows from hidden cove LEDs.
  const D = COFFER_DEPTH;
  const chand = new Set(C.chandeliers.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`));
  for (const c of coffers) {
    const w = c.x1 - c.x0;
    const d = c.z1 - c.z0;
    const cx = (c.x0 + c.x1) / 2;
    const cz = (c.z0 + c.z1) / 2;
    const side = (x, z, sw, sd) => add(new THREE.BoxGeometry(sw, D, sd).translate(x, CEIL_Y + D / 2, z), M.plaster, { castShadow: false });
    side(cx, c.z0 - 0.02, w, 0.04);
    side(cx, c.z1 + 0.02, w, 0.04);
    side(c.x0 - 0.02, cz, 0.04, d);
    side(c.x1 + 0.02, cz, 0.04, d);
    // Inner step (a smaller frame hanging 0.16 below the panel) and gilded beads.
    const step = 0.16;
    const sw = 0.09;
    for (const [x, z, bw, bd] of [[cx, c.z0 + sw / 2, w, sw], [cx, c.z1 - sw / 2, w, sw], [c.x0 + sw / 2, cz, sw, d - 2 * sw], [c.x1 - sw / 2, cz, sw, d - 2 * sw]]) {
      add(new THREE.BoxGeometry(bw, step, bd).translate(x, CEIL_Y + D - step / 2, z), M.plasterWarm, { castShadow: false });
    }
    for (const [x, z, bw, bd] of [[cx, c.z0 + 0.01, w + 0.02, 0.035], [cx, c.z1 - 0.01, w + 0.02, 0.035], [c.x0 + 0.01, cz, 0.035, d], [c.x1 - 0.01, cz, 0.035, d]]) {
      add(new THREE.BoxGeometry(bw, 0.035, bd).translate(x, CEIL_Y - 0.012, z), M.gold, { castShadow: false });
    }
    add(new THREE.PlaneGeometry(w, d).rotateX(Math.PI / 2).translate(cx, CEIL_Y + D, cz), M.plasterWarm, { castShadow: false });
    glows.add(new THREE.Vector3(cx, CEIL_Y + D - 0.01, cz), DOWN, [w * 1.05, d * 1.05], 0xffc27a, 0.42);
    const key = `${c.cx.toFixed(1)},${c.cz.toFixed(1)}`;
    c.kind = chand.has(key) ? 'chandelier' : (c.i + c.k) % 3 === 0 ? 'eye' : 'down';
    // Medallion ring.
    add(new THREE.TorusGeometry(c.kind === 'chandelier' ? 0.42 : 0.26, 0.025, 6, 32).rotateX(Math.PI / 2).translate(cx, CEIL_Y + D - 0.02, cz), M.gold, { castShadow: false });
    if (c.kind === 'down') {
      // Four pin downlights per coffer.
      for (const [ox, oz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
        add(new THREE.CylinderGeometry(0.07, 0.07, 0.01, 14).translate(cx + ox, CEIL_Y + D - 0.006, cz + oz), M.lampWhite, { castShadow: false });
        add(new THREE.TorusGeometry(0.075, 0.012, 5, 16).rotateX(Math.PI / 2).translate(cx + ox, CEIL_Y + D - 0.01, cz + oz), M.chrome, { castShadow: false });
      }
      spots.add(cx, cz, 2.2, 0.16, 0xffe2b8);
    } else if (c.kind === 'eye') {
      C.eyes.push(new THREE.Vector3(cx, CEIL_Y + D, cz));
      spots.add(cx, cz, 2.0, 0.08, 0xffe2b8);
    }
  }
  // Grid rosettes at beam crossings.
  for (let i = 1; i < XB.length - 1; i++) {
    for (let k = 1; k < ZB.length - 1; k++) {
      const x = XB[i];
      const z = ZB[k];
      if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < DOME_R + 1.2) continue;
      if (x > W.x0 - 1 && x < W.x1 + 1 && z > W.z0 - 1 && z < W.z1 + 1) continue;
      add(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 16).translate(x, CEIL_Y - 0.025, z), M.gold, { castShadow: false });
    }
  }
  // Escalator well liner up to the slab, with a warm lit lid (the skyway level glows above).
  const wh = 7.1 - CEIL_Y;
  for (const [x, z, sw, sd] of [[(W.x0 + W.x1) / 2, W.z0, W.x1 - W.x0, 0.06], [(W.x0 + W.x1) / 2, W.z1, W.x1 - W.x0, 0.06], [W.x0, (W.z0 + W.z1) / 2, 0.06, W.z1 - W.z0], [W.x1, (W.z0 + W.z1) / 2, 0.06, W.z1 - W.z0]]) {
    add(new THREE.BoxGeometry(sw, wh, sd).translate(x, CEIL_Y + wh / 2, z), M.wallRed, { castShadow: false });
  }
  add(new THREE.PlaneGeometry(W.x1 - W.x0, W.z1 - W.z0).rotateX(Math.PI / 2).translate((W.x0 + W.x1) / 2, 7.1, (W.z0 + W.z1) / 2), M.lampSoft, { castShadow: false });
  for (const [x, z, sw, sd] of [[(W.x0 + W.x1) / 2, W.z0, W.x1 - W.x0 + 0.1, 0.12], [(W.x0 + W.x1) / 2, W.z1, W.x1 - W.x0 + 0.1, 0.12], [W.x0, (W.z0 + W.z1) / 2, 0.12, W.z1 - W.z0], [W.x1, (W.z0 + W.z1) / 2, 0.12, W.z1 - W.z0]]) {
    add(new THREE.BoxGeometry(sw, 0.1, sd).translate(x, CEIL_Y - 0.05, z), M.gold, { castShadow: false });
  }
  pool.add({ pos: new THREE.Vector3((W.x0 + W.x1) / 2, 6.4, (W.z0 + W.z1) / 2), color: 0xffd9a8, intensity: 5, distance: 10, weight: 0.6 });
  return coffers;
}

// ---- dome over the fountain ----------------------------------------------------------------

function buildDome(C) {
  const { M, add, glows, pool, spots } = C;
  const X = FOUNTAIN.x;
  const Z = FOUNTAIN.z;
  const drumTop = CEIL_Y + 0.85;
  // Drum (seen from inside), gilded rings top and bottom, painted panels between ribs.
  const drum = insideOut(new THREE.CylinderGeometry(DOME_R, DOME_R, drumTop - CEIL_Y, 96, 1, true)).translate(X, (CEIL_Y + drumTop) / 2, Z);
  add(drum, M.wallRed, { castShadow: false });
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.14, drumTop - CEIL_Y, 0.08).translate(0, (CEIL_Y + drumTop) / 2, -DOME_R + 0.04).rotateY(-a).translate(X, 0, Z), M.gold, { castShadow: false });
  }
  add(new THREE.TorusGeometry(DOME_R - 0.02, 0.07, 8, 128).rotateX(Math.PI / 2).translate(X, CEIL_Y - 0.03, Z), M.gold, { castShadow: false });
  add(new THREE.TorusGeometry(DOME_R - 0.05, 0.045, 8, 128).rotateX(Math.PI / 2).translate(X, CEIL_Y + 0.12, Z), M.gold, { castShadow: false });
  // Ledge hiding the cove LEDs, then the saucer dome.
  const ledgeR = DOME_R + 0.65;
  add(new THREE.RingGeometry(DOME_R - 0.1, ledgeR, 96, 1).rotateX(-Math.PI / 2).translate(X, drumTop, Z), M.plaster, { castShadow: false });
  add(new THREE.TorusGeometry(DOME_R - 0.08, 0.06, 8, 128).rotateX(Math.PI / 2).translate(X, drumTop + 0.06, Z), M.gold, { castShadow: false });
  add(new THREE.TorusGeometry(DOME_R + 0.25, 0.03, 6, 128).rotateX(Math.PI / 2).translate(X, drumTop + 0.04, Z), M.lampCove, { castShadow: false });
  const a = ledgeR;
  const h = 7.05 - drumTop;
  const Rs = (a * a + h * h) / (2 * h);
  const th = Math.asin(a / Rs);
  const cap = new THREE.SphereGeometry(Rs, 96, 20, 0, Math.PI * 2, 0, th);
  // Planar top-down UVs so the fresco canvas is a disc.
  const p = cap.attributes.position;
  const uv = cap.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * a) + 0.5, -p.getZ(i) / (2 * a) + 0.5);
  const capIn = insideOut(cap).translate(X, 7.05 - Rs, Z);
  add(capIn, C.signs.fresco, { uv: 'keep', castShadow: false });
  glows.add(new THREE.Vector3(X, 6.95, Z), DOWN, 5, 0xfff0d0, 0.35);
  // The dome's light falls on the fountain plaza.
  spots.add(X, Z, 7.5, 0.32, 0xffe6c0);
  pool.add({ pos: new THREE.Vector3(X, 5.6, Z), color: 0xffe2b8, intensity: 9, distance: 14, weight: 1.2 });
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2;
    pool.add({ pos: new THREE.Vector3(X + Math.cos(ang) * 8.4, drumTop - 0.3, Z + Math.sin(ang) * 8.4), color: 0xffc77a, intensity: 3.5, distance: 7, weight: 0.5 });
  }
}

// ---- columns ------------------------------------------------------------------------------

function buildColumns(C) {
  const { M, add, colliders } = C;
  const list = COLUMNS.map(([x, z]) => [x, z]);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    list.push([FOUNTAIN.x + Math.cos(a) * FOUNTAIN.colR, FOUNTAIN.z + Math.sin(a) * FOUNTAIN.colR]);
  }
  const F = FLOOR_Y;
  const shaftTop = CEIL_Y - 0.62;
  for (const [x, z] of list) {
    add(new THREE.BoxGeometry(0.98, 0.36, 0.98).translate(x, F + 0.18, z), M.marbleDark);
    add(new THREE.CylinderGeometry(0.44, 0.47, 0.12, 32).translate(x, F + 0.42, z), M.gold);
    add(new THREE.TorusGeometry(0.41, 0.045, 8, 32).rotateX(Math.PI / 2).translate(x, F + 0.5, z), M.gold);
    add(new THREE.CylinderGeometry(0.36, 0.385, shaftTop - (F + 0.5), 32).translate(x, (F + 0.5 + shaftTop) / 2, z), M.marbleSlab);
    add(new THREE.TorusGeometry(0.375, 0.022, 6, 32).rotateX(Math.PI / 2).translate(x, F + 1.18, z), M.gold);
    // Capital: necking ring, bell, abacus, then the beam block.
    add(new THREE.TorusGeometry(0.37, 0.03, 6, 32).rotateX(Math.PI / 2).translate(x, shaftTop + 0.02, z), M.gold);
    add(new THREE.CylinderGeometry(0.54, 0.37, 0.36, 32).translate(x, shaftTop + 0.2, z), M.gold);
    add(new THREE.BoxGeometry(1.12, 0.1, 1.12).translate(x, shaftTop + 0.43, z), M.gold);
    add(new THREE.BoxGeometry(0.98, CEIL_Y - (shaftTop + 0.48), 0.98).translate(x, (shaftTop + 0.48 + CEIL_Y) / 2, z), M.plaster);
    colliders.cylinder(x, F, z, 0.5, CEIL_H);
  }
  return list;
}

export { CEIL_H };
