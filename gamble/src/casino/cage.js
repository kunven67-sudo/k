// The cashier cage on the west wall (DESIGN §8, §9, §19): barred brass-and-glass windows over a
// marble counter, the cage interior (drawers, counting machine, vault door) lit behind the glass,
// a cashier at window 2; two TITO redemption kiosks and an ATM beside it.
//
// Walk up to a window and press E: a card-table dialog opens (green felt, chip buttons):
//   Buy chips    $20 / $50 / $100 / $500 / all cash / other amount → chips.buyIn (cage spread)
//   Cash out     this casino's chips → cash, counted out (cage.drawer + cash.count); other casinos'
//                chips are politely refused
//   Tickets      redeem TITO vouchers (expired / other-casino tickets refused politely)
// The cashier answers in a speech bubble with her own voice. Kiosk: tickets → bills + coins.
// ATM: reads money.bank, $8 fee, declines when short.
//
// Also keeps a 'chips' pocket item per casino in sync with chips.js (the pockets view draws it).
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { t } from '../core/i18n.js';
import { input } from '../core/input.js';
import { save } from '../core/save.js';
import { audio } from '../core/audio.js';
import { el, injectStyle, formatMoney } from '../core/util.js';
import { overlay, chipTabs, button } from '../ui/kit.js';
import { ensureStyles } from '../ui/styles.js';
import { uiSound, vary } from '../ui/sfx.js';
import { addCash, slice } from '../life/state.js';
import { chips, breakdown, DENOMS, denomInfo } from './chips.js';
import { tickets } from './tickets.js';
import { channelLetters } from '../world/shared/letters.js';
import { FLOOR_Y, CEIL_Y, CAGE, CAGE_WINDOWS, KIOSKS, ATM, SHELL, SKIN } from './layout.js';
import { glow, signMat, goldFill, fitFont } from './interior/mats.js';
import { plaque } from './interior/fixtures.js';

const F = FLOOR_Y;
const CASINO = 'eldorado';
const CASINO_NAMES = { eldorado: 'Eldorado', 'silver-legacy': 'Silver Legacy', 'circus-circus': 'Circus Circus', peppermill: 'Peppermill', atlantis: 'Atlantis', 'golden-sierra': 'Golden Sierra' };
const casinoName = (c) => CASINO_NAMES[c] || c;
const money = (v) => formatMoney(v, { cents: Math.round(v * 100) % 100 !== 0 });

// ---- chips as a pocket item ------------------------------------------------------------------

function syncChipPockets() {
  try {
    const inv = slice('inventory');
    if (!inv.pockets) inv.pockets = [];
    const have = new Set(chips.casinos());
    inv.pockets = inv.pockets.filter((it) => it.kind !== 'chips' || have.has(it.casino));
    for (const c of have) {
      let it = inv.pockets.find((x) => x.kind === 'chips' && x.casino === c);
      if (!it) {
        it = { id: `chips-${c}`, kind: 'chips', casino: c };
        inv.pockets.push(it);
      }
      it.counts = chips.counts(c);
      it.total = chips.total(c);
      it.name = casinoName(c);
      it.number = money(it.total);
    }
    save.markDirty?.();
  } catch {
    /* no life (dev) */
  }
}
bus.on('chips:changed', syncChipPockets);
bus.on('life:loaded', syncChipPockets);

// ---- geometry ---------------------------------------------------------------------------------

