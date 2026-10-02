
// =====================================================================
// AREAS — moving between maps, dungeons, interactions, villagers' days.
// =====================================================================
function resetEntities() { G.later = []; G.mons = []; G.projs = []; G.picks = []; G.parts = []; G.texts = []; G.fx = []; G.corpses = []; G.traps2 = []; G.clouds = []; G.stains = []; G.bossMon = null; }
function makeRuntimePlayer() {
  const P = S();
  return { x: P.x, y: P.y, w: 9, h: 6, face: 1, aim: 0, walk: 0, moving: false, hp: 1, sta: 100, maxSta: 100, atkCd: 0, atkT: 0, swing: 1,
    dodgeT: 0, dodgeCd: 0, dvx: 0, dvy: 0, blocking: false, blockStart: -9, blockLock: 0, hurtCd: 0, hurtT: 0, kbx: 0, kby: 0, staDelay: 0, webT: 0, slowT: 0,
    poisonT: 0, poisonAcc: 0, blindT: 0, burnCd: 0, cds: [0, 0, 0, 0], cdMax: [1, 1, 1, 1], buffs: {}, dashT: 0, dashHit: [], shieldHp: 0, calm: 0, lying: false, hidden: false, stepT: 0, vx: 0, vy: 0, springMsg: false };
}
function enterMap(id, x, y) {
  resetEntities();
  const Wd = getWorld(id);
  G.area = Object.assign({}, Wd, { kind: Wd.map.kind, id, def: null, chests: [], torches: [], traps: [], decos: [], portals: [], doors: [], notes: Wd.notes.filter((n) => !ST().notes[n.id]).map((n) => Object.assign({}, n)) });
  Wd.map.flowKey = -1;
  S().map = id; if (Wd.map.kind === 'overworld') (ST().visited || (ST().visited = {}))[id] = true; const p = G.p; p.x = x; p.y = y; p.kbx = p.kby = 0; p.vx = p.vy = 0;
  if (blockedBox(p, p.x, p.y, false)) { p.x = Wd.spawn.x; p.y = Wd.spawn.y; }
  Weather.enter(Wd.map.kind === 'overworld' ? id : null);
  if (Wd.map.kind === 'overworld') for (const z of G.area.zones) for (let i = 0; i < z.max; i++) zoneSpawn(z, true);
  if (G.pet) { G.pet.x = p.x - 12; G.pet.y = p.y + 4; }
  snapCam(); UI.areaChanged();
}
function zoneSpawn(z, initial) {
  const map = G.area.map, night = Clock.isNight(), types = night && G.area.nightMons.length ? G.area.nightMons.concat(z.types) : z.types;
  for (let k = 0; k < 20; k++) {
    const tx = randi(z.x0, z.x1), ty = randi(z.y0, z.y1);
    if (solidAt(map, tx, ty) || inTown(tx, ty) || isWaterish(tileAt(map, tx, ty))) continue;
    const x = tx * 16 + 8, y = ty * 16 + 10; if (dist(x, y, G.p.x, G.p.y) < (initial ? 150 : 210)) continue;
    spawnMon(weighted(types), x, y, { zone: z }); return;
  }
}
function enterDungeon(def) {
  const D = buildDungeon(def); resetEntities();
  G.area = Object.assign({ kind: 'dungeon', id: def.id, npcs: [], entrances: [], gates: [], zones: [], nightMons: [], safe: [], spots: [], trees: null, tufts: null, portals: [{ x: D.exit.x, y: D.exit.y, kind: 'exit' }], name: def.name }, D);
  G.run = { key: false };
  const scripted = (def.final && !ST().ending) || def.secret;
  for (const s of D.spawns) spawnMon(s.type, s.x, s.y, { room: s.room, scripted: s.boss && scripted });
  const rq = Quests.rescueFor(def.id);
  if (rq) {
    const rooms = D.rooms.filter((r) => r !== D.start), r = pick(rooms.length ? rooms : [D.start]), m = D.map; let best = [r.cx, r.cy], bd = 1e9;
    for (let ty = r.y + 1; ty < r.y + r.h - 1; ty++) for (let tx = r.x + 1; tx < r.x + r.w - 1; tx++) { const i = ty * m.w + tx, d = Math.hypot(tx - r.cx, ty - r.cy); if (m.t[i] === T.FLOOR && !m.block[i] && d < bd) { bd = d; best = [tx, ty]; } }
    G.area.captive = { x: best[0] * 16 + 8, y: best[1] * 16 + 12, name: rq.name, q: rq, freed: false };
  }
  const p = G.p; p.x = D.entry.x; p.y = D.entry.y; p.kbx = p.kby = 0; p.vx = p.vy = 0;
  Weather.enter(null); if (G.pet) { G.pet.x = p.x - 12; G.pet.y = p.y + 4; }
  snapCam(); UI.areaChanged(); Sfx.play('portal');
  UI.toast(def.name, 'gold big');
  UI.toast(def.mini ? `Beat the ${MON[def.mini].name} to get the boss key.` : 'Something waits at the end.');
}
function tryEnter(def) {
  if (def.secret && !ST().flags.mirrorOpen) { UI.toast("A cracked mirror. Your reflection doesn't move when you do...", 'bad'); return false; }
  if (def.act > ST().act) { UI.toast(def.final ? 'Wraithmoor Tomb is sealed shut by four seals in the far lands.' : 'This place is sealed for now.', 'bad'); Sfx.play('error'); return false; }
  if (S().level < def.lvl) { UI.toast(`${def.name} needs level ${def.lvl}. You are level ${S().level}.`, 'bad'); Sfx.play('error'); return false; }
  saveGame(true); enterDungeon(def); return true;
}
function leaveDungeon(toTown) {
  const def = G.area.def, Wd = getWorld(def.map), e = Wd.entrances.find((x) => x.d === def);
  if (toTown || !e) { const v = getWorld('vale'); enterMap('vale', v.spawn.x, v.spawn.y); } else enterMap(def.map, e.x, e.y + 14);
  Sfx.play('portal'); saveGame(true);
}
function respawn() {
  G.dead = false; const p = G.p; p.hp = PS().maxHp; p.sta = p.maxSta; p.poisonT = p.slowT = 0; p.hidden = false;
  const v = getWorld('vale'); enterMap('vale', v.spawn.x, v.spawn.y); saveGame(true);
}
let gateMsgT = 0;
function checkGates(dt) {
  gateMsgT -= dt;
  const A = G.area, p = G.p, tx = Math.floor(p.x / 16), ty = Math.floor(p.y / 16);
  if (A.kind === 'interior') { if (p.y > (A.map.h - 1) * 16 - 2) { const v = getWorld('vale'); enterMap('vale', v.homeDoor.x, v.homeDoor.y + 14); Sfx.play('st_wood'); } return; }
  if (A.kind !== 'overworld') return;
  for (const g of A.gates) {
    if (tx < g.x0 || tx > g.x1 || ty < g.y0 || ty > g.y1) continue;
    if (A.id === 'vale' && ST().act < 2) {
      const cx = A.map.w * 8, cy = A.map.h * 8, d = dist(cx, cy, p.x, p.y) || 1; p.x += ((cx - p.x) / d) * 14; p.y += ((cy - p.y) / d) * 14;
      if (gateMsgT <= 0) { gateMsgT = 3; UI.toast('The road is closed. Too dangerous out there. (Beat the Ashen Forge first.)', 'bad'); }
      return;
    }
    enterMap(g.to, g.tx * 16 + 8, g.ty * 16 + 8); const R = REGIONS[g.to];
    UI.toast(R.name.toUpperCase(), 'gold big'); if (R.lvl) UI.toast(`Monsters here are around level ${R.lvl}.`, S().level < R.lvl - 1 ? 'bad' : '');
    saveGame(true); return;
  }
}
// ---------- interactions (E) ----------
function findInteract() {
  const p = G.p, A = G.area; if (!A || !G.on || Story.active()) return null; let best = null, bd = 1e9;
  const cand = (x, y, r, label, act, locked) => { const d = dist(p.x, p.y, x, y); if (d < r && d < bd) { bd = d; best = { label, act, locked }; } };
  for (const n of A.notes || []) if (!n.got) cand(n.x, n.y, 22, 'Pick up a note', () => { n.got = true; Story.collect(n.id); });
  if (A.kind === 'overworld') {
    for (const e of A.entrances) {
      const d = e.d, ok = S().level >= d.lvl && d.act <= ST().act && (!d.secret || ST().flags.mirrorOpen);
      const lab = d.secret && !ST().flags.mirrorOpen ? 'A cracked mirror' : d.act > ST().act ? `${d.name}: sealed` : ok ? `Enter ${d.name} (Lv ${d.lvl})` : `${d.name}: needs level ${d.lvl}`;
      cand(e.x, e.y, 28, lab, () => tryEnter(d), !ok);
    }
    for (const n of A.npcs) if (!n.hidden) cand(n.x, n.y, 26, n.shop ? `Talk to ${n.name}` : `Talk to ${n.name}`, () => UI.talk(n));
    if (A.homeDoor) cand(A.homeDoor.x, A.homeDoor.y + 4, 22, 'Enter your house', () => { enterMap('home', getWorld('home').spawn.x, getWorld('home').spawn.y); Sfx.play('st_wood'); });
    for (const s of A.spots || []) if (s.kind === 'dadgrave') cand(s.x, s.y, 24, "Read Dad's gravestone", () => { if (!ST().notes.n25) Story.collect('n25'); else UI.showNote('n25'); });
  } else if (A.kind === 'interior') {
    for (const s of A.spots) {
      if (s.kind === 'bed') cand(s.x, s.y, 22, 'Sleep in your bed', trySleep);
      if (s.kind === 'finnbed') cand(s.x, s.y, 22, "Finn's bed", () => UI.toast("Finn's bed. The blanket is still cold.", ''));
      if (s.kind === 'table') cand(s.x, s.y, 24, "Read Finn's note again", () => UI.showNote('n0'));
    }
  } else {
    for (const c of A.chests) if (!c.open) cand(c.x, c.y - 4, 26, c.locked ? 'Locked: defeat the boss' : c.kind === 'gold' ? 'Open boss chest' : 'Open chest', () => openChest(c), c.locked);
    for (const pt of A.portals) cand(pt.x, pt.y + 6, 26, 'Leave dungeon', () => leaveDungeon(false));
    for (const d of A.doors) if (!d.open) {
      const x = d.tx * 16 + 8, y = d.ty * 16 + 10;
      if (d.kind === 'key') cand(x, y, 28, G.run.key ? 'Unlock the door with the boss key' : `Locked: the ${MON[A.def.mini].name} has the key`, () => { if (!G.run.key) { Sfx.play('error'); return; } d.open = true; A.map.block[d.ty * A.map.w + d.tx] = 0; A.map.flowKey = -1; Sfx.play('unlock'); UI.toast('The door opens. A healing spring lies beyond.', 'good'); }, !G.run.key);
      else cand(x, y, 28, 'The gate is shut. Find the lever.', () => { Sfx.play('error'); }, true);
    }
    const lv = A.lever; if (lv && !lv.pulled) cand(lv.x, lv.y + 6, 26, 'Pull the lever', () => { lv.pulled = true; const g = A.doors.find((d) => d.kind === 'gate'); g.open = true; A.map.block[g.ty * A.map.w + g.tx] = 0; A.map.flowKey = -1; Sfx.play('lever'); later(0.3, () => { Sfx.play('gate'); shake(5); }); UI.toast('Somewhere close, a heavy gate grinds open...', 'gold'); });
    const cp = A.captive; if (cp && !cp.freed) cand(cp.x, cp.y, 26, `Untie ${cp.name}`, () => { cp.freed = true; cp.q.freed = true; cp.leaveT = 1.5; Sfx.play('quest'); UI.toast(`${cp.name}: "Thank you! I'll find my way out." Tell ${NPC_NAMES[cp.q.giver]}.`, 'good'); });
  }
  return best;
}
function interact() { const it = findInteract(); if (it) it.act(); }
SCENES.sleep = [['fade', 'out', 0.7], ['call', 'doSleep'], ['fade', 'in', 0.9]];
CUT_FN.doSleep = () => {
  const t = G.save.world.time; const mins = t >= 18 * 60 ? 1440 - t + 360 : 360 - t; Clock.advance(mins);
  G.p.hp = PS().maxHp; G.p.sta = G.p.maxSta; G.p.poisonT = 0; saveGame(true); UI.toast(`You slept until morning. Day ${G.save.world.day}.`, 'good');
};
function trySleep() {
  const h = Clock.hour(); if (h < 18 && h >= 5) { UI.toast("You're not tired yet. You can sleep after 18:00.", ''); return; }
  Story.play('sleep');
}
// ---------- the dungeon wing & story triggers each frame ----------
function areaTick(dt) {
  const A = G.area, p = G.p;
  if (A.kind === 'dungeon') {
    if (tileAt(A.map, Math.floor(p.x / 16), Math.floor(p.y / 16)) === T.SPRING) {
      const mx = PS().maxHp; if (p.hp < mx || p.sta < p.maxSta) { p.hp = Math.min(mx, p.hp + mx * 0.3 * dt); p.sta = Math.min(p.maxSta, p.sta + 60 * dt); UI.hudDirty(); if (chance(dt * 14)) G.parts.push({ x: p.x + rand(-6, 6), y: p.y - rand(0, 18), vx: 0, vy: -24, life: 0.6, max: 0.6, col: '#9ff0ff', size: 1, grav: 0 }); }
      if (!p.springMsg) { p.springMsg = true; UI.toast('The spring water heals you completely.', 'good'); Sfx.play('heal'); }
    }
    if (!A.bossEntered && inRoomPx(p.x, p.y, A.boss)) { A.bossEntered = true; Story.enterBossRoom(); }
    if (A.captive && A.captive.freed && A.captive.leaveT > 0) { A.captive.leaveT -= dt; if (A.captive.leaveT <= 0) { burst(A.captive.x, A.captive.y - 10, 16, '#efe4cc', 50); A.captive = null; } }
  }
  if (A.kind === 'overworld') {
    G.zoneT -= dt;
    if (G.zoneT <= 0) { G.zoneT = 4; const night = Clock.isNight(); for (const z of A.zones) { const n = G.mons.filter((m) => m.zone === z).length; if (n < z.max + (night ? 2 : 0)) zoneSpawn(z, false); } }
    if (!Clock.isNight()) for (const m of G.mons) if (m.d.night && !m.aggro && !m.dead) { m.fadeOut = (m.fadeOut || 0) + dt; if (m.fadeOut > 1.5) { m.dead = true; burst(m.x, m.y - 10, 12, '#6a6c72', 40); } }
  }
}
// ---------- villagers: routines and little animations ----------
function updateNPCs(dt) {
  const A = G.area, p = G.p, night = G.save ? Clock.isNight() : false;
  const npcs = A.npcs || [];
  for (const n of npcs) {
    n.blinkT -= dt; if (n.blinkT <= 0) { n.blink = 0.12; n.blinkT = rand(2.5, 5.5); } n.blink = Math.max(0, (n.blink || 0) - dt);
    n.breatheT += dt; n.waveCd = (n.waveCd || 0) - dt; n.poseT = (n.poseT + dt / (n.job === 'hammer' ? 1.1 : 0.8)) % 1;
    // go home at night, come back at dawn
    if (n.door && night && !n.hidden) { n.tx = n.door[0]; n.ty = n.door[1] + 6; if (dist(n.x, n.y, n.tx, n.ty) < 6) { n.hidden = true; } }
    else if (n.door && !night && n.hidden) { n.hidden = false; n.x = n.door[0]; n.y = n.door[1] + 8; n.tx = n.x; n.ty = n.y + 20; }
    if (n.hidden) continue;
    // jobs
    if (n.job === 'hammer' && !night) { n.pose = 'hammer'; const prev = n.lastHit || 0; if (n.poseT >= 0.55 && prev < 0.55) { Sfx.play('hammer', { x: n.x, y: n.y, range: 260 }); for (let i = 0; i < 5; i++) G.parts.push({ x: n.x + 18, y: n.y - 8, vx: rand(-40, 40), vy: rand(-70, -20), life: 0.35, max: 0.35, col: '#ffd27a', size: 1, grav: 200 }); } n.lastHit = n.poseT; }
    else if (n.job === 'work' && !night) n.pose = Math.sin(n.breatheT * 0.4) > 0.3 ? 'work' : null;
    else if (n.waveT > 0) { n.waveT -= dt; n.pose = 'wave'; } else n.pose = null;
    if (!n.job && n.waveCd <= 0 && dist(n.x, n.y, p.x, p.y) < 42 && !n.moving && G.on) { n.waveT = 1.3; n.waveCd = 14; }
    // wandering
    n.wait -= dt;
    if (!night || !n.door) if (n.wait <= 0 && n.wander > 0 && !n.chatT) { n.wait = rand(2, 6); for (let k = 0; k < 8; k++) { const tx = n.home[0] + rand(-n.wander, n.wander), ty = n.home[1] + rand(-n.wander * 0.6, n.wander * 0.6); if (!blockedBox({ w: 8, h: 6 }, tx, ty, false) && (!A.safe.length || inTownPx(tx, ty))) { n.tx = tx; n.ty = ty; break; } } }
    const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
    if (d > 2 && !n.chatT && !(n.waveT > 0)) { const e = { x: n.x, y: n.y, w: 8, h: 6 }; if (moveEntity(e, (dx / d) * 28 * dt, (dy / d) * 28 * dt, false) && d < 40) { n.tx = n.x; n.ty = n.y; } n.x = e.x; n.y = e.y; n.moving = true; n.walk += dt * 8; n.face = dx < 0 ? -1 : 1; }
    else { n.moving = false; if (dist(n.x, n.y, p.x, p.y) < 60 && !n.chatT && n.job !== 'hammer') n.face = p.x < n.x ? -1 : 1; }
    // two idle villagers next to each other start chatting
    if (n.chatT > 0) { n.chatT -= dt; if (n.chatT <= 0) { n.chatT = 0; n.chatWith = null; } }
    else if (n.wander && !n.moving && chance(dt * 0.3)) {
      const o = npcs.find((m) => m !== n && m.wander && !m.hidden && !m.chatT && !m.moving && dist(m.x, m.y, n.x, n.y) < 34);
      if (o) { n.chatT = o.chatT = rand(4, 7); n.chatWith = o; o.chatWith = n; n.face = o.x < n.x ? -1 : 1; o.face = -n.face; }
    }
    if (n.chatT > 0 && chance(dt * 0.8)) { n.bubble = pick(['...', '!', '?', 'HA HA', '*']); n.bubbleT = 1.2; if (dist(n.x, n.y, p.x, p.y) < 120) Sfx.voice('cackle', 1.6, { x: n.x, y: n.y }); }
    n.bubbleT = Math.max(0, (n.bubbleT || 0) - dt);
  }
}
