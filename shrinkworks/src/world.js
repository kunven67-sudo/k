// The kitchen (1 unit = 10 cm): real scanned marble, wood, tiles and plaster. The island in the middle is your workbench
// (waist high, like a real one). Counters, sink, cooktop, fridge, a window with the real sky behind it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene, addFixedLight } from './core/render.js';
import { texSet, partMaterial } from './core/mats.js';
import { R, world, owners, G, groups } from './core/physics.js';

export const ROOM = { x0: -36, x1: 36, z0: -30, z1: 30, h: 26 };
export const LIMIT = 34.5;      // how far you can walk (inside the walls)
export const TOP = 9.2;         // counter / island top
export const ISLAND = { x: 0, z: 4, w: 22, d: 10 };
export const START = new THREE.Vector3(0, 0, 14.5);
export const ground = { collider: null };

/* ---------- materials (real photos) ---------- */
function photoMat(name, extra = {}) {
  const t = texSet(name);
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.arm, aoMap: t.arm, aoMapIntensity: 0.5, ...extra });
}
let M = null;
function mats() {
  if (M) return M;
  M = {
    counter: photoMat('counter', { roughness: 0.32, envMapIntensity: 1.1 }),
    cabinet: photoMat('cabinet', { roughness: 0.85, color: new THREE.Color('#e6ddd2') }),
    floor: photoMat('floor', { roughness: 0.75 }),
    // painted walls: one even paint color over the real plaster bumps (the plaster photo itself looked dirty brown)
    wall: new THREE.MeshStandardMaterial({ color: 0xefeae2, roughness: 0.9, normalMap: texSet('wall').normalMap, normalScale: new THREE.Vector2(0.7, 0.7) }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.95, emissive: 0x3a3936 }),
    splash: photoMat('splash', { roughness: 0.25 }),
    steel: partMaterial('alu', '#c9ced3'),
    chrome: partMaterial('chrome'),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.9 }),
    glassTop: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.3 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.55 }),
    pane: new THREE.MeshStandardMaterial({ color: 0xdfeef5, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.4 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }),
    burner: new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.4, metalness: 0.2 }),
    lampShade: new THREE.MeshStandardMaterial({ color: 0x2c2d30, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 3 }),
    salt: new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.18, transparent: true, opacity: 0.88 }),
    crumb: new THREE.MeshStandardMaterial({ color: 0xc58a45, roughness: 0.9 })
  };
  return M;
}

/* ---------- geometry with real-size texture tiling (the photo keeps its real size on every face) ---------- */
function box(w, h, d, x, y, z, tile = 10) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // faces: +x -x +y -y +z -z, 4 vertices each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / tile + x * 0.013, uv.getY(k) * dims[f][1] / tile + z * 0.017);
  }
  g.setAttribute('uv1', uv.clone());
  g.translate(x, y, z);
  return g;
}
const parts = new Map(); // material key -> geometries (merged at the end: few draw calls, fast on the Quest)
function add(key, g) {
  if (g.index) g = g.toNonIndexed();
  if (!g.attributes.uv1) g.setAttribute('uv1', g.attributes.uv.clone());
  if (!parts.has(key)) parts.set(key, []);
  parts.get(key).push(g);
}
function solid(w, h, d, x, y, z, friction = 0.8) {
  const rb = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(x, y, z));
  const c = world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(friction).setRestitution(0.05)
    .setCollisionGroups(groups(G.WORLD, 0xffff)), rb);
  owners.set(c.handle, { kind: 'ground' });
  return c;
}
// a block of the kitchen that you can see and stand on
function block(key, w, h, d, x, y, z, tile, phys = true) {
  add(key, box(w, h, d, x, y + h / 2, z, tile));
  if (phys) solid(w, h, d, x, y + h / 2, z);
}

