// Downtown blocks east of Virginia St (and the vista south of the train trench).
//
// SE block (x 11..90, z 11..104): RENO SOUVENIRS corner, Silver State Pawn, Silver Bells Wedding
//   Chapel, the closed LUCKY STRIKE CLUB (boarded, dead marquee, FOR LEASE), the National Bowling
//   Stadium with its silver dome behind them.
// NE block (x 11..90, z -108..-11): Hotel Sierra (7 storeys, vertical neon blade) with a tattoo
//   parlour and smoke shop, CHECKS CASHED, a public parking garage, ROW MARKET and the ROUND-UP
//   BAR on 4th, an old two-storey brick building with apartments.
// South of the trench (z > 134): Harrah's tower + neighbours closing the view through the arch.
// West of the Eldorado: its parking garage.

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { shopBuilding, addBuilding, buildingMats, faceFrame, facade, signPanel, onFace } from '../shared/buildings.js';
import { boxSign, bladeSign, neonOnFace } from '../shared/signkit.js';
import { channelLetters, litFaceMat } from '../shared/letters.js';
import { BulbSet, paintedSignMat, fitText } from '../shared/signs.js';
import { towerFacadeMat } from '../shared/facade.js';
import { tinted } from '../shared/batch.js';
import { parkedCar } from '../shared/vehicles.js';
import { propMats } from '../shared/props.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';

const Y0 = 0.15;

