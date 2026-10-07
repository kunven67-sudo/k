// Last night's evidence + loose things you can knock around: beer cans, a greasy pizza box, a casino
// drink cup, the pillow on the floor, the TV remote, a towel on the bathroom floor, the two table
// chairs (all Rapier dynamic bodies), clothes on the floor and the player's duffel bag.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { tinted } from '../shared/batch.js';
import { Rng } from '../../core/rng.js';
import { RI } from './layout.js';

const FL = RI.fl;

export function buildClutter(ctx, room) {
  const { physics, batch } = ctx;
  const rng = new Rng('starlite-clutter');
  const dyn = (mesh, o = {}) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ctx.extraMeshes.push(mesh);
    if (!physics) return;
    // Bodies are created after the group is assembled (index.js runs ctx.after hooks).
    ctx.after = ctx.after || [];
    ctx.after.push(() => {
      const b = physics.addDynamicBox(mesh, { density: o.density ?? 300, friction: o.friction ?? 0.7, restitution: o.restitution ?? 0.1, linearDamping: 0.4, angularDamping: 0.6 });
      b.body.sleep?.();
      mesh.userData.body = b.body;
      const it = { id: o.id, kind: 'prop', object: mesh, axis: null, limits: null, collider: b.collider, body: b.body, describe: () => o.id };
      physics.setOwner(b.collider, it);
      ctx.interactables.push(it);
    });
  };
  const place = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  };

  // ---- Beer cans ---------------------------------------------------------------------------------
  const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 14);
  const crushed = new THREE.CylinderGeometry(0.036, 0.033, 0.07, 14);
  const cp = crushed.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setX(i, cp.getX(i) * (1 + Math.sin(cp.getY(i) * 90) * 0.12));
  crushed.computeVertexNormals();
  const canMat = new THREE.MeshStandardMaterial({ map: canLabel(), metalness: 0.75, roughness: 0.32 });
  canMat.name = 'beer-can';
  const cans = [
    [canGeo, room.table.x + 0.12, room.table.y + 0.061, room.table.z - 0.08, 0, 0, 0],
    [canGeo, 205.6, FL + 0.033, -47.2, Math.PI / 2, 0.6, 0],
    [canGeo, 206.3, FL + 0.033, -47.6, Math.PI / 2, 2.1, 0],
    [crushed, 204.95, FL + 0.035, -50.4, 0, 0.3, 0],
    [canGeo, RI.x0 + 0.2, FL + 0.6 + 0.061, -49.85, 0, 0, 0],
    [canGeo, 207.0, FL + 0.033, -48.9, Math.PI / 2, -0.9, 0],
  ];
  cans.forEach(([g, x, y, z, rx, ry, rz], i) => dyn(place(new THREE.Mesh(g, canMat), x, y, z, rx, ry, rz), { id: `beer-can-${i}`, density: 120 }));

  // ---- Pizza box (on the floor at the foot of the bed, lid slightly lifted by the crusts inside) -
  const pizzaMat = new THREE.MeshStandardMaterial({ map: pizzaTex(), roughness: 0.9 });
  pizzaMat.name = 'pizza-box';
  const pizzaGeo = new THREE.BoxGeometry(0.42, 0.045, 0.42);
  setBoxTopUV(pizzaGeo);
  dyn(place(new THREE.Mesh(pizzaGeo, pizzaMat), 206.55, FL + 0.0225, -48.25, 0, 0.35, 0), { id: 'pizza-box', density: 60 });

  // ---- Casino drink cup (Eldorado souvenir cup, half a melted drink) ----------------------------
  const cupMat = new THREE.MeshStandardMaterial({ map: cupTex(), roughness: 0.5, transparent: false });
  cupMat.name = 'casino-cup';
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.15, 16), cupMat);
  dyn(place(cup, room.table.x - 0.15, room.table.y + 0.075, room.table.z + 0.05, 0, 1.2, 0), { id: 'casino-cup', density: 150 });

  // ---- Pillow on the floor ------------------------------------------------------------------------
  const sheet = room.F.sheet;
  const pillowGeo = new THREE.BoxGeometry(0.62, 0.14, 0.4, 6, 2, 4);
  puff(pillowGeo, 0.06);
  dyn(place(new THREE.Mesh(pillowGeo, sheet), 205.75, FL + 0.08, -47.55, 0, 0.35, 0.05), { id: 'pillow', density: 40 });

  // ---- Remote on the bed ----------------------------------------------------------------------------
  const remote = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.18), room.F.black);
  dyn(place(remote, 205.4, FL + 0.66, -48.3, 0, 0.8, 0), { id: 'tv-remote', density: 400 });

  // ---- Towel on the bathroom floor ----------------------------------------------------------------
  const towelGeo = new THREE.BoxGeometry(0.5, 0.035, 0.35, 6, 1, 4);
  puff(towelGeo, 0.02);
  dyn(place(new THREE.Mesh(towelGeo, mat('fabric', { color: 0xf0ece2, wear: 0.6, dirt: 0.55, seed: 941 })), 206.75, FL + 0.02, -52.6, 0, 0.4, 0), { id: 'towel', density: 80 });

  // ---- Table chairs (vinyl + chrome, one pushed back and turned) --------------------------------
  const vinyl = mat('leather', { color: 0x8a3a24, wear: 0.7, dirt: 0.5, seed: 951 });
  const chairGeo = chairGeometry();
  const chairMat = tinted(vinyl);
  for (const [x, z, ry] of [[room.table.x - 0.55, room.table.z - 0.15, Math.PI / 2 + 0.2], [room.table.x + 0.15, room.table.z - 0.75, 0.5]]) {
    dyn(place(new THREE.Mesh(chairGeo, chairMat), x, FL + 0.005, z, 0, ry, 0), { id: 'chair', density: 90 });
  }

  // ---- Clothes on the floor (static) + the duffel bag ----------------------------------------------
  const shirt = crumple(new THREE.PlaneGeometry(0.6, 0.7, 10, 10), 0.05, rng);
  batch.add(shirt.rotateX(-Math.PI / 2).rotateY(0.7).translate(205.9, FL + 0.03, -46.4), mat('fabric', { color: 0x3a5a7a, wear: 0.5, dirt: 0.4, seed: 952 }), { chunk: 'room' });
  const jeans = crumple(new THREE.PlaneGeometry(0.42, 0.95, 6, 12), 0.04, rng);
  batch.add(jeans.rotateX(-Math.PI / 2).rotateY(-0.4).translate(206.6, FL + 0.025, -50.3), mat('fabric', { color: 0x2c3a5a, wear: 0.6, dirt: 0.5, weave: 'twill', seed: 953 }), { chunk: 'room' });
  const sock = crumple(new THREE.PlaneGeometry(0.1, 0.25, 2, 4), 0.02, rng);
  batch.add(sock.rotateX(-Math.PI / 2).rotateY(1.9).translate(204.7, FL + 0.015, -46.9), mat('fabric', { color: 0xe8e4da, seed: 954 }), { chunk: 'room' });
  // Duffel: a capsule body, end caps, two straps and a zipper line.
  const duffel = new THREE.Group();
  const nylon = mat('fabric', { color: 0x2a2f2a, wear: 0.5, dirt: 0.5, seed: 955 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 6, 14).rotateZ(Math.PI / 2).scale(1, 0.85, 1), nylon);
  duffel.add(body);
  for (const s of [-0.12, 0.12]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 4, 14, Math.PI).translate(0, 0.13, 0), mat('fabric', { color: 0x1a1a1a, seed: 956 }));
    strap.position.x = s;
    strap.rotation.y = Math.PI / 2;
    strap.rotation.z = -0.5;
    duffel.add(strap);
  }
  duffel.position.set(204.75, FL + 0.15, -46.05);
  duffel.rotation.y = 0.25;
  ctx.extraMeshes.push(duffel);
  ctx.colliders.box(204.75, FL + 0.15, -46.05, 0.75, 0.3, 0.34, 0.25);
  room.duffel = duffel;
}

