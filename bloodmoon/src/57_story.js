// =====================================================================
// STORY (runtime) — the people of Ashford, what they say, clues and the
// blood trail, bosses, the castle, the shrine, and the three endings.
// =====================================================================
const NPCS = {};
const CHATTER = {
  hale: ['Keep your blade oiled and your back to a wall.', 'Silver for the cursed, fire for the drowned. That much I know.', 'The board has work. The work has teeth.', 'Every seventh night we bar the doors and pray.'],
  maud: ['Bloodroot in the woods, silverleaf by the water, ghostcaps where the dead lie.', 'Frostbloom only grows up high. Wrap up warm if you go looking.', 'Drink before you need to, not after.'],
  brann: ['Silver ingots, iron, and the hide of whatever you killed. Bring me those.', 'That rusty thing of your father\'s? I\'ve seen butter knives with more edge.', 'A troll hide makes armour that laughs at claws.'],
  elsa: ['Stew\'s hot. The beds are warm. The door is barred at night.', 'You look like your mother. She used to sing in here.', 'Rooms are fifteen coins. Sleep is free.'],
  edrin: ['Pray if it helps. It never helped me.', 'Corruption sits in the blood. The light can thin it, for a price.', 'The dead don\'t rest in St. Aldric\'s any more.'],
  pella: ['Three sheep this week. Torn open, wool left behind.', 'The wolves come out of Wolfwood after dark. Big ones.', 'If you\'re hungry, the rabbits are fat this year. Cook them first!'],
  morwen: ['The horn is in the queen\'s belly, up in the northern peaks.', 'Mutagens make you strong. They make you something else, too.', 'Don\'t track mud on my floor.'],
  folk: ['Did you hear? The Kessler girl went missing.', 'Don\'t go out at night. Just don\'t.', 'The lord hasn\'t been seen in years. Only his guards.', 'Hunter! Kill one for my brother, will you?', 'Another blood moon soon. I can feel it in my teeth.', 'The well water\'s the only thing in this town that\'s still sweet.', 'They say drowners were people once.', 'Mind the crows. They follow the dying.'],
};
function shopSpot(kind) { const T = TOWN.find((t) => t[7] === kind); if (!T) return null; const [x, z, w, d, , rot] = T, out = d / 2 + 3.2; return [x + Math.sin(rot) * out + Math.cos(rot) * 1.6, z + Math.cos(rot) * out - Math.sin(rot) * 1.6, rot]; }
function spawnPeople() {
  for (const k in NPCS) delete NPCS[k];
  const place = (id, x, z, yaw, o = {}) => { const P = PEOPLE[id], rig = buildHuman(P.look, { pants: 0x2a2420 }), a = makeActor('npc', id, x, z, Object.assign({ rig, person: id, name: P.name, role: P.role, work: [x, z], roam: 1.2, yaw }, o)); NPCS[id] = a; return a; };
  const b = WORLD.interact.find((e) => e.kind === 'board'); place('hale', b.x + 2.4, b.z + 1.2, -0.4 + Math.PI, { roam: 0.5 });
  for (const [id, kind] of [['maud', 'alchemist'], ['brann', 'smith'], ['elsa', 'inn'], ['edrin', 'chapel']]) { const s = shopSpot(kind); if (s) place(id, s[0], s[1], s[2], { shop: PEOPLE[id].shop, job: PEOPLE[id].job }); }
  const br = NPCS.brann; if (br) { const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.9), MAT.iron); const ax = br.x + Math.sin(br.yaw) * 0.9, az = br.z + Math.cos(br.yaw) * 0.9; anvil.position.set(ax, floorAt(ax, az) + 0.45, az); anvil.castShadow = true; scene.add(anvil); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.45, 8), MAT.darkWood); st.position.set(ax, floorAt(ax, az) + 0.22, az); scene.add(st); addCollider({ kind: 'circle', x: ax, z: az, r: 0.45, y0: anvil.position.y - 2, y1: anvil.position.y + 0.3 }); br.roam = 0; }
  place('pella', PEOPLE.pella.at[0], PEOPLE.pella.at[1], 0, { roam: 8 });
  const w = WORLD.interact.find((e) => e.kind === 'witch'); place('morwen', w.x + 0.6, w.z - 1.2, 0.4 + Math.PI, { roam: 0.5 });
  const houses = TOWN.filter((t) => t[4] === 'house');
  TOWNSFOLK.forEach((f, i) => { const h = houses[i % houses.length], [x, z, , d, , rot] = h, hx = x + Math.sin(rot) * (d / 2 + 1.5), hz = z + Math.cos(rot) * (d / 2 + 1.5); const rig = buildHuman(f.look, { pants: 0x2a2420 }); const a = makeActor('npc', 'folk', 4 + rand(-14, 14), 140 + rand(-14, 14), { rig, person: 'folk', name: f.name, role: 'Townsfolk', work: [4 + rand(-22, 22), 140 + rand(-18, 18)], roam: 9, home: [hx, hz], blip: 0.9 + (i % 3) * 0.1 }); NPCS['folk' + i] = a; });
}
// ---------- the story ----------
const Story = {
  spawned: {}, tick: 0, trail: [],
  S() { return G.save.story; },
  step() { return this.S().step; },
  at(id) { return MAIN_IDX[this.step()] >= MAIN_IDX[id]; },
  setStep(id, quiet) {
    const S = this.S(); if (S.step === id) return; S.step = id; const m = MAIN[MAIN_IDX[id]];
    if (!quiet) { Sfx.play('quest'); UI.toast((id === 'done' ? '' : 'NEW OBJECTIVE: ') + m.goal, 'gold'); }
    this.setup(); autosave();
  },
  // rebuild clues and story props for the current step (after loading too)
  setup() {
    const S = this.S(), st = S.step; Clues.clear('story');
    if (st === 'mill') this.makeMillClues();
    if (st === 'trail' || st === 'beast') this.makeTrail();
  },
  makeMillClues() {
    const M = PLACES.mill, door = WORLD.interact.find((e) => e.kind === 'mill'), S = this.S(), found = S.clueSet || (S.clueSet = {});
    const list = [{ id: 'claw', kind: 'claw', x: door.x, z: door.z, yaw: Math.atan2(door.x - M.x, door.z - M.z), label: 'Claw marks. Deep. Something huge forced this door.' },
      { id: 'blood1', kind: 'blood', x: door.x + 6, z: door.z + 3, size: 1.6, label: 'Old blood, soaked into the ground.' },
      { id: 'tuft', kind: 'blood', x: door.x + 14, z: door.z - 4, size: 1.2, label: 'A tuft of coarse black fur, caught on a fence. Not a wolf\'s.' }];
    for (const c of list) { if (found[c.id]) continue; Clues.add(Object.assign({ tag: 'story', onFind: () => { found[c.id] = true; if (Object.keys(found).length >= 3) later(1.2, () => UI.dialog(TALKS.mill_found, () => this.setStep('trail'))); } }, c)); }
  },
  TRAIL: [[-60, 300], [40, 310], [150, 262], [250, 152], [320, 42], [372, -8]],
  makeTrail() {
    const S = this.S(), pts = []; this.trail = [];
    for (let i = 0; i < this.TRAIL.length - 1; i++) { const [ax, az] = this.TRAIL[i], [bx, bz] = this.TRAIL[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 30); for (let k = 0; k < n; k++) pts.push([lerp(ax, bx, k / n), lerp(az, bz, k / n)]); }
    pts.forEach(([x, z], i) => { const c = Clues.add({ tag: 'story', kind: i % 4 === 3 ? 'track' : 'blood', x, z, yaw: 1, size: 0.9, auto: true, r: 9, onFind: () => { S.trail = Math.max(S.trail, i + 1); } }); if (i < S.trail) c.found = true; this.trail.push(c); });
  },
  marker() {
    if (!G.save || G.area !== 'outside') return null; const m = MAIN[MAIN_IDX[this.step()]]; if (!m || !m.marker) return null;
    if (m.marker === 'trail') { const c = this.trail.find((c) => !c.found); return c ? [c.x, c.z] : [372, -20]; }
    if (typeof m.marker === 'string') { const a = NPCS[m.marker]; return a ? [a.x, a.z] : null; }
    return m.marker;
  },
  update(dt) {
    if (!G.save || !G.p || G.p.dead) return; this.tick -= dt; if (this.tick > 0) return; this.tick = 0.5;
    const p = G.p, st = this.step(), S = this.S(), near = (P, r) => G.area === 'outside' && Math.hypot(P.x - p.x, P.z - p.z) < r;
    if (st === 'mill' && near(PLACES.mill, 45) && !S.flags.millHint) { S.flags.millHint = true; UI.toast('Press R to use your hunter sense. Look for things that glow red.', 'gold'); }
    if (st === 'trail' && near(PLACES.den, 75)) this.setStep('beast');
    if (st === 'beast' && near(PLACES.den, 90)) this.spawnBoss('mill_beast', PLACES.den.x, PLACES.den.z);
    if (st === 'mire' && near(PLACES.mirenest, 90)) this.spawnBoss('mire_mother', PLACES.mirenest.x, PLACES.mirenest.z);
    if (st === 'key' && near(PLACES.bridge, 80)) { const [x, z] = this.grumSpot(); this.spawnBoss('old_grum', x, z); }
    if (!G.save.player.trophies.wyvern_queen && !invCount('demon_horn') && near(PLACES.nest, 110)) this.spawnBoss('wyvern_queen', PLACES.nest.x, PLACES.nest.z, { alt: 18 });
    // the blood moon comes for Ashford
    if (Clock.bloodMoon() && G.area === 'outside' && inTown(p.x, p.z)) { this.raidT = (this.raidT || 20) - 0.5; if (this.raidT <= 0 && ACTORS.filter((a) => a.raid && !a.dead).length < 6) { this.raidT = 40; const ang = rand(0, TAU); for (let i = 0; i < 3; i++) makeActor('monster', 'ghoul', p.x + Math.sin(ang) * 60 + rand(-4, 4), p.z + Math.cos(ang) * 60 + rand(-4, 4), { raid: true, story: true, aggro: true }); UI.toast('The dead are in the streets!', 'blood'); Sfx.play('bell', { vol: 0.8 }); } }
  },
  grumSpot() { const B = PLACES.bridge; for (let r = 12; r < 40; r += 3) for (let a = 0; a < TAU; a += 0.5) { const x = B.x + Math.cos(a) * r, z = B.z + Math.sin(a) * r; if (waterDepthAt(x, z) < 0.2 && slopeAt(x, z) < 0.5 && deckAt(x, z, 1e9) === -Infinity) return [x, z]; } return [B.x + 20, B.z]; },
  spawnBoss(type, x, z, o = {}) {
    if (this.spawned[type] && !this.spawned[type].dead && ACTORS.includes(this.spawned[type])) return this.spawned[type];
    if (this.spawned[type] && this.spawned[type].dead) return null;
    const a = makeActor('monster', type, x, z, Object.assign({ story: true }, o)); if (o.alt) a.alt = o.alt; this.spawned[type] = a;
    Sfx.voice(a.d.voice, 0.7, { x: a.x, y: a.y, z: a.z, range: 200 }); return a;
  },
  lockedIn() { const b = ACTORS.find((a) => a.story && !a.dead && a.d && a.d.boss && a.aggro && !a.passive && Math.abs(a.x - G.p.x) < 200); return !!b && G.area !== 'outside'; },
  onKill(a) {
    const t = a.type, S = this.S();
    if (t === 'mill_beast' && this.step() === 'beast') later(2.2, () => { this.jonah(a); UI.dialog(TALKS.beast_dies, () => { invAdd('jonah_locket'); this.setStep('locket'); Music.set(null); }); Music.set('sad'); });
    if (t === 'mire_mother') { a.loot = a.loot.filter((x) => x); if (this.step() === 'mire') this.setStep('pact'); }
    if (t === 'old_grum') { a.loot = a.loot.filter((x) => x !== 'iron_key'); invAdd('iron_key'); if (MAIN_IDX[this.step()] <= MAIN_IDX.key) this.setStep('castle'); }
    if (t === 'wyvern_queen') { a.loot = a.loot.filter((x) => x !== 'demon_horn'); invAdd('demon_horn'); UI.toast('Morwen\'s charm hums. The Demon\'s Horn was inside her.', 'blood'); }
    if (t === 'lord_vargrave') later(1.8, () => UI.dialog(TALKS.vargrave_dies, () => this.ending('lord')));
    if (t === 'azgoreth') later(2, () => UI.dialog(TALKS.azgoreth_dies, () => this.ending('demon')));
  },
  jonah(a) { // the beast shrinks back into a boy
    if (!a.rig) return; Gore.smoke(a.x, a.y + 1, a.z, 30, 0.3); scene.remove(a.rig.root);
    const r = buildHuman({ skin: '#d8b8a0', hair: 1, hairCol: '#6a4024', coat: '#4a3a2a', shirt: '#8a7a6a', body: 0, face: 1 }); r.root.position.set(a.x, a.y + 0.12, a.z); r.root.rotation.set(-Math.PI / 2, a.yaw, 0, 'YXZ'); scene.add(r.root); a.rig = r; a.anim.dead = 0; a.d = Object.assign({}, a.d, { name: 'Jonah' }); a.loot = [];
  },
  onSense() {},
  // ---------- talking ----------
  talk(n) {
    const st = this.step(), id = n.person; n.talking = true; const done = () => { n.talking = false; };
    const line = (who, pool) => UI.dialog([[who, pick(CHATTER[pool] || CHATTER.folk)]], done, { name: n.name, pitch: n.blip });
    if (id === 'hale') {
      if (st === 'arrive') return UI.dialog(TALKS.hale_first, () => { done(); invAdd('hunting_bow', 1, true); invAdd('arrow', 25, true); invAdd('draught', 2, true); equip('hunting_bow'); UI.toast('Captain Hale gives you a hunting bow, 25 arrows and 2 healing draughts.', 'item'); this.setStep('mill'); Contracts.refresh(true); });
      if (st === 'locket') return UI.dialog(TALKS.hale_locket, () => { done(); invTake('jonah_locket'); this.setStep('edrin'); });
      return UI.dialog([['hale', pick(CHATTER.hale)]], () => { done(); UI.openBoard(); });
    }
    if (id === 'edrin' && st === 'edrin') return UI.dialog(TALKS.edrin, () => { done(); this.setStep('journal'); });
    if (id === 'morwen') {
      if (st === 'witch') return UI.dialog(TALKS.morwen_first, () => { done(); this.setStep('mire'); });
      if (st === 'pact') return UI.dialog(TALKS.morwen_pact, () => { done(); invAdd('morwen_charm'); this.setStep('key'); });
      if (!this.at('witch')) return UI.dialog([['morwen', 'Go away, little hunter. Come back when you know what to ask.']], done);
      return line('morwen', 'morwen');
    }
    if (n.shop) return UI.dialog([[id, SHOPS[n.shop].greet]], () => { done(); UI.openShop(n.shop); }, { quick: true });
    if (id === 'pella' || CHATTER[id]) return line(id, id);
    return UI.dialog([['folk', pick(CHATTER.folk)]], done, { name: n.name, pitch: n.blip });
  },
  // ---------- places you interact with ----------
  altar() {
    if (this.step() !== 'journal') return UI.toast(this.at('witch') ? 'The altar is empty now.' : 'A broken altar, black with old candle smoke.');
    UI.dialog(TALKS.journal, () => { invAdd('edrin_journal'); this.setStep('witch'); });
  },
  gate() {
    const S = G.save; if (S.gate) return UI.toast('The gate is open.');
    if (!invCount('iron_key')) return UI.toast(this.at('castle') ? 'Locked. You need the Iron Key.' : 'The castle gate is barred. Nobody answers.', 'bad');
    S.gate = true; openGate(true); Sfx.play('door'); Sfx.play('clang'); shakeCam(0.3); UI.toast('The Iron Key turns. The portcullis grinds up.', 'gold'); autosave();
  },
  keep() {
    if (!G.save.gate) return UI.toast('You can\'t get past the gate.');
    if (G.save.story.flags.lordDead) return Interiors.enter('castle');
    if (!this.at('castle')) return UI.toast('The doors of the great hall are shut fast.');
    G.preHall = JSON.parse(JSON.stringify(snapshotSave()));
    Interiors.enter('castle', () => this.hall());
  },
  hall() {
    const I = Interiors.defs.castle; if (G.save.story.flags.lordDead) return;
    const v = this.spawnBoss('lord_vargrave', I.x, I.z - 17, { passive: true }); if (!v) return; v.y = I.y + 1; v.yaw = 0;
    if (this.step() === 'castle') this.setStep('choice', true);
    later(0.8, () => UI.dialog(TALKS.castle_hall, () => this.decide()));
  },
  decide() {
    UI.choice('What do you do?', [
      { label: 'Draw your sword. He dies tonight.', fn: () => { const v = this.spawned.lord_vargrave; if (v) { v.passive = false; v.aggro = true; Hud.boss(v); } Music.set('fight'); UI.toast('Kill Lord Vargrave!', 'blood'); } },
      { label: 'Take his hand. Take his place.', fn: () => UI.dialog(TALKS.deal, () => this.ending('dark')) },
      { label: 'Not yet. (Leave)', fn: () => { const v = this.spawned.lord_vargrave; if (v) removeActor(v); this.spawned.lord_vargrave = null; Interiors.exit(); } },
    ]);
  },
  shrine() {
    if (G.save.story.flags.demonDead) return UI.toast('The shrine is cold and silent now.');
    if (!invCount('demon_horn')) return UI.toast('A door of black stone, warm to the touch. There\'s a hollow in it shaped like a horn.', 'bad');
    Interiors.enter('shrine', () => { const I = Interiors.defs.shrine, z = this.spawnBoss('azgoreth', I.x, I.z - 9, { passive: true }); if (!z) return; z.yaw = 0; later(0.8, () => UI.dialog(TALKS.azgoreth_meet, () => { z.passive = false; z.aggro = true; Hud.boss(z); Music.set('blood'); })); });
  },
  // ---------- endings ----------
  ending(kind) {
    const E = ENDINGS[kind], S = this.S(); G.cine = true; Music.set(E.good ? 'victory' : 'dark');
    if (!S.endings.includes(kind)) S.endings.push(kind); S.ending = kind;
    if (kind === 'lord' || kind === 'demon') { S.flags.free = true; S.flags.lordDead = true; if (kind === 'demon') S.flags.demonDead = true; addTrophy(kind === 'lord' ? 'vargrave' : 'azgoreth'); }
    UI.ending(E, kind, () => {
      G.cine = false; Hud.boss(null);
      if (kind === 'dark') { // the save goes back to before you met the lord
        const pre = G.preHall; if (pre) { pre.story.endings = S.endings.slice(); pre.lastSaved = Date.now(); Store.put(pre); UI.toast('Your save goes back to the castle gate.', 'gold'); return loadGame(pre.id); }
      }
      this.setStep('done', true); if (G.area !== 'outside') Interiors.exit(); autosave();
    });
  },
};
function openGate(instant) { const g = CASTLE.gate; if (!g || g.open) return; g.open = true; g.col.off = true; if (instant === 'snap') g.mesh.position.y += 6.5; else ANIM.push({ kind: 'lift', obj: g.mesh, to: g.mesh.position.y + 6.5 }); }
