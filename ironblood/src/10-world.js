// ---------- helpers ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, z, oct = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2.03; } return s / n; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- world layout (meters; -Z is north) ----------
const HALF = 400, CELLS = 400, SEG = (HALF * 2) / CELLS;
const WATER_Y = 0;
const VILLAGE = { x: 24, z: 46, r: 58 };
const SQUARE = { x: 24, z: 46, r: 15 };
const CASTLE = { x: -112, z: 92, r: 34, top: 26 };
const FORTRESS = { x: 0, z: -300, r: 40 };
const BATTLE_X = 150;
const RIVER = [[-420, 70], [-300, 40], [-200, 24], [-120, -6], [-40, -18], [40, -12], [120, 10], [210, 26], [300, 6], [420, -10]];
const ROADS = [
  [[24, 46], [6, 20], [2, -14], [4, -50], [10, -120], [4, -200], [0, -262]],      // village south over the bridge, north to the fortress
  [[24, 46], [-20, 60], [-60, 74], [-84, 88], [-96, 92]],                         // village to the castle gate
  [[24, 46], [70, 40], [130, 28], [200, 40], [290, 20], [380, 30]],               // village east to the battlefield
  [[24, 46], [40, 100], [50, 180], [60, 260]],                                     // south road
];
function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function polyDist(line, x, z) { let d = 1e9; for (let i = 0; i < line.length - 1; i++) d = Math.min(d, distToSeg(x, z, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])); return d; }
function riverDist(x, z) { return polyDist(RIVER, x, z); }
function pathDist(x, z) { let d = 1e9; for (const r of ROADS) d = Math.min(d, polyDist(r, x, z)); return d; }
// the stone bridge where the south road crosses the river
const BRIDGE = (() => {
  // find the crossing of road 0 and the river
  let best = null, bd = 1e9;
  for (let t = 0; t <= 1; t += 0.002) {
    const r = ROADS[0];
    for (let i = 0; i < r.length - 1; i++) {
      const x = lerp(r[i][0], r[i + 1][0], t), z = lerp(r[i][1], r[i + 1][1], t), d = riverDist(x, z);
      if (d < bd) { bd = d; best = { x, z, i }; }
    }
  }
  const r = ROADS[0][best.i], r2 = ROADS[0][best.i + 1];
  const ang = Math.atan2(r2[0] - r[0], r2[1] - r[1]);
  return { x: best.x, z: best.z, ang, len: 34, w: 6, deck: WATER_Y + 3.2 };
})();
function bridgeLocal(x, z) {
  const dx = x - BRIDGE.x, dz = z - BRIDGE.z, c = Math.cos(BRIDGE.ang), s = Math.sin(BRIDGE.ang);
  return { u: dx * c - dz * s, v: dx * s + dz * c }; // u across, v along the bridge
}
function onBridge(x, z) { const l = bridgeLocal(x, z); return Math.abs(l.u) < BRIDGE.w / 2 && Math.abs(l.v) < BRIDGE.len / 2; }

