// FNF 2 - PlayState. Rebuilt from the Funkin' engine rules: strumlines, notes, hold
// trails, splashes, hold covers, PBOT1 scoring, health, combo popups, countdown,
// camera focus/bops, song events, pause menu, game over. Uses FNF's real assets.
(function () {
  const PX_PER_MS = 0.45, HIT_WINDOW = 160, STRUM_SIZE = 104, SPACING = 112, INITIAL_OFFSET = -0.275 * STRUM_SIZE, NUDGE = 2;
  const DIR = ['Left', 'Down', 'Up', 'Right'], DIRL = ['left', 'down', 'up', 'right'], COLOR = ['Purple', 'Blue', 'Green', 'Red'];
  const SPLASH = { left: ['note impact 1 purple0', 'note impact 2 purple0'], down: ['note impact 1  blue0', 'note impact 2 blue0'], up: ['note impact 1 green0', 'note impact 2 green0'], right: ['note impact 1 red0', 'note impact 2 red0'] };
  const H = { max: 2, killer: 0.04, sick: 0.03, good: 0.015, bad: 0, shit: -0.02, miss: -0.08, holdPerSec: 0.12 };
  const ACC = { killer: 1, sick: 1, good: 0.67, bad: 0.34, shit: 0 }; // Psych-style accuracy
  function scorePBOT1(ms) { ms = Math.abs(ms); if (ms > 160) return -100; if (ms < 5) return 500; const f = 1 - 1 / (1 + Math.exp(-0.08 * (ms - 54.99))); return Math.floor(500 * f + 9); }
  function judge(ms) { ms = Math.abs(ms); return ms <= 12.5 ? 'killer' : ms <= 45 ? 'sick' : ms <= 90 ? 'good' : ms <= 135 ? 'bad' : 'shit'; }
  function ratingName(p) { // Psych rating names
    if (p >= 1) return 'Perfect!!'; if (p >= 0.9) return 'Sick!'; if (p >= 0.8) return 'Great'; if (p >= 0.7) return 'Good'; if (p >= 0.69) return 'Nice';
    if (p >= 0.6) return 'Meh'; if (p >= 0.5) return 'Bruh'; if (p >= 0.4) return 'Bad'; if (p >= 0.2) return 'Shit'; return 'You Suck!';
  }
  const EASES = {
    linear: t => t, quadIn: t => t * t, quadOut: t => 1 - (1 - t) * (1 - t), quadInOut: G.ease.quadInOut, cubeIn: t => t * t * t, cubeOut: G.ease.cubeOut, cubeInOut: G.ease.cubeInOut,
    sineIn: t => 1 - Math.cos(t * Math.PI / 2), sineOut: t => Math.sin(t * Math.PI / 2), sineInOut: G.ease.sineInOut, expoOut: G.ease.expoOut, expoIn: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
    expoInOut: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2, backOut: G.ease.backOut, elasticOut: G.ease.elasticOut,
    circOut: t => Math.sqrt(1 - Math.pow(t - 1, 2)), quartOut: t => 1 - Math.pow(1 - t, 4), quartInOut: t => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  };
  const easeFn = (name, dir) => { const k = (name || 'linear') + (dir || ''); return EASES[k] || EASES[name] || EASES.linear; };

  // ---------------------------------------------------------------- note style (FNF "funkin" style)
  const NS = {
    get notes() { return G.Sparrow.load('shared/images/notes'); },
    get strum() { return G.Sparrow.load('shared/images/noteStrumline'); },
    get splash() { return G.Sparrow.load('shared/images/noteSplashes'); },
    cover(i) { return G.Sparrow.load('shared/images/holdCover' + COLOR[i]); },
    get hold() { return G.A.image('shared/images/NOTE_hold_assets.png') || G.A.image('preload/images/NOTE_hold_assets.png'); },
  };
  function makeStrum(i, player) {
    const s = new G.Sprite(0, 0);
    s.loadSparrow('shared/images/noteStrumline');
    s.addAnim('static', 'static' + DIR[i] + '0', 24, false);
    s.addAnim('press', 'press' + DIR[i] + '0', 24, false);
    s.addAnim('confirm', 'confirm' + DIR[i] + '0', 24, false);
    s.addAnim('confirm-hold', 'confirmHold' + DIR[i], 24, true) || s.addAnim('confirm-hold', 'confirm' + DIR[i] + '0', 24, true);
    s.scale.x = s.scale.y = 0.7;
    s.play('static', true); s.updateHitbox();
    s.dir = i; s.player = player; s.confirmHold = -1;
    s.playA = function (n, force) { this.play(n, force); centerOffsets(this); if (n === 'confirm') { this.offset.x -= 13; this.offset.y -= 13; } };
    return s;
  }
  function centerOffsets(s) { s.offset.x = (s.frameW - s.width) * 0.5; s.offset.y = (s.frameH - s.height) * 0.5; s.origin.x = s.frameW / 2; s.origin.y = s.frameH / 2; }

  // ---------------------------------------------------------------- PlayState
  const P = G.screens.play = {
    enter(params) {
      this.params = params = Object.assign({ mode: 'freeplay', songs: ['tutorial'], songIndex: 0, diff: 'normal', variation: null, week: null, weekStats: null, deaths: 0 }, params);
      this.ready = false; this.failed = null; this.cutscene = null;
      this.song = G.Songs.build(params.songs[params.songIndex], params.diff, params.variation);
      if (!this.song) { this.failed = 'Missing chart: ' + params.songs[params.songIndex] + ' (' + params.diff + ')'; return; }
      this.setupWorld();
      this.setupHUD();
      this.resetRun();
      G.audio.music.stop(0.2);
      G.audio.preload(['miss1', 'miss2', 'miss3', 'intro3', 'intro2', 'intro1', 'introGo']);
      G.audio.song({ inst: this.song.inst, voices: this.song.voices, rate: G.settings.songSpeed }).then(h => {
        if (G.screen !== this) return;
        this.audio = h; this.ready = true;
        // a song's own intro cutscene (first try only)
        const cs = G.Cutscenes && G.Cutscenes[this.song.id];
        if (cs && !params.deaths && !params.noCutscene) { try { this.cutscene = cs.create(this); } catch (e) { G.reportError(e, 'cutscene'); this.cutscene = null; } }
        if (!this.cutscene) this.startCountdown();
      });
    },
    leave() { if (this.audio) this.audio.stop(); this.audio = null; G.audio.music.stop(0.1); },
    // -------------------------------------------------- world: stage + characters + cameras
    setupWorld() {
      const s = this.song;
      this.stage = new G.Stage(s.stage);
      const mk = (id, slot, fallback) => { let cid = id; if (!G.A.json('preload/data/characters/' + cid + '.json')) cid = fallback; if (!cid) return null; const c = new G.Character(cid, slot); this.stage.addCharacter(c, slot); return c; };
      this.gf = s.chars.gf ? mk(s.chars.gf, 'gf', 'gf') : null;
      this.dad = mk(s.chars.opponent, 'dad', 'dad');
      this.bf = mk(s.chars.player, 'bf', 'bf');
      // tutorial: GF is the opponent, standing at GF's spot
      if (s.chars.opponent === s.chars.gf && this.gf) { this.dad.x = this.gf.x; this.dad.y = this.gf.y; this.dad.camFocus = Object.assign({}, this.gf.camFocus); this.stage.chars.gf = null; this.gf = null; this.dad.zIndex = 100; }
      // WRATH: the giant eye (stage 2) is made up front so the swap at the eye-open never hitches
      this.dadForms = null;
      if (this.dad && s.events.some(e => e.e === 'WrathEye')) {
        const eye = new G.Character('wrath-eye', 'dad');
        this.stage.addCharacter(eye, 'dad'); this.stage.addCharacter(this.dad, 'dad');
        this.dadForms = [this.dad, eye];
      }
      const sfx = G.SongFX && G.SongFX[s.id]; if (sfx && sfx.setup) sfx.setup(this);
      this.applyStageFX();
      this.stageZoom = this.stage.zoom;
      this.cam = new G.FCam(this.stageZoom);
      this.hud = new G.HudCam();
      this.camZoom = this.stageZoom; this.bopMul = 1; this.hudZoom = 1;
      this.zoomRate = 4; this.bopIntensity = 1.015; this.hudBopIntensity = 0.03;
      this.camTween = null; this.zoomTween = null;
      const f = this.dad.camFocus; this.cam.focus(f.x, f.y);
    },
    // Erect stages tint the characters (AdjustColorShader in the original) -> CSS filters on the sprite buffer
    applyStageFX() {
      const fx = {
        mainStageErect: { bf: { brightness: -23, hue: 12, contrast: 7 }, gf: { brightness: -30, hue: -9, contrast: -4 }, dad: { brightness: -33, hue: -32, contrast: -23 } },
      }[this.stage.id];
      this.charFilter = {};
      if (!fx) return;
      for (const k in fx) { const a = fx[k]; this.charFilter[k] = `brightness(${(100 + a.brightness * 0.9).toFixed(0)}%) contrast(${(100 + a.contrast).toFixed(0)}%) hue-rotate(${a.hue}deg)`; }
      for (const p of this.stage.props) if (['brightLightSmall', 'orangeLight', 'lightgreen', 'lightred', 'lightAbove'].includes(p.name)) p.blend = 'lighter';
    },
    // -------------------------------------------------- HUD: strumlines, health bar, icons
    setupHUD() {
      const st = G.settings;
      this.down = !!st.downscroll; this.middle = !!st.middlescroll;
      const y = this.down ? G.H - STRUM_SIZE - 24 : 24;
      this.lines = [
        { player: false, x: this.middle ? -9999 : 48, y, strums: [] },
        { player: true, x: this.middle ? G.W / 2 - SPACING * 2 : G.W / 2 + 48, y, strums: [] },
      ];
      for (const L of this.lines) for (let i = 0; i < 4; i++) {
        const s = makeStrum(i, L.player);
        s.x = L.x + i * SPACING + INITIAL_OFFSET; s.y = L.y;
        L.strums.push(s);
      }
      const speedSet = st.speedType === 'const' ? st.speedValue : st.speedType === 'mult' ? this.song.speed * st.speedValue : this.song.speed;
      this.scrollSpeed = speedSet / (st.songSpeed || 1) * (st.songSpeed || 1);
      // health bar (healthBar.png + fill), icons
      this.hbBg = new G.Sprite(0, 0).loadImage('shared/images/healthBar.png');
      this.hbBg.y = this.down ? G.H * 0.1 : G.H * 0.9; this.hbBg.screenCenter('x');
      this.iconP1 = this.makeIcon(this.bf, true);
      this.iconP2 = this.makeIcon(this.dad, false);
      this.popups = [];
      this.splashes = []; this.covers = [];
      this.countdownSpr = null;
    },
    swapDad(c) {
      this.stage.addCharacter(c, 'dad');
      this.dad = c; c.dance(true);
      this.iconP2 = this.makeIcon(c, false);
    },
    makeIcon(ch, player) {
      const id = (ch && ch.healthIcon && ch.healthIcon.id) || 'face';
      let img = G.A.image('preload/images/icons/icon-' + id + '.png') || G.A.image('preload/images/icons/icon-face.png');
      return { img, player, scale: 1, flip: player ? !(ch && ch.healthIcon.flipX) : !!(ch && ch.healthIcon.flipX), pixel: !!(ch && ch.healthIcon.isPixel) };
    },
    resetRun() {
      const s = this.song;
      this.notes = s.notes.map((n, i) => ({ i, t: n.t, lane: n.d % 4, line: n.d >= 4 ? 0 : 1, len: n.l, kind: n.k, hit: false, missed: false, holdEnd: n.t + n.l, holding: false, dropped: false, done: false, holdLeft: n.l }));
      this.evIdx = 0;
      this.health = 1; this.score = 0; this.misses = 0; this.combo = 0; this.maxCombo = 0;
      this.tally = { killer: 0, sick: 0, good: 0, bad: 0, shit: 0, miss: 0, total: 0 };
      this.accSum = 0; this.accN = 0;
      this.cond = new G.SongConductor(s.timeChanges);
      this.songPos = -this.cond.crochet * 5;
      this.cond.reset(this.songPos);
      this.ended = false; this.dead = false; this.paused = false; this.pauseMenu = null; this.gameOver = null;
      this.countBeat = -99; this.started = false;
      this.keys = [false, false, false, false];
      this.botplay = !!G.settings.botplay; this.practice = !!G.settings.practice;
      this.popups = []; this.splashes = []; this.covers = [];
      this.vocalsOn = true;
      for (const L of this.lines) for (const s2 of L.strums) { s2.playA('static', true); s2.confirmHold = -1; }
      this.snap = null; if (this.hud) this.hud.alpha = 1;
      if (this.dadForms) { this.dadForms[0]._locked = false; if (this.dad !== this.dadForms[0]) this.swapDad(this.dadForms[0]); else this.stage.chars.dad = this.dad; }
      this.iconP1.scale = this.iconP2.scale = 1;
    },
    // -------------------------------------------------- countdown
    startCountdown() {
      this.audio.play(this.songPos);
      this.started = true;
    },
    countdownBeat(b) {
      // beats -4..-1 before the song: THREE, TWO (ready), ONE (set), GO
      const steps = { [-4]: ['intro3', null], [-3]: ['intro2', 'ready'], [-2]: ['intro1', 'set'], [-1]: ['introGo', 'go'] }[b];
      if (!steps) return;
      G.sfx(steps[0], { vol: 0.6 });
      if (steps[1]) {
        const s = new G.Sprite(0, 0).loadImage('shared/images/ui/countdown/funkin/' + steps[1] + '.png');
        s.screenCenter(); s.born = this.songPos; s.y0 = s.y;
        this.countdownSpr = s;
      }
    },
    // -------------------------------------------------- per-frame
    update(dt) {
      if (this.failed || !this.ready) return;
      if (this.cutscene) { this.cutscene.update(dt); if (this.cutscene.done) { this.cutscene = null; this.startCountdown(); } return; }
      if (this.gameOver) { this.updateGameOver(dt); return; }
      if (this.paused) { this.updatePause(dt); return; }
      const prev = this.songPos;
      this.songPos = this.audio.time();
      if (this.songPos < prev - 50 && prev > 0) this.songPos = prev; // never jump back
      const jpos = this.songPos - (G.settings.offset || 0);
      this.cond.update(this.songPos, st => this.onStep(st), bt => this.onBeat(bt));
      this.processEvents();
      this.updateSnap(dt);
      this.updateNotes(jpos, dt);
      // characters, stage, cameras
      const stepSec = this.cond.stepCrochet / 1000;
      const holding = this.keys.some(k => k) || this.botHolding;
      for (const c of [this.gf, this.dad, this.bf]) if (c) c.tick(dt, stepSec, c === this.bf ? holding : false);
      this.stage.update(dt);
      this.updateCamera(dt);
      for (const L of this.lines) for (const s of L.strums) {
        s.update(dt); centerOffsets(s); if (s.animName === 'confirm') { s.offset.x -= 13; s.offset.y -= 13; }
        if (s.confirmHold >= 0) { s.confirmHold += dt; if (s.confirmHold >= 0.15) { s.confirmHold = -1; s.playA('static', true); } }
        if (s.player && s.animName === 'confirm' && s.finished && !this.botplay) { if (this.keys[s.dir]) s.playA('press', true); }
      }
      this.splashes = this.splashes.filter(sp => { sp.update(dt); return !sp.finished; });
      this.covers = this.covers.filter(cv => { cv.update(dt); if (cv.ending && cv.finished) return false; return true; });
      this.updatePopups(dt);
      // icons bop back to size
      this.iconP1.scale = 1 + (this.iconP1.scale - 1) * Math.pow(0.003, dt);
      this.iconP2.scale = 1 + (this.iconP2.scale - 1) * Math.pow(0.003, dt);
      if (this.health <= 0 && !this.practice && !this.botplay) this.die();
      else if (this.practice) this.health = Math.max(0.0001, this.health);
      if (!this.ended && this.started && this.songPos >= this.audio.length + 50) this.endSong();
    },
    onStep(step) {
      this.stage.onStep(step);
      for (const c of [this.gf, this.dad, this.bf]) if (c) { const n = Math.round(c.danceEvery * 4) || 4; if (((step % n) + n) % n === 0) c.dance(false); }
      if (step % 4 === 0) {
        const beat = step / 4;
        if (beat < 0) this.countdownBeat(beat);
      }
    },
    onBeat(beat) {
      this.iconP1.scale = this.iconP2.scale = 1.2;
      if (beat >= 0 && G.settings.camZoom && this.zoomRate > 0 && beat % this.zoomRate === 0 && this.camZoom * this.bopMul < 1.35 * this.stageZoom) {
        this.bopMul = this.bopIntensity; this.hudZoom += this.hudBopIntensity;
      }
    },
    // WRATH's snap cutscene (inside the song): HUD away, trembling, glitching into the eye at the end
    updateSnap(dt) {
      const sn = this.snap;
      if (!sn) { if (this.hud.alpha < 1 && !this.gameOver) this.hud.alpha = Math.min(1, this.hud.alpha + dt * 3); return; }
      this.hud.alpha = Math.max(0, this.hud.alpha - dt * 2.5);
      const k = G.clamp((this.songPos - sn.t0) / (sn.end - sn.t0), 0, 1);
      if (G.settings.flashing !== false) this.cam.shake(0.0015 + 0.006 * k * k, 0.05);
      // the last half second he flickers between himself and the eye
      const left = sn.end - this.songPos, F = this.dadForms;
      this.stage.chars.dad = left < 550 && Math.floor(left / 70) % 2 === 0 ? F[1] : F[0];
    },
    updateCamera(dt) {
      if (this.camTween) {
        const t = this.camTween; t.t += dt; const p = Math.min(1, t.t / t.dur); const e = t.ease(p);
        this.cam.x = this.cam.tx = t.x0 + (t.x1 - t.x0) * e; this.cam.y = this.cam.ty = t.y0 + (t.y1 - t.y0) * e;
        if (p >= 1) this.camTween = null;
      }
      if (this.zoomTween) { const t = this.zoomTween; t.t += dt; const p = Math.min(1, t.t / t.dur); this.camZoom = t.z0 + (t.z1 - t.z0) * t.ease(p); if (p >= 1) this.zoomTween = null; }
      const decay = Math.pow(0.05, dt);
      this.bopMul = 1 + (this.bopMul - 1) * decay;
      this.hudZoom = 1 + (this.hudZoom - 1) * decay;
      this.cam.zoom = this.camZoom * this.bopMul;
      this.hud.zoom = this.hudZoom;
      if (!this.camTween) this.cam.update(dt); else { this.cam.shakeT > 0 && this.cam.update(0); }
      this.hud.update(dt);
    },
    // -------------------------------------------------- song events
    processEvents() {
      const ev = this.song.events;
      while (this.evIdx < ev.length && ev[this.evIdx].t <= this.songPos) { this.handleEvent(ev[this.evIdx]); this.evIdx++; }
    },
    handleEvent(e) {
      const v = e.v;
      switch (e.e) {
        case 'FocusCamera': {
          let ch = v != null && typeof v === 'object' ? v.char : v; if (ch == null) ch = 0;
          let x = (v && v.x) || 0, y = (v && v.y) || 0;
          const tgt = ch === 0 ? this.bf : ch === 1 ? this.dad : ch === 2 ? (this.gf || this.dad) : null;
          if (tgt) { x += tgt.camFocus.x; y += tgt.camFocus.y; }
          const ease = (v && v.ease) || 'CLASSIC';
          if (ease === 'CLASSIC') { this.camTween = null; this.cam.follow(x, y); }
          else if (ease === 'INSTANT') { this.camTween = null; this.cam.focus(x, y); }
          else { const dur = ((v && v.duration) || 4) * this.cond.stepCrochet / 1000; this.camTween = { t: 0, dur: Math.max(0.001, dur), x0: this.cam.x, y0: this.cam.y, x1: x, y1: y, ease: easeFn(ease, v && v.easeDir) }; }
          break;
        }
        case 'PlayAnimation': {
          const map = { bf: this.bf, boyfriend: this.bf, player: this.bf, dad: this.dad, opponent: this.dad, gf: this.gf, girlfriend: this.gf };
          const c = map[v.target]; if (c) { c.playAnim(v.anim, !!v.force); if (c.isSinging && !c.animName.startsWith('sing')) c.holdTimer = 0; }
          break;
        }
        case 'ZoomCamera': {
          const z = (v.zoom || 1) * (v.mode === 'direct' ? 1 : this.stageZoom);
          if (v.ease === 'INSTANT') { this.camZoom = z; this.zoomTween = null; }
          else this.zoomTween = { t: 0, dur: Math.max(0.001, (v.duration || 4) * this.cond.stepCrochet / 1000), z0: this.camZoom, z1: z, ease: easeFn(v.ease || 'linear', v.easeDir) };
          break;
        }
        // WRATH snaps: zoom in on him, he looks down, face in shadow, trembling, HUD fades out
        case 'WrathSnap':
          if (this.dadForms) {
            const d = this.dadForms[0], eyeEv = this.song.events.find(x => x.e === 'WrathEye');
            this.snap = { t0: this.songPos, end: eyeEv ? eyeEv.t : this.songPos + 4000 };
            d.playAnim('snap', true); d._locked = true;
            const hx = d.x + d.width * 0.5, hy = d.y + d.height * 0.37, dur = 0.85;
            this.camTween = { t: 0, dur, x0: this.cam.x, y0: this.cam.y, x1: hx, y1: hy, ease: easeFn('expo', 'Out') };
            this.zoomTween = { t: 0, dur, z0: this.camZoom, z1: this.stageZoom * 1.55, ease: easeFn('expo', 'Out') };
          }
          break;
        // ...and turns into the giant eye
        case 'WrathEye':
          if (this.dadForms) {
            this.snap = null; this.dadForms[0]._locked = false;
            this.swapDad(this.dadForms[1]);
            this.camTween = null; this.zoomTween = { t: 0, dur: 0.6, z0: this.camZoom, z1: this.stageZoom, ease: easeFn('expo', 'Out') };
            const f = this.dad.camFocus; this.cam.focus(f.x, f.y);
            if (G.settings.flashing !== false) { this.cam.flash('#ff1e2e', 0.8); this.cam.shake(0.012, 0.6); }
          }
          break;
        case 'SetCameraBop': this.zoomRate = v.rate != null ? v.rate : 4; this.bopIntensity = 1 + ((v.intensity != null ? v.intensity : 1) * 0.015); this.hudBopIntensity = (v.intensity != null ? v.intensity : 1) * 0.03; break;
      }
    },
    // -------------------------------------------------- notes
    updateNotes(pos, dt) {
      const bot = this.botplay;
      this.botHolding = false;
      for (const n of this.notes) {
        if (n.done) continue;
        const L = this.lines[n.line];
        if (!L.player || bot) {
          // opponent (and botplay) hit notes exactly on time
          if (!n.hit && pos >= n.t) {
            n.hit = true; n.holding = n.len > 0;
            if (L.player) this.playerHit(n, 0, true); else this.oppHit(n);
          }
          if (n.hit && n.holding) {
            const s = L.strums[n.lane];
            if (pos < n.holdEnd) {
              if (L.player) { this.botHolding = true; this.holdTick(n, dt); }
              else {
                this.dad.holdTimer = 0; s.confirmHold = -1;
                if (s.animName === 'confirm' && s.finished) s.playA('confirm-hold', true);
                else if (s.animName !== 'confirm' && s.animName !== 'confirm-hold') s.playA('confirm', true);
              }
            } else { n.holding = false; n.done = true; if (L.player) this.finishHold(n); else s.confirmHold = 0; }
          } else if (n.hit && !n.holding) n.done = true;
          continue;
        }
        // player notes
        if (!n.hit && !n.missed && pos - n.t > HIT_WINDOW) { n.missed = true; this.noteMiss(n); if (n.len <= 0) n.done = true; }
        if (n.missed && pos > n.holdEnd + HIT_WINDOW) n.done = true;
        if (n.hit && n.holding) {
          if (pos >= n.holdEnd) { n.holding = false; n.done = true; this.finishHold(n); }
          else if (!this.keys[n.lane]) {
            // released early: tiny leeway at the very end, else it's a dropped hold
            if (n.holdEnd - pos < 80) { n.holding = false; n.done = true; this.finishHold(n); }
            else { n.holding = false; n.dropped = true; this.holdDrop(n, pos); }
          } else this.holdTick(n, dt);
        }
        if (n.dropped && pos > n.holdEnd) n.done = true;
      }
    },
    oppHit(n) {
      const s = this.lines[0].strums[n.lane];
      s.playA('confirm', true); s.confirmHold = n.len > 0 ? -1 : 0;
      const suffix = n.kind === 'alt' ? '-alt' : '';
      if (n.kind === 'hey') this.dad.playAnim('hey', true);
      else if (!this.dad._locked) { this.dad.lastNote = n; this.dad.sing(n.lane, false, suffix); }
      if (this.audio) this.audio.setVolume('o', 1);
    },
    // player pressed a lane
    press(lane) {
      if (this.botplay || !this.started) return;
      this.keys[lane] = true;
      const pos = this.songPos - (G.settings.offset || 0);
      const s = this.lines[1].strums[lane];
      let best = null;
      for (const n of this.notes) {
        if (n.done || n.hit || n.missed || n.line !== 1 || n.lane !== lane) continue;
        const diff = n.t - pos;
        if (Math.abs(diff) <= HIT_WINDOW && (!best || n.t < best.t)) best = n;
        if (diff > HIT_WINDOW) break;
      }
      if (best) { best.hit = true; best.holding = best.len > 0; this.playerHit(best, pos - best.t, false); }
      else {
        s.playA('press', true);
        if (!G.settings.ghostTapping) this.ghostMiss(lane);
      }
    },
    release(lane) {
      this.keys[lane] = false;
      const s = this.lines[1].strums[lane];
      if (!this.botplay) s.playA('static', true);
    },
    playerHit(n, diffMs, auto) {
      const s = this.lines[1].strums[n.lane];
      s.playA('confirm', true); s.confirmHold = auto ? 0 : -1;
      const r = auto ? 'sick' : judge(diffMs);
      const pts = auto ? 500 : scorePBOT1(diffMs);
      this.score += pts;
      this.health = Math.min(H.max, this.health + (H[r] || 0));
      this.tally[r]++; this.tally.total++;
      this.accSum += ACC[r]; this.accN++;
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (r === 'sick' || r === 'killer') this.splash(n.lane);
      if (G.settings.comboPopups !== false) { this.popRating(r === 'killer' ? 'sick' : r); if (this.combo >= 10) this.popCombo(this.combo); }
      const suffix = n.kind === 'alt' ? '-alt' : '';
      if (n.kind === 'hey') this.bf.playAnim('hey', true); else this.bf.sing(n.lane, false, suffix);
      if (this.audio) this.audio.setVolume('p', 1);
      if (this.gf && this.gf.anims['combo' + this.combo]) this.gf.playAnim('combo' + this.combo, true);
      if (n.len > 0) this.startCover(n);
      if (G.settings.hitsound > 0) G.sfx('preload/sounds/scrollMenu.ogg', { vol: G.settings.hitsound * 0.7 });
    },
    holdTick(n, dt) {
      this.health = Math.min(H.max, this.health + H.holdPerSec * dt);
      this.score += 250 * dt;
      this.bf.holdTimer = 0;
      const s = this.lines[1].strums[n.lane];
      if (s.animName === 'confirm' && s.finished) s.playA('confirm-hold', true);
    },
    finishHold(n) {
      const s = this.lines[1].strums[n.lane];
      if (this.botplay) { s.confirmHold = 0; } else s.playA(this.keys[n.lane] ? 'press' : 'static', true);
      const cv = this.covers.find(c => c.note === n); if (cv) { if (cv.hasAnim('end')) { cv.play('end', true); cv.ending = true; } else this.covers.splice(this.covers.indexOf(cv), 1); }
      this.score = Math.round(this.score);
    },
    holdDrop(n, pos) {
      const cv = this.covers.find(c => c.note === n); if (cv) this.covers.splice(this.covers.indexOf(cv), 1);
      this.breakCombo();
      if (this.audio) this.audio.setVolume('p', 0);
      G.sfx('miss' + (1 + Math.floor(Math.random() * 3)), { vol: 0.5 + Math.random() * 0.1 });
      this.bf.sing(n.lane, true);
      this.lines[1].strums[n.lane].playA('static', true);
      this.score = Math.round(this.score);
    },
    noteMiss(n) {
      this.health += H.miss;
      this.score += -100; this.misses++; this.tally.miss++; this.accN++;
      this.breakCombo();
      if (this.audio) this.audio.setVolume('p', 0);
      G.sfx('miss' + (1 + Math.floor(Math.random() * 3)), { vol: 0.5 + Math.random() * 0.1 });
      this.bf.sing(n.lane, true);
    },
    ghostMiss(lane) {
      this.health += H.miss; this.score -= 10; this.misses++; this.accN++;
      this.breakCombo();
      if (this.audio) this.audio.setVolume('p', 0);
      G.sfx('miss' + (1 + Math.floor(Math.random() * 3)), { vol: 0.5 + Math.random() * 0.1 });
      this.bf.sing(lane, true);
    },
    breakCombo() {
      if (this.gf && this.combo >= 70 && this.gf.anims.drop70) this.gf.playAnim('drop70', true);
      else if (this.gf && this.combo >= 5 && this.gf.anims.sad) this.gf.playAnim('sad', true);
      if (this.combo >= 10 && G.settings.comboPopups !== false) this.popCombo(0);
      this.combo = 0;
    },
    splash(lane) {
      if (!G.settings.noteSplashes) return;
      const sp = new G.Sprite(0, 0); sp.loadSparrow('shared/images/noteSplashes');
      const v = Math.floor(Math.random() * 2);
      sp.addAnim('s', SPLASH[DIRL[lane]][v], 24 + Math.floor(Math.random() * 5) - 2, false);
      sp.play('s', true); sp.updateHitbox();
      const L = this.lines[1];
      sp.x = L.x + lane * SPACING + INITIAL_OFFSET + 25; sp.y = L.y - INITIAL_OFFSET - 5;
      sp.offset.x = sp.width * 0.3; sp.offset.y = sp.height * 0.3;
      sp.alpha = 0.8;
      this.splashes.push(sp);
    },
    startCover(n) {
      const sheet = NS.cover(n.lane); if (!sheet) return;
      const cv = new G.Sprite(0, 0); cv.loadSparrow('shared/images/holdCover' + COLOR[n.lane]);
      cv.addAnim('start', 'holdCoverStart' + COLOR[n.lane], 24, false); cv.addAnim('hold', 'holdCover' + COLOR[n.lane], 24, true); cv.addAnim('end', 'holdCoverEnd' + COLOR[n.lane], 24, false);
      cv.play('start', true); cv.updateHitbox();
      cv.onFinish = name => { if (name === 'start') cv.play('hold', true); };
      cv.note = n; cv.lane = n.lane; cv.line = n.line;
      this.covers.push(cv);
    },
    // -------------------------------------------------- popups (rating + combo digits, on the HUD camera)
    popRating(r) {
      const img = G.A.image('preload/images/ui/popup/funkin/' + r + '.png'); if (!img) return;
      const s = new G.Sprite(0, 0).loadImage(img); s.scale.x = s.scale.y = 0.65; s.updateHitbox();
      s.x = G.W * 0.474 - s.width / 2; s.y = G.H * 0.45 - 60 - s.height / 2;
      s.vy = -(140 + Math.random() * 35); s.vx = -Math.random() * 10; s.ay = 550; s.life = this.cond.crochet / 1000 + 0.2; s.fadeAt = this.cond.crochet / 1000;
      this.popups.push(s);
    },
    popCombo(combo) {
      const digits = []; let c = combo;
      while (c !== 0) { digits.push(c % 10); c = Math.floor(c / 10); }
      while (digits.length < 3) digits.push(0);
      let loop = 1;
      for (const d of digits) {
        const img = G.A.image('preload/images/ui/popup/funkin/num' + d + '.png'); if (!img) continue;
        const s = new G.Sprite(0, 0).loadImage(img); s.scale.x = s.scale.y = 0.45; s.updateHitbox();
        s.x = G.W * 0.507 - 36 * loop - 65; s.y = G.H * 0.44;
        s.ay = 250 + Math.random() * 50; s.vy = -(130 + Math.random() * 20); s.vx = Math.random() * 10 - 5;
        s.fadeAt = this.cond.crochet * 2 / 1000; s.life = s.fadeAt + 0.2;
        this.popups.push(s); loop++;
      }
    },
    updatePopups(dt) {
      for (const s of this.popups) { s.vy += s.ay * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.age = (s.age || 0) + dt; if (s.age > s.fadeAt) s.alpha = Math.max(0, 1 - (s.age - s.fadeAt) / 0.2); }
      this.popups = this.popups.filter(s => s.age < s.life);
      if (this.countdownSpr) {
        const s = this.countdownSpr, t = (this.songPos - s.born) / this.cond.crochet;
        if (t >= 1) this.countdownSpr = null; else s.alpha = 1 - G.ease.cubeInOut(Math.max(0, t));
      }
    },
    // -------------------------------------------------- input
    onAction(a, down, repeat) {
      if (this.failed) { if (down && (a === 'back' || a === 'accept')) this.exitToMenu(); return; }
      if (this.gameOver) { if (down && !repeat) this.gameOverAction(a); return; }
      if (this.paused) { if (down) this.pauseAction(a, repeat); return; }
      if (this.cutscene) { this.cutscene.onAction(a, down, repeat); return; }
      const m = /^note(\d)$/.exec(a);
      if (m) { if (repeat) return; if (down) this.press(+m[1]); else this.release(+m[1]); return; }
      if (!down || repeat) return;
      if (a === 'pause' && this.started) this.openPause();
      if (a === 'reset' && this.started && !this.paused) this.health = 0;
    },
    onBlur() { if (this.started && !this.paused && !this.gameOver && !this.ended) this.openPause(); },
    onPointer(type, x, y, id) {
      if (this.paused) { if (type === 'down') this.pausePointer(x, y); return; }
      if (this.cutscene) { if (type === 'down') this.cutscene.onAction(y < 90 && x > G.W - 160 ? 'back' : 'accept', true, false); return; }
      if (this.gameOver) { if (type === 'down') this.gameOverAction(y < 120 && x < 140 ? 'back' : 'accept'); return; }
      if (!G.touchMode) return;
      // pause button top-right
      if (type === 'down' && x > G.W - 130 && y < 110) { this.openPause(); return; }
      // 4 hitbox columns
      const lane = Math.max(0, Math.min(3, Math.floor(x / (G.W / 4))));
      this._touch = this._touch || {};
      if (type === 'down') { this._touch[id] = lane; this.press(lane); }
      else if (type === 'up' && this._touch[id] != null) { this.release(this._touch[id]); delete this._touch[id]; }
    },
    // -------------------------------------------------- pause menu
    openPause() {
      if (this.paused || !this.audio) return;
      this.paused = true; this.audio.pause();
      for (let i = 0; i < 4; i++) if (this.keys[i]) this.release(i);
      const items = ['Resume', 'Restart Song', 'Change Difficulty', this.practice ? 'Disable Practice Mode' : 'Enable Practice Mode', 'Exit to Menu'];
      this.pauseMenu = { sel: 0, t: 0, items: items.map((s, i) => { const a = new G.Alphabet(s, true, 0, 0); a.isMenuItem = true; a.targetY = i; a.startPosition = { x: 90, y: G.H * 0.48 - 30 }; a.x = 90; a.y = G.H * 0.48 + i * 156; return a; }), mode: 'main' };
      this.layoutPause();
      G.audio.music.play('shared/music/breakfast/breakfast.ogg', { loop: true, vol: 0, bpm: 160 });
      G.audio.music.setVolume(0.5, 3);
    },
    layoutPause() { const pm = this.pauseMenu; pm.items.forEach((a, i) => { a.targetY = i - pm.sel; a.alpha = i === pm.sel ? 1 : 0.6; }); },
    updatePause(dt) { const pm = this.pauseMenu; pm.t += dt; for (const a of pm.items) a.update(dt); },
    pauseAction(a, repeat) {
      const pm = this.pauseMenu;
      if (a === 'ui_up' || a === 'ui_down') { pm.sel = (pm.sel + (a === 'ui_up' ? -1 : 1) + pm.items.length) % pm.items.length; G.sfx('scroll', { vol: 0.4 }); this.layoutPause(); }
      else if (a === 'accept' && !repeat) this.pauseChoose();
      else if (a === 'back' && !repeat) { if (pm.mode === 'diff') this.backToPauseMain(); else this.resume(); }
    },
    pausePointer(x, y) {
      const pm = this.pauseMenu;
      for (let i = 0; i < pm.items.length; i++) { const it = pm.items[i]; if (y >= it.y - 10 && y <= it.y + 80 && x < it.x + it.width + 60) { if (i === pm.sel) this.pauseChoose(); else { pm.sel = i; this.layoutPause(); G.sfx('scroll', { vol: 0.4 }); } return; } }
    },
    pauseChoose() {
      const pm = this.pauseMenu, label = pm.items[pm.sel].text;
      if (pm.mode === 'diff') {
        if (label === 'BACK') { this.backToPauseMain(); return; }
        const d = pm.diffs[pm.sel];
        G.setScreen('play', Object.assign({}, this.params, { diff: d.diff, variation: d.variation, weekStats: null }));
        return;
      }
      if (label === 'Resume') this.resume();
      else if (label === 'Restart Song') this.restart();
      else if (label === 'Change Difficulty') {
        const player = this.song.chars.player.startsWith('pico') ? 'pico' : 'bf';
        pm.diffs = G.Songs.difficulties(this.song.id, player);
        pm.items = pm.diffs.map(d => G.DIFF_INFO[d.diff].name).concat(['BACK']).map((s, i) => { const a = new G.Alphabet(s, true, 90, 0); a.isMenuItem = true; a.startPosition = { x: 90, y: G.H * 0.48 - 30 }; a.y = G.H * 0.48 + i * 156; return a; });
        pm.mode = 'diff'; pm.sel = 0; this.layoutPause();
      } else if (/Practice/.test(label)) {
        this.practice = !this.practice; G.settings.practice = this.practice; G.saveSettings();
        pm.items[pm.sel].setText(this.practice ? 'Disable Practice Mode' : 'Enable Practice Mode');
      } else if (label === 'Exit to Menu') this.exitToMenu();
    },
    backToPauseMain() { this.openPauseNoStop(); },
    openPauseNoStop() { // rebuild main pause list without touching audio
      const items = ['Resume', 'Restart Song', 'Change Difficulty', this.practice ? 'Disable Practice Mode' : 'Enable Practice Mode', 'Exit to Menu'];
      this.paused = true;
      this.pauseMenu = { sel: 0, t: 0, items: items.map((s, i) => { const a = new G.Alphabet(s, true, 90, 0); a.isMenuItem = true; a.startPosition = { x: 90, y: G.H * 0.48 - 30 }; a.y = G.H * 0.48 + i * 156; return a; }), mode: 'main' };
      this.layoutPause();
    },
    resume() { this.paused = false; this.pauseMenu = null; G.audio.music.stop(0.1); this.audio.resume(); },
    restart() { G.audio.music.stop(0); G.setScreen('play', Object.assign({}, this.params, { weekStats: this.params.weekStats, noCutscene: true }), { instant: false }); },
    exitToMenu() {
      G.audio.music.stop(0);
      if (this.audio) this.audio.stop();
      G.setScreen(this.params.mode === 'story' ? 'storyMenu' : 'freeplay', {});
    },
    // -------------------------------------------------- game over
    die() {
      if (this.gameOver) return;
      this.dead = true;
      this.audio.stop();
      G.save.deaths = (G.save.deaths || 0) + 1; G.saveData();
      this.params.deaths = (this.params.deaths || 0) + 1;
      const bf = this.bf;
      bf.isDead = true;
      const pico = bf.id.startsWith('pico');
      G.sfx(pico ? 'deathPico' : 'death');
      bf.playAnim('firstDeath', true);
      const dd = bf.deathData || {};
      const co = dd.cameraOffsets || [0, 0];
      const mid = { x: bf.x + bf.width / 2, y: bf.y + bf.height / 2 };
      this.gameOver = { t: 0, phase: 'intro', fade: 0, pico, zoom0: this.cam.zoom, zoom1: dd.cameraZoom || 1, target: { x: mid.x + co[0], y: mid.y + co[1] } };
      this.camTween = null;
      this.cam.follow(this.gameOver.target.x, this.gameOver.target.y);
      this.cam.followRate = 0.01;
      this.hud.alpha = 0;
    },
    updateGameOver(dt) {
      const go = this.gameOver; go.t += dt;
      const bf = this.bf;
      bf.update(dt);
      this.cam.zoom = G.lerp(this.cam.zoom, go.zoom1, 1 - Math.pow(0.1, dt));
      this.cam.update(dt);
      if (go.phase === 'intro' && bf.finished) { go.phase = 'loop'; bf.playAnim('deathLoop', true); G.audio.music.play('shared/music/gameplay/gameover/gameOver' + (go.pico ? '-pico' : '') + '.ogg', { loop: true, bpm: 100 }); }
      if (go.phase === 'confirm') { go.ct += dt; if (go.ct > 0.7) go.fade = Math.min(1, (go.ct - 0.7) / 2); if (go.ct > 2.8 && !go.left) { go.left = true; this.restart(); } }
      if (go.phase === 'exit') { go.ct += dt; go.fade = Math.min(1, go.ct / 0.5); }
    },
    gameOverAction(a) {
      const go = this.gameOver;
      if (a === 'accept' && (go.phase === 'loop' || go.phase === 'intro')) {
        go.phase = 'confirm'; go.ct = 0;
        this.bf.playAnim('deathConfirm', true);
        G.audio.music.stop(0);
        G.audio.music.play('shared/music/gameplay/gameover/gameOverEnd' + (go.pico ? '-pico' : '') + '.ogg', { loop: false });
      } else if (a === 'back' && go.phase !== 'confirm' && go.phase !== 'exit') { go.phase = 'exit'; go.ct = 0; G.audio.music.stop(0.3); this.exitToMenu(); }
    },
    // -------------------------------------------------- end of song
    endSong() {
      this.ended = true;
      if (this.audio) this.audio.stop();
      const p = this.params, s = this.song;
      const acc = this.accN ? this.accSum / this.accN : 0;
      const stats = { score: Math.round(this.score), misses: this.misses, maxCombo: this.maxCombo, tally: Object.assign({}, this.tally), acc, totalNotes: this.notes.filter(n => n.line === 1).length };
      const cheated = this.botplay || this.practice;
      // V-Slice style tallies + rank (results screen, freeplay rank badges + clear %)
      const tl = this.tally, sick = (tl.killer || 0) + tl.sick;
      stats.tallies = { sick, good: tl.good, bad: tl.bad, shit: tl.shit, missed: tl.miss, maxCombo: this.maxCombo, totalNotesHit: sick + tl.good + tl.bad + tl.shit, totalNotes: stats.totalNotes };
      const scoreKey = s.id + (s.variation !== 'default' ? '-' + s.variation : '');
      const prev = G.getScore(scoreKey, p.diff, 'bf');
      const prevRank = prev ? (prev.rank || null) : null;
      let isNewHighscore = false;
      if (!cheated) isNewHighscore = G.submitResult ? G.submitResult(scoreKey, p.diff, { score: stats.score, acc, misses: stats.misses, fc: this.misses === 0, tallies: stats.tallies })
        : G.submitScore(scoreKey, p.diff, 'bf', { score: stats.score, acc, misses: stats.misses, fc: this.misses === 0 });
      if (p.mode === 'story') {
        const ws = p.weekStats || { score: 0, misses: 0, maxCombo: 0, tally: { killer: 0, sick: 0, good: 0, bad: 0, shit: 0, miss: 0, total: 0 }, accSum: 0, accN: 0, totalNotes: 0 };
        ws.score += stats.score; ws.misses += stats.misses; ws.maxCombo = Math.max(ws.maxCombo, stats.maxCombo); ws.totalNotes += stats.totalNotes;
        for (const k in ws.tally) ws.tally[k] += stats.tally[k] || 0; ws.accSum += this.accSum; ws.accN += this.accN;
        if (p.songIndex + 1 < p.songs.length) { G.setScreen('play', Object.assign({}, p, { songIndex: p.songIndex + 1, weekStats: ws })); return; }
        if (!cheated && p.week) G.submitWeekScore(p.week, p.diff, 'bf', ws.score);
        G.setScreen(G.screens.results ? 'results' : 'storyMenu', { mode: 'story', week: p.week, diff: p.diff, stats: Object.assign({}, ws, { acc: ws.accN ? ws.accSum / ws.accN : 0 }), title: (G.A.json('preload/data/levels/' + p.week + '.json') || {}).name || p.week, player: this.bf.id });
      } else G.setScreen(G.screens.results ? 'results' : 'freeplay', { mode: 'freeplay', song: s.id, diff: p.diff, variation: s.variation, stats, title: s.name, player: this.bf.id, prevRank, isNewHighscore, cheated });
    },
    // -------------------------------------------------- drawing
    draw(ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      if (this.failed) { G.vcr(ctx, this.failed, G.W / 2, G.H / 2 - 20, { align: 'center', size: 28 }); G.vcr(ctx, 'Press ESC', G.W / 2, G.H / 2 + 24, { align: 'center', size: 22 }); return; }
      if (!this.ready) { G.vcr(ctx, 'Loading...', G.W - 20, G.H - 50, { align: 'right', size: 32 }); return; }
      if (this.gameOver) { this.drawGameOver(ctx); return; }
      // world
      for (const s of this.stage.ordered()) {
        const slot = s === this.bf ? 'bf' : s === this.dad ? 'dad' : s === this.gf ? 'gf' : null;
        const f = slot && this.charFilter[slot];
        if (f) { ctx.save(); ctx.filter = f; s.draw(ctx, this.cam); ctx.restore(); ctx.filter = 'none'; }
        else s.draw(ctx, this.cam);
      }
      this.cam.drawFX(ctx);
      if (this.cutscene) { this.cutscene.draw(ctx); return; }
      // HUD
      if (this.hud.alpha > 0.01) { ctx.save(); ctx.globalAlpha = this.hud.alpha; this.drawHUD(ctx); ctx.restore(); }
      if (this.paused) this.drawPause(ctx);
    },
    noteY(t) { const d = (t - this.songPos) * PX_PER_MS * this.scrollSpeed; return this.down ? -d : d; },
    drawHUD(ctx) {
      const hud = this.hud;
      const notesSheet = NS.notes, holdImg = NS.hold;
      for (const L of this.lines) {
        if (L.x < -1000) continue;
        for (const s of L.strums) s.draw(ctx, hud);
        // hold trails (behind the note heads, over the strums)
        hud.apply(ctx);
        for (const n of this.notes) {
          if (n.line !== this.lines.indexOf(L) || n.len <= 0 || n.done && !n.holding) continue;
          if (n.missed && !n.dropped && this.songPos > n.holdEnd) continue;
          this.drawHold(ctx, L, n, holdImg);
        }
        // note heads
        for (const n of this.notes) {
          if (n.line !== this.lines.indexOf(L) || n.hit || n.done) continue;
          const y = L.y - INITIAL_OFFSET + this.noteY(n.t);
          if (y > G.H + 50 || y < -200) { if ((n.t - this.songPos) * PX_PER_MS * this.scrollSpeed > G.H + 200) break; continue; }
          const frames = G.Sparrow.byPrefix(notesSheet, 'note' + DIR[n.lane]);
          const f = frames[0]; if (!f) continue;
          const w = f.fw * 0.7;
          const x = L.x + n.lane * SPACING - (w - STRUM_SIZE) / 2 - NUDGE;
          ctx.save(); ctx.translate(x, y); ctx.scale(0.7, 0.7);
          if (n.missed) ctx.globalAlpha = 0.3;
          G.Sparrow.draw(ctx, notesSheet, f); ctx.restore();
        }
        for (const cv of this.covers) if (cv.line === this.lines.indexOf(L)) {
          cv.x = L.x + cv.lane * SPACING + STRUM_SIZE / 2 - cv.width / 2 - 12; cv.y = L.y + INITIAL_OFFSET + STRUM_SIZE / 2 - 96;
          cv.draw(ctx, hud);
        }
      }
      for (const sp of this.splashes) sp.draw(ctx, hud);
      // health bar
      const bg = this.hbBg;
      bg.draw(ctx, hud);
      hud.apply(ctx);
      const bx = bg.x + 4, by = bg.y + 4, bw = bg.width - 8, bh = bg.height - 8;
      const p = G.clamp(this.health / 2, 0, 1);
      ctx.fillStyle = '#FF0000'; ctx.fillRect(bx, by, bw * (1 - p), bh);
      ctx.fillStyle = '#66FF33'; ctx.fillRect(bx + bw * (1 - p), by, bw * p, bh);
      // icons (150x150 frames: normal | losing)
      const split = bg.x + bg.width * (1 - p);
      this.drawIcon(ctx, this.iconP1, split - 26, bg.y + bg.height / 2, this.health < 0.4);
      this.drawIcon(ctx, this.iconP2, split - (150 - 26), bg.y + bg.height / 2, this.health > 1.6);
      // Psych-style score line
      const acc = this.accN ? this.accSum / this.accN : 0;
      const fc = this.misses === 0 ? (this.tally.bad + this.tally.shit === 0 ? (this.tally.good === 0 ? 'SFC' : 'GFC') : 'FC') : this.misses < 10 ? 'SDCB' : 'Clear';
      const rate = this.accN ? ratingName(acc) + ' (' + (acc * 100).toFixed(2) + '%) - ' + fc : '?';
      G.vcr(ctx, 'Score: ' + Math.round(this.score) + ' | Misses: ' + this.misses + ' | Rating: ' + rate, G.W / 2, bg.y + 30, { align: 'center', size: 20, outline: 1.5 });
      if (this.botplay) G.vcr(ctx, 'BOTPLAY', G.W / 2, this.down ? G.H - 120 : 90, { align: 'center', size: 32 });
      if (this.practice) G.vcr(ctx, 'PRACTICE MODE', G.W / 2, this.down ? G.H - 160 : 130, { align: 'center', size: 22, alpha: 0.8 });
      // time bar (Psych)
      if (G.settings.timeBar !== 'off') {
        const ty = this.down ? G.H - 44 : 19, tw = 400, tx = G.W / 2 - tw / 2;
        const prog = G.clamp(this.songPos / this.audio.length, 0, 1);
        ctx.fillStyle = '#000'; ctx.fillRect(tx - 4, ty - 4, tw + 8, 19);
        ctx.fillStyle = '#fff'; ctx.fillRect(tx, ty, tw * prog, 11);
        const left = Math.max(0, (this.audio.length - this.songPos) / 1000);
        const txt = G.settings.timeBar === 'left' ? G.fmtTime(left) : G.settings.timeBar === 'elapsed' ? G.fmtTime(Math.max(0, this.songPos / 1000)) : this.song.name + ' (' + (G.DIFF_INFO[this.song.diff] || {}).name + ')';
        G.vcr(ctx, txt, G.W / 2, ty - 6, { align: 'center', size: 22, outline: 2 });
      }
      for (const s of this.popups) s.draw(ctx, hud);
      if (this.countdownSpr) this.countdownSpr.draw(ctx, hud);
      // touch controls
      if (G.touchMode) {
        G.setScreenT(ctx);
        const cols = ['#C24B99', '#00FFFF', '#12FA05', '#F9393F'];
        for (let i = 0; i < 4; i++) { ctx.globalAlpha = this.keys[i] ? 0.28 : 0.08; ctx.fillStyle = cols[i]; ctx.fillRect(i * G.W / 4, 0, G.W / 4, G.H); }
        ctx.globalAlpha = 0.7; ctx.fillStyle = '#000'; G.roundRect(ctx, G.W - 110, 20, 88, 70, 14); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(G.W - 82, 36, 10, 38); ctx.fillRect(G.W - 62, 36, 10, 38); ctx.globalAlpha = 1;
      }
    },
    drawIcon(ctx, ic, x, cy, losing) {
      if (!ic.img) return;
      const fw = ic.img.width >= 300 ? 150 : ic.img.width, fh = ic.img.height;
      const frame = losing && ic.img.width >= 300 ? 1 : 0;
      const s = ic.scale;
      ctx.save();
      ctx.translate(x + 75, cy);
      ctx.scale(ic.flip ? -s : s, s);
      ctx.imageSmoothingEnabled = !ic.pixel;
      ctx.drawImage(ic.img, frame * fw, 0, fw, fh, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    },
    // one sustain trail: tiled hold piece + end cap from NOTE_hold_assets (8 columns)
    drawHold(ctx, L, n, img) {
      if (!img) return;
      const colW = img.width / 8, zoom = 0.7, w = colW * zoom;
      const x = L.x + n.lane * SPACING + STRUM_SIZE / 2 - w / 2;
      let startT = n.t, endT = n.holdEnd;
      if (n.hit && n.holding) startT = Math.max(startT, this.songPos);
      if (endT <= startT) return;
      const y0 = L.y - INITIAL_OFFSET + STRUM_SIZE / 2 + this.noteY(startT);
      const len = (endT - startT) * PX_PER_MS * this.scrollSpeed;
      const capH = img.height * zoom * 0.4;
      const bodyH = Math.max(0, len - capH);
      ctx.save();
      ctx.globalAlpha = n.dropped || n.missed ? 0.3 : 1;
      ctx.translate(x, y0);
      if (this.down) ctx.scale(1, -1);
      // body: hold piece column tiled vertically
      const piece = n.lane * 2, cap = n.lane * 2 + 1, srcH = img.height;
      let drawn = 0;
      const tileH = srcH * zoom;
      while (drawn < bodyH) {
        const h = Math.min(tileH, bodyH - drawn);
        ctx.drawImage(img, piece * colW, 0, colW, h / zoom, 0, drawn, w, h + 0.5);
        drawn += h;
      }
      // end cap
      ctx.drawImage(img, cap * colW, srcH * 0.0, colW, srcH * 0.9, 0, bodyH, w, srcH * 0.9 * zoom);
      ctx.restore();
    },
    drawPause(ctx) {
      const pm = this.pauseMenu;
      G.setScreenT(ctx);
      ctx.globalAlpha = Math.min(0.6, pm.t * 1.5 + (pm.t > 0 ? 0 : 0.6)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1;
      for (const a of pm.items) a.draw(ctx, null);
      const diff = (G.DIFF_INFO[this.song.diff] || {}).name || this.song.diff;
      const lines = [this.song.name, diff, 'Blue balled: ' + (this.params.deaths || 0)];
      if (this.practice) lines.push('PRACTICE MODE');
      lines.forEach((s, i) => { const a = Math.min(1, Math.max(0, pm.t * 3 - i * 0.3)); G.vcr(ctx, s, G.W - 20, 15 + i * 32 + (1 - a) * -10, { align: 'right', size: 32, alpha: a, outline: 0 }); });
    },
    drawGameOver(ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      this.bf.draw(ctx, this.cam);
      const go = this.gameOver;
      if (go.fade > 0) { G.setScreenT(ctx); ctx.globalAlpha = go.fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    },
  };
})();
