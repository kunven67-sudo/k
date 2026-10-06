// Building kit for city builders: real facades with recessed openings.
//
// A facade is described in its own 2D frame (x along the face as seen from the street, y up).
// Openings (windows, doors, storefront glass) are cut out of the wall by splitting the face into
// a grid on every opening edge and emitting only the solid cells (merged into horizontal runs),
// so every window has true reveals, a sill and a lintel. Glass sits back in the opening with an
// interior-mapped room behind it (shared/facade.js). Storefronts get bulkheads, mullions, a
// recessed door, transoms, a sign band and optionally an awning, security bars or a half-down
// roll shutter. Roofs get a parapet with coping, and HVAC units / vents / hatches.
//
//   addBuilding(ctx, spec) → { frames, top }      ctx = { batch, colliders, lights, rng }
//   facade(ctx, frameMatrix, spec)                 lower level: one wall face
//   faceFrame(x0, z0, x1, z1, y)                   matrix for a face from (x0,z0) → (x1,z1),
//                                                  outward normal on the right-hand side
//
// spec (addBuilding):
//   x0 x1 z0 z1, y (ground, default 0.15), h (wall height to roof), front: 'N'|'S'|'E'|'W'
//   wall: material, tint, grime · trim: material/tint for cornice & coping
//   faces: { N: faceSpec, S: ..., E: ..., W: ... } (missing faces → plain wall with optional
//          shader windows `sideWindows: {cell, win, style}`)
//   roof: { hvac: n, billboard: fn?, gravel: bool }

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { glassMat, paneGeometry, towerFacadeMat } from './facade.js';
import { tinted } from './batch.js';
import { propMats } from './props.js';
import { paintedSignMat } from './signs.js';
import { mat as kmat } from './kinds.js';
import { Rng } from '../../core/rng.js';

const Y = new THREE.Vector3(0, 1, 0);

let BM = null;
export function buildingMats() {
  if (BM) return BM;
  BM = {
    stucco: mat('stucco', { color: 0xffffff, seed: 61 }),
    brick: mat('brick', { seed: 62 }),
    brickPale: mat('brick', { color: 0xb59a7e, seed: 63 }),
    cinder: kmat('cinderblock', { color: 0xd8d2c6, seed: 64 }),
    veneer: kmat('stone-veneer', { seed: 65 }),
    concrete: mat('concrete', { seed: 66, dirt: 0.55 }),
    board: kmat('board-concrete', { seed: 67 }),
    tile: kmat('tile-bulkhead', { color: 0xffffff, seed: 68 }),
    trim: mat('painted-wood', { color: 0xffffff, wear: 0.5, dirt: 0.5, seed: 69 }),
    metal: mat('metal-painted', { color: 0xffffff, wear: 0.45, dirt: 0.5, seed: 70 }),
    alu: mat('aluminum', { wear: 0.5, dirt: 0.5, seed: 71 }),
    roof: kmat('roof-membrane', { seed: 72 }),
    gravel: kmat('roof-gravel'),
    corrugated: kmat('corrugated', { seed: 73 }),
    plywood: kmat('plywood', { seed: 74 }),
    doorMetal: mat('metal-painted', { color: 0x6b6f6a, wear: 0.6, dirt: 0.6, seed: 75 }),
  };
  return BM;
}

/** Local frame for a wall face running from (x0, z0) to (x1, z1) at ground y. Outward = right. */
export function faceFrame(x0, z0, x1, z1, y = 0) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  // Outward normal: right-hand side when walking from p0 to p1, seen from above with -Z north.
  const nx = -uz;
  const nz = ux;
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), Y, new THREE.Vector3(nx, 0, nz));
  m.setPosition(x0, y, z0);
  m.userData = { len };
  return { matrix: m, len, normal: new THREE.Vector3(nx, 0, nz), along: new THREE.Vector3(ux, 0, uz) };
}

// ---- Facade -------------------------------------------------------------------------------