function rawHeight(x, z) {
  // rolling farmland
  let h = 6 + fbm(x * 0.006, z * 0.006, 4) * 14 + fbm(x * 0.03 + 5, z * 0.03, 3) * 2.5 + vnoise(x * 0.2, z * 0.2) * 0.12;
  // mountains to the north with a pass in the middle for the fortress
  const m = smooth(-140, -330, z);
  if (m > 0) {
    const ridge = 1 - Math.abs(fbm(x * 0.008 + 11, z * 0.008, 5));
    let mh = m * (70 + ridge * 120 + fbm(x * 0.02, z * 0.02, 4) * 25);
    const pass = Math.exp(-(x * x) / (2 * 55 * 55));
    mh *= 1 - pass * 0.72;
    h += mh;
  }
  // battlefield plains to the east: flatter, cratered
  const b = smooth(BATTLE_X - 30, BATTLE_X + 40, x);
  if (b > 0) {
    h = lerp(h, 5 + fbm(x * 0.01, z * 0.01, 3) * 4, b * 0.75);
    const cx = Math.floor(x / 18), cz = Math.floor(z / 18);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const r = hash2(cx + i, cz + j);
      if (r < 0.35) {
        const ox = (cx + i + hash2(cx + i + 7, cz + j)) * 18, oz = (cz + j + hash2(cx + i, cz + j + 7)) * 18, rr = 2.5 + r * 8;
        const d = Math.hypot(x - ox, z - oz);
        if (d < rr) h -= b * (1 - (d / rr) ** 2) * (0.8 + r * 2);
      }
    }
  }
  // the castle hill: steep sides, flat top
  const cd = Math.hypot(x - CASTLE.x, z - CASTLE.z);
  if (cd < 90) {
    const top = CASTLE.top + 2;
    if (cd < CASTLE.r) h = top + vnoise(x * 0.3, z * 0.3) * 0.08;
    else h = lerp(top, h, Math.pow(smooth(CASTLE.r, 88, cd), 0.7));
  }
  return h;
}
const fortressLevel = (() => { let s = 0; for (let i = 0; i < 8; i++) s += rawHeight(FORTRESS.x + Math.cos(i) * 20, FORTRESS.z + Math.sin(i) * 20); return s / 8; })();
const villageLevel = rawHeight(VILLAGE.x, VILLAGE.z);
function heightFn(x, z) {
  let h = rawHeight(x, z);
  // fortress yard and village are leveled
  const fd = Math.hypot(x - FORTRESS.x, z - FORTRESS.z);
  if (fd < FORTRESS.r + 30) h = lerp(fortressLevel, h, smooth(FORTRESS.r, FORTRESS.r + 30, fd));
  const vd = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  if (vd < VILLAGE.r + 25) h = lerp(villageLevel, h, smooth(VILLAGE.r - 10, VILLAGE.r + 25, vd));
  // roads: worn a little lower and smoother
  const pd = pathDist(x, z);
  if (pd < 4) h -= 0.12 * (1 - smooth(2, 4, pd));
  // the river valley and its bed
  const rd = riverDist(x, z);
  if (rd < 80) {
    const bank = WATER_Y + 1.1 + rd * 0.055;
    h = lerp(h, Math.min(h, bank), 1 - smooth(9, 80, rd));
    if (rd < 11) h = lerp(h, WATER_Y - 2.2 * (1 - (rd / 11) ** 2) - 0.2, 1 - smooth(6, 11, rd));
  }
  return h;
}
const N1 = CELLS + 1;
const H = new Float32Array(N1 * N1);
for (let iz = 0; iz < N1; iz++) for (let ix = 0; ix < N1; ix++) H[iz * N1 + ix] = heightFn(-HALF + ix * SEG, -HALF + iz * SEG);
function terrainH(x, z) {
  const gx = (x + HALF) / SEG, gz = (z + HALF) / SEG;
  const ix = Math.min(CELLS - 1, Math.max(0, Math.floor(gx))), iz = Math.min(CELLS - 1, Math.max(0, Math.floor(gz)));
  const fx = Math.min(1, Math.max(0, gx - ix)), fz = Math.min(1, Math.max(0, gz - iz));
  const ha = H[iz * N1 + ix], hb = H[(iz + 1) * N1 + ix], hc = H[(iz + 1) * N1 + ix + 1], hd = H[iz * N1 + ix + 1];
  if (fx + fz <= 1) return ha + (hd - ha) * fx + (hb - ha) * fz;
  return hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}
function groundH(x, z) {
  const t = terrainH(x, z);
  if (onBridge(x, z)) {
    const l = bridgeLocal(x, z);
    const ramp = BRIDGE.deck - Math.max(0, Math.abs(l.v) - BRIDGE.len / 2 + 7) * 0.35;
    return Math.max(t, ramp);
  }
  return t;
}
function slopeAt(x, z) { const e = 1.5; return Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e); }

