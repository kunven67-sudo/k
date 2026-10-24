// The VOSS BIOGENETICS tower: 48 floors, 44 x 44 m, concrete core with 2 elevator shafts, a stairwell and a vent
// shaft. Playable floors are fully built inside; the rest are locked down (lockdown) and only exist as shell.
import * as THREE from 'three';
import { Batch, Kit, SOLID } from './kit.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const FLOOR_H = 4.2, CEIL_H = 3.0, HALF = 22, FLOORS = 48;
export const elev = (n) => (n <= 1 ? 0 : 4.2 + (n - 1) * FLOOR_H); // lobby is double height
export const PLAYABLE = [48, 47, 31, 20, 9, 1];
export const FLOOR_NAMES = { 48: 'Floor 48 - Specimen Lab', 47: 'Floor 47 - Animal Lab', 31: 'Floor 31 - Offices', 20: 'Floor 20 - Cafeteria', 9: 'Floor 9 - Server Farm', 1: 'Lobby' };
// core (outer faces). Walls 0.4 m thick, centred 0.2 m inside these lines.
export const CORE = { x0: -8.2, x1: 8.2, z0: -5.2, z1: 5.2 };
export const SHAFTS = [
  { id: 'A', x0: -6.6, x1: -3.6, z0: -4.8, z1: -1.6, door: -5.1 },
  { id: 'B', x0: -3.4, x1: -0.4, z0: -4.8, z1: -1.6, door: -1.9 },
];
export const SHAFT_A = SHAFTS[0], SHAFT_B = SHAFTS[1];
export const STAIR = { x0: 1.6, x1: 7.8, z0: 0.4, z1: 4.8, door: 7.1, landX: 6.4, midX: 3.0, wellZ0: 1.8, wellZ1: 3.4 };
export const floorH = (n) => (n === 1 ? 8.4 : FLOOR_H);
export const ROOF = 49;

// rectangles outside the core (for floor finishes and ceilings)
export const AROUND = [
  [-HALF, -HALF, HALF, CORE.z0], [-HALF, CORE.z1, HALF, HALF],
  [-HALF, CORE.z0, CORE.x0, CORE.z1], [CORE.x1, CORE.z0, HALF, CORE.z1],
];
export function finish(B, mat, y0, solid = 'STRUCT') {
  for (const [x0, z0, x1, z1] of AROUND) B.box(x1 - x0, 0.02, z1 - z0, mat, (x0 + x1) / 2, y0 + 0.01, (z0 + z1) / 2, solid);
}
export function ceilAround(B, y, ctx, opts) { for (const [x0, z0, x1, z1] of AROUND) ceiling(B, x0, z0, x1, z1, y, ctx, opts); }

// ------------------------------------------------------------------ walls with door holes
// wall from (x1,z1) to (x2,z2), thickness t, from y0 to y0+h. doors: [{at: distance along wall, w, h, gap}]
export function wall(B, x1, z1, x2, z2, y0, h, mat = 'plaster', t = 0.12, doors = [], solid = 'STRUCT') {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), rot = Math.atan2(dx, dz) - Math.PI / 2;
  const ux = dx / L, uz = dz / L;
  const seg = (a, b, yb, yt) => {
    if (b - a < 0.005 || yt - yb < 0.005) return;
    const m = (a + b) / 2;
    B.box(b - a, yt - yb, t, mat, x1 + ux * m, y0 + (yb + yt) / 2, z1 + uz * m, solid, rot);
  };
  const ds = [...doors].sort((a, b) => a.at - b.at);
  let cur = 0;
  for (const d of ds) {
    const a = d.at - d.w / 2, b = d.at + d.w / 2;
    seg(cur, a, 0, h);
    seg(a, b, d.h, h);           // header above the opening
    cur = b;
  }
  seg(cur, L, 0, h);
  // rubber base trim on both sides (where the floor meets the wall)
  if (mat === 'plaster' || mat === 'plasterGrey') {
    let c2 = 0;
    const trim = (a, b) => { if (b - a < 0.01) return; const m = (a + b) / 2; for (const sd of [-1, 1]) B.box(b - a, 0.1, 0.008, 'rubber', x1 + ux * m - uz * sd * (t / 2 + 0.004), y0 + 0.05, z1 + uz * m + ux * sd * (t / 2 + 0.004), 'SMALL', rot); };
    for (const d of ds) { trim(c2, d.at - d.w / 2); c2 = d.at + d.w / 2; }
    trim(c2, L);
  }
  return { rot, ux, uz, L };
}

// a door leaf in an opening: open = 0..1 (0 closed). 1.5 cm gap under it (a tiny spider walks under)
export function doorLeaf(B, x1, z1, x2, z2, y0, at, w, h, open = 0, mat = 'laminate') {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  const hx = x1 + ux * (at - w / 2), hz = z1 + uz * (at - w / 2); // hinge
  const ang = Math.atan2(dx, dz) - Math.PI / 2 - open * 1.4;
  const cx = hx + Math.cos(ang) * w / 2 * 1 , cz = hz - Math.sin(ang) * w / 2;
  B.box(w - 0.01, h - 0.02, 0.045, mat, cx, y0 + 0.015 + (h - 0.02) / 2, cz, 'FURN', ang, 0.004);
  // handle
  const kx = hx + Math.cos(ang) * (w - 0.1), kz = hz - Math.sin(ang) * (w - 0.1);
  B.box(0.12, 0.018, 0.018, 'steel', kx - Math.sin(ang) * 0.05, y0 + 1.0, kz - Math.cos(ang) * 0.05, 'SMALL', ang);
  B.box(0.12, 0.018, 0.018, 'steel', kx + Math.sin(ang) * 0.05, y0 + 1.0, kz + Math.cos(ang) * 0.05, 'SMALL', ang);
}