/**
 * One wall face.
 * fs: { len, h, t (thickness), wall, tint, grime,
 *       openings: [{ x0, x1, y0, y1, kind: 'window'|'door'|'shop'|'void'|'garage'|'vent',
 *                    style, depth, frame (hex), bars, shutter (0..1), sill, glassTint }],
 *       cellMat(x, y) → {mat, tint} | null   (e.g. bulkhead tile under shop windows)
 *       bands: [{ y, h, d, mat, tint }]   horizontal projecting bands (cornice, sign band, belt course)
 *       sideWindows: shader window grid for blank walls }
 */
export function facade(ctx, frame, fs) {
  const { batch } = ctx;
  const M = buildingMats();
  const T = fs.t ?? 0.3;
  const len = fs.len ?? frame.len;
  const H = fs.h;
  const openings = (fs.openings || []).filter((o) => o.x1 > o.x0 && o.y1 > o.y0);
  const xs = new Set([0, len]);
  const ys = new Set([0, H]);
  for (const o of openings) {
    xs.add(clampN(o.x0, 0, len));
    xs.add(clampN(o.x1, 0, len));
    ys.add(clampN(o.y0, 0, H));
    ys.add(clampN(o.y1, 0, H));
  }
  for (const y of fs.splitY || []) ys.add(y);
  const X = [...xs].sort((a, b) => a - b);
  const Ys = [...ys].sort((a, b) => a - b);
  const inOpening = (cx, cy) => openings.some((o) => cx > o.x0 && cx < o.x1 && cy > o.y0 && cy < o.y1);
  let wallMat = fs.wall || M.stucco;
  const sideWin = fs.sideWindows;
  if (sideWin && !openings.length) {
    wallMat = facadeMatFor(wallMat, sideWin, fs.tint != null || fs.grime);
  }
  // Rows of solid cells merged into runs.
  for (let j = 0; j < Ys.length - 1; j++) {
    const y0 = Ys[j];
    const y1 = Ys[j + 1];
    if (y1 - y0 < 1e-4) continue;
    let run = null;
    const flush = () => {
      if (!run) return;
      const w = run.x1 - run.x0;
      const g = new THREE.BoxGeometry(w, y1 - y0, T);
      g.translate(run.x0 + w / 2, (y0 + y1) / 2, -T / 2);
      batch.add(g, run.mat, { matrix: frame.matrix, tint: run.tint, grime: fs.grime ?? 0.5, grimeBase: frame.matrix.elements[13], grimeHeight: 0.9 });
      run = null;
    };
    for (let i = 0; i < X.length - 1; i++) {
      const x0 = X[i];
      const x1 = X[i + 1];
      if (x1 - x0 < 1e-4) continue;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (inOpening(cx, cy)) {
        flush();
        continue;
      }
      const cm = fs.cellMat?.(cx, cy);
      const m = cm?.mat || wallMat;
      const tint = cm ? cm.tint : fs.tint;
      if (run && run.mat === m && run.tint === tint) run.x1 = x1;
      else {
        flush();
        run = { x0, x1, mat: m, tint };
      }
    }
    flush();
  }
  // Openings.
  for (const o of openings) opening(ctx, frame, o, T, fs);
  // Bands (cornice, belt courses, sign bands).
  for (const b of fs.bands || []) {
    const d = b.d ?? 0.25;
    const x0 = b.x0 ?? -0.02 - (b.wrap ?? 0);
    const x1 = b.x1 ?? len + 0.02 + (b.wrap ?? 0);
    const g = new THREE.BoxGeometry(x1 - x0, b.h, d + (b.wrap ? T : 0));
    g.translate((x0 + x1) / 2, b.y + b.h / 2, d / 2 - (b.wrap ? T / 2 : 0));
    batch.add(g, b.mat || M.trim, { matrix: frame.matrix, tint: b.tint ?? 0xe6dfcf, castShadow: true });
    if (b.cap) {
      const g2 = new THREE.BoxGeometry(x1 - x0 + 0.1, 0.06, d + 0.1);
      g2.translate((x0 + x1) / 2, b.y + b.h + 0.03, d / 2);
      batch.add(g2, b.mat || M.trim, { matrix: frame.matrix, tint: b.tint ?? 0xe6dfcf });
    }
  }
}