/* ---------- a run of base cabinets with a stone top ---------- */
// along x (north wall: doors face +z) or along z (west wall: doors face +x)
function baseRun(x0, x1, z0, z1, facing, opts = {}) {
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const carcH = TOP - 0.4;
  // toe kick (recessed dark strip) + carcass
  if (facing === '+z') {
    block('dark', w, 1, d - 0.7, cx, 0, cz - 0.35, 10, false);
    block('cabinet', w, carcH - 1, d - 0.25, cx, 1, cz - 0.125, 8, false);
  } else {
    block('dark', w - 0.7, 1, d, cx - 0.35, 0, cz, 10, false);
    block('cabinet', w - 0.25, carcH - 1, d, cx - 0.125, 1, cz, 8, false);
  }
  solid(w, carcH, d, cx, carcH / 2, cz);
  // doors + drawers with gaps and steel bar handles
  const along = facing === '+z' ? w : d, start = facing === '+z' ? x0 : z0;
  const n = Math.max(1, Math.round(along / 6));
  const dw = along / n;
  for (let i = 0; i < n; i++) {
    const c = start + dw * (i + 0.5);
    if (opts.skip && opts.skip(c)) continue;
    const doorW = dw - 0.12;
    // a drawer on top, a door below
    const rows = [[carcH - 1.9, 1.6], [1.15, carcH - 3.2]];
    for (const [y, h] of rows) {
      if (facing === '+z') {
        add('cabinet', box(doorW, h, 0.25, c, y + h / 2, z1 + 0.0, 6));
        add('steel', new THREE.CylinderGeometry(0.06, 0.06, Math.min(3, doorW * 0.5), 10).rotateZ(Math.PI / 2).translate(c, y + h - 0.45, z1 + 0.32));
      } else {
        add('cabinet', box(0.25, h, doorW, x1 + 0.0, y + h / 2, c, 6));
        add('steel', new THREE.CylinderGeometry(0.06, 0.06, Math.min(3, doorW * 0.5), 10).rotateX(Math.PI / 2).translate(x1 + 0.32, y + h - 0.45, c));
      }
    }
  }
  // the counter top: marble slab, a little overhang at the front
  if (!opts.noTop) {
    if (facing === '+z') block('counter', w, 0.4, d + 0.35, cx, carcH, cz + 0.175, 22);
    else block('counter', w + 0.35, 0.4, d, cx + 0.175, carcH, cz, 22);
  }
}

