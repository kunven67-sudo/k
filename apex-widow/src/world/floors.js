// The other floors you escape down through. Each one = real rooms, real furniture, the right prey for the size you
// should be when you get there, and the people who work there at night.
//   47 Animal Lab (~1-4 cm)   31 Offices (~4-20 cm)   20 Cafeteria + Gym (~20-60 cm)   9 Server Farm (~0.5-1.2 m)   1 Lobby (~1-2 m)
import * as THREE from 'three';
import { Kit } from './kit.js';
import { FLOOR_BUILDERS, finish, ceilAround, ceiling, wall, doorLeaf, CEIL_H, HALF, CORE, fumeHood, stool, sofa, bookcase, supplies, terrarium, AROUND } from './tower.js';

const H = CEIL_H;
const RING = { x0: -10.7, x1: 10.7, z0: -7.7, z1: 7.7 }; // corridor ring around the core

// rooms off a ring corridor: walls with doors on the ring side
function ringWalls(B, Y, doors, mat = 'plaster') {
  const R = RING;
  // north + south walls of the ring (with doors), east + west walls
  wall(B, -HALF, R.z0, R.x0, R.z0, Y, H, mat, 0.12, doors.sw || []);
  wall(B, R.x0, R.z0, R.x1, R.z0, Y, H, mat, 0.12, doors.s || []);
  wall(B, R.x1, R.z0, HALF, R.z0, Y, H, mat, 0.12, doors.se || []);
  wall(B, -HALF, R.z1, R.x0, R.z1, Y, H, mat, 0.12, doors.nw || []);
  wall(B, R.x0, R.z1, R.x1, R.z1, Y, H, mat, 0.12, doors.n || []);
  wall(B, R.x1, R.z1, HALF, R.z1, Y, H, mat, 0.12, doors.ne || []);
  wall(B, R.x0, -HALF, R.x0, R.z0, Y, H, mat, 0.12, doors.ws || []);
  wall(B, R.x0, R.z0, R.x0, R.z1, Y, H, mat, 0.12, doors.w || []);
  wall(B, R.x0, R.z1, R.x0, HALF, Y, H, mat, 0.12, doors.wn || []);
  wall(B, R.x1, -HALF, R.x1, R.z0, Y, H, mat, 0.12, doors.es || []);
  wall(B, R.x1, R.z0, R.x1, R.z1, Y, H, mat, 0.12, doors.e || []);
  wall(B, R.x1, R.z1, R.x1, HALF, Y, H, mat, 0.12, doors.en || []);
}
const D = (at, w = 1.0) => ({ at, w, h: 2.15 });

