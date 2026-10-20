// FNF 2 - menus: title screen + main menu. Rebuilt from the Funkin' engine's
// TitleState / MainMenuState (same timings, layout, sounds) with FNF's real assets.
// Our own touch: a graffiti "2" sprayed onto the real logo.

// ---------------------------------------------------------------- menu music
G.menuMusic = {
  PATH: 'preload/music/freakyMenu/freakyMenu.ogg',
  bpm: 102,
  start(fadeIn) {
    const meta = G.A.json('preload/music/freakyMenu/freakyMenu-metadata.json');
    if (meta && meta.timeChanges && meta.timeChanges[0]) this.bpm = meta.timeChanges[0].bpm;
    const cur = G.audio.music.current();
    if (cur && cur.id === this.PATH) return;
    G.audio.music.play(this.PATH, { loop: true, bpm: this.bpm, vol: 1, fadeIn: fadeIn || 0 });
  },
  // song position in ms of the menu loop (0 while it hasn't started yet)
  time() { const c = G.audio.music.current(); return c && c.id === this.PATH ? G.audio.music.time() : 0; },
};
G.audioRunning = () => !!(G.audio && G.audio.ctx && G.audio.ctx.state === 'running');
// beat tracker for menus that bop to the menu music
G.MenuBeat = class {
  constructor() { this.cond = new G.Conductor(G.menuMusic.bpm); this.cond.reset(0); this.started = false; }
  update(onBeat) {
    const c = G.audio.music.current();
    if (!c) return;
    this.cond.setBpm(c.bpm || G.menuMusic.bpm);
    const t = G.audio.music.time();
    if (!this.started) { this.started = true; this.cond.reset(t); return; }
    this.cond.update(t, null, onBeat);
  }
};

// ---------------------------------------------------------------- the graffiti "2"
// Drawn once into a canvas in the logo's own style: pink letter with a shine,
// thick black ink line, a blue paint splat behind it and black drips.
G.logo2 = function () {
  return G.cached('logo2', 300, 360, (c, w, h) => {
    // letter outline (angular graffiti "2"), in a 220x280 box
    const P = [
      [36, 92], [44, 46], [92, 14], [166, 10], [212, 40], [220, 92], [196, 142], [132, 196], [208, 192], [228, 238], [214, 276],
      [24, 282], [12, 236], [102, 150], [146, 102], [140, 72], [112, 66], [92, 82], [86, 112],
    ];
    const path = (ox, oy, s) => { c.beginPath(); P.forEach((p, i) => { const x = ox + p[0] * s, y = oy + p[1] * s; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); };
    const OX = 38, OY = 34;
    // blue paint splat behind (like the logo's backdrop)
    c.fillStyle = '#3a40c4';
    c.lineJoin = 'round';
    path(OX, OY, 1); c.lineWidth = 46; c.strokeStyle = '#3a40c4'; c.stroke(); c.fill();
    const blobs = [[24, 300, 18], [262, 64, 14], [278, 300, 16], [20, 118, 10], [250, 336, 8], [8, 260, 7], [284, 150, 9], [150, 14, 9]];
    for (const [x, y, r] of blobs) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
    // black ink + drop shadow
    c.save(); c.translate(10, 12); path(OX, OY, 1); c.fillStyle = '#000'; c.fill(); c.lineWidth = 16; c.strokeStyle = '#000'; c.stroke(); c.restore();
    path(OX, OY, 1); c.lineWidth = 16; c.strokeStyle = '#000'; c.stroke();
    // pink fill with a darker bottom, like "Friday Night"
    const g = c.createLinearGradient(0, OY, 0, OY + 282);
    g.addColorStop(0, '#ff6ac1'); g.addColorStop(0.55, '#f23d9e'); g.addColorStop(1, '#c81f7d');
    path(OX, OY, 1); c.fillStyle = g; c.fill();
    // shine streaks
    c.save(); path(OX, OY, 1); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath(); c.moveTo(OX + 40, OY + 60); c.lineTo(OX + 160, OY + 22); c.lineTo(OX + 166, OY + 36); c.lineTo(OX + 48, OY + 78); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath(); c.moveTo(OX + 30, OY + 252); c.lineTo(OX + 200, OY + 236); c.lineTo(OX + 202, OY + 246); c.lineTo(OX + 32, OY + 262); c.closePath(); c.fill();
    // dark crosshatch like the logo's "i"
    c.strokeStyle = 'rgba(120,10,70,0.55)'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(OX + 150 + i * 12, OY + 40); c.lineTo(OX + 120 + i * 12, OY + 80); c.stroke(); }
    c.restore();
    // drips
    c.fillStyle = '#000';
    for (const [x, len] of [[OX + 70, 34], [OX + 150, 22], [OX + 196, 40]]) {
      c.beginPath(); c.moveTo(x - 9, OY + 280); c.lineTo(x - 7, OY + 280 + len); c.arc(x, OY + 280 + len, 7, Math.PI, 0, true); c.lineTo(x + 9, OY + 280); c.closePath(); c.fill();
      c.fillStyle = '#f23d9e'; c.beginPath(); c.arc(x, OY + 280 + len - 2, 3.5, 0, Math.PI * 2); c.fill(); c.fillStyle = '#000';
    }
  });
};

