import * as THREE from 'three';
import { mesh, box, boxMM, cyl, slab } from './build.js';
import { paint, pbr, canvasTex } from './materials.js';
import { model, place } from './models.js';

// Hallway (x 5.52..6.82, z 0..6.4): a runner rug, a shelf with stuff on it across from the kitchen,
// a jacket on hooks and sneakers on a mat by the front door, a picture on the wall.
export async function buildHallway(ctx) {
  const scene = ctx.scene;
  const rugMat = new THREE.MeshStandardMaterial({ map: runnerTex(), roughness: 1 });
  const rug = mesh(slab(0.7, 5.0, 0.008, 0.03, 0.002), rugMat, { parent: scene, cast: false });
  rug.position.set(6.17, 0, 3.0);
  { const p = rug.geometry.attributes.position, uv = rug.geometry.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.7 + 0.5, p.getZ(i) / 5.0 + 0.5); uv.needsUpdate = true; }
  rugMat.map.wrapS = rugMat.map.wrapT = THREE.ClampToEdgeWrapping;

  // shelf against the west wall, across from the kitchen doorway
  const sh = await model('wooden_display_shelves_01');
  const shelf = place(ctx, sh, { x: 5.52 + 0.19, z: 1.55, height: 1.56, rot: 0 });
  void shelf;
  const plant = await model('potted_plant_04');
  place(ctx, plant, { x: 5.71, y: 1.56, z: 1.3, height: 0.2, collide: false });
  const frame = await model('standing_picture_frame_01');
  const fw = place(ctx, frame, { x: 5.68, y: 1.56, z: 1.85, height: 0.22, rot: Math.PI / 2 + 0.25, collide: false });
  fw.traverse(n => { if (n.isMesh && /artwork/i.test(n.material.name)) { const t = canvasTex(256, 320, photoArt); t.flipY = false; n.material = n.material.clone(); n.material.map = t; } });
  // a stack of books on the middle shelf
  const cols = [0x7a2e2e, 0x1f3a5f, 0x2f4f3a, 0xc9a24a, 0x3a3a40];
  for (let i = 0; i < 5; i++) mesh(box(0.15 + Math.random() * 0.04, 0.03, 0.22, 0.004), paint(cols[i], 0.7), { parent: scene, pos: [5.72, 0.8 + i * 0.031, 1.55 + (Math.random() - 0.5) * 0.03], rot: [0, (Math.random() - 0.5) * 0.2, 0] });

  // coat hooks + a jacket by the front door (east wall)
  const hookBar = paint(0x2a2622, 0.6);
  mesh(box(0.03, 0.06, 0.55, 0.006), hookBar, { parent: scene, pos: [6.82 - 0.015, 1.68, 5.75] });
  for (let i = 0; i < 4; i++) mesh(cyl(0.006, 0.006, 0.05, 8), paint(0x1a1a1a, 0.4, 0.8), { parent: scene, rot: [0, 0, Math.PI / 2], pos: [6.82 - 0.05, 1.68, 5.55 + i * 0.13] });
  const fleece = await pbr('knitted_fleece', { color: 0x1d2a3a, roughness: 1, normal: 0.8, scale: 0.7 });
  const jacketGeo = new THREE.CylinderGeometry(0.17, 0.25, 0.78, 20, 6, true);
  jacketGeo.scale(1, 1, 0.38);
  { const p = jacketGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + 0.05 * Math.sin(y * 11))); } jacketGeo.computeVertexNormals(); }
  const jm = fleece.clone(); jm.side = THREE.DoubleSide;
  mesh(jacketGeo, jm, { parent: scene, pos: [6.82 - 0.12, 1.3, 5.68], rot: [0, Math.PI / 2, 0.04] });
  mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 0.8), jm, { parent: scene, pos: [6.82 - 0.1, 1.66, 5.68], rot: [0, Math.PI / 2, 0.5] });

  // door mat + sneakers
  const matMat = new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (c, W, H) => { c.fillStyle = '#4a3b2c'; c.fillRect(0, 0, W, H); for (let i = 0; i < 2600; i++) { const v = 50 + Math.random() * 50; c.fillStyle = `rgb(${v + 20},${v + 8},${v - 10})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); } c.strokeStyle = '#2b2219'; c.lineWidth = 8; c.strokeRect(6, 6, W - 12, H - 12); }), roughness: 1 });
  const dm = mesh(slab(0.8, 0.5, 0.012, 0.02, 0.003), matMat, { parent: scene, cast: false });
  dm.position.set(6.17, 0, 6.05);
  { const p = dm.geometry.attributes.position, uv = dm.geometry.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.8 + 0.5, p.getZ(i) / 0.5 + 0.5); uv.needsUpdate = true; }
  for (const [x, z, r] of [[5.95, 6.1, 0.15], [6.07, 6.12, -0.1]]) sneaker(scene, x, z, r);
  // a picture on the west wall between the bedroom door and the front door
  const pf = await model('hanging_picture_frame_01');
  const pw = place(ctx, pf, { x: 5.52 + 0.014, y: 0, z: 5.35, rot: Math.PI / 2, height: 0.6, collide: false });
  pw.position.y = 1.5 - pw.userData.size.y / 2;
  pw.traverse(n => { if (n.isMesh && /artwork/i.test(n.material.name)) { const t = canvasTex(512, 720, cityArt); t.flipY = false; n.material = n.material.clone(); n.material.map = t; } });
  return {};
}

function sneaker(scene, x, z, rot) {
  const g = new THREE.Group();
  const upper = new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.7 });
  const sole = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.85 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.6 });
  mesh(box(0.1, 0.03, 0.29, 0.014), sole, { parent: g, pos: [0, 0.015, 0] });
  const u = new THREE.SphereGeometry(1, 24, 12);
  const p = u.attributes.position;
  for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); p.setXYZ(i, p.getX(i) * 0.048, Math.max(0, p.getY(i)) * (0.07 - zz * 0.03), zz * 0.14); }
  u.computeVertexNormals();
  mesh(u, upper, { parent: g, pos: [0, 0.028, 0] });
  mesh(box(0.004, 0.03, 0.12, 0.002), accent, { parent: g, pos: [0.047, 0.05, -0.02] });
  mesh(box(0.004, 0.03, 0.12, 0.002), accent, { parent: g, pos: [-0.047, 0.05, -0.02] });
  g.position.set(x, 0.012, z);
  g.rotation.y = rot;
  scene.add(g);
}

function runnerTex() {
  return canvasTex(256, 1024, (c, W, H) => {
    c.fillStyle = '#5a4436'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#8b6b4f'; c.fillRect(16, 16, W - 32, H - 32);
    c.fillStyle = '#3e2f27'; c.fillRect(30, 30, W - 60, H - 60);
    for (let y = 60; y < H - 60; y += 70) { c.strokeStyle = '#b08d62'; c.lineWidth = 4; c.beginPath(); c.moveTo(W / 2, y); c.lineTo(W - 50, y + 35); c.lineTo(W / 2, y + 70); c.lineTo(50, y + 35); c.closePath(); c.stroke(); }
    const im = c.getImageData(0, 0, W, H);
    for (let i = 0; i < im.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
    c.putImageData(im, 0, 0);
  });
}

function photoArt(c, W, H) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#87a9c9'); g.addColorStop(0.6, '#e8c9a0'); g.addColorStop(1, '#6b5a48');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#3a2f28'; c.beginPath(); c.arc(W * 0.42, H * 0.55, W * 0.11, 0, 7); c.fill();
  c.fillRect(W * 0.3, H * 0.62, W * 0.24, H * 0.38);
  c.fillStyle = '#5c4636'; c.beginPath(); c.arc(W * 0.66, H * 0.6, W * 0.09, 0, 7); c.fill();
  c.fillRect(W * 0.56, H * 0.66, W * 0.2, H * 0.34);
}

function cityArt(c, W, H) {
  c.fillStyle = '#16181f'; c.fillRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, 0, H * 0.7);
  g.addColorStop(0, '#0d1424'); g.addColorStop(1, '#3a2a4a');
  c.fillStyle = g; c.fillRect(0, 0, W, H * 0.7);
  for (let i = 0; i < 14; i++) {
    const w = 20 + Math.random() * 40, h = 120 + Math.random() * 320, x = i * (W / 14);
    c.fillStyle = '#0b0c10'; c.fillRect(x, H * 0.7 - h, w, h + H * 0.3);
    for (let y = H * 0.7 - h + 8; y < H; y += 12) for (let xx = x + 4; xx < x + w - 4; xx += 8) if (Math.random() < 0.35) { c.fillStyle = `rgba(255,${200 + Math.random() * 50},140,${0.5 + Math.random() * 0.5})`; c.fillRect(xx, y, 3, 4); }
  }
  c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = '600 22px Arial'; c.fillText('NIGHT SHIFT  •  2024', 24, H - 26);
}
