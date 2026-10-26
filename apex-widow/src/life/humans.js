// People (Quaternius CC0 bodies + animations). Night-shift workers with routines. What they do when they see you
// depends on who they are and how big you are: stomp you, spray you, scream and run, film you, call security,
// shoot. Big enough and you can paralyze them, wrap them in silk and drain them (no gore: they become a cocoon).
import * as THREE from 'three';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltf, hasAsset } from '../core/assets.js';
import { clamp, rand, pick, damp } from '../core/util.js';

const ROLE = {
  voss:         { file: 'm-suit', h: 1.82, colors: { Suit: 0xe9e9e4, Tie: 0x111111, Grey: 0x2a2a2e }, pers: 'pro', name: 'Dr. Elias Voss' },
  tech:         { file: 'f-worker', h: 1.66, colors: { Worker_Vest: 0xeef0f2, Worker_Yellow: 0xd8dde2 }, pers: ['scared', 'curious', 'brave'] },
  animaltech:   { file: 'm-worker', h: 1.78, colors: { Worker_Vest: 0x2c5a8a, Worker_Yellow: 0x3a6a9a }, pers: ['brave', 'curious', 'scared'] },
  guard:        { file: 'm-suit', h: 1.84, colors: { Suit: 0x15181f, Grey: 0x1a1d24, Tie: 0x0a0a0a, White: 0x9aa0a8 }, pers: 'guard', gun: true },
  office:       { file: ['m-suit', 'f-suit', 'f-formal', 'm-casual-2', 'f-casual'], h: [1.78, 1.66], pers: ['scared', 'curious', 'brave', 'scared'] },
  janitor:      { file: 'm-worker', h: 1.76, colors: { Worker_Vest: 0x4a5462, Worker_Yellow: 0x5a6472 }, pers: 'spray' },
  cook:         { file: 'm-casual-2', h: 1.8, colors: {}, pers: ['brave', 'brave', 'scared'] },
  cleaner:      { file: 'f-worker', h: 1.62, colors: { Worker_Vest: 0x6a4a8a, Worker_Yellow: 0x7a5a9a }, pers: ['spray', 'scared'] },
  gymguy:       { file: 'm-adventurer', h: 1.86, colors: {}, pers: 'brave' },
  it:           { file: 'm-casual-hoodie', h: 1.74, colors: {}, pers: ['curious', 'scared'] },
  receptionist: { file: 'f-formal', h: 1.68, colors: {}, pers: ['scared', 'curious'] },
  hazmat:       { file: 'm-worker', h: 1.8, colors: { Worker_Vest: 0xd8c018, Worker_Yellow: 0xe0c820, Skin: 0xc8b878 }, pers: 'catch' },
  swat:         { file: 'm-swat', h: 1.84, colors: {}, pers: 'guard', gun: true },
  police:       { file: ['m-suit', 'f-suit'], h: [1.8, 1.7], colors: { Suit: 0x14213a, Grey: 0x1a2232, Tie: 0x0a0a10, White: 0x8a96aa }, pers: 'guard', gun: true },
  soldier:      { file: 'f-soldier', h: 1.72, colors: {}, pers: 'guard', gun: true },
  citizen:      { file: ['m-casual-2', 'm-casual-hoodie', 'f-casual', 'f-formal', 'm-suit', 'f-suit', 'm-adventurer'], h: [1.77, 1.65], pers: ['scared', 'scared', 'curious', 'brave'] },
};
const NAMES = ['Dana Ruiz', 'Marcus Webb', 'Priya Nair', 'Tom Kowalski', 'Lena Fischer', 'Andre Okafor', 'Sam Haller', 'Grace Lin', 'Victor Hale', 'Nina Brandt', 'Omar Haddad', 'Kate Moreno', 'Leo Park', 'Ruth Adler'];
const LINES = {
  scared: ['Oh my God... what is that?!', 'Spider! SPIDER!', 'Somebody get security!', 'Nope. Nope nope nope.', 'It was in the lab... it got OUT?'],
  brave: ['Hold still, you little...', 'Come here.', 'I got it, I got it!', 'Ugh. Gross.'],
  curious: ['Is that... a black widow?', 'Hey, look at this thing.', 'Hold on, I\'m filming this.', 'That is NOT a normal spider.'],
  guard: ['Security, floor {f}. I have a... a specimen.', 'Don\'t move!', 'It\'s getting bigger!', 'Shots fired! Shots fired!'],
  spray: ['Not on my floor.', 'Where did you come from?', 'Eat this.'],
  pro: ['Specimen 8. There you are.', 'Easy now.', 'You were never supposed to leave the tank.'],
  catch: ['Target sighted. Bring the jar.', 'Containment team, move.', 'Alive! Voss wants it alive!'],
};

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class Humans {
  constructor(zone) { this.zone = zone; this.game = zone.game; this.scene = zone.scene; this.list = []; this.src = {}; this.clips = {}; this.ready = false; }
  async load() {
    const files = new Set();
    for (const r of Object.values(ROLE)) for (const f of [].concat(r.file)) files.add(f);
    for (const f of files) { if (!hasAsset(`humans/${f}.glb`)) continue; try { this.src[f] = (await gltf(`humans/${f}.glb`)).scene; } catch (e) { console.warn('human', f, e); } }
    for (const sex of ['m', 'f']) {
      if (!hasAsset(`humans/anims-${sex}.glb`)) continue;
      const g = await gltf(`humans/anims-${sex}.glb`);
      this.clips[sex] = {}; for (const c of g.animations) this.clips[sex][c.name] = c;
    }
    this.ready = Object.keys(this.src).length > 0 && this.clips.m;
  }
  spawn(o) {
    if (!this.ready) return null;
    const h = new Human(this, o);
    this.list.push(h);
    return h;
  }
  update(dt) {
    const P = this.game.player;
    const Z = this.zone;
    for (const h of this.list) {
      if (h.state === 'gone') continue;
      h.inner.visible = h.state !== 'eaten' && (!Z.canSee || Z.canSee(h.pos));
      h.update(dt, P);
    }
  }
  near(p, r, filter) { return this.list.filter(h => h.state !== 'gone' && h.pos.distanceTo(p) < r && (!filter || filter(h))); }
  nearest(p, r, filter) { let b = null, bd = r; for (const h of this.list) { if (h.state === 'gone' || (filter && !filter(h))) continue; const d = h.pos.distanceTo(p); if (d < bd) { bd = d; b = h; } } return b; }
  raycast(o, d, far) {
    let best = null, bt = far;
    for (const h of this.list) {
      if (h.state === 'gone' || h.state === 'eaten') continue;
      const c = _v.copy(h.pos); c.y += h.height * 0.5;
      const oc = _v2.subVectors(c, o), t = oc.dot(d);
      if (t < 0 || t > bt) continue;
      if (oc.lengthSq() - t * t < 0.3 * 0.3 + (h.height * 0.25) ** 2) { bt = t; best = h; }
    }
    return best ? { h: best, t: bt } : null;
  }
}

