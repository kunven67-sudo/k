// The empty pool: drained years ago and never refilled. Cracked marcite plaster with tannin stains,
// a band of blue waterline tile, concrete bullnose coping with painted depth marks, a chrome ladder
// at the deep end, a rusty drain with a brown puddle, drifts of dead leaves, graffiti, a lawn chair
// that went in and never came out — all behind a sagging chain-link fence with a gate left ajar.
import * as THREE from 'three';
import { Props } from '../shared/props.js';
import { chainLinkMat } from '../shared/kinds.js';
import { mat } from '../../gfx/materials.js';
import { canvasTexture } from '../../gfx/textures.js';
import { Rng } from '../../core/rng.js';
import { t } from '../../core/i18n.js';
import { POOL, POOL_FENCE, Y0 } from './layout.js';
import { motelMats, plaqueMat } from './mats.js';

// Depth profile along z (south = shallow): [z, depth below the deck].
const PROFILE = [
  [POOL.z1, POOL.shallow],
  [-35.0, POOL.shallow],
  [-37.6, 1.6],
  [-39.0, POOL.deep],
  [POOL.z0, POOL.deep],
];
const depthAt = (z) => {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const [za, da] = PROFILE[i];
    const [zb, db] = PROFILE[i + 1];
    if (z <= za && z >= zb) return da + ((za - z) / (za - zb)) * (db - da);
  }
  return POOL.deep;
};

