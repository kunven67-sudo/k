// Real lab clutter, so the floors look worked in: island benches with reagent shelves, bottles, tube racks, pipette
// tip boxes, balances, hot plates, a biosafety cabinet, -80 freezers, gas cylinders, carts, biohazard bins, boxes.
// Everything is merged per material by the Batch, so a full lab costs only a few draw calls.
import * as THREE from 'three';
import { Kit } from './kit.js';

const R = Math.random;
const pickM = (a) => a[Math.floor(R() * a.length)];

// rotate a local (lx, lz) offset around (x, z)
const rot2 = (x, z, rot, lx, lz) => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];

export function bottle(B, x, y, z, h = 0.18, kind = 'amber') {
  const r = h * 0.28;
  const mat = kind === 'amber' ? 'liquidAmber' : kind === 'blue' ? 'liquidBlue' : kind === 'green' ? 'liquidGreen' : 'formalin';
  B.add(new THREE.CylinderGeometry(r, r, h * 0.78, 14, 1, true), 'glass', { p: [x, y + h * 0.39, z] }, 'SMALL');
  B.cyl(r * 0.94, r * 0.94, h * 0.6, mat, x, y + h * 0.3, z, null, 14);
  B.add(new THREE.CylinderGeometry(r * 0.45, r, h * 0.12, 14), 'glass', { p: [x, y + h * 0.84, z] }, null);
  B.cyl(r * 0.5, r * 0.5, h * 0.1, pickM(['blackPlastic', 'paintBlue', 'paintRed', 'paintYellow']), x, y + h * 0.95, z, 'SMALL', 12);
}
export function tubeRack(B, x, y, z, rot = 0) {
  B.box(0.24, 0.05, 0.1, 'whitePlastic', x, y + 0.025, z, 'SMALL', rot);
  for (let i = 0; i < 12; i++) {
    const [tx, tz] = rot2(x, z, rot, -0.1 + (i % 6) * 0.04, i < 6 ? -0.02 : 0.02);
    if (R() < 0.2) continue;
    B.cyl(0.007, 0.007, 0.1, 'glass', tx, y + 0.06, tz, null, 8);
    B.cyl(0.0065, 0.0065, 0.05, pickM(['liquidBlue', 'liquidAmber', 'liquidGreen', 'formalin']), tx, y + 0.035, tz, null, 8);
    B.cyl(0.0085, 0.0085, 0.012, pickM(['paintBlue', 'paintRed', 'paintYellow', 'whitePlastic']), tx, y + 0.112, tz, null, 8);
  }
}
export function tipBox(B, x, y, z, rot = 0) {
  B.box(0.12, 0.07, 0.09, pickM(['paintBlue', 'paintYellow', 'greyPlastic', 'paintGreen']), x, y + 0.035, z, 'SMALL', rot, 0.004);
  B.box(0.125, 0.012, 0.095, 'glass', x, y + 0.076, z, null, rot);
}
export function balance(B, x, y, z, rot = 0) {
  B.add(new THREE.BoxGeometry(0.22, 0.08, 0.32), 'whitePlastic', { p: [x, y + 0.04, z], r: [0, rot, 0] }, 'PROP');
  B.add(new THREE.BoxGeometry(0.2, 0.22, 0.2), 'glass', { p: [x, y + 0.19, z - 0.04 * Math.cos(rot)], r: [0, rot, 0] }, 'PROP');
  const [dx, dz] = rot2(x, z, rot, 0, 0.13); B.box(0.1, 0.03, 0.005, 'screenGreen', dx, y + 0.05, dz, null, rot);
}
export function hotplate(B, x, y, z, rot = 0) {
  B.box(0.18, 0.1, 0.28, 'whitePlastic', x, y + 0.05, z, 'PROP', rot, 0.01);
  B.box(0.17, 0.008, 0.17, 'black', x, y + 0.104, z, 'SMALL', rot);
  Kit.beaker(B, x, y + 0.108, z, 0.04, 0.1, pickM(['liquidBlue', 'liquidAmber', 'formalin']));
}
// biosafety cabinet: box on a stand, glass sash, lit inside
export function bsc(B, x, y, z, rot = 0) {
  const P = (lx, lz) => rot2(x, z, rot, lx, lz);
  for (const [lx, lz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) { const [px, pz] = P(lx, lz); B.box(0.05, 0.75, 0.05, 'steel', px, y + 0.375, pz, 'PROP', rot); }
  B.box(1.6, 0.06, 0.8, 'whitePlastic', x, y + 0.78, z, 'FURN', rot);
  const [bx, bz] = P(0, 0.08); B.box(1.6, 1.35, 0.64, 'whitePlastic', bx, y + 1.5, bz, 'FURN', rot, 0.02);
  const [wx, wz] = P(0, -0.25); B.box(1.5, 0.02, 0.1, 'steel', wx, y + 0.82, wz, 'PROP', rot);
  const [sx, sz] = P(0, -0.25); B.add(new THREE.BoxGeometry(1.45, 0.62, 0.01), 'glass', { p: [sx, y + 1.18, sz], r: [0.18, rot, 0] }, null);
  const [lx2, lz2] = P(0, -0.24); B.box(1.3, 0.02, 0.04, 'lightPanel', lx2, y + 1.62, lz2, null, rot);
  const [dx, dz] = P(0.55, -0.245); B.box(0.18, 0.05, 0.01, 'screenGreen', dx, y + 1.75, dz, null, rot);
}
// upright -80 freezer with a frosty door seal and a little display
export function freezer(B, x, y, z, rot = 0) {
  B.box(0.86, 1.98, 0.88, 'whitePlastic', x, y + 0.99, z, 'FURN', rot, 0.02);
  const [hx, hz] = rot2(x, z, rot, 0.36, -0.45); B.box(0.03, 0.5, 0.04, 'steel', hx, y + 1.0, hz, 'SMALL', rot, 0.01);
  const [dx, dz] = rot2(x, z, rot, -0.1, -0.442); B.box(0.2, 0.08, 0.006, 'screenGreen', dx, y + 1.72, dz, null, rot);
  const [fx, fz] = rot2(x, z, rot, 0, -0.441); B.box(0.8, 0.015, 0.004, 'frost', fx, y + 0.08, fz, null, rot);
}
export function gasCylinders(B, x, y, z, n = 3, rot = 0) {
  for (let i = 0; i < n; i++) {
    const [cx, cz] = rot2(x, z, rot, (i - (n - 1) / 2) * 0.26, 0);
    const m = pickM(['paintGreen', 'greyPlastic', 'paintBlue']);
    B.cyl(0.11, 0.11, 1.35, m, cx, y + 0.675, cz, 'FURN', 18);
    B.add(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, { p: [cx, y + 1.35, cz] }, 'PROP');
    B.cyl(0.03, 0.03, 0.1, 'chrome', cx, y + 1.5, cz, 'SMALL', 10);
    B.cyl(0.04, 0.04, 0.03, 'black', cx, y + 1.56, cz, 'SMALL', 10);
  }
  const [bx, bz] = rot2(x, z, rot, 0, 0.12); B.box(0.26 * n + 0.1, 0.04, 0.02, 'steel', bx, y + 1.1, bz, 'SMALL', rot);
}
export function cart(B, x, y, z, rot = 0) {
  for (const h of [0.2, 0.55, 0.88]) B.box(0.9, 0.025, 0.5, 'steel', x, y + h, z, 'FURN', rot, 0.005);
  for (const [lx, lz] of [[-0.43, -0.23], [0.43, -0.23], [-0.43, 0.23], [0.43, 0.23]]) {
    const [px, pz] = rot2(x, z, rot, lx, lz);
    B.box(0.025, 0.86, 0.025, 'steel', px, y + 0.5, pz, 'SMALL', rot);
    B.cyl(0.04, 0.04, 0.03, 'rubber', px, y + 0.045, pz, 'SMALL', 12, [Math.PI / 2, rot, 0]);
  }
  Kit.beaker(B, x - 0.2, y + 0.9, z, 0.04, 0.12, 'liquidGreen');
  tubeRack(B, x + 0.15, y + 0.9, z, rot);
  for (let i = 0; i < 3; i++) B.box(0.22, 0.12, 0.3, 'cardboard', x + (i - 1) * 0.26, y + 0.28, z, 'SMALL', rot);
}
export function bioBin(B, x, y, z) {
  B.box(0.36, 0.5, 0.36, 'paintRed', x, y + 0.25, z, 'PROP', 0, 0.02);
  B.box(0.38, 0.03, 0.38, 'paintRed', x, y + 0.515, z, 'SMALL', 0, 0.01);
  B.box(0.06, 0.02, 0.2, 'blackPlastic', x, y + 0.04, z + 0.19, 'SMALL');
}
export function boxStack(B, x, y, z, n = 3) {
  let h = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.35 + R() * 0.25, d = 0.3 + R() * 0.2, bh = 0.22 + R() * 0.2;
    B.box(w, bh, d, 'cardboard', x + (R() - 0.5) * 0.06, y + h + bh / 2, z + (R() - 0.5) * 0.06, 'FURN', (R() - 0.5) * 0.3);
    B.box(w * 0.98, 0.003, 0.05, 'beigePlastic', x, y + h + bh + 0.001, z, null); // tape
    h += bh;
  }
}
// a double bench with a reagent shelf over the middle, covered in work in progress
export function islandBench(B, x, y, z, len = 3.6) {
  Kit.labBench(B, x, y, z - 0.46, 0, len, 0.9);
  Kit.labBench(B, x, y, z + 0.46, Math.PI, len, 0.9);
  const top = y + 0.9375;
  for (let i = 0; i <= 3; i++) B.box(0.03, 0.95, 0.03, 'steel', x - len / 2 + 0.08 + i * (len - 0.16) / 3, top + 0.475, z, 'SMALL');
  for (const hh of [0.42, 0.9]) {
    B.box(len - 0.1, 0.02, 0.3, 'steel', x, top + hh, z, 'PROP');
    for (let k = 0; k < len * 5; k++) if (R() < 0.75) bottle(B, x - len / 2 + 0.15 + k * 0.2 + R() * 0.05, top + hh + 0.01, z + (R() - 0.5) * 0.15, 0.12 + R() * 0.1, pickM(['amber', 'amber', 'blue', 'clear', 'green']));
  }
  // work on both sides
  for (const side of [-1, 1]) {
    const zz = z + side * 0.7;
    let px = x - len / 2 + 0.3;
    while (px < x + len / 2 - 0.3) {
      const r = R();
      if (r < 0.18) { Kit.microscope(B, px, top, zz, side > 0 ? 0 : Math.PI); px += 0.45; }
      else if (r < 0.32) { tubeRack(B, px, top, zz); px += 0.32; }
      else if (r < 0.44) { tipBox(B, px, top, zz); tipBox(B, px + 0.14, top, zz + 0.02); px += 0.34; }
      else if (r < 0.54) { balance(B, px, top, zz, side > 0 ? Math.PI : 0); px += 0.36; }
      else if (r < 0.64) { hotplate(B, px, top, zz); px += 0.3; }
      else if (r < 0.76) { Kit.beaker(B, px, top, zz, 0.035 + R() * 0.02, 0.1, pickM(['liquidBlue', 'liquidAmber', 'liquidGreen'])); Kit.flask(B, px + 0.12, top, zz + 0.05, 0.9, pickM(['liquidGreen', 'liquidAmber'])); px += 0.3; }
      else if (r < 0.84) { Kit.paperStack(B, px, top, zz, R() * 0.6, 3 + Math.floor(R() * 6)); Kit.pen(B, px + 0.05, top + 0.012, zz, R()); px += 0.32; }
      else { Kit.monitor(B, px, top, zz + side * 0.15, side > 0 ? Math.PI : 0, 'screen', 0.5); Kit.keyboard(B, px, top, zz - side * 0.08, side > 0 ? Math.PI : 0); px += 0.6; }
      px += 0.06 + R() * 0.12;
    }
  }
}

