
// =====================================================================
// TILES — ids, collision, surfaces, and painting into a baked layer.
// Trees, water shimmer, lava glow and waves are animated live in render.
// =====================================================================
const TILE = 16;
const T = { VOID: 0, GRASS: 1, PATH: 2, WATER: 3, TREE: 4, FLOWERS: 5, PLAZA: 6, SAND: 7, BRIDGE: 8, ROCK: 9, WALL: 10, FLOOR: 11, LAVA: 12, DGRASS: 13, SHALLOW: 14, SNOW: 15, ICE: 16, PINE: 17, BOG: 18, DEAD: 19, MUD: 20, CACTUS: 21, RUIN: 22, OCEAN: 23, DOCK: 24, PALM: 25, WOOD: 26, IWALL: 27, SPRING: 28, DUNE: 29, SNOWPINE: 30, WILLOW: 31, SNOWROCK: 32 };
const SOLID_T = new Uint8Array(64); [T.VOID, T.WATER, T.TREE, T.ROCK, T.WALL, T.PINE, T.DEAD, T.CACTUS, T.RUIN, T.OCEAN, T.PALM, T.IWALL, T.SNOWPINE, T.WILLOW, T.SNOWROCK].forEach((t) => (SOLID_T[t] = 1));
const TREE_KIND = { [T.TREE]: 'oak', [T.PINE]: 'pine', [T.SNOWPINE]: 'snowpine', [T.DEAD]: 'dead', [T.PALM]: 'palm', [T.CACTUS]: 'cactus', [T.WILLOW]: 'willow' };
const SURFACE = { [T.GRASS]: 'grass', [T.DGRASS]: 'grass', [T.FLOWERS]: 'grass', [T.PATH]: 'grass', [T.PLAZA]: 'stone', [T.FLOOR]: 'stone', [T.RUIN]: 'stone', [T.LAVA]: 'stone', [T.BRIDGE]: 'wood', [T.DOCK]: 'wood', [T.WOOD]: 'wood', [T.SHALLOW]: 'water', [T.BOG]: 'water', [T.SPRING]: 'water', [T.SAND]: 'sand', [T.DUNE]: 'sand', [T.SNOW]: 'snow', [T.ICE]: 'snow', [T.MUD]: 'mud' };
const SPEED_T = { [T.SHALLOW]: 0.8, [T.BOG]: 0.65, [T.MUD]: 0.85, [T.SNOW]: 0.9, [T.SAND]: 0.94, [T.DUNE]: 0.88, [T.SPRING]: 0.85 };
function makeMap(w, h, fill) { return { w, h, t: new Uint8Array(w * h).fill(fill), block: new Uint8Array(w * h), layer: null, explored: null, flow: new Int16Array(w * h).fill(-1), flowKey: -1 }; }
const tileAt = (m, tx, ty) => (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h ? T.VOID : m.t[ty * m.w + tx]);
function solidAt(m, tx, ty) { if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true; const i = ty * m.w + tx; return SOLID_T[m.t[i]] === 1 || m.block[i] === 1; }
const isWaterish = (t) => t === T.WATER || t === T.OCEAN || t === T.SHALLOW || t === T.BOG || t === T.SPRING;

