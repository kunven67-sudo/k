// The three hometown stores (master list §14): Walmort (grocery), Best Bye (electronics) and
// IKEO (furniture). Real buildings with storefront glass, sliding doors, a facade sign, bright
// store lighting, stocked shelves (one InstancedMesh per product), coolers, produce tables,
// checkouts, a TV wall, locked cases and furniture showrooms.
//
//   const stores = buildStores(world, B, root)
//   stores.grocery.slots -> [{ product, count, box, take() }]
//   stores.grocery.registers -> [{ customer: Vector3, cashier: Vector3, yaw }]
//   stores.update(dt, viewer, clock)  // doors, TV wall

import * as THREE from 'three';
import { mat } from '../gfx/materials.js';
import { canvasTexture } from '../gfx/textures.js';
import { packageMesh } from './packaging.js';
import { byStore, PRODUCT } from '../life/products.js';
import { CURB, STORES } from './layout.js';
import { Rng } from '../core/rng.js';
import { audio } from '../core/audio.js';
import { fitOut } from './storefit.js';
import { cartRow, basketStack } from './cart.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const H = 5.6; // wall height
const FY = CURB + 0.02; // store floor

export function buildStores(world, B, root) {
  const out = {};
  for (const def of Object.values(STORES)) out[def.id] = buildStore(world, B, root, def);
  const doors = Object.values(out).flatMap((s) => s.doors);
  const tvs = Object.values(out).flatMap((s) => s.tvs || []);
  out.update = (dt, viewer, clock) => {
    for (const s of Object.values(out)) {
      if (!s.def) continue;
      const h = clock.hourFloat;
      s.isOpen = h >= s.def.open && h < s.def.close;
      // Shelves full of products only draw when you're inside or right outside the glass
      // (thousands of cans + bottles through the windows from the parking lot = lag).
      const d = s.def;
      const inside = viewer.x > d.x0 - 0.5 && viewer.x < d.x1 && viewer.z > d.z0 && viewer.z < d.z1;
      const show = inside || (viewer.x < d.x0 + 1 && s.entrance.distanceTo(viewer) < 24);
      if (show !== s._shown) {
        s._shown = show;
        for (const im of s.productMeshes || []) im.visible = show;
      }
    }
    for (const d of doors) {
      const st = d.store;
      const near = st.isOpen && (d.center.distanceTo(viewer) < 3.2 || (world.npcNearDoor?.(d.center, 3) ?? false));
      const target = near ? 1 : 0;
      if (Math.abs(d.open - target) > 0.001) {
        if (target === 1 && d.open < 0.05) audio.play?.('door.slide', { position: d.center, gain: 0.5 });
        d.open += Math.sign(target - d.open) * Math.min(Math.abs(target - d.open), dt * 2.2);
        d.left.position.z = d.center.z - d.w / 4 - d.open * (d.w / 2 - 0.05);
        d.right.position.z = d.center.z + d.w / 4 + d.open * (d.w / 2 - 0.05);
        d.collider.setEnabled(d.open < 0.6);
      }
    }
    for (const t of tvs) if (t.store?._shown !== false) t.update(dt);
  };
  return out;
}

function buildStore(world, B, root, def) {
  const rng = new Rng(def.id.length * 31);
  const { x0, x1, z0, z1 } = def;
  const W = z1 - z0;
  const zc = (z0 + z1) / 2;
  const S = { def, slots: [], registers: [], doors: [], tvs: [], isOpen: true, id: def.id, name: def.name };
  const style = {
    grocery: { ext: mat('stucco', { color: 0xd8cdb8, dirt: 0.3 }), band: mat('metal-painted', { color: 0x1a5fb4, wear: 0.1 }), sign: ['#1a5fb4', '#ffc220'], floor: mat('tile-floor', { color: 0xe9e7e2, count: 2, grout: 0xc9c6c0 }) },
    electronics: { ext: mat('metal-painted', { color: 0x1d3c78, wear: 0.15, dirt: 0.2 }), band: mat('metal-painted', { color: 0x0e2550, wear: 0.1 }), sign: ['#0a2a66', '#ffe000'], floor: mat('tile-floor', { color: 0x9a9da3, count: 2, grout: 0x777a80 }) },
    furniture: { ext: mat('metal-painted', { color: 0x0058a3, wear: 0.1, dirt: 0.15 }), band: mat('metal-painted', { color: 0xffda1a, wear: 0.05 }), sign: ['#0058a3', '#ffda1a'], floor: polished(mat('concrete', { wear: 0.15, dirt: 0.15 }), 0.38) },
  }[def.id];
  const inner = mat('paint', { color: def.id === 'electronics' ? 0x2b2e35 : 0xf2f0ea });
  const block = mat('concrete', { wear: 0.4, dirt: 0.5 });
  const trim = mat('metal-painted', { color: 0x2f3237, wear: 0.1 });

  // ---------------------------------------------------------------- shell
  const doorZ = zc;
  const doorW = 2.6;
  // Front wall (x = x0, runs along +z: matA is the -x side = outside): storefront glass.
  const glassH = 3.2;
  B.wall(x0, z0, x0, z1, { y: 0, h: H, t: 0.3, matA: style.ext, matB: inner, matEdge: trim, openings: [{ at: doorZ - z0, w: doorW + 1.2, h: glassH, sill: FY }, { at: (doorZ - z0) / 2, w: (doorZ - z0) - 4, h: glassH - 0.5, sill: 0.6 }, { at: (doorZ - z0) + (z1 - doorZ) / 2, w: (z1 - doorZ) - 4, h: glassH - 0.5, sill: 0.6 }] });
  B.wall(x1, z0, x1, z1, { y: 0, h: H, t: 0.3, matA: inner, matB: block, matEdge: trim });
  B.wall(x0, z0, x1, z0, { y: 0, h: H, t: 0.3, matA: inner, matB: block, matEdge: trim });
  B.wall(x0, z1, x1, z1, { y: 0, h: H, t: 0.3, matA: block, matB: inner, matEdge: trim });
  // Facade band + parapet + roof.
  B.box(x0 - 0.2, H - 0.6, zc, 0.12, 1.4, W + 0.4, style.band, { collide: false });
  B.box((x0 + x1) / 2, H + 0.05, zc, x1 - x0 + 0.3, 0.1, W + 0.3, block, { collide: false });
  // Floor (polished: real store floors shine), then the ceiling, lights and wall trim.
  B.slab(x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, FY, style.floor, { thick: 0.1 });
  const decorFrom = root.children.length; // everything added from here on hides with the shelves when you're far away
  fitOut(B, root, def);
  // Storefront glass panes + mullions.
  const glass = mat('glass', { dirt: 0.15 });
  const pane = (zA, zB, y0, y1) => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(zB - zA, y1 - y0), glass);
    g.rotation.y = -Math.PI / 2;
    g.position.set(x0, (y0 + y1) / 2, (zA + zB) / 2);
    g.renderOrder = 2;
    root.add(g);
    B.collider(x0, (y0 + y1) / 2, (zA + zB) / 2, 0.06, y1 - y0, zB - zA);
    for (let z = zA; z <= zB + 0.01; z += 2) B.box(x0, (y0 + y1) / 2, Math.min(z, zB), 0.12, y1 - y0, 0.08, trim, { collide: false });
  };
  pane(z0 + 2, doorZ - 2, 0.6, glassH + 0.1);
  pane(doorZ + 2, z1 - 2, 0.6, glassH + 0.1);
  // Sliding entrance doors (two glass leaves).
  const dGlass = mat('glass', { dirt: 0.05 });
  const frame = trim;
  const leaf = () => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, glassH - 0.2, doorW / 2), dGlass);
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, glassH - 0.2, 0.06), frame);
    f1.position.z = doorW / 4 - 0.03;
    const f2 = f1.clone();
    f2.position.z = -doorW / 4 + 0.03;
    g.add(p, f1, f2);
    g.position.set(x0, FY + (glassH - 0.2) / 2, doorZ);
    root.add(g);
    return g;
  };
  const left = leaf();
  const right = leaf();
  left.position.z = doorZ - doorW / 4;
  right.position.z = doorZ + doorW / 4;
  const dcol = world.physics.addStaticBox({ x: x0, y: FY + 1.5, z: doorZ }, { x: 0.1, y: 3, z: doorW }, null);
  S.doors.push({ store: S, center: new THREE.Vector3(x0, FY + 1, doorZ), w: doorW, left, right, open: 0, collider: dcol });
  // Glass above + beside the doors.
  B.box(x0, FY + glassH + 0.05, doorZ, 0.14, 0.2, doorW + 1.2, frame, { collide: false });
  // Entrance canopy outside.
  B.box(x0 - 1.4, glassH + 0.6, doorZ, 2.8, 0.25, doorW + 3, style.band, { collide: false });
  // Sign.
  signBox(root, x0 - 0.3, H - 0.6, zc, def, style.sign);
  // Hours sign by the door.
  hoursSign(root, x0 - 0.04, FY + 1.5, doorZ + doorW / 2 + 0.9, def);

  // Store room for lighting/footsteps.
  const room = { id: `store-${def.id}`, name: def.name, kind: 'store', store: S, box: new THREE.Box3(new THREE.Vector3(x0, -0.5, z0), new THREE.Vector3(x1, H, z1)), surface: def.id === 'furniture' ? 'concrete' : 'tile', lighting: 'store', lightOn: true };
  S.room = room;
  world.rooms.push(room);

  // ---------------------------------------------------------------- contents
  const ctx = { world, B, root, S, rng };
  if (def.id === 'grocery') groceryLayout(ctx, def);
  else if (def.id === 'electronics') electronicsLayout(ctx, def);
  else furnitureLayout(ctx, def);
  // Instanced product meshes (one per product).
  finishInstances(ctx);
  finishTags(S, root);
  // Registers.
  for (const r of S.registers) register(ctx, r);
  const decor = root.children.slice(decorFrom).filter((o) => !(S.productMeshes || []).includes(o));
  (S.productMeshes ||= []).push(...decor);
  S.entrance = new THREE.Vector3(x0 + 2.5, FY, doorZ);
  S.outside = new THREE.Vector3(x0 - 2.5, CURB, doorZ);
  return S;
}

