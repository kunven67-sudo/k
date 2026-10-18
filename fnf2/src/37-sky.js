// FNF 2 - VS Sky (mod by bbpanzu, Sky by @Alexander0110_ + @Dra9onSlayer5), played like the original:
//   Wife Forever  dialogue ("THE SHIFT WORKED!!!") with the shift music
//   Sky           dialogue; she reacts on set beats (oh / grr / huh / ugh) and gets MAD at beat 128
//                 (her angry poses from then on); end dialogue, then she MANIFESTS: the world
//                 breaks, the screen shakes, white flash
//   Manifest      the camera starts on GF on the cross, pulls back, dialogue, then the song;
//                 after it: the good ending (accuracy over 70%), the bad one, or now and then the secret one
// Art, songs, charts and dialogue come from the original mod (tools/own/sky.py, private build only).
(function () {
  const IMG = 'shared/images/sky/', MUS = 'shared/music/sky/', SND = 'shared/sounds/sky/';
  const conv = id => ((G.A.json('preload/data/dialogue/sky.json') || {})[id]) || [];
  // portraits: sheet, animation prefix(es), where they stand (the box is drawn full screen)
  const PORT = {
    sky: { sheet: 'port', talk: 'portrait', x: 200, y: 155 },
    'sky-annoyed': { sheet: 'port_an', talk: 'portrait an', x: 200, y: 155 },
    'sky-mad': { sheet: 'port_mad', talk: 'portrait mad', x: 200, y: 155 },
    bf: { sheet: 'bfport', talk: 'bfport', x: 700, y: 155 },
    gf: { sheet: 'gfport', talk: 'gfport', fyou: 'gfporFUCKYOU', x: 700, y: 155 },
  };
  const TEXT = { x: 240, y: 500, w: 768, size: 32, lh: 40, color: '#3F2021', shadow: '#D89494' };     // Week 6's dialogue text
  const ease = { inOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 };

  // ---------------------------------------------------------------- the world keeps moving under a cutscene
  function world(S, dt) {
    const P = S.P;
    S.stepT = (S.stepT || 0) + dt * 1000;
    const st = P.cond.stepCrochet;
    while (S.stepT >= st) { S.stepT -= st; S.step = (S.step || 0) + 1; if (S.dance !== false) for (const c of [P.gf, P.dad, P.bf]) if (c) c.onStep(S.step); }
    for (const c of [P.gf, P.dad, P.bf]) if (c) c.tick(dt, st / 1000, false);
    P.stage.update(dt);
    const C = S.cam;
    if (C) {
      if (C.tw) { const w = C.tw; w.t += dt; const k = Math.min(1, w.t / w.dur), e = ease.inOut(k); C.z = G.lerp(w.z0, w.z1, e); if (k >= 1) C.tw = null; }
      P.cam.zoom = C.z; if (C.x != null) { P.cam.x = P.cam.tx = C.x; P.cam.y = P.cam.ty = C.y; }
    }
    P.cam.update(dt);
  }
  const zoomTo = (S, z, dur) => { S.cam.tw = { z0: S.cam.z, z1: z, t: 0, dur }; };

  // ---------------------------------------------------------------- the dialogue box (the mod's own box + portraits)
  function Dialogue(lines, opt) {
    opt = opt || {};
    const d = {
      lines, i: -1, typed: 0, tt: 0, full: '', wrapped: [], back: 0, fadeOut: -1, done: false,
      box: new G.Sprite(0, 0).loadSparrow(IMG + 'dia'), ports: {},
      start() {
        this.box.addAnim('enter', 'dia', 24, false); this.box.addAnim('idle', 'dia', 24, false, [6]); this.box.play('enter', true);
        if (opt.music) G.audio.music.play(opt.music, { loop: true, vol: 0.8, fadeIn: 1, restart: true });
        this.next(true);
        return this;
      },
      port(who) {
        if (this.ports[who]) return this.ports[who];
        const p = PORT[who] || PORT.sky, s = new G.Sprite(p.x, p.y).loadSparrow(IMG + p.sheet);
        s.addAnim('talk', p.talk, 24, false); if (p.fyou) s.addAnim('fyou', p.fyou, 24, false);
        return (this.ports[who] = s);
      },
      next(first) {
        this.i++;
        if (this.i >= this.lines.length) { this.close(); return; }
        if (!first) G.sfx('shared/sounds/clickText.ogg', { vol: 0.8 });
        const L = this.lines[this.i];
        this.cur = this.port(L.who); this.cur.play(L.anim === 'fyou' && this.cur.hasAnim('fyou') ? 'fyou' : 'talk', true);
        this.full = L.text; this.typed = 0; this.tt = 0; this.wrapped = wrap(L.text);
      },
      close() { if (this.fadeOut < 0) { this.fadeOut = 0; if (opt.music && !opt.keepMusic) G.audio.music.stop(1); } },
      update(dt) {
        this.back = Math.min(1, this.back + dt / 1.2);
        this.box.update(dt); if (this.cur) this.cur.update(dt);
        if (this.fadeOut >= 0) { this.fadeOut += dt; if (this.fadeOut >= 0.6) this.done = true; return; }
        if (this.box.animName === 'enter' && !this.box.finished) return;
        if (this.box.animName === 'enter') this.box.play('idle', true);
        this.tt += dt;
        while (this.tt >= 0.04 && this.typed < this.full.length) {
          this.tt -= 0.04; this.typed++;
          if (this.full[this.typed - 1] !== ' ') G.sfx('week6/sounds/pixelText.ogg', { vol: 0.6 });
        }
      },
      accept() {
        if (this.fadeOut >= 0 || (this.box.animName === 'enter' && !this.box.finished)) return;
        if (this.typed < this.full.length) this.typed = this.full.length; else this.next();
      },
      draw(ctx) {
        const k = this.fadeOut >= 0 ? Math.max(0, 1 - this.fadeOut / 0.6) : 1;
        G.setScreenT(ctx);
        ctx.save(); ctx.globalAlpha = 0.75 * this.back * k; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, G.W, G.H); ctx.restore();
        ctx.save(); ctx.globalAlpha *= k;
        if (this.cur && this.box.animName === 'idle') this.cur.draw(ctx, null);
        this.box.draw(ctx, null);
        if (this.box.animName === 'idle') {
          let n = this.typed;
          this.wrapped.forEach((ln, r) => {
            if (n <= 0) return;
            const s = ln.slice(0, n); n -= ln.length + 1;
            const y = TEXT.y + r * TEXT.lh;
            G.text(ctx, s, TEXT.x + 2, y + 2, { size: TEXT.size, font: 'pixel', color: TEXT.shadow, align: 'left', baseline: 'top' });
            G.text(ctx, s, TEXT.x, y, { size: TEXT.size, font: 'pixel', color: TEXT.color, align: 'left', baseline: 'top' });
          });
        }
        ctx.restore();
      },
    };
    return d.start();
  }
  let measure = null;
  function wrap(text) {
    if (!measure) measure = G.makeCanvas(4, 4).getContext('2d');
    measure.font = TEXT.size + 'px ' + G.FONT.pixel;
    const out = []; let line = '';
    for (const w of text.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (measure.measureText(t).width > TEXT.w && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }

  // ---------------------------------------------------------------- a scene = a list of steps run one after another
  function Scene(P, steps) {
    const S = {
      P, steps, k: -1, t: 0, black: 0, white: 0, done: false, cam: { z: P.cam.zoom, x: null, y: null, tw: null },
      begin() { P.hud.alpha = 0; this.go(); return this; },
      go() { const prev = this.steps[this.k]; if (prev && prev.leave) prev.leave(this); this.k++; this.t = 0; this.dlg = null; const s = this.steps[this.k]; if (!s) { this.finish(); return; } if (s.enter) s.enter(this); },
      finish() { if (this.done) return; const cur = this.steps[this.k]; if (cur && cur.leave) cur.leave(this); this.done = true; P.hud.alpha = 1; P.cam.zoom = P.camZoom; if (this.after) this.after(this); },
      update(dt) {
        world(this, dt);
        if (this.done) return;
        const s = this.steps[this.k]; this.t += dt;
        if (this.dlg) { this.dlg.update(dt); if (this.dlg.done) this.go(); return; }
        if (s && s.update) s.update(this, dt);
        if (s && s.dur != null && this.t >= s.dur) this.go();
      },
      onAction(a, down, repeat) {
        if (!down || repeat || this.done) return;
        if (a === 'back') { G.audio.music.stop(0.4); this.finish(); return; }
        if (a === 'accept') { if (this.dlg) this.dlg.accept(); else { const s = this.steps[this.k]; if (s && s.skippable && this.t > 1.5) this.go(); } }
      },
      draw(ctx) {
        const s = this.steps[this.k];
        if (s && s.draw) s.draw(this, ctx);
        if (this.dlg) this.dlg.draw(ctx);
        G.setScreenT(ctx);
        if (this.white > 0) { ctx.fillStyle = 'rgba(255,255,255,' + this.white.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
        if (this.black > 0) { ctx.fillStyle = 'rgba(0,0,0,' + this.black.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
        if (!this.done) G.vcr(ctx, 'Press BACK to Skip', G.W - 20, G.H - 30, { size: 16, align: 'right', outline: 2 });
      },
    };
    return S.begin();
  }
  G.Scene = Scene;   // other mods' cutscenes use the same step runner (39-conversation.js)
  // the opening of the first two songs: black, fading away (Week 6's school intro), then the talking
  const fromBlack = { enter(S) { S.black = 1; }, dur: 2, update(S) { S.black = Math.max(0, 1 - S.t / 2); } };
  const talk = (id, opt) => ({ enter(S) { S.black = 0; S.dlg = Dialogue(conv(id), opt); } });

  // ---------------------------------------------------------------- Sky: her reactions + getting mad
  G.SongFX = G.SongFX || {};
  const REACT = { 30: 'oh', 31: 'oh', 62: 'oh', 63: 'oh', 126: 'grr', 127: 'grr', 190: 'grr', 191: 'grr', 254: 'huh', 255: 'huh', 270: 'huh', 271: 'huh' };
  G.SongFX.sky = {
    reset(P) { const d = P.dad; if (!d) return; d.singSuffix = ''; d.idleSuffix = ''; d._locked = false; d._ugh = false; },
    beat(P, b) {
      const d = P.dad; if (!d) return;
      if (b === 128) { d.singSuffix = '-alt'; d.idleSuffix = '-alt'; }                // oh no, she's mad
      if (REACT[b]) d.playAnim(REACT[b], true);
      if (b === 286) { d.playAnim('ugh', true); d._locked = true; d._ugh = true; }   // plays out, nothing cuts it off
    },
    update(P) { const d = P.dad; if (d && d._ugh && (d.animName !== 'ugh' || d.finished)) { d._ugh = false; d._locked = false; d.dance(true); } },
  };

  // ---------------------------------------------------------------- the cutscenes
  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes['wife-forever'] = { create: P => Scene(P, [fromBlack, talk('wife-forever', { music: MUS + 'shift.ogg' })]) };
  G.Cutscenes.sky = {
    create: P => Scene(P, [fromBlack, talk('sky')]),
    // after the song: the end dialogue, then she manifests
    createEnd: P => Scene(P, [{ enter(S) { S.dance = false; }, dur: 0.6 }, talk('sky-end'), {
      enter(S) {
        S.bg = P.stage.props.find(p => p.name === 'bg_annoyed');
        S.cam.z = P.cam.zoom; S.fired = {};
      },
      dur: 6,
      update(S) {
        const t = S.t, once = (k, at, fn) => { if (t >= at && !S.fired[k]) { S.fired[k] = true; fn(); } };
        once('manifest', 1, () => { P.dad._locked = true; P.dad.playAnim('manifest', true); G.sfx(SND + 'manifest.ogg', { vol: 1 }); zoomTo(S, 1.2, 1); });
        once('boom', 2, () => {
          if (S.bg) { S.bg.scroll.x = S.bg.scroll.y = 1; S.bg.play('manifest', true); }
          zoomTo(S, 1, 0.3); if (G.settings.flashing !== false) P.cam.shake(0.05, 5); else P.cam.shake(0.01, 5);
        });
        once('fade', 3, () => zoomTo(S, 1.1, 2));
        if (t >= 3) S.white = Math.min(1, (t - 3) / 2);
        if (t >= 5.5) S.black = Math.min(1, (t - 5.5) / 0.1);
      },
    }]),
  };
  G.Cutscenes.manifest = {
    // the camera starts right on GF on her cross, pulls back, then the talking
    create: P => Scene(P, [{
      enter(S) {
        const g = P.gf; if (!g) return;
        S.cam.x = g.x + g.width / 2; S.cam.y = g.camFocus.y - 130; S.cam.z = 3;
        G.audio.music.play(MUS + 'manifest.ogg', { loop: true, vol: 1, restart: true });
      },
      dur: 4.6,
      update(S) { if (S.t >= 2.1 && !S.cam.tw && S.cam.z > P.stageZoom + 0.001 && !S.zoomed) { S.zoomed = true; zoomTo(S, P.stageZoom, 2.5); } },
    }, talk('manifest', { keepMusic: true }), { enter() { G.audio.music.stop(0.6); }, dur: 0.3 }]),
    // after the song: one of the three endings (the mod picks: secret now and then, else good if accuracy > 70%)
    createEnd: P => {
      const T = P.tally, hit = T.sick + (T.killer || 0) + T.good + T.bad + T.shit;
      const acc = (T.sick + (T.killer || 0) + T.good * 0.785 + T.bad * 0.65 + T.shit * 0.3) / Math.max(1, hit + T.miss) * 100;
      const pick = Math.random() < 0.3 ? ['ending0003', 'peanut'] : acc > 70 ? ['ending0002', 'goodEnding'] : ['ending0001', 'badEnding'];
      return Scene(P, [{
        enter(S) { S.black = 0; S.pic = G.A.image(IMG + pick[0] + '.png'); G.audio.music.play(MUS + pick[1] + '.ogg', { loop: false, vol: 1, restart: true }); },
        dur: 10.4, skippable: true,
        update(S) { S.picA = S.t < 10 ? Math.min(1, S.t / 2) : Math.max(0, 1 - (S.t - 10) / 0.4); },
        draw(S, ctx) { if (S.pic) { G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H); ctx.save(); ctx.globalAlpha = S.picA || 0; ctx.drawImage(G.srcImg(S.pic), 0, 0, G.W, G.H); ctx.restore(); } },
      }, { enter(S) { S.black = 1; G.audio.music.stop(0.3); }, dur: 0.1 }]);
    },
  };
})();