// drop ceiling over a rectangle: tile surface + T-bar grid + light panels + diffusers
function ceiling(B, x0, z0, x1, z1, y, ctx, { lights = true, lightMat = 'lightPanel', every = 2.4, warm = false } = {}) {
  B.box(x1 - x0, 0.015, z1 - z0, 'ceiling', (x0 + x1) / 2, y + 0.0075, (z0 + z1) / 2, 'STRUCT');
  for (let x = Math.ceil(x0 / 0.6) * 0.6; x < x1; x += 0.6) B.box(0.024, 0.012, z1 - z0, 'paint', x, y - 0.006, (z0 + z1) / 2, null);
  for (let z = Math.ceil(z0 / 0.6) * 0.6; z < z1; z += 0.6) B.box(x1 - x0, 0.012, 0.024, 'paint', (x0 + x1) / 2, y - 0.006, z, null);
  if (!lights) return;
  for (let x = x0 + every / 2; x < x1 - 0.6; x += every) for (let z = z0 + every / 2; z < z1 - 0.3; z += every) {
    const lx = Math.round(x / 0.6) * 0.6 + 0.6, lz = Math.round(z / 0.6) * 0.6 + 0.3;
    if (lx + 0.6 > x1 || lz + 0.3 > z1) continue;
    Kit.troffer(B, lx, y, lz, 1.2, 0.6, true);
    ctx.lights.push({ p: new THREE.Vector3(lx, y - 0.1, lz), color: warm ? 0xffd8b0 : lightMat === 'lightPanel' ? 0xe8f0ff : 0xffe0b8, i: 1 });
  }
  for (let x = x0 + every; x < x1 - 0.6; x += every * 2) for (let z = z0 + every; z < z1 - 0.6; z += every * 2) Kit.vent(B, Math.round(x / 0.6) * 0.6 + 0.3, y, Math.round(z / 0.6) * 0.6 + 0.3);
}

// ------------------------------------------------------------------ the shell of a playable floor
// (the core, stairs and shafts are built once for the whole tower in buildCore)
function shell(B, n, y0, ctx) {
  const yTop = floorH(n);
  // slab (concrete edge visible from outside) around the core
  for (const [x0, z0, x1, z1] of AROUND) B.box(x1 - x0, 0.3, z1 - z0, 'concrete', (x0 + x1) / 2, y0 - 0.15, (z0 + z1) / 2, 'STRUCT');
  const glassTop = n === 1 ? 8.0 : CEIL_H;
  const panes = [];
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 29; i++) {
      const a = -HALF + 0.75 + i * 1.5 + 0.01;
      let px, pz, rot;
      if (side === 0) { px = a; pz = -HALF; rot = 0; } else if (side === 1) { px = HALF; pz = a; rot = Math.PI / 2; }
      else if (side === 2) { px = -a; pz = HALF; rot = Math.PI; } else { px = -HALF; pz = -a; rot = -Math.PI / 2; }
      if (Math.abs(a) > HALF - 0.5) continue;
      panes.push({ x: px, z: pz, side, rot, y0, h: glassTop, w: 1.44, broken: false });
      const mx = px + Math.cos(rot) * 0.75, mz = pz - Math.sin(rot) * 0.75;
      B.box(0.06, glassTop, 0.12, 'darkmetal', mx, y0 + glassTop / 2, mz, 'STRUCT', rot);
    }
    const L = HALF * 2;
    const sx = side === 1 ? HALF + 0.02 : side === 3 ? -HALF - 0.02 : 0, sz = side === 0 ? -HALF - 0.02 : side === 2 ? HALF + 0.02 : 0;
    B.box(side % 2 ? 0.1 : L + 0.2, yTop - glassTop, side % 2 ? L + 0.2 : 0.1, 'glassDark', sx, y0 + glassTop + (yTop - glassTop) / 2, sz, 'STRUCT');
    const ix = side === 1 ? HALF - 0.12 : side === 3 ? -HALF + 0.12 : 0, iz = side === 0 ? -HALF + 0.12 : side === 2 ? HALF - 0.12 : 0;
    B.box(side % 2 ? 0.2 : L, 0.08, side % 2 ? L : 0.2, 'whitePlastic', ix, y0 + 0.04, iz, 'FURN');
    // window frame head + sill (aluminium)
    for (const yy of [y0 + 0.085, y0 + glassTop - 0.02]) B.box(side % 2 ? 0.08 : L, 0.04, side % 2 ? L : 0.08, 'alu', sx * 0.9995, yy, sz * 0.9995, null);
  }
  ctx.panes = panes;
  // floor number on the core wall next to the stair door
  ctx.labels.push({ text: (n === 1 ? 'L' : String(n)), x: STAIR.door + 1.3, y: y0 + 1.6, z: CORE.z1 + 0.006, rot: 0, size: 0.5 });
}

