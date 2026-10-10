// Furnished areas of the floor: the foyer (security podium, players club desk, centrepiece,
// walk-off mats, age sign), the Fortune Bar (counter, back bar with bottles and mirror, taps,
// bar-top video poker, stools, lounge high-tops), the pit (podium, covered closed tables, chairs),
// the restroom corridor, the hotel elevator lobby, the escalators to the skyway, the car giveaway
// turntable by the 4th St door, and the hanging directional signs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StaticBatch, Colliders } from '../../world/shared/batch.js';
import { parkedCar } from '../../world/shared/vehicles.js';
import { channelLetters } from '../../world/shared/letters.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';
import {
  FLOOR_Y, CEIL_Y, SHELL, SKIN, FOYER, PODIUM, PLAYERS, BAR, RESTROOMS, ELEVATORS, ESCALATOR, PIT, PIT_PODIUM, CLOSED_TABLES, DOORS,
} from '../layout.js';
import { signMat, fitFont, goldFill, glow } from './mats.js';
import { plaque } from './fixtures.js';

const F = FLOOR_Y;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/** Box helper with optional yaw about its own centre. */
function boxer(C) {
  return (x, y, z, w, h, d, mat, o = {}) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (o.ry) g.rotateY(o.ry);
    g.translate(x, y, z);
    C.add(g, mat, o);
    if (o.collide) C.colliders.box(x, y, z, w, h, d, o.ry || 0);
    return g;
  };
}

export function buildAreas(C) {
  const out = {};
  out.foyer = buildFoyer(C);
  out.bar = buildBar(C);
  out.pit = buildPit(C);
  buildRestrooms(C);
  buildElevators(C);
  buildEscalators(C);
  out.car = buildCarDisplay(C);
  buildHangingSigns(C);
  return out;
}

// ---- foyer -------------------------------------------------------------------------------

function buildFoyer(C) {
  const { M, glows, spots } = C;
  const B = boxer(C);
  // Security podium: walnut lectern with a marble top and a gilt SECURITY plaque toward the doors.
  const { x, z } = PODIUM;
  B(x, F + 0.56, z, 0.62, 1.12, 1.05, M.wood, { collide: true });
  B(x, F + 0.05, z, 0.7, 0.1, 1.13, M.marbleDark);
  B(x - 0.02, F + 1.15, z, 0.74, 0.06, 1.15, M.marbleSlab);
  B(x + 0.315, F + 0.62, z, 0.015, 0.7, 0.85, M.gold);
  C.add(new THREE.PlaneGeometry(0.8, 0.22).rotateY(Math.PI / 2).translate(x + 0.325, F + 0.88, z), plaque('security', t('casino.sign.security'), '', { w: 512, h: 140, style: 'brass' }), { uv: 'keep', castShadow: false });
  // Brass lamp, logbook, ID scanner on the podium.
  B(x - 0.1, F + 1.2, z - 0.32, 0.12, 0.04, 0.12, M.brass);
  C.add(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6).translate(x - 0.1, F + 1.38, z - 0.32), M.brass);
  C.add(new THREE.CylinderGeometry(0.05, 0.09, 0.1, 14, 1, true).translate(x - 0.06, F + 1.56, z - 0.32), M.lampSoft, { castShadow: false });
  B(x - 0.08, F + 1.2, z + 0.12, 0.3, 0.025, 0.4, M.leatherBlack);
  B(x - 0.12, F + 1.215, z + 0.12, 0.26, 0.01, 0.36, M.paper);
  B(x - 0.12, F + 1.23, z - 0.05, 0.12, 0.05, 0.16, M.black);
  // 21+ sign on a brass easel just inside the middle door.
  const sx = -14.4;
  const sz = 43.8;
  C.add(new THREE.CylinderGeometry(0.16, 0.2, 0.04, 20).translate(sx, F + 0.02, sz), M.brass);
  C.add(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8).translate(sx, F + 0.64, sz), M.brass);
  B(sx, F + 1.32, sz, 0.05, 0.62, 0.48, M.brass);
  C.add(new THREE.PlaneGeometry(0.44, 0.58).rotateY(Math.PI / 2).translate(sx + 0.027, F + 1.32, sz), ageSignMat(), { uv: 'keep', castShadow: false });
  C.colliders.cylinder(sx, F, sz, 0.22, 1.6);
  // Walk-off mats inside each door.
  const mat = mattingMat();
  for (const d of DOORS.virginia) {
    C.add(new THREE.PlaneGeometry(1.7, d.z1 - d.z0 - 0.2).rotateX(-Math.PI / 2).translate(-13.35, F + 0.009, (d.z0 + d.z1) / 2), mat, { castShadow: false });
  }
  // Centrepiece: round marble console with a big floral arrangement under the chandeliers.
  const cx = -17.4;
  const cz = 50;
  C.add(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 40).translate(cx, F + 0.86, cz), M.marbleSlab);
  C.add(new THREE.TorusGeometry(0.95, 0.03, 8, 48).rotateX(Math.PI / 2).translate(cx, F + 0.83, cz), M.gold);
  C.add(new THREE.LatheGeometry([[0, 0], [0.55, 0], [0.5, 0.06], [0.22, 0.2], [0.16, 0.5], [0.3, 0.7], [0.62, 0.8], [0, 0.83]].map(([r, y]) => new THREE.Vector2(r, y)), 32).translate(cx, F, cz), M.gold);
  C.colliders.cylinder(cx, F, cz, 0.98, 1.2);
  C.add(new THREE.LatheGeometry([[0.0, 0], [0.16, 0], [0.24, 0.12], [0.2, 0.32], [0.12, 0.44], [0.16, 0.5], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 24).translate(cx, F + 0.89, cz), M.marbleRed);
  flowers(C, new THREE.Vector3(cx, F + 1.38, cz), 0.62, 'foyer-flowers');
  spots.add(cx, cz, 2.0, 0.25, 0xffe0b8);
  // Players club desk on the foyer's south side, its back panel and a lit card graphic.
  const pz = PLAYERS.z;
  const pw = PLAYERS.x1 - PLAYERS.x0;
  const pcx = (PLAYERS.x0 + PLAYERS.x1) / 2;
  B(pcx, F + 0.52, pz, pw, 1.04, 0.62, M.wood, { collide: true });
  B(pcx, F + 1.07, pz - 0.06, pw + 0.12, 0.05, 0.78, M.marbleSlab);
  B(pcx, F + 0.05, pz, pw + 0.06, 0.1, 0.68, M.marbleDark);
  for (let i = 0; i < 4; i++) B(PLAYERS.x0 + 0.65 + i * ((pw - 1.3) / 3), F + 0.56, pz - 0.315, 0.9, 0.62, 0.02, M.woodLight);
  B(pcx, F + 0.75, pz - 0.32, pw, 0.02, 0.02, M.gold, { castShadow: false });
  // Back panel (free-standing) with the club sign and two kiosk screens on the desk.
  const bz = pz + 1.25;
  B(pcx, F + 1.6, bz, pw + 0.6, 3.2, 0.2, M.wallRed, { collide: true });
  B(pcx, F + 3.24, bz, pw + 0.7, 0.1, 0.26, M.gold);
  C.add(new THREE.PlaneGeometry(pw - 0.2, 0.62).translate(pcx, F + 2.55, bz - 0.105), plaque('players', t('casino.sign.players'), t('casino.sign.playersSub'), { w: 1024, h: 220, style: 'wood', lit: 0.5 }), { uv: 'keep', castShadow: false });
  C.add(new THREE.PlaneGeometry(1.0, 0.62).translate(pcx, F + 1.7, bz - 0.105), clubCardMat(), { uv: 'keep', castShadow: false });
  glows.wash(new THREE.Vector3(pcx, F + 2.3, bz - 0.11), new THREE.Vector3(0, 0, -1), pw + 0.6, 3.0, 0xffcf96, 0.35);
  for (const ox of [-1.4, 1.4]) {
    B(pcx + ox, F + 1.25, pz - 0.05, 0.36, 0.26, 0.04, M.black, { ry: 0 });
    C.add(new THREE.PlaneGeometry(0.32, 0.22).rotateX(-0.25).translate(pcx + ox, F + 1.25, pz - 0.075), kioskScreenMat(), { uv: 'keep', castShadow: false });
  }
  // "Back in 10 minutes" tent card.
  B(pcx, F + 1.13, pz - 0.2, 0.2, 0.07, 0.01, M.paper, { ry: 0.1 });
  spots.add(pcx, pz - 1.2, 2.2, 0.25, 0xffd8a8);
  C.pool.add({ pos: new THREE.Vector3(pcx, F + 2.6, pz - 1.4), color: 0xffd8a8, intensity: 3, distance: 6, weight: 0.6 });
  const players = { id: 'eldorado-players', kind: 'talk', position: new THREE.Vector3(pcx, F + 1.2, pz - 0.3), radius: 0.9, reach: 2.4, describe: () => t('casino.it.players'), onInteract: () => C.toast(t('casino.msg.playersSoon')) };
  C.interactables.push(players);
  return { podium: new THREE.Vector3(x, F, z) };
}

