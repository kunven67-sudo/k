// The plaza parking lot's real-world bits: a concrete sidewalk + fire lane along the store fronts,
// yellow bollards at the doors, concrete wheel stops at every stall, blue accessible stalls
// near the doors, tall double-head lot lights (lit at night), a cart corral, trash cans,
// a bench and a Walmort ice freezer.
//
//   buildLot(world, B, root, stalls)   // stalls: [{ x, z, row }] from town.js

import * as THREE from 'three';
import { mat } from '../gfx/materials.js';
import { canvasTexture } from '../gfx/textures.js';
import { CURB, STORES } from './layout.js';
import { cartRow } from './cart.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Y = CURB;
export const LOT_CORRAL_Z = -35.4; // a stall centre in the near row

function iceBoxMat() {
  const tex = canvasTexture('ice-freezer', 256, 192, (c, w, h) => {
    c.fillStyle = '#f4f7fa';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#1a6fd1';
    c.fillRect(0, 18, w, 92);
    c.fillStyle = '#ffffff';
    c.font = '900 76px Inter, Arial, sans-serif';
    c.textAlign = 'center';
    c.fillText('ICE', w / 2, 92);
    c.fillStyle = '#1a3a66';
    c.font = 'bold 20px Inter, Arial';
    c.fillText('PAY INSIDE  -  $2.99 BAG', w / 2, 150);
  });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.1 });
}

function accessibleMat() {
  const tex = canvasTexture('accessible-stall', 256, 256, (c, w, h) => {
    c.fillStyle = '#1f5fbf';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = '#ffffff';
    c.fillStyle = '#ffffff';
    c.lineWidth = 14;
    c.lineCap = 'round';
    // Wheelchair symbol: head, back, seat, wheel.
    c.beginPath();
    c.arc(118, 52, 18, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(112, 84);
    c.lineTo(112, 150);
    c.lineTo(170, 150);
    c.lineTo(190, 200);
    c.moveTo(112, 112);
    c.lineTo(160, 112);
    c.stroke();
    c.beginPath();
    c.arc(118, 168, 46, Math.PI * 0.15, Math.PI * 1.55);
    c.stroke();
  });
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, transparent: true, opacity: 0.92 });
}

/**
 * Pools of light on the ground under lamps (the real lights only reach a few lamps near you on
 * a GT 1030; these glow decals make every lamp read as lit). One additive mesh for all of them,
 * following the lamp glow switch (world.js turns lampMat on at night and shows the mesh).
 */
export function lightPools(root, points, lampMat, size) {
  const poolTex = canvasTexture('light-pool', 128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,236,200,0.85)');
    g.addColorStop(0.45, 'rgba(255,226,180,0.35)');
    g.addColorStop(1, 'rgba(255,220,170,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  const geos = points.map((p) => {
    const g = new THREE.PlaneGeometry(size, size);
    g.rotateX(-Math.PI / 2);
    g.translate(p.x, p.y, p.z);
    return g;
  });
  const mat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.renderOrder = 2;
  mesh.visible = false;
  mesh.onBeforeRender = () => {
    mat.opacity = Math.min(1, lampMat.emissiveIntensity / 3) * 0.55;
  };
  root.add(mesh);
  return mesh;
}

