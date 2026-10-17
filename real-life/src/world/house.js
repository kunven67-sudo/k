// The family house: a one-storey Midwest ranch (Maple Hollow, Ohio) with an attached garage.
// Built from real-scale walls (drywall paint inside, vinyl siding outside), floors per room,
// trim, windows, a shingle roof, porch, driveway, and furnished by family wealth.
//
//   const house = buildHouse(world, { x0, zf, wealth, seed, kidSex, sibling })
//
// Local layout (u = metres to the right along the street, w = metres back from the front wall):
//
//   w=0   +-------------------------------+-----------+
//         |  LIVING (0..7)   |  KITCHEN   |  GARAGE   |
//         |                  |  + DINING  |  (13..19) |
//   w=6.8 +-----+-----+------+------------+-----------+  <- hall wall, bedroom doors
//         | YOU | BATH| ROOM2 |  PARENTS  |
//   w=11  +-----+-----+-------+-----------+
//
// Returns { rooms, spots, doors, lights, spawn, ... } for the world to wire up.

import * as THREE from 'three';
import { mat } from '../gfx/materials.js';
import { Rng } from '../core/rng.js';
import { mergeGeometries as mergeGeos } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture } from '../gfx/textures.js';
import { Decor } from './decor.js';

export const FLOOR_Y = 0.3; // raised foundation
export const CEIL = 2.6; // room height above the floor
const EXT_T = 0.2;
const INT_T = 0.12;

const WEALTH = ['poor', 'working', 'middle', 'rich', 'veryrich'];

const PAINTS = {
  living: [0xe9e1d2, 0xdfe3dc, 0xe8dcc8, 0xd9e0e6],
  kitchen: [0xf1ead8, 0xe4ecdf, 0xf3e6cf],
  kid: { m: [0xbfd6ea, 0xcde3c4, 0xd9d2ec, 0xf0e2b8], f: [0xe9cbd8, 0xd9d2ec, 0xcfe7e1, 0xf3e0c4] },
  bath: [0xdfeaf0, 0xeef0ea],
  room2: [0xe6e0ef, 0xe1ece3, 0xf0e6d6],
  master: [0xd9d0c3, 0xd8dee6, 0xe3d6cc],
  garage: [0xcfcac0],
};
const SIDING = [0xd9d4c7, 0xb9c6cf, 0xc9c0a8, 0x9fb3a3, 0xe8e4da, 0xa9b4bf];

