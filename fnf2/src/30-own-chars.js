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
  // Both of WRATH's looks are built as atlases by tools/own/: wrath_normal.py (stage 1, cut from
  // a reference drawing) and wrath.py (stage 2, BF's real cut-out art repainted, mint or black hair).
  // Stage 2 has ONE eye with 5 looks (frames of the WRATH_EYE symbol); it keeps changing while he raps.
  G.OwnFX = G.OwnFX || {};
  G.OwnFX.wrath = {
    init(ch) {
      ch._eyes = []; ch._eye = 0; ch._eyeNotes = 0; ch._eyeEvery = 3;
      const a = ch.atlas; if (!a) return;
      for (const T of Object.values(a.symbols)) for (const L of T.layers) for (const F of L.frames)
        for (const e of F.els) if (e.s === 'WRATH_EYE' || e.s === 'WRATH_EYE_m') ch._eyes.push(e);
      this.setEye(ch, 0);
    },
    setEye(ch, k) { ch._eye = k; for (const e of ch._eyes) e.ff = k; },
    // a new look every 2-4 notes, never the same one twice in a row
    onSing(ch) {
      if (++ch._eyeNotes < ch._eyeEvery) return;
      ch._eyeNotes = 0; ch._eyeEvery = 2 + Math.floor(Math.random() * 3);
      this.setEye(ch, (ch._eye + 1 + Math.floor(Math.random() * 4)) % 5);
    },
  };
})();