// ---------- painting ----------
function speckle(x, X, Y, tx, ty, base, a, b, n = 7) {
  px(x, X, Y, 16, 16, base);
  for (let i = 0; i < n; i++) { const r = hash2(tx, ty, i), r2 = hash2(ty, tx, i + 9); px(x, X + Math.floor(r * 15), Y + Math.floor(r2 * 15), 1, i < n / 2 ? 2 : 1, i % 2 ? a : b); }
}
function groundUnder(m, tx, ty) { // what a tree stands on
  const t = m.t[ty * m.w + tx];
  if (t === T.SNOWPINE) return T.SNOW; if (t === T.PALM || t === T.CACTUS) return T.SAND; if (t === T.DEAD || t === T.WILLOW) return T.MUD;
  return m.biome === 'frost' ? T.SNOW : T.DGRASS;
}
function paintTile(x, m, tx, ty, theme, tOverride) {
  const X = tx * TILE, Y = ty * TILE, t = tOverride != null ? tOverride : m.t[ty * m.w + tx], h = hash2(tx, ty);
  switch (t) {
    case T.GRASS: speckle(x, X, Y, tx, ty, m.biome === 'coast' ? '#4a8a3c' : '#3f7a3a', '#4f8f45', '#356a32'); break;
    case T.DGRASS: speckle(x, X, Y, tx, ty, m.biome === 'swamp' ? '#2e4a2a' : '#376d34', m.biome === 'swamp' ? '#3a5a32' : '#4a8540', m.biome === 'swamp' ? '#243a22' : '#2f6030'); break;
    case T.FLOWERS: {
      speckle(x, X, Y, tx, ty, '#3f7a3a', '#4f8f45', '#356a32');
      const cols = ['#f2c13a', '#efe4cc', '#e0607a', '#b878ea'];
      for (let i = 0; i < 3; i++) { const fx = X + 2 + Math.floor(hash2(tx, ty, 20 + i) * 12), fy = Y + 2 + Math.floor(hash2(ty, tx, 30 + i) * 12); px(x, fx, fy, 2, 2, cols[Math.floor(hash2(tx, ty, 40 + i) * 4)]); px(x, fx, fy + 2, 1, 2, '#2f6a2a'); }
      break;
    }
    case T.PATH: speckle(x, X, Y, tx, ty, m.biome === 'frost' ? '#a89a8a' : m.biome === 'swamp' ? '#5a4a32' : '#9a7a4a', '#836540', '#b08f5a', 6); break;
    case T.MUD: speckle(x, X, Y, tx, ty, '#4a3a28', '#3a2c1e', '#5a4832', 6); if (h < 0.2) px(x, X + 4, Y + 6, 5, 2, '#2e3a22'); break;
    case T.PLAZA: px(x, X, Y, 16, 16, '#8f897c'); px(x, X, Y + 7, 16, 1, '#6e695f'); px(x, X, Y + 15, 16, 1, '#6e695f'); px(x, X + (ty % 2 ? 3 : 11), Y, 1, 7, '#6e695f'); px(x, X + (ty % 2 ? 11 : 3), Y + 8, 1, 7, '#6e695f'); px(x, X + 1, Y + 1, 2, 1, '#a8a294'); break;
    case T.SAND: speckle(x, X, Y, tx, ty, '#d6c08a', '#b8a06a', '#e8d4a0', 5); break;
    case T.DUNE: speckle(x, X, Y, tx, ty, '#cfb47a', '#b89a5a', '#e0c890', 5); px(x, X + 2, Y + 5 + Math.floor(h * 6), 12, 1, '#b89a5a'); break;
    case T.SNOW: speckle(x, X, Y, tx, ty, '#e8eef4', '#d0dce8', '#ffffff', 6); break;
    case T.ICE: px(x, X, Y, 16, 16, '#a8d0e8'); px(x, X + 2, Y + 3 + Math.floor(h * 8), 6, 1, '#d8f0ff'); px(x, X + 9, Y + 9, 4, 1, '#d8f0ff'); if (h > 0.7) px(x, X + 5, Y + 4, 1, 7, '#88b0cc'); break;
    case T.WATER: case T.OCEAN: px(x, X, Y, 16, 16, t === T.OCEAN ? '#235a8a' : '#2f5f9a'); { const up = tileAt(m, tx, ty - 1); if (!isWaterish(up) && up !== T.BRIDGE && up !== T.DOCK) px(x, X, Y, 16, 2, '#9fd0f0'); } break;
    case T.SHALLOW: px(x, X, Y, 16, 16, '#4f8fbf'); for (let i = 0; i < 4; i++) px(x, X + Math.floor(hash2(tx, ty, i) * 14), Y + Math.floor(hash2(ty, tx, i) * 14), 2, 1, '#7aaecc'); break;
    case T.BOG: px(x, X, Y, 16, 16, '#3a4a22'); for (let i = 0; i < 4; i++) px(x, X + Math.floor(hash2(tx, ty, i) * 13), Y + Math.floor(hash2(ty, tx, i) * 13), 3, 2, '#4e6a2a'); break;
    case T.SPRING: px(x, X, Y, 16, 16, '#3aa0b8'); px(x, X + 3, Y + 4, 5, 1, '#9ff0ff'); px(x, X + 9, Y + 10, 4, 1, '#9ff0ff'); break;
    case T.BRIDGE: case T.DOCK: {
      px(x, X, Y, 16, 16, t === T.DOCK ? '#235a8a' : '#2f5f9a'); px(x, X, Y, 16, 16, '#8a5a2b');
      const vertical = [tileAt(m, tx, ty - 1), tileAt(m, tx, ty + 1)].some((u) => u === T.BRIDGE || u === T.DOCK || u === T.PATH);
      for (let i = 0; i < 4; i++) vertical ? px(x, X, Y + i * 4 + 3, 16, 1, '#5a3818') : px(x, X + i * 4 + 3, Y, 1, 16, '#5a3818');
      break;
    }
    case T.ROCK: case T.SNOWROCK: {
      px(x, X, Y, 16, 16, t === T.SNOWROCK ? '#d0dce8' : h < 0.5 ? '#5f6a4a' : '#6a6450');
      px(x, X + 1, Y + 3, 14, 12, '#55575d'); px(x, X + 2, Y + 2, 12, 11, '#7d7f86'); px(x, X + 3, Y + 3, 5, 3, '#a0a3aa'); px(x, X + 2, Y + 12, 12, 2, '#44464b');
      if (t === T.SNOWROCK) { px(x, X + 2, Y + 2, 12, 3, '#ffffff'); px(x, X + 3, Y + 5, 4, 1, '#eef6ff'); }
      break;
    }
    case T.RUIN: px(x, X, Y, 16, 16, '#b8964a'); px(x, X, Y + 5, 16, 1, '#8a6a2a'); px(x, X, Y + 11, 16, 1, '#8a6a2a'); px(x, X + 6, Y, 1, 5, '#8a6a2a'); px(x, X + 11, Y + 6, 1, 5, '#8a6a2a'); px(x, X, Y, 16, 2, '#d8b468'); if (h < 0.3) px(x, X + 9, Y + 12, 4, 4, '#d6c08a'); break;
    case T.WOOD: px(x, X, Y, 16, 16, '#7a5232'); for (let i = 0; i < 4; i++) px(x, X, Y + i * 4, 16, 1, '#5a3a20'); px(x, X + (ty % 2 ? 4 : 11), Y, 1, 16, '#6a4628'); break;
    case T.IWALL: px(x, X, Y, 16, 16, '#5a4a3a'); px(x, X, Y + 12, 16, 4, '#3a2e22'); px(x, X, Y, 16, 1, '#6a5a48'); break;
    case T.FLOOR: {
      px(x, X, Y, 16, 16, (tx + ty) % 2 ? theme.floor : theme.floor2);
      if (theme.planks) { for (let i = 0; i < 4; i++) px(x, X, Y + i * 4, 16, 1, 'rgba(0,0,0,.22)'); px(x, X + ((tx * 7 + ty * 3) % 13), Y, 1, 16, 'rgba(0,0,0,.18)'); break; }
      px(x, X, Y, 16, 1, 'rgba(0,0,0,.18)'); px(x, X, Y, 1, 16, 'rgba(0,0,0,.18)');
      if (h < 0.25) { px(x, X + 4, Y + 6, 4, 1, 'rgba(0,0,0,.25)'); px(x, X + 7, Y + 7, 1, 3, 'rgba(0,0,0,.25)'); }
      if (h > 0.85) px(x, X + 10, Y + 10, 2, 2, 'rgba(255,255,255,.06)');
      if (h > 0.6 && h < 0.66) { px(x, X + 3, Y + 11, 2, 1, 'rgba(0,0,0,.3)'); px(x, X + 9, Y + 4, 1, 1, 'rgba(255,255,255,.08)'); }
      floorShade(x, m, tx, ty, X, Y);
      break;
    }
    case T.LAVA: px(x, X, Y, 16, 16, '#b8381a'); for (let i = 0; i < 3; i++) px(x, X + Math.floor(hash2(tx, ty, i) * 12), Y + Math.floor(hash2(ty, tx, i) * 12), 4, 3, '#ff8a2a'); break;
    case T.WALL: {
      const below = tileAt(m, tx, ty + 1);
      if (!SOLID_T[below] && below !== T.VOID) { // wall face with bricks
        px(x, X, Y, 16, 16, theme.face); px(x, X, Y, 16, 3, theme.top);
        for (let r = 0; r < 3; r++) { const yy = Y + 3 + r * 4 + 3; px(x, X, yy, 16, 1, theme.wall); const off = (r + tx) % 2 ? 4 : 12; px(x, X + off, yy - 3, 1, 3, theme.wall); }
        px(x, X, Y + 15, 16, 1, 'rgba(0,0,0,.45)'); px(x, X, Y + 11, 16, 4, 'rgba(0,0,0,.14)'); px(x, X, Y + 3, 16, 1, 'rgba(255,255,255,.08)');
        if (h < 0.18) { px(x, X + 2 + Math.floor(h * 40), Y + 11, 3, 4, 'rgba(70,110,50,.55)'); px(x, X + 3 + Math.floor(h * 40), Y + 9, 1, 2, 'rgba(70,110,50,.55)'); }
        else if (h > 0.82) { px(x, X + 7, Y + 5, 1, 3, 'rgba(0,0,0,.35)'); px(x, X + 8, Y + 8, 1, 2, 'rgba(0,0,0,.35)'); }
        if (theme.deco === 'icicle' && h < 0.5) { px(x, X + 4, Y + 16 - 1, 1, 1, '#d8f0ff'); }
      } else {
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const n = tileAt(m, tx + dx, ty + dy); if (!SOLID_T[n] && n !== T.VOID) { near = true; break; } }
        px(x, X, Y, 16, 16, near ? theme.wall : '#07050a');
        if (near) { // the top of the wall: stone caps with a lit rim along every edge that drops to the floor
          px(x, X, Y + 7, 16, 1, 'rgba(0,0,0,.22)'); px(x, X + ((tx + ty) % 2 ? 5 : 11), Y, 1, 7, 'rgba(0,0,0,.18)'); px(x, X + ((tx + ty) % 2 ? 11 : 4), Y + 8, 1, 8, 'rgba(0,0,0,.18)');
          px(x, X + 2, Y + 2, 3, 1, 'rgba(255,255,255,.07)');
          const open = (dx, dy) => { const n = tileAt(m, tx + dx, ty + dy); return !SOLID_T[n] && n !== T.VOID; };
          const faceBelow = tileAt(m, tx, ty + 1) === T.WALL && open(0, 2);
          if (faceBelow || open(0, 1)) px(x, X, Y + 15, 16, 1, theme.top);
          if (open(-1, 0)) px(x, X, Y, 1, 16, theme.top); if (open(1, 0)) px(x, X + 15, Y, 1, 16, theme.top); if (open(0, -1)) px(x, X, Y, 16, 1, theme.top);
        }
      }
      break;
    }
    default:
      if (TREE_KIND[t]) { paintTile(x, m, tx, ty, theme, groundUnder(m, tx, ty)); break; }
      px(x, X, Y, 16, 16, '#07050a');
  }
}
// soft shadow on the floor where it meets a wall (Moonlighter-style depth)
function floorShade(x, m, tx, ty, X, Y) {
  const wall = (dx, dy) => { const n = tileAt(m, tx + dx, ty + dy); return n === T.WALL || n === T.VOID || n === T.IWALL; };
  if (wall(0, -1)) { px(x, X, Y, 16, 3, 'rgba(0,0,0,.32)'); px(x, X, Y + 3, 16, 2, 'rgba(0,0,0,.15)'); }
  if (wall(-1, 0)) px(x, X, Y, 2, 16, 'rgba(0,0,0,.22)');
  if (wall(1, 0)) px(x, X + 14, Y, 2, 16, 'rgba(0,0,0,.16)');
  if (wall(0, 1)) px(x, X, Y + 15, 16, 1, 'rgba(0,0,0,.18)');
}
function renderLayer(m, theme) {
  const [c, x] = mkCanvas(m.w * TILE, m.h * TILE);
  for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) paintTile(x, m, tx, ty, theme);
  m.layer = c; return c;
}
// colours for minimaps
const TILE_COL = { [T.GRASS]: '#3f7a3a', [T.DGRASS]: '#376d34', [T.FLOWERS]: '#4a8a3a', [T.PATH]: '#a8865a', [T.WATER]: '#2f5f9a', [T.OCEAN]: '#235a8a', [T.SHALLOW]: '#4f8fbf', [T.TREE]: '#1f4a22', [T.PINE]: '#173d26', [T.SNOWPINE]: '#4a6a5a', [T.DEAD]: '#4e463e', [T.WILLOW]: '#1d3a26', [T.PALM]: '#3a8a3a', [T.CACTUS]: '#3a8a4a', [T.PLAZA]: '#a8a294', [T.SAND]: '#d6c08a', [T.DUNE]: '#cfb47a', [T.BRIDGE]: '#8a5a2b', [T.DOCK]: '#8a5a2b', [T.ROCK]: '#6a6c72', [T.SNOWROCK]: '#c0ccd8', [T.SNOW]: '#e8eef4', [T.ICE]: '#a8d0e8', [T.BOG]: '#3a4a22', [T.MUD]: '#4a3a28', [T.RUIN]: '#b8964a', [T.WOOD]: '#7a5232', [T.IWALL]: '#3a2e22', [T.VOID]: '#07050a' };
