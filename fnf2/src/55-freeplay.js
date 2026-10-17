// FNF 2 - Freeplay, rebuilt from the Funkin' engine's V-Slice FreeplayState (+ SongMenuItem,
// CapsuleText, LetterSort, DifficultyDot, AlbumRoll, BoyfriendCard) with the real assets.
// Positions, timings and tweens follow the engine source so it looks + moves like the real one.
(function () {
  const W = 1280, H = 720;
  const IMG = p => G.A.image('preload/images/' + p + '.png');
  const SP = p => G.Sparrow.load('preload/images/' + p);
  const E = G.ease;
  E.quartOut = E.quartOut || (t => 1 - Math.pow(1 - t, 4));
  E.quintOut = E.quintOut || (t => 1 - Math.pow(1 - t, 5));
  E.sineOut = E.sineOut || (t => Math.sin(t * Math.PI / 2));
  E.expoIn = E.expoIn || (t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
  // FlxEase versions (the rank slam uses these exact curves)
  E.sineIn = E.sineIn || (t => 1 - Math.cos(t * Math.PI / 2));
  E.quartIn = E.quartIn || (t => t * t * t * t);
  E.fxBackIn = t => t * t * (2.70158 * t - 1.70158);
  E.fxBackOut = t => { const u = t - 1; return 1 - u * u * (-2.70158 * u - 1.70158); };
  E.fxBackInOut = t => { t *= 2; if (t < 1) return t * t * (2.70158 * t - 1.70158) / 2; t -= 2; return (1 - t * t * (-2.70158 * t - 1.70158)) / 2 + 0.5; };
  E.fxElasticOut = t => t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * (2 * Math.PI) / 0.4) + 1;
  E.fxExpoIn = t => t <= 0 ? 0 : Math.pow(2, 10 * (t - 1));
  E.circInOut = E.circInOut || (t => t < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2);
  // MathUtil.smoothLerpPrecision: 99% of the way there after `dur` seconds, at any frame rate
  const sl = (a, b, dt, dur) => b + (a - b) * Math.pow(0.01, dt / dur);
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.max(0, Math.min(255, Math.round(v + (B[i] - v) * t))).toString(16).padStart(2, '0')).join(''); };
  const NUMS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  // ScoringRank.getRankingFreeplayColor
  const RANK_COLOR = { SHIT: '#6044FF', GOOD: '#EF8764', GREAT: '#EAF6FF', EXCELLENT: '#FDCB42', PERFECT: '#FF58B4', PERFECT_GOLD: '#FFB619' };

  // ---------------------------------------------------------------- tweens + timers (FlxTween / FlxTimer)
  class Tw {
    constructor() { this.items = []; }
    to(obj, props, dur, ease, o) { o = o || {}; const it = { obj, props, dur: Math.max(1e-4, dur), ease: ease || E.linear, t: -(o.delay || 0), from: null, o }; this.items.push(it); return it; }
    after(sec, fn) { return this.to(null, null, sec, null, { onComplete: fn }); }
    color(obj, key, from, to, dur, ease, o) { o = o || {}; obj[key] = from; return this.to(null, null, dur, ease, Object.assign({ tag: obj }, o, { onUpdate: e => { obj[key] = mix(from, to, e); } })); }
    cancel(obj) { for (const it of this.items) if (it.obj === obj || (it.o && it.o.tag === obj)) it.dead = true; }
    clear() { for (const it of this.items) it.dead = true; this.items = []; }
    update(dt) {
      for (const it of this.items.slice()) {
        if (it.dead) continue;
        it.t += dt;
        if (it.t < 0) continue;
        if (it.obj && !it.from) { it.from = {}; for (const k in it.props) it.from[k] = it.obj[k]; }
        const k = Math.min(1, it.t / it.dur), e = it.ease(k);
        if (it.obj) for (const p in it.props) it.obj[p] = it.from[p] + (it.props[p] - it.from[p]) * e;
        if (it.o.onUpdate) it.o.onUpdate(e);
        if (k >= 1) { it.dead = true; if (it.o.onComplete) it.o.onComplete(); }
      }
      this.items = this.items.filter(it => !it.dead);
    }
  }
  G.Tw = G.Tw || Tw;

  // ---------------------------------------------------------------- Flixel-style drawing helpers
  // (x,y) = sprite position, offX/offY = offset, orX/orY = origin, sx/sy scale around the origin
  function drawF(ctx, src, f, x, y, o) {
    if (!src) return;
    o = o || {};
    const sx = o.sx == null ? 1 : o.sx, sy = o.sy == null ? sx : o.sy;
    const orX = o.orX || 0, orY = o.orY || 0;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= Math.max(0, Math.min(1, o.alpha));
    if (o.blend) ctx.globalCompositeOperation = o.blend;
    if (o.smooth === false) ctx.imageSmoothingEnabled = false;
    ctx.translate(x - (o.offX || 0) + orX, y - (o.offY || 0) + orY);
    if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
    ctx.translate(-orX, -orY);
    if (o.flipX) { ctx.translate(o.fw || 0, 0); ctx.scale(-1, 1); }
    if (f) G.Sparrow.draw(ctx, src, f); else ctx.drawImage(src, 0, 0);
    ctx.restore();
  }
  // FlxColor multiply-tint into a reusable buffer (colors can tween every frame)
  const tintBufs = new Map();
  function tint(img, color, key) {
    if (!img) return null;
    if (!color || color.toUpperCase() === '#FFFFFF') return img;
    let b = tintBufs.get(key);
    if (!b) { b = { c: G.makeCanvas(img.width, img.height), color: null }; tintBufs.set(key, b); }
    if (b.color !== color) {
      const c = b.c.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, img.width, img.height);
      c.drawImage(img, 0, 0); c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, img.width, img.height);
      c.globalCompositeOperation = 'destination-in'; c.drawImage(img, 0, 0); b.color = color;
    }
    return b.c;
  }
  // a pure-white silhouette (PureColor shader)
  function white(src, f) {
    const key = 'fpwhite:' + (src.base || '') + ':' + (f ? f.name : 'img');
    const w = f ? f.fw : src.width, h = f ? f.fh : src.height;
    return G.cached(key, w, h, c => { if (f) G.Sparrow.draw(c, src, f); else c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); });
  }
  // FlxText: 2px gutter, text drawn from the top of its box. Returns a cached canvas.
  const measure = G.makeCanvas(1, 1).getContext('2d');
  function textImg(text, font, size, color, opt) {
    opt = opt || {};
    const key = 'fptxt:' + text + '|' + font + '|' + size + '|' + color + '|' + (opt.stroke || '');
    measure.font = size + 'px ' + font;
    const m = measure.measureText(text);
    const asc = m.fontBoundingBoxAscent || size * 0.8, desc = m.fontBoundingBoxDescent || size * 0.2;
    const pad = opt.stroke ? opt.stroke : 0;
    const w = Math.ceil(m.width) + 4 + pad * 2, h = Math.ceil(asc + desc) + 4 + pad * 2;
    const c = G.cached(key, w, h, cx => {
      cx.font = size + 'px ' + font; cx.textBaseline = 'alphabetic';
      if (opt.stroke) { cx.lineJoin = 'round'; cx.lineWidth = opt.stroke * 2; cx.strokeStyle = opt.strokeColor || color; cx.strokeText(text, 2 + pad, 2 + pad + asc); }
      cx.fillStyle = color; cx.fillText(text, 2 + pad, 2 + pad + asc);
    });
    c._tw = Math.ceil(m.width) + 4; c._pad = pad;
    return c;
  }

  // ---------------------------------------------------------------- the DJ (Animate atlas placed with its stage matrix)
  class DJ {
    constructor(player) {
      this.data = (G.A.json('preload/data/players/' + player + '.json') || {}).freeplayDJ || {};
      this.atlas = G.Atlas.load(G.A.imagePath(this.data.assetPath || 'freeplay/freeplay-boyfriend', 'preload'));
      this.prefix = {};
      for (const a of this.data.animations || []) this.prefix[a.name] = a.prefix;
      this.cur = null; this.fi = 0; this.t = 0; this.name = ''; this.afk = 0;
      this.onIntroDone = null;
      if (!this.play('intro')) this.play('idle', true);
    }
    has(name) { return !!(this.atlas && this.atlas.labels[this.prefix[name]]); }
    play(name, loop, from) {
      const lab = this.atlas && this.atlas.labels[this.prefix[name]];
      if (!lab) return false;
      if (name !== 'fistPump' && name !== 'loss') this.pumpIntro = null;
      this.cur = { start: lab.start, len: lab.len, loop: !!loop, loopFrom: 0 }; this.name = name; this.fi = Math.min(from || 0, lab.len - 1); this.t = 0; this.finished = false;
      if (name !== 'idle') this.afk = 0;
      return true;
    }
    update(dt) {
      if (!this.cur) return;
      this.t += dt;
      while (this.t >= 1 / 24) {
        this.t -= 1 / 24;
        if (this.fi < this.cur.len - 1) this.fi++;
        else if (this.cur.loop) this.fi = this.cur.loopFrom;
        else if (!this.finished) { this.finished = true; this.done(this.name); break; }
        if (this.pumpIntro && this.pumpIntro.e > -1 && this.fi >= this.pumpIntro.e) this.fi = this.pumpIntro.s;
      }
      if (this.name === 'idle' && this.cur) { this.afk += dt; if (this.afk > 60 && this.has('idleEasterEgg')) this.play('idleEasterEgg'); }
    }
    done(name) {
      if (name === 'intro') { this.play('idle', true); const f = this.onIntroDone; this.onIntroDone = null; if (f) f(); }
      else if (name === 'idleEasterEgg' || name === 'charSelect') this.play('idle', true);
      else if (name === 'fistPump' || name === 'loss') { this.play('idle', true); }
    }
    // results -> freeplay (FreeplayDJ FistPumpIntro / FistPump): the intro frames repeat while the
    // rank shows, then the pump plays out once and he goes back to idle
    fistPumpIntro(bad) {
      const fp = this.data.fistPump || {};
      const s = (bad ? fp.introBadStartFrame : fp.introStartFrame) || 0, e = bad ? fp.introBadEndFrame : fp.introEndFrame;
      if (!this.play(bad ? 'loss' : 'fistPump', false, s)) return;
      this.pumpIntro = { s, e: e == null ? -1 : e };
    }
    fistPump(bad) {
      const fp = this.data.fistPump || {};
      this.pumpIntro = null;
      this.play(bad ? 'loss' : 'fistPump', false, (bad ? fp.loopBadStartFrame : fp.loopStartFrame) || 0);
    }
    draw(ctx) {
      if (!this.cur || !this.atlas) return;
      G.setScreenT(ctx);
      const m = this.atlas.stage;
      ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      G.Atlas.draw(ctx, this.atlas, this.atlas.main, this.cur.start + this.fi);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- BGScrollingText (5by7 text rows on the card)
  class ScrollText {
    constructor(y, text, widthShit, bold, size) {
      this.x = 0; this.y = y; this.widthShit = widthShit; this.bold = bold; this.size = size; this.speed = 1; this.color = '#FFFFFF'; this.visible = false;
      this.setText(text);
    }
    setText(text) {
      this.text = text;
      const font = this.bold ? G.FONT.f5b : G.FONT.f5;
      measure.font = this.size + 'px ' + font;
      this.fw = Math.ceil(measure.measureText(text).width) + 4;
      const n = Math.ceil(this.widthShit / this.fw) + 1;
      this.pos = []; for (let i = 0; i < n; i++) this.pos.push(i * this.fw + i * 20);
      this.img = null;
    }
    update(dt) {
      const P = this.pos, step = this.speed * (dt / (1 / 60));
      for (let i = 0; i < P.length; i++) {
        P[i] -= step;
        if (this.speed > 0) { if (P[i] < -this.fw) { P[i] = P[P.length - 1] + this.fw + 20; P.sort((a, b) => a - b); } }
        else if (P[i] > this.fw * 2) { P[i] = P[0] - this.fw - 20; P.sort((a, b) => a - b); }
      }
    }
    draw(ctx) {
      if (!this.visible) return;
      if (!this.img) this.img = textImg(this.text, this.bold ? G.FONT.f5b : G.FONT.f5, this.size, this.color);
      for (const p of this.pos) if (this.x + p < W && this.x + p + this.img.width > 0) ctx.drawImage(this.img, Math.round(this.x + p), this.y);
    }
  }

  // ---------------------------------------------------------------- backing card (BoyfriendCard script + BackingCard base)
  class Card {
    constructor(fp, player) {
      this.fp = fp; this.tw = fp.tw;
      const data = (G.A.json('preload/data/players/' + player + '.json') || {}).freeplayDJ || {};
      const t1 = data.text1 || 'BOYFRIEND', t2 = data.text2 || 'HOT BLOODED IN MORE WAYS THAN ONE', t3 = data.text3 || 'PROTECT YO NUTS';
      this.pink = IMG('freeplay/pinkBack');
      const pw = this.pink ? this.pink.width : 524;
      this.pw = pw;
      this.pinkX = -pw; this.color = '#FFD4E9';
      this.orangeVis = false;
      this.orange = G.cached('fp-orange', pw, 75, c => { c.fillStyle = '#FEDA00'; c.fillRect(0, 0, pw, 75); if (this.pink) { c.globalCompositeOperation = 'destination-in'; c.drawImage(this.pink, 0, 0); } });
      this.glow = { a: 0, vis: false }; this.glowDark = { a: 0, vis: false };
      this.cardGlow = { a: 1, s: 1, vis: false };
      this.cg2 = { a: 0, vis: false }; this.cg1 = { a: 0, vis: false }; this.ctext = { a: 0, vis: false };
      this.yeah = new G.Sprite(-320, 120).loadAtlas(G.A.imagePath('freeplay/backing-text-yeah', 'preload'));
      if (this.yeah.atlas) this.yeah.addAnim('go', this.yeah.atlas.main.name, 24, false);
      const S = (y, txt, wid, bold, size, color, speed) => { const r = new ScrollText(y, txt, wid, bold, size); r.color = color; r.speed = speed; return r; };
      // order = draw order in BoyfriendCard.onCreate
      this.rows = [
        S(160, t2, W, true, 43, '#FFF383', 6.8),     // moreWays
        S(220, t1, W / 2, false, 60, '#FF9963', -3.8), // funnyScroll
        S(285, t3, W / 2, true, 43, '#FFFFFF', 3.5),  // txtNuts
        S(335, t1, W / 2, false, 60, '#FF9963', -3.8), // funnyScroll2
        S(397, t2, W, true, 43, '#FFF383', 6.8),     // moreWays2
        S(440 + 10, t1, W / 2, false, 60, '#FEA400', -3.8), // funnyScroll3
      ];
      this.tw.to(this, { pinkX: 0 }, 0.6, E.quartOut);
    }
    skipIntro() { this.tw.cancel(this); this.pinkX = 0; }
    introDone() {
      this.color = '#FFD863';
      this.orangeVis = true;
      this.cardGlow.vis = true; this.cardGlow.a = 1; this.cardGlow.s = 1;
      this.tw.to(this.cardGlow, { a: 0, s: 1.2 }, 0.45, E.sineOut);
      for (const r of this.rows) r.visible = true;
      this.glow.vis = this.glowDark.vis = true;
    }
    beatHit(beat, bpm) {
      const freq = [1, 2, 4, 8][Math.min(3, Math.floor(bpm / 140))];
      if (beat % freq !== 0) return;
      this.tw.cancel(this.glow); this.tw.cancel(this.glowDark);
      this.glow.a = 0.8; this.tw.to(this.glow, { a: 0 }, 16 / 24, E.quartOut);
      this.glowDark.a = 0; this.tw.to(this.glowDark, { a: 0.6 }, 18 / 24, E.quartOut);
    }
    confirm() {
      this.tw.color(this, 'color', '#FFD0D5', '#171831', 0.33, E.quadOut);
      this.orangeVis = false;
      this.cg1.vis = this.cg2.vis = true; this.cg1.a = 0; this.cg2.a = 0;
      this.yeah.play('go', true);
      const fp = this.fp;
      fp.tw.color(fp, 'bgColor', '#A8A8A8', '#646464', 0.5);
      this.tw.to(this.cg2, { a: 0.5 }, 0.33, E.quadOut, {
        onComplete: () => {
          this.cg2.a = 0.6; this.cg1.a = 1; this.ctext.vis = true; this.ctext.a = 1;
          this.tw.to(this.ctext, { a: 0.4 }, 0.5); this.tw.to(this.cg1, { a: 0 }, 0.5);
          fp.tw.cancel(fp); fp.tw.color(fp, 'bgColor', '#CDCDCD', '#555555', 2, E.expoOut);
        },
      });
      for (const r of this.rows) r.visible = false;
      this.glow.vis = this.glowDark.vis = false;
    }
    update(dt) { for (const r of this.rows) r.update(dt); this.yeah.update(dt); }
    draw(ctx) {
      G.setScreenT(ctx);
      if (this.pink) ctx.drawImage(tint(this.pink, this.color, 'pinkBack'), Math.round(this.pinkX), 0);
      if (this.orangeVis) { ctx.drawImage(this.orange, 84, 440); ctx.fillStyle = '#FFD400'; ctx.fillRect(0, 440, 100, 75); }
      const add = (img, x, y, a) => { if (img && a > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a); ctx.drawImage(img, x, y); ctx.restore(); } };
      if (this.cg2.vis) add(IMG('freeplay/confirmGlow2'), -30, 240, this.cg2.a);
      if (this.cg1.vis) add(IMG('freeplay/confirmGlow'), -30, 240, this.cg1.a);
      if (this.ctext.vis) add(IMG('freeplay/glowingText'), -8, 115, this.ctext.a);
      if (this.yeah.cur) this.yeah.draw(ctx, null);
      G.setScreenT(ctx);
      for (const r of this.rows) r.draw(ctx);
      const bg = IMG('freeplay/beatglow');
      if (bg && this.glowDark.vis && this.glowDark.a > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = this.glowDark.a; ctx.drawImage(bg, -300, 330); ctx.restore(); }
      if (this.glow.vis) add(bg, -300, 330, this.glow.a);
      const cg = IMG('freeplay/cardGlow');
      if (cg && this.cardGlow.vis && this.cardGlow.a > 0) drawF(ctx, cg, null, -30, -30, { sx: this.cardGlow.s, orX: cg.width / 2, orY: cg.height / 2, alpha: this.cardGlow.a, blend: 'lighter' });
    }
  }

  // ---------------------------------------------------------------- Pico's backing card (backcard-pico script)
  // FlxBackdrop strips (repeat on X), a multiplied blue bar, gun info ticker, glass-shatter confirm atlas
  class Backdrop {
    constructor(src, y, spacing, vel) { this.src = src; this.x = 0; this.y = y; this.sp = spacing; this.vel = vel; this.alpha = 1; this.flipX = false; this.visible = false; this.sheet = null; this.anim = null; }
    width() { if (this.sheet) { const f = this.frame(); return f ? f.fw : 1; } return this.src ? this.src.width : 1; }
    frame() { if (!this.anim) return this.sheet ? this.sheet.frames[0] : null; return this.anim.frames[Math.min(this.anim.frames.length - 1, this.anim.f)]; }
    update(dt) { this.x += this.vel * dt; if (this.anim) { this.anim.t += dt; while (this.anim.t >= 1 / 24) { this.anim.t -= 1 / 24; if (this.anim.f < this.anim.frames.length - 1) this.anim.f++; else this.anim.done = true; } } }
    play(name, prefix) { const fr = G.Sparrow.byPrefix(this.sheet, prefix); if (fr.length) this.anim = { name, frames: fr, f: 0, t: 0, done: false }; }
    draw(ctx) {
      if (!this.visible || (!this.src && !this.sheet)) return;
      const w = this.width(), step = w + this.sp;
      let x0 = this.x % step; if (x0 > 0) x0 -= step;
      ctx.save(); if (this.alpha < 1) ctx.globalAlpha *= this.alpha;
      for (let x = x0; x < W; x += step) {
        if (this.sheet) { ctx.save(); ctx.translate(Math.round(x), this.y); G.Sparrow.draw(ctx, this.sheet, this.frame()); ctx.restore(); }
        else if (this.flipX) { ctx.save(); ctx.translate(Math.round(x) + w, this.y); ctx.scale(-1, 1); ctx.drawImage(this.src, 0, 0); ctx.restore(); }
        else ctx.drawImage(this.src, Math.round(x), this.y);
      }
      ctx.restore();
    }
  }
  class PicoCard {
    constructor(fp) {
      this.fp = fp; this.tw = fp.tw;
      this.pink = IMG('freeplay/pinkBack');
      this.pw = this.pink ? this.pink.width : 524;
      this.pinkX = -this.pw; this.color = '#FFD4E9';
      const P = n => IMG('freeplay/backingCards/pico/' + n);
      this.back = new Backdrop(P('lowerLoop'), 200, 20, 110); this.back.flipX = true; this.back.alpha = 0.39;
      this.lower = new Backdrop(P('lowerLoop'), 406, 20, -110);
      this.blueBar = P('blueBar'); this.barVis = false;
      this.top = new Backdrop(null, 80, 20, -220); this.top.sheet = SP('freeplay/backingCards/pico/topLoop'); if (this.top.sheet) this.top.play('base', 'base');
      this.middle = new Backdrop(P('middleLoop'), 346, 15, 220);
      this.glowImg = P('glow'); this.glow = { a: 0, vis: false }; this.glowDark = { a: 0, vis: false };
      this.cardGlow = { a: 1, s: 1, vis: false };
      this.conf = new G.Sprite(-120, 55).loadAtlas(G.A.imagePath('freeplay/backingCards/pico/pico-confirm', 'preload'));
      if (this.conf.atlas) {
        for (const n of ['backplate flat blue', 'pink back', 'black flash', 'white flash', 'blue flash', 'blue flash 2', 'pink flash']) G.Atlas.scaleElement(this.conf.atlas, n, 2, 100);
        this.conf.addAnim('go', this.conf.atlas.main.name, 24, false);
      }
      this.confVis = false;
      this.rows = [];
      this.tw.to(this, { pinkX: 0 }, 0.6, E.quartOut);
    }
    skipIntro() { this.tw.cancel(this); this.pinkX = 0; }
    introDone() {
      this.color = '#98A2F3';
      this.barVis = true; for (const b of [this.back, this.lower, this.top, this.middle]) b.visible = true;
      this.glow.vis = this.glowDark.vis = true;
      this.cardGlow.vis = true; this.cardGlow.a = 1; this.cardGlow.s = 1;
      this.tw.to(this.cardGlow, { a: 0, s: 1.2 }, 0.45, E.sineOut);
    }
    beatHit(beat, bpm) {
      const freq = [1, 2, 4, 8][Math.min(3, Math.floor(bpm / 140))];
      if (beat % freq !== 0) return;
      this.tw.cancel(this.glow); this.tw.cancel(this.glowDark);
      this.glow.a = 1; this.tw.to(this.glow, { a: 0 }, 16 / 24, E.quartOut);
      this.glowDark.a = 0; this.tw.to(this.glowDark, { a: 1 }, 18 / 24, E.quartOut);
    }
    confirm() {
      this.confVis = true; this.conf.play('go', true);
      const fp = this.fp;
      fp.tw.color(fp, 'bgColor', '#FFFFFF', '#8A8A8A', 10 / 24, E.expoOut);
      [[10, '#343036', '#696366'], [14, '#27292D', '#686A6F'], [18, '#2D282D', '#676164'], [21, '#29292F', '#62626B'], [24, '#29232C', '#808080']]
        .forEach(([f, a, b]) => fp.tw.after(f / 24, () => { fp.tw.cancel(fp); fp.tw.color(fp, 'bgColor', a, b, 3 / 24, E.expoOut); }));
    }
    update(dt) {
      for (const b of [this.back, this.lower, this.top, this.middle]) b.update(dt);
      this.conf.update(dt);
      // the gun info strip shows a different gun depending on how far it has scrolled
      const t = this.top;
      if (t.sheet && t.anim && t.anim.done) {
        const p = Math.abs(t.x % (t.width() + 20));
        if (p >= 500 && p <= 700 && t.anim.name !== 'sniper') t.play('sniper', 'sniper info');
        if (p >= 700 && p <= 1300 && t.anim.name !== 'rifle') t.play('rifle', 'rifle info');
        if (p >= 1450 && p <= 2000 && t.anim.name !== 'rocket launcher') t.play('rocket launcher', 'rocket launcher info');
        if (p >= 0 && p <= 300 && t.anim.name !== 'uzi') t.play('uzi', 'uzi info');
      }
    }
    draw(ctx) {
      G.setScreenT(ctx);
      if (this.pink) ctx.drawImage(tint(this.pink, this.color, 'pinkBackPico'), Math.round(this.pinkX), 0);
      this.back.draw(ctx); this.lower.draw(ctx);
      if (this.barVis && this.blueBar) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.4; ctx.drawImage(this.blueBar, 0, 239); ctx.restore(); }
      this.top.draw(ctx); this.middle.draw(ctx);
      if (this.glowImg && this.glowDark.vis && this.glowDark.a > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = Math.min(1, this.glowDark.a); ctx.drawImage(this.glowImg, -300, 330); ctx.restore(); }
      if (this.glowImg && this.glow.vis && this.glow.a > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, this.glow.a); ctx.drawImage(this.glowImg, -300, 330); ctx.restore(); }
      if (this.confVis && this.conf.cur) { this.conf.draw(ctx, null); G.setScreenT(ctx); }
      const cg = IMG('freeplay/cardGlow');
      if (cg && this.cardGlow.vis && this.cardGlow.a > 0) drawF(ctx, cg, null, -30, -30, { sx: this.cardGlow.s, orX: cg.width / 2, orY: cg.height / 2, alpha: this.cardGlow.a, blend: 'lighter' });
    }
  }

  // ---------------------------------------------------------------- capsule title (CapsuleText: white 5by7 + cyan glow)
  function capTitle(name, glowCol, mode) {
    // mode: 'w' = white text with its glow filter, 'b' = blurred glow copy, 'f' = flicker white
    const size = 32, font = G.FONT.f5;
    measure.font = size + 'px ' + font;
    const m = measure.measureText(name);
    const asc = m.fontBoundingBoxAscent || 26, desc = m.fontBoundingBoxDescent || 6;
    const fw = Math.ceil(m.width) + 4, fh = Math.ceil(asc + desc) + 4, P = 6;
    const c = G.cached('fpcap:' + name + glowCol + mode, fw + P * 2, fh + P * 2, cx => {
      cx.font = size + 'px ' + font; cx.textBaseline = 'alphabetic';
      const tx = P + 2, ty = P + 2 + asc;
      if (mode === 'b') { cx.filter = 'blur(1.5px)'; cx.fillStyle = glowCol; cx.fillText(name, tx, ty); return; }
      // GlowFilter(color, 1, 5, 5, strength 210): a solid glow ~2px around every dot
      const gc = mode === 'f' ? '#FFFFFF' : glowCol;
      const g = G.makeCanvas(fw + P * 2, fh + P * 2), gx = g.getContext('2d');
      gx.font = cx.font; gx.textBaseline = 'alphabetic'; gx.fillStyle = gc;
      for (let a = 0; a < 16; a++) { const r = 2.2; gx.fillText(name, tx + Math.cos(a / 16 * Math.PI * 2) * r, ty + Math.sin(a / 16 * Math.PI * 2) * r); }
      gx.fillText(name, tx, ty);
      cx.filter = 'blur(0.8px)'; cx.drawImage(g, 0, 0); cx.filter = 'none';
      cx.fillStyle = mode === 'f' ? '#FFFFFF' : '#FFFFFF'; cx.fillText(name, tx, ty);
    });
    c._fw = fw; c._fh = fh; c._P = P;
    return c;
  }

  // ---------------------------------------------------------------- one song capsule (SongMenuItem)
  const XF = [1.7, 1.8, 0.85, 0.85, 0.97, 0.97, 1];
  const intendedX = i => 270 + 60 * Math.sin(i);
  class Capsule {
    constructor(fp, s, index) {
      this.fp = fp; this.s = s; this.index = index; this.random = !s;
      this.sheet = fp.capSheet; this.selFrames = fp.capSel; this.offFrames = fp.capOff;
      const f0 = this.sheet && this.sheet.frames[0];
      this.cw = f0 ? f0.fw : 612; this.ch = f0 ? f0.fh : 132;
      this.x = W; this.y = this.intendedY(index) + 10; this.tx = this.x; this.ty = this.y;
      this.sx = 0.8; this.sy = 0.8;
      this.capAlpha = s ? 0.5 : 0; this.subAlpha = s ? 1 : 0;   // random capsule: everything starts at alpha 0
      this.showGrp = false; this.selected = false;
      this.jumping = false; this.jumpI = 0; this.jumpT = 0; this.lerp = false;
      this.fi = 0; this.ft = 0;
      this.tsx = 1; this.tsy = 1; this.textAnim = null;
      this.clip = 290; this.scrollX = 0; this.scrollPhase = null;
      this.flicker = 0; this.flickT = 0; this.flickState = false;
      this.icon = s ? fp.pixelIcon(s.opp) : null; this.iconAnim = 'idle'; this.iconF = 0; this.iconT = 0;
      this.favAnim = null;
      this.curSel = 0;
      this.nudge = 0;
      // rank animation bits (SongMenuItem ranking / fakeRanking / sparkle / evilTrail)
      this.angle = 0; this.rankHide = false; this.rankScale = 0.9; this.fakeRank = null; this.fakeA = 0;
      this.shakeFx = null; this.trail = null; this.sparkle = null; this.sparkleT = 1;
    }
    // IntervalShake: every `interval` s jump to a random spot around where it was (intensity x width), easing down
    shake(dur, interval, i0, i1, ease, done) {
      if (this.shakeFx) return;
      this.shakeFx = { x0: this.x, y0: this.y, dur, interval, i0, i1, ease, done, t: 0, acc: 0, n: Math.floor(dur / interval), k: 0 };
    }
    // the rank-colour impact trail behind the capsule on the slam (fadeAnim)
    fadeAnim(rank) { this.trail = { t: 0, color: RANK_COLOR[rank] || '#6044FF' }; }
    intendedY(i) { return i * (this.ch * 0.8 + 10) + 120; }
    initJumpIn(force) {
      if (force) return this.forcePosition();
      this.jumping = true; this.lerp = true; this.jumpI = 0; this.jumpT = 0;
      this.fp.tw.after((XF.length / 24) * 2.5, () => { this.capAlpha = 1; this.showGrp = true; this.textAppear(); });
    }
    forcePosition() {
      this.capAlpha = 1; this.lerp = true; this.jumping = false; this.jumpI = XF.length;
      this.sx = this.sy = 0.8; this.x = this.tx; this.y = this.ty; this.showGrp = true; this.textAppear();
    }
    textAppear() { this.tsx = 1.7; this.tsy = 0.2; this.textAnim = 0; }
    setSelected(v) {
      if (this.selected === v) return;
      this.selected = v;
      this.scrollX = 0; this.scrollPhase = null; this.tsx = this.tsy = this.textAnim == null ? 1 : this.tsx;
      if (v && this.tooLong()) this.scrollPhase = { k: 'wait', t: 0.6, next: 'right' };
    }
    title() { return this.s ? this.s.name : 'Random'; }
    tooLong() { const c = capTitle(this.title(), this.fp.glowCol, 'w'); return c._fw > this.clip; }
    confirm() {
      this.textAppear(); this.scrollX = 0; this.scrollPhase = null; this.flicker = 19; this.flickT = 0;
      if (this.icon && this.icon.confirm) { this.iconAnim = 'confirm'; this.iconF = 0; this.iconT = 0; }
    }
    update(dt) {
      if (this.jumping) {
        this.jumpT += dt;
        if (this.jumpT >= 1 / 24 && this.jumpI < XF.length) {
          this.jumpT = 0;
          const xf = XF[this.jumpI];
          this.sx = xf * 0.8; this.sy = 0.8 / xf;
          this.tx = intendedX(this.index - this.curSel);
          this.jumpI++;
        } else if (this.jumpI === XF.length) this.jumping = false;
      }
      if (this.lerp) { this.x = sl(this.x, this.tx, dt, 0.256); this.y = sl(this.y, this.ty, dt, 0.192); }
      this.ft += dt; while (this.ft >= 1 / 24) { this.ft -= 1 / 24; this.fi++; }
      // text squash: (1.7,0.2) for a frame, (0.4,1.4) for two, then normal
      if (this.textAnim != null) {
        this.textAnim += dt;
        if (this.textAnim >= 3 / 24) { this.tsx = this.tsy = 1; this.textAnim = null; }
        else if (this.textAnim >= 1 / 24) { this.tsx = 0.4; this.tsy = 1.4; }
      }
      // long titles slide left/right inside the clip while selected
      const ph = this.scrollPhase;
      if (ph) {
        ph.t -= dt;
        if (ph.k === 'wait' && ph.t <= 0) { this.scrollPhase = { k: ph.next, t: 2, from: this.scrollX } ; }
        else if (ph.k !== 'wait') {
          const dist = capTitle(this.title(), this.fp.glowCol, 'w')._fw - this.clip;
          const k = 1 - Math.max(0, ph.t) / 2, e = E.sineInOut(k);
          this.scrollX = ph.k === 'right' ? ph.from + (dist - ph.from) * e : ph.from * (1 - e);
          if (ph.t <= 0) this.scrollPhase = { k: 'wait', t: 0.3, next: ph.k === 'right' ? 'left' : 'right' };
        }
      }
      if (this.flicker > 0) { this.flickT += dt; while (this.flickT >= 1 / 24 && this.flicker > 0) { this.flickT -= 1 / 24; this.flicker--; this.flickState = !this.flickState; } }
      if (this.icon) {
        this.iconT += dt;
        while (this.iconT >= 1 / 10) {
          this.iconT -= 1 / 10;
          const fr = this.icon[this.iconAnim] || this.icon.idle;
          if (this.iconF < fr.length - 1) this.iconF++;
          else if (this.iconAnim === 'confirm') { this.iconAnim = this.icon['confirm-hold'] ? 'confirm-hold' : 'confirm'; this.iconF = this.iconAnim === 'confirm' ? fr.length - 1 : 0; }
          else this.iconF = 0;
        }
      }
      if (this.favAnim) { this.favAnim.t += dt; while (this.favAnim.t >= 1 / 24) { this.favAnim.t -= 1 / 24; this.favAnim.f += this.favAnim.dir; } }
      const sh = this.shakeFx;
      if (sh) {
        sh.acc += dt;
        while (sh && sh.acc >= sh.interval) {
          sh.acc -= sh.interval; sh.k++;
          const sc = 1 - (sh.ease ? sh.ease(Math.min(1, (sh.k * sh.interval) / sh.dur)) : (sh.k * sh.interval) / sh.dur);
          const cur = sh.i1 + (sh.i0 - sh.i1) * sc, w = this.cw * 0.8;
          this.x = sh.x0 + (Math.random() * 2 - 1) * cur * w; this.y = sh.y0 + (Math.random() * 2 - 1) * cur * w;
          if (sh.k >= sh.n) { this.x = sh.x0; this.y = sh.y0; this.shakeFx = null; if (sh.done) sh.done(); break; }
        }
      }
      if (this.trail) { this.trail.t += dt; if (this.trail.t >= 0.6) this.trail = null; }
      // PERFECT (gold) badges twinkle now and then
      if (this.s && this.s.rank === 'PERFECT_GOLD' && !this.rankHide) {
        this.sparkleT -= dt;
        if (this.sparkleT <= 0) { this.sparkleT = 1.2 + Math.random() * 3.3; this.sparkle = { x: 420 - 20 + Math.random() * 23, y: 41 - 29 + Math.random() * 33, t: 0 }; }
        if (this.sparkle) this.sparkle.t += dt;
      } else this.sparkle = null;
    }
    hit(px, py) { const hx = this.x + 100, hy = this.y + 20; return px >= hx && px <= hx + this.cw / 1.4 && py >= hy && py <= hy + this.ch / 1.4; }
    draw(ctx) {
      if (this.angle) {
        // a rotated capsule turns around its middle (FlxSpriteGroup angle)
        const cx = this.x + this.nudge + this.cw / 2, cy = this.y + this.ch / 2;
        const m = ctx.getTransform();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(this.angle * Math.PI / 180); ctx.translate(-cx, -cy);
        this.drawBody(ctx);
        ctx.restore(); ctx.setTransform(m);
      } else this.drawBody(ctx);
    }
    drawBody(ctx) {
      const X = this.x + this.nudge, Y = this.y;
      if (Y < -160 || Y > H + 10 || X > W) return;
      const fp = this.fp, sel = this.selected;
      if (this.trail) {
        // impact copy of the capsule growing to 2.5x in the rank colour, fading out (additive)
        const k = this.trail.t / 0.6, frames0 = this.selFrames, f0 = frames0.length ? frames0[0] : null;
        if (f0) for (let i = 0; i < 4; i++) {
          const kk = Math.max(0, k - i * 0.05), sc = 0.8 + (2.5 - 0.8) * Math.min(1, kk / 0.83);
          drawF(ctx, tint(white(this.sheet, f0), this.trail.color, 'trail' + this.trail.color), null, X, Y, { sx: sc, orX: this.cw / 2, orY: this.ch / 2, alpha: 0.22 * (1 - E.quadOut(k)) * (1 - i * 0.2), blend: 'lighter' });
        }
      }
      // the capsule itself (scale 0.8 around its centre; unselected sits 5px right)
      const frames = sel ? this.selFrames : this.offFrames;
      const f = frames.length ? frames[this.fi % frames.length] : null;
      if (f && this.capAlpha > 0) drawF(ctx, this.sheet, f, X, Y, { sx: this.sx, sy: this.sy, orX: this.cw / 2, orY: this.ch / 2, offX: sel ? 0 : -5, alpha: this.capAlpha });
      const sa = this.subAlpha;
      if (this.s && sa > 0) {
        const bt = IMG('freeplay/freeplayCapsule/bpmtext'), dtx = IMG('freeplay/freeplayCapsule/difficultytext');
        if (bt) drawF(ctx, bt, null, X + 144, Y + 87, { sx: 0.9, orX: bt.width / 2, orY: bt.height / 2, alpha: sa });
        if (dtx) drawF(ctx, dtx, null, X + 414, Y + 87, { sx: 0.9, orX: dtx.width / 2, orY: dtx.height / 2, alpha: sa });
        // week label (YoureGone 20px, #21242E)
        const wk = fp.weekLabel(this.s.week);
        if (wk) drawF(ctx, wk.img, null, X + 291 - wk.ox, Y + 88 - wk.oy, { sx: 0.9, orX: wk.img.width / 2, orY: wk.img.height / 2, alpha: sa });
        // difficulty rating: big numbers
        const rating = Math.max(0, Math.min(99, this.s.ratings[fp.diff] || 0));
        const big = SP('freeplay/freeplayCapsule/bignumbers');
        [Math.floor(rating / 10), rating % 10].forEach((d, i) => fp.drawNum(ctx, big, d, X + 466 + i * 30 + (d === 1 ? 4 : d === 3 ? 1 : 0), Y + 32, sa));
        // bpm: small numbers, always 3 digits
        const bpm = Math.max(0, Math.min(999, this.s.bpm)), small = SP('freeplay/freeplayCapsule/smallnumbers');
        let shiftX = Math.floor(bpm / 100) === 1 ? 186 : 191, temp = 0;
        const dg = [bpm < 100 ? 0 : Math.floor(bpm / 100) % 10, bpm < 10 ? 0 : Math.floor(bpm / 10) % 10, bpm % 10];
        for (let i = 0; i < 3; i++) {
          if (i === 1 && bpm >= 10 && dg[1] === 1) temp = -4;
          if (i === 2 && dg[2] === 1) temp -= 4;
          fp.drawNum(ctx, small, dg[i], X + shiftX + i * 11 + temp + (dg[i] === 1 ? 4 : dg[i] === 3 ? 1 : 0), Y + 88.5, sa);
        }
        // rank badge (FreeplayRank: additive, scale 0.9, grey + 70% when not selected, a blurred copy for the glow)
        const drawRank = (r, sc, a, grey) => {
          const rk = fp.rankFrames(r); if (!rk) return;
          const f = rk.f, o = { sx: sc, orX: f.fw / 2, orY: f.fh / 2, offX: 0.05 * f.fw, offY: 0.05 * f.fh, blend: 'lighter' };
          drawF(ctx, fp.rankBlur(r), null, X + 420 - 6, Y + 41 - 6, Object.assign({}, o, { orX: f.fw / 2 + 6, orY: f.fh / 2 + 6, alpha: sa }));
          drawF(ctx, grey ? tint(fp.rankImg(r), '#AAAAAA', 'rankgrey' + r) : fp.rankImg(r), null, X + 420, Y + 41, Object.assign({}, o, { alpha: a * sa }));
        };
        if (this.fakeRank && this.fakeA > 0) drawRank(this.fakeRank, 0.9, this.fakeA, false);
        else if (this.s.rank && !this.rankHide) drawRank(this.s.rank, this.rankScale, sel ? 1 : 0.7, !sel);
        if (this.sparkle) {
          const sp = SP('freeplay/sparkle'), fr = sp ? G.Sparrow.byPrefix(sp, 'sparkle Export0') : [];
          const fi = Math.floor(this.sparkle.t * 24);
          if (fr.length && fi < fr.length) drawF(ctx, sp, fr[fi], X + this.sparkle.x, Y + this.sparkle.y, { sx: 0.8, orX: fr[0].fw / 2, orY: fr[0].fh / 2, alpha: 0.7, blend: 'lighter' });
        }
      }
      // title
      if (this.showGrp) {
        const name = this.title(), glow = fp.glowCol;
        const flick = this.flicker > 0 && this.flickState;
        const wImg = capTitle(name, flick ? '#FFFFFF' : glow, flick ? 'f' : 'w');
        const tx = X + this.cw * 0.26, ty = Y + 45;
        const fw = wImg._fw, fh = wImg._fh, P = wImg._P;
        const clipW = Math.min(fw, this.clip);
        const alpha = (this.random ? 1 : 1) * (sel ? 1 : 0.6);
        const drawT = (img, a, blend) => {
          ctx.save();
          ctx.globalAlpha *= a; if (blend) ctx.globalCompositeOperation = blend;
          ctx.translate(tx + fw / 2, ty + fh / 2); ctx.scale(this.tsx, this.tsy); ctx.translate(-fw / 2, -fh / 2);
          ctx.beginPath(); ctx.rect(-P, -P, clipW + P * 2, fh + P * 2); ctx.clip();
          ctx.drawImage(img, -P - this.scrollX, -P);
          ctx.restore();
        };
        if (sel) drawT(capTitle(name, flick ? '#FFFFFF' : glow, 'b'), alpha, flick ? 'lighter' : null);
        drawT(wImg, alpha, flick ? 'lighter' : null);
        // pixel icon of the opponent (scale 2, origin x 100)
        const ic = this.icon;
        if (ic) {
          const fr = (ic[this.iconAnim] || ic.idle)[this.iconF] || ic.idle[0];
          if (fr) drawF(ctx, ic.sheet, fr, X + 160, Y + 35, { sx: 2, orX: 100, orY: ic.fh / 2, smooth: false });
        }
      }
      // favorite heart (+ an additive copy while selected)
      if (this.s && (fp.fav[this.s.id] || this.favAnim)) {
        const sh = SP('freeplay/favHeart'), frs = sh ? G.Sparrow.byPrefix(sh, 'favorite heart') : [];
        if (frs.length) {
          let fi = frs.length - 1;
          if (this.favAnim) { fi = Math.max(0, Math.min(frs.length - 1, this.favAnim.f)); if ((this.favAnim.dir > 0 && this.favAnim.f >= frs.length - 1) || (this.favAnim.dir < 0 && this.favAnim.f <= 0)) { if (this.favAnim.dir < 0) { this.favAnim = null; if (!fp.fav[this.s.id]) return; } else this.favAnim = null; } }
          const fx = X + (this.s.rank ? 370 : 405), f0 = frs[0];
          const o = { sx: 50 / f0.fw, sy: 50 / f0.fh, orX: f0.fw / 2, orY: f0.fh / 2, blend: 'lighter' };
          if (sel) drawF(ctx, sh, frs[fi], fx, Y + 40, Object.assign({ alpha: 1 }, o));
          drawF(ctx, sh, frs[fi], fx, Y + 40, Object.assign({ alpha: sel ? 1 : 0.6 }, o));
        }
      }
    }
  }

  // ---------------------------------------------------------------- letter filter (LetterSort + FreeplayLetter atlas)
  const LETTER_REGEX = ['#', 'fav', 'ALL', 'A-B', 'C-D', 'E-H', 'I-L', 'M-N', 'O-R', 'S', 'T', 'U-Z'];
  const LETTER_ANIM = LETTER_REGEX.map(s => s.replace('-', ''));
  class LetterSort {
    constructor(fp) {
      this.fp = fp; this.x = 400; this.y = 75; this.visible = false;
      this.sel = 2;
      this.letters = [];
      const base = G.A.imagePath('freeplay/sortedLetters', 'preload');
      for (let i = 0; i < 5; i++) {
        const s = new G.Sprite(0, 0).loadAtlas(base);
        if (s.atlas) for (const a of LETTER_ANIM) s.addAnim(a, a + ' move', 24, true);
        const L = { spr: s, cur: i, offX: 0, vis: true, scale: i === 2 ? 1 : 0.8, dark: Math.max(Math.abs(i - 2) / 6, 0.01) };
        this.letters.push(L); this.showLetter(L, i === 2);
      }
      this.seps = [0, 1, 2, 3].map(i => ({ i, offX: 0 }));
      this.arrowOff = [0, 0];
      this.timers = [];
    }
    showLetter(L, playing) {
      const s = L.spr;
      if (!s.atlas) return;
      s.play(LETTER_ANIM[L.cur], true); s.paused = !playing;
    }
    change(dir) {
      const fp = this.fp, ez = (fr, fn) => fp.tw.after(fr / 24, fn);
      const P = [-10, -22, 2, 0], m = dir > 0 ? 1 : -1;
      for (const s of this.seps) { s.offX = P[0] * m; ez(1, () => s.offX = P[1] * m); ez(2, () => s.offX = P[2] * m); ez(3, () => s.offX = P[3] * m); }
      this.letters.forEach((L, i) => {
        L.offX = P[0] * m;
        ez(1, () => { L.offX = P[1] * m; if (i === 0) L.vis = false; });
        ez(2, () => { L.offX = P[2] * m; if (i === 0) L.vis = true; });
        ez(3, () => { L.offX = i === 2 ? 0 : P[3] * m; });
      });
      this.sel = (this.sel + dir + LETTER_REGEX.length) % LETTER_REGEX.length;
      for (const L of this.letters) { L.cur = (L.cur + dir + LETTER_REGEX.length) % LETTER_REGEX.length; this.showLetter(L, L === this.letters[2]); }
      const ai = dir < 0 ? 0 : 1; this.arrowOff[ai] = 3 * m; fp.tw.after(2 / 24, () => this.arrowOff[ai] = 0);
      G.sfx('scroll', { vol: 0.4 });
      return LETTER_REGEX[this.letters[2].cur];
    }
    current() { return LETTER_REGEX[this.letters[2].cur]; }
    // jump straight to a filter (no sound / wiggle), used when coming back to freeplay
    setSel(sel) {
      const N = LETTER_REGEX.length; this.sel = ((sel % N) + N) % N;
      this.letters.forEach((L, i) => { L.cur = (this.sel + i - 2 + N) % N; this.showLetter(L, i === 2); });
    }
    update(dt) { for (const L of this.letters) L.spr.update(dt); }
    draw(ctx) {
      if (!this.visible) return;
      G.setScreenT(ctx);
      const sep = IMG('freeplay/seperator');
      for (const s of this.seps) {
        const d = this.letters[s.i].dark, b = Math.round(255 * (1 - d) * (1 - d));
        if (sep) drawF(ctx, tint(sep, '#' + [b, b, b].map(v => v.toString(16).padStart(2, '0')).join(''), 'sep' + s.i), null, this.x + s.i * 80 + 60, this.y + 20, { offX: s.offX });
      }
      const arrow = IMG('freeplay/miniArrow');
      if (arrow) {
        drawF(ctx, arrow, null, this.x - 20, this.y + 15, { flipX: true, fw: arrow.width, offX: this.arrowOff[0] });
        drawF(ctx, arrow, null, this.x + 380, this.y + 15, { offX: this.arrowOff[1] });
      }
      this.letters.forEach((L, i) => {
        if (!L.vis || !L.spr.atlas) return;
        const s = L.spr, b = Math.round(255 * (1 - L.dark));
        s.x = this.x + i * 80 + 50 - 50 - L.offX; s.y = this.y + 50 - 60;
        s.scale.x = s.scale.y = L.scale; s.origin.x = s.frameW / 2; s.origin.y = s.frameH / 2;
        if (b < 250) { ctx.save(); s.draw(ctx, null); ctx.restore(); fp_darken(ctx, s, 1 - b / 255); }
        else s.draw(ctx, null);
      });
    }
  }
  // darken an atlas sprite by drawing it again in black with some alpha (FlxColor.getDarkened)
  function fp_darken(ctx, s, amt) {
    const key = 'fpdark:' + s.animName + ':' + s.fi;
    const b = G.Atlas.bounds(s.cur.atlas, s.cur.tl);
    const c = G.cached(key, b.w + 2, b.h + 2, cx => { cx.translate(-b.x, -b.y); G.Atlas.draw(cx, s.cur.atlas, s.cur.tl, s.cur.frames[s.fi]); cx.setTransform(1, 0, 0, 1, 0, 0); cx.globalCompositeOperation = 'source-in'; cx.fillStyle = '#000'; cx.fillRect(0, 0, b.w + 2, b.h + 2); });
    ctx.save(); ctx.globalAlpha = amt;
    ctx.translate(s.x + s.origin.x, s.y + s.origin.y); ctx.scale(s.scale.x, s.scale.y); ctx.translate(-s.origin.x, -s.origin.y);
    ctx.drawImage(c, 0, 0); ctx.restore();
  }

  // ---------------------------------------------------------------- album roll (album art + title + difficulty stars)
  class AlbumRoll {
    constructor(fp) {
      this.fp = fp; this.visible = false; this.id = undefined;
      this.art = new G.Sprite(W - 360, 220).loadAtlas(G.A.imagePath('freeplay/albumRoll/freeplayAlbum', 'preload'));
      if (this.art.atlas) { this.art.addAnim('intro', 'intro', 24, false); this.art.addAnim('switch', 'switch', 24, false); this.art.addAnim('idle', 'idle', 24, true); }
      this.art.onFinish = n => { if (n !== 'idle') this.art.play('idle', true); };
      this.artVis = false;
      this.stars = new G.Sprite(W - 330, 209).loadAtlas(G.A.imagePath('freeplay/freeplayStars', 'preload'));
      this.starsVis = false; this.diff = 0; this.starF = 0; this.starT = 0;
      this.title = null; this.titleVis = false;
    }
    setAlbum(id) {
      if (id === this.id && id != null) return;
      this.id = id;
      if (!id) { this.visible = false; return; }
      this.visible = true;
      const d = G.A.json('preload/data/ui/freeplay/albums/' + id + '.json');
      if (!d) return;
      const art = IMG(d.albumArtAsset);
      if (this.art.atlas && art) this.art.atlas.swaps['album art placeholder'] = { img: art, x: 16, y: 16 };
      const off = d.albumTitleOffsets || [0, 0];
      const t = new G.Sprite(W - 355 + off[0], 500 + off[1]).loadSparrow('preload/images/' + d.albumTitleAsset);
      t.addAnim('idle', 'idle0', 24, true); t.addAnim('switch', 'switch0', 24, false);
      t.onFinish = n => { if (n === 'switch') t.play('idle'); };
      t.play('idle');
      this.title = t.sheet ? t : null;
    }
    playIntro() {
      this.visible = true; this.titleVis = false; this.artVis = true;
      this.art.play('intro', true); this.starsVis = false;
      this.fp.tw.after(0.75, () => { this.titleVis = true; this.starsVis = true; if (this.title) this.title.play('switch', true); });
    }
    skipIntro() { this.visible = true; this.artVis = true; this.art.play('switch', true); if (this.title) this.title.play('switch', true); }
    setStars(n) {
      n = Math.max(0, Math.round(n || 0));
      this.diff = n <= 0 ? 0 : Math.min(15, n);
      const cur = n <= 0 ? 15 : this.diff - 1;
      if (cur !== this.curBlock) { this.curBlock = cur; this.starF = cur * 100; }
    }
    update(dt) {
      this.art.update(dt); if (this.title) this.title.update(dt);
      // stars: loop inside this difficulty's 100-frame block
      this.starT += dt;
      while (this.starT >= 1 / 24) { this.starT -= 1 / 24; if (this.curBlock < 15) { this.starF++; if (this.starF >= (this.curBlock + 1) * 100) this.starF = this.curBlock * 100; } }
    }
    draw(ctx) {
      if (!this.visible) return;
      G.setScreenT(ctx);
      if (this.artVis && this.art.cur) this.art.draw(ctx, null);
      if (this.starsVis && this.stars.atlas) {
        const s = this.stars, b = G.Atlas.bounds(s.atlas, s.atlas.main);
        ctx.save(); ctx.translate(s.x - b.x, s.y - b.y);
        G.Atlas.draw(ctx, s.atlas, s.atlas.main, Math.min(s.atlas.main.frameCount - 1, this.starF));
        ctx.restore();
      }
      if (this.titleVis && this.title) this.title.draw(ctx, null);
    }
  }

  // ---------------------------------------------------------------- song list
  function buildSongs(player) {
    const out = [];
    for (const wid of (G.availableWeeks ? G.availableWeeks() : [])) {
      const L = G.A.json('preload/data/levels/' + wid + '.json'); if (!L) continue;
      for (const sid of L.songs) {
        const m = G.Songs.meta(sid); if (!m) continue;
        const diffs = G.Songs.difficulties(sid, player);
        if (!diffs.length) continue;
        const ratings = {};
        for (const d of diffs) { const mm = G.Songs.meta(sid, d.variation) || m; ratings[d.diff] = ((mm.playData.ratings || {})[d.diff]) || 0; }
        const dm = G.Songs.meta(sid, diffs[0].variation) || m;
        out.push({ id: sid, name: m.songName || sid, week: wid, opp: (dm.playData.characters || {}).opponent || 'dad', bpm: Math.round((dm.timeChanges && dm.timeChanges[0] && dm.timeChanges[0].bpm) || 100), diffs, ratings, meta: m });
      }
    }
    return out;
  }

  const FP = G.screens.freeplay = {
    remember: { id: null, diff: 'normal', letter: 2 },
    enter(p) {
      p = p || {};
      this.tw = new Tw();
      this.player = G.settings.player === 'pico' ? 'pico' : 'bf';
      const style = G.A.json('preload/data/ui/freeplay/styles/' + this.player + '.json') || {};
      this.style = style;
      this.glowCol = (style.capsuleTextColors && style.capsuleTextColors[0]) || '#00ccff';
      this.fav = G.save.favorites = G.save.favorites || {};
      this.state = 'intro'; this.t = 0; this.went = false;
      this.fromResults = p.fromResults ? p : null;
      if (p.fromResults) { if (p.songId) this.remember.id = p.songId; if (p.diff) this.remember.diff = p.diff; }
      // a new/better rank: the rank camera starts black and plays the slam once the DJ intro is done
      this.rankFx = p.fromResults && p.playRankAnim && p.rank ? { pending: true, fade: 1, bgA: 0, zoom: 1, funny: 1, vigA: 0, shakeT: 0 } : null;
      // card, DJ
      this.card = this.player === 'pico' ? new PicoCard(this) : new Card(this, this.player);
      this.dj = new DJ(this.player);
      // background art (cut on a slant) + the black panel that slides in first
      this.bgImg = IMG(style.bgAsset || 'freeplay/freeplayBGweek1-bf') || IMG('freeplay/freeplayBGweek1-bf');
      this.bgX = this.card.pw * 0.74; this.bgVis = false; this.bgColor = '#000000';
      this.overlayX = W; this.overlayVis = true;
      this.tw.to(this, { overlayX: this.bgX }, 0.7, E.quintOut);
      this.overhangY = -164; this.tw.to(this, { overhangY: -100 }, 0.3, E.quartOut);
      this.hintY = 18 - 100; this.tw.to(this, { hintY: 18 }, 0.8, E.quartOut);
      this.textsVis = false; this.stroke = 2;
      // capsules
      this.capSheet = SP((style.capsuleAsset || 'freeplay/freeplayCapsule/capsule/freeplayCapsule'));
      this.capSel = this.capSheet ? G.Sparrow.byPrefix(this.capSheet, 'mp3 capsule w backing') : [];
      this.capOff = this.capSheet ? G.Sparrow.byPrefix(this.capSheet, 'mp3 capsule w backing NOT SELECTED') : [];
      // score + clear %
      this.hs = new G.Sprite(W - 420, 70).loadSparrow('preload/images/freeplay/highscore');
      this.hs.addAnim('hs', 'highscore small instance 1', 24, false);
      this.hsT = 12 + Math.random() * 38;
      this.digits = SP(style.numbersAsset || 'digital_numbers') || SP('digital_numbers');
      this.digitAnim = [0, 0, 0, 0, 0, 0, 0].map(() => ({ d: -1, f: 99, t: 0 }));
      this.score = 0; this.scoreShown = 0; this.clear = 0; this.clearShown = 0;
      this.scoreVis = false;
      // difficulty
      this.selArrows = [0, 1].map(i => {
        const s = new G.Sprite(i ? 325 : 20, 70).loadSparrow('preload/images/' + (style.selectorAsset || 'freeplay/freeplaySelector/freeplaySelector'));
        if (!s.sheet) s.loadSparrow('preload/images/freeplay/freeplaySelector');
        s.addAnim('shine', 'arrow pointer loop', 24, true); s.play('shine'); s.flipX = !!i; s.pressT = 0;
        return s;
      });
      this.diffVis = false;
      this.allDiffs = this.listAllDiffs();
      this.diff = this.allDiffs.includes(this.remember.diff) ? this.remember.diff : (this.allDiffs.includes('normal') ? 'normal' : this.allDiffs[0]);
      this.diffSpr = { id: this.diff, x: -300, offY: 0, alpha: 1 }; this.diffOld = null;
      this.dots = this.allDiffs.map(() => ({ color: '#484848', alpha: 0 }));
      this.dotsVis = false;
      // letters + album
      this.letters = new LetterSort(this);
      this.letters.setSel(this.remember.letter);
      this.album = new AlbumRoll(this);
      this.fadeA = 0;
      this.spam = { t: 0, on: false };
      this.swipe = new G.Swipe();
      this.beat = new G.MenuBeat(); this.lastBeat = -1;
      // songs
      this.allSongs = buildSongs(this.player);
      this.sel = 0; this.list = []; this.caps = [];
      // back from the results screen (under the stickers): no intro, everything already in place (forceSkipIntro)
      const skip = !!(p.fromResults && G.stickers);
      this.generate(this.filterFor(this.letters.current()), false, skip);
      if (skip) {
        this.tw.cancel(this); this.card.skipIntro();
        this.overlayX = this.bgX; this.overhangY = -100; this.hintY = 18;
        this.dj.play('idle', true);
        this.onIntroDone();
      } else {
        // intro: wait for the DJ, then everything else pops in
        this.dj.onIntroDone = () => this.onIntroDone();
        if (!this.dj.cur) this.onIntroDone();
      }
      if (G.audio.music.current() == null || (G.audio.music.current().id || '').indexOf('freakyMenu') < 0) G.menuMusic.start(0.5);
      this.previewT = -1; this.previewing = null;
    },
    listAllDiffs() {
      const set = new Set();
      for (const s of buildSongs(this.player)) for (const d of s.diffs) set.add(d.diff);
      const l = G.DIFF_ORDER.filter(d => set.has(d));
      return l.length ? l : ['easy', 'normal', 'hard'];
    },
    onIntroDone() {
      if (this.state !== 'intro') return;
      this.state = 'idle';
      this.album.playIntro();
      this.album.setAlbum(this.albumFor());
      this.bgVis = true;
      this.tw.color(this, 'bgColor', '#000000', '#FFFFFF', 0.6, E.expoOut, { onComplete: () => { this.overlayVis = false; } });
      this.diffVis = true; this.tw.to(this.diffSpr, { x: 90 }, 0.6, E.quartOut);
      this.letters.visible = true;
      this.tw.after(1 / 24, () => {
        this.textsVis = true; this.scoreVis = true; this.clear = this.clearShown = 0;
        this.tw.after(1.5 / 24, () => { this.stroke = 0; this.changeSelection(0); });
      });
      this.card.introDone();
      this.refreshDots(this.allDiffs.indexOf(this.diff), this.allDiffs.indexOf(this.diff));
      this.dotsVis = true; for (const d of this.dots) { d.alpha = 0; this.tw.to(d, { alpha: d.inactive ? 0.33 : 1 }, 0.5, E.quartOut); }
      if (this.rankFx && this.rankFx.pending) {
        this.rankFx.pending = false;
        this.rankAnimStart(this.fromResults);
        if (this.album.skipIntro) this.album.skipIntro();
      }
    },
    // ------------------------------------------------------------ list building (generateSongList)
    filterFor(letter) {
      if (letter === 'ALL') return null;
      if (letter === 'fav') return { type: 'fav' };
      if (letter === '#') return { type: 're', data: '0-9' };
      return { type: 're', data: letter };
    },
    generate(filter, keepIfSame, noJumpIn) {
      let songs = this.allSongs.slice();
      if (filter && filter.type === 'fav') songs = songs.filter(s => this.fav[s.id]).sort((a, b) => a.name.localeCompare(b.name));
      else if (filter && filter.type === 're') { const re = new RegExp('^[' + filter.data + '].*', 'i'); songs = songs.filter(s => re.test(s.name)).sort((a, b) => a.name.localeCompare(b.name)); }
      songs = songs.filter(s => s.diffs.some(d => d.diff === this.diff));
      const ids = songs.map(s => s.id).join(',');
      if (keepIfSame && ids === this.listIds) { if (!noJumpIn) for (const c of this.caps) { c.x = W; c.initJumpIn(false); } return; }
      this.listIds = ids; this.filter = filter;
      const prev = this.remember.id;
      this.list = [null].concat(songs);
      this.caps = this.list.map((s, i) => new Capsule(this, s, s ? i : 1));
      for (const s of songs) s.rank = this.rankFor(s);
      for (const c of this.caps) { if (noJumpIn) { c.forcePosition(); } else c.initJumpIn(false); }
      // remember the song we were on
      let idx = prev ? this.list.findIndex(s => s && s.id === prev) : -1;
      if (idx < 0) idx = this.list.length > 1 ? 1 : 0;
      this.sel = idx;
      this.changeSelection(0, true);
      if (noJumpIn) for (const c of this.caps) { c.x = c.tx; c.y = c.ty; }
    },
    song() { return this.list[this.sel] || null; },
    albumFor() { const s = this.song(); if (!s) return null; const d = s.diffs.find(x => x.diff === this.diff) || s.diffs[0]; const m = G.Songs.meta(s.id, d.variation) || s.meta; return (m.playData && m.playData.album) || 'volume1'; },
    rankFor(s) {
      const d = s.diffs.find(x => x.diff === this.diff); if (!d) return null;
      const rec = G.getScore(s.id + (d.variation !== 'default' ? '-' + d.variation : ''), this.diff, 'bf');
      return rec && rec.rank ? rec.rank : null;
    },
    // ------------------------------------------------------------ selection
    changeSelection(change, silent) {
      const n = this.caps.length; if (!n) return;
      const prev = this.sel;
      this.sel = (((this.sel + change) % n) + n) % n;
      if (!silent && this.sel !== prev) G.sfx('scroll', { vol: 0.4 });
      const s = this.song();
      this.remember.id = s ? s.id : null;
      this.updateScore();
      if (!s) this.album.setAlbum(null);
      this.caps.forEach((c, m) => {
        c.curSel = this.sel;
        c.setSelected(m === this.sel);
        const ci = m + 1 - this.sel;
        let yOff = 0; if (ci < 0) yOff += 50; else if (ci > 4) yOff -= 10;
        c.ty = c.intendedY(ci) - yOff;
        c.tx = intendedX(ci);
      });
      if (this.state === 'idle') { this.previewT = 0.25; this.previewing = null; G.audio.music.setVolume(0, 0.05); }
      this.refreshAlbum();
    },
    refreshAlbum() {
      if (this.state === 'intro') return;
      const id = this.albumFor();
      if (id && id !== this.album.id) { this.album.setAlbum(id); this.album.skipIntro(); }
      else if (!id) this.album.setAlbum(null);
      const s = this.song();
      this.album.setStars(s ? s.ratings[this.diff] : 0);
    },
    updateScore() {
      const s = this.song();
      if (!s) { this.score = 0; this.clear = 0; return; }
      const d = s.diffs.find(x => x.diff === this.diff) || s.diffs[0];
      const rec = G.getScore(s.id + (d.variation !== 'default' ? '-' + d.variation : ''), this.diff, 'bf');
      this.score = rec ? rec.score : 0;
      this.clear = rec ? (rec.clear != null ? rec.clear : (rec.acc || 0)) : 0;
    },
    changeDiff(change) {
      const list = this.allDiffs;
      const prevI = list.indexOf(this.diff);
      let i = prevI < 0 ? list.indexOf('normal') : prevI;
      i = (i + change + list.length) % list.length;
      if (list[i] === this.diff) return;
      // old sprite slides out, new one slides in from the other side
      this.diffOld = { id: this.diff, x: this.diffSpr.x, offY: 0, alpha: 1 };
      this.tw.to(this.diffOld, { x: change > 0 ? -320 : 500 }, 0.2, E.circInOut, { onComplete: () => { this.diffOld = null; } });
      this.diff = list[i]; this.remember.diff = this.diff;
      this.tw.cancel(this.diffSpr);
      this.diffSpr = { id: this.diff, x: change > 0 ? 500 : -320, offY: 5, alpha: 0.5 };
      this.tw.to(this.diffSpr, { x: 90 }, 0.2, E.circInOut);
      const ds = this.diffSpr; this.tw.after(1 / 24, () => { ds.alpha = 1; ds.offY = 0; });
      G.sfx('scroll', { vol: 0.4 });
      // the list only shows songs that have this difficulty
      this.generate(this.filter, true, true);
      this.updateScore();
      for (const s of this.list) if (s) s.rank = this.rankFor(s);
      this.refreshDots(i, prevI);
      this.refreshAlbum();
      this.previewT = 0.25; this.previewing = null;
    },
    refreshDots(index, prevIndex) {
      const s = this.song();
      this.allDiffs.forEach((id, i) => {
        const d = this.dots[i]; if (!d) return;
        const erect = id === 'erect' || id === 'nightmare';
        const has = !s || s.diffs.some(x => x.diff === id);
        d.inactive = !has;
        this.tw.cancel(d);
        if (!has) { d.color = '#121212'; if (this.dotsVis) d.alpha = 0.33; return; }
        if (this.dotsVis) d.alpha = 1;
        const on = erect ? '#C28AFF' : '#FAFAFA', off = erect ? '#34296A' : '#484848';
        if (i === index) d.color = on;
        else if (i === prevIndex) this.tw.color(d, 'color', on, off, 0.5, E.quartOut, { tag: d });
        else d.color = off;
      });
    },
    // ------------------------------------------------------------ actions
    confirm() {
      if (this.state !== 'idle') return;
      let cap = this.caps[this.sel];
      if (!cap) return;
      if (!cap.s) {
        const real = this.caps.filter(c => c.s);
        if (!real.length) { G.sfx('cancel'); return; }
        cap = real[Math.floor(Math.random() * real.length)];
        this.sel = this.caps.indexOf(cap); this.changeSelection(0, true);
      }
      const s = cap.s, d = s.diffs.find(x => x.diff === this.diff) || s.diffs[0];
      this.pending = { id: s.id, diff: d.diff, variation: d.variation };
      this.state = 'confirm'; this.confirmT = 0;
      G.sfx('confirm');
      this.dj.play('confirm');
      cap.forcePosition(); cap.confirm();
      this.card.confirm();
      for (const dt of this.dots) this.tw.to(dt, { alpha: 0 }, 0.25, E.quartOut);
      G.audio.music.setVolume(0, 0.6);
      const delay = this.style.startDelay || 1;
      this.tw.after(delay, () => {
        this.tw.to(this, { fadeA: 1 }, 0.2, null, {
          onComplete: () => {
            if (this.went) return; this.went = true;
            G.audio.music.stop(0);
            G.setScreen('play', { mode: 'freeplay', songs: [this.pending.id], songIndex: 0, diff: this.pending.diff, variation: this.pending.variation, week: null, deaths: 0 }, { instant: true });
          },
        });
      });
    },
    back() {
      if (this.state !== 'idle') return;
      this.state = 'exit';
      G.sfx('cancel');
      G.audio.music.stop(0.3);
      G.setScreen('mainMenu', {});
    },
    toggleFav() {
      const cap = this.caps[this.sel], s = cap && cap.s; if (!s) return;
      const on = !this.fav[s.id];
      if (on) this.fav[s.id] = true; else delete this.fav[s.id];
      G.saveData && G.saveData();
      const frs = SP('freeplay/favHeart') ? G.Sparrow.byPrefix(SP('freeplay/favHeart'), 'favorite heart') : [];
      cap.favAnim = on ? { f: 0, dir: 1, t: 0 } : { f: Math.min(9, frs.length - 1), dir: -1, t: 0 };
      G.sfx(on ? 'fav' : 'unfav');
      // little hop (up then back)
      const base = cap.y; cap.lerp = false;
      this.state = 'busy';
      this.tw.to(cap, { y: base + (on ? -5 : 5) }, 0.1, E.expoOut);
      this.tw.to(cap, { y: base }, 0.1, E.expoIn, { delay: 0.1, onComplete: () => { cap.lerp = true; if (this.state === 'busy') this.state = 'idle'; } });
    },
    changeLetter(dir) {
      const key = this.letters.change(dir);
      this.remember.letter = this.letters.sel;
      this.generate(this.filterFor(key), true, false);
    },
    switchPlayer() {
      if (this.state !== 'idle') return;
      this.state = 'switch';
      G.sfx('confirm', { vol: 0.5 });
      if (G.screens.charSelect) { this.dj.play('charSelect'); this.tw.after(0.45, () => G.setScreen('charSelect', { from: 'freeplay' })); return; }
      const go = () => { G.settings.player = this.player === 'pico' ? 'bf' : 'pico'; G.saveSettings && G.saveSettings(); this.enter({}); };
      if (this.dj.play('charSelect')) this.tw.after(0.45, go); else go();
    },
    pressArrow(i) { const a = this.selArrows[i]; a.pressT = 2 / 24; },
    onAction(a, down, repeat) {
      if (!down) { if (a === 'ui_up' || a === 'ui_down') { this.spam.on = false; this.spam.t = 0; } return; }
      if (this.state !== 'idle') return;
      if (a === 'ui_up' || a === 'ui_down') { if (repeat) return; this.changeSelection(a === 'ui_up' ? -1 : 1); this.spam.t = 0; this.spam.on = false; this.spam.dir = a === 'ui_up' ? -1 : 1; }
      else if (a === 'ui_left' && !repeat) { this.pressArrow(0); this.changeDiff(-1); }
      else if (a === 'ui_right' && !repeat) { this.pressArrow(1); this.changeDiff(1); }
      else if (a === 'accept' && !repeat) this.confirm();
      else if (a === 'back' && !repeat) this.back();
      else if (a === 'tab' && !repeat) this.switchPlayer();
      else if (a === 'debug7' && !repeat && this.song() && G.screens.editor) G.setScreen('editor', { songId: this.song().id, diff: this.diff, from: 'freeplay' });
    },
    onKey(code, down, repeat) {
      if (!down || repeat || this.state !== 'idle') return false;
      if (code === 'KeyF') { this.toggleFav(); return true; }
      if (code === 'KeyQ') { this.changeLetter(-1); return true; }
      if (code === 'KeyE') { this.changeLetter(1); return true; }
      if (code === 'Home') { this.changeSelection(-this.sel); return true; }
      if (code === 'End') { this.changeSelection(this.caps.length - 1 - this.sel); return true; }
      return false;
    },
    onWheel(dir) { if (this.state === 'idle') this.changeSelection(dir); },
    onPointer(type, x, y) {
      if (this.state !== 'idle') return;
      const sw = this.swipe.handle(type, x, y); if (!sw) return;
      if (sw.dir === 'up') { this.changeSelection(1); return; }
      if (sw.dir === 'down') { this.changeSelection(-1); return; }
      if (sw.dir === 'left' && y < 160 && x > 380 && x < 820) { this.changeLetter(1); return; }
      if (sw.dir === 'right' && y < 160 && x > 380 && x < 820) { this.changeLetter(-1); return; }
      if (sw.dir !== 'tap') return;
      if (y < 64 && x < 280) { this.back(); return; }
      if (y > 60 && y < 170 && x < 90) { this.pressArrow(0); this.changeDiff(-1); return; }
      if (y > 60 && y < 170 && x > 300 && x < 390) { this.pressArrow(1); this.changeDiff(1); return; }
      if (y > 64 && y < 150 && x > 380 && x < 820) { this.changeLetter(x < 600 ? -1 : 1); return; }
      for (let i = this.caps.length - 1; i >= 0; i--) {
        if (this.caps[i].hit(x, y)) { if (i === this.sel) this.confirm(); else this.changeSelection(i - this.sel); return; }
      }
      if (G.input.touchMode && x < 380 && y > 250) this.switchPlayer();   // tapping the DJ = character select (touch only, like V-Slice)
    },
    onBlur() { this.spam.on = false; this.spam.t = 0; },
    // ------------------------------------------------------------ update
    update(dt) {
      this.t += dt;
      this.tw.update(dt);
      this.dj.update(dt);
      const R = this.rankFx;
      if (R) {
        if (R.sparks) R.sparks.t += dt;
        if (R.shakeT > 0) { R.shakeT -= dt; R.sx = (Math.random() * 2 - 1) * 0.0045 * W; R.sy = (Math.random() * 2 - 1) * 0.0045 * H; if (R.shakeT <= 0) R.sx = R.sy = 0; }
      }
      this.card.update(dt);
      for (const c of this.caps) c.update(dt);
      this.letters.update(dt); this.album.update(dt);
      for (const a of this.selArrows) { a.update(dt); if (a.pressT > 0) a.pressT -= dt; }
      this.hs.update(dt);
      this.hsT -= dt; if (this.hsT <= 0) { this.hs.play('hs', true); this.hsT = 20 + Math.random() * 40; }
      // hold up/down: repeat after 0.9s, every 0.07s
      if (this.state === 'idle' && (G.input.isDown('ui_up') || G.input.isDown('ui_down'))) {
        this.spam.t += dt;
        if (this.spam.on) { if (this.spam.t >= 0.07) { this.spam.t = 0; this.changeSelection(G.input.isDown('ui_up') ? -1 : 1); } }
        else if (this.spam.t >= 0.9) this.spam.on = true;
      } else { this.spam.on = false; this.spam.t = 0; }
      // score + clear %
      this.scoreShown = Math.abs(this.scoreShown - this.score) < 1 ? this.score : sl(this.scoreShown, this.score, dt, 0.2);
      this.clearShown = Math.abs(this.clearShown - this.clear) < 0.01 ? this.clear : sl(this.clearShown, this.clear, dt, 0.5);
      const shown = String(Math.min(9999999, Math.round(this.scoreShown))).padStart(7, '0');
      this.digitAnim.forEach((d, i) => { const v = +shown[i]; if (v !== d.d) { d.d = v; d.f = 0; d.t = 0; } d.t += dt; while (d.t >= 1 / 24) { d.t -= 1 / 24; d.f++; } });
      // card glow on the beat of whatever is playing
      const bpm = (G.audio.music.current() || { bpm: 102 }).bpm || 102;
      const b = Math.floor(G.audio.music.time() / (60000 / bpm));
      if (b !== this.lastBeat) { if (b > this.lastBeat && this.state !== 'intro') this.card.beatHit(b, bpm); this.lastBeat = b; }
      // song preview (fades in, loops the preview part, random = its own track)
      if (this.state === 'idle' && this.previewT >= 0) {
        this.previewT -= dt;
        if (this.previewT < 0) this.playPreview();
      }
    },
    playPreview() {
      const s = this.song();
      if (!s) {
        if (this.previewing === 'random') return; this.previewing = 'random';
        const meta = G.A.json('preload/music/freeplayRandom/freeplayRandom-metadata.json');
        const bpm = meta && meta.timeChanges ? meta.timeChanges[0].bpm : 145;
        G.audio.music.play('preload/music/freeplayRandom/freeplayRandom.ogg', { loop: true, bpm, vol: 0.7, fadeIn: 2, restart: true });
        return;
      }
      const d = s.diffs.find(x => x.diff === this.diff) || s.diffs[0];
      const key = s.id + ':' + d.variation;
      if (this.previewing === key) return; this.previewing = key;
      const m = G.Songs.meta(s.id, d.variation) || s.meta;
      const pd = m.playData || {};
      const bpm = (m.timeChanges && m.timeChanges[0] && m.timeChanges[0].bpm) || 100;
      G.audio.music.play(G.Songs.instPath(s.id, m, d.variation), { loop: true, bpm, vol: 0.7, fadeIn: 2, restart: true, offset: (pd.previewStart || 0) / 1000, end: (pd.previewEnd || 15000) / 1000 });
    },
    leave() { this.went = false; this.tw && this.tw.clear(); },
    // ------------------------------------------------------------ draw
    drawNum(ctx, sheet, d, x, y, alpha) {
      if (!sheet) return;
      const fr = G.Sparrow.byPrefix(sheet, NUMS[d]);
      const f = fr[fr.length - 1] || fr[0]; if (!f) return;
      drawF(ctx, sheet, f, x, y, { sx: 0.9, alpha });
    },
    pixelIcon(id) {
      this._icons = this._icons || {};
      if (id in this._icons) return this._icons[id];
      // PixelatedIcon: try "a", "a-b", "a-b-c"... keep the longest that exists
      const parts = id.split('-'); let name = '', best = null;
      for (let i = 0; i < parts.length; i++) { name += (i ? '-' : '') + parts[i]; if (G.A.has('preload/images/freeplay/icons/' + name + 'pixel.png')) best = name; }
      let res = null;
      if (best) {
        const sh = SP('freeplay/icons/' + best + 'pixel');
        if (sh) {
          const idle = G.Sparrow.byPrefix(sh, 'idle'), conf = G.Sparrow.byPrefix(sh, 'confirm'), hold = G.Sparrow.byPrefix(sh, 'confirm-hold');
          if (idle.length) res = { sheet: sh, idle, confirm: conf.length ? conf : null, 'confirm-hold': hold.length ? hold : null, fh: idle[0].fh };
        }
      }
      return (this._icons[id] = res);
    },
    weekLabel(wid) {
      this._weeks = this._weeks || {};
      if (wid in this._weeks) return this._weeks[wid];
      const L = G.A.json('preload/data/levels/' + wid + '.json') || {};
      let txt = L.capsule && L.capsule.name;
      if (!txt) { txt = ''; for (let i = 0; i < wid.length; i++) { const p = wid[i - 1], c = wid[i]; if (i > 0) { if (p.toLowerCase() === p && c.toLowerCase() !== c) txt += ' '; const pn = /\d/.test(p), cn = /\d/.test(c); if (pn !== cn) txt += ' '; } txt += c; } }
      const off = (L.capsule && L.capsule.offsets) || [0, 0];
      return (this._weeks[wid] = { img: textImg(txt, G.FONT.gone, 20, '#21242E'), ox: off[0], oy: off[1] });
    },
    rankFrames(rank) {
      const sh = SP('freeplay/rankbadges'); if (!sh) return null;
      const name = { PERFECT_GOLD: 'PERFECT rank GOLD', PERFECT: 'PERFECT rank0', EXCELLENT: 'EXCELLENT rank0', GREAT: 'GREAT rank0', GOOD: 'GOOD rank0', SHIT: 'LOSS rank0', LOSS: 'LOSS rank0' }[rank] || rank;
      let fr = sh.frames.filter(f => f.name.startsWith(name)); if (!fr.length) fr = G.Sparrow.byPrefix(sh, name);
      const f = fr[0]; if (!f) return null;
      return { sheet: sh, f, cx: 0, cy: 0 };
    },
    // the badge as one image + a softly blurred copy (GaussianBlurShader(1) glow), 6px padding
    rankImg(rank) {
      const rk = this.rankFrames(rank); if (!rk) return null;
      return G.cached('fprank:' + rank, rk.f.fw, rk.f.fh, c => G.Sparrow.draw(c, rk.sheet, rk.f));
    },
    rankBlur(rank) {
      const img = this.rankImg(rank); if (!img) return null;
      return G.cached('fprankblur:' + rank, img.width + 12, img.height + 12, c => { c.filter = 'blur(1.6px)'; c.drawImage(img, 6, 6); c.filter = 'none'; });
    },
    // ------------------------------------------------------------ results -> freeplay rank animation
    // (FreeplayState.rankAnimStart / rankDisplayNew / rankAnimSlam, same timings + curves)
    rankAnimStart(fr) {
      const cap = this.caps[this.sel]; if (!cap || !cap.s) { this.rankFx = null; return; }
      this.state = 'ranking';
      const R = this.rankFx;
      R.cap = cap; R.bad = fr.rank === 'SHIT' || fr.rank === 'LOSS';
      cap.sparkle = null; cap.sparkleT = 1;
      this.dj.fistPumpIntro(R.bad);
      R.fade = 1; this.tw.to(R, { fade: 0 }, 0.5);               // rankCamera.fade(black, 0.5, fadeIn)
      G.audio.music.setVolume(0, 0.05);
      R.bgA = 1;
      if (fr.oldRank) { cap.fakeRank = fr.oldRank; cap.fakeA = 1; R.sparksColor = RANK_COLOR[fr.oldRank] || '#FFFFFF'; }
      else { cap.fakeRank = null; cap.fakeA = 0; }
      cap.lerp = false; cap.inRank = true; cap.rankHide = true;
      R.orig = { x: intendedX(1), y: cap.intendedY(1) };
      R.zoom = 1.85; this.tw.to(R, { zoom: 1.8 }, 0.6, E.sineIn);
      R.funny = 1.15; this.tw.to(R, { funny: 1.1 }, 0.6, E.sineIn);
      cap.x = W / 2 - cap.cw / 2; cap.y = H / 2 - cap.ch / 2;
      this.tw.after(0.5, () => this.rankDisplayNew(fr));
    },
    rankDisplayNew(fr) {
      const R = this.rankFx, cap = R.cap;
      cap.rankHide = false; cap.rankScale = 20;
      this.tw.to(cap, { rankScale: 0.9 }, 0.1);
      this.tw.after(0.1, () => {
        cap.fakeRank = null; cap.fakeA = 0;
        if (fr.oldRank) R.sparks = { t: 0 };
        G.sfx('preload/sounds/ranks/' + (fr.rank === 'SHIT' ? 'rankinbad' : (fr.rank === 'PERFECT' || fr.rank === 'PERFECT_GOLD') ? 'rankinperfect' : 'rankinnormal') + '.ogg');
        R.zoom = 1.3; this.tw.to(R, { zoom: 1.5 }, 0.3, E.fxBackInOut);
        cap.x -= 10; cap.y -= 20;
        this.tw.to(R, { funny: 1.05 }, 0.3, E.fxElasticOut);
        cap.angle = -3; this.tw.to(cap, { angle: 0 }, 0.5, E.fxBackOut);
        cap.shake(0.3, 1 / 30, 0.1, 0, E.quadOut);
      });
      this.tw.after(0.4, () => {
        this.tw.to(R, { funny: 1 }, 0.8, E.sineIn);
        this.tw.to(R, { zoom: 1.2 }, 0.8, E.fxBackIn);
        R.capTw = this.tw.to(cap, { x: R.orig.x - 7, y: R.orig.y - 80 }, 0.8 + 0.5, E.quartIn);
      });
      this.tw.after(0.6, () => this.rankAnimSlam(fr));
    },
    rankAnimSlam(fr) {
      const R = this.rankFx, cap = R.cap;
      this.tw.to(R, { bgA: 0 }, 0.5, E.fxExpoIn);
      G.sfx('preload/sounds/ranks/' + ({ SHIT: 'loss', GOOD: 'good', GREAT: 'great', EXCELLENT: 'excellent', PERFECT: 'perfect', PERFECT_GOLD: 'perfect' }[fr.rank] || 'loss') + '.ogg');
      this.tw.after(0.5, () => {
        R.shakeT = 0.35;                                     // funnyCam.shake(0.0045, 0.35)
        this.dj.fistPump(R.bad);
        R.zoom = 0.8; this.tw.to(R, { zoom: 1 }, 1, E.fxElasticOut);
        R.funny = 0.8; this.tw.to(R, { funny: 1 }, 0.8, E.fxElasticOut);
        this.caps.forEach((c, index) => {
          const d = Math.abs(index - this.sel) - 1;
          if (d >= 5) return;
          if (index === this.sel) {
            if (R.capTw) R.capTw.dead = true;
            c.fadeAnim(fr.rank);
            R.vigColor = RANK_COLOR[fr.rank] || '#6044FF'; R.vigA = 1; this.tw.to(R, { vigA: 0 }, 0.6, E.expoOut);
            c.x = R.orig.x; c.y = R.orig.y;
            c.shake(0.6, 1 / 24, 0.12, 0, E.quadOut, () => {
              c.lerp = true; c.inRank = false;
              this.rankFx = null; this.state = 'idle';
              this.previewT = 0; this.previewing = null;
            });
            this.tw.to(c, { angle: 0 }, 0.5, E.fxBackOut);
          } else {
            this.tw.after(d / 20, () => {
              c.lerp = false;
              c.angle = -10 + d * 2 + Math.random() * (20 - d * 4);
              this.tw.to(c, { angle: 0 }, 0.5, E.fxBackOut);
              c.shake(0.6, 1 / 24, 0.12 / (d + 1), 0, E.quadOut, () => { c.lerp = true; });
            });
          }
        });
      });
    },
    drawRankCam(ctx) {
      const R = this.rankFx; if (!R) return;
      G.screenZoom = 1; G.screenOff.x = G.screenOff.y = 0;
      G.setScreenT(ctx);
      if (R.vigA > 0) { const v = IMG('freeplay/rankVignette'); if (v) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = R.vigA; ctx.drawImage(tint(v, R.vigColor, 'vig' + R.vigColor), 0, 0, W, H); ctx.restore(); } }
      G.screenZoom = R.zoom; G.setScreenT(ctx);
      if (R.bgA > 0) { ctx.fillStyle = 'rgba(0,0,0,' + (0.827 * R.bgA) + ')'; ctx.fillRect(-W, -H, W * 3, H * 3); }
      if (R.cap && R.cap.inRank) R.cap.draw(ctx);
      if (R.sparks) {
        G.setScreenT(ctx);
        const a = SP('freeplay/sparks'), b = SP('freeplay/sparksadd');
        const fa = a ? G.Sparrow.byPrefix(a, 'sparks') : [], fb = b ? G.Sparrow.byPrefix(b, 'sparks add') : [];
        const fi = Math.floor(R.sparks.t * 24);
        if (fi < fa.length) {
          drawF(ctx, a, fa[fi], 517, 134, { sx: 0.5, orX: fa[0].fw / 2, orY: fa[0].fh / 2, offX: -0.25 * fa[0].fw, offY: -0.25 * fa[0].fh, blend: 'lighter' });
          if (fb[fi]) drawF(ctx, tint(G.cached('fpspk' + fi, fb[fi].fw, fb[fi].fh, c => G.Sparrow.draw(c, b, fb[fi])), R.sparksColor, 'spk' + fi + R.sparksColor), null, 498, 116, { sx: 0.5, orX: fb[0].fw / 2, orY: fb[0].fh / 2, offX: -0.25 * fb[0].fw, offY: -0.25 * fb[0].fh, blend: 'lighter' });
        }
      }
      G.screenZoom = 1; G.setScreenT(ctx);
      if (R.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + R.fade + ')'; ctx.fillRect(0, 0, W, H); }
    },
    draw(ctx) {
      const R = this.rankFx;
      G.screenZoom = 1; G.screenOff.x = G.screenOff.y = 0;
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (R && !R.pending) { G.screenZoom = R.funny; G.screenOff.x = R.sx || 0; G.screenOff.y = R.sy || 0; }
      this.card.draw(ctx);
      this.dj.draw(ctx);
      G.setScreenT(ctx);
      const bg = this.bgImg, s = bg ? (H + 1) / bg.height : 1, bw = bg ? bg.width * s : 0;
      const slant = (x0) => { ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + bw, 0); ctx.lineTo(x0 + bw, H + 1); ctx.lineTo(x0 + 90 * s, H + 1); ctx.closePath(); };
      if (this.overlayVis) { ctx.save(); slant(this.overlayX); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore(); }
      // difficulty
      if (this.diffVis) {
        if (this.diffOld) this.drawDiffSprite(ctx, this.diffOld);
        this.drawDiffSprite(ctx, this.diffSpr);
      }
      if (this.dotsVis) {
        const dot = IMG('freeplay/seperator'), n = this.dots.length, gx = 260 - 14.7 * (Math.min(n, 8) - 1);
        if (dot) this.dots.forEach((d, i) => { if (d.alpha > 0) ctx.drawImage(tint(dot, d.color, 'dot' + i), Math.round(gx + 30 * (i % 8) - 75), 170 + 30 * Math.floor(i / 8)); });
      }
      // background art on the right
      if (bg && this.bgVis) {
        ctx.save(); slant(this.bgX); ctx.clip();
        ctx.drawImage(bg, this.bgX, 0, bw, H + 1);
        const c = hex(this.bgColor)[0] / 255;
        if (c < 0.999) { ctx.fillStyle = 'rgba(0,0,0,' + (1 - c) + ')'; ctx.fillRect(this.bgX, 0, bw, H + 1); }
        ctx.restore();
      }
      // capsules
      for (const c of this.caps) if (!c.inRank) c.draw(ctx);
      G.setScreenT(ctx);
      this.album.draw(ctx);
      G.setScreenT(ctx);
      // high score + clear %
      if (this.textsVis) {
        this.hs.draw(ctx, null); G.setScreenT(ctx);
        this.drawScore(ctx);
        const cb = IMG('freeplay/clearBox'); if (cb) ctx.drawImage(cb, W - 115, 65);
        const pct = String(Math.max(0, Math.min(100, Math.floor(this.clearShown * 100))));
        const t = this._clearTxt && this._clearTxt.text === pct ? this._clearTxt : (this._clearTxt = new G.Alphabet(pct, 'freeplay-clear', 0, 0));
        t.text = pct;
        const ox = pct.length === 3 ? 10 : pct.length === 1 ? -24 : 0;
        t.x = W - 95 - ox; t.y = 87; t.draw(ctx, null); G.setScreenT(ctx);
      }
      this.letters.draw(ctx);
      // difficulty arrows
      if (this.diffVis) for (const a of this.selArrows) {
        if (a.pressT > 0) {
          const f = a.cur && a.cur.frames[a.fi];
          if (f) drawF(ctx, white(a.sheet, f), null, a.x, a.y + 5, { sx: 0.5, orX: f.fw / 2, orY: f.fh / 2, flipX: a.flipX, fw: f.fw });
        } else a.draw(ctx, null);
        G.setScreenT(ctx);
      }
      // top bar
      ctx.fillStyle = '#000'; ctx.fillRect(0, this.overhangY, W, 164);
      if (this.textsVis) {
        const fpImg = textImg('FREEPLAY', G.FONT.vcr, 48, '#FFFFFF', this.stroke ? { stroke: 2 } : null);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, fpImg._tw + 16, fpImg.height + 16 - fpImg._pad * 2);
        ctx.drawImage(fpImg, 8 - fpImg._pad, 8 - fpImg._pad);
        const ost = textImg(this.album.id === null && this.song() ? 'OFFICIAL OST' : 'OFFICIAL OST', G.FONT.vcr, 48, '#FFFFFF', { stroke: 2 });
        ctx.drawImage(ost, W - 8 - ost._tw - ost._pad, 8 - ost._pad);
      }
      const hint = textImg('Press [ TAB ] to change characters', G.FONT.f5, 32, '#5F5F5F');
      ctx.drawImage(hint, Math.round(-40 + (W - 16 - hint.width) / 2), Math.round(this.hintY));
      if (G.touchMode && this.textsVis) G.text(ctx, '<---', 8, 72, { font: 'vcr', size: 40, baseline: 'top' });
      if (this.fadeA > 0) { ctx.fillStyle = 'rgba(0,0,0,' + this.fadeA + ')'; ctx.fillRect(0, 0, W, H); }
      if (R) { if (R.pending) { G.screenZoom = 1; G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); } else this.drawRankCam(ctx); }
      G.screenZoom = 1; G.screenOff.x = G.screenOff.y = 0;
    },
    drawDiffSprite(ctx, d) {
      const base = 'freeplay/freeplay' + d.id;
      const sh = G.A.has('preload/images/' + base + '.xml') ? SP(base) : null;
      if (sh) {
        const fr = G.Sparrow.byPrefix(sh, 'idle0'), list = fr.length ? fr : sh.frames;
        const f = G.settings.flashingLights === false ? list[0] : list[Math.floor(this.t * 24) % list.length];
        drawF(ctx, sh, f, d.x, 80 - d.offY, { alpha: d.alpha });
      } else { const img = IMG(base); if (img) drawF(ctx, img, null, d.x, 80 - d.offY, { alpha: d.alpha }); }
    },
    drawScore(ctx) {
      const sh = this.digits; if (!sh || !this.scoreVis) return;
      this.digitAnim.forEach((d, i) => {
        const fr = G.Sparrow.byPrefix(sh, NUMS[d.d] + ' DIGITAL'); if (!fr.length) return;
        const f = fr[Math.min(fr.length - 1, d.f)];
        drawF(ctx, sh, f, W - 353 + 45 * i + (d.d === 1 ? 15 : 0), 120, { sx: 0.4 });   // FlxSpriteGroup(0, 60) + ScoreNum(.., 60)
      });
    },
  };
})();
