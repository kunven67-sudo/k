// E 4th St east of Lake St — the gritty old motel strip (the Starlite's neighbourhood).
//
// North side (street face at z ≈ -11..-14): 4TH ST LIQUOR & DELI, the Lucky Spur motel,
//   [Starlite lot x 180..230 — reserved for the motel builder], A-1 BAIL BONDS, 4TH ST PAWN.
// South side (street face at z ≈ 11..14): a fenced vacant lot, the Desert Rose motel, the
//   SUNRISE DINER (24 hrs), the Silver Dollar motel.
// Motels are real two-storey room wings with an upper walkway, steel stairs, numbered doors,
// window AC units, an office with an ice machine, and a roadside neon pole sign with
// VACANCY / NO VACANCY and a chasing arrow.
//
//   STRIP_LOTS — lot surfaces (asphalt / dirt) handed to the ground builder.
//   buildStrip(ctx)

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { shopBuilding, addBuilding, buildingMats, faceFrame, facade, onFace, awning, awningMat } from '../shared/buildings.js';
import { boxSign, neonOnFace, poleSign } from '../shared/signkit.js';
import { paintedSignMat, fitText } from '../shared/signs.js';
import { Props, propMats } from '../shared/props.js';
import { parkedCar } from '../shared/vehicles.js';
import { addWeeds } from '../shared/flora.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';

const Y0 = 0.15;

// Surfaces for the ground builder (lot cells only; roads/sidewalks are unaffected).
export const STRIP_LOTS = [
  { x0: 110, x1: 136, z0: -16, z1: -11, kind: 'parking' },
  { x0: 147, x1: 179, z0: -58, z1: -11, kind: 'parking' },
  { x0: 231, x1: 262, z0: -40, z1: -11, kind: 'parking' },
  { x0: 110, x1: 149, z0: 11, z1: 60, kind: 'dirt' },
  { x0: 150, x1: 185, z0: 11, z1: 30, kind: 'parking' },
  { x0: 186, x1: 215, z0: 11, z1: 21, kind: 'parking' },
  { x0: 216, x1: 249, z0: 11, z1: 60, kind: 'parking' },
];