// ------------------------------------------------------------------------------------- layouts

function groceryLayout(ctx, def) {
  const { B, S } = ctx;
  const { x0, x1, z0, z1 } = def;
  const zc = (z0 + z1) / 2;
  // Checkouts: lanes south of the entrance, belts running along x.
  for (const dz of [-3.2, -6.8, -10.4]) S.registers.push({ x: x0 + 5, z: zc + dz, yaw: 0 });
  // Produce tables north of the entrance.
  const produce = byStore('grocery').filter((p) => p.aisle === 'Produce');
  const tables = [];
  for (let i = 0; i < 4; i++) tables.push({ x: x0 + 3.5 + (i % 2) * 3.2, z: zc + 4.5 + Math.floor(i / 2) * 3.2 });
  // Each table holds 4 crates; every crate gets a product (the popular ones twice).
  for (let k = 0; k < 16; k++) produceTable(ctx, tables[Math.floor(k / 4)], produce[k % produce.length], k % 2, Math.floor(k / 2) % 2);
  const stand = mat('wood', { color: 0x8a6544, varnish: 0.4, wear: 0.3 });
  const base = mat('rubber', { color: 0x1e1f21 });
  for (const t of tables) {
    B.box(t.x, FY + 0.43, t.z, 2.4, 0.66, 1.6, [stand, stand, stand, null, stand, stand], {});
    B.box(t.x, FY + 0.05, t.z, 2.3, 0.1, 1.5, base, { collide: false, shadow: false });
  }
  // Bakery display near produce.
  const bakery = byStore('grocery').filter((p) => p.aisle === 'Bakery');
  wallRun(ctx, { x: x0 + 11, z: z1 - 0.25 }, { x: x0 + 1.2, z: z1 - 0.25 }, Math.PI, bakery, { levels: [0.15, 0.6, 1.05, 1.5] });
  // Aisles: 4 double gondolas along x.
  const aisles = ['Snacks', 'Cereal & Breakfast', 'Drinks', 'Household'];
  const gz = [z0 + 4.5, z0 + 9.3, z0 + 14.1, z0 + 18.9];
  const ax0 = x0 + 12;
  const ax1 = x1 - 6;
  gz.forEach((z, i) => {
    const list = byStore('grocery').filter((p) => p.aisle === aisles[i] && !p.age);
    gondola(ctx, ax0, ax1, z, list, aisles[i]);
  });
  // South wall shelf: more drinks (cases, big stuff on the bottom).
  const drinks = byStore('grocery').filter((p) => p.aisle === 'Drinks');
  wallRun(ctx, { x: ax0, z: z0 + 0.25 }, { x: ax1, z: z0 + 0.25 }, 0, drinks);
  // Back wall coolers: dairy, frozen, beer (21+).
  const cold = byStore('grocery').filter((p) => p.aisle === 'Dairy' || p.aisle === 'Frozen' || p.age);
  coolerRun(ctx, x1 - 0.8, z0 + 1.5, z1 - 1.5, cold);
  // Basket stack + carts by the door.
  ctx.S.baskets = new THREE.Vector3(x0 + 1.5, FY, zc - 2.2);
  basketStack(ctx.root, x0 + 1.5, FY, zc - 2.2, 5);
  B.collider(x0 + 1.5, FY + 0.3, zc - 2.2, 0.5, 0.6, 0.4);
  cartRow(ctx.root, [0, 1, 2, 3, 4].map((i) => ({ x: x0 + 1.0 + i * 0.3, y: FY, z: zc + 2.4, rotY: Math.PI })));
  B.collider(x0 + 1.6, FY + 0.5, zc + 2.4, 2.1, 1.0, 0.6);
  aisleSigns(ctx, gz.map((z, i) => ({ x: (ax0 + ax1) / 2, z: z + 2.4, text: aisles[i] })));
}

function electronicsLayout(ctx, def) {
  const { B, S, root } = ctx;
  const { x0, x1, z0, z1 } = def;
  const zc = (z0 + z1) / 2;
  S.registers.push({ x: x0 + 4.5, z: zc - 3.5, yaw: 0 }, { x: x0 + 4.5, z: zc - 7, yaw: 0 });
  // TV wall on the back: real screens playing a demo loop.
  const tvs = byStore('electronics').filter((p) => p.aisle === 'TVs');
  const wallX = x1 - 0.35;
  let z = z0 + 2.2;
  for (let i = 0; i < 7; i++) {
    const p = tvs[i % tvs.length];
    const [w, h] = [p.pack.size[0] * 0.95, p.pack.size[1] * 0.8];
    const tv = demoScreen(root, wallX, FY + 1.7 + (i % 2) * 0.2, z + w / 2, w, h, -Math.PI / 2, i);
    tv.store = S;
    S.tvs.push(tv);
    priceTag(root, wallX - 0.05, FY + 0.95, z + w / 2, -Math.PI / 2, p);
    z += w + 0.45;
  }
  // TV boxes on a low shelf under the wall.
  wallRun(ctx, { x: x1 - 0.45, z: z0 + 1.5 }, { x: x1 - 0.45, z: z1 - 1.5 }, -Math.PI / 2, tvs, { levels: [0.12], depthRows: 1 });
  // Gaming + computers + audio gondolas.
  const gz = [z0 + 5, z0 + 9.5, z0 + 14];
  const aisles = [['Gaming'], ['Computers', 'Phones & Audio'], ['PC Parts']];
  gz.forEach((zz, i) => {
    const list = byStore('electronics').filter((p) => aisles[i].includes(p.aisle));
    gondola(ctx, x0 + 9, x1 - 4, zz, list, aisles[i][0], { locked: i === 2, endcaps: ['w'] });
  });
  aisleSigns(ctx, gz.map((zz, i) => ({ x: (x0 + 9 + x1 - 4) / 2, z: zz + 2.25, text: aisles[i].join(' + ') })));
  // Blue shirt service desk near the door.
  B.box(x0 + 3, FY + 0.5, z1 - 3, 2.4, 1.0, 0.8, [mat('metal-painted', { color: 0x0e2550 }), mat('metal-painted', { color: 0x0e2550 }), null, null, mat('metal-painted', { color: 0x0e2550 }), mat('metal-painted', { color: 0x0e2550 })], {});
  B.box(x0 + 3, FY + 1.015, z1 - 3, 2.5, 0.03, 0.9, mat('plastic', { color: 0x2b2d31 }), { collide: false });
  B.box(x0 + 3, FY + 0.6, z1 - 3.41, 2.4, 0.06, 0.02, mat('plastic', { color: 0xffe000 }), { collide: false, shadow: false });
  posScreen(root, x0 + 2.4, FY + 1.25, z1 - 2.85, 0);
  posScreen(root, x0 + 3.6, FY + 1.25, z1 - 2.85, 0);
  S.serviceDesk = new THREE.Vector3(x0 + 3, FY, z1 - 2.2);
}

