// Eldorado Resort Casino — exterior shell only (the casino builder fills the interior).
//
// Footprint x ∈ [-80, -12], z ∈ [12, 100] with a 5 m chamfer at the 4th & Virginia corner.
// The interior volume x ∈ [-75, -15], z ∈ [15, 95], y ∈ [0, 7] is left EMPTY: walls stand on the
// footprint edge, the first-floor slab starts at y = 7, and colliders are per wall (with the door
// openings blocked by closed doors unless `openDoors`), never one solid block.
//
// Exterior: cream stucco base with stone veneer plinth and gold pilasters, a Virginia St
// entrance (three pairs of glass doors) under a porte-cochère canopy with a downlight soffit and
// chasing bulb fascia, a corner LED screen on the chamfer, giant gold ELDORADO channel letters with
// traced bulbs, upper floors with arched windows, and the ~25-storey hotel tower with a lit crown.
//
//   buildEldorado(ctx, { clearGlass, openDoors }) → { entrance, zones }

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { facade, faceFrame, buildingMats, hvac, signPanel } from '../shared/buildings.js';
import { towerFacadeMat } from '../shared/facade.js';
import { tinted } from '../shared/batch.js';
import { channelLetters, litFaceMat } from '../shared/letters.js';
import { BulbSet, ledScreenMat, paintedSignMat, fitText } from '../shared/signs.js';
import { propMats } from '../shared/props.js';
import { mat as kmat } from '../shared/kinds.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';

const X0 = -80;
const X1 = -12;
const Z0 = 12;
const Z1 = 100;
const CH = 5; // chamfer
const H = 14; // base height
const T = 0.4; // wall thickness
const Y0 = 0.15; // sidewalk level
const CREAM = 0xe8d6b8;
const GOLD = 0xc9a050;

