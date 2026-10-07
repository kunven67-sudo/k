// The Starlite's two-storey L of rooms: back wing (rooms face south) + east wing (rooms face west).
// Stucco walls, painted steel doors in three tired colours, aluminium windows with the city's fake
// room-interior glass (curtains drawn), a wall AC unit dripping under every window, brass number
// plates (one atlas, renumberable), wall-pack porch lights, an upper concrete walkway with a pipe
// railing, a steel stair, breeze-block screens at the walkway ends and the ice / vending nook.
//
// The player's room (back wing, x 204..208, ground floor) is left open here — door, window and the
// whole interior are built by room.js — and the wing's colliders are split around it.
import * as THREE from 'three';
import { addBuilding, onFace } from '../shared/buildings.js';
import { propMats } from '../shared/props.js';
import { Y0, FLOOR_H, WALK_W, BACK, EAST, ROOM, doorSlots } from './layout.js';
import { motelMats, PAL, numberAtlas, plaqueMat } from './mats.js';
import { doorParts, jambParts, stampParts } from './doors.js';
import { mat } from '../../gfx/materials.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';

const H = FLOOR_H * 2 + 0.55; // wall height incl. parapet base
const DOOR_W = 0.9;
const DOOR_H = 2.08;
const STEP = 0.12; // apron height on the ground floor

