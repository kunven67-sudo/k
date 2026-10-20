// FNF 2 - video songs (tools/own/video_song.py): a video plays behind the arrows instead of a stage, in time with
// the song (the video itself is silent: the song's own Inst + voices play, so misses still cut your voice).
// Anyone can sing them: you play as whoever you picked in Character Select. Options > Video Songs = CHARACTERS
// shows your picked player on the song's own stage instead of the video.
(function () {
  // who the picked player sings as in a song made for anybody
  const BASE = { bf: 'bf', pico: 'pico-playable' };
  G.playerChar = function (pid) {
    if (BASE[pid]) return BASE[pid];
    const P = G.PLAYERS && G.PLAYERS[pid];
    if (!P) return 'bf';
    if (P.real) return (P.real.songChar && G.A.json('preload/data/characters/' + P.real.songChar + '.json')) ? P.real.songChar : P.real.char;
    if (P.swapChar) return P.swapChar;
    const d = G.A.json('preload/data/players/' + pid + '.json');
    return (d && d.ownedChars && d.ownedChars[0]) || 'bf';
  };

  G.VideoSongFX = {
    setup(P) {
      P.vsong = { mode: G.settings.videoSongs === 'characters' ? 'characters' : 'video', el: null, failed: false };
      if (P.vsong.mode !== 'video') return;
      // nothing of the stage shows (and nothing gets drawn for nothing)
      for (const c of [P.bf, P.dad, P.gf]) if (c) c.visible = false;
      for (const pr of (P.stage && P.stage.props) || []) pr.visible = false;
    },
    // the video element, made once its file is in (the pack's body comes in with the song's music)
    el(P) {
      const V = P.vsong;
      if (!V || V.el || V.failed) return V && V.el;
      const src = G.A.raw[P.song.video.path];
      if (!src) return null;
      const e = document.createElement('video');
      e.src = src; e.muted = true; e.playsInline = true; e.preload = 'auto';
      e.onerror = () => { V.failed = true; };
      V.el = e;
      return e;
    },
    sync(P) {
      const V = P.vsong;
      if (!V || V.mode !== 'video') return;
      const e = this.el(P);
      if (!e || e.readyState < 1) return;
      const t = Math.max(0, (P.songPos || 0) / 1000), run = P.started && !P.paused && !P.gameOver && !P.ended && P.songPos > 0;
      if (run) {
        if (e.paused) { const pr = e.play(); if (pr && pr.catch) pr.catch(() => {}); }
        const off = e.currentTime - t;
        if (Math.abs(off) > 0.15) { e.currentTime = t; e.playbackRate = 1; }
        else e.playbackRate = Math.abs(off) > 0.03 ? (off < 0 ? 1.06 : 0.94) : 1;     // small drifts: speed up / slow down a hair
      } else {
        if (!e.paused) e.pause();
        if (P.songPos <= 0 && e.currentTime > 0.05) e.currentTime = 0;
      }
    },
    update(P) { this.sync(P); },
    drawOver(ctx, P) {
      const V = P.vsong;
      if (!V || V.mode !== 'video') return;
      this.sync(P);       // (also while paused: the pause menu stops it)
      G.setScreenT(ctx);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      const e = V.el;
      if (e && e.readyState >= 2 && e.videoWidth) {
        const k = Math.max(G.W / e.videoWidth, G.H / e.videoHeight), w = e.videoWidth * k, h = e.videoHeight * k;
        ctx.drawImage(e, (G.W - w) / 2, (G.H - h) / 2, w, h);
      }
    },
    reset(P) { const e = P.vsong && P.vsong.el; if (e) { e.pause(); if (e.readyState >= 1) e.currentTime = 0; } },
    leave(P) {
      const e = P.vsong && P.vsong.el;
      if (e) { e.pause(); e.removeAttribute('src'); e.load(); }
      if (P.vsong) P.vsong.el = null;
    },
  };
})();
