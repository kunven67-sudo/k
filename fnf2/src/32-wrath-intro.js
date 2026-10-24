// FNF 2 - WRATH's intro (plays before GLARE): BF + GF eating ice cream on the night street by the
// Scoops Ahoy truck, WRATH walks up and hits on GF, FNF-style dialogue boxes (Psych Engine's
// speech bubble + BF/GF portraits), everyone talks in beep-bop voice blips cut from FNF's own vocals.
// Then a quick fade: cones put away, GF hops on her speakers, the song starts in the same place.
// Art: the ice creams + truck come from the user's pictures, the cone from the "Sweet Treats and Icy
// Beats" mod, standing GF from Luvrgirl's "Standing GF!" mod (all private, see private/CREDITS-mods.txt).
(function () {
  const IMG = 'shared/images/wrath-intro/';
  const DLG = 'shared/images/dialogue/';
  const SND = 'shared/sounds/wrath-intro/';
  const W = () => G.W, H = () => G.H;

  // the lines (speaker, portrait expression, box style, text). BF only ever says beeps and bops.
  const SCRIPT = [
    { who: 'wrath', box: 'normal', text: "hey, is this your brother? he looks like a loser" },
    { who: 'bf', exp: 'pissed', box: 'angry', text: 'BEEP?! skee-bop bap!!' },
    { who: 'gf', exp: 'confused', box: 'normal', text: "um, he's not my brother. he's my boyfriend. no thanks" },
    { who: 'wrath', box: 'normal', text: "...fine. then i'll beat him, and you're coming with me" },
    { who: 'bf', exp: 'excited', box: 'normal', text: 'bop! beep bap skdoo!' },
  ];
  const GF_STAND = [1760, 1228];                                   // GF stands next to BF (feet)

  // ---------------------------------------------------------------- dialogue portraits
  // Each speaker's portrait is their own in-scene sprite drawn big (GF standing with her cone, BF with
  // his, WRATH as the normal guy), sliding in like Psych Engine's DialogueCharacter (left/center/right).
  function portrait(id, slot, pos) {
    if (!G.A.json('preload/data/characters/' + id + '.json')) return null;
    const c = new G.Character(id, slot);
    c.flipX = slot === 'bf' ? !c.data.flipX : !!c.data.flipX;
    const k = 600 / c.frameH;
    c.scale.x = c.scale.y = k; c.updateHitbox();
    c.pos = pos; c.alpha = 0;
    return c;
  }

  // ---------------------------------------------------------------- the cutscene
  // the first intro is being remade (own place, HyperManiac GF, a real walking scene): off until it's ready
  const INTRO_ON = false;
  G.Cutscenes = G.Cutscenes || {};
  if (INTRO_ON) G.Cutscenes.glare = {
    create(P) {
      const st = P.stage;
      const cs = Object.create(Scene);
      cs.P = P; cs.t = 0; cs.done = false; cs.black = 1; cs.phase = 'walk';
      cs.orig = { bf: st.chars.bf, gf: st.chars.gf };
      // intro BF (strawberry cone) + standing GF (chocolate chip cone)
      cs.bf = G.A.json('preload/data/characters/bf-icecream.json') ? new G.Character('bf-icecream', 'bf') : null;
      if (cs.bf) st.addCharacter(cs.bf, 'bf');
      cs.gf = G.A.json('preload/data/characters/gf-icecream.json') ? new G.Character('gf-icecream', 'gf') : null;
      if (cs.gf) { st.addCharacter(cs.gf, 'gf'); cs.gf.place(GF_STAND); cs.gf.zIndex = 320; }
      cs.dad = P.dad;
      // dialogue pieces
      cs.box = new G.Sprite(70, 370); cs.box.loadSparrow(DLG + 'speech_bubble');
      for (const [n, pre, loop] of [['normal', 'speech bubble normal', true], ['normalOpen', 'Speech Bubble Normal Open', false], ['angry', 'AHH speech bubble', true], ['angryOpen', 'speech bubble loud open', false],
        ['center-normal', 'speech bubble middle', true], ['center-normalOpen', 'Speech Bubble Middle Open', false], ['center-angry', 'AHH Speech Bubble middle', true], ['center-angryOpen', 'speech bubble Middle loud open', false]])
        cs.box.addAnim(n, pre, 24, loop);
      cs.box.play('normal', true); cs.box.setGraphicSize(cs.box.frameW * 0.9); cs.box.updateHitbox(); cs.boxScale = cs.box.scale.x;
      cs.box.visible = false;
      cs.port = { bf: portrait('bf-icecream', 'bf', 'right'), gf: portrait('gf-icecream', 'gf', 'center'), wrath: portrait('wrath-normal', 'dad', 'left') };
      for (const k in cs.port) if (cs.port[k]) cs.place(cs.port[k]);
      cs.line = -1; cs.typed = 0; cs.text = ''; cs.full = ''; cs.tt = 0; cs.words = 0; cs.dim = 0;
      cs.alpha = new G.Alphabet('', 'default', 175, 460); cs.alpha.scale = 0.7;
      // camera: start on BF + GF eating
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      cs.fGroup = cs.gf && cs.bf ? mid(cs.gf.camFocus, cs.bf.camFocus) : P.bf.camFocus;
      cs.fAll = mid(cs.fGroup, P.dad.camFocus);
      P.cam.focus(cs.fGroup.x + 60, cs.fGroup.y - 20); P.cam.zoom = P.stageZoom * 1.18;
      P.hud.alpha = 0;
      G.audio.music.play('shared/music/breakfast/breakfast.ogg', { vol: 0.55, fadeIn: 1.5, bpm: 160 });
      cs.beatT = 0; cs.step = 0;
      return cs;
    },
  };
  const Scene = {
    place(s) {
      if (s.pos === 'right') { s.home = W() - s.width - 30; s.x = s.home + 600; s.y = 40; }
      else if (s.pos === 'center') { s.x = W() / 2 - s.width / 2; s.home = 20; s.y = H() + 50; }
      else { s.home = 0; s.x = s.home - 600; s.y = 10; }
      s.alpha = 0;
    },
    chars() { return [this.bf, this.gf, this.dad].filter(Boolean); },
    update(dt) {
      const P = this.P;
      this.t += dt;
      // everyone bops to the music (breakfast, 160 bpm, dance on beats)
      this.beatT += dt;
      const spb = 60 / 160 / 4;
      while (this.beatT >= spb) { this.beatT -= spb; this.step++; for (const c of this.chars()) c.onStep(this.step); P.stage.onStep(this.step); }
      for (const c of this.chars()) c.tick(dt, spb, false);
      P.stage.update(dt);
      const zoomTo = (z, k) => { P.cam.zoom += (z - P.cam.zoom) * (1 - Math.pow(1 - k, dt * 60)); };
      if (this.phase === 'walk') {
        this.black = Math.max(0, 1 - this.t / 1.2);
        if (this.t > 2.6) { P.cam.follow(this.fAll.x - 120, this.fAll.y - 40); }
        zoomTo(this.t > 2.6 ? P.stageZoom * 0.8 : P.stageZoom * 1.18, this.t > 2.6 ? 0.03 : 0.1);
        if (this.t > 4.4) this.next();
      } else if (this.phase === 'talk') {
        zoomTo(P.stageZoom * 0.8, 0.05);
        this.dim = Math.min(0.35, this.dim + dt * 0.5);
        this.type(dt);
      } else if (this.phase === 'close') {
        this.dim = Math.max(0, this.dim - dt);
        this.closeT += dt;
        if (this.closeT > 0.3) this.black = Math.min(1, this.black + dt * 3);
        if (this.black >= 1) this.swapBack();
      } else if (this.phase === 'in') {
        this.black = Math.max(0, this.black - dt * 2.5);
        if (this.black <= 0) { this.done = true; P.hud.alpha = 1; }
      }
      // the box: open anim, then its loop
      const b = this.box;
      b.update(dt);
      if (b.visible && b.finished && b.animName.endsWith('Open')) { if (this.phase === 'close') b.visible = false; else { b.play(b.animName.replace('Open', ''), true); this.boxOffsets(); } }
      // portraits slide + fade (Psych: 4000 px/s, alpha 3/s)
      for (const k of ['bf', 'gf', 'wrath']) {
        const s = this.port[k]; if (!s) continue;
        const on = this.phase === 'talk' && this.who === k;
        const sp = 4000 * dt;
        if (s.pos === 'center') s.y = on ? Math.max(s.home, s.y - sp) : Math.min(s.home + H(), s.y + sp);
        else if (s.pos === 'right') s.x = on ? Math.max(s.home, s.x - sp) : Math.min(s.home + 600, s.x + sp);
        else s.x = on ? Math.min(s.home, s.x + sp) : Math.max(s.home - 600, s.x - sp);
        s.alpha = G.clamp(s.alpha + (on ? 3 : -3) * dt, 0, 1);
        s.tick(dt, spb, false);
      }
    },
    // next line (or the end)
    next() {
      this.line++;
      if (this.line >= SCRIPT.length) return this.close();
      const L = SCRIPT[this.line], b = this.box;
      const pos = L.who === 'gf' ? 'center' : L.who === 'bf' ? 'right' : 'left';
      const anim = (pos === 'center' ? 'center-' : '') + (L.box || 'normal');
      const changed = L.who !== this.who;
      this.phase = 'talk'; this.who = L.who;
      b.visible = true; b.flipX = pos === 'left';
      if (changed) b.play(anim + 'Open', true); else if (!b.animName.startsWith(anim)) b.play(anim, true);
      this.boxOffsets();
      this.full = this.wrap(L.text); this.typed = 0; this.tt = 0; this.alpha.setText('');
      this.alpha.y = 460 - (this.full.split('\n').length > 2 ? 60 : 0);
      // the camera leans toward who's talking
      const c = L.who === 'wrath' ? this.dad : L.who === 'gf' ? this.gf : this.bf;
      if (c) this.P.cam.follow(G.lerp(this.fAll.x - 120, c.camFocus.x, 0.12), this.fAll.y - 40);
    },
    boxOffsets() {
      const b = this.box, n = b.animName;
      b.scale.x = b.scale.y = this.boxScale; b.updateHitbox();
      if (n.startsWith('angry')) { b.offset.x = 50; b.offset.y = 65; }
      else if (n.startsWith('center-angry')) { b.offset.x = 50; b.offset.y = 30; }
      else { b.offset.x = 10; b.offset.y = 0; }
      if (!b.flipX) b.offset.y += 10;
    },
    // word wrap for the FNF letters (Psych keeps text inside ~930 px)
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
    type(dt) {
      if (this.typed >= this.full.length) return;
      this.tt += dt;
      const delay = this.who === 'bf' ? 0.045 : 0.05;
      while (this.tt >= delay && this.typed < this.full.length) {
        this.tt -= delay;
        const ch = this.full[this.typed], prev = this.full[this.typed - 1];
        this.typed++;
        if (/[a-z!?.']/i.test(ch) && (this.typed === 1 || prev === ' ' || prev === '\n' || prev === '-')) this.blip();
      }
      this.alpha.setText(this.full.slice(0, this.typed));
    },
    blip() {
      const n = Math.floor(Math.random() * 8);
      G.sfx(SND + this.who + n + '.ogg', { vol: this.who === 'wrath' ? 0.8 : 0.7 });
      const p = this.port[this.who]; if (p) p.dance(true);          // a little bop on every word
    },
    close() {
      this.phase = 'close'; this.closeT = 0;
      const b = this.box;
      if (b.visible) { const n = b.animName.replace('Open', ''); b.play(n + 'Open', true, true); this.boxOffsets(); }
      this.alpha.setText('');
      G.sfx(SND + 'dialogueClose.ogg', { vol: 0.8 });
      G.audio.music.stop(1);
    },
    // back to the battle cast: cones away, GF on her speakers, camera on WRATH like the song's start
    swapBack() {
      const P = this.P, st = P.stage;
      st.chars.bf = this.orig.bf; st.chars.gf = this.orig.gf;
      P.cam.zoom = P.camZoom = P.stageZoom;
      const f = P.dad.camFocus; P.cam.focus(f.x, f.y);
      this.phase = 'in';
    },
    onAction(a, down, repeat) {
      if (!down || repeat) return;
      if (a === 'back') { if (this.phase === 'walk' || this.phase === 'talk') this.close(); return; }
      if (a !== 'accept') return;
      if (this.phase === 'walk') { this.t = Math.max(this.t, 4.4); return; }
      if (this.phase !== 'talk') return;
      if (this.typed < this.full.length) { this.typed = this.full.length; this.alpha.setText(this.full); }
      else { G.sfx(SND + 'dialogueClose.ogg', { vol: 0.6 }); this.next(); }
    },
    // drawn over the world (screen space)
    draw(ctx) {
      G.setScreenT(ctx);
      if (this.dim > 0) { ctx.fillStyle = 'rgba(0,0,0,' + this.dim.toFixed(3) + ')'; ctx.fillRect(0, 0, W(), H()); }
      const p = this.port;
      for (const k of ['wrath', 'gf', 'bf']) if (p[k] && p[k].alpha > 0) p[k].draw(ctx, null);
      if (this.box.visible) this.box.draw(ctx, null);
      if (this.phase === 'talk' && this.box.visible && !this.box.animName.endsWith('Open')) this.alpha.draw(ctx, null);
      if ((this.phase === 'talk' || this.phase === 'walk') && !G.touchMode) G.vcr(ctx, 'Press BACK to Skip', W() - 20, H() - 30, { size: 16, align: 'right', outline: 2 });
      if (this.black > 0) { G.setScreenT(ctx); ctx.fillStyle = 'rgba(0,0,0,' + this.black.toFixed(3) + ')'; ctx.fillRect(0, 0, W(), H()); }
    },
  };
})();
