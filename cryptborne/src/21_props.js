
// =====================================================================
// PROPS — trees (drawn live so they sway), grass tufts, buildings and
// landmarks. Everything is baked once into small canvases.
// =====================================================================
function pcirc(x, cx, cy, r, col) { // pixel-perfect filled circle
  x.fillStyle = col;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) { const dy = y - cy + 0.5, w = Math.sqrt(Math.max(0, r * r - dy * dy)); if (w <= 0) continue; x.fillRect(Math.round(cx - w), y, Math.round(w * 2), 1); }
}
// ---------- trees: canvas 24x32, base at (12, 31); rows above TREE_SPLIT sway ----------
const TREE_W = 24, TREE_H = 32, TREE_SPLIT = 20;
function bakeTree(kind, v) {
  const [c, x] = mkCanvas(TREE_W, TREE_H), R = mulberry32(1000 + v * 37 + kind.length);
  const trunk = (col, hi, w = 4, top = 19) => { px(x, 12 - w / 2, top, w, 31 - top, col); px(x, 12 - w / 2, top, 1, 31 - top, hi); px(x, 12 - w / 2 - 1, 29, w + 2, 2, col); };
  if (kind === 'oak' || kind === 'willow') {
    trunk('#5a3a1e', '#7a5232');
    const g = kind === 'willow' ? ['#1d3a26', '#2a5236', '#3a6a44'] : v % 3 === 0 ? ['#1f4a22', '#2e6a2e', '#4a8e3e'] : v % 3 === 1 ? ['#1d4430', '#2a6040', '#3f7f52'] : ['#28501f', '#3a7a2a', '#5a9a3a'];
    pcirc(x, 12, 12, 9.5, g[0]); pcirc(x, 6, 15, 6, g[0]); pcirc(x, 18, 15, 6, g[0]);
    pcirc(x, 11, 11, 8, g[1]); pcirc(x, 6, 14, 4.5, g[1]); pcirc(x, 17, 14, 4.5, g[1]);
    for (let i = 0; i < 9; i++) { const a = R() * TAU, r = R() * 6; px(x, 10 + Math.cos(a) * r - 2, 9 + Math.sin(a) * r - 2, 2, 2, g[2]); }
    if (kind === 'willow') for (let i = 0; i < 9; i++) { const sx = 4 + i * 2; px(x, sx, 14 + (i % 3), 1, 6 + (i % 4), g[1]); }
    if (kind === 'oak' && v % 4 === 3) for (let i = 0; i < 4; i++) px(x, 6 + R() * 12, 8 + R() * 10, 2, 2, '#d8454a'); // apples
  } else if (kind === 'pine' || kind === 'snowpine') {
    trunk('#4a3018', '#6a4828', 3, 22);
    const g = ['#173d26', '#235536', '#2f6a44'];
    for (let t = 0; t < 4; t++) {
      const y0 = 2 + t * 5, h = 8, w0 = 3 + t * 2.5;
      for (let r = 0; r < h; r++) { const w = Math.round(w0 * (r + 1) / h + 1); px(x, 12 - w, y0 + r, w * 2, 1, r === h - 1 ? g[0] : g[1]); px(x, 12 - w, y0 + r, Math.max(1, w - 1), 1, g[2]); }
      if (kind === 'snowpine') { const w = Math.round(w0 * 0.5) + 1; px(x, 12 - w, y0 + 3, w * 2, 1, '#eef6ff'); px(x, 12 - w0 - 1, y0 + h - 2, 3, 1, '#eef6ff'); px(x, 12 + w0 - 1, y0 + h - 2, 3, 1, '#dfeaf6'); }
    }
    if (kind === 'snowpine') px(x, 11, 1, 2, 2, '#ffffff');
  } else if (kind === 'dead') {
    trunk('#4e463e', '#6a6058', 3, 8);
    const br = (x0, y0, dx, dy, n) => { for (let i = 0; i < n; i++) px(x, x0 + dx * i, y0 + dy * i, 1, 1, '#4e463e'); };
    br(12, 12, -1, -1, 7); br(13, 10, 1, -1, 7); br(12, 16, -1, -0.5, 8); br(13, 15, 1, -0.6, 8); br(6, 6, 0, -1, 3); br(19, 4, 0, -1, 3);
    if (v % 2) for (let i = 0; i < 3; i++) px(x, 6 + i * 6, 9 + i, 1, 4, '#5a6a4a'); // hanging moss
  } else if (kind === 'palm') {
    for (let i = 0; i < 20; i++) { const tx = 12 + Math.round(Math.sin(i / 6) * 2); px(x, tx - 1, 30 - i, 3, 1, i % 3 ? '#8a6a3a' : '#6a4e28'); }
    const cx = 12 + Math.round(Math.sin(20 / 6) * 2), cy = 10;
    for (const [dx, dy] of [[-1, 0.3], [1, 0.3], [-0.7, -0.6], [0.7, -0.6], [-1, 0.9], [1, 0.9]]) for (let i = 0; i < 9; i++) { const xx = cx + dx * i, yy = cy + dy * i + (i * i) / 14; px(x, xx, yy, 2, 2, i < 6 ? '#3a8a3a' : '#2e6a2e'); }
    px(x, cx - 1, cy, 3, 3, '#6a4e28'); px(x, cx - 2, cy + 2, 2, 2, '#5a3a1e'); px(x, cx + 1, cy + 2, 2, 2, '#5a3a1e');
  } else if (kind === 'cactus') {
    const g = '#3a8a4a', d = '#2a6a36';
    px(x, 10, 10, 5, 21, g); px(x, 10, 10, 1, 21, d); px(x, 11, 9, 3, 1, g);
    px(x, 5, 16, 5, 3, g); px(x, 5, 11, 3, 7, g); px(x, 5, 11, 1, 7, d);
    px(x, 15, 14, 4, 3, g); px(x, 16, 9, 3, 7, g); px(x, 18, 9, 1, 7, d);
    for (let i = 0; i < 6; i++) px(x, 11 + (i % 2) * 2, 12 + i * 3, 1, 1, '#d8e8a0');
  }
  return c;
}
const TREES = {};
for (const k of ['oak', 'willow', 'pine', 'snowpine', 'dead', 'palm', 'cactus']) TREES[k] = [0, 1, 2, 3].map((v) => bakeTree(k, v));
// grass tufts: frames lean -2..2
function bakeTufts(cols) {
  return [-2, -1, 0, 1, 2].map((lean) => {
    const [c, x] = mkCanvas(7, 5);
    const blade = (bx, h, col) => { for (let i = 0; i < h; i++) { const off = Math.round((lean * i) / (h - 1 || 1)); px(x, bx + off, 4 - i, 1, 1, col); } };
    blade(2, 4, cols[0]); blade(3, 5, cols[1]); blade(4, 3, cols[0]);
    return c;
  });
}
const TUFTS = { vale: bakeTufts(['#4a8e3e', '#5aa24a']), swamp: bakeTufts(['#3a5a2a', '#4a6a32']), desert: bakeTufts(['#b0a050', '#c8b860']), coast: bakeTufts(['#5a9a4a', '#6aae52']), frost: bakeTufts(['#a8c0c8', '#c8dce4']) };

