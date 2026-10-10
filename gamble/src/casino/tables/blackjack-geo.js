// Blackjack table: a real 7-spot half-moon table (≈ 2.2 × 1.0 m, felt at 0.76 m) — printed felt,
// padded leather rail with brass piping, varnished wooden apron, dealer chip rack with chip rolls,
// a dealing shoe, the discard holder, drop slot + paddle, a limit sign, and seven casino chairs.
// Local frame (CONTRACT): players at +Z, dealer at −Z, first base on the dealer's left (+X).

import * as THREE from 'three';
import { DENOMS } from '../chips.js';
import {
  arcPath, sweep, mergeByMaterial, chairParts, placeParts, trs, M, printedFelt, addUv1, roundedBox, boxUV,
  arcText, paintFeltBase, stain, canvasTex, prism, addHull, addLocalBox,
} from './kit/furniture.js';
import { mat } from '../../gfx/materials.js';
import { money } from './strings.js';

const D2R = Math.PI / 180;

export const BJ = {
  feltY: 0.76,
  cz: -0.56, // arc centre (z)
  Rf: 0.98, // felt / rail inner radius
  Rr: 1.11, // rail outer radius
  zd: -0.47, // dealer edge
  seatA: [60, 40, 20, 0, -20, -40, -60].map((d) => d * D2R), // first base … third base
  Rbet: 0.79,
  betR: 0.054,
  Rcard: 0.645,
  Rstack: 0.912,
  RseatFeet: 1.235,
  RchairC: 1.37,
  seatH: 0.5,
  dealer: new THREE.Vector3(0, 0, -0.66),
  shoe: new THREE.Vector3(0.62, 0.76, -0.355),
  discard: new THREE.Vector3(-0.64, 0.76, -0.37),
  dealerCards: new THREE.Vector3(0, 0.76, -0.235),
  rack: { x0: -0.3, x1: 0.3, z0: -0.462, z1: -0.305 },
  drop: new THREE.Vector3(-0.42, 0.76, -0.4),
};
BJ.endA = Math.acos((BJ.zd - BJ.cz) / BJ.Rf);
BJ.endAr = Math.acos((BJ.zd - BJ.cz) / BJ.Rr);

/** Point on the layout at radius r and seat angle a (local). */
export function polar(r, a, y = BJ.feltY, out = new THREE.Vector3()) {
  return out.set(Math.sin(a) * r, y, BJ.cz + Math.cos(a) * r);
}

// ---- felt print ---------------------------------------------------------------------------------

const HALF = 1.12; // metres covered by each half texture
const PX = 1024 / HALF / 1000; // canvas px per mm

