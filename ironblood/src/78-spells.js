// ---------- magic, part 2: your mana, the spells, chanting and casting ----------
const RANKS = ['Beginner', 'Intermediate', 'Advanced', 'Saint', 'King', 'Emperor', 'God'];
const RANK_MANA = [10, 30, 60, 100, 160, 250, 400];     // the mana you need before a spell of that rank will answer you
const CHANT_T = [0.9, 1.35, 1.9, 2.6, 3.4, 4.2, 5];      // seconds to speak a full chant
const SCHOOL = {
  fire: { name: 'Fire', css: '#ff8a3a', c: [3.4, 1.1, 0.25] },
  water: { name: 'Water', css: '#5ab4ff', c: [0.45, 1.2, 2.8] },
  wind: { name: 'Wind', css: '#cfefff', c: [1.4, 1.9, 2.1] },
  earth: { name: 'Earth', css: '#c49a64', c: [1.6, 1.15, 0.6] },
  lightning: { name: 'Lightning', css: '#d6c8ff', c: [2.2, 2.1, 4.2] },
  heal: { name: 'Healing', css: '#9be37a', c: [1.3, 2.7, 0.8] },
  blood: { name: 'Blood', css: '#e03030', c: [2.8, 0.12, 0.15] },
  arcane: { name: 'Arcane', css: '#b77bff', c: [1.7, 0.6, 3.0] },
  summon: { name: 'Summoning', css: '#7fe0ff', c: [0.6, 2.1, 2.7] },
};
// everything you know about magic lives here (and in your save)
const magic = { mana: 20, max: 20, exh: 0, known: ['waterball'], bar: ['waterball', null, null, null, null, null, null, null], sel: 0, mastery: {}, chantless: 0, insight: {}, books: [], emptyT: 0, eye: null, eyeOn: false, manGod: 0, seenMagic: {}, lessons: 0, mic: 0, intro: 0 };
try { Object.assign(magic, JSON.parse(localStorage.getItem('ironblood.magic') || '{}')); } catch (e) {}
magic.mana = Math.min(magic.mana, magic.max);
let magicSaveT = 0;
function saveMagic(now) { if (now) { try { localStorage.setItem('ironblood.magic', JSON.stringify(magic)); } catch (e) {} } else magicSaveT = 2; }
const rankTitle = () => { let r = -1; for (let i = 0; i < RANKS.length; i++) if (magic.max >= RANK_MANA[i] && magic.known.some(id => SPELL[id] && SPELL[id].rank === i)) r = i; return r < 0 ? 'No rank yet' : RANKS[r] + ' mage'; };

// ---- small helpers ----
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const isMetal = (f) => (f.team === 'knight' && !f.mage) || f.isPlayer;
function palm(f) { return f.b.LeftHand.getWorldPosition(V3()).addScaledVector(V3(Math.sin(f.facing), 0, Math.cos(f.facing)), 0.12); }
function chestOf(f) { return f.b.Spine2.getWorldPosition(V3()); }
function ptSeg(p, a, b) { const ab = _ps1.copy(b).sub(a), t = Math.max(0, Math.min(1, _ps2.copy(p).sub(a).dot(ab) / Math.max(1e-6, ab.lengthSq()))); return _ps3.copy(a).addScaledVector(ab, t).distanceTo(p); }
const _ps1 = V3(), _ps2 = V3(), _ps3 = V3(), _pa = V3(), _pb = V3();
// which body part (if any) a point is touching
function partAt(f, p, r) {
  let best = null, bd = 1e9;
  for (const k in PARTS) { if (f.parts[k].gone) continue; f.partSeg(k, _pa, _pb); const d = ptSeg(p, _pa, _pb) - PARTS[k].r - r; if (d < 0 && d < bd) { bd = d; best = k; } }
  return best;
}
function nearestPart(f, p) { let best = 'chest', bd = 1e9; for (const k in PARTS) { if (f.parts[k].gone) continue; f.partSeg(k, _pa, _pb); const d = ptSeg(p, _pa, _pb); if (d < bd) { bd = d; best = k; } } return best; }
// can this magic hurt that person? (bodies get in the way of everything; your own summons and gods don't)
function canStrike(caster, o) {
  if (o === caster || !o.alive || o.inside) return false;
  if (o.invuln) return true; // it touches them, it just does nothing
  if (caster && caster.team === 'knight' && o.team === 'knight') return false; // mages aim around their own men
  if (caster && (caster.isPlayer || caster.team === 'ally') && o.team === 'ally') return false;
  return true;
}
function strike(caster, o, k, raw, opt) {
  if (o.invuln) { godShrug(o, opt.point || chestOf(o)); return; }
  o.takeHit(k, raw, Object.assign({ from: caster, part: k, point: opt.point || chestOf(o), dir: opt.dir || V3(0, 0, 1) }, opt));
  if (caster && caster.isPlayer) gainXp(raw * 0.4);
  if (o.ai && caster) { o.ai.alert = true; if (caster.alive && !o.ai.follow) { o.ai.target = caster; o.ai.pickT = 3; } }
}
// a god just looks at your magic and it's gone
function godShrug(o, p) { mfx.burst.glow(p.x, p.y, p.z, 1.2, 1.5, 1.5, 2); mfx.burst.sparks(p.x, p.y, p.z, 12, 1.5, 1.5, 2.5, 2); sfx.disturb && sfx.disturb(p); if (o.onMagic) o.onMagic(); }
function shakeNear(p, a) { const d = p.distanceTo(camera.position); if (d < 40) shake(a * (1 - d / 40)); }

// ---- lights for spells (fixed pool so the shaders never recompile) ----
const mLights = [];
for (let i = 0; i < 5; i++) { const l = new THREE.PointLight(0xffffff, 0, 14, 2); scene.add(l); mLights.push({ l, t: 0, dur: 0, peak: 0, follow: null }); }
function flash(p, col, peak, dur, follow) {
  const free = mLights.find(m => m.dur === 0) || mLights.reduce((a, b) => (a.t / a.dur > b.t / b.dur ? a : b));
  free.l.position.copy(p); free.l.color.setRGB(col[0] / 3, col[1] / 3, col[2] / 3); free.peak = peak; free.t = 0; free.dur = dur; free.follow = follow || null; free.l.distance = Math.min(30, 8 + peak * 0.5);
  return free;
}
function updateLights(dt) {
  for (const m of mLights) {
    if (!m.dur) continue;
    m.t += dt;
    if (m.follow) { if (m.follow.dead) { m.follow = null; m.t = Math.max(m.t, m.dur - 0.2); } else m.l.position.copy(m.follow.pos); }
    const k = m.t / m.dur;
    m.l.intensity = k >= 1 ? 0 : m.peak * (m.follow ? 1 : 1 - k * k);
    if (k >= 1 && !m.follow) { m.dur = 0; m.l.intensity = 0; }
  }
}

// ---- projectiles: fireballs, stone bullets, water, ice spears ----
const projs = [];
function shoot(o) { o.life = o.life ?? 4; o.t = 0; o.prev = o.pos.clone(); if (o.mesh) { scene.add(o.mesh); o.mesh.position.copy(o.pos); } projs.push(o); if (o.light) o.lightRef = flash(o.pos, o.light, o.lightI || 18, 99, o); return o; }
function endProj(o) { o.dead = true; if (o.mesh) { scene.remove(o.mesh); } }
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const o = projs[i];
    if (o.dead) { projs.splice(i, 1); continue; }
    o.t += dt; o.life -= dt;
    if (o.life <= 0) { if (o.onEnd) o.onEnd(o.pos); endProj(o); continue; }
    const steps = Math.max(1, Math.ceil(o.vel.length() * dt / 0.22));
    const h = dt / steps;
    for (let s = 0; s < steps && !o.dead; s++) {
      o.prev.copy(o.pos);
      o.vel.y -= (o.grav || 0) * h;
      o.pos.addScaledVector(o.vel, h);
      // bodies
      for (const f of fighters) {
        if (!canStrike(o.caster, f) || f.pos.distanceToSquared(o.pos) > 9) continue;
        const k = partAt(f, o.pos, o.r);
        if (!k) continue;
        if (f.invuln) { godShrug(f, o.pos); endProj(o); break; }
        o.onFighter(f, k, o.pos.clone(), o); if (!o.pierce) { endProj(o); } else o.pierce--; break;
      }
      if (o.dead) break;
      // the ground, the river, walls and tree trunks
      const g = groundH(o.pos.x, o.pos.z);
      if (o.pos.y < WATER_Y && g < WATER_Y - 0.1) { (o.onWater || o.onGround)(o.pos.clone().setY(WATER_Y), o); endProj(o); break; }
      if (o.pos.y <= g) { o.pos.y = g + 0.02; o.onGround(o.pos.clone(), o); endProj(o); break; }
      const b = solidAt(o.pos.x, o.pos.z, 0.05);
      if (b && o.pos.y > b.h0 && o.pos.y < Math.min(b.h1, g + 30)) { o.onGround(o.pos.clone(), o, b); endProj(o); break; }
      for (const c of circles) { if (c.r < 0.12) continue; const dx = o.pos.x - c.x, dz = o.pos.z - c.z; if (dx * dx + dz * dz < (c.r + o.r) ** 2 && o.pos.y < g + 7) { o.onGround(o.pos.clone(), o, c); endProj(o); break; } }
    }
    if (o.dead) continue;
    if (o.mesh) {
      o.mesh.position.copy(o.pos);
      if (o.spin) o.mesh.rotateOnAxis(o.spinAxis || V3(0, 0, 1), o.spin * dt);
      else if (o.orient) o.mesh.quaternion.setFromUnitVectors(V3(0, 1, 0), _ps1.copy(o.vel).normalize());
    }
    if (o.trail) o.trail(o, dt);
  }
}
// timed effects: drains, tornadoes, storms
const effects = [];
function addEffect(e) { e.t = 0; effects.push(e); return e; }
function updateEffects(dt) { for (let i = effects.length - 1; i >= 0; i--) { const e = effects[i]; e.t += dt; if (e.update) e.update(dt, e); if (e.t >= e.dur || e.dead) { if (e.end) e.end(e); effects.splice(i, 1); } } }

// ---- meshes for the spells ----
const rockMat = new THREE.MeshStandardMaterial({ map: terrainUniforms.tD.value[3], normalMap: terrainUniforms.tN.value[3], color: 0x8a7a68, roughness: 0.9 });
const rockGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, v = V3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + vnoise(v.x * 2.3 + 3, v.y * 2.3 + v.z * 1.7) * 0.18; p.setXYZ(i, v.x * n, v.y * n * 1.35, v.z * n); } g.computeVertexNormals(); return g; })();
const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a6cb8, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.68, envMapIntensity: 1.6, emissive: 0x0a2440, emissiveIntensity: 0.6 });
const iceMatS = new THREE.MeshStandardMaterial({ color: 0xd8f0ff, roughness: 0.05, metalness: 0.05, transparent: true, opacity: 0.86, emissive: 0x3a7ab0, emissiveIntensity: 0.9 });
const bloodMat = new THREE.MeshStandardMaterial({ color: 0x5a0606, roughness: 0.15, metalness: 0.2, emissive: 0x6a0404, emissiveIntensity: 1.4 });
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c[0], c[1], c[2]), toneMapped: true });
const coreGeo = new THREE.SphereGeometry(1, 16, 12);

