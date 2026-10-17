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
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- world layout ----------
const HALF = 150, CELLS = 200, SEG = (HALF * 2) / CELLS;
const POND = { x: 30, z: -24, r: 11 };
const BARN = { x: -34, z: 38, w: 11, d: 15 };
const PATH = [[-70, -130], [-26, -64], [-6, -22], [3, 8], [-10, 28], [-27, 38]];

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  const cx = ax + dx * t, cz = az + dz * t;
  return Math.hypot(px - cx, pz - cz);
}
function pathDist(x, z) {
  let d = 1e9;
  for (let i = 0; i < PATH.length - 1; i++) d = Math.min(d, distToSeg(x, z, PATH[i][0], PATH[i][1], PATH[i + 1][0], PATH[i + 1][1]));
  return d;
}
function barnDist(x, z) {
  const dx = Math.max(Math.abs(x - BARN.x) - BARN.w / 2, 0);
  const dz = Math.max(Math.abs(z - BARN.z) - BARN.d / 2, 0);
  return Math.hypot(dx, dz);
}
function hills(x, z) {
  return vnoise(x * 0.011, z * 0.011) * 8 + vnoise(x * 0.035 + 7, z * 0.035) * 2 + vnoise(x * 0.13, z * 0.13 + 3) * 0.22;
}
const pondLevel = hills(POND.x, POND.z);
const barnLevel = hills(BARN.x, BARN.z);
const WATER_Y = pondLevel - 0.12;

function heightFn(x, z) {
  let h = hills(x, z);
  // pond bowl
  const pr = Math.hypot(x - POND.x, z - POND.z);
  if (pr < POND.r + 8) {
    const k = 1 - smooth(POND.r, POND.r + 8, pr);
    let bowl = pondLevel;
    if (pr < POND.r) bowl = pondLevel - 0.1 - 1.0 * (1 - (pr / POND.r) ** 2);
    h = lerp(h, bowl, k);
  }
  // flat yard around the barn
  const bd = barnDist(x, z);
  if (bd < 9) h = lerp(h, barnLevel, 1 - smooth(2, 9, bd));
  // worn path
  const pd = pathDist(x, z);
  if (pd < 2) h -= 0.05 * (1 - smooth(1, 2, pd));
  return h;
}

// height grid, sampled exactly like the rendered triangles
const N1 = CELLS + 1;
const H = new Float32Array(N1 * N1);
for (let iz = 0; iz < N1; iz++) for (let ix = 0; ix < N1; ix++) H[iz * N1 + ix] = heightFn(-HALF + ix * SEG, -HALF + iz * SEG);
function groundH(x, z) {
  const gx = (x + HALF) / SEG, gz = (z + HALF) / SEG;
  const ix = Math.min(CELLS - 1, Math.max(0, Math.floor(gx))), iz = Math.min(CELLS - 1, Math.max(0, Math.floor(gz)));
  const fx = Math.min(1, Math.max(0, gx - ix)), fz = Math.min(1, Math.max(0, gz - iz));
  const ha = H[iz * N1 + ix], hb = H[(iz + 1) * N1 + ix], hc = H[(iz + 1) * N1 + ix + 1], hd = H[iz * N1 + ix + 1];
  if (fx + fz <= 1) return ha + (hd - ha) * fx + (hb - ha) * fz;
  return hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}
function blocked(x, z, pad) {
  return pathDist(x, z) < 1.4 + pad || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.4 + pad || barnDist(x, z) < 0.6 + pad;
}