// ------------------------------------------------------------------ 47 ANIMAL LAB
FLOOR_BUILDERS[47] = (B, Y, ctx) => {
  finish(B, 'smalltile', Y);
  ceilAround(B, Y + H, ctx, { every: 2.4, offFn: () => Math.random() < 0.35 });
  // doors: rooms open onto the ring corridor
  ringWalls(B, Y, { sw: [D(6)], se: [D(5)], nw: [D(6)], ne: [D(5)], w: [D(7.7)], e: [D(7.7)], s: [D(4)], n: [D(16)] }, 'walltile');
  // the doors themselves (some closed: crawl under, some propped open)
  doorLeaf(B, -HALF, RING.z0, RING.x0, RING.z0, Y, 6, 1.0, 2.15, 0.0, 'steel');
  doorLeaf(B, RING.x1, RING.z0, HALF, RING.z0, Y, 5, 1.0, 2.15, 0.9, 'steel');
  doorLeaf(B, -HALF, RING.z1, RING.x0, RING.z1, Y, 6, 1.0, 2.15, 0.7, 'steel');
  doorLeaf(B, RING.x1, RING.z1, HALF, RING.z1, Y, 5, 1.0, 2.15, 0.0, 'steel');
  // ---- RODENT ROOM (south-west): rack after rack of cages, a cage-change hood, one cage chewed open
  for (let r = 0; r < 3; r++) {
    const z = -20.2 + r * 3.6;
    for (let k = 0; k < 2; k++) {
      const x = -19 + k * 2.6;
      Kit.shelf(B, x, Y, z, 0, 2.2, 1.9, 0.5, 4, 'steel');
      for (let lv = 0; lv < 4; lv++) for (let i = 0; i < 4; i++) {
        const cx = x - 0.82 + i * 0.55, cy = Y + 0.11 + lv * 0.5;
        Kit.cage(B, cx, cy, z, 0.48, 0.22, 0.32);
        if (r === 1 && k === 0 && lv === 0 && i === 2) ctx.labels.push({ text: 'R-11 (EMPTY?)', x: cx, y: cy + 0.25, z: z + 0.17, rot: 0, small: true, card: true });
      }
    }
  }
  fumeHood(B, -12.6, Y, -20.8);
  Kit.trash(B, -12.0, Y, -9.0);
  // ---- INSECT COLONIES (north-west): cricket bins, roach tanks, mealworm drawers, the broken giant-roach tank
  for (let i = 0; i < 4; i++) {
    const x = -20 + i * 2.2;
    Kit.labBench(B, x + 0.9, Y, 21.0, Math.PI, 2.0, 0.8);
    for (let k = 0; k < 2; k++) { // cricket tubs w/ egg cartons
      const bx = x + 0.4 + k * 0.9;
      B.box(0.6, 0.35, 0.42, 'whitePlastic', bx, Y + 0.9375 + 0.175, 20.9, 'PROP', 0, 0.01);
      for (let e = 0; e < 3; e++) B.box(0.22, 0.06, 0.28, 'cardboard', bx - 0.15 + e * 0.15, Y + 0.97 + e * 0.05, 20.9, 'SMALL', 0.2 * e);
    }
  }
  Kit.shelf(B, -21.6, Y, 13.5, Math.PI / 2, 4, 1.8, 0.5, 4, 'steel');
  for (let lv = 0; lv < 4; lv++) for (let i = 0; i < 5; i++) Kit.cage(B, -21.6, Y + 0.11 + lv * 0.55, 11.9 + i * 0.8, 0.45, 0.3, 0.42);
  // giant roach tank: front smashed out
  Kit.labBench(B, -15, Y, 10.2, 0, 2.4, 0.9);
  const gy = Y + 0.9375;
  B.box(1.2, 0.03, 0.6, 'blackPlastic', -15, gy + 0.015, 10.2, 'FURN');
  B.box(1.2, 0.5, 0.008, 'glass', -15, gy + 0.28, 9.91, 'PROP');
  B.box(0.008, 0.5, 0.6, 'glass', -15.6, gy + 0.28, 10.2, 'PROP'); B.box(0.008, 0.5, 0.6, 'glass', -14.4, gy + 0.28, 10.2, 'PROP');
  for (let i = 0; i < 26; i++) B.add(new THREE.TetrahedronGeometry(0.01 + Math.random() * 0.03, 0), 'glass', { p: [-15 + (Math.random() - 0.5) * 1.6, Y + 0.01, 11.0 + Math.random() * 1.2], r: [Math.random() * 3, Math.random() * 3, 0] }, 'SMALL');
  ctx.labels.push({ text: 'R-2  G. portentosa  (MOD)  DO NOT HANDLE', x: -15, y: gy + 0.62, z: 10.5, rot: 0, small: true, card: true });
  // ---- REPTILE ROOM (north-east): terrariums with heat lamps
  for (let i = 0; i < 4; i++) {
    const x = 13.5 + i * 2.1;
    Kit.labBench(B, x, Y, 21.1, Math.PI, 2.0, 0.7);
    B.box(1.6, 0.6, 0.55, 'glass', x, Y + 0.9375 + 0.3, 21.1, 'PROP');
    B.box(1.6, 0.04, 0.55, 'darkmetal', x, Y + 0.9375 + 0.62, 21.1, 'PROP');
    B.box(1.55, 0.05, 0.5, 'soil', x, Y + 0.9375 + 0.025, 21.1, 'PROP');
    ctx.lights.push({ p: new THREE.Vector3(x, Y + 1.75, 21.1), color: 0xff9a40, i: 0.25, r: 2.5 });
    B.cyl(0.07, 0.09, 0.12, 'black', x, Y + 1.7, 21.1, null, 14);
  }
  terrarium(B, 21.2, Y, 10.5);
  // ---- CAGE WASH (east)
  B.box(2.4, 2.2, 1.6, 'steel', 19.5, Y + 1.1, -2.5, 'FURN', 0, 0.03); // autoclave
  B.add(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 28), 'steel', { p: [19.5, Y + 1.2, -1.65], r: [Math.PI / 2, 0, 0] }, 'PROP');
  B.box(3.2, 2.4, 1.4, 'steel', 19.6, Y + 1.2, 2.6, 'FURN', 0, 0.03); // tunnel washer
  for (let i = 0; i < 3; i++) { B.box(0.7, 0.9, 1.1, 'steel', 14 + i * 1.3, Y + 0.45, 0.5, 'FURN', 0, 0.02); for (let s = 0; s < 4; s++) B.box(0.48, 0.22, 0.32, 'whitePlastic', 14 + i * 1.3, Y + 0.95 + s * 0.23, 0.5, 'PROP', 0, 0.01); }
  // ---- PROCEDURE ROOM (west)
  B.box(1.9, 0.05, 0.75, 'steel', -16, Y + 0.95, 0, 'FURN', 0, 0.01);
  B.cyl(0.08, 0.12, 0.92, 'steel', -16, Y + 0.46, 0, 'PROP', 16);
  B.box(0.5, 1.4, 0.45, 'darkPlastic', -19.8, Y + 0.7, -2.2, 'FURN', 0, 0.02); // anesthesia machine
  for (let i = 0; i < 4; i++) B.box(0.18, 0.12, 0.02, 'screenGreen', -19.8 + (i - 1.5) * 0.08, Y + 1.25, -1.97, null);
  Kit.shelf(B, -21.6, Y, 3.5, Math.PI / 2, 2.4, 2.0, 0.4, 5, 'steel'); supplies(B, -21.6, Y, 3.5, 2.4, 2.0);
  // ---- FEED PREP (south): fridges, scale, a stack of feed bags (mice nest in them)
  Kit.fridge(B, -3, Y, -21.3, 0, true); Kit.fridge(B, -2.2, Y, -21.3, 0, true);
  Kit.labBench(B, 3, Y, -21.1, 0, 3.0, 0.8);
  for (let i = 0; i < 5; i++) B.box(0.55, 0.16, 0.85, 'paper', 7.5, Y + 0.08 + i * 0.16, -20.2 + (i % 2) * 0.06, 'PROP', i * 0.1, 0.03);
  // ---- BREAK ROOM (north)
  Kit.desk(B, -3, Y, 13.5, 0); Kit.monitor(B, -3, Y + 0.74, 13.3, 0, 'screen'); Kit.officeChair(B, -3, Y, 14.3, Math.PI);
  Kit.mug(B, -2.3, Y + 0.74, 13.6); Kit.paperStack(B, -3.5, Y + 0.74, 13.6, 0.2, 5);
  Kit.fridge(B, 6, Y, 21.3, Math.PI, false); B.box(1.6, 0.9, 0.6, 'laminate', 3.8, Y + 0.45, 21.4, 'FURN'); Kit.mug(B, 3.4, Y + 0.9, 21.4); Kit.water(B, 1.5, Y, 21.5);
  // corridor dressing
  Kit.fireExt(B, -10.5, Y, -7.4); Kit.plant(B, 10.3, Y, 7.3, 1.2);
  ctx.screens.push({ x: -3, y: Y + 0.74 + 0.18 + 0.174, z: 13.3 + 0.016, w: 0.56, h: 0.33, rot: 0, kind: 'graph' });
  ctx.notes.push({ id: 'rec47', x: -3.4, y: Y + 0.75, z: 13.55 }, { id: 'voss3', x: 3.2, y: Y + 0.94, z: -21.0 });
  ctx.vials.push({ kind: 'mutation', x: -16.2, y: Y + 0.98, z: 0.1 });
  ctx.spawns.push(
    { kind: 'cricket', x: -17, y: Y, z: 19.5, n: 10, r: 4 }, { kind: 'roach', x: -14, y: Y, z: 12, n: 6, r: 5 },
    { kind: 'mealworm', x: -18, y: Y + 0.9375, z: 20.9, n: 6, r: 1.2 }, { kind: 'giantroach', x: -14.5, y: Y, z: 12.6, n: 1, r: 1 },
    { kind: 'mouse', x: -15, y: Y, z: -14, n: 4, r: 5 }, { kind: 'rat', x: 6, y: Y, z: -19, n: 2, r: 3 },
    { kind: 'gecko', x: 16, y: Y + 1.4, z: 21.9, n: 2, r: 3, wall: true }, { kind: 'housefly', x: 0, y: Y + 1.8, z: -12, n: 5, r: 6 },
    { kind: 'moth', x: 0, y: Y + 2.8, z: 10, n: 4, r: 6 }, { kind: 'cricket', x: 8, y: Y, z: -9, n: 4, r: 3 },
  );
  ctx.humans.push(
    { role: 'animaltech', x: -16, y: Y, z: -12, rot: 0, path: [[-16, -12], [-16, -6.8], [0, -6.8], [9, -6.8], [9, 6.8], [-9, 6.8], [-16, 12]] },
    { role: 'guard', x: 0, y: Y, z: -6.6, rot: 0, path: [[0, -6.6], [9.6, -6.6], [9.6, 6.6], [-9.6, 6.6], [-9.6, -6.6]] },
  );
};

