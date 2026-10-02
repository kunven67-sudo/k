
// ---------- pixel art: item icons (12x12 templates, recoloured per item) ----------
const ICON_T = {
  sword: { g: [1, 11], a: -Math.PI / 4, rows: [
    '..........kk', '.........khk', '........khbk', '.......khbk.', '......khbk..', '..k..khbk...',
    '..kgkhbk....', '...kgbk.....', '..kpkgk.....', '.kpk.kgk....', 'kmk...k.....', '.k..........'] },
  dagger: { g: [1, 10], a: -Math.PI / 4, rows: [
    '............', '............', '........kk..', '.......khk..', '......khbk..', '.....khbk...',
    '..k.khbk....', '..kgkbk.....', '...kgk......', '..kpkgk.....', '.kmk..k.....', '..k.........'] },
  axe: { g: [0, 11], a: -0.95, rows: [
    '......kkk...', '.....kbbbk..', '....kbhhbbk.', '....kbhbbbk.', '....kkbbbk..', '...kpkkkk...',
    '..kpk.......', '..kpk.......', '.kpk........', '.kpk........', 'kpk.........', 'kk..........'] },
  hammer: { g: [6, 10], a: -Math.PI / 2, rows: [
    '...kkkkkk...', '..kbhhhbbk..', '..kbhbbbbk..', '..kbbbbbbk..', '...kkkkkk...', '.....kpk....',
    '.....kpk....', '.....kpk....', '.....kpk....', '.....kpk....', '....kmmmk...', '.....kkk....'] },
  bow: { g: [2, 6], a: Math.PI, rows: [
    '....kk......', '...kbk.k....', '..kbk..s....', '..kbk..s....', '.kbk...s....', '.kgk...s....',
    '.kgk...s....', '.kbk...s....', '..kbk..s....', '..kbk..s....', '...kbk.k....', '....kk......'] },
  staff: { g: [2, 11], a: -0.95, rows: [
    '........kkk.', '.......kgogk', '.......kohok', '.......kgogk', '........kpk.', '.......kpk..',
    '......kpk...', '.....kpk....', '....kpk.....', '...kpk......', '..kpk.......', '..kk........'] },
  scythe: { g: [4, 11], a: -1.15, rows: [
    '...kkkkk....', '..kbbhhbk...', '.kbkkkkbpk..', '.kk....kpk..', 'k......kpk..', '.......kpk..',
    '......kpk...', '......kpk...', '.....kpk....', '.....kpk....', '....kpk.....', '....kk......'] },
  shield: { rows: [
    '...kkkkkk...', '..krrrrrrk..', '.krffffffrk.', 'krffffeffffk', 'krfffeeefffk', 'krffffeffffk',
    'krffffffffrk', 'krffffffffrk', '.krffffffrk.', '..krrrrrrk..', '...kkkkkk...', '............'] },
  kite: { rows: [
    '.kkkkkkkkkk.', '.krrrrrrrrk.', '.krfffeffrk.', '.krffeeefrk.', '.krfffeffrk.', '.krffffffrk.',
    '..krffffrk..', '..krffffrk..', '...krffrk...', '....krrk....', '.....kk.....', '............'] },
  armor: { rows: [
    '............', '.kkk....kkk.', 'kaatk..ktaak', 'kaaatkktaaak', 'kaaaattaaaak', '.kaaaaaaaak.',
    '.kaattttaak.', '.kaaaaaaaak.', '.kaaaaaaaak.', '.kttttttttk.', '.kkkkkkkkkk.', '............'] },
  potion: { rows: [
    '....kkkk....', '....kcck....', '.....kk.....', '....kwwk....', '...kwlllk...', '..kwhllllk..',
    '.kwhllllllk.', '.kllllllldk.', '.kllllllldk.', '..kllllldk..', '...kkkkkk...', '............'] },
  blob: { rows: [
    '............', '............', '.....kk.....', '....khlk....', '...khllk....', '..khllllk...',
    '..kllllllk..', '.kllllllllk.', '.kllllllldk.', '.kddddddddk.', '..kkkkkkkk..', '............'] },
  wing: { rows: [
    '............', 'k...........', 'kk..........', 'k1k.........', 'k11kk.......', 'k1111kk.....',
    'k111111kk...', '.k11111111k.', '..k1k1k1k1k.', '...k.k.k.k..', '............', '............'] },
  pelt: { rows: [
    '............', '..k......k..', '.k1k....k1k.', '.k11kkkk11k.', '.k12111121k.', '..k111111k..',
    '..k111111k..', '.k11111111k.', '.k1k1111k1k.', '.kk.k11k.kk.', '....kkkk....', '............'] },
  fang: { rows: [
    '............', '........kk..', '.......k1k..', '......k11k..', '.....k112k..', '....k112k...',
    '...k112k....', '..k112k.....', '.k122k......', '.k22k.......', '.kkk........', '............'] },
  bone: { rows: [
    '............', '............', '.kk......kk.', 'k11k....k11k', 'k111kkkk111k', '.k11111111k.',
    '.k12222221k.', 'k111kkkk111k', 'k11k....k11k', '.kk......kk.', '............', '............'] },
  skull: { rows: [
    '............', '...kkkkkk...', '..k111111k..', '.k11111111k.', '.k1ee11ee1k.', '.k1ee11ee1k.',
    '.k111kk111k.', '..k111111k..', '..k1k11k1k..', '...kkkkkk...', '............', '............'] },
  silk: { rows: [
    '............', '....kkkk....', '..kk1121kk..', '.k11211211k.', '.k12112112k.', 'k1121121121k',
    'k1211211211k', '.k11211211k.', '.k12112112k.', '..kk1121kk..', '....kkkk....', '............'] },
  gem: { rows: [
    '............', '............', '...kkkkkk...', '..khllllldk.', '.khllllllldk', '.kllllllldk.',
    '..kllllldk..', '...kllldk...', '....kldk....', '.....kk.....', '............', '............'] },
  orb: { rows: [
    '............', '....kkkk....', '..kkhhllkk..', '.khhllllllk.', '.khlllllldk.', 'kllllllllldk',
    'kllllllllddk', '.kllllllddk.', '.kllllldddk.', '..kkdddddk..', '....kkkk....', '............'] },
  bar: { rows: [
    '............', '............', '............', '...kkkkkkk..', '..khhhhhlk..', '.kllllllllk.',
    '.klllllllldk', '.kddddddddk.', '.kkkkkkkkkk.', '............', '............', '............'] },
  crown: { rows: [
    '............', '............', '.k...kk...k.', 'kgk.kggk.kgk', 'kggkgggkkggk', 'kgggrgggrggk',
    'kggggggggggk', 'kddddddddddk', '.kkkkkkkkkk.', '............', '............', '............'] },
  map: { rows: [
    '............', '.kkkkkkkkkk.', 'kppppppppppk', 'kpgggpbbbppk', 'kpggpbbbbppk', 'kppgpbbxbppk',
    'kpgggpbbpppk', 'kpggggpppgpk', 'kppggppppggk', 'kppppppppppk', '.kkkkkkkkkk.', '............'] },
};
const COIN_ROWS = ['..kkkk..', '.khyyyk.', 'khyyyydk', 'khyddydk', 'kyyddydk', 'kyyyyydk', '.kddddk.', '..kkkk..'];
const COIN_SPR = spr(COIN_ROWS, { k: '#3b2508', h: '#fff6c8', y: '#f2c13a', d: '#b9821c' });
const OUT = '#140d1a';
const _icon = {}, _iconURL = {};
function itemIcon(id) {
  if (_icon[id]) return _icon[id];
  const it = ITEMS[id]; const t = ICON_T[it.icon];
  return (_icon[id] = spr(t.rows, Object.assign({ k: OUT }, it.pal)));
}
function iconURL(id) { return _iconURL[id] || (_iconURL[id] = itemIcon(id).toDataURL()); }

