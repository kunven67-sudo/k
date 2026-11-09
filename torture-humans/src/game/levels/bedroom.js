// Your bedroom, right above the lab. The lab hatch comes up through its floor.
import * as THREE from 'three';
import { pbr, box, plane, place } from '../engine/assets.js';

export const BEDROOM = { x0: 2.5, x1: 7.0, z0: -5.0, z1: 0.0, floorY: 3.3, h: 2.6 };
// the hollow at the bottom of the north wall (behind the bed) where tiny people live
export const VILLAGE = { x0: 2.6, x1: 4.3, h: 0.35, hole: 4.1, z0: -5.138, z1: -5.012 };

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// wall along X (at z) or along Z (at x) with an optional rectangular opening
function wallWithOpening(parent, mat, { axis, at, from, to, y0, h, t = 0.15, open = null }) {
  const seg = (a0, a1, b0, b1) => {
    if (a1 - a0 < 0.001 || b1 - b0 < 0.001) return;
    const len = a1 - a0;
    const hh = b1 - b0;
    const c = (a0 + a1) / 2;
    if (axis === 'x') mesh(box(len, hh, t), mat, c, (b0 + b1) / 2, at, parent);
    else mesh(box(t, hh, len), mat, at, (b0 + b1) / 2, c, parent);
  };
  if (!open) { seg(from, to, y0, y0 + h); return; }
  seg(from, open.a0, y0, y0 + h);
  seg(open.a1, to, y0, y0 + h);
  seg(open.a0, open.a1, y0, y0 + open.b0);
  seg(open.a0, open.a1, y0 + open.b1, y0 + h);
}

