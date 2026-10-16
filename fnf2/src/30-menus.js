// FNF 2 - menus with FNF's real art: title, main menu, story mode, freeplay.
// Layout + timing follow the Funkin' engine (TitleState, MainMenuState, StoryMenuState).
(function () {
  const lerpP = (a, b, dt, dur, prec) => b + (a - b) * Math.pow(prec || 0.01, dt / dur); // MathUtil.smoothLerpPrecision
  // ---------------------------------------------------------------- shared: menu music + beats
  G.playMenuMusic = function (fadeIn) {
    G.audio.music.play('preload/music/freakyMenu/freakyMenu.ogg', { loop: true, bpm: 102, fadeIn: fadeIn || 0 });
  };
  G.BeatTracker = class {
    constructor() { this.last = null; this.beatF = 0; }
    poll(cb) {
      const cur = G.audio.music.current();
      const bpm = cur ? cur.bpm : 102, ms = cur ? G.audio.music.time() : G.time * 1000;
      const b = ms / (60000 / bpm); this.beatF = b;
      const bi = Math.floor(b);
      if (this.last === null || bi < this.last || bi - this.last > 8) { this.last = bi; if (cb && this.fireFirst) cb(bi); return b; }
      while (this.last < bi) { this.last++; if (cb) cb(this.last); }
      return b;
    }
  };
  G.ui = G.ui || {};
  G.ui.flash = { a: 0, d: 1, fire(d) { if (!G.settings.flashing) return; this.a = 1; this.d = d || 1; }, update(dt) { this.a = Math.max(0, this.a - dt / this.d); }, draw(ctx) { if (this.a <= 0) return; G.setScreenT(ctx); ctx.globalAlpha = this.a; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; } };
  G.ui.backBtn = { x: 18, y: 18, w: 84, h: 64 };
  G.ui.drawBack = function (ctx) {
    if (!G.touchMode) return;
    const b = G.ui.backBtn; G.setScreenT(ctx); ctx.save(); ctx.globalAlpha = 0.85;
    G.roundRect(ctx, b.x, b.y, b.w, b.h, 16); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x + 26, b.y + b.h / 2); ctx.lineTo(b.x + 50, b.y + 16); ctx.lineTo(b.x + 50, b.y + b.h - 16); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
  };
  G.ui.hitBack = (x, y) => { const b = G.ui.backBtn; return G.touchMode && x >= b.x - 10 && x <= b.x + b.w + 10 && y >= b.y - 10 && y <= b.y + b.h + 10; };

  // ---------------------------------------------------------------- TITLE
  G.screens.title = {
    enter(p) {
      this.skipped = !!(p && p.skipIntro) || !!G._titleSeen;
      this.lines = []; this.ng = false; this.t = 0; this.transitioning = false; this.went = false;
      this.beat = new G.BeatTracker();
      // random intro pair from FNF's introText.txt
      const txt = (G.A.text('preload/data/introText.txt') || 'shoutouts to tom fulp--lmao').split('\n').map(s => s.trim()).filter(Boolean);
      this.wacky = txt[Math.floor(Math.random() * txt.length)].split('--');
      this.logo = new G.Sprite(-150, -100).loadSparrow('preload/images/logoBumpin');
      this.logo.addAnim('bump', 'logo bumpin', 24, false); this.logo.play('bump'); this.logo.updateHitbox();
      this.gf = new G.Sprite(G.W * 0.4, G.H * 0.07).loadSparrow('preload/images/gfDanceTitle');
      this.gf.addAnim('danceLeft', 'gfDance', 24, false, [30, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
      this.gf.addAnim('danceRight', 'gfDance', 24, false, [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
      this.gf.play('danceRight');
      this.danceLeft = false;
      this.text = new G.Sprite(100, G.H * 0.8).loadAtlas('preload/images/title-screen-text');
      this.text.addAnim('idle', 'Idle', 24, true); this.text.addAnim('press', 'Confirm', 24, true); this.text.play('idle'); this.text.updateHitbox();
      this.ngSpr = new G.Sprite(0, G.H * 0.52).loadImage('preload/images/newgrounds_logo.png');
      this.ngSpr.scale.x = this.ngSpr.scale.y = 0.8; this.ngSpr.updateHitbox(); this.ngSpr.screenCenter('x');
      G.ui.flash.a = 0;
      if (!G.audio.music.current() || G.audio.music.current().id.indexOf('freakyMenu') < 0) G.playMenuMusic(this.skipped ? 0 : 4);
    },
    cool(lines) { this.lines = lines.map((s, i) => this.mkLine(s, i)); },
    more(s) { this.lines.push(this.mkLine(s, this.lines.length)); },
    mkLine(s, i) { const a = new G.Alphabet(s, true, 0, 0); a.x = (G.W - a.width) / 2; a.y = i * 60 + 200; return a; },
    onBeat(b) {
      if (!this.skipped) {
        switch (b) {
          case 1: this.cool(['The', 'Funkin Crew Inc']); break;
          case 3: this.more('presents'); break;
          case 4: this.lines = []; break;
          case 5: this.cool(['In association', 'with']); break;
          case 7: this.more('newgrounds'); this.ng = true; break;
          case 8: this.lines = []; this.ng = false; break;
          case 9: this.cool([this.wacky[0] || '']); break;
          case 11: this.more(this.wacky[1] || ''); break;
          case 12: this.lines = []; break;
          case 13: this.more('Friday'); break;
          case 14: this.more('Night'); break;
          case 15: this.more('Funkin'); break;
          case 16: this.skipIntro(); break;
        }
      }
      if (this.skipped) {
        this.logo.play('bump', true);
        this.danceLeft = !this.danceLeft;
        this.gf.play(this.danceLeft ? 'danceRight' : 'danceLeft', true);
      }
    },
    skipIntro() { if (this.skipped) return; this.skipped = true; G._titleSeen = true; this.lines = []; this.ng = false; G.ui.flash.fire(4); },
    update(dt) {
      this.t += dt;
      this.beat.poll(b => this.onBeat(b));
      this.logo.update(dt); this.gf.update(dt); this.text.update(dt); this.ngSpr.update(dt);
      for (const l of this.lines) l.update(dt);
      G.ui.flash.update(dt);
      if (this.transitioning) { this.tt += dt; if (this.tt > 2 && !this.went) { this.went = true; G.setScreen('mainMenu', {}); } }
    },
    press() {
      if (!this.skipped) { this.skipIntro(); return; }
      if (this.transitioning) { if (!this.went) { this.went = true; G.setScreen('mainMenu', {}); } return; }
      this.transitioning = true; this.tt = 0;
      this.text.play('press'); G.ui.flash.fire(1); G.sfx('confirm', { vol: 0.7 });
    },
    onAction(a, down) { if (down && a === 'accept') this.press(); },
    onPointer(type) { if (type === 'down') this.press(); },
    draw(ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      if (this.skipped) {
        this.logo.draw(ctx, null); this.gf.draw(ctx, null); this.text.draw(ctx, null);
      } else {
        for (const l of this.lines) l.draw(ctx, null);
        if (this.ng) this.ngSpr.draw(ctx, null);
      }
      G.ui.flash.draw(ctx);
    },
  };

  // ---------------------------------------------------------------- MAIN MENU
  const ITEMS = [['storymode', 'storyMenu'], ['freeplay', 'freeplay'], ['options', 'options'], ['credits', 'credits']];
  G.screens.mainMenu = {
    enter() {
      if (this.sel == null) this.sel = 0;
      this.cam = new G.FCam(1); this.cam.followRate = 0.06;
      this.bg = new G.Sprite(0, 0).loadImage('preload/images/menuBG.png'); this.bg.scroll.x = 0; this.bg.scroll.y = 0.17;
      this.bg.setGraphicSize(G.W * 1.2); this.bg.updateHitbox(); this.bg.screenCenter();
      this.mag = new G.Sprite(0, 0).loadImage('preload/images/menuBGMagenta.png'); this.mag.scroll.x = 0; this.mag.scroll.y = 0.17;
      this.mag.setGraphicSize(this.bg.width); this.mag.updateHitbox(); this.mag.x = this.bg.x; this.mag.y = this.bg.y; this.mag.visible = false;
      const spacing = 160, top = (G.H - spacing * (ITEMS.length - 1)) / 2;
      this.items = ITEMS.map(([name], i) => {
        const s = new G.Sprite(0, 0).loadSparrow('preload/images/mainmenu/' + name);
        s.addAnim('idle', name + ' idle', 24, true); s.addAnim('selected', name + ' selected', 24, true);
        s.scroll.x = 0; s.scroll.y = 0.4; s.cx = G.W / 2; s.cy = top + spacing * i; s.name = name;
        s.play('idle'); this.centerItem(s);
        return s;
      });
      this.select(this.sel, true);
      this.cam.focus(G.W / 2, this.items[this.sel].cy);
      this.chosen = false; this.ct = 0;
      this.swipe = new G.Swipe();
      G.playMenuMusic(0);
    },
    // AtlasMenuItem "centered": the sprite is centred on (cx, cy) whatever the frame size
    centerItem(s) { s.updateHitbox(); s.x = s.cx - s.width / 2; s.y = s.cy - s.height / 2; },
    select(i, quiet) {
      this.items[this.sel].play('idle'); this.centerItem(this.items[this.sel]);
      this.sel = (i + ITEMS.length) % ITEMS.length;
      const it = this.items[this.sel]; it.play('selected'); this.centerItem(it);
      this.cam.follow(it.cx, it.cy);
      if (!quiet) G.sfx('scroll');
    },
    choose() {
      if (this.chosen) return;
      this.chosen = true; this.ct = 0; G.sfx('confirm');
      if (G.settings.flashing) this.mag.visible = true;
    },
    update(dt) {
      for (const s of this.items) { s.update(dt); }
      this.cam.update(dt);
      if (this.chosen) {
        this.ct += dt;
        this.mag.visible = G.settings.flashing && this.ct < 1.1 && Math.floor(this.ct / 0.15) % 2 === 0;
        if (this.ct >= 1.1 && !this.went) { this.went = true; G.setScreen(ITEMS[this.sel][1], { from: 'mainMenu' }); }
      } else this.went = false;
    },
    onAction(a, down) {
      if (!down || this.chosen) return;
      if (a === 'ui_up') this.select(this.sel - 1);
      else if (a === 'ui_down') this.select(this.sel + 1);
      else if (a === 'accept') this.choose();
      else if (a === 'back') { G.sfx('cancel'); G.setScreen('title', { skipIntro: true }); }
    },
    onWheel(d) { if (!this.chosen) this.select(this.sel + d); },
    onPointer(type, x, y) {
      if (type === 'down' && G.ui.hitBack(x, y)) { this.onAction('back', true); return; }
      const s = this.swipe.handle(type, x, y); if (!s || this.chosen) return;
      if (s.dir === 'up') this.select(this.sel + 1); else if (s.dir === 'down') this.select(this.sel - 1);
      else if (s.dir === 'tap') {
        // items scroll with the camera (scroll y 0.4): find the tapped one in screen space
        const sy = it => (it.cy - (this.cam.y - G.H / 2) * 0.4);
        for (let i = 0; i < this.items.length; i++) if (Math.abs(s.y - sy(this.items[i])) < 70 && Math.abs(s.x - G.W / 2) < 300) { if (i === this.sel) this.choose(); else this.select(i); return; }
      }
    },
    draw(ctx) {
      this.bg.draw(ctx, this.cam);
      if (this.mag.visible) this.mag.draw(ctx, this.cam);
      this.items.forEach((s, i) => {
        if (this.chosen && i !== this.sel) { s.alpha = Math.max(0, 1 - this.ct / 0.4); }
        else if (this.chosen) s.alpha = (this.ct < 1 && Math.floor(this.ct / 0.06) % 2) ? 0 : 1;
        else s.alpha = 1;
        s.draw(ctx, this.cam);
      });
      G.vcr(ctx, 'FNF 2 (private copy) - Friday Night Funkin\' v0.8', 5, G.H - 22, { size: 16, outline: 1.5 });
      G.ui.drawBack(ctx);
    },
  };

  // ---------------------------------------------------------------- STORY MODE
  G.screens.storyMenu = {
    enter() {
      this.levels = G.availableWeeks().map(id => Object.assign({ id }, G.A.json('preload/data/levels/' + id + '.json')));
      if (this.sel == null) this.sel = 0;
      this.sel = Math.min(this.sel, this.levels.length - 1);
      this.player = G.settings.storyPlayer || 'bf';
      this.titles = this.levels.map((L, i) => {
        const s = new G.Sprite(0, 0).loadImage('preload/' + 'images/' + L.titleAsset + '.png');
        s.updateHitbox(); s.screenCenter('x'); s.y = 56 + 400 + 10 + i * 130; s.targetY = s.y; s.flash = false; s.ft = 0;
        return s;
      });
      this.diffs = ['easy', 'normal', 'hard'];
      if (this.diffIdx == null) this.diffIdx = 1;
      this.arrowL = new G.Sprite(G.W - 410, 480).loadSparrow('preload/images/storymenu/ui/arrows'); this.arrowL.addAnim('idle', 'leftIdle0'); this.arrowL.addAnim('press', 'leftConfirm0'); this.arrowL.play('idle');
      this.arrowR = new G.Sprite(G.W - 35, 480).loadSparrow('preload/images/storymenu/ui/arrows'); this.arrowR.addAnim('idle', 'rightIdle0'); this.arrowR.addAnim('press', 'rightConfirm0'); this.arrowR.play('idle');
      this.arrowL.updateHitbox(); this.arrowR.updateHitbox();
      this.beat = new G.BeatTracker();
      this.chosen = false; this.ct = 0; this.went = false; this.score = 0; this.scoreLerp = 0;
      this.swipe = new G.Swipe();
      this.changeLevel(0, true); this.changeDiff(0, true);
      G.playMenuMusic(0);
    },
    buildProps() {
      const L = this.levels[this.sel];
      this.props = (L.props || []).map((pd, i) => {
        if (!pd.assetPath) return null;
        let path = pd.assetPath;
        if (i === 1 && this.player === 'pico' && G.A.has('preload/images/storymenu/props/pico-player.xml')) path = 'storymenu/props/pico-player';
        const s = new G.Sprite(0, 0).loadSparrow('preload/images/' + path);
        s.useAnimOffsets = true;
        for (const a of pd.animations || []) { s.addAnim(a.name, a.prefix, a.frameRate || 24, !!a.looped, a.frameIndices || null); s.animOffsets[a.name] = a.offsets || [0, 0]; }
        const sc = (pd.scale || 1) * (pd.isPixel ? 6 : 1); s.scale.x = s.scale.y = sc; s.antialias = !pd.isPixel;
        s.updateHitbox();
        s.x = (pd.offsets ? pd.offsets[0] : 0) + G.W * 0.25 * i; s.y = pd.offsets ? pd.offsets[1] : 0;
        s.danceEvery = pd.danceEvery != null ? pd.danceEvery : 1;
        if (s.anims.danceLeft) { s._d = false; s.play('danceLeft'); } else s.play('idle');
        return s;
      }).filter(Boolean);
    },
    changeLevel(d, quiet) {
      const prev = this.sel;
      this.sel = (this.sel + d + this.levels.length) % this.levels.length;
      if (this.sel !== prev && !quiet) G.sfx('scroll', { vol: 0.4 });
      // current title at y 480, others stacked around it
      const T = this.titles;
      T[this.sel].targetY = 480;
      for (let i = this.sel - 1; i >= 0; i--) T[i].targetY = T[i + 1].targetY - Math.max(T[i].height + 20, 125);
      for (let i = this.sel + 1; i < T.length; i++) T[i].targetY = T[i - 1].targetY + T[i - 1].height + 20;
      T.forEach((t, i) => { t.alpha = i === this.sel ? 1 : 0.6; });
      this.buildProps();
      this.refreshDiffs();
    },
    refreshDiffs() {
      // available difficulties for this week (base + erect remixes when all songs have them)
      const L = this.levels[this.sel];
      const ok = d => L.songs.every(sid => G.Songs.difficulties(sid, this.player).some(x => x.diff === d));
      const list = G.DIFF_ORDER.filter(ok);
      // keep the picked difficulty by name (it survives week changes + coming back from a song)
      const cur = this.diffName || G.settings.storyDiff || 'normal';
      this.diffs = list.length ? list : ['normal'];
      this.diffIdx = this.diffs.indexOf(cur);
      if (this.diffIdx < 0) this.diffIdx = Math.max(0, this.diffs.indexOf('normal'));
      this.makeDiffSprite();
    },
    changeDiff(d, quiet) {
      this.diffIdx = (this.diffIdx + d + this.diffs.length) % this.diffs.length;
      if (d !== 0) { this.diffName = G.settings.storyDiff = this.diffs[this.diffIdx]; G.saveSettings(); (d < 0 ? this.arrowL : this.arrowR).play('press', true); }
      this.makeDiffSprite();
    },
    makeDiffSprite() {
      const id = this.diffs[this.diffIdx];
      const base = 'preload/images/storymenu/difficulties/' + id;
      const s = new G.Sprite(0, 0);
      if (G.A.text(base + '.xml')) { s.loadSparrow(base); s.addAnim('idle', 'idle0', 24, true); s.play('idle'); } else s.loadImage(base + '.png');
      s.updateHitbox();
      const normal = G.A.image('preload/images/storymenu/difficulties/normal.png');
      s.x = this.arrowL.x + this.arrowL.width + 10 + ((normal ? normal.width : s.width) - s.width) / 2;
      s.targetY = this.arrowL.y + 10 - (s.height - (normal ? normal.height : s.height)) / 2;
      s.y = this.arrowL.y - 15; s.alpha = 0; s.tw = 0;
      this.diffSpr = s;
      const L = this.levels[this.sel];
      this.score = G.getWeekScore(L.id, id, this.player);
    },
    update(dt) {
      this.beat.poll(b => { for (const p of this.props) { if (p.anims.danceLeft) { p._d = !p._d; p.play(p._d ? 'danceRight' : 'danceLeft', true); } else if (!(p.animName === 'confirm' && !p.finished) && p.animName !== 'confirm') p.play('idle', true); } });
      for (const t of this.titles) {
        t.y = lerpP(t.y, t.targetY, dt, 0.451);
        if (t.flash) { t.ft += dt; }
      }
      for (const p of this.props) p.update(dt);
      this.arrowL.update(dt); this.arrowR.update(dt);
      if (this.arrowL.finished && this.arrowL.animName === 'press' && !G.input.isDown('ui_left')) this.arrowL.play('idle');
      if (this.arrowR.finished && this.arrowR.animName === 'press' && !G.input.isDown('ui_right')) this.arrowR.play('idle');
      const ds = this.diffSpr; if (ds) { ds.update(dt); ds.tw = Math.min(1, ds.tw + dt / 0.07); ds.alpha = ds.tw; ds.y = G.lerp(this.arrowL.y - 15, ds.targetY, ds.tw); }
      this.scoreLerp = Math.round(G.lerp(this.scoreLerp, this.score, Math.min(1, dt * 30)));
      if (Math.abs(this.scoreLerp - this.score) < 10) this.scoreLerp = this.score;
      if (this.chosen) { this.ct += dt; if (this.ct > 1.2 && !this.went) { this.went = true; this.start(); } }
    },
    start() {
      const L = this.levels[this.sel], diff = this.diffs[this.diffIdx];
      G.setScreen('play', { mode: 'story', week: L.id, songs: L.songs.slice(), songIndex: 0, diff, variation: this.player === 'pico' ? 'pico' : G.DIFF_INFO[diff].variation, weekStats: null, deaths: 0 });
    },
    choose() {
      if (this.chosen) return;
      this.chosen = true; this.ct = 0; G.sfx('confirm');
      this.titles[this.sel].flash = true;
      for (const p of this.props) if (p.anims.confirm) p.play('confirm', true);
    },
    onAction(a, down) {
      if (!down || this.chosen) return;
      if (a === 'ui_up') this.changeLevel(-1); else if (a === 'ui_down') this.changeLevel(1);
      else if (a === 'ui_left') this.changeDiff(-1); else if (a === 'ui_right') this.changeDiff(1);
      else if (a === 'accept') this.choose();
      else if (a === 'tab') { this.player = this.player === 'bf' ? 'pico' : 'bf'; G.settings.storyPlayer = this.player; G.sfx('scroll'); this.buildProps(); this.refreshDiffs(); }
      else if (a === 'back') { G.sfx('cancel'); G.setScreen('mainMenu', {}); }
    },
    onPointer(type, x, y) {
      if (type === 'down' && G.ui.hitBack(x, y)) { this.onAction('back', true); return; }
      const s = this.swipe.handle(type, x, y); if (!s || this.chosen) return;
      if (s.dir === 'up') this.changeLevel(1); else if (s.dir === 'down') this.changeLevel(-1);
      else if (s.dir === 'tap') {
        if (s.y > 460 && s.y < 560 && s.x > this.arrowL.x - 20 && s.x < this.arrowL.x + 80) { this.changeDiff(-1); return; }
        if (s.y > 460 && s.y < 560 && s.x > this.arrowR.x - 20) { this.changeDiff(1); return; }
        if (s.y > 460 && s.y < 600 && Math.abs(s.x - G.W / 2) < 300) this.choose();
      }
    },
    draw(ctx) {
      G.setScreenT(ctx);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      // level titles (under the band)
      for (const t of this.titles) {
        if (t.y > G.H + 10 || t.y + t.height < 0) continue;
        t.draw(ctx, null);
        // confirm: the title flashes cyan (FNF tints it 0xFF33ffff every other tick)
        if (t.flash && G.settings.flashing && Math.floor(t.ft * 20) % 2 === 0) {
          ctx.save(); ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'sepia(1) hue-rotate(140deg) saturate(4)';
          ctx.drawImage(t.img, t.x, t.y, t.width, t.height); ctx.restore(); ctx.filter = 'none';
        }
      }
      // black top bar + yellow band
      G.setScreenT(ctx);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, 56);
      const L = this.levels[this.sel];
      ctx.fillStyle = L.background && L.background.startsWith('#') ? L.background : '#F9CF51'; ctx.fillRect(0, 56, G.W, 400);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 56, G.W, 400); ctx.clip();
      for (const p of this.props) p.draw(ctx, null);
      ctx.restore();
      // text
      G.vcr(ctx, 'LEVEL SCORE: ' + this.scoreLerp, 10, 10, { size: 32, outline: 0 });
      G.vcr(ctx, (L.name || '').toUpperCase(), G.W - 10, 10, { size: 32, align: 'right', alpha: 0.7, outline: 0 });
      const tr = ['TRACKS', ''].concat(L.songs.map(id => { const m = G.Songs.meta(id); return (m ? m.songName : id).toUpperCase(); }));
      tr.forEach((s, i) => G.vcr(ctx, s, G.W / 2 - G.W * 0.33, 56 + 400 + 100 + i * 32, { size: 32, align: 'center', color: '#E55777', outline: 0 }));
      this.arrowL.draw(ctx, null); this.arrowR.draw(ctx, null);
      if (this.diffSpr) this.diffSpr.draw(ctx, null);
      G.vcr(ctx, (G.touchMode ? 'TAP' : 'TAB') + ': PLAY AS ' + (this.player === 'bf' ? 'PICO' : 'BOYFRIEND'), G.W - 10, G.H - 30, { size: 20, align: 'right', alpha: 0.8 });
      G.ui.drawBack(ctx);
    },
  };

  // ---------------------------------------------------------------- FREEPLAY (classic FNF / Psych style)
  G.screens.freeplay = {
    enter(p) {
      this.player = G.settings.freeplayPlayer || 'bf';
      this.buildList();
      if (this.sel == null) this.sel = 0; this.sel = Math.min(this.sel, this.songs.length - 1);
      this.bg = new G.Sprite(0, 0).loadImage('preload/images/menuDesat.png');
      this.bgColor = this.songs[this.sel] ? this.songs[this.sel].color : '#9271FD';
      this.curColor = this.bgColor;
      this.diffIdx = this.diffIdx == null ? 1 : this.diffIdx;
      this.layout(true); this.refreshDiff();
      this.swipe = new G.Swipe();
      this.previewT = 0; this.previewing = null;
      if (!G.audio.music.current()) G.playMenuMusic(0);
    },
    buildList() {
      const weekColor = { tutorial: '#9271FD', week1: '#9271FD', week2: '#223344', week3: '#941653', week4: '#FC96D7', week5: '#A0D1FF', week6: '#FF78BF', week7: '#F6B604', weekend1: '#D8584A' };
      this.songs = [];
      for (const w of G.availableWeeks()) {
        const L = G.A.json('preload/data/levels/' + w + '.json');
        for (const id of L.songs) {
          const m = G.Songs.meta(id); if (!m) continue;
          const diffs = G.Songs.difficulties(id, this.player); if (!diffs.length) continue;
          const opp = this.player === 'pico' ? (G.Songs.meta(id, 'pico') || m).playData.characters.opponent : m.playData.characters.opponent;
          this.songs.push({ id, name: m.songName, week: w, opp, diffs, color: weekColor[w] || '#9271FD' });
        }
      }
      this.items = this.songs.map((s, i) => { const a = new G.Alphabet(s.name, true, 0, 0); a.isMenuItem = true; a.targetY = i; a.startPosition = { x: 90, y: G.H * 0.48 - 30 }; return a; });
    },
    layout(snap) {
      this.items.forEach((a, i) => { a.targetY = i - this.sel; a.alpha = i === this.sel ? 1 : 0.6; if (snap) { a.x = a.targetY * 20 + 90; a.y = a.targetY * 1.3 * 120 + G.H * 0.48 - 30; } });
    },
    refreshDiff() {
      const s = this.songs[this.sel]; if (!s) return;
      const want = G.DIFF_ORDER[this.diffIdx] || 'normal';
      let d = s.diffs.find(x => x.diff === want) || s.diffs.find(x => x.diff === 'normal') || s.diffs[0];
      this.diff = d; this.diffIdx = G.DIFF_ORDER.indexOf(d.diff);
      const key = s.id + (d.variation !== 'default' ? '-' + d.variation : '');
      this.best = G.getScore(key, d.diff, 'bf');
    },
    change(d) {
      if (!this.songs.length) return;
      this.sel = (this.sel + d + this.songs.length) % this.songs.length;
      G.sfx('scroll', { vol: 0.4 });
      this.layout(false); this.refreshDiff();
      this.previewT = 0;
    },
    changeDiff(d) {
      const s = this.songs[this.sel]; if (!s) return;
      const list = s.diffs.map(x => x.diff);
      let i = list.indexOf(this.diff.diff); i = (i + d + list.length) % list.length;
      this.diffIdx = G.DIFF_ORDER.indexOf(list[i]); this.refreshDiff();
    },
    update(dt) {
      for (const a of this.items) a.update(dt);
      const s = this.songs[this.sel];
      if (s) this.curColor = G.mixColor(this.curColor, s.color, Math.min(1, dt * 2.5));
      // song preview after a moment on the same song (instrumental)
      this.previewT += dt;
      if (s && this.previewT > 0.6 && this.previewing !== s.id + this.diff.variation) {
        this.previewing = s.id + this.diff.variation;
        const m = G.Songs.meta(s.id, this.diff.variation);
        if (m) G.audio.music.play(G.Songs.instPath(s.id, m, this.diff.variation), { loop: true, fadeIn: 1, bpm: m.timeChanges[0].bpm, vol: 0.8 });
      }
    },
    onAction(a, down) {
      if (!down) return;
      if (a === 'ui_up') this.change(-1); else if (a === 'ui_down') this.change(1);
      else if (a === 'ui_left') this.changeDiff(-1); else if (a === 'ui_right') this.changeDiff(1);
      else if (a === 'accept') this.play();
      else if (a === 'tab') { this.player = this.player === 'bf' ? 'pico' : 'bf'; G.settings.freeplayPlayer = this.player; G.sfx('scroll'); this.buildList(); this.sel = 0; this.layout(true); this.refreshDiff(); this.previewT = 0; }
      else if (a === 'back') { G.sfx('cancel'); G.playMenuMusic(0); G.setScreen('mainMenu', {}); }
    },
    onWheel(d) { this.change(d); },
    onPointer(type, x, y) {
      if (type === 'down' && G.ui.hitBack(x, y)) { this.onAction('back', true); return; }
      const s = this.swipe.handle(type, x, y); if (!s) return;
      if (s.dir === 'up') this.change(1); else if (s.dir === 'down') this.change(-1);
      else if (s.dir === 'left') this.changeDiff(1); else if (s.dir === 'right') this.changeDiff(-1);
      else if (s.dir === 'tap') { if (Math.abs(s.y - (G.H * 0.48 + 10)) < 70) this.play(); else this.change(s.y < G.H * 0.48 ? -1 : 1); }
    },
    play() {
      const s = this.songs[this.sel]; if (!s) return;
      G.sfx('confirm');
      G.setScreen('play', { mode: 'freeplay', songs: [s.id], songIndex: 0, diff: this.diff.diff, variation: this.diff.variation, week: s.week });
    },
    draw(ctx) {
      G.setScreenT(ctx);
      // menuDesat tinted to the week colour (FlxColor tint = multiply)
      ctx.fillStyle = this.curColor; ctx.fillRect(0, 0, G.W, G.H);
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; this.bg.draw(ctx, null); ctx.restore();
      G.setScreenT(ctx);
      this.items.forEach((a, i) => {
        if (a.y < -150 || a.y > G.H + 50) return;
        a.draw(ctx, null);
        // opponent health icon right of the name
        const ic = G.A.image('preload/images/icons/icon-' + this.songs[i].opp + '.png') || G.A.image('preload/images/icons/icon-face.png');
        if (ic) { G.setScreenT(ctx); ctx.globalAlpha = a.alpha; ctx.drawImage(ic, 0, 0, 150, 150, a.x + a.width + 10, a.y - 30, 150, 150); ctx.globalAlpha = 1; }
      });
      // score box (top right)
      const s = this.songs[this.sel];
      const best = this.best ? this.best.score : 0, acc = this.best ? Math.round(this.best.acc * 10000) / 100 : 0;
      const sc = 'PERSONAL BEST: ' + best + ' (' + acc + '%)';
      ctx.font = '32px ' + G.FONT.vcr; const w = ctx.measureText(sc).width;
      const bx = G.W - w - 12;
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect(bx - 6, 0, w + 18, 66 + 30); ctx.globalAlpha = 1;
      G.vcr(ctx, sc, G.W - 6, 5, { size: 32, align: 'right', outline: 0 });
      if (s && this.diff) G.vcr(ctx, '< ' + G.DIFF_INFO[this.diff.diff].name + ' >', bx + (w + 6) / 2, 41, { size: 24, align: 'center', outline: 0 });
      G.vcr(ctx, (this.player === 'pico' ? 'PICO' : 'BOYFRIEND') + (G.touchMode ? '' : ' - TAB to switch'), bx + (w + 6) / 2, 70, { size: 16, align: 'center', outline: 0, maxWidth: w + 6 });
      G.ui.drawBack(ctx);
    },
  };
})();
