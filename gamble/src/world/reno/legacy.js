// Silver Legacy (with its landmark dome) and Circus Circus — the neighbours of the Eldorado on
// "The Row", linked by skyways. Built as convincing exterior massing with real street-level
// frontage on Virginia St and 4th St (the parts you can walk up to), and towers / dome / signs
// that read from anywhere downtown.
//
//   buildLegacy(ctx)  → nothing to return; adds geometry, colliders, lights.
//
// Silver Legacy footprint x ∈ [-110, -12], z ∈ [-108, -12] (chamfered at 4th & Virginia).
// Circus Circus footprint x ∈ [-135, -12], z ∈ [-215, -130].

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { facade, faceFrame, buildingMats, hvac, signPanel } from '../shared/buildings.js';
import { towerFacadeMat } from '../shared/facade.js';
import { tinted } from '../shared/batch.js';
import { channelLetters, litFaceMat } from '../shared/letters.js';
import { BulbSet, SIGNS, ledScreenMat, fitText } from '../shared/signs.js';
import { skyway } from './eldorado.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';

const Y0 = 0.15;
const T = 0.4;

export function buildLegacy(ctx) {
  silverLegacy(ctx);
  circusCircus(ctx);
  skyway(ctx, { x0: -48, x1: -42, z0: -108.1, z1: -129.9, y0: Y0 + 7.0, y1: Y0 + 10.8, sign: t('reno.circus.name') });
}