export function buildWings(ctx) {
  const { batch, colliders, lights } = ctx;
  const M = motelMats();
  const PM = propMats();
  const rng = new Rng('starlite-wings');
  const slots = doorSlots();
  const atlas = numberAtlas();

  // ---- Openings per face -------------------------------------------------------------------------
  // Room module (local x along the face): door at bx+0.3, window at bx+1.65..3.45 (AC below it).
  const backOps = [];
  const eastOps = [];
  slots.forEach((s, i) => {
    const bx = s.wing === 'back' ? s.x0 - BACK.x0 : s.z0 - EAST.z0;
    const y = s.floor * FLOOR_H + (s.floor === 0 ? STEP : 0);
    s.bx = bx;
    s.y = y;
    s.index = i;
    const doorTint = PAL.doors[(i + s.floor) % PAL.doors.length];
    const ops = s.wing === 'back' ? backOps : eastOps;
    if (s.player) {
      // Holes only; room.js fills them with a real hinged door and an openable window.
      ops.push({ kind: 'void', x0: bx + 0.3, x1: bx + 0.3 + DOOR_W, y0: y, y1: y + DOOR_H });
      ops.push({ kind: 'void', x0: bx + 1.65, x1: bx + 3.45, y0: y + 0.95, y1: y + 2.15 });
      return;
    }
    ops.push({ kind: 'void', x0: bx + 0.3, x1: bx + 0.3 + DOOR_W, y0: y, y1: y + DOOR_H });
    s.doorTint = doorTint;
    ops.push({ kind: 'window', x0: bx + 1.65, x1: bx + 3.45, y0: y + 0.95, y1: y + 2.15, style: 'room', frame: 0xd9d4c6, glassTint: rng.pick([0x8e9a94, 0x9aa49c, 0x8a8f8a]) });
  });
  // Ice nook on the back wing (x 216..219): an open alcove instead of a room on the ground floor.
  backOps.push({ kind: 'void', x0: 216.2 - BACK.x0, x1: 218.8 - BACK.x0, y0: STEP, y1: 2.3 });
  // Rear faces: small frosted bathroom windows, one per room, both floors.
  const rearOps = (n, start) => {
    const ops = [];
    for (let f = 0; f < 2; f++) for (let k = 0; k < n; k++) {
      const bx = start + k * 4 + 2.5;
      ops.push({ kind: 'window', x0: bx, x1: bx + 0.75, y0: f * FLOOR_H + 1.65, y1: f * FLOOR_H + 2.15, style: 'room', glassTint: 0xc9cdc6, frame: 0xd9d4c6, meeting: false });
    }
    return ops;
  };
  const band = (y) => ({ y, h: 0.22, d: 0.08, mat: M.trim, tint: PAL.trim });

  // Back wing: rear face runs east → west, so local x = BACK.x1 - world x (mirror of the front).
  const backRear = rearOps(8, BACK.x1 - 216).filter((o) => !(BACK.x1 - o.x1 < ROOM.x1 && BACK.x1 - o.x0 > ROOM.x0 && o.y0 < FLOOR_H));
  addBuilding(ctx, {
    x0: BACK.x0, x1: BACK.x1, z0: BACK.z0, z1: BACK.z1, h: H, y: Y0, tint: PAL.wall, wall: M.stucco, parapet: 0.35, collide: false, grime: 0.7,
    faces: {
      S: { openings: backOps, bands: [band(FLOOR_H - 0.12)] },
      N: { openings: backRear },
    },
    roof: { hvac: 3 },
    seed: 'starlite-back',
  });
  addBuilding(ctx, {
    x0: EAST.x0, x1: EAST.x1, z0: EAST.z0, z1: EAST.z1, h: H, y: Y0, tint: PAL.wall, wall: M.stucco, parapet: 0.35, collide: false, grime: 0.7,
    faces: {
      N: false,
      W: { openings: eastOps, bands: [band(FLOOR_H - 0.12)] },
      E: { openings: rearOps(6, EAST.z1 - EAST.z0 - 24) },
    },
    roof: { hvac: 2 },
    seed: 'starlite-east',
  });

  // ---- Colliders (walls are solid except the player's room, which room.js walls itself) ----------
  const top = Y0 + H + 0.35;
  colliders.aabb(BACK.x0, Y0, BACK.z0, ROOM.x0, top, BACK.z1);
  colliders.aabb(ROOM.x1, Y0, BACK.z0, BACK.x1, top, BACK.z1);
  colliders.aabb(ROOM.x0, Y0 + ROOM.ceil + 0.1, BACK.z0, ROOM.x1, top, BACK.z1);
  // Ice nook is an alcove 1 m deep: carve it out of the solid block.
  colliders.aabb(EAST.x0, Y0, EAST.z0, EAST.x1, top, EAST.z1);

  // ---- Upper walkway, roof overhang, posts, railing -----------------------------------------------
  const slabY = Y0 + FLOOR_H; // walkway top
  const backW = { x0: BACK.x0, x1: EAST.x0, z0: BACK.z1, z1: BACK.z1 + WALK_W };
  const eastW = { x0: EAST.x0 - WALK_W, x1: EAST.x0, z0: BACK.z1 + WALK_W, z1: EAST.z1 };
  for (const w of [backW, eastW]) {
    const sx = w.x1 - w.x0;
    const sz = w.z1 - w.z0;
    // Walkway slab with a painted edge, and the roof overhang (soffit) above.
    batch.add(new THREE.BoxGeometry(sx, 0.2, sz).translate(w.x0 + sx / 2, slabY - 0.1, w.z0 + sz / 2), M.concrete, { grime: 0.5 });
    colliders.aabb(w.x0, slabY - 0.2, w.z0, w.x1, slabY, w.z1);
    batch.add(new THREE.BoxGeometry(sx, 0.16, sz).translate(w.x0 + sx / 2, Y0 + 2 * FLOOR_H - 0.08, w.z0 + sz / 2), M.concrete, { tint: 0xd8d2c6 });
  }
  // Fascia bands: teal on the walkway edge (slab), deep peach on the roof edge.
  const fascia = (x0, z0, x1, z1, y, h, tint) => {
    batch.add(new THREE.BoxGeometry(Math.max(0.1, x1 - x0), h, Math.max(0.1, z1 - z0)).translate((x0 + x1) / 2, y, (z0 + z1) / 2), M.trim, { tint });
  };
  fascia(backW.x0, backW.z1, EAST.x0 - WALK_W, backW.z1 + 0.1, slabY - 0.13, 0.3, PAL.trim);
  fascia(eastW.x0 - 0.1, eastW.z0, eastW.x0, eastW.z1, slabY - 0.13, 0.3, PAL.trim);
  fascia(backW.x0, backW.z1, EAST.x0 - WALK_W, backW.z1 + 0.12, Y0 + 2 * FLOOR_H + 0.05, 0.55, PAL.roofFascia);
  fascia(eastW.x0 - 0.12, eastW.z0, eastW.x0, eastW.z1, Y0 + 2 * FLOOR_H + 0.05, 0.55, PAL.roofFascia);
  // Square steel posts on the walkway edge, both storeys (exact colliders on the ground floor).
  const post = (x, z) => {
    batch.add(new THREE.BoxGeometry(0.1, FLOOR_H - 0.2, 0.1).translate(x, Y0 + (FLOOR_H - 0.2) / 2, z), M.metal, { tint: PAL.rail, grime: 0.6, grimeBase: Y0 });
    batch.add(new THREE.BoxGeometry(0.1, FLOOR_H - 0.16, 0.1).translate(x, slabY + (FLOOR_H - 0.16) / 2, z), M.metal, { tint: PAL.rail });
    colliders.aabb(x - 0.05, Y0, z - 0.05, x + 0.05, Y0 + 2 * FLOOR_H, z + 0.05);
  };
  for (let x = backW.x0 + 0.15; x < EAST.x0 - WALK_W; x += 4) post(x, backW.z1 - 0.08);
  post(EAST.x0 - WALK_W + 0.08, backW.z1 - 0.08);
  for (let z = eastW.z1 - 0.15; z > eastW.z0 + 1.0; z -= 4) post(eastW.x0 + 0.08, z);
  // Pipe railing: top rail, mid rail, pickets — skipping where the stair arrives.
  const railY = slabY;
  const railX = (x0, x1, z) => {
    const L = x1 - x0;
    batch.add(new THREE.CylinderGeometry(0.025, 0.025, L, 8).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, railY + 1.0, z), M.metal, { tint: PAL.rail });
    batch.add(new THREE.BoxGeometry(L, 0.04, 0.04).translate((x0 + x1) / 2, railY + 0.1, z), M.metal, { tint: PAL.rail });
    for (let x = x0 + 0.06; x < x1; x += 0.13) batch.add(new THREE.BoxGeometry(0.016, 0.88, 0.016).translate(x, railY + 0.55, z), M.metal, { tint: PAL.rail });
    colliders.aabb(x0, railY, z - 0.04, x1, railY + 1.05, z + 0.04);
  };
  const railZ = (z0, z1, x) => {
    const L = z1 - z0;
    batch.add(new THREE.CylinderGeometry(0.025, 0.025, L, 8).rotateX(Math.PI / 2).translate(x, railY + 1.0, (z0 + z1) / 2), M.metal, { tint: PAL.rail });
    batch.add(new THREE.BoxGeometry(0.04, 0.04, L).translate(x, railY + 0.1, (z0 + z1) / 2), M.metal, { tint: PAL.rail });
    for (let z = z0 + 0.06; z < z1; z += 0.13) batch.add(new THREE.BoxGeometry(0.016, 0.88, 0.016).translate(x, railY + 0.55, z), M.metal, { tint: PAL.rail });
    colliders.aabb(x - 0.04, railY, z0, x + 0.04, railY + 1.05, z1);
  };
  railX(backW.x0 + 0.2, EAST.x0 - WALK_W, backW.z1 - 0.08);
  railZ(-42.15, eastW.z1 - 0.2, eastW.x0 + 0.08);
  railX(eastW.x0 + 0.08, EAST.x0, eastW.z1 - 0.08);

  // ---- Breeze-block screens: west end of the walkway, south end of the east walkway ---------------
  const screen = (x0, z0, x1, z1, y0, y1) => {
    batch.add(new THREE.BoxGeometry(Math.max(0.12, x1 - x0), y1 - y0, Math.max(0.12, z1 - z0)).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), M.breeze, { tint: PAL.breeze, uv: 0.4, castShadow: true });
    colliders.aabb(x0, y0, z0, x1, y1, z1);
  };
  screen(BACK.x0 - 0.12, BACK.z1, BACK.x0, BACK.z1 + WALK_W, Y0, Y0 + 2 * FLOOR_H);
  screen(eastW.x0, eastW.z1, EAST.x0, eastW.z1 + 0.12, Y0 + STEP, Y0 + 2 * FLOOR_H);

  // ---- Stair: steel stringers, open treads, 17 risers ≤ 0.18 m ------------------------------------
  // Runs along the walkway edge at z -43.4..-42.2, bottom at x 213, landing on the east walkway.
  buildStair(ctx, { x0: 213.0, x1: EAST.x0 - WALK_W, z0: backW.z1 + 0.05, z1: backW.z1 + 1.25 });

  // ---- Per-room details: number plates, AC units, porch lights -----------------------------------
  const plates = [];
  for (const s of slots) {
    const frame = s.wing === 'back' ? frameS() : frameW();
    const toW = (lx, ly, lz) => onFace(frame, lx, ly, lz);
    const ry = s.wing === 'back' ? 0 : -Math.PI / 2;
    const mtx = (lx, ly, lz) => new THREE.Matrix4().makeRotationY(ry).setPosition(toW(lx, ly, lz));
    // Number plate above the door.
    const pg = atlas.cellUV(new THREE.PlaneGeometry(0.28, 0.14), s.index);
    batch.add(pg, atlas.material, { matrix: mtx(s.bx + 0.75, s.y + DOOR_H + 0.17, 0.012), uv: 'keep', castShadow: false, chunk: 'landmark' });
    plates.push(s);
    // Door: steel jamb flush with the façade, slab recessed 8 cm (closed; nobody answers).
    if (!s.player) {
      const jm = new THREE.Matrix4().multiplyMatrices(frame.matrix, new THREE.Matrix4().makeTranslation(s.bx + 0.3, s.y, 0));
      stampParts(batch, jambParts({ depth: 0.3 }), jm);
      const dm = new THREE.Matrix4().multiplyMatrices(frame.matrix, new THREE.Matrix4().makeTranslation(s.bx + 0.3, s.y, -0.08));
      stampParts(batch, doorParts({ tint: s.doorTint }), dm, { grimeBase: Y0 + s.y });
      const dp = toW(s.bx + 0.75, s.y + 1.05, -0.08);
      colliders.box(dp.x, dp.y, dp.z, s.wing === 'back' ? DOOR_W : 0.1, DOOR_H, s.wing === 'back' ? 0.1 : DOOR_W);
    }
    // AC unit under the window, sleeve through the wall; grille + drip stain.
    const acx = s.bx + 2.55;
    const acy = s.y + 0.62;
    batch.add(new THREE.BoxGeometry(0.66, 0.42, 0.52).translate(0, 0, 0.12), M.metal, { matrix: mtx(acx, acy, 0), tint: rng.pick([0xd8d2c2, 0xcbc4b0, 0xbdb7a6]), grime: 0.6, grimeBase: Y0 + s.y });
    batch.add(new THREE.PlaneGeometry(0.56, 0.32), acGrilleMat(), { matrix: mtx(acx, acy, 0.381), uv: 'keep', castShadow: false });
    const ap = toW(acx, acy, 0.12);
    colliders.box(ap.x, ap.y, ap.z, s.wing === 'back' ? 0.66 : 0.52, 0.42, s.wing === 'back' ? 0.52 : 0.66);
    ctx.decals.push({ kind: 'streak', position: toW(acx, acy - 0.62, 0.005), normal: frame.normal, size: [0.55, 0.9], rotation: Math.PI, opacity: 0.75 });
    if (s.floor === 0) ctx.decals.push({ kind: 'puddle', position: new THREE.Vector3(ap.x, Y0 + STEP + 0.002, ap.z).addScaledVector(frame.normal, 0.25), normal: new THREE.Vector3(0, 1, 0), size: 0.6, opacity: 0.5 });
    // Wall-pack porch light between door and window.
    const lp = mtx(s.bx + 1.42, s.y + 2.2, 0);
    batch.add(new THREE.BoxGeometry(0.16, 0.22, 0.12).translate(0, 0, 0.06), M.metal, { matrix: lp, tint: 0x2a2a28 });
    const dead = rng.chance(0.18);
    batch.add(new THREE.PlaneGeometry(0.12, 0.14).translate(0, -0.02, 0.121), dead ? PM.lampDead : PM.lampWarm, { matrix: lp, uv: 'keep', castShadow: false });
    if (!dead) lights.push({ pos: toW(s.bx + 1.42, s.y + 2.05, 0.45), color: 0xffc27a, intensity: 2.0, distance: 5, kind: 'lamp', groundY: Y0 + s.y + (s.floor ? 0 : STEP), flicker: rng.chance(0.15), width: 0.4 });
    // Grime around the handle side of the door and a scuff band at boot height.
    ctx.decals.push({ kind: 'grime', position: toW(s.bx + 0.3 + DOOR_W + 0.1, s.y + 1.0, 0.004), normal: frame.normal, size: [0.4, 1.2], opacity: 0.45 });
  }
  // Wall grime / graffiti along both façades.
  ctx.decalWalls.push({ frame: frameS(), x0: 0.3, x1: 34, y0: 0.2, y1: 2.6, kinds: ['grime', 'grime', 'streak'], n: 10 });
  ctx.decalWalls.push({ frame: frameS(), x0: 0.3, x1: 34, y0: FLOOR_H + 0.2, y1: FLOOR_H + 2.6, kinds: ['grime', 'streak'], n: 6 });
  ctx.decalWalls.push({ frame: frameW(), x0: 1.6, x1: 24.5, y0: 0.2, y1: 2.6, kinds: ['grime', 'streak', 'grime'], n: 8 });

  // ---- Ice nook: OUT OF ORDER ice machine + a humming soda machine -------------------------------
  iceNook(ctx);

  return { slots, plates };
}

