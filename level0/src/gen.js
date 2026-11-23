// LEVEL 0 world rules. Same answer everywhere for the same spot, so the rooms never change.
export const CELL = 2.5;          // meters per grid cell
export const H = 2.75;            // ceiling height
export const CH = 12;             // cells per chunk side
export const CHUNK = CELL * CH;   // 30 m
export const T = 0.12;            // wall thickness
export const MAP_RES = 4;         // light map texels per meter
export const MAP_PAD = CELL;      // light map covers one cell past each chunk side
export const MAP_SIZE = Math.round((CHUNK + 2 * MAP_PAD) * MAP_RES); // 140

export function hash(x, z, s) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const RUN = 7;
function runWall(line, along, seed) {
  const off = Math.floor(hash(line, 0, seed) * RUN);
  const t = along + off;
  const k = Math.floor(t / RUN);
  const pos = t - k * RUN;
  if (hash(line, k, seed + 1) >= 0.62) return false;
  const len = 2 + Math.floor(hash(line, k, seed + 2) * 4);
  return pos < len;
}

function spawnClear(x, z) { return x >= -1 && x <= 1 && z >= -1 && z <= 1; }

// wall on the line z (world z = z*CELL) from x*CELL to (x+1)*CELL
export function hEdge(x, z) {
  if (spawnClear(x, z) && spawnClear(x, z - 1)) return false;
  return runWall(z, x, 11);
}
// wall on the line x (world x = x*CELL) from z*CELL to (z+1)*CELL
export function vEdge(x, z) {
  if (spawnClear(x, z) && spawnClear(x - 1, z)) return false;
  return runWall(x + 100003, z, 23);
}
// square pillar on grid corner (x,z), only where no wall touches it
export function pillar(x, z) {
  if (spawnClear(x, z) || spawnClear(x - 1, z - 1)) return false;
  if (hash(x, z, 41) >= 0.025) return false;
  return !(hEdge(x, z) || hEdge(x - 1, z) || vEdge(x, z) || vEdge(x, z - 1));
}
export const PILLAR = 0.55;

// ceiling light in cell (x,z): checkerboard; 0 = none, 1 = on, 2 = dead
export function light(x, z) {
  if (((x + z) & 1) !== 0) return 0;
  if (x === 0 && z === 0) return 1;
  return hash(x, z, 57) < 0.06 ? 2 : 1;
}

