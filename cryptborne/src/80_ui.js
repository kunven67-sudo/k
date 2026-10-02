
// ---------- UI (HTML overlays) ----------
function itemStats(id) {
  const it = ITEMS[id], P = [];
  if (it.type === 'weapon') { P.push(`DMG ${it.dmg}`, `${(1 / it.cd).toFixed(1)} hits/s`, it.wc === 'melee' ? `Reach ${it.range}` : it.wc === 'bow' ? 'Shoots arrows' : 'Exploding fireballs'); if (it.poison) P.push('Poison'); if (it.slow) P.push('Freezes'); if (it.lifesteal) P.push('Lifesteal'); }
  else if (it.type === 'shield') P.push(`Blocks ${Math.round(it.block * 100)}% of a hit`);
  else if (it.type === 'armor') P.push(`Defense ${it.def}`);
  else if (it.type === 'potion') P.push(it.heal >= 9999 ? 'Full heal + stamina' : `Heals ${it.heal} HP`);
  else if (it.type === 'loot') P.push(`Sells for ${sellPrice(id)} coins`);
  return P.join(' · ');
}
function compareHTML(id) {
  if (!G.save) return ''; const it = ITEMS[id], eq = S().eq[it.type]; if (!(it.type in S().eq) || eq === id) return '';
  const cur = eq ? ITEMS[eq] : it.type === 'weapon' ? FISTS : null;
  const key = it.type === 'weapon' ? 'dmg' : it.type === 'shield' ? 'block' : 'def';
  const a = it[key], b = cur ? cur[key] : 0; if (a == null) return '';
  const d = key === 'block' ? Math.round((a - b) * 100) : a - b; if (!d) return ' <span class="dim">(same as equipped)</span>';
  return ` <span class="${d > 0 ? 'good' : 'bad'}">(${d > 0 ? '+' : ''}${d}${key === 'block' ? '%' : ''} vs equipped)</span>`;
}
const TYPE_NAME = { weapon: 'Weapon', shield: 'Shield', armor: 'Armor', potion: 'Potion', loot: 'Loot', map: 'Map' };
function slotHTML(s, key) {
  if (!s) return key ? `<span class="k">${key}</span>` : '';
  return `<img class="px" src="${iconURL(s.id)}" alt="">${s.n > 1 ? `<span class="n">${s.n}</span>` : ''}${key ? `<span class="k">${key}</span>` : ''}`;
}
function humanPortrait(canvasEl, look, st) { const c = canvasEl.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvasEl.width, canvasEl.height); drawHuman(c, canvasEl.width / 2, canvasEl.height, look, Object.assign({ face: 1 }, st || {})); }