export function buildCage(C) {
  const { M, add, colliders, glows, spots, pool } = C;
  const fx = CAGE.front; // counter face (x)
  const z0 = CAGE.z0;
  const z1 = CAGE.z1;
  const cz = (z0 + z1) / 2;
  const wall = SHELL.x0 + SKIN;
  const top = CEIL_Y;
  const B = (x, y, z, w, h, d, mat, o = {}) => {
    const g = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    add(g, mat, o);
    return g;
  };
  const cTop = F + 1.07;
  // Counter: paneled walnut front, red marble top with a raised transaction ledge.
  B(fx - 0.35, F + 0.53, cz, 0.7, 1.06, z1 - z0, M.wood);
  B(fx - 0.33, F + 0.05, cz, 0.74, 0.1, z1 - z0, M.marbleDark);
  B(fx - 0.3, cTop + 0.03, cz, 0.84, 0.06, z1 - z0 + 0.08, M.marbleRed);
  const nPanel = Math.floor((z1 - z0) / 1.1);
  for (let i = 0; i < nPanel; i++) {
    const pz = z0 + (i + 0.5) * ((z1 - z0) / nPanel);
    B(fx + 0.005, F + 0.58, pz, 0.02, 0.72, (z1 - z0) / nPanel - 0.18, M.woodLight);
    B(fx + 0.018, F + 0.58, pz, 0.01, 0.58, (z1 - z0) / nPanel - 0.32, M.wood);
  }
  // Side walls of the cage (to the ceiling) and the fascia above the windows.
  for (const zz of [z0, z1]) {
    B((wall + fx) / 2, (F + top) / 2, zz, fx - wall + 0.1, top - F, 0.24, M.wallRed);
    B(fx + 0.02, (F + top) / 2, zz, 0.36, top - F, 0.5, M.marbleSlab);
    B(fx + 0.02, top - 0.6, zz, 0.44, 0.12, 0.58, M.gold);
    colliders.box((wall + fx) / 2, (F + top) / 2, zz, fx - wall + 0.4, top - F, 0.5);
  }
  const yBars = cTop + 0.06;
  const yHead = F + 2.72;
  B(fx - 0.05, (yHead + top) / 2, cz, 0.3, top - yHead, z1 - z0, M.wood);
  B(fx + 0.11, yHead + 0.03, cz, 0.06, 0.06, z1 - z0, M.gold);
  B(fx + 0.11, top - 0.1, cz, 0.08, 0.08, z1 - z0, M.gold);
  channelLetters(C, t('casino.sign.cashier'), {
    font: '"Playfair Display"', weight: 700, height: 0.5, depth: 0.06, tracking: 0.22,
    matrix: new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(fx + 0.11, yHead + 0.42, cz),
    face: glow(0xffd27a, 3.6), side: M.gold, chunk: 'casino',
  });
  add(new THREE.PlaneGeometry(5.2, 0.24).rotateY(Math.PI / 2).translate(fx + 0.115, yHead + 0.2, cz), plaque('cage-sub', t('casino.sign.cage'), '', { w: 1024, h: 64, style: 'wood', lit: 0.6 }), { uv: 'keep', castShadow: false });
  glows.wash(new THREE.Vector3(fx + 0.13, yHead + 0.55, cz), new THREE.Vector3(1, 0, 0), 9, 1.6, 0xffc880, 0.35);

  // Window bays: piers between windows, brass bars over glass, an arched header and a deal tray.
  const bays = [];
  const edges = [z0 + 0.25];
  for (let i = 0; i < CAGE_WINDOWS.length - 1; i++) edges.push((CAGE_WINDOWS[i] + CAGE_WINDOWS[i + 1]) / 2);
  edges.push(z1 - 0.25);
  for (let i = 0; i < edges.length; i++) {
    const pz = edges[i];
    B(fx - 0.05, (yBars + yHead) / 2, pz, 0.26, yHead - yBars, 0.3, M.marbleSlab);
    B(fx + 0.09, yBars + 0.05, pz, 0.08, 0.1, 0.36, M.gold);
  }
  const barGeos = [];
  const bars = new THREE.CylinderGeometry(0.011, 0.011, 1, 6);
  CAGE_WINDOWS.forEach((wz, wi) => {
    const a = edges[wi] + 0.15;
    const b = edges[wi + 1] - 0.15;
    const w = b - a;
    const mid = (a + b) / 2;
    // Glass pane set back, bars in front, arch header in gilt.
    add(new THREE.PlaneGeometry(w, yHead - yBars - 0.1).rotateY(Math.PI / 2).translate(fx - 0.08, (yBars + yHead) / 2, mid), M.glass, { castShadow: false });
    for (let z = a + 0.05; z < b - 0.02; z += 0.1) {
      const h = yHead - yBars - 0.35;
      barGeos.push(bars.clone().scale(1, h, 1).translate(fx + 0.03, yBars + 0.03 + h / 2, z));
    }
    B(fx + 0.03, yBars + 0.18, mid, 0.03, 0.025, w, M.brass);
    B(fx + 0.03, yHead - 0.36, mid, 0.03, 0.025, w, M.brass);
    // The arch: a gilt half-ring over each window.
    add(new THREE.TorusGeometry(w / 2, 0.035, 8, 32, Math.PI).rotateY(Math.PI / 2).translate(fx + 0.05, yHead - 0.36, mid).scale(1, 1, 1), M.gold);
    // Pass-through slot + deal tray (brass scoop sunk into the counter).
    B(fx + 0.0, yBars + 0.07, mid, 0.06, 0.1, 0.5, M.black);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.36, 24, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(fx - 0.05, cTop + 0.02, mid), M.brass, { castShadow: false });
    // Window number / status plaque.
    const open = wi === 1;
    add(new THREE.PlaneGeometry(0.42, 0.13).rotateY(Math.PI / 2).translate(fx + 0.06, yHead - 0.2, mid), plaque(`cage-win-${wi}`, open ? `${wi + 1}` : t('casino.cage.title'), open ? '' : 'NEXT WINDOW PLEASE', { w: 384, h: 120, style: open ? 'brass' : 'lit' }), { uv: 'keep', castShadow: false });
    bays.push({ z: mid, open });
  });
  add(mergeBars(barGeos), M.brass, { castShadow: false });
  // Cage interior: back counter with drawers and a counting machine, monitors, vault door.
  const ix = wall + 0.4;
  B(ix + 0.05, F + 0.5, cz, 0.8, 1.0, z1 - z0 - 0.6, M.woodLight);
  B(ix + 0.05, F + 1.02, cz, 0.86, 0.04, z1 - z0 - 0.6, M.marbleDark);
  B(fx - 1.05, F + 0.48, cz, 0.6, 0.96, z1 - z0 - 0.8, M.steel); // teller pedestals
  B(fx - 1.05, F + 0.98, cz, 0.66, 0.04, z1 - z0 - 0.7, M.marbleDark);
  for (const wz of CAGE_WINDOWS) {
    for (let k = 0; k < 3; k++) B(fx - 0.76, F + 0.25 + k * 0.24, wz, 0.02, 0.2, 0.5, M.steel);
    B(fx - 0.76, F + 0.25, wz + 0.2, 0.03, 0.03, 0.08, M.chrome);
    B(fx - 1.15, F + 1.22, wz - 0.35, 0.05, 0.32, 0.46, M.black);
    add(new THREE.PlaneGeometry(0.42, 0.28).rotateY(Math.PI / 2).translate(fx - 1.12, F + 1.22, wz - 0.35), cageScreenMat(), { uv: 'keep', castShadow: false });
    B(fx - 1.1, F + 1.08, wz + 0.25, 0.26, 0.16, 0.3, M.black); // bill counter
    B(fx - 1.0, F + 1.17, wz + 0.25, 0.08, 0.02, 0.2, M.paper);
  }
  // Vault door on the back wall.
  const vz = cz + 4.2;
  add(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 48).rotateZ(Math.PI / 2).translate(wall + 0.1, F + 1.25, vz), M.steel);
  add(new THREE.TorusGeometry(0.95, 0.06, 10, 48).rotateY(Math.PI / 2).translate(wall + 0.18, F + 1.25, vz), M.chrome);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8).rotateX(a).translate(wall + 0.26, F + 1.25, vz), M.chrome);
  }
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 20).rotateZ(Math.PI / 2).translate(wall + 0.24, F + 1.25, vz), M.brass);
  // Interior lights (cool-white fluorescent troffers like a real cage) + glow on the back wall.
  for (let z = z0 + 1.6; z < z1 - 1; z += 3.2) {
    B((wall + fx) / 2, top - 0.02, z, 1.2, 0.03, 0.6, glow(0xf4f6ff, 2.2), { castShadow: false });
    glows.add(new THREE.Vector3(wall + 0.02, F + 2.2, z), new THREE.Vector3(1, 0, 0), [2.6, 2.4], 0xf0f2ff, 0.12);
  }
  spots.add(fx + 1.4, cz, 4.0, 0.3, 0xffe2bc);
  pool.add({ pos: new THREE.Vector3(fx - 1.6, F + 3.4, cz), color: 0xf2f2ff, intensity: 4, distance: 7, weight: 0.8 });
  pool.add({ pos: new THREE.Vector3(fx + 1.2, F + 3.0, cz), color: 0xffd8a8, intensity: 4, distance: 8, weight: 0.9 });
  // Collider: the counter front per window (each owns its window's interaction), plus a wall
  // behind the bars up to the header so nobody climbs over the counter.
  const windows = [];
  bays.forEach((bay, i) => {
    const a = edges[i];
    const b = edges[i + 1];
    const it = {
      id: `eldorado-cage-${i + 1}`,
      kind: 'talk',
      position: new THREE.Vector3(fx + 0.1, F + 1.45, bay.z),
      radius: 0.7,
      reach: 2.4,
      describe: () => t('casino.it.cage'),
      onInteract: (player) => C.cage?.open(player),
    };
    windows.push(it);
    colliders.box(fx - 0.35, (F + yHead) / 2, (a + b) / 2, 0.75, yHead - F, b - a, 0, { owner: it });
  });
  colliders.box((wall + fx) / 2, (F + top) / 2, cz, fx - wall - 0.7, top - F, z1 - z0);
  C.interactables.push(...windows);

  // ---- kiosks + ATM ----
  for (let i = 0; i < KIOSKS.length; i++) kiosk(C, KIOSKS[i], i);
  atm(C, ATM);

  return {
    stand: { pos: new THREE.Vector3(fx - 0.62, F, CAGE_WINDOWS[1]), yaw: Math.PI / 2 },
  };
}