// Façade frames matching addBuilding's SIDES (S: west→east at z1; W: north→south at x0, no N inset).
function frameS() {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)).setPosition(BACK.x0, Y0, BACK.z1);
  return { matrix: m, normal: new THREE.Vector3(0, 0, 1), along: new THREE.Vector3(1, 0, 0), len: BACK.x1 - BACK.x0 };
}
function frameW() {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)).setPosition(EAST.x0, Y0, EAST.z0);
  return { matrix: m, normal: new THREE.Vector3(-1, 0, 0), along: new THREE.Vector3(0, 0, 1), len: EAST.z1 - EAST.z0 };
}

let grille = null;
function acGrilleMat() {
  if (!grille) {
    grille = plaqueMat('ac-grille', 160, 96, (g, w, h) => {
      g.fillStyle = '#8a867c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#34322e';
      for (let y = 8; y < h - 18; y += 6) g.fillRect(8, y, w - 16, 3);
      // Control knobs + rust run-off at the bottom lip.
      g.fillStyle = '#5c5850';
      g.fillRect(w - 30, h - 16, 20, 10);
      const grd = g.createLinearGradient(0, h - 14, 0, h);
      grd.addColorStop(0, 'rgba(120,64,24,0)');
      grd.addColorStop(1, 'rgba(120,64,24,0.75)');
      g.fillStyle = grd;
      g.fillRect(0, h - 14, w, 14);
    });
  }
  return grille;
}