export function buildPool(ctx) {
  const { batch, colliders, physics } = ctx;
  const M = motelMats();
  const rng = new Rng('starlite-pool');
  const tile = mat('tile-bathroom', { color: 0x3c86a8, wear: 0.5, dirt: 0.6, seed: 861, tileMeters: 0.6 });
  const { x0, x1, z0, z1 } = POOL;
  const W = x1 - x0;
  const top = Y0;
  const TILE_H = 0.18;

  // ---- Floor: a strip along z following the profile (curved transition) --------------------------
  const nz = 44;
  const floor = new THREE.PlaneGeometry(W, z1 - z0, 8, nz).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const fp = floor.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const z = fp.getZ(i);
    const x = fp.getX(i);
    // Floor dishes slightly toward the drain at the deep end centre.
    const dish = z < -39 ? 0.06 * Math.max(0, 1 - Math.hypot(x - (x0 + x1) / 2, z - -40.5) / 3) : 0;
    fp.setY(i, top - depthAt(z) - dish);
  }
  floor.computeVertexNormals();
  batch.add(floor, M.poolPlaster, { castShadow: false });
  const floorMesh = new THREE.Mesh(floor);
  if (physics) colliders.trimesh(floorMesh);

  // ---- Walls: east/west follow the profile; north/south are rectangles ---------------------------
  const sideWall = (x, flip) => {
    const shape = new THREE.Shape();
    shape.moveTo(z1, 0);
    for (const [z, d] of PROFILE) shape.lineTo(z, -d - 0.1);
    shape.lineTo(z0, 0);
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape, 4);
    // Shape is drawn in (z, y): map to world (x fixed, y, z).
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const sz = p.getX(i);
      const sy = p.getY(i);
      p.setXYZ(i, x, top + sy, sz);
    }
    if (flip) g.index.array.reverse();
    g.computeVertexNormals();
    batch.add(g, M.poolPlaster, {});
  };
  sideWall(x0, true); // shape triangles face -x; the west wall must face +x (into the basin)
  sideWall(x1, false);
  const endWall = (z, depth, facing) => {
    const g = new THREE.PlaneGeometry(W, depth + 0.1);
    if (facing < 0) g.rotateY(Math.PI);
    batch.add(g.translate((x0 + x1) / 2, top - (depth + 0.1) / 2, z), M.poolPlaster, {});
  };
  endWall(z0, POOL.deep, 1); // north wall faces south (+z)
  endWall(z1, POOL.shallow, -1); // south wall faces north (-z)
  // Waterline tile band along the top of every wall (just inside the coping).
  const band = (cx, cz, sx, sz) => batch.add(new THREE.BoxGeometry(sx, TILE_H, sz).translate(cx, top - TILE_H / 2 - 0.02, cz), tile, { castShadow: false });
  band((x0 + x1) / 2, z0 - 0.01, W, 0.04);
  band((x0 + x1) / 2, z1 + 0.01, W, 0.04);
  band(x0 - 0.01, (z0 + z1) / 2, 0.04, z1 - z0);
  band(x1 + 0.01, (z0 + z1) / 2, 0.04, z1 - z0);
  // Containment colliders for the walls (outside the basin, from the floor up to the deck).
  colliders.aabb(x0 - 0.3, top - POOL.deep - 0.3, z0, x0, top, z1);
  colliders.aabb(x1, top - POOL.deep - 0.3, z0, x1 + 0.3, top, z1);
  colliders.aabb(x0 - 0.3, top - POOL.deep - 0.3, z0 - 0.3, x1 + 0.3, top, z0);
  colliders.aabb(x0 - 0.3, top - POOL.deep - 0.3, z1, x1 + 0.3, top, z1 + 0.3);

  // ---- Coping: bullnose concrete edge, depth marks ------------------------------------------------
  const cop = (cx, cz, sx, sz) => {
    batch.add(new THREE.BoxGeometry(sx, 0.07, sz).translate(cx, top + 0.035, cz), M.concrete, { tint: 0xe3ddd0, grime: 0.4 });
    colliders.aabb(cx - sx / 2, top, cz - sz / 2, cx + sx / 2, top + 0.07, cz + sz / 2);
  };
  cop((x0 + x1) / 2, z0 - 0.15, W + 0.6, 0.3);
  cop((x0 + x1) / 2, z1 + 0.15, W + 0.6, 0.3);
  cop(x0 - 0.15, (z0 + z1) / 2, 0.3, z1 - z0);
  cop(x1 + 0.15, (z0 + z1) / 2, 0.3, z1 - z0);
  const mark = (text, x, z, ry) => {
    const m = plaqueMat(`pool-mark-${text}`, 128, 64, (g, w, h) => {
      g.fillStyle = '#e3ddd0';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1e3f6a';
      g.font = '400 50px "Bebas Neue", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, w / 2, h / 2 + 3);
    });
    batch.add(new THREE.PlaneGeometry(0.34, 0.17).rotateX(-Math.PI / 2).rotateY(ry).translate(x, top + 0.072, z), m, { uv: 'keep', castShadow: false });
  };
  mark('1 FT', x0 + 1.2, z1 + 0.15, 0);
  mark('1 FT', x1 - 1.2, z1 + 0.15, 0);
  mark('7 FT', x0 + 1.2, z0 - 0.15, Math.PI);
  mark('7 FT', x1 - 1.2, z0 - 0.15, Math.PI);
  mark('NO DIVING', (x0 + x1) / 2, z0 - 0.15, Math.PI);

  // ---- Ladder at the deep end (east wall), two chrome rails bending over the coping ---------------
  const chrome = mat('chrome', { wear: 0.55, dirt: 0.5, seed: 862 });
  for (const dz of [-0.28, 0.28]) {
    const zc = -39.8 + dz;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x1 - 0.12, top - 1.6, zc),
      new THREE.Vector3(x1 - 0.12, top + 0.3, zc),
      new THREE.Vector3(x1 + 0.05, top + 0.85, zc),
      new THREE.Vector3(x1 + 0.35, top + 0.75, zc),
      new THREE.Vector3(x1 + 0.45, top + 0.05, zc),
    ]);
    batch.add(new THREE.TubeGeometry(path, 24, 0.022, 8), chrome, {});
  }
  for (let k = 0; k < 3; k++) batch.add(new THREE.BoxGeometry(0.08, 0.025, 0.56).translate(x1 - 0.14, top - 0.35 - k * 0.42, -39.8), chrome, {});
  colliders.aabb(x1 - 0.2, top - 1.6, -40.15, x1, top + 0.9, -39.45);

  // ---- Drain + brown puddle, leaves, debris -------------------------------------------------------
  const drainY = top - POOL.deep - 0.06 + 0.005;
  batch.add(new THREE.CylinderGeometry(0.22, 0.22, 0.01, 20).translate((x0 + x1) / 2, drainY, -40.5), mat('rust', { seed: 863 }), { castShadow: false });
  ctx.decals.push({ kind: 'puddle', position: new THREE.Vector3((x0 + x1) / 2 + 0.3, drainY + 0.004, -40.3), size: 2.2, opacity: 0.9 });
  ctx.decals.push({ kind: 'grime', position: new THREE.Vector3((x0 + x1) / 2, drainY + 0.003, -40.6), size: 3.2, opacity: 0.8 });
  for (let i = 0; i < 6; i++) ctx.decals.push({ kind: 'crack', position: new THREE.Vector3(rng.range(x0 + 1, x1 - 1), top - depthAt(-33 - i * 1.4) + 0.004, -33 - i * 1.4), size: rng.range(1.2, 2.2) });
  // Graffiti on the deep-end walls and floor.
  ctx.decals.push({ kind: 'graffiti', position: new THREE.Vector3((x0 + x1) / 2 - 1.5, top - 1.1, z0 + 0.01), normal: new THREE.Vector3(0, 0, 1), size: 2.0, rotation: 0.05, opacity: 0.95 });
  ctx.decals.push({ kind: 'graffiti', position: new THREE.Vector3((x0 + x1) / 2 + 2.2, top - 1.3, z0 + 0.01), normal: new THREE.Vector3(0, 0, 1), size: 1.6, rotation: -0.08, opacity: 0.9 });
  ctx.decals.push({ kind: 'graffiti', position: new THREE.Vector3(x0 + 0.01, top - 1.2, -40.2), normal: new THREE.Vector3(1, 0, 0), size: 1.7, rotation: 0, opacity: 0.85 });
  ctx.decals.push({ kind: 'graffiti', position: new THREE.Vector3(x1 - 0.01, top - 0.9, -37.6), normal: new THREE.Vector3(-1, 0, 0), size: 1.4, rotation: 0.1, opacity: 0.8 });
  leaves(ctx, rng, depthAt);
  lawnChair(ctx, new THREE.Vector3(x0 + 2.4, top - POOL.deep - 0.06, -40.9), 2.4, true);
  lawnChair(ctx, new THREE.Vector3(POOL_FENCE.x1 - 0.6, top, -36.5), -Math.PI / 2 + 0.2, false);

  // ---- Fence + gate (gate left ajar) --------------------------------------------------------------
  const F = POOL_FENCE;
  const P = new Props(ctx);
  const gate0 = 188.4;
  const gate1 = 189.6;
  P.chainFence([[gate0, F.z1], [F.x0, F.z1], [F.x0, F.z0], [F.x1, F.z0], [F.x1, F.z1], [gate1, F.z1]], { y: top, h: 1.45, barbed: false, sag: 0.05 });
  const gm = new THREE.Matrix4().makeRotationY(-0.75).setPosition(gate1, top, F.z1);
  const galv = M.galv;
  const gw = gate1 - gate0 - 0.06;
  const gframe = [
    new THREE.BoxGeometry(gw, 0.04, 0.04).translate(-gw / 2, 1.38, 0),
    new THREE.BoxGeometry(gw, 0.04, 0.04).translate(-gw / 2, 0.08, 0),
    new THREE.BoxGeometry(0.04, 1.32, 0.04).translate(-gw + 0.02, 0.73, 0),
    new THREE.BoxGeometry(0.04, 1.32, 0.04).translate(-0.02, 0.73, 0),
  ];
  for (const g of gframe) batch.add(g, galv, { matrix: gm });
  batch.add(new THREE.PlaneGeometry(gw - 0.06, 1.28).translate(-gw / 2, 0.73, 0), chainLinkMat(), { matrix: gm, uv: 0.42 });
  const gp = new THREE.Vector3(-gw / 2, 0.73, 0).applyMatrix4(gm);
  colliders.box(gp.x, gp.y, gp.z, gw, 1.4, 0.06, -0.75);
  // POOL CLOSED sign zip-tied to the fence next to the gate.
  const closed = plaqueMat('pool-closed', 256, 160, (g, w, h) => {
    g.fillStyle = '#f2efe6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#b8261d';
    g.fillRect(0, 0, w, 64);
    g.fillStyle = '#fff';
    g.font = '400 54px "Bebas Neue", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t('motel.pool'), w / 2, 35);
    g.fillStyle = '#222';
    g.font = '600 15px "Inter", sans-serif';
    const words = t('motel.poolSmall').split(' · ');
    words.forEach((wd, i) => g.fillText(wd, w / 2, 92 + i * 24));
  });
  batch.add(new THREE.PlaneGeometry(0.5, 0.31).rotateZ(-0.04).translate(186.6, top + 1.0, F.z1 + 0.03), closed, { uv: 'keep', castShadow: false });
}