function furnitureLayout(ctx, def) {
  const { B, S } = ctx;
  const { x0, x1, z0, z1 } = def;
  const zc = (z0 + z1) / 2;
  S.registers.push({ x: x0 + 4.5, z: zc - 3.5, yaw: 0 }, { x: x0 + 4.5, z: zc - 7, yaw: 0 });
  // Showroom vignettes: low partition walls + furniture with price tags. Buying big items =
  // order at the register for delivery (a real kid can't carry a sofa home).
  const part = mat('paint', { color: 0xf5f2ea });
  // Room sets laid out like real ones. Each item: lx = across the room (side wall at +3),
  // ld = distance out from the back wall, face = which way its front points, y = sits on top
  // of something. s = +1: back wall on the -z side; s = -1: back wall on the +z side (the room
  // opens toward the middle walkway either way).
  const rooms = [
    { x: x0 + 12, z: z0 + 4, s: 1, items: [
      { id: 'bed-single', lx: -0.6, ld: 1.0, face: 'out' },
      { id: 'nightstand', lx: 0.25, ld: 0.26, face: 'out' },
      { id: 'desk-lamp', lx: 0.25, ld: 0.26, face: 'out', y: 0.41 },
      { id: 'rug-round', lx: -0.6, ld: 2.45, face: 'out', rug: true },
      { id: 'dresser-low', lx: 2.7, ld: 2.4, face: 'west' },
    ] },
    { x: x0 + 20, z: z0 + 4, s: 1, items: [
      { id: 'sofa', lx: -0.4, ld: 0.58, face: 'out' },
      { id: 'rug', lx: -0.4, ld: 2.05, face: 'east', rug: true },
      { id: 'coffee-table', lx: -0.4, ld: 2.05, face: 'out' },
      { id: 'floor-lamp', lx: 1.15, ld: 0.3, face: 'out' },
      { id: 'plant-big', lx: 2.65, ld: 0.35, face: 'out' },
    ] },
    { x: x0 + 12, z: z1 - 5, s: -1, items: [
      { id: 'bed-bunk', lx: -1.85, ld: 1.03, face: 'out' },
      { id: 'dresser', lx: 0.9, ld: 0.3, face: 'out' },
      { id: 'plant-small', lx: 1.35, ld: 0.3, face: 'out', y: 1.03 },
      { id: 'shelf-small', lx: 2.84, ld: 2.4, face: 'west', y: 1.35 },
    ] },
    { x: x0 + 20, z: z1 - 5, s: -1, items: [
      { id: 'desk', lx: -0.6, ld: 0.41, face: 'out' },
      { id: 'gaming-chair', lx: -0.6, ld: 1.2, face: 'in' },
      { id: 'bookshelf', lx: 2.79, ld: 1.3, face: 'west' },
      { id: 'chair', lx: 1.2, ld: 2.9, face: 'west' },
      { id: 'stool', lx: -2.3, ld: 0.4, face: 'out' },
    ] },
    // A small studio apartment set (IKEO loves those): corner sofa, king bed, curtains.
    { x: x0 + 23, z: zc, s: 1, items: [
      { id: 'sofa-l', lx: -1.5, ld: 1.1, face: 'out' },
      { id: 'curtains', lx: -1.5, ld: 0.13, face: 'out' },
      { id: 'bed-king', lx: 1.99, ld: 1.12, face: 'west' },
      { id: 'armchair', lx: 0.4, ld: 3.7, face: 'in' },
    ] },
  ];
  // Every room set gets its own wall finish + floor, like a real showroom.
  const looks = [
    { wall: mat('wallpaper', { color: 0xd9e2e6, color2: 0xb8c7cf, pattern: 'stripe', wear: 0.02, dirt: 0.02 }), floor: mat('wood-floor', { color: 0xd8b48a, wear: 0.03 }) },
    { wall: mat('paint', { color: 0x5f7a6a, dirt: 0.02 }), floor: mat('wood-floor', { color: 0x9a6b45, wear: 0.03 }) },
    { wall: mat('paint', { color: 0xe8c9a8, dirt: 0.02 }), floor: mat('carpet', { color: 0x8c96a3 }) },
    { wall: mat('paint', { color: 0x30384a, dirt: 0.02 }), floor: mat('wood-floor', { color: 0x6e4d33, wear: 0.03 }) },
    { wall: mat('wallpaper', { color: 0xefe6d6, color2: 0xd8c8ae, pattern: 'damask', wear: 0.02, dirt: 0.02 }), floor: mat('wood-floor', { color: 0xc49a6c, wear: 0.05 }) },
  ];
  const cord = mat('rubber', { color: 0x111111 });
  const shade = mat('metal-painted', { color: 0x222326, wear: 0.05 }).clone();
  shade.side = THREE.DoubleSide;
  const bulb = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffe2b0, emissiveIntensity: 2.2 });
  const tagPole = mat('steel', { wear: 0.1 });
  rooms.forEach((r, ri) => {
    const look = looks[ri % looks.length];
    const s = r.s;
    const bz = r.z - s * 2.6; // back wall line
    // Two partition walls make an open-sided "room": room side finished, back side plain.
    const backFaces = s > 0 ? [part, part, part, null, look.wall, part] : [part, part, part, null, part, look.wall];
    B.box(r.x, FY + 1.2, bz, 6, 2.4, 0.1, backFaces, {});
    B.box(r.x + 3, FY + 1.2, r.z, 0.1, 2.4, 5.2, [part, look.wall, part, null, part, part], {});
    B.box(r.x, FY + 0.005, r.z, 6, 0.01, 5.2, look.floor, { collide: false, shadow: false });
    // Baseboard along the finished walls.
    B.box(r.x, FY + 0.05, bz + s * 0.06, 5.9, 0.1, 0.02, part, { collide: false, shadow: false });
    B.box(r.x + 2.94, FY + 0.05, r.z, 0.02, 0.1, 5.1, part, { collide: false, shadow: false });
    // Pendant lamp hanging over the room set.
    B.box(r.x, (FY + 2.6 + H) / 2, r.z, 0.012, H - FY - 2.6, 0.012, cord, { collide: false, shadow: false });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.32, 0.3, 18, 1, true), shade);
    lamp.position.set(r.x, FY + 2.45, r.z);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), bulb);
    glow.position.set(r.x, FY + 2.36, r.z);
    ctx.root.add(lamp, glow);
    const outYaw = s > 0 ? 0 : Math.PI;
    const yawOf = { out: outYaw, in: outYaw + Math.PI, west: -Math.PI / 2, east: Math.PI / 2 };
    for (const it of r.items) {
      const p = PRODUCT[it.id];
      if (!p) continue;
      const px = r.x + it.lx;
      const pz = bz + s * it.ld;
      const yaw = yawOf[it.face];
      const py = FY + (it.y || 0) + (it.rug ? 0.008 : 0);
      if (p.pack.shape === 'model') B.model(p.pack.kit, p.pack.model, { x: px, y: py, z: pz, rotY: yaw, collide: it.rug || it.y ? 'none' : 'box' });
      const [w, h, d] = p.pack.size;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const ext = it.face === 'west' || it.face === 'east' ? [d, w] : [w, d];
      // Yellow price tag on a little floor stand at the front corner of the item.
      if (!it.y && !it.rug) {
        // f = the item's front, (fz, -fx) = its right hand side.
        const tagX = px + fx * (d / 2 + 0.18) + fz * Math.max(0, w / 2 - 0.15);
        const tagZ = pz + fz * (d / 2 + 0.18) - fx * Math.max(0, w / 2 - 0.15);
        B.box(tagX, FY + 0.38, tagZ, 0.025, 0.76, 0.025, tagPole, { collide: false, shadow: false });
        priceTag(ctx.root, tagX + fx * 0.02, FY + 0.88, tagZ + fz * 0.02, yaw, p, true);
      } else {
        priceTag(ctx.root, px + fx * (d / 2 + 0.02), py + Math.min(h, 0.3) + 0.12, pz + fz * (d / 2 + 0.02), yaw, p, true);
      }
      S.slots.push(makeSlot(ctx, p, { box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(px, py + Math.max(h, 0.3) / 2, pz), new THREE.Vector3(ext[0] + 0.2, Math.max(h, 0.3) + 0.1, ext[1] + 0.2)), display: true }));
    }
  });
  // The painted walkway with arrows that leads you through the showroom.
  const laneZ = Math.round(zc / 1.6 - 0.5) * 1.6 + 0.8; // lines up with the texture's edge lines
  B.box((x0 + 8 + x0 + 19.5) / 2, FY + 0.004, laneZ, 11.5, 0.006, 1.6, walkwayMat(), { collide: false, shadow: false });
  // Self-serve warehouse: tall racks of flat-pack boxes along the back.
  const rack = mat('metal-painted', { color: 0xf2a900, wear: 0.3 });
  let bay = 1;
  for (let z = z0 + 2; z < z1 - 2; z += 3.2) {
    B.box(x1 - 1.0, FY + 2, z, 1.6, 4, 0.08, rack, {});
    binSign(ctx.root, x1 - 1.82, FY + 2.0, z + 0.05, bay++);
    for (const y of [0.1, 1.4, 2.7]) {
      B.box(x1 - 1.0, FY + y, z + 1.6, 1.6, 0.06, 3.2, rack, { collide: false });
      for (let k = 0; k < 2; k++) {
        const bw = 0.5 + ((z * 7 + y * 3 + k) % 3) * 0.2;
        B.box(x1 - 1.0, FY + y + 0.03 + bw / 2, z + 0.8 + k * 1.5, 1.2, bw, 1.2, flatpackMat(), { collide: false });
      }
    }
  }
  // Small stuff on a wall run near the registers (things you can carry home).
  const small = byStore('furniture').filter((p) => !p.big);
  wallRun(ctx, { x: x0 + 8 + small.length * 1.0 + 1, z: z1 - 0.25 }, { x: x0 + 8, z: z1 - 0.25 }, Math.PI, small, { levels: [0.12, 0.8], depthRows: 1 });
  // The famous yellow bags + a hot dog stand sign would go here.
}

