// FNF 2 - Character Select ("CHOOSE YOUR DIPSHIT"), rebuilt from the Funkin' engine's V-Slice
// CharSelectSubState (+ CharSelectPlayer, CharSelectGF, CharSelectCursors, Nametag, Lock, IntroSubState)
// with the real assets. Positions, tweens and timings follow the engine source.
// Freeplay's TAB opens it; picking a character goes back to freeplay as that character.
(function () {
  const W = 1280, H = 720;
  const CS = 'preload/images/charSelect/';
  const E = G.ease;
  const sl = (a, b, dt, dur) => b + (a - b) * Math.pow(0.01, dt / dur);          // MathUtil.smoothLerpPrecision
  const snap = (v, t, d) => Math.abs(v - t) < d ? t : v;
  const IMG = p => G.A.image(CS + p + '.png');

  // ---------------------------------------------------------------- the players (PlayerRegistry charSelect data)
  // pos = grid spot 0..8 (4 = middle), chill = their animation on the right, gf = who bops on the speakers
  G.PLAYERS = G.PLAYERS || {};
  Object.assign(G.PLAYERS, {
    bf: { id: 'bf', name: 'Boyfriend', pos: 4, chill: CS + 'bfChill', gf: { asset: CS + 'gfChill', viz: false }, nametag: 'boyfriend', icon: 'bf' },
    pico: { id: 'pico', name: 'Pico', pos: 3, chill: CS + 'picoChill', gf: { asset: CS + 'neneChill', viz: true }, nametag: 'pico', icon: 'pico' },
  });
  const LOCK_COLORS = ['#31F2A5', '#20ECCD', '#24D9E8', '#20ECCD', '#20C8D4', '#209BDD', '#209BDD', '#2362C9', '#243FB9'];

  // ---------------------------------------------------------------- an Animate atlas sprite (FunkinSprite + texture atlas)
  // stage = applyStageMatrix (drawn where it sits on the Animate stage). Otherwise the whole timeline's
  // top-left sits at (x - offset). Labels play like anim.play(label).
  class AS {
    constructor(base, x, y, o) {
      o = o || {};
      this.x = x || 0; this.y = y || 0; this.scroll = o.scroll == null ? 1 : o.scroll;
      this.stageM = !!o.stage; this.sx = o.sx || 1; this.sy = o.sy || this.sx; this.blend = o.blend || null;
      this.offX = o.offX || 0; this.offY = o.offY || 0;
      this.alpha = 1; this.visible = true; this.swf = !!o.swf;
      this.cur = null; this.fi = 0; this.t = 0; this.name = null; this.loop = false; this.finished = true;
      this.onFinish = null; this.onFrame = null; this.once = [];
      this.setAtlas(base);
    }
    setAtlas(base) {
      if (this.base === base) return;
      this.base = base; this.atlas = base ? G.Atlas.load(base) : null;
      if (this.atlas && this.swf) this.atlas.swf = true;
      this.cur = null; this.name = null;
    }
    has(l) { return !!(this.atlas && (l === '' || this.atlas.labels[l])); }
    play(l, force, loop) {
      if (!this.atlas) return false;
      const lab = l === '' ? { start: 0, len: this.atlas.main.frameCount } : this.atlas.labels[l];
      if (!lab) return false;
      if (!force && this.name === l && !this.finished) return true;
      this.cur = lab; this.name = l; this.fi = 0; this.t = 0; this.loop = !!loop; this.finished = false;
      return true;
    }
    update(dt) {
      if (!this.cur || this.finished) return;
      this.t += dt; const step = 1 / (this.atlas.fps || 24);
      while (this.t >= step && !this.finished) {
        this.t -= step;
        if (this.fi < this.cur.len - 1) { this.fi++; if (this.onFrame) this.onFrame(this.name, this.fi); }
        else if (this.loop) this.fi = 0;
        else {
          this.finished = true; const n = this.name;
          const once = this.once.splice(0); for (const f of once) f(n);
          if (this.onFinish) this.onFinish(n);
        }
      }
    }
    center() {
      const b = G.Atlas.bounds(this.atlas), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (!this.stageM) return { x: b.w / 2, y: b.h / 2 };
      const m = this.atlas.stage; return { x: m[0] * cx + m[2] * cy + m[4], y: m[1] * cx + m[3] * cy + m[5] };
    }
    draw(ctx, cam) {
      if (!this.visible || !this.cur || !this.atlas || this.alpha <= 0) return;
      if (cam) cam.apply(ctx, this.scroll); else G.setScreenT(ctx);
      ctx.save();
      if (this.stageM) ctx.translate(this.x, this.y);
      else { const b = G.Atlas.bounds(this.atlas); ctx.translate(this.x - this.offX, this.y - this.offY); ctx.translate(-b.x, -b.y); }
      if (this.sx !== 1 || this.sy !== 1) {
        const c = this.center(), bx = this.stageM ? 0 : G.Atlas.bounds(this.atlas).x, by = this.stageM ? 0 : G.Atlas.bounds(this.atlas).y;
        ctx.translate(c.x + bx, c.y + by); ctx.scale(this.sx, this.sy); ctx.translate(-c.x - bx, -c.y - by);
      }
      if (this.stageM) { const m = this.atlas.stage; ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); }
      if (this.alpha < 1) ctx.globalAlpha *= this.alpha;
      if (this.blend) ctx.globalCompositeOperation = this.blend;
      if (this.layerTint) this.atlas.layerTint = this.layerTint;
      if (this.layerFrames) this.atlas.layerFrames = this.layerFrames;
      try { G.Atlas.draw(ctx, this.atlas, this.atlas.main, this.cur.start + this.fi); }
      finally { if (this.layerTint) this.atlas.layerTint = null; if (this.layerFrames) this.atlas.layerFrames = null; }
      ctx.restore();
    }
  }
  G.CSAtlasSprite = AS;

  // ---------------------------------------------------------------- the character on the right (CharSelectPlayer)
  class Player extends AS {
    constructor() {
      super(null, 0, 0, { stage: true, swf: true });
      this.charId = null; this.custom = null;
      this.onFinish = n => {
        if (this.custom) return;
        if (n === 'slidein') { if (this.has('slidein idle point')) this.play('slidein idle point', true); else this.play('idle', true, true); }
        else if (n === 'deselect') this.play('deselect loop start', true);
        else if (n === 'slidein idle point' || n === 'cannot select Label' || n === 'unlock') this.play('idle', true);
        else if (n === 'idle' && this.charId === 'locked') this.play('idle', true, true);
      };
    }
    switchChar(id, slide) {
      this.charId = id;
      const P = G.PLAYERS[id];
      if (P && P.makeChill) { this.custom = this.custom && this.custom.id === id ? this.custom : P.makeChill(); this.custom.play(slide === false ? 'idle' : 'slidein'); return; }
      this.custom = null;
      this.setAtlas(id === 'locked' ? CS + 'lockedChill' : (P ? P.chill : CS + 'bfChill'));
      this.play(slide === false ? 'idle' : 'slidein', true);
    }
    anim(n, loop) { if (this.custom) return this.custom.play(n, loop); return this.play(n, true, loop); }
    current() { return this.custom ? this.custom.name : this.name; }
    isFinished() { return this.custom ? this.custom.finished : this.finished; }
    beat() { if (this.current() === 'idle' && this.isFinished()) this.anim('idle'); }
    update(dt) { if (this.custom) this.custom.update(dt); else super.update(dt); }
    draw(ctx, cam) { if (!this.visible) return; if (this.custom) this.custom.draw(ctx, cam); else super.draw(ctx, cam); }
  }

  // ---------------------------------------------------------------- who bops on the speakers (CharSelectGF)
  class GF extends AS {
    constructor() { super(null, 0, 0, { stage: true, swf: true }); this.path = ''; this.viz = false; this.custom = null; this.levels = new Float32Array(7); }
    switchGF(id) {
      const P = G.PLAYERS[id], g = P && P.gf;
      if (g && g.make) { this.custom = this.custom && this.custom.id === id ? this.custom : g.make(); this.path = 'custom:' + id; this.visible = true; this.custom.play('idle'); return; }
      this.custom = null;
      const path = (g && g.asset) || '';
      if (!path) { this.visible = false; this.path = ''; return; }
      if (path !== this.path) { this.path = path; this.setAtlas(path); this.viz = !!g.viz; this.visible = true; }
      this.play('idle', true);
    }
    anim(n, loop) { if (this.custom) return this.custom.play(n, loop); return this.play(n, true, loop); }
    current() { return this.custom ? this.custom.name : this.name; }
    beat(b) { if (this.current() === 'idle' && b % 2 === 0) this.anim('idle'); }
    update(dt) {
      if (this.custom) { this.custom.update(dt); return; }
      super.update(dt);
      // Nene's visualizer: 7 bars from the music (0 = tallest... the art is drawn backwards, like the original says)
      if (this.viz) {
        const an = G.audio && G.audio.musicAnalyser;
        if (an) {
          const d = this._fft || (this._fft = new Uint8Array(an.frequencyBinCount)); an.getByteFrequencyData(d);
          const bands = [1, 2, 4, 8, 16, 32, 64, 128];
          for (let i = 0; i < 7; i++) { let s = 0, n = 0; for (let k = bands[i]; k < bands[i + 1] && k < d.length; k++) { s += d[k]; n++; } const v = n ? s / n / 255 : 0; this.levels[i] = Math.max(v, this.levels[i] - dt * 2.5); }
        }
        this.layerFrames = { VIZ_bars: (i) => i < 7 ? Math.abs(Math.floor(Math.min(12, Math.max(0, Math.round(this.levels[i] * 12)))) - 12) : 0 };
      } else this.layerFrames = null;
    }
    draw(ctx, cam) { if (!this.visible) return; if (this.custom) this.custom.draw(ctx, cam); else super.draw(ctx, cam); }
  }

  // ---------------------------------------------------------------- the name in the top right (Nametag + its mosaic)
  class Nametag {
    constructor() { this.mid = { x: 1008, y: 100 }; this.img = null; this.block = 1; this.seq = []; this.t = 0; this.alpha = 1; }
    switchChar(id, mosaic) {
      const name = id === 'bf' ? 'boyfriend' : (G.PLAYERS[id] && G.PLAYERS[id].nametag) || id;
      this.img = IMG(name + 'Nametag') || (G.PLAYERS[id] && G.PLAYERS[id].nametagImg && G.PLAYERS[id].nametagImg()) || IMG('lockedNametag');
      this.block = 1; this.seq = []; this.t = 0;
      if (mosaic === false || !this.img) return;
      const w = this.img.width * 0.77, h = this.img.height * 0.77;
      // Nametag.shaderEffect: pixelate in, then (2/30 s later) pixelate out
      this.seq = [[0, w / 10, h / 10], [1 / 30, w / 73, h / 6], [2 / 30, w / 10, h / 10], [2 / 30, 1, 1], [3 / 30, w / 27, h / 26], [4 / 30, w / 10, h / 10], [5 / 30, 1, 1]];
    }
    update(dt) {
      if (!this.seq.length) return;
      this.t += dt;
      while (this.seq.length && this.t >= this.seq[0][0]) { const s = this.seq.shift(); this.bx = s[1]; this.by = s[2]; }
      if (!this.seq.length && this.bx !== 1) { this.bx = this.by = 1; }
    }
    draw(ctx) {
      const im = this.img; if (!im) return;
      G.setScreenT(ctx);
      const w = im.width * 0.77, h = im.height * 0.77, x = this.mid.x - w / 2, y = this.mid.y - h / 2;
      ctx.save(); ctx.globalAlpha *= this.alpha;
      const bx = this.bx || 1, by = this.by || 1;
      if (bx > 1.5 || by > 1.5) {
        const cw = Math.max(1, Math.round(w / bx)), ch = Math.max(1, Math.round(h / by));
        const c = this._mos || (this._mos = G.makeCanvas(64, 64));
        if (c.width < cw) c.width = cw; if (c.height < ch) c.height = ch;
        const cx = c.getContext('2d'); cx.clearRect(0, 0, c.width, c.height); cx.imageSmoothingEnabled = true; cx.drawImage(im, 0, 0, cw, ch);
        ctx.imageSmoothingEnabled = false; ctx.drawImage(c, 0, 0, cw, ch, x, y, w, h); ctx.imageSmoothingEnabled = true;
      } else ctx.drawImage(im, x, y, w, h);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- the cursor (CharSelectCursors)
  function tinted(img, col) {
    if (!img) return null;
    return G.cached('cscur:' + col, img.width, img.height, c => { c.drawImage(img, 0, 0); c.globalCompositeOperation = 'multiply'; c.fillStyle = col; c.fillRect(0, 0, img.width, img.height); c.globalCompositeOperation = 'destination-in'; c.drawImage(img, 0, 0); });
  }
  const hexMix = (a, b, t) => { const A = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), B = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16)); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  class Cursors {
    constructor() {
      this.main = { x: 0, y: 0 }; this.light = { x: 0, y: 0 }; this.dark = { x: 0, y: 0 };
      this.img = IMG('charSelector'); this.w = this.img ? this.img.width : 124; this.h = this.img ? this.img.height : 112;
      this.conf = new G.Sprite(0, 0).loadSparrow(CS + 'charSelectorConfirm'); this.conf.addAnim('idle', 'cursor ACCEPTED instance 1', 24, true);
      this.deny = new G.Sprite(0, 0).loadSparrow(CS + 'charSelectorDenied'); this.deny.addAnim('idle', 'cursor DENIED instance 1', 24, false);
      this.conf.visible = false; this.deny.visible = false; this.deny.onFinish = () => { this.deny.visible = false; };
      this.alpha = 1; this.t = 0; this.confirmed = false;
    }
    confirm() { this.confirmed = true; this.conf.visible = true; this.conf.play('idle', true); }
    unconfirm() { this.confirmed = false; this.conf.visible = false; }
    resetDeny() { this.deny.visible = false; }
    denied() { this.deny.visible = true; this.deny.play('idle', true); }
    snapTo(p) { this.main.x = this.light.x = this.dark.x = p.x; this.main.y = this.light.y = this.dark.y = p.y; }
    lerpTo(p, dt) {
      this.main.x = snap(sl(this.main.x, p.x, dt, 0.1), p.x, 1); this.main.y = snap(sl(this.main.y, p.y, dt, 0.1), p.y, 1);
      this.light.x = sl(this.light.x, this.main.x, dt, 0.202); this.light.y = sl(this.light.y, this.main.y, dt, 0.202);
      this.dark.x = sl(this.dark.x, p.x, dt, 0.404); this.dark.y = sl(this.dark.y, p.y, dt, 0.404);
    }
    update(dt) { this.t += dt; this.conf.update(dt); this.deny.update(dt); }
    draw(ctx) {
      if (this.alpha <= 0) return;
      G.setScreenT(ctx); ctx.save(); ctx.globalAlpha *= this.alpha;
      if (!this.confirmed && this.img) {
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(tinted(this.img, '#3C74F7'), this.dark.x, this.dark.y);
        ctx.drawImage(tinted(this.img, '#3EBBFF'), this.light.x, this.light.y);
        ctx.globalCompositeOperation = 'source-over';
        // FlxTween.color 0.2 s PINGPONG yellow <-> orange-yellow
        const k = (this.t / 0.2) % 2, f = k < 1 ? k : 2 - k;
        ctx.drawImage(tinted(this.img, hexMix('#FFFF00', '#FFCC00', Math.round(f * 6) / 6)), this.main.x, this.main.y);
      }
      ctx.restore();
      for (const s of [this.conf, this.deny]) if (s.visible) { s.x = this.main.x - 2; s.y = this.main.y - 4; s.alpha = this.alpha; s.draw(ctx, null); }
    }
  }

  // ---------------------------------------------------------------- pixel icons + their "selected" look
  function pixelIcon(id) {
    const fp = G.screens.freeplay && G.screens.freeplay.pixelIcon ? G.screens.freeplay.pixelIcon.call(G.screens.freeplay, id) : null;
    return fp;
  }
  // DropShadowFilter x2 (a hard white outline + a black shadow down-right), drawn once per frame picture
  function selectedLook(ic, f) {
    const key = 'csicon:' + ic.sheet.base + ':' + f.name;
    const s = 2.6, pad = 8, w = Math.ceil(f.fw * s) + pad * 2, h = Math.ceil(f.fh * s) + pad * 2;
    return G.cached(key, w, h, c => {
      const a = G.makeCanvas(w, h), ax = a.getContext('2d');
      ax.imageSmoothingEnabled = false; ax.translate(pad, pad); ax.scale(s, s); G.Sparrow.draw(ax, ic.sheet, f);
      const wh = G.makeCanvas(w, h), wx = wh.getContext('2d');
      wx.drawImage(a, 0, 0); wx.globalCompositeOperation = 'source-in'; wx.fillStyle = '#FFFFFF'; wx.fillRect(0, 0, w, h);
      const bl = G.makeCanvas(w, h), bx = bl.getContext('2d');
      bx.drawImage(a, 0, 0); bx.globalCompositeOperation = 'source-in'; bx.fillStyle = '#000000'; bx.fillRect(0, 0, w, h);
      c.globalAlpha = 0.85; c.drawImage(bl, 4, 4); c.globalAlpha = 1;
      for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2; c.drawImage(wh, Math.cos(an) * 2.5, Math.sin(an) * 2.5); }
      c.drawImage(a, 0, 0);
    });
  }

  // ---------------------------------------------------------------- the screen
  const S = G.screens.charSelect = {
    enter(p) {
      p = p || {};
      this.tw = new G.Tw();
      this.from = p.from || 'freeplay';
      this.rankMode = !!p.rankMode;
      this.remembered = p.character || G.settings.player || 'bf';
      if (!G.PLAYERS[this.remembered]) this.remembered = 'bf';
      // the grid: which player sits where
      this.slots = new Array(9).fill(null);
      for (const id in G.PLAYERS) { let pos = G.PLAYERS[id].pos || 0; while (this.slots[pos] && pos < 8) pos++; this.slots[pos] = id; }
      this.cam = new G.FCam(1); this.cam.followRate = 0.01;
      this.camFollow = { x: W / 2, y: H / 2 - 150 }; this.cam.focus(this.camFollow.x, this.camFollow.y);
      this.autoFollow = false;
      // world
      this.bg = new G.Sprite(-153, -140).loadImage(CS + 'charSelectBG.png'); this.bg.scroll.x = this.bg.scroll.y = 0.1;
      this.crowd = new AS(CS + 'crowd', 0, 0, { stage: true, scroll: 0.3, swf: true }); this.crowd.play('', true, true);
      this.stageSpr = new AS(CS + 'charSelectStage', -2, 1, { stage: true, swf: true }); this.stageSpr.play('', true, true);
      this.curtains = new G.Sprite(-212, -99).loadImage(CS + 'curtains.png'); this.curtains.scroll.x = this.curtains.scroll.y = 1.4;
      this.bar = new AS(CS + 'barThing', 0, 80, { stage: true, scroll: 0, blend: 'multiply', sx: 2.5, sy: 1, swf: true }); this.bar.play('', true, true);
      this.tw.to(this.bar, { y: 0 }, 1.3, E.expoOut);
      this.light = new G.Sprite(800, 250).loadImage(CS + 'charLight.png');
      this.lightGF = new G.Sprite(180, 240).loadImage(CS + 'charLight.png');
      this.gf = new GF(); this.chillOut = new Player(); this.chill = new Player();
      const start = this.remembered;
      this.gf.switchGF(start); this.chillOut.switchChar(start, false); this.chillOut.visible = false; this.chill.switchChar(start, false);
      this.speakers = new AS(CS + 'charSelectSpeakers', -10, 0, { stage: true, scroll: 1.8, sx: 1.05, swf: true }); this.speakers.play('', true, true);
      this.fgBlur = new G.Sprite(-125, 170).loadImage(CS + 'foregroundBlur.png'); this.fgBlur.blend = 'multiply';
      this.dBlur = new G.Sprite(419, -65 + 220).loadSparrow(CS + 'dipshitBlur'); this.dBlur.addAnim('idle', 'CHOOSE vertical offset instance 1', 24, true); this.dBlur.play('idle'); this.dBlur.blend = 'lighter';
      this.dBack = new G.Sprite(423, -17 + 210).loadSparrow(CS + 'dipshitBacking'); this.dBack.addAnim('idle', 'CHOOSE horizontal offset instance 1', 24, true); this.dBack.play('idle'); this.dBack.blend = 'lighter';
      this.choose = new G.Sprite(426, -13 + 200).loadImage(CS + 'chooseDipshit.png');
      for (const s of [this.dBlur, this.dBack, this.choose]) s.scroll.x = s.scroll.y = 0;
      this.tw.to(this.dBack, { y: -17 }, 1.1, E.expoOut); this.tw.to(this.choose, { y: -13 }, 1, E.expoOut); this.tw.to(this.dBlur, { y: -65 }, 1.2, E.expoOut);
      this.nametag = new Nametag(); this.nametag.switchChar(start, false);
      this.nametag.mid.y = 100 + 200; this.tw.to(this.nametag.mid, { y: 100 }, 1, E.expoOut);
      this.cursors = new Cursors();
      // icons (3x3): a pixel icon for every player, a coloured lock for the empty spots
      this.icons = this.slots.map((id, i) => {
        const o = { id, i, x: 450 + (i % 3) * 107, y: 120 + Math.floor(i / 3) * 127 + 300, f: 0, t: 0, anim: 'idle' };
        if (id) o.icon = pixelIcon((G.PLAYERS[id] && G.PLAYERS[id].icon) || id);
        if (!o.icon) { o.lock = new AS(CS + 'lock', 0, 0, { offX: 230, offY: 110, swf: true }); o.lock.layerTint = { color: LOCK_COLORS[i] }; o.lock.play('idle', true); }
        this.tw.to(o, { y: o.y - 300 }, 1, E.expoOut);
        return o;
      });
      this.cursorX = 0; this.cursorY = 0;
      this.setCursor(this.slots.indexOf(start) >= 0 ? this.slots.indexOf(start) : 4, true);
      this.curChar = start;
      this.grad = { y: 0 }; this.tw.to(this.grad, { y: -720 }, 1, E.expoOut);
      this.fade = 0; this.tw.to(this, { fade: 1 }, 0.8, E.quadOut);
      this.tw.to(this.camFollow, { y: H / 2 }, 1.5, E.expoOut, { onComplete: () => { this.autoFollow = true; } });
      this.allowInput = false; this.pressed = false; this.leaving = false; this.went = false;
      this.hold = { up: 0, down: 0, left: 0, right: 0 }; this.spamDirs = {};
      this.lastBeat = -1; this.lastStep = -1;
      this.flashA = 0;
      G.audio.music.stop(0.2);
      // the lights video the first time ever (IntroSubState), then the lights sound + a flash
      this.video = null; this.black = 1;
      const seen = G.save.charSelectSeen;
      const vid = !seen && G.A.raw['videos/videos/introSelect.mp4'];
      if (vid) {
        const v = document.createElement('video'); v.src = vid; v.muted = false; v.playsInline = true; v.preload = 'auto';
        v.onended = () => this.lightsOn(true); v.onerror = () => this.lightsOn(true);
        const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => this.lightsOn(true)); });
        this.video = v;
      } else this.lightsOn(false);
    },
    lightsOn(first) {
      if (this.video) { try { this.video.pause(); } catch (e) {} this.video = null; }
      this.black = 0;
      if (first) { this.flashA = 1; G.sfx('preload/sounds/CS_Lights.ogg'); }
      if (!G.save.charSelectSeen) { G.save.charSelectSeen = true; G.saveData(); }
      // stayFunky: the intro part once, then the loop
      const M = 'preload/music/stayFunky/stayFunky';
      const loop = () => { if (G.screen === this && !this.leaving) G.audio.music.play(M + '.ogg', { loop: true, bpm: 90, vol: 1, restart: true }); };
      if (G.A.has(M + '-intro.ogg')) G.audio.music.play(M + '-intro.ogg', { loop: false, bpm: 90, vol: 1, restart: true, onEnd: loop }); else loop();
      this.allowInput = true;
    },
    // grid index <-> cursor (-1..1, -1..1)
    setCursor(i, instant) {
      this.cursorX = (i % 3) - 1; this.cursorY = Math.floor(i / 3) - 1;
      if (instant) this.cursors.snapTo(this.cursorTarget());
    },
    selected() { return (this.cursorX + 1) + (this.cursorY + 1) * 3; },
    cursorTarget() { return { x: 110 * this.cursorX + W / 2 - this.cursors.w / 2 - 16, y: 110 * this.cursorY + H / 2 - this.cursors.h / 2 - 48 }; },
    // set_curChar: the old one slides out, the new one slides in on the next frame
    setChar(id) {
      if (this.curChar === id) return;
      this.curChar = id;
      if (id === 'locked') { if (!this.staticOn) { this.staticOn = true; G.audio.sfxLoop && G.audio.sfxLoop('static', 'preload/sounds/static loop.ogg', 0.6); } }
      else if (this.staticOn) { this.staticOn = false; G.audio.sfxLoop && G.audio.sfxLoop('static', null); }
      this.nametag.switchChar(id);
      this.gf.visible = false; this.chill.visible = false;
      this.chillOut.visible = true; this.chillOut.anim('slideout');
      this.swapPending = id;
    },
    move(dx, dy) {
      this.cursorX += dx; this.cursorY += dy;
      if (this.cursorX < -1) this.cursorX = 1; if (this.cursorX > 1) this.cursorX = -1;
      if (this.cursorY < -1) this.cursorY = 1; if (this.cursorY > 1) this.cursorY = -1;
      this.cursors.resetDeny();
      G.sfx('preload/sounds/CS_select.ogg', { vol: 0.7 });
    },
    accept() {
      const id = this.slots[this.selected()];
      if (!id) {
        this.chill.anim('cannot select Label'); G.sfx('preload/sounds/CS_locked.ogg');
        this.cursors.denied();
        const lk = this.icons[this.selected()].lock; if (lk) lk.play('clicked', true);
        return;
      }
      if (this.pressed) return;
      this.pressed = true;
      this.cursors.confirm();
      G.sfx('preload/sounds/CS_confirm.ogg');
      G.audio.music.setRate(0.1, 1); G.audio.music.setVolume(0, 1.5);
      this.chill.anim('select'); this.gf.anim('confirm', true);
      this.selTimer = this.tw.after(1.5, () => this.goToFreeplay(false));
    },
    deselect() {
      this.pressed = false;
      if (this.selTimer) { this.selTimer.dead = true; this.selTimer = null; }
      this.cursors.unconfirm();
      G.audio.music.setRate(1, 1); G.audio.music.setVolume(1, 1);
      this.chill.anim('deselect'); this.gf.anim('deselect');
      this.tw.after(1, () => { if (!this.pressed && (this.chill.current() === 'deselect loop start' || this.chill.current() === 'deselect')) { this.chill.anim('idle'); this.gf.anim('idle'); } });
    },
    goBack() {
      if (this.leaving) return;
      G.sfx('cancel'); G.audio.music.setVolume(0, 0.7);
      this.goToFreeplay(true);
    },
    goToFreeplay(back) {
      if (this.leaving) return;
      this.leaving = true; this.allowInput = false; this.autoFollow = false;
      if (this.staticOn) { this.staticOn = false; G.audio.sfxLoop && G.audio.sfxLoop('static', null); }
      const pick = back ? this.remembered : this.curChar;
      this.tw.to(this.cursors, { alpha: 0 }, 0.8, E.expoOut);
      this.tw.to(this.bar, { y: this.bar.y + 80 }, 0.8, E.fxBackIn);
      this.tw.to(this.nametag.mid, { y: this.nametag.mid.y + 80 }, 0.8, E.fxBackIn);
      this.tw.to(this.dBack, { y: this.dBack.y + 210 }, 0.8, E.fxBackIn);
      this.tw.to(this.choose, { y: this.choose.y + 200 }, 0.8, E.fxBackIn);
      this.tw.to(this.dBlur, { y: this.dBlur.y + 220 }, 0.8, E.fxBackIn);
      for (const o of this.icons) this.tw.to(o, { y: o.y + 300 }, 0.8, E.fxBackIn);
      this.tw.cancel(this.grad); this.tw.cancel(this); this.tw.cancel(this.camFollow);
      this.tw.to(this.grad, { y: -150 }, 0.8, E.fxBackIn);
      this.tw.to(this, { fade: 0 }, 0.8, E.quadIn);
      this.tw.to(this.camFollow, { y: this.camFollow.y - 150 }, 0.8, E.fxBackIn, {
        onComplete: () => {
          if (this.went) return; this.went = true;
          G.audio.music.stop(0);
          if (!back && pick && pick !== 'locked') { G.settings.player = pick; G.saveSettings(); }
          G.setScreen('freeplay', { fromCharSelect: true, rankMode: this.rankMode, character: G.settings.player }, { instant: true });
        },
      });
    },
    // ------------------------------------------------------------ input
    onAction(a, down, repeat) {
      const map = { ui_up: 'up', ui_down: 'down', ui_left: 'left', ui_right: 'right' };
      if (map[a]) { if (!down) { this.hold[map[a]] = 0; this.spamDirs[map[a]] = false; return true; } }
      if (!down || repeat) return false;
      if (this.video && (a === 'accept' || a === 'back')) { this.lightsOn(true); return true; }
      if (!this.allowInput) return false;
      if (this.pressed) { if (a === 'back') { this.deselect(); return true; } return false; }
      if (a === 'ui_up') this.move(0, -1);
      else if (a === 'ui_down') this.move(0, 1);
      else if (a === 'ui_left') this.move(-1, 0);
      else if (a === 'ui_right') this.move(1, 0);
      else if (a === 'accept') this.accept();
      else if (a === 'back') this.goBack();
      else return false;
      if (map[a]) this.hold[map[a]] = 0;
      return true;
    },
    onPointer(type, x, y) {
      if (type !== 'down') return;
      if (this.video) { this.lightsOn(true); return; }
      if (!this.allowInput) return;
      if (this.pressed) { this.deselect(); return; }
      for (const o of this.icons) {
        const hx = 450 + (o.i % 3) * 107 + 20, hy = 120 + Math.floor(o.i / 3) * 127 + 20;
        if (x >= hx && x < hx + 86 && y >= hy && y < hy + 86) {
          const cx = (o.i % 3) - 1, cy = Math.floor(o.i / 3) - 1;
          if (cx !== this.cursorX || cy !== this.cursorY) { this.cursorX = cx; this.cursorY = cy; this.cursors.resetDeny(); G.sfx('preload/sounds/CS_select.ogg', { vol: 0.7 }); }
          else this.accept();
          return;
        }
      }
      if (x > W * 0.65 && x < W * 0.65 + 300 && y > H * 0.2 && y < H * 0.2 + 500) this.accept();
      else if (x > W - 240 && y > H - 220) this.goBack();
    },
    // ------------------------------------------------------------ update
    update(dt) {
      this.tw.update(dt);
      if (this.video) return;
      this.flashA = Math.max(0, this.flashA - dt / 1);
      // beats + steps of stayFunky (90 bpm)
      const t = G.audio.music.time(), beat = Math.floor(t / (60000 / 90)), step = Math.floor(t / (15000 / 90));
      if (beat !== this.lastBeat) { this.lastBeat = beat; this.chill.beat(beat); this.gf.beat(beat); }
      if (step !== this.lastStep) { this.lastStep = step; this.spamStep(); }
      // holding a direction: after 0.5 s it repeats on every step of the music
      if (this.allowInput && !this.pressed) for (const [d, act] of [['up', 'ui_up'], ['down', 'ui_down'], ['left', 'ui_left'], ['right', 'ui_right']]) {
        if (G.input.isDown(act)) { this.hold[d] += dt; if (this.hold[d] >= 0.5) this.spamDirs[d] = true; } else { this.hold[d] = 0; this.spamDirs[d] = false; }
      }
      // what's under the cursor
      const id = this.slots[this.selected()];
      if (!this.leaving) this.setChar(id || 'locked');
      for (const s of [this.crowd, this.stageSpr, this.bar, this.speakers, this.gf, this.chill, this.chillOut]) s.update(dt);
      // slide out -> the new one slides in on the next frame
      if (this.swapPending && this.chillOut.current() === 'slideout' && (this.chillOut.custom ? this.chillOut.custom.fi > 0 : this.chillOut.fi > 0 || this.chillOut.finished)) {
        const nid = this.swapPending; this.swapPending = null;
        this.chill.visible = true; this.chill.switchChar(nid); this.gf.switchGF(nid); this.gf.visible = nid !== 'locked' && this.gf.path !== '';
        this.chillOut.once = [() => { this.chillOut.switchChar(nid, false); this.chillOut.visible = false; }];
        if (this.chillOut.custom) this.chillOut.custom.once = this.chillOut.once;
      }
      if (this.chillOut.visible && this.chillOut.isFinished() && this.chillOut.current() === 'slideout' && !this.swapPending) { this.chillOut.visible = false; }
      for (const s of [this.dBlur, this.dBack]) s.update(dt);
      this.nametag.update(dt);
      this.cursors.update(dt);
      for (const o of this.icons) {
        if (o.lock) {
          const sel = o.i === this.selected();
          const n = o.lock.name;
          if (sel && n === 'idle') o.lock.play('selected', true);
          else if (!sel && n !== 'idle') o.lock.play('idle', true);
          if (n === 'clicked' && o.lock.finished) o.lock.play('selected', true);
          if (n === 'selected' && o.lock.finished) o.lock.fi = o.lock.cur.len - 1;
          o.lock.update(dt);
        } else if (o.icon) {
          const sel = o.i === this.selected();
          const want = sel && this.pressed ? 'confirm' : 'idle';
          if (o.anim !== want) { o.anim = want; o.f = 0; o.t = 0; }
          o.t += dt; while (o.t >= 1 / 24) { o.t -= 1 / 24; o.f++; }
        }
      }
      // camera: follows the cursor a little (LOCKON, 0.01)
      if (this.autoFollow) { this.camFollow.x = W / 2 + this.cursorX * 10; this.camFollow.y = H / 2 + this.cursorY * 10; this.cam.follow(this.camFollow.x, this.camFollow.y); }
      else this.cam.focus(this.camFollow.x, this.camFollow.y);
      this.cam.update(dt);
      this.cursors.lerpTo(this.cursorTarget(), dt);
    },
    spamStep() {
      if (!this.allowInput || this.pressed) return;
      const d = this.spamDirs; if (!(d.up || d.down || d.left || d.right)) return;
      if (d.up) this.cursorY -= 1; if (d.down) this.cursorY += 1; if (d.left) this.cursorX -= 1; if (d.right) this.cursorX += 1;
      this.move(0, 0);
      for (const k in d) if (d[k]) this.hold[k] = 0.5;
    },
    leave() { this.tw && this.tw.clear(); if (this.video) { try { this.video.pause(); } catch (e) {} this.video = null; } if (this.staticOn) { this.staticOn = false; G.audio.sfxLoop && G.audio.sfxLoop('static', null); } },
    // ------------------------------------------------------------ draw
    draw(ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (this.video) {
        const v = this.video;
        if (v.readyState >= 2) { const s = Math.max(W / (v.videoWidth || W), H / (v.videoHeight || H)); const vw = (v.videoWidth || W) * s, vh = (v.videoHeight || H) * s; ctx.drawImage(v, (W - vw) / 2, (H - vh) / 2, vw, vh); }
        return;
      }
      const cam = this.cam;
      this.bg.draw(ctx, cam);
      this.crowd.draw(ctx, cam);
      this.stageSpr.draw(ctx, cam);
      this.curtains.draw(ctx, cam);
      this.bar.draw(ctx, cam);
      this.light.draw(ctx, cam); this.lightGF.draw(ctx, cam);
      this.gf.draw(ctx, cam); this.chillOut.draw(ctx, cam); this.chill.draw(ctx, cam);
      this.speakers.draw(ctx, cam);
      this.fgBlur.draw(ctx, cam);
      this.dBlur.draw(ctx, cam); this.dBack.draw(ctx, cam); this.choose.draw(ctx, cam);
      this.nametag.draw(ctx);
      this.cursors.draw(ctx);
      this.drawIcons(ctx);
      // the camera's blue fade (BlueFade shader: red + green go dark faster than blue)
      if (this.fade < 0.999) {
        const f = Math.max(0, this.fade);
        G.setScreenT(ctx); ctx.save(); ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgb(' + Math.round(255 * f * f) + ',' + Math.round(255 * f * f) + ',' + Math.round(255 * f) + ')'; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      // the transition gradient (freeplay's, flipped, sweeping up)
      const tg = G.A.image('preload/images/freeplay/transitionGradient.png');
      if (tg && this.grad.y > -720) { G.setScreenT(ctx); ctx.save(); ctx.translate(0, this.grad.y + 720); ctx.scale(1, -1); ctx.drawImage(tg, 0, 0, W, tg.height); ctx.restore(); }
      if (this.flashA > 0) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(255,255,255,' + this.flashA + ')'; ctx.fillRect(0, 0, W, H); }
    },
    drawIcons(ctx) {
      G.setScreenT(ctx);
      const sel = this.selected();
      for (const o of this.icons) {
        if (o.lock) { o.lock.x = o.x; o.lock.y = o.y; o.lock.draw(ctx, null); G.setScreenT(ctx); continue; }
        const ic = o.icon; if (!ic) continue;
        const list = (o.anim === 'confirm' && ic.confirm) || ic.idle;
        const f = list[Math.min(list.length - 1, o.f)];
        const cx = o.x + 64, cy = o.y + 64;
        if (o.i === sel) { const c = selectedLook(ic, f); ctx.drawImage(c, cx - c.width / 2 + 0, cy - c.height / 2 + 0); }
        else { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(cx, cy); ctx.scale(2, 2); ctx.translate(-f.fw / 2, -f.fh / 2); G.Sparrow.draw(ctx, ic.sheet, f); ctx.restore(); }
      }
    },
  };
})();