// ---------- light map for one chunk (runs in the worker) ----------
export function buildLightMap(cx, cz) {
  const ox = cx * CHUNK - MAP_PAD, oz = cz * CHUNK - MAP_PAD;
  const N = MAP_SIZE, PAD = 12, M = N + 2 * PAD;   // extra texels so the blur is seamless
  const gx0 = Math.floor((ox - PAD / MAP_RES) / CELL) - 5, gz0 = Math.floor((oz - PAD / MAP_RES) / CELL) - 5;
  const GW = Math.ceil((M / MAP_RES) / CELL) + 11;
  const he = new Uint8Array(GW * GW), ve = new Uint8Array(GW * GW);
  for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) {
    he[j * GW + i] = hEdge(gx0 + i, gz0 + j) ? 1 : 0;
    ve[j * GW + i] = vEdge(gx0 + i, gz0 + j) ? 1 : 0;
  }
  const H_ = (x, z) => { const i = x - gx0, j = z - gz0; return (i < 0 || j < 0 || i >= GW || j >= GW) ? hEdge(x, z) : he[j * GW + i]; };
  const V_ = (x, z) => { const i = x - gx0, j = z - gz0; return (i < 0 || j < 0 || i >= GW || j >= GW) ? vEdge(x, z) : ve[j * GW + i]; };

  // walk the grid from a to b; true if no wall is crossed
  function visible(ax, az, bx, bz) {
    let x = ax / CELL, z = az / CELL; const X = bx / CELL, Z = bz / CELL;
    let ix = Math.floor(x), iz = Math.floor(z); const ex = Math.floor(X), ez = Math.floor(Z);
    const dx = X - x, dz = Z - z;
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : 1e9, tdz = dz !== 0 ? Math.abs(1 / dz) : 1e9;
    let tmx = dx !== 0 ? (sx > 0 ? (ix + 1 - x) : (x - ix)) * tdx : 1e9;
    let tmz = dz !== 0 ? (sz > 0 ? (iz + 1 - z) : (z - iz)) * tdz : 1e9;
    let guard = 0;
    while ((ix !== ex || iz !== ez) && guard++ < 64) {
      if (tmx < tmz) {
        const line = sx > 0 ? ix + 1 : ix;
        if (V_(line, iz)) return false;
        ix += sx; tmx += tdx;
      } else {
        const line = sz > 0 ? iz + 1 : iz;
        if (H_(ix, line)) return false;
        iz += sz; tmz += tdz;
      }
    }
    return true;
  }

  // lights near the area
  const R = 9.5;
  const lights = [];
  const lx0 = Math.floor((ox - PAD / MAP_RES - R) / CELL), lx1 = Math.floor((ox + M / MAP_RES + R) / CELL);
  const lz0 = Math.floor((oz - PAD / MAP_RES - R) / CELL), lz1 = Math.floor((oz + M / MAP_RES + R) / CELL);
  for (let z = lz0; z <= lz1; z++) for (let x = lx0; x <= lx1; x++) if (light(x, z) === 1) lights.push((x + 0.5) * CELL, (z + 0.5) * CELL);

  const direct = new Float32Array(M * M), wd = new Float32Array(M * M);
  const H4 = H * H * H * H, R2 = R * R;
  for (let j = 0; j < M; j++) {
    const pz = oz + (j - PAD + 0.5) / MAP_RES;
    for (let i = 0; i < M; i++) {
      const px = ox + (i - PAD + 0.5) / MAP_RES;
      let e = 0;
      for (let k = 0; k < lights.length; k += 2) {
        const lx = lights[k], lz = lights[k + 1];
        const ddx = px - lx, ddz = pz - lz, r2 = ddx * ddx + ddz * ddz;
        if (r2 > R2) continue;
        const d2 = r2 + H * H;
        const f = H4 / (d2 * d2);
        // two points along the tube length = softer shadow edges
        const v = (visible(px, pz, lx - 0.4, lz) ? 0.5 : 0) + (visible(px, pz, lx + 0.4, lz) ? 0.5 : 0);
        e += f * v;
      }
      direct[j * M + i] = e;
      // distance to nearest wall face (for darkening along the walls)
      const cxi = Math.floor(px / CELL), czi = Math.floor(pz / CELL);
      const fx = px - cxi * CELL, fz = pz - czi * CELL;
      let dmin = 9;
      if (V_(cxi, czi)) dmin = Math.min(dmin, fx - T / 2);
      if (V_(cxi + 1, czi)) dmin = Math.min(dmin, CELL - fx - T / 2);
      if (H_(cxi, czi)) dmin = Math.min(dmin, fz - T / 2);
      if (H_(cxi, czi + 1)) dmin = Math.min(dmin, CELL - fz - T / 2);
      // wall runs ending next to this cell
      if (fz < 0.6 && (V_(cxi, czi - 1))) dmin = Math.min(dmin, Math.hypot(fx, fz));
      if (fz < 0.6 && (V_(cxi + 1, czi - 1))) dmin = Math.min(dmin, Math.hypot(CELL - fx, fz));
      if (fz > CELL - 0.6 && (V_(cxi, czi + 1))) dmin = Math.min(dmin, Math.hypot(fx, CELL - fz));
      if (fz > CELL - 0.6 && (V_(cxi + 1, czi + 1))) dmin = Math.min(dmin, Math.hypot(CELL - fx, CELL - fz));
      if (fx < 0.6 && (H_(cxi - 1, czi))) dmin = Math.min(dmin, Math.hypot(fx, fz));
      if (fx < 0.6 && (H_(cxi - 1, czi + 1))) dmin = Math.min(dmin, Math.hypot(fx, CELL - fz));
      if (fx > CELL - 0.6 && (H_(cxi + 1, czi))) dmin = Math.min(dmin, Math.hypot(CELL - fx, fz));
      if (fx > CELL - 0.6 && (H_(cxi + 1, czi + 1))) dmin = Math.min(dmin, Math.hypot(CELL - fx, CELL - fz));
      wd[j * M + i] = Math.max(0, dmin);
    }
  }
  const blur = (src, r) => {
    const tmp = new Float32Array(M * M), out = new Float32Array(M * M), n = 2 * r + 1;
    for (let j = 0; j < M; j++) { let s = 0; for (let i = -r; i <= r; i++) s += src[j * M + Math.min(M - 1, Math.max(0, i))];
      for (let i = 0; i < M; i++) { tmp[j * M + i] = s / n; s += src[j * M + Math.min(M - 1, i + r + 1)] - src[j * M + Math.max(0, i - r)]; } }
    for (let i = 0; i < M; i++) { let s = 0; for (let j = -r; j <= r; j++) s += tmp[Math.min(M - 1, Math.max(0, j)) * M + i];
      for (let j = 0; j < M; j++) { out[j * M + i] = s / n; s += tmp[Math.min(M - 1, j + r + 1) * M + i] - tmp[Math.max(0, j - r) * M + i]; } }
    return out;
  };
  const soft = blur(blur(direct, 1), 1);
  const amb = blur(blur(blur(direct, 6), 6), 6);
  const out = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const s = (j + PAD) * M + (i + PAD), o = (j * N + i) * 4;
    out[o] = Math.min(255, soft[s] * 0.5 * 255);
    out[o + 1] = Math.min(255, amb[s] * 0.5 * 255);
    out[o + 2] = Math.min(255, Math.min(1, wd[s] / 0.6) * 255);
    out[o + 3] = 255;
  }
  return out;
}