export function buildHouse(world, B, I, opts) {
  const { x0, zf, wealth = 'middle', seed = 1, kidSex = 'm', sibling = 'none' } = opts;
  const rng = new Rng(seed);
  const wi = Math.max(0, WEALTH.indexOf(wealth));
  const X = (u) => x0 + u;
  const Z = (w) => zf - w;
  const Y = FLOOR_Y;
  const H = FLOOR_Y + CEIL; // top of walls / ceiling

  const paint = (hex) => mat('paint', { color: hex });
  const P = {
    living: paint(rng.pick(PAINTS.living)),
    kitchen: paint(rng.pick(PAINTS.kitchen)),
    kid: paint(rng.pick(PAINTS.kid[kidSex])),
    bath: paint(rng.pick(PAINTS.bath)),
    room2: paint(rng.pick(PAINTS.room2)),
    master: paint(rng.pick(PAINTS.master)),
    garage: mat('drywall', { color: 0xcfcac0, wear: 0.5, dirt: 0.5 }),
  };
  const trim = mat('paint', { color: 0xf6f3ec });
  const siding = mat('siding', { color: rng.pick(SIDING), dirt: 0.2 + (4 - wi) * 0.05 });
  const ceiling = mat('paint', { color: 0xf4f1ea });
  const foundation = mat('concrete', { wear: 0.3, dirt: 0.4 });
  const F = {
    living: wi >= 3 ? mat('wood-floor', { color: 0x9a6a40, wear: 0.15, dirt: 0.1 }) : mat('carpet', { color: [0xa89b86, 0x9c9a8f, 0xb4a48c][wi % 3], wear: 0.3 + (2 - Math.min(wi, 2)) * 0.15 }),
    kitchen: wi >= 3 ? mat('tile-floor', { color: 0xe2ded6, count: 2 }) : mat('linoleum', { color: 0xd6cfbd, color2: 0xbab19b, wear: 0.3, dirt: 0.2 }),
    hall: mat('wood-floor', { color: 0x8a5a34, wear: 0.25, dirt: 0.15 }),
    kid: mat('carpet', { color: kidSex === 'f' ? 0xc7b3b5 : 0x9fa8b3, wear: 0.25 }),
    bath: mat('tile-floor', { color: 0xe8e6e0, count: 4 }),
    room2: mat('carpet', { color: 0xb0a690, wear: 0.2 }),
    master: mat('carpet', { color: 0xbcae98, wear: 0.15 }),
    garage: mat('concrete', { wear: 0.6, dirt: 0.7 }),
  };
  const glass = mat('glass', { dirt: 0.1 });

  let clockSpot = null;
  const rooms = [];
  const room = (id, name, u0, w0, u1, w1, floor, extra = {}) => {
    const r = { id, name, box: new THREE.Box3(new THREE.Vector3(X(u0), Y - 0.5, Z(w1)), new THREE.Vector3(X(u1), H, Z(w0))), surface: extra.surface || 'carpet', lights: [], lightOn: false, ...extra };
    rooms.push(r);
    B.slab(X(u0), Z(w0), X(u1), Z(w1), Y, floor, { thick: 0.3 });
    I.slab(X(u0), Z(w0), X(u1), Z(w1), H + 0.1, null, { thick: 0.1, under: ceiling, collide: false });
    return r;
  };

  // ---------------------------------------------------------------- rooms + floors + ceilings
  const R = {
    living: room('living', 'Living room', 0.2, 0.2, 7, 6.86, F.living, { surface: wi >= 3 ? 'wood' : 'carpet' }),
    kitchen: room('kitchen', 'Kitchen', 7, 0.2, 12.8, 6.86, F.kitchen, { surface: 'tile' }),
    kid: room('kid', 'Your room', 0.2, 6.86, 4.2, 10.8, F.kid),
    bath: room('bath', 'Bathroom', 4.2, 6.86, 6.6, 10.8, F.bath, { surface: 'tile' }),
    room2: room('room2', sibling === 'none' ? 'Spare room' : 'Sibling room', 6.6, 6.86, 9.4, 10.8, F.room2),
    master: room('master', "Parents' room", 9.4, 6.86, 12.8, 10.8, F.master),
  };
  // Garage floor sits low (car height).
  const gY = 0.14;
  const garage = { id: 'garage', name: 'Garage', box: new THREE.Box3(new THREE.Vector3(X(13.1), -0.5, Z(6.8)), new THREE.Vector3(X(18.8), H, Z(0.2))), surface: 'concrete', lights: [], lightOn: false };
  rooms.push(garage);
  B.slab(X(13.1), Z(0.2), X(18.8), Z(6.8), gY, F.garage, { thick: 0.3 });
  I.slab(X(13.1), Z(0.2), X(18.8), Z(6.8), H + 0.1, null, { thick: 0.1, under: mat('drywall', { color: 0xd8d4cc, wear: 0.4, dirt: 0.5 }), collide: false });
  R.garage = garage;

  // ---------------------------------------------------------------- walls
  // u-walls run along +x: A = front (smaller w) side, B = back side.
  const uWall = (w, u0, u1, A, Bm, { t = INT_T, y = Y, h = CEIL, openings = [] } = {}) =>
    B.wall(X(u0), Z(w), X(u1), Z(w), { y, h, t, matA: A, matB: Bm, matEdge: trim, openings: openings.map((o) => ({ ...o, at: o.u - u0 })) });
  // w-walls run along -z (towards the back): A = right (bigger u) side, B = left side.
  const wWall = (u, w0, w1, A, Bm, { t = INT_T, y = Y, h = CEIL, openings = [] } = {}) =>
    B.wall(X(u), Z(w0), X(u), Z(w1), { y, h, t, matA: A, matB: Bm, matEdge: trim, openings: openings.map((o) => ({ ...o, at: o.d - w0 })) });

  const DOOR = { w: 0.92, h: 2.05 };
  const WIN = (at, w = 1.3, sill = 0.9, h = 1.25) => ({ w, h, sill });
  const ext = { t: EXT_T, y: 0, h: H };
  // Exterior: front wall pieces (outside = siding on A).
  const winLiving1 = { u: 2.4, w: 2.0, sill: Y + 0.75, h: 1.45 };
  const doorFront = { u: 5.6, w: DOOR.w, h: DOOR.h, sill: Y };
  uWall(0.1, 0, 7, siding, P.living, { ...ext, openings: [winLiving1, doorFront] });
  const winKitchen = { u: 10.2, w: 1.6, h: 1.05, sill: Y + 1.05 };
  uWall(0.1, 7, 13, siding, P.kitchen, { ...ext, openings: [winKitchen] });
  // Back wall (outside on B).
  const winKid = { u: 2.2, w: 1.2, h: 1.25, sill: Y + 0.85 };
  const winBath = { u: 5.4, w: 0.7, h: 0.55, sill: Y + 1.6 };
  const winRoom2 = { u: 8.0, w: 1.2, h: 1.25, sill: Y + 0.85 };
  const winMaster = { u: 11.1, w: 1.5, h: 1.25, sill: Y + 0.85 };
  uWall(10.9, 0, 4.2, P.kid, siding, { ...ext, openings: [winKid] });
  uWall(10.9, 4.2, 6.6, P.bath, siding, { ...ext, openings: [winBath] });
  uWall(10.9, 6.6, 9.4, P.room2, siding, { ...ext, openings: [winRoom2] });
  uWall(10.9, 9.4, 13, P.master, siding, { ...ext, openings: [winMaster] });
  // Left side wall (outside on B = smaller u).
  wWall(0.1, 0, 6.8, P.living, siding, { ...ext, openings: [{ d: 1.2, w: 1.0, h: 1.25, sill: Y + 0.85 }] });
  const kidSide = { at: 2.0, w: 1.0, h: 1.2, sill: Y + 0.85 }; // the window you can sneak out of
  B.wall(X(0.1), Z(6.8), X(0.1), Z(11), { y: 0, h: H, t: EXT_T, matA: P.kid, matB: siding, matEdge: trim, openings: [kidSide] });
  // Right side: house/garage wall (garage side unpainted drywall) + master exterior part.
  B.wall(X(12.9), Z(0), X(12.9), Z(7), { y: 0, h: H, t: EXT_T, matA: P.garage, matB: P.kitchen, matEdge: trim, openings: [{ at: 3.2, w: DOOR.w, h: DOOR.h, sill: Y }] });
  B.wall(X(12.9), Z(7), X(12.9), Z(11), { y: 0, h: H, t: EXT_T, matA: siding, matB: P.master, matEdge: trim, openings: [{ at: 2.0, w: 1.2, h: 1.25, sill: Y + 0.85 }] });
  // Garage exterior.
  const garageDoorOpening = { at: 3.0, w: 4.8, h: 2.3, sill: gY };
  B.wall(X(12.8), Z(0.1), X(19), Z(0.1), { y: 0, h: H, t: EXT_T, matA: siding, matB: P.garage, matEdge: trim, openings: [{ ...garageDoorOpening, at: 3.1 }] });
  B.wall(X(12.8), Z(6.9), X(19), Z(6.9), { y: 0, h: H, t: EXT_T, matA: P.garage, matB: siding, matEdge: trim, openings: [{ at: 4.6, w: 0.9, h: 2.05, sill: gY }] });
  B.wall(X(18.9), Z(0.2), X(18.9), Z(6.8), { y: 0, h: H, t: EXT_T, matA: siding, matB: P.garage, matEdge: trim, openings: [{ at: 4.0, w: 1.0, h: 0.8, sill: 1.4 }] });
  // Foundation strip (concrete) around the main house + garage.
  for (const [u0, w0, u1, w1] of [[-0.02, -0.02, 13.02, 0.12], [-0.02, 10.88, 13.02, 11.02], [-0.02, 0, 0.12, 11], [18.88, 0, 19.02, 7]]) {
    B.box((X(u0) + X(u1)) / 2, 0.15, (Z(w0) + Z(w1)) / 2, Math.abs(X(u1) - X(u0)), 0.3, Math.abs(Z(w1) - Z(w0)), [foundation, foundation, null, null, foundation, foundation], { collide: false });
  }

  // Interior walls: hall wall (front rooms | back rooms) with bedroom doors.
  const dKid = { u: 3.45, w: 0.82, h: DOOR.h, sill: 0 };
  const dBath = { u: 5.0, w: 0.76, h: DOOR.h, sill: 0 };
  const dRoom2 = { u: 7.3, w: 0.82, h: DOOR.h, sill: 0 };
  const dMaster = { u: 10.1, w: 0.82, h: DOOR.h, sill: 0 };
  uWall(6.8, 0.2, 4.2, P.living, P.kid, { openings: [dKid] });
  uWall(6.8, 4.2, 6.6, P.living, P.bath, { openings: [dBath] });
  uWall(6.8, 6.6, 7, P.living, P.room2);
  uWall(6.8, 7, 9.4, P.kitchen, P.room2, { openings: [dRoom2] });
  uWall(6.8, 9.4, 12.8, P.kitchen, P.master, { openings: [dMaster] });
  // Bedroom dividers.
  wWall(4.2, 6.86, 10.8, P.bath, P.kid);
  wWall(6.6, 6.86, 10.8, P.room2, P.bath);
  wWall(9.4, 6.86, 10.8, P.master, P.room2);
  // Living/kitchen half divider (open plan, a stub wall + a breakfast bar).
  wWall(7, 0.2, 2.0, P.kitchen, P.living);

  // Baseboards (tiny boxes, merged).
  const base = (x0b, z0b, x1b, z1b) => {
    const len = Math.hypot(x1b - x0b, z1b - z0b);
    const rot = Math.atan2(-(z1b - z0b), x1b - x0b);
    B.box((x0b + x1b) / 2, Y + 0.05, (z0b + z1b) / 2, len, 0.1, 0.025, trim, { rotY: rot, collide: false, shadow: false });
  };
  for (const r of Object.values(R)) {
    if (r.id === 'garage') continue;
    const b = r.box;
    const i = 0.02;
    base(b.min.x + 0.06, b.max.z - i - 0.06, b.max.x - 0.06, b.max.z - i - 0.06);
    base(b.min.x + 0.06, b.min.z + i + 0.06, b.max.x - 0.06, b.min.z + i + 0.06);
  }

  // ---------------------------------------------------------------- windows (frames + glass)
  const windows = [];
  const addWindow = (cx, cy, cz, w, h, rotY, { opens = false, roomId = null } = {}) => {
    const fr = 0.06;
    const t = 0.12;
    const r = rotY;
    const dir = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r));
    const put = (along, y, sw, sh) => B.box(cx + dir.x * along, y, cz + dir.z * along, sw, sh, t, trim, { rotY: r, collide: false });
    put(0, cy - h / 2 + fr / 2, w, fr); // sill frame
    put(0, cy + h / 2 - fr / 2, w, fr);
    put(-w / 2 + fr / 2, cy, fr, h);
    put(w / 2 - fr / 2, cy, fr, h);
    put(0, cy, w - fr * 2, 0.035); // meeting rail (double hung)
    // Outside sill ledge.
    B.box(cx, cy - h / 2 - 0.03, cz, w + 0.14, 0.05, 0.3, trim, { rotY: r, collide: false });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - fr * 2, h - fr * 2), glass);
    pane.position.set(cx, cy, cz);
    pane.rotation.y = r;
    pane.renderOrder = 2;
    world.scene.add(pane);
    // Glass blocks you (a closed window).
    const col = B.collider(cx, cy, cz, w, h, 0.05, r);
    const win = { pane, col, center: new THREE.Vector3(cx, cy, cz), w, h, rotY: r, open: false, opens, roomId };
    windows.push(win);
    return win;
  };
  const midY = (o) => o.sill + o.h / 2;
  addWindow(X(winLiving1.u), midY(winLiving1), Z(0.1), winLiving1.w, winLiving1.h, 0);
  addWindow(X(winKitchen.u), midY(winKitchen), Z(0.1), winKitchen.w, winKitchen.h, 0);
  addWindow(X(winKid.u), midY(winKid), Z(10.9), winKid.w, winKid.h, 0);
  addWindow(X(winBath.u), midY(winBath), Z(10.9), winBath.w, winBath.h, 0);
  addWindow(X(winRoom2.u), midY(winRoom2), Z(10.9), winRoom2.w, winRoom2.h, 0);
  addWindow(X(winMaster.u), midY(winMaster), Z(10.9), winMaster.w, winMaster.h, 0);
  addWindow(X(0.1), Y + 0.85 + 0.625, Z(1.2), 1.0, 1.25, Math.PI / 2);
  const sneakWindow = addWindow(X(0.1), kidSide.sill + kidSide.h / 2, Z(6.8 + kidSide.at), kidSide.w, kidSide.h, Math.PI / 2, { opens: true, roomId: 'kid' });
  addWindow(X(12.9), Y + 0.85 + 0.625, Z(9), 1.2, 1.25, Math.PI / 2);
  addWindow(X(18.9), 1.8, Z(4.2), 1.0, 0.8, Math.PI / 2);

  // ---------------------------------------------------------------- roof
  const roofMat = mat('shingles', { color: rng.pick([0x4a4a4c, 0x5a4a3e, 0x3e4650, 0x6a6258]), dirt: 0.35 });
  const fascia = trim;
  gableRoof(world, B, { x0: X(-0.4), x1: X(13.4), zFront: Z(-0.45), zBack: Z(11.45), y: H + 0.02, rise: 2.1, mat: roofMat, gable: siding, fascia });
  gableRoof(world, B, { x0: X(12.95), x1: X(19.4), zFront: Z(-0.45), zBack: Z(7.45), y: H + 0.02, rise: 1.4, mat: roofMat, gable: siding, fascia, skipLeftGable: true });

  // ---------------------------------------------------------------- porch, steps, walkways
  const concrete = mat('concrete', { wear: 0.25, dirt: 0.35 });
  const pu = doorFront.u;
  B.box(X(pu), Y / 2, Z(-0.9), 2.6, Y, 1.8, concrete);
  B.box(X(pu), Y * 0.33, Z(-1.95), 1.6, Y * 0.66, 0.3, concrete);
  B.box(X(pu), Y * 0.165, Z(-2.25), 1.6, Y * 0.33, 0.3, concrete);
  // Porch posts + small roof over the door.
  for (const du of [-1.15, 1.15]) B.box(X(pu + du), Y + 1.3, Z(-1.65), 0.12, 2.6, 0.12, trim, { collide: true });
  B.box(X(pu), H + 0.05, Z(-1.0), 2.8, 0.1, 2.1, [trim, trim, roofMat, trim, trim, trim], { collide: false });

  // ---------------------------------------------------------------- doors
  const doors = [];
  const door = (name, cx, cz, w, rotY, { hingeLeft = true, y = Y, exterior = false, lockable = false, roomA, roomB } = {}) => {
    doors.push({ name, cx, cz, w, h: 2.03, rotY, hingeLeft, y, exterior, lockable, roomA, roomB, style: exterior ? 'front' : 'interior' });
  };
  door('Front door', X(doorFront.u), Z(0.1), doorFront.w - 0.04, 0, { exterior: true, lockable: true, hingeLeft: false, roomA: 'outside', roomB: 'living' });
  door('Your room', X(dKid.u), Z(6.8), dKid.w - 0.04, 0, { roomA: 'living', roomB: 'kid', lockable: true });
  door('Bathroom', X(dBath.u), Z(6.8), dBath.w - 0.04, 0, { roomA: 'living', roomB: 'bath', lockable: true, hingeLeft: false });
  door(R.room2.name, X(dRoom2.u), Z(6.8), dRoom2.w - 0.04, 0, { roomA: 'kitchen', roomB: 'room2' });
  door("Parents' room", X(dMaster.u), Z(6.8), dMaster.w - 0.04, 0, { roomA: 'kitchen', roomB: 'master', lockable: true });
  door('Garage door', X(12.9), Z(3.2), DOOR.w - 0.04, Math.PI / 2, { roomA: 'garage', roomB: 'kitchen' });
  door('Back door', X(17.4), Z(6.9), 0.86, 0, { exterior: true, lockable: true, y: gY, roomA: 'garage', roomB: 'outside' });

  // ---------------------------------------------------------------- furniture + spots
  const spots = [];
  const spot = (kind, data) => {
    const s = { kind, ...data };
    spots.push(s);
    return s;
  };
  const H1 = (kit, name, o) => B.model(kit, name, { y: Y, ...o });

  // ---- Your room (kid) ----
  {
    const r = R.kid.box;
    const c = r.getCenter(new THREE.Vector3());
    // Bed against the left wall under the window you can sneak out of, headboard on the back wall.
    const bedX = r.min.x + 0.52;
    const bedZ = r.min.z + 1.0;
    H1('home', 'Bed_Single', { x: bedX, z: bedZ, rotY: 0 });
    spot('bed', { room: 'kid', owner: 'you', at: new THREE.Vector3(bedX, Y + 0.55, bedZ), rotY: 0, label: 'your bed' });
    B.model('furniture', 'bear', { x: bedX + 0.15, y: Y + 0.6, z: r.min.z + 0.35, scale: 0.85, rotY: 0.4, collide: 'none' });
    H1('home', 'NightStand_1', { x: r.min.x + 1.35, z: r.min.z + 0.3 });
    spot('piggybank', { room: 'kid', at: new THREE.Vector3(r.min.x + 1.35, Y + 0.5, r.min.z + 0.3), label: 'piggy bank' });
    // Desk under the back window.
    H1('furniture', 'desk', { x: r.min.x + 2.75, z: r.min.z + 0.42, rotY: 0 });
    B.model('furniture', 'lampRoundTable', { x: r.min.x + 3.25, y: Y + 0.77, z: r.min.z + 0.3, collide: 'none' });
    spot('desk', { room: 'kid', at: new THREE.Vector3(r.min.x + 2.75, Y + 0.77, r.min.z + 0.42), label: 'desk' });
    B.model('furniture', 'chairDesk', { x: r.min.x + 2.75, y: Y, z: r.min.z + 1.12, rotY: Math.PI, collide: 'none' });
    spot('seat', { room: 'kid', at: new THREE.Vector3(r.min.x + 2.75, Y + 0.5, r.min.z + 1.12), faceYaw: Math.PI, label: 'desk chair' });
    // Dresser on the right wall with the TV on top (working-class families and up).
    const dz = r.min.z + 1.35;
    H1('home', 'Drawer_1', { x: r.max.x - 0.3, z: dz, rotY: -Math.PI / 2 });
    spot('dresser', { room: 'kid', at: new THREE.Vector3(r.max.x - 0.3, Y + 0.5, dz), label: 'dresser', loot: 'kid-dresser' });
    if (wi >= 1) {
      B.model('furniture', wi >= 2 ? 'televisionModern' : 'televisionVintage', { x: r.max.x - 0.3, y: Y + 0.68, z: dz, rotY: -Math.PI / 2, scale: wi >= 2 ? 1.1 : 1.8, collide: 'none' });
      spot('tv', { room: 'kid', at: new THREE.Vector3(r.max.x - 0.28, Y + 0.68 + (wi >= 2 ? 0.27 : 0.25), dz), faceYaw: -Math.PI / 2, size: wi >= 2 ? [0.68, 0.42] : [0.46, 0.34], label: 'your TV', console: true });
    }
    if (wi >= 3) {
      B.model('furniture', 'computerScreen', { x: r.min.x + 2.6, y: Y + 0.77, z: r.min.z + 0.25, scale: 1.6, collide: 'none' });
      B.model('furniture', 'computerKeyboard', { x: r.min.x + 2.6, y: Y + 0.77, z: r.min.z + 0.6, scale: 1.6, collide: 'none' });
      spot('pc', { room: 'kid', at: new THREE.Vector3(r.min.x + 2.6, Y + 1.0, r.min.z + 0.3), label: 'gaming PC' });
    }
    H1('home', 'Carpet_Round', { x: r.min.x + 2.2, z: c.z, y: Y + 0.008, collide: 'none' });
    H1('home', 'Shelf_Small1', { x: r.min.x + 0.12, y: Y + 1.55, z: r.min.z + 0.6, rotY: Math.PI / 2, collide: 'none' });
    B.model('furniture', 'books', { x: r.min.x + 0.15, y: Y + 1.62, z: r.min.z + 0.6, rotY: Math.PI / 2, collide: 'none' });
    B.model('home', 'Light_Ceiling5', { x: c.x, y: H, z: c.z, collide: 'none' });
    R.kid.lightAt = c.clone().setY(H - 0.25);
  }

  // ---- Bathroom ----
  {
    const r = R.bath.box;
    const c = r.getCenter(new THREE.Vector3());
    H1('home', 'Bathroom_Bathtub', { x: c.x, z: r.min.z + 0.42, rotY: Math.PI / 2 });
    spot('shower', { room: 'bath', at: new THREE.Vector3(c.x, Y + 0.4, r.min.z + 0.42), label: 'bathtub + shower' });
    H1('home', 'Bathroom_Toilet', { x: r.max.x - 0.42, z: r.min.z + 1.55, rotY: -Math.PI / 2 });
    spot('toilet', { room: 'bath', at: new THREE.Vector3(r.max.x - 0.45, Y + 0.45, r.min.z + 1.55), faceYaw: -Math.PI / 2, label: 'toilet' });
    H1('home', 'Bathroom_Sink', { x: r.max.x - 0.25, z: r.max.z - 0.75, rotY: -Math.PI / 2, y: Y - 0.07 });
    spot('sink-bath', { room: 'bath', at: new THREE.Vector3(r.max.x - 0.3, Y + 0.85, r.max.z - 0.75), label: 'bathroom sink' });
    B.model('home', 'Bathroom_Mirror1', { x: r.max.x - 0.06, y: Y + 1.55, z: r.max.z - 0.75, rotY: -Math.PI / 2, collide: 'none' });
    B.model('home', 'Bathroom_Towel', { x: r.min.x + 0.06, y: Y + 1.3, z: c.z + 0.3, rotY: Math.PI / 2, collide: 'none' });
    B.model('home', 'Bathroom_ToiletPaper', { x: r.max.x - 0.06, y: Y + 0.7, z: r.min.z + 2.0, rotY: -Math.PI / 2, collide: 'none' });
    B.model('home', 'Light_CeilingSingle', { x: c.x, y: H, z: c.z, collide: 'none' });
    R.bath.lightAt = c.clone().setY(H - 0.25);
  }

  // ---- Spare / sibling room ----
  {
    const r = R.room2.box;
    const c = r.getCenter(new THREE.Vector3());
    if (sibling === 'none') {
      H1('furniture', 'desk', { x: c.x + 0.3, z: r.min.z + 0.42 });
      B.model('furniture', 'laptop', { x: c.x + 0.3, y: Y + 0.77, z: r.min.z + 0.45, scale: 1.6, collide: 'none' });
      B.model('furniture', 'chairDesk', { x: c.x + 0.3, y: Y, z: r.min.z + 1.1, rotY: Math.PI, collide: 'none' });
      H1('home', 'Bookshelf', { x: r.max.x - 0.22, z: c.z + 0.6, rotY: -Math.PI / 2 });
      for (let i = 0; i < 3; i++) B.model('furniture', 'cardboardBoxClosed', { x: r.min.x + 0.35, y: Y + i * 0.55, z: r.min.z + 0.4, scale: 1.8, rotY: i * 0.3, collide: i === 0 ? 'box' : 'none' });
    } else {
      H1('home', 'Bed_Single', { x: r.max.x - 0.52, z: r.min.z + 1.0, rotY: 0 });
      spot('bed', { room: 'room2', owner: 'sibling', at: new THREE.Vector3(r.max.x - 0.52, Y + 0.55, r.min.z + 1.0), rotY: 0, label: 'sibling bed' });
      H1('home', 'Drawer_1', { x: r.min.x + 0.3, z: r.min.z + 1.2, rotY: Math.PI / 2 });
      H1('home', 'NightStand_2', { x: r.max.x - 1.35, z: r.min.z + 0.3 });
    }
    B.model('home', 'Light_Ceiling5', { x: c.x, y: H, z: c.z, collide: 'none' });
    R.room2.lightAt = c.clone().setY(H - 0.25);
  }

  // ---- Parents' room ----
  {
    const r = R.master.box;
    const bx = r.getCenter(new THREE.Vector3()).x;
    H1('home', 'Bed_King', { x: bx, z: r.min.z + 1.0, rotY: 0 });
    spot('bed', { room: 'master', owner: 'parents', at: new THREE.Vector3(bx, Y + 0.5, r.min.z + 1.0), rotY: 0, label: "parents' bed" });
    H1('home', 'NightStand_2', { x: bx - 1.02, z: r.min.z + 0.27 });
    H1('home', 'NightStand_2', { x: bx + 1.02, z: r.min.z + 0.27 });
    B.model('home', 'Light_Desk', { x: bx - 1.02, y: Y + 0.47, z: r.min.z + 0.27, collide: 'none' });
    H1('home', 'Drawer_2', { x: bx + 0.5, z: r.max.z - 0.3, rotY: Math.PI });
    spot('dresser', { room: 'master', at: new THREE.Vector3(bx + 0.5, Y + 0.5, r.max.z - 0.3), label: "parents' dresser", loot: 'parents-dresser', private: true });
    B.model('home', 'Light_Ceiling3', { x: bx, y: H, z: r.getCenter(new THREE.Vector3()).z, collide: 'none' });
    R.master.lightAt = r.getCenter(new THREE.Vector3()).setY(H - 0.3);
  }

  // ---- Living room ----
  {
    const r = R.living.box;
    const c = r.getCenter(new THREE.Vector3());
    const tvZ = Z(3.2);
    // TV on the left wall, couch facing it, coffee table + rug in between.
    B.model('furniture', 'cabinetTelevision', { x: r.min.x + 0.27, y: Y, z: tvZ, rotY: Math.PI / 2, scale: 2 });
    const tvBig = wi >= 2;
    const tvScale = tvBig ? 1.5 + wi * 0.15 : 2.2;
    B.model('furniture', tvBig ? 'televisionModern' : 'televisionVintage', { x: r.min.x + 0.27, y: Y + 0.62, z: tvZ, rotY: Math.PI / 2, scale: tvScale, collide: 'none' });
    spot('tv', { room: 'living', at: new THREE.Vector3(r.min.x + (tvBig ? 0.36 : 0.5), Y + 0.62 + (tvBig ? 0.45 * tvScale * 0.55 : 0.3), tvZ), faceYaw: Math.PI / 2, size: tvBig ? [0.62 * tvScale, 0.36 * tvScale] : [0.62, 0.46], label: 'TV', main: true });
    const couch = wi >= 3 ? 'Couch_Large1' : wi >= 1 ? 'Couch_Medium1' : 'Couch_Small1';
    const couchX = X(4.35);
    H1('home', couch, { x: couchX, z: tvZ, rotY: -Math.PI / 2 });
    spot('couch', { room: 'living', at: new THREE.Vector3(couchX - 0.12, Y + 0.45, tvZ), width: couch === 'Couch_Small1' ? 1.2 : 2.0, faceYaw: -Math.PI / 2, label: 'couch', coins: true });
    H1('home', 'Carpet_2', { x: X(2.5), z: tvZ, y: Y + 0.008, collide: 'none', rotY: Math.PI / 2 });
    H1('furniture', 'tableCoffee', { x: X(2.55), z: tvZ, scale: 1.8, rotY: Math.PI / 2 });
    H1('home', 'Houseplant_8', { x: r.min.x + 0.4, z: r.max.z - 0.4 });
    H1('home', 'Light_Floor1', { x: couchX + 0.1, z: tvZ - 1.55, collide: 'none' });
    if (wi >= 2) H1('home', wi >= 4 ? 'Fireplace' : 'Bookshelf', { x: X(1.6), z: r.min.z + (wi >= 4 ? 0.3 : 0.22), rotY: 0 });
    B.model('home', 'Light_Ceiling4', { x: c.x, y: H, z: c.z, collide: 'none' });
    R.living.lightAt = c.clone().setY(H - 0.6);
    B.model('home', 'Curtains_Double', { x: X(winLiving1.u), y: Y + 0.45, z: r.max.z - 0.12, rotY: Math.PI, scale: 0.6, collide: 'none' });
    B.model('furniture', 'rugDoormat', { x: X(doorFront.u), y: Y, z: r.max.z - 0.4, scale: 2.2, collide: 'none' });
  }

  // ---- Kitchen ----
  {
    const r = R.kitchen.box;
    // Counter run along the front wall under the window (sink centred under it).
    const zc = r.max.z - 0.3;
    const units = ['Kitchen_2Drawers', 'Kitchen_Cabinet1', 'Kitchen_Sink', 'Kitchen_Cabinet2', 'Kitchen_Oven', 'Kitchen_3Drawers'];
    const ux0 = X(winKitchen.u) - 1.0;
    units.forEach((u, i) => H1('home', u, { x: ux0 + i * 0.5, z: zc, rotY: Math.PI }));
    const sinkX = ux0 + 2 * 0.5;
    spot('sink-kitchen', { room: 'kitchen', at: new THREE.Vector3(sinkX, Y + 0.9, zc), label: 'kitchen sink' });
    spot('stove', { room: 'kitchen', at: new THREE.Vector3(ux0 + 4 * 0.5, Y + 0.85, zc), label: 'stove' });
    spot('cookies', { room: 'kitchen', at: new THREE.Vector3(ux0 + 0.5, Y + 1.0, zc - 0.05), label: 'cookie jar' });
    B.model('furniture', 'kitchenMicrowave', { x: ux0 + 5 * 0.5, y: Y + 0.8, z: zc + 0.02, rotY: Math.PI, collide: 'none' });
    spot('microwave', { room: 'kitchen', at: new THREE.Vector3(ux0 + 5 * 0.5, Y + 0.95, zc), label: 'microwave' });
    B.model('furniture', 'toaster', { x: ux0 + 1 * 0.5, y: Y + 0.8, z: zc + 0.05, rotY: Math.PI, scale: 1.5, collide: 'none' });
    B.model('furniture', 'kitchenCoffeeMachine', { x: ux0 + 3 * 0.5, y: Y + 0.8, z: zc + 0.05, rotY: Math.PI, scale: 1.4, collide: 'none' });
    B.model('furniture', 'radio', { x: ux0 - 0.2, y: Y + 0.8, z: zc + 0.08, rotY: Math.PI, scale: 1.2, collide: 'none' });
    spot('radio', { room: 'kitchen', at: new THREE.Vector3(ux0 - 0.2, Y + 0.95, zc), label: 'kitchen radio' });
    H1('home', 'Kitchen_CabinetSmall', { x: ux0 - 0.22, z: zc, rotY: Math.PI });
    // Fridge in the corner by the garage door.
    const fx = r.max.x - 0.4;
    const fz = r.max.z - 1.4;
    H1('home', 'Kitchen_Fridge', { x: fx, z: fz, rotY: -Math.PI / 2 });
    spot('fridge', { room: 'kitchen', at: new THREE.Vector3(fx, Y + 1.0, fz), faceYaw: -Math.PI / 2, label: 'fridge', stock: 'house' });
    // Dining table + chairs.
    const tx = r.getCenter(new THREE.Vector3()).x - 0.3;
    const tz = r.min.z + 2.2;
    H1('home', 'Table_RoundLarge', { x: tx, z: tz, stretch: [0.8, 1.35, 1.0] });
    for (const [dx, dz, ry] of [[-0.5, 0.75, Math.PI], [0.5, 0.75, Math.PI], [-0.5, -0.75, 0], [0.5, -0.75, 0]]) {
      H1('home', 'Chair_2', { x: tx + dx, z: tz + dz, rotY: ry, collide: 'none' });
      spot('seat', { room: 'kitchen', at: new THREE.Vector3(tx + dx, Y + 0.47, tz + dz), faceYaw: ry, label: 'chair', table: true });
    }
    B.collider(tx, Y + 0.37, tz, 1.5, 0.74, 0.95);
    H1('home', 'Trashcan_Small1', { x: r.min.x + 0.35, z: r.max.z - 0.35, collide: 'box' });
    spot('trash-kitchen', { room: 'kitchen', at: new THREE.Vector3(r.min.x + 0.35, Y + 0.4, r.max.z - 0.35), label: 'trash can' });
    B.model('home', 'Light_Chandelier', { x: tx, y: H, z: tz, collide: 'none' });
    R.kitchen.lightAt = new THREE.Vector3(tx, H - 0.5, tz);
  }

  // ---- Garage ----
  {
    const r = garage.box;
    // Old fridge with the adults' drinks (beer). Kids have to "find" it (master list §0, §7).
    B.model('home', 'Kitchen_Fridge', { x: r.min.x + 0.45, y: gY, z: r.min.z + 0.5, rotY: 0, tint: { White: '#d8d2c4' } });
    spot('fridge', { room: 'garage', at: new THREE.Vector3(r.min.x + 0.45, gY + 1.0, r.min.z + 0.5), faceYaw: 0, label: 'garage fridge', stock: 'garage' });
    B.model('home', 'Bathroom_WashingMachine', { x: r.min.x + 1.4, y: gY, z: r.min.z + 0.4, rotY: 0 });
    spot('washer', { room: 'garage', at: new THREE.Vector3(r.min.x + 1.4, gY + 0.6, r.min.z + 0.4), label: 'washing machine' });
    B.model('home', 'Shelf_1', { x: r.max.x - 0.4, y: gY, z: r.min.z + 0.4, rotY: 0 });
    for (let i = 0; i < 4; i++) B.model('furniture', 'cardboardBoxClosed', { x: r.max.x - 0.4 + (i % 2) * 0.05, y: gY + 0.02 + Math.floor(i / 2) * 0.8, z: r.min.z + 0.4, scale: 1.4, rotY: i, collide: 'none' });
    spot('lemonade-kit', { room: 'garage', at: new THREE.Vector3(r.max.x - 0.4, gY + 0.9, r.min.z + 0.45), label: 'folding table' });
    B.model('home', 'Trashcan_Green', { x: r.max.x - 0.45, y: gY, z: r.max.z - 1.9, rotY: -Math.PI / 2 });
    spot('garbage-bin', { room: 'garage', at: new THREE.Vector3(r.max.x - 0.45, gY + 0.6, r.max.z - 1.9), label: 'garbage bin', movable: true });
    B.model('home', 'Light_CeilingSingle', { x: r.getCenter(new THREE.Vector3()).x, y: H, z: r.getCenter(new THREE.Vector3()).z, collide: 'none' });
    garage.lightAt = r.getCenter(new THREE.Vector3()).setY(H - 0.3);
  }

  // ---------------------------------------------------------------- decor (lived-in details)
  const D = new Decor(world, B);
  const switches = [];
  const sw = (roomId, x, y, z, yaw) => switches.push({ room: R[roomId], ...D.switchPlate(x, y, z, yaw) });
  {
    const L = R.living.box;
    const tvZ = Z(3.2);
    D.picture(L.min.x + 0.01, Y + 1.62, tvZ - 1.45, Math.PI / 2, 0.55, 0.42, 'photo', seed + 1);
    D.picture(L.min.x + 0.01, Y + 1.62, tvZ + 1.45, Math.PI / 2, 0.55, 0.42, 'landscape', seed + 2);
    D.picture(X(4.3), Y + 1.55, L.max.z - 0.01, Math.PI, 0.8, 0.6, rng.pick(['abstract', 'landscape']), seed + 3);
    D.picture(X(4.24), Y + 1.5, L.min.z + 0.01, 0, 0.36, 0.46, 'photo', seed + 4, { frame: 'white' });
    sw('living', X(6.45), Y + 1.2, L.max.z - 0.01, Math.PI);
    D.outlet(L.min.x + 0.01, Y + 0.32, tvZ + 0.5, Math.PI / 2);
    D.outlet(X(4.9), Y + 0.32, L.min.z + 0.01, 0);
    if (wi >= 2 && wi < 4) D.books(X(1.6), L.min.z + 0.24, Y + 0.08, 1.05, 6, 0.315, 0, seed + 5);
  }
  {
    const K = R.kitchen.box;
    const cab = mat('painted-wood', { color: 0x7d8f86, wear: 0.05, dirt: 0.05 });
    const handle = mat('steel', { wear: 0.1 });
    const zc = K.max.z - 0.17;
    const upper = (x0u, x1u) => {
      B.box((x0u + x1u) / 2, Y + 1.8, zc, x1u - x0u, 0.7, 0.33, cab, { collide: false });
      const n = Math.max(1, Math.round((x1u - x0u) / 0.45));
      for (let i = 0; i < n; i++) {
        const cx = x0u + ((i + 0.5) * (x1u - x0u)) / n;
        B.box(cx, Y + 1.8, zc - 0.17, (x1u - x0u) / n - 0.02, 0.66, 0.012, cab, { collide: false, shadow: false });
        B.box(cx + ((x1u - x0u) / n) * 0.35 * (i % 2 ? -1 : 1), Y + 1.56, zc - 0.185, 0.015, 0.1, 0.015, handle, { collide: false, shadow: false });
      }
    };
    const ux0 = X(winKitchen.u) - 1.0;
    upper(ux0 - 0.44, X(winKitchen.u) - winKitchen.w / 2 - 0.05);
    upper(ux0 + 4 * 0.5 + 0.32, ux0 + 5 * 0.5 + 0.26);
    // Range hood over the stove.
    B.box(ux0 + 4 * 0.5, Y + 1.72, K.max.z - 0.23, 0.6, 0.18, 0.46, mat('steel', { wear: 0.1 }), { collide: false });
    B.box(ux0 + 4 * 0.5, Y + 2.1, K.max.z - 0.12, 0.26, 0.6, 0.22, mat('steel', { wear: 0.1 }), { collide: false });
    // Tile backsplash between the counter and the uppers / window.
    const tile = mat('tile-bathroom', { color: 0xf2efe7, count: 8, dirt: 0.1 });
    B.box((ux0 - 0.44 + ux0 + 5 * 0.5 + 0.26) / 2, Y + 0.97, K.max.z - 0.006, ux0 + 5 * 0.5 + 0.26 - (ux0 - 0.44), 0.14, 0.01, tile, { collide: false, shadow: false });
    B.box((ux0 - 0.44 + X(winKitchen.u) - winKitchen.w / 2) / 2, Y + 1.25, K.max.z - 0.006, X(winKitchen.u) - winKitchen.w / 2 - (ux0 - 0.44), 0.42, 0.01, tile, { collide: false, shadow: false });
    B.box((X(winKitchen.u) + winKitchen.w / 2 + ux0 + 5 * 0.5 + 0.26) / 2, Y + 1.25, K.max.z - 0.006, ux0 + 5 * 0.5 + 0.26 - (X(winKitchen.u) + winKitchen.w / 2), 0.42, 0.01, tile, { collide: false, shadow: false });
    clockSpot = { x: X(7) + 0.07, y: Y + 1.9, z: Z(1.1), yaw: Math.PI / 2 };
    sw('kitchen', K.max.x - 0.01, Y + 1.2, Z(3.2) + 0.65, -Math.PI / 2);
    D.picture(X(7) + 0.07, Y + 1.45, Z(1.1), Math.PI / 2, 0.3, 0.38, 'photo', seed + 7, { frame: 'white' });
    D.outlet(K.max.x - 0.01, Y + 1.1, Z(2.2), -Math.PI / 2);
  }
  {
    const Kd = R.kid.box;
    const kinds = kidSex === 'f' ? ['poster-unicorn', 'poster-space', 'poster-game'] : ['poster-game', 'poster-dino', 'poster-space'];
    D.picture(Kd.max.x - 0.01, Y + 1.8, Kd.min.z + 1.35, -Math.PI / 2, 0.6, 0.45, kinds[0], seed + 11, { frame: 'none' });
    D.picture(X(1.5), Y + 1.55, Kd.max.z - 0.01, Math.PI, 0.55, 0.42, kinds[1], seed + 12, { frame: 'none' });
    D.picture(Kd.max.x - 0.01, Y + 1.55, Kd.max.z - 0.75, -Math.PI / 2, 0.42, 0.56, kinds[2], seed + 13, { frame: 'none' });
    sw('kid', X(2.95), Y + 1.2, Kd.max.z - 0.01, Math.PI);
    D.outlet(X(3.4), Y + 0.32, Kd.min.z + 0.01, 0);
  }
  sw('bath', X(4.45), Y + 1.2, R.bath.box.max.z - 0.01, Math.PI);
  sw('room2', X(7.8), Y + 1.2, R.room2.box.max.z - 0.01, Math.PI);
  {
    const M = R.master.box;
    D.picture(M.getCenter(new THREE.Vector3()).x, Y + 1.6, M.min.z + 0.01, 0, 0.9, 0.55, 'landscape', seed + 21);
    sw('master', X(10.6), Y + 1.2, M.max.z - 0.01, Math.PI);
  }
  sw('garage', X(12.9) + 0.11, Y + 1.0, Z(3.2) + 0.65, Math.PI / 2);
  ceiling.emissive = new THREE.Color(0xfff2e2);
  ceiling.emissiveIntensity = 0;

  // ---------------------------------------------------------------- outdoor bits
  const driveway = { x0: X(13.4), x1: X(18.6), z0: Z(0), z1: null };
  const walkway = { x: X(doorFront.u), z0: Z(-2.4) };

  return {
    rooms,
    roomById: R,
    spots,
    doors,
    windows,
    sneakWindow,
    garageDoor: { cx: X(15.9), cz: Z(0.1), w: 4.8, h: 2.3, y: gY },
    driveway,
    walkway,
    floorY: Y,
    garageY: gY,
    bounds: new THREE.Box3(new THREE.Vector3(X(-0.5), -1, Z(11.5)), new THREE.Vector3(X(19.5), H + 3, Z(-2.6))),
    spawn: {
      bed: new THREE.Vector3(R.kid.box.min.x + 1.6, Y, R.kid.box.min.z + 1.2),
      frontDoor: new THREE.Vector3(X(doorFront.u), Y, Z(-1.2)),
      living: R.living.box.getCenter(new THREE.Vector3()).setY(Y),
    },
    paints: P,
    switches,
    clockSpot,
    ceilingMat: ceiling,
  };
}

