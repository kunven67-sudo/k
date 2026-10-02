
// =====================================================================
// GEOMETRY HELPERS & SHARED MATERIALS
// =====================================================================
const MAT = {};
const WIND = { uTime: { value: 0 }, uWind: { value: 0.4 } };
// sway leaves and grass in the wind (works for normal and instanced meshes)
function windify(mat, strength = 1, base = 1.5) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND.uTime; sh.uniforms.uWind = WIND.uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wpos = vec4(0.0,0.0,0.0,1.0);
      #ifdef USE_INSTANCING
        wpos = instanceMatrix * wpos;
      #endif
      wpos = modelMatrix * wpos;
      float hh = max(position.y - ${base.toFixed(2)}, 0.0);
      float ph = uTime * (1.1 + uWind) + wpos.x * 0.13 + wpos.z * 0.11;
      float sw = (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25) * (0.15 + uWind) * ${(0.035 * strength).toFixed(4)} * hh * hh;
      transformed.x += sw; transformed.z += sw * 0.6;`);
  };
  mat.customProgramCacheKey = () => 'wind' + strength + '_' + base;
  return mat;
}
function makeMaterials() {
  const S = (o) => new THREE.MeshStandardMaterial(o);
  MAT.ground = S({ vertexColors: true, map: TEX.ground, roughness: 0.96, metalness: 0 });
  MAT.stone = S({ map: TEX.stone, roughness: 0.92 });
  MAT.darkStone = S({ map: TEX.stone, color: 0x8a8590, roughness: 0.92 });
  MAT.rock = S({ map: TEX.rock, roughness: 0.95, vertexColors: true });
  MAT.timber = S({ map: TEX.timber, roughness: 0.9 });
  MAT.roof = S({ map: TEX.roof, roughness: 0.85 });
  MAT.slate = S({ map: TEX.roof, color: 0x6a7080, roughness: 0.8 });
  MAT.thatch = S({ map: TEX.thatch, roughness: 1 });
  MAT.wood = S({ map: TEX.wood, roughness: 0.88 });
  MAT.darkWood = S({ map: TEX.wood, color: 0x6a5a4a, roughness: 0.9 });
  MAT.bark = S({ map: TEX.bark, roughness: 0.95 });
  MAT.leaf = windify(S({ map: TEX.leaf, roughness: 0.9, side: THREE.DoubleSide }), 1, 2);
  MAT.farTree = windify(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.6, 2);
  MAT.grass = windify(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: true }), 7, 0);
  MAT.bush = windify(S({ map: TEX.leaf, roughness: 0.95 }), 3, 0);
  MAT.window = new THREE.MeshStandardMaterial({ color: 0x1a140c, emissive: 0xffb050, emissiveIntensity: 0, roughness: 0.4 });
  MAT.glowRed = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 2, roughness: 0.6 });
  MAT.glowGreen = new THREE.MeshStandardMaterial({ color: 0x103000, emissive: 0x6aff40, emissiveIntensity: 1.6, roughness: 0.6 });
  MAT.iron = S({ color: 0x3a3c40, roughness: 0.45, metalness: 0.85 });
  MAT.steel = S({ color: 0xb8bcc4, roughness: 0.25, metalness: 1 });
  MAT.silver = S({ color: 0xe8ecf4, roughness: 0.15, metalness: 1 });
  MAT.gold = S({ color: 0xd8a840, roughness: 0.3, metalness: 1 });
  MAT.cloth = S({ color: 0x7a2420, roughness: 1, side: THREE.DoubleSide });
  MAT.canvas = S({ color: 0xb8a888, roughness: 1, side: THREE.DoubleSide });
  MAT.bone = S({ color: 0xd8cfb8, roughness: 0.7 });
  MAT.hay = S({ map: TEX.thatch, color: 0xe0c070, roughness: 1 });
  MAT.dirt = S({ color: 0x3a2a1c, roughness: 1 });
  MAT.water = new THREE.MeshStandardMaterial({ color: 0x18323c, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.86, normalMap: TEX.waterN, normalScale: new THREE.Vector2(0.4, 0.4), depthWrite: false });
  MAT.river = MAT.water.clone(); MAT.river.normalMap = TEX.waterN.clone(); MAT.river.normalMap.needsUpdate = true;
  MAT.swamp = new THREE.MeshStandardMaterial({ color: 0x1e2414, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.93, normalMap: TEX.waterN, normalScale: new THREE.Vector2(0.15, 0.15), depthWrite: false });
  MAT.blood = new THREE.MeshStandardMaterial({ map: TEX.blood, transparent: true, depthWrite: false, roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -4 });
  MAT.track = new THREE.MeshBasicMaterial({ map: TEX.track, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.5, fog: true });
  MAT.glow = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  MAT.fire = new THREE.SpriteMaterial({ map: TEX.glow, color: 0xff7a20, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}
// a box whose UVs repeat with its size (so textures keep their scale)
function boxGeo(w, h, d, us = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const sx = nx > 0.5 ? d : w, sy = ny > 0.5 ? d : h;
    uv.setXY(i, uv.getX(i) * sx / us, uv.getY(i) * sy / us);
  }
  return g;
}
// a gable roof: ridge along x, width w, depth d, rise h
function roofGeo(w, d, h, over = 0.5) {
  const W = w / 2 + over, D = d / 2 + over, g = new THREE.BufferGeometry();
  const P = [-W, 0, D, W, 0, D, W, h, 0, -W, 0, D, W, h, 0, -W, h, 0, // front slope
    W, 0, -D, -W, 0, -D, -W, h, 0, W, 0, -D, -W, h, 0, W, h, 0]; // back slope
  const sl = Math.hypot(D, h) / 3;
  const U = [0, 0, W * 2 / 3, 0, W * 2 / 3, sl, 0, 0, W * 2 / 3, sl, 0, sl, 0, 0, W * 2 / 3, 0, W * 2 / 3, sl, 0, 0, W * 2 / 3, sl, 0, sl];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.computeVertexNormals();
  return g;
}
function gableGeo(d, h) { // the triangle wall under a gable roof (in the x=0 plane, facing +x and -x)
  const D = d / 2, g = new THREE.BufferGeometry();
  const P = [0, 0, D, 0, 0, -D, 0, h, 0, 0, 0, -D, 0, 0, D, 0, h, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, d / 3, 0, d / 6, h / 3, 0, 0, d / 3, 0, d / 6, h / 3], 2)); g.computeVertexNormals();
  return g;
}
// merge many (geometry, matrix) pairs into one geometry (positions, normals, uvs, optional colours)
function mergeGeos(list, withColor) {
  let count = 0; const parts = [];
  for (const [g0, m, col] of list) { const g = g0.index ? g0.toNonIndexed() : g0; parts.push([g, m, col]); count += g.attributes.position.count; }
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), colA = withColor ? new Float32Array(count * 3) : null;
  const v = new THREE.Vector3(), nm = new THREE.Matrix3(); let o = 0;
  for (const [g, m, col] of parts) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv; nm.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m); pos[(o + i) * 3] = v.x; pos[(o + i) * 3 + 1] = v.y; pos[(o + i) * 3 + 2] = v.z;
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(o + i) * 3] = v.x; nor[(o + i) * 3 + 1] = v.y; nor[(o + i) * 3 + 2] = v.z; }
      if (U) { uv[(o + i) * 2] = U.getX(i); uv[(o + i) * 2 + 1] = U.getY(i); }
      if (colA) { const c = col || [1, 1, 1]; colA[(o + i) * 3] = c[0]; colA[(o + i) * 3 + 1] = c[1]; colA[(o + i) * 3 + 2] = c[2]; }
    }
    o += P.count;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (colA) g.setAttribute('color', new THREE.BufferAttribute(colA, 3));
  g.computeBoundingSphere(); return g;
}
const M4 = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
// batches of static geometry per material, merged into one mesh each at the end
class Batch {
  constructor() { this.by = new Map(); }
  add(mat, geo, m, col) { if (!this.by.has(mat)) this.by.set(mat, []); this.by.get(mat).push([geo, m, col]); }
  // add a geometry placed by a parent matrix times a local matrix
  addL(mat, geo, parent, local, col) { this.add(mat, geo, new THREE.Matrix4().multiplyMatrices(parent, local), col); }
  build(parent, shadows = true) {
    const out = [];
    for (const [mat, list] of this.by) { const g = mergeGeos(list, !!mat.vertexColors); const mesh = new THREE.Mesh(g, mat); mesh.castShadow = shadows; mesh.receiveShadow = true; parent.add(mesh); out.push(mesh); }
    this.by.clear(); return out;
  }
}
// ---------- collision shapes (2D footprint + height range) ----------
const COL = { grid: new Map(), size: 16, list: [] };
function colKey(gx, gz) { return gx * 10007 + gz; }
function addCollider(c) { // c: {kind:'circle', x, z, r, y0, y1} or {kind:'box', x, z, hw, hd, rot, y0, y1}
  c.y0 = c.y0 == null ? -1e9 : c.y0; c.y1 = c.y1 == null ? 1e9 : c.y1;
  if (c.kind === 'box') { c.cos = Math.cos(c.rot || 0); c.sin = Math.sin(c.rot || 0); c.br = Math.hypot(c.hw, c.hd); } else c.br = c.r;
  const s = COL.size, x0 = Math.floor((c.x - c.br) / s), x1 = Math.floor((c.x + c.br) / s), z0 = Math.floor((c.z - c.br) / s), z1 = Math.floor((c.z + c.br) / s);
  for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = colKey(gx, gz); if (!COL.grid.has(k)) COL.grid.set(k, []); COL.grid.get(k).push(c); }
  COL.list.push(c); return c;
}
// push a circle (x, z, radius) at height y out of everything solid; returns true if it touched something
function collideCircle(e, r, y, h = 1.7) {
  const list = COL.grid.get(colKey(Math.floor(e.x / COL.size), Math.floor(e.z / COL.size))); if (!list) return false; let hit = false;
  for (const c of list) {
    if (c.off || y + h < c.y0 || y > c.y1) continue;
    if (c.kind === 'circle') { const dx = e.x - c.x, dz = e.z - c.z, d = Math.hypot(dx, dz), m = r + c.r; if (d < m && d > 1e-6) { e.x = c.x + (dx / d) * m; e.z = c.z + (dz / d) * m; hit = true; } }
    else {
      const dx = e.x - c.x, dz = e.z - c.z, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos; // into box space
      const cx = clamp(lx, -c.hw, c.hw), cz = clamp(lz, -c.hd, c.hd); let ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
      if (d < r) {
        let nx, nz, push;
        if (d > 1e-6) { nx = ox / d; nz = oz / d; push = r - d; }
        else { const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz); if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; push = px + r; } else { nx = 0; nz = Math.sign(lz) || 1; push = pz + r; } }
        const wx = nx * c.cos + nz * c.sin, wz = -nx * c.sin + nz * c.cos; e.x += wx * push; e.z += wz * push; hit = true;
      }
    }
  }
  return hit;
}
// the top of anything you can stand on here (bridges, floors), or -Infinity
const DECKS = [];
function deckAt(x, z, fromY) {
  let best = -Infinity;
  for (const d of DECKS) {
    const dx = x - d.x, dz = z - d.z, lx = dx * d.cos - dz * d.sin, lz = dx * d.sin + dz * d.cos;
    if (Math.abs(lx) > d.hw || Math.abs(lz) > d.hd) continue;
    const y = d.y + (d.slope ? d.slope * lx : 0) + (d.arch ? d.arch * (1 - (lx / d.hw) ** 2) : 0);
    if (y <= fromY + 0.7 && y > best) best = y;
  }
  return best;
}
function addDeck(d) { d.cos = Math.cos(d.rot || 0); d.sin = Math.sin(d.rot || 0); DECKS.push(d); return d; }
function groundAt(x, z, fromY = 1e9) { return Math.max(heightAt(x, z), deckAt(x, z, fromY)); }
