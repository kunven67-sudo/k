// Modern video upright ("Silverlode Vista 43P"): sculpted side panels in automotive paint with
// LED edge strips, a gently curved portrait screen in a gloss bezel, a sloped button deck with a
// padded arm rest, a service band (players-club reader + display, ticket printer, lit bill
// validator), lit belly glass, a logo topper and a two-tier candle.
//
// Local frame (CONTRACT): the player side is +Z, x centred, floor at y = 0. Everything static goes
// into a PartBag; dynamic pieces (screen, buttons, LEDs, lit glass) are returned as descriptors
// the bank turns into shared/instanced meshes.

import * as THREE from 'three';
import { PartBag, matrixOf, sideProfileGeo, slopedPanel } from './parts.js';

export const VIDEO_DIM = {
  width: 0.7,
  panel: 0.034,
  deckFront: { z: 0.235, y: 0.92 },
  screen: { w: 0.54, z0: -0.085, y0: 1.135, z1: -0.145, y1: 1.965 },
  top: 2.06,
};

// side silhouette (z, y), counter-clockwise from back-bottom
const PROFILE = [
  [-0.6, 0.0],
  [0.05, 0.0],
  [0.05, 0.075],
  [0.0, 0.095],
  [0.0, 0.78],
  [0.17, 0.84],
  [0.232, 0.886],
  [0.238, 0.918],
  [0.205, 0.948],
  [-0.05, 0.988],
  [-0.072, 1.11],
  [-0.082, 1.125],
  [-0.142, 1.975],
  [-0.17, 2.06],
  [-0.6, 2.06],
];

/**
 * @param o.kind 'lines' | 'ways'
 * @returns { bag, leds, lit, screen, buttons, anchors, colliders }
 */