// ---------- buildings ----------
// returns a canvas with .windows (lit at night) and .lamp spots, in canvas coordinates
function bakeBuilding(wT, hT, o) {
  const W = wT * 16, H = hT * 16 + 18; const [c, x] = mkCanvas(W, H);
  const roofH = Math.floor(H * 0.5);
  if (o.stilts) { for (const sx of [6, W - 9]) px(x, sx, H - 10, 3, 10, '#4a3420'); }
  const baseY = o.stilts ? H - 10 : H;
  px(x, 3, roofH - 2, W - 6, baseY - roofH + 2, o.wall);
  for (let yy = roofH + 4; yy < baseY - 2; yy += 5) px(x, 3, yy, W - 6, 1, o.wallLine);
  if (o.beams) for (let bx = 3; bx < W - 3; bx += 12) px(x, bx, roofH, 2, baseY - roofH, o.wallLine);
  px(x, 3, baseY - 3, W - 6, 3, o.wallLine);
  for (let r = 0; r < roofH; r++) { const inset = Math.max(0, Math.floor((roofH - r) * 0.35) - 2); px(x, inset, r, W - inset * 2, 1, r % 4 === 3 ? o.roofLine : o.roof); }
  if (o.snow) { for (let r = 0; r < roofH; r += 1) { const inset = Math.max(0, Math.floor((roofH - r) * 0.35) - 2); if (r < roofH * 0.45) px(x, inset, r, W - inset * 2, 1, r % 4 === 3 ? '#dfeaf6' : '#ffffff'); } }
  px(x, 0, roofH - 2, W, 2, o.roofLine);
  const dw = 12, dx = Math.floor(W / 2 - dw / 2);
  px(x, dx - 1, baseY - 18, dw + 2, 18, '#2a1a10'); px(x, dx, baseY - 17, dw, 17, o.door); px(x, dx + dw - 3, baseY - 9, 2, 2, '#f2c13a');
  c.windows = []; c.door = { x: W / 2, y: baseY };
  const winY = baseY - 16;
  for (const wx of [8, W - 18]) {
    if (wx + 10 > dx - 2 && wx < dx + dw + 2) continue;
    px(x, wx - 1, winY - 1, 12, 10, '#2a1a10'); px(x, wx, winY, 10, 8, '#3a3048'); px(x, wx + 4, winY, 2, 8, '#2a1a10'); px(x, wx, winY + 3, 10, 1, '#2a1a10');
    c.windows.push({ x: wx, y: winY, w: 10, h: 8 });
  }
  if (o.sign) {
    const sx = Math.floor(W / 2 - 9), sy = roofH + 1;
    px(x, sx, sy, 18, 10, '#5a3418'); px(x, sx + 1, sy + 1, 16, 8, '#c8a06a');
    const s = (a, b, w, h, col) => px(x, sx + a, sy + b, w, h, col);
    if (o.sign === 'potion') { s(7, 2, 4, 1, '#5a3418'); s(6, 3, 6, 5, '#d8454a'); s(7, 4, 2, 1, '#ff9a9a'); }
    else if (o.sign === 'anvil') { s(4, 3, 10, 2, '#44464b'); s(7, 5, 4, 2, '#44464b'); s(5, 7, 8, 1, '#44464b'); }
    else if (o.sign === 'paw') { s(7, 4, 4, 4, '#5a3418'); s(5, 2, 2, 2, '#5a3418'); s(8, 1, 2, 2, '#5a3418'); s(11, 2, 2, 2, '#5a3418'); }
    else if (o.sign === 'mug') { s(5, 2, 6, 6, '#f2c13a'); s(11, 3, 2, 3, '#f2c13a'); s(5, 2, 6, 2, '#ffffff'); }
    else if (o.sign === 'home') { s(5, 4, 8, 4, '#7a4a24'); s(4, 3, 10, 1, '#a3322c'); s(6, 2, 6, 1, '#a3322c'); s(8, 5, 2, 3, '#2a1a10'); }
  }
  if (o.chimney) { px(x, W - 16, 2, 7, roofH - 6, '#55575d'); px(x, W - 17, 0, 9, 3, '#44464b'); c.chimney = { x: W - 13, y: 0 }; }
  return c;
}
function bakeCave(glow, rock = ['#55575d', '#6a6c72', '#7d7f86', '#44464b'], snow) {
  const [c, x] = mkCanvas(36, 34);
  pcirc(x, 18, 22, 16, rock[0]); x.clearRect(0, 22 + 12, 36, 10); px(x, 2, 22, 32, 12, rock[0]);
  pcirc(x, 17, 20, 12.5, rock[1]); px(x, 5, 20, 25, 6, rock[1]);
  px(x, 6, 12, 5, 3, rock[2]); px(x, 22, 10, 6, 3, rock[2]); px(x, 28, 18, 4, 2, rock[2]);
  if (snow) { px(x, 8, 7, 20, 3, '#ffffff'); px(x, 5, 10, 6, 2, '#eef6ff'); px(x, 24, 9, 7, 2, '#eef6ff'); }
  pcirc(x, 18, 26, 9, '#07050a'); px(x, 9, 26, 18, 8, '#07050a');
  x.globalAlpha = 0.35; px(x, 12, 26, 12, 8, glow); x.globalAlpha = 1;
  px(x, 7, 30, 3, 4, rock[3]); px(x, 26, 30, 3, 4, rock[3]);
  return c;
}
function bakeEntrance(kind, glow) {
  if (kind === 'cave') return bakeCave(glow);
  if (kind === 'icecave') return bakeCave(glow, ['#7a98b0', '#9ab8cc', '#c8dcec', '#5a7890'], true);
  const [c, x] = mkCanvas(48, 40);
  if (kind === 'pyramid') {
    for (let r = 0; r < 34; r++) { const w = Math.round(46 * (r + 1) / 34); px(x, 24 - w / 2, 6 + r, w, 1, r % 4 === 0 ? '#b8964a' : '#d8b468'); }
    px(x, 17, 26, 14, 14, '#1a120a'); px(x, 16, 24, 16, 2, '#8a6a2a'); px(x, 21, 18, 6, 4, '#f2c13a'); px(x, 23, 19, 2, 2, '#1a120a');
    x.globalAlpha = 0.3; px(x, 19, 30, 10, 10, glow); x.globalAlpha = 1;
  } else if (kind === 'wreck') {
    px(x, 2, 26, 44, 10, '#5a3a1e'); px(x, 4, 22, 40, 4, '#6b4423'); for (let i = 0; i < 6; i++) px(x, 4 + i * 7, 22, 1, 14, '#3a2410');
    px(x, 30, 4, 2, 22, '#4a3018'); px(x, 31, 6, 12, 9, '#cfc6b4'); px(x, 33, 8, 2, 2, '#1a1a1a'); px(x, 37, 10, 2, 2, '#1a1a1a');
    px(x, 14, 28, 12, 8, '#07050a'); x.globalAlpha = 0.3; px(x, 15, 30, 10, 6, glow); x.globalAlpha = 1;
  } else if (kind === 'witchtree') {
    px(x, 18, 10, 12, 30, '#3a2a20'); px(x, 18, 10, 2, 30, '#4e3a2a');
    for (const [a, b] of [[-1, -1], [1, -1], [-1, -0.4], [1, -0.4]]) for (let i = 0; i < 12; i++) px(x, 24 + a * i, 14 + b * i, 2, 2, '#3a2a20');
    pcirc(x, 24, 34, 6, '#07050a'); x.globalAlpha = 0.4; pcirc(x, 24, 34, 4, glow); x.globalAlpha = 1;
    px(x, 21, 18, 2, 2, '#9be04a'); px(x, 26, 18, 2, 2, '#9be04a');
  } else if (kind === 'crypt') {
    px(x, 6, 12, 36, 28, '#55525e'); px(x, 4, 10, 40, 4, '#6e6a78'); for (let r = 0; r < 8; r++) px(x, 24 - (8 - r) * 2.5, 2 + r, (8 - r) * 5, 1, '#6e6a78');
    px(x, 10, 16, 3, 24, '#6e6a78'); px(x, 35, 16, 3, 24, '#6e6a78');
    px(x, 17, 20, 14, 20, '#07050a'); x.globalAlpha = 0.35; px(x, 18, 24, 12, 16, glow); x.globalAlpha = 1;
    px(x, 22, 4, 4, 2, '#cfc6b4'); px(x, 23, 2, 2, 6, '#cfc6b4');
  } else if (kind === 'mirror') {
    px(x, 12, 8, 24, 32, '#3a3448'); px(x, 14, 10, 20, 26, '#5a5272'); px(x, 16, 12, 16, 22, '#8a86a8');
    px(x, 17, 13, 3, 20, '#c8c4e0'); x.globalAlpha = 0.5; px(x, 16, 12, 16, 22, glow); x.globalAlpha = 1;
    px(x, 10, 36, 28, 4, '#2a2436');
  }
  return c;
}
function bakeProp(kind) {
  let c, x;
  switch (kind) {
    case 'lamp': [c, x] = mkCanvas(8, 28); px(x, 3, 6, 2, 22, '#2a2430'); px(x, 1, 26, 6, 2, '#2a2430'); px(x, 1, 1, 6, 6, '#2a2430'); px(x, 2, 2, 4, 4, '#ffd27a'); px(x, 0, 0, 8, 1, '#3a3440'); c.light = { x: 4, y: 4 }; break;
    case 'tent': [c, x] = mkCanvas(32, 26); for (let r = 0; r < 24; r++) { const w = Math.round(30 * (r + 1) / 24); px(x, 16 - w / 2, r + 1, w, 1, r % 5 === 4 ? '#8a6a3a' : '#b08a4a'); } for (let r = 0; r < 14; r++) px(x, 16 - r / 2, 11 + r, r, 1, '#2a1a10'); px(x, 15, 0, 2, 3, '#5a3a1e'); break;
    case 'well': [c, x] = mkCanvas(20, 24); px(x, 2, 12, 16, 12, '#7d7f86'); px(x, 2, 12, 16, 2, '#a0a3aa'); px(x, 4, 14, 12, 3, '#1a2a3a'); px(x, 3, 2, 2, 12, '#5a3a1e'); px(x, 15, 2, 2, 12, '#5a3a1e'); px(x, 1, 0, 18, 3, '#7a1a1e'); px(x, 9, 3, 2, 7, '#8a8a8a'); break;
    case 'barrel': [c, x] = mkCanvas(10, 12); px(x, 1, 0, 8, 12, '#7a4a24'); px(x, 0, 2, 10, 8, '#7a4a24'); px(x, 0, 3, 10, 1, '#44464b'); px(x, 0, 8, 10, 1, '#44464b'); px(x, 2, 0, 1, 12, '#9a6a3a'); break;
    case 'crate': [c, x] = mkCanvas(12, 12); px(x, 0, 0, 12, 12, '#8a5a2b'); px(x, 0, 0, 12, 1, '#b07a3e'); px(x, 0, 0, 1, 12, '#b07a3e'); px(x, 1, 1, 10, 10, '#7a4a24'); for (let i = 0; i < 10; i++) px(x, 1 + i, 1 + i, 1, 1, '#b07a3e'); break;
    case 'grave': [c, x] = mkCanvas(10, 14); px(x, 1, 3, 8, 11, '#7d7f86'); px(x, 2, 1, 6, 2, '#7d7f86'); px(x, 3, 0, 4, 1, '#7d7f86'); px(x, 1, 3, 1, 11, '#a0a3aa'); px(x, 3, 5, 4, 1, '#55575d'); px(x, 3, 7, 4, 1, '#55575d'); px(x, 0, 12, 10, 2, '#4a3a28'); break;
    case 'cross': [c, x] = mkCanvas(10, 16); px(x, 4, 0, 2, 16, '#8a8a92'); px(x, 1, 4, 8, 2, '#8a8a92'); px(x, 0, 14, 10, 2, '#4a3a28'); break;
    case 'dadgrave': [c, x] = mkCanvas(14, 18); px(x, 1, 4, 12, 13, '#8f897c'); px(x, 2, 2, 10, 2, '#8f897c'); px(x, 4, 0, 6, 2, '#8f897c'); px(x, 1, 4, 1, 13, '#a8a294'); px(x, 4, 7, 6, 1, '#55575d'); px(x, 4, 9, 6, 1, '#55575d'); px(x, 5, 11, 4, 1, '#55575d'); px(x, 0, 16, 14, 2, '#4a3a28'); px(x, 10, 13, 2, 2, '#d8454a'); break;
    case 'cauldron': [c, x] = mkCanvas(14, 12); px(x, 1, 3, 12, 8, '#2a2430'); px(x, 0, 2, 14, 2, '#3a3440'); px(x, 2, 3, 10, 2, '#7be06a'); px(x, 2, 11, 2, 1, '#2a2430'); px(x, 10, 11, 2, 1, '#2a2430'); break;
    case 'sign': [c, x] = mkCanvas(12, 16); px(x, 5, 6, 2, 10, '#5a3a1e'); px(x, 0, 1, 12, 6, '#8a5a2b'); px(x, 0, 1, 12, 1, '#b07a3e'); px(x, 2, 3, 8, 1, '#3a2410'); break;
    case 'barricade': [c, x] = mkCanvas(34, 18); for (let i = 0; i < 16; i++) { px(x, 1 + i * 2, 1 + i, 3, 2, '#6b4423'); px(x, 31 - i * 2, 1 + i, 3, 2, '#7a4a24'); } px(x, 0, 8, 34, 3, '#5a3418'); break;
    case 'boat': [c, x] = mkCanvas(28, 12); px(x, 2, 4, 24, 6, '#7a4a24'); px(x, 0, 3, 28, 2, '#8a5a2b'); px(x, 4, 10, 20, 2, '#5a3418'); px(x, 12, 0, 2, 4, '#5a3a1e'); break;
    case 'ship': [c, x] = mkCanvas(76, 56);
      px(x, 6, 38, 64, 12, '#5a3418'); px(x, 2, 34, 72, 5, '#7a4a24'); px(x, 10, 50, 56, 4, '#3a2410'); for (let i = 0; i < 6; i++) px(x, 14 + i * 9, 40, 4, 3, '#1a1a1a');
      px(x, 36, 2, 3, 34, '#4a3018'); px(x, 20, 6, 34, 22, '#efe4cc'); px(x, 20, 6, 34, 2, '#cfc6b4'); px(x, 30, 12, 14, 9, '#1a1a1a'); px(x, 33, 14, 3, 3, '#efe4cc'); px(x, 38, 14, 3, 3, '#efe4cc'); px(x, 38, 0, 10, 4, '#1a1a1a'); break;
    case 'dock': [c, x] = mkCanvas(16, 16); px(x, 0, 0, 16, 16, '#8a5a2b'); for (let i = 0; i < 4; i++) px(x, 0, i * 4 + 3, 16, 1, '#5a3818'); break;
    case 'fire': [c, x] = mkCanvas(16, 10); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; px(x, 7 + Math.cos(a) * 6, 5 + Math.sin(a) * 3, 3, 2, '#7d7f86'); } px(x, 3, 5, 10, 2, '#5a3418'); px(x, 5, 3, 6, 2, '#6b4423'); c.light = { x: 8, y: 2 }; break;
    case 'keydoor': [c, x] = mkCanvas(16, 22); px(x, 0, 0, 16, 22, '#3a3440'); px(x, 2, 2, 12, 20, '#6a6c72'); for (let i = 0; i < 3; i++) px(x, 2, 5 + i * 6, 12, 1, '#44464b'); px(x, 6, 10, 4, 5, '#f2c13a'); px(x, 7, 11, 2, 2, '#07050a'); px(x, 7, 13, 2, 2, '#07050a'); break;
    case 'gate': [c, x] = mkCanvas(16, 22); px(x, 0, 0, 16, 3, '#3a3440'); for (let i = 0; i < 5; i++) px(x, 1 + i * 3, 2, 2, 20, '#55575d'); for (let j = 0; j < 4; j++) px(x, 0, 5 + j * 5, 16, 1, '#44464b'); for (let i = 0; i < 5; i++) px(x, 1 + i * 3, 21, 2, 1, '#a0a3aa'); break;
    case 'lever0': case 'lever1': [c, x] = mkCanvas(12, 14); px(x, 1, 8, 10, 6, '#44464b'); px(x, 1, 8, 10, 1, '#6a6c72');
      if (kind === 'lever0') { for (let i = 0; i < 7; i++) px(x, 4 - Math.round(i * 0.4), 8 - i, 2, 1, '#8a5a2b'); px(x, 0, 0, 4, 3, '#d8454a'); } else { for (let i = 0; i < 7; i++) px(x, 6 + Math.round(i * 0.4), 8 - i, 2, 1, '#8a5a2b'); px(x, 8, 0, 4, 3, '#5cc46e'); }
      break;
    case 'captive': [c, x] = mkCanvas(16, 22); drawHuman(x, 8, 21, { skin: '#f0c08a', hair: '#7a4a24', hairStyle: 0, shirt: '#8a8f99', pants: '#4a3a2a', shoes: '#2a1a10' }, { face: 1 }); px(x, 2, 11, 12, 2, '#b08a4a'); px(x, 2, 16, 12, 1, '#b08a4a'); break;
    case 'crack': [c, x] = mkCanvas(16, 16); for (const [a, b] of [[7, 2], [8, 3], [8, 4], [7, 5], [6, 6], [7, 7], [9, 8], [10, 9], [9, 10], [8, 11], [6, 9], [5, 10]]) px(x, a, b, 1, 1, '#07050a'); break;
    case 'note': [c, x] = mkCanvas(10, 10); px(x, 1, 1, 8, 8, '#efe4cc'); px(x, 0, 0, 10, 2, '#c8b88a'); px(x, 0, 8, 10, 2, '#c8b88a'); px(x, 2, 3, 6, 1, '#5a4a3a'); px(x, 2, 5, 5, 1, '#5a4a3a'); break;
    case 'bed': [c, x] = mkCanvas(14, 24); px(x, 0, 0, 14, 24, '#5a3418'); px(x, 1, 1, 12, 6, '#efe4cc'); px(x, 1, 7, 12, 16, '#3e6cb8'); px(x, 1, 7, 12, 2, '#5a8ad0'); break;
    case 'finnbed': [c, x] = mkCanvas(14, 24); px(x, 0, 0, 14, 24, '#5a3418'); px(x, 1, 1, 12, 6, '#efe4cc'); px(x, 1, 7, 12, 16, '#a3322c'); px(x, 1, 7, 12, 2, '#c8504a'); px(x, 3, 13, 8, 4, '#8a2a24'); break;
    case 'table': [c, x] = mkCanvas(20, 14); px(x, 0, 0, 20, 8, '#8a5a2b'); px(x, 0, 0, 20, 1, '#b07a3e'); px(x, 1, 8, 2, 6, '#5a3418'); px(x, 17, 8, 2, 6, '#5a3418'); break;
    case 'hearth': [c, x] = mkCanvas(24, 20); px(x, 0, 0, 24, 20, '#6a6c72'); px(x, 2, 2, 20, 2, '#8a8c92'); px(x, 5, 8, 14, 12, '#1a120a'); c.light = { x: 12, y: 14 }; break;
  }
  return c;
}
const PROP = {};
for (const k of ['lamp', 'tent', 'well', 'barrel', 'crate', 'grave', 'cross', 'dadgrave', 'cauldron', 'sign', 'barricade', 'boat', 'ship', 'dock', 'fire', 'keydoor', 'gate', 'lever0', 'lever1', 'crack', 'note', 'bed', 'finnbed', 'table', 'hearth']) PROP[k] = bakeProp(k);
// captive needs drawHuman, which exists by now
PROP.captive = bakeProp('captive');