// colliders: circles (trunks, rocks, towers), segments (fences), oriented boxes (walls, houses)
const circles = [], segs = [], boxes = [];
function addBox(cx, cz, w, d, rot, h0 = -1e9, h1 = 1e9, tag) { boxes.push({ cx, cz, hw: w / 2, hd: d / 2, c: Math.cos(rot), s: Math.sin(rot), h0, h1, tag }); }
function inBox(b, x, z, pad = 0) {
  const dx = x - b.cx, dz = z - b.cz, u = dx * b.c - dz * b.s, v = dx * b.s + dz * b.c;
  return Math.abs(u) < b.hw + pad && Math.abs(v) < b.hd + pad;
}
function solidAt(x, z, pad = 0) { for (const b of boxes) if (inBox(b, x, z, pad)) return b; return null; }
// splat weights: which ground surface is where
function splatAt(x, z, h, slope) {
  const pd = pathDist(x, z), rd = riverDist(x, z);
  let rock = smooth(0.55, 0.95, slope);
  const snowLine = 52 + fbm(x * 0.02, z * 0.02, 3) * 10;
  let snow = smooth(snowLine - 6, snowLine + 6, h) * smooth(-120, -170, z) * (1 - smooth(0.9, 1.3, slope));
  rock *= 1 - snow * 0.7;
  const battle = smooth(BATTLE_X - 20, BATTLE_X + 30, x);
  let mud = Math.max(battle * (0.55 + fbm(x * 0.05, z * 0.05, 3) * 0.6), (1 - smooth(9, 13, rd)) * 0.9);
  let dirt = Math.max(1 - smooth(2.4, 4.2, pd), 0.6 * (1 - smooth(VILLAGE.r - 30, VILLAGE.r, Math.hypot(x - VILLAGE.x, z - VILLAGE.z))) * (0.4 + 0.6 * Math.max(0, fbm(x * 0.08, z * 0.08, 2))));
  dirt = Math.max(dirt, (1 - smooth(CASTLE.r - 4, CASTLE.r + 6, Math.hypot(x - CASTLE.x, z - CASTLE.z))) * 0.8, (1 - smooth(FORTRESS.r - 5, FORTRESS.r + 5, Math.hypot(x - FORTRESS.x, z - FORTRESS.z))) * 0.7);
  let cobble = Math.max(1 - smooth(SQUARE.r - 3, SQUARE.r, Math.hypot(x - SQUARE.x, z - SQUARE.z)), 1 - smooth(18, 22, Math.hypot(x - CASTLE.x, z - CASTLE.z)));
  if (onBridge(x, z)) cobble = 1;
  mud *= 1 - snow; dirt *= 1 - snow; mud *= 1 - cobble; dirt *= 1 - cobble;
  let grass = Math.max(0, 1 - rock - snow - mud - dirt - cobble);
  const s = grass + dirt + mud + rock + snow + cobble || 1;
  return { grass: grass / s, dirt: dirt / s, mud: mud / s, rock: rock / s, snow: snow / s, cobble: cobble / s };
}

