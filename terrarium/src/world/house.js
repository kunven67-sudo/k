// Your house, right on top of the lab. A bookshelf hides the stairs down.
import * as THREE from 'three';
import { Builder, textTexture } from './builder.js';
import { std, texMat, glow, roundedBox } from './materials.js';
import { makeRng } from '../core/util.js';

export const HOUSE = { x0: -7.3, x1: 7.3, z0: -6.3, z1: 6.3, floor: 3.4, ceil: 6.3 };

export function buildHouse(world) {
  const g = new THREE.Group();
  g.name = 'house';
  const B = new Builder(g, world.colliders, 'house');
  const inter = world.interactables;
  const F = HOUSE.floor, C = HOUSE.ceil;
  const r = makeRng(12);

  // floor finishes (slab collider is part of the lab ceiling)
  const wood = texMat('wood', 6, 5, 0xc4a27c, 0.7);
  const fl = B.mesh(new THREE.PlaneGeometry(14.3, 12.3), wood, 0, F + 0.002, 0, { rot: [-Math.PI / 2, 0, 0], cast: false });
  void fl;
  // exterior walls with door + windows
  const ext = texMat('siding', 1, 1, 0xffffff, 0.9);
  const inner = texMat('wallpaper', 1, 1, 0xffffff, 0.95);
  const win = (from, to) => ({ from, to, y0: F + 1.0, y1: F + 2.3 });
  B.wall(-7.3, 6.15, 7.3, 6.15, F, C, 0.3, ext, [{ from: -0.6, to: 0.6, y0: F, y1: F + 2.2 }, win(-5, -3), win(3, 5)]);
  B.wall(-7.3, -6.15, 7.3, -6.15, F, C, 0.3, ext, [win(-3, -1), win(2, 4.5)]);
  B.wall(-7.15, -6.3, -7.15, 6.3, F, C, 0.3, ext, [win(-4.5, -2.5)]);
  B.wall(7.15, -6.3, 7.15, 6.3, F, C, 0.3, ext, [win(-2, 0), win(2.5, 4.5)]);
  // inner face color: thin panels inside so the inside looks like wallpaper
  for (const [x, z, w, d, ry] of [[0, 5.99, 14.2, 0.02, 0], [0, -5.99, 14.2, 0.02, 0], [-6.99, 0, 0.02, 12.2, 0], [6.99, 0, 0.02, 12.2, 0]]) {
    const m = B.box(w, C - F, d, inner, x, (F + C) / 2, z, { col: false, cast: false });
    void ry; m.visible = false; // (kept for future interior trim)
  }
  // glass in windows
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9fc4d8, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.3 });
  const winGlass = [[-4, 6.15, 2, 0], [4, 6.15, 2, 0], [-2, -6.15, 2, 0], [3.25, -6.15, 2.5, 0], [-7.15, -3.5, 2, 1], [7.15, -1, 2, 1], [7.15, 3.5, 2, 1]];
  for (const [x, z, w, side] of winGlass) {
    const m = B.mesh(new THREE.PlaneGeometry(w, 1.3), glassM, x, F + 1.65, z, { rot: [0, side ? Math.PI / 2 : 0, 0], cast: false });
    m.renderOrder = 3;
    world.colliders.addCentered(x, F + 1.65, z, side ? 0.1 : w, 1.3, side ? w : 0.1, { zone: 'house', walk: false });
  }
  // ceiling + roof
  B.box(14.6, 0.2, 12.6, std(0xeeeae2, 0.95), 0, C + 0.1, 0, { cast: false });
  const roofMat = std(0x5a3a32, 0.85);
  const roofL = B.mesh(new THREE.BoxGeometry(15.4, 0.25, 7.6), roofMat, 0, C + 1.6, -3.1, { rot: [0.5, 0, 0] });
  const roofR = B.mesh(new THREE.BoxGeometry(15.4, 0.25, 7.6), roofMat, 0, C + 1.6, 3.1, { rot: [-0.5, 0, 0] });
  void roofL; void roofR;
  const gable = new THREE.Shape([new THREE.Vector2(-6.3, 0), new THREE.Vector2(6.3, 0), new THREE.Vector2(0, 3.3)].map((v) => v));
  for (const x of [-7.15, 7.15]) B.mesh(new THREE.ShapeGeometry(gable), std(0xb8c4c9, 0.9, 0, { side: THREE.DoubleSide }), x, C + 0.2, 0, { rot: [0, Math.PI / 2, 0], cast: false });
  world.colliders.addCentered(0, C + 1.8, 0, 14.6, 3.2, 12.6, { zone: 'house', walk: true });

  // ---- secret closet around the stairs + bookshelf door
  const cw = std(0xd8cdb8, 0.95);
  B.wall(-5.4, -0.35, -5.4, 4.0, F, C, 0.15, cw, [{ from: -0.25, to: 0.95, y0: F, y1: F + 2.25 }]);
  B.wall(-7.0, -0.35, -5.4, -0.35, F, C, 0.15, cw);
  B.wall(-7.0, 4.0, -5.4, 4.0, F, C, 0.15, cw);
  // the bookshelf (door)
  const shelf = new THREE.Group();
  const sw = 1.2, sh = 2.25, sd = 0.32;
  const sMat = texMat('wood', 1, 2, 0x7a5236, 0.8);
  const bx = (w, h, d, x, y, z, m = sMat) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mm.position.set(x, y, z); mm.castShadow = mm.receiveShadow = true; shelf.add(mm); return mm; };
  bx(sw, 0.04, sd, 0, 0.02, 0); bx(sw, 0.04, sd, 0, sh - 0.02, 0);
  bx(0.04, sh, sd, -sw / 2 + 0.02, sh / 2, 0); bx(0.04, sh, sd, sw / 2 - 0.02, sh / 2, 0); bx(sw, sh, 0.02, 0, sh / 2, -sd / 2 + 0.01);
  for (let s = 1; s < 5; s++) {
    const y = s * (sh / 5);
    bx(sw, 0.03, sd, 0, y, 0);
    let x = -sw / 2 + 0.06;
    while (x < sw / 2 - 0.08) {
      const w = 0.03 + r() * 0.04, h = 0.2 + r() * 0.17;
      const book = bx(w, h, 0.22, x + w / 2, y - (sh / 5) + 0.03 + h / 2 + 0.02, 0.02, std([0x8a2f2f, 0x2f4a8a, 0x2f7a4a, 0xc0a040, 0x5a3a7a, 0x1a1a1a, 0xd06030][(r() * 7) | 0], 0.7));
      book.rotation.z = r() < 0.08 ? 0.15 : 0;
      x += w + 0.004;
    }
  }
  const pivot = new THREE.Group();
  pivot.position.set(-5.4, F, -0.25);
  shelf.position.set(0, 0, 0.6);
  shelf.rotation.y = Math.PI / 2;
  shelf.position.x = 0.0;
  pivot.add(shelf);
  g.add(pivot);
  const shelfBox = world.colliders.addCentered(-5.4, F + sh / 2, 0.35, 0.34, sh, 1.2, { zone: 'house', walk: false });
  world.bookshelf = { pivot, box: shelfBox, open: false, t: 0 };
  inter.push({ id: 'bookshelf', label: 'Bookshelf', pos: new THREE.Vector3(-5.3, F + 1.2, 0.35), r: 0.7, zone: 'house' });
  inter.push({ id: 'bookshelf', label: 'Bookshelf (secret door)', pos: new THREE.Vector3(-5.6, F + 1.2, 0.35), r: 0.5, zone: 'house' });

  // ---- front door
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.6, F, 6.15);
  const door = new THREE.Mesh(roundedBox(1.2, 2.2, 0.06, 0.01), std(0x6b2f22, 0.6));
  door.position.set(0.6, 1.1, 0);
  door.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), std(0xd8b04a, 0.3, 0.9));
  knob.position.set(1.05, 1.05, 0.06);
  doorPivot.add(door, knob);
  g.add(doorPivot);
  const doorBox = world.colliders.addCentered(0, F + 1.1, 6.15, 1.2, 2.2, 0.12, { zone: 'house', walk: false });
  world.frontDoor = { pivot: doorPivot, box: doorBox, open: false, t: 0 };
  inter.push({ id: 'frontdoor', label: 'Front door', pos: new THREE.Vector3(0, F + 1.1, 6.15), r: 0.8, zone: 'house' });

  // ---- living room
  const rug = B.mesh(new THREE.PlaneGeometry(4.2, 3), texMat('carpet', 2, 2, 0xb07a5a, 1), 2.2, F + 0.006, 2.2, { rot: [-Math.PI / 2, 0, 0], cast: false });
  void rug;
  // couch facing the TV (TV on the east wall)
  const couch = std(0x3e5a6e, 0.9);
  B.box(0.95, 0.45, 2.6, couch, 0.3, F + 0.225, 2.2, { round: 0.08, walk: true });
  B.box(0.3, 0.55, 2.6, couch, -0.05, F + 0.62, 2.2, { round: 0.1, col: false });
  for (const dz of [-1.25, 1.25]) B.box(0.95, 0.65, 0.22, couch, 0.3, F + 0.33, 2.2 + dz, { round: 0.08 });
  for (const dz of [-0.6, 0.6]) B.box(0.65, 0.16, 1.15, std(0x48667c, 0.95), 0.4, F + 0.52, 2.2 + dz, { round: 0.07, col: false });
  // coffee table
  B.box(0.8, 0.05, 1.3, texMat('wood', 1, 1, 0x8a6040, 0.6), 1.9, F + 0.42, 2.2, { walk: true });
  for (const [dx, dz] of [[-0.35, -0.6], [0.35, -0.6], [-0.35, 0.6], [0.35, 0.6]]) B.box(0.05, 0.4, 0.05, std(0x2a2a2a, 0.5), 1.9 + dx, F + 0.2, 2.2 + dz, { col: false });
  B.box(0.1, 0.12, 0.08, std(0xd04a3a, 0.4), 1.8, F + 0.5, 2.0, { col: false });
  // TV + stand
  B.box(0.5, 0.55, 2.0, texMat('wood', 1, 1, 0x3a2a20, 0.6), 6.6, F + 0.275, 2.2, { walk: true });
  B.box(0.06, 0.95, 1.7, std(0x0b0b0b, 0.25, 0.3), 6.65, F + 1.15, 2.2);
  const tvScreen = B.mesh(new THREE.PlaneGeometry(1.62, 0.88), new THREE.MeshBasicMaterial({ color: 0x1a2a3a }), 6.61, F + 1.15, 2.2, { rot: [0, -Math.PI / 2, 0], cast: false });
  world.tvScreen = tvScreen;
  inter.push({ id: 'tv', label: 'TV', pos: new THREE.Vector3(6.6, F + 1.15, 2.2), r: 0.8, zone: 'house' });
  // floor lamp
  B.cyl(0.18, 0.2, 0.04, std(0x222222, 0.4, 0.6), -0.4, F + 0.02, 4.1);
  B.mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 8), std(0x222222, 0.4, 0.6), -0.4, F + 0.82, 4.1);
  B.mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.3, 16, 1, true), std(0xf0e0c0, 0.8, 0, { side: THREE.DoubleSide, emissive: 0x806a40, emissiveIntensity: 0.4 }), -0.4, F + 1.7, 4.1, { cast: false });
  B.light('point', 0xffe0b0, 3.5, -0.4, F + 1.6, 4.1, { dist: 8, decay: 1.6 });
  // armchair
  B.box(0.85, 0.45, 0.85, std(0x7a4a3a, 0.9), 3.6, F + 0.225, 4.6, { round: 0.08, walk: true });
  B.box(0.85, 0.5, 0.2, std(0x7a4a3a, 0.9), 3.6, F + 0.6, 5.0, { round: 0.08, col: false });

  // ---- kitchen (north-east)
  const counter = std(0xe8e4dc, 0.5);
  const cab = std(0x4f6f6a, 0.6);
  B.box(5.0, 0.9, 0.65, cab, 3.8, F + 0.45, -5.65, { walk: true });
  B.box(5.1, 0.05, 0.7, counter, 3.8, F + 0.925, -5.65, { col: false });
  B.box(0.65, 0.9, 2.4, cab, 6.65, F + 0.45, -4.0, { walk: true });
  B.box(0.7, 0.05, 2.5, counter, 6.65, F + 0.925, -4.0, { col: false });
  B.box(0.8, 1.9, 0.75, std(0xd8dcdc, 0.3, 0.5), 0.9, F + 0.95, -5.6, { round: 0.04 });
  B.box(0.03, 0.5, 0.03, std(0x777777, 0.3, 0.9), 1.25, F + 1.3, -5.2, { col: false });
  inter.push({ id: 'fridge', label: 'Fridge (food)', pos: new THREE.Vector3(0.9, F + 1.0, -5.3), r: 0.6, zone: 'house' });
  // sink + stove
  B.box(0.6, 0.03, 0.45, std(0xb0b6b8, 0.2, 0.9), 3.0, F + 0.95, -5.6, { col: false });
  for (const dx of [-0.15, 0.15]) for (const dz of [-0.12, 0.12]) B.mesh(new THREE.TorusGeometry(0.07, 0.01, 6, 16), std(0x222222, 0.5), 5.2 + dx, F + 0.955, -5.6 + dz, { rot: [Math.PI / 2, 0, 0], cast: false });
  // dining table + chairs
  B.box(1.6, 0.06, 1.0, texMat('wood', 1, 1, 0xa07a50, 0.6), 3.6, F + 0.76, -2.6, { walk: true });
  for (const [dx, dz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) B.box(0.06, 0.73, 0.06, std(0x5a3a22, 0.6), 3.6 + dx, F + 0.365, -2.6 + dz, { col: false });
  for (const [dx, dz] of [[-0.45, -0.8], [0.45, -0.8], [-0.45, 0.8], [0.45, 0.8]]) {
    B.box(0.45, 0.05, 0.45, std(0x5a3a22, 0.7), 3.6 + dx, F + 0.46, -2.6 + dz);
    B.box(0.45, 0.5, 0.05, std(0x5a3a22, 0.7), 3.6 + dx, F + 0.72, -2.6 + dz + (dz < 0 ? -0.2 : 0.2), { col: false });
  }
  // ceiling lights
  for (const [x, z] of [[2, 2], [3.6, -3], [-3, -3]]) {
    B.mesh(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow(0xfff2dc, 1.2), x, C - 0.02, z, { rot: [Math.PI, 0, 0], cast: false });
  }
  B.light('point', 0xfff2dc, 7, 2, C - 0.4, 0, { dist: 12, decay: 1.4 });
  B.light('point', 0xfff2dc, 5, 3.6, C - 0.4, -3.5, { dist: 9, decay: 1.6 });
  // hallway decor: picture frames, plant
  for (const [x, z] of [[-3, 6.0], [-1.8, 6.0]]) B.box(0.6, 0.45, 0.03, std(0x1a1a1a, 0.5), x, F + 1.7, z - 0.03, { col: false });
  B.cyl(0.18, 0.14, 0.35, std(0xb0552f, 0.8), -6.5, F + 0.175, 5.5);
  B.mesh(new THREE.IcosahedronGeometry(0.35, 1), std(0x3f7a3a, 0.9), -6.5, F + 0.7, 5.5);
  // welcome mat + house number outside
  B.mesh(new THREE.PlaneGeometry(1.0, 0.6), std(0x6a4a2a, 1), 0, F + 0.004, 6.7, { rot: [-Math.PI / 2, 0, 0], cast: false });
  B.mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: textTexture('1428', { w: 256, h: 128, size: 80, bg: '#1d1d1d', color: '#e9d9a0' }) }), 1.2, F + 2.0, 6.31, { cast: false });
  world.houseGroup = g;
  return g;
}
