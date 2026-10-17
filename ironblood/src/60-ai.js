
// ---------- moving fighters around the world ----------
const BODY_R = 0.36;
function collideFighter(f) {
  const p = f.pos;
  for (const c of circles) {
    const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + BODY_R, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) { const d = Math.sqrt(d2) || 1e-4; p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr; }
  }
  for (const s of segs) {
    if (s.h0 !== undefined && (p.y > s.h1 || p.y + 1.8 < s.h0)) continue;
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const t = Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.z - s.az) * dz) / (dx * dx + dz * dz)));
    const cx = s.ax + dx * t, cz = s.az + dz * t, ox = p.x - cx, oz = p.z - cz, d = Math.hypot(ox, oz);
    if (d < BODY_R) {
      if (d > 1e-4) { p.x = cx + ox / d * BODY_R; p.z = cz + oz / d * BODY_R; }
      else { const len = Math.hypot(dx, dz); p.x = cx - dz / len * BODY_R; p.z = cz + dx / len * BODY_R; }
    }
  }
  // walls, houses, ruins: push out of oriented boxes you're not standing on top of
  for (const b of boxes) {
    if (p.y > b.h1 - 0.3 || p.y + 1.8 < b.h0) continue;
    const dx = p.x - b.cx, dz = p.z - b.cz, u = dx * b.c - dz * b.s, v = dx * b.s + dz * b.c;
    const ou = b.hw + BODY_R - Math.abs(u), ov = b.hd + BODY_R - Math.abs(v);
    if (ou > 0 && ov > 0) {
      let nu = u, nv = v;
      if (ou < ov) nu = Math.sign(u || 1) * (b.hw + BODY_R); else nv = Math.sign(v || 1) * (b.hd + BODY_R);
      p.x = b.cx + nu * b.c + nv * b.s; p.z = b.cz - nu * b.s + nv * b.c;
    }
  }
  // bodies push each other apart (living, standing ones)
  for (const o of fighters) {
    if (o === f || !o.alive || o.down || f.down || o.inside) continue;
    const dx = p.x - o.pos.x, dz = p.z - o.pos.z, d = Math.hypot(dx, dz), rr = BODY_R * 2;
    if (d < rr && d > 1e-4) { const push = (rr - d) * 0.5; p.x += dx / d * push; p.z += dz / d * push; }
  }
  const lim = HALF - 8;
  p.x = Math.max(-lim, Math.min(lim, p.x)); p.z = Math.max(-lim, Math.min(lim, p.z));
}
function angleLerp(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
function stepFighter(f, dt, wish, speed, face, turnRate = 10) {
  if (f.down) return;
  const inWater = f.pos.y < WATER_Y - 0.15;
  let target = speed * (inWater ? 0.55 : 1);
  if (f.dodge > 0) {
    f.vel.x = f.dodgeDir.x * 7.2 * (f.dodge / 0.45 + 0.3); f.vel.z = f.dodgeDir.z * 7.2 * (f.dodge / 0.45 + 0.3);
  } else {
    const acc = f.grounded ? 11 : 2.5;
    f.vel.x += (wish.x * target - f.vel.x) * Math.min(1, acc * dt);
    f.vel.z += (wish.z * target - f.vel.z) * Math.min(1, acc * dt);
  }
  f.pos.x += f.vel.x * dt; f.pos.z += f.vel.z * dt;
  collideFighter(f);
  const g = groundH(f.pos.x, f.pos.z);
  if (f.grounded) {
    if (f.pos.y - g > 0.35) { f.grounded = false; f.vy = 0; } else f.pos.y = g;
  }
  if (!f.grounded) {
    f.vy -= 17 * dt; f.pos.y += f.vy * dt;
    if (f.pos.y <= g) { f.pos.y = g; f.vy = 0; f.grounded = true; f.onLand && f.onLand(); sfx.step(f.pos, 'dirt', true, 1.4); }
  }
  f.speed = Math.hypot(f.vel.x, f.vel.z);
  if (face !== null && face !== undefined) f.facing = angleLerp(f.facing, face, Math.min(1, turnRate * dt));
  f.root.rotation.y = f.facing;
  const fx = Math.sin(f.facing), fz = Math.cos(f.facing);
  f.moveBack = f.speed > 0.3 && (f.vel.x * fx + f.vel.z * fz) / f.speed < -0.35;
}
// stamina, bleeding, timers shared by everyone
function tickVitals(f, dt) {
  if (f.stagger > 0) f.stagger -= dt;
  if (f.recoil > 0) f.recoil -= dt;
  if (f.dodge > 0) f.dodge -= dt;
  if (f.painT > 0) f.painT -= dt;
  f.staminaDelay -= dt;
  if (f.staminaDelay <= 0) f.stamina = Math.min(100, f.stamina + dt * (f.blocking ? 10 : 24));
  f.heatTimer += dt;
  if (f.heatTimer > 5) f.heat = Math.max(0, f.heat - dt * 0.4);
  if (!f.alive) return;
  if (f.bleed > 0) {
    f.hp -= f.bleed * dt * (f.isPlayer ? 0.22 : 0.3);
    // small wounds slowly clot; stumps keep pumping
    if (f.severed.length === 0) f.bleed = Math.max(0, f.bleed - dt * 0.08);
    if (Math.random() < Math.min(0.9, f.bleed * 0.08) && settings.gore > 0) {
      const p = f.b.Spine1.getWorldPosition(new THREE.Vector3());
      gore.blood(p, null, 1, 0.3);
    }
    if (f.hp <= 0) f.die(null, 'bled out');
  }
}

// ---------- enemy knights ----------
const HOUSES = [
  { name: 'Red', cloth: 0x7a1717 }, { name: 'Blue', cloth: 0x1a2f6e }, { name: 'Green', cloth: 0x1e4d25 }, { name: 'Gold', cloth: 0x8a6a1a }, { name: 'Black', cloth: 0x222222 },
];
const CAMPS = CAMP_SPOTS.map((c, i) => ({ ...c, house: HOUSES[i % HOUSES.length], members: [], respawn: 0 }));
const TIER_LOOK = [
  { metal: 0x7f8286, rough: 0.55, leather: 0x4a3426, body: 0x5a4a3a, swords: ['arming', 'falchion'] },
  { metal: 0x9da3aa, rough: 0.4, leather: 0x3d2a1e, body: 0x4a3c30, swords: ['falchion', 'longsword', 'arming'] },
  { metal: 0xb9bec4, rough: 0.27, leather: 0x2e2018, body: 0x3a3028, swords: ['longsword', 'claymore'] },
];
let attackTokens = 0;
function spawnKnight(camp, at) {
  const r = Math.random(), tier = r < 0.5 ? 0 : r < 0.84 ? 1 : 2;
  const L = TIER_LOOK[tier];
  const sword = SWORDS.find(s => s.id === L.swords[Math.floor(Math.random() * L.swords.length)]);
  const f = new Fighter({ tier, metal: L.metal, rough: L.rough, cloth: camp.house.cloth, leather: L.leather, body: L.body, sword });
  const a = Math.random() * 6.28, d = 2.5 + Math.random() * 4, c0 = at || camp;
  f.pos.set(c0.x + Math.cos(a) * d, terrainH(c0.x, c0.z), c0.z + Math.sin(a) * d);
  collideFighter(f);
  f.pos.y = groundH(f.pos.x, f.pos.z);
  f.facing = Math.random() * 6.28;
  f.voicePitch = 0.85 + Math.random() * 0.3;
  f.name = camp.house.name + ' ' + TIER[tier].name;
  f.houseName = camp.house.name;
  // what's on him: a coin purse (copper) and the gear you can strip and sell
  f.purse = [8 + Math.floor(Math.random() * 18), 15 + Math.floor(Math.random() * 30), 40 + Math.floor(Math.random() * 70)][tier];
  f.loot = [['Dented kettle hat', 14], ['Mail shirt', 40], ['Plate harness', 110]][tier];
  f.ai = { state: 'patrol', camp, wait: Math.random() * 3, tx: f.pos.x, tz: f.pos.z, alert: false, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: 0, cd: 1 + Math.random(), blockT: 0, courage: Math.random(), shouted: false, react: 0, crawlT: 0 };
  if (!at) camp.members.push(f);
  return f;
}
function alertNear(f, who) {
  for (const o of fighters) if (o.ai && o.alive && !o.ai.alert && o.pos.distanceTo(f.pos) < 22) { o.ai.alert = true; o.ai.react = 0.3 + Math.random() * 0.6; }
}
const _wish = new THREE.Vector3();
// the nearest enemy this fighter can see (you, your allies, villagers, knights)
function pickTarget(f) {
  let best = null, bd = 1e9;
  for (const o of fighters) {
    if (!o.alive || o.inside || !hostile(f, o)) continue;
    const d = o.pos.distanceTo(f.pos) * (o.isPlayer ? 0.8 : 1) * (o.down ? 1.6 : 1);
    if (d < bd && d < 40) { bd = d; best = o; }
  }
  return best;
}
function updateKnight(f, dt) {
  const ai = f.ai;
  if (!f.alive) return;
  ai.pickT = (ai.pickT || 0) - dt;
  if (ai.pickT <= 0 || !ai.target || !ai.target.alive || ai.target.inside) { ai.pickT = 0.6 + Math.random() * 0.4; ai.target = pickTarget(f); }
  const P = ai.target || player;
  // allies with nothing to fight follow you
  if (ai.follow && (!ai.target || ai.target.pos.distanceTo(f.pos) > 22) && !f.down) {
    ai.alert = false;
    const d = _wish.copy(player.pos).sub(f.pos).setY(0), dist = d.length();
    const w = new THREE.Vector3(); let sp = 0;
    if (dist > 3) { w.copy(d).normalize(); sp = dist > 9 ? 5.5 : dist > 5 ? 3.5 : 1.6; }
    stepFighter(f, dt, w, sp * f.legMult, dist > 0.5 ? Math.atan2(d.x, d.z) : f.facing, 7);
    return;
  }
  // lost a leg: crawl away, face down, sobbing
  if (f.down) {
    ai.crawlT += dt;
    const away = _wish.copy(f.pos).sub(P.pos).setY(0).normalize();
    const want = Math.atan2(away.x, away.z);
    f.facing = angleLerp(f.facing, want, dt * 1.5);
    f.root.rotation.y = f.facing;
    const sp = 0.32 * (0.6 + 0.4 * Math.sin(ai.crawlT * 4));
    f.pos.x += Math.sin(f.facing) * sp * dt; f.pos.z += Math.cos(f.facing) * sp * dt;
    collideFighter(f);
    f.updateFall(dt);
    if (Math.random() < dt * 0.4) sfx.voice(f.pos, 'hurt', (f.voicePitch || 1) * 1.1);
    if (settings.gore > 0 && Math.random() < dt * 3) gore.stain(f.pos.x, groundH(f.pos.x, f.pos.z) + 0.013, f.pos.z, 0.15 + Math.random() * 0.15);
    return;
  }
  const toP = _wish.copy(P.pos).sub(f.pos).setY(0);
  const dist = toP.length(); toP.normalize();
  const faceP = Math.atan2(toP.x, toP.z);
  const fwd = { x: Math.sin(f.facing), z: Math.cos(f.facing) };
  // noticing you: sight cone, close range, or getting hit
  if (!ai.alert && ai.target && P.alive) {
    const inCone = (fwd.x * toP.x + fwd.z * toP.z) > Math.cos(1.0);
    if ((dist < 28 && inCone) || dist < 7 || (f.lastHitBy && f.lastHitBy.alive)) { ai.alert = true; ai.react = 0.25 + Math.random() * 0.4; }
  }
  if (ai.alert && !ai.shouted && ai.react <= 0) { ai.shouted = true; sfx.voice(f.pos, 'shout', f.voicePitch); alertNear(f, P); }
  if (ai.react > 0) ai.react -= dt;
  if (!ai.target || !P.alive) ai.alert = false;
  let wish = new THREE.Vector3(), speed = 0, face = f.facing;
  const tierSpd = f.T.speed * f.legMult;
  if (!ai.alert || ai.react > 0) {
    // patrol around the camp: walk, stop, look around
    if (ai.wait > 0) { ai.wait -= dt; if (ai.react > 0) face = faceP; }
    else {
      const dx = ai.tx - f.pos.x, dz = ai.tz - f.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6) { ai.wait = 2 + Math.random() * 5; const a = Math.random() * 6.28, r = 3 + Math.random() * 9; ai.tx = ai.camp.x + Math.cos(a) * r; ai.tz = ai.camp.z + Math.sin(a) * r; }
      else { wish.set(dx / d, 0, dz / d); speed = 1.45 * tierSpd; face = Math.atan2(dx, dz); }
    }
  } else if (!f.hasSword || (f.hp < f.maxHp * 0.22 && ai.courage < 0.45)) {
    // disarmed or nearly dead and scared: run
    wish.copy(toP).negate(); speed = 4.4 * tierSpd; face = Math.atan2(wish.x, wish.z);
    if (Math.random() < dt * 0.3) sfx.voice(f.pos, 'hurt', f.voicePitch * 1.15);
  } else if (dist > 3.0) {
    wish.copy(toP); speed = (dist > 7 ? 4.3 : 2.2) * tierSpd; face = faceP;
  } else {
    // in reach: circle, close the gap, look for an opening
    face = faceP;
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? 1 : -1; ai.strafeT = 1 + Math.random() * 2; }
    const side = new THREE.Vector3(toP.z, 0, -toP.x).multiplyScalar(ai.strafe);
    const ideal = 1.05 + f.sword.reach * 0.55;
    const keep = dist > ideal + 0.3 ? 0.7 : dist < ideal - 0.35 ? -0.8 : 0;
    wish.copy(side).addScaledVector(toP, keep).normalize();
    speed = 1.0 * tierSpd;
    if (f.attack) { speed = 0.6; wish.copy(toP); }
    ai.cd -= dt;
    // block when you swing at them (better knights block more)
    if (P.attack && P.attack.t < P.attack.dur * 0.35 && !f.attack && ai.blockT <= 0 && f.canAct()) {
      const chance = (f.T.block || [0.22, 0.42, 0.62][f.tier] || 0.3) * (f.stamina > 20 ? 1 : 0.2);
      if (Math.random() < chance * dt * 8) { f.blocking = true; f.blockStart = now() - 0.05 - Math.random() * 0.2; ai.blockT = 0.7; }
    }
    if (ai.blockT > 0) { ai.blockT -= dt; if (ai.blockT <= 0) f.blocking = false; }
    // only two people swing at the same person at once, the rest circle and wait
    if (ai.cd <= 0 && !f.attack && !f.blocking && f.canAct() && (P.tokens || 0) < 2 && P.alive) {
      const dirs = ['R', 'L', 'U', 'S', 'R', 'L', 'D'];
      const kind = f.tier === 2 && Math.random() < 0.3 ? 'heavy' : 'light';
      if (f.startAttack(dirs[Math.floor(Math.random() * dirs.length)], kind)) { ai.attacking = P; P.tokens = (P.tokens || 0) + 1; f.attack.dur *= 1.15; }
      ai.cd = 0.7 + Math.random() * 1.6 - Math.min(2, f.tier) * 0.15;
    }
  }
  if (ai.attacking && !f.attack) { ai.attacking.tokens = Math.max(0, (ai.attacking.tokens || 1) - 1); ai.attacking = false; }
  if (!f.canAct()) { speed *= 0.2; }
  if (f.stagger > 0) wish.multiplyScalar(0);
  stepFighter(f, dt, wish, speed, face, 7);
}
// keep camps near you populated; clear out far ones and old corpses
let spawnCheck = 0;
function updateSpawns(dt) {
  spawnCheck -= dt;
  if (spawnCheck > 0) return;
  spawnCheck = 1;
  const alive = fighters.filter(f => f.ai && f.alive).length;
  for (const c of CAMPS) {
    c.members = c.members.filter(m => m.alive);
    const d = Math.hypot(c.x - player.pos.x, c.z - player.pos.z);
    if (c.members.length === 0) {
      if (c.respawn > 0) { c.respawn -= 1; continue; }
      if (d > 35 && d < 160 && alive < 9) {
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) spawnKnight(c);
        c.respawn = 45;
      }
    }
  }
  // corpses: keep the 10 newest
  const dead = fighters.filter(f => !f.alive && !f.isPlayer);
  if (dead.length > 10) removeFighter(dead[0]);
}
function removeFighter(f) {
  scene.remove(f.root);
  if (f.swordMesh && f.swordMesh.parent === scene) scene.remove(f.swordMesh);
  if (f.cape) scene.remove(f.cape.mesh);
  if (f.tag) f.tag.remove();
  const i = fighters.indexOf(f); if (i >= 0) fighters.splice(i, 1);
}