function mergeBars(geos) {
  const g = new THREE.BufferGeometry();
  const parts = geos.map((x) => (x.index ? x.toNonIndexed() : x));
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    o += p.attributes.position.count;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

function cageScreenMat() {
  return signMat('cage-screen', 256, 170, (g, w, h) => {
    g.fillStyle = '#0a1830';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1e4a8a';
    g.fillRect(0, 0, w, 22);
    g.fillStyle = '#e8f0ff';
    g.font = '600 13px "Inter"';
    g.fillText('CAGE · DRAWER 2', 8, 15);
    g.font = '400 13px "Inter"';
    g.fillStyle = '#9fd0ff';
    ['$100  x  42', '$20   x 180', '$5    x  95', '$1    x 210', 'CHIPS OUT  $18,450', 'TITO PAID  $6,212.75'].forEach((r, i) => g.fillText(r, 10, 44 + i * 21));
  }, { lit: 1.2 });
}

function kiosk(C, at, i) {
  const { M, add, colliders, glows } = C;
  const x = at.x;
  const z = at.z;
  const B = (bx, y, bz, w, h, d, mat, o) => add(new THREE.BoxGeometry(w, h, d).translate(bx, y, bz), mat, o);
  // Facing +x: body, slanted screen head, header sign, slots.
  B(x - 0.25, F + 0.65, z, 0.5, 1.3, 0.66, M.black);
  B(x - 0.25, F + 0.04, z, 0.56, 0.08, 0.72, M.chrome);
  const head = new THREE.BoxGeometry(0.42, 0.5, 0.66).rotateZ(-0.35).translate(x - 0.22, F + 1.5, z);
  add(head, M.black);
  add(new THREE.PlaneGeometry(0.56, 0.38).rotateY(Math.PI / 2).rotateZ(-0.35).translate(x - 0.005, F + 1.52, z), kioskMat(), { uv: 'keep', castShadow: false });
  B(x - 0.25, F + 1.98, z, 0.46, 0.26, 0.7, M.darkRed);
  add(new THREE.PlaneGeometry(0.66, 0.22).rotateY(Math.PI / 2).translate(x - 0.018, F + 1.98, z), plaque('kiosk-hdr', t('casino.sign.kiosk'), '', { w: 512, h: 160, style: 'wood', lit: 1.2 }), { uv: 'keep', castShadow: false });
  B(x + 0.005, F + 1.06, z - 0.15, 0.02, 0.05, 0.22, M.chrome); // ticket in
  B(x + 0.005, F + 0.82, z + 0.05, 0.02, 0.06, 0.36, M.chrome); // bill dispenser
  B(x + 0.008, F + 0.82, z + 0.05, 0.01, 0.025, 0.3, glow(0x40ff80, 1.4), { castShadow: false });
  B(x + 0.005, F + 0.6, z - 0.15, 0.03, 0.12, 0.2, M.steel); // coin cup
  glows.add(new THREE.Vector3(x + 0.03, F + 1.5, z), new THREE.Vector3(1, 0, 0), 1.2, 0x80a0ff, 0.25);
  colliders.box(x - 0.25, F + 1.0, z, 0.56, 2.0, 0.72);
  const it = {
    id: `eldorado-kiosk-${i}`,
    kind: 'talk',
    position: new THREE.Vector3(x + 0.05, F + 1.4, z),
    radius: 0.45,
    reach: 2.2,
    describe: () => t('casino.it.kiosk'),
    onInteract: (player) => C.cage?.openKiosk(player),
  };
  C.interactables.push(it);
}

function kioskMat() {
  return signMat('tito-kiosk-screen', 256, 176, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0c2a6a');
    gr.addColorStop(1, '#040a20');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.fillStyle = '#ffd96a';
    g.font = '400 30px "Bebas Neue"';
    g.fillText(t('casino.kiosk.insert').toUpperCase(), w / 2, 60);
    g.strokeStyle = '#ffd96a';
    g.lineWidth = 3;
    g.strokeRect(80, 82, 96, 46);
    for (let x = 88; x < 170; x += 4) {
      g.fillStyle = x % 8 ? '#ffd96a' : 'transparent';
      g.fillRect(x, 90, 2, 30);
    }
    g.font = '400 14px "Inter"';
    g.fillStyle = '#c8d8ff';
    g.fillText('TITO · CASH · BREAK BILLS', w / 2, 156);
  }, { lit: 1.6 });
}

