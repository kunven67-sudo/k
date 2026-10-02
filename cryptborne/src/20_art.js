
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

// ---------- people ----------
// Every person (hero, villagers, humanoid monsters) is drawn from rectangles: a 12x20
// body box whose feet sit at (x, y). st: { face, moving, walk, armor, trim, helm,
// breathe (0/1), blink, pose: 'wave'|'hammer'|'work'|'raise'|'strike', poseT 0..1 }
function heroHand(st) { // where the front hand is (box coordinates), used to hold weapons
  const ph = st.moving ? Math.sin(st.walk || 0) : 0, armF = st.moving ? Math.round(ph) : 0;
  switch (st.pose) { case 'raise': return [10, 5]; case 'strike': return [12, 11]; case 'wave': return [10, 4]; default: return [10, 14 + armF]; }
}
function drawHuman(ctx, x, y, L, st) {
  const f = st.face || 1, ox = Math.round(x) - 6, oy = Math.round(y) - 20, b = st.breathe ? 1 : 0;
  const put = (ix, iy, w, h, c) => { if (!c) return; ctx.fillStyle = c; ctx.fillRect(f === 1 ? ox + ix : ox + 12 - ix - w, oy + iy, w, h); };
  const R = (ix, iy, w, h, c) => put(ix, iy - b, w, h, c); // upper body rises when breathing in
  const ph = st.moving ? Math.sin(st.walk || 0) : 0;
  const legA = ph > 0.35 ? 3 : 4, legB = ph < -0.35 ? 3 : 4;
  const armF = st.moving ? Math.round(ph) : 0, armB = -armF;
  const dark = L.shirtDark || L.shirt, top = st.armor || L.shirt;
  // legs + shoes (never move with breathing; the top of the leg grows by 1px instead)
  if (!L.robe) {
    put(3, 15 - b, 2, legA + b, L.pants); put(3, 15 + legA, 2, 1, L.shoes);
    put(7, 15 - b, 2, legB + b, L.pants); put(7, 15 + legB, 2, 1, L.shoes);
  } else { R(2, 9, 8, 10 + b, L.robe); put(3, 19, 2, 1, L.shoes); put(7, 19, 2, 1, L.shoes); }
  if (L.cape && !st.armor) R(1, 9, 1, 8, L.cape);
  // back arm
  R(0, 10 + armB, 2, 4, st.armor || dark); R(0, 14 + armB, 2, 1, L.skin);
  // torso
  if (!L.robe) R(2, 9, 8, 6, L.shirt);
  R(2, 14, 8, 1, L.belt || '#3a2616');
  if (L.apron) R(3, 10, 6, 5, L.apron);
  if (L.vest) { R(2, 9, 2, 5, L.vest); R(8, 9, 2, 5, L.vest); }
  if (st.armor) { R(2, 9, 8, 5, st.armor); R(2, 9, 8, 1, st.trim || '#ffffff55'); R(5, 10, 2, 3, st.trim || '#ffffff55'); R(1, 9, 2, 2, st.trim || st.armor); R(9, 9, 2, 2, st.trim || st.armor); }
  if (L.wraps) { R(2, 10, 8, 1, L.wraps); R(2, 12, 8, 1, L.wraps); put(3, 16, 2, 1, L.wraps); put(7, 17, 2, 1, L.wraps); }
  if (L.fur) { R(1, 8, 10, 2, L.fur); R(1, 10, 1, 3, L.fur); R(10, 10, 1, 3, L.fur); }
  // head
  R(3, 2, 6, 7, L.skin);
  if (!st.blink && !L.noFace) { R(6, 5, 1, 1, L.eyeCol || '#1b1020'); R(8, 5, 1, 1, L.eyeCol || '#1b1020'); }
  if (L.blush) R(7, 7, 2, 1, L.blush);
  if (L.wraps) { R(3, 3, 6, 1, L.wraps); R(3, 7, 6, 1, L.wraps); }
  switch (L.hairStyle | 0) {
    case 0: R(3, 1, 6, 2, L.hair); R(3, 3, 1, 3, L.hair); break; // short
    case 1: R(3, 1, 6, 2, L.hair); R(2, 2, 2, 7, L.hair); R(4, 3, 1, 1, L.hair); break; // long
    case 2: R(4, 1, 4, 1, L.skin); break; // bald
    case 3: R(3, 1, 6, 2, L.hair); R(3, 0, 1, 1, L.hair); R(5, 0, 1, 1, L.hair); R(7, 0, 2, 1, L.hair); R(3, 3, 1, 2, L.hair); break; // spiky
    case 4: R(3, 1, 6, 2, L.hair); R(3, 3, 1, 2, L.hair); R(1, 3, 2, 1, L.hair); R(1, 4, 1, 5, L.hair); break; // ponytail
  }
  if (L.beard) { R(4, 7, 5, 2, L.beard); R(3, 6, 1, 2, L.beard); }
  if (L.hat) { R(2, 0, 8, 2, L.hat); R(1, 2, 10, 1, L.hat); }
  if (L.hood) { R(2, 1, 8, 2, L.hood); R(2, 3, 1, 6, L.hood); R(9, 3, 1, 2, L.hood); }
  if (L.bandana) { R(3, 1, 6, 2, L.bandana); R(1, 2, 2, 1, L.bandana); R(1, 3, 1, 2, L.bandana); }
  if (L.tricorn) { R(1, 0, 10, 2, L.tricorn); R(3, -1, 6, 1, L.tricorn); R(5, -1, 2, 1, '#f2c13a'); }
  if (st.helm) { R(3, 1, 6, 3, st.helm); R(2, 3, 1, 4, st.helm); R(3, 4, 1, 1, st.helm); }
  // front arm by pose (the hand is where weapons attach)
  const sleeve = top, skin = L.skin, p = st.poseT || 0;
  switch (st.pose) {
    case 'wave': { const wx = p < 0.5 ? 10 : 11; R(10, 6, 2, 4, sleeve); R(wx, 4, 2, 2, skin); break; }
    case 'raise': R(10, 6, 2, 4, sleeve); R(10, 5, 2, 1, skin); break;
    case 'strike': R(10, 10, 3, 2, sleeve); R(12, 11, 2, 1, skin); break;
    case 'hammer':
      if (p < 0.55) { R(10, 6, 2, 4, sleeve); R(10, 5, 2, 1, skin); R(11, 1, 1, 4, '#5a3418'); R(10, 0, 4, 2, '#5d6470'); }
      else { R(10, 10, 3, 2, sleeve); R(12, 11, 2, 1, skin); R(13, 9, 1, 4, '#5a3418'); R(13, 12, 3, 2, '#5d6470'); }
      break;
    case 'work': { const wx = 11 + (p < 0.5 ? 0 : 1); R(10, 10, 2, 2, sleeve); R(wx, 12, 2, 1, skin); break; }
    default: R(10, 10 + armF, 2, 4, sleeve); R(10, 14 + armF, 2, 1, skin);
  }
}