// ---------------------------------------------------------------- TITLE
G.screens.title = {
  initialized: false,   // like FNF: the intro only plays the first time
  enter(p) {
    this.t = 0;
    this.skipped = false; this.transitioning = false; this.transT = 0;
    this.lines = []; this.ngVisible = false;
    this.flashA = 0; this.flashD = 1;
    // random intro text pair (introText.txt, "line1--line2")
    const txt = G.A.text('preload/data/introText.txt') || 'shoutouts to tom fulp--lmao';
    const pairs = txt.split('\n').map(s => s.trim()).filter(Boolean).map(s => s.split('--'));
    this.wacky = pairs[Math.floor(Math.random() * pairs.length)] || ['', ''];
    // sprites (positions from TitleState)
    this.logo = new G.Sprite(-150, -100).loadSparrow('preload/images/logoBumpin');
    this.logo.addAnim('bump', 'logo bumpin', 24, false); this.logo.play('bump', true); this.logo.updateHitbox();
    this.gf = new G.Sprite(G.W * 0.4, G.H * 0.07).loadSparrow('preload/images/gfDanceTitle');
    this.gf.addAnim('danceLeft', 'gfDance', 24, false, [30, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    this.gf.addAnim('danceRight', 'gfDance', 24, false, [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]);
    this.gf.play('danceRight', true); this.danceLeft = false;
    const tt = G.touchMode ? 'preload/images/title-screen-text-mobile' : 'preload/images/title-screen-text';
    this.enterText = new G.Sprite(G.touchMode ? 50 : 100, G.H * 0.8).loadAtlas(G.A.has(tt + '/Animation.json') ? tt : 'preload/images/title-screen-text');
    this.enterText.addAnim('idle', 'Idle', 24, true); this.enterText.addAnim('press', 'Confirm', 24, false);
    this.enterText.play('idle', true);
    this.ng = new G.Sprite(0, G.H * 0.52).loadImage('preload/images/newgrounds_logo.png');
    this.ng.setGraphicSize(Math.floor(this.ng.width * 0.8)); this.ng.updateHitbox(); this.ng.screenCenter('x');
    this.beat = new G.MenuBeat();
    this.lastBeat = 0;
    // the music starts once the title's pictures are decoded, so the intro lines stay on the beat
    G.A.afterLoad(() => { if (G.screen === this) G.menuMusic.start(G.audio.music.current() ? 0 : 4); });
    if (this.initialized || p.skipIntro) this.skipIntro(true);
  },
  // FNF Alphabet lines in the middle of the black intro (letter layouts cached)
  alpha(str) { this._al = this._al || new Map(); let a = this._al.get(str); if (!a) { a = new G.Alphabet(str, true, 0, 0); this._al.set(str, a); } return a; },
  coolText(list) { this.lines = list.map(s => s); },
  moreText(s) { this.lines.push(s.trim()); },
  skipIntro(quiet) {
    if (this.skipped) return;
    this.skipped = true; this.ngVisible = false; this.lines = [];
    this.flashA = 1; this.flashD = this.initialized || quiet ? 1 : 4;
    this.initialized = true;
  },
  introBeat(b) {
    switch (b) {
      case 1: this.coolText(['The Funkin Crew Inc', 'and ven/jason']); break;
      case 3: this.moreText('present'); break;
      case 4: this.lines = []; break;
      case 5: this.coolText(['In association', 'with']); break;
      case 7: this.moreText('newgrounds'); this.ngVisible = true; break;
      case 8: this.lines = []; this.ngVisible = false; break;
      case 9: this.coolText([this.wacky[0] || '']); break;
      case 11: this.moreText(this.wacky[1] || ''); break;
      case 12: this.lines = []; break;
      case 13: this.moreText('Friday'); break;
      case 14: this.moreText(this.wacky[0] === 'trending' ? 'Nigth' : 'Night'); break;
      case 15: this.moreText('Funkin 2'); break;
      case 16: this.skipIntro(); break;
    }
  },
  onBeat(b) {
    if (!this.skipped) {
      // like FNF: run every beat we may have skipped (window dragged etc.)
      for (let i = this.lastBeat + 1; i <= b; i++) this.introBeat(i);
      this.lastBeat = Math.max(this.lastBeat, b);
      return;
    }
    this.logo.play('bump', true); this.logoBumpT = 0;
    this.danceLeft = !this.danceLeft;
    this.gf.play(this.danceLeft ? 'danceRight' : 'danceLeft', true);
  },
  update(dt) {
    this.t += dt;
    if (G.audioRunning()) { if (!this.heardAudio) this.heardAt = this.t; this.heardAudio = true; }
    this.beat.update(b => this.onBeat(b));
    this.logo.update(dt); this.gf.update(dt); this.enterText.update(dt);
    this.logoBumpT = (this.logoBumpT || 0) + dt;
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt / this.flashD);
    if (this.transitioning) { this.transT += dt; if (this.transT >= 2 && !this.left) this.goMain(); }
  },
  accept() {
    // the very first press only switches the sound on (browser rule), it doesn't skip anything
    if (!this.heardAudio) return;
    if (!this.skipped) { if (this.initialized) this.skipIntro(); else if (this.t > 0.3) this.skipIntro(); return; }
    if (this.transitioning) { this.goMain(); return; }
    this.enterText.play('press', true);
    if (G.settings.flashing) { this.flashA = 1; this.flashD = 1; }
    G.sfx('confirm', { vol: 0.7 });
    this.transitioning = true; this.transT = 0;
  },
  goMain() { if (this.left) return; this.left = true; G.setScreen('mainMenu', {}); },
  leave() { this.left = false; },
  onAction(a, down, repeat) { if (down && !repeat && a === 'accept') this.accept(); },
  onPointer(type) { if (type === 'down') this.accept(); },
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
    if (!this.skipped) {
      // intro: bold Alphabet lines, 60px apart, starting at y=200
      this.lines.forEach((s, i) => {
        if (!s) return;
        const a = this.alpha(s);
        a.x = (G.W - a.width) / 2; a.y = 200 + i * 60; a.t = this.t;
        a.draw(ctx, null);
      });
      if (this.ngVisible) this.ng.draw(ctx, null);
      // browsers keep sound off until the first click/key: say so instead of a frozen black screen
      if (!G.audioRunning()) G.vcr(ctx, G.touchMode || G.isTouchDevice ? 'Tap to start' : 'Click or press any key to start', G.W / 2, G.H / 2 - 16, { align: 'center', size: 32, alpha: 0.6 + 0.4 * Math.sin(this.t * 4) });
    } else {
      this.logo.draw(ctx, null);
      this.draw2(ctx);
      this.gf.draw(ctx, null);
      this.enterText.draw(ctx, null);
    }
    if (this.flashA > 0) { G.setScreenT(ctx); ctx.globalAlpha = this.flashA; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
  },
  // the "2" follows the logo's bump (same frame timing: big on the beat, settling after)
  draw2(ctx) {
    const img = G.logo2();
    const f = this.logo.cur ? this.logo.fi : 14;
    const bump = 1 + 0.06 * Math.max(0, 1 - f / 6);
    const s = 0.62 * bump;
    G.setScreenT(ctx);
    ctx.save();
    ctx.translate(this.logo.x + 812, this.logo.y + 430);
    ctx.rotate(0.12);
    ctx.scale(s, s);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  },
};

// ---------------------------------------------------------------- MAIN MENU
G.screens.mainMenu = {
  ITEMS: [
    { name: 'storymode', go: () => G.setScreen(G.screens.storyMenu ? 'storyMenu' : 'mainMenu', {}) },
    { name: 'freeplay', go: () => G.setScreen(G.screens.freeplay ? 'freeplay' : 'mainMenu', {}) },
    { name: 'options', go: () => G.setScreen(G.screens.options ? 'options' : 'mainMenu', { from: 'mainMenu' }) },
    { name: 'credits', go: () => G.setScreen(G.screens.credits ? 'credits' : 'mainMenu', {}) },
    { name: 'rankmode', go: () => G.setScreen(G.screens.freeplay ? 'freeplay' : 'mainMenu', { rankMode: true }) },
  ],
  sel: 0,
  enter() {
    G.menuMusic.start(0);
    this.cam = new G.FCam(1); this.cam.followRate = 0.06;
    this.bg = new G.Sprite(0, 0).loadImage('preload/images/menuBG.png');
    this.bg.setGraphicSize(Math.floor(G.W * 1.2)); this.bg.updateHitbox(); this.bg.screenCenter();
    this.bg.scroll.x = 0; this.bg.scroll.y = 0.17;
    this.magenta = new G.Sprite(0, 0).loadImage('preload/images/menuBGMagenta.png');
    this.magenta.setGraphicSize(Math.floor(this.bg.width)); this.magenta.updateHitbox();
    this.magenta.x = this.bg.x; this.magenta.y = this.bg.y; this.magenta.scroll.x = 0; this.magenta.scroll.y = 0.17; this.magenta.visible = false;
    const n = this.ITEMS.length, spacing = 160, top = (G.H - spacing * (n - 1)) / 2;
    this.items = this.ITEMS.map((it, i) => {
      const s = new G.Sprite(0, 0).loadSparrow('preload/images/mainmenu/' + it.name);
      s.addAnim('idle', it.name + ' idle', 24, true); s.addAnim('selected', it.name + ' selected', 24, true);
      s.cx = G.W / 2; s.cy = top + spacing * i; s.scroll.x = 0; s.scroll.y = 0.4;
      s.def = it; s.i = i;
      this.setAnim(s, 'idle');
      return s;
    });
    this.state = 'idle'; this.flick = 0; this.exitT = 0;
    this.select(this.sel, true);
    this.swipe = new G.Swipe();
    // the browser isn't using the graphics card: say so once (that alone makes everything lag)
    this.gpuWarn = !!(G.gpu && G.gpu.soft && !G._gpuWarned); G._gpuWarned = true;
  },
  // AtlasMenuItem "centered": x,y is the middle of the current frame
  setAnim(s, a) { s.play(a, true); s.updateHitbox(); s.x = s.cx; s.y = s.cy; s.offset.x = s.origin.x; s.offset.y = s.origin.y; },
  select(i, snap) {
    this.sel = (i + this.items.length) % this.items.length;
    this.items.forEach(s => this.setAnim(s, s.i === this.sel ? 'selected' : 'idle'));
    const s = this.items[this.sel];
    if (snap) this.cam.focus(G.W / 2, s.cy); else this.cam.follow(G.W / 2, s.cy);
  },
  accept() {
    if (this.state !== 'idle') return;
    G.sfx('confirm', { vol: 0.7 });
    this.state = 'flicker'; this.flick = 0;
  },
  back() {
    if (this.state !== 'idle') return;
    G.sfx('cancel', { vol: 0.7 });
    this.state = 'leaving';
    G.setScreen('title', { skipIntro: true });
  },
  onAction(a, down, repeat) {
    if (this.gpuWarn) { if (down && !repeat && (a === 'accept' || a === 'back')) { this.gpuWarn = false; G.sfx('confirm', { vol: 0.5 }); } return true; }
    if (!down || this.state !== 'idle') return;
    if (a === 'ui_up' || a === 'ui_down') { G.sfx('scroll', { vol: 0.4 }); this.select(this.sel + (a === 'ui_up' ? -1 : 1)); }
    else if (a === 'accept' && !repeat) this.accept();
    else if (a === 'back' && !repeat) this.back();
  },
  onWheel(dir) { if (this.state === 'idle') { G.sfx('scroll', { vol: 0.4 }); this.select(this.sel + dir); } },
  onPointer(type, x, y) {
    if (this.gpuWarn) { if (type === 'down') this.gpuWarn = false; return; }
    if (this.state !== 'idle' || type !== 'down') return;
    // tap an item: first tap selects, tap the selected one confirms (like FNF mobile)
    for (const s of this.items) {
      const sy = this.screenY(s);
      if (Math.abs(y - sy) < 70 && Math.abs(x - G.W / 2) < s.width / 2 + 30) {
        if (s.i === this.sel) this.accept(); else { G.sfx('scroll', { vol: 0.4 }); this.select(s.i); }
        return;
      }
    }
  },
  screenY(s) { return (s.cy - (this.cam.y - G.H / 2) * s.scroll.y); },
  update(dt) {
    for (const s of this.items) s.update(dt);
    this.cam.update(dt);
    if (this.state === 'flicker') {
      this.flick += dt;
      // magenta bg flickers 1.1s at 0.15s, the chosen item 1s at 0.06s (FlxFlicker)
      this.magenta.visible = G.settings.flashing && this.flick < 1.1 && Math.floor(this.flick / 0.15) % 2 === 0;
      const s = this.items[this.sel];
      s.visible = this.flick >= 1 || Math.floor(this.flick / 0.06) % 2 === 0;
      if (this.flick >= 1) { this.state = 'exiting'; this.exitT = 0; s.visible = false; }
    } else if (this.state === 'exiting') {
      this.exitT += dt;
      for (const s of this.items) if (s.i !== this.sel) s.alpha = Math.max(0, 1 - G.ease.quadOut(Math.min(1, this.exitT / 0.4)));
      if (this.exitT >= 0.4 && !this.went) { this.went = true; this.items[this.sel].def.go(); }
    }
  },
  leave() { this.went = false; this.state = 'idle'; for (const s of this.items || []) { s.alpha = 1; s.visible = true; } if (this.magenta) this.magenta.visible = false; },
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
    this.bg.draw(ctx, this.cam);
    this.magenta.draw(ctx, this.cam);
    for (const s of this.items) s.draw(ctx, this.cam);
    G.vcr(ctx, 'FNF 2 v1.0', 5, G.H - 22, { size: 16, outline: 1.5 });
    if (this.gpuWarn) {
      G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, G.W, G.H);
      const L = [
        ['YOUR BROWSER IS NOT USING YOUR GRAPHICS CARD', 34, '#ff5a5a'],
        ['That is why FNF 2 lags and spikes. To fix it:', 26, '#ffffff'],
        ['', 14, '#fff'],
        ['Chrome / Edge:  Settings  >  System', 26, '#ffe14d'],
        ['turn ON  "Use graphics acceleration when available"', 26, '#ffe14d'],
        ['then press RELAUNCH', 26, '#ffe14d'],
        ['', 14, '#fff'],
        ['Still on? Update your NVIDIA driver, then check chrome://gpu', 22, '#cfcfcf'],
        ['(it should say "Hardware accelerated" next to Canvas)', 22, '#cfcfcf'],
        ['', 18, '#fff'],
        ['Press ENTER to keep going', 24, '#ffffff'],
      ];
      let y = 150; for (const [t, sz, col] of L) { if (t) G.vcr(ctx, t, G.W / 2, y, { size: sz, align: 'center', color: col, outline: 2 }); y += sz + 14; }
      G.vcr(ctx, 'Renderer: ' + G.gpu.name.slice(0, 80), G.W / 2, G.H - 40, { size: 16, align: 'center', color: '#8a8a8a', outline: 1 });
    }
  },
};

