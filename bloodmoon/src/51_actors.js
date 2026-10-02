
// =====================================================================
// ACTORS — monsters, wildlife, townsfolk and your horse: spawning,
// thinking, moving and dying.
// =====================================================================
const ACTORS = [];
let actorId = 1;
const TOWN_SAFE = 95; // monsters stay out of Ashford (except on the blood moon)
function inTown(x, z) { return Math.hypot(x - PLACES.ashford.x, z - PLACES.ashford.z) < TOWN_SAFE; }
function makeActor(kind, type, x, z, o = {}) {
  const d = kind === 'monster' ? MON[type] : null;
  const rig = o.rig || (kind === 'monster' ? buildMonsterModel(type) : null);
  const a = Object.assign({ id: actorId++, kind, type, d, rig, x, z, y: floorAt(x, z), yaw: rand(0, TAU), vx: 0, vz: 0, vy: 0, hp: 1, maxHp: 1, t: rand(0, 10), state: 'idle', stateT: rand(1, 4), anim: { speed: 0, phase: 0, attack: -1, t: 0 }, r: 0.45, h: 1.8, dead: false, deadT: 0, atkCd: rand(0.5, 1.5), burn: 0, slow: 0, stun: 0, fly: 0 }, o);
  if (d) {
    const blood = Clock.bloodMoon() && !d.boss && d.family !== 'animal' ? BLOOD_MUL : 1, df = G.save ? DIFF[G.save.diff] : DIFF.normal, lv = G.save ? 1 + (G.save.player.level - 1) * 0.04 : 1;
    a.maxHp = a.hp = Math.round(d.hp * blood * (d.family === 'animal' ? 1 : df.hp * lv) * (o.big || 1)); a.dmg = d.dmg * blood * (o.big ? 1.3 : 1) * lv; a.speed = d.speed;
    a.r = (d.model === 'troll' ? 0.9 : d.model === 'wyvern' ? 1.2 : d.model === 'deer' ? 0.5 : d.model === 'rabbit' || d.model === 'crow' ? 0.2 : d.model === 'wolf' ? 0.45 : 0.45) * d.size * (o.big || 1);
    a.h = rig.height || 1.8; a.blood = blood > 1;
    if (o.big) rig.root.scale.multiplyScalar(o.big);
    if (a.blood) tintBlood(rig);
    if (d.fly) { a.fly = 1; a.alt = rand(8, 14); }
  }
  if (rig) { rig.root.position.set(x, a.y, z); scene.add(rig.root); rig.root.traverse((m) => { if (m.isMesh) m.userData.actor = a; }); }
  ACTORS.push(a); return a;
}
function tintBlood(rig) { // blood-moon monsters: darker red hide and burning eyes
  rig.root.traverse((m) => { if (!m.isMesh || !m.material || m.material.emissiveIntensity > 1) return; m.material = m.material.clone(); m.material.color.lerp(new THREE.Color(0x5a0808), 0.45); m.material.emissive = new THREE.Color(0x200000); });
}
function removeActor(a) { if (a.rig) scene.remove(a.rig.root); const i = ACTORS.indexOf(a); if (i >= 0) ACTORS.splice(i, 1); }
function actorCenter(a) { return [a.x, a.y + a.h * (a.d && a.d.model === 'wolf' ? 0.45 : 0.55) + (a.fly ? a.alt || 0 : 0), a.z]; }
// ---------- spawning ----------
const Monsters = {
  spawnT: 0,
  nightChange() { for (const a of ACTORS) if (a.kind === 'monster' && !a.story && !a.contract && a.d && (a.d.night || a.d.bloodOnly) && !Clock.isNight() && distP(a) > 30) a.fadeOut = 2; },
  update(dt) {
    if (G.area !== 'outside' || !G.p) return;
    this.spawnT -= dt; if (this.spawnT > 0) return; this.spawnT = 2.5;
    const p = G.p, night = Clock.isNight(), blood = Clock.bloodMoon();
    // forget far-away things
    for (const a of ACTORS.slice()) if ((a.kind === 'monster') && !a.story && !a.contract && Math.hypot(a.x - p.x, a.z - p.z) > 340) removeActor(a);
    const count = ACTORS.filter((a) => a.kind === 'monster' && !a.dead).length; if (count > (SET.quality === 'low' ? 18 : 30)) return;
    for (const Z of ZONES) {
      const dz = Math.hypot(Z.x - p.x, Z.z - p.z); if (dz > Z.r + 220) continue;
      const here = ACTORS.filter((a) => a.zone === Z && !a.dead).length, max = Z.max + (night ? 1 : 0) + (blood ? 3 : 0);
      if (here >= max) continue;
      const list = (night ? Z.night : Z.day).slice(); if (blood) list.push(['ghoul', 2], ['werewolf', 1]);
      const type = weighted(list), d = MON[type];
      for (let k = 0; k < 10; k++) {
        const ang = rand(0, TAU), rr = Math.sqrt(Math.random()) * Z.r, x = Z.x + Math.cos(ang) * rr, z = Z.z + Math.sin(ang) * rr;
        const dp = Math.hypot(x - p.x, z - p.z); if (dp < 55 || dp > 260) continue;
        if (inTown(x, z) || Math.abs(x) > HALF - 30 || Math.abs(z) > HALF - 30) continue;
        const wd = waterDepthAt(x, z); if (type === 'drowner' ? wd < 0.2 && waterLevelAt(x + 10, z) < -1e8 : wd > 0.4) continue;
        if (slopeAt(x, z) > 0.8) continue;
        const n = d.pack ? randi(d.pack[0], d.pack[1]) : 1;
        for (let i = 0; i < n; i++) makeActor('monster', type, x + rand(-4, 4), z + rand(-4, 4), { zone: Z });
        break;
      }
    }
    if (blood && chance(0.08) && !ACTORS.some((a) => a.type === 'blood_fiend' && !a.dead)) { const ang = rand(0, TAU); const x = p.x + Math.cos(ang) * 120, z = p.z + Math.sin(ang) * 120; if (!inTown(x, z) && Math.abs(x) < HALF - 40 && Math.abs(z) < HALF - 40) { makeActor('monster', 'blood_fiend', x, z, {}); UI.toast('Something huge is hunting you tonight.', 'blood'); } }
  },
};
const distP = (a) => (G.p ? Math.hypot(a.x - G.p.x, a.z - G.p.z) : 1e9);
// ---------- moving on the ground ----------
function stepActor(a, mx, mz, dt) {
  const nx = a.x + mx * dt, nz = a.z + mz * dt;
  // stay out of deep water unless you live there
  const wd = waterDepthAt(nx, nz); if (wd > 1.1 && !(a.d && a.d.family === 'drowned') && !a.fly) { a.blocked = (a.blocked || 0) + dt; return false; }
  a.x = nx; a.z = nz; collideCircle(a, a.r, a.y, a.h);
  a.x = clamp(a.x, -HALF + 5, HALF - 5); a.z = clamp(a.z, -HALF + 5, HALF - 5);
  return true;
}
function faceTo(a, tx, tz, dt, rate = 8) { const want = Math.atan2(tx - a.x, tz - a.z); a.yaw += clamp(angDiff(a.yaw, want), -rate * dt, rate * dt); }
// ---------- the per-frame update ----------
function updateActors(dt) {
  const p = G.p;
  for (let i = ACTORS.length - 1; i >= 0; i--) {
    const a = ACTORS[i]; a.t += dt; a.anim.t = a.t;
    if (a.dead) { a.deadT += dt; a.anim.dead = a.deadT * 1.6; animate(a.rig, a.anim, dt); if (a.fly && a.y > floorAt(a.x, a.z)) { a.vy -= 20 * dt; a.y = Math.max(floorAt(a.x, a.z), a.y + a.vy * dt); a.rig.root.position.y = a.y; } if (a.deadT > (a.d && a.d.boss ? 600 : 90)) removeActor(a); continue; }
    if (a.fadeOut) { a.fadeOut -= dt; if (a.fadeOut <= 0) { Gore.smoke(a.x, a.y + 1, a.z); removeActor(a); continue; } }
    if (a.burn > 0) { a.burn -= dt; a.burnAcc = (a.burnAcc || 0) + dt; if (a.burnAcc > 0.5) { a.burnAcc = 0; damageActor(a, 5 + a.maxHp * 0.01, { dot: true, fire: true }); } if (chance(0.5)) Gore.ember(a.x, a.y + a.h * rand(0.3, 0.9), a.z); }
    a.slow = Math.max(0, a.slow - dt); a.stun = Math.max(0, a.stun - dt); a.atkCd -= dt; a.hitT = Math.max(0, (a.hitT || 0) - dt);
    const far = distP(a);
    if (far > 160 && a.kind !== 'npc' && a.kind !== 'horse') { if (a.rig) a.rig.root.visible = far < 260; continue; } // too far to think about
    if (a.rig) a.rig.root.visible = true;
    if (a.kind === 'monster') { if (a.d.family === 'animal') thinkAnimal(a, dt); else if (a.fly) thinkFlyer(a, dt); else thinkMonster(a, dt); }
    else if (a.kind === 'npc') thinkNPC(a, dt);
    else if (a.kind === 'horse') thinkHorse(a, dt);
    if (!a.fly && !(G.p && G.p.mounted === a)) a.y = damp(a.y, floorAt(a.x, a.z, a.y + 1) - (a.swim ? 1.1 : 0), 18, dt);
    if (a.rig) { a.rig.root.position.set(a.x, a.y + (a.fly ? a.alt || 0 : 0), a.z); a.rig.root.rotation.y = a.yaw; animate(a.rig, a.anim, dt); if (a.hitT > 0) a.rig.root.position.x += Math.sin(a.t * 70) * 0.03; }
  }
}
// ---------- hostile monsters ----------
function thinkMonster(a, dt) {
  const p = G.p, d = a.d, dx = p.x - a.x, dz = p.z - a.z, dist = Math.hypot(dx, dz), blood = Clock.bloodMoon();
  if (a.passive) { a.anim.speed = 0; a.anim.attack = -1; faceTo(a, p.x, p.z, dt, 2); return; }
  const sight = (Clock.isNight() ? 28 : 36) * (blood ? 1.6 : 1) * (p.crouch ? 0.6 : 1) * (d.boss ? 2 : 1);
  const spd = a.speed * (a.slow > 0 ? 0.45 : 1) * (a.stun > 0 ? 0 : 1);
  a.anim.speed = 0; a.anim.attack = a.atkT > 0 ? 1 - a.atkT / a.atkDur : -1;
  if (a.atkT > 0) { // mid-attack
    a.atkT -= dt; faceTo(a, p.x, p.z, dt, 3);
    if (!a.struck && a.atkT <= a.atkDur * 0.45) { a.struck = true; monsterStrike(a); }
    if (a.leap) { stepActor(a, a.leap[0], a.leap[1], dt); }
    if (a.atkT <= 0) { a.leap = null; a.atkCd = rand(0.6, 1.4) * (blood ? 0.75 : 1); }
    a.anim.phase += dt * 6; return;
  }
  if (a.stun > 0) return;
  const townBlock = inTown(p.x, p.z) && !blood && !a.story;
  if (!a.aggro && dist < sight && !p.dead && !townBlock && G.on) { a.aggro = true; Sfx.voice(d.voice, rand(0.9, 1.1) * (d.size > 1.5 ? 0.75 : 1), { x: a.x, y: a.y + 1, z: a.z }); if (d.boss) Hud.boss(a); }
  if (a.aggro && (dist > sight * 2.2 || p.dead || townBlock) && !a.story) a.aggro = false;
  if (!a.aggro) { wander(a, dt, spd * 0.35); return; }
  // special moves
  if (a.atkCd <= 0 && !p.dead) {
    if (d.model === 'werewolf' && dist > 5 && dist < 11 && chance(0.6)) return startAttack(a, 0.75, 'leap');
    if (d.blink && dist > 4 && dist < 22 && chance(0.25)) { const ang = Math.atan2(-dx, -dz) + rand(-1, 1); a.x = p.x + Math.sin(ang) * 2.5; a.z = p.z + Math.cos(ang) * 2.5; Gore.smoke(a.x, a.y + 1, a.z); Sfx.voice('hiss', 1.2, { x: a.x, y: a.y, z: a.z }); a.atkCd = 0.3; }
    if (d.model === 'troll' && dist < 6 && chance(0.35)) return startAttack(a, 1.1, 'slam');
    if (d.model === 'lord' && dist > 6 && chance(0.4)) return startAttack(a, 0.8, 'bolt');
    if (d.model === 'demon' && dist < 14 && chance(0.35)) return startAttack(a, 1.2, dist < 6 ? 'slam' : 'breath');
    if (d.model === 'demon' && chance(0.08) && ACTORS.filter((m) => m.summoned && !m.dead).length < 4) { for (let i = 0; i < 2; i++) { const s = makeActor('monster', 'ghoul', a.x + rand(-5, 5), a.z + rand(-5, 5), { story: true, summoned: true, aggro: true }); Gore.smoke(s.x, s.y + 1, s.z); } a.atkCd = 1.5; }
    if (dist < d.reach + 0.6) return startAttack(a, d.model === 'troll' ? 0.95 : d.boss ? 0.6 : 0.5, 'melee');
  }
  // chase (wolves and ghouls circle a bit before they bite)
  let tx = p.x, tz = p.z;
  if ((d.model === 'wolf' || d.model === 'ghoul') && dist < 7 && a.atkCd > 0) { const side = (a.id % 2 ? 1 : -1), ang = Math.atan2(a.x - p.x, a.z - p.z) + side * 0.9; tx = p.x + Math.sin(ang) * 4; tz = p.z + Math.cos(ang) * 4; }
  if (dist > d.reach * 0.8) { const ddx = tx - a.x, ddz = tz - a.z, l = Math.hypot(ddx, ddz) || 1; faceTo(a, tx, tz, dt); const sp = spd * (blood ? 1.15 : 1); stepActor(a, (ddx / l) * sp, (ddz / l) * sp, dt); a.anim.speed = sp; a.anim.phase += dt * sp * 1.6; }
  else faceTo(a, p.x, p.z, dt);
  if (d.regen && a.hp < a.maxHp) a.hp = Math.min(a.maxHp, a.hp + d.regen * dt * (Clock.isNight() ? 1 : 0.5));
}
function startAttack(a, dur, kind) {
  a.atkT = a.atkDur = dur; a.struck = false; a.atkKind = kind; a.anim.atkKind = a.d.model === 'troll' ? 'club' : 'claw';
  if (kind === 'leap') { const p = G.p, dx = p.x - a.x, dz = p.z - a.z, l = Math.hypot(dx, dz) || 1; a.leap = [(dx / l) * 14, (dz / l) * 14]; Sfx.voice('snarl', 0.9, { x: a.x, y: a.y, z: a.z }); }
  if (kind === 'slam' || kind === 'breath') Sfx.voice(a.d.voice, 0.8, { x: a.x, y: a.y + 1, z: a.z });
}
function monsterStrike(a) {
  const p = G.p, d = a.d, [cx, cy, cz] = actorCenter(a), dist = Math.hypot(p.x - a.x, p.z - a.z);
  if (a.atkKind === 'slam') { Gore.ring(a.x, a.y, a.z, 6, 0xb0a080); Sfx.play('boom', { x: a.x, y: a.y, z: a.z, vol: 0.7 }); shakeCam(0.5); if (dist < 6.5) hurtPlayer(a.dmg * 1.3, a, { knock: 8, unblockable: dist < 2.5 }); return; }
  if (a.atkKind === 'bolt') { fireProj({ from: a, x: cx, y: cy + 0.4, z: cz, tx: p.x, ty: p.y + 1.4, tz: p.z, speed: 26, dmg: a.dmg * 0.8, kind: 'blood', grav: 0 }); return; }
  if (a.atkKind === 'breath') { for (let i = 0; i < 9; i++) later(i * 0.06, () => fireProj({ from: a, x: cx, y: cy + 1, z: cz, tx: p.x + rand(-1.5, 1.5), ty: p.y + 1, tz: p.z + rand(-1.5, 1.5), speed: 22, dmg: a.dmg * 0.3, kind: 'demonfire', grav: 0 })); return; }
  if (a.atkKind === 'spit') { fireProj({ from: a, x: cx, y: cy, z: cz, tx: p.x, ty: p.y + 1.2, tz: p.z, speed: 24, dmg: a.dmg * 0.7, kind: 'poison', grav: 4 }); return; }
  const reach = d.reach + 0.9 + (a.atkKind === 'leap' ? 1 : 0), ang = Math.abs(angDiff(a.yaw, Math.atan2(p.x - a.x, p.z - a.z)));
  Sfx.play(d.model === 'troll' ? 'swing_heavy' : 'swing', { x: a.x, y: a.y + 1, z: a.z, vol: 0.8 });
  if (dist < reach && ang < 1.3 && Math.abs(p.y - a.y) < 2.5) hurtPlayer(a.dmg, a, { knock: d.model === 'troll' ? 7 : 3, poison: d.model === 'drowner' && chance(0.2) });
}
function wander(a, dt, spd) {
  a.stateT -= dt;
  if (a.stateT <= 0) { a.stateT = rand(2, 6); if (chance(0.6)) { const Z = a.zone, ang = rand(0, TAU), r = rand(5, 18); a.wx = (Z ? lerp(a.x, Z.x, 0.2) : a.x) + Math.sin(ang) * r; a.wz = (Z ? lerp(a.z, Z.z, 0.2) : a.z) + Math.cos(ang) * r; } else a.wx = null; }
  if (a.wx != null) { const dx = a.wx - a.x, dz = a.wz - a.z, l = Math.hypot(dx, dz); if (l < 1 || (a.blocked > 1)) { a.wx = null; a.blocked = 0; return; } if (inTown(a.wx, a.wz) && a.kind === 'monster') { a.wx = null; return; } faceTo(a, a.wx, a.wz, dt, 3); stepActor(a, (dx / l) * spd, (dz / l) * spd, dt); a.anim.speed = spd; a.anim.phase += dt * spd * 2; }
}
// ---------- wildlife ----------
function thinkAnimal(a, dt) {
  const p = G.p, d = a.d, dist = distP(a), spook = (d.model === 'crow' ? 9 : d.model === 'rabbit' ? 11 : 26) * (p.crouch ? 0.55 : 1) * (p.mounted ? 0.8 : 1);
  a.anim.speed = 0; a.anim.graze = false;
  if (d.model === 'crow') {
    if (a.flying) { a.alt = (a.alt || 0) + dt * 6; a.x += Math.sin(a.yaw) * 8 * dt; a.z += Math.cos(a.yaw) * 8 * dt; a.anim.air = true; a.fly = 1; if (a.alt > 40) removeActor(a); return; }
    if (dist < spook || a.hitT > 0) { a.flying = true; a.yaw = Math.atan2(a.x - p.x, a.z - p.z) + rand(-0.6, 0.6); Sfx.voice('caw', rand(0.9, 1.2), { x: a.x, y: a.y, z: a.z }); for (const o of ACTORS) if (o !== a && o.type === 'crow' && Math.hypot(o.x - a.x, o.z - a.z) < 12) o.hitT = 0.01; return; }
    a.stateT -= dt; if (a.stateT <= 0) { a.stateT = rand(0.5, 2); a.yaw += rand(-1, 1); if (chance(0.4)) a.hopping = 0.3; } if (a.hopping > 0) { a.hopping -= dt; stepActor(a, Math.sin(a.yaw) * 1.5, Math.cos(a.yaw) * 1.5, dt); }
    return;
  }
  if (a.fleeT > 0 || dist < spook) {
    if (dist < spook && !(a.fleeT > 0)) { a.fleeT = rand(4, 7); if (chance(0.5)) Sfx.voice(d.voice, rand(0.9, 1.2), { x: a.x, y: a.y, z: a.z }); for (const o of ACTORS) if (o !== a && o.type === a.type && !o.dead && Math.hypot(o.x - a.x, o.z - a.z) < 20) o.fleeT = rand(3, 6); }
    a.fleeT -= dt; const ax = a.x - p.x, az = a.z - p.z, l = Math.hypot(ax, az) || 1, ang = Math.atan2(ax / l, az / l) + Math.sin(a.t * 1.3) * 0.5;
    const sp = d.speed * (a.slow > 0 ? 0.4 : 1); a.yaw += clamp(angDiff(a.yaw, ang), -5 * dt, 5 * dt);
    if (!stepActor(a, Math.sin(a.yaw) * sp, Math.cos(a.yaw) * sp, dt)) a.yaw += 1.5;
    a.anim.speed = sp; a.anim.phase += dt * sp * (d.model === 'rabbit' ? 2.4 : 1.4); a.anim.hop = d.model === 'rabbit'; return;
  }
  a.stateT -= dt;
  if (a.stateT <= 0) { a.stateT = rand(2, 7); a.grazing = chance(0.55); if (!a.grazing) { const ang = rand(0, TAU); a.wx = a.x + Math.sin(ang) * 8; a.wz = a.z + Math.cos(ang) * 8; } }
  if (a.grazing) { a.anim.graze = true; return; }
  if (a.wx != null) { const dx = a.wx - a.x, dz = a.wz - a.z, l = Math.hypot(dx, dz); if (l < 0.8) { a.wx = null; return; } faceTo(a, a.wx, a.wz, dt, 2); stepActor(a, (dx / l) * 1.3, (dz / l) * 1.3, dt); a.anim.speed = 1.3; a.anim.phase += dt * 3; a.anim.hop = d.model === 'rabbit'; }
}
// ---------- flying monsters (wyverns) ----------
function thinkFlyer(a, dt) {
  const p = G.p, d = a.d, dx = p.x - a.x, dz = p.z - a.z, dist = Math.hypot(dx, dz);
  a.anim.air = a.alt > 0.5; a.anim.attack = a.atkT > 0 ? 1 - a.atkT / a.atkDur : -1;
  if (a.grounded > 0) { a.grounded -= dt; a.alt = Math.max(0, a.alt - dt * 8); if (a.grounded <= 0) Sfx.voice('screech', 0.8, { x: a.x, y: a.y, z: a.z }); thinkMonsterGround(a, dt); return; }
  if (!a.aggro && dist < 55 && G.on && !p.dead) { a.aggro = true; Sfx.voice('screech', 1, { x: a.x, y: a.y + a.alt, z: a.z }); if (d.boss) Hud.boss(a); }
  if (a.atkT > 0) { a.atkT -= dt; if (!a.struck && a.atkT < a.atkDur * 0.5) { a.struck = true; monsterStrike(a); } if (a.atkKind === 'dive') { a.alt = Math.max(0.6, a.alt - dt * 22); stepActor(a, Math.sin(a.yaw) * 16, Math.cos(a.yaw) * 16, dt); } if (a.atkT <= 0) a.atkCd = rand(1.5, 3); return; }
  if (!a.aggro) { a.circle = (a.circle || 0) + dt * 0.3; a.x += Math.sin(a.circle) * 6 * dt; a.z += Math.cos(a.circle) * 6 * dt; a.yaw = a.circle + Math.PI / 2; a.alt = damp(a.alt, 14, 0.5, dt); a.anim.speed = 6; return; }
  const want = dist > 30 ? 12 : 8; a.alt = damp(a.alt, want, 1, dt);
  const ring = Math.atan2(a.x - p.x, a.z - p.z) + dt * 0.5, rr = 16, tx = p.x + Math.sin(ring) * rr, tz = p.z + Math.cos(ring) * rr;
  faceTo(a, tx, tz, dt, 2); a.x += Math.sin(a.yaw) * d.speed * dt; a.z += Math.cos(a.yaw) * d.speed * dt; a.anim.speed = d.speed;
  if (a.atkCd <= 0) { faceTo(a, p.x, p.z, 1, 99); if (chance(0.5)) { a.atkT = a.atkDur = 1.3; a.atkKind = 'dive'; a.struck = false; Sfx.voice('screech', 1.1, { x: a.x, y: a.y + a.alt, z: a.z }); } else { a.atkT = a.atkDur = 0.7; a.atkKind = 'spit'; a.struck = false; } }
}
function thinkMonsterGround(a, dt) { const fly = a.fly; a.fly = 0; thinkMonster(a, dt); a.fly = fly; }
// ---------- townsfolk ----------
function thinkNPC(a, dt) {
  const p = G.p, night = Clock.isNight(), h = Clock.hour();
  a.anim.speed = 0; a.anim.attack = a.job === 'hammer' && !night ? (a.t * 0.9) % 1 : -1;
  if (a.anim.attack >= 0 && Math.abs(a.anim.attack - 0.45) < dt * 0.9 && distP(a) < 40) { Sfx.play('hammer', { x: a.x, y: a.y + 1, z: a.z, range: 45 }); Gore.sparks(a.x + Math.sin(a.yaw) * 0.8, a.y + 0.9, a.z + Math.cos(a.yaw) * 0.8); }
  const near = distP(a) < 4 && !p.dead;
  if (near || a.talking) { faceTo(a, p.x, p.z, dt, 4); a.anim.look = 0; return; }
  // the day: wander near work by day, go home at night
  const goal = night && a.home ? a.home : a.work || [a.x, a.z];
  if (night && a.home && Math.hypot(a.x - a.home[0], a.z - a.home[1]) < 1.5) { a.indoors = true; if (a.rig) a.rig.root.visible = false; return; }
  a.indoors = false; if (a.rig) a.rig.root.visible = true;
  a.stateT -= dt;
  if (a.stateT <= 0) { a.stateT = rand(3, 9); if (a.job === 'hammer' && !night) { a.wx = null; } else { const r = night ? 0 : a.roam || 6; a.wx = goal[0] + rand(-r, r); a.wz = goal[1] + rand(-r, r); } }
  if (a.wx != null) { const dx = a.wx - a.x, dz = a.wz - a.z, l = Math.hypot(dx, dz); if (l < 0.6) { a.wx = null; return; } faceTo(a, a.wx, a.wz, dt, 4); stepActor(a, (dx / l) * 1.4, (dz / l) * 1.4, dt); a.anim.speed = 1.4; a.anim.phase += dt * 1.4 * 3.4; }
}
// ---------- your horse ----------
function thinkHorse(a, dt) {
  const p = G.p;
  if (p.mounted === a) { a.anim.speed = p.horseSpeed; a.anim.phase += dt * Math.max(1, p.horseSpeed) * 1.3; return; }
  a.anim.speed = 0; a.anim.graze = false;
  if (a.called) {
    const dx = p.x - a.x, dz = p.z - a.z, l = Math.hypot(dx, dz);
    if (l < 3.2 || a.calledT > 25) { a.called = false; }
    else { a.calledT = (a.calledT || 0) + dt; const sp = l > 30 ? 14 : 7; faceTo(a, p.x, p.z, dt, 3); if (!stepActor(a, Math.sin(a.yaw) * sp, Math.cos(a.yaw) * sp, dt)) a.yaw += 0.8; a.anim.speed = sp; a.anim.phase += dt * sp * 1.3; if (l > 160) { const ang = rand(0, TAU); a.x = p.x + Math.sin(ang) * 60; a.z = p.z + Math.cos(ang) * 60; } }
    return;
  }
  a.stateT -= dt; if (a.stateT <= 0) { a.stateT = rand(4, 10); a.grazing = chance(0.7); if (chance(0.3)) Sfx.play('snort', { x: a.x, y: a.y + 1.5, z: a.z }); }
  a.anim.graze = a.grazing;
}