// ---------------------------------------------------------------------------------- shelving

/** Double-sided gondola running along x at z, stocked on both sides, with end caps. */
function gondola(ctx, xa, xb, z, products, label, opts = {}) {
  const { B } = ctx;
  const metal = mat('metal-painted', { color: 0xe8e8e8, wear: 0.15, dirt: 0.15 });
  const kick = mat('metal-painted', { color: 0x3a3d42, wear: 0.25, dirt: 0.3 });
  const strip = mat('plastic', { color: 0xc9ced4, wear: 0.1, dirt: 0.15 });
  const len = xb - xa;
  const cx = (xa + xb) / 2;
  const levels = [0.14, 0.55, 0.96, 1.37, 1.78];
  B.box(cx, FY + 1.05, z, len, 2.1, 0.06, pegboardMat(), {}); // pegboard back panel
  B.box(cx, FY + 0.07, z, len, 0.14, 1.2, [kick, kick, metal, null, kick, kick], { collide: false }); // base deck + kick plate
  B.collider(cx, FY + 1.05, z, len, 2.1, 1.1);
  for (const y of levels.slice(1)) for (const side of [-1, 1]) {
    B.box(cx, FY + y - 0.02, z + side * 0.3, len, 0.03, 0.56, metal, { collide: false, shadow: false });
    // Price channel on the shelf lip (the grey strip every price tag clips into).
    B.box(cx, FY + y - 0.035, z + side * 0.606, len, 0.045, 0.012, strip, { collide: false, shadow: false });
  }
  // Uprights every 1.2 m (real gondolas come in 4 ft sections), end panels.
  for (let x = xa + 1.2; x < xb - 0.3; x += 1.2) B.box(x, FY + 1.05, z, 0.04, 2.1, 0.1, metal, { collide: false, shadow: false });
  for (const xx of [xa, xb]) B.box(xx, FY + 1.05, z, 0.05, 2.1, 1.2, metal, { collide: false });
  // Overstock cases on top, like every real store.
  const rng = ctx.rng;
  const card = mat('cardboard', {});
  for (let x = xa + 0.5; x < xb - 0.5; x += 0.7 + rng.next() * 0.9) {
    if (rng.next() < 0.3) continue;
    const w = 0.35 + rng.next() * 0.3;
    const h = 0.2 + rng.next() * 0.25;
    const d = 0.3 + rng.next() * 0.35;
    B.box(x, FY + 2.1 + h / 2, z + (rng.next() - 0.5) * 0.4, w, h, d, card, { rotY: (rng.next() - 0.5) * 0.3, collide: false });
    if (rng.next() < 0.35) B.box(x, FY + 2.1 + h + 0.12, z, w * 0.9, 0.24, d * 0.9, card, { rotY: (rng.next() - 0.5) * 0.4, collide: false });
  }
  // Split products across the two sides.
  const half = Math.ceil(products.length / 2);
  stockRun(ctx, { x: xa, z: z - 0.04 }, { x: xb, z: z - 0.04 }, Math.PI, products.slice(0, half).length ? products.slice(0, half) : products, { levels, locked: opts.locked });
  stockRun(ctx, { x: xb, z: z + 0.04 }, { x: xa, z: z + 0.04 }, 0, products.slice(half).length ? products.slice(half) : products, { levels, locked: opts.locked });
  // End caps: a short shelf on each end with the aisle's featured items + a header card.
  for (const end of opts.endcaps || ['w', 'e']) {
    if (opts.locked || !products.length) break;
    const west = end === 'w';
    const ex = west ? xa - 0.03 : xb + 0.03;
    const yaw = west ? -Math.PI / 2 : Math.PI / 2;
    const featured = products.filter((_, i) => i % 3 === (west ? 0 : 1)).slice(0, 4);
    const a = { x: ex, z: west ? z + 0.58 : z - 0.58 };
    const b = { x: ex, z: west ? z - 0.58 : z + 0.58 };
    const ecLevels = [0.14, 0.62, 1.1, 1.58];
    const ox = ex + (west ? -0.21 : 0.21);
    for (const y of ecLevels) {
      B.box(ox, FY + y - 0.02, z, 0.42, 0.03, 1.16, metal, { collide: false, shadow: false });
      B.box(ex + (west ? -0.426 : 0.426), FY + y - 0.035, z, 0.012, 0.045, 1.16, strip, { collide: false, shadow: false });
    }
    B.box(ox, FY + 0.07, z, 0.42, 0.14, 1.16, [kick, kick, metal, null, kick, kick], { collide: false });
    for (const s of [-1, 1]) B.box(ox, FY + 1.05, z + s * 0.58, 0.42, 2.1, 0.03, metal, { collide: false, shadow: false });
    B.collider(ox, FY + 1.05, z, 0.42, 2.1, 1.18);
    stockRun(ctx, a, b, yaw, featured.length ? featured : products.slice(0, 3), { levels: ecLevels, depth: 0.42 });
    endcapHeader(ctx.root, ex + (west ? -0.2 : 0.2), FY + 2.3, z, yaw, label, ctx.S.def.id);
  }
}