export function buildVideoCabinet({ kind = 'lines', denomColor = 0xffd23a, tier = 'high' } = {}) {
  const D = VIDEO_DIM;
  const bag = new PartBag();
  const leds = [];
  const lit = [];
  const W = D.width;
  const T = D.panel;
  const Wi = W - T * 2;
  const seg = tier === 'low' ? 1 : 2;

  // ---- side panels (car paint) + chrome edge trim -------------------------------------------------
  for (const s of [-1, 1]) {
    const geo = sideProfileGeo(PROFILE, T, { bevel: 0.006 });
    bag.add('body', geo, matrixOf(s < 0 ? -W / 2 + T : W / 2, 0, 0), { uvTile: 0.8 });
    // LED strip along the screen edge of the panel (front face of the panel edge)
    const sp = slopedPanel(0.012, -0.082, 1.125, -0.142, 1.975, 0.008, s * (W / 2 - T / 2), 0.006);
    leds.push({ geo: sp.geo, matrix: sp.matrix, kind: 0, axis: 'y' });
    // second, thinner strip down the belly edge in the accent colour
    const sb = slopedPanel(0.01, 0.0, 0.1, 0.0, 0.78, 0.006, s * (W / 2 - T / 2), 0.004);
    leds.push({ geo: sb.geo, matrix: sb.matrix, kind: 1, axis: 'y' });
    // chrome kick guard on the panel bottom
    bag.box('chrome', T + 0.004, 0.05, 0.66, s * (W / 2 - T / 2), 0.025, -0.275, { r: 0.004, seg });
  }

  // ---- body between the panels ---------------------------------------------------------------------
  bag.box('dark', Wi, 2.04, 0.46, 0, 1.02, -0.37, { r: 0.004, seg }); // the back / chassis
  bag.box('rubber', Wi, 0.075, 0.05, 0, 0.0375, 0.02, { r: 0.006, seg }); // toe kick
  // lower door (painted) around the belly glass
  bag.box('body', Wi, 0.33, 0.03, 0, 0.26, -0.01, { r: 0.006, seg, uvTile: 0.8 });
  bag.box('body', Wi, 0.06, 0.03, 0, 0.75, -0.01, { r: 0.006, seg, uvTile: 0.8 });
  // belly glass (lit art) with a chrome frame
  const bellyW = Wi - 0.06;
  lit.push({ key: 'belly', geo: new THREE.PlaneGeometry(bellyW, 0.27), matrix: matrixOf(0, 0.578, 0.008) });
  bag.box('chrome', bellyW + 0.024, 0.012, 0.016, 0, 0.716, 0.004, { r: 0.004, seg });
  bag.box('chrome', bellyW + 0.024, 0.012, 0.016, 0, 0.44, 0.004, { r: 0.004, seg });
  for (const s of [-1, 1]) bag.box('chrome', 0.012, 0.288, 0.016, s * (bellyW / 2 + 0.006), 0.578, 0.004, { r: 0.004, seg });
  bag.box('dark', bellyW, 0.27, 0.01, 0, 0.578, -0.004, { r: 0 });

  // ---- button deck ---------------------------------------------------------------------------------
  const deckShape = [
    [0.0, 0.78],
    [0.17, 0.84],
    [0.232, 0.886],
    [0.238, 0.918],
    [0.205, 0.948],
    [-0.05, 0.988],
    [-0.05, 0.78],
  ];
  const deckGeo = sideProfileGeo(deckShape, Wi, { bevel: 0.004 });
  bag.add('black', deckGeo, matrixOf(Wi / 2, 0, 0), { uvTile: 0.5 });
  // padded arm rest along the deck nose
  const rest = new THREE.CapsuleGeometry(0.024, Wi - 0.05, 4, 12);
  bag.add('deck', rest, matrixOf(0, 0.912, 0.215, 0, 0, Math.PI / 2), { uvTile: 0.4 });
  // deck top inlay (brushed metal plate the buttons sit in)
  const dp = slopedPanel(Wi - 0.03, 0.188, 0.95, -0.04, 0.986, 0.004, 0, 0.002);
  bag.add('chrome', dp.geo, dp.matrix, { uvTile: 0.5 });
  const deckAng = dp.ang + Math.PI / 2; // rotation about X that stands a box up on the deck plate

  // buttons on the deck plate: positions along x at the plate middle
  const layout =
    kind === 'stepper'
      ? []
      : kind === 'ways'
        ? ['cashout', 'help', 'service', 'betminus', 'betplus', 'maxbet']
        : ['cashout', 'help', 'lines', 'betminus', 'betplus', 'maxbet'];
  const buttons = [];
  const bz = 0.085;
  const by = 0.95 + (0.188 - bz) * ((0.986 - 0.95) / (0.188 + 0.04)) + 0.006;
  layout.forEach((type, i) => {
    const x = -0.255 + i * 0.077;
    buttons.push({ type, x, y: by, z: bz, ang: deckAng, w: 0.062, d: 0.036, h: 0.013, round: false });
  });
  buttons.push({ type: 'spin', x: 0.232, y: by + 0.004, z: bz - 0.004, ang: deckAng, w: 0.074, d: 0.074, h: 0.02, round: true });
  // chrome bezels around buttons (rings / frames)
  for (const b of buttons) {
    const m = matrixOf(b.x, b.y - 0.004, b.z, b.ang, 0, 0);
    if (b.round) bag.add('chrome', new THREE.TorusGeometry(b.w / 2 + 0.004, 0.005, 6, 28), m.clone().multiply(matrixOf(0, 0, 0, Math.PI / 2, 0, 0)));
    else bag.add('black', new THREE.BoxGeometry(b.w + 0.01, 0.008, b.d + 0.01), m);
  }

  // ---- service band: card reader + display, ticket printer, bill validator -----------------------
  const band = slopedPanel(Wi, -0.05, 0.988, -0.072, 1.11, 0.02, 0, 0);
  bag.add('black', band.geo, band.matrix, { uvTile: 0.5 });
  const bandN = band.normal;
  const onBand = (x, t, out = 0) => {
    // point on the band surface at fraction t (0 bottom → 1 top), pushed out along its normal
    const z = -0.05 + (-0.072 + 0.05) * t;
    const y = 0.988 + (1.11 - 0.988) * t;
    return new THREE.Vector3(x, y + bandN.y * out, z + bandN.z * out);
  };
  // card reader (left)
  const cr = onBand(-0.2, 0.42, 0.012);
  bag.box('dark', 0.11, 0.07, 0.03, cr.x, cr.y, cr.z, { r: 0.005, rx: band.ang, seg });
  bag.box('black', 0.07, 0.006, 0.01, cr.x, cr.y - 0.02, cr.z + 0.016, { r: 0.002, rx: band.ang });
  leds.push({ geo: new THREE.BoxGeometry(0.072, 0.003, 0.004), matrix: matrixOf(cr.x, cr.y - 0.026, cr.z + 0.016, band.ang), kind: 4, color: 0xffa020 });
  lit.push({ key: 'club', geo: new THREE.PlaneGeometry(0.084, 0.032), matrix: matrixOf(cr.x, cr.y + 0.012, cr.z + 0.0155, band.ang) });
  // ticket printer (centre-right): bezel with a dark slot
  const pr = onBand(0.03, 0.5, 0.01);
  bag.box('dark', 0.13, 0.05, 0.028, pr.x, pr.y, pr.z, { r: 0.006, rx: band.ang, seg });
  bag.box('rubber', 0.092, 0.005, 0.01, pr.x, pr.y - 0.006, pr.z + 0.012, { r: 0.002, rx: band.ang });
  leds.push({ geo: new THREE.BoxGeometry(0.1, 0.003, 0.004), matrix: matrixOf(pr.x, pr.y + 0.016, pr.z + 0.014, band.ang), kind: 4, color: 0x9ad0ff });
  // bill validator (right): protruding bezel with a lit chase ring around the bill mouth
  const bv = onBand(0.2, 0.48, 0.022);
  bag.box('dark', 0.11, 0.085, 0.05, bv.x, bv.y, bv.z, { r: 0.008, rx: band.ang, seg });
  bag.box('black', 0.082, 0.012, 0.02, bv.x, bv.y - 0.006, bv.z + 0.022, { r: 0.004, rx: band.ang });
  leds.push({ geo: new THREE.BoxGeometry(0.094, 0.004, 0.004), matrix: matrixOf(bv.x, bv.y + 0.008, bv.z + 0.026, band.ang), kind: 1, axis: 'x' });
  leds.push({ geo: new THREE.BoxGeometry(0.094, 0.004, 0.004), matrix: matrixOf(bv.x, bv.y - 0.02, bv.z + 0.026, band.ang), kind: 1, axis: 'x' });

  // ---- screen + bezel -----------------------------------------------------------------------------
  const S = D.screen;
  // the glass sits in a recess: a backing slab behind it, gloss frame bars proud of it
  const sp = slopedPanel(S.w, S.z0, S.y0, S.z1, S.y1, 0.0, 0, 0.0);
  const bezel = 0.03;
  const bp = slopedPanel(S.w + bezel * 2, S.z0, S.y0 - 0.02, S.z1, S.y1 + 0.02, 0.03, 0, -0.03);
  bag.add('black', bp.geo, bp.matrix, { uvTile: 0.5 });
  const dir = new THREE.Vector3(0, S.y1 - S.y0, S.z1 - S.z0).normalize();
  for (const s of [-1, 1]) {
    const fb = slopedPanel(bezel, S.z0, S.y0 - 0.02, S.z1, S.y1 + 0.02, 0.04, s * (S.w / 2 + bezel / 2), 0.008);
    bag.add('black', fb.geo, fb.matrix, { uvTile: 0.5 });
    const fr = slopedPanel(0.008, S.z0, S.y0 - 0.02, S.z1, S.y1 + 0.02, 0.01, s * (S.w / 2 + 0.004), 0.01);
    bag.add('chrome', fr.geo, fr.matrix);
    // top / bottom bars
    const yEnd = s < 0 ? S.y0 : S.y1;
    const zEnd = s < 0 ? S.z0 : S.z1;
    const c = new THREE.Vector3(0, yEnd, zEnd).addScaledVector(dir, s * 0.012).addScaledVector(sp.normal, 0.008 - 0.02);
    const bar = new THREE.BoxGeometry(S.w + bezel * 2, 0.026, 0.04);
    bag.add('black', bar, new THREE.Matrix4().compose(c, new THREE.Quaternion().setFromEuler(new THREE.Euler(sp.ang, 0, 0)), new THREE.Vector3(1, 1, 1)), { uvTile: 0.5 });
  }
  const screen = { w: S.w, h: sp.len, matrix: sp.matrix, normal: sp.normal, curve: 0.014 };

  // ---- top cap, topper, candle ---------------------------------------------------------------------
  bag.box('body', Wi, 0.07, 0.44, 0, 2.025, -0.38, { r: 0.01, seg, uvTile: 0.8 });
  // topper: a rounded lit sign box sitting on the cabinet top
  bag.box('black', W - 0.02, 0.27, 0.16, 0, 2.2, -0.34, { r: 0.02, seg });
  lit.push({ key: 'topper', geo: new THREE.PlaneGeometry(W - 0.08, 0.215), matrix: matrixOf(0, 2.2, -0.258) });
  bag.box('chrome', W - 0.04, 0.014, 0.012, 0, 2.316, -0.262, { r: 0.004, seg });
  bag.box('chrome', W - 0.04, 0.014, 0.012, 0, 2.084, -0.262, { r: 0.004, seg });
  leds.push({ geo: new THREE.BoxGeometry(W - 0.03, 0.006, 0.006), matrix: matrixOf(0, 2.33, -0.27), kind: 0, axis: 'x' });
  // candle: base (denomination colour) + white top, chrome cap
  const cx = W / 2 - 0.08;
  const cz = -0.5;
  bag.cyl('chrome', 0.034, 0.038, 0.02, cx, 2.345, cz, { seg: 16 });
  leds.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.075, 16), matrix: matrixOf(cx, 2.392, cz), kind: 3, color: denomColor });
  leds.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), matrix: matrixOf(cx, 2.455, cz), kind: 2 });
  bag.cyl('chrome', 0.026, 0.032, 0.014, cx, 2.487, cz, { seg: 16 });

  // ---- anchors & colliders -------------------------------------------------------------------------
  const anchors = {
    bill: { pos: new THREE.Vector3(bv.x, bv.y - 0.006, bv.z + 0.034), normal: bandN.clone() },
    printer: { pos: new THREE.Vector3(pr.x, pr.y - 0.006, pr.z + 0.018), normal: bandN.clone() },
    card: { pos: new THREE.Vector3(cr.x, cr.y - 0.02, cr.z + 0.02), normal: bandN.clone() },
    candle: new THREE.Vector3(cx, 2.42, cz),
    screenCenter: new THREE.Vector3(0, (S.y0 + S.y1) / 2, (S.z0 + S.z1) / 2),
    deckCenter: new THREE.Vector3(0, 0.95, 0.09),
    spin: new THREE.Vector3(0.232, by + 0.02, bz),
  };
  const colliders = [
    { center: new THREE.Vector3(0, 0.44, -0.275), size: new THREE.Vector3(W, 0.88, 0.67) },
    { center: new THREE.Vector3(0, 0.95, 0.06), size: new THREE.Vector3(W, 0.2, 0.36) },
    { center: new THREE.Vector3(0, 1.75, -0.36), size: new THREE.Vector3(W, 1.5, 0.48) },
  ];
  return { bag, leds, lit, screen, buttons, anchors, colliders, kind: 'video' };
}