function clampN(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

const facadeCache = new Map();
function facadeMatFor(wallMat, sw, tintedWall) {
  const key = `${wallMat.uuid}|${JSON.stringify(sw)}|${tintedWall}`;
  if (!facadeCache.has(key)) {
    facadeCache.set(key, towerFacadeMat({ wall: tintedWall ? tinted(wallMat) : wallMat, ...sw }));
  }
  return facadeCache.get(key);
}

const _seed = new Rng('openings');

function opening(ctx, frame, o, T, fs) {
  const { batch } = ctx;
  const M = buildingMats();
  const P = propMats();
  const w = o.x1 - o.x0;
  const h = o.y1 - o.y0;
  const cx = (o.x0 + o.x1) / 2;
  const depth = o.depth ?? (o.kind === 'shop' ? 0.12 : o.kind === 'door' ? 0.22 : 0.16);
  const frameCol = o.frame ?? 0x2c2c2c;
  const add = (g, m, opts = {}) => batch.add(g, m, { matrix: frame.matrix, ...opts });
  const back = -Math.min(T - 0.02, depth);
  // Opening floor/ceiling liners (the reveals at top and bottom; sides come from wall cells).
  if (o.kind !== 'void') {
    if (o.y0 > 0.01 || o.kind === 'window') {
      // Sill: protruding for windows.
      const sill = o.sill ?? o.kind === 'window';
      const sd = sill ? 0.07 : 0;
      const g = new THREE.BoxGeometry(w + (sill ? 0.12 : 0), 0.05, -back + sd);
      g.translate(cx, o.y0 - 0.025 + (sill ? 0.0 : 0.025), (back + sd) / 2);
      add(g, sill ? M.concrete : (fs.wall || M.stucco), { tint: sill ? undefined : fs.tint });
    }
  }
  if (o.kind === 'window' || o.kind === 'shop') {
    // Frame.
    const fw = o.kind === 'shop' ? 0.06 : 0.05;
    const fm = M.alu;
    const fz = back + 0.03;
    const box = (bw, bh, x, y) => {
      const g = new THREE.BoxGeometry(bw, bh, 0.07);
      g.translate(x, y, fz);
      add(g, o.frameMat || (o.kind === 'shop' ? fm : M.metal), { tint: o.kind === 'shop' && !o.frameMat ? undefined : frameCol });
    };
    box(w, fw, cx, o.y0 + fw / 2);
    box(w, fw, cx, o.y1 - fw / 2);
    box(fw, h, o.x0 + fw / 2, (o.y0 + o.y1) / 2);
    box(fw, h, o.x1 - fw / 2, (o.y0 + o.y1) / 2);
    // Mullions / muntins.
    const nm = o.mullions ?? (o.kind === 'shop' ? Math.max(0, Math.round(w / 1.6) - 1) : w > 1.4 ? 1 : 0);
    for (let k = 1; k <= nm; k++) box(fw * 0.9, h, o.x0 + (w * k) / (nm + 1), (o.y0 + o.y1) / 2);
    if (o.transom) box(w, fw, cx, o.y1 - o.transom);
    if (o.kind === 'window' && o.meeting !== false && h > 1.0) box(w, fw * 0.8, cx, o.y0 + h * 0.52);
    // Glass with an interior behind it.
    const g = paneGeometry(w - fw, h - fw, _seed.next());
    g.translate(cx, (o.y0 + o.y1) / 2, back);
    add(g, o.style === 'clear' ? P.glass : glassMat({ style: o.style || (o.kind === 'shop' ? 'shop' : 'room'), tint: o.glassTint ?? 0x9aa7ad }), { uv: 'keep', castShadow: false });
    // Security bars (pawn shops, liquor stores, ground-floor windows on 4th).
    if (o.bars) {
      const n = Math.max(3, Math.round(w / 0.13));
      for (let k = 0; k <= n; k++) {
        const bx = o.x0 + 0.06 + ((w - 0.12) * k) / n;
        const bg = new THREE.CylinderGeometry(0.011, 0.011, h - 0.05, 6);
        bg.translate(bx, (o.y0 + o.y1) / 2, 0.06);
        add(bg, P.iron, {});
      }
      for (const yy of [o.y0 + 0.12, (o.y0 + o.y1) / 2, o.y1 - 0.12]) {
        const hb = new THREE.BoxGeometry(w, 0.035, 0.02);
        hb.translate(cx, yy, 0.06);
        add(hb, P.iron, {});
      }
      ctx.colliders?.local?.(frame.matrix, cx, (o.y0 + o.y1) / 2, 0.06, w, h, 0.05);
    }
    // Half-down roll shutter.
    if (o.shutter) {
      const sh = h * o.shutter;
      const sg = new THREE.PlaneGeometry(w, sh);
      sg.translate(cx, o.y1 - sh / 2, 0.02);
      add(sg, M.corrugated, { uv: 0.5, tint: 0xb8b8b4 });
      const hood = new THREE.BoxGeometry(w + 0.1, 0.32, 0.3);
      hood.translate(cx, o.y1 + 0.16, 0.12);
      add(hood, M.metal, { tint: 0x8d8f8c });
    }
  } else if (o.kind === 'door') {
    // Recessed entry: door slab (glass door with push bar, or painted steel), frame, threshold.
    const fm = M.alu;
    const dz = back + 0.04;
    const glassDoor = o.glassDoor ?? true;
    const fwid = 0.07;
    const box = (bw, bh, bd, x, y, z, m, tint) => {
      const g = new THREE.BoxGeometry(bw, bh, bd);
      g.translate(x, y, z);
      add(g, m, { tint });
    };
    box(w, fwid, 0.12, cx, o.y1 - fwid / 2, dz, fm);
    box(fwid, h, 0.12, o.x0 + fwid / 2, (o.y0 + o.y1) / 2, dz, fm);
    box(fwid, h, 0.12, o.x1 - fwid / 2, (o.y0 + o.y1) / 2, dz, fm);
    const leaves = w > 1.4 ? 2 : 1;
    const lw = (w - fwid * 2) / leaves;
    for (let k = 0; k < leaves; k++) {
      const lx = o.x0 + fwid + lw * (k + 0.5);
      if (glassDoor) {
        box(lw, 0.12, 0.05, lx, o.y0 + 0.06, dz, fm);
        box(lw, 0.1, 0.05, lx, o.y1 - fwid - 0.05, dz, fm);
        box(0.08, h - fwid, 0.05, lx - lw / 2 + 0.04, (o.y0 + o.y1 - fwid) / 2, dz, fm);
        box(0.08, h - fwid, 0.05, lx + lw / 2 - 0.04, (o.y0 + o.y1 - fwid) / 2, dz, fm);
        const g = paneGeometry(lw - 0.16, h - fwid - 0.22, _seed.next());
        g.translate(lx, o.y0 + 0.12 + (h - fwid - 0.22) / 2, dz);
        add(g, o.style === 'clear' ? P.glass : glassMat({ style: o.style || 'shop', tint: o.glassTint ?? 0x7d8a8f }), { uv: 'keep', castShadow: false });
        box(lw * 0.7, 0.04, 0.06, lx, o.y0 + 1.0, dz + 0.05, P.steel);
      } else {
        box(lw - 0.02, h - fwid, 0.05, lx, (o.y0 + o.y1 - fwid) / 2, dz, M.doorMetal, o.doorTint);
        box(0.04, 0.16, 0.05, lx + lw * 0.35, o.y0 + 1.0, dz + 0.04, P.steel);
      }
    }
    // Threshold.
    box(w, 0.02, -back + 0.02, cx, o.y0 + 0.01, back / 2, M.alu);
    if (o.shutter) {
      const sh = h * o.shutter;
      const sg = new THREE.PlaneGeometry(w, sh);
      sg.translate(cx, o.y1 - sh / 2, 0.02);
      add(sg, M.corrugated, { uv: 0.5, tint: 0xb8b8b4 });
    }
  } else if (o.kind === 'vent') {
    const g = new THREE.BoxGeometry(w, h, 0.05);
    g.translate(cx, (o.y0 + o.y1) / 2, back);
    add(g, M.metal, { tint: 0x6e706c });
    for (let k = 0; k < Math.floor(h / 0.08); k++) {
      const s = new THREE.BoxGeometry(w - 0.04, 0.012, 0.06);
      s.translate(cx, o.y0 + 0.04 + k * 0.08, back + 0.04);
      s.rotateX(0);
      add(s, M.metal, { tint: 0x55575a });
    }
  } else if (o.kind === 'boarded') {
    const g = new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.03);
    g.translate(cx, (o.y0 + o.y1) / 2, 0.02);
    add(g, M.plywood, {});
  }
}