function ageSignMat() {
  return signMat('age-sign', 384, 512, (g, w, h) => {
    g.fillStyle = '#1d0f08';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24f';
    g.lineWidth = 8;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.textAlign = 'center';
    g.fillStyle = goldFill(g, 60, 220);
    g.font = '700 150px "Playfair Display"';
    g.fillText('21', w / 2, 190);
    g.font = '400 40px "Bebas Neue"';
    g.fillStyle = '#e9d8b0';
    const words = t('casino.sign.age').split(' ');
    let line = '';
    let y = 270;
    for (const wd of words) {
      const test = line ? `${line} ${wd}` : wd;
      if (g.measureText(test).width > w - 70) {
        g.fillText(line, w / 2, y);
        y += 44;
        line = wd;
      } else line = test;
    }
    if (line) g.fillText(line, w / 2, y);
  }, { lit: 0.35 });
}

function mattingMat() {
  return signMat('walkoff-mat', 512, 256, (g, w, h) => {
    g.fillStyle = '#4a4542';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      g.fillStyle = y % 8 ? '#57514c' : '#3c3734';
      g.fillRect(0, y, w, 2);
    }
    g.strokeStyle = '#9a7c40';
    g.lineWidth = 6;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.fillStyle = '#9a7c40';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 64px "Playfair Display"';
    g.save();
    g.translate(w / 2, h / 2);
    g.rotate(Math.PI / 2);
    g.restore();
    g.fillText('ELDORADO', w / 2, h / 2 + 4);
  }, { rough: 0.95 });
}

function clubCardMat() {
  return signMat('club-card', 512, 320, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#3a0d12');
    gr.addColorStop(1, '#120406');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(8, 8, w - 16, h - 16, 26);
    g.fill();
    g.strokeStyle = '#d8b25a';
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = goldFill(g, 70, 150);
    g.font = '700 60px "Playfair Display"';
    g.textAlign = 'left';
    g.fillText('ELDORADO', 40, 120);
    g.font = '400 30px "Bebas Neue"';
    g.fillStyle = '#e8d6a8';
    g.fillText('PLAYERS CLUB · GOLD', 42, 165);
    g.fillStyle = '#c9a24f';
    g.fillRect(40, 200, 70, 50);
    g.font = '400 34px "Bebas Neue"';
    g.fillStyle = '#efe6d2';
    g.fillText('0000 4821 7730', 40, 290);
  }, { lit: 0.9 });
}

function kioskScreenMat() {
  return signMat('club-kiosk', 256, 180, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1a2a5a');
    gr.addColorStop(1, '#070a1a');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd56a';
    g.textAlign = 'center';
    g.font = '400 30px "Bebas Neue"';
    g.fillText('INSERT CARD', w / 2, 70);
    g.font = '400 20px "Inter"';
    g.fillStyle = '#cfd8ff';
    g.fillText('Check your points', w / 2, 110);
    g.fillStyle = '#c9a24f';
    g.fillRect(70, 132, 116, 28);
    g.fillStyle = '#1a1206';
    g.font = '400 20px "Bebas Neue"';
    g.fillText('TOUCH TO START', w / 2, 153);
  }, { lit: 1.6 });
}

/** A lavish flower arrangement: instanced-looking blooms merged per colour into the batch. */
function flowers(C, at, r, key) {
  const rng = new Rng(key);
  const cols = [[0xb01226, 0.45], [0xf2ece0, 0.3], [0xe8b84a, 0.15], [0x8a1a5a, 0.1]];
  const by = new Map();
  const leaves = [];
  for (let i = 0; i < 140; i++) {
    const u = rng.range(0, 1);
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(u) * r;
    const h = Math.cos((rr / r) * Math.PI * 0.5) * r * 0.75;
    const p = new THREE.Vector3(at.x + Math.cos(a) * rr, at.y + h + rng.range(-0.05, 0.05), at.z + Math.sin(a) * rr);
    const c = rng.weighted(cols.map(([c, w]) => [c, w]));
    const s = rng.range(0.045, 0.075);
    const g = new THREE.IcosahedronGeometry(s, 1).scale(1, 0.7, 1).translate(p.x, p.y, p.z);
    if (!by.has(c)) by.set(c, []);
    by.get(c).push(g);
    if (i % 2 === 0) leaves.push(new THREE.ConeGeometry(0.035, 0.16, 4).scale(1, 1, 0.25).rotateZ(rng.range(-1.2, 1.2)).rotateY(rng.range(0, 6)).translate(p.x + rng.range(-0.06, 0.06), p.y - 0.05, p.z + rng.range(-0.06, 0.06)));
  }
  for (const [c, gs] of by) C.add(mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)), false), C.M.flower, { tint: c });
  C.add(mergeGeometries(leaves.map((g) => (g.index ? g.toNonIndexed() : g)), false), C.M.flower, { tint: 0x2a5a26 });
}

// ---- bar --------------------------------------------------------------------------------