// floor 48's specimen room, filled in around what's already there (tank bench, Voss's desk, window bench)
export function fillTankRoom(B, Y, ctx) {
  islandBench(B, -14.6, Y, -16.7, 3.6);
  islandBench(B, -4.6, Y, -16.7, 3.6);
  bsc(B, -18.8, Y, -8.55, Math.PI);
  freezer(B, -6.2, Y, -8.55, Math.PI); freezer(B, -5.2, Y, -8.55, Math.PI);
  gasCylinders(B, -0.42, Y, -20.4, 3, Math.PI / 2);
  cart(B, -11.4, Y, -14.3, 0.3);
  bioBin(B, -12.4, Y, -11.6); bioBin(B, -2.2, Y, -14.9); bioBin(B, -19.9, Y, -18.9);
  boxStack(B, -1.0, Y, -9.4, 3); boxStack(B, -1.5, Y, -9.5, 2); boxStack(B, -21.4, Y, -21.3, 2);
  // more on the window bench
  const wy = Y + 0.9375;
  hotplate(B, -6.8, wy, -20.85); tubeRack(B, -7.25, wy, -20.7); tipBox(B, -11.4, wy, -20.9); tipBox(B, -11.25, wy, -20.75);
  for (let i = 0; i < 6; i++) bottle(B, -6.4 + i * 0.12, wy, -21.05, 0.16, i % 3 ? 'amber' : 'clear');
  // signs
  ctx.labels.push({ text: 'BIOSAFETY LEVEL 2', x: -13.0, y: Y + 1.9, z: -8.07, rot: Math.PI, card: true });
  ctx.labels.push({ text: 'NO FOOD OR DRINK', x: -6.6, y: Y + 1.6, z: -8.07, rot: Math.PI, card: true, small: true });
  ctx.labels.push({ text: '-80°C  DO NOT OPEN', x: -5.7, y: Y + 2.1, z: -8.1, rot: Math.PI, card: true, small: true });
}