function atm(C, at) {
  const { M, add, colliders, glows } = C;
  const x = at.x;
  const z = at.z;
  const B = (bx, y, bz, w, h, d, mat, o) => add(new THREE.BoxGeometry(w, h, d).translate(bx, y, bz), mat, o);
  B(x - 0.3, F + 0.75, z, 0.6, 1.5, 0.74, M.steel);
  B(x - 0.3, F + 1.62, z, 0.5, 0.24, 0.78, M.darkRed);
  add(new THREE.PlaneGeometry(0.7, 0.2).rotateY(Math.PI / 2).translate(x - 0.045, F + 1.62, z), signMat('atm-hdr', 512, 140, (g, w, h) => {
    g.fillStyle = '#5a0a12';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = '400 96px "Bebas Neue"';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t('casino.sign.atm'), w * 0.36, h / 2 + 6);
    g.font = '400 30px "Inter"';
    g.fillStyle = '#ffd0d0';
    g.fillText(t('casino.sign.atmFee'), w * 0.75, h / 2 + 4);
  }, { lit: 1.3 }), { uv: 'keep', castShadow: false });
  // Recessed screen, keypad, card slot, cash dispenser.
  B(x - 0.02, F + 1.2, z, 0.06, 0.34, 0.46, M.black);
  add(new THREE.PlaneGeometry(0.4, 0.28).rotateY(Math.PI / 2).translate(x + 0.012, F + 1.2, z), signMat('atm-screen', 256, 180, (g, w, h) => {
    g.fillStyle = '#0a2a5a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = '400 26px "Bebas Neue"';
    g.textAlign = 'center';
    g.fillText('WELCOME', w / 2, 60);
    g.font = '400 15px "Inter"';
    g.fillText('Insert or tap your card', w / 2, 100);
    g.fillStyle = '#ffd56a';
    g.fillText('$8.00 surcharge applies', w / 2, 140);
  }, { lit: 1.4 }), { uv: 'keep', castShadow: false });
  const kp = new THREE.BoxGeometry(0.2, 0.03, 0.26).rotateZ(-0.4).translate(x + 0.02, F + 0.98, z);
  add(kp, M.chrome);
  B(x + 0.01, F + 1.02, z + 0.3, 0.03, 0.03, 0.1, glow(0x40ff80, 1.2), { castShadow: false });
  B(x + 0.01, F + 0.82, z, 0.03, 0.05, 0.34, M.black);
  glows.add(new THREE.Vector3(x + 0.04, F + 1.2, z), new THREE.Vector3(1, 0, 0), 0.9, 0x6090ff, 0.2);
  colliders.box(x - 0.3, F + 0.88, z, 0.62, 1.76, 0.76);
  C.interactables.push({
    id: 'eldorado-atm',
    kind: 'talk',
    position: new THREE.Vector3(x + 0.05, F + 1.15, z),
    radius: 0.45,
    reach: 2.2,
    describe: () => t('casino.it.atm'),
    onInteract: (player) => C.cage?.openAtm(player),
  });
}

// ---- the dialogs --------------------------------------------------------------------------------