// ---------- renderer / scene ----------
const QUALITY = {
  Low:    { grass: 7,  radius: 2, shadow: 1024, ratio: 1 },
  Medium: { grass: 14, radius: 3, shadow: 2048, ratio: Math.min(devicePixelRatio, 1.5) },
  High:   { grass: 24, radius: 3, shadow: 2048, ratio: Math.min(devicePixelRatio, 2) },
};
let qName = 'Medium';
try { const s = localStorage.getItem('ironblood.quality'); if (QUALITY[s]) qName = s; } catch (e) {}
let Q = QUALITY[qName];

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.ratio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
// reflections for metal armor and blades
const pmrem = new THREE.PMREMGenerator(renderer);
// an outdoor reflection: bright sky above, hazy horizon, grass and dirt below, a hot sun spot
const envTex = (() => {
  const es = new THREE.Scene();
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 d; void main(){ float h = d.y;
      vec3 sky = mix(vec3(0.78,0.84,0.9), vec3(0.32,0.5,0.8), clamp(h,0.0,1.0));
      vec3 gnd = mix(vec3(0.35,0.38,0.25), vec3(0.16,0.2,0.1), clamp(-h*3.0,0.0,1.0));
      vec3 c = h > 0.0 ? sky : gnd;
      c += vec3(6.0,5.5,4.8) * pow(max(dot(d, normalize(vec3(0.5,0.75,0.35))),0.0), 160.0);
      gl_FragColor = vec4(c, 1.0); }` });
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m));
  return pmrem.fromScene(es, 0).texture;
})();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbcd3e6, 55, 240);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);

// ---------- sky ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: {
    top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, sunVis: { value: 1 },
    moonDir: { value: new THREE.Vector3() }, moonVis: { value: 0 },
  },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
  fragmentShader: `
    uniform vec3 top, horizon, sunDir, sunCol, moonDir; uniform float sunVis, moonVis; varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55));
      col = mix(col, horizon * 0.75, smoothstep(0.0, -0.25, h));
      float s = max(dot(d, sunDir), 0.0);
      col += sunCol * (pow(s, 1400.0) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08) * sunVis;
      float m = max(dot(d, moonDir), 0.0);
      col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, m) * 1.2 + pow(m, 60.0) * 0.08) * moonVis;
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
sky.renderOrder = -10;
scene.add(sky);

