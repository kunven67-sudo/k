
// =====================================================================
// OVERWORLD — the Vale, four regions, and your house. Fixed seeds, so
// every player gets the same world. Built on first visit, then cached.
// =====================================================================
const WORLDS = {};
const GATE_LINKS = { // gate side -> target map + arrival tile
  vale: { N: ['frostpeak', 40, 55], W: ['mirefen', 75, 30], S: ['sunscar', 40, 4], E: ['saltmarrow', 4, 30] },
  frostpeak: { S: ['vale', 47, 4] }, mirefen: { E: ['vale', 4, 36] }, sunscar: { N: ['vale', 47, 67] }, saltmarrow: { W: ['vale', 91, 36] },
};
function getWorld(id) {
  if (WORLDS[id]) return WORLDS[id];
  const fn = { vale: buildVale, mirefen: buildMirefen, frostpeak: buildFrostpeak, sunscar: buildSunscar, saltmarrow: buildSaltmarrow, home: buildHome }[id];
  return (WORLDS[id] = fn());
}
function newWorld(id, fill) {
  const R = REGIONS[id], m = makeMap(R.w, R.h, fill); m.kind = R.interior ? 'interior' : 'overworld'; m.biome = R.biome; m.id = id;
  return { id, name: R.name, biome: R.biome, map: m, props: [], npcs: [], entrances: [], gates: [], zones: R.zones || [], nightMons: R.night || [], safe: [], notes: [], spots: [], spawn: null, region: R, trees: null, tufts: null };
}
// --- shared building blocks ---
function wSet(Wd, tx, ty, t) { const m = Wd.map; if (tx >= 0 && ty >= 0 && tx < m.w && ty < m.h) m.t[ty * m.w + tx] = t; }
function wBlob(Wd, R, cx, cy, rad, t, dens, skip) {
  for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
    const d = Math.hypot(x - cx, y - cy) / rad; if (d > 1 || (skip && skip(x, y))) continue;
    if (R() < dens * (1.15 - d * 0.5)) wSet(Wd, x, y, t);
  }
}
const inRect = (r, tx, ty) => tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1;
function wSafe(Wd, tx, ty) { return Wd.safe.some((r) => inRect(r, tx, ty)); }
function wBorder(Wd, R, inner, outer) {
  const m = Wd.map;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const e = Math.min(x, y, m.w - 1 - x, m.h - 1 - y); if (e < 2 || (e === 2 && R() < 0.6)) wSet(Wd, x, y, e < 1 ? outer : inner); }
}
function wPlace(Wd, tx, ty, wT, hT, img, extra, noBlock) {
  const m = Wd.map;
  if (!noBlock) for (let y = ty; y < ty + hT; y++) for (let x = tx; x < tx + wT; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.block[y * m.w + x] = 1;
  const p = Object.assign({ x: tx * 16, y: (ty + hT) * 16, img, w: wT * 16, h: img.height }, extra); Wd.props.push(p); return p;
}
function wClear(Wd, cx, cy, r, ground) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (Math.hypot(x - cx, y - cy) > r + 0.2 || x < 2 || y < 2 || x >= Wd.map.w - 2 || y >= Wd.map.h - 2) continue;
    const t = tileAt(Wd.map, x, y); if (SOLID_T[t] || t === T.BOG || t === T.LAVA) wSet(Wd, x, y, ground);
  }
}
function wEntrance(Wd, d, ground) {
  const [ax, ay] = d.at; wClear(Wd, ax, ay, 4, ground);
  const img = bakeEntrance(d.look, d.theme.glow);
  const p = wPlace(Wd, ax - 1, ay - 1, 2, 2, img, { kind: 'entrance', dungeon: d.id });
  p.x = ax * 16 - img.width / 2; p.y = (ay + 1) * 16 + 2;
  const e = { d, x: ax * 16, y: (ay + 1) * 16 + 6, tx: ax, ty: ay + 1 }; Wd.entrances.push(e); return e;
}
function wGate(Wd, side, x0, y0, x1, y1, ground) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wSet(Wd, x, y, ground);
  // a short road inward so the gate is never boxed in
  const dx = side === 'W' ? 1 : side === 'E' ? -1 : 0, dy = side === 'N' ? 1 : side === 'S' ? -1 : 0;
  for (let k = 0; k < 4; k++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) wSet(Wd, x + dx * (k + 1) * (side === 'W' || side === 'E' ? 1 : 0), y + dy * (k + 1) * (side === 'N' || side === 'S' ? 1 : 0), ground);
  const [to, tx, ty] = GATE_LINKS[Wd.id][side];
  const g = { side, x0, y0, x1, y1, to, tx, ty, cx: ((x0 + x1 + 1) / 2) * 16, cy: ((y0 + y1 + 1) / 2) * 16 }; Wd.gates.push(g); return g;
}
function carvePath(m, from, to, opts = {}) {
  const W = m.w, H = m.h, N = W * H, cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap = []; const push = (i, c) => { heap.push([c, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let s = k; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };
  const s = from[1] * W + from[0], g = to[1] * W + to[0];
  cost[s] = 0; push(s, 0);
  while (heap.length) {
    const [c, i] = pop(); if (c > cost[i]) continue; if (i === g) break;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 1 || ny < 1 || nx >= W - 2 || ny >= H - 2) continue;
      const j = ny * W + nx; if (m.block[j] || m.block[j + 1] || m.block[j + W] || m.block[j + W + 1]) continue;
      const t = m.t[j];
      let step = 1 + hash2(nx, ny, 7) * 0.8;
      if (t === T.WATER || t === T.OCEAN) step += 6; else if (t === T.BOG) step += 2; else if (SOLID_T[t]) step += 1.5; else if (t === T.PATH || t === T.PLAZA || t === T.BRIDGE) step = 0.35;
      const nc = c + step; if (nc < cost[j]) { cost[j] = nc; prev[j] = i; push(j, nc); }
    }
  }
  const road = opts.road || T.PATH;
  let i = g, guard = 0;
  while (i !== -1 && guard++ < N) {
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const j = (y + dy) * W + (x + dx); if (m.block[j]) continue;
      const t = m.t[j]; if (t === T.PLAZA || t === T.DOCK) continue;
      m.t[j] = t === T.WATER || t === T.BRIDGE || t === T.OCEAN || t === T.SHALLOW || t === T.BOG ? T.BRIDGE : road;
    }
    i = prev[i];
  }
}
function wNpc(Wd, o) {
  const n = Object.assign({ wander: 0, face: 1, walk: 0, moving: false, wait: Math.random() * 3, blinkT: Math.random() * 4, breatheT: Math.random() * 3, pose: null, poseT: 0, waveT: 0, chatT: 0 }, o);
  n.home = n.home || [n.x, n.y]; n.tx = n.x; n.ty = n.y; Wd.npcs.push(n); return n;
}
function wFinish(Wd) {
  const m = Wd.map; renderLayer(m, null);
  // trees and grass tufts are drawn live; bucket them by row
  Wd.trees = []; Wd.tufts = [];
  for (let ty = 0; ty < m.h; ty++) {
    const tr = [], tf = [];
    for (let tx = 0; tx < m.w; tx++) {
      const t = m.t[ty * m.w + tx], k = TREE_KIND[t];
      if (k) tr.push({ x: tx * 16 + 8, y: ty * 16 + 15, kind: k, v: Math.floor(hash2(tx, ty, 3) * 4), ph: hash2(tx, ty, 5) * TAU });
      else if ((t === T.GRASS || t === T.DGRASS || t === T.FLOWERS || (t === T.SAND && Wd.biome === 'desert') || (t === T.MUD && Wd.biome === 'swamp')) && !m.block[ty * m.w + tx] && hash2(tx, ty, 11) < (t === T.SAND ? 0.08 : 0.32))
        tf.push({ x: tx * 16 + 2 + Math.floor(hash2(tx, ty, 12) * 10), y: ty * 16 + 5 + Math.floor(hash2(tx, ty, 13) * 10), ph: hash2(tx, ty, 14) * TAU });
    }
    Wd.trees.push(tr); Wd.tufts.push(tf);
  }
  const [c, x] = mkCanvas(m.w, m.h);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { x.fillStyle = m.block[ty * m.w + tx] ? '#c8a06a' : TILE_COL[m.t[ty * m.w + tx]] || '#000'; x.fillRect(tx, ty, 1, 1); }
  Wd.mini = c;
  return Wd;
}
const LOOKS = {
  mara: { skin: '#f0c08a', hair: '#a3322c', hairStyle: 1, shirt: '#7a4a9a', shirtDark: '#5a2e7a', pants: '#3a2a4a', shoes: '#2a1a10', apron: '#efe4cc', blush: '#e89a8a' },
  brom: { skin: '#c8885a', hair: '#2a1a10', hairStyle: 2, beard: '#3a2616', shirt: '#7a4a24', shirtDark: '#5a3418', pants: '#3a2a1a', shoes: '#1a120a', apron: '#44464b' },
  tobin: { skin: '#e8b88a', hair: '#efe4cc', hairStyle: 2, beard: '#efe4cc', robe: '#3e6cb8', shirt: '#3e6cb8', shoes: '#2a1a10', hat: '#2c4e88' },
  hollis: { skin: '#d8a070', hair: '#c8902a', hairStyle: 4, shirt: '#5a8a3a', shirtDark: '#3d6a2a', pants: '#5a4a3a', shoes: '#2a1a10', vest: '#8a5a2b' },
  pip: { skin: '#8a5a3a', hair: '#1a120a', hairStyle: 0, shirt: '#d8454a', shirtDark: '#a3242a', pants: '#3a3a5a', shoes: '#1a1a1a' },
  wren: { skin: '#f0c08a', hair: '#f2c13a', hairStyle: 1, shirt: '#5cc46e', shirtDark: '#3d8a4a', pants: '#5a4a3a', shoes: '#2a1a10' },
  oskar: { skin: '#d8a070', hair: '#5a3417', hairStyle: 3, shirt: '#e0a03a', shirtDark: '#b07a1a', pants: '#3a2a1a', shoes: '#1a120a' },
  lena: { skin: '#6a4028', hair: '#2a1a10', hairStyle: 4, shirt: '#4ea1e3', shirtDark: '#2a6fa0', pants: '#2a2a3a', shoes: '#111111' },
  morra: { skin: '#a8b890', hair: '#cfc6b4', hairStyle: 1, robe: '#3a4a2a', shirt: '#3a4a2a', shoes: '#1a1a10', hat: '#2a3a1a' },
  sigrid: { skin: '#f6d2a8', hair: '#e8d090', hairStyle: 4, shirt: '#a8988a', shirtDark: '#8a7a6a', pants: '#5a4a3a', shoes: '#3a2a1a', fur: '#efe4cc' },
  rashid: { skin: '#a87048', hair: '#1a120a', hairStyle: 2, beard: '#1a120a', robe: '#e8d8b0', shirt: '#e8d8b0', shoes: '#6a4a2a', hood: '#c8a458' },
  vey: { skin: '#c8885a', hair: '#1a1a1a', hairStyle: 2, beard: '#3a2616', shirt: '#efe4cc', shirtDark: '#cfc6b4', vest: '#3e6cb8', pants: '#2a2a3a', shoes: '#1a1a1a', tricorn: '#1a1a1a' },
  nell: { skin: '#e8b88a', hair: '#7a4a24', hairStyle: 1, shirt: '#2a8a8a', shirtDark: '#1a6a6a', pants: '#5a4a3a', shoes: '#2a1a10', bandana: '#f2c13a' },
  salty: { skin: '#b07a50', hairStyle: 2, bandana: '#d8454a', shirt: '#efe4cc', shirtDark: '#cfc6b4', vest: '#5a3418', pants: '#3a3a5a', shoes: '#1a1a1a', beard: '#5a3417' },
};

