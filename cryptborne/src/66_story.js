
// =====================================================================
// STORY — cutscene runner, notes, acts, boss story beats and endings.
// =====================================================================
const Story = {
  cur: null, id: null, i: 0, wait: 0, block: null, mood: null, vision: 0, visionT: 0, fade: 0, fadeTo: 0, fadeSpd: 1, choice: null, onDone: null, q: [], red: 0,
  active() { return !!this.cur; },
  play(id, onDone) {
    if (!SCENES[id]) return;
    if (this.cur) { this.q.push([id, onDone]); return; }
    this.cur = SCENES[id]; this.id = id; this.i = 0; this.onDone = onDone || null; this.choice = null; this.block = null;
    ST().seen[id] = true; Input.clear(); UI.cutscene(true); this.next();
  },
  queue(id) { this.play(id); },
  next() {
    while (this.cur && this.i < this.cur.length) {
      const s = this.cur[this.i++], [k, a, b, c] = s;
      switch (k) {
        case 'music': this.mood = a; break;
        case 'sfx': Sfx.play(a); break;
        case 'shake': shake(a); break;
        case 'vision': this.vision = a; if (a) Sfx.play('portal'); break;
        case 'call': if (CUT_FN[a]) CUT_FN[a](); break;
        case 'fade': this.fadeTo = a === 'out' ? 1 : 0; this.fadeSpd = 1 / (b || 1); this.block = 'fade'; return;
        case 'wait': this.wait = a; this.block = 'wait'; return;
        case 'title': UI.titleCard(a, b); this.wait = 3; this.block = 'title'; return;
        case 'say': UI.say(a, b); this.block = 'say'; return;
        case 'note': UI.showNote(a, () => { this.block = null; this.next(); }); this.block = 'note'; return;
        case 'choice': UI.choice(a, b, (v) => { this.choice = v; this.block = null; this.next(); }); this.block = 'choice'; return;
        case 'move': { const t = this.spot(a, b); this.moveTo = t; this.block = 'move'; this.wait = 4; return; }
        case 'end': this.finish(); if (a === 'good' && Story.secretReady()) { ST().endings.good = true; this.play('end_secret'); } else Story.ending(a); return;
      }
    }
    if (this.cur) this.finish();
  },
  spot(who, where) { // named spots for cutscene walking
    const A = G.area, sp = (A.spots || []).find((s) => s.kind === where);
    return sp ? { x: sp.x, y: sp.y + 10 } : { x: G.p.x, y: G.p.y };
  },
  advance() { if (this.block === 'say' || this.block === 'title') { if (UI.sayBusy()) { UI.sayFinish(); return; } UI.hideSay(); this.block = null; this.next(); } },
  update(dt) {
    this.fade += clamp(this.fadeTo - this.fade, -dt * this.fadeSpd, dt * this.fadeSpd);
    this.visionT += dt;
    if (!this.cur) return;
    if (this.block === 'fade' && Math.abs(this.fade - this.fadeTo) < 0.001) { this.block = null; this.next(); }
    else if (this.block === 'wait') { this.wait -= dt; if (this.wait <= 0) { this.block = null; this.next(); } }
    else if (this.block === 'title') { this.wait -= dt; if (this.wait <= 0) { UI.hideTitle(); this.block = null; this.next(); } }
    else if (this.block === 'move') {
      const p = G.p, t = this.moveTo, dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy); this.wait -= dt;
      if (d < 3 || this.wait <= 0) { p.moving = false; this.block = null; this.next(); }
      else { moveEntity(p, (dx / d) * 60 * dt, (dy / d) * 60 * dt, false); p.moving = true; p.walk += dt * 9; p.face = dx < 0 ? -1 : 1; p.aim = Math.atan2(dy, dx); }
    }
  },
  finish() {
    const done = this.onDone, id = this.id, choice = this.choice;
    this.cur = null; this.id = null; this.mood = null; this.vision = 0; this.block = null; this.fadeTo = 0;
    UI.cutscene(false); UI.hideSay(); UI.hideTitle();
    if (id === 'final_meet') { if (choice === 'deal') this.play('end_deal'); else this.play('final_fight'); }
    if (done) done(choice);
    if (!this.cur && this.q.length) { const [nid, cb] = this.q.shift(); this.play(nid, cb); }
  },
  // ---------- notes ----------
  noteCount() { return NOTE_IDS.filter((k) => ST().notes[k]).length; },
  collect(id) {
    if (ST().notes[id]) return; ST().notes[id] = true; Sfx.play('page');
    UI.showNote(id, () => {
      const n = this.noteCount(); UI.toast(`Finn's trail: ${n} of ${NOTE_IDS.length} notes found`, 'gold');
      if (n === NOTE_IDS.length && !ST().flags.mirrorOpen) { ST().flags.mirrorOpen = true; this.play('mirror_open'); }
    });
    saveGame(true);
  },
  // ---------- bosses ----------
  onBossDead(m) {
    const def = G.area.def; if (!def) return; const SV = G.save;
    SV.stats.bosses[def.id] = true; G.bossMon = null; shake(8);
    UI.toast(`${m.d.name.toUpperCase()} DEFEATED!`, 'gold big'); Sfx.play('level');
    for (const o of G.mons) if (o.summoned && !o.dead) { o.dead = true; burst(o.x, o.y - 8, 10, '#b878ea', 40); }
    const ended = !!ST().ending;
    if (m.type === 'lich' && !ended) { later(1.2, () => this.play(this.noteCount() >= NOTES_NEEDED ? 'end_good' : 'finn_turns')); return; }
    if (m.type === 'hollow_finn') { later(1, () => this.play('end_finn')); return; }
    this.openWing();
    if (m.type === 'shadow_you') { ST().flags.shadowBeaten = true; later(1, () => this.play('shadow_down')); }
    if (!ended) {
      const sid = 'boss_' + def.id;
      if (SCENES[sid] && !ST().seen[sid] && (def.id !== 'forge' || ST().act === 1)) later(1.2, () => this.play(sid));
      if (def.seal && !ST().seals[def.seal]) {
        ST().seals[def.seal] = true; later(1.2, () => this.play('seal_' + def.seal, () => { if (Object.keys(SEAL_NAMES).every((k) => ST().seals[k]) && ST().act < 3) this.play('act3'); }));
      }
    }
    saveGame(true);
  },
  openWing() { // after a boss: open the gold chest and the portal home
    for (const c of G.area.chests) c.locked = false;
    G.area.portals.push({ x: G.area.boss.cx * 16 + 8, y: (G.area.boss.cy + 3) * 16, kind: 'exit' });
    UI.toast('The golden chest is unlocked. A portal home opened.', 'good');
  },
  secretReady() { return this.noteCount() === NOTE_IDS.length && ST().flags.shadowBeaten; },
  enterBossRoom() { // the final and secret boss rooms start with a scene
    const def = G.area.def; if (!def || G.area.bossSceneDone) return;
    if (def.final && !ST().ending) { G.area.bossSceneDone = true; this.play('final_meet'); }
    else if (def.secret) { G.area.bossSceneDone = true; this.play('shadow_meet', () => { const b = G.mons.find((x) => x.boss); if (b) { b.scripted = false; b.aggro = true; bossWake(b); } }); }
  },
  ending(kind) {
    const s = ST(); s.endings[kind] = true;
    if (kind === 'good' || kind === 'secret') s.ending = kind;
    else { s.ending = null; if (kind === 'night') G.save.world.nights = Math.max(0, DF().nights - 15); }
    const p = G.p; p.hidden = false; p.lying = false; p.buffs = {}; p.shieldHp = 0;
    const v = getWorld('vale'); enterMap('vale', v.spawn.x, v.spawn.y); p.hp = PS().maxHp; p.sta = p.maxSta;
    saveGame(true); UI.credits(kind);
  },
};
// actions cutscenes can call
const CUT_FN = {
  standUp() { const p = G.p, b = (G.area.spots || []).find((s) => s.kind === 'bed'); p.lying = false; if (b) { p.x = b.x; p.y = b.y; } Sfx.play('st_wood'); },
  openingOutside() { G.save.world.time = 6.5 * 60; const v = getWorld('vale'); enterMap('vale', v.homeDoor.x, v.homeDoor.y + 10); const t = G.area.npcs.find((n) => n.id === 'tobin'); if (t) { t.x = v.homeDoor.x + 22; t.y = v.homeDoor.y + 12; t.tx = t.x; t.ty = t.y; t.face = -1; t.wait = 8; } G.p.face = 1; },
  giveMap() { ST().flags.hasMap = true; UI.toast('You got the World Map. Click the tiny map or press M.', 'gold'); later(2.5, () => UI.toast('Follow Finn to Mossy Hollow, north-west of town.', 'good')); },
  act2() { ST().act = 2; UI.toast('ACT 2: THE FOUR SEALS. The roads to the four lands are open.', 'gold big'); },
  act3() { ST().act = 3; UI.toast('ACT 3: WRAITHMOOR TOMB is open. Finn is waiting.', 'gold big'); },
  finalStage() {
    const b = G.mons.find((m) => m.type === 'lich'); if (!b) return; b.scripted = true; b.aggro = false;
    G.area.finn = { x: b.x + 26, y: b.y + 8, look: Object.assign(FINN_LOOK(G.save.look), { eyeCol: '#d8454a' }), chained: true, t: 0 };
    G.p.aim = Math.atan2(b.y - G.p.y, b.x - G.p.x);
  },
  unhood() { const b = G.mons.find((m) => m.type === 'lich'); if (b) { b.face = G.p.x < b.x ? -1 : 1; b.unhooded = true; burst(b.x, b.y - 30, 20, '#7ff8ff', 50); Sfx.play('portal'); } },
  startFinal() { const b = G.mons.find((m) => m.type === 'lich'); if (b) { b.scripted = false; b.aggro = true; bossWake(b); } },
  spawnHollowFinn() { const f = G.area.finn; const x = f ? f.x : G.p.x + 40, y = f ? f.y : G.p.y; G.area.finn = null; const m = spawnMon('hollow_finn', x, y, { room: G.area.boss, aggro: true }); bossWake(m); },
  sealTogether() { G.flash = 1; Sfx.play('gate'); shake(6); if (G.area.finn) { G.area.finn.chained = false; G.area.finn.look.eyeCol = null; G.area.finn.x = G.p.x + 18; G.area.finn.y = G.p.y; } },
  bloodMoon() { Story.red = 1; Sfx.voice('howl', 0.7); },
  dealScene() { G.flash = 1; Sfx.play('death'); G.p.hidden = true; if (G.area.finn) G.area.finn.chained = false; },
};