export function buildEldorado(ctx, { clearGlass = false, openDoors = false } = {}) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const P = propMats();
  const rng = new Rng('eldorado');
  const M = {
    wall: BM.stucco,
    veneer: BM.veneer,
    gold: mat('metal-painted', { color: GOLD, wear: 0.25, dirt: 0.3, seed: 91 }),
    goldMetal: mat('gold', { wear: 0.3, dirt: 0.35, seed: 92 }),
    marble: kmat('terrazzo', { color: 0xd8cdb8, seed: 93 }),
    dark: mat('metal-painted', { color: 0x2a1d18, wear: 0.2, dirt: 0.3, seed: 94 }),
  };
  const doorStyle = clearGlass ? 'clear' : 'casino';
  // With openDoors the casino builder (src/casino) hangs real, hinged doors in these openings, so
  // the facade leaves them empty ('void') and only the lintels get colliders.
  const doorKind = openDoors ? 'void' : 'door';

  // ---- Faces (manual frames for the chamfered footprint) ----
  const faces = {
    virginia: faceFrame(X1, Z1 - T, X1, Z0 + CH, Y0),
    chamfer: faceFrame(X1, Z0 + CH, X1 - CH, Z0, Y0),
    fourth: faceFrame(X1 - CH, Z0, X0, Z0, Y0),
    west: faceFrame(X0, Z0 + T, X0, Z1 - T, Y0),
    south: faceFrame(X0, Z1, X1, Z1, Y0),
  };
  const groundCell = (fs) => (x, y) => (y < 1.0 ? { mat: M.veneer, tint: undefined } : fs?.(x, y) ?? null);

  // Virginia St face: local x runs from the south end (z ≈ 99.6) north to the chamfer (z 17).
  const V = faces.virginia;
  const vx = (z) => Z1 - T - z; // world z → local x
  const entr = { z0: 45.2, z1: 54.8 };
  const vOpen = [];
  // Main entrance: three door pairs with stone piers between them; glass transom above.
  const doorW = 2.6;
  const doorZ = [46.7, 50, 53.3];
  for (const dz of doorZ) vOpen.push({ kind: doorKind, door: true, x0: vx(dz + doorW / 2), x1: vx(dz - doorW / 2), y0: 0, y1: 3.2, style: doorStyle, glassTint: 0x6a5a48 });
  vOpen.push({ kind: 'shop', x0: vx(entr.z1), x1: vx(entr.z0), y0: 3.55, y1: 5.6, style: doorStyle, mullions: 5, glassTint: 0x6a5a48 });
  // Ground floor display windows (lit show posters) between pilasters.
  const bays = [];
  for (let z = 22; z < 96; z += 7.2) {
    if (z > entr.z0 - 6 && z < entr.z1 + 5) continue;
    bays.push(z);
  }
  // Upper floors: arched windows in two rows, leaving the centre for the giant letters.
  const upper = [];
  for (let z = 21; z < 97; z += 3.6) {
    for (const [y0, y1] of [[7.9, 9.9], [10.9, 12.6]]) {
      if (y0 > 10 && z > 28 && z < 74) continue; // letters panel
      upper.push({ kind: 'window', x0: vx(z + 0.8), x1: vx(z - 0.8), y0, y1, style: rng.chance(0.3) ? 'room' : 'office', frame: 0x5a4632, mullions: 1 });
    }
  }
  facade(ctx, V, {
    len: V.len,
    h: H,
    t: T,
    wall: M.wall,
    tint: CREAM,
    grime: 0.45,
    openings: [...vOpen, ...upper],
    cellMat: groundCell(),
    splitY: [1.0],
    bands: [
      { y: 6.85, h: 0.55, d: 0.45, mat: M.gold, tint: 0xffffff, cap: true },
      { y: 13.2, h: 0.8, d: 0.6, mat: M.gold, tint: 0xffffff, cap: true },
      { y: 1.0, h: 0.12, d: 0.08, mat: M.goldMetal, tint: 0xffffff },
    ],
  });
  // Pilasters (gold) with stone bases along the ground floor.
  for (let z = 18.6; z < 99; z += 7.2) {
    if (z > entr.z0 - 1 && z < entr.z1 + 1) continue;
    const lx = vx(z);
    batch.add(new THREE.BoxGeometry(0.6, 6.8, 0.3).translate(lx, 3.4, 0.15), M.gold, { matrix: V.matrix, tint: 0xffffff, grime: 0.3, grimeBase: Y0 });
    batch.add(new THREE.BoxGeometry(0.75, 1.0, 0.4).translate(lx, 0.5, 0.2), M.veneer, { matrix: V.matrix });
    batch.add(new THREE.BoxGeometry(0.8, 0.25, 0.42).translate(lx, 6.6, 0.21), M.goldMetal, { matrix: V.matrix });
    colliders.local(V.matrix, lx, 3.4, 0.2, 0.75, 6.8, 0.4);
  }
  // Lit show posters in bays.
  const posters = [posterMat('buffet'), posterMat('show'), posterMat('slots'), posterMat('steak')];
  bays.forEach((z, i) => {
    const lx = vx(z);
    signPanel(ctx, V, { x0: lx - 1.3, x1: lx + 1.3, y0: 1.6, y1: 5.0, d: 0.16, mat: posters[i % posters.length], cabinet: 0x3a2a1a });
    lights.push({ pos: new THREE.Vector3(X1 + 0.6, Y0 + 3.2, z), color: 0xffe2b0, intensity: 3, distance: 6, kind: 'ad', groundY: Y0, realLight: false, reflectK: 0.6, width: 2 });
  });
  // Arch moldings over the upper windows.
  for (const o of upper) {
    const cx = (o.x0 + o.x1) / 2;
    const w = o.x1 - o.x0;
    const arc = new THREE.TorusGeometry(w / 2 + 0.06, 0.07, 6, 16, Math.PI);
    arc.translate(cx, o.y1, 0.05);
    batch.add(arc, M.gold, { matrix: V.matrix, tint: 0xffffff });
    // Fill the arch (tympanum) with a darker inset.
    const fill = new THREE.CircleGeometry(w / 2, 16, 0, Math.PI);
    fill.translate(cx, o.y1, -0.12);
    batch.add(fill, M.dark, { matrix: V.matrix, castShadow: false });
  }
  // Giant ELDORADO letters on a dark red panel.
  const panelZ0 = 29;
  const panelZ1 = 73;
  batch.add(new THREE.BoxGeometry(vx(panelZ0) - vx(panelZ1), 2.6, 0.18).translate((vx(panelZ0) + vx(panelZ1)) / 2, 11.7, 0.09), M.dark, { matrix: V.matrix });
  const bulbs = new BulbSet({ radius: 0.055, pattern: 'twinkle', intensity: 8, dayIntensity: 0.15 });
  const letterFace = litFaceMat(0xffc860, { k: 2.6, dayColor: 0xd8a640, metal: 0.65, rough: 0.28 });
  const eldo = t('reno.eldo.name');
  channelLetters(ctx, eldo, {
    font: '"Playfair Display"', weight: 700, height: 2.1, depth: 0.25, tracking: 0.14,
    matrix: new THREE.Matrix4().multiplyMatrices(V.matrix, new THREE.Matrix4().makeTranslation((vx(panelZ0) + vx(panelZ1)) / 2, 10.65, 0.2)),
    face: letterFace, side: M.goldMetal, bulbs, spacing: 0.2, bulbColor: 0xfff2d2,
  });
  for (let i = 0; i < 5; i++) {
    const z = panelZ0 + 4 + i * 9;
    lights.push({ pos: new THREE.Vector3(X1 + 1.0, Y0 + 11.6, z), color: 0xffcf7a, intensity: 18, distance: 22, kind: 'neon', width: 3, groundY: 0.15, realLight: false, poolK: 0.5 });
  }

  // ---- Porte-cochère canopy over the sidewalk ----
  const cz0 = 40.5;
  const cz1 = 59.5;
  const cx0 = X1;
  const cx1 = -7.55;
  const cyB = Y0 + 4.7; // soffit
  const cyT = Y0 + 5.7;
  const cw = cx1 - cx0;
  const cd = cz1 - cz0;
  batch.add(new THREE.BoxGeometry(cw, cyT - cyB, cd).translate((cx0 + cx1) / 2, (cyB + cyT) / 2, (cz0 + cz1) / 2), M.gold, { tint: 0xffffff });
  batch.add(new THREE.BoxGeometry(cw + 0.1, 0.12, cd + 0.1).translate((cx0 + cx1) / 2, cyT + 0.06, (cz0 + cz1) / 2), M.goldMetal, {});
  // Soffit with recessed downlights (steady bulbs) — glamorous at night.
  const soffit = new THREE.PlaneGeometry(cw - 0.2, cd - 0.2).rotateX(Math.PI / 2).translate((cx0 + cx1) / 2, cyB - 0.005, (cz0 + cz1) / 2);
  batch.add(soffit, M.dark, { castShadow: false });
  const down = new BulbSet({ radius: 0.09, pattern: 'steady', intensity: 7, dayIntensity: 0.6 });
  for (let x = cx0 + 0.7; x < cx1 - 0.3; x += 0.9) {
    for (let z = cz0 + 0.6; z < cz1 - 0.3; z += 0.9) down.add([x, cyB - 0.02, z], 0, 0xffe6b8, 1);
  }
  // Fascia: ELDORADO on the street side + chasing bulbs around the edges.
  channelLetters(ctx, eldo, {
    font: '"Playfair Display"', weight: 700, height: 0.62, depth: 0.08, tracking: 0.16,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(cx1 + 0.02, cyB + 0.2, (cz0 + cz1) / 2),
    face: litFaceMat(0xffd27a, { k: 3, dayColor: 0x3a2412, metal: 0.2 }), side: M.goldMetal,
  });
  const fascia = new BulbSet({ radius: 0.05, pattern: 'chase', speed: 9, intensity: 8, dayIntensity: 0.2 });
  let s = 0;
  for (let z = cz0; z <= cz1; z += 0.28) {
    fascia.add([cx1 + 0.04, cyT - 0.08, z], s, 0xfff0c8);
    fascia.add([cx1 + 0.04, cyB + 0.08, z], s++, 0xfff0c8);
  }
  for (const zz of [cz0 - 0.04, cz1 + 0.04]) {
    for (let x = cx0 + 0.2; x <= cx1; x += 0.28) {
      fascia.add([x, cyT - 0.08, zz], s, 0xfff0c8);
      fascia.add([x, cyB + 0.08, zz], s++, 0xfff0c8);
    }
  }
  // Columns at the curb side.
  for (const z of [cz0 + 0.6, cz1 - 0.6]) {
    const col = new THREE.CylinderGeometry(0.26, 0.3, cyB - Y0, 20).translate(cx1 - 0.45, Y0 + (cyB - Y0) / 2, z);
    batch.add(col, M.marble, {});
    batch.add(new THREE.CylinderGeometry(0.36, 0.4, 0.35, 20).translate(cx1 - 0.45, Y0 + 0.175, z), M.goldMetal, {});
    batch.add(new THREE.CylinderGeometry(0.4, 0.3, 0.3, 20).translate(cx1 - 0.45, cyB - 0.15, z), M.goldMetal, {});
    colliders.cylinder(cx1 - 0.45, Y0, z, 0.4, cyB - Y0);
  }
  // Red carpet runner from the curb to the doors.
  const carpet = new THREE.PlaneGeometry(cx1 - cx0 - 0.4, 6.4).rotateX(-Math.PI / 2).translate((cx0 + cx1) / 2 + 0.1, Y0 + 0.008, 50);
  batch.add(carpet, mat('carpet-casino', { seed: 95 }), { castShadow: false });
  // Canopy lights for the night manager: four real-light candidates under the soffit.
  for (const z of [44, 50, 56]) {
    lights.push({ pos: new THREE.Vector3((cx0 + cx1) / 2, cyB - 0.3, z), color: 0xffd9a0, intensity: 16, distance: 13, kind: 'lamp', groundY: Y0, width: 2.4, reflectK: 1.3 });
  }

  // ---- Chamfer: corner entrance + LED marquee ----
  const C = faces.chamfer;
  facade(ctx, C, {
    len: C.len,
    h: H,
    t: T,
    wall: M.wall,
    tint: CREAM,
    openings: [{ kind: doorKind, x0: 1.4, x1: C.len - 1.4, y0: 0, y1: 3.2, style: doorStyle, glassTint: 0x6a5a48 }],
    cellMat: groundCell(),
    splitY: [1.0],
    bands: [{ y: 6.85, h: 0.55, d: 0.45, mat: M.gold, tint: 0xffffff, cap: true }, { y: 13.2, h: 0.8, d: 0.6, mat: M.gold, tint: 0xffffff, cap: true }],
  });
  const led = ledScreenMat('eldorado', [
    ledSlide('#b0141c', '#ffd56a', t('reno.eldo.led1'), '"Playfair Display"', 700),
    ledSlide('#0b0b2a', '#7cf4ff', t('reno.eldo.led2'), '"Bebas Neue"', 400, true),
    ledSlide('#2a0b0b', '#ffb347', t('reno.eldo.led3'), '"Bebas Neue"', 400),
    ledSlide('#120020', '#ff6ad5', t('reno.eldo.led4'), '"Bebas Neue"', 400),
    ledSlide('#063a14', '#ffe26a', t('reno.eldo.led5'), '"Bebas Neue"', 400, true),
  ], { w: 512, h: 288, dots: [160, 90], hold: 4.5, intensity: 3.4, dayIntensity: 2.2 });
  const sw = C.len - 0.6;
  const sh = sw * 0.5625;
  batch.add(new THREE.BoxGeometry(sw + 0.5, sh + 0.5, 0.45).translate(C.len / 2, 7.6 + sh / 2, 0.22), M.dark, { matrix: C.matrix });
  batch.add(new THREE.PlaneGeometry(sw, sh).translate(C.len / 2, 7.6 + sh / 2, 0.455), led, { matrix: C.matrix, uv: 'keep', castShadow: false });
  const ledC = new THREE.Vector3(C.len / 2, 7.6 + sh / 2, 1.2).applyMatrix4(C.matrix);
  lights.push({ pos: ledC, color: 0xffb0a0, intensity: 20, distance: 20, kind: 'neon', width: sw, groundY: 0.15, reflectK: 1.2 });

  // ---- 4th St face ----
  const F = faces.fourth;
  const fx = (x) => X1 - CH - x; // world x → local x
  const fOpen = [];
  for (let x = -22; x > -78; x -= 7.2) {
    if (x < -40 && x > -50) continue; // side entrance under the skyway
    fOpen.push({ kind: 'shop', x0: fx(x + 1.6), x1: fx(x - 1.6), y0: 1.0, y1: 4.6, style: doorStyle, glassTint: 0x5e5246, mullions: 1 });
  }
  fOpen.push({ kind: doorKind, door: true, x0: fx(-42.5), x1: fx(-47.5), y0: 0, y1: 3.2, style: doorStyle, glassTint: 0x6a5a48 });
  for (let x = -20; x > -79; x -= 3.6) {
    for (const [y0, y1] of [[7.9, 9.9], [10.9, 12.6]]) {
      if (y0 > 10 && x < -30 && x > -64) continue;
      fOpen.push({ kind: 'window', x0: fx(x + 0.8), x1: fx(x - 0.8), y0, y1, style: rng.chance(0.4) ? 'room' : 'office', frame: 0x5a4632 });
    }
  }
  facade(ctx, F, {
    len: F.len,
    h: H,
    t: T,
    wall: M.wall,
    tint: CREAM,
    openings: fOpen,
    cellMat: groundCell(),
    splitY: [1.0],
    bands: [{ y: 6.85, h: 0.55, d: 0.45, mat: M.gold, tint: 0xffffff, cap: true }, { y: 13.2, h: 0.8, d: 0.6, mat: M.gold, tint: 0xffffff, cap: true }],
  });
  batch.add(new THREE.BoxGeometry(fx(-30) - fx(-64), 2.4, 0.18).translate((fx(-30) + fx(-64)) / 2, 11.7, 0.09), M.dark, { matrix: F.matrix });
  channelLetters(ctx, eldo, {
    font: '"Playfair Display"', weight: 700, height: 1.9, depth: 0.22, tracking: 0.14,
    matrix: new THREE.Matrix4().multiplyMatrices(F.matrix, new THREE.Matrix4().makeTranslation((fx(-30) + fx(-64)) / 2, 10.75, 0.18)),
    face: letterFace, side: M.goldMetal, bulbs, spacing: 0.2, bulbColor: 0xfff2d2,
  });
  // Small canopy over the 4th St side entrance.
  batch.add(new THREE.BoxGeometry(7, 0.5, 2.2).translate(-45, Y0 + 3.9, Z0 - 1.1), M.gold, { tint: 0xffffff });
  for (let x = -48.3; x <= -41.7; x += 0.6) down.add([x, Y0 + 3.62, Z0 - 1.1], 0, 0xffe6b8, 0.8);
  lights.push({ pos: new THREE.Vector3(-45, Y0 + 3.4, Z0 - 1.2), color: 0xffd9a0, intensity: 9, distance: 9, kind: 'lamp', groundY: Y0 });

  // ---- West & south faces (back of house) ----
  const backWin = { cell: [3.6, 3.0], win: [1.4, 1.6], y0: Y0 + 7.8, y1: Y0 + 13, style: 'office', glass: 0x5d6a72, frame: 0x4a3a2a, seed: 5, litMul: 0.6 };
  facade(ctx, faces.west, { len: faces.west.len, h: H, t: T, wall: M.wall, tint: 0xd9c6a6, grime: 0.7, sideWindows: backWin, bands: [{ y: 13.2, h: 0.8, d: 0.4, mat: M.gold, tint: 0xd8d0c0 }] });
  // South face on Commercial Row: loading docks with roll-up doors (into the back of house, not
  // the casino volume — docks sit at the far west end, outside x ∈ [-75, -15]).
  const S = faces.south;
  facade(ctx, S, {
    len: S.len,
    h: H,
    t: T,
    wall: M.wall,
    tint: 0xd9c6a6,
    grime: 0.75,
    openings: [
      { kind: 'door', x0: 0.8, x1: 4.2, y0: 0, y1: 3.6, glassDoor: false, doorTint: 0x8a8d88 },
      { kind: 'door', x0: 66.0, x1: 67.4, y0: 0, y1: 2.3, glassDoor: false, doorTint: 0x6d4a3a },
      ...Array.from({ length: 17 }, (_, i) => ({ kind: 'window', x0: 4 + i * 3.6, x1: 5.4 + i * 3.6, y0: 8.2, y1: 9.8, style: 'office', frame: 0x4a3a2a })),
    ],
    bands: [{ y: 13.2, h: 0.8, d: 0.4, mat: M.gold, tint: 0xd8d0c0 }, { y: 6.85, h: 0.3, d: 0.2, mat: M.gold, tint: 0xd8d0c0 }],
  });

  // ---- Floor slab above the casino volume, roof, parapet ----
  const slab = new THREE.BufferGeometry();
  const roofShape = new THREE.Shape([
    new THREE.Vector2(X0, -Z0), new THREE.Vector2(X1 - CH, -Z0), new THREE.Vector2(X1, -(Z0 + CH)), new THREE.Vector2(X1, -Z1), new THREE.Vector2(X0, -Z1),
  ]);
  void slab;
  const slabGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 0.45, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI / 2); // shape y → -z
  // Rotating maps shape (x, y) → (x, ·, -y): we built y = -z, so z comes back positive.
  batch.add(slabGeo.clone().translate(0, Y0 + 7.0, 0), BM.concrete, { castShadow: false });
  batch.add(slabGeo.clone().translate(0, Y0 + H - 0.45, 0), BM.roof, { castShadow: false });
  // Parapet ring on top + coping.
  const ring = [[X1, Z1 - T, X1, Z0 + CH], [X1, Z0 + CH, X1 - CH, Z0], [X1 - CH, Z0, X0, Z0], [X0, Z0, X0, Z1], [X0, Z1, X1, Z1]];
  for (const [ax, az, bx, bz] of ring) {
    const f = faceFrame(ax, az, bx, bz, Y0 + H);
    batch.add(new THREE.BoxGeometry(f.len, 1.2, T).translate(f.len / 2, 0.6, -T / 2), M.wall, { matrix: f.matrix, tint: CREAM });
  }
  for (let i = 0; i < 9; i++) hvac(batch, rng.range(X0 + 4, X1 - 6), Y0 + H, rng.range(Z0 + 6, Z1 - 6), rng.range(0, 3), rng);

  // ---- Hotel tower ----
  const towerTop = Y0 + H + 76;
  const towerWall = towerFacadeMat({ wall: tinted(BM.stucco), cell: [2.4, 3.1], win: [1.25, 1.9], y0: Y0 + H + 2, y1: towerTop - 6, style: 'room', glass: 0x56636c, frame: 0x6a5848, bands: 0xd2bc98, seed: 11, mullions: 1 });
  const boxes = [[-68, -36, 48, 64], [-60, -44, 36, 76]];
  for (const [x0, x1, z0, z1] of boxes) {
    batch.add(new THREE.BoxGeometry(x1 - x0, towerTop - (Y0 + H), z1 - z0).translate((x0 + x1) / 2, (Y0 + H + towerTop) / 2, (z0 + z1) / 2), towerWall, { tint: 0xead8bc, chunk: 'landmark', grime: 0.15, grimeBase: Y0 + H, grimeHeight: 3 });
    // Crown: setback + gold cornice + roof.
    batch.add(new THREE.BoxGeometry(x1 - x0 + 0.6, 1.0, z1 - z0 + 0.6).translate((x0 + x1) / 2, towerTop - 5.5, (z0 + z1) / 2), M.gold, { tint: 0xffffff, chunk: 'landmark' });
    batch.add(new THREE.BoxGeometry(x1 - x0 + 0.8, 0.8, z1 - z0 + 0.8).translate((x0 + x1) / 2, towerTop + 0.4, (z0 + z1) / 2), M.gold, { tint: 0xffffff, chunk: 'landmark' });
    batch.add(new THREE.BoxGeometry(x1 - x0 - 2, 3.5, z1 - z0 - 2).translate((x0 + x1) / 2, towerTop + 2.5, (z0 + z1) / 2), M.wall, { tint: 0xd8c4a2, chunk: 'landmark' });
  }
  // Crown lights: steady warm bulbs along the top cornices.
  const crown = new BulbSet({ radius: 0.12, pattern: 'twinkle', intensity: 7, dayIntensity: 0 });
  for (const [x0, x1, z0, z1] of boxes) {
    const yy = towerTop + 0.85;
    for (let x = x0; x <= x1; x += 0.8) {
      crown.add([x, yy, z0 - 0.42], 0, 0xffd38a);
      crown.add([x, yy, z1 + 0.42], 0, 0xffd38a);
    }
    for (let z = z0; z <= z1; z += 0.8) {
      crown.add([x0 - 0.42, yy, z], 0, 0xffd38a);
      crown.add([x1 + 0.42, yy, z], 0, 0xffd38a);
    }
  }
  // Tower-top ELDORADO letters (east and north faces of the cross wing).
  const topFace = litFaceMat(0xff3a2a, { k: 3.4, dayColor: 0xb3201a, metal: 0.1 });
  channelLetters(ctx, eldo, {
    font: '"Playfair Display"', weight: 700, height: 3.2, depth: 0.4, tracking: 0.1,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(-43.95, towerTop - 4.4, 56),
    face: topFace, side: M.goldMetal, chunk: 'landmark',
  });
  channelLetters(ctx, eldo, {
    font: '"Playfair Display"', weight: 700, height: 3.2, depth: 0.4, tracking: 0.1,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI).setPosition(-52, towerTop - 4.4, 35.95),
    face: topFace, side: M.goldMetal, chunk: 'landmark',
  });

  // ---- Skyway to Silver Legacy across 4th St ----
  skyway(ctx, { x0: -48, x1: -42, z0: Z0 - 0.1, z1: -11.9, y0: Y0 + 7.6, y1: Y0 + 11.4, sign: t('reno.eldo.name') });

  ctx.extraMeshes.push(bulbs.build('eldorado-letter-bulbs'), down.build('eldorado-downlights'), fascia.build('eldorado-fascia'), crown.build('eldorado-crown'));

  // ---- Colliders: per wall (the casino volume stays open for the casino builder) ----
  wallColliders(colliders, faces.virginia, H, T, vOpen.filter((o) => o.door), openDoors);
  wallColliders(colliders, faces.chamfer, H, T, [{ x0: 1.4, x1: C.len - 1.4, y0: 0, y1: 3.2 }], openDoors);
  wallColliders(colliders, faces.fourth, H, T, fOpen.filter((o) => o.door), openDoors);
  wallColliders(colliders, faces.west, H, T, [], false);
  wallColliders(colliders, faces.south, H, T, [], false);
  colliders.aabb(X0, Y0 + H - 0.45, Z0, X1, Y0 + H, Z1);
  // Canopy top is walkable only if you jump from somewhere — give it a real collider anyway.
  colliders.aabb(cx0, cyB, cz0, cx1, cyT, cz1);

  const entrance = { x: X1 + 1.6, y: Y0, z: 50, yaw: -Math.PI / 2 };
  return {
    entrance,
    zone: { id: 'eldorado-entrance', box: new THREE.Box3(new THREE.Vector3(X1 - 0.3, 0, 44.6), new THREE.Vector3(X1 + 4.4, 4.5, 55.4)), audioRoom: 'street', venue: 'eldorado', indoor: false, trigger: true },
  };
}

