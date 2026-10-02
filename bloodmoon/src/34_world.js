
// =====================================================================
// WORLD (1) — ground chunks, water, forests, rocks, grass, herbs, lights.
// =====================================================================
const WORLD = { root: null, chunks: [], water: [], trees: [], treeBuckets: new Map(), lights: [], herbs: [], interact: [], built: false };
const Q = () => ({ low: 0, medium: 1, high: 2 }[SET.quality]);
// ---------- ground ----------
function buildGround() {
  for (let cj = 0; cj < CHN; cj++) for (let ci = 0; ci < CHN; ci++) {
    const hi = new THREE.Mesh(buildChunkGeo(ci, cj, Q() === 2 ? 1 : 2), MAT.ground), lo = new THREE.Mesh(buildChunkGeo(ci, cj, 5), MAT.ground); // steps must divide 50 cells
    hi.receiveShadow = true; lo.receiveShadow = true; hi.castShadow = false; lo.castShadow = false;
    const c = { hi, lo, cx: -HALF + (ci + 0.5) * CHUNK, cz: -HALF + (cj + 0.5) * CHUNK }; lo.visible = false;
    WORLD.root.add(hi); WORLD.root.add(lo); WORLD.chunks.push(c);
  }
}
function updateGroundLOD(px, pz) {
  const near = Q() === 0 ? 160 : 260;
  for (const c of WORLD.chunks) { const d = Math.hypot(c.cx - px, c.cz - pz) - CHUNK * 0.7; const hi = d < near; c.hi.visible = hi; c.lo.visible = !hi; }
}
// ---------- water ----------
function buildWater() {
  const P = PLACES;
  // river: a strip along the channel, stopping where it meets the lake
  const pos = [], uv = [], idx = []; let len = 0, last = null, n = 0;
  for (let i = 0; i < RIVER.length; i++) {
    const [x, z] = RIVER[i]; if (Math.hypot(x - P.lake.x, z - P.lake.z) < P.lake.r * 0.9) break;
    const [nx2, nz2] = RIVER[Math.min(RIVER.length - 1, i + 1)], [px2, pz2] = RIVER[Math.max(0, i - 1)];
    let dx = nx2 - px2, dz = nz2 - pz2; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const w = 6 + 3 * Math.sin(Math.min(i, RIVER.length - 2) * 0.7) + 5, y = RIVER_LEVELS[i];
    if (last) len += Math.hypot(x - last[0], z - last[1]); last = [x, z];
    pos.push(x - dz * w, y, z + dx * w, x + dz * w, y, z - dx * w); uv.push(0, len / 10, 1, len / 10);
    if (n > 0) { const a = (n - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } n++;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const river = new THREE.Mesh(g, MAT.river); river.receiveShadow = true; WORLD.root.add(river);
  const disc = (cx, cz, r, y, mat) => { const d = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mat); d.rotation.x = -Math.PI / 2; d.position.set(cx, y, cz); d.receiveShadow = true; const u = d.geometry.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * r / 12, u.getY(i) * r / 12); WORLD.root.add(d); return d; };
  disc(P.lake.x, P.lake.z, P.lake.r * 1.5, LAKE_LEVEL, MAT.water);
  disc(P.swamp.x, P.swamp.z, P.swamp.r + 40, SWAMP_LEVEL, MAT.swamp);
}
function updateWater(dt) {
  MAT.river.normalMap.offset.y -= dt * 0.12; MAT.river.normalMap.offset.x = Math.sin(Sky.u.time.value * 0.3) * 0.02;
  MAT.water.normalMap.offset.x += dt * 0.006 * (1 + Weather.wind); MAT.water.normalMap.offset.y += dt * 0.004;
}
// ---------- trees ----------
function jitterGeo(g, amt, seed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = vnoise(x * 1.7 + seed, z * 1.7 + y, seed) * amt; p.setXYZ(i, x + n, y + n * 0.4, z - n); } g.computeVertexNormals(); return g; }
const lin = (v) => Math.pow(v, 2.2);
function colorGeo(g, col) { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }
function tGeo(g, x, y, z, rx = 0, rz = 0, s = 1) { g.applyMatrix4(M4(x, y, z, 0, s, s, s, rx, rz)); return g; }
function mergeSimple(geos) { return mergeGeos(geos.map((g) => [g, new THREE.Matrix4(), g.userData.col]), true); }
const TREE_TYPES = {};
function buildTreeTypes() {
  const pineCrown = [], oakCrown = [];
  for (let i = 0; i < 4; i++) pineCrown.push(jitterGeo(tGeo(new THREE.ConeGeometry(2.7 - i * 0.55, 3.6, 9, 2), 0, 3.6 + i * 2.0, 0), 0.25, i));
  for (const [x, y, z, r] of [[0, 6.4, 0, 2.7], [1.4, 5.4, 0.6, 2.0], [-1.2, 5.6, -0.8, 2.1], [0.2, 7.6, -0.3, 1.8]]) oakCrown.push(jitterGeo(tGeo(new THREE.IcosahedronGeometry(r, 1), x, y, z), 0.45, x * 3 + z));
  const oakTrunk = [tGeo(new THREE.CylinderGeometry(0.28, 0.48, 5.4, 7), 0, 2.7, 0), tGeo(new THREE.CylinderGeometry(0.1, 0.2, 2.6, 5), 0.8, 4.6, 0.2, 0, -0.7), tGeo(new THREE.CylinderGeometry(0.1, 0.18, 2.4, 5), -0.7, 4.8, -0.3, 0.3, 0.6)];
  const deadTrunk = [tGeo(new THREE.CylinderGeometry(0.12, 0.38, 7, 6), 0, 3.5, 0), tGeo(new THREE.CylinderGeometry(0.04, 0.12, 3, 4), 0.9, 5.2, 0, 0, -0.9), tGeo(new THREE.CylinderGeometry(0.04, 0.11, 2.6, 4), -0.8, 5.8, 0.3, 0.2, 0.8), tGeo(new THREE.CylinderGeometry(0.03, 0.09, 2.2, 4), 0.2, 6.4, -0.8, -0.8, 0.1), tGeo(new THREE.CylinderGeometry(0.03, 0.08, 1.8, 4), 0.5, 3.6, 0.6, 0.8, -0.6)];
  // weeping willow: a low dome with long hanging curtains of leaves
  const willowCrown = [jitterGeo(tGeo(new THREE.SphereGeometry(3, 10, 6, 0, TAU, 0, Math.PI / 2), 0, 5.4, 0, 0, 0, 1), 0.35, 7)];
  for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU, r = 2.3 + (i % 3) * 0.35, len = 3.6 + (i % 4) * 0.6; const g = new THREE.CylinderGeometry(0.75, 0.15, len, 5, 2, true); g.translate(0, -len / 2, 0); g.applyMatrix4(M4(Math.cos(a) * r, 6.0, Math.sin(a) * r, a, 1, 1, 0.35, 0.18 * Math.sin(a), -0.18 * Math.cos(a))); willowCrown.push(jitterGeo(g, 0.2, i)); }
  const mergeT = (list) => mergeGeos(list.map((g) => [g, new THREE.Matrix4()]), false);
  const far = (trunkGeo, crownGeo, tc, cc) => mergeGeos([[trunkGeo, new THREE.Matrix4(), tc.map(lin)], [crownGeo, new THREE.Matrix4(), cc.map(lin)]], true);
  TREE_TYPES.pine = { trunk: tGeo(new THREE.CylinderGeometry(0.14, 0.3, 9.5, 6), 0, 4.75, 0), crown: mergeT(pineCrown), far: far(tGeo(new THREE.CylinderGeometry(0.15, 0.3, 4, 4), 0, 2, 0), tGeo(new THREE.ConeGeometry(2.6, 8, 6), 0, 6.5, 0), [0.25, 0.18, 0.12], [0.12, 0.2, 0.12]), col: [0.36, 0.48, 0.3], r: 0.35 };
  TREE_TYPES.oak = { trunk: mergeT(oakTrunk), crown: mergeT(oakCrown), far: far(tGeo(new THREE.CylinderGeometry(0.3, 0.45, 5, 4), 0, 2.5, 0), tGeo(new THREE.IcosahedronGeometry(3.2, 0), 0, 6.5, 0), [0.25, 0.18, 0.12], [0.22, 0.3, 0.13]), col: [0.5, 0.6, 0.3], r: 0.5 };
  TREE_TYPES.birch = { trunk: tGeo(new THREE.CylinderGeometry(0.1, 0.18, 8, 6), 0, 4, 0), crown: mergeT([jitterGeo(tGeo(new THREE.IcosahedronGeometry(1.8, 1), 0, 7, 0), 0.35, 3), jitterGeo(tGeo(new THREE.IcosahedronGeometry(1.4, 1), 0.6, 5.6, 0.4), 0.3, 4)]), far: far(tGeo(new THREE.CylinderGeometry(0.12, 0.18, 5, 4), 0, 2.5, 0), tGeo(new THREE.IcosahedronGeometry(2, 0), 0, 6.5, 0), [0.8, 0.78, 0.74], [0.42, 0.5, 0.2]), col: [0.62, 0.66, 0.32], r: 0.25, birch: true };
  TREE_TYPES.dead = { trunk: mergeT(deadTrunk), crown: null, far: far(tGeo(new THREE.CylinderGeometry(0.15, 0.38, 7, 4), 0, 3.5, 0), tGeo(new THREE.CylinderGeometry(0.05, 0.1, 3, 3), 0.9, 5.2, 0, 0, -0.9), [0.22, 0.2, 0.19], [0.22, 0.2, 0.19]), col: [1, 1, 1], r: 0.35 };
  TREE_TYPES.willow = { trunk: mergeT([tGeo(new THREE.CylinderGeometry(0.35, 0.6, 5.6, 7), 0, 2.8, 0, 0.1, 0)]), crown: mergeT(willowCrown), far: far(tGeo(new THREE.CylinderGeometry(0.35, 0.55, 5, 4), 0, 2.5, 0), tGeo(new THREE.IcosahedronGeometry(3, 0), 0, 5.5, 0), [0.2, 0.17, 0.12], [0.22, 0.25, 0.12]), col: [0.38, 0.42, 0.22], r: 0.55 };
  const birchBark = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.8 });
  const deadBark = new THREE.MeshStandardMaterial({ map: TEX.bark, color: 0x8a8580, roughness: 1 });
  const maxN = { low: 2500, medium: 5000, high: 9000 }[SET.quality], maxFar = { low: 3000, medium: 7000, high: 12000 }[SET.quality];
  for (const k in TREE_TYPES) {
    const T = TREE_TYPES[k];
    T.trunkMesh = new THREE.InstancedMesh(T.trunk, k === 'birch' ? birchBark : k === 'dead' ? deadBark : MAT.bark, maxN);
    T.trunkMesh.castShadow = true; T.trunkMesh.receiveShadow = true; T.trunkMesh.count = 0; T.trunkMesh.frustumCulled = false; WORLD.root.add(T.trunkMesh);
    if (T.crown) { T.crownMesh = new THREE.InstancedMesh(T.crown, MAT.leaf, maxN); T.crownMesh.castShadow = true; T.crownMesh.receiveShadow = true; T.crownMesh.count = 0; T.crownMesh.frustumCulled = false; T.crownMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxN * 3), 3); WORLD.root.add(T.crownMesh); }
    T.farMesh = new THREE.InstancedMesh(T.far, MAT.farTree, maxFar); T.farMesh.count = 0; T.farMesh.frustumCulled = false; T.farMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(maxFar * 3), 3); WORLD.root.add(T.farMesh);
    T.maxN = maxN; T.maxFar = maxFar;
  }
}
function placeTrees() {
  const rnd = mulberry32(99), step = 5.2, keep = { low: 0.45, medium: 0.7, high: 1 }[SET.quality];
  const P = PLACES;
  for (let z = -HALF + 6; z < HALF - 6; z += step) for (let x = -HALF + 6; x < HALF - 6; x += step) {
    const tx = x + (rnd() - 0.5) * step * 0.9, tz = z + (rnd() - 0.5) * step * 0.9, f = forestAt(tx, tz), s = surfaceAt(tx, tz), r = rnd();
    if (waterDepthAt(tx, tz) > 0.05 && Math.hypot(tx - P.swamp.x, tz - P.swamp.z) > P.swamp.r) continue;
    const sw = Math.hypot(tx - P.swamp.x, tz - P.swamp.z) < P.swamp.r + 20;
    let p = Math.pow(f, 1.3) * 0.85 + (s === SURF.GRASS ? 0.012 : 0); if (sw) p = 0.09;
    if (s === SURF.COBBLE || s === SURF.DIRT || s === SURF.FIELD || s === SURF.BED || s === SURF.SAND) p = 0;
    if (r > p || rnd() > keep) continue;
    const h = heightAt(tx, tz); if (h > 150) continue;
    let type;
    if (sw) type = rnd() < 0.55 ? 'willow' : 'dead';
    else if (Math.hypot(tx - P.castle.x, tz - P.castle.z) < 230 || Math.hypot(tx - P.graveyard.x, tz - P.graveyard.z) < 120) type = rnd() < 0.45 ? 'dead' : 'pine';
    else if (h > 55 || tz < -420) type = rnd() < 0.92 ? 'pine' : 'dead';
    else { const m = fbm(tx / 160, tz / 160, 2, 77); type = m > 0.15 ? 'pine' : rnd() < 0.22 ? 'birch' : rnd() < 0.04 ? 'dead' : 'oak'; }
    const sc = 0.75 + rnd() * 0.6, tr = { x: tx, z: tz, y: h - 0.2, type, s: sc, rot: rnd() * TAU, tint: 0.82 + rnd() * 0.3, au: rnd() };
    WORLD.trees.push(tr);
    const bk = Math.floor(tx / 50) * 1000 + Math.floor(tz / 50); if (!WORLD.treeBuckets.has(bk)) WORLD.treeBuckets.set(bk, []); WORLD.treeBuckets.get(bk).push(tr);
    addCollider({ kind: 'circle', x: tx, z: tz, r: TREE_TYPES[type].r * sc + 0.1, y0: h - 1, y1: h + 8 });
  }
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const VEG = { cx: 1e9, cz: 1e9, gx: 1e9, gz: 1e9, gT: 0 };
function updateTrees(px, pz, force) {
  if (!force && Math.hypot(px - VEG.cx, pz - VEG.cz) < 20) return; VEG.cx = px; VEG.cz = pz;
  const nearR = { low: 90, medium: 130, high: 170 }[SET.quality], farR = { low: 320, medium: 450, high: 620 }[SET.quality];
  for (const k in TREE_TYPES) { TREE_TYPES[k].n = 0; TREE_TYPES[k].nf = 0; }
  const b0x = Math.floor((px - farR) / 50), b1x = Math.floor((px + farR) / 50), b0z = Math.floor((pz - farR) / 50), b1z = Math.floor((pz + farR) / 50);
  for (let bx = b0x; bx <= b1x; bx++) for (let bz = b0z; bz <= b1z; bz++) {
    const list = WORLD.treeBuckets.get(bx * 1000 + bz); if (!list) continue;
    for (const t of list) {
      const d = Math.hypot(t.x - px, t.z - pz); if (d > farR) continue; const T = TREE_TYPES[t.type];
      _q.setFromEuler(_e.set(0, t.rot, 0)); _m4.compose(_v.set(t.x, t.y, t.z), _q, _s.set(t.s, t.s * (0.9 + t.tint * 0.15), t.s));
      const autumn = t.au < 0.18 && t.type === 'oak' ? 1 : t.au < 0.3 && t.type === 'birch' ? 1 : 0;
      _c.setRGB(Math.min(1, T.col[0] * t.tint * (autumn ? 1.7 : 1)), Math.min(1, T.col[1] * t.tint * (autumn ? 0.95 : 1)), Math.min(1, T.col[2] * t.tint * (autumn ? 0.5 : 1)), THREE.SRGBColorSpace);
      if (d < nearR && T.n < T.maxN) { T.trunkMesh.setMatrixAt(T.n, _m4); if (T.crownMesh) T.crownMesh.setColorAt(T.n, _c); if (T.crownMesh) T.crownMesh.setMatrixAt(T.n, _m4); T.n++; }
      else if (T.nf < T.maxFar) { T.farMesh.setMatrixAt(T.nf, _m4); _c.multiplyScalar(autumn ? 1.6 : 1); T.farMesh.setColorAt(T.nf, autumn ? _c.setRGB(1.5, 1, 0.5) : _c.setRGB(t.tint, t.tint, t.tint)); T.nf++; }
    }
  }
  for (const k in TREE_TYPES) {
    const T = TREE_TYPES[k]; T.trunkMesh.count = T.n; T.trunkMesh.instanceMatrix.needsUpdate = true;
    if (T.crownMesh) { T.crownMesh.count = T.n; T.crownMesh.instanceMatrix.needsUpdate = true; T.crownMesh.instanceColor.needsUpdate = true; }
    T.farMesh.count = T.nf; T.farMesh.instanceMatrix.needsUpdate = true; T.farMesh.instanceColor.needsUpdate = true;
  }
}
// ---------- rocks and bushes ----------
const ROCKS = { mesh: null, list: [] }, BUSH = { mesh: null, list: [] };
function buildRocksAndBushes() {
  const rnd = mulberry32(7);
  const rg = jitterGeo(new THREE.DodecahedronGeometry(1, 1), 0.28, 2); { const p = rg.attributes.position, n = rg.attributes.normal, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const moss = smoothstep(0.55, 0.9, n.getY(i)) * 0.7, v = 0.85 + vnoise(p.getX(i) * 3, p.getZ(i) * 3, 4) * 0.12; c[i * 3] = lin(lerp(v, 0.42, moss)); c[i * 3 + 1] = lin(lerp(v, 0.55, moss)); c[i * 3 + 2] = lin(lerp(v, 0.28, moss)); } rg.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const P = PLACES;
  for (let i = 0; i < 9000 && ROCKS.list.length < { low: 900, medium: 1600, high: 2400 }[SET.quality]; i++) {
    const x = rand(-HALF + 20, HALF - 20), z = rand(-HALF + 20, HALF - 20), s = surfaceAt(x, z), sl = slopeAt(x, z), h = heightAt(x, z);
    let p = s === SURF.ROCK ? 0.5 : s === SURF.SNOW ? 0.2 : s === SURF.SAND || s === SURF.BED ? 0.35 : s === SURF.FOREST ? 0.12 : s === SURF.GRASS ? 0.05 : 0;
    if (Math.hypot(x - P.ashford.x, z - P.ashford.z) < P.ashford.r + 10) p = 0; if (s === SURF.COBBLE || s === SURF.DIRT || s === SURF.FIELD) p = 0;
    if (rnd() > p) continue;
    const sc = s === SURF.ROCK ? rand(0.8, 4.5) : rand(0.3, 1.6), r = { x, z, y: h - sc * 0.35, s: sc, sy: sc * rand(0.5, 0.9), rot: rand(0, TAU), tilt: rand(-0.3, 0.3) };
    ROCKS.list.push(r); if (sc > 0.9) addCollider({ kind: 'circle', x, z, r: sc * 0.85, y0: h - 2, y1: h + r.sy * 0.9 });
  }
  ROCKS.mesh = new THREE.InstancedMesh(rg, MAT.rock, ROCKS.list.length); ROCKS.mesh.castShadow = true; ROCKS.mesh.receiveShadow = true;
  ROCKS.list.forEach((r, i) => { ROCKS.mesh.setMatrixAt(i, M4(r.x, r.y, r.z, r.rot, r.s, r.sy, r.s * rand(0.8, 1.2), r.tilt, r.tilt * 0.5)); });
  WORLD.root.add(ROCKS.mesh);
  const bg = jitterGeo(new THREE.IcosahedronGeometry(0.9, 1), 0.3, 9); bg.translate(0, 0.45, 0); bg.scale(1, 0.75, 1);
  const nb = { low: 1500, medium: 3500, high: 6000 }[SET.quality];
  for (let i = 0; i < 40000 && BUSH.list.length < nb; i++) {
    const x = rand(-HALF + 20, HALF - 20), z = rand(-HALF + 20, HALF - 20), f = forestAt(x, z), s = surfaceAt(x, z);
    if ((s !== SURF.FOREST && s !== SURF.GRASS && s !== SURF.MUD) || rnd() > f * 0.8 + (s === SURF.MUD ? 0.3 : 0.02)) continue;
    if (waterDepthAt(x, z) > 0.1) continue;
    BUSH.list.push({ x, z, y: heightAt(x, z), s: rand(0.6, 1.5), rot: rand(0, TAU), c: rand(0.7, 1.1), mud: s === SURF.MUD });
  }
  BUSH.mesh = new THREE.InstancedMesh(bg, MAT.bush, BUSH.list.length); BUSH.mesh.castShadow = SET.quality === 'high'; BUSH.mesh.receiveShadow = true;
  BUSH.list.forEach((b, i) => { BUSH.mesh.setMatrixAt(i, M4(b.x, b.y, b.z, b.rot, b.s, b.s * 0.8, b.s)); BUSH.mesh.setColorAt(i, _c.setRGB(0.3 * b.c * (b.mud ? 0.8 : 1), 0.42 * b.c, 0.2 * b.c, THREE.SRGBColorSpace)); });
  WORLD.root.add(BUSH.mesh);
}
// ---------- grass that follows you around ----------
const GRASS = { mesh: null, max: 0, r: 0 };
function buildGrass() {
  GRASS.max = { low: 0, medium: 16000, high: 34000 }[SET.quality]; GRASS.r = { low: 0, medium: 26, high: 36 }[SET.quality];
  if (!GRASS.max) return;
  const g = new THREE.BufferGeometry(), P = [], C = [];
  const seg = 3, w = 0.07;
  for (let s = 0; s < seg; s++) { const y0 = s / seg, y1 = (s + 1) / seg, w0 = w * (1 - y0), w1 = w * (1 - y1), b0 = y0 * y0 * 0.25, b1 = y1 * y1 * 0.25; P.push(-w0, y0, b0, w0, y0, b0, -w1, y1, b1, w0, y0, b0, w1, y1, b1, -w1, y1, b1); for (const y of [y0, y0, y1, y0, y1, y1]) { const k = lin(0.55 + y * 0.45); C.push(k, k, k); } }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
  // grass faces up so lighting matches the ground
  const nm = g.attributes.normal; for (let i = 0; i < nm.count; i++) nm.setXYZ(i, 0, 1, 0.2);
  GRASS.mesh = new THREE.InstancedMesh(g, MAT.grass, GRASS.max); GRASS.mesh.count = 0; GRASS.mesh.frustumCulled = false; GRASS.mesh.receiveShadow = true;
  GRASS.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GRASS.max * 3), 3); WORLD.root.add(GRASS.mesh);
}
function updateGrass(px, pz, force) {
  if (!GRASS.mesh || G.area !== 'outside') { if (GRASS.mesh) GRASS.mesh.visible = G.area === 'outside'; return; }
  if (!force && Math.hypot(px - VEG.gx, pz - VEG.gz) < 5) return; VEG.gx = px; VEG.gz = pz;
  const R = GRASS.r, sp = Math.sqrt((Math.PI * R * R) / (GRASS.max * 0.8)), col = [0, 0, 0]; let n = 0;
  const i0 = Math.floor((px - R) / sp), i1 = Math.floor((px + R) / sp), j0 = Math.floor((pz - R) / sp), j1 = Math.floor((pz + R) / sp);
  for (let j = j0; j <= j1 && n < GRASS.max; j++) for (let i = i0; i <= i1 && n < GRASS.max; i++) {
    const hx = hash2(i, j, 1), hz = hash2(i, j, 2), x = (i + hx) * sp, z = (j + hz) * sp, d = Math.hypot(x - px, z - pz); if (d > R) continue;
    const k = gridIdx(x, z), s = TER.s[k]; if (s !== SURF.GRASS && s !== SURF.FOREST && s !== SURF.FIELD && s !== SURF.MUD) continue;
    const dens = s === SURF.FOREST ? 0.45 : s === SURF.MUD ? 0.3 : 1; const hr = hash2(i, j, 3); if (hr > dens) continue;
    const y = heightAt(x, z); if (waterLevelAt(x, z) > y + 0.15 && s !== SURF.MUD) continue;
    const fade = 1 - smoothstep(R * 0.7, R, d), hs = hash2(i, j, 4);
    let hgt = (0.35 + hs * 0.5) * (0.5 + 0.5 * (fbm(x / 14, z / 14, 2, 5) * 0.5 + 0.5)) * fade;
    if (s === SURF.FIELD) hgt *= 1.7; if (s === SURF.MUD) hgt *= 2.4;
    _q.setFromEuler(_e.set(0, hr * 40, 0)); _m4.compose(_v.set(x, y - 0.03, z), _q, _s.set(1 + hs, hgt, 1)); GRASS.mesh.setMatrixAt(n, _m4);
    groundColor(clamp(Math.round((x + HALF) / CELL), 0, GN - 1), clamp(Math.round((z + HALF) / CELL), 0, GN - 1), col);
    const flower = hs > 0.985 && s === SURF.GRASS; const fc = Math.floor(hr * 1000) % 3;
    if (flower) _c.setRGB(fc === 0 ? 1 : fc === 1 ? 1 : 0.7, fc === 0 ? 0.95 : fc === 1 ? 0.5 : 0.5, fc === 0 ? 0.3 : fc === 1 ? 0.6 : 1, THREE.SRGBColorSpace);
    else _c.setRGB(Math.min(1, col[0] * 1.25 + 0.03), Math.min(1, col[1] * 1.3 + 0.04), Math.min(1, col[2] * 1.1), THREE.SRGBColorSpace);
    GRASS.mesh.setColorAt(n, _c); n++;
  }
  GRASS.mesh.count = n; GRASS.mesh.instanceMatrix.needsUpdate = true; GRASS.mesh.instanceColor.needsUpdate = true; GRASS.mesh.visible = true;
}
// ---------- herbs you can pick ----------
const HERB_TYPES = {
  bloodroot: { name: 'Bloodroot', col: 0xb01818, where: (s, h, x, z) => (s === SURF.GRASS || s === SURF.FOREST) && h < 60 },
  silverleaf: { name: 'Silverleaf', col: 0xd8e4f0, where: (s, h, x, z) => (s === SURF.SAND || s === SURF.GRASS) && waterLevelAt(x + 8, z) > -1e9 },
  ghostcap: { name: 'Ghostcap', col: 0x9ff0d8, glow: true, where: (s, h, x, z) => s === SURF.MUD || Math.hypot(x - PLACES.graveyard.x, z - PLACES.graveyard.z) < 70 || (s === SURF.FOREST && Math.hypot(x - PLACES.wolfwood.x, z - PLACES.wolfwood.z) < 150) },
  frostbloom: { name: 'Frostbloom', col: 0x5aa0ff, where: (s, h) => h > 70 && (s === SURF.GRASS || s === SURF.ROCK || s === SURF.SNOW || s === SURF.FOREST) },
};
function buildHerbs() {
  const rnd = mulberry32(31); const per = { bloodroot: 120, silverleaf: 80, ghostcap: 90, frostbloom: 70 };
  const geoFlower = mergeGeos([[new THREE.CylinderGeometry(0.02, 0.03, 0.4, 4), M4(0, 0.2, 0)], [new THREE.IcosahedronGeometry(0.11, 0), M4(0, 0.42, 0)], [new THREE.IcosahedronGeometry(0.08, 0), M4(0.12, 0.3, 0.04)], [new THREE.IcosahedronGeometry(0.08, 0), M4(-0.1, 0.34, -0.06)]]);
  const geoShroom = mergeGeos([[new THREE.CylinderGeometry(0.04, 0.05, 0.22, 6), M4(0, 0.11, 0)], [new THREE.SphereGeometry(0.14, 8, 4, 0, TAU, 0, Math.PI / 2), M4(0, 0.2, 0, 0, 1, 0.7, 1)], [new THREE.CylinderGeometry(0.03, 0.04, 0.16, 6), M4(0.15, 0.08, 0.05)], [new THREE.SphereGeometry(0.1, 8, 4, 0, TAU, 0, Math.PI / 2), M4(0.15, 0.15, 0.05, 0, 1, 0.7, 1)]]);
  for (const k in HERB_TYPES) {
    const H = HERB_TYPES[k], list = [];
    for (let i = 0; i < 60000 && list.length < per[k]; i++) {
      const x = rnd() * (WORLD_SIZE - 80) - HALF + 40, z = rnd() * (WORLD_SIZE - 80) - HALF + 40, s = surfaceAt(x, z), h = heightAt(x, z);
      if (!H.where(s, h, x, z) || waterDepthAt(x, z) > 0.05 || slopeAt(x, z) > 0.7) continue;
      if (Math.hypot(x - PLACES.ashford.x, z - PLACES.ashford.z) < 90) continue;
      list.push({ id: k + list.length, type: k, x, z, y: h });
    }
    const mat = new THREE.MeshStandardMaterial({ color: H.col, roughness: 0.6, emissive: H.glow ? H.col : 0x000000, emissiveIntensity: H.glow ? 0.6 : 0 });
    H.mesh = new THREE.InstancedMesh(k === 'ghostcap' ? geoShroom : geoFlower, mat, list.length); H.list = list;
    list.forEach((e, i) => H.mesh.setMatrixAt(i, M4(e.x, e.y, e.z, rnd() * TAU, 1.2, 1.2, 1.2)));
    WORLD.root.add(H.mesh); WORLD.herbs.push(...list);
    for (const e of list) e.H = H;
  }
}
function setHerbPicked(e, picked) { const i = e.H.list.indexOf(e); e.picked = picked; e.H.mesh.setMatrixAt(i, picked ? M4(0, -999, 0) : M4(e.x, e.y, e.z, i * 1.7, 1.2, 1.2, 1.2)); e.H.mesh.instanceMatrix.needsUpdate = true; }
// ---------- lamps, fires and torches ----------
const LIGHTS = { pool: [], max: 0 };
function addLightSource(o) { // {x,y,z,color,intensity,range,kind:'lamp'|'fire'|'torch'|'magic', night:true, sprite size}
  o.glow = new THREE.Sprite(o.kind === 'fire' ? MAT.fire.clone() : MAT.glow.clone()); o.glow.material.color.setHex(o.color); o.glow.position.set(o.x, o.y, o.z); o.glow.scale.setScalar(o.size || 1.6); o.ph = rand(0, 10);
  (o.parent || WORLD.root).add(o.glow); WORLD.lights.push(o); return o;
}
function buildLightPool() { LIGHTS.max = { low: 2, medium: 4, high: 6 }[SET.quality]; for (let i = 0; i < LIGHTS.max; i++) { const l = new THREE.PointLight(0xffaa55, 0, 18, 1.6); scene.add(l); LIGHTS.pool.push(l); } }
function updateLights(dt, px, py, pz) {
  const dark = 1 - smoothstep(-0.05, 0.15, Sky.sunDir.y), t = Sky.u.time.value;
  const cand = [];
  for (const L of WORLD.lights) {
    if (L.area && L.area !== G.area) { L.glow.visible = false; continue; } if (!L.area && G.area !== 'outside') { L.glow.visible = false; continue; }
    const on = L.always ? 1 : dark, fl = L.kind === 'fire' || L.kind === 'torch' ? 0.8 + Math.sin(t * 11 + L.ph) * 0.12 + Math.sin(t * 23 + L.ph) * 0.08 : 1;
    L.glow.visible = on > 0.05; L.glow.material.opacity = on * fl * (L.kind === 'fire' ? 0.9 : 0.75); L.cur = on * fl;
    if (L.kind === 'fire') L.glow.scale.setScalar((L.size || 1.6) * (0.9 + fl * 0.2));
    if (on > 0.05) { const d = Math.hypot(L.x - px, L.y - py, L.z - pz); if (d < 70) cand.push([d, L]); }
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < LIGHTS.pool.length; i++) { const l = LIGHTS.pool[i], c = cand[i]; if (!c) { l.intensity = 0; continue; } const L = c[1]; l.position.set(L.x, L.y, L.z); l.color.setHex(L.color); l.distance = L.range || 16; l.intensity = (L.intensity || 6) * L.cur * (1 - smoothstep(45, 70, c[0])); }
  MAT.window.emissiveIntensity = dark * 1.3;
}
