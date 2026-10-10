// Starlite lot: the asphalt parcel, pool deck slab, the raised walkway aprons in front of the
// rooms, faded stall lines + wheel stops, a sodium lot light, a dumpster, a shopping cart, two
// beaters in the stalls, weeds in the cracks and litter. Everything static goes through the batch.
import * as THREE from 'three';
import { Y0, LOT, POOL, POOL_FENCE, BACK, EAST, WALK_W, OFFICE, DRIVE } from './layout.js';
import { motelMats } from './mats.js';
import { Props, propMats } from '../shared/props.js';
import { parkedCar } from '../shared/vehicles.js';
import { addWeeds } from '../shared/flora.js';
import { cart } from '../reno/strip.js';
import { mat } from '../../gfx/materials.js';
import { Rng } from '../../core/rng.js';

const APRON_H = 0.12; // the walkway apron is one shallow step above the asphalt

export function buildLot(ctx) {
  const { batch, colliders } = ctx;
  const M = motelMats();
  const PM = propMats();
  const rng = new Rng('starlite-lot');

  // ---- Surfaces ----------------------------------------------------------------------------------
  // Asphalt slab (y 0 → Y0) everywhere except the fenced pool yard, which gets a concrete deck with a
  // hole for the pool basin (the basin itself is built by pool.js).
  const slab = (x0, z0, x1, z1, m, o = {}) => {
    if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return;
    const h = o.top ?? Y0;
    const y0 = o.bottom ?? 0;
    batch.add(new THREE.BoxGeometry(x1 - x0, h - y0, z1 - z0).translate((x0 + x1) / 2, (h + y0) / 2, (z0 + z1) / 2), m, { castShadow: false, tint: o.tint, grime: o.grime });
    colliders.aabb(x0, y0 - 0.2, z0, x1, h, z1);
  };
  const F = POOL_FENCE;
  slab(LOT.x0, LOT.z0, LOT.x1, F.z0, M.asphalt);
  slab(LOT.x0, F.z1, LOT.x1, LOT.z1, M.asphalt);
  slab(LOT.x0, F.z0, F.x0, F.z1, M.asphalt);
  slab(F.x1, F.z0, LOT.x1, F.z1, M.asphalt);
  // Pool deck: broom-finished concrete around the basin, slightly paler.
  const P = POOL;
  const deck = M.plaster;
  slab(F.x0, F.z0, F.x1, P.z0, deck, { tint: 0xd8d2c4 });
  slab(F.x0, P.z1, F.x1, F.z1, deck, { tint: 0xd8d2c4 });
  slab(F.x0, P.z0, P.x0, P.z1, deck, { tint: 0xd8d2c4 });
  slab(P.x1, P.z0, F.x1, P.z1, deck, { tint: 0xd8d2c4 });

  // Raised concrete aprons under the walkway (the ground-floor "corridor" in front of the rooms).
  const apron = (x0, z0, x1, z1) => {
    batch.add(new THREE.BoxGeometry(x1 - x0, APRON_H, z1 - z0).translate((x0 + x1) / 2, Y0 + APRON_H / 2, (z0 + z1) / 2), M.concrete, { grime: 0.6, grimeBase: Y0 });
    colliders.aabb(x0, Y0, z0, x1, Y0 + APRON_H, z1);
  };
  apron(BACK.x0, BACK.z1, EAST.x0, BACK.z1 + WALK_W + 0.1);
  apron(EAST.x0 - WALK_W - 0.1, BACK.z1 + WALK_W + 0.1, EAST.x0, EAST.z1);
  // Office apron + step at the glass door.
  apron(OFFICE.x0, OFFICE.z1, OFFICE.x1, OFFICE.z1 + 1.4);

  // ---- Stall lines + wheel stops -------------------------------------------------------------------
  const paint = (x, z, w, d) => batch.add(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, Y0 + 0.004, z), M.stall, { castShadow: false, receiveShadow: true, uv: 'keep' });
  const stop = (x, z, ry) => {
    const g = new THREE.BoxGeometry(1.8, 0.13, 0.22);
    g.translate(0, 0.065, 0);
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x + rng.range(-0.08, 0.08), Y0, z);
    // A few have been knocked crooked.
    if (rng.chance(0.3)) m.multiply(new THREE.Matrix4().makeRotationY(rng.range(-0.18, 0.18)));
    batch.add(g, M.concrete, { matrix: m, tint: rng.chance(0.4) ? 0xd9b23a : 0xcfcabd, grime: 0.7, grimeBase: Y0 });
    const p = new THREE.Vector3(0, 0.065, 0).applyMatrix4(m);
    colliders.box(p.x, p.y, p.z, 1.8, 0.13, 0.22, ry);
  };
  // Back-wing stalls (nose-in to the north), east of the pool yard.
  const backStalls = [];
  for (let x = 196; x <= 213.5; x += 2.9) backStalls.push(x);
  const zLine = BACK.z1 + WALK_W + 0.1; // edge of the apron
  for (const x of backStalls) paint(x, zLine + 2.7, 0.1, 5.2);
  paint(backStalls[backStalls.length - 1] + 2.9, zLine + 2.7, 0.1, 5.2);
  for (const x of backStalls) stop(x + 1.45, zLine + 0.75, 0);
  // East-wing stalls (nose-in to the east).
  const xLine = EAST.x0 - WALK_W - 0.1;
  const eastStalls = [];
  for (let z = -40.3; z <= -22; z += 2.9) eastStalls.push(z);
  for (const z of eastStalls) paint(xLine - 2.7, z, 5.2, 0.1);
  paint(xLine - 2.7, eastStalls[eastStalls.length - 1] + 2.9, 5.2, 0.1);
  for (const z of eastStalls) stop(xLine - 0.75, z + 1.45, Math.PI / 2);
  // Faded arrow + "ENTER" hint at the driveway: just a worn arrow shape.
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.15, 0);
  arrow.lineTo(0.15, 0);
  arrow.lineTo(0.15, 1.6);
  arrow.lineTo(0.45, 1.6);
  arrow.lineTo(0, 2.4);
  arrow.lineTo(-0.45, 1.6);
  arrow.lineTo(-0.15, 1.6);
  arrow.closePath();
  const ag = new THREE.ShapeGeometry(arrow).rotateX(-Math.PI / 2).translate((DRIVE.x0 + DRIVE.x1) / 2 - 2, Y0 + 0.004, -13.5);
  batch.add(ag, M.stall, { castShadow: false, uv: 0.8 });

  // ---- Cars: two beaters that have not moved in a while ---------------------------------------------
  parkedCar(batch, colliders, { x: backStalls[1] + 1.45, y: Y0, z: zLine + 2.75, ry: Math.PI / 2, type: 'sedan', color: 0x6b5a3a, seed: 4411 });
  parkedCar(batch, colliders, { x: xLine - 2.75, y: Y0, z: eastStalls[3] + 1.45, ry: 0, type: 'pickup', color: 0x7d2a22, seed: 4412 });
  parkedCar(batch, colliders, { x: backStalls[4] + 1.45, y: Y0, z: zLine + 2.75, ry: Math.PI / 2 + 0.04, type: 'wagon', color: 0xa48a5c, seed: 4413 });

  // ---- Dumpster (226, -15) -----------------------------------------------------------------------
  dumpster(ctx, 225.6, -15.2, -0.06);
  // A shopping cart that rolled to a stop against the office wall.
  cart(ctx, 193.1, -18.6, 0.4);

  // ---- Lot light: one tired cobra head on a wooden pole by the drive -------------------------------
  const props = new Props(ctx);
  props.cobraLight(209.5, -16.2, Math.PI, { y: Y0, arm: 2.2, sodium: true, h: 7.6 });
  props.trashCan(193.2, -14.2, { y: Y0 + APRON_H, style: 'strip' });
  props.litter(LOT.x0 + 1, LOT.z0 + 12, LOT.x1 - 12, LOT.z1 - 0.5, 34, { y: Y0, rng: new Rng('starlite-litter') });

  // ---- Weeds: along the property edges and in the cracks ------------------------------------------
  const inside = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  const avoid = (x, z) => inside(x, z, POOL_FENCE) || inside(x, z, { x0: OFFICE.x0, x1: OFFICE.x1, z0: OFFICE.z0, z1: OFFICE.z1 + 1.4 }) || inside(x, z, { x0: BACK.x0, x1: BACK.x1, z0: BACK.z0, z1: BACK.z1 + WALK_W + 0.2 }) || inside(x, z, { x0: EAST.x0 - WALK_W - 0.2, x1: EAST.x1, z0: EAST.z0, z1: EAST.z1 });
  addWeeds(batch, { x0: LOT.x0 + 0.2, x1: LOT.x0 + 1.4, z0: LOT.z0, z1: LOT.z1 - 0.5, y: Y0, n: 26, seed: 81, avoid });
  addWeeds(batch, { x0: LOT.x1 - 1.4, x1: LOT.x1 - 0.2, z0: EAST.z1, z1: LOT.z1 - 0.5, y: Y0, n: 14, seed: 82, avoid });
  addWeeds(batch, { x0: LOT.x0, x1: LOT.x1, z0: LOT.z0 + 9, z1: LOT.z1 - 1, y: Y0, n: 38, seed: 83, avoid });
  addWeeds(batch, { x0: LOT.x0, x1: LOT.x1, z0: LOT.z0, z1: LOT.z0 + 1.2, y: Y0, n: 18, seed: 84, avoid });

  // Ground decals are placed by index.js (needs the finished group as target).
  ctx.decalGround.push(
    { x0: 195, x1: 216, z0: -43, z1: -36, y: Y0, kinds: ['oil', 'oil', 'oil', 'grime', 'crack', 'burn'], n: 26 },
    { x0: 210, x1: 217, z0: -41, z1: -20, y: Y0, kinds: ['oil', 'oil', 'grime', 'crack'], n: 16 },
    { x0: 183, x1: 229, z0: -29, z1: -12, y: Y0, kinds: ['crack', 'crack', 'grime', 'oil', 'skid', 'puddle', 'gum'], n: 40 },
  );
  void PM;
}