// ---------- renderer, post-processing ----------
const QUALITY = { Max: { grass: 34, radius: 4, shadow: 4096, ratio: Math.min(devicePixelRatio, 2) }, High: { grass: 18, radius: 3, shadow: 2048, ratio: Math.min(devicePixelRatio, 1.5) }, Medium: { grass: 10, radius: 2, shadow: 2048, ratio: 1 } };
let qName = 'Max';
// ?lite: tiny test mode for screenshots on machines without a graphics card
const LITE = /lite/.test(location.search);
try { const s = localStorage.getItem('ironblood.quality2'); if (QUALITY[s]) qName = s; } catch (e) {}
let Q = QUALITY[qName];
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(LITE ? 0.5 : Q.ratio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !LITE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbcd3e6, 0.0028);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.08, 2500);
const pmrem = new THREE.PMREMGenerator(renderer);
// a soft outdoor reflection until the real sky is captured
const envTex = (() => {
  const es = new THREE.Scene();
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 d; void main(){ float h = d.y; vec3 sky = mix(vec3(0.78,0.84,0.9), vec3(0.32,0.5,0.8), clamp(h,0.0,1.0)); vec3 gnd = mix(vec3(0.35,0.38,0.25), vec3(0.16,0.2,0.1), clamp(-h*3.0,0.0,1.0)); gl_FragColor = vec4(h > 0.0 ? sky : gnd, 1.0); }' });
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m));
  return pmrem.fromScene(es, 0).texture;
})();
scene.environment = envTex;
const composerRT = new THREE.WebGLRenderTarget(innerWidth * Q.ratio, innerHeight * Q.ratio, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, composerRT);
composer.setPixelRatio(LITE ? 0.5 : Q.ratio);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- real textures (CC0, Poly Haven), loaded at start ----------
const texLoader = new THREE.TextureLoader();
const PH = (n, m) => `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${n}/${n}_${m}_1k.jpg`;
let texPending = 0, texDone = 0;
function tex(n, m, color = true) {
  texPending++;
  const t = texLoader.load(PH(n, m), () => { texDone++; }, undefined, () => { texDone++; console.warn('texture failed', n, m); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return t;
}
function pbr(n, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex(n, 'diff'), normalMap: tex(n, 'nor_gl', false), roughnessMap: tex(n, 'rough', false), roughness: 1, metalness: 0, ...opts });
  return m;
}
function setRepeat(m, rx, ry) { for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].needsUpdate = true; m[k].repeat.set(rx, ry); } return m; }

