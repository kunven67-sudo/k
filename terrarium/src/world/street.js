// Outside: your yard, the street, shops across the road, a cross street, a parking lot,
// a bus stop and the corner of a park. People walk here and cars drive by.
import * as THREE from 'three';
import { Builder, textTexture } from './builder.js';
import { std, texMat, glow, makeTextures } from './materials.js';
import { makeRng } from '../core/util.js';

export const STREET = {
  ground: 3.4,
  road: { z0: 14, z1: 22, x0: -90, x1: 90 },
  cross: { x0: 24, x1: 32, z0: -50, z1: 80 },
  walkNear: 13, walkFar: 23,
};

export function buildStreet(world) {
  makeTextures();
  const g = new THREE.Group();
  g.name = 'street';
  const B = new Builder(g, world.colliders, 'street');
  const G0 = STREET.ground;
  const r = makeRng(5);
  const inter = world.interactables;

  // ground (lawns) - one big walkable box under everything outside the house
  const lawnMat = texMat('lawn', 40, 40, 0xffffff, 1);
  const lawn = B.mesh(new THREE.PlaneGeometry(200, 200), lawnMat, 0, G0, 0, { rot: [-Math.PI / 2, 0, 0], cast: false });
  void lawn;
  // walkable ground except where the house basement is (the house box covers it)
  const ground = (x0, z0, x1, z1) => world.colliders.add(x0, G0 - 1, z0, x1, G0, z1, { zone: 'street', walk: true, solid: false });
  ground(-100, -100, 100, -6.3);
  ground(-100, 6.3, 100, 100);
  ground(-100, -6.3, -7.3, 6.3);
  ground(7.3, -6.3, 100, 6.3);

  // road + lines
  const asph = texMat('asphalt', 30, 2, 0xffffff, 0.95);
  const R = STREET.road, X = STREET.cross;
  B.mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), asph, (R.x0 + R.x1) / 2, G0 + 0.01, (R.z0 + R.z1) / 2, { rot: [-Math.PI / 2, 0, 0], cast: false });
  B.mesh(new THREE.PlaneGeometry(X.x1 - X.x0, X.z1 - X.z0), texMat('asphalt', 2, 30, 0xffffff, 0.95), (X.x0 + X.x1) / 2, G0 + 0.011, (X.z0 + X.z1) / 2, { rot: [-Math.PI / 2, 0, 0], cast: false });
  const lineMat = std(0xf0d040, 0.6);
  for (let x = R.x0; x < R.x1; x += 4) { if (x > X.x0 - 2 && x < X.x1 + 2) continue; B.mesh(new THREE.PlaneGeometry(2, 0.15), lineMat, x + 1, G0 + 0.015, (R.z0 + R.z1) / 2, { rot: [-Math.PI / 2, 0, 0], cast: false }); }
  for (let z = X.z0; z < X.z1; z += 4) { if (z > R.z0 - 2 && z < R.z1 + 2) continue; B.mesh(new THREE.PlaneGeometry(0.15, 2), lineMat, (X.x0 + X.x1) / 2, G0 + 0.016, z + 1, { rot: [-Math.PI / 2, 0, 0], cast: false }); }
  // crosswalk
  for (let i = 0; i < 8; i++) B.mesh(new THREE.PlaneGeometry(0.6, 3), std(0xeeeeee, 0.7), X.x0 - 3 + 0.2, G0 + 0.016, R.z0 + 0.5 + i * 1.0, { rot: [-Math.PI / 2, Math.PI / 2, 0], cast: false });

  // sidewalks (raised 10 cm)
  const sw = texMat('sidewalk', 1, 1, 0xffffff, 0.9);
  const walk = (x0, z0, x1, z1) => {
    const m = B.box(x1 - x0, 0.1, z1 - z0, sw, (x0 + x1) / 2, G0 + 0.05, (z0 + z1) / 2, { walk: true, cast: false });
    const uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 2, uv.getY(i) * (z1 - z0) / 2);
  };
  walk(R.x0, 12, X.x0, 14); walk(X.x1, 12, R.x1, 14);
  walk(R.x0, 22, X.x0, 24); walk(X.x1, 22, R.x1, 24);
  walk(X.x0 - 2, X.z0, X.x0, 12); walk(X.x0 - 2, 24, X.x0, X.z1);
  walk(X.x1, X.z0, X.x1 + 2, 12); walk(X.x1, 24, X.x1 + 2, X.z1);
  // our walkway + driveway
  walk(-0.7, 6.3, 0.7, 12);
  B.mesh(new THREE.PlaneGeometry(3.2, 7.7), texMat('concrete', 1, 2, 0xbbbbbb, 0.9), 9, G0 + 0.006, 8.2, { rot: [-Math.PI / 2, 0, 0], cast: false });

  // street lamps
  world.streetLamps = [];
  for (let x = -84; x <= 84; x += 14) for (const z of [12.4, 23.6]) {
    if (x > X.x0 - 3 && x < X.x1 + 3) continue;
    B.cyl(0.08, 0.1, 5, std(0x2a2f33, 0.4, 0.7), x, G0 + 2.5, z, { seg: 8 });
    const arm = B.mesh(new THREE.BoxGeometry(0.08, 0.08, 1.2), std(0x2a2f33, 0.4, 0.7), x, G0 + 5, z + (z < 18 ? 0.55 : -0.55), { cast: false });
    void arm;
    const bulb = B.mesh(new THREE.BoxGeometry(0.4, 0.1, 0.25), glow(0xffe6b0, 0.2), x, G0 + 4.92, z + (z < 18 ? 1.05 : -1.05), { cast: false });
    world.streetLamps.push(bulb);
  }

  // fences around our yard
  const fence = std(0xe8e4dc, 0.8);
  for (const [x0, z0, x1, z1] of [[-10, -9, 10, -9], [-10, -9, -10, 11.6], [10.6, -9, 10.6, 3]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), along = Math.abs(x1 - x0) > 0.1;
    const n = Math.floor(len / 0.25);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.mesh(new THREE.BoxGeometry(0.08, 1.1, 0.04), fence, x0 + (x1 - x0) * t, G0 + 0.55, z0 + (z1 - z0) * t, { rot: [0, along ? 0 : Math.PI / 2, 0] });
    }
    B.box(along ? len : 0.06, 0.08, along ? 0.06 : len, fence, (x0 + x1) / 2, G0 + 0.85, (z0 + z1) / 2, { col: false });
    world.colliders.addCentered((x0 + x1) / 2, G0 + 0.55, (z0 + z1) / 2, along ? len : 0.1, 1.1, along ? 0.1 : len, { zone: 'street', walk: false });
  }
  // hedges + mailbox
  B.box(5, 0.9, 0.8, std(0x3c6e30, 0.95), -5, G0 + 0.45, 11.4, { round: 0.25 });
  B.box(5, 0.9, 0.8, std(0x3c6e30, 0.95), 5, G0 + 0.45, 11.4, { round: 0.25 });
  B.box(0.1, 1.0, 0.1, std(0x3a2a20, 0.8), 1.4, G0 + 0.5, 11.7);
  B.box(0.3, 0.25, 0.45, std(0x2a4a8a, 0.4, 0.6), 1.4, G0 + 1.1, 11.7, { round: 0.06 });
  // our car in the driveway (you can drive it)
  world.driveway = new THREE.Vector3(9, G0, 8.5);

  // ---- neighbor houses (same side)
  const nb = (cx, cz, w, d, col, roof) => {
    const wall = std(col, 0.9);
    B.box(w, 3.2, d, wall, cx, G0 + 1.6, cz);
    const rf = std(roof, 0.85);
    B.mesh(new THREE.BoxGeometry(w + 0.6, 0.2, d / 2 + 0.9), rf, cx, G0 + 4.15, cz - d / 4, { rot: [0.55, 0, 0] });
    B.mesh(new THREE.BoxGeometry(w + 0.6, 0.2, d / 2 + 0.9), rf, cx, G0 + 4.15, cz + d / 4, { rot: [-0.55, 0, 0] });
    const sh = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, 2.0)]);
    for (const s of [-1, 1]) B.mesh(new THREE.ShapeGeometry(sh), wall, cx + s * w / 2, G0 + 3.2, cz, { rot: [0, Math.PI / 2, 0], cast: false });
    for (let i = 0; i < 3; i++) B.mesh(new THREE.PlaneGeometry(1.2, 1.1), glow(0x1a2630, 0.3), cx - w / 3 + i * w / 3, G0 + 1.8, cz + d / 2 + 0.01, { cast: false });
    B.mesh(new THREE.PlaneGeometry(1.0, 2.1), std(0x5a2a1a, 0.6), cx, G0 + 1.05, cz + d / 2 + 0.012, { cast: false });
  };
  nb(-24, 0, 11, 10, 0xd8c9a8, 0x4a3a35);
  nb(-42, 2, 10, 9, 0xa8c0c8, 0x35404a);
  nb(16, -1, 9, 9, 0xc8a8a0, 0x553333);

  // ---- shops across the street
  const shops = [
    { x0: -26, x1: -10, name: 'FRESH MART', col: 0xc9d6c0, sign: '#2f7a3a' },
    { x0: -10, x1: 1, name: 'BEAN THERE CAFE', col: 0xd8c0a0, sign: '#6b3e1f' },
    { x0: 5, x1: 14, name: 'QUICKRX PHARMACY', col: 0xe0e4ea, sign: '#1f5aa6' },
    { x0: 14, x1: 22, name: 'FADES BARBER', col: 0xb8a0a8, sign: '#8a1f2f' },
    { x0: -44, x1: -27, name: 'SPIN CITY LAUNDRY', col: 0xb0c8d8, sign: '#2a6a8a' },
  ];
  world.shopDoors = [];
  for (const s of shops) {
    const w = s.x1 - s.x0, cx = (s.x0 + s.x1) / 2, cz = 30, d = 12;
    const h = 5 + r() * 3;
    B.box(w - 0.2, h, d, texMat('brick', w / 4, h / 4, s.col, 0.9), cx, G0 + h / 2, cz);
    B.box(w - 0.2, 0.3, 0.6, std(0x333333, 0.6), cx, G0 + h, cz - d / 2 + 0.1, { col: false });
    // glass storefront
    const front = B.mesh(new THREE.PlaneGeometry(w - 2.5, 2.4), new THREE.MeshStandardMaterial({ color: 0x9fd0e8, emissive: 0x2a3a40, roughness: 0.05, metalness: 0.4 }), cx - 0.8, G0 + 1.6, cz - d / 2 - 0.02, { rot: [0, Math.PI, 0], cast: false });
    void front;
    B.mesh(new THREE.PlaneGeometry(1.4, 2.3), std(0x2a3a40, 0.3, 0.5), s.x1 - 1.4, G0 + 1.15, cz - d / 2 - 0.025, { rot: [0, Math.PI, 0], cast: false });
    B.mesh(new THREE.PlaneGeometry(Math.min(w - 1, 9), 1.0), new THREE.MeshBasicMaterial({ map: textTexture(s.name, { w: 1024, h: 128, size: 78, bg: s.sign, color: '#fff' }) }), cx, G0 + 3.2, cz - d / 2 - 0.03, { rot: [0, Math.PI, 0], cast: false });
    // awning
    const aw = B.mesh(new THREE.BoxGeometry(w - 1, 0.08, 1.4), std(parseInt(s.sign.slice(1), 16), 0.7), cx, G0 + 2.75, cz - d / 2 - 0.65, { rot: [0.25, 0, 0] });
    void aw;
    world.shopDoors.push(new THREE.Vector3(s.x1 - 1.4, G0 + 0.1, cz - d / 2 - 0.6));
  }
  // alley between cafe and pharmacy: dumpster + boxes
  B.box(1.8, 1.3, 1.1, std(0x2f5a3a, 0.6, 0.4), 3, G0 + 0.65, 27.5, { round: 0.05 });
  for (let i = 0; i < 4; i++) B.box(0.5, 0.4, 0.5, std(0xb08a5a, 0.9), 2 + i * 0.5, G0 + 0.2 + (i % 2) * 0.4, 26.2, { round: 0.02 });

  // ---- bus stop
  const bs = { x: -30, z: 12.8 };
  B.box(3.2, 0.08, 1.4, std(0x2a3a44, 0.4, 0.6), bs.x, G0 + 2.5, bs.z - 0.2, { col: false });
  for (const dx of [-1.5, 1.5]) B.box(0.08, 2.4, 0.08, std(0x2a3a44, 0.4, 0.6), bs.x + dx, G0 + 1.3, bs.z - 0.8);
  B.mesh(new THREE.PlaneGeometry(3, 2.2), new THREE.MeshStandardMaterial({ color: 0xbfd8e8, transparent: true, opacity: 0.3 }), bs.x, G0 + 1.3, bs.z - 0.85, { cast: false });
  B.box(2.4, 0.08, 0.45, texMat('wood', 1, 1, 0x8a6a4a, 0.7), bs.x, G0 + 0.55, bs.z - 0.55, { walk: true });
  B.mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: textTexture('BUS\n12', { w: 128, h: 128, size: 44, bg: '#1f5aa6' }) }), bs.x + 1.9, G0 + 2.6, bs.z - 0.2, { cast: false });
  B.cyl(0.04, 0.04, 2.8, std(0x777777, 0.4, 0.8), bs.x + 1.9, G0 + 1.4, bs.z - 0.2, { seg: 6 });

  // ---- park corner
  const park = { x0: -88, x1: -50, z0: -30, z1: 11 };
  B.mesh(new THREE.PlaneGeometry(park.x1 - park.x0, park.z1 - park.z0), texMat('lawn', 12, 12, 0xa8d090, 1), (park.x0 + park.x1) / 2, G0 + 0.004, (park.z0 + park.z1) / 2, { rot: [-Math.PI / 2, 0, 0], cast: false });
  const trunk = std(0x5b3d26, 0.95), leaf = std(0x3f7a32, 0.85), leaf2 = std(0x4f8c3a, 0.85);
  const tree = (x, z, s) => {
    B.cyl(0.18 * s, 0.25 * s, 3 * s, trunk, x, G0 + 1.5 * s, z, { seg: 8 });
    B.mesh(new THREE.IcosahedronGeometry(1.8 * s, 1), leaf, x, G0 + 3.6 * s, z);
    B.mesh(new THREE.IcosahedronGeometry(1.2 * s, 1), leaf2, x + 0.8 * s, G0 + 4.3 * s, z - 0.4 * s);
  };
  for (let i = 0; i < 16; i++) tree(park.x0 + 3 + r() * (park.x1 - park.x0 - 6), park.z0 + 3 + r() * (park.z1 - park.z0 - 8), 0.9 + r() * 0.6);
  for (let i = 0; i < 6; i++) tree(-60 + i * 22 + r() * 4, 9 + r() * 1.5, 0.8 + r() * 0.3);
  for (let i = 0; i < 4; i++) {
    const x = park.x0 + 8 + i * 8, z = 5;
    B.box(1.8, 0.06, 0.5, texMat('wood', 1, 1, 0x8a6a4a, 0.7), x, G0 + 0.45, z, { walk: true });
    B.box(1.8, 0.4, 0.06, texMat('wood', 1, 1, 0x8a6a4a, 0.7), x, G0 + 0.75, z - 0.25, { col: false });
  }
  B.mesh(new THREE.PlaneGeometry(2, 60), std(0xc8b890, 1), -70, G0 + 0.006, -2, { rot: [-Math.PI / 2, 0, 0.6], cast: false });

  // ---- parking lot past the cross street
  const pl = { x0: 34, x1: 60, z0: -8, z1: 11 };
  B.mesh(new THREE.PlaneGeometry(pl.x1 - pl.x0, pl.z1 - pl.z0), texMat('asphalt', 6, 4, 0xdddddd, 0.95), (pl.x0 + pl.x1) / 2, G0 + 0.008, (pl.z0 + pl.z1) / 2, { rot: [-Math.PI / 2, 0, 0], cast: false });
  for (let i = 0; i < 9; i++) B.mesh(new THREE.PlaneGeometry(0.12, 5), std(0xeeeeee, 0.7), pl.x0 + 2 + i * 2.8, G0 + 0.012, pl.z0 + 3, { rot: [-Math.PI / 2, 0, 0], cast: false });
  world.parkingSpots = [];
  for (let i = 0; i < 8; i++) world.parkingSpots.push(new THREE.Vector3(pl.x0 + 3.4 + i * 2.8, G0, pl.z0 + 3));
  B.box(14, 6, 10, texMat('brick', 4, 2, 0xb8b8c8, 0.9), 48, G0 + 3, -16);
  B.mesh(new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ map: textTexture('MEGA HARDWARE', { w: 1024, h: 128, size: 80, bg: '#c25a10' }) }), 48, G0 + 4.5, -10.98, { cast: false });

  // far scenery: low hills so the world doesn't just end
  const hillMat = std(0x587a48, 1);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    B.mesh(new THREE.SphereGeometry(30 + r() * 20, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hillMat, Math.cos(a) * 150, G0 - 8, Math.sin(a) * 150, { cast: false, scale: [1.6, 0.5, 1] });
  }
  inter.push({ id: 'busstop', label: 'Bus stop', pos: new THREE.Vector3(bs.x, G0 + 1, bs.z), r: 1.5, zone: 'street', passive: true });
  world.streetGroup = g;
  return g;
}
