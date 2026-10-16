// FNF 2 - developer preview screens (only with ?dev=... in the URL)
//   ?dev=stage&id=mainStage[&bf=bf&dad=dad&gf=gf][&focus=mid|bf|dad|gf][&anim=bf:singLEFT,dad:singUP][&t=0.3]
//   ?dev=char&id=bf&anims=idle,singLEFT[&at=0.2]
G.screens.devStage = {
  enter(p) {
    this.stage = new G.Stage(p.id || 'mainStage');
    const mk = (slot, id) => { if (!id || id === 'none') return; const c = new G.Character(id, slot); this.stage.addCharacter(c, slot); };
    mk('gf', p.gf || 'gf'); mk('dad', p.dad || 'dad'); mk('bf', p.bf || 'bf');
    this.cam = new G.FCam(this.stage.zoom);
    this.focus = p.focus || 'mid';
    this.t = 0; this.step = -1; this.bpm = +(p.bpm || 100);
    this.forced = {};
    for (const s of (p.anim || '').split(',').filter(Boolean)) { const [who, a] = s.split(':'); this.forced[who] = a; const c = this.stage.chars[who]; if (c) c.playAnim(a, true); }
    this.freeze = p.t != null ? +p.t : null;
    if (this.freeze != null) for (const k in this.stage.chars) { const c = this.stage.chars[k]; c.update(this.freeze); }
    this.aim(true);
  },
  aim(snap) {
    const ch = this.stage.chars;
    let x, y;
    if (this.focus === 'mid' && ch.bf && ch.dad) { x = (ch.bf.camFocus.x + ch.dad.camFocus.x) / 2; y = (ch.bf.camFocus.y + ch.dad.camFocus.y) / 2; }
    else { const c = ch[this.focus] || ch.bf; x = c.camFocus.x; y = c.camFocus.y; }
    if (snap) this.cam.focus(x, y); else this.cam.follow(x, y);
  },
  onAction(a, down) {
    if (!down) return;
    const order = ['mid', 'dad', 'gf', 'bf'];
    if (a === 'ui_right') this.focus = order[(order.indexOf(this.focus) + 1) % 4];
    if (a === 'ui_left') this.focus = order[(order.indexOf(this.focus) + 3) % 4];
  },
  update(dt) {
    if (this.freeze != null) { this.aim(true); return; }
    this.t += dt;
    const step = Math.floor(this.t * this.bpm / 15);
    while (this.step < step) { this.step++; this.stage.onStep(this.step); for (const k in this.stage.chars) if (!this.forced[k]) this.stage.chars[k].onStep(this.step); }
    for (const k in this.stage.chars) this.stage.chars[k].tick(dt, 15 / this.bpm, false);
    this.stage.update(dt);
    this.aim(false);
    this.cam.update(dt);
  },
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
    this.stage.draw(ctx, this.cam);
    G.vcr(ctx, 'stage ' + this.stage.id + '  focus ' + this.focus, 8, G.H - 28, { size: 20 });
  },
};
G.screens.devChar = {
  enter(p) { this.c = new G.Character(p.id || 'bf', p.slot || 'bf'); this.list = (p.anims || 'idle').split(','); this.at = p.at != null ? +p.at : null; this.t = 0; this.bg = p.bg || '#5a5a6e'; },
  update(dt) { this.t += dt; },
  draw(ctx) {
    G.setScreenT(ctx); ctx.fillStyle = this.bg; ctx.fillRect(0, 0, G.W, G.H);
    const n = this.list.length, cw = G.W / n;
    this.list.forEach((a, i) => {
      const c = this.c; c.play(a, true); c.update(this.at != null ? this.at : this.t % 1.5);
      const s = Math.min(cw / c.frameW, (G.H - 40) / c.frameH) * 0.9;
      c.scale.x = c.scale.y = s; c.updateHitbox();
      c.x = cw * i + (cw - c.width) / 2; c.y = G.H - 10 - c.height;
      c.draw(ctx, null);
      G.vcr(ctx, a, cw * i + 6, 6, { size: 18 });
    });
  },
};
