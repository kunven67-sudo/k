// FNF 2 - WRATH's "Brain Freeze" cutscene (before GLARE), in the park by the SCOOPS AHOY truck.
// BF + GF sit on the bench with their cones, made from FNF's own sitting art (the K-pop week's
// "getting up" cutscene: every body part is its own piece). A Puppet poses those pieces itself:
// a pose = a frame of the official animation + small changes (turn an arm, swap a face, hold a cone).
(function () {
  // ---------------------------------------------------------------- Puppet
  const mul = (p, l) => [p[0] * l[0] + p[2] * l[1], p[1] * l[0] + p[3] * l[1], p[0] * l[2] + p[2] * l[3], p[1] * l[2] + p[3] * l[3], p[0] * l[4] + p[2] * l[5] + p[4], p[1] * l[4] + p[3] * l[5] + p[5]];
  const T = (x, y) => [1, 0, 0, 1, x, y];
  const R = deg => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
  const S = (x, y) => [x, 0, 0, y == null ? x : y, 0, 0];

  G.Puppet = class {
    constructor(base) {
      this.atlas = G.Atlas.load(base);
      this.b = this.atlas ? G.Atlas.bounds(this.atlas) : { x: 0, y: 0, w: 1, h: 1 };
    }
    // the pieces on frame k of the official animation, bottom first: { s, sub, m, trp }
    pieces(k) {
      const tl = this.atlas.main, out = [];
      k = Math.max(0, Math.min(tl.frameCount - 1, k | 0));
      for (let li = tl.layers.length - 1; li >= 0; li--) {
        const L = tl.layers[li], ki = L.at[k];
        if (ki < 0 || L.type === 'Clp' || L.type === 'Clipper') continue;          // mask layers are never drawn
        const F = L.frames[ki];
        for (const e of F.els) {
          if (e.n != null) { out.push({ n: e.n, m: e.m }); continue; }
          const sym = this.atlas.symbols[e.s];
          out.push({ s: e.s, sub: sym ? G.Atlas.subFrame(e, k - F.i, sym.frameCount) : 0, m: e.m, trp: e.trp || { x: 0, y: 0 }, a: e.a });
        }
      }
      return out;
    }
    // pose = { f, ed: { sym: { ff, rot, dx, dy, sx, sy, hide, alpha } }, hold: [{ sym, img, x, y, rot, sc, ax, ay, top }],
    //          all: { rot, dx, dy } (whole body, around `pivot`) }
    draw(ctx, pose) {
      const A = this.atlas; if (!A) return;
      const top = [];
      ctx.save();
      if (pose.all) {
        const p = pose.pivot || { x: this.b.x + this.b.w / 2, y: this.b.y + this.b.h };
        const m = mul(mul(mul(T(p.x + (pose.all.dx || 0), p.y + (pose.all.dy || 0)), R(pose.all.rot || 0)), S(pose.all.sx || 1, pose.all.sy || 1)), T(-p.x, -p.y));
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      }
      for (const pc of this.pieces(pose.f)) {
        if (pc.n != null) { const sp = A.sprites[pc.n]; if (sp) { ctx.save(); ctx.transform(...pc.m); ctx.drawImage(G.srcImg(sp.img), sp.x, sp.y, sp.w, sp.h, 0, 0, sp.w, sp.h); ctx.restore(); } continue; }
        const ed = (pose.ed && pose.ed[pc.s]) || {};
        let m = pc.m;
        if (ed.rot || ed.sx || ed.sy) m = mul(m, mul(mul(mul(T(pc.trp.x, pc.trp.y), R(ed.rot || 0)), S(ed.sx || 1, ed.sy || 1)), T(-pc.trp.x, -pc.trp.y)));
        if (ed.dx || ed.dy) m = [m[0], m[1], m[2], m[3], m[4] + (ed.dx || 0), m[5] + (ed.dy || 0)];
        if (!ed.hide) {
          const sym = A.symbols[ed.swap || pc.s];
          if (sym) {
            ctx.save(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
            const al = (ed.alpha != null ? ed.alpha : 1) * (pc.a != null ? pc.a : 1); if (al !== 1) ctx.globalAlpha *= al;
            G.Atlas.draw(ctx, A, sym, ed.ff != null ? ed.ff : pc.sub);
            ctx.restore();
          }
        }
        for (const h of pose.hold || []) if (h.sym === pc.s) { if (h.top) top.push([h, m]); else this.drawHeld(ctx, h, m); }
      }
      for (const [h, m] of top) this.drawHeld(ctx, h, m);
      ctx.restore();
    }
    // something held by a piece: placed in that piece's own space (x, y), turned + scaled around its anchor
    drawHeld(ctx, h, m) {
      const img = typeof h.img === 'string' ? G.A.image(h.img) : h.img; if (!img) return;
      ctx.save();
      ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      ctx.translate(h.x, h.y); ctx.rotate((h.rot || 0) * Math.PI / 180); ctx.scale(h.sc || 1, h.sc || 1);
      if (h.alpha != null) ctx.globalAlpha *= h.alpha;
      if (h.clip) { ctx.beginPath(); h.clip(ctx, img); ctx.clip(); }
      ctx.drawImage(G.srcImg(img), -img.width * (h.ax != null ? h.ax : 0.5), -img.height * (h.ay != null ? h.ay : 0.5));
      ctx.restore();
    }
  };

  // a world sprite showing a puppet (camera, scroll, flip, zIndex like any other sprite)
  G.puppetSprite = function (base) {
    const P = new G.Puppet(base), s = new G.Sprite(0, 0);
    s.puppet = P; s.frameW = P.b.w; s.frameH = P.b.h; s.resetSize();
    s.anims.pose = { kind: 'own', n: 1, fps: 24, loop: true }; s.cur = s.anims.pose; s.animName = 'pose'; s.finished = false;
    // tint = { a, color, x, y, r }: a soft colour wash over part of the body (atlas space), e.g. a cold blue face
    let off = null;
    s.fx = { draw(sp, ctx) {
      if (!sp.pose) return;
      const t = sp.tint;
      if (!t || !(t.a > 0)) { ctx.translate(-P.b.x, -P.b.y); P.draw(ctx, sp.pose); return; }
      if (!off) { off = document.createElement('canvas'); off.width = Math.ceil(P.b.w); off.height = Math.ceil(P.b.h); }
      const o = off.getContext('2d');
      o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, off.width, off.height);
      o.save(); o.translate(-P.b.x, -P.b.y); P.draw(o, sp.pose); o.restore();
      o.globalCompositeOperation = 'source-atop';
      const g = o.createRadialGradient(t.x - P.b.x, t.y - P.b.y, 0, t.x - P.b.x, t.y - P.b.y, t.r);
      g.addColorStop(0, t.color.replace('A', t.a.toFixed(3))); g.addColorStop(0.6, t.color.replace('A', (t.a * 0.7).toFixed(3))); g.addColorStop(1, t.color.replace('A', '0'));
      o.fillStyle = g; o.fillRect(0, 0, off.width, off.height);
      o.globalCompositeOperation = 'source-over';
      ctx.drawImage(off, 0, 0);
    } };
    s.pose = { f: 0 };
    // place by the bottom-centre (the seat), like characters' feet
    s.sitAt = function (x, y) { this.x = x - this.width / 2; this.y = y - this.height; return this; };
    return s;
  };

  // ---------------------------------------------------------------- poses
  const BF = 'sserafim/images/cutscene/bfGetUp', GF = 'sserafim/images/cutscene/gfGetUp';
  const CONE_PINK = 'shared/images/wrath-intro/cone-strawberry.png', CONE_CHOC = 'shared/images/wrath-intro/cone-chocchip.png';
  const CONE_UP = (cone, rot) => ({ sym: 'bf/bf arm up', img: cone, x: 40, y: 46, rot, sc: 0.55, ax: 0.5, ay: 0.74 });
  const CONE_KNEE = cone => ({ sym: 'bf/bf armrest', img: cone, x: 30, y: 112, rot: -24, sc: 0.55, ax: 0.5, ay: 0.86 });
  const GF_CONE = (rot) => ({ sym: 'gf/gf armfrontbent', img: CONE_CHOC, x: 40, y: 104, rot: rot != null ? rot : -32, sc: 0.5, ax: 0.5, ay: 0.86 });
  const POSES = {
    // BF: holding his cone up by his mouth, licking it
    bfEat: { f: 110, ed: { 'bf/bf arm up': { rot: -60 }, 'bf/bf faces': { ff: 4 } }, hold: [CONE_UP(CONE_PINK, 88)] },
    bfGrin: { f: 110, ed: { 'bf/bf arm up': { rot: -40 }, 'bf/bf faces': { ff: 7 } }, hold: [CONE_UP(CONE_PINK, 30)] },
    bfChomp: { f: 110, ed: { 'bf/bf arm up': { rot: -52 }, 'bf/bf faces': { ff: 3 }, 'bf/BF Head defalt': { rot: -5 } }, hold: [Object.assign(CONE_UP(CONE_PINK, 100), { top: true })] },
    bfFreeze: { f: 66, hold: [CONE_KNEE(CONE_PINK)] },
    bfLook: { f: 112, hold: [CONE_KNEE(CONE_PINK)] },
    bfJolt: { f: 112, ed: { 'bf/bf faces': { ff: 5 } }, hold: [CONE_KNEE(CONE_PINK)] },
    bfWind: { f: 110, ed: { 'bf/bf arm up': { rot: -70 }, 'bf/bf faces': { ff: 7 } }, hold: [CONE_UP(CONE_PINK, 70)] },
    bfThrow: { f: 110, ed: { 'bf/bf arm up': { rot: 45 }, 'bf/bf faces': { ff: 3 } } },
    gfEat: { f: 42, hold: [GF_CONE(0)] },
    gfLaugh: { f: 72, hold: [GF_CONE(0)] },
    gfLook: { f: 108, hold: [GF_CONE(-20)] },
  };
  G.WrathPoses = POSES;

  // ---------------------------------------------------------------- BF + GF on the bench
  // Cut out of the user's bench picture (tools/own/bench_cut.py: flat colours, clean ink). Every pose
  // keeps the spot it had in the picture, measured from GF's corner, so they line up like drawn.
  // Mirrored: GF sits on the left (WRATH walks up to her first), BF on the right by the trash can.
  const SIT = 'shared/images/wrath-park/sit/';
  const SIT_SC = 0.88, SIT_FLIP = true, SIT_X = 698, SIT_Y = 592.8 - 328 * 0.88;
  const SIT_POSES = { bf: { eat: ['bf-eat', 'eat'], lick: ['bf-lick', 'lick'], freeze: ['bf-freeze', 'freeze'] }, gf: { sit: ['gf-freeze', 'freeze'] } };
  G.sitSprite = function (who, z) {
    const meta = G.A.json(SIT + 'sit.json'); if (!meta) return null;
    const s = new G.Sprite(0, 0);
    s.poses = {};
    for (const name in SIT_POSES[who]) {
      const [file, panel] = SIT_POSES[who][name], m = meta[file], g = meta['gfpos-' + panel];
      s.poses[name] = { img: G.A.image(SIT + file + '.png'), rx: m.x - g.x, ry: m.y - g.y, w: m.w, h: m.h };
    }
    s.flipX = SIT_FLIP; s.zIndex = z; s.sq = 0;
    s.anims.pose = { kind: 'own', n: 1, fps: 24, loop: true }; s.cur = s.anims.pose; s.animName = 'pose'; s.finished = false;
    // where a picture point lands in the world
    s.place = function () {
      const p = this.pp, sx = SIT_SC * (1 + this.sq * 0.5), sy = SIT_SC * (1 - this.sq);
      this.frameW = p.w; this.frameH = p.h; this.scale.x = sx; this.scale.y = sy; this.updateHitbox();
      const left = SIT_FLIP ? SIT_X - (p.rx + p.w) * SIT_SC : SIT_X + p.rx * SIT_SC, top = SIT_Y + p.ry * SIT_SC;
      // squash keeps the seat (bottom middle) still
      this.home = { x: left + p.w * (SIT_SC - sx) / 2, y: top + p.h * (SIT_SC - sy) };
      this.x = this.home.x; this.y = this.home.y;
    };
    s.setPose = function (n) { if (!this.poses[n]) return; this.poseName = n; this.pp = this.poses[n]; this.place(); };
    s.squash = function (q) { this.sq = q; this.place(); };
    // world point of a picture point (relative to this pose's corner)
    s.at = function (px, py) { const p = this.pp; return { x: SIT_FLIP ? this.home.x + (p.w - px) * SIT_SC : this.home.x + px * SIT_SC, y: this.home.y + py * SIT_SC }; };
    let off = null;
    s.fx = { draw(sp, ctx) {
      const p = sp.pp; if (!p || !p.img) return;
      const t = sp.tint;
      if (!t || !(t.a > 0)) { ctx.drawImage(p.img, 0, 0); return; }
      if (!off) off = document.createElement('canvas');
      if (off.width !== p.w || off.height !== p.h) { off.width = p.w; off.height = p.h; }
      const o = off.getContext('2d');
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, p.w, p.h); o.drawImage(p.img, 0, 0);
      o.globalCompositeOperation = 'source-atop';
      const g = o.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r);
      g.addColorStop(0, t.color.replace('A', t.a.toFixed(3))); g.addColorStop(0.6, t.color.replace('A', (t.a * 0.7).toFixed(3))); g.addColorStop(1, t.color.replace('A', '0'));
      o.fillStyle = g; o.fillRect(0, 0, p.w, p.h);
      ctx.drawImage(off, 0, 0);
    } };
    s.setPose(Object.keys(s.poses)[0]);
    return s;
  };

  // ---------------------------------------------------------------- the cutscene
  const SND = 'shared/sounds/wrath-park/', DLG = 'shared/images/dialogue/', FX = 'shared/images/fx/';
  const JINGLE = 'shared/music/wrath-park/jingle.ogg', JBPM = 116;
  const CAN = { x: 1393, y: 600 };                                   // the trash can's mouth (world)
  const LINES = [
    { who: 'wrath', text: "heh. brain freeze? that's tragic, little man." },
    { who: 'gf', text: 'and who asked you?' },
    { who: 'wrath', text: "name's WRATH. and you're way too cool to be stuck with a popsicle.", anim: 'hey' },
    { who: 'bf', text: 'Beep?!', box: 'angry' },
    { who: 'gf', text: "he's my boyfriend, genius." },
    { who: 'wrath', text: "boyfriend? HIM? okay. let's hear if he's got a voice. one song. loser walks.", anim: 'singUP', at: { 'one song': 'singRIGHT' } },
    { who: 'bf', text: 'Bop!', box: 'angry' },
  ];
  const ease = {
    out: k => 1 - Math.pow(1 - k, 3), inOut: k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    expo: k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k), back: k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
  };
  const wait = s => ({ t: s });
  const until = f => ({ f });

  G.Cutscenes = G.Cutscenes || {};
  G.Cutscenes.glare = {
    create(P) {
      if (P.stage.id !== 'wrathPark' || !G.A.json(SIT + 'sit.json')) return null;
      const cs = Object.create(Scene);
      cs.init(P);
      return cs;
    },
  };
  const Scene = {
    init(P) {
      const st = P.stage;
      this.P = P; this.done = false; this.t = 0; this.black = 1; this.dim = 0;
      this.getup = (G.query && G.query.getup) || G.settings.wrathGetup || 'hop';
      this.orig = { bf: st.chars.bf, gf: st.chars.gf };
      st.chars.bf = null; st.chars.gf = null;
      // BF + GF on the bench (cut from the user's bench picture)
      const sit = (who, z) => { const s = G.sitSprite(who, z); st.props.push(s); return s; };
      this.gf = sit('gf', 60); this.bf = sit('bf', 61);
      // the blue brain-freeze bolts (same picture), over BF's head
      const meta = G.A.json(SIT + 'sit.json'), bm = meta.bolts, gp = meta['gfpos-freeze'];
      const bo = this.bolts = new G.Sprite(0, 0).loadImage(SIT + 'bolts.png');
      bo.flipX = SIT_FLIP; bo.scale.x = bo.scale.y = SIT_SC; bo.updateHitbox(); bo.zIndex = 62; bo.visible = false;
      bo.home = { x: SIT_X - (bm.x - gp.x + bm.w) * SIT_SC, y: SIT_Y + (bm.y - gp.y) * SIT_SC }; bo.x = bo.home.x; bo.y = bo.home.y;
      st.props.push(bo);
      this.dad = P.dad;
      // WRATH isn't here yet: he walks in from the left when he starts talking
      this.dadHome = { x: P.dad.originalPosition.x, y: P.dad.originalPosition.y };
      this.dad.x = this.dadHome.x - 950; this.walk = null;
      this.kenny = st.props.find(p => p.name === 'kenny');
      if (this.kenny) { this.kenny.visible = true; this.kenny.play('serve', true); this.kenny.onFinish = n => { if (n === 'serve') this.kenny.play('idle', true); }; }
      this.can = st.props.find(p => p.name === 'trashcan');
      if (this.can) this.can.home = { x: this.can.x, y: this.can.y };
      // the thrown cone + little effects
      this.cone = null; this.fxs = [];
      // FNF's own effect art (tools/own/fx.py): icy zap + sparks for the brain freeze, dust puffs
      G.A.warmNow([FX + 'ice-zap.png', FX + 'ice-twinkle.png', FX + 'ice-sparks.png', FX + 'dust.png', FX + 'can-impact.png']);
      // dialogue box (Psych Engine's speech bubble) + FNF letters
      const b = this.box = new G.Sprite(70, 370); b.loadSparrow(DLG + 'speech_bubble');
      for (const [n, pre, loop] of [['normal', 'speech bubble normal', true], ['normalOpen', 'Speech Bubble Normal Open', false], ['angry', 'AHH speech bubble', true], ['angryOpen', 'speech bubble loud open', false],
        ['center-normal', 'speech bubble middle', true], ['center-normalOpen', 'Speech Bubble Middle Open', false], ['center-angry', 'AHH Speech Bubble middle', true], ['center-angryOpen', 'speech bubble Middle loud open', false]])
        b.addAnim(n, pre, 24, loop);
      b.play('normal', true); b.setGraphicSize(b.frameW * 0.9); b.updateHitbox(); this.boxScale = b.scale.x; b.visible = false;
      this.text = new G.Alphabet('', 'default', 175, 460); this.text.scale = 0.7;
      this.line = null; this.typed = 0; this.full = ''; this.tt = 0;
      // camera
      this.cam = { x: 700, y: 470, z: 0.86, tw: null };
      this.setCam(700, 470, 0.86);
      P.hud.alpha = 0;
      G.audio.preload(['bf-beep', 'crunch', 'freeze', 'sparkle', 'shiver', 'clang', 'whoosh', 'whip', 'puff', 'toss', 'gf-laugh'].map(n => SND + n + '.ogg').concat(
        [...Array(8).keys()].flatMap(i => ['bf', 'gf', 'wrath'].map(w => SND + w + i + '.ogg'))));
      G.audio.music.play(JINGLE, { vol: 0.55, fadeIn: 1.2, bpm: JBPM });
      this.step = 0; this.beatT = 0;
      this.co = this.script(); this.wait = null; this.advance = false;
    },
    // ------------------------------------------------ camera helpers (world centre + zoom)
    setCam(x, y, z) { this.cam.tw = null; this.cam.x = x; this.cam.y = y; this.cam.z = z; },
    moveCam(x, y, z, dur, e) { this.cam.tw = { x0: this.cam.x, y0: this.cam.y, z0: this.cam.z, x, y, z, t: 0, dur, e: e || ease.inOut }; },
    camOn(who, z) {
      if (who === 'wrath') return this.moveCam(330, 560, z || 1.05, 0.55, ease.expo);
      if (who === 'gf') return this.moveCam(570, 440, z || 1.25, 0.55, ease.expo);
      if (who === 'bf') return this.moveCam(815, 440, z || 1.3, 0.55, ease.expo);
    },
    // ------------------------------------------------ the scene, shot by shot
    *script() {
      const B = this.bf, Gf = this.gf;
      // 1. a sunny day at the park. Kenny hands out cones, BF + GF eat on the bench
      this.moveCam(760, 455, 0.92, 4.5, ease.inOut);
      this.licking = true;
      yield wait(4.2);
      // 2. closer: BF looks at his cone... and takes a HUGE bite
      this.moveCam(815, 440, 1.45, 1.6, ease.inOut);
      yield wait(1.8);
      this.licking = false; B.setPose('eat');
      yield wait(0.7);
      B.setPose('lick'); this.squash(B, 0.06); G.sfx(SND + 'crunch.ogg', { vol: 1 }); this.punch(0.08); this.P.cam.shake(0.004, 0.15);
      yield wait(0.25); G.sfx(SND + 'crunch2.ogg', { vol: 0.8 });
      yield wait(0.45);
      // 3. BRAIN FREEZE: everything stops, he goes blue, shivers, holds his head
      G.audio.music.setVolume(0.12, 0.15);
      B.setPose('freeze'); this.squash(B, -0.08); this.freeze = 1; this.bolts.visible = true; this.boltT = 0;
      G.sfx(SND + 'freeze.ogg', { vol: 0.9 }); G.sfx(SND + 'sparkle.ogg', { vol: 0.7 }); G.sfx(SND + 'shiver.ogg', { vol: 0.8 });
      if (G.settings.flashing !== false) this.P.cam.flash('#cfefff', 0.45);
      this.punch(0.12); this.iceZap();
      yield wait(1.6);
      // 4. GF laughs at him
      this.moveCam(740, 445, 1.12, 0.9, ease.inOut);
      G.audio.music.setVolume(0.45, 1.2);
      yield wait(0.35);
      G.sfx(SND + 'gf-laugh.ogg', { vol: 0.8 }); this.bounce(Gf, 3);
      yield wait(1.6);
      // 5. a voice from the side... WRATH
      B.setPose('eat'); this.bolts.visible = false;
      G.sfx(SND + 'whip.ogg', { vol: 0.7 });
      G.audio.music.setVolume(0.28, 0.6);
      yield* this.wrathWalksIn();
      for (const L of LINES.slice(0, -1)) { yield* this.say(L); }
      // 6. "Bop!" -> the cone goes in the trash
      yield* this.say(LINES[LINES.length - 1], true);
      this.moveCam(1040, 470, 1.0, 0.5, ease.expo);
      this.squash(B, 0.07); yield wait(0.28);
      this.squash(B, -0.06); G.sfx(SND + 'toss.ogg', { vol: 0.9 });
      this.throwCone();
      yield until(() => !this.cone);
      G.sfx(SND + 'clang.ogg', { vol: 1 }); this.canShake = 0.6; this.P.cam.shake(0.006, 0.2); this.fxSprite(FX + 'can-impact', 'CanImpactParticle', CAN.x - 10, CAN.y - 60, 0.9 / 0.6, { fps: 16 });
      this.bounce(Gf, 2);
      yield wait(0.75);
      // 7. BF gets up -> the battle
      yield* this.getUp();
      this.finish();
    },
    *say(L, last) {
      const changed = !this.line || this.line.who !== L.who;
      this.line = L; this.full = this.wrap(L.text); this.typed = 0; this.tt = 0; this.text.setText('');
      this.text.y = 460 - (this.full.split('\n').length > 2 ? 60 : 0);
      const pos = L.who === 'gf' ? 'center' : L.who === 'bf' ? 'right' : 'left';
      const anim = (pos === 'center' ? 'center-' : '') + (L.box || 'normal');
      const b = this.box; b.visible = true; b.flipX = pos === 'left';
      if (changed || !b.animName.startsWith(anim)) { b.play(anim + 'Open', true); G.sfx(DLG_SND + 'dialogue.ogg', { vol: 0.5 }); }
      this.boxOffsets();
      this.dim = 0.25;
      if (changed) this.camOn(L.who);
      // who's talking reacts
      if (L.who === 'wrath') { this.dad.playAnim(L.anim || 'idle', true); if (L.anim) this.dad.holdTimer = -99; }
      if (L.who === 'bf') { this.B_jolt = 0.25; G.sfx(SND + (L.text.startsWith('Beep') ? 'bf-beep' : 'bf0') + '.ogg', { vol: 0.9 }); }
      if (L.who === 'gf') this.bounce(this.gf, 1);
      this.advance = false;
      yield until(() => this.typed >= this.full.length && (this.advance || (last && this.tt > 0.6)));
      G.sfx(DLG_SND + 'dialogueClose.ogg', { vol: 0.55 });
      if (L.who === 'wrath' && L.anim) { this.dad.holdTimer = 0; }
      if (last) { const n = b.animName.replace('Open', ''); b.play(n + 'Open', true, true); this.boxOffsets(); this.text.setText(''); this.dim = 0; this.line = null; this.closing = true; }
    },
    // he strolls in, a bounce on every step (his own walk drawings will replace this)
    *wrathWalksIn() {
      const D = this.dad;
      this.moveCam(420, 520, 1.0, 1.9, ease.inOut);
      this.walk = { t: 0, dur: 1.9, x0: D.x, x1: this.dadHome.x, steps: 6 };
      D.playAnim('idle', true);
      yield until(() => !this.walk);
      D.playAnim('idle', true);
    },
    *getUp() {
      const P = this.P, st = P.stage, B = this.bf;
      const battle = () => {
        for (const o of [this.bf, this.gf, this.bolts]) if (st.props.includes(o)) st.props.splice(st.props.indexOf(o), 1);
        st.chars.bf = this.orig.bf; st.chars.gf = this.orig.gf;
        if (this.kenny) this.kenny.visible = false;
      };
      if (this.getup === 'fade') {
        G.audio.music.stop(0.8);
        yield until(() => (this.black = Math.min(1, this.black + this.dt * 2.2)) >= 1);
        battle(); this.toBattleCam(true);
        yield wait(0.25);
        yield until(() => (this.black = Math.max(0, this.black - this.dt * 2.5)) <= 0);
        return;
      }
      if (this.getup === 'whip') {
        G.sfx(SND + 'whip.ogg', { vol: 0.8 });
        this.moveCam(330, 560, 1.15, 0.35, ease.expo);
        this.dad.playAnim('hey', true); this.dad.holdTimer = -99;
        yield wait(0.45);
        battle(); G.audio.music.stop(0.6);
        G.sfx(SND + 'whip.ogg', { vol: 0.8 });
        this.moveCam(1000, 520, 0.95, 0.35, ease.expo);
        this.orig.bf.playAnim('hey', true);
        yield wait(0.9);
        this.dad.holdTimer = 0;
        this.toBattleCam(false); yield wait(0.6);
        return;
      }
      // 'hop': BF jumps off the bench to his spot, lands in a dust puff
      const A = this.orig.bf, x0 = B.x + B.width / 2, y0 = B.y + B.height * 0.75;
      G.sfx(SND + 'whoosh.ogg', { vol: 0.8 });
      this.moveCam(980, 560, 0.95, 0.5, ease.inOut);
      st.props.splice(st.props.indexOf(B), 1);
      st.chars.bf = A; A.playAnim('singUP', true); A.holdTimer = -99;
      const ax = A.x, ay = A.y, fx = A.x + A.width / 2, fy = A.y + A.height;
      let k = 0;
      yield until(() => {
        k = Math.min(1, k + this.dt / 0.5);
        const x = G.lerp(x0, fx, k), y = G.lerp(y0, fy, k) - Math.sin(Math.PI * k) * 260;
        A.x = ax + (x - fx); A.y = ay + (y - fy);
        return k >= 1;
      });
      A.x = ax; A.y = ay; A.playAnim('singDOWN', true); A.holdTimer = 0;
      G.sfx(SND + 'puff.ogg', { vol: 0.9 }); this.dustAt(fx, fy, 2); P.cam.shake(0.005, 0.15);
      yield wait(0.35);
      A.playAnim('hey', true);
      G.audio.music.stop(0.8);
      yield wait(0.55);
      // GF: off camera she hops onto her speakers
      battle();
      this.toBattleCam(false);
      yield wait(0.7);
    },
    toBattleCam(snap) {
      const P = this.P, f = P.dad.camFocus;
      const z = P.stageZoom;
      if (snap) this.setCam(f.x, f.y, z); else this.moveCam(f.x, f.y, z, 0.7, ease.inOut);
    },
    finish() {
      const P = this.P, st = P.stage;
      for (const o of [this.bf, this.gf, this.bolts]) if (o && st.props.includes(o)) st.props.splice(st.props.indexOf(o), 1);
      st.chars.bf = this.orig.bf; st.chars.gf = this.orig.gf;
      this.orig.bf.x = this.orig.bf.originalPosition.x; this.orig.bf.y = this.orig.bf.originalPosition.y;
      this.walk = null; this.dad.x = this.dadHome.x; this.dad.y = this.dadHome.y; this.dad.angle = 0;
      if (this.kenny) this.kenny.visible = false;
      if (this.can && this.can.home) { this.can.x = this.can.home.x; this.can.y = this.can.home.y; this.can.angle = 0; }
      G.audio.music.stop(0.5);
      const f = P.dad.camFocus; P.cam.focus(f.x, f.y); P.cam.zoom = P.camZoom = P.stageZoom; P.cam.sx = P.cam.sy = 0;
      this.dad.holdTimer = 0; this.dad.dance(true);
      P.hud.alpha = 1;
      this.done = true;
    },
    // ------------------------------------------------ little effects
    punch(z) { this.punchZ = (this.punchZ || 0) + z; },
    // a quick squash (+) or stretch (-) that springs back, FNF style
    squash(s, q) { s.sqT = 0; s.sqA = q; },
    bounce(s, n) { s.bounceT = 0; s.bounceN = n; },
    // one FNF effect sprite in the world: plays once, then goes away
    fxSprite(sheet, prefix, x, y, sc, opt) {
      const o = opt || {};
      const sp = new G.Sprite(0, 0).loadSparrow(sheet);
      if (!sp.sheet) return null;
      if (!sp.addAnim('go', prefix, o.fps || 24, false)) return null;     // (prefix = the whole frame name minus the numbers)
      sp.play('go', true);
      sp.scale.x = sp.scale.y = sc; sp.updateHitbox();
      sp.flipX = !!o.flip; sp.angle = o.angle || 0; sp.blend = o.blend || null; sp.alpha = o.alpha == null ? 1 : o.alpha;
      sp.x = x - sp.width / 2; sp.y = o.bottom ? y - sp.height : y - sp.height / 2;
      sp.done = false; sp.onFinish = () => { sp.done = true; };
      this.fxs.push(sp);
      return sp;
    },
    // BRAIN FREEZE: Weekend 1's impact flash in ice blue + freeplay's spark burst, from his head
    iceZap() {
      const h = this.bf.at(135, 175);
      this.fxSprite(FX + 'ice-zap', 'CanImpactParticle', h.x + 70, h.y - 55, 0.75 / 0.6, { flip: true, angle: -30, fps: 12 });
      this.fxSprite(FX + 'ice-sparks', 'sparks', h.x, h.y, 0.8 / 0.5, { fps: 12 });
    },
    // little icy twinkles popping round his head while he shivers
    twinkle() {
      const h = this.bf.at(135, 175), a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 90;
      this.fxSprite(FX + 'ice-twinkle', 'sparkle Export', h.x + Math.cos(a) * r, h.y + Math.sin(a) * r * 0.8, 2.2 + Math.random() * 1.2, { fps: 24 });
    },
    // a dust cloud on the ground (Weekend 1's explosion smoke, recoloured + flattened)
    dustAt(x, y, sc) {
      this.fxSprite(FX + 'dust', 'explosion round 1 short', x, y + 12, (sc || 1) / 0.22 * 0.2, { bottom: true, fps: 24 });
    },
    throwCone() {
      const B = this.bf, h = B.at(74, 237);                 // his cone, in the picture
      this.cone = { x0: h.x, y0: h.y, x1: CAN.x, y1: CAN.y, t: 0, dur: 0.62, img: G.A.image(SIT + 'cone-vanilla.png'), rot: 0 };
    },
    // ------------------------------------------------ frame
    update(dt) {
      const P = this.P; this.dt = dt; this.t += dt;
      // the script
      if (this.co) {
        let w = this.wait;
        const ready = !w || (w.t != null ? (w.t -= dt) <= 0 : w.f());
        if (ready) { const r = this.co.next(); if (r.done) this.co = null; else this.wait = r.value; }
      }
      if (this.t < 1.2 && this.black > 0 && this.getupPhase !== 'fade') this.black = Math.max(0, 1 - this.t / 1.0);
      // everyone bops to the jingle
      this.beatT += dt;
      const spb = 60 / JBPM / 4;
      while (this.beatT >= spb) {
        this.beatT -= spb; this.step++;
        for (const c of [this.dad, this.P.stage.chars.bf, this.P.stage.chars.gf]) if (c) c.onStep ? c.onStep(this.step) : null;
        if (this.step % 4 === 0) this.onBeat(this.step / 4);
      }
      for (const c of [this.dad, P.stage.chars.bf, P.stage.chars.gf]) if (c) c.tick(dt, spb, false);
      P.stage.update(dt);
      // camera tween + punch
      const C = this.cam;
      if (C.tw) { const w = C.tw; w.t += dt; const k = Math.min(1, w.t / w.dur), e = w.e(k); C.x = G.lerp(w.x0, w.x, e); C.y = G.lerp(w.y0, w.y, e); C.z = G.lerp(w.z0, w.z, e); if (k >= 1) C.tw = null; }
      this.punchZ = (this.punchZ || 0) * Math.pow(0.02, dt);
      P.cam.x = P.cam.tx = C.x; P.cam.y = P.cam.ty = C.y; P.cam.zoom = C.z * (1 + this.punchZ);
      P.cam.update(dt);
      // BF: licking, jolting, shivering, cold face
      const B = this.bf;
      if (this.licking) { const p = Math.floor(this.t / 0.55) % 2 ? 'eat' : 'lick'; if (B.poseName !== p) { B.setPose(p); this.squash(B, p === 'lick' ? 0.04 : -0.03); } }
      for (const s of [this.gf, this.bf]) {
        if (s.sqA) { s.sqT += dt; const k = s.sqT / 0.22; s.squash(k >= 1 ? 0 : s.sqA * Math.cos(k * Math.PI * 1.5) * (1 - k)); if (k >= 1) s.sqA = 0; }
      }
      B.x = B.home.x; B.y = B.home.y;
      if (this.freeze > 0) {
        this.freeze = Math.max(0, this.freeze - dt / 3.6);
        const sh = Math.min(1, this.freeze * 1.6) * 4;
        B.x += (Math.floor(this.t * 40) % 2 ? sh : -sh);
        B.tint = { a: Math.min(0.55, this.freeze * 0.9), color: 'rgba(80,170,255,A)', x: 135, y: 175, r: 165 };
        const bo = this.bolts; this.boltT += dt;
        bo.visible = this.freeze > 0.15; bo.x = bo.home.x + (Math.floor(this.t * 30) % 2 ? 3 : -3); bo.y = bo.home.y + Math.sin(this.boltT * 20) * 2;
        bo.alpha = Math.min(1, this.freeze * 3); const bs = SIT_SC * (1 + 0.25 * Math.max(0, 1 - this.boltT / 0.18)); bo.scale.x = bo.scale.y = bs;
        if (Math.random() < dt * 5 * this.freeze) this.twinkle();
      } else B.tint = null;
      if (this.B_jolt > 0) { this.B_jolt = Math.max(0, this.B_jolt - dt); B.y -= Math.sin(this.B_jolt / 0.25 * Math.PI) * 18; }
      for (const s of [this.gf, this.bf]) if (s.bounceN) { s.bounceT += dt; const k = s.bounceT / 0.18; if (k >= s.bounceN) s.bounceN = 0; else s.y = s.home.y - Math.abs(Math.sin(k * Math.PI)) * 8; }
      // WRATH walking in
      const W = this.walk;
      if (W) {
        W.t += dt; const k = Math.min(1, W.t / W.dur), e = k < 0.85 ? k / 0.85 * 0.93 : 0.93 + (1 - Math.pow(1 - (k - 0.85) / 0.15, 2)) * 0.07;
        const ph = k * W.steps * Math.PI, step = Math.abs(Math.sin(ph));
        this.dad.x = G.lerp(W.x0, W.x1, e);
        this.dad.y = this.dadHome.y - step * 16 * (1 - k * 0.6);
        this.dad.angle = Math.sin(ph) * 2.2 * (1 - k);
        if (Math.floor(ph / Math.PI) !== W.lastStep) { W.lastStep = Math.floor(ph / Math.PI); if (k < 0.97) G.sfx(SND + 'puff.ogg', { vol: 0.18 }); }
        if (k >= 1) { this.dad.x = W.x1; this.dad.y = this.dadHome.y; this.dad.angle = 0; this.walk = null; }
      }
      // trash can rattles
      if (this.can && this.canShake > 0) { this.canShake = Math.max(0, this.canShake - dt); const k = this.canShake / 0.6; this.can.angle = Math.sin(this.t * 55) * 9 * k; this.can.x = this.can.home.x + Math.sin(this.t * 40) * 5 * k; }
      else if (this.can && this.can.home) { this.can.angle = 0; this.can.x = this.can.home.x; }
      // the thrown cone
      const c = this.cone;
      if (c) { c.t += dt; if (c.t >= c.dur) this.cone = null; }
      // particles
      for (const f of this.fxs) f.update(dt);
      this.fxs = this.fxs.filter(f => !f.done);
      // dialogue box + typing
      const b = this.box; b.update(dt);
      if (b.visible && b.finished && b.animName.endsWith('Open')) { if (this.closing) { b.visible = false; this.closing = false; } else { b.play(b.animName.replace('Open', ''), true); this.boxOffsets(); } }
      this.type(dt);
    },
    onBeat(beat) {
      // GF + BF bop a little on the beat while they eat
      if (this.licking && beat % 2 === 0) this.bounce(this.gf, 1);
    },
    type(dt) {
      const L = this.line; if (!L) return;
      this.tt += dt;
      if (this.typed >= this.full.length) return;
      if (this.box.animName.endsWith('Open')) return;
      const delay = 0.055;
      while (this.tt >= delay && this.typed < this.full.length) {
        this.tt -= delay;
        const ch = this.full[this.typed];
        this.typed++;
        if (L.who !== 'bf' && /[a-z?!]/i.test(ch) && this.typed % 2 === 1) G.sfx(SND + L.who + Math.floor(Math.random() * 8) + '.ogg', { vol: L.who === 'wrath' ? 0.75 : 0.7 });
        if (L.at) for (const k in L.at) if (this.full.slice(0, this.typed).replace(/\n/g, ' ').endsWith(k)) { this.dad.playAnim(L.at[k], true); this.dad.holdTimer = -99; }
      }
      if (this.typed >= this.full.length) this.tt = 0;
      this.text.setText(this.full.slice(0, this.typed));
    },
    boxOffsets() {
      const b = this.box, n = b.animName;
      b.scale.x = b.scale.y = this.boxScale; b.updateHitbox();
      if (n.startsWith('angry')) { b.offset.x = 50; b.offset.y = 65; }
      else if (n.startsWith('center-angry')) { b.offset.x = 50; b.offset.y = 30; }
      else { b.offset.x = 10; b.offset.y = 0; }
      if (!b.flipX) b.offset.y += 10;
    },
    wrap(text) {
      const m = new G.Alphabet('', 'default'), maxW = 930 / 0.7;
      const out = []; let line = '';
      for (const w of text.split(' ')) {
        const tryL = line ? line + ' ' + w : w;
        m.setText(tryL);
        if (m.width > maxW && line) { out.push(line); line = w; } else line = tryL;
      }
      if (line) out.push(line);
      return out.join('\n');
    },
    onAction(a, down, repeat) {
      if (!down || repeat) return;
      if (a === 'back') { this.skip(); return; }
      if (a === 'accept') {
        if (this.line && this.typed < this.full.length) { this.typed = this.full.length; this.text.setText(this.full); this.tt = 0; }
        else this.advance = true;
      }
    },
    skip() {
      if (this.done) return;
      this.co = null; this.box.visible = false; this.line = null; this.cone = null; this.fxs = [];
      this.finish();
    },
    // drawn over the world
    draw(ctx) {
      const P = this.P;
      // world-space effects: the flying cone + particles
      const c = this.cone;
      if (c && c.img) {
        P.cam.apply(ctx, 1, 1);
        const k = Math.min(1, c.t / c.dur), x = G.lerp(c.x0, c.x1, k), y = G.lerp(c.y0, c.y1, k) - Math.sin(Math.PI * k) * 330;
        ctx.save(); ctx.translate(x, y); ctx.rotate(k * Math.PI * 3.2); ctx.scale(0.36, 0.36); ctx.drawImage(c.img, -c.img.width / 2, -c.img.height / 2); ctx.restore();
      }
      for (const f of this.fxs) f.draw(ctx, P.cam);
      G.setScreenT(ctx);
      if (this.dim > 0) { ctx.fillStyle = 'rgba(0,0,0,' + this.dim.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
      if (this.box.visible) this.box.draw(ctx, null);
      if (this.line && this.box.visible && !this.box.animName.endsWith('Open')) this.text.draw(ctx, null);
      if (!this.done) G.vcr(ctx, 'Press BACK to Skip', G.W - 20, G.H - 30, { size: 16, align: 'right', outline: 2 });
      if (this.black > 0) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,' + this.black.toFixed(3) + ')'; ctx.fillRect(0, 0, G.W, G.H); }
    },
  };
  const DLG_SND = 'shared/sounds/wrath-intro/';

  // ---------------------------------------------------------------- dev: ?dev=screen&name=devPose&show=bfEat,bfChomp,gfEat
  G.screens.devPose = {
    enter(p) {
      this.stage = new G.Stage(p.stage || 'wrathPark');
      this.cam = new G.FCam(+(p.zoom || 0.95));
      this.cam.focus(+(p.cx || 760), +(p.cy || 470));
      const list = (p.show || 'bfEat,gfEat').split(',');
      this.pups = list.map((name, i) => {
        const isBF = name.startsWith('bf');
        if (!POSES[name.split(':')[0]]) return null;
        const s = G.puppetSprite(isBF ? BF : GF);
        const [nm, rot] = name.split(':');
        s.pose = JSON.parse(JSON.stringify(POSES[nm])); s.label = name;
        const crot = name.split(':')[2]; if (crot != null && s.pose.hold && s.pose.hold[0]) s.pose.hold[0].rot = +crot;
        if (rot != null) { if (rot.startsWith('f')) { s.pose.ed = s.pose.ed || {}; s.pose.ed['bf/bf faces'] = { ff: +rot.slice(1) }; } else { const k = Object.keys(s.pose.ed || {}).find(k => /arm/.test(k)); if (k) s.pose.ed[k].rot = +rot; } }
        s.scale.x = s.scale.y = isBF ? 0.62 : 0.66; s.updateHitbox();
        s.flipX = isBF ? p.flip !== '0' : false;
        s.sitAt(+(p.x0 || 520) + i * +(p.dx || 260), +(p.y || 548));
        s.zIndex = 70 + i;
        return s;
      });
      this.pups = this.pups.filter(Boolean);
      for (const s of this.pups) this.stage.props.push(s);
    },
    update(dt) { this.stage.update(dt); this.cam.update(dt); },
    draw(ctx) {
      G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
      this.stage.draw(ctx, this.cam);
      G.setScreenT(ctx);
      this.pups.forEach((s, i) => G.vcr(ctx, s.label, 10 + i * 200, G.H - 30, { size: 18 }));
    },
  };
})();