// ------------------------------------------------------------------ 31 OFFICES
FLOOR_BUILDERS[31] = (B, Y, ctx) => {
  finish(B, 'carpet', Y);
  ceilAround(B, Y + H, ctx, { every: 2.4, warm: false, offFn: () => Math.random() < 0.6 });
  // meeting rooms along the east facade: glass walls
  for (let i = 0; i < 3; i++) {
    const z0 = -20 + i * 7, z1 = z0 + 6;
    wall(B, 14, z0, 14, z1, Y, H, 'glass', 0.03, [D(3, 0.95)]);
    wall(B, 14, z1, 22, z1, Y, H, 'plaster', 0.12);
    Kit.desk(B, 18, Y, z0 + 3, Math.PI / 2, 'parquet', 2.6, 1.2);
    for (let c = 0; c < 3; c++) { Kit.officeChair(B, 17.1, Y, z0 + 2 + c * 1.0, Math.PI / 2, 'fabric'); Kit.officeChair(B, 18.9, Y, z0 + 2 + c * 1.0, -Math.PI / 2, 'fabric'); }
    B.box(0.06, 1.2, 2.0, 'screenOff', 21.85, Y + 1.5, z0 + 3, 'PROP'); // wall TV
  }
  // cubicle clusters: west half + north
  const pod = (cx, cz) => {
    for (const [dx, dz, rot] of [[-0.85, -0.45, 0], [0.85, -0.45, 0], [-0.85, 0.45, Math.PI], [0.85, 0.45, Math.PI]]) {
      const x = cx + dx, z = cz + dz;
      Kit.desk(B, x, Y, z, rot, 'laminate', 1.6, 0.8);
      Kit.monitor(B, x, Y + 0.74, z - Math.cos(rot) * 0.2, rot, Math.random() < 0.35 ? 'screen' : 'screenOff', 0.6);
      Kit.keyboard(B, x, Y + 0.74, z + Math.cos(rot) * 0.12, rot); Kit.mouse(B, x + 0.3, Y + 0.74, z + Math.cos(rot) * 0.12, rot);
      if (Math.random() < 0.6) Kit.mug(B, x - 0.55, Y + 0.74, z + Math.cos(rot) * 0.1);
      if (Math.random() < 0.7) Kit.paperStack(B, x + 0.55, Y + 0.74, z - Math.cos(rot) * 0.15, rot, 3 + Math.floor(Math.random() * 6));
      Kit.officeChair(B, x, Y, z + Math.cos(rot) * 0.75, rot + Math.PI);
    }
    // fabric partitions
    B.box(3.4, 1.25, 0.05, 'fabric', cx, Y + 0.625, cz, 'FURN');
    B.box(0.05, 1.25, 1.8, 'fabric', cx, Y + 0.625, cz, 'FURN');
  };
  for (const [cx, cz] of [[-18, -18], [-18, -12.5], [-12, -18], [-12, -12.5], [-18, 10], [-18, 15.5], [-12, 10], [-12, 15.5], [-4, 12], [3, 12], [-4, 18], [3, 18]]) pod(cx, cz);
  // break room / kitchen (south-west corner by the core): counters, sink, fridge, microwave, coffee machine, sugar = ants
  B.box(4.5, 0.9, 0.65, 'laminate', -3.5, Y + 0.45, -21.4, 'FURN', 0, 0.01);
  B.box(4.5, 0.04, 0.68, 'blackmarble', -3.5, Y + 0.92, -21.4, 'FURN');
  Kit.fridge(B, -6.4, Y, -21.3, 0, false);
  B.box(0.5, 0.3, 0.38, 'blackPlastic', -1.8, Y + 1.09, -21.4, 'PROP', 0, 0.02); // microwave
  B.box(0.28, 0.38, 0.32, 'blackPlastic', -3.2, Y + 1.13, -21.45, 'PROP', 0, 0.02); // coffee machine
  B.cyl(0.05, 0.05, 0.12, 'whitePlastic', -2.6, Y + 1.0, -21.2, 'SMALL', 14); // sugar jar
  for (let i = 0; i < 2; i++) { B.box(1.4, 0.04, 0.8, 'laminate', -3 + i * 2.2, Y + 0.74, -15.5, 'FURN', 0, 0.01); B.cyl(0.04, 0.05, 0.72, 'chrome', -3 + i * 2.2, Y + 0.36, -15.5, 'PROP', 10); }
  Kit.vending(B, 2.6, Y, -21.3, 0); Kit.water(B, 4.2, Y, -21.5);
  // printer + copy area, reception by the elevators
  B.box(0.7, 1.05, 0.6, 'beigePlastic', 9.5, Y + 0.525, -12, 'FURN', 0, 0.02); B.box(0.6, 0.12, 0.45, 'greyPlastic', 9.5, Y + 1.11, -12, 'PROP');
  B.box(3.2, 1.05, 0.7, 'laminate', -3.4, Y + 0.525, -9.3, 'FURN', 0, 0.02); Kit.monitor(B, -3.4, Y + 1.05, -9.45, 0, 'screen', 0.5);
  ctx.labels.push({ text: 'VOSS BIOGENETICS  -  31', x: -3.4, y: Y + 2.2, z: CORE.z0 - 0.21, rot: Math.PI, size: 0.24, ink: '#e8ecf0', bg: '#1a1d22' });
  for (const [x, z] of [[-21, -6], [-21, 6], [10, 6.5], [12.8, -21], [-8.5, 21]]) Kit.plant(B, x, Y, z, 1.4);
  Kit.trash(B, -5.2, Y, -19.8); Kit.fireExt(B, 8.6, Y, 5.6);
  ctx.boards.push({ x: -21.9, y: Y + 1.5, z: 0, w: 2.4, h: 1.1, rot: Math.PI / 2, lines: [['Q4 TARGETS', '#202020', 56], ['- defence contract (S8!!)', '#1a2a6a'], ['- Marshall review 11/03', '#1a2a6a'], ['- NO ONE on 47-48 after 9pm', '#a01818']] });
  ctx.notes.push({ id: 'voss4', x: 17.6, y: Y + 0.75, z: -16.8 }, { id: 'rec31', x: -11.4, y: Y + 0.75, z: 15.2 });
  ctx.vials.push({ kind: 'growth', x: 18.6, y: Y + 0.75, z: 0.4 });
  ctx.spawns.push(
    { kind: 'housefly', x: -21.2, y: Y + 1.6, z: -10, n: 6, r: 8, wall: true }, { kind: 'moth', x: -10, y: Y + 2.8, z: 0, n: 5, r: 10 },
    { kind: 'ant', x: -2.6, y: Y + 0.92, z: -21.2, n: 28, r: 1.6 }, { kind: 'roach', x: -4, y: Y, z: -20, n: 5, r: 4 },
    { kind: 'mouse', x: 3, y: Y, z: -20.5, n: 2, r: 3 }, { kind: 'silverfish', x: -18, y: Y, z: 12, n: 4, r: 6 },
    { kind: 'centipede', x: -12, y: Y, z: 18, n: 1, r: 3 }, { kind: 'centipede', x: 16, y: Y, z: -8, n: 1, r: 3 },
  );
  ctx.humans.push(
    { role: 'office', x: -18.8, y: Y, z: -18.0, rot: Math.PI, sit: true },
    { role: 'office', x: -11.2, y: Y, z: 15.95, rot: 0, sit: true },
    { role: 'office', x: 3.8, y: Y, z: 12.45, rot: 0, path: [[3.8, 12.45], [3.8, 8.5], [-3, 8.5], [-3, -12], [-3.2, -20.4], [-3, -12], [-3, 8.5]] },
    { role: 'janitor', x: 0, y: Y, z: -8, rot: 0, path: [[0, -8], [12, -8], [12, 8], [-14, 8], [-14, -8]] },
    { role: 'guard', x: 9.6, y: Y, z: 0, rot: 0, path: [[9.6, 0], [9.6, -8], [-9.6, -8], [-9.6, 8], [9.6, 8]] },
  );
};