/** The printed card on top of an end cap: aisle name + a deal banner in the store colours. */
function endcapHeader(root, x, y, z, yaw, label, storeId) {
  const [bg, fg] = { grocery: ['#1a5fb4', '#ffc220'], electronics: ['#0a2a66', '#ffe000'], furniture: ['#0058a3', '#ffda1a'] }[storeId];
  const deal = ['LOW PRICE', 'NEW!', 'HOT DEAL', 'SAVE NOW'][label.length % 4];
  const tex = canvasTexture(`endcap-${storeId}-${label}`, 512, 160, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = fg;
    c.fillRect(0, h * 0.62, w, h * 0.38);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#ffffff';
    let px = 56;
    do c.font = `bold ${px--}px Inter, Arial, sans-serif`;
    while (px > 20 && c.measureText(label.toUpperCase()).width > w - 36);
    c.fillText(label.toUpperCase(), w / 2, h * 0.32);
    c.fillStyle = bg;
    c.font = '900 42px Inter, Arial, sans-serif';
    c.fillText(deal, w / 2, h * 0.81);
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.375, 0.02), [edge, edge, edge, edge, face, edge]);
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  root.add(m);
}

/** Single-sided wall shelf; a->b is the back edge (against the wall), products face `yaw`. */
function wallRun(ctx, a, b, yaw, products, opts = {}) {
  const { B } = ctx;
  const metal = mat('metal-painted', { color: 0xe8e8e8, wear: 0.15, dirt: 0.15 });
  const levels = opts.levels || [0.14, 0.55, 0.96, 1.37, 1.78];
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const rot = Math.atan2(-(b.z - a.z), b.x - a.x);
  const n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const bx = (a.x + b.x) / 2;
  const bz = (a.z + b.z) / 2;
  const cx = bx + n.x * 0.28;
  const cz = bz + n.z * 0.28;
  for (const y of levels) B.box(cx, FY + y - 0.02, cz, len, 0.03, 0.56, metal, { rotY: rot, collide: false, shadow: false });
  const topY = levels[levels.length - 1] + 0.4;
  B.box(bx, FY + topY / 2, bz, len, topY, 0.04, metal, { rotY: rot });
  B.collider(cx, FY + topY / 2, cz, len, topY, 0.56, rot);
  stockRun(ctx, a, b, yaw, products, { levels, depthRows: opts.depthRows });
}

/** Glass-door coolers along the back wall (x fixed), facing -x. */
function coolerRun(ctx, x, za, zb, products) {
  const { B, root } = ctx;
  const body = mat('metal-painted', { color: 0x2b2e33, wear: 0.1 });
  const len = zb - za;
  const cz = (za + zb) / 2;
  B.box(x + 0.35, FY + 1.1, cz, 0.3, 2.2, len, body, {});
  B.box(x, FY + 2.15, cz, 1.0, 0.1, len, body, { collide: false });
  B.box(x, FY + 0.05, cz, 1.0, 0.1, len, body, { collide: false });
  B.collider(x, FY + 1.1, cz, 1.0, 2.2, len);
  const glow = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 1.2 });
  B.box(x + 0.19, FY + 1.1, cz, 0.02, 2.0, len, glow, { collide: false, shadow: false });
  const levels = [0.15, 0.6, 1.05, 1.5];
  for (const y of levels) B.box(x, FY + y - 0.02, cz, 0.6, 0.02, len, mat('steel', { wear: 0.1 }), { collide: false, shadow: false });
  stockRun(ctx, { x: x + 0.25, z: za }, { x: x + 0.25, z: zb }, -Math.PI / 2, products, { levels, depthRows: 2 });
  // Doors: glass panes with frames every 0.8 m.
  const g = mat('glass', { dirt: 0.02 });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.0), g);
  pane.position.set(x - 0.48, FY + 1.1, cz);
  pane.rotation.y = -Math.PI / 2;
  root.add(pane);
  for (let z = za; z <= zb + 0.01; z += 0.8) B.box(x - 0.48, FY + 1.1, z, 0.04, 2.0, 0.05, body, { collide: false, shadow: false });
  // Long pull handles on every door + the kick plate under the doors.
  const handle = mat('aluminum', { wear: 0.2, dirt: 0.1 });
  for (let z = za + 0.68; z < zb; z += 0.8) {
    B.box(x - 0.53, FY + 1.15, z, 0.025, 1.0, 0.025, handle, { collide: false, shadow: false });
    for (const dy of [-0.48, 0.48]) B.box(x - 0.505, FY + 1.15 + dy, z, 0.05, 0.02, 0.02, handle, { collide: false, shadow: false });
  }
  B.box(x - 0.49, FY + 0.06, cz, 0.03, 0.12, len, mat('steel', { wear: 0.3, dirt: 0.3 }), { collide: false, shadow: false });
}

/** One black produce crate on a display table, heaped with a product (a real mound, 2-3 layers). */
function produceTable(ctx, t, p, side, row) {
  const { B, rng } = ctx;
  const cx = t.x - 0.6 + side * 1.2;
  const cz = t.z - 0.4 + row * 0.8;
  const crate = mat('plastic', { color: 0x1d1f1c, wear: 0.2, dirt: 0.3 });
  const y0 = FY + 0.76;
  B.box(cx, y0 + 0.01, cz, 1.14, 0.02, 0.76, crate, { collide: false, shadow: false });
  for (const s of [-1, 1]) {
    B.box(cx + s * 0.56, y0 + 0.07, cz, 0.02, 0.14, 0.76, crate, { collide: false, shadow: false });
    B.box(cx, y0 + 0.07, cz + s * 0.37, 1.14, 0.14, 0.02, crate, { collide: false, shadow: false });
  }
  const [w, h, d] = p.pack.size;
  const sx = w * 1.04 + 0.004;
  const sz = d * 1.04 + 0.004;
  const cols = Math.max(1, Math.floor(1.06 / sx));
  const rows = Math.max(1, Math.floor(0.68 / sz));
  const list = [];
  for (let layer = 0; layer < 2 && list.length < 80; layer++) {
    const c = cols - layer;
    const r = rows - layer;
    if (c < 1 || r < 1 || (layer > 0 && c * r < 2)) break;
    for (let i = 0; i < c; i++)
      for (let j = 0; j < r; j++) {
        const x = cx - ((c - 1) * sx) / 2 + i * sx + (rng.next() - 0.5) * sx * 0.15;
        const z = cz - ((r - 1) * sz) / 2 + j * sz + (rng.next() - 0.5) * sz * 0.15;
        const rot = p.pack.shape === 'model' ? rng.range(0, 6.28) : (rng.next() - 0.5) * 0.4;
        list.push({ pos: new THREE.Vector3(x, y0 + 0.02 + layer * h * 0.72, z), rotY: rot });
      }
  }
  const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(cx, y0 + 0.2, cz), new THREE.Vector3(1.14, 0.4, 0.76));
  ctx.S.slots.push(makeSlot(ctx, p, { units: list, box }));
  priceTag(ctx.root, cx + (side ? 0.585 : -0.585), y0 + 0.07, cz, side ? Math.PI / 2 : -Math.PI / 2, p);
}

