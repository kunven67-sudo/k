// ---------- magic, part 3: enemy mages, learning, your spellbook ----------

// ---- mages in the enemy camps (and sometimes in raids) ----
const MAGE_TIERS = [
  { name: 'Apprentice', max: 45, spells: ['fireball', 'waterball', 'stonecannon'], purse: 14 },
  { name: 'Mage', max: 90, spells: ['fireball', 'icelance', 'stonecannon', 'electric', 'healing', 'quagmire'], purse: 40 },
  { name: 'War Mage', max: 160, spells: ['greatfireball', 'icelance', 'stonecannon', 'electric', 'greaterhealing', 'barrier', 'burningplace'], purse: 95 },
];
const staffGeo = (() => { const g = new THREE.CylinderGeometry(0.018, 0.024, 1.6, 7); g.translate(0, 0.35, 0); return g; })();
const staffMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.8 });
function spawnMage(camp, at, tier) {
  tier = tier ?? (Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2);
  const M = MAGE_TIERS[tier];
  const robe = new THREE.Color(camp.house.cloth).multiplyScalar(0.85).getHex();
  const f = new Fighter({ tier: 6, team: 'knight', outfit: { sex: 'm', dress: true, top: robe, legs: 0x2a2420, hood: true, hoodColor: new THREE.Color(robe).multiplyScalar(0.7).getHex(), cloak: tier > 0, face: ['mage1', 'mage2', 'mage3'][Math.floor(Math.random() * 3)] }, body: 0x4a3a30, sword: null, name: camp.house.name + ' ' + M.name });
  const a = Math.random() * 6.28, d = 3 + Math.random() * 4, c0 = at || camp;
  f.pos.set(c0.x + Math.cos(a) * d, terrainH(c0.x, c0.z), c0.z + Math.sin(a) * d);
  collideFighter(f); f.pos.y = groundH(f.pos.x, f.pos.z);
  f.facing = Math.random() * 6.28; f.voicePitch = 0.85 + Math.random() * 0.25;
  f.houseName = camp.house.name;
  // a staff with a crystal, in the right hand
  const staff = new THREE.Group();
  staff.add(new THREE.Mesh(staffGeo, staffMat));
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: new THREE.Color(SCHOOL[M.spells[0] === 'fireball' ? 'fire' : 'water'].css), emissiveIntensity: 1.6, roughness: 0.1 }));
  gem.position.y = 1.18; staff.add(gem);
  staff.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.armor = true; } });
  scene.add(staff); bone(f.model, 'RightHand').attach(staff);
  staff.position.set(0, 0, 0); staff.rotation.set(Math.PI / 2, 0, 0);
  staff.updateMatrixWorld(true);
  f.staff = staff;
  f.mage = { tier, max: M.max, mana: M.max, spells: M.spells, chant: null, cd: 1 + Math.random() * 2, next: null, circle: makeCircle(), keep: 11 + Math.random() * 5 };
  f.purse = M.purse + Math.floor(Math.random() * M.purse);
  f.loot = [['Apprentice robe', 12], ['Mage robe and staff', 45], ["War mage's robe and staff", 120]][tier];
  // what you can learn from his body
  const unknown = M.spells.filter(id => !magic.known.includes(id));
  f.book = (unknown.length ? unknown : M.spells)[Math.floor(Math.random() * (unknown.length || M.spells.length))];
  f.ai = { state: 'patrol', camp, wait: Math.random() * 3, tx: f.pos.x, tz: f.pos.z, alert: false, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, cd: 1, blockT: 0, courage: Math.random(), shouted: false, react: 0, crawlT: 0 };
  if (!at) camp.members.push(f);
  return f;
}
// camps sometimes have a mage among the knights
const spawnKnight0 = spawnKnight;
spawnKnight = function (camp, at) {
  if (!at && Math.random() < 0.3 && !camp.members.some(m => m.mage && m.alive)) return spawnMage(camp);
  if (at && Math.random() < 0.18) return spawnMage(camp, at);
  return spawnKnight0(camp, at);
};
function pickMageSpell(f) {
  const M = f.mage, P = f.ai.target;
  const affordable = M.spells.map(id => SPELL[id]).filter(s => s && M.mana >= s.cost);
  if (!affordable.length) return null;
  // heal a hurt friend first, shield yourself when hurt
  const hurtFriend = fighters.find(o => o !== f && o.alive && o.team === 'knight' && o.hp < o.maxHp * 0.5 && o.pos.distanceTo(f.pos) < 3);
  if (hurtFriend) { const h = affordable.find(s => s.school === 'heal' && s.id !== 'barrier'); if (h) return { s: h, target: hurtFriend }; }
  if (f.hp < f.maxHp * 0.55) { const b = affordable.find(s => s.id === 'barrier'); if (b && !f.shield) return { s: b }; const h = affordable.find(s => s.id.endsWith('healing')); if (h && Math.random() < 0.5) return { s: h, target: f }; }
  const attacks = affordable.filter(s => !s.self && s.school !== 'heal');
  if (!attacks.length || !P) return null;
  const dist = P.pos.distanceTo(f.pos);
  const ok = attacks.filter(s => s.id !== 'electric' || dist < 5);
  const pool = ok.length ? ok : attacks;
  return { s: pool[Math.floor(Math.random() * pool.length)] };
}
const _mw = new THREE.Vector3();
function updateMage(f, dt) {
  const ai = f.ai, M = f.mage;
  M.mana = Math.min(M.max, M.mana + dt * 2.2);
  ai.pickT = (ai.pickT || 0) - dt;
  if (ai.pickT <= 0 || !ai.target || !ai.target.alive || ai.target.inside) { ai.pickT = 0.6 + Math.random() * 0.4; ai.target = pickTarget(f); }
  const P = ai.target;
  const C = M.circle;
  // getting hit breaks the chant
  if (M.chant && (f.stagger > 0.12 || !f.canAct())) { M.chant = null; f.castAim = null; fizzle(palm(f), { school: 'arcane' }); }
  let wish = _mw.set(0, 0, 0), speed = 0, face = f.facing;
  if (!P || !P.alive) ai.alert = false;
  if (P && !ai.alert) {
    const toP = P.pos.clone().sub(f.pos).setY(0), d = toP.length();
    const fwd = { x: Math.sin(f.facing), z: Math.cos(f.facing) };
    if ((d < 30 && (fwd.x * toP.x + fwd.z * toP.z) / d > 0.5) || d < 8 || (f.lastHitBy && f.lastHitBy.alive)) { ai.alert = true; ai.react = 0.3 + Math.random() * 0.4; }
  }
  if (ai.alert && !ai.shouted && ai.react <= 0) { ai.shouted = true; sfx.voice(f.pos, 'shout', f.voicePitch); alertNear(f, P); }
  if (ai.react > 0) ai.react -= dt;
  if (!ai.alert || !P) {
    // walk around the camp like the others
    if (ai.wait > 0) ai.wait -= dt;
    else {
      const dx = ai.tx - f.pos.x, dz = ai.tz - f.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { ai.wait = 2 + Math.random() * 5; const a = Math.random() * 6.28, r = 3 + Math.random() * 9; ai.tx = ai.camp.x + Math.cos(a) * r; ai.tz = ai.camp.z + Math.sin(a) * r; }
      else { wish.set(dx / d, 0, dz / d); speed = (ai.raid ? 3.2 : 1.4) * f.legMult; face = Math.atan2(dx, dz); }
    }
  } else {
    const toP = P.pos.clone().sub(f.pos).setY(0), dist = toP.length(); toP.normalize();
    face = Math.atan2(toP.x, toP.z);
    // keep the fight at a distance; back off when a sword gets close
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? 1 : -1; ai.strafeT = 1.5 + Math.random() * 2; }
    const side = new THREE.Vector3(toP.z, 0, -toP.x).multiplyScalar(ai.strafe);
    if (dist < 5) { wish.copy(toP).negate().addScaledVector(side, 0.4).normalize(); speed = 3.6 * f.legMult; }
    else if (dist > M.keep + 6) { wish.copy(toP); speed = 3.2 * f.legMult; }
    else { wish.copy(side).addScaledVector(toP, dist > M.keep ? 0.4 : -0.3).normalize(); speed = 1.2 * f.legMult; }
    if (M.chant) speed *= 0.4;
    // choose the next spell early, so a seer can see it coming
    M.cd -= dt;
    if (!M.next && M.cd < 2.5) M.next = pickMageSpell(f);
    if (!M.chant && M.cd <= 0 && f.canAct() && M.next && M.mana >= M.next.s.cost) {
      M.chant = { s: M.next.s, target: M.next.target || P, t: 0, need: CHANT_T[M.next.s.rank] * (M.tier === 2 ? 1.0 : 1.35) };
      M.next = null;
      sfx.chant(f.pos, M.chant.s.chant, f.voicePitch, M.chant.need);
    }
    if (M.chant) {
      const ch = M.chant;
      ch.t += dt;
      const tp = ch.target && ch.target.alive ? ch.target : P;
      const aimP = chestOf(tp);
      f.castAim = palm(f).addScaledVector(aimP.clone().sub(palm(f)).normalize(), 0.6);
      face = Math.atan2(aimP.x - f.pos.x, aimP.z - f.pos.z);
      const k = Math.min(1, ch.t / ch.need), col = SCHOOL[ch.s.school].c;
      C.material.color.setRGB(col[0] * 0.5, col[1] * 0.5, col[2] * 0.5); C.material.opacity = 0.3 + 0.7 * k; C.scale.setScalar(0.25 + 0.35 * k);
      C.position.copy(f.b.LeftHand.getWorldPosition(new THREE.Vector3())).addScaledVector(aimP.clone().sub(f.pos).setY(0).normalize(), 0.18);
      C.lookAt(aimP); C.rotateZ(ch.t * 2);
      if (ch.t >= ch.need) {
        // lead a moving target a little, like a real archer would
        const lead = Math.min(0.6, f.pos.distanceTo(tp.pos) / 30);
        const aim = aimP.clone().addScaledVector(tp.vel, lead).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6));
        castSpell(f, ch.s, { aim, target: tp, power: 1 });
        M.mana -= ch.s.cost; M.chant = null;
        M.cd = (M.tier === 2 ? 1.4 : 2.2) + Math.random() * 1.8;
      }
    } else C.material.opacity *= Math.pow(0.001, dt);
  }
  if (!f.canAct()) speed *= 0.2;
  if (f.stagger > 0) wish.multiplyScalar(0);
  stepFighter(f, dt, wish, speed, face, 7);
}
// a dead mage's spell dies with him
deathHooks.push((v) => { if (v.mage) { v.mage.chant = null; v.mage.circle.visible = false; v.castAim = null; } });
const removeFighter0 = removeFighter;
removeFighter = function (f) { if (f.mage) { scene.remove(f.mage.circle); if (f.staff && f.staff.parent) f.staff.parent.remove(f.staff); } removeFighter0(f); };
// the staff falls with him, the book is in his robe
const lootBody0 = lootBody;
lootBody = function (o) {
  if (o.book) { magic.books.push(o.book); ui.sub('Found a spell book: ' + SPELL[o.book].name + '. Read it in your spellbook (G).', 3.5); o.book = null; sfx.ui(560); saveMagic(true); if (!o.purse && !o.loot) return; }
  lootBody0(o);
};
// E on a body with only a book left still searches it
const interactTarget0 = interactTarget;
interactTarget = function () {
  const t = interactTarget0();
  if (t) return t;
  if (!player.alive) return null;
  for (const o of fighters) if (!o.alive && o.book && o.pos.distanceTo(player.pos) < 2) return { kind: 'loot', o, text: 'Search the body' };
  return null;
};