// ---- what each spell does (works for you and for enemy mages) ----
// c = { caster, from (palm), dir, aim (point), target, power, player }
function fireballHit(c, big) {
  const r = big ? 5.5 : 2.2, dmg = (big ? 62 : 26) * c.power;
  return (p) => {
    mfx.burst.fire(p.x, p.y, p.z, big ? 60 : 22, big ? 2.2 : 0.8, big ? 4 : 2.5, big ? 2.6 : 1.2);
    mfx.burst.sparks(p.x, p.y + 0.2, p.z, big ? 60 : 22, 4, 1.6, 0.4, big ? 10 : 6);
    mfx.burst.smoke(p.x, p.y + 0.5, p.z, big ? 14 : 5, big ? 2 : 1, 0.16);
    mfx.burst.glow(p.x, p.y, p.z, r * 1.4, 3, 1.3, 0.4, 0.3);
    flash(p, SCHOOL.fire.c, big ? 90 : 35, big ? 0.9 : 0.45);
    sfx.boom && sfx.boom(p, big ? 1.6 : 0.8);
    shakeNear(p, big ? 0.9 : 0.25);
    if (weather.rain < 0.6) igniteDisc(p.x, p.z, big ? 4 : 1.6, c.caster, big ? 0.85 : 0.7);
    for (const f of fighters) {
      if (!canStrike(c.caster, f)) continue;
      const cp = chestOf(f), d = cp.distanceTo(p);
      if (d > r) continue;
      const k = 1 - d / r, dir = cp.clone().sub(p).setY(0.3).normalize();
      strike(c.caster, f, nearestPart(f, p), dmg * (0.35 + 0.65 * k), { burn: true, noBlood: true, point: cp, dir, power: big ? 2 : 1.2, how: 'burned' });
      setOnFire(f, (big ? 7 : 4) * (0.5 + k), c.caster);
      if (big && f.alive && k > 0.2) knockDown(f, dir.x * 9 * k, 4 + 4 * k, dir.z * 9 * k, 1.6, c.caster);
    }
    if (houseAt(p.x, p.z)) ignite(p.x, p.z, c.caster);
  };
}
const SPELLS = [
  // ---------------- fire ----------------
  { id: 'fireball', name: 'Fireball', school: 'fire', rank: 0, cost: 6, chant: 'Flame that warms the world, gather in my hand and burn. Fireball!', desc: 'A ball of fire. Burns people, sets dry grass and thatch alight.',
    cast(c) {
      const m = new THREE.Mesh(coreGeo, glowMat([4, 1.6, 0.4])); m.scale.setScalar(0.17 * Math.sqrt(c.power));
      shoot({ caster: c.caster, pos: c.from.clone(), vel: c.dir.clone().multiplyScalar(26), r: 0.18, grav: 0.8, mesh: m, light: SCHOOL.fire.c, lightI: 14,
        onFighter: (f, k, p) => fireballHit(c, false)(p), onGround: fireballHit(c, false), onWater: (p) => { mfx.burst.smoke(p.x, p.y + 0.2, p.z, 6, 0.8, 0.75); sfx.hiss && sfx.hiss(p); },
        trail: (o, dt) => { if (Math.random() < 0.9) mfx.emit(true, 1, o.pos.x, o.pos.y, o.pos.z, (Math.random() - 0.5) * 0.5, 0.6, (Math.random() - 0.5) * 0.5, 0.3, 0.45, 0.1, 3.2, 1.2, 0.3, 0.9); if (Math.random() < 0.5) mfx.emit(false, 4, o.pos.x, o.pos.y, o.pos.z, 0, 0.5, 0, 1.2, 0.25, 0.9, 0.15, 0.14, 0.13, 0.35); } });
      sfx.whoosh && sfx.whoosh(c.from, 0.8);
    } },
  { id: 'burningplace', name: 'Burning Place', school: 'fire', rank: 1, cost: 16, aimGround: true, chant: 'Flames, take root in the earth and burn all that stands upon it. Burning Place!', desc: 'The ground itself catches fire where you point. It spreads with the wind.',
    cast(c) {
      const p = c.aim;
      const n = igniteDisc(p.x, p.z, 2.6 * Math.sqrt(c.power), c.caster, 1);
      for (let i = 0; i < 6; i++) setTimeout(() => igniteDisc(p.x + wind.x * i * 0.8, p.z + wind.z * i * 0.8, 1.6, c.caster, 0.8), i * 160);
      mfx.burst.fire(p.x, groundH(p.x, p.z) + 0.1, p.z, 40, 4, 3, 1.4);
      flash(p.clone().setY(p.y + 1), SCHOOL.fire.c, 40, 1.2);
      sfx.boom && sfx.boom(p, 0.6);
      for (const f of fighters) if (canStrike(c.caster, f) && f.pos.distanceTo(p) < 3) setOnFire(f, 6, c.caster);
      if (!n) ui.sub && c.player && ui.sub('Nothing here will burn', 1.5);
    } },
  { id: 'greatfireball', name: 'Great Fireball', school: 'fire', rank: 2, cost: 40, chant: 'Great flame of the sun, gather into one and turn my enemies to ash. Great Fireball!', desc: 'A huge, slow fireball. Explodes, throws people, sets everything around on fire.',
    cast(c) {
      const m = new THREE.Mesh(coreGeo, glowMat([5, 2, 0.5])); m.scale.setScalar(0.55);
      shoot({ caster: c.caster, pos: c.from.clone().addScaledVector(c.dir, 0.6), vel: c.dir.clone().multiplyScalar(15), r: 0.55, grav: 1.2, life: 6, mesh: m, light: SCHOOL.fire.c, lightI: 40,
        onFighter: (f, k, p) => fireballHit(c, true)(p), onGround: fireballHit(c, true), onWater: (p) => { mfx.burst.smoke(p.x, p.y + 0.3, p.z, 30, 2.5, 0.8); mfx.burst.water(p.x, p.y, p.z, 40, 6); sfx.hiss && sfx.hiss(p); },
        trail: (o) => { for (let k = 0; k < 3; k++) mfx.emit(true, 1, o.pos.x + (Math.random() - 0.5) * 0.7, o.pos.y + (Math.random() - 0.5) * 0.7, o.pos.z + (Math.random() - 0.5) * 0.7, (Math.random() - 0.5), 1, (Math.random() - 0.5), 0.4, 1.1, 0.2, 3.4, 1.2, 0.3, 0.9); mfx.emit(false, 4, o.pos.x, o.pos.y + 0.3, o.pos.z, 0, 0.8, 0, 1.8, 0.6, 2.2, 0.14, 0.13, 0.12, 0.4); } });
      sfx.whoosh && sfx.whoosh(c.from, 1.6);
    } },
  // ---------------- water + ice ----------------
  { id: 'waterball', name: 'Water Ball', school: 'water', rank: 0, cost: 5, chant: 'Spirit of water, gather in my palm and strike. Water Ball!', desc: 'A heavy ball of water. Knocks people back, soaks them, puts out fires. Wet people burn less and shock more.',
    cast(c) {
      const m = new THREE.Mesh(coreGeo, waterMat); m.scale.setScalar(0.24 * Math.sqrt(c.power));
      const hit = (p, f, k) => {
        mfx.burst.water(p.x, p.y, p.z, 40, 4); mfx.emit(false, 5, p.x, p.y, p.z, 0, 0.5, 0, 0.6, 0.5, 1.6, 0.8, 0.88, 0.95, 0.5);
        sfx.splash && sfx.splash(p, 1);
        douse(p.x, p.z, 2.4);
        for (const o of fighters) if (o.alive && o.pos.distanceTo(p) < 2.2) { o.wet = Math.max(o.wet || 0, 30); if (o.burning > 0) { o.burning = 0; mfx.burst.smoke(o.pos.x, o.pos.y + 1, o.pos.z, 6, 0.7, 0.75); } }
        if (f) {
          const dir = c.dir.clone().setY(0).normalize();
          strike(c.caster, f, k, 11 * c.power, { blunt: true, noBlood: true, point: p, dir, power: 1.4 });
          if (f.alive && !f.invuln) { if (c.power > 1.3 || Math.random() < 0.35) knockDown(f, dir.x * 6, 2.5, dir.z * 6, 1.2, c.caster); else { f.stagger = Math.max(f.stagger, 0.6); f.vel.addScaledVector(dir, 4); } }
        }
      };
      shoot({ caster: c.caster, pos: c.from.clone(), vel: c.dir.clone().multiplyScalar(22), r: 0.22, grav: 2.5, mesh: m,
        onFighter: (f, k, p) => hit(p, f, k), onGround: (p) => hit(p), onWater: (p) => { mfx.burst.water(p.x, p.y, p.z, 20, 2); sfx.splash && sfx.splash(p, 0.6); },
        trail: (o, dt) => { o.mesh.scale.set(0.24 * (1 + Math.sin(o.t * 30) * 0.08), 0.24 * (1 + Math.cos(o.t * 27) * 0.08), 0.24); if (Math.random() < 0.6) mfx.emit(false, 6, o.pos.x, o.pos.y, o.pos.z, 0, 0, 0, 0.4, 0.05, 0.02, 0.7, 0.85, 1, 0.8, 9.8); } });
      sfx.whoosh && sfx.whoosh(c.from, 0.5);
    } },
  { id: 'icelance', name: 'Ice Lance', school: 'water', rank: 1, cost: 12, chant: 'Cold of the far north, sharpen into a spear and pierce. Ice Lance!', desc: 'A spear of ice. Goes through mail, impales, chills whoever it hits.',
    cast(c) {
      const g = new THREE.ConeGeometry(0.075, 1.0, 6); g.translate(0, 0.1, 0);
      const m = new THREE.Mesh(g, iceMatS);
      shoot({ caster: c.caster, pos: c.from.clone(), vel: c.dir.clone().multiplyScalar(40), r: 0.07, grav: 0.4, mesh: m, orient: true,
        onFighter: (f, k, p) => { strike(c.caster, f, k, 34 * c.power, { stab: true, pierce: 0.55, point: p, dir: c.dir.clone(), power: 1.3 }); if (f.alive) { f.frozen = Math.max(f.frozen || 0, 0.6); f.vel.addScaledVector(c.dir, 2); } mfx.burst.sparks(p.x, p.y, p.z, 14, 1.4, 2, 2.6, 3); sfx.iceCrack && sfx.iceCrack(p); },
        onGround: (p) => { mfx.burst.sparks(p.x, p.y, p.z, 20, 1.4, 2, 2.6, 4); sfx.iceCrack && sfx.iceCrack(p); paintDisc(p.x, p.z, 1, 2, 0.6); },
        trail: (o) => { if (Math.random() < 0.7) mfx.emit(true, 0, o.pos.x, o.pos.y, o.pos.z, 0, 0, 0, 0.2, 0.25, 0.05, 0.6, 1.2, 2, 0.6); } });
      sfx.whoosh && sfx.whoosh(c.from, 0.4);
    } },
  { id: 'iciclefield', name: 'Icicle Field', school: 'water', rank: 2, cost: 40, aimGround: true, chant: 'Winter, fall upon this ground. Let ice rise and hold all who stand here. Icicle Field!', desc: 'Freezes the ground where you point: spikes of ice, slippery frost, people frozen in place. Freezes the river so you can walk on it.',
    cast(c) {
      const p = c.aim, R = 6.5;
      paintDisc(p.x, p.z, R + 1.5, 2, 1, 0.35);
      douse(p.x, p.z, R + 1, 120);
      freezeWater(p.x, p.z, R + 3);
      // spikes burst out of the ground
      const N = 46, geo = new THREE.ConeGeometry(0.16, 1.4, 5); geo.translate(0, 0.7, 0);
      const inst = new THREE.InstancedMesh(geo, iceMatS, N); inst.castShadow = true;
      const mats = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; e.set((Math.random() - 0.5) * 0.7, Math.random() * 6, (Math.random() - 0.5) * 0.7); mats.push({ x, z, y: groundH(x, z) - 0.05, q: q.setFromEuler(e).clone(), s: 0.6 + Math.random() * 1.1, d: r / R * 0.35 }); }
      scene.add(inst);
      sfx.freeze && sfx.freeze(p, 1.6);
      flash(p.clone().setY(p.y + 1.5), SCHOOL.water.c, 30, 1.2);
      for (const f of fighters) { if (!canStrike(c.caster, f) || f.pos.distanceTo(p) > R) continue; strike(c.caster, f, Math.random() < 0.5 ? 'lshin' : 'rshin', 14 * c.power, { stab: true, pierce: 0.4, point: f.pos.clone().setY(f.pos.y + 0.3), dir: V3(0, 1, 0), power: 1 }); freezeFighter(f, 5 * c.power); }
      addEffect({ dur: 30, update(dt, ef) {
        const grow = Math.min(1, ef.t / 0.45), melt = ef.t > 24 ? 1 - (ef.t - 24) / 6 : 1;
        mats.forEach((s, i) => { const k = Math.max(0, Math.min(1, (grow - s.d) / 0.65)) * melt; m4.compose(_ps1.set(s.x, s.y, s.z), s.q, _ps2.set(s.s * k + 0.001, s.s * k + 0.001, s.s * k + 0.001)); inst.setMatrixAt(i, m4); });
        inst.instanceMatrix.needsUpdate = true;
        if (ef.t < 0.5 && Math.random() < 0.8) mfx.burst.sparks(p.x + (Math.random() - 0.5) * R * 1.4, groundH(p.x, p.z) + 0.3, p.z + (Math.random() - 0.5) * R * 1.4, 4, 1.4, 1.9, 2.6, 3);
      }, end() { scene.remove(inst); inst.dispose(); } });
    } },
  // ---------------- wind ----------------
  { id: 'windblade', name: 'Wind Blade', school: 'wind', rank: 0, cost: 6, chant: 'Wind that cuts the sky, become a blade. Wind Blade!', desc: 'An invisible blade of air. Cuts like a sword, can take off a limb where the armor is thin.',
    cast(c) {
      const g = new THREE.TorusGeometry(0.55, 0.018, 4, 24, Math.PI * 0.85); g.rotateZ(Math.PI * 0.075); g.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.9, 2.1), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(g, mat); m.lookAt(c.dir); m.rotateZ(Math.random() * 1.2 - 0.6);
      const mm = new THREE.Group(); mm.add(m); m.quaternion.setFromUnitVectors(V3(0, 0, 1), c.dir.clone());
      shoot({ caster: c.caster, pos: c.from.clone(), vel: c.dir.clone().multiplyScalar(34), r: 0.3, life: 1.2, mesh: mm,
        onFighter: (f, k, p) => { const dir = c.dir.clone(); strike(c.caster, f, k, 24 * c.power, { pierce: 0.18, cut: 1.6, point: p, dir: V3(-dir.z, 0.2, dir.x), power: 1.2 }); sfx.cut(p, 1); },
        onGround: (p) => { mfx.burst.dust(p.x, p.y, p.z, 6, 0.5, [0.5, 0.45, 0.35], 3); paintDisc(p.x, p.z, 0.8, 0, 0.12); },
        trail: (o) => { if (Math.random() < 0.6) mfx.emit(false, 5, o.pos.x, o.pos.y, o.pos.z, 0, 0, 0, 0.35, 0.3, 0.8, 0.9, 0.95, 1, 0.12); } });
      sfx.swing(c.from, 1.4, 1.6);
    } },
  { id: 'shockwave', name: 'Shockwave', school: 'wind', rank: 0, cost: 7, self: true, chant: 'Breath of the world, burst outward from me. Shockwave!', desc: 'A blast of air in front of you. Knocks everyone off their feet.',
    cast(c) {
      const o = c.caster.pos.clone().setY(c.caster.pos.y + 1), fwd = c.dir.clone().setY(0).normalize();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.1, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.7, 1.9), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.copy(o).addScaledVector(fwd, 0.8); ring.lookAt(ring.position.clone().add(fwd)); scene.add(ring);
      addEffect({ dur: 0.45, update(dt, e) { const k = e.t / e.dur; ring.scale.setScalar(1 + k * 7); ring.position.copy(o).addScaledVector(fwd, 0.8 + k * 5); ring.material.opacity = 0.35 * (1 - k); }, end() { scene.remove(ring); } });
      for (let i = 0; i < 30; i++) { const a = Math.atan2(fwd.x, fwd.z) + (Math.random() - 0.5) * 1.6, s = 5 + Math.random() * 5; mfx.emit(false, 5, c.caster.pos.x + Math.sin(a), groundH(c.caster.pos.x, c.caster.pos.z) + 0.2, c.caster.pos.z + Math.cos(a), Math.sin(a) * s, 0.5, Math.cos(a) * s, 0.9, 0.6, 2.2, 0.45, 0.4, 0.33, 0.5, 0, 2.2); }
      sfx.boom && sfx.boom(o, 0.7);
      for (const f of fighters) {
        if (!canStrike(c.caster, f)) continue;
        const d = f.pos.clone().sub(c.caster.pos).setY(0), dist = d.length(); if (dist > 7.5) continue;
        d.normalize(); if (d.dot(fwd) < 0.45) continue;
        const k = (1 - dist / 7.5) * c.power;
        if (f.invuln) { godShrug(f, chestOf(f)); continue; }
        knockDown(f, d.x * (7 + 9 * k), 3 + 4 * k, d.z * (7 + 9 * k), 1.5, c.caster);
        if (f.ai) f.ai.alert = true;
        if (f.burning > 0) f.burning = 0;
      }
      douse(o.x + fwd.x * 3, o.z + fwd.z * 3, 2, 5);
    } },
  { id: 'tornado', name: 'Tornado', school: 'wind', rank: 2, cost: 45, aimGround: true, chant: 'Winds of the four corners, turn and turn and become a storm that tears the earth. Tornado!', desc: 'A spinning storm that moves where you point. Sucks people in and throws them. Through fire, it becomes a fire storm.',
    cast(c) {
      const p = c.aim.clone(), dir = c.dir.clone().setY(0).normalize();
      let fire = 0;
      sfx.wind && sfx.wind(p, 9);
      addEffect({ dur: 9, update(dt, e) {
        p.addScaledVector(dir, dt * 2.6); p.x += Math.sin(e.t * 1.7) * dt * 1.5; p.z += Math.cos(e.t * 1.3) * dt * 1.5;
        const gy = groundH(p.x, p.z), fade = Math.min(1, e.t / 0.8, (e.dur - e.t) / 1.2);
        if (burning.has(bmCell(p.x, p.z))) fire = Math.min(1, fire + dt * 0.8);
        if (fire > 0.3) igniteDisc(p.x, p.z, 1.6, c.caster, 0.5);
        // the funnel: dust and wind going round and up, fire if it ate a blaze
        for (let k = 0; k < 7; k++) {
          const h = Math.random() * 14, a = e.t * 9 + Math.random() * 6.28, rr = (0.5 + h * 0.22) * fade;
          const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
          const tv = 7 + h, vx = -Math.sin(a) * tv, vz = Math.cos(a) * tv;
          if (fire > 0.3 && Math.random() < fire) mfx.emit(true, 1, x, gy + h, z, vx * 0.4, 3, vz * 0.4, 0.5, 1.4, 0.4, 3.2, 1.2, 0.3, 0.8);
          else mfx.emit(false, Math.random() < 0.7 ? 5 : 4, x, gy + h, z, vx * 0.3, 2.5, vz * 0.3, 0.7, 0.8 + h * 0.08, 2 + h * 0.15, 0.5, 0.46, 0.4, 0.38);
        }
        if (Math.random() < dt * 8) mfx.burst.dust(p.x, gy, p.z, 3, 1, [0.4, 0.36, 0.3], 5);
        paintDisc(p.x, p.z, 1.2, 0, 0.05);
        for (const f of fighters) {
          if (!canStrike(c.caster, f) || f.knock && f.knock.t < 0.4) continue;
          const d = V3(p.x - f.pos.x, 0, p.z - f.pos.z), dist = d.length();
          if (dist > 6) continue;
          if (f.invuln) continue;
          if (dist > 1.8) { d.normalize(); f.pos.addScaledVector(d, dt * (6 - dist) * 1.3); f.vel.addScaledVector(d, dt * 4); if (f.ai) f.ai.alert = true; }
          else {
            const a = Math.random() * 6.28;
            knockDown(f, Math.cos(a) * 11, 10 + Math.random() * 5, Math.sin(a) * 11, 2, c.caster);
            if (fire > 0.3) setOnFire(f, 6, c.caster);
            sfx.voice(f.pos, 'scream', f.voicePitch || 1);
          }
        }
      } });
    } },
  // ---------------- earth ----------------
  { id: 'stonecannon', name: 'Stone Cannon', school: 'earth', rank: 0, cost: 5, charge: true, chant: 'Stone of the deep earth, harden, turn and fly. Stone Cannon!', desc: 'A spinning stone bullet. Breaks bones through armor. Keep holding to make it harder, faster and bigger (more mana).',
    cast(c) {
      const s = 0.09 + 0.06 * c.power, m = new THREE.Mesh(rockGeo, rockMat); m.scale.set(s, s, s);
      m.quaternion.setFromUnitVectors(V3(0, 1, 0), c.dir.clone()); m.castShadow = true;
      const speed = 34 + 22 * c.power;
      shoot({ caster: c.caster, pos: c.from.clone(), vel: c.dir.clone().multiplyScalar(speed), r: s, grav: 1.5, mesh: m, spin: 40, spinAxis: V3(0, 1, 0),
        onFighter: (f, k, p) => {
          strike(c.caster, f, k, 26 * c.power, { blunt: true, pierce: Math.min(0.8, 0.35 + c.power * 0.15), point: p, dir: c.dir.clone(), power: 1.2 + c.power * 0.4 });
          if (f.alive && !f.invuln && c.power > 1.6) knockDown(f, c.dir.x * 6 * c.power, 2.5, c.dir.z * 6 * c.power, 1.4, c.caster);
          mfx.burst.dust(p.x, p.y, p.z, 6, 0.4, [0.45, 0.38, 0.3], 3); mfx.burst.sparks(p.x, p.y, p.z, 10, 3, 2.2, 1.2, 4);
        },
        onGround: (p) => { mfx.burst.dust(p.x, p.y, p.z, 10 + c.power * 5, 0.6, [0.42, 0.36, 0.28], 3 + c.power); sfx.thud(p, 0.6 + c.power * 0.3); shakeNear(p, 0.1 * c.power); paintDisc(p.x, p.z, 0.6 + c.power * 0.3, 0, 0.08); },
        trail: (o) => { if (Math.random() < 0.4) mfx.emit(false, 5, o.pos.x, o.pos.y, o.pos.z, 0, 0, 0, 0.5, 0.12, 0.5, 0.45, 0.4, 0.34, 0.3); } });
      sfx.stoneShot && sfx.stoneShot(c.from, c.power);
    } },
  { id: 'earthwall', name: 'Earth Wall', school: 'earth', rank: 0, cost: 12, aimGround: true, chant: 'Earth beneath me, rise and stand as my shield. Earth Wall!', desc: 'A wall of rock rises out of the ground. Blocks swords, arrows and spells. Crumbles after a while.',
    cast(c) {
      const p = c.aim.clone(), d = c.dir.clone().setY(0).normalize(), ry = Math.atan2(d.x, d.z);
      const W = 4.2, Hh = 2.6, T = 0.8;
      const g = new THREE.BoxGeometry(W, Hh, T, 10, 6, 2), pp = g.attributes.position, v = V3();
      for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); const n = vnoise(v.x * 1.7 + 4, v.y * 1.9) * 0.18 + vnoise(v.x * 5, v.y * 5 + v.z) * 0.05; pp.setXYZ(i, v.x, v.y + (v.y > Hh / 2 - 0.01 ? vnoise(v.x * 2.2, 7) * 0.35 : 0), v.z + n * (v.z > 0 ? 1 : -1)); }
      g.computeVertexNormals(); g.translate(0, Hh / 2, 0);
      const m = new THREE.Mesh(g, rockMat); m.castShadow = m.receiveShadow = true;
      const gy = groundH(p.x, p.z);
      m.position.set(p.x, gy - Hh, p.z); m.rotation.y = ry; scene.add(m);
      const box = { cx: p.x, cz: p.z, hw: W / 2, hd: T / 2, c: Math.cos(ry), s: Math.sin(ry), h0: -1e9, h1: gy + Hh, tag: 'magicwall' };
      // anyone standing where it rises gets thrown off it
      for (const f of fighters) if (f.alive && inBox(box, f.pos.x, f.pos.z, 0.3)) { const away = f.pos.clone().sub(p).setY(0).normalize(); if (away.lengthSq() < 0.1) away.copy(d); if (!f.invuln) knockDown(f, away.x * 4, 6, away.z * 4, 1.2, c.caster); }
      boxes.push(box);
      mfx.burst.dust(p.x, gy, p.z, 30, 1, [0.42, 0.36, 0.28], 4);
      sfx.rumble && sfx.rumble(p, 1);
      shakeNear(p, 0.35);
      addEffect({ dur: 40, update(dt, e) { const up = Math.min(1, e.t / 0.5), down = e.t > 37 ? (e.t - 37) / 3 : 0; m.position.y = gy - Hh * (1 - up) - Hh * down; if (down > 0 && Math.random() < dt * 20) mfx.burst.dust(p.x + (Math.random() - 0.5) * W, gy + 0.3, p.z, 1, 0.8, [0.42, 0.36, 0.28], 1.5); },
        end() { scene.remove(m); g.dispose(); const i = boxes.indexOf(box); if (i >= 0) boxes.splice(i, 1); } });
    } },
  { id: 'quagmire', name: 'Quagmire', school: 'earth', rank: 1, cost: 18, aimGround: true, chant: 'Earth and water, melt into one and swallow their feet. Quagmire!', desc: 'Turns the ground into deep mud. Anyone in it sinks and can barely move.',
    cast(c) {
      const p = c.aim, R = 4.8 * Math.sqrt(c.power);
      paintDisc(p.x, p.z, R, 3, 1, 0.3);
      for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, r = Math.random() * R, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r; mfx.emit(false, 6, x, groundH(x, z), z, 0, 2 + Math.random() * 2, 0, 0.6, 0.12, 0.05, 0.16, 0.11, 0.07, 0.95, 9.8); }
      sfx.splash && sfx.splash(p, 1.4); sfx.rumble && sfx.rumble(p, 0.5);
      for (const f of fighters) if (canStrike(c.caster, f) && f.pos.distanceTo(p) < R && f.ai) f.ai.alert = true;
    } },
  // ---------------- lightning ----------------
  { id: 'electric', name: 'Electric', school: 'lightning', rank: 1, cost: 14, chant: 'Thunder sleeping in my palm, wake and bite. Electric!', desc: 'Lightning from your hand to someone close (5 m). Jumps to anyone else in metal armor. Wet people get it worse.',
    cast(c) {
      let t = c.target && canStrike(c.caster, c.target) && c.target.pos.distanceTo(c.caster.pos) < 6 ? c.target : null;
      if (!t) { let bd = 6; for (const f of fighters) { if (!canStrike(c.caster, f) || f.isPlayer === c.player && f === c.caster) continue; const d = f.pos.distanceTo(c.caster.pos), dir = f.pos.clone().sub(c.caster.pos).setY(0).normalize(); if (d < bd && dir.dot(c.dir.clone().setY(0).normalize()) > 0.55) { bd = d; t = f; } } }
      if (!t) { const end = c.from.clone().addScaledVector(c.dir, 4.5); bolt(c.from, end, SCHOOL.lightning.c, 0.035, 0.18); sfx.zap && sfx.zap(c.from, 0.8); return; }
      chainShock(c, c.from, t, 30 * c.power, 3);
    } },
  { id: 'lightning', name: 'Lightning', school: 'lightning', rank: 3, cost: 70, aimGround: true, chant: 'Clouds above, gather all your rage. Thunder, fall from the heavens and strike them down. Lightning!', desc: 'Calls a bolt from the sky where you point. It looks for metal. Kills most men outright.',
    cast(c) {
      const p = c.aim.clone();
      let t = null, bd = 5;
      for (const f of fighters) { if (!canStrike(c.caster, f)) continue; const d = f.pos.distanceTo(p) * (isMetal(f) ? 0.6 : 1); if (d < bd) { bd = d; t = f; } }
      const hitP = t ? t.b.HeadTop_End.getWorldPosition(V3()) : p.clone().setY(groundH(p.x, p.z));
      const top = hitP.clone().add(V3((Math.random() - 0.5) * 30, 140, (Math.random() - 0.5) * 30));
      bolt(top, hitP, [3.2, 3.2, 6], 0.32, 0.35, true);
      weather.flash = 1.2; sfx.thunderNear && sfx.thunderNear(hitP);
      flash(hitP, [3, 3, 5], 160, 0.5);
      shakeNear(hitP, 1);
      mfx.burst.sparks(hitP.x, hitP.y, hitP.z, 50, 2.5, 2.5, 4.5, 9);
      if (weather.rain < 0.6) igniteDisc(hitP.x, hitP.z, 1.6, c.caster, 0.6);
      paintDisc(hitP.x, hitP.z, 1.2, 0, 0.7);
      if (t) chainShock(c, null, t, 95 * c.power, 4, true);
    } },
  { id: 'cumulonimbus', name: 'Cumulonimbus', school: 'lightning', rank: 4, cost: 140, self: true, chant: 'Great storm of the heavens, gather your clouds over this land. Let the rain fall, let the wind howl, and let the thunder judge my enemies. Cumulonimbus!', desc: 'Calls a real storm. Rain pours down, puts out every fire, and lightning keeps striking your enemies for half a minute.',
    cast(c) {
      const center = c.caster.pos.clone();
      ui.message('THE SKY ANSWERS', 2);
      addEffect({ dur: 30, next: 2, update(dt, e) {
        weather.storm = Math.min(1, e.t / 3) * (e.t > e.dur - 5 ? (e.dur - e.t) / 5 : 1);
        e.next -= dt;
        if (e.next <= 0 && e.t > 3) {
          e.next = 0.9 + Math.random() * 1.6;
          const list = fighters.filter(f => canStrike(c.caster, f) && !f.invuln && f.pos.distanceTo(center) < 45 && (f.team === 'knight' || f.angryAtYou));
          const t = list[Math.floor(Math.random() * list.length)];
          const hitP = t ? t.b.HeadTop_End.getWorldPosition(V3()) : center.clone().add(V3((Math.random() - 0.5) * 70, 0, (Math.random() - 0.5) * 70));
          if (!t) hitP.y = groundH(hitP.x, hitP.z);
          bolt(hitP.clone().add(V3((Math.random() - 0.5) * 20, 120, (Math.random() - 0.5) * 20)), hitP, [3.2, 3.2, 6], 0.3, 0.3, true);
          weather.flash = 1; sfx.thunderNear && sfx.thunderNear(hitP); flash(hitP, [3, 3, 5], 120, 0.4); shakeNear(hitP, 0.6);
          if (t) chainShock(c, null, t, 80, 3, true);
        }
      }, end() { weather.storm = 0; } });
    } },
  // ---------------- healing + shields ----------------
  { id: 'healing', name: 'Healing', school: 'heal', rank: 0, cost: 8, self: true, chant: 'Gentle light, close these wounds and give back strength. Healing!', desc: 'Heals you (or the friend you are looking at, close by) and slows bleeding.',
    cast(c) { const t = c.player ? healTarget(c) : (c.target && c.target.alive ? c.target : c.caster); healBody(c, t, 26 * c.power, false); } },
  { id: 'greaterhealing', name: 'Greater Healing', school: 'heal', rank: 1, cost: 22, self: true, chant: 'Light of mercy, mend flesh and bone and stop the blood. Greater Healing!', desc: 'Heals a lot, mends broken bones and stops all bleeding. Nothing grows back a lost limb.',
    cast(c) { const t = c.player ? healTarget(c) : (c.target && c.target.alive ? c.target : c.caster); healBody(c, t, 60 * c.power, true); } },
  { id: 'barrier', name: 'Barrier', school: 'heal', rank: 1, cost: 18, self: true, chant: 'Mana, become a wall around me that no blade can pass. Barrier!', desc: 'A shield of mana around you. Soaks up blows and spells until it breaks or fades.',
    cast(c) { giveShield(c.caster, (45 + magicOf(c.caster).max * 0.25) * c.power, 14); sfx.shieldUp && sfx.shieldUp(c.caster.pos); flash(chestOf(c.caster), SCHOOL.water.c, 20, 0.6); } },
  // ---------------- blood ----------------
  { id: 'drain', name: 'Drain', school: 'blood', rank: 1, cost: 15, chant: 'Blood of my enemy, answer my call and come to me. Drain!', desc: 'Pulls the blood out of someone you can see (15 m) and into you. They weaken, you heal.',
    cast(c) {
      const t = c.target && canStrike(c.caster, c.target) && c.target.pos.distanceTo(c.caster.pos) < 16 ? c.target : coneTarget(c, 16, 0.85);
      if (!t) { c.player && ui.sub('No one to drain', 1.2); return; }
      if (t.invuln) { godShrug(t, chestOf(t)); return; }
      if (t.spirit) { c.player && ui.sub('A spirit has no blood', 1.5); return; }
      sfx.drain && sfx.drain(chestOf(t));
      addEffect({ dur: 2.4, update(dt, e) {
        if (!t.alive || !c.caster.alive) { e.dead = true; return; }
        const a = chestOf(t), b = chestOf(c.caster);
        for (let k = 0; k < 4; k++) { const s = Math.random(); const p = a.clone().lerp(b, s); p.y += Math.sin(s * Math.PI) * 0.6 + (Math.random() - 0.5) * 0.2; const v = b.clone().sub(a).multiplyScalar(0.8); mfx.emit(true, 0, p.x, p.y, p.z, v.x, v.y, v.z, 0.25, 0.16, 0.06, 2.6, 0.1, 0.12, 0.9); }
        const d = dt * 10 * c.power;
        t.hp -= d; t.bleed += dt * 0.6; t.lastHitBy = c.caster;
        c.caster.hp = Math.min(c.caster.maxHp, c.caster.hp + d * 0.8);
        if (Math.random() < dt * 4) gore.blood(a, b.clone().sub(a).normalize(), 3, 1.5);
        if (t.painT <= 0) { sfx.voice(t.pos, 'hurt', t.voicePitch || 1); t.painT = 0.8; }
        if (t.ai) t.ai.alert = true;
        if (t.hp <= 0) t.die({ from: c.caster, part: 'chest', noBlood: true }, 'drained dry');
      } });
    } },
  { id: 'bloodspear', name: 'Blood Spear', school: 'blood', rank: 2, cost: 30, chant: 'My own blood, harden into a spear and pierce my enemy. Blood Spear!', desc: 'Turns some of your own blood (8 health) into a spear of red crystal. Goes through plate. The wound never stops bleeding.',
    cast(c) {
      c.caster.hp -= 8; gore.blood(palm(c.caster), c.dir, 8, 1);
      const g = new THREE.ConeGeometry(0.06, 1.3, 5); g.translate(0, 0.2, 0);
      const m = new THREE.Mesh(g, bloodMat);
      shoot({ caster: c.caster, pos: c.from.clone(), vel: c.dir.clone().multiplyScalar(46), r: 0.06, grav: 0.3, mesh: m, orient: true, light: SCHOOL.blood.c, lightI: 6,
        onFighter: (f, k, p) => { strike(c.caster, f, k, 48 * c.power, { stab: true, pierce: 0.85, point: p, dir: c.dir.clone(), power: 1.6 }); if (f.alive) f.bleed += 3.5; gore.blood(p, c.dir, 30, 3); },
        onGround: (p) => { mfx.burst.sparks(p.x, p.y, p.z, 10, 2.6, 0.1, 0.1, 3); },
        trail: (o) => { if (Math.random() < 0.8) mfx.emit(true, 0, o.pos.x, o.pos.y, o.pos.z, 0, 0, 0, 0.25, 0.2, 0.05, 2.4, 0.08, 0.08, 0.8); } });
      sfx.whoosh && sfx.whoosh(c.from, 0.5);
    } },
  // ---------------- arcane ----------------
  { id: 'telekinesis', name: 'Telekinesis', school: 'arcane', rank: 1, cost: 20, chant: 'Unseen hand, take hold of them, lift and throw. Telekinesis!', desc: 'Lifts someone you are looking at (18 m) into the air and throws them where you aim.',
    cast(c) {
      const t = c.target && canStrike(c.caster, c.target) && c.target.pos.distanceTo(c.caster.pos) < 19 ? c.target : coneTarget(c, 19, 0.9);
      if (!t) { c.player && ui.sub('Nothing to grab', 1.2); return; }
      if (t.invuln) { godShrug(t, chestOf(t)); return; }
      sfx.lift && sfx.lift(t.pos);
      const by = c.caster;
      t.attack = null; t.blocking = false; t.knock = null;
      t.lift = { t: 0, hold: 1.3, by, force: 13 * c.power,
        anchor: () => { const base = t.pos.clone(); base.y = Math.max(groundH(t.pos.x, t.pos.z) + 2.4, base.y); return base; },
        throwDir: () => { const d = by.isPlayer ? camDirFlat() : by.pos.clone().sub(t.pos).setY(0).normalize().negate(); d.y = 0.25; return d.normalize(); } };
      if (t.ai) t.ai.alert = true;
      sfx.voice(t.pos, 'shout', t.voicePitch || 1);
    } },
  { id: 'disturb', name: 'Disturb Magic', school: 'arcane', rank: 2, cost: 25, self: true, chant: 'Mana around me, scatter and break apart. Disturb Magic!', desc: 'Breaks every enemy spell around you (20 m): spells in the air fall apart, chants are cut off, barriers and summons are torn down.',
    cast(c) {
      const o = chestOf(c.caster);
      const ring = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.5, 2.6), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
      ring.position.copy(o); scene.add(ring);
      addEffect({ dur: 0.6, update(dt, e) { const k = e.t / e.dur; ring.scale.setScalar(1 + k * 20); ring.material.opacity = 0.25 * (1 - k); }, end() { scene.remove(ring); } });
      sfx.disturb && sfx.disturb(o);
      let n = 0;
      for (const p of projs) if (!p.dead && p.caster !== c.caster && p.pos.distanceTo(o) < 20 && (!p.caster || p.caster.team !== c.caster.team)) { mfx.burst.sparks(p.pos.x, p.pos.y, p.pos.z, 10, 1.6, 0.6, 2.8, 3); endProj(p); n++; }
      for (const f of fighters) {
        if (f === c.caster || f.pos.distanceTo(o) > 20 || f.team === c.caster.team && f.team !== 'villager') continue;
        if (f.mage && f.mage.chant) { f.mage.chant = null; f.castAim = null; f.stagger = Math.max(f.stagger, 0.8); n++; mfx.burst.sparks(f.pos.x, f.pos.y + 1.4, f.pos.z, 14, 1.6, 0.6, 2.8, 3); }
        if (f.shield && f !== c.caster) { dropShield(f); n++; }
        if (f.summon && f.team !== c.caster.team) { f.summon.t = 0; n++; }
      }
      if (c.player && !n) ui.sub('No enemy magic nearby', 1.3);
    } },
  // ---------------- summoning ----------------
  { id: 'spiritknight', name: 'Spirit Knight', school: 'summon', rank: 3, cost: 80, self: true, chant: 'Soul of a knight who fell with honor, take form once more and fight beside me. Spirit Knight!', desc: 'Calls the ghost of a dead knight to fight for you for a minute. Swords go through it without blood.',
    cast(c) { summonSpirit(c); } },
];
const SPELL = Object.fromEntries(SPELLS.map(s => [s.id, s]));
// every caster needs a pool of mana: you have yours, mages carry their own
function magicOf(f) { return f.isPlayer ? magic : (f.mage || { max: 60, mana: 60 }); }
function camDirFlat() { const d = V3(); camera.getWorldDirection(d); d.y = 0; return d.normalize(); }
function coneTarget(c, range, cos) {
  let best = null, bs = 1e9;
  for (const f of fighters) {
    if (!canStrike(c.caster, f)) continue;
    const to = chestOf(f).sub(c.from), d = to.length(); if (d > range) continue;
    const dot = to.normalize().dot(c.dir); if (dot < cos) continue;
    const s = d * (2 - dot); if (s < bs) { bs = s; best = f; }
  }
  return best;
}
function healTarget(c) {
  // a friend you are looking at, close by; otherwise yourself
  for (const f of fighters) { if (f === c.caster || !f.alive || f.inside || f.team === 'knight' || f.angryAtYou) continue; if (f.pos.distanceTo(c.caster.pos) > 3.2) continue; const dir = f.pos.clone().sub(c.caster.pos).setY(0).normalize(); if (dir.dot(c.dir.clone().setY(0).normalize()) > 0.8) return f; }
  return c.caster;
}
function healBody(c, t, amount, great) {
  t.hp = Math.min(t.maxHp, t.hp + amount);
  t.bleed = great ? 0 : Math.max(0, t.bleed * 0.4 - 0.5);
  for (const k in t.parts) { const p = t.parts[k]; if (p.gone) continue; p.hp = Math.min(p.max, p.hp + p.max * (great ? 0.7 : 0.25)); if (great && p.broken) p.broken = false; }
  if (great && t.down && t.alive && !t.severed.some(b => b.includes('Leg'))) { t.down = false; t.root.rotation.x = 0; }
  if (great && t.hasSword === false && t.vill && t.vill.p.armed && t.vill.mode === 'fight') arm(t);
  const p = t.pos;
  for (let i = 0; i < (great ? 70 : 34); i++) { const a = Math.random() * 6.28, r = 0.25 + Math.random() * 0.35; mfx.emit(true, 0, p.x + Math.cos(a) * r, p.y + Math.random() * 1.6, p.z + Math.sin(a) * r, -Math.sin(a) * 0.6, 0.6 + Math.random() * 0.9, Math.cos(a) * 0.6, 0.9 + Math.random() * 0.6, 0.09, 0.02, 1.4, 2.6, 0.9, 0.9); }
  flash(chestOf(t), SCHOOL.heal.c, great ? 30 : 16, 1);
  sfx.heal && sfx.heal(p, great);
  if (t !== c.caster && t.vill && c.player) { const st = t.vill.st; st.opinion = clampO(st.opinion + (great ? 12 : 7)); st.fear = Math.max(0, st.fear - 5); remember(st, 'the dark knight healed me with magic'); npcSayNear && npcSayNear(t, ['...You healed me. Thank you.', 'The pain is gone. How did you do that?', 'Magic! Bless you, knight.']); }
  if (t !== c.caster && t.isPlayer === false && t.team === 'knight' && c.player) ui.sub('You healed an enemy.', 1.5);
}
// lightning running through a body and jumping to the next one in metal
function chainShock(c, from, first, dmg, jumps, sky) {
  const hit = new Set();
  let cur = first, src = from, d = dmg;
  for (let j = 0; j <= jumps && cur; j++) {
    hit.add(cur);
    const to = chestOf(cur);
    if (src) bolt(src, to, SCHOOL.lightning.c, sky ? 0.06 : 0.045, 0.22);
    const mult = (isMetal(cur) ? 1.45 : 1) * ((cur.wet || 0) > 0 ? 1.7 : 1);
    if (cur.invuln) { godShrug(cur, to); break; }
    strike(c.caster, cur, 'chest', d * mult, { noBlood: true, point: to, dir: V3(0, -1, 0), power: 1.8, how: 'struck by lightning' });
    cur.shock = 1.6; cur.stagger = Math.max(cur.stagger, 1.4); cur.attack = null; cur.blocking = false;
    cur.charred = Math.min(1, (cur.charred || 0) + 0.18); applyChar(cur);
    if (cur.alive && d * mult > 40 && !cur.invuln) knockDown(cur, (Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3, 1.3, c.caster);
    if (cur.alive && Math.random() < 0.4) sfx.voice(cur.pos, 'scream', cur.voicePitch || 1);
    sfx.zap && sfx.zap(to, 1);
    mfx.burst.sparks(to.x, to.y, to.z, 18, 2.2, 2.2, 4.2, 5);
    // jump to the closest other body in metal (or soaked), within 6 m
    let next = null, bd = 6.5;
    for (const f of fighters) { if (hit.has(f) || !canStrike(c.caster, f) || f.isPlayer && c.player) continue; if (!isMetal(f) && !((f.wet || 0) > 0)) continue; const dd = f.pos.distanceTo(cur.pos); if (dd < bd) { bd = dd; next = f; } }
    src = to; cur = next; d *= 0.7;
  }
}
// a jagged bolt of light between two points (with little side branches)
function bolt(a, b, col, width, dur, branches) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0], col[1], col[2]), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const line = (p0, p1, w, n, jag) => {
    const pts = [p0.clone()]; const dir = p1.clone().sub(p0), len = dir.length();
    for (let i = 1; i < n; i++) { const p = p0.clone().addScaledVector(dir, i / n); p.x += (Math.random() - 0.5) * jag * len / n * 2.2; p.y += (Math.random() - 0.5) * jag * len / n * 1.2; p.z += (Math.random() - 0.5) * jag * len / n * 2.2; pts.push(p); }
    pts.push(p1.clone());
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1], m = s.clone().lerp(e, 0.5), L = s.distanceTo(e);
      const q = new THREE.Mesh(new THREE.PlaneGeometry(w, L), mat);
      q.position.copy(m); q.lookAt(camera.position); const up = e.clone().sub(s).normalize();
      // keep the strip along the segment, facing the camera
      const toCam = camera.position.clone().sub(m).normalize(), x = new THREE.Vector3().crossVectors(up, toCam).normalize(), z = new THREE.Vector3().crossVectors(x, up);
      q.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
      g.add(q);
    }
    return pts;
  };
  const len = a.distanceTo(b), n = Math.max(4, Math.round(len / (branches ? 6 : 0.5)));
  const pts = line(a, b, width, n, branches ? 0.9 : 0.6);
  if (branches) for (let k = 0; k < 6; k++) { const s = pts[1 + Math.floor(Math.random() * (pts.length - 2))]; const e = s.clone().add(V3((Math.random() - 0.5) * 16, -8 - Math.random() * 12, (Math.random() - 0.5) * 16)); line(s, e, width * 0.5, 5, 0.8); }
  else line(a, b, width * 0.5, n, 0.8);
  scene.add(g);
  addEffect({ dur, update(dt, e) { mat.opacity = (1 - e.t / e.dur) * (Math.random() < 0.3 ? 0.4 : 1); }, end() { scene.remove(g); g.traverse(o => o.geometry && o.geometry.dispose()); mat.dispose(); } });
}
// a ghostly knight from the other side
const ghostMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uT: { value: 0 }, uA: { value: 1 } },
  vertexShader: '#include <common>\n#include <skinning_pars_vertex>\nvarying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ #include <beginnormal_vertex>\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <begin_vertex>\n#include <skinning_vertex>\n vec4 wp = modelMatrix * vec4(transformed, 1.0); vW = wp.xyz; vN = normalize(mat3(modelMatrix) * objectNormal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }',
  fragmentShader: 'uniform float uT; uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), vV)), 1.8); float band = 0.6 + 0.4 * sin(vW.y * 18.0 - uT * 5.0); gl_FragColor = vec4(vec3(0.35, 1.2, 1.9) * (0.12 + f * 1.1) * band * uA, 1.0); }',
});
function summonSpirit(c) {
  const n = (magic.mastery.spiritknight || 0) > 60 && c.player ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const f = new Fighter({ tier: 2, team: 'ally', metal: 0x88aacc, rough: 0.3, cloth: 0x335566, leather: 0x223344, body: 0x334455, sword: SWORDS.find(s => s.id === 'longsword'), name: 'Spirit Knight' });
    const side = V3(-c.dir.z, 0, c.dir.x).multiplyScalar(i ? -1.6 : 1.6);
    f.pos.copy(c.caster.pos).addScaledVector(c.dir.clone().setY(0).normalize(), 2).add(side); f.pos.y = groundH(f.pos.x, f.pos.z);
    f.facing = c.caster.facing; f.spirit = true; f.voicePitch = 0.7;
    const mat = ghostMat.clone();
    f.root.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = false; } });
    f.swordMesh.traverse(o => { if (o.isMesh) o.material = mat; });
    f.ghostMat = mat;
    f.ai = { state: 'patrol', camp: { x: f.pos.x, z: f.pos.z }, wait: 0, tx: f.pos.x, tz: f.pos.z, alert: false, strafe: 1, strafeT: 0, cd: 0.5, blockT: 0, courage: 1, shouted: true, react: 0, crawlT: 0, follow: true };
    f.summon = { t: 60, by: c.caster };
    for (let k = 0; k < 60; k++) mfx.emit(true, 0, f.pos.x + (Math.random() - 0.5), f.pos.y + Math.random() * 2, f.pos.z + (Math.random() - 0.5), 0, 1 + Math.random(), 0, 1, 0.2, 0.05, 0.4, 1.4, 2, 0.8);
  }
  sfx.summon && sfx.summon(c.caster.pos);
}
function updateSummons(dt, t) {
  for (let i = fighters.length - 1; i >= 0; i--) {
    const f = fighters[i];
    if (!f.summon) continue;
    f.summon.t -= dt;
    f.ghostMat.uniforms.uT.value = t;
    f.ghostMat.uniforms.uA.value = f.alive ? Math.min(1, f.summon.t / 2) : Math.max(0, f.ghostMat.uniforms.uA.value - dt);
    if (f.summon.t <= 0 || !f.alive && f.ghostMat.uniforms.uA.value <= 0.01) {
      for (let k = 0; k < 30; k++) mfx.emit(true, 0, f.pos.x + (Math.random() - 0.5), f.pos.y + Math.random() * 2, f.pos.z + (Math.random() - 0.5), 0, 1.5, 0, 1, 0.2, 0.05, 0.4, 1.4, 2, 0.6);
      removeFighter(f);
    }
  }
}

