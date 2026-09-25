// Furniture & prop builders shared by the house and yard. Every builder adds meshes to a parent
// and (optionally) registers matching colliders in the physics world. Units are centimetres,
// so a 1.8-unit-tall player is exactly 1/100th of a real person.
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as TX from '../core/textures.js';
import { mulberry32 } from '../core/noise.js';

const geoCache = new Map();
export function rbox(w, h, d, r = 0.5, seg = 2) {
  const k = `rb${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}_${r}_${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01)));
  return geoCache.get(k);
}

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, { cast = true, receive = true, ry = 0, rx = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast; m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}

// Materials for the whole house, created once.
export function houseMaterials() {
  const planks = TX.woodPlanks({ light: 0xc49a6c, dark: 0x8a5d36, rows: 6, seed: 1 });
  const m = {};
  m.floorWood = TX.pbr(planks, { roughness: 1, envMapIntensity: 0.9 }, true);
  m.floorWood.clearcoat = 0.35; m.floorWood.clearcoatRoughness = 0.35;
  m.wallBed = TX.pbr(TX.plaster({ color: 0xa9bccc, seed: 5 }), { roughness: 1 });
  m.wallLiving = TX.pbr(TX.plaster({ color: 0xe0d3bf, seed: 6 }), { roughness: 1 });
  m.wallKitchen = TX.pbr(TX.plaster({ color: 0xece8df, seed: 7 }), { roughness: 1 });
  m.wallBath = TX.pbr(TX.tiles({ color: 0xcfe3e2, grout: 0xa7b5b3, n: 6, seed: 8 }), { roughness: 1, envMapIntensity: 1.2 });
  m.ceiling = TX.pbr(TX.plaster({ color: 0xf2efe8, seed: 9 }), { roughness: 1 });
  m.tileKitchen = TX.pbr(TX.tiles({ color: 0xc9c0b0, grout: 0x6f6a60, n: 4, seed: 10, variation: 0.12 }), { roughness: 1, envMapIntensity: 1 });
  m.tileBath = TX.pbr(TX.tiles({ color: 0x9aa4ab, grout: 0xd8dcdc, n: 8, seed: 11 }), { roughness: 1 });
  m.woodDark = TX.pbr(TX.wood({ light: 0x6e4a2e, dark: 0x3f2616, seed: 12 }), { roughness: 0.9 });
  m.woodLight = TX.pbr(TX.wood({ light: 0xd4b28a, dark: 0xa27a52, seed: 13 }), { roughness: 0.9 });
  m.woodWhite = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.55 });
  m.trim = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.45 });
  m.door = TX.pbr(TX.wood({ light: 0xeeeae2, dark: 0xd9d3c7, seed: 14, scale: 0.3 }), { roughness: 0.6 });
  m.metal = TX.pbr(TX.metal({ color: 0xc0c4ca }), { metalness: 1, roughness: 1 });
  m.brass = TX.pbr(TX.metal({ color: 0xc9a45c, seed: 15 }), { metalness: 1, roughness: 1 });
  m.blackMetal = new THREE.MeshStandardMaterial({ color: 0x1d1e20, metalness: 0.7, roughness: 0.45 });
  m.duvet = TX.pbr(TX.withRepeat(TX.fabric({ color: 0x3f5f8f, color2: 0xe8e4da, pattern: 'plaid', weave: 120, seed: 16 }), 2), { roughness: 1, sheen: 0.7, sheenColor: new THREE.Color(0x9ab0d8), sheenRoughness: 0.8 }, true);
  m.sheet = TX.pbr(TX.withRepeat(TX.fabric({ color: 0xdedad2, weave: 140, seed: 17 }), 4), { roughness: 1, sheen: 0.6, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.8 }, true);
  m.pillow = TX.pbr(TX.withRepeat(TX.fabric({ color: 0xe2ded6, weave: 150, seed: 18 }), 3), { roughness: 1, sheen: 0.7, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.7 }, true);
  m.sofa = TX.pbr(TX.withRepeat(TX.fabric({ color: 0x5b6470, weave: 70, seed: 19 }), 5), { roughness: 1, sheen: 0.8, sheenColor: new THREE.Color(0x9aa5b5), sheenRoughness: 0.8 }, true);
  m.cushion = TX.pbr(TX.fabric({ color: 0xc86a3c, color2: 0x9c4a26, pattern: 'stripe', weave: 70, seed: 20 }), { roughness: 1, sheen: 0.7, sheenColor: new THREE.Color(0xffb080), sheenRoughness: 0.8 }, true);
  m.rugBed = TX.pbr(TX.carpet({ color: 0x7a8aa0, seed: 21 }), { roughness: 1 });
  m.rugLiving = TX.pbr(TX.carpet({ color: 0x9a5a3c, seed: 22 }), { roughness: 1 });
  m.curtain = TX.pbr(TX.withRepeat(TX.fabric({ color: 0xd8cdb8, weave: 60, seed: 23 }), 10), { roughness: 1, sheen: 0.6, sheenColor: new THREE.Color(0xfff1d6), sheenRoughness: 0.8, side: THREE.DoubleSide, transmission: 0 }, true);
  m.dogBed = TX.pbr(TX.withRepeat(TX.fabric({ color: 0x7a5a44, weave: 50, seed: 24 }), 6), { roughness: 1, sheen: 0.9, sheenColor: new THREE.Color(0xc09a7a), sheenRoughness: 0.9 }, true);
  m.porcelain = new THREE.MeshPhysicalMaterial({ color: 0xf7f7f4, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 });
  m.chrome = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.08 });
  m.glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.12, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide });
  m.water = new THREE.MeshPhysicalMaterial({ color: 0x7fb4c8, roughness: 0.03, transparent: true, opacity: 0.55, envMapIntensity: 1.6, depthWrite: false, clearcoat: 1 });
  m.screenBlack = new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4 });
  m.phoneBody = new THREE.MeshPhysicalMaterial({ color: 0x2b2d33, roughness: 0.25, metalness: 0.9, clearcoat: 0.5 });
  m.paper = TX.pbr(TX.paper({ lines: true }), { roughness: 1, side: THREE.DoubleSide });
  m.paperPlain = TX.pbr(TX.paper({ lines: false }), { roughness: 1, side: THREE.DoubleSide });
  m.plasticRed = TX.pbr(TX.plastic({ color: 0xd42a26 }), { roughness: 0.35 }, true);
  m.plasticBlue = TX.pbr(TX.plastic({ color: 0x2862c8, seed: 2 }), { roughness: 0.35 }, true);
  m.plasticYellow = TX.pbr(TX.plastic({ color: 0xf2c21c, seed: 3 }), { roughness: 0.35 }, true);
  m.plasticGreen = TX.pbr(TX.plastic({ color: 0x3d9a3a, seed: 4 }), { roughness: 0.35 }, true);
  m.plasticWhite = TX.pbr(TX.plastic({ color: 0xeeeeea, seed: 5 }), { roughness: 0.4 }, true);
  m.plasticBlack = TX.pbr(TX.plastic({ color: 0x1b1c1f, seed: 6 }), { roughness: 0.45 }, true);
  [m.plasticRed, m.plasticBlue, m.plasticYellow, m.plasticGreen].forEach((p) => { p.clearcoat = 0.6; p.clearcoatRoughness = 0.2; });
  m.lampShade = new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x000000 });
  m.leaf = new THREE.MeshStandardMaterial({ color: 0x3e7a34, roughness: 0.6, side: THREE.DoubleSide });
  m.pot = new THREE.MeshStandardMaterial({ color: 0xb66a45, roughness: 0.85 });
  m.soil = TX.pbr(TX.soil(), { roughness: 1 });
  m.fridge = new THREE.MeshPhysicalMaterial({ color: 0xdfe2e4, metalness: 0.6, roughness: 0.3, clearcoat: 0.6 });
  m.counter = TX.pbr(TX.rock({ color: 0x3a3a3c, seed: 30 }), { roughness: 0.4, envMapIntensity: 1.2 }, true);
  m.counter.clearcoat = 0.7;
  m.cabinet = new THREE.MeshStandardMaterial({ color: 0x5d7a74, roughness: 0.5 });
  m.rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  m.cardboard = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.95 });
  m.gold = new THREE.MeshStandardMaterial({ color: 0xffcf6a, metalness: 1, roughness: 0.25, emissive: 0x221500 });
  m.silverCoin = new THREE.MeshStandardMaterial({ color: 0xdadde2, metalness: 1, roughness: 0.22, emissive: 0x111111 });
  m.book = [0x8c2f2f, 0x2f5a8c, 0x2f7a4a, 0xc8a23c, 0x5a3f8c, 0x333333, 0xd97a2f, 0xe9e2d0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  return m;
}

// Box mesh with bottom at y (easier for furniture), optional collider.
export function block(ctx, w, h, d, mat, x, y, z, opts = {}) {
  const r = opts.round ?? 0.6;
  const g = r > 0 ? rbox(w, h, d, r, opts.seg || 2) : new THREE.BoxGeometry(w, h, d);
  const m = mesh(g, mat, x, y + h / 2, z, ctx.group, { ry: opts.ry || 0, cast: opts.cast !== false, receive: true });
  if (opts.collide !== false && ctx.world) ctx.world.addBox(x, y + h / 2, z, w / 2, h / 2, d / 2, { yaw: opts.ry || 0, surface: opts.surface, soft: opts.soft, noCamera: opts.noCamera });
  return m;
}

export function cylinder(ctx, r, h, mat, x, y, z, opts = {}) {
  const g = new THREE.CylinderGeometry(opts.rTop ?? r, r, h, opts.seg || 24);
  const m = mesh(g, mat, x, y + h / 2, z, ctx.group, { cast: opts.cast !== false });
  if (opts.collide !== false && ctx.world) ctx.world.addCylinder(x, z, Math.max(r, opts.rTop ?? r), y, y + h, { surface: opts.surface });
  return m;
}

// ------------------------------------------------------------------ bedroom furniture
export function bed(ctx, M, x0, z0, w, len) {
  const g = new THREE.Group();
  ctx.group.add(g);
  const legH = 26, frameH = 8, mattH = 22;
  const cx = x0 + w / 2, cz = z0 + len / 2;
  // legs
  [[x0 + 4, z0 + 8], [x0 + w - 4, z0 + 8], [x0 + 4, z0 + len - 4], [x0 + w - 4, z0 + len - 4]].forEach(([x, z]) => {
    mesh(rbox(6, legH, 6, 0.8), M.woodDark, x, legH / 2, z, g);
    ctx.world.addBox(x, legH / 2, z, 3, legH / 2, 3, { surface: 'wood' });
  });
  // frame + headboard
  mesh(rbox(w, frameH, len, 1.2), M.woodDark, cx, legH + frameH / 2, cz, g);
  mesh(rbox(w + 4, 110, 6, 2), M.woodDark, cx, 55, z0 + 3, g);
  ctx.world.addBox(cx, 55, z0 + 3, w / 2 + 2, 55, 3, { surface: 'wood' });
  for (let i = 0; i < 5; i++) mesh(rbox(w * 0.16, 60, 2, 0.8), M.woodLight, x0 + w * (0.14 + i * 0.18), 70, z0 + 6.5, g);
  // mattress, sheet, duvet with a soft wrinkled top
  mesh(rbox(w - 2, mattH, len - 8, 6, 4), M.sheet, cx, legH + frameH + mattH / 2, cz + 3, g);
  const topY = legH + frameH + mattH;
  const duvetG = new THREE.PlaneGeometry(w + 10, len * 0.72, 60, 50);
  const pos = duvetG.attributes.position;
  const rnd = mulberry32(77);
  const wr = [];
  for (let i = 0; i < 14; i++) wr.push([rnd() * 2 - 1, rnd() * 2 - 1, 0.3 + rnd() * 0.8, rnd() * Math.PI]);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
    const u = px / ((w + 10) / 2), v = py / (len * 0.36);
    let h = 3.2;
    for (const [a, b, s, ang] of wr) {
      const d = (u - a) * Math.cos(ang) + (v - b) * Math.sin(ang);
      h += Math.exp(-d * d * 60) * s * Math.exp(-((u - a) ** 2 + (v - b) ** 2) * 3) * 2.2;
    }
    // drape over the side edges
    const edge = Math.max(0, Math.abs(u) - 0.86) / 0.14;
    h -= edge * edge * 22;
    pos.setZ(i, h);
  }
  duvetG.computeVertexNormals();
  const duvet = mesh(duvetG, M.duvet, cx, topY, z0 + len - len * 0.36 - 2, g, { rx: -Math.PI / 2 });
  duvet.material.side = THREE.DoubleSide;
  // folded top edge
  mesh(rbox(w + 8, 6, 14, 3, 3), M.duvet, cx, topY + 3, z0 + len * 0.28 - 4, g);
  // blanket hanging down at the foot of the bed (the climbing route)
  const hang = new THREE.PlaneGeometry(w * 0.5, topY + 4, 20, 30);
  const hp = hang.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const hx = hp.getX(i), hy = hp.getY(i);
    const fold = Math.sin(hx * 0.35) * 1.8 + Math.sin(hx * 0.13 + 1) * 1.2;
    const flare = Math.max(0, (-(hy) / (topY + 4) + 0.5));
    hp.setZ(i, fold * (0.5 + flare * 0.6) + flare * 1.6);
  }
  hang.computeVertexNormals();
  const hangM = mesh(hang, M.duvet, cx, (topY + 4) / 2 - 1, z0 + len + 1.5, g);
  hangM.material = M.duvet;
  // collider for the whole sleeping surface (soft)
  ctx.world.addBox(cx, (legH + topY) / 2 + 2, cz + 3, w / 2, (topY - legH) / 2 + 2, len / 2 - 3, { surface: 'fabric', soft: true });
  return { topY: topY + 4, group: g };
}

export function pillow(ctx, M, x, y, z, w, d, h, ry = 0, tilt = 0) {
  const g = new THREE.SphereGeometry(1, 40, 24);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let px = p.getX(i), py = p.getY(i), pz = p.getZ(i);
    // squash into a pillow: flat-ish top and bottom, puffy middle, pinched corners
    const sx = Math.sign(px) * Math.pow(Math.abs(px), 0.55);
    const sz = Math.sign(pz) * Math.pow(Math.abs(pz), 0.55);
    const corner = Math.abs(sx * sz);
    py *= 1 - corner * 0.55;
    p.setXYZ(i, sx * w / 2, py * h / 2, sz * d / 2);
  }
  g.computeVertexNormals();
  const m = mesh(g, M.pillow, x, y + h / 2, z, ctx.group, { ry, rz: tilt });
  if (ctx.world) ctx.world.addBox(x, y + h * 0.485, z, w / 2 - 6, h * 0.485, d / 2 - 6, { yaw: ry, surface: 'fabric', soft: true });
  return m;
}

export function desk(ctx, M, x0, z0, w, d, h) {
  const g = new THREE.Group(); ctx.group.add(g);
  const cx = x0 + w / 2, cz = z0 + d / 2, top = 3;
  mesh(rbox(w, top, d, 0.8), M.woodLight, cx, h - top / 2, cz, g);
  ctx.world.addBox(cx, h - top / 2, cz, w / 2, top / 2, d / 2, { surface: 'wood' });
  [[x0 + 3, z0 + 3], [x0 + w - 3, z0 + 3], [x0 + 3, z0 + d - 3], [x0 + w - 3, z0 + d - 3]].forEach(([x, z]) => {
    mesh(rbox(4, h - top, 4, 0.6), M.woodLight, x, (h - top) / 2, z, g);
    ctx.world.addBox(x, (h - top) / 2, z, 2, (h - top) / 2, 2, { surface: 'wood', noStep: true });
  });
  // drawer unit hanging under the top
  mesh(rbox(40, 12, d - 6, 0.6), M.woodLight, x0 + w - 24, h - top - 6, cz, g);
  mesh(rbox(8, 1.2, 1.2, 0.5), M.brass, x0 + w - 24, h - top - 6, z0 + d - 2.4, g);
  ctx.world.addBox(x0 + w - 24, h - top - 6, cz, 20, 6, d / 2 - 3);
  return { top: h };
}

export function deskLamp(ctx, M, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); ctx.group.add(g);
  mesh(new THREE.CylinderGeometry(7, 8, 2, 32), M.blackMetal, 0, 1, 0, g);
  const arm1 = mesh(new THREE.CylinderGeometry(0.7, 0.7, 30, 12), M.blackMetal, 0, 15, 0, g, { rz: 0.25 });
  void arm1;
  mesh(new THREE.CylinderGeometry(0.7, 0.7, 26, 12), M.blackMetal, -8, 38, 0, g, { rz: -0.9 });
  const shade = mesh(new THREE.ConeGeometry(8, 12, 32, 1, true), M.blackMetal, -18, 44, 0, g, { rz: 0.5 });
  const bulb = mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d0, emissiveIntensity: 0 }), -19, 41, 0, g);
  ctx.world.addCylinder(x, z, 8, y, y + 2.5);
  ctx.world.addCylinder(x - 4, z, 1.5, y, y + 32);
  return { group: g, shade, bulb };
}

export function bookshelf(ctx, M, x0, z0, w, d, h, shelves = 5, ry = 0) {
  const g = new THREE.Group(); ctx.group.add(g);
  const cx = x0 + w / 2, cz = z0 + d / 2;
  g.position.set(cx, 0, cz); g.rotation.y = ry;
  const t = 2;
  mesh(rbox(t, h, d, 0.4), M.woodWhite, -w / 2 + t / 2, h / 2, 0, g);
  mesh(rbox(t, h, d, 0.4), M.woodWhite, w / 2 - t / 2, h / 2, 0, g);
  mesh(rbox(w, h, 1, 0.2), M.woodWhite, 0, h / 2, -d / 2 + 0.5, g);
  const rnd = mulberry32(Math.floor(x0 * 13 + z0));
  for (let i = 0; i <= shelves; i++) {
    const y = 6 + i * ((h - 8) / shelves);
    mesh(rbox(w - 2 * t, t, d - 1, 0.3), M.woodWhite, 0, y, 0.5, g);
    if (i === shelves) break;
    // books
    let bx = -w / 2 + t + 1;
    while (bx < w / 2 - t - 4) {
      if (rnd() < 0.08) { bx += 6 + rnd() * 8; continue; }
      const bw = 2 + rnd() * 3, bh = 18 + rnd() * 10, bd = 14 + rnd() * 6;
      const lean = rnd() < 0.1 ? 0.2 : 0;
      const b = mesh(rbox(bw, Math.min(bh, (h - 8) / shelves - 4), bd, 0.3), M.book[Math.floor(rnd() * M.book.length)], bx + bw / 2, y + t / 2 + Math.min(bh, (h - 8) / shelves - 4) / 2, 0, g, { rz: lean });
      b.castShadow = false;
      bx += bw + 0.2;
    }
  }
  ctx.world.addBox(cx, h / 2, cz, w / 2, h / 2, d / 2, { yaw: ry, surface: 'wood' });
  return g;
}

export function rug(ctx, mat, x0, z0, w, d, th = 0.45) {
  const m = mesh(rbox(w, th, d, th / 2.2, 1), mat, x0 + w / 2, th / 2, z0 + d / 2, ctx.group, { cast: false });
  ['map', 'normalMap', 'roughnessMap'].forEach((k) => { if (mat[k]) mat[k].repeat.set(w / 60, d / 60); });
  ctx.world.addBox(x0 + w / 2, th / 2, z0 + d / 2, w / 2, th / 2, d / 2, { surface: 'carpet' });
  return m;
}

// A LEGO-ish toy brick: a climbable platform at tiny scale.
export function brick(ctx, M, mat, x, z, ry = 0, y = 0, studs = [4, 2]) {
  const u = 0.8, bw = studs[0] * u, bd = studs[1] * u, bh = 0.96;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; ctx.group.add(g);
  mesh(rbox(bw, bh, bd, 0.04, 1), mat, 0, bh / 2, 0, g);
  const sg = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16);
  for (let i = 0; i < studs[0]; i++) for (let j = 0; j < studs[1]; j++) mesh(sg, mat, -bw / 2 + u / 2 + i * u, bh + 0.09, -bd / 2 + u / 2 + j * u, g);
  ctx.world.addBox(x, y + bh / 2, z, bw / 2, bh / 2, bd / 2, { yaw: ry, surface: 'plastic' });
  return g;
}

export function plant(ctx, M, x, z, scale = 1, y = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); ctx.group.add(g);
  const pot = mesh(new THREE.CylinderGeometry(14, 10, 26, 32), M.pot, 0, 13, 0, g);
  void pot;
  mesh(new THREE.CylinderGeometry(13, 13, 1, 32), M.soil, 0, 25, 0, g);
  const rnd = mulberry32(Math.floor(x * 7 + z * 3));
  const leafTex = TX.leafTexture({ color: '#3a7a30', seed: 3 });
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 });
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, len = 30 + rnd() * 40;
    const stem = new THREE.Group(); stem.position.set(0, 25, 0); stem.rotation.set(0, a, 0.2 + rnd() * 0.7); g.add(stem);
    mesh(new THREE.CylinderGeometry(0.4, 0.6, len, 6), M.leaf, 0, len / 2, 0, stem);
    const leaf = mesh(new THREE.PlaneGeometry(22, 26), leafMat, 0, len + 10, 3, stem, { rx: -0.6 + rnd() * 0.4 });
    leaf.castShadow = true;
  }
  if (ctx.world) ctx.world.addCylinder(x, z, 14 * scale, y, y + 26 * scale, { surface: 'plastic' });
  return g;
}

export function poster(ctx, key, w, h, draw, x, y, z, ry) {
  const tex = TX.drawn(key, 512, Math.round(512 * h / w), draw);
  const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), x, y, z, ctx.group, { ry, cast: false });
  return m;
}

export function frame(ctx, M, w, h, draw, key, x, y, z, ry) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; ctx.group.add(g);
  mesh(rbox(w + 4, h + 4, 1.5, 0.4), M.woodDark, 0, 0, 0, g);
  const tex = TX.drawn(key, 512, Math.round(512 * h / w), draw);
  mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }), 0, 0, 0.8, g, { cast: false });
  return g;
}

// Paper airplane geometry (a classic dart) made from lined notebook paper.
export function paperAirplaneGeometry(len = 26, span = 15, keel = 4) {
  const g = new THREE.BufferGeometry();
  const nose = [0, 0, len / 2], tail = [0, 0, -len / 2];
  const lw = [-span / 2, keel * 0.25, -len / 2], rw = [span / 2, keel * 0.25, -len / 2];
  const keelB = [0, -keel, -len / 2 + 2];
  const v = [
    ...nose, ...lw, ...tail,
    ...nose, ...tail, ...rw,
    ...nose, ...tail, ...keelB,
    ...nose, ...keelB, ...tail,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 0, 0, 0.5, 0, 0.5, 1, 0.5, 0, 1, 0, 0.5, 1, 0.5, 0, 0.8, 0.2, 0.5, 1, 0.8, 0.2, 0.5, 0], 2));
  g.computeVertexNormals();
  return g;
}

export function coinMesh(M, silver = false) {
  const g = new THREE.Group();
  const c = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.18, 32), silver ? M.silverCoin : M.gold, 0, 0.09, 0, g);
  c.rotation.x = 0;
  const rim = mesh(new THREE.TorusGeometry(1.15, 0.06, 6, 32), silver ? M.silverCoin : M.gold, 0, 0.18, 0, g, { rx: Math.PI / 2 });
  void rim;
  return g;
}

// Phone lying flat: 7.5 x 0.8 x 15.5 units.
export function phoneMesh(M, screenMat) {
  const g = new THREE.Group();
  mesh(rbox(7.5, 0.8, 15.5, 0.38, 4), M.phoneBody, 0, 0.4, 0, g);
  const screen = mesh(new THREE.PlaneGeometry(7.1, 15.1), screenMat || M.screenBlack, 0, 0.81, 0, g, { rx: -Math.PI / 2, cast: false });
  mesh(rbox(0.25, 0.3, 1.8, 0.1), M.phoneBody, 3.8, 0.45, -3.5, g);
  mesh(rbox(0.25, 0.3, 1.0, 0.1), M.phoneBody, -3.8, 0.45, -4.5, g);
  mesh(rbox(1.0, 0.25, 0.2, 0.08), M.rubber, 0, 0.4, 7.75, g); // charging port
  return { group: g, screen };
}