function silverLegacy(ctx) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const rng = new Rng('legacy');
  const X0 = -110;
  const X1 = -12;
  const Z0 = -108;
  const Z1 = -12;
  const CH = 6;
  const H = 18;
  const WALL = 0xeee8dc;
  const teal = mat('metal-painted', { color: 0x2f5f63, wear: 0.3, dirt: 0.35, seed: 101 });
  const silver = mat('aluminum', { wear: 0.25, dirt: 0.3, seed: 102 });
  const faces = {
    virginia: faceFrame(X1, Z0 + T, X1, Z1 - CH, Y0),
    chamfer: faceFrame(X1, Z1 - CH, X1 - CH, Z1, Y0),
    fourth: faceFrame(X1 - CH, Z1, X0, Z1, Y0),
    west: faceFrame(X0, Z1 - T, X0, Z0 + T, Y0),
    north: faceFrame(X0, Z0, X1, Z0, Y0),
  };
  // Note: for the north side of 4th St the street face points SOUTH (+z) — faceFrame gives the
  // outward normal on the right of p0→p1, so 'fourth' runs east→west along z = -12 … which
  // points north. Rebuild it the other way round:
  faces.fourth = faceFrame(X0, Z1, X1 - CH, Z1, Y0);
  faces.chamfer = faceFrame(X1 - CH, Z1, X1, Z1 - CH, Y0);
  faces.virginia = faceFrame(X1, Z1 - CH, X1, Z0 + T, Y0);
  faces.north = faceFrame(X1, Z0, X0, Z0, Y0);
  faces.west = faceFrame(X0, Z0 + T, X0, Z1 - T, Y0);

  const bandsStd = [
    { y: 1.0, h: 0.15, d: 0.1, mat: silver, tint: 0xffffff },
    { y: 6.8, h: 0.5, d: 0.5, mat: teal, tint: 0xffffff, cap: true },
    { y: 12.4, h: 0.3, d: 0.3, mat: teal, tint: 0xffffff },
    { y: 17.0, h: 1.0, d: 0.7, mat: teal, tint: 0xffffff, cap: true },
  ];
  const street = (f, entrances = []) => {
    const op = [];
    for (let x = 3; x < f.len - 3; x += 6.5) {
      const ent = entrances.find((e) => x + 1.8 > e.x0 - 0.6 && x - 1.8 < e.x1 + 0.6);
      if (!ent) op.push({ kind: 'shop', x0: x - 1.8, x1: x + 1.8, y0: 0.9, y1: 4.8, style: rng.chance(0.6) ? 'casino' : 'shop', glassTint: 0x6a6a5e, mullions: 1, transom: 0.9 });
      // Victorian arched upper windows (two rows) and round attic windows.
      for (const [y0, y1] of [[8.0, 10.8], [13.2, 15.6]]) op.push({ kind: 'window', x0: x - 0.85, x1: x + 0.85, y0, y1, style: rng.chance(0.5) ? 'room' : 'office', frame: 0x2f5f63 });
    }
    for (const e of entrances) op.push({ kind: 'door', x0: e.x0, x1: e.x1, y0: 0, y1: 3.4, style: 'casino', glassTint: 0x5a5a50 });
    return op;
  };
  const cell = (x, y) => (y < 1.0 ? { mat: BM.veneer, tint: 0xd8d2c8 } : null);
  const vEnt = [{ x0: 44, x1: 52 }];
  const vOps = street(faces.virginia, vEnt);
  facade(ctx, faces.virginia, { len: faces.virginia.len, h: H, t: T, wall: BM.stucco, tint: WALL, openings: vOps, cellMat: cell, splitY: [1.0], bands: bandsStd });
  const fOps = street(faces.fourth, [{ x0: 58, x1: 64 }]);
  facade(ctx, faces.fourth, { len: faces.fourth.len, h: H, t: T, wall: BM.stucco, tint: WALL, openings: fOps, cellMat: cell, splitY: [1.0], bands: bandsStd });
  facade(ctx, faces.chamfer, {
    len: faces.chamfer.len, h: H, t: T, wall: BM.stucco, tint: WALL, cellMat: cell, splitY: [1.0], bands: bandsStd,
    openings: [{ kind: 'door', x0: 1.5, x1: faces.chamfer.len - 1.5, y0: 0, y1: 3.4, style: 'casino', glassTint: 0x5a5a50 }],
  });
  const back = { cell: [3.4, 3.2], win: [1.3, 1.7], y0: Y0 + 7.5, y1: Y0 + 16.5, style: 'office', glass: 0x5d6a72, frame: 0x2f5f63, seed: 7, litMul: 0.5 };
  facade(ctx, faces.west, { len: faces.west.len, h: H, t: T, wall: BM.stucco, tint: 0xe2dccf, grime: 0.7, sideWindows: back, bands: [bandsStd[3]] });
  facade(ctx, faces.north, { len: faces.north.len, h: H, t: T, wall: BM.stucco, tint: 0xe2dccf, grime: 0.7, sideWindows: back, bands: [bandsStd[3]] });
  // Pilasters + arched window moldings on the two street faces.
  for (const [f, ops] of [[faces.virginia, vOps], [faces.fourth, fOps]]) {
    for (let x = -0.25; x < f.len; x += 6.5) {
      batch.add(new THREE.BoxGeometry(0.55, H - 1.2, 0.28).translate(x, (H - 1.2) / 2, 0.14), BM.stucco, { matrix: f.matrix, tint: 0xf4efe6, grime: 0.4, grimeBase: Y0 });
      colliders.local(f.matrix, x, 3.5, 0.14, 0.55, 7, 0.28);
    }
    for (const o of ops) {
      if (o.kind !== 'window') continue;
      const cx = (o.x0 + o.x1) / 2;
      const w = o.x1 - o.x0;
      batch.add(new THREE.TorusGeometry(w / 2 + 0.08, 0.08, 6, 14, Math.PI).translate(cx, o.y1, 0.06), teal, { matrix: f.matrix, tint: 0xffffff });
      batch.add(new THREE.CircleGeometry(w / 2, 14, 0, Math.PI).translate(cx, o.y1, -0.14), teal, { matrix: f.matrix, tint: 0x7a8a86, castShadow: false });
    }
  }
  // Entrance canopy on Virginia with SILVER LEGACY letters + bulbs.
  const vf = faces.virginia;
  const ec = (vEnt[0].x0 + vEnt[0].x1) / 2;
  batch.add(new THREE.BoxGeometry(12, 0.9, 4.3).translate(ec, 4.7, 2.15), silver, { matrix: vf.matrix });
  const name = t('reno.legacy.name');
  const silverFace = litFaceMat(0xd8ecff, { k: 3.2, dayColor: 0xc8ccd0, metal: 0.8, rough: 0.25 });
  const blueFace = litFaceMat(0x6fb8ff, { k: 3.0, dayColor: 0x2f5f63, metal: 0.2 });
  const bulbs = new BulbSet({ radius: 0.05, pattern: 'chase', speed: 6, intensity: 8, dayIntensity: 0.15 });
  channelLetters(ctx, name, {
    font: '"Playfair Display"', weight: 700, height: 0.55, depth: 0.08, tracking: 0.12,
    matrix: new THREE.Matrix4().multiplyMatrices(vf.matrix, new THREE.Matrix4().makeTranslation(ec, 4.42, 4.31)),
    face: blueFace, side: silver,
  });
  for (let x = ec - 6; x <= ec + 6; x += 0.3) bulbs.add(new THREE.Vector3(x, 5.18, 4.33).applyMatrix4(vf.matrix), Math.round((x - ec) / 0.3) + 40, 0xf2f6ff);
  for (const z of [44, 50, 56]) lights.push({ pos: new THREE.Vector3(X1 + 2, Y0 + 4.0, -60 + (z - 50)), color: 0xdfeaff, intensity: 10, distance: 10, kind: 'lamp', groundY: Y0, width: 2 });
  // Big letters on the parapet (Virginia + 4th).
  channelLetters(ctx, name, {
    font: '"Playfair Display"', weight: 700, height: 2.3, depth: 0.3, tracking: 0.12,
    matrix: new THREE.Matrix4().multiplyMatrices(vf.matrix, new THREE.Matrix4().makeTranslation(vf.len / 2, H + 0.4, -0.2)),
    face: silverFace, side: silver, bulbs, spacing: 0.22, bulbColor: 0xeaf2ff,
  });
  const ff = faces.fourth;
  channelLetters(ctx, name, {
    font: '"Playfair Display"', weight: 700, height: 2.3, depth: 0.3, tracking: 0.12,
    matrix: new THREE.Matrix4().multiplyMatrices(ff.matrix, new THREE.Matrix4().makeTranslation(ff.len * 0.62, H + 0.4, -0.2)),
    face: silverFace, side: silver, bulbs, spacing: 0.22, bulbColor: 0xeaf2ff,
  });
  for (const [f, x] of [[vf, vf.len / 2], [ff, ff.len * 0.62]]) {
    for (const dx of [-8, 0, 8]) lights.push({ pos: new THREE.Vector3(x + dx, H + 1.5, 1.5).applyMatrix4(f.matrix), color: 0xcfe2ff, intensity: 16, distance: 20, kind: 'neon', width: 5, groundY: 0.15, realLight: false, poolK: 0.4 });
  }
  // Corner LED on the chamfer.
  const cf = faces.chamfer;
  const led = ledScreenMat('legacy', [
    (g, w, h) => slide(g, w, h, '#06223a', '#cfe9ff', name),
    (g, w, h) => slide(g, w, h, '#0e0e0e', '#ffd56a', 'BREW BROTHERS'),
    (g, w, h) => slide(g, w, h, '#240a2a', '#ff8af0', 'CRAPS · BLACKJACK'),
  ], { w: 512, h: 288, dots: [160, 90], hold: 5.2 });
  const sw = cf.len - 1;
  batch.add(new THREE.BoxGeometry(sw + 0.5, sw * 0.5625 + 0.5, 0.4).translate(cf.len / 2, 8.2 + sw * 0.28, 0.2), BM.metal, { matrix: cf.matrix, tint: 0x222428 });
  batch.add(new THREE.PlaneGeometry(sw, sw * 0.5625).translate(cf.len / 2, 8.2 + sw * 0.28, 0.41), led, { matrix: cf.matrix, uv: 'keep', castShadow: false });
  lights.push({ pos: new THREE.Vector3(cf.len / 2, 8.2 + sw * 0.28, 1.2).applyMatrix4(cf.matrix), color: 0xbfd6ff, intensity: 18, distance: 18, kind: 'neon', width: sw, groundY: 0.15 });

  // Roof slab.
  const shape = new THREE.Shape([
    new THREE.Vector2(X0, -Z0), new THREE.Vector2(X1, -Z0), new THREE.Vector2(X1, -(Z1 - CH)), new THREE.Vector2(X1 - CH, -Z1), new THREE.Vector2(X0, -Z1),
  ]);
  const roof = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false }).rotateX(-Math.PI / 2);
  batch.add(roof.translate(0, Y0 + H - 0.4, 0), BM.roof, { castShadow: false });
  for (let i = 0; i < 8; i++) hvac(batch, rng.range(X0 + 5, X1 - 8), Y0 + H, rng.range(Z0 + 5, Z1 - 8), rng.range(0, 3), rng);
  colliders.aabb(X0, Y0 - 0.2, Z0, X1 - CH, Y0 + H, Z1);
  colliders.aabb(X1 - CH, Y0 - 0.2, Z0, X1, Y0 + H, Z1 - CH);
  // Chamfer wedge: approximate with a rotated box along the diagonal.
  colliders.box(X1 - CH / 2 - 0.6, Y0 + H / 2, Z1 - CH / 2 - 0.6, CH * 1.41, H, 1.8, Math.PI / 4);

  // ---- Dome on a drum ----
  const dc = new THREE.Vector3(-64, Y0 + H, -62);
  const R = 26;
  const domeMat = domeMaterial();
  const drum = new THREE.CylinderGeometry(R + 0.5, R + 0.8, 7, 64, 1, true).translate(dc.x, dc.y + 3.5, dc.z);
  batch.add(drum, BM.stucco, { tint: 0xf1ece2, chunk: 'landmark' });
  batch.add(new THREE.CylinderGeometry(R + 1.2, R + 1.2, 0.9, 64).translate(dc.x, dc.y + 7.2, dc.z), teal, { tint: 0xffffff, chunk: 'landmark' });
  // Drum arched windows as shader-free openings: dark arched insets around the drum.
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const m = new THREE.Matrix4().makeRotationY(-a + Math.PI / 2).setPosition(dc.x + Math.cos(a) * (R + 0.85), dc.y + 3.4, dc.z + Math.sin(a) * (R + 0.85));
    batch.add(new THREE.PlaneGeometry(1.6, 3.2), drumWindowMat(), { matrix: m, chunk: 'landmark', uv: 'keep', castShadow: false });
    batch.add(new THREE.TorusGeometry(0.88, 0.09, 5, 12, Math.PI).translate(0, 1.6, 0.03), teal, { matrix: m, tint: 0xffffff, chunk: 'landmark' });
  }
  const dome = new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.92, 1).translate(dc.x, dc.y + 7.6, dc.z);
  batch.add(dome, domeMat, { chunk: 'landmark', uv: 'keep' });
  // Ribs.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const phi = (k / 16) * (Math.PI / 2) * 0.93;
      pts.push(new THREE.Vector3(dc.x + Math.cos(a) * Math.cos(phi) * (R + 0.12), dc.y + 7.6 + Math.sin(phi) * R * 0.92 + 0.05, dc.z + Math.sin(a) * Math.cos(phi) * (R + 0.12)));
    }
    batch.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 5, false), silver, { chunk: 'landmark' });
  }
  // Lantern on top.
  const top = dc.y + 7.6 + R * 0.92;
  batch.add(new THREE.CylinderGeometry(2.6, 3, 3.2, 24).translate(dc.x, top + 1.4, dc.z), BM.stucco, { tint: 0xf1ece2, chunk: 'landmark' });
  batch.add(new THREE.SphereGeometry(2.8, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(dc.x, top + 3, dc.z), silver, { chunk: 'landmark' });
  batch.add(new THREE.CylinderGeometry(0.06, 0.08, 6, 6).translate(dc.x, top + 8.5, dc.z), silver, { chunk: 'landmark' });
  const crown = new BulbSet({ radius: 0.16, pattern: 'twinkle', intensity: 6, dayIntensity: 0 });
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    crown.add([dc.x + Math.cos(a) * (R + 1.25), dc.y + 7.75, dc.z + Math.sin(a) * (R + 1.25)], i, 0xe6f0ff);
  }
  crown.add([dc.x, top + 11.6, dc.z], 0, 0xff3030, 2.5); // aircraft warning light

  // ---- Tower (stepped slab) ----
  const tx0 = -104;
  const tx1 = -80;
  const tz0 = -100;
  const tz1 = -40;
  const tb = Y0 + H;
  const tt = tb + 104;
  const towerMat = towerFacadeMat({ wall: tinted(BM.stucco), cell: [2.5, 3.2], win: [1.4, 2.0], y0: tb + 1.5, y1: tt - 8, style: 'room', glass: 0x56677a, frame: 0x8e9aa0, bands: 0xdfe4e6, seed: 21, mullions: 1 });
  const steps = [[0, 0, tt - tb], [2, 6, tt - tb + 6], [5, 14, tt - tb + 11]];
  for (const [inset, insetZ, h] of steps) {
    batch.add(new THREE.BoxGeometry(tx1 - tx0 - inset * 2, h, tz1 - tz0 - insetZ * 2).translate((tx0 + tx1) / 2, tb + h / 2, (tz0 + tz1) / 2), towerMat, { tint: 0xf3f1ec, chunk: 'landmark', grime: 0.1, grimeBase: tb, grimeHeight: 4 });
  }
  for (const [inset, insetZ, h] of steps) {
    batch.add(new THREE.BoxGeometry(tx1 - tx0 - inset * 2 + 0.6, 0.6, tz1 - tz0 - insetZ * 2 + 0.6).translate((tx0 + tx1) / 2, tb + h - 0.3, (tz0 + tz1) / 2), teal, { tint: 0xffffff, chunk: 'landmark' });
    for (let z = tz0 + insetZ; z <= tz1 - insetZ; z += 1.2) {
      for (const x of [tx0 + inset - 0.35, tx1 - inset + 0.35]) crown.add([x, tb + h + 0.05, z], 0, 0xdde8ff);
    }
  }
  channelLetters(ctx, name, {
    font: '"Playfair Display"', weight: 700, height: 3.4, depth: 0.4, tracking: 0.08,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(tx1 + 0.02, tt - 6.5, (tz0 + tz1) / 2),
    face: blueFace, side: silver, chunk: 'landmark',
  });
  ctx.extraMeshes.push(bulbs.build('legacy-bulbs'), crown.build('legacy-crown'));
  // Dome floodlights for the night manager (no real light, but reflections & pools on the roof).
  lights.push({ pos: new THREE.Vector3(-36, Y0 + 30, -62), color: 0x9fc4ff, intensity: 8, distance: 10, kind: 'neon-high', realLight: false, reflect: false, ground: false });
  void SIGNS;
  void signPanel;
}