const starGeo = new THREE.BufferGeometry();
{
  const r = mulberry32(99), p = [];
  for (let i = 0; i < 1800; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, y = Math.abs(u);
    const s = Math.sqrt(1 - y * y);
    p.push(Math.cos(a) * s * 900, y * 900, Math.sin(a) * s * 900);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ---------- lights ----------
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x4a5a2a, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadow, Q.shadow);
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
scene.add(moon, moon.target);

// ---------- textures ----------
function noiseTexture(size, base, spread, seed) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), r = mulberry32(seed);
  for (let i = 0; i < size * size; i++) {
    const v = base + (r() - 0.5) * spread;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- terrain ----------
{
  const pos = new Float32Array(N1 * N1 * 3), col = new Float32Array(N1 * N1 * 3), uv = new Float32Array(N1 * N1 * 2);
  const grassA = new THREE.Color(0x3f6b22), grassB = new THREE.Color(0x5f8a2e), dry = new THREE.Color(0x8a8a3c);
  const dirt = new THREE.Color(0x7a5f3e), mud = new THREE.Color(0x4a3d2a), sand = new THREE.Color(0x8f7b55);
  const c = new THREE.Color();
  for (let iz = 0; iz < N1; iz++) for (let ix = 0; ix < N1; ix++) {
    const i = iz * N1 + ix, x = -HALF + ix * SEG, z = -HALF + iz * SEG;
    pos[i * 3] = x; pos[i * 3 + 1] = H[i]; pos[i * 3 + 2] = z;
    uv[i * 2] = x / 6; uv[i * 2 + 1] = z / 6;
    c.copy(grassA).lerp(grassB, vnoise(x * 0.08, z * 0.08) * 0.5 + 0.5);
    c.lerp(dry, Math.max(0, vnoise(x * 0.02 + 40, z * 0.02)) * 0.45);
    const pd = pathDist(x, z);
    c.lerp(dirt, 1 - smooth(1.1, 2.0, pd));
    const pr = Math.hypot(x - POND.x, z - POND.z);
    c.lerp(sand, (1 - smooth(POND.r - 0.5, POND.r + 2, pr)) * 0.8);
    c.lerp(mud, 1 - smooth(POND.r - 3, POND.r - 0.5, pr));
    c.lerp(dirt, (1 - smooth(1, 4, barnDist(x, z))) * 0.75);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const idx = [];
  for (let iz = 0; iz < CELLS; iz++) for (let ix = 0; ix < CELLS; ix++) {
    const a = iz * N1 + ix, b = (iz + 1) * N1 + ix, cc = (iz + 1) * N1 + ix + 1, d = iz * N1 + ix + 1;
    idx.push(a, b, d, b, cc, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: noiseTexture(128, 225, 60, 5) }));
  terrain.receiveShadow = true;
  scene.add(terrain);
}

// ---------- pond ----------
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f5866, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82 });
const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 0.6, 64), waterMat);
water.rotation.x = -Math.PI / 2;
water.position.set(POND.x, WATER_Y, POND.z);
water.receiveShadow = true;
scene.add(water);
{
  // lily pads
  const r = mulberry32(12), pads = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = POND.r * (0.35 + r() * 0.55);
    const g = new THREE.CircleGeometry(0.25 + r() * 0.25, 10, 0.4, Math.PI * 2 - 0.4);
    g.rotateX(-Math.PI / 2); g.rotateY(r() * 6.28);
    g.translate(POND.x + Math.cos(a) * d, WATER_Y + 0.015, POND.z + Math.sin(a) * d);
    pads.push(g);
  }
  scene.add(new THREE.Mesh(mergeGeometries(pads), new THREE.MeshLambertMaterial({ color: 0x3f7a2a, side: THREE.DoubleSide })));
  // cattails / reeds around the edge
  const stems = [], heads = [];
  for (let i = 0; i < 140; i++) {
    const a = r() * Math.PI * 2, d = POND.r * (0.88 + r() * 0.22);
    const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d, y = groundH(x, z);
    const hgt = 1.1 + r() * 0.9;
    const s = new THREE.CylinderGeometry(0.012, 0.02, hgt, 4); s.translate(x, y + hgt / 2, z); s.rotateY(0); stems.push(s);
    if (r() < 0.55) { const h = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6); h.translate(x, y + hgt - 0.12, z); heads.push(h); }
  }
  scene.add(new THREE.Mesh(mergeGeometries(stems), new THREE.MeshLambertMaterial({ color: 0x5c7a34 })));
  scene.add(new THREE.Mesh(mergeGeometries(heads), new THREE.MeshLambertMaterial({ color: 0x5a3a20 })));
}

// ---------- colliders ----------
const circles = [];  // {x, z, r}
const segs = [];     // {ax, az, bx, bz}