// ------------------------------------------------------------------ 20 CAFETERIA + GYM
FLOOR_BUILDERS[20] = (B, Y, ctx) => {
  finish(B, 'terrazzo', Y);
  ceilAround(B, Y + H, ctx, { every: 2.4, warm: true, offFn: () => Math.random() < 0.45 });
  // kitchen (north-east) behind a serving line, gym (south-east) behind glass
  wall(B, 9, 8, 22, 8, Y, H, 'walltile', 0.12, [D(3, 1.2)]);
  wall(B, 9, 8, 9, 22, Y, H, 'walltile', 0.12, [D(1.5, 1.2)]);
  wall(B, 9, -8, 22, -8, Y, H, 'glass', 0.03, [D(3, 1.6)]);
  wall(B, 9, -22, 9, -8, Y, H, 'glass', 0.03);
  // cafeteria tables (west + north-west)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const x = -19.5 + c * 3.3, z = -18 + r * 5.2 + (r > 1 ? 9 : 0);
    B.box(2.2, 0.04, 0.9, 'laminate', x, Y + 0.74, z, 'FURN', 0, 0.01);
    B.cyl(0.05, 0.06, 0.72, 'chrome', x - 0.8, Y + 0.36, z, 'PROP', 10); B.cyl(0.05, 0.06, 0.72, 'chrome', x + 0.8, Y + 0.36, z, 'PROP', 10);
    for (let s = 0; s < 3; s++) for (const sd of [-1, 1]) { const cx = x - 0.7 + s * 0.7, cz = z + sd * 0.65; B.box(0.44, 0.04, 0.42, 'paintRed', cx, Y + 0.45, cz, 'FURN', 0, 0.01); B.box(0.44, 0.42, 0.04, 'paintRed', cx, Y + 0.7, cz + sd * 0.2, 'FURN'); B.cyl(0.015, 0.015, 0.45, 'chrome', cx, Y + 0.22, cz, 'SMALL', 6); }
    if ((r + c) % 3 === 0) { B.box(0.36, 0.02, 0.27, 'greyPlastic', x + 0.4, Y + 0.77, z, 'SMALL'); B.cyl(0.11, 0.09, 0.03, 'whitePlastic', x + 0.4, Y + 0.795, z, 'SMALL', 16); B.cyl(0.09, 0.09, 0.012, 'food', x + 0.4, Y + 0.81, z, null, 16); }
  }
  // serving line
  B.box(9, 0.95, 0.8, 'steel', 0.5, Y + 0.475, 9.4, 'FURN', 0, 0.01);
  B.box(9, 0.03, 1.0, 'steel', 0.5, Y + 0.96, 9.4, 'FURN');
  B.box(9, 0.02, 0.5, 'glass', 0.5, Y + 1.4, 9.2, null);
  for (let i = 0; i < 6; i++) B.box(0.5, 0.1, 0.32, 'steel', -3 + i * 1.4, Y + 0.93, 9.5, 'PROP');
  Kit.vending(B, -8, Y, 9.0, 0); Kit.vending(B, -6.9, Y, 9.0, 0);
  for (const x of [-21.4, -21.4]) Kit.trash(B, x, Y, -7);
  Kit.trash(B, 7.6, Y, 7.4); Kit.trash(B, -9.2, Y, -21.2);
  // kitchen
  for (let i = 0; i < 3; i++) { B.box(1.6, 0.9, 0.9, 'steel', 12 + i * 2, Y + 0.45, 21.3, 'FURN', 0, 0.01); for (let b = 0; b < 4; b++) B.cyl(0.11, 0.11, 0.02, 'black', 11.6 + i * 2 + (b % 2) * 0.8, Y + 0.91, 21.1 + Math.floor(b / 2) * 0.4, 'SMALL', 16); }
  B.box(4, 0.92, 1.0, 'steel', 15.5, Y + 0.46, 14, 'FURN', 0, 0.01);
  B.box(2.6, 2.4, 2.6, 'steel', 20.5, Y + 1.2, 10.8, 'FURN', 0, 0.02); // walk-in cooler
  for (let i = 0; i < 3; i++) Kit.shelf(B, 14 + i * 2.2, Y, 9, 0, 1.6, 1.8, 0.45, 5, 'steel');
  ctx.zones.push({ kind: 'cold', x0: 19.2, x1: 21.8, z0: 9.5, z1: 12.1, y: Y });
  // gym (south-east): treadmills, bike, racks, mats, mirror wall
  for (let i = 0; i < 4; i++) { const x = 11 + i * 2.6; B.box(0.8, 0.2, 1.9, 'black', x, Y + 0.1, -21, 'FURN', 0, 0.02); B.box(0.8, 0.06, 0.06, 'greyPlastic', x, Y + 1.15, -20.15, 'PROP'); B.box(0.05, 1.0, 0.05, 'greyPlastic', x - 0.38, Y + 0.65, -20.2, 'PROP'); B.box(0.05, 1.0, 0.05, 'greyPlastic', x + 0.38, Y + 0.65, -20.2, 'PROP'); B.box(0.5, 0.3, 0.05, 'screenOff', x, Y + 1.32, -20.15, null); }
  B.box(4.5, 0.03, 4, 'rubbertile', 15.5, Y + 0.035, -13, 'STRUCT');
  B.box(2.2, 1.2, 0.5, 'darkmetal', 20.6, Y + 0.6, -14.5, 'FURN'); for (let i = 0; i < 6; i++) B.add(new THREE.CylinderGeometry(0.07 + i * 0.008, 0.07 + i * 0.008, 0.18 + i * 0.02, 12), 'black', { p: [19.8 + i * 0.3, Y + 0.8, -14.5], r: [0, 0, Math.PI / 2] }, 'PROP');
  B.box(0.06, 1.0, 1.7, 'screenOff', 9.1, Y + 2.2, -15, null); // TV on the glass wall frame
  ctx.notes.push({ id: 'rec20', x: -16.2, y: Y + 0.77, z: -12.8 }, { id: 'voss5', x: 15.4, y: Y + 0.93, z: 14.1 });
  ctx.vials.push({ kind: 'growth', x: 20.4, y: Y + 1.21, z: 9.4 });
  ctx.spawns.push(
    { kind: 'rat', x: 14, y: Y, z: 18, n: 5, r: 5 }, { kind: 'roach', x: 13, y: Y, z: 20, n: 10, r: 5 },
    { kind: 'housefly', x: -12, y: Y + 1.5, z: -5, n: 8, r: 10 }, { kind: 'mouse', x: -6, y: Y, z: 8, n: 3, r: 4 },
    { kind: 'rat', x: -20, y: Y, z: -8, n: 2, r: 3 },
  );
  ctx.humans.push(
    { role: 'cook', x: 14, y: Y, z: 15, rot: 0, path: [[14, 15], [17, 15], [17, 19.6], [12, 19.6], [12, 15]] },
    { role: 'cleaner', x: -14, y: Y, z: -3, rot: 0, path: [[-14, -3], [-14, -16], [-5, -16], [-5, 4], [-14, 4]] },
    { role: 'guard', x: 0, y: Y, z: -7.5, rot: 0, path: [[0, -7.5], [8, -7.5], [8, 7], [-8, 7], [-8, -7.5]] },
    { role: 'gymguy', x: 13.6, y: Y, z: -20.6, rot: 0 },
  );
};