/** Fill a shelf run with product blocks (packed facings, restocked across levels). */
function stockRun(ctx, a, b, yaw, products, { levels, depthRows = 2, locked = false, depth = 0.56 } = {}) {
  if (!products.length) return;
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const dir = new THREE.Vector3((b.x - a.x) / len, 0, (b.z - a.z) / len);
  const n = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)); // facing out of the shelf
  // Heaviest/biggest products go on the bottom shelf.
  const sorted = [...products].sort((p, q) => q.pack.size[1] * q.pack.size[0] - p.pack.size[1] * p.pack.size[0]);
  let pi = 0;
  for (let li = 0; li < levels.length; li++) {
    let u = 0.05;
    const levelH = (levels[li + 1] ?? levels[li] + 0.45) - levels[li] - 0.04;
    while (u < len - 0.1) {
      const p = sorted[pi % sorted.length];
      pi++;
      const [w, h, d] = p.pack.size;
      // Too tall for this shelf? Skip it here.
      if (h > levelH && li < levels.length - 1) {
        if (sorted.every((q) => q.pack.size[1] > levelH)) break;
        continue;
      }
      const facings = Math.max(1, Math.min(10, Math.round(0.9 / Math.max(w, 0.06))));
      const blockW = Math.min(len - u - 0.02, facings * (w + 0.008));
      const fits = Math.max(1, Math.floor(blockW / (w + 0.008)));
      const units = [];
      const deep = Math.max(1, Math.min(depthRows, Math.floor((depth - 0.06) / Math.max(d, 0.05))));
      for (let k = 0; k < deep; k++) {
        for (let f = 0; f < fits; f++) {
          const along = u + f * (w + 0.008) + w / 2;
          // Front row at the shelf lip, more rows behind it.
          const out = depth - 0.04 - d / 2 - k * (d + 0.01);
          const pos = new THREE.Vector3(a.x + dir.x * along + n.x * out, FY + levels[li], a.z + dir.z * along + n.z * out);
          units.push({ pos, rotY: yaw });
        }
      }
      const mid = u + blockW / 2;
      const center = new THREE.Vector3(a.x + dir.x * mid + n.x * depth / 2, FY + levels[li] + h / 2, a.z + dir.z * mid + n.z * depth / 2);
      const box = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(Math.abs(dir.x) * blockW + Math.abs(n.x) * (depth - 0.01) + 0.02, h + 0.04, Math.abs(dir.z) * blockW + Math.abs(n.z) * (depth - 0.01) + 0.02));
      ctx.S.slots.push(makeSlot(ctx, p, { units, box, locked }));
      // Shelf price tag under the block.
      priceTag(ctx.root, a.x + dir.x * (u + 0.1) + n.x * (depth + 0.016), FY + levels[li] - 0.035, a.z + dir.z * (u + 0.1) + n.z * (depth + 0.016), yaw, p, false, true);
      u += blockW + 0.03;
    }
  }
}

function makeSlot(ctx, p, { units = [], box, locked = false, display = false }) {
  const slot = { product: p, units, count: units.length, max: units.length, box, locked, display, store: ctx.S, inst: null };
  for (const unit of units) unit.slot = slot;
  return slot;
}

/** After all slots are known: one InstancedMesh per product with every unit. */
function finishInstances(ctx) {
  const byP = new Map();
  for (const s of ctx.S.slots) {
    if (!s.units.length) continue;
    if (!byP.has(s.product.id)) byP.set(s.product.id, []);
    byP.get(s.product.id).push(s);
  }
  for (const [id, slots] of byP) {
    const p = PRODUCT[id];
    const { geometry, material } = packageMesh(p, 'low');
    const total = slots.reduce((n, s) => n + s.units.length, 0);
    const im = new THREE.InstancedMesh(geometry, material, total);
    im.castShadow = false;
    im.receiveShadow = true;
    let i = 0;
    for (const s of slots) {
      s.inst = im;
      for (const u of s.units) {
        u.index = i++;
        _q.setFromAxisAngle(UP, u.rotY);
        _m.compose(u.pos, _q, _s.set(1, 1, 1));
        im.setMatrixAt(u.index, _m);
      }
    }
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    ctx.root.add(im);
    (ctx.S.productMeshes ||= []).push(im);
  }
}

/** Hide/show one unit of a slot (taking from / putting back on the shelf). */
export function setUnitVisible(slot, unit, visible) {
  if (!slot.inst) return;
  _q.setFromAxisAngle(UP, unit.rotY);
  _m.compose(unit.pos, _q, _s.setScalar(visible ? 1 : 0));
  slot.inst.setMatrixAt(unit.index, _m);
  slot.inst.instanceMatrix.needsUpdate = true;
}

// --------------------------------------------------------------------------------- bits

/**
 * A real checkout lane along x: you walk in from the back (+x) on the +z side, unload onto the
 * belt (grocery), the cashier scans on the -z side, bags go on the carousel at the front (-x).
 */
function register(ctx, r) {
  const { B, root, S } = ctx;
  const grocery = S.def.id === 'grocery';
  const lane = S.registers.indexOf(r) + 1;
  const [colA] = { grocery: [0x1a5fb4], electronics: [0x0e2550], furniture: [0x0058a3] }[S.def.id];
  const panel = mat('plastic', { color: colA, wear: 0.15, dirt: 0.2 });
  const kick = mat('rubber', { color: 0x222225 });
  const top = mat('steel', { wear: 0.25, dirt: 0.1 });
  const dark = mat('plastic', { color: 0x1b1c1f, wear: 0.1 });
  const xa = r.x - 1.0;
  const xb = r.x + 1.6;
  const cx = (xa + xb) / 2;
  const cz = r.z;
  // Counter body: coloured panels, black kick base, brushed steel top.
  B.box(cx, FY + 0.47, cz, xb - xa, 0.82, 0.76, [panel, panel, null, null, panel, panel], { collide: false });
  B.box(cx, FY + 0.04, cz, xb - xa - 0.04, 0.08, 0.72, kick, { collide: false, shadow: false });
  B.box(cx, FY + 0.895, cz, xb - xa + 0.04, 0.03, 0.8, top, { collide: false });
  B.collider(cx, FY + 0.45, cz, xb - xa, 0.9, 0.8);
  if (grocery) {
    // Conveyor belt with aluminium side rails + a divider bar lying on it.
    B.box(r.x + 0.85, FY + 0.915, cz + 0.02, 1.4, 0.015, 0.48, mat('rubber', { color: 0x161617 }), { collide: false, shadow: false });
    for (const s of [-1, 1]) B.box(r.x + 0.85, FY + 0.93, cz + 0.02 + s * 0.27, 1.44, 0.04, 0.04, mat('aluminum', { wear: 0.2 }), { collide: false, shadow: false });
    B.box(r.x + 1.15, FY + 0.95, cz + 0.02, 0.04, 0.04, 0.42, mat('plastic', { color: 0x2a6fd0 }), { collide: false, shadow: false });
  }
  // Flatbed scanner: dark glass with the red laser line glowing through it.
  B.box(r.x - 0.05, FY + 0.912, cz - 0.05, 0.36, 0.006, 0.34, mat('glass', { color: 0x10161a, tint: 0.9 }), { collide: false, shadow: false });
  B.box(r.x - 0.05, FY + 0.916, cz - 0.05, 0.3, 0.002, 0.012, new THREE.MeshBasicMaterial({ color: 0xff2a1a }), { collide: false, shadow: false });
  B.box(r.x - 0.05, FY + 1.05, cz - 0.27, 0.32, 0.28, 0.06, dark, { collide: false });
  // Cash drawer + POS screen facing the cashier.
  B.box(r.x - 0.55, FY + 0.82, cz - 0.42, 0.42, 0.12, 0.12, dark, { collide: false, shadow: false });
  B.box(r.x - 0.55, FY + 1.05, cz - 0.2, 0.03, 0.3, 0.03, mat('aluminum', {}), { collide: false, shadow: false });
  posScreen(root, r.x - 0.55, FY + 1.28, cz - 0.2, -Math.PI);
  // Card reader on a stalk on the customer side.
  B.box(r.x - 0.35, FY + 1.0, cz + 0.33, 0.03, 0.2, 0.03, mat('aluminum', {}), { collide: false, shadow: false });
  B.box(r.x - 0.35, FY + 1.13, cz + 0.33, 0.1, 0.16, 0.05, dark, { rotY: 0, collide: false, shadow: false });
  B.box(r.x - 0.35, FY + 1.15, cz + 0.358, 0.07, 0.07, 0.002, new THREE.MeshBasicMaterial({ color: 0x5fb8ff }), { collide: false, shadow: false });
  // Bagging carousel (grocery) / bag hooks.
  const pole = mat('steel', { wear: 0.1 });
  B.box(xa + 0.3, FY + 1.1, cz, 0.04, 0.4, 0.04, pole, { collide: false, shadow: false });
  const bag = mat('plastic', { color: 0xf2f2ef, wear: 0 });
  for (let k = 0; k < (grocery ? 3 : 1); k++) {
    const a = (k / 3) * Math.PI * 2;
    B.box(xa + 0.3 + Math.cos(a) * 0.17, FY + 1.06, cz + Math.sin(a) * 0.17, 0.26, 0.3, 0.2, bag, { rotY: -a, collide: false, shadow: false });
  }
  // Lane light pole with the lit lane number at the back end.
  B.box(xb - 0.06, FY + 1.6, cz - 0.32, 0.05, 1.4, 0.05, pole, { collide: false, shadow: false });
  laneLight(root, xb - 0.06, FY + 2.45, cz - 0.32, lane, S.def.id);
  r.customer = new THREE.Vector3(r.x - 0.2, FY, r.z + 1.0);
  r.cashier = new THREE.Vector3(r.x - 0.2, FY, r.z - 0.95);
  r.laneBack = new THREE.Vector3(xb + 1.0, FY, r.z + 1.0);
  r.laneFront = new THREE.Vector3(xa - 0.6, FY, r.z + 1.0);
  r.box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(r.x - 0.1, FY + 0.9, r.z + 0.2), new THREE.Vector3(1.6, 0.8, 1.2));
  r.store = S;
}