// ---- you: mana grows as you use it up, exhaustion makes you pass out ----
function spellCost(s, chantless, power) {
  const m = magic.mastery[s.id] || 0;
  let c = s.cost * (1 - Math.min(0.3, m * 0.003));
  if (chantless) c *= 2.0 - magic.chantless * 1.0;
  if (s.charge) c *= power * power;
  return c;
}
function payMana(cost) {
  const short = Math.max(0, cost - magic.mana);
  magic.mana = Math.max(0, magic.mana - cost);
  magic.exh = Math.min(120, magic.exh + cost / magic.max * 9 + short / magic.max * 160);
  // training: pushing yourself makes your well of mana deeper
  magic.max += cost * 0.02 / (1 + magic.max / 250);
  if (magic.mana < magic.max * 0.08 && magic.emptyT <= 0) { magic.max += 1 + magic.max * 0.012; magic.emptyT = 25; ui.sub('Your mana is empty. It comes back a little deeper each time.', 2.5); }
  magic.restT = 2.5;
  saveMagic();
  if (magic.exh >= 100) setTimeout(manaPassOut, 400);
}
function updateManaPool(dt) {
  magic.emptyT -= dt; magic.restT = (magic.restT || 0) - dt;
  const regen = (0.7 + magic.max * 0.012) * (magic.exh > 60 ? 0.5 : 1) * (passedOut ? 3 : 1);
  magic.mana = Math.min(magic.max, magic.mana + dt * regen);
  if (magic.restT <= 0) magic.exh = Math.max(0, magic.exh - dt * (magic.mana > magic.max * 0.4 ? 4 : 1.5));
  if (magicSaveT > 0) { magicSaveT -= dt; if (magicSaveT <= 0) saveMagic(true); }
}
function manaPassOut() {
  if (!player.alive || passedOut > 0) return;
  cast.on = false; player.castAim = null;
  // pass out next to an enemy that knows you're there and you don't wake up
  const foe = fighters.find(o => o.alive && o.ai && o.ai.alert && hostile(o, player) && o.pos.distanceTo(player.pos) < 18);
  ui.message('MANA EXHAUSTION', 2);
  if (foe) {
    player.goDown(); passedOut = 1;
    setTimeout(() => { passedOut = 0; if (player.alive) { player.lastHitBy = foe; player.takeHit('neck', 9999, { pierce: 1, cut: 2, point: player.b.Neck.getWorldPosition(V3()), dir: V3(1, 0.2, 0), from: foe, power: 3, part: 'neck' }); } }, 2600);
    return;
  }
  passedOut = 1;
  endTalk(); closeShop();
  fadeTo(1, 1.2, () => {
    dayT = (dayT + 2 / 24) % 1;
    const inTown = Math.hypot(player.pos.x - SQUARE.x, player.pos.z - SQUARE.z) < 45;
    const lost = Math.floor(vsave.coins * (inTown ? 0.1 + Math.random() * 0.15 : 0.3 + Math.random() * 0.4));
    addCoins(-lost);
    magic.exh = 35; magic.mana = magic.max * 0.25;
    setTimeout(() => fadeTo(0, 2.5, () => { passedOut = 0; ui.sub('You wake up on the ground. Your head is splitting.' + (lost > 0 ? ' Someone took ' + money(lost) + ' while you were out.' : ''), 5); }), 900);
  });
}