// ------------------------------------------------------------------ 9 SERVER FARM
FLOOR_BUILDERS[9] = (B, Y, ctx) => {
  // raised floor in the halls (0.6 m tiles, cold air comes up through them); the ring corridor round the core stays low
  finish(B, 'concreteFloor', Y);
  const RF = 0.45;
  const HALLS = [[-HALF, -HALF, RING.x0, HALF], [RING.x1, -HALF, HALF, HALF], [RING.x0, RING.z1, RING.x1, HALF], [RING.x0, -HALF, RING.x1, RING.z0]];
  for (const [x0, z0, x1, z1] of HALLS) {
    B.box(x1 - x0, 0.04, z1 - z0, 'alu', (x0 + x1) / 2, Y + RF - 0.02, (z0 + z1) / 2, 'STRUCT');
    for (let x = Math.ceil(x0 / 0.6) * 0.6; x < x1; x += 0.6) B.box(0.006, 0.004, z1 - z0, 'black', x, Y + RF + 0.001, (z0 + z1) / 2, null);
    for (let z = Math.ceil(z0 / 0.6) * 0.6; z < z1; z += 0.6) B.box(x1 - x0, 0.004, 0.006, 'black', (x0 + x1) / 2, Y + RF + 0.001, z, null);
  }
  // the step faces where the halls meet the corridor
  B.box(0.04, RF, RING.z1 - RING.z0, 'alu', RING.x0, Y + RF / 2, 0, 'STRUCT'); B.box(0.04, RF, RING.z1 - RING.z0, 'alu', RING.x1, Y + RF / 2, 0, 'STRUCT');
  B.box(RING.x1 - RING.x0, RF, 0.04, 'alu', 0, Y + RF / 2, RING.z0, 'STRUCT'); B.box(RING.x1 - RING.x0, RF, 0.04, 'alu', 0, Y + RF / 2, RING.z1, 'STRUCT');
  for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) { const h = RF * (k + 1) / 3; B.box(1.4, h, 0.3, 'diamond', 0, Y + h / 2, sgn * (RING.z1 - 0.15 - (2 - k) * 0.3), 'STRUCT'); }
  ceilAround(B, Y + H, ctx, { every: 3.0, offFn: () => Math.random() < 0.3 });
  // rows of racks (west + east halls), hot aisle containment roofs, cable trays
  const Yr = Y + RF;
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const z = side < 0 ? -20.5 + row * 2.6 : 9 + row * 2.6;
    const rot = row % 2 ? Math.PI : 0;
    for (let i = 0; i < 12; i++) Kit.serverRack(B, -19.5 + i * 0.62 + (i > 5 ? 0.6 : 0), Yr, z, rot);
    for (let i = 0; i < 12; i++) Kit.serverRack(B, 11.4 + i * 0.6, Yr, z, rot);
    B.box(30, 0.08, 0.35, 'darkmetal', 0, Yr + 2.35, z, 'PROP'); // cable tray
    for (let c = 0; c < 6; c++) B.box(30, 0.03, 0.03, ['paintBlue', 'paintYellow', 'paintRed', 'greyPlastic'][c % 4], 0, Yr + 2.4, z - 0.12 + c * 0.05, null);
  }
  // CRAC units along the west wall (cold air) + a UPS battery wall east
  for (let i = 0; i < 5; i++) { B.box(0.9, 2.0, 2.2, 'whitePlastic', -21.2, Yr + 1.0, -16 + i * 7.6, 'FURN', 0, 0.02); B.box(0.02, 0.6, 1.6, 'darkmetal', -20.74, Yr + 1.5, -16 + i * 7.6, null); }
  for (let i = 0; i < 8; i++) B.box(0.6, 1.9, 0.8, 'greyPlastic', 21.2, Yr + 0.95, -4 + i * 0.9 - 2, 'FURN', 0, 0.01);
  ctx.zones.push({ kind: 'cold', x0: -22, x1: 22, z0: -22, z1: 22, y: Y, mild: true });
  // NOC desk with a wall of screens (north, by the stair door)
  Kit.desk(B, -2, Yr, 18, Math.PI, 'laminate', 3.2, 0.9);
  for (let i = 0; i < 4; i++) Kit.monitor(B, -3.2 + i * 0.8, Yr + 0.74, 17.8, Math.PI, 'screen', 0.6);
  Kit.officeChair(B, -2.3, Yr, 18.9, 0); Kit.mug(B, -0.8, Yr + 0.74, 18.2);
  for (let i = 0; i < 3; i++) ctx.screens.push({ x: -3.2 + i * 1.6, y: Yr + 2.2, z: 21.8, w: 1.5, h: 0.85, rot: Math.PI, kind: i === 1 ? 'graph' : 'code' });
  for (let i = 0; i < 3; i++) B.box(1.55, 0.9, 0.05, 'blackPlastic', -3.2 + i * 1.6, Yr + 2.2, 21.85, 'PROP');
  ctx.notes.push({ id: 'voss6', x: -1.4, y: Yr + 0.75, z: 18.2 }, { id: 'rec9', x: 21.1, y: Yr + 1.92, z: -3.2 });
  ctx.vials.push({ kind: 'growth', x: -21.2, y: Yr + 2.05, z: 7 });
  ctx.spawns.push({ kind: 'rat', x: 0, y: Yr + 2.45, z: -20.5, n: 3, r: 10 }, { kind: 'moth', x: 0, y: Y + 2.8, z: 0, n: 4, r: 12 }, { kind: 'roach', x: 20, y: Yr, z: 0, n: 4, r: 4 });
  ctx.humans.push(
    { role: 'it', x: -2.3, y: Yr, z: 18.9, rot: Math.PI, sit: true },
    { role: 'guard', x: 0, y: Y, z: -6.8, rot: 0, path: [[0, -6.8], [9.8, -6.8], [9.8, 6.8], [-9.8, 6.8], [-9.8, -6.8]] },
  );
  ctx.floorOffset = RF;
};