/** Gable roof with the ridge running along x. */
function gableRoof(world, B, { x0, x1, zFront, zBack, y, rise, mat, gable, fascia, skipLeftGable = false, skipRightGable = false }) {
  const depth = zFront - zBack; // zFront > zBack (front faces +z)
  const half = depth / 2;
  const zr = zBack + half;
  const slope = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  for (const side of [1, -1]) {
    const g = new THREE.BoxGeometry(len, 0.08, slope + 0.05);
    const m = new THREE.Mesh(g, mat);
    m.position.set(cx, y + rise / 2, zr + (side * half) / 2);
    m.rotation.x = side * ang;
    B.mesh(m);
    // Fascia board along the eave.
    const fz = zr + side * (half + 0.02);
    B.box(cx, y - 0.06, fz, len + 0.04, 0.18, 0.04, fascia, { collide: false });
  }
  // Gable triangles (both ends, both faces).
  for (const [gx, skip] of [[x0 + 0.42, skipLeftGable], [x1 - 0.42, skipRightGable]]) {
    if (skip) continue;
    const shape = new THREE.Shape();
    shape.moveTo(-half + 0.4, 0);
    shape.lineTo(half - 0.4, 0);
    shape.lineTo(0, rise - 0.12);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    const m = new THREE.Mesh(g, gable);
    m.rotation.y = Math.PI / 2;
    m.position.set(gx - 0.09, y, zr);
    B.mesh(m);
  }
}

