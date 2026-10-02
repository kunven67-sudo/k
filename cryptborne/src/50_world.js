
// ---------- tiles & maps ----------
const TILE = 16;
const T = { VOID: 0, GRASS: 1, PATH: 2, WATER: 3, TREE: 4, FLOWERS: 5, PLAZA: 6, SAND: 7, BRIDGE: 8, ROCK: 9, WALL: 10, FLOOR: 11, LAVA: 12, DGRASS: 13 };
const SOLID_T = new Uint8Array(16); [T.VOID, T.WATER, T.TREE, T.ROCK, T.WALL].forEach((t) => (SOLID_T[t] = 1));
function makeMap(w, h, fill) { return { w, h, t: new Uint8Array(w * h).fill(fill), block: new Uint8Array(w * h), layer: null, explored: null, flow: new Int16Array(w * h).fill(-1), flowKey: -1 }; }
const tileAt = (m, tx, ty) => (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? T.VOID : m.t[ty * m.w + tx]);
function solidAt(m, tx, ty) { if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true; const i = ty * m.w + tx; return SOLID_T[m.t[i]] === 1 || m.block[i] === 1; }
const hash2 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- tile painting ----------
function paintGrass(x, X, Y, tx, ty, base) {
  px(x, X, Y, 16, 16, base);
  for (let i = 0; i < 7; i++) { const r = hash2(tx, ty, i); const r2 = hash2(ty, tx, i + 9); px(x, X + Math.floor(r * 15), Y + Math.floor(r2 * 15), 1, i < 4 ? 2 : 1, i % 2 ? '#4f8f45' : '#356a32'); }
}
function paintTile(x, m, tx, ty, theme) {
  const X = tx * TILE, Y = ty * TILE, t = m.t[ty * m.w + tx], h = hash2(tx, ty);
  switch (t) {
    case T.GRASS: paintGrass(x, X, Y, tx, ty, '#3f7a3a'); break;
    case T.DGRASS: paintGrass(x, X, Y, tx, ty, '#376d34'); break;
    case T.FLOWERS: {
      paintGrass(x, X, Y, tx, ty, '#3f7a3a');
      const cols = ['#f2c13a', '#efe4cc', '#e0607a', '#b878ea'];
      for (let i = 0; i < 3; i++) { const fx = X + 2 + Math.floor(hash2(tx, ty, 20 + i) * 12), fy = Y + 2 + Math.floor(hash2(ty, tx, 30 + i) * 12); px(x, fx, fy, 2, 2, cols[Math.floor(hash2(tx, ty, 40 + i) * 4)]); px(x, fx, fy + 2, 1, 2, '#2f6a2a'); }
      break;
    }
    case T.PATH: {
      px(x, X, Y, 16, 16, '#9a7a4a');
      for (let i = 0; i < 6; i++) px(x, X + Math.floor(hash2(tx, ty, i + 50) * 15), Y + Math.floor(hash2(ty, tx, i + 60) * 15), 2, 1, i % 2 ? '#836540' : '#b08f5a');
      break;
    }
    case T.PLAZA: {
      px(x, X, Y, 16, 16, '#8f897c');
      px(x, X, Y + 7, 16, 1, '#6e695f'); px(x, X, Y + 15, 16, 1, '#6e695f');
      px(x, X + (ty % 2 ? 3 : 11), Y, 1, 7, '#6e695f'); px(x, X + (ty % 2 ? 11 : 3), Y + 8, 1, 7, '#6e695f');
      px(x, X + 1, Y + 1, 2, 1, '#a8a294');
      break;
    }
    case T.SAND: px(x, X, Y, 16, 16, '#d6c08a'); for (let i = 0; i < 5; i++) px(x, X + Math.floor(hash2(tx, ty, i + 70) * 15), Y + Math.floor(hash2(ty, tx, i + 80) * 15), 1, 1, '#b8a06a'); break;
    case T.WATER: {
      px(x, X, Y, 16, 16, '#2f5f9a');
      for (let i = 0; i < 2; i++) px(x, X + Math.floor(hash2(tx, ty, i + 90) * 10), Y + 3 + i * 7, 5, 1, '#4a7fc0');
      if (!SOLID_T[tileAt(m, tx, ty - 1)] || tileAt(m, tx, ty - 1) === T.TREE) px(x, X, Y, 16, 2, '#9fd0f0');
      break;
    }
    case T.BRIDGE: {
      px(x, X, Y, 16, 16, '#2f5f9a');
      const vertical = tileAt(m, tx, ty - 1) === T.BRIDGE || tileAt(m, tx, ty + 1) === T.BRIDGE || tileAt(m, tx, ty - 1) === T.PATH || tileAt(m, tx, ty + 1) === T.PATH;
      px(x, X, Y, 16, 16, '#8a5a2b');
      for (let i = 0; i < 4; i++) vertical ? px(x, X, Y + i * 4 + 3, 16, 1, '#5a3818') : px(x, X + i * 4 + 3, Y, 1, 16, '#5a3818');
      break;
    }
    case T.TREE: {
      paintGrass(x, X, Y, tx, ty, '#376d34');
      px(x, X + 6, Y + 10, 4, 6, '#5a3a1e'); px(x, X + 6, Y + 10, 1, 6, '#3a2410');
      const g = h < 0.5 ? ['#1f4a22', '#2e6a2e', '#3f8a3a'] : ['#1d4430', '#2a6040', '#3a7f52'];
      x.fillStyle = g[0]; x.beginPath(); x.arc(X + 8, Y + 7, 7.5, 0, TAU); x.fill();
      x.fillStyle = g[1]; x.beginPath(); x.arc(X + 7, Y + 6, 6, 0, TAU); x.fill();
      x.fillStyle = g[2]; x.fillRect(X + 4, Y + 3, 3, 2); x.fillRect(X + 9, Y + 5, 2, 2);
      break;
    }
    case T.ROCK: {
      px(x, X, Y, 16, 16, h < 0.5 ? '#5f6a4a' : '#6a6450');
      px(x, X + 1, Y + 3, 14, 12, '#55575d'); px(x, X + 2, Y + 2, 12, 11, '#7d7f86'); px(x, X + 3, Y + 3, 5, 3, '#a0a3aa'); px(x, X + 2, Y + 12, 12, 2, '#44464b');
      break;
    }
    case T.FLOOR: {
      px(x, X, Y, 16, 16, (tx + ty) % 2 ? theme.floor : theme.floor2);
      px(x, X, Y, 16, 1, 'rgba(0,0,0,.18)'); px(x, X, Y, 1, 16, 'rgba(0,0,0,.18)');
      if (h < 0.25) { px(x, X + 4, Y + 6, 4, 1, 'rgba(0,0,0,.25)'); px(x, X + 7, Y + 7, 1, 3, 'rgba(0,0,0,.25)'); }
      if (h > 0.85) px(x, X + 10, Y + 10, 2, 2, 'rgba(255,255,255,.06)');
      break;
    }
    case T.LAVA: {
      px(x, X, Y, 16, 16, '#b8381a');
      for (let i = 0; i < 3; i++) px(x, X + Math.floor(hash2(tx, ty, i) * 12), Y + Math.floor(hash2(ty, tx, i) * 12), 4, 3, '#ff8a2a');
      break;
    }
    case T.WALL: {
      const below = tileAt(m, tx, ty + 1);
      if (below === T.FLOOR || below === T.LAVA) { // wall face with bricks
        px(x, X, Y, 16, 16, theme.face); px(x, X, Y, 16, 3, theme.top);
        for (let r = 0; r < 3; r++) { const yy = Y + 3 + r * 4 + 3; px(x, X, yy, 16, 1, theme.wall); const off = (r + tx) % 2 ? 4 : 12; px(x, X + off, yy - 3, 1, 3, theme.wall); }
        px(x, X, Y + 15, 16, 1, 'rgba(0,0,0,.45)');
      } else {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const n = tileAt(m, tx + dx, ty + dy); if (n === T.FLOOR || n === T.LAVA) { near = true; break; } }
        px(x, X, Y, 16, 16, near ? theme.wall : '#07050a');
        if (near) { px(x, X + 2, Y + 3, 3, 1, theme.top); px(x, X + 9, Y + 10, 3, 1, theme.top); }
      }
      break;
    }
    default: px(x, X, Y, 16, 16, '#07050a');
  }
}
function renderLayer(m, theme) {
  const [c, x] = mkCanvas(m.w * TILE, m.h * TILE);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) paintTile(x, m, tx, ty, theme);
  m.layer = c; return c;
}