const CSS = /* css */ `
.cg .gx-table { width: min(760px, 100%); }
.cg-wallet { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; padding: 2px 16px 6px; position: relative; z-index: 1; }
.cg-pill { display: flex; align-items: center; gap: 10px; padding: 7px 14px 7px 8px; border-radius: 999px; background: rgba(3,30,19,.45); box-shadow: inset 0 0 0 1.5px rgba(242,214,140,.28); }
.cg-pill b { font: 400 1.25em/1 var(--font-display); letter-spacing: .06em; color: #f6e2a6; }
.cg-pill span { font: 600 .68em/1.1 var(--font-ui); letter-spacing: .1em; text-transform: uppercase; color: #b9d2c2; }
.cg-ico { width: 30px; height: 30px; flex: none; }
.cg-say { min-height: 1.4em; text-align: center; font: italic 400 1.02em/1.4 var(--font-casino); color: #f3e3b8; padding: 4px 18px 10px; position: relative; z-index: 1; }
.cg-chips { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; padding: 10px 4px 6px; }
.cg-chip { all: unset; cursor: pointer; position: relative; width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center;
  --c: #b3202a; --s: #f4ecd8; --t: #fff6dd;
  background: radial-gradient(circle, var(--c) 0 43%, var(--s) 44% 47%, var(--c) 48% 100%), repeating-conic-gradient(from 8deg, var(--s) 0 14deg, var(--c) 14deg 45deg);
  box-shadow: 0 4px 0 rgba(0,0,0,.45), 0 8px 14px rgba(0,0,0,.35), inset 0 -3px 3px rgba(0,0,0,.35), inset 0 2px 2px rgba(255,255,255,.25);
  font: 400 1.25em/1 var(--font-display); letter-spacing: .04em; color: var(--t); text-shadow: 0 1px 0 rgba(0,0,0,.6);
  transition: transform .2s cubic-bezier(.3,1.6,.5,1), box-shadow .2s, filter .2s; }
.cg-chip small { display: block; font: 600 .42em/1 var(--font-ui); letter-spacing: .12em; text-align: center; opacity: .9; }
.cg-chip:hover, .cg-chip:focus-visible { transform: translateY(-4px) rotate(-6deg); }
.cg-chip[aria-pressed="true"] { transform: translateY(-7px) scale(1.06); box-shadow: 0 0 0 3px #f2d688, 0 0 22px rgba(246,216,138,.6), 0 10px 16px rgba(0,0,0,.45); }
.cg-chip:disabled { filter: grayscale(.8) brightness(.55); cursor: not-allowed; transform: none; }
.cg-row { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; padding: 10px 4px; }
.cg-input { display: flex; align-items: center; gap: 2px; padding: 0 14px; height: 46px; border-radius: 12px; background: #06261a; box-shadow: inset 0 2px 6px rgba(0,0,0,.7), 0 0 0 1.5px rgba(242,214,140,.4); }
.cg-input span { font: 400 1.5em/1 var(--font-display); color: #f2d688; }
.cg-input input { all: unset; width: 110px; font: 400 1.5em/1 var(--font-display); letter-spacing: .05em; color: #fbefcc; }
.cg-break { text-align: center; font: 500 .86em/1.4 var(--font-ui); color: #cfe3d4; min-height: 1.4em; }
.cg-break i { font-style: normal; color: #f6e2a6; }
.cg-stack { display: flex; gap: 10px; justify-content: center; align-items: flex-end; flex-wrap: wrap; padding: 6px; min-height: 80px; }
.cg-col { display: flex; flex-direction: column-reverse; align-items: center; }
.cg-col i { display: block; width: 46px; height: 7px; margin-top: -2px; border-radius: 50% / 100%; background: linear-gradient(90deg, var(--c) 0 12%, var(--s) 12% 22%, var(--c) 22% 40%, var(--s) 40% 50%, var(--c) 50% 68%, var(--s) 68% 78%, var(--c) 78%); box-shadow: 0 1px 0 rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.25); }
.cg-col b { margin-top: 6px; font: 400 .9em/1 var(--font-display); color: #e7cf8f; letter-spacing: .06em; }
.cg-tk { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding: 10px 12px; margin: 6px 0; border-radius: 10px; background: linear-gradient(180deg, #fbf8ef, #ece5d3); color: #2a2118; box-shadow: 0 3px 8px rgba(0,0,0,.35); }
.cg-tk .bc { width: 70px; height: 34px; background: repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 3px, #111 3px 4px, transparent 4px 7px, #111 7px 8px, transparent 8px 9px); opacity: .85; }
.cg-tk .amt { font: 700 1.4em/1 var(--font-casino); }
.cg-tk .meta { font: 500 .78em/1.35 var(--font-ui); color: #5a4a36; }
.cg-tk.bad { opacity: .7; }
.cg-tk.bad .amt { text-decoration: line-through; }
.cg-empty { text-align: center; padding: 22px 10px; font: italic 400 1em/1.5 var(--font-casino); color: #cfe3d4; opacity: .85; }
.cg-count { text-align: center; font: 400 2.2em/1 var(--font-display); color: #f6e2a6; letter-spacing: .06em; min-height: 1.1em; padding: 6px; }
.cg-note { text-align: center; font: 500 .82em/1.4 var(--font-ui); color: #f0c8a0; padding: 4px 10px; }
/* ATM: a real terminal, not the felt */
.atm-box { width: min(560px, 100%); border-radius: 18px; padding: 18px; background: linear-gradient(180deg, #8d9196, #5e6267); box-shadow: 0 30px 70px rgba(0,0,0,.7), inset 0 2px 0 rgba(255,255,255,.4), inset 0 -3px 0 rgba(0,0,0,.3); display: grid; grid-template-columns: 70px 1fr 70px; gap: 10px; }
.atm-scr { grid-column: 2; min-height: 300px; border-radius: 6px; padding: 18px; background: radial-gradient(120% 90% at 50% 0%, #1b4a96, #0a2250 70%, #061638); box-shadow: inset 0 0 0 6px #0b0b0d, inset 0 0 30px rgba(0,0,0,.6); color: #e8f0ff; font: 500 1em/1.4 var(--font-ui); display: flex; flex-direction: column; gap: 8px; }
.atm-scr h3 { margin: 0; font: 400 1.6em/1 var(--font-display); letter-spacing: .08em; color: #fff; text-align: center; }
.atm-scr p { margin: 0; text-align: center; }
.atm-scr .bal { text-align: center; font: 400 2em/1 var(--font-display); color: #ffd96a; letter-spacing: .06em; }
.atm-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: auto; }
.atm-side { display: flex; flex-direction: column; justify-content: flex-end; gap: 10px; padding-bottom: 6px; }
.atm-key { all: unset; cursor: pointer; height: 38px; border-radius: 6px; background: linear-gradient(180deg, #d9dcdf, #a5a9ad); box-shadow: 0 3px 0 #4b4f53, inset 0 1px 0 #fff; }
.atm-key:active { transform: translateY(2px); box-shadow: 0 1px 0 #4b4f53; }
.atm-opt { all: unset; cursor: pointer; padding: 10px 12px; border-radius: 4px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); font: 400 1.2em/1 var(--font-display); letter-spacing: .06em; text-align: center; color: #fff; }
.atm-opt:hover, .atm-opt:focus-visible { background: rgba(255,217,106,.22); box-shadow: inset 0 0 0 1px #ffd96a; }
.atm-opt.cancel { grid-column: span 2; color: #ffb0a0; }
@media (max-width: 640px) { .cg-chip { width: 62px; height: 62px; } .atm-box { grid-template-columns: 1fr; } .atm-side { display: none; } .atm-scr { grid-column: 1; } }
`;

const CHIP_BTN = [
  { v: 20, c: '#e9e4d8', s: '#2b58a8', t: '#1c2a52' },
  { v: 50, c: '#b11d26', s: '#f4f0e6', t: '#fff6dd' },
  { v: 100, c: '#1c7a3b', s: '#f4f0e6', t: '#fff6dd' },
  { v: 500, c: '#1b1b1d', s: '#d8c08a', t: '#f2d688' },
];

export class Cage {
  constructor(C, people) {
    this.C = C;
    this.people = people;
    this.ov = null;
    injectStyle('casino-cage', CSS);
  }

  get cashier() {
    return this.people?.cashier;
  }

  _say(text) {
    if (this.sayEl) this.sayEl.textContent = `“${text}”`;
    if (this.cashier) this.people.speak(this.cashier, text, 2400);
  }

  _beginModal(player) {
    if (this.ov) return false;
    this.player = player || null;
    if (player) player.locked = true;
    this._lock = input.wantPointerLock;
    input.setPointerLock(false);
    return true;
  }

  _endModal() {
    this.ov?.close();
    this.ov = null;
    if (this.player) this.player.locked = false;
    input.setPointerLock(this._lock ?? true);
    this.player = null;
  }

  _sfx(name, o = {}) {
    try {
      audio.play(name, { bus: 'sfx', gain: 0.7, rate: vary(0.05), ...o });
    } catch {
      /* locked */
    }
  }

  // ---- cashier window --------------------------------------------------------------------------

