// Maple Hollow, Ohio: Maple Street (10 houses), the park with the cul-de-sac, Elm Avenue, the
// school (outside), the shopping plaza (stores.js fills it), woods and a perimeter fence.
//
//   const town = buildTown(world, { family, season })
//
// Real-life rules followed here: the road sits 12 cm below the curb, sidewalks, driveways,
// mailboxes, backyard privacy fences, street trees on the tree lawn, streetlights, a stop sign
// where Maple meets Elm, and no invisible walls: the map ends at a chain-link fence in the woods
// and at "ROAD CLOSED" barricades on Elm Avenue.

import * as THREE from 'three';
import { mat } from '../gfx/materials.js';
import { canvasTexture } from '../gfx/textures.js';
import { Builder } from './builder.js';
import { buildHouse, buildShell, FLOOR_Y } from './house.js';
import { placeInstances } from './instanced.js';
import { plantVegetation } from '../gfx/vegetation.js';
import { Rng } from '../core/rng.js';
import { buildStores } from './stores.js';
import { CURB, MAPLE, ELM, CULDESAC, SIDEWALK, FAMILY_LOT, LOTS, PARK, PLAZA, SCHOOL, BOUNDS, STORES } from './layout.js';
import { buildLot, lightPools, LOT_CORRAL_Z } from './lot.js';

export const SEASON_TREES = {
  spring: (t) => t,
  summer: (t) => (t.endsWith('_dark') ? t : `${t}_dark`),
  fall: (t) => `${t}_fall`,
  winter: (t) => (t.endsWith('_dark') ? t : `${t}_dark`),
};
const LEAFY = ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_tall', 'tree_plateau'];
const PINES = ['tree_pineTallA', 'tree_pineTallB', 'tree_pineRoundA', 'tree_pineRoundC', 'tree_pineTallC'];