export class Human {
  constructor(sys, o) {
    this.sys = sys; this.role = o.role; this.def = ROLE[o.role] || ROLE.citizen;
    const files = [].concat(this.def.file); const file = pick(files.filter(f => sys.src[f]).length ? files.filter(f => sys.src[f]) : Object.keys(sys.src));
    this.sex = file.startsWith('f-') ? 'f' : 'm';
    const hs = [].concat(this.def.h); this.height = (this.sex === 'f' ? hs[hs.length - 1] : hs[0]) * rand(0.96, 1.04);
    this.name = this.def.name || pick(NAMES);
    this.pers = Array.isArray(this.def.pers) ? pick(this.def.pers) : this.def.pers;
    this.floor = o.floor; this.y0 = o.y; this.outside = !!o.outside; this.path = o.path ? o.path.map(([x, z]) => new THREE.Vector3(x, o.y, z)) : null; this.pathI = 0;
    this.pos = new THREE.Vector3(o.x, o.y, o.z); this.yaw = o.rot || 0;
    this.home = this.pos.clone(); this.sit = !!o.sit;
    this.hp = 100; this.venom = 0; this.state = this.path ? 'walk' : 'work'; this.timer = rand(2, 8);
    this.noticed = false; this.alertT = 0; this.cd = 0; this.lineT = 0;
    this.root = skClone(sys.src[file]);
    this.root.traverse(n => {
      if (n.isMesh) {
        n.castShadow = true; n.receiveShadow = true; n.frustumCulled = true;
        if (/pistol/i.test(n.name)) { n.visible = false; this.gun = n; }
        n.material = tuneMat(n.material, this.def.colors || {});
      }
    });
    // scale the model to its real height (feet on the ground)
    this.root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(this.root);
    const k = this.height / Math.max(0.5, bb.max.y - bb.min.y);
    this.inner = new THREE.Group(); this.inner.add(this.root); this.root.scale.setScalar(k); this.root.position.y = -bb.min.y * k;
    sys.scene.add(this.inner);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.acts = {};
    const clips = sys.clips[this.sex] || sys.clips.m;
    for (const n of ['Idle', 'Idle_Neutral', 'Walk', 'Run', 'Interact', 'Kick_Right', 'Death', 'HitRecieve', 'Idle_Gun_Pointing', 'Idle_Gun_Shoot', 'Gun_Shoot', 'Wave', 'Run_Back']) if (clips[n]) this.acts[n] = this.mixer.clipAction(clips[n]);
    if (this.acts.Death) { this.acts.Death.setLoop(THREE.LoopOnce); this.acts.Death.clampWhenFinished = true; }
    if (this.acts.Kick_Right) { this.acts.Kick_Right.setLoop(THREE.LoopOnce); this.acts.Kick_Right.clampWhenFinished = false; }
    this.play(this.state === 'walk' ? 'Walk' : this.sit ? 'Interact' : 'Idle');
    this.mixer.update(rand(0, 2));
    this.box = sys.zone.dyn.add(new THREE.Vector3(), new THREE.Vector3(), { minSize: 0.004, obj: this, tag: 'human' });
    this.place();
  }
  play(name, fade = 0.25) {
    const a = this.acts[name] || this.acts.Idle; if (!a || a === this.cur) return;
    a.reset().fadeIn(fade).play();
    if (this.cur) this.cur.fadeOut(fade);
    this.cur = a;
  }
  say(kind) {
    if (this.lineT > 0) return; this.lineT = 6;
    const L = LINES[kind] || LINES.scared; const txt = pick(L).replace('{f}', this.floor || '');
    const G = this.sys.game; const P = G.player;
    if (G.hud && G.hud.voice) G.hud.voice(this.name, txt, P ? P.sizeM : 1, this.pos);
    if (G.audio && G.audio.voice) G.audio.voice(this, P ? P.sizeM : 1);
  }
  get helpless() { return this.state === 'paralyzed' || this.state === 'wrapped' || this.state === 'eaten'; }
  hurt(dmg, venom = 0) {
    if (this.helpless) { this.venom += venom; return; }
    this.hp -= dmg; this.venom += venom;
    if (this.acts.HitRecieve && Math.random() < 0.5) { /* flinch */ }
    if (this.venom > 60 || this.hp <= 20) { this.state = 'paralyzed'; this.play('Death', 0.3); this.box.on = false; this.sys.game.wanted && this.sys.game.wanted.crime('attack', this.pos); }
    else if (!this.noticed) { this.noticed = true; this.react(this.sys.game.player); }
  }
  react(P) {
    const ratio = P.sizeM / 1.75;
    let st = 'flee';
    if (this.pers === 'pro') st = 'watch';
    else if (this.pers === 'catch') st = 'catch';
    else if (this.pers === 'guard') st = ratio < 0.06 ? 'stomp' : 'shoot';
    else if (ratio > 0.45) st = 'flee';
    else if (this.pers === 'spray') st = 'spray';
    else if (this.pers === 'brave') st = ratio < 0.2 ? 'stomp' : 'flee';
    else if (this.pers === 'curious') st = ratio < 0.25 ? 'film' : 'flee';
    this.state = st; this.timer = st === 'film' ? 10 : 30;
    this.say(this.pers === 'guard' ? 'guard' : this.pers === 'spray' ? 'spray' : this.pers);
    if (st === 'flee' || st === 'film' || st === 'shoot') this.sys.game.wanted && this.sys.game.wanted.seen(this.pos, P.sizeM, st);
  }
  canSee(P) {
    const d = this.pos.distanceTo(P.pos);
    const range = clamp(P.sizeM * 200, 0.35, 90);
    if (d > range) return false;
    if (P.hidden && d > range * 0.3) return false;
    const eye = _v.copy(this.pos); eye.y += this.height * 0.93;
    const to = _v2.subVectors(P.pos, eye); const dist = to.length(); to.divideScalar(dist);
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const ang = fwd.dot(new THREE.Vector3(to.x, 0, to.z).normalize());
    if (ang < 0.15 && d > 0.6) return false;
    const hit = this.sys.zone.collision.raycast(eye, to, dist - P.s * 0.6, 0.05);
    return !hit || hit.obj === this;
  }
  update(dt, P) {
    if (this.inner.visible || (P && this.pos.distanceTo(P.pos) < 12)) this.mixer.update(dt);
    this.cd = Math.max(0, this.cd - dt); this.lineT = Math.max(0, this.lineT - dt);
    if (this.state === 'eaten') return;
    if (this.state === 'paralyzed' || this.state === 'wrapped') { this.venom = Math.max(0, this.venom - dt * 0.4); this.place(); return; }
    const alive = P && P.mode !== 'dead';
    if (alive && !this.noticed && this.canSee(P)) { this.noticed = true; this.react(P); }
    let speed = 0, face = null;
    const toP = alive ? _v.subVectors(P.pos, this.pos) : null; if (toP) toP.y = 0;
    const dP = toP ? toP.length() : 99;
    switch (this.state) {
      case 'work': this.play(this.sit ? 'Interact' : 'Idle'); this.timer -= dt; if (this.timer < 0 && this.path) { this.state = 'walk'; } break;
      case 'walk': {
        const tgt = this.path[this.pathI];
        const d = _v2.subVectors(tgt, this.pos); d.y = 0;
        if (d.length() < 0.25) {
          if (this.onPathEnd === 'leave' && this.pathI === this.path.length - 1) { this.leave(); break; }
          this.pathI = (this.pathI + 1) % this.path.length; if (!this.onPathEnd && Math.random() < 0.3) { this.state = 'work'; this.timer = rand(3, 10); }
        }
        else { speed = 1.3; face = d; this.play('Walk'); }
        break;
      }
      case 'stomp': case 'catch': {
        if (!alive || dP > 12 || P.pos.y > this.pos.y + 1.4) { this.timer -= dt * 3; }
        this.timer -= dt; if (this.timer < 0) { this.state = this.path ? 'walk' : 'work'; this.noticed = false; break; }
        face = toP;
        if (dP > 0.42) { speed = this.state === 'catch' ? 2.2 : 1.6; this.play(speed > 2 ? 'Run' : 'Walk'); }
        else if (this.cd <= 0) {
          this.cd = 1.3; this.play('Kick_Right', 0.08); this.kickAt = 0.32;
        }
        if (this.kickAt !== undefined) { this.kickAt -= dt; if (this.kickAt <= 0) { this.kickAt = undefined; this.stompHit(P); } }
        if (this.cur === this.acts.Kick_Right && this.cd < 0.4) this.play('Idle');
        break;
      }
      case 'spray': {
        this.timer -= dt; if (this.timer < 0 || !alive || dP > 14) { this.state = this.path ? 'walk' : 'work'; this.noticed = false; break; }
        face = toP;
        if (dP > 1.3) { speed = 1.4; this.play('Walk'); }
        else { this.play('Idle_Gun_Pointing'); this.sprayHit(P, dt); }
        break;
      }
      case 'shoot': {
        this.timer -= dt; if (this.timer < 0 || !alive) { this.state = 'flee'; break; }
        face = toP; if (this.gun) this.gun.visible = true;
        if (dP < 3 && P.sizeM > 0.5) { this.state = 'flee'; break; }
        this.play('Idle_Gun_Shoot');
        if (this.cd <= 0) { this.cd = 0.55; this.shoot(P); }
        break;
      }
      case 'film': {
        this.timer -= dt; face = toP; this.play('Idle_Gun_Pointing');
        if (this.timer < 0 || !alive) { this.state = this.path ? 'walk' : 'work'; this.noticed = false; this.sys.game.story && this.sys.game.story.posted && this.sys.game.story.posted(this); }
        if (alive && dP < Math.max(0.4, P.sizeM * 3)) { this.state = 'flee'; this.say('scared'); }
        break;
      }
      case 'watch': face = toP; this.play('Idle'); if (alive && dP < 1.2 && P.sizeM < 0.1) { this.state = 'stomp'; this.timer = 20; } break;
      case 'flee': {
        this.timer -= dt;
        const away = toP ? toP.clone().negate() : new THREE.Vector3(0, 0, -1);
        if (this.outside) {
          if (!alive || dP > Math.max(40, P.sizeM * 25) || this.timer < 0) { this.leave(); break; }
          face = away.normalize(); speed = 4.6; this.play('Run');
          if (Math.random() < dt * 0.4) this.say('scared');
          break;
        }
        // run toward the elevator lobby / stairs, away from you
        const exit = new THREE.Vector3(this.pos.z > 0 ? 7.1 : -3.5, this.pos.y, this.pos.z > 0 ? 6.3 : -6.3);
        const dir = exit.sub(this.pos); dir.y = 0;
        if (dir.length() < 0.6) { this.leave(); break; }
        face = dir.normalize().multiplyScalar(0.6).add(away.normalize().multiplyScalar(dP < 4 ? 1 : 0.2));
        speed = 4.2; this.play('Run');
        if (Math.random() < dt * 0.4) this.say('scared');
        break;
      }
    }
    if (face && face.lengthSq() > 1e-6) { const yw = Math.atan2(face.x, face.z); let dy = yw - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * (1 - Math.exp(-dt * 8)); }
    if (speed > 0) {
      const f = _v2.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const nx = this.pos.x + f.x * speed * dt, nz = this.pos.z + f.z * speed * dt;
      // don't walk through walls: probe at knee height
      const knee = new THREE.Vector3(this.pos.x, this.pos.y + 0.45, this.pos.z);
      const hit = this.sys.zone.collision.raycast(knee, f, speed * dt + 0.3, 1.0);
      if (!hit || hit.obj === this) { this.pos.x = nx; this.pos.z = nz; }
      else { this.yaw += (Math.random() < 0.5 ? 1 : -1) * 1.2; }
    }
    this.place();
  }
  place() {
    this.inner.position.copy(this.pos); this.inner.rotation.y = this.yaw;
    const r = 0.22;
    this.box.min.set(this.pos.x - r, this.pos.y, this.pos.z - r); this.box.max.set(this.pos.x + r, this.pos.y + this.height * (this.state === 'paralyzed' || this.state === 'wrapped' ? 0.25 : 1), this.pos.z + r);
  }
  footPos() { return new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 0.3, this.pos.y, this.pos.z + Math.cos(this.yaw) * 0.3); }
  stompHit(P) {
    if (!P || P.mode === 'dead') return;
    const G = this.sys.game;
    G.audio && G.audio.at && G.audio.at('stomp', this.footPos());
    G.cam.addShake(P.sizeM < 0.1 ? 0.35 : 0.15);
    const foot = this.footPos(); const d = Math.hypot(foot.x - P.pos.x, foot.z - P.pos.z);
    if (d < 0.14 + P.s * 0.5 && P.pos.y < this.pos.y + 0.25) {
      const dmg = P.sizeM < 0.05 ? (G.realistic ? 999 : 70) : P.sizeM < 0.2 ? 35 : 12;
      P.hurt(dmg, 'stepped on by ' + this.name);
    }
  }
  sprayHit(P, dt) {
    const G = this.sys.game;
    G.fx && G.fx.spray && G.fx.spray(this, P);
    const nozzle = new THREE.Vector3(this.pos.x, this.pos.y + 1.2, this.pos.z);
    const to = _v2.subVectors(P.pos, nozzle); const d = to.length();
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (d < 2.4 && f.dot(to.normalize()) > 0.75) P.hurt(dt * (P.sizeM < 0.1 ? 18 : 6) * (G.realistic ? 2 : 1), 'bug spray');
  }
  shoot(P) {
    const G = this.sys.game;
    const muzzle = new THREE.Vector3(this.pos.x + Math.sin(this.yaw) * 0.4, this.pos.y + 1.35, this.pos.z + Math.cos(this.yaw) * 0.4);
    G.fx && G.fx.muzzle && G.fx.muzzle(muzzle, this.yaw);
    G.audio && G.audio.at && G.audio.at('gunshot', muzzle);
    const d = muzzle.distanceTo(P.pos);
    const hitChance = clamp(P.sizeM * 1.4 / (d * 0.15 + 0.4), 0.05, 0.85) * (P.vel.length() > P.s * 2 ? 0.5 : 1);
    if (Math.random() < hitChance) P.hurt(14 * (G.realistic ? 2 : 1) / Math.max(1, P.sizeM), 'shot by ' + this.name);
    else G.fx && G.fx.ricochet && G.fx.ricochet(P.pos.clone().add(new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)).multiplyScalar(P.s * 2)));
  }
  leave() { this.state = 'gone'; this.inner.visible = false; this.box.on = false; }
  wrap() { this.state = 'wrapped'; }
  consumed() { this.state = 'eaten'; this.inner.visible = false; this.box.on = false; }
}

// Quaternius flat colours -> nicer physically based materials (skin sheen, fabric roughness)
const MAT_CACHE = new Map();
function tuneMat(m, colors) {
  const key = m.name + JSON.stringify(colors[m.name] ?? null);
  if (MAT_CACHE.has(key)) return MAT_CACHE.get(key);
  const n = m.name || '';
  const col = colors[n] !== undefined ? new THREE.Color(colors[n]) : (m.color ? m.color.clone() : new THREE.Color(0x888888));
  let out;
  if (/skin/i.test(n)) out = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.55, sheen: 0.35, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffd2c0), clearcoat: 0.08 });
  else if (/eye/i.test(n)) out = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.05, clearcoat: 1 });
  else if (/hair|brow|moustache/i.test(n)) out = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.6, sheen: 0.6, sheenColor: col.clone().multiplyScalar(1.6) });
  else if (/metal|gold|pistol|visor/i.test(n)) out = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.9 });
  else out = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.82, sheen: 0.4, sheenRoughness: 0.8, sheenColor: col.clone().lerp(new THREE.Color(1, 1, 1), 0.3) });
  out.name = n;
  MAT_CACHE.set(key, out);
  return out;
}