function posScreen(root, x, y, z, yaw) {
  const tex = canvasTexture('pos-screen', 256, 192, (c, w, h) => {
    c.fillStyle = '#eef2f6';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1a5fb4';
    c.fillRect(0, 0, w, 26);
    c.fillStyle = '#fff';
    c.font = 'bold 15px Inter, Arial';
    c.fillText('REGISTER OPEN', 10, 18);
    c.fillStyle = '#333';
    c.font = '13px Inter, Arial';
    for (let i = 0; i < 5; i++) c.fillRect(10, 40 + i * 18, 120 + ((i * 37) % 50), 7);
    const keys = ['#2e7d32', '#c62828', '#f9a825', '#1565c0'];
    for (let i = 0; i < 8; i++) {
      c.fillStyle = keys[i % 4];
      c.fillRect(150 + (i % 2) * 50, 36 + Math.floor(i / 2) * 36, 44, 30);
    }
    c.fillStyle = '#111';
    c.font = 'bold 22px Inter, Arial';
    c.fillText('TOTAL  $0.00', 10, 178);
  });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.04), new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.5 }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scr.position.z = 0.021;
  g.add(body, scr);
  g.position.set(x, y, z);
  g.rotation.set(-0.25, yaw, 0, 'YXZ');
  root.add(g);
}

function laneLight(root, x, y, z, n, storeId) {
  const bg = { grocery: '#1a5fb4', electronics: '#0a2a66', furniture: '#0058a3' }[storeId];
  const tex = canvasTexture(`lane-${storeId}-${n}`, 128, 128, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '900 92px Inter, Arial';
    c.fillText(String(n), w / 2, h / 2 + 4);
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6, roughness: 0.5 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 20), [face, new THREE.MeshStandardMaterial({ color: 0x222222 }), new THREE.MeshStandardMaterial({ color: 0x222222 })]);
  m.position.set(x, y, z);
  root.add(m);
}

function aisleSigns(ctx, list) {
  for (const a of list) {
    const tex = canvasTexture(`aisle-${a.text}`, 512, 96, (c, w, h) => {
      c.fillStyle = '#1a5fb4';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff';
      c.font = 'bold 54px Inter, Arial, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(a.text.toUpperCase(), w / 2, h / 2 + 2);
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.48, 0.03), [0, 0, 0, 0, 1, 1].map((k) => (k ? new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }) : new THREE.MeshStandardMaterial({ color: 0x1a5fb4 }))));
    m.position.set(a.x, H - 1.6, a.z - 2.4);
    ctx.root.add(m);
  }
}

// Price tags: hundreds per store, so they're batched into ONE mesh with one texture atlas per
// store (one draw call instead of 500). priceTag() just records; finishTags() builds the mesh.
let tagBatch = [];

function priceTag(root, x, y, z, yaw, p, big = false, flat = false) {
  tagBatch.push({ x, y, z, yaw, p, big, s: big ? 0.32 : flat ? 0.1 : 0.14 });
}