export function townAssets() {
  const list = [];
  for (const t of LEAFY) for (const v of ['', '_dark', '_fall']) list.push(['nature', t === 'tree_fat' && v === '_dark' ? 'tree_fat_darkh' : t + v]);
  for (const t of PINES) list.push(['nature', t]);
  for (const n of ['plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'flower_redA', 'flower_yellowA', 'flower_purpleA', 'rock_largeA', 'rock_smallA', 'log', 'stump_round', 'grass_large']) list.push(['nature', n]);
  for (const n of ['light-square', 'road-sign-stop', 'construction-barrier', 'construction-cone']) list.push(['roads', n]);
  list.push(['home', 'Trashcan_Large']);
  for (const n of ['shopping-basket', 'shopping-cart', 'cash-register']) list.push(['market', n]);
  for (const n of ['Bed_Bunk', 'Couch_L', 'Couch_Small2', 'Table_RoundSmall', 'Carpet_1', 'Houseplant_3', 'Chair_1', 'Stool', 'Light_Desk']) list.push(['home', n]);
  for (const n of ['banana', 'apple', 'orange', 'lemon', 'tomato', 'broccoli', 'watermelon', 'grapes', 'onion', 'cake-birthday']) list.push(['food', n]);
  return list;
}

function treeName(base, season) {
  const n = SEASON_TREES[season || 'spring'](base);
  return n === 'tree_fat_dark' ? 'tree_fat_darkh' : n;
}

export function buildTown(world, opts) {
  const { family } = opts;
  const scene = world.scene;
  PAVED = [];
  world.paved = PAVED;
  const root = new THREE.Group();
  root.name = 'town';
  scene.add(root);
  const B = new Builder(world, root);
  const rng = new Rng(opts.seed || 1234);

  const grass = mat('grass', { dry: 0.25, tileMeters: 3 });
  const asphalt = mat('asphalt', { wear: 0.35, dirt: 0.3 });
  const concrete = mat('sidewalk', { wear: 0.3, dirt: 0.3 });
  const curbMat = mat('concrete', { wear: 0.4, dirt: 0.5 });
  const drive = mat('concrete', { wear: 0.35, dirt: 0.45 });

  // ------------------------------------------------------------------ ground with the road cut out
  const outer = new THREE.Shape();
  const G = 420;
  outer.moveTo(-G, -G);
  outer.lineTo(G, -G);
  outer.lineTo(G, G);
  outer.lineTo(-G, G);
  outer.closePath();
  const hole = new THREE.Path();
  const eW = ELM.x - ELM.half;
  const eE = ELM.x + ELM.half;
  const zN = -MAPLE.half;
  const zS = MAPLE.half;
  const cutX = CULDESAC.x + Math.sqrt(CULDESAC.r ** 2 - MAPLE.half ** 2);
  const a0 = Math.atan2(zN, cutX - CULDESAC.x);
  hole.moveTo(eW, -400);
  hole.lineTo(eW, zN);
  hole.lineTo(cutX, zN);
  // around the cul-de-sac on the west side
  const steps = 28;
  for (let i = 1; i < steps; i++) {
    // from angle a0 (≈ -20°) going the long way round through 180° to -a0
    const t = i / steps;
    const a = a0 - t * (2 * Math.PI + 2 * a0);
    hole.lineTo(CULDESAC.x + Math.cos(a) * CULDESAC.r, CULDESAC.z + Math.sin(a) * CULDESAC.r);
  }
  hole.lineTo(cutX, zS);
  hole.lineTo(eW, zS);
  hole.lineTo(eW, 400);
  hole.lineTo(eE, 400);
  hole.lineTo(eE, -400);
  hole.closePath();
  outer.holes.push(hole);
  const groundGeo = new THREE.ShapeGeometry(outer, 1);
  groundGeo.rotateX(Math.PI / 2);
  groundGeo.translate(0, CURB, 0);
  // ShapeGeometry faces +z before rotation; after rotateX(+90°) it faces down: flip.
  flipFaces(groundGeo);
  const ground = new THREE.Mesh(groundGeo, grass);
  worldUVGround(groundGeo, grass.userData.tileMeters);
  ground.receiveShadow = true;
  root.add(ground);
  world.physics.addStaticTrimesh(ground);

  // Road surfaces (at y = 0) + curbs.
  const road = (cx, cz, sx, sz) => B.box(cx, -0.1, cz, sx, 0.2, sz, [null, null, asphalt, null, null, null], { shadow: false });
  road((MAPLE.x0 + eW) / 2 + 0, 0, eW - MAPLE.x0, MAPLE.half * 2);
  road(ELM.x, 0, ELM.half * 2, 800);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(CULDESAC.r, 40), asphalt);
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(CULDESAC.x, 0.001, CULDESAC.z);
  B.mesh(disc, { shadow: false });
  world.physics.addStaticBox({ x: CULDESAC.x, y: -0.1, z: 0 }, { x: CULDESAC.r * 1.5, y: 0.2, z: CULDESAC.r * 1.5 }, null);
  // Curbs: thin concrete strips with their top at curb height along each road edge.
  const curb = (cx, cz, sx, sz) => B.box(cx, CURB / 2, cz, sx, CURB, sz, curbMat, { collide: false });
  curb((cutX + eW) / 2, zN - 0.08, eW - cutX, 0.16);
  curb((cutX + eW) / 2, zS + 0.08, eW - cutX, 0.16);
  curb(eW - 0.08, (-400 + zN) / 2, 0.16, 400 + zN);
  curb(eW - 0.08, (400 + zS) / 2, 0.16, 400 - zS);
  curb(eE + 0.08, 0, 0.16, 800);
  for (let i = 0; i < 40; i++) {
    const a = a0 - ((i + 0.5) / 40) * (2 * Math.PI + 2 * a0);
    const x = CULDESAC.x + Math.cos(a) * (CULDESAC.r + 0.08);
    const z = CULDESAC.z + Math.sin(a) * (CULDESAC.r + 0.08);
    B.box(x, CURB / 2, z, 0.16, CURB, (2 * Math.PI * CULDESAC.r) / 40 + 0.06, curbMat, { rotY: -a, collide: false });
  }
  // Road paint: Elm Ave double yellow, stop bar on Maple at Elm, crosswalk.
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.7 });
  const line = (cx, cz, sx, sz, m, y = 0) => B.box(cx, y + 0.004, cz, sx, 0.008, sz, [null, null, m, null, null, null], { collide: false, shadow: false });
  line(ELM.x - 0.1, 0, 0.1, 800, yellow);
  line(ELM.x + 0.1, 0, 0.1, 800, yellow);
  line(eW - 0.9, zS / 2, 0.4, MAPLE.half, white); // stop bar (eastbound lane)
  for (let i = 0; i < 6; i++) line(eW - 3.2, -3 + i * 1.2, 1.8, 0.5, white); // crosswalk over Maple

  // Sidewalks (2 cm slabs on the grass) along Maple + Elm.
  const walk = (x0, z0, x1, z1) => B.box((x0 + x1) / 2, CURB + 0.01, (z0 + z1) / 2, Math.abs(x1 - x0), 0.02, Math.abs(z1 - z0), [concrete, concrete, concrete, null, concrete, concrete], { collide: false, shadow: false });
  walk(cutX + 2, SIDEWALK.mapleN.z0, SIDEWALK.elmW.x0, SIDEWALK.mapleN.z1);
  walk(cutX + 2, SIDEWALK.mapleS.z0, SIDEWALK.elmW.x0, SIDEWALK.mapleS.z1);
  walk(SIDEWALK.elmW.x0, BOUNDS.z0 + 2, SIDEWALK.elmW.x1, BOUNDS.z1 - 2);
  walk(SIDEWALK.elmE.x0, BOUNDS.z0 + 2, SIDEWALK.elmE.x1, BOUNDS.z1 - 2);

  // ------------------------------------------------------------------ houses
  const houses = [];
  const home = buildHouse(world, B, B, { x0: FAMILY_LOT.x0, zf: FAMILY_LOT.zf, wealth: family.wealth, seed: family.seed, kidSex: family.kidSex, sibling: family.sibling });
  houses.push({ lot: LOTS.find((l) => l.family), house: home, family: true });
  const STYLES = [
    { width: 13, depth: 10, stories: 1, garage: 'right' },
    { width: 11, depth: 9, stories: 2, garage: 'left' },
    { width: 12, depth: 10, stories: 2, garage: 'right' },
    { width: 14, depth: 10, stories: 1, garage: 'left' },
    { width: 10, depth: 9, stories: 2, garage: 'none' },
  ];
  LOTS.forEach((lot, i) => {
    if (lot.family) return;
    const st = STYLES[(i * 7 + 3) % STYLES.length];
    const total = st.width + (st.garage === 'none' ? 0 : 6);
    const x0 = lot.x - total / 2;
    const facing = lot.side === -1 ? 1 : -1; // north side faces +z (street)
    const zf = lot.side === -1 ? -16 + rng.range(-1, 1) : 16 + rng.range(-1, 1);
    const shell = buildShell(world, B, { x0, zf, ...st, seed: 100 + i, facing });
    houses.push({ lot, house: shell, style: st, x0, zf, facing });
    // Driveway to the garage (or a short one beside the house).
    const gx = shell.garageX ?? lot.x + total / 2 + 1.5;
    const dz0 = lot.side === -1 ? -MAPLE.half : MAPLE.half;
    driveway(B, drive, gx, dz0 + lot.side * 0.0, zf, 5.2);
    walkTo(B, concrete, shell.door.x, shell.door.z, lot.side === -1 ? SIDEWALK.mapleN.z0 : SIDEWALK.mapleS.z1);
    mailbox(B, lot.x - total / 2 - 0.6, lot.side * (MAPLE.half + 0.7), lot.side);
  });
  // Family driveway + walk + mailbox.
  driveway(B, drive, home.garageDoor.cx, -MAPLE.half, FAMILY_LOT.zf, 5.2);
  walkTo(B, concrete, home.walkway.x, home.walkway.z0, SIDEWALK.mapleN.z0);
  const familyMailbox = mailbox(B, FAMILY_LOT.x0 - 1.4, -(MAPLE.half + 0.7), -1);

  // Backyard privacy fences (wood) along the back lot line + between lots behind the houses.
  const fenceMat = mat('wood', { color: 0x8a6a48, wear: 0.4, dirt: 0.3, varnish: 0.1 });
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(-(z1 - z0), x1 - x0);
    B.box((x0 + x1) / 2, CURB + 0.9, (z0 + z1) / 2, len, 1.8, 0.06, fenceMat, { rotY: rot });
    const n = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.box(x0 + (x1 - x0) * t, CURB + 0.95, z0 + (z1 - z0) * t, 0.1, 1.9, 0.1, fenceMat, { collide: false });
    }
  };
  const lotEdges = [-66, -42.5, -19, 5.5, 30, 54];
  for (const side of [-1, 1]) {
    fence(lotEdges[0], side * 44, lotEdges[lotEdges.length - 1], side * 44);
    for (const x of lotEdges) fence(x, side * 27, x, side * 44);
  }

  // ------------------------------------------------------------------ trees (seasonal)
  const trees = [];
  for (let x = MAPLE.x0 + 16; x < eW - 6; x += 11 + rng.range(0, 3)) {
    for (const side of [-1, 1]) {
      if (LOTS.some((l) => l.side === side && Math.abs(l.x - x) < 2.6)) continue; // not in front of walkways
      trees.push({ base: rng.pick(['tree_oak', 'tree_default', 'tree_detailed']), x: x + rng.range(-1, 1), z: side * (MAPLE.half + 0.85), rotY: rng.range(0, 6.28), scale: rng.range(0.85, 1.1) });
    }
  }
  // Yard trees.
  for (const lot of LOTS) {
    for (let k = 0; k < 2; k++) {
      const x = lot.x + rng.range(-9, 9);
      const z = lot.side * rng.range(30, 41);
      trees.push({ base: rng.pick(LEAFY), x, z, rotY: rng.range(0, 6.28), scale: rng.range(0.9, 1.25) });
    }
  }
  // Woods outside the fence + along the back of the lots.
  const pines = [];
  const woods = (x0, z0, x1, z1, n) => {
    for (let i = 0; i < n; i++) {
      const x = rng.range(x0, x1);
      const z = rng.range(z0, z1);
      const t = { x, z, rotY: rng.range(0, 6.28), scale: rng.range(0.9, 1.45) };
      if (rng.chance(0.4)) pines.push({ ...t, base: rng.pick(PINES) });
      else trees.push({ ...t, base: rng.pick(LEAFY) });
    }
  };
  woods(-160, -150, 190, BOUNDS.z0 - 2, 260);
  woods(-160, BOUNDS.z1 + 2, 190, 150, 260);
  woods(-200, -98, BOUNDS.x0 - 2, 98, 90);
  woods(BOUNDS.x1 + 2, -98, 230, 98, 90);
  woods(-66, -96, 54, -47, 70); // behind the north lots
  woods(-66, 47, 54, 92, 70);
  woods(PARK.x0, PARK.z0 - 50, PARK.x1, PARK.z0 - 4, 30);
  // Roads must stay clear.
  const clearOfRoad = (t) => !(Math.abs(t.x - ELM.x) < ELM.half + 3) && !(Math.abs(t.z) < MAPLE.half + 0.5 && t.x > MAPLE.x0 - 12 && t.x < eE);
  const keep = trees.filter(clearOfRoad);
  const keepPines = pines.filter(clearOfRoad);
  const treeGroup = new THREE.Group();
  root.add(treeGroup);
  // Real trees (gfx/vegetation.js): near ones full detail + shadows, the woods a lighter version.
  const inTown = (t) => Math.abs(t.z) < 48 && t.x > BOUNDS.x0 - 4 && t.x < BOUNDS.x1 + 4;
  for (const t of keep) t.far = !inTown(t);
  for (const t of keepPines) t.far = !inTown(t);
  const plantTrees = (season) => {
    for (const c of [...treeGroup.children]) treeGroup.remove(c);
    plantVegetation(treeGroup, { trees: keep, pines: keepPines, season });
  };
  plantTrees(opts.season);
  // Tree trunks block you (only the ones you can reach).
  for (const t of keep) if (Math.abs(t.z) < 46 && t.x > BOUNDS.x0 && t.x < BOUNDS.x1) B.collider(t.x, 1.5, t.z, 0.35, 3, 0.35);
  // Bushes along house fronts.
  const bushes = [];
  for (const h of houses) {
    const b = h.house.bounds;
    const front = (h.family ? FAMILY_LOT.zf : h.zf) - h.lot.side * 0.7;
    const doorX = h.family ? h.house.walkway.x : h.house.door.x;
    for (let x = b.min.x + 1.3; x < b.max.x - 1.3; x += 1.5) {
      if (Math.abs(x - doorX) < 1.8) continue;
      if (h.family && Math.abs(x - h.house.garageDoor.cx) < 3.4) continue;
      if (!h.family && h.house.garageX != null && Math.abs(x - h.house.garageX) < 3.4) continue;
      bushes.push({ x, z: front, rotY: rng.range(0, 6), scale: rng.range(1.0, 1.35) });
    }
  }
  plantVegetation(root, { bushes, season: opts.season });
  for (const h of houses) {
    const b = h.house.bounds;
    if (b) PAVED.push({ x0: b.min.x - 0.3, x1: b.max.x + 0.3, z0: b.min.z - 0.3, z1: b.max.z + 0.3, s: 'building' });
  }

  // ------------------------------------------------------------------ streetlights + signs
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const lamps = [];
  const poolAt = [];
  let k = 0;
  for (let x = MAPLE.x0 + 14; x < eW - 4; x += 28) {
    const side = k++ % 2 ? 1 : -1;
    const z = side * (MAPLE.half + 0.5);
    B.model('roads', 'light-square', { x, y: CURB, z, rotY: side === 1 ? Math.PI : 0, collide: [0.2, 9, 0.2] });
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.28), lampMat);
    bulb.position.set(x, CURB + 4.62, z - side * 1.35);
    root.add(bulb);
    lamps.push(world.lights.addLamp(new THREE.Vector3(x, CURB + 4.4, z - side * 1.35), { intensity: 30, range: 16 }));
    poolAt.push(new THREE.Vector3(x, 0.02, z - side * 1.35));
  }
  for (let z = -84; z <= 84; z += 30) {
    for (const x of [eW - 0.5, eE + 0.5]) {
      B.model('roads', 'light-square', { x, y: CURB, z, rotY: x < ELM.x ? -Math.PI / 2 : Math.PI / 2, collide: [0.2, 9, 0.2] });
      lamps.push(world.lights.addLamp(new THREE.Vector3(x + (x < ELM.x ? 1.35 : -1.35), CURB + 4.4, z), { intensity: 30, range: 16 }));
      poolAt.push(new THREE.Vector3(x + (x < ELM.x ? 1.35 : -1.35), 0.02, z));
    }
  }
  B.model('roads', 'road-sign-stop', { x: eW - 0.6, y: CURB, z: MAPLE.half + 0.6, rotY: -Math.PI / 2, scale: 4.6, collide: [0.15, 3, 0.15] });
  streetSign(root, eW - 0.8, -(MAPLE.half + 0.8), ['MAPLE ST', 'ELM AVE']);
  streetSign(root, cutX + 3, MAPLE.half + 1.2, ['MAPLE ST', 'DEAD END']);

  // ------------------------------------------------------------------ park, school, edges
  buildPark(world, B, root, rng);
  buildSchool(world, B, root);
  buildEdges(world, B, root, rng);
  // Plaza parking lot (stores.js puts the stores on it).
  const lotMat = mat('asphalt', { wear: 0.25, dirt: 0.35 });
  B.box((PLAZA.x0 + PLAZA.x1) / 2, CURB - 0.05, (PLAZA.z0 + PLAZA.z1) / 2, PLAZA.x1 - PLAZA.x0, 0.12, PLAZA.z1 - PLAZA.z0, [null, null, lotMat, null, null, null], { collide: false, shadow: false });
  const stalls = [];
  const doorZs = Object.values(STORES).map((d) => (d.z0 + d.z1) / 2);
  for (let z = PLAZA.z0 + 6; z < PLAZA.z1 - 4; z += 2.8) {
    for (const x of [96, 106]) line(x, z, 5.5, 0.12, white, CURB + 0.01);
    if (z + 2.8 < PLAZA.z1 - 4) {
      for (const [row, x] of [[0, 96], [1, 106]]) {
        const sz = z + 1.4;
        const acc = row === 1 && doorZs.some((dz) => Math.abs(dz - sz) < 2.9);
        const corral = row === 1 && Math.abs(sz - LOT_CORRAL_Z) < 1;
        stalls.push({ x, z: sz, row, headX: row === 0 ? 93.4 : 108.6, acc, reserved: acc || corral });
      }
    }
  }
  const lot = buildLot(world, B, root, stalls, lampMat);
  const streetPools = lightPools(root, poolAt, lampMat, 11);

  const stores = buildStores(world, B, root);

  B.finish();
  return {
    root,
    stores,
    home,
    houses,
    lamps,
    lampMat,
    familyMailbox,
    plantTrees,
    windowsMat: null,
    lotStalls: stalls,
    lotPools: [lot.poolMesh, streetPools],
  };
}

