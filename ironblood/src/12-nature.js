
// ---------- nature: real generated trees, bushes, dead trees, mossy boulders ----------
const treeVariants = [];
const natureCells = new Map(); // 100 m cells, each with its own instanced meshes so far ones get culled
function makeTreeVariant(preset, seed, height, opts = {}) {
  const t = new Tree();
  t.loadPreset(preset);
  t.options.seed = seed;
  if (opts.leafCount) t.options.leaves.count = opts.leafCount;
  if (opts.tint) t.options.leaves.tint = opts.tint;
  t.generate();
  t.branchesMesh.geometry.computeBoundingBox();
  const bb = new THREE.Box3().setFromObject(t);
  const s = height / Math.max(0.01, bb.max.y - bb.min.y);
  const v = { tree: t, scale: s, bare: !!opts.bare, kind: opts.kind, trunkR: (t.options.branch.radius[0] || 1) * s };
  t.branchesMesh.material.envMapIntensity = 0.4;
  treeVariants.push(v);
  return v;
}
function plantCellMesh(variant, cellKey, matrices) {
  const out = [];
  const parts = variant.bare ? [variant.tree.branchesMesh] : [variant.tree.branchesMesh, variant.tree.leavesMesh];
  for (const src of parts) {
    const m = new THREE.InstancedMesh(src.geometry, src.material, matrices.length);
    matrices.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.castShadow = true; m.receiveShadow = true;
    m.computeBoundingSphere();
    scene.add(m); out.push(m);
  }
  if (!natureCells.has(cellKey)) natureCells.set(cellKey, []);
  natureCells.get(cellKey).push(...out);
}
let natureReady = false;
function buildNature() {
  const V = {
    oak: [makeTreeVariant('Oak Medium', 11, 13, { kind: 'oak' }), makeTreeVariant('Oak Large', 23, 17, { kind: 'oak' })],
    ash: [makeTreeVariant('Ash Medium', 31, 15, { kind: 'ash' }), makeTreeVariant('Aspen Medium', 41, 14, { kind: 'aspen' })],
    pine: [makeTreeVariant('Pine Medium', 51, 19, { kind: 'pine' }), makeTreeVariant('Pine Large', 61, 25, { kind: 'pine' }), makeTreeVariant('Pine Small', 71, 12, { kind: 'pine' })],
    bush: [makeTreeVariant('Bush 1', 81, 1.7, { kind: 'bush' }), makeTreeVariant('Bush 2', 91, 1.4, { kind: 'bush' }), makeTreeVariant('Bush 3', 101, 2.0, { kind: 'bush' })],
    dead: [makeTreeVariant('Ash Medium', 111, 11, { kind: 'dead', bare: true }), makeTreeVariant('Oak Medium', 121, 9, { kind: 'dead', bare: true })],
  };
  // gather placements per variant per cell
  const buckets = new Map();
  const add = (v, x, z, s, ry, collide) => {
    const y = terrainH(x, z) - 0.15 * s;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(v.scale * s, v.scale * s, v.scale * s));
    const key = Math.floor(x / 100) + ',' + Math.floor(z / 100);
    const bk = treeVariants.indexOf(v) + '|' + key;
    if (!buckets.has(bk)) buckets.set(bk, { v, key, list: [] });
    buckets.get(bk).list.push(m);
    if (collide) circles.push({ x, z, r: Math.max(0.25, Math.min(0.7, v.trunkR * s * 0.9)) });
  };
  const r = mulberry32(2024);
  const clear = (x, z, pad) => {
    if (pathDist(x, z) < 5 + pad || riverDist(x, z) < 13 + pad || onBridge(x, z)) return false;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + pad) return false;
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r + 10 + pad) return false;
    if (Math.hypot(x - FORTRESS.x, z - FORTRESS.z) < FORTRESS.r + 20 + pad) return false;
    if (solidAt(x, z, 2 + pad)) return false;
    for (const c of CAMP_SPOTS) if (Math.hypot(x - c.x, z - c.z) < 14) return false;
    return true;
  };
  const spaced = [];
  const farEnough = (x, z, d) => { for (const p of spaced) if (Math.abs(p[0] - x) < d && Math.abs(p[1] - z) < d && Math.hypot(p[0] - x, p[1] - z) < d) return false; return true; };
  // pine forests on the mountain slopes and the western woods
  for (let i = 0, n = 0; i < 40000 && n < 620; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = (r() * 2 - 1) * (HALF - 10);
    const north = smooth(-110, -170, z), west = smooth(-200, -260, x);
    const dens = Math.max(north, west) * (0.5 + 0.5 * fbm(x * 0.02, z * 0.02, 3));
    if (r() > dens) continue;
    const h = terrainH(x, z), sl = slopeAt(x, z);
    if (sl > 0.85 || h > 95 + fbm(x * 0.03, z * 0.03, 2) * 12 || !clear(x, z, 0) || !farEnough(x, z, 5.5)) continue;
    spaced.push([x, z]);
    add(V.pine[Math.floor(r() * 3)], x, z, 0.75 + r() * 0.5, r() * 6.28, true); n++;
  }
  // broadleaf groves across the valley
  for (let i = 0, n = 0; i < 40000 && n < 300; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = -100 + r() * (HALF + 90);
    if (x > BATTLE_X - 25) continue;
    const grove = fbm(x * 0.012 + 3, z * 0.012, 3);
    if (grove < 0.12 && r() > 0.04) continue;
    if (!clear(x, z, 0) || slopeAt(x, z) > 0.6 || !farEnough(x, z, 7)) continue;
    spaced.push([x, z]);
    const v = r() < 0.55 ? V.oak[Math.floor(r() * 2)] : V.ash[Math.floor(r() * 2)];
    add(v, x, z, 0.8 + r() * 0.45, r() * 6.28, true); n++;
  }
  // dead, burned trees on the battlefield
  for (let i = 0, n = 0; i < 5000 && n < 45; i++) {
    const x = BATTLE_X + r() * (HALF - BATTLE_X - 10), z = (r() * 2 - 1) * (HALF - 20);
    if (!clear(x, z, 0) || !farEnough(x, z, 9)) continue;
    spaced.push([x, z]);
    add(V.dead[Math.floor(r() * 2)], x, z, 0.8 + r() * 0.5, r() * 6.28, true); n++;
  }
  // bushes along the river, forest edges and fields
  for (let i = 0, n = 0; i < 30000 && n < 700; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = -180 + r() * (HALF + 170);
    const rd = riverDist(x, z);
    const near = rd < 26 ? 0.6 : 0.08 + Math.max(0, fbm(x * 0.03, z * 0.03, 2)) * 0.5;
    if (r() > near || x > BATTLE_X + 10) continue;
    if (rd < 12.5 || pathDist(x, z) < 3.5 || solidAt(x, z, 1.5) || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r - 18 || slopeAt(x, z) > 0.7) continue;
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r + 2) continue;
    add(V.bush[Math.floor(r() * 3)], x, z, 0.7 + r() * 0.7, r() * 6.28, false); n++;
  }
  for (const b of buckets.values()) plantCellMesh(b.v, b.key, b.list);
  buildRocks(r);
  natureReady = true;
}
// mossy boulders: real rock texture with moss growing on the tops
let rockMat = null;
function buildRocks(r) {
  rockMat = pbr('mossy_rock', { roughness: 1 });
  for (const k of ['map', 'normalMap', 'roughnessMap']) rockMat[k].repeat.set(1.5, 1.5);
  const shapes = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = 1 + fbm(x * 1.6 + k * 9, z * 1.6 + y * 1.3, 4) * 0.42;
      p.setXYZ(i, x * n * (1 + k * 0.12), y * n * (0.55 + k * 0.08), z * n);
    }
    g.computeVertexNormals();
    shapes.push({ g, list: [] });
  }
  for (let i = 0, n = 0; i < 20000 && n < 320; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = (r() * 2 - 1) * (HALF - 10);
    const sl = slopeAt(x, z), rd = riverDist(x, z);
    const want = (z < -120 ? 0.25 : 0.03) + (sl > 0.5 ? 0.2 : 0) + (rd > 11 && rd < 18 ? 0.25 : 0);
    if (r() > want) continue;
    if (pathDist(x, z) < 4 || onBridge(x, z) || solidAt(x, z, 2) || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r - 10 || Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r) continue;
    const s = 0.4 + r() ** 2.2 * (z < -120 ? 4.5 : 2.2);
    shapes[Math.floor(r() * 4)].list.push({ x, z, s, ry: r() * 6.28 });
    if (s > 0.6) circles.push({ x, z, r: s * 0.85 });
    n++;
  }
  for (const sh of shapes) {
    const m = new THREE.InstancedMesh(sh.g, rockMat, sh.list.length);
    sh.list.forEach((o, i) => m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(o.x, terrainH(o.x, o.z) + o.s * 0.15, o.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.ry), new THREE.Vector3(o.s, o.s, o.s))));
    m.castShadow = m.receiveShadow = true; m.computeBoundingSphere();
    scene.add(m);
  }
}
// far forest cells are hidden (fog covers the edge)
let natureCheck = 0;
function updateNature(dt, t) {
  for (const v of treeVariants) if (!v.bare) v.tree.update(t);
  natureCheck -= dt;
  if (natureCheck > 0) return;
  natureCheck = 0.5;
  const px = Math.floor(camera.position.x / 100), pz = Math.floor(camera.position.z / 100);
  for (const [key, list] of natureCells) {
    const [cx, cz] = key.split(',').map(Number);
    const vis = Math.max(Math.abs(cx - px), Math.abs(cz - pz)) <= 3;
    for (const m of list) m.visible = vis;
  }
}