// ------------------------------------------------------------------ core: shafts, stairs, walls for ALL floors
// built once; floors that aren't playable are locked down (solid doors, no gaps)
export function buildCore(B, ctx) {
  const C = CORE;
  B.box(C.x1 - C.x0, 0.4, C.z1 - C.z0, 'concrete', 0, -2.2, 0, 'STRUCT'); // elevator pit + stair bottom
  const zs = C.z0 + 0.2, zn = C.z1 - 0.2, xw = C.x0 + 0.2, xe = C.x1 - 0.2;
  for (let n = 1; n <= ROOF; n++) {
    const y0 = elev(n), h = n === ROOF ? 3.4 : floorH(n), play = PLAYABLE.includes(n) || n === ROOF;
    const eDoors = n === ROOF ? [] : SHAFTS.map(S => ({ at: S.door - C.x0, w: 1.1, h: 2.2 }));
    wall(B, C.x0, zs, C.x1, zs, y0, h, 'concrete', 0.4, eDoors);
    wall(B, C.x1, zn, C.x0, zn, y0, h, 'concrete', 0.4, [{ at: C.x1 - STAIR.door, w: 1.0, h: 2.1 }]);
    wall(B, xw, zn, xw, zs, y0, h, 'concrete', 0.4);
    wall(B, xe, zs, xe, zn, y0, h, 'concrete', 0.4);
    const U = [[-7.8, -4.8, -6.6, 4.8], [-6.6, -1.6, -0.4, 4.8], [-3.6, -4.8, -3.4, -1.6], [-0.4, -4.8, 1.6, 4.8], [1.6, -4.8, 7.8, 0.4]];
    for (const [x0, z0, x1, z1] of U) B.box(x1 - x0, h, z1 - z0, 'concrete', (x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, 'STRUCT');
    // threshold under the stair door opening (through the wall thickness)
    B.box(1.0, 0.3, 0.42, 'concrete', STAIR.door, y0 - 0.15, C.z1 - 0.2, 'STRUCT');
    const sdz = C.z1 + 0.02;
    if (play) {
      doorLeaf(B, C.x1, sdz, C.x0, sdz, y0, C.x1 - STAIR.door, 1.0, 2.1, 0, 'paintGreen');
      Kit.exitSign(B, STAIR.door, y0 + 2.35, sdz + 0.03, 0);
    } else B.box(1.0, 2.1, 0.06, 'paintGreen', STAIR.door, y0 + 1.05, sdz - 0.03, 'STRUCT');
    stairs(B, n, y0, ctx);
    if (n === ROOF) { B.box(C.x1 - C.x0, 0.3, C.z1 - C.z0, 'concrete', 0, y0 + h + 0.15, 0, 'STRUCT'); continue; }
    for (const S of SHAFTS) {
      const zf = C.z0 - 0.02;
      B.box(1.1, 0.3, 0.42, 'concrete', S.door, y0 - 0.15, C.z0 + 0.2, 'STRUCT'); // threshold to the shaft
      B.box(1.1, 0.02, 0.42, 'steel', S.door, y0 + 0.01, C.z0 + 0.2, null);
      if (play) {
        for (const sd of [-1, 1]) B.box(0.54, 2.18, 0.04, 'steel', S.door + sd * 0.278, y0 + 0.012 + 1.09, zf, 'FURN', 0, 0.004);
        B.box(1.3, 0.12, 0.06, 'steel', S.door, y0 + 2.3, zf, 'STRUCT');
        B.box(0.09, 0.18, 0.03, 'steel', S.door + 0.85, y0 + 1.1, zf - 0.005, 'SMALL', 0, 0.006);
        B.box(0.024, 0.024, 0.01, 'ledBlue', S.door + 0.85, y0 + 1.14, zf - 0.024, null);
        ctx.liftDoors.push({ shaft: S.id, n, x: S.door, y: y0, z: zf });
      } else B.box(1.1, 2.2, 0.06, 'steel', S.door, y0 + 1.1, zf + 0.01, 'STRUCT');
      // inside the shaft: guide rails + the floor edge beam (they stream past while you ride)
      B.box(0.06, h, 0.1, 'darkmetal', S.x0 + 0.08, y0 + h / 2, (S.z0 + S.z1) / 2, 'STRUCT');
      B.box(0.06, h, 0.1, 'darkmetal', S.x1 - 0.08, y0 + h / 2, (S.z0 + S.z1) / 2, 'STRUCT');
      B.box(S.x1 - S.x0, 0.3, 0.06, 'concrete', (S.x0 + S.x1) / 2, y0 - 0.15, S.z0 + 0.03, 'STRUCT');
      B.box(0.6, 0.4, 0.02, 'paintYellow', (S.x0 + S.x1) / 2 + 0.9, y0 + 1.2, S.z1 - 0.01, null); // floor number plate
      ctx.labels.push({ text: String(n === 1 ? 'L' : n), x: (S.x0 + S.x1) / 2 + 0.9, y: y0 + 1.2, z: S.z1 - 0.022, rot: Math.PI, size: 0.3, ink: '#111', bg: null });
    }
  }
}

// U-stair: two flights per floor running along x, mid landing at the west end, open well in between
// (you can drop down the well on a silk line).
function stairs(B, n, y0, ctx) {
  const S = STAIR;
  B.box(S.x1 - S.landX, 0.2, S.z1 - S.z0, 'concrete', (S.landX + S.x1) / 2, y0 - 0.1, (S.z0 + S.z1) / 2, 'STRUCT'); // floor landing
  ctx.coreLights.push({ p: new THREE.Vector3(S.x1 - 0.12, y0 + 2.5, (S.z0 + S.z1) / 2), color: 0xfff0d8, i: 0.45, r: 7 });
  if (n === 1) return;
  const hb = floorH(n - 1) / 2;
  const steps = Math.max(8, Math.round(hb / 0.18)), rb = hb / steps, run = (S.landX - S.midX) / steps;
  B.box(S.midX - S.x0, 0.2, S.z1 - S.z0, 'concrete', (S.x0 + S.midX) / 2, y0 - hb - 0.1, (S.z0 + S.z1) / 2, 'STRUCT'); // mid landing
  const wA = S.z1 - S.wellZ1, wB = S.wellZ0 - S.z0;
  for (let i = 0; i < steps - 1; i++) {
    // flight A (north side): down from the floor landing toward the west
    const xa = S.landX - (i + 0.5) * run, ta = y0 - (i + 1) * rb;
    B.box(run + 0.01, rb + 0.1, wA, 'concrete', xa, ta - (rb + 0.1) / 2, (S.wellZ1 + S.z1) / 2, 'STRUCT');
    B.box(run + 0.01, 0.012, wA, 'rubber', xa, ta + 0.006, (S.wellZ1 + S.z1) / 2, null);
    // flight B (south side): down from the mid landing toward the east
    const xb = S.midX + (i + 0.5) * run, tb = y0 - hb - (i + 1) * rb;
    B.box(run + 0.01, rb + 0.1, wB, 'concrete', xb, tb - (rb + 0.1) / 2, (S.z0 + S.wellZ0) / 2, 'STRUCT');
    B.box(run + 0.01, 0.012, wB, 'rubber', xb, tb + 0.006, (S.z0 + S.wellZ0) / 2, null);
  }
  const L = Math.hypot(S.landX - S.midX, hb), ang = Math.atan2(hb, S.landX - S.midX);
  // soffits under the flights + slanted handrails along the well with balusters
  B.add(new THREE.BoxGeometry(L, 0.14, wA), 'concrete', { p: [(S.landX + S.midX) / 2, y0 - hb / 2 - 0.2, (S.wellZ1 + S.z1) / 2], r: [0, 0, ang] }, null);
  B.add(new THREE.BoxGeometry(L, 0.14, wB), 'concrete', { p: [(S.landX + S.midX) / 2, y0 - hb * 1.5 - 0.2, (S.z0 + S.wellZ0) / 2], r: [0, 0, -ang] }, null);
  B.add(new THREE.BoxGeometry(L, 0.045, 0.045), 'paintGreen', { p: [(S.landX + S.midX) / 2, y0 - hb / 2 + 0.95, S.wellZ1 + 0.03], r: [0, 0, ang] }, 'PROP');
  B.add(new THREE.BoxGeometry(L, 0.045, 0.045), 'paintGreen', { p: [(S.landX + S.midX) / 2, y0 - hb * 1.5 + 0.95, S.wellZ0 - 0.03], r: [0, 0, -ang] }, 'PROP');
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    B.box(0.022, 0.95, 0.022, 'paintGreen', S.landX - t * (S.landX - S.midX), y0 - t * hb + 0.475, S.wellZ1 + 0.03, 'SMALL');
    B.box(0.022, 0.95, 0.022, 'paintGreen', S.midX + t * (S.landX - S.midX), y0 - hb - t * hb + 0.475, S.wellZ0 - 0.03, 'SMALL');
  }
}