function buildBar(C) {
  const { M, glows, spots, pool } = C;
  const B = boxer(C);
  const x0 = BAR.x0 + 1.4;
  const x1 = BAR.x1 - 1.4;
  const zf = BAR.front;
  const L = x1 - x0;
  const cx = (x0 + x1) / 2;
  // Front counter: paneled walnut die, marble top with a padded leather arm rail, brass foot rail.
  B(cx, F + 0.53, zf + 0.35, L, 1.06, 0.7, M.wood, { collide: true });
  B(cx, F + 0.04, zf + 0.33, L + 0.04, 0.08, 0.74, M.marbleDark);
  const np = Math.floor(L / 1.1);
  for (let i = 0; i < np; i++) {
    const px = x0 + (i + 0.5) * (L / np);
    B(px, F + 0.58, zf - 0.005, L / np - 0.16, 0.7, 0.02, M.woodLight);
    B(px, F + 0.58, zf - 0.018, L / np - 0.3, 0.56, 0.01, M.wood);
  }
  B(cx, F + 1.09, zf + 0.25, L + 0.2, 0.06, 1.05, M.marbleDark);
  C.add(new THREE.CylinderGeometry(0.055, 0.055, L + 0.2, 16).rotateZ(Math.PI / 2).translate(cx, F + 1.11, zf - 0.24), M.leather);
  C.add(new THREE.CylinderGeometry(0.024, 0.024, L, 12).rotateZ(Math.PI / 2).translate(cx, F + 0.22, zf - 0.22), M.brass);
  for (let i = 0; i <= np; i++) {
    const px = x0 + i * (L / np);
    C.add(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8).rotateX(Math.PI / 2).translate(px, F + 0.22, zf - 0.11), M.brass);
  }
  // Counter returns at both ends back toward the wall, a flip-top at the east end.
  for (const ex of [x0 - 0.35, x1 + 0.35]) {
    B(ex, F + 0.53, zf + 1.3, 0.7, 1.06, 2.6, M.wood, { collide: true });
    B(ex, F + 1.09, zf + 1.3, 0.9, 0.06, 2.7, M.marbleDark);
  }
  // Back bar: low fridges, glass shelves with bottles, mirror behind, lit from below.
  const bz = SHELL.z1 - SKIN;
  B(cx, F + 0.47, bz - 0.33, L + 0.8, 0.94, 0.62, M.wood, { collide: true });
  B(cx, F + 0.96, bz - 0.33, L + 0.9, 0.04, 0.68, M.marbleDark);
  for (let i = 0; i < 8; i++) {
    const fx = x0 + 0.6 + i * ((L - 1.2) / 7);
    B(fx, F + 0.47, bz - 0.645, 0.85, 0.7, 0.02, M.steel);
    B(fx, F + 0.47, bz - 0.66, 0.7, 0.55, 0.01, C.M.glassTint);
    B(fx + 0.36, F + 0.6, bz - 0.67, 0.02, 0.2, 0.03, M.chrome);
  }
  C.add(new THREE.PlaneGeometry(L + 0.6, 2.2).translate(cx, F + 2.25, bz - 0.04), M.mirror, { castShadow: false });
  B(cx, F + 3.4, bz - 0.12, L + 0.9, 0.12, 0.26, M.gold);
  B(cx, F + 1.14, bz - 0.12, L + 0.9, 0.06, 0.26, M.gold);
  for (const sy of [1.55, 2.05, 2.55]) {
    B(cx, F + sy, bz - 0.2, L + 0.4, 0.02, 0.36, C.M.glassTint);
    glows.add(new THREE.Vector3(cx, F + sy + 0.35, bz - 0.05), new THREE.Vector3(0, 0, -1), [L + 0.6, 0.7], 0xffc070, 0.32);
  }
  for (let i = 0; i <= 6; i++) B(x0 - 0.1 + i * ((L + 0.2) / 6), F + 2.26, bz - 0.2, 0.06, 2.28, 0.38, M.wood);
  out_bottles(C, x0, x1, bz);
  // Soffit over the bartenders with recessed lights and the bar's name in gilt letters.
  const sz0 = zf - 0.3;
  const sz1 = bz;
  const sy = F + 3.32;
  B(cx, (sy + CEIL_Y) / 2, (sz0 + sz1) / 2, L + 1.8, CEIL_Y - sy, sz1 - sz0, M.wood);
  B(cx, sy - 0.02, sz0, L + 1.84, 0.06, 0.06, M.gold);
  for (let i = 0; i < 9; i++) {
    const lx = x0 + 0.5 + i * ((L - 1) / 8);
    for (const lz of [zf + 0.25, bz - 1.0]) C.add(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 14).translate(lx, sy - 0.006, lz), M.lampWhite, { castShadow: false });
    spots.add(lx, zf + 0.25, 1.1, 0.28, 0xffd9a8);
  }
  channelLetters(C, t('casino.sign.bar'), {
    font: '"Playfair Display"', weight: 700, height: 0.42, depth: 0.05, tracking: 0.12,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI).setPosition(cx, sy + 0.32, sz0 - 0.005),
    face: glow(0xffcf7a, 3.4), side: M.gold, chunk: 'casino',
  });
  glows.wash(new THREE.Vector3(cx, sy + 0.4, sz0 - 0.01), new THREE.Vector3(0, 0, -1), 6, 1.6, 0xffc880, 0.3);
  // Beer tap towers in the middle of the bar top.
  const tapCols = [0x1a3a7a, 0xb01a1a, 0xe8b02a, 0x1a6a2a, 0x222222, 0xd86a1a];
  for (const tx of [cx - 3, cx + 3]) {
    C.add(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 16).translate(tx, F + 1.32, zf + 0.6), M.chrome);
    B(tx, F + 1.52, zf + 0.6, 0.9, 0.08, 0.08, M.chrome);
    tapCols.forEach((c, i) => {
      const hx = tx - 0.38 + i * 0.152;
      C.add(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6).translate(hx, F + 1.47, zf + 0.56), M.chrome);
      C.add(new THREE.CylinderGeometry(0.016, 0.012, 0.2, 8).translate(hx, F + 1.66, zf + 0.6), M.cream, { tint: c });
    });
    B(tx, F + 1.125, zf + 0.6, 0.95, 0.01, 0.18, M.steel); // drip tray
  }
  // Bar-top video poker every other seat, stools in front.
  const vp = videoPokerMat();
  const nSeats = Math.floor(L / 0.78);
  const stools = [];
  for (let i = 0; i < nSeats; i++) {
    const sx = x0 + 0.39 + i * (L / nSeats);
    stools.push(new THREE.Vector3(sx, F, zf - 0.55));
    if (i % 2 === 0 && Math.abs(sx - (cx - 3)) > 0.7 && Math.abs(sx - (cx + 3)) > 0.7) {
      const g = new THREE.BoxGeometry(0.42, 0.05, 0.34).rotateX(-0.22).translate(sx, F + 1.15, zf + 0.03);
      C.add(g, M.black);
      C.add(new THREE.PlaneGeometry(0.36, 0.27).rotateY(Math.PI).rotateX(Math.PI / 2 - 0.22).translate(sx, F + 1.18, zf + 0.03), vp, { uv: 'keep', castShadow: false });
      glows.add(new THREE.Vector3(sx, F + 1.122, zf - 0.12), UP, 0.6, 0x6a8aff, 0.15);
    }
  }
  stoolSet(C, stools, Math.PI);
  // Lounge: high-top cocktail tables with stools between the slots and the bar.
  const tops = [[-35.5, 89.5], [-31.0, 90.2], [-26.5, 89.5], [-22.0, 90.2], [-18.5, 88.6]];
  const loungeStools = [];
  for (const [tx, tz] of tops) {
    C.add(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 28).translate(tx, F + 1.05, tz), M.marbleDark);
    C.add(new THREE.TorusGeometry(0.38, 0.015, 6, 28).rotateX(Math.PI / 2).translate(tx, F + 1.035, tz), M.brass);
    C.add(new THREE.CylinderGeometry(0.035, 0.035, 1.03, 10).translate(tx, F + 0.52, tz), M.brass);
    C.add(new THREE.CylinderGeometry(0.26, 0.28, 0.03, 20).translate(tx, F + 0.015, tz), M.brass);
    C.colliders.cylinder(tx, F, tz, 0.4, 1.07);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + tx;
      loungeStools.push(new THREE.Vector3(tx + Math.cos(a) * 0.7, F, tz + Math.sin(a) * 0.7));
    }
    spots.add(tx, tz, 1.2, 0.18, 0xffd0a0);
  }
  stoolSet(C, loungeStools, null, [-28.0, 89.6]);
  // Bar lighting: three pendant candidates over the counter.
  for (const lx of [x0 + L * 0.2, cx, x1 - L * 0.2]) pool.add({ pos: new THREE.Vector3(lx, F + 2.9, zf + 0.2), color: 0xffcf96, intensity: 5, distance: 8, weight: 1 });
  spots.add(cx, zf - 1.0, 5.0, 0.12, 0xffc890);
  return { stand: new THREE.Vector3(cx, F, zf + 1.6), x0, x1, zf };
}