// ---------- creature sprites ----------
const CREATURE_T = {
  slime: [[
    '................', '......kkkk......', '....kk2221kk....', '...k221111111k..', '..k22111111111k.', '.k1211111111111k',
    '.k1111111111111k', '.k11we11111we11k', '.k11ee11111ee11k', '.k1111111111111k', '.k3111111111113k', '..k33333333333k.', '...kkkkkkkkkkk..']],
  bat: [[
    'k..............k', '1k............k1', '11k..k....k..k11', '111k.k1kk1k.k111', '1111k111111k1111',
    '.111k1e11e1k111.', '..11k111111k11..', '....k1t11t1k....', '.....k.kk.k.....', '................'], [
    '................', '................', '.....k....k.....', '.....k1kk1k.....', '....k111111k....',
    '...k11e11e11k...', '..k1k111111k1k..', '.k11k1t11t1k11k.', 'k111.k.kk.k.111k', '11............11']],
  wolf: [[
    '....................', '...............k.k..', '..............k1k1k.', '.k...........k11111k', 'k1k.kkkkkkkkk111e11k',
    '.k1k111111111111111n', '..k1111111111111111k', '..k2111111111111kkk.', '..k22222222222222k..', '...k2k.k2k..k2k.k2k.',
    '...k2k.k2k..k2k.k2k.', '...kk..kk....kk..kk.'], [
    '....................', '...............k.k..', '..............k1k1k.', '.k...........k11111k', 'k1k.kkkkkkkkk111e11k',
    '.k1k111111111111111n', '..k1111111111111111k', '..k2111111111111kkk.', '..k22222222222222k..', '..k2k..k2k...k2k.k2k',
    '..k2k..k2k...k2k.k2k', '..kk...kk....kk..kk.']],
  spider: [[
    '..................', 'k...k........k...k', '.k...k......k...k.', '..k...kkkkkk...k..', '...k.k111111k.k...',
    'kk..k12111111k..kk', '..kk1111111111kk..', '....k1e1ee1e1k....', '..kk.k111111k.kk..', '.k...kt1111tk...k.', 'k...k..kkkk..k...k', '..................'], [
    '..................', '.k...k......k...k.', 'k...k........k...k', '..k...kkkkkk...k..', '...k.k111111k.k...',
    'kk..k12111111k..kk', '..kk1111111111kk..', '....k1e1ee1e1k....', '..kk.k111111k.kk..', 'k...kt1111tk...k..', '.k...k.kkkk.k...k.', '..................']],
};
const CHEST_ROWS = {
  closed: ['................', '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kwhhhhhhhhhhwk.', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kkkkkkggkkkkkk.',
    '.kwwwwwgywwwwwk.', '.kwwwwwggwwwwwk.', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kwwwwwwwwwwwwk.', '.kddddddddddddk.', '..kkkkkkkkkkkk..'],
  open: ['..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kddddddddddddk.', '.k000000000000k.', '.k000000000000k.', '.kkkkkkkkkkkkkk.',
    '.kwwwwwwwwwwwwk.', '.kwwwwwwwwwwwwk.', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kwwwwwwwwwwwwk.', '.kddddddddddddk.', '..kkkkkkkkkkkk..'],
};
const CHEST_PAL = {
  wood: { k: OUT, w: '#8a5a2b', h: '#b07a3e', m: '#5d6470', g: '#f2c13a', y: '#fff3b0', d: '#5a3818', '0': '#1a0f08' },
  gold: { k: OUT, w: '#c8922a', h: '#f7d36a', m: '#7a3b9a', g: '#ffe08a', y: '#ffffff', d: '#8a5a14', '0': '#1a0f08' },
};
const CHEST_SPR = {};
for (const p in CHEST_PAL) CHEST_SPR[p] = { closed: spr(CHEST_ROWS.closed, CHEST_PAL[p]), open: spr(CHEST_ROWS.open, CHEST_PAL[p]) };

// Humanoid monsters reuse the people renderer plus a few extra parts, baked into 4 walk frames.
function drawExtras(ctx, x, y, L, before) {
  const ox = Math.round(x) - 6, oy = Math.round(y) - 20;
  const R = (ix, iy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + ix, oy + iy, w, h); };
  if (before) {
    if (L.wings) { R(-3, 7, 3, 2, L.wings); R(-4, 9, 4, 3, L.wings); R(12, 7, 3, 2, L.wings); R(12, 9, 4, 3, L.wings); }
    if (L.cape) { R(1, 9, 10, 9, L.cape); }
    return;
  }
  if (L.ears) { R(1, 3, 2, 2, L.skin); R(0, 2, 1, 2, L.skin); R(9, 3, 2, 2, L.skin); R(11, 2, 1, 2, L.skin); }
  if (L.horns) { R(3, 0, 1, 2, L.horns); R(2, -1, 1, 2, L.horns); R(8, 0, 1, 2, L.horns); R(9, -1, 1, 2, L.horns); }
  if (L.skull) { R(4, 4, 2, 2, '#120a10'); R(7, 4, 2, 2, '#120a10'); R(6, 7, 1, 1, '#120a10'); R(4, 8, 5, 1, '#120a10'); if (L.eyes) { R(5, 5, 1, 1, L.eyes); R(8, 5, 1, 1, L.eyes); } }
  else if (L.eyes) { R(6, 5, 1, 1, L.eyes); R(8, 5, 1, 1, L.eyes); }
  if (L.ribs) { R(3, 10, 6, 1, L.ribs); R(3, 12, 6, 1, L.ribs); R(5, 9, 2, 5, L.ribs); }
  if (L.tusks) { R(4, 7, 1, 2, '#f4ecd8'); R(8, 7, 1, 2, '#f4ecd8'); }
  if (L.spots) { R(3, 10, 2, 2, L.spots); R(7, 12, 2, 1, L.spots); R(4, 2, 2, 1, L.spots); }
  if (L.crown) { R(3, 0, 6, 2, '#f2c13a'); R(3, -1, 1, 1, '#f2c13a'); R(5, -1, 2, 1, '#f2c13a'); R(8, -1, 1, 1, '#f2c13a'); R(5, 1, 2, 1, '#d8454a'); }
  if (L.feather) { R(5, -3, 2, 4, '#d8454a'); R(7, -2, 2, 3, '#f2b53a'); }
  switch (L.weapon) {
    case 'club': R(12, 8, 2, 7, '#7a4a24'); R(11, 6, 4, 3, '#5a3418'); break;
    case 'sword': R(12, 4, 1, 10, '#d7dde6'); R(11, 12, 3, 1, '#8a8f99'); R(12, 13, 1, 2, '#5a3418'); break;
    case 'bigsword': R(12, 1, 2, 13, '#d7dde6'); R(10, 12, 6, 1, '#f2c13a'); R(12, 13, 2, 2, '#5a3418'); break;
    case 'axe': R(12, 5, 1, 10, '#6b4423'); R(13, 4, 3, 4, '#aab2bd'); R(13, 4, 1, 4, '#d7dde6'); break;
    case 'bow': R(13, 6, 1, 9, '#8a5a2b'); R(12, 5, 1, 1, '#8a5a2b'); R(12, 15, 1, 1, '#8a5a2b'); R(11, 6, 1, 9, '#e8e0cc'); break;
    case 'staff': R(12, 2, 1, 14, '#5a3a20'); R(11, 0, 3, 3, L.orb || '#b878ea'); break;
    case 'fist': R(10, 12, 3, 3, L.skin); break;
  }
}
function buildHumanoid(L) {
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const [c, x] = mkCanvas(20, 26);
    const phase = [0, Math.PI / 2, 0, -Math.PI / 2][i];
    drawExtras(x, 10, 25, L, true);
    drawHuman(x, 10, 25, L, { face: 1, moving: i % 2 === 1, walk: phase, armor: L.armor, trim: L.trim, helm: L.helm });
    drawExtras(x, 10, 25, L, false);
    frames.push(c);
  }
  return frames;
}

// ---------- tiny drawing primitives used by the renderer ----------
function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function shadow(ctx, x, y, w) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), w, Math.max(2, w * 0.4), 0, 0, TAU); ctx.fill(); }
// pixel text with a hard 1px outline (canvas fonts at 8px stay crisp after the nearest-neighbour upscale)
const PFONT = '8px "Press Start 2P", ui-monospace, monospace';
function ptext(ctx, s, x, y, col, align = 'center', font = PFONT) {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#000';
  ctx.fillText(s, x - 1, y); ctx.fillText(s, x + 1, y); ctx.fillText(s, x, y - 1); ctx.fillText(s, x, y + 1);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