// Inflate a subdivided box into a soft cushion shape.
function puff(g, k) {
  const p = g.attributes.position;
  g.computeBoundingBox();
  const s = new THREE.Vector3();
  g.boundingBox.getSize(s);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (s.x / 2);
    const z = p.getZ(i) / (s.z / 2);
    const bulge = (1 - x * x) * (1 - z * z);
    p.setY(i, p.getY(i) * (0.35 + bulge * 0.9) + Math.sign(p.getY(i)) * bulge * k * 0.2);
  }
  g.computeVertexNormals();
}

function crumple(g, amp, rng) {
  const p = g.attributes.position;
  const a = rng.range(0, 6);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    p.setZ(i, Math.abs(Math.sin(x * 13 + a) * Math.cos(y * 11 + a)) * amp + rng.range(0, amp * 0.3));
  }
  g.computeVertexNormals();
  return g;
}

function setBoxTopUV(g) {
  // Top face (+y, group 2) shows the whole print; sides sample the plain cardboard edge.
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2) continue;
      uv.setXY(i, 0.02 + uv.getX(i) * 0.05, 0.02 + uv.getY(i) * 0.05);
    }
  }
}

function chairGeometry() {
  // Seat + back (vinyl, oxblood) on a chrome sled frame: one merged mesh with vertex colours.
  const parts = [];
  const add = (g, color) => {
    g = g.toNonIndexed();
    const c = new THREE.Color(color);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) {
      col[i] = c.r;
      col[i + 1] = c.g;
      col[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  const seat = new THREE.BoxGeometry(0.44, 0.07, 0.42, 4, 1, 4);
  puff(seat, 0.04);
  add(seat.translate(0, 0.46, 0), 0xffffff);
  const back = new THREE.BoxGeometry(0.42, 0.3, 0.06, 4, 3, 1);
  add(back.rotateX(-0.12).translate(0, 0.78, -0.2), 0xffffff);
  const steel = 0x9a9a9e;
  for (const s of [-0.2, 0.2]) {
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 6).translate(s, 0.22, 0.18), steel);
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.44, 6).translate(s, 0.22, -0.18), steel);
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.4, 6).rotateX(Math.PI / 2).translate(s, 0.01, 0), steel);
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.36, 6).translate(s, 0.66, -0.2), steel);
  }
  const g = mergeGeometries(parts, false);
  g.computeBoundingBox();
  return g;
}

