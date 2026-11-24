// Buildings of the stickman world: what they are, what they cost, and how they are drawn (cut open, like a doll house,
// so you can see everyone inside). Walls / roofs / floors use real photo textures (Poly Haven, CC0).
import { asset, loadImage, clamp, rand } from '../util.js';
import { spriteImg, spriteMeta } from '../items.js';

export const ERAS = ['Stone Age', 'Village', 'Town', 'Industrial', 'Modern', 'Future'];
export const ERA_TECH = [0, 60, 220, 600, 1400, 3000]; // knowledge needed for each era
const M = [ // materials per era
  { ext: 'brown_planks_05', int: 'brown_planks_05', intTint: 0.55, floor: 'dark_wooden_planks', roof: 'dark_wooden_planks', roofKind: 'gable' },
  { ext: 'castle_brick_01', int: 'beige_wall_001', intTint: 0.8, floor: 'dark_wooden_planks', roof: 'clay_roof_tiles', roofKind: 'gable' },
  { ext: 'brick_wall_02', int: 'white_plaster_02', intTint: 0.82, floor: 'dark_wooden_planks', roof: 'grey_roof_tiles', roofKind: 'gable' },
  { ext: 'factory_brick', int: 'concrete_wall_006', intTint: 0.78, floor: 'concrete_wall_006', roof: 'corrugated_iron', roofKind: 'flat' },
  { ext: 'concrete_tile_facade', int: 'white_plaster_02', intTint: 0.9, floor: 'concrete_wall_006', roof: 'concrete_wall_006', roofKind: 'flat' },
  { ext: 'concrete_tile_facade', int: 'white_plaster_02', intTint: 0.95, floor: 'concrete_wall_006', roof: 'concrete_wall_006', roofKind: 'flat' },
];
// w = width in metres, fl = floors, cap = people who can live there, jobs = workers it needs
export const BT = {
  hut: { name: 'Hut', era: 0, w: 6, fl: 1, fh: 2.8, cap: 4, cost: { wood: 20 }, time: 8, furn: [['bed', 0.3, 0, 0.9], ['fire_pit', 0.75, 0, 0.5]], gives: ['sleep', 'home'] },
  house: { name: 'House', era: 1, w: 9, fl: 2, fh: 3.1, cap: 6, cost: { wood: 30, stone: 20 }, time: 14, furn: [['sofa', 0.35, 0, 0.9], ['table', 0.75, 0, 0.7], ['bed', 0.3, 1, 0.9], ['bed', 0.72, 1, 0.9]], gives: ['sleep', 'home'] },
  apartment: { name: 'Apartments', era: 3, w: 12, fl: 4, fh: 3.1, cap: 16, cost: { wood: 30, stone: 90 }, time: 26, furn: [['sofa', 0.25, 0, 0.9], ['bed', 0.7, 0, 0.9], ['bed', 0.3, 1, 0.9], ['bed', 0.7, 1, 0.9], ['bed', 0.3, 2, 0.9], ['bed', 0.7, 2, 0.9], ['bed', 0.3, 3, 0.9], ['bed', 0.7, 3, 0.9]], gives: ['sleep', 'home'] },
  farm: { name: 'Farm', era: 0, w: 16, fl: 0, cap: 0, cost: { wood: 10 }, time: 5, jobs: { farmer: 2 }, gives: ['food'], field: true },
  well: { name: 'Well', era: 0, w: 2.4, fl: 0, cap: 0, cost: { stone: 10 }, time: 4, gives: ['water'], well: true },
  market: { name: 'Market', era: 1, w: 10, fl: 1, fh: 3.2, cost: { wood: 30, stone: 10 }, time: 12, jobs: { shopkeeper: 1 }, furn: [['register', 0.3, 0, 0.8], ['bananas', 0.55, 0, 1.2], ['apple', 0.62, 0, 1.5], ['buns', 0.7, 0, 1.5], ['crate', 0.85, 0, 0.8]], gives: ['food', 'shop'] },
  bar: { name: 'Bar', era: 1, w: 11, fl: 1, fh: 3.3, cost: { wood: 35, stone: 15 }, time: 12, jobs: { bartender: 1 }, furn: [['wine_barrel', 0.12, 0, 0.9], ['bar_stool', 0.35, 0, 1], ['bar_stool', 0.47, 0, 1], ['bar_stool', 0.59, 0, 1], ['wine_bottles', 0.2, 0, 1.4], ['dartboard', 0.88, 0, 0.9, 1.3], ['table', 0.8, 0, 0.6]], gives: ['fun', 'booze'], night: true },
  school: { name: 'School', era: 1, w: 12, fl: 1, fh: 3.4, cost: { wood: 40, stone: 20 }, time: 14, jobs: { teacher: 1 }, furn: [['chalkboard', 0.12, 0, 1], ['school_desk', 0.35, 0, 1], ['school_desk', 0.52, 0, 1], ['school_desk', 0.69, 0, 1], ['school_desk', 0.86, 0, 1]], gives: ['learn'] },
  library: { name: 'Library', era: 1, w: 10, fl: 1, fh: 3.6, cost: { wood: 40, stone: 30 }, time: 14, jobs: { scholar: 2 }, furn: [['bookshelf', 0.15, 0, 1], ['bookshelf', 0.38, 0, 1], ['table', 0.7, 0, 0.8], ['books', 0.7, 0, 1.2]], gives: ['research'] },
  hospital: { name: 'Hospital', era: 2, w: 13, fl: 2, fh: 3.2, cost: { wood: 30, stone: 60 }, time: 20, jobs: { doctor: 2 }, furn: [['bed', 0.25, 0, 0.9], ['bed', 0.6, 0, 0.9], ['medkit', 0.85, 0, 1.3], ['wheelchair', 0.85, 1, 0.9], ['bed', 0.3, 1, 0.9]], gives: ['heal', 'birth'] },
  police: { name: 'Police', era: 2, w: 11, fl: 1, fh: 3.3, cost: { stone: 50, wood: 20 }, time: 16, jobs: { police: 2 }, furn: [['table', 0.25, 0, 0.7]], gives: ['jail'], jail: true },
  townhall: { name: 'Town Hall', era: 2, w: 14, fl: 2, fh: 3.6, cost: { stone: 80, wood: 30 }, time: 22, jobs: { mayor: 1 }, furn: [['table', 0.5, 0, 0.9], ['bookshelf', 0.15, 1, 1]], gives: ['govern'] },
  factory: { name: 'Factory', era: 3, w: 16, fl: 1, fh: 5, cost: { stone: 90, wood: 40 }, time: 24, jobs: { worker: 3 }, furn: [['barrel', 0.2, 0, 1], ['barrel', 0.3, 0, 1], ['crate', 0.6, 0, 1], ['crate', 0.7, 0, 1], ['jerrycan', 0.85, 0, 1.2]], gives: ['goods', 'research'] },
  lab: { name: 'Lab', era: 4, w: 12, fl: 2, fh: 3.4, cost: { stone: 80, wood: 20 }, time: 22, jobs: { scientist: 2 }, furn: [['laptop', 0.3, 0, 1], ['table', 0.3, 0, 0.8], ['console', 0.7, 0, 1.4], ['table', 0.7, 0, 0.8], ['laptop', 0.5, 1, 1], ['table', 0.5, 1, 0.8]], gives: ['research'] },
};
export const JOB_NAMES = { farmer: 'Farmer', shopkeeper: 'Shopkeeper', bartender: 'Bartender', teacher: 'Teacher', scholar: 'Scholar', doctor: 'Doctor', police: 'Police officer', mayor: 'Mayor', worker: 'Factory worker', scientist: 'Scientist', builder: 'Builder', gatherer: 'Woodcutter', miner: 'Stone cutter' };

