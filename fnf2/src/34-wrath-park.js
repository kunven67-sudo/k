// FNF 2 - WRATH's park (the GLARE stage): a sunny day that goes wrong when he snaps.
//   WrathSnap (bar 32)  -> night falls in a blink, the picture glitches like a broken TV
//   WrathEye  (bar 35)  -> blood-red light on the houses, black silhouettes, a shadow crowd behind the fence
//   ParkVoid  (bar 52)  -> everything fades into a black void, the ground cracks open, only the eye glows
// The night + red looks are painted from the park art itself (tools/own/park.py), so swapping is free.
(function () {
  const IMG = 'shared/images/wrath-park/';
  const FILE = { back: 'back', truckInside: 'truck-inside', truck: 'truck', front: 'front', bench: 'bench', trashcan: 'trashcan' };
  // the characters stand in the same light as the place
  const TINT = {
    day: {},
    night: { bf: 'brightness(72%) saturate(80%)', gf: 'brightness(70%) saturate(80%)', dad: 'brightness(72%) saturate(80%)' },
    red: { bf: 'brightness(62%) sepia(45%) saturate(190%) hue-rotate(-20deg)', gf: 'brightness(58%) sepia(45%) saturate(190%) hue-rotate(-20deg)' },
    void: { bf: 'brightness(80%) contrast(112%)', gf: 'brightness(55%) contrast(110%)' },
  };

  function texturesOf(sp) {
    const out = new Set();
    const add = a => {
      if (!a) return;
      if (a.sheet && a.sheet.img) out.add(a.sheet.img);
      if (a.atlas) for (const k in a.atlas.sprites) out.add(a.atlas.sprites[k].img);
    };
    add(sp); for (const k in sp.anims || {}) add(sp.anims[k]);
    if (sp.img) out.add(sp.img);
    return out;
  }
  // bake the tinted textures now, so the first frame of a new light doesn't hitch mid-song
  function warm(sp, f) {
    if (!sp || !f) return;
    G.imgFilter = f;
    try { for (const img of texturesOf(sp)) G.srcImg(img); } finally { G.imgFilter = null; }
  }
  function drawWith(f) { return function (ctx, cam) { G.imgFilter = f; try { G.Sprite.prototype.draw.call(this, ctx, cam); } finally { G.imgFilter = null; } }; }

  function glowImage(r, rgb) {
    const c = document.createElement('canvas'); c.width = c.height = r * 2;
    const x = c.getContext('2d'), g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, `rgba(${rgb},0.75)`); g.addColorStop(0.35, `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c;
  }

  G.SongFX = G.SongFX || {};
  G.SongFX.glare = {
    setup(P) {
      const st = P.stage; if (st.id !== 'wrathPark') return;
      const byName = n => st.props.find(p => p.name === n);
      const S = P.park = { layers: [], extra: [], sky: byName('sky'), kenny: byName('kenny') };
      // a night + a red copy over each layer
      for (const n in FILE) {
        const base = byName(n); if (!base) continue;
        const L = { base };
        for (const m of ['night', 'red']) {
          const img = G.A.image(IMG + FILE[n] + '-' + m + '.png'); if (!img) continue;
          const s = new G.Sprite(0, 0).loadImage(img);
          s.scale.x = base.scale.x; s.scale.y = base.scale.y; s.updateHitbox();
          s.x = base.x; s.y = base.y; s.scroll.x = base.scroll.x; s.scroll.y = base.scroll.y;
          s.zIndex = base.zIndex + (m === 'night' ? 0.1 : 0.2); s.name = n + '-' + m;
          st.props.push(s); L[m] = s;
        }
        S.layers.push(L);
      }
      // the shadow crowd behind the fence (FNF's own Erect crowd, blacked out)
      S.crowd = [];
      for (const [x, flip] of [[-560, false], [1150, true]]) {
        // (blacked out + half size at build time: tools/own/park.py)
        const c = new G.Sprite(x, 150).loadSparrow(IMG + 'crowd-shadow');
        if (!c.sheet) continue;
        c.addAnim('idle', 'idle', 24, false); c.play('idle', true);
        c.scale.x = c.scale.y = 2.1; c.updateHitbox(); c.x = x; c.y = 150;
        c.scroll.x = c.scroll.y = 0.84; c.zIndex = 26; c.flipX = flip; c.name = 'crowd';
        st.props.push(c); S.crowd.push(c);
      }
      // the cracks in the ground + the eye's glow (void)
      const ck = G.A.image(IMG + 'cracks.png');
      if (ck) {
        S.cracks = new G.Sprite(0, 0).loadImage(ck);
        S.cracks.scale.x = S.cracks.scale.y = 1.9; S.cracks.updateHitbox();
        S.cracks.x = 700 - S.cracks.width / 2; S.cracks.y = 845 - S.cracks.height / 2; S.cracks.zIndex = 60; S.cracks.name = 'cracks';
        st.props.push(S.cracks);
      }
      S.glow = new G.Sprite(0, 0).loadImage(glowImage(256, '255,30,30'));
      S.glow.scale.x = S.glow.scale.y = 3.2; S.glow.updateHitbox(); S.glow.zIndex = 190; S.glow.name = 'eyeGlow';
      st.props.push(S.glow);
      // the static for the TV glitch
      S.noise = document.createElement('canvas'); S.noise.width = 320; S.noise.height = 180;
      const nx = S.noise.getContext('2d'), id = nx.createImageData(320, 180);
      for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
      nx.putImageData(id, 0, 0);
      S.scan = document.createElement('canvas'); S.scan.width = 8; S.scan.height = G.H + 4;
      const sc = S.scan.getContext('2d'); sc.fillStyle = '#000'; for (let y = 0; y < S.scan.height; y += 4) sc.fillRect(0, y, 8, 1.5);
      // the void's red vignette, drawn once
      S.vig = document.createElement('canvas'); S.vig.width = 320; S.vig.height = 180;
      const vc = S.vig.getContext('2d'), vg = vc.createRadialGradient(160, 90, 45, 160, 90, 162);
      vg.addColorStop(0, 'rgba(40,0,0,0)'); vg.addColorStop(1, 'rgba(40,0,0,0.7)'); vc.fillStyle = vg; vc.fillRect(0, 0, 320, 180);
      // every picture this stage can swap to goes to the GPU now, not mid-song (that was a big hitch)
      for (const sp of st.props) G.A.warmNow(texturesOf(sp));
      // light up the characters' tinted textures before the song starts (once their pictures are decoded)
      G.A.afterLoad(() => {
        for (const ph in TINT) for (const slot in TINT[ph]) warm(slot === 'bf' ? P.bf : slot === 'gf' ? P.gf : P.dad, TINT[ph][slot]);
        if (P.dadForms) warm(P.dadForms[0], TINT.night.dad);
      });
      this.reset(P);
    },
    reset(P) {
      const S = P.park; if (!S) return;
      S.phase = 'day'; S.night = 0; S.red = 0; S.void = 0; S.glitch = 0; S.burst = 0; S.crack = 0; S.crackPulse = 0;
      this.apply(P);
      if (S.kenny) S.kenny.visible = false;                               // Kenny is only in the cutscene
    },
    event(P, name) {
      const S = P.park; if (!S) return;
      if (name === 'WrathSnap') { S.phase = 'night'; S.glitch = 1.2; }
      else if (name === 'WrathEye') { S.phase = 'red'; S.glitch = 0.5; }
      else if (name === 'ParkVoid') { S.phase = 'void'; S.glitch = 0.7; }
    },
    beat(P, beat) {
      const S = P.park; if (!S) return;
      if (S.phase === 'red') for (const c of S.crowd) c.play('idle', true);
      if (S.phase === 'night' && Math.random() < 0.35) S.burst = 0.18 + Math.random() * 0.2;    // the picture keeps cutting out
      if (S.phase === 'void' && S.crack < 1 && beat % 2 === 0) { S.crackPulse = 1; if (G.settings.flashing !== false) P.cam.shake(0.006, 0.2); }
    },
    update(P, dt) {
      const S = P.park; if (!S) return;
      const to = (v, t, rate) => v + (t - v) * Math.min(1, dt * rate);
      const ph = S.phase;
      S.night = ph === 'night' ? Math.min(1, S.night + dt * 6) : ph === 'day' ? 0 : S.night;
      S.red = ph === 'red' || ph === 'void' ? 1 : 0;
      S.void = ph === 'void' ? Math.min(1, S.void + dt / 1.6) : 0;
      if (ph === 'void') S.crack = Math.min(1, S.crack + dt / 3.2);
      S.glitch = Math.max(0, S.glitch - dt); S.burst = Math.max(0, S.burst - dt);
      S.crackPulse = Math.max(0, S.crackPulse - dt * 2.5);
      // the eye's glow sits behind it
      const d = P.dad;
      if (S.glow && d) { S.glow.x = d.x + d.width / 2 - S.glow.width / 2; S.glow.y = d.y + d.height * 0.45 - S.glow.height / 2; }
      for (const c of S.crowd) c.update(dt);
      this.apply(P);
    },
    apply(P) {
      const S = P.park, ph = S.phase, v = S.void;
      for (const L of S.layers) {
        const k = 1 - v;
        const na = L.night ? S.night * (1 - S.red) * k : 0, ra = L.red ? S.red * k : 0;
        L.base.alpha = k;
        if (L.night) L.night.alpha = na;
        if (L.red) L.red.alpha = ra;
        // a fully opaque copy on top hides the layer under it: don't draw both (big layers = lag)
        L.base.visible = !(na >= 1 || ra >= 1);
        if (L.night) L.night.visible = !(ra >= 1);
      }
      if (S.sky) S.sky.solid = ph === 'day' ? '#9fc7ee' : ph === 'night' ? '#141a38' : ph === 'red' ? '#6a0010' : '#000';
      for (const c of S.crowd) c.alpha = S.red * (1 - v) * 0.92;
      if (S.cracks) S.cracks.alpha = ph === 'void' ? Math.min(1, S.crack * 1.4) : 0;
      if (S.glow) S.glow.alpha = ph === 'void' ? 0.35 + 0.45 * v + 0.2 * S.crackPulse : ph === 'red' ? 0.25 : 0;
      if (S.kenny && ph !== 'day') S.kenny.visible = false;
      P.charFilter = Object.assign({}, TINT[ph]);
      if (P.dadForms && P.dad === P.dadForms[1]) delete P.charFilter.dad;       // the eye glows on its own
    },
    // over the world: the TV glitch (snap + the night), a red vignette in the void
    drawOver(ctx, P) {
      const S = P.park; if (!S) return;
      const g = Math.max(S.glitch, S.burst);
      const W = G.W, H = G.H;
      if (g > 0 && G.settings.flashing !== false) {
        const cv = ctx.canvas, sx = cv.width / W, sy = cv.height / H;
        ctx.save(); G.setScreenT(ctx);
        // torn horizontal bands
        const n = 2 + Math.floor(g * 4);
        for (let i = 0; i < n; i++) {
          const y = Math.random() * H, h = 6 + Math.random() * 40 * g, dx = (Math.random() - 0.5) * 120 * g;
          ctx.drawImage(cv, 0, y * sy, cv.width, h * sy, dx, y, W, h);
        }
        // static + scanlines (one cached picture each)
        ctx.globalAlpha = Math.min(0.32, g * 0.28);
        ctx.drawImage(S.noise, Math.random() * -40, Math.random() * -40, W + 40, H + 40);
        ctx.globalAlpha = Math.min(0.35, g * 0.3);
        ctx.drawImage(S.scan, 0, -((G.time * 90) % 4), W, H + 4);
        if (Math.random() < g * 0.12) { ctx.globalAlpha = 0.85; ctx.drawImage(S.noise, 0, 0, W, H); }   // the signal drops for a frame
        ctx.restore();
      }
      if (S.phase === 'void' && S.void > 0) {
        ctx.save(); G.setScreenT(ctx); ctx.globalAlpha = S.void;
        ctx.drawImage(S.vig, 0, 0, W, H); ctx.restore();
      }
    },
  };
})();