function circusCircus(ctx) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const rng = new Rng('circus');
  const X0 = -135;
  const X1 = -12;
  const Z0 = -215;
  const Z1 = -130;
  const H = 11;
  const pink = 0xe9a7b8;
  const red = mat('metal-painted', { color: 0xc4202b, wear: 0.35, dirt: 0.4, seed: 111 });
  const white = mat('metal-painted', { color: 0xf2efe8, wear: 0.35, dirt: 0.4, seed: 112 });
  const faces = {
    south: faceFrame(X0, Z1, X1, Z1, Y0),
    east: faceFrame(X1, Z1 - T, X1, Z0 + T, Y0),
  };
  const ops = [];
  for (let x = 4; x < faces.south.len - 4; x += 6) {
    if (x > 60 && x < 74) continue;
    ops.push({ kind: 'shop', x0: x - 2, x1: x + 2, y0: 0.9, y1: 4.2, style: 'casino', glassTint: 0x6a5a5a, mullions: 1 });
  }
  ops.push({ kind: 'door', x0: 62, x1: 72, y0: 0, y1: 3.4, style: 'casino', glassTint: 0x5a4a4a });
  facade(ctx, faces.south, {
    len: faces.south.len, h: H, t: T, wall: BM.stucco, tint: pink, openings: ops,
    bands: [{ y: 5.2, h: 1.2, d: 0.6, mat: red, tint: 0xffffff, cap: true }, { y: 10.2, h: 0.8, d: 0.5, mat: white, tint: 0xffffff, cap: true }],
  });
  const eops = [];
  for (let x = 4; x < faces.east.len - 4; x += 6) eops.push({ kind: 'shop', x0: x - 2, x1: x + 2, y0: 0.9, y1: 4.2, style: 'casino', glassTint: 0x6a5a5a, mullions: 1 });
  facade(ctx, faces.east, {
    len: faces.east.len, h: H, t: T, wall: BM.stucco, tint: pink, openings: eops,
    bands: [{ y: 5.2, h: 1.2, d: 0.6, mat: red, tint: 0xffffff, cap: true }, { y: 10.2, h: 0.8, d: 0.5, mat: white, tint: 0xffffff, cap: true }],
  });
  // Unseen faces: plain massing walls.
  batch.add(new THREE.BoxGeometry(X1 - X0, H, 0.4).translate((X0 + X1) / 2, Y0 + H / 2, Z0 + 0.2), BM.stucco, { tint: 0xd9b8c0 });
  batch.add(new THREE.BoxGeometry(0.4, H, Z1 - Z0).translate(X0 + 0.2, Y0 + H / 2, (Z0 + Z1) / 2), BM.stucco, { tint: 0xd9b8c0 });
  batch.add(new THREE.BoxGeometry(X1 - X0, 0.4, Z1 - Z0).translate((X0 + X1) / 2, Y0 + H - 0.4, (Z0 + Z1) / 2), BM.roof, { castShadow: false });
  colliders.aabb(X0, Y0 - 0.2, Z0, X1, Y0 + H, Z1);
  for (let i = 0; i < 6; i++) hvac(batch, rng.range(X0 + 5, X1 - 5), Y0 + H - 0.2, rng.range(Z0 + 5, Z1 - 5), rng.range(0, 3), rng);

  // Big-top entrance canopy: striped cone over the main doors.
  const ex = X0 + 67;
  const ez = Z1 + 4.5;
  const tent = new THREE.ConeGeometry(8, 5, 24, 1, true).translate(ex, Y0 + 9.5, ez);
  batch.add(tent, stripeMat(), { chunk: 'landmark', uv: 'keep' });
  batch.add(new THREE.CylinderGeometry(8, 8, 1.2, 24, 1, true).translate(ex, Y0 + 6.4, ez), stripeMat(), { chunk: 'landmark', uv: 'keep' });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = ex + Math.cos(a) * 7.5;
    const pz = ez + Math.sin(a) * 7.5;
    if (pz < Z1 + 0.5) continue;
    batch.add(new THREE.CylinderGeometry(0.22, 0.26, 6, 12).translate(px, Y0 + 3, pz), white, { tint: 0xffffff });
    colliders.cylinder(px, Y0, pz, 0.26, 6);
  }
  batch.add(new THREE.CylinderGeometry(0.05, 0.05, 3, 6).translate(ex, Y0 + 13, ez), white, {});
  // Pennant flag.
  batch.add(new THREE.PlaneGeometry(1.2, 0.7).translate(ex + 0.6, Y0 + 14.1, ez), red, { tint: 0xffffff, uv: 'keep' });
  const marquee = new BulbSet({ radius: 0.07, pattern: 'chase', speed: 8, intensity: 8, dayIntensity: 0.2 });
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    marquee.add([ex + Math.cos(a) * 8.05, Y0 + 5.85, ez + Math.sin(a) * 8.05], i, i % 2 ? 0xffe08a : 0xff6060);
  }

  // Tower with pink/white bands and the sign.
  const tx0 = -110;
  const tx1 = -70;
  const tz0 = -205;
  const tz1 = -185;
  const tb = Y0 + H;
  const tt = tb + 78;
  const towerMat = towerFacadeMat({ wall: tinted(BM.stucco), cell: [2.3, 3.0], win: [1.3, 1.7], y0: tb + 1, y1: tt - 3, style: 'room', glass: 0x5a6068, frame: 0xd9c2c8, bands: 0xf3e6ea, seed: 31 });
  batch.add(new THREE.BoxGeometry(tx1 - tx0, tt - tb, tz1 - tz0).translate((tx0 + tx1) / 2, (tb + tt) / 2, (tz0 + tz1) / 2), towerMat, { tint: pink, chunk: 'landmark' });
  for (let y = tb + 6; y < tt; y += 12) {
    batch.add(new THREE.BoxGeometry(tx1 - tx0 + 0.3, 0.9, tz1 - tz0 + 0.3).translate((tx0 + tx1) / 2, y, (tz0 + tz1) / 2), white, { tint: 0xffffff, chunk: 'landmark' });
  }
  const name = t('reno.circus.name');
  const face = litFaceMat(0xff3344, { k: 3.6, dayColor: 0xc4202b, metal: 0.1 });
  const bulbs = new BulbSet({ radius: 0.07, pattern: 'chase', speed: 7, intensity: 9, dayIntensity: 0.1 });
  // Sign on the east face of the tower, facing Virginia St.
  channelLetters(ctx, name, {
    font: '"Rye"', weight: 400, height: 4.2, depth: 0.5, tracking: 0.06,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(tx1 + 0.05, tt - 9, (tz0 + tz1) / 2),
    face, side: white, bulbs, spacing: 0.32, chunk: 'landmark', bulbColor: 0xffe7a0,
  });
  // And on the base fascia facing 5th St.
  channelLetters(ctx, name, {
    font: '"Rye"', weight: 400, height: 1.6, depth: 0.25, tracking: 0.06,
    matrix: new THREE.Matrix4().multiplyMatrices(faces.south.matrix, new THREE.Matrix4().makeTranslation(faces.south.len * 0.3, 6.1, 0.65)),
    face, side: white, bulbs, spacing: 0.22, bulbColor: 0xffe7a0,
  });
  ctx.extraMeshes.push(bulbs.build('circus-bulbs'), marquee.build('circus-marquee'));
  lights.push({ pos: new THREE.Vector3(ex, Y0 + 5, ez + 2), color: 0xffb080, intensity: 16, distance: 16, kind: 'neon', width: 6, groundY: 0.15 });
  lights.push({ pos: new THREE.Vector3(X0 + faces.south.len * 0.3, Y0 + 6.5, Z1 + 1.2), color: 0xff6a6a, intensity: 14, distance: 14, kind: 'neon', width: 8, groundY: 0.15, realLight: false });
}