// ------------------------------------------------------------------ FLOOR 48: SPECIMEN LAB (you start here)
function floor48(B, y0, ctx) {
  const Y = y0, H = CEIL_H;
  // floors: lab tiles everywhere, parquet in Voss's office
  B.box(44, 0.02, 44, 'labfloor', 0, Y + 0.01, 0, 'STRUCT');
  B.box(16, 0.004, 14, 'parquet', -14, Y + 0.022, 15, 'STRUCT');
  // partitions
  wall(B, -22, -8, -9, -8, Y, H, 'plaster', 0.12, [{ at: 9, w: 1.2, h: 2.15 }]);           // tank room north wall (door to corridor)
  wall(B, -9, -8, 22, -8, Y, H, 'plaster', 0.12, [{ at: 12, w: 1.2, h: 2.15 }]);           // archive north wall
  wall(B, 0, -22, 0, -8, Y, H, 'walltile', 0.12, [{ at: 4, w: 1.0, h: 2.15 }]);             // tank room | archive
  wall(B, -22, 8, 22, 8, Y, H, 'plaster', 0.12, [{ at: 9, w: 1.0, h: 2.15 }, { at: 22, w: 1.2, h: 2.15 }, { at: 35, w: 1.2, h: 2.15 }]);
  wall(B, -6, 8, -6, 22, Y, H, 'plaster', 0.12);
  wall(B, 6, 8, 6, 22, Y, H, 'glass', 0.03);                                                // vault is behind glass
  doorLeaf(B, -22, -8, -9, -8, Y, 9, 1.2, 2.15, 0.85);     // tank room door, wide open
  doorLeaf(B, -9, -8, 22, -8, Y, 12, 1.2, 2.15, 0.0);       // archive door, closed (crawl under)
  doorLeaf(B, 0, -22, 0, -8, Y, 4, 1.0, 2.15, 0.25, 'steel');
  doorLeaf(B, -22, 8, 22, 8, Y, 9, 1.0, 2.15, 0.6, 'wood'); // Voss's office
  // ceilings
  ceiling(B, -22, -22, 22, 22, Y + H, ctx, { every: 2.4 });
  // ---------- TANK ROOM (x -22..0, z -22..-8)
  // the specimen bench: your tank sits on it
  Kit.labBench(B, -9, Y, -12.2, Math.PI, 3.0, 0.9);
  const TB = { x: -9.2, y: Y + 0.9375, z: -12.25 };       // bench top centre
  tank(B, TB.x, TB.y, TB.z, ctx);
  ctx.start = { pos: new THREE.Vector3(TB.x - 0.08, TB.y + 0.027, TB.z + 0.02), up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1) };
  // stuff on the bench around the tank
  Kit.microscope(B, -7.9, TB.y, -12.35, Math.PI);
  Kit.beaker(B, -10.3, TB.y, -12.0, 0.04, 0.11, 'liquidGreen'); Kit.beaker(B, -10.45, TB.y, -12.25, 0.03, 0.09, 'liquidBlue');
  Kit.flask(B, -10.6, TB.y, -11.95, 1, 'liquidAmber');
  feederVials(B, -8.4, TB.y, -12.0, ctx);
  syringeTray(B, -9.75, TB.y, -11.85, ctx);
  Kit.paperStack(B, -10.0, TB.y, -12.45, 0.2, 9);
  Kit.pen(B, -9.95, TB.y + 0.016, -12.35, 0.6);
  ctx.notes.push({ id: 'voss1', x: -10.0, y: TB.y + 0.02, z: -12.45 });
  // Voss's workstation: L-desk, 3 monitors with your vitals, keyboard, mug, chair
  Kit.desk(B, -15.5, Y, -12.8, Math.PI, 'laminate', 1.8, 0.8);
  for (const [dx, r] of [[-0.62, 0.3], [0, 0], [0.62, -0.3]]) Kit.monitor(B, -15.5 + dx, Y + 0.74, -13.0, Math.PI + r, 'screenGreen', 0.56);
  Kit.keyboard(B, -15.5, Y + 0.74, -12.55, Math.PI); Kit.mouse(B, -15.0, Y + 0.74, -12.55, 0);
  Kit.mug(B, -16.2, Y + 0.74, -12.55); Kit.paperStack(B, -14.7, Y + 0.74, -12.6, 0.4, 4);
  Kit.officeChair(B, -15.5, Y, -12.0, Math.PI);
  ctx.screens.push({ x: -15.5, y: Y + 0.74 + 0.34, z: -13.0 + 0.016, w: 0.54, h: 0.3, rot: Math.PI, kind: 'vitals' });
  // more lab: centrifuge bench, fume hood, sink, serum fridge, shelves, stool, whiteboard
  Kit.labBench(B, -9, Y, -20.8, 0, 6.0, 0.9);
  Kit.centrifuge(B, -10.5, Y + 0.9375, -20.9, 0);
  Kit.microscope(B, -7.6, Y + 0.9375, -20.95, 0);
  for (let i = 0; i < 7; i++) Kit.beaker(B, -12.6 + i * 0.13, Y + 0.9375, -20.6, 0.028, 0.08, i % 2 ? 'liquidBlue' : 'liquidAmber');
  fumeHood(B, -19.8, Y, -20.6);
  Kit.fridge(B, -21.3, Y, -12.5, Math.PI / 2, true);
  serumRack(B, -21.3, Y, -12.5, ctx);
  Kit.shelf(B, -21.6, Y, -17, Math.PI / 2, 2.4, 2.1, 0.45, 5, 'steel');
  supplies(B, -21.6, Y, -17, 2.4, 2.1);
  Kit.trash(B, -12.8, Y, -9.0); Kit.fireExt(B, -21.7, Y, -9.0);
  stool(B, -9.6, Y, -11.0); stool(B, -8.4, Y, -19.6);
  whiteboard(B, -14, Y, -21.9, ctx);
  Kit.wallClock(B, -3.0, Y + 2.4, -8.08, Math.PI);
  // ---------- ARCHIVE (x 0..22, z -22..-8): Specimens 1-7 in jars + rows of jars, dim light
  for (let r = 0; r < 3; r++) {
    const sx = 5 + r * 5.5;
    Kit.shelf(B, sx, Y, -15, 0, 0.6, 2.2, 7.0, 5, 'steel');
    jarRow(B, sx, Y, -15, 7.0, 2.2, r, ctx);
  }
  for (let i = 0; i < 7; i++) {          // the seven before you, each on a plinth with a label
    const x = 3 + i * 2.6, z = -21.0;
    B.box(0.5, 1.05, 0.5, 'darkPlastic', x, Y + 0.525, z, 'FURN', 0, 0.02);
    Kit.jar(B, x, Y + 1.05, z, 0.16, 0.42, 'formalin', (jx, jy, jz) => deadSpecimen(B, jx, jy, jz, i));
    ctx.labels.push({ text: 'SPECIMEN ' + (i + 1), x, y: Y + 0.9, z: z + 0.252, rot: 0, small: true });
    ctx.notes.push({ id: 'spec' + (i + 1), x, y: Y + 1.06, z: z + 0.2 });
  }
  // ---------- VOSS OFFICE (x -22..-6, z 8..22)
  Kit.desk(B, -14, Y, 18.5, 0, 'parquet', 2.2, 1.0);
  Kit.monitor(B, -14, Y + 0.74, 18.7, 0, 'screen', 0.7);
  Kit.keyboard(B, -14, Y + 0.74, 18.25, 0);
  Kit.officeChair(B, -14, Y, 19.5, 0, 'leather');
  bookcase(B, -21.7, Y, 15, Math.PI / 2, 4);
  ctx.notes.push({ id: 'voss2', x: -13.4, y: Y + 0.76, z: 18.3 });
  sofa(B, -9, Y, 12, -Math.PI / 2);
  Kit.plant(B, -7, Y, 21, 1.4); Kit.plant(B, -21, Y, 9, 1.2);
  terrarium(B, -21.2, Y, 20.5);
  // ---------- CRYO (x -6..6, z 8..22): frosty steel, dewars
  for (let i = 0; i < 6; i++) cryoLocker(B, -5 + i * 2, Y, 21.4);
  for (let i = 0; i < 4; i++) dewar(B, -4 + i * 2.5, Y, 15);
  ctx.zones.push({ kind: 'cold', x0: -6, x1: 6, z0: 8, z1: 22, y: Y });
  // ---------- SERUM VAULT (x 6..22, z 8..22) behind glass: the growth serum
  vaultRacks(B, Y, ctx);
  // corridors: plants, water cooler, signs
  Kit.water(B, -1.5, Y, 7.4); Kit.plant(B, 20.8, Y, -6.0); Kit.plant(B, -20.8, Y, 6.5);
  Kit.fireExt(B, 8.6, Y, -5.3);
  // the vent shaft opening in the ceiling plenum over the corridor (crawl in via the diffusers)
  ctx.spawns.push(
    { kind: 'fruitfly', x: -8.4, y: TB.y + 0.12, z: -12.0, n: 7, r: 0.4 },
    { kind: 'cricket', x: -9.6, y: Y + 0.0, z: -10.6, n: 3, r: 1.2 },
    { kind: 'mealworm', x: -8.9, y: TB.y, z: -11.9, n: 3, r: 0.25 },
    { kind: 'housefly', x: -18, y: Y + 1.8, z: -21.5, n: 3, r: 2.5 },
    { kind: 'moth', x: -12, y: Y + 2.8, z: -15, n: 3, r: 3 },
    { kind: 'roach', x: -20, y: Y, z: -20, n: 2, r: 1.5 },
    { kind: 'cellar', x: -21.6, y: Y + 2.85, z: -21.5, n: 1, r: 0.2, wall: true },
    { kind: 'mouse', x: -19.5, y: Y, z: -9.6, n: 1, r: 0.5 },
    { kind: 'fruitfly', x: -10.5, y: Y + 1.3, z: -20.7, n: 5, r: 1 },
    { kind: 'roach', x: 10, y: Y, z: -12, n: 2, r: 4 },
    { kind: 'moth', x: 0, y: Y + 2.8, z: 6.5, n: 2, r: 5 },
  );
  ctx.humans.push(
    { role: 'voss', x: -10.5, y: Y, z: -11.1, rot: Math.PI, path: [[-10.5, -11.1], [-15.5, -11.6], [-12, -6.5], [-1, -6.5]] },
    { role: 'tech', x: -9, y: Y, z: -19.6, rot: 0, path: [[-9, -19.6], [-14, -19.6], [-14, -10], [-9, -10]] },
  );
}

