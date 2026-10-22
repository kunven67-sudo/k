// FNF 2 - Jordus (Nightly Funkin'), rebuilt from a gameplay video (tools/own/jordus.py). What the video showed:
// the mod's camera (replayed from the video frame by frame: who it follows, how close, its bops), its black letterbox
// bars, the NOW PLAYING card at the start, two blackouts, and its game over (the end of the video: the player is
// shocked, turns blue, a pink '?' of smoke loops over her). Her arrows were hidden in the mod; here they show.
(function () {
  G.SongFX = G.SongFX || {};
  const CARD = 'NOW PLAYING: NIGHTLY FUNKIN - JORDUS';
  const BAR = 107;                        // the bars: 86 of the video's 576 rows, top and bottom
  // the camera path: [t (s), x, y, zoom] every 1/15 s; between two points it slides
  function camAt(path, t) {
    if (!path || !path.length) return null;
    let lo = 0, hi = path.length - 1;
    if (t <= path[0][0]) return path[0];
    if (t >= path[hi][0]) return path[hi];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][0] <= t) lo = m; else hi = m; }
    const a = path[lo], b = path[hi], k = (t - a[0]) / (b[0] - a[0] || 1);
    // (a camera cut: no slide)
    if (b[0] - a[0] > 0.2) return k < 0.5 ? a : b;
    return [t, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
  }
  G.SongFX.jordus = {
    setup(P) {
      const d = G.A.json('preload/data/songs/jordus/jordus-camera.json') || {};
      P.jor = { path: d.path || null, blackouts: d.blackouts || [], card: d.card || [2.0, 6.9], lights: d.lights || [],
        lit: (P.stage.props || []).find(p => p.name === 'lights') || null };
      // (the game over's frames + sounds load with the song, so dying never waits for them)
      G.SongFX.jordus.gameOver.preload();
    },
    // (the pictures get sized for the closest the camera ever gets)
    maxZoom(P) { const p = P.jor && P.jor.path; let z = 0; if (p) for (const c of p) z = Math.max(z, c[3]); return z; },
    reset(P) {
      P.zoomRate = 0;                   // (the bops are in the replayed camera already)
      if (P.jor && P.jor.path) { const c = camAt(P.jor.path, 0), v = this.fit(P, c[1], c[2], c[3]); P.cam.focus(v[0], v[1]); P.camZoom = v[2]; }
    },
    update(P) {
      const J = P.jor;
      if (!J) return;
      // the lights: in two parts of the song the stage flashes bright on every beat (on, a moment, then fades)
      if (J.lit) {
        const cr = P.cond.crochet, b = Math.floor(P.songPos / cr), t = (P.songPos - b * cr) / 1000;
        const on = !P.gameOver && J.lights.some(r => b >= r[0] && b <= r[1]);
        J.lit.alpha = on ? (t < 0.2 ? 1 : Math.max(0, 1 - (t - 0.2) / 0.13)) : 0;
      }
      if (!J.path || P.gameOver) return;
      const c = camAt(J.path, Math.max(0, P.songPos) / 1000);
      P.camTween = null;
      const v = this.fit(P, c[1], c[2], c[3]);
      P.cam.focus(v[0], v[1]);
      P.camZoom = v[2];
    },
    // the replayed camera was made for a 1280 wide screen and the stage is only as big as the video showed it:
    // a wider screen (phones) would see past its edges (black). Zoom in just enough + slide back inside.
    fit(P, x, y, z) {
      if (!P.jor.box) { const s = (P.stage.props || []).find(p => p.name === 'street'); if (s && s.width > 0) P.jor.box = { l: s.x, r: s.x + s.width, t: s.y, b: s.y + s.height }; }
      const st = P.jor.box;
      if (!st) return [x, y, z];
      const vis = G.H - 2 * BAR;
      z = Math.max(z, G.W / (st.r - st.l), vis / (st.b - st.t));
      const hw = G.W / 2 / z, hh = vis / 2 / z;
      x = G.clamp(x, st.l + hw, st.r - hw); y = G.clamp(y, st.t + hh, st.b - hh);
      return [x, y, z];
    },
    // the bars + the card: over the stage, under the HUD (like the mod)
    drawOver(ctx, P) {
      G.setScreenT(ctx);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, G.W, BAR); ctx.fillRect(0, G.H - BAR, G.W, BAR);
      const J = P.jor, t = P.songPos / 1000;
      if (J && t > J.card[0] - 0.6 && t < J.card[1] + 0.2) this.drawCard(ctx, t - J.card[0], J.card[1] - J.card[0]);
    },
    // NOW PLAYING: a black strip slides in from the left, the words slide in after it (fading up from grey), stay,
    // then both slide back out to the left
    drawCard(ctx, t, len) {
      const E = G.ease, y = 531, h = 28;
      ctx.save();
      ctx.font = '900 22px "Arial Black", Arial, sans-serif';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
      const tw = ctx.measureText(CARD).width, full = tw + 40;
      let strip, text, a;
      if (t < len - 0.9) {
        strip = full * E.quartOut(G.clamp((t + 0.6) / 0.5, 0, 1));
        const k = E.quartOut(G.clamp((t - 0.1) / 1.4, 0, 1));
        text = -tw + (tw + 6) * k + 10 * G.clamp((t - 1.5) / (len - 2.4), 0, 1); a = 0.35 + 0.65 * k;
      } else {
        const k = E.cubeIn(G.clamp((t - (len - 0.9)) / 0.9, 0, 1));
        strip = full * (1 - k); text = 16 - (tw + 16) * k; a = 1 - 0.6 * k;
      }
      if (strip > 1) {
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(strip + 14, y); ctx.lineTo(strip, y + h); ctx.lineTo(0, y + h); ctx.fill();
        ctx.beginPath(); ctx.rect(0, y, strip + 14, h); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.textBaseline = 'middle';
        ctx.fillText(CARD, text, y + h / 2 + 1);
      }
      ctx.restore();
    },
    // the blackouts cover everything, the HUD too
    drawTop(ctx, P) {
      const J = P.jor;
      if (!J) return;
      const t = P.songPos / 1000;
      for (const b of J.blackouts) if (t >= b[0] && t < b[1]) { G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); break; }
    },
  };

  // the game over: the mod's own, on the screen (frames from the end of the video), its shock sound + music loop
  G.SongFX.jordus.gameOver = {
    sfx: 'shared/sounds/jordus/death.ogg', music: 'shared/music/jordus/gameOver.ogg', sheet: 'shared/images/characters/nightly/death',
    preload() { G.Sparrow.load(this.sheet); G.audio.preload([this.sfx, this.music]); },
    sprite() {
      const s = new G.Sprite(0, 0).loadSparrow(this.sheet);
      if (!s.sheet) return null;
      s.addAnim('firstDeath', 'firstDeath_', 30, false);
      s.addAnim('deathLoop', 'deathLoop_', 30, true);
      s.addAnim('deathConfirm', 'deathConfirm_', 30, false);
      return s;
    },
  };
})();