// ---- casting: hold R to chant, Shift+R to cast without words, Enter to type it, or just say it ----
const cast = { on: false, spell: null, t: 0, need: 1, chantless: false, said: false, power: 1, after: 0, circle: null, words: [] };
const circleTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.translate(128, 128);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 118, 0, 7); g.stroke();
  g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 104, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 62, 0, 7); g.stroke();
  // runes around the ring
  const r = mulberry32(4);
  g.font = 'bold 15px serif';
  for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * Math.PI * 2); g.translate(0, -111); g.beginPath(); for (let k = 0; k < 3; k++) { g.moveTo((r() - 0.5) * 9, (r() - 0.5) * 9); g.lineTo((r() - 0.5) * 9, (r() - 0.5) * 9); } g.lineWidth = 1.6; g.stroke(); g.restore(); }
  // two squares make a star
  for (const a of [0, Math.PI / 4]) { g.save(); g.rotate(a); g.lineWidth = 2; g.strokeRect(-74, -74, 148, 148); g.restore(); }
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineTo(Math.cos(a) * 62, Math.sin(a) * 62); } g.closePath(); g.stroke();
  const t = new THREE.CanvasTexture(c); return t;
})();
function makeCircle() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: circleTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 4; scene.add(m); return m;
}
cast.circle = makeCircle();
const groundCircle = makeCircle(); groundCircle.rotation.x = -Math.PI / 2;
function aimInfo() {
  if (lockTarget && lockTarget.alive) return { p: chestOf(lockTarget), target: lockTarget };
  const o = camera.position.clone(), d = V3(); camera.getWorldDirection(d);
  let best = null, bt = 90;
  for (const f of fighters) {
    if (f.isPlayer || !f.alive || f.inside) continue;
    const c = chestOf(f), t = c.clone().sub(o).dot(d);
    if (t < 1 || t > bt) continue;
    if (o.clone().addScaledVector(d, t).distanceTo(c) < 0.55) { bt = t; best = f; }
  }
  // the ground (or a wall) along the view
  let hit = null;
  for (let t = 1; t < Math.min(bt, 90); t += 0.5) { const p = o.clone().addScaledVector(d, t); if (p.y < groundH(p.x, p.z)) { hit = p; break; } const b = solidAt(p.x, p.z); if (b && p.y < b.h1 && p.y > b.h0) { hit = p; break; } }
  if (best && (!hit || bt < o.distanceTo(hit))) return { p: chestOf(best), target: best };
  return { p: hit || o.clone().addScaledVector(d, 60), target: null, ground: !!hit };
}
function startChant(chantless, spellId) {
  const f = player;
  const id = spellId || magic.bar[magic.sel];
  if (!id) { ui.sub('No spell in this slot. Open your spellbook (G) to put one here.', 2.5); return; }
  const s = SPELL[id];
  if (!magic.known.includes(id)) return;
  if (magic.max < RANK_MANA[s.rank]) { ui.sub('Your mana is ' + Math.floor(magic.max) + '. ' + s.name + ' is ' + RANKS[s.rank] + ' magic and needs ' + RANK_MANA[s.rank] + '.', 3); sfx.ui(200); return; }
  if (!f.alive || f.down || f.knock || f.lift || f.attack || bandaging > 0 || passedOut) return;
  cast.on = true; cast.spell = s; cast.t = 0; cast.chantless = chantless; cast.said = false; cast.power = 1; cast.voiceT = 0;
  cast.need = chantless ? 0.18 : CHANT_T[s.rank] * (1 - Math.min(0.4, (magic.mastery[id] || 0) * 0.004));
  cast.words = s.chant.split(' ');
  f.blocking = false;
  if (!chantless) sfx.chant(f.pos, s.chant, f.voicePitch, cast.need);
  ui.chant(true);
}
function releaseChant() {
  if (!cast.on) return;
  const f = player, s = cast.spell;
  cast.on = false; ui.chant(false);
  if (!f.alive || f.down || f.knock) return;
  const done = cast.t >= cast.need || cast.said;
  if (!done) {
    // a broken chant: the mana you gathered just spills out
    payMana(spellCost(s, false, 1) * 0.3 * Math.min(1, cast.t / cast.need));
    fizzle(palm(f), s);
    if (!cast.chantless) ui.sub('The chant broke off', 1.2);
    f.castAim = null; return;
  }
  // without words it can slip away from you
  if (cast.chantless) {
    const m = magic.mastery[s.id] || 0;
    const fail = Math.max(0.02, (0.14 + s.rank * 0.13) * (1 - magic.chantless) - m * 0.0015);
    if (Math.random() < fail) { payMana(spellCost(s, true, 1) * 0.6); fizzle(palm(f), s); ui.sub('The spell slipped away from you', 1.4); magic.chantless = Math.min(1, magic.chantless + 0.004); f.castAim = null; return; }
  }
  const power = s.charge ? cast.power : 1;
  castSpell(f, s, { chantless: cast.chantless, power: power * (cast.said ? 1.08 : 1) });
}
function fizzle(p, s) { const c = SCHOOL[s.school].c; for (let i = 0; i < 16; i++) mfx.emit(true, 0, p.x, p.y, p.z, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 0.5, 0.1, 0.02, c[0], c[1], c[2], 0.8); sfx.fizzle && sfx.fizzle(p); }
// anyone casts anything through here
function castSpell(f, s, o = {}) {
  const isP = f.isPlayer;
  const ai = isP ? aimInfo() : { p: o.aim, target: o.target };
  const from = palm(f);
  let aim = ai.p.clone();
  if (s.aimGround) { aim = ai.ground || !ai.target ? ai.p.clone() : ai.target.pos.clone(); const d = Math.hypot(aim.x - f.pos.x, aim.z - f.pos.z); if (d > 38) { const k = 38 / d; aim.x = f.pos.x + (aim.x - f.pos.x) * k; aim.z = f.pos.z + (aim.z - f.pos.z) * k; } aim.y = groundH(aim.x, aim.z); }
  const dir = aim.clone().sub(from).normalize();
  if (isP) {
    payMana(spellCost(s, o.chantless, o.power || 1));
    magic.mastery[s.id] = Math.min(100, (magic.mastery[s.id] || 0) + 2.5 / (1 + (magic.mastery[s.id] || 0) / 30));
    if (o.chantless) magic.chantless = Math.min(1, magic.chantless + 0.006 / (1 + s.rank));
    // the people of Ashford see you do it
    if (!['healing', 'greaterhealing'].includes(s.id)) for (const w of witnesses(f.pos, 22)) { const st = w.vill.st; if (!magic.seenMagic[w.vill.p.id]) { magic.seenMagic[w.vill.p.id] = 1; st.fear = Math.min(100, st.fear + 6); remember(st, 'saw the dark knight cast ' + s.name.toLowerCase() + ' with his own hands'); npcSayNear && npcSayNear(w, ['...He can use magic?', 'A knight who casts spells. Gods help us.', 'Did you see that? Magic!']); } }
  } else watchMagic(f, s);
  const face = Math.atan2(dir.x, dir.z);
  if (!f.attack) { f.facing = angleLerp(f.facing, face, 0.8); f.root.rotation.y = f.facing; }
  f.castAim = from.clone().addScaledVector(dir, 0.6);
  f.castAfter = 0.4;
  s.cast({ caster: f, from, dir, aim, target: ai.target, power: o.power || 1, player: isP, chantless: o.chantless });
  const c = SCHOOL[s.school].c;
  mfx.burst.glow(from.x, from.y, from.z, 0.7, c[0], c[1], c[2], 0.25);
}
// you can learn a spell just by watching a mage cast it, a few times, close up
function watchMagic(f, s) {
  if (magic.known.includes(s.id) || !player.alive) return;
  if (f.pos.distanceTo(player.pos) > 26) return;
  const sp = chestOf(f).project(camera); if (sp.z > 1 || Math.abs(sp.x) > 1 || Math.abs(sp.y) > 1) return;
  magic.insight[s.id] = (magic.insight[s.id] || 0) + 1;
  const n = magic.insight[s.id];
  if (n >= 3) learnSpell(s.id, 'You watched ' + s.name + ' three times and figured out how it works.');
  else ui.sub('You watch the mage cast ' + s.name + ' (' + n + '/3)', 2);
  saveMagic();
}
function learnSpell(id, how) {
  if (magic.known.includes(id)) return false;
  magic.known.push(id);
  const free = magic.bar.indexOf(null);
  if (free >= 0) magic.bar[free] = id;
  const s = SPELL[id];
  ui.message('NEW SPELL: ' + s.name.toUpperCase(), 2.6);
  setTimeout(() => ui.sub((how ? how + ' ' : '') + s.name + ' is ' + RANKS[s.rank] + ' magic' + (magic.max < RANK_MANA[s.rank] ? ' (your mana is ' + Math.floor(magic.max) + ', you need ' + RANK_MANA[s.rank] + ')' : '') + '. Spellbook: G', 4.5), 900);
  sfx.learn && sfx.learn();
  saveMagic(true);
  return true;
}
function updateCasting(dt) {
  const f = player;
  updateManaPool(dt);
  if (f.castAfter > 0) { f.castAfter -= dt; if (f.castAfter <= 0 && !cast.on) f.castAim = null; }
  const C = cast.circle;
  if (cast.on) {
    if (!f.alive || f.down || f.knock || f.lift || f.stagger > 0.3 || passedOut || uiOpen) { cast.on = false; ui.chant(false); f.castAim = null; }
    else {
      cast.t += dt;
      const s = cast.spell, ai = aimInfo();
      const from = palm(f), dir = ai.p.clone().sub(from).normalize();
      f.castAim = from.clone().addScaledVector(dir, 0.6);
      // Stone Cannon: keep holding after the chant to pack it harder
      if (s.charge && cast.t > cast.need) { const want = Math.min(2.6, 1 + (cast.t - cast.need) * 0.9); const extra = spellCost(s, cast.chantless, want) - spellCost(s, cast.chantless, cast.power); if (magic.mana + magic.max * 0.15 > extra) cast.power = want; }
      const k = Math.min(1, cast.t / cast.need);
      const col = SCHOOL[s.school].c;
      C.material.color.setRGB(col[0] * 0.5, col[1] * 0.5, col[2] * 0.5);
      C.material.opacity = 0.25 + 0.75 * k;
      C.scale.setScalar((0.25 + 0.35 * k) * (s.charge ? 0.8 + cast.power * 0.25 : 1));
      C.position.copy(f.b.LeftHand.getWorldPosition(V3())).addScaledVector(dir, 0.18);
      C.lookAt(C.position.clone().add(dir)); C.rotateZ(cast.t * 2);
      if (s.rank >= 2 || s.self) {
        groundCircle.material.color.copy(C.material.color); groundCircle.material.opacity = 0.6 * k;
        groundCircle.scale.setScalar(1.6 + s.rank * 0.6); groundCircle.position.set(f.pos.x, groundH(f.pos.x, f.pos.z) + 0.04, f.pos.z); groundCircle.rotation.z = -cast.t;
      }
      if (Math.random() < dt * 30 * k) mfx.emit(true, 0, C.position.x + (Math.random() - 0.5) * 0.4, C.position.y + (Math.random() - 0.5) * 0.4, C.position.z + (Math.random() - 0.5) * 0.4, 0, 0.3, 0, 0.4, 0.05, 0.01, col[0], col[1], col[2], 0.9);
      // a chant this long is spoken in pieces
      cast.voiceT -= dt;
      ui.chantProgress(k, cast);
    }
  } else { C.material.opacity *= Math.pow(0.001, dt); groundCircle.material.opacity *= Math.pow(0.001, dt); }
}
// input
addEventListener('keydown', (e) => {
  if (!playing || paused || uiOpen || cutscene || passedOut || !player.alive) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const m = /^Digit([1-8])$/.exec(e.code);
  if (m && !e.repeat) { magic.sel = +m[1] - 1; ui.hotbar(); const id = magic.bar[magic.sel]; if (id) ui.sub(SPELL[id].name + (magic.max < RANK_MANA[SPELL[id].rank] ? '  (needs ' + RANK_MANA[SPELL[id].rank] + ' mana)' : ''), 1); }
  if (e.code === 'KeyR' && !e.repeat) { startChant(e.shiftKey); if (cast.on) micListen(); }
  if (e.code === 'KeyG' && !e.repeat) openBook();
  if (e.code === 'Enter' && !e.repeat) openCastBox();
});
addEventListener('keyup', (e) => { if (e.code === 'KeyR') releaseChant(); });