export function buildStrip(ctx) {
  const rng = new Rng('strip');
  const BM = buildingMats();
  const P = new Props(ctx);
  ctx.stripProps = P;

  // ---------------------------------------------------------------- north side
  // 4TH ST LIQUOR & DELI: cinderblock box set back behind a small apron, bars on everything.
  shopBuilding(ctx, {
    x0: 110, x1: 136, z0: -34, z1: -16, h: 5.2, tint: 0xe2dccd, wall: BM.cinder,
    street: ['S'], parapet: 1.3, grime: 0.8,
    shop: { bays: 5, door: 'right', bars: true, style: 'shop', glassTint: 0x8a9a9c, bulkheadTint: 0x7b2a1f },
    band: { h: 1.3, tint: 0x16120e },
    sign: (f) => {
      boxSign(ctx, f, { x: 13, y: 3.45, w: 20, h: 1.2, d: 0.2, text: t('reno.liquor.store'), bg: '#f4efe2', fg: '#c11f1f', lit: 1.8, key: 'liquor-band', border: '#1d1d1d' });
      neonOnFace(ctx, f, { key: 'liq-lotto', x: 4.6, y: 1.9, z: -0.07, worldW: 1.5, w: 512, h: 256, lines: [{ text: 'ICE', font: '400 130px "Bebas Neue"', size: 130, color: '#5ad0ff', y: 70 }, { text: 'CIGARETTES', font: '400 80px "Bebas Neue"', size: 80, color: '#ff4a4a', y: 190, channel: 1 }], color: 0x5ad0ff, backer: null, lightK: 3 });
      neonOnFace(ctx, f, { key: 'liq-open', x: 18.2, y: 2.0, z: -0.07, worldW: 0.85, lines: [{ text: t('reno.open'), font: '400 150px "Bebas Neue"', size: 150, color: '#ff2f4a', y: 128 }], color: 0xff2f4a, backer: null, lightK: 3, flicker: { broken: [0] } });
    },
  });
  poleSign(ctx, {
    x: 112.6, z: -12.2, ry: 0, h: 8.5, w: 4.2, signH: 1.8, key: 'liquor-pole',
    draw: (g, w, h) => {
      g.fillStyle = '#c11f1f';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff6dc';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `400 ${h * 0.82}px "Bebas Neue"`;
      g.fillText(t('reno.liquor'), w / 2, h * 0.55);
    },
    neon: { lines: [{ text: 'BEER · WINE · DELI', font: '400 120px "Bebas Neue"', size: 120, color: '#7cf4ff', y: 128 }], worldW: 3.6, y: 5.9 },
    lightColor: 0xff5a4a,
  });

  // Lucky Spur motel: room wing along the west edge, office at the street, lot to the east.
  motel(ctx, P, rng, {
    key: 'spur', name: t('reno.motel.spur'), wing: { x0: 137, x1: 147, z0: -58, z1: -20 }, facing: 'E',
    office: { x0: 137, x1: 147, z0: -19, z1: -12 }, colors: { wall: 0xe7c9a1, trim: 0x2f6f6a, doors: [0x2f6f6a, 0xa8402e, 0xd8a43a] },
    sign: { x: 176.4, z: -12.3, script: true, color: '#ff4fa0', vacancy: true },
    roomStart: 1, lot: { x0: 148, x1: 178, z0: -56, z1: -13 },
  });

  // A-1 BAIL BONDS: a small converted house with a gable roof and a huge banner sign.
  {
    const b = addBuilding(ctx, {
      x0: 233, x1: 245, z0: -27, z1: -15, h: 3.6, tint: 0xd8d0b8, wall: mat('painted-wood', { color: 0xd8d0b8, wear: 0.6, dirt: 0.55, seed: 151 }), parapet: 0,
      faces: { S: { openings: [{ kind: 'door', x0: 5.1, x1: 6.1, y0: 0, y1: 2.2, glassDoor: false, doorTint: 0x7a2a1f }, { kind: 'window', x0: 1.2, x1: 3.6, y0: 0.9, y1: 2.3, style: 'office', bars: true, frame: 0xf0ece0 }, { kind: 'window', x0: 7.6, x1: 10.6, y0: 0.9, y1: 2.3, style: 'office', bars: true, frame: 0xf0ece0 }] } },
    });
    gableRoof(ctx, { x0: 232.6, x1: 245.4, z0: -27.4, z1: -14.6, y: Y0 + 3.6, rise: 2.2, along: 'x', tint: 0x4a3a30 });
    const f = b.frames.S;
    // Freestanding banner frame on two posts in front.
    poleSign(ctx, {
      x: 239, z: -12.6, ry: 0, h: 5.2, w: 7.2, signH: 2.4, twin: true, key: 'bail',
      draw: (g, w, h) => {
        g.fillStyle = '#f6d32a';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#141414';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        let s = fitText(g, t('reno.bail'), w * 0.92, h * 0.55, (z) => `400 ${z}px "Bebas Neue"`);
        g.font = `400 ${s}px "Bebas Neue"`;
        g.fillText(t('reno.bail'), w / 2, h * 0.36);
        g.fillStyle = '#b3141b';
        s = fitText(g, t('reno.bail.sub'), w * 0.9, h * 0.22, (z) => `400 ${z}px "Bebas Neue"`);
        g.font = `400 ${s}px "Bebas Neue"`;
        g.fillText(t('reno.bail.sub'), w / 2, h * 0.78);
      },
      lit: 1.4, lightColor: 0xffe08a,
    });
    neonOnFace(ctx, f, { key: 'bail-open', x: 2.4, y: 1.6, z: -0.07, worldW: 0.8, lines: [{ text: t('reno.open'), font: '400 150px "Bebas Neue"', size: 150, color: '#ff3040', y: 128 }], color: 0xff3040, backer: null, lightK: 2.5 });
  }

  // 4TH ST PAWN (one storey, tall false front).
  shopBuilding(ctx, {
    x0: 247, x1: 262, z0: -32, z1: -13, h: 6.8, tint: 0x7d8a6a, wall: BM.stucco, grime: 0.85,
    street: ['S'], parapet: 1.8,
    shop: { bays: 3, door: 'left', bars: true, style: 'shop', glassTint: 0x8a9a9c, bulkheadTint: 0x1a1a1a, shutter: 0.25 },
    band: { h: 1.6, tint: 0x111111 },
    sign: (f) => {
      boxSign(ctx, f, { x: 7.5, y: 3.5, w: 13.6, h: 1.45, d: 0.2, text: t('reno.pawn.strip'), sub: t('reno.pawn.strip.sub'), bg: '#0f0f0f', fg: '#ffd23a', subFg: '#ff5a3a', lit: 1.8, key: 'pawn-strip' });
    },
  });

  // East end filler on the north side.
  shopBuilding(ctx, {
    x0: 263, x1: 296, z0: -30, z1: -12, h: 5.0, tint: 0xb9b2a2, wall: BM.cinder, grime: 0.8,
    street: ['S'], parapet: 1.0,
    shop: { bays: 6, door: 'center', boarded: true, style: 'dark', glassDoor: false, doorTint: 0x5a5046, doorShutter: 1 },
    band: { h: 1.0, tint: 0x3a3630 },
  });

  // ---------------------------------------------------------------- south side
  // Vacant lot: chain-link with barbed wire along the sidewalk, sale + no-trespassing signs.
  P.chainFence([[110.4, 11.4], [148.6, 11.4], [148.6, 58], [110.4, 58], [110.4, 11.4]], { gaps: [] });
  {
    const f = faceFrame(110.4, 11.38, 148.6, 11.38, Y0);
    // Signs zip-tied to the fence (face north = the street side: use a frame facing -z).
    const fn = faceFrame(148.6, 11.33, 110.4, 11.33, Y0);
    boxSign(ctx, fn, { x: 14, y: 1.0, w: 2.4, h: 1.2, d: 0.02, text: t('reno.vacant.sale'), bg: '#f3f1ea', fg: '#1b4f9c', key: 'vacant-sale', cabinet: 0xdedad0, weather: { grime: 0.5, fade: 0.6 } });
    boxSign(ctx, fn, { x: 30, y: 1.1, w: 1.0, h: 0.6, d: 0.02, text: t('reno.notrespass'), bg: '#c4202b', fg: '#ffffff', key: 'notrespass', cabinet: 0xdedad0 });
    void f;
    addWeeds(ctx.batch, { x0: 111, z0: 12, x1: 148, z1: 57, y: Y0 + 0.01, n: 120, seed: 9 });
    P.litter(111, 12, 148, 57, 60, { rng });
    // Junk: a tyre, a mattress, a shopping cart, broken pallets.
    junk(ctx, rng);
  }

  // Desert Rose motel: room wing parallel to the street, set back behind the lot.
  motel(ctx, P, rng, {
    key: 'rose', name: t('reno.motel.rose'), wing: { x0: 152, x1: 184, z0: 31, z1: 41 }, facing: 'N',
    office: { x0: 150, x1: 158, z0: 14, z1: 21 }, colors: { wall: 0xf0d8cc, trim: 0xb3405a, doors: [0xb3405a, 0x2f5f7a, 0xe0b04a] },
    sign: { x: 183.6, z: 12.3, script: true, color: '#ff5f8a', vacancy: true, noVacancyOn: true },
    roomStart: 101, lot: { x0: 159, x1: 184, z0: 13, z1: 29 },
  });

  // SUNRISE DINER — 24 hrs, big windows, stainless trim, tall pole sign.
  diner(ctx, P, rng);

  // Silver Dollar motel: wing perpendicular to the street along the east edge, facing west.
  motel(ctx, P, rng, {
    key: 'dollar', name: t('reno.motel.dollar'), wing: { x0: 250, x1: 260, z0: 16, z1: 58 }, facing: 'W',
    office: { x0: 248, x1: 260, z0: 11.8, z1: 15.5 }, colors: { wall: 0xd9dcd2, trim: 0x2a4a7a, doors: [0x2a4a7a, 0x8a2a24, 0x2a6a3a] },
    sign: { x: 217.6, z: 12.3, script: false, color: '#5ad0ff', vacancy: true },
    roomStart: 1, lot: { x0: 217, x1: 249, z0: 13, z1: 58 },
  });
  // East end filler, south side.
  addBuilding(ctx, { x0: 263, x1: 298, z0: 13, z1: 40, h: 7, tint: 0xc8b8a0, wall: BM.stucco, faces: { N: { openings: [{ kind: 'shop', x0: 2, x1: 12, y0: 0.7, y1: 3.2, style: 'dark' }, { kind: 'door', x0: 14, x1: 16, y0: 0, y1: 2.4, style: 'dark', glassDoor: false }, { kind: 'shop', x0: 18, x1: 33, y0: 0.7, y1: 3.2, style: 'dark', shutter: 1 }] } } });
}

