// FNF 2 - our own characters, made from the real FNF art with the forge (15-forge.js).
(function () {
  // flat-colour rule: from -> to, matching the source hue/saturation, keeping the darker
  // anti-aliased edge pixels (value goes down to the outline)
  const C = (from, to, hr, ds) => { const f = G.Forge.hex2hsv(from); return { from, to, hr: hr == null ? 6 : hr, soft: 4, s: [Math.max(0, f[1] - (ds || 0.18)), Math.min(1, f[1] + (ds || 0.18))], v: [0.06, 1] }; };
  const GRAY = (to, vmin) => ({ gray: true, from: '#f8f8f8', to, s: [0, 0.14], v: [vmin == null ? 0.3 : vmin, 1] });

  // matrix helpers (Animate 2x3: [a, b, c, d, tx, ty])
  const mul = (p, l) => [p[0] * l[0] + p[2] * l[1], p[1] * l[0] + p[3] * l[1], p[0] * l[2] + p[2] * l[3], p[1] * l[2] + p[3] * l[3], p[0] * l[4] + p[2] * l[5] + p[4], p[1] * l[4] + p[3] * l[5] + p[5]];

  G.OwnArt = {
    // Add a picture glued to a symbol (e.g. a head) as a new layer right above the face layer,
    // in every timeline that uses that symbol, so it follows the head in every pose.
    //   o = { symbol: 'pico default head', inner: '14', isFace: el => bool, name: 'WRATH_BANG', img: canvas }
    // The picture is drawn in the inner bitmap's own pixel space.
    glueAboveFace(atlas, o) {
      atlas.sprites[o.name] = { img: o.img, x: 0, y: 0, w: o.img.width, h: o.img.height, rot: false };
      const hs = atlas.symbols[o.symbol]; if (!hs) return 0;
      let inner = null;
      for (const L of hs.layers) for (const F of L.frames) for (const e of F.els) if (e.n === o.inner && !inner) inner = e.m;
      if (!inner) return 0;
      let n = 0;
      const tls = [atlas.main].concat(Object.values(atlas.symbols)).filter((t, i, arr) => arr.indexOf(t) === i);
      for (const T of tls) {
        const headIdx = T.layers.findIndex(L => L.frames.some(F => F.els.some(e => e.s === o.symbol)));
        if (headIdx < 0) continue;
        const faceIdx = T.layers.findIndex(L => L.frames.some(F => F.els.some(e => o.isFace(e))));
        const at = faceIdx >= 0 ? Math.min(faceIdx, headIdx) : headIdx;
        const src = T.layers[headIdx];
        const frames = src.frames.map(F => ({ i: F.i, du: F.du, label: null, els: F.els.filter(e => e.s === o.symbol).map(e => ({ n: o.name, m: mul(e.m, inner) })) }));
        const L = { name: o.name, type: null, frames, at: Int16Array.from(src.at) };
        T.layers.splice(at, 0, L);
        n++;
      }
      return n;
    },
  };

  // ---------------------------------------------------------------- WRATH
  // A hair bang hanging over his left eye, drawn in Pico's head-art pixel space (265 x 223).
  // The hidden eye sits inside x 42-64, y 144-185 in every frame of every pose.
  function wrathBang(glow) {
    const c = G.makeCanvas(265, 223), x = c.getContext('2d');
    const base = '#2b2735', shade = '#151219', ink = '#000';
    x.lineJoin = 'round'; x.lineCap = 'round';
    // main lock: starts inside the hair, sweeps down over the eye to a sharp tip
    const lock = () => {
      x.beginPath();
      x.moveTo(34, 88);
      x.quadraticCurveTo(14, 118, 20, 152);
      x.quadraticCurveTo(25, 182, 36, 214);        // tip
      x.quadraticCurveTo(52, 190, 66, 170);
      x.quadraticCurveTo(84, 140, 92, 112);
      x.lineTo(104, 96);
    };
    lock(); x.closePath(); x.fillStyle = base; x.fill();
    // shadow along the face side
    x.save(); lock(); x.closePath(); x.clip();
    x.beginPath(); x.moveTo(104, 96); x.quadraticCurveTo(84, 150, 36, 214); x.lineTo(70, 214); x.lineTo(120, 120); x.closePath(); x.fillStyle = shade; x.fill();
    // glowing streak (like Pico's lighter hair streaks)
    if (glow) {
      x.beginPath(); x.moveTo(44, 108); x.quadraticCurveTo(32, 140, 36, 176); x.lineWidth = 5; x.strokeStyle = glow; x.stroke();
      x.beginPath(); x.moveTo(60, 112); x.quadraticCurveTo(54, 128, 52, 146); x.lineWidth = 3.5; x.stroke();
    }
    x.restore();
    // black ink outline on the hanging sides only (the top joins the hair)
    x.beginPath(); x.moveTo(30, 96); x.quadraticCurveTo(14, 118, 20, 152); x.quadraticCurveTo(25, 182, 36, 214);
    x.quadraticCurveTo(52, 190, 66, 170); x.quadraticCurveTo(84, 140, 92, 112); x.lineTo(98, 104);
    x.lineWidth = 7; x.strokeStyle = ink; x.stroke();
    return c;
  }
  const PICO_FACES = new Set(['0', '1', '2', '3', '5', '6', '9', '10', '15']);
  // the visible (near) eye's box in each Pico face drawing (sprite px)
  const NEAR_EYE = { '0': [58, 40, 70, 94], '1': [58, 39, 72, 92], '2': [63, 31, 86, 68], '3': [66, 31, 87, 75], '5': [60, 44, 85, 57], '6': [45, 42, 82, 65], '9': [61, 46, 80, 91], '10': [62, 42, 82, 92], '15': [64, 34, 80, 94] };

  // colours shared by the two WRATH looks
  // Pico's hair: streak (h34), base (h20), shadow (h8). Wide windows so the soft edge pixels
  // (hair->outline, hair->skin) are caught too and no orange fringe is left.
  const HAIR = (streak) => [
    { from: '#f8a838', to: streak, h: 37, hr: 6, soft: 2, s: [0.45, 1], v: [0.06, 1] },
    { from: '#f86820', to: '#2b2735', h: 20, hr: 10, soft: 2, s: [0.42, 1], v: [0.06, 1] },
    { from: '#f83010', to: '#151219', h: 4, hr: 7, soft: 2, s: [0.42, 1], v: [0.06, 1] },
  ];
  const SOLE = (to) => ({ from: '#f8f0c8', to, h: 45, hr: 22, soft: 3, s: [0, 0.4], v: [0.25, 1] });
  const SKIN_C = [C('#f8d0a8', '#e4dde8', 14, 0.24), C('#f87880', '#b48aa4', 8)];
  const SLEEVE_C = [C('#105848', '#16141c', 14), C('#088030', '#2a2733', 14), C('#20a058', '#2a2733', 12), C('#50e858', '#3d3a48', 12)];
  const GUN_CRAZY = [C('#88b8b8', '#ff3a55', 10)].concat(SLEEVE_C, SKIN_C);
  const wrathCrazy = {
    base: 'pico', name: 'WRATH',
    healthColor: '#ff2340',
    rules: [],
    parts: {
      '14': HAIR('#ff2340').concat(SKIN_C),
      '13': SKIN_C,
      '16': SLEEVE_C,
      '4': SLEEVE_C,
      '18': GUN_CRAZY, '19': GUN_CRAZY, '20': GUN_CRAZY,
    },
    zones: [],
    edit(atlas) {
      G.OwnArt.glueAboveFace(atlas, { symbol: 'pico default head', inner: '14', name: 'WRATH_BANG', img: wrathBang('#ff2340'), isFace: e => (e.n != null && PICO_FACES.has(e.n)) || e.s === 'pico default face' });
    },
    iconRules: [C('#f8a838', '#ff2340', 5), C('#f86820', '#2b2735', 7, 0.2), C('#f83010', '#151219', 5, 0.15), C('#f8d0a8', '#e4dde8', 14, 0.2), C('#f87880', '#b48aa4', 8)],
  };
  const LEGS_CRAZY = [
    SOLE('#cdc8d6'),
    C('#f83010', '#ff2340', 6, 0.12), C('#f86820', '#ff5066', 6, 0.14),            // glowing laces
    C('#681838', '#1d1a24', 8), C('#b81830', '#34303e', 5, 0.12),                  // shoes
    C('#d04848', '#3d0c18', 5, 0.14), C('#d08858', '#5c1626', 6, 0.14), C('#e8b078', '#7c2434', 5, 0.14), // pants
  ].concat(SLEEVE_C);
  for (const n of ['7', '8', '11', '12', '17']) wrathCrazy.parts[n] = LEGS_CRAZY;
  for (const n of PICO_FACES) {
    wrathCrazy.parts[n] = [C('#f80058', '#a3001f', 8, 0.2), C('#f87880', '#b48aa4', 8)];
    // his one eye glows red (teeth stay white)
    wrathCrazy.zones.push({ sprite: n, box: NEAR_EYE[n], rules: [GRAY('#ff2a3c', 0.25), C('#f80058', '#a3001f', 8, 0.2), C('#f87880', '#b48aa4', 8)] });
  }
  G.OWN['wrath'] = wrathCrazy;

  // WRATH's normal form (the story intro guy) is cut from the user's own drawing: tools/own/wrath_normal.py
})();