function wallColliders(colliders, f, H, T, doors, openDoors) {
  // Split the wall along local x at door edges; door spans get only a lintel (and a closed door
  // slab at the recess unless openDoors).
  const xs = [0, f.len];
  for (const d of doors) xs.push(d.x0, d.x1);
  xs.sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    if (b - a < 0.01) continue;
    const mid = (a + b) / 2;
    const door = doors.find((d) => mid > d.x0 && mid < d.x1);
    if (door) {
      colliders.local(f.matrix, mid, (door.y1 + H) / 2, -T / 2, b - a, H - door.y1, T);
      if (!openDoors) colliders.local(f.matrix, mid, door.y1 / 2, -0.24, b - a, door.y1, 0.08);
    } else {
      colliders.local(f.matrix, mid, H / 2, -T / 2, b - a, H, T);
    }
  }
}

/** Enclosed glass pedestrian bridge between two casinos (spans along Z). */
export function skyway(ctx, { x0, x1, z0, z1, y0, y1, sign }) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const P = propMats();
  const gold = mat('metal-painted', { color: 0xc9a050, wear: 0.25, dirt: 0.3, seed: 91 });
  const zc = (z0 + z1) / 2;
  const len = Math.abs(z1 - z0);
  const w = x1 - x0;
  const xc = (x0 + x1) / 2;
  // Deck + roof (deep fascia) + glass sides with mullions.
  batch.add(new THREE.BoxGeometry(w + 0.4, 0.9, len).translate(xc, y0 - 0.45, zc), BM.metal, { tint: 0xd8cfc0, chunk: 'landmark' });
  batch.add(new THREE.BoxGeometry(w + 0.6, 1.0, len).translate(xc, y1 + 0.5, zc), BM.metal, { tint: 0xd8cfc0, chunk: 'landmark' });
  batch.add(new THREE.BoxGeometry(w + 0.7, 0.14, len).translate(xc, y1 + 1.05, zc), gold, { tint: 0xffffff, chunk: 'landmark' });
  for (const x of [x0, x1]) {
    const g = new THREE.PlaneGeometry(len, y1 - y0).rotateY(Math.PI / 2).translate(x, (y0 + y1) / 2, zc);
    batch.add(g, P.glass, { chunk: 'landmark', castShadow: false, uv: 'keep' });
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z += 2) {
      batch.add(new THREE.BoxGeometry(0.1, y1 - y0, 0.1).translate(x, (y0 + y1) / 2, z), BM.metal, { tint: 0x8c8780, chunk: 'landmark' });
    }
  }
  // Lit ceiling strip inside + carpet floor (visible through the glass).
  batch.add(new THREE.PlaneGeometry(w - 0.6, len).rotateX(Math.PI / 2).translate(xc, y1 - 0.02, zc), lightStrip(), { chunk: 'landmark', castShadow: false });
  batch.add(new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2).translate(xc, y0 + 0.01, zc), mat('carpet-casino', { seed: 95 }), { chunk: 'landmark', castShadow: false });
  // Sign on the fascia, both sides facing the street ends.
  if (sign) {
    for (const s of [-1, 1]) {
      const sm = paintedSignMat(`skyway-${sign}`, 512, 96, (g, W2, H2) => {
        g.fillStyle = '#1a1410';
        g.fillRect(0, 0, W2, H2);
        g.fillStyle = '#e8c46a';
        g.font = '700 64px "Playfair Display"';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        fitText(g, sign, W2 - 30, 64, (sz) => `700 ${sz}px "Playfair Display"`);
        g.fillText(sign, W2 / 2, H2 / 2 + 4);
      }, { lit: 1.6 });
      const pg = new THREE.PlaneGeometry(len * 0.5, 0.75).rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2).translate(s > 0 ? x1 + 0.31 : x0 - 0.31, y1 + 0.5, zc);
      batch.add(pg, sm, { chunk: 'landmark', uv: 'keep', castShadow: false });
    }
  }
  colliders.aabb(x0 - 0.2, y0 - 0.9, Math.min(z0, z1), x1 + 0.2, y1 + 1.1, Math.max(z0, z1));
  lights.push({ pos: new THREE.Vector3(xc, y0 - 1, zc), color: 0xfff0d8, intensity: 4, distance: 10, kind: 'ad', groundY: 0, realLight: false, reflect: false });
}

