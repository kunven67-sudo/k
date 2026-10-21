// FNF 2 - Jordus (Nightly Funkin'), rebuilt from a gameplay video (tools/own/jordus.py). What the video showed:
// the mod's camera (replayed from the video frame by frame: who it follows, how close, its bops), its black letterbox
// bars, the opponent's arrows hidden (only yours show), the NOW PLAYING card at the start, two blackouts, and a short
// ending clip after the song.
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
      P.jor = { path: d.path || null, blackouts: d.blackouts || [], card: d.card || [2.0, 6.9] };
    },
    reset(P) {
      // the mod only shows your arrows (theirs are hidden, notes and all)
      if (P.lines && P.lines[0]) P.lines[0].x = -9999;
      P.zoomRate = 0;                   // (the bops are in the replayed camera already)
      if (P.jor && P.jor.path) { const c = camAt(P.jor.path, 0); P.cam.focus(c[1], c[2]); P.camZoom = c[3]; }
    },
    update(P) {
      const J = P.jor;
      if (!J || !J.path || P.gameOver) return;
      const c = camAt(J.path, Math.max(0, P.songPos) / 1000);
      P.camTween = null;
      P.cam.focus(c[1], c[2]);
      P.camZoom = c[3];
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

  // after the song: the mod's ending clip (the blue guy in the gas mask, the pink smoke question mark)
  const clip = path => ({
    enter(S) {
      S.black = 0;
      const src = G.A.raw[path];
      if (!src) { S.vidDone = true; return; }
      const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
      v.volume = Math.min(1, (G.settings.vol.master || 1) * (G.settings.vol.sfx == null ? 1 : G.settings.vol.sfx));
      v.onended = () => { S.vidDone = true; }; v.onerror = () => { S.vidDone = true; };
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => { S.vidDone = true; }); });
      S.video = v; S.vidDone = false;
    },
    update(S) { if ((S.t > 3 && S.video && S.video.readyState < 2) || S.vidDone) S.go(); },
    draw(S, ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      const v = S.video;
      if (v && v.readyState >= 2) { const s = Math.min(G.W / v.videoWidth, G.H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s; ctx.drawImage(v, (G.W - w) / 2, (G.H - h) / 2, w, h); }
    },
    leave(S) { if (S.video) { try { S.video.pause(); } catch (e) {} S.video = null; } },
  });
  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes.jordus = { createEnd: P => G.A.raw['videos/jordus-end.webm'] ? G.Scene(P, [clip('videos/jordus-end.webm')]) : null };
})();
