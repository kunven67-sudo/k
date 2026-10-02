// =====================================================================
// UI — toasts, dialog (typed text with blips), menus and screens: title,
// saves, character creator, pause (inventory, map, journal, skills,
// hunter, settings), shops, contract board, camps, death, endings.
// =====================================================================
const UI = {
  dlg: null, chooser: null, screenName: null, modalOpen: false, tabs: null, tab: null,
  blocking() { return !!(this.dlg || this.chooser || this.modalOpen || this.screenName || G.cine || G.fading); },
  // ---------- small things ----------
  toast(msg, cls = '') {
    if (!msg) return; const box = $('#toasts'), t = document.createElement('div'); t.className = 'toast ' + cls; t.textContent = msg; box.appendChild(t);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    const life = cls.includes('big') ? 4200 : cls.includes('small') ? 1600 : 3200; setTimeout(() => t.classList.add('out'), life); setTimeout(() => t.remove(), life + 600);
  },
  flash(col, k) { Hud.flashCol = col; Hud.flashK = k; },
  hurt(k) { Hud.hurtK = Math.min(1, (Hud.hurtK || 0) + 0.35 + k * 0.6); },
  hitMark(kind) { const h = $('#hitMark'); h.className = 'on' + (kind === 'crit' ? ' crit' : ''); clearTimeout(this.hmT); this.hmT = setTimeout(() => (h.className = kind === 'crit' ? 'crit' : ''), 90); },
  saveIcon() { const s = $('#saveIcon'); s.hidden = false; clearTimeout(this.svT); this.svT = setTimeout(() => (s.hidden = true), 1400); },
  fade(fn, hold = 0.5) { const f = $('#fade'); G.fading = true; f.style.opacity = 1; setTimeout(() => { try { fn(); } catch (e) { console.error(e); } setTimeout(() => { f.style.opacity = 0; G.fading = false; }, hold * 1000); }, 470); },
  lock() { if (TOUCH.on || !G.on || this.blocking()) return; const c = $('#gl'); try { const r = c.requestPointerLock && c.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} },
  unlock() { if (document.pointerLockElement) try { document.exitPointerLock(); } catch (e) {} },
  // ---------- dialog ----------
  dialog(lines, done, o = {}) {
    this.dlg = { lines: lines.slice(), i: -1, done, o }; $('#dialog').hidden = false; $('#dChoices').innerHTML = ''; $('#letterbox').hidden = false; this.dlgNext();
  },
  dlgNext() {
    const D = this.dlg; D.i++; if (D.i >= D.lines.length) return this.dlgEnd();
    const [who, text] = D.lines[D.i], P = PEOPLE[who];
    const name = who === 'you' ? G.save.player.name : who === 'narrator' ? '' : who === 'folk' ? D.o.name || 'Townsfolk' : who === 'azgoreth' ? 'AZGORETH' : P ? P.name : who;
    $('#dName').textContent = name; $('#dName').style.color = SPEAKER_COL[who] || '#d8c8a8';
    $('#dText').style.fontStyle = who === 'narrator' ? 'italic' : 'normal'; $('#dText').style.color = who === 'narrator' ? '#c8bca8' : '#efe6d6';
    D.text = text; D.shown = 0; D.t = 0; D.pitch = who === 'you' ? 1 : who === 'narrator' ? 0.62 : who === 'azgoreth' ? 0.42 : P ? P.blip : D.o.pitch || 0.92; $('#dText').textContent = ''; $('#dMore').hidden = true;
  },
  dlgTick(dt) {
    const D = this.dlg; if (!D || D.shown >= D.text.length) return;
    D.t += dt * (D.o.quick ? 75 : 46); const n = Math.min(D.text.length, Math.floor(D.t));
    for (let k = D.shown; k < n; k++) if (k % 2 === 0 && /\w/.test(D.text[k])) { Sfx.blip(D.pitch * (0.94 + Math.random() * 0.12)); break; }
    D.shown = n; $('#dText').textContent = D.text.slice(0, n); if (n >= D.text.length) $('#dMore').hidden = false;
  },
  dlgAdvance() { const D = this.dlg; if (!D) return; if (D.shown < D.text.length) { D.shown = D.text.length; D.t = D.shown; $('#dText').textContent = D.text; $('#dMore').hidden = false; } else { Sfx.play('click'); this.dlgNext(); } },
  dlgEnd() { const D = this.dlg; this.dlg = null; $('#dialog').hidden = true; $('#letterbox').hidden = true; if (D && D.done) D.done(); if (!this.blocking()) this.lock(); },
  choice(prompt, opts) {
    this.chooser = opts; this.unlock(); $('#dialog').hidden = false; $('#letterbox').hidden = false; $('#dName').textContent = ''; $('#dText').textContent = prompt; $('#dMore').hidden = true;
    const box = $('#dChoices'); box.innerHTML = ''; opts.forEach((o, i) => { const b = document.createElement('button'); b.textContent = i + 1 + '. ' + o.label; b.onclick = () => this.pickChoice(i); box.appendChild(b); });
  },
  pickChoice(i) { const o = this.chooser && this.chooser[i]; if (!o) return; this.chooser = null; $('#dialog').hidden = true; $('#dChoices').innerHTML = ''; $('#letterbox').hidden = true; Sfx.play('click'); o.fn(); if (!this.blocking()) this.lock(); },
  // ---------- full screens ----------
  screen(name, html, dim) { this.screenName = name; const s = $('#screen'); s.hidden = false; s.className = dim ? 'dim' : ''; s.innerHTML = html; this.unlock(); return s; },
  closeScreen() { this.screenName = null; $('#screen').hidden = true; $('#screen').innerHTML = ''; },
  // ---------- modals with tabs ----------
  modal(title, tabs, tab) {
    this.modalOpen = true; this.unlock(); this.tabs = tabs; $('#modal').hidden = false; $('#mTitle').textContent = title;
    const T = $('#mTabs'); T.innerHTML = ''; T.hidden = tabs.length < 2;
    tabs.forEach(([id, label]) => { const b = document.createElement('button'); b.textContent = label; b.dataset.id = id; b.onclick = () => { Sfx.play('click'); this.showTab(id); }; T.appendChild(b); });
    this.showTab(tab && tabs.some((t) => t[0] === tab) ? tab : tabs[0][0]);
  },
  showTab(id) { this.tab = id; $$('#mTabs button').forEach((b) => b.classList.toggle('on', b.dataset.id === id)); const t = this.tabs.find((t) => t[0] === id); const body = $('#mBody'); body.innerHTML = ''; body.scrollTop = 0; t[2](body); },
  refresh() { if (this.modalOpen && this.tab) { const st = $('#mBody').scrollTop; this.showTab(this.tab); $('#mBody').scrollTop = st; } },
  closeModal() { if (!this.modalOpen) return; this.modalOpen = false; $('#modal').hidden = true; $('#mBody').innerHTML = ''; Sfx.play('click'); if (this.onClose) { const f = this.onClose; this.onClose = null; f(); } this.lock(); },
  escape() {
    if (this.chooser) return; if (this.dlg) return this.dlgAdvance();
    if (this.modalOpen) return this.closeModal();
    if (this.screenName === 'settings' || this.screenName === 'saves' || this.screenName === 'creator' || this.screenName === 'credits') return this.title();
    if (G.on && !this.screenName && !G.cine) return this.pause();
  },
  // ---------- title ----------
  title() {
    G.on = false; Music.set('title'); this.closeModal(); $('#hud').hidden = true; $('#touch').hidden = true; CREATOR.on = false;
    const saves = Store.list(), last = saves[0];
    this.screen('title', `<div style="text-align:center"><div class="title">BLOOD MOON<br>HUNTER<small>A TALE OF GREYWATER VALE</small></div>
      <div class="menuCol">${last ? `<button class="btn" id="tCont">Continue <span class="muted">— ${esc(last.name)}, Day ${last.world.day}</span></button>` : ''}
      <button class="btn" id="tNew">New Hunt</button>${saves.length ? '<button class="btn" id="tLoad">Load Hunt</button>' : ''}<button class="btn" id="tSet">Settings</button><button class="btn" id="tCred">Credits</button></div>
      <p class="muted" style="margin-top:26px">${Store.mode === 'cloud' ? 'Saves are kept in your Claude account and this browser.' : 'Saves are kept in this browser.'}<br>Best with a mouse and keyboard. Headphones recommended.</p></div>`);
    if (last) $('#tCont').onclick = () => loadGame(last.id);
    $('#tNew').onclick = () => this.creator(); if ($('#tLoad')) $('#tLoad').onclick = () => this.savesScreen(); $('#tSet').onclick = () => this.settingsScreen(); $('#tCred').onclick = () => this.credits(() => this.title(), true);
    Store.onChange = () => { if (this.screenName === 'title') this.title(); if (this.screenName === 'saves') this.savesScreen(); };
  },
  saveRowHTML(s) {
    const P = s.player, where = s.player.area && s.player.area !== 'outside' ? Interiors.defs[s.player.area] ? Interiors.defs[s.player.area].name : '' : placeName(P.pos.x, P.pos.z), hc = s.diff === 'hardcore';
    const h = Math.floor((s.playTime || 0) / 3600), m = Math.floor(((s.playTime || 0) % 3600) / 60);
    return `<div class="saveRow"><div><div class="nm">${esc(s.name)} ${hc ? '<span style="color:#ff5050;font-size:12px">HARDCORE</span>' : `<span class="muted">${DIFF[s.diff] ? DIFF[s.diff].name : ''}</span>`}</div>
      <div class="meta">Level ${P.level} · Day ${s.world.day} · ${esc(where)} · ${h}h ${m}m played<br>${esc(MAIN[MAIN_IDX[s.story.step]] ? MAIN[MAIN_IDX[s.story.step]].title : '')}${s.story.endings && s.story.endings.length ? ' · Endings: ' + s.story.endings.length + '/3' : ''}<br>Created ${fmtDate(s.created)} · Last loaded ${fmtDate(s.lastLoaded)}${s.lastSaved ? ' · Saved ' + fmtDate(s.lastSaved) : ''}</div></div>
      <div style="display:flex;gap:6px;flex-shrink:0"><button class="btn small" data-load="${s.id}">Load</button><button class="btn small red" data-del="${s.id}">Delete</button></div></div>`;
  },
  savesScreen(inGame) {
    const saves = Store.list();
    const s = this.screen('saves', `<div class="wrap"><h2>LOAD A HUNT</h2>${saves.map((x) => this.saveRowHTML(x)).join('') || '<p class="muted">No saves yet.</p>'}<div style="margin-top:12px"><button class="btn small" id="sBack">Back</button></div></div>`, true);
    $$('[data-load]', s).forEach((b) => (b.onclick = () => loadGame(b.dataset.load)));
    $$('[data-del]', s).forEach((b) => (b.onclick = () => { if (b.dataset.confirm) { Store.del(b.dataset.del); if (G.save && G.save.id === b.dataset.del) G.save.deleted = true; this.savesScreen(inGame); } else { b.dataset.confirm = 1; b.textContent = 'Really?'; } }));
    $('#sBack').onclick = () => (inGame ? (this.closeScreen(), this.pause('system')) : this.title());
  },
  settingsHTML() {
    const sl = (k, label, min, max) => `<div class="opt"><label>${label}</label><input type="range" min="${min}" max="${max}" value="${SET[k]}" data-set="${k}"><span class="muted" data-val="${k}">${SET[k]}</span></div>`;
    const ch = (k, label, opts) => `<div class="opt"><label>${label}</label>${opts.map(([v, t]) => `<button class="chip ${SET[k] === v ? 'on' : ''}" data-chip="${k}" data-v="${v}">${t}</button>`).join('')}</div>`;
    return sl('sfx', 'Sound', 0, 100) + sl('music', 'Music', 0, 100) + sl('sens', 'Mouse speed', 5, 100) + sl('fov', 'Field of view', 60, 100) +
      ch('quality', 'Graphics', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']]) + ch('gore', 'Gore', [[true, 'On'], [false, 'Off']]) + ch('shake', 'Camera shake', [[true, 'On'], [false, 'Off']]) + ch('invertY', 'Invert mouse', [[false, 'Off'], [true, 'On']]) +
      `<p class="muted">Graphics changes to shadows and grass apply the next time the page loads.</p>`;
  },
  wireSettings(el) {
    $$('[data-set]', el).forEach((r) => (r.oninput = () => { const k = r.dataset.set; SET[k] = +r.value; $(`[data-val="${k}"]`, el).textContent = r.value; saveSettings(); AU.vols(); if (k === 'fov' && camera) camera.fov = SET.fov; }));
    $$('[data-chip]', el).forEach((b) => (b.onclick = () => { const k = b.dataset.chip, v = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v; SET[k] = v; saveSettings(); Sfx.play('click'); if (k === 'quality') renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, v === 'high' ? 1.5 : 1)); $$(`[data-chip="${k}"]`, el).forEach((x) => x.classList.toggle('on', x === b)); }));
  },
  settingsScreen() { const s = this.screen('settings', `<div class="wrap"><h2>SETTINGS</h2>${this.settingsHTML()}<div style="margin-top:12px"><button class="btn small" id="sBack">Back</button></div></div>`, true); this.wireSettings(s); $('#sBack').onclick = () => this.title(); },
  // ---------- character creator ----------
  creator() {
    const C = (this.cr = { name: 'Hunter', diff: 'normal', look: Object.assign({}, LOOK_PRESETS.rookie) }); delete C.look.name;
    CREATOR.show(C.look); Music.set('title');
    const O = LOOK_OPTS, chips = (k, names) => `<div class="opt"><label>${k[0].toUpperCase() + k.slice(1).replace('Col', ' colour')}</label>${names.map((n, i) => `<button class="chip" data-k="${k}" data-i="${i}">${n}</button>`).join('')}</div>`;
    const sw = (k, cols, label) => `<div class="opt"><label>${label}</label>${cols.map((c, i) => `<span class="sw" style="background:${c}" data-k="${k}" data-i="${i}"></span>`).join('')}</div>`;
    const s = this.screen('creator', `<div class="creator"><h2 style="margin:0 0 8px;color:var(--gold);font-weight:normal;letter-spacing:.12em">YOUR HUNTER</h2>
      <div class="opt"><label>Name</label><input type="text" id="cName" maxlength="18" value="Hunter"></div>
      <div class="opt"><label>Presets</label>${Object.keys(LOOK_PRESETS).map((k) => `<button class="chip" data-preset="${k}">${LOOK_PRESETS[k].name}</button>`).join('')}</div>
      ${chips('body', O.body)}${sw('skin', O.skin, 'Skin')}${chips('face', O.face)}${chips('hair', O.hair)}${sw('hairCol', O.hairCol, 'Hair colour')}${chips('beard', O.beard)}${chips('scar', O.scar)}${sw('eyes', O.eyes, 'Eyes')}${sw('coat', O.coat, 'Coat')}${sw('shirt', O.shirt, 'Shirt')}
      <div class="sect">Difficulty</div><div class="opt">${Object.keys(DIFF).map((k) => `<button class="chip" data-diff="${k}">${DIFF[k].name}</button>`).join('')}</div><p class="muted" id="cDiff"></p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn small" id="cRand">Randomize</button><button class="btn small" id="cBack">Back</button><button class="btn" id="cGo" style="min-width:0">Begin the hunt</button></div>
      <p class="muted">Drag the hunter to turn them around.</p></div>`);
    const sync = () => { $$('[data-k]', s).forEach((b) => b.classList.toggle('on', C.look[b.dataset.k] === +b.dataset.i)); $$('[data-diff]', s).forEach((b) => b.classList.toggle('on', b.dataset.diff === C.diff)); $('#cDiff').textContent = DIFF[C.diff].desc; CREATOR.show(C.look); };
    $$('[data-k]', s).forEach((b) => (b.onclick = () => { C.look[b.dataset.k] = +b.dataset.i; Sfx.play('click'); sync(); }));
    $$('[data-preset]', s).forEach((b) => (b.onclick = () => { C.look = Object.assign({}, LOOK_PRESETS[b.dataset.preset]); delete C.look.name; Sfx.play('click'); sync(); }));
    $$('[data-diff]', s).forEach((b) => (b.onclick = () => { C.diff = b.dataset.diff; Sfx.play('click'); sync(); }));
    $('#cRand').onclick = () => { for (const k in O) C.look[k] = randi(0, O[k].length - 1); Sfx.play('click'); sync(); };
    $('#cBack').onclick = () => { CREATOR.on = false; this.title(); };
    $('#cGo').onclick = () => { const name = ($('#cName').value || 'Hunter').trim().slice(0, 18) || 'Hunter'; CREATOR.on = false; const save = newSave(name, C.look, C.diff); Store.put(save); startGame(save, true); };
    sync();
  },
  // ---------- pause menu ----------
  pause(tab) {
    if (!G.on || !G.save) return; Sfx.play('page');
    this.modal('PAUSED — ' + G.save.player.name.toUpperCase(), [['inv', 'Inventory', (el) => this.invTab(el)], ['map', 'Map', (el) => this.mapTab(el)], ['journal', 'Journal', (el) => this.journalTab(el)], ['skills', 'Skills', (el) => this.skillsTab(el)], ['hunter', 'Hunter', (el) => this.hunterTab(el)], ['settings', 'Settings', (el) => { el.innerHTML = this.settingsHTML(); this.wireSettings(el); }], ['system', 'Save & Quit', (el) => this.systemTab(el)]], tab);
  },
  // inventory
  invSel: null,
  invTab(el) {
    const P = G.save.player, order = ['sword', 'bow', 'arrow', 'shield', 'armor', 'potion', 'oil', 'food', 'mutagen', 'herb', 'mat', 'key'], names = { sword: 'Swords', bow: 'Bows', arrow: 'Arrows', shield: 'Shields', armor: 'Armour', potion: 'Potions', oil: 'Blade oils', food: 'Food', mutagen: 'Mutagens', herb: 'Herbs', mat: 'Materials', key: 'Story items' };
    const eqd = new Set(Object.values(P.eq)); let list = '';
    for (const ty of order) { const items = P.inv.filter((e) => ITEMS[e.id].type === ty); if (!items.length) continue; list += `<div class="sect">${names[ty]}</div>` + items.map((e) => `<div class="it ${eqd.has(e.id) && ty !== 'arrow' ? 'eq' : ''} ${this.invSel === e.id ? 'sel' : ''}" data-id="${e.id}"><span class="n"><span class="dot" style="background:#${(ITEMS[e.id].col || 0x888070).toString(16).padStart(6, '0')}"></span>${esc(ITEMS[e.id].name)}</span><span class="q">${e.n > 1 ? '×' + e.n : ''}</span></div>`).join(''); }
    el.innerHTML = `<div class="grid2"><div class="list">${list}</div><div><div class="detail" id="iDet"><p class="muted">Pick something.</p></div>
      <div class="sect">Equipped</div><div class="muted" style="line-height:1.7">⚔ ${esc(ITEMS[P.eq.sword].name)}<br>🏹 ${P.eq.bow ? esc(ITEMS[P.eq.bow].name) : '—'} (${esc(ITEMS[P.eq.arrow || 'arrow'].name)}: ${invCount(P.eq.arrow || 'arrow')})<br>🛡 ${P.eq.shield ? esc(ITEMS[P.eq.shield].name) : '—'}<br>👕 ${esc(ITEMS[P.eq.armor].name)}<br>💧 ${P.oil ? esc(P.oil.name) + ' (' + P.oil.hits + ' hits)' : 'No blade oil'}</div>
      <div class="sect">Coins</div><div>🪙 ${fmtNum(P.coins)}</div></div></div>`;
    $$('.it', el).forEach((r) => (r.onclick = () => { this.invSel = r.dataset.id; $$('.it', el).forEach((x) => x.classList.toggle('sel', x === r)); this.itemDetail(r.dataset.id); }));
    if (this.invSel && invCount(this.invSel)) this.itemDetail(this.invSel);
  },
  itemDetail(id) {
    const it = ITEMS[id], P = G.save.player, d = $('#iDet'); if (!d) return; const st = [];
    if (it.dmg) st.push('Damage ' + it.dmg); if (it.silver) st.push('Silver'); if (it.block) st.push('Blocks ' + Math.round(it.block * 100) + '%'); if (it.def != null) st.push('Armour ' + it.def); if (it.warm) st.push('Warmth +' + it.warm);
    if (it.heal) st.push('Heals ' + it.heal); if (it.food) st.push('Food +' + it.food); if (it.lvl) st.push('Level ' + it.lvl); if (it.draw) st.push('Draw ' + it.draw + 's');
    const canUse = ['sword', 'bow', 'shield', 'armor', 'arrow', 'potion', 'food', 'oil', 'mutagen'].includes(it.type) || id === 'firewood';
    const isEq = P.eq[it.type] === id, verb = { sword: 'Equip', bow: 'Equip', shield: 'Equip', armor: 'Wear', arrow: 'Use these', potion: 'Drink', food: 'Eat', oil: 'Apply to blade', mutagen: 'Drink…', mat: 'Light a fire' }[it.type];
    const mut = it.type === 'mutagen' ? `<p>${esc(MUTATIONS[it.mut].name)}: ${esc(MUTATIONS[it.mut].desc)}<br><span style="color:#ff7060">Corruption +${MUTATIONS[it.mut].corr}</span></p>` : '';
    d.innerHTML = `<h3>${esc(it.name)}</h3><div class="muted">${st.join(' · ')}</div><p>${esc(it.desc || '')}</p>${mut}<div class="muted">Worth ${sellPrice(id)} coins</div>
      <div class="row">${canUse && !isEq ? `<button class="btn small" id="iUse">${verb}</button>` : isEq ? '<span class="muted">Equipped</span>' : ''}${it.type === 'shield' && isEq ? '<button class="btn small" id="iOff">Take off</button>' : ''}</div>`;
    if ($('#iUse')) $('#iUse').onclick = () => { useItem(id); this.refresh(); };
    if ($('#iOff')) $('#iOff').onclick = () => { P.eq.shield = null; refreshStats(); this.refresh(); };
  },
  confirmMutagen(id) {
    const it = ITEMS[id], m = MUTATIONS[it.mut], P = G.save.player;
    this.modal('MUTAGEN', [['m', '', (el) => { el.innerHTML = `<div style="max-width:520px;margin:20px auto;text-align:center"><h3 style="color:#ff6050;font-weight:normal;font-size:22px">${esc(it.name)}</h3><p>Drinking this changes you forever.</p><p><b>${esc(m.name)}</b>: ${esc(m.desc)}</p><p style="color:#ff7060">Corruption +${m.corr} (you have ${Math.round(P.corruption)}). At 60, people fear you and prices go up. Holy water and the chapel can wash it away.</p><div style="display:flex;gap:10px;justify-content:center;margin-top:16px"><button class="btn small red" id="mYes">Drink it</button><button class="btn small" id="mNo">Not now</button></div></div>`; $('#mYes').onclick = () => { this.closeModal(); applyMutagen(id); }; $('#mNo').onclick = () => this.closeModal(); }]]);
  },
  // map
  mapMode: null,
  mapTab(el, mode) {
    this.mapMode = mode || null; el.innerHTML = `<div id="mapWrap"><canvas id="mapC" width="768" height="768"></canvas></div>`;
    const c = $('#mapC'); this.drawMap(c);
    c.onclick = (e) => {
      const r = c.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * WORLD_SIZE - HALF, z = ((e.clientY - r.top) / r.height) * WORLD_SIZE - HALF;
      if (this.mapMode === 'travel') { const cp = CAMPS.find((k) => Math.hypot(k.x - x, k.z - z) < 30 && G.save.player.camps.includes(k.id)); if (cp) { this.closeModal(); fastTravel(cp.id); } else UI.toast('Click a camp you have found.'); return; }
      const P = G.save.player; P.pin = P.pin && Math.hypot(P.pin[0] - x, P.pin[1] - z) < 30 ? null : [x, z]; Sfx.play('click'); this.drawMap(c);
    };
  },
  drawMap(c) {
    const g = c.getContext('2d'), W = c.width, s = W / WORLD_SIZE, X = (x) => (x + HALF) * s, Z = (z) => (z + HALF) * s, P = G.save.player, p = G.p;
    g.drawImage(MAPIMG(), 0, 0, W, W);
    g.font = '15px Georgia'; g.textAlign = 'center'; g.shadowColor = '#000'; g.shadowBlur = 4;
    for (const k in PLACES) { const pl = PLACES[k]; if (k === 'home' || k === 'chapel') continue; g.fillStyle = '#f0e2c8'; g.fillText(pl.name, X(pl.x), Z(pl.z) - 8); g.fillStyle = '#d8b060'; g.fillRect(X(pl.x) - 2, Z(pl.z) - 2, 4, 4); }
    for (const cp of CAMPS) { const on = P.camps.includes(cp.id); g.fillStyle = on ? (this.mapMode === 'travel' ? '#ffd060' : '#e8c070') : 'rgba(200,180,140,.35)'; g.font = (this.mapMode === 'travel' && on ? 22 : 16) + 'px Georgia'; g.fillText('⛺', X(cp.x), Z(cp.z) + 6); }
    g.font = '15px Georgia';
    for (const c2 of G.save.contracts.active) if (c2.kind === 'lair' && !c2.done) { const t = c2.seen ? c2.lair : c2.area; g.strokeStyle = '#ff5040'; g.lineWidth = 2; g.beginPath(); g.arc(X(t[0]), Z(t[1]), (c2.seen ? 12 : 55) * s * 2, 0, TAU); g.stroke(); g.fillStyle = '#ff7060'; g.fillText(c2.name, X(t[0]), Z(t[1]) - 14); }
    const mk = Story.marker(); if (mk) { g.fillStyle = '#ffd040'; g.font = '22px Georgia'; g.fillText('◆', X(mk[0]), Z(mk[1]) + 7); }
    if (P.pin) { g.font = '20px Georgia'; g.fillText('📍', X(P.pin[0]), Z(P.pin[1])); }
    if (G.horse && G.area === 'outside' && !(p && p.mounted)) { g.font = '16px Georgia'; g.fillText('🐴', X(G.horse.x), Z(G.horse.z) + 5); }
    if (p) { const px = G.area === 'outside' ? p.x : G.outPos ? G.outPos.x : 0, pz = G.area === 'outside' ? p.z : G.outPos ? G.outPos.z : 0; g.save(); g.translate(X(px), Z(pz)); g.rotate(-p.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.stroke(); g.fill(); g.restore(); }
    g.shadowBlur = 0; g.font = '13px Georgia'; g.fillStyle = 'rgba(240,226,200,.8)'; g.textAlign = 'left'; g.fillText(this.mapMode === 'travel' ? 'Click a camp to travel there.' : 'Click to place a pin on your compass.', 10, W - 12);
  },
  // journal
  journalTab(el) {
    const S = G.save, st = S.story, cur = MAIN[MAIN_IDX[st.step]], doneSteps = MAIN.slice(0, MAIN_IDX[st.step]);
    const titles = [...new Set(doneSteps.map((m) => m.title))].filter((t) => t !== cur.title);
    const C = S.contracts.active.map((c) => `<div class="contract ${c.done ? 'done' : ''}"><h4>${esc(c.title)}</h4><div class="muted">${esc(c.text)}</div><div>${c.done ? '✔ Done — collect your pay at the board.' : c.kind === 'kill' ? c.got + ' / ' + c.n : c.seen ? 'You found its tracks. Follow them to the lair.' : 'Search the marked area with hunter sense (R) to find tracks.'}</div></div>`).join('') || '<p class="muted">No contracts. Check the board in Ashford.</p>';
    const by = (S.player.stats.byType || {}), seen = Object.keys(MON).filter((k) => by[k]);
    const weak = (d) => [d.silver ? 'silver ×' + d.silver : '', d.fire ? 'fire ×' + d.fire : '', d.ice ? 'ice ×' + d.ice : '', { beast: 'beast oil', cursed: 'cursed oil', drowned: 'drowned oil', ogroid: 'ogroid oil', draconid: 'draconid oil' }[d.family] || ''].filter(Boolean).join(', ');
    el.innerHTML = `<div class="grid2"><div><div class="sect">The story</div><h3 style="margin:4px 0;font-weight:normal;color:#f0d8b0">${esc(cur.title)}</h3><p>${esc(cur.goal)}</p>
      ${titles.length ? '<div class="sect">Done</div>' + titles.map((t) => `<div class="muted">✔ ${esc(t)}</div>`).join('') : ''}
      <div class="sect">Endings found</div><div class="muted">${st.endings.length ? st.endings.map((k) => esc(ENDINGS[k].title)).join(', ') : 'None yet. There are three.'}</div>
      <div class="sect">Contracts</div>${C}</div>
      <div><div class="sect">Bestiary</div>${seen.length ? seen.map((k) => `<div class="stat"><span>${esc(MON[k].name)} <span class="muted">(${by[k]})</span></span><span class="muted" style="font-size:12px">${esc(weak(MON[k]) || '—')}</span></span></div>`).join('') : '<p class="muted">Kill monsters to learn their weaknesses.</p>'}
      <div class="sect">Tips</div><p class="muted" style="line-height:1.6">Silver swords and silver arrows hurt the cursed. Fire burns drowners and trolls. Ice slows and freezes everything.<br>Blade oils add 50% damage against one kind of monster. Every 7th night the blood moon makes monsters stronger.<br>Eat, sleep and stay warm: hunger, tiredness and cold will kill you as surely as claws.</p></div></div>`;
  },
  // skills
  skillsTab(el) {
    const P = G.save.player;
    el.innerHTML = `<p>Skill points: <b style="color:var(--gold)">${P.skillPts}</b> <span class="muted">— one per level. Each row needs 2 points in that branch for every row above it.</span></p><div class="skills">${Object.keys(BRANCHES).map((br) => `<div><div class="sect" style="color:${BRANCHES[br].col}">${BRANCHES[br].name}</div>${SKILLS.filter((s) => s.br === br).map((s) => { const r = P.skills[s.id] || 0, lock = branchPts(br) < s.row * 2; return `<div class="skill ${canBuySkill(s.id) ? 'can' : ''} ${lock ? 'lock' : ''}" data-s="${s.id}" style="margin-bottom:8px"><b>${esc(s.name)}</b>${esc(s.per)}<div class="pips" style="margin-top:6px">${[0, 1, 2].map((i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div></div>`; }).join('')}</div>`).join('')}</div>
      <div class="sect">Spells</div>${Object.entries(SPELLS).map(([k, s], i) => `<div class="stat"><span>${i + 3}: ${esc(s.name)} <span class="muted">— ${esc(s.desc)}</span></span><span class="muted">${s.mana} mana</span></div>`).join('')}`;
    $$('.skill', el).forEach((b) => (b.onclick = () => { if (buySkill(b.dataset.s)) this.refresh(); }));
  },
  // hunter (character)
  hunterTab(el) {
    const P = G.save.player, p = G.p, st = pStats(), sv = G.save.surv, h = Math.floor((G.save.playTime || 0) / 3600), m = Math.floor(((G.save.playTime || 0) % 3600) / 60), S = P.stats;
    el.innerHTML = `<div class="grid2"><div><h3 style="margin:0;font-weight:normal;color:#f0d8b0">${esc(P.name)}</h3><div class="muted">Level ${P.level} · ${DIFF[G.save.diff].name}</div>
      <div class="meter"><i style="width:${P.level >= MAX_LVL ? 100 : (100 * P.xp / xpNeed(P.level)).toFixed(0)}%;background:var(--gold)"></i></div>
      <div class="stat"><span>Health</span><span>${Math.ceil(p.hp)} / ${st.maxHp}</span></div><div class="stat"><span>Stamina</span><span>${st.maxStam}</span></div><div class="stat"><span>Mana</span><span>${st.maxMana}</span></div><div class="stat"><span>Armour</span><span>${st.def}</span></div><div class="stat"><span>Sword damage</span><span>${swordItem().dmg}${swordItem().silver ? ' (silver)' : ''}</span></div>
      <div class="sect">Body</div><div class="stat"><span>Hunger</span><span>${Math.round(sv.hunger)}%</span></div><div class="stat"><span>Rested</span><span>${Math.round(100 - sv.fatigue)}%</span></div><div class="stat"><span>Warmth</span><span>${Math.round(sv.warmth)}%</span></div>
      <div class="sect">Corruption</div><div class="meter"><i style="width:${P.corruption}%;background:#a02020"></i></div><div class="muted">${Math.round(P.corruption)} / 100</div>
      <div class="sect">Mutations</div>${P.muts.length ? P.muts.map((k) => `<div class="stat"><span>${esc(MUTATIONS[k].name)}</span><span class="muted" style="font-size:12px">${esc(MUTATIONS[k].desc)}</span></div>`).join('') : '<div class="muted">None. Monster mutagens can change you.</div>'}</div>
      <div><div class="sect">Record</div><div class="stat"><span>Time played</span><span>${h}h ${m}m</span></div><div class="stat"><span>Monsters killed</span><span>${S.kills || 0}</span></div><div class="stat"><span>Finishers</span><span>${S.finishers || 0}</span></div><div class="stat"><span>Arrows shot</span><span>${S.arrows || 0}</span></div><div class="stat"><span>Spells cast</span><span>${S.spells || 0}</span></div><div class="stat"><span>Potions drunk</span><span>${S.potions || 0}</span></div><div class="stat"><span>Things crafted</span><span>${S.crafted || 0}</span></div><div class="stat"><span>Deaths</span><span>${S.deaths || 0}</span></div><div class="stat"><span>Trophies</span><span>${Object.keys(P.trophies).length} / ${Object.keys(TROPHIES).length}</span></div><div class="stat"><span>Contracts done</span><span>${G.save.contracts.done}</span></div>
      <div class="sect">Your horse</div><div class="stat"><span>Name</span><span>${esc(G.save.horse.name || 'Ash')}</span></div><p class="muted">Whistle with H. Ride with E. Hold Shift to gallop.</p></div></div>`;
  },
  systemTab(el) {
    el.innerHTML = `<div style="max-width:480px;margin:10px auto;display:flex;flex-direction:column;gap:10px"><button class="btn" id="ySave">Save game</button><button class="btn" id="yLoad">Load a hunt</button><button class="btn red" id="yQuit">Save and quit to menu</button>
      <p class="muted">The game also saves itself at camps, when you sleep, when you go through doors, and every few minutes.${G.save.diff === 'hardcore' ? '<br><span style="color:#ff6060">Hardcore: if you die, this save is deleted.</span>' : ''}</p>
      <div class="sect">Controls</div><p class="muted" style="line-height:1.7">WASD move · Shift sprint/gallop · Space jump · Ctrl crouch · Mouse look<br>Left click attack (hold for a heavy swing) · F block (tap just before a hit to parry) · C dodge<br>Right click draw the bow, release to shoot · 2 switch arrows · 3 fire · 4 lightning · 5 ice<br>Q healing potion · 1 eat · R hunter sense · E interact / ride · H whistle for your horse<br>V first/third person · Tab inventory · M map · J journal · K skills · Esc pause</p></div>`;
    $('#ySave').onclick = () => { if (saveGame()) this.refresh(); else UI.toast("You can't save right now."); };
    $('#yLoad').onclick = () => { this.closeModal(); this.savesScreen(true); };
    $('#yQuit').onclick = () => { saveGame(true); this.closeModal(); quitToMenu(); };
  },
  // ---------- shops, board, camps, crafting ----------
  shopId: null,
  openShop(id) {
    const S = SHOPS[id]; this.shopId = id; const tabs = [['buy', 'Buy', (el) => this.buyTab(el)], ['sell', 'Sell', (el) => this.sellTab(el)]];
    if (S.craft) tabs.push(['craft', S.craft === 'smith' ? 'Forge' : 'Alchemy', (el) => this.craftList(el, S.craft)]);
    if (id === 'inn' || id === 'chapel') tabs.push(['svc', id === 'inn' ? 'Room' : 'Cleansing', (el) => this.serviceTab(el, id)]);
    this.modal(S.name.toUpperCase(), tabs);
  },
  coinsLine() { return `<p>🪙 <b>${fmtNum(G.save.player.coins)}</b> coins${priceMul() > 1 ? ' <span style="color:#ff7060">(your corruption makes everything 30% dearer)</span>' : ''}</p>`; },
  buyTab(el) {
    const S = SHOPS[this.shopId], P = G.save.player;
    el.innerHTML = this.coinsLine() + '<div class="list">' + S.items.map((id) => { const it = ITEMS[id], n = it.type === 'arrow' ? 10 : 1, cost = Math.ceil(it.price * n * priceMul()), lock = it.lvl && P.level < it.lvl; return `<div class="it" data-b="${id}"><span class="n"><span class="dot" style="background:#${(it.col || 0x888070).toString(16).padStart(6, '0')}"></span>${n > 1 ? n + ' ' : ''}${esc(it.name)} <span class="muted">${esc([it.dmg ? 'dmg ' + it.dmg : '', it.def != null && it.type === 'armor' ? 'armour ' + it.def : '', it.block ? 'block ' + Math.round(it.block * 100) + '%' : '', it.heal ? 'heals ' + it.heal : '', it.food ? 'food ' + it.food : '', lock ? 'needs level ' + it.lvl : ''].filter(Boolean).join(' · '))}</span></span><span class="q">${invCount(id) ? 'have ' + invCount(id) + ' · ' : ''}${cost} 🪙</span></div>`; }).join('') + '</div>';
    $$('[data-b]', el).forEach((r) => (r.onclick = () => { if (buy(r.dataset.b)) this.refresh(); }));
  },
  sellTab(el) {
    const P = G.save.player, items = P.inv.filter((e) => ITEMS[e.id].type !== 'key');
    el.innerHTML = this.coinsLine() + '<div class="list">' + (items.map((e) => `<div class="it" data-s="${e.id}"><span class="n">${esc(ITEMS[e.id].name)} <span class="muted">×${e.n}</span></span><span class="q">+${sellPrice(e.id)} 🪙</span></div>`).join('') || '<p class="muted">Nothing to sell.</p>') + '</div>';
    $$('[data-s]', el).forEach((r) => (r.onclick = () => { if (sell(r.dataset.s)) this.refresh(); }));
  },
  craftList(el, at) {
    const rs = RECIPES.filter((r) => r.at === at);
    el.innerHTML = (at === 'smith' ? '<p class="muted">Bring the materials and Brann forges it for free.</p>' : '<p class="muted">Mix potions, oils and arrows from herbs and monster parts.</p>') + '<div class="list">' + rs.map((r, i) => { const ok = canCraft(r); return `<div class="it" data-r="${i}" style="${ok ? '' : 'opacity:.55'}"><span class="n">${r.n > 1 ? r.n + ' ' : ''}${esc(ITEMS[r.out].name)}<br><span class="muted" style="font-size:12px">${Object.entries(r.need).map(([k, n]) => `${n} ${esc(ITEMS[k].name)} (${invCount(k)})`).join(' · ')}</span></span><span class="q">${ok ? '<b style="color:var(--gold)">Make</b>' : ''}</span></div>`; }).join('') + '</div>';
    $$('[data-r]', el).forEach((r) => (r.onclick = () => { if (craft(rs[+r.dataset.r])) this.refresh(); }));
  },
  openCraft(at, title) { this.modal(title.toUpperCase(), [['c', '', (el) => this.craftList(el, at)]]); },
  serviceTab(el, id) {
    const P = G.save.player;
    if (id === 'inn') { el.innerHTML = this.coinsLine() + `<p>A warm bed and a barred door. 15 coins.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${[[6, 'Until dawn'], [12, 'Until noon'], [18, 'Until evening']].map(([h, t]) => `<button class="btn small" data-h="${h}">${t}</button>`).join('')}</div>`; $$('[data-h]', el).forEach((b) => (b.onclick = () => { if (P.coins < 15) return UI.toast('Not enough coins.', 'bad'); P.coins -= 15; this.closeModal(); sleepUntil(+b.dataset.h, 'inn'); })); }
    else { el.innerHTML = this.coinsLine() + `<p>Corruption: <b style="color:#ff7060">${Math.round(P.corruption)}</b> / 100.</p><p>Father Edrin can wash 40 corruption from your blood for 120 coins.</p><button class="btn small" id="cl">Be cleansed (120)</button>`; $('#cl').onclick = () => { if (P.corruption <= 0) return UI.toast('Your blood is clean.'); if (P.coins < 120) return UI.toast('Not enough coins.', 'bad'); P.coins -= 120; P.corruption = Math.max(0, P.corruption - 40); Sfx.play('bell'); UI.toast('The light burns. Then it is gone. Corruption: ' + Math.round(P.corruption), 'good'); this.refresh(); }; }
  },
  openBoard() {
    Contracts.refresh(); const n = Contracts.turnIn();
    this.modal('CONTRACT BOARD', [['b', '', (el) => {
      const C = G.save.contracts;
      el.innerHTML = `<p class="muted">New contracts go up every morning. You can take 3 at a time.</p><div class="sect">Posted</div>${C.board.map((c, i) => `<div class="contract"><h4>${esc(c.title)}</h4><div class="muted">${esc(c.text)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span>🪙 ${c.coins} · ${c.xp} XP</span><button class="btn small" data-a="${i}">Take it</button></div></div>`).join('') || '<p class="muted">Nothing new today.</p>'}
        <div class="sect">Yours</div>${C.active.map((c, i) => `<div class="contract ${c.done ? 'done' : ''}"><h4>${esc(c.title)}</h4><div class="muted">${esc(c.text)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><span>${c.kind === 'kill' ? c.got + ' / ' + c.n : c.done ? 'Done' : 'Hunting'}</span><button class="btn small red" data-x="${i}">Give up</button></div></div>`).join('') || '<p class="muted">None.</p>'}`;
      $$('[data-a]', el).forEach((b) => (b.onclick = () => { if (Contracts.accept(C.board[+b.dataset.a])) this.refresh(); }));
      $$('[data-x]', el).forEach((b) => (b.onclick = () => { if (b.dataset.sure) { Contracts.abandon(C.active[+b.dataset.x]); this.refresh(); } else { b.dataset.sure = 1; b.textContent = 'Really?'; } }));
    }]]);
    if (n) UI.toast('The Watch pays you for ' + n + ' contract' + (n > 1 ? 's' : '') + '.', 'gold');
  },
  openCamp(t) {
    const camp = t.kind === 'camp' ? campById(t.camp) : null; if (camp && !G.save.player.camps.includes(camp.id)) G.save.player.camps.push(camp.id);
    const tabs = [['rest', 'Rest', (el) => {
      el.innerHTML = `<p>${camp ? esc(camp.name) + '. A fire, a bedroll and a signpost.' : 'A small fire crackles.'} It is ${Clock.label()}.</p><div style="display:flex;gap:8px;flex-wrap:wrap">${[[1, 'Rest 1 hour'], [4, 'Rest 4 hours']].map(([h, t2]) => `<button class="btn small" data-w="${h}">${t2}</button>`).join('')}${[[6, 'Sleep until dawn'], [18, 'Sleep until evening']].map(([h, t2]) => `<button class="btn small" data-s="${h}">${t2}</button>`).join('')}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn small" id="cCook">Cook raw meat</button>${camp ? '<button class="btn small" id="cTravel">Fast travel</button><button class="btn small" id="cSave">Save game</button>' : ''}</div>
        <p class="muted">Resting by a fire warms you. Sleeping here helps, but a real bed (home or the inn) is better.</p>`;
      $$('[data-w]', el).forEach((b) => (b.onclick = () => { if (enemiesNear(50)) return UI.toast("You can't rest with monsters nearby.", 'bad'); this.closeModal(); const h = +b.dataset.w; UI.fade(() => { passTime(h * 60); G.p.hp = Math.min(G.p.maxHp, G.p.hp + h * 20); G.save.surv.fatigue = Math.max(0, G.save.surv.fatigue - h * 6); G.save.surv.warmth = 100; UI.toast('You rest by the fire. ' + Clock.label()); autosave(); }); }));
      $$('[data-s]', el).forEach((b) => (b.onclick = () => { this.closeModal(); sleepUntil(+b.dataset.s, 'camp'); }));
      $('#cCook').onclick = () => { cookAll(); };
      if (camp) { $('#cTravel').onclick = () => this.showTravel(); $('#cSave').onclick = () => { saveGame(); }; }
    }], ['alch', 'Alchemy', (el) => this.craftList(el, 'alchemy')]];
    this.modal(camp ? camp.name.toUpperCase() : 'CAMPFIRE', tabs);
    if (camp) autosave();
  },
  showTravel() { this.modal('FAST TRAVEL', [['map', '', (el) => this.mapTab(el, 'travel')]]); },
  sleepMenu(where) { this.choice('Sleep until when?', [{ label: 'Dawn (6:00)', fn: () => sleepUntil(6, where) }, { label: 'Noon (12:00)', fn: () => sleepUntil(12, where) }, { label: 'Evening (18:00)', fn: () => sleepUntil(18, where) }, { label: 'Not now', fn: () => {} }]); },
  openTrophies() {
    const T = G.save.player.trophies;
    this.modal('TROPHY WALL', [['t', '', (el) => { el.innerHTML = '<div class="list">' + Object.entries(TROPHIES).map(([k, t]) => `<div class="it"><span class="n">${T[k] ? '🏆 ' + esc(t.name) : '<span class="muted">— an empty plaque —</span>'}</span><span class="q">${T[k] ? 'Day ' + T[k] : ''}</span></div>`).join('') + '</div>'; }]]);
  },
  // ---------- death and endings ----------
  death(by) {
    if (!G.save) return; const hc = G.save.diff === 'hardcore', id = G.save.id; Hud.boss(null);
    if (hc) { Store.del(id); G.save.deleted = true; }
    const s = this.screen('death', `<div style="text-align:center"><div class="title" style="color:#c02020;text-shadow:0 0 30px #600">YOU DIED</div><p style="font-size:18px">${by ? 'Killed by ' + esc(by) + '.' : 'The valley takes another hunter.'} Day ${Clock.W().day}.</p>
      ${hc ? '<p style="color:#ff6060">Hardcore: this hunt is over. The save has been deleted.</p>' : ''}<div class="menuCol">${!hc && Store.get(id) ? '<button class="btn" id="dLoad">Load last save</button>' : ''}<button class="btn" id="dMenu">Main menu</button></div></div>`, true);
    if ($('#dLoad')) $('#dLoad').onclick = () => loadGame(id); $('#dMenu').onclick = () => quitToMenu();
  },
  ending(E, kind, then) {
    this.unlock(); Hud.boss(null);
    const s = this.screen('ending', `<div class="ending"><h1>${esc(E.title)}</h1><p class="sub">${esc(E.sub)}</p><p>${esc(E.text)}</p><div class="menuCol"><button class="btn" id="eNext">Continue</button></div></div>`, true);
    s.style.background = E.good ? 'radial-gradient(ellipse at center, rgba(40,20,10,.75), rgba(0,0,0,.95))' : 'radial-gradient(ellipse at center, rgba(60,0,0,.8), rgba(0,0,0,.97))';
    $('#eNext').onclick = () => this.credits(() => { this.closeScreen(); then(); });
  },
  credits(then, fromMenu) {
    const s = this.screen('credits', `<div id="credits"><div class="roll" id="roll"><div class="title" style="font-size:44px">BLOOD MOON HUNTER</div>
      <h3>A STORY OF</h3>Greywater Vale<h3>THE HUNTER</h3>${G.save && !fromMenu ? esc(G.save.player.name) : 'You'}<h3>THE PEOPLE OF ASHFORD</h3>Captain Hale · Old Maud · Tomas Brann · Elsa · Father Edrin · Pella<br>Willem · Agnes · Bram · Ilse · Odo · Greta
      <h3>THE OTHERS</h3>Morwen of Blackmire · Lord Aldous Vargrave · Azgoreth, the Hunger Below
      <h3>WORLD, MONSTERS AND MUSIC</h3>Made entirely in code — every tree, every howl, every note<h3>3D ENGINE</h3>three.js (MIT licence)<h3>MADE WITH</h3>Claude<h3>THANK YOU FOR PLAYING</h3><br><br><button class="btn" id="crDone">${fromMenu ? 'Back' : 'Keep hunting'}</button>${fromMenu ? '' : '<br><br><button class="btn" id="crMenu">Main menu</button>'}<br><br><br></div></div>`);
    Music.set(fromMenu ? 'title' : 'victory');
    const roll = $('#roll'); let y = innerHeight; const step = () => { if (this.screenName !== 'credits') return; y -= 0.8; const h = roll.scrollHeight; if (y < innerHeight - h) y = innerHeight - h; roll.style.top = y + 'px'; requestAnimationFrame(step); }; step();
    s.onclick = (e) => { if (e.target.tagName !== 'BUTTON') y -= 160; };
    $('#crDone').onclick = () => { this.closeScreen(); then(); }; if ($('#crMenu')) $('#crMenu').onclick = () => { this.closeScreen(); then(); saveGame(true); quitToMenu(); };
  },
};
function placeName(x, z) { let best = 'The wilds', bd = 1e9; for (const k in PLACES) { const P = PLACES[k], d = Math.hypot(P.x - x, P.z - z); if (d < (P.r || 60) + 40 && d < bd) { bd = d; best = P.name; } } return best; }
// ---------- the map picture (made once from the terrain) ----------
let _mapImg = null;
function MAPIMG() {
  if (_mapImg) return _mapImg; const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data, col = [0, 0, 0];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / N) * WORLD_SIZE - HALF, z = (j / N) * WORLD_SIZE - HALF, h = heightAt(x, z), gi = Math.round((x + HALF) / CELL), gj = Math.round((z + HALF) / CELL);
    groundColor(clamp(gi, 0, GN - 1), clamp(gj, 0, GN - 1), col); let r = col[0], gg = col[1], b = col[2];
    const sh = clamp((heightAt(x - 3, z - 3) - h) * 0.12, -0.25, 0.25); r += sh; gg += sh; b += sh;
    const f = forestAt(x, z); r = lerp(r, 0.12, f * 0.55); gg = lerp(gg, 0.2, f * 0.55); b = lerp(b, 0.1, f * 0.55);
    if (waterLevelAt(x, z) > h + 0.05) { const dd = clamp((waterLevelAt(x, z) - h) / 4, 0, 1); r = lerp(0.2, 0.08, dd); gg = lerp(0.3, 0.16, dd); b = lerp(0.32, 0.24, dd); }
    const k = (j * N + i) * 4; d[k] = clamp(r * 1.05, 0, 1) * 255; d[k + 1] = clamp(gg * 1.0, 0, 1) * 255; d[k + 2] = clamp(b * 0.95, 0, 1) * 255; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // parchment tint and a vignette
  g.fillStyle = 'rgba(150,120,80,.18)'; g.fillRect(0, 0, N, N); const vg = g.createRadialGradient(N / 2, N / 2, N * 0.3, N / 2, N / 2, N * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, N, N);
  g.strokeStyle = 'rgba(90,60,30,.7)'; g.lineWidth = 1.5; for (const r of ROADS) { g.beginPath(); r.forEach(([x, z], i) => { const X = ((x + HALF) / WORLD_SIZE) * N, Z = ((z + HALF) / WORLD_SIZE) * N; i ? g.lineTo(X, Z) : g.moveTo(X, Z); }); g.stroke(); }
  return (_mapImg = c);
}
// ---------- the creator's little stage ----------
const CREATOR = {
  on: false, scene: null, cam: null, rig: null, rot: 0.4, drag: null,
  init() {
    const s = (this.scene = new THREE.Scene()); s.background = new THREE.Color(0x0a0606); s.fog = new THREE.Fog(0x0a0606, 6, 14);
    this.cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); this.cam.position.set(0, 1.25, 4.6); this.cam.lookAt(0, 0.98, 0);
    const key = new THREE.SpotLight(0xffd8b0, 40, 14, 0.6, 0.6, 1.4); key.position.set(2, 4, 4); key.castShadow = true; s.add(key); s.add(key.target);
    const rim = new THREE.DirectionalLight(0xff5040, 1.6); rim.position.set(-3, 2, -4); s.add(rim); s.add(new THREE.HemisphereLight(0x6070a0, 0x201010, 0.6));
    const fl = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({ color: 0x2a201a, roughness: 1 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; s.add(fl);
    const fire = new THREE.PointLight(0xff8030, 6, 8, 1.6); fire.position.set(1.6, 0.5, 1.2); s.add(fire); this.fire = fire;
    const cv = $('#gl'); cv.addEventListener('pointerdown', (e) => { if (this.on) this.drag = e.clientX; }); addEventListener('pointerup', () => (this.drag = null)); addEventListener('pointermove', (e) => { if (this.on && this.drag != null) { this.rot += (e.clientX - this.drag) * 0.01; this.drag = e.clientX; } });
  },
  show(look) {
    if (!this.scene) this.init(); this.on = true; const L = lookOf(look); const key = JSON.stringify(L); if (this.key === key && this.rig) return; this.key = key;
    if (this.rig) this.scene.remove(this.rig.root); this.rig = buildHuman(L); this.rig.root.traverse((m) => { if (m.isMesh) m.castShadow = true; }); this.scene.add(this.rig.root);
    const sw = buildSword('rusty_sword'); sw.rotation.x = Math.PI / 2; sw.position.set(0, -0.06, 0.02); this.rig.handR.add(sw);
  },
  render(dt) {
    if (!this.rig) return; const t = performance.now() / 1000; if (this.drag == null) this.rot += dt * 0.25; this.rig.root.rotation.y = this.rot;
    animate(this.rig, { t, speed: 0, phase: 0, attack: -1 }, dt); this.fire.intensity = 5 + Math.sin(t * 11) * 0.8 + Math.sin(t * 23) * 0.5;
    const W = innerWidth, H = innerHeight, mob = W < 700; this.cam.aspect = W / H;
    if (mob) this.cam.setViewOffset(W, H, 0, H * 0.24, W, H); else this.cam.setViewOffset(W, H, -Math.min(440, W * 0.5) / 2, 0, W, H);
    this.cam.updateProjectionMatrix(); renderer.toneMappingExposure = 1.2; renderer.clear(); renderer.render(this.scene, this.cam);
  },
};
