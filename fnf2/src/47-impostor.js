// FNF 2 - VS IMPOSTOR: LEGACY (MOTORFROG, Clowfoe + the Impostor team; the official remaster of VS Impostor V4),
// played like the mod. Its engine is Psych Engine based with HScript stage + song scripts; what they do is here:
//   every song   the chord ghosts (a double note: a see-through copy of the singer does the other pose and fades,
//                V4's doGhostAnim), Psych holds for the characters that have them, the camera on fixed spots
//                (camSpecialThing), the zoom bops only once the opponent sang, the mod's HUD (green time bar with
//                the song name, score text in the opponent's colour, its ratings at the top), its game over +
//                pause music, the Reactor Beep red flash, Set Cams / Reset Cams / Insta Cam Zoom / Extra Cam Zoom /
//                flash / Optional Captions events (scripts/utils.hx)
//   cutscenes    the videos before the songs (Press BACK to skip, captions) + the V4 talk box (RGB box, bubble,
//                icon, typing, the last line under it), scripts/dialogue.hx
//                the 'task' credits box sliding in at the countdown (scripts/tasksong.hx), HUD Fade
//   stages       Polus (snow, the lonely speaker, the Meltdown crowd), MIRA HQ's cafeteria (Toogus Sax camera),
//                the reactor room (pillar crewmates, the core), Ejected (falling past MIRA HQ: buildings, clouds,
//                speed lines, everyone drifting, the HUD bobbing)
//   songs        Sabotage (GF shows up when Red notices), Meltdown (the ending video, the end of the week video),
//                Sussus Toogus (crewmates walking around, the sax guy), Lights Down (the dim vignette, the lights
//                going out, the ending), Reactor (its camera spots, the story-mode fade in + out), Ejected (the
//                falling video over the song's start)
// Pictures, songs, charts + videos come from the mod (tools/own/impostor.py, private build only).
(function () {
  const IMG = 'shared/images/impostor/', SND = 'preload/sounds/impostor/', MUS = 'preload/music/impostor/', VID = 'videos/videos/impostor/';
  const DATA = 'preload/data/impostor/';
  const flashOn = () => G.settings.flashing !== false;
  const isStory = P => P.params && P.params.mode === 'story';
  const songData = id => G.A.json(DATA + 'songs/' + id + '.json');
  const isImp = P => !!(P.stage && P.stage.data && P.stage.data.impostor);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const E = {
    linear: t => t, quadInOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, sineOut: t => Math.sin(t * Math.PI / 2),
    sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2, circIn: t => 1 - Math.sqrt(1 - t * t), cubeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  };
  // little tween list (FlxTween.tween on a plain object)
  function tween(list, obj, to, dur, ease, done) {
    for (let i = list.length - 1; i >= 0; i--) if (list[i].obj === obj) for (const k in to) if (k in list[i].to) delete list[i].to[k];
    const from = {}; for (const k in to) from[k] = obj[k];
    list.push({ obj, from, to, dur: Math.max(0.0001, dur), t: 0, ease: ease || E.linear, done });
  }
  function tick(list, dt) {
    for (let i = 0; i < list.length; i++) {
      const w = list[i]; w.t += dt; const k = Math.min(1, w.t / w.dur), e = w.ease(k);
      for (const p in w.to) w.obj[p] = w.from[p] + (w.to[p] - w.from[p]) * e;
      if (k >= 1) { list.splice(i--, 1); if (w.done) w.done(); }
    }
  }
  const hex = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); const v = m ? parseInt(m[1], 16) : 0xA1A1A1; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const toHex = a => '#' + a.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const sprite = (path, x, y) => new G.Sprite(x || 0, y || 0).loadImage(path);

  // ================================================================ the chord ghosts (the 'afterimages': Character.playGhostAnim)
  // A double note (a note of the same side within 3 ms of the last one): the singer's pose before this note goes
  // into ghost #lane (one per arrow), drawn right behind the singer at 0.6 of its alpha, tinted with its health
  // colour; it slides 40 px the way that pose points while it fades out in 0.75 s. The singer takes the new pose.
  const DRIFT = { UP: [0, -40], DOWN: [0, 40], LEFT: [-40, 0], RIGHT: [40, 0] };
  class Ghost {
    constructor(owner) { this.owner = owner; this.zIndex = (owner ? owner.zIndex : 0) - 0.5; this.spr = new G.Sprite(0, 0); this.spr.alpha = 0; this.tw = []; }
    fire(anim) {
      const c = this.owner, s = this.spr;
      if (!c || !anim || !c.anims[anim]) return;
      s.anims = c.anims; s.animOffsets = c.animOffsets; s.globalOffsets = c.globalOffsets; s.useAnimOffsets = true;
      s.x = c.x; s.y = c.y; s.scale = c.scale; s.origin = c.origin; s.offset = c.offset; s.flipX = c.flipX; s.flipY = c.flipY;
      s.scroll = c.scroll; s.antialias = c.antialias; s.atlas = c.atlas; s.sheet = c.sheet;
      s.play(anim, true); s.frameW = c.frameW; s.frameH = c.frameH;
      s.blend = null; s.tint = 'mul:' + ((c.data && c.data.hpColor) || '#808080');
      s.alpha = (c.alpha == null ? 1 : c.alpha) * 0.6;
      this.zIndex = c.zIndex - 0.5;
      const d = DRIFT[anim.slice(4).split('-')[0]] || [0, 0];
      this.tw.length = 0; tween(this.tw, s, { alpha: 0, x: c.x + d[0], y: c.y + d[1] }, 0.75, E.linear);
    }
    update(dt) { tick(this.tw, dt); if (this.spr.alpha > 0) this.spr.update(dt); }
    draw(ctx, cam) {
      const s = this.spr; if (s.alpha <= 0.002 || !this.owner || !this.owner.visible) return;
      const f = s.cur && s.cur.flip; if (f) s.flipX = !s.flipX;
      s.draw(ctx, cam);
      if (f) s.flipX = !s.flipX;
    }
  }
  const SING = ['singLEFT', 'singDOWN', 'singUP', 'singRIGHT'];
  const ghostsOn = c => !!(c && c.data && c.data.impostor && c.data.impostor.afterimages !== false && G.settings.afterimages !== false);
  // (PlayField.characterSing: runs for every note a side hits; the opponent's pose is already on when this runs,
  // yours comes right after, so the opponent's pose from its last note is kept here)
  function chordHit(P, n, who) {
    const I = P.imp, c = P[who];
    if (!I || !c || n.kind === 'No Animation' || n.kind === 'hey' || n.kind === 'gfsing') return;
    if (c._locked) return;                         // (stunned: no pose)
    const prev = who === 'bf' ? c.animName : I.prevAnim[who];
    const gh = I.ghosts[who] && I.ghosts[who][n.lane];
    if (gh && I.lastHit[who] != null && Math.abs(I.lastHit[who] - n.t) < 3 && ghostsOn(c) && !I.dark) gh.fire(prev);
    I.lastHit[who] = n.t; I.holdK[who] = 0;
    if (who !== 'bf') I.prevAnim[who] = c.animName;
  }
  // ================================================================ Psych holds: characters without V-Slice holds
  // (vslice_sustains false) take their pose again on every piece of a hold: a piece every step after the head
  function psychHolds(P) {
    const I = P.imp, st = P.cond.stepCrochet;
    // (PlayField.noteHit: every piece of a hold lights its arrow again, from the start: the hold flickers on the step)
    for (const n of P.notes) {
      if (!n.hit || n.len <= 0 || n.done || n.dropped || (n.line === 1 && !n.holding && !P.botplay)) continue;
      const k = Math.floor((P.songPos - n.t) / st + 1e-6);
      if (k >= 1 && k <= Math.round(n.len / st) && (n._pk || 0) < k) { n._pk = k; const sn = P.lines[n.line] && P.lines[n.line].strums[n.lane]; if (sn) sn.playA('confirm', true); }
    }
    for (const who of ['dad', 'bf', 'gf']) {
      const c = P[who]; if (!c || !c.data.impostor || c.data.impostor.vsliceSustains || c._locked) continue;
      const line = who === 'bf' ? 1 : 0;
      // (an opponent's hold: only the one(s) who sang it)
      const mine = n => line === 1 || (n.who ? n.who.includes(c) : who === 'dad');
      const hold = P.notes.find(n => n.line === line && n.hit && n.len > 0 && !n.done && !n.dropped && P.songPos < n.t + n.len + st && (line === 0 || n.holding || P.botplay) && mine(n));
      if (!hold) continue;
      const k = Math.floor((P.songPos - hold.t) / st + 1e-6), kmax = Math.round(hold.len / st);
      if (k < 1 || k > kmax || I.holdK[who] >= k) continue;
      I.holdK[who] = k;
      if (hold.kind === 'No Animation' || hold.kind === 'hey') continue;
      c.sing(hold.lane, false, hold.kind === 'alt' ? '-alt' : '');
      if (who !== 'bf') I.prevAnim[who] = c.animName;
    }
  }

  // ================================================================ the HUD (scripts/utils.hx modifyGUI + Psych's PlayState)
  const RANKS = [[1, 'S+'], [0.95, 'S'], [0.9, 'A'], [0.8, 'B'], [0.7, 'C'], [0.6, 'D'], [0, 'F']];
  const ACC_W = { killer: 1, sick: 1, good: 0.67, bad: 0.34, shit: 0 };
  function scoreText(P) {
    const I = P.imp, n = I.accN;
    const acc = n ? I.accSum / n : 0;
    const accT = n ? (Math.floor(acc * 10000) / 100).toFixed(2) + '%' : 'N/A';
    const rank = n ? RANKS.find(r => acc >= r[0] - 1e-9)[1] : 'N/A';
    return 'Score: ' + Math.round(P.score).toLocaleString('en-US') + ' | Misses: ' + P.misses + ' | Accuracy: ' + accT + ' | Rank: ' + rank;
  }
  // a picture in one flat colour (FlxSprite.setColorTransform(0, 0, 0, 1, r, g, b))
  const flatCache = new WeakMap();
  function flat(img, col) {
    if (!img) return img;
    let m = flatCache.get(img); if (!m) flatCache.set(img, m = {});
    let c = m[col]; if (c && c._gen === G.gfxGen) return c;
    c = G.makeCanvas(img.width, img.height); const x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    c._gen = G.gfxGen; m[col] = c; return c;
  }
  // a health icon with the lights out (lights-down.hx hudDarkShader): black inside, its edge light grey (224)
  const darkCache = new WeakMap();
  function darkIcon(img) {
    if (!img || !img.width) return img;
    let c = darkCache.get(img); if (c && c._gen === G.gfxGen) return c;
    const W = img.width, H = img.height;
    c = G.makeCanvas(W, H); const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H), a = d.data, solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = a[i * 4 + 3] > 0.12 * 255 ? 1 : 0;     // (threshold .12)
    const R = 3;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const i = yy * W + xx; if (!a[i * 4 + 3]) continue;
      let edge = !solid[i];
      for (let dy = -R; dy <= R && !edge; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        const X = xx + dx, Y = yy + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H || !solid[Y * W + X]) { edge = true; break; }
      }
      const v = edge ? 224 : 0; a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = v;
    }
    x.putImageData(d, 0, 0); c._gen = G.gfxGen; darkCache.set(img, c);
    return c;
  }
  function drawHealth(ctx, P) {
    const hp = P.hudParts.health; if (P.hideHealth || hp.alpha * hp.apple <= 0.004) return true;
    const hud = P.hud; hud.apply(ctx);
    ctx.save(); ctx.globalAlpha *= hp.alpha * hp.apple;
    const barA = P.imp.barA == null ? 1 : P.imp.barA, a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * barA;
    const img = G.A.image(IMG + 'hud/healthBar.png');
    const w = img ? img.width : 601, h = img ? img.height : 19;
    const x = (G.W - w) / 2, y = (P.phoneArrows ? 0.11 : P.down ? 0.11 : 0.89) * G.H + hp.dy;
    const p = G.clamp(P.health / 2, 0, 1), dark = P.imp.dark;
    // (Psych's Bar: the picture is the frame, the fill sits 3 px inside it; lights out: black (them) / light grey
    // (you), the frame grey (setColorTransform 224), the icons dark)
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    const oppCol = P.imp.oppCol || (P.dad && P.dad.data.hpColor);
    ctx.fillStyle = dark ? '#000000' : oppCol || '#FF0000'; ctx.fillRect(x + 3, y + 3, (w - 6) * (1 - p), h - 6);
    ctx.fillStyle = dark ? '#E0E0E0' : (P.bf && P.bf.data.hpColor) || '#66FF33'; ctx.fillRect(x + 3 + (w - 6) * (1 - p), y + 3, (w - 6) * p, h - 6);
    if (img) ctx.drawImage(dark ? flat(img, '#E0E0E0') : img, x, y);
    // icons: Psych's spots (healthBar.x + width * (1 - percent), - 26 / - 150 + 26; y = bar - 75)
    const split = x + w * (1 - p);
    const i1 = P.iconP1.img, i2 = P.iconP2.img;
    if (dark) { P.iconP1.img = darkIcon(i1); P.iconP2.img = darkIcon(i2); }
    P.drawIcon(ctx, P.iconP1, split - 26, y - 75 + 75, P.health < 0.4);
    // (a stand-in icon that doesn't bop, a little further left: d'low.hx fakeIcon at barCenter - 75 - 52)
    if (P.imp.fakeIcon) P.drawIcon(ctx, P.imp.fakeIcon, split - 127, y - 75 + 75, false);
    else P.drawIcon(ctx, P.iconP2, split - (150 - 26), y - 75 + 75, P.health > 1.6);
    P.iconP1.img = i1; P.iconP2.img = i2;
    ctx.globalAlpha = a0;
    const col = (oppCol && oppCol !== '#000000') ? oppCol : '#FFFFFF';
    // (Psych: scoreTxt at healthBar.y + 40, size 20; the letters' tops land 2 px lower; Double Kill's end on
    // downscroll: at the top, FlxG.height x .06)
    const bop = 1 + 0.075 * (P.imp.scoreBop || 0) / 0.2, ty = P.imp.scoreTop ? G.H * 0.06 + 2 : y + 37.2;
    if (bop !== 1) { ctx.translate(G.W / 2, ty + 11); ctx.scale(bop, bop); ctx.translate(-G.W / 2, -(ty + 11)); }
    G.vcr(ctx, scoreText(P), G.W / 2, ty, { align: 'center', size: 20.4, outline: 1.25, color: col });
    ctx.restore();
    return true;
  }
  function drawTime(ctx, P) {
    const tp = P.hudParts.time; if (G.settings.timeBar === 'off' || tp.alpha <= 0.004) return true;
    P.hud.apply(ctx);
    ctx.save(); ctx.globalAlpha *= tp.alpha * (P.imp.timeA != null ? P.imp.timeA : 1);
    // timeTxt at STRUM_X + 640 - 585 = 97 (+10), the bar right under its top (utils.hx modifyGUI)
    // (phones: in the middle under the score, where FNF 2's own time bar goes there)
    const img = G.A.image(IMG + 'hud/timeBar.png'), w = img ? img.width : 400, h = img ? img.height : 19;
    const bx = P.phoneArrows ? Math.round((G.W - w) / 2) : 97, by = (P.phoneArrows ? 172 : P.down ? G.H - 45 : 23.75) + tp.dy;
    const prog = P.audio && P.audio.length ? G.clamp(P.songPos / P.audio.length, 0, 1) : 0;
    ctx.fillStyle = '#2e412e'; ctx.fillRect(bx + 3, by + 3, w - 6, h - 6);
    ctx.fillStyle = '#44d844'; ctx.fillRect(bx + 3, by + 3, (w - 6) * prog, h - 6);
    if (img) ctx.drawImage(img, bx, by);
    const left = Math.max(0, ((P.audio && P.audio.length) - P.songPos) / 1000);
    const txt = G.settings.timeBar === 'left' ? G.fmtTime(left) : G.settings.timeBar === 'elapsed' ? G.fmtTime(Math.max(0, P.songPos / 1000)) : String(P.song.name || '').toUpperCase();
    G.vcr(ctx, txt, bx + 10, by + 3.25, { align: 'left', size: 14.5, outline: 1.25 });     // (timeTxt.y 19 + 8)
    ctx.restore();
    return true;
  }
  // the ratings + combo at the top middle (PsychHUD.popUpScore + utils.hx modifyGUI / onPopUpScorePost: the rating x .42
  // at y 55, the numbers x .33 at 122.5 with -30 padding; they pop in at .47 / .35, settle in 0.5 s (expoOut), then fade in
  // 0.5 s (expoOut) after stepCrotchet x 0.01 s; middlescroll moves them 440 px right)
  const expoOut = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  const circOut = t => Math.sqrt(1 - (t - 1) * (t - 1)), sineIn = t => 1 - Math.cos(t * Math.PI / 2);
  function popups(P, r, combo) {
    const I = P.imp, img = G.A.image(IMG + 'hud/' + r + '.png'); if (!img) return true;
    I.accSum += ACC_W[r] != null ? ACC_W[r] : 1; I.accN++;
    const now = P.songPos;
    I.pops.length = 0;
    const s = sprite(img); s.k = 0.42; s.k0 = 0.47; s.rating = true; s.born = now; s.delay = P.cond.stepCrochet * 0.01;
    I.pops.push(s);
    const c = Math.max(0, combo), digits = [];
    if (c >= 1000) digits.push(Math.floor(c / 1000) % 10);
    digits.push(Math.floor(c / 100) % 10, Math.floor(c / 10) % 10, c % 10);
    const ims = digits.map(d => G.A.image(IMG + 'hud/num' + d + '.png'));
    let total = 0; for (const im of ims) if (im) total += (im.width - 30) * 0.33;
    let xo = (G.W - total) / 2 + (P.middle ? 440 : 0);
    for (const im of ims) {
      if (!im) continue;
      const d = sprite(im); d.k = 0.33; d.k0 = 0.35;
      d.cx = xo; xo += (im.width - 30) * 0.33;       // (centred on the running offset: utils.hx's "Evil factor")
      d.born = now; d.delay = s.delay;
      I.pops.push(d);
    }
    updatePops(P, 0);
    return true;
  }
  function updatePops(P) {
    const I = P.imp, now = P.songPos;
    I.pops = I.pops.filter(s => (now - s.born) / 1000 < s.delay + 0.5);
    for (const s of I.pops) {
      const age = Math.max(0, (now - s.born) / 1000);
      const sc = s.k0 + (s.k - s.k0) * expoOut(age / 0.5);
      s.scale.x = s.scale.y = sc; s.updateHitbox();
      // (phones: the big arrows own the bottom, so the middle of the screen like FNF 2's own popups there)
      if (s.rating) { s.x = (G.W - s.frameW * sc) / 2 + (P.middle ? 440 : 0); s.y = P.phoneArrows ? 205 : P.down ? G.H - s.frameH * sc - 50 : 55; }
      else { s.x = s.cx - s.frameW * sc / 2; s.y = P.phoneArrows ? 272.5 : P.down ? G.H - s.frameH * sc - 117.5 : 122.5; }
      s.alpha = 1 - expoOut(Math.max(0, age - s.delay) / 0.5);
    }
  }

  // ================================================================ the 'task' credits box (scripts/tasksong.hx)
  // The song's name (bold) + who made it, on a see-through white box: slides in from the left when the countdown
  // starts (1 s quintInOut), stays 2 s, slides back out. On top of everything (the mod's camOther).
  const quintInOut = t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  const LH = 27.6;            // (24 px Liberation Sans: one line of an FlxText; its box is 4 px taller)
  function taskStart(P) {
    const I = P.imp, d = I.data.task; if (!d) return;
    if (!measure) measure = G.makeCanvas(4, 4).getContext('2d');
    measure.font = '24px liberbold'; let size = measure.measureText(d[0]).width + 4;
    measure.font = '24px liber'; for (const l of d[1].split('\n')) size = Math.max(size, measure.measureText(l).width + 4);
    I.task = { t: 0, size };
  }
  function drawTask(ctx, P) {
    const I = P.imp, T = I.task, d = I.data.task; if (!T || !d || I.taskHidden) return;
    const size = T.size, out = -(size + 15);
    let x;
    if (T.t < 1) x = out + (12 - out) * quintInOut(T.t);
    else if (T.t < 3) x = 12;
    else if (T.t < 4) x = 12 + (out - 50) * quintInOut(T.t - 3);
    else return;
    G.setScreenT(ctx);
    const lines = d[1].split('\n'), h = (LH + 4) + (LH * lines.length + 4) + 15;
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff'; ctx.fillRect(x - 12, 188, size + 24, h); ctx.restore();
    G.text(ctx, d[0], x + 2, 202, { size: 24, font: 'liberbold', align: 'left', baseline: 'top', outline: 1.25 });
    lines.forEach((l, i) => G.text(ctx, l, x + 2, 232 + i * LH, { size: 24, font: 'liber', align: 'left', baseline: 'top', outline: 1.25 }));
  }

  // ================================================================ the game camera's own alpha + fades
  // (camGame.alpha = 0 hides the world; camGame.fade(colour, seconds, in))
  function camFade(P, col, dur, fadeIn) { P.imp.fade = { col, dur: Math.max(0.0001, dur), t: 0, fadeIn: !!fadeIn }; }
  function drawCamCover(ctx, P) {
    const I = P.imp, F = I.fade;
    let a = 1 - I.camA, col = '#000';
    if (F) { const k = Math.min(1, F.t / F.dur); const fa = F.fadeIn ? 1 - k : k; if (fa > a) { a = fa; col = F.col; } }
    if (a <= 0.002) return;
    G.setScreenT(ctx); ctx.save(); ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = col; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); ctx.restore();
  }

  // ================================================================ camera spots + zoom (utils.hx camSpecialThing)
  // (utils.hx dadOff / bfOff: the spots belong to the side, so a Change Character keeps them)
  function setCams(P, dad, bf, zoom) {
    const sp = P.imp.spots;
    if (dad) { sp.dad = { x: dad[0], y: dad[1] }; P.dad.camFocus = Object.assign({}, sp.dad); }
    if (bf) { sp.bf = { x: bf[0], y: bf[1] }; P.bf.camFocus = Object.assign({}, sp.bf); }
    if (zoom > 0) { P.imp.baseZoom = zoom; applyZoom(P); }
    if (P.camTarget && G.ModEvents && !P.camForced) { const c = P.camTarget === 'bf' ? P.bf : P.dad; if (c && c.camFocus) P.cam.follow(c.camFocus.x, c.camFocus.y); }
  }
  // the camera leans 20 px the way the singer of the side it looks at points (camFollowsCharacters + utils.hx
  // onMoveCamera): the fixed spot + the lean, every frame, not before the song starts. A GF section looks at
  // BF's spot and leans with GF.
  function leanCam(P) {
    const I = P.imp; if (I.camWho == null || P.camForced || P.camTween || P.gameOver) return;
    const side = I.camWho === 1 ? 'dad' : 'bf';
    const who = I.camTarget ? P[I.camTarget] : I.camWho === 1 ? P.dad : I.camWho === 2 ? (P.gf || P.bf) : P.bf;
    const f = I.spots[side] || (P[side] && P[side].camFocus);
    if (!f) return;
    let dx = 0, dy = 0;
    if (P.started && P.songPos >= 0 && who) { const d = DRIFT[String(who.animName || '').slice(4).split('-')[0]]; if (d) { dx = d[0] / 2; dy = d[1] / 2; } }
    P.cam.follow(f.x + dx, f.y + dy);
  }
  function applyZoom(P) { const z = P.imp.baseZoom + (P.imp.zoomAdd || 0); P.camZoom = z; P.stageZoom = z; }
  // Psych's zoom bop adds 0.015 x camZoomingMult to the zoom (0.03 x to the HUD); FNF 2 multiplies: the same size
  // at the zoom the camera has right now (worked out on every beat, right before the bop)
  function bopSize(P) {
    const I = P.imp, m = I.bopMult == null ? 1 : I.bopMult;
    P.bopIntensity = 1 + 0.015 * m / Math.max(0.1, P.camZoom || P.stage.zoom); P.hudBopIntensity = 0.03 * m;
  }
  // how fast the zoom goes back (camZoomingDecay, 1 = normal). The mod's engine: zoom = decayLerp(zoom, default,
  // 6.25 x decay, elapsed) = e^(-6.25 x decay x t) of the way left (checked in the exe: 6.25, not Psych's 3.125);
  // FNF 2's bop shrinks by 0.05^(t x bopDecay)
  function zoomDecay(P, k) { P.imp.zoomDecay = k; P.bopDecay = k * 6.25 / -Math.log(0.05); }
  // defaultCamZoom = z: eases there, or once camZooming is on (before that the camera's zoom stays)
  function setZoom(P, z) { const I = P.imp; if (I.camZooming) easeZoom(P, z); else { I.baseZoom = z; P.stageZoom = z + (I.zoomAdd || 0); } }
  // defaultCamZoom = z the way the mod gets there: the camera eases (e^(-6.25 x decay x t) of the way left)
  function easeZoom(P, z) {
    const I = P.imp; I.baseZoom = z; P.stageZoom = z + (I.zoomAdd || 0);
    const r = 6.25 * (I.zoomDecay || 1), dur = 4.6 / r, end = 1 - Math.exp(-r * dur);
    P.zoomTween = { t: 0, dur, z0: P.camZoom, z1: P.stageZoom, ease: k => (1 - Math.exp(-r * dur * k)) / end };
  }

  // the red flash on every Reactor Beep (camOther: over everything; photosensitive = softer, under the HUD)
  function beep(P) {
    const I = P.imp; I.tw = I.tw.filter(w => w.obj !== I.beepFx);
    if (!flashOn()) { I.beepFx.a = 0; tween(I.tw, I.beepFx, { a: 0.15 }, 0.2, E.sineOut, () => tween(I.tw, I.beepFx, { a: 0 }, 0.4, E.quadInOut)); I.beepFx.under = true; }
    else { I.beepFx.a = 0.3; I.beepFx.under = false; tween(I.tw, I.beepFx, { a: 0 }, 1 / (I.beepFade || 3)); }   // (reactorFade)
  }

  // ================================================================ the base every Impostor song runs on
  const BASE = {
    setup(P) {
      const I = P.imp = { data: songData(P.song.id) || {}, spots: {}, tw: [], pops: [], lastHit: {}, prevAnim: {}, holdK: {}, ghosts: {},
        accSum: 0, accN: 0, beepFx: { a: 0 }, caption: null, baseZoom: P.stage.zoom, zoomAdd: 0, camA: 1, fade: null };
      bopSize(P);
      // (the shared pack: game over + pause music, the talk sounds: ready before they're needed)
      const core = G.Packs && G.Packs.all && G.Packs.all.impostor; if (core && !core.bodyLoaded) G.Packs.needBody(core);
      // (asked for now: the song waits for the pictures, the sounds are decoded before they're needed)
      for (const n of ['ready', 'set', 'go', 'healthBar', 'timeBar', 'sick', 'good', 'bad', 'shit', 'combo']) G.A.image(IMG + 'hud/' + n + '.png');
      for (let d = 0; d < 10; d++) G.A.image(IMG + 'hud/num' + d + '.png');
      for (const n of ['intro3', 'intro2', 'intro1', 'introGo', 'fnf_loss_sfx']) G.A.audio(SND + n + '.ogg');
      for (const n of ['gameOver', 'gameOverEnd']) G.A.audio(MUS + n + '.ogg');
      if (P.gf) { const sc = (P.stage.data.characters.gf || {}).scroll; if (sc) P.gf.scroll = { x: sc[0], y: sc[1] }; }
      // (four ghosts each, one per arrow; drawn right behind their singer)
      for (const who of ['bf', 'dad', 'gf']) { I.ghosts[who] = P[who] ? [0, 1, 2, 3].map(() => new Ghost(P[who])) : []; for (const g of I.ghosts[who]) P.stage.addExtra(g, P[who]); }
    },
    reset(P) {
      const I = P.imp; if (!I) return;
      I.tw.length = 0; I.pops.length = 0; I.lastHit = {}; I.prevAnim = {}; I.holdK = {}; I.accSum = 0; I.accN = 0; I.beepFx.a = 0; I.caption = null;
      I.scoreBop = 0; I.timeA = 0; I.timeT = -1; I.camWho = null;
      I.task = null; I.taskHidden = false; I.dark = false; I.camA = 1; I.fade = null;
      I.camZooming = false; P.zoomRate = 0;          // (Psych: the bops start once the opponent sings)
      I.bopRate = 4; I.bopMult = 1; bopSize(P); zoomDecay(P, 1);
      I.twist = null; I.twTw = [];
      for (const c of [P.cam, P.hud]) { c.angle = 0; c.px = c.py = 0; }
      I.zoomAdd = 0; I.baseZoom = P.stage.zoom; applyZoom(P);
      for (const who of ['bf', 'dad', 'gf']) for (const g of I.ghosts[who]) { g.spr.alpha = 0; g.tw.length = 0; g.owner = P[who]; }
      I.oppCol = null; I.fakeIcon = null; I.camTarget = null; I.beepFade = 3;
      // the arrows where the mod has them (ModManager.getCenterX / getStrumX / getBaseY: each arrow's middle at
      // 112 px steps around x 321 (opponent) / 953 (you), y 106 from the top or bottom)
      if (!P.middle && !P.phoneArrows && G.NoteGeom) P.lines.forEach((L, li) => L.strums.forEach((st, i) => {
        if (st._bx0 == null) { st._bx0 = st.bx; st._by0 = st.by; }
        const cx = (li === 0 ? 321 : G.W - 327) + 112 * (i - 1.5), cy = P.down ? G.H - 106 : 106;
        st.bx = st._bx0 + cx - G.NoteGeom.cx(st._bx0); st.by = st._by0 + cy - G.NoteGeom.cy(st._by0);
        st.x = st.bx + (st.mx || 0); st.y = st.by + (st.my || 0);
      }));
      const sc = P.stage.data.characters || {};
      I.spots = {};
      setCams(P, sc.dad && sc.dad.camera, sc.bf && sc.bf.camera, -1);
      // (the stage file's zoom when the script wants another: the camera starts there + eases once camZooming is on)
      const sz = P.stage.data.impostor && P.stage.data.impostor.startZoom;
      if (sz) { P.camZoom = sz; P.zoomTween = null; }
    },
    update(P, dt) {
      const I = P.imp; tick(I.tw, dt); tick(I.twTw, dt);
      for (const who of ['bf', 'dad', 'gf']) for (const g of I.ghosts[who]) g.update(dt);
      if (P.covers) P.covers = P.covers.filter(cv => cv.line !== 0 || !cv.note || P.songPos < cv.note.holdEnd);
      psychHolds(P);
      updatePops(P);
      // the score text bop (PsychHUD.doScoreBop: 1.075 back to 1 in 0.2 s)
      if (I.scoreBop > 0) I.scoreBop = Math.max(0, I.scoreBop - dt);
      // the time bar shows once the song starts (0.5 s circOut)
      if (I.timeT < 0 && P.started && P.songPos >= 0) I.timeT = 0;
      if (I.timeT >= 0 && I.timeT < 0.5) { I.timeT += dt; const k = Math.min(1, I.timeT / 0.5); I.timeA = Math.sqrt(1 - (k - 1) * (k - 1)); }
      // the task box: countdown tick 0 (the 'three')
      if (!I.task && P.started && P.songPos >= -4 * P.cond.crochet) taskStart(P);
      if (I.task) I.task.t += dt;
      if (I.fade) I.fade.t += dt;
      if (I.camZooming && !P.zoomTween) { const z = I.baseZoom + (I.zoomAdd || 0); P.camZoom = z + (P.camZoom - z) * Math.exp(-6.25 * (I.zoomDecay || 1) * dt); }
      leanCam(P);
    },
    oppHit(P, n) {
      const I = P.imp;
      if (!I.camZooming) {
        I.camZooming = true; P.zoomRate = I.bopRate;
        // (the zoom only eases to where it should be once camZooming is on: Danger starts at the stage's 2)
        if (Math.abs(P.camZoom - (I.baseZoom + (I.zoomAdd || 0))) > 1e-4) easeZoom(P, I.baseZoom);
      }
      for (const c of n.who || [P.dad]) chordHit(P, n, c === P.gf ? 'gf' : c === P.bf ? 'bf' : 'dad');
      // (PlayField.spawnSusSplash: the opponent's holds get the cover too, gone when the hold ends)
      if (n.len > 0 && G.settings.noteSplashes !== false && P.startCover) P.startCover(n);
    },
    playerHit(P, n) { chordHit(P, n, 'bf'); if (!P.botplay) P.imp.scoreBop = 0.2; },
    beat(P, beat) {
      bopSize(P);
      // Camera Twist (utils.hx onBeatHit): every beat both cameras snap to +-intensity2 degrees (one way, then the
      // other), ease to +-intensity in 2 steps (circOut) and slide the other way that many pixels over the beat
      const T = P.imp.twist; if (!T) return;
      const sh = beat % 2 === 0 ? 1 : -1, st = P.cond.stepCrochet / 1000;
      for (const c of [P.hud, P.cam]) {
        c.angle = sh * T.i2;
        tween(P.imp.twTw, c, { angle: sh * T.i1 }, st * 2, circOut);
        tween(P.imp.twTw, c, { px: -sh * T.i1 }, st * 4, E.linear);
      }
    },
    step(P, step) {
      // (and the HUD hops up 6 x intensity2 px on every beat, back down on the half beat)
      const T = P.imp.twist; if (!T) return;
      const st = P.cond.stepCrochet / 1000;
      if (step % 4 === 0) tween(P.imp.twTw, P.hud, { py: -6 * T.i2 }, st * 2, circOut);
      if (step % 4 === 2) tween(P.imp.twTw, P.hud, { py: 0 }, st * 2, sineIn);
    },
    event(P, name, v) {
      const I = P.imp, v1 = String(v.value1 == null ? '' : v.value1), v2 = String(v.value2 == null ? '' : v.value2);
      switch (name) {
        case 'FocusCamera': { const ch = v != null && typeof v === 'object' ? v.char : v; I.camWho = ch == null ? 0 : ch; break; }
        case 'Reactor Beep': beep(P); break;
        case 'HUD Fade': {         // (camHUD alpha to value1 over value2 seconds; empty = 1 s)
          let a = parseFloat(v1); if (isNaN(a)) a = 1;
          let d = parseFloat(v2); if (isNaN(d)) d = 1;
          I.tw = I.tw.filter(w => w.obj !== P.hudParts);
          if (d > 0) tween(I.tw, P.hudParts, { all: a }, d); else P.hudParts.all = a;
          break;
        }
        case 'Set Cams': {          // (camSpecialThing: the zoom eases there)
          const c = v1.split(',').map(Number), z = parseFloat(v2);
          setCams(P, [c[0], c[1]], [c[2], c[3]], -1); if (z > 0) easeZoom(P, z); break;
        }
        case 'Imp Play Anim': {     // (Play Animation: the pose, then no dancing until it's done)
          const k = v2.trim().toLowerCase(), n = parseInt(k, 10);
          const c = k === 'bf' || k === 'boyfriend' || n === 1 ? P.bf : k === 'gf' || k === 'girlfriend' || n === 2 ? P.gf : P.dad;
          if (c && c.playAnim(v1, true)) { c.holdTimer = 0; c._special = true; }
          break;
        }
        case 'Imp Set Zoom': { const z = parseFloat(v1); if (!isNaN(z)) setZoom(P, z); break; }   // (Set Cam Zoom: defaultCamZoom)
        case 'Imp Add Zoom': {      // (Add Camera Zoom: + to the zoom, + to the HUD's, under 1.35)
          if (G.settings.camZoom === false || P.cam.zoom >= 1.35) break;
          let a = parseFloat(v1), b = parseFloat(v2); if (isNaN(a)) a = 0.015; if (isNaN(b)) b = 0.03;
          P.bopMul += a / Math.max(0.1, P.camZoom); P.hudZoom += b; break;
        }
        case 'Reset Cams': { const sc = P.stage.data.characters || {}; setCams(P, sc.dad && sc.dad.camera, sc.bf && sc.bf.camera, -1); break; }
        case 'Insta Cam Zoom': {
          const z = parseFloat(v1); if (isNaN(z)) break;
          if (parseInt(v2, 10) === 1) { I.baseZoom = z - (I.zoomAdd || 0); P.cam.zoom = z; } else { I.baseZoom += z; P.cam.zoom += z; }
          P.zoomTween = null; applyZoom(P); break;
        }
        case 'Extra Cam Zoom': { const z = parseFloat(v1); I.zoomAdd = isNaN(z) ? 0 : z; P.zoomTween = null; applyZoom(P); break; }
        case 'flash': { const t = parseInt(v1, 10); if (flashOn()) P.cam.flash('#FFFFFF', (t === 2 || t === 3) ? 0.55 : 0.35); else P.cam.flash('rgba(255,255,255,0.5)', 0.7); break; }
        case 'Optional Captions': {
          if (!v1.trim() || v1 === '0') I.caption = null;
          else I.caption = { text: v1, y: v2.trim() ? parseInt(v2, 10) : null };
          break;
        }
        case 'Alter Camera Bop': {     // (value1 = how big (camZoomingMult), value2 = every how many beats (0 = 4))
          const m = parseFloat(v1), r = parseInt(v2, 10);
          I.bopMult = isNaN(m) ? 1 : m; I.bopRate = isNaN(r) || r === 0 ? 4 : r;
          if (I.camZooming) P.zoomRate = I.bopRate;
          bopSize(P); break;
        }
        case 'Camera Twist': {
          let a = parseFloat(v1), b = parseFloat(v2); if (isNaN(a)) a = 0; if (isNaN(b)) b = 0;
          I.twist = b === 0 ? null : { i1: a, i2: b };
          // (off: the turn goes back in 1 s; whatever slide / hop is on its way still finishes)
          if (!I.twist) for (const c of [P.hud, P.cam]) tween(I.twTw, c, { angle: 0 }, 1, E.sineInOut);
          break;
        }
      }
    },
    drawHealth, drawTime, popups,
    drawOver(ctx, P) { drawCamCover(ctx, P); },
    drawTop(ctx, P) {
      const I = P.imp;
      G.setScreenT(ctx);
      const hudA = P.hud.alpha * P.hudParts.all;            // (camHUD: they fade with the HUD)
      if (hudA > 0.01 && I.pops.length) { ctx.save(); ctx.globalAlpha *= Math.min(1, hudA); for (const s of I.pops) s.draw(ctx, P.hud); ctx.restore(); }
      G.setScreenT(ctx);
      if (I.beepFx.a > 0.002) { ctx.save(); ctx.globalAlpha = I.beepFx.a; ctx.fillStyle = '#b30000'; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); ctx.restore(); }
      drawTask(ctx, P);
      if (I.caption) caption(ctx, I.caption.text, I.caption.y);
    },
    // (the death character's own sound when it has one: BF's defeat self in Double Kill)
    gameOver: { get sfx() { const P = G.screens.play, a = P && P.bf && P.bf.data.impostor && P.bf.data.impostor.gameover_intial_sound; return a && G.A.has(SND + a + '.ogg') ? SND + a + '.ogg' : SND + 'fnf_loss_sfx.ogg'; },
      music: MUS + 'gameOver.ogg', end: MUS + 'gameOverEnd.ogg', centerArt: true },
    pauseMusic: MUS + 'breakfast.ogg',
    countdownAssets: { sound: n => SND + n + '.ogg', image: n => IMG + 'hud/' + n + '.png' },
  };
  // a caption line (FunkinCaption: bottom middle, white on a dark band)
  function caption(ctx, text, y) {
    G.setScreenT(ctx);
    const lines = String(text).split('\n'), size = 26, lh = 32, cy = y != null ? y : G.H - 110;
    ctx.save(); ctx.font = size + 'px liberbold, ' + G.FONT.body;
    let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.fillRect((G.W - w) / 2 - 12, cy - lh * 0.8, w + 24, lh * lines.length + 8); ctx.globalAlpha = 1;
    lines.forEach((l, i) => G.text(ctx, l, G.W / 2, cy + i * lh, { size, font: 'liberbold', align: 'center', outline: 2 }));
    ctx.restore();
  }

  // combine the base with a stage's + a song's own parts (each hook runs them all, in order)
  function combine(...parts) {
    parts = parts.filter(Boolean);
    const o = {};
    for (const k of ['setup', 'reset', 'update', 'beat', 'step', 'event', 'oppHit', 'playerHit', 'miss', 'drawOver', 'drawTop', 'leave', 'gameOverUpdate']) {
      const fns = parts.map(p => p[k]).filter(Boolean);
      if (fns.length) o[k] = (...a) => { for (const f of fns) f(...a); };
    }
    for (const k of ['popups', 'drawHealth', 'drawTime', 'drawWorld', 'gameOver', 'pauseMusic', 'countdownAssets', 'maxZoom', 'prepare', 'oppSingers']) { const p = parts.slice().reverse().find(q => q[k]); if (p) o[k] = p[k]; }
    return o;
  }

  // ================================================================ stages
  const STAGES = {};
  const prop = (P, name) => P.stage.props.find(p => p.name === name);

  // ---- Polus (data/stages/polus.hx): snow, the lonely speaker for ghost GF, dead BF, the Meltdown crowd
  STAGES.polus = {
    setup(P) {
      const S = P.polus = { snow: [], emitT: 0, frames: null };
      const sheet = G.Sparrow.load(G.A.imagePath('shared:impostor/stages/polus/snow_particles'));
      S.sheet = sheet;
      S.spk = prop(P, 'speaker'); S.dead = prop(P, 'bfdead'); S.crowd = prop(P, 'crowd');
      // snow in front of everybody (zIndex 13 in the script)
      S.layer = { zIndex: 13 * 1000 + 600, update() {}, draw: (ctx, cam) => drawSnow(ctx, cam, S) };
      P.stage.addExtra(S.layer, null);
    },
    reset(P) {
      const S = P.polus;
      const ghostGF = P.gf && P.gf.id === 'imp-gf-ghost';
      if (S.spk) S.spk.alpha = ghostGF && P.song.id !== 'top-10' ? 1 : 0;
      if (ghostGF && !P.gf._raised) { P.gf.y -= 240; P.gf._raised = true; }
      if (S.dead) S.dead.alpha = P.bf && P.bf.id === 'imp-bf-ghost' ? 1 : 0;
      if (S.crowd) S.crowd.alpha = P.song.id === 'meltdown' ? 1 : 0;
      S.snow.length = 0; S.emitT = 0;
      // (warm the snow up so it's already falling when the song starts)
      for (let i = 0; i < 100; i++) stepSnow(S, 0.05);
      S.preBops = 0;
    },
    update(P, dt) {
      const S = P.polus;
      stepSnow(S, dt);
      // (onStartCountdown: 5 bops before the song)
      if (!P.started || P.songPos < 0) {
        const b = Math.floor((P.songPos + P.cond.crochet * 5) / P.cond.crochet);
        if (b > S.preBops && b <= 5) { S.preBops = b; if (S.spk) S.spk.play('bop', true); if (S.crowd && (5 - b) % 2 === 0) S.crowd.play('bop', true); }
      }
    },
    beat(P, b) { const S = P.polus; if (S.spk) S.spk.play('bop', true); if (S.crowd && b % 2 === 0) S.crowd.play('bop', true); },
  };
  // SnowEmitter(-600, -600, 2700): a flake every 0.05 s along 2700 px, falls for 5 s, scroll 1-1.5
  function stepSnow(S, dt) {
    S.emitT += dt;
    while (S.emitT >= 0.05) {
      S.emitT -= 0.05;
      const fr = S.sheet && S.sheet.frames.length ? S.sheet.frames[Math.floor(Math.random() * S.sheet.frames.length)] : null;
      const sf = rnd(1, 1.5);
      S.snow.push({ x: -600 + Math.random() * 2700, y: -600, vx: rnd(-40, 40), vy: rnd(220, 380), a: Math.random() * 360, va: rnd(-120, 120), s: rnd(0.7, 1.2), sf, fr, age: 0 });
    }
    for (const f of S.snow) { f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt; }
    if (S.snow.length && S.snow[0].age > 5) S.snow = S.snow.filter(f => f.age <= 5);
  }
  function drawSnow(ctx, cam, S) {
    if (!S.sheet) return;
    for (const f of S.snow) {
      if (!f.fr) continue;
      cam.apply(ctx, f.sf, f.sf);
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a * Math.PI / 180); ctx.scale(f.s, f.s);
      ctx.translate(-f.fr.fw / 2, -f.fr.fh / 2);
      G.Sparrow.draw(ctx, S.sheet, f.fr); ctx.restore();
    }
  }

  // ================================================================ songs
  const SONGS = {};
  // ---- Sabotage (songs/sabotage/sabotage.hx): GF isn't there until Red notices ('sabotage notice'), then he goes
  //      'ayo' + she's scared until 'sabotage back'
  SONGS.sabotage = {
    reset(P) { if (P.gf) P.gf.alpha = 0.001; if (P.dad) P.dad._locked = false; if (P.gf) P.gf._locked = false; P.sab = { at: 0 }; },
    event(P, name, v) {
      if (name !== 'Legacy') return;
      const k = String(v.value1 || '');
      if (k === 'GF Appear' && P.gf) P.gf.alpha = 1;
      if (k === 'sabotage notice') {
        P.sab.at = P.songPos + 100;
        if (P.dad) { P.dad.playAnim('ayo', true); P.dad._locked = true; }
        if (P.gf) { P.gf.playAnim('scared', true); P.gf._locked = true; }
      }
      if (k === 'sabotage back') { if (P.dad) P.dad._locked = false; if (P.gf) P.gf._locked = false; }
    },
    update(P) { if (P.sab.at && P.songPos >= P.sab.at) { P.sab.at = 0; if (P.gf) P.gf.alpha = 1; } },
  };
  // ---- Meltdown (songs/meltdown/meltdown.hx): near the end the ending video plays over the game (not on Low Quality)
  SONGS.meltdown = {
    reset(P) { P.melt = null; },
    event(P, name) {
      if (name !== 'Meltdown Video' || !P.bf || P.bf.id !== 'imp-bf-ghost' || G.settings.quality === 'low') return;
      P.melt = playVideo(VID + 'week1/meltdownEnd.webm', { muted: false });
    },
    update(P) { const v = P.melt; if (v && v.done) P.melt = null; },
    drawTop(ctx, P) { const v = P.melt; if (v) drawVideo(ctx, v, null); },
    leave(P) { if (P.melt) P.melt.stop(); P.melt = null; },
  };

  // ================================================================ WEEK 2: MIRA HQ
  const MIRA = 'shared:impostor/stages/mira/';
  // ---- the cafeteria (data/stages/toogus.hx): the black cover for the lights going out (loBlack: zIndex 12, over the
  //      room + the table, under everybody), the Toogus Sax camera (it drifts right while the sax guy walks past)
  STAGES.toogus = {
    setup(P) {
      const S = P.toogus = { black: 0, sax: null };
      // (FlxBGSprite: covers the whole view wherever the camera is)
      P.stage.addExtra({ zIndex: 12 * 1000 + 5, update() {}, draw: (ctx) => {
        if (S.black <= 0.002) return;
        G.setScreenT(ctx); ctx.save(); ctx.globalAlpha *= S.black; ctx.fillStyle = '#000'; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); ctx.restore();
      } }, null);
    },
    reset(P) { const S = P.toogus; S.black = 0; S.sax = null; for (const n of ['bfvent', 'ldspeaker']) { const pr = prop(P, n); if (pr) pr.alpha = 0; } },
    update(P, dt) {
      const S = P.toogus, X = S.sax;
      if (X) {
        X.t += dt; const k = Math.min(1, X.t / 11);
        P.camForced = { x: X.x0 + (600 - X.x0) * k, y: X.y0 - 5 * k }; P.cam.follow(P.camForced.x, P.camForced.y);
        P.imp.baseZoom = X.z0 + (0.82 - X.z0) * E.sineInOut(k); applyZoom(P);
      }
    },
    event(P, name, v) {
      const S = P.toogus;
      if (name === 'Toogus Sax') {
        // (camFollow.x = 400 at once, then tweens to 600 + 5 px up and the zoom to .82 over 11 s)
        S.sax = { t: 0, x0: 400, y0: P.cam.ty, z0: P.imp.baseZoom }; P.camTween = null;
      } else if (name === 'Legacy' && String(v.value1) === 'Toogus Sax Out') {
        S.sax = null; P.camForced = null; easeZoom(P, 0.9);
      }
    },
  };

  // ---- the crewmates walking around (funkin.objects.stageobjects.AmongWalker; the mod's own class, V4's
  //      WalkingCrewmate remade): each picks a colour none of the others is wearing, comes in from an edge, wanders
  //      (walks, stops, turns round), walks off at the edges and comes back later as somebody else. They walk
  //      walkSpeed x 9 px a second; the song's script sends them in, away, back.
  const WALKER_COLORS = [['yellow', 1], ['blue', 1], ['brown', 1], ['lime', 1], ['white', 1], ['tan', 1], ['foe', 0.06]];
  class Walker {
    constructor(range, y, scale, friends) {
      this.range = range; this.friends = friends;
      const s = this.spr = new G.Sprite(0, y).loadAtlas(G.A.imagePath(MIRA + 'cafeteria/walkers'));
      s.scale.x = s.scale.y = scale;
      for (const [c] of WALKER_COLORS) { s.addAnim(c + ' walk', c + ' walk', 24, true); s.addAnim(c + ' idle', c + ' idle', 24, false); }
      s.updateHitbox(); s.y = y - s.height;                      // (reloadAtlas: y is where his feet are)
      this.zIndex = 0; this.walkSpeed = 30; this.idle = false; this.right = true; this.hibernating = true; this.alive = true;
      this.actionTimer = rnd(0.5, 1); this.onAction = []; this.onEnter = []; this.onAway = []; this.color = null;
      s.visible = false;
    }
    get x() { return this.spr.x; } set x(v) { this.spr.x = v; }
    findFreeColor() {
      const used = new Set(this.friends.filter(w => w !== this && w.alive && !w.hibernating && w.color).map(w => w.color));   // (nobody twice on screen)
      const free = WALKER_COLORS.filter(c => !used.has(c[0]));
      const pool = free.length ? free : WALKER_COLORS;
      let r = Math.random() * pool.reduce((a, c) => a + c[1], 0);
      for (const c of pool) { r -= c[1]; if (r <= 0) return c[0]; }
      return pool[0][0];
    }
    swapSkin() { this.color = this.findFreeColor(); this.spr.play(this.color + (this.idle ? ' idle' : ' walk'), true); }
    fire(list) { const fs = list.splice(0); for (const f of fs) f(); }
    triggerNextAction() {
      this.actionTimer = rnd(0.5, 1);                             // (setNewActionTime; a listener can change it)
      this.walkSpeed = rnd(18, 40);                                // (the song's own onAction listener)
      if (this.hibernating) {
        // (coming in: whatever waits for him to come in decides where he walks; the next action is a normal one)
        this.hibernating = false; this.spr.visible = true; this.idle = false;
        this.right = this.x < (this.range[0] + this.range[1]) / 2;   // (from the edge, inwards)
        if (!this.color) this.swapSkin();
        this.fire(this.onEnter);
        return;
      }
      if (Math.random() < 0.2) this.right = Math.random() < 0.5;
      if (!this.idle && Math.random() < 0.6) this.idle = true; else if (this.idle && Math.random() < 0.5) this.idle = false;
      this.fire(this.onAction);
    }
    update(dt) {
      if (!this.alive) return;
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) this.triggerNextAction();
      const s = this.spr; s.update(dt);
      if (this.hibernating || !this.color) return;
      const walk = this.color + ' walk', idle = this.color + ' idle';
      if (!this.idle) {
        if (s.animName !== walk) s.play(walk, true);
        this.x += (this.right ? 1 : -1) * this.walkSpeed * 9 * dt;
        s.flipX = !this.right;
        if (this.x > this.range[1] || this.x < this.range[0]) {      // (walked off: gone until the next action)
          this.hibernating = true; s.visible = false; this.idle = false;
          this.x = this.x > this.range[1] ? this.range[1] - 50 : this.range[0] + 50;
          this.color = null; this.actionTimer = rnd(5, 10);
          this.fire(this.onAway);
          if (this.alive) this.swapSkin();          // (V4: somebody new comes back)
        }
      } else if (s.animName !== idle && (s.animName !== walk || s.fi % 10 === 9)) { s.play(idle, true); s.flipX = !this.right; }   // (feet together)
    }
    beat() { if (this.alive && !this.hibernating && this.idle && this.spr.animName.endsWith(' idle')) this.spr.play(this.color + ' idle', true); }
    draw(ctx, cam) { if (this.alive) this.spr.draw(ctx, cam); }
    kill() { this.alive = false; this.spr.visible = false; }
    revive() { this.alive = true; this.spr.visible = !this.hibernating; }
  }

  // ---- Sussus Toogus (songs/sussus-toogus/script.hx): six walkers, sent in at the start + 'Crewmates Come In', away
  //      at 'Crewmates Walk Away' (the sax), back at 'Crewmates Return'; the sax guy dances past, left to right
  SONGS['sussus-toogus'] = {
    setup(P) {
      const W = P.walk = { list: [], timers: [] };
      for (let i = 0; i < 6; i++) {
        const w = new Walker([-700, 1700], 500 + i * 20, 0.7 + i * 0.02, W.list);
        w.zIndex = (i + 2) * 1000 + 6 + i;          // (zIndex i + 2, added after the stage's own sprites)
        W.list.push(w); P.stage.addExtra(w, null);
      }
      // the sax guy: 'Cyan Dancy', scroll 1.2, scale 1.1 (his sheet is packed at 75 %: drawn that much bigger)
      const k = ((songData('sussus-toogus') || {}).small || {})['stages/mira/cafeteria/cyan_toogus'] || 1;
      const sx = W.sax = new G.Sprite(0, 0).loadSparrow(G.A.imagePath(MIRA + 'cafeteria/cyan_toogus'));
      sx.addAnim('bop', 'Cyan Dancy', 24, true); sx.play('bop');
      sx.scale.x = sx.scale.y = 1.1 / k; sx.scroll = { x: 1.2, y: 1.2 }; sx.zIndex = 1e6;   // (song script add(): after the whole stage, over everybody)
      sx.alpha = 0.001; sx.k = k;
      P.stage.addExtra(sx, null);
    },
    reset(P) {
      const W = P.walk;
      for (const w of W.list) {
        w.alive = true; w.hibernating = true; w.idle = false; w.spr.visible = false; w.color = null; w.onAction.length = w.onEnter.length = w.onAway.length = 0;
        w.x = Math.random() < 0.5 ? w.range[0] + 50 : w.range[1] - 50; w.actionTimer = 999;
      }
      W.timers.length = 0; W.sax.alpha = 0.001;
      comeIn(P);
    },
    update(P, dt) {
      const W = P.walk;
      for (let i = 0; i < W.timers.length; i++) { const t = W.timers[i]; t.t -= dt; if (t.t <= 0) { W.timers.splice(i--, 1); t.f(); } }
      for (const w of W.list) w.update(dt);
      if (W.sax.alpha >= 1) { W.sax.update(dt); W.sax.x += dt * 15.5 * 9; }
    },
    beat(P, b) { for (const w of P.walk.list) w.beat(b); },
    event(P, name, v) {
      const W = P.walk;
      if (name === 'Toogus Sax') {
        // (setPosition(-550, 275) on a sprite whose picture is smaller than his real one: the same top left corner
        //  as the full size sheet, scaled around its middle like scale.set)
        const s = W.sax, fw = s.frameW / s.k, fh = s.frameH / s.k;
        s.alpha = 1; s.play('bop', true);
        s.x = -550 + fw / 2 - s.frameW / 2; s.y = 275 + fh / 2 - s.frameH / 2;
      }
      if (name !== 'Legacy') return;
      const k = String(v.value1);
      if (k === 'Crewmates Come In') comeIn(P);
      else if (k === 'Crewmates Walk Away') walkAway(P);
      else if (k === 'Crewmates Return') for (const w of W.list) { w.actionTimer = rnd(0.5, 1); w.revive(); }
    },
  };
  const later = (P, t, f) => P.walk.timers.push({ t, f });
  function comeIn(P) {
    for (const w of P.walk.list) later(P, rnd(0.5, 2), () => {
      w.actionTimer = rnd(0.5, 1);
      const funny = () => {
        const to = -700 + rnd(0.2, 0.8) * 2400;
        w.idle = false; w.right = w.x < to; w.actionTimer = Math.abs((w.x - to) / w.walkSpeed / 9);
        w.onAction.push(() => { w.idle = true; w.right = w.x < to; w.actionTimer = rnd(5, 10); });
      };
      if (w.hibernating) w.onEnter.push(funny); else funny();
    });
  }
  function walkAway(P) {
    for (const w of P.walk.list) later(P, rnd(0.5, 2), () => {
      w.actionTimer = 999;
      if (!w.hibernating) { w.idle = false; w.right = w.x >= -700 + rnd(0.4, 0.6) * 2400; w.onAway.push(() => w.kill()); }
      else w.kill();
    });
  }

  // ---- Lights Down (songs/lights-down/script.hx): a dim purple vignette on the room + everybody (ColorMatrixShader
  //      setAdjustColor(-80, -20, -50, 20), springing in), the lights going out (BF + Green swap to their dark
  //      drawings, the room goes black, GF leaves, the HUD goes dark), the ending (Green's live reaction, BF dives into
  //      the vent, the speaker gets taken)
  const DIM = 'adj:-80,-20,-50,20';
  const elasticOut = t => t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 2 * Math.PI / 0.4) + 1;   // (FlxEase.elasticOut)
  SONGS['lights-down'] = {
    setup(P) {
      const L = P.ld = { vig: false, dimK: 0, tw: null };
      // the dark ones, made now (no hitch when the lights go out); the originals stay cached for the way back
      const cache = (slot, id) => { const k = slot + ':' + id; if (!P.swapCache[k]) { const c = new G.Character(id, slot); P.swapCache[k] = c; P.swapChars.push(c); } };
      cache('dad', 'imp-green-dark');
      const dk = P.bf && P.bf.data.impostor && P.bf.data.impostor.flags && P.bf.data.impostor.flags.variants && P.bf.data.impostor.flags.variants.dark;
      L.bfDark = dk ? 'imp-' + dk : null; if (L.bfDark) cache('bf', L.bfDark);
      L.orig = { bf: P.bf, dad: P.dad };
      P.swapCache['bf:' + P.bf.id] = P.bf; P.swapCache['dad:' + P.dad.id] = P.dad;
    },
    // (the dim copies of the room + the characters' pictures, baked before the song)
    prepare(P, tex) {
      const list = ['bg', 'fg', 'table'].map(n => prop(P, n)).concat([P.ld.orig.bf, P.ld.orig.dad, P.gf]).filter(Boolean);
      G.imgFilter = DIM;
      try { for (const sp of list) for (const im of G.texturesOf(sp)) { const c = G.srcImg(im); if (c && c !== im) tex.add(c); } } finally { G.imgFilter = null; }
    },
    reset(P) {
      const L = P.ld; L.vig = false; L.dimK = 0; L.tw = null;
      if (P.gf) { P.gf.alpha = 1; P.gf.visible = true; }
      if (P.bf) P.bf.visible = true;
    },
    update(P, dt) {
      const L = P.ld, T = L.tw;
      if (T) {
        T.t += dt; const k = Math.min(1, T.t / 0.5);
        const n = T.from + (1 - T.from) * (flashOn() ? elasticOut(k) : E.sineOut(k));
        L.dimK = T.on ? n : 1 - n;
        if (k >= 1) L.tw = null;
      }
    },
    event(P, name, v) {
      const L = P.ld, I = P.imp, v1 = String(v.value1 == null ? '' : v.value1);
      const vignette = on => { L.vig = on; L.tw = { t: 0, on, from: flashOn() ? 0.5 : 0 }; };
      if (name === 'Legacy') {
        if (v1 === 'Vignette On') vignette(true);
        else if (v1 === 'Vignette Off') vignette(false);
        else if (v1 === 'ending') {
          vignette(false);
          lights(P, false);
          P.bf.visible = false; if (P.gf) P.gf.visible = false;
          BASE.event(P, 'HUD Fade', { value1: '0', value2: '' });
          if (P.dad) { P.dad.playAnim('liveReaction', true); P.dad.holdTimer = 0; }
          const vent = prop(P, 'bfvent'), spk = prop(P, 'ldspeaker');
          if (vent) { vent.alpha = 1; vent.play('vent', true); }
          if (spk && P.gf && P.gf.data.impostor && P.gf.data.impostor.flags && P.gf.data.impostor.flags.lightsDownSpeaker) { spk.alpha = 1; spk.play('boom', true); }
        } else if (v1 === 'bye') I.camA = 0;
      } else if (name === 'Lights out') {
        if (v1 === '2' || (v1 === '1' && !flashOn())) return;
        lights(P, true);
      } else if (name === 'Lights on') {
        if (v1 === '1' && !flashOn()) return;
        lights(P, false);
      }
    },
    // the world with the dim on: each dimmed sprite drawn again from its dim copy over itself (k = how far the dim is)
    drawWorld(ctx, P, normal) {
      const k = G.clamp(P.ld.dimK, 0, 1);
      if (k <= 0.001) { normal(P.cam); return; }
      const dim = new Set(['bg', 'fg', 'table'].map(n => prop(P, n)));
      if (!P.imp.dark) { dim.add(P.bf); dim.add(P.dad); if (P.gf) dim.add(P.gf); }
      for (const sp of P.stage.ordered()) {
        if (!dim.has(sp)) { sp.draw(ctx, P.cam); continue; }
        if (k < 1) sp.draw(ctx, P.cam);
        ctx.save(); ctx.globalAlpha *= k; G.imgFilter = DIM;
        try { sp.draw(ctx, P.cam); } finally { G.imgFilter = null; ctx.restore(); }
      }
    },
  };
  // the lights (lights-down.hx 'Lights out' / 'Lights on')
  function lights(P, out) {
    const I = P.imp, L = P.ld;
    if (out) {
      I.dark = true;
      P.cam.flash(flashOn() ? '#FFFFFF' : '#000000', 0.35);
      if (P.gf) P.gf.alpha = 0;
      P.toogus.black = 1;
      G.ModChars.swap(P, 'dad', 'imp-green-dark');
      if (L.bfDark) G.ModChars.swap(P, 'bf', L.bfDark);
    } else {
      I.dark = false;
      if (P.gf) P.gf.alpha = 1;
      P.cam.flash('#000000', 0.35);
      P.toogus.black = 0;
      if (P.bf !== L.orig.bf) G.ModChars.swap(P, 'bf', L.orig.bf.id);
      if (P.dad !== L.orig.dad) G.ModChars.swap(P, 'dad', L.orig.dad.id);
      if (L.vig) L.tw = { t: 0, on: true, from: flashOn() ? 0.5 : 0 };       // (setVignette(vignette) again)
    }
    // (the chord ghosts follow whoever stands there now)
    for (const who of ['bf', 'dad']) for (const g of I.ghosts[who]) { g.owner = P[who]; g.spr.alpha = 0; g.tw.length = 0; }
  }

  // ---- the reactor room (data/stages/reactor.hx): the crewmates on the pillars bop every 2 beats (+ on the
  //      countdown's 'three' + 'one'), the core's glow every 4 (no flashing lights: every 2, only its last frames)
  STAGES.reactor = {
    setup(P) { P.reactor = { pre: 0 }; },
    reset(P) { P.reactor.pre = 0; const g = prop(P, 'coreGlow'); if (g) g.play(flashOn() ? 'bop' : 'bopSafe', true); },
    update(P) {
      const R = P.reactor;
      if (!P.started || P.songPos >= 0) return;
      const tick = Math.floor((P.songPos + P.cond.crochet * 4) / P.cond.crochet);       // (countdown tick 0..3)
      if (tick >= 0 && tick <= 3 && tick + 1 > R.pre) { R.pre = tick + 1; if (tick % 2 === 0) for (const n of ['pillarsY', 'pillarsB']) { const pr = prop(P, n); if (pr) pr.play('bop', true); } }
    },
    beat(P, b) {
      if (b % 2 !== 0) return;
      for (const n of ['pillarsY', 'pillarsB']) { const pr = prop(P, n); if (pr) pr.play('bop', true); }
      const g = prop(P, 'coreGlow');
      if (g && (!flashOn() || b % 4 === 0)) g.play(flashOn() ? 'bop' : 'bopSafe', true);
    },
  };
  // ---- Reactor (songs/reactor/reactor.hx): its camera spots; story mode, the first time: from black, the camera
  //      settling down onto the room; at beat 712 (story, on to Ejected) it fades out drifting off to the right
  SONGS.reactor = {
    reset(P) {
      const I = P.imp;
      // (the mod: story mode, first time; FNF 2 plays it the first try in freeplay too, like every cutscene)
      P.rx = { intro: !P.params.deaths && !P.params.noCutscene, go: false, pan: null };
      setCams(P, [1725, 1100], [1725, 1100], 0.7);
      P.cam.focus(1725, 1100);
      if (P.rx.intro) I.camA = 0;
    },
    update(P, dt) {
      const X = P.rx, I = P.imp;
      if (X.intro && P.started && P.songPos >= 0 && !X.go) {
        X.go = true; I.camA = 1;
        // (onSongStart: zoom + .2, scroll y - 400, fade in from black over 2 s, the zoom back over 5 s expoOut)
        P.cam.y -= 400; P.camZoom += 0.2;
        P.zoomTween = { t: 0, dur: 5, z0: P.camZoom, z1: P.camZoom - 0.2, ease: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t) };
        camFade(P, '#000000', 2, true);
      }
      if (X.pan) {
        X.pan.t += dt; const k = E.sineInOut(Math.min(1, X.pan.t / X.pan.dur));
        P.camForced = { x: X.pan.x0 + 400 * k, y: X.pan.y0 + 100 * k }; P.cam.focus(P.camForced.x, P.camForced.y);
        P.camZoom = X.pan.z0 + 0.2 * k;
      }
    },
    beat(P, b) {
      if (b !== 712 || !isStory(P) || P.rx.pan) return;
      const c = P.cond.crochet;
      camFade(P, '#000000', c * 0.024, false);
      P.rx.pan = { t: 0, dur: c * 0.032, x0: P.cam.x, y0: P.cam.y, z0: P.camZoom };
      P.zoomTween = null;
    },
    event(P, name, v) {
      if (name !== 'Legacy') return;
      const S = { base: [[1450, 1150], [1950, 1150], 0.8], mid: [[1725, 1100], [1725, 1100], 0.7], mid2: [[1725, 1100], [1725, 1100], 0.8], mid3: [[1725, 1200], [1725, 1200], 0.9] }[String(v.value1)];
      if (!S) return;
      setCams(P, S[0], S[1], -1); easeZoom(P, S[2]);
    },
  };

  // ---- Ejected (data/stages/ejected.hx): falling past MIRA HQ. Buildings + clouds rush up past you, speed lines
  //      stream by, everybody drifts around a little every 0.4 s, the camera shakes, the HUD bobs; a grey adjust on the
  //      characters; the camera follows whoever sings (no fixed spots), zoomed in on BF (.6), out on Green (.45)
  const GREY = 'adj:-7,-6,0,-30';
  const smoothStep = t => t * t * (3 - 2 * t);           // (FlxEase.smoothStepInOut)
  STAGES.ejected = {
    setup(P) {
      for (const k of ['bf', 'gf', 'dad']) P.charFilter[k] = GREY;
      const J = P.ej = { right: [], mid: [], left: [], near: [], far: [], jit: null };
      const img = n => G.A.imagePath(MIRA + 'ejected/' + n);
      let order = 2;     // (after the sky + the cloud bank: the script's onLoad order)
      const building = (name, x, y) => {
        const b = new G.Sprite(x, y).loadImage(img(name) + '.png');
        b.scale.x = b.scale.y = 2; b.updateHitbox(); b.scroll = { x: 0.5, y: 0.5 }; b.zIndex = order++; b.y0 = y;
        P.stage.addExtra(b, null); return b;
      };
      for (let i = 0; i < 2; i++) J.right.push(building('buildingB', 1022.3, -390.45));
      for (let i = 0; i < 2; i++) J.mid.push(building('buildingA', -76.15, 1398.5));
      for (let i = 0; i < 2; i++) J.left.push(building('buildingB', -1099.3, 7286.55));
      // the clouds rushing past (onCreatePost: in front of everybody; not on Low Quality / without flashing lights)
      J.clouds = G.settings.quality !== 'low' && flashOn();
      let front = 600;
      if (J.clouds) {
        const NEAR = [[-9.65, -224.35, 0.8], [-1342.85, -350.45, 0.6], [1784.65, -957.05, 1.3]];
        const FAR = [[-1308, -1039.9], [464.3, -890.5], [2458.45, -1085.85], [-666.95, -172.05], [-1616.6, 1016.95], [1714.25, 200.45], [-167.05, 710.25]];
        const cloud = (i, far) => {
          const c = new G.Sprite(0, 0).loadSparrow(img('scrollingClouds'));
          c.addAnim('idle', 'Cloud' + i, 24, false); c.play('idle'); c.zIndex = front++;
          if (far) c.alpha = 0.5;
          P.stage.addExtra(c, null); return c;
        };
        NEAR.forEach((q, i) => J.near.push(Object.assign(cloud(i, false), { start: q })));
        FAR.forEach((q, i) => J.far.push(Object.assign(cloud(i, true), { start: q })));
      }
      // the speed lines (FlxBackdrop: the picture repeated across the whole view), scale 3, scroll .3, alpha .5
      J.lines = G.A.image(img('speedLines') + '.png');
      P.stage.addExtra({ zIndex: front++, update() {}, draw: (ctx, cam) => drawSpeedLines(ctx, cam, P) }, null);
      // where everybody floats around (their spots; GF: scroll .7)
      J.base = {}; for (const slot of ['bf', 'gf', 'dad']) if (P[slot]) J.base[slot] = { x: P[slot].x, y: P[slot].y };
      // the camera spots: getCharacterCameraPos (the middle of the character, 100 px in, 100 px up, + its own offsets)
      J.cam = {};
      for (const slot of ['dad', 'bf']) {
        const c = P[slot]; if (!c) continue;
        c.dance(true); const vb = G.visBox(c) || { cx: c.x + c.width / 2, top: c.y, bottom: c.y + c.height };
        const co = c.cameraOffsets || [0, 0], my = (vb.top + vb.bottom) / 2;
        J.cam[slot] = slot === 'dad' ? { x: vb.cx + 100 + co[0], y: my - 100 + co[1] } : { x: vb.cx - 100 - co[0], y: my - 100 + co[1] };
      }
    },
    reset(P) {
      const J = P.ej;
      J.speed = flashOn() ? 9 : 3.3; zoomDecay(P, 0.5);
      J.right.forEach(b => { b.y = b.y0; }); J.mid.forEach(b => { b.y = b.y0; }); J.left.forEach(b => { b.y = b.y0; });
      J.right[0].y = 6803.1; J.mid[0].y = 8570.5; J.left[0].y = 14050.2;
      J.nearPass = [11000, 11000, 11000, 11000]; J.farPass = [11000, 11000, 11000, 11000, 11000, 11000, 11000];
      for (const c of J.near.concat(J.far)) { c.x = c.start[0]; c.y = c.start[1]; c.scale.x = c.scale.y = 1; const sf = c.start[2] || 1; c.scroll = { x: sf, y: sf }; }
      for (const slot in J.base) if (P[slot]) { P[slot].x = J.base[slot].x; P[slot].y = J.base[slot].y; }
      J.jit = null;
      for (const slot of ['dad', 'bf']) if (P[slot] && J.cam[slot]) P[slot].camFocus = Object.assign({}, J.cam[slot]);
      P.imp.baseZoom = 0.45; applyZoom(P);
    },
    update(P, dt) {
      const J = P.ej, k = Math.min(1, dt * J.speed);
      // buildings: the left ones ride 5888 below the middle ones, the right ones copy the left ones
      for (let i = 0; i < 2; i++) J.left[i].y = J.mid[i].y + 5888;
      for (let i = 0; i < 2; i++) { const b = J.mid[i]; if (b.y < -11759.9) b.y = 3190.5; b.y -= 1300 * k; }
      for (let i = 0; i < 2; i++) J.right[i].y = J.left[i].y;
      if (J.clouds) {
        J.near.forEach((c, i) => {
          c.y -= J.nearPass[i] * k;
          if (c.y < -1789.65) { const s = rnd(1.5, 2.2), sf = rnd(1, 1.3); J.nearPass[i] = rnd(1100, 1300); c.scale.x = c.scale.y = s; c.scroll = { x: sf, y: sf }; c.x = rnd(-3578.95, 3259.6); c.y = 2196.15; }
        });
        J.far.forEach((c, i) => {
          c.y -= J.farPass[i] * k;
          if (c.y < -1614) { const s = rnd(0.2, 0.5), sf = rnd(0.2, 0.4); J.farPass[i] = rnd(1100, 1300); c.scale.x = c.scale.y = s; c.scroll = { x: sf, y: sf }; c.x = rnd(-2737.85, 3485.4); c.y = 1738.6; }
        });
      }
      const fc = prop(P, 'fgCloud'); if (fc && P.audio && P.audio.length) fc.y = -702 + (-902 + 702) * G.clamp(P.songPos / P.audio.length, 0, 1);
      // everybody drifts to a new spot every 0.4 s (BF + Green +-15, GF +-10)
      if (!J.jit || J.jit.t >= 0.4) {
        const to = {};
        for (const slot in J.base) { const r = slot === 'gf' ? 10 : 15, c = P[slot]; if (c) to[slot] = { x0: c.x, y0: c.y, x1: rnd(J.base[slot].x - r, J.base[slot].x + r), y1: rnd(J.base[slot].y - r, J.base[slot].y + r) }; }
        J.jit = { t: 0, to };
      }
      J.jit.t += dt; const e = smoothStep(Math.min(1, J.jit.t / 0.4));
      for (const slot in J.jit.to) { const c = P[slot], q = J.jit.to[slot]; if (c) { c.x = q.x0 + (q.x1 - q.x0) * e; c.y = q.y0 + (q.y1 - q.y0) * e; } }
      if (flashOn() && !P.gameOver) P.cam.shake(0.002, 0.1);
      // the HUD bobs (camHUD scroll.y + its angle)
      const t = P.songPos / 1000, bps = P.cond.bpm / 60;
      P.hud.sy = -Math.sin(t * bps * -1) * 15; P.hud.angle = Math.sin((P.songPos / 1200) * bps * -1) * 1.2;
    },
    event(P, name, v) {
      // (onMoveCamera: zoomed in on BF, out on Green, unless a Legacy event froze it)
      if (name === 'FocusCamera' && P.ej.zoomOnWho !== false) { const ch = v && typeof v === 'object' ? v.char : v; easeZoom(P, ch === 0 ? 0.6 : 0.45); }
    },
  };
  function drawSpeedLines(ctx, cam, P) {
    const img = P.ej.lines; if (!img || !img.width) return;
    const sf = 0.3, z = cam.zoom, w = img.width * 3, h = img.height * 3;
    const ox = G.W / 2 - z * ((cam.x - G.W / 2) * sf + G.W / 2), oy = G.H / 2 - z * ((cam.y - G.H / 2) * sf + G.H / 2);
    const x0 = (-G.CUT - ox) / z, x1 = (G.W + G.CUT - ox) / z, y0 = -oy / z, y1 = (G.H - oy) / z;
    const py = -(P.songPos * 2 * (flashOn() ? 1.75 : 0.75));
    cam.apply(ctx, sf, sf); ctx.save(); ctx.globalAlpha *= 0.5;
    for (let y = Math.floor((y0 - py) / h) * h + py; y < y1; y += h) for (let x = Math.floor(x0 / w) * w; x < x1; x += w) ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }
  // ---- Ejected (songs/ejected/ejected.hx): black + no HUD through the countdown, then the falling video plays over the
  //      song's start (silent: the song plays), the game + HUD come back with a white flash when it ends; 'just in
  //      case' (a beat after) puts everything back in case it didn't, flashes again + slides the task box in
  SONGS.ejected = {
    reset(P) {
      const I = P.imp, X = P.ejv || (P.ejv = { el: null });
      I.camA = 0; P.hudParts.all = 0; I.taskHidden = true; X.done = false;
      if (X.el) { X.el.pause(); if (X.el.readyState >= 1) X.el.currentTime = 0; }
    },
    el(P) {
      const X = P.ejv; if (X.el || X.failed) return X.el;
      const src = G.A.raw[VID + 'week2/ejected.webm']; if (!src) return null;
      const e = X.el = document.createElement('video'); e.src = src; e.muted = true; e.playsInline = true; e.preload = 'auto';
      e.onerror = () => { X.failed = true; }; e.onended = () => { if (!X.done) end(P); };
      return e;
    },
    update(P) {
      const X = P.ejv; if (X.done) return;
      const e = SONGS.ejected.el(P);
      if (!e || e.readyState < 1) return;
      const t = Math.max(0, P.songPos / 1000), run = P.started && !P.paused && !P.gameOver && P.songPos > 0;
      if (run) {
        if (e.paused) { const pr = e.play(); if (pr && pr.catch) pr.catch(() => {}); }
        const off = e.currentTime - t;
        if (Math.abs(off) > 0.15) e.currentTime = t; else e.playbackRate = Math.abs(off) > 0.03 ? (off < 0 ? 1.06 : 0.94) : 1;
        if (e.duration && t >= e.duration - 0.02) end(P);
      } else if (!e.paused) e.pause();
    },
    event(P, name, v) {
      if (name !== 'Legacy' || String(v.value1) !== 'just in case') return;
      const I = P.imp; I.taskHidden = false; taskStart(P);
      end(P);               // (the script's 'intro != null' is always true here: a second flash)
    },
    drawTop(ctx, P) {
      const X = P.ejv; if (X.done) return;
      const e = X.el;
      G.setScreenT(ctx);
      if (e && e.readyState >= 2 && e.videoWidth) { const h = G.W * e.videoHeight / e.videoWidth; ctx.drawImage(e, 0, (G.H - h) / 2, G.W, h); }
    },
    leave(P) { const X = P.ejv; if (X && X.el) { X.el.pause(); X.el.removeAttribute('src'); X.el.load(); X.el = null; } },
  };
  function end(P) {
    const I = P.imp, X = P.ejv;
    X.done = true; I.camA = 1; P.hudParts.all = 1;
    P.cam.flash('#FFFFFF', 0.35);
    if (X.el && !X.el.paused) X.el.pause();
  }

  // ================================================================ WEEK 3: THE AIRSHIP
  const AIR = 'shared:impostor/stages/airship/';
  const quartIn = t => t * t * t * t, quartOut = t => 1 - Math.pow(1 - t, 4), quadIn = t => t * t;
  const circInOut = t => t < 0.5 ? (1 - Math.sqrt(1 - 4 * t * t)) / 2 : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
  // a character that goes in for another mid-song, made before the song (no hitch when it swaps in)
  function cacheChar(P, slot, id) {
    const k = slot + ':' + id; if (!P.swapCache || P.swapCache[k] || !G.A.json('preload/data/characters/' + id + '.json')) return;
    const c = new G.Character(id, slot); P.swapCache[k] = c; P.swapChars.push(c);
  }
  const iconImg = name => G.A.image('preload/images/icons/icon-imp-' + name + '.png');
  // an endless strip (FlxBackdrop, X only): the picture again and again side by side across the whole view, `gap` px
  // between the copies. It still sits in the stage's layers like any prop.
  function backdrop(spr, gap) {
    const draw1 = spr.draw.bind(spr);
    spr.gap = gap; spr.x0 = spr.x;
    spr.period = () => spr.frameW * Math.abs(spr.scale.x) + spr.gap;
    spr.draw = (ctx, cam) => {
      if (!spr.visible || spr.alpha <= 0 || !cam) return;
      const w = spr.period(); if (w < 2) return;
      const z = cam.zoom, sf = spr.scroll.x;
      const ox = G.W / 2 - z * ((cam.x - G.W / 2) * sf + G.W / 2);
      // (a copy more on each side: the camera shakes + turns)
      const x0 = (-G.CUT - ox) / z - w, x1 = (G.W + G.CUT - ox) / z + w, bx = spr.x;
      for (let x = bx + Math.floor((x0 - bx) / w) * w; x < x1; x += w) { spr.x = x; draw1(ctx, cam); }
      spr.x = bx;
    };
    // moves it left, kept within one copy of where it started (the same picture, no numbers running away)
    spr.slide = d => { const w = spr.period(); spr.x -= d; if (w > 1) while (spr.x < spr.x0 - w) spr.x += w; };
  }
  // BlendMode.SUBTRACT (the canvas has none): dst - src = 1 - ((1 - dst) + src): flip the colours, add, flip back
  function subtractDraw(spr) {
    const draw1 = spr.draw.bind(spr);
    const flip = ctx => { G.setScreenT(ctx); ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(-G.CUT - 2, -2, G.W + G.CUT * 2 + 4, G.H + 4); ctx.restore(); };
    spr.draw = (ctx, cam) => {
      if (!spr.visible || spr.alpha <= 0.002) return;
      flip(ctx); spr.blend = 'lighter'; try { draw1(ctx, cam); } finally { spr.blend = null; flip(ctx); }
    };
  }
  // the props a stage file marks: endless strips ('backdrop'), subtract ('blendMode')
  function specialProps(P) {
    for (const d of P.stage.data.props || []) {
      const s = prop(P, d.name); if (!s) continue;
      if (d.backdrop != null) backdrop(s, d.backdrop);
      if (d.blendMode === 'subtract') subtractDraw(s);
    }
  }

  // ---- the Airship, Yellow's room (data/stages/airship.hx): White sweats in the corner; in Oversight he's gone and
  //      Yellow's body lies there instead
  STAGES.airship = {
    reset(P) {
      const dead = P.song.id === 'oversight', w = prop(P, 'whiteAwkward'), d = prop(P, 'deadbody');
      if (w) { w.visible = !dead; w.play('sweat', true); }
      if (d) d.alpha = dead ? 1 : 0;
    },
  };
  // ---- Mando (songs/mando/mando.hx): the zoom + the camera spots at a few beats
  SONGS.mando = {
    beat(P, b) {
      if (b === 32 || b === 96) setZoom(P, 0.7);
      else if (b === 128) setCams(P, [350, 547.5], [650, 547.5], -1);
      else if (b === 192) setZoom(P, 0.8);
      else if (b === 196) setZoom(P, 0.9);
      else if (b === 200) { setCams(P, [300, 500], [700, 500], -1); setZoom(P, 0.6); }
    },
  };
  // ---- D'low (songs/d'low/d'low.hx): the camera twists + bops (utils.hx events), then Yellow dies at the very end:
  //      her death, her dead icon standing in for hers (it doesn't bop), BF + GF scared, the camera between them
  SONGS["d'low"] = {
    setup(P) { iconImg('yellow-dead'); },
    reset(P) { for (const c of [P.dad, P.bf, P.gf]) if (c) c._locked = false; },
    event(P, name, v) {
      if (name !== 'Legacy' || String(v.value1) !== 'dlow death') return;
      const I = P.imp, img = iconImg('yellow-dead');
      if (img && !G.settings.hideHud) I.fakeIcon = { img, player: false, scale: 1, flip: P.iconP2.flip, pixel: false };
      if (P.dad) { P.dad.playAnim('death', true); P.dad._locked = true; }
      setCams(P, [450, 500], [450, 500], -1); setZoom(P, 0.7);
      const scare = (c, list) => { if (!c) return; const a = list.find(n => c.anims[n]); if (a) { c.playAnim(a, true); c._locked = true; } };
      scare(P.bf, ['yellowReaction', 'scared']);
      scare(P.gf, ['yellowReaction', 'scared', 'sad']);
    },
  };

  // ---- the runners' legs (data/characters/danger.hx + bf-running.hx): a second copy of the character on its 'legs'
  //      animation right behind it, its frame locked to the beat (one run every 2 beats). The body bobs with the legs'
  //      frame; while idle (BF: on any looping pose) the body shows the legs' frame too, so they stay in step
  const LEG_Y = {
    'imp-danger': [13, 7, -3, -1, -1, 2, 7, 9, 7, 2, 0, 0, 3, 1, 3, 7, 13],
    'imp-bf-running': [7, 7, 4, 4, -5, -5, -7, -7, -3, -3, 7, 7, 4, 4, -5, -5, -7, -7, -3, -3],
  };
  const LEG_Y_MAD = [-8, -3, 5, 2, -8, -13, -16, -14, -9, -4, 5, -4, -9, -10];
  const syncFrame = s => { const a = s.cur; if (a && a.kind === 'sparrow') { const f = a.frames[s.fi]; s.frameW = f.fw; s.frameH = f.fh; } };
  function legsScript(isBf) {
    return {
      attach(ch, stage) {
        const L = ch._legs = new G.Sprite(0, 0);
        L.anims = ch.anims; L.animOffsets = ch.animOffsets; L.globalOffsets = ch.globalOffsets; L.useAnimOffsets = true;
        L.scale = ch.scale; L.origin = ch.origin; L.offset = ch.offset; L.scroll = ch.scroll; L.antialias = ch.antialias;
        L.atlas = ch.atlas; L.sheet = ch.sheet; L.zIndex = ch.zIndex - 0.6; L.legAnim = 'legs';
        L.play('legs', true);
        const draw1 = L.draw.bind(L);
        L.draw = (ctx, cam) => { if (ch.visible && !ch.isDead && ch.alpha > 0) { L.alpha = ch.alpha; draw1(ctx, cam); } };
        stage.addExtra(L, ch);
      },
      tick(ch) {
        const P = G.screens.play, L = ch._legs, op = ch.originalPosition;
        if (!L || !op || !P || !P.cond || G.screen !== P) return;
        L.zIndex = ch.zIndex - 0.6; L.scroll = ch.scroll; L.flipX = ch.flipX; L.x = op.x; L.y = op.y;
        if (ch.isDead) { ch.y = op.y; return; }
        // (BF: his miss legs while he's on a miss pose; Black: the fast ones once he's mad)
        const want = isBf ? (/miss/.test(ch.animName) ? 'legs-miss' : 'legs') : (ch._madLegs ? 'legs-mad' : 'legs');
        if (L.legAnim !== want && ch.anims[want]) { L.legAnim = want; L.play(want, true); }
        const a = L.cur; if (!a) return;
        const beat = P.songPos / P.cond.crochet, k = (((beat % 2) + 2) % 2) / 2;
        L.fi = Math.min(a.n - 1, Math.floor(k * a.n)); syncFrame(L);
        const idle = ch.animName.startsWith('idle');
        if (ch.cur && (isBf ? ch.cur.loop : idle)) { ch.fi = Math.min(L.fi, ch.cur.n - 1); syncFrame(ch); }
        const ys = isBf ? LEG_Y['imp-bf-running'] : idle ? null : ch.singSuffix === '-mad' ? LEG_Y_MAD : LEG_Y['imp-danger'];
        ch.y = op.y + ((ys && ys[L.fi]) || 0);
      },
    };
  }
  G.CharScripts['imp-danger'] = legsScript(false);
  G.CharScripts['imp-bf-running'] = legsScript(true);

  // ---- Danger (data/stages/danger.hx + songs/danger/script.hx): running on top of the Airship. Every strip scrolls
  //      left (clouds slow, the platform under your feet + the speed lines fast), the big cloud drifts past + comes back
  //      somewhere new, the camera always shakes a little + bobs, the HUD sways. Black screams (the sky flashes), turns
  //      mad (his fast legs), GF + her speaker roll off and everything speeds up.
  const DANGER_CAMS = {
    1: [[1634.05, -54.3], [1634.05, -54.3], 0.3], 64: [[800, 150], [1200, 150], 0.4], 96: [[700, 150], [1200, 150], 0.6],
    128: [[800, 150], [1200, 150], 0.4], 144: [[800, 150], [1200, 150], 0.5], 152: [[800, 150], [1200, 150], 0.6],
    154: [[600, 150], [600, 150], 0.6], 156: [[450, 150], [450, 150], 0.8], 158: [[450, 150], [450, 150], 0.6],
    160: [[800, 150], [1200, 150], 0.4], 192: [[700, 150], [1200, 150], 0.6], 256: [[800, 150], [1200, 150], 0.4],
    288: [[700, 150], [1200, 150], 0.6], 320: [[1634.05, -54.3], [1634.05, -54.3], 0.3], 384: [[700, 150], [1200, 150], 0.6],
  };
  STAGES.danger = {
    setup(P) {
      specialProps(P);
      P.danger = { tw: [], strips: [['farClouds', 7], ['midClouds', 13], ['closeClouds', 50], ['platform', 300], ['speedlines', 350]] };
      const big = prop(P, 'bigCloud'); if (big) { big.x0 = big.x; big.y0 = big.y; }
      const gb = prop(P, 'gfBoard'); if (gb) gb.x0 = gb.x;
    },
    reset(P) {
      const D = P.danger;
      D.tw.length = 0; D.speed = flashOn() ? 9 : 7; D.bigSpeed = 10; D.scream = false; D.go = null;
      for (const [n] of D.strips) { const s = prop(P, n); if (s && s.x0 != null) s.x = s.x0; }
      const big = prop(P, 'bigCloud'); if (big) { big.x = big.x0; big.y = big.y0; }
      const gb = prop(P, 'gfBoard'); if (gb) { gb.x = gb.x0; gb.visible = true; }
      const ss = prop(P, 'screamsky'); if (ss) ss.alpha = 0;
      if (P.gf && P.gf.originalPosition) { P.gf.x = P.gf.originalPosition.x; P.gf.visible = true; }
      if (P.dad) { P.dad._madLegs = false; P.dad.singSuffix = ''; P.dad.idleSuffix = ''; P.dad._special = false; }
      P.hud.sy = 0;
    },
    update(P, dt) {
      const D = P.danger; tick(D.tw, dt);
      const d = dt * D.speed * (G.settings.songSpeed || 1);
      for (const [n, v] of D.strips) { const s = prop(P, n); if (s && s.slide) s.slide(d * v); }
      const big = prop(P, 'bigCloud');
      if (big) {
        big.x -= d * D.bigSpeed;
        if (big.x < -4163.7) { big.x = rnd(3931.5, 4824.05); big.y = rnd(-1087.5, -307.35); D.bigSpeed = rnd(7, 15); }
      }
      if (!D.scream) P.cam.shake(0.0008, 0.01);
      const bps = P.cond.bpm / 60;
      P.cam.py = Math.sin((P.songPos / 280) * bps) * 2 - 2;
      P.hud.sy = -Math.sin((P.songPos / 300) * bps * -1) * 0.6;
      P.hud.angle = Math.sin((P.songPos / 350) * bps * -1) * 0.6;
    },
    // (onGameOverStart: the camera zooms to .65 over 8 s, half a second in)
    gameOverUpdate(P, dt) {
      const D = P.danger, go = P.gameOver; if (!D.go) D.go = { t: 0, z0: go.zoom1 };
      D.go.t += dt; const k = G.clamp((D.go.t - 0.5) / 8, 0, 1);
      go.zoom1 = D.go.z0 + (0.65 - D.go.z0) * expoOut(k);
    },
    event(P, name, v) {
      if (name !== 'Legacy') return;
      const D = P.danger, k = String(v.value1), ss = prop(P, 'screamsky');
      if (k === 'scream danger') {
        D.scream = true;
        if (ss) { ss.alpha = 1; ss.play('bop', true); }
        if (P.dad) { P.dad.playAnim('scream2', true); P.dad._special = true; P.dad.singSuffix = P.dad.idleSuffix = '-mad'; }
      } else if (k === 'unscream danger') {
        if (P.dad) P.dad._madLegs = true;
        D.scream = false;
        if (ss) tween(D.tw, ss, { alpha: 0 }, 0.6, quartOut);
      } else if (k === 'bye gf') {
        if (P.gf) tween(D.tw, P.gf, { x: P.gf.x - 3500 }, 4, quartIn, () => { P.gf.visible = false; });
        const gb = prop(P, 'gfBoard'); if (gb) tween(D.tw, gb, { x: gb.x - 3500 }, 4, quartIn, () => { gb.visible = false; });
        tween(D.tw, D, { speed: flashOn() ? 14 : 9 }, 5, quadIn);
      }
    },
  };
  SONGS.danger = {
    beat(P, b) {
      const c = DANGER_CAMS[b]; if (!c) return;
      if (b === 158) P.cam.shake(0.01, P.cond.stepCrochet / 1000 * 4);
      setCams(P, c[0], c[1], -1); setZoom(P, c[2]);
    },
  };

  // ---- Double Kill (data/stages/cargo.hx + songs/double-kill/double-kill.hx): White + Black. 'Opponent Two' hands the
  //      opponent's notes to Black (his icon + colour), 'Both Opponents' to both of them (the double icon); his own
  //      'Opponent 2 Sing' / 'Both Opponents Sing' notes too. Black on the camera's lean for his parts. Starts black,
  //      no HUD, the zoom pulling in, until the first flash. The dark parts (everyone but you fades), the Airship
  //      flashback, then BF turns into his defeat self in the dark, the glow, the end: red, everyone gone.
  STAGES.cargo = { setup(P) { specialProps(P); } };
  SONGS['double-kill'] = {
    setup(P) {
      const K = P.dk = { tw: [] };
      cacheChar(P, 'bf', 'imp-bf-defeat-normal');
      if (P.bf) P.swapCache['bf:' + P.bf.id] = P.bf;
      G.A.audio(SND + 'stage/defeat_kill_sfx.ogg');
      for (const n of ['white', 'black', 'double-kill']) iconImg(n);
      // (the song script's own pictures: added after the whole stage, over everybody)
      const air = K.air = sprite(G.A.imagePath(AIR + 'double-kill/airshipFlashback') + '.png', 2200, 800);
      air.scale.x = air.scale.y = 1.3; air.zIndex = 1e6;          // (setGraphicSize after updateHitbox: grows round its middle)
      const glow = K.glow = sprite(G.A.imagePath('shared:impostor/stages/void/iluminao omaga') + '.png', 900, 350);
      glow.scale.x = glow.scale.y = 4; glow.updateHitbox(); glow.blend = 'lighter'; glow.zIndex = 1e6 + 1;
      // (cargoDarkFG: a black block twice the screen at scroll 0: it covers the whole view)
      K.fg = { zIndex: 1e6 + 2, alpha: 1, update() {}, draw(ctx) { if (this.alpha <= 0.002) return; G.setScreenT(ctx); ctx.save(); ctx.globalAlpha = Math.min(1, this.alpha); ctx.fillStyle = '#000'; ctx.fillRect(-G.CUT - 2, -2, G.W + G.CUT * 2 + 4, G.H + 4); ctx.restore(); } };
      for (const s of [air, glow, K.fg]) P.stage.addExtra(s, null);
      const m = prop(P, 'mainoverlay'); if (m) K.main0 = { y: m.y, sy: m.scale.y };
    },
    reset(P) {
      const K = P.dk, I = P.imp;
      K.tw.length = 0; K.two = K.both = K.darken = K.showAir = false; K.zt = null;
      K.air.alpha = 0.001; K.glow.alpha = 0.001; K.glow.visible = true; K.fg.alpha = 1;
      const m = prop(P, 'mainoverlay'), l = prop(P, 'lightoverlay'), cd = prop(P, 'cargoDark');
      if (m) { m.alpha = 0.51; m.flipY = false; m.y = K.main0.y; m.scale.y = K.main0.sy; }
      if (l) l.alpha = 0.6;
      if (cd) cd.alpha = 0.001;
      for (const c of [P.dad, P.gf, P.bf]) if (c) { c.alpha = 1; c.visible = true; }
      I.beepFade = 1; I.barA = 1; I.scoreTop = false;
      P.hudParts.all = 0;                                         // (camHUD.visible = false until the flash)
      const w = iconImg('white'); if (w) P.iconP2.img = w;
    },
    oppSingers(P, n) {
      const K = P.dk;
      if (n.kind === 'opp2') return [P.gf];
      if (K.both || n.kind === 'oppboth') return [P.dad, P.gf];
      if (K.two) return [P.gf];
      return [P.dad];
    },
    update(P, dt) {
      const K = P.dk, I = P.imp; tick(K.tw, dt);
      const lerp = (a, b, r) => a + Math.min(1, Math.max(0, r)) * (b - a);
      // (the first 1.2 s: the black lifts a little, the zoom pulls in to 1)
      if (P.started && P.songPos >= 0 && P.songPos < 1200) { K.fg.alpha -= dt / 5; P.zoomTween = null; P.camZoom = lerp(P.camZoom, 1, dt * 3); }
      if (K.darken) {
        const cd = prop(P, 'cargoDark'), m = prop(P, 'mainoverlay'), l = prop(P, 'lightoverlay'), r = dt * 1.4;
        if (cd) cd.alpha = lerp(cd.alpha, 1, r);
        for (const c of [P.dad, P.gf]) if (c) c.alpha = lerp(c.alpha, 0.001, r);
        if (m) m.alpha = lerp(m.alpha, 0.001, r); if (l) l.alpha = lerp(l.alpha, 0.001, r);
      }
      if (K.showAir) K.air.alpha = lerp(K.air.alpha, 0.45, dt * 0.1);
      if (K.zt) { const z = K.zt; z.t += dt; const e = z.ease(Math.min(1, z.t / z.dur)); I.baseZoom = z.z0 + (z.z1 - z.z0) * e; P.stageZoom = I.baseZoom + (I.zoomAdd || 0); if (z.t >= z.dur) K.zt = null; }
    },
    event(P, name, v) {
      const K = P.dk, I = P.imp, v1 = String(v.value1 == null ? '' : v.value1).trim();
      const zoomTo = (z, beats, ease) => { K.zt = { t: 0, dur: P.cond.crochet / 1000 * beats, z0: I.baseZoom, z1: z, ease: ease || E.linear }; };
      if (name === 'flash') { K.fg.alpha = 0; P.hudParts.all = 1; return; }
      if (name === 'Opponent Two') {
        K.two = parseInt(v1, 10) === 1;
        if (!K.both) { const c = K.two ? P.gf : P.dad; I.oppCol = c && c.data.hpColor; const im = iconImg(K.two ? 'black' : 'white'); if (im) P.iconP2.img = im; }
        return;
      }
      if (name === 'Both Opponents') {
        K.both = parseInt(v1, 10) === 1;
        const im = iconImg(K.both ? 'double-kill' : K.two ? 'black' : 'white'); if (im) P.iconP2.img = im;
        return;
      }
      if (name !== 'Legacy') return;
      const m = prop(P, 'mainoverlay'), l = prop(P, 'lightoverlay'), cd = prop(P, 'cargoDark');
      switch (v1) {
        case 'black': I.camTarget = 'gf'; break;
        case 'not black': I.camTarget = null; break;
        case 'wmc': setCams(P, [2150, 1050], [2150, 1050], -1); break;
        case 'nc': case 'ncy': setCams(P, [2000, 1050], [2300, 1050], -1); break;
        case '356': setCams(P, null, [2750, 1150], -1); setZoom(P, 1.1); break;
        case '420': setCams(P, null, [2300, 1050], -1); setZoom(P, 0.8); break;
        case '552': setCams(P, [1650, 1180], null, -1); setZoom(P, 1.2); break;
        case '556': setCams(P, [2000, 1050], null, -1); setZoom(P, 0.8); break;
        case 'darken': K.darken = true; P.cam.flash('#000000', 0.55); break;
        case 'airship': K.showAir = true; break;
        case 'brighten':
          K.showAir = K.darken = false; K.air.alpha = 0.001; if (cd) cd.alpha = 0.001;
          for (const c of [P.dad, P.gf]) if (c) c.alpha = 1;
          if (l) l.alpha = 0.6; if (m) m.alpha = 0.51;
          break;
        case 'gonnakill': {
          const d = P.cond.crochet * 0.004;
          zoomTo(1, 4, E.sineInOut);
          tween(K.tw, K.fg, { alpha: 1 }, d);
          tween(K.tw, I, { barA: 0 }, d, circInOut);            // (the time bar, the health bar + the icons)
          tween(K.tw, P.hudParts.time, { alpha: 0 }, d, circInOut);
          break;
        }
        case 'readykill':
          if (P.bf && P.bf.id !== 'imp-bf-defeat-normal') { G.ModChars.swap(P, 'bf', 'imp-bf-defeat-normal'); for (const g of I.ghosts.bf) { g.owner = P.bf; g.spr.alpha = 0; } }
          zoomTo(0.8, 16, expoOut);
          if (P.down) I.scoreTop = true;
          K.glow.alpha = 0.1; if (l) l.alpha = 0; if (cd) cd.alpha = 1; if (P.dad) P.dad.alpha = 0;
          K.fg.alpha = 1; tween(K.tw, K.fg, { alpha: 0 }, 2.75);
          if (m) { m.flipY = true; m.scale.y *= 3; m.y += 1200; }
          break;
        case 'ending':
          zoomTo(0.6, 64);
          tween(K.tw, K.glow, { alpha: 1 }, P.cond.crochet * 0.004 * 20, E.sineInOut);
          if (m) tween(K.tw, m.scale, { y: m.scale.y * 2 }, P.cond.crochet * 0.004 * 24, E.sineInOut);
          break;
        case 'endingcam': setCams(P, [2220, 1050], [2220, 1050], -1); break;
        case 'kill':
          P.cam.flash('#FF0000', 2.75);
          for (const c of [P.gf, P.bf]) if (c) c.visible = false;
          K.glow.visible = false; P.hudParts.all = 0;
          break;
      }
    },
  };

  // ================================================================ videos (FunkinVideoSprite: fit to the screen height)
  function playVideo(path, o) {
    o = o || {};
    const src = G.A.raw[path], V = { done: false, t: 0, path };
    if (!src) { V.done = true; V.stop = () => {}; return V; }
    const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
    v.volume = Math.min(1, (G.settings.vol.master || 1) * (G.settings.vol.sfx == null ? 1 : G.settings.vol.sfx));
    v.onended = () => { V.done = true; }; v.onerror = () => { V.done = true; };
    const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => { V.done = true; }); });
    V.el = v; V.stop = () => { try { v.pause(); } catch (e) {} V.done = true; };
    return V;
  }
  function drawVideo(ctx, V, bg) {
    G.setScreenT(ctx);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(-G.CUT, 0, G.W + G.CUT * 2, G.H); }
    const v = V.el;
    if (v && v.readyState >= 2 && v.videoWidth) { const s = G.H / v.videoHeight, w = v.videoWidth * s; ctx.drawImage(v, (G.W - w) / 2, 0, w, G.H); }
  }
  // a video step for a cutscene (scripts/dialogue.hx videoCutscene: black, the video, 'Press BACK to skip' fading
  // in and out at the bottom left, the captions)
  function videoStep(rel, opt) {
    opt = opt || {};
    return {
      enter(S) {
        S.black = 0; S.noSkipText = true;
        S.V = playVideo(VID + rel + '.webm'); S.caps = G.A.json(DATA + 'captions/' + rel.replace(/\//g, '_') + '.json') || [];
        S.skipA = 0; S.skipTw = [];
        tween(S.skipTw, S, { skipA: 0.5 }, 2, E.sineInOut, () => { S.skipTw.push({ obj: S, from: { skipA: 0.5 }, to: { skipA: 0 }, dur: 3, t: -2, ease: E.sineInOut }); });
      },
      update(S, dt) {
        tick(S.skipTw, dt);
        if (S.t > 4 && S.V.el && S.V.el.readyState < 2) S.V.done = true;     // never stuck on a video that won't play
        if (S.V.done) S.go();
      },
      draw(S, ctx) {
        drawVideo(ctx, S.V, '#000');
        const t = S.V.el ? S.V.el.currentTime : 0, c = S.caps.find(x => t >= x[0] && t < x[1]);
        if (c) caption(ctx, c[2]);
        if (opt.canSkip !== false && S.skipA > 0.01 && !G.touchMode) { G.setScreenT(ctx); G.text(ctx, 'Press BACK to skip', 15, G.H - 15 * 0.75 - 6, { size: 25, font: 'liberbold', align: 'left', outline: 2, alpha: S.skipA }); }
      },
      leave(S) { if (S.V) S.V.stop(); S.V = null; S.noSkipText = false; },
      back: opt.canSkip !== false,
    };
  }

  // ================================================================ the talk box (scripts/dialogue.hx)
  const rgbCache = new Map();
  // RGBSprite: the picture's red / green / blue mixed into three colours (r * c1 + g * c2 + b * c3)
  function rgbBox(img, c1, c2, c3) {
    const key = img.src + '|' + c1 + c2 + c3; let c = rgbCache.get(key);
    if (c && c._gen === G.gfxGen) return c;
    c = G.makeCanvas(img.width, img.height); const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), a = d.data, A = hex(c1), B = hex(c2), C = hex(c3);
    for (let i = 0; i < a.length; i += 4) {
      const r = a[i] / 255, g = a[i + 1] / 255, b = a[i + 2] / 255;
      a[i] = Math.min(255, r * A[0] + g * B[0] + b * C[0]); a[i + 1] = Math.min(255, r * A[1] + g * B[1] + b * C[1]); a[i + 2] = Math.min(255, r * A[2] + g * B[2] + b * C[2]);
    }
    x.putImageData(d, 0, 0); c._gen = G.gfxGen; rgbCache.set(key, c);
    return c;
  }
  const argb = s => { const m = /^0x[0-9a-f]{2}([0-9a-f]{6})$/i.exec(String(s || '')); return m ? '#' + m[1] : '#FF1515'; };
  let measure = null;
  function wrap(text, w, size, font) {
    if (!measure) measure = G.makeCanvas(4, 4).getContext('2d');
    measure.font = size + 'px ' + font;
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const t = line ? line + ' ' + word : word;
        if (measure.measureText(t).width > w && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  }
  function Talk(P, sid, lines, opt) {
    opt = opt || {};
    const T = {
      done: false, k: -1, tw: [], fade: { a: 0 }, group: { y: 0 }, show: { a: 0.001 }, old: null, cur: null,
      ports: [null, null, null], typed: 0, typeT: 0, ended: false, wait: 0.5, leaving: false,
      start() {
        tween(this.tw, this.fade, { a: 0.35 }, 0.8, E.circIn);
        const mus = 'preload/music/impostor/dialogue/' + sid + '.ogg';
        if (G.A.has(mus)) G.audio.music.play(mus, { loop: true, vol: 0.8, fadeIn: 1 });
        return this;
      },
      talker(who) {
        const d = G.A.json(DATA + 'talkers/' + who + '.json') || {};
        let p = this.ports[d.side || 0];
        if (!p || p.who !== who) {
          const spr = new G.Sprite(0, 0).loadSparrow(G.A.imagePath('shared:impostor/ui/dialogue/characters/' + d.asset));
          spr.useAnimOffsets = true;
          for (const a of d.animations || []) {
            spr.addAnim(a.anim, a.name, a.fps || 24, false); spr.animOffsets[a.anim] = a.offsets || [0, 0];
            if (a.loop) { spr.addAnim(a.anim + '-loop', a.name, a.fps || 24, true); spr.animOffsets[a.anim + '-loop'] = a.offsets || [0, 0]; }
          }
          const side = d.side || 0;
          // (port0 196.85, 251 -> 247; port1 centred, 198 -> 148; port2 914.75, 216 -> 865)
          p = { who, d, spr, side, a: 0, x: side === 0 ? 196.85 : side === 2 ? 914.75 : 0, y: side === 1 ? 198 : side === 0 ? 251 : 216, shown: false };
          if (this.ports[side] && this.ports[side].who !== who && this.ports[side].shown) { p.a = 1; p.shown = true; p.x = side === 0 ? 247 : side === 2 ? 865 : p.x; p.y = side === 1 ? 148 : p.y; }
          this.ports[side] = p;
        }
        if (!p.shown) {
          p.shown = true;
          if (p.side === 2) tween(this.tw, p, { a: 1, x: 865 }, 0.5, E.quadInOut);
          else if (p.side === 0) tween(this.tw, p, { a: 1, x: 247 }, 0.5, E.quadInOut);
          else tween(this.tw, p, { a: 1, y: 148 }, 0.5, E.quadInOut);
        }
        return p;
      },
      next(withOld) {
        if (withOld && this.cur) { this.old = Object.assign({}, this.cur, { typed: this.cur.text.length }); G.sfx('preload/sounds/impostor/clickText.ogg', { vol: 0.8 }); }
        this.k++;
        const L = lines[this.k]; if (!L) { this.close(); return; }
        const [who, emote, text] = L;
        const p = this.talker(who);
        p.spr.play(emote, true);
        this.cur = { who, name: p.d.label || who, icon: p.d.icon, text, colors: [argb(p.d.boxColor), '#666666', argb(p.d.boxShadeColor)], sound: p.d.sound, port: p };
        this.cur.lines = wrap(text, G.W * 0.5, 26, 'liber');
        this.typed = 0; this.typeT = 0; this.ended = false;
      },
      close() {
        if (this.leaving) return; this.leaving = true;
        G.audio.music.stop(0);
        G.sfx('preload/sounds/impostor/panelDisappear.ogg', { vol: 0.5 });
        tween(this.tw, this.fade, { a: 0 }, 0.25, E.circIn);
        tween(this.tw, this.group, { y: 700 }, 0.25, E.circIn, () => { this.done = true; });
      },
      accept() {
        if (this.leaving || this.wait > 0 || !this.cur) return;
        if (this.ended) this.next(true); else { this.typed = this.cur.text.length; this.ended = true; this.onTyped(); }
      },
      back() { if (this.leaving) return; this.close(); },
      onTyped() { const p = this.cur && this.cur.port; if (p && p.spr.anims[p.spr.animName + '-loop']) { /* loops after it finishes */ } },
      update(dt) {
        tick(this.tw, dt);
        if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) { this.show.a = 1; this.next(false); } }
        for (const p of this.ports) if (p) {
          p.spr.update(dt);
          if (p.spr.finished && p.spr.anims[p.spr.animName + '-loop']) p.spr.play(p.spr.animName + '-loop', true);
        }
        const c = this.cur;
        if (c && !this.ended && !this.leaving) {
          this.typeT += dt;
          while (this.typeT >= 0.05 && this.typed < c.text.length) {
            this.typeT -= 0.05; this.typed++;
            if (c.text[this.typed - 1] !== ' ') G.sfx('preload/sounds/impostor/dialogue/' + c.sound + '.ogg', { vol: 0.6 });
          }
          if (this.typed >= c.text.length) { this.ended = true; this.onTyped(); }
        }
      },
      draw(ctx) {
        G.setScreenT(ctx);
        G.screenOff.x += G.CUT / 2; G.setScreenT(ctx);
        ctx.save();
        if (this.fade.a > 0.002) { ctx.globalAlpha = this.fade.a; ctx.fillStyle = '#fff'; ctx.fillRect(-200 - G.CUT, -200, G.W * 1.3 + G.CUT * 2, G.H * 1.3); ctx.globalAlpha = 1; }
        ctx.translate(0, this.group.y);
        for (const p of this.ports) if (p && p.a > 0.002) {
          const s = p.spr; s.alpha = p.a;
          s.x = p.side === 1 && !p.xset ? (G.W - s.frameW) / 2 : p.x; s.y = p.y; s.draw(ctx, null);
        }
        G.setScreenT(ctx); ctx.translate(0, this.group.y);
        const boxImg = G.A.image(IMG + 'ui/dialogue/dialogueBox.png'), bub = G.A.image(IMG + 'ui/dialogue/bubble.png');
        const a = this.show.a, c = this.cur;
        if (boxImg && c) { ctx.globalAlpha = a; ctx.drawImage(rgbBox(boxImg, ...c.colors), Math.round((G.W - boxImg.width) / 2), 431); }
        const bx = bub ? Math.round((G.W - bub.width) / 2 + 18.5) : 0;
        // the line before (bubble at y 616, icon 120.8 lower, name at 614, text at 650)
        const o = this.old;
        if (o && bub) { ctx.globalAlpha = 1; ctx.drawImage(bub, bx, 616); this.line(ctx, o, 614, 650, 120.8, o.text.length); }
        if (c && bub) { ctx.globalAlpha = a; ctx.drawImage(bub, bx, 496); this.line(ctx, c, 495, 525, 0, this.typed); }
        ctx.restore();
        G.screenOff.x -= G.CUT / 2; G.setScreenT(ctx);
      },
      line(ctx, L, nameY, textY, iconDy, n) {
        const icon = G.A.image('preload/images/icons/icon-imp-' + L.icon + '.png');
        if (icon) { const w = 105, h = icon.height * 0.7; ctx.drawImage(icon, 0, 0, 150, icon.height, 220, 496 + 109 / 2 - 75 + iconDy, w, h); }
        G.text(ctx, L.name, 350, nameY, { size: 30, font: 'liberbold', align: 'left', baseline: 'top', outline: 2 });
        // (squished to fit 67 px when there are many lines)
        const lh = 30, total = L.lines.length * lh, sq = Math.min(67 / Math.max(1, total), 1);
        ctx.save(); ctx.translate(350, textY); ctx.scale(1, sq);
        let left = n;
        L.lines.forEach((ln, r) => { if (left <= 0) return; const s = ln.slice(0, left); left -= ln.length + 1; G.text(ctx, s, 0, r * lh, { size: 26, font: 'liber', align: 'left', baseline: 'top', color: '#000' }); });
        ctx.restore();
      },
    };
    return T.start();
  }
  const talkStep = (sid, lines) => ({ enter(S) { S.black = 0; S.noSkipText = true; S.dlg = Talk(S.P, sid, lines); }, leave(S) { S.noSkipText = false; } });

  // ================================================================ cutscenes (story mode in the mod; FNF 2 also plays
  // them the first time in freeplay, like VS Sky)
  const IN_SONG_VIDEO = { ejected: true };       // (plays over the song itself: SONGS.ejected)
  function cutsceneFor(sid) {
    return {
      create(P) {
        const d = songData(sid); if (!d) return null;
        const steps = [];
        const intro = IN_SONG_VIDEO[sid] ? null : (d.videos || []).find(v => v.toLowerCase().endsWith('/' + sid));
        if (intro) steps.push(videoStep(intro));
        if (d.talk && d.talk.length) steps.push(talkStep(sid, d.talk));
        if (!steps.length) return null;
        const S = G.Scene(P, steps);
        // (talk + video draw themselves; the scene's own skip text is only for steps that have none)
        const draw0 = S.draw.bind(S);
        S.draw = ctx => { if (S.noSkipText) { const s = S.steps[S.k]; if (s && s.draw) s.draw(S, ctx); if (S.dlg) S.dlg.draw(ctx); G.setScreenT(ctx); if (S.black > 0) { ctx.fillStyle = 'rgba(0,0,0,' + S.black + ')'; ctx.fillRect(0, 0, G.W, G.H); } } else draw0(ctx); };
        const act0 = S.onAction.bind(S);
        S.onAction = (a, down, repeat) => {
          if (!down || repeat || S.done) return;
          if (S.dlg && S.dlg.back && a === 'back') { S.dlg.back(); return; }
          const st = S.steps[S.k];
          if (st && st.back !== undefined && a === 'back') { if (st.back) S.go(); return; }
          act0(a, down, repeat);
        };
        return S;
      },
      createEnd(P) {
        if (sid !== 'meltdown' || !isStory(P)) return null;      // (the end of the week video, story mode)
        return G.Scene(P, [videoStep('week1/post-week1')]);
      },
    };
  }

  // ================================================================ wire it up
  G.SongFX = G.SongFX || {}; G.Cutscenes = G.Cutscenes || {};
  G.Impostor = { STAGES, SONGS, combine, BASE };
  const SONG_IDS = ['sussus-moogus', 'sabotage', 'meltdown', 'sussus-toogus', 'lights-down', 'reactor', 'ejected',
    'mando', "d'low", 'oversight', 'danger', 'double-kill'];
  for (const sid of SONG_IDS) {
    G.SongFX[sid] = { setup(P) { if (!isImp(P)) return; const st = (P.stage.data.impostor || {}).stage; P.sfx = combine(BASE, STAGES[st], SONGS[sid]); if (P.sfx.setup) P.sfx.setup(P); } };
    G.Cutscenes[sid] = cutsceneFor(sid);
  }
})();
