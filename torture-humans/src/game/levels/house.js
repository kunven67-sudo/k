// The rest of your house, west of your bedroom: living room (sofa, TV) and
// kitchen (stove, counter, dining table), plus the door to Mom and Dad's room.
// Mom and Dad live here (family.js); the spots below are where they do things.
import * as THREE from 'three';
import { pbr, box, plane, place } from '../engine/assets.js';
import { BEDROOM } from './bedroom.js';

export const HOUSE = { x0: -4.0, x1: BEDROOM.x1, z0: BEDROOM.z0, z1: BEDROOM.z1, floorY: BEDROOM.floorY, h: BEDROOM.h };
export const LIVING = { x0: HOUSE.x0, x1: BEDROOM.x0 - 0.15, z0: HOUSE.z0, z1: HOUSE.z1 };
// the doorway between your bedroom and the living room (in the bedroom's west wall)
export const INNER_DOOR = { z0: -1.6, z1: -0.7 };
// the living room's front window (south wall)
export const FRONT_WINDOW = { x0: -2.6, x1: -1.0, y0: 0.9, y1: 2.1 };

export const inHouse = (p) => p.y > 3.1 && p.y < HOUSE.floorY + HOUSE.h + 0.2 && p.x > HOUSE.x0 - 0.2 && p.x < HOUSE.x1 + 0.2 && p.z > HOUSE.z0 - 0.2 && p.z < HOUSE.z1 + 0.2;

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export async function buildLivingRoom({ statics, props, scene }) {
  const { x0, x1, z0, z1 } = LIVING;
  const fy = HOUSE.floorY, h = HOUSE.h;
  const room = new THREE.Group();
  room.name = 'living-room';
  statics.add(room);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  // floor: wood in the living room, tiles in the kitchen (west third)
  const kx = -1.6;
  const wood = pbr('old_wooden_floor_02', { size: 2 });
  const tiles = pbr('concrete_pavement', { size: 0.6, color: 0xe8e2d8 });
  const f1 = mesh(plane(x1 - kx, z1 - z0), wood, (kx + x1) / 2, fy + 0.001, cz, room);
  const f2 = mesh(plane(kx - x0, z1 - z0), tiles, (x0 + kx) / 2, fy + 0.001, cz, room);
  f1.castShadow = f2.castShadow = false;
  // a solid slab under it (the basement is below)
  mesh(box(x1 - x0 + 0.3, 0.12, z1 - z0 + 0.3), tiles, cx, fy - 0.06, cz, room).visible = false;

  // walls (the east one is your bedroom's west wall, with the doorway)
  const wallMat = pbr('painted_plaster_wall', { size: 2, color: 0xe3d6c0 });
  const t = 0.15;
  mesh(box(x1 - x0 + 0.3, h, t), wallMat, cx, fy + h / 2, z0 - t / 2, room);          // north
  mesh(box(t, h, z1 - z0), wallMat, x0 - t / 2, fy + h / 2, cz, room);                 // west
  // south wall with the front window
  const W = FRONT_WINDOW;
  const sz = z1 + t / 2;
  mesh(box(W.x0 - x0 + 0.15, h, t), wallMat, (x0 - 0.15 + W.x0) / 2, fy + h / 2, sz, room);
  mesh(box(x1 - W.x1, h, t), wallMat, (W.x1 + x1) / 2, fy + h / 2, sz, room);
  mesh(box(W.x1 - W.x0, W.y0, t), wallMat, (W.x0 + W.x1) / 2, fy + W.y0 / 2, sz, room);
  mesh(box(W.x1 - W.x0, h - W.y1, t), wallMat, (W.x0 + W.x1) / 2, fy + (W.y1 + h) / 2, sz, room);
  const pane = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.004, ior: 1.52, transparent: true });
  const win = mesh(new THREE.BoxGeometry(W.x1 - W.x0, W.y1 - W.y0, 0.01), pane, (W.x0 + W.x1) / 2, fy + (W.y0 + W.y1) / 2, z1 + 0.075, room);
  win.castShadow = false;
  // ceiling
  mesh(box(x1 - x0 + 0.3, 0.15, z1 - z0 + 0.3), pbr('plastered_wall_02', { size: 2, color: 0xeeeae2 }), cx, fy + h + 0.075, cz, room);

  // Mom and Dad's bedroom door (closed) on the west wall
  const doorMat = pbr('fine_grained_wood', { size: 1, color: 0x9b7653 });
  const parentsDoor = new THREE.Vector3(x0 + 0.05, fy, -1.2);
  mesh(box(0.05, 2.05, 0.9), doorMat, parentsDoor.x, fy + 1.025, parentsDoor.z, room);
  const knob = mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc9b37a, metalness: 1, roughness: 0.3 }), parentsDoor.x + 0.05, fy + 1.0, parentsDoor.z + 0.33, room);
  knob.castShadow = false;

  // lights: one in the living room, one over the kitchen
  for (const [lx, lz] of [[0.4, -2.5], [-2.8, -2.6]]) {
    const lamp = new THREE.PointLight(0xffe2b8, 4, 7, 2);
    lamp.position.set(lx, fy + h - 0.3, lz);
    lamp.userData.minor = lx < 0; // the kitchen one is off on Low graphics
    scene.add(lamp);
    room.userData.lamps = [...(room.userData.lamps || []), lamp];
    await place(props, 'modern_ceiling_lamp_01', { x: lx, y: fy + h - 0.35, z: lz, height: 0.35 });
  }

  // living room: sofa facing the TV, armchair, plant, clock
  await place(props, 'sofa_02', { x: 0.4, y: fy, z: -4.45, rotY: 0, width: 2.0 });
  await place(props, 'modern_wooden_cabinet', { x: 0.4, y: fy, z: -0.35, rotY: Math.PI, width: 1.4 });
  const tvTop = fy + 0.6;
  await place(props, 'Television_01', { x: 0.4, y: tvTop, z: -0.35, rotY: Math.PI, width: 0.9 });
  await place(props, 'ArmChair_01', { x: 1.75, y: fy, z: -2.6, rotY: -Math.PI / 2, height: 0.95 });
  await place(props, 'potted_plant_02', { x: 1.9, y: fy, z: -4.6, height: 1.1 });
  await place(props, 'wall_clock', { x: 0.4, y: fy + 1.9, z: z0 + 0.04, height: 0.35 });
  await place(props, 'boombox', { x: -0.7, y: fy, z: -0.4, rotY: Math.PI, width: 0.45 });
  // kitchen: stove and counter along the north wall, dining table
  await place(props, 'electric_stove', { x: -3.55, y: fy, z: -4.6, rotY: 0, height: 0.92 });
  await place(props, 'drawer_cabinet', { x: -2.6, y: fy, z: -4.65, height: 0.9 });
  await place(props, 'WoodenTable_01', { x: -2.7, y: fy, z: -2.3, rotY: 0, width: 1.3 });
  await place(props, 'dining_chair_02', { x: -3.4, y: fy, z: -2.3, rotY: Math.PI / 2, height: 0.95 });
  await place(props, 'dining_chair_02', { x: -2.0, y: fy, z: -2.3, rotY: -Math.PI / 2, height: 0.95 });
  await place(props, 'trashbag', { x: -1.9, y: fy, z: -4.6, height: 0.6 }).then((m) => { m.name = 'kitchen-trash'; m.userData.noCollide = true; });

  // where Mom and Dad do things (face = the way they look when they're there)
  const spot = (x, z, act, fx = 0, fz = 1) => ({ p: new THREE.Vector3(x, fy, z), act, face: new THREE.Vector3(fx, 0, fz) });
  const spots = {
    stove: spot(-3.55, -3.95, 'cook', 0, -1),
    counter: spot(-2.6, -4.0, 'cook', 0, -1),
    table: spot(-2.7, -1.6, 'eat', 0, -1),
    tv: spot(0.4, -3.5, 'tv', 0, 1),
    window: spot(-1.8, -0.5, 'look', 0, 1),
    armchair: spot(1.2, -2.6, 'tv', -1, 0),
    parentsDoor: { p: new THREE.Vector3(x0 + 0.5, fy, parentsDoor.z), act: 'door', face: new THREE.Vector3(-1, 0, 0) },
    frontDoor: { p: new THREE.Vector3(3.45, fy, 0.9), act: 'leave', face: new THREE.Vector3(0, 0, 1) },
  };
  return { room, spots, lamps: room.userData.lamps };
}