const TEX = {};
export async function loadTownTextures() {
  const names = new Set(['dirt', 'brown_mud_dry', 'dark_rock', 'asphalt_02']); for (const m of M) for (const k of ['ext', 'int', 'floor', 'roof']) names.add(m[k]);
  await Promise.all([...names].map(async n => { TEX[n] = await loadImage(asset('tex/' + n + '.webp')); }));
  return TEX;
}
export const tex = (n) => TEX[n];
const patCache = new Map();
export function pattern(ctx, n, scale = 1) { // a repeating texture with a real-world size (1 texture = 3 m)
  const k = n + ctx.canvas.width; let p = patCache.get(k);
  if (!p) { if (!TEX[n]) return '#777'; p = ctx.createPattern(TEX[n], 'repeat'); patCache.set(k, p); }
  p.setTransform(new DOMMatrix().scale(scale));
  return p;
}
export function mat(b) { return M[clamp(b.era, 0, 5)]; }

// ---------------- drawing one building ----------------
export function drawBuilding(ctx, b, W, night, ppm) {
  const T = BT[b.type]; const m = mat(b); const x0 = b.x, x1 = b.x + b.w * ppm, g = b.y; const prog = clamp(b.built, 0, 1);
  const texScale = 3 * ppm / 512; // one texture tile = 3 m
  if (T.field) return drawFarm(ctx, b, ppm, prog);
  if (T.well) return drawWell(ctx, b, ppm, prog, texScale);
  const fh = T.fh * ppm, H = T.fl * fh; const wall = 0.28 * ppm; const slab = 0.25 * ppm;
  const topY = g - H * prog;
  ctx.save();
  // inside back wall
  ctx.fillStyle = pattern(ctx, m.int, texScale); ctx.fillRect(x0, topY, x1 - x0, g - topY);
  ctx.fillStyle = `rgba(0,0,0,${1 - m.intTint})`; ctx.fillRect(x0, topY, x1 - x0, g - topY);
  // windows on the back wall
  for (let f = 0; f < T.fl; f++) {
    const fy = g - f * fh; if (fy - fh * 0.75 < topY) break;
    const n = Math.max(1, Math.floor(b.w / 3.2));
    for (let i = 0; i < n; i++) {
      const wx = x0 + (i + 0.5) * (x1 - x0) / n - 0.5 * ppm, wy = fy - fh * 0.75, ww = b.era >= 4 ? 1.6 * ppm : 1 * ppm, wh = fh * 0.42;
      if (Math.abs(wx + ww / 2 - (x0 + x1) / 2) < 0.3 * ppm && T.fl === 1 && b.type !== 'hut') continue;
      ctx.fillStyle = night ? 'rgba(14,20,34,1)' : 'rgba(150,190,225,1)'; ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = night ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.25)'; ctx.fillRect(wx, wy, ww * 0.45, wh);
      ctx.strokeStyle = b.era >= 3 ? '#3a3d40' : '#4a3626'; ctx.lineWidth = Math.max(1, ppm * 0.08); ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.stroke();
    }
  }
  if (T.jail) { // jail bars on the right side
    const jx = x0 + (x1 - x0) * 0.6; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(jx, g - fh, x1 - jx - wall, fh);
    ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(1, ppm * 0.07); for (let xx = jx; xx < x1 - wall; xx += 0.35 * ppm) { ctx.beginPath(); ctx.moveTo(xx, g - fh); ctx.lineTo(xx, g); ctx.stroke(); }
  }
  // furniture
  if (prog >= 1) for (const f of T.furn || []) drawFurn(ctx, b, f, ppm, fh);
  // floors (slabs) + outer walls (with door holes on the ground floor)
  ctx.fillStyle = pattern(ctx, m.floor, texScale);
  for (let f = 1; f <= T.fl; f++) { const fy = g - f * fh; if (fy < topY - 1) break; ctx.fillRect(x0, fy, x1 - x0, slab); }
  ctx.fillRect(x0 - wall * 0.5, g - slab * 0.4, x1 - x0 + wall, slab * 0.8);
  ctx.fillStyle = pattern(ctx, m.ext, texScale);
  const door = 2.1 * ppm;
  for (const wx of [x0 - wall * 0.5, x1 - wall * 0.5]) { ctx.fillRect(wx, topY, wall, Math.max(0, (g - door) - topY)); }
  // stairs hint
  if (T.fl > 1 && prog >= 1) { ctx.strokeStyle = 'rgba(40,30,20,0.55)'; ctx.lineWidth = Math.max(1, ppm * 0.1); for (let f = 0; f < T.fl - 1; f++) { const fy = g - f * fh; const sx = x1 - wall - 1.4 * ppm; ctx.beginPath(); for (let s = 0; s <= 8; s++) { ctx.lineTo(sx + s * 0.16 * ppm, fy - s * fh / 8); } ctx.stroke(); } }
  // roof
  if (prog >= 1) {
    ctx.fillStyle = pattern(ctx, m.roof, texScale);
    if (m.roofKind === 'gable') { const rh = Math.min(3, b.w * 0.32) * ppm; ctx.beginPath(); ctx.moveTo(x0 - 0.6 * ppm, topY + 2); ctx.lineTo((x0 + x1) / 2, topY - rh); ctx.lineTo(x1 + 0.6 * ppm, topY + 2); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.fillStyle = pattern(ctx, m.roof, texScale); ctx.beginPath(); ctx.moveTo(x0 - 0.6 * ppm, topY + 2); ctx.lineTo((x0 + x1) / 2, topY - rh); ctx.lineTo((x0 + x1) / 2, topY - rh + 0.25 * ppm); ctx.lineTo(x0 - 0.3 * ppm, topY + 2); ctx.fill(); }
    else { ctx.fillRect(x0 - 0.3 * ppm, topY - 0.45 * ppm, x1 - x0 + 0.6 * ppm, 0.45 * ppm); }
  } else { // scaffolding while it is being built
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = Math.max(1, ppm * 0.09); const fullTop = g - H;
    for (let xx = x0; xx <= x1 + 1; xx += (x1 - x0) / 3) { ctx.beginPath(); ctx.moveTo(xx, g); ctx.lineTo(xx, fullTop); ctx.stroke(); }
    for (let yy = g; yy >= fullTop; yy -= fh / 2) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
  }
  // burn + damage look
  if (b.char > 0.02) { ctx.fillStyle = `rgba(20,12,8,${Math.min(0.85, b.char)})`; ctx.fillRect(x0 - wall, topY - 3.5 * ppm, x1 - x0 + wall * 2, g - topY + 3.5 * ppm); }
  if (b.frost > 0.02) { ctx.fillStyle = `rgba(200,235,255,${b.frost * 0.5})`; ctx.fillRect(x0 - wall, topY - 3 * ppm, x1 - x0 + wall * 2, g - topY + 3 * ppm); }
  // sign
  if (prog >= 1 && ppm > 18) {
    const label = b.name || T.name; ctx.font = `600 ${Math.max(9, ppm * 0.42)}px "UG Cond", sans-serif`; const tw = ctx.measureText(label).width;
    const sx = (x0 + x1) / 2; const sh = ppm * 0.62;
    // the sign hangs on the front, just under the roof
    const sy = topY + 0.25 * ppm;
    if (T.fl >= 1 && b.type !== 'hut' && b.type !== 'house' && b.type !== 'apartment') { ctx.fillStyle = 'rgba(28,22,16,0.92)'; ctx.fillRect(sx - tw / 2 - 7, sy, tw + 14, sh); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(sx - tw / 2 - 7, sy, tw + 14, sh); ctx.fillStyle = '#f3e7cc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, sx, sy + sh / 2 + 1); ctx.textBaseline = 'alphabetic'; }
  }
  ctx.restore();
}
function drawFurn(ctx, b, f, ppm, fh) {
  const [id, fx, floor, sc, lift] = f; const im = spriteImg(id), me = spriteMeta(id); if (!im || !me) return;
  const w = me.w * ppm * (sc || 1), h = me.h * ppm * (sc || 1);
  const x = b.x + b.w * ppm * fx - w / 2, y = b.y - floor * fh - h - (lift ? lift * ppm : 0) - 0.1 * ppm;
  ctx.drawImage(im, x, y, w, h);
}
function drawFarm(ctx, b, ppm, prog) {
  const x0 = b.x, x1 = b.x + b.w * ppm, g = b.y; const grow = b.crop ?? 0.5;
  ctx.fillStyle = 'rgba(70,45,25,0.85)'; ctx.fillRect(x0, g - 0.15 * ppm, x1 - x0, 0.3 * ppm);
  const rows = Math.floor(b.w / 0.8);
  for (let i = 0; i < rows * prog; i++) {
    const cx = x0 + (i + 0.5) * (x1 - x0) / rows; const h = (0.25 + grow * 1.1) * ppm;
    ctx.strokeStyle = grow > 0.85 ? '#c9a43a' : '#5d8f2f'; ctx.lineWidth = Math.max(1, ppm * 0.06);
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx + k * 0.12 * ppm, g); ctx.quadraticCurveTo(cx + k * 0.25 * ppm, g - h * 0.6, cx + k * 0.3 * ppm, g - h); ctx.stroke(); }
    if (grow > 0.6) { ctx.fillStyle = grow > 0.85 ? '#e0b84a' : '#8db34a'; ctx.beginPath(); ctx.ellipse(cx, g - h, 0.09 * ppm, 0.2 * ppm, 0, 0, 7); ctx.fill(); }
  }
  // fence
  ctx.strokeStyle = '#6b4d2e'; ctx.lineWidth = Math.max(1, ppm * 0.08);
  for (let xx = x0; xx <= x1; xx += 1.5 * ppm) { ctx.beginPath(); ctx.moveTo(xx, g); ctx.lineTo(xx, g - 1 * ppm); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x0, g - 0.75 * ppm); ctx.lineTo(x1, g - 0.75 * ppm); ctx.moveTo(x0, g - 0.4 * ppm); ctx.lineTo(x1, g - 0.4 * ppm); ctx.stroke();
}
function drawWell(ctx, b, ppm, prog, ts) {
  const x0 = b.x, w = b.w * ppm, g = b.y;
  ctx.fillStyle = pattern(ctx, 'castle_brick_01', ts * 0.5); ctx.fillRect(x0, g - 0.9 * ppm * prog, w, 0.9 * ppm * prog);
  if (prog >= 1) {
    ctx.strokeStyle = '#4a3626'; ctx.lineWidth = Math.max(1, ppm * 0.12); ctx.beginPath(); ctx.moveTo(x0 + 0.15 * ppm, g - 0.9 * ppm); ctx.lineTo(x0 + 0.15 * ppm, g - 2.2 * ppm); ctx.lineTo(x0 + w - 0.15 * ppm, g - 2.2 * ppm); ctx.lineTo(x0 + w - 0.15 * ppm, g - 0.9 * ppm); ctx.stroke();
    ctx.fillStyle = pattern(ctx, 'dark_wooden_planks', ts); ctx.beginPath(); ctx.moveTo(x0 - 0.3 * ppm, g - 2.1 * ppm); ctx.lineTo(x0 + w / 2, g - 2.9 * ppm); ctx.lineTo(x0 + w + 0.3 * ppm, g - 2.1 * ppm); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 + w / 2, g - 2.2 * ppm); ctx.lineTo(x0 + w / 2, g - 1.4 * ppm); ctx.stroke();
    ctx.fillStyle = '#5a4630'; ctx.fillRect(x0 + w / 2 - 0.15 * ppm, g - 1.45 * ppm, 0.3 * ppm, 0.3 * ppm);
  }
}
// floor heights (world y) inside a building: index 0 = ground floor
export function floorY(b, f, ppm) { const T = BT[b.type]; return b.y - f * (T.fh || 3) * ppm; }
export function buildingTop(b, ppm) { const T = BT[b.type]; return b.y - (T.fl || 0) * (T.fh || 3) * ppm; }