// ---- Whole building -------------------------------------------------------------------------

const SIDES = {
  // face from p0 → p1 so that the outward normal points to the named side. E/W faces run between
  // the N/S walls (inset by the wall thickness t) so corners never have coplanar overlaps.
  S: (b) => [b.x0, b.z1, b.x1, b.z1],
  N: (b) => [b.x1, b.z0, b.x0, b.z0],
  E: (b, t) => [b.x1, b.z1 - t, b.x1, b.z0 + t],
  W: (b, t) => [b.x0, b.z0 + t, b.x0, b.z1 - t],
};

export function addBuilding(ctx, spec) {
  const { batch, colliders } = ctx;
  const M = buildingMats();
  const y = spec.y ?? 0.15;
  const h = spec.h;
  const rng = new Rng(spec.seed ?? `${spec.x0},${spec.z0}`);
  const frames = {};
  for (const side of ['N', 'S', 'E', 'W']) {
    const [ax, az, bx, bz] = SIDES[side](spec, spec.faces?.N === false || spec.faces?.S === false ? 0 : spec.t ?? 0.3);
    const f = faceFrame(ax, az, bx, bz, y);
    frames[side] = f;
    const fsIn = spec.faces?.[side];
    if (fsIn === false) continue; // shared party wall — neighbour covers it
    const fs = {
      h,
      t: spec.t ?? 0.3,
      wall: spec.wall,
      tint: spec.tint,
      grime: spec.grime ?? 0.55,
      ...(fsIn || {}),
    };
    if (!fsIn && spec.sideWindows) fs.sideWindows = spec.sideWindows;
    // Faces are inset by the wall thickness at the ends so corners close without overlap.
    facade(ctx, f, fs);
  }
  // Roof slab + parapet.
  const W = spec.x1 - spec.x0;
  const D = spec.z1 - spec.z0;
  const cx = (spec.x0 + spec.x1) / 2;
  const cz = (spec.z0 + spec.z1) / 2;
  const roofY = y + h;
  const rg = new THREE.BoxGeometry(W - 0.1, 0.25, D - 0.1).translate(cx, roofY - 0.4, cz);
  batch.add(rg, spec.roof?.gravel ? M.gravel : M.roof, { castShadow: false });
  const par = spec.parapet ?? 0.9;
  if (par > 0) {
    const t = 0.25;
    const pm = spec.parapetMat || spec.wall || M.stucco;
    const pt = spec.parapetTint ?? spec.tint;
    const ring = [
      [cx, cz - D / 2 + t / 2, W, t],
      [cx, cz + D / 2 - t / 2, W, t],
      [spec.x0 + t / 2, cz, t, D - 2 * t],
      [spec.x1 - t / 2, cz, t, D - 2 * t],
    ];
    for (const [px, pz, pw, pd] of ring) {
      batch.add(new THREE.BoxGeometry(pw, par, pd).translate(px, roofY + par / 2, pz), pm, { tint: pt, grime: 0.3, grimeBase: roofY });
      batch.add(new THREE.BoxGeometry(pw + 0.08, 0.07, pd + 0.08).translate(px, roofY + par + 0.035, pz), M.metal, { tint: spec.coping ?? 0x8e8e88 });
    }
  }
  // Roof clutter.
  const nH = spec.roof?.hvac ?? Math.max(0, Math.floor((W * D) / 220));
  for (let i = 0; i < nH; i++) {
    const hx = rng.range(spec.x0 + 2, spec.x1 - 2);
    const hz = rng.range(spec.z0 + 2, spec.z1 - 2);
    hvac(batch, hx, roofY - 0.28, hz, rng.range(0, Math.PI), rng);
  }
  if (spec.roof?.vents !== false) {
    for (let i = 0; i < Math.max(1, Math.floor((W * D) / 120)); i++) {
      const vx = rng.range(spec.x0 + 1.2, spec.x1 - 1.2);
      const vz = rng.range(spec.z0 + 1.2, spec.z1 - 1.2);
      batch.add(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 10).translate(vx, roofY - 0.28 + 0.35, vz), M.metal, { tint: 0x9a9a96 });
      batch.add(new THREE.ConeGeometry(0.2, 0.15, 10).translate(vx, roofY - 0.28 + 0.78, vz), M.metal, { tint: 0x9a9a96 });
    }
  }
  if (colliders && spec.collide !== false) colliders.aabb(spec.x0, y - 0.2, spec.z0, spec.x1, roofY + par, spec.z1);
  return { frames, top: roofY, y };
}

