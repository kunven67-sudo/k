
// =====================================================================
// TERRAIN — the height of the valley everywhere, what the ground is made
// of, where water is, and the 3D ground mesh (chunks with two levels of detail).
// =====================================================================
const CELL = 2, GN = WORLD_SIZE / CELL + 1; // 801 x 801 height samples
const SURF = { GRASS: 0, FOREST: 1, DIRT: 2, ROCK: 3, SNOW: 4, SAND: 5, MUD: 6, FIELD: 7, COBBLE: 8, BED: 9 };
const SURF_NAME = ['grass', 'forest', 'dirt', 'rock', 'snow', 'sand', 'mud', 'field', 'stone', 'gravel'];
const TER = { h: null, s: null, f: null, riverLevel: null, ready: false };
const gauss = (dx, dz, r) => Math.exp(-(dx * dx + dz * dz) / (r * r));
// segment buckets so "distance to the nearest road" is cheap
function makeBuckets(paths, size = 40) {
  const B = new Map();
  paths.forEach((pts, pi) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const x0 = Math.floor((Math.min(ax, bx) - 30) / size), x1 = Math.floor((Math.max(ax, bx) + 30) / size), z0 = Math.floor((Math.min(az, bz) - 30) / size), z1 = Math.floor((Math.max(az, bz) + 30) / size);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) { const k = gx * 10007 + gz; if (!B.has(k)) B.set(k, []); B.get(k).push([pi, i]); }
    }
  });
  return { B, size, paths };
}
function bucketDist(bk, x, z) { // -> [distance, path index, t along segment, segment index]
  const list = bk.B.get(Math.floor(x / bk.size) * 10007 + Math.floor(z / bk.size)); if (!list) return [1e9, -1, 0, 0];
  let best = 1e9, bp = -1, bt = 0, bi = 0;
  for (const [pi, i] of list) {
    const pts = bk.paths[pi], [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; bp = pi; bt = t; bi = i; }
  }
  return [best, bp, bt, bi];
}
let RIVER_BK = null, ROAD_BK = null, ROAD_LEVELS = null, RIVER_LEVELS = null;
// the land before roads and the river are cut into it
function baseHeight(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  let d = Math.pow(ax ** 4 + az ** 4, 0.25) + fbm(x / 220, z / 220, 3, 5) * 90;
  const mtn = smoothstep(520, 770, d);
  let h = 14 + fbm(x / 320, z / 320, 5) * 15 + fbm(x / 60, z / 60, 3, 9) * 1.6;
  h += (1 - mtn) * Math.max(0, ridged(x / 260, z / 260, 3, 3) - 0.55) * 60; // rolling hills
  h += mtn * (95 + ridged(x / 170, z / 170, 5, 7) * 150 + (z < 0 ? smoothstep(-300, -760, z) * 60 : 0));
  // castle hill
  const P = PLACES;
  h += 36 * gauss(x - P.castle.x, z - P.castle.z, 120);
  // flattened areas
  const flat = (cx, cz, r, level, edge = 40) => { const k = 1 - smoothstep(r, r + edge, Math.hypot(x - cx, z - cz)); h = lerp(h, level, k); };
  flat(P.castle.x, P.castle.z, 62, castleLevel(), 30);
  flat(P.ashford.x, P.ashford.z, P.ashford.r * 0.8, TOWN_LEVEL + fbm(x / 40, z / 40, 2) * 0.4, 45);
  flat(P.graveyard.x, P.graveyard.z, 40, baseNoNear(P.graveyard.x, P.graveyard.z), 30);
  flat(P.farms.x, P.farms.z, 70, 14, 40);
  flat(P.mill.x, P.mill.z, 16, 12.5, 20);
  flat(P.den.x, P.den.z, 14, baseNoNear(P.den.x, P.den.z), 16);
  flat(P.shrine.x, P.shrine.z, 14, shrineLevel(), 14);
  flat(P.nest.x, P.nest.z, 26, nestLevel(), 26);
  for (const c of CAMPS) flat(c.x, c.z, 9, campLevel(c), 12);
  // the swamp: low, lumpy, half flooded
  const ds = Math.hypot(x - P.swamp.x, z - P.swamp.z), ks = 1 - smoothstep(P.swamp.r * 0.7, P.swamp.r + 30, ds);
  if (ks > 0) h = lerp(h, SWAMP_LEVEL - 0.5 + fbm(x / 18, z / 18, 3, 21) * 1.6, ks);
  { const k = 1 - smoothstep(10, 22, Math.hypot(x - P.witch.x, z - P.witch.z)); if (k > 0) h = lerp(h, SWAMP_LEVEL + 0.9, k); }
  // the lake bowl
  const dl = Math.hypot(x - P.lake.x, z - P.lake.z) / P.lake.r;
  if (dl < 1.5) { const bed = LAKE_LEVEL - 6 * (1 - Math.min(1, dl) ** 2) + 0.6; h = lerp(Math.min(h, bed), h, smoothstep(0.85, 1.5, dl)); }
  return h;
}
// heights some flat spots are levelled to (no recursion: they use the plain noise)
function baseNoNear(x, z) { return 14 + fbm(x / 320, z / 320, 5) * 15; }
function castleLevel() { const P = PLACES.castle; return baseNoNear(P.x, P.z) + 36; }
function shrineLevel() { const P = PLACES.shrine; return 70; }
function nestLevel() { return 138; }
function campLevel(c) { return c.id === 'north' ? 34 : c.id === 'ashford' ? TOWN_LEVEL : c.id === 'mire' ? SWAMP_LEVEL + 1.2 : c.id === 'lake' ? LAKE_LEVEL + 1.6 : baseNoNear(c.x, c.z); }
function profile(pts, fn, smoothN, monotone) {
  let lv = pts.map(([x, z]) => fn(x, z));
  if (monotone) { for (let i = 1; i < lv.length; i++) lv[i] = Math.min(lv[i], lv[i - 1] - 0.03); }
  for (let k = 0; k < smoothN; k++) lv = lv.map((v, i) => (i === 0 || i === lv.length - 1 ? v : (lv[i - 1] + v * 2 + lv[i + 1]) / 4));
  return lv;
}
function riverLevelAt(i, t) { const L = RIVER_LEVELS; return lerp(L[i], L[Math.min(L.length - 1, i + 1)], t); }
function genTerrain() {
  const t0 = performance.now();
  RIVER_BK = makeBuckets([RIVER], 40); ROAD_BK = makeBuckets(ROADS, 40);
  RIVER_LEVELS = profile(RIVER, (x, z) => Math.max(RIVER_BOTTOM, baseHeight(x, z) - 2.2), 6, true);
  RIVER_LEVELS[RIVER_LEVELS.length - 1] = LAKE_LEVEL; for (let i = 0; i < RIVER_LEVELS.length; i++) RIVER_LEVELS[i] = Math.max(LAKE_LEVEL, Math.min(RIVER_TOP, RIVER_LEVELS[i]));
  ROAD_LEVELS = ROADS.map((pts) => profile(pts, baseHeight, 10, false));
  const H = new Float32Array(GN * GN), S = new Uint8Array(GN * GN), F = new Uint8Array(GN * GN);
  for (let j = 0; j < GN; j++) {
    const z = -HALF + j * CELL;
    for (let i = 0; i < GN; i++) {
      const x = -HALF + i * CELL; let h = baseHeight(x, z);
      // roads: level the ground along them
      const [rd, rp, rt, ri] = bucketDist(ROAD_BK, x, z);
      if (rp >= 0 && rd < 9) { const L = ROAD_LEVELS[rp], lv = lerp(L[ri], L[ri + 1], rt); h = lerp(h, lv, 1 - smoothstep(3.2, 9, rd)); }
      // the river: a channel with sloping banks
      const [vd, vp, vt, vi] = bucketDist(RIVER_BK, x, z);
      let surf = -1;
      if (vp >= 0 && vd < 26) {
        const wl = riverLevelAt(vi, vt), w = 6 + 3 * Math.sin(vi * 0.7);
        const bed = wl - 2.4 * (1 - smoothstep(0, w, vd)) - 0.3;
        const bank = lerp(bed, h, smoothstep(w - 1, 24, vd));
        h = Math.min(h, bank);
        if (vd < w + 3) surf = vd < w ? SURF.BED : SURF.SAND;
      }
      H[j * GN + i] = h;
      // ground type
      const nn = fbm(x / 35, z / 35, 3, 11);
      if (surf < 0) {
        const dt = Math.hypot(x - PLACES.ashford.x, z - PLACES.ashford.z);
        if (rp >= 0 && rd < (dt < 90 ? 3.4 : 2.6) + nn * 0.6) surf = dt < 95 ? SURF.COBBLE : SURF.DIRT;
        else if (h > 128 + nn * 14) surf = SURF.SNOW;
        else if (Math.hypot(x - PLACES.swamp.x, z - PLACES.swamp.z) < PLACES.swamp.r + 10 * nn) surf = SURF.MUD;
        else if (h < LAKE_LEVEL + 1.1 && Math.hypot(x - PLACES.lake.x, z - PLACES.lake.z) < PLACES.lake.r * 1.35) surf = SURF.SAND;
        else if (Math.abs(x - PLACES.farms.x) < 70 && Math.abs(z - PLACES.farms.z) < 55 && rd > 4) surf = SURF.FIELD;
        else if (dt < 22 && Math.abs(x) < 18 && Math.abs(z - 140) < 14) surf = SURF.COBBLE;
        else surf = SURF.GRASS;
      }
      S[j * GN + i] = surf;
    }
  }
  // slopes make rock; forest density
  for (let j = 1; j < GN - 1; j++) for (let i = 1; i < GN - 1; i++) {
    const k = j * GN + i, sx = (H[k + 1] - H[k - 1]) / (2 * CELL), sz = (H[k + GN] - H[k - GN]) / (2 * CELL), sl = Math.hypot(sx, sz);
    const x = -HALF + i * CELL, z = -HALF + j * CELL;
    if (sl > 0.85 && S[k] !== SURF.SNOW) S[k] = SURF.ROCK; else if (sl > 0.6 && S[k] === SURF.GRASS && H[k] > 40) S[k] = SURF.ROCK;
    F[k] = Math.round(forestDensity(x, z, H[k], S[k], sl) * 255);
    if (F[k] > 140 && S[k] === SURF.GRASS) S[k] = SURF.FOREST;
  }
  TER.h = H; TER.s = S; TER.f = F; TER.ready = true;
  console.log('terrain', Math.round(performance.now() - t0) + 'ms');
}
function forestDensity(x, z, h, s, sl) {
  if (s !== SURF.GRASS && s !== SURF.FOREST && s !== SURF.SNOW) return 0;
  if (sl > 0.75 || h > 150) return 0;
  const P = PLACES;
  let f = fbm(x / 140, z / 140, 4, 33) * 0.9 + 0.32;
  f += 0.7 * (1 - smoothstep(P.wolfwood.r * 0.6, P.wolfwood.r * 1.15, Math.hypot(x - P.wolfwood.x, z - P.wolfwood.z)));
  f -= 1.2 * (1 - smoothstep(P.ashford.r, P.ashford.r + 60, Math.hypot(x - P.ashford.x, z - P.ashford.z)));
  f -= 1 * (1 - smoothstep(P.castle.r, P.castle.r + 40, Math.hypot(x - P.castle.x, z - P.castle.z)));
  f -= 1 * (1 - smoothstep(30, 50, Math.hypot(x - P.graveyard.x, z - P.graveyard.z)));
  f -= 1 * (1 - smoothstep(14, 24, Math.hypot(x - P.den.x, z - P.den.z)));
  f -= 1 * (1 - smoothstep(25, 40, Math.hypot(x - P.mill.x, z - P.mill.z)));
  for (const c of CAMPS) f -= 1 * (1 - smoothstep(10, 18, Math.hypot(x - c.x, z - c.z)));
  if (h > 95) f -= (h - 95) / 40;
  return clamp(f, 0, 1);
}
// ---------- queries (used by everything that walks) ----------
function heightAt(x, z) {
  const gx = clamp((x + HALF) / CELL, 0, GN - 1.001), gz = clamp((z + HALF) / CELL, 0, GN - 1.001);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, H = TER.h, k = j * GN + i;
  if (fx + fz <= 1) return H[k] + (H[k + 1] - H[k]) * fx + (H[k + GN] - H[k]) * fz;
  const h11 = H[k + GN + 1]; return h11 + (H[k + GN] - h11) * (1 - fx) + (H[k + 1] - h11) * (1 - fz);
}
function gridIdx(x, z) { const i = clamp(Math.round((x + HALF) / CELL), 0, GN - 1), j = clamp(Math.round((z + HALF) / CELL), 0, GN - 1); return j * GN + i; }
const surfaceAt = (x, z) => TER.s[gridIdx(x, z)];
const forestAt = (x, z) => TER.f[gridIdx(x, z)] / 255;
function slopeAt(x, z) { const e = 1.5; return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e); }
function normalAt(x, z, out) { const e = 1, hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e); out.set(-hx, 2 * e, -hz).normalize(); return out; }
// the water surface height here, or -Infinity on dry land
function waterLevelAt(x, z) {
  const P = PLACES;
  if (Math.hypot(x - P.lake.x, z - P.lake.z) < P.lake.r * 1.5) return LAKE_LEVEL;
  if (Math.hypot(x - P.swamp.x, z - P.swamp.z) < P.swamp.r + 40) return SWAMP_LEVEL;
  const [vd, vp, vt, vi] = bucketDist(RIVER_BK, x, z);
  if (vp >= 0 && vd < 16) return riverLevelAt(vi, vt);
  return -Infinity;
}
const waterDepthAt = (x, z) => Math.max(0, waterLevelAt(x, z) - heightAt(x, z));
// ---------- ground colours ----------
const SURF_COL = [[0.27, 0.36, 0.14], [0.2, 0.24, 0.12], [0.36, 0.29, 0.2], [0.38, 0.37, 0.35], [0.86, 0.88, 0.92], [0.55, 0.5, 0.38], [0.2, 0.2, 0.12], [0.48, 0.42, 0.2], [0.42, 0.4, 0.37], [0.3, 0.28, 0.24]];
function groundColor(i, j, out) {
  const k = j * GN + i, s = TER.s[k], x = -HALF + i * CELL, z = -HALF + j * CELL, c = SURF_COL[s];
  const n = fbm(x / 9, z / 9, 2, 3) * 0.5 + fbm(x / 60, z / 60, 2, 4) * 0.5;
  let r = c[0], g = c[1], b = c[2];
  if (s === SURF.GRASS || s === SURF.FOREST) { r += n * 0.06 + (TER.f[k] / 255) * -0.04; g += n * 0.08; b += n * 0.02; const dry = smoothstep(0.2, 0.8, fbm(x / 200, z / 200, 2, 8)); r = lerp(r, 0.4, dry * 0.35); g = lerp(g, 0.38, dry * 0.25); }
  else if (s === SURF.FIELD) { const stripe = Math.sin((x + z * 0.15) * 0.9) > 0 ? 0.06 : -0.03; const crop = hash2(Math.floor((x - 60) / 26), Math.floor((z - 170) / 22), 5); if (crop < 0.4) { r = 0.55 + stripe; g = 0.48 + stripe; b = 0.22; } else if (crop < 0.75) { r = 0.3 + stripe; g = 0.42 + stripe; b = 0.16; } else { r = 0.36 + stripe; g = 0.27; b = 0.18; } }
  else { r += n * 0.05; g += n * 0.05; b += n * 0.05; }
  if (s === SURF.ROCK) { const h = TER.h[k]; if (h > 110) { const sn = smoothstep(110, 135, h) * 0.6; r = lerp(r, 0.85, sn); g = lerp(g, 0.87, sn); b = lerp(b, 0.92, sn); } }
  out[0] = clamp(r, 0, 1); out[1] = clamp(g, 0, 1); out[2] = clamp(b, 0, 1); return out;
}
function groundColorLin(i, j, out) { groundColor(i, j, out); out[0] = Math.pow(out[0], 2.2); out[1] = Math.pow(out[1], 2.2); out[2] = Math.pow(out[2], 2.2); return out;
}
// ---------- the ground mesh ----------
const CHUNK = 100, CHN = WORLD_SIZE / CHUNK; // 16 x 16 chunks
function buildChunkGeo(ci, cj, step) {
  const cells = CHUNK / CELL / step, n = cells + 1, i0 = ci * (CHUNK / CELL), j0 = cj * (CHUNK / CELL);
  const skirt = 4 * n; const vcount = n * n + skirt * 2;
  const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3), col = new Float32Array(vcount * 3), uv = new Float32Array(vcount * 2);
  const H = TER.h, c = [0, 0, 0];
  let v = 0;
  const put = (gi, gj, dy) => {
    gi = clamp(gi, 0, GN - 1); gj = clamp(gj, 0, GN - 1); const k = gj * GN + gi, x = -HALF + gi * CELL, z = -HALF + gj * CELL;
    pos[v * 3] = x; pos[v * 3 + 1] = H[k] - dy; pos[v * 3 + 2] = z;
    const l = H[Math.max(0, gi - 1) + gj * GN], r = H[Math.min(GN - 1, gi + 1) + gj * GN], u = H[gi + Math.max(0, gj - 1) * GN], d = H[gi + Math.min(GN - 1, gj + 1) * GN];
    let nx = l - r, ny = 2 * CELL, nz = u - d; const L = Math.hypot(nx, ny, nz); nor[v * 3] = nx / L; nor[v * 3 + 1] = ny / L; nor[v * 3 + 2] = nz / L;
    groundColorLin(gi, gj, c); col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
    uv[v * 2] = x / 7; uv[v * 2 + 1] = z / 7; v++;
  };
  for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) put(i0 + a * step, j0 + b * step, 0);
  const idx = [];
  for (let b = 0; b < cells; b++) for (let a = 0; a < cells; a++) { const p = b * n + a; idx.push(p, p + n, p + 1, p + 1, p + n, p + n + 1); }
  // skirts hide cracks between chunks of different detail
  const edge = (list) => { const base = v; for (const [gi, gj] of list) put(gi, gj, 0); for (const [gi, gj] of list) put(gi, gj, 3 * step); for (let s = 0; s < list.length - 1; s++) { const a = base + s, bb = base + list.length + s; idx.push(a, bb, a + 1, a + 1, bb, bb + 1, a, a + 1, bb, a + 1, bb + 1, bb); } };
  const L = (fn) => { const out = []; for (let s = 0; s < n; s++) out.push(fn(s)); return out; };
  edge(L((s) => [i0 + s * step, j0])); edge(L((s) => [i0 + s * step, j0 + cells * step])); edge(L((s) => [i0, j0 + s * step])); edge(L((s) => [i0 + cells * step, j0 + s * step]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, v * 3), 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, v * 2), 2));
  g.setIndex(idx); g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