// Extra parts for monsters: ears, horns, skull faces, weapons and so on.
function drawExtras(ctx, x, y, L, before, pose) {
  const ox = Math.round(x) - 6, oy = Math.round(y) - 20;
  const R = (ix, iy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + ix, oy + iy, w, h); };
  if (before) {
    if (L.wings) { R(-3, 7, 3, 2, L.wings); R(-4, 9, 4, 3, L.wings); R(12, 7, 3, 2, L.wings); R(12, 9, 4, 3, L.wings); }
    if (L.cape) R(1, 9, 10, 9, L.cape);
    if (L.tail) { R(-2, 13, 3, 1, L.tail); R(-3, 12, 1, 1, L.tail); }
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
  if (L.eyepatch) { R(7, 4, 2, 2, '#120a10'); R(3, 4, 6, 1, '#120a10'); }
  // weapon in the front hand, following the pose
  const [hx, hy] = heroHand({ pose });
  const fwd = pose === 'strike';
  switch (L.weapon) {
    case 'club': if (fwd) { R(hx + 1, hy, 6, 2, '#7a4a24'); R(hx + 6, hy - 1, 3, 4, '#5a3418'); } else { R(hx + 2, hy - 6, 2, 7, '#7a4a24'); R(hx + 1, hy - 8, 4, 3, '#5a3418'); } break;
    case 'sword': if (fwd) { R(hx + 3, hy, 8, 1, '#d7dde6'); R(hx + 2, hy - 1, 1, 3, '#8a8f99'); } else { R(hx + 2, hy - 10, 1, 10, '#d7dde6'); R(hx + 1, hy - 2, 3, 1, '#8a8f99'); } break;
    case 'cutlass': if (fwd) { R(hx + 3, hy, 7, 1, '#d7dde6'); R(hx + 9, hy - 1, 2, 1, '#d7dde6'); R(hx + 2, hy - 1, 1, 3, '#f2c13a'); } else { R(hx + 2, hy - 8, 1, 8, '#d7dde6'); R(hx + 3, hy - 9, 1, 2, '#d7dde6'); R(hx + 1, hy - 1, 3, 1, '#f2c13a'); } break;
    case 'bigsword': if (fwd) { R(hx + 3, hy - 1, 11, 2, '#d7dde6'); R(hx + 2, hy - 3, 1, 6, '#f2c13a'); } else { R(hx + 2, hy - 13, 2, 13, '#d7dde6'); R(hx, hy - 2, 6, 1, '#f2c13a'); } break;
    case 'axe': if (fwd) { R(hx + 1, hy, 8, 1, '#6b4423'); R(hx + 7, hy - 3, 3, 4, '#aab2bd'); } else { R(hx + 2, hy - 9, 1, 10, '#6b4423'); R(hx + 3, hy - 10, 3, 4, '#aab2bd'); R(hx + 3, hy - 10, 1, 4, '#d7dde6'); } break;
    case 'bow': R(hx + 3, hy - 8, 1, 9, '#8a5a2b'); R(hx + 2, hy - 9, 1, 1, '#8a5a2b'); R(hx + 2, hy + 1, 1, 1, '#8a5a2b'); R(hx + 1, hy - 8, 1, 9, '#e8e0cc'); break;
    case 'musket': R(hx, hy - 1, 11, 1, '#3a3a40'); R(hx - 2, hy, 4, 2, '#6b4423'); break;
    case 'staff': R(hx + 2, hy - 12, 1, 14, '#5a3a20'); R(hx + 1, hy - 14, 3, 3, L.orb || '#b878ea'); break;
    case 'claws': R(hx + 1, hy, 1, 2, '#efe4cc'); R(hx + 2, hy - 1, 1, 2, '#efe4cc'); break;
  }
}
const HUM_W = 26, HUM_H = 26, HUM_FX = 13, HUM_FY = 25; // baked humanoid frame size and feet point
// frames: 0 stand, 1 step, 2 stand, 3 step, 4 windup (weapon raised), 5 strike
function buildHumanoid(L) {
  const frames = [];
  const poses = [[null, 0], [null, Math.PI / 2], [null, 0], [null, -Math.PI / 2], ['raise', 0], ['strike', 0]];
  poses.forEach(([pose, phase], i) => {
    const [c, x] = mkCanvas(HUM_W, HUM_H);
    const moving = i === 1 || i === 3;
    drawExtras(x, HUM_FX, HUM_FY, L, true, pose);
    drawHuman(x, HUM_FX, HUM_FY, L, { face: 1, moving, walk: phase, armor: L.armor, trim: L.trim, helm: L.helm, pose });
    drawExtras(x, HUM_FX, HUM_FY, L, false, pose);
    frames.push(c);
  });
  return frames;
}

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