// Green steel front-load dumpster with a half-open lid, a bag that did not make it in.
function dumpster(ctx, x, z, ry) {
  const { batch, colliders } = ctx;
  const M = motelMats();
  const green = mat('metal-painted', { color: 0x2c4a33, wear: 0.75, dirt: 0.7, seed: 819 });
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, Y0, z);
  const W = 1.85;
  const D = 1.15;
  const H = 1.25;
  // Body tapers: wider at the top, like the real thing.
  const body = new THREE.CylinderGeometry(1, 0.86, H, 4, 1).rotateY(Math.PI / 4);
  body.scale(W / Math.SQRT2, 1, D / Math.SQRT2).translate(0, H / 2 + 0.1, 0);
  batch.add(body, green, { matrix: m, grime: 0.8, grimeBase: Y0 });
  // Lid: one flap closed, one propped open on a bag.
  const lid1 = new THREE.BoxGeometry(W / 2 - 0.02, 0.04, D + 0.1).translate(-W / 4, H + 0.12, 0);
  batch.add(lid1, M.black, { matrix: m });
  const lid2 = new THREE.BoxGeometry(W / 2 - 0.02, 0.04, D + 0.1).translate(0, 0, D / 2 + 0.05).rotateX(-0.5).translate(W / 4, H + 0.12, -D / 2 - 0.05);
  batch.add(lid2, M.black, { matrix: m });
  // Fork pockets + casters.
  for (const s of [-1, 1]) batch.add(new THREE.BoxGeometry(0.22, 0.14, D + 0.16).translate(s * 0.55, H * 0.55, 0), green, { matrix: m });
  for (const [cx, cz] of [[-0.75, -0.42], [0.75, -0.42], [-0.75, 0.42], [0.75, 0.42]]) {
    batch.add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10).rotateZ(Math.PI / 2).translate(cx, 0.06, cz), M.rubber, { matrix: m });
  }
  // Overflow: a black bag on the ground and one poking out under the lid.
  const bagMat = mat('plastic', { color: 0x161616, wear: 0.2, dirt: 0.4, seed: 820 });
  const bag = new THREE.IcosahedronGeometry(0.32, 1).scale(1, 0.75, 1.1);
  batch.add(bag.clone().translate(1.25, 0.22, 0.3), bagMat, { matrix: m });
  batch.add(bag.clone().translate(0.45, H + 0.1, 0.1), bagMat, { matrix: m });
  const p = new THREE.Vector3(0, H / 2 + 0.1, 0).applyMatrix4(m);
  colliders.box(p.x, p.y, p.z, W, H + 0.2, D + 0.15, ry);
  const pb = new THREE.Vector3(1.25, 0.22, 0.3).applyMatrix4(m);
  colliders.box(pb.x, pb.y, pb.z, 0.6, 0.44, 0.65, ry);
}
