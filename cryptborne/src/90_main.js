
// =====================================================================
// MAIN — input, saving, starting and leaving a game, the frame loop.
// =====================================================================
const Input = {
  keys: new Set(), pressed: new Set(), mx: 0, my: 0, mouseDown: false, touchMode: false, stick: { on: false, x: 0, y: 0, id: null }, tAtk: false, tBlock: false,
  down(k) { return this.keys.has(k); },
  take(a) { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; },
  clear() { this.keys.clear(); this.pressed.clear(); this.mouseDown = false; this.tAtk = false; this.tBlock = false; this.stick.on = false; this.stick.x = this.stick.y = 0; const k = $('#stick i'); if (k) k.style.transform = ''; },
};
const MODAL_KEYS = { mapModal: ['m'], bagModal: ['b', 'i', 'tab'], skillsModal: ['k'], journalModal: ['j'], noteModal: ['e', 'enter'], dialogModal: [] };
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(), tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { if (k === 'escape') e.target.blur(); return; }
  AU.unlock();
  if (!G.on || UI.screen !== 'game') { if (k === 'escape') UI.back(); return; }
  if (Story.active()) {
    if (UI.modal === 'noteModal') { if (['escape', 'e', ' ', 'enter'].includes(k)) { e.preventDefault(); UI.closeModal(); } return; }
    if ((k === 'e' || k === ' ' || k === 'enter') && !e.repeat) { if (!(k === 'enter' && e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); Story.advance(); } }
    return;
  }
  if (k === 'escape') { e.preventDefault(); UI.escape(); return; }
  if (UI.modal) {
    const close = MODAL_KEYS[UI.modal];
    if (close && close.includes(k)) { e.preventDefault(); UI.closeModal(); }
    return;
  }
  if (G.dead) return;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
  const first = !Input.keys.has(k); Input.keys.add(k);
  if (!first || e.repeat) return;
  if (k === 'f') Input.pressed.add('blockTap');
  const si = SPECIAL_KEYS.indexOf(k.toUpperCase());
  if (k === 'c' || k === ' ') Input.pressed.add('dodge');
  else if (k === 'e') interact();
  else if (k === 'q') quickPotion();
  else if (k === 'm') UI.openMap();
  else if (k === 'b' || k === 'i' || k === 'tab') UI.openBag();
  else if (k === 'k') UI.openSkills();
  else if (k === 'j') UI.openJournal();
  else if (si >= 0 && k.length === 1) useSpecial(si);
  else if (/^[0-9]$/.test(k)) useSlot(k === '0' ? 9 : +k - 1);
});
addEventListener('keyup', (e) => Input.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => Input.clear());
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { Input.mx = e.clientX / VIEW.z; Input.my = e.clientY / VIEW.z; } });
canvas.addEventListener('pointerdown', (e) => {
  AU.unlock();
  if (e.pointerType === 'mouse' && e.button === 0) { Input.mouseDown = true; Input.mx = e.clientX / VIEW.z; Input.my = e.clientY / VIEW.z; }
});
addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) Input.mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !Input.touchMode) { Input.touchMode = true; document.body.classList.add('touch'); if (UI.screen === 'game' && !Story.active()) $('#touch').hidden = false; UI.hudDirty(); }
  else if (e.pointerType === 'mouse' && Input.touchMode) { Input.touchMode = false; document.body.classList.remove('touch'); $('#touch').hidden = true; }
}, true);
(function touchControls() {
  const st = $('#stick'), knob = $('#stick i');
  const moveStick = (e) => { const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), max = r.width * 0.36; if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; } Input.stick.x = dx / max; Input.stick.y = dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`; };
  st.addEventListener('pointerdown', (e) => { e.preventDefault(); AU.unlock(); Input.stick.on = true; Input.stick.id = e.pointerId; st.setPointerCapture(e.pointerId); moveStick(e); });
  st.addEventListener('pointermove', (e) => { if (Input.stick.on && e.pointerId === Input.stick.id) moveStick(e); });
  const end = (e) => { if (e.pointerId !== Input.stick.id) return; Input.stick.on = false; Input.stick.x = Input.stick.y = 0; knob.style.transform = ''; };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  const hold = (id, key) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); AU.unlock(); Input[key] = true; if (key === 'tBlock') Input.pressed.add('blockTap'); b.setPointerCapture(e.pointerId); }); for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, () => (Input[key] = false)); };
  hold('#tAtk', 'tAtk'); hold('#tBlk', 'tBlock');
  $('#tDodge').addEventListener('pointerdown', (e) => { e.preventDefault(); Input.pressed.add('dodge'); });
  $('#tE').addEventListener('pointerdown', (e) => { e.preventDefault(); if (Story.active()) Story.advance(); else if (!UI.modal && !G.dead) interact(); });
  for (const b of $$('#touch [data-sp]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); AU.unlock(); if (!UI.modal && !G.dead && !Story.active() && G.on) useSpecial(+b.dataset.sp); });
})();

// ---------- saving & session ----------
function snapshotSave() {
  const s = JSON.parse(JSON.stringify(G.save)), P = s.player, p = G.p, A = G.area;
  delete s.deleted; delete s.fresh;
  P.hp = Math.max(1, Math.round(p.hp));
  if (G.dead || !A) { const v = getWorld('vale'); P.map = 'vale'; P.x = v.spawn.x; P.y = v.spawn.y; P.hp = null; }
  else if (A.kind === 'dungeon') { const W = getWorld(A.def.map), e = W.entrances.find((x) => x.d === A.def); P.map = A.def.map; P.x = e ? e.x : W.spawn.x; P.y = e ? e.y + 14 : W.spawn.y; }
  else { P.map = A.id; P.x = Math.round(p.x); P.y = Math.round(p.y); }
  for (const s2 of P.inv) if (s2) delete s2._i;
  return s;
}
function saveGame(quiet) {
  if (!G.on || !G.save || G.save.deleted) return;
  G.save.lastSaved = Date.now();
  const s = snapshotSave(); G.save.player.map = s.player.map; G.save.player.x = s.player.x; G.save.player.y = s.player.y;
  Store.put(s);
  if (!quiet) { UI.toast('Game saved', 'good'); Sfx.play('pickup'); }
}
function resetStory() { Story.cur = null; Story.id = null; Story.q = []; Story.block = null; Story.mood = null; Story.vision = 0; Story.fade = Story.fadeTo = 0; Story.red = 0; UI.cutscene(false); UI.hideSay(); UI.hideTitle(); }
function startGame(save, resumed) {
  if (!save) { UI.toast('That save could not be found.', 'bad'); return; }
  AU.unlock(); UI.closeModal(true); resetStory();
  G.save = normalizeSave(JSON.parse(JSON.stringify(save)));
  if (!resumed) G.save.lastLoaded = Date.now();
  resetEntities(); G.p = makeRuntimePlayer(); G.on = true; G.dead = false; G.time = 0; G.autosaveT = 0; G.zoneT = 0; G.flash = 0; G.hitstop = 0; G.shake = 0; G.pet = null;
  statsChanged();
  const P = S(), fresh = !!G.save.fresh; delete G.save.fresh;
  const opening = !ST().flags.hasMap; // a new hero, or one who left before the opening finished
  let map = REGIONS[P.map] ? P.map : 'vale';
  if (ST().act < 2 && map !== 'vale' && map !== 'home') map = 'vale';
  if (opening) map = 'home';
  const W = getWorld(map); let x = P.x, y = P.y;
  if (!(x > 0 && y > 0 && x < W.map.w * 16 && y < W.map.h * 16)) { x = W.spawn.x; y = W.spawn.y; }
  enterMap(map, x, y);
  G.p.hp = P.hp > 0 ? Math.min(P.hp, PS().maxHp) : PS().maxHp;
  Pets.spawn();
  UI.showScreen('game'); UI.invDirty();
  if (opening) {
    const bed = getWorld('home').spots.find((s) => s.kind === 'bed');
    G.p.lying = true; G.p.x = bed.x; G.p.y = bed.y - 12; G.save.world.time = 23 * 60; snapCam();
    Story.fade = 1; Story.play('opening');
  } else if (!resumed) {
    UI.toast(`Welcome back, ${G.save.name}!`, 'gold');
    const left = DF().nights - G.save.world.nights; if (!ST().ending && left <= 10) later(1.5, () => UI.toast(`Only ${left} nights left to save Finn.`, 'bad'));
  }
  saveGame(true);
  if (fresh) Sfx.play('portal');
}
function quitToMenu() {
  saveGame(true); UI.closeModal(true); resetStory();
  G.on = false; G.dead = false; G.save = null; G.pet = null; menuScene(); UI.showScreen('menu');
}
function menuScene() {
  const v = getWorld('vale');
  resetEntities();
  G.area = Object.assign({}, v, { kind: 'overworld', id: 'vale', def: null, chests: [], torches: [], traps: [], decos: [], portals: [], doors: [], notes: [] });
  G.p = { x: v.spawn.x, y: v.spawn.y, buffs: {}, hidden: true };
  Weather.enter(null);
}

// ---------- main loop ----------
let lastT = performance.now(), menuT = 0, errCount = 0;
function frame(now) {
  const rdt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  try {
    if (G.on) {
      const paused = !!UI.modal || G.dead || UI.screen !== 'game';
      let dt = rdt; if (G.hitstop > 0) { G.hitstop -= rdt; dt = 0; }
      if (!paused && dt > 0) updateWorld(dt);
      else if (paused) { for (const q of G.parts) { q.life -= rdt; q.x += q.vx * rdt; q.y += q.vy * rdt; } G.parts = G.parts.filter((q) => q.life > 0); }
      if (G.on) {
        if (UI.screen !== 'credits') envTick(rdt);
        Music.tick();
        if (Story.active()) UI.sayTick(rdt);
        UI.tick(rdt); render(); drawMini();
      }
    } else if (G.area) {
      menuT += rdt; G.time += rdt;
      const m = G.area.map;
      G.cam.x = clamp(48 * 16 - VIEW.w / 2 + Math.sin(menuT * 0.07) * 260, 0, Math.max(0, m.w * 16 - VIEW.w));
      G.cam.y = clamp(34 * 16 - VIEW.h / 2 + Math.cos(menuT * 0.05) * 160, 0, Math.max(0, m.h * 16 - VIEW.h));
      G.p.x = G.cam.x + VIEW.w / 2; G.p.y = G.cam.y + VIEW.h / 2;
      updateNPCs(rdt); updateParticles(rdt);
      for (const pr of G.area.props) if (pr.smoke && chance(rdt * 3)) G.parts.push({ x: pr.x + (pr.img.chimney ? pr.img.chimney.x : pr.w - 12) + rand(-2, 2), y: pr.y - pr.h + 2, vx: rand(-4, 4), vy: -14, life: 1.6, max: 1.6, col: '#8f897c', size: 2, grav: 0 });
      if (UI.screen === 'creator') UI.creatorTick(rdt);
      if (UI.screen !== 'credits') Music.set('title');
      Music.tick();
      render();
    }
  } catch (err) {
    console.error(err);
    if (errCount++ < 3) UI.toast('Something glitched: ' + (err && err.message), 'bad');
  }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { resize(); if (G.on) snapCam(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { Input.clear(); if (G.on && !UI.modal && !G.dead && UI.screen === 'game' && !Story.active()) UI.openPause(); if (G.on) saveGame(true); }
});
addEventListener('pagehide', () => { if (G.on) saveGame(true); });

// ---------- boot ----------
function boot(hotData) {
  resize();
  getWorld('vale');
  Store.init(); UI.init();
  menuScene(); UI.showScreen('menu');
  requestAnimationFrame((t) => { lastT = t; frame(t); });
  if (hotData && hotData.save && hotData.save.player) startGame(hotData.save, true);
}
(function start() {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => (G.on && G.save && !G.save.deleted ? { save: snapshotSave() } : {})); } catch (e) {} }
  if (hot && typeof hot.ready === 'function') hot.ready((data) => boot(data || {}));
  else boot((hot && hot.data) || {});
})();