function paintBJFelt(g, w, h, xOrigin, { h17, min, max }) {
  paintFeltBase(g, w, h, '#0e5434', { pool: [xOrigin < 0 ? 1 : 0, 0.35], seed: xOrigin < 0 ? 3 : 4 });
  // Work in millimetres of table space.
  g.save();
  g.setTransform(PX, 0, 0, PX, -xOrigin * 1000 * PX, -BJ.zd * 1000 * PX);
  const cx = 0;
  const cy = BJ.cz * 1000;
  const gold = '#e2c272';
  const goldDim = 'rgba(226,194,114,0.85)';
  // Rail border line.
  g.strokeStyle = 'rgba(226,194,114,0.55)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.arc(cx, cy, 950, Math.PI / 2 - BJ.endA + 0.02, Math.PI / 2 + BJ.endA - 0.02);
  g.stroke();
  g.lineWidth = 0.8;
  g.beginPath();
  g.arc(cx, cy, 942, Math.PI / 2 - BJ.endA + 0.03, Math.PI / 2 + BJ.endA - 0.03);
  g.stroke();
  // Insurance band.
  const insA = 56 * D2R;
  g.strokeStyle = goldDim;
  g.lineWidth = 2.4;
  for (const r of [505, 568]) {
    g.beginPath();
    g.arc(cx, cy, r, Math.PI / 2 - insA, Math.PI / 2 + insA);
    g.stroke();
  }
  arcText(g, 'INSURANCE  PAYS  2  TO  1', cx, cy, 548, 0, { font: '700 30px "Playfair Display", Georgia, serif', color: gold, spacing: 1.08 });
  // Headline + dealer rule.
  arcText(g, 'BLACKJACK PAYS 3 TO 2', cx, cy, 462, 0, { font: '700 46px "Playfair Display", Georgia, serif', color: gold, spacing: 1.04 });
  arcText(g, h17 ? 'Dealer must hit soft 17' : 'Dealer must stand on all 17s', cx, cy, 405, 0, { font: 'italic 400 29px "Playfair Display", Georgia, serif', color: 'rgba(240,226,190,0.9)', spacing: 1.02 });
  // Small diamonds at the ends of the insurance band.
  for (const s of [-1, 1]) {
    const a = s * (insA + 0.035);
    const x = cx + Math.sin(a) * 536;
    const y = cy + Math.cos(a) * 536;
    g.save();
    g.translate(x, y);
    g.rotate(-a);
    g.fillStyle = gold;
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(8, 0);
    g.lineTo(0, 14);
    g.lineTo(-8, 0);
    g.closePath();
    g.fill();
    g.restore();
  }
  // Betting circles: white ring, thin gold inner ring, seat number below.
  BJ.seatA.forEach((a, i) => {
    const x = cx + Math.sin(a) * BJ.Rbet * 1000;
    const y = cy + Math.cos(a) * BJ.Rbet * 1000;
    // Worn felt where hands and chips rub.
    const wear = g.createRadialGradient(x, y, 20, x, y, 120);
    wear.addColorStop(0, 'rgba(255,255,255,0.05)');
    wear.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = wear;
    g.fillRect(x - 130, y - 130, 260, 260);
    g.strokeStyle = 'rgba(245,240,226,0.92)';
    g.lineWidth = 3.4;
    g.beginPath();
    g.arc(x, y, BJ.betR * 1000, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(226,194,114,0.7)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(x, y, BJ.betR * 1000 - 7, 0, Math.PI * 2);
    g.stroke();
    g.save();
    g.translate(x, y);
    g.rotate(-a);
    g.fillStyle = 'rgba(226,194,114,0.6)';
    g.font = '600 15px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(String(7 - i), 0, BJ.betR * 1000 + 26);
    g.restore();
  });
  // Limits printed small near the dealer's right (on real felts the sign carries them too).
  g.save();
  g.translate(cx - 690, BJ.zd * 1000 + 70);
  g.fillStyle = 'rgba(226,194,114,0.55)';
  g.font = '600 18px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(`${money(min)} – ${money(max)}`, 0, 0);
  g.restore();
  // The Eldorado name at both ends of the layout, reading toward the players.
  for (const s of [-1, 1]) {
    const a = s * 74 * D2R;
    g.save();
    g.translate(cx + Math.sin(a) * 640, cy + Math.cos(a) * 640);
    g.rotate(-a);
    g.fillStyle = 'rgba(226,194,114,0.75)';
    g.font = '700 30px "Playfair Display", Georgia, serif';
    g.textAlign = 'center';
    g.fillText('ELDORADO', 0, 0);
    g.font = '400 13px "Playfair Display", Georgia, serif';
    g.fillText('R E N O', 0, 20);
    g.restore();
  }
  // A couple of old drink rings near the rail and a cigarette burn — never too clean.
  stain(g, xOrigin < 0 ? -760 : 690, 160, 34, 0.06);
  stain(g, xOrigin < 0 ? -300 : 380, 300, 30, 0.05);
  g.fillStyle = 'rgba(20,12,6,0.35)';
  g.beginPath();
  g.ellipse(xOrigin < 0 ? -520 : 540, 420, 6, 3.5, 0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---- small canvas props -------------------------------------------------------------------------

function limitSignTex({ min, max, h17 }) {
  return canvasTex(512, 320, (g, w, h) => {
    g.fillStyle = '#0c0b0d';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8b25a';
    g.lineWidth = 10;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.lineWidth = 2;
    g.strokeRect(24, 24, w - 48, h - 48);
    g.fillStyle = '#d8b25a';
    g.textAlign = 'center';
    g.font = '700 40px "Playfair Display", Georgia, serif';
    g.fillText('BLACKJACK', w / 2, 82);
    g.fillStyle = '#f4ecd8';
    g.font = '400 30px "Bebas Neue", Inter, sans-serif';
    g.fillText('MINIMUM', w / 2 - 110, 140);
    g.fillText('MAXIMUM', w / 2 + 110, 140);
    g.font = '400 66px "Bebas Neue", Inter, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillText(money(min), w / 2 - 110, 205);
    g.fillText(money(max), w / 2 + 110, 205);
    g.fillStyle = '#d8b25a';
    g.font = 'italic 400 24px "Playfair Display", Georgia, serif';
    g.fillText(h17 ? 'Dealer hits soft 17 · 6 decks' : 'Dealer stands on all 17s · 6 decks', w / 2, 262);
  });
}

// ---- chip rolls in the dealer's rack -------------------------------------------------------------

function rackRolls(denoms, rack) {
  // Each channel holds a roll of chips lying on edge (upper half only — the lower half is in the
  // trough). Vertex colours: base colour, edge-spot colour, dark grooves between chips.
  const pos = [];
  const col = [];
  const idx = [];
  const R = 0.0195;
  const T = 0.0033;
  const n = denoms.length;
  const cw = (rack.x1 - rack.x0) / n;
  const len = rack.z1 - rack.z0 - 0.012;
  const per = Math.floor(len / T);
  const seg = 10;
  const tmp = new THREE.Color();
  denoms.forEach((v, ci) => {
    const d = DENOMS.find((x) => x.v === v);
    const base = new THREE.Color(d.color);
    const spot = new THREE.Color(d.stripe);
    const x = rack.x0 + cw * (ci + 0.5);
    const yc = BJ.feltY - 0.012;
    for (let k = 0; k < per; k++) {
      const z0 = rack.z0 + 0.006 + k * T;
      const z1 = z0 + T * 0.9;
      const phase = (k * 0.37) % 1;
      const start = pos.length / 3;
      for (let s = 0; s <= seg; s++) {
        const a = Math.PI * (s / seg); // 0..π over the top
        const px = x + Math.cos(a) * R;
        const py = yc + Math.sin(a) * R;
        const isSpot = Math.floor(((a / (Math.PI * 2)) * 6 + phase) * 2) % 2 === 0;
        tmp.copy(isSpot ? spot : base);
        for (const [z, dark] of [[z0, 0.55], [z0 + T * 0.18, 1], [z1 - T * 0.18, 1], [z1, 0.55]]) {
          pos.push(px, py, z);
          col.push(tmp.r * dark, tmp.g * dark, tmp.b * dark);
        }
      }
      for (let s = 0; s < seg; s++) {
        for (let r = 0; r < 3; r++) {
          const a = start + s * 4 + r;
          const b = start + (s + 1) * 4 + r;
          idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
    // Front chip face (the end of the roll the players see).
    const zf = rack.z0 + 0.006 + per * T;
    const c0 = pos.length / 3;
    pos.push(x, yc, zf);
    col.push(base.r, base.g, base.b);
    for (let s = 0; s <= seg; s++) {
      const a = Math.PI * (s / seg);
      pos.push(x + Math.cos(a) * R, yc + Math.sin(a) * R, zf);
      const inl = s % 2 ? spot : base;
      col.push(inl.r, inl.g, inl.b);
    }
    for (let s = 0; s < seg; s++) idx.push(c0, c0 + 1 + s, c0 + 2 + s);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 });
  m.name = 'chip-rolls';
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

// ---- build ------------------------------------------------------------------------------------

/**
 * Build the static table into `group`; returns { seats, statics, feltMeshes, shoeStack, discardStack,
 * colliders, chairColliders, dispose }.
 */
export function buildBlackjackTable(group, { physics, limits, h17, tier }) {
  const parts = [];
  const mats = {
    leather: M.leather(),
    wood: M.wood(),
    woodDark: M.woodDark(),
    brass: M.brass(),
    fabric: M.chairFabric(),
    base: M.base(),
    plastic: mat('plastic', { color: 0x141416, wear: 0.2, dirt: 0.2 }),
    trough: mat('plastic', { color: 0x1b1a19, wear: 0.4, dirt: 0.5 }),
  };
  const fy = BJ.feltY;
  const a1 = BJ.endA;
  const a2 = BJ.endAr;

  // Felt (two halves, each with its own 1024² print).
  const felts = [];
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    const xOrigin = side < 0 ? -HALF : 0;
    const pts = [];
    pts.push([0, BJ.zd]);
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const a = side * a1 * (1 - i / n);
      pts.push([Math.sin(a) * (BJ.Rf + 0.012), BJ.cz + Math.cos(a) * (BJ.Rf + 0.012)]);
    }
    if (side < 0) pts.reverse();
    shape.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], -pts[i][1]);
    const geo = new THREE.ShapeGeometry(shape, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, fy, 0);
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - xOrigin) / HALF, 1 - (p.getZ(i) - BJ.zd) / HALF);
    addUv1(geo, 0.45);
    const print = canvasTex(1024, 1024, (g, w, h) => paintBJFelt(g, w, h, xOrigin, { h17, ...limits }));
    const fm = new THREE.Mesh(geo, printedFelt(print));
    fm.receiveShadow = true;
    fm.name = 'felt';
    felts.push(fm);
  }

  // Padded rail + brass piping + apron.
  const railPath = arcPath(0, BJ.cz, BJ.Rf, -a1, a1, 72);
  const railProfile = [
    [-0.004, fy - 0.002], [0.0, fy + 0.03], [0.012, fy + 0.046], [0.035, fy + 0.054], [0.065, fy + 0.056],
    [0.095, fy + 0.051], [0.118, fy + 0.037], [0.13, fy + 0.012], [0.13, fy - 0.015], [0.118, fy - 0.03],
  ];
  parts.push({ geo: sweep(railPath, railProfile, { tile: 0.5, caps: true }), mat: mats.leather });
  const pipe = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pipe.push([-0.002 + Math.cos(a) * 0.0045, fy + 0.004 + Math.sin(a) * 0.0045]);
  }
  parts.push({ geo: sweep(railPath, pipe, { tile: 0.3 }), mat: mats.brass });
  const apronPath = arcPath(0, BJ.cz, BJ.Rf, -a2 + 0.01, a2 - 0.01, 72);
  parts.push({ geo: sweep(apronPath, [[0.116, fy - 0.03], [0.112, fy - 0.12], [0.1, fy - 0.135], [0.0, fy - 0.135]], { tile: 0.8, caps: true }), mat: mats.wood });
  // Dealer-side edge: wooden bumper the length of the table.
  const xEnd = Math.sin(a2) * BJ.Rr - 0.01;
  parts.push({ geo: boxUV(roundedBox(xEnd * 2, 0.15, 0.04, 0.01), 0.8), mat: mats.wood, matrix: trs(0, fy - 0.07 + 0.005, BJ.zd - 0.02) });
  parts.push({ geo: boxUV(roundedBox(xEnd * 2 - 0.02, 0.012, 0.03, 0.004), 0.5), mat: mats.brass, matrix: trs(0, fy + 0.006, BJ.zd - 0.018) });
  // Underside + pedestal legs.
  {
    const shape = new THREE.Shape();
    // rotateX(+90°) maps shape y → +z and faces the normal down.
    shape.moveTo(-xEnd, BJ.zd);
    for (let i = 0; i <= 48; i++) {
      const a = -a2 + (2 * a2 * i) / 48;
      shape.lineTo(Math.sin(a) * (BJ.Rr - 0.02), BJ.cz + Math.cos(a) * (BJ.Rr - 0.02));
    }
    const geo = new THREE.ShapeGeometry(shape, 1);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, fy - 0.135, 0);
    parts.push({ geo: boxUV(geo, 1), mat: mats.woodDark });
  }
  for (const sx of [-1, 1]) {
    parts.push({ geo: boxUV(roundedBox(0.14, fy - 0.15, 0.5, 0.02), 1), mat: mats.base, matrix: trs(sx * 0.55, (fy - 0.15) / 2, -0.12) });
    parts.push({ geo: boxUV(roundedBox(0.34, 0.03, 0.7, 0.01), 1), mat: mats.base, matrix: trs(sx * 0.55, 0.015, -0.12) });
  }

  // Dealer chip rack: wooden surround, troughs, brass lid rails, chip rolls.
  const rk = BJ.rack;
  const rw = rk.x1 - rk.x0;
  const rd = rk.z1 - rk.z0;
  parts.push({ geo: boxUV(roundedBox(rw + 0.03, 0.022, 0.012, 0.004), 0.5), mat: mats.wood, matrix: trs((rk.x0 + rk.x1) / 2, fy + 0.004, rk.z1 + 0.006) });
  parts.push({ geo: boxUV(roundedBox(rw + 0.03, 0.022, 0.012, 0.004), 0.5), mat: mats.wood, matrix: trs((rk.x0 + rk.x1) / 2, fy + 0.004, rk.z0 - 0.006) });
  for (const x of [rk.x0 - 0.009, rk.x1 + 0.009]) parts.push({ geo: boxUV(roundedBox(0.012, 0.022, rd + 0.024, 0.004), 0.5), mat: mats.wood, matrix: trs(x, fy + 0.004, (rk.z0 + rk.z1) / 2) });
  const rackDenoms = limits.min >= 25 ? [1000, 500, 100, 100, 100, 25, 25, 25, 5, 2.5] : [100, 100, 25, 25, 25, 5, 5, 5, 2.5, 1];
  const cw = rw / rackDenoms.length;
  for (let i = 0; i < rackDenoms.length; i++) {
    const x = rk.x0 + cw * (i + 0.5);
    parts.push({ geo: boxUV(new THREE.CylinderGeometry(0.022, 0.022, rd, 12, 1, true, Math.PI / 2, Math.PI), 0.3), mat: mats.trough, matrix: trs(x, fy - 0.012, (rk.z0 + rk.z1) / 2, Math.PI / 2, 0, 0) });
    if (i > 0) parts.push({ geo: boxUV(roundedBox(0.004, 0.006, rd, 0.0015), 0.3), mat: mats.brass, matrix: trs(rk.x0 + cw * i, fy + 0.002, (rk.z0 + rk.z1) / 2) });
  }
  const rolls = rackRolls(rackDenoms, rk);

  // Shoe (dealer's left): black acrylic body, slanted front, the stack of cards inside.
  const shoe = new THREE.Group();
  shoe.position.copy(BJ.shoe);
  shoe.rotation.y = -Math.PI / 2 - 0.25; // mouth toward the table centre / dealer's right
  {
    const prof = new THREE.Shape();
    // Side profile (x along the shoe: 0 = mouth, 0.2 = back; y up).
    prof.moveTo(0, 0);
    prof.lineTo(0.2, 0);
    prof.lineTo(0.2, 0.1);
    prof.lineTo(0.05, 0.1);
    prof.lineTo(0.0, 0.035);
    prof.closePath();
    const geo = new THREE.ExtrudeGeometry(prof, { depth: 0.1, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
    geo.translate(-0.02, 0, -0.05);
    const m = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    parts.push({ geo: boxUV(geo, 0.3), mat: mats.plastic, matrix: new THREE.Matrix4().compose(BJ.shoe, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, shoe.rotation.y, 0)), new THREE.Vector3(1, 1, 1)).multiply(m) });
    // Brass mouth plate.
    parts.push({ geo: boxUV(roundedBox(0.105, 0.006, 0.03, 0.002), 0.3), mat: mats.brass, matrix: new THREE.Matrix4().compose(BJ.shoe, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, shoe.rotation.y, 0)), new THREE.Vector3(1, 1, 1)).multiply(trs(0, 0.034, 0.02, -1.0)) });
  }
  // The visible card block inside the shoe (scaled by what's left).
  const paperMat = mat('paper', { color: 0xf2eee2, dirt: 0.15 });
  const stackGeo = boxUV(new THREE.BoxGeometry(0.066, 0.09, 0.16), 0.1);
  stackGeo.translate(0, 0, -0.08);
  const shoeStack = new THREE.Mesh(stackGeo, paperMat);
  shoeStack.position.copy(BJ.shoe).add(new THREE.Vector3(0, 0.052, 0));
  shoeStack.rotation.set(0, shoe.rotation.y + Math.PI / 2 + Math.PI / 2, 0);
  shoeStack.scale.set(1, 0.85, 1);

  // Discard holder: clear acrylic box + its card stack.
  const acrylic = new THREE.MeshStandardMaterial({ color: 0xdfe8ea, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false });
  acrylic.name = 'acrylic';
  const dbox = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.098), acrylic);
  dbox.position.copy(BJ.discard).add(new THREE.Vector3(0, 0.05, 0));
  dbox.renderOrder = 2;
  const discardStack = new THREE.Mesh(new THREE.BoxGeometry(0.064, 1, 0.089), paperMat);
  discardStack.position.copy(BJ.discard);
  discardStack.scale.y = 0.0001;

  // Drop slot + paddle, limit sign.
  parts.push({ geo: boxUV(roundedBox(0.16, 0.004, 0.035, 0.001), 0.3), mat: mats.plastic, matrix: trs(BJ.drop.x, fy + 0.001, BJ.drop.z) });
  parts.push({ geo: boxUV(roundedBox(0.17, 0.006, 0.045, 0.002), 0.3), mat: mats.brass, matrix: trs(BJ.drop.x, fy - 0.001, BJ.drop.z) });
  const paddle = new THREE.Mesh(roundedBox(0.03, 0.006, 0.17, 0.002), acrylic);
  paddle.position.set(BJ.drop.x - 0.13, fy + 0.004, BJ.drop.z + 0.02);
  paddle.rotation.y = 0.3;
  const sign = new THREE.Group();
  {
    const tex = limitSignTex({ ...limits, h17 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
    face.position.set(0, 0.075, 0.004);
    sign.add(face);
    const back = new THREE.Mesh(roundedBox(0.17, 0.11, 0.006, 0.002), mats.plastic);
    back.position.set(0, 0.075, 0);
    back.castShadow = true;
    sign.add(back);
    const foot = new THREE.Mesh(roundedBox(0.12, 0.02, 0.05, 0.004), mats.brass);
    foot.position.set(0, 0.01, 0);
    sign.add(foot);
    sign.position.set(-0.84, fy, -0.42);
    sign.rotation.set(-0.15, 0.55, 0);
  }

  // Chairs + seats.
  const seats = [];
  const chairColliders = [];
  const chairs = [];
  BJ.seatA.forEach((a, i) => {
    const feet = polar(BJ.RseatFeet, a, 0);
    const chairC = polar(BJ.RchairC, a, 0);
    const yaw = a + Math.PI; // facing the dealer
    const m = new THREE.Matrix4().compose(chairC, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));
    parts.push(...placeParts(chairParts(BJ.seatH, { fabric: mats.fabric, wood: mats.wood, brass: mats.brass }), m));
    chairs.push({ pos: chairC, yaw });
    // Close-up: over the right shoulder, looking down at the spot with the dealer up top.
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const right = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const cam = {
      pos: new THREE.Vector3(0, BJ.feltY, BJ.cz).addScaledVector(dir, 1.6).addScaledVector(right, 0.2).setY(1.36),
      target: new THREE.Vector3(0, 0, BJ.cz).addScaledVector(dir, 0.42).addScaledVector(right, 0.03).setY(0.86),
    };
    seats.push({
      pos: feet,
      yaw,
      height: BJ.seatH,
      cam,
      focus: chairC.clone().setY(BJ.seatH + 0.2),
      radius: 0.3,
      angle: a,
      spot: i,
    });
  });

  // Merge statics per material.
  const statics = mergeByMaterial(parts);
  for (const m of statics) group.add(m);
  group.add(...felts, rolls, shoeStack, dbox, discardStack, paddle, sign);
  for (const m of [shoeStack, discardStack, paddle]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }

  // Colliders (world): table body inside the rail, the dealer, each chair.
  group.updateWorldMatrix(true, true);
  const outline = [];
  for (let i = 0; i <= 24; i++) {
    const a = -a1 + (2 * a1 * i) / 24;
    outline.push({ x: Math.sin(a) * (BJ.Rf + 0.01), z: BJ.cz + Math.cos(a) * (BJ.Rf + 0.01) });
  }
  outline.push({ x: -xEnd, z: BJ.zd - 0.04 }, { x: xEnd, z: BJ.zd - 0.04 });
  const colliders = [];
  colliders.push(addHull(physics, group, prism(outline, 0, fy + 0.06)));
  colliders.push(addLocalBox(physics, group, BJ.dealer.x, 0.9, BJ.dealer.z - 0.05, 0.55, 1.8, 0.32));
  chairs.forEach((c) => {
    chairColliders.push(addLocalBox(physics, group, c.pos.x, BJ.seatH / 2 + 0.1, c.pos.z, 0.44, BJ.seatH + 0.2, 0.42, c.yaw));
  });

  return {
    seats,
    statics: [...statics, ...felts, rolls],
    shoeStack,
    discardStack,
    colliders: colliders.filter(Boolean),
    chairColliders,
    feltPrints: felts.map((f) => f.material.map),
    drawCalls: statics.length + felts.length + 1 + 6,
  };
}