function finishTags(S, root) {
  const list = tagBatch;
  tagBatch = [];
  if (!list.length) return;
  const keys = [...new Set(list.map((t) => `${t.p.id}|${t.big ? 1 : 0}`))];
  const CW = 192;
  const CH = 96;
  const cols = Math.floor(2048 / CW);
  const rows = Math.ceil(keys.length / cols);
  const H = Math.min(2048, 2 ** Math.ceil(Math.log2(Math.max(1, rows) * CH)));
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = H;
  const g = c.getContext('2d');
  const cell = new Map();
  keys.forEach((k, i) => {
    const [id, big] = k.split('|');
    const p = PRODUCT[id];
    const cx = (i % cols) * CW;
    const cy = Math.floor(i / cols) * CH;
    cell.set(k, [cx / 2048, 1 - (cy + CH) / H, (cx + CW) / 2048, 1 - cy / H]);
    g.fillStyle = big === '1' ? '#ffda1a' : '#ffffff';
    g.fillRect(cx + 1, cy + 1, CW - 2, CH - 2);
    g.fillStyle = '#111';
    g.font = 'bold 16px Inter, Arial, sans-serif';
    g.fillText(p.name.slice(0, 22), cx + 8, cy + 22);
    g.font = '900 40px Inter, Arial, sans-serif';
    const dollars = Math.floor(p.price);
    const cents = Math.round((p.price - dollars) * 100);
    g.fillText(`$${dollars}`, cx + 8, cy + 74);
    const dw = g.measureText(`$${dollars}`).width;
    g.font = '900 22px Inter, Arial, sans-serif';
    g.fillText(String(cents).padStart(2, '0'), cx + 12 + dw, cy + 57);
    if (p.unit) {
      g.font = '14px Inter, Arial';
      g.fillText(p.unit, cx + CW - 52, cy + 86);
    }
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const n = list.length;
  const pos = new Float32Array(n * 4 * 3);
  const nor = new Float32Array(n * 4 * 3);
  const uv = new Float32Array(n * 4 * 2);
  const idx = new Uint32Array(n * 6);
  const v = new THREE.Vector3();
  list.forEach((t, i) => {
    const [u0, v0, u1, v1] = cell.get(`${t.p.id}|${t.big ? 1 : 0}`);
    const hw = t.s;
    const hh = t.s / 2;
    const cs = Math.cos(t.yaw);
    const sn = Math.sin(t.yaw);
    // Plane facing +Z rotated by yaw around Y.
    [[-hw, -hh, u0, v0], [hw, -hh, u1, v0], [hw, hh, u1, v1], [-hw, hh, u0, v1]].forEach(([lx, ly, uu, vv], k) => {
      v.set(t.x + lx * cs, t.y + ly, t.z - lx * sn);
      pos.set([v.x, v.y, v.z], (i * 4 + k) * 3);
      nor.set([sn, 0, cs], (i * 4 + k) * 3);
      uv.set([uu, vv], (i * 4 + k) * 2);
    });
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  mesh.name = `${S.id}-price-tags`;
  root.add(mesh);
  (S.productMeshes ||= []).push(mesh); // hidden from far away together with the products
}

function signBox(root, x, y, z, def, [bg, fg]) {
  const tex = canvasTexture(`sign-${def.id}`, 1024, 256, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    if (def.id === 'grocery') {
      c.fillStyle = '#ffffff';
      c.font = 'bold 150px Inter, Arial, sans-serif';
      c.fillText('Walmort', w / 2 - 60, h / 2 + 8);
      c.fillStyle = fg;
      for (let i = 0; i < 6; i++) {
        c.save();
        c.translate(w * 0.84, h / 2);
        c.rotate((i / 6) * Math.PI * 2);
        c.fillRect(-8, -70, 16, 46);
        c.restore();
      }
    } else if (def.id === 'electronics') {
      c.fillStyle = fg;
      c.beginPath();
      c.moveTo(w * 0.2, h * 0.15);
      c.lineTo(w * 0.8, h * 0.15);
      c.lineTo(w * 0.9, h * 0.5);
      c.lineTo(w * 0.8, h * 0.85);
      c.lineTo(w * 0.2, h * 0.85);
      c.closePath();
      c.fill();
      c.fillStyle = '#111';
      c.font = '900 140px Inter, Arial, sans-serif';
      c.fillText('BEST BYE', w * 0.5, h / 2 + 8);
    } else {
      c.fillStyle = fg;
      c.fillRect(w * 0.2, h * 0.12, w * 0.6, h * 0.76);
      c.fillStyle = bg;
      c.font = '900 170px Inter, Arial, sans-serif';
      c.fillText('IKEO', w / 2, h / 2 + 10);
    }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.5 }));
  m.position.set(x - 0.02, y, z);
  m.rotation.y = -Math.PI / 2;
  root.add(m);
}

function hoursSign(root, x, y, z, def) {
  const fmt = (h) => `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? 'AM' : 'PM'}`;
  const tex = canvasTexture(`hours-${def.id}`, 256, 256, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#111';
    c.textAlign = 'center';
    c.font = 'bold 30px Inter, Arial';
    c.fillText(def.name.toUpperCase(), w / 2, 46);
    c.font = '26px Inter, Arial';
    c.fillText('STORE HOURS', w / 2, 96);
    c.font = 'bold 34px Inter, Arial';
    c.fillText(`${fmt(def.open)} - ${fmt(def.close)}`, w / 2, 150);
    c.font = '22px Inter, Arial';
    c.fillText('7 DAYS A WEEK', w / 2, 196);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshStandardMaterial({ map: tex }));
  m.position.set(x - 0.05, y, z);
  m.rotation.y = -Math.PI / 2;
  root.add(m);
}

function demoScreen(root, x, y, z, w, h, yaw, seed) {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 108;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, h + 0.04, 0.05), new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.3 }));
  frame.position.set(x, y, z);
  frame.rotation.y = yaw;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  scr.position.set(x - 0.03, y, z);
  scr.rotation.y = yaw;
  root.add(frame, scr);
  let t = seed * 1.7;
  let acc = 0;
  return {
    update(dt) {
      acc += dt;
      t += dt;
      if (acc < 0.1) return;
      acc = 0;
      const g = c.getContext('2d');
      // A nature-demo loop: drifting sky gradient, sun, rolling hills (the classic store demo).
      const hue = (t * 8 + seed * 40) % 360;
      const sky = g.createLinearGradient(0, 0, 0, 108);
      sky.addColorStop(0, `hsl(${hue}, 70%, 55%)`);
      sky.addColorStop(1, `hsl(${(hue + 40) % 360}, 80%, 75%)`);
      g.fillStyle = sky;
      g.fillRect(0, 0, 192, 108);
      g.fillStyle = 'rgba(255,240,180,.95)';
      g.beginPath();
      g.arc(150 - ((t * 6) % 140), 30, 12, 0, Math.PI * 2);
      g.fill();
      for (let l = 0; l < 3; l++) {
        g.fillStyle = `hsl(${(120 + l * 15 + seed * 5) % 360}, 45%, ${30 - l * 6}%)`;
        g.beginPath();
        g.moveTo(0, 108);
        for (let xx = 0; xx <= 192; xx += 6) g.lineTo(xx, 70 + l * 12 - Math.sin(xx * 0.04 + t * (0.3 + l * 0.2) + l) * 10);
        g.lineTo(192, 108);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.85)';
      g.font = 'bold 10px Arial';
      g.fillText('4K ULTRA HD', 6, 102);
      tex.needsUpdate = true;
    },
  };
}

let _walk = null;
function walkwayMat() {
  if (_walk) return _walk;
  // Light grey lane with white edge lines and an arrow every 3 m (pointing deeper into the store).
  const tex = canvasTexture('walkway', 512, 128, (c, w, h) => {
    c.fillStyle = '#a8abae';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#e4e4de';
    c.fillRect(0, 4, w, 6);
    c.fillRect(0, h - 10, w, 6);
    c.beginPath();
    c.moveTo(w * 0.35, h * 0.3);
    c.lineTo(w * 0.55, h * 0.3);
    c.lineTo(w * 0.55, h * 0.18);
    c.lineTo(w * 0.68, h * 0.5);
    c.lineTo(w * 0.55, h * 0.82);
    c.lineTo(w * 0.55, h * 0.7);
    c.lineTo(w * 0.35, h * 0.7);
    c.closePath();
    c.fill();
  }, { repeat: true });
  _walk = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  _walk.userData.tileMeters = 1.6;
  return _walk;
}

/** Yellow aisle/bay sign on a warehouse rack (where you find your flat-pack box). */
function binSign(root, x, y, z, bay) {
  const tex = canvasTexture(`bin-${bay}`, 128, 160, (c, w, h) => {
    c.fillStyle = '#ffda1a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#111';
    c.textAlign = 'center';
    c.font = 'bold 22px Inter, Arial';
    c.fillText('AISLE', w / 2, 30);
    c.font = '900 64px Inter, Arial';
    c.fillText(String(20 + bay), w / 2, 92);
    c.font = 'bold 22px Inter, Arial';
    c.fillText(`BIN ${String(bay * 3).padStart(2, '0')}`, w / 2, 136);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  m.position.set(x, y, z);
  m.rotation.y = -Math.PI / 2;
  root.add(m);
}

let _peg = null;
function pegboardMat() {
  if (_peg) return _peg;
  // Painted steel pegboard: rows of punched holes every 2.5 cm (1 inch, like the real thing).
  const tex = canvasTexture('pegboard', 128, 128, (c, w, h) => {
    c.fillStyle = '#e4e4e2';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5d5f62';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) c.fillRect(x * 16 + 6, y * 16 + 6, 4, 4);
  }, { repeat: true });
  _peg = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2 });
  _peg.userData.tileMeters = 0.2;
  return _peg;
}

const _pol = new Map();
/** Same floor, sealed + polished (lower roughness, picks up the ceiling lights). */
function polished(m, roughness) {
  let p = _pol.get(m.uuid);
  if (!p) {
    p = m.clone();
    p.roughness = roughness;
    p.userData = { ...m.userData };
    _pol.set(m.uuid, p);
  }
  return p;
}

let _fp = null;
function flatpackMat() {
  if (_fp) return _fp;
  const tex = canvasTexture('flatpack', 256, 256, (c, w, h) => {
    c.fillStyle = '#b48a5a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#0058a3';
    c.fillRect(w * 0.1, h * 0.1, w * 0.45, h * 0.18);
    c.fillStyle = '#ffda1a';
    c.font = '900 34px Inter, Arial';
    c.fillText('IKEO', w * 0.14, h * 0.24);
    c.fillStyle = '#3a2a1a';
    c.font = '18px Inter, Arial';
    c.fillText('1 of 2   ◻︎ ◻︎ ◻︎', w * 0.1, h * 0.9);
  });
  _fp = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  _fp.userData.tileMeters = 1.2;
  return _fp;
}

void _p;