let domeM = null;
// White dome: by day clean white composite panels; at night washed from below by blue-silver
// floodlights (emissive gradient strongest near the drum), with faint panel seams.
function domeMaterial() {
  if (domeM) return domeM;
  const m = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.45, metalness: 0.15, emissive: 0x8fb8ff });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = SIGNS.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDomeLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDomeLocal = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; varying vec3 vDomeLocal;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        // Panel seams: latitude rings + longitude gores.
        vec3 dp = vDomeLocal - vec3(-64.0, 0.0, -62.0);
        float lat = atan(dp.y - 25.75, length(dp.xz));
        float lon = atan(dp.z, dp.x);
        float seam = max(smoothstep(0.92, 1.0, abs(sin(lat * 18.0))), smoothstep(0.96, 1.0, abs(sin(lon * 48.0))));
        diffuseColor.rgb *= 1.0 - seam * 0.12;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float wash = 1.0 - smoothstep(25.8, 48.0, vDomeLocal.y);
        totalEmissiveRadiance *= uNight * (0.25 + wash * 1.6);`);
  };
  m.customProgramCacheKey = () => 'legacy-dome';
  m.name = 'legacy-dome';
  domeM = m;
  return m;
}

let drumWin = null;
function drumWindowMat() {
  if (!drumWin) {
    drumWin = new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 0.1, metalness: 0.3, emissive: 0xffd9a0 });
    drumWin.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = SIGNS.uNight;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uNight;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight * 0.9;');
    };
    drumWin.customProgramCacheKey = () => 'drum-window';
  }
  return drumWin;
}

let stripes = null;
function stripeMat() {
  if (!stripes) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 64;
    const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? '#f3eee6' : '#c8222c';
      g.fillRect(i * 32, 0, 32, 64);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    stripes = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide });
    stripes.name = 'big-top';
  }
  return stripes;
}

function slide(g, w, h, bg, fg, text) {
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const s = fitText(g, text, w - 40, 120, (z) => `700 ${z}px "Playfair Display"`);
  g.font = `700 ${s}px "Playfair Display"`;
  g.shadowColor = fg;
  g.shadowBlur = 16;
  g.fillText(text, w / 2, h / 2);
}