export function hvac(batch, x, y, z, ry, rng) {
  const M = buildingMats();
  const w = rng.range(1.4, 2.4);
  const d = rng.range(1.0, 1.6);
  const h = rng.range(0.9, 1.3);
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  batch.add(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), M.metal, { matrix: m, tint: 0xb7b6ae, grime: 0.6, grimeBase: y });
  batch.add(new THREE.BoxGeometry(w + 0.2, 0.12, d + 0.2).translate(0, 0.06, 0), M.metal, { matrix: m, tint: 0x6f6f6a });
  // Fan grille on top.
  batch.add(new THREE.CylinderGeometry(Math.min(w, d) * 0.32, Math.min(w, d) * 0.32, 0.06, 18).translate(0, h + 0.03, 0), M.metal, { matrix: m, tint: 0x3a3a38 });
  // Duct going down into the roof.
  batch.add(new THREE.BoxGeometry(0.5, 0.5, 0.9).translate(w / 2 + 0.25, 0.25, 0), M.metal, { matrix: m, tint: 0xa9a8a0 });
}

// ---- Awnings & sign bands -----------------------------------------------------------------------

const awnCache = new Map();
export function awningMat(colors, { text = '', font = '400 60px "Bebas Neue"', textColor = '#f3eee2', seed = 1 } = {}) {
  const key = `${colors.join(',')}|${text}`;
  if (awnCache.has(key)) return awnCache.get(key);
  const m = paintedSignMat(`awning-${key}`, 512, 256, (g, w, h) => {
    const n = colors.length > 1 ? 12 : 1;
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect((i * w) / n, 0, w / n + 1, h);
    }
    // Fabric weave + sun-bleached top.
    for (let yy = 0; yy < h; yy += 3) {
      g.fillStyle = `rgba(0,0,0,${0.03 + (yy % 6 === 0 ? 0.03 : 0)})`;
      g.fillRect(0, yy, w, 1);
    }
    if (text) {
      g.fillStyle = textColor;
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h * 0.86);
    }
  }, { weather: { seed, fade: 0.55, grime: 0.5, rust: 0, scratches: 0.1 }, rough: 0.85 });
  m.side = THREE.DoubleSide;
  awnCache.set(key, m);
  return m;
}