// ---------- barn ----------
function plankTexture(color, trim) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = mulberry32(31);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 16) {
    g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`; g.fillRect(x, 0, 16, 256);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 2, 256);
    for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(x + 3 + r() * 10, r() * 256, 1, 20 + r() * 50); }
  }
  if (trim) { g.strokeStyle = trim; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246); g.beginPath(); g.moveTo(5, 5); g.lineTo(251, 251); g.moveTo(251, 5); g.lineTo(5, 251); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
{
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-BARN.w / 2, 0); shape.lineTo(BARN.w / 2, 0); shape.lineTo(BARN.w / 2, 5); shape.lineTo(0, 8.2); shape.lineTo(-BARN.w / 2, 5); shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: BARN.d, bevelEnabled: false });
  body.translate(0, 0, -BARN.d / 2);
  // extrude UVs are in meters, so one plank tile = 4 m
  const wallTex = plankTexture('#8e2a22');
  wallTex.repeat.set(0.25, 0.25);
  const bodyMesh = new THREE.Mesh(body, new THREE.MeshLambertMaterial({ map: wallTex }));
  bodyMesh.castShadow = bodyMesh.receiveShadow = true;
  g.add(bodyMesh);
  // roof
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3b3f44, map: noiseTexture(64, 200, 50, 8) });
  const slope = Math.hypot(BARN.w / 2, 3.2) + 0.8;
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.18, BARN.d + 1.2), roofMat);
    r.rotation.z = -side * Math.atan2(3.2, BARN.w / 2);
    r.position.set(side * (BARN.w / 4 + 0.2), 6.6 + 0.12, 0);
    r.castShadow = r.receiveShadow = true;
    g.add(r);
  }
  // big doors on the east wall, small hay door up top
  const doorTex = plankTexture('#8e2a22', '#efe8da');
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshLambertMaterial({ map: doorTex }));
  door.rotation.y = Math.PI / 2; door.position.set(BARN.w / 2 + 0.02, 2.1, 0); g.add(door);
  const hay = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.6), new THREE.MeshLambertMaterial({ map: doorTex }));
  hay.position.set(0, 6.0, BARN.d / 2 + 0.02); g.add(hay);
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xefe8da });
  for (const [w, h, x, y, z] of [[0.15, 5, BARN.w / 2 + 0.03, 2.5, -BARN.d / 2 + 0.08], [0.15, 5, BARN.w / 2 + 0.03, 2.5, BARN.d / 2 - 0.08]]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), trimMat); t.position.set(x, y, z); g.add(t);
  }
  g.position.set(BARN.x, barnLevel - 0.05, BARN.z);
  scene.add(g);
  const x0 = BARN.x - BARN.w / 2, x1 = BARN.x + BARN.w / 2, z0 = BARN.z - BARN.d / 2, z1 = BARN.z + BARN.d / 2;
  segs.push({ ax: x0, az: z0, bx: x1, bz: z0 }, { ax: x1, az: z0, bx: x1, bz: z1 }, { ax: x1, az: z1, bx: x0, bz: z1 }, { ax: x0, az: z1, bx: x0, bz: z0 });
  // hay bales by the door
  const baleMat = new THREE.MeshLambertMaterial({ color: 0xc9a85a, map: noiseTexture(64, 210, 90, 21) });
  for (const [dx, dz, ry] of [[7.5, -4.5, 0.2], [7.6, -2.9, -0.1], [7.4, -3.7, 0.05]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.9), baleMat);
    const x = BARN.x + dx, z = BARN.z + dz;
    b.position.set(x, groundH(x, z) + 0.3 + (dx === 7.4 ? 0.6 : 0), z); b.rotation.y = ry;
    b.castShadow = b.receiveShadow = true; scene.add(b);
    if (dx !== 7.4) circles.push({ x, z, r: 0.7 });
  }
}

// ---------- fence along the path ----------
{
  const fenceTex = plankTexture('#7a6a52'); fenceTex.repeat.set(1, 0.2);
  const mat = new THREE.MeshLambertMaterial({ map: fenceTex });
  const parts = [];
  const pts = PATH.slice(2);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len, off = 3;
    const sx = ax + nx * off, sz = az + nz * off, ex = bx + nx * off, ez = bz + nz * off;
    const flen = Math.hypot(ex - sx, ez - sz);
    // stop a little short of the barn so the yard stays open
    const end = i === pts.length - 2 ? flen - 6 : flen;
    const ang = Math.atan2(ez - sz, ex - sx);
    const steps = Math.max(1, Math.round(end / 2.4));
    let prev = null;
    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * (end / flen);
      const x = sx + (ex - sx) * t, z = sz + (ez - sz) * t, y = groundH(x, z);
      const p = new THREE.BoxGeometry(0.14, 1.25, 0.14); p.rotateY(-ang); p.translate(x, y + 0.55, z); parts.push(p);
      if (prev) {
        for (const ry of [0.45, 0.95]) {
          const mx = (x + prev.x) / 2, mz = (z + prev.z) / 2, my = (y + prev.y) / 2;
          const l = Math.hypot(x - prev.x, z - prev.z);
          const rail = new THREE.BoxGeometry(l, 0.09, 0.05);
          rail.rotateZ(Math.atan2(y - prev.y, l)); rail.rotateY(-ang); rail.translate(mx, my + ry, mz); parts.push(rail);
        }
      }
      prev = { x, y, z };
    }
    segs.push({ ax: sx, az: sz, bx: sx + (ex - sx) * (end / flen), bz: sz + (ez - sz) * (end / flen) });
  }
  const fence = new THREE.Mesh(mergeGeometries(parts), mat);
  fence.castShadow = fence.receiveShadow = true;
  scene.add(fence);
}

// ---------- trees ----------
function makeTree(seed) {
  const r = mulberry32(seed), parts = [];
  const trunkH = 3 + r() * 1.5;
  const bark = new THREE.Color(0x4a3a2a), leafA = new THREE.Color(0x2f5a1e), leafB = new THREE.Color(0x4c7a2a);
  const paint = (g, c, jitter) => {
    if (g.index) g = g.toNonIndexed();
    const n = g.attributes.position.count, arr = new Float32Array(n * 3), cc = new THREE.Color();
    for (let i = 0; i < n; i++) { cc.copy(c).offsetHSL(0, 0, (r() - 0.5) * jitter); arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const trunk = new THREE.CylinderGeometry(0.22, 0.38, trunkH, 7, 3); trunk.translate(0, trunkH / 2, 0);
  parts.push(paint(trunk, bark, 0.06));
  for (let b = 0; b < 3; b++) {
    const br = new THREE.CylinderGeometry(0.06, 0.12, 1.6, 5); br.translate(0, 0.8, 0);
    br.rotateZ(0.9 + r() * 0.4); br.rotateY(r() * 6.28); br.translate(0, trunkH * (0.6 + r() * 0.3), 0);
    parts.push(paint(br, bark, 0.06));
  }
  const blobs = 6 + Math.floor(r() * 4);
  for (let i = 0; i < blobs; i++) {
    const s = 1.2 + r() * 1.0;
    const g = new THREE.IcosahedronGeometry(s, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + (hash2(k, seed) - 0.5) * 0.25), p.getY(k) * 0.8, p.getZ(k) * (1 + (hash2(seed, k) - 0.5) * 0.25));
    const a = r() * 6.28, d = i === 0 ? 0 : 1 + r() * 1.3;
    g.translate(Math.cos(a) * d, trunkH + 0.6 + r() * 1.6, Math.sin(a) * d);
    g.computeVertexNormals();
    parts.push(paint(g, leafA.clone().lerp(leafB, r()), 0.07));
  }
  return mergeGeometries(parts);
}
{
  const variants = [makeTree(1), makeTree(2), makeTree(3), makeTree(4)];
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const r = mulberry32(77), spots = [[], [], [], []];
  let tries = 0;
  while (spots.flat().length < 110 && tries++ < 5000) {
    const a = r() * Math.PI * 2, d = 14 + Math.sqrt(r()) * 125;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z, 3.5)) continue;
    if (spots.flat().some(s => Math.hypot(s.x - x, s.z - z) < 6)) continue;
    spots[Math.floor(r() * 4)].push({ x, z, s: 0.8 + r() * 0.5, ry: r() * 6.28 });
  }
  // a small grove near the start
  for (const [x, z] of [[14, 14], [19, 9], [16, 21]]) spots[0].push({ x, z, s: 1.1, ry: x });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  spots.forEach((list, vi) => {
    const mesh = new THREE.InstancedMesh(variants[vi], mat, list.length);
    list.forEach((s, i) => {
      q.setFromAxisAngle(up, s.ry);
      m4.compose(new THREE.Vector3(s.x, groundH(s.x, s.z) - 0.1, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
      mesh.setMatrixAt(i, m4);
      circles.push({ x: s.x, z: s.z, r: 0.38 * s.s });
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
  });
}

// ---------- rocks ----------
{
  const r = mulberry32(55), list = [];
  for (let tries = 0; list.length < 50 && tries < 3000; tries++) {
    const a = r() * 6.28, d = 8 + Math.sqrt(r()) * 130, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z, 1.5)) continue;
    list.push({ x, z, s: 0.3 + r() ** 2 * 1.4, ry: r() * 6.28 });
  }
  const g = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const n = 0.8 + hash2(Math.round(p.getX(k) * 50), Math.round(p.getZ(k) * 50 + p.getY(k) * 13)) * 0.35; p.setXYZ(k, p.getX(k) * n, p.getY(k) * n * 0.65, p.getZ(k) * n); }
  g.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: 0x84837c, map: noiseTexture(64, 200, 80, 3) }), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  list.forEach((s, i) => {
    q.setFromAxisAngle(up, s.ry);
    m4.compose(new THREE.Vector3(s.x, groundH(s.x, s.z) + s.s * 0.15, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
    mesh.setMatrixAt(i, m4);
    if (s.s > 0.45) circles.push({ x: s.x, z: s.z, r: s.s * 0.85 });
  });
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}

// ---------- wildflowers ----------
{
  const r = mulberry32(8), list = [];
  for (let tries = 0; list.length < 4500 && tries < 20000; tries++) {
    // flowers grow in patches
    const a = r() * 6.28, d = Math.sqrt(r()) * 120, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (vnoise(x * 0.06 + 11, z * 0.06) < 0.15 || blocked(x, z, 0.3)) continue;
    list.push({ x, z, s: 0.7 + r() * 0.6, c: Math.floor(r() * 4) });
  }
  const stem = new THREE.CylinderGeometry(0.006, 0.008, 0.32, 3); stem.translate(0, 0.16, 0);
  const head = new THREE.CircleGeometry(0.045, 6); head.rotateX(-Math.PI / 2); head.translate(0, 0.32, 0);
  const stems = new THREE.InstancedMesh(stem, new THREE.MeshLambertMaterial({ color: 0x4f7a2c }), list.length);
  const heads = new THREE.InstancedMesh(head, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), list.length);
  const cols = [new THREE.Color(0xf4f1e6), new THREE.Color(0xf2c94c), new THREE.Color(0x9b7fd1), new THREE.Color(0xd9534f)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((f, i) => {
    q.setFromEuler(e.set((r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3));
    m4.compose(new THREE.Vector3(f.x, groundH(f.x, f.z), f.z), q, new THREE.Vector3(f.s, f.s, f.s));
    stems.setMatrixAt(i, m4); heads.setMatrixAt(i, m4); heads.setColorAt(i, cols[f.c]);
  });
  scene.add(stems, heads);
}

// ---------- grass (chunks streamed around the player) ----------
const bladeGeo = (() => {
  const segsN = 4, pos = [], col = [], idx = [];
  for (let i = 0; i <= segsN; i++) {
    const y = i / segsN, w = 0.045 * (1 - y * 0.85), bend = y * y * 0.12, shade = 0.35 + 0.65 * y;
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
const grassMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
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
    // blades lean away from the player's legs
    vec2 aw = ip.xz - uPlayer.xz; float ad = length(aw);
    if (ad < 0.9 && ad > 0.001) { vec2 push = aw / ad * (0.9 - ad) * 0.5 * hh; mvPosition.xz += push; mvPosition.y -= (0.9 - ad) * 0.25 * hh; }
    mvPosition = modelViewMatrix * mvPosition;
    gl_Position = projectionMatrix * mvPosition;`);
  sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize(vNormal);');
};
const CHUNK = 12;
const chunks = new Map();
function buildChunk(cx, cz) {
  const r = mulberry32((cx * 73856093) ^ (cz * 19349663));
  const count = Math.round(CHUNK * CHUNK * Q.grass);
  const mesh = new THREE.InstancedMesh(bladeGeo, grassMat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const g1 = new THREE.Color(0x4f7d27), g2 = new THREE.Color(0x7ea83c), dry = new THREE.Color(0xa7a457);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const x = cx * CHUNK + r() * CHUNK, z = cz * CHUNK + r() * CHUNK;
    if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2 || blocked(x, z, 0)) continue;
    const pd = pathDist(x, z);
    const tall = (0.55 + 0.45 * (vnoise(x * 0.09, z * 0.09) * 0.5 + 0.5)) * (pd < 2.4 ? 0.55 : 1);
    q.setFromAxisAngle(up, r() * 6.28);
    const hgt = (0.3 + r() * 0.35) * tall;
    m4.compose(v.set(x, groundH(x, z) - 0.02, z), q, s.set(1, hgt, 1));
    mesh.setMatrixAt(n, m4);
    c.copy(g1).lerp(g2, r()).lerp(dry, Math.max(0, vnoise(x * 0.02 + 40, z * 0.02)) * 0.5 + r() * 0.08);
    mesh.setColorAt(n, c);
    n++;
  }
  mesh.count = n;
  mesh.frustumCulled = false; // blades move in the shader; chunks are culled by distance instead
  mesh.matrixAutoUpdate = false;
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