// ---------------- the Vale ----------------
const TOWN = { x0: 37, y0: 26, x1: 59, y1: 46 };
function buildVale() {
  const R = mulberry32(20261002), Wd = newWorld('vale', T.GRASS), m = Wd.map, W = m.w, H = m.h;
  const get = (x, y) => tileAt(m, x, y);
  const avoidTown = (x, y) => inRect(TOWN, x, y);
  for (let i = 0; i < W * H; i++) { const r = R(); if (r < 0.035) m.t[i] = T.FLOWERS; else if (r < 0.12) m.t[i] = T.DGRASS; }
  for (let i = 0; i < 14; i++) wBlob(Wd, R, R() * W, R() * H, 3 + R() * 4, T.DGRASS, 0.9, avoidTown);
  for (let i = 0; i < 26; i++) { const cx = 4 + R() * (W - 8), cy = 4 + R() * (H - 8); if (Math.hypot(cx - 48, cy - 36) < 16) continue; wBlob(Wd, R, cx, cy, 2.5 + R() * 4.5, R() < 0.2 ? T.PINE : T.TREE, 0.85, avoidTown); }
  for (const [cx, cy, r] of [[62, 56, 5.5], [33, 46, 4.2], [70, 33, 3.6], [44, 12, 4]]) { wBlob(Wd, R, cx, cy, r, T.WATER, 1.4); wBlob(Wd, R, cx + 1.5, cy - 1, r * 0.7, T.WATER, 1.4); }
  for (const [cx, cy, r] of [[86, 9, 7], [8, 9, 6], [92, 40, 4], [4, 34, 4], [50, 66, 4]]) wBlob(Wd, R, cx, cy, r, T.ROCK, 0.8);
  const shore = () => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = get(x, y); if (isWaterish(t) || SOLID_T[t]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === T.WATER)) wSet(Wd, x, y, T.SHALLOW); } };
  shore(); // shallows ring the lakes so you can wade in
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = get(x, y); if (isWaterish(t) || SOLID_T[t]) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === T.SHALLOW)) wSet(Wd, x, y, T.SAND); }
  wBorder(Wd, R, T.TREE, T.ROCK);
  // town
  for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) wSet(Wd, x, y, R() < 0.06 ? T.FLOWERS : T.GRASS);
  for (let y = 32; y <= 40; y++) for (let x = 42; x <= 54; x++) wSet(Wd, x, y, T.PLAZA);
  Wd.safe.push(TOWN);
  const store = wPlace(Wd, 39, 28, 4, 3, bakeBuilding(4, 3, { wall: '#c8a06a', wallLine: '#a3804a', roof: '#a3322c', roofLine: '#7a1a1e', door: '#7a4a24', sign: 'potion', beams: true }), { kind: 'store' });
  const forge = wPlace(Wd, 53, 28, 4, 3, bakeBuilding(4, 3, { wall: '#7d7f86', wallLine: '#5d6470', roof: '#44464b', roofLine: '#2a2c30', door: '#4a2e14', sign: 'anvil', chimney: true }), { kind: 'forge', smoke: true });
  const home = wPlace(Wd, 38, 42, 3, 3, bakeBuilding(3, 3, { wall: '#d8c08a', wallLine: '#b09a64', roof: '#3e6cb8', roofLine: '#2c4e88', door: '#7a4a24', sign: 'home', chimney: true }), { kind: 'home', smoke: true });
  const petshop = wPlace(Wd, 43, 43, 4, 3, bakeBuilding(4, 3, { wall: '#e0d0b0', wallLine: '#bba98a', roof: '#5a8a4a', roofLine: '#3d6a32', door: '#5a3418', sign: 'paw', beams: true }), { kind: 'pets' });
  const h1 = wPlace(Wd, 56, 42, 3, 3, bakeBuilding(3, 3, { wall: '#c8a06a', wallLine: '#a3804a', roof: '#7a4a9a', roofLine: '#5a2e7a', door: '#5a3418' }), { kind: 'house' });
  const h2 = wPlace(Wd, 51, 42, 3, 3, bakeBuilding(3, 3, { wall: '#e0d0b0', wallLine: '#bba98a', roof: '#a3322c', roofLine: '#7a1a1e', door: '#7a4a24', chimney: true }), { kind: 'house', smoke: true });
  wPlace(Wd, 47, 35, 2, 2, bakeFountainImg(), { kind: 'fountain' });
  wPlace(Wd, 57, 31, 1, 1, bakeAnvil(), { kind: 'anvil' });
  for (const [lx, ly] of [[42, 31], [55, 31], [41, 41], [55, 41], [48, 27], [37, 36], [59, 36], [48, 46]]) wPlace(Wd, lx, ly, 1, 1, PROP.lamp, { kind: 'lamp', lamp: true, x: lx * 16 + 4, y: ly * 16 + 14 }, true);
  for (const [bx, by] of [[44, 29], [52, 29]]) wPlace(Wd, bx, by, 1, 1, PROP.barrel, { kind: 'deco', x: bx * 16 + 3, y: by * 16 + 14 });
  wPlace(Wd, 58, 30, 1, 1, PROP.crate, { kind: 'deco', x: 58 * 16 + 2, y: 30 * 16 + 14 });
  // graveyard (Dad's grave holds a note)
  for (const [gx, gy] of [[61, 47], [63, 47], [65, 47], [67, 47], [61, 50], [65, 50], [67, 50], [62, 53], [66, 53]]) { wSet(Wd, gx, gy, T.DGRASS); wPlace(Wd, gx, gy, 1, 1, R() < 0.3 ? PROP.cross : PROP.grave, { kind: 'grave', x: gx * 16 + 3, y: gy * 16 + 15 }); }
  for (let y = 45; y <= 55; y++) for (let x = 60; x <= 68; x++) if (get(x, y) === T.TREE || get(x, y) === T.WATER || get(x, y) === T.PINE) wSet(Wd, x, y, T.DGRASS);
  wSet(Wd, 63, 50, T.DGRASS); wPlace(Wd, 63, 50, 1, 1, PROP.dadgrave, { kind: 'dadgrave', x: 63 * 16 + 1, y: 50 * 16 + 16 });
  Wd.spots.push({ kind: 'dadgrave', x: 63 * 16 + 8, y: 51 * 16 + 6 });
  // dungeon entrances
  for (const d of DUNGEONS) if (d.map === 'vale') wEntrance(Wd, d, T.GRASS);
  // gates to the four lands (closed with barricades until act 2)
  const gN = wGate(Wd, 'N', 46, 0, 49, 1, T.PATH), gW = wGate(Wd, 'W', 0, 34, 1, 37, T.PATH), gS = wGate(Wd, 'S', 46, 70, 49, 71, T.PATH), gE = wGate(Wd, 'E', 94, 34, 95, 37, T.PATH);
  // roads
  const plazaEdge = (tx, ty) => (tx < 42 ? [42, 36] : tx > 54 ? [54, 36] : ty < 36 ? [48, 32] : [48, 40]);
  for (const e of Wd.entrances) carvePath(m, plazaEdge(e.tx, e.ty), [e.tx - 1, e.ty]);
  carvePath(m, [48, 32], [47, 3]); carvePath(m, [42, 36], [3, 35]); carvePath(m, [48, 40], [47, 67]); carvePath(m, [54, 36], [91, 35]);
  carvePath(m, [54, 40], [62, 51]);
  for (const g of Wd.gates) { // barricades (not solid) mark the closed roads until act 2
    const [bx, by] = { N: [g.cx, 5 * 16], S: [g.cx, 69 * 16], W: [3 * 16 + 8, g.cy + 10], E: [92 * 16 + 8, g.cy + 10] }[g.side];
    Wd.props.push({ x: bx - 17, y: by, img: PROP.barricade, w: 34, h: 18, kind: 'barricade', gate: g.side });
  }
  // people
  const npc = (id, name, tx, ty, o) => wNpc(Wd, Object.assign({ id, name, x: tx * 16 + 8, y: ty * 16 + 12, look: LOOKS[id] }, o));
  npc('mara', 'Mara', 41, 31, { shop: 'store', job: 'work' });
  npc('brom', 'Brom', 56, 31, { shop: 'smith', job: 'hammer', face: 1 });
  npc('hollis', 'Hollis', 45, 46, { shop: 'pets' });
  npc('tobin', 'Elder Tobin', 45, 38, { wander: 50, home: [48 * 16, 36 * 16], talk: 'tobin' });
  npc('pip', 'Pip', 43, 34, { wander: 140, home: [48 * 16, 37 * 16], giver: 'pip', door: [57 * 16 + 24, 45 * 16] });
  npc('wren', 'Wren', 46, 38, { wander: 140, home: [48 * 16, 37 * 16], giver: 'wren', door: [52 * 16 + 24, 45 * 16] });
  npc('oskar', 'Oskar', 49, 34, { wander: 140, home: [48 * 16, 37 * 16], giver: 'oskar', door: [57 * 16 + 24, 45 * 16] });
  npc('lena', 'Lena', 52, 38, { wander: 140, home: [48 * 16, 37 * 16], giver: 'lena', door: [52 * 16 + 24, 45 * 16] });
  Wd.homeDoor = { x: 39 * 16 + 24, y: 45 * 16 + 6 };
  Wd.fountain = { x: 48 * 16, y: 36 * 16 + 8 };
  Wd.spawn = { x: Wd.homeDoor.x, y: Wd.homeDoor.y + 12 };
  return wFinish(Wd);
}
function bakeFountainImg() {
  const [c, x] = mkCanvas(32, 32);
  pcirc(x, 16, 21, 15, '#6e695f'); pcirc(x, 16, 20, 13.5, '#a8a294'); pcirc(x, 16, 20, 11, '#3a78b8');
  px(x, 14, 6, 4, 14, '#8f897c'); px(x, 12, 5, 8, 3, '#a8a294'); return c;
}
function bakeAnvil() { const [c, x] = mkCanvas(16, 12); px(x, 1, 2, 14, 4, '#44464b'); px(x, 0, 2, 4, 2, '#44464b'); px(x, 5, 6, 6, 3, '#3a3a40'); px(x, 3, 9, 10, 3, '#2a2a30'); px(x, 2, 2, 12, 1, '#6a6c72'); return c; }