// ---- your fires and Ashford ----
function onHouseFire(h, by) {
  if (!by || !by.isPlayer) return;
  const owners = villagers.filter(v => (SPOTS[v.vill.p.home] === h));
  for (const v of villagers) {
    const st = v.vill.st;
    const mine = owners.includes(v);
    st.opinion = clampO(st.opinion - (mine ? 60 : 15)); st.fear = Math.min(100, st.fear + (mine ? 40 : 15));
    if (mine) { remember(st, 'the dark knight burned my house down with his fire magic'); if (v.vill.p.fighter && v.alive && !v.vill.p.married) { v.angryAtYou = true; if (!v.ai) toFight(v, { alert: true }); if (v.ai) { v.ai.target = player; v.ai.pickT = 8; } } }
  }
  spreadWord(null, 'that the dark knight set a house on fire with magic', -12, 15, 0.5);
  ui.message('YOU SET A HOUSE ON FIRE', 2.2);
}
// a villager saying something out loud near you
function npcSayNear(f, lines) {
  if (!f || !f.vill || !f.alive || f.pos.distanceTo(player.pos) > 18) return;
  if ((f.sayT || 0) > clockNow) return;
  f.sayT = clockNow + 8;
  const line = Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines;
  sfx.murmur(f.pos, line, f.voicePitch, f.vill.p.sex === 'f');
  ui.sub(f.vill.p.name + ': ' + line, 3);
}
// the healer heals hurt people with real magic
let healerT = 0;
function updateVillageMagic(dt) {
  healerT -= dt;
  if (healerT > 0) return;
  healerT = 3;
  for (const id of ['agnes', 'isolde']) {
    const h = personFor(id);
    if (!h || !h.alive || h.inside || h.ai || h.vill.mode === 'flee' || h.vill.mode === 'scene') continue;
    const hurt = fighters.find(o => o !== h && o.alive && !o.inside && (o.vill || (o.isPlayer && h.vill.st.opinion > 25)) && o.hp < o.maxHp * 0.7 && o.pos.distanceTo(h.pos) < 10 && !o.knock);
    if (!hurt) continue;
    const s = SPELL[id === 'agnes' && hurt.hp < hurt.maxHp * 0.4 ? 'greaterhealing' : 'healing'];
    h.facing = Math.atan2(hurt.pos.x - h.pos.x, hurt.pos.z - h.pos.z);
    sfx.chant(h.pos, s.chant, h.voicePitch, 1.2);
    setTimeout(() => { if (h.alive && hurt.alive) { castSpell(h, s, { aim: chestOf(hurt), target: hurt }); if (hurt.isPlayer) ui.sub(h.vill.p.name + ' heals your wounds with magic.', 2.5); } }, 1200);
    healerT = 9;
  }
}