// ---- Motel ---------------------------------------------------------------------------------

function motel(ctx, P, rng, o) {
  const { batch, colliders, lights } = ctx;
  const BM = buildingMats();
  const PM = propMats();
  const w = o.wing;
  const floors = 2;
  const fh = 2.9;
  const H = floors * fh + 0.5;
  const wall = mat('stucco', { color: 0xffffff, seed: 152 });
  const trim = mat('metal-painted', { color: 0xffffff, wear: 0.55, dirt: 0.5, seed: 153 });
  const doorMat = mat('metal-painted', { color: 0xffffff, wear: 0.6, dirt: 0.55, seed: 154 });
  // Which face has the rooms + walkway.
  const side = o.facing;
  const faceLen = side === 'N' || side === 'S' ? w.x1 - w.x0 : w.z1 - w.z0;
  const bay = 4.2;
  const nb = Math.floor((faceLen - 2.4) / bay);
  const ops = [];
  const doors = [];
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < nb; i++) {
      const bx = 1.4 + i * bay;
      const y = f * fh;
      ops.push({ kind: 'door', x0: bx + 0.3, x1: bx + 1.2, y0: y, y1: y + 2.1, glassDoor: false, doorTint: o.colors.doors[(i + f) % o.colors.doors.length] });
      ops.push({ kind: 'window', x0: bx + 1.8, x1: bx + 3.6, y0: y + 0.95, y1: y + 2.15, style: 'room', frame: 0xe8e4d8, meeting: false });
      doors.push({ bx, y, num: o.roomStart >= 100 ? (f + 1) * 100 + i + 1 : o.roomStart + f * nb + i });
    }
  }
  const b = addBuilding(ctx, {
    x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1, h: H, tint: o.colors.wall, wall, parapet: 0.2,
    faces: { [side]: { openings: ops, bands: [{ y: fh - 0.1, h: 0.25, d: 0.1, mat: trim, tint: o.colors.trim }] } },
    sideWindows: { cell: [4.2, fh], win: [1.6, 1.1], y0: Y0 + 1.0, y1: Y0 + H - 0.5, style: 'room', glass: 0x6d7f8c, frame: 0xe8e4d8, seed: w.x0 },
  });
  const F = b.frames[side];
  // Mansard band around the roof (shingled fascia).
  const roofTint = 0x5a4232;
  for (const sd of ['N', 'S', 'E', 'W']) {
    const fr = b.frames[sd];
    const g = new THREE.BoxGeometry(fr.len + 0.4, 0.9, 0.6);
    g.translate(fr.len / 2, H + 0.15, 0.15);
    batch.add(g, BM.roof, { matrix: fr.matrix, tint: roofTint, uv: 1.2 });
  }
  // Upper walkway (on the room face): slab, posts, railing; steel stair at the far end.
  const wd = 1.7;
  const slab = new THREE.BoxGeometry(faceLen, 0.22, wd).translate(faceLen / 2, fh - 0.11, wd / 2);
  batch.add(slab, BM.concrete, { matrix: F.matrix, grime: 0.5 });
  colliders.local(F.matrix, faceLen / 2, fh - 0.11, wd / 2, faceLen, 0.22, wd);
  for (let x = 0.4; x <= faceLen - 0.3; x += bay) {
    batch.add(new THREE.BoxGeometry(0.12, fh - 0.22, 0.12).translate(x, (fh - 0.22) / 2, wd - 0.12), trim, { matrix: F.matrix, tint: o.colors.trim });
    colliders.local(F.matrix, x, (fh - 0.22) / 2, wd - 0.12, 0.14, fh - 0.22, 0.14);
    // Upper posts to the roof overhang.
    batch.add(new THREE.BoxGeometry(0.1, fh - 0.3, 0.1).translate(x, fh + (fh - 0.3) / 2, wd - 0.12), trim, { matrix: F.matrix, tint: o.colors.trim });
  }
  // Roof overhang over the walkway.
  batch.add(new THREE.BoxGeometry(faceLen, 0.18, wd + 0.2).translate(faceLen / 2, 2 * fh - 0.1, (wd + 0.2) / 2), BM.concrete, { matrix: F.matrix });
  // Railing: top rail + balusters (instanced-ish through the batch).
  batch.add(new THREE.BoxGeometry(faceLen - 2.2, 0.06, 0.06).translate((faceLen - 2.2) / 2, fh + 0.95, wd - 0.06), trim, { matrix: F.matrix, tint: o.colors.trim });
  batch.add(new THREE.BoxGeometry(faceLen - 2.2, 0.04, 0.04).translate((faceLen - 2.2) / 2, fh + 0.12, wd - 0.06), trim, { matrix: F.matrix, tint: o.colors.trim });
  for (let x = 0.15; x < faceLen - 2.2; x += 0.14) batch.add(new THREE.BoxGeometry(0.02, 0.83, 0.02).translate(x, fh + 0.535, wd - 0.06), trim, { matrix: F.matrix, tint: o.colors.trim });
  colliders.local(F.matrix, (faceLen - 2.2) / 2, fh + 0.5, wd - 0.06, faceLen - 2.2, 1.0, 0.08);
  // Stair: 16 steps down from the walkway end (local x faceLen-2.1..) out along +z.
  const steps = 16;
  const rise = fh / steps;
  const run = 0.27;
  for (let k = 0; k < steps; k++) {
    const sy = fh - (k + 1) * rise;
    const sz = wd + 0.05 + k * run;
    const g = new THREE.BoxGeometry(1.0, 0.05, run + 0.02).translate(faceLen - 0.9, sy + rise - 0.025, sz + run / 2);
    batch.add(g, BM.metal, { matrix: F.matrix, tint: 0x5a5a56 });
    colliders.local(F.matrix, faceLen - 0.9, (sy + rise) / 2, sz + run / 2, 1.0, sy + rise, run);
  }
  // Stringers + handrails.
  const sLen = Math.hypot(steps * run, fh);
  const ang = Math.atan2(fh, steps * run);
  for (const sx of [faceLen - 1.42, faceLen - 0.38]) {
    const g = new THREE.BoxGeometry(0.06, 0.25, sLen).rotateX(ang).translate(sx, fh / 2, wd + (steps * run) / 2);
    batch.add(g, BM.metal, { matrix: F.matrix, tint: 0x4a4a46 });
    const r = new THREE.BoxGeometry(0.04, 0.04, sLen).rotateX(ang).translate(sx, fh / 2 + 0.9, wd + (steps * run) / 2);
    batch.add(r, trim, { matrix: F.matrix, tint: o.colors.trim });
  }
  // Room numbers, AC units, a light by every door.
  for (const d of doors) {
    const ac = new THREE.BoxGeometry(0.66, 0.42, 0.5).translate(d.bx + 2.7, d.y + 0.65, 0.18);
    batch.add(ac, BM.metal, { matrix: F.matrix, tint: 0xcfcac0, grime: 0.6, grimeBase: Y0 + d.y });
    batch.add(new THREE.PlaneGeometry(0.5, 0.3).translate(d.bx + 2.7, d.y + 0.65, 0.431), acGrille(), { matrix: F.matrix, uv: 'keep', castShadow: false });
    colliders.local(F.matrix, d.bx + 2.7, d.y + 0.65, 0.18, 0.66, 0.42, 0.5);
    // Number plate (canvas digits atlas: each plate samples its number).
    const plate = numberPlate(d.num);
    batch.add(new THREE.PlaneGeometry(0.3, 0.14).translate(d.bx + 0.75, d.y + 2.3, 0.012), plate, { matrix: F.matrix, uv: 'keep', castShadow: false });
    // Porch light (wall pack).
    batch.add(new THREE.BoxGeometry(0.18, 0.24, 0.12).translate(d.bx + 1.5, d.y + 2.25, 0.06), BM.metal, { matrix: F.matrix, tint: 0x2a2a2a });
    batch.add(new THREE.PlaneGeometry(0.14, 0.16).translate(d.bx + 1.5, d.y + 2.22, 0.121), PM.lampSodium, { matrix: F.matrix, uv: 'keep', castShadow: false });
    if (rng.chance(0.85)) {
      lights.push({ pos: onFace(F, d.bx + 1.5, d.y + 2.1, 0.5), color: 0xffb060, intensity: 2.2, distance: 5, kind: 'lamp', groundY: Y0 + d.y, flicker: rng.chance(0.12), reflectK: 0.6, width: 0.4 });
    }
  }
  if (ctx.decalWalls) ctx.decalWalls.push({ frame: F, x0: 0.5, x1: faceLen - 3, y0: 0.2, y1: 2.6, kinds: ['grime', 'streak', 'grime', 'graffiti'], n: 8 });

  // Office: small box with a big window, OFFICE neon, ice + vending machines.
  const oo = o.office;
  const ofSide = oo.z1 < 0 ? 'S' : 'N'; // the office always faces 4th St
  const ob = addBuilding(ctx, {
    x0: oo.x0, x1: oo.x1, z0: oo.z0, z1: oo.z1, h: 3.4, tint: o.colors.wall, wall, parapet: 0.5,
    faces: {
      [ofSide]: {
        openings: [{ kind: 'shop', x0: 0.8, x1: 4.2, y0: 0.8, y1: 2.6, style: 'office' }, { kind: 'door', x0: 4.8, x1: 5.8, y0: 0, y1: 2.2, style: 'office' }],
      },
    },
  });
  const OF = ob.frames[ofSide];
  neonOnFace(ctx, OF, { key: `${o.key}-office`, x: 2.5, y: 2.95, z: 0.08, worldW: 2.2, w: 512, h: 128, lines: [{ text: 'OFFICE', font: '400 100px "Bebas Neue"', size: 100, color: '#ff6a3a', y: 64 }], color: 0xff6a3a, backer: 0x1a1a1a });
  // Ice machine + soda machine against the office's side wall.
  const side2 = ob.frames[ofSide === 'S' ? 'E' : 'W'];
  vending(ctx, side2, 1.0, 'ice');
  vending(ctx, side2, 2.3, 'soda');

  // Roadside pole sign.
  const s = o.sign;
  poleSign(ctx, {
    x: s.x, z: s.z, ry: 0, h: 9.5, w: 4.6, signH: 2.3, key: `${o.key}-pole`,
    draw: (g, W2, H2) => {
      const grd = g.createLinearGradient(0, 0, 0, H2);
      grd.addColorStop(0, '#f6eedc');
      grd.addColorStop(1, '#e6d8bc');
      g.fillStyle = grd;
      g.fillRect(0, 0, W2, H2);
      g.fillStyle = s.color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const font = s.script ? (z) => `italic 700 ${z}px "Playfair Display"` : (z) => `400 ${z}px "Rye"`;
      const sz = fitText(g, o.name, W2 * 0.9, H2 * 0.5, font);
      g.font = font(sz);
      g.fillText(o.name, W2 / 2, H2 * 0.4);
      g.fillStyle = '#2a2a2a';
      g.font = `400 ${H2 * 0.2}px "Bebas Neue"`;
      g.fillText(`${t('reno.motel.tv')} · ${t('reno.motel.weekly')}`, W2 / 2, H2 * 0.8);
    },
    neon: {
      w: 1024, h: 320, worldW: 4.3,
      lines: [
        { text: t('reno.motel'), font: '400 150px "Bebas Neue"', size: 150, color: s.color, y: 92, channel: 0 },
        { text: t('reno.novacancy'), font: '400 110px "Bebas Neue"', size: 110, color: '#ff2a2a', y: 238, x: 230, channel: 1 },
        { text: t('reno.vacancy'), font: '400 110px "Bebas Neue"', size: 110, color: '#ff2a2a', y: 238, x: 620, channel: 2 },
      ],
      flicker: { broken: s.noVacancyOn ? [0] : [1], deadMostly: !s.noVacancyOn },
      y: 9.5 - 2.3 - 0.75,
    },
    arrow: { dir: -1, y: 9.5 - 2.3 - 1.75, len: 4.0, tint: 0xd8b13a },
    lightColor: new THREE.Color(s.color).getHex(),
  });

  // Parked cars in the lot facing the rooms.
  const L = o.lot;
  if (L) {
    const along = side === 'E' || side === 'W' ? 'z' : 'x';
    const n = along === 'z' ? Math.floor((L.z1 - L.z0 - 4) / 2.9) : Math.floor((L.x1 - L.x0 - 2) / 2.9);
    for (let i = 0; i < n; i++) {
      if (!rng.chance(0.55)) continue;
      const type = rng.pick(['sedan', 'sedan', 'coupe', 'pickup', 'wagon', 'van']);
      if (along === 'z') {
        const z = L.z1 - 4 - i * 2.9;
        const x = side === 'E' ? L.x0 + 3.0 : L.x1 - 3.0;
        parkedCar(batch, colliders, { x, y: Y0, z, ry: side === 'E' ? Math.PI : 0, type, seed: rng.int(1, 99999) });
      } else {
        const x = L.x0 + 2 + i * 2.9;
        const z = side === 'N' ? L.z1 - 3.0 : L.z0 + 3.0;
        parkedCar(batch, colliders, { x, y: Y0, z, ry: side === 'N' ? -Math.PI / 2 : Math.PI / 2, type, seed: rng.int(1, 99999) });
      }
    }
    // Stall lines (worn paint).
    const paint = (x, z, w2, d2) => batch.add(new THREE.PlaneGeometry(w2, d2).rotateX(-Math.PI / 2).translate(x, Y0 + 0.012, z), stallPaint(), { castShadow: false, uv: 2.5 });
    for (let i = 0; i <= n; i++) {
      if (along === 'z') paint(side === 'E' ? L.x0 + 2.6 : L.x1 - 2.6, L.z1 - 2.55 - i * 2.9, 5, 0.1);
      else paint(L.x0 + 0.55 + i * 2.9, side === 'N' ? L.z1 - 2.6 : L.z0 + 2.6, 0.1, 5);
    }
    P.litter(L.x0, L.z0, L.x1, L.z1, 25, { rng });
    if (ctx.decalGround) ctx.decalGround.push({ ...L, y: Y0, kinds: ['oil', 'oil', 'grime', 'crack', 'puddle', 'burn'], n: 22 });
  }
}