function buildStair(ctx, { x0, x1, z0, z1 }) {
  const { batch, colliders } = ctx;
  const M = motelMats();
  const top = Y0 + FLOOR_H;
  const risers = 17;
  const rise = FLOOR_H / risers; // 0.171 m
  const run = (x1 - x0) / (risers - 1);
  const w = z1 - z0;
  const zc = (z0 + z1) / 2;
  const steel = 0x55524c;
  for (let k = 0; k < risers - 1; k++) {
    const ty = Y0 + (k + 1) * rise; // tread top
    const tx = x0 + k * run;
    // Diamond-plate tread (steel) with a nosing; exact box collider from the ground up.
    batch.add(new THREE.BoxGeometry(run + 0.02, 0.04, w - 0.08).translate(tx + run / 2, ty - 0.02, zc), M.metal, { tint: steel, grime: 0.4, grimeBase: Y0 });
    colliders.aabb(tx, Y0, z0, tx + run, ty, z1);
  }
  // Stringers (C-channel look: two thin plates) + handrails both sides.
  const len = Math.hypot(x1 - x0, FLOOR_H);
  const ang = Math.atan2(FLOOR_H, x1 - x0);
  for (const sz of [z0 + 0.03, z1 - 0.03]) {
    const g = new THREE.BoxGeometry(len, 0.26, 0.05).rotateZ(ang).translate((x0 + x1) / 2, Y0 + FLOOR_H / 2 - 0.05, sz);
    batch.add(g, M.metal, { tint: steel, grime: 0.6, grimeBase: Y0 });
  }
  const rail = new THREE.CylinderGeometry(0.022, 0.022, len, 8).rotateZ(Math.PI / 2).rotateZ(ang).translate((x0 + x1) / 2, Y0 + FLOOR_H / 2 + 0.92, z1 - 0.03);
  batch.add(rail, M.metal, { tint: PAL.rail });
  for (let k = 0; k <= 4; k++) {
    const px = x0 + 0.1 + (k / 4) * (x1 - x0 - 0.2);
    const py = Y0 + ((px - x0) / (x1 - x0)) * FLOOR_H;
    batch.add(new THREE.BoxGeometry(0.04, 0.92, 0.04).translate(px, py + 0.46, z1 - 0.03), M.metal, { tint: PAL.rail });
  }
  // Outer side guard as a sloped collider (a sequence of short boxes).
  for (let k = 0; k < 6; k++) {
    const a = x0 + (k / 6) * (x1 - x0);
    const b = x0 + ((k + 1) / 6) * (x1 - x0);
    const yb = Y0 + ((k + 1) / 6) * FLOOR_H;
    colliders.aabb(a, yb - 0.2, z1 - 0.05, b, yb + 1.0, z1 + 0.03);
  }
  // Concrete footing pads.
  batch.add(new THREE.BoxGeometry(0.4, 0.06, w + 0.1).translate(x0 + 0.1, Y0 + 0.03, zc), M.concrete, {});
  void top;
}

