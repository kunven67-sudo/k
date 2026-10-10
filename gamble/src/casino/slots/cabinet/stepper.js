// Retro mechanical stepper ("Silverlode Classic Reel S3"): lacquered cabinet, three real spinning
// reel drums behind a glass window with a payline, a red-LED meter strip, a lit top glass with the
// paytable, a chrome lever with a red ball on the right side, a stainless coin tray and lit belly
// glass. Lever-only: no SPIN button (DESIGN §39) — the deck has CASH OUT, SERVICE, BET ONE,
// BET MAX. Retrofitted for TITO like every Nevada stepper still on a floor (printer + validator).

import * as THREE from 'three';
import { PartBag, matrixOf, sideProfileGeo, slopedPanel } from './parts.js';

export const STEPPER_DIM = {
  width: 0.64,
  panel: 0.03,
  reel: { radius: 0.1926, width: 0.098, gap: 0.112, cy: 1.215, frontZ: -0.046, stops: 22 },
  window: { w: 0.35, y0: 1.105, y1: 1.325, z: -0.022 },
};

const PROFILE = [
  [-0.56, 0.0],
  [0.045, 0.0],
  [0.045, 0.07],
  [0.0, 0.09],
  [0.0, 0.8],
  [0.16, 0.86],
  [0.208, 0.895],
  [0.212, 0.925],
  [0.183, 0.95],
  [-0.025, 0.985],
  [-0.025, 1.44],
  [-0.05, 1.475],
  [-0.075, 1.49],
  [-0.115, 1.92],
  [-0.15, 1.985],
  [-0.56, 1.985],
];