// the terrarium you live in: glass box on the bench, coco fibre floor, a twig, water dish, mesh lid
function tank(B, x, y, z, ctx) {
  const W = 0.46, D = 0.3, H = 0.3, t = 0.004;
  B.box(W + 0.02, 0.012, D + 0.02, 'blackPlastic', x, y + 0.006, z, 'FURN', 0, 0.003);            // base frame
  B.box(W, 0.012, D, 'soil', x, y + 0.018, z, 'STRUCT');                                            // substrate
  for (let i = 0; i < 70; i++) B.add(new THREE.DodecahedronGeometry(0.003 + Math.random() * 0.004, 0), 'soil', { p: [x + (Math.random() - 0.5) * W * 0.9, y + 0.025, z + (Math.random() - 0.5) * D * 0.9], r: [Math.random() * 3, Math.random() * 3, 0] }, 'SMALL');
  // glass walls: back, sides, front split around the crack hole (bottom-left of the front pane)
  B.box(W, H, t, 'glass', x, y + 0.012 + H / 2, z - D / 2, 'STRUCT');
  B.box(t, H, D, 'glass', x - W / 2, y + 0.012 + H / 2, z, 'STRUCT');
  B.box(t, H, D, 'glass', x + W / 2, y + 0.012 + H / 2, z, 'STRUCT');
  const hole = { x0: x - W / 2 + 0.03, x1: x - W / 2 + 0.085, h: 0.045 }; // the crack opening (a 4 mm spider fits easily)
  B.box(hole.x0 - (x - W / 2), H, t, 'glass', (x - W / 2 + hole.x0) / 2, y + 0.012 + H / 2, z + D / 2, 'STRUCT');
  B.box(x + W / 2 - hole.x1, H, t, 'glass', (hole.x1 + x + W / 2) / 2, y + 0.012 + H / 2, z + D / 2, 'STRUCT');
  B.box(hole.x1 - hole.x0, H - hole.h, t, 'glass', (hole.x0 + hole.x1) / 2, y + 0.012 + hole.h + (H - hole.h) / 2, z + D / 2, 'STRUCT');
  ctx.crack = { x: (hole.x0 + hole.x1) / 2, y: y + 0.012 + hole.h * 0.6, z: z + D / 2 + 0.003, w: hole.x1 - hole.x0, h: hole.h };
  // black frame edges
  for (const [ex, ez] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) B.box(0.01, H, 0.01, 'blackPlastic', x + ex, y + 0.012 + H / 2, z + ez, 'SMALL');
  B.box(W + 0.02, 0.01, 0.012, 'blackPlastic', x, y + H + 0.012, z - D / 2, 'SMALL'); B.box(W + 0.02, 0.01, 0.012, 'blackPlastic', x, y + H + 0.012, z + D / 2, 'SMALL');
  // mesh lid (the holes are too small even for you)
  B.box(W + 0.02, 0.006, D + 0.02, 'darkmetal', x, y + H + 0.02, z, 'STRUCT');
  // twig, cork hide, water dish
  B.add(new THREE.CylinderGeometry(0.006, 0.009, 0.32, 7), 'wood', { p: [x + 0.06, y + 0.07, z - 0.02], r: [0.15, 0.4, 1.12] }, 'SMALL');
  B.add(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 14, 1, true, 0, Math.PI), 'cardboard', { p: [x + 0.13, y + 0.03, z + 0.06], r: [0, 0.6, Math.PI / 2] }, 'SMALL');
  B.add(new THREE.CylinderGeometry(0.03, 0.026, 0.012, 18), 'whitePlastic', { p: [x - 0.13, y + 0.028, z - 0.07] }, 'SMALL');
  B.add(new THREE.CylinderGeometry(0.026, 0.026, 0.002, 18), 'liquidBlue', { p: [x - 0.13, y + 0.033, z - 0.07] }, null);
  // the label card taped on the front
  ctx.labels.push({ text: 'SPECIMEN 8', x: x + 0.12, y: y + 0.22, z: z + D / 2 + 0.004, rot: 0, small: true, card: true });
  ctx.tank = { x, y, z, W, D, H };
}