function out_bottles(C, x0, x1, bz) {
  const rng = new Rng('bottles');
  const shapes = [
    [[0, 0], [0.038, 0], [0.04, 0.02], [0.04, 0.2], [0.03, 0.235], [0.013, 0.26], [0.013, 0.31], [0.015, 0.315], [0, 0.315]],
    [[0, 0], [0.045, 0], [0.047, 0.015], [0.047, 0.17], [0.02, 0.2], [0.014, 0.25], [0.016, 0.255], [0, 0.255]],
    [[0, 0], [0.034, 0], [0.034, 0.24], [0.012, 0.29], [0.012, 0.34], [0, 0.34]],
  ];
  const geos = shapes.map((s) => new THREE.LatheGeometry(s.map(([r, y]) => new THREE.Vector2(r, y)), 12));
  const cols = [0x6a3a10, 0x8a5a18, 0x2a5a2a, 0xd8d0b8, 0x4a1a10, 0x1a3a6a, 0xb8862a, 0x5a0a14];
  const lists = geos.map(() => []);
  for (const sy of [F + 1.17, F + 1.57, F + 2.07, F + 2.57]) {
    for (let x = x0; x < x1; x += rng.range(0.085, 0.13)) {
      const k = rng.int(0, 2);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, sy + 0.012, bz - 0.2 + rng.range(-0.08, 0.08)), new THREE.Quaternion().setFromAxisAngle(UP, rng.range(0, 6)), new THREE.Vector3(1, rng.range(0.9, 1.12), 1));
      lists[k].push({ m, c: new THREE.Color(rng.pick(cols)) });
    }
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.05, envMapIntensity: 2.2, emissive: 0x2a1406, emissiveIntensity: 0.6 });
  mat.name = 'bar-bottles';
  lists.forEach((list, k) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geos[k], mat, list.length);
    list.forEach((b, i) => {
      im.setMatrixAt(i, b.m);
      im.setColorAt(i, b.c);
    });
    im.computeBoundingSphere();
    im.name = `bar-bottles-${k}`;
    C.group.add(im);
  });
}

function videoPokerMat() {
  return signMat('bar-video-poker', 256, 192, (g, w, h) => {
    g.fillStyle = '#04104a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffde5a';
    g.textAlign = 'center';
    g.font = '400 26px "Bebas Neue"';
    g.fillText('JACKS OR BETTER', w / 2, 30);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = '#f4f0e6';
      g.fillRect(14 + i * 47, 48, 40, 58);
      g.fillStyle = i % 2 ? '#c01a1a' : '#111';
      g.font = '700 26px "Playfair Display"';
      g.fillText(['A', 'K', 'Q', 'J', '10'][i], 34 + i * 47, 86);
    }
    g.fillStyle = '#ffde5a';
    g.font = '400 22px "Bebas Neue"';
    g.fillText('CREDITS 0      BET 5', w / 2, 140);
    g.fillStyle = '#ff5a3a';
    g.fillText('INSERT BILL', w / 2, 172);
  }, { lit: 1.5 });
}

/** Bar stools: chrome pedestal + oxblood leather seat. centerFace: face toward a point/angle. */
function stoolSet(C, list, yaw, faceTo) {
  const { M } = C;
  for (const p of list) {
    C.add(new THREE.CylinderGeometry(0.22, 0.24, 0.025, 20).translate(p.x, F + 0.013, p.z), M.chrome);
    C.add(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 10).translate(p.x, F + 0.38, p.z), M.chrome);
    C.add(new THREE.TorusGeometry(0.16, 0.012, 6, 20).rotateX(Math.PI / 2).translate(p.x, F + 0.3, p.z), M.chrome);
    C.add(new THREE.CylinderGeometry(0.19, 0.17, 0.09, 20).translate(p.x, F + 0.78, p.z), M.leather);
    C.add(new THREE.TorusGeometry(0.18, 0.025, 8, 24).rotateX(Math.PI / 2).translate(p.x, F + 0.82, p.z), M.leather);
    // Low back facing away from the counter / table.
    const a = yaw != null ? yaw : Math.atan2(p.x - faceTo[0], p.z - faceTo[1]);
    void a;
    C.colliders.cylinder(p.x, F, p.z, 0.2, 0.84);
  }
}

// ---- pit --------------------------------------------------------------------------------

function buildPit(C) {
  const { M, spots } = C;
  const B = boxer(C);
  const { x, z } = PIT_PODIUM;
  // Pit podium: a tall walnut stand with a marble top, monitor and phone.
  B(x, F + 0.55, z, 1.4, 1.1, 0.7, M.wood, { collide: true });
  B(x, F + 1.13, z, 1.5, 0.05, 0.8, M.marbleDark);
  B(x, F + 0.05, z, 1.46, 0.1, 0.76, M.marbleDark);
  B(x + 0.25, F + 1.34, z + 0.05, 0.5, 0.32, 0.03, M.black, { ry: 0.25 });
  C.add(new THREE.PlaneGeometry(0.46, 0.28).rotateY(0.25 + Math.PI).translate(x + 0.25, F + 1.34, z + 0.035), pitScreenMat(), { uv: 'keep', castShadow: false });
  B(x - 0.35, F + 1.18, z, 0.18, 0.06, 0.2, M.black);
  B(x - 0.1, F + 1.165, z - 0.1, 0.3, 0.02, 0.22, M.paper, { ry: -0.2 });
  // Covered closed tables with their chairs pushed in.
  for (const T of CLOSED_TABLES) coveredTable(C, T);
  // "TABLE GAMES" lit header hanging over the pit, both faces.
  const hy = CEIL_Y - 0.75;
  // North board faces the fountain (-z), south board faces the bar (+z).
  for (const [zz, face] of [[PIT.z - 8.4, -1], [PIT.z + 8.8, 1]]) {
    const m = plaque('tables-hdr', t('casino.sign.tables'), '', { w: 1024, h: 200, style: 'wood', lit: 0.8 });
    const g = new THREE.PlaneGeometry(3.5, 0.66);
    if (face < 0) g.rotateY(Math.PI);
    B(PIT.x, hy, zz, 3.66, 0.8, 0.08, M.wood);
    B(PIT.x, hy + 0.41, zz, 3.72, 0.03, 0.1, M.gold);
    C.add(g.translate(PIT.x, hy, zz + face * 0.045), m, { uv: 'keep', castShadow: false });
    for (const ox of [-1.5, 1.5]) C.add(new THREE.CylinderGeometry(0.012, 0.012, CEIL_Y - hy - 0.4, 6).translate(PIT.x + ox, (CEIL_Y + hy + 0.4) / 2, zz), M.brass);
  }
  spots.add(x, z, 1.5, 0.15, 0xffe0b0);
  return { podium: new THREE.Vector3(x, F, z) };
}

function pitScreenMat() {
  return signMat('pit-screen', 256, 160, (g, w, h) => {
    g.fillStyle = '#0b1a2a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7fd0ff';
    g.font = '400 18px "Inter"';
    const rows = ['BJ-5   AVG 18  RATED 3', 'BJ-25  AVG 60  RATED 2', 'RL-1   AVG 12  RATED 1', 'DROP   $4,215', 'WIN    $1,180'];
    rows.forEach((r, i) => g.fillText(r, 12, 28 + i * 26));
  }, { lit: 1.2 });
}

