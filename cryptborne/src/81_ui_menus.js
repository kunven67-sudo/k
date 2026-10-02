
// =====================================================================
// UI — menus, saves, hero creator, settings, skills, journal, cutscenes.
// =====================================================================
const MAX_SAVES = 8;
function lookForSpeaker(who) {
  const L = G.save ? G.save.look : { skin: '#f0c08a', hair: '#5a3417' };
  switch (who) {
    case 'you': return G.save ? heroLook() : null;
    case 'finn': return FINN_LOOK(L);
    case 'hollow': return Object.assign(FINN_LOOK(L), { eyeCol: '#d8454a', skin: '#c8b8b0' });
    case 'dad': return DAD_LOOK;
    case 'lich': return Object.assign({}, DAD_LOOK, { hood: '#2a1040', eyeCol: '#7ff8ff', skin: '#8a8890' });
    case 'tobin': { const n = getWorld('vale').npcs.find((x) => x.id === 'tobin'); return n ? n.look : null; }
    case 'shadow': return G.save ? Object.assign({}, heroLook(), { skin: '#2a2430', hair: '#0a0810', shirt: '#1a1420', shirtDark: '#120e18', pants: '#120e18', eyeCol: '#d8454a' }) : null;
    default: return null;
  }
}
Object.assign(UI, {
  cr: null, crT: 0, spSel: 0, jTab: 'quests', sayS: null,
  // ----- saves -----
  renderSaves() {
    $('#storeNote').textContent = Store.mode === 'cloud' ? 'Your saves are kept in your Claude account, so they follow you to other devices.' : 'Your saves are kept in this browser.';
    const list = Store.list(), box = $('#saveList');
    $('#btnNewHero').disabled = list.length >= MAX_SAVES; $('#btnNewHero').textContent = list.length >= MAX_SAVES ? `${MAX_SAVES} SAVES MAX: DELETE ONE FIRST` : '+ NEW HERO';
    if (!list.length) { box.innerHTML = '<div class="empty">No saves yet. Press NEW HERO to make your character.</div>'; return; }
    box.innerHTML = '';
    for (const raw of list) {
      const s = raw, P = s.player || {}, card = document.createElement('div'); card.className = 'save-card';
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 20;
      const arm = P.eq && P.eq.armor && ITEMS[P.eq.armor.id || P.eq.armor];
      try { humanPortrait(cv, heroLook(Object.assign({ cls: 'warrior', look: {} }, s)), { armor: arm && arm.color, trim: arm && arm.trim }); } catch (e) {}
      const bosses = Object.keys((s.stats && s.stats.bosses) || {}).length, cls = CLASSES[s.cls] ? CLASSES[s.cls].name : 'Warrior', diff = DIFF[s.diff] ? DIFF[s.diff].name : 'Normal';
      const st = s.story || {}, notes = st.notes ? NOTE_IDS.filter((k) => st.notes[k]).length : 0;
      const ends = Object.keys(st.endings || {}).map((k) => ENDINGS[k] ? (k === 'good' || k === 'secret' ? ENDINGS[k].title : 'Bad: ' + ENDINGS[k].sub) : '').filter(Boolean);
      card.innerHTML = `<div class="who"><div class="nm"></div>
        <div class="meta">${esc(cls)} &middot; Level <b>${P.level | 0}</b> &middot; <b class="${s.diff === 'hardcore' ? 'bad' : ''}">${esc(diff)}</b> &middot; <b>${fmtNum(P.coins || 0)}</b> coins</div>
        <div class="meta">Act <b>${st.act || (s.stats && s.stats.bosses && s.stats.bosses.forge ? 2 : 1)}</b> &middot; <b>${bosses}</b>/${DUNGEONS.length} bosses &middot; <b>${notes}</b>/${NOTE_IDS.length} notes${s.world ? ` &middot; Night <b>${s.world.nights | 0}</b>` : ''}</div>
        ${ends.length ? `<div class="meta">Endings: <b>${esc(ends.join(', '))}</b></div>` : ''}
        <div class="meta">Created: <b>${esc(fmtDate(s.created))}</b></div>
        <div class="meta">Last loaded: <b>${esc(fmtDate(s.lastLoaded))}</b> &middot; Last saved: <b>${esc(fmtDate(s.lastSaved))}</b></div></div><div class="acts"></div>`;
      card.prepend(cv); card.querySelector('.nm').textContent = s.name;
      const acts = card.querySelector('.acts');
      const mk = (label, c, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm ' + c; b.textContent = label; b.addEventListener('click', fn); acts.appendChild(b); return b; };
      const normal = () => { acts.innerHTML = ''; mk('PLAY', 'gold', () => startGame(Store.get(s.id))); mk('DELETE', 'red', () => { acts.innerHTML = ''; const q = document.createElement('span'); q.className = 'meta'; q.textContent = 'Delete forever?'; acts.appendChild(q); mk('YES, DELETE', 'red', () => { Store.del(s.id); Sfx.play('fail'); this.renderSaves(); }); mk('NO', '', normal); }); };
      normal(); box.appendChild(card);
    }
  },
  // ----- hero creator -----
  openCreator() {
    this.cr = { cls: 'warrior', diff: 'normal', look: { skin: LOOK_OPTS.skin[1], hair: LOOK_OPTS.hair[2], hairStyle: 3, shirt: null, pants: null }, waveT: 0, t: 0 };
    $('#crName').value = '';
    this.renderCreator();
  },
  renderCreator() {
    const c = this.cr, L = c.look;
    $('#crClass').innerHTML = Object.entries(CLASSES).map(([k, C]) => `<button type="button" class="cr-class${c.cls === k ? ' on' : ''}" data-cls="${k}"><b>${C.name.toUpperCase()}</b><span>${esc(C.desc)}</span><span>Starts with: ${esc([C.start.weapon, C.start.shield, C.start.armor].filter(Boolean).map((id) => ITEMS[id].name).join(', '))}</span><span>First special: ${esc(SPECIALS[C.specials[0]].name)}</span></button>`).join('');
    const sw = (id, key, opts, cur) => { $(id).innerHTML = opts.map((col) => `<button type="button" style="background:${col}" class="${cur === col ? 'on' : ''}" data-k="${key}" data-v="${col}" aria-label="${key} ${col}"></button>`).join(''); };
    const C = CLASSES[c.cls];
    sw('#crSkin', 'skin', LOOK_OPTS.skin, L.skin); sw('#crHair', 'hair', LOOK_OPTS.hair, L.hair); sw('#crShirt', 'shirt', LOOK_OPTS.shirt, L.shirt || C.shirt); sw('#crPants', 'pants', LOOK_OPTS.pants, L.pants || C.pants);
    $('#crHairStyle').innerHTML = HAIR_NAMES.map((n, i) => `<button type="button" class="${L.hairStyle === i ? 'on' : ''}" data-hs="${i}">${n.toUpperCase()}</button>`).join('');
    $('#crDiff').innerHTML = Object.entries(DIFF).map(([k, d]) => `<button type="button" class="${c.diff === k ? 'on' : ''}${d.perma ? ' hc' : ''}" data-diff="${k}"><b>${d.name.toUpperCase()}</b><span>${esc(d.desc)}</span></button>`).join('');
    for (const b of $$('#crClass [data-cls]')) b.addEventListener('click', () => { c.cls = b.dataset.cls; c.waveT = 1.2; Sfx.play('click'); this.renderCreator(); });
    for (const b of $$('#creator [data-k]')) b.addEventListener('click', () => { L[b.dataset.k] = b.dataset.v; Sfx.play('click'); this.renderCreator(); });
    for (const b of $$('#crHairStyle [data-hs]')) b.addEventListener('click', () => { L.hairStyle = +b.dataset.hs; Sfx.play('click'); this.renderCreator(); });
    for (const b of $$('#crDiff [data-diff]')) b.addEventListener('click', () => { c.diff = b.dataset.diff; Sfx.play(DIFF[c.diff].perma ? 'boss' : 'click'); this.renderCreator(); });
    this.drawCreator();
  },
  creatorLook() { const c = this.cr; return heroLook({ cls: c.cls, look: Object.assign({}, c.look, { shirt: c.look.shirt || CLASSES[c.cls].shirt, pants: c.look.pants || CLASSES[c.cls].pants }) }); },
  drawCreator() {
    const c = this.cr; if (!c) return; const cv = $('#crCanvas'), x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height);
    const C = CLASSES[c.cls], arm = C.start.armor && ITEMS[C.start.armor];
    x.save(); x.scale(2, 2);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(7, 26, 10, 2);
    const wave = c.waveT > 0;
    drawHuman(x, 12, 27, this.creatorLook(), { face: 1, breathe: Math.floor(c.t / 0.8) % 2 === 1, blink: c.t % 3.7 < 0.12, armor: arm && arm.color, trim: arm && arm.trim, pose: wave ? 'wave' : null, poseT: (c.t * 1.5) % 1 });
    if (!wave) { const w = itemIcon(C.start.weapon); x.drawImage(w, 13, 14, 9, 9); }
    if (C.start.shield) x.drawImage(itemIcon(C.start.shield), 2, 15, 8, 8);
    x.restore();
  },
  creatorTick(dt) { const c = this.cr; if (!c) return; c.t += dt; c.waveT = Math.max(0, c.waveT - dt); this.drawCreator(); },
  createHero() {
    if (Store.list().length >= MAX_SAVES) { this.toast('You can keep 8 saves. Delete one first.', 'bad'); return; }
    const c = this.cr, name = ($('#crName').value || '').trim().replace(/\s+/g, ' ').slice(0, 16) || 'Hero';
    const look = Object.assign({}, c.look, { shirt: c.look.shirt || CLASSES[c.cls].shirt, pants: c.look.pants || CLASSES[c.cls].pants });
    const s = newSaveData({ name, cls: c.cls, look, diff: c.diff }); Store.put(s); Sfx.play('level'); startGame(s);
  },
  // ----- settings -----
  syncSettings() {
    $('#setMusic').value = SET.music; $('#setMusicOut').textContent = SET.music; $('#setSfx').value = SET.sfx; $('#setSfxOut').textContent = SET.sfx;
    $('#setZoom').value = String(SET.zoom); $('#setWeather').checked = SET.weather; $('#setShake').checked = SET.shake; $('#setDmg').checked = SET.dmg; $('#setNames').checked = SET.names;
  },
  // ----- pause & death -----
  openPause() {
    if (!G.on || G.dead || Story.active()) return;
    const s = G.save, t = Math.floor(s.stats.playTime / 60);
    $('#pauseInfo').innerHTML = `<b>${esc(s.name)}</b> &middot; ${esc(CLASSES[s.cls].name)} level ${S().level} &middot; ${esc(DF().name)}<br>Day ${s.world.day}, ${Clock.label()} &middot; played ${Math.floor(t / 60)}h ${t % 60}m<br>Last saved: ${esc(fmtDate(s.lastSaved))}${DF().perma ? '<br><span class="bad">HARDCORE: dying deletes this save.</span>' : ''}`;
    this.openModal('pauseModal'); Sfx.play('click');
  },
  showDeath(lost) {
    if (!G.dead) return; Input.clear();
    if (G.save && G.save.deleted) {
      $('#deathTitle').textContent = 'YOUR STORY ENDS';
      $('#deathInfo').innerHTML = `Hardcore hero <b>${esc(G.save.name)}</b> fell at level ${S().level}.<br>The save is gone forever. Finn waits for someone else now.`;
      $('#btnRespawn').textContent = 'BACK TO MENU';
    } else {
      $('#deathTitle').textContent = 'YOU DIED';
      $('#deathInfo').textContent = lost > 0 ? `You dropped ${fmtNum(lost)} coins. You wake up in Emberfall.` : 'You wake up in Emberfall.';
      $('#btnRespawn').textContent = 'RESPAWN IN EMBERFALL';
    }
    this.openModal('deathModal');
  },
  deathButton() {
    this.closeModal(true);
    if (G.save && G.save.deleted) { G.on = false; G.dead = false; G.save = null; menuScene(); this.showScreen('menu'); return; }
    respawn();
  },
  // ----- skills -----
  branchPts(br) { let n = 0; for (const s of SKILLS) if (s.br === br) n += sk(s.id); return n; },
  openSkills() { if (G.dead || Story.active()) return; this.spSel = Math.max(0, S().specials.indexOf(null)); this.openModal('skillsModal'); this.renderSkills(); Sfx.play('click'); },
  renderSkills() {
    const P = S(), C = CLASSES[G.save.cls];
    $('#spLeft').textContent = `${P.sp} SKILL POINT${P.sp === 1 ? '' : 'S'}`;
    $('#spSlots').innerHTML = P.specials.map((id, i) => `<button type="button" class="sp-slot${this.spSel === i ? ' sel' : ''}" data-slot="${i}"><b>${SPECIAL_KEYS[i]}</b>${id ? esc(SPECIALS[id].name) : '<span class="dim">empty</span>'}</button>`).join('');
    $('#spList').innerHTML = C.specials.map((id) => { const d = SPECIALS[id], locked = P.level < d.lvl, on = P.specials.includes(id); return `<button type="button" class="sp-card${locked ? ' locked' : ''}${on ? ' eq' : ''}" data-sp="${id}" ${locked ? 'disabled' : ''}><b>${esc(d.name.toUpperCase())}${on ? ` [${SPECIAL_KEYS[P.specials.indexOf(id)]}]` : ''}</b><span>${esc(d.desc)}</span><span>${locked ? `Unlocks at level ${d.lvl}` : `Cooldown ${d.cd}s`}</span></button>`; }).join('');
    $('#skillTree').innerHTML = Object.entries(BRANCHES).map(([br, B]) => {
      const pts = this.branchPts(br);
      return `<div class="branch"><h4 style="color:${B.col}">${B.name} <span class="dim">(${pts})</span></h4>${SKILLS.filter((s) => s.br === br).map((s) => {
        const r = sk(s.id), need = s.row * 2, open = pts >= need, can = open && r < 3 && P.sp > 0;
        return `<button type="button" class="node${r >= 3 ? ' maxed' : ''}" data-sk="${s.id}" ${can ? '' : 'disabled'}><b>${esc(s.name)}</b><span class="pips">${'■'.repeat(r)}${'□'.repeat(3 - r)}</span><span>${esc(s.per)} per rank</span>${open ? '' : `<span>Needs ${need} points in ${B.name}</span>`}</button>`;
      }).join('')}</div>`;
    }).join('');
    for (const b of $$('#spSlots [data-slot]')) b.addEventListener('click', () => { this.spSel = +b.dataset.slot; Sfx.play('click'); this.renderSkills(); });
    for (const b of $$('#spList [data-sp]')) b.addEventListener('click', () => {
      const id = b.dataset.sp, sl = P.specials, cur = sl.indexOf(id), dst = this.spSel;
      if (cur === dst) { sl[dst] = null; }
      else { if (cur >= 0) sl[cur] = sl[dst]; sl[dst] = id; G.p.cds[dst] = Math.max(G.p.cds[dst], 1); }
      if (!sl.some(Boolean)) sl[dst] = id;
      const nx = sl.indexOf(null); if (nx >= 0) this.spSel = nx;
      Sfx.play('special'); this.renderSkills(); saveGame(true);
    });
    for (const b of $$('#skillTree [data-sk]')) b.addEventListener('click', () => {
      const s = SKILL_BY_ID[b.dataset.sk]; if (P.sp <= 0 || sk(s.id) >= 3 || this.branchPts(s.br) < s.row * 2) return;
      P.skills[s.id] = sk(s.id) + 1; P.sp--; statsChanged(); Sfx.play('level'); this.renderSkills(); saveGame(true);
    });
  },
  // ----- journal -----
  openJournal(tab) { if (G.dead || Story.active()) return; if (tab) this.jTab = tab; this.openModal('journalModal'); this.renderJournal(); Sfx.play('page'); },
  renderJournal() {
    for (const b of $$('#journalModal [data-jt]')) b.classList.toggle('on', b.dataset.jt === this.jTab);
    const box = $('#journalBody'), Q = G.save.quests, s = ST();
    if (this.jTab === 'quests') {
      let h = `<div class="jq"><b>STORY</b>${esc(s.ending ? 'The story is over. Keep exploring, or chase another ending.' : this.storyGoal())}</div>`;
      if (!Q.active.length) h += '<div class="empty">No quests. Look for people with a yellow ! above their head.</div>';
      for (const q of Q.active) { const d = Quests.done(q); h += `<div class="jq${d ? ' done' : ''}"><b>${esc((q.type || '').toUpperCase())} &middot; for ${esc(NPC_NAMES[q.giver] || q.giver)}</b>${esc(Quests.goal(q))}${d ? ` <span class="good">Done! Go back to ${esc(NPC_NAMES[q.giver] || q.giver)}.</span>` : ''}<span class="dim">Reward: ${fmtNum(q.coins || 0)} coins, ${fmtNum(q.xp || 0)} XP</span></div>`; }
      h += `<div class="dim">Quests finished: ${Q.done}</div>`;
      box.innerHTML = h;
    } else if (this.jTab === 'notes') {
      const n = Story.noteCount();
      let h = `<div class="note">${n} of ${NOTE_IDS.length} notes found. ${n < NOTES_NEEDED ? `Find at least ${NOTES_NEEDED} before the end, or Finn will be too far gone to reach.` : 'Finn will remember you.'}${n < NOTE_IDS.length ? '' : ' All of them! Something opened in the west of the Vale...'}</div><div class="notes-grid">`;
      h += `<button type="button" class="nt" data-note="n0"><b>${esc(NOTES.n0.title)}</b></button>`;
      for (const k of NOTE_IDS) { const got = s.notes[k], w = NOTES[k].where, place = (DUNGEON_BY_ID[w] && DUNGEON_BY_ID[w].name) || (REGIONS[w] && REGIONS[w].name) || 'somewhere'; h += got ? `<button type="button" class="nt" data-note="${k}"><b>${esc(NOTES[k].title)}</b></button>` : `<div class="nt missing">??? <br><span>${esc(place)}</span></div>`; }
      box.innerHTML = h + '</div>';
      for (const b of $$('#journalBody [data-note]')) b.addEventListener('click', () => { const id = b.dataset.note; this.showNote(id, () => this.openJournal('notes')); });
    } else {
      const seals = Object.keys(SEAL_NAMES).map((k) => `${SEAL_NAMES[k]}: ${s.seals[k] ? '<span class="bad">BROKEN</span>' : '<span class="good">holding</span>'}`).join('<br>');
      const left = DF().nights - G.save.world.nights;
      const acts = { 1: 'ACT 1: THE MISSING BROTHER. Finn left in the night, following a voice that sounds like Dad. Follow his trail through the dungeons of the Vale.', 2: 'ACT 2: THE FOUR SEALS. Finn is breaking the seals in the four far lands. Every seal he breaks makes the voice stronger.', 3: 'ACT 3: WRAITHMOOR TOMB. All seals are broken. The tomb is open. Finn is inside.' };
      const ends = Object.keys(ENDINGS).map((k) => `${s.endings[k] ? '★' : '☆'} ${s.endings[k] ? esc(ENDINGS[k].title + ': ' + ENDINGS[k].sub) : '???'}`).join('<br>');
      box.innerHTML = `<div class="jq"><b>WHERE THINGS STAND</b>${acts[s.act] || acts[1]}</div>
        <div class="jq"><b>THE SEALS</b>${seals}</div>
        <div class="jq${left <= 5 ? '' : ' done'}"><b>NIGHTS</b>Night ${G.save.world.nights} of ${DF().nights}. ${s.ending ? '' : left > 0 ? `${left} nights left before the night never ends.` : 'This is the last night.'} Sleeping in your bed skips to morning.</div>
        <div class="jq"><b>ENDINGS FOUND</b>${ends}</div>`;
    }
  },
  showNote(id, cb) {
    const n = NOTES[id]; if (!n) { if (cb) cb(); return; }
    if (this.modal) this.closeModal(true);
    $('#noteTitle').textContent = n.title; $('#noteText').textContent = n.text;
    this._noteDone = cb || null; this.openModal('noteModal'); Sfx.play('page');
  },
  // ----- cutscenes -----
  cutscene(on) {
    $('#cutscene').hidden = !on; $('#hud').hidden = on || this.screen !== 'game'; if (Input.touchMode) $('#touch').hidden = on || this.screen !== 'game';
    if (on && this.modal && this.modal !== 'noteModal') this.closeModal(true);
    if (!on) { this.sayS = null; this.hudDirty(); }
  },
  say(who, text) {
    const sp = SPEAKERS[who] || SPEAKERS.narrator, name = who === 'you' ? (G.save ? G.save.name : 'You') : sp.name || '';
    $('#sayBox').hidden = false; $('#sayChoices').innerHTML = ''; $('#sayNext').hidden = false;
    $('#sayName').textContent = name; $('#sayName').style.color = sp.col;
    $('#sayText').style.fontStyle = who === 'narrator' || who === 'voice' ? 'italic' : '';
    const L = lookForSpeaker(who), face = $('#sayFace'); face.hidden = !L; if (L) humanPortrait(face, L, { blink: false });
    this.sayS = { full: text, shown: 0, t: 0, who, pitch: sp.blip || 1 };
    $('#sayText').textContent = '';
  },
  sayTick(dt) {
    const s = this.sayS; if (!s || s.shown >= s.full.length) return;
    s.t += dt * 48; const n = Math.min(s.full.length, Math.floor(s.t));
    if (n > s.shown) { if (Math.floor(n / 2) > Math.floor(s.shown / 2) && /\w/.test(s.full[n - 1])) Sfx.blip(s.pitch || 1); s.shown = n; $('#sayText').textContent = s.full.slice(0, n); }
  },
  sayBusy() { return !!this.sayS && this.sayS.shown < this.sayS.full.length; },
  sayFinish() { if (!this.sayS) return; this.sayS.shown = this.sayS.full.length; $('#sayText').textContent = this.sayS.full; },
  hideSay() { $('#sayBox').hidden = true; $('#sayChoices').innerHTML = ''; this.sayS = null; },
  titleCard(a, b) { $('#titleCard').hidden = false; $('#titleMain').textContent = a; $('#titleSub').textContent = b || ''; Sfx.play('bell'); },
  hideTitle() { $('#titleCard').hidden = true; },
  choice(prompt, opts, cb) {
    this.sayS = null; $('#sayBox').hidden = false; $('#sayName').textContent = ''; $('#sayText').textContent = prompt; $('#sayText').style.fontStyle = ''; $('#sayNext').hidden = true; $('#sayFace').hidden = true;
    const box = $('#sayChoices'); box.innerHTML = '';
    for (const [label, val] of opts) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm ' + (val === 'deal' ? 'red' : 'gold'); b.textContent = label; b.addEventListener('click', (e) => { e.stopPropagation(); box.innerHTML = ''; $('#sayBox').hidden = true; Sfx.play('click'); cb(val); }); box.appendChild(b); }
    const f = box.querySelector('button'); if (f) f.focus({ preventScroll: true });
  },
  // ----- endings -----
  credits(kind) {
    const E = ENDINGS[kind] || ENDINGS.good, s = G.save, t = Math.floor(s.stats.playTime / 60);
    const subs = {
      good: 'You and Finn sealed the crypts together. The voice is gone. On the walk home, Finn talks the whole way, and you let him.',
      secret: "You beat your own shadow and sealed the crypts with Finn. But the moon over Emberfall is turning red... and far away, in a valley you've never seen, something starts to hunt.\n\nBLOOD MOON HUNTER, coming next.",
      finn: 'You had to fight your own brother. Finn never remembered you. The crypts are quiet, and so is your house. (Find more of his notes next time.)',
      deal: 'You took Finn\'s place. He walks out into the morning. You never will. (Never trust the voice.)',
      night: 'Too many nights passed. The night never ended, and Finn never came home. (You get 15 more nights to try again.)',
    };
    $('#endKind').textContent = E.title; $('#endTitle').textContent = E.sub.toUpperCase(); $('#endSub').textContent = subs[kind] || ''; $('#endSub').style.whiteSpace = 'pre-line';
    $('#endStats').innerHTML = [['Hero', esc(s.name)], ['Class', CLASSES[s.cls].name], ['Level', S().level], ['Difficulty', DF().name], ['Nights', s.world.nights], ['Notes found', `${Story.noteCount()} / ${NOTE_IDS.length}`], ['Monsters killed', fmtNum(s.stats.kills)], ['Deaths', s.stats.deaths], ['Time played', `${Math.floor(t / 60)}h ${t % 60}m`], ['Endings found', `${Object.keys(s.story.endings).length} / ${Object.keys(ENDINGS).length}`]].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#endBack').textContent = kind === 'good' || kind === 'secret' ? 'BACK TO MENU' : 'BACK TO MENU (YOUR SAVE CONTINUES)';
    this.closeModal(true); this.showScreen('credits'); Music.set(kind === 'good' || kind === 'secret' ? 'victory' : 'sad');
  },
  init() {
    const click = (sel, fn) => $(sel).addEventListener('click', (e) => { AU.unlock(); fn(e); });
    click('#btnPlay', () => { Sfx.play('click'); this.showScreen('saves'); });
    click('#btnSettings', () => { Sfx.play('click'); this.settingsBack = 'menu'; this.showScreen('settings'); });
    for (const b of $$('[data-back]')) b.addEventListener('click', () => { AU.unlock(); Sfx.play('click'); this.back(); });
    for (const b of $$('[data-close]')) b.addEventListener('click', () => this.closeModal());
    for (const m of $$('.modal')) m.addEventListener('pointerdown', (e) => { if (e.target === m && m.id !== 'deathModal') this.closeModal(); });
    click('#btnNewHero', () => { Sfx.play('click'); if (Store.list().length >= MAX_SAVES) { this.toast('You can keep 8 saves. Delete one first.', 'bad'); return; } this.showScreen('creator'); });
    click('#crGo', () => this.createHero());
    $('#crName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); AU.unlock(); this.createHero(); } });
    const vol = (id, key) => { $(id).addEventListener('input', (e) => { SET[key] = +e.target.value; $(id + 'Out').textContent = SET[key]; AU.vols(); saveSettings(); }); $(id).addEventListener('change', () => { AU.unlock(); Sfx.play('coin'); }); };
    vol('#setMusic', 'music'); vol('#setSfx', 'sfx');
    $('#setZoom').addEventListener('change', (e) => { SET.zoom = +e.target.value; saveSettings(); resize(); if (G.on) snapCam(); });
    for (const [id, key] of [['#setWeather', 'weather'], ['#setShake', 'shake'], ['#setDmg', 'dmg'], ['#setNames', 'names']]) $(id).addEventListener('change', (e) => { SET[key] = e.target.checked; saveSettings(); });
    click('#minimap', () => { if (!this.modal && !Story.active()) this.openMap(); });
    click('#bagBtn', () => { if (!this.modal && !Story.active()) this.openBag(); });
    click('#pauseBtn', () => { if (!this.modal) this.openPause(); });
    $('#bigMap').addEventListener('click', (e) => this.mapClick(e));
    click('#pResume', () => this.closeModal());
    click('#pSave', () => saveGame());
    click('#pJournal', () => { this.closeModal(true); this.openJournal(); });
    click('#pSettings', () => { this.closeModal(true); this.settingsBack = 'pause'; this.showScreen('settings'); });
    click('#pQuit', () => quitToMenu());
    click('#btnRespawn', () => this.deathButton());
    click('#noteClose', () => this.closeModal());
    $('#dlgText').addEventListener('click', () => this.dlgFinish());
    for (const b of $$('#journalModal [data-jt]')) b.addEventListener('click', () => { this.jTab = b.dataset.jt; Sfx.play('page'); this.renderJournal(); });
    $('#cutscene').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; AU.unlock(); Story.advance(); });
    $('#skipScene').addEventListener('click', (e) => { e.stopPropagation(); Story.skip(); });
    click('#endBack', () => quitToMenu());
    click('#tJournal', () => { if (!this.modal) this.openJournal(); });
    click('#tSkills', () => { if (!this.modal) this.openSkills(); });
    $('#hCoinIco').src = COIN_SPR.toDataURL(); $('#hKeyIco').src = KEY_SPR.toDataURL();
    Store.onChange = () => { if (this.screen === 'saves') this.renderSaves(); };
  },
});
// skipping a cutscene still runs everything that changes the game (and stops at choices)
Story.skip = function () {
  if (!this.cur || this.block === 'choice') return;
  UI.hideSay(); UI.hideTitle(); if (UI.modal === 'noteModal') { UI._noteDone = null; UI.closeModal(true); }
  if (this.block === 'move' && this.moveTo) { G.p.x = this.moveTo.x; G.p.y = this.moveTo.y; G.p.moving = false; }
  this.block = null;
  while (this.cur && this.i < this.cur.length) {
    const [k, a, b] = this.cur[this.i];
    if (k === 'choice' || k === 'end') { this.next(); return; }
    this.i++;
    if (k === 'music') this.mood = a;
    else if (k === 'call') { if (CUT_FN[a]) CUT_FN[a](); }
    else if (k === 'vision') this.vision = a;
    else if (k === 'fade') { this.fadeTo = a === 'out' ? 1 : 0; this.fade = this.fadeTo; }
    else if (k === 'move') { const t = this.spot(a, b); G.p.x = t.x; G.p.y = t.y; }
    if (!this.cur) return; // a call can end the scene
  }
  this.finish();
};
