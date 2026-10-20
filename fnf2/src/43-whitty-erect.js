// FNF 2 - Whitty-ERECT (the Psych Engine remix mod of VS Whitty), the 'erect' variation of Lo-Fight, Overhead +
// Ballistic (ERECT = a lighter chart, NIGHTMARE = the mod's own), played like the mod:
//   Lo-Fight   Whitty tears his poster down and burns it, hears BF beep, turns round (cutscene.lua), then the voiced talk;
//              the arrows + health bar fade in at the start, everything fades out at the end (lofightSpecialEvents.lua)
//   Overhead   fade in, the voiced talk; mid-song the alley goes black and everyone turns into silhouettes (ColoredApple)
//   Ballistic  the mod's video, the voiced talk, then the HUD slides in, Whitty screams, flashes, the HUD fades for the
//              arrows-in-the-middle part, the red angry vignette (stronger the more health you have), the camera shakes
//              + glitches on his notes (ballisticSpecialEvents / whittyAngryOverlay / camShake / opponentSingShader.lua)
// On all three the camera leans toward every note (camera.lua: 25 / 30 / 60 px). The talk is Psych's DialogueBoxPsych
// with its DialogueCharacter portraits (expressions) + one voice-acted line per entry. Art, songs, charts + talk come
// from the mod (tools/own/whitty.py, private build only). The song events are in 16-mod-events.js.
(function () {
  const EX = 'whitty-erect', IMG = 'preload/images/' + EX + '/', SND = 'preload/sounds/' + EX + '/', MUS = 'preload/music/' + EX + '/';
  const DATA = 'preload/data/' + EX + '/', LETTERS = 'shared/images/psych/alphabet';
  const flashOn = () => G.settings.flashing !== false;
  const isErect = P => P.song && P.song.variation === 'erect';
  const smoothIO = t => t * t * t * (t * (t * 6 - 15) + 10);
  const E = {
    linear: t => t, smootherStepOut: t => 2 * smoothIO(t / 2 + 0.5) - 1, outCubic: t => 1 + Math.pow(t - 1, 3),
    sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2, ease: t => -(Math.cos(Math.PI * t) - 1) / 2,
  };
  // a tiny FlxTween (same as 42-whitty.js): tween(list, obj, {key: to}, seconds, ease); a new one on a key replaces the old
  function tween(list, obj, to, d, ease) {
    for (const k in to) for (const w of list) if (w.obj === obj && w.key === k) w.dead = true;
    for (const k in to) list.push({ obj, key: k, a: null, b: to[k], t: 0, d: Math.max(1e-6, d), e: ease || E.linear });
  }
  function runTweens(list, dt) {
    for (const w of list) {
      if (w.dead) continue;
      w.t += dt; if (w.a == null) w.a = w.obj[w.key];
      const k = Math.min(1, w.t / w.d); w.obj[w.key] = w.a + (w.b - w.a) * w.e(k);
      if (k >= 1) w.dead = true;
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  }
  const timers = list => ({ list: list.map(x => ({ at: x[0], fn: x[1], done: false })), run(t) { for (const x of this.list) if (!x.done && t >= x.at) { x.done = true; x.fn(); } } });

  // ================================================================ Psych 0.7 Alphabet (TypedAlphabet, not bold, x0.7)
  const TS = 0.7, ROW = 85;
  let letterData = null;
  function letters() {
    if (letterData) return letterData;
    const d = G.A.json(DATA + 'alphabet.json') || {}, set = new Map();
    for (const c of String(d.allowed || '')) if (c !== ' ') set.set(c.toLowerCase(), null);
    for (const k in d.characters || {}) { const c = k.toLowerCase().slice(0, 1); if (set.has(c)) set.set(c, d.characters[k]); }
    if (!set.has('?')) set.set('?', { animation: 'question' });
    return (letterData = set);
  }
  const isAlpha = c => { const a = c.charCodeAt(0); return (a >= 65 && a <= 90) || (a >= 97 && a <= 122) || (a >= 192 && a <= 214) || (a >= 216 && a <= 246) || (a >= 248 && a <= 255); };
  // Alphabet.createLetters: a new row at '\n', or at a space once the row is 65% of the screen wide
  function layout(text) {
    const sheet = G.Sparrow.load(LETTERS), L = letters(), out = [];
    let x = 0, rows = 0, spaces = 0;
    for (const ch of String(text).replace(/\\n/g, '\n')) {
      if (ch === '\n') { x = 0; rows++; continue; }
      if (ch === ' ') spaces++;
      const low = ch.toLowerCase();
      if (!L.has(low)) continue;
      if (spaces > 0) { x += 28 * spaces * TS; if (x >= G.W * 0.65) { x = 0; rows++; } }
      spaces = 0;
      const ld = L.get(low) || {}, post = isAlpha(low) ? (low !== ch ? ' uppercase' : ' lowercase') : ' normal';
      let fr = sheet ? G.Sparrow.byPrefix(sheet, (ld.animation || low) + post) : [];
      if (!fr.length && sheet) fr = G.Sparrow.byPrefix(sheet, 'question normal');
      const f0 = fr[0], w = f0 ? f0.fw * TS : 20, h = f0 ? f0.fh * TS : 40, o = ld.normal || [0, 0];
      // (updateLetterOffset: bottoms on the 110 px line, nudged by the letter's own offsets)
      if (fr.length) out.push({ frames: fr, x: x - o[0] * TS, y: rows * ROW * TS - o[1] * TS + 110 * TS - h });
      x += w + (o[0] + 2) * TS;
    }
    return { letters: out, rows: out.length ? rows + 1 : 0 };
  }

  // ================================================================ DialogueBoxPsych + DialogueCharacter + voice lines
  const BOX = [['normal', 'speech bubble normal', true], ['normalOpen', 'Speech Bubble Normal Open', false], ['angry', 'AHH speech bubble', true],
    ['angryOpen', 'speech bubble loud open', false], ['center-normal', 'speech bubble middle', true], ['center-normalOpen', 'Speech Bubble Middle Open', false],
    ['center-angry', 'AHH Speech Bubble middle', true], ['center-angryOpen', 'speech bubble Middle loud open', false]];
  function Talk(song, P, opt) {
    opt = opt || {};
    const data = G.A.json(DATA + 'dialogue/' + song + '.json'), lines = data ? data.dialogue || [] : [];
    const box = new G.Sprite(70, 370).loadSparrow(G.A.imagePath('speech_bubble'));
    for (const [n, pre, loop] of BOX) box.addAnim(n, pre, 24, loop);
    box.play('normal', true); box.scale.x = box.scale.y = 0.9; box.visible = false;
    // portraits, in the order they first talk: left ones slide in from the left, right ones from the right, the
    // centre one comes up from under the screen (4000 px/s), fading in at 3 per second
    const chars = [], byId = {};
    for (const L of lines) {
      if (byId[L.portrait]) continue;
      const cj = G.A.json(IMG + 'dialogue/' + String(L.portrait).toLowerCase() + '.json'); if (!cj) continue;
      const sp = new G.Sprite(0, 0).loadSparrow(IMG + 'dialogue/' + cj.image);
      const anims = {};
      for (const a of cj.animations || []) { sp.addAnim(a.anim, a.loop_name, 24, false); sp.addAnim(a.anim + '-IDLE', a.idle_name, 24, true); anims[a.anim] = a; }
      const sc = 0.7 * (cj.scale || 1); sp.scale.x = sp.scale.y = sc;
      const f0 = sp.sheet && sp.sheet.frames && sp.sheet.frames[0], w = f0 ? f0.fw * sc : 300;
      const pos = cj.position || [0, 0], where = cj.dialogue_pos || 'left';
      const C = { id: L.portrait, sp, anims, where, alpha: 0 };
      if (where === 'center') { C.x = G.W / 2 - w / 2 + pos[0]; C.start = 60 + pos[1]; C.y = G.H + 50 + pos[1]; }
      else if (where === 'right') { C.start = G.W - w - 100 + pos[0]; C.x = C.start + 600; C.y = 60 + pos[1]; }
      else { C.start = -60 + pos[0]; C.x = C.start - 600; C.y = 60 + pos[1]; }
      // playAnim(expression, idle): the loop plays while typing, the idle version once the line is out
      C.play = (ex, idle) => {
        let k = ex; if (!anims[k]) { const ks = Object.keys(anims); k = ks[Math.floor(Math.random() * ks.length)]; }
        const a = anims[k]; if (!a) return;
        if (!a.loop_name || a.loop_name === a.idle_name) idle = true;
        sp.play(idle ? k + '-IDLE' : k, true);
        const o = (idle ? a.idle_offsets : a.loop_offsets) || [0, 0]; sp.offset.x = o[0]; sp.offset.y = o[1];
        C.cur = k; C.idle = !!idle;
      };
      chars.push(C); byId[L.portrait] = C;
    }
    if (opt.music) G.audio.music.play(MUS + opt.music, { loop: true, vol: 1, fadeIn: 2, restart: true });
    const voice = [];
    const sayLine = i => {
      for (const v of voice.splice(0)) v.stop();
      const p = SND + song + '/voice/' + (i + 1) + '.ogg';
      if (!G.A.has(p)) return;
      voice.push(G.audio.voice(p, { vol: 1 }), G.audio.voice(p, { vol: 1 }));       // (the mod plays each line twice at once)
    };
    const T = {
      done: false, cur: -1, bg: 0, ending: false, line: null, shown: 0, tt: 0, typing: false, last: null, lastBox: '', first: true,
      next() {
        this.cur++;
        const L = lines[this.cur]; if (!L) { this.end(); return; }
        const C = byId[L.portrait] || chars[0];
        const type = L.boxState === 'angry' ? 'angry' : 'normal', pre = C && C.where === 'center' ? 'center-' : '';
        box.visible = true;
        if (C !== this.last) { box.play(pre + type + 'Open', true); box.flipX = !!C && C.where === 'left'; }
        else if (type !== this.lastBox) box.play(pre + type, true);
        this.last = C; this.lastBox = type;
        this.line = layout(L.text || ' '); this.speed = L.speed || 0.05; this.sound = L.sound && String(L.sound).trim() ? L.sound : 'dialogue';
        this.shown = 0; this.tt = 0; this.typing = true;
        if (C) {
          C.play(L.expression, false);
          const a = C.sp.anims[C.sp.animName]; if (a) a.fps = G.clamp(24 - ((this.speed - 0.05) / 5) * 480, 12, 48);
        }
        sayLine(this.cur);
      },
      finish() { this.shown = this.line ? this.line.letters.length : 0; this.typing = false; },
      accept() {
        if (this.ending || this.done) return;
        if (this.typing) { this.finish(); if (voice[1]) voice[1].stop(); }       // (onSkipDialogue: the second copy stops)
        else if (this.cur >= lines.length - 1) this.end();
        else this.next();
        G.sfx(SND + 'dialogueClose.ogg', { vol: 1 });
      },
      end() {
        this.ending = true; this.line = null;
        const n = box.animName.replace(/Open$/, '') + 'Open';
        if (box.anims[n]) box.play(n, true, true);
        if (opt.music) G.audio.music.stop(1);
      },
      stop() { for (const v of voice.splice(0)) v.stop(0.2); },
      update(dt) {
        if (this.done) return;
        if (this.first) { this.first = false; return; }         // (ignoreThisFrame)
        box.update(dt);
        for (const C of chars) C.sp.update(dt);
        if (!this.ending) {
          this.bg = Math.min(0.5, this.bg + 0.5 * dt);
          if (box.finished && /Open$/.test(box.animName)) box.play(box.animName.replace(/Open$/, ''), true);
          const C = this.last;
          if (this.typing) {
            if (C && C.sp.finished) C.play(C.cur, false);               // (the talking loop restarts while typing)
            this.tt += dt;
            while (this.typing && this.tt >= this.speed) {
              this.tt -= this.speed;
              if (this.speed > 0.025 || this.shown % 2 === 0) G.sfx(SND + this.sound + '.ogg', { vol: 1 });
              this.shown++;
              if (this.shown >= this.line.letters.length) { this.typing = false; }
              this.tt = 0;
            }
          } else if (C && !C.idle && C.sp.finished) C.play(C.cur, true);
          for (const D of chars) {
            const on = D === this.last;
            if (D.where === 'center') D.y = on ? Math.max(D.start, D.y - 4000 * dt) : Math.min(D.start + G.H, D.y + 4000 * dt);
            else if (D.where === 'right') D.x = on ? Math.max(D.start, D.x - 4000 * dt) : Math.min(D.start + 600, D.x + 4000 * dt);
            else D.x = on ? Math.min(D.start, D.x + 4000 * dt) : Math.max(D.start - 600, D.x - 4000 * dt);
            D.alpha = G.clamp(D.alpha + (on ? 3 : -3) * dt, 0, 1);
          }
        } else {
          this.bg = Math.max(0, this.bg - 0.5 * dt);
          for (const D of chars) {
            if (D.where === 'center') D.y += 4000 * dt; else if (D.where === 'right') D.x += 4000 * dt; else D.x -= 4000 * dt;
            D.alpha = Math.max(0, D.alpha - 10 * dt);
          }
          const boxGone = !box.visible || (box.finished || box.frameIndex <= 0);
          if (boxGone) box.visible = false;
          if (!box.visible && this.bg <= 0) this.done = true;
        }
      },
      draw(ctx) {
        if (this.done) return;
        G.setScreenT(ctx);
        ctx.save(); ctx.globalAlpha = this.bg; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
        for (const D of chars) { if (D.alpha <= 0) continue; D.sp.x = D.x; D.sp.y = D.y; D.sp.alpha = D.alpha; D.sp.draw(ctx, null); }
        if (box.visible) {
          // updateBoxOffsets
          box.updateHitbox();
          const n = box.animName;
          if (n.startsWith('angry')) { box.offset.x = 50; box.offset.y = 65; } else if (n.startsWith('center-angry')) { box.offset.x = 50; box.offset.y = 30; } else { box.offset.x = 10; box.offset.y = 0; }
          if (!box.flipX) box.offset.y += 10;
          box.draw(ctx, null);
        }
        const L = this.line, sheet = G.Sparrow.load(LETTERS); if (!L || !sheet) return;
        G.setScreenT(ctx);
        const fi = Math.floor(G.time * 24), gy = 460 - (L.rows > 2 ? 24 : 0);
        for (let i = 0; i < this.shown && i < L.letters.length; i++) {
          const l = L.letters[i], f = l.frames[fi % l.frames.length];
          ctx.save(); ctx.translate(175 + l.x, gy + l.y); ctx.scale(TS, TS); G.Sparrow.draw(ctx, sheet, f); ctx.restore();
        }
      },
    };
    T.next();
    return T;
  }

  // ================================================================ cutscenes (story + freeplay, first try, BACK skips)
  const talk = (song, music) => ({
    enter(S) { S.black = 0; S.white = 0; S.dlg = Talk(song, S.P, { music }); },
    leave(S) { if (S.dlg && S.dlg.stop) S.dlg.stop(); },
  });
  // a world sprite drawn with the stage (behind the smog + foreground layers, like addLuaSprite)
  function worldSprite(S, sheet, x, y, z, scale) {
    const s = new G.Sprite(x, y).loadSparrow(sheet);
    if (scale && scale !== 1) { s.scale.x = s.scale.y = scale; s.updateHitbox(); }
    s.zIndex = z; S.P.stage.addExtra(s, null); (S.extras = S.extras || []).push(s);
    return s;
  }
  const dropSprites = S => { const ex = S.P.stage.extras; for (const s of S.extras || []) { const i = ex.indexOf(s); if (i >= 0) ex.splice(i, 1); } S.extras = []; };
  const camOn = (P, c) => { if (c && c.camFocus) P.cam.follow(c.camFocus.x, c.camFocus.y); };

  // ---- Lo-Fight (cutscene.lua)
  const loFight = {
    enter(S) {
      const P = S.P; S.tw = []; S.fade = { a: 1 };
      for (const c of [P.dad, P.bf, P.gf]) if (c) c.visible = false;
      const gfs = worldSprite(S, 'shared/images/characters/' + EX + '/gf-whitty', 1850, 650, 91, 1);
      gfs.addAnim('dancing', 'idle', 24, true, [12]); gfs.play('dancing', true);
      const bfs = worldSprite(S, 'shared/images/characters/' + EX + '/bf-whitty', 1650, 775, 92, 1.25);
      bfs.addAnim('idle', 'BF IDLE', 24, true, [0]); bfs.addAnim('response', 'BF UP', 24, false); bfs.play('idle', true);
      const w = worldSprite(S, IMG + 'cutscenes/whittyIntro', 260, 360, 93, 1.25);
      const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
      w.addAnim('startFrame', 'whittyIntro', 24, true, [0]); w.addAnim('tearPoster', 'whittyIntro', 24, false, R(0, 25));
      w.addAnim('burningPoster', 'whittyIntro', 24, false, R(26, 60)); w.addAnim('whittyHearsBF', 'whittyIntro', 24, false, R(61, 75));
      w.addAnim('whittyTurns', 'whittyIntro', 24, false, R(76, 102)); w.play('startFrame', true);
      S.bfs = bfs; S.w = w; S.city = null;
      S.tm = timers([
        [0.1, () => { tween(S.tw, S.fade, { a: 0 }, 2, E.ease); tween(S.tw, S.cam, { z: 0.8 }, 0.1, E.ease); camOn(P, P.dad); S.city = G.audio.voice(SND + 'lo-fight/citynight.ogg', { vol: 0.6 }); }],
        [2.5, () => w.play('tearPoster', true)],
        [2.75, () => G.sfx(SND + 'lo-fight/rip.ogg', { vol: 0.8 })],
        [4.5, () => { w.play('burningPoster', true); G.sfx(SND + 'lo-fight/fire.ogg', { vol: 0.8 }); }],
        [6.5, () => { w.play('whittyHearsBF', true); bfs.play('response', true); bfs.x = 1670; bfs.y = 725; G.sfx(SND + 'lo-fight/beepboop.ogg', { vol: 0.8 }); camOn(P, P.bf); tween(S.tw, S.cam, { z: 0.6 }, 0.5, E.smootherStepOut); }],
        [7.5, () => { w.play('whittyTurns', true); bfs.play('idle', true); bfs.x = 1650; bfs.y = 775; }],
        [9.25, () => tween(S.tw, S.fade, { a: 1 }, 1, E.ease)],
        [10.75, () => { tween(S.tw, S.fade, { a: 0 }, 2, E.ease); camOn(P, P.dad); for (const c of [P.dad, P.bf, P.gf]) if (c) c.visible = !(c.rawSpot && c.rawSpot.hidden); dropSprites(S); }],
      ]);
    },
    dur: 13,
    update(S, dt) { runTweens(S.tw, dt); S.tm.run(S.t); for (const s of S.extras || []) s.update(dt); },
    draw(S, ctx) { if (S.fade.a > 0) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,' + S.fade.a.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); } },
    leave(S) {
      dropSprites(S); if (S.city) S.city.stop(0.3);
      const P = S.P; for (const c of [P.dad, P.bf, P.gf]) if (c) c.visible = !(c.rawSpot && c.rawSpot.hidden);
    },
  };
  // ---- Overhead: black, fade in, the talk at 1.6 s
  const overhead = {
    enter(S) { S.fade = { a: 1 }; S.tw = []; },
    dur: 1.6,
    update(S, dt) { if (S.t >= 0.3 && !S.fadeOn) { S.fadeOn = true; tween(S.tw, S.fade, { a: 0 }, 1, E.ease); } runTweens(S.tw, dt); },
    draw(S, ctx) { if (S.fade.a > 0) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,' + S.fade.a.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); } },
  };
  // ---- Ballistic: the mod's video on black
  const video = {
    enter(S) {
      S.black = 0;
      const src = G.A.raw['videos/videos/' + EX + '-ballistic.webm'];
      if (!src) { S.vidDone = true; return; }
      const v = document.createElement('video'); v.src = src; v.playsInline = true; v.preload = 'auto';
      v.volume = Math.min(1, (G.settings.vol.master || 1) * (G.settings.vol.sfx == null ? 1 : G.settings.vol.sfx));
      v.onended = () => { S.vidDone = true; }; v.onerror = () => { S.vidDone = true; };
      const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; v.play().catch(() => { S.vidDone = true; }); });
      S.video = v; S.vidDone = false;
    },
    update(S) { if (S.t > 3 && S.video && S.video.readyState < 2) S.vidDone = true; if (S.vidDone) S.go(); },
    draw(S, ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      const v = S.video;
      if (v && v.readyState >= 2) { const s = Math.min(G.W / v.videoWidth, G.H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s; ctx.drawImage(v, (G.W - w) / 2, (G.H - h) / 2, w, h); }
    },
    leave(S) { if (S.video) { try { S.video.pause(); } catch (e) {} S.video = null; } },
  };
  // the pictures a talk + cutscene need, loaded with the song (none of them pops in later)
  function talkSheets(song) {
    const out = [G.Sparrow.load(G.A.imagePath('speech_bubble')), G.Sparrow.load(LETTERS)];
    const d = G.A.json(DATA + 'dialogue/' + song + '.json'), seen = {};
    for (const L of (d && d.dialogue) || []) {
      if (seen[L.portrait]) continue; seen[L.portrait] = 1;
      const cj = G.A.json(IMG + 'dialogue/' + String(L.portrait).toLowerCase() + '.json'); if (cj) out.push(G.Sparrow.load(IMG + 'dialogue/' + cj.image));
    }
    return out;
  }
  const CUTSHEETS = { 'lo-fight': [IMG + 'cutscenes/whittyIntro'], overhead: [], ballistic: [] };
  const sheetsOf = song => { const out = []; for (const sh of talkSheets(song).concat((CUTSHEETS[song] || []).map(p => G.Sparrow.load(p)))) if (sh) out.push(...(sh.imgs || [sh.img])); return out.filter(Boolean); };
  const scene = (song, steps) => P => { const sc = G.Scene(P, steps); sc.after = () => { for (const im of sheetsOf(song)) G.Pin.drop(im); }; return sc; };
  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes['lo-fight@erect'] = { create: scene('lo-fight', [loFight, talk('lo-fight', 'lo-fight/citynight.ogg')]) };
  G.Cutscenes['overhead@erect'] = { create: scene('overhead', [overhead, talk('overhead', 'lo-fight/citynight.ogg')]) };
  G.Cutscenes['ballistic@erect'] = { create: scene('ballistic', [video, talk('ballistic', 'ballistic/grit.ogg')]) };

  // ================================================================ in the songs
  // camera.lua: the camera leans toward every note (its side fully, the other side at 45%), easing back over 7 steps
  const LEAN = {
    reset(P) { const keep = P.er && P.er.scream; P.er = { tw: [], bf: { x: 0, y: 0 }, dad: { x: 0, y: 0 }, must: false, px: 30, fx: [], scream: keep }; const m = G.Songs.meta(P.song.id, 'erect'); if (m) P.er.px = m.playData.cameraLean || 30; P.cam.offX = P.cam.offY = 0; },
    event(P, e, v) { if (e === 'FocusCamera') P.er.must = String(v != null && typeof v === 'object' ? v.char : v) === '0'; },
    shift(P, who, lane) {
      const t = P.er[who], d = [[-1, 0], [0, 1], [0, -1], [1, 0]][lane]; t.x = d[0]; t.y = d[1];
      tween(P.er.tw, t, { x: 0, y: 0 }, P.cond.stepCrochet / 1000 * 7, E.outCubic);
    },
    playerHit(P, n) { LEAN.shift(P, 'bf', n.lane); },
    oppHit(P, n) { LEAN.shift(P, 'dad', n.lane); },
    update(P, dt) {
      const R = P.er; runTweens(R.tw, dt);
      const px = R.px, a = R.must ? px : px * 0.45, b = R.must ? px * 0.45 : px;
      P.cam.offX = R.bf.x * a + R.dad.x * b; P.cam.offY = R.bf.y * a + R.dad.y * b;
    },
  };
  // HUD + screen tweens the song scripts run (shared by the parts below)
  const FX = {
    reset(P) { P.er.fx = []; P.er.black = 0; P.er.white = 0; },
    update(P, dt) { runTweens(P.er.fx, dt); },
    drawOver(ctx, P) {
      if (P.er.black > 0) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, P.er.black).toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
      if (P.er.white > 0) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, P.er.white).toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
    },
  };
  const strums = (P, line) => (line == null ? P.lines : [P.lines[line]]).reduce((a, L) => a.concat(L ? L.strums : []), []);
  // Lo-Fight (lofightSpecialEvents.lua): everything hidden, the arrows fade in on step 23, the health bar on 32;
  // at the end the HUD fades out, then the screen
  const LOFIGHT = {
    reset(P) { for (const s of strums(P)) s.mal = 0; P.hudParts.health.alpha = 0; P.hudParts.time.alpha = 0; },
    step(P, st) {
      if (st === 23) for (const s of strums(P)) tween(P.er.fx, s, { mal: 1 }, 2, E.smootherStepOut);
      if (st === 32) tween(P.er.fx, P.hudParts.health, { alpha: 1 }, 2, E.smootherStepOut);
      if (st === 1376) tween(P.er.fx, P.hudParts, { all: 0 }, 2, E.smootherStepOut);
      if (st === 1388) tween(P.er.fx, P.er, { black: 1 }, 3.7, E.smootherStepOut);
    },
  };
  // Overhead: ColoredApple turns everyone white (GF grey) on black (custom colours for this song in the mod)
  const OVERHEAD = { reset(P) { P.appleColors = { bf: '#FFFFFF', dad: '#FFFFFF', gf: '#969696' }; } };
  // Ballistic
  const BALLISTIC = {
    setup(P) { G.Sparrow.load(IMG + 'cutscenes/whittyScream'); G.A.image(IMG + 'stages/alley-ballistic/angry.png'); },
    prepare(P, tex) {
      const sh = G.Sparrow.load(IMG + 'cutscenes/whittyScream'); if (sh) for (const im of sh.imgs || [sh.img]) tex.add(im);
      const a = G.A.image(IMG + 'stages/alley-ballistic/angry.png'); if (a) tex.add(a);
    },
    reset(P) {
      // the arrows + health bar start off screen, the time bar above it (they slide in on beat 7)
      for (const s of strums(P)) s.my = (P.down ? 770 : -150) - s.by;
      P.hudParts.health.dy = P.down ? -229 : 131; P.hudParts.time.dy = P.down ? 85 : -177;
      if (!P.er.scream || !P.stage.extras.includes(P.er.scream)) {     // (a new song = a new stage)
        const s = new G.Sprite(-225, 250).loadSparrow(IMG + 'cutscenes/whittyScream');
        s.scale.x = s.scale.y = 1.25; s.updateHitbox();
        s.addAnim('loop', 'intro', 24, true); s.play('loop', true); s.zIndex = 90; s.visible = false;
        P.stage.addExtra(s, null); P.er.scream = s;
      }
      P.er.scream.visible = false; P.er.glitch = 0;
      const smog = P.stage.props.find(p => p.name === 'smog'); if (smog) smog.alpha = 1;
    },
    beat(P, b) {
      const R = P.er, ss = 'smootherStepOut', e = E[ss];
      if (b === 7) {
        for (const s of strums(P)) tween(R.fx, s, { my: 0 }, 2, e);
        tween(R.fx, P.hudParts.health, { dy: 0 }, 2, e); tween(R.fx, P.hudParts.time, { dy: 0 }, 2, e);
      }
      if (b === 366) { P.dad.visible = false; R.scream.visible = true; P.cam.followRate = 0.04 * 7; }
      if (b === 368) { P.dad.visible = true; R.scream.visible = false; P.cam.followRate = 0.04; }
      if (b === 432) R.black = 1;
      if (b === 433) tween(R.fx, R, { white: 1 }, 1.1, e);
      if (b === 436) { tween(R.fx, R, { white: 0 }, 0.6, e); R.black = 0; }
      if (b === 500) { for (const s of strums(P, 0)) tween(R.fx, s, { mal: 0 }, 2, e); tween(R.fx, P.hudParts.health, { alpha: 0 }, 2, e); tween(R.fx, P.hudParts.time, { alpha: 0 }, 2, e); }
      if (b === 515) for (const s of strums(P, 1)) tween(R.fx, s, { mx: -320 }, 2, e);
      if (b === 660) { for (const s of strums(P, 0)) tween(R.fx, s, { mal: 1 }, 2, e); tween(R.fx, P.hudParts.health, { alpha: 1 }, 2, e); tween(R.fx, P.hudParts.time, { alpha: 1 }, 2, e); }
      if (b === 662) for (const s of strums(P, 1)) tween(R.fx, s, { mx: 0 }, 0.5, e);
      if (b === 728) { R.black = 1; const smog = P.stage.props.find(p => p.name === 'smog'); if (smog) smog.alpha = 0; }
      if (b === 732) tween(R.fx, P.hudParts, { all: 0 }, 2, e);
    },
    // camShake.lua + opponentSingShader.lua: every one of his notes shakes the camera, half of them glitch it
    oppHit(P) {
      P.cam.shake(0.01, 0.1);
      if (Math.random() < 0.5 && G.settings.quality !== 'low' && flashOn()) { P.er.glitch = 0.022 * (Math.random() * 4 - 2); P.er.glitchT = 0.3; P.er.glitch0 = P.er.glitch; }
    },
    update(P, dt) {
      const R = P.er; if (R.scream) R.scream.update(dt);
      if (R.glitchT > 0) { R.glitchT = Math.max(0, R.glitchT - dt); R.glitch = R.glitch0 * (R.glitchT / 0.3); }
    },
    // the glitch: a few pixels of red / cyan split over the world (the shader's spectrum smear, 0.05 x GLITCH of the
    // screen wide), drawn through two screen-sized copies only while it's on
    drawOver(ctx, P) {
      const g = P.er.glitch; if (!g || Math.abs(g) < 0.002) return;
      const W = ctx.canvas.width, H = ctx.canvas.height, d = Math.round(0.05 * g * W * 1.5) || (g > 0 ? 1 : -1);
      let A = BALLISTIC._c; if (!A || A[0].width !== W || A[0].height !== H) A = BALLISTIC._c = [0, 1].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; });
      const [r, c] = A, rx = r.getContext('2d'), cx = c.getContext('2d');
      for (const [x, col] of [[rx, '#FF0000'], [cx, '#00FFFF']]) {
        x.globalCompositeOperation = 'source-over'; x.drawImage(ctx.canvas, 0, 0);
        x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H);
      }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(c, -d, 0);
      ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(r, d, 0); ctx.restore();
    },
    // whittyAngryOverlay.lua: the red vignette on the HUD, alpha = health - 0.2
    drawTop(ctx, P) {
      const im = G.A.image(IMG + 'stages/alley-ballistic/angry.png'); if (!im || P.cutscene) return;
      const a = G.clamp(P.health - 0.2, 0, 1) * P.hud.alpha * P.hudParts.all; if (a <= 0) return;
      P.hud.apply(ctx); ctx.save(); ctx.globalAlpha = a; ctx.drawImage(im, -70, -80, im.width * 0.5, im.height * 0.5); ctx.restore();
    },
  };

  function combine(...parts) {
    const o = {};
    for (const k of ['setup', 'reset', 'update', 'beat', 'step', 'event', 'oppHit', 'playerHit', 'drawOver', 'drawTop', 'prepare']) {
      const fns = parts.map(p => p[k]).filter(Boolean);
      if (fns.length) o[k] = (...a) => { for (const f of fns) f(...a); };
    }
    const cut = parts.find(p => p.cut);
    if (cut) {   // (the cutscene's pictures load with the song, first try only)
      const prev = o.prepare, prevS = o.setup;
      o.setup = (P, ...a) => { if (prevS) prevS(P, ...a); if (!P.params.deaths && !P.params.noCutscene) sheetsOf(cut.cut); };
      o.prepare = (P, tex) => { if (prev) prev(P, tex); if (!P.params.deaths && !P.params.noCutscene) for (const im of sheetsOf(cut.cut)) tex.add(im); };
    }
    o.maxZoom = () => 1.2;
    return o;
  }
  G.SongFX = G.SongFX || {};
  G.SongFX['lo-fight@erect'] = combine(LEAN, FX, LOFIGHT, { cut: 'lo-fight' });
  G.SongFX['overhead@erect'] = combine(LEAN, FX, OVERHEAD, { cut: 'overhead' });
  G.SongFX['ballistic@erect'] = combine(LEAN, FX, BALLISTIC, { cut: 'ballistic' });
})();