// ---------- buildings & landmarks (baked once) ----------
function bakeBuilding(wT, hT, o) {
  const W = wT * 16, H = hT * 16 + 18; const [c, x] = mkCanvas(W, H);
  const roofH = Math.floor(H * 0.5);
  px(x, 3, roofH - 2, W - 6, H - roofH + 2, o.wall);
  for (let yy = roofH + 4; yy < H - 2; yy += 5) px(x, 3, yy, W - 6, 1, o.wallLine);
  px(x, 3, H - 3, W - 6, 3, o.wallLine);
  for (let r = 0; r < roofH; r++) { const inset = Math.max(0, Math.floor((roofH - r) * 0.35) - 2); px(x, inset, r, W - inset * 2, 1, r % 4 === 3 ? o.roofLine : o.roof); }
  px(x, 0, roofH - 2, W, 2, o.roofLine);
  const dw = 12, dx = Math.floor(W / 2 - dw / 2);
  px(x, dx - 1, H - 18, dw + 2, 18, '#2a1a10'); px(x, dx, H - 17, dw, 17, o.door); px(x, dx + dw - 3, H - 9, 2, 2, '#f2c13a');
  const winY = H - 16;
  for (const wx of [8, W - 18]) { if (wx + 10 > dx - 2 && wx < dx + dw + 2) continue; px(x, wx - 1, winY - 1, 12, 10, '#2a1a10'); px(x, wx, winY, 10, 8, '#ffd27a'); px(x, wx + 4, winY, 2, 8, '#2a1a10'); px(x, wx, winY + 3, 10, 1, '#2a1a10'); }
  if (o.sign) {
    const sx = Math.floor(W / 2 - 9), sy = roofH + 1;
    px(x, sx, sy, 18, 10, '#5a3418'); px(x, sx + 1, sy + 1, 16, 8, '#c8a06a');
    if (o.sign === 'potion') { px(x, sx + 7, sy + 2, 4, 1, '#5a3418'); px(x, sx + 6, sy + 3, 6, 5, '#d8454a'); px(x, sx + 7, sy + 4, 2, 1, '#ff9a9a'); }
    else { px(x, sx + 4, sy + 3, 10, 2, '#44464b'); px(x, sx + 7, sy + 5, 4, 2, '#44464b'); px(x, sx + 5, sy + 7, 8, 1, '#44464b'); }
  }
  if (o.chimney) { px(x, W - 16, 2, 7, roofH - 6, '#55575d'); px(x, W - 17, 0, 9, 3, '#44464b'); }
  return c;
}
function bakeCave(theme) {
  const [c, x] = mkCanvas(36, 34);
  const rock = ['#55575d', '#6a6c72', '#7d7f86', '#44464b'];
  x.fillStyle = rock[0]; x.beginPath(); x.ellipse(18, 22, 17, 13, 0, Math.PI, 0); x.fill(); x.fillRect(1, 22, 34, 12);
  x.fillStyle = rock[1]; x.beginPath(); x.ellipse(17, 20, 14, 11, 0, Math.PI, 0); x.fill();
  px(x, 6, 12, 5, 3, rock[2]); px(x, 22, 10, 6, 3, rock[2]); px(x, 28, 18, 4, 2, rock[2]);
  x.fillStyle = '#07050a'; x.beginPath(); x.ellipse(18, 26, 9, 10, 0, Math.PI, 0); x.fill(); x.fillRect(9, 26, 18, 8);
  x.globalAlpha = 0.35; x.fillStyle = theme.glow; x.fillRect(12, 26, 12, 8); x.globalAlpha = 1;
  px(x, 7, 30, 3, 4, rock[3]); px(x, 26, 30, 3, 4, rock[3]);
  return c;
}
function bakeFountain() {
  const [c, x] = mkCanvas(32, 32);
  x.fillStyle = '#6e695f'; x.beginPath(); x.ellipse(16, 21, 15, 10, 0, 0, TAU); x.fill();
  x.fillStyle = '#a8a294'; x.beginPath(); x.ellipse(16, 20, 14, 9, 0, 0, TAU); x.fill();
  x.fillStyle = '#3a78b8'; x.beginPath(); x.ellipse(16, 20, 11, 6.5, 0, 0, TAU); x.fill();
  px(x, 14, 6, 4, 14, '#8f897c'); px(x, 12, 5, 8, 3, '#a8a294'); px(x, 15, 2, 2, 4, '#9fd0f0');
  return c;
}