// Dead leaves: instanced little curled cards, drifted toward the deep end and the corners.
function leaves(ctx, rng, depthAt) {
  const tex = canvasTexture('motel-leaf', 64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.translate(w / 2, h / 2);
    g.beginPath();
    g.moveTo(0, -28);
    g.quadraticCurveTo(18, -8, 0, 28);
    g.quadraticCurveTo(-18, -8, 0, -28);
    g.fillStyle = '#ffffff';
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -26);
    g.lineTo(0, 26);
    g.stroke();
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  m.name = 'pool-leaves';
  const geo = new THREE.PlaneGeometry(0.09, 0.09, 2, 1);
  // Curl: bend the card along x.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.4);
  geo.rotateX(-Math.PI / 2);
  const n = Math.round(900 * (ctx.tier?.particlesScale ?? 0.6));
  const mesh = new THREE.InstancedMesh(geo, m, n);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const palette = [0x8a5a2a, 0x6e4a24, 0xa0742f, 0x5b4a2e, 0x7a6a3a, 0x93552a];
  for (let i = 0; i < n; i++) {
    // Bias toward the deep end + walls (wind piles them there).
    const z = POOL.z0 + 0.15 + Math.pow(rng.next(), 1.8) * (POOL.z1 - POOL.z0 - 0.3);
    const edge = rng.chance(0.45);
    const x = edge ? (rng.chance(0.5) ? POOL.x0 + rng.range(0.05, 0.6) : POOL.x1 - rng.range(0.05, 0.6)) : rng.range(POOL.x0 + 0.1, POOL.x1 - 0.1);
    dummy.position.set(x, Y0 - depthAt(z) - 0.05 + rng.range(0.005, 0.03), z);
    dummy.rotation.set(rng.range(-0.4, 0.4), rng.range(0, Math.PI * 2), rng.range(-0.4, 0.4));
    dummy.scale.setScalar(rng.range(0.7, 1.5));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, col.setHex(rng.pick(palette)).multiplyScalar(rng.range(0.7, 1.1)));
  }
  mesh.receiveShadow = true;
  mesh.name = 'pool-leaves';
  ctx.extraMeshes.push(mesh);
}