// ---- typing a spell: Enter, write the name (or the whole chant), Enter ----
function normWords(t) { return t.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function spellFromText(t) {
  const n = normWords(t);
  if (!n) return null;
  let best = null;
  for (const id of magic.known) { const s = SPELL[id], nm = normWords(s.name); if (n.includes(nm) || n.replace(/ /g, '').includes(nm.replace(/ /g, ''))) { if (!best || nm.length > normWords(best.s.name).length) best = { s, full: n.length > normWords(s.chant).length * 0.75 }; } }
  return best;
}
function openCastBox() {
  const box = document.getElementById('castBox'), inp = document.getElementById('castIn');
  if (!box) return;
  box.style.display = 'flex'; inp.value = ''; inp.focus();
  for (const k in keys) keys[k] = false;
}
function closeCastBox() { const box = document.getElementById('castBox'); if (box) box.style.display = 'none'; const inp = document.getElementById('castIn'); if (inp) inp.blur(); }
function initCastBox() {
  const inp = document.getElementById('castIn');
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Escape') { closeCastBox(); return; }
    if (e.code !== 'Enter') return;
    const r = spellFromText(inp.value);
    closeCastBox();
    if (!r) { if (inp.value.trim()) { ui.sub('Nothing happens. You do not know that spell.', 1.6); fizzle(palm(player), { school: 'arcane' }); } return; }
    if (magic.max < RANK_MANA[r.s.rank]) { ui.sub('Your mana is ' + Math.floor(magic.max) + '. ' + r.s.name + ' needs ' + RANK_MANA[r.s.rank] + '.', 3); return; }
    if (!player.alive || player.down || player.knock || player.attack) return;
    // typing the whole chant gives it a little more strength
    sfx.chant(player.pos, r.full ? r.s.chant : r.s.name + '!', player.voicePitch, r.full ? 1.6 : 0.5);
    castSpell(player, r.s, { power: r.full ? 1.1 : 1 });
  });
  inp.addEventListener('keyup', (e) => e.stopPropagation());
}