export function buildDowntown(ctx) {
  const rng = new Rng('downtown');
  const BM = buildingMats();
  const bulbs = new BulbSet({ radius: 0.055, pattern: 'chase', speed: 6, intensity: 8, dayIntensity: 0.12 });
  ctx.dtBulbs = bulbs;

  // ---------------------------------------------------------------- SE block, Virginia frontage
  // RENO SOUVENIRS — corner of 4th & Virginia (faces W and N).
  shopBuilding(ctx, {
    x0: 11, x1: 30, z0: 11, z1: 30, h: 8.2, tint: 0xd9b07a, wall: BM.stucco,
    street: ['W', 'N'],
    shop: { bays: 4, door: 'right', style: 'shop', glassTint: 0x8a9a9c, bulkheadTint: 0x8e2a22 },
    upper: { rows: 1, style: 'office', frame: 0x6a3a22, pitch: 3.4 },
    awning: { colors: ['#b8242a', '#efe7d6'], text: '', seed: 3 },
    sideWindows: null,
    sign: (f, side) => {
      boxSign(ctx, f, { x: (side === 'N' ? 19 : 18.4) / 2 + 0.3, y: 4.35, w: side === 'N' ? 15 : 14.6, h: 1.05, d: 0.25, text: t('reno.souvenir'), sub: t('reno.souvenir.sub'), bg: '#f6e7b8', fg: '#b8242a', subFg: '#1f3c78', border: '#1f3c78', lit: 1.6, key: `souv-${side}` });
    },
  });
  neonOnFace(ctx, faceFrame(11, 11.3, 11, 29.7, Y0), { key: 'souv-open', x: 4.0, y: 2.2, z: -0.07, worldW: 0.9, lines: [{ text: t('reno.open'), font: '400 150px "Bebas Neue"', size: 150, color: '#ff3b5c', y: 128 }], color: 0xff3b5c, backer: null, lightK: 4 });

  // SILVER STATE PAWN (one storey, tall parapet sign, bars, half shutters).
  shopBuilding(ctx, {
    x0: 11, x1: 27, z0: 30, z1: 42, h: 6.4, tint: 0x9a5a3c, wall: BM.brick,
    street: ['W'], parapet: 1.6,
    shop: { bays: 3, door: 'left', bars: true, style: 'shop', glassTint: 0x7a8a8c, bulkheadTint: 0x2a2a2a, doorShutter: 0.35 },
    band: { h: 1.4, tint: 0x1a1a1a },
    sign: (f) => {
      boxSign(ctx, f, { x: 5.7, y: 3.55, w: 10.8, h: 1.2, d: 0.2, text: t('reno.pawn.dt'), sub: t('reno.pawn.sub'), bg: '#111', fg: '#f3c537', subFg: '#f1efe7', lit: 1.8, key: 'pawn-dt', font: '"Bebas Neue"' });
      neonOnFace(ctx, f, { key: 'pawn-gold', x: 8.8, y: 2.0, z: -0.07, worldW: 1.6, lines: [{ text: 'WE BUY', font: '400 120px "Bebas Neue"', size: 120, color: '#ffd23a', y: 70 }, { text: 'GOLD', font: '400 130px "Bebas Neue"', size: 130, color: '#ffd23a', y: 190, channel: 1 }], color: 0xffc23a, backer: null, h: 256, w: 512, flicker: { broken: [1], deadMostly: false } });
    },
  });

  // SILVER BELLS WEDDING CHAPEL (white clapboard, steeple, script neon).
  const chapel = shopBuilding(ctx, {
    x0: 11, x1: 23, z0: 42, z1: 56, h: 5.6, tint: 0xf3efe6, wall: mat('painted-wood', { color: 0xf1ede4, wear: 0.4, dirt: 0.45, seed: 121 }),
    street: ['W'], parapet: 0.4,
    shop: { bays: 3, door: 'center', style: 'office', glassTint: 0xb6a7a9, bulkheadTint: 0xe8e0d4, glassDoor: false, doorTint: 0xf2eee6 },
    band: { h: 0.5, tint: 0xd7b6c0 },
    sign: (f) => {
      neonOnFace(ctx, f, { key: 'chapel', x: 6.7, y: 4.65, z: 0.1, worldW: 6.2, h: 200, lines: [{ text: t('reno.chapel'), font: 'italic 400 96px "Playfair Display"', size: 96, color: '#ff7ab8', y: 70 }, { text: t('reno.chapel.sub'), font: '400 64px "Bebas Neue"', size: 64, color: '#ffe8a6', y: 160, channel: 1 }], color: 0xff7ab8, backer: 0x2a1a22 });
    },
  });
  // Steeple on the chapel roof (box tower + pyramid roof + bell).
  {
    const wood = mat('painted-wood', { color: 0xf1ede4, wear: 0.4, dirt: 0.45, seed: 121 });
    const sx = 15;
    const sz = 49;
    const top = Y0 + 5.6;
    ctx.batch.add(new THREE.BoxGeometry(2.2, 3.2, 2.2).translate(sx, top + 1.6, sz), wood, {});
    ctx.batch.add(new THREE.ConeGeometry(1.8, 3.6, 4).rotateY(Math.PI / 4).translate(sx, top + 5.0, sz), mat('metal-painted', { color: 0x6b7a86, wear: 0.4, dirt: 0.4, seed: 122 }), {});
    ctx.batch.add(new THREE.BoxGeometry(1.4, 1.3, 2.3).translate(sx, top + 2.2, sz), BM.metal, { tint: 0x1a1a1a });
    ctx.batch.add(new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).translate(sx, top + 2.3, sz), mat('brass', { seed: 123 }), {});
    // Little heart neon over the door.
    neonOnFace(ctx, chapel.frames.W, { key: 'chapel-heart', x: 6.7, y: 3.15, z: 0.15, worldW: 0.9, w: 256, h: 256, lines: [{ text: '♥', font: '400 220px "Inter"', size: 220, color: '#ff3b6a', y: 140, fill: false }], color: 0xff3b6a, backer: null, lightK: 3 });
  }

  // LUCKY STRIKE CLUB — closed casino (4 storeys), boarded, dead marquee.
  const club = shopBuilding(ctx, {
    x0: 11, x1: 40, z0: 56, z1: 102, h: 15.5, tint: 0xc9b9a0, wall: BM.stucco, grime: 0.8,
    street: ['W'], shopTop: 4.4,
    shop: { bays: 8, door: 'center', boarded: true, style: 'dark', glassDoor: false, doorTint: 0x6f5a46, doorShutter: 1 },
    upper: { rows: 3, y0: 6.2, floor: 3.1, pitch: 3.0, style: 'dark', frame: 0x4a4038, boarded: true },
    band: { h: 0.6, tint: 0x8a7a64 },
    cornice: true,
    sideWindows: { cell: [3.0, 3.1], win: [1.2, 1.6], y0: Y0 + 6.2, y1: Y0 + 15, style: 'dark', glass: 0x3c4246, frame: 0x4a4038, seed: 3 },
  });
  {
    const f = club.frames.W;
    const len = 46 - 0.6;
    // Dead marquee canopy across the front: missing letters, broken bulb sockets.
    ctx.batch.add(new THREE.BoxGeometry(len - 6, 1.7, 2.6).translate(len / 2, 5.1, 1.3), BM.metal, { matrix: f.matrix, tint: 0x6e5a3e, grime: 0.6 });
    boxSign(ctx, f, { x: len / 2, y: 4.35, z: 2.0, w: len - 8, h: 1.3, d: 0.6, text: 'L CKY STR KE CLUB', bg: '#2a241c', fg: '#a8925c', key: 'club-dead', weather: { grime: 0.9, fade: 0.6, rust: 0.6, scratches: 0.8 } });
    // FOR LEASE banner on the upper floors.
    const banner = paintedSignMat('club-lease', 512, 128, (g, w, h) => {
      g.fillStyle = '#f2f0ea';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c4202b';
      g.font = '400 92px "Bebas Neue"';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t('reno.closed.lease'), w * 0.35, h / 2);
      g.fillStyle = '#1b1b1b';
      g.font = '400 44px "Bebas Neue"';
      g.fillText('775-555-0190', w * 0.78, h / 2);
    }, { weather: { grime: 0.5, fade: 0.4 } });
    const bg = new THREE.PlaneGeometry(9, 2.2, 8, 1);
    const p = bg.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 1.6) * 0.06);
    bg.computeVertexNormals();
    bg.translate(len / 2, 9.2, 0.08);
    ctx.batch.add(bg, banner, { matrix: f.matrix, uv: 'keep' });
    // Old vertical CLUB blade: dead neon on rusty cabinet.
    bladeSign(ctx, f, { x: 3.2, y: 6.4, w: 1.6, h: 7.2, text: 'CLUB', bg: '#2b2620', fg: '#7f6a48', border: '#5a4a34', key: 'club-blade', weather: { grime: 0.9, rust: 0.8, fade: 0.5 } });
    ctx.decalWalls = ctx.decalWalls || [];
    ctx.decalWalls.push({ frame: f, x0: 0.5, x1: len - 0.5, y0: 0.3, y1: 3.8, kinds: ['graffiti', 'graffiti', 'poster', 'poster', 'streak', 'grime'], n: 16 });
  }

  // National Bowling Stadium behind the Virginia frontage: big box + silver dome + marquee.
  bowlingStadium(ctx);

  // ---------------------------------------------------------------- NE block
  // Hotel Sierra: 7-storey brick hotel at 4th & Virginia (NE corner), vertical neon blade sign.
  const sierra = shopBuilding(ctx, {
    x0: 11, x1: 34, z0: -40, z1: -11, h: 23.5, tint: 0x8f4a32, wall: BM.brick,
    street: ['W', 'S'], shopTop: 4.0,
    shop: { bays: 6, door: 'center', style: 'shop', glassTint: 0x7a8a8c, bulkheadTint: 0x1e1e1e },
    upper: { rows: 6, y0: 5.6, floor: 3.0, pitch: 2.9, style: 'room', frame: 0xe8e2d4, h: 1.75 },
    band: { h: 0.8, tint: 0x2a2a2a },
    corniceTint: 0xd8cdb6,
    sign: (f, side) => {
      if (side === 'W') {
        boxSign(ctx, f, { x: 7.5, y: 3.1, w: 6.4, h: 0.75, d: 0.18, text: t('reno.tattoo'), bg: '#0d0d0d', fg: '#e8e2d4', key: 'tattoo', lit: 1.2, font: '"Rye"' });
        boxSign(ctx, f, { x: 21.2, y: 3.1, w: 6.2, h: 0.75, d: 0.18, text: t('reno.smoke'), bg: '#1b3b2a', fg: '#e9f2c8', key: 'smoke', lit: 1.4 });
        neonOnFace(ctx, f, { key: 'tattoo-open', x: 4.2, y: 2.0, z: -0.07, worldW: 0.85, lines: [{ text: t('reno.open'), font: '400 150px "Bebas Neue"', size: 150, color: '#36c8ff', y: 128 }], color: 0x36c8ff, backer: null, lightK: 3, flicker: { broken: [0] } });
        bladeSign(ctx, f, { x: 25.8, y: 7.5, w: 1.7, h: 12.5, text: 'HOTEL', bg: '#1a0f0c', fg: '#ff4433', border: '#ffcf6a', key: 'sierra-blade', lit: 2.6, bulbs, bulbColor: 0xffd890 });
      } else {
        boxSign(ctx, f, { x: 11.5, y: 3.1, w: 10, h: 0.75, d: 0.18, text: t('reno.hotel.sierra'), bg: '#1a0f0c', fg: '#ffcf6a', key: 'sierra-s', lit: 1.4, font: '"Playfair Display"', weight: 700 });
      }
    },
  });
  // Rooftop sign HOTEL SIERRA (steel frame + red channel letters) facing Virginia.
  {
    const f = sierra.frames.W;
    const steel = propMats().galv;
    const roofY = 23.5 + 0.9;
    for (const x of [6, 14, 22]) ctx.batch.add(new THREE.BoxGeometry(0.12, 3.6, 0.12).translate(x, roofY + 1.8, -1.2), steel, { matrix: f.matrix });
    ctx.batch.add(new THREE.BoxGeometry(17, 0.12, 0.12).translate(14, roofY + 0.6, -1.2), steel, { matrix: f.matrix });
    channelLetters(ctx, t('reno.hotel.sierra'), {
      font: '"Bebas Neue"', height: 2.4, depth: 0.25, tracking: 0.08,
      matrix: new THREE.Matrix4().multiplyMatrices(f.matrix, new THREE.Matrix4().makeTranslation(14, roofY + 0.75, -1.05)),
      face: litFaceMat(0xff3a2a, { k: 3.4, dayColor: 0xa8261c }), side: BM.metal, bulbs, spacing: 0.26, bulbColor: 0xffd890,
    });
    ctx.lights.push({ pos: onFace(f, 14, roofY + 2, 1), color: 0xff4a3a, intensity: 18, distance: 20, kind: 'neon', width: 8, groundY: 0, realLight: false, poolK: 0.3 });
  }

  // CHECKS CASHED (one storey, loud yellow).
  shopBuilding(ctx, {
    x0: 11, x1: 28, z0: -62, z1: -40, h: 5.4, tint: 0xd8d0bc, wall: BM.cinder,
    street: ['W'], parapet: 1.2,
    shop: { bays: 4, door: 'left', bars: true, style: 'office', glassTint: 0x8a9a9c, bulkheadTint: 0x333333 },
    band: { h: 1.2, tint: 0x1a1a1a },
    sign: (f) => {
      boxSign(ctx, f, { x: 11.2, y: 3.5, w: 19, h: 1.2, d: 0.2, text: t('reno.checks'), sub: t('reno.checks.sub'), bg: '#f5c518', fg: '#141414', subFg: '#8a1010', lit: 1.6, key: 'checks' });
      neonOnFace(ctx, f, { key: 'atm', x: 3.0, y: 2.0, z: -0.07, worldW: 0.8, lines: [{ text: t('reno.atm'), font: '400 150px "Bebas Neue"', size: 150, color: '#39ff7a', y: 128 }], color: 0x39ff7a, backer: null, lightK: 3 });
    },
  });

  // Public parking garage (open decks, cars inside, fluorescent strips).
  parkingGarage(ctx, { x0: 11, x1: 58, z0: -106, z1: -64, levels: 4 });

  // 4th St frontage of the NE block: ROW MARKET, ROUND-UP BAR, old brick building w/ apartments.
  shopBuilding(ctx, {
    x0: 36, x1: 54, z0: -30, z1: -11, h: 5.2, tint: 0xd2c7b0, wall: BM.cinder,
    street: ['S'], parapet: 1.0,
    shop: { bays: 4, door: 'center', bars: false, style: 'shop', glassTint: 0x8a9a9c, bulkheadTint: 0x7a2a1e },
    band: { h: 1.1, tint: 0x1a1a1a },
    sign: (f) => {
      boxSign(ctx, f, { x: 9, y: 3.45, w: 15, h: 1.1, d: 0.2, text: t('reno.market'), sub: t('reno.market.sub'), bg: '#fdfbf4', fg: '#b3221b', subFg: '#1f3c78', lit: 1.8, key: 'market' });
      neonOnFace(ctx, f, { key: 'market-beer', x: 3.0, y: 1.9, z: -0.07, worldW: 1.4, w: 512, h: 256, lines: [{ text: 'COLD', font: '400 110px "Bebas Neue"', size: 110, color: '#5ad0ff', y: 70 }, { text: 'BEER', font: '400 120px "Bebas Neue"', size: 120, color: '#ff5a3a', y: 190, channel: 1 }], color: 0x5ad0ff, backer: null, lightK: 4 });
    },
  });
  shopBuilding(ctx, {
    x0: 55, x1: 68, z0: -30, z1: -11, h: 5.0, tint: 0x5a3a2a, wall: mat('painted-wood', { color: 0x5a3a2a, wear: 0.6, dirt: 0.6, seed: 124 }),
    street: ['S'], parapet: 1.4,
    shop: { bays: 2, door: 'right', style: 'dark', glassTint: 0x6a5a40, bulkheadTint: 0x2a1a10, glassDoor: false, doorTint: 0x3a2214 },
    band: { h: 1.3, tint: 0x2a1a10 },
    sign: (f) => {
      neonOnFace(ctx, f, { key: 'roundup', x: 6.5, y: 4.35, z: 0.2, worldW: 6.2, h: 220, lines: [{ text: t('reno.bar.roundup'), font: '400 130px "Rye"', size: 130, color: '#ff8a2a', y: 110 }], color: 0xff8a2a, backer: 0x1a0f08, flicker: { broken: [0] } });
      for (const [x, txt, col] of [[2.4, 'COORS', '#ff4040'], [9.6, 'BUD', '#40a0ff']]) {
        neonOnFace(ctx, f, { key: `bar-${txt}`, x, y: 2.0, z: -0.07, worldW: 1.1, w: 512, h: 256, lines: [{ text: txt, font: '400 150px "Bebas Neue"', size: 150, color: col, y: 128 }], color: new THREE.Color(col).getHex(), backer: null, lightK: 3 });
      }
    },
  });
  shopBuilding(ctx, {
    x0: 69, x1: 90, z0: -34, z1: -11, h: 9.6, tint: 0xa8644a, wall: BM.brick,
    street: ['S'], shopTop: 3.8,
    shop: { bays: 4, door: 'left', style: 'shop', glassTint: 0x8a9a9c, bulkheadTint: 0x2a2a2a, shutter: 0.5 },
    upper: { rows: 1, y0: 5.4, pitch: 3.0, style: 'room', frame: 0xe6dccb, h: 2.0 },
    band: { h: 0.8, tint: 0x22201c },
    sign: (f) => boxSign(ctx, f, { x: 10.5, y: 3.0, w: 9, h: 0.7, d: 0.15, text: 'ANTIQUES · COLLECTIBLES', bg: '#e8dcc4', fg: '#4a2a18', key: 'antiques', font: '"Playfair Display"', weight: 700 }),
  });
  // Back of the NE block: generic 3–5 storey buildings with shader windows.
  for (const [x0, x1, z0, z1, h, tint] of [[34, 62, -62, -36, 13, 0xb9a58a], [62, 90, -62, -38, 9, 0xa86a50], [60, 90, -106, -64, 16, 0xc8c0b0]]) {
    addBuilding(ctx, { x0, x1, z0, z1, h, tint, wall: tint === 0xa86a50 ? BM.brick : BM.stucco, sideWindows: { cell: [3.2, 3.2], win: [1.3, 1.7], y0: Y0 + 3.6, y1: Y0 + h - 1, style: rng.chance(0.5) ? 'room' : 'office', glass: 0x5d6a72, frame: 0x3a3a36, seed: x0 } });
  }
  // SE block back lot buildings near 4th & Lake.
  addBuilding(ctx, { x0: 30, x1: 42, z0: 11, z1: 24, h: 4.2, tint: 0xcfc6b0, wall: BM.cinder, faces: { N: shopFace(ctx, 12, { style: 'dark', boarded: true }) } });

  // ---------------------------------------------------------------- South of the trench
  harrahs(ctx);
  // West side of Virginia south of the trench: closed casino + office block.
  addBuilding(ctx, { x0: -70, x1: -11, z0: 138, z1: 182, h: 28, tint: 0xd8cbb4, wall: BM.stucco, sideWindows: { cell: [3.0, 3.2], win: [1.4, 1.9], y0: Y0 + 6, y1: Y0 + 27, style: 'office', glass: 0x56636c, frame: 0x6a5848, seed: 41 } });
  // Eldorado parking garage west of the casino.
  parkingGarage(ctx, { x0: -140, x1: -84, z0: 14, z1: 98, levels: 5, sign: false });

  ctx.extraMeshes.push(bulbs.build('downtown-bulbs'));
}