// Gable roof prism over a rectangle (ridge along x or z).
function gableRoof(ctx, { x0, x1, z0, z1, y, rise, along = 'x', tint = 0x4a3a30 }) {
  const BM = buildingMats();
  const w = along === 'x' ? z1 - z0 : x1 - x0;
  const len = along === 'x' ? x1 - x0 : z1 - z0;
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  if (along === 'x') g.rotateY(Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  ctx.batch.add(g, BM.roof, { tint, uv: 1.2 });
  ctx.colliders.aabb(x0, y, z0, x1, y + rise * 0.6, z1);
}

function diner(ctx, P, rng) {
  const { batch, lights } = ctx;
  const BM = buildingMats();
  const steel = mat('chrome', { wear: 0.5, dirt: 0.4, seed: 161 });
  const red = mat('metal-painted', { color: 0xb8242a, wear: 0.4, dirt: 0.4, seed: 162 });
  const x0 = 188;
  const x1 = 213;
  const z0 = 21;
  const z1 = 34;
  const ops = [];
  for (let x = 1.2; x < 24; x += 2.3) {
    if (x > 11 && x < 14) continue;
    ops.push({ kind: 'shop', x0: x, x1: x + 2.0, y0: 0.95, y1: 2.65, style: 'shop', mullions: 0, glassTint: 0x9aa6a8 });
  }
  ops.push({ kind: 'door', x0: 11.6, x1: 13.4, y0: 0, y1: 2.45, style: 'shop' });
  const b = addBuilding(ctx, {
    x0, x1, z0, z1, h: 3.9, tint: 0xf2eee4, wall: BM.stucco, parapet: 0.6,
    faces: { N: { openings: ops, cellMat: (x, y) => (y < 0.95 ? { mat: BM.tile, tint: 0xb8242a } : null), splitY: [0.95], bands: [{ y: 2.85, h: 0.3, d: 0.12, mat: steel }, { y: 3.4, h: 0.5, d: 0.25, mat: red, tint: 0xffffff }] } },
  });
  const f = b.frames.N;
  // Stainless bands with red stripes along the base and the roofline.
  for (const yy of [0.98, 1.1]) batch.add(new THREE.BoxGeometry(x1 - x0, 0.05, 0.05).translate((x1 - x0) / 2, yy - 0.2, 0.03), steel, { matrix: f.matrix });
  // Entrance canopy.
  batch.add(new THREE.BoxGeometry(4.2, 0.25, 2.0).translate(12.5, 2.85, 1.0), red, { matrix: f.matrix, tint: 0xffffff });
  neonOnFace(ctx, f, { key: 'diner-roof', x: 12.5, y: 4.9, z: 0.0, worldW: 9, w: 1024, h: 200, lines: [{ text: t('reno.diner'), font: 'italic 700 120px "Playfair Display"', size: 120, color: '#ff4a3a', y: 90 }, { text: t('reno.diner.sub'), font: '400 60px "Bebas Neue"', size: 60, color: '#7cf4ff', y: 172, channel: 1 }], color: 0xff4a3a, backer: 0x1a1412 });
  neonOnFace(ctx, f, { key: 'diner-open24', x: 4.0, y: 1.8, z: -0.07, worldW: 1.4, w: 512, h: 256, lines: [{ text: t('reno.diner.open'), font: '400 110px "Bebas Neue"', size: 110, color: '#ff2f6a', y: 128 }], color: 0xff2f6a, backer: null, lightK: 3 });
  // Tall pole sign with a sunrise.
  poleSign(ctx, {
    x: 205, z: 12.4, ry: 0, h: 11, w: 5, signH: 3.2, key: 'diner-pole',
    draw: (g, W2, H2) => {
      const grd = g.createLinearGradient(0, 0, 0, H2);
      grd.addColorStop(0, '#ffcf5a');
      grd.addColorStop(1, '#ff7a3a');
      g.fillStyle = grd;
      g.fillRect(0, 0, W2, H2);
      g.fillStyle = '#fff3c8';
      for (let i = 0; i < 9; i++) {
        g.save();
        g.translate(W2 / 2, H2 * 0.62);
        g.rotate(-Math.PI / 2 + ((i - 4) / 4) * 1.2);
        g.fillRect(0, -4, H2 * 0.7, 8);
        g.restore();
      }
      g.beginPath();
      g.arc(W2 / 2, H2 * 0.62, H2 * 0.22, Math.PI, 0);
      g.fill();
      g.fillStyle = '#7a1a10';
      const s2 = fitText(g, t('reno.diner'), W2 * 0.9, H2 * 0.32, (z) => `italic 700 ${z}px "Playfair Display"`);
      g.font = `italic 700 ${s2}px "Playfair Display"`;
      g.textAlign = 'center';
      g.fillText(t('reno.diner'), W2 / 2, H2 * 0.92);
    },
    neon: { w: 1024, h: 256, worldW: 4.4, lines: [{ text: t('reno.diner.open'), font: '400 170px "Bebas Neue"', size: 170, color: '#ff2a4a', y: 128 }], y: 11 - 3.2 - 0.85, flicker: { broken: [0] } },
    lightColor: 0xff7a4a,
  });
  lights.push({ pos: onFace(f, 12.5, 2.6, 1.0), color: 0xffe0b0, intensity: 6, distance: 8, kind: 'lamp', groundY: 0.15 });
  void rng;
  void P;
  void awning;
  void awningMat;
  void facade;
  void shopBuilding;
}

function vending(ctx, frame, x, kind) {
  const BM = buildingMats();
  const w = 0.95;
  const h = kind === 'ice' ? 1.7 : 1.85;
  const m = new THREE.Matrix4().multiplyMatrices(frame.matrix, new THREE.Matrix4().makeTranslation(x, 0, 0.45));
  ctx.batch.add(new THREE.BoxGeometry(w, h, 0.8).translate(0, h / 2, 0), BM.metal, { matrix: m, tint: kind === 'ice' ? 0xe8eef2 : 0xb3141b, grime: 0.6, grimeBase: 0.15 });
  const face = paintedSignMat(`vend-${kind}`, 128, 230, (g, W2, H2) => {
    g.fillStyle = kind === 'ice' ? '#dfe9f0' : '#b3141b';
    g.fillRect(0, 0, W2, H2);
    g.fillStyle = kind === 'ice' ? '#1b4f9c' : '#ffffff';
    g.font = '400 64px "Bebas Neue"';
    g.textAlign = 'center';
    if (kind === 'ice') {
      g.fillText('ICE', W2 / 2, 80);
      g.font = '400 22px "Bebas Neue"';
      g.fillText('$2.50 BAG', W2 / 2, 120);
    } else {
      g.fillText('COLD', W2 / 2, 70);
      g.fillText('SODA', W2 / 2, 130);
      g.fillStyle = '#222';
      g.fillRect(W2 * 0.7, 150, 22, 50);
    }
  }, { lit: 1.6 });
  ctx.batch.add(new THREE.PlaneGeometry(w - 0.1, h - 0.2).translate(0, h / 2, 0.405), face, { matrix: m, uv: 'keep', castShadow: false });
  const p = new THREE.Vector3(0, h / 2, 0).applyMatrix4(m);
  ctx.colliders.box(p.x, p.y, p.z, w, h, 0.8, Math.atan2(-frame.along.z, frame.along.x));
  ctx.lights.push({ pos: new THREE.Vector3(0, 1.2, 0.9).applyMatrix4(m), color: kind === 'ice' ? 0xdff0ff : 0xffb0a0, intensity: 2, distance: 4, kind: 'ad', groundY: 0.15, realLight: false, width: 0.9 });
}

function junk(ctx, rng) {
  const BM = buildingMats();
  const PM = propMats();
  // Old tyre.
  ctx.batch.add(new THREE.TorusGeometry(0.32, 0.12, 8, 16).rotateX(Math.PI / 2 - 0.2).translate(121, Y0 + 0.12, 24), PM.rubber, {});
  // Mattress (stained) leaning on the fence.
  const mt = new THREE.BoxGeometry(1.4, 1.9, 0.22).rotateX(-0.25).translate(131, Y0 + 0.93, 56.9);
  ctx.batch.add(mt, mat('fabric', { color: 0xd9cdb6, dirt: 0.9, wear: 0.8, seed: 171 }), {});
  ctx.colliders.box(131, Y0 + 0.93, 56.85, 1.4, 1.9, 0.4);
  // Pallets.
  for (let k = 0; k < 3; k++) {
    const m = new THREE.Matrix4().makeRotationY(rng.range(-0.5, 0.5)).setPosition(140 + k * 0.2, Y0 + 0.07 + k * 0.14, 44 + k * 0.1);
    for (let i = 0; i < 6; i++) ctx.batch.add(new THREE.BoxGeometry(1.2, 0.025, 0.12).translate(0, 0.12, -0.5 + i * 0.2), PM.wood, { matrix: m });
    for (const z of [-0.5, 0, 0.5]) ctx.batch.add(new THREE.BoxGeometry(1.2, 0.1, 0.1).translate(0, 0.05, z), PM.wood, { matrix: m });
  }
  ctx.colliders.box(140.2, Y0 + 0.22, 44.1, 1.3, 0.45, 1.3);
  // Abandoned shopping cart (wire basket + frame), tipped at the fence line.
  cart(ctx, 116.5, 13.4, 0.6);
  void BM;
}

export function cart(ctx, x, z, ry) {
  const PM = propMats();
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, Y0, z);
  const add = (g) => ctx.batch.add(g, PM.galv, { matrix: m });
  const W = 0.55;
  const L = 0.9;
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.012, 0.012, L, 5).rotateX(Math.PI / 2).translate(s * W / 2, 0.55, 0));
    add(new THREE.CylinderGeometry(0.012, 0.012, L, 5).rotateX(Math.PI / 2).translate(s * W / 2, 0.95, 0));
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 5).translate(s * W / 2, 0.45, -L / 2 + 0.05));
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 5).translate(s * W / 2, 0.45, L / 2 - 0.05));
  }
  for (let i = 0; i <= 12; i++) add(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4).translate(-W / 2 + (W * i) / 12, 0.75, L / 2));
  for (let i = 0; i <= 12; i++) add(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4).translate(-W / 2 + (W * i) / 12, 0.75, -L / 2));
  for (let i = 0; i <= 18; i++) add(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4).translate(W / 2, 0.75, -L / 2 + (L * i) / 18));
  for (let i = 0; i <= 18; i++) add(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 4).translate(-W / 2, 0.75, -L / 2 + (L * i) / 18));
  add(new THREE.CylinderGeometry(0.018, 0.018, W + 0.1, 6).rotateZ(Math.PI / 2).translate(0, 1.0, L / 2 + 0.08));
  for (const [wx, wz] of [[-0.22, -0.4], [0.22, -0.4], [-0.22, 0.4], [0.22, 0.4]]) {
    ctx.batch.add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10).rotateZ(Math.PI / 2).translate(wx, 0.06, wz), PM.rubber, { matrix: m });
  }
  const p = new THREE.Vector3(0, 0.5, 0).applyMatrix4(m);
  ctx.colliders.box(p.x, p.y, p.z, W + 0.1, 1.0, L + 0.2, ry);
}

const numCache = new Map();
function numberPlate(n) {
  if (numCache.has(n)) return numCache.get(n);
  const m = paintedSignMat(`room-${n}`, 96, 48, (g, w, h) => {
    g.fillStyle = '#2a2018';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d9b25a';
    g.font = '400 40px "Bebas Neue"';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), w / 2, h / 2 + 2);
  }, { metal: 0.5, rough: 0.35, weather: { grime: 0.3, fade: 0.2, rust: 0, scratches: 0.3 } });
  numCache.set(n, m);
  return m;
}

let grille = null;
function acGrille() {
  if (!grille) {
    grille = paintedSignMat('ac-grille', 128, 80, (g, w, h) => {
      g.fillStyle = '#7d7a72';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#3a3834';
      for (let y = 6; y < h - 4; y += 6) g.fillRect(6, y, w - 12, 3);
      g.fillStyle = 'rgba(120,60,20,0.5)';
      g.fillRect(0, h - 10, w, 10);
    }, { weather: { grime: 0.8, rust: 0.6 } });
  }
  return grille;
}

let stall = null;
function stallPaint() {
  if (!stall) stall = new THREE.MeshStandardMaterial({ color: 0xd9d6cc, roughness: 0.7, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  return stall;
}
