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
  // new players FNF never drew character-select art for: they chill with their REAL gameplay animations
  // (real = the gameplay character, flip = face left like BF, select = what they do when picked)
  const real = (id, o) => Object.assign({ id, makeChill: () => new RealChill(id, o.real) }, o);
  // real: the gameplay character + what it does: select (picked), win / lose (after a rank), hey (to the character
  // select), die / retry (game over), results per rank; dj = its freeplay spot. freeplay = its backing card.
  Object.assign(G.PLAYERS, {
    darnell: real('darnell', { name: 'Darnell', pos: 5, nametag: 'darnell', icon: 'darnell', gf: { asset: CS + 'neneChill', viz: true },
      real: { char: 'darnell', flip: true, scale: 0.7, select: 'lightCan', win: 'laugh', lose: 'pissed', hey: 'kickCan', die: 'pissed', retry: 'laugh', dj: { x: 196, y: 708, k: 0.78 } },
      freeplay: { text1: 'DARNELL', text2: 'LIGHT IT UP AND KICK IT BACK', text3: 'WATCH YOUR HEAD', colors: ['#DCD0FF', '#B49CFF', '#F1EAFF', '#6F4BD8', '#FFFFFF', '#4B2FA8', '#8A63E8', '#7A55E0'] } }),
    nene: real('nene', { name: 'Nene', pos: 1, nametag: 'nene', icon: 'nene', gf: { asset: CS + 'gfChill', viz: false },
      real: { char: 'nene', flip: false, scale: 0.62, select: 'combo50', win: 'combo200', lose: 'raiseKnife', hey: 'combo50', die: 'raiseKnife', retry: 'combo50', dj: { x: 190, y: 712, k: 0.48 } },
      freeplay: { text1: 'NENE', text2: 'CUTE BUT SHE BRINGS A KNIFE', text3: 'DO NOT TOUCH HER A-BOT', colors: ['#FFD4E9', '#FF9CC8', '#FFF0F7', '#E8418A', '#FFFFFF', '#C02468', '#FF5FA2', '#F04C93'] } }),
    tankman: real('tankman', { name: 'Tankman', pos: 7, nametag: 'tankman', icon: 'tankman', gf: { asset: CS + 'gfChill', viz: false },
      real: { char: 'tankman', flip: true, scale: 0.62, select: 'hehPrettyGood', win: 'laugh', lose: 'ugh', hey: 'beat it', die: 'augh', retry: 'hehPrettyGood', dj: { x: 196, y: 708, k: 0.7 } },
      freeplay: { text1: 'TANKMAN', text2: 'HEH, PRETTY GOOD', text3: 'UGH', colors: ['#E3EACB', '#BCC97E', '#F6F8E6', '#5C6B22', '#FFFFFF', '#3E4A12', '#8C9E42', '#7D8F38'] } }),
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

  // ---------------------------------------------------------------- new players: a gameplay character as a "figure"
  // (character select, freeplay DJ spot, results). Drawn scaled around the bottom-middle of what it really draws.
  // the box of what a character really draws on its current frame (scale 1), in its own space
  function visBox(ch) {
    const a = ch.cur; if (!a || a.kind !== 'atlas') return null;
    const b = G.Atlas.bounds(a.atlas, a.tl), r = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    G.Atlas.boundsFrame(a.atlas, a.tl, a.frames[ch.fi] != null ? a.frames[ch.fi] : a.frames[0], [1, 0, 0, 1, 0, 0], r);
    if (r.x1 < r.x0) return null;
    let sx = ch.x - ch.offset.x, sy = ch.y - ch.offset.y;
    if (ch.useAnimOffsets) { sx -= (ch._ao[0] - ch.globalOffsets[0]) * ch.scale.x; sy -= (ch._ao[1] - ch.globalOffsets[1]) * ch.scale.y; }
    const mid = (r.x0 + r.x1) / 2 - b.x;
    return { cx: ch.flipX ? sx + ch.frameW - mid : sx + mid, bottom: sy + r.y1 - b.y, top: sy + r.y0 - b.y };
  }
  class RealFig {
    constructor(R) {
      this.R = R;
      const ch = this.ch = new G.Character(R.char, 'bf');
      ch.flipX = !!R.flip;
      ch.place([0, 0], 1);
      // extra sprites the character's script adds (Nene's A-Bot speaker + its eyes + visualizer)
      this.extras = [];
      const stage = { addExtra: (s, owner) => { s.owner = owner; this.extras.push(s); } };
      if (ch.script && ch.script.attach) ch.script.attach(ch, stage);
      if (ch.nene) ch.nene.an = G.audio && G.audio.musicAnalyser;   // the A-Bot bars dance to the menu music
      this.list = [ch].concat(this.extras).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      // where they stand: the bottom-middle of their idle drawing (an atlas' timeline box is often much bigger
      // than the character), or of the big thing they sit on (Nene's A-Bot)
      const box = visBox(ch);
      this.cx = box ? box.cx : 0; this.floor = box ? box.bottom : 0; this.top = box ? box.top : -400;
      for (const e of this.extras) if (e.atlas) { const b = G.Atlas.bounds(e.atlas); if (e.y + b.h > this.floor) { this.floor = e.y + b.h; this.cx = e.x + b.w / 2; } }
      this.at = { cam: null, x: 0, y: 0, k: 1, stretch: 1 };
      this.pcam = { apply: (ctx, sfx, sfy) => {
        const a = this.at;
        if (a.cam) a.cam.apply(ctx, sfx, sfy); else G.setScreenT(ctx);
        ctx.translate(a.x, a.y); ctx.scale(a.k * a.stretch, a.k); ctx.translate(-this.cx, -this.floor);
      } };
    }
    // a one-off animation (held on its last frame) or back to dancing
    anim(name) { const ch = this.ch; ch._locked = false; const ok = !!name && ch.playAnim(name, true); if (ok) ch._locked = true; else ch.dance(true); return ok; }
    dance() { this.ch._locked = false; this.ch.dance(true); }
    get finished() { return this.ch.finished; }
    update(dt, stepSec) { this.ch.tick(dt, stepSec || 0.15, false); }
    // smear = [stretch, direction]: stretched + see-through copies trailing behind (fast slides)
    draw(ctx, cam, x, y, k, smear) {
      const a = this.at; a.cam = cam; a.y = y; a.k = k; a.stretch = 1;
      for (const s of this.list) {
        if (smear && smear[0] > 1.01) {
          a.stretch = smear[0];
          for (let g = 2; g >= 1; g--) { a.x = x + smear[1] * g * 40; s.alpha = 0.22; s.draw(ctx, this.pcam); }
          a.x = x; s.alpha = 0.85; s.draw(ctx, this.pcam); s.alpha = 1; a.stretch = 1;
        } else { a.x = x; s.draw(ctx, this.pcam); }
      }
    }
  }
  G.RealFig = RealFig;
  G.visBox = visBox;
  G.realPlayer = id => { const P = G.PLAYERS[id]; return P && P.real ? P : null; };

  // ---------------------------------------------------------------- character select: chilling on the right
  // The slide in / out copy bfChill's frames (24 fps): in from the right with a smear, a little overshoot, settle;
  // out = a step left, then smeared off. [screen px, smear stretch]
  const SLIDE_IN = [[321, 1.75], [167, 1.4], [-24, 1], [-24, 1], [-3, 1], [-3, 1], [-5, 1], [-5, 1]];
  const SLIDE_OUT = [[-23, 1], [-71, 1.7]];
  const FEET = { x: 955, y: 612 };             // where BF + Pico stand
  class RealChill {
    constructor(id, R) {
      this.id = id; this.R = R; this.fig = new RealFig(R);
      this.name = null; this.fi = 0; this.t = 0; this.finished = true; this.once = []; this.visible = true;
    }
    play(n) {
      this.name = n; this.fi = 0; this.t = 0; this.finished = false; this.visible = true;
      if (n === 'select') this.fig.anim(this.R.select); else this.fig.dance();
      return true;
    }
    update(dt) {
      this.t += dt;
      while (this.t >= 1 / 24) {
        this.t -= 1 / 24; this.fi++;
        if (this.name === 'slidein' && this.fi >= SLIDE_IN.length) { this.name = 'idle'; this.fi = 0; }
        if (this.name === 'slideout' && this.fi >= SLIDE_OUT.length && !this.finished) {
          this.fi = SLIDE_OUT.length - 1; this.finished = true; this.visible = false;
          const once = this.once.splice(0); for (const f of once) f('slideout');
        }
      }
      this.fig.update(dt, 15 / 90);
      // idle / select / deselect are "finished" when the character's animation is
      if (this.name !== 'slidein' && this.name !== 'slideout') this.finished = this.fig.finished;
    }
    draw(ctx, cam) {
      if (!this.visible) return;
      const slide = this.name === 'slidein' ? SLIDE_IN[Math.min(this.fi, SLIDE_IN.length - 1)] : this.name === 'slideout' ? SLIDE_OUT[Math.min(this.fi, SLIDE_OUT.length - 1)] : null;
      this.fig.draw(ctx, cam, FEET.x + (slide ? slide[0] : 0) + (this.R.dx || 0), FEET.y + (this.R.dy || 0), this.R.scale || 0.7,
        slide ? [slide[1], this.name === 'slidein' ? 1 : -1] : null);
    }
  }

  // ---------------------------------------------------------------- freeplay: the DJ spot (FreeplayDJ stand-in)
  // Same jobs as the real DJs: intro (pops up from the bottom), idle (bops on the menu music's beat), confirm,
  // fist pump / loss after a new rank, the jump to the character select.
  class RealDJ {
    constructor(id) {
      const P = G.PLAYERS[id]; this.P = P; this.R = P.real; this.fig = new RealFig(P.real);
      const D = this.D = Object.assign({ x: 200, y: 706, k: (P.real.scale || 0.7) * 1.1 }, P.real.dj || {});
      this.data = { charSelect: { transitionDelay: 0.3 } };
      this.cur = true; this.name = ''; this.finished = false; this.onIntroDone = null; this.lastBeat = -1; this.introT = 0; this.rise = 0;
      this.play('intro');
    }
    has(n) { return ['intro', 'idle', 'confirm', 'fistPump', 'loss', 'charSelect'].includes(n); }
    play(name) {
      this.name = name; this.finished = false; this.pumpIntro = false;
      const R = this.R;
      if (name === 'intro') { this.introT = 0; this.rise = 1; this.fig.dance(); }
      else if (name === 'idle') this.fig.dance();
      else if (name === 'confirm') this.fig.anim(R.select);
      else if (name === 'fistPump') this.fig.anim(R.win || R.select);
      else if (name === 'loss') this.fig.anim(R.lose);
      else if (name === 'charSelect') this.fig.anim(R.hey || R.select);
      return true;
    }
    update(dt) {
      if (this.name === 'intro') {
        this.introT += dt;
        const k = Math.min(1, this.introT / 0.42);
        this.rise = 1 - G.ease.backOut(k);
        if (k >= 1) { this.rise = 0; this.play('idle'); const f = this.onIntroDone; this.onIntroDone = null; if (f) f(); }
      }
      // bops on the beat of whatever is playing (like the real DJs' idles)
      const M = G.audio.music.current(), bpm = (M && M.bpm) || 102, b = Math.floor(G.audio.music.time() / (60000 / bpm));
      if (b !== this.lastBeat) { this.lastBeat = b; if ((this.name === 'idle' || this.name === 'intro' || this.pumpIntro) && (this.fig.finished || !this.fig.ch._locked)) this.fig.dance(); }
      this.fig.update(dt, 15 / bpm);
      if ((this.name === 'fistPump' || this.name === 'loss') && this.fig.finished && !this.finished) { this.finished = true; this.tw = 0.6; }
      if (this.tw != null) { this.tw -= dt; if (this.tw <= 0) { this.tw = null; this.play('idle'); } }
    }
    // results -> freeplay: bop while the rank comes in, then celebrate (or sulk)
    fistPumpIntro(bad) { this.name = 'idle'; this.pumpIntro = true; this.fig.dance(); }
    fistPump(bad) { this.play(bad ? 'loss' : 'fistPump'); }
    draw(ctx) {
      const D = this.D;
      this.fig.draw(ctx, null, D.x, D.y + this.rise * 460, D.k, null);
    }
  }
  G.RealDJ = RealDJ;

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
