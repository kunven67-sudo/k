
// =====================================================================
// UI — HUD, bag, shops, talking, world map.
// =====================================================================
function itemStats(id, g) {
  const it = ITEMS[id], P = [], gs = g ? gearStats(g) : null;
  if (it.type === 'weapon') { P.push(`DMG ${gs ? gs.dmg : it.dmg}`, `${(1 / it.cd).toFixed(1)} hits/s`, it.wc === 'melee' ? `Reach ${it.range}` : it.wc === 'bow' ? 'Shoots arrows' : it.wc === 'wand' ? 'Magic bolts' : 'Exploding fireballs'); if (it.poison) P.push('Poison'); if (it.slow) P.push('Freezes'); if (it.burn) P.push('Burns'); if (it.lifesteal) P.push('Lifesteal'); }
  else if (it.type === 'shield') P.push(`Blocks ${Math.round((gs ? gs.block : it.block) * 100)}% of a hit`);
  else if (it.type === 'armor') { P.push(`Defense ${gs ? gs.def : it.def}`); if (it.regen) P.push('Heals you slowly'); if (it.speed) P.push('Faster movement'); }
  else if (it.type === 'potion') P.push(it.heal >= 9999 ? 'Full heal + stamina' : `Heals ${it.heal} HP`);
  else if (it.type === 'loot' || it.type === 'gem') P.push(`Sells for ${sellPrice(id)} coins`);
  return P.join(' · ');
}
function gemsHTML(g) { if (!g || !isGear(g.id)) return ''; const n = SOCKETS[ITEMS[g.id].rarity]; let h = '<span class="gems">'; for (let i = 0; i < n; i++) h += g.gems[i] ? `<img class="px" src="${iconURL(g.gems[i])}" alt="${ITEMS[g.gems[i]].name}">` : '<i title="empty socket"></i>'; return h + '</span>'; }
function compareHTML(id, g) {
  if (!G.save) return ''; const it = ITEMS[id]; if (!(it.type in S().eq)) return ''; const eq = gear(it.type);
  const key = it.type === 'weapon' ? 'dmg' : it.type === 'shield' ? 'block' : 'def';
  const a = gearStats(g || newGear(id))[key], b = eq ? gearStats(eq)[key] : it.type === 'weapon' ? FISTS.dmg : 0;
  if (eq && g === eq) return '';
  const d = key === 'block' ? Math.round((a - b) * 100) : a - b; if (!d) return ' <span class="dim">(same as equipped)</span>';
  return ` <span class="${d > 0 ? 'good' : 'bad'}">(${d > 0 ? '+' : ''}${d}${key === 'block' ? '%' : ''} vs equipped)</span>`;
}
const TYPE_NAME = { weapon: 'Weapon', shield: 'Shield', armor: 'Armor', potion: 'Potion', loot: 'Monster part', map: 'Map', gem: 'Gem', quest: 'Quest item' };
function slotHTML(s, key) {
  if (!s) return key ? `<span class="k">${key}</span>` : '';
  return `<img class="px" src="${iconURL(s.id)}" alt="">${s.n > 1 ? `<span class="n">${s.n}</span>` : s.up ? `<span class="n">+${s.up}</span>` : ''}${key ? `<span class="k">${key}</span>` : ''}`;
}
function humanPortrait(canvasEl, look, st) { const c = canvasEl.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvasEl.width, canvasEl.height); drawHuman(c, canvasEl.width / 2, canvasEl.height, look, Object.assign({ face: 1 }, st || {})); }
function upgradeMats(tier) { // monster parts usable for upgrades, cheapest first
  const want = { common: ['common'], uncommon: ['uncommon', 'rare'], rare: ['rare', 'epic'] }[tier];
  const out = []; inv().forEach((s, i) => { if (s && ITEMS[s.id].type === 'loot' && want.includes(ITEMS[s.id].rarity)) out.push(i); });
  return out.sort((a, b) => sellPrice(inv()[a].id) - sellPrice(inv()[b].id));
}
const matCount = (tier) => upgradeMats(tier).reduce((a, i) => a + inv()[i].n, 0);

