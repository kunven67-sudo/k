// FNF 2 - VS Tabi ("Ex Boyfriend", the Tabi Revival team; V-Slice port by SangMzG), played like the mod:
//   My Battle    the comic: GF calls BF, a date at a fancy restaurant, then her ex Tabi shows up. Halfway through
//                the song the camera + the HUD swing on every beat and the arrows flick
//   Last Chance  Tabi warns BF; the song fades in from black while he snaps his fingers, then the video where he
//                loses it
//   Genocide     the restaurant on fire: red flash, the talk, the screen slowly fading in, Tabi's notes hurting
//                you, the split screen, and the HUD falling apart at the end (the official mod's credits after it
//                in story mode)
// Every Tabi song has his own HUD (tabi-ui.hxc): his health bar, ratings + 3-digit combo, wider arrows, and the
// camera leaning the way each note points. The Pico mix of My Battle is at night (Nene at a table).
// Art, songs, charts, comic + voices come from the mod (tools/own/tabi.py, private build only).
(function () {
  const IMG = 'preload/images/', SND = 'preload/sounds/', MUS = 'preload/music/';
  const E = Object.assign({}, G.ease, { quintIn: t => t ** 5, quintOut: t => 1 - (1 - t) ** 5, quartIn: t => t ** 4 });
  const lerp60 = (a, b, k, dt) => a + (b - a) * (1 - Math.pow(1 - k, dt * 60));   // FlxMath.lerp once a frame at 60 fps
  const flashOn = () => G.settings.flashing !== false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const step = P => P.cond.stepCrochet / 1000;

  // a tiny FlxTween: tween(list, obj, {key: to}, seconds, ease, {delay, done}); a new tween of a key replaces the old
  function tween(list, obj, to, d, ease, o) {
    for (const k in to) for (const w of list) if (w.obj === obj && w.key === k) w.dead = true;
    for (const k in to) list.push({ obj, key: k, a: null, b: to[k], t: 0, d: Math.max(1e-6, d), e: ease || E.linear, delay: (o && o.delay) || 0, done: o && o.done });
  }
  function runTweens(list, dt) {
    for (const w of list) {
      if (w.dead) continue;
      w.t += dt; if (w.t < w.delay) continue;
      if (w.a == null) w.a = w.obj[w.key];
      const k = Math.min(1, (w.t - w.delay) / w.d);
      w.obj[w.key] = w.a + (w.b - w.a) * w.e(k);
      if (k >= 1) { w.dead = true; if (w.done) w.done(); }
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  }
  // FlxCamera.flash / fade: a colour over everything that camera shows
  const fx = (c, d, from, to) => ({ c, t: 0, d, from, to });
  const fxAlpha = f => f ? f.from + (f.to - f.from) * Math.min(1, f.t / f.d) : 0;
  const fxTick = (f, dt) => { if (!f) return null; f.t += dt; return f.t >= f.d && f.to === 0 ? null : f; };
  function fxDraw(ctx, f) {
    const a = fxAlpha(f); if (a <= 0) return;
    G.setScreenT(ctx); ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = f.c; ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
  }

  // ---------------------------------------------------------------- the comic (tabi-cutscene.hxc)
  const FONT = { tabi: 'Russian Angel', gf: 'Restaurant', bf: 'Graffiti City' };
  const LIFT = { 'Russian Angel': 55, Restaurant: 45, 'Graffiti City': 40 };
  let mctx = null;
  const fontCss = (f, size) => size + 'px ' + (f ? "'" + f + "'" : 'sans-serif');   // (no font = the default one, like the mod's 'assets/fonts/null')
  function metrics(f, size) {
    if (!mctx) mctx = G.makeCanvas(4, 4).getContext('2d');
    mctx.font = fontCss(f, size);
    const m = mctx.measureText('Hg');
    const asc = m.fontBoundingBoxAscent || size * 0.8, desc = m.fontBoundingBoxDescent || size * 0.25;
    return { asc, lh: asc + desc };
  }
  const textW = (f, size, s) => { metrics(f, size); return mctx.measureText(s).width; };
  // FlxText word wrap in a 510 px wide field (2 px gutter on each side)
  function wrap(text, f, size, w) {
    metrics(f, size);
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (line && mctx.measureText(t).width > w) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }

  function Comic(name, P) {
    const lines = (G.A.json('preload/data/cutscenes/' + name + '.json') || { lines: [] }).lines;
    const C = {
      done: false, pos: 0, can: true, canExit: true,
      bgA: 1, panel: null, portrait: null, portraitBF: false, prevChar: 'bf',
      box: G.A.image(IMG + 'dialogue/box.png'), showBox: false, showName: true, isBF: false, name: '', font: null, text: '', typed: 0,
      hidden: false, flash: null, fade: null, wait: null, out: null, voice: null, voiceVol: 1, musVol: 1,
    };
    function setPortrait(ch, ex) {
      if (ex === 'none') { C.portrait = null; return; }
      C.portrait = G.A.image(IMG + 'dialogue/characters/' + ch.toLowerCase() + '/' + ex + '.png');
      C.portraitBF = ch.toLowerCase() === 'bf';
    }
    function setText(name, text, forceIsBF) {
      C.showName = name !== 'empty';
      C.showBox = text !== '';
      if (name != null) { const lc = name.toLowerCase(); C.name = lc === 'tabi' ? 'Tabi' : name.toUpperCase(); C.font = FONT[lc] || null; }
      C.text = text; C.typed = 0; C.wrapAt = -1;
      C.isBF = forceIsBF != null ? forceIsBF : name.toLowerCase() === 'bf';
    }
    function show(sound) {
      if (C.pos >= lines.length) return;
      if (sound) G.sfx(SND + 'dialogue/dialogue fucking clicking sound.ogg', { vol: 0.8 });
      const L = lines[C.pos];
      if (L.char === 'transition') {   // fade to black, next line, fade back in
        C.can = false;
        C.fade = Object.assign(fx('#000', 1, 0, 1), { cb() { C.fade = fx('#000', 1, 1, 0); C.pos++; show(true); C.can = true; } });
        return;
      }
      if (L.music != null) {
        if (L.music === 'none') G.audio.music.stop(0);
        else { C.musVol = L.volume != null ? L.volume : 1; G.audio.music.play(MUS + 'cutscenes/' + L.music + '.ogg', { loop: true, vol: C.musVol, restart: true }); }
      }
      if (C.voice) C.voice.stop();
      C.voice = null;
      if (L.audio != null) { C.voiceVol = L.lineVolume != null ? L.lineVolume : 1; C.voice = G.audio.voice(SND + 'dialogue/' + L.audio + '.ogg', { vol: C.voiceVol }); }
      if (L.bg != null) {
        if (L.bg === 'black') { C.bgA = 1; C.panel = null; }
        else if (L.bg === 'blur') { C.bgA = 0xA0 / 255; C.panel = null; }
        else C.panel = G.A.image(IMG + 'dialogue/panels/' + L.bg + '.png');
      }
      if (L.char != null) {
        if (L.char === 'empty') C.portrait = null;
        else { setPortrait(L.char, L.expression || 'none'); C.prevChar = L.char; }
      }
      if (L.text != null) setText(C.prevChar, L.text, L.boxPos != null ? L.boxPos === 'left' : null);
    }
    function end() {
      C.canExit = false; C.out = { t: 0 };
      G.audio.music.stop(C.musVol);                    // (the mod fades each sound out over its own volume in seconds)
      if (C.voice) C.voice.stop(C.voiceVol);
    }
    C.accept = function () {
      if (!C.can || C.out || C.done) return;
      C.pos++;
      if (C.pos >= lines.length) { if (C.canExit) end(); }
      else show(true);
    };
    C.stop = function () { if (C.voice) C.voice.stop(0.2); C.voice = null; };
    C.update = function (dt) {
      C.flash = fxTick(C.flash, dt);
      if (C.fade) {
        const f = C.fade; f.t += dt;
        if (f.t >= f.d) { if (f.cb) { const cb = f.cb; f.cb = null; cb(); } else if (f.to === 0) C.fade = null; }
      }
      if (C.wait) { C.wait.t -= dt; if (C.wait.t <= 0) { const w = C.wait; C.wait = null; w.fn(); } }
      C.typed += dt / 0.05;
      if (C.out) { C.out.t += dt; if (C.out.t >= 1) C.done = true; }
    };
    C.draw = function (ctx) {
      // while it fades away the HUD comes in under it
      const k = C.out ? Math.min(1, C.out.t) : 0;
      if (k > 0) { ctx.save(); ctx.globalAlpha = k; P.drawHUD(ctx); ctx.restore(); }
      G.setScreenT(ctx);
      ctx.save(); ctx.globalAlpha *= 1 - k;
      ctx.fillStyle = 'rgba(0,0,0,' + C.bgA.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H);
      if (!C.hidden) {
        if (C.panel) { const s = G.W / C.panel.width, h = C.panel.height * s; ctx.drawImage(C.panel, 0, (G.H - h) / 2, G.W, h); }
        if (C.portrait) { const w = C.portrait.width * 0.7, h = C.portrait.height * 0.7; ctx.drawImage(C.portrait, G.W * (C.portraitBF ? 0.8 : 0.2) - w / 2, 400 - h / 2, w, h); }
        if (C.showBox && C.box) drawBox(ctx);
      }
      fxDraw(ctx, C.flash); fxDraw(ctx, C.fade);
      ctx.restore();
    };
    function drawBox(ctx) {
      const bw = C.box.width * 1.1, bh = C.box.height * 1.1, bx = G.W * (C.isBF ? 0.35 : 0.65) - bw / 2, by = G.H / 2;
      ctx.save();
      if (C.isBF) { ctx.translate(bx + bw, by); ctx.scale(-1, 1); ctx.drawImage(C.box, 0, 0, bw, bh); } else ctx.drawImage(C.box, bx, by, bw, bh);
      ctx.restore();
      const rot = (cx, cy, deg, fn) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180); fn(); ctx.restore(); };
      // name (size 30, tilted 3.5 degrees)
      if (C.showName && C.name) {
        const m = metrics(C.font, 30), nw = textW(C.font, 30, C.name) + 4, nh = m.lh + 4;
        const nx = bx + bw * (C.isBF ? 0.2 : 0.8) - nw / 2, ny = G.H * 0.622 - nh / 2;
        rot(nx + nw / 2, ny + nh / 2, C.isBF ? 3.5 : -3.5, () => {
          ctx.font = fontCss(C.font, 30); ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(C.name, -nw / 2 + 2, -nh / 2 + 2 + m.asc);
        });
      }
      // the line, typed out (size 36, 510 wide, tilted 2.3 degrees)
      const n = Math.min(C.text.length, Math.floor(C.typed));
      if (C.wrapAt !== n) { C.wrapped = wrap(C.text.slice(0, n), C.font, 36, 506); C.wrapAt = n; }
      const m = metrics(C.font, 36), tw = 510, th = C.wrapped.length * m.lh + 4;
      const tx = bx + (bw / 2) * (C.isBF ? 0.3 : 0.43), ty = G.H * 0.77 - (LIFT[C.font] || 40);
      rot(tx + tw / 2, ty + th / 2, C.isBF ? 2.3 : -2.3, () => {
        ctx.font = fontCss(C.font, 36); ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
        C.wrapped.forEach((l, i) => ctx.fillText(l, -tw / 2 + 2, -th / 2 + 2 + m.asc + i * m.lh));
      });
    }
    // Genocide opens on a red flash + a crash, 5 s later the talk fades in
    if (name === 'Genocide') {
      C.can = false; C.hidden = true;
      C.flash = fx('#ff0000', 4, 1, 0);
      G.sfx(SND + 'crash.ogg', { vol: 1.5 });
      C.wait = { t: 5, fn() { C.fade = fx('#000', 2.3, 1, 0); C.hidden = false; show(false); C.can = true; } };
    } else show(false);
    return C;
  }
  const comic = name => ({ enter(S) { S.black = 0; S.dlg = Comic(name, S.P); }, leave(S) { if (S.dlg && S.dlg.stop) S.dlg.stop(); } });

  // a video on a plain colour (the Last Chance ending on red, the credits on black)
  const video = (path, bg) => ({
    enter(S) {
      S.black = 0; S.vbg = bg;
      const src = G.A.raw[path];
      if (!src) { S.vidDone = true; return; }
      const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
      v.volume = Math.min(1, (G.settings.vol.master || 1) * (G.settings.vol.sfx == null ? 1 : G.settings.vol.sfx));
      v.onended = () => { S.vidDone = true; }; v.onerror = () => { S.vidDone = true; };
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => { S.vidDone = true; }); });
      S.video = v; S.vidDone = false;
    },
    update(S) {
      const v = S.video;
      if (S.t > 3 && v && v.readyState < 2) S.vidDone = true;          // never stuck on a video that won't play
      if (S.vidDone) S.go();
    },
    draw(S, ctx) {
      G.setScreenT(ctx); ctx.fillStyle = S.vbg; ctx.fillRect(0, 0, G.W, G.H);
      const v = S.video;
      if (v && v.readyState >= 2) { const s = Math.min(G.W / v.videoWidth, G.H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s; ctx.drawImage(v, (G.W - w) / 2, (G.H - h) / 2, w, h); }
    },
    leave(S) { if (S.video) { try { S.video.pause(); } catch (e) {} S.video = null; } },
  });

  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes['my-battle'] = { create: P => P.song.variation === 'pico' ? null : G.Scene(P, [comic('My Battle')]) };
  G.Cutscenes['last-chance'] = {
    create: P => G.Scene(P, [comic('Last Chance')]),
    createEnd: P => G.Scene(P, [video('videos/videos/tabi-end-cutscene.webm', '#ff0000')]),
  };
  G.Cutscenes.genocide = {
    create: P => G.Scene(P, [comic('Genocide')]),
    // the official mod rolls its credits after Genocide (end of the week)
    createEnd: P => P.params.mode === 'story' ? G.Scene(P, [video('videos/videos/tabi-credits.webm', '#000')]) : null,
  };

  // ---------------------------------------------------------------- Tabi's HUD (tabi-ui.hxc + tabi-camera-movement.hxc)
  // the colour most of an icon is (blacks skipped, colours rounded to steps of 8): his half of the health bar
  function dominant(img) {
    if (!img || !img.width) return null;
    const c = G.makeCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(G.srcImg(img), 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data, map = new Map();
    let best = 0xffffff, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (r < 10 && g < 10 && b < 10) continue;
      const k = ((r >> 3) << 19) | ((g >> 3) << 11) | ((b >> 3) << 3);
      const v = (map.get(k) || 0) + 1; map.set(k, v);
      if (v > n) { n = v; best = k; }
    }
    return 'rgb(' + (best >> 16 & 255) + ',' + (best >> 8 & 255) + ',' + (best & 255) + ')';
  }
  const LEAN = [[-30, 0], [0, 30], [0, -30], [30, 0]];
  const HUD = {
    setup(P) {
      const T = P.tabi = {
        bg: G.A.image(IMG + 'ui/healthBarBG.png'), fill: G.A.image(IMG + 'ui/healthBarFill.png'),
        ratings: G.Sparrow.load(IMG + 'ui/ratings'), numbers: G.Sparrow.load(IMG + 'ui/numbers'),
        colors: null, cv: null, sh: null, tw: [],
      };
    },
    reset(P) {
      const T = P.tabi;
      // each side's arrows a bit closer together, in the middle of its half of the screen (the HUD is made after
      // the stage, so this happens here, once)
      if (!T.laid && !P.middle) for (const L of P.lines) {
        const sp = L.strums[1].bx - L.strums[0].bx, io = L.strums[0].bx - L.x;
        L.x = G.W * (L.player ? 0.75 : 0.25) - 4 * sp * 0.975 / 2;
        L.strums.forEach((s, i) => { s.x = s.bx = L.x + i * sp * 0.975 + io; });
      }
      T.laid = true;
      T.pop = null; T.numA = 0; T.digits = [0, 1, 2].map(() => ({ v: 0, oy: 0, t: 9 }));
      T.time = 0; T.cd = 0; T.ss = 1 + Math.floor(Math.random() * 9); T.sss = 1 + Math.floor(Math.random() * 4);
      T.fly = { bar: 0, hb: 0, sy: 0, sa: 0 }; T.tw = [];
      P.cam.offX = P.cam.offY = 0;
    },
    update(P, dt) {
      const T = P.tabi;
      // the shine sweeps across the bar a few times, then waits a few seconds
      if (T.time <= 0.5 * T.sss) T.time += dt;
      T.cd += dt;
      if (T.cd >= T.ss) { T.cd = 0; T.time = 0; T.ss = 1 + Math.floor(Math.random() * 9); T.sss = 1 + Math.floor(Math.random() * 4); }
      if (T.pop) T.pop.t += dt;
      T.numA = T.pop ? (T.pop.t < 1 ? 1 : Math.max(0, 1 - (T.pop.t - 1) / 0.5)) : 0;
      for (const d of T.digits) { d.t += dt; d.oy = 10 * (1 - E.expoOut(Math.min(1, d.t / 0.7))); }
      runTweens(T.tw, dt);
    },
    oppHit(P, n) { const l = LEAN[n.lane]; P.cam.offX = l[0]; P.cam.offY = l[1]; },
    playerHit(P, n) { const l = LEAN[n.lane]; P.cam.offX = l[0]; P.cam.offY = l[1]; },
    // the rating pops (1.1 -> 1) over the arrows and the combo shows as 3 digits, each one dropping in when it changes
    popups(P, r, combo) {
      const T = P.tabi;
      T.pop = { name: r, t: 0 };
      const v = [Math.floor(combo / 100) % 10, Math.floor(combo / 10) % 10, combo % 10];
      for (let i = 0; i < 3; i++) if (i === 2 || T.digits[i].v !== v[i]) { T.digits[i].v = v[i]; T.digits[i].t = 0; }
      return true;
    },
    drawHealth(ctx, P) {
      const T = P.tabi;
      P.hud.apply(ctx);
      if (!P.hideHealth && T.bg && T.fill) {
        const bgY = P.down ? G.H * 0.1 - 100 : G.H * 0.9 - 150, cy = bgY + T.bg.height / 2, cx = G.W / 2 + T.fly.bar;
        ctx.drawImage(T.bg, cx - T.bg.width * 0.4, cy - T.bg.height * 0.4, T.bg.width * 0.8, T.bg.height * 0.8);
        const fc = fillBar(P, T);
        if (fc) ctx.drawImage(fc, cx - fc.width / 2, cy - fc.height / 2);
        // icons: like V-Slice, on the hidden FNF bar (1.3x as wide, 130 px below the frame's top), pushed 20 px apart
        const hbW = ((P.hbBg && P.hbBg.width) || 601) * 1.3 - 8 * 1.3, hbX = (G.W - hbW) / 2 + T.fly.hb;
        const split = hbX + hbW * (1 - G.clamp(P.health, 0, 2) / 2), iy = bgY + 130;
        P.drawIcon(ctx, P.iconP1, split - 26 + 20, iy, P.health < 0.4);
        P.drawIcon(ctx, P.iconP2, split - (150 - 26) - 20, iy, P.health > 1.6);
        const sy = bgY + T.bg.height - 60 + T.fly.sy;
        ctx.save(); ctx.translate(G.W / 2, sy + 10); if (T.fly.sa) ctx.rotate(T.fly.sa * Math.PI / 180);
        G.vcr(ctx, P.scoreLine(), 0, -10, { align: 'center', size: 20, outline: 1.5 });
        ctx.restore();
      }
      drawPop(ctx, P, T);
      return true;
    },
  };
  // the fill coloured like the shader: Tabi's colour left of the split, yours right of it (soft 10% edge), plus the shine
  function fillBar(P, T) {
    const img = T.fill, w = Math.round(img.width * 0.8), h = Math.round(img.height * 0.8);
    if (!T.colors) {
      const a = dominant(P.iconP2 && P.iconP2.img), b = dominant(P.iconP1 && P.iconP1.img);
      if (!a || !b) return null;
      T.colors = [a, b];
    }
    if (!T.cv) { T.cv = G.makeCanvas(w, h); T.sh = G.makeCanvas(w, h); }
    const x = T.cv.getContext('2d'), k = 1 - G.clamp(P.health, 0, 2) / 2;
    x.globalCompositeOperation = 'copy'; x.drawImage(img, 0, 0, w, h);
    x.globalCompositeOperation = 'multiply';
    const g = x.createLinearGradient(0, 0, w, 0);
    const mix = [0, 0.156, 0.5, 0.844, 1];   // smoothstep at 5 points
    [-0.05, -0.025, 0, 0.025, 0.05].forEach((o, i) => g.addColorStop(G.clamp(k + o, 0, 1), mixRGB(T.colors[0], T.colors[1], mix[i])));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // shine: a soft diagonal band, (uv.x + uv.y) / 2 around fract(time * 2), 0.6 strong
    const pos = (T.time * 2) % 1, shine = d => 0.6 * (sstep(pos - 0.25, pos, d) - sstep(pos, pos + 0.25, d));
    if (shine(pos) > 0.01) {
      const s = T.sh.getContext('2d');
      s.globalCompositeOperation = 'copy'; s.drawImage(img, 0, 0, w, h);
      const lam = 2 / (1 / (w * w) + 1 / (h * h)), sg = s.createLinearGradient(0, 0, lam / w, lam / h);
      for (let i = 0; i <= 24; i++) sg.addColorStop(i / 24, 'rgba(255,255,255,' + G.clamp(shine(i / 24), 0, 1).toFixed(3) + ')');
      s.globalCompositeOperation = 'destination-in'; s.fillStyle = sg; s.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'lighter'; x.drawImage(T.sh, 0, 0);
    }
    x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
    return T.cv;
  }
  const sstep = (a, b, x) => { const t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function mixRGB(a, b, t) {
    const p = s => s.match(/\d+/g).map(Number), A = p(a), B = p(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  }
  function drawPop(ctx, P, T) {
    if (!T.pop || !T.ratings || !T.numbers) return;
    const y0 = P.lines[1].y;
    const R = T.ratings, f0 = R.frames[0];
    // rating: centred on the screen at the arrows' height (its first frame's size), scale 1.1 -> 1, gone after 1.5 s
    const f = G.Sparrow.byPrefix(R, T.pop.name)[0];
    const ra = T.pop.t < 1 ? 1 : Math.max(0, 1 - (T.pop.t - 1) / 0.5);
    if (f && ra > 0) {
      const s = 1.1 - 0.1 * E.expoOut(Math.min(1, T.pop.t / 0.7));
      const x = (G.W - f0.fw) / 2;
      ctx.save(); ctx.globalAlpha *= ra;
      ctx.translate(x + f0.fw / 2, y0 + f0.fh / 2); ctx.scale(s, s); ctx.translate(-f0.fw / 2, -f0.fh / 2);
      G.Sparrow.draw(ctx, R, f); ctx.restore();
    }
    // combo: always 3 digits at half size, 10 px tighter than their width
    if (T.numA <= 0) return;
    const N = T.numbers, n0 = G.Sparrow.byPrefix(N, 'num0')[0]; if (!n0) return;
    const dw = n0.fw * 0.5, gw = 2 * (dw - 10) + dw, gx = (G.W - gw) / 2, gy = y0 + f0.fh - 35;
    ctx.save(); ctx.globalAlpha *= T.numA;
    T.digits.forEach((d, i) => {
      const fr = G.Sparrow.byPrefix(N, 'num' + d.v)[0]; if (!fr) return;
      ctx.save(); ctx.translate(gx + i * (dw - 10), gy + n0.fh * 0.25 - d.oy); ctx.scale(0.5, 0.5);
      G.Sparrow.draw(ctx, N, fr); ctx.restore();
    });
    ctx.restore();
  }

  // a stage FX made of parts: every part's hooks run in turn (the first part with a drawHealth/popups/drawWorld wins)
  function combine(...parts) {
    const o = {};
    for (const k of ['setup', 'reset', 'update', 'beat', 'step', 'event', 'oppHit', 'playerHit', 'drawOver', 'drawTop']) {
      const fns = parts.map(p => p[k]).filter(Boolean);
      if (fns.length) o[k] = (...a) => { for (const f of fns) f(...a); };
    }
    for (const k of ['popups', 'drawHealth', 'drawWorld', 'gameOver']) { const p = parts.find(q => q[k]); if (p) o[k] = p[k]; }
    return o;
  }
  // the song's own FX picked when it loads (a mix can be on another stage)
  const pick = fn => ({ setup(P) { P.sfx = fn(P); if (P.sfx.setup) P.sfx.setup(P); } });

  // camera zoom tweens from the song scripts: PlayState.tweenCameraZoom(FlxG.camera.zoom + d, 1 s, direct, quadOut)
  const zoomBy = (P, d) => { P.zoomTween = { t: 0, dur: 1, z0: P.camZoom, z1: P.cam.zoom + d, ease: E.quadOut }; };
  const zoomTo = (P, z, dur, ease) => { P.zoomTween = { t: 0, dur, z0: P.camZoom, z1: z, ease: ease || E.linear }; };
  // tweenScrollSpeed (your own speed setting still counts)
  const speed = (P, v) => { const st = G.settings; if (st.speedType === 'const') return; P.scrollSpeed = v * (st.speedType === 'mult' ? st.speedValue : 1); };

  // ---------------------------------------------------------------- My Battle (my-battle-script.hxc)
  const MYBATTLE = {
    reset(P) { P.mb = { bump: false, flicks: [] }; if (P.gf) P.gf.danceEvery = 2; P.cam.angle = 0; P.hud.angle = 0; },
    step(P, s) {
      const M = P.mb, gf2 = () => { if (P.gf) P.gf.danceEvery = 2; };
      switch (s) {
        case 65: case 96: zoomBy(P, 0.1); break;
        case 128: zoomBy(P, -0.2); break;
        case 640: zoomBy(P, 0.1); speed(P, 2.5); M.bump = true; break;
        case 760: M.bump = false; gf2(); P.cam.angle = P.hud.angle = 0; zoomBy(P, -0.1); break;
        case 768: M.bump = true; zoomBy(P, 0.1); break;
        case 896: zoomBy(P, -0.1); speed(P, 2.3); M.bump = false; gf2(); break;
        case 1152: zoomBy(P, -0.05); speed(P, 2.7); break;
        case 1184: zoomBy(P, 0.15); break;
        case 1440: zoomBy(P, -0.1); break;
      }
    },
    // the bumpy part: camera + HUD swing on every beat, GF bops every beat, the arrows flick down one after another
    beat(P, b) {
      const M = P.mb; if (!M.bump) return;
      if (P.gf) P.gf.danceEvery = 1;
      P.hudZoom += 0.025;
      P.cam.angle = b % 2 === 0 ? 1 : -1; P.hud.angle = b % 2 === 0 ? -2 : 2;
      M.flicks = [];
      P.lines.forEach((L, li) => L.strums.forEach((s, i) => M.flicks.push({ s, t: 0, delay: 0.03 * (li === 1 ? 3 - i : i) })));
    },
    update(P, dt) {
      P.cam.angle = lerp60(P.cam.angle || 0, 0, 0.15, dt); P.hud.angle = lerp60(P.hud.angle || 0, 0, 0.04, dt);
      for (const f of P.mb.flicks) { f.t += dt; f.s.my = 30 * (1 - E.backOut(G.clamp((f.t - f.delay) / 0.23, 0, 1))); }
    },
  };
  // the Pico mix: the restaurant at night, everyone tinted blue, a vignette over the screen, Nene bops every beat
  const NIGHT = {
    setup(P) { for (const k of ['bf', 'gf', 'dad']) P.charFilter[k] = 'mul:#6074c2'; P.tabiVig = G.A.image(IMG + 'vignette.png'); },
    reset(P) { if (P.gf) P.gf.danceEvery = 1; },
    drawOver(ctx, P) {
      if (P.cutscene || !P.tabiVig) return;
      P.hud.apply(ctx); ctx.save(); ctx.globalAlpha *= 0.7 * P.hud.alpha; ctx.drawImage(P.tabiVig, 0, 0, G.W, G.H); ctx.restore();
    },
  };
  G.SongFX = G.SongFX || {};
  G.SongFX['my-battle'] = pick(P => P.song.variation === 'pico' ? combine(HUD, NIGHT) : combine(HUD, MYBATTLE));

  // Nene in the Pico mix sits at a table (nene-tabi.hxc): no A-Bot; the table is made with her, before the stage
  // moves her, so it stands at (200, 0), behind her
  if (G.CharScripts && G.CharScripts.nene) {
    const N = G.CharScripts.nene;
    G.CharScripts['nene-tabi'] = Object.assign({}, N, {
      init(ch) { ch.noAbot = true; N.init(ch); },
      attach(ch, stage) {
        const t = new G.Sprite(200, 0).loadImage(IMG + 'stages/restaurant/table-dark.png');
        t.scale.x = t.scale.y = 1.25; t.zIndex = 1; t.name = 'nene-table';
        stage.props.push(t);
      },
    });
  }

  // ---------------------------------------------------------------- Last Chance (last-chance-script.hxc + the Noimix)
  const lock = (d, a) => { if (!d || !d.anims[a]) return; d.playAnim(a, true); d._locked = true; d._tabiLock = a; };
  const LASTCHANCE = noimix => ({
    reset(P) { if (P.gf) P.gf.danceEvery = 2; P.lc = { started: false, fade: null }; },
    update(P, dt) {
      const L = P.lc;
      // the song starts: the world fades in from black over 10 s, the camera starts far left and zooms in
      if (!L.started && P.started && P.songPos >= 0) {
        L.started = true; L.fade = fx('#000', 10, 1, 0);
        P.cam.x = -450 + G.W / 2; zoomTo(P, 1.05, 10);
      }
      if (L.fade) { L.fade.t += dt; if (L.fade.t >= L.fade.d && L.fade.to === 0) L.fade = null; }
      // his snapping: snap -> pre-snap, nothing else can play until it's done
      const d = P.dad;
      if (d && d._tabiLock && d.finished && d.animName === d._tabiLock) {
        if (d._tabiLock === 'snap') lock(d, 'pre-snap');
        else { d._locked = false; d._tabiLock = null; }
      }
    },
    beat(P, b) {
      if (b % 2 !== 1) return;
      if (b < 29) lock(P.dad, 'snap');
      if (b === 29) {
        lock(P.dad, 'wake-snap'); if (P.dad) P.dad.holdTimer = 0;
        if (noimix) zoomTo(P, P.stageZoom, 1, E.quadOut);
      }
    },
    event(P, kind, v) {
      if (kind === 'SetCameraBop' && P.gf && v && v.rate != null) P.gf.danceEvery = v.rate;
      if (noimix && kind === 'FocusCamera' && Math.floor(P.cond.beatF + 1e-6) !== 288) {
        const c = v != null && typeof v === 'object' ? v.char : v;
        zoomTo(P, (+c === 1 ? 1 : 1.05) * P.stageZoom, 1, E.quadOut);
      }
    },
    drawOver(ctx, P) { if (P.lc.fade) fxDraw(ctx, P.lc.fade); },
  });
  // the Noimix: a big zoom + black at beat 288, back out slowly at 304
  const NOIMIX = {
    beat(P, b) {
      if (b === 288) { zoomTo(P, 2 * P.stageZoom, 1.5, E.expoOut); P.lc.fade = fx('#000', 1, 0, 1); }
      if (b === 304) { zoomTo(P, P.stageZoom, 5, E.quadOut); P.lc.fade = fx('#000', 5, 1, 0); }
    },
  };
  G.SongFX['last-chance'] = pick(() => combine(HUD, LASTCHANCE(false)));
  G.SongFX['last-chance-noimix'] = pick(() => combine(HUD, LASTCHANCE(true), NOIMIX));

  // ---------------------------------------------------------------- Genocide (restaurant-fire.hxc + genocide-script.hxc)
  // a camera that looks through part of the screen (the split screen's halves): FlxCamera at (vx, 0), vw wide
  class SplitCam {
    constructor(vx, vw, zoom) { this.vx = vx; this.vw = vw; this.zoom = zoom; this.x = 0; this.y = 0; this.offX = 0; this.offY = 0; this.on = false; }
    apply(ctx, sfx, sfy) {
      const q = G.q, z = this.zoom, vw = this.vw, vh = G.H;
      const scx = this.x - vw / 2, scy = this.y - vh / 2;
      ctx.setTransform(q * z, 0, 0, q * z, q * (this.vx + vw / 2 - z * (scx * sfx + vw / 2)), q * (vh / 2 - z * (scy * sfy + vh / 2)));
    }
    follow(tx, ty, dt) {   // LOCKON, lerp 0.1
      if (this.x === 0 && this.y === 0) { this.x = tx; this.y = ty; }
      this.x = lerp60(this.x, tx + this.offX, 0.1, dt); this.y = lerp60(this.y, ty + this.offY, 0.1, dt);
    }
  }
  const SPLIT_OFF = [[-20, 0], [0, 20], [0, -20], [20, 0]];
  const FIRE = {
    setup(P) {
      const prop = n => P.stage.props.find(p => p.name === n);
      const F = P.fire = { glow: prop('glow'), back: prop('backmostflames'), flames: [prop('frontflameright'), prop('frontflameleft')].filter(Boolean), black: prop('black') };
      if (F.glow) F.glow.blend = 'lighter';
      // (the flames' alpha + the mod's glow shader are baked into their pictures by tools/own/tabi.py)
      if (F.back) { F.back.blend = 'lighter'; F.back.alpha = 1; }
      for (const f of F.flames) { f.blend = 'lighter'; f.alpha = 1; }
      if (F.black) F.black.tint = 'mul:#000000';
      F.vig = G.A.image(IMG + 'vignette.png');
    },
    reset(P) {
      const F = P.fire;
      Object.assign(F, { tw: [], vigA: 0.4, blackA: 0, flameA: 0.95, overlayA: 0, hudFade: null, hudFlash: null, cutFlash: null, hideGame: false, target: 1, math: false, bars: null });
      F.dadCam = new SplitCam(-G.W / 2, G.W / 2, 1);
      F.bfCam = new SplitCam(G.W, G.W / 2, 1.25);
      P.cam.angle = 0;
    },
    update(P, dt) {
      const F = P.fire;
      runTweens(F.tw, dt);
      F.vigA = lerp60(F.vigA, 0.4, Math.min(1, 0.5 * 120 / 60), dt);
      if (F.black) F.black.alpha = F.blackA;
      for (const f of F.flames) f.alpha = F.flameA / 0.95;
      F.hudFade = fxTick(F.hudFade, dt); F.hudFlash = fxTick(F.hudFlash, dt); F.cutFlash = fxTick(F.cutFlash, dt);
      P.cam.angle = lerp60(P.cam.angle || 0, F.target === 1 ? -0.15 : 0.15, 0.01, dt);
      if (P.dad) F.dadCam.follow(P.dad.x + 250, 0.5, dt);
      if (P.bf) F.bfCam.follow(P.bf.x + 200, P.bf.y + 100, dt);
    },
    // Tabi's notes shake everything and cost you health (less the lower you are), his vignette pulses
    oppHit(P, n) {
      const F = P.fire;
      P.cam.shake(0.0025, 0.1); P.hud.shake(0.0025, 0.1); P.hudZoom += 0.01;
      if (P.audio) P.audio.setVolume('p', 1);
      if (P.health >= 0.1) P.health -= 0.03 * (P.health + 0.2);
      F.vigA = 0.425;
      const o = SPLIT_OFF[n.lane]; F.dadCam.offX = o[0]; F.dadCam.offY = o[1]; F.dadCam.zoom += (1.1 - F.dadCam.zoom) * 0.05;
    },
    playerHit(P, n) { const F = P.fire, o = SPLIT_OFF[n.lane]; F.bfCam.offX = o[0]; F.bfCam.offY = o[1]; F.bfCam.zoom += (1.1 - F.bfCam.zoom) * 0.05; },
    beat(P, b) {
      const F = P.fire;
      switch (b) {
        case 1: F.hudFade = fx('#000', 19, 1, 0); break;                 // the whole screen fades in over 19 s
        case 64: if (flashOn()) F.cutFlash = fx('#ff0000', 2, 1, 0); break;
        case 192: case 384:
          if (flashOn()) P.cam.flash('#000000', 2);
          F.tw = F.tw.filter(w => w.key !== 'blackA' && w.key !== 'flameA'); F.blackA = 0.8; F.flameA = 0.1; break;
        case 224: case 416: tween(F.tw, F, { blackA: 0, flameA: 0.95 }, 9); break;
        case 256: if (flashOn()) F.hudFlash = fx('#ff0000', 2, 1, 0); break;
        case 616: fallApart(P); break;
      }
    },
    step(P, s) {
      const F = P.fire, st = step(P);
      // while Tabi holds a note: shaking + health going every step
      for (const n of P.notes) {
        if (n.line !== 0 || !n.hit || !n.holding || n.done) continue;
        P.cam.shake(0.0025, 0.1); P.hud.shake(0.0025, 0.1); P.hudZoom += 0.0075;
        if (P.audio) P.audio.setVolume('p', 1);
        if (P.health >= 0.1) P.health -= 0.03 * (P.health + 0.2) * 0.5;
      }
      const D = F.dadCam, B = F.bfCam;
      switch (s) {
        case 240: F.bars = { top: 0, bot: G.H / 2 }; break;               // black bars close...
        case 256: F.bars = { top: 0, bot: G.H / 2 }; tween(F.tw, F.bars, { top: -G.H / 2, bot: G.H }, 3, E.quintOut); break;   // ...and open
        case 1816: case 2392:                                             // the split screen slides in
          D.on = B.on = true;
          tween(F.tw, D, { vx: 0 }, st * 8, E.quintIn); tween(F.tw, B, { vx: G.W / 2 }, st * 8, E.quintIn); break;
        case 1823: case 2399: F.math = true; break;
        case 2080:                                                        // black for a moment, then a red flash
          F.math = false; F.hideGame = true;
          F.tw = F.tw.filter(w => w.obj !== D && w.obj !== B);
          D.vw = B.vw = G.W / 2; D.vx = -G.W / 2; B.vx = G.W; D.on = B.on = false; break;
        case 2084: F.hideGame = false; if (flashOn()) P.cam.flash('#ff0000', 3); break;
        case 2464:                                                        // the end: the world goes dark, the split slides away
          tween(F.tw, F, { overlayA: 1 }, 2.75);
          F.math = false;
          tween(F.tw, D, { vx: -D.vw }, st * 4, E.quintOut, { done() { D.on = false; } });
          tween(F.tw, B, { vx: G.W }, st * 4, E.quintOut, { done() { B.on = false; } });
          break;
      }
    },
    event(P, kind, v) {
      if (kind !== 'FocusCamera') return;
      const F = P.fire, c = +(v != null && typeof v === 'object' ? v.char : v);
      F.target = c;
      if (!F.math) return;
      // the side that sings gets the bigger half
      const isDad = c === 1, big = 700, d = step(P) * 8;
      tween(F.tw, F.dadCam, { vw: isDad ? big : G.W - big }, d, E.quartOut);
      tween(F.tw, F.bfCam, { vx: isDad ? big : G.W - big, vw: !isDad ? big : G.W - big }, d, E.quartOut);
    },
    drawWorld(ctx, P, draw) {
      const F = P.fire;
      if (F.hideGame) return;
      draw(P.cam); overlay(ctx, F);
      for (const c of [F.dadCam, F.bfCam]) {
        if (!c.on || c.vx >= G.W || c.vx + c.vw <= 0) continue;
        G.setScreenT(ctx); ctx.save(); ctx.beginPath(); ctx.rect(c.vx, 0, c.vw, G.H); ctx.clip();
        draw(c); overlay(ctx, F);
        ctx.restore();
      }
    },
    // the red light over the world (it's on the HUD layer, so not while the comic is on); the vignette is above the
    // HUD, so during the comic it shows under the talk
    drawOver(ctx, P) {
      const F = P.fire;
      if (P.cutscene) { vignette(ctx, F); return; }
      G.setScreenT(ctx); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.3 * P.hud.alpha; ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
    },
    drawTop(ctx, P) {
      const F = P.fire;
      if (F.bars) { P.hud.apply(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, F.bars.top, G.W, G.H / 2); ctx.fillRect(0, F.bars.bot, G.W, G.H / 2); }
      fxDraw(ctx, F.hudFade); fxDraw(ctx, F.hudFlash);
      vignette(ctx, F); fxDraw(ctx, F.cutFlash);
    },
    gameOver: { music: MUS + 'tabi game over loop.ogg', sfx: SND + 'fnf_loss_sfx-tabi.ogg' },
  };
  function overlay(ctx, F) { if (F.overlayA > 0) { G.setScreenT(ctx); ctx.save(); ctx.globalAlpha *= F.overlayA; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.restore(); } }
  function vignette(ctx, F) { if (!F.vig) return; G.setScreenT(ctx); ctx.save(); ctx.globalAlpha *= F.vigA; ctx.drawImage(F.vig, 0, 0, G.W, G.H); ctx.restore(); }
  // beat 616: the health bar slides off to the right, the score + every arrow fall off the screen, tilting
  function fallApart(P) {
    const T = P.tabi, away = P.down ? G.H + 200 : -200;
    tween(T.tw, T.fly, { bar: G.W + 100 }, 5, E.quartIn);
    const hbX = (G.W - (((P.hbBg && P.hbBg.width) || 601) - 8) * 1.3) / 2;
    tween(T.tw, T.fly, { hb: G.W + 100 - hbX }, 5, E.quartIn);
    const sy = (P.down ? G.H * 0.1 - 100 : G.H * 0.9 - 150) + ((T.bg && T.bg.height) || 243) - 60;
    tween(T.tw, T.fly, { sy: away - sy, sa: rnd(-6, 6) }, rnd(4, 6), E.quartIn);
    for (const L of P.lines) for (const s of L.strums) tween(T.tw, s, { my: away - s.by, ma: rnd(-6, 6) }, rnd(3, 4.5), E.quartIn);
  }
  G.SongFX.genocide = pick(() => combine(HUD, FIRE));

  // the story menu: Tabi's week has one difficulty (tabi.hxc)
})();