function iceNook(ctx) {
  const { batch, colliders, lights } = ctx;
  const M = motelMats();
  const PM = propMats();
  const zb = BACK.z1 - 0.3; // back of the alcove (inside face of the façade wall)
  // Alcove liner: back wall + ceiling, painted the trim colour.
  batch.add(new THREE.BoxGeometry(2.6, 2.2, 0.06).translate(217.5, Y0 + STEP + 1.1, zb - 0.6), M.stucco, { tint: PAL.wallShade, grime: 0.8, grimeBase: Y0 + STEP });
  batch.add(new THREE.BoxGeometry(2.6, 0.06, 0.95).translate(217.5, Y0 + 2.3, zb - 0.15), M.stucco, { tint: PAL.wallShade });
  batch.add(new THREE.BoxGeometry(2.6, STEP, 0.95).translate(217.5, Y0 + STEP / 2, zb - 0.15), M.concrete, {});
  for (const x of [216.23, 218.77]) batch.add(new THREE.BoxGeometry(0.06, 2.2, 0.95).translate(x, Y0 + STEP + 1.1, zb - 0.15), M.stucco, { tint: PAL.wallShade, grime: 0.8, grimeBase: Y0 + STEP });
  // Ice machine (stainless, "OUT OF ORDER" taped across it).
  const ice = (x) => {
    batch.add(new THREE.BoxGeometry(0.78, 1.5, 0.72).translate(x, Y0 + STEP + 0.75, zb - 0.2), mat2('steel'), {});
    batch.add(new THREE.BoxGeometry(0.6, 0.38, 0.03).translate(x, Y0 + STEP + 1.12, zb + 0.17), M.metal, { tint: 0x2c4a6a });
    batch.add(new THREE.PlaneGeometry(0.5, 0.2).translate(x, Y0 + STEP + 1.12, zb + 0.19), signMat('ice', '#2c4a6a', '#e9f2f6', t('motel.ice')), { uv: 'keep', castShadow: false });
    // Taped notice, slightly crooked.
    const n = new THREE.PlaneGeometry(0.42, 0.28).rotateZ(0.06).translate(x, Y0 + STEP + 0.7, zb + 0.165);
    batch.add(n, notice(), { uv: 'keep', castShadow: false });
    colliders.aabb(x - 0.4, Y0, zb - 0.6, x + 0.4, Y0 + STEP + 1.5, zb + 0.16);
  };
  ice(216.75);
  // Soda machine: red front, lit panel at night.
  const sx = 218.0;
  batch.add(new THREE.BoxGeometry(0.9, 1.8, 0.78).translate(sx, Y0 + STEP + 0.9, zb - 0.17), M.metal, { tint: 0x9c1d1d, grime: 0.5, grimeBase: Y0 + STEP });
  batch.add(new THREE.PlaneGeometry(0.62, 1.15).translate(sx - 0.08, Y0 + STEP + 1.12, zb + 0.225), sodaFront(), { uv: 'keep', castShadow: false });
  colliders.aabb(sx - 0.45, Y0, zb - 0.6, sx + 0.45, Y0 + STEP + 1.8, zb + 0.23);
  lights.push({ pos: new THREE.Vector3(sx, Y0 + 1.3, zb + 0.7), color: 0xdbe8ff, intensity: 1.6, distance: 4, kind: 'lamp', groundY: Y0 + STEP, width: 0.6 });
  void PM;
}