function canLabel() {
  return canvasTexture('beer-can-label', 256, 128, (g, w, h) => {
    g.fillStyle = '#c8202a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe2';
    g.fillRect(0, h * 0.3, w, h * 0.4);
    g.fillStyle = '#c9a23a';
    g.fillRect(0, h * 0.28, w, 4);
    g.fillRect(0, h * 0.7, w, 4);
    g.fillStyle = '#1a1a1a';
    g.font = '400 30px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SILVER STATE', w * 0.25, h * 0.5);
    g.fillText('SILVER STATE', w * 0.75, h * 0.5);
    g.fillStyle = '#f4efe2';
    g.font = '400 18px "Bebas Neue", sans-serif';
    g.fillText('LAGER', w * 0.25, h * 0.85);
    g.fillText('LAGER', w * 0.75, h * 0.85);
  });
}

function pizzaTex() {
  return canvasTexture('pizza-box-top', 256, 256, (g, w, h) => {
    g.fillStyle = '#c9a77a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#b8261d';
    g.beginPath();
    g.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.font = '400 54px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PIZZA', w / 2, h / 2 - 8);
    g.font = '400 18px "Bebas Neue", sans-serif';
    g.fillText('HOT · FRESH · 24 HRS', w / 2, h / 2 + 28);
    // Grease blooms.
    for (const [x, y, r] of [[60, 190, 34], [200, 70, 22], [190, 200, 18]]) {
      const grd = g.createRadialGradient(x, y, 2, x, y, r);
      grd.addColorStop(0, 'rgba(120,80,30,0.55)');
      grd.addColorStop(1, 'rgba(120,80,30,0)');
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

function cupTex() {
  return canvasTexture('casino-cup', 256, 128, (g, w, h) => {
    g.fillStyle = '#f2ede0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a1424';
    g.fillRect(0, h * 0.18, w, h * 0.5);
    g.fillStyle = '#e8c46a';
    g.font = '700 italic 34px "Playfair Display", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Eldorado', w * 0.3, h * 0.43);
    g.fillText('Eldorado', w * 0.8, h * 0.43);
    g.fillStyle = 'rgba(160,110,40,0.35)';
    g.fillRect(0, h * 0.72, w, h * 0.28);
  });
}
