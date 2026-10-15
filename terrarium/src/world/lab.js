// The secret basement lab under your house. Everything here is real furniture with collision.
import * as THREE from 'three';
import { Builder, textTexture } from './builder.js';
import { std, texMat, glow, glassMat, roundedBox, makeTextures } from './materials.js';
import { makeRng } from '../core/util.js';

export const LAB = { x0: -7, x1: 7, z0: -6, z1: 6, floor: 0, ceil: 3.2, houseFloor: 3.4 };
export const TABLE = { x: 0, z: -0.5, w: 3.2, d: 2.2, top: 0.8 };
export const STAIRS = { x0: -6.85, x1: -5.6, zBottom: 5.8, zTop: 1.0, steps: 17, rise: 0.2 };

export function buildLab(world) {
  makeTextures();
  const g = new THREE.Group();
  g.name = 'lab';
  const B = new Builder(g, world.colliders, 'lab');
  const inter = world.interactables;
  const r = makeRng(77);

  // ---- shell
  const floorMat = texMat('concrete', 7, 6, 0xb8bab8, 0.9);
  B.box(14.6, 0.3, 12.6, floorMat, 0, -0.15, 0, { cast: false, walk: true });
  const wallMat = texMat('block', 1, 1, 0xc9ccc5, 0.95);
  B.wall(-7.15, -6.3, -7.15, 6.3, 0, 3.4, 0.3, wallMat);
  B.wall(7.15, -6.3, 7.15, 6.3, 0, 3.4, 0.3, wallMat);
  B.wall(-7.3, -6.15, 7.3, -6.15, 0, 3.4, 0.3, wallMat);
  B.wall(-7.3, 6.15, 7.3, 6.15, 0, 3.4, 0.3, wallMat);
  // ceiling slab (= house floor) with the stair hole
  const ceilMat = std(0xd8d8d0, 0.95);
  const slab = (x0, z0, x1, z1) => B.box(x1 - x0, 0.2, z1 - z0, ceilMat, (x0 + x1) / 2, 3.3, (z0 + z1) / 2, { cast: false, walk: true });
  slab(-7.3, -6.3, 7.3, 1.0);
  slab(-5.45, 1.0, 7.3, 6.3);
  slab(-7.3, 3.95, -5.45, 6.3);
  // pipes + beams on the ceiling
  const pipe = std(0x7a6f5f, 0.5, 0.6);
  for (const z of [-4.5, -1.2, 2.2]) B.mesh(new THREE.CylinderGeometry(0.06, 0.06, 13.8, 10), pipe, 0, 3.08, z, { rot: [0, 0, Math.PI / 2], cast: false });
  B.mesh(new THREE.CylinderGeometry(0.09, 0.09, 11.8, 10), std(0x3d6e8a, 0.4, 0.5), 6.6, 3.0, 0, { rot: [Math.PI / 2, 0, 0], cast: false });
  for (const x of [-4, 0, 4]) B.box(0.25, 0.22, 12.2, std(0x9a9a92, 0.8), x, 3.09, 0, { col: false, cast: false });

  // ---- stairs up to the house (hidden behind a bookshelf up there)
  const stepMat = texMat('wood', 1, 0.3, 0x9a7a5a, 0.8);
  const run = (STAIRS.zBottom - STAIRS.zTop) / STAIRS.steps;
  for (let i = 0; i < STAIRS.steps; i++) {
    const top = (i + 1) * STAIRS.rise;
    const z1 = STAIRS.zBottom - i * run, z0 = z1 - run;
    B.box(STAIRS.x1 - STAIRS.x0, top, run, stepMat, (STAIRS.x0 + STAIRS.x1) / 2, top / 2, (z0 + z1) / 2, { walk: true, tag: 'stairs' });
  }
  const rail = std(0x2a2a2a, 0.4, 0.7);
  {
    const A = new THREE.Vector3(-5.55, 1.05, 5.7), Bt = new THREE.Vector3(-5.55, 4.4, 1.0);
    const d = Bt.clone().sub(A); const len = d.length();
    const m = B.mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 8), rail, (A.x + Bt.x) / 2, (A.y + Bt.y) / 2, (A.z + Bt.z) / 2, { cast: false });
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  for (let i = 0; i <= 6; i++) {
    const z = 5.6 - i * 0.75, top = (5.8 - z) / run * STAIRS.rise;
    B.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), rail, -5.55, top + 0.5, z, { cast: false });
  }
  inter.push({ id: 'stairsUp', label: 'Stairs up to the house', pos: new THREE.Vector3(-6.2, 1.2, 5.4), r: 0.8, zone: 'lab', passive: true });

  // ---- the big table that holds the cage
  const tableMat = std(0x3b4446, 0.45, 0.6);
  const tt = B.box(TABLE.w, 0.08, TABLE.d, std(0x2f3638, 0.35, 0.7), TABLE.x, TABLE.top - 0.04, TABLE.z, { walk: true, round: 0.02 });
  tt.castShadow = true;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(0.1, TABLE.top - 0.08, 0.1, tableMat, TABLE.x + sx * (TABLE.w / 2 - 0.1), (TABLE.top - 0.08) / 2, TABLE.z + sz * (TABLE.d / 2 - 0.1));
  B.box(TABLE.w - 0.2, 0.05, TABLE.d - 0.2, tableMat, TABLE.x, 0.25, TABLE.z, { col: false });
  // drawers + tool rack under the table
  for (let i = 0; i < 3; i++) B.box(0.6, 0.18, 0.5, std(0x5d6b6e, 0.5, 0.4), -1.0 + i * 1.0, 0.45, TABLE.z + 0.6, { col: false });

  // ---- control panel (cage weather, time, terrain)
  const pc = { x: 1.95, z: 0.95 };
  B.box(0.55, 1.0, 0.45, std(0x2c3335, 0.4, 0.6), pc.x, 0.5, pc.z, { round: 0.03 });
  const panelTop = B.mesh(roundedBox(0.62, 0.06, 0.5, 0.02), std(0x1e2526, 0.4, 0.5), pc.x, 1.03, pc.z, { rot: [-0.45, 0, 0] });
  const scr = B.mesh(new THREE.PlaneGeometry(0.42, 0.24), new THREE.MeshBasicMaterial({ map: textTexture('CAGE\nCONTROL', { w: 256, h: 160, size: 40, bg: '#06231b', color: '#63e6be' }) }), pc.x, 1.07, pc.z - 0.05, { rot: [-Math.PI / 2 + 1.12, 0, 0], cast: false });
  scr.renderOrder = 1;
  for (let i = 0; i < 6; i++) B.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10), glow([0xff4040, 0x40ff80, 0x4090ff, 0xffd040, 0xff70ff, 0x70ffff][i], 2), pc.x - 0.2 + i * 0.08, 1.05, pc.z + 0.17, { rot: [-0.45, 0, 0], cast: false });
  void panelTop;
  inter.push({ id: 'panel', label: 'Cage control panel', pos: new THREE.Vector3(pc.x, 1.05, pc.z), r: 0.4, zone: 'lab' });

  // ---- supply shelf: bins of things to drop into the cage
  const sx = -2.65, sz = -0.4;
  const shelfMat = texMat('wood', 1, 1, 0x8a6a4a, 0.8);
  B.box(0.9, 1.1, 1.6, std(0x2b2b2b, 0.6, 0.3), sx, 0.55, sz, { col: false });
  for (const y of [0.3, 0.7, 1.1]) B.box(0.92, 0.04, 1.62, shelfMat, sx, y, sz, { col: false });
  world.colliders.addCentered(sx, 0.56, sz, 0.92, 1.12, 1.62, { zone: 'lab', walk: true });
  const binCols = [0xd94f3d, 0x3d8fd9, 0xe0b23a, 0x48b06a, 0x9a5bd1, 0xe07a3a];
  for (let i = 0; i < 6; i++) {
    const y = i < 3 ? 0.42 : 0.82, z = sz - 0.5 + (i % 3) * 0.5;
    B.box(0.5, 0.2, 0.42, std(binCols[i], 0.5), sx + 0.12, y, z, { col: false, round: 0.02 });
  }
  inter.push({ id: 'supply', label: 'Supply shelf (things to drop in the cage)', pos: new THREE.Vector3(sx, 0.8, sz), r: 0.7, zone: 'lab' });

  // ---- workbench (gadget maker) + charging dock + pegboard
  const wb = { x: -2.2, z: -5.55 };
  B.box(2.6, 0.08, 0.9, texMat('wood', 2, 1, 0xb08a60, 0.7), wb.x, 0.94, wb.z, { walk: true });
  for (const dx of [-1.2, 1.2]) B.box(0.08, 0.9, 0.8, std(0x333a3c, 0.5, 0.6), wb.x + dx, 0.45, wb.z);
  B.box(2.4, 0.05, 0.7, std(0x333a3c, 0.5, 0.6), wb.x, 0.3, wb.z, { col: false });
  const peg = B.box(2.6, 1.2, 0.04, std(0xc9a26b, 0.9), wb.x, 1.8, -5.98, { col: false });
  for (let i = 0; i < 9; i++) {
    const tx = wb.x - 1.1 + i * 0.27;
    const kind = i % 3;
    if (kind === 0) B.box(0.04, 0.3, 0.03, std(0x777777, 0.3, 0.9), tx, 1.75, -5.93, { col: false });
    else if (kind === 1) B.mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 14), std(0xd04040, 0.5), tx, 1.9, -5.93, { cast: false });
    else B.box(0.12, 0.05, 0.03, std(0xe0a020, 0.4), tx, 1.65, -5.93, { col: false });
  }
  void peg;
  // vise + parts tray + lamp
  B.box(0.18, 0.12, 0.14, std(0x3a6ea5, 0.4, 0.6), wb.x - 0.9, 1.04, wb.z + 0.2, { col: false });
  for (let i = 0; i < 8; i++) B.mesh(new THREE.SphereGeometry(0.025, 8, 6), glow([0x63e6be, 0xff70ff, 0x4090ff, 0xffd040][i % 4], 1.2), wb.x + 0.2 + (i % 4) * 0.08, 1.0, wb.z + 0.15 + Math.floor(i / 4) * 0.08, { cast: false });
  const lampArm = std(0x222222, 0.4, 0.6);
  B.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), lampArm, wb.x + 0.9, 1.25, wb.z - 0.2, { rot: [0, 0, 0.3], cast: false });
  B.mesh(new THREE.ConeGeometry(0.1, 0.12, 14, 1, true), std(0x2a5c4f, 0.5, 0.4, { side: THREE.DoubleSide }), wb.x + 0.8, 1.55, wb.z - 0.1, { rot: [0.4, 0, 0], cast: false });
  // charging dock
  B.box(0.4, 0.06, 0.25, std(0x1b1f20, 0.5, 0.5), wb.x + 0.6, 1.01, wb.z - 0.22, { col: false });
  B.mesh(new THREE.BoxGeometry(0.36, 0.01, 0.2), glow(0x63e6be, 1.2), wb.x + 0.6, 1.045, wb.z - 0.22, { cast: false });
  inter.push({ id: 'workbench', label: 'Gadget workbench (make your own gadgets)', pos: new THREE.Vector3(wb.x, 1.1, wb.z), r: 0.9, zone: 'lab' });
  inter.push({ id: 'charger', label: 'Charging dock (charge gadgets)', pos: new THREE.Vector3(wb.x + 0.6, 1.05, wb.z - 0.22), r: 0.25, zone: 'lab' });

  // ---- computer desk (shop, sell gadgets, bank, cameras)
  const cd = { x: -5.4, z: -5.4 };
  B.box(2.0, 0.06, 0.9, std(0x2a2a2e, 0.5, 0.3), cd.x, 0.76, cd.z, { walk: true });
  for (const dx of [-0.9, 0.9]) B.box(0.06, 0.73, 0.85, std(0x2a2a2e, 0.5, 0.3), cd.x + dx, 0.365, cd.z);
  const screens = [];
  for (let i = 0; i < 3; i++) {
    const a = (i - 1) * 0.35;
    const mx = cd.x + Math.sin(a) * 0.1 + (i - 1) * 0.58, mz = cd.z - 0.15 + Math.abs(i - 1) * 0.12;
    B.box(0.55, 0.34, 0.03, std(0x111111, 0.3), mx, 1.2, mz, { col: false, rotY: -a });
    const s = B.mesh(new THREE.PlaneGeometry(0.51, 0.3), new THREE.MeshBasicMaterial({ color: 0x0d3b30 }), mx + Math.sin(-a) * 0.016, 1.2, mz + Math.cos(a) * 0.016, { rot: [0, -a, 0], cast: false });
    screens.push(s);
    B.box(0.05, 0.4, 0.05, std(0x111111, 0.3), mx, 0.98, mz - 0.05, { col: false });
  }
  B.box(0.5, 0.02, 0.16, std(0x1a1a1a, 0.4), cd.x, 0.8, cd.z + 0.2, { col: false });
  B.box(0.07, 0.02, 0.1, std(0x1a1a1a, 0.4), cd.x + 0.45, 0.8, cd.z + 0.2, { col: false });
  // office chair
  B.cyl(0.25, 0.25, 0.08, std(0x1c1c1c, 0.7), cd.x, 0.5, cd.z + 0.75);
  B.box(0.45, 0.5, 0.06, std(0x1c1c1c, 0.7), cd.x, 0.8, cd.z + 1.0, { col: false });
  inter.push({ id: 'computer', label: 'Lab computer (shop, sell, bank, cameras)', pos: new THREE.Vector3(cd.x, 1.2, cd.z), r: 0.8, zone: 'lab' });
  world.labScreens = screens;

  // ---- clone machine
  const cl = { x: 3.6, z: -5.2 };
  B.cyl(0.55, 0.65, 0.25, std(0x2c3436, 0.4, 0.7), cl.x, 0.125, cl.z);
  B.mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 24, 1, true), glassMat(), cl.x, 1.0, cl.z, { cast: false });
  B.cyl(0.55, 0.5, 0.3, std(0x2c3436, 0.4, 0.7), cl.x, 1.9, cl.z, { col: false });
  const ring = B.mesh(new THREE.TorusGeometry(0.44, 0.03, 8, 30), glow(0xb070ff, 2), cl.x, 0.3, cl.z, { rot: [Math.PI / 2, 0, 0], cast: false });
  world.colliders.addCentered(cl.x, 1.0, cl.z, 0.95, 2.0, 0.95, { zone: 'lab' });
  B.box(0.5, 0.9, 0.35, std(0x2c3436, 0.4, 0.7), cl.x + 0.95, 0.45, cl.z + 0.1);
  B.mesh(new THREE.PlaneGeometry(0.36, 0.22), new THREE.MeshBasicMaterial({ map: textTexture('CLONE', { w: 256, h: 140, size: 54, bg: '#1f0d2e', color: '#d4a8ff' }) }), cl.x + 0.95, 0.75, cl.z + 0.28, { cast: false });
  inter.push({ id: 'cloner', label: 'Clone machine', pos: new THREE.Vector3(cl.x + 0.5, 0.9, cl.z), r: 0.7, zone: 'lab' });
  world.cloneRing = ring;

  // ---- jar shelves (keep single people or bugs in jars)
  const js = { x: 6.6, z0: -3.8, z1: 1.6 };
  const jarShelfMat = texMat('wood', 3, 0.3, 0x6e5440, 0.8);
  for (const y of [0.05, 0.75, 1.45, 2.15]) B.box(0.55, 0.05, js.z1 - js.z0, jarShelfMat, js.x, y + 0.025, (js.z0 + js.z1) / 2, { col: false });
  for (const z of [js.z0, (js.z0 + js.z1) / 2, js.z1]) B.box(0.55, 2.25, 0.05, jarShelfMat, js.x, 1.12, z, { col: false });
  world.colliders.addCentered(js.x, 1.12, (js.z0 + js.z1) / 2, 0.55, 2.25, js.z1 - js.z0, { zone: 'lab', walk: true });
  world.jars = [];
  const jarGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.26, 18, 1, true);
  const lidGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.03, 18);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++) {
    const y = 0.08 + row * 0.7, z = js.z0 + 0.4 + i * 0.75;
    const jar = B.mesh(jarGeo, glassMat(), js.x, y + 0.13, z, { cast: false });
    const lid = B.mesh(lidGeo, std([0xb33a3a, 0x3a6eb3, 0xd0a030][row], 0.4, 0.5), js.x, y + 0.275, z);
    // label
    const lab = B.mesh(new THREE.PlaneGeometry(0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xf0ead0 }), js.x - 0.112, y + 0.09, z, { rot: [0, -Math.PI / 2, 0], cast: false });
    const j = { id: 'jar' + world.jars.length, pos: new THREE.Vector3(js.x, y + 0.03, z), mesh: jar, lid, labelMesh: lab, occupant: null, radius: 0.1, top: y + 0.26 };
    world.jars.push(j);
    inter.push({ id: j.id, label: 'Jar', pos: new THREE.Vector3(js.x, y + 0.13, z), r: 0.14, zone: 'lab', jar: j });
  }
  // display case
  B.box(0.6, 0.9, 1.2, std(0x2b2b2b, 0.5, 0.4), 6.6, 0.45, 3.3);
  B.mesh(new THREE.BoxGeometry(0.58, 0.5, 1.18), glassMat(), 6.6, 1.15, 3.3, { cast: false });

  // ---- experiment table (strap someone down: scan, cut open, swap parts, inject)
  const ex = { x: 4.9, z: 1.2 };
  B.box(1.6, 0.06, 0.8, std(0xcfd6d8, 0.3, 0.7), ex.x, 0.92, ex.z, { walk: true });
  for (const [dx, dz] of [[-0.7, -0.32], [0.7, -0.32], [-0.7, 0.32], [0.7, 0.32]]) B.box(0.05, 0.9, 0.05, std(0x8a9294, 0.3, 0.8), ex.x + dx, 0.45, ex.z + dz, { col: false });
  world.colliders.addCentered(ex.x, 0.47, ex.z, 1.6, 0.9, 0.8, { zone: 'lab', walk: false });
  // tiny operating table on top
  B.box(0.16, 0.012, 0.07, std(0xe8eef0, 0.3, 0.6), ex.x, 0.958, ex.z, { col: false });
  for (const dx of [-0.05, 0, 0.05]) B.box(0.008, 0.004, 0.075, std(0x5a3a2a, 0.6), ex.x + dx, 0.966, ex.z, { col: false });
  const lampPole = B.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 8), std(0x8a9294, 0.3, 0.8), ex.x - 0.6, 1.35, ex.z - 0.3, { cast: false });
  void lampPole;
  B.mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.08, 16, 1, true), std(0xdddddd, 0.3, 0.6, { side: THREE.DoubleSide }), ex.x - 0.25, 1.4, ex.z - 0.1, { cast: false });
  B.mesh(new THREE.CircleGeometry(0.11, 16), glow(0xfffbe8, 2.5), ex.x - 0.25, 1.36, ex.z - 0.1, { rot: [Math.PI / 2, 0, 0], cast: false });
  // scanner arm
  B.box(0.04, 0.04, 0.5, std(0x2c3436, 0.4, 0.7), ex.x + 0.45, 1.25, ex.z, { col: false });
  B.mesh(new THREE.BoxGeometry(0.12, 0.02, 0.06), glow(0x40c0ff, 2), ex.x + 0.45, 1.22, ex.z + 0.2, { cast: false });
  inter.push({ id: 'exptable', label: 'Experiment table', pos: new THREE.Vector3(ex.x, 1.0, ex.z), r: 0.6, zone: 'lab' });
  world.expTable = { pos: new THREE.Vector3(ex.x, 0.965, ex.z), light: null };
  const exLight = B.light('spot', 0xfff6e0, 6, ex.x - 0.25, 1.36, ex.z - 0.1, { dist: 1.2, angle: 0.7, target: [ex.x, 0.95, ex.z] });
  world.expTable.light = exLight;

  // ---- chem set (make your own potions)
  const ch = { x: 0.6, z: 5.45 };
  B.box(2.2, 0.06, 0.8, std(0x2a3a33, 0.6), ch.x, 0.9, ch.z, { walk: true });
  for (const dx of [-1.0, 1.0]) B.box(0.06, 0.87, 0.75, std(0x2a2a2a, 0.5, 0.4), ch.x + dx, 0.435, ch.z);
  const liq = [0x40ff90, 0xff4fa0, 0x50a0ff, 0xffd040, 0xb070ff, 0xff6030, 0x70ffff, 0xa0ff40];
  for (let i = 0; i < 8; i++) {
    const bx = ch.x - 0.85 + i * 0.24, bz = ch.z - 0.12 + (i % 2) * 0.18;
    const h = 0.1 + r() * 0.12;
    B.mesh(new THREE.CylinderGeometry(0.045, 0.05, h, 12, 1, true), glassMat(), bx, 0.93 + h / 2, bz, { cast: false });
    B.mesh(new THREE.CylinderGeometry(0.043, 0.048, h * 0.6, 12), new THREE.MeshStandardMaterial({ color: liq[i], emissive: liq[i], emissiveIntensity: 0.6, transparent: true, opacity: 0.8, roughness: 0.2 }), bx, 0.93 + h * 0.3, bz, { cast: false });
  }
  // flask over burner
  B.mesh(new THREE.SphereGeometry(0.08, 14, 10), glassMat(), ch.x + 0.7, 1.12, ch.z + 0.1, { cast: false });
  B.mesh(new THREE.SphereGeometry(0.07, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x40ff90, emissive: 0x40ff90, emissiveIntensity: 0.8, transparent: true, opacity: 0.85 }), ch.x + 0.7, 1.12, ch.z + 0.1, { cast: false });
  B.mesh(new THREE.ConeGeometry(0.02, 0.05, 8), glow(0x3080ff, 3), ch.x + 0.7, 0.97, ch.z + 0.1, { cast: false });
  inter.push({ id: 'chem', label: 'Chem set (make your own potions)', pos: new THREE.Vector3(ch.x, 1.05, ch.z), r: 0.8, zone: 'lab' });

  // ---- spawn machine + shrink chamber
  const sm = { x: 4.6, z: 4.6 };
  B.cyl(0.75, 0.85, 0.3, std(0x2c3436, 0.4, 0.7), sm.x, 0.15, sm.z);
  const capsule = B.mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 28, 1, true), glassMat(), sm.x, 1.4, sm.z, { cast: false });
  void capsule;
  B.cyl(0.75, 0.7, 0.35, std(0x2c3436, 0.4, 0.7), sm.x, 2.65, sm.z, { col: false });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; B.mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 8), std(0x9aa3a6, 0.3, 0.9), sm.x + Math.cos(a) * 0.62, 1.4, sm.z + Math.sin(a) * 0.62); }
  const smRing = B.mesh(new THREE.TorusGeometry(0.62, 0.03, 8, 32), glow(0x63e6be, 2), sm.x, 0.32, sm.z, { rot: [Math.PI / 2, 0, 0], cast: false });
  // walls of the capsule (you can't walk through the glass; the door is the front)
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.abs(Math.sin(a) + 1) < 0.5) continue; // gap toward -z (front)
    world.colliders.addCentered(sm.x + Math.cos(a) * 0.62, 1.4, sm.z + Math.sin(a) * 0.62, 0.15, 2.2, 0.15, { zone: 'lab', walk: false });
  }
  B.box(0.7, 1.1, 0.4, std(0x2c3436, 0.4, 0.7), sm.x - 1.25, 0.55, sm.z + 0.2);
  B.mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: textTexture('SPAWN', { w: 256, h: 150, size: 60, bg: '#06231b', color: '#63e6be' }) }), sm.x - 1.25, 0.9, sm.z - 0.005, { rot: [0, Math.PI, 0], cast: false });
  inter.push({ id: 'spawner', label: 'Spawn machine', pos: new THREE.Vector3(sm.x - 1.25, 0.9, sm.z), r: 0.5, zone: 'lab' });
  // shrink chamber: smaller tube with a tray
  const sh = { x: 2.6, z: 5.0 };
  B.cyl(0.5, 0.55, 0.2, std(0x2c3436, 0.4, 0.7), sh.x, 0.1, sh.z);
  B.mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.0, 24, 1, true), glassMat(), sh.x, 1.2, sh.z, { cast: false });
  B.cyl(0.5, 0.45, 0.25, std(0x2c3436, 0.4, 0.7), sh.x, 2.3, sh.z, { col: false });
  const shRing = B.mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 30), glow(0xff8a3d, 2), sh.x, 0.22, sh.z, { rot: [Math.PI / 2, 0, 0], cast: false });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.abs(Math.sin(a) + 1) < 0.5) continue;
    world.colliders.addCentered(sh.x + Math.cos(a) * 0.42, 1.2, sh.z + Math.sin(a) * 0.42, 0.12, 2.0, 0.12, { zone: 'lab', walk: false });
  }
  // output tray in front
  B.box(0.3, 0.04, 0.2, std(0xb8c0c2, 0.3, 0.8), sh.x - 0.7, 0.92, sh.z - 0.2, { walk: true });
  B.box(0.06, 0.9, 0.06, std(0x2c3436, 0.4, 0.7), sh.x - 0.7, 0.45, sh.z - 0.2);
  inter.push({ id: 'shrinker', label: 'Shrink chamber', pos: new THREE.Vector3(sh.x, 1.0, sh.z - 0.45), r: 0.55, zone: 'lab' });
  world.spawnSpot = new THREE.Vector3(sm.x, 0.3, sm.z);
  world.shrinkSpot = new THREE.Vector3(sh.x, 0.2, sh.z);
  world.shrinkTray = new THREE.Vector3(sh.x - 0.7, 0.94, sh.z - 0.2);
  world.machineRings = { spawn: smRing, shrink: shRing };

  // ---- lights
  const fixtures = [[-3.5, -3], [3.5, -3], [-3.5, 3], [3.5, 3]];
  for (const [x, z] of fixtures) {
    B.box(1.4, 0.06, 0.25, std(0x888888, 0.5, 0.5), x, 3.14, z, { col: false, cast: false });
    B.mesh(new THREE.BoxGeometry(1.3, 0.02, 0.18), glow(0xf2fff8, 1.6), x, 3.105, z, { cast: false });
  }
  B.light('point', 0xeaf4ff, 9, -3.5, 2.9, 0, { dist: 14, decay: 1.4 });
  B.light('point', 0xeaf4ff, 9, 3.5, 2.9, 0, { dist: 14, decay: 1.4 });
  B.light('point', 0x63e6be, 2.5, 4.6, 1.5, 4.0, { dist: 4 });
  B.light('point', 0xb070ff, 2, 3.6, 1.2, -4.6, { dist: 3.5 });

  // floor details: drain, cables, rug by the cage
  B.mesh(new THREE.CircleGeometry(0.12, 16), std(0x333333, 0.6, 0.6), 1.5, 0.002, 2.4, { rot: [-Math.PI / 2, 0, 0], cast: false });
  B.mesh(new THREE.PlaneGeometry(3.0, 1.4), std(0x2d3b3a, 0.95), 0, 0.004, 1.5, { rot: [-Math.PI / 2, 0, 0], cast: false });
  for (let i = 0; i < 3; i++) {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.6 + i * 0.1, 0.02, -1.6), new THREE.Vector3(-3 + i * 0.2, 0.02, -3.5), new THREE.Vector3(-2.2, 0.02, -5.4)]);
    B.mesh(new THREE.TubeGeometry(curve, 20, 0.018, 6), std([0x222222, 0x8a2020, 0x204a8a][i], 0.6), 0, 0, 0, { cast: false });
  }
  world.labGroup = g;
  return g;
}