// ---- learning from Ulric (and the healers) ----
const LESSON_PRICE = [12, 72, 480, 1440, 4000];
function lessonList(f) {
  const id = f.vill.p.id;
  if (id === 'agnes' || id === 'isolde') return ['healing', 'greaterhealing', 'barrier'].filter(s => !magic.known.includes(s));
  if (id === 'ulric') return SPELLS.filter(s => !magic.known.includes(s.id) && s.school !== 'heal' && s.rank <= 3).sort((a, b) => a.rank - b.rank).slice(0, 6).map(s => s.id);
  return [];
}
// the rows each teacher puts in the shop window
function magicShopRows(f, buy) {
  const id = f.vill.p.id;
  for (const sid of lessonList(f)) {
    const s = SPELL[sid];
    buy('lesson_' + sid, 'Lesson: ' + s.name, LESSON_PRICE[s.rank], RANKS[s.rank] + ' ' + SCHOOL[s.school].name + ' magic. ' + s.desc + (magic.max < RANK_MANA[s.rank] ? ' (You need ' + RANK_MANA[s.rank] + ' mana to cast it; you have ' + Math.floor(magic.max) + '.)' : ''), () => { learnSpell(sid, f.vill.p.name + ' teaches you the chant.'); lessonDone(f); });
  }
  if (id === 'ulric') {
    const lv = Math.round(magic.chantless * 10);
    if (magic.chantless < 0.6) buy('chantless', 'Practice casting without words (' + Math.round(magic.chantless * 100) + '% now)', [24, 48, 96, 160, 240, 360][Math.min(5, lv)], 'Shift+R casts without a chant: instant, but costs more mana and can fail. Lessons make it cheaper and safer.', () => { magic.chantless = Math.min(1, magic.chantless + 0.08); saveMagic(true); lessonDone(f); });
    buy('manadraught', 'Mana draught', 18, 'Bitter blue potion: +45 mana right away (N to drink)', () => addItem('manadraught'));
    magic.books.forEach((b, i) => { if (magic.known.includes(b)) buy('sellbook_' + i + b, 'Sell: book of ' + SPELL[b].name, 0, 'You already know it', null); });
  }
  if (id === 'agnes' || id === 'isolde') buy('manadraught', 'Mana draught', 22, '+45 mana right away (N to drink)', () => addItem('manadraught'));
}
function lessonDone(f) { magic.lessons++; const st = f.vill.st; st.opinion = clampO(st.opinion + 3); remember(st, 'gave the dark knight a magic lesson'); saveMagic(true); }
// fold the teachers into the shops
const shopRows0 = shopRows;
shopRows = function (f) {
  const rows = shopRows0(f);
  const p = f.vill.p;
  if (p.shop === 'magic' || p.id === 'agnes' || p.id === 'isolde') {
    const add = [];
    const buy = (key, label, base, sub, fn, can = true) => { if (key.startsWith('sellbook_')) { const i = +key.split('_')[1].match(/^\d+/)[0]; add.push({ key, label, base: 30, sub, sell: true, fn: () => { magic.books.splice(i, 1); saveMagic(true); } }); } else add.push({ key, label, base, sub, fn, can }); };
    magicShopRows(f, buy);
    rows.push(...add);
  }
  return rows;
};
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyN' || e.repeat || !playing || paused || uiOpen || cutscene || passedOut || !player.alive) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (!(vsave.items.manadraught > 0)) { ui.sub('No mana draughts. Ulric and the healer sell them.', 2); return; }
  addItem('manadraught', -1); magic.mana = Math.min(magic.max, magic.mana + 45); magic.exh = Math.max(0, magic.exh - 25);
  sfx.ui(330); ui.sub('You drink the mana draught. Cold and bitter. (+45 mana)', 2);
});

