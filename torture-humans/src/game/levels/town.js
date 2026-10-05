// The town around your house: one street with shops across from you, neighbors'
// houses on your side, sidewalks, lamps, trees, and a fence around the edge.
// Built for weak graphics cards: buildings are simple solid shapes with scanned
// facade textures, and all windows in town are 2 instanced draws (frames + glass).
import * as THREE from 'three';
import { pbr as pbrNew, box, plane, place } from '../engine/assets.js';

const matCache = new Map();
const pbr = (id, opts = {}) => {
  const key = `${id}|${JSON.stringify(opts)}`;
  if (!matCache.has(key)) matCache.set(key, pbrNew(id, opts));
  return matCache.get(key);
};
import { BEDROOM } from './bedroom.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Glue every town piece that shares a material into one mesh: a few hundred
// small boxes become a few dozen draws (that's what weak graphics cards need).
function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) return;
    const key = `${o.material.uuid}|${o.castShadow}|${!!o.userData.noCollide}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((o) => {
      let g = o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'uv1'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv1 && g.attributes.uv) g.setAttribute('uv1', g.attributes.uv.clone());
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const first = list[0];
    const m = new THREE.Mesh(merged, first.material);
    m.castShadow = first.castShadow;
    m.receiveShadow = true;
    m.userData.noCollide = !!first.userData.noCollide;
    m.name = 'town-merged';
    for (const o of list) o.removeFromParent();
    root.add(m);
    for (const g of geos) g.dispose();
  }
  // empty groups left behind
  for (const c of [...root.children]) if (c.isGroup && !c.children.length) c.removeFromParent();
}

export const GROUND_Y = 3.28;           // yard / sidewalk height (the bedroom floor is 3.30)
export const ROAD = { z0: 9, z1: 16, y: 3.13 };
export const TOWN = { x0: -46, x1: 46, z0: -26, z1: 34 };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);

function mesh(geo, mat, x, y, z, parent, { shadow = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// A ground rectangle from (x0, z0) to (x1, z1) at height y, UVs in meters
function ground(parent, mat, x0, x1, z0, z1, y) {
  if (x1 - x0 < 0.01 || z1 - z0 < 0.01) return null;
  const m = new THREE.Mesh(plane(x1 - x0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Gable roof over a w x d rectangle (ridge along X), with overhang; UVs in meters.
function gableRoof(w, d, rise, overhang = 0.35) {
  const hw = w / 2 + overhang, hd = d / 2 + overhang;
  const slope = Math.hypot(hd, rise);
  const pos = [], uv = [], idx = [];
  const quad = (a, b, c, e, ua) => {
    const n = pos.length / 3;
    pos.push(...a, ...b, ...c, ...e);
    uv.push(...ua);
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  };
  // the two slopes (front: +z, back: -z)
  quad([-hw, 0, hd], [hw, 0, hd], [hw, rise, 0], [-hw, rise, 0], [0, 0, w + overhang * 2, 0, w + overhang * 2, slope, 0, slope]);
  quad([hw, 0, -hd], [-hw, 0, -hd], [-hw, rise, 0], [hw, rise, 0], [0, 0, w + overhang * 2, 0, w + overhang * 2, slope, 0, slope]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the triangles that close the roof ends (wall material)
function gableEnds(w, d, rise) {
  const hw = w / 2, hd = d / 2;
  const pos = [hw, 0, -hd, hw, 0, hd, hw, rise, 0, -hw, 0, hd, -hw, 0, -hd, -hw, rise, 0];
  const uv = [-hd, 0, hd, 0, 0, rise, hd, 0, -hd, 0, 0, rise];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// shop sign: painted board with lettering
function signTexture(text, bg = '#1f3b57', fg = '#f4ead2') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = fg;
  g.lineWidth = 8;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = fg;
  g.font = 'bold 110px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Collects window frames and panes for the whole town; turned into two
// InstancedMeshes at the end (2 draw calls for hundreds of windows).
class Windows {
  constructor() { this.frames = []; this.panes = []; }
  // a window centered at p on a wall facing `normal` (unit, horizontal), w x h meters
  add(p, normal, w = 1.2, h = 1.5) {
    const yaw = Math.atan2(normal.x, normal.z);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.frames.push(new THREE.Matrix4().compose(p.clone().addScaledVector(normal, 0.03), _q, new THREE.Vector3(w + 0.14, h + 0.14, 0.08)));
    // the pane sits just in front of the frame block, a bit smaller, so the frame shows as a border
    this.panes.push(new THREE.Matrix4().compose(p.clone().addScaledVector(normal, 0.075), _q, new THREE.Vector3(w, h, 1)));
  }
  build(parent) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.6 });
    // dark glass reflecting the sky (no transmission: cheap)
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e141b, roughness: 0.05, metalness: 0.85, envMapIntensity: 1.1 });
    const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), frameMat, this.frames.length);
    const panes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glassMat, this.panes.length);
    this.frames.forEach((m, i) => frames.setMatrixAt(i, m));
    this.panes.forEach((m, i) => panes.setMatrixAt(i, m));
    for (const im of [frames, panes]) {
      im.userData.noCollide = true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
    }
    frames.castShadow = true;
  }
}

const FACADES = ['brick_wall_001', 'brick_wall_09', 'red_brick_plaster_patch_02', 'beige_wall_001', 'painted_plaster_wall', 'concrete_block_wall_02'];
const ROOFS = ['clay_roof_tiles_02', 'grey_roof_tiles', 'roof_slates_02'];

// A building on a lot. front: +1 = door faces +z (north side of the street), -1 = faces -z.
function building(statics, windows, { x, z, w, d, floors, front, facade, roof, shop, color }) {
  const g = new THREE.Group();
  g.name = shop ? `shop-${shop.name}` : 'house';
  statics.add(g);
  const floorH = 3.0;
  const H = floors * floorH + 0.3;
  const wall = pbr(facade, { size: facade.includes('brick') ? 1.6 : 2.5, color });
  const body = mesh(box(w, H, d), wall, x, GROUND_Y + H / 2, z, g);
  body.name = 'building';
  // plinth and cornice: real buildings aren't plain boxes
  const trim = pbr('concrete_pavement', { size: 1.5, color: 0xb9b3a8 });
  mesh(box(w + 0.12, 0.5, d + 0.12), trim, x, GROUND_Y + 0.25, z, g);
  const fz = z + front * d / 2;              // front wall plane
  const n = new THREE.Vector3(0, 0, front);   // front normal
  const cols = Math.max(1, Math.floor((w - 1.5) / 2.6));
  const step = w / cols;
  for (let f = 0; f < floors; f++) {
    if (f === 0 && shop) continue;
    for (let c = 0; c < cols; c++) {
      const wx = x - w / 2 + step * (c + 0.5);
      const wy = GROUND_Y + f * floorH + 1.65;
      if (f === 0 && !shop && c === Math.floor(cols / 2)) continue; // the front door goes here
      windows.add(new THREE.Vector3(wx, wy, fz), n);
      windows.add(new THREE.Vector3(wx, wy, z - front * d / 2), n.clone().negate());
    }
    // a couple on the sides
    for (const sx of [-1, 1]) windows.add(new THREE.Vector3(x + sx * w / 2, GROUND_Y + f * floorH + 1.65, z), new THREE.Vector3(sx, 0, 0), 0.9, 1.4);
  }
  // front door (houses: middle; shops: in the shop front)
  const doorMat = pbr('fine_grained_wood', { size: 1.2, color: shop ? 0x5a3a26 : [0x3a4a5c, 0x6b2b24, 0x2f4a33][Math.abs(Math.round(x)) % 3] });
  const doorX = shop ? x + w / 2 - 1.2 : x - w / 2 + step * (Math.floor(cols / 2) + 0.5);
  mesh(box(1.05, 2.2, 0.08), doorMat, doorX, GROUND_Y + 1.1, fz + front * 0.04, g);
  mesh(box(1.3, 0.12, 0.25), trim, doorX, GROUND_Y + 2.26, fz + front * 0.1, g); // lintel
  if (shop) {
    // big shop window, awning and sign
    const sw = w - 3.2;
    windows.add(new THREE.Vector3(x - 0.9, GROUND_Y + 1.5, fz), n, sw, 2.2);
    const awning = new THREE.MeshStandardMaterial({ color: shop.awning, roughness: 0.85, side: THREE.DoubleSide });
    const aw = mesh(new THREE.BoxGeometry(w - 0.4, 0.04, 1.4), awning, x, GROUND_Y + 3.0, fz + front * 0.68, g);
    aw.rotation.x = front * 0.32;
    aw.userData.noCollide = false;
    const sign = mesh(new THREE.PlaneGeometry(Math.min(w - 1, 6), 1.1), new THREE.MeshStandardMaterial({ map: signTexture(shop.name, shop.bg, shop.fg), roughness: 0.7 }), x, GROUND_Y + 3.75, fz + front * 0.03, g, { shadow: false });
    if (front < 0) sign.rotation.y = Math.PI;
    sign.userData.noCollide = true;
  }
  // roof
  if (roof === 'flat') {
    const cap = pbr('concrete_pavement', { size: 2, color: 0x8d8a85 });
    mesh(box(w + 0.2, 0.35, d + 0.2), cap, x, GROUND_Y + H + 0.17, z, g);
  } else {
    const rise = Math.min(3, d * 0.42);
    const r = mesh(gableRoof(w, d, rise), pbr(roof, { size: 2, side: THREE.DoubleSide }), x, GROUND_Y + H, z, g);
    r.name = 'roof';
    mesh(gableEnds(w, d, rise), wall, x, GROUND_Y + H, z, g);
    // chimney
    mesh(box(0.6, 1.6, 0.6), pbr('brick_wall_001', { size: 1.2 }), x + w * 0.28, GROUND_Y + H + rise * 0.6, z - d * 0.15, g);
  }
  return g;
}

export async function buildTown({ statics, props, scene }) {
  const town = new THREE.Group();
  town.name = 'town';
  statics.add(town);
  const windows = new Windows();
  const H = BEDROOM;
  const hx0 = H.x0 - 0.15, hx1 = H.x1 + 0.15, hz0 = H.z0 - 0.15, hz1 = H.z1 + 0.15; // house footprint

  // ---- ground: lawns (with a hole where the house stands), sidewalks with curbs, the road
  const grass = pbr('sparse_grass', { size: 3 });
  ground(town, grass, TOWN.x0, TOWN.x1, TOWN.z0, hz0, GROUND_Y);
  ground(town, grass, TOWN.x0, TOWN.x1, hz1, 7, GROUND_Y);
  ground(town, grass, TOWN.x0, hx0, hz0, hz1, GROUND_Y);
  ground(town, grass, hx1, TOWN.x1, hz0, hz1, GROUND_Y);
  ground(town, grass, TOWN.x0, TOWN.x1, 18, TOWN.z1, GROUND_Y);
  const walk = pbr('concrete_pavement', { size: 2 });
  const curb = pbr('concrete_pavement', { size: 1, color: 0xc8c3ba });
  for (const [z0, z1, cz] of [[7, 9, 8.92], [16, 18, 16.08]]) {
    ground(town, walk, TOWN.x0, TOWN.x1, z0, z1, GROUND_Y + 0.02);
    // curb: from below the road up to the sidewalk (17 cm step, like a real one)
    mesh(box(TOWN.x1 - TOWN.x0, GROUND_Y + 0.02 - 2.95, 0.16), curb, 0, (GROUND_Y + 0.02 + 2.95) / 2, cz, town);
  }
  const asphalt = pbr('asphalt_02', { size: 4 });
  // the road surface sits on a slab so nothing can fall through the curb gap
  mesh(box(TOWN.x1 - TOWN.x0, 0.2, ROAD.z1 - ROAD.z0), asphalt, 0, ROAD.y - 0.1, (ROAD.z0 + ROAD.z1) / 2, town, { shadow: false });
  // lane markings (dashed center line, solid edge lines)
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e2cf, roughness: 0.7 });
  const zc = (ROAD.z0 + ROAD.z1) / 2;
  for (let x = TOWN.x0 + 2; x < TOWN.x1 - 2; x += 6) {
    const m = mesh(plane(3, 0.15), paint, x + 1.5, ROAD.y + 0.004, zc, town, { shadow: false });
    m.userData.noCollide = true;
  }
  for (const ez of [ROAD.z0 + 0.35, ROAD.z1 - 0.35]) {
    const m = mesh(plane(TOWN.x1 - TOWN.x0 - 1, 0.12), paint, 0, ROAD.y + 0.004, ez, town, { shadow: false });
    m.userData.noCollide = true;
  }
  // your front path, door to sidewalk
  const path = pbr('grey_stone_path', { size: 1.5 });
  const doorX = 3.45;
  const p = ground(town, path, doorX - 0.65, doorX + 0.65, hz1, 7, GROUND_Y + 0.012);
  p.userData.noCollide = true;

  // ---- your house: brick outside, tiled roof
  const brick = pbr('brick_wall_09', { size: 1.6 });
  const top = H.floorY + H.h + 0.15;
  const skin = 0.05;
  const wallH = top - GROUND_Y;
  // north (back) and west walls are plain; south has the door, east the window
  mesh(box(hx1 - hx0 + skin * 2, wallH, skin), brick, (hx0 + hx1) / 2, GROUND_Y + wallH / 2, hz0 - skin / 2, town);
  mesh(box(skin, wallH, hz1 - hz0), brick, hx0 - skin / 2, GROUND_Y + wallH / 2, (hz0 + hz1) / 2, town);
  // south wall with the doorway (x 3.0-3.9, 2.05 m tall above the bedroom floor)
  const dy1 = H.floorY + 2.05;
  const sz = hz1 + skin / 2;
  mesh(box(3.0 - hx0, wallH, skin), brick, (hx0 + 3.0) / 2, GROUND_Y + wallH / 2, sz, town);
  mesh(box(hx1 - 3.9, wallH, skin), brick, (3.9 + hx1) / 2, GROUND_Y + wallH / 2, sz, town);
  mesh(box(0.9, top - dy1, skin), brick, 3.45, (dy1 + top) / 2, sz, town);
  // east wall with the window (z -3.3..-1.9, 0.9..2.1 above the floor)
  const ex = hx1 + skin / 2;
  const wy0 = H.floorY + 0.9, wy1 = H.floorY + 2.1;
  mesh(box(skin, wallH, -3.3 - hz0), brick, ex, GROUND_Y + wallH / 2, (hz0 - 3.3) / 2, town);
  mesh(box(skin, wallH, hz1 + 1.9), brick, ex, GROUND_Y + wallH / 2, (-1.9 + hz1) / 2, town);
  mesh(box(skin, wy0 - GROUND_Y, 1.4), brick, ex, (GROUND_Y + wy0) / 2, -2.6, town);
  mesh(box(skin, top - wy1, 1.4), brick, ex, (wy1 + top) / 2, -2.6, town);
  // door frame and step
  const trim = pbr('fine_grained_wood', { size: 1, color: 0xe6e0d4 });
  mesh(box(0.08, 2.1, 0.12), trim, 2.98, H.floorY + 1.05, sz + 0.02, town);
  mesh(box(0.08, 2.1, 0.12), trim, 3.92, H.floorY + 1.05, sz + 0.02, town);
  mesh(box(1.02, 0.08, 0.12), trim, 3.45, dy1 + 0.04, sz + 0.02, town);
  // roof (ridge along X)
  const roofW = hx1 - hx0 + skin * 2, roofD = hz1 - hz0 + skin * 2;
  const rise = 1.7;
  mesh(gableRoof(roofW, roofD, rise, 0.4), pbr('clay_roof_tiles_02', { size: 2, side: THREE.DoubleSide }), (hx0 + hx1) / 2, top, (hz0 + hz1) / 2, town);
  mesh(gableEnds(roofW, roofD, rise), brick, (hx0 + hx1) / 2, top, (hz0 + hz1) / 2, town);
  mesh(box(0.6, 1.5, 0.6), brick, hx0 + 1.0, top + 1.1, hz0 + 1.2, town);
  // mailbox by the path
  await place(props, 'metal_trash_can', { x: doorX + 1.6, y: GROUND_Y, z: 6.2, height: 0.9 });

  // ---- neighbors on your side (doors face the street, +z) and shops across it
  const north = [-40, -28, -16, 16, 28, 40];
  north.forEach((x, i) => {
    const w = 8 + (i % 3), d = 7 + (i % 2);
    building(town, windows, {
      x, z: 1.5 - d / 2 + (i % 2) * 0.8, w, d, floors: 1 + (i % 2), front: 1,
      facade: FACADES[i % FACADES.length], roof: ROOFS[i % ROOFS.length],
    });
  });
  // fences between the lots on your side
  const fenceMat = pbr('fine_grained_wood', { size: 1.5, color: 0xb59b78 });
  for (const fx of [-10.5, 10.5, -22, 22, -34, 34]) {
    mesh(box(0.08, 1.2, 16), fenceMat, fx, GROUND_Y + 0.6, -1, town);
  }
  const shops = [
    { name: 'Bakery', awning: 0xb3462e, bg: '#5a2a1a', fg: '#f6e6c8' },
    { name: 'Pharmacy', awning: 0x2f7a4f, bg: '#1d4a33', fg: '#eaf6ee' },
    { name: 'Hardware', awning: 0xc28b2c, bg: '#3b2b12', fg: '#f3dc9e' },
    { name: 'Pet Shop', awning: 0x3a6fb0, bg: '#173257', fg: '#ffe9a8' },
    { name: 'Diner', awning: 0xc2353b, bg: '#7a1c22', fg: '#fff3e6' },
    { name: 'Bank', awning: 0x3d4a5c, bg: '#1e2733', fg: '#e9d9a6' },
    { name: 'Police', awning: 0x1d3c78, bg: '#0f2147', fg: '#ffffff' },
    { name: 'Grocery', awning: 0x5c8a2e, bg: '#2a4314', fg: '#f4f7d6' },
  ];
  // places where townspeople go and what they do there
  const spots = [];
  const V = (x, z) => new THREE.Vector3(x, GROUND_Y + 0.02, z);
  north.forEach((x) => spots.push({ p: V(x, 3.6), face: new THREE.Vector3(0, 0, -1), act: 'door' }));
  shops.forEach((shop, i) => {
    const x = -42 + i * 12;
    spots.push({ p: V(x - 0.9, 17.5), face: new THREE.Vector3(0, 0, 1), act: 'shop', name: shop.name });
    const w = 10, d = 9;
    building(town, windows, {
      x, z: 18.6 + d / 2, w, d, floors: 2 + (i % 2), front: -1,
      facade: FACADES[(i + 2) % FACADES.length], roof: i % 3 === 0 ? 'clay_roof_tiles_02' : 'flat', shop,
    });
  });
  windows.build(town);

  // ---- street furniture: lamps, hydrants, benches, a parked car, trees
  for (let x = -40; x <= 40; x += 13) {
    await place(props, 'street_lamp_01', { x: x + 2, y: GROUND_Y + 0.02, z: 8.6, rotY: Math.PI, height: 5.5 });
    await place(props, 'street_lamp_01', { x: x - 4, y: GROUND_Y + 0.02, z: 16.4, height: 5.5 });
  }
  await place(props, 'fire_hydrant', { x: -6, y: GROUND_Y + 0.02, z: 8.5, height: 0.8 });
  await place(props, 'fire_hydrant', { x: 20, y: GROUND_Y + 0.02, z: 16.5, height: 0.8 });
  await place(props, 'modular_street_seating', { x: -18, y: GROUND_Y + 0.02, z: 17.3, height: 0.9 });
  spots.push({ p: V(-18, 16.6), face: new THREE.Vector3(0, 0, -1), act: 'phone' }, { p: V(6, 16.6), face: new THREE.Vector3(0, 0, -1), act: 'phone' });
  for (let x = -38; x <= 38; x += 19) spots.push({ p: V(x, 8), act: 'look' }, { p: V(x + 9, 17), act: 'look' });
  await place(props, 'modular_street_seating', { x: 6, y: GROUND_Y + 0.02, z: 17.3, height: 0.9 });
  await place(props, 'covered_car', { x: 12, y: ROAD.y, z: ROAD.z1 - 1.3, rotY: Math.PI / 2, width: 4.4 });
  await place(props, 'water_manhole_cover', { x: -3, y: ROAD.y + 0.005, z: 12.5, width: 0.8 });
  const trees = [[-5, 3], [9, 3.5], [-24, -14], [24, -15], [-12, 24], [14, 26], [-36, 26], [38, 25], [-44, -20], [44, -18]];
  for (const [i, [tx, tz]] of trees.entries()) {
    await place(props, i % 2 ? 'island_tree_01' : 'island_tree_02', { x: tx, y: GROUND_Y, z: tz, height: 7 + (i % 3) });
  }

  // ---- the edge of town: a tall board fence all around (you can see it, it's real)
  const edge = pbr('wood_floor_deck', { size: 2, color: 0x8a7a64 });
  const ew = TOWN.x1 - TOWN.x0, ed = TOWN.z1 - TOWN.z0, ecx = (TOWN.x0 + TOWN.x1) / 2, ecz = (TOWN.z0 + TOWN.z1) / 2;
  mesh(box(ew, 2.4, 0.12), edge, ecx, GROUND_Y + 1.2, TOWN.z0, town);
  mesh(box(ew, 2.4, 0.12), edge, ecx, GROUND_Y + 1.2, TOWN.z1, town);
  mesh(box(0.12, 2.4, ed), edge, TOWN.x0, GROUND_Y + 1.2, ecz, town);
  mesh(box(0.12, 2.4, ed), edge, TOWN.x1, GROUND_Y + 1.2, ecz, town);
  // the road runs under the fence: block it with concrete barriers
  const barrier = pbr('concrete_pavement', { size: 1, color: 0xd8d2c6 });
  for (const bx of [TOWN.x0 + 0.6, TOWN.x1 - 0.6]) mesh(box(0.6, 1.0, ROAD.z1 - ROAD.z0), barrier, bx, ROAD.y + 0.5, zc, town);

  mergeByMaterial(town);
  return { town, spots };
}

// Is a point inside the basement lab (no sky there)?
export function inLab(p) {
  return p.y < 3.15 && Math.abs(p.x) < 7.3 && Math.abs(p.z) < 5.3;
}
