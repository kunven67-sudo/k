
// ---------- buildings, props, fire ----------
// where knights camp (the AI uses these too)
const CAMP_SPOTS = [
  { x: 212, z: 4 }, { x: 304, z: -58 }, { x: CASTLE.x + 4, z: CASTLE.z - 4 }, { x: -196, z: 118 }, { x: 0, z: -262 }, { x: 62, z: -92 }, { x: 118, z: 126 }, { x: 250, z: 120 },
];
// box with UVs in meters so textures keep their real size on every face
function boxW(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
function cylW(r1, r2, h, seg = 20, tile = 2, open = false) {
  const g = new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * Math.max(r1, r2)) / tile, uv.getY(i) * h / tile);
  return g;
}
class Builder {
  constructor() { this.parts = new Map(); }
  add(mat, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, frame) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
    if (frame) m.premultiply(frame);
    g.applyMatrix4(m);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return g;
  }
  finish(shadow = true) {
    const out = [];
    for (const [mat, list] of this.parts) {
      for (const g of list) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      const m = new THREE.Mesh(mergeGeometries(list), mat);
      m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false;
      scene.add(m); out.push(m);
    }
    this.parts.clear();
    return out;
  }
}
const frameAt = (x, y, z, ry) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);

// materials (real textures)
const MAT = {};
function makeMaterials() {
  MAT.stone = pbr('castle_brick_07');
  MAT.slate = pbr('castle_wall_slates');
  MAT.plaster = pbr('clay_plaster', { color: 0xe9e1d0 });
  MAT.wood = pbr('medieval_wood');
  MAT.darkWood = pbr('medieval_wood', { color: 0x5a4636 });
  MAT.char = pbr('medieval_wood', { color: 0x1c1612 });
  MAT.burntStone = pbr('castle_brick_07', { color: 0x4a4440 });
  MAT.thatch = pbr('thatch_roof_angled');
  MAT.roofSlate = pbr('castle_wall_slates', { color: 0x5a5e66 });
  MAT.iron = new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.9, roughness: 0.45 });
  MAT.snowCap = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, roughness: 0.55 });
  MAT.window = new THREE.MeshStandardMaterial({ color: 0x0e0a06, emissive: 0xffa040, emissiveIntensity: 0, roughness: 0.3 });
  MAT.coal = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff4a10, emissiveIntensity: 2.5, roughness: 1 });
  MAT.puddle = new THREE.MeshStandardMaterial({ color: 0x1c1a16, roughness: 0.03, metalness: 0.0, envMapIntensity: 1.4, polygonOffset: true, polygonOffsetFactor: -3 });
  MAT.waterDark = new THREE.MeshStandardMaterial({ color: 0x0b1416, roughness: 0.05 });
}
// waving cloth for flags, banners, canopies, tents
const clothUniforms = { uTime: { value: 0 } };
function clothMatColor(color, wave = 1) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide, map: clothTex });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = clothUniforms.uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float wv = uv.x * ${wave.toFixed(2)};
      transformed.z += sin(uTime * 3.0 + uv.x * 6.0 + position.y * 2.0) * 0.12 * wv + sin(uTime * 5.3 + uv.x * 11.0) * 0.04 * wv;`);
  };
  m.customProgramCacheKey = () => 'cloth' + wave;
  return m;
}
const windowsLit = [];

// ---------- fire: flames, light pool, sound ----------
const fires = [];
const flameTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 92, 2, 32, 80, 60);
  gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,190,70,0.9)'); gr.addColorStop(0.55, 'rgba(240,90,20,0.55)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(60, 50, 64, 120, 32, 124); g.bezierCurveTo(0, 120, 4, 50, 32, 4); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const flameMat = new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: true });
function addFire(x, y, z, size = 1) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  const sprites = [];
  for (let i = 0; i < (size > 0.6 ? 5 : 3); i++) {
    const s = new THREE.Sprite(flameMat); s.position.set((Math.random() - 0.5) * 0.25 * size, 0.3 * size, (Math.random() - 0.5) * 0.25 * size);
    s.scale.set(0.6 * size, 1.1 * size, 1); g.add(s); sprites.push({ s, ph: Math.random() * 10 });
  }
  scene.add(g);
  const e = { g, sprites, size, pos: new THREE.Vector3(x, y + 0.5 * size, z) };
  fires.push(e);
  return e;
}
function removeFire(e) { scene.remove(e.g); const i = fires.indexOf(e); if (i >= 0) fires.splice(i, 1); for (const l of firePool) if (l.userData.fire === e) { l.userData.fire = null; l.intensity = 0; } }
const firePool = [];
for (let i = 0; i < 8; i++) { const l = new THREE.PointLight(0xff8a3a, 0, 18, 2); scene.add(l); firePool.push(l); }
let fireAssign = 0;
function updateFires(dt, t, night) {
  for (const f of fires) {
    for (const sp of f.sprites) {
      const k = 0.8 + Math.sin(t * 11 + sp.ph) * 0.12 + Math.sin(t * 23 + sp.ph * 2) * 0.08;
      sp.s.scale.set(0.6 * f.size * (0.9 + Math.sin(t * 7 + sp.ph) * 0.1), 1.15 * f.size * k, 1);
      sp.s.position.y = 0.32 * f.size * k;
    }
  }
  fireAssign -= dt;
  if (fireAssign <= 0) {
    fireAssign = 0.3;
    const cp = camera.position;
    const near = fires.map(f => [f, f.pos.distanceToSquared(cp)]).filter(a => a[1] < 60 * 60).sort((a, b) => a[1] - b[1]).slice(0, firePool.length);
    firePool.forEach((l, i) => { l.userData.fire = near[i] ? near[i][0] : null; if (l.userData.fire) l.position.copy(l.userData.fire.pos); });
  }
  for (const l of firePool) {
    const f = l.userData.fire;
    l.intensity = f ? (f.size > 0.6 ? 26 : 10) * (0.85 + Math.sin(t * 13 + l.id) * 0.08 + Math.random() * 0.07) * (0.35 + 0.65 * night) : 0;
    l.distance = f ? (f.size > 0.6 ? 20 : 11) : 0;
  }
}
function torch(x, z, h = 2.4, onWallY) {
  const B = new Builder();
  const y = onWallY ?? terrainH(x, z);
  if (onWallY === undefined) { B.add(MAT.darkWood, cylW(0.07, 0.09, h, 8, 1), x, y + h / 2, z); circles.push({ x, z, r: 0.15 }); }
  B.add(MAT.iron, cylW(0.12, 0.07, 0.25, 8, 1, true), x, y + h + 0.05, z);
  B.finish(true);
  addFire(x, y + h + 0.15, z, 0.38);
}

// ---------- village ----------
function house(B, x, z, ry, w, d, floors, roof, opts = {}) {
  const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([a, b]) => terrainH(x + a * Math.cos(ry) + b * Math.sin(ry), z - a * Math.sin(ry) + b * Math.cos(ry)));
  const gMin = Math.min(...corners), gMax = Math.max(...corners);
  const base = gMin - 0.4, top0 = gMax + 0.5;
  const F = frameAt(x, 0, z, ry);
  const fh = 2.8, wallH = floors * fh;
  B.add(MAT.stone, boxW(w + 0.3, top0 - base, d + 0.3, 2), 0, (base + top0) / 2, 0, 0, 0, 0, F);
  const y0 = top0;
  B.add(MAT.plaster, boxW(w, fh, d, 2.5), 0, y0 + fh / 2, 0, 0, 0, 0, F);
  let uw = w, ud = d;
  if (floors > 1) { uw = w + 0.6; ud = d + 0.6; B.add(MAT.plaster, boxW(uw, fh * (floors - 1), ud, 2.5), 0, y0 + fh + fh * (floors - 1) / 2, 0, 0, 0, 0, F); }
  // timber frame: posts, beams and braces on every face
  const timber = (fw, fd, yb, hh) => {
    for (const [sx, sz, len, along] of [[0, fd / 2 + 0.03, fw, 'x'], [0, -fd / 2 - 0.03, fw, 'x'], [fw / 2 + 0.03, 0, fd, 'z'], [-fw / 2 - 0.03, 0, fd, 'z']]) {
      const n = Math.max(2, Math.round(len / 1.6));
      for (let i = 0; i <= n; i++) {
        const o = -len / 2 + (len * i) / n;
        B.add(MAT.darkWood, boxW(0.2, hh, 0.12, 1), along === 'x' ? o : sx, yb + hh / 2, along === 'x' ? sz : o, along === 'x' ? 0 : Math.PI / 2, 0, 0, F);
        if (i < n && (i + Math.floor(yb)) % 2 === 0) {
          const seg = len / n, diag = Math.hypot(seg, hh * 0.9), ang = Math.atan2(hh * 0.9, seg) * (i % 2 ? 1 : -1);
          B.add(MAT.darkWood, boxW(diag, 0.14, 0.1, 1), along === 'x' ? o + seg / 2 : sx, yb + hh / 2, along === 'x' ? sz : o + seg / 2, along === 'x' ? 0 : Math.PI / 2, 0, ang, F);
        }
      }
      for (const yy of [yb + 0.08, yb + hh - 0.08]) B.add(MAT.darkWood, boxW(len + 0.2, 0.18, 0.13, 1), along === 'x' ? 0 : sx, yy, along === 'x' ? sz : 0, along === 'x' ? 0 : Math.PI / 2, 0, 0, F);
    }
  };
  timber(w, d, y0, fh);
  if (floors > 1) timber(uw, ud, y0 + fh, fh * (floors - 1));
  // door + windows (they glow at night)
  B.add(MAT.darkWood, boxW(1.1, 2.0, 0.12, 1), opts.doorX || 0, y0 + 1.0, d / 2 + 0.08, 0, 0, 0, F);
  B.add(MAT.iron, boxW(0.08, 0.08, 0.06), (opts.doorX || 0) + 0.38, y0 + 1.0, d / 2 + 0.16, 0, 0, 0, F);
  const winY = [y0 + 1.5]; if (floors > 1) winY.push(y0 + fh + 1.4);
  for (const wy of winY) for (const wx of [-w / 3, w / 3]) {
    if (Math.abs(wx - (opts.doorX || 0)) < 1) continue;
    const zz = (wy > y0 + fh ? ud : d) / 2 + 0.07;
    B.add(MAT.window, boxW(0.7, 0.8, 0.06, 1), wx, wy, zz, 0, 0, 0, F);
    B.add(MAT.darkWood, boxW(0.9, 0.1, 0.14, 1), wx, wy - 0.45, zz, 0, 0, 0, F);
    B.add(MAT.darkWood, boxW(0.9, 0.1, 0.14, 1), wx, wy + 0.45, zz, 0, 0, 0, F);
    B.add(MAT.darkWood, boxW(0.08, 0.8, 0.1, 1), wx, wy, zz + 0.03, 0, 0, 0, F);
  }
  // gable roof along the long side
  const topY = y0 + wallH, span = Math.min(uw, ud), long = Math.max(uw, ud), alongX = uw >= ud;
  const pitch = 0.82, rise = Math.tan(pitch) * span / 2, slope = Math.hypot(span / 2, rise) + 0.6;
  for (const sgn of [-1, 1]) {
    const rmat = roof === 'thatch' ? MAT.thatch : MAT.roofSlate;
    const thick = roof === 'thatch' ? 0.35 : 0.14;
    const off = (span / 4 + 0.15) * sgn;
    if (alongX) B.add(rmat, boxW(long + 1.0, thick, slope, 2), 0, topY + rise / 2 + 0.1, off, 0, -pitch * sgn, 0, F);
    else B.add(rmat, boxW(slope, thick, long + 1.0, 2), off, topY + rise / 2 + 0.1, 0, 0, 0, pitch * sgn, F);
  }
  // plaster gable ends
  const tri = new THREE.Shape(); tri.moveTo(-span / 2, 0); tri.lineTo(span / 2, 0); tri.lineTo(0, rise); tri.closePath();
  const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false });
  const uvA = tg.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) / 2.5, uvA.getY(i) / 2.5);
  for (const sgn of [-1, 1]) {
    const g = tg.clone();
    if (alongX) B.add(MAT.plaster, g, sgn * (long / 2) - (sgn > 0 ? 0.2 : 0), topY, 0, Math.PI / 2, 0, 0, F);
    else B.add(MAT.plaster, g, 0, topY, sgn * (long / 2) - (sgn > 0 ? 0.2 : 0), 0, 0, 0, F);
  }
  if (!opts.noChimney) B.add(MAT.stone, boxW(0.8, rise + 1.6, 0.8, 1.5), alongX ? long / 2 - 1 : 0.6, topY + (rise + 1.6) / 2, alongX ? 0.6 : long / 2 - 1, 0, 0, 0, F);
  addBox(x, z, Math.max(w, uw) + 0.3, Math.max(d, ud) + 0.3, ry, base, topY + rise, 'house');
  return { y0, topY };
}
// every village building, so people know where their doors are
const VHOUSES = [], VSTALLS = [];
function doorSpot(x, z, ry, dz, dx = 0) { const p = new THREE.Vector3(dx, 0, dz).applyMatrix4(frameAt(x, 0, z, ry)); return { x: p.x, z: p.z }; }
function buildVillage() {
  const B = new Builder();
  const r = mulberry32(77);
  const sy = terrainH(SQUARE.x, SQUARE.z);
  // well in the middle of the square
  B.add(MAT.stone, cylW(1.3, 1.4, 0.9, 20, 1.5, true), SQUARE.x, sy + 0.45, SQUARE.z);
  B.add(MAT.stone, cylW(1.05, 1.05, 0.9, 20, 1.5, true), SQUARE.x, sy + 0.45, SQUARE.z);
  B.add(MAT.waterDark, new THREE.CircleGeometry(1.05, 20).rotateX(-Math.PI / 2), SQUARE.x, sy + 0.2, SQUARE.z);
  B.add(MAT.stone, new THREE.RingGeometry(1.05, 1.4, 20).rotateX(-Math.PI / 2), SQUARE.x, sy + 0.9, SQUARE.z);
  for (const s of [-1, 1]) B.add(MAT.darkWood, boxW(0.16, 2.4, 0.16, 1), SQUARE.x + s * 1.2, sy + 1.2, SQUARE.z);
  B.add(MAT.darkWood, cylW(0.06, 0.06, 2.6, 8, 1), SQUARE.x, sy + 2.0, SQUARE.z, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) B.add(MAT.thatch, boxW(3.0, 0.16, 1.4, 2), SQUARE.x, sy + 2.6, SQUARE.z + s * 0.55, 0, s * 0.6, 0);
  circles.push({ x: SQUARE.x, z: SQUARE.z, r: 1.45 });
  torchSpots.push(...[0, 1, 2, 3, 4, 5].map(i => [SQUARE.x + Math.cos(i * 1.047 + 0.3) * (SQUARE.r - 1), SQUARE.z + Math.sin(i * 1.047 + 0.3) * (SQUARE.r - 1)]));
  // market stalls with cloth roofs
  const clothCols = [0x7a1717, 0x1a2f6e, 0x8a6a1a];
  for (let i = 0; i < 3; i++) {
    const a = 2.1 + i * 0.55, x = SQUARE.x + Math.cos(a) * 9, z = SQUARE.z + Math.sin(a) * 9, ry = -a + Math.PI / 2, y = terrainH(x, z), F = frameAt(x, y, z, ry);
    for (const [px, pz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) B.add(MAT.darkWood, boxW(0.1, 2.3 + (pz < 0 ? 0.3 : 0), 0.1, 1), px, (2.3 + (pz < 0 ? 0.3 : 0)) / 2, pz, 0, 0, 0, F);
    B.add(MAT.wood, boxW(2.6, 0.08, 1.4, 1), 0, 0.95, 0.1, 0, 0, 0, F);
    const canopy = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.0, 8, 4), clothMatColor(clothCols[i], 0.25));
    canopy.position.set(x, y + 2.5, z); canopy.rotation.set(-Math.PI / 2 + 0.2, 0, 0, 'YXZ'); canopy.rotation.y = ry; canopy.castShadow = true; scene.add(canopy);
    for (let k = 0; k < 3; k++) B.add(MAT.wood, cylW(0.28, 0.28, 0.7, 12, 1), -0.8 + k * 0.8 + (r() - 0.5) * 0.2, 0.35, 1.3 + r() * 0.3, 0, 0, 0, F);
    addBox(x, z, 2.8, 1.8, ry, -1e9, 1e9, 'stall');
    VSTALLS.push({ x, z, ry, front: doorSpot(x, z, ry, -1.6) });
  }
  // houses around the square, facing it
  const spots = [];
  for (let i = 0, n = 0; i < 400 && n < 17; i++) {
    const a = r() * Math.PI * 2, d = 24 + r() * 26;
    const x = SQUARE.x + Math.cos(a) * d, z = SQUARE.z + Math.sin(a) * d;
    const w = 6 + r() * 3, dd = 5 + r() * 2;
    if (pathDist(x, z) < Math.max(w, dd) / 2 + 3.5) continue;
    if (spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 12)) continue;
    if (riverDist(x, z) < 20) continue;
    spots.push([x, z]);
    const ry = Math.atan2(SQUARE.x - x, SQUARE.z - z);
    const tavern = n === 0, smithy = n === 1;
    if (smithy) { blacksmith(B, x, z, ry); VHOUSES.push({ x, z, ry, w: 6.6, d: 5.6, kind: 'smithy', door: doorSpot(x, z, ry, 3.6), work: doorSpot(x, z, ry, 1.0, 0.3) }); n++; continue; }
    const healer = n === 2;
    VHOUSES.push({ x, z, ry, w: tavern ? 11 : w, d: tavern ? 8 : dd, kind: tavern ? 'tavern' : healer ? 'healer' : 'house', door: doorSpot(x, z, ry, (tavern ? 8 : dd) / 2 + 1.1) });
    house(B, x, z, ry, tavern ? 11 : w, tavern ? 8 : dd, tavern || r() < 0.4 ? 2 : 1, r() < 0.65 ? 'thatch' : 'slate');
    if (tavern) {
      // hanging sign
      const F = frameAt(x, terrainH(x, z), z, ry);
      B.add(MAT.darkWood, boxW(0.1, 0.1, 1.4, 1), 2.2, 3.4, 4.6, 0, 0, 0, F);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: signTex('THE RED BOAR'), side: THREE.DoubleSide }));
      sign.position.set(0, 0, 0); const sp = new THREE.Vector3(2.2, 3.0, 5.1).applyMatrix4(F); sign.position.copy(sp); sign.rotation.y = ry + Math.PI / 2; scene.add(sign);
    }
    if (healer) {
      // the healer's sign: a green cross on a board over the door, herbs drying
      const F = frameAt(x, terrainH(x, z), z, ry);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ map: signTex('HEALER'), side: THREE.DoubleSide }));
      sign.position.copy(new THREE.Vector3(1.4, 3.0, dd / 2 + 0.25).applyMatrix4(F)); sign.rotation.y = ry; scene.add(sign);
      for (let k = 0; k < 4; k++) B.add(MAT.thatch, boxW(0.12, 0.35, 0.12, 1), -1.8 + k * 0.3, 2.35, dd / 2 + 0.25, 0, 0, 0, F);
    }
    if (r() < 0.6) { const F = frameAt(x, 0, z, ry); const tp = new THREE.Vector3(1.0, 0, dd / 2 + 1.2).applyMatrix4(F); torchSpots.push([tp.x, tp.z]); }
    n++;
  }
  B.finish(true);
}
function signTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 170;
  const g = c.getContext('2d');
  g.fillStyle = '#4a3220'; g.fillRect(0, 0, 256, 170); g.strokeStyle = '#2a1a10'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 160);
  g.fillStyle = '#d8c79a'; g.font = 'bold 30px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.fillText(text.split(' ').slice(0, 2).join(' '), 128, 70); g.fillText(text.split(' ').slice(2).join(' '), 128, 115);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blacksmith(B, x, z, ry) {
  const y = terrainH(x, z), F = frameAt(x, y, z, ry);
  for (const [px, pz] of [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]]) B.add(MAT.darkWood, boxW(0.25, 3.2, 0.25, 1), px, 1.6, pz, 0, 0, 0, F);
  for (const s of [-1, 1]) B.add(MAT.roofSlate, boxW(7.2, 0.15, 3.6, 2), 0, 3.6, s * 1.4, 0, -0.5 * s, 0, F);
  B.add(MAT.stone, boxW(6.4, 0.3, 5.4, 2), 0, 0.0, 0, 0, 0, 0, F);
  B.add(MAT.stone, boxW(1.8, 1.0, 1.4, 1.5), -1.6, 0.5, -1.3, 0, 0, 0, F); // forge
  B.add(MAT.coal, boxW(1.3, 0.12, 0.9, 1), -1.6, 1.02, -1.3, 0, 0, 0, F);
  B.add(MAT.stone, boxW(0.9, 3.8, 0.9, 1.5), -1.6, 2.9, -1.7, 0, 0, 0, F); // chimney
  B.add(MAT.iron, boxW(0.6, 0.3, 0.25), 1.2, 0.85, 0.4, 0, 0, 0, F); // anvil
  B.add(MAT.darkWood, cylW(0.3, 0.35, 0.7, 12, 1), 1.2, 0.35, 0.4, 0, 0, 0, F);
  const fp = new THREE.Vector3(-1.6, 1.1, -1.3).applyMatrix4(F);
  addFire(fp.x, fp.y, fp.z, 0.45);
  addBox(x, z, 6.6, 5.6, ry, -1e9, 1e9, 'smithy');
}

// ---------- bridge ----------
function buildBridge() {
  const B = new Builder();
  const F = frameAt(BRIDGE.x, 0, BRIDGE.z, BRIDGE.ang);
  const D = BRIDGE.deck;
  B.add(MAT.stone, boxW(BRIDGE.w, 0.8, BRIDGE.len - 12, 2), 0, D - 0.4, 0, 0, 0, 0, F);
  for (const s of [-1, 1]) {
    B.add(MAT.stone, boxW(0.45, 0.8, BRIDGE.len - 4, 2), s * (BRIDGE.w / 2 - 0.2), D + 0.4, 0, 0, 0, 0, F);
    // ramps down to the banks
    B.add(MAT.stone, boxW(BRIDGE.w, 0.6, 8.2, 2), 0, D - 1.25, s * (BRIDGE.len / 2 - 3.4), 0, s * 0.33, 0, F);
  }
  // piers and arches under the deck
  for (const pz of [-7, 7]) B.add(MAT.stone, boxW(BRIDGE.w + 0.6, D + 3, 2.2, 2), 0, (D - 3) / 2, pz, 0, 0, 0, F);
  for (const az of [-10.5, 0, 10.5]) {
    const arch = new THREE.CylinderGeometry(3.8, 3.8, BRIDGE.w, 20, 1, true, 0, Math.PI);
    arch.rotateZ(Math.PI / 2); arch.rotateY(Math.PI / 2);
    B.add(MAT.stone, arch, 0, D - 4.6, az, 0, 0, 0, F);
  }
  B.finish(true);
  for (const s of [-1, 1]) segs.push(...(() => {
    const a = new THREE.Vector3(s * (BRIDGE.w / 2 - 0.2), 0, -BRIDGE.len / 2 + 2).applyMatrix4(F), b = new THREE.Vector3(s * (BRIDGE.w / 2 - 0.2), 0, BRIDGE.len / 2 - 2).applyMatrix4(F);
    return [{ ax: a.x, az: a.z, bx: b.x, bz: b.z, h0: D - 2, h1: D + 0.8 }];
  })());
}

// ---------- castles ----------
function crenelWall(B, mat, x1, z1, x2, z2, yb, h, thick, snow) {
  const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(x2 - x1, z2 - z1), mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  const F = frameAt(mx, 0, mz, ang + Math.PI / 2);
  B.add(mat, boxW(len, h, thick, 2.5), 0, yb + h / 2, 0, 0, 0, 0, F);
  const n = Math.floor(len / 1.6);
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const o = -len / 2 + 0.8 + i * (len / n);
    for (const s of [-1, 1]) {
      B.add(mat, boxW(0.9, 1.1, 0.5, 1.2), o, yb + h + 0.55, s * (thick / 2 - 0.25), 0, 0, 0, F);
      if (snow) B.add(MAT.snowCap, boxW(0.95, 0.12, 0.55, 1), o, yb + h + 1.16, s * (thick / 2 - 0.25), 0, 0, 0, F);
    }
  }
  if (snow) B.add(MAT.snowCap, boxW(len, 0.1, thick - 1.0, 2), 0, yb + h + 0.05, 0, 0, 0, 0, F);
  addBox(mx, mz, len, thick, ang + Math.PI / 2, yb - 10, yb + h + 1.2, 'wall');
}
function roundTower(B, mat, x, z, yb, r, h, roofMat, snow) {
  B.add(mat, cylW(r, r * 1.08, h, 24, 2.5), x, yb + h / 2, z);
  const n = 12;
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    const a = (i / n) * Math.PI * 2;
    B.add(mat, boxW(1.0, 1.2, 0.6, 1.2), x + Math.cos(a) * (r - 0.3), yb + h + 0.6, z + Math.sin(a) * (r - 0.3), -a + Math.PI / 2);
  }
  if (roofMat) { const c = new THREE.ConeGeometry(r + 0.6, r * 1.9, 24); const uv = c.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 2, uv.getY(i) * r); B.add(snow ? MAT.snowCap : roofMat, c, x, yb + h + 1.2 + r * 0.95, z); }
  circles.push({ x, z, r: r + 0.2 });
}
function buildCastle() {
  const B = new Builder();
  const cx = CASTLE.x, cz = CASTLE.z, y = CASTLE.top + 2, half = 22, h = 10, t = 2.4;
  const yb = y - 4;
  // walls (gap on the east side for the gate)
  crenelWall(B, MAT.stone, cx - half, cz - half, cx + half, cz - half, yb, h + 4, t);
  crenelWall(B, MAT.stone, cx - half, cz + half, cx + half, cz + half, yb, h + 4, t);
  crenelWall(B, MAT.stone, cx - half, cz - half, cx - half, cz + half, yb, h + 4, t);
  crenelWall(B, MAT.stone, cx + half, cz - half, cx + half, cz - 3.2, yb, h + 4, t);
  crenelWall(B, MAT.stone, cx + half, cz + 3.2, cx + half, cz + half, yb, h + 4, t);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roundTower(B, MAT.stone, cx + sx * half, cz + sz * half, yb, 4.2, h + 9, MAT.roofSlate);
  // gatehouse
  for (const s of [-1, 1]) roundTower(B, MAT.stone, cx + half + 1, cz + s * 4.6, yb, 2.6, h + 7, null);
  B.add(MAT.stone, boxW(3.2, 3.2, 7.2, 2), cx + half + 1, y + 6.4, cz);
  for (let i = 0; i < 6; i++) B.add(MAT.iron, boxW(0.08, 2.4, 0.08), cx + half + 1, y + 6.0, cz - 2.2 + i * 0.88);
  for (let i = 0; i < 3; i++) B.add(MAT.iron, boxW(0.08, 0.08, 4.8), cx + half + 1, y + 5.0 + i * 0.8, cz);
  // the keep
  const kx = cx - 7, kz = cz - 2;
  B.add(MAT.stone, boxW(15, 26, 15, 2.5), kx, y + 13 - 1, kz);
  for (let i = 0; i < 10; i++) for (const [sx, sz, ry] of [[1, 0, 0], [-1, 0, 0], [0, 1, Math.PI / 2], [0, -1, Math.PI / 2]]) {
    if (i % 2) continue;
    const o = -6.75 + i * 1.5;
    B.add(MAT.stone, boxW(0.9, 1.2, 0.6, 1.2), kx + sx * 7.2 + (sx ? 0 : o), y + 25.6, kz + sz * 7.2 + (sz ? 0 : o), ry);
  }
  for (const wy of [y + 6, y + 12, y + 18]) for (const s of [-3, 3]) B.add(MAT.window, boxW(0.5, 1.4, 0.2, 1), kx + 7.55, wy, kz + s, Math.PI / 2);
  B.add(MAT.darkWood, boxW(2.2, 3.4, 0.2, 1), kx + 7.6, y + 1.7, kz, Math.PI / 2);
  addBox(kx, kz, 15.2, 15.2, 0, -1e9, 1e9, 'keep');
  // flag on the keep
  B.add(MAT.darkWood, cylW(0.08, 0.1, 7, 8, 1), kx, y + 28.5, kz);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0, 12, 6), clothMatColor(0x6e0c0c, 1));
  flag.geometry.translate(1.6, 0, 0); flag.position.set(kx, y + 31, kz); flag.castShadow = true; scene.add(flag);
  // courtyard: stables, barrels, torches
  B.add(MAT.darkWood, boxW(8, 0.2, 4, 1), cx + 8, y + 3, cz + 15, 0, -0.15, 0);
  for (const px of [-3.8, 0, 3.8]) B.add(MAT.darkWood, boxW(0.2, 3, 0.2, 1), cx + 8 + px, y + 1.5, cz + 13.2);
  addBox(cx + 8, cz + 15, 8, 4, 0, -1e9, 1e9, 'stable');
  for (let i = 0; i < 5; i++) B.add(MAT.wood, cylW(0.3, 0.3, 0.8, 12, 1), cx + 14 + (i % 3) * 0.7, y + 0.4, cz - 14 + Math.floor(i / 3) * 0.7);
  for (const s of [-1, 1]) torchSpots.push([cx + half + 4, cz + s * 3.5]);
  torchSpots.push([cx + 2, cz - 10], [cx + 2, cz + 10]);
  B.finish(true);
}
function buildFortress() {
  const B = new Builder();
  const fx = FORTRESS.x, fz = FORTRESS.z, y = fortressLevel, h = 13, t = 3;
  const wz = fz + 20;
  crenelWall(B, MAT.slate, fx - 75, wz, fx - 3.5, wz, y - 6, h + 6, t, true);
  crenelWall(B, MAT.slate, fx + 3.5, wz, fx + 75, wz, y - 6, h + 6, t, true);
  for (const x of [-75, -38, 38, 75]) roundTower(B, MAT.slate, fx + x, wz, y - 6, 4.5, h + 12, MAT.roofSlate, true);
  for (const s of [-1, 1]) roundTower(B, MAT.slate, fx + s * 6, wz + 1, y - 6, 3, h + 10, MAT.roofSlate, true);
  B.add(MAT.slate, boxW(9, 4, 4, 2), fx, y + h - 2, wz);
  B.add(MAT.snowCap, boxW(9.2, 0.15, 4.2, 2), fx, y + h, wz);
  for (let i = 0; i < 6; i++) B.add(MAT.iron, boxW(0.1, 3, 0.1), fx - 2.5 + i, y + 9.5, wz);
  // keep behind the wall
  B.add(MAT.slate, boxW(18, 22, 16, 2.5), fx, y + 10, fz - 10);
  B.add(MAT.snowCap, boxW(18.2, 0.2, 16.2, 2), fx, y + 21.1, fz - 10);
  addBox(fx, fz - 10, 18.2, 16.2, 0, -1e9, 1e9, 'fkeep');
  for (const wy of [y + 7, y + 14]) for (const s of [-4, 0, 4]) B.add(MAT.window, boxW(0.6, 1.5, 0.2, 1), fx + s, wy, fz - 1.9);
  for (const s of [-1, 1]) torchSpots.push([fx + s * 4.5, wz + 3.5]);
  torchSpots.push([fx - 6, fz + 2], [fx + 6, fz + 2]);
  B.finish(true);
}

// ---------- the battlefield: burned ruins, wrecks, stakes, banners, puddles ----------
function buildBattlefield() {
  const B = new Builder();
  const r = mulberry32(666);
  const ok = (x, z, pad) => pathDist(x, z) > pad + 3 && riverDist(x, z) > 14 + pad && !solidAt(x, z, pad) && !CAMP_SPOTS.some(c => Math.hypot(c.x - x, c.z - z) < 12);
  // burned house shells: broken stone walls with jagged tops, charred beams
  for (let i = 0, n = 0; i < 400 && n < 10; i++) {
    const x = BATTLE_X + 20 + r() * 200, z = (r() * 2 - 1) * 170;
    if (!ok(x, z, 6)) continue;
    const ry = r() * 6.28, w = 6 + r() * 3, d = 5 + r() * 2, y = terrainH(x, z) - 0.4, F = frameAt(x, y, z, ry);
    for (const [sx, sz, len, along] of [[0, d / 2, w, 'x'], [0, -d / 2, w, 'x'], [w / 2, 0, d, 'z'], [-w / 2, 0, d, 'z']]) {
      const pieces = Math.ceil(len / 0.9);
      for (let k = 0; k < pieces; k++) {
        if (r() < 0.12) continue;
        const ph = 0.6 + r() * 2.8 * (1 - Math.abs(k / pieces - 0.5));
        const o = -len / 2 + (k + 0.5) * (len / pieces);
        B.add(MAT.burntStone, boxW(len / pieces + 0.02, ph, 0.55, 2), along === 'x' ? o : sx, ph / 2, along === 'x' ? sz : o, along === 'x' ? 0 : Math.PI / 2, 0, 0, F);
      }
    }
    for (let k = 0; k < 5; k++) B.add(MAT.char, boxW(0.22, 0.22, 3 + r() * 3, 1), (r() - 0.5) * w * 0.8, 0.4 + r() * 1.2, (r() - 0.5) * d * 0.8, r() * 3, 0.3 + r() * 0.6, r() * 0.5, F);
    addBox(x, z, w + 0.5, d + 0.5, ry, -1e9, 1e9, 'ruin');
    if (r() < 0.5) addFire(x + (r() - 0.5) * 2, terrainH(x, z) + 0.1, z + (r() - 0.5) * 2, 0.7);
    n++;
  }
  // broken carts
  for (let i = 0, n = 0; i < 200 && n < 10; i++) {
    const x = BATTLE_X + r() * 230, z = (r() * 2 - 1) * 180;
    if (!ok(x, z, 2)) continue;
    const ry = r() * 6.28, y = terrainH(x, z), F = frameAt(x, y, z, ry), tilt = (r() - 0.5) * 0.5;
    B.add(MAT.darkWood, boxW(1.6, 0.5, 3.0, 1), 0, 0.75, 0, 0, tilt * 0.3, tilt, F);
    B.add(MAT.darkWood, boxW(0.1, 0.1, 2.2, 1), 0.3, 0.6, 2.4, 0, 0.2, 0, F);
    for (const [wx, wz, flat] of [[-0.9, -0.8, false], [0.9, -0.8, r() < 0.5], [-0.9, 0.9, false]]) {
      const wh = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 14);
      if (flat) B.add(MAT.darkWood, wh, wx + 0.6, 0.08, wz + 0.5, 0, 0, 0, F);
      else B.add(MAT.darkWood, wh, wx, 0.55, wz, 0, 0, Math.PI / 2, F);
    }
    addBox(x, z, 1.8, 3.2, ry, -1e9, 1e9, 'cart');
    n++;
  }
  // sharpened stake barricades
  for (let i = 0, n = 0; i < 200 && n < 12; i++) {
    const x = BATTLE_X + 10 + r() * 220, z = (r() * 2 - 1) * 170;
    if (!ok(x, z, 4)) continue;
    const ry = r() * 6.28, F0 = frameAt(x, 0, z, ry);
    for (let k = 0; k < 7; k++) {
      const p = new THREE.Vector3(-4.2 + k * 1.4, 0, 0).applyMatrix4(F0);
      B.add(MAT.darkWood, new THREE.ConeGeometry(0.12, 2.6, 7), p.x, terrainH(p.x, p.z) + 0.9, p.z, ry, 0.7, 0);
    }
    const a = new THREE.Vector3(-4.4, 0, 0).applyMatrix4(F0), b = new THREE.Vector3(4.4, 0, 0).applyMatrix4(F0);
    segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z });
    n++;
  }
  // broken trebuchet
  {
    const x = BATTLE_X + 120, z = -30, y = terrainH(x, z), F = frameAt(x, y, z, 0.7);
    for (const s of [-1, 1]) { B.add(MAT.darkWood, boxW(0.4, 0.4, 7, 1), s * 1.5, 0.3, 0, 0, 0, 0, F); B.add(MAT.darkWood, boxW(0.35, 6, 0.35, 1), s * 1.5, 3, 0, 0, 0.3, s * 0.05, F); }
    B.add(MAT.darkWood, boxW(0.4, 0.4, 3.5, 1), 0, 6, 0, 0, Math.PI / 2, 0, F);
    B.add(MAT.darkWood, boxW(0.35, 0.35, 10, 1), 0, 2.0, 2, 0, 0.35, 0.4, F);
    B.add(MAT.darkWood, boxW(1.6, 1.4, 1.6, 1), 0.4, 0.7, -2.5, 0, 0.3, 0.6, F);
    addBox(x, z, 4, 8, 0.7, -1e9, 1e9, 'treb');
  }
  B.finish(true);
  // banners on spears stuck in the ground
  const bcol = [0x7a1717, 0x1a2f6e, 0x222222];
  for (let i = 0, n = 0; i < 200 && n < 18; i++) {
    const x = BATTLE_X + r() * 230, z = (r() * 2 - 1) * 180;
    if (!ok(x, z, 1)) continue;
    const y = terrainH(x, z), lean = (r() - 0.5) * 0.5;
    const pole = new THREE.Mesh(cylW(0.04, 0.05, 4.2, 6, 1), MAT.darkWood); pole.position.set(x, y + 2.0, z); pole.rotation.z = lean; pole.castShadow = true; scene.add(pole);
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6, 6, 8), clothMatColor(bcol[n % 3], 0.6));
    ban.geometry.translate(0.45, 0, 0); ban.position.set(x + Math.sin(-lean) * 1.5, y + 3.2, z); ban.rotation.y = r() * 6.28; ban.rotation.z = lean; ban.castShadow = true; scene.add(ban);
    n++;
  }
  // rain puddles in the craters
  for (let i = 0, n = 0; i < 3000 && n < 70; i++) {
    const x = BATTLE_X - 10 + r() * 240, z = (r() * 2 - 1) * 190;
    const h = terrainH(x, z);
    let low = true;
    for (let k = 0; k < 6; k++) { const a = k * 1.047; if (terrainH(x + Math.cos(a) * 2, z + Math.sin(a) * 2) < h + 0.05) { low = false; break; } }
    if (!low || pathDist(x, z) < 2) continue;
    const rad = 1.2 + r() * 2.2;
    const g = new THREE.CircleGeometry(rad, 24); const p = g.attributes.position;
    for (let k = 1; k < p.count; k++) { const f = 0.75 + vnoise(k * 0.7, n) * 0.25 + 0.2; p.setXY(k, p.getX(k) * f, p.getY(k) * f); }
    const m = new THREE.Mesh(g, MAT.puddle); m.rotation.x = -Math.PI / 2; m.position.set(x, h + 0.06, z); m.receiveShadow = true; scene.add(m);
    n++;
  }
}

// ---------- knights' camps: tents, campfire, racks ----------
function buildCamps() {
  const B = new Builder();
  const r = mulberry32(99);
  const tentCols = [0xcdbf9e, 0x8a7a5e, 0x7a1717, 0x1a2f6e];
  for (const c of CAMP_SPOTS) {
    if (Math.hypot(c.x - CASTLE.x, c.z - CASTLE.z) < CASTLE.r) { addFire(c.x + 4, terrainH(c.x + 4, c.z) + 0.1, c.z + 2, 0.75); continue; }
    const y = terrainH(c.x, c.z);
    // campfire flames (the scanned stone fire pit goes under them)
    addFire(c.x, y + 0.25, c.z, 0.8);
    circles.push({ x: c.x, z: c.z, r: 0.9 });
    // tents around it
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, d = 6 + r() * 3, tx = c.x + Math.cos(a) * d, tz = c.z + Math.sin(a) * d;
      if (pathDist(tx, tz) < 4 || solidAt(tx, tz, 2)) continue;
      const ry = Math.atan2(c.x - tx, c.z - tz), ty = terrainH(tx, tz);
      const mat = clothMatColor(tentCols[Math.floor(r() * 4)], 0.05);
      const tent = new THREE.Group(); tent.position.set(tx, ty, tz); tent.rotation.y = ry;
      // A-frame: two slanted canvas sides meeting at a ridge 2.1 m up
      for (const s of [-1, 1]) {
        const g = new THREE.PlaneGeometry(2.64, 3.2, 2, 2); g.rotateX(-Math.PI / 2); g.rotateZ(-s * 0.92); g.translate(s * 0.8, 1.05, 0);
        const p = new THREE.Mesh(g, mat); p.castShadow = true; tent.add(p);
      }
      const back = new THREE.Shape(); back.moveTo(-1.6, 0); back.lineTo(1.6, 0); back.lineTo(0, 2.1); back.closePath();
      const bm = new THREE.Mesh(new THREE.ShapeGeometry(back), mat); bm.position.z = -1.6; tent.add(bm);
      scene.add(tent);
      addBox(tx, tz, 3.4, 3.4, ry, -1e9, 1e9, 'tent');
    }
    // weapon rack + logs to sit on
    const ra = r() * 6.28, rx = c.x + Math.cos(ra) * 3.5, rz = c.z + Math.sin(ra) * 3.5;
    B.add(MAT.darkWood, boxW(2, 0.1, 0.1, 1), rx, terrainH(rx, rz) + 1.1, rz, ra);
    for (const s of [-1, 1]) B.add(MAT.darkWood, boxW(0.1, 1.2, 0.1, 1), rx + Math.cos(ra + Math.PI / 2) * s * 0.9, terrainH(rx, rz) + 0.6, rz + Math.sin(ra + Math.PI / 2) * s * 0.9);
    for (let k = 0; k < 2; k++) { const la = ra + 1.6 + k * 2.2, lx = c.x + Math.cos(la) * 2.3, lz = c.z + Math.sin(la) * 2.3; B.add(MAT.darkWood, cylW(0.22, 0.22, 1.8, 10, 1), lx, terrainH(lx, lz) + 0.22, lz, la, 0, Math.PI / 2); }
  }
  B.finish(true);
}
const torchSpots = [];
function buildWorld() {
  makeMaterials();
  buildVillage();
  buildBridge();
  buildCastle();
  buildFortress();
  buildBattlefield();
  buildCamps();
  for (const [x, z] of torchSpots) torch(x, z);
}