// ---- saying it into the microphone (Chrome / Edge) ----
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, recOn = false, recStartT = 0;
function micListen() {
  if (!magic.mic || !SR || recOn || performance.now() - recStartT < 1500) return;
  recStartT = performance.now();
  try {
    rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 3;
    rec.onresult = (ev) => {
      if (!cast.on) return;
      for (let i = ev.resultIndex; i < ev.results.length; i++) for (let a = 0; a < ev.results[i].length; a++) {
        const r = spellFromText(ev.results[i][a].transcript);
        if (!r) continue;
        // say a different spell than the one in your hand and that one comes out
        if (r.s !== cast.spell && magic.max >= RANK_MANA[r.s.rank]) { cast.spell = r.s; cast.words = r.s.chant.split(' '); cast.need = CHANT_T[r.s.rank]; }
        cast.said = true; ui.chantSaid(ev.results[i][a].transcript);
        return;
      }
    };
    rec.onerror = (e) => { recOn = false; if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { magic.mic = 0; saveMagic(true); ui.sub('The game was not allowed to use your microphone. You can turn it on again in Settings.', 4); } };
    rec.onend = () => { recOn = false; };
    rec.start(); recOn = true;
  } catch (e) { recOn = false; }
}
function micStop() { if (rec && recOn) { try { rec.abort(); } catch (e) {} } recOn = false; }

