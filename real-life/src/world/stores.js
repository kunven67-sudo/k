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
    for (const t of tvs) t.update(dt);
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
    furniture: { ext: mat('metal-painted', { color: 0x0058a3, wear: 0.1, dirt: 0.15 }), band: mat('metal-painted', { color: 0xffda1a, wear: 0.05 }), sign: ['#0058a3', '#ffda1a'], floor: mat('concrete', { wear: 0.15, dirt: 0.15 }) },
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
  // Floor + ceiling.
  B.slab(x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, FY, style.floor, { thick: 0.1 });
  const ceil = mat('paint', { color: def.id === 'electronics' ? 0x1c1d21 : 0x3a3c40 });
  B.slab(x0 + 0.15, z0 + 0.15, x1 - 0.15, z1 - 0.15, H - 0.3, null, { thick: 0.05, under: ceil, collide: false });
  // Light panels (emissive) in rows.
  const panel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 1 });
  for (let x = x0 + 3; x < x1 - 2; x += 4) for (let z = z0 + 3; z < z1 - 2; z += 4) B.box(x, H - 0.34, z, 1.2, 0.04, 0.3, panel, { collide: false, shadow: false });
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
  // Registers.
  for (const r of S.registers) register(ctx, r);
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
  produce.forEach((p, i) => produceTable(ctx, tables[i % 4], p, i >= 4 ? 1 : 0, Math.floor(i / 4)));
  for (const t of tables) B.box(t.x, FY + 0.38, t.z, 2.4, 0.76, 1.6, mat('wood', { color: 0x6b4a2e, varnish: 0.5 }), {});
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
  B.model('market', 'shopping-basket', { x: x0 + 1.5, y: FY, z: zc - 2.2, scale: 2.2, collide: 'none' });
  B.model('market', 'shopping-basket', { x: x0 + 1.5, y: FY + 0.2, z: zc - 2.2, scale: 2.2, collide: 'none' });
  B.model('market', 'shopping-basket', { x: x0 + 1.5, y: FY + 0.4, z: zc - 2.2, scale: 2.2, collide: 'box' });
  for (let i = 0; i < 4; i++) B.model('market', 'shopping-cart', { x: x0 + 1.0 + i * 0.32, y: FY, z: zc + 2.4, rotY: Math.PI / 2, scale: 2.25, collide: i === 0 ? [1.4, 1, 0.7] : 'none' });
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
    gondola(ctx, x0 + 9, x1 - 4, zz, list, aisles[i][0], { locked: i === 2 });
  });
  aisleSigns(ctx, gz.map((zz, i) => ({ x: (x0 + 9 + x1 - 4) / 2, z: zz + 2.25, text: aisles[i].join(' + ') })));
  // Blue shirt service desk near the door.
  B.box(x0 + 3, FY + 0.5, z1 - 3, 2.4, 1.0, 0.8, mat('metal-painted', { color: 0x0e2550 }), {});
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
  const rooms = [
    { x: x0 + 12, z: z0 + 4, items: ['bed-single', 'nightstand', 'dresser-low', 'rug-round', 'desk-lamp'] },
    { x: x0 + 20, z: z0 + 4, items: ['sofa', 'coffee-table', 'floor-lamp', 'plant-big', 'rug'] },
    { x: x0 + 12, z: z1 - 5, items: ['bed-bunk', 'dresser', 'plant-small', 'shelf-small'] },
    { x: x0 + 20, z: z1 - 5, items: ['desk', 'gaming-chair', 'bookshelf', 'chair', 'stool'] },
    { x: x0 + 27, z: zc, items: ['sofa-l', 'armchair', 'bed-king', 'curtains'] },
  ];
  for (const r of rooms) {
    // Two partition walls make an open-sided "room".
    B.box(r.x, FY + 1.2, r.z - 2.6, 6, 2.4, 0.1, part, {});
    B.box(r.x + 3, FY + 1.2, r.z, 0.1, 2.4, 5.2, part, {});
    B.box(r.x, FY + 0.005, r.z, 6, 0.01, 5.2, mat('wood-floor', { color: 0xc49a6c, wear: 0.05 }), { collide: false, shadow: false });
    r.items.forEach((id, i) => {
      const p = PRODUCT[id];
      if (!p) return;
      const px = r.x - 2 + (i % 3) * 1.9;
      const pz = r.z - 1.4 + Math.floor(i / 3) * 2.1;
      const yaw = Math.PI / 2;
      if (p.pack.shape === 'model') {
        const isRug = id.startsWith('rug');
        B.model(p.pack.kit, p.pack.model, { x: px, y: FY + (isRug ? 0.008 : 0), z: pz, rotY: yaw, collide: isRug ? 'none' : 'box' });
      }
      const tagPos = new THREE.Vector3(px - 0.7, FY + 0.9, pz);
      priceTag(ctx.root, tagPos.x, tagPos.y, tagPos.z, -Math.PI / 2, p, true);
      S.slots.push(makeSlot(ctx, p, { box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(px, FY + 0.6, pz), new THREE.Vector3(1.4, 1.2, 1.4)), display: true }));
    });
  }
  // Self-serve warehouse: tall racks of flat-pack boxes along the back.
  const rack = mat('metal-painted', { color: 0xf2a900, wear: 0.3 });
  for (let z = z0 + 2; z < z1 - 2; z += 3.2) {
    B.box(x1 - 1.0, FY + 2, z, 1.6, 4, 0.08, rack, {});
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

/** Double-sided gondola running along x at z, stocked on both sides. */
function gondola(ctx, xa, xb, z, products, label, opts = {}) {
  const { B } = ctx;
  const metal = mat('metal-painted', { color: 0xe8e8e8, wear: 0.15, dirt: 0.15 });
  const len = xb - xa;
  const cx = (xa + xb) / 2;
  const levels = [0.14, 0.55, 0.96, 1.37, 1.78];
  B.box(cx, FY + 1.05, z, len, 2.1, 0.06, metal, {}); // back panel
  B.box(cx, FY + 0.07, z, len, 0.14, 1.2, metal, { collide: false }); // base
  B.collider(cx, FY + 1.05, z, len, 2.1, 1.1);
  for (const y of levels.slice(1)) for (const side of [-1, 1]) B.box(cx, FY + y - 0.02, z + side * 0.3, len, 0.03, 0.56, metal, { collide: false, shadow: false });
  for (const xx of [xa, xb]) B.box(xx, FY + 1.05, z, 0.05, 2.1, 1.2, metal, { collide: false });
  // Split products across the two sides.
  const half = Math.ceil(products.length / 2);
  stockRun(ctx, { x: xa, z: z - 0.04 }, { x: xb, z: z - 0.04 }, Math.PI, products.slice(0, half).length ? products.slice(0, half) : products, { levels, locked: opts.locked });
  stockRun(ctx, { x: xb, z: z + 0.04 }, { x: xa, z: z + 0.04 }, 0, products.slice(half).length ? products.slice(half) : products, { levels, locked: opts.locked });
  if (opts.locked) {
    // Locked glass case doors on both sides (real stores lock GPUs + consoles up).
    const g = mat('glass', { dirt: 0.05 });
    for (const side of [-1, 1]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.75), g);
      pane.position.set(cx, FY + 1.15, z + side * 0.6);
      pane.rotation.y = side === 1 ? 0 : Math.PI;
      ctx.root.add(pane);
    }
  }
  void label;
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
}