// ---------- terrain: six real surfaces blended by height, slope and place ----------
const LAYERS = ['forrest_ground_01', 'stony_dirt_path', 'brown_mud_02', 'cliff_side', 'snow_02', 'cobblestone_floor_04'];
const LAYER_TILE = [3.5, 4, 4.5, 9, 6, 2.6];
const LAYER_ROUGH = [0.95, 0.9, 0.32, 0.82, 0.5, 0.72];
const terrainUniforms = {
  tD: { value: LAYERS.map(n => tex(n, 'diff')) },
  tN: { value: LAYERS.map(n => tex(n, 'nor_gl', false)) },
  uTile: { value: LAYER_TILE.map(v => 1 / v) },
  uRough: { value: LAYER_ROUGH },
  uWet: { value: 0 },
};
const terrainMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, normalMap: terrainUniforms.tN.value[0] });
terrainMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, terrainUniforms);
  sh.vertexShader = 'attribute vec3 splatA; attribute vec3 splatB; varying vec3 vSA; varying vec3 vSB; varying vec2 vW;\n' + sh.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n vSA = splatA; vSB = splatB; vW = (modelMatrix * vec4(position,1.0)).xz;');
  sh.fragmentShader = 'uniform sampler2D tD[6]; uniform sampler2D tN[6]; uniform float uTile[6]; uniform float uRough[6]; uniform float uWet; varying vec3 vSA; varying vec3 vSB; varying vec2 vW;\n'
    + `vec4 tri(sampler2D t, vec2 uv){ return texture2D(t, uv) * 0.65 + texture2D(t, uv * 0.23 + 0.37) * 0.35; }\n` + sh.fragmentShader
    .replace('#include <map_fragment>', `
      float w0 = vSA.x, w1 = vSA.y, w2 = vSA.z, w3 = vSB.x, w4 = vSB.y, w5 = vSB.z;
      vec3 col = vec3(0.0); vec3 nrm = vec3(0.0); float rgh = 0.0;
      if (w0 > 0.01) { col += tri(tD[0], vW * uTile[0]).rgb * vec3(0.82, 1.0, 0.7) * w0; nrm += texture2D(tN[0], vW * uTile[0]).xyz * w0; rgh += uRough[0] * w0; }
      if (w1 > 0.01) { col += tri(tD[1], vW * uTile[1]).rgb * w1; nrm += texture2D(tN[1], vW * uTile[1]).xyz * w1; rgh += uRough[1] * w1; }
      if (w2 > 0.01) { col += tri(tD[2], vW * uTile[2]).rgb * w2; nrm += texture2D(tN[2], vW * uTile[2]).xyz * w2; rgh += uRough[2] * w2; }
      if (w3 > 0.01) { col += tri(tD[3], vW * uTile[3]).rgb * w3; nrm += texture2D(tN[3], vW * uTile[3]).xyz * w3; rgh += uRough[3] * w3; }
      if (w4 > 0.01) { col += tri(tD[4], vW * uTile[4]).rgb * w4; nrm += texture2D(tN[4], vW * uTile[4]).xyz * w4; rgh += uRough[4] * w4; }
      if (w5 > 0.01) { col += tri(tD[5], vW * uTile[5]).rgb * w5; nrm += texture2D(tN[5], vW * uTile[5]).xyz * w5; rgh += uRough[5] * w5; }
      float ws = max(0.001, w0 + w1 + w2 + w3 + w4 + w5);
      diffuseColor.rgb *= col / ws;
      vec3 blendN = nrm / ws;
      float blendR = mix(rgh / ws, 0.18, uWet * (1.0 - w4));
      diffuseColor.rgb *= 1.0 - uWet * 0.25 * (1.0 - w4);`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = blendR;')
    .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec3 mapN = blendN * 2.0 - 1.0;');
};
terrainMat.customProgramCacheKey = () => 'terrain6';
const terrainChunks = [];
{
  const CH = 8, per = CELLS / CH;
  const nrmAt = (ix, iz) => {
    const l = H[iz * N1 + Math.max(0, ix - 1)], r = H[iz * N1 + Math.min(CELLS, ix + 1)], d = H[Math.max(0, iz - 1) * N1 + ix], u = H[Math.min(CELLS, iz + 1) * N1 + ix];
    return new THREE.Vector3(l - r, 2 * SEG, d - u).normalize();
  };
  for (let cz = 0; cz < CH; cz++) for (let cx = 0; cx < CH; cx++) {
    const W = per + 1, pos = new Float32Array(W * W * 3), nor = new Float32Array(W * W * 3), uv = new Float32Array(W * W * 2), sa = new Float32Array(W * W * 3), sb = new Float32Array(W * W * 3);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const ix = cx * per + i, iz = cz * per + j, k = j * W + i;
      const x = -HALF + ix * SEG, z = -HALF + iz * SEG, h = H[iz * N1 + ix];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const n = nrmAt(ix, iz); nor[k * 3] = n.x; nor[k * 3 + 1] = n.y; nor[k * 3 + 2] = n.z;
      uv[k * 2] = x / 4; uv[k * 2 + 1] = z / 4;
      const sp = splatAt(x, z, h, Math.sqrt(1 - n.y * n.y) / Math.max(0.05, n.y));
      sa[k * 3] = sp.grass; sa[k * 3 + 1] = sp.dirt; sa[k * 3 + 2] = sp.mud;
      sb[k * 3] = sp.rock; sb[k * 3 + 1] = sp.snow; sb[k * 3 + 2] = sp.cobble;
    }
    const idx = [];
    for (let j = 0; j < per; j++) for (let i = 0; i < per; i++) { const a = j * W + i, b = (j + 1) * W + i, c = b + 1, d = a + 1; idx.push(a, b, d, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('splatA', new THREE.BufferAttribute(sa, 3)); g.setAttribute('splatB', new THREE.BufferAttribute(sb, 3));
    g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, terrainMat); m.receiveShadow = true; m.matrixAutoUpdate = false;
    scene.add(m); terrainChunks.push(m);
  }
}