  open(player) {
    if (!this._beginModal(player)) return false;
    ensureStyles();
    const root = this.C.engine.uiRoot || document.getElementById('ui-root');
    this.ov = overlay(root, { className: 'cg', onDismiss: () => this._close() });
    const head = el('div', { class: 'gx-head' }, [el('div', { class: 'gx-kicker', text: t('casino.cage.kicker') }), el('h2', { class: 'gx-title', text: t('casino.cage.title') })]);
    this.wallet = el('div', { class: 'cg-wallet' });
    this.sayEl = el('div', { class: 'cg-say' });
    this.body = el('div', { class: 'gx-body' });
    const tabs = chipTabs([
      { id: 'buy', label: t('casino.cage.tabBuy'), icon: 'content' },
      { id: 'cash', label: t('casino.cage.tabCash'), icon: 'access' },
      { id: 'tito', label: t('casino.cage.tabTito'), icon: 'graphics' },
    ], (id) => this._tab(id));
    const foot = el('div', { class: 'gx-foot' }, [button(t('casino.cage.done'), () => this._close(), { ghost: true, sound: 'ui.back' })]);
    const felt = el('div', { class: 'gx-felt' }, [head, this.wallet, tabs, this.sayEl, this.body, foot]);
    this.ov.el.appendChild(el('div', { class: 'gx-table', role: 'dialog', 'aria-modal': 'true' }, [felt]));
    tabs.select('buy');
    this._tab('buy');
    this._wallet();
    const hellos = ['casino.cage.hello', 'casino.cage.hello2', 'casino.cage.hello3'];
    this._say(t(hellos[Math.floor(Math.random() * hellos.length)]));
    this.offChips = bus.on('chips:changed', () => this._wallet());
    this.offMoney = bus.on('money:changed', () => this._wallet());
    return true;
  }

  _close() {
    this.offChips?.();
    this.offMoney?.();
    if (this.cashier && this.ov) this.people.speak(this.cashier, t('casino.cage.bye'), 1600);
    this._endModal();
  }

  _wallet() {
    if (!this.wallet) return;
    const cash = slice('money').cash || 0;
    const ch = chips.total(CASINO);
    this.wallet.replaceChildren(
      el('div', { class: 'cg-pill' }, [billIcon(), el('div', {}, [el('span', { text: t('casino.cage.cash') }), el('br'), el('b', { text: money(cash) })])]),
      el('div', { class: 'cg-pill' }, [chipIcon(), el('div', {}, [el('span', { text: t('casino.cage.chips') }), el('br'), el('b', { text: money(ch) })])])
    );
  }

  _tab(id) {
    this.body.replaceChildren();
    const sec = el('div', { class: 'gx-section' });
    this.body.appendChild(sec);
    if (id === 'buy') this._buyTab(sec);
    else if (id === 'cash') this._cashTab(sec);
    else this._titoTab(sec);
  }