function coveredTable(C, T) {
  const { M } = C;
  const dims = { craps: [3.7, 1.6, 0.9], baccarat: [3.0, 1.5, 0.78], 'three-card': [2.4, 1.3, 0.78] }[T.kind] || [2.4, 1.3, 0.78];
  const [w, d, h] = dims;
  const m4 = new THREE.Matrix4().makeRotationY(T.yaw).setPosition(T.x, F, T.z);
  const q = new THREE.Quaternion().setFromAxisAngle(UP, T.yaw);
  const put = (g, mat, o) => C.add(g.applyMatrix4(m4), mat, o);
  // Body under the cover: shaped top (round corners for craps, kidney for the others).
  const shape = new THREE.Shape();
  if (T.kind === 'craps') {
    const r = 0.45;
    shape.moveTo(-w / 2 + r, -d / 2);
    shape.lineTo(w / 2 - r, -d / 2);
    shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
    shape.lineTo(w / 2, d / 2 - r);
    shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
    shape.lineTo(-w / 2 + r, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
    shape.lineTo(-w / 2, -d / 2 + r);
    shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
  } else {
    // Dealer side straight (-z), player side curved (+z).
    shape.moveTo(-w / 2, -d / 2);
    shape.lineTo(w / 2, -d / 2);
    shape.absellipse(0, -d / 2, w / 2, d, 0, Math.PI, false);
    shape.lineTo(-w / 2, -d / 2);
  }
  // Cover: extruded shape (slightly puffy) with a skirt hanging down the sides.
  const top = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 18 });
  top.rotateX(Math.PI / 2).translate(0, h, 0);
  put(top, M.cover);
  const skirt = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: false, curveSegments: 18 });
  skirt.scale(0.995, 0.995, 1).rotateX(Math.PI / 2).translate(0, h - 0.06, 0);
  put(skirt, M.cover);
  // Base pedestal visible under the skirt.
  const base = new THREE.ExtrudeGeometry(shape, { depth: h - 0.42, bevelEnabled: false, curveSegments: 12 });
  base.scale(0.82, 0.8, 1).rotateX(Math.PI / 2).translate(0, h - 0.4, 0);
  put(base, M.wood);
  put(new THREE.BoxGeometry(w * 0.7, 0.04, d * 0.5).translate(0, 0.02, 0), M.marbleDark);
  // Draped fold lines on the skirt (thin darker strips).
  if (T.kind === 'craps') for (let i = -3; i <= 3; i++) for (const sz of [-1, 1]) put(new THREE.BoxGeometry(0.015, 0.34, 0.01).translate(i * (w / 7), h - 0.24, sz * (d / 2 + 0.006)), M.black, { castShadow: false });
  // "TABLE CLOSED" tent sign on top.
  const sign = plaque(`closed-${T.kind}`, t('casino.sign.closed'), t(T.kind === 'craps' ? 'casino.sign.craps' : T.kind === 'baccarat' ? 'casino.sign.baccarat' : 'casino.sign.threeCard'), { w: 512, h: 220, style: 'lit' });
  for (const s of [1, -1]) {
    const g = new THREE.PlaneGeometry(0.5, 0.21).rotateX(-0.3 * s).translate(0, h + 0.2, s * 0.03);
    if (s < 0) g.rotateY(Math.PI);
    put(g, sign, { uv: 'keep', castShadow: false });
  }
  // Chairs pushed in (not for craps: you stand at a craps table).
  if (T.kind !== 'craps') {
    const n = T.kind === 'baccarat' ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.12 + (0.76 * i) / (n - 1));
      const cx = Math.cos(a) * (w / 2 + 0.1);
      const cz = -d / 2 + Math.sin(a) * (d + 0.18);
      const yaw = Math.atan2(-cx, -(cz + d / 2));
      chair(C, new THREE.Vector3(cx, 0, cz).applyMatrix4(m4), yaw + T.yaw);
    }
  }
  // Collider: oriented box around the cover.
  const c = new THREE.Vector3(0, h / 2, T.kind === 'craps' ? 0 : 0.0).applyMatrix4(m4);
  C.colliders.box(c.x, c.y + 0.05, c.z, w + 0.1, h + 0.1, d + 0.1, T.yaw);
  void q;
}

/** Casino table chair: walnut frame, oxblood leather seat and back. yaw = facing (sin, cos). */
export function chair(C, p, yaw) {
  const { M } = C;
  const m4 = new THREE.Matrix4().makeRotationY(yaw).setPosition(p.x, F, p.z);
  const put = (g, mat) => C.add(g.applyMatrix4(m4), mat);
  put(new THREE.BoxGeometry(0.46, 0.09, 0.44).translate(0, 0.62, 0), M.leather);
  put(new THREE.BoxGeometry(0.44, 0.48, 0.07).translate(0, 0.95, -0.21).rotateX(-0.08), M.leather);
  put(new THREE.BoxGeometry(0.48, 0.05, 0.46).translate(0, 0.56, 0), M.wood);
  for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) put(new THREE.BoxGeometry(0.045, 0.56, 0.045).translate(lx, 0.28, lz), M.wood);
  put(new THREE.BoxGeometry(0.4, 0.025, 0.025).translate(0, 0.2, 0.19), M.brass);
  C.colliders.box(p.x, F + 0.5, p.z, 0.5, 1.0, 0.5, yaw);
}

// ---- restrooms ---------------------------------------------------------------------------

function buildRestrooms(C) {
  const { M, glows } = C;
  const B = boxer(C);
  const R = RESTROOMS;
  const px = R.x1;
  const z0 = R.z0;
  const z1 = SHELL.z1;
  const top = CEIL_Y;
  // Partition wall (both faces finished) with an arch opening at the north end.
  const wall = (zA, zB, yA, yB) => {
    B(px, (yA + yB) / 2, (zA + zB) / 2, 0.24, yB - yA, zB - zA, M.wallpaper, { collide: true });
  };
  wall(z0 + 0.6, z1, F, top);
  B(px, F + 0.56, (z0 + 0.6 + z1) / 2, 0.3, 1.12, z1 - z0 - 0.6, M.wood);
  B(px, F + 1.14, (z0 + 0.6 + z1) / 2, 0.34, 0.06, z1 - z0 - 0.6, M.wood);
  B(px, top - 0.2, (z0 + 0.6 + z1) / 2, 0.4, 0.4, z1 - z0 - 0.6, M.plaster);
  // Archway frame across the corridor mouth (header + pilasters).
  const ax0 = SHELL.x0;
  B((ax0 + px) / 2, top - 0.55, z0, px - ax0, 1.1, 0.3, M.plaster, { collide: true });
  B((ax0 + px) / 2, top - 1.12, z0, px - ax0 + 0.1, 0.06, 0.34, M.gold);
  B(px + 0.02, (F + top) / 2, z0 + 0.15, 0.4, top - F, 0.6, M.marbleSlab, { collide: true });
  C.add(new THREE.PlaneGeometry(2.6, 0.5).rotateY(Math.PI).translate((ax0 + px) / 2, top - 0.6, z0 - 0.16), plaque('restrooms', t('casino.sign.restrooms'), '', { w: 768, h: 150, style: 'wood', lit: 0.8 }), { uv: 'keep', castShadow: false });
  // Doors on the west wall (closed for cleaning), with pictogram plaques.
  const doors = [[89.0, 'men'], [95.0, 'women']];
  for (const [dz, who] of doors) {
    const dx = SHELL.x0 + SKIN;
    B(dx + 0.04, F + 1.1, dz, 0.08, 2.2, 1.0, M.wood, { collide: true });
    B(dx + 0.09, F + 1.1, dz, 0.02, 2.0, 0.84, M.woodLight);
    B(dx + 0.06, F + 2.25, dz, 0.12, 0.1, 1.2, M.marbleSlab);
    for (const s of [-1, 1]) B(dx + 0.06, F + 1.1, dz + s * 0.55, 0.12, 2.3, 0.1, M.marbleSlab);
    B(dx + 0.12, F + 1.05, dz + 0.3, 0.04, 0.32, 0.12, M.brass);
    C.add(new THREE.PlaneGeometry(0.3, 0.42).rotateY(Math.PI / 2).translate(dx + 0.105, F + 1.6, dz), pictoMat(who), { uv: 'keep', castShadow: false });
    const it = { id: `eldorado-restroom-${who}`, kind: 'talk', position: new THREE.Vector3(dx + 0.15, F + 1.1, dz), radius: 0.5, reach: 2.2, describe: () => t('casino.it.restroomDoor'), onInteract: () => C.toast(t('casino.msg.restroomClosed')) };
    C.interactables.push(it);
  }
  // Drinking fountain on the partition + a wet-floor sign.
  B(px - 0.25, F + 0.86, 92.0, 0.36, 0.1, 0.46, M.steel);
  B(px - 0.17, F + 0.6, 92.0, 0.2, 0.5, 0.3, M.steel);
  B(-77.6, F + 0.32, 87.2, 0.3, 0.62, 0.04, C.M.cream, { tint: 0xf2c418, ry: 0.4 });
  C.add(new THREE.PlaneGeometry(0.26, 0.5).rotateY(Math.PI / 2 + 0.4).translate(-77.6 + 0.03, F + 0.34, 87.2), wetFloorMat(), { uv: 'keep', castShadow: false });
  glows.add(new THREE.Vector3((ax0 + px) / 2, top - 0.02, 92), DOWN, [3, 14], 0xfff0d8, 0.2);
  C.spots.add((ax0 + px) / 2, 92, 3.0, 0.25, 0xfff0d8);
}