// ---------------------------------------------------------------------------------------- pieces

// Hard surfaces that aren't lawn (driveways, walkways, houses): grass + footsteps read this.
let PAVED = [];

function driveway(B, m, cx, zRoad, zHouse, w) {
  const z0 = zRoad;
  const z1 = zHouse;
  PAVED.push({ x0: cx - w / 2, x1: cx + w / 2, z0: Math.min(z0, z1), z1: Math.max(z0, z1), s: 'concrete' });
  B.box(cx, CURB + 0.012, (z0 + z1) / 2, w, 0.024, Math.abs(z1 - z0), [m, m, m, null, m, m], { collide: false, shadow: false });
}

function walkTo(B, m, x, zDoor, zSidewalk) {
  PAVED.push({ x0: x - 0.6, x1: x + 0.6, z0: Math.min(zDoor, zSidewalk), z1: Math.max(zDoor, zSidewalk), s: 'concrete' });
  B.box(x, CURB + 0.01, (zDoor + zSidewalk) / 2, 1.2, 0.02, Math.abs(zSidewalk - zDoor), [m, m, m, null, m, m], { collide: false, shadow: false });
}

function mailbox(B, x, z, side) {
  const post = mat('wood', { color: 0x6b5238 });
  const box = mat('metal-painted', { color: 0x2b2b2b, wear: 0.2, dirt: 0.2 });
  B.box(x, CURB + 0.55, z, 0.09, 1.1, 0.09, post, { collide: true });
  B.box(x, CURB + 1.15, z, 0.24, 0.24, 0.48, box, { rotY: side === -1 ? Math.PI / 2 : -Math.PI / 2 });
  return new THREE.Vector3(x, CURB + 1.15, z);
}