// ---- sounds for magic ----
Object.assign(sfx, {
  // a chant spoken in the time it takes: one quick syllable a word
  chant(pos, text, pitch = 1, dur = 1) {
    if (!ac) return;
    const words = text.split(/\s+/), n = Math.min(30, words.length);
    const out = spatial(pos, 0.3), base = 112 * pitch;
    const V = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [440, 1020], [660, 1700]];
    let t = ac.currentTime + 0.02;
    const step = Math.max(0.07, dur * 0.92 / n);
    for (let w = 0; w < n; w++) {
      const d = step * 0.8, o = ac.createOscillator(); o.type = 'sawtooth';
      const last = w === n - 1, f0 = base * (0.94 + Math.random() * 0.12) * (last ? 1.25 : 1);
      o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (last ? 0.8 : 0.97), t + d);
      const g = ac.createGain(); env(g, t, 0.012, last ? 0.75 : 0.45, d * (last ? 2 : 1));
      const [a1, a2] = V[Math.floor(Math.random() * V.length)];
      for (const [fr, q] of [[a1, 5], [a2, 7], [2500, 9]]) { const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q; o.connect(f); f.connect(g); }
      if (Math.random() < 0.6) noiseHit(t - 0.01, 0.025, 'highpass', 3500, 1, 0.12, out, 1, 0.002);
      g.connect(out); o.start(t); o.stop(t + d * 2 + 0.05);
      t += step;
    }
  },
  whoosh(pos, size = 1) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.4 * size); const f = noiseHit(t, 0.35 + size * 0.2, 'bandpass', 600, 1.2, 0.8, out, 1, 0.08); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1600 / Math.sqrt(size), t + 0.35); },
  boom(pos, size = 1) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.8 * size); tone('sine', 90, 30, t, 0.005, 1, 0.6 * size, out); noiseHit(t, 0.5 * size, 'lowpass', 900, 0.7, 1, out, 0.7, 0.005); noiseHit(t + 0.05, 1.2 * size, 'lowpass', 300, 0.7, 0.5, out, 0.5, 0.08); },
  hiss(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.35); noiseHit(t, 0.9, 'highpass', 3500, 0.6, 0.6, out, 1, 0.03); },
  crackle(n) { if (!ac) return; const t = ac.currentTime, out = spatial(null, Math.min(0.18, 0.04 + n * 0.006)); noiseHit(t, 0.012 + Math.random() * 0.02, 'highpass', 1500 + Math.random() * 3000, 1, 0.9, out); if (Math.random() < 0.3) noiseHit(t, 0.25, 'lowpass', 400, 0.8, 0.3, out, 0.5, 0.05); },
  splash(pos, size = 1) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5 * size); const f = noiseHit(t, 0.4, 'bandpass', 1200, 0.9, 0.9, out, 1, 0.005); f.frequency.exponentialRampToValueAtTime(400, t + 0.4); for (let i = 0; i < 6; i++) tone('sine', 800 + Math.random() * 1200, 300, t + 0.05 + Math.random() * 0.3, 0.003, 0.08, 0.06, out); },
  iceCrack(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.4); for (let i = 0; i < 3; i++) noiseHit(t + i * 0.02, 0.03, 'highpass', 4000, 2, 0.8, out); tone('sine', 3200, 1800, t, 0.002, 0.15, 0.25, out); },
  freeze(pos, size = 1) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.45 * size); const f = noiseHit(t, 0.8 * size, 'bandpass', 5000, 3, 0.7, out, 1, 0.1); f.frequency.exponentialRampToValueAtTime(1500, t + 0.8 * size); for (let i = 0; i < 8; i++) noiseHit(t + Math.random() * 0.6, 0.02, 'highpass', 5000, 2, 0.5, out); },
  zap(pos, size = 1) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5 * size); tone('sawtooth', 2400, 300, t, 0.002, 0.3, 0.25, out); for (let i = 0; i < 10; i++) noiseHit(t + Math.random() * 0.3, 0.015, 'highpass', 2500, 1, 0.9, out); },
  thunderNear(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 1.1); noiseHit(t, 0.12, 'highpass', 1200, 0.5, 1, out); noiseHit(t, 0.4, 'lowpass', 3000, 0.6, 1, out, 1, 0.002); const f = noiseHit(t + 0.08, 3, 'lowpass', 400, 0.8, 1, out, 0.5, 0.05); f.frequency.exponentialRampToValueAtTime(60, t + 3); },
  rumble(pos, size = 1) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.7 * size); noiseHit(t, 0.9, 'lowpass', 160, 1, 1, out, 0.4, 0.1); tone('sine', 50, 35, t, 0.05, 0.6, 0.8, out); },
  stoneShot(pos, p = 1) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5 + p * 0.15); tone('sine', 140, 60, t, 0.002, 0.7, 0.15, out); const f = noiseHit(t, 0.25, 'bandpass', 900, 2, 0.7, out, 1, 0.01); f.frequency.exponentialRampToValueAtTime(2500, t + 0.25); },
  heal(pos, big) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.3); for (const [i, n] of [72, 76, 79, 84].entries()) tone('sine', midi(n + (big ? 0 : -5)), 0, t + i * 0.08, 0.02, 0.25, 1.2, out); },
  shieldUp(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.35); tone('sine', 300, 900, t, 0.05, 0.3, 0.6, out); tone('triangle', 600, 1200, t, 0.05, 0.12, 0.6, out); },
  shieldHit(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.4); tone('sine', 900, 500, t, 0.002, 0.4, 0.3, out); noiseHit(t, 0.06, 'bandpass', 3000, 2, 0.4, out); },
  shieldBreak(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5); for (let i = 0; i < 12; i++) tone('sine', 1500 + Math.random() * 2500, 0, t + Math.random() * 0.2, 0.002, 0.15, 0.3, out); },
  drain(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.4); const f = noiseHit(t, 2.2, 'bandpass', 400, 4, 0.7, out, 0.6, 0.3); f.frequency.linearRampToValueAtTime(1400, t + 2.2); tone('sine', 110, 55, t, 0.3, 0.3, 1.8, out); },
  lift(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.35); tone('sine', 120, 480, t, 0.1, 0.4, 1.1, out); tone('sine', 181, 720, t, 0.1, 0.2, 1.1, out); },
  disturb(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5); for (let i = 0; i < 5; i++) tone('sawtooth', 200 + i * 130, 60, t + i * 0.02, 0.01, 0.12, 0.6, out); noiseHit(t, 0.5, 'bandpass', 2000, 1, 0.4, out, 1, 0.02); },
  summon(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.5); for (const [i, n] of [50, 57, 62, 65, 69].entries()) tone('sine', midi(n), 0, t + i * 0.12, 0.2, 0.18, 2.4, out); noiseHit(t, 2, 'lowpass', 600, 1, 0.4, out, 0.5, 0.5); },
  fizzle(pos) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.25); noiseHit(t, 0.25, 'highpass', 2500, 0.8, 0.5, out, 1, 0.01); tone('sine', 500, 150, t, 0.005, 0.15, 0.25, out); },
  learn() { if (!ac) return; const t = ac.currentTime, out = spatial(null, 0.25); for (const [i, n] of [62, 66, 69, 74].entries()) tone('triangle', midi(n), 0, t + i * 0.1, 0.01, 0.4, 0.9, out); },
  wind(pos, dur) { if (!ac) return; const t = ac.currentTime, out = spatial(pos, 0.7); const f = noiseHit(t, dur, 'bandpass', 500, 1.5, 0.9, out, 0.8, 0.8); for (let i = 0; i < dur; i++) f.frequency.setValueAtTime(350 + Math.random() * 500, t + i); },
});

// ---- per frame ----
function updateMagic(dt, realDt, t) {
  if (dt > 0) { updateCasting(dt); updateProjs(dt); updateEffects(dt); updateSummons(dt, t); }
  updateLights(realDt);
}