// ---- the spellbook (G) ----
let bookOpen = false, bookPick = null;
function openBook() {
  if (bookOpen) return closeBook();
  bookOpen = true; uiOpen = true; bookPick = null;
  if (document.pointerLockElement) document.exitPointerLock();
  document.getElementById('book').style.display = 'flex';
  renderBook();
}
function closeBook() { if (!bookOpen) return; bookOpen = false; uiOpen = false; document.getElementById('book').style.display = 'none'; if (!cutscene) requestLock(); }
function renderBook() {
  const el = document.getElementById('bookRows');
  const head = document.getElementById('bookHead');
  head.innerHTML = `<b>${rankTitle()}</b> &nbsp; Mana ${Math.floor(magic.mana)} / ${Math.floor(magic.max)} &nbsp; Exhaustion ${Math.round(magic.exh)}% &nbsp; Chantless ${Math.round(magic.chantless * 100)}%`
    + (magic.eye ? ` &nbsp; <span style="color:#c9a6ff">${EYE_NAMES[magic.eye]} (V)</span>` : '');
  let html = '';
  if (magic.books.some(b => !magic.known.includes(b))) {
    html += '<div class="bsch">Books you carry</div>';
    magic.books.forEach((b, i) => { if (!magic.known.includes(b)) html += `<div class="brow"><span>Book of <b>${SPELL[b].name}</b> <small>${RANKS[SPELL[b].rank]} ${SCHOOL[SPELL[b].school].name}</small></span><button class="chip" data-read="${i}">Read it</button></div>`; });
  }
  for (const sk in SCHOOL) {
    const list = SPELLS.filter(s => s.school === sk);
    html += `<div class="bsch" style="color:${SCHOOL[sk].css}">${SCHOOL[sk].name}</div>`;
    for (const s of list) {
      const known = magic.known.includes(s.id), can = magic.max >= RANK_MANA[s.rank];
      const slot = magic.bar.indexOf(s.id);
      const ins = magic.insight[s.id] || 0;
      const state = !known ? (ins ? `watched ${ins}/3` : 'unknown: a book, a teacher, or watching a mage') : !can ? `needs ${RANK_MANA[s.rank]} mana` : 'mastery ' + Math.round(magic.mastery[s.id] || 0) + '%';
      html += `<div class="brow${known ? '' : ' unk'}${bookPick === s.id ? ' pick' : ''}" data-id="${known ? s.id : ''}"><span><b>${known ? s.name : '???'}</b> <small>${RANKS[s.rank]} | ${s.cost} mana | ${state}</small>${known ? `<br><small class="bd">${s.desc}</small>` : ''}</span><em>${slot >= 0 ? 'slot ' + (slot + 1) : ''}</em></div>`;
    }
  }
  el.innerHTML = html;
  el.querySelectorAll('[data-read]').forEach(b => b.onclick = (ev) => { ev.stopPropagation(); const i = +b.dataset.read, id = magic.books[i]; magic.books.splice(i, 1); fadeTo(0.7, 0.4, () => fadeTo(0, 0.6)); learnSpell(id, 'You read the book by the light of your hand.'); renderBook(); });
  el.querySelectorAll('.brow[data-id]').forEach(r => { if (!r.dataset.id) return; r.onclick = () => { bookPick = r.dataset.id; renderBook(); }; });
  const bar = document.getElementById('bookBar');
  bar.innerHTML = magic.bar.map((id, i) => `<button class="slotb${magic.sel === i ? ' on' : ''}" data-slot="${i}"><i>${i + 1}</i>${id ? SPELL[id].name : '-'}</button>`).join('');
  bar.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { const i = +b.dataset.slot; if (bookPick) { const old = magic.bar.indexOf(bookPick); if (old >= 0) magic.bar[old] = null; magic.bar[i] = bookPick; bookPick = null; } else magic.bar[i] = null; saveMagic(true); ui.hotbar(); renderBook(); });
  document.getElementById('bookHint').textContent = bookPick ? 'Now click a slot below (or press 1-8) to put ' + SPELL[bookPick].name + ' there.' : 'Click a spell you know, then a slot. Click an empty-handed slot to clear it.';
}
addEventListener('keydown', (e) => {
  if (!bookOpen) return;
  if (e.code === 'Escape' || e.code === 'KeyG') { e.preventDefault(); closeBook(); return; }
  const m = /^Digit([1-8])$/.exec(e.code);
  if (m && bookPick) { const i = +m[1] - 1, old = magic.bar.indexOf(bookPick); if (old >= 0) magic.bar[old] = null; magic.bar[i] = bookPick; bookPick = null; saveMagic(true); ui.hotbar(); renderBook(); }
});