// ---------- the river: real reflections and moving ripples ----------
const waterNormals = texLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/textures/waternormals.jpg', (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
const river = (() => {
  // a ribbon along the river line, built flat in XY and laid down
  const pts = [], L = RIVER;
  for (let i = 0; i < L.length - 1; i++) for (let t = 0; t < 1; t += 0.05) pts.push([lerp(L[i][0], L[i + 1][0], t), lerp(L[i][1], L[i + 1][1], t)]);
  pts.push(L[L.length - 1]);
  const pos = [], idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, w = 11.5;
    pos.push(pts[i][0] + nx * w, -(pts[i][1] + nz * w), 0, pts[i][0] - nx * w, -(pts[i][1] - nz * w), 0);
    if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const w = new Water(g, { textureWidth: LITE ? 128 : 1024, textureHeight: LITE ? 128 : 1024, waterNormals, sunDirection: new THREE.Vector3(0.5, 0.7, 0.3), sunColor: 0xfff2dd, waterColor: 0x1d3b3a, distortionScale: 2.4, fog: true, alpha: 1 });
  w.rotation.x = -Math.PI / 2; w.position.y = WATER_Y;
  w.material.uniforms.size.value = 3.5;
  scene.add(w);
  return w;
})();

// ---------- sky: physically based, also lights and reflects on everything ----------
const sky = new Sky(); sky.scale.setScalar(4000); scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 4.5; skyU.rayleigh.value = 1.4; skyU.mieCoefficient.value = 0.004; skyU.mieDirectionalG.value = 0.82;
const envSky = new Sky(); envSky.scale.setScalar(100);
const envScene = new THREE.Scene(); envScene.add(envSky);
let envRT = null, envSunY = -9, hdrEnv = null;
function captureSkyEnv(sunDirV, force) {
  if (!force && Math.abs(sunDirV.y - envSunY) < 0.03) return;
  envSunY = sunDirV.y;
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) envSky.material.uniforms[k].value = skyU[k].value;
  envSky.material.uniforms.sunPosition.value.copy(sunDirV);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = (sunDirV.y > 0.12 && hdrEnv) ? hdrEnv : envRT.texture;
}
const starGeo = new THREE.BufferGeometry();
{
  const r = mulberry32(99), p = [];
  for (let i = 0; i < 2600; i++) { const u = r(), a = r() * Math.PI * 2, y = u, s = Math.sqrt(1 - y * y); p.push(Math.cos(a) * s * 1800, y * 1800, Math.sin(a) * s * 1800); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat); stars.frustumCulled = false; scene.add(stars);
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe8ecf4, fog: false }));
scene.add(moonMesh);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xc4dbff, 0x4a4230, 0.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow, Q.shadow);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 400 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
scene.add(moon, moon.target);