// ---------------------------------------------------------------- shared helpers
// FlxSprite.color (multiply tint) as a cached tinted copy of an image
G.tinted = function (img, color) {
  if (!img) return null;
  const key = 'tint:' + (img.src ? img.src.length + ':' + img.src.slice(-40) : img.width + 'x' + img.height) + ':' + color;
  return G.cached(key, img.width, img.height, (c) => {
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = 'multiply'; c.fillStyle = color; c.fillRect(0, 0, img.width, img.height);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(img, 0, 0);
  });
};
// Funkin' MathUtil.smoothLerpPrecision: reach 99% of the way in `dur` seconds
G.smoothLerp = (a, b, dt, dur) => G.lerp(a, b, 1 - Math.pow(0.01, dt / dur));
G.fmtMoney = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// a LevelProp / Bopper built from a week's prop data
G.makeProp = function (pd) {
  const s = new G.Sprite(0, 0);
  const base = G.A.imagePath(pd.assetPath, 'preload');
  if (pd.animations && pd.animations.length) {
    s.loadSparrow(base); s.useAnimOffsets = true;
    for (const a of pd.animations) { s.addAnim(a.name, a.prefix, a.frameRate || 24, !!a.looped, a.frameIndices && a.frameIndices.length ? a.frameIndices : null); s.animOffsets[a.name] = a.offsets || [0, 0]; }
  } else s.loadImage(base + '.png');
  const sc = (pd.scale != null ? pd.scale : 1) * (pd.isPixel ? 6 : 1);
  s.scale.x = s.scale.y = sc; s.antialias = !pd.isPixel; s.alpha = pd.alpha != null ? pd.alpha : 1;
  s.x = pd.offsets ? pd.offsets[0] : 0; s.y = pd.offsets ? pd.offsets[1] : 0;
  s.flipX = !!pd.flipX; s.danceEvery = pd.danceEvery != null ? pd.danceEvery : 1;
  s.dance = function (force) {
    if (this.animName === 'confirm' && !this.finished) return;
    if (this.anims.danceLeft) { this._d = !this._d; this.play(this._d ? 'danceRight' : 'danceLeft', true); }
    else if (this.anims.idle) this.play('idle', true);
  };
  s.dance(true);
  return s;
};