function pictoMat(who) {
  return signMat(`picto-${who}`, 192, 256, (g, w, h) => {
    g.fillStyle = '#2a1408';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24f';
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#e8c878';
    g.beginPath();
    g.arc(w / 2, 62, 20, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    if (who === 'women') {
      g.moveTo(w / 2 - 14, 92);
      g.lineTo(w / 2 + 14, 92);
      g.lineTo(w / 2 + 36, 170);
      g.lineTo(w / 2 - 36, 170);
    } else {
      g.rect(w / 2 - 22, 92, 44, 78);
    }
    g.fill();
    g.fillRect(w / 2 - 18, 168, 12, 40);
    g.fillRect(w / 2 + 6, 168, 12, 40);
    g.font = '400 28px "Bebas Neue"';
    g.textAlign = 'center';
    g.fillText(t(who === 'women' ? 'casino.sign.women' : 'casino.sign.men'), w / 2, 240);
  });
}

function wetFloorMat() {
  return signMat('wet-floor', 128, 256, (g, w, h) => {
    g.fillStyle = '#f2c418';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#111';
    g.beginPath();
    g.moveTo(w / 2, 30);
    g.lineTo(w - 20, 110);
    g.lineTo(20, 110);
    g.fill();
    g.fillStyle = '#f2c418';
    g.font = '700 50px "Inter"';
    g.textAlign = 'center';
    g.fillText('!', w / 2, 100);
    g.fillStyle = '#111';
    g.font = '400 30px "Bebas Neue"';
    g.fillText('CAUTION', w / 2, 160);
    g.font = '400 22px "Bebas Neue"';
    g.fillText('WET FLOOR', w / 2, 190);
    g.fillText('PISO MOJADO', w / 2, 216);
  });
}

// ---- elevators ---------------------------------------------------------------------------

function buildElevators(C) {
  const { M, glows } = C;
  const B = boxer(C);
  const E = ELEVATORS;
  const wx = SHELL.x0 + SKIN;
  // Dark marble surround wall section, brass doors, call panels, floor indicators.
  B(wx + 0.06, (F + CEIL_Y) / 2, (E.z0 + E.z1) / 2, 0.12, CEIL_Y - F, E.z1 - E.z0, M.marbleDark, { collide: true });
  for (const dz of E.doors) {
    B(wx + 0.13, F + 1.26, dz, 0.04, 2.52, 1.44, M.gold);
    for (const s of [-1, 1]) B(wx + 0.155, F + 1.2, dz + s * 0.3, 0.03, 2.38, 0.59, M.brass);
    B(wx + 0.17, F + 1.2, dz, 0.01, 2.38, 0.01, M.black, { castShadow: false });
    B(wx + 0.14, F + 2.75, dz, 0.04, 0.22, 0.5, M.black);
    C.add(new THREE.PlaneGeometry(0.42, 0.16).rotateY(Math.PI / 2).translate(wx + 0.165, F + 2.75, dz), floorIndicatorMat(dz), { uv: 'keep', castShadow: false });
    glows.add(new THREE.Vector3(wx + 0.17, F + 1.3, dz), new THREE.Vector3(1, 0, 0), [1.6, 2.8], 0xffd8a0, 0.12);
    const it = { id: `eldorado-elevator-${dz}`, kind: 'talk', position: new THREE.Vector3(wx + 0.3, F + 1.2, dz), radius: 0.7, reach: 2.2, describe: () => t('casino.it.elevator'), onInteract: () => C.toast(t('casino.msg.elevatorKey')) };
    C.interactables.push(it);
  }
  for (let i = 0; i < E.doors.length - 1; i++) {
    const cz = (E.doors[i] + E.doors[i + 1]) / 2;
    B(wx + 0.13, F + 1.15, cz, 0.03, 0.34, 0.14, M.brass);
    for (const [y, c] of [[1.22, 0xffd0a0], [1.08, 0xffd0a0]]) C.add(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12).rotateZ(Math.PI / 2).translate(wx + 0.15, F + y, cz), glow(c, 2.5), { castShadow: false });
    B(wx + 0.14, F + 0.95, cz, 0.03, 0.08, 0.08, M.black); // key card reader
  }
  // Header sign over the lobby, facing the floor.
  const hz = (E.z0 + E.z1) / 2;
  const hx = E.x1 + 0.2;
  B(hx, CEIL_Y - 0.55, hz, 0.1, 0.7, 5.2, M.wood);
  C.add(new THREE.PlaneGeometry(5.0, 0.62).rotateY(Math.PI / 2).translate(hx + 0.06, CEIL_Y - 0.55, hz), plaque('elevators', t('casino.sign.elevators'), t('casino.sign.hotelGuests'), { w: 1024, h: 130, style: 'wood', lit: 0.8 }), { uv: 'keep', castShadow: false });
  for (const oz of [-2.4, 2.4]) C.add(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6).translate(hx, CEIL_Y - 0.1, hz + oz), M.brass);
  C.spots.add(E.x0 + 3, hz, 4.0, 0.2, 0xffe0b8);
  C.pool.add({ pos: new THREE.Vector3(E.x0 + 2.5, F + 2.8, hz), color: 0xffd8a8, intensity: 3, distance: 7, weight: 0.5 });
}

function floorIndicatorMat(seed) {
  return signMat(`floor-ind-${Math.round(seed)}`, 128, 48, (g, w, h) => {
    g.fillStyle = '#080404';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff6a2a';
    g.font = '400 36px "Bebas Neue"';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const floors = ['L', '7', '14', '22'];
    g.fillText(floors[Math.round(seed) % 4], w / 2 + 10, h / 2 + 2);
    g.beginPath();
    g.moveTo(22, 30);
    g.lineTo(34, 14);
    g.lineTo(46, 30);
    g.fill();
  }, { lit: 2.4 });
}

// ---- escalators ---------------------------------------------------------------------------

