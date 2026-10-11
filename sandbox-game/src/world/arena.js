// The concrete test facility: pad, painted lines, ramps, pillars, container stacks, fence, control building.
import * as THREE from 'three';
import { R, world, GROUPS } from '../engine/physics.js';
import { getMaterial } from '../gfx/materials.js';
import { box, bevelBox, cyl, worldUV, merge, translate } from '../gfx/geom.js';
import { BY_ID, buildParts } from '../game/catalog.js';

export const PAD = 150; // half size of the 300m pad

function markingsTexture() {
  // One 10m x 10m cell: saw-cut joints every 5m, a painted white line on the 10m grid, faint stains.
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 20 + Math.random() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(40,38,34,${0.03 + Math.random() * 0.05})`);
    grd.addColorStop(1, 'rgba(40,38,34,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  g.fillStyle = 'rgba(30,29,27,0.55)'; // saw-cut joints
  g.fillRect(S / 2 - 1, 0, 2, S);
  g.fillRect(0, S / 2 - 1, S, 2);
  g.fillStyle = 'rgba(232,230,220,0.82)'; // painted 10m grid lines (~12cm wide)
  g.fillRect(0, 0, 6, S);
  g.fillRect(0, 0, S, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(30, 30);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function chainLinkTexture() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(170,175,178,1)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(0, S / 2); g.lineTo(S / 2, 0); g.lineTo(S, S / 2); g.lineTo(S / 2, S); g.closePath();
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function wedge(len, width, height) {
  // Ramp rising along +x from 0 to `height`.
  const L = len / 2, W = width / 2;
  const v = [[-L, 0, -W], [L, 0, -W], [L, height, -W], [-L, 0, W], [L, 0, W], [L, height, W]];
  const tri = [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4, 0, 1, 4, 0, 4, 3];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  g.setIndex(tri);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return { geo: worldUV(ng), points: v.flat() };
}

export function buildArena(scene) {
  const body = world.createRigidBody(R.RigidBodyDesc.fixed());
  const statics = [];
  const addStatic = (mesh, cast = true) => { mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh); statics.push(mesh); return mesh; };
  const col = (desc, mat = 'concrete') => {
    desc.setFriction(mat === 'steel' ? 0.45 : 0.85).setCollisionGroups(GROUPS.static);
    return world.createCollider(desc, body);
  };
  const concrete = getMaterial('concrete', { color: 0xa19e98 });

  // --- ground outside the pad (dry dirt/grass) and far hills
  const groundGeo = new THREE.PlaneGeometry(6000, 6000, 1, 1).rotateX(-Math.PI / 2);
  const ground = addStatic(new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x6f6447, roughness: 1 })), false);
  ground.position.y = -0.03;
  col(R.ColliderDesc.cuboid(3000, 1, 3000).setTranslation(0, -1, 0));

  const hills = new THREE.RingGeometry(700, 4200, 160, 24).rotateX(-Math.PI / 2);
  const hp = hills.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), z = hp.getZ(i);
    const d = Math.hypot(x, z), a = Math.atan2(z, x);
    const ridge = Math.sin(a * 5 + 1.3) * 0.5 + Math.sin(a * 13 + 0.4) * 0.3 + Math.sin(a * 29) * 0.12 + 0.7;
    hp.setY(i, Math.max(0, (d - 700) / 3500) ** 1.4 * 420 * ridge);
  }
  hills.computeVertexNormals();
  addStatic(new THREE.Mesh(hills, new THREE.MeshStandardMaterial({ color: 0x5f6448, roughness: 1 })), false);

  // --- the pad
  const padMesh = addStatic(new THREE.Mesh(box(PAD * 2, 0.3, PAD * 2), concrete), false);
  padMesh.position.y = -0.15;
  const markMat = new THREE.MeshStandardMaterial({ map: markingsTexture(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
  const marks = addStatic(new THREE.Mesh(new THREE.PlaneGeometry(PAD * 2, PAD * 2).rotateX(-Math.PI / 2), markMat), false);
  marks.position.y = 0.002;
  // center target circle
  const ring = addStatic(new THREE.Mesh(new THREE.RingGeometry(4.85, 5.0, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd8a326, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3 })), false);
  ring.position.y = 0.004;
  const ring2 = ring.clone(); ring2.scale.setScalar(0.4); addStatic(ring2, false);

  // --- ramps
  const ramps = [
    { len: 14, w: 6, h: 3.5, x: -40, z: -25, ry: 0 },
    { len: 9, w: 5, h: 5, x: 45, z: -40, ry: Math.PI },
    { len: 22, w: 8, h: 6, x: -10, z: -85, ry: Math.PI / 2 },
  ];
  for (const r of ramps) {
    const { geo, points } = wedge(r.len, r.w, r.h);
    const m = addStatic(new THREE.Mesh(geo, concrete));
    m.position.set(r.x, 0, r.z);
    m.rotation.y = r.ry;
    const q = new THREE.Quaternion().setFromEuler(m.rotation);
    col(R.ColliderDesc.convexHull(new Float32Array(points)).setTranslation(r.x, 0, r.z).setRotation(q));
  }

  // --- tall pillars (for grappling later)
  for (const [x, z] of [[-65, -65], [65, -65], [-65, 55], [65, 55]]) {
    const m = addStatic(new THREE.Mesh(bevelBox(3, 30, 3, 0.03), concrete));
    m.position.set(x, 15, z);
    col(R.ColliderDesc.cuboid(1.5, 15, 1.5).setTranslation(x, 15, z));
  }

  // --- shipping container stacks (static scenery)
  const contDef = BY_ID.container;
  const paints = [0x8e2b22, 0x24508a, 0x2f6b3c, 0xb8641e, 0x6b6f73];
  const stacks = [
    [-110, 30, 0, 0], [-110, 30, 1, 0.05], [-110, 33, 0, 0], [-103, 30, 0, Math.PI / 2],
    [105, -60, 0, 0.3], [105, -60, 1, 0.25], [112, -55, 0, 0.3],
    [20, 95, 0, Math.PI / 2],
  ];
  stacks.forEach(([x, z, level, ry], i) => {
    const parts = buildParts(contDef);
    const grp = new THREE.Group();
    const p0 = parts[0];
    for (const mm of p0.meshes) {
      const mat = getMaterial(mm.mat, { color: mm.paint === 0x8e2b22 ? paints[i % paints.length] : mm.paint, roughness: mm.roughness, metalness: mm.metalness });
      const mesh = new THREE.Mesh(mm.geo, mat);
      mesh.castShadow = mesh.receiveShadow = true;
      grp.add(mesh);
    }
    grp.position.set(x, 1.295 + level * 2.59, z);
    grp.rotation.y = ry;
    scene.add(grp);
    statics.push(grp);
    const q = new THREE.Quaternion().setFromEuler(grp.rotation);
    col(R.ColliderDesc.cuboid(3.03, 1.295, 1.22).setTranslation(grp.position.x, grp.position.y, grp.position.z).setRotation(q), 'steel');
  });

  // --- perimeter chain-link fence (3 m)
  const fenceH = 3;
  const postGeo = cyl(0.04, 0.04, fenceH + 0.1, 8);
  const postMat = getMaterial('steel', { color: 0x9da2a6, roughness: 0.5 });
  const perSide = Math.round((PAD * 2) / 3);
  const posts = new THREE.InstancedMesh(postGeo, postMat, perSide * 4);
  let pi = 0;
  const mtx = new THREE.Matrix4();
  for (let s = 0; s < 4; s++) for (let i = 0; i < perSide; i++) {
    const t = -PAD + i * 3;
    const [x, z] = [[t, -PAD], [PAD, t], [-t, PAD], [-PAD, -t]][s];
    mtx.makeTranslation(x, fenceH / 2, z);
    posts.setMatrixAt(pi++, mtx);
  }
  posts.castShadow = true;
  scene.add(posts);
  const linkTex = chainLinkTexture();
  linkTex.repeat.set((PAD * 2) / 0.06, fenceH / 0.06);
  const linkMat = new THREE.MeshStandardMaterial({ map: linkTex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5, color: 0xc0c4c8 });
  const railGeo = [];
  for (let s = 0; s < 4; s++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(PAD * 2, fenceH), linkMat);
    m.rotation.y = (s * Math.PI) / 2;
    const [x, z] = [[0, -PAD], [PAD, 0], [0, PAD], [-PAD, 0]][s];
    m.position.set(x, fenceH / 2, z);
    m.castShadow = true;
    scene.add(m);
    const rail = cyl(0.03, 0.03, PAD * 2, 8).rotateZ(Math.PI / 2).rotateY((s * Math.PI) / 2);
    railGeo.push(rail.translate(x, fenceH, z));
    const horiz = s % 2 === 0;
    col(R.ColliderDesc.cuboid(horiz ? PAD : 0.05, fenceH / 2, horiz ? 0.05 : PAD).setTranslation(x, fenceH / 2, z), 'steel');
  }
  addStatic(new THREE.Mesh(merge(railGeo), postMat));

  // --- light poles
  for (const [x, z] of [[-140, -140], [140, -140], [140, 140], [-140, 140], [0, -140], [-140, 0], [140, 0]]) {
    const pole = addStatic(new THREE.Mesh(cyl(0.09, 0.16, 12, 10), postMat));
    pole.position.set(x, 6, z);
    const head = addStatic(new THREE.Mesh(bevelBox(0.8, 0.18, 0.4, 0.03), getMaterial('steel', { color: 0x55595c, roughness: 0.5 })));
    head.position.set(x, 12, z);
    col(R.ColliderDesc.cylinder(6, 0.15).setTranslation(x, 6, z), 'steel');
  }

  // --- control building (spawn point)
  const B = { x: 0, z: 132, w: 12, d: 8, h: 3.6, t: 0.3 };
  const wallMat = getMaterial('concrete', { color: 0xb4b1aa });
  const addWall = (cx, cy, cz, sx, sy, sz) => {
    const m = addStatic(new THREE.Mesh(bevelBox(sx, sy, sz, 0.01), wallMat));
    m.position.set(cx, cy, cz);
    col(R.ColliderDesc.cuboid(sx / 2, sy / 2, sz / 2).setTranslation(cx, cy, cz));
  };
  const fz = B.z - B.d / 2; // front wall (faces the arena)
  const sill = 1.0, winH = 1.5, winW = 9;
  addWall(B.x, sill / 2, fz, B.w, sill, B.t);
  addWall(B.x, (sill + winH + B.h) / 2, fz, B.w, B.h - sill - winH, B.t);
  addWall(B.x - (winW / 2 + (B.w - winW) / 4), sill + winH / 2, fz, (B.w - winW) / 2, winH, B.t);
  addWall(B.x + (winW / 2 + (B.w - winW) / 4), sill + winH / 2, fz, (B.w - winW) / 2, winH, B.t);
  addWall(B.x, B.h / 2, B.z + B.d / 2, B.w, B.h, B.t); // back
  addWall(B.x - B.w / 2, B.h / 2, B.z, B.t, B.h, B.d); // west
  // east wall with a door opening
  const doorW = 1.2, doorH = 2.2, dz = B.z + 1.5;
  const eastX = B.x + B.w / 2;
  const segA = dz - doorW / 2 - (B.z - B.d / 2), segB = B.z + B.d / 2 - (dz + doorW / 2);
  addWall(eastX, B.h / 2, B.z - B.d / 2 + segA / 2, B.t, B.h, segA);
  addWall(eastX, B.h / 2, B.z + B.d / 2 - segB / 2, B.t, B.h, segB);
  addWall(eastX, (doorH + B.h) / 2, dz, B.t, B.h - doorH, doorW);
  // roof + floor slab
  addWall(B.x, B.h + 0.15, B.z, B.w + 0.4, 0.3, B.d + 0.4);
  const floor = addStatic(new THREE.Mesh(box(B.w, 0.06, B.d), getMaterial('concrete', { color: 0x8a8781 })), false);
  floor.position.set(B.x, 0.03, B.z);
  // window frame mullions
  const frameMat = getMaterial('steel', { color: 0x2b2d30, roughness: 0.5 });
  const mullions = [];
  for (let i = 0; i <= 4; i++) mullions.push(translate(box(0.06, winH, 0.12), B.x - winW / 2 + (i * winW) / 4, sill + winH / 2, fz));
  mullions.push(translate(box(winW, 0.06, 0.14), B.x, sill + 0.03, fz), translate(box(winW, 0.06, 0.14), B.x, sill + winH - 0.03, fz));
  addStatic(new THREE.Mesh(merge(mullions), frameMat));
  // desk
  const desk = addStatic(new THREE.Mesh(bevelBox(4, 0.05, 0.8, 0.01), getMaterial('wood', { color: 0x5b4330 })));
  desk.position.set(B.x, 0.76, fz + 0.7);
  col(R.ColliderDesc.cuboid(2, 0.3925, 0.4).setTranslation(B.x, 0.3925, fz + 0.7), 'wood');
  const deskLegs = merge([[-1.9, -0.3], [1.9, -0.3], [-1.9, 0.3], [1.9, 0.3]].map(([x, z]) => translate(box(0.05, 0.74, 0.05), x, 0, z)));
  const legs = addStatic(new THREE.Mesh(deskLegs, frameMat));
  legs.position.set(B.x, 0.37, fz + 0.7);

  // Window glass is breakable: it is spawned as frozen glass objects by the game.
  const windows = [];
  for (let i = 0; i < 4; i++) {
    windows.push({ pos: new THREE.Vector3(B.x - winW / 2 + winW / 8 + (i * winW) / 4, sill + winH / 2, fz), w: winW / 4 - 0.06, h: winH - 0.12 });
  }

  return {
    body, statics,
    spawn: { pos: new THREE.Vector3(B.x + 2.5, 0.05, B.z + 1.5), yaw: 0 },
    windows,
    furniture: [
      { id: 'pc', pos: new THREE.Vector3(B.x + 1.4, 0.785 + 0.225, fz + 0.75), yaw: 0 },
      { id: 'soda', pos: new THREE.Vector3(B.x - 0.6, 0.785 + 0.061, fz + 0.6), yaw: 0 },
      { id: 'chair', pos: new THREE.Vector3(B.x - 1.2, 0.47, fz + 1.5), yaw: Math.PI },
      { id: 'boombox', pos: new THREE.Vector3(B.x - 1.6, 0.785 + 0.165, fz + 0.75), yaw: 0.3 },
    ],
  };
}