// ---------- overworld (fixed seed so everybody's Emberfall looks the same) ----------
const TOWN = { x0: 37, y0: 26, x1: 59, y1: 46 };
function inTown(tx, ty) { return tx >= TOWN.x0 && tx <= TOWN.x1 && ty >= TOWN.y0 && ty <= TOWN.y1; }
function carvePathsDijkstra(m, from, to, R) {
  const W = m.w, H = m.h, N = W * H, cost = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap = []; const push = (i, c) => { heap.push([c, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let s = k; if (l < heap.length && heap[l][0] < heap[s][0]) s = l; if (r < heap.length && heap[r][0] < heap[s][0]) s = r; if (s === k) break; [heap[s], heap[k]] = [heap[k], heap[s]]; k = s; } } return top; };
  const s = from[1] * W + from[0], g = to[1] * W + to[0];
  cost[s] = 0; push(s, 0);
  while (heap.length) {
    const [c, i] = pop(); if (c > cost[i]) continue; if (i === g) break;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 2 || ny < 2 || nx >= W - 3 || ny >= H - 3) continue;
      const j = ny * W + nx; if (m.block[j] || m.block[j + 1] || m.block[j + W] || m.block[j + W + 1]) continue;
      const t = m.t[j];
      let step = 1 + hash2(nx, ny, 7) * 0.8;
      if (t === T.WATER) step += 4; else if (t === T.TREE) step += 0.9; else if (t === T.ROCK) step += 2.5; else if (t === T.PATH || t === T.PLAZA) step = 0.35;
      const nc = c + step; if (nc < cost[j]) { cost[j] = nc; prev[j] = i; push(j, nc); }
    }
  }
  let i = g, guard = 0;
  while (i !== -1 && guard++ < N) {
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const j = (y + dy) * W + (x + dx); if (m.block[j]) continue;
      const t = m.t[j];
      if (t === T.PLAZA) continue;
      m.t[j] = t === T.WATER || t === T.BRIDGE ? T.BRIDGE : T.PATH;
    }
    i = prev[i];
  }
}
function buildOverworld() {
  const R = mulberry32(20261002), W = 96, H = 72;
  const m = makeMap(W, H, T.GRASS); m.kind = 'overworld';
  const set = (tx, ty, t) => { if (tx >= 0 && ty >= 0 && tx < W && ty < H) m.t[ty * W + tx] = t; };
  const get = (tx, ty) => tileAt(m, tx, ty);
  const blob = (cx, cy, rad, t, dens, avoidTown = true) => {
    for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
      const d = Math.hypot(x - cx, y - cy) / rad; if (d > 1) continue; if (avoidTown && inTown(x, y)) continue;
      if (R() < dens * (1.15 - d * 0.5)) set(x, y, t);
    }
  };
  for (let i = 0; i < W * H; i++) { const r = R(); if (r < 0.035) m.t[i] = T.FLOWERS; else if (r < 0.12) m.t[i] = T.DGRASS; }
  for (let i = 0; i < 14; i++) blob(R() * W, R() * H, 3 + R() * 4, T.DGRASS, 0.9);
  for (let i = 0; i < 26; i++) { const cx = 4 + R() * (W - 8), cy = 4 + R() * (H - 8); if (Math.hypot(cx - 48, cy - 36) < 16) continue; blob(cx, cy, 2.5 + R() * 4.5, T.TREE, 0.85); }
  for (const [cx, cy, r] of [[62, 56, 5.5], [33, 46, 4.2], [70, 33, 3.6], [44, 12, 4]]) { blob(cx, cy, r, T.WATER, 1.4); blob(cx + 1.5, cy - 1, r * 0.7, T.WATER, 1.4); }
  for (const [cx, cy, r] of [[86, 9, 7], [8, 9, 6], [92, 40, 4], [4, 34, 4], [50, 66, 4]]) blob(cx, cy, r, T.ROCK, 0.8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { // sand around water
    if (get(x, y) === T.WATER) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(x + dx, y + dy) === T.WATER) && get(x, y) !== T.TREE && get(x, y) !== T.ROCK) set(x, y, T.SAND);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { // border wall of trees
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (e < 2 || (e === 2 && R() < 0.6)) set(x, y, e < 1 ? T.ROCK : T.TREE);
  }
  // town
  for (let y = TOWN.y0; y <= TOWN.y1; y++) for (let x = TOWN.x0; x <= TOWN.x1; x++) set(x, y, R() < 0.06 ? T.FLOWERS : T.GRASS);
  for (let y = 32; y <= 40; y++) for (let x = 42; x <= 54; x++) set(x, y, T.PLAZA);
  const props = [], npcs = [];
  const place = (tx, ty, wT, hT, img, extra) => {
    for (let y = ty; y < ty + hT; y++) for (let x = tx; x < tx + wT; x++) m.block[y * W + x] = 1;
    const p = Object.assign({ x: tx * 16, y: (ty + hT) * 16, img, w: wT * 16, h: img.height }, extra); props.push(p); return p;
  };
  place(39, 28, 4, 3, bakeBuilding(4, 3, { wall: '#c8a06a', wallLine: '#a3804a', roof: '#a3322c', roofLine: '#7a1a1e', door: '#7a4a24', sign: 'potion' }), { kind: 'store' });
  place(53, 28, 4, 3, bakeBuilding(4, 3, { wall: '#7d7f86', wallLine: '#5d6470', roof: '#44464b', roofLine: '#2a2c30', door: '#4a2e14', sign: 'anvil', chimney: true }), { kind: 'forge', smoke: true });
  place(38, 42, 3, 3, bakeBuilding(3, 3, { wall: '#d8c08a', wallLine: '#b09a64', roof: '#3e6cb8', roofLine: '#2c4e88', door: '#7a4a24' }), { kind: 'house' });
  place(56, 42, 3, 3, bakeBuilding(3, 3, { wall: '#c8a06a', wallLine: '#a3804a', roof: '#5a8a4a', roofLine: '#3d6a32', door: '#5a3418' }), { kind: 'house' });
  place(51, 42, 3, 3, bakeBuilding(3, 3, { wall: '#e0d0b0', wallLine: '#bba98a', roof: '#7a4a9a', roofLine: '#5a2e7a', door: '#7a4a24' }), { kind: 'house' });
  place(47, 35, 2, 2, bakeFountain(), { kind: 'fountain' });
  // dungeon entrances: clear a yard, then block the cave itself
  const entrances = [];
  for (const d of DUNGEONS) {
    const [ax, ay] = d.at;
    for (let y = ay - 4; y <= ay + 4; y++) for (let x = ax - 4; x <= ax + 4; x++) { if (Math.hypot(x - ax, y - ay) > 4.2) continue; const t = get(x, y); if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue; if (t === T.TREE || t === T.ROCK || t === T.WATER) set(x, y, T.GRASS); }
  }
  for (const d of DUNGEONS) {
    const [ax, ay] = d.at;
    const p = place(ax - 1, ay - 1, 2, 2, bakeCave(d.theme), { kind: 'cave', dungeon: d.id });
    p.x -= 2; p.y += 2; // the cave art is 36px wide and sits slightly lower than its footprint
    entrances.push({ d, x: ax * 16, y: (ay + 1) * 16 + 6, tx: ax, ty: ay + 1 });
  }
  // roads from the plaza to every cave (they avoid buildings and prefer land)
  for (const e of entrances) {
    const start = e.tx < 42 ? [42, 36] : e.tx > 54 ? [54, 36] : e.ty < 36 ? [48, 32] : [48, 40];
    carvePathsDijkstra(m, start, [e.tx - 1, e.ty], R);
  }
  // villagers & merchants (everyone gets a body)
  npcs.push({ id: 'mara', name: 'Mara', shop: 'store', x: 41 * 16, y: 31 * 16 + 12, home: [41 * 16, 31 * 16 + 12], wander: 0, look: { skin: '#f0c08a', hair: '#a3322c', hairStyle: 1, shirt: '#7a4a9a', shirtDark: '#5a2e7a', pants: '#3a2a4a', shoes: '#2a1a10', apron: '#efe4cc', blush: '#e89a8a' } });
  npcs.push({ id: 'brom', name: 'Brom', shop: 'smith', x: 55 * 16, y: 31 * 16 + 12, home: [55 * 16, 31 * 16 + 12], wander: 0, look: { skin: '#c8885a', hair: '#2a1a10', hairStyle: 2, beard: '#3a2616', shirt: '#7a4a24', shirtDark: '#5a3418', pants: '#3a2a1a', shoes: '#1a120a', apron: '#44464b' } });
  npcs.push({ id: 'tobin', name: 'Elder Tobin', x: 45 * 16, y: 38 * 16, home: [48 * 16, 36 * 16], wander: 50, look: { skin: '#e8b88a', hair: '#efe4cc', hairStyle: 2, beard: '#efe4cc', robe: '#3e6cb8', shirt: '#3e6cb8', shoes: '#2a1a10', hat: '#2c4e88' } });
  const vLooks = [
    { skin: '#8a5a3a', hair: '#1a120a', hairStyle: 0, shirt: '#d8454a', shirtDark: '#a3242a', pants: '#3a3a5a', shoes: '#1a1a1a' },
    { skin: '#f0c08a', hair: '#f2c13a', hairStyle: 1, shirt: '#5cc46e', shirtDark: '#3d8a4a', pants: '#5a4a3a', shoes: '#2a1a10' },
    { skin: '#d8a070', hair: '#5a3417', hairStyle: 3, shirt: '#e0a03a', shirtDark: '#b07a1a', pants: '#3a2a1a', shoes: '#1a120a' },
    { skin: '#6a4028', hair: '#2a1a10', hairStyle: 1, shirt: '#4ea1e3', shirtDark: '#2a6fa0', pants: '#2a2a3a', shoes: '#111111' },
  ];
  const vNames = ['Pip', 'Wren', 'Oskar', 'Lena'];
  vLooks.forEach((look, i) => npcs.push({ id: 'v' + i, name: vNames[i], x: (43 + i * 3) * 16, y: (34 + (i % 2) * 4) * 16, home: [48 * 16, 37 * 16], wander: 150, look }));
  for (const n of npcs) Object.assign(n, { tx: n.x, ty: n.y, wait: R() * 3, walk: 0, moving: false, face: 1 });
  const zones = [
    { x0: 14, y0: 14, x1: 36, y1: 30, types: [['slime', 1]], max: 6 },
    { x0: 62, y0: 26, x1: 86, y1: 46, types: [['slime', 2], ['wolf', 1]], max: 6 },
    { x0: 18, y0: 46, x1: 44, y1: 64, types: [['wolf', 2], ['slime', 1]], max: 5 },
    { x0: 58, y0: 6, x1: 82, y1: 14, types: [['wolf', 1]], max: 3 },
  ];
  renderLayer(m, null);
  return { map: m, props, npcs, entrances, zones, spawn: { x: 48 * 16, y: 39 * 16 + 8 } };
}