/** Produce on a sloped table: piles of a model product. */
function produceTable(ctx, t, p, side, row) {
  const n = 22;
  const list = [];
  const rng = ctx.rng;
  const [w, , d] = p.pack.size;
  for (let i = 0; i < n; i++) {
    const cols = Math.max(2, Math.floor(1.0 / Math.max(w, d)));
    const cx = t.x - 1.1 + (side ? 1.2 : 0) + (i % cols) * Math.max(w, 0.09) * 1.05 + 0.08;
    const cz = t.z - 0.7 + row * 0.75 + Math.floor(i / cols) * Math.max(d, 0.09) * 1.05 + 0.08;
    if (cz > t.z - 0.7 + row * 0.75 + 0.7) break;
    list.push({ pos: new THREE.Vector3(cx, FY + 0.77 + (rng.next() < 0.3 ? 0.04 : 0), cz), rotY: rng.range(0, 6.28) });
  }
  const box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(t.x - 0.5 + (side ? 1.2 : 0), FY + 0.9, t.z - 0.35 + row * 0.75), new THREE.Vector3(1.2, 0.4, 0.75));
  ctx.S.slots.push(makeSlot(ctx, p, { units: list, box }));
  priceTag(ctx.root, t.x - 1.2, FY + 0.6, t.z - 0.35 + row * 0.75 + (side ? 0 : 0), -Math.PI / 2, p);
}