function streetSign(root, x, z, names) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 8), mat('steel'));
  pole.position.set(x, CURB + 1.5, z);
  pole.castShadow = true;
  root.add(pole);
  names.forEach((n, i) => {
    const tex = canvasTexture(`street-${n}`, 256, 48, (ctx, w, h) => {
      ctx.fillStyle = '#1d6b3a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f2f2f2';
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = '#f2f2f2';
      ctx.font = 'bold 30px Inter, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n, w / 2, h / 2 + 1);
    });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.17, 0.02), [null, null, null, null].map(() => new THREE.MeshStandardMaterial({ color: 0x1d6b3a })).concat([new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex })]));
    plate.position.set(x, CURB + 2.85 - i * 0.2, z);
    plate.rotation.y = i * (Math.PI / 2);
    root.add(plate);
  });
}

function buildPark(world, B, root, rng) {
  const path = mat('sidewalk', { wear: 0.2, dirt: 0.25 });
  const cx = (PARK.x0 + PARK.x1) / 2;
  // Entrance path from the cul-de-sac + a loop around the pond.
  B.box((PARK.x1 + CULDESAC.x - CULDESAC.r) / 2, CURB + 0.01, 0, PARK.x1 - (CULDESAC.x - CULDESAC.r) + 1 + 0, 0.02, 2.2, [path, path, path, null, path, path], { collide: false, shadow: false });
  const loopR = 22;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = cx + Math.cos(a) * loopR;
    const z = Math.sin(a) * loopR * 1.2;
    B.box(x, CURB + 0.012, z, 2.0, 0.02, (2 * Math.PI * loopR * 1.1) / 48 + 0.3, [path, path, path, null, path, path], { rotY: -a, collide: false, shadow: false });
  }
  // Pond.
  const water = new THREE.MeshStandardMaterial({ color: 0x2c4a52, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.2 });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(9, 40), water);
  pond.rotation.x = -Math.PI / 2;
  pond.scale.set(1.3, 1, 1);
  pond.position.set(cx, CURB + 0.03, 0); // above the lawn (the ground has no hole here)
  root.add(pond);
  const bank = new THREE.Mesh(new THREE.RingGeometry(8.6, 9.6, 40), mat('dirt'));
  bank.rotation.x = -Math.PI / 2;
  bank.scale.set(1.3, 1, 1);
  bank.position.set(cx, CURB + 0.02, 0);
  root.add(bank);
  // Water is a shallow drop: a low ring of rocks keeps you out (you can't swim yet).
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    B.model('nature', i % 3 ? 'rock_smallA' : 'rock_largeA', { x: cx + Math.cos(a) * 9.3 * 1.3, y: CURB - 0.05, z: Math.sin(a) * 9.3, rotY: a * 3, scale: 2.2 + (i % 3) * 0.2, collide: 'box' });
  }
  world.physics.addStaticBox({ x: cx, y: CURB + 0.4, z: 0 }, { x: 22, y: 0.8, z: 16 }, null);
  // Playground: slide + swings + climbing frame (simple real shapes).
  const px = PARK.x1 - 14;
  const pz = -22;
  const mulch = mat('dirt', { color: 0x6b4a32 });
  B.box(px, CURB + 0.02, pz, 16, 0.04, 12, [mulch, mulch, mulch, null, mulch, mulch], { collide: false, shadow: false });
  const red = mat('plastic', { color: 0xc8402e, wear: 0.2 });
  const blue = mat('metal-painted', { color: 0x2d5f9a, wear: 0.3 });
  const yel = mat('plastic', { color: 0xe7b937 });
  // Climbing tower.
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(px - 4 + dx, CURB + 1.4, pz + dz, 0.12, 2.8, 0.12, blue);
  B.box(px - 4, CURB + 1.5, pz, 2.2, 0.1, 2.2, yel);
  B.box(px - 4, CURB + 2.9, pz, 2.6, 0.08, 2.6, red, { collide: false });
  // Slide down to the east.
  const slide = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.7), red);
  slide.position.set(px - 1.6, CURB + 0.85, pz);
  slide.rotation.z = -0.44;
  B.mesh(slide);
  world.physics.addStaticBox({ x: px - 1.6, y: CURB + 0.85, z: pz }, { x: 3.4, y: 0.1, z: 0.7 }, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.44)));
  // Ladder.
  for (let i = 0; i < 5; i++) B.box(px - 5.15, CURB + 0.3 + i * 0.3, pz, 0.05, 0.05, 0.6, blue, { collide: false });
  // Swing set.
  const sx = px + 4;
  for (const dz of [-2, 2]) {
    const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 8), blue);
    l1.position.set(sx - 0.6, CURB + 1.25, pz + dz);
    l1.rotation.x = 0.22 * Math.sign(dz);
    B.mesh(l1);
  }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 8), blue);
  beam.rotation.x = Math.PI / 2;
  beam.position.set(sx - 0.6, CURB + 2.55, pz);
  B.mesh(beam);
  for (const dz of [-0.8, 0.8]) {
    for (const s of [-0.22, 0.22]) {
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.9, 4), mat('steel'));
      ch.position.set(sx - 0.6, CURB + 1.6, pz + dz + s);
      B.mesh(ch);
    }
    B.box(sx - 0.6, CURB + 0.62, pz + dz, 0.22, 0.03, 0.5, mat('rubber', { color: 0x1a1a1a }), { collide: false });
  }
  world.physics.addStaticBox({ x: sx - 0.6, y: CURB + 1.3, z: pz }, { x: 0.3, y: 2.6, z: 4.4 }, null);
  // Benches + picnic tables + trash cans around the loop.
  const wood = mat('wood', { color: 0x7a5a3a, wear: 0.5, dirt: 0.4 });
  const iron = mat('metal-painted', { color: 0x1f2a24, wear: 0.4 });
  const spots = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = cx + Math.cos(a) * (loopR + 2.2);
    const z = Math.sin(a) * (loopR + 2.2) * 1.2;
    const rot = -a + Math.PI / 2;
    B.box(x, CURB + 0.45, z, 1.6, 0.06, 0.45, wood, { rotY: rot });
    B.box(x - Math.cos(a) * 0.22, CURB + 0.75, z - Math.sin(a) * 0.22, 1.6, 0.4, 0.05, wood, { rotY: rot, collide: false });
    for (const s of [-0.7, 0.7]) B.box(x + Math.sin(a) * s, CURB + 0.22, z - Math.cos(a) * s, 0.06, 0.45, 0.45, iron, { rotY: rot, collide: false });
    spots.push({ kind: 'seat', at: new THREE.Vector3(x, CURB + 0.48, z), faceYaw: Math.atan2(-Math.cos(a), -Math.sin(a)), label: 'park bench' });
  }
  world.parkSpots = spots;
  // Park sign at the entrance.
  const signTex = canvasTexture('park-sign', 512, 160, (ctx, w, h) => {
    ctx.fillStyle = '#5b3a22';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e9d8b4';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#f3e6c6';
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.fillText('MAPLE HOLLOW', w / 2, 72);
    ctx.font = '36px Georgia, serif';
    ctx.fillText('C O M M U N I T Y   P A R K', w / 2, 124);
  });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 0.12), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }), wood]);
  sign.position.set(PARK.x1 + 1, CURB + 0.9, -3.2);
  sign.rotation.y = Math.PI / 2;
  sign.castShadow = true;
  root.add(sign);
  world.physics.addStaticBox({ x: PARK.x1 + 1, y: CURB + 0.6, z: -3.2 }, { x: 0.15, y: 1.2, z: 2.6 }, null);
  void rng;
}