/** Sloped fabric awning over a storefront (in a face frame). */
export function awning(ctx, frame, { x0, x1, y, proj = 1.2, drop = 0.7, valance = 0.28, mat: am }) {
  const { batch } = ctx;
  const w = x1 - x0;
  const slope = Math.hypot(proj, drop);
  // Sloped panel: from wall (y) down/out to (y - drop) at z = proj. UVs: u across, v down slope.
  const g = new THREE.PlaneGeometry(w, slope, 8, 2);
  g.rotateX(-Math.PI / 2 + Math.atan2(drop, proj));
  g.translate((x0 + x1) / 2, y - drop / 2, proj / 2);
  // Slight belly sag.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) - x0) / w;
    p.setY(i, p.getY(i) - Math.sin(u * Math.PI * Math.max(1, Math.round(w / 1.8))) ** 2 * 0.025);
  }
  g.computeVertexNormals();
  // Remap UVs to the upper 75% of the texture (valance uses the bottom strip with the text).
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 0.25 + uv.getY(i) * 0.75);
  batch.add(g, am, { matrix: frame.matrix, uv: 'keep' });
  const vg = new THREE.PlaneGeometry(w, valance);
  const vuv = vg.attributes.uv;
  for (let i = 0; i < vuv.count; i++) vuv.setY(i, vuv.getY(i) * 0.25);
  vg.translate((x0 + x1) / 2, y - drop - valance / 2, proj);
  batch.add(vg, am, { matrix: frame.matrix, uv: 'keep' });
  // Side cheeks.
  for (const sx of [x0, x1]) {
    const s = new THREE.BufferGeometry();
    s.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -drop, proj, 0, -drop - valance, proj], 3));
    s.setAttribute('uv', new THREE.Float32BufferAttribute([0.02, 0.9, 0.02, 0.3, 0.02, 0.05], 2));
    s.computeVertexNormals();
    s.translate(sx, y, 0);
    batch.add(s, am, { matrix: frame.matrix, uv: 'keep' });
  }
  // Frame tubes.
  const P = propMats();
  for (const sx of [x0 + 0.05, x1 - 0.05]) {
    const t = new THREE.CylinderGeometry(0.015, 0.015, slope, 6).rotateX(Math.PI / 2 - Math.atan2(drop, proj)).translate(sx, y - drop / 2, proj / 2);
    batch.add(t, P.iron, { matrix: frame.matrix });
  }
}

