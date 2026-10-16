// FNF 2 - developer preview screens (only reachable with ?dev=... in the URL).
//   ?dev=char&id=ace[&freeze=0.1][&page=0][&scale=1]   every animation of a character in a grid + icons + portrait
//   ?dev=stage&id=club[&song=0][&focus=dad|bf|gf|mid][&dad=echo][&ev=lightning@800,train@3000][&bpm=120][&zoom=0.9]
//   ?dev=icons                                         every registered character's health icons
//   ?dev=screen&name=freeplay                          jump straight to a screen
//   ?dev=song&id=afterhours&diff=hard[&player=nitro]   jump straight into a song (needs the play module)

// ---- placeholder silhouette, used when a character module isn't loaded yet
G.drawPlaceholderChar = function (ctx, who, color) {
  ctx.save();
  ctx.fillStyle = color || '#888'; ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
  const h = who === 'gf' ? 300 : 380;
  G.roundRect(ctx, -70, -h, 140, h, 60); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -h - 50, 60, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  G.text(ctx, who.toUpperCase(), 0, -h / 2, { size: 40, font: 'alpha', align: 'center', outline: 4 });
  ctx.restore();
};

// Standard renderer for one placed character (shared idea with the play module).
// slot = {id, x, y, flip, anim, at, scale}
G.drawSlot = function (ctx, slot, info, placeholderName) {
  if (!slot) return;
  if (slot.id && G.chars.get(slot.id)) G.chars.draw(ctx, slot.id, slot.anim || 'idle', slot.at || 0, slot.x, slot.y, slot.scale || 1, !!slot.flip, info);
  else { ctx.save(); ctx.translate(slot.x, slot.y); G.drawPlaceholderChar(ctx, placeholderName || slot.id || '?', '#777'); ctx.restore(); }
};

G.screens.devChar = {
  enter(p) {
    this.id = p.id || 'ace';
    this.page = +(p.page || 0);
    this.freeze = p.freeze != null ? +p.freeze : null;
    this.t = 0;
    this.bg = p.bg || '#5a5a6e';
  },
  update(dt) { this.t += dt; },
  onAction(a, down) {
    if (!down) return;
    if (a === 'ui_right') this.page++;
    if (a === 'ui_left') this.page = Math.max(0, this.page - 1);
  },
  draw(ctx) {
    G.setScreenT(ctx);
    ctx.fillStyle = this.bg; ctx.fillRect(0, 0, G.W, G.H);
    const def = G.chars.get(this.id);
    if (!def) { G.text(ctx, 'character "' + this.id + '" not registered', 40, 60, { size: 30, outline: 3 }); return; }
    const anims = Object.keys(def.anims);
    const per = 8, cols = 4, cw = 260, ch = 330;
    const list = anims.slice(this.page * per, this.page * per + per);
    const bpm = 100, crochet = 60 / bpm;
    list.forEach((a, i) => {
      const cx = 20 + (i % cols) * (cw + 10), cy = 10 + Math.floor(i / cols) * (ch + 10);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(cx, cy, cw, ch);
      let at;
      if (this.freeze != null) at = this.freeze;
      else if (a === 'idle' || a === 'danceLeft' || a === 'danceRight') at = this.t % (crochet * (a === 'idle' ? 2 : 1));
      else if (/death|Death/.test(a)) at = this.t % 3;
      else at = this.t % 0.9;
      const s = Math.min(cw / def.box.w, (ch - 30) / def.box.h) * 0.92;
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip();
      G.chars.draw(ctx, this.id, a, at, cx + cw / 2, cy + ch - 26, s, false, { beat: this.t / crochet, time: this.t, form: +(G.query.form || 0) });
      ctx.restore();
      G.text(ctx, a, cx + 6, cy + ch - 6, { size: 20, font: 'vcr', outline: 2 });
    });
    // icons + portrait on the right
    const ix = 1110;
    G.text(ctx, def.name || this.id, ix, 30, { size: 30, font: 'alpha', align: 'center', outline: 4 });
    G.chars.icon(ctx, this.id, ix - 75, 120, 150, false, this.t);
    G.chars.icon(ctx, this.id, ix + 75, 120, 150, true, this.t);
    G.text(ctx, 'icon / losing', ix, 210, { size: 18, font: 'vcr', align: 'center', outline: 2 });
    ctx.save(); ctx.beginPath(); ctx.rect(ix - 160, 230, 320, 320); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(ix - 160, 230, 320, 320);
    const emo = ['normal', 'happy', 'angry', 'sad', 'shock'][Math.floor(this.t / 1.2) % 5];
    if (!G.chars.portrait(ctx, this.id, ix, 390, 320, 320, emo, this.t)) G.text(ctx, 'no portrait', ix, 390, { size: 20, align: 'center' });
    ctx.restore();
    G.text(ctx, 'portrait: ' + emo, ix, 570, { size: 18, font: 'vcr', align: 'center', outline: 2 });
    // health colour swatch
    ctx.fillStyle = def.healthColor; ctx.fillRect(ix - 150, 590, 300, 20);
    G.text(ctx, 'page ' + (this.page + 1) + '/' + Math.ceil(anims.length / per) + '  (left/right)   anims: ' + anims.length, 20, G.H - 8, { size: 20, font: 'vcr', outline: 2 });
  },
};

