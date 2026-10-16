// Runs gadgets: firing, projectiles, teleporter pads, black holes, time-stop fields, object forms,
// and what every core actually does to a person, bug, item, car or the ground.
import * as THREE from 'three';
import { BODIES, CORES, OBJECT_TYPES, EMOTION_CYCLE, instability } from './parts.js';
import { buildGadgetModel } from './model.js';
import { TINY } from '../life/items.js';
import { CAGE } from '../world/cage.js';
import { rand, clamp } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { settings } from '../core/settings.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// --------------------------------------------------------------- object forms (object gun)
const objMats = {};
const om = (c, r = 0.6, m = 0) => (objMats[c + ':' + r + ':' + m] ||= new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m }));
export function makeObjectMesh(type) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
  // all models are about 1 unit tall
  switch (type) {
    case 'chair': add(new THREE.BoxGeometry(0.5, 0.06, 0.5), om(0x8a5a3a), 0, 0.45, 0); add(new THREE.BoxGeometry(0.5, 0.55, 0.06), om(0x8a5a3a), 0, 0.75, -0.22); for (const [x, z] of [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), om(0x6a4a2a), x, 0.225, z); break;
    case 'cup': add(new THREE.CylinderGeometry(0.32, 0.26, 0.7, 20, 1, true), om(0xf0f0f0, 0.3), 0, 0.35, 0).material.side = THREE.DoubleSide; add(new THREE.TorusGeometry(0.15, 0.04, 8, 14, Math.PI), om(0xf0f0f0, 0.3), 0.34, 0.38, 0, 0, 0, -Math.PI / 2); add(new THREE.CircleGeometry(0.26, 20), om(0xf0f0f0, 0.3), 0, 0.01, 0, -Math.PI / 2); break;
    case 'rock': add(new THREE.DodecahedronGeometry(0.45), om(0x8a8780, 0.9), 0, 0.35, 0); break;
    case 'lamp': add(new THREE.CylinderGeometry(0.2, 0.25, 0.08, 16), om(0x2a2a2a, 0.4, 0.6), 0, 0.04, 0); add(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), om(0x2a2a2a, 0.4, 0.6), 0, 0.4, 0); add(new THREE.CylinderGeometry(0.15, 0.3, 0.28, 16, 1, true), om(0xf0e0b0, 0.8), 0, 0.85, 0).material.side = THREE.DoubleSide; break;
    case 'teddy': add(new THREE.SphereGeometry(0.28, 14, 10), om(0x9a6a3a, 0.95), 0, 0.3, 0); add(new THREE.SphereGeometry(0.2, 14, 10), om(0x9a6a3a, 0.95), 0, 0.7, 0); for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.07, 10, 8), om(0x9a6a3a, 0.95), s * 0.14, 0.88, 0); add(new THREE.SphereGeometry(0.1, 10, 8), om(0x9a6a3a, 0.95), s * 0.26, 0.4, 0.05); } add(new THREE.SphereGeometry(0.035, 8, 6), om(0x111111, 0.3), 0, 0.68, 0.19); break;
    case 'shoe': add(new THREE.BoxGeometry(0.4, 0.3, 0.9), om(0xd04040, 0.6), 0, 0.15, 0); add(new THREE.BoxGeometry(0.42, 0.08, 0.95), om(0xf0f0f0, 0.7), 0, 0.04, 0); break;
    case 'can': add(new THREE.CylinderGeometry(0.25, 0.25, 0.9, 20), om(0xc02020, 0.3, 0.7), 0, 0.45, 0); add(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 20), om(0xc0c4c8, 0.3, 0.9), 0, 0.91, 0); break;
    case 'book': add(new THREE.BoxGeometry(0.6, 0.15, 0.8), om(0x2a4a8a, 0.7), 0, 0.075, 0); add(new THREE.BoxGeometry(0.56, 0.13, 0.76), om(0xf0ead0, 0.9), 0.025, 0.075, 0); break;
    case 'toilet': add(new THREE.CylinderGeometry(0.3, 0.22, 0.45, 16), om(0xf8f8f8, 0.2), 0, 0.22, 0.08); add(new THREE.BoxGeometry(0.5, 0.45, 0.2), om(0xf8f8f8, 0.2), 0, 0.65, -0.25); add(new THREE.TorusGeometry(0.25, 0.05, 8, 16), om(0xf8f8f8, 0.2), 0, 0.46, 0.08, Math.PI / 2); break;
    case 'traffic cone': add(new THREE.ConeGeometry(0.3, 0.95, 16), om(0xff6a10, 0.6), 0, 0.5, 0); add(new THREE.BoxGeometry(0.7, 0.04, 0.7), om(0x222222, 0.8), 0, 0.02, 0); break;
    case 'pumpkin': add(new THREE.SphereGeometry(0.42, 16, 12), om(0xe36d14, 0.6), 0, 0.38, 0).scale.y = 0.8; add(new THREE.CylinderGeometry(0.04, 0.06, 0.15, 6), om(0x4a5a2a), 0, 0.75, 0); break;
    case 'trophy': add(new THREE.CylinderGeometry(0.25, 0.1, 0.4, 16, 1, true), om(0xd8b04a, 0.25, 0.9), 0, 0.75, 0).material.side = THREE.DoubleSide; add(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), om(0xd8b04a, 0.25, 0.9), 0, 0.4, 0); add(new THREE.BoxGeometry(0.4, 0.2, 0.4), om(0x2a1a10, 0.6), 0, 0.1, 0); break;
    case 'fish bowl': { const b = add(new THREE.SphereGeometry(0.45, 18, 14), new THREE.MeshPhysicalMaterial({ color: 0xcfefff, transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 0.45, 0); b.castShadow = false; add(new THREE.SphereGeometry(0.4, 16, 12, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x3a8aff, transparent: true, opacity: 0.6 }), 0, 0.45, 0); add(new THREE.SphereGeometry(0.07, 10, 8), om(0xff8a20, 0.4), 0.1, 0.3, 0); break; }
    case 'brick': add(new THREE.BoxGeometry(0.9, 0.3, 0.45), om(0xa0482a, 0.9), 0, 0.15, 0); break;
    case 'pillow': add(new THREE.SphereGeometry(0.5, 16, 10), om(0xeae4f8, 0.95), 0, 0.15, 0).scale.set(1, 0.3, 0.7); break;
    default: add(new THREE.BoxGeometry(0.6, 0.6, 0.6), om(0x888888), 0, 0.3, 0);
  }
  return g;
}