// ---------------------------------------------------------------- STORY MODE
G.screens.storyMenu = {
  sel: 0, diff: 'normal',
  enter() {
    G.menuMusic.start(0);
    this.beat = new G.MenuBeat();
    this.levels = (G.availableWeeks ? G.availableWeeks() : ['tutorial', 'week1']).map(id => ({ id, data: G.A.json('preload/data/levels/' + id + '.json') })).filter(l => l.data && l.data.visible !== false && !(G.OWN_SONG_WEEKS && G.OWN_SONG_WEEKS.has(l.id))); // visible:false = freeplay only (for now)
    this.player = G.settings.player === 'pico' ? 'pico' : 'bf';
    this.sel = G.clamp(this.sel, 0, this.levels.length - 1);
    // week titles under the yellow band
    this.titles = this.levels.map((l, i) => {
      const img = G.A.image('preload/images/' + l.data.titleAsset + '.png');
      return { img, y: 456 + 10 + (img ? img.height + 20 : 120) * i, targetY: 0, flashing: false, ft: 0, cyan: false };
    });
    this.arrows = { l: new G.Sprite(G.W - 410, 480).loadSparrow('preload/images/storymenu/ui/arrows'), r: new G.Sprite(G.W - 35, 480).loadSparrow('preload/images/storymenu/ui/arrows') };
    this.arrows.l.addAnim('idle', 'leftIdle0', 24, false); this.arrows.l.addAnim('press', 'leftConfirm0', 24, false); this.arrows.l.play('idle');
    this.arrows.r.addAnim('idle', 'rightIdle0', 24, false); this.arrows.r.addAnim('press', 'rightConfirm0', 24, false); this.arrows.r.play('idle');
    this.diffSprites = {};
    this.bgColor = '#F9CF51'; this.bgFrom = '#F9CF51'; this.bgT = 1;
    this.scoreLerp = 0; this.selected = false; this.leaving = false; this.fade = 0;
    this.props = [];
    this.changeLevel(0, true);
    this.swipe = new G.Swipe();
  },
  level() { return this.levels[this.sel]; },
  // difficulties every song of the week has (for the current player)
  diffList() {
    const songs = this.level().data.songs || [];
    let list = null;
    for (const s of songs) {
      const d = G.Songs.difficulties(s, this.player).map(x => x.diff);
      list = list ? list.filter(x => d.includes(x)) : d;
    }
    if (!list || !list.length) list = ['easy', 'normal', 'hard'];
    return G.DIFF_ORDER.filter(d => list.includes(d));
  },
  diffSprite(d) {
    if (this.diffSprites[d]) return this.diffSprites[d];
    const base = 'preload/images/storymenu/difficulties/' + d;
    const s = new G.Sprite(0, 0);
    if (G.A.has(base + '.xml')) { s.loadSparrow(base); s.addAnim('idle', 'idle0', 24, true); if (G.settings.flashing) s.play('idle', true); }
    else s.loadImage(base + '.png');
    this.diffSprites[d] = s;
    return s;
  },
  buildDiff() {
    const s = this.diffSprite(this.diff), ref = this.diffSprite('normal');
    s.x = this.arrows.l.x + this.arrows.l.width + 10 + (ref.width - s.width) / 2;
    s.alpha = 0; s.y = this.arrows.l.y - 15;
    s.tween = { t: 0, y0: s.y, y1: this.arrows.l.y + 10 - (s.height - ref.height) / 2 };
    this.curDiff = s;
  },
  changeLevel(ch, first) {
    const n = this.levels.length;
    this.sel = (this.sel + ch + n) % n;
    const L = this.level().data;
    { const fx = G.StoryFX && G.StoryFX[this.level().id]; if (fx && fx.hover) try { fx.hover(this); } catch (e) {} }   // (its pictures get ready)
    // background colour tween (0.9s quartOut)
    const col = (L.background || '#F9CF51').startsWith('#') ? L.background : '#F9CF51';
    if (!first && col !== this.bgColor) { this.bgFrom = this.curBg(); this.bgT = 0; }
    this.bgColor = col;
    this.buildProps();
    this.changeDiff(0, true);
    // titles: selected one at y=480, others stacked around it
    const t = this.titles, i0 = this.sel;
    t[i0].targetY = 480;
    for (let i = i0 - 1; i >= 0; i--) t[i].targetY = t[i + 1].targetY - Math.max((t[i].img ? t[i].img.height : 100) + 20, 125);
    for (let i = i0 + 1; i < t.length; i++) t[i].targetY = t[i - 1].targetY + (t[i - 1].img ? t[i - 1].img.height : 100) + 20;
    if (first) for (const x of t) x.y = x.targetY;
  },
  curBg() { return this.bgT >= 1 ? this.bgColor : G.mixColor(this.bgFrom, this.bgColor, G.ease.quartOut ? G.ease.quartOut(this.bgT) : 1 - Math.pow(1 - this.bgT, 4)); },
  buildProps() {
    const L = this.level().data;
    this.props = (L.props || []).map((pd, i) => {
      let d = pd;
      // player switch: show our chosen player in the middle slot
      if (this.player === 'pico' && /props\/bf$/.test(pd.assetPath)) d = Object.assign({}, pd, { assetPath: 'storymenu/props/pico-player' });
      const s = G.makeProp(d);
      s.x = (pd.offsets ? pd.offsets[0] : 0) + G.W * 0.25 * i;
      return s;
    });
  },
  changeDiff(ch, quiet) {
    const list = this.diffList();
    let i = list.indexOf(this.diff); if (i < 0) i = Math.max(0, list.indexOf('normal'));
    i = (i + ch + list.length) % list.length;
    const changed = list[i] !== this.diff || !this.curDiff;
    this.diff = list[i];
    this.arrowsVisible = list.length > 1;
    if (changed) { this.buildDiff(); if (!quiet) G.sfx('scroll', { vol: 0.4 }); }
    this.highScore = G.getWeekScore(this.level().id, this.diff, this.player);
  },
  select() {
    if (this.selected) return;
    this.selected = true; this.selT = 0;
    G.sfx('confirm');
    this.titles[this.sel].flashing = true;
    for (const p of this.props) if (p.anims.confirm) p.play('confirm', true);
    // (a mod's own week pick: Tricky's jaws close over the screen)
    this.fx = G.StoryFX && G.StoryFX[this.level().id] || null;
    if (this.fx && this.fx.select) try { this.fx.select(this); } catch (e) { G.reportError(e, 'story fx'); this.fx = null; }
  },
  startWeek() {
    const L = this.level();
    G.settings.player = this.player; G.saveSettings();
    G.setScreen('play', { mode: 'story', week: L.id, songs: L.data.songs.slice(), songIndex: 0, diff: this.diff, variation: this.variationFor(L.data.songs[0]), player: this.player, weekStats: null, deaths: 0 });
  },
  variationFor(song) { const d = G.Songs.difficulties(song, this.player).find(x => x.diff === this.diff); return d ? d.variation : null; },
  togglePlayer() {
    this.player = this.player === 'pico' ? 'bf' : 'pico';
    G.sfx('scroll', { vol: 0.4 });
    this.buildProps(); this.changeDiff(0, true);
  },
  onAction(a, down, repeat) {
    if (a === 'ui_left' || a === 'ui_right') { const arr = a === 'ui_left' ? this.arrows.l : this.arrows.r; arr.play(down ? 'press' : 'idle', true); }
    if (!down || this.selected || this.leaving) return;
    if (a === 'ui_up') { this.changeLevel(-1); G.sfx('scroll', { vol: 0.4 }); }
    else if (a === 'ui_down') { this.changeLevel(1); G.sfx('scroll', { vol: 0.4 }); }
    else if (a === 'ui_left') this.changeDiff(-1);
    else if (a === 'ui_right') this.changeDiff(1);
    else if (a === 'tab' && !repeat) this.togglePlayer();
    else if (a === 'accept' && !repeat) this.select();
    else if (a === 'back' && !repeat) { this.leaving = true; G.sfx('cancel'); G.setScreen('mainMenu', {}); }
  },
  onWheel(dir) { if (!this.selected) { this.changeLevel(dir); G.sfx('scroll', { vol: 0.4 }); } },
  onPointer(type, x, y) {
    if (this.selected || this.leaving) return;
    const sw = this.swipe.handle(type, x, y);
    if (!sw) return;
    if (sw.dir === 'up') { this.changeLevel(1); G.sfx('scroll', { vol: 0.4 }); }
    else if (sw.dir === 'down') { this.changeLevel(-1); G.sfx('scroll', { vol: 0.4 }); }
    else if (sw.dir === 'tap') {
      if (x > this.arrows.l.x - 20 && x < this.arrows.l.x + 60 && Math.abs(y - 510) < 60) this.changeDiff(-1);
      else if (x > this.arrows.r.x - 30 && Math.abs(y - 510) < 60) this.changeDiff(1);
      else if (y < 120 && x > G.W - 260) { this.leaving = true; G.sfx('cancel'); G.setScreen('mainMenu', {}); }
      else if (y > 100 && y < 456 && x > G.W * 0.25 && x < G.W * 0.75) this.togglePlayer();
      else if (y > 456) this.select();
    }
  },
  update(dt) {
    this.beat.update(b => { for (const p of this.props) if (p.danceEvery > 0 && b % Math.max(1, Math.round(p.danceEvery)) === 0) p.dance(); });
    for (const p of this.props) p.update(dt);
    this.arrows.l.update(dt); this.arrows.r.update(dt);
    if (this.curDiff) {
      const s = this.curDiff; s.update(dt);
      if (s.tween) { s.tween.t += dt; const k = Math.min(1, s.tween.t / 0.07); s.y = G.lerp(s.tween.y0, s.tween.y1, k); s.alpha = k; if (k >= 1) s.tween = null; }
    }
    if (this.bgT < 1) this.bgT = Math.min(1, this.bgT + dt / 0.9);
    for (const t of this.titles) {
      t.y = G.smoothLerp(t.y, t.targetY, dt, 0.451);
      if (t.flashing) { t.ft += dt; if (t.ft >= 1 / 20) { t.ft %= 1 / 20; t.cyan = !t.cyan; } }
    }
    this.scoreLerp = Math.abs(this.scoreLerp - this.highScore) < 1 ? this.highScore : G.smoothLerp(this.scoreLerp, this.highScore, dt, 0.307);
    if (this.selected) {
      if (this.fx && this.fx.update) this.fx.update(this, dt);
      this.selT += dt;
      if (this.selT >= 1) this.fade = Math.min(1, (this.selT - 1) / 0.2);
      if (this.selT >= 1.2 && !this.started) { this.started = true; this.startWeek(); }
    }
  },
  leave() { this.started = false; this.selected = false; this.leaving = false; this.fade = 0; this.fx = null; for (const t of this.titles || []) { t.flashing = false; t.cyan = false; } },
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
    // week titles (behind the black bar + band, like zIndex 15)
    this.titles.forEach((t, i) => {
      if (!t.img) return;
      const img = t.cyan ? G.tinted(t.img, '#33ffff') : t.img;
      ctx.globalAlpha = i === this.sel ? 1 : 0.6;
      ctx.drawImage(img, Math.round((G.W - t.img.width) / 2), Math.round(t.y));
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, 456);
    ctx.fillStyle = this.curBg(); ctx.fillRect(0, 56, G.W, 400);
    for (const p of this.props) p.draw(ctx, null);
    G.setScreenT(ctx);
    // tracks
    const songs = (this.level().data.songs || []).map(id => { const m = G.Songs.meta(id); return m ? m.songName : id; });
    const lines = ['TRACKS', ''].concat(songs);
    const tx = G.W / 2 - G.W * 0.33;
    lines.forEach((s, i) => G.text(ctx, s, tx, 556 + i * 32, { font: 'vcr', size: 32, color: '#E55777', align: 'center', baseline: 'top' }));
    // difficulty selector
    if (this.arrowsVisible) { this.arrows.l.draw(ctx, null); this.arrows.r.draw(ctx, null); }
    if (this.curDiff) this.curDiff.draw(ctx, null);
    G.setScreenT(ctx);
    G.text(ctx, 'LEVEL SCORE: ' + G.fmtMoney(this.scoreLerp), 10, 10, { font: 'vcr', size: 32, baseline: 'top' });
    G.text(ctx, this.level().data.name || '', G.W - 10, 10, { font: 'vcr', size: 32, baseline: 'top', align: 'right', alpha: 0.7 });
    G.text(ctx, 'TAB: switch to ' + (this.player === 'pico' ? 'BOYFRIEND' : 'PICO'), G.W - 10, G.H - 30, { font: 'vcr', size: 18, align: 'right', alpha: 0.6 });
    if (this.selected && this.fx && this.fx.draw) { this.fx.draw(this, ctx); G.setScreenT(ctx); }
    if (this.fade > 0 && !(this.selected && this.fx && this.fx.noFade)) { ctx.globalAlpha = this.fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
  },
};