// ---------- grass: dense blades streamed around you, only where the ground is grassy ----------
const bladeGeo = (() => {
  const segsN = 4, pos = [], col = [], idx = [];
  for (let i = 0; i <= segsN; i++) {
    const y = i / segsN, w = 0.032 * (1 - y * 0.85), bend = y * y * 0.14, shade = 0.3 + 0.7 * y;
    if (i < segsN) { pos.push(-w, y, bend, w, y, bend); col.push(shade, shade, shade, shade, shade, shade); }
    else { pos.push(0, y, bend); col.push(1, 1, 1); }
  }
  for (let i = 0; i < segsN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const t = (segsN - 1) * 2; idx.push(t, t + 1, t + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
})();
const grassUniforms = { uTime: { value: 0 }, uPlayer: { value: new THREE.Vector3() }, uFade: { value: 30 } };
const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
grassMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, grassUniforms);
  sh.vertexShader = 'uniform float uTime; uniform vec3 uPlayer; uniform float uFade;\n' + sh.vertexShader.replace('#include <project_vertex>', `
    vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
    float d = distance(ip.xz, uPlayer.xz);
    transformed.y *= 1.0 - smoothstep(uFade * 0.75, uFade, d);
    vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
    float hh = position.y * position.y;
    float gust = sin(uTime * 0.6 + ip.x * 0.05 + ip.z * 0.03) * 0.5 + 0.5;
    float w = sin(uTime * 1.9 + ip.x * 0.4 + ip.z * 0.3) * 0.6 + sin(uTime * 3.3 + ip.x * 1.7 + ip.z) * 0.2;
    mvPosition.x += (w * 0.07 + gust * 0.1) * hh;
    mvPosition.z += (w * 0.04 + gust * 0.05) * hh;
    vec2 aw = ip.xz - uPlayer.xz; float ad = length(aw);
    if (ad < 0.9 && ad > 0.001) { vec2 push = aw / ad * (0.9 - ad) * 0.5 * hh; mvPosition.xz += push; mvPosition.y -= (0.9 - ad) * 0.25 * hh; }
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
};
const CHUNK = 12;
const chunks = new Map();
function grassWeight(x, z) {
  if (onBridge(x, z) || solidAt(x, z, 0.3) || riverDist(x, z) < 10.5) return 0;
  const h = terrainH(x, z);
  const sp = splatAt(x, z, h, slopeAt(x, z));
  return sp.grass + sp.mud * 0.15;
}
function buildChunk(cx, cz) {
  const r = mulberry32((cx * 73856093) ^ (cz * 19349663));
  const count = Math.round(CHUNK * CHUNK * Q.grass);
  const mesh = new THREE.InstancedMesh(bladeGeo, grassMat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const g1 = new THREE.Color(0x46612a), g2 = new THREE.Color(0x6f8a3a), dry = new THREE.Color(0x9a9256);
  let n = 0;
  // sample the surface on a coarse grid so placement stays fast
  const W = {}; const wAt = (x, z) => { const k = Math.round(x) + ',' + Math.round(z); return W[k] ?? (W[k] = grassWeight(Math.round(x), Math.round(z))); };
  for (let i = 0; i < count; i++) {
    const x = cx * CHUNK + r() * CHUNK, z = cz * CHUNK + r() * CHUNK;
    if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2) continue;
    const gw = wAt(x, z);
    if (r() > gw) continue;
    const pd = pathDist(x, z);
    const tall = (0.55 + 0.45 * (vnoise(x * 0.09, z * 0.09) * 0.5 + 0.5)) * (pd < 3.5 ? 0.5 : 1);
    q.setFromAxisAngle(up, r() * 6.28);
    const hgt = (0.32 + r() * 0.4) * tall;
    m4.compose(v.set(x, terrainH(x, z) - 0.02, z), q, s.set(1, hgt, 1));
    mesh.setMatrixAt(n, m4);
    c.copy(g1).lerp(g2, r()).lerp(dry, Math.max(0, vnoise(x * 0.02 + 40, z * 0.02)) * 0.45 + r() * 0.08);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.frustumCulled = false; mesh.matrixAutoUpdate = false;
  return mesh;
}
let lastChunkKey = '';
function updateGrass(px, pz, force) {
  const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK), key = ccx + ',' + ccz;
  if (key === lastChunkKey && !force) return;
  lastChunkKey = key;
  const R = Q.radius, want = new Set();
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
    const k = (ccx + dx) + ',' + (ccz + dz);
    want.add(k);
    if (!chunks.has(k)) { const m = buildChunk(ccx + dx, ccz + dz); chunks.set(k, m); scene.add(m); }
  }
  for (const [k, m] of chunks) if (!want.has(k)) { scene.remove(m); m.dispose(); chunks.delete(k); }
  grassUniforms.uFade.value = (R + 0.5) * CHUNK;
}
function clearGrass() { for (const [, m] of chunks) { scene.remove(m); m.dispose(); } chunks.clear(); lastChunkKey = ''; }