/** Flat sign panel on a face (box sign cabinet) with a painted/lit material. */
export function signPanel(ctx, frame, { x0, x1, y0, y1, d = 0.18, mat: sm, cabinet = 0x2a2a2a }) {
  const { batch } = ctx;
  const w = x1 - x0;
  const h = y1 - y0;
  const cab = new THREE.BoxGeometry(w + 0.08, h + 0.08, d);
  cab.translate((x0 + x1) / 2, (y0 + y1) / 2, d / 2);
  batch.add(cab, buildingMats().metal, { matrix: frame.matrix, tint: cabinet });
  const p = new THREE.PlaneGeometry(w, h);
  p.translate((x0 + x1) / 2, (y0 + y1) / 2, d + 0.004);
  batch.add(p, sm, { matrix: frame.matrix, uv: 'keep', castShadow: false });
}

/** World-space point on a face frame (x along, y up, z out). */
export function onFace(frame, x, y, z = 0) {
  return new THREE.Vector3(x, y, z).applyMatrix4(frame.matrix);
}

// ---- Shopfront building (declarative) ---------------------------------------------------------

/**
 * A typical small commercial building with one (or two) street faces.
 * spec: x0 x1 z0 z1 h, y, wall, tint, street: ['W', 'N', ...] (faces with storefronts),
 *   shop: { bays: n, door: 'left'|'center'|'right', bars, shutter, style, frame, bulkheadTint,
 *           glassTint }
 *   upper: { rows: n, y0: first sill, pitch, w, h, style, frame, every }   windows above the shop
 *   sign:  (frame, face, ctx) => void        draw custom signage after the facade is built
 *   awning: { colors, text }                 fabric awning over the shop windows
 *   band:  { h, tint, mat }                  sign band over the storefront (default on)
 *   sideWindows: shader windows on the blank faces
 * Returns addBuilding's result plus `frames`.
 */
