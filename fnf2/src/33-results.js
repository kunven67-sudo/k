// FNF 2 - results screen, rebuilt from FNF's ResultState with its real art:
// "RESULTS" header, tally counters, shuffling score digits, clear % counter,
// scrolling rank text, the sound system, the player's rank reaction + rank music.
(function () {
  const R = 1 / 24;
  // rank logic (Scoring.calculateRank)
  function rankOf(t) {
    if (!t.totalNotes) return 'SHIT';
    if (t.sick === t.totalNotes) return 'PERFECT_GOLD';
    const c = G.clamp((t.sick + t.good - t.missed) / t.totalNotes, 0, 1);
    if (c >= 1) return 'PERFECT'; if (c >= 0.9) return 'EXCELLENT'; if (c >= 0.8) return 'GREAT'; if (c >= 0.6) return 'GOOD'; return 'SHIT';
  }
  const DELAY = {
    music: { PERFECT_GOLD: 95, PERFECT: 95, EXCELLENT: 0, GREAT: 5, GOOD: 3, SHIT: 2 },
    bf: { PERFECT_GOLD: 95, PERFECT: 95, EXCELLENT: 97, GREAT: 95, GOOD: 95, SHIT: 95 },
    flash: { PERFECT_GOLD: 129, PERFECT: 129, EXCELLENT: 122, GREAT: 109, GOOD: 107, SHIT: 186 },
    high: { PERFECT_GOLD: 140, PERFECT: 140, EXCELLENT: 140, GREAT: 129, GOOD: 127, SHIT: 207 },
  };
  const RANK_TEXT = { PERFECT_GOLD: 'PERFECT', PERFECT: 'PERFECT', EXCELLENT: 'EXCELLENT', GREAT: 'GREAT', GOOD: 'GOOD', SHIT: 'LOSS' };
  const RANK_KEY = { PERFECT_GOLD: 'perfectGold', PERFECT: 'perfect', EXCELLENT: 'excellent', GREAT: 'great', GOOD: 'good', SHIT: 'loss' };
  // scripted rank animations -> the atlas they load
  const SCRIPT_ATLAS = {
    BFShitResults: 'shared/images/resultScreen/results-bf/resultsSHIT', BFBedPerfectResults: 'shared/images/resultScreen/results-bf/resultsPERFECT/bed',
    PicoPerfectResults: 'shared/images/resultScreen/results-pico/resultsPERFECT', PicoGreatResults: 'shared/images/resultScreen/results-pico/resultsGREAT',
    PicoGoodResults: 'shared/images/resultScreen/results-pico/resultsGOOD',
  };
  const RS = 'shared/images/resultScreen/';
  // a white image tinted by a colour (FlxSprite.color = multiply), cached
  const tintCache = new Map();
  function tinted(img, color) {
    const k = img.src.length + '|' + color + '|' + img.width;
    if (tintCache.has(k)) return tintCache.get(k);
    const c = G.makeCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
    tintCache.set(k, c); return c;
  }
  const sparrowSpr = (path, x, y) => new G.Sprite(x, y).loadSparrow(RS + path);
  // FunkinSprite.scaleElement: grow the first element of a symbol (scale is ADDED to a/d) and shift it back by the offset
  function scaleElement(atlas, symbol, scale, offset) {
    const tl = atlas.symbols[symbol]; if (!tl || tl._scaled) return;
    for (const L of tl.layers) {
      const k = L.at[0]; if (k == null || k < 0) continue;
      const e = L.frames[k].els[0]; if (!e) continue;
      e.m = e.m.slice(); e.m[0] += scale; e.m[3] += scale; e.m[4] -= offset; e.m[5] -= offset;
      tl._scaled = true; return;
    }
  }

  G.screens.results = {
    enter(p) {
      this.p = p || {};
      const st = this.p.stats || { tally: {}, score: 0, maxCombo: 0, totalNotes: 0 };
      const T = st.tally || {};
      this.t = 0; this.timers = []; this.tweens = [];
      this.tal = { sick: (T.sick || 0) + (T.killer || 0), good: T.good || 0, bad: T.bad || 0, shit: T.shit || 0, missed: T.miss || 0, totalNotes: st.totalNotes || 0, maxCombo: st.maxCombo || 0 };
      this.tal.hit = this.tal.sick + this.tal.good + this.tal.bad + this.tal.shit;
      this.rank = rankOf(this.tal);
      this.clearTarget = this.tal.totalNotes ? Math.floor(G.clamp((this.tal.sick + this.tal.good - this.tal.missed) / this.tal.totalNotes, 0, 1) * 100) : 0;
      this.player = (this.p.player || 'bf').startsWith('pico') ? 'pico' : 'bf';
      this.newBest = !!this.p.newBest;
      G.audio.music.stop(0);
      const at = (sec, fn) => this.timers.push({ t: sec, fn });
      // --- sprites
      this.sound = sparrowSpr('soundSystem', -15, -180); this.sound.addAnim('idle', 'sound system', 24, false); this.sound.visible = false;
      at(8 * R, () => { this.sound.visible = true; this.sound.play('idle'); });
      this.header = sparrowSpr('results', G.W - 1480, -10); this.header.addAnim('result', 'results instance 1', 24, false); this.header.visible = false;
      at(6 * R, () => { this.header.visible = true; this.header.play('result'); });
      this.cats = sparrowSpr('ratingsPopin', -135, 135); this.cats.addAnim('idle', 'Categories', 24, false); this.cats.visible = false;
      at(21 * R, () => { this.cats.visible = true; this.cats.play('idle'); });
      this.scorePop = sparrowSpr('scorePopin', -180, 515); this.scorePop.addAnim('score', 'tally score', 24, false); this.scorePop.visible = false;
      at(36 * R, () => { this.scorePop.visible = true; this.scorePop.play('score'); });
      this.high = sparrowSpr('highscoreNew', 44, 557); this.high.addAnim('new', 'highscoreAnim0', 24, false); this.high.visible = false;
      this.high.onFinish = () => { this.high.play('new', true); this.high.fi = Math.min(16, this.high.cur.n - 1); };
      at(DELAY.high[this.rank] * R, () => { if (this.newBest) { this.high.visible = true; this.high.play('new'); } });
      // score: 10 digital digits (ResultScore is a sprite group, so FNF adds its x/y twice: 70 + 65i, 610)
      this.scoreDigits = []; const sc = String(Math.min(9999999999, Math.max(0, Math.round(st.score || 0))));
      for (let i = 0; i < 10; i++) {
        const d = sparrowSpr('score-digital-numbers', 70 + 65 * i, 610);
        for (const [n, name] of ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'].entries()) d.addAnim(String(n), name + ' DIGITAL', 24, false);
        d.addAnim('off', 'DISABLED', 24, false); d.addAnim('gone', 'GONE', 24, false);
        const idx = i - (10 - sc.length);
        d.final = idx >= 0 ? +sc[idx] : -1; d.play(d.final >= 0 ? 'gone' : 'off'); d.updateHitbox();
        d.digit = -1; d.glow = true; d.visible = false;
        this.scoreDigits.push(d);
      }
      const setDigit = (d, v) => { if (v === d.digit) return; d.digit = v; d.play(String(v), true); if (!d.glow) d.fi = Math.min(4, d.cur ? d.cur.n - 1 : 0); d.glow = false; };
      this.setDigit = setDigit;
      at(37 * R, () => {
        this.scoreDigits.forEach(d => { d.visible = true; });
        const first = 10 - sc.length;
        for (let i = first; i < 10; i++) {
          const d = this.scoreDigits[i];
          // each digit starts one frame after the last, counts 0-9 for 41 frames, then eases to its real number
          this.timers.push({ t: this.t + (i - 1) * R, fn: () => { d.glow = true; setDigit(d, 0); d.shuf = 0; d.shufT = 0; d.finalDelay = sc.length - (i - 1); } });
        }
        this.startTally();
      });
      // tally counters (hit + combo, then the colour-coded ratings)
      const T5 = (y) => y;
      this.tallies = [
        { x: 375, y: 150, n: this.tal.hit, c: null }, { x: 375, y: 200, n: this.tal.maxCombo, c: null },
        { x: 230, y: T5(277), n: this.tal.sick, c: '#89E59E' }, { x: 210, y: 331, n: this.tal.good, c: '#89C9E5' },
        { x: 190, y: 385, n: this.tal.bad, c: '#E6CF8A' }, { x: 220, y: 439, n: this.tal.shit, c: '#E68C8A' }, { x: 260, y: 493, n: this.tal.missed, c: '#C68AE6' },
      ];
      if (this.tal.hit >= 1000) { this.tallies[0].x -= 30; this.tallies[1].x -= 30; }
      this.tallies.forEach((tl, i) => { tl.cur = 0; tl.visible = false; at(0.3 * i + 1.2, () => { tl.visible = true; this.tween(tl, 'cur', 0, tl.n, 0.5, G.ease.quartOut || (x => 1 - Math.pow(1 - x, 4))); }); });
      this.digitSheet = G.Sparrow.load(RS + 'tallieNumber');
      // top bar + difficulty + song name + small clear %
      this.barY = -149; this.tween(this, 'barY', -149, 0, 7 * R, x => 1 - Math.pow(1 - x, 4), 3 * R);
      this.diffImg = G.A.image(RS + 'diff_' + (this.p.diff || 'normal') + '.png');
      this.songW = Math.max(1, String(this.p.title || '').length) * 34 + 15;
      const ang = -4.4 * Math.PI / 180;
      this.info = { moving: false, k: 1, sx: -Math.cos(ang), sy: -Math.sin(ang) };
      this.songInfoIn(1.0, false);
      this.showSmall = false; this.songVisible = false; at(10 * R, () => { this.songVisible = true; });
      // rank effects
      this.bgFlash = 0; this.rankText = false;
      at(DELAY.bf[this.rank] * R, () => this.afterTally());
      at(DELAY.flash[this.rank] * R, () => this.displayRankText());
      at(DELAY.music[this.rank] * R, () => this.playMusic());
      this.chars = this.buildChars();
      this.leaving = false; this.went = false; this.leaveT = 0;
    },
    tween(obj, prop, from, to, dur, ease, delay) { this.tweens.push({ obj, prop, from, to, dur, ease: ease || (x => x), start: this.t + (delay || 0) }); obj[prop] = from; },
    // ---- difficulty + small clear % + song name drop in under the bar, then drift along it (timerThenSongName)
    songInfoIn(wait, autoScroll) {
      const I = this.info; I.moving = false;
      const dh = this.diffImg ? this.diffImg.height : 80, dw = this.diffImg ? this.diffImg.width : 150;
      this.diffX = 555; this.tween(this, 'diffY', -dh, 122 + 1, 0.5, G.ease.expoOut, 0.8);
      this.smallX = this.diffX + dw + 60; this.tween(this, 'smallY', -40, 117 + 1, 0.5, G.ease.expoOut, 0.85);
      const fud = -(this.songW * 0.5) * Math.sin(-4.4 * Math.PI / 180) - 10;
      this.songX = this.smallX + 94; this.tween(this, 'songY', -61, 122 - 25 - fud + 1, 0.5, G.ease.expoOut, 0.9);
      this.timers.push({ t: this.t + wait, fn: () => { I.k = 0; this.tween(I, 'k', 0, 1, 0.7, x => x * x); I.moving = autoScroll; } });
    },
    // ---- big clear % counter that ticks up with a scroll sound per number
    startTally() {
      this.bgFlash = 1;
      const from = Math.max(0, this.clearTarget - 36);
      this.clear = { cur: from, last: from, alpha: 1, flash: false, x: G.W / 2 + 190, y: G.H / 2 - 70 };
      const c = this.clear;
      this.tweens.push({ obj: c, prop: 'cur', from, to: this.clearTarget, dur: 58 * R, ease: x => 1 - Math.pow(1 - x, 4), start: this.t, onUpdate: () => { const n = Math.round(c.cur); if (n !== c.last) { c.last = n; G.sfx('scroll'); } },
        onDone: () => { G.sfx('confirm'); c.flash = true; this.timers.push({ t: this.t + 0.4, fn: () => { c.flash = false; } }); this.tween(c, 'alpha', 1, 0, 0.5, x => 1 - Math.pow(1 - x, 4), 0.75); } });
    },
    afterTally() {
      this.showSmall = true; this.smallFlash = 0.4;
      this.timers.push({ t: this.t + 2.5, fn: () => { this.info.moving = true; } });
      for (const ch of this.chars) this.timers.push({ t: this.t + ch.delay, fn: () => { ch.spr.visible = true; ch.start(); if (ch.sound) G.sfx(ch.sound); } });
    },
    displayRankText() {
      this.bgFlash = 1; this.bgFlashDur = 14 * R;
      this.rankText = true; this.rankT = 0;
      const txt = RANK_TEXT[this.rank];
      this.rankHor = G.A.image(RS + 'rankText/rankScroll' + txt + '.png');
      this.rankVer = G.A.image(RS + 'rankText/rankText' + txt + '.png');
    },
    playMusic() {
      const pdata = G.A.json('preload/data/players/' + (this.player === 'pico' ? 'pico' : 'bf') + '.json');
      const m = (pdata && pdata.results && pdata.results.music && pdata.results.music[this.rank]) || 'resultsNORMAL';
      const intro = 'shared/music/' + m + '/' + m + '-intro.ogg', main = 'shared/music/' + m + '/' + m + '.ogg';
      if (G.A.has(intro)) {
        G.audio.music.play(intro, { loop: false, bpm: 120 });
        G.A.audio(intro).then(b => { if (!b) return; this.timers.push({ t: this.t + b.duration, fn: () => { if (!this.leaving) G.audio.music.play(main, { loop: true, bpm: 120 }); } }); });
      } else G.audio.music.play(main, { loop: true, bpm: 120 });
    },
    // ---- the player's rank reaction (data from preload/data/players/<player>.json)
    buildChars() {
      const pdata = G.A.json('preload/data/players/' + this.player + '.json');
      const list = (pdata && pdata.results && pdata.results[RANK_KEY[this.rank]]) || [];
      const out = [];
      for (const a of list) {
        const want = G.settings.naughty === false ? 'safe' : 'naughty';
        if (a.filter && a.filter !== 'both' && a.filter !== want) continue;
        const path = a.scriptClass ? SCRIPT_ATLAS[a.scriptClass] : G.A.imagePath(a.assetPath);
        if (!path) continue;
        const off = a.offsets || [0, 0];
        const spr = new G.Sprite(off[0], off[1]);
        spr.zIndex = a.zIndex || 500; spr.visible = false;
        const sc = a.scale || 1; spr.scale.x = spr.scale.y = sc;
        const entry = { spr, delay: a.delay || 0, sound: a.sound ? 'shared/sounds/' + a.sound.split(':').pop() + '.ogg' : null };
        if (a.renderType === 'sparrow') {
          spr.loadSparrow(path); spr.addAnim('idle', '', 24, false); spr.scale.x = spr.scale.y = sc;
          entry.start = () => spr.play('idle', true);
          spr.onFinish = () => { if (a.loopFrame != null) { spr.play('idle', true); spr.fi = Math.min(a.loopFrame, spr.cur.n - 1); } };
        } else {
          spr.loadAtlas(path); spr.scale.x = spr.scale.y = sc;
          const atlas = spr.atlas; if (!atlas) continue;
          // Pico's GOOD/GREAT scripts blow their tiny white/black flash symbols up to full screen
          if (a.scriptClass === 'PicoGoodResults') { scaleElement(atlas, 'white small', 10, 500); scaleElement(atlas, 'blacksmall', 15, 500); }
          if (a.scriptClass === 'PicoGreatResults') { scaleElement(atlas, 'white', 10, 500); scaleElement(atlas, 'black', 15, 500); }
          spr.addAnim('all', atlas.main.name, 24, false);
          // a label plays only its own frames (like flixel-animate); a plain frame number plays to the end
          const playLabel = (n) => { const l = atlas.labels[n]; if (!l) return false; spr.play('all', true); spr.fi = l.start; entry.end = l.start + l.len; return true; };
          const playFrom = (f) => { spr.play('all', true); spr.fi = Math.min(f || 0, spr.cur.n - 1); entry.end = null; };
          if (a.scriptClass === 'PicoGoodResults') {
            // 5% chance of the fat GF intro, 20% Cassandra, else Pico shooting; then the shooting loop forever
            entry.start = () => { const r = Math.random(); playLabel(r < 0.05 ? 'intro fat gf' : r < 0.24 ? 'intro cass' : 'intro'); };
            spr.onFinish = () => playLabel('loop');
          } else {
            entry.start = () => { if (!(a.startFrameLabel && playLabel(a.startFrameLabel))) playFrom(0); };
            spr.onFinish = () => {
              if (a.looped === false) return;
              if (!(a.loopFrameLabel && playLabel(a.loopFrameLabel))) playFrom(a.loopFrame || 0);
            };
          }
        }
        out.push(entry);
      }
      return out.sort((x, y) => x.spr.zIndex - y.spr.zIndex);
    },
    update(dt) {
      this.t += dt;
      for (const tm of this.timers) if (!tm.done && this.t >= tm.t) { tm.done = true; tm.fn(); }
      for (const tw of this.tweens) {
        if (tw.done || this.t < tw.start) continue;
        const k = Math.min(1, (this.t - tw.start) / tw.dur);
        tw.obj[tw.prop] = tw.from + (tw.to - tw.from) * tw.ease(k);
        if (tw.onUpdate) tw.onUpdate();
        if (k >= 1) { tw.done = true; if (tw.onDone) tw.onDone(); }
      }
      for (const s of [this.sound, this.header, this.cats, this.scorePop, this.high]) s.update(dt);
      for (const ch of this.chars) {
        ch.spr.update(dt);
        // a labelled intro plays until the next label, then jumps to its loop point
        if (ch.end != null && ch.spr.fi >= ch.end) { ch.end = null; ch.spr.onFinish && ch.spr.onFinish(); }
      }
      const setDigit = this.setDigit;
      for (const d of this.scoreDigits) {
        d.update(dt);
        if (d.shuf != null) {
          d.shufT += dt;
          while (d.shufT >= R && d.shuf != null) { d.shufT -= R; d.shuf++; setDigit(d, (d.digit + 1) % 10); if (d.shuf >= 41) { d.shuf = null; d.count = 0; } }
        } else if (d.count != null) {
          d.count = Math.min(1, d.count + dt / (23 * R));
          this.setDigit(d, Math.min(d.final, Math.floor(G.ease.quadOut(d.count) * d.final)));
          if (d.count >= 1) { this.setDigit(d, d.final); d.count = null; this.timers.push({ t: this.t + Math.max(0, d.finalDelay) * R, fn: () => d.play(String(d.final), true) }); }
        }
      }
      if (this.info.moving) {
        const I = this.info, mx = I.sx * I.k * 60 * dt, my = I.sy * I.k * 60 * dt;
        this.songX += mx; this.diffX += mx; this.smallX += mx; this.songY += my; this.diffY += my; this.smallY += my;
        if (this.songX + this.songW < 100) this.songInfoIn(3, true);
      }
      if (this.bgFlash > 0) this.bgFlash = Math.max(0, this.bgFlash - dt / (this.bgFlashDur || 5 * R));
      if (this.rankText) this.rankT += dt;
      if (this.smallFlash > 0) this.smallFlash -= dt;
      if (this.leaving) { this.leaveT += dt; if (this.leaveT > 0.8 && !this.went) { this.went = true; this.goBack(); } }
    },
    goBack() {
      G.audio.music.stop(0.2);
      G.playMenuMusic(1);
      G.setScreen(this.p.mode === 'story' ? 'storyMenu' : 'freeplay', {});
    },
    onAction(a, down) { if (down && (a === 'accept' || a === 'back') && !this.leaving && this.t > 0.5) { this.leaving = true; this.leaveT = 0; G.audio.music.setVolume(0.0001, 0.8); } },
    onPointer(type) { if (type === 'down') this.onAction('accept', true); },
    // ---- drawing helpers
    drawCounter(ctx, tl) {
      if (!tl.visible || !this.digitSheet) return;
      const s = String(Math.round(tl.cur));
      [...s].forEach((ch, i) => {
        const fr = G.Sparrow.byPrefix(this.digitSheet, ch + ' small')[0]; if (!fr) return;
        ctx.save(); ctx.translate(tl.x + i * 43, tl.y);
        if (tl.c) { const sheetImg = tinted(this.digitSheet.img, tl.c); ctx.drawImage(sheetImg, fr.x, fr.y, fr.w, fr.h, fr.ox, fr.oy, fr.w, fr.h); }
        else G.Sparrow.draw(ctx, this.digitSheet, fr);
        ctx.restore();
      });
    },
    drawClear(ctx, x, y, num, small, flash, alpha) {
      const txt = G.A.image(RS + 'clearPercent/clearPercentText' + (small ? 'Small' : '') + '.png');
      ctx.save(); ctx.globalAlpha *= alpha;
      if (flash) ctx.filter = 'brightness(0) invert(1)';
      if (txt) ctx.drawImage(txt, x + (small ? 40 : 0), y);
      const digits = String(Math.max(0, Math.round(num))).split('').map(Number);
      digits.forEach((d, i) => {
        const idx = i + 1, off = digits.length === 1 ? 1 : digits.length === 3 ? -1 : 0;
        const size = small ? 32 : 72, hOff = small ? -4 : 0;
        const variant = digits.length === 3 ? idx >= 2 : idx >= 1;
        const sheet = G.Sparrow.load(RS + 'clearPercent/clearPercentNumber' + (small ? 'Small' : variant ? 'Right' : 'Left'));
        if (!sheet) return;
        const fr = G.Sparrow.byPrefix(sheet, 'number ' + d + ' 0')[0]; if (!fr) return;
        const px = x + (idx - 1 + off) * size + (small ? -24 : 0), py = y + (idx - 1 + off) * hOff + (small ? 0 : 72);
        ctx.save(); ctx.translate(px, py); G.Sparrow.draw(ctx, sheet, fr); ctx.restore();
      });
      ctx.restore(); ctx.filter = 'none';
    },
    drawTardling(ctx, text, x, y) {
      // FNF's results song-name font: monospace 49x61 cells
      const img = G.A.image(RS + 'tardlingSpritesheet.png'); if (!img) return;
      const letters = 'AaBbCcDdEeFfGgHhiIJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz:1234567890().-';
      const cols = Math.floor(img.width / 49);
      let cx = 0;
      for (const ch of text) {
        const i = letters.indexOf(ch);
        if (i >= 0) ctx.drawImage(img, (i % cols) * 49, Math.floor(i / cols) * 61, 49, 61, x + cx, y, 49, 61);
        cx += 49 - 15;
      }
    },
    draw(ctx) {
      G.setScreenT(ctx);
      // background gradient + flash
      const g = ctx.createLinearGradient(0, 0, 0, G.H); g.addColorStop(0, '#FECC5C'); g.addColorStop(1, '#FDC05C');
      ctx.fillStyle = g; ctx.fillRect(0, 0, G.W, G.H);
      if (this.bgFlash > 0) { const f = ctx.createLinearGradient(0, 0, 0, G.H); f.addColorStop(0, '#FFF1A6'); f.addColorStop(1, '#FFF1BE'); ctx.globalAlpha = this.bgFlash; ctx.fillStyle = f; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
      // scrolling rank text rows on a camera tilted -3.8 degrees
      if (this.rankText && this.rankHor) {
        const im = this.rankHor, sp = im.width + 10;
        ctx.save(); ctx.translate(G.W / 2, G.H * 0.6); ctx.rotate(-3.8 * Math.PI / 180); ctx.translate(-G.W / 2, -G.H * 0.6);
        for (let i = 0; i < 12; i++) {
          const y = 50 + 135 * i / 2 + 10;
          let x = (G.W / 2 - 320 + (i % 2 === 0 ? -7 : 7) * this.rankT) % sp; if (x > 0) x -= sp;
          for (let xx = x - sp; xx < G.W + sp; xx += sp) ctx.drawImage(im, xx, y);
        }
        ctx.restore();
      }
      // big clear % (zIndex 450, behind the characters)
      if (this.clear && this.clear.alpha > 0) this.drawClear(ctx, this.clear.x, this.clear.y, this.clear.cur, false, this.clear.flash, this.clear.alpha);
      // character reactions (zIndex ~500, behind the UI)
      for (const ch of this.chars) if (ch.spr.zIndex < 1000) ch.spr.draw(ctx, null);
      // vertical rank text on the right edge, flickers in then scrolls up
      if (this.rankText && this.rankVer) {
        const fl = this.rankT < 6 * R && Math.floor(this.rankT / (2 * R)) % 2 === 1;
        if (!fl) { const im = this.rankVer, sp = im.height + 30; let y = 100 - Math.max(0, this.rankT - 30 * R) * 80; y = ((y % sp) + sp) % sp - sp; for (let yy = y; yy < G.H; yy += sp) ctx.drawImage(im, G.W - 44, yy); }
      }
      // difficulty + small clear % + song name (slide in under the black bar)
      G.setScreenT(ctx);
      // (everything left of x=520 is masked off, like FNF's clipRect)
      ctx.save(); ctx.beginPath(); ctx.rect(520, 0, G.W, G.H); ctx.clip();
      if (this.diffImg) ctx.drawImage(this.diffImg, this.diffX, this.diffY);
      if (this.showSmall) this.drawClear(ctx, this.smallX, this.smallY, this.clearTarget, true, this.smallFlash > 0, 1);
      if (this.songVisible) { ctx.translate(this.songX + this.songW / 2, this.songY + 30.5); ctx.rotate(-4.4 * Math.PI / 180); this.drawTardling(ctx, String(this.p.title || ''), -this.songW / 2, -30.5); }
      ctx.restore();
      // black top bar (rotated band)
      ctx.save(); ctx.translate(-15, this.barY); ctx.rotate(-3.8 * Math.PI / 180); ctx.fillStyle = '#000'; ctx.fillRect(-20, -60, G.W * 1.1, 148 + 60); ctx.restore();
      this.sound.draw(ctx, null);
      this.header.draw(ctx, null); this.cats.draw(ctx, null); this.scorePop.draw(ctx, null);
      for (const d of this.scoreDigits) d.draw(ctx, null);
      for (const tl of this.tallies) this.drawCounter(ctx, tl);
      this.high.draw(ctx, null);
      for (const ch of this.chars) if (ch.spr.zIndex >= 1000) ch.spr.draw(ctx, null);
      if (this.leaving) { G.setScreenT(ctx); ctx.globalAlpha = Math.min(1, this.leaveT / 0.8); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    },
  };
})();