// Folding aluminium lawn chair with faded green/white webbing.
function lawnChair(ctx, pos, ry, tipped) {
  const { batch, colliders } = ctx;
  const alu = mat('aluminum', { wear: 0.6, dirt: 0.6, seed: 864 });
  const web = plaqueMat('lawn-web', 128, 128, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#e8e2d0' : '#4f8a5a';
      g.fillRect(0, i * 16, w, 16);
      g.fillRect(i * 16, 0, 16, h);
    }
    g.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#4f8a5a' : '#e8e2d0';
      g.fillRect(i * 16 + 3, 0, 10, h);
    }
  }, { transparent: false });
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(pos);
  if (tipped) m.multiply(new THREE.Matrix4().makeRotationZ(1.35).setPosition(0.2, 0.28, 0));
  const tube = (a, b) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const g = new THREE.CylinderGeometry(0.013, 0.013, d.length(), 6).translate(0, d.length() / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate(a.x, a.y, a.z);
    batch.add(g, alu, { matrix: m });
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const s of [-0.27, 0.27]) {
    tube(V(s, 0, 0.3), V(s, 0.4, -0.05));
    tube(V(s, 0, -0.3), V(s, 0.4, 0.2));
    tube(V(s, 0.4, 0.25), V(s, 0.4, -0.25));
    tube(V(s, 0.4, -0.25), V(s, 0.95, -0.42));
    tube(V(s, 0.58, 0.22), V(s, 0.58, -0.2));
  }
  const seat = new THREE.PlaneGeometry(0.52, 0.48).rotateX(-Math.PI / 2).translate(0, 0.39, 0);
  const back = new THREE.PlaneGeometry(0.52, 0.56).rotateX(-0.28).translate(0, 0.68, -0.34);
  batch.add(seat, web, { matrix: m, uv: 'keep' });
  batch.add(back, web, { matrix: m, uv: 'keep' });
  const c = new THREE.Vector3(0, 0.45, 0).applyMatrix4(m);
  colliders.box(c.x, c.y, c.z, 0.62, 0.8, 0.7, ry);
}
