// =====================================================================
// MAIN — loading, input (keyboard, mouse, touch), starting and loading
// games, the title-screen flyover, music by place, and the frame loop.
// =====================================================================
const TOUCH = { on: false, mx: 0, my: 0, sprint: false, block: false, atkHeld: false, bowHeld: false, look: null };
// ---------- starting, loading, quitting ----------
function clearWorldState() {
  for (const a of ACTORS.slice()) removeActor(a); ACTORS.length = 0; G.horse = null;
  Gore.clearAll(); clearProjs(); Clues.clear(); LATER.length = 0; for (const F of G.tmpFires.slice()) removeTmpFire(F);
  Story.spawned = {}; Story.trail = []; Hud.boss(null); SENSE.on = false; G.cine = false; G.slowmo = 1; G.slowT = 0; G.hitstop = 0;
}
function migrateSave(s) {
  const P = s.player; P.skills = P.skills || {}; P.muts = P.muts || []; P.trophies = P.trophies || {}; P.camps = P.camps || ['ashford']; P.stats = P.stats || {}; P.eq = Object.assign({ sword: 'rusty_sword', bow: null, shield: null, armor: 'traveler', arrow: 'arrow' }, P.eq || {});
  P.inv = P.inv.filter((e) => ITEMS[e.id] && e.n > 0); if (!ITEMS[P.eq.sword]) P.eq.sword = 'rusty_sword'; if (!ITEMS[P.eq.armor]) P.eq.armor = 'traveler';
  s.surv = Object.assign({ hunger: 75, fatigue: 25, warmth: 70, warmT: 0, owlT: 0 }, s.surv || {}); s.contracts = Object.assign({ board: [], active: [], day: 0, done: 0, slain: [] }, s.contracts || {});
  s.story = Object.assign({ step: 'arrive', flags: {}, trail: 0, endings: [] }, s.story); s.story.flags = s.story.flags || {}; s.story.endings = s.story.endings || []; if (!MAIN_IDX.hasOwnProperty(s.story.step)) s.story.step = 'arrive';
  s.horse = s.horse || { x: START.x, z: START.z, yaw: 0, name: 'Ash' }; s.herbs = s.herbs || {}; s.playTime = s.playTime || 0; if (!DIFF[s.diff]) s.diff = 'normal';
  return s;
}
function startGame(save, isNew) {
  UI.closeScreen(); if (UI.modalOpen) { UI.modalOpen = false; $('#modal').hidden = true; } UI.dlg = null; UI.chooser = null; $('#dialog').hidden = true; $('#letterbox').hidden = true;
  clearWorldState(); G.save = migrateSave(save); save.lastLoaded = Date.now(); delete save.deleted; G.outPos = null;
  const P = save.player; let area = P.area && Interiors.defs[P.area] ? P.area : 'outside';
  G.area = area; Interiors.root.visible = area !== 'outside'; WORLD.root.visible = area === 'outside'; Sky.mesh.visible = area === 'outside';
  if (area !== 'outside') { const I = Interiors.defs[area]; if (Math.abs(P.pos.x - I.x) > 60) P.pos = { x: I.x + I.spawn[0], y: I.y, z: I.z + I.spawn[1], yaw: I.spawn[2] }; }
  G.p = makePlayer(save); const p = G.p; if (area === 'outside') { collideCircle(p, P_R, p.y, 1.6); p.y = floorAt(p.x, p.z, p.y + 2); }
  // the horse
  const H = save.horse; G.horse = makeActor('horse', 'horse', H.x, H.z, { rig: buildQuad('horse', 0x4a3020, 1), stam: 100 }); G.horse.yaw = H.yaw || 0;
  spawnPeople();
  for (const h of WORLD.herbs) setHerbPicked(h, !!(save.herbs[h.id] && Clock.W().day - save.herbs[h.id] < 2)); G.herbDay = Clock.W().day;
  if (save.gate) openGate('snap'); else closeGate();
  Interiors.dirty = true; Story.setup(); Contracts.restore(); Contracts.refresh();
  Body.rebuild(); VM.rebuild(); refreshStats(); Weather.set(isNew ? 'rain' : pick(['clear', 'cloudy', 'clear', 'fog']), true); Weather.next = rand(150, 300);
  CAM.third = false; G.on = true; G.saveT = 0; G.p.pitch = -0.05; Monsters.spawnT = isNew ? 30 : 4;
  $('#hud').hidden = false; $('#touch').hidden = !TOUCH.on; Music.set(null);
  if (H.mounted && area === 'outside') { G.horse.x = p.x; G.horse.z = p.z; G.horse.y = p.y; G.horse.yaw = p.yaw; mountHorse(G.horse); }
  updateTrees(p.x, p.z, true); updateGrass(p.x, p.z, true); updateGroundLOD(p.x, p.z);
  if (area !== 'outside' && Interiors.cur()) { Music.set(Interiors.cur().music); if (area === 'castle' && !save.story.flags.lordDead && Story.step() === 'choice') Story.hall(); }
  if (isNew) { G.cine = true; later(0.6, () => { G.cine = false; UI.dialog(TALKS.opening, () => { UI.toast('Ride into Ashford and find Captain Hale. Press E to talk.', 'gold'); }); }); }
  else UI.toast('Welcome back, ' + P.name + '. ' + Clock.label(), 'small');
  Store.put(save); UI.lock();
}
function closeGate() { const g = CASTLE.gate; if (!g) return; g.open = false; g.col.off = false; g.mesh.position.y = g.y; for (let i = ANIM.length - 1; i >= 0; i--) if (ANIM[i].kind === 'lift') ANIM.splice(i, 1); }
function loadGame(id) { const s = Store.get(id); if (!s) { UI.toast('That save is gone.'); return UI.title(); } UI.fade(() => startGame(JSON.parse(JSON.stringify(s)))); }
function quitToMenu() { G.on = false; clearWorldState(); G.p = null; G.save = null; G.area = 'outside'; Interiors.root.visible = false; WORLD.root.visible = true; Sky.mesh.visible = true; UI.unlock(); UI.title(); if (Body.rig) { scene.remove(Body.rig.root); Body.rig = null; } if (VM.root) { vmScene.remove(VM.root); VM.root = null; } }
// ---------- input ----------
const ACTION_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyF', 'Space']);
function togglePauseTab(tab) { if (UI.modalOpen && UI.tabs && UI.tabs.some((t) => t[0] === tab)) { if (UI.tab === tab) UI.closeModal(); else UI.showTab(tab); } else if (!UI.blocking() && G.on) UI.pause(tab); }
addEventListener('keydown', (e) => {
  AU.unlock(); const k = e.code;
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown'].includes(k) && !(e.target && e.target.tagName === 'INPUT')) e.preventDefault();
  if (e.target && e.target.tagName === 'INPUT') { if (k === 'Escape') e.target.blur(); return; }
  if (UI.dlg) { if (!e.repeat && (k === 'KeyE' || k === 'Space' || k === 'Enter' || k === 'Escape')) UI.dlgAdvance(); return; }
  if (UI.chooser) { const n = parseInt(e.key, 10); if (n >= 1 && n <= UI.chooser.length) UI.pickChoice(n - 1); return; }
  if (k === 'Escape') return UI.escape();
  if (!G.on || !G.p) return;
  if (k === 'Tab' || k === 'KeyI') return togglePauseTab('inv'); if (k === 'KeyM') return togglePauseTab('map'); if (k === 'KeyJ') return togglePauseTab('journal'); if (k === 'KeyK') return togglePauseTab('skills');
  if (UI.blocking()) return;
  if (ACTION_KEYS.has(k)) KEYS[k] = true;
  if (e.repeat) return;
  switch (k) {
    case 'KeyE': doInteract(); break; case 'KeyQ': quickPotion(); break; case 'Digit1': eatBest(); break; case 'Digit2': cycleArrows(); break;
    case 'Digit3': castSpell('fire'); break; case 'Digit4': castSpell('lightning'); break; case 'Digit5': castSpell('ice'); break;
    case 'KeyR': hunterSense(); break; case 'KeyH': whistle(); break; case 'KeyV': CAM.third = !CAM.third; break; case 'KeyC': playerDodge(); break; case 'Space': playerJump(); break;
    case 'ControlLeft': case 'ControlRight': case 'KeyZ': if (!G.p.mounted && !G.p.swim) G.p.crouch = !G.p.crouch; break;
  }
});
addEventListener('keyup', (e) => { KEYS[e.code] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; MOUSE.l = MOUSE.r = false; });
const CV = () => $('#gl');
addEventListener('mousedown', (e) => {
  AU.unlock(); if (e.target !== CV() || TOUCH.on) return;
  if (UI.dlg) return UI.dlgAdvance();
  if (!G.on || UI.blocking()) return;
  if (!MOUSE.locked) { UI.lock(); return; }
  if (e.button === 0) { MOUSE.l = true; playerAttack(); } else if (e.button === 2) MOUSE.r = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) MOUSE.l = false; else if (e.button === 2) MOUSE.r = false; });
