// FNF 2 - VS IMPOSTOR: LEGACY (MOTORFROG, Clowfoe + the Impostor team; the official remaster of VS Impostor V4),
// played like the mod. Its engine is Psych Engine based with HScript stage + song scripts; what they do is here:
//   every song   the chord ghosts (a double note: a see-through copy of the singer does the other pose and fades,
//                V4's doGhostAnim), Psych holds for the characters that have them, the camera on fixed spots
//                (camSpecialThing), the zoom bops only once the opponent sang, the mod's HUD (green time bar with
//                the song name, score text in the opponent's colour, its ratings at the top), its game over +
//                pause music, the Reactor Beep red flash, Set Cams / Reset Cams / Insta Cam Zoom / Extra Cam Zoom /
//                flash / Optional Captions events (scripts/utils.hx)
//   cutscenes    the videos before the songs (Press BACK to skip, captions) + the V4 talk box (RGB box, bubble,
//                icon, typing, the last line under it), scripts/dialogue.hx
//   stages       Polus (snow, the lonely speaker, the Meltdown crowd)
//   songs        Sabotage (GF shows up when Red notices), Meltdown (the ending video, the end of the week video)
// Pictures, songs, charts + videos come from the mod (tools/own/impostor.py, private build only).
(function () {
  const IMG = 'shared/images/impostor/', SND = 'preload/sounds/impostor/', MUS = 'preload/music/impostor/', VID = 'videos/videos/impostor/';
  const DATA = 'preload/data/impostor/';
  const flashOn = () => G.settings.flashing !== false;
  const isStory = P => P.params && P.params.mode === 'story';
  const songData = id => G.A.json(DATA + 'songs/' + id + '.json');
  const isImp = P => !!(P.stage && P.stage.data && P.stage.data.impostor);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const E = {
    linear: t => t, quadInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, sineOut: t => Math.sin(t * Math.PI / 2),
    sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2, circIn: t => 1 - Math.sqrt(1 - t * t), cubeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  };
  // little tween list (FlxTween.tween on a plain object)
  function tween(list, obj, to, dur, ease, done) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].obj === obj) for (const k in to) if (k in list[i].to) delete list[i].to[k];
    const from = {}; for (const k in to) from[k] = obj[k];
    list.push({ obj, from, to, dur: Math.max(0.0001, dur), t: 0, ease: ease || E.linear, done });
  }
  function tick(list, dt) {
    for (let i = 0; i < list.length; i++) {
      const w = list[i]; w.t += dt; const k = Math.min(1, w.t / w.dur), e = w.ease(k);
      for (const p in w.to) w.obj[p] = w.from[p] + (w.to[p] - w.from[p]) * e;
      if (k >= 1) { list.splice(i--, 1); if (w.done) w.done(); }
    }
  }
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const v = m ? parseInt(m[1], 16) : 0xA1A1A1; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const toHex = a => '#' + a.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const sprite = (path, x, y) => new G.Sprite(x || 0, y || 0).loadImage(path);

  // ================================================================ the chord ghosts (V4 PlayState.doGhostAnim)
  // A copy of the singer that plays the other note's pose, drawn behind the characters (after GF), HARDLIGHT,
  // tinted with the singer's health colour + 50, alpha 0.8 fading to 0 in 0.75 s. Each double note also bops the
  // camera (+0.015 game, +0.03 HUD).
  class Ghost {
    constructor(owner, z) { this.owner = owner; this.zIndex = z; this.spr = new G.Sprite(0, 0); this.spr.alpha = 0; this.tw = []; }
    fire(anim) {
      const c = this.owner, s = this.spr;
      if (!c || !c.anims[anim]) { const base = anim.replace(/-(alt|hold).*$/, ''); if (!c || !c.anims[base]) return; anim = base; }
      s.anims = c.anims; s.animOffsets = c.animOffsets; s.globalOffsets = c.globalOffsets; s.useAnimOffsets = true;
      s.x = c.x; s.y = c.y; s.scale = c.scale; s.origin = c.origin; s.offset = c.offset; s.flipX = c.flipX; s.flipY = c.flipY;
      s.scroll = c.scroll; s.antialias = c.antialias; s.atlas = c.atlas; s.sheet = c.sheet;
      s.play(anim, true); s.frameW = c.frameW; s.frameH = c.frameH;
      s.blend = 'hard-light';
      s.tint = 'mul:' + toHex(hex(c.data && c.data.hpColor).map(v => v + 50));
      s.alpha = 0.8; this.tw.length = 0; tween(this.tw, s, { alpha: 0 }, 0.75, E.linear);
    }
    update(dt) { tick(this.tw, dt); if (this.spr.alpha > 0) this.spr.update(dt); }
    draw(ctx, cam) {
      const s = this.spr; if (s.alpha <= 0.002 || !this.owner || !this.owner.visible) return;
      const f = s.cur && s.cur.flip; if (f) s.flipX = !s.flipX;
      s.draw(ctx, cam);
      if (f) s.flipX = !s.flipX;
    }
  }
  const SING = ['singLEFT', 'singDOWN', 'singUP', 'singRIGHT'];
  function chordHit(P, n, who) {
    const I = P.imp, c = who === 'dad' ? P.dad : P.bf;
    if (!I || !c || n.kind === 'No Animation' || n.kind === 'hey' || n.kind === 'gfsing') return;
    if (c._locked) return;
    const row = I.rows.get(n.line + ':' + Math.round(n.t));
    if (!row || row.length < 2) return;
    const key = n.line + ':' + Math.round(n.t), suffix = n.kind === 'alt' ? '-alt' : '';
    if (I.lastRow[who] === key) { c.sing(I.firstLane[who], false, suffix); return; }   // (the first note's pose stays)
    I.lastRow[who] = key; I.firstLane[who] = row[0].lane;
    c.sing(row[0].lane, false, suffix);
    const g = I.ghosts[who];
    if (g && c.data.impostor && c.data.impostor.afterimages !== false) {
      g.fire(SING[c.swapLR && (n.lane === 0 || n.lane === 3) ? 3 - n.lane : n.lane] + suffix);
      if (G.settings.camZoom !== false && !(I.noGhostZoom)) { P.bopMul += 0.015 / Math.max(0.1, P.camZoom); P.hudZoom += I.ghostHudZoom != null ? I.ghostHudZoom : 0.03; }
    }
  }

  // ================================================================ Psych holds: characters without V-Slice holds
  // replay their pose on every piece of a hold (each step), the old Psych way (vslice_sustains = false)
  function psychHolds(P, dt) {
    const I = P.imp, st = P.cond.stepCrochet;
    for (const who of ['dad', 'bf']) {
      const c = P[who]; if (!c || !c.data.impostor || c.data.impostor.vsliceSustains || !c.isSinging()) continue;
      const line = who === 'dad' ? 0 : 1;
      const hold = P.notes.find(n => n.line === line && n.hit && n.len > 0 && !n.done && P.songPos < n.holdEnd && (line === 0 || n.holding));
      if (!hold) { I.holdT[who] = 0; continue; }
      I.holdT[who] = (I.holdT[who] || 0) + dt * 1000;
      if (I.holdT[who] >= st) { I.holdT[who] -= st; c.play(c.animName.replace(/-hold$/, ''), true); c.holdTimer = 0; }
    }
  }

  // ================================================================ the HUD (scripts/utils.hx modifyGUI + Psych's PlayState)
  const RANKS = [[1, 'S+'], [0.95, 'S'], [0.9, 'A'], [0.8, 'B'], [0.7, 'C'], [0.6, 'D'], [0, 'F']];
  const ACC_W = { killer: 1, sick: 1, good: 0.67, bad: 0.34, shit: 0 };
  function scoreText(P) {
    const I = P.imp, n = I.accN;
    const acc = n ? I.accSum / n : 0;
    const accT = n ? (Math.floor(acc * 10000) / 100).toFixed(2) + '%' : 'N/A';
    const rank = n ? RANKS.find(r => acc >= r[0] - 1e-9)[1] : 'N/A';
    return 'Score: ' + Math.round(P.score).toLocaleString('en-US') + ' | Misses: ' + P.misses + ' | Accuracy: ' + accT + ' | Rank: ' + rank;
  }
  function drawHealth(ctx, P) {
    const hp = P.hudParts.health; if (P.hideHealth || hp.alpha * hp.apple <= 0.004) return true;
    const hud = P.hud; hud.apply(ctx);
    ctx.save(); ctx.globalAlpha *= hp.alpha * hp.apple;
    const img = G.A.image(IMG + 'hud/healthBar.png');
    const w = img ? img.width : 601, h = img ? img.height : 19;
    const x = (G.W - w) / 2, y = (P.phoneArrows ? 0.11 : P.down ? 0.11 : 0.89) * G.H + hp.dy;
    const p = G.clamp(P.health / 2, 0, 1);
    // (Psych's Bar: the picture is the frame, the fill sits 3 px inside it)
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = (P.dad && P.dad.data.hpColor) || '#FF0000'; ctx.fillRect(x + 3, y + 3, (w - 6) * (1 - p), h - 6);
    ctx.fillStyle = (P.bf && P.bf.data.hpColor) || '#66FF33'; ctx.fillRect(x + 3 + (w - 6) * (1 - p), y + 3, (w - 6) * p, h - 6);
    if (img) ctx.drawImage(img, x, y);
    // icons: Psych's spots (healthBar.x + width * (1 - percent), - 26 / - 150 + 26; y = bar - 75)
    const split = x + w * (1 - p);
    P.drawIcon(ctx, P.iconP1, split - 26, y - 75 + 75, P.health < 0.4);
    P.drawIcon(ctx, P.iconP2, split - (150 - 26), y - 75 + 75, P.health > 1.6);
    const col = (P.dad && P.dad.data.hpColor && P.dad.data.hpColor !== '#000000') ? P.dad.data.hpColor : '#FFFFFF';
    // (Psych: scoreTxt at healthBar.y + 40, size 20; the letters' tops land 2 px lower)
    G.vcr(ctx, scoreText(P), G.W / 2, y + 37.2, { align: 'center', size: 20.4, outline: 1.25, color: col });
    ctx.restore();
    return true;
  }
  function drawTime(ctx, P) {
    const tp = P.hudParts.time; if (G.settings.timeBar === 'off' || tp.alpha <= 0.004) return true;
    P.hud.apply(ctx);
    ctx.save(); ctx.globalAlpha *= tp.alpha * (P.imp.timeA != null ? P.imp.timeA : 1);
    // timeTxt at STRUM_X + 640 - 585 = 97 (+10), the bar right under its top (utils.hx modifyGUI)
    const bx = 97, by = (P.phoneArrows ? 172 : P.down ? G.H - 45 : 23.75) + tp.dy, img = G.A.image(IMG + 'hud/timeBar.png');
    const w = img ? img.width : 400, h = img ? img.height : 19;
    const prog = P.audio && P.audio.length ? G.clamp(P.songPos / P.audio.length, 0, 1) : 0;
    ctx.fillStyle = '#2e412e'; ctx.fillRect(bx + 3, by + 3, w - 6, h - 6);
    ctx.fillStyle = '#44d844'; ctx.fillRect(bx + 3, by + 3, (w - 6) * prog, h - 6);
    if (img) ctx.drawImage(img, bx, by);
    const left = Math.max(0, ((P.audio && P.audio.length) - P.songPos) / 1000);
    const txt = G.settings.timeBar === 'left' ? G.fmtTime(left) : G.settings.timeBar === 'elapsed' ? G.fmtTime(Math.max(0, P.songPos / 1000)) : String(P.song.name || '').toUpperCase();
    G.vcr(ctx, txt, bx + 10, by + 3.25, { align: 'left', size: 14.5, outline: 1.25 });     // (timeTxt.y 19 + 8)
    ctx.restore();
    return true;
  }
  // the ratings + combo at the top middle (utils.hx onPopUpScorePost: rating x .42 at y 55, numbers x .33 at 122.5)
  function popups(P, r, combo) {
    const I = P.imp, img = G.A.image(IMG + 'hud/' + r + '.png'); if (!img) return true;
    I.accSum += ACC_W[r] != null ? ACC_W[r] : 1; I.accN++;
    const now = P.songPos, beat = P.cond.crochet / 1000;
    I.pops = I.pops.filter(p => !p.rating);
    const s = sprite(img); s.scale.x = s.scale.y = 0.42 * (0.47 / 0.42); s.k = 0.42; s.updateHitbox();
    s.rating = true; s.born = now; s.life = beat + 0.2; s.fadeAt = beat;
    I.pops.push(s);
    const digits = String(Math.max(0, combo)).padStart(3, '0').split('').map(Number);
    I.pops = I.pops.filter(p => p.rating);
    let total = 0; const ims = digits.map(d => G.A.image(IMG + 'hud/num' + d + '.png'));
    for (const im of ims) if (im) total += (im.width - 30) * 0.33;
    let xo = (G.W - total) / 2;
    for (const im of ims) {
      if (!im) continue;
      const d = sprite(im); d.scale.x = d.scale.y = 0.35; d.k = 0.33; d.updateHitbox();
      d.cx = xo; xo += (im.width - 30) * 0.33;       // (centred on the running offset: utils.hx's "Evil factor")
      d.born = now; d.life = beat * 2 + 0.2; d.fadeAt = beat * 2;
      I.pops.push(d);
    }
    return true;
  }
  function updatePops(P, dt) {
    const I = P.imp, now = P.songPos;
    I.pops = I.pops.filter(s => (now - s.born) / 1000 < s.life);
    for (const s of I.pops) {
      const age = (now - s.born) / 1000;
      const sc = s.k + (s.scale.x - s.k) * Math.pow(0.0001, dt);
      s.scale.x = s.scale.y = sc; s.updateHitbox();
      if (s.rating) { s.x = (G.W - s.frameW * sc) / 2; s.y = P.down ? G.H - s.frameH * sc - 50 : 55; }
      else { s.x = s.cx - s.frameW * sc / 2; s.y = P.down ? G.H - s.frameH * sc - 117.5 : 122.5; }
      s.alpha = age > s.fadeAt ? Math.max(0, 1 - (age - s.fadeAt) / 0.2) : 1;
    }
  }

  // ================================================================ camera spots + zoom (utils.hx camSpecialThing)
  function setCams(P, dad, bf, zoom) {
    if (dad) P.dad.camFocus = { x: dad[0], y: dad[1] };
    if (bf) P.bf.camFocus = { x: bf[0], y: bf[1] };
    if (zoom > 0) { P.imp.baseZoom = zoom; applyZoom(P); }
    if (P.camTarget && G.ModEvents && !P.camForced) { const c = P.camTarget === 'bf' ? P.bf : P.dad; if (c && c.camFocus) P.cam.follow(c.camFocus.x, c.camFocus.y); }
  }
  function applyZoom(P) { const z = P.imp.baseZoom + (P.imp.zoomAdd || 0); P.camZoom = z; P.stageZoom = z; }

  // the red flash on every Reactor Beep (camOther: over everything; photosensitive = softer, under the HUD)
  function beep(P) {
    const I = P.imp; I.tw = I.tw.filter(w => w.obj !== I.beepFx);
    if (!flashOn()) { I.beepFx.a = 0; tween(I.tw, I.beepFx, { a: 0.15 }, 0.2, E.sineOut, () => tween(I.tw, I.beepFx, { a: 0 }, 0.4, E.quadInOut)); I.beepFx.under = true; }
    else { I.beepFx.a = 0.3; I.beepFx.under = false; tween(I.tw, I.beepFx, { a: 0 }, 1 / 3); }
  }

  // ================================================================ the base every Impostor song runs on
  const BASE = {
    setup(P) {
      const I = P.imp = { data: songData(P.song.id) || {}, tw: [], pops: [], rows: new Map(), lastRow: {}, firstLane: {}, holdT: {}, ghosts: {},
        accSum: 0, accN: 0, beepFx: { a: 0 }, caption: null, baseZoom: P.stage.zoom, zoomAdd: 0 };
      // Psych's zoom bop adds +0.015 to the zoom; FNF 2 multiplies: the same size at this stage's zoom
      P.bopIntensity = 1 + 0.015 / Math.max(0.1, P.stage.zoom); P.hudBopIntensity = 0.03;
      // (the shared pack: game over + pause music, the talk sounds: ready before they're needed)
      const core = G.Packs && G.Packs.all && G.Packs.all.impostor; if (core && !core.bodyLoaded) G.Packs.needBody(core);
      if (P.gf) { const sc = (P.stage.data.characters.gf || {}).scroll; if (sc) P.gf.scroll = { x: sc[0], y: sc[1] }; }
      I.ghosts.bf = new Ghost(P.bf, 505); I.ghosts.dad = new Ghost(P.dad, 506);
      P.stage.addExtra(I.ghosts.bf, P.bf); P.stage.addExtra(I.ghosts.dad, P.dad);
    },
    reset(P) {
      const I = P.imp; if (!I) return;
      I.tw.length = 0; I.pops.length = 0; I.lastRow = {}; I.holdT = {}; I.accSum = 0; I.accN = 0; I.beepFx.a = 0; I.caption = null;
      // the double notes: notes of one side at the same time (V4's noteRows), in chart order
      I.rows = new Map();
      for (const n of P.notes || []) {
        const k = n.line + ':' + Math.round(n.t);
        const r = I.rows.get(k); if (r) r.push(n); else I.rows.set(k, [n]);
      }
      I.camZooming = false; P.zoomRate = 0;          // (Psych: the bops start once the opponent sings)
      I.zoomAdd = 0; I.baseZoom = P.stage.zoom; applyZoom(P);
      for (const g of Object.values(I.ghosts)) { g.spr.alpha = 0; g.tw.length = 0; g.owner = g === I.ghosts.bf ? P.bf : P.dad; }
      // the arrows where the mod has them (measured on its own screenshots: 54 px / 46 px right of FNF's spots)
      if (!P.middle && !P.phoneArrows) P.lines.forEach((L, li) => { for (const st of L.strums) { if (st._bx0 == null) st._bx0 = st.bx; st.bx = st._bx0 + (li === 0 ? 54.1 : 46.4); st.x = st.bx + (st.mx || 0); } });
      const sc = P.stage.data.characters || {};
      if (sc.dad && sc.dad.camera) P.dad.camFocus = { x: sc.dad.camera[0], y: sc.dad.camera[1] };
      if (sc.bf && sc.bf.camera) P.bf.camFocus = { x: sc.bf.camera[0], y: sc.bf.camera[1] };
    },
    update(P, dt) {
      const I = P.imp; tick(I.tw, dt);
      for (const g of Object.values(I.ghosts)) g.update(dt);
      psychHolds(P, dt);
      updatePops(P, dt);
    },
    oppHit(P, n) {
      const I = P.imp;
      if (!I.camZooming) { I.camZooming = true; P.zoomRate = 4; }
      chordHit(P, n, 'dad');
    },
    playerHit(P, n) { chordHit(P, n, 'bf'); },
    event(P, name, v) {
      const I = P.imp, v1 = String(v.value1 == null ? '' : v.value1), v2 = String(v.value2 == null ? '' : v.value2);
      switch (name) {
        case 'Reactor Beep': beep(P); break;
        case 'Set Cams': {
          const c = v1.split(',').map(Number), z = parseFloat(v2);
          setCams(P, [c[0], c[1]], [c[2], c[3]], isNaN(z) ? -1 : z); break;
        }
        case 'Reset Cams': { const sc = P.stage.data.characters || {}; setCams(P, sc.dad && sc.dad.camera, sc.bf && sc.bf.camera, -1); break; }
        case 'Insta Cam Zoom': {
          const z = parseFloat(v1); if (isNaN(z)) break;
          if (parseInt(v2, 10) === 1) { I.baseZoom = z - (I.zoomAdd || 0); P.cam.zoom = z; } else { I.baseZoom += z; P.cam.zoom += z; }
          P.zoomTween = null; applyZoom(P); break;
        }
        case 'Extra Cam Zoom': { const z = parseFloat(v1); I.zoomAdd = isNaN(z) ? 0 : z; P.zoomTween = null; applyZoom(P); break; }
        case 'flash': { const t = parseInt(v1, 10); if (flashOn()) P.cam.flash('#FFFFFF', (t === 2 || t === 3) ? 0.55 : 0.35); else P.cam.flash('rgba(255,255,255,0.5)', 0.7); break; }
        case 'Optional Captions': {
          if (!v1.trim() || v1 === '0') I.caption = null;
          else I.caption = { text: v1, y: v2.trim() ? parseInt(v2, 10) : null };
          break;
        }
        case 'Alter Camera Bop': { const a = parseInt(v1, 10), b = parseFloat(v2); P.zoomRate = isNaN(a) ? 4 : a; if (!isNaN(b)) { P.bopIntensity = 1 + 0.015 * b / Math.max(0.1, P.stage.zoom); P.hudBopIntensity = 0.03 * b; } break; }
      }
    },
    drawHealth, drawTime, popups,
    drawTop(ctx, P) {
      const I = P.imp;
      G.setScreenT(ctx);
      for (const s of I.pops) s.draw(ctx, P.hud);
      G.setScreenT(ctx);
      if (I.beepFx.a > 0.002) { ctx.save(); ctx.globalAlpha = I.beepFx.a; ctx.fillStyle = '#b30000'; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); ctx.restore(); }
      if (I.caption) caption(ctx, I.caption.text, I.caption.y);
    },
    gameOver: { sfx: SND + 'fnf_loss_sfx.ogg', music: MUS + 'gameOver.ogg', end: MUS + 'gameOverEnd.ogg' },
    pauseMusic: MUS + 'breakfast.ogg',
  };
  // a caption line (FunkinCaption: bottom middle, white on a dark band)
  function caption(ctx, text, y) {
    G.setScreenT(ctx);
    const lines = String(text).split('\n'), size = 26, lh = 32, cy = y != null ? y : G.H - 110;
    ctx.save(); ctx.font = size + 'px liberbold, ' + G.FONT.body;
    let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect((G.W - w) / 2 - 12, cy - lh * 0.8, w + 24, lh * lines.length + 8); ctx.globalAlpha = 1;
    lines.forEach((l, i) => G.text(ctx, l, G.W / 2, cy + i * lh, { size, font: 'liberbold', align: 'center', outline: 2 }));
    ctx.restore();
  }

  // combine the base with a stage's + a song's own parts (each hook runs them all, in order)
  function combine(...parts) {
    parts = parts.filter(Boolean);
    const o = {};
    for (const k of ['setup', 'reset', 'update', 'beat', 'step', 'event', 'oppHit', 'playerHit', 'miss', 'drawOver', 'drawTop', 'leave']) {
      const fns = parts.map(p => p[k]).filter(Boolean);
      if (fns.length) o[k] = (...a) => { for (const f of fns) f(...a); };
    }
    for (const k of ['popups', 'drawHealth', 'drawTime', 'drawWorld', 'gameOver', 'pauseMusic', 'maxZoom', 'prepare']) { const p = parts.slice().reverse().find(q => q[k]); if (p) o[k] = p[k]; }
    return o;
  }

  // ================================================================ stages
  const STAGES = {};
  const prop = (P, name) => P.stage.props.find(p => p.name === name);

  // ---- Polus (data/stages/polus.hx): snow, the lonely speaker for ghost GF, dead BF, the Meltdown crowd
  STAGES.polus = {
    setup(P) {
      const S = P.polus = { snow: [], emitT: 0, frames: null };
      const sheet = G.Sparrow.load(G.A.imagePath('shared:impostor/stages/polus/snow_particles'));
      S.sheet = sheet;
      S.spk = prop(P, 'speaker'); S.dead = prop(P, 'bfdead'); S.crowd = prop(P, 'crowd');
      // snow in front of everybody (zIndex 13 in the script)
      S.layer = { zIndex: 1013, update() {}, draw: (ctx, cam) => drawSnow(ctx, cam, S) };
      P.stage.addExtra(S.layer, null);
    },
    reset(P) {
      const S = P.polus;
      const ghostGF = P.gf && P.gf.id === 'imp-gf-ghost';
      if (S.spk) S.spk.alpha = ghostGF && P.song.id !== 'top-10' ? 1 : 0;
      if (ghostGF && !P.gf._raised) { P.gf.y -= 240; P.gf._raised = true; }
      if (S.dead) S.dead.alpha = P.bf && P.bf.id === 'imp-bf-ghost' ? 1 : 0;
      if (S.crowd) S.crowd.alpha = P.song.id === 'meltdown' ? 1 : 0;
      S.snow.length = 0; S.emitT = 0;
      // (warm the snow up so it's already falling when the song starts)
      for (let i = 0; i < 100; i++) stepSnow(S, 0.05);
      S.preBops = 0;
    },
    update(P, dt) {
      const S = P.polus;
      stepSnow(S, dt);
      // (onStartCountdown: 5 bops before the song)
      if (!P.started || P.songPos < 0) {
        const b = Math.floor((P.songPos + P.cond.crochet * 5) / P.cond.crochet);
        if (b > S.preBops && b <= 5) { S.preBops = b; if (S.spk) S.spk.play('bop', true); if (S.crowd && (5 - b) % 2 === 0) S.crowd.play('bop', true); }
      }
    },
    beat(P, b) { const S = P.polus; if (S.spk) S.spk.play('bop', true); if (S.crowd && b % 2 === 0) S.crowd.play('bop', true); },
  };
  // SnowEmitter(-600, -600, 2700): a flake every 0.05 s along 2700 px, falls for 5 s, scroll 1-1.5
  function stepSnow(S, dt) {
    S.emitT += dt;
    while (S.emitT >= 0.05) {
      S.emitT -= 0.05;
      const fr = S.sheet && S.sheet.frames.length ? S.sheet.frames[Math.floor(Math.random() * S.sheet.frames.length)] : null;
      const sf = rnd(1, 1.5);
      S.snow.push({ x: -600 + Math.random() * 2700, y: -600, vx: rnd(-40, 40), vy: rnd(220, 380), a: Math.random() * 360, va: rnd(-120, 120), s: rnd(0.7, 1.2), sf, fr, age: 0 });
    }
    for (const f of S.snow) { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt; }
    if (S.snow.length && S.snow[0].age > 5) S.snow = S.snow.filter(f => f.age <= 5);
  }
  function drawSnow(ctx, cam, S) {
    if (!S.sheet) return;
    for (const f of S.snow) {
      if (!f.fr) continue;
      cam.apply(ctx, f.sf, f.sf);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a * Math.PI / 180); ctx.scale(f.s, f.s);
      ctx.translate(-f.fr.fw / 2, -f.fr.fh / 2);
      G.Sparrow.draw(ctx, S.sheet, f.fr); ctx.restore();
    }
  }

  // ================================================================ songs
  const SONGS = {};
  // ---- Sabotage (songs/sabotage/sabotage.hx): GF isn't there until Red notices ('sabotage notice'), then he goes
  //      'ayo' + she's scared until 'sabotage back'
  SONGS.sabotage = {
    reset(P) { if (P.gf) P.gf.alpha = 0.001; if (P.dad) P.dad._locked = false; if (P.gf) P.gf._locked = false; P.sab = { at: 0 }; },
    event(P, name, v) {
      if (name !== 'Legacy') return;
      const k = String(v.value1 || '');
      if (k === 'GF Appear' && P.gf) P.gf.alpha = 1;
      if (k === 'sabotage notice') {
        P.sab.at = P.songPos + 100;
        if (P.dad) { P.dad.playAnim('ayo', true); P.dad._locked = true; }
        if (P.gf) { P.gf.playAnim('scared', true); P.gf._locked = true; }
      }
      if (k === 'sabotage back') { if (P.dad) P.dad._locked = false; if (P.gf) P.gf._locked = false; }
    },
    update(P) { if (P.sab.at && P.songPos >= P.sab.at) { P.sab.at = 0; if (P.gf) P.gf.alpha = 1; } },
  };
  // ---- Meltdown (songs/meltdown/meltdown.hx): near the end the ending video plays over the game (not on Low Quality)
  SONGS.meltdown = {
    reset(P) { P.melt = null; },
    event(P, name) {
      if (name !== 'Meltdown Video' || !P.bf || P.bf.id !== 'imp-bf-ghost' || G.settings.quality === 'low') return;
      P.melt = playVideo(VID + 'week1/meltdownEnd.webm', { muted: false });
    },
    update(P) { const v = P.melt; if (v && v.done) P.melt = null; },
    drawTop(ctx, P) { const v = P.melt; if (v) drawVideo(ctx, v, null); },
    leave(P) { if (P.melt) P.melt.stop(); P.melt = null; },
  };

  // ================================================================ videos (FunkinVideoSprite: fit to the screen height)
  function playVideo(path, o) {
    o = o || {};
    const src = G.A.raw[path], V = { done: false, t: 0, path };
    if (!src) { V.done = true; V.stop = () => {}; return V; }
    const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
    v.volume = Math.min(1, (G.settings.vol.master || 1) * (G.settings.vol.sfx == null ? 1 : G.settings.vol.sfx));
    v.onended = () => { V.done = true; }; v.onerror = () => { V.done = true; };
    const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => { V.done = true; }); });
    V.el = v; V.stop = () => { try { v.pause(); } catch (e) {} V.done = true; };
    return V;
  }
  function drawVideo(ctx, V, bg) {
    G.setScreenT(ctx);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); }
    const v = V.el;
    if (v && v.readyState >= 2 && v.videoWidth) { const s = G.H / v.videoHeight, w = v.videoWidth * s; ctx.drawImage(v, (G.W - w) / 2, 0, w, G.H); }
  }
  // a video step for a cutscene (scripts/dialogue.hx videoCutscene: black, the video, 'Press BACK to skip' fading
  // in and out at the bottom left, the captions)
  function videoStep(rel, opt) {
    opt = opt || {};
    return {
      enter(S) {
        S.black = 0; S.noSkipText = true;
        S.V = playVideo(VID + rel + '.webm'); S.caps = G.A.json(DATA + 'captions/' + rel.replace(/\//g, '_') + '.json') || [];
        S.skipA = 0; S.skipTw = [];
        tween(S.skipTw, S, { skipA: 0.5 }, 2, E.sineInOut, () => { S.skipTw.push({ obj: S, from: { skipA: 0.5 }, to: { skipA: 0 }, dur: 3, t: -2, ease: E.sineInOut }); });
      },
      update(S, dt) {
        tick(S.skipTw, dt);
        if (S.t > 4 && S.V.el && S.V.el.readyState < 2) S.V.done = true;     // never stuck on a video that won't play
        if (S.V.done) S.go();
      },
      draw(S, ctx) {
        drawVideo(ctx, S.V, '#000');
        const t = S.V.el ? S.V.el.currentTime : 0, c = S.caps.find(x => t >= x[0] && t < x[1]);
        if (c) caption(ctx, c[2]);
        if (opt.canSkip !== false && S.skipA > 0.01) { G.setScreenT(ctx); G.text(ctx, 'Press BACK to skip', 15, G.H - 15 * 0.75 - 6, { size: 25, font: 'liberbold', align: 'left', outline: 2, alpha: S.skipA }); }
      },
      leave(S) { if (S.V) S.V.stop(); S.V = null; S.noSkipText = false; },
      back: opt.canSkip !== false,
    };
  }

  // ================================================================ the talk box (scripts/dialogue.hx)
  const rgbCache = new Map();
  // RGBSprite: the picture's red / green / blue mixed into three colours (r * c1 + g * c2 + b * c3)
  function rgbBox(img, c1, c2, c3) {
    const key = img.src + '|' + c1 + c2 + c3; let c = rgbCache.get(key);
    if (c && c._gen === G.gfxGen) return c;
    c = G.makeCanvas(img.width, img.height); const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data, A = hex(c1), B = hex(c2), C = hex(c3);
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
      a[i] = Math.min(255, r * A[0] + g * B[0] + b * C[0]); a[i + 1] = Math.min(255, r * A[1] + g * B[1] + b * C[1]); a[i + 2] = Math.min(255, r * A[2] + g * B[2] + b * C[2]);
    }
    x.putImageData(d, 0, 0); c._gen = G.gfxGen; rgbCache.set(key, c);
    return c;
  }
  const argb = s => { const m = /^0x[0-9a-f]{2}([0-9a-f]{6})$/i.exec(String(s || '')); return m ? '#' + m[1] : '#FF1515'; };
  let measure = null;
  function wrap(text, w, size, font) {
    if (!measure) measure = G.makeCanvas(4, 4).getContext('2d');
    measure.font = size + 'px ' + font;
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (measure.measureText(t).width > w && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  function Talk(P, sid, lines, opt) {
    opt = opt || {};
    const T = {
      done: false, k: -1, tw: [], fade: { a: 0 }, group: { y: 0 }, show: { a: 0.001 }, old: null, cur: null,
      ports: [null, null, null], typed: 0, typeT: 0, ended: false, wait: 0.5, leaving: false,
      start() {
        tween(this.tw, this.fade, { a: 0.35 }, 0.8, E.circIn);
        const mus = 'preload/music/impostor/dialogue/' + sid + '.ogg';
        if (G.A.has(mus)) G.audio.music.play(mus, { loop: true, vol: 0.8, fadeIn: 1 });
        return this;
      },
      talker(who) {
        const d = G.A.json(DATA + 'talkers/' + who + '.json') || {};
        let p = this.ports[d.side || 0];
        if (!p || p.who !== who) {
          const spr = new G.Sprite(0, 0).loadSparrow(G.A.imagePath('shared:impostor/ui/dialogue/characters/' + d.asset));
          spr.useAnimOffsets = true;
          for (const a of d.animations || []) {
            spr.addAnim(a.anim, a.name, a.fps || 24, false); spr.animOffsets[a.anim] = a.offsets || [0, 0];
            if (a.loop) { spr.addAnim(a.anim + '-loop', a.name, a.fps || 24, true); spr.animOffsets[a.anim + '-loop'] = a.offsets || [0, 0]; }
          }
          const side = d.side || 0;
          // (port0 196.85, 251 -> 247; port1 centred, 198 -> 148; port2 914.75, 216 -> 865)
          p = { who, d, spr, side, a: 0, x: side === 0 ? 196.85 : side === 2 ? 914.75 : 0, y: side === 1 ? 198 : side === 0 ? 251 : 216, shown: false };
          if (this.ports[side] && this.ports[side].who !== who && this.ports[side].shown) { p.a = 1; p.shown = true; p.x = side === 0 ? 247 : side === 2 ? 865 : p.x; p.y = side === 1 ? 148 : p.y; }
          this.ports[side] = p;
        }
        if (!p.shown) {
          p.shown = true;
          if (p.side === 2) tween(this.tw, p, { a: 1, x: 865 }, 0.5, E.quadInOut);
          else if (p.side === 0) tween(this.tw, p, { a: 1, x: 247 }, 0.5, E.quadInOut);
          else tween(this.tw, p, { a: 1, y: 148 }, 0.5, E.quadInOut);
        }
        return p;
      },
      next(withOld) {
        if (withOld && this.cur) { this.old = Object.assign({}, this.cur, { typed: this.cur.text.length }); G.sfx('preload/sounds/impostor/clickText.ogg', { vol: 0.8 }); }
        this.k++;
        const L = lines[this.k]; if (!L) { this.close(); return; }
        const [who, emote, text] = L;
        const p = this.talker(who);
        p.spr.play(emote, true);
        this.cur = { who, name: p.d.label || who, icon: p.d.icon, text, colors: [argb(p.d.boxColor), '#666666', argb(p.d.boxShadeColor)], sound: p.d.sound, port: p };
        this.cur.lines = wrap(text, G.W * 0.5, 26, 'liber');
        this.typed = 0; this.typeT = 0; this.ended = false;
      },
      close() {
        if (this.leaving) return; this.leaving = true;
        G.audio.music.stop(0);
        G.sfx('preload/sounds/impostor/panelDisappear.ogg', { vol: 0.5 });
        tween(this.tw, this.fade, { a: 0 }, 0.25, E.circIn);
        tween(this.tw, this.group, { y: 700 }, 0.25, E.circIn, () => { this.done = true; });
      },
      accept() {
        if (this.leaving || this.wait > 0 || !this.cur) return;
        if (this.ended) this.next(true); else { this.typed = this.cur.text.length; this.ended = true; this.onTyped(); }
      },
      back() { if (this.leaving) return; this.close(); },
      onTyped() { const p = this.cur && this.cur.port; if (p && p.spr.anims[p.spr.animName + '-loop']) { /* loops after it finishes */ } },
      update(dt) {
        tick(this.tw, dt);
        if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) { this.show.a = 1; this.next(false); } }
        for (const p of this.ports) if (p) {
          p.spr.update(dt);
          if (p.spr.finished && p.spr.anims[p.spr.animName + '-loop']) p.spr.play(p.spr.animName + '-loop', true);
        }
        const c = this.cur;
        if (c && !this.ended && !this.leaving) {
          this.typeT += dt;
          while (this.typeT >= 0.05 && this.typed < c.text.length) {
            this.typeT -= 0.05; this.typed++;
            if (c.text[this.typed - 1] !== ' ') G.sfx('preload/sounds/impostor/dialogue/' + c.sound + '.ogg', { vol: 0.6 });
          }
          if (this.typed >= c.text.length) { this.ended = true; this.onTyped(); }
        }
      },
      draw(ctx) {
        G.setScreenT(ctx);
        G.screenOff.x += G.CUT / 2; G.setScreenT(ctx);
        ctx.save();
        if (this.fade.a > 0.002) { ctx.globalAlpha = this.fade.a; ctx.fillStyle = '#fff'; ctx.fillRect(-200 - G.CUT, -200, G.W * 1.3 + G.CUT * 2, G.H * 1.3); ctx.globalAlpha = 1; }
        ctx.translate(0, this.group.y);
        for (const p of this.ports) if (p && p.a > 0.002) {
          const s = p.spr; s.alpha = p.a;
          s.x = p.side === 1 && !p.xset ? (G.W - s.frameW) / 2 : p.x; s.y = p.y; s.draw(ctx, null);
        }
        G.setScreenT(ctx); ctx.translate(0, this.group.y);
        const boxImg = G.A.image(IMG + 'ui/dialogue/dialogueBox.png'), bub = G.A.image(IMG + 'ui/dialogue/bubble.png');
        const a = this.show.a, c = this.cur;
        if (boxImg && c) { ctx.globalAlpha = a; ctx.drawImage(rgbBox(boxImg, ...c.colors), Math.round((G.W - boxImg.width) / 2), 431); }
        const bx = bub ? Math.round((G.W - bub.width) / 2 + 18.5) : 0;
        // the line before (bubble at y 616, icon 120.8 lower, name at 614, text at 650)
        const o = this.old;
        if (o && bub) { ctx.globalAlpha = 1; ctx.drawImage(bub, bx, 616); this.line(ctx, o, 614, 650, 120.8, o.text.length); }
        if (c && bub) { ctx.globalAlpha = a; ctx.drawImage(bub, bx, 496); this.line(ctx, c, 495, 525, 0, this.typed); }
        ctx.restore();
        G.screenOff.x -= G.CUT / 2; G.setScreenT(ctx);
      },
      line(ctx, L, nameY, textY, iconDy, n) {
        const icon = G.A.image('preload/images/icons/icon-imp-' + L.icon + '.png');
        if (icon) { const w = 105, h = icon.height * 0.7; ctx.drawImage(icon, 0, 0, 150, icon.height, 220, 496 + 109 / 2 - 75 + iconDy, w, h); }
        G.text(ctx, L.name, 350, nameY, { size: 30, font: 'liberbold', align: 'left', baseline: 'top', outline: 2 });
        // (squished to fit 67 px when there are many lines)
        const lh = 30, total = L.lines.length * lh, sq = Math.min(67 / Math.max(1, total), 1);
        ctx.save(); ctx.translate(350, textY); ctx.scale(1, sq);
        let left = n;
        L.lines.forEach((ln, r) => { if (left <= 0) return; const s = ln.slice(0, left); left -= ln.length + 1; G.text(ctx, s, 0, r * lh, { size: 26, font: 'liber', align: 'left', baseline: 'top', color: '#000' }); });
        ctx.restore();
      },
    };
    return T.start();
  }
  const talkStep = (sid, lines) => ({ enter(S) { S.black = 0; S.noSkipText = true; S.dlg = Talk(S.P, sid, lines); }, leave(S) { S.noSkipText = false; } });

  // ================================================================ cutscenes (story mode in the mod; FNF 2 also plays
  // them the first time in freeplay, like VS Sky)
  function cutsceneFor(sid) {
    return {
      create(P) {
        const d = songData(sid); if (!d) return null;
        const steps = [];
        const intro = (d.videos || []).find(v => v.endsWith('/' + sid));
        if (intro) steps.push(videoStep(intro));
        if (d.talk && d.talk.length) steps.push(talkStep(sid, d.talk));
        if (!steps.length) return null;
        const S = G.Scene(P, steps);
        // (talk + video draw themselves; the scene's own skip text is only for steps that have none)
        const draw0 = S.draw.bind(S);
        S.draw = ctx => { if (S.noSkipText) { const s = S.steps[S.k]; if (s && s.draw) s.draw(S, ctx); if (S.dlg) S.dlg.draw(ctx); G.setScreenT(ctx); if (S.black > 0) { ctx.fillStyle = 'rgba(0,0,0,' + S.black + ')'; ctx.fillRect(0, 0, G.W, G.H); } } else draw0(ctx); };
        const act0 = S.onAction.bind(S);
        S.onAction = (a, down, repeat) => {
          if (!down || repeat || S.done) return;
          if (S.dlg && S.dlg.back && a === 'back') { S.dlg.back(); return; }
          const st = S.steps[S.k];
          if (st && st.back !== undefined && a === 'back') { if (st.back) S.go(); return; }
          act0(a, down, repeat);
        };
        return S;
      },
      createEnd(P) {
        if (sid !== 'meltdown' || !isStory(P)) return null;      // (the end of the week video, story mode)
        return G.Scene(P, [videoStep('week1/post-week1')]);
      },
    };
  }

  // ================================================================ wire it up
  G.SongFX = G.SongFX || {}; G.Cutscenes = G.Cutscenes || {};
  G.Impostor = { STAGES, SONGS, combine, BASE };
  const SONG_IDS = ['sussus-moogus', 'sabotage', 'meltdown'];
  for (const sid of SONG_IDS) {
    G.SongFX[sid] = { setup(P) { if (!isImp(P)) return; const st = (P.stage.data.impostor || {}).stage; P.sfx = combine(BASE, STAGES[st], SONGS[sid]); if (P.sfx.setup) P.sfx.setup(P); } };
    G.Cutscenes[sid] = cutsceneFor(sid);
  }
})();
