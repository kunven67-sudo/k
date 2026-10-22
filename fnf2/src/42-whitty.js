// FNF 2 - VS Whitty (Sock.clip, Nateanimate, KadeDev + team; the "Definitive Edition", V-Slice port by jarekboho),
// played like the mod:
//   Lo-Fight     Whitty lights his cigarette in the alley (the startup animation, city sounds, the camera sliding over
//                to BF who beeps at him), then the talk
//   Overhead     the talk; the arrows pop in one by one when the song starts; the camera bops harder and harder
//   Ballistic    he LOSES IT: the transformation (mic breaks, the alley catches fire, white out), the talk, then the
//                song with the red cracked screen, the camera locked on fixed spots and shaking on every one of his
//                notes; in story mode the joke end picture
//   Underground  the swag guys (the characters swap mid-song, the club walls change), the joke end picture in story mode
//   Low-Rise, Hungry, Faucet, Ballistic Remix + SiIvaGunner's "High Quality Rip" versions of everything (the Hotline
//   Miami talk + pixel ratings in Ballistic HQ, the Slam ratings in the Beta Mix)
// The talk boxes are Psych Engine's (DialogueBoxPsych + typed Alphabet text), like the Definitive Edition had.
// The song events (camera zooms, character swaps...) are in 16-mod-events.js. Art, songs, charts + talk come from the
// mod (tools/own/whitty.py, private build only).
(function () {
  const IMG = 'preload/images/', SND = 'preload/sounds/', MUS = 'preload/music/', CONV = 'preload/data/dialogue/';
  const E = {
    linear: t => t, sineInOut: t => -(Math.cos(Math.PI * t) - 1) / 2, sineOut: t => Math.sin(t * Math.PI / 2),
    circIn: t => 1 - Math.sqrt(1 - t * t), expoOut: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  };
  const flashOn = () => G.settings.flashing !== false;
  const isStory = P => P.params && P.params.mode === 'story';

  // a tiny FlxTween: tween(list, obj, {key: to}, seconds, ease, {delay, done}); a new tween of a key replaces the old
  function tween(list, obj, to, d, ease, o) {
    for (const k in to) for (const w of list) if (w.obj === obj && w.key === k) w.dead = true;
    for (const k in to) list.push({ obj, key: k, a: null, b: to[k], t: 0, d: Math.max(1e-6, d), e: ease || E.linear, delay: (o && o.delay) || 0, done: o && o.done });
  }
  function runTweens(list, dt) {
    for (const w of list) {
      if (w.dead) continue;
      w.t += dt; if (w.t < w.delay) continue;
      if (w.a == null) w.a = w.obj[w.key];
      const k = Math.min(1, (w.t - w.delay) / w.d);
      w.obj[w.key] = w.a + (w.b - w.a) * w.e(k);
      if (k >= 1) { w.dead = true; if (w.done) w.done(); }
    }
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead) list.splice(i, 1);
  }
  // timers: [[seconds, fn], ...] fired once each as t passes them
  function timers(list) { return { list: list.map(x => ({ at: x[0], fn: x[1], done: false })), run(t) { for (const x of this.list) if (!x.done && t >= x.at) { x.done = true; x.fn(); } } }; }

  // ================================================================ Psych Engine's talk box (DialogueBoxPsych)
  // the old FNF Alphabet (not bold), typed at the line's speed with the 'dialogue' blip per letter
  const ALPHA = 'preload/images/alphabet', TS = Math.floor(39 * 0.7) / 39;      // (letter scale: setGraphicSize(int(39 * 0.7)))
  const SYM = { '.': 'period', "'": 'apostraphie', '?': 'question mark', '!': 'exclamation point', ',': 'comma', '#': 'hashtag' };
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz', NUMBERS = '1234567890', SYMBOLS = "|~#$%()*+-:;<=>@[]^_.,'!?";
  // where every letter of a line lands + on which tick it shows up (AlphabetWhitty.timerCheck, done ahead of time)
  function layout(text) {
    const sheet = G.Sparrow.load(ALPHA), ch = text.split(''), out = [];
    let loop = 0, xPos = 0, row = 0, spaces = 0, lastW = null, reset = false, liftTick = -1, tick = 0;
    while (loop < ch.length) {
      if (loop <= ch.length - 2 && ch[loop] === '\\' && ch[loop + 1] === 'n') { loop += 2; reset = true; xPos = 0; row++; if (row === 2) liftTick = tick; }
      else if (xPos >= G.W * 0.65 && ch[loop] === ' ') { loop += 1; reset = true; xPos = 0; row++; if (row === 2) liftTick = tick; }
      const c = ch[loop];
      if (c != null) {
        if (c === ' ') spaces++;
        const lower = c.toLowerCase(), isL = LETTERS.includes(lower), isN = NUMBERS.includes(c), isS = SYMBOLS.includes(c);
        if (isL || isN || isS) {
          if (lastW != null && !reset) xPos += lastW + 3; else reset = false;
          if (spaces > 0) xPos += 20 * spaces * 0.7;
          spaces = 0;
          const pre = isL ? c + ' ' + (lower !== c ? 'capital' : 'lowercase') : isN ? c : (SYM[c] || c);
          const fr = sheet ? G.Sparrow.byPrefix(sheet, pre) : [];
          const f0 = fr[0], w = f0 ? f0.fw * TS : 30, h = f0 ? f0.fh * TS : 40;
          let y = 110 - h + row * 60;
          if (c === "'") y -= 20; else if (c === '-') y -= 16;
          if (fr.length) out.push({ frames: fr, x: xPos + 90, y, tick, row });
          lastW = w;
        }
      }
      loop++; tick++;
    }
    return { letters: out, ticks: tick, liftTick };
  }

  function PsychTalk(id, P, opt) {
    opt = opt || {};
    const data = G.A.json(CONV + 'conversations/' + id + '.json');
    const boxData = G.A.json(CONV + 'boxes/dialogueboxpsych.json') || { animations: [] };
    const lines = data ? data.dialogue : [];
    const box = new G.Sprite(70, 370).loadSparrow(G.A.imagePath('speech_bubble'));
    for (const a of boxData.animations) box.addAnim(a.name, a.prefix, a.frameRate || 24, !!a.looped);
    box.scale.x = box.scale.y = 0.9;
    // portraits: where each one's script puts it (+ which side it talks from)
    const SPOT = { whiteog: [70, 0], 'whiteog-pissed': [120, 20], whiteogballs: [30, 20], 'whitesg-pissed': [-322, 20], bf: [778, 110] };
    const speakers = {};
    const speaker = sid => {
      if (speakers[sid]) return speakers[sid];
      const d = G.A.json(CONV + 'speakers/' + sid + '.json'); if (!d) return null;
      const sp = new G.Sprite(0, 0).loadSparrow(G.A.imagePath(d.assetPath));
      const ao = {};
      for (const a of d.animations || []) { sp.addAnim(a.name, a.prefix, a.frameRate || 24, !!a.looped); ao[a.name] = a.offsets || [0, 0]; }
      sp.scale.x = sp.scale.y = 0.7 * (d.scale || 1);   // (around the middle of its first frame, like setGraphicSize)
      sp.alpha = 0;
      const pos = SPOT[sid] || [70, 0], left = sid.includes('whit');
      const S = { id: sid, sp, ao, left, x0: pos[0], y0: pos[1], x: pos[0] + (left ? -600 : 600) };
      S.play = n => { if (!sp.anims[n]) return; sp.play(n, true); const o = ao[n] || [0, 0]; sp.offset.x = o[0]; sp.offset.y = o[1]; };
      return (speakers[sid] = S);
    };
    const music = opt.music !== undefined ? opt.music : data && data.music && data.music.asset ? MUS + data.music.asset + '.ogg' : null;
    if (music) G.audio.music.play(music, { loop: true, vol: 1, fadeIn: 2, restart: true });
    const T = {
      done: false, i: -1, bg: 0, ending: false, endT: 0, cur: null, lastSpk: null, lastBox: null, line: null, shown: 0, tt: 0, typing: false,
      next() {
        this.i++;
        if (this.i >= lines.length) { this.end(); return; }
        const L = lines[this.i], spk = speaker(L.speaker), bt = L.boxAnimation || 'normal';
        if (spk && spk !== this.cur) {
          box.play(bt + 'Open', true); box.flipX = spk.left;
        } else if (bt !== this.lastBox) box.play(bt, true);
        this.lastBox = bt;
        this.cur = spk;
        if (spk) spk.play(L.speakerAnimation || 'talkLoop');
        this.line = layout((L.text || [''])[0] || ''); this.speed = L.speed || 0.05;
        this.shown = 0; this.tt = -0.1; this.typing = true;      // (first letter after 0.1 s)
      },
      finishLine() {
        this.shown = this.line.ticks; this.typing = false;
        if (this.cur) { const n = this.cur.sp.animName.replace(/Loop$/, ''); if (n !== this.cur.sp.animName) this.cur.play(n); }
      },
      accept() {
        if (this.ending || this.done) return;
        G.sfx(SND + 'dialogueClose.ogg', { vol: 0.8 });
        if (this.typing) { this.finishLine(); G.sfx(SND + 'dialogue.ogg', { vol: 0.8 }); }
        else this.next();
      },
      end() {
        this.ending = true; this.line = null;
        const n = box.animName.replace(/Open$/, '') + 'Open';
        if (box.anims[n]) box.play(n, true, true);
        if (music) G.audio.music.stop(1);
      },
      update(dt) {
        if (this.done) return;
        box.update(dt);
        if (!this.ending) {
          this.bg = Math.min(0.5, this.bg + 0.5 * dt);
          // the loop after the box finishes opening
          if (box.finished && box.animName.endsWith('Open')) box.play(box.animName.replace(/Open$/, ''), true);
          if (this.typing) {
            this.tt += dt;
            while (this.tt >= this.speed && this.typing) {
              this.tt -= this.speed; this.shown++;
              if (this.line.letters.some(l => l.tick === this.shown - 1)) G.sfx(SND + 'dialogue.ogg', { vol: 0.8 });
              if (this.shown >= this.line.ticks) this.finishLine();
            }
          }
        } else {
          this.bg = Math.max(0, this.bg - 0.5 * dt);
          if (this.bg <= 0) this.done = true;
        }
        // portraits slide in (4000 px/s) + fade in, the others slide away
        for (const k in speakers) {
          const S = speakers[k], on = S === this.cur && !this.ending, out = S.x0 + (S.left ? -600 : 600);
          S.sp.update(dt);
          if (on) { S.x = S.left ? Math.min(S.x0, S.x + 4000 * dt) : Math.max(S.x0, S.x - 4000 * dt); S.sp.alpha = Math.min(1, S.sp.alpha + 3 * dt); }
          else { S.x = S.left ? Math.max(out, S.x - 4000 * dt) : Math.min(out, S.x + 4000 * dt); S.sp.alpha = Math.max(0, S.sp.alpha - 3 * dt); }
        }
      },
      draw(ctx) {
        if (this.done) return;
        G.setScreenT(ctx);
        ctx.save(); ctx.globalAlpha = this.bg; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
        for (const k in speakers) { const S = speakers[k]; if (S.sp.alpha <= 0) continue; S.sp.x = S.x; S.sp.y = S.y0; S.sp.draw(ctx, null); }
        if (!(this.ending && box.finished)) {
          // updateBoxOffsets: centred, then pushed by the box type
          box.updateHitbox();
          const n = box.animName;
          if (n.startsWith('angry')) { box.offset.x = 50; box.offset.y = 65; } else if (n.startsWith('center-angry')) { box.offset.x = 50; box.offset.y = 30; } else { box.offset.x = 10; box.offset.y = 0; }
          if (!box.flipX) box.offset.y += 10;
          box.draw(ctx, null);
        }
        const L = this.line; if (!L) return;
        const sheet = G.Sparrow.load(ALPHA); if (!sheet) return;
        G.setScreenT(ctx);
        const fi = Math.floor(G.time * 24), gy = 430 + (L.liftTick >= 0 && this.shown > L.liftTick ? -24 : 0);   // (row 3: the text moves up)
        for (const l of L.letters) {
          if (l.tick >= this.shown) break;
          const f = l.frames[fi % l.frames.length];
          ctx.save(); ctx.translate(90 + l.x, gy + l.y); ctx.scale(TS, TS);
          G.Sparrow.draw(ctx, sheet, f); ctx.restore();
        }
      },
      textures() {
        const out = new Set();
        const add = sh => { if (sh) for (const im of sh.imgs || []) out.add(im); };
        add(box.sheet); add(G.Sparrow.load(ALPHA));
        for (const L of lines) { const s = speaker(L.speaker); if (s) add(s.sp.sheet); }
        return out;
      },
    };
    T.next();
    return T;
  }

  // ================================================================ the Hotline Miami talk (Ballistic HQ, dialogueboxhm.hxc)
  const MIAMI_LINES = [
    'ENOUGH.', 'YOU THINK THIS IS FUCKING FUNNY? PUSHING ME TO MY ABSOLUTE GODDAMN LIMIT?!', 'BEEP BOP. BIDOOP BA.',
    'I SEE HOW IT IS THEN.', "YOU'RE NOTHING BUT A MONSTER.", 'A COLD, LIFELESS SHITHEEL WITHOUT SYMPATHY OR MORALS.',
    "I'LL TAKE YOU OUT RIGHT WHERE YOU STAND.", 'SAY YOUR PRAYERS, ASSHOLE.',
  ];
  function MiamiTalk(id, P, opt, S) {
    const data = G.A.json(CONV + 'conversations/' + id + '.json'), lines = data ? data.dialogue : [];
    const tw = [];
    const head = sheet => { const s = new G.Sprite(0, 0).loadSparrow(G.A.imagePath(sheet)); s.addAnim('talk', 'talk', 20, true); s.play('talk', true); s.antialias = false; s.scale.x = s.scale.y = 6; s.updateHitbox(); return s; };
    const heads = { whit: head('dialogue/whittyall'), bf: head('dialogue/bfall') };
    const shadows = { whit: head('dialogue/whittyall'), bf: head('dialogue/bfall') };
    const M = {
      done: false, i: -1, t: 0, who: null, ending: false, endT: 0,
      grad: { x: G.W }, top: { y: -64.25 }, bot: { y: 716.625 }, spk: { x: 888 + 488 }, text: { a: 0 },
      next() {
        this.i++;
        if (this.i >= lines.length) { this.end(); return; }
        const L = lines[this.i], who = String(L.speaker || '').includes('whit') ? 'whit' : 'bf';
        if (who !== this.who) {
          this.who = who;
          // the camera swings over to whoever talks, the speaker slides in, the gradient slides in again
          P.cam.follow(...(who === 'whit' ? [600, 300] : [1200, 600]));
          this.spk.x = 888 + 488; tween(tw, this.spk, { x: 888 }, 0.3);
          this.grad.x = G.W; tween(tw, this.grad, { x: G.W - 488 }, 0.3);
        }
        this.text.a = 0; tween(tw, this.text, { a: 1 }, 10 / 60);
        this.line = MIAMI_LINES[this.i] || '';
      },
      accept() { if (this.ending || this.done) return; G.sfx(SND + 'dialogueClose.ogg', { vol: 0.8 }); this.next(); },
      end() {
        this.ending = true;
        tween(tw, this.grad, { x: G.W }, 0.3); tween(tw, this.spk, { x: 888 + 488 }, 0.3);
        tween(tw, this.top, { y: -184.75 }, 0.3); tween(tw, this.bot, { y: 716.625 }, 0.3);
      },
      update(dt) {
        if (this.done) return;
        this.t += dt; runTweens(tw, dt);
        for (const k in heads) { heads[k].update(dt); shadows[k].update(dt); }
        if (this.ending) { this.endT += dt; if (this.endT >= 1) this.done = true; }
        // the characters bop to the beat while they talk (the conversation's fakeDance timer)
        const beat = Math.floor(this.t / (P.cond.crochet / 1000));
        if (beat !== this.lastBeat) { this.lastBeat = beat; for (const c of [P.bf, P.dad]) if (c) c.dance(true); }
      },
      draw(ctx) {
        if (this.done) return;
        G.setScreenT(ctx);
        const ms = this.t * 1000, gw = Math.sin((ms / 750) * Math.PI / 4), hx = n => Math.max(0, Math.min(255, Math.floor(n)));
        // the gradient on the right: blue, + yellow-green on top (added) changing colour
        const gb = G.A.image(IMG + 'ui/popup/hm/gradblu.png'), gy = G.A.image(IMG + 'ui/popup/hm/gradylw.png');
        ctx.imageSmoothingEnabled = false;
        if (gb) ctx.drawImage(gb, this.grad.x, 0);
        if (gy) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          G.imgFilter = 'mul:rgb(' + hx(120 * gw + 135) + ',' + hx(120 * -gw + 135) + ',0)';
          try { ctx.drawImage(G.srcImg(gy), this.grad.x, 0); } finally { G.imgFilter = null; }
          ctx.restore();
        }
        // the bars (a 1 x 75 strip stretched)
        const bar = G.A.image(IMG + 'ui/popup/hm/dialbg.png');
        if (bar) { ctx.drawImage(bar, 0, this.top.y, G.W, 75 * 2.5); ctx.drawImage(bar, 0, this.bot.y, G.W, 75 * 2.75); }
        ctx.imageSmoothingEnabled = true;
        // the speaker's pixel head (+ its shadow), wobbling
        const k = this.who || 'whit', hw = Math.sin(ms / 500 * Math.PI / 4) * 5;
        const sh = shadows[k], hd = heads[k];
        sh.x = this.spk.x + 5; sh.y = 128 + 8; sh.angle = hw; sh.alpha = 0.5;
        G.imgFilter = 'mul:#000000'; try { sh.draw(ctx, null); } finally { G.imgFilter = null; }
        hd.x = this.spk.x; hd.y = 128; hd.angle = hw; hd.draw(ctx, null);
        // the text: magenta with a cyan copy wobbling over it (shown once the bottom bar is in)
        if (this.line && !this.ending && this.bot.y <= 535.7) {
          const tp = Math.sin(ms / 200 * Math.PI / 4), size = 16 * 2.3, x = 70, y = G.H * 0.8 - 4;
          const c1 = 'rgb(' + hx(111 * gw + 143) + ',' + hx(64 * -gw + 64) + ',' + hx(64 * gw + 191) + ')', c2 = 'rgb(' + hx(64 * -gw + 191) + ',255,255)';
          const font = "'lilliput-steps', " + G.FONT.vcr;
          for (const [col, dx, dy] of [[c1, 0, 0], [c2, -3 - tp * 1.5 - 4.5, -2.5 - tp * 1.25 - 3.75]]) {
            const words = this.line.split(' '), rows = []; let cur = '';
            ctx.save(); ctx.font = size + 'px ' + font;
            for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > 495 * 2.3 && cur) { rows.push(cur); cur = w; } else cur = t; }
            rows.push(cur); ctx.restore();
            rows.forEach((r, j) => G.text(ctx, r, x + dx, y + dy + j * size * 1.1, { size, font, color: col, alpha: this.text.a, baseline: 'top' }));
          }
        }
      },
      textures() { const out = new Set(); for (const k in heads) for (const im of heads[k].sheet.imgs || []) out.add(im); return out; },
    };
    // (the bars + the first speaker come in right away)
    tween(tw, M.bot, { y: 535.625 }, 0.3);
    if (S && S.cam) tween(tw, S.cam, { z: 0.75 }, 1, E.sineOut);           // (the camera eases out to 0.75)
    M.next();
    return M;
  }

  // ================================================================ cutscenes
  const talk = (id, opt) => ({ enter(S) { S.black = 0; S.white = 0; S.dlg = (id.includes('(hq)') && id.startsWith('ballistic') ? MiamiTalk : PsychTalk)(id, S.P, opt, S); } });
  const stopMusic = { enter() { G.audio.music.stop(1); }, dur: 0 };
  // a world sprite the cutscene plays (Whitty lighting up / losing it), drawn over the stage like PlayState.add
  function cutSprite(S, sheet, prefix, x, y) {
    const s = new G.Sprite(x, y).loadSparrow(G.A.imagePath(sheet));
    s.addAnim('a', prefix, 24, false); s.play('a', true);
    S.spr = s; return s;
  }
  const drawSpr = (S, ctx) => { if (S.spr && S.spr.visible) S.spr.draw(ctx, S.P.cam); };
  // the camera during a cutscene: a follow point the camera eases to (Flixel lerp) + tweened zoom + angle
  const camTo = (S, x, y) => { S.fp.x = x; S.fp.y = y; };

  // ---- Lo-Fight (lo-fight.hxc): Whitty's startup animation in the alley
  const loFight = hq => ({
    enter(S) {
      const P = S.P;
      cutSprite(S, (hq ? 'hqr/' : '') + 'whittyCutscene', 'Whitty Cutscene Startup', -200, -90);
      P.dad.visible = false;
      S.black = 1;                                                                // (camera.flash black, 1 s)
      G.audio.music.play(MUS + 'city.ogg', { loop: true, vol: 1, fadeIn: 1.67, restart: true });
      S.fp = { x: 100, y: 200 }; P.cam.focus(100, 200); S.cam.z = 1.5; S.tw = [];
      tween(S.tw, S.cam, { z: 1.3 }, 2.5); tween(S.tw, S.fp, { x: 250 }, 2.5);
      S.tm = timers([
        [34 / 24, () => G.sfx(SND + 'rip.ogg', { vol: 1 })],
        [41 / 24, () => G.sfx(SND + 'fire.ogg', { vol: 1 })],
        [147 / 24, () => { P.bf.playAnim('singLEFT', true); P.bf._locked = true; G.sfx(SND + 'beepboop.ogg', { vol: 1 }); }],
        [150 / 24, () => { tween(S.tw, S.fp, { x: 960, y: 460 }, 1, E.sineInOut); tween(S.tw, S.cam, { z: 0.75 }, 1, E.sineInOut); }],
        [170 / 24, () => { P.bf._locked = false; P.bf.playAnim('idle', true); }],
      ]);
    },
    dur: 224 / 24 + 0.1,
    update(S, dt) {
      S.black = Math.max(0, 1 - S.t); runTweens(S.tw, dt); S.tm.run(S.t); S.spr.update(dt);
      S.P.cam.follow(S.fp.x, S.fp.y);
    },
    draw: drawSpr,
    leave(S) { S.P.dad.visible = true; S.spr = null; S.P.bf._locked = false; },
  });

  // ---- Ballistic (ballistic.hxc): he loses it
  const ballistic = hq => ({
    enter(S) {
      const P = S.P, stage = P.stage.props.find(p => p.name === 'stage');
      cutSprite(S, (hq ? 'hqr/' : '') + 'cuttinDeezeBalls', 'Whitty Ballistic Cutscene', -400, -100);
      P.dad.visible = false;
      S.fp = { x: 600, y: 300 }; P.cam.focus(600, 300); S.cam.z = 1.2; S.ang = { a: 0 }; S.tw = [];
      P.cam.shake(0.001, 2);
      tween(S.tw, S.cam, { z: 1.4 }, 2); tween(S.tw, S.ang, { a: 3 }, 2);
      G.sfx(SND + 'windLmao.ogg', { vol: 1 });
      if (stage) stage.play('BallisticBackgroundStart', true);
      S.tm = timers([
        [52 / 24, () => { G.sfx(SND + 'micBreak.ogg', { vol: 1 }); P.cam.shake(0.004, 0.2); tween(S.tw, S.cam, { z: 1.5 }, 0.4, E.circIn); }],
        [80 / 24, () => { tween(S.tw, S.ang, { a: 0 }, 0.1, E.circIn); tween(S.tw, S.fp, { y: 250 }, 0.3); }],
        [86 / 24, () => { tween(S.tw, S.fp, { y: 350 }, 0.3); G.sfx(SND + 'slammin.ogg', { vol: 1 }); }],
        [87 / 24, () => G.sfx(SND + (hq ? 'micThrow-hqr' : 'micThrow') + '.ogg', { vol: 1 })],
        [123 / 24, () => { tween(S.tw, S.fp, { y: 300 }, 1.4); if (hq) G.audio.music.play(SND + 'rumb-hqr.ogg', { loop: false, vol: 1, restart: true }); else G.sfx(SND + 'rumb.ogg', { vol: 1 }); }],
        [128 / 24, () => { if (stage) stage.play('BallisticBackgroundGo', false); G.sfx(SND + 'souljaboyCrank.ogg', { vol: 1 }); P.cam.shake(0.01, 0.2); }],
        [155 / 24, () => { tween(S.tw, S.cam, { z: 1 }, 0.1, E.circIn); tween(S.tw, S.ang, { a: -3 }, 0.1, E.circIn); }],
        [158 / 24, () => { G.sfx(SND + 'ouchMyToe.ogg', { vol: 1 }); P.cam.shake(flashOn() ? 0.05 : 0.01, 3.5); tween(S.tw, S.cam, { z: 0.9 }, 3.5, E.sineOut); tween(S.tw, S.ang, { a: 0 }, 0.1, E.circIn); }],
      ]);
    },
    dur: 10.1,
    update(S, dt) {
      runTweens(S.tw, dt); S.tm.run(S.t); S.spr.update(dt);
      S.P.cam.angle = S.ang.a; S.P.cam.follow(S.fp.x, S.fp.y);
      S.white = S.t >= 2 + 158 / 24 ? Math.min(1, S.t - (2 + 158 / 24)) : 0;     // (camGame.fade white, 1 s)
    },
    draw: drawSpr,
    leave(S) {
      const P = S.P, stage = P.stage.props.find(p => p.name === 'stage');
      P.cam.angle = 0; S.spr = null; P.dad.visible = true;
      if (stage) stage.play('BallisticBackground', true);
    },
  });
  // the white flash after it (0.8 s), then the talk
  const flash = { enter(S) { S.white = 1; }, dur: 0.8, update(S) { S.white = Math.max(0, 1 - S.t / 0.8); } };

  // ---- the joke picture at the end of the week in story mode (ballistic.hxc / underground.hxc onSongEnd)
  const endPic = pic => P => !isStory(P) ? null : G.Scene(P, [
    { enter(S) { S.black = 0; }, dur: 1, update(S) { S.black = Math.min(1, S.t); } },
    {
      enter(S) { S.pic = G.A.image(IMG + pic + '.png'); },
      skippable: true,
      update(S) { S.black = Math.max(0, 1 - S.t); },
      draw(S, ctx) { G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); if (S.pic) G.drawFit(ctx, G.srcImg(S.pic)); },
    },
  ]);

  // a cutscene's big pictures are loaded with the song and let go of (graphics card) once it's over
  // ('alphabet' = the talk box's typed letters: a 4 MB sheet, so it isn't ready from boot)
  const SHEETS = {
    'lo-fight': ['whittyCutscene', 'speech_bubble', 'alphabet', 'dialogue/whiteog_dialogue', 'dialogue/whiteog_pissed_dialogue', 'dialogue/bf_dialogue'],
    'lo-fight-(hq)': ['hqr/whittyCutscene', 'speech_bubble', 'alphabet', 'dialogue/whiteog_dialogue', 'dialogue/whiteog_pissed_dialogue', 'dialogue/bf_dialogue'],
    overhead: ['speech_bubble', 'alphabet', 'dialogue/whiteog_pissed_dialogue', 'dialogue/bf_dialogue'],
    'overhead-(hq)': ['speech_bubble', 'alphabet', 'dialogue/talk_portraits', 'dialogue/bf_dialogue'],
    ballistic: ['cuttinDeezeBalls', 'speech_bubble', 'alphabet', 'dialogue/whiteog_balls_dialogue', 'dialogue/bf_dialogue'],
    'ballistic-(hq)': ['hqr/cuttinDeezeBalls', 'dialogue/whittyall', 'dialogue/bfall'],
  };
  const imgsOf = id => { const out = []; for (const n of SHEETS[id] || []) { const sh = G.Sparrow.load(IMG + n); if (sh) out.push(...(sh.imgs || [])); } return out; };
  const CUT = id => ({
    setup(P) { if (!P.params.deaths && !P.params.noCutscene) imgsOf(id); },
    prepare(P, tex) { if (!P.params.deaths && !P.params.noCutscene) for (const im of imgsOf(id)) tex.add(im); },
  });
  const scene = (id, steps) => P => { const sc = G.Scene(P, steps); sc.after = () => { for (const im of imgsOf(id)) G.Pin.drop(im); }; return sc; };

  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes['lo-fight'] = { create: scene('lo-fight', [loFight(false), talk('lo-fight'), stopMusic]) };
  G.Cutscenes['lo-fight-(hq)'] = { create: scene('lo-fight-(hq)', [loFight(true), talk('lo-fight-(hq)'), stopMusic]) };
  G.Cutscenes.overhead = { create: scene('overhead', [{ dur: 0.8 }, talk('overhead')]) };
  G.Cutscenes['overhead-(hq)'] = { create: scene('overhead-(hq)', [{ dur: 0.8 }, talk('overhead-(hq)')]) };
  G.Cutscenes.ballistic = { create: scene('ballistic', [ballistic(false), flash, talk('ballistic'), stopMusic]), createEnd: endPic('jabaited') };
  G.Cutscenes['ballistic-(hq)'] = { create: scene('ballistic-(hq)', [ballistic(true), flash, talk('ballistic-(hq)'), { enter() { G.audio.music.stop(4); }, dur: 0 }]) };
  G.Cutscenes.underground = { createEnd: endPic('the') };

  // ================================================================ in the songs
  // Ballistic's camera (Cam.hxc): locked on two spots, leaning 50 px the way the singer points
  const CAMLOCK = {
    reset(P) { P.wh = Object.assign(P.wh || {}, { mustHit: false }); },
    event(P, e, v) { if (e === 'FocusCamera') { const c = v != null && typeof v === 'object' ? v.char : v; P.wh.mustHit = String(c) === '0'; } },
    update(P) {
      if (P.cutscene) return;
      const side = P.wh.mustHit, c = side ? P.bf : P.dad; if (!c) return;
      const base = side ? [1000, 500] : [700, 350], o = 50;
      const d = { singLEFT: [-o, 0], singRIGHT: [o, 0], singUP: [0, -o], singDOWN: [0, o], idle: [0, 0], 'idle-alt': [0, 0], danceLeft: [0, 0] }[c.animName.replace(/-alt$/, side ? '-x' : '')];
      if (!d) return;
      P.camForced = { x: base[0] + d[0], y: base[1] + d[1] }; P.cam.follow(P.camForced.x, P.camForced.y);
    },
    // InfiShake: every one of his notes shakes everything; crazy Whitty bops the camera on them too
    oppHit(P) {
      P.cam.shake(0.006, 1); P.hud.shake(0.006, 1);
      if (P.dad && P.dad.id.startsWith('whitbonkers') && G.settings.camZoom !== false) { P.bopMul += 0.01; P.hudZoom += 0.02; }
    },
  };
  // the red cracked screen on the burning alley, stronger the more health you have (alley-balls.hxc)
  const RED = {
    prepare(P, tex) { const im = G.A.image(IMG + 'thefunnyeffect.png'); if (im) tex.add(im); },
    setup() { G.A.image(IMG + 'thefunnyeffect.png'); },
    drawOver(ctx, P) {
      if (!flashOn() || P.cutscene) return;
      const im = G.A.image(IMG + 'thefunnyeffect.png'); if (!im) return;
      G.setScreenT(ctx); ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = G.clamp(P.health / 1.5, 0, 1);
      ctx.drawImage(im, 0, 0, G.W, G.H); ctx.restore();
    },
  };
  // the swag club (underground.hxc): the walls turn into the swag ones while BF is cool
  const CLUB = {
    reset(P) { CLUB.style(P, false); },
    swapped(P, slot, c) { if (slot === 'bf') CLUB.style(P, c.id === 'bf_cool'); },
    style(P, cool) {
      for (const p of P.stage.props) if (p.name === 'stagefront' || p.name === 'stageback') p.alpha = cool ? 0 : 1;
      const lawl = P.stage.props.find(p => p.name === 'lawl');                       // (the in-game mix's Angry Joe)
      if (lawl) { lawl.play(cool ? 'stylechange' : 'idle', true); lawl.x = cool ? 1120 - 10 : 1120; lawl.y = cool ? 800 - 58 / 2 : 800; }
    },
  };
  // the stage gags: the jacket flying across the club, the rat on the burger place, the snow light going off
  const GAGS = {
    reset(P) {
      const j = P.stage.props.find(p => p.name === 'jackettt'), r = P.stage.props.find(p => p.name === 'ratsAss'), b = P.stage.props.find(p => p.name === 'da_bg');
      if (j) { j.alpha = 0; j.x = 450; } if (r) r.alpha = 0; if (b) b.alpha = 1;
      P.wh = Object.assign(P.wh || {}, { tw: [] });
    },
    event(P, e) {
      const prop = n => P.stage.props.find(p => p.name === n);
      if (e === 'gagaboobs') {
        const j = prop('jackettt'), r = prop('ratsAss');
        if (r) r.alpha = 1;
        if (j) { j.alpha = 1; tween(P.wh.tw, j, { x: 2000 }, 0.15, E.linear, { done: () => { j.alpha = 0; } }); }
      } else if (e === 'cccep11') { const b = prop('da_bg'); if (b) b.alpha = 0; }
      else if (e === 'broobies') {
        // the arrows (the first three of each side) jump up/down 50 px and ease back over two beats
        for (const L of P.lines) for (let i = 0; i < 3; i++) { const s = L.strums[i]; s.bob = { y: (i % 2 === 0 ? 50 : -50) }; tween(P.wh.tw, s.bob, { y: 0 }, P.cond.crochet / 500, E.sineOut); }
      }
    },
    update(P, dt) {
      runTweens(P.wh.tw, dt);
      // (through the strum's offset: the play screen puts every strum at base + offset after the song FX run)
      for (const L of P.lines) for (const s of L.strums) if (s.bob) { s.my = s.bob.y; if (!s.bob.y) s.bob = null; }
    },
  };
  // Low-Rise: a swap points the camera at Whitty again
  const LOWRISE = { swapped(P) { if (P.dad) P.cam.follow(P.dad.camFocus.x, P.dad.camFocus.y); } };
  // Hungry HQ: after his pose BF holds it for 10 s, the burger 20 s
  const HUNGRYHQ = {
    event(P, e, v) {
      if (e !== 'Play Animation' || !v) return;
      const who = String(v.value2 || '').trim();
      if (who === 'bf' && P.bf) P.bf.noDanceUntil = P.songPos + 10000;
      if (who === 'Dad' && P.dad) P.dad.noDanceUntil = P.songPos + 20000;
    },
  };
  // Overhead: every arrow hidden at first (the events bring them in; the OG chart has none, so it keeps its arrows)
  const HIDDEN = { reset(P) { if (!(P.song.events || []).some(e => e.e === 'Toggle Strums Visibility')) return; for (const L of P.lines) for (const s of L.strums) s.visible = false; } };
  // Ballistic HQ (ballistic-(hq).hxc): pixel ratings + a combo bar sliding in from the left
  const HQHUD = {
    setup(P) { G.Sparrow.load(IMG + 'ui/popup/hm/hmratings'); G.A.image(IMG + 'ui/popup/hm/backthing.png'); },
    prepare(P, tex) { const sh = G.Sparrow.load(IMG + 'ui/popup/hm/hmratings'); if (sh) for (const im of sh.imgs) tex.add(im); const b = G.A.image(IMG + 'ui/popup/hm/backthing.png'); if (b) tex.add(b); },
    reset(P) {
      const r = new G.Sprite(G.W * 0.35 - 75, G.H / 2 - 40).loadSparrow(IMG + 'ui/popup/hm/hmratings');
      for (const k of ['shit', 'bad', 'good', 'sick']) r.addAnim(k, k, 60, false);
      r.addAnim('hide', 'bad_00039', 60, false); r.play('hide', true);
      r.antialias = false; r.scale.x = r.scale.y = 5; r.updateHitbox();
      P.hq = { r, bg: { x: -300 }, tx: { x: -170 }, gone: true, combo: 0, tw: [] };
    },
    popups(P, r, combo) {
      const H = P.hq; H.r.play(r, true);
      if (combo >= 2) {
        if (H.gone) { tween(H.tw, H.tx, { x: 130 }, P.cond.stepCrochet / 1000); tween(H.tw, H.bg, { x: 0 }, P.cond.stepCrochet / 1000); H.gone = false; }
        H.combo = combo;
      }
      return true;
    },
    comboBreak(P) { HQHUD.yeet(P); },
    yeet(P) { const H = P.hq; if (!H || H.gone) return; tween(H.tw, H.tx, { x: -170 }, P.cond.stepCrochet / 1000); tween(H.tw, H.bg, { x: -300 }, P.cond.stepCrochet / 1000); H.gone = true; },
    update(P, dt) { if (P.hq) { runTweens(P.hq.tw, dt); P.hq.r.update(dt); } },
    drawTop(ctx, P) {
      const H = P.hq; if (!H || P.cutscene) return;
      P.hud.apply(ctx);
      H.r.draw(ctx, P.hud);
      const by = P.down ? 40 : G.H * 0.7, bg = G.A.image(IMG + 'ui/popup/hm/backthing.png');
      P.hud.apply(ctx);
      if (bg) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(bg, H.bg.x, by); ctx.restore(); }
      if (H.combo >= 2) {
        const wave = Math.sin(P.songPos / P.cond.crochet * Math.PI / 4), b = Math.floor(85 * wave + 85);
        const font = "'bulletinyourhead', " + G.FONT.vcr, s = H.combo + 'x';
        ctx.save(); ctx.font = '43px ' + font; const w = ctx.measureText(s).width; ctx.restore();
        ctx.save(); ctx.translate(H.tx.x + w / 2, by + 30 + 25); ctx.scale(3, 3);
        G.text(ctx, s, -w / 2, -25, { size: 43, font, color: 'rgb(255,0,' + b + ')', outline: 1, outlineColor: '#000', baseline: 'top' });
        ctx.restore();
      }
    },
  };
  // the story-mode end picture is loaded with the song (asked for only when the song ends, the screen would wait on it)
  const ENDPIC = pic => ({
    setup(P) { if (isStory(P) && !P.params.noCutscene) G.A.image(IMG + pic + '.png'); },
    prepare(P, tex) { if (isStory(P) && !P.params.noCutscene) { const im = G.A.image(IMG + pic + '.png'); if (im) tex.add(im); } },
  });
  // the HQ alleys have their own game over sound, the Beta Mix BF his own game over music
  const HQDEATH = { gameOver: { sfx: 'shared/sounds/gameplay/gameover/fnf_loss_sfx-hqr.ogg' } };
  const JAMDEATH = { gameOver: { music: 'shared/music/gameplay/gameover/gameOver-hqr.ogg' } };
  // the cutscenes' camera zooms in close: the stage pictures need to be sharp up there
  const ZOOM15 = { maxZoom: () => 1.5 };

  function combine(...parts) {
    const o = {};
    for (const k of ['setup', 'reset', 'update', 'beat', 'step', 'event', 'oppHit', 'playerHit', 'drawOver', 'drawTop', 'prepare', 'swapped', 'comboBreak']) {
      const fns = parts.map(p => p[k]).filter(Boolean);
      if (fns.length) o[k] = (...a) => { for (const f of fns) f(...a); };
    }
    for (const k of ['popups', 'gameOver', 'maxZoom']) { const p = parts.find(q => q[k]); if (p) o[k] = p[k]; }
    return o;
  }
  G.SongFX = G.SongFX || {};
  const F = G.SongFX;
  F['lo-fight'] = combine(ZOOM15, CUT('lo-fight'), GAGS);
  F['lo-fight-(hq)'] = combine(ZOOM15, CUT('lo-fight-(hq)'), GAGS, HQDEATH);
  F.overhead = combine(HIDDEN, CUT('overhead'), GAGS);
  F['overhead-(hq)'] = combine(HIDDEN, CUT('overhead-(hq)'), GAGS, HQDEATH);
  F.ballistic = combine(ZOOM15, CUT('ballistic'), CAMLOCK, RED, GAGS, ENDPIC('jabaited'));
  F['ballistic-remix'] = combine(CAMLOCK, RED, GAGS);
  F['ballistic-(hq)'] = combine(ZOOM15, CUT('ballistic-(hq)'), CAMLOCK, RED, GAGS, HQHUD, HQDEATH);
  F['ballistic-(beta-mix)'] = combine(CAMLOCK, RED, GAGS, JAMDEATH);
  F.underground = combine(CLUB, GAGS, ENDPIC('the'));
  F['underground-(hq)'] = combine(CLUB, GAGS);
  F['underground-(in-game-mix)'] = combine(CLUB, GAGS);
  F['low-rise'] = combine(LOWRISE, GAGS);
  F['low-rise-(hq)'] = combine(LOWRISE, GAGS);
  F.hungry = combine(GAGS);
  F['hungry-(hq)'] = combine(HUNGRYHQ, GAGS);
  F.faucet = combine(GAGS);
  F['faucet-(hq)'] = combine(GAGS);
})();