// Plain shop face spec for addBuilding.
function shopFace(ctx, len, { style = 'shop', boarded = false } = {}) {
  const openings = [];
  const n = Math.max(1, Math.round(len / 4));
  const bw = (len - 0.6) / n;
  for (let i = 0; i < n; i++) openings.push({ kind: boarded ? 'boarded' : 'shop', x0: 0.3 + i * bw + 0.25, x1: 0.3 + (i + 1) * bw - 0.25, y0: 0.7, y1: 3.0, style });
  return { openings };
}

function bowlingStadium(ctx) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const x0 = 46;
  const x1 = 89;
  const z0 = 26;
  const z1 = 102;
  const H = 17;
  const panel = mat('aluminum', { wear: 0.3, dirt: 0.4, seed: 131 });
  addBuilding(ctx, {
    x0, x1, z0, z1, h: H, tint: 0xd6d2c8, wall: BM.concrete, parapet: 0.6,
    sideWindows: { cell: [4.0, 4.2], win: [3.4, 0.9], y0: Y0 + 12, y1: Y0 + 14, style: 'office', glass: 0x6d7f8c, frame: 0x9a9a96, seed: 51 },
    faces: {
      N: {
        openings: [
          { kind: 'door', x0: 16, x1: 21, y0: 0, y1: 3.2, style: 'office' },
          { kind: 'door', x0: 22, x1: 27, y0: 0, y1: 3.2, style: 'office' },
          { kind: 'shop', x0: 4, x1: 15, y0: 0.6, y1: 4.2, style: 'office', mullions: 4 },
          { kind: 'shop', x0: 28, x1: 39, y0: 0.6, y1: 4.2, style: 'office', mullions: 4 },
        ],
        bands: [{ y: 4.6, h: 0.5, d: 0.6, mat: panel, tint: 0xffffff }],
      },
    },
  });
  // Silver dome on a short drum.
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2 + 6;
  const R = 15;
  batch.add(new THREE.CylinderGeometry(R, R, 2.5, 48).translate(cx, Y0 + H + 1.25, cz), BM.concrete, { chunk: 'landmark' });
  const dome = new THREE.SphereGeometry(R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(cx, Y0 + H + 2.5, cz);
  batch.add(dome, panel, { chunk: 'landmark', uv: 3 });
  // Geodesic-ish facets: latitude rings.
  for (let k = 1; k < 6; k++) {
    const phi = (k / 6) * (Math.PI / 2);
    batch.add(new THREE.TorusGeometry(R * Math.cos(phi) + 0.05, 0.08, 4, 48).rotateX(Math.PI / 2).translate(cx, Y0 + H + 2.5 + Math.sin(phi) * R * 0.7, cz), BM.metal, { tint: 0x8a8e92, chunk: 'landmark' });
  }
  // Big name on the north face + marquee screen.
  const f = faceFrame(x1, z0, x0, z0, Y0);
  channelLetters(ctx, t('reno.bowling.name'), {
    font: '"Bebas Neue"', height: 1.9, depth: 0.2, tracking: 0.06,
    matrix: new THREE.Matrix4().multiplyMatrices(f.matrix, new THREE.Matrix4().makeTranslation((x1 - x0) / 2, 8.2, 0.05)),
    face: litFaceMat(0xdfe8ff, { k: 2.6, dayColor: 0x1e2e4e, metal: 0.3 }), side: panel,
  });
  lights.push({ pos: onFace(f, (x1 - x0) / 2, 9, 1.2), color: 0xd8e4ff, intensity: 14, distance: 18, kind: 'neon', width: 14, groundY: Y0, realLight: false });
  colliders.aabb(x0, Y0, z0, x1, Y0 + H, z1);
}