function feederVials(B, x, y, z, ctx) {
  for (let i = 0; i < 4; i++) {
    const vx = x + (i % 2) * 0.05, vz = z + Math.floor(i / 2) * 0.05;
    B.add(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 14, 1, true), 'glass', { p: [vx, y + 0.045, vz] }, 'SMALL');
    B.cyl(0.0135, 0.0135, 0.02, 'food', vx, y + 0.01, vz, null, 14);
    B.cyl(0.016, 0.016, 0.012, 'whitePlastic', vx, y + 0.09, vz, 'SMALL', 14);
  }
  ctx.labels.push({ text: 'D. melanogaster', x: x + 0.025, y: y + 0.12, z: z - 0.02, rot: Math.PI, small: true, card: true });
}
function syringeTray(B, x, y, z, ctx) {
  B.box(0.22, 0.012, 0.12, 'steel', x, y + 0.006, z, 'SMALL', 0.3, 0.003);
  // syringe (the one he used on you)
  B.add(new THREE.CylinderGeometry(0.006, 0.006, 0.08, 12), 'glass', { p: [x, y + 0.02, z], r: [0, 0.3, Math.PI / 2] }, 'SMALL');
  B.add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.04, 12), 'liquidGreen', { p: [x + 0.01, y + 0.02, z - 0.003], r: [0, 0.3, Math.PI / 2] }, null);
  B.add(new THREE.CylinderGeometry(0.0005, 0.0005, 0.03, 4), 'chrome', { p: [x - 0.055, y + 0.02, z + 0.017], r: [0, 0.3, Math.PI / 2] }, null);
  ctx.vials.push({ kind: 'growth', x: x + 0.05, y: y + 0.03, z: z + 0.03 });
}
function serumRack(B, x, y, z, ctx) {
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
    const vx = x - 0.2 + i * 0.08, vy = y + 0.45 + r * 0.38, vz = z + 0.15;
    B.add(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10), r === 1 ? 'liquidGreen' : 'liquidBlue', { p: [vx, vy + 0.03, vz] }, null);
  }
  ctx.lights.push({ p: new THREE.Vector3(x + 0.2, y + 1.0, z), color: 0x60ffa0, i: 0.25 });
}
function fumeHood(B, x, y, z) {
  B.box(1.8, 0.9, 0.85, 'whitePlastic', x, y + 0.45, z, 'FURN', 0, 0.01);
  B.box(1.8, 0.03, 0.85, 'black', x, y + 0.915, z, 'FURN');
  B.box(1.8, 1.2, 0.05, 'whitePlastic', x, y + 1.53, z - 0.4, 'FURN');
  for (const sx of [-0.9, 0.9]) B.box(0.05, 1.3, 0.85, 'whitePlastic', x + sx, y + 1.58, z, 'FURN');
  B.box(1.8, 0.35, 0.85, 'whitePlastic', x, y + 2.3, z, 'FURN');
  B.box(1.7, 0.8, 0.01, 'glass', x, y + 1.6, z + 0.4, null);
  B.box(1.6, 0.02, 0.6, 'lightPanel', x, y + 2.11, z, null);
}
function supplies(B, x, y, z, w, h) {
  for (let lv = 0; lv < 5; lv++) for (let i = 0; i < 6; i++) {
    const zz = z - w / 2 + 0.2 + i * (w - 0.4) / 5, yy = y + 0.12 + lv * (h - 0.15) / 4;
    if (Math.random() < 0.25) continue;
    if (Math.random() < 0.5) B.box(0.3, 0.2 + Math.random() * 0.15, 0.25, 'cardboard', x, yy + 0.12, zz, 'PROP', Math.random() * 0.2, 0.01);
    else Kit.jar(B, x, yy + 0.01, zz, 0.05, 0.14, ['liquidAmber', 'formalin', 'liquidBlue'][i % 3]);
  }
}
function stool(B, x, y, z) {
  B.cyl(0.18, 0.18, 0.05, 'blackPlastic', x, y + 0.62, z, 'FURN', 20);
  B.cyl(0.02, 0.02, 0.55, 'chrome', x, y + 0.33, z, 'PROP', 10);
  for (let i = 0; i < 5; i++) { const a = i * 1.2566; B.add(new THREE.BoxGeometry(0.03, 0.03, 0.26), 'blackPlastic', { p: [x + Math.sin(a) * 0.12, y + 0.05, z + Math.cos(a) * 0.12], r: [0, a, 0] }, 'PROP'); }
}
function whiteboard(B, x, y, z, ctx) {
  B.box(2.4, 1.2, 0.02, 'whitePlastic', x, y + 1.5, z, 'FURN');
  B.box(2.44, 1.24, 0.015, 'alu', x, y + 1.5, z - 0.01, null);
  B.box(1.0, 0.03, 0.05, 'alu', x, y + 0.88, z + 0.03, 'SMALL');
  ctx.boards.push({ x, y: y + 1.5, z: z + 0.012, w: 2.3, h: 1.1, rot: 0 });
}
function jarRow(B, x, y, z, len, h, row, ctx) {
  for (let lv = 0; lv < 5; lv++) for (let i = 0; i < 9; i++) {
    if ((i + lv + row) % 4 === 3) continue;
    const zz = z - len / 2 + 0.4 + i * (len - 0.8) / 8, yy = y + 0.11 + lv * (h - 0.15) / 4;
    Kit.jar(B, x, yy, zz, 0.07, 0.2, 'formalin', (jx, jy, jz) => B.add(new THREE.SphereGeometry(0.03, 8, 6).scale(1.3, 0.8, 1.6), 'specimen', { p: [jx, jy, jz] }, null));
  }
}
function deadSpecimen(B, x, y, z, i) {
  // a pale dead spider curled up in formalin (legs folded under: how dead spiders really look)
  const s = 0.05 + i * 0.006;
  B.add(new THREE.SphereGeometry(s, 14, 10).scale(1, 0.85, 1.2), 'fleshPale', { p: [x, y + 0.02, z - s * 0.4] }, null);
  B.add(new THREE.SphereGeometry(s * 0.55, 12, 8).scale(1, 0.6, 1.1), 'specimen', { p: [x, y + 0.02, z + s * 0.75] }, null);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    B.add(new THREE.TorusGeometry(s * 0.5, s * 0.06, 6, 10, Math.PI * 1.2), 'specimen', { p: [x + Math.sin(a) * s * 0.5, y, z + Math.cos(a) * s * 0.5 + s * 0.3], r: [Math.PI / 2, a, 0] }, null);
  }
}
function bookcase(B, x, y, z, rot, w) {
  Kit.shelf(B, x, y, z, rot, w, 2.2, 0.35, 6, 'wood');
  for (let lv = 0; lv < 5; lv++) {
    let o = -w / 2 + 0.05;
    while (o < w / 2 - 0.1) {
      const bw = 0.025 + Math.random() * 0.04, bh = 0.22 + Math.random() * 0.12;
      const col = ['paintRed', 'paintBlue', 'paintGreen', 'black', 'cardboard', 'leather'][Math.floor(Math.random() * 6)];
      const lx = o + bw / 2;
      B.box(bw, bh, 0.24, col, x + Math.cos(rot) * lx, y + 0.11 + lv * 0.41 + bh / 2, z - Math.sin(rot) * lx, 'PROP', rot);
      o += bw + 0.002;
    }
  }
}
function sofa(B, x, y, z, rot) {
  B.box(2.1, 0.42, 0.9, 'leather', x, y + 0.21, z, 'FURN', rot, 0.06);
  B.box(2.1, 0.5, 0.2, 'leather', x - Math.sin(rot) * 0.36, y + 0.62, z - Math.cos(rot) * 0.36, 'FURN', rot, 0.06);
  for (const sd of [-1, 1]) B.box(0.2, 0.62, 0.9, 'leather', x + Math.cos(rot) * sd * 1.0, y + 0.31, z - Math.sin(rot) * sd * 1.0, 'FURN', rot, 0.06);
}
function terrarium(B, x, y, z) {
  B.box(0.8, 0.8, 0.45, 'darkPlastic', x, y + 0.4, z, 'FURN', Math.PI / 2, 0.02);
  B.box(0.75, 0.45, 0.42, 'glass', x, y + 1.03, z, null, Math.PI / 2);
  B.box(0.74, 0.04, 0.4, 'soil', x, y + 0.83, z, 'FURN', Math.PI / 2);
}
function cryoLocker(B, x, y, z) {
  B.box(1.8, 2.2, 0.8, 'steel', x, y + 1.1, z, 'FURN', 0, 0.02);
  B.box(1.7, 0.6, 0.02, 'frost', x, y + 1.6, z - 0.41, null);
  B.box(0.04, 0.3, 0.05, 'black', x + 0.7, y + 1.2, z - 0.43, 'SMALL');
}
function dewar(B, x, y, z) {
  B.cyl(0.25, 0.25, 0.9, 'steel', x, y + 0.45, z, 'FURN', 22);
  B.add(new THREE.SphereGeometry(0.25, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'steel', { p: [x, y + 0.9, z] }, 'FURN');
  B.cyl(0.06, 0.06, 0.12, 'paintBlue', x, y + 1.18, z, 'PROP', 12);
}
function vaultRacks(B, Y, ctx) {
  B.box(15.8, 2.6, 0.6, 'steel', 14, Y + 1.3, 21.6, 'FURN', 0, 0.02);
  for (let i = 0; i < 9; i++) {
    const x = 7.5 + i * 1.6;
    B.box(1.2, 0.8, 0.02, 'glassDark', x, Y + 1.5, 21.29, null);
    for (let k = 0; k < 6; k++) B.add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), 'liquidGreen', { p: [x - 0.4 + k * 0.16, Y + 1.28, 21.4] }, null);
    ctx.lights.push({ p: new THREE.Vector3(x, Y + 1.5, 21.0), color: 0x50ff90, i: 0.18 });
  }
  ctx.vials.push({ kind: 'growth', x: 12, y: Y + 0.75, z: 12 }, { kind: 'mutation', x: 18, y: Y + 0.75, z: 14 });
  B.box(1.0, 0.75, 0.6, 'steel', 12, Y + 0.375, 12, 'FURN', 0, 0.01);
  B.box(1.0, 0.75, 0.6, 'steel', 18, Y + 0.375, 14, 'FURN', 0, 0.01);
}

// ------------------------------------------------------------------ build one floor
export async function buildFloor(n, mats, parent) {
  const B = new Batch(mats);
  const y0 = elev(n);
  const ctx = { n, y0, lights: [], labels: [], notes: [], vials: [], spawns: [], humans: [], screens: [], boards: [], zones: [], panes: [], start: null };
  shell(B, n, y0, ctx);
  if (n === 48) floor48(B, y0, ctx);
  else if (FLOOR_BUILDERS[n]) FLOOR_BUILDERS[n](B, y0, ctx);
  else lockedFloor(B, y0, ctx);
  const g = new THREE.Group(); g.name = 'floor' + n;
  const meshes = await B.build(g);
  return { n, y0, group: g, meshes, batch: B, ctx };
}
function lockedFloor(B, y0, ctx) {
  B.box(44, 0.02, 44, 'concreteFloor', 0, y0 + 0.01, 0, 'STRUCT');
  B.box(44, 0.02, 44, 'concrete', 0, y0 + FLOOR_H - 0.31, 0, 'STRUCT');
}
export const FLOOR_BUILDERS = {}; // filled by floors.js (47, 31, 20, 9, 1)