  _buyTab(sec) {
    const cash = () => slice('money').cash || 0;
    let amount = 0;
    const brk = el('div', { class: 'cg-break' });
    const input = el('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', placeholder: '0', 'aria-label': t('casino.cage.custom') });
    const btnRow = el('div', { class: 'cg-chips' });
    const buyBtn = button(t('casino.cage.buy', { amount: '' }), () => buy(), { sound: 'ui.confirm' });
    const setAmount = (v, fromInput = false) => {
      amount = Math.max(0, Math.floor(v || 0));
      if (!fromInput) input.value = amount ? String(amount) : '';
      for (const b of btnRow.children) b.setAttribute('aria-pressed', String(+b.dataset.v === amount || (b.dataset.v === 'all' && amount === Math.floor(cash()) && amount > 0)));
      buyBtn.textContent = t('casino.cage.buy', { amount: amount ? money(amount) : '' });
      if (!amount) brk.textContent = '';
      else {
        const { counts } = breakdown(amount, 'cage');
        const parts = Object.entries(counts).sort((a, b) => +b[0] - +a[0]).map(([d, n]) => `${n} × ${money(+d)}`);
        brk.replaceChildren(document.createTextNode(`${t('casino.cage.denoms')}: `), el('i', { text: parts.join('  ·  ') }));
      }
    };
    for (const c of CHIP_BTN) {
      const b = el('button', { class: 'cg-chip', type: 'button', 'data-v': String(c.v) }, [`$${c.v}`]);
      b.style.setProperty('--c', c.c);
      b.style.setProperty('--s', c.s);
      b.style.setProperty('--t', c.t);
      b.disabled = cash() < c.v;
      b.addEventListener('click', () => {
        uiSound('ui.chip-place', { rate: vary(0.1) });
        setAmount(c.v);
      });
      btnRow.appendChild(b);
    }
    const all = el('button', { class: 'cg-chip', type: 'button', 'data-v': 'all' }, [el('div', {}, [document.createTextNode('ALL'), el('small', { text: t('casino.cage.all') })])]);
    all.style.setProperty('--c', '#5a2a8a');
    all.style.setProperty('--s', '#f2d24a');
    all.disabled = cash() < 1;
    all.addEventListener('click', () => {
      uiSound('ui.chip-place', { rate: vary(0.1) });
      setAmount(Math.floor(cash()));
    });
    btnRow.appendChild(all);
    input.addEventListener('input', () => setAmount(+input.value, true));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') buy();
    });
    const buy = () => {
      if (amount < 1) return this._say(t('casino.cage.min'));
      if (cash() < 1) return this._say(t('casino.cage.noCash'));
      if (amount > cash() + 1e-6) return this._say(t('casino.cage.short'));
      if (!addCash(-amount, 'cage-chips')) return this._say(t('casino.cage.short'));
      this._sfx('cash.bill');
      setTimeout(() => this._sfx('cage.drawer', { gain: 0.6 }), 250);
      setTimeout(() => this._sfx('chip.stack', { gain: 0.8 }), 700);
      setTimeout(() => this._sfx('chip.slide', { gain: 0.7 }), 950);
      chips.buyIn(amount, CASINO, 'cage');
      this._say(t('casino.cage.bought', { amount: money(amount) }));
      for (const b of btnRow.children) b.disabled = b.dataset.v === 'all' ? cash() < 1 : cash() < +b.dataset.v;
      setAmount(0);
    };
    sec.append(
      btnRow,
      el('div', { class: 'cg-row' }, [el('label', { class: 'cg-input' }, [el('span', { text: '$' }), input]), buyBtn]),
      brk
    );
    setAmount(0);
  }

  _cashTab(sec) {
    const counts = chips.counts(CASINO);
    const total = chips.total(CASINO);
    const others = chips.casinos().filter((c) => c !== CASINO);
    const stack = el('div', { class: 'cg-stack' });
    const desc = [...DENOMS].sort((a, b) => b.v - a.v);
    for (const d of desc) {
      const n = counts[d.v] || 0;
      if (!n) continue;
      const col = el('div', { class: 'cg-col' }, [el('b', { text: `${n} × ${money(d.v)}` })]);
      for (let i = 0; i < Math.min(12, n); i++) {
        const c = el('i');
        c.style.setProperty('--c', hex(d.color));
        c.style.setProperty('--s', hex(d.stripe));
        col.appendChild(c);
      }
      stack.appendChild(col);
    }
    const count = el('div', { class: 'cg-count' });
    if (total <= 0) {
      sec.append(el('div', { class: 'cg-empty', text: t('casino.cage.noChips') }));
    } else {
      const go = button(t('casino.cage.cashOut', { amount: money(total) }), () => {
        go.disabled = true;
        const v = chips.removeAll(CASINO, 'cashout');
        this._sfx('chip.slide');
        setTimeout(() => this._sfx('cage.drawer'), 300);
        // Counted out loud: the number rolls up while the bills riffle.
        const t0 = performance.now();
        const dur = Math.min(2200, 700 + v * 2);
        let n = 0;
        const tick = () => {
          const u = Math.min(1, (performance.now() - t0) / dur);
          count.textContent = money(Math.round(v * u * 100) / 100);
          if (Math.floor(u * 8) > n) {
            n = Math.floor(u * 8);
            this._sfx('cash.count', { gain: 0.5 });
          }
          if (u < 1 && this.ov) requestAnimationFrame(tick);
          else {
            addCash(v, 'cage-cashout');
            this._sfx('cash.bill', { gain: 0.6 });
            this._say(t('casino.cage.cashedOut', { amount: money(v) }));
            setTimeout(() => this.ov && this._tab('cash'), 900);
          }
        };
        requestAnimationFrame(tick);
      }, { sound: 'ui.confirm' });
      sec.append(stack, count, el('div', { class: 'cg-row' }, [go]));
    }
    for (const c of others) {
      const note = el('div', { class: 'cg-note', text: `${money(chips.total(c))} — ${t('casino.cage.foreign', { casino: casinoName(c) })}` });
      sec.append(note);
    }
    if (others.length && total <= 0) this._say(t('casino.cage.foreign', { casino: casinoName(others[0]) }));
  }

  _titoTab(sec) {
    const list = tickets.list();
    if (!list.length) {
      sec.append(el('div', { class: 'cg-empty', text: t('casino.cage.noTickets') }));
      return;
    }
    const valid = list.filter((tk) => tickets.isValid(tk, CASINO));
    const lang = document.documentElement.lang || 'en';
    for (const tk of list) {
      const ok = tickets.isValid(tk, CASINO);
      const date = new Date(tk.issuedMs).toLocaleDateString(lang, { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' });
      const btn = button(t('casino.cage.redeem'), () => this._redeem(tk), { sound: ok ? 'ui.confirm' : 'ui.back' });
      sec.append(el('div', { class: `cg-tk${ok ? '' : ' bad'}` }, [
        el('div', { class: 'bc' }),
        el('div', {}, [el('div', { class: 'amt', text: money(tk.amount) }), el('div', { class: 'meta', text: `${casinoName(tk.casino)} · ${t('casino.cage.issued', { date })} · ${tk.validation || ''}` })]),
        btn,
      ]));
    }
    if (valid.length > 1) {
      const sum = valid.reduce((s, tk) => s + tk.amount, 0);
      sec.append(el('div', { class: 'cg-row' }, [button(t('casino.cage.redeemAll', { amount: money(sum) }), () => {
        let paid = 0;
        for (const tk of valid) {
          const got = tickets.take(tk.id, 'cage');
          if (got) paid += got.amount;
        }
        if (paid > 0) this._pay(paid);
        this._tab('tito');
      }, { sound: 'ui.confirm' })]));
    }
  }

  _redeem(tk) {
    if (tk.casino !== CASINO) return this._say(t('casino.cage.otherCasino', { casino: casinoName(tk.casino) }));
    if (!tickets.isValid(tk, CASINO)) return this._say(t('casino.cage.expired'));
    const got = tickets.take(tk.id, 'cage');
    if (got) this._pay(got.amount);
    this._tab('tito');
  }

  _pay(v) {
    this._sfx('ui.paper', { bus: 'ui' });
    setTimeout(() => this._sfx('cage.drawer'), 250);
    setTimeout(() => this._sfx('cash.count', { gain: 0.6 }), 600);
    addCash(Math.round(v * 100) / 100, 'tito-cage');
    this._say(t('casino.cage.redeemed', { amount: money(v) }));
  }

  // ---- TITO kiosk ---------------------------------------------------------------------------

  openKiosk(player) {
    if (!this._beginModal(player)) return false;
    ensureStyles();
    const root = this.C.engine.uiRoot || document.getElementById('ui-root');
    this.ov = overlay(root, { className: 'cg', onDismiss: () => this._endModal() });
    const body = el('div', { class: 'gx-body' });
    const msg = el('div', { class: 'cg-say' });
    const render = () => {
      body.replaceChildren();
      const list = tickets.list();
      if (!list.length) {
        body.append(el('div', { class: 'cg-empty', text: t('casino.kiosk.none') }));
        return;
      }
      for (const tk of list) {
        const ok = tickets.isValid(tk, CASINO);
        const b = button(t('casino.cage.redeem'), () => {
          if (tk.casino !== CASINO) {
            this._sfx('ui.error', { bus: 'ui' });
            msg.textContent = t('casino.cage.otherCasino', { casino: casinoName(tk.casino) });
            return;
          }
          if (!ok) {
            this._sfx('ui.error', { bus: 'ui' });
            msg.textContent = t('casino.cage.expired');
            return;
          }
          const got = tickets.take(tk.id, 'kiosk');
          if (!got) return;
          // The kiosk pays whole dollars in bills and the cents from the coin hopper.
          const bills = Math.floor(got.amount + 1e-6);
          const coins = Math.round((got.amount - bills) * 100) / 100;
          this._sfx('slot.ticket-print', { gain: 0.4, rate: 0.8 });
          setTimeout(() => this._sfx('cash.count', { gain: 0.6 }), 500);
          if (coins > 0) setTimeout(() => this._sfx('coins.pour', { gain: 0.5 }), 1100);
          addCash(got.amount, 'tito-kiosk');
          msg.textContent = coins > 0 ? t('casino.kiosk.paid', { bills: money(bills), coins: money(coins) }) : t('casino.kiosk.paidBills', { bills: money(bills) });
          render();
        }, { sound: 'ui.confirm' });
        body.append(el('div', { class: `cg-tk${ok ? '' : ' bad'}` }, [el('div', { class: 'bc' }), el('div', {}, [el('div', { class: 'amt', text: money(tk.amount) }), el('div', { class: 'meta', text: `${casinoName(tk.casino)} · ${tk.validation || ''}` })]), b]));
      }
    };
    render();
    const felt = el('div', { class: 'gx-felt' }, [
      el('div', { class: 'gx-head' }, [el('div', { class: 'gx-kicker', text: t('casino.kiosk.kicker') }), el('h2', { class: 'gx-title', text: t('casino.kiosk.title') })]),
      msg,
      body,
      el('div', { class: 'gx-foot' }, [button(t('casino.cage.done'), () => this._endModal(), { ghost: true, sound: 'ui.back' })]),
    ]);
    this.ov.el.appendChild(el('div', { class: 'gx-table', role: 'dialog', 'aria-modal': 'true' }, [felt]));
    this._sfx('slot.ding', { gain: 0.25, rate: 1.4 });
    return true;
  }

  // ---- ATM ----------------------------------------------------------------------------------

  openAtm(player) {
    if (!this._beginModal(player)) return false;
    const root = this.C.engine.uiRoot || document.getElementById('ui-root');
    this.ov = overlay(root, { className: 'cg', onDismiss: () => this._endModal() });
    const scr = el('div', { class: 'atm-scr' });
    const keys = () => el('div', { class: 'atm-side' }, [0, 1, 2, 3].map(() => el('button', { class: 'atm-key', type: 'button', 'aria-hidden': 'true', tabindex: '-1' })));
    const box = el('div', { class: 'atm-box', role: 'dialog', 'aria-modal': 'true' }, [keys(), scr, keys()]);
    this.ov.el.appendChild(box);
    const beep = () => this._sfx('phone.tap', { bus: 'ui', gain: 0.5, rate: 1.6 });
    const FEE = 8;
    const home = () => {
      const m = slice('money');
      const bank = m.bank || 0;
      scr.replaceChildren(
        el('h3', { text: t('casino.atm.kicker') }),
        el('p', { text: t('casino.atm.balance') }),
        el('div', { class: 'bal', text: money(bank) }),
        el('p', { text: bank <= 0 ? t('casino.atm.noBank') : t('casino.atm.fee') })
      );
      const opts = el('div', { class: 'atm-opts' });
      for (const v of [20, 40, 60, 100, 200, 300]) {
        const b = el('button', { class: 'atm-opt', type: 'button', text: money(v) });
        b.addEventListener('click', () => {
          beep();
          withdraw(v);
        });
        opts.appendChild(b);
      }
      const c = el('button', { class: 'atm-opt cancel', type: 'button', text: t('casino.atm.cancel') });
      c.addEventListener('click', () => {
        beep();
        this._endModal();
      });
      opts.appendChild(c);
      scr.appendChild(opts);
    };
    const withdraw = (v) => {
      const m = slice('money');
      if ((m.bank || 0) < v + FEE) {
        this._sfx('ui.error', { bus: 'ui' });
        scr.replaceChildren(el('h3', { text: t('casino.atm.title') }), el('p', { text: t('casino.atm.insufficient') }));
        setTimeout(() => this.ov && home(), 1800);
        return;
      }
      m.bank = Math.round((m.bank - v - FEE) * 100) / 100;
      save.markDirty?.();
      scr.replaceChildren(el('h3', { text: t('casino.atm.title') }), el('p', { text: '…' }));
      this._sfx('cash.count', { gain: 0.6, rate: 0.9 });
      setTimeout(() => {
        addCash(v, 'atm');
        this._sfx('cash.bill', { gain: 0.6 });
        if (!this.ov) return;
        scr.replaceChildren(el('h3', { text: t('casino.atm.title') }), el('p', { text: t('casino.atm.dispensed', { amount: money(v) }) }), el('div', { class: 'bal', text: money(m.bank) }));
        setTimeout(() => this.ov && home(), 2200);
      }, 1300);
    };
    home();
    beep();
    return true;
  }

  dispose() {
    if (this.ov) this._endModal();
  }
}

function hex(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function billIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 60;
  c.className = 'cg-ico';
  const g = c.getContext('2d');
  g.translate(30, 30);
  g.rotate(-0.25);
  g.fillStyle = '#7d9a6a';
  g.fillRect(-26, -13, 52, 26);
  g.strokeStyle = '#3d5a30';
  g.lineWidth = 2;
  g.strokeRect(-23, -10, 46, 20);
  g.fillStyle = '#3d5a30';
  g.beginPath();
  g.arc(0, 0, 6, 0, Math.PI * 2);
  g.fill();
  return c;
}

function chipIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 60;
  c.className = 'cg-ico';
  const g = c.getContext('2d');
  for (let i = 0; i < 4; i++) {
    const y = 44 - i * 7;
    g.fillStyle = i % 2 ? '#1c7a3b' : '#b11d26';
    g.beginPath();
    g.ellipse(30, y, 22, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f4f0e6';
    for (let k = 0; k < 6; k++) g.fillRect(10 + k * 7.5, y - 1, 3, 4);
  }
  g.fillStyle = '#b11d26';
  g.beginPath();
  g.ellipse(30, 21, 22, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#f4f0e6';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(30, 21, 14, 5, 0, 0, Math.PI * 2);
  g.stroke();
  return c;
}

export { syncChipPockets, denomInfo, fitFont, goldFill };