export function buildWorld() {
  const m = mats();
  const { x0, x1, z0, z1, h } = ROOM;
  // floor + ceiling
  block('floor', x1 - x0, 1, z1 - z0, 0, -1, 0, 16);
  add('ceiling', box(x1 - x0, 1, z1 - z0, 0, h + 0.5, 0, 25));
  solid(x1 - x0, 1, z1 - z0, 0, h + 0.5, 0);
  ground.collider = solid(400, 2, 400, 0, -2, 0, 0.9);
  // walls (north wall has the window over the sink)
  const WX0 = -12, WX1 = 4, WY0 = 11.5, WY1 = 22;
  const T = 2;
  block('wall', WX0 - x0, h, T, (x0 + WX0) / 2, 0, z0 - T / 2, 25);
  block('wall', x1 - WX1, h, T, (WX1 + x1) / 2, 0, z0 - T / 2, 25);
  block('wall', WX1 - WX0, WY0, T, (WX0 + WX1) / 2, 0, z0 - T / 2, 25);
  block('wall', WX1 - WX0, h - WY1, T, (WX0 + WX1) / 2, WY1, z0 - T / 2, 25);
  block('wall', x1 - x0, h, T, 0, 0, z1 + T / 2, 25);
  block('wall', T, h, z1 - z0, x0 - T / 2, 0, 0, 25);
  block('wall', T, h, z1 - z0, x1 + T / 2, 0, 0, 25);
  // window: white frame, a cross bar, thin glass you can see through, a deep sill
  const fw = 0.5;
  add('frame', box(WX1 - WX0, fw, T + 0.3, (WX0 + WX1) / 2, WY0 + fw / 2, z0 - T / 2, 10));
  add('frame', box(WX1 - WX0, fw, T + 0.3, (WX0 + WX1) / 2, WY1 - fw / 2, z0 - T / 2, 10));
  add('frame', box(fw, WY1 - WY0, T + 0.3, WX0 + fw / 2, (WY0 + WY1) / 2, z0 - T / 2, 10));
  add('frame', box(fw, WY1 - WY0, T + 0.3, WX1 - fw / 2, (WY0 + WY1) / 2, z0 - T / 2, 10));
  add('frame', box(0.35, WY1 - WY0, 0.4, (WX0 + WX1) / 2, (WY0 + WY1) / 2, z0 - T * 0.6, 10));
  add('pane', new THREE.PlaneGeometry(WX1 - WX0, WY1 - WY0).translate((WX0 + WX1) / 2, (WY0 + WY1) / 2, z0 - T * 0.62));
  solid(WX1 - WX0, WY1 - WY0, 0.2, (WX0 + WX1) / 2, (WY0 + WY1) / 2, z0 - T * 0.62);

  // north counter (sink under the window, cooktop to the right), fridge at the end
  const ND = 6.2, nz1 = z0 + ND;
  const SX0 = -7.8, SX1 = -0.2, SZ0 = z0 + 1, SZ1 = nz1 - 1.1, SD = 2.2; // sink hole
  baseRun(x0, 24, z0, nz1, '+z', { noTop: true });
  // marble top around the sink hole
  const carcH = TOP - 0.4;
  block('counter', SX0 - x0, 0.4, ND + 0.35, (x0 + SX0) / 2, carcH, z0 + (ND + 0.35) / 2, 22);
  block('counter', 24 - SX1, 0.4, ND + 0.35, (SX1 + 24) / 2, carcH, z0 + (ND + 0.35) / 2, 22);
  block('counter', SX1 - SX0, 0.4, SZ0 - z0, (SX0 + SX1) / 2, carcH, (z0 + SZ0) / 2, 22);
  block('counter', SX1 - SX0, 0.4, nz1 + 0.35 - SZ1, (SX0 + SX1) / 2, carcH, (SZ1 + nz1 + 0.35) / 2, 22);
  // steel sink basin (a real hole you can drop things into)
  const sb = TOP - SD;
  block('steel', SX1 - SX0, 0.15, SZ1 - SZ0, (SX0 + SX1) / 2, sb - 0.15, (SZ0 + SZ1) / 2, 4);
  block('steel', 0.15, SD, SZ1 - SZ0, SX0 + 0.075, sb, (SZ0 + SZ1) / 2, 4);
  block('steel', 0.15, SD, SZ1 - SZ0, SX1 - 0.075, sb, (SZ0 + SZ1) / 2, 4);
  block('steel', SX1 - SX0, SD, 0.15, (SX0 + SX1) / 2, sb, SZ0 + 0.075, 4);
  block('steel', SX1 - SX0, SD, 0.15, (SX0 + SX1) / 2, sb, SZ1 - 0.075, 4);
  add('dark', new THREE.CylinderGeometry(0.35, 0.35, 0.02, 20).translate((SX0 + SX1) / 2, sb + 0.01, (SZ0 + SZ1) / 2));
  // faucet (chrome): base, tall neck, spout over the sink
  const fx = (SX0 + SX1) / 2, fz = SZ0 - 0.55;
  add('chrome', new THREE.CylinderGeometry(0.28, 0.32, 0.4, 20).translate(fx, TOP + 0.2, fz));
  add('chrome', new THREE.CylinderGeometry(0.15, 0.15, 3.2, 16).translate(fx, TOP + 1.8, fz));
  add('chrome', new THREE.TorusGeometry(0.9, 0.15, 10, 20, Math.PI).rotateY(Math.PI / 2).translate(fx, TOP + 3.4, fz + 0.9));
  add('chrome', new THREE.CylinderGeometry(0.17, 0.13, 0.6, 16).translate(fx, TOP + 3.1, fz + 1.8));
  add('chrome', new THREE.BoxGeometry(0.12, 0.12, 0.9).translate(fx + 0.5, TOP + 0.75, fz).rotateY(0));
  solid(0.4, 3.4, 0.4, fx, TOP + 1.7, fz);
  // cooktop: black glass with four burner rings
  const cx = 13, cz = z0 + 3.2;
  add('glassTop', box(6, 0.08, 5, cx, TOP + 0.04, cz, 10));
  for (const [ox, oz, r] of [[-1.5, -1.2, 0.95], [1.5, -1.2, 0.75], [-1.5, 1.2, 0.75], [1.5, 1.2, 0.95]]) {
    add('burner', new THREE.TorusGeometry(r, 0.035, 6, 40).rotateX(Math.PI / 2).translate(cx + ox, TOP + 0.09, cz + oz));
    add('burner', new THREE.TorusGeometry(r * 0.55, 0.03, 6, 32).rotateX(Math.PI / 2).translate(cx + ox, TOP + 0.09, cz + oz));
  }
  // backsplash tiles between the counter and the upper cabinets
  add('splash', box(WX0 - x0, 5.3, 0.1, (x0 + WX0) / 2, TOP + 2.65, z0 + 0.05, 6));
  add('splash', box(24 - WX1, 5.3, 0.1, (WX1 + 24) / 2, TOP + 2.65, z0 + 0.05, 6));
  add('splash', box(WX1 - WX0, WY0 - TOP, 0.1, (WX0 + WX1) / 2, (TOP + WY0) / 2, z0 + 0.05, 6));
  // upper cabinets (both sides of the window)
  for (const [ux0, ux1] of [[x0, WX0 - 1], [WX1 + 1, 24]]) {
    const uw = ux1 - ux0, n = Math.max(1, Math.round(uw / 5)), dw = uw / n;
    block('cabinet', uw, 8, 3.3, (ux0 + ux1) / 2, 14.5, z0 + 1.65, 8);
    for (let i = 0; i < n; i++) {
      const c = ux0 + dw * (i + 0.5);
      add('cabinet', box(dw - 0.12, 7.8, 0.22, c, 18.5, z0 + 3.41, 6));
      add('steel', new THREE.CylinderGeometry(0.06, 0.06, 2.2, 10).translate(c + dw / 2 - 0.7, 16.3, z0 + 3.66));
    }
  }
  // fridge: brushed steel, two doors, long handles
  const FX0 = 24.4, FX1 = 33, FD = 7.2;
  block('steel', FX1 - FX0, 18.6, FD, (FX0 + FX1) / 2, 0, z0 + FD / 2, 6);
  add('dark', box(FX1 - FX0 - 0.2, 0.08, 0.1, (FX0 + FX1) / 2, 12.2, z0 + FD + 0.03, 10));
  add('dark', box(0.08, 18, 0.1, (FX0 + FX1) / 2, 9.3, z0 + FD + 0.03, 10));
  for (const sx of [-0.6, 0.6]) add('chrome', new THREE.CylinderGeometry(0.13, 0.13, 7, 12).translate((FX0 + FX1) / 2 + sx, 7.5, z0 + FD + 0.6));
  for (const sx of [-0.6, 0.6]) add('chrome', new THREE.CylinderGeometry(0.13, 0.13, 3.5, 12).translate((FX0 + FX1) / 2 + sx, 15.2, z0 + FD + 0.6));

  // west counter (doors face the room)
  baseRun(x0, x0 + 6.2, nz1 + 0.35, 10, '+x');

  // the island: your workbench, waist high, cabinets on both long sides
  const I = ISLAND;
  baseRun(I.x - I.w / 2, I.x + I.w / 2, I.z - I.d / 2, I.z + I.d / 2, '+z', { noTop: true });
  // doors on the back side too
  block('counter', I.w + 0.6, 0.4, I.d + 0.9, I.x, TOP - 0.4, I.z, 22);

  // two pendant lamps over the island
  for (const lx of [-5.5, 5.5]) {
    add('rubber', new THREE.CylinderGeometry(0.03, 0.03, 9, 6).translate(lx, h - 4.5, I.z));
    add('lampShade', new THREE.ConeGeometry(1.5, 1.6, 28, 1, true).translate(lx, h - 9.4, I.z));
    add('bulb', new THREE.SphereGeometry(0.45, 16, 12).translate(lx, h - 9.9, I.z));
    const pl = new THREE.PointLight(0xffd9a8, 220, 60, 2);
    pl.position.set(lx, h - 10.4, I.z);
    addFixedLight(pl);
  }

  // micro world: real salt spilled on the island (salt crystals really are little cubes) + croissant crumbs.
  // You only notice them when you shrink.
  const salt = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m.salt, 180);
  const crumbs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), m.crumb, 60);
  const o = new THREE.Object3D();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 180; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * 1.6, s = 0.004 + rnd() * 0.006;
    o.position.set(-4.5 + Math.cos(a) * r, TOP + s * 0.45, 6.2 + Math.sin(a) * r * 0.7);
    o.rotation.set(rnd() * 0.3, rnd() * 3, rnd() * 0.3);
    o.scale.setScalar(s);
    o.updateMatrix(); salt.setMatrixAt(i, o.matrix);
  }
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.7) * 2.2, s = 0.01 + rnd() * 0.035;
    o.position.set(6.2 + Math.cos(a) * r, TOP + s * 0.5, 6 + Math.sin(a) * r * 0.6);
    o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    o.scale.set(s * (1 + rnd()), s * 0.7, s);
    o.updateMatrix(); crumbs.setMatrixAt(i, o.matrix);
  }
  for (const im of [salt, crumbs]) { im.receiveShadow = true; im.castShadow = false; scene.add(im); }

  // merge everything per material: the whole kitchen is a handful of draw calls
  for (const [key, list] of parts) {
    const g = mergeGeometries(list, false);
    const mesh = new THREE.Mesh(g, m[key]);
    mesh.receiveShadow = key !== 'pane' && key !== 'bulb';
    mesh.castShadow = !['pane', 'floor', 'ceiling', 'bulb', 'splash'].includes(key);
    mesh.matrixAutoUpdate = false;
    if (key === 'pane') mesh.renderOrder = 2;
    scene.add(mesh);
  }
  parts.clear();
}
