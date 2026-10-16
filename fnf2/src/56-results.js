// FNF 2 - Results screen, rebuilt from the Funkin' engine's V-Slice ResultState (+ ResultScore,
// TallyCounter, ClearPercentCounter, Scoring ranks) with the real assets and timings.
(function () {
  const W = 1280, H = 720;
  const IMG = p => G.A.image('shared/images/resultScreen/' + p + '.png');
  const SP = p => G.Sparrow.load('shared/images/resultScreen/' + p);
  const E = G.ease;
  const NUMS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'DISABLED'];

  // ---------------------------------------------------------------- ranks (Scoring.calculateRank)
  const ORDER = ['SHIT', 'GOOD', 'GREAT', 'EXCELLENT', 'PERFECT', 'PERFECT_GOLD'];
  G.Rank = {
    completion(t) { if (!t || !t.totalNotes) return 0; return Math.max(0, Math.min(1, (t.sick + t.good - t.missed) / t.totalNotes)); },
    calc(t) {
      if (!t || !t.totalNotes) return null;
      if (t.sick === t.totalNotes) return 'PERFECT_GOLD';
      const c = this.completion(t);
      if (c >= 1) return 'PERFECT';
      if (c >= 0.9) return 'EXCELLENT';
      if (c >= 0.8) return 'GREAT';
      if (c >= 0.6) return 'GOOD';
      return 'SHIT';
    },
    value(r) { return r == null ? -1 : ORDER.indexOf(r); },
    better(a, b) { return this.value(a) > this.value(b); },
  };
  // save a song result: best score stays, the best rank/tallies stay (Save.applySongRank)
  G.submitResult = function (songKey, diff, rec) {
    const k = G.scoreKey(songKey, diff, 'bf');
    const old = G.save.scores[k];
    const rank = G.Rank.calc(rec.tallies), clear = G.Rank.completion(rec.tallies);
    const out = Object.assign({}, old || {});
    const newHigh = !old || rec.score > (old.score || 0);
    if (newHigh) Object.assign(out, { score: rec.score, acc: rec.acc, misses: rec.misses, fc: rec.fc });
    if (!old || G.Rank.better(rank, old.rank) || (rank === old.rank && clear > (old.clear || 0))) Object.assign(out, { tallies: rec.tallies, rank, clear });
    G.save.scores[k] = out; G.saveData();
    return newHigh;
  };
  const D = {   // per-rank timings (ScoringRank.get*Delay)
    music: { PERFECT_GOLD: 95, PERFECT: 95, EXCELLENT: 0, GREAT: 5, GOOD: 3, SHIT: 2 },
    bf: { PERFECT_GOLD: 95, PERFECT: 95, EXCELLENT: 97, GREAT: 95, GOOD: 95, SHIT: 95 },
    flash: { PERFECT_GOLD: 129, PERFECT: 129, EXCELLENT: 122, GREAT: 109, GOOD: 107, SHIT: 186 },
    hs: { PERFECT_GOLD: 140, PERFECT: 140, EXCELLENT: 140, GREAT: 129, GOOD: 127, SHIT: 207 },
  };
  const RANK_TEXT = { PERFECT_GOLD: 'PERFECT', PERFECT: 'PERFECT', EXCELLENT: 'EXCELLENT', GREAT: 'GREAT', GOOD: 'GOOD', SHIT: 'LOSS' };
  const RANK_ANIMS = { PERFECT_GOLD: 'perfectGold', PERFECT: 'perfect', EXCELLENT: 'excellent', GREAT: 'great', GOOD: 'good', SHIT: 'loss' };
  // a few result animations come from scripts in the real game
  const SCRIPTS = {
    BFBedPerfectResults: { asset: 'results-bf/resultsPERFECT/bed' },
    BFShitResults: { asset: 'results-bf/resultsSHIT' },
    PicoPerfectResults: { asset: 'results-pico/resultsPERFECT' },
    PicoGreatResults: { asset: 'results-pico/resultsGREAT', flashes: [['white', 10], ['black', 15]] },
    PicoGoodResults: { asset: 'results-pico/resultsGOOD', flashes: [['white small', 10], ['blacksmall', 15]], randomIntro: true },
  };

  // FlxSprite-style draw of one sparrow frame (or image) with scale around a centre
  function drawFrame(ctx, sheet, f, x, y, o) {
    o = o || {};
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.translate(x, y);
    if (o.sx && o.sx !== 1) { const ox = o.orX || 0, oy = o.orY || 0; ctx.translate(ox, oy); ctx.scale(o.sx, o.sy || o.sx); ctx.translate(-ox, -oy); }
    if (f) G.Sparrow.draw(ctx, sheet, f); else ctx.drawImage(sheet, 0, 0);
    ctx.restore();
  }
  // tint (multiply) a sparrow frame into a cached canvas
  function tintFrame(sheet, f, color) {
    return G.cached('rstint:' + sheet.base + f.name + color, f.fw, f.fh, c => { G.Sparrow.draw(c, sheet, f); c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, f.fw, f.fh); c.globalCompositeOperation = 'destination-in'; G.Sparrow.draw(c, sheet, f); });
  }
  function whiteFrame(sheet, f) {
    return G.cached('rswhite:' + sheet.base + f.name, f.fw, f.fh, c => { G.Sparrow.draw(c, sheet, f); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, f.fw, f.fh); });
  }
  // simple frame-animation player for a list of sparrow frames
  class Anim {
    constructor(sheet, frames, fps) { this.sheet = sheet; this.frames = frames || []; this.fps = fps || 24; this.f = 0; this.t = 0; this.playing = false; this.visible = false; this.loopFrom = null; this.onDone = null; }
    play(from) { this.f = from || 0; this.t = 0; this.playing = true; this.visible = true; }
    update(dt) {
      if (!this.playing) return;
      this.t += dt;
      while (this.t >= 1 / this.fps) {
        this.t -= 1 / this.fps;
        if (this.f < this.frames.length - 1) this.f++;
        else if (this.loopFrom != null) this.f = this.loopFrom;
        else { this.playing = false; if (this.onDone) this.onDone(); break; }
      }
    }
    frame() { return this.frames[Math.min(this.frames.length - 1, this.f)]; }
  }
  const sparrowAnim = (path, prefix, fps) => { const sh = SP(path); if (!sh) return null; const fr = prefix == null ? sh.frames.slice() : G.Sparrow.byPrefix(sh, prefix); return new Anim(sh, fr, fps); };

  // ---------------------------------------------------------------- song title in the "tardling" bitmap font
  const LETTERS = 'AaBbCcDdEeFfGgHhiIJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz:1234567890().-';
  function titleImage(text) {
    const img = IMG('tardlingSpritesheet');
    const cw = 49, ch = 61, step = cw - 15, cols = img ? Math.floor(img.width / cw) : 10;
    const w = Math.max(1, text.length * step + 15), h = ch;
    return G.cached('rstitle:' + text, w, h, c => {
      if (!img) return;
      let x = 0;
      for (const chr of text) {
        const i = LETTERS.indexOf(chr);
        if (i >= 0) c.drawImage(img, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch, x, 0, cw, ch);
        x += step;
      }
    });
  }
  // the black top bar: a black slab rotated -3.8 degrees (BitmapUtil.createResultsBar)
  function topBar() {
    const w = Math.ceil(W * 1.011), h = Math.ceil(w / 8.7);
    return G.cached('rstopbar', w, h, c => { c.beginPath(); c.rect(0, 0, w - 15, h); c.clip(); c.translate(-15, 0); c.rotate(-3.8 * Math.PI / 180); c.fillStyle = '#000'; c.fillRect(0, 0, w, h); });
  }

  // ---------------------------------------------------------------- ClearPercentCounter
  class ClearPct {
    constructor(x, y, start, small) {
      this.x = x; this.y = y; this.num = start; this.small = small; this.alpha = 1; this.flashOn = false; this.visible = true; this.clipX = null;
      this.text = IMG('clearPercent/clearPercentText' + (small ? 'Small' : ''));
    }
    draw(ctx) {
      if (!this.visible || this.alpha <= 0) return;
      ctx.save(); ctx.globalAlpha *= this.alpha;
      if (this.clipX != null) { ctx.beginPath(); ctx.rect(this.clipX, -2000, 4000, 4000); ctx.clip(); }
      if (this.text) ctx.drawImage(this.text, this.x + (this.small ? 40 : 0), this.y);
      const digits = String(Math.max(0, Math.round(this.num))).split('').map(Number);
      const off = digits.length === 1 ? 1 : digits.length === 3 ? -1 : 0;
      digits.forEach((d, ind) => {
        const di = ind + 1, variant = digits.length === 3 ? di >= 2 : di >= 1;
        const sh = SP('clearPercent/clearPercentNumber' + (this.small ? 'Small' : variant ? 'Right' : 'Left')); if (!sh) return;
        const f = G.Sparrow.byPrefix(sh, 'number ' + d + ' 0')[0]; if (!f) return;
        const size = this.small ? 32 : 72;
        const x = this.x + (ind + off) * size + (this.small ? -24 : 0), y = this.y + (ind + off) * (this.small ? -4 : 0) + (this.small ? 0 : 72);
        if (this.flashOn) ctx.drawImage(whiteFrame(sh, f), x, y); else drawFrame(ctx, sh, f, x, y);
      });
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- big score digits (ResultScore / ScoreNum)
  class ScoreDigit {
    constructor(x, y) { this.x = x; this.y = y; this.digit = 10; this.final = 10; this.anim = 'DISABLED'; this.f = 0; this.t = 0; this.glow = true; this.shuffle = null; }
    setDigit(v) {
      if (v >= 0 && NUMS[v] !== this.anim) { this.anim = NUMS[v]; this.f = this.glow ? 0 : 4; this.glow = false; this.t = 0; }
      this.digit = v;
    }
    setFinal(v) { this.anim = 'GONE'; this.f = 0; this.t = 0; this.final = v; }
    update(dt, tw) {
      this.t += dt; while (this.t >= 1 / 24) { this.t -= 1 / 24; this.f++; }
      const s = this.shuffle;
      if (s) {
        s.t += dt;
        while (s.t >= 1 / 24 && s.left > 0) { s.t -= 1 / 24; s.left--; let d = this.digit + 1; if (d > 9 || d < 0) d = 0; this.setDigit(d); if (s.left === 0) this.finish(tw); }
      }
    }
    finish(tw) {
      this.shuffle = null;
      const o = { v: 0 };
      tw.to(o, { v: this.final }, 23 / 24, E.quadOut, { onUpdate: () => this.setDigit(Math.floor(o.v)), onComplete: () => { this.setDigit(this.final); tw.after(this.finalDelay / 24, () => { this.f = 0; this.t = 0; }); } });
    }
    draw(ctx, sheet) {
      if (!sheet) return;
      const fr = G.Sparrow.byPrefix(sheet, this.anim === 'GONE' || this.anim === 'DISABLED' ? this.anim : this.anim + ' DIGITAL');
      const f = fr[Math.min(fr.length - 1, this.f)]; if (!f) return;
      drawFrame(ctx, sheet, f, this.x, this.y);
    }
  }

  // ---------------------------------------------------------------- the screen
  G.screens.results = {
    enter(p) {
      this.p = p = p || {};
      this.tw = new G.Tw();
      this.t = 0; this.busy = false;
      const st = p.stats || {};
      const T = this.tallies = st.tallies || this.toTallies(st);
      this.rank = G.Rank.calc(T) || 'SHIT';
      this.player = String(p.player || 'bf').startsWith('pico') ? 'pico' : 'bf';
      const pdata = (G.A.json('preload/data/players/' + this.player + '.json') || {}).results || {};
      this.musicName = (pdata.music || {})[this.rank] || 'resultsNORMAL';
      // characters for this rank (safe versions)
      this.chars = [];
      for (const ad of (pdata[RANK_ANIMS[this.rank]] || [])) {
        if (ad.filter && ad.filter !== 'both' && ad.filter !== 'safe') continue;
        const c = this.makeChar(ad); if (c) this.chars.push(c);
      }
      // static pieces
      this.soundSystem = sparrowAnim('soundSystem', 'sound system');
      this.resultsAnim = sparrowAnim('results', 'results instance 1');
      this.ratingsPopin = sparrowAnim('ratingsPopin', 'Categories');
      this.scorePopin = sparrowAnim('scorePopin', 'tally score');
      this.highscoreNew = sparrowAnim('highscoreNew', 'highscoreAnim0'); if (this.highscoreNew) this.highscoreNew.loopFrom = 16;
      this.diffImg = IMG('diff_' + (p.diff || 'normal')) || IMG('diff_normal');
      this.bar = topBar(); this.barY = -this.bar.height;
      this.bgFlash = { vis: false, a: 1 };
      this.rankBgA = 0; this.fadeA = 0;
      // song title + difficulty + small clear % slide in, then scroll diagonally
      this.title = titleImage(p.title || 'Song');
      this.ang = -4.4 * Math.PI / 180;
      this.speed = { x: -Math.cos(this.ang), y: -Math.sin(this.ang) };
      this.titleVis = false; this.moving = false;
      this.diff = { x: 555, y: 0 }; this.song = { x: 0, y: 0 };
      this.clearSmall = new ClearPct(W / 2 + 300, H / 2 - 100, 100, true); this.clearSmall.visible = false;
      this.clearTarget = Math.floor(G.Rank.completion(T) * 100);
      this.clearSmall.num = this.clearTarget;
      this.timerThenSongName(1.0, false);
      // score (10 digits; FlxSpriteGroup(35,305) + ScoreNum(35+65i, 305) -> 70+65i, 610)
      this.digits = []; for (let i = 0; i < 10; i++) this.digits.push(new ScoreDigit(70 + 65 * i, 610));
      this.scoreVis = false; this.setScore(Math.max(0, Math.round(st.score || 0)));
      // tallies
      const n = (v) => Math.max(0, Math.round(v || 0));
      const big = n(T.totalNotesHit) >= 1000 ? -30 : 0;
      this.tallyRows = [
        { x: 375 + big, y: 150, v: n(T.totalNotesHit) }, { x: 375 + big, y: 200, v: n(T.maxCombo) },
        { x: 230, y: 277, v: n(T.sick), c: '#89E59E' }, { x: 210, y: 331, v: n(T.good), c: '#89C9E5' }, { x: 190, y: 385, v: n(T.bad), c: '#E6CF8A' },
        { x: 220, y: 439, v: n(T.shit), c: '#E68C8A' }, { x: 260, y: 493, v: n(T.missed), c: '#C68AE6' },
      ].map(r => Object.assign(r, { cur: 0, vis: false }));
      this.rankRows = null; this.rankVert = null;
      this.clearBig = null;
      // ---- timeline
      const tw = this.tw, R = this.rank;
      tw.to(this, { barY: 0 }, 7 / 24, E.quartOut, { delay: 3 / 24, onComplete: () => { this.titleVis = true; } });
      tw.after(6 / 24, () => this.resultsAnim && this.resultsAnim.play());
      tw.after(8 / 24, () => this.soundSystem && this.soundSystem.play());
      tw.after(21 / 24, () => this.ratingsPopin && this.ratingsPopin.play());
      tw.after(36 / 24, () => this.scorePopin && this.scorePopin.play());
      tw.after(37 / 24, () => { this.scoreVis = true; this.animateScore(); this.startTally(); });
      this.tallyRows.forEach((r, i) => tw.after(0.3 * i + 1.2, () => { r.vis = true; tw.to(r, { cur: r.v }, 0.5, E.quartOut); }));
      tw.after(D.music[R] / 24, () => this.startMusic());
      tw.after(D.bf[R] / 24, () => this.afterTally());
      tw.after(D.flash[R] / 24, () => this.showRankText());
      tw.after(D.hs[R] / 24, () => { if (p.isNewHighscore && this.highscoreNew) this.highscoreNew.play(); });
      G.audio.music.stop(0);
    },
    // older play results only had our own tally names
    toTallies(st) {
      const t = st.tally || {};
      const sick = (t.killer || 0) + (t.sick || 0);
      const hit = sick + (t.good || 0) + (t.bad || 0) + (t.shit || 0);
      return { sick, good: t.good || 0, bad: t.bad || 0, shit: t.shit || 0, missed: t.miss != null ? t.miss : (st.misses || 0), maxCombo: st.maxCombo || 0, totalNotesHit: hit, totalNotes: st.totalNotes || (hit + (t.miss || 0)) };
    },
    makeChar(ad) {
      const off = ad.offsets || [0, 0];
      if (ad.renderType === 'sparrow') {
        const path = String(ad.assetPath || '').replace(/^shared:/, '').replace(/^resultScreen\//, '');
        const a = sparrowAnim(path, null); if (!a) return null;
        if (ad.loopFrame != null) a.onDone = () => a.play(ad.loopFrame);
        return { kind: 'sparrow', a, x: off[0], y: off[1], z: ad.zIndex || 500, delay: ad.delay || 0 };
      }
      const sc = SCRIPTS[ad.scriptClass] || {};
      const asset = sc.asset || String(ad.assetPath || '').replace(/^shared:/, '').replace(/^resultScreen\//, '');
      const s = new G.Sprite(off[0], off[1]).loadAtlas('shared/images/resultScreen/' + asset);
      if (!s.atlas) return null;
      for (const [name, k] of (sc.flashes || [])) G.Atlas.scaleElement(s.atlas, name, k, 500);
      s.scale.x = s.scale.y = ad.scale || 1;
      s.addAnim('', s.atlas.main.name, 24, false);
      for (const lab in s.atlas.labels) s.addAnim(lab, lab, 24, false);
      s.visible = false;
      const c = { kind: 'atlas', s, z: ad.zIndex || 500, delay: ad.delay || 0, start: ad.startFrameLabel || '', sound: ad.sound || '' };
      s.onFinish = (name) => {
        if (ad.looped === false) { s.paused = true; return; }
        if (sc.randomIntro && name === '') return;
        if (sc.randomIntro) { s.play('loop', true); s.cur.loop = true; return; }
        if (ad.loopFrameLabel) { s.play(ad.loopFrameLabel, true); if (s.cur) s.cur.loop = true; }
        else if (ad.loopFrame != null) { s.play('', true); s.fi = Math.min(ad.loopFrame, s.cur.n - 1); }
      };
      if (sc.randomIntro) c.random = true;
      return c;
    },
    setScore(v) {
      let n = Math.min(v, 9999999999), loop = this.digits.length - 1;
      this.scoreStart = 0;
      while (n > 0) { this.scoreStart++; this.digits[loop].setFinal(n % 10); n = Math.floor(n / 10); loop--; }
      while (loop > 0) { this.digits[loop].setDigit(10); this.digits[loop].anim = 'DISABLED'; loop--; }
    },
    animateScore() {
      const L = this.digits.length;
      for (let i = L - this.scoreStart; i < L; i++) {
        this.tw.after(Math.max(0, i - 1) / 24, () => {
          const d = this.digits[i];
          d.finalDelay = this.scoreStart - (i - 1);
          d.f = 0; d.t = 0; d.anim = NUMS[d.digit] || 'DISABLED';
          d.shuffle = { t: 0, left: Math.floor((41 / 24) / (1 / 24)) };
        });
      }
    },
    startTally() {
      this.bgFlash.vis = true; this.bgFlash.a = 1; this.tw.to(this.bgFlash, { a: 0 }, 5 / 24);
      const target = this.clearTarget;
      const c = this.clearBig = new ClearPct(W / 2 + 190, H / 2 - 70, Math.max(0, target - 36), false);
      let last = c.num;
      this.tw.to(c, { num: target }, 58 / 24, E.quartOut, {
        onUpdate: () => { c.num = Math.round(c.num); if (c.num !== last) { last = c.num; G.sfx('scroll'); } },
        onComplete: () => {
          G.sfx('confirm'); c.num = target; c.flashOn = true;
          this.tw.after(0.4, () => { c.flashOn = false; });
          this.tw.after(0.25, () => this.tw.to(c, { alpha: 0 }, 0.5, E.quartOut, { delay: 0.5 }));
        },
      });
    },
    showRankText() {
      this.bgFlash.vis = true; this.bgFlash.a = 1; this.tw.to(this.bgFlash, { a: 0 }, 14 / 24);
      const name = RANK_TEXT[this.rank];
      this.rankVert = { img: IMG('rankText/rankText' + name), y: 100, vy: 0, flickT: 6 / 24, t: 0 };
      this.tw.after(30 / 24, () => { if (this.rankVert) this.rankVert.vy = -80; });
      const hor = IMG('rankText/rankScroll' + name);
      this.rankRows = [];
      for (let i = 0; i < 12; i++) this.rankRows.push({ img: hor, x: W / 2 - 320, y: 50 + (135 * i / 2) + 10, vx: i % 2 === 0 ? -7 : 7 });
    },
    afterTally() {
      // small clear % next to the difficulty
      this.clearSmall.visible = true; this.clearSmall.flashOn = true;
      this.tw.after(0.4, () => { this.clearSmall.flashOn = false; });
      this.tw.after(2.5, () => { this.moving = true; });
      for (const c of this.chars) {
        this.tw.after(c.delay, () => {
          if (c.kind === 'sparrow') { c.a.play(); return; }
          c.s.visible = true;
          if (c.random) {
            const r = Math.random(), lab = r < 0.05 && c.s.anims['intro fat gf'] ? 'intro fat gf' : r < 0.25 && c.s.anims['intro cass'] ? 'intro cass' : 'intro';
            if (!c.s.play(lab, true)) c.s.play('', true);
          } else c.s.play(c.start, true);
          if (c.sound) G.sfx(String(c.sound).replace(/^shared:/, 'shared/sounds/') + '.ogg');
        });
      }
    },
    startMusic() {
      const n = this.musicName, base = 'shared/music/' + n + '/' + n;
      const bpmOf = id => { const m = G.A.json('shared/music/' + id + '/' + id + '-metadata.json'); return m && m.timeChanges ? m.timeChanges[0].bpm : 100; };
      if (G.A.has(base + '-intro.ogg')) G.audio.music.play(base + '-intro.ogg', { loop: false, bpm: bpmOf(n), vol: 1, restart: true, onEnd: () => { if (!this.busy && G.screen === this) G.audio.music.play(base + '.ogg', { loop: true, bpm: bpmOf(n), vol: 1, restart: true }); } });
      else G.audio.music.play(base + '.ogg', { loop: true, bpm: bpmOf(n), vol: 1, restart: true });
    },
    timerThenSongName(len, autoScroll) {
      this.moving = false;
      const d = this.diff, dh = this.diffImg ? this.diffImg.height : 58, barOff = this.bar.height - 148;
      d.x = 555; d.y = -dh;
      this.tw.cancel(d); this.tw.to(d, { y: 122 + barOff }, 0.5, E.expoOut, { delay: 0.8 });
      const cs = this.clearSmall;
      cs.x = d.x + (this.diffImg ? this.diffImg.width : 227) + 60; cs.y = -33;
      this.tw.cancel(cs); this.tw.to(cs, { y: 117 + barOff }, 0.5, E.expoOut, { delay: 0.85 });
      const s = this.song, tw = this.title.width, fum = -(tw * 0.5) * Math.sin(this.ang) - 10;
      s.y = -this.title.height; s.x = cs.x + 94;
      this.tw.cancel(s); this.tw.to(s, { y: (122 - 25 - fum) + barOff }, 0.5, E.expoOut, { delay: 0.9 });
      this.tw.after(len, () => {
        const target = { x: -Math.cos(this.ang), y: -Math.sin(this.ang) };
        this.speed = { x: 0, y: 0 };
        this.tw.to(this.speed, target, 0.7, E.quadIn);
        this.moving = autoScroll;
      });
    },
    // ------------------------------------------------------------ input
    onAction(a, down) { if (down && (a === 'accept' || a === 'pause')) this.exit(); },
    onPointer(type) { if (type === 'down') this.exit(); },
    exit() {
      if (this.busy) return;
      this.busy = true;
      // the music speeds up then slows down while fading out
      G.audio.music.setVolume(0, 0.8);
      G.audio.music.setRate(3, 0.1); this.tw.after(0.1, () => G.audio.music.setRate(0.5, 0.4));
      this.tw.after(0.8, () => G.audio.music.stop(0));
      const p = this.p;
      const go = () => {
        const inst = { instant: !!G.stickers };
        if (p.mode === 'story') G.setScreen('storyMenu', {}, inst);
        else {
          const better = !p.cheated && G.Rank.better(this.rank, p.prevRank);
          G.setScreen('freeplay', { fromResults: true, rank: this.rank, oldRank: p.prevRank || null, songId: p.song, diff: p.diff, variation: p.variation, playRankAnim: better }, inst);
        }
      };
      if (G.stickers) G.stickers.cover(this.player, go); else go();
    },
    // ------------------------------------------------------------ update/draw
    update(dt) {
      this.t += dt;
      this.tw.update(dt);
      for (const a of [this.soundSystem, this.resultsAnim, this.ratingsPopin, this.scorePopin, this.highscoreNew]) if (a) a.update(dt);
      for (const c of this.chars) { if (c.kind === 'sparrow') c.a.update(dt); else c.s.update(dt); }
      for (const d of this.digits) d.update(dt, this.tw);
      if (this.rankRows) for (const r of this.rankRows) r.x += r.vx * dt;
      if (this.rankVert) { const v = this.rankVert; v.t += dt; v.y += v.vy * dt; }
      if (this.moving) {
        const sx = this.speed.x * 60 * dt, sy = this.speed.y * 60 * dt;
        for (const o of [this.song, this.diff, this.clearSmall]) { o.x += sx; o.y += sy; }
        if (this.song.x + this.title.width < 100) this.timerThenSongName(3.0, true);
      }
    },
    draw(ctx) {
      G.setScreenT(ctx);
      // background gradient
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FECC5C'); g.addColorStop(1, '#FDC05C');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // rank text rows (their own camera, tilted -3.8 degrees)
      if (this.rankRows) {
        ctx.save(); ctx.rotate(-3.8 * Math.PI / 180);
        for (const r of this.rankRows) {
          if (!r.img) continue;
          const step = r.img.width + 10; let x0 = r.x % step; if (x0 > 0) x0 -= step;
          for (let x = x0 - step; x < W * 1.2; x += step) ctx.drawImage(r.img, Math.round(x), Math.round(r.y));
        }
        ctx.restore();
      }
      G.setScreenT(ctx);
      const list = [];
      list.push({ z: 20, d: () => { if (this.bgFlash.vis && this.bgFlash.a > 0) { const f = ctx.createLinearGradient(0, 0, 0, H); f.addColorStop(0, '#FFF1A6'); f.addColorStop(1, '#FFF1BE'); ctx.globalAlpha = this.bgFlash.a; ctx.fillStyle = f; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; } } });
      if (this.clearBig) list.push({ z: 450, d: () => this.clearBig.draw(ctx) });
      for (const c of this.chars) list.push({ z: c.z, d: () => {
        if (c.kind === 'sparrow') { if (c.a.visible) { const f = c.a.frame(); if (f) drawFrame(ctx, c.a.sheet, f, c.x, c.y); } }
        else if (c.s.visible) { c.s.draw(ctx, null); G.setScreenT(ctx); }
      } });
      if (this.rankVert && this.rankVert.img) list.push({ z: 990, d: () => {
        const v = this.rankVert;
        if (v.t < v.flickT && Math.floor(v.t / (2 / 24)) % 2 === 1) return;
        const step = v.img.height + 30; let y0 = v.y % step; if (y0 > 0) y0 -= step;
        for (let y = y0; y < H; y += step) ctx.drawImage(v.img, W - 44, Math.round(y));
      } });
      list.push({ z: 1000, d: () => {
        // difficulty + small clear % + song title, cut off on the left like the real mask
        if (this.diffImg) { ctx.save(); ctx.beginPath(); ctx.rect(525, -100, W, H); ctx.clip(); ctx.drawImage(this.diffImg, Math.round(this.diff.x), Math.round(this.diff.y)); ctx.restore(); }
        this.clearSmall.clipX = 520; this.clearSmall.draw(ctx);
        if (this.titleVis) {
          const s = this.song, img = this.title;
          ctx.save(); ctx.beginPath(); ctx.rect(Math.max(520, s.x), -200, W * 2, H); ctx.clip();
          ctx.translate(s.x + img.width / 2, s.y + img.height / 2); ctx.rotate(this.ang); ctx.drawImage(img, -img.width / 2, -img.height / 2);
          ctx.restore();
        }
      } });
      list.push({ z: 1010, d: () => ctx.drawImage(this.bar, 0, Math.round(this.barY)) });
      const anim = (a, x, y) => { if (a && a.visible) { const f = a.frame(); if (f) drawFrame(ctx, a.sheet, f, x, y); } };
      list.push({ z: 1100, d: () => anim(this.soundSystem, -15, -180) });
      list.push({ z: 1200, d: () => {
        anim(this.resultsAnim, W - 1480, -10);
        anim(this.ratingsPopin, -135, 135);
        anim(this.scorePopin, -180, 515);
        anim(this.highscoreNew, 44, 557);
        // tallies
        const sh = SP('tallieNumber');
        if (sh) for (const r of this.tallyRows) {
          if (!r.vis) continue;
          const str = String(Math.round(r.cur));
          for (let i = 0; i < str.length; i++) {
            const f = G.Sparrow.byPrefix(sh, str[i] + ' small')[0]; if (!f) continue;
            const img = r.c ? tintFrame(sh, f, r.c) : null;
            if (img) ctx.drawImage(img, r.x + i * 43, r.y); else drawFrame(ctx, sh, f, r.x + i * 43, r.y);
          }
        }
        if (this.scoreVis) { const sh2 = SP('score-digital-numbers'); for (const d of this.digits) d.draw(ctx, sh2); }
      } });
      list.sort((a, b) => a.z - b.z);
      for (const it of list) { G.setScreenT(ctx); it.d(); }
      G.setScreenT(ctx);
      if (this.fadeA > 0) { ctx.fillStyle = 'rgba(0,0,0,' + this.fadeA + ')'; ctx.fillRect(0, 0, W, H); }
    },
    leave() { if (this.tw) this.tw.clear(); },
  };
})();
