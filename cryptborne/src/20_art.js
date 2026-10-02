
// =====================================================================
// PIXEL ART — sprite helpers, item icons, creatures, and people.
// =====================================================================
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function spr(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const [c, x] = mkCanvas(w, h);
  for (let j = 0; j < h; j++) { const r = rows[j]; for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } } }
  return c;
}
const _flip = new WeakMap(), _white = new WeakMap(), _red = new WeakMap(), _dark = new WeakMap(), _ice = new WeakMap();
function flipped(c) {
  let f = _flip.get(c);
  if (!f) { const [n, x] = mkCanvas(c.width, c.height); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); _flip.set(c, (f = n)); }
  return f;
}
function tinted(c, map, color, alpha = 1) {
  let f = map.get(c);
  if (!f) {
    const [n, x] = mkCanvas(c.width, c.height); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = alpha; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    map.set(c, (f = n));
  }
  return f;
}
const whiteOf = (c) => tinted(c, _white, '#ffffff');
const redOf = (c) => tinted(c, _red, '#ff4040');
const darkOf = (c) => tinted(c, _dark, '#1a0f2a', 0.82);
const iceOf = (c) => tinted(c, _ice, '#9fe8ff', 0.55);
function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
function shadow(ctx, x, y, w) { ctx.fillStyle = 'rgba(0,0,0,.33)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), w, Math.max(2, w * 0.4), 0, 0, TAU); ctx.fill(); }
const OUT = '#140d1a';

// ---------- item icons (12x12 templates recoloured per item) ----------
// g = grip point and a = natural pointing angle, used to hold and swing weapons.
const ICON_T = {
  sword: { g: [1, 11], a: -Math.PI / 4, rows: ['..........kk', '.........khk', '........khbk', '.......khbk.', '......khbk..', '..k..khbk...', '..kgkhbk....', '...kgbk.....', '..kpkgk.....', '.kpk.kgk....', 'kmk...k.....', '.k..........'] },
  dagger: { g: [1, 10], a: -Math.PI / 4, rows: ['............', '............', '........kk..', '.......khk..', '......khbk..', '.....khbk...', '..k.khbk....', '..kgkbk.....', '...kgk......', '..kpkgk.....', '.kmk..k.....', '..k.........'] },
  axe: { g: [0, 11], a: -0.95, rows: ['......kkk...', '.....kbbbk..', '....kbhhbbk.', '....kbhbbbk.', '....kkbbbk..', '...kpkkkk...', '..kpk.......', '..kpk.......', '.kpk........', '.kpk........', 'kpk.........', 'kk..........'] },
  hammer: { g: [6, 10], a: -Math.PI / 2, rows: ['...kkkkkk...', '..kbhhhbbk..', '..kbhbbbbk..', '..kbbbbbbk..', '...kkkkkk...', '.....kpk....', '.....kpk....', '.....kpk....', '.....kpk....', '.....kpk....', '....kmmmk...', '.....kkk....'] },
  bow: { g: [2, 6], a: Math.PI, rows: ['....kk......', '...kbk.k....', '..kbk..s....', '..kbk..s....', '.kbk...s....', '.kgk...s....', '.kgk...s....', '.kbk...s....', '..kbk..s....', '..kbk..s....', '...kbk.k....', '....kk......'] },
  staff: { g: [2, 11], a: -0.95, rows: ['........kkk.', '.......kgogk', '.......kohok', '.......kgogk', '........kpk.', '.......kpk..', '......kpk...', '.....kpk....', '....kpk.....', '...kpk......', '..kpk.......', '..kk........'] },
  scythe: { g: [4, 11], a: -1.15, rows: ['...kkkkk....', '..kbbhhbk...', '.kbkkkkbpk..', '.kk....kpk..', 'k......kpk..', '.......kpk..', '......kpk...', '......kpk...', '.....kpk....', '.....kpk....', '....kpk.....', '....kk......'] },
  trident: { g: [5, 10], a: -Math.PI / 2, rows: ['k...k...k...', 'kbk.kbk.kbk.', 'kbk.kbk.kbk.', '.kbkkbkkbk..', '..kbbbbbk...', '....kpk.....', '....kpk.....', '....kpk.....', '....kpk.....', '....kpk.....', '....kpk.....', '.....k......'] },
  shield: { rows: ['...kkkkkk...', '..krrrrrrk..', '.krffffffrk.', 'krffffeffffk', 'krfffeeefffk', 'krffffeffffk', 'krffffffffrk', 'krffffffffrk', '.krffffffrk.', '..krrrrrrk..', '...kkkkkk...', '............'] },
  kite: { rows: ['.kkkkkkkkkk.', '.krrrrrrrrk.', '.krfffeffrk.', '.krffeeefrk.', '.krfffeffrk.', '.krffffffrk.', '..krffffrk..', '..krffffrk..', '...krffrk...', '....krrk....', '.....kk.....', '............'] },
  armor: { rows: ['............', '.kkk....kkk.', 'kaatk..ktaak', 'kaaatkktaaak', 'kaaaattaaaak', '.kaaaaaaaak.', '.kaattttaak.', '.kaaaaaaaak.', '.kaaaaaaaak.', '.kttttttttk.', '.kkkkkkkkkk.', '............'] },
  potion: { rows: ['....kkkk....', '....kcck....', '.....kk.....', '....kwwk....', '...kwlllk...', '..kwhllllk..', '.kwhllllllk.', '.kllllllldk.', '.kllllllldk.', '..kllllldk..', '...kkkkkk...', '............'] },
  blob: { rows: ['............', '............', '.....kk.....', '....khlk....', '...khllk....', '..khllllk...', '..kllllllk..', '.kllllllllk.', '.kllllllldk.', '.kddddddddk.', '..kkkkkkkk..', '............'] },
  wing: { rows: ['............', 'k...........', 'kk..........', 'k1k.........', 'k11kk.......', 'k1111kk.....', 'k111111kk...', '.k11111111k.', '..k1k1k1k1k.', '...k.k.k.k..', '............', '............'] },
  pelt: { rows: ['............', '..k......k..', '.k1k....k1k.', '.k11kkkk11k.', '.k12111121k.', '..k111111k..', '..k111111k..', '.k11111111k.', '.k1k1111k1k.', '.kk.k11k.kk.', '....kkkk....', '............'] },
  fang: { rows: ['............', '........kk..', '.......k1k..', '......k11k..', '.....k112k..', '....k112k...', '...k112k....', '..k112k.....', '.k122k......', '.k22k.......', '.kkk........', '............'] },
  bone: { rows: ['............', '............', '.kk......kk.', 'k11k....k11k', 'k111kkkk111k', '.k11111111k.', '.k12222221k.', 'k111kkkk111k', 'k11k....k11k', '.kk......kk.', '............', '............'] },
  skull: { rows: ['............', '...kkkkkk...', '..k111111k..', '.k11111111k.', '.k1ee11ee1k.', '.k1ee11ee1k.', '.k111kk111k.', '..k111111k..', '..k1k11k1k..', '...kkkkkk...', '............', '............'] },
  silk: { rows: ['............', '....kkkk....', '..kk1121kk..', '.k11211211k.', '.k12112112k.', 'k1121121121k', 'k1211211211k', '.k11211211k.', '.k12112112k.', '..kk1121kk..', '....kkkk....', '............'] },
  gem: { rows: ['............', '............', '...kkkkkk...', '..khllllldk.', '.khllllllldk', '.kllllllldk.', '..kllllldk..', '...kllldk...', '....kldk....', '.....kk.....', '............', '............'] },
  orb: { rows: ['............', '....kkkk....', '..kkhhllkk..', '.khhllllllk.', '.khlllllldk.', 'kllllllllldk', 'kllllllllddk', '.kllllllddk.', '.kllllldddk.', '..kkdddddk..', '....kkkk....', '............'] },
  bar: { rows: ['............', '............', '............', '...kkkkkkk..', '..khhhhhlk..', '.kllllllllk.', '.klllllllldk', '.kddddddddk.', '.kkkkkkkkkk.', '............', '............', '............'] },
  crown: { rows: ['............', '............', '.k...kk...k.', 'kgk.kggk.kgk', 'kggkgggkkggk', 'kgggrgggrggk', 'kggggggggggk', 'kddddddddddk', '.kkkkkkkkkk.', '............', '............', '............'] },
  map: { rows: ['............', '.kkkkkkkkkk.', 'kppppppppppk', 'kpgggpbbbppk', 'kpggpbbbbppk', 'kppgpbbxbppk', 'kpgggpbbpppk', 'kpggggpppgpk', 'kppggppppggk', 'kppppppppppk', '.kkkkkkkkkk.', '............'] },
  key: { rows: ['............', '..kkkk......', '.kyyyyk.....', 'kyykkyyk....', 'kyk..kyk....', 'kyykkyykkkkk', '.kyyyykyyyyk', '..kkkk.kykyk', '.......k.k.k', '............', '............', '............'] },
  scroll: { rows: ['............', '..kkkkkkkk..', '.kwppppppwk.', '.kkppppppkk.', '..kpllllpk..', '..kppppppk..', '..kplllppk..', '..kppppppk..', '..kpllllpk..', '.kkppppppkk.', '.kwppppppwk.', '..kkkkkkkk..'] },
  leg: { rows: ['............', '.....kk.....', '....k11k....', '....k11k....', '...k111k....', '...k12k.....', '..k12k......', '..k1k.......', '.k11k.......', 'k1k1k1k.....', 'kk.k.kk.....', '............'] },
  shell: { rows: ['............', '............', '...kkkkkk...', '..k111111k..', '.k12111121k.', 'k1111111111k', 'k1211111121k', 'k1111111111k', '.kkkkkkkkkk.', '.k.k....k.k.', '............', '............'] },
  scale: { rows: ['............', '.....kk.....', '....k11k....', '...k1211k...', '..k122111k..', '..k121111k..', '..k111112k..', '...k1112k...', '....k11k....', '.....kk.....', '............', '............'] },
};
const COIN_SPR = spr(['..kkkk..', '.khyyyk.', 'khyyyydk', 'khyddydk', 'kyyddydk', 'kyyyyydk', '.kddddk.', '..kkkk..'], { k: '#3b2508', h: '#fff6c8', y: '#f2c13a', d: '#b9821c' });
const _icon = {}, _iconURL = {};
function itemIcon(id) {
  if (_icon[id]) return _icon[id];
  const it = ITEMS[id], t = ICON_T[it.icon] || ICON_T.blob;
  return (_icon[id] = spr(t.rows, Object.assign({ k: OUT }, it.pal)));
}
function iconURL(id) { return _iconURL[id] || (_iconURL[id] = itemIcon(id).toDataURL()); }

// ---------- creature sprites (non-human monsters) ----------
const CREATURE_T = {
  slime: [['................', '......kkkk......', '....kk2221kk....', '...k221111111k..', '..k22111111111k.', '.k1211111111111k', '.k1111111111111k', '.k11we11111we11k', '.k11ee11111ee11k', '.k1111111111111k', '.k3111111111113k', '..k33333333333k.', '...kkkkkkkkkkk..']],
  bat: [['k..............k', '1k............k1', '11k..k....k..k11', '111k.k1kk1k.k111', '1111k111111k1111', '.111k1e11e1k111.', '..11k111111k11..', '....k1t11t1k....', '.....k.kk.k.....', '................'],
    ['................', '................', '.....k....k.....', '.....k1kk1k.....', '....k111111k....', '...k11e11e11k...', '..k1k111111k1k..', '.k11k1t11t1k11k.', 'k111.k.kk.k.111k', '11............11']],
  wolf: [['....................', '...............k.k..', '..............k1k1k.', '.k...........k11111k', 'k1k.kkkkkkkkk111e11k', '.k1k111111111111111n', '..k1111111111111111k', '..k2111111111111kkk.', '..k22222222222222k..', '...k2k.k2k..k2k.k2k.', '...k2k.k2k..k2k.k2k.', '...kk..kk....kk..kk.'],
    ['....................', '...............k.k..', '..............k1k1k.', '.k...........k11111k', 'k1k.kkkkkkkkk111e11k', '.k1k111111111111111n', '..k1111111111111111k', '..k2111111111111kkk.', '..k22222222222222k..', '..k2k..k2k...k2k.k2k', '..k2k..k2k...k2k.k2k', '..kk...kk....kk..kk.']],
  spider: [['..................', 'k...k........k...k', '.k...k......k...k.', '..k...kkkkkk...k..', '...k.k111111k.k...', 'kk..k12111111k..kk', '..kk1111111111kk..', '....k1e1ee1e1k....', '..kk.k111111k.kk..', '.k...kt1111tk...k.', 'k...k..kkkk..k...k', '..................'],
    ['..................', '.k...k......k...k.', 'k...k........k...k', '..k...kkkkkk...k..', '...k.k111111k.k...', 'kk..k12111111k..kk', '..kk1111111111kk..', '....k1e1ee1e1k....', '..kk.k111111k.kk..', 'k...kt1111tk...k..', '.k...k.kkkk.k...k.', '..................']],
  frog: [['................', '...kk......kk...', '..k11k....k11k..', '..kewk....kwek..', '.k111kkkkkk111k.', 'k11111111111111k', 'k12111111111121k', 'k11111333311111k', '.k111333333111k.', 'k1k1kkkkkkkk1k1k', 'kk.kk......kk.kk', '................'],
    ['................', '...kk......kk...', '..k11k....k11k..', '..kewk....kwek..', '.k111kkkkkk111k.', 'k11111111111111k', 'k12111111111121k', 'k11111333311111k', '.k111333333111k.', '.k1kkkkkkkkkk1k.', 'k1k..........k1k', 'kk............kk']],
  scorpion: [['.....kkk..........', '....k121k.........', '...k1k.k1k........', '...kek..k1k.......', '....k....k1k......', '.........k1k......', '...kkkkkk11kkk.kk.', '..k11111111111kk1k', '.k12111111111e1k1k', '..k1111111111kkkk.', '.k1k1k1k1k1k......', 'k.k.k.k.k.k.......'],
    ['.....kkk..........', '....k121k.........', '...k1k.k1k........', '...kek..k1k.......', '....k....k1k......', '.........k1k......', '...kkkkkk11kkk.kk.', '..k11111111111kk1k', '.k12111111111e1k1k', '..k1111111111kkkk.', '..k1k1k1k1k1k.....', '.k.k.k.k.k.k......']],
  crab: [['.kk..........kk.', 'k11k........k11k', 'k1k1k......k1k1k', '.k11k......k11k.', '..kk.kekkek.kk..', '....k111111k....', '..kk11211111kk..', '.k111111111111k.', '.k133333333331k.', '..kkkkkkkkkkkk..', '.k.k.k....k.k.k.', 'k.k.k......k.k.k'],
    ['..kk........kk..', '.k11k......k11k.', '.k1k1k....k1k1k.', '..k11k....k11k..', '..kk.kekkek.kk..', '....k111111k....', '..kk11211111kk..', '.k111111111111k.', '.k133333333331k.', '..kkkkkkkkkkkk..', '.k.k.k....k.k.k.', 'k.k.k......k.k.k']],
  crystal: [['......k.......', '.....k1k......', '.....k12k.....', '..k..k112k..k.', '.k1kk11112kk1k', 'k12k1e11e12k2k', 'k112111111122k', '.k1111111112k.', '..k11111112k..', '...k111112k...', '....k1112k....', '.....k12k.....', '......kk......']],
  wyrm: [['................kk......', '...............k11k.....', '..............k1111kk...', '.............k11e111wk..', '....kk.......k1111111kk.', '...k22k......k11kkk1111k', '..k2222k....k111k..kkkk.', '.k222222kkkk1111k.......', '.k2222211111111k........', 'k22221111111111k........', 'k1k11111111111111k......', '.k.k111133331111k.......', '....k113333331111k...kk.', '....k1111111111111kkk1k.', '.....kk1k1kkkk1k1kk111k.', '......k1k1k..k1k1k.kkk..', '......kk.kk..kk.kk......', '........................'],
    ['................kk......', '...............k11k.....', '..............k1111kk...', '.............k11e111wk..', '.kk..........k1111111kk.', 'k22k.........k11kkk1111k', 'k222k.......k111k..kkkk.', '.k222kkkkkkk1111k.......', '..k222211111111k........', '.k2221111111111k........', 'k1k11111111111111k......', '.k.k111133331111k.......', '....k113333331111k...kk.', '....k1111111111111kkk1k.', '.....kk1k1kkkk1k1kk111k.', '......k1k1k..k1k1k.kkk..', '......kk.kk..kk.kk......', '........................']],
};
const CHEST_ROWS = {
  closed: ['................', '..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kwhhhhhhhhhhwk.', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kkkkkkggkkkkkk.', '.kwwwwwgywwwwwk.', '.kwwwwwggwwwwwk.', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kwwwwwwwwwwwwk.', '.kddddddddddddk.', '..kkkkkkkkkkkk..'],
  open: ['..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kddddddddddddk.', '.k000000000000k.', '.k000000000000k.', '.kkkkkkkkkkkkkk.', '.kwwwwwwwwwwwwk.', '.kwwwwwwwwwwwwk.', '.kwwwwwwwwwwwwk.', '.kmmmmmmmmmmmmk.', '.kwwwwwwwwwwwwk.', '.kddddddddddddk.', '..kkkkkkkkkkkk..'],
};
const CHEST_SPR = {};
for (const [p, pal] of Object.entries({
  wood: { k: OUT, w: '#8a5a2b', h: '#b07a3e', m: '#5d6470', g: '#f2c13a', y: '#fff3b0', d: '#5a3818', '0': '#1a0f08' },
  gold: { k: OUT, w: '#c8922a', h: '#f7d36a', m: '#7a3b9a', g: '#ffe08a', y: '#ffffff', d: '#8a5a14', '0': '#1a0f08' },
})) CHEST_SPR[p] = { closed: spr(CHEST_ROWS.closed, pal), open: spr(CHEST_ROWS.open, pal) };

// ---------- tiny 3x5 pixel font (M, N and W are 5 wide), cached per string + colour ----------
const GLYPH = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '1000111011101011000110001', N: '1000111001101011001110001',
  O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '1000110001101011101110001', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111',
  7: '111001010010010', 8: '111101111101111', 9: '111101111001110', ' ': '000000000000000', '!': '010010010000010', '+': '000010111010000', '-': '000000111000000',
  '.': '000000000000010', ':': '000010000010000', '/': '001001010100100', "'": '010010000000000', '?': '110001010000010', '*': '101010101000000', ',': '000000000010100',
  '(': '010100100100010', ')': '010001001001010', '%': '101001010100101', '#': '101111101111101', '<': '001010100010001', '>': '100010001010100',
};
const _tt = new Map();
function tinyCanvas(str, col) {
  const key = str + '|' + col; let c = _tt.get(key); if (c) return c;
  if (_tt.size > 600) _tt.clear();
  const s = String(str).toUpperCase(), gl = [...s].map((ch) => GLYPH[ch] || GLYPH['?']);
  const w = gl.reduce((a, g) => a + g.length / 5 + 1, 0) + 1; const [cv, x] = mkCanvas(w, 7);
  for (const pass of [0, 1]) {
    x.fillStyle = pass ? col : '#0a0610'; let ox = 1;
    for (const g of gl) { const gw = g.length / 5; for (let k = 0; k < g.length; k++) if (g[k] === '1') { const gx = ox + (k % gw), gy = 1 + ((k / gw) | 0); if (pass) x.fillRect(gx, gy, 1, 1); else x.fillRect(gx - 1, gy - 1, 3, 3); } ox += gw + 1; }
  }
  _tt.set(key, cv); return cv;
}
function tinyText(ctx, str, x, y, col = '#ffffff', scale = 1, align = 'center') {
  const c = tinyCanvas(str, col), w = c.width * scale;
  ctx.drawImage(c, Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x), Math.round(y - 6 * scale), w, c.height * scale);
}