// ---------- dungeon generator (new layout on every visit) ----------
function buildDungeon(def) {
  const W = 46 + def.tier * 4, H = 40 + def.tier * 3;
  const m = makeMap(W, H, T.WALL); m.kind = 'dungeon'; m.explored = new Uint8Array(W * H);
  const rooms = [];
  for (let tries = 0; tries < 600 && rooms.length < def.rooms; tries++) {
    const w = randi(7, 12), h = randi(6, 9), x = randi(2, W - w - 3), y = randi(3, H - h - 3);
    if (rooms.some((o) => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  const floor = (tx, ty) => { if (tx > 0 && ty > 1 && tx < W - 1 && ty < H - 1) m.t[ty * W + tx] = T.FLOOR; };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) floor(x, y);
  const corridor = (a, b) => {
    const horizFirst = Math.random() < 0.5;
    let x = a.cx, y = a.cy;
    const stepTo = (tx, ty) => { while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); floor(x, y); floor(x + 1, y); floor(x, y + 1); floor(x + 1, y + 1); } };
    if (horizFirst) { stepTo(b.cx, a.cy); stepTo(b.cx, b.cy); } else { stepTo(a.cx, b.cy); stepTo(b.cx, b.cy); }
  };
  const linked = [rooms[0]], rest = rooms.slice(1);
  while (rest.length) {
    let best = null, bd = Infinity;
    for (const a of linked) for (const b of rest) { const d = Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy); if (d < bd) { bd = d; best = [a, b]; } }
    corridor(best[0], best[1]); linked.push(best[1]); rest.splice(rest.indexOf(best[1]), 1);
  }
  for (let i = 0; i < 2 && rooms.length > 3; i++) corridor(pick(rooms), pick(rooms));
  // boss room = the room farthest (by walking) from the start
  const start = rooms[0];
  const bfs = (sx, sy) => { const d = new Int16Array(W * H).fill(-1), q = [sy * W + sx]; d[q[0]] = 0; for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * W + x + dx; if (d[j] === -1 && m.t[j] === T.FLOOR) { d[j] = d[i] + 1; q.push(j); } } } return d; };
  const d0 = bfs(start.cx, start.cy);
  let boss = rooms[rooms.length - 1], far = -1;
  for (const r of rooms.slice(1)) { const v = d0[r.cy * W + r.cx]; if (v > far) { far = v; boss = r; } }
  // widen the boss arena
  const bx0 = clamp(boss.cx - 7, 2, W - 3), bx1 = clamp(boss.cx + 7, 2, W - 3), by0 = clamp(boss.cy - 5, 3, H - 3), by1 = clamp(boss.cy + 5, 3, H - 3);
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) floor(x, y);
  Object.assign(boss, { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 });
  const th = def.theme;
  const props = [], chests = [], spawns = [], torches = [], traps = [], decos = [];
  const freeFloor = (r, margin = 1) => { for (let k = 0; k < 40; k++) { const tx = randi(r.x + margin, r.x + r.w - 1 - margin), ty = randi(r.y + margin, r.y + r.h - 1 - margin); if (m.t[ty * W + tx] === T.FLOOR && !m.block[ty * W + tx]) return [tx, ty]; } return [r.cx, r.cy]; };
  // lava pools
  if (th.lava) for (const r of rooms) { if (r === start || r === boss || r.w < 9) continue; for (let k = 0; k < 2; k++) { const lw = randi(2, 3), lh = randi(2, 3), lx = randi(r.x + 2, r.x + r.w - lw - 2), ly = randi(r.y + 2, r.y + r.h - lh - 2); for (let y = ly; y < ly + lh; y++) for (let x = lx; x < lx + lw; x++) m.t[y * W + x] = T.LAVA; } }
  // chests (wood in normal rooms, a gold one waiting behind the boss)
  const normal = rooms.filter((r) => r !== start && r !== boss);
  normal.forEach((r, i) => {
    if (i % 2 === 0 || Math.random() < 0.35) { const [tx, ty] = freeFloor(r, 1); m.block[ty * W + tx] = 1; chests.push({ x: tx * 16 + 8, y: ty * 16 + 14, tx, ty, kind: 'wood', open: false }); }
  });
  { const tx = boss.cx, ty = boss.y + 1; m.t[ty * W + tx] = T.FLOOR; m.block[ty * W + tx] = 1; chests.push({ x: tx * 16 + 8, y: ty * 16 + 14, tx, ty, kind: 'gold', open: false, locked: true }); }
  // monsters
  for (const r of normal) {
    const n = randi(2, 3) + Math.floor(def.tier / 2);
    for (let k = 0; k < n; k++) { const [tx, ty] = freeFloor(r, 1); spawns.push({ type: weighted(def.mons), x: tx * 16 + 8, y: ty * 16 + 12, room: r }); }
  }
  spawns.push({ type: def.boss, x: boss.cx * 16 + 8, y: (boss.cy + 1) * 16, room: boss, boss: true });
  // torches on top walls, decorations, traps
  for (const r of rooms) {
    for (let x = r.x + 1; x < r.x + r.w - 1; x += 4) { if (m.t[(r.y - 1) * W + x] === T.WALL && m.t[r.y * W + x] === T.FLOOR) torches.push({ x: x * 16 + 8, y: (r.y - 1) * 16 + 9, ph: Math.random() * 6 }); }
    if (r === start) continue;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = y * W + x; if (m.t[i] !== T.FLOOR || m.block[i]) continue;
      if (Math.random() < 0.045) decos.push({ x: x * 16 + randi(3, 12), y: y * 16 + randi(4, 13), kind: th.deco, v: randi(0, 2) });
      else if (th.traps && r !== boss && Math.random() < 0.025) traps.push({ tx: x, ty: y, x: x * 16 + 8, y: y * 16 + 8, ph: Math.random() * 2.4, cd: 0 });
    }
  }
  renderLayer(m, th);
  return { def, map: m, rooms, start, boss, props, chests, spawns, torches, traps, decos, entry: { x: start.cx * 16 + 8, y: (start.y + start.h - 2) * 16 + 12 }, exit: { x: start.cx * 16 + 8, y: (start.y + 1) * 16 + 8 } };
}