/**
 * A neighbour's house seen from outside: ranch or two-storey, siding, shingle roof, windows with
 * blinds (lit at night when someone's home and awake), porch, garage left/right. Not enterable
 * yet (knocking works: someone answers if they're home).
 * Returns { door: {x, z, y}, windows: Mesh, bounds }.
 */
export function buildShell(world, B, { x0, zf, width = 13, depth = 10, stories = 1, garage = 'right', seed = 1, facing = 1 }) {
  const rng = new Rng(seed);
  // facing 1: front towards +z (north side of the street). facing -1: front towards -z.
  const Z = (w) => zf - facing * w;
  const X = (u) => x0 + u;
  const sidingMat = mat('siding', { color: rng.pick(SIDING), dirt: rng.range(0.1, 0.35) });
  const brickFront = stories === 2 && rng.chance(0.45);
  const brick = mat('brick', { color: rng.pick([0x8c3b2a, 0x9a5a44, 0x7a4636, 0xa7765c]), dirt: 0.25 });
  const trim = mat('paint', { color: 0xf6f3ec });
  const roofMat = mat('shingles', { color: rng.pick([0x4a4a4c, 0x5a4a3e, 0x3e4650, 0x6a6258, 0x343434]), dirt: 0.3 });
  const foundation = mat('concrete', { wear: 0.3, dirt: 0.4 });
  const Y = FLOOR_Y;
  const wallH = Y + CEIL + (stories === 2 ? CEIL + 0.3 : 0);
  const gW = garage === 'none' ? 0 : 6;
  const gu0 = garage === 'left' ? 0 : width;
  const hu0 = garage === 'left' ? gW : 0;
  const total = width + gW;
  const w0 = 0.1;
  // Shell box walls (interior faces never seen: use trim colour, it's cheap).
  const inner = trim;
  const front = brickFront ? brick : sidingMat;
  const doorU = hu0 + (garage === 'left' ? width * 0.35 : width * 0.62);
  const winH = 1.35;
  const wins = [];
  const frontOpen = [{ at: doorU - hu0, w: 0.95, h: 2.05, sill: Y }];
  // Ground-floor windows either side of the door.
  for (const du of [-2.3, 2.2, -4.6]) {
    const u = doorU + du;
    if (u - hu0 > 0.9 && u - hu0 < width - 0.9) frontOpen.push({ at: u - hu0, w: 1.4, h: winH, sill: Y + 0.8 });
  }
  const flip = facing === 1 ? 0 : Math.PI;
  // Walls: front, back, sides of the main block.
  const fz = Z(w0);
  const bz = Z(depth - w0);
  const mA = facing === 1 ? front : inner;
  const mB = facing === 1 ? inner : front;
  B.wall(X(hu0), fz, X(hu0 + width), fz, { y: 0, h: wallH, t: 0.2, matA: mA, matB: mB, matEdge: trim, openings: frontOpen });
  const backOpen = [{ at: width * 0.3, w: 1.2, h: winH, sill: Y + 0.85 }, { at: width * 0.72, w: 1.2, h: winH, sill: Y + 0.85 }];
  B.wall(X(hu0), bz, X(hu0 + width), bz, { y: 0, h: wallH, t: 0.2, matA: facing === 1 ? inner : sidingMat, matB: facing === 1 ? sidingMat : inner, matEdge: trim, openings: backOpen });
  for (const u of [hu0, hu0 + width]) {
    const left = u === hu0;
    // A wall along z: matA is the +x side.
    const zA = Z(0);
    const zB = Z(depth);
    const sideOpen = (garage === 'left' && left) || (garage === 'right' && !left) ? [] : [{ at: depth * 0.5, w: 1.1, h: winH, sill: Y + 0.85 }];
    // matA is the +x side when the wall runs towards -z (facing 1), the -x side otherwise.
    const aOut = facing === 1 ? !left : left;
    B.wall(X(u), zA, X(u), zB, { y: 0, h: wallH, t: 0.2, matA: aOut ? sidingMat : inner, matB: aOut ? inner : sidingMat, matEdge: trim, openings: sideOpen });
    for (const o of sideOpen) wins.push({ x: X(u), y: o.sill + o.h / 2, z: (zA + zB) / 2, w: o.w, h: o.h, rotY: Math.PI / 2, n: [left ? -1 : 1, 0] });
  }
  for (const o of frontOpen.slice(1)) wins.push({ x: X(hu0 + o.at), y: o.sill + o.h / 2, z: fz, w: o.w, h: o.h, rotY: flip, n: [0, facing], front: true });
  for (const o of backOpen) wins.push({ x: X(hu0 + o.at), y: o.sill + o.h / 2, z: bz, w: o.w, h: o.h, rotY: flip, n: [0, -facing] });
  if (stories === 2) {
    for (const u of [width * 0.2, width * 0.5, width * 0.8]) {
      wins.push({ x: X(hu0 + u), y: Y + CEIL + 0.3 + 0.85 + winH / 2, z: fz, w: 1.2, h: winH, rotY: flip, upper: true, n: [0, facing], front: true });
      wins.push({ x: X(hu0 + u), y: Y + CEIL + 0.3 + 0.85 + winH / 2, z: bz, w: 1.1, h: winH, rotY: flip, upper: true, n: [0, -facing] });
    }
    // Band between floors.
    B.box(X(hu0 + width / 2), Y + CEIL + 0.15, fz + facing * 0.11, width + 0.1, 0.18, 0.04, trim, { collide: false });
  }
  // Floor slab so the house reads solid through the door glass; fills the footprint.
  B.slab(X(hu0), Z(0.2), X(hu0 + width), Z(depth - 0.2), Y, foundation, { thick: 0.3, collide: true });
  // Foundation strip.
  B.box(X(hu0 + width / 2), 0.15, fz + facing * 0.12, width + 0.1, 0.3, 0.06, foundation, { collide: false });

  // Garage block.
  if (gW) {
    const gx0 = X(gu0);
    const gx1 = X(gu0 + gW);
    const gd = Math.min(depth, 7);
    const gfz = Z(w0);
    const gbz = Z(gd - w0);
    const gOpen = [{ at: gW / 2, w: 4.8, h: 2.3, sill: 0.14 }];
    B.wall(gx0, gfz, gx1, gfz, { y: 0, h: Y + CEIL, t: 0.2, matA: facing === 1 ? sidingMat : inner, matB: facing === 1 ? inner : sidingMat, matEdge: trim, openings: gOpen });
    B.wall(gx0, gbz, gx1, gbz, { y: 0, h: Y + CEIL, t: 0.2, matA: facing === 1 ? inner : sidingMat, matB: facing === 1 ? sidingMat : inner, matEdge: trim });
    const ox = garage === 'left' ? gx0 : gx1;
    const gOut = facing === 1 ? garage !== 'left' : garage === 'left';
    B.wall(ox, Z(0), ox, Z(gd), { y: 0, h: Y + CEIL, t: 0.2, matA: gOut ? sidingMat : inner, matB: gOut ? inner : sidingMat, matEdge: trim });
    // Closed garage door (panelled).
    const gdMat = mat('siding', { color: 0xf0ede6, dirt: 0.15 });
    B.box((gx0 + gx1) / 2, 0.14 + 1.15, gfz + facing * 0.02, 4.8, 2.3, 0.06, gdMat);
    for (let i = 1; i < 4; i++) B.box((gx0 + gx1) / 2, 0.14 + i * 0.575, gfz + facing * 0.06, 4.8, 0.03, 0.02, trim, { collide: false });
    gableRoof(world, B, { x0: gx0 - (garage === 'left' ? 0.4 : 0), x1: gx1 + (garage === 'left' ? 0 : 0.4), zFront: Math.max(Z(-0.45), Z(gd + 0.45)), zBack: Math.min(Z(-0.45), Z(gd + 0.45)), y: Y + CEIL + 0.02, rise: 1.4, mat: roofMat, gable: sidingMat, fascia: trim, skipLeftGable: garage === 'right', skipRightGable: garage === 'left' });
    B.slab(gx0, Z(0.2), gx1, Z(gd - 0.2), 0.14, foundation, { thick: 0.1 });
  }
  // Main roof.
  gableRoof(world, B, { x0: X(hu0 - 0.4), x1: X(hu0 + width + 0.4), zFront: Math.max(Z(-0.45), Z(depth + 0.45)), zBack: Math.min(Z(-0.45), Z(depth + 0.45)), y: wallH + 0.02, rise: stories === 2 ? 2.3 : 2.0, mat: roofMat, gable: sidingMat, fascia: trim });

  // Front door + porch.
  const doorMat = mat('painted-wood', { color: rng.pick([0x6b2d2a, 0x2d3e5c, 0x1f3b2e, 0x2b2b2b, 0x8a6a3a]), wear: 0.1, dirt: 0.1 });
  B.box(X(doorU), Y + 1.02, fz, 0.95, 2.05, 0.06, doorMat);
  B.box(X(doorU), Y / 2, fz + facing * 0.9, 2.2, Y, 1.6, foundation);
  B.box(X(doorU), Y * 0.33, fz + facing * 1.85, 1.4, Y * 0.66, 0.3, foundation);
  B.box(X(doorU), Y * 0.165, fz + facing * 2.15, 1.4, Y * 0.33, 0.3, foundation);

  // Window frames + one window mesh per house (glass with blinds, swaps to lit at night).
  const geos = [];
  for (const w of wins) {
    const dir = new THREE.Vector3(Math.cos(w.rotY), 0, -Math.sin(w.rotY));
    const put = (along, yy, sw, sh) => B.box(w.x + dir.x * along, yy, w.z + dir.z * along, sw, sh, 0.24, trim, { rotY: w.rotY, collide: false });
    put(0, w.y - w.h / 2 + 0.03, w.w, 0.06);
    put(0, w.y + w.h / 2 - 0.03, w.w, 0.06);
    put(-w.w / 2 + 0.03, w.y, 0.06, w.h);
    put(w.w / 2 - 0.03, w.y, 0.06, w.h);
    put(0, w.y, w.w, 0.035);
    // Shutters on front windows look very Midwest.
    if (w.front && !w.upper) {
      for (const s of [-1, 1]) B.box(w.x + dir.x * s * (w.w / 2 + 0.25), w.y, w.z + facing * 0.12, 0.42, w.h, 0.04, mat('painted-wood', { color: 0x2d3a33, wear: 0.1, dirt: 0.1 }), { rotY: w.rotY, collide: false });
    }
    const g = new THREE.PlaneGeometry(w.w - 0.12, w.h - 0.12);
    g.rotateY(Math.atan2(w.n[0], w.n[1]));
    g.translate(w.x + w.n[0] * 0.03, w.y, w.z + w.n[1] * 0.03);
    geos.push(g);
  }
  const winMesh = new THREE.Mesh(mergeGeos(geos), WINDOW_MATS.day);
  winMesh.receiveShadow = false;
  world.scene.add(winMesh);
  return {
    door: new THREE.Vector3(X(doorU), Y, fz + facing * 1.2),
    doorFront: new THREE.Vector3(X(doorU), Y, fz),
    windows: winMesh,
    garageX: gW ? X(gu0 + gW / 2) : null,
    bounds: new THREE.Box3(new THREE.Vector3(Math.min(X(0), X(total)) - 0.5, -1, Math.min(Z(-0.5), Z(depth + 0.5))), new THREE.Vector3(Math.max(X(0), X(total)) + 0.5, wallH + 3, Math.max(Z(-0.5), Z(depth + 0.5)))),
  };
}


/** Window glass seen from outside: dark glass + half-drawn blinds, or warm lit at night. */
export const WINDOW_MATS = (() => {
  const blinds = (lit) =>
    canvasTexture(`win-blinds-${lit ? 1 : 0}`, 64, 128, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      if (lit) {
        g.addColorStop(0, '#ffdca0');
        g.addColorStop(1, '#f2b866');
      } else {
        g.addColorStop(0, '#2a3138');
        g.addColorStop(1, '#151a1f');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Blinds on the top 40%.
      ctx.fillStyle = lit ? '#fff1d6' : '#c9c2b4';
      for (let y = 0; y < h * 0.4; y += 5) ctx.fillRect(0, y, w, 3.5);
    });
  const day = new THREE.MeshStandardMaterial({ map: blinds(false), roughness: 0.08, metalness: 0.3, envMapIntensity: 1.4 });
  const night = new THREE.MeshStandardMaterial({ map: blinds(true), emissiveMap: blinds(true), emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.2, metalness: 0 });
  return { day, night };
})();
