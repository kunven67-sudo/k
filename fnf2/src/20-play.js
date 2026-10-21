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
  // (V-Slice has a 12.5ms 'killer' window in its code, but it's switched off: sick is the best)
  function judge(ms) { ms = Math.abs(ms); return ms <= 45 ? 'sick' : ms <= 90 ? 'good' : ms <= 135 ? 'bad' : 'shit'; }
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

  // ---------------------------------------------------------------- note styles
  // FNF's own "funkin" style, or a song's noteStyle (V-Slice data/notestyles/<id>.json: mods bring their own arrows,
  // strums, holds + splashes, each with its own scale/offsets). Missing parts fall back to funkin.
  function makeNS(id) {
    const j = id && id !== 'funkin' ? G.A.json('preload/data/notestyles/' + id + '.json') : null, A = (j && j.assets) || {};
    const path = p => G.A.imagePath(p);
    const N = {
      id: j ? id : 'funkin',
      notesPath: A.note ? path(A.note.assetPath) : 'shared/images/notes',
      notePre: d => A.note ? A.note.data[DIRL[d]].prefix : 'note' + DIR[d],
      noteScale: A.note && A.note.scale != null ? A.note.scale : 0.7,
      strumPath: A.noteStrumline ? path(A.noteStrumline.assetPath) : 'shared/images/noteStrumline',
      strumPre: (d, k) => A.noteStrumline ? (A.noteStrumline.data[DIRL[d] + k] || {}).prefix : { Static: 'static', Press: 'press', Confirm: 'confirm', ConfirmHold: 'confirmHold' }[k] + DIR[d] + (k === 'ConfirmHold' ? '' : '0'),
      strumScale: A.noteStrumline && A.noteStrumline.scale != null ? A.noteStrumline.scale : 0.7,
      strumOff: (A.noteStrumline && A.noteStrumline.offsets) || [0, 0],
      holdPath: A.holdNote ? path(A.holdNote.assetPath) + '.png' : null,
      holdScale: A.holdNote && A.holdNote.scale != null ? A.holdNote.scale : 0.7,
      splashPath: A.noteSplash ? path(A.noteSplash.assetPath) : 'shared/images/noteSplashes',
      splashPre: d => A.noteSplash ? (A.noteSplash.data[DIRL[d] + 'Splashes'] || []).map(x => x.prefix) : SPLASH[DIRL[d]],
      splashOff: (A.noteSplash && A.noteSplash.offsets) || [25, -5],
      splashAlpha: A.noteSplash && A.noteSplash.alpha != null ? A.noteSplash.alpha : 0.8,
      splashScale: A.noteSplash && A.noteSplash.scale != null ? A.noteSplash.scale : 1,
      splashBlend: A.noteSplash && A.noteSplash.data && A.noteSplash.data.blendMode === 'add' ? 'lighter' : null,
      splashOn: !(A.noteSplash && A.noteSplash.data && A.noteSplash.data.enabled === false),
      coversOn: !(A.holdNoteCover && A.holdNoteCover.data && A.holdNoteCover.data.enabled === false),
      get notes() { return G.Sparrow.load(this.notesPath); },
      get strum() { return G.Sparrow.load(this.strumPath); },
      get splash() { return this.splashOn ? G.Sparrow.load(this.splashPath) : null; },
      cover(i) { return this.coversOn ? G.Sparrow.load('shared/images/holdCover' + COLOR[i]) : null; },
      get hold() { return (this.holdPath && G.A.image(this.holdPath)) || G.A.image('shared/images/NOTE_hold_assets.png') || G.A.image('preload/images/NOTE_hold_assets.png'); },
      // ratings, combo digits + countdown pictures (V-Slice judgementSick / comboNumber0 / countdownTwo...): a scale of
      // 0 hides them (a mod drawing its own), no asset = FNF's
      pop(key, dflt, dScale) {
        const a = A[key]; if (!a || !a.assetPath) return a && a.assetPath === null ? null : { path: dflt, scale: dScale };
        if (a.scale === 0) return null;
        return { path: path(a.assetPath) + '.png', scale: a.scale != null ? a.scale : dScale };
      },
      judge(r) { return this.pop('judgement' + r[0].toUpperCase() + r.slice(1), 'preload/images/ui/popup/funkin/' + r + '.png', 0.65); },
      digit(d) { return this.pop('comboNumber' + d, 'preload/images/ui/popup/funkin/num' + d + '.png', 0.45); },
      count(k) { return this.pop({ ready: 'countdownTwo', set: 'countdownOne', go: 'countdownGo' }[k], 'shared/images/ui/countdown/funkin/' + k + '.png', 1); },
    };
    return N;
  }
  let NS = makeNS('funkin');
  function makeStrum(i, player) {
    const s = new G.Sprite(0, 0);
    s.loadSparrow(NS.strumPath);
    s.addAnim('static', NS.strumPre(i, 'Static'), 24, false);
    s.addAnim('press', NS.strumPre(i, 'Press'), 24, false);
    s.addAnim('confirm', NS.strumPre(i, 'Confirm'), 24, false);
    s.addAnim('confirm-hold', NS.strumPre(i, 'ConfirmHold') || '', 24, true) || s.addAnim('confirm-hold', NS.strumPre(i, 'Confirm'), 24, true);
    s.scale.x = s.scale.y = NS.strumScale;
    s.play('static', true); s.updateHitbox();
    s.dir = i; s.player = player; s.confirmHold = -1;
    const so = NS.strumOff;
    s.playA = function (n, force) { this.play(n, force); centerOffsets(this); if (n === 'confirm') { this.offset.x -= 13; this.offset.y -= 13; } this.offset.x -= so[0]; this.offset.y -= so[1]; };
    return s;
  }
  // special notes (modcharts): 'fake' = a decoy that vanishes before it gets to you (can't be hit),
  // 'eye' = a trap you must NOT hit (missing it is fine), 'glitch' = a normal note that looks broken
  // Mods' own note kinds: G.NoteKinds[kind] = { style: a data/notestyles id (its sheet, arrow names, scale + splash),
  // off / offDown: [x, y] = the FlxSprite.offset the mod gives it (up/downscroll; null x = centred), flipDown: upside down
  // on downscroll, swapDown: the up + down pictures swap on downscroll, fps, trap: true = YOU must not hit it (missing it is
  // fine and it isn't counted; the opponent sings it like any note), hit(P, n) = what hitting it does }
  G.NoteKinds = G.NoteKinds || {};
  const kindOf = n => (n.kind && G.NoteKinds[n.kind]) || null;
  const isTrap = n => n.kind === 'eye' || !!(kindOf(n) && kindOf(n).trap);
  const isReal = n => n.kind !== 'fake' && n.kind !== 'eye' && !(n.line === 1 && kindOf(n) && kindOf(n).trap);
  // a note kind that is one of the singer's own animations plays it instead of a sing pose (Tankman's "ugh" in Ugh,
  // "heh, pretty good" in Stress, Darnell lighting / kicking / kneeing his can in 2hot)
  const KIND_ANIM = { 'weekend-1-lightcan': 'lightCan', 'weekend-1-kickcan': 'kickCan', 'weekend-1-kneecan': 'kneeCan', exHank: 'Hank' };
  const kindAnim = (c, k) => { if (!c || !k) return null; const a = KIND_ANIM[k] || k; return c.anims && c.anims[a] ? a : null; };
  function centerOffsets(s) { s.offset.x = (s.frameW - s.width) * 0.5; s.offset.y = (s.frameH - s.height) * 0.5; s.origin.x = s.frameW / 2; s.origin.y = s.frameH / 2; }

  // ---------------------------------------------------------------- PlayState
  const P = G.screens.play = {
    enter(params) {
      this.params = params = Object.assign({ mode: 'freeplay', songs: ['tutorial'], songIndex: 0, diff: 'normal', variation: null, week: null, weekStats: null, deaths: 0 }, params);
      this.ready = false; this.failed = null; this.cutscene = null; this.blackIn = params.blackIn || 0; params.blackIn = 0;
      this.song = G.Songs.build(params.songs[params.songIndex], params.diff, params.variation, params.swap);
      if (!this.song) { this.failed = 'Missing chart: ' + params.songs[params.songIndex] + ' (' + params.diff + ')'; return; }
      // a new player (Darnell / Tankman / Nene, 59-charselect.js) plays the songs they really sang in, swapped:
      // their part is yours, in their real recorded voice, and the old player raps against them
      this.playAs = params.mode === 'freeplay' && this.song.swap && G.realPlayer ? G.realPlayer(G.settings.player) : null;
      this.setupWorld();
      this.setupHUD();
      this.resetRun();
      G.audio.music.stop(0.2);
      G.audio.preload(['miss1', 'miss2', 'miss3', 'intro3', 'intro2', 'intro1', 'introGo']);
      G.audio.song({ inst: this.song.inst, voices: this.song.voices, rate: G.settings.songSpeed }).then(h => {
        if (G.screen !== this) return;
        this.audio = h;
        // every picture decoded first, then everything the song will draw gets ready (no hitch the first time
        // something shows up mid-song), then it starts
        G.A.afterLoad(() => { if (G.screen !== this || !this.stage) return; this.prepare(); this.begin(params); });
      });
    },
    begin(params) {
      {
        this.ready = true;
        // a song's own intro cutscene (first try only)
        const cs = G.Cutscenes && (G.Cutscenes[this.song.id + '@' + this.song.variation] || G.Cutscenes[this.song.id]);
        if (cs && cs.create && (!params.deaths || cs.always) && !params.noCutscene) { try { this.cutscene = cs.create(this); } catch (e) { G.reportError(e, 'cutscene'); this.cutscene = null; } }
        if (!this.cutscene) this.startCountdown();
      }
    },
    // Lag spikes come from work done the FIRST time something is drawn: the graphics card gets each picture
    // the first time it's used, tinted copies (stage lights, glitch effects) are made the first time they're
    // needed, and an animation's size is measured the first time it plays. All of that happens here, while
    // the song is still loading, instead of in the middle of the song.
    prepare() {
      const t0 = performance.now();
      const chars = [this.bf, this.dad, this.gf].concat(this.dadForms || []).concat((this.glare && this.glare.creepy) || []).concat(this.swapChars || []).filter(Boolean);
      const tex = new Set();
      for (const p of this.stage.props) G.texturesOf(p, tex);
      for (const e of this.stage.extras || []) G.texturesOf(e, tex);
      for (const c of chars) {
        G.texturesOf(c, tex);
        for (const k in c.anims || {}) { const a = c.anims[k]; if (a.kind === 'atlas') G.Atlas.bounds(a.atlas, a.tl); }
      }
      // the stage's colour tints on the characters (Erect stages)
      for (const slot of ['bf', 'dad', 'gf']) {
        const f = this.charFilter && this.charFilter[slot], c = this[slot]; if (!f || !c) continue;
        G.imgFilter = f; try { for (const im of G.texturesOf(c)) G.srcImg(im); } finally { G.imgFilter = null; }
      }
      if (this.mod && this.mod.prepare) try { this.mod.prepare(this, tex); } catch (e) { G.reportError(e, 'mod prepare'); }
      if (this.sfx && this.sfx.prepare) try { this.sfx.prepare(this, tex); } catch (e) { G.reportError(e, 'fx prepare'); }
      // ...and every other picture this screen asked for (notes, splashes, ratings, icons, the mod's own)
      for (const img of G.A._img.values()) if (G.A._touch.get(img) === G.A._gen) tex.add(img);
      this.fitTextures(chars, tex);
      // park every picture on the graphics card now (drawImage swaps a picture for its canvas copy: G.Pin)
      const ctx = G.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.01;
      for (const im of tex) { try { if (im && (im.width || im.naturalWidth)) ctx.drawImage(im, 0, 0, 1, 1); } catch (e) {} }
      ctx.restore();
      this.prepMs = Math.round(performance.now() - t0); this.pinMB = Math.round(G.Pin.bytes / 1e6);
    },
    // How many pixels each stage/character picture really needs on the graphics card: a picture drawn at 60%
    // (sprite scale x the closest the camera zooms in this song) doesn't need a full size copy. Some mod
    // songs use 500+ MB of pictures, a lot for a 2 GB card that Discord + the other tabs share. On Auto the
    // copies also have to fit a budget; High always keeps them full size.
    fitTextures(chars, tex) {
      const q = G.settings.quality;
      if (q === 'high') return;
      let zMax = this.stageZoom || 1;
      for (const ev of this.song.events || []) if (ev.e === 'ZoomCamera' && ev.v) zMax = Math.max(zMax, (ev.v.zoom || 1) * (ev.v.mode === 'direct' ? 1 : this.stageZoom || 1));
      for (const ev of this.song.events || []) if ((ev.e === 'Set Cam Zoom' || ev.e === 'SetCamZoom') && ev.v) zMax = Math.max(zMax, parseFloat(ev.v.value1) || 0);
      for (const ev of this.song.events || []) if (ev.e === 'ColoredApple' && ev.v) zMax = Math.max(zMax, parseFloat(ev.v.value2) || 0);   // (Psych mods: the zoom itself)
      if (this.sfx && this.sfx.maxZoom) zMax = Math.max(zMax, this.sfx.maxZoom(this) || 0);                                            // (a song's cutscene camera)
      const need = new Map(), see = (sp, s) => { for (const im of G.texturesOf(sp)) if (im instanceof HTMLImageElement) need.set(im, Math.max(need.get(im) || 0, s)); };
      const sz = sp => Math.max(Math.abs(sp.scale && sp.scale.x || 1), Math.abs(sp.scale && sp.scale.y || 1));
      const zq = zMax * 1.15 * Math.min(1, G.q);      // camera bops + a little room
      for (const p of this.stage.props) see(p, sz(p) * zq);
      for (const e of this.stage.extras || []) see(e, sz(e) * zq);
      for (const c of chars) see(c, sz(c) * zq);
      // everything else this song draws (notes, ratings, the mod's own effects) stays as big as it is
      const px = im => im.naturalWidth * im.naturalHeight * 4;
      let world = 0, other = 0;
      for (const [im, k] of need) world += px(im) * Math.min(1, k) ** 2;
      for (const im of tex) if (im instanceof HTMLImageElement && !need.has(im)) other += px(im);
      // squeezed further when the stage + characters don't fit what's left of the budget
      const budget = G.phone ? 160e6 : q === 'low' ? 200e6 : 380e6, room = Math.max(budget * 0.3, budget - other);
      const squeeze = world > room ? Math.sqrt(room / world) : 1;
      for (const [im, k] of need) G.Pin.fit(im, Math.max(G.phone ? 0.35 : 0.5, Math.min(1, k) * squeeze));
      this.texMB = Math.round((world * squeeze * squeeze + other) / 1e6);
    },
    // the stage + characters go with the screen (their pictures can be freed while you're in the menus)
    leave() { if (this.sfx && this.sfx.leave) try { this.sfx.leave(this); } catch (e) {} if (this.audio) this.audio.stop(); this.audio = null; G.audio.music.stop(0.1); this.stage = null; this.bf = this.dad = this.gf = null; this.cutscene = null; },
    // still loading (its music decoding, pictures, the mod pack): the loading screen stays up
    loadingNow() { return !this.ready; },
    // the song is running: the main loop must never hold the screen for pictures still loading
    live() { return this.ready && this.started && !this.cutscene && !this.paused && !this.gameOver; },
    // -------------------------------------------------- world: stage + characters + cameras
    setupWorld() {
      const s = this.song;
      this.stage = new G.Stage(s.stage);
      const mk = (id, slot, fallback) => { let cid = id; if (!G.A.json('preload/data/characters/' + cid + '.json')) cid = fallback; if (!cid) return null; const c = new G.Character(cid, slot); this.stage.addCharacter(c, slot); return c; };
      this.gf = s.chars.gf ? mk(s.chars.gf, 'gf', 'gf') : null;
      // (a swapped Weekend 1 song: FNF's own opponent Pico, already set up to face right)
      this.dad = mk(s.swap && s.chars.opponent === 'pico-playable' ? 'pico' : s.chars.opponent, 'dad', 'dad');
      // (a full player singing a song swapped uses its own playable version: Darnell's Mixtape's darnell-player;
      //  a stand-in player sings as their song version when the song has one: Nene's singing sheet, not the A-Bot one)
      //  (also in a song made for them: Darnell in After Hours)
      const PP = G.PLAYERS && G.PLAYERS[G.settings.player], swapChar = PP && !PP.real && PP.swapChar && (s.swap || s.chars.player === PP.ownChar) ? PP.swapChar : null;
      const own = this.playAs && (this.playAs.real.songChar && s.chars.player === this.playAs.real.songChar ? s.chars.player : this.playAs.real.char);
      const anyChar = s.anyPlayer && G.playerChar ? G.playerChar(G.settings.player) : null;   // (a song made for anybody)
      this.bf = mk(anyChar || own || swapChar || s.chars.player, 'bf', 'bf');
      if (this.playAs && this.playAs.real.flip === false && this.bf.nene) this.bf.flipX = false;      // (Nene sits on her A-Bot facing front)
      // their atlas box is much bigger than what they draw (Darnell stood half off the screen): put the feet
      // of what's really drawn where BF's feet go (Nene's A-Bot is already built around her spot).
      // Stages imported from mods mark their spots as 'feet' for everyone (the mod's characters were other sizes).
      const SC = this.stage.data.characters || {};
      for (const [slot, c] of [['bf', this.bf], ['dad', this.dad], ['gf', this.gf]]) {
        if (!c || !G.visBox || !(SC[slot] && SC[slot].feet || (slot === 'bf' && this.playAs && !c.nene))) continue;
        const pos = SC[slot] && SC[slot].position, vb = G.visBox(c);
        if (pos && vb) {
          const dx = pos[0] - vb.cx, dy = pos[1] - vb.bottom;
          c.x += dx; c.y += dy; c.originalPosition = { x: c.x, y: c.y }; c.camFocus.x += dx; c.camFocus.y += dy;
        }
      }
      // ...and the mod's own camera spots
      for (const [slot, c] of [['bf', this.bf], ['dad', this.dad], ['gf', this.gf]]) if (c && SC[slot] && SC[slot].camera) c.camFocus = { x: SC[slot].camera[0], y: SC[slot].camera[1] };
      // ...or Psych Engine's way (sprite corner + camera on the middle: VS Whitty's port), and the characters the song's
      // Change Character events swap in, made now
      for (const [slot, c] of [['bf', this.bf], ['dad', this.dad], ['gf', this.gf]]) if (c && SC[slot] && SC[slot].raw && G.ModChars) G.ModChars.place(c, SC[slot]);
      this.swapChars = G.ModChars ? G.ModChars.prepare(this) : [];
      this.noteCam = this.stage.data.noteCam ? { px: this.stage.data.noteCam, t: 0, base: null, side: 1 } : null;
      // whoever stands mirrored on the other side (Tankman on the right, BF on the left) swaps their LEFT and RIGHT
      // poses, like FNF's own mirrored characters do, so every pose still points the way its arrow does
      if (s.swap) { this.bf.swapLR = !!this.bf.flipX && !swapChar; this.dad.swapLR = !!this.dad.flipX && this.dad.id !== 'pico'; }
      // (a player-side drawing turned round to be the opponent: Nene's singing sheet when Darnell plays After Hours)
      else if (this.dad.data.mirrorPoses && this.dad.flipX) this.dad.swapLR = true;
      // tutorial: GF is the opponent, standing at GF's spot
      if (s.chars.opponent === s.chars.gf && this.gf) { this.dad.x = this.gf.x; this.dad.y = this.gf.y; this.dad.camFocus = Object.assign({}, this.gf.camFocus); this.stage.chars.gf = null; this.gf = null; this.dad.zIndex = 100; }
      // WRATH: the giant eye (stage 2) is made up front so the swap at the eye-open never hitches
      this.dadForms = null;
      if (this.dad && s.events.some(e => e.e === 'WrathEye')) {
        const eye = new G.Character('wrath-eye', 'dad');
        this.stage.addCharacter(eye, 'dad'); this.stage.addCharacter(this.dad, 'dad');
        this.dadForms = [this.dad, eye];
      }
      this.applyStageFX();
      // a song's own stage effects (setup / reset / update / beat / event / drawOver)
      this.sfx = (G.SongFX && (G.SongFX[s.id + '@' + s.variation] || G.SongFX[s.id])) || (s.video && G.VideoSongFX) || (G.StageFX && G.StageFX[s.stage]) || null;
      if (this.sfx && this.sfx.setup) try { this.sfx.setup(this); } catch (e) { G.reportError(e, 'song fx'); this.sfx = null; }
      this.stageZoom = this.stage.zoom;
      this.cam = new G.FCam(this.stageZoom);
      this.hud = new G.HudCam();
      this.camZoom = this.stageZoom; this.bopMul = 1; this.hudZoom = 1;
      this.zoomRate = 4; this.bopIntensity = 1.015; this.hudBopIntensity = 0.03;
      this.camTween = null; this.zoomTween = null;
      this.startCam();
    },
    // where the camera is when the song starts: on the opponent, or where the stage says (Psych stages: on you / a spot)
    startCam() {
      const cs = this.stage.data.camStart, f = cs === 'bf' && this.bf ? this.bf.camFocus : Array.isArray(cs) ? { x: cs[0], y: cs[1] } : this.dad.camFocus;
      this.cam.focus(f.x, f.y);
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
      // Phones: FNF mobile's "Arrows" controls (V-Slice PlayState.initNoteHitbox): your arrows big at the bottom,
      // spread out so a thumb fits each one, notes falling down to them; the opponent's arrows tiny in the top
      // left corner; health bar at the top. You tap the arrows themselves (Options > Phone controls: Lanes = the
      // old 4 tall columns).
      this.phoneArrows = !!G.touchMode && st.touchScheme !== 'lanes';
      if (this.phoneArrows) {
        this.down = true; this.middle = false;
        const sc = 0.5625 * 1.95, gap = 0.5625 * 2.8;                 // strumline scale 1.097, note spacing 1.575
        const P = this.lines[1], O = this.lines[0];
        P.sc = sc; P.spF = gap / sc; P.ys = 1 / sc;
        P.y = (G.H - STRUM_SIZE * sc) * 0.95 - 24; P.x = G.W / 2 - 1.5 * SPACING * gap - STRUM_SIZE / 2 * sc;
        O.sc = 0.4; O.x = 48 - 30; O.y = 24 * 0.3;
      }
      NS = makeNS(this.song.noteStyle);
      // (a mod's own rating / combo / countdown pictures: asked for now, so they're ready before the song)
      for (const r of ['sick', 'good', 'bad', 'shit']) { const j = NS.judge(r); if (j) G.A.image(j.path); }
      for (let d = 0; d < 10; d++) { const j = NS.digit(d); if (j) G.A.image(j.path); }
      for (const k of ['ready', 'set', 'go']) { const j = NS.count(k); if (j) G.A.image(j.path); }
      for (const L of this.lines) {
        // a scaled strumline draws through its own camera: the HUD camera + a zoom around the line's corner
        if (L.sc && L.sc !== 1) { const hud = this.hud; L.cam = { apply(ctx) { hud.apply(ctx); ctx.transform(L.sc, 0, 0, L.sc, L.x * (1 - L.sc), L.y * (1 - L.sc)); } }; }
      }
      for (const L of this.lines) for (let i = 0; i < 4; i++) {
        const s = makeStrum(i, L.player);
        s.x = s.bx = L.x + i * SPACING * (L.spF || 1) + INITIAL_OFFSET; s.y = s.by = L.y;
        s.mx = s.my = s.ma = 0; s.mal = 1;                  // modchart offset / angle / alpha
        L.strums.push(s);
      }
      const speedSet = st.speedType === 'const' ? st.speedValue : st.speedType === 'mult' ? this.song.speed * st.speedValue : this.song.speed;
      this.scrollSpeed = this.baseScrollSpeed = speedSet / (st.songSpeed || 1) * (st.songSpeed || 1);
      // health bar (healthBar.png + fill), icons
      this.hbBg = new G.Sprite(0, 0).loadImage('shared/images/healthBar.png');
      this.hbBg.y = this.down ? G.H * 0.1 : G.H * 0.9; this.hbBg.screenCenter('x');
      this.iconP1 = this.makeIcon(this.bf, true);
      this.iconP2 = this.makeIcon(this.dad, false);
      // ask for every gameplay sheet now (splashes + hold covers are big): they load before the song starts,
      // not on your first SICK in the middle of it
      for (const sh of [NS.notes, NS.strum, NS.splash, NS.cover(0), NS.cover(1), NS.cover(2), NS.cover(3)]) if (sh) G.A.warmNow(sh.imgs || [sh.img]);
      // (+ the mod note kinds this chart has: their arrows + splash)
      for (const k of new Set(this.song.notes.map(n => n.k))) {
        const K = k && G.NoteKinds[k]; if (!K || !K.style) continue;
        const N = this.kindStyle(K); for (const sh of [N.notes, N.splash]) if (sh) G.A.warmNow(sh.imgs || [sh.img]);
      }
      this.popups = [];
      this.splashes = []; this.covers = [];
      this.countdownSpr = null;
      // a song's own modchart (moving arrows, special notes, battle effects)
      this.mod = G.settings.modcharts !== false && G.Modcharts && G.Modcharts[this.song.id] || null;
      if (this.mod && this.mod.setup) try { this.mod.setup(this); } catch (e) { G.reportError(e, 'modchart'); this.mod = null; }
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
      this.hideHealth = false; this.strumShift = 0;
      this.notes = s.notes.map((n, i) => ({ i, t: n.t, lane: n.d % 4, line: n.d >= 4 ? 0 : 1, len: n.l, kind: n.k, hit: false, missed: false, holdEnd: n.t + n.l, holding: false, dropped: false, done: false, holdLeft: n.l }));
      if (!this.mod) this.notes = this.notes.filter(n => n.kind !== 'fake' && n.kind !== 'eye');   // modcharts off: no tricks, just the song (a mod's own note kinds stay: they ARE its song)
      this.evIdx = 0;
      this.health = 1; this.score = 0; this.misses = 0; this.combo = 0; this.maxCombo = 0;
      this.tally = { killer: 0, sick: 0, good: 0, bad: 0, shit: 0, miss: 0, total: 0 };
      this.accSum = 0; this.accN = 0;
      this.cond = new G.SongConductor(s.timeChanges);
      this.songPos = -this.cond.crochet * 5;
      this.cond.reset(this.songPos);
      this.ended = false; this.endCut = false; this.dead = false; this.paused = false; this.pauseMenu = null; this.gameOver = null;
      if (this.noteCam) { this.noteCam.t = 0; this.noteCam.base = null; this.noteCam.side = 1; }
      if (this.cam) this.cam.followRate = 0.04;
      this.countBeat = -99; this.started = false;
      this.keys = [false, false, false, false];
      this.botplay = !!G.settings.botplay; this.practice = !!G.settings.practice;
      this.popups = []; this.splashes = []; this.covers = [];
      this.vocalsOn = true;
      for (const L of this.lines) for (const s2 of L.strums) { s2.playA('static', true); s2.confirmHold = -1; s2.mx = s2.my = s2.ma = 0; s2.mal = 1; s2.x = s2.bx; s2.y = s2.by; s2.angle = 0; s2.alpha = 1; s2.visible = true; }
      // (what a mod's song script fades: 'all' = the whole HUD, on top of hud.alpha, which the cutscenes + WRATH's snap own)
      this.hudParts = { all: 1, health: { alpha: 1, dy: 0, apple: 1 }, time: { alpha: 1, dy: 0 } };
      if (G.ModEvents) G.ModEvents._reset(this);
      if (this.cam && this.started === false && this.stage && this.stage.data.camStart) this.startCam();
      this.snap = null; if (this.hud) this.hud.alpha = 1;
      if (this.dadForms) { this.dadForms[0]._locked = false; if (this.dad !== this.dadForms[0]) this.swapDad(this.dadForms[0]); else this.stage.chars.dad = this.dad; }
      this.iconP1.scale = this.iconP2.scale = 1;
      if (this.sfx && this.sfx.reset) this.sfx.reset(this);
      if (this.mod && this.mod.reset) this.mod.reset(this);
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
      const cp = steps[1] && NS.count(steps[1]);
      if (cp && G.A.image(cp.path)) {
        const s = new G.Sprite(0, 0).loadImage(cp.path);
        if (cp.scale !== 1) { s.scale.x = s.scale.y = cp.scale; s.updateHitbox(); }
        s.screenCenter(); s.born = this.songPos; s.y0 = s.y;
        this.countdownSpr = s;
      }
    },
    // -------------------------------------------------- per-frame
    update(dt) {
      if (this.failed || !this.ready) return;
      if (this.blackIn > 0) this.blackIn -= dt;
      if (this.cutscene) { this.cutscene.update(dt); if (this.cutscene.done) { const c = this.cutscene; this.cutscene = null; if (c.isEnd) this.endSong(); else this.startCountdown(); } return; }
      if (this.gameOver) { this.updateGameOver(dt); return; }
      if (this.paused) { this.updatePause(dt); return; }
      const prev = this.songPos;
      this.songPos = this.audio.time();
      if (this.songPos < prev - 50 && prev > 0) this.songPos = prev; // never jump back
      const jpos = this.songPos - (G.settings.offset || 0);
      this.cond.update(this.songPos, st => this.onStep(st), bt => this.onBeat(bt));
      this.processEvents();
      if (G.ModEvents) G.ModEvents._update(this, dt);
      this.updateSnap(dt);
      this.updateNotes(jpos, dt);
      // characters, stage, cameras
      const stepSec = this.cond.stepCrochet / 1000;
      const holding = this.keys.some(k => k) || this.botHolding;
      for (const c of [this.gf, this.dad, this.bf]) if (c) { c.playHealth = this.health; c.tick(dt, stepSec, c === this.bf ? holding : false); }
      this.stage.update(dt);
      if (this.sfx && this.sfx.update) this.sfx.update(this, dt);
      this.updateNoteCam(dt);
      this.updateCamera(dt);
      if (this.mod && this.mod.update) this.mod.update(this, dt);
      for (const L of this.lines) for (const s of L.strums) {
        s.update(dt); centerOffsets(s); if (s.animName === 'confirm') { s.offset.x -= 13; s.offset.y -= 13; }
        s.x = s.bx + s.mx; s.y = s.by + s.my + (this.strumShift || 0); s.angle = s.ma; s.alpha = s.mal;
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
      for (const c of [this.gf, this.dad, this.bf]) if (c && !(c.noDanceUntil > this.songPos)) { const n = Math.round(c.danceEvery * 4) || 4; if (((step % n) + n) % n === 0) c.dance(false); }
      if (step >= 0 && this.sfx && this.sfx.step) this.sfx.step(this, step);
      if (step % 4 === 0) {
        const beat = step / 4;
        if (beat < 0) this.countdownBeat(beat);
      }
      if (G.ModEvents) G.ModEvents._step(this, step);
    },
    onBeat(beat) {
      this.iconP1.scale = this.iconP2.scale = 1.2;
      if (beat >= 0 && this.sfx && this.sfx.beat) this.sfx.beat(this, beat);
      if (beat >= 0 && this.mod && this.mod.beat) this.mod.beat(this, beat);
      if (beat >= 0 && G.ModEvents) G.ModEvents._beat(this, beat);
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
      if (this.sfx && this.sfx.event) this.sfx.event(this, e.e, v);
      if (this.mod && this.mod.event) this.mod.event(this, e.e, v);
      for (const c of [this.gf, this.dad, this.bf]) if (c && c.script && c.script.onEvent) c.script.onEvent(c, e.e, v);
      switch (e.e) {
        case 'FocusCamera': {
          if (this.camForced) break;                  // (Camera Follow Pos holds the camera)
          let ch = v != null && typeof v === 'object' ? v.char : v; if (ch == null) ch = 0;
          let x = (v && v.x) || 0, y = (v && v.y) || 0;
          const tgt = ch === 0 ? this.bf : ch === 1 ? this.dad : ch === 2 ? (this.gf || this.dad) : null;
          if (this.noteCam) { const nc = this.noteCam; nc.side = ch; if (nc.t > 0) { nc.t = 0; nc.base = null; this.cam.followRate = 0.04; } }
          if (tgt) { x += tgt.camFocus.x; y += tgt.camFocus.y; }
          const ease = (v && v.ease) || 'CLASSIC';
          if (ease === 'CLASSIC') { this.camTween = null; this.cam.follow(x, y); }
          else if (ease === 'INSTANT') { this.camTween = null; this.cam.focus(x, y); }
          else { const dur = ((v && v.duration) || 4) * this.cond.stepCrochet / 1000; this.camTween = { t: 0, dur: Math.max(0.001, dur), x0: this.cam.x, y0: this.cam.y, x1: x, y1: y, ease: easeFn(ease, v && v.easeDir) }; }
          break;
        }
        case 'PlayAnimation': {
          const map = { bf: this.bf, boyfriend: this.bf, player: this.bf, dad: this.dad, opponent: this.dad, gf: this.gf, girlfriend: this.gf };
          const c = map[v.target || 'bf']; if (c) { c.playAnim(v.anim, !!v.force); if (c.isSinging && !c.animName.startsWith('sing')) c.holdTimer = 0; }
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
        default: { const h = G.ModEvents && G.ModEvents[e.e]; if (h && e.e[0] !== '_') h(this, v || {}, e); }   // (Psych mods' events: 16-mod-events.js)
      }
    },
    // -------------------------------------------------- notes
    updateNotes(pos, dt) {
      const bot = this.botplay;
      this.botHolding = false;
      for (const n of this.notes) {
        if (n.done) continue;
        if (!isReal(n)) { if (pos - n.t > HIT_WINDOW) n.done = true; continue; }     // decoys + traps just go by
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
      const suffix = n.kind === 'alt' ? '-alt' : '', ka = kindAnim(this.dad, n.kind);
      if (n.kind === 'hey') this.dad.playAnim('hey', true);
      else if (n.kind === 'No Animation') { /* (Psych note type: the singer doesn't pose) */ }
      else if (!this.dad._locked && ka) { this.dad.playAnim(ka, true); this.dad.holdTimer = 0; }
      else if (!this.dad._locked) { this.dad.lastNote = n; this.dad.sing(n.lane, false, suffix); }
      if (this.audio) this.audio.setVolume('o', 1);
      this.nudgeCam(1, n.lane);
      if (this.sfx && this.sfx.oppHit) this.sfx.oppHit(this, n);
    },
    // mod stages (movecam.lua / alleynene.lua): the camera leans 20px the way each note on the side it's
    // looking at points, quicker (camera speed x3), and goes back 1 second after the last one
    nudgeCam(side, lane) {
      const nc = this.noteCam; if (!nc || nc.side !== side || this.camTween || this.gameOver) return;
      if (!nc.base) nc.base = { x: this.cam.tx, y: this.cam.ty };
      const d = [[-1, 0], [0, 1], [0, -1], [1, 0]][lane];
      this.cam.follow(nc.base.x + d[0] * nc.px, nc.base.y + d[1] * nc.px);
      this.cam.followRate = 0.12; nc.t = 1;
    },
    updateNoteCam(dt) {
      const nc = this.noteCam; if (!nc || nc.t <= 0) return;
      nc.t -= dt;
      if (nc.t <= 0) { if (nc.base) this.cam.follow(nc.base.x, nc.base.y); nc.base = null; this.cam.followRate = 0.04; }
    },
    // player pressed a lane
    press(lane) {
      if (this.botplay || !this.started) return;
      this.keys[lane] = true;
      const pos = this.songPos - (G.settings.offset || 0);
      const s = this.lines[1].strums[lane];
      let best = null, trap = null;
      for (const n of this.notes) {
        if (n.done || n.hit || n.missed || n.line !== 1 || n.lane !== lane || n.kind === 'fake') continue;
        const diff = n.t - pos;
        if (isTrap(n)) { if (Math.abs(diff) <= 110 && (!trap || n.t < trap.t)) trap = n; }    // a real note always wins
        else if (Math.abs(diff) <= HIT_WINDOW && (!best || n.t < best.t)) best = n;
        if (diff > HIT_WINDOW) break;
      }
      if (best) { best.hit = true; best.holding = best.len > 0; this.playerHit(best, pos - best.t, false); }
      else if (trap) { trap.hit = true; trap.done = true; s.playA('press', true); this.hitTrap(trap); }
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
      this.nudgeCam(0, n.lane);
      this.score += pts;
      this.health = Math.min(H.max, this.health + (H[r] || 0));
      this.tally[r]++; this.tally.total++;
      this.accSum += ACC[r]; this.accN++;
      // like V-Slice: a BAD or SHIT hit still counts as a hit, but it breaks your combo
      if (r === 'bad' || r === 'shit') { if (this.combo >= 10 && G.settings.comboPopups !== false) this.popCombo(0); this.combo = 0; }
      else { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); }
      if (r === 'sick' || r === 'killer') this.splash(n.lane);
      // (a mod's own HUD can show the rating + combo its way)
      if (G.settings.comboPopups !== false && !(this.sfx && this.sfx.popups && this.sfx.popups(this, r === 'killer' ? 'sick' : r, this.combo))) { this.popRating(r === 'killer' ? 'sick' : r); if (this.combo >= 10) this.popCombo(this.combo); }
      if (this.sfx && this.sfx.playerHit) this.sfx.playerHit(this, n, r);
      const suffix = n.kind === 'alt' ? '-alt' : '', ka = kindAnim(this.bf, n.kind);
      if (n.kind === 'hey') this.bf.playAnim('hey', true); else if (n.kind === 'No Animation') { /* (Psych note type) */ } else if (ka) { this.bf.playAnim(ka, true); this.bf.holdTimer = 0; } else this.bf.sing(n.lane, false, suffix);
      if (this.audio) this.audio.setVolume('p', 1);
      if (this.gf && this.gf.anims['combo' + this.combo]) this.gf.playAnim('combo' + this.combo, true);
      if (n.len > 0) this.startCover(n);
      if (G.settings.hitsound > 0) G.sfx('preload/sounds/scrollMenu.ogg', { vol: G.settings.hitsound * 0.7 });
    },
    // you hit a note you shouldn't have (GLARE's eye notes): health + combo gone, the song decides the rest
    hitTrap(n) {
      const K = kindOf(n);
      if (K && K.hit) { K.hit(this, n); return; }
      this.health -= 0.35; this.score -= 150;
      this.breakCombo();
      if (this.audio) this.audio.setVolume('p', 0);
      this.bf.sing(n.lane, true);
      if (this.mod && this.mod.trap) this.mod.trap(this, n);
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
      if (this.sfx && this.sfx.miss) this.sfx.miss(this, n);
    },
    // pressing with no note there (ghost tapping off): like V-Slice, -4% health and -10 score,
    // a quiet miss sound + miss pose, but it doesn't count as a miss or break the combo
    ghostMiss(lane) {
      this.health += H.miss; this.score -= 10;
      if (this.audio) this.audio.setVolume('p', 0);
      G.sfx('miss' + (1 + Math.floor(Math.random() * 3)), { vol: 0.1 + Math.random() * 0.1 });
      this.bf.sing(lane, true);
    },
    breakCombo() {
      if (this.sfx && this.sfx.comboBreak) this.sfx.comboBreak(this);
      if (this.gf && this.combo >= 70 && this.gf.anims.drop70) this.gf.playAnim('drop70', true);
      else if (this.gf && this.combo >= 5 && this.gf.anims.sad) this.gf.playAnim('sad', true);
      if (this.combo >= 10 && G.settings.comboPopups !== false) this.popCombo(0);
      this.combo = 0;
    },
    // ns = another note style's splash (a note kind's own: its scale + offsets the V-Slice way, Strumline.playNoteSplash)
    splash(lane, ns) {
      const N = ns || NS;
      if (!G.settings.noteSplashes || !N.splashOn) return;
      const sp = new G.Sprite(0, 0); sp.loadSparrow(N.splashPath);
      const pre = N.splashPre(lane), v = Math.floor(Math.random() * pre.length);
      if (!sp.addAnim('s', pre[v], 24 + Math.floor(Math.random() * 5) - 2, false)) return;
      if (ns) sp.scale.x = sp.scale.y = N.splashScale;
      sp.play('s', true); sp.updateHitbox();
      const S = this.lines[1].strums[lane], so = N.splashOff;
      if (ns) { sp.x = S.x + so[0] * N.splashScale; sp.y = S.y - INITIAL_OFFSET + so[1] * N.splashScale; }
      else { sp.x = S.x + so[0]; sp.y = S.y - INITIAL_OFFSET + so[1]; }
      sp.offset.x = sp.width * 0.3; sp.offset.y = sp.height * 0.3;
      sp.alpha = N.splashAlpha; sp.blend = N.splashBlend;
      this.splashes.push(sp);
    },
    kindStyle(K) { return K._ns || (K._ns = makeNS(K.style)); },
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
      const jp = NS.judge(r), img = jp && G.A.image(jp.path); if (!img) return;
      const s = new G.Sprite(0, 0).loadImage(img); s.scale.x = s.scale.y = jp.scale; s.updateHitbox();
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
        const dp = NS.digit(d), img = dp && G.A.image(dp.path); if (!img) continue;
        const s = new G.Sprite(0, 0).loadImage(img); s.scale.x = s.scale.y = dp.scale; s.updateHitbox();
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
      if (this.gameOver) { if (down && !repeat) return this.gameOverAction(a); return; }
      if (this.paused) { if (down) return this.pauseAction(a, repeat); return; }
      if (this.cutscene) { this.cutscene.onAction(a, down, repeat); return true; }
      const m = /^note(\d)$/.exec(a);
      if (m) { if (repeat) return; if (down) this.press(+m[1]); else this.release(+m[1]); return; }
      if (!down || repeat) return;
      if (a === 'pause' && this.started) { this.openPause(); return true; }
      if (a === 'reset' && this.started && !this.paused) this.health = 0;
    },
    onBlur() { if (this.started && !this.paused && !this.gameOver && !this.ended) this.openPause(); },
    onPointer(type, x, y, id) {
      if (this.paused) { if (type === 'down') this.pausePointer(x, y); return; }
      if (this.cutscene) { if (type === 'down') this.cutscene.onAction(y < 90 && x > G.W - 160 ? 'back' : 'accept', true, false); return; }
      if (this.gameOver) { if (type === 'down') this.gameOverAction(y < 120 && x < 140 ? 'back' : 'accept'); return; }
      if (!G.touchMode) return;
      // pause button top-right (FNF mobile's own)
      const pb = this.pauseBtn;
      if (pb ? pb.pointer(type, x, y, id) : (type === 'down' && x > G.W - 130 && y < 110 && (this.openPause(), true))) return;
      // Each finger is tracked: it can SLIDE from one arrow to the next (sliding onto an arrow presses it, like FNF
      // mobile), so arrows next to each other don't need two fingers. A see-through circle shows where each finger is.
      const T = this._touch = this._touch || {}, POS = this._tpos = this._tpos || {};
      const others = (l) => Object.keys(T).some(k => k != id && T[k] === l);
      if (type === 'up' || type === 'cancel') {
        delete POS[id];
        if (id in T) { const l = T[id]; delete T[id]; if (l != null && !others(l)) this.release(l); }
        return;
      }
      if (type === 'move' && !(id in T)) return;               // (a finger that didn't start on the arrows)
      if (type !== 'down' && type !== 'move') return;
      POS[id] = { x, y };
      const lane = this.laneAt(x, y), old = id in T ? T[id] : null;
      if (type === 'down' && lane == null) return;              // (a tap above the arrows does nothing)
      if (lane === old) return;
      T[id] = lane;
      if (old != null && !others(old)) this.release(old);
      if (lane == null) return;                                 // slid off the arrows: let go until it comes back
      if (others(lane)) this.release(lane);                     // (another finger is on it: this one counts as a new press)
      this.press(lane);
    },
    // which arrow a finger at (x, y) is on (null = none)
    laneAt(x, y) {
      if (!this.phoneArrows) return Math.max(0, Math.min(3, Math.floor(x / (G.W / 4))));     // 4 tall lanes
      // FNF mobile: each arrow is a button, a tall box around it (from a bit above the arrow to the bottom of the
      // screen); the two outer ones reach the edges of the screen
      const L = this.lines[1], sc = L.sc || 1;
      if (y < L.y - 220 * sc) return null;
      let best = 1e9, lane = null;
      for (let i = 0; i < 4; i++) { const S = L.strums[i], cx = L.x + (S.x - INITIAL_OFFSET + STRUM_SIZE / 2 - L.x) * sc, d = Math.abs(x - cx); if (d < best) { best = d; lane = i; } }
      return lane;
    },
    // -------------------------------------------------- pause menu (V-Slice PauseSubState)
    openPause() {
      if (this.paused || !this.audio) return;
      this.paused = true; this.audio.pause();
      for (let i = 0; i < 4; i++) if (this.keys[i]) this.release(i);
      this._touch = {}; this._tpos = {};
      const art = this.song.artist || 'Unknown', chr = this.song.charter || 'Unknown';
      const meta = [this.song.name, 'Artist: ' + art, 'Difficulty: ' + ((G.DIFF_INFO[this.song.diff] || {}).name || this.song.diff).replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()), '', 'PRACTICE MODE'];
      this.pauseMenu = { sel: 0, t: 0, mode: 'main', items: [], meta, art, chr, artistT: 0, artistA: 1, artistIsCharter: false, offHold: 0, offFast: false };
      this.pauseEntries('main');
      // breakfast starts somewhere in its first half and fades in over 5 seconds, like the real one
      // each player's own pause music (breakfast-pico, breakfast-darnell...)
      const pid = this.bf ? G.playerOf(this.bf.id) : 'bf', own = 'shared/music/breakfast-' + pid + '/breakfast-' + pid + '.ogg';
      const path = pid !== 'bf' && G.A.has(own) ? own : 'shared/music/breakfast/breakfast.ogg';
      G.audio.music.play(path, { loop: true, vol: 0.75, fadeIn: 5, bpm: 160, restart: true, randomStart: 0.5 });
    },
    // (re)build the list: new texts start up in the corner, invisible, then fly to their spots
    pauseEntries(mode) {
      const pm = this.pauseMenu;
      let labels;
      if (mode === 'diff') {
        pm.diffs = G.Songs.difficulties(this.song.id, G.playerOf(this.song.chars.player));
        labels = pm.diffs.map(d => G.DIFF_INFO[d.diff].name).concat(['Back']);
      } else labels = ['Resume', 'Restart Song', 'Change Difficulty', this.practice ? 'Disable Practice Mode' : 'Enable Practice Mode', 'Exit to Menu'];
      pm.mode = mode; pm.sel = 0;
      pm.items = labels.map((s, i) => { const a = new G.Alphabet(s, true, 0, 70 * i + 30); a.alpha = 0; a.tw = null; return a; });
      this.layoutPause();
    },
    layoutPause() {
      const pm = this.pauseMenu;
      pm.items.forEach((a, i) => {
        const d = (i - pm.sel) * 1.3;
        a.alpha = i === pm.sel ? 1 : 0.6;
        a.tw = { x0: a.x, y0: a.y, x1: d * 20 + 90, y1: d * 120 + G.H * 0.48, t: 0 };
      });
    },
    updatePause(dt) {
      const pm = this.pauseMenu; pm.t += dt;
      for (const a of pm.items) {
        a.update(dt);
        const w = a.tw; if (!w) continue;
        w.t = Math.min(1, w.t + dt / 0.33); const k = G.ease.quartOut(w.t);
        a.x = G.lerp(w.x0, w.x1, k); a.y = G.lerp(w.y0, w.y1, k);
      }
      // "Artist:" and "Charter:" swap every 15 seconds (0.75s fade out, swap, 0.75s fade in)
      pm.artistT += dt;
      const fadeAt = 0.1 + 1.8 + 15;
      if (pm.artistT > fadeAt) {
        const f = pm.artistT - fadeAt;
        if (f < 0.75) pm.artistA = 1 - G.ease.quartOut(f / 0.75);
        else if (f < 1.5) { if (!pm.swapped) { pm.swapped = true; pm.artistIsCharter = !pm.artistIsCharter; } pm.artistA = G.ease.quartOut((f - 0.75) / 0.75); }
        else { pm.artistA = 1; pm.artistT = 0.1 + 1.8; pm.swapped = false; }
      }
      // hold SHIFT + UP/DOWN to change the global offset (slow first, then fast after half a second)
      const I = G.input, up = I.isDown('ui_up'), dn = I.isDown('ui_down');
      if (I.isDown('shift') && (up || dn)) {
        pm.offHold += dt;
        if (pm.offFast) G.settings.offset = (G.settings.offset || 0) + (up ? 1 : -1) * dt * 30;
        else if (pm.offHold > 0.5) { pm.offFast = true; pm.offHold = 0; }
        G.settings.offset = G.clamp(G.settings.offset || 0, -1500, 1500);
      } else { if (pm.offFast || pm.offHold) G.saveSettings(); pm.offHold = 0; pm.offFast = false; }
    },
    pauseAction(a, repeat) {
      const pm = this.pauseMenu;
      if ((a === 'ui_up' || a === 'ui_down') && G.input.isDown('shift')) {
        if (!repeat) { G.settings.offset = G.clamp(Math.round(G.settings.offset || 0) + (a === 'ui_up' ? 1 : -1), -1500, 1500); G.saveSettings(); }
        return true;
      }
      if (a === 'ui_up' || a === 'ui_down') { pm.sel = (pm.sel + (a === 'ui_up' ? -1 : 1) + pm.items.length) % pm.items.length; G.sfx('scroll', { vol: 0.4 }); this.layoutPause(); return true; }
      if (a === 'accept' && !repeat) { this.pauseChoose(); return true; }
      if (a === 'back' && !repeat) { if (pm.mode === 'diff') this.backToPauseMain(); else this.resume(); return true; }
      return false;
    },
    pausePointer(x, y) {
      const pm = this.pauseMenu;
      for (let i = 0; i < pm.items.length; i++) { const it = pm.items[i]; if (y >= it.y - 10 && y <= it.y + 80 && x < it.x + it.width + 60) { if (i === pm.sel) this.pauseChoose(); else { pm.sel = i; this.layoutPause(); G.sfx('scroll', { vol: 0.4 }); } return; } }
    },
    pauseChoose() {
      const pm = this.pauseMenu, label = pm.items[pm.sel].text;
      if (pm.mode === 'diff') {
        if (/^back$/i.test(label)) { this.backToPauseMain(); return; }
        const d = pm.diffs[pm.sel];
        G.setScreen('play', Object.assign({}, this.params, { diff: d.diff, variation: d.variation, weekStats: null }));
        return;
      }
      if (label === 'Resume') this.resume();
      else if (label === 'Restart Song') this.restart();
      else if (label === 'Change Difficulty') this.pauseEntries('diff');
      else if (/Practice/.test(label)) {
        this.practice = !this.practice; G.settings.practice = this.practice; G.saveSettings();
        this.pauseEntries('main');
      } else if (label === 'Exit to Menu') this.exitToMenu();
    },
    backToPauseMain() { this.pauseEntries('main'); },
    resume() { this.paused = false; this.pauseMenu = null; G.audio.music.stop(0.1); this.audio.resume(); },
    restart(fromDeath) { G.audio.music.stop(0); G.setScreen('play', Object.assign({}, this.params, { weekStats: this.params.weekStats, noCutscene: true, blackIn: fromDeath ? 1 : 0 }), { instant: !!fromDeath }); },
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
      // each player's own game over sound + music (-pico, -darnell...)
      const pid = G.playerOf(bf.id), pico = pid === 'pico';
      const suffix = pid !== 'bf' && G.A.has('shared/music/gameplay/gameover/gameOver-' + pid + '.ogg') ? '-' + pid : '';
      const lossSfx = 'shared/sounds/gameplay/gameover/fnf_loss_sfx-' + pid + '.ogg';
      const ov = (this.sfx && this.sfx.gameOver) || null;   // (a mod stage's own game over sound + music: Genocide)
      G.sfx(ov && ov.sfx ? ov.sfx : pico ? 'deathPico' : suffix && G.A.has(lossSfx) ? lossSfx : 'death');
      // new players have no death animations: their own "oh no" one, held
      if (!bf.playAnim('firstDeath', true) && this.playAs) bf.playAnim(this.playAs.real.die, true);
      const dd = bf.deathData || {};
      const co = dd.cameraOffsets || [0, 0];
      const mid = { x: bf.x + bf.width / 2, y: bf.y + bf.height / 2 };
      // like V-Slice: zoom to the stage zoom x the character's death zoom, follow at half the normal rate
      this.gameOver = { t: 0, phase: 'intro', fade: 0, pico, suffix, music: ov && ov.music, end: ov && ov.end, zoom0: this.cam.zoom, zoom1: (this.stageZoom || 1) * (dd.cameraZoom || 1), target: { x: mid.x + co[0], y: mid.y + co[1] } };
      this.camTween = null;
      this.cam.follow(this.gameOver.target.x, this.gameOver.target.y);
      this.cam.followRate = 0.02;
      this.hud.alpha = 0;
    },
    updateGameOver(dt) {
      const go = this.gameOver; go.t += dt;
      const bf = this.bf;
      bf.update(dt);
      this.cam.zoom = G.lerp(go.zoom1, this.cam.zoom, Math.pow(0.01, dt / 0.5));
      this.cam.update(dt);
      if (go.phase === 'intro' && bf.finished) { go.phase = 'loop'; bf.playAnim('deathLoop', true); G.audio.music.play(go.music || 'shared/music/gameplay/gameover/gameOver' + go.suffix + '.ogg', { loop: true, bpm: 100 }); }
      // retry: wait (confirm jingle length / 7), fade to black over 2s, then the song starts over and fades in
      if (go.phase === 'confirm') { go.ct += dt; const w = go.pico ? 2.703 / 7 : 7.21 / 7; if (go.ct > w) go.fade = Math.min(1, (go.ct - w) / 2); if (go.ct > w + 2 && !go.left) { go.left = true; this.restart(true); } }
      if (go.phase === 'exit') { go.ct += dt; go.fade = Math.min(1, go.ct / 0.5); }
    },
    gameOverAction(a) {
      const go = this.gameOver;
      if (a === 'accept' && (go.phase === 'loop' || go.phase === 'intro')) {
        go.phase = 'confirm'; go.ct = 0;
        if (!this.bf.playAnim('deathConfirm', true) && this.playAs) this.bf.playAnim(this.playAs.real.retry, true);
        G.audio.music.stop(0);
        G.audio.music.play(go.end || 'shared/music/gameplay/gameover/gameOverEnd' + go.suffix + '.ogg', { loop: false });
      } else if (a === 'back' && go.phase !== 'confirm' && go.phase !== 'exit') { go.phase = 'exit'; go.ct = 0; G.audio.music.stop(0.3); this.exitToMenu(); }
    },
    // -------------------------------------------------- end of song
    endSong() {
      this.ended = true;
      if (this.audio) this.audio.stop();
      // a song's own ending cutscene plays first (same rule as the intro ones: not after a retry)
      if (!this.endCut) {
        this.endCut = true;
        const cs = G.Cutscenes && (G.Cutscenes[this.song.id + '@' + this.song.variation] || G.Cutscenes[this.song.id]);
        if (cs && cs.createEnd && !this.params.deaths && !this.params.noCutscene) {
          let sc = null; try { sc = cs.createEnd(this); } catch (e) { G.reportError(e, 'end cutscene'); }
          if (sc) { sc.isEnd = true; this.cutscene = sc; return; }
        }
      }
      const p = this.params, s = this.song;
      const acc = this.accN ? this.accSum / this.accN : 0;
      const stats = { score: Math.round(this.score), misses: this.misses, maxCombo: this.maxCombo, tally: Object.assign({}, this.tally), acc, totalNotes: this.notes.filter(n => n.line === 1 && isReal(n)).length };
      const cheated = this.botplay || this.practice;
      // V-Slice style tallies + rank (results screen, freeplay rank badges + clear %)
      const tl = this.tally, sick = (tl.killer || 0) + tl.sick;
      stats.tallies = { sick, good: tl.good, bad: tl.bad, shit: tl.shit, missed: tl.miss, maxCombo: this.maxCombo, totalNotesHit: sick + tl.good + tl.bad + tl.shit, totalNotes: stats.totalNotes };
      const scoreKey = s.id + (s.variation !== 'default' ? '-' + s.variation : '') + (this.playAs ? '-as-' + this.playAs.id : '');
      const prev = G.getScore(scoreKey, p.diff, 'bf');
      const prevRank = prev ? (prev.rank || null) : null;
      let isNewHighscore = false;
      if (!cheated) isNewHighscore = G.submitResult ? G.submitResult(scoreKey, p.diff, { score: stats.score, acc, misses: stats.misses, fc: this.misses === 0, tallies: stats.tallies })
        : G.submitScore(scoreKey, p.diff, 'bf', { score: stats.score, acc, misses: stats.misses, fc: this.misses === 0 });
      if (p.mode === 'story') {
        const ws = p.weekStats || { score: 0, misses: 0, maxCombo: 0, tally: { killer: 0, sick: 0, good: 0, bad: 0, shit: 0, miss: 0, total: 0 }, accSum: 0, accN: 0, totalNotes: 0 };
        ws.score += stats.score; ws.misses += stats.misses; ws.maxCombo = Math.max(ws.maxCombo, stats.maxCombo); ws.totalNotes += stats.totalNotes;
        for (const k in ws.tally) ws.tally[k] += stats.tally[k] || 0; ws.accSum += this.accSum; ws.accN += this.accN;
        if (p.songIndex + 1 < p.songs.length) { G.setScreen('play', Object.assign({}, p, { songIndex: p.songIndex + 1, weekStats: ws, deaths: 0 })); return; }
        const weekBest = !cheated && !!p.week && G.submitWeekScore(p.week, p.diff, 'bf', ws.score);
        G.setScreen(G.screens.results ? 'results' : 'storyMenu', { mode: 'story', week: p.week, diff: p.diff, newBest: weekBest, stats: Object.assign({}, ws, { acc: ws.accN ? ws.accSum / ws.accN : 0 }), title: (G.A.json('preload/data/levels/' + p.week + '.json') || {}).name || p.week, player: this.resultsPlayer() });
      } else G.setScreen(G.screens.results ? 'results' : 'freeplay', { mode: 'freeplay', song: s.id, diff: p.diff, variation: s.variation, stats, title: s.name, player: this.resultsPlayer(), prevRank, isNewHighscore, cheated });
    },
    // who the results screen shows: the player you picked (Nene sings her own songs as 'nene-playable', a sprite
    // the results screen doesn't know, so it fell back to BF + GF), else the character that sang
    resultsPlayer() { return this.playAs ? this.playAs.id : this.bf.id; },
    // -------------------------------------------------- drawing
    draw(ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      if (this.failed) { G.vcr(ctx, this.failed, G.W / 2, G.H / 2 - 20, { align: 'center', size: 28 }); G.vcr(ctx, 'Press ESC', G.W / 2, G.H / 2 + 24, { align: 'center', size: 22 }); return; }
      if (!this.ready) { if (!(G.Loading && G.Loading.frame(ctx, G.dt))) G.vcr(ctx, 'Loading...', G.W - 20, G.H - 50, { align: 'right', size: 32 }); return; }
      if (this.gameOver) { this.drawGameOver(ctx); return; }
      // world
      if (this.apple && this.apple.k > 0.004 && G.ModEvents) G.ModEvents._appleWorld(ctx, this);
      else if (this.sfx && this.sfx.drawWorld) this.sfx.drawWorld(ctx, this, cam => this.drawWorld(ctx, cam));
      else this.drawWorld(ctx, this.cam);
      if (this.sfx && this.sfx.drawOver) this.sfx.drawOver(ctx, this);
      if (this.mod && this.mod.drawWorld) this.mod.drawWorld(ctx, this);
      this.cam.drawFX(ctx);
      if (this.cutscene) { this.cutscene.draw(ctx); return; }
      // HUD
      const hudA = this.hud.alpha * this.hudParts.all;
      if (hudA > 0.01) { ctx.save(); ctx.globalAlpha = hudA; this.drawHUD(ctx); ctx.restore(); }
      if (this.mod && this.mod.drawTop) this.mod.drawTop(ctx, this);
      if (this.sfx && this.sfx.drawTop) this.sfx.drawTop(ctx, this);
      if (this.paused) this.drawPause(ctx);
      if (this.blackIn > 0) { G.setScreenT(ctx); ctx.globalAlpha = Math.min(1, this.blackIn); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    },
    drawWorld(ctx, cam) {
      for (const s of this.stage.ordered()) {
        const o = s.owner || s;
        const slot = o === this.bf ? 'bf' : o === this.dad ? 'dad' : o === this.gf ? 'gf' : null;
        const f = slot && this.charFilter[slot];
        if (f) { G.imgFilter = f; try { s.draw(ctx, cam); } finally { G.imgFilter = null; } }
        else s.draw(ctx, cam);
      }
    },
    songLabel() {
      const dn = (G.DIFF_INFO[this.song.diff] || {}).name || this.song.diff;
      return this.song.name.toLowerCase().includes(String(dn).toLowerCase()) ? this.song.name : this.song.name + ' (' + dn + ')';
    },
    // (a line can have its own speed: V-Slice's ScrollSpeed event can change one strumline only)
    lineSpeed(L) { return L && L.scroll != null ? L.scroll : this.scrollSpeed; },
    noteY(t, L) { const d = (t - this.songPos) * PX_PER_MS * this.lineSpeed(L); return this.down ? -d : d; },
    // a mod note kind's own picture (animated, looping), placed like V-Slice's Strumline + the FlxSprite.offset its
    // note kind script gives it (drawn with the line's camera already on)
    drawKindNote(ctx, n, K, S) {
      const N = this.kindStyle(K), sheet = N.notes; if (!sheet) return false;
      const lane = K.swapDown && this.down ? [0, 2, 1, 3][n.lane] : n.lane;
      if (K._sheet !== sheet) { K._sheet = sheet; K._fr = {}; }   // (frame lists belong to that copy of the sheet)
      const fr = K._fr, key = N.notePre(lane);
      const list = fr[key] || (fr[key] = G.Sparrow.byPrefix(sheet, key));
      if (!list.length) return false;
      const f = list[Math.floor((this.songPos + 1e6) * (K.fps || 24) / 1000) % list.length], f0 = list[0];
      const s = N.noteScale, L = this.lines[n.line];
      const off = (this.down && K.offDown) || K.off, flip = this.down && K.flipDown;
      let x = S.x - INITIAL_OFFSET - (f0.fw * s - STRUM_SIZE) / 2 - NUDGE;
      let y = S.y - INITIAL_OFFSET + this.noteY(n.t, L) * (L.ys || 1);
      if (off) { if (off[0] != null) x += 0.5 * f0.fw * (1 - s) - off[0]; y += 0.5 * f0.fh * (1 - s) - off[1]; }
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      if (S.angle) { ctx.translate(f0.fw / 2, f0.fh / 2); ctx.rotate(S.angle * Math.PI / 180); ctx.translate(-f0.fw / 2, -f0.fh / 2); }
      if (flip) { ctx.translate(0, f0.fh); ctx.scale(1, -1); }
      ctx.globalAlpha *= S.alpha;
      G.Sparrow.draw(ctx, sheet, f); ctx.restore();
      return true;
    },
    drawHUD(ctx) {
      const hud = this.hud;
      const notesSheet = NS.notes, holdImg = NS.hold;
      for (const L of this.lines) {
        if (L.x < -1000) continue;
        const lc = L.cam || hud, ys = L.ys || 1;
        for (const s of L.strums) s.draw(ctx, lc);
        // hold trails (behind the note heads, over the strums)
        lc.apply(ctx);
        for (const n of this.notes) {
          if (n.line !== this.lines.indexOf(L) || n.len <= 0 || n.done && !n.holding) continue;
          if (n.missed && !n.dropped && this.songPos > n.holdEnd) continue;
          this.drawHold(ctx, L, n, holdImg);
        }
        // note heads (they follow their strum: modcharts move, spin + fade the strums)
        const li = this.lines.indexOf(L);
        for (const n of this.notes) {
          if (n.line !== li || n.hit || n.done) continue;
          const S = L.strums[n.lane];
          const y = S.y - INITIAL_OFFSET + this.noteY(n.t, L) * ys;
          if (y > G.H + 120 || y < -260) { if ((n.t - this.songPos) * PX_PER_MS * this.scrollSpeed > G.H + 300) break; continue; }
          const K = kindOf(n);
          if (K && K.style && this.drawKindNote(ctx, n, K, S)) continue;
          const f = G.Sparrow.byPrefix(notesSheet, NS.notePre(n.lane))[0]; if (!f) continue;
          const ns = NS.noteScale, w = f.fw * ns;
          const x = S.x - INITIAL_OFFSET - (w - STRUM_SIZE) / 2 - NUDGE;
          if (this.mod && this.mod.drawNote && this.mod.drawNote(ctx, this, n, L, x, y, f, notesSheet)) continue;
          ctx.save(); ctx.translate(x, y);
          if (S.angle) { const c = f.fw * ns / 2; ctx.translate(c, c); ctx.rotate(S.angle * Math.PI / 180); ctx.translate(-c, -c); }
          ctx.scale(ns, ns);
          ctx.globalAlpha *= (n.missed ? 0.3 : 1) * S.alpha;
          G.Sparrow.draw(ctx, notesSheet, f); ctx.restore();
        }
        for (const cv of this.covers) if (cv.line === li) {
          const S = L.strums[cv.lane];
          cv.x = S.x - INITIAL_OFFSET + STRUM_SIZE / 2 - cv.width / 2 - 12; cv.y = S.y + INITIAL_OFFSET + STRUM_SIZE / 2 - 96;
          cv.draw(ctx, lc);
        }
      }
      for (const sp of this.splashes) sp.draw(ctx, this.lines[1].cam || hud);
      // health bar
      const bg = this.hbBg;
      if (this.sfx && this.sfx.drawHealth && this.sfx.drawHealth(ctx, this)) { /* a mod's own health bar + score */ }
      else if (!this.hideHealth && this.hudParts.health.alpha * this.hudParts.health.apple > 0.004) {   // (stage cinematics hide the bar, icons + score)
      const hp = this.hudParts.health, by0 = bg.y; bg.y += hp.dy;
      ctx.save(); ctx.globalAlpha *= hp.alpha * hp.apple;
      bg.draw(ctx, hud);
      hud.apply(ctx);
      const bx = bg.x + 4, by = bg.y + 4, bw = bg.width - 8, bh = bg.height - 8;
      const p = G.clamp(this.health / 2, 0, 1);
      ctx.fillStyle = (this.dad && this.dad.data && this.dad.data.hpColor) || '#FF0000'; ctx.fillRect(bx, by, bw * (1 - p), bh);   // (mods can paint the opponent's side)
      ctx.fillStyle = '#66FF33'; ctx.fillRect(bx + bw * (1 - p), by, bw * p, bh);
      // icons (150x150 frames: normal | losing)
      const split = bg.x + bg.width * (1 - p);
      this.drawIcon(ctx, this.iconP1, split - 26, bg.y + bg.height / 2, this.health < 0.4);
      this.drawIcon(ctx, this.iconP2, split - (150 - 26), bg.y + bg.height / 2, this.health > 1.6);
      G.vcr(ctx, this.scoreLine(), G.W / 2, bg.y + 30, { align: 'center', size: 20, outline: 1.5 });
      ctx.restore(); bg.y = by0;
      }
      const by = this.phoneArrows ? 230 : this.down ? G.H - 120 : 90;
      if (this.botplay) G.vcr(ctx, 'BOTPLAY', G.W / 2, by, { align: 'center', size: 32 });
      if (this.practice) G.vcr(ctx, 'PRACTICE MODE', G.W / 2, by + (this.phoneArrows ? 40 : this.down ? -40 : 40), { align: 'center', size: 22, alpha: 0.8 });
      // time bar (Psych)
      if (G.settings.timeBar !== 'off' && this.hudParts.time.alpha > 0.004) {
        // always at the top: in downscroll the arrows own the bottom of the screen
        const ty = (this.phoneArrows ? 170 : 19) + this.hudParts.time.dy, tw = 400, tx = G.W / 2 - tw / 2;
        ctx.save(); ctx.globalAlpha *= this.hudParts.time.alpha;     // (phones: the health bar + icons own the top)
        const prog = G.clamp(this.songPos / this.audio.length, 0, 1);
        ctx.fillStyle = '#000'; ctx.fillRect(tx - 4, ty - 4, tw + 8, 19);
        ctx.fillStyle = '#fff'; ctx.fillRect(tx, ty, tw * prog, 11);
        const left = Math.max(0, (this.audio.length - this.songPos) / 1000);
        const txt = G.settings.timeBar === 'left' ? G.fmtTime(left) : G.settings.timeBar === 'elapsed' ? G.fmtTime(Math.max(0, this.songPos / 1000)) : this.songLabel();
        G.vcr(ctx, txt, G.W / 2, ty - 6, { align: 'center', size: 22, outline: 2 });
        ctx.restore();
      }
      for (const s of this.popups) s.draw(ctx, hud);
      if (this.countdownSpr) this.countdownSpr.draw(ctx, hud);
      // touch controls
      if (G.touchMode) {
        G.setScreenT(ctx);
        const cols = ['#C24B99', '#00FFFF', '#12FA05', '#F9393F'];
        if (!this.phoneArrows) for (let i = 0; i < 4; i++) { ctx.globalAlpha = this.keys[i] ? 0.28 : 0.08; ctx.fillStyle = cols[i]; ctx.fillRect(i * G.W / 4, 0, G.W / 4, G.H); }
        // a soft circle under every finger on the arrows (so you see where you are while sliding)
        for (const k in this._tpos || {}) {
          const p = this._tpos[k], on = this._touch && this._touch[k] != null;
          ctx.globalAlpha = on ? 0.3 : 0.15; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 46, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = on ? 0.7 : 0.35; ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
        }
        ctx.globalAlpha = 1;
        const pb = this.pauseBtn || (this.pauseBtn = this.makePauseButton());
        if (pb) {
          const cir = G.A.image('preload/images/pauseCircle.png'), s = pb.spr, cx = s.x + pb.w / 2, cy = s.y + pb.h / 2;
          if (cir) { ctx.globalAlpha = 0.1; ctx.drawImage(cir, cx - cir.width * 0.84 / 2, cy - cir.height * 0.8 / 2, cir.width * 0.84, cir.height * 0.8); ctx.globalAlpha = 1; }
          pb.update(G.dt); pb.draw(ctx);
        } else { ctx.globalAlpha = 0.7; ctx.fillStyle = '#000'; G.roundRect(ctx, G.W - 110, 20, 88, 70, 14); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(G.W - 82, 36, 10, 38); ctx.fillRect(G.W - 62, 36, 10, 38); ctx.globalAlpha = 1; }
      }
    },
    // FNF mobile's pause button (V-Slice PlayState.initPauseSprites): 80% size, 35 px from the top right corner
    makePauseButton() {
      if (!G.TouchButton || !G.A.has('preload/images/pauseButton.png')) return null;
      const b = new G.TouchButton('preload/images/pauseButton', 0, 35, 0.8, () => { if (this.started && !this.paused && !this.gameOver) this.openPause(); }, { prefix: 'pause', rest: 1, instant: true, confirmFrom: 6, confirmTo: 33 });
      b.spr.x = G.W - b.w - 35;
      return b;
    },
    // Psych-style score line
    scoreLine() {
      const acc = this.accN ? this.accSum / this.accN : 0;
      const fc = this.misses === 0 ? (this.tally.bad + this.tally.shit === 0 ? (this.tally.good === 0 ? 'SFC' : 'GFC') : 'FC') : this.misses < 10 ? 'SDCB' : 'Clear';
      const rate = this.accN ? ratingName(acc) + ' (' + (acc * 100).toFixed(2) + '%) - ' + fc : '?';
      return 'Score: ' + Math.round(this.score) + ' | Misses: ' + this.misses + ' | Rating: ' + rate;
    },
    drawIcon(ctx, ic, x, cy, losing) {
      if (!ic.img) return;
      const fw = ic.img.width >= 300 ? 150 : ic.img.width, fh = ic.img.height;
      const frame = losing && ic.img.width >= 300 ? 1 : 0;
      const s = ic.scale;
      ctx.save();
      if (ic.alpha != null) ctx.globalAlpha *= ic.alpha;
      ctx.translate(x + 75, cy);
      ctx.scale(ic.flip ? -s : s, s);
      ctx.imageSmoothingEnabled = !ic.pixel;
      ctx.drawImage(ic.img, frame * fw, 0, fw, fh, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    },
    // one sustain trail: tiled hold piece + end cap from NOTE_hold_assets (8 columns)
    drawHold(ctx, L, n, img) {
      if (!img) return;
      const colW = img.width / 8, zoom = NS.holdScale, w = colW * zoom, S = L.strums[n.lane];
      const x = S.x - INITIAL_OFFSET + STRUM_SIZE / 2 - w / 2;
      let startT = n.t, endT = n.holdEnd;
      if (n.hit && n.holding) startT = Math.max(startT, this.songPos);
      if (endT <= startT) return;
      const y0 = S.y - INITIAL_OFFSET + STRUM_SIZE / 2 + this.noteY(startT, L) * (L.ys || 1);
      const len = (endT - startT) * PX_PER_MS * this.lineSpeed(L) * (L.ys || 1);
      const capH = img.height * zoom * 0.4;
      const bodyH = Math.max(0, len - capH);
      ctx.save();
      ctx.globalAlpha *= (n.dropped || n.missed ? 0.3 : 1) * S.alpha;
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
      ctx.globalAlpha = 0.6 * G.ease.quartOut(Math.min(1, pm.t / 0.8)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1;
      for (const a of pm.items) a.draw(ctx, null);
      // top right: song, artist/charter, difficulty, deaths, practice; each one drifts down 5px as it fades in
      const lines = pm.meta.slice();
      lines[1] = pm.artistIsCharter ? 'Charter: ' + pm.chr : 'Artist: ' + pm.art;
      lines[3] = (this.params.deaths || 0) + ' Blue Balls';
      const show = [0, 1, 2, 3].concat(this.practice ? [4] : []);
      show.forEach((li, i) => {
        const k = G.ease.quartOut(G.clamp((pm.t - 0.1 * (i + 1)) / 1.8, 0, 1));
        G.vcr(ctx, lines[li], G.W - 20, 15 + li * 32 + 5 * k, { align: 'right', size: 32, alpha: k * (li === 1 ? pm.artistA : 1), outline: 0 });
      });
      // bottom right, above the offset: who you're playing as (their icon, bobbing, + their name)
      const kp = G.ease.quartOut(G.clamp((pm.t - 0.5) / 1.8, 0, 1));
      const pid = this.bf ? G.playerOf(this.bf.id) : 'bf', PP = G.PLAYERS && G.PLAYERS[pid];
      // (a song's own singer who isn't one of the players, like the girl in Jordus: no name to show)
      if (this.iconP1 && kp > 0 && (pid !== 'bf' || !this.bf || /^bf/.test(this.bf.id))) {
        const ic = Object.assign({}, this.iconP1, { scale: 0.8 + 0.03 * Math.sin(pm.t * 4) });
        ctx.save(); ctx.globalAlpha = kp; this.drawIcon(ctx, ic, G.W - 150, G.H - 150 + 5 * kp, false); ctx.restore();
        G.vcr(ctx, 'PLAYING AS', G.W - 150, G.H - 178 + 5 * kp, { align: 'right', size: 16, alpha: kp, outline: 0 });
        G.vcr(ctx, ((PP && PP.name) || 'Boyfriend').toUpperCase(), G.W - 150, G.H - 160 + 5 * kp, { align: 'right', size: 32, alpha: kp, outline: 0 });
      }
      // bottom right: the offset
      const k = G.ease.quartOut(G.clamp((pm.t - 0.6) / 1.8, 0, 1));
      const oy = G.H - 16 * 2 - 40 + 5 * k;
      G.vcr(ctx, 'Global Offset: ' + Math.round(G.settings.offset || 0) + 'ms', G.W - 10, oy, { align: 'right', size: 16, alpha: k, outline: 0 });
      G.vcr(ctx, 'Hold SHIFT-UP/DOWN,', G.W - 10, oy + 20, { align: 'right', size: 16, alpha: k, outline: 0 });
      G.vcr(ctx, 'to change the offset.', G.W - 10, oy + 36, { align: 'right', size: 16, alpha: k, outline: 0 });
    },
    drawGameOver(ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      this.bf.draw(ctx, this.cam);
      const go = this.gameOver;
      if (go.fade > 0) { G.setScreenT(ctx); ctx.globalAlpha = go.fade; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    },
  };
})();