function parkingGarage(ctx, { x0, x1, z0, z1, levels = 4, sign = true }) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const fh = 3.1;
  const H = levels * fh + 1.1;
  const deck = BM.concrete;
  const col = BM.board;
  const rng = new Rng(`garage${x0}`);
  // Slabs, spandrels (open between), columns; ground level is open to the street at the entry.
  for (let l = 1; l <= levels; l++) {
    const y = Y0 + l * fh;
    batch.add(new THREE.BoxGeometry(x1 - x0, 0.35, z1 - z0).translate((x0 + x1) / 2, y - 0.175, (z0 + z1) / 2), deck, { castShadow: true });
    // Spandrel walls around the perimeter (1.05 m tall) — openings above them.
    for (const [cx, cz, w, d] of [[(x0 + x1) / 2, z0 + 0.15, x1 - x0, 0.3], [(x0 + x1) / 2, z1 - 0.15, x1 - x0, 0.3], [x0 + 0.15, (z0 + z1) / 2, 0.3, z1 - z0 - 0.6], [x1 - 0.15, (z0 + z1) / 2, 0.3, z1 - z0 - 0.6]]) {
      batch.add(new THREE.BoxGeometry(w, 1.05, d).translate(cx, y + 0.525, cz), col, { grime: 0.4, grimeBase: y, tint: 0xd8d4cc });
    }
    // Fluorescent strips under the slab (visible at night through the openings).
    for (let x = x0 + 4; x < x1 - 2; x += 8) {
      for (let z = z0 + 4; z < z1 - 2; z += 7) {
        batch.add(new THREE.BoxGeometry(1.2, 0.06, 0.12).translate(x, y - 0.39, z), fluoro(), { castShadow: false });
      }
    }
    // Cars parked on the deck along the edges.
    for (let x = x0 + 3; x < x1 - 3; x += 2.8) {
      if (rng.chance(0.45)) parkedCar(batch, ctx.colliders, { x, y, z: z0 + 3.2, ry: Math.PI / 2, type: rng.pick(['sedan', 'coupe', 'pickup', 'wagon']), seed: rng.int(1, 9999) });
      if (rng.chance(0.4)) parkedCar(batch, ctx.colliders, { x, y, z: z1 - 3.2, ry: -Math.PI / 2, type: rng.pick(['sedan', 'coupe', 'van']), seed: rng.int(1, 9999) });
    }
  }
  // Columns grid.
  for (let x = x0 + 0.4; x <= x1 - 0.4; x += (x1 - x0 - 0.8) / Math.round((x1 - x0) / 8.5)) {
    for (const z of [z0 + 0.4, z1 - 0.4, (z0 + z1) / 2]) {
      batch.add(new THREE.BoxGeometry(0.6, H - 0.4, 0.6).translate(x, Y0 + (H - 0.4) / 2, z), col, { tint: 0xd8d4cc, grime: 0.6, grimeBase: Y0 });
      colliders.box(x, Y0 + (H - 0.4) / 2, z, 0.6, H - 0.4, 0.6);
    }
  }
  // Roof parapet + light poles on the top deck.
  const roofY = Y0 + levels * fh;
  // Ground level: low wall along the street sides with an entry gap, and the colliders.
  colliders.aabb(x0, Y0 + fh - 0.35, z0, x1, roofY + 1.05, z1);
  colliders.aabb(x0, Y0, z0, x1, Y0 + 1.1, z0 + 0.3);
  colliders.aabb(x0, Y0, z1 - 0.3, x1, Y0 + 1.1, z1);
  colliders.aabb(x0, Y0, z0, x0 + 0.3, Y0 + 1.1, z1);
  colliders.aabb(x1 - 0.3, Y0, z0, x1, Y0 + 1.1, z1);
  for (const [cx, cz, w, d] of [[(x0 + x1) / 2, z0 + 0.15, x1 - x0, 0.3], [(x0 + x1) / 2, z1 - 0.15, x1 - x0, 0.3], [x0 + 0.15, (z0 + z1) / 2, 0.3, z1 - z0 - 0.6], [x1 - 0.15, (z0 + z1) / 2, 0.3, z1 - z0 - 0.6]]) {
    batch.add(new THREE.BoxGeometry(w, 1.05, d).translate(cx, Y0 + 0.525, cz), col, { grime: 0.6, grimeBase: Y0, tint: 0xd8d4cc });
  }
  if (sign) {
    const f = faceFrame(x0, z0, x0, z1, Y0);
    boxSign(ctx, f, { x: 6, y: 4.0, w: 9, h: 1.5, d: 0.3, text: t('reno.parking'), sub: t('reno.parking.rate'), bg: '#1b4f9c', fg: '#ffffff', subFg: '#ffd23a', lit: 1.8, key: 'garage-sign' });
    // Big blue P blade.
    bladeSign(ctx, f, { x: 2, y: 3.5, w: 1.5, h: 4.5, text: 'P', bg: '#1b4f9c', fg: '#ffffff', key: 'garage-p', lit: 2 });
  }
  lights.push({ pos: new THREE.Vector3((x0 + x1) / 2, Y0 + fh * 1.5, z0), color: 0xdff0e8, intensity: 6, distance: 10, kind: 'ad', groundY: Y0, realLight: false, reflect: false });
}