function buildEscalators(C) {
  const { M } = C;
  const B = boxer(C);
  const E = ESCALATOR;
  const units = [[E.x0, (E.x0 + E.x1) / 2], [(E.x0 + E.x1) / 2, E.x1]];
  const run = E.zFoot - 19.0;
  const rise = run * E.slope;
  const ang = Math.atan(E.slope);
  const len = Math.hypot(run, rise);
  const zMid = (E.zFoot + 19.0) / 2;
  const stepMat = escalatorStepMat();
  C.escalatorTex = stepMat.map;
  for (const [ux0, ux1] of units) {
    const ux = (ux0 + ux1) / 2;
    const uw = ux1 - ux0;
    // Bottom landing (comb plate) and the incline.
    B(ux, F + 0.04, (E.zBottom + E.zFoot) / 2, uw - 0.4, 0.08, E.zBottom - E.zFoot, M.steel);
    const incline = new THREE.PlaneGeometry(uw - 0.42, len).rotateX(-Math.PI / 2).rotateX(ang).translate(ux, F + 0.08 + rise / 2, zMid);
    C.add(incline, stepMat, { uv: 'keep', castShadow: false });
    // Truss cladding (sides + underside) in bronze panels.
    for (const sx of [ux0 + 0.1, ux1 - 0.1]) {
      const side = new THREE.BoxGeometry(0.16, 1.1, len + 0.2).rotateX(ang).translate(sx, F + rise / 2 - 0.45, zMid);
      C.add(side, M.bronzeFrame);
      // Glass balustrade + black handrail.
      const glass = new THREE.BoxGeometry(0.02, 0.92, len + 0.6).rotateX(ang).translate(sx, F + rise / 2 + 0.55, zMid);
      C.add(glass, C.M.glass, { castShadow: false });
      const rail = new THREE.BoxGeometry(0.08, 0.06, len + 0.8).rotateX(ang).translate(sx, F + rise / 2 + 1.03, zMid);
      C.add(rail, M.rubber);
      B(sx, F + 0.5, E.zFoot + 0.55, 0.16, 1.0, 1.1, M.bronzeFrame);
      B(sx, F + 1.02, E.zFoot + 0.7, 0.08, 0.06, 1.0, M.rubber);
    }
    B(ux, F + rise / 2 - 1.0, zMid, uw, 0.1, len, M.bronzeFrame, { castShadow: false });
  }
  // Under the incline: a paneled wedge wall to the floor (nobody walks under an escalator).
  const wz0 = 26.0;
  const wz1 = E.zFoot;
  const zTop0 = wz1 - 0.92 / E.slope; // where the truss underside meets the floor
  const hTop = 0.08 + (wz1 - wz0) * E.slope - 1.0;
  // West face: shape x = world z, facing -x. East face: shape x = -world z, rotated to face +x.
  for (const [sx, sgn] of [[E.x0 - 0.002, 1], [E.x1 + 0.002, -1]]) {
    const wedge = new THREE.Shape([new THREE.Vector2(sgn * zTop0, 0), new THREE.Vector2(sgn * wz0, 0), new THREE.Vector2(sgn * wz0, hTop)]);
    const g = new THREE.ShapeGeometry(wedge).rotateY((-sgn * Math.PI) / 2);
    C.add(g.translate(sx, F, 0), M.wallRed, { castShadow: false });
  }
  C.colliders.aabb(E.x0, F, wz0, E.x1, F + 4.2, wz1);
  // Stanchions with velvet rope + closed sign at the foot.
  const sz = E.zBottom + 0.5;
  const posts = [E.x0 - 0.1, (E.x0 + E.x1) / 2, E.x1 + 0.1];
  for (const px of posts) stanchion(C, px, sz);
  for (let i = 0; i < posts.length - 1; i++) rope(C, posts[i], sz, posts[i + 1], sz);
  C.colliders.aabb(E.x0 - 0.3, F, E.zFoot - 0.2, E.x1 + 0.3, F + 1.05, sz + 0.12);
  const sign = plaque('skyway-closed', t('casino.sign.skyway'), t('casino.sign.skywayClosed'), { w: 1024, h: 260, style: 'lit' });
  const cx = (E.x0 + E.x1) / 2;
  B(cx, F + 1.3, sz + 0.25, 1.2, 0.45, 0.04, M.brass);
  C.add(new THREE.PlaneGeometry(1.14, 0.4).translate(cx, F + 1.3, sz + 0.272), sign, { uv: 'keep', castShadow: false });
  C.add(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8).translate(cx, F + 0.55, sz + 0.25), M.brass);
  C.interactables.push({ id: 'eldorado-escalator', kind: 'talk', position: new THREE.Vector3(cx, F + 1.0, sz), radius: 1.6, reach: 2.4, describe: () => t('casino.it.escalator'), onInteract: () => C.toast(t('casino.msg.skyway')) });
  // Overhead sign at the ceiling edge of the well.
  const ws = ESCALATOR.well;
  B(cx, CEIL_Y - 0.35, ws.z1 + 0.05, ws.x1 - ws.x0, 0.7, 0.1, M.wood);
  C.add(new THREE.PlaneGeometry(ws.x1 - ws.x0 - 0.2, 0.6).translate(cx, CEIL_Y - 0.35, ws.z1 + 0.11), plaque('skyway-hdr', t('casino.sign.skyway'), '', { w: 1024, h: 140, style: 'wood', lit: 0.8 }), { uv: 'keep', castShadow: false });
}

function escalatorStepMat() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  for (let y = 0; y < 256; y += 32) {
    g.fillStyle = '#8a8c8e';
    g.fillRect(0, y, 128, 26);
    g.fillStyle = '#2a2a2c';
    g.fillRect(0, y + 26, 128, 6);
    for (let x = 4; x < 128; x += 6) {
      g.fillStyle = '#5a5c5e';
      g.fillRect(x, y, 2, 26);
    }
    g.fillStyle = '#e8c018';
    g.fillRect(0, y, 6, 26);
    g.fillRect(122, y, 6, 26);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 6);
  const m = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.4 });
  m.name = 'escalator-steps';
  return m;
}

export function stanchion(C, x, z) {
  const { M } = C;
  C.add(new THREE.CylinderGeometry(0.15, 0.17, 0.04, 20).translate(x, F + 0.02, z), M.brass);
  C.add(new THREE.CylinderGeometry(0.025, 0.025, 0.92, 10).translate(x, F + 0.5, z), M.brass);
  C.add(new THREE.SphereGeometry(0.045, 12, 8).translate(x, F + 0.98, z), M.brass);
  C.colliders.cylinder(x, F, z, 0.16, 1.0);
}

export function rope(C, x0, z0, x1, z1) {
  const a = new THREE.Vector3(x0, F + 0.9, z0);
  const b = new THREE.Vector3(x1, F + 0.9, z1);
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= 0.2;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  C.add(new THREE.TubeGeometry(curve, 16, 0.022, 8, false), C.M.fabric);
}

// ---- car giveaway --------------------------------------------------------------------------