export function buildStepperCabinet({ variant = 'single', denomColor = 0xffd23a, tier = 'high' } = {}) {
  const D = STEPPER_DIM;
  const bag = new PartBag();
  const leds = [];
  const lit = [];
  const W = D.width;
  const T = D.panel;
  const Wi = W - T * 2;
  const seg = tier === 'low' ? 1 : 2;

  for (const s of [-1, 1]) {
    bag.add('body', sideProfileGeo(PROFILE, T, { bevel: 0.006 }), matrixOf(s < 0 ? -W / 2 + T : W / 2, 0, 0), { uvTile: 0.8 });
    // chrome edge band down the front of each side panel (classic look)
    const e1 = slopedPanel(0.014, -0.025, 0.985, -0.025, 1.44, 0.01, s * (W / 2 - T / 2), 0.004);
    bag.add('chrome', e1.geo, e1.matrix);
    const e2 = slopedPanel(0.014, -0.075, 1.49, -0.115, 1.92, 0.01, s * (W / 2 - T / 2), 0.004);
    bag.add('chrome', e2.geo, e2.matrix);
    const e3 = slopedPanel(0.014, 0.0, 0.1, 0.0, 0.8, 0.01, s * (W / 2 - T / 2), 0.004);
    bag.add('chrome', e3.geo, e3.matrix);
  }
  bag.box('dark', Wi, 1.97, 0.44, 0, 0.985, -0.34, { r: 0.004, seg });
  bag.box('rubber', Wi, 0.07, 0.045, 0, 0.035, 0.02, { r: 0.006, seg });

  // belly: painted door, coin tray, lit belly glass
  bag.box('body', Wi, 0.2, 0.03, 0, 0.19, -0.01, { r: 0.006, seg, uvTile: 0.8 });
  bag.box('body', Wi, 0.06, 0.03, 0, 0.77, -0.01, { r: 0.006, seg, uvTile: 0.8 });
  // coin tray (stainless): floor, front lip, sides, plus the dark chute mouth above it
  bag.box('chrome', Wi - 0.12, 0.012, 0.13, 0, 0.3, 0.05, { r: 0.004, seg });
  bag.box('chrome', Wi - 0.12, 0.06, 0.012, 0, 0.325, 0.115, { r: 0.004, seg });
  for (const s of [-1, 1]) bag.box('chrome', 0.012, 0.06, 0.13, s * ((Wi - 0.12) / 2), 0.325, 0.05, { r: 0.004 });
  bag.box('dark', Wi, 0.08, 0.03, 0, 0.33, -0.01, { r: 0.004 });
  bag.box('rubber', 0.16, 0.035, 0.01, 0, 0.345, 0.006, { r: 0.004 });
  const bellyW = Wi - 0.06;
  lit.push({ key: 'belly', geo: new THREE.PlaneGeometry(bellyW, 0.34), matrix: matrixOf(0, 0.555, 0.008) });
  bag.box('chrome', bellyW + 0.024, 0.012, 0.016, 0, 0.731, 0.004, { r: 0.004, seg });
  bag.box('chrome', bellyW + 0.024, 0.012, 0.016, 0, 0.379, 0.004, { r: 0.004, seg });
  for (const s of [-1, 1]) bag.box('chrome', 0.012, 0.364, 0.016, s * (bellyW / 2 + 0.006), 0.555, 0.004, { r: 0.004, seg });
  bag.box('dark', bellyW, 0.34, 0.01, 0, 0.555, -0.004, { r: 0 });

  // deck
  const deckShape = [
    [0.0, 0.8],
    [0.16, 0.86],
    [0.208, 0.895],
    [0.212, 0.925],
    [0.183, 0.95],
    [-0.025, 0.985],
    [-0.025, 0.8],
  ];
  bag.add('black', sideProfileGeo(deckShape, Wi, { bevel: 0.004 }), matrixOf(Wi / 2, 0, 0), { uvTile: 0.5 });
  bag.add('chrome', new THREE.CapsuleGeometry(0.02, Wi - 0.04, 4, 12), matrixOf(0, 0.912, 0.195, 0, 0, Math.PI / 2), { uvTile: 0.4 });
  const dp = slopedPanel(Wi - 0.03, 0.17, 0.952, -0.02, 0.984, 0.004, 0, 0.002);
  bag.add('dark', dp.geo, dp.matrix, { uvTile: 0.5 });
  const deckAng = dp.ang + Math.PI / 2;
  const bz = 0.075;
  const by = 0.952 + ((0.17 - bz) / 0.19) * 0.032 + 0.006;
  const buttons = [];
  const layout = [
    ['cashout', -0.205],
    ['service', -0.115],
    ['betone', 0.1],
    ['betmax', 0.195],
  ];
  for (const [type, x] of layout) buttons.push({ type, x, y: by, z: bz, ang: deckAng, w: 0.07, d: 0.04, h: 0.016, round: false });
  for (const b of buttons) bag.add('chrome', new THREE.BoxGeometry(b.w + 0.012, 0.008, b.d + 0.012), matrixOf(b.x, b.y - 0.005, b.z, b.ang));

  // service band under the reel window: printer (left), card reader (centre), bill validator (right)
  bag.box('body', Wi, 0.12, 0.03, 0, 1.045, -0.04, { r: 0.006, seg, uvTile: 0.8 });
  const front = new THREE.Vector3(0, 0, 0);
  void front;
  bag.box('dark', 0.12, 0.045, 0.026, -0.18, 1.045, -0.012, { r: 0.006, seg });
  bag.box('rubber', 0.088, 0.005, 0.01, -0.18, 1.04, 0.002, { r: 0.002 });
  leds.push({ geo: new THREE.BoxGeometry(0.094, 0.003, 0.004), matrix: matrixOf(-0.18, 1.06, 0.003), kind: 4, color: 0x9ad0ff });
  bag.box('dark', 0.1, 0.06, 0.026, 0.0, 1.045, -0.012, { r: 0.006, seg });
  lit.push({ key: 'club', geo: new THREE.PlaneGeometry(0.078, 0.03), matrix: matrixOf(0, 1.056, 0.0015) });
  leds.push({ geo: new THREE.BoxGeometry(0.066, 0.003, 0.004), matrix: matrixOf(0, 1.024, 0.003), kind: 4, color: 0xffa020 });
  bag.box('dark', 0.105, 0.08, 0.05, 0.18, 1.045, 0.0, { r: 0.008, seg });
  bag.box('black', 0.08, 0.012, 0.02, 0.18, 1.04, 0.022, { r: 0.004 });
  leds.push({ geo: new THREE.BoxGeometry(0.09, 0.004, 0.004), matrix: matrixOf(0.18, 1.054, 0.026), kind: 1, axis: 'x' });
  leds.push({ geo: new THREE.BoxGeometry(0.09, 0.004, 0.004), matrix: matrixOf(0.18, 1.026, 0.026), kind: 1, axis: 'x' });

  // reel window: painted frame around a glass opening, dark reel box behind, chrome bezel
  const Wn = D.window;
  const frameZ = -0.035;
  bag.box('body', Wi, 1.44 - Wn.y1, 0.03, 0, (1.44 + Wn.y1) / 2, frameZ, { r: 0.004, seg, uvTile: 0.8 });
  bag.box('body', Wi, Wn.y0 - 1.105 + 0.0, 0.03, 0, Wn.y0, frameZ, { r: 0 });
  for (const s of [-1, 1]) {
    const sw = (Wi - Wn.w) / 2;
    bag.box('body', sw, Wn.y1 - Wn.y0, 0.03, s * (Wn.w / 2 + sw / 2), (Wn.y0 + Wn.y1) / 2, frameZ, { r: 0, uvTile: 0.8 });
  }
  // chrome bezel ring around the window
  bag.box('chrome', Wn.w + 0.03, 0.015, 0.02, 0, Wn.y1 + 0.0075, -0.016, { r: 0.005, seg });
  bag.box('chrome', Wn.w + 0.03, 0.015, 0.02, 0, Wn.y0 - 0.0075, -0.016, { r: 0.005, seg });
  for (const s of [-1, 1]) bag.box('chrome', 0.015, Wn.y1 - Wn.y0 + 0.03, 0.02, s * (Wn.w / 2 + 0.0075), (Wn.y0 + Wn.y1) / 2, -0.016, { r: 0.005, seg });
  bag.box('dark', Wn.w, Wn.y1 - Wn.y0 + 0.2, 0.01, 0, (Wn.y0 + Wn.y1) / 2, -0.46, { r: 0 });
  // reel dividers (dark plates between drums)
  const R = D.reel;
  for (const s of [-1, 1]) bag.box('dark', 0.012, Wn.y1 - Wn.y0, 0.3, s * (R.gap / 2), (Wn.y0 + Wn.y1) / 2, -0.19, { r: 0 });
  // payline(s) on the glass + line number lamps at the sides
  const lines = variant === 'three' ? [0, 1, -1] : [0];
  const stopH = (2 * Math.PI * R.radius) / R.stops;
  for (const k of lines) {
    const y = R.cy + k * stopH * 0.98;
    leds.push({ geo: new THREE.BoxGeometry(Wn.w - 0.01, 0.0025, 0.002), matrix: matrixOf(0, y, Wn.z + 0.002), kind: 4, color: k === 0 ? 0xff2a1a : 0xffa020 });
    for (const s of [-1, 1]) leds.push({ geo: new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12), matrix: matrixOf(s * (Wn.w / 2 + 0.03), y, frameZ + 0.017, Math.PI / 2, 0, 0), kind: 4, color: k === 0 ? 0xff3a2a : 0xffb030 });
  }
  const glass = { w: Wn.w + 0.01, h: Wn.y1 - Wn.y0 + 0.01, matrix: matrixOf(0, (Wn.y0 + Wn.y1) / 2, Wn.z) };

  // meter strip (red LED digits, per machine) between the reel window and the top glass
  bag.box('black', Wi, 0.06, 0.03, 0, 1.462, -0.05, { r: 0.004, rx: -0.5, seg });
  const meter = { w: Wi - 0.05, h: 0.04, matrix: matrixOf(0, 1.463, -0.03, -0.5, 0, 0) };

  // top glass (paytable + logo, lit) in a chrome frame
  const tg = slopedPanel(Wi - 0.04, -0.075, 1.5, -0.112, 1.905, 0.006, 0, 0.004);
  lit.push({ key: 'topglass', geo: new THREE.PlaneGeometry(Wi - 0.04, tg.len), matrix: tg.matrix.clone().multiply(matrixOf(0, 0, 0.0031)) });
  const tf = slopedPanel(Wi, -0.075, 1.49, -0.115, 1.915, 0.02, 0, -0.003);
  bag.add('dark', tf.geo, tf.matrix);
  for (const s of [-1, 1]) {
    const fr = slopedPanel(0.012, -0.075, 1.49, -0.115, 1.915, 0.012, s * ((Wi - 0.04) / 2 + 0.006), 0.008);
    bag.add('chrome', fr.geo, fr.matrix);
  }
  bag.box('body', Wi, 0.07, 0.42, 0, 1.95, -0.35, { r: 0.012, seg, uvTile: 0.8 });
  // marquee bulbs strip along the top front edge (chasing, retro)
  for (let i = 0; i < 9; i++) {
    const x = -Wi / 2 + 0.04 + (i * (Wi - 0.08)) / 8;
    leds.push({ geo: new THREE.SphereGeometry(0.011, 10, 8), matrix: matrixOf(x, 1.975, -0.14), kind: i % 2, axis: 'x' });
  }
  // candle
  const cx = W / 2 - 0.08;
  const cz = -0.46;
  bag.cyl('chrome', 0.034, 0.038, 0.02, cx, 1.995, cz, { seg: 16 });
  leds.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.075, 16), matrix: matrixOf(cx, 2.042, cz), kind: 3, color: denomColor });
  leds.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), matrix: matrixOf(cx, 2.105, cz), kind: 2 });
  bag.cyl('chrome', 0.026, 0.032, 0.014, cx, 2.137, cz, { seg: 16 });

  // lever: chrome hub on the right side panel; the arm + knob are instanced by the bank
  const hub = new THREE.Vector3(W / 2 + 0.035, 1.13, -0.2);
  bag.cyl('chrome', 0.055, 0.055, 0.05, hub.x - 0.01, hub.y, hub.z, { rz: Math.PI / 2, seg: 24 });
  bag.cyl('dark', 0.07, 0.07, 0.012, W / 2 + 0.006, hub.y, hub.z, { rz: Math.PI / 2, seg: 24 });
  bag.cyl('chrome', 0.03, 0.03, 0.04, hub.x + 0.03, hub.y, hub.z, { rz: Math.PI / 2, seg: 16 });

  const reels = [-1, 0, 1].map((k) => new THREE.Vector3(k * R.gap, R.cy, R.frontZ - R.radius));
  const anchors = {
    bill: { pos: new THREE.Vector3(0.18, 1.04, 0.034), normal: new THREE.Vector3(0, 0, 1) },
    printer: { pos: new THREE.Vector3(-0.18, 1.04, 0.008), normal: new THREE.Vector3(0, 0, 1) },
    card: { pos: new THREE.Vector3(0, 1.03, 0.01), normal: new THREE.Vector3(0, 0, 1) },
    candle: new THREE.Vector3(cx, 2.07, cz),
    screenCenter: new THREE.Vector3(0, R.cy, Wn.z),
    deckCenter: new THREE.Vector3(0, 0.96, 0.08),
    lever: { hub: hub.clone().add(new THREE.Vector3(0.05, 0, 0)), length: 0.36, rest: -0.2 },
  };
  const colliders = [
    { center: new THREE.Vector3(0, 0.45, -0.255), size: new THREE.Vector3(W, 0.9, 0.62) },
    { center: new THREE.Vector3(0, 0.95, 0.05), size: new THREE.Vector3(W, 0.18, 0.33) },
    { center: new THREE.Vector3(0, 1.5, -0.3), size: new THREE.Vector3(W, 1.0, 0.52) },
  ];
  return { bag, leds, lit, glass, meter, reels, buttons, anchors, colliders, kind: 'stepper', stopH };
}