export class Gadgets {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.pads = [];
    this.holes = [];
    this.fields = [];
    this.scaling = [];
    this.lastFire = new Map();
    this.models = new Map();
  }

  model(bp) {
    const key = JSON.stringify([bp.body, bp.cores, bp.mod, bp.stats.power, bp.opts.color]);
    if (!this.models.has(key)) this.models.set(key, buildGadgetModel(bp));
    return this.models.get(key).clone();
  }

  // range / size of effects is relative to how big YOU are right now
  sizeOf(t) {
    if (!t) return 1;
    switch (t.kind) {
      case 'person': return t.ref.height;
      case 'bug': return t.ref.size;
      case 'item': return t.ref.radius * 2;
      case 'car': return t.ref.length;
      case 'player': return t.ref.height;
      default: return 0;
    }
  }

  // -------------------------------------------------------------- firing
  // aim: {origin, dir}. Called on click (and every frame while held for 'hold' gadgets).
  fire(bp, aim, held = false, dt = 0) {
    const g = this.game;
    const pl = g.player;
    const body = BODIES[bp.body];
    const S = pl.height / 1.75; // your size factor
    const now = g.time;
    // money mode battery
    const cost = bp.cores.reduce((s, k) => s + (CORES[k] ? CORES[k].cost : 1), 0) * (0.5 + bp.stats.power / 10) * (bp.mod === 'hold' ? dt * 0.5 : 0.04);
    if (g.mode === 'money') {
      if ((bp.charge ?? 1) <= 0) { if (!held) { sfx('error'); g.toast(`${bp.name} is out of battery. Charge it at the dock on the workbench.`); } return; }
      bp.charge = Math.max(0, (bp.charge ?? 1) - cost);
    }
    if (!held) {
      const last = this.lastFire.get(bp.id) || 0;
      if (now - last < 1 / body.rate) return;
      this.lastFire.set(bp.id, now);
    }
    // backfire (setting)
    if (settings.backfires && !held && rand() < instability(bp)) { this.backfire(bp, aim); return; }
    const range = body.range * S;
    const color = bp.opts.color != null ? bp.opts.color : (CORES[bp.cores[0]] || {}).color || 0xffffff;
    const muzzle = pl.muzzlePos();
    const ctx = { bp, S, color, source: 'player', dir: aim.dir.clone() };
    // special starter tools
    if (bp.opts.pads) { this.placePad(aim, S, bp); return; }
    if (bp.opts.tractor) { this.tractor(aim, range, dt, held); return; }
    if (body.placed) { this.placeTrap(bp, aim, S, ctx); return; }
    if (body.aura) {
      g.fx.ring(pl.feetPos.clone().add(_v.set(0, pl.height * 0.3, 0)), color, S * 1.75 * bp.stats.area * 0.6, 0.6);
      sfx('zap', { pitch: 0.7 });
      for (const t of g.targetsInRadius(pl.feetPos, S * 1.75 * bp.stats.area * 0.6, { notPlayer: true })) this.apply(bp, t, ctx);
      return;
    }
    if (body.touch) {
      const hit = g.pick(aim.origin, aim.dir, pl.reach, { notPlayer: true });
      g.player.punchAnim();
      if (hit && hit.kind !== 'ground' && hit.kind !== 'wall') { g.fx.burst(hit.point, color, 10, this.sizeOf(hit) || S, 1, { glow: true }); this.apply(bp, hit, ctx); sfx('zap'); } else sfx('click');
      return;
    }
    const shots = Math.max(1, Math.min(5, bp.stats.shots | 0));
    for (let s = 0; s < shots; s++) {
      const dir = aim.dir.clone();
      if (shots > 1 || bp.mod === 'spray') { dir.x += (rand() - 0.5) * 0.06 * shots; dir.y += (rand() - 0.5) * 0.04 * shots; dir.z += (rand() - 0.5) * 0.06 * shots; dir.normalize(); }
      if (bp.mod === 'bolt' || bp.mod === 'homing' || bp.mod === 'burst' || body.lob) {
        const speed = (body.lob ? 9 : bp.mod === 'homing' ? 7 : 14) * Math.sqrt(S) * (body.heavy ? 0.8 : 1);
        this.projectiles.push({ bp, pos: muzzle.clone(), vel: dir.clone().multiplyScalar(speed).add(body.lob ? _v.set(0, speed * 0.35, 0) : _v.set(0, 0, 0)), life: 4, size: 0.02 * S * (body.heavy ? 2 : 1), color, ctx, g: body.lob ? 9.8 * Math.sqrt(S) : 0, homing: bp.mod === 'homing', burst: bp.mod === 'burst' || body.lob, mesh: this.boltMesh(color, 0.02 * S * (body.heavy ? 2 : 1)) });
        sfx('zap', { pitch: body.heavy ? 0.6 : 1.2 });
        continue;
      }
      if (bp.mod === 'spray') {
        const tgts = g.targetsInCone(aim.origin, dir, range * 0.5, 0.35, { notPlayer: true });
        for (let i = 0; i < 26; i++) { const d = dir.clone(); d.x += (rand() - 0.5) * 0.5; d.y += (rand() - 0.5) * 0.3; d.z += (rand() - 0.5) * 0.5; g.fx.burst(muzzle, color, 1, S * 0.2, 0, { glow: true }); g.fx.glows[g.fx.glows.length - 1] && g.fx.glows[g.fx.glows.length - 1].v.copy(d.normalize().multiplyScalar(range * 0.9)); }
        for (const t of tgts) this.apply(bp, t, ctx);
        sfx('steam', { pitch: 1.5 });
        continue;
      }
      // beam / chain / rain / pulse / hold: instant hit
      const hit = g.pick(aim.origin, dir, range, { notPlayer: true });
      const end = hit ? hit.point : aim.origin.clone().addScaledVector(dir, range);
      if (bp.mod !== 'rain') g.fx.beam(muzzle, end, color, 0.004 * S, held ? 0.05 : 0.18);
      if (!held) sfx(bp.cores.includes('shrink') ? 'shrink' : bp.cores.includes('grow') ? 'grow' : 'beam');
      if (!hit) continue;
      if (bp.mod === 'rain') { this.rain(bp, hit.point, ctx); continue; }
      if (bp.mod === 'pulse') { g.fx.ring(hit.point, color, S * 0.4 * bp.stats.area, 0.5); for (const t of g.targetsInRadius(hit.point, S * 0.25 * bp.stats.area)) this.apply(bp, t, ctx); continue; }
      if (hit.kind === 'ground' || hit.kind === 'wall') { this.applyGround(bp, hit, ctx); continue; }
      this.apply(bp, hit, ctx);
      if (bp.mod === 'chain') {
        let from = hit, hops = 2 + Math.floor(bp.stats.area / 3);
        const done = new Set([hit.ref]);
        while (hops-- > 0) {
          const next = g.targetsInRadius(from.point, this.sizeOf(from) * 5 + S * 0.1).filter((t) => !done.has(t.ref) && t.kind !== 'player')[0];
          if (!next) break;
          done.add(next.ref);
          g.fx.beam(from.point, next.point, color, 0.002 * S, 0.25);
          this.apply(bp, next, ctx);
          from = next;
        }
      }
    }
  }

  boltMesh(color, size) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.game.scene.add(m);
    return m;
  }

  backfire(bp, aim) {
    const g = this.game;
    const what = rand.pick(['self', 'random', 'boom']);
    sfx('error');
    if (what === 'self') { g.toast(`${bp.name} BACKFIRED and hit you!`); this.applyToPlayer(bp); }
    else if (what === 'random') { g.toast(`${bp.name} glitched and shot somewhere random!`); const d = new THREE.Vector3(rand() - 0.5, rand() - 0.3, rand() - 0.5).normalize(); this.fire({ ...bp, opts: { ...bp.opts } }, { origin: aim.origin, dir: d }); }
    else { g.toast(`${bp.name} blew up in your hand!`); g.explosion(g.player.muzzlePos(), g.player.height * 0.4, 'player', 15); }
  }

  applyToPlayer(bp) {
    const pl = this.game.player;
    for (const k of bp.cores) {
      if (k === 'shrink') pl.setTargetScale(pl.scale * 0.5);
      else if (k === 'grow') pl.setTargetScale(pl.scale * 2);
      else if (k === 'freeze') pl.frozen = 3;
      else if (k === 'teleport') pl.randomTeleport();
      else if (k === 'push' || k === 'explode') pl.knock(new THREE.Vector3(rand() - 0.5, 0.6, rand() - 0.5));
    }
  }

  // -------------------------------------------------------------- effects
  apply(bp, t, ctx) {
    if (!t || !t.ref) return;
    const g = this.game;
    const st = bp.stats;
    const P = st.power, T = st.time;
    const dur = T >= 10 ? 1e9 : 4 + T * 6;
    // kids can never be zapped: the ray fizzles
    if (t.kind === 'person' && t.ref.kid && !bp.cores.every((k) => k === 'heal' || k === 'joy' || k === 'calm' || k === 'shield')) {
      g.fx.burst(t.point, [0xffffff, 0xaaaaaa], 10, t.ref.height, 0.5);
      sfx('fizzle');
      if (!this.kidWarned || g.time - this.kidWarned > 8) { g.toast('The gadget fizzled. It won\'t work on kids.'); this.kidWarned = g.time; }
      t.ref.fear = Math.min(100, t.ref.fear + 20);
      return;
    }
    for (const core of bp.cores) {
      try { this.applyCore(core, bp, t, ctx, P, T, dur); } catch (e) { console.warn('core', core, e); }
    }
    if (t.kind === 'person' && t.ref.alive && !t.ref.kid && ctx.source === 'player') {
      // being zapped changes how they (and anyone watching) feel about you
      const bad = bp.cores.some((k) => ['shrink', 'freeze', 'fire', 'lightning', 'explode', 'slice', 'poison', 'object', 'teleport', 'push', 'hate', 'fear', 'rage', 'sad', 'sleep', 'blackhole', 'sticky', 'heavy', 'mutate', 'mind'].includes(k));
      const good = bp.cores.some((k) => ['heal', 'joy', 'calm', 'love', 'shield', 'money'].includes(k));
      if (bad && !bp.cores.includes('love')) { t.ref.op = clamp(t.ref.op - 4 - P, -100, 100); t.ref.fear = clamp(t.ref.fear + 10, 0, 100); t.ref.remember('zap', `The giant zapped me with a ${bp.name}`, -5, 'player'); }
      if (good) { t.ref.op = clamp(t.ref.op + 3, -100, 100); }
      g.witness('zap', t.ref.pos);
    }
  }

  applyCore(core, bp, t, ctx, P, T, dur) {
    const g = this.game;
    const r = t.ref;
    const isP = t.kind === 'person', isB = t.kind === 'bug', isI = t.kind === 'item', isC = t.kind === 'car';
    const size = this.sizeOf(t) || ctx.S;
    switch (core) {
      case 'shrink': case 'grow': {
        const cur = r.scale;
        let to;
        if (core === 'shrink') to = bp.opts.toCage && isP && cur > TINY * 1.5 ? TINY : bp.opts.toCage && isC && cur > TINY * 2 ? TINY : cur / Math.pow(2, 0.4 + P * 0.25);
        else to = cur * Math.pow(2, 0.4 + P * 0.25);
        to = clamp(to, 0.0015, isP ? g.maxScaleAt(r) : isC ? 2 : 8);
        if (Math.abs(to - cur) / cur < 0.02) { g.fx.burst(t.point, 0xffffff, 6, size, 0.4); sfx('fizzle'); return; }
        this.scaling.push({ t, from: cur, to, k: 0 });
        g.fx.burst(t.point, ctx.color, 26, size, 1.2, { glow: true });
        sfx('poof', { pitch: core === 'shrink' ? 1.4 : 0.7 });
        if (isP) { r.say(core === 'shrink' ? 'WHAT\'S HAPPENING?!' : 'Whoa whoa WHOA!', { kind: 'scared', scream: true }); g.feed(`You ${core === 'shrink' ? 'shrank' : 'grew'} ${r.name}`, core === 'shrink' ? '' : 'warm', r); if (r.street && core === 'shrink') g.witness('shrink', r.pos, r); }
        break;
      }
      case 'freeze':
        if (isP) { r.frozen = Math.min(dur, 6 + T * 4); r.burning = 0; sfx('freeze'); }
        else if (isB) { r.frozenT = 6 + T * 4; sfx('freeze'); }
        else if (isC) { r.frozenT = 6 + T * 4; sfx('freeze'); }
        g.fx.burst(t.point, [0xcfeaff, 0xffffff], 18, size, 0.8);
        break;
      case 'fire':
        if (isP) r.burning = 2 + P;
        else if (isB) r.hurt(10 * P, null, 'fire');
        else if (isI && (r.def.res === 'wood' || r.type === 'pencil' || r.type === 'toothpick' || r.type === 'cotton')) { g.fx.burst(r.pos, [0xff7a10, 0x333333], 20, size, 1, { glow: true }); g.removeItem(r); }
        if (t.kind === 'building') g.society.smash(r, 'player');
        for (let i = 0; i < 10; i++) g.fx.fire(t.point, size);
        sfx('fire');
        break;
      case 'lightning':
        g.fx.burst(t.point, [0xbfd8ff, 0xffffff], 22, size, 1.4, { glow: true });
        sfx('electric');
        if (isP) { r.hurt({ dmg: 6 * P, type: 'shock', from: ctx.source, point: t.point }); r.stun = 2 + P * 0.3; r.body.ragdoll(0.6); }
        else if (isB) r.hurt(8 * P, null, 'shock');
        break;
      case 'teleport': {
        const dest = this.teleportDest(t);
        if (!dest) return;
        g.fx.burst(t.point, ctx.color, 20, size, 1, { glow: true });
        g.moveEntity(t, dest);
        g.fx.burst(dest, ctx.color, 20, size, 1, { glow: true });
        sfx('teleport');
        if (isP) r.say(rand.pick(['Where am I?!', 'How did I...', 'WHAT?!']), { kind: 'scared' });
        break;
      }
      case 'object':
        if (isP) {
          if (r.objectForm) this.unobject(r);
          else this.objectify(r, bp.opts.objectType || 'chair', dur);
        }
        break;
      case 'gravity':
        if (isP) { r.floatT = 2 + P * 0.8; r.body.ragdoll(r.floatT); }
        else if (isI) { r.vel.y = 1.2 * Math.sqrt(r.scale) * P / 5; r.rest = false; }
        else if (isB) { r.vy = 2 * Math.sqrt(r.size) * P / 3; r.pos.y += 0.001; }
        break;
      case 'heavy':
        if (isP) { r.stuck = 4 + T * 2; r.body.ragdoll(1); r.body.push(new THREE.Vector3(0, -r.height * 3, 0)); }
        break;
      case 'push': case 'pull': {
        const d = (ctx.dir ? ctx.dir.clone() : new THREE.Vector3(0, 0, 1)).setY(0).normalize();
        if (core === 'pull') d.negate();
        const v = d.multiplyScalar(size * (1 + P * 0.8) * 2).add(_v.set(0, size * (0.6 + P * 0.2), 0));
        if (isP) { r.body.ragdoll(1 + P * 0.15); r.body.push(v); }
        else if (isI) { r.vel.copy(v); r.rest = false; }
        else if (isB) { r.vel.copy(v); r.vy = v.y; }
        else if (isC) { r.speed = 0; r.push(v); }
        sfx('thud', { pitch: 1.4 });
        break;
      }
      case 'love': case 'hate': case 'fear': case 'rage': case 'joy': case 'sad': case 'calm': {
        if (!isP || !r.alive) break;
        r.emotion = { kind: core, t: Math.min(dur, 20 + T * 12) };
        g.fx.burst(r.headPos(_v.clone()), CORES[core].color, 14, size, 0.6, { glow: true, float: true });
        if (core === 'love') { r.loveYou = Math.min(100, r.loveYou + 25 + P * 4); r.op = Math.min(100, r.op + 10); const o = g.ai.nearestPerson(r, (q) => q.alive && !q.kid, r.height * 15); if (o) { r.relOf(o).l = Math.min(100, r.relOf(o).l + 30 + P * 3); } sfx('heart'); }
        if (core === 'hate') { r.op = Math.max(-100, r.op - 15 - P * 2); for (const [, rl] of r.rel) rl.f -= 15; }
        if (core === 'fear') r.fear = 100;
        if (core === 'calm') { r.fear = Math.max(0, r.fear - 40); if (r.task && r.task.type === 'fight') r.task = null; r.order = r.order && r.order.type === 'fight' ? null : r.order; }
        if (core === 'rage') { const o = g.ai.nearestPerson(r, (q) => q.alive && !q.kid && q.inCage === r.inCage, r.height * 30); if (o) g.ai.giveTask(r, { type: 'fight', target: o, why: 'rage ray', lethal: P > 6 }); }
        if (core === 'joy') g.ai.giveTask(r, { type: 'dance' });
        if (core === 'sad') g.ai.giveTask(r, { type: 'mourn' });
        r.say({ love: 'Oh... wow. I feel... wow.', hate: 'I HATE ALL OF YOU!', fear: 'AAAAAAH!', rage: 'RAAAAH!', joy: 'Hahaha! Everything is amazing!', sad: 'Why is everything so sad...', calm: 'Okay. Everything is okay.' }[core], { kind: core === 'love' ? 'love' : core === 'rage' || core === 'hate' ? 'angry' : core === 'fear' ? 'scared' : core === 'sad' ? 'sad' : 'chat' });
        break;
      }
      case 'mind':
        if (isP && r.alive) { r.mind = { mode: 'orders', t: Math.min(dur, 30 + T * 15) }; g.fx.ring(r.headPos(_v.clone()), 0xd040ff, r.height * 0.5, 0.6); r.say('...Yes, master.', { kind: 'chat' }); g.feed(`${r.name} is under mind control`, 'bad', r); }
        break;
      case 'clone':
        if (isP && r.alive) g.clonePerson(r);
        else if (isB) g.spawnBug(r.type, r.pos.clone().add(_v.set(r.size, 0, 0)), r.scale);
        else if (isI) g.spawnItem(r.type, r.pos.clone().add(_v.set(r.radius * 2, r.radius, 0)), r.scale);
        sfx('bubble');
        break;
      case 'heal':
        if (isP && r.alive) { r.health = Math.min(100, r.health + 15 + P * 8); r.bleed = 0; r.bandaged = 60; if (P > 5) r.sick = null; r.brokenLeg = P > 7 ? undefined : r.brokenLeg; g.fx.burst(r.center(_v.clone()), 0x50ff70, 16, size, 0.6, { glow: true, float: true }); sfx('heart'); }
        else if (isB && r.alive) r.hp = Math.min(r.def.hp * r.scale, r.hp + 20 * P);
        break;
      case 'poison': if (isP) r.getSick('poison', 0.2 + P * 0.08); else if (isB) r.hurt(5 * P, null, 'poison'); g.fx.burst(t.point, 0x8acc20, 12, size, 0.5); break;
      case 'sleep': if (isP && r.alive) { r.ko = 4 + T * 3; r.body.ragdoll(r.ko); } else if (isB) r.frozenT = 4 + T * 2; break;
      case 'explode': g.explosion(t.point, size * (0.6 + bp.stats.area * 0.25), ctx.source, 10 + P * 9); break;
      case 'slice':
        if (isP) { r.hurt({ dmg: 12 + P * 7, type: 'blade', from: ctx.source, point: t.point, dir: ctx.dir }); }
        else if (isB) r.hurt(15 * P, null, 'blade');
        sfx('slice');
        break;
      case 'sticky': if (isP) r.stuck = 4 + T * 3; else if (isB) r.frozenT = 3 + T; else if (isC) r.frozenT = 4 + T * 3; g.fx.burst(t.point, 0xd0c070, 10, size, 0.3); break;
      case 'invisible': if (isP) { r.invisible = 10 + T * 8; } break;
      case 'speed': if (isP) { r.speedMul = 1 + P * 0.3; r.speedT = 10 + T * 5; } break;
      case 'slow': if (isP) { r.speedMul = Math.max(0.1, 1 - P * 0.09); r.speedT = 10 + T * 5; } break;
      case 'swap': g.player.swapWith(t); break;
      case 'magnet':
        for (const it of g.items) if (!it.heldBy && it.pos.distanceTo(t.point) < size * 6 * (1 + bp.stats.area * 0.3)) { it.vel.copy(t.point).sub(it.pos).multiplyScalar(3); it.vel.y += it.radius * 10; it.rest = false; }
        break;
      case 'bouncy': if (isP) { r.bouncy = 10 + T * 6; r.body.ragdoll(1); r.body.push(new THREE.Vector3(0, r.height * 4, 0)); } break;
      case 'mutate': if (isP && r.alive) g.mutatePerson(r); break;
      case 'money': g.makeMoney(t.point, P, t); break;
      case 'plant': if (isP) { r.stuck = 6 + T * 2; g.fx.burst(t.point, 0x3a9a3a, 14, size, 0.5); } else this.applyGround(bp, t, ctx, 'plant'); break;
      case 'water':
        g.splash(t.point, size * (0.5 + bp.stats.area * 0.3));
        if (isP) { r.burning = 0; r.needs.hygiene = 100; r.needs.thirst = Math.min(100, r.needs.thirst + 30); }
        break;
      case 'blackhole': this.blackhole(t.point, ctx.S * 0.05 * (1 + bp.stats.area), 3 + T * 0.8); break;
      case 'timestop': this.timeField(t.point, size * (2 + bp.stats.area), 4 + T * 3); break;
      case 'shield': if (isP) { r.shield = 10 + T * 6; g.fx.ring(r.center(_v.clone()), 0x60c0ff, r.height * 0.6, 0.6); } break;
      default: break;
    }
  }

  // hitting the ground / terrain with a gadget
  applyGround(bp, hit, ctx, only = null) {
    const g = this.game;
    const c = g.cage;
    const p = hit.point;
    const S = ctx.S;
    const cores = only ? [only] : bp.cores;
    for (const k of cores) {
      if (k === 'plant' && c.inside(p.x, p.z, 0.03) && !c.isWater(p.x, p.z)) { const o = c.addNat(rand() < 0.3 ? 'pine' : 'tree', p.x, p.z, 0.8 + bp.stats.power * 0.06); o.grow = 0.2; g.fx.burst(p, 0x3a9a3a, 16, 0.05, 0.6); sfx('bubble', { pitch: 0.7 }); }
      else if (k === 'water') g.splash(p, S * 0.2 * (1 + bp.stats.area * 0.3));
      else if (k === 'explode') g.explosion(p, S * 0.1 * (1 + bp.stats.area * 0.4), ctx.source, 10 + bp.stats.power * 9);
      else if (k === 'fire') { for (let i = 0; i < 12; i++) g.fx.fire(p, S * 0.1); const b = g.society.buildings.find((x) => Math.hypot(x.x - p.x, x.z - p.z) < x.r * 1.3); if (b) g.society.smash(b, 'player'); }
      else if (k === 'money') g.makeMoney(p, bp.stats.power, hit);
      else if (k === 'blackhole') this.blackhole(p, S * 0.05 * (1 + bp.stats.area), 3 + bp.stats.time * 0.8);
      else if (k === 'timestop') this.timeField(p, S * 0.15 * (1 + bp.stats.area), 4 + bp.stats.time * 3);
      else if (k === 'freeze' && c.inside(p.x, p.z) && c.isWater(p.x, p.z)) { c.snowCover = Math.max(c.snowCover, 0.9); c.buildWater(); g.toast('You froze the pond solid.'); }
      else if (k === 'push' || k === 'pull') for (const t of g.targetsInRadius(p, S * 0.15 * (1 + bp.stats.area * 0.3))) this.applyCore(k, bp, t, { ...ctx, dir: t.point.clone().sub(p).setY(0).normalize() }, bp.stats.power, bp.stats.time, 30);
    }
    g.fx.burst(p, ctx.color, 8, S * 0.15, 0.5, { glow: true });
  }

  rain(bp, at, ctx) {
    const g = this.game;
    const r = ctx.S * 0.12 * (1 + bp.stats.area * 0.4);
    for (let i = 0; i < 30; i++) {
      const p = at.clone().add(_v.set((rand() - 0.5) * r * 2, r * 2 + rand() * r, (rand() - 0.5) * r * 2));
      this.projectiles.push({ bp, pos: p, vel: new THREE.Vector3(0, -6 * Math.sqrt(ctx.S), 0), life: 2, size: 0.006 * ctx.S, color: ctx.color, ctx, g: 0, rainDrop: true, mesh: this.boltMesh(ctx.color, 0.006 * ctx.S), delay: rand() * 0.6 });
    }
  }

  // -------------------------------------------------------------- object forms
  objectify(p, type, dur) {
    const g = this.game;
    const m = makeObjectMesh(type);
    const s = p.height * (type === 'shoe' || type === 'book' || type === 'brick' || type === 'pillow' ? 1.6 : 1);
    m.scale.setScalar(s);
    g.scene.add(m);
    if (p.held) g.player.drop();
    p.objectForm = { type, mesh: m, t: dur };
    p.body.hidden = true; p.body.hideAll();
    if (p.holding) g.dropHeld(p);
    p.task = null; p.order = null;
    g.fx.burst(p.center(_v.clone()), 0xe0c060, 24, p.height, 1, { glow: true });
    sfx('poof', { pitch: 0.9 });
    g.feed(`You turned ${p.name} into a ${type}`, '', p);
    p.remember('object', `The giant turned me into a ${type}. I could see everything.`, -20, 'player');
    // anyone who saw it is freaked out
    for (const o of g.peopleNear(p.pos, p.height * 20)) if (o !== p && o.alive && !o.asleep) { o.fear = Math.min(100, o.fear + 25); o.remember('saw', `The giant turned ${p.name} into a ${type}`, -10, 'player'); }
  }

  unobject(p, hurt = 0) {
    const g = this.game;
    if (!p.objectForm) return;
    g.scene.remove(p.objectForm.mesh);
    const type = p.objectForm.type;
    p.objectForm = null;
    p.body.hidden = false;
    p.body.teleport(p.pos.x - p.body.p[2 * 3], 0, p.pos.z - p.body.p[2 * 3 + 2]);
    g.fx.burst(p.center(_v.clone()), 0xe0c060, 20, p.height, 1, { glow: true });
    sfx('poof', { pitch: 1.2 });
    if (hurt) p.hurt({ dmg: hurt, type: 'blunt', point: p.center(_v.clone()), cause: `broke while being a ${type}` });
    if (p.alive) p.say(rand.pick([`I was a ${type}! I was a ${type} and I could hear EVERYTHING!`, 'What... what happened to me?', 'I couldn\'t move! I couldn\'t SCREAM!']), { kind: 'scared' });
  }

  // -------------------------------------------------------------- teleporter pads
  placePad(aim, S, bp) {
    const g = this.game;
    const hit = g.pick(aim.origin, aim.dir, S * 30, { groundOnly: true });
    if (!hit) { sfx('error'); return; }
    if (this.pads.length >= 2) { const old = this.pads.shift(); g.scene.remove(old.mesh); }
    const size = Math.max(0.025, S * 0.45);
    const mesh = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 1.05, size * 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x2c3436, roughness: 0.4, metalness: 0.7 }));
    base.position.y = size * 0.06;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.85, size * 0.06, 8, 30), new THREE.MeshBasicMaterial({ color: this.pads.length ? 0xff8a3d : 0xb070ff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = size * 0.13;
    mesh.add(base, ring);
    mesh.position.copy(hit.point);
    g.scene.add(mesh);
    this.pads.push({ pos: hit.point.clone(), size, mesh, ring, cool: new Map() });
    sfx('teleport', { pitch: 1.5 });
    g.toast(this.pads.length === 1 ? 'Teleporter pad A placed. Shoot again to place pad B.' : 'Pad B placed! Anything that steps on one comes out the other.');
    void bp;
  }

  teleportDest(t) {
    const g = this.game;
    if (this.pads.length === 2) {
      const near = this.pads[0].pos.distanceTo(t.point) < this.pads[1].pos.distanceTo(t.point) ? 1 : 0;
      return this.pads[near].pos.clone().add(_v.set(0, this.pads[near].size * 0.2, 0));
    }
    if (g.cage.inside(t.point.x, t.point.z)) {
      const x = CAGE.x0 + 0.05 + rand() * (CAGE.w - 0.1), z = CAGE.z0 + 0.05 + rand() * (CAGE.d - 0.1);
      return new THREE.Vector3(x, g.cage.heightAt(x, z), z);
    }
    return t.point.clone().add(_v.set((rand() - 0.5) * 6, 0.5, (rand() - 0.5) * 6));
  }

  // -------------------------------------------------------------- tractor beam (hold)
  tractor(aim, range, dt, held) {
    const g = this.game;
    const pl = g.player;
    if (!held || !this.tractorTarget) {
      const hit = g.pick(aim.origin, aim.dir, range, { notPlayer: true });
      this.tractorTarget = hit && hit.kind !== 'ground' && hit.kind !== 'wall' && hit.kind !== 'building' ? hit : null;
      if (!this.tractorTarget) { g.fx.beam(pl.muzzlePos(), aim.origin.clone().addScaledVector(aim.dir, range), 0x40e0ff, 0.003 * pl.height, 0.05); return; }
      sfx('beam', { pitch: 0.6 });
    }
    const t = this.tractorTarget;
    const r = t.ref;
    if ((t.kind === 'person' && r.kid)) { this.tractorTarget = null; sfx('fizzle'); g.toast('The tractor beam won\'t grab kids.'); return; }
    const holdPt = pl.handHoldPoint();
    const cur = t.kind === 'person' ? r.center(new THREE.Vector3()) : r.pos.clone();
    g.fx.beam(pl.muzzlePos(), cur, 0x40e0ff, 0.003 * pl.height, 0.05);
    const d = holdPt.clone().sub(cur);
    const dist = d.length();
    const size = this.sizeOf(t);
    // small enough to hold: it lands in your hand
    if (dist < Math.max(pl.height * 0.08, size) && size < pl.height * 0.3 && pl.grabTarget(t)) { this.tractorTarget = null; return; }
    const pullSpeed = Math.min(dist, pl.height * 1.5 * dt * 3);
    d.normalize().multiplyScalar(pullSpeed / Math.max(dt, 1e-3));
    if (t.kind === 'person') { if (r.loc === 'jar' || r.loc === 'bottle' || r.held) return; r.body.ragdoll(0.5); r.body.push(d.clone().multiplyScalar(0.12)); r.body.push(_v.set(0, r.gEff * dt * 1.05, 0)); }
    else if (t.kind === 'item') { r.pos.addScaledVector(d, dt); r.vel.set(0, 0, 0); r.rest = false; }
    else if (t.kind === 'bug') { r.pos.addScaledVector(d, dt); }
    else if (t.kind === 'car') { r.pos.addScaledVector(d.setY(0), dt * 0.3); r.speed = 0; }
  }

  // -------------------------------------------------------------- traps
  placeTrap(bp, aim, S, ctx) {
    const g = this.game;
    const hit = g.pick(aim.origin, aim.dir, S * 30, { groundOnly: true });
    if (!hit) { sfx('error'); return; }
    const size = Math.max(0.01, S * 0.12 * (1 + bp.stats.area * 0.15));
    const mesh = this.model(bp);
    mesh.scale.setScalar(size / 0.08);
    mesh.position.copy(hit.point);
    g.scene.add(mesh);
    this.traps = this.traps || [];
    this.traps.push({ bp, pos: hit.point.clone(), size, mesh, ctx, armedT: 1.5 });
    sfx('click');
    g.toast(`${bp.name} placed.`);
  }

  // -------------------------------------------------------------- black hole / time stop
  blackhole(at, r, life) {
    const g = this.game;
    const m = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 20, 14), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    const disk = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, r * 0.18, 8, 40), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    disk.rotation.x = Math.PI / 2.4;
    m.add(core, disk);
    m.position.copy(at).add(_v.set(0, r * 0.6, 0));
    g.scene.add(m);
    this.holes.push({ pos: m.position.clone(), r, life, mesh: m, disk });
    sfx('blackhole');
  }

  timeField(at, r, life) {
    const g = this.game;
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: 0xc0c0ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(at);
    g.scene.add(m);
    this.fields.push({ pos: at.clone(), r, life, mesh: m });
    sfx('freeze', { pitch: 0.5 });
  }

  // -------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    // resize animations
    for (let i = this.scaling.length - 1; i >= 0; i--) {
      const s = this.scaling[i];
      s.k = Math.min(1, s.k + dt * 2.2);
      const e = s.k < 1 ? s.k * s.k * (3 - 2 * s.k) : 1;
      // wobble at the end (jiggly poof)
      const wob = s.k < 1 ? Math.sin(s.k * Math.PI * 3) * (1 - s.k) * 0.15 : 0;
      const sc = Math.exp(Math.log(s.from) + (Math.log(s.to) - Math.log(s.from)) * e) * (1 + wob);
      g.setEntityScale(s.t, sc);
      if (s.k >= 1) { g.setEntityScale(s.t, s.to); this.scaling.splice(i, 1); }
    }
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.delay > 0) { p.delay -= dt; p.mesh.visible = false; continue; }
      p.mesh.visible = true;
      p.life -= dt;
      if (p.homing) {
        const tgt = g.targetsInRadius(p.pos, g.player.height * 3, { notPlayer: true })[0];
        if (tgt) p.vel.lerp(tgt.point.clone().sub(p.pos).normalize().multiplyScalar(p.vel.length()), Math.min(1, dt * 4));
      }
      p.vel.y -= p.g * dt;
      const step = p.vel.length() * dt;
      const dir = p.vel.clone().normalize();
      const hit = g.pick(p.pos, dir, step + p.size, { notPlayer: true });
      if (hit || p.life <= 0) {
        const at = hit ? hit.point : p.pos;
        if (p.burst || p.bp.mod === 'burst') {
          const rad = (g.player.height / 1.75) * 0.12 * (1 + p.bp.stats.area * 0.4);
          g.fx.ring(at, p.color, rad, 0.5);
          g.fx.burst(at, p.color, 20, rad, 1, { glow: true });
          for (const t of g.targetsInRadius(at, rad)) this.apply(p.bp, t, p.ctx);
          if (!g.targetsInRadius(at, rad).length && hit) this.applyGround(p.bp, hit, p.ctx);
          sfx('poof');
        } else if (hit) {
          if (hit.kind === 'ground' || hit.kind === 'wall') this.applyGround(p.bp, hit, p.ctx); else this.apply(p.bp, hit, p.ctx);
          g.fx.burst(at, p.color, 6, p.size * 20, 0.6, { glow: true });
        }
        g.scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
        continue;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      if (Math.random() < 0.5) g.fx.burst(p.pos, p.color, 1, p.size * 10, 0.1, { glow: true, life: 0.3 });
    }
    // teleporter pads
    if (this.pads.length === 2) {
      for (let k = 0; k < 2; k++) {
        const a = this.pads[k], b = this.pads[1 - k];
        a.ring.rotation.z += dt * 2;
        for (const [ref, t] of a.cool) { if (t < g.time) a.cool.delete(ref); }
        for (const t of g.targetsInRadius(a.pos, a.size * 0.9, { includePlayer: true })) {
          if (a.cool.has(t.ref) || (t.kind === 'player' && g.player.held)) continue;
          if (t.kind === 'person' && (t.ref.held || t.ref.loc === 'jar' || t.ref.loc === 'bottle')) continue;
          b.cool.set(t.ref, g.time + 2); a.cool.set(t.ref, g.time + 2);
          g.fx.burst(a.pos.clone(), 0xb070ff, 16, a.size, 1, { glow: true });
          g.moveEntity(t, b.pos.clone().add(_v.set(0, b.size * 0.2, 0)));
          g.fx.burst(b.pos.clone(), 0xff8a3d, 16, b.size, 1, { glow: true });
          sfx('teleport');
        }
      }
    }
    // traps
    if (this.traps) for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.armedT -= dt;
      if (tr.armedT > 0) continue;
      const victims = g.targetsInRadius(tr.pos, tr.size * 0.8).filter((t) => t.kind !== 'item');
      if (victims.length) {
        for (const t of victims) this.apply(tr.bp, t, tr.ctx);
        g.fx.ring(tr.pos, tr.ctx.color, tr.size * 2, 0.4);
        sfx('zap');
        tr.armedT = 3;
      }
    }
    // black holes
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i];
      h.life -= dt;
      h.disk.rotation.z += dt * 6;
      const pullR = h.r * 6;
      for (const t of g.targetsInRadius(h.pos, pullR, { includePlayer: false })) {
        const d = h.pos.clone().sub(t.point);
        const dist = d.length();
        if (dist < h.r * 0.5) {
          if (t.kind === 'person') { if (!t.ref.kid) { if (t.ref.alive) g.feed(`${t.ref.name} got sucked into the black hole`, 'bad', t.ref); t.ref.squish('player'); g.removePerson(t.ref, true); } }
          else if (t.kind === 'item') g.removeItem(t.ref);
          else if (t.kind === 'bug') { t.ref.die(); g.removeBug(t.ref); }
          continue;
        }
        const f = (1 - dist / pullR) * h.r * 30;
        d.normalize().multiplyScalar(f * dt);
        if (t.kind === 'person' && !t.ref.kid) { t.ref.body.ragdoll(0.5); t.ref.body.push(d.multiplyScalar(60 * 0.05)); }
        else if (t.kind === 'item') { t.ref.pos.add(d); t.ref.rest = false; }
        else if (t.kind === 'bug') t.ref.pos.add(d);
      }
      h.mesh.scale.setScalar(h.life < 0.6 ? Math.max(0.01, h.life / 0.6) : Math.min(1, (h.age = (h.age || 0) + dt) * 3));
      if (h.life <= 0) { g.scene.remove(h.mesh); this.holes.splice(i, 1); }
    }
    // time fields: everything inside skips its update
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const f = this.fields[i];
      f.life -= dt;
      for (const p of g.people) if (p.pos.distanceTo(f.pos) < f.r) p.timeStop = 0.1;
      for (const b of g.bugs) if (b.pos.distanceTo(f.pos) < f.r) b.frozenT = Math.max(b.frozenT || 0, 0.1);
      f.mesh.material.opacity = 0.12 * Math.min(1, f.life);
      if (f.life <= 0) { g.scene.remove(f.mesh); this.fields.splice(i, 1); }
    }
    // object forms + mind control timers
    for (const p of g.people) {
      if (p.objectForm) {
        const o = p.objectForm;
        if (!p.held) o.mesh.position.set(p.pos.x, g.groundAt(p.pos.x, p.pos.z, p.pos.y + p.height), p.pos.z);
        o.mesh.rotation.y = p.yaw;
        if (o.t < 1e8) { o.t -= dt; if (o.t <= 0) this.unobject(p); }
      }
      if (p.mind && p.mind.t !== undefined) { p.mind.t -= dt; if (p.mind.t <= 0) { p.mind = null; p.say('What... what did I just do?', { kind: 'scared' }); p.remember('mind', 'The giant controlled my mind', -25, 'player'); } }
    }
  }

  cycle(bp) {
    // R: flip the gadget's mode (opposite core, next object, next emotion)
    if (bp.opts.cycleObject) { const i = OBJECT_TYPES.indexOf(bp.opts.objectType); bp.opts.objectType = OBJECT_TYPES[(i + 1) % OBJECT_TYPES.length]; return `Object: ${bp.opts.objectType}`; }
    if (bp.opts.cycleEmotion) { const i = EMOTION_CYCLE.indexOf(bp.cores[0]); bp.cores = [EMOTION_CYCLE[(i + 1) % EMOTION_CYCLE.length]]; bp.opts.color = CORES[bp.cores[0]].color; return `Emotion: ${CORES[bp.cores[0]].label}`; }
    let changed = false;
    bp.cores = bp.cores.map((k) => { const o = CORES[k] && CORES[k].opp; if (o) { changed = true; return o; } return k; });
    if (bp.opts.color != null && changed) bp.opts.color = CORES[bp.cores[0]].color;
    if (bp.name === 'Shrink Ray' || bp.name === 'Grow Ray') bp.name = bp.cores[0] === 'grow' ? 'Grow Ray' : 'Shrink Ray';
    return changed ? `Mode: ${bp.cores.map((k) => CORES[k].label).join(' + ')}` : 'This gadget has no other mode';
  }

  clearAll() {
    const g = this.game;
    for (const p of this.projectiles) g.scene.remove(p.mesh);
    for (const p of this.pads) g.scene.remove(p.mesh);
    for (const h of this.holes) g.scene.remove(h.mesh);
    for (const f of this.fields) g.scene.remove(f.mesh);
    for (const t of this.traps || []) g.scene.remove(t.mesh);
    this.projectiles = []; this.pads = []; this.holes = []; this.fields = []; this.traps = []; this.scaling = [];
  }
}