let fl = null;
function fluoro() {
  if (!fl) {
    fl = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8fff4, emissiveIntensity: 3.2, roughness: 0.5 });
    fl.name = 'fluorescent';
  }
  return fl;
}

function harrahs(ctx) {
  const { batch, lights } = ctx;
  const BM = buildingMats();
  // Base + tower on the east side of Virginia south of the trench, closing the arch vista.
  addBuilding(ctx, { x0: 11, x1: 70, z0: 138, z1: 182, h: 14, tint: 0xe9e3d8, wall: BM.stucco, sideWindows: { cell: [3.6, 3.4], win: [2.6, 1.4], y0: Y0 + 5, y1: Y0 + 13, style: 'casino', glass: 0x6a5a5a, frame: 0xa01c22, seed: 61 } });
  const tx0 = 24;
  const tx1 = 52;
  const tz0 = 150;
  const tz1 = 172;
  const tb = Y0 + 14;
  const tt = tb + 62;
  const red = mat('metal-painted', { color: 0xa01c22, wear: 0.3, dirt: 0.35, seed: 141 });
  const tw = towerFacadeMat({ wall: tinted(BM.stucco), cell: [2.4, 3.1], win: [1.6, 1.9], y0: tb + 1, y1: tt - 4, style: 'room', glass: 0x56606a, frame: 0xa01c22, bands: 0xe9e3d8, seed: 71 });
  batch.add(new THREE.BoxGeometry(tx1 - tx0, tt - tb, tz1 - tz0).translate((tx0 + tx1) / 2, (tb + tt) / 2, (tz0 + tz1) / 2), tw, { tint: 0xf0ebe2, chunk: 'landmark' });
  batch.add(new THREE.BoxGeometry(tx1 - tx0 + 0.8, 3.2, tz1 - tz0 + 0.8).translate((tx0 + tx1) / 2, tt + 1.6, (tz0 + tz1) / 2), red, { tint: 0xffffff, chunk: 'landmark' });
  const face = litFaceMat(0xffffff, { k: 3.4, dayColor: 0xf6f2ea, metal: 0.1 });
  channelLetters(ctx, t('reno.harrahs.name'), {
    font: '"Playfair Display"', weight: 700, height: 2.4, depth: 0.25, tracking: 0.08,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI).setPosition((tx0 + tx1) / 2, tt + 0.4, tz0 - 0.45),
    face, side: red, chunk: 'landmark',
  });
  // Ground-floor marquee facing Virginia (west).
  const f = faceFrame(11, 182, 11, 138, Y0);
  boxSign(ctx, f, { x: 22, y: 4.4, w: 22, h: 2.2, d: 0.6, text: t('reno.harrahs.name'), bg: '#a01c22', fg: '#ffffff', key: 'harrahs-marquee', lit: 2.2, font: '"Playfair Display"', weight: 700 });
  const b = new BulbSet({ radius: 0.07, pattern: 'chase', speed: 8, intensity: 9, dayIntensity: 0.15 });
  for (let x = 11; x <= 33; x += 0.3) {
    b.add(onFace(f, x, 4.3, 0.7), Math.round(x / 0.3), 0xfff0c8);
    b.add(onFace(f, x, 6.7, 0.7), Math.round(x / 0.3), 0xfff0c8);
  }
  ctx.extraMeshes.push(b.build('harrahs-bulbs'));
  lights.push({ pos: onFace(f, 22, 5.5, 1.5), color: 0xff6a6a, intensity: 16, distance: 18, kind: 'neon', width: 14, groundY: Y0 });
  void fitText;
  void signPanel;
  void facade;
}
