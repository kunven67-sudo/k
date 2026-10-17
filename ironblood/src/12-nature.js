
// ---------- nature: real 3D scans (Poly Haven, CC0), placed in 100 m cells ----------
const ASSET_BASE = 'https://raw.githubusercontent.com/kunven67-sudo/k/claude/adult-game-concept-llgnf3/ironblood/assets/';
const SCANS = ['fir', 'oak', 'dead_tree_trunk', 'dead_tree_trunk_02', 'tree_stump_01', 'root_cluster_01', 'dry_branches_medium_01', 'fern_02', 'grass_medium_01', 'grass_medium_02', 'moss_01', 'rock_moss_set_01', 'rock_moss_set_02', 'namaqualand_boulder_02', 'stone_fire_pit', 'wooden_crate_01', 'kite_shield', 'large_castle_door'];
const scan = {};          // name -> list of variants; a variant is a list of { geo, mat, card }
let scansLoaded = 0;
const natureCells = new Map();
const windUniforms = { uTime: { value: 0 } };
// leaves and needles sway: more at the tips (higher up), each tree on its own beat
function addWind(mat, strength) {
  if (mat.userData.wind) return;
  mat.userData.wind = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
      #else
        vec2 wp = vec2(0.0);
      #endif
      float hgt = max(0.0, position.y);
      float sw = sin(uTime * 1.3 + wp.x * 0.2 + wp.y * 0.15) * 0.6 + sin(uTime * 2.7 + position.x * 2.0 + position.z * 2.0) * 0.25;
      transformed.x += sw * ${strength.toFixed(3)} * hgt;
      transformed.z += sw * ${(strength * 0.6).toFixed(3)} * hgt;`);
  };
  mat.customProgramCacheKey = () => 'wind' + strength;
}
function loadScans(onDone) {
  const L = new GLTFLoader();
  for (const name of SCANS) {
    L.load(ASSET_BASE + name + '.glb', (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      // each top-level node is one variant (the fir file holds three different trees)
      const tops = gltf.scene.children.length > 1 ? gltf.scene.children : [gltf.scene];
      scan[name] = tops.map(top => {
        const parts = [];
        top.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().makeTranslation(-top.position.x, 0, -top.position.z);
        top.traverse(o => {
          if (!o.isMesh) return;
          const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
          const mat = o.material;
          const card = mat.alphaTest > 0 || mat.transparent;
          if (card) { mat.transparent = false; mat.alphaTest = Math.max(0.35, mat.alphaTest); mat.side = THREE.DoubleSide; addWind(mat, name === 'fir' ? 0.006 : name === 'oak' ? 0.012 : 0.03); }
          mat.envMapIntensity = 0.7;
          parts.push({ geo, mat, card });
        });
        const bb = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); bb.union(p.geo.boundingBox); }
        return { parts, height: bb.max.y - bb.min.y, radius: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 };
      });
      scansLoaded++;
      if (scansLoaded === SCANS.length) onDone();
    }, undefined, (e) => { console.warn('scan failed', name, e); scan[name] = []; scansLoaded++; if (scansLoaded === SCANS.length) onDone(); });
  }
}
// impostor: the game photographs each tree from the front and side once, far trees become two crossed cards
function makeImpostor(v) {
  if (v.impostor) return v.impostor;
  const tmp = new THREE.Scene();
  tmp.add(new THREE.AmbientLight(0xffffff, 1.4));
  const dl = new THREE.DirectionalLight(0xffffff, 2.2); dl.position.set(0.4, 1, 0.6); tmp.add(dl);
  for (const p of v.parts) tmp.add(new THREE.Mesh(p.geo, p.mat));
  const bb = new THREE.Box3().setFromObject(tmp);
  const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z), h = bb.max.y - bb.min.y;
  const rt = new THREE.WebGLRenderTarget(1024, 1024, { colorSpace: THREE.SRGBColorSpace });
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, bb.max.y, bb.min.y, -100, 100);
  const prevT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha(), prevF = scene.fog;
  const prevTone = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  for (const [i, ang] of [[0, 0], [1, Math.PI / 2]]) {
    renderer.setViewport(i * 512, 0, 512, 1024); renderer.setScissor(i * 512, 0, 512, 1024); renderer.setScissorTest(true);
    cam.position.set(cx + Math.sin(ang) * 50, 0, cz + Math.cos(ang) * 50); cam.lookAt(cx, 0, cz); cam.updateProjectionMatrix();
    renderer.render(tmp, cam);
  }
  renderer.setScissorTest(false); renderer.setRenderTarget(prevT); renderer.setClearColor(prevC, prevA); renderer.toneMapping = prevTone;
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  // two crossed planes, each showing its half of the photo; normals point up so they light like the ground
  const geo = new THREE.BufferGeometry(), pos = [], uv = [], idx = [];
  const quad = (ang, u0) => {
    const k = pos.length / 3, dx = Math.cos(ang) * w / 2, dz = -Math.sin(ang) * w / 2;
    pos.push(cx - dx, bb.min.y, cz - dz, cx + dx, bb.min.y, cz + dz, cx + dx, bb.max.y, cz + dz, cx - dx, bb.max.y, cz - dz);
    uv.push(u0, 0, u0 + 0.5, 0, u0 + 0.5, 1, u0, 1);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  quad(0, 0); quad(Math.PI / 2, 0.5);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshLambertMaterial({ map: rt.texture, alphaTest: 0.45, side: THREE.DoubleSide });
  v.impostor = { geo, mat };
  return v.impostor;
}
// LOD bands (meters from the camera): trees full -> thinned -> impostor; rocks and props full -> no shadow; clutter close only
const CELL = 25;
const BANDS = {
  tree: [[0, 35, 'full', true], [35, 70, 'thin', false], [70, 420, 'imp', false]],
  rock: [[0, 60, 'full', true], [60, 260, 'full', false]],
  prop: [[0, 70, 'full', true], [70, 140, 'full', false]],
  clutter: [[0, 32, 'full', false]],
};
function plant(name, vi, key, mats, opts = {}) {
  const v = scan[name] && scan[name][vi];
  if (!v || !mats.length) return;
  if (!natureCells.has(key)) natureCells.set(key, []);
  const bands = BANDS[opts.kind || 'prop'];
  for (const [d0, d1, mode, shadow] of bands) {
    const list = [];
    if (mode === 'imp') list.push(makeImpostor(v));
    else for (const p of v.parts) {
      let geo = p.geo;
      if (mode === 'thin' && p.card && geo.index) {
        geo = new THREE.BufferGeometry();
        for (const k in p.geo.attributes) geo.setAttribute(k, p.geo.attributes[k]);
        geo.setIndex(p.geo.index);
        geo.setDrawRange(0, Math.floor(p.geo.index.count * 0.3 / 3) * 3);
      }
      list.push({ geo, mat: p.mat });
    }
    for (const { geo, mat } of list) {
      const m = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((mx, i) => m.setMatrixAt(i, mx));
      m.castShadow = shadow; m.receiveShadow = mode !== 'imp';
      m.computeBoundingSphere();
      m.userData.d0 = d0; m.userData.d1 = d1;
      m.visible = false;
      scene.add(m);
      natureCells.get(key).push(m);
    }
  }
}
let natureReady = false;
function buildNature() {
  const buckets = new Map();
  const put = (name, vi, x, z, s, ry, opts = {}) => {
    const y = terrainH(x, z) - (opts.sink || 0.05) * s;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(opts.tilt || 0, ry, opts.tilt2 || 0)), new THREE.Vector3(s, s, s));
    const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
    const bk = name + '|' + vi + '|' + key;
    if (!buckets.has(bk)) buckets.set(bk, { name, vi, key, list: [], opts });
    buckets.get(bk).list.push(m);
    if (opts.r) circles.push({ x, z, r: opts.r * s });
  };
  const r = mulberry32(2024);
  const clear = (x, z, pad) => {
    if (pathDist(x, z) < 5 + pad || riverDist(x, z) < 13 + pad || onBridge(x, z)) return false;
    if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + pad) return false;
    if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r + 10 + pad) return false;
    if (Math.hypot(x - FORTRESS.x, z - FORTRESS.z) < FORTRESS.r + 22 + pad) return false;
    if (solidAt(x, z, 2 + pad)) return false;
    for (const c of CAMP_SPOTS) if (Math.hypot(x - c.x, z - c.z) < 14) return false;
    return true;
  };
  const spaced = [];
  const farEnough = (x, z, d) => { for (const p of spaced) if (Math.abs(p[0] - x) < d && Math.abs(p[1] - z) < d && Math.hypot(p[0] - x, p[1] - z) < d) return false; return true; };
  const firN = scan.fir.length;
  // fir forests: the mountain slopes and the western woods
  for (let i = 0, n = 0; i < 60000 && n < 820; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = (r() * 2 - 1) * (HALF - 10);
    const dens = Math.max(smooth(-110, -170, z), smooth(-200, -260, x)) * (0.5 + 0.5 * fbm(x * 0.02, z * 0.02, 3));
    if (r() > dens) continue;
    const h = terrainH(x, z), sl = slopeAt(x, z);
    if (sl > 0.85 || h > 95 + fbm(x * 0.03, z * 0.03, 2) * 12 || !clear(x, z, 0) || !farEnough(x, z, 4.5)) continue;
    spaced.push([x, z]);
    put('fir', Math.floor(r() * Math.max(1, firN - 1)), x, z, 0.85 + r() * 0.45, r() * 6.28, { r: 0.35, kind: 'tree' });
    n++;
  }
  // broadleaf groves across the valley, a few firs mixed in
  for (let i = 0, n = 0; i < 60000 && n < 450; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = -100 + r() * (HALF + 90);
    if (x > BATTLE_X - 25) continue;
    if (fbm(x * 0.012 + 3, z * 0.012, 3) < 0.1 && r() > 0.04) continue;
    if (!clear(x, z, 0) || slopeAt(x, z) > 0.6 || !farEnough(x, z, 7)) continue;
    spaced.push([x, z]);
    if (r() < 0.75) put('oak', 0, x, z, 1.0 + r() * 0.6, r() * 6.28, { r: 0.3, kind: 'tree' });
    else put('fir', Math.floor(r() * firN), x, z, 0.8 + r() * 0.4, r() * 6.28, { r: 0.35, kind: 'tree' });
    n++;
  }
  // forest floor: ferns, roots, stumps, fallen dry branches, moss, near the trees
  for (const [tx, tz] of spaced.slice()) {
    const k = r();
    if (k < 0.55) for (let j = 0; j < 3; j++) { const a = r() * 6.28, d = 1.5 + r() * 4; const x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d; if (!solidAt(x, z, 0.5) && pathDist(x, z) > 3) put('fern_02', 0, x, z, 0.8 + r() * 0.8, r() * 6.28, { kind: 'clutter' }); }
    if (k > 0.85) { const a = r() * 6.28, x = tx + Math.cos(a) * 3, z = tz + Math.sin(a) * 3; put(r() < 0.5 ? 'tree_stump_01' : 'root_cluster_01', 0, x, z, 0.8 + r() * 0.5, r() * 6.28, { r: 0.4, kind: 'prop' }); }
    if (k > 0.6 && k < 0.72) { const a = r() * 6.28, x = tx + Math.cos(a) * 4, z = tz + Math.sin(a) * 4; put('dry_branches_medium_01', 0, x, z, 1, r() * 6.28, { kind: 'clutter' }); }
    if (k > 0.4 && k < 0.5) { const a = r() * 6.28, x = tx + Math.cos(a) * 2, z = tz + Math.sin(a) * 2; put('moss_01', 0, x, z, 1 + r(), r() * 6.28, { kind: 'clutter' }); }
  }
  // grass clumps scattered in the fields (the short blades are drawn separately)
  for (let i = 0, n = 0; i < 20000 && n < 700; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = -150 + r() * (HALF + 140);
    if (x > BATTLE_X + 30 || pathDist(x, z) < 3 || riverDist(x, z) < 12 || solidAt(x, z, 1) || onBridge(x, z)) continue;
    if (Math.hypot(x - SQUARE.x, z - SQUARE.z) < SQUARE.r + 4) continue;
    const sp = splatAt(x, z, terrainH(x, z), slopeAt(x, z));
    if (sp.grass < 0.6) continue;
    put(r() < 0.5 ? 'grass_medium_01' : 'grass_medium_02', 0, x, z, 0.8 + r() * 0.6, r() * 6.28, { kind: 'clutter' });
    n++;
  }
  // dead trees on the battlefield, fallen trunks in the woods
  for (let i = 0, n = 0; i < 5000 && n < 60; i++) {
    const battle = n < 40;
    const x = battle ? BATTLE_X + r() * (HALF - BATTLE_X - 10) : (r() * 2 - 1) * (HALF - 20), z = (r() * 2 - 1) * (HALF - 20);
    if (!clear(x, z, 0) || !farEnough(x, z, 9)) continue;
    spaced.push([x, z]);
    put(r() < 0.5 ? 'dead_tree_trunk' : 'dead_tree_trunk_02', 0, x, z, 0.9 + r() * 0.5, r() * 6.28, { r: 0.4, kind: 'rock' });
    n++;
  }
  // boulders and mossy rocks: mountains, river banks, fields
  for (let i = 0, n = 0; i < 20000 && n < 260; i++) {
    const x = (r() * 2 - 1) * (HALF - 10), z = (r() * 2 - 1) * (HALF - 10);
    const sl = slopeAt(x, z), rd = riverDist(x, z);
    const want = (z < -120 ? 0.25 : 0.03) + (sl > 0.5 ? 0.2 : 0) + (rd > 11 && rd < 18 ? 0.25 : 0);
    if (r() > want) continue;
    if (pathDist(x, z) < 4 || onBridge(x, z) || solidAt(x, z, 2) || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r - 10 || Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.r) continue;
    const big = z < -120 && r() < 0.5;
    const name = big ? 'namaqualand_boulder_02' : r() < 0.5 ? 'rock_moss_set_01' : 'rock_moss_set_02';
    const v = scan[name] && scan[name][0];
    const s = (big ? 1.2 + r() * 2.5 : 0.7 + r() * 1.4);
    put(name, 0, x, z, s, r() * 6.28, { sink: 0.1, r: v ? v.radius * 0.8 : 0.6, kind: 'rock' });
    n++;
  }
  for (const b of buckets.values()) plant(b.name, b.vi, b.key, b.list, b.opts);
  placeCampScans();
  natureReady = true;
}
// scanned props at the camps: fire pits, crates, shields leaning on things
function placeCampScans() {
  const r = mulberry32(31);
  const props = new Map();
  const add = (name, x, z, s, ry, y) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y ?? terrainH(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, s, s));
    const key = Math.floor(x / CELL) + ',' + Math.floor(z / CELL);
    const k = name + '|' + key;
    if (!props.has(k)) props.set(k, { name, key, list: [] });
    props.get(k).list.push(m);
  };
  for (const c of CAMP_SPOTS) {
    if (!(Math.hypot(c.x - CASTLE.x, c.z - CASTLE.z) < CASTLE.r)) add('stone_fire_pit', c.x, c.z, 1.1, r() * 6.28);
    for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = 4 + r() * 2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d; if (!solidAt(x, z, 0.6)) { add('wooden_crate_01', x, z, 1, r() * 6.28); circles.push({ x, z, r: 0.45 }); } }
    const a = r() * 6.28, x = c.x + Math.cos(a) * 3, z = c.z + Math.sin(a) * 3; add('kite_shield', x, z, 1, a);
  }
  for (const p of props.values()) plant(p.name, 0, p.key, p.list, { kind: 'prop' });
}
let natureCheck = 0;
function updateNature(dt, t) {
  windUniforms.uTime.value = t;
  natureCheck -= dt;
  if (natureCheck > 0) return;
  natureCheck = 0.25;
  const px = camera.position.x, pz = camera.position.z;
  for (const [key, list] of natureCells) {
    const [cx, cz] = key.split(',').map(Number);
    // one LOD band per cell, picked by the distance to the cell's center
    const d = Math.hypot((cx + 0.5) * CELL - px, (cz + 0.5) * CELL - pz);
    for (const m of list) m.visible = d >= m.userData.d0 && d < m.userData.d1;
  }
}