export function buildLot(world, B, root, stalls, lampMat) {
  const concrete = mat('sidewalk', { wear: 0.25, dirt: 0.3 });
  const curb = mat('curb', {});
  const yellowPaint = mat('metal-painted', { color: 0xe8b81e, wear: 0.35, dirt: 0.3 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: 0.75 });
  const stopMat = mat('concrete', { wear: 0.5, dirt: 0.5 });
  const top = (m) => [m, m, m, null, m, m];

  // Sidewalk apron + painted fire lane in front of every store.
  for (const def of Object.values(STORES)) {
    const { x0, z0, z1 } = def;
    const zc = (z0 + z1) / 2;
    B.box(x0 - 1.8, Y + 0.012, zc, 3.6, 0.024, z1 - z0 + 1, top(concrete), { collide: false, shadow: false });
    B.box(x0 - 3.62, Y + 0.012, zc, 0.06, 0.026, z1 - z0 + 1, top(curb), { collide: false, shadow: false });
    // Red fire lane stripe + "FIRE LANE" stencils every ~8 m.
    B.box(x0 - 3.9, Y + 0.008, zc, 0.15, 0.01, z1 - z0 - 1, top(red), { collide: false, shadow: false });
    // Bollards either side of the doors (yellow steel posts, filled with concrete).
    for (const dz of [-3.3, -2.2, 2.2, 3.3]) {
      const bx = x0 - 1.0;
      const bz = zc + dz;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 12), yellowPaint);
      post.position.set(bx, Y + 0.5, bz);
      post.castShadow = true;
      B.mesh(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), yellowPaint);
      cap.position.set(bx, Y + 1.0, bz);
      B.mesh(cap);
      world.physics.addStaticBox({ x: bx, y: Y + 0.5, z: bz }, { x: 0.2, y: 1.0, z: 0.2 }, null);
    }
    // Trash can by the door.
    B.model('home', 'Trashcan_Large', { x: x0 - 0.6, y: Y, z: zc + 4.6, rotY: -Math.PI / 2, collide: [0.6, 1.0, 0.6] });
    // Bench on the other side.
    const wood = mat('wood', { color: 0x6e5236, wear: 0.4, dirt: 0.3 });
    const iron = mat('metal-painted', { color: 0x23262a, wear: 0.3 });
    B.box(x0 - 0.45, Y + 0.45, zc - 6.2, 0.45, 0.06, 1.6, wood);
    B.box(x0 - 0.22, Y + 0.75, zc - 6.2, 0.05, 0.4, 1.6, wood, { collide: false });
    for (const s of [-0.7, 0.7]) B.box(x0 - 0.45, Y + 0.22, zc - 6.2 + s, 0.45, 0.45, 0.06, iron, { collide: false });
    if (def.id === 'grocery') {
      // Ice freezer against the front wall.
      const ice = iceBoxMat();
      const white = mat('metal-painted', { color: 0xf0f2f4, wear: 0.15, dirt: 0.2 });
      // A real mesh (not B.box): the label needs whole-face UVs, not world-tiled ones.
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 1.5), [white, ice, white, white, white, white]);
      box.position.set(x0 - 0.5, Y + 0.85, zc - 9);
      box.castShadow = true;
      root.add(box);
      world.physics.addStaticBox({ x: x0 - 0.5, y: Y + 0.85, z: zc - 9 }, { x: 0.9, y: 1.7, z: 1.5 }, null);
    }
  }

  // Wheel stops at the head of every stall + blue accessible stalls closest to the doors.
  const acc = accessibleMat();
  for (const s of stalls) {
    B.box(s.headX, Y + 0.07, s.z, 0.2, 0.14, 1.8, stopMat, { collide: false });
    if (s.acc) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), acc);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.PI / 2;
      m.position.set(s.x, Y + 0.016, s.z);
      m.renderOrder = 1;
      root.add(m);
    }
  }

  // Tall lot lights: square pole + two heads, lit at night.
  const pole = mat('metal-painted', { color: 0x4a4e52, wear: 0.3, dirt: 0.3 });
  const head = mat('metal-painted', { color: 0x2c2f33, wear: 0.2 });
  const lens = lampMat;
  const lamps = [];
  for (let i = 0, z = -72; z <= 12; z += 21, i++) {
    const x = i % 2 ? 92.3 : 109.7;
    B.box(x, Y + 0.4, z, 0.6, 0.8, 0.6, stopMat); // concrete base
    B.box(x, Y + 4.8, z, 0.18, 8, 0.18, pole);
    for (const s of [-1, 1]) {
      B.box(x + s * 0.9, Y + 8.75, z, 1.6, 0.08, 0.08, pole, { collide: false });
      B.box(x + s * 1.7, Y + 8.7, z, 0.9, 0.18, 0.6, head, { collide: false });
      B.box(x + s * 1.7, Y + 8.6, z, 0.8, 0.02, 0.5, lens, { collide: false, shadow: false });
      lamps.push(world.lights.addLamp(new THREE.Vector3(x + s * 1.7, Y + 8.4, z), { color: 0xfff0d8, intensity: 60, range: 22 }));
    }
  }

  // Cart corral in a stall of the far row.
  const cz = LOT_CORRAL_Z;
  const steel = mat('steel', { wear: 0.3, dirt: 0.3 });
  for (const s of [-1, 1]) B.box(106, Y + 0.85, cz + s * 1.1, 4.6, 0.05, 0.05, steel, { collide: false });
  for (const s of [-1, 1]) B.box(106, Y + 0.45, cz + s * 1.1, 4.6, 0.05, 0.05, steel, { collide: false });
  for (const dx of [-2.3, 0, 2.3]) for (const s of [-1, 1]) B.box(106 + dx, Y + 0.45, cz + s * 1.1, 0.06, 0.9, 0.06, steel, { collide: false });
  B.box(108.3, Y + 0.85, cz, 0.05, 0.05, 2.2, steel, { collide: false });
  world.physics.addStaticBox({ x: 106, y: Y + 0.5, z: cz }, { x: 4.6, y: 1.0, z: 2.3 }, null);
  const sign = canvasTexture('cart-return', 256, 128, (c, w, h) => {
    c.fillStyle = '#1a5fb4';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.font = 'bold 34px Inter, Arial';
    c.fillText('CART', w / 2, 52);
    c.fillText('RETURN', w / 2, 96);
  });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: sign, side: THREE.DoubleSide }));
  sm.position.set(103.6, Y + 1.5, cz);
  sm.rotation.y = -Math.PI / 2;
  root.add(sm);
  B.box(103.62, Y + 0.75, cz, 0.05, 1.5, 0.05, steel, { collide: false });
  cartRow(root, [0, 1, 2].map((i) => ({ x: 104.6 + i * 0.32, y: Y, z: cz, rotY: 0 })));
  const heads = [];
  for (let i = 0, z = -72; z <= 12; z += 21, i++) {
    const x = i % 2 ? 92.3 : 109.7;
    for (const s of [-1, 1]) heads.push(new THREE.Vector3(x + s * 1.7, Y + 0.03, z));
  }
  const poolMesh = lightPools(root, heads, lampMat, 13);
  return { lamps, poolMesh };
}