// ------------------------------------------------------------------ 1 LOBBY (double height)
FLOOR_BUILDERS[1] = (B, Y, ctx) => {
  finish(B, 'blackmarble', Y);
  const HL = 7.9;
  ceilAround(B, Y + HL, ctx, { every: 3.6, warm: true, i: 2.2 });
  // reception desk + freestanding logo wall on the west side (the elevators stay free), facing the entrance (south)
  B.box(7, 1.1, 1.0, 'blackmarble', -14, Y + 0.55, -14, 'FURN', 0, 0.04);
  B.box(7.1, 0.05, 1.1, 'chrome', -14, Y + 1.12, -14, 'FURN');
  for (let i = 0; i < 3; i++) { Kit.monitor(B, -16 + i * 2, Y + 1.14, -14.2, 0, 'screen', 0.5); Kit.officeChair(B, -16 + i * 2, Y, -13.2, 0, 'leather'); }
  B.box(8, 4.2, 0.3, 'blackmarble', -14, Y + 2.1, -10.5, 'STRUCT');
  ctx.signs.push({ kind: 'lobbyLogo', x: -14, y: Y + 2.9, z: -10.67, rot: Math.PI });
  // security turnstiles between the desk and the elevators
  for (let i = 0; i < 5; i++) { const x = -7 + i * 1.0; B.box(0.2, 1.0, 1.2, 'steel', x, Y + 0.5, -8.6, 'FURN', 0, 0.02); B.box(0.6, 0.04, 0.02, 'glassDark', x + 0.4, Y + 0.85, -8.6, 'PROP'); }
  // seating + planters + art
  for (const x of [-16, 16]) { sofa(B, x, Y, -16, x < 0 ? Math.PI / 2 : -Math.PI / 2); B.box(1.2, 0.4, 0.6, 'blackmarble', x + (x < 0 ? 1.4 : -1.4), Y + 0.2, -16, 'FURN', 0, 0.02); }
  for (const [x, z] of [[-20, -20], [20, -20], [-20, 8], [20, 8], [-10, 20], [10, 20]]) Kit.plant(B, x, Y, z, 2.2);
  for (const x of [-12, 12]) { B.box(3, 2.2, 0.06, 'darkPlastic', x, Y + 3, 21.9, null); }
  // the entrance: revolving door frame + glass doors on the south facade (the panes there are left open: see halvern.js)
  B.cyl(1.6, 1.6, 0.2, 'steel', 0, Y + 2.6, -HALF, 'STRUCT', 32);
  for (let i = 0; i < 4; i++) B.add(new THREE.BoxGeometry(1.5, 2.3, 0.03), 'glass', { p: [Math.cos(i * Math.PI / 2) * 0.75, Y + 1.2, -HALF + Math.sin(i * Math.PI / 2) * 0.75], r: [0, i * Math.PI / 2, 0] }, null);
  ctx.openPanes = { side: 0, from: -4.5, to: 4.5 };
  ctx.notes.push({ id: 'voss7', x: -11.4, y: Y + 1.15, z: -14.1 });
  ctx.spawns.push({ kind: 'housefly', x: 0, y: Y + 2, z: -15, n: 4, r: 8 }, { kind: 'roach', x: 15, y: Y, z: 18, n: 3, r: 4 });
  ctx.humans.push(
    { role: 'receptionist', x: -14, y: Y, z: -13.2, rot: Math.PI, sit: true },
    { role: 'guard', x: -3, y: Y, z: -9.5, rot: Math.PI, path: [[-3, -9.5], [-14, -9.5], [-14, 10], [14, 10], [14, -9.5]] },
    { role: 'guard', x: 4, y: Y, z: -17, rot: 0 },
  );
};