export function shopBuilding(ctx, spec) {
  const M = buildingMats();
  const faces = {};
  const shopTop = spec.shopTop ?? 3.4;
  for (const side of spec.street || []) {
    const len = side === 'N' || side === 'S' ? spec.x1 - spec.x0 : spec.z1 - spec.z0 - 2 * (spec.t ?? 0.3);
    const sh = spec.shop || {};
    const bays = sh.bays ?? Math.max(1, Math.round(len / 4));
    const openings = [];
    const doorAt = sh.door ?? 'center';
    const bw = (len - 0.6) / bays;
    const doorBay = doorAt === 'left' ? 0 : doorAt === 'right' ? bays - 1 : Math.floor(bays / 2);
    for (let i = 0; i < bays; i++) {
      const bx0 = 0.3 + i * bw + 0.25;
      const bx1 = 0.3 + (i + 1) * bw - 0.25;
      if (i === doorBay && sh.noDoor !== true) {
        const dw = Math.min(1.9, bx1 - bx0);
        const dc = (bx0 + bx1) / 2;
        openings.push({ kind: 'door', x0: dc - dw / 2, x1: dc + dw / 2, y0: 0, y1: 2.5, style: sh.style || 'shop', glassDoor: sh.glassDoor ?? true, doorTint: sh.doorTint, shutter: sh.doorShutter });
        if (bx1 - bx0 > dw + 1.2) {
          openings.push({ kind: 'shop', x0: bx0, x1: dc - dw / 2 - 0.3, y0: 0.7, y1: shopTop - 0.3, style: sh.style || 'shop', bars: sh.bars, shutter: sh.shutter, glassTint: sh.glassTint });
          openings.push({ kind: 'shop', x0: dc + dw / 2 + 0.3, x1: bx1, y0: 0.7, y1: shopTop - 0.3, style: sh.style || 'shop', bars: sh.bars, shutter: sh.shutter, glassTint: sh.glassTint });
        }
        openings.push({ kind: 'shop', x0: dc - dw / 2, x1: dc + dw / 2, y0: 2.65, y1: shopTop - 0.3, style: sh.style || 'shop', mullions: 0, glassTint: sh.glassTint });
      } else if (sh.boarded) {
        openings.push({ kind: 'boarded', x0: bx0, x1: bx1, y0: 0.7, y1: shopTop - 0.3 });
      } else {
        openings.push({ kind: 'shop', x0: bx0, x1: bx1, y0: 0.7, y1: shopTop - 0.3, style: sh.style || 'shop', bars: sh.bars, shutter: sh.shutter, glassTint: sh.glassTint, mullions: sh.mullions });
      }
    }
    const up = spec.upper;
    if (up) {
      const pitch = up.pitch ?? 3.2;
      const n = Math.max(1, Math.floor((len - 1) / pitch));
      const off = (len - n * pitch) / 2;
      for (let r = 0; r < (up.rows ?? 1); r++) {
        const y0 = (up.y0 ?? shopTop + 1.6) + r * (up.floor ?? 3.2);
        for (let i = 0; i < n; i++) {
          const cx = off + (i + 0.5) * pitch;
          const w = up.w ?? 1.3;
          const boarded = up.boarded && ((i * 7 + r * 3) % 5 === 0);
          openings.push({ kind: boarded ? 'boarded' : 'window', x0: cx - w / 2, x1: cx + w / 2, y0, y1: y0 + (up.h ?? 1.7), style: up.style || 'room', frame: up.frame ?? 0x3a3a36, sill: true });
        }
      }
    }
    faces[side] = {
      openings,
      cellMat: (x, y) => (y < 0.7 ? { mat: sh.bulkheadMat || M.tile, tint: sh.bulkheadTint ?? 0x3d5a4c } : null),
      splitY: [0.7],
      bands: spec.band === false ? [] : [{ y: shopTop, h: spec.band?.h ?? 0.9, d: spec.band?.d ?? 0.18, mat: spec.band?.mat || M.trim, tint: spec.band?.tint ?? 0xd9d0bc }, ...(spec.cornice !== false ? [{ y: spec.h - 0.35, h: 0.35, d: 0.22, mat: M.trim, tint: spec.corniceTint ?? 0xcfc6b4, cap: true }] : [])],
    };
  }
  const res = addBuilding(ctx, { ...spec, faces: { ...faces, ...(spec.faces || {}) } });
  for (const side of spec.street || []) {
    if (spec.awning) awning(ctx, res.frames[side], { x0: 0.3, x1: (side === 'N' || side === 'S' ? spec.x1 - spec.x0 : spec.z1 - spec.z0) - 0.3, y: shopTop - 0.05, proj: spec.awning.proj ?? 1.3, drop: 0.75, mat: awningMat(spec.awning.colors, { text: spec.awning.text, seed: spec.awning.seed ?? 1 }) });
    spec.sign?.(res.frames[side], side, ctx, shopTop);
  }
  return res;
}