addEventListener('mousemove', (e) => { if (MOUSE.locked) { MOUSE.dx += e.movementX || 0; MOUSE.dy += e.movementY || 0; } });
addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('pointerlockchange', () => { MOUSE.locked = document.pointerLockElement === CV(); if (!MOUSE.locked) { MOUSE.l = MOUSE.r = false; for (const k in KEYS) KEYS[k] = false; if (G.on && !UI.blocking() && G.p && !G.p.dead) UI.pause(); } });
// ---------- touch ----------
function enableTouch() {
  if (TOUCH.on) return; TOUCH.on = true; document.body.classList.add('touch'); if (G.on) $('#touch').hidden = false;
  const st = $('#stick'), knob = $('#stick i'); let sid = null, cx = 0, cy = 0;
  st.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = st.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; st.setPointerCapture(sid); mv(e); e.preventDefault(); });
  const mv = (e) => { if (e.pointerId !== sid) return; let dx = (e.clientX - cx) / 55, dy = (e.clientY - cy) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } TOUCH.mx = dx; TOUCH.my = -dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; };
  st.addEventListener('pointermove', mv); const up = (e) => { if (e.pointerId !== sid) return; sid = null; TOUCH.mx = TOUCH.my = 0; knob.style.transform = ''; }; st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  // look by dragging anywhere else
  const cv = CV(); let lid = null, lx = 0, ly = 0;
  cv.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch' || lid != null) return; if (UI.dlg) return UI.dlgAdvance(); lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
  cv.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; MOUSE.dx += (e.clientX - lx) * 2.2; MOUSE.dy += (e.clientY - ly) * 2.2; lx = e.clientX; ly = e.clientY; });
  const lup = (e) => { if (e.pointerId === lid) lid = null; }; cv.addEventListener('pointerup', lup); cv.addEventListener('pointercancel', lup);
  const act = { atk: () => playerAttack(), dodge: playerDodge, jump: playerJump, use: doInteract, potion: quickPotion, fire: () => castSpell('fire'), lightning: () => castSpell('lightning'), ice: () => castSpell('ice'), sense: hunterSense, menu: () => (UI.modalOpen ? UI.closeModal() : UI.pause()), map: () => togglePauseTab('map'), cam: () => (CAM.third = !CAM.third), horse: whistle, eat: eatBest, crouch: () => { if (G.p && !G.p.mounted) G.p.crouch = !G.p.crouch; }, sprint: () => { TOUCH.sprint = !TOUCH.sprint; } };
  $$('#touch button').forEach((b) => {
    const t = b.dataset.t;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); AU.unlock(); if (UI.dlg && t !== 'menu') return UI.dlgAdvance(); if (!G.on) return; if (t === 'block') TOUCH.block = true; else if (t === 'bow') TOUCH.bowHeld = true; else if (t === 'atk') { TOUCH.atkHeld = true; act.atk(); } else if (act[t] && (!UI.blocking() || t === 'menu' || t === 'map')) act[t](); b.classList.add('on'); if (t === 'sprint') b.classList.toggle('on', TOUCH.sprint); });
    const rel = () => { if (t === 'block') TOUCH.block = false; if (t === 'bow') TOUCH.bowHeld = false; if (t === 'atk') TOUCH.atkHeld = false; if (t !== 'sprint') b.classList.remove('on'); };
    b.addEventListener('pointerup', rel); b.addEventListener('pointercancel', rel); b.addEventListener('pointerleave', rel);
  });
}
addEventListener('touchstart', () => enableTouch(), { once: true, passive: true });
addEventListener('pointerdown', () => AU.unlock(), { passive: true });
// ---------- music and ambience by place ----------
const MOOD = { fightT: 0, envT: 0 };
function pickMood(dt) {
  const p = G.p; if (!p) return; if (G.cine || UI.screenName === 'ending' || UI.screenName === 'credits') return;
  const fighting = ACTORS.some((a) => a.aggro && !a.dead && !a.passive && a.kind === 'monster' && a.d.family !== 'animal' && Math.hypot(a.x - p.x, a.z - p.z) < (a.d.boss ? 120 : 45));
  if (fighting) MOOD.fightT = 6; else MOOD.fightT -= dt;
  if (p.dead) return Music.set('sad');
  const night = Clock.isNight(), bm = Clock.bloodMoon();
  if (MOOD.fightT > 0) return Music.set(bm || (Hud.bossA && Hud.bossA.d.model === 'demon') ? 'blood' : 'fight');
  if (G.area !== 'outside') { const I = Interiors.cur(); return Music.set(I ? I.music : 'dark'); }
  if (bm) return Music.set('dark');
  const near = (k, r) => Math.hypot(PLACES[k].x - p.x, PLACES[k].z - p.z) < r;
  if (near('castle', 120)) return Music.set('castle'); if (near('shrine', 90) || near('graveyard', 80) || near('swamp', 190)) return Music.set('dark');
  if (inTown(p.x, p.z)) return Music.set(night ? 'night' : 'town');
  Music.set(night ? 'night' : 'wild');
}
function updateAmbience(dt) {
  MOOD.envT -= dt; const p = G.p; if (!p) return;
  const inside = G.area !== 'outside', rain = Weather.rainK(), night = Clock.isNight();
  if (MOOD.envT <= 0) {
    MOOD.envT = 0.5; let river = 0, fire = 0;
    if (!inside) { const [vd] = bucketDist(RIVER_BK, p.x, p.z); river = clamp(1 - vd / 45, 0, 1); for (const f of WORLD.fires || []) fire = Math.max(fire, clamp(1 - Math.hypot(f.x - p.x, f.z - p.z) / 14, 0, 1)); for (const f of G.tmpFires) fire = Math.max(fire, clamp(1 - Math.hypot(f.x - p.x, f.z - p.z) / 10, 0, 1)); }
    const trees = inside ? 0 : forestAt(p.x, p.z);
    MOOD.env = { inside, area: G.area, night, rain: rain > 0.2, blood: Clock.bloodMoon(), trees, town: !inside && inTown(p.x, p.z), cold: p.y > 100, swamp: !inside && Math.hypot(PLACES.swamp.x - p.x, PLACES.swamp.z - p.z) < 200 };
    if (inside) Amb.set({ cave: G.area === 'shrine' ? 1 : 0.25, fire: G.area === 'home' ? 0.6 : G.area === 'castle' ? 0.3 : 0.2 });
    else Amb.set({ wind: 0.25 + Weather.wind * 0.8 + (p.y > 90 ? 0.5 : 0), leaves: trees * (0.3 + Weather.wind), rain: rain * 1.2, river: river * 0.9, fire: fire, town: MOOD.env.town && !night ? 0.35 : 0 });
  }
  if (MOOD.env) Amb.tick(dt, MOOD.env);
}
// ---------- the title screen flyover ----------
const MENU_CAM = { a: 0.6 };
function menuFrame(dt) {
  MENU_CAM.a += dt * 0.025; const A = PLACES.ashford, r = 190, x = A.x + Math.cos(MENU_CAM.a) * r, z = A.z + Math.sin(MENU_CAM.a) * r, y = Math.max(heightAt(x, z) + 25, 55);
  camera.position.set(x, y, z); camera.lookAt(A.x, 22, A.z); camera.fov = 60; camera.updateProjectionMatrix();
  const W = Clock.W(); W.min += dt * 2; if (W.min > 19.4 * 60) W.min = 17 * 60;
  G.time += dt; Weather.tick(dt); updateWorldAround(dt, camera.position); updateSkyAndLight(dt, camera.position); RainFX.update(dt, Weather.rainK(), false);
  renderer.clear(); renderer.render(scene, camera);
}
function updateWorldAround(dt, f) {
  if (G.area !== 'outside') return; updateGroundLOD(f.x, f.z); updateTrees(f.x, f.z); updateGrass(f.x, f.z); updateWater(dt); updateAnims(dt, G.time);
}
// ---------- one frame ----------
let lastT = 0;
const _focus = new THREE.Vector3();
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000 || 0.016)); lastT = now;
  if (!G.worldReady) return;
  try {
    if (AU.ctx) Music.tick();
    UI.dlgTick(rdt);
    if (CREATOR.on) return CREATOR.render(rdt);
    if (!G.on) return menuFrame(rdt);
    const p = G.p, paused = UI.blocking() && !(G.cine && !UI.dlg && !UI.chooser && !UI.screenName);
    let dt = rdt;
    if (G.slowT > 0) { G.slowT -= rdt; if (G.slowT <= 0) G.slowmo = 1; } dt *= G.slowmo;
    if (G.hitstop > 0) { G.hitstop -= rdt; dt *= 0.08; }
    if (!paused) {
      G.time += dt; G.save.playTime += rdt; runLater();
      const mins = dt * Clock.rate; Clock.tick(dt); Survival.tick(dt, mins); updateTmpFires(mins); Weather.tick(dt);
      updatePlayer(dt); if (!G.cine) { updateActors(dt); Monsters.update(dt); } else for (const a of ACTORS) if (a.rig) { a.t += dt; a.anim.t = a.t; animate(a.rig, a.anim, dt); }
      Story.update(dt); updateProjs(dt); Gore.update(dt); updateBolts(dt); updateSense(dt);
      G.tick1 = (G.tick1 || 0) - rdt; if (G.tick1 <= 0) { G.tick1 = 1; Contracts.update(); const c = G.area === 'outside' && nearCamp(); if (c && !G.save.player.camps.includes(c.id)) { G.save.player.camps.push(c.id); UI.toast('Camp found: ' + c.name + '. Rest here and fast travel between camps.', 'gold'); Sfx.play('quest'); } if (Clock.W().day !== G.herbDay) { G.herbDay = Clock.W().day; for (const h of WORLD.herbs) if (h.picked && G.save.herbs[h.id] && G.herbDay - G.save.herbs[h.id] >= 2) { setHerbPicked(h, false); delete G.save.herbs[h.id]; } Contracts.refresh(); } }
      G.saveT = (G.saveT || 0) + rdt; if (G.saveT > 180 && !UI.blocking() && !p.dead) autosave();
      if (p.dead && p.deadT > 2.2 && !UI.screenName && !G.deathShown) { G.deathShown = true; }
    }
    updateCamera(rdt);
    _focus.set(p.x, p.y, p.z); updateWorldAround(rdt, _focus); updateLights(rdt, camera.position.x, camera.position.y, camera.position.z);
    RainFX.update(rdt, Weather.rainK(), Weather.snowHere());
    updateSkyAndLight(paused ? 0 : dt, _focus);
    if (G.area !== 'outside') { sunLight.intensity = 0; const sh = G.area === 'shrine'; hemiLight.color.setRGB(sh ? 0.5 : 0.55, sh ? 0.2 : 0.42, sh ? 0.15 : 0.32); hemiLight.groundColor.setRGB(0.12, 0.08, 0.06); hemiLight.intensity = sh ? 0.5 : 0.42; ambLight.intensity = 0.1; scene.fog.color.setRGB(sh ? 0.06 : 0.03, 0.02, 0.015); renderer.toneMappingExposure = 1.3; vmSun.intensity = 0.5; vmSun.color.setRGB(1, 0.75, 0.5); vmHemi.intensity = 0.5; }
    if (G.save.surv.owlT > 0) { renderer.toneMappingExposure *= 1 + Clock.dark() * 1.4; hemiLight.intensity += Clock.dark() * 0.5; }
    if (!paused) { pickMood(rdt); updateAmbience(rdt); }
    Hud.update(rdt);
    renderer.clear(); renderer.render(scene, camera);
    if (VM.root && VM.root.visible) { renderer.clearDepth(); renderer.render(vmScene, vmCamera); }
  } catch (e) { console.error(e); G.lastError = String(e && e.stack || e); }
}
// ---------- boot ----------
function bootStep(steps, i, done) {
  if (i >= steps.length) return done();
  const [label, fn] = steps[i]; $('#loadText').textContent = label + '…'; $('#loadBar').style.width = ((i / steps.length) * 100).toFixed(0) + '%';
  setTimeout(() => { try { fn(); } catch (e) { console.error(e); $('#loadText').textContent = 'Something broke while ' + label.toLowerCase() + ': ' + e.message; return; } bootStep(steps, i + 1, done); }, 30);
}
function boot(hot) {
  G.tmpFires = [];
  bootStep([
    ['Painting textures', makeTextures], ['Mixing materials', makeMaterials], ['Shaping the valley', genTerrain], ['Lighting the sky', initRenderer],
    ['Laying the ground', () => { WORLD.root = new THREE.Group(); scene.add(WORLD.root); buildGround(); buildWater(); }],
    ['Growing the forests', () => { buildTreeTypes(); placeTrees(); }], ['Scattering rocks', buildRocksAndBushes], ['Growing grass', buildGrass], ['Planting herbs', buildHerbs],
    ['Building Ashford and the castle', () => { buildLightPool(); buildPlaces(); }], ['Digging the shrine', () => { Interiors.build(); RainFX.init(); Gore.init(); }], ['Drawing the map', MAPIMG],
  ], 0, () => {
    $('#loadBar').style.width = '100%'; Store.init(); G.worldReady = true; $('#loading').hidden = true; vmCamera.fov = 58;
    if (hot && hot.save && hot.save.player) startGame(migrateSave(hot.save)); else UI.title();
  });
  requestAnimationFrame((t) => { lastT = t; frame(t); });
}
(function start() {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => (G.on && G.save && !G.save.deleted && G.p && !G.p.dead ? { save: snapshotSave() } : {})); } catch (e) {} }
  const go = (data) => { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => boot(data)); else boot(data); };
  if (hot && typeof hot.ready === 'function') hot.ready((data) => go(data || {})); else go((hot && hot.data) || {});
})();