const mat2 = (k) => mat(k, { wear: 0.6, dirt: 0.55, seed: 830 });

function signMat(key, bg, fg, text) {
  return plaqueMat(`sign-${key}`, 256, 100, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = '400 78px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}

function notice() {
  return plaqueMat('out-of-order', 256, 170, (g, w, h) => {
    g.fillStyle = '#f4f1e6';
    g.fillRect(0, 0, w, h);
    // Masking tape corners.
    g.fillStyle = 'rgba(222,205,150,0.9)';
    g.fillRect(-8, 6, 60, 18);
    g.fillRect(w - 52, h - 26, 60, 18);
    g.fillStyle = '#1b1b1b';
    g.font = '400 50px "Special Elite", "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = t('motel.outOfOrder').split(' ');
    const half = Math.ceil(words.length / 2);
    g.fillText(words.slice(0, half).join(' '), w / 2, h * 0.38);
    g.fillText(words.slice(half).join(' '), w / 2, h * 0.7);
  }, { transparent: false });
}

function sodaFront() {
  return plaqueMat('soda-front', 160, 300, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#b3201f');
    grd.addColorStop(1, '#6f1212');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f7efe2';
    g.save();
    g.translate(w * 0.5, h * 0.42);
    g.rotate(-Math.PI / 2);
    g.font = 'italic 700 46px "Playfair Display", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t('motel.soda'), 0, 0);
    g.restore();
    // Selection buttons column.
    for (let i = 0; i < 6; i++) {
      g.fillStyle = ['#d8d1c2', '#2a5fa8', '#e8b73a', '#3a8a3a', '#d8d1c2', '#a83a2a'][i];
      g.fillRect(w - 26, 40 + i * 30, 18, 20);
    }
    g.fillStyle = '#222';
    g.fillRect(16, h - 40, w - 60, 24);
  }, { lit: 1.4 });
}