// ---------------- Mirefen (haunted swamp) ----------------
function buildMirefen() {
  const R = mulberry32(31337), Wd = newWorld('mirefen', T.MUD), m = Wd.map, W = m.w, H = m.h;
  const safe = { x0: 56, y0: 18, x1: 72, y1: 34 }; Wd.safe.push(safe);
  const skip = (x, y) => inRect(safe, x, y);
  for (let i = 0; i < W * H; i++) if (R() < 0.55) m.t[i] = T.DGRASS;
  for (let i = 0; i < 16; i++) wBlob(Wd, R, R() * W, R() * H, 2 + R() * 4, T.BOG, 1.1, skip);
  for (let i = 0; i < 5; i++) { const cx = 6 + R() * (W - 12), cy = 6 + R() * (H - 12); wBlob(Wd, R, cx, cy, 2.5 + R() * 2, T.WATER, 1.3, skip); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = tileAt(m, x, y); if (t === T.WATER) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(m, x + dx, y + dy) === T.WATER)) wSet(Wd, x, y, T.SHALLOW); }
  for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (skip(x, y)) continue; const t = m.t[i]; if ((t === T.DGRASS || t === T.MUD) && R() < 0.11) m.t[i] = R() < 0.5 ? T.DEAD : T.WILLOW; }
  wBorder(Wd, R, T.WILLOW, T.DEAD);
  for (let y = safe.y0; y <= safe.y1; y++) for (let x = safe.x0; x <= safe.x1; x++) wSet(Wd, x, y, R() < 0.5 ? T.DGRASS : T.MUD);
  wGate(Wd, 'E', 78, 28, 79, 31, T.PATH);
  const hut = wPlace(Wd, 62, 22, 3, 3, bakeBuilding(3, 3, { wall: '#4a3a2a', wallLine: '#3a2a1a', roof: '#2a3a1a', roofLine: '#1a2a10', door: '#3a2a1a', stilts: true, chimney: true }), { kind: 'hut', smoke: true });
  wPlace(Wd, 66, 26, 1, 1, PROP.cauldron, { kind: 'cauldron', x: 66 * 16 + 1, y: 26 * 16 + 14, bubbles: true });
  for (const [lx, ly] of [[60, 27], [68, 23]]) wPlace(Wd, lx, ly, 1, 1, PROP.lamp, { kind: 'lamp', lamp: true, x: lx * 16 + 4, y: ly * 16 + 14 }, true);
  for (const d of DUNGEONS) if (d.map === 'mirefen') wEntrance(Wd, d, T.MUD);
  carvePath(m, [76, 29], [63, 27]); carvePath(m, [62, 28], [11, 31]);
  wNpc(Wd, { id: 'morra', name: 'Old Morra', x: 64 * 16, y: 27 * 16 + 12, look: LOOKS.morra, shop: 'morra', giver: 'morra' });
  Wd.notes.push({ id: 'n11', x: 55 * 16 + 8, y: 28 * 16 + 8 });
  Wd.spawn = { x: 75 * 16, y: 30 * 16 };
  return wFinish(Wd);
}
// ---------------- Frostpeak ----------------
function buildFrostpeak() {
  const R = mulberry32(42424), Wd = newWorld('frostpeak', T.SNOW), m = Wd.map, W = m.w, H = m.h;
  const safe = { x0: 33, y0: 42, x1: 47, y1: 54 }; Wd.safe.push(safe);
  const skip = (x, y) => inRect(safe, x, y);
  for (let i = 0; i < 22; i++) wBlob(Wd, R, 4 + R() * (W - 8), 4 + R() * (H - 8), 2.5 + R() * 4, T.SNOWPINE, 0.8, skip);
  for (let i = 0; i < 6; i++) wBlob(Wd, R, 6 + R() * (W - 12), 6 + R() * (H - 12), 3 + R() * 3.5, T.ICE, 1.3, skip);
  for (let i = 0; i < 10; i++) wBlob(Wd, R, R() * W, R() < 0.5 ? R() * 10 : 10 + R() * 40, 2 + R() * 4, T.SNOWROCK, 0.85, skip);
  wBorder(Wd, R, T.SNOWROCK, T.SNOWROCK);
  for (let y = safe.y0; y <= safe.y1; y++) for (let x = safe.x0; x <= safe.x1; x++) wSet(Wd, x, y, T.SNOW);
  wGate(Wd, 'S', 38, 58, 41, 59, T.PATH);
  wPlace(Wd, 36, 45, 2, 2, PROP.tent, { kind: 'tent', x: 36 * 16, y: 47 * 16 });
  wPlace(Wd, 43, 45, 2, 2, PROP.tent, { kind: 'tent', x: 43 * 16, y: 47 * 16 });
  wPlace(Wd, 40, 48, 1, 1, PROP.fire, { kind: 'fire', fire: true, x: 40 * 16, y: 48 * 16 + 10 });
  for (const d of DUNGEONS) if (d.map === 'frostpeak') wEntrance(Wd, d, T.SNOW);
  carvePath(m, [39, 56], [40, 50]); carvePath(m, [40, 47], [39, 10]);
  wNpc(Wd, { id: 'sigrid', name: 'Sigrid', x: 42 * 16, y: 49 * 16 + 8, look: LOOKS.sigrid, shop: 'sigrid', giver: 'sigrid' });
  Wd.notes.push({ id: 'n14', x: 20 * 16 + 8, y: 30 * 16 + 8 });
  Wd.campfire = { x: 40 * 16 + 8, y: 48 * 16 + 8 };
  Wd.spawn = { x: 40 * 16, y: 55 * 16 };
  return wFinish(Wd);
}
// ---------------- Sunscar (desert ruins) ----------------
function buildSunscar() {
  const R = mulberry32(55555), Wd = newWorld('sunscar', T.SAND), m = Wd.map, W = m.w, H = m.h;
  const safe = { x0: 31, y0: 7, x1: 51, y1: 21 }; Wd.safe.push(safe);
  const skip = (x, y) => inRect(safe, x, y);
  for (let i = 0; i < 18; i++) wBlob(Wd, R, R() * W, R() * H, 3 + R() * 5, T.DUNE, 0.9, skip);
  for (let i = 0; i < 8; i++) wBlob(Wd, R, R() * W, R() * H, 1.5 + R() * 2.5, T.ROCK, 0.8, skip);
  for (let i = 0; i < 18; i++) { // broken ruin walls
    let x = 4 + Math.floor(R() * (W - 8)), y = 4 + Math.floor(R() * (H - 8)); if (skip(x, y)) continue; const horiz = R() < 0.5, len = 3 + Math.floor(R() * 6);
    for (let k = 0; k < len; k++) { if (R() < 0.8 && !skip(x, y)) wSet(Wd, x, y, T.RUIN); if (horiz) x++; else y++; }
  }
  for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (!skip(x, y) && m.t[i] === T.SAND && R() < 0.035) m.t[i] = T.CACTUS; }
  wBorder(Wd, R, T.ROCK, T.ROCK);
  // oasis
  for (let y = safe.y0; y <= safe.y1; y++) for (let x = safe.x0; x <= safe.x1; x++) wSet(Wd, x, y, T.SAND);
  wBlob(Wd, R, 40, 13, 3.6, T.GRASS, 1.5); wBlob(Wd, R, 40, 13, 2.2, T.WATER, 2);
  for (let y = 8; y <= 18; y++) for (let x = 34; x <= 46; x++) { const t = tileAt(m, x, y); if (t === T.WATER) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(m, x + dx, y + dy) === T.WATER)) wSet(Wd, x, y, T.SHALLOW); }
  for (const [px2, py2] of [[35, 10], [45, 9], [36, 17], [46, 16], [34, 14]]) wSet(Wd, px2, py2, T.PALM);
  wGate(Wd, 'N', 38, 0, 41, 1, T.PATH);
  wPlace(Wd, 47, 11, 2, 2, PROP.tent, { kind: 'tent', x: 47 * 16, y: 13 * 16 });
  wPlace(Wd, 49, 15, 1, 1, PROP.fire, { kind: 'fire', fire: true, x: 49 * 16, y: 15 * 16 + 10 });
  for (const d of DUNGEONS) if (d.map === 'sunscar') wEntrance(Wd, d, T.SAND);
  carvePath(m, [39, 3], [44, 18], { road: T.SAND }); carvePath(m, [44, 18], [39, 52], { road: T.SAND });
  wNpc(Wd, { id: 'rashid', name: 'Rashid', x: 48 * 16, y: 14 * 16 + 8, look: LOOKS.rashid, shop: 'rashid', giver: 'rashid' });
  Wd.notes.push({ id: 'n17', x: 50 * 16, y: 17 * 16 });
  Wd.campfire = { x: 49 * 16 + 8, y: 15 * 16 + 8 };
  Wd.spawn = { x: 40 * 16, y: 4 * 16 };
  return wFinish(Wd);
}
// ---------------- Saltmarrow (pirate coast) ----------------
function buildSaltmarrow() {
  const R = mulberry32(77777), Wd = newWorld('saltmarrow', T.GRASS), m = Wd.map, W = m.w, H = m.h;
  const safe = { x0: 40, y0: 11, x1: 60, y1: 28 }; Wd.safe.push(safe);
  const skip = (x, y) => inRect(safe, x, y);
  for (let i = 0; i < W * H; i++) if (R() < 0.1) m.t[i] = T.DGRASS;
  for (let i = 0; i < 12; i++) { const cx = 4 + R() * 34, cy = 4 + R() * (H - 8); wBlob(Wd, R, cx, cy, 2 + R() * 4, T.TREE, 0.8, skip); }
  const coast = []; for (let y = 0; y < H; y++) coast[y] = Math.round(58 + Math.sin(y / 6) * 3 + Math.sin(y / 2.3) * 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = coast[y];
    if (x >= c + 5) wSet(Wd, x, y, T.OCEAN); else if (x >= c + 3) wSet(Wd, x, y, T.SHALLOW); else if (x >= c - 4) wSet(Wd, x, y, T.SAND);
  }
  for (let y = 2; y < H - 2; y++) for (let x = coast[y] - 4; x < coast[y] + 2; x++) if (R() < 0.05 && !skip(x, y)) wSet(Wd, x, y, T.PALM);
  wBorder(Wd, R, T.TREE, T.ROCK);
  for (let y = 0; y < H; y++) for (let x = coast[y] + 3; x < W; x++) wSet(Wd, x, y, x >= coast[y] + 5 ? T.OCEAN : T.SHALLOW); // sea runs off the map
  // harbour town
  for (let y = safe.y0; y <= safe.y1; y++) for (let x = safe.x0; x <= Math.min(safe.x1, coast[y] + 2); x++) if (!isWaterish(tileAt(m, x, y))) wSet(Wd, x, y, x > coast[y] - 4 ? T.SAND : T.GRASS);
  for (let y = 18; y <= 22; y++) for (let x = 44; x <= 52; x++) wSet(Wd, x, y, T.PLAZA);
  const tavern = wPlace(Wd, 43, 13, 4, 3, bakeBuilding(4, 3, { wall: '#8a6a4a', wallLine: '#6a4a2a', roof: '#3e6cb8', roofLine: '#2c4e88', door: '#5a3418', sign: 'mug', beams: true, chimney: true }), { kind: 'tavern', smoke: true });
  wPlace(Wd, 49, 13, 3, 3, bakeBuilding(3, 3, { wall: '#c8b08a', wallLine: '#a8906a', roof: '#a3322c', roofLine: '#7a1a1e', door: '#5a3418' }), { kind: 'house' });
  for (let x = coast[20] - 1; x < coast[20] + 14; x++) { wSet(Wd, x, 20, T.DOCK); wSet(Wd, x, 21, T.DOCK); }
  const dockEnd = coast[20] + 14;
  Wd.props.push({ x: dockEnd * 16 - 70, y: 19 * 16 + 4, img: PROP.ship, w: 76, h: 56, kind: 'ship', bob: true });
  for (let y = 15; y <= 18; y++) for (let x = dockEnd - 6; x <= dockEnd; x++) m.block[y * W + x] = 1;
  for (const [bx, by] of [[53, 19], [54, 19], [53, 23]]) wPlace(Wd, bx, by, 1, 1, PROP.barrel, { kind: 'deco', x: bx * 16 + 3, y: by * 16 + 14 });
  wPlace(Wd, 55, 23, 1, 1, PROP.crate, { kind: 'deco', x: 55 * 16 + 2, y: 23 * 16 + 14 });
  for (const [lx, ly] of [[43, 18], [53, 17], [43, 23], [50, 24]]) wPlace(Wd, lx, ly, 1, 1, PROP.lamp, { kind: 'lamp', lamp: true, x: lx * 16 + 4, y: ly * 16 + 14 }, true);
  for (const d of DUNGEONS) if (d.map === 'saltmarrow') wEntrance(Wd, d, T.SAND);
  wGate(Wd, 'W', 0, 28, 1, 31, T.PATH);
  carvePath(m, [3, 29], [44, 21]); carvePath(m, [48, 23], [61, 52], { road: T.SAND });
  wNpc(Wd, { id: 'vey', name: 'Captain Vey', x: 52 * 16, y: 21 * 16 + 8, look: LOOKS.vey, shop: 'vey' });
  wNpc(Wd, { id: 'nell', name: 'Nell', x: 46 * 16, y: 20 * 16, look: LOOKS.nell, wander: 60, giver: 'nell' });
  wNpc(Wd, { id: 'salty', name: 'Salty', x: 50 * 16, y: 19 * 16, look: LOOKS.salty, wander: 50, talkLines: ['Arr. The Galleon? Cursed. Every plank of her.', 'I once arm-wrestled a crab. Lost.'] });
  Wd.notes.push({ id: 'n20', x: 54 * 16, y: 22 * 16 });
  Wd.spawn = { x: 4 * 16, y: 30 * 16 };
  Wd.coast = coast;
  return wFinish(Wd);
}
// ---------------- your house ----------------
function buildHome() {
  const Wd = newWorld('home', T.WOOD), m = Wd.map;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (x === 0 || x === m.w - 1 || y <= 1 || y === m.h - 1) wSet(Wd, x, y, T.IWALL);
  wSet(Wd, 6, m.h - 1, T.WOOD); wSet(Wd, 7, m.h - 1, T.WOOD);
  wPlace(Wd, 2, 2, 1, 2, PROP.bed, { kind: 'bed', x: 2 * 16 + 1, y: 4 * 16 + 4 });
  wPlace(Wd, 4, 2, 1, 2, PROP.finnbed, { kind: 'finnbed', x: 4 * 16 + 1, y: 4 * 16 + 4 });
  wPlace(Wd, 9, 5, 2, 1, PROP.table, { kind: 'table', x: 9 * 16 + 6, y: 6 * 16 + 4 });
  wPlace(Wd, 10, 1, 2, 1, PROP.hearth, { kind: 'hearth', fire: true, x: 10 * 16 + 4, y: 2 * 16 + 2 });
  Wd.spots.push({ kind: 'bed', x: 2 * 16 + 8, y: 4 * 16 + 14 }, { kind: 'finnbed', x: 4 * 16 + 8, y: 4 * 16 + 14 }, { kind: 'table', x: 10 * 16 + 8, y: 6 * 16 + 14 });
  Wd.door = { x: 7 * 16, y: (m.h - 1) * 16 + 8 };
  Wd.campfire = { x: 11 * 16 + 4, y: 1 * 16 + 12 };
  Wd.spawn = { x: 7 * 16, y: (m.h - 2) * 16 + 4 };
  return wFinish(Wd);
}
