// FNF 2 - FNF's own dialogue system ("conversations"). Mods made for the real game (V-Slice) describe their
// talking scenes in data/dialogue/conversations|speakers|boxes/*.json; this plays them the way FNF's
// Conversation.hx / DialogueBox.hx / Speaker.hx do, so the mods' numbers land in the same spots:
//   box      screen-centred as an empty group, moved by its offsets, scaled (pixel boxes x5.4); text at box + text.offsets
//   speaker  screen-centred on its first frame, moved by its offsets, then scaled; each animation can nudge it
//   typing   one letter every 0.05 s with the pixelText click; ENTER finishes the line, then goes to the next
//   backdrop a solid colour fading in in 10 steps; music fades in; the outro fades everything out in 8 steps
// G.Conversation(id, opt) has the same shape as the Sky dialogue (update/accept/draw/done) so G.Scene can run it.
(function () {
  const D = 'preload/data/dialogue/';
  const LIBS = ['preload/images/', 'shared/images/', 'week6/images/'];
  const sheetPath = p => LIBS.map(l => l + p).find(b => G.A.has(b + '.xml')) || LIBS[0] + p;
  const soundPath = n => ['preload/sounds/', 'shared/sounds/', 'week6/sounds/'].map(l => l + n + '.ogg').find(p => G.A.has(p));
  const musicPath = n => ['preload/music/' + n + '/' + n + '.ogg', 'preload/music/' + n + '.ogg', 'shared/music/' + n + '.ogg', 'week6/music/' + n + '.ogg'].find(p => G.A.has(p));
  // FlxColor.fromString: #RRGGBB or #AARRGGBB
  const color = s => {
    s = String(s || '#000000').replace('#', '').replace(/^0x/, '');
    return s.length === 8 ? { a: parseInt(s.slice(0, 2), 16) / 255, c: '#' + s.slice(2) } : { a: 1, c: '#' + s };
  };
  const stepped = (k, n) => Math.floor(Math.min(1, k) * n) / n;
  const json = (kind, id) => G.A.json(D + kind + '/' + id + '.json');

  function addAnims(sp, list) {
    for (const a of list || []) sp.addAnim(a.name, a.prefix, a.frameRate || 24, !!a.looped, a.frameIndices && a.frameIndices.length ? a.frameIndices : null);
  }
  // FNF: a missing animation drops its "-suffix" until one exists, else idle
  function fallback(sp, name) {
    for (let n = name; n;) { if (sp.hasAnim(n)) return n; const i = n.lastIndexOf('-'); if (i < 0) break; n = n.slice(0, i); }
    return sp.hasAnim('idle') ? 'idle' : null;
  }
  // a Sparrow sprite drawn with its top-left at x,y after scaling (what Flixel's updateHitbox gives)
  function plain(path, d) {
    const sp = new G.Sprite(0, 0).loadSparrow(sheetPath(path));
    if (!sp.sheet) return null;
    sp.scale.x = sp.scale.y = d.scale || 1;
    sp.origin.x = sp.origin.y = 0; sp.offset.x = sp.offset.y = 0;
    sp.flipX = !!d.flipX; sp.flipY = !!d.flipY; sp.antialias = !d.isPixel;
    addAnims(sp, d.animations);
    return sp;
  }
  const animOffsets = d => { const o = {}; for (const a of d.animations || []) o[a.name] = a.offsets || [0, 0]; return o; };

  function Speaker(id, js) {
    const d = (js || json)('speakers', id); if (!d) return null;
    const sp = plain(d.assetPath, d); if (!sp) return null;
    const f0 = sp.sheet.frames[0], off = d.offsets || [0, 0], ao = animOffsets(d);
    const bx = (G.W - f0.fw) / 2 + off[0], by = (G.H - f0.fh) / 2 + off[1];
    sp.x = bx; sp.y = by;
    return {
      id, sp,
      play(name) { const n = fallback(sp, name); if (!n) return; sp.play(n, false); const o = ao[n] || [0, 0]; sp.x = bx + o[0]; sp.y = by + o[1]; },
    };
  }

  let measure = null;
  function DialogueBox(id, js) {
    const d = (js || json)('boxes', id); if (!d) return null;
    const sp = plain(d.assetPath, d); if (!sp) return null;
    const off = d.offsets || [0, 0], ao = animOffsets(d), T = Object.assign({ offsets: [0, 0], width: 300, size: 32, color: '#000000', shadowWidth: 0 }, d.text || {});
    const gx = G.W / 2 + off[0], gy = G.H / 2 + off[1];   // (the group is still empty when FNF centres it)
    const tc = color(T.color), sc = T.shadowColor ? color(T.shadowColor) : null;
    const font = /pixel/i.test(T.fontFamily || '') ? 'pixel' : /vcr/i.test(T.fontFamily || '') ? 'vcr' : (T.fontFamily || 'body');
    const lh = Math.round(T.size * 1.25);
    const B = {
      id, sp, ax: 0, ay: 0, prefix: '', full: '', lines: [], len: 0, shown: 0, tt: 0, typing: false, onDone: null,
      sound: soundPath('pixelText'),
      play(name) { const n = fallback(sp, name); if (!n) return; sp.play(n, false); const o = ao[n] || [0, 0]; this.ax = o[0]; this.ay = o[1]; },
      // a new line replaces the text; appendText keeps what's there and types the rest after it
      setText(t) { this.prefix = ''; this.start(t); },
      appendText(t) { this.prefix = this.full.slice(0, this.len); this.start(t); },
      start(t) {
        this.full = this.prefix + t; this.lines = wrap(this.full); this.len = this.prefix.length + t.length; this.shown = this.prefix.length; this.tt = 0;
        this.typing = true; if (!t.length) this.complete();
      },
      skip() { if (this.typing) this.shown = this.len; },
      complete() { this.typing = false; if (this.onDone) this.onDone(); },
      finished() { return sp.finished; },
      update(dt) {
        sp.update(dt);
        if (!this.typing) return;
        this.tt += dt;
        if (this.tt >= 0.05) {
          const n = Math.floor(this.tt / 0.05); this.tt %= 0.05;
          this.shown = Math.min(this.len, this.shown + n);
          if (this.sound) G.sfx(this.sound, { vol: 0.6 });
        }
        if (this.shown >= this.len) this.complete();
      },
      draw(ctx) {
        sp.x = gx + this.ax; sp.y = gy + this.ay;
        sp.draw(ctx, null);
        let n = this.shown;
        const x = sp.x + T.offsets[0] + 2, y0 = sp.y + T.offsets[1] + 2;
        this.lines.forEach((ln, r) => {
          if (n <= 0) return;
          const s = ln.slice(0, n); n -= ln.length + 1;
          const y = y0 + r * lh, sw = T.shadowWidth || 0;
          if (sc && sc.a > 0 && sw) { ctx.save(); ctx.globalAlpha *= sc.a; G.text(ctx, s, x + sw, y + sw, { size: T.size, font, color: sc.c, align: 'left', baseline: 'top' }); ctx.restore(); }
          ctx.save(); ctx.globalAlpha *= tc.a; G.text(ctx, s, x, y, { size: T.size, font, color: tc.c, align: 'left', baseline: 'top' }); ctx.restore();
        });
      },
    };
    function wrap(text) {
      if (!measure) measure = G.makeCanvas(4, 4).getContext('2d');
      measure.font = T.size + 'px ' + (G.FONT[font] || font);
      const out = [];
      for (const para of text.split('\n')) {
        let line = '';
        for (const w of para.split(' ')) {
          const t = line ? line + ' ' + w : w;
          if (measure.measureText(t).width > T.width - 4 && line) { out.push(line); line = w; } else line = t;
        }
        out.push(line);
      }
      return out;
    }
    return B;
  }

  // one conversation: states Opening (box pops in) -> Speaking (typing) -> Idle (waiting for ENTER) -> ... -> Ending
  G.Conversation = function (id, opt) {
    opt = opt || {};
    // (speakers + boxes come from the same mod as the conversation)
    const pack = G.Packs && G.Packs.packOf(D + 'conversations/' + id + '.json');
    const json = (kind, i) => pack ? G.Packs.jsonIn(pack, D + kind + '/' + i + '.json') : G.A.json(D + kind + '/' + i + '.json');
    const data = json('conversations', id);
    const C = {
      done: false, state: 'start', entry: 0, line: 0, alpha: 1, back: 0, outT: -1, speakers: {}, boxes: {}, speaker: null, box: null,
      data,
      get E() { return data && data.dialogue[this.entry]; },
      start() {
        if (!data || !data.dialogue || !data.dialogue.length) { this.done = true; return this; }
        const m = data.music && data.music.asset && (opt.music || musicPath(data.music.asset));
        if (opt.music !== false && m) { const ft = opt.musicFade != null ? opt.musicFade : data.music.fadeTime || 0; G.audio.music.play(m, { loop: data.music.looped !== false, vol: opt.musicVol || 1, fadeIn: ft || 0, restart: !opt.continueMusic }); this.music = m; }
        this.bd = data.backdrop && data.backdrop.type === 'solid' ? Object.assign({ fadeTime: 0 }, data.backdrop, color(data.backdrop.color)) : null;
        this.openBox();
        return this;
      },
      openBox() {
        const E = this.E, bid = E.box || '';
        if (!this.box || this.box.id !== bid) {
          this.box = this.boxes[bid] || (this.boxes[bid] = DialogueBox(bid, json));
          if (this.box) { this.box.onDone = () => { this.state = 'idle'; }; this.box.lines = []; this.box.shown = 0; this.box.full = ''; this.box.len = 0; }
        }
        if (this.box && E.boxAnimation) this.box.play(E.boxAnimation);
        this.state = 'opening';
      },
      showSpeaker() {
        const E = this.E, sid = E.speaker || '';
        if (!this.speaker || this.speaker.id !== sid) this.speaker = sid ? (this.speakers[sid] || (this.speakers[sid] = Speaker(sid, json))) : null;
        if (this.speaker && E.speakerAnimation) this.speaker.play(E.speakerAnimation);
      },
      text() { return (this.E.text || [])[this.line] || ''; },
      nextLine() {
        this.line++;
        if (this.line >= (this.E.text || []).length) {
          this.line = 0; this.entry++;
          if (this.entry >= data.dialogue.length) { this.end(); return; }
          this.openBox();
        } else { this.state = 'speaking'; if (this.box) this.box.appendText(this.text()); }
      },
      end() { if (this.state === 'ending') return; this.state = 'ending'; this.outT = 0; if (this.music) G.audio.music.stop((data.outro && data.outro.fadeTime) || 0.3); },
      accept() {
        if (this.state === 'opening' || this.state === 'speaking') { if (this.box) this.box.skip(); }
        else if (this.state === 'idle') this.nextLine();
        else if (this.state === 'ending') this.done = true;
      },
      skip() { this.end(); },
      update(dt) {
        if (this.done) return;
        const bt = this.bd && this.bd.fadeTime;
        this.back = bt ? Math.min(1, this.back + dt / bt) : 1;
        if (this.box) this.box.update(dt);
        if (this.speaker) this.speaker.sp.update(dt);
        if (this.state === 'opening') {
          // FNF goes straight on here (its "is the box animation done" check always passes), so the speaker pops up and
          // the typing starts while the box is still opening
          this.state = 'speaking'; this.showSpeaker();
          if (this.box) this.box.setText(this.text()); else this.state = 'idle';
        } else if (this.state === 'ending') {
          const ot = data.outro && data.outro.type === 'fade' ? data.outro.fadeTime || 0 : 0;
          this.outT += dt;
          this.alpha = ot ? 1 - stepped(this.outT / ot, 8) : 0;
          if (this.outT >= ot) this.done = true;
        }
      },
      draw(ctx) {
        if (this.done) return;
        G.setScreenT(ctx);
        ctx.save(); ctx.globalAlpha *= this.alpha;
        if (this.bd) { ctx.save(); ctx.globalAlpha *= this.bd.a * (this.bd.fadeTime ? stepped(this.back, 10) : 1); ctx.fillStyle = this.bd.c; ctx.fillRect(0, 0, G.W, G.H); ctx.restore(); }
        if (this.speaker && this.state !== 'opening') this.speaker.sp.draw(ctx, null);
        if (this.box) this.box.draw(ctx);
        ctx.restore();
      },
      // every picture it will use (so the play screen can decode them before the song)
      textures() {
        const out = new Set();
        if (!data) return out;
        for (const E of data.dialogue) {
          const s = E.speaker && json('speakers', E.speaker), b = E.box && json('boxes', E.box);
          for (const x of [s, b]) if (x && x.assetPath) { const sh = G.Sparrow.load(sheetPath(x.assetPath)); if (sh) for (const im of sh.imgs) out.add(im); }
        }
        return out;
      },
    };
    return C.start();
  };
  G.Conversation.exists = id => !!json('conversations', id);
})();