function buildSchool(world, B, root) {
  const brick = mat('brick', { color: 0x9a4a36, dirt: 0.25 });
  const trim = mat('concrete', { wear: 0.2, dirt: 0.3 });
  const x0 = SCHOOL.x0 + 8;
  const x1 = SCHOOL.x1 - 6;
  const z0 = SCHOOL.z0 + 20;
  const z1 = SCHOOL.z1 - 6;
  const h = 7.6;
  const glass = WINDOW_DARK();
  // Main block (front faces Elm Ave = west).
  B.wall(x0, z0, x0, z1, { y: 0, h, t: 0.3, matA: trim, matB: brick, matEdge: trim, openings: [{ at: (z1 - z0) / 2, w: 3.2, h: 2.6, sill: CURB }] });
  B.wall(x1, z0, x1, z1, { y: 0, h, t: 0.3, matA: brick, matB: trim, matEdge: trim });
  B.wall(x0, z0, x1, z0, { y: 0, h, t: 0.3, matA: brick, matB: trim, matEdge: trim });
  B.wall(x0, z1, x1, z1, { y: 0, h, t: 0.3, matA: trim, matB: brick, matEdge: trim });
  B.box((x0 + x1) / 2, h + 0.15, (z0 + z1) / 2, x1 - x0 + 0.6, 0.3, z1 - z0 + 0.6, trim, { collide: false });
  // Window bands.
  const win = (cx, cy, cz, w, hh, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), glass);
    m.position.set(cx, cy, cz);
    m.rotation.y = rot;
    root.add(m);
  };
  for (let z = z0 + 3; z < z1 - 2; z += 4) {
    if (Math.abs(z - (z0 + z1) / 2) < 3) continue;
    for (const y of [2.2, 5.6]) win(x0 - 0.16, y, z, 2.4, 1.5, -Math.PI / 2);
  }
  for (let x = x0 + 3; x < x1 - 2; x += 4) for (const y of [2.2, 5.6]) win(x, y, z0 - 0.16, 2.4, 1.5, Math.PI);
  // Doors (locked on weekends; inside comes in a later update).
  const doorMat = mat('metal-painted', { color: 0x2d4e7a, wear: 0.2 });
  B.box(x0 - 0.05, CURB + 1.3, (z0 + z1) / 2, 0.1, 2.6, 3.2, doorMat);
  const signTex = canvasTexture('school-sign', 1024, 128, (ctx, w, hh) => {
    ctx.fillStyle = '#efe9dc';
    ctx.fillRect(0, 0, w, hh);
    ctx.fillStyle = '#1e3a5f';
    ctx.font = 'bold 70px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MAPLE HOLLOW ELEMENTARY', w / 2, hh / 2 + 4);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.5), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 }));
  sign.position.set(x0 - 0.17, 4.1, (z0 + z1) / 2);
  sign.rotation.y = -Math.PI / 2;
  root.add(sign);
  // Flagpole.
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 10), mat('aluminum'));
  pole.position.set(x0 - 10, CURB + 4.5, (z0 + z1) / 2 + 6);
  pole.castShadow = true;
  root.add(pole);
  const flagTex = canvasTexture('us-flag', 190, 100, (ctx, w, hh) => {
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 ? '#f4f4f4' : '#b22234';
      ctx.fillRect(0, (i * hh) / 13, w, hh / 13 + 1);
    }
    ctx.fillStyle = '#3c3b6e';
    ctx.fillRect(0, 0, w * 0.4, (hh * 7) / 13);
    ctx.fillStyle = '#fff';
    for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) ctx.fillRect(4 + c * 12 + (r % 2) * 6, 3 + r * 5.6, 2, 2);
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.0, 8, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(x0 - 10 + 0.95, CURB + 8.3, (z0 + z1) / 2 + 6);
  root.add(flag);
  world.flag = flag;
  world.physics.addStaticBox({ x: x0 - 10, y: 4.5, z: (z0 + z1) / 2 + 6 }, { x: 0.2, y: 9, z: 0.2 }, null);
  // Walk from Elm Ave to the doors + a fenced field behind.
  const path = mat('sidewalk');
  B.box((SIDEWALK.elmE.x1 + x0) / 2, CURB + 0.01, (z0 + z1) / 2, x0 - SIDEWALK.elmE.x1, 0.02, 3, [path, path, path, null, path, path], { collide: false, shadow: false });
}