/** Fill a shelf run with product blocks (packed facings, restocked across levels). */
function stockRun(ctx, a, b, yaw, products, { levels, depthRows = 2, locked = false } = {}) {
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
      const deep = Math.max(1, Math.min(depthRows, Math.floor(0.5 / Math.max(d, 0.05))));
      for (let k = 0; k < deep; k++) {
        for (let f = 0; f < fits; f++) {
          const along = u + f * (w + 0.008) + w / 2;
          // Front row at the shelf lip, more rows behind it.
          const out = 0.52 - d / 2 - k * (d + 0.01);
          const pos = new THREE.Vector3(a.x + dir.x * along + n.x * out, FY + levels[li], a.z + dir.z * along + n.z * out);
          units.push({ pos, rotY: yaw });
        }
      }
      const mid = u + blockW / 2;
      const center = new THREE.Vector3(a.x + dir.x * mid + n.x * 0.28, FY + levels[li] + h / 2, a.z + dir.z * mid + n.z * 0.28);
      const box = new THREE.Box3().setFromCenterAndSize(center, new THREE.Vector3(Math.abs(dir.x) * blockW + Math.abs(n.x) * 0.55 + 0.02, h + 0.04, Math.abs(dir.z) * blockW + Math.abs(n.z) * 0.55 + 0.02));
      ctx.S.slots.push(makeSlot(ctx, p, { units, box, locked }));
      // Shelf price tag under the block.
      priceTag(ctx.root, a.x + dir.x * (u + 0.1) + n.x * 0.565, FY + levels[li] - 0.035, a.z + dir.z * (u + 0.1) + n.z * 0.565, yaw, p, false, true);
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
    const { geometry, material } = packageMesh(p);
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

function register(ctx, r) {
  const { B } = ctx;
  B.model('market', 'cash-register', { x: r.x, y: FY, z: r.z, rotY: Math.PI / 2, scale: 1.6 });
  r.customer = new THREE.Vector3(r.x - 0.2, FY, r.z + 1.0);
  r.cashier = new THREE.Vector3(r.x - 0.2, FY, r.z - 0.95);
  r.box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(r.x, FY + 0.9, r.z + 0.2), new THREE.Vector3(1.6, 0.8, 1.2));
  r.store = ctx.S;
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

const tagCache = new Map();
function priceTag(root, x, y, z, yaw, p, big = false, flat = false) {
  const key = `${p.id}-${big ? 1 : 0}`;
  let tex = tagCache.get(key);
  if (!tex) {
    tex = canvasTexture(`tag-${key}`, 256, 128, (c, w, h) => {
      c.fillStyle = big ? '#ffda1a' : '#ffffff';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#111';
      c.font = 'bold 22px Inter, Arial, sans-serif';
      c.fillText(p.name.slice(0, 22), 10, 30);
      c.font = '900 54px Inter, Arial, sans-serif';
      const dollars = Math.floor(p.price);
      const cents = Math.round((p.price - dollars) * 100);
      c.fillText(`$${dollars}`, 10, 98);
      c.font = '900 30px Inter, Arial, sans-serif';
      c.fillText(String(cents).padStart(2, '0'), 12 + c.measureText(`$${dollars}`).width * 1.8, 76);
      if (p.unit) {
        c.font = '18px Inter, Arial';
        c.fillText(p.unit, 180, 110);
      }
    });
    tagCache.set(key, tex);
  }
  const s = big ? 0.32 : flat ? 0.1 : 0.14;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 2, s), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  m.position.set(x, y, z);
  m.rotation.y = yaw;
  root.add(m);
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
