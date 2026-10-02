
// ---------- input ----------
const Input = {
  keys: new Set(), pressed: new Set(), mx: 0, my: 0, mouseDown: false, touchMode: false, stick: { on: false, x: 0, y: 0, id: null }, tAtk: false, tBlock: false,
  down(k) { return this.keys.has(k); },
  take(a) { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; },
  clear() { this.keys.clear(); this.pressed.clear(); this.mouseDown = false; this.tAtk = false; this.tBlock = false; this.stick.on = false; this.stick.x = this.stick.y = 0; const k = $('#stick i'); if (k) k.style.transform = ''; },
};
function findInteract() {
  const p = G.p, A = G.area; if (!A || !G.on) return null; let best = null, bd = 1e9;
  const cand = (x, y, r, label, act, locked) => { const d = dist(p.x, p.y, x, y); if (d < r && d < bd) { bd = d; best = { label, act, locked }; } };
  if (A.kind === 'overworld') {
    for (const e of A.entrances) { const ok = S().level >= e.d.lvl; cand(e.x, e.y, 28, ok ? `Enter ${e.d.name} (Lv ${e.d.lvl})` : `${e.d.name}: needs level ${e.d.lvl}`, () => tryEnter(e.d), !ok); }
    for (const n of A.npcs) cand(n.x, n.y, 26, n.shop ? `Shop with ${n.name}` : `Talk to ${n.name}`, () => UI.talk(n));
  } else {
    for (const c of A.chests) if (!c.open) cand(c.x, c.y - 4, 26, c.locked ? 'Locked: defeat the boss' : c.kind === 'gold' ? 'Open boss chest' : 'Open chest', () => openChest(c), c.locked);
    for (const pt of A.portals) cand(pt.x, pt.y + 6, 26, 'Leave dungeon', () => leaveDungeon(false));
  }
  return best;
}
function interact() { const it = findInteract(); if (it) it.act(); }
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(), tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') { if (k === 'escape') e.target.blur(); return; }
  Sfx.unlock();
  if (!G.on || UI.screen !== 'game') { if (k === 'escape') UI.back(); return; }
  if (k === 'escape') { e.preventDefault(); UI.escape(); return; }
  if (UI.modal) {
    if ((k === 'm' && UI.modal === 'mapModal') || ((k === 'b' || k === 'i' || k === 'tab') && UI.modal === 'bagModal')) { e.preventDefault(); UI.closeModal(); }
    return;
  }
  if (G.dead) return;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
  const first = !Input.keys.has(k); Input.keys.add(k);
  if (!first || e.repeat) return;
  if (k === 'f') Input.pressed.add('blockTap');
  if (k === 'c' || k === ' ') Input.pressed.add('dodge');
  else if (k === 'e') interact();
  else if (k === 'q') quickPotion();
  else if (k === 'm') UI.openMap();
  else if (k === 'b' || k === 'i' || k === 'tab') UI.openBag();
  else if (/^[0-9]$/.test(k)) useSlot(k === '0' ? 9 : +k - 1);
});
addEventListener('keyup', (e) => Input.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => Input.clear());
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { Input.mx = e.clientX / VIEW.z; Input.my = e.clientY / VIEW.z; } });
canvas.addEventListener('pointerdown', (e) => {
  Sfx.unlock();
  if (e.pointerType === 'mouse') { if (e.button === 0) { Input.mouseDown = true; Input.mx = e.clientX / VIEW.z; Input.my = e.clientY / VIEW.z; } }
});
addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) Input.mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && !Input.touchMode) { Input.touchMode = true; if (UI.screen === 'game') $('#touch').hidden = false; }
  else if (e.pointerType === 'mouse' && Input.touchMode) { Input.touchMode = false; $('#touch').hidden = true; }
}, true);
(function touchControls() {
  const st = $('#stick'), knob = $('#stick i');
  const moveStick = (e) => { const r = st.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), max = r.width * 0.36; if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; } Input.stick.x = dx / max; Input.stick.y = dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`; };
  st.addEventListener('pointerdown', (e) => { e.preventDefault(); Sfx.unlock(); Input.stick.on = true; Input.stick.id = e.pointerId; st.setPointerCapture(e.pointerId); moveStick(e); });
  st.addEventListener('pointermove', (e) => { if (Input.stick.on && e.pointerId === Input.stick.id) moveStick(e); });
  const end = (e) => { if (e.pointerId !== Input.stick.id) return; Input.stick.on = false; Input.stick.x = Input.stick.y = 0; knob.style.transform = ''; };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  const hold = (id, key) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); Sfx.unlock(); Input[key] = true; if (key === 'tBlock') Input.pressed.add('blockTap'); b.setPointerCapture(e.pointerId); }); for (const ev of ['pointerup', 'pointercancel']) b.addEventListener(ev, () => (Input[key] = false)); };
  hold('#tAtk', 'tAtk'); hold('#tBlk', 'tBlock');
  $('#tDodge').addEventListener('pointerdown', (e) => { e.preventDefault(); Input.pressed.add('dodge'); });
  $('#tE').addEventListener('pointerdown', (e) => { e.preventDefault(); if (!UI.modal && !G.dead) interact(); });
})();

// ---------- saving & session ----------
function snapshotSave() {
  const s = JSON.parse(JSON.stringify(G.save)), P = s.player, p = G.p;
  P.hp = Math.max(1, Math.round(p.hp));
  if (G.dead) { P.x = WORLD.spawn.x; P.y = WORLD.spawn.y; P.hp = maxHpFor(P.level); }
  else if (G.area && G.area.kind === 'overworld') { P.x = Math.round(p.x); P.y = Math.round(p.y); }
  else { const e = WORLD.entrances.find((x) => G.area && x.d === G.area.def); P.x = e ? e.x : WORLD.spawn.x; P.y = e ? e.y + 14 : WORLD.spawn.y; }
  return s;
}
function saveGame(quiet) {
  if (!G.on || !G.save) return;
  G.save.lastSaved = Date.now();
  const s = snapshotSave(); G.save.player.x = s.player.x; G.save.player.y = s.player.y;
  Store.put(s);
  if (!quiet) { UI.toast('Game saved', 'good'); Sfx.play('pickup'); }
}
function startGame(save, resumed) {
  if (!save) { UI.toast('That save could not be found.', 'bad'); return; }
  Sfx.unlock(); UI.closeModal(true);
  G.save = normalizeSave(JSON.parse(JSON.stringify(save)));
  if (!resumed) G.save.lastLoaded = Date.now();
  G.p = makeRuntimePlayer(); G.on = true; G.dead = false; G.time = 0; G.autosaveT = 0; G.zoneT = 0;
  let x = G.p.x, y = G.p.y; if (blockedBox(G.p, x, y, false) || !(x > 0 && y > 0 && x < WORLD.map.w * 16 && y < WORLD.map.h * 16)) { x = WORLD.spawn.x; y = WORLD.spawn.y; }
  G.area = { map: WORLD.map, kind: 'overworld' };
  enterOverworld(x, y);
  Store.put(G.save);
  UI.showScreen('game'); UI.invDirty();
  const fresh = !!G.save.fresh; delete G.save.fresh;
  if (!resumed) UI.toast(fresh ? `Welcome to Emberfall, ${G.save.name}!` : `Welcome back, ${G.save.name}!`, 'gold');
  if (!resumed && fresh) setTimeout(() => G.on && UI.toast('Tip: click the tiny map (top right) to see the dungeons. Talk to people in town with E.'), 1800);
}
function quitToMenu() {
  saveGame(true); UI.closeModal(true); G.on = false; G.dead = false; G.save = null; menuScene(); UI.showScreen('menu');
}
function menuScene() {
  G.area = { kind: 'overworld', map: WORLD.map, props: WORLD.props, npcs: WORLD.npcs, entrances: WORLD.entrances, zones: [], chests: [], torches: [], traps: [], decos: [], portals: [], def: null };
  resetEntities(); G.p = { x: WORLD.spawn.x, y: WORLD.spawn.y };
}

// ---------- main loop ----------
let lastT = performance.now(), menuT = 0, errShown = false;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); lastT = now;
  try {
    if (G.on) {
      const paused = !!UI.modal || G.dead || UI.screen !== 'game';
      if (!paused) updateWorld(dt);
      else { for (const q of G.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; } G.parts = G.parts.filter((q) => q.life > 0); }
      UI.tick(dt); render(); drawMini();
    } else if (G.area) {
      menuT += dt; G.time += dt;
      G.cam.x = 48 * 16 - VIEW.w / 2 + Math.sin(menuT * 0.07) * 260; G.cam.y = 34 * 16 - VIEW.h / 2 + Math.cos(menuT * 0.05) * 160;
      G.cam.x = clamp(G.cam.x, 0, WORLD.map.w * 16 - VIEW.w); G.cam.y = clamp(G.cam.y, 0, WORLD.map.h * 16 - VIEW.h);
      G.p.x = G.cam.x + VIEW.w / 2; G.p.y = G.cam.y + VIEW.h / 2;
      updateNPCs(dt);
      for (const q of G.parts) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; } G.parts = G.parts.filter((q) => q.life > 0);
      for (const pr of G.area.props) if (pr.smoke && chance(dt * 3)) G.parts.push({ x: pr.x + pr.w - 12, y: pr.y - pr.h + 2, vx: rand(-4, 4), vy: -14, life: 1.6, max: 1.6, col: '#8f897c', size: 2, grav: 0 });
      render();
    }
  } catch (err) {
    console.error(err);
    if (!errShown) { errShown = true; UI.toast('Something glitched: ' + (err && err.message), 'bad'); }
  }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => { resize(); if (G.on) snapCam(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { Input.clear(); if (G.on && !UI.modal && !G.dead && UI.screen === 'game') UI.openPause(); if (G.on) saveGame(true); } });
addEventListener('pagehide', () => { if (G.on) saveGame(true); });

// ---------- boot ----------
function boot(hotData) {
  resize();
  WORLD = buildOverworld(); FOUNTAIN = (() => { const f = WORLD.props.find((p) => p.kind === 'fountain'); return f ? { x: f.x + 16, y: f.y - 8 } : null; })();
  bakeMiniBase();
  Store.init(); UI.init();
  menuScene(); UI.showScreen('menu');
  requestAnimationFrame((t) => { lastT = t; frame(t); });
  if (hotData && hotData.save && hotData.save.player) startGame(hotData.save, true);
}
(function start() {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => (G.on && G.save ? { save: snapshotSave() } : {})); } catch (e) {} }
  if (hot && typeof hot.ready === 'function') hot.ready((data) => boot(data || {}));
  else boot((hot && hot.data) || {});
})();