export async function buildBedroom({ statics, props, scene, hatch }) {
  const { x0, x1, z0, z1, floorY: fy, h } = BEDROOM;
  const room = new THREE.Group();
  room.name = 'bedroom';
  statics.add(room);

  // floor with the hatch hole (4 pieces around it)
  const wood = pbr('old_wooden_floor_02', { size: 2 });
  const hx0 = hatch.x - hatch.w / 2, hx1 = hatch.x + hatch.w / 2, hz0 = hatch.z - hatch.d / 2, hz1 = hatch.z + hatch.d / 2;
  const piece = (a0, a1, b0, b1) => {
    if (a1 - a0 < 0.001 || b1 - b0 < 0.001) return;
    const m = new THREE.Mesh(plane(a1 - a0, b1 - b0), wood);
    m.position.set((a0 + a1) / 2, fy + 0.001, (b0 + b1) / 2);
    m.receiveShadow = true;
    room.add(m);
  };
  piece(x0, hx0, z0, z1);
  piece(hx1, x1, z0, z1);
  piece(hx0, hx1, z0, hz0);
  piece(hx0, hx1, hz1, z1);
  // hatch rim (a real wooden frame so the hole edge doesn't look cut out)
  const rim = pbr('fine_grained_wood', { size: 0.8 });
  mesh(box(hatch.w + 0.1, 0.04, 0.05), rim, hatch.x, fy + 0.02, hz0 - 0.025, room);
  mesh(box(hatch.w + 0.1, 0.04, 0.05), rim, hatch.x, fy + 0.02, hz1 + 0.025, room);
  mesh(box(0.05, 0.04, hatch.d), rim, hx0 - 0.025, fy + 0.02, hatch.z, room);
  mesh(box(0.05, 0.04, hatch.d), rim, hx1 + 0.025, fy + 0.02, hatch.z, room);

  // walls: window on the east wall, door opening on the south wall
  const wallMat = pbr('painted_plaster_wall', { size: 2, color: 0xd9cfbf });
  // north wall: hollow at the bottom behind the bed, where the wall village is (village.js)
  const V = VILLAGE;
  wallWithOpening(room, wallMat, { axis: 'x', at: z0 - 0.075, from: x0 - 0.15, to: V.x0, y0: fy, h });
  wallWithOpening(room, wallMat, { axis: 'x', at: z0 - 0.075, from: V.x1, to: x1 + 0.15, y0: fy, h });
  wallWithOpening(room, wallMat, { axis: 'x', at: z0 - 0.075, from: V.x0, to: V.x1, y0: fy + V.h, h: h - V.h });
  // the inner skin (plaster, 1.2 cm) with the mouse hole in the baseboard, and the back of the cavity
  wallWithOpening(room, wallMat, { axis: 'x', at: z0 - 0.006, from: V.x0, to: V.x1, y0: fy, h: V.h, t: 0.012, open: { a0: V.hole - 0.02, a1: V.hole + 0.02, b0: 0, b1: 0.045 } });
  wallWithOpening(room, pbr('fine_grained_wood', { size: 0.5, color: 0x8a6a48 }), { axis: 'x', at: z0 - 0.144, from: V.x0, to: V.x1, y0: fy, h: V.h, t: 0.012 });
  // cavity floor (the sill plate) and ceiling (a beam)
  const plate = pbr('fine_grained_wood', { size: 0.4, color: 0xb08a5e });
  mesh(box(V.x1 - V.x0, 0.01, 0.15), plate, (V.x0 + V.x1) / 2, fy - 0.004, z0 - 0.075, room);
  mesh(box(V.x1 - V.x0, 0.02, 0.15), plate, (V.x0 + V.x1) / 2, fy + V.h + 0.01, z0 - 0.075, room);
  // baseboard along the wall, arched hole and all
  const base = pbr('fine_grained_wood', { size: 1, color: 0xf1ece2 });
  for (const [a, b] of [[x0, V.hole - 0.02], [V.hole + 0.02, x1]]) mesh(box(b - a, 0.08, 0.015), base, (a + b) / 2, fy + 0.04, z0 + 0.0075, room);
  mesh(box(0.04, 0.035, 0.015), base, V.hole, fy + 0.0625, z0 + 0.0075, room);
  wallWithOpening(room, wallMat, { axis: 'x', at: z1 + 0.075, from: x0 - 0.15, to: x1 + 0.15, y0: fy, h, open: { a0: 3.0, a1: 3.9, b0: 0, b1: 2.05 } });
  // west wall: doorway to the living room (z -1.6..-0.7)
  wallWithOpening(room, wallMat, { axis: 'z', at: x0 - 0.075, from: z0, to: z1, y0: fy, h, open: { a0: -1.6, a1: -0.7, b0: 0, b1: 2.05 } });
  wallWithOpening(room, wallMat, { axis: 'z', at: x1 + 0.075, from: z0, to: z1, y0: fy, h, open: { a0: -3.3, a1: -1.9, b0: 0.9, b1: 2.1 } });
  // window glass + daylight coming in
  const pane = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.004, ior: 1.52, transparent: true });
  const win = mesh(new THREE.BoxGeometry(0.01, 1.2, 1.4), pane, x1 + 0.075, fy + 1.5, -2.6, room);
  win.castShadow = false;
  // (daylight through the window now comes from the real sun outside)
  // ceiling
  mesh(box(x1 - x0 + 0.3, 0.15, z1 - z0 + 0.3), pbr('plastered_wall_02', { size: 2, color: 0xeeeae2 }), (x0 + x1) / 2, fy + h + 0.075, (z0 + z1) / 2, room);
  const lamp = new THREE.PointLight(0xffe2b8, 5, 8, 2);
  lamp.position.set((x0 + x1) / 2, fy + h - 0.3, (z0 + z1) / 2);
  scene.add(lamp);
  await place(props, 'modern_ceiling_lamp_01', { x: (x0 + x1) / 2, y: fy + h - 0.35, z: (z0 + z1) / 2, height: 0.35 });

  // furniture
  await place(props, 'old_bed_frame', { x: 3.6, y: fy, z: -3.9, rotY: 0, width: 2.1 });
  await place(props, 'side_table_01', { x: 2.85, y: fy, z: -2.6, height: 0.55 });
  await place(props, 'alarm_clock_01', { x: 2.85, y: fy + 0.55, z: -2.6, width: 0.12 });
  await place(props, 'wooden_bookshelf_worn', { x: 5.6, y: fy, z: -4.75, rotY: 0, height: 1.9 });
  await place(props, 'WoodenTable_01', { x: 6.3, y: fy, z: -0.8, rotY: -Math.PI / 2, width: 1.3 });
  await place(props, 'television_02', { x: 6.6, y: fy + 0.76, z: -0.8, rotY: -Math.PI / 2, width: 0.7 });
  await place(props, 'gamepad', { x: 6.2, y: fy + 0.76, z: -0.5, width: 0.16 });
  await place(props, 'WoodenChair_01', { x: 5.6, y: fy, z: -0.8, rotY: Math.PI / 2, height: 0.9 });
  await place(props, 'drawer_cabinet', { x: 4.6, y: fy, z: -4.7, height: 0.9 });
  await place(props, 'potted_plant_01', { x: 6.6, y: fy, z: -4.6, height: 0.8 });
  return room;
}