const UI = {
  _inv: true, _hud: true, modal: null, screen: 'menu', settingsBack: 'menu', bagSel: -1, bagMove: false, dropArm: false, shopId: null, shopTab: 'buy', mapSel: null, hudT: 0, gemSel: null, clearArm: null,
  invDirty() { this._inv = true; this._hud = true; },
  hudDirty() { this._hud = true; },
  toast(text, cls = '') {
    if (!text) return; const box = $('#toasts'), el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), cls.includes('big') ? 3400 : 2800);
  },
  showScreen(name) {
    this.screen = name;
    for (const id of ['menu', 'saves', 'creator', 'settings', 'credits']) $('#' + id).hidden = id !== name;
    $('#hud').hidden = !(name === 'game' || (name === 'settings' && G.on));
    $('#touch').hidden = !(name === 'game' && Input.touchMode);
    if (name === 'saves') this.renderSaves();
    if (name === 'settings') this.syncSettings();
    if (name === 'creator') this.openCreator();
    if (name === 'menu') Music.set('title');
    const first = $('#' + name + ' button, #' + name + ' input'); if (first && name !== 'game') first.focus({ preventScroll: true });
  },
  openModal(id) {
    if (this.modal) this.closeModal(true);
    this.modal = id; $('#' + id).hidden = false; Input.clear(); this.hideTip();
    const b = $('#' + id + ' button'); if (b) b.focus({ preventScroll: true });
  },
  closeModal(silent) {
    if (!this.modal) return; $('#' + this.modal).hidden = true; const was = this.modal; this.modal = null; this.hideTip();
    if (was === 'bagModal') { this.bagSel = -1; this.bagMove = false; }
    if (was === 'noteModal' && this._noteDone) { const f = this._noteDone; this._noteDone = null; f(); }
    if (!silent) Sfx.play('click');
  },
  escape() {
    if (this.modal === 'deathModal') return;
    if (this.modal === 'noteModal') { this.closeModal(); return; }
    if (Story.active()) return;
    if (this.modal) { this.closeModal(); return; }
    this.openPause();
  },
  back() {
    if (this.screen === 'settings') { if (this.settingsBack === 'pause' && G.on) { this.showScreen('game'); this.openPause(); } else this.showScreen('menu'); }
    else if (this.screen === 'saves') this.showScreen('menu');
    else if (this.screen === 'creator') this.showScreen('saves');
  },
  // ----- HUD -----
  tick(dt) {
    this.hudT -= dt;
    if (this._hud || this.hudT <= 0) { this.hudT = 0.12; this._hud = false; this.renderHUD(); }
    if (this._inv) { this._inv = false; this.renderHotbar(); if (this.modal === 'bagModal') this.renderBag(); if (this.modal === 'shopModal') this.renderShop(); }
    renderSpecialsBar();
    const pr = $('#prompt');
    const it = !this.modal && !G.dead && !Story.active() ? findInteract() : null;
    if (it) { const t = (Input.touchMode ? 'USE: ' : '[E] ') + it.label; if (pr.dataset.t !== t) { pr.dataset.t = t; pr.innerHTML = Input.touchMode ? esc(t) : `<kbd>[E]</kbd> ${esc(it.label)}`; } pr.classList.toggle('locked', !!it.locked); pr.hidden = false; } else pr.hidden = true;
  },
  renderHUD() {
    if (!G.save) return; const P = S(), p = G.p, st = PS(), mx = st.maxHp;
    $('#hLvl').textContent = P.level; $('#hCls').textContent = CLASSES[G.save.cls].name.toUpperCase(); $('#hCoins').textContent = fmtNum(P.coins);
    $('#hHp').style.width = clamp((p.hp / mx) * 100, 0, 100) + '%'; $('#hHpT').textContent = `${Math.ceil(Math.max(0, p.hp))}/${mx}`;
    $('#hShield').style.width = p.shieldHp > 0 ? clamp((p.shieldHp / mx) * 100, 0, 100) + '%' : '0';
    $('#hSt').style.width = clamp((p.sta / p.maxSta) * 100, 0, 100) + '%';
    $('#hXp').style.width = (P.level >= MAX_LVL ? 100 : clamp((P.xp / xpNeed(P.level)) * 100, 0, 100)) + '%';
    const A = G.area, loc = A ? (A.kind === 'dungeon' ? A.def.name : A.kind === 'interior' ? 'Your House' : A.id === 'vale' && inTownPx(p.x, p.y) ? 'Emberfall' : REGIONS[A.id].name) : '';
    if ($('#hLoc').textContent !== loc) $('#hLoc').textContent = loc;
    $('#hClock').textContent = Clock.label();
    const nl = DF().nights, nn = G.save.world.nights, ended = !!ST().ending;
    const ntxt = ended ? '' : `NIGHT ${nn} / ${nl}`; if ($('#hNight').textContent !== ntxt) $('#hNight').textContent = ntxt; $('#hNight').classList.toggle('warn', nl - nn <= 5);
    const b = G.bossMon && !G.bossMon.dead ? G.bossMon : null;
    $('#bossbar').hidden = !b; if (b) { $('#hBoss').textContent = b.d.name.toUpperCase(); $('#hBossHp').style.width = clamp((b.hp / b.maxHp) * 100, 0, 100) + '%'; }
    $('#hKey').hidden = !(A && A.kind === 'dungeon' && G.run.key && A.doors.some((d) => d.kind === 'key' && !d.open));
    const bf = []; for (const k in p.buffs) if (p.buffs[k] > 0) bf.push(`<span class="b-${k}">${{ warcry: 'WAR CRY', eagle: 'EAGLE EYE', smoke: 'HIDDEN', shield: 'SHIELD' }[k] || k.toUpperCase()} ${Math.ceil(p.buffs[k])}</span>`);
    if (p.poisonT > 0) bf.push('<span class="b-poison">POISON</span>'); if (p.slowT > 0) bf.push('<span class="b-slow">FROZEN</span>');
    const bh = bf.join(''); if ($('#hBuffs').innerHTML !== bh) $('#hBuffs').innerHTML = bh;
    const qt = G.save.quests.active.slice(0, 3).map((q) => `<div class="${Quests.done(q) ? 'done' : ''}">${esc(Quests.goal(q))}</div>`).join('') + (ST().ending ? '' : `<div>${esc(this.storyGoal())}</div>`);
    if ($('#questTrack').innerHTML !== qt) $('#questTrack').innerHTML = qt;
  },
  storyGoal() {
    const s = ST(), act = s.act, b = G.save.stats.bosses;
    if (!s.flags.hasMap) return 'Find out where Finn went';
    if (act === 1) { const d = DUNGEONS.find((x) => x.act === 1 && !b[x.id]); return d ? `Follow Finn: ${d.name} (Lv ${d.lvl})` : 'Talk to Elder Tobin'; }
    if (act === 2) { const left = DUNGEONS.filter((x) => x.seal && !s.seals[x.seal]); return `Stop Finn breaking the seals: ${4 - left.length} / 4`; }
    return 'Go to Wraithmoor Tomb (Lv 25)';
  },
  renderHotbar() {
    const bar = $('#hotbar'); if (!G.save) return;
    if (bar.children.length !== HOTBAR) {
      bar.innerHTML = '';
      for (let i = 0; i < HOTBAR; i++) { const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.addEventListener('click', () => { AU.unlock(); b.blur(); if (!this.modal && !G.dead && !Story.active()) useSlot(i); }); this.bindTip(b, () => inv()[i]); bar.appendChild(b); }
    }
    for (let i = 0; i < HOTBAR; i++) { const b = bar.children[i], s = inv()[i]; b.innerHTML = slotHTML(s, i === 9 ? '0' : String(i + 1)); b.className = 'slot' + (s ? ' r-' + ITEMS[s.id].rarity : '') + (s && s.id === 'map' ? ' mapslot' : ''); b.setAttribute('aria-label', s ? ITEMS[s.id].name : 'Empty slot ' + (i + 1)); }
  },
  bindTip(el, getSlot) {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; const s = getSlot(); if (s) this.showTip(s, e.clientX, e.clientY); });
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !$('#tooltip').hidden) this.placeTip(e.clientX, e.clientY); });
    el.addEventListener('pointerleave', () => this.hideTip());
  },
  showTip(s, x, y) {
    const it = ITEMS[s.id], t = $('#tooltip'), g = isGear(s.id) ? s : null;
    t.innerHTML = `<div class="tn r-${it.rarity}">${esc(g ? gearLabel(g) : it.name)}</div><div class="dim">${TYPE_NAME[it.type]}${it.lvl ? ' · Level ' + it.lvl : ''}</div><div>${esc(itemStats(s.id, g))}${compareHTML(s.id, g)}</div>${g ? '<div>' + gemsHTML(g) + (g.gems.length ? ' ' + esc(g.gems.map((x) => GEM_FX[x][it.type === 'weapon' ? 'w' : 'a']).join(', ')) : '') + '</div>' : ''}<div class="dim">${esc(it.desc || '')}</div>`;
    t.hidden = false; this.placeTip(x, y);
  },
  placeTip(x, y) { const t = $('#tooltip'), r = t.getBoundingClientRect(); t.style.left = clamp(x + 14, 8, innerWidth - r.width - 8) + 'px'; t.style.top = clamp(y - r.height - 12, 8, innerHeight - r.height - 8) + 'px'; },
  hideTip() { $('#tooltip').hidden = true; },
  areaChanged() { this.invDirty(); this.hudDirty(); $('#bossbar').hidden = true; },
  // ----- bag -----
  openBag() { if (G.dead) return; this.bagSel = -1; this.bagMove = false; this.dropArm = false; this.openModal('bagModal'); this.renderBag(); Sfx.play('click'); },
  renderBag() {
    const P = S(), grid = $('#bagGrid'), st = PS();
    $('#bagCoins').textContent = fmtNum(P.coins) + ' COINS';
    if (grid.children.length !== INV_SIZE) {
      grid.innerHTML = '';
      for (let i = 0; i < INV_SIZE; i++) { const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.addEventListener('click', () => this.bagClick(i)); b.addEventListener('dblclick', () => { if (inv()[i]) { useSlot(i); this.renderBag(); } }); this.bindTip(b, () => inv()[i]); grid.appendChild(b); }
    }
    for (let i = 0; i < INV_SIZE; i++) { const b = grid.children[i], s = inv()[i]; b.innerHTML = slotHTML(s, i < HOTBAR ? (i === 9 ? '0' : String(i + 1)) : ''); b.className = 'slot' + (s ? ' r-' + ITEMS[s.id].rarity : '') + (i === this.bagSel ? ' sel' : ''); b.setAttribute('aria-label', s ? ITEMS[s.id].name : 'Empty'); }
    for (const el of $$('#bagModal .eq')) {
      const kind = el.dataset.eq, g = P.eq[kind]; el.querySelector('.slot').innerHTML = g ? slotHTML(Object.assign({ n: 1 }, g)) : ''; el.querySelector('.lab b').innerHTML = g ? esc(gearLabel(g)) + ' ' + gemsHTML(g) : kind === 'weapon' ? 'Fists' : 'None';
      if (!el._bound) { el._bound = true; el.addEventListener('click', () => { unequip(el.dataset.eq); this.renderBag(); }); this.bindTip(el, () => (S().eq[el.dataset.eq] ? Object.assign({ n: 1 }, S().eq[el.dataset.eq]) : null)); }
    }
    const pets = P.pets;
    $('#bagPet').innerHTML = pets.owned.length ? `PET <select id="petSel"><option value="">None</option>${pets.owned.map((k) => `<option value="${k}" ${pets.active === k ? 'selected' : ''}>${esc(PETS[k].name)} (Lv ${Pets.level(k)})</option>`).join('')}</select>` : '<span class="dim">No pets yet. Hollis sells them in Emberfall.</span>';
    const ps = $('#petSel'); if (ps) ps.addEventListener('change', () => { pets.active = ps.value || null; Pets.spawn(); Sfx.play('pet'); this.renderBag(); });
    $('#statList').innerHTML = [
      ['Class', CLASSES[G.save.cls].name], ['Level', P.level], ['XP', P.level >= MAX_LVL ? 'MAX' : `${Math.floor(P.xp)} / ${xpNeed(P.level)}`], ['Health', `${Math.ceil(G.p.hp)} / ${st.maxHp}`],
      ['Damage', Math.round(st.dmg)], ['Crit', Math.round(st.crit * 100) + '%'], ['Block', shieldDef() ? Math.round(st.block * 100) + '%' : 'no shield'], ['Defense', Math.round(st.def)],
      ['Speed', Math.round(st.speed)], ['Kills', fmtNum(G.save.stats.kills)], ['Notes', `${Story.noteCount()} / ${NOTE_IDS.length}`], ['Bosses', `${Object.keys(G.save.stats.bosses).length} / ${DUNGEONS.length}`],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const info = $('#itemInfo'), s = inv()[this.bagSel];
    if (!s) { info.innerHTML = `<div class="dim">${this.bagMove ? 'Pick a slot to move it to.' : 'Click an item to see it. Double-click to use or equip. Slots 1-0 are your inventory bar.'}</div>`; return; }
    const it = ITEMS[s.id], g = isGear(s.id) ? s : null, useLbl = it.type === 'potion' ? 'DRINK' : it.type === 'map' ? 'OPEN MAP' : g ? 'EQUIP' : null;
    info.innerHTML = `<div class="in r-${it.rarity}">${esc(g ? gearLabel(g) : it.name)}${s.n > 1 ? ' x' + s.n : ''}</div><div class="dim">${TYPE_NAME[it.type]}${it.lvl ? ' · needs level ' + it.lvl : ''}</div><div>${esc(itemStats(s.id, g))}${compareHTML(s.id, g)}</div>${g ? '<div>' + gemsHTML(g) + '</div>' : ''}<div class="dim">${esc(it.desc || '')}</div>
      <div class="acts">${useLbl ? `<button class="btn sm gold" type="button" data-a="use">${useLbl}</button>` : ''}<button class="btn sm" type="button" data-a="move">${this.bagMove ? 'CANCEL MOVE' : 'MOVE'}</button>${it.type !== 'map' && it.type !== 'quest' ? `<button class="btn sm red" type="button" data-a="drop">${this.dropArm ? 'CONFIRM DROP' : 'DROP'}</button>` : ''}</div>`;
    for (const b of $$('#itemInfo [data-a]')) b.addEventListener('click', () => {
      const a = b.dataset.a, i = this.bagSel;
      if (a === 'use') { useSlot(i); if (this.modal === 'bagModal') { if (!inv()[i]) this.bagSel = -1; this.renderBag(); } }
      else if (a === 'move') { this.bagMove = !this.bagMove; this.renderBag(); }
      else if (a === 'drop') { if (!this.dropArm) { this.dropArm = true; this.renderBag(); return; } const sl = inv()[i]; inv()[i] = null; UI.toast(`Dropped ${ITEMS[sl.id].name}`); this.bagSel = -1; this.dropArm = false; this.invDirty(); this.renderBag(); }
    });
  },
  bagClick(i) {
    Sfx.play('click'); this.dropArm = false;
    if (this.bagMove && this.bagSel >= 0) { const I = inv(); [I[this.bagSel], I[i]] = [I[i], I[this.bagSel]]; this.bagMove = false; this.bagSel = I[i] ? i : -1; this.invDirty(); this.renderBag(); return; }
    this.bagSel = this.bagSel === i || !inv()[i] ? -1 : i; this.renderBag();
  },
  // ----- shops -----
  openShop(id) { this.shopId = id; const sh = SHOPS[id]; this.shopTab = sh.pets ? 'pets' : 'buy'; this.gemSel = null; this.clearArm = null; this.openModal('shopModal'); this.renderShop(); },
  renderShop() {
    const sh = SHOPS[this.shopId], P = S();
    $('#shopTitle').textContent = sh.title; $('#shopGreet').textContent = sh.greet; $('#shopCoins').textContent = fmtNum(P.coins) + ' COINS';
    const tabs = sh.pets ? [['pets', 'PETS']] : sh.smith ? [['buy', 'BUY'], ['sell', 'SELL'], ['upgrade', 'UPGRADE'], ['gems', 'GEMS']] : [['buy', 'BUY'], ['sell', 'SELL']];
    $('#shopTabs').innerHTML = tabs.map(([k, l]) => `<button class="tab${this.shopTab === k ? ' on' : ''}" type="button" data-tab="${k}">${l}</button>`).join('') + (this.shopTab === 'sell' ? '<button id="sellLoot" class="btn sm gold" type="button">SELL ALL LOOT</button>' : '');
    for (const b of $$('#shopTabs [data-tab]')) b.addEventListener('click', () => { this.shopTab = b.dataset.tab; Sfx.play('click'); this.renderShop(); });
    const sl = $('#sellLoot'); if (sl) sl.addEventListener('click', () => this.sellAllLoot());
    const list = $('#shopList'); let html = '';
    const row = (icon, name, rar, desc, btns) => `<div class="shop-row"><span class="slot r-${rar}">${icon}</span><div style="min-width:0"><div class="sn r-${rar}">${name}</div><div class="sd">${desc}</div></div><div class="acts">${btns}</div></div>`;
    if (this.shopTab === 'buy') {
      for (const id of sh.items) {
        const it = ITEMS[id], lvOk = P.level >= it.lvl, can = P.coins >= it.price && lvOk;
        html += row(slotHTML({ id, n: 1 }), esc(it.name), it.rarity, esc(itemStats(id)) + compareHTML(id) + (lvOk ? '' : ` · <span class="req">needs level ${it.lvl}</span>`), `<button class="btn sm buy${can ? ' gold' : ''}" type="button" data-buy="${id}" ${can ? '' : 'disabled'}>BUY ${it.price}c</button>`);
      }
    } else if (this.shopTab === 'sell') {
      let any = false;
      inv().forEach((s, i) => {
        if (!s || s.id === 'map' || ITEMS[s.id].type === 'quest') return; any = true; const it = ITEMS[s.id], pr = sellPrice(s.id, s.up || 0);
        html += row(slotHTML(s), esc(isGear(s.id) ? gearLabel(s) : it.name) + (s.n > 1 ? ' x' + s.n : ''), it.rarity, `${pr} coins each`, `<button class="btn sm gold buy" type="button" data-sell="${i}">SELL ${pr}c</button>${s.n > 1 ? `<button class="btn sm" type="button" data-sellall="${i}">ALL ${pr * s.n}c</button>` : ''}`);
      });
      if (!any) html = '<div class="empty">Nothing to sell. Kill monsters and loot chests!</div>';
    } else if (this.shopTab === 'upgrade') {
      const items = this.gearList();
      if (!items.length) html = '<div class="empty">No gear to upgrade.</div>';
      for (const [where, g] of items) {
        const it = ITEMS[g.id];
        if ((g.up || 0) >= 10) { html += row(slotHTML(Object.assign({ n: 1 }, g)), esc(gearLabel(g)), it.rarity, 'Fully upgraded!', ''); continue; }
        const c = upgradeCost(g), have = matCount(c.tier), can = P.coins >= c.coins && have >= c.count;
        html += row(slotHTML(Object.assign({ n: 1 }, g)), esc(gearLabel(g)) + (where === 'eq' ? ' <span class="dim">(equipped)</span>' : ''), it.rarity,
          `To +${c.next}: ${c.coins} coins + ${c.count} ${c.tier} monster parts (you have ${have})${c.fail ? ` · <span class="req">${Math.round(c.fail * 100)}% chance to fail</span>` : ''}`,
          `<button class="btn sm ${can ? 'gold' : ''}" type="button" data-up="${where}:${where === 'eq' ? it.type : g._i}" ${can ? '' : 'disabled'}>UPGRADE</button>`);
      }
    } else if (this.shopTab === 'gems') {
      const gems = [...new Set(inv().filter((s) => s && ITEMS[s.id].type === 'gem').map((s) => s.id))];
      html += `<div class="note">Pick a gem, then a piece of gear to set it in (50 coins). ${gems.length ? '' : 'You have no gems. Find them in chests or buy them... wait, no, find them!'}</div><div class="tabs">${gems.map((id) => `<button class="tab${this.gemSel === id ? ' on' : ''}" type="button" data-gem="${id}"><img class="px" src="${iconURL(id)}" width="14" height="14" alt=""> ${esc(ITEMS[id].name)} x${invCount(id)}</button>`).join('')}</div>`;
      if (this.gemSel) html += `<div class="note">${esc(ITEMS[this.gemSel].name)}: weapon gets "${GEM_FX[this.gemSel].w}", armor or shield gets "${GEM_FX[this.gemSel].a}".</div>`;
      for (const [where, g] of this.gearList()) {
        const it = ITEMS[g.id], n = SOCKETS[it.rarity], free = g.gems.length < n, key = where + ':' + (where === 'eq' ? it.type : g._i);
        html += row(slotHTML(Object.assign({ n: 1 }, g)), esc(gearLabel(g)), it.rarity, `${gemsHTML(g)} ${g.gems.length}/${n} sockets ${g.gems.length ? '· ' + esc(g.gems.map((x) => GEM_FX[x][it.type === 'weapon' ? 'w' : 'a']).join(', ')) : ''}`,
          `<button class="btn sm ${this.gemSel && free && P.coins >= 50 ? 'gold' : ''}" type="button" data-sock="${key}" ${this.gemSel && free && P.coins >= 50 ? '' : 'disabled'}>SET GEM</button>${g.gems.length ? `<button class="btn sm red" type="button" data-clear="${key}">${this.clearArm === key ? 'REALLY? GEMS BREAK' : 'CLEAR'}</button>` : ''}`);
      }
    } else if (this.shopTab === 'pets') {
      for (const k in PETS) {
        const d = PETS[k], owned = P.pets.owned.includes(k), act = P.pets.active === k;
        html += row(`<canvas width="16" height="16" data-petico="${k}"></canvas>`, esc(d.name) + (owned ? ` <span class="dim">Lv ${Pets.level(k)}</span>` : ''), 'uncommon', esc(d.desc), owned ? `<button class="btn sm ${act ? '' : 'gold'}" type="button" data-petset="${k}">${act ? 'WITH YOU' : 'TAKE ALONG'}</button>` : `<button class="btn sm ${P.coins >= d.price ? 'gold' : ''}" type="button" data-petbuy="${k}" ${P.coins >= d.price ? '' : 'disabled'}>BUY ${d.price}c</button>`);
      }
    }
    list.innerHTML = html;
    for (const cv of $$('[data-petico]', list)) { const c = cv.getContext('2d'), k = cv.dataset.petico; c.imageSmoothingEnabled = false; if (k === 'slime') c.drawImage(monFrames('slime')[0], 0, 2, 16, 13); else if (k === 'wolf') c.drawImage(monFrames('wolf')[0], 0, 3, 16, 10); else if (k === 'raven') c.drawImage(PET_SPR.raven[0], 3, 4); else { px(c, 5, 6, 6, 6, '#ff7a2a'); px(c, 6, 3, 4, 4, '#ffd27a'); } }
    for (const b of $$('[data-buy]', list)) b.addEventListener('click', () => this.buy(b.dataset.buy));
    for (const b of $$('[data-sell]', list)) b.addEventListener('click', () => this.sell(+b.dataset.sell, 1));
    for (const b of $$('[data-sellall]', list)) b.addEventListener('click', () => this.sell(+b.dataset.sellall, 99));
    for (const b of $$('[data-up]', list)) b.addEventListener('click', () => this.upgrade(b.dataset.up));
    for (const b of $$('[data-gem]', list)) b.addEventListener('click', () => { this.gemSel = this.gemSel === b.dataset.gem ? null : b.dataset.gem; Sfx.play('click'); this.renderShop(); });
    for (const b of $$('[data-sock]', list)) b.addEventListener('click', () => this.socket(b.dataset.sock));
    for (const b of $$('[data-clear]', list)) b.addEventListener('click', () => { const k = b.dataset.clear; if (this.clearArm !== k) { this.clearArm = k; this.renderShop(); return; } this.clearArm = null; const g = this.gearAt(k); if (g) { g.gems = []; statsChanged(); Sfx.play('fail'); UI.toast('The gems shattered as Brom pried them out.', 'bad'); } this.renderShop(); });
    for (const b of $$('[data-petbuy]', list)) b.addEventListener('click', () => { const k = b.dataset.petbuy, d = PETS[k]; if (P.coins < d.price) return; P.coins -= d.price; P.pets.owned.push(k); P.pets.active = k; Pets.spawn(); Sfx.play('pet'); UI.toast(`${d.name} joins you!`, 'good'); this.renderShop(); saveGame(true); });
    for (const b of $$('[data-petset]', list)) b.addEventListener('click', () => { const k = b.dataset.petset; P.pets.active = P.pets.active === k ? null : k; Pets.spawn(); Sfx.play('pet'); this.renderShop(); });
  },
  gearList() { const out = []; for (const k of ['weapon', 'shield', 'armor']) if (gear(k)) out.push(['eq', gear(k)]); inv().forEach((s, i) => { if (s && isGear(s.id)) { s._i = i; out.push(['bag', s]); } }); return out; },
  gearAt(key) { const [where, k] = key.split(':'); return where === 'eq' ? gear(k) : inv()[+k]; },
  upgrade(key) {
    const g = this.gearAt(key); if (!g) return; const c = upgradeCost(g), P = S();
    if (P.coins < c.coins || matCount(c.tier) < c.count) { Sfx.play('error'); return; }
    P.coins -= c.coins; let need = c.count;
    for (const i of upgradeMats(c.tier)) { if (need <= 0) break; const s = inv()[i], k = Math.min(need, s.n); s.n -= k; need -= k; if (s.n <= 0) inv()[i] = null; }
    if (chance(c.fail)) { Sfx.play('fail'); UI.toast(`The metal cracked. Upgrade to +${c.next} failed.`, 'bad'); shake(3); }
    else { g.up = c.next; Sfx.play('hammer'); later(0.15, () => Sfx.play('level')); UI.toast(`${gearLabel(g)}! Upgrade worked.`, 'gold'); }
    statsChanged(); this.renderShop(); saveGame(true);
  },
  socket(key) {
    const g = this.gearAt(key), P = S(); if (!g || !this.gemSel || P.coins < 50 || invCount(this.gemSel) < 1) return;
    if (g.gems.length >= SOCKETS[ITEMS[g.id].rarity]) return;
    P.coins -= 50; g.gems.push(this.gemSel); invTake(this.gemSel, 1); if (invCount(this.gemSel) < 1) this.gemSel = null;
    Sfx.play('hammer'); UI.toast('Gem set!', 'good'); statsChanged(); this.renderShop(); saveGame(true);
  },
  buy(id) {
    const it = ITEMS[id], P = S();
    if (P.coins < it.price || P.level < it.lvl) { Sfx.play('error'); return; }
    if (invAdd(id, 1) > 0) { this.toast('Bag is full!', 'bad'); Sfx.play('error'); return; }
    P.coins -= it.price; Sfx.play('buy'); this.toast(`Bought ${it.name}`, 'good');
    const key = { weapon: 'dmg', shield: 'block', armor: 'def' }[it.type], cur = gear(it.type);
    if (key && (!cur || it[key] > gearStats(cur)[key])) { const i = inv().findIndex((s) => s && s.id === id && !s.up); if (i >= 0) equipFrom(i); }
    this.invDirty(); this.renderShop(); saveGame(true);
  },
  sell(i, n) {
    const s = inv()[i]; if (!s || s.id === 'map') return; const k = Math.min(n, s.n), pr = sellPrice(s.id, s.up || 0) * k;
    S().coins += pr; invTakeAt(i, k); Sfx.play('coin'); this.toast(`Sold for ${pr} coins`, 'gold'); this.renderShop(); saveGame(true);
  },
  sellAllLoot() {
    let total = 0; const I = inv();
    for (let i = 0; i < INV_SIZE; i++) { const s = I[i]; if (s && ITEMS[s.id].type === 'loot') { total += sellPrice(s.id) * s.n; I[i] = null; } }
    if (!total) { this.toast('No loot to sell'); return; }
    S().coins += total; Sfx.play('coin'); this.toast(`Sold all loot for ${fmtNum(total)} coins`, 'gold'); this.invDirty(); this.renderShop(); saveGame(true);
  },
  // ----- talking -----
  talk(n) {
    $('#dlgName').textContent = n.name; humanPortrait($('#dlgFace'), n.look);
    const acts = [], Q = G.save.quests, act = ST().act;
    let text = '';
    const lines = TALK[n.id] && !Array.isArray(TALK[n.id]) ? TALK[n.id][act] || TALK[n.id][1] : TALK[n.id] || n.talkLines || ['Nice day for monster hunting.'];
    // deliveries to this person
    if (Q.active.some((q) => q.type === 'deliver' && q.to === n.id)) { text = 'A parcel for me? Bless you, traveler.'; acts.push(['HAND OVER PARCEL', 'gold', () => { Quests.deliverTo(n.id); this.closeModal(); }]); }
    // quest giver
    const mine = Q.active.find((q) => q.giver === n.id);
    if (!text && mine) {
      if (Quests.done(mine)) { text = mine.type === 'rescue' ? `${mine.name} made it home! I can't thank you enough.` : 'You did it! Here, take this.'; acts.push(['TURN IN QUEST', 'gold', () => { Quests.turnIn(mine); this.closeModal(); }]); }
      else text = `Still working on it? ${Quests.goal(mine)}.`;
    } else if (!text && QUEST_GIVERS[n.id] && ST().flags.hasMap) {
      const q = Quests.offer(n.id); text = Quests.text(q);
      acts.push(['ACCEPT QUEST', 'gold', () => { Quests.accept(n.id); this.closeModal(); }]);
    }
    if (!text) { this.tipI = ((this.tipI ?? -1) + 1) % lines.length; text = lines[this.tipI]; }
    if (n.shop) acts.unshift([SHOPS[n.shop].pets ? 'PET SHOP' : 'SHOP', 'gold', () => this.openShop(n.shop)]);
    if (n.id === 'tobin') acts.push(['ASK AGAIN', '', () => this.talk(n)]);
    acts.push(['BYE', '', () => this.closeModal()]);
    $('#dlgText').textContent = text;
    const box = $('#dlgActs'); box.innerHTML = '';
    for (const [l, c, f] of acts) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm ' + c; b.textContent = l; b.addEventListener('click', f); box.appendChild(b); }
    this.openModal('dialogModal'); Sfx.voice('cackle', 1.5); n.face = G.p.x < n.x ? -1 : 1;
  },
  // ----- map -----
  openMap() { if (G.dead || Story.active()) return; this.mapSel = G.area.kind === 'dungeon' ? G.area.def.id : this.mapSel || 'mossy'; this.openModal('mapModal'); this.renderMap(); Sfx.play('click'); },
  renderMap() {
    const cv = $('#bigMap'), A = G.area, P = S(), inD = A.kind === 'dungeon';
    $('#mapTitle').textContent = inD ? 'MAP: ' + A.def.name.toUpperCase() : 'WORLD MAP';
    if (inD) drawDungeonMap(cv); else drawAtlas(cv);
    const sel = DUNGEON_BY_ID[this.mapSel] || DUNGEONS[0], ok = P.level >= sel.lvl && sel.act <= ST().act, regionOpen = sel.map === 'vale' || ST().act >= 2;
    const stars = '★'.repeat(Math.min(5, Math.ceil(sel.tier / 2))) + '☆'.repeat(5 - Math.min(5, Math.ceil(sel.tier / 2)));
    const monNames = [...new Set(sel.mons.map(([t]) => MON[t].name))].join(', ');
    const known = !sel.secret || ST().flags.mirrorOpen;
    $('#mapInfo').innerHTML = `<div class="t">${esc(known ? sel.name : '???')}</div><div>${esc(REGIONS[sel.map].name)} · needs level <b class="${P.level >= sel.lvl ? 'good' : 'bad'}">${sel.lvl}</b> (you are ${P.level}) · Loot: <span class="stars">${stars}</span></div><div class="dim">${known ? `Monsters: ${esc(monNames)}${sel.mini ? ` · Key holder: ${esc(MON[sel.mini].name)}` : ''} · Boss: ${esc(MON[sel.boss].name)}` : 'Something hides in the west of the Vale.'}${G.save.stats.bosses[sel.id] ? ' · <span class="good">CLEARED</span>' : ''}${sel.act > ST().act ? ' · <span class="bad">SEALED</span>' : ''}</div>
      <div class="acts">${inD ? `<span class="dim">You are inside ${esc(A.def.name)}. Use the EXIT portal, or flee.</span><button class="btn sm red" type="button" id="mFlee">FLEE TO EMBERFALL</button>` : `<button class="btn sm gold" type="button" id="mGo" ${ok && regionOpen && known ? '' : 'disabled'}>${ok ? 'TRAVEL &amp; ENTER' : 'LOCKED'}</button>`}</div>
      ${inD ? '' : `<div class="acts">${['vale', 'mirefen', 'frostpeak', 'sunscar', 'saltmarrow'].map((id) => { const open = id === 'vale' || (ST().act >= 2 && (ST().visited || {})[id]); return `<button class="btn sm" type="button" data-tr="${id}" ${open ? '' : 'disabled'}>${id === 'vale' ? 'EMBERFALL' : esc(REGIONS[id].name.toUpperCase())}</button>`; }).join('')}</div><div class="dim">Fast travel goes to lands you have already visited.</div>`}`;
    const go = $('#mGo'); if (go) go.addEventListener('click', () => { this.closeModal(true); tryEnter(sel); });
    for (const b of $$('[data-tr]')) b.addEventListener('click', () => { const id = b.dataset.tr, W = getWorld(id); this.closeModal(true); if (id === 'vale') { const v = getWorld('vale'); enterMap('vale', v.spawn.x, v.spawn.y); } else enterMap(id, W.spawn.x, W.spawn.y); Sfx.play('portal'); saveGame(true); });
    const fl = $('#mFlee'); if (fl) fl.addEventListener('click', () => { this.closeModal(true); leaveDungeon(true); this.toast('You fled back to Emberfall.'); });
    $('#dgList').innerHTML = DUNGEONS.filter((d) => !d.secret || ST().flags.mirrorOpen).map((d) => { const ok2 = P.level >= d.lvl && d.act <= ST().act, done = G.save.stats.bosses[d.id]; return `<button type="button" class="dg${ok2 ? '' : ' locked'}${done ? ' done' : ''}${d.id === this.mapSel ? ' sel' : ''}" data-dg="${d.id}"><span class="dn">${esc(d.name)}</span><span class="dl">LV ${d.lvl}</span><span class="ds">${done ? 'Cleared' : d.act > ST().act ? 'Sealed' : ok2 ? 'Open' : 'Locked'} · ${esc(REGIONS[d.map].name)}</span></button>`; }).join('');
    for (const b of $$('#dgList [data-dg]')) b.addEventListener('click', () => { this.mapSel = b.dataset.dg; Sfx.play('click'); this.renderMap(); });
  },
  mapClick(e) {
    if (G.area.kind === 'dungeon') return; const cv = $('#bigMap'), r = cv.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * cv.width, y = ((e.clientY - r.top) / r.height) * cv.height;
    let best = null, bd = 14; for (const d of DUNGEONS) { if (d.secret && !ST().flags.mirrorOpen) continue; const [mx, my] = atlasPos(d.map, d.at[0], d.at[1]); const dd = dist(x, y, mx, my); if (dd < bd) { bd = dd; best = d; } }
    if (best) { this.mapSel = best.id; Sfx.play('click'); this.renderMap(); }
  },
};