const UI = {
  _inv: true, _hud: true, modal: null, screen: 'menu', settingsBack: 'menu', bagSel: -1, bagMove: false, dropArm: false, shopId: null, shopTab: 'buy', mapSel: null, hudT: 0,
  invDirty() { this._inv = true; this._hud = true; },
  hudDirty() { this._hud = true; },
  toast(text, cls = '') {
    const box = $('#toasts'), el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.remove(), cls.includes('big') ? 3400 : 2600);
  },
  showScreen(name) {
    this.screen = name;
    for (const id of ['menu', 'saves', 'settings']) $('#' + id).hidden = id !== name;
    $('#hud').hidden = !(name === 'game' || (name === 'settings' && G.on));
    $('#touch').hidden = !(name === 'game' && Input.touchMode);
    if (name === 'saves') this.renderSaves();
    if (name === 'settings') this.syncSettings();
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
    if (!silent) Sfx.play('click');
  },
  escape() {
    if (this.modal === 'deathModal') return;
    if (this.modal) { this.closeModal(); return; }
    this.openPause();
  },
  back() { if (this.screen === 'settings') { if (this.settingsBack === 'pause' && G.on) { this.showScreen('game'); this.openPause(); } else this.showScreen('menu'); } else if (this.screen === 'saves') this.showScreen('menu'); },

  // ----- HUD -----
  tick(dt) {
    this.hudT -= dt;
    if (this._hud || this.hudT <= 0) { this.hudT = 0.1; this._hud = false; this.renderHUD(); }
    if (this._inv) { this._inv = false; this.renderHotbar(); if (this.modal === 'bagModal') this.renderBag(); if (this.modal === 'shopModal') this.renderShop(); }
    const pr = $('#prompt');
    const it = !this.modal && !G.dead ? findInteract() : null;
    if (it) { const t = (Input.touchMode ? 'USE: ' : '[E] ') + it.label; if (pr.dataset.t !== t) { pr.dataset.t = t; pr.innerHTML = Input.touchMode ? esc(t) : `<kbd>[E]</kbd> ${esc(it.label)}`; } pr.classList.toggle('locked', !!it.locked); pr.hidden = false; } else pr.hidden = true;
  },
  renderHUD() {
    if (!G.save) return; const P = S(), p = G.p, mx = maxHpFor(P.level);
    $('#hLvl').textContent = P.level; $('#hCoins').textContent = fmtNum(P.coins);
    $('#hHp').style.width = clamp((p.hp / mx) * 100, 0, 100) + '%'; $('#hHpT').textContent = `${Math.ceil(Math.max(0, p.hp))}/${mx}`;
    $('#hSt').style.width = clamp((p.sta / p.maxSta) * 100, 0, 100) + '%';
    $('#hXp').style.width = (P.level >= MAX_LVL ? 100 : clamp((P.xp / xpNeed(P.level)) * 100, 0, 100)) + '%';
    const loc = G.area ? (G.area.kind === 'dungeon' ? G.area.def.name : inTownPx(p.x, p.y) ? 'Emberfall' : 'Emberfall Vale') : '';
    if ($('#hLoc').textContent !== loc) $('#hLoc').textContent = loc;
    const b = G.bossMon && !G.bossMon.dead ? G.bossMon : null;
    $('#bossbar').hidden = !b; if (b) { $('#hBoss').textContent = b.d.name.toUpperCase(); $('#hBossHp').style.width = clamp((b.hp / b.maxHp) * 100, 0, 100) + '%'; }
  },
  renderHotbar() {
    const bar = $('#hotbar'); if (!G.save) return;
    if (bar.children.length !== HOTBAR) {
      bar.innerHTML = '';
      for (let i = 0; i < HOTBAR; i++) { const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.dataset.i = i; b.addEventListener('click', () => { Sfx.unlock(); b.blur(); if (!this.modal && !G.dead) useSlot(i); }); this.bindTip(b, () => inv()[i]); bar.appendChild(b); }
    }
    for (let i = 0; i < HOTBAR; i++) { const b = bar.children[i], s = inv()[i]; b.innerHTML = slotHTML(s, i === 9 ? '0' : String(i + 1)); b.className = 'slot' + (s ? ' r-' + ITEMS[s.id].rarity : '') + (s && s.id === 'map' ? ' mapslot' : ''); b.setAttribute('aria-label', s ? ITEMS[s.id].name : 'Empty slot ' + (i + 1)); }
  },
  bindTip(el, getSlot) {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; const s = getSlot(); if (s) this.showTip(s.id, e.clientX, e.clientY); });
    el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !$('#tooltip').hidden) this.placeTip(e.clientX, e.clientY); });
    el.addEventListener('pointerleave', () => this.hideTip());
  },
  showTip(id, x, y) {
    const it = ITEMS[id], t = $('#tooltip');
    t.innerHTML = `<div class="tn r-${it.rarity}">${esc(it.name)}</div><div class="dim">${TYPE_NAME[it.type]}${it.lvl ? ' · Level ' + it.lvl : ''}</div><div>${esc(itemStats(id))}${compareHTML(id)}</div><div class="dim">${esc(it.desc || '')}</div>`;
    t.hidden = false; this.placeTip(x, y);
  },
  placeTip(x, y) { const t = $('#tooltip'), r = t.getBoundingClientRect(); t.style.left = clamp(x + 14, 8, innerWidth - r.width - 8) + 'px'; t.style.top = clamp(y - r.height - 12, 8, innerHeight - r.height - 8) + 'px'; },
  hideTip() { $('#tooltip').hidden = true; },
  areaChanged() { this.invDirty(); this.hudDirty(); $('#bossbar').hidden = true; },

  // ----- bag -----
  openBag() { if (G.dead) return; this.bagSel = -1; this.bagMove = false; this.dropArm = false; this.openModal('bagModal'); this.renderBag(); Sfx.play('click'); },
  renderBag() {
    const P = S(), grid = $('#bagGrid');
    $('#bagCoins').textContent = fmtNum(P.coins) + ' COINS';
    if (grid.children.length !== INV_SIZE) {
      grid.innerHTML = '';
      for (let i = 0; i < INV_SIZE; i++) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'slot';
        b.addEventListener('click', () => this.bagClick(i)); b.addEventListener('dblclick', () => { if (inv()[i]) { useSlot(i); this.renderBag(); } });
        this.bindTip(b, () => inv()[i]); grid.appendChild(b);
      }
    }
    for (let i = 0; i < INV_SIZE; i++) { const b = grid.children[i], s = inv()[i]; b.innerHTML = slotHTML(s, i < HOTBAR ? (i === 9 ? '0' : String(i + 1)) : ''); b.className = 'slot' + (s ? ' r-' + ITEMS[s.id].rarity : '') + (i === this.bagSel ? ' sel' : ''); b.setAttribute('aria-label', s ? ITEMS[s.id].name : 'Empty'); }
    for (const el of $$('#bagModal .eq')) {
      const kind = el.dataset.eq, id = P.eq[kind]; el.querySelector('.slot').innerHTML = id ? slotHTML({ id, n: 1 }) : ''; el.querySelector('.lab b').textContent = id ? ITEMS[id].name : kind === 'weapon' ? 'Fists' : 'None';
      if (!el._bound) { el._bound = true; el.addEventListener('click', () => { unequip(el.dataset.eq); this.renderBag(); }); this.bindTip(el, () => (S().eq[el.dataset.eq] ? { id: S().eq[el.dataset.eq], n: 1 } : null)); }
    }
    const w = weaponDef(), sh = shieldDef();
    $('#statList').innerHTML = [
      ['Level', P.level], ['XP', P.level >= MAX_LVL ? 'MAX' : `${Math.floor(P.xp)} / ${xpNeed(P.level)}`], ['Health', `${Math.ceil(G.p.hp)} / ${maxHpFor(P.level)}`],
      ['Damage', Math.round(w.dmg * dmgMultFor(P.level))], ['Block', sh ? Math.round(sh.block * 100) + '%' : 'no shield'], ['Defense', defense()],
      ['Kills', fmtNum(G.save.stats.kills)], ['Bosses', `${Object.keys(G.save.stats.bosses).length} / ${DUNGEONS.length}`],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const info = $('#itemInfo'), s = inv()[this.bagSel];
    if (!s) { info.innerHTML = `<div class="dim">${this.bagMove ? 'Pick a slot to move it to.' : 'Click an item to see it. Double-click to use or equip. Slots 1-0 are your inventory bar.'}</div>`; return; }
    const it = ITEMS[s.id], useLbl = it.type === 'potion' ? 'DRINK' : it.type === 'map' ? 'OPEN MAP' : it.type === 'loot' ? null : 'EQUIP';
    info.innerHTML = `<div class="in r-${it.rarity}">${esc(it.name)}${s.n > 1 ? ' x' + s.n : ''}</div><div class="dim">${TYPE_NAME[it.type]}${it.lvl ? ' · needs level ' + it.lvl : ''}</div><div>${esc(itemStats(s.id))}${compareHTML(s.id)}</div><div class="dim">${esc(it.desc || '')}</div>
      <div class="acts">${useLbl ? `<button class="btn sm gold" type="button" data-a="use">${useLbl}</button>` : ''}<button class="btn sm" type="button" data-a="move">${this.bagMove ? 'CANCEL MOVE' : 'MOVE'}</button>${it.type !== 'map' ? `<button class="btn sm red" type="button" data-a="drop">${this.dropArm ? 'CONFIRM DROP' : 'DROP'}</button>` : ''}</div>`;
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
  openShop(id) { this.shopId = id; this.shopTab = 'buy'; this.openModal('shopModal'); this.renderShop(); },
  renderShop() {
    const sh = SHOPS[this.shopId], P = S();
    $('#shopTitle').textContent = sh.title; $('#shopGreet').textContent = sh.greet; $('#shopCoins').textContent = fmtNum(P.coins) + ' COINS';
    $('#tabBuy').classList.toggle('on', this.shopTab === 'buy'); $('#tabSell').classList.toggle('on', this.shopTab === 'sell');
    const list = $('#shopList'); let html = '';
    if (this.shopTab === 'buy') {
      for (const id of sh.items) {
        const it = ITEMS[id], lvOk = P.level >= it.lvl, owned = Object.values(P.eq).includes(id) || invCount(id) > 0;
        html += `<div class="shop-row"><span class="slot r-${it.rarity}">${slotHTML({ id, n: 1 })}</span><div style="min-width:0"><div class="sn r-${it.rarity}">${esc(it.name)}${owned && !STACKS(it) ? ' <span class="dim">(owned)</span>' : ''}</div><div class="sd">${esc(itemStats(id))}${compareHTML(id)}${lvOk ? '' : ` · <span class="req">needs level ${it.lvl}</span>`}</div></div><button class="btn sm buy${P.coins >= it.price && lvOk ? ' gold' : ''}" type="button" data-buy="${id}" ${P.coins >= it.price && lvOk ? '' : 'disabled'}>BUY ${it.price}c</button></div>`;
      }
    } else {
      const I = inv(); let any = false;
      I.forEach((s, i) => {
        if (!s || s.id === 'map') return; any = true; const it = ITEMS[s.id], pr = sellPrice(s.id);
        html += `<div class="shop-row"><span class="slot r-${it.rarity}">${slotHTML(s)}</span><div style="min-width:0"><div class="sn r-${it.rarity}">${esc(it.name)}${s.n > 1 ? ' x' + s.n : ''}</div><div class="sd">${pr} coins each</div></div><div class="acts"><button class="btn sm gold buy" type="button" data-sell="${i}">SELL ${pr}c</button>${s.n > 1 ? `<button class="btn sm" type="button" data-sellall="${i}">ALL ${pr * s.n}c</button>` : ''}</div></div>`;
      });
      if (!any) html = '<div class="empty">Nothing to sell. Kill monsters and loot chests in the dungeons!</div>';
    }
    list.innerHTML = html;
    for (const b of $$('[data-buy]', list)) b.addEventListener('click', () => this.buy(b.dataset.buy));
    for (const b of $$('[data-sell]', list)) b.addEventListener('click', () => this.sell(+b.dataset.sell, 1));
    for (const b of $$('[data-sellall]', list)) b.addEventListener('click', () => this.sell(+b.dataset.sellall, 99));
  },
  buy(id) {
    const it = ITEMS[id], P = S();
    if (P.coins < it.price || P.level < it.lvl) { Sfx.play('error'); return; }
    if (invAdd(id, 1) > 0) { this.toast('Bag is full!', 'bad'); Sfx.play('error'); return; }
    P.coins -= it.price; Sfx.play('buy'); this.toast(`Bought ${it.name}`, 'good');
    const key = { weapon: 'dmg', shield: 'block', armor: 'def' }[it.type], cur = P.eq[it.type] ? ITEMS[P.eq[it.type]] : null;
    if (key && (!cur || it[key] > cur[key])) { const i = inv().findIndex((s) => s && s.id === id); if (i >= 0) equipFrom(i); }
    this.invDirty(); this.renderShop(); saveGame(true);
  },
  sell(i, n) {
    const s = inv()[i]; if (!s || s.id === 'map') return; const k = Math.min(n, s.n), pr = sellPrice(s.id) * k;
    S().coins += pr; invTakeAt(i, k); Sfx.play('coin'); this.toast(`Sold for ${pr} coins`, 'gold'); this.renderShop(); saveGame(true);
  },
  sellAllLoot() {
    let total = 0; const I = inv();
    for (let i = 0; i < INV_SIZE; i++) { const s = I[i]; if (s && ITEMS[s.id].type === 'loot') { total += sellPrice(s.id) * s.n; I[i] = null; } }
    if (!total) { this.toast('No loot to sell'); return; }
    S().coins += total; Sfx.play('coin'); this.toast(`Sold all loot for ${fmtNum(total)} coins`, 'gold'); this.invDirty(); this.renderShop(); saveGame(true);
  },

  // ----- NPC talk -----
  talk(n) {
    $('#dlgName').textContent = n.name; humanPortrait($('#dlgFace'), n.look);
    const tips = ['Click to swing. Hold the mouse button to keep swinging.', 'Press C to roll. You cannot be hit while rolling.', 'Hold F with a shield to block. Block right before a hit lands to PARRY and stun the monster.', 'The tiny map at the top opens the World Map. Pick a dungeon and travel there.', 'Golden chests sit behind every boss. They open once the boss falls.', 'Monsters glow red and show ! right before they strike. That is your cue to dodge.', 'Mara buys everything monsters drop. Sell your loot and buy better gear from Brom.', 'Standing by the fountain heals you.', 'Wraiths drift through walls. Do not trust a corridor in Wraithmoor Tomb.'];
    const lines = { pip: 'I saw a Slime eat a whole boot once.', wren: 'The Goblin Warrens smell like old socks. Bring a nose plug.', oskar: 'They say the Lich carries a sword made from a dragon.', lena: 'Brom forged my dad\'s shield. It stopped a Skeleton Knight!' };
    let text, acts = [];
    if (n.shop) { text = SHOPS[n.shop].greet; acts.push(['SHOP', 'gold', () => this.openShop(n.shop)]); }
    else if (n.id === 'tobin') { this.tipI = ((this.tipI ?? -1) + 1) % tips.length; text = tips[this.tipI]; acts.push(['ANOTHER TIP', '', () => this.talk(n)]); }
    else text = lines[n.name.toLowerCase()] || 'Nice day for monster hunting.';
    acts.push(['BYE', '', () => this.closeModal()]);
    $('#dlgText').textContent = text;
    const box = $('#dlgActs'); box.innerHTML = '';
    for (const [l, c, f] of acts) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm ' + c; b.textContent = l; b.addEventListener('click', f); box.appendChild(b); }
    this.openModal('dialogModal'); Sfx.play('click');
  },

  // ----- map -----
  openMap() { if (G.dead) return; this.mapSel = G.area.kind === 'dungeon' ? G.area.def.id : this.mapSel || DUNGEONS[0].id; this.openModal('mapModal'); this.renderMap(); Sfx.play('click'); },
  renderMap() {
    const cv = $('#bigMap'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false; const A = G.area, P = S();
    c.fillStyle = '#07050a'; c.fillRect(0, 0, cv.width, cv.height);
    if (A.kind === 'dungeon') {
      $('#mapTitle').textContent = 'MAP: ' + A.def.name.toUpperCase(); const m = A.map, s = Math.min(cv.width / m.w, cv.height / m.h), ox = (cv.width - m.w * s) / 2, oy = (cv.height - m.h * s) / 2;
      for (let ty = 0; ty < m.h; ty++) for (let tx = 0; tx < m.w; tx++) { if (!m.explored[ty * m.w + tx]) continue; const t = m.t[ty * m.w + tx]; c.fillStyle = t === T.FLOOR ? '#5a5268' : t === T.LAVA ? '#d8452a' : '#221c2c'; c.fillRect(ox + tx * s, oy + ty * s, Math.ceil(s), Math.ceil(s)); }
      for (const ch of A.chests) if (!ch.open && m.explored[ch.ty * m.w + ch.tx]) { c.fillStyle = ch.kind === 'gold' ? '#ffe08a' : '#c8922a'; c.fillRect(ox + ch.tx * s - 1, oy + ch.ty * s - 1, s + 2, s + 2); }
      for (const pt of A.portals) { c.fillStyle = '#b878ea'; c.fillRect(ox + (pt.x / 16) * s - 3, oy + (pt.y / 16) * s - 3, 6, 6); }
      c.fillStyle = '#ffffff'; c.fillRect(ox + (G.p.x / 16) * s - 2, oy + (G.p.y / 16) * s - 2, 5, 5);
    } else {
      $('#mapTitle').textContent = 'WORLD MAP';
      c.drawImage(MINI_BASE, 0, 0, cv.width, cv.height); const s = cv.width / WORLD.map.w;
      tinyText(c, 'EMBERFALL', 48 * s, 30 * s, '#ffffff');
      for (const e of WORLD.entrances) {
        const d = e.d, ok = P.level >= d.lvl, x = e.tx * s, y = (e.ty - 1) * s, sel = this.mapSel === d.id;
        c.fillStyle = '#07050a'; c.fillRect(x - 6, y - 6, 12, 12); c.fillStyle = G.save.stats.bosses[d.id] ? '#9be04a' : ok ? '#f2c13a' : '#d8454a'; c.fillRect(x - 4, y - 4, 8, 8);
        if (sel) { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.strokeRect(x - 8, y - 8, 16, 16); }
        const lab = d.name + ' LV ' + d.lvl, hw = tinyCanvas(lab, '#fff').width / 2 + 2;
        tinyText(c, lab, clamp(x, hw, cv.width - hw), y - 9, G.save.stats.bosses[d.id] ? '#9be04a' : ok ? '#f2c13a' : '#ff6a6a');
      }
      if (Math.floor(performance.now() / 300) % 2) { c.fillStyle = '#ffffff'; c.fillRect((G.p.x / 16) * s - 3, (G.p.y / 16) * s - 3, 6, 6); }
    }
    const sel = DUNGEON_BY_ID[this.mapSel], ok = P.level >= sel.lvl, inD = A.kind === 'dungeon';
    const stars = '★'.repeat(sel.tier) + '☆'.repeat(6 - sel.tier);
    const monNames = [...new Set(sel.mons.map(([t]) => MON[t].name))].join(', ');
    $('#mapInfo').innerHTML = `<div class="t">${esc(sel.name)}</div><div>Required level: <b class="${ok ? 'good' : 'bad'}">${sel.lvl}</b> (you are ${P.level}) · Loot: <span class="stars">${stars}</span></div><div class="dim">Monsters: ${esc(monNames)} · Boss: ${esc(MON[sel.boss].name)}${G.save.stats.bosses[sel.id] ? ' · <span class="good">CLEARED</span>' : ''}</div>
      <div class="acts">${inD ? `<span class="dim">You are inside ${esc(A.def.name)}. Use the EXIT portal, or flee.</span><button class="btn sm red" type="button" id="mFlee">FLEE TO EMBERFALL</button>` : `<button class="btn sm gold" type="button" id="mGo" ${ok ? '' : 'disabled'}>${ok ? 'TRAVEL &amp; ENTER' : 'LOCKED: LEVEL ' + sel.lvl}</button><button class="btn sm" type="button" id="mTown">TRAVEL TO EMBERFALL</button>`}</div>`;
    const go = $('#mGo'); if (go) go.addEventListener('click', () => { this.closeModal(true); tryEnter(sel); });
    const tw = $('#mTown'); if (tw) tw.addEventListener('click', () => { this.closeModal(true); enterOverworld(WORLD.spawn.x, WORLD.spawn.y); Sfx.play('portal'); });
    const fl = $('#mFlee'); if (fl) fl.addEventListener('click', () => { this.closeModal(true); leaveDungeon(true); this.toast('You fled back to Emberfall.'); });
    $('#dgList').innerHTML = DUNGEONS.map((d) => { const ok2 = P.level >= d.lvl, done = G.save.stats.bosses[d.id]; return `<button type="button" class="dg${ok2 ? '' : ' locked'}${done ? ' done' : ''}${d.id === this.mapSel ? ' sel' : ''}" data-dg="${d.id}"><span class="dn">${esc(d.name)}</span><span class="dl">LV ${d.lvl}</span><span class="ds">${done ? 'Cleared' : ok2 ? 'Open' : 'Locked'} · ${esc(MON[d.boss].name)}</span></button>`; }).join('');
    for (const b of $$('#dgList [data-dg]')) b.addEventListener('click', () => { this.mapSel = b.dataset.dg; Sfx.play('click'); this.renderMap(); });
  },
  mapClick(e) {
    if (G.area.kind !== 'overworld') return; const cv = $('#bigMap'), r = cv.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * cv.width, y = ((e.clientY - r.top) / r.height) * cv.height, s = cv.width / WORLD.map.w;
    let best = null, bd = 22; for (const en of WORLD.entrances) { const d = dist(x, y, en.tx * s, (en.ty - 1) * s); if (d < bd) { bd = d; best = en.d; } }
    if (best) { this.mapSel = best.id; Sfx.play('click'); this.renderMap(); }
  },

  // ----- pause / death -----
  openPause() {
    if (!G.on || G.dead) return; const P = S();
    $('#pauseInfo').textContent = `${G.save.name} · Level ${P.level} · ${fmtNum(P.coins)} coins · played ${Math.floor(G.save.stats.playTime / 60)} min`;
    this.openModal('pauseModal');
  },
  showDeath(lost) { $('#deathInfo').textContent = `The ${G.area.kind === 'dungeon' ? G.area.def.name + ' run is over' : 'wilds got you'}. You dropped ${fmtNum(lost)} coins.`; this.openModal('deathModal'); },

  // ----- menu: saves & settings -----
  renderSaves() {
    $('#storeNote').textContent = Store.mode === 'cloud' ? 'Your saves are kept in your Claude account, so they follow you to other devices.' : 'Your saves are kept in this browser.';
    const list = Store.list(), box = $('#saveList');
    if (!list.length) { box.innerHTML = '<div class="empty">No saves yet. Name your hero below and press NEW SAVE.</div>'; return; }
    box.innerHTML = '';
    for (const s of list) {
      const card = document.createElement('div'); card.className = 'save-card';
      const cv = document.createElement('canvas'); cv.width = 16; cv.height = 20;
      const arm = s.player.eq && s.player.eq.armor && ITEMS[s.player.eq.armor];
      humanPortrait(cv, HERO_LOOK, { armor: arm && arm.color, trim: arm && arm.trim });
      const bosses = Object.keys((s.stats && s.stats.bosses) || {}).length;
      card.innerHTML = `<div class="who"><div class="nm"></div><div class="meta">Level <b>${s.player.level | 0}</b> · <b>${fmtNum(s.player.coins || 0)}</b> coins · <b>${bosses}</b>/6 bosses</div><div class="meta">Created: <b>${esc(fmtDate(s.created))}</b></div><div class="meta">Last loaded: <b>${esc(fmtDate(s.lastLoaded))}</b> · Last saved: <b>${esc(fmtDate(s.lastSaved))}</b></div></div><div class="acts"></div>`;
      card.prepend(cv); card.querySelector('.nm').textContent = s.name;
      const acts = card.querySelector('.acts');
      const mk = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm ' + cls; b.textContent = label; b.addEventListener('click', fn); acts.appendChild(b); return b; };
      const normal = () => { acts.innerHTML = ''; mk('PLAY', 'gold', () => startGame(Store.get(s.id))); mk('DELETE', 'red', () => { acts.innerHTML = ''; const q = document.createElement('span'); q.className = 'meta'; q.textContent = 'Delete forever?'; acts.appendChild(q); mk('YES, DELETE', 'red', () => { Store.del(s.id); this.renderSaves(); }); mk('NO', '', normal); }); };
      normal(); box.appendChild(card);
    }
  },
  syncSettings() { $('#setVol').value = SET.vol; $('#setVolOut').textContent = SET.vol; $('#setZoom').value = String(SET.zoom); $('#setShake').checked = SET.shake; $('#setDmg').checked = SET.dmg; $('#setNames').checked = SET.names; },
  init() {
    $('#btnPlay').addEventListener('click', () => { Sfx.unlock(); Sfx.play('click'); this.showScreen('saves'); });
    $('#btnSettings').addEventListener('click', () => { Sfx.unlock(); Sfx.play('click'); this.settingsBack = 'menu'; this.showScreen('settings'); });
    for (const b of $$('[data-back]')) b.addEventListener('click', () => { Sfx.play('click'); this.back(); });
    for (const b of $$('[data-close]')) b.addEventListener('click', () => this.closeModal());
    for (const m of $$('.modal')) m.addEventListener('pointerdown', (e) => { if (e.target === m && m.id !== 'deathModal') this.closeModal(); });
    $('#newSaveForm').addEventListener('submit', (e) => {
      e.preventDefault(); Sfx.unlock();
      if (Store.list().length >= 8) { this.toast('You can keep 8 saves. Delete one first.', 'bad'); return; }
      const name = ($('#newName').value || '').trim().replace(/\s+/g, ' ').slice(0, 16) || 'Hero';
      const s = newSaveData(name); Store.put(s); $('#newName').value = ''; startGame(s);
    });
    $('#setVol').addEventListener('input', (e) => { SET.vol = +e.target.value; $('#setVolOut').textContent = SET.vol; Sfx.setVol(); saveSettings(); });
    $('#setVol').addEventListener('change', () => { Sfx.unlock(); Sfx.play('coin'); });
    $('#setZoom').addEventListener('change', (e) => { SET.zoom = +e.target.value; saveSettings(); resize(); snapCam(); });
    $('#setShake').addEventListener('change', (e) => { SET.shake = e.target.checked; saveSettings(); });
    $('#setDmg').addEventListener('change', (e) => { SET.dmg = e.target.checked; saveSettings(); });
    $('#setNames').addEventListener('change', (e) => { SET.names = e.target.checked; saveSettings(); });
    $('#minimap').addEventListener('click', () => { Sfx.unlock(); if (!this.modal) this.openMap(); });
    $('#bagBtn').addEventListener('click', () => { Sfx.unlock(); if (!this.modal) this.openBag(); });
    $('#pauseBtn').addEventListener('click', () => { if (!this.modal) this.openPause(); });
    $('#bigMap').addEventListener('click', (e) => this.mapClick(e));
    $('#tabBuy').addEventListener('click', () => { this.shopTab = 'buy'; Sfx.play('click'); this.renderShop(); });
    $('#tabSell').addEventListener('click', () => { this.shopTab = 'sell'; Sfx.play('click'); this.renderShop(); });
    $('#sellLoot').addEventListener('click', () => this.sellAllLoot());
    $('#pResume').addEventListener('click', () => this.closeModal());
    $('#pSave').addEventListener('click', () => saveGame());
    $('#pSettings').addEventListener('click', () => { this.closeModal(true); this.settingsBack = 'pause'; this.showScreen('settings'); });
    $('#pQuit').addEventListener('click', () => quitToMenu());
    $('#btnRespawn').addEventListener('click', () => { this.closeModal(true); respawn(); });
    $('#hCoinIco').src = COIN_SPR.toDataURL();
    Store.onChange = () => { if (this.screen === 'saves') this.renderSaves(); };
  },
};