G.screens.devIcons = {
  enter() { this.t = 0; }, update(dt) { this.t += dt; },
  draw(ctx) {
    G.setScreenT(ctx);
    ctx.fillStyle = '#2b2b38'; ctx.fillRect(0, 0, G.W, G.H);
    const ids = G.chars.list();
    ids.forEach((id, i) => {
      const x = 80 + (i % 8) * 150, y = 90 + Math.floor(i / 8) * 200;
      G.chars.icon(ctx, id, x, y, 130, false, this.t);
      G.chars.icon(ctx, id, x + 50, y + 70, 70, true, this.t);
      G.text(ctx, id, x, y + 85, { size: 18, font: 'vcr', align: 'center', outline: 2 });
    });
  },
};

// Minimal stage + characters preview (the real play module does much more).
G.screens.devStage = {
  enter(p) {
    this.def = G.stages.get(p.id || 'practice');
    const def = this.def;
    this.t = 0;
    this.bpm = +(p.bpm || 120);
    this.songIndex = +(p.song || 0);
    const week = G.WEEKS.find(w => w.stage === (def && def.id));
    const dadId = p.dad || (week ? week.opp : 'echo');
    this.cam = new G.Camera(0, 0, +(p.zoom || (def ? def.zoom : 0.9)));
    this.focus = p.focus || 'mid';
    this.s = {};
    this.slots = def ? {
      gf: { id: def.hideGf ? null : 'mel', x: def.gf.x, y: def.gf.y, anim: 'danceLeft', at: 0 },
      dad: { id: dadId === 'mel' ? null : dadId, x: def.dad.x, y: def.dad.y, anim: 'idle', at: 0 },
      bf: { id: p.bf || 'ace', x: def.bf.x, y: def.bf.y, anim: 'idle', at: 0 },
    } : null;
    this.cond = new G.Conductor(this.bpm);
    this.cond.reset(0);
    this.evQueue = (p.ev || '').split(',').filter(Boolean).map(s => { const [n, ms] = s.split('@'); return { name: n, at: +(ms || 0) / 1000 }; });
    this.flashA = 0; this.flashC = '#fff';
    this.zoomAdd = 0;
    const self = this;
    this.api = {
      playAnim(who, anim) { const sl = self.slots[who]; if (sl) { sl.anim = anim; sl.at = 0; sl.lock = 0.6; } },
      flash(color, dur) { if (!G.settings.flashing) return; self.flashC = color || '#fff'; self.flashA = 1; self.flashDur = dur || 0.5; },
      shake(i, dur) { self.cam.shake(i, dur); },
      zoomHit(g) { self.zoomAdd += g || 0.015; },
      sfx(n, o) { G.sfx(n, o); },
    };
    if (def && def.create) try { def.create(this.s, this.info()); } catch (e) { G.reportError(e, 'stage create'); }
    this.camTarget(true);
  },
  info() {
    const sl = this.slots || {};
    return {
      time: this.t, beat: this.cond.beatF, step: this.cond.stepF, bpm: this.bpm, crochet: this.cond.crochet,
      songIndex: this.songIndex, form: this.songIndex, flashing: G.settings.flashing, lowQuality: G.settings.quality === 'low',
      health: 1, playing: true, api: this.api, cam: this.cam,
      chars: { dad: sl.dad, gf: sl.gf, bf: sl.bf },
    };
  },
  camTarget(snap) {
    const d = this.def; if (!d) return;
    const pt = who => {
      const sl = this.slots[who]; const def = sl && sl.id && G.chars.get(sl.id);
      const off = def ? def.camOffset : { x: 0, y: -260 };
      const so = (d.camOffsets && d.camOffsets[who]) || { x: 0, y: 0 };
      const dir = who === 'bf' ? -1 : 1;
      return { x: sl.x + (who === 'gf' ? 0 : dir * 150) + off.x * (who === 'bf' ? -1 : 1) + so.x, y: sl.y + off.y + so.y };
    };
    let tx, ty;
    if (this.focus === 'mid') { const a = pt('dad'), b = pt('bf'); tx = (a.x + b.x) / 2; ty = (a.y + b.y) / 2; }
    else { const p = pt(this.focus); tx = p.x; ty = p.y; }
    this.tx = tx; this.ty = ty;
    if (snap) { this.cam.x = tx; this.cam.y = ty; }
  },
  onAction(a, down) {
    if (!down || !this.def) return;
    const order = ['mid', 'dad', 'gf', 'bf'];
    if (a === 'ui_right') this.focus = order[(order.indexOf(this.focus) + 1) % 4];
    if (a === 'ui_left') this.focus = order[(order.indexOf(this.focus) + 3) % 4];
    if (a === 'accept' && this.def.events && this.def.events.length) {
      this.evI = ((this.evI || 0) + 1) % this.def.events.length;
      const n = this.def.events[this.evI];
      if (this.def.event) this.def.event(this.s, n, null, this.info());
      G.toast('event: ' + n);
    }
  },
  update(dt) {
    if (!this.def) return;
    this.t += dt;
    const info = this.info();
    this.cond.update(this.t * 1000, step => {
      if (this.def.step) this.def.step(this.s, step, this.info());
    }, beat => {
      const sl = this.slots;
      if (sl.gf) { sl.gf.anim = beat % 2 === 0 ? 'danceLeft' : 'danceRight'; sl.gf.at = 0; }
      if (beat % 2 === 0) for (const k of ['dad', 'bf']) if (!(sl[k].lock > 0)) { sl[k].anim = 'idle'; sl[k].at = 0; }
      if (beat % 4 === 0) this.zoomAdd += 0.015;
      if (this.def.beat) this.def.beat(this.s, beat, this.info());
    });
    for (const k in this.slots) { const sl = this.slots[k]; if (sl) { sl.at += dt; if (sl.lock > 0) sl.lock -= dt; } }
    for (const e of this.evQueue) if (!e.done && this.t >= e.at) { e.done = true; if (this.def.event) this.def.event(this.s, e.name, null, info); }
    if (this.def.update) this.def.update(this.s, dt, info);
    this.camTarget(false);
    this.cam.x = G.damp(this.cam.x, this.tx, 2.4, dt);
    this.cam.y = G.damp(this.cam.y, this.ty, 2.4, dt);
    this.zoomAdd = G.damp(this.zoomAdd, 0, 3.2, dt);
    this.cam.zoom = (this.def.zoom || 0.9) + this.zoomAdd;
    this.cam.update(dt);
    if (this.flashA > 0) this.flashA -= dt / (this.flashDur || 0.5);
  },
  draw(ctx) {
    G.setScreenT(ctx);
    if (!this.def) { G.text(ctx, 'stage not registered', 40, 60, { size: 30, outline: 3 }); return; }
    const info = this.info(), d = this.def, cam = this.cam, sl = this.slots;
    try {
      d.drawBack && d.drawBack(ctx, cam, this.s, info);
      cam.apply(ctx, 1);
      if (sl.gf && !d.hideGf) G.drawSlot(ctx, sl.gf, info, 'gf');
      if (d.drawMid) { d.drawMid(ctx, cam, this.s, info); cam.apply(ctx, 1); }
      G.drawSlot(ctx, sl.dad, info, 'dad');
      G.drawSlot(ctx, Object.assign({ flip: false }, sl.bf), info, 'bf');
      d.drawFront && d.drawFront(ctx, cam, this.s, info);
      G.setScreenT(ctx);
      d.drawOverlay && d.drawOverlay(ctx, this.s, info);
    } catch (e) { G.reportError(e, 'stage draw'); }
    G.setScreenT(ctx);
    if (this.flashA > 0) { ctx.globalAlpha = Math.max(0, this.flashA); ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    G.text(ctx, 'stage ' + d.id + '  focus:' + this.focus + ' (left/right)  events:' + (d.events || []).join(',') + ' (enter)', 10, G.H - 10, { size: 20, font: 'vcr', outline: 2 });
  },
};

G.screens.devBlank = {
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = '#20202a'; ctx.fillRect(0, 0, G.W, G.H);
    G.alpha(ctx, 'FNF 2', G.W / 2, 200, { size: 120, align: 'center', style: 'menuSel' });
    G.text(ctx, 'modules loaded: ' + Object.keys(G.screens).join(', '), 40, 330, { size: 22, font: 'vcr', outline: 2, maxWidth: 1200 });
    G.text(ctx, 'chars: ' + G.chars.list().join(', '), 40, 370, { size: 22, font: 'vcr', outline: 2, maxWidth: 1200 });
    G.text(ctx, 'stages: ' + G.stages.list().join(', '), 40, 410, { size: 22, font: 'vcr', outline: 2, maxWidth: 1200 });
    G.text(ctx, 'audio: ' + (G.audio ? 'yes' : 'no') + '   songs: ' + (G.songs && G.songs.build ? 'yes' : 'no'), 40, 450, { size: 22, font: 'vcr', outline: 2 });
  },
};