function buildEdges(world, B, root, rng) {
  // Chain-link fence around the whole map (in the woods) with posts. You can see it: no
  // invisible walls.
  const linkTex = canvasTexture('chainlink', 64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(170,175,178,1)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w, h / 2);
    ctx.lineTo(w / 2, h);
    ctx.closePath();
    ctx.stroke();
  }, { repeat: true });
  const link = new THREE.MeshStandardMaterial({ map: linkTex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5, transparent: false });
  const post = mat('steel', { wear: 0.4, dirt: 0.4 });
  const H = 2.1;
  const run = (x0, z0, x1, z1, gaps = []) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const dir = new THREE.Vector3((x1 - x0) / len, 0, (z1 - z0) / len);
    // Split around gaps (roads).
    const pieces = [];
    let c = 0;
    for (const g of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (g[0] > c) pieces.push([c, g[0]]);
      c = g[1];
    }
    if (c < len) pieces.push([c, len]);
    for (const [a, b] of pieces) {
      const l = b - a;
      const mx = x0 + dir.x * (a + l / 2);
      const mz = z0 + dir.z * (a + l / 2);
      const g = new THREE.PlaneGeometry(l, H);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (l / 0.12), uv.getY(i) * (H / 0.12));
      const m = new THREE.Mesh(g, link);
      m.position.set(mx, CURB + H / 2, mz);
      m.rotation.y = Math.atan2(-dir.z, dir.x);
      root.add(m);
      B.collider(mx, CURB + H / 2, mz, l, H + 1.5, 0.1, Math.atan2(-dir.z, dir.x));
      for (let s = a; s <= b + 0.01; s += 3) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, H + 0.1, 6), post);
        p.position.set(x0 + dir.x * s, CURB + H / 2, z0 + dir.z * s);
        B.mesh(p);
      }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, l, 6), post);
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = Math.atan2(-dir.z, dir.x);
      rail.position.set(mx, CURB + H, mz);
      B.mesh(rail);
    }
  };
  const { x0, x1, z0, z1 } = BOUNDS;
  const elmGap = (zEdge) => [ELM.x - ELM.half - 2.6 - x0, ELM.x + ELM.half + 2.6 - x0];
  run(x0, z0, x1, z0, [elmGap(z0)]);
  run(x0, z1, x1, z1, [elmGap(z1)]);
  run(x0, z0, x0, z1);
  run(x1, z0, x1, z1);
  // ROAD CLOSED barricades across Elm Ave at both ends (solid: a real barrier).
  for (const zz of [z0 + 1, z1 - 1]) {
    for (let x = ELM.x - ELM.half - 2.4; x <= ELM.x + ELM.half + 2.4; x += 1.25) {
      B.model('roads', 'construction-barrier', { x, y: x > ELM.x - ELM.half && x < ELM.x + ELM.half ? 0 : CURB, z: zz, rotY: Math.PI / 2, collide: [1.3, 2.5, 0.4] });
    }
    for (let i = 0; i < 5; i++) B.model('roads', 'construction-cone', { x: ELM.x - 3 + i * 1.5, y: 0, z: zz + Math.sign(-zz) * 2.5, collide: 'none' });
    const tex = canvasTexture('road-closed', 256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#f3f3ee';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 50px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROAD', w / 2, 58);
      ctx.fillText('CLOSED', w / 2, 108);
    });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
    s.position.set(ELM.x, 1.6, zz);
    root.add(s);
  }
  void rng;
}

let _winDark = null;
function WINDOW_DARK() {
  if (!_winDark) _winDark = new THREE.MeshStandardMaterial({ color: 0x1b2229, roughness: 0.08, metalness: 0.4, envMapIntensity: 1.3 });
  return _winDark;
}

// ShapeGeometry helpers (rotated ground plane).
function flipFaces(g) {
  const idx = g.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    idx.needsUpdate = true;
  }
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  n.needsUpdate = true;
}

function worldUVGround(g, tile) {
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / tile;
    uv[i * 2 + 1] = p.getZ(i) / tile;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export { FLOOR_Y };