function buildCarDisplay(C) {
  const { M, glows, spots, pool } = C;
  const cx = -45.0;
  const cz = 27.4;
  const R = 2.85;
  // Fixed plinth with a chrome edge and an LED ring; the top disc and the car rotate.
  C.add(new THREE.CylinderGeometry(R + 0.1, R + 0.15, 0.16, 64).translate(cx, F + 0.08, cz), M.black);
  C.add(new THREE.TorusGeometry(R + 0.12, 0.02, 6, 96).rotateX(Math.PI / 2).translate(cx, F + 0.12, cz), M.chrome);
  C.add(new THREE.TorusGeometry(R + 0.14, 0.012, 6, 96).rotateX(Math.PI / 2).translate(cx, F + 0.05, cz), glow(0xffd070, 4));
  glows.add(new THREE.Vector3(cx, F + 0.012, cz), UP, (R + 0.6) * 2, 0xffc860, 0.18);
  const pivot = new THREE.Group();
  pivot.name = 'car-turntable';
  pivot.position.set(cx, F + 0.16, cz);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.06, 64), M.marbleDark);
  disc.position.y = 0.03;
  disc.receiveShadow = true;
  pivot.add(disc);
  try {
    const cb = new StaticBatch({ chunkSize: 1000, name: 'giveaway-car' });
    parkedCar(cb, new Colliders(null), { x: 0, y: 0.06, z: 0, ry: 0.3, type: 'coupe', color: 0x9a0f18, seed: 7 });
    const built = cb.build();
    pivot.add(built.group);
  } catch (e) {
    console.warn('[casino] giveaway car failed', e);
  }
  C.group.add(pivot);
  C.colliders.cylinder(cx, F, cz, R + 0.6, 1.0);
  // Stanchions + rope ring.
  const n = 10;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * (R + 0.55), cz + Math.sin(a) * (R + 0.55)]);
  }
  for (const [x, z] of pts) stanchion(C, x, z);
  for (let k = 0; k < n; k++) {
    const [x0, z0] = pts[k];
    const [x1, z1] = pts[(k + 1) % n];
    rope(C, x0, z0, x1, z1);
  }
  // Promo sign facing the 4th St door.
  const sx = cx;
  const sz = cz - R - 1.4;
  const sign = signMat('giveaway', 512, 640, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5a0a10');
    gr.addColorStop(1, '#1a0204');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8b25a';
    g.lineWidth = 10;
    g.strokeRect(16, 16, w - 32, h - 32);
    g.textAlign = 'center';
    g.fillStyle = goldFill(g, 60, 200);
    g.font = '400 110px "Bebas Neue"';
    g.fillText('WIN', w / 2, 150);
    g.fillText('THIS CAR', w / 2, 255);
    g.fillStyle = '#f4e6c4';
    g.font = 'italic 400 40px "Playfair Display"';
    g.fillText('Weekly drawing', w / 2, 340);
    g.font = '400 46px "Bebas Neue"';
    g.fillText('SATURDAYS 8 PM', w / 2, 410);
    g.font = '400 30px "Inter"';
    g.fillStyle = '#d8c8a0';
    fitFont(g, 'Earn entries with your Players Club card', w - 70, 30, (s) => `400 ${s}px "Inter"`);
    g.fillText('Earn entries with your Players Club card', w / 2, 500);
    g.font = '400 22px "Inter"';
    g.fillText('Must be present to win. Taxes are the winner\'s responsibility.', w / 2, 590);
  }, { lit: 0.6 });
  C.add(new THREE.BoxGeometry(1.0, 1.26, 0.05).translate(sx, F + 1.25, sz), M.brass);
  C.add(new THREE.PlaneGeometry(0.94, 1.18).rotateY(Math.PI).translate(sx, F + 1.25, sz - 0.027), sign, { uv: 'keep', castShadow: false });
  C.add(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8).translate(sx, F + 0.33, sz), M.brass);
  C.add(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 20).translate(sx, F + 0.02, sz), M.brass);
  C.colliders.cylinder(sx, F, sz, 0.24, 1.9);
  spots.add(cx, cz, 3.4, 0.45, 0xfff0d8);
  pool.add({ pos: new THREE.Vector3(cx, F + 3.4, cz), color: 0xfff0dc, intensity: 6, distance: 9, weight: 1.1 });
  C.updaters.push((dt, ctx, st) => {
    pivot.rotation.y += dt * 0.12;
    void st;
  });
  return { pivot };
}

// ---- hanging directional signs -------------------------------------------------------------

function buildHangingSigns(C) {
  const { M } = C;
  // [x, z, yaw (facing direction of the FRONT), rows: [key, arrow (relative to the front)]]
  const list = [
    [-23.4, 50.0, Math.PI / 2, [['casino.sign.cashier', 'up'], ['casino.sign.tables', 'left'], ['casino.sign.restrooms', 'left'], ['casino.sign.elevators', 'right']]],
    [-60.2, 50.0, -Math.PI / 2, [['casino.sign.cashier', 'up'], ['casino.sign.restrooms', 'right'], ['casino.sign.elevators', 'left']]],
    [-45.0, 37.0, 0, [['casino.sign.cashier', 'right'], ['casino.sign.tables', 'up'], ['casino.sign.restrooms', 'right'], ['casino.sign.bar', 'left']]],
    [-62.0, 72.0, -Math.PI / 2, [['casino.sign.restrooms', 'left'], ['casino.sign.cashier', 'right']]],
  ];
  const y = CEIL_Y - 0.8;
  for (const [x, z, yaw, rows] of list) {
    const front = directoryMat(rows, false);
    const back = directoryMat(rows, true);
    const w = 2.0;
    const h = 0.2 + rows.length * 0.24;
    const m4 = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
    C.add(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.07).applyMatrix4(m4), M.wood);
    C.add(new THREE.BoxGeometry(w + 0.12, 0.03, 0.09).translate(0, h / 2 + 0.04, 0).applyMatrix4(m4), M.gold);
    C.add(new THREE.PlaneGeometry(w, h).translate(0, 0, 0.037).applyMatrix4(m4), front, { uv: 'keep', castShadow: false });
    C.add(new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, 0, -0.037).applyMatrix4(m4), back, { uv: 'keep', castShadow: false });
    for (const ox of [-0.85, 0.85]) C.add(new THREE.CylinderGeometry(0.01, 0.01, CEIL_Y - y - h / 2, 6).translate(ox, (CEIL_Y - y + h / 2) / 2, 0).applyMatrix4(m4), M.brass);
  }
}

function directoryMat(rows, mirrored) {
  const key = `dir:${rows.map((r) => r.join('/')).join('|')}:${mirrored}`;
  const H = 40 + rows.length * 96;
  return signMat(key, 1024, H, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2a140a');
    gr.addColorStop(1, '#170a04');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a24f';
    g.lineWidth = 4;
    g.strokeRect(10, 10, w - 20, h - 20);
    rows.forEach(([k, arrow], i) => {
      const y = 20 + i * 96 + 58;
      let a = arrow;
      if (mirrored && (a === 'left' || a === 'right')) a = a === 'left' ? 'right' : 'left';
      g.fillStyle = goldFill(g, y - 40, y + 10);
      g.textBaseline = 'alphabetic';
      const txt = t(k);
      fitFont(g, txt, w - 260, 62, (s) => `700 ${s}px "Playfair Display"`);
      g.textAlign = a === 'right' ? 'left' : 'right';
      const tx = a === 'right' ? 60 : w - 60;
      g.fillText(txt, a === 'up' ? w - 160 : tx, y);
      drawArrow(g, a === 'right' ? w - 110 : 110, y - 22, a);
      if (i < rows.length - 1) {
        g.fillStyle = 'rgba(201,162,79,.35)';
        g.fillRect(40, y + 26, w - 80, 2);
      }
    });
  }, { lit: 0.9 });
}

function drawArrow(g, x, y, dir) {
  g.save();
  g.translate(x, y);
  g.rotate(dir === 'left' ? Math.PI : dir === 'up' ? -Math.PI / 2 : 0);
  g.fillStyle = '#e8c878';
  g.beginPath();
  g.moveTo(-34, -9);
  g.lineTo(6, -9);
  g.lineTo(6, -24);
  g.lineTo(36, 0);
  g.lineTo(6, 24);
  g.lineTo(6, 9);
  g.lineTo(-34, 9);
  g.closePath();
  g.fill();
  g.restore();
}

export { DOWN };