// ---------- clouds ----------
const clouds = [];
{
  const r = mulberry32(400), mat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, emissive: 0x334455 });
  for (let i = 0; i < 14; i++) {
    const parts = [];
    for (let k = 0; k < 7; k++) {
      const g = new THREE.IcosahedronGeometry(5 + r() * 6, 1);
      g.scale(1, 0.55, 1); g.translate((r() - 0.5) * 22, r() * 3, (r() - 0.5) * 10); parts.push(g);
    }
    const c = new THREE.Mesh(mergeGeometries(parts), mat);
    const a = r() * 6.28, d = 80 + r() * 280;
    c.position.set(Math.cos(a) * d, 90 + r() * 40, Math.sin(a) * d);
    clouds.push(c); scene.add(c);
  }
}

// ---------- butterflies, birds, fireflies ----------
const butterflies = [];
{
  const r = mulberry32(600), cols = [0xf2a33a, 0xf4f1e6, 0x7fb3e6, 0xf2d34c];
  const wing = new THREE.CircleGeometry(0.07, 6); wing.translate(0.07, 0, 0); wing.rotateX(-Math.PI / 2);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.MeshLambertMaterial({ color: cols[i % 4], side: THREE.DoubleSide });
    const g = new THREE.Group(), L = new THREE.Mesh(wing, m), R = new THREE.Mesh(wing, m);
    R.scale.x = -1; g.add(L, R);
    const a = r() * 6.28, d = 5 + r() * 25;
    g.position.set(4 + Math.cos(a) * d, 0, 4 + Math.sin(a) * d);
    butterflies.push({ g, L, R, phase: r() * 10, tx: g.position.x, tz: g.position.z, h: 0.6 + r() * 1.2, r });
    scene.add(g);
  }
}
const birds = [];
{
  const mat = new THREE.MeshLambertMaterial({ color: 0x222222, side: THREE.DoubleSide });
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.15, 0, 0, 0.2, 0.75, 0, 0.05], 3));
  wing.computeVertexNormals();
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(), L = new THREE.Mesh(wing, mat), R = new THREE.Mesh(wing, mat);
    R.scale.x = -1;
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 5), mat); body.rotation.x = Math.PI / 2;
    g.add(L, R, body); g.scale.setScalar(1.6);
    birds.push({ g, L, R, flock: i < 5 ? 0 : 1, slot: i < 5 ? i : i - 5, phase: i * 0.7 });
    scene.add(g);
  }
}
const fireflyGeo = new THREE.BufferGeometry();
const FF = 70, ffBase = [];
{
  const r = mulberry32(700), p = new Float32Array(FF * 3);
  for (let i = 0; i < FF; i++) {
    const a = r() * 6.28, d = POND.r + 1 + r() * 18;
    const x = POND.x + Math.cos(a) * d, z = POND.z + Math.sin(a) * d;
    ffBase.push({ x, z, y: groundH(x, z) + 0.4 + r() * 1.2, ph: r() * 10 });
  }
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const ffMat = new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.12, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
const fireflies = new THREE.Points(fireflyGeo, ffMat);
fireflies.frustumCulled = false;
scene.add(fireflies);

