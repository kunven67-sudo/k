// FNF 2 - VS Tricky (Banbuds, Rozebud, KadeDev, Cval, YingYang48, JADS, Moro + team; "The Full-Ass Tricky Mod",
// V-Slice port by thisaintcub, PurSnake + LeonidKosherny), played like the mod:
//   Improbable Outset  the jaws open, "somewhere in nevada", Tricky walks up + drops his sign, "OMFG CLOWN!!!!"
//   Madness            the video of Hank shooting him first; after the song he comes back ("YOU DO NOT KILL CLOWN",
//                      "CLOWN KILLS YOU!!!!!!") and turns into the pillar of fire
//   Hellclown          the video first, the giant Tricky shakes the screen when he sings, Hank dances on the island,
//                      fire notes; in story mode the TricksterMan video at the end of the week
//   Expurgation        EX Tricky climbs out of the ground (every try), halo notes, clones, floor spikes, the signs that
//                      cover your arrows, the HP gremlin that drags your health away, the energy wall
// All the songs: the static + red words when Tricky sings, the sign falling on BF when you die.
// Fire notes + halo notes are note kinds (G.NoteKinds, 20-play.js). Mechanics are kept, a bit easier (FNF 2 rule): fire
// takes 0.35 health (mod: 0.45), a halo takes half the bar (mod: you die), the gremlin leaves you 10% more.
// Art, songs, charts + videos come from the mod (tools/own/tricky.py, private build only).
(function () {
  const IMG = 'shared/images/', SND = 'shared/sounds/', VID = 'videos/videos/';
  const flashOn = () => G.settings.flashing !== false;
  const isStory = P => P.params && P.params.mode === 'story';
  const INIT = -0.275 * 104;                      // (Strumline.INITIAL_OFFSET)
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const FIRE_HIT = 0.35, HALO_HIT = 1.0, GREMLIN_EASE = 10;
  const quadInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const sineOut = t => Math.sin(t * Math.PI / 2);
  const elasticIn = t => t <= 0 ? 0 : t >= 1 ? 1 : -(Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1 - 0.4 / (2 * Math.PI) * Math.asin(1)) * (2 * Math.PI) / 0.4));
  const loop = (name, o) => G.audio.voice(SND + name + '.ogg', Object.assign({ loop: true }, o));

  // a sheet tools/own/tricky.py packed at a fraction f of its size: drawn at scale s / f, in the same spot as the full
  // size one (FlxSprite scaled around the middle of its first frame, no updateHitbox)
  function shrunk(spr, f, s) {
    spr.scale.x = spr.scale.y = s / f;
    const k = (1 - f) / (2 * f); spr.offset.x = -spr.frameW * k; spr.offset.y = -spr.frameH * k;
    return spr;
  }
  const SHRINK = { 'mechanics/Sign_Post_Mechanic': 0.7, 'mechanics/HP GREMLIN': 0.8, 'bgs/expurgation/EXENTER': 0.6, 'bgs/expurgation/Clone': 0.6, 'bgs/expurgation/FloorSpikes': 0.6, 'cutscenes/somewhere': 0.5 };
  function sprite(sheet, x, y, scale) {
    const s = new G.Sprite(x, y).loadSparrow(IMG + sheet);
    if (SHRINK[sheet]) shrunk(s, SHRINK[sheet], scale || 1); else if (scale) s.scale.x = s.scale.y = scale;
    return s;
  }

  // ================================================================ fire notes + halo notes (notekinds/*.hxc)
  G.NoteKinds = G.NoteKinds || {};
  // fire: hit it and you burn (smoke splash); the arrows are upside down on downscroll (hellnotes.hxc swaps up + down)
  G.NoteKinds.trickyhell = {
    style: 'hellnotes', off: [45, 150], offDown: [45, 260], flipDown: true, swapDown: true, trap: true,
    hit(P, n) { G.sfx(SND + 'burnSound.ogg'); P.health -= FIRE_HIT; P.splash(n.lane, P.kindStyle(this)); },
  };
  // halo: hit it and... in the mod you die. Here it takes half your health
  G.NoteKinds.trickydeath = {
    style: 'deathnotes', off: [null, 90], trap: true,
    hit(P, n) { G.sfx(SND + 'death.ogg'); P.health -= HALO_HIT; P.cam.flash('#ff0000', flashOn() ? 0.6 : 0.2); if (P.audio) P.audio.setVolume('p', 0); },
  };

  // ================================================================ the static + the red words (StaticTextHandler.hxc)
  const LINES = ['SUFFER', 'INCORRECT', 'INCOMPLETE', 'INSUFFICIENT', 'INVALID', 'CORRECTION', 'MISTAKE', 'REDUCE', 'ERROR', 'ADJUSTING', 'IMPROBABLE', 'IMPLAUSIBLE', 'MISJUDGED'];
  const EX_LINES = ["YOU AREN'T HANK", 'WHERE IS HANK', 'HANK???', 'WHO ARE YOU', 'WHERE AM I', "THIS ISN'T RIGHT", 'MIDGET', 'SYSTEM UNRESPONSIVE', "WHY CAN'T I KILL?????"];
  const MISS_LINES = ['TERRIBLE', 'WASTE', 'MISS CALCULTED', 'PREDICTED', 'FAILURE', 'DISGUSTING', 'ABHORRENT', 'FORESEEN', 'CONTEMPTIBLE', 'PROGNOSTICATE', 'DISPICABLE', 'REPREHENSIBLE'];
  const SPOOK = { 'improbable-outset': [2, LINES], madness: [20, LINES], hellclown: [45, []], expurgation: [60, EX_LINES] };
  const tk = P => P.tk || (P.tk = { on: false, step: 0, at: 0, text: null, staticOn: false, manual: false });
  // (Tricky's line at a random spot by him, or a set spot in the cutscenes; no lines = just the static)
  function spook(P, lines, x, y, manual) {
    const T = tk(P);
    T.on = true; T.step = T.at; T.staticOn = true; T.manual = !!manual;
    G.sfx(SND + 'staticSound.ogg');
    T.text = lines && lines.length ? { s: pick(lines), x: x != null ? x : P.dad.x + rnd(40, 120), y: y != null ? y : P.dad.y + rnd(200, 300), a: 1 } : null;
  }
  const unspook = P => { const T = tk(P); T.staticOn = false; if (T.text) T.text.a = 0; };   // (resetSpookyTextManual)
  function spookStep(P, s) {
    const T = tk(P); T.at = s;
    if (T.on && !T.manual && s > T.step + 3) { T.on = false; T.text = null; T.staticOn = false; }
  }
  function drawSpook(ctx, P) {
    const T = P.tk; if (!T || !T.on) return;
    if (T.text && T.text.a > 0) {
      // red Impact 128 in the world, shaking (angle -5..5 every frame, around its middle like FlxText)
      P.cam.apply(ctx, 1, 1);
      ctx.save();
      ctx.font = 'bold 128px impact, Impact, sans-serif'; ctx.textBaseline = 'top';
      const w = ctx.measureText(T.text.s).width + 4, h = 150;
      ctx.translate(T.text.x + w / 2, T.text.y + h / 2); ctx.rotate(Math.round(rnd(-5, 5)) * Math.PI / 180);
      ctx.globalAlpha *= T.text.a; ctx.fillStyle = '#ff0000'; ctx.fillText(T.text.s, -w / 2 + 2, -h / 2 + 2);
      ctx.restore();
    }
    if (T.staticOn) {
      // TrickyStatic: 3 frames of 320x180 at 8x, 24 fps, a new random see-through every frame
      const img = G.A.image(IMG + 'bgs/TrickyStatic.png'); if (!img) return;
      G.setScreenT(ctx); ctx.save(); ctx.globalAlpha = rnd(0.1, 0.5);
      const fi = Math.floor(performance.now() / (1000 / 24)) % 3;
      ctx.drawImage(G.srcImg(img), 0, fi * 180, 320, 180, (G.W - 2560) / 2, (G.H - 1440) / 2, 2560, 1440); ctx.restore();
    }
  }

  // ================================================================ in the songs
  const GAMEOVER = { sfx: SND + 'gameplay/gameover/fnf_loss_sfx-sign.ogg', music: 'shared/music/gameplay/gameover/gameOverTrickster.ogg', end: 'shared/music/gameplay/gameover/gameOverEndTrickster.ogg' };
  // the cutscene pictures: asked for with the song (so they're ready), let go once the cutscene is over
  const CUTSHEETS = {
    'improbable-outset': ['Jaws', 'cutscenes/somewhere', 'cutscenes/intro'], madness: ['cutscenes/trickman'], expurgation: ['bgs/expurgation/EXENTER'],
  };
  const cutImgs = id => { const out = []; for (const p of CUTSHEETS[id] || []) { const sh = G.Sparrow.load(IMG + p); if (sh) out.push(...(sh.imgs || [sh.img])); } return out.filter(Boolean); };
  const wantsCut = P => !P.params.noCutscene && (P.song.id === 'expurgation' || !P.params.deaths);
  function songFX(id, more) {
    const [chance, lines] = SPOOK[id];
    const fx = {
      gameOver: GAMEOVER,
      setup(P) { P.tk = null; if (wantsCut(P)) cutImgs(id); G.A.image(IMG + 'bgs/TrickyStatic.png'); if (more.setup) more.setup(P); },
      prepare(P, tex) { if (wantsCut(P)) for (const im of cutImgs(id)) tex.add(im); if (more.prepare) more.prepare(P, tex); },
      reset(P) { P.tk = null; if (more.reset) more.reset(P); },
      step(P, s) { spookStep(P, s); if (more.step) more.step(P, s); },
      beat(P, b) { if (more.beat) more.beat(P, b); },
      // one vocal track (TrickyVocalVolumeSetter): Tricky singing brings it back after your miss
      oppHit(P, n) {
        if (P.audio) P.audio.setVolume('p', 1);
        if (Math.random() * 100 < chance && !tk(P).on) spook(P, lines);
      },
      miss(P, n) { if (id === 'madness' && Math.random() < 0.1 && !tk(P).on) spook(P, MISS_LINES); if (more.miss) more.miss(P, n); },
      playerHit(P, n, r) { if (more.playerHit) more.playerHit(P, n, r); },
      update(P, dt) { if (more.update) more.update(P, dt); },
      event(P, e, v) { if (more.event) more.event(P, e, v); },
      drawOver(ctx, P) { if (!P.cutscene) drawSpook(ctx, P); },
      drawTop(ctx, P) { if (more.drawTop) more.drawTop(ctx, P); },
    };
    return fx;
  }

  // ---- Hellclown: the screen shakes while the giant Tricky sings (trickyH.hxc)
  const hellclown = {
    update(P) { if (P.dad && /^sing/.test(P.dad.animName)) P.cam.shake(flashOn() ? 0.02 : 0.006, 0.2); },
  };

  // ---- Expurgation (auditorHell.hxc, exTricky.hxc, ExpurgationSign/Gremlin.hxc, expurgation.hxc)
  const expurgation = {
    setup(P) {
      const X = P.ex = { clones: [], signs: [], grem: null, auto: 0 };
      for (let i = 0; i < 2; i++) {
        const c = sprite('bgs/expurgation/Clone', 0, 0); c.addAnim('clone', 'Clone', 24, false); c.alpha = 0; c.zIndex = 201;
        c.onFinish = () => { c.alpha = 0; }; X.clones.push(c); P.stage.addExtra(c);
      }
      const sp = X.spikes = sprite('bgs/expurgation/FloorSpikes', 550, 470); sp.addAnim('spike', 'Floor Spikes', 24, false); sp.alpha = 0; sp.zIndex = 400;
      P.stage.addExtra(sp);
      // (asked for now: they're ready before the song)
      G.Sparrow.load(IMG + 'mechanics/Sign_Post_Mechanic'); G.Sparrow.load(IMG + 'mechanics/HP GREMLIN'); G.A.image(IMG + 'bgs/expurgation/lolz.png');
    },
    reset(P) {
      const X = P.ex; if (!X) return;
      for (const c of X.clones) { c.alpha = 0; c.finished = true; }
      X.spikes.alpha = 0; X.spikes.on = false; X.signs = []; X.grem = null; X.auto = 0;
    },
    // a clone of him every 8 beats (on beat 4), left or right, if that one isn't already there
    beat(P, b) {
      if (b % 8 !== 4) return;
      const side = Math.random() < 0.5 ? 0 : 1, c = P.ex.clones[side];
      if (c.alpha >= 1) return;
      c.x = side ? 1090 : 760; c.y = side ? 480 : 460; c.alpha = 1; c.play('clone', true);
    },
    update(P, dt) {
      const X = P.ex, d = P.dad;
      for (const c of X.clones) if (c.alpha > 0) c.update(dt);
      // floor spikes: come up when he sings UP, stay up (frame 3) while he holds it, go back down after
      const sp = X.spikes, up = d && /^singUP/.test(d.animName);
      if (!sp.on) { if (up) { sp.on = true; sp.alpha = 1; sp.paused = false; sp.play('spike', true); } }
      else { sp.paused = up && sp.fi >= 3; sp.update(dt); if (sp.finished) { sp.on = false; sp.alpha = 0; } }
      for (const s of X.signs) s.update(dt);
      X.signs = X.signs.filter(s => !s.finished);
      updateGremlin(P, dt);
      // the gremlin comes by himself every 25 s while your health is high (until step 2400)
      if (P.started) {
        X.auto += dt;
        if (X.auto >= 25) { X.auto -= 25; if ((P.cond.lastStep || 0) < 2400 && P.health >= 1.5) gremlin(P, 40, 3, false); }
      }
    },
    event(P, e, v) {
      if (e === 'tricky.ExpurgationSignEvent') sign(P, +v.type || 0, !!v.flipX);
      else if (e === 'tricky.ExpurgationGremlinEvent') gremlin(P, +v.hpToTake || 1, +v.duration || 1, !!v.persist);
    },
    playerHit(P, n, r) { const g = P.ex.grem; if (!g) return; if (r === 'bad') g.dmg += 60; if (r === 'shit') g.dmg += 200; if (r === 'bad' || r === 'shit') g.stop = true; },
    miss(P) { const g = P.ex.grem; if (g) { g.dmg += 75; g.stop = true; } },
    drawTop(ctx, P) {
      const X = P.ex, hud = P.hud;
      // the energy wall right of your arrows, the signs, the gremlin (all on the HUD)
      const wall = G.A.image(IMG + 'bgs/expurgation/lolz.png');
      if (wall) { hud.apply(ctx); ctx.drawImage(G.srcImg(wall), notesX(P) + 200, -200); }
      for (const s of X.signs) s.draw(ctx, hud);
      if (X.grem) X.grem.spr.draw(ctx, hud);
    },
  };
  // (playerStrumline.x + getXPos(3): where your RIGHT arrow's column starts)
  const notesX = P => P.lines[1].strums[3].x - INIT;
  function sign(P, type, flip) {
    const s = sprite('mechanics/Sign_Post_Mechanic', 0, 0, 0.67);
    if (!s.addAnim('sign', 'Signature Stop Sign ' + [1, 3, 4][type], 24, false)) return;
    const sx = notesX(P) - 400;
    if (type === 0) { s.x = sx; s.y = -300; } else if (type === 1) { s.x = sx - 130; s.y = P.down ? -395 : -980; } else { s.x = sx - 420; s.y = -145; }
    s.angle = -90; s.flipX = flip; s.play('sign', true);
    P.ex.signs.push(s);
  }
  // the health bar the V-Slice way: where your icon is, where a health amount is on the bar
  function bar(P) {
    const bg = P.hbBg, bx = bg.x + 4, bw = bg.width - 8;
    return { bgY: bg.y, icon: bg.x + bg.width * (1 - G.clamp(P.health / 2, 0, 1)) - 26, at: h => bx + bw * (1 - G.clamp(h / 2, 0, 1)) - 26 - 75 };
  }
  function gremlin(P, pct, dur, persist) {
    if (P.health < 1.5 && !persist) return;
    pct = Math.min(100, pct + GREMLIN_EASE);
    const g = sprite('mechanics/HP GREMLIN', 0, 0, 0.76);
    g.addAnim('come', 'HP Gremlin ANIMATION', 24, false, [0, 1]);
    g.addAnim('grab', 'HP Gremlin ANIMATION', 24, false, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
    g.addAnim('hold', 'HP Gremlin ANIMATION', 24, true, [25, 26, 27, 28]);
    g.addAnim('release', 'HP Gremlin ANIMATION', 24, false, [29, 30, 31, 32, 33]);
    const B = bar(P);
    g.x = B.icon; g.y = B.bgY - 325;
    if (P.down) { g.flipY = true; g.y -= 150; }
    const start = P.health, to = pct / 100 * start;
    P.ex.grem = { spr: g, phase: 'come', t: 0, start, to, dur, persist, dmg: 0, stop: false, x0: g.x, x1: B.icon - 140, x2: B.at(to) };
    G.sfx(SND + 'expurgation/GremlinWoosh.ogg');
    g.play('come', true);
  }
  function updateGremlin(P, dt) {
    const g = P.ex.grem; if (!g) return;
    const s = g.spr; s.update(dt); g.t += dt;
    if (g.phase === 'come' && g.t >= 0.14) { g.phase = 'grab'; g.t = 0; s.play('grab', true); }
    if (g.phase === 'grab') {
      s.x = g.x0 + (g.x1 - g.x0) * elasticIn(Math.min(1, g.t));
      if (g.t >= 1) { g.phase = 'hold'; g.t = 0; s.play('hold', true); g.xa = s.x; }
    }
    if (g.phase === 'hold') {
      const k = Math.min(1, g.t / g.dur);
      s.x = g.xa + (g.x2 - g.xa) * k;
      if (g.stop && !g.persist) { g.phase = 'release'; s.play('release', true); }        // a bad hit / miss: he lets go
      else {
        P.health = Math.max(0.1, g.start + (g.to - g.start) * k);
        if (k >= 1) { g.phase = 'release'; s.play('release', true); if (g.persist && g.dmg >= 700) P.health -= g.dmg / 1000; }
      }
    }
    if (g.phase === 'release' && s.finished) P.ex.grem = null;
  }

  G.SongFX = G.SongFX || {};
  G.SongFX['improbable-outset'] = songFX('improbable-outset', {});
  G.SongFX.madness = songFX('madness', {});
  G.SongFX.hellclown = songFX('hellclown', hellclown);
  G.SongFX.expurgation = songFX('expurgation', expurgation);

  // ================================================================ the cutscenes
  // a video on black (VideoCutscene.play), the mod's mp4s as WebM
  const video = (name, opt) => ({
    enter(S) {
      S.black = 0; S.vidDone = false;
      const src = G.A.raw[VID + name + '.webm'];
      if (!src) { S.vidDone = true; return; }
      const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
      v.volume = Math.min(1, (G.settings.vol.master || 1) * (G.settings.vol.sfx == null ? 1 : G.settings.vol.sfx));
      v.onended = () => { S.vidDone = true; }; v.onerror = () => { S.vidDone = true; };
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => { S.vidDone = true; }); });
      S.video = v;
    },
    update(S) { if (S.t > 3 && S.video && S.video.readyState < 2) S.vidDone = true; if (S.vidDone) S.go(); },
    draw(S, ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      const v = S.video;
      if (v && v.readyState >= 2) { const k = Math.min(G.W / v.videoWidth, G.H / v.videoHeight), w = v.videoWidth * k, h = v.videoHeight * k; ctx.drawImage(v, (G.W - w) / 2, (G.H - h) / 2, w, h); }
    },
    leave(S) { if (S.video) { try { S.video.pause(); } catch (e) {} S.video = null; } },
  });
  const scene = (id, steps) => P => { const sc = G.Scene(P, steps); const prev = sc.after; sc.after = s => { if (prev) prev(s); for (const im of cutImgs(id)) G.Pin.drop(im); }; return sc; };
  const fill = (ctx, c, a) => { if (a <= 0) return; G.setScreenT(ctx); ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = c; ctx.fillRect(0, 0, G.W, G.H); ctx.restore(); };

  // ---- the jaws (Jaws.png 'Jaws smol' at 1.38x from (-300, -760): only the part on the screen was kept, see tricky.py)
  const JAWS = { x: -300 + 1037.5 * (1 - 1.38) + 480 * 1.38, y: -760 + 1152.5 * (1 - 1.38) + 850 * 1.38, s: 1.38 };
  function jaws() {
    const j = new G.Sprite(JAWS.x, JAWS.y).loadSparrow(IMG + 'Jaws');
    j.addAnim('close', 'Jaws smol', 24, false); j.play('close', true);
    j.scale.x = j.scale.y = JAWS.s; j.origin.x = j.origin.y = 0;
    return j;
  }

  // ---- Improbable Outset (improbable-outset.hxc): jaws open, "somewhere in nevada", Tricky arrives
  const outset = {
    enter(S) {
      const P = S.P;
      S.dance = false; S.cam.z = P.stageZoom;
      P.dad.visible = false; if (P.gf) P.gf.visible = false;
      const f = P.bf.camFocus; P.cam.focus(f.x + 100, f.y); P.cam.followRate = 0.04;
      S.jaw = jaws(); S.jaw.fi = 18; S.jaw.paused = true;
      S.nev = sprite('cutscenes/somewhere', 1160, 780, 0.5); S.nev.addAnim('nevada', 'somewhere idfk', 24, false); S.nev.visible = false;
      S.intro = sprite('cutscenes/intro', 850, 450, 1.2); S.intro.addAnim('go', 'Symbol', 24, false); S.intro.visible = false;
      S.red = 1; S.blk = 0; S.blk3 = 0; S.ph = 'jaws'; S.pt = 0; S.cues = {}; S.scared = false; S.tick = 0;
    },
    update(S, dt) {
      const P = S.P, cue = (k, fn) => { if (!S.cues[k]) { S.cues[k] = true; fn(); } };
      S.pt += dt;
      // BF: his idle over and over, scared once Tricky's sign lands
      const bf = P.bf; if (bf.finished) bf.playAnim(S.scared ? 'scared' : 'idle', true);
      if (S.ph === 'jaws') {
        if (S.pt >= 1.51) S.jaw.paused = false;
        S.jaw.update(dt);
        if (S.jaw.fi >= 30) S.jaw.visible = false;
        if (S.jaw.finished) { S.ph = 'nevada'; S.pt = 0; S.nev.visible = true; S.nev.play('nevada', true); }
        return;
      }
      if (S.ph === 'nevada') {
        S.nev.update(dt);
        if (S.nev.fi >= 34) cue('wind', () => { S.wind = loop('wind', { fadeIn: 1 }); });
        // (the red goes away 0.1 every 0.1 s once the words are up)
        if (S.nev.fi >= 41) { S.tick += dt; while (S.tick >= 0.1 && S.red > 0) { S.tick -= 0.1; S.red = Math.max(0, S.red - 0.1 - 1e-9); } }
        if (S.red <= 0 && S.pt > 0.1) { S.ph = 'intro'; S.pt = 0; S.intro.visible = true; S.intro.play('go', true); S.intro.fi = 40; }
        return;
      }
      if (S.ph === 'intro') {
        if (!S.nev.finished) S.nev.update(dt);
        S.intro.update(dt);
        const fi = S.intro.fi;
        if (fi >= 73) cue('ground', () => G.sfx(SND + 'ground.ogg'));
        if (fi >= 84) cue('sign', () => G.sfx(SND + 'signFall.ogg'));
        if (fi >= 170) cue('omfg', () => { G.sfx(SND + 'cloth.ogg'); spook(P, ['OMFG CLOWN!!!!'], 960, G.H * 0.9 + 230, true); S.omfg = S.pt; });
        if (S.omfg != null && S.pt - S.omfg >= 0.5) cue('omfgOff', () => unspook(P));
        if (fi >= 190) S.scared = true;
        if (fi >= 192) cue('build', () => { S.build = G.audio.voice(SND + 'trickyIsTriggered.ogg', { fadeIn: 1 }); });
        if (fi >= 219) cue('buildOut', () => { if (S.build) S.build.stop(1); });
        // the camera goes to Tricky (zoom 1.1), then back + shaking
        const d = P.dad.camFocus;
        if (fi >= 115 && fi < 200) { P.cam.follow(d.x - 100, d.y + 100); P.cam.followRate = 0.15; S.cam.z += (1.1 - S.cam.z) * Math.min(1, dt * 12); }
        else if (fi > 200) { P.cam.follow(d.x, d.y); S.cam.z += (P.stageZoom - S.cam.z) * Math.min(1, dt * 12); P.cam.shake(0.01, 0.2); }
        if (fi >= 235 || S.intro.finished) { S.ph = 'black'; S.pt = 0; }
        return;
      }
      if (S.ph === 'black') {
        P.cam.shake(0.01, 0.2);
        S.blk = Math.min(1, S.pt / 0.25);
        if (S.pt >= 0.3) {
          S.ph = 'out'; S.pt = 0; S.intro.visible = false; S.nev.visible = false; S.blk = 0; S.blk3 = 1;
          P.dad.visible = true; if (P.gf) P.gf.visible = true; P.cam.shakeT = 0; P.cam.focus(d0(P).x, d0(P).y);
          S.cam.z = P.stageZoom;
        }
        return;
      }
      if (S.ph === 'out') {
        S.blk3 = S.pt < 0.3 ? 1 : Math.max(0, 1 - Math.floor((S.pt - 0.3) / 0.25 + 1) * 0.25);
        if (S.blk3 <= 0) { if (S.wind) S.wind.stop(1); S.go(); }
      }
    },
    draw(S, ctx) {
      const P = S.P;
      if (S.intro.visible) S.intro.draw(ctx, P.cam);
      fill(ctx, '#130000', S.red);
      if (S.nev.visible && !S.nev.finished) S.nev.draw(ctx, P.cam);
      fill(ctx, '#130000', S.blk); fill(ctx, '#130000', S.blk3);
      drawSpook(ctx, P);
      if (S.jaw.visible) S.jaw.draw(ctx, null);
    },
    leave(S) {
      const P = S.P; P.dad.visible = true; if (P.gf) P.gf.visible = true; P.cam.followRate = 0.04;
      if (S.wind) S.wind.stop(0.5); if (S.build) S.build.stop(0.3);
      P.tk = null; S.intro = S.nev = S.jaw = null;
    },
  };
  const d0 = P => P.dad.camFocus;

  // ---- Madness after the song (madness.hxc playCutscene): he comes back, then the pillar of fire
  const trickman = {
    enter(S) {
      const P = S.P;
      S.dance = true;
      const f = P.dad.camFocus; S.c0 = { x: P.cam.x, y: P.cam.y }; S.c1 = { x: f.x, y: f.y + 100 };
      S.an = sprite('cutscenes/trickman', 1100, 670, 1.5);
      for (const [n, pre] of [['cut1', 'Cutscene 1'], ['cut2', 'Cutscene 2'], ['cut3', 'Cutscene 3'], ['cut4', 'Cutscene 4'], ['pillar', 'Pillar Beam Tricky']]) S.an.addAnim(n, pre, 24, false);
      S.an.visible = false;
      S.fade = 0; S.white = 0; S.ph = 'in'; S.pt = 0; S.cues = {}; S.whiteW = 0;
      S.honk = loop('honkers', { fadeIn: 30 });
      P.tk = null;
    },
    update(S, dt) {
      const P = S.P, cue = (k, fn) => { if (!S.cues[k]) { S.cues[k] = true; fn(); } };
      S.pt += dt;
      const k = Math.min(1, S.t / 3), e = quadInOut(k);
      P.cam.follow(S.c0.x + (S.c1.x - S.c0.x) * e, S.c0.y + (S.c1.y - S.c0.y) * e); P.cam.followRate = 1;
      if (S.ph === 'in') {                                       // dark red fade in (1 s), Tricky swaps for the cutscene one
        S.fade = Math.min(1, S.pt);
        if (S.fade >= 1) { S.ph = 'start'; S.pt = 0; S.an.visible = true; P.dad.visible = false; }
        return;
      }
      if (S.ph === 'start') {                                    // fade back to half, then the first part
        S.fade = Math.max(0, 1 - S.pt);
        if (S.fade <= 0.5) { S.ph = 'cut'; S.pt = 0; S.an.play('cut1', true); line(S, 'YOU DO NOT KILL CLOWN', 6.5); }
        return;
      }
      S.fade = Math.max(0, S.fade - dt);
      S.an.update(dt);
      const a = S.an.animName;
      if (a === 'cut1' && S.an.fi >= 104) cue('c1off', () => unspook(P));
      if (S.ln) {
        S.ln.t += dt;
        if (S.ln.t >= 0.3 && !S.ln.s1) { S.ln.s1 = true; tk(P).staticOn = false; }
        if (S.ln.t >= S.ln.at && !S.ln.s2) { S.ln.s2 = true; tk(P).staticOn = true; G.sfx(SND + 'staticSound.ogg'); }
        if (S.ln.t >= S.ln.at + 0.3 && !S.ln.s3) { S.ln.s3 = true; unspook(P); }
      }
      if (a === 'pillar') { P.cam.shake(flashOn() ? 0.05 : 0.01, 0.5); if (S.an.fi >= 85) S.fading = true; }
      if (S.an.finished && a !== 'pillar') {
        unspook(P);
        if (a === 'cut1') S.an.play('cut2', true);
        else if (a === 'cut2') { S.an.play('cut3', true); G.sfx(SND + 'energy shot.ogg'); }
        else if (a === 'cut3') { S.an.play('cut4', true); line(S, 'CLOWN KILLS YOU!!!!!!', 8); S.an.y += 10; S.an.x -= 95; }
        else if (a === 'cut4') {
          unspook(P); if (S.honk) S.honk.stop(1); S.pillar = G.audio.voice(SND + 'firepillar.ogg', { fadeIn: 4 });
          S.an.play('pillar', true); S.an.y -= 660; S.an.x -= 220;
        }
      }
      if (S.fading) {                                            // white over 5 s (+ the roar at 70%), 5 s more, the end
        if (S.honk) { S.honk.stop(1); S.honk = null; }
        if (S.whiteA == null) S.whiteA = 0;
        S.whiteA = Math.min(1, S.whiteA + dt / 5);
        if (S.whiteA >= 0.7) cue('roar', () => G.sfx(SND + 'sound_clown_roar.ogg'));
        if (S.whiteA >= 1) { S.whiteW += dt; if (S.whiteW >= 5) S.go(); }
      }
    },
    draw(S, ctx) {
      const P = S.P;
      if (S.an.visible) S.an.draw(ctx, P.cam);
      fill(ctx, '#ffffff', S.whiteA || 0);
      fill(ctx, '#130000', S.fade);
      drawSpook(ctx, P);
    },
    leave(S) { const P = S.P; if (S.honk) S.honk.stop(0.5); if (S.pillar) S.pillar.stop(0.5); P.tk = null; P.cam.followRate = 0.04; S.an = null; },
  };
  // his line in the cutscene: static for 0.3 s, then at `at` s the static again + the line goes away 0.3 s later
  function line(S, text, at) { spook(S.P, [text], 1100, G.H * 0.9 + 400, true); S.ln = { t: 0, at }; }

  // ---- Expurgation (expurgation.hxc): EX Tricky climbs out of the ground, every try
  const exEnter = {
    enter(S) {
      const P = S.P;
      S.dance = true; S.cam.z = P.stageZoom;
      P.dad.visible = false;
      S.c0 = { x: P.cam.x, y: P.cam.y };
      S.spr = sprite('bgs/expurgation/EXENTER', 700, 240); S.spr.addAnim('go', 'Entrance', 24, false); S.spr.play('go', true);
      G.sfx(SND + 'expurgation/Trickyspawn.ogg'); S.glitch = null;
    },
    update(S, dt) {
      const P = S.P, f = P.dad.camFocus, e = sineOut(Math.min(1, S.t / 0.7));
      P.cam.follow(S.c0.x + (f.x - S.c0.x) * e, S.c0.y + (f.y - S.c0.y) * e); P.cam.followRate = 1;
      S.spr.update(dt);
      if (S.spr.fi >= 24 && !S.glitch) S.glitch = G.audio.voice(SND + 'expurgation/TrickyGlitch.ogg');
      if (S.spr.finished) S.go();
    },
    draw(S, ctx) { S.spr.draw(ctx, S.P.cam); },
    leave(S) { const P = S.P; if (S.glitch) S.glitch.stop(1); P.dad.visible = true; P.cam.followRate = 0.04; S.spr = null; },
  };

  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes['improbable-outset'] = { create: scene('improbable-outset', [outset]) };
  G.Cutscenes.madness = { create: scene('madness', [video('HankFuckingShootsTricky')]), createEnd: scene('madness', [trickman]) };
  G.Cutscenes.hellclown = { create: scene('hellclown', [video('HELLCLOWN_ENGADGED')]), createEnd: P => isStory(P) ? G.Scene(P, [video('TricksterMan')]) : null };
  G.Cutscenes.expurgation = { always: true, create: scene('expurgation', [exEnter]) };

  // ================================================================ the story menu: the jaws close on the clown week
  // (StoryConfirmMouth.hxc: swipe, clink on frame 10; they stay shut, Improbable Outset opens them)
  G.StoryFX = G.StoryFX || {};
  G.StoryFX.clown = {
    noFade: true,
    hover() { G.Sparrow.load(IMG + 'Jaws'); },
    select(M) { M.jaws = jaws(); G.sfx(SND + 'swipe.ogg'); M.jawClink = false; },
    update(M, dt) {
      const j = M.jaws; if (!j) return;
      if (j.fi < 18) j.update(dt); else j.fi = 18;
      if (j.fi >= 10 && !M.jawClink) { M.jawClink = true; G.sfx(SND + 'clink.ogg'); }
    },
    draw(M, ctx) { if (M.jaws) M.jaws.draw(ctx, null); },
  };
})();