let strip = null;
function lightStrip() {
  if (!strip) {
    strip = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dc, emissiveIntensity: 2.2, roughness: 0.6 });
    strip.name = 'light-strip';
  }
  return strip;
}

function ledSlide(bg, fg, text, font, weight, sparkle = false) {
  return (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, bg);
    grd.addColorStop(1, '#000');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    if (sparkle) {
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(255,${200 + (i % 50)},120,${0.3 + (i % 7) / 10})`;
        g.fillRect((i * 97) % w, (i * 53) % h, 4, 4);
      }
    }
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = text.split(' ');
    const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [text];
    lines.forEach((ln, i) => {
      const size = fitText(g, ln, w - 40, lines.length > 1 ? 110 : 140, (s) => `${weight} ${s}px ${font}`);
      g.font = `${weight} ${size}px ${font}`;
      g.shadowColor = fg;
      g.shadowBlur = 18;
      g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.02);
    });
  };
}

function posterMat(kind) {
  const spec = {
    buffet: ['#5a1414', '#f1c96a', 'FOUNTAIN', 'BUFFET', 'ALL YOU CAN EAT'],
    show: ['#120a2a', '#ff7ad9', 'LIVE', 'TONIGHT', 'SHOWROOM · 8 PM'],
    slots: ['#0b2a1a', '#ffe36a', 'HOT', 'SLOTS', '2,000 MACHINES'],
    steak: ['#1c1210', '#e8d2a8', 'THE', 'STEAKHOUSE', 'PRIME CUTS · FINE WINE'],
  }[kind];
  return paintedSignMat(`eldo-poster-${kind}`, 256, 340, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, spec[0]);
    grd.addColorStop(1, '#050505');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a050';
    g.lineWidth = 6;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = spec[1];
    g.textAlign = 'center';
    g.font = '400 54px "Bebas Neue"';
    g.fillText(spec[2], w / 2, h * 0.3);
    const s = fitText(g, spec[3], w - 40, 80, (z) => `700 ${z}px "Playfair Display"`);
    g.font = `700 ${s}px "Playfair Display"`;
    g.fillText(spec[3], w / 2, h * 0.5);
    g.font = '400 28px "Bebas Neue"';
    g.fillStyle = '#efe6d2';
    g.fillText(spec[4], w / 2, h * 0.75);
  }, { lit: 1.8, weather: { grime: 0.12, fade: 0.08, rust: 0, scratches: 0.1 } });
}
