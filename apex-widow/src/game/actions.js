// What your buttons do: bite, eat, wrap, web shot, web zip / swing, drop line, jump / pounce, dodge, lock on,
// hunter vision, molt, make a lair, rest, powers, inspect cam.
import * as THREE from 'three';
import { clamp } from '../core/util.js';

const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class Actions {
  constructor(game) { this.game = game; this.biteCD = 0; this.feeding = null; this.lock = null; this.aim = null; this.hold = 0; }
  // crosshair ray (camera centre) -> first thing it hits (creature / human / surface)
  aimRay(maxBL = 60) {
    const G = this.game, p = G.player, s = p.s;
    const o = G.camera.position.clone(), d = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.quaternion);
    const far = G.cam.curDist + s * maxBL;
    const Z = G.zone;
    const cr = Z.creatures ? Z.creatures.raycast(o, d, far, s * 0.03) : null;
    const hr = Z.humans ? Z.humans.raycast(o, d, far) : null;
    const wh = G.probe(o, d, far, s);
    let best = { kind: 'none', point: o.clone().addScaledVector(d, far), dist: far };
    if (wh && wh.distance > G.cam.curDist * 0.7) best = { kind: 'surface', point: wh.point, normal: wh.normal, dist: wh.distance, hit: wh };
    if (cr && cr.t < best.dist) best = { kind: 'creature', c: cr.c, point: cr.c.pos.clone(), dist: cr.t };
    if (hr && hr.t < best.dist) best = { kind: 'human', h: hr.h, point: hr.h.pos.clone().setY(hr.h.pos.y + hr.h.height * 0.4), dist: hr.t };
    return best;
  }
  // the thing right in front of your fangs
  frontTarget(reachMul = 1) {
    const G = this.game, p = G.player, s = p.s, Z = G.zone;
    const head = p.pos.clone().addScaledVector(p.fwd, s * 0.45).addScaledVector(p.up, s * 0.15);
    const reach = s * 0.75 * reachMul;
    let best = null, bd = Infinity;
    if (this.lock && this.valid(this.lock)) { const tp = this.tPos(this.lock); if (tp.distanceTo(head) < reach + this.tRad(this.lock)) return this.lock; }
    if (Z.creatures) for (const c of Z.creatures.near(head, reach + 2 * s)) { const d = c.pos.distanceTo(head) - c.L * 0.5; if (d < reach && d < bd) { bd = d; best = { type: 'c', c }; } }
    if (Z.humans && p.sizeM > 0.02) for (const h of Z.humans.near(head, reach + 1.5)) { const hp = h.pos.clone(); hp.y = clamp(head.y, h.pos.y, h.pos.y + h.height * (h.helpless ? 0.3 : 1)); const d = hp.distanceTo(head) - 0.25; if (d < reach && d < bd) { bd = d; best = { type: 'h', h }; } }
    return best;
  }
  valid(t) { return t && (t.type === 'c' ? t.c.state !== 'eaten' : t.h.state !== 'eaten' && t.h.state !== 'gone'); }
  tPos(t) { return t.type === 'c' ? t.c.pos : _v.copy(t.h.pos).setY(t.h.pos.y + t.h.height * 0.4); }
  tRad(t) { return t.type === 'c' ? t.c.L * 0.5 : 0.35; }
  tMass(t) { return t.type === 'c' ? t.c.mass : 75; }
  tName(t) { return t.type === 'c' ? t.c.def.name : t.h.name; }
  helpless(t) { return t.type === 'c' ? t.c.helpless : t.h.helpless; }

  update(dt, I) {
    const G = this.game, p = G.player; if (!p || p.mode === 'dead') return;
    const s = p.s;
    this.biteCD = Math.max(0, this.biteCD - dt);
    p.dodgeCD = Math.max(0, (p.dodgeCD || 0) - dt);
    // silk + venom refill (faster when fed)
    p.silk = Math.min(1, p.silk + dt * 0.05 * (0.4 + p.hunger));
    p.venom = Math.min(1, p.venom + dt * 0.06 * (0.4 + p.hunger));
    this.aim = this.aimRay();
    // ---- feeding in progress
    if (this.feeding) { this.updateFeed(dt, I); return; }
    // ---- bite (LMB)
    if (I.mouse.lPressed && this.biteCD <= 0) this.bite();
    // ---- web shot (RMB)
    if (I.mouse.rPressed && p.silk > 0.08) {
      p.silk -= 0.08;
      const from = G.webs.spinnerets(p);
      const dir = this.aim.point.clone().sub(from).normalize();
      G.webs.shoot(from, dir, p, s * 55);
      p.rig.excite = 1;
    }
    // ---- eat / wrap / pick up (E)
    if (I.hit('eat')) this.eatOrTake();
    // ---- swing / zip (F)
    if (I.hit('swing')) this.swingOrZip();
    if (I.up('swing') && (p.mode === 'swing')) p.releaseRope(true);
    // ---- drop on a line (X)
    if (I.hit('drop')) { if (p.mode === 'ground') { if (p.silk > 0.03) { p.silk -= 0.03; p.dropLine(); } } else if (p.mode === 'dangle' || p.mode === 'swing') p.releaseRope(false); }
    // ---- jump / pounce (Space)
    if (I.hit('jump')) {
      if (p.mode === 'dangle' || p.mode === 'swing') p.releaseRope(true);
      else { const t = this.lock && this.valid(this.lock) ? this.tPos(this.lock) : null; if (t && t.distanceTo(p.pos) < s * 8) p.jump(t); else p.jump(); }
    }
    // ---- dodge (C)
    if (I.hit('dodge')) p.dodge(I.is('left') ? -1 : I.is('right') ? 1 : (Math.random() < 0.5 ? -1 : 1));
    // ---- lock on (Q)
    if (I.hit('lock')) {
      if (this.lock) this.lock = null;
      else if (this.aim.kind === 'creature') this.lock = { type: 'c', c: this.aim.c };
      else if (this.aim.kind === 'human') this.lock = { type: 'h', h: this.aim.h };
      else { const c = G.zone.creatures && G.zone.creatures.nearest(p.pos, s * 25, c => c.alive); if (c) this.lock = { type: 'c', c }; }
    }
    if (this.lock && (!this.valid(this.lock) || this.tPos(this.lock).distanceTo(p.pos) > s * 60)) this.lock = null;
    p.lockTarget = this.lock;
    // ---- vision (V)
    if (I.hit('vision')) p.vision = !p.vision;
    // ---- molt (M)
    if (I.hit('molt')) G.growth.tryMolt();
    // ---- lair (L), rest + save (R)
    if (I.hit('lair')) G.growth.makeLair();
    if (I.hit('rest')) G.growth.rest();
    // ---- powers (1-4)
    for (let k = 1; k <= 4; k++) if (I.hit('p' + k)) G.growth.usePower(k);
    if (I.hit('babies')) G.babies && G.babies.command();
    if (I.hit('map')) G.menus.toggleMap();
    if (I.hit('cam')) G.cam.inspect = !G.cam.inspect;
  }

  bite() {
    const G = this.game, p = G.player;
    this.biteCD = 0.42;
    p.rig.bite(); G.audio.bite();
    const t = this.frontTarget(1.3);
    if (!t) return;
    const venomStat = (p.sp.stats.venom || 1) * (1 + 0.2 * p.evo.venom) * (p.powers.rad ? 1.5 : 1);
    const sizeK = p.sizeM;
    if (t.type === 'c') {
      const c = t.c;
      const ratio = p.mass / c.mass;
      const dmg = clamp(ratio * 10, 0.3, 400) * (1 + 0.15 * p.evo.body);
      c.hurt(dmg, dmg * 1.6 * venomStat * (p.venom > 0.1 ? 1 : 0.3));
      if (c.alive && !c.helpless) c.state = c.def.move === 'fly' ? 'fly' : 'flee';
      p.venom = Math.max(0, p.venom - 0.06);
      G.fx.goo(c.pos.clone().addScaledVector(c.up, c.L * 0.3), c.L * 0.4, 6);
      if (p.powers.electric) G.fx.sparks(c.pos, c.L * 0.3, 8, [0.5, 0.85, 1, 1]);
      if (p.powers.fire) G.fx.sparks(c.pos, c.L * 0.3, 8, [1, 0.5, 0.2, 1]);
      this.lock = this.lock || t;
    } else {
      const h = t.h;
      const venom = 40 * venomStat * clamp(sizeK / 0.5, 0.002, 4) * (p.venom > 0.1 ? 1 : 0.3);
      h.hurt(clamp(sizeK * 30, 0.2, 60), venom);
      p.venom = Math.max(0, p.venom - 0.08);
      if (!h.noticed) { h.noticed = true; h.react(p); }
      G.wanted && G.wanted.crime('bite', h.pos);
      G.audio.at('scream', h.pos);
    }
  }

  eatOrTake() {
    const G = this.game, p = G.player, s = p.s;
    // pick up a note or a serum vial
    const it = G.zone.nearItem && G.zone.nearItem(p.pos, Math.max(s * 1.5, 0.04));
    if (it) { G.zone.take(it); if (it.kind === 'note') G.story.readNote(it.id); else G.growth.vial(it.vial); return; }
    const t = this.frontTarget(1.4);
    if (!t) { G.hud.toast('Nothing to eat here.', 1.2); return; }
    if (!this.helpless(t)) { G.hud.toast(`${this.tName(t)} is still fighting. Bite it, or web it first.`, 1.8); return; }
    const ratio = this.tMass(t) / p.mass;
    if (t.type === 'h' && p.sizeM < 0.25) { G.hud.toast('Too big for you to wrap. Grow first.', 1.8); return; }
    const chunk = t.type === 'c' && t.c.def.chunk;
    // big prey gets wrapped first (real widows wrap anything that could fight back). Huge things (buildings, planets)
    // are eaten a bite at a time instead.
    const needWrap = !chunk && ratio > 0.6 && !(t.type === 'c' ? t.c.wrapped : t.h.state === 'wrapped');
    if (needWrap) {
      if (p.silk < 0.15) { G.hud.toast('Not enough silk to wrap it.', 1.5); return; }
      p.silk -= 0.15;
      if (t.type === 'c') { t.c.wrapped = true; t.c.state = 'paralyzed'; G.webs.cocoon(t.c, 'bug'); }
      else { t.h.wrap(); G.webs.cocoon(t.h, 'human'); }
      G.audio.silk(); G.hud.toast(`Wrapped the ${this.tName(t)}. Hold E to feed.`, 2);
      G.stats.wrapped = (G.stats.wrapped || 0) + 1;
      return;
    }
    // feed: bigger meals take longer
    const mass = chunk ? Math.min(this.tMass(t), p.mass * 2.5) : this.tMass(t);
    const dur = clamp(0.8 + 2.2 * Math.sqrt(mass / p.mass), 0.8, 9);
    this.feeding = { t, dur, prog: 0, mass, chunk };
    G.audio.slurpStart();
    if (ratio < 0.05) G.audio.crunch();
  }
  updateFeed(dt, I) {
    const G = this.game, p = G.player, F = this.feeding;
    const moving = I.is('forward') || I.is('back') || I.is('left') || I.is('right') || I.hit('jump');
    if (!I.is('eat') && F.prog > 0.15 && !F.auto) F.auto = true; // a tap starts it, it keeps going
    if (moving || !this.valid(F.t) || p.mode !== 'ground') { this.stopFeed(); return; }
    F.prog += dt / F.dur;
    const t = F.t;
    if (t.type === 'c') { t.c.eatenFrac = F.prog; if (!F.chunk) t.c.root.scale.setScalar(t.c.L * (1 - 0.35 * F.prog)); }
    else t.h.eatenFrac = F.prog;
    p.rig.excite = 1; p.rig.biting = 0.6 + Math.sin(G.time * 18) * 0.3;
    if (F.prog >= 1) {
      this.stopFeed();
      G.growth.feed(F.mass, t);
      if (F.chunk && t.c.mass > F.mass * 1.02) {
        // a bite out of something huge: it gets smaller, you keep going (E again)
        const gone = t.c.takeChunk(F.mass);
        if (!gone) { G.hud.toast('You tear a huge piece off the ' + t.c.def.name.toLowerCase() + '. E to keep eating.', 2); return; }
        G.recordEat(t.c.kind, t.c.def); if (this.lock === t) this.lock = null; return;
      }
      if (t.type === 'c') { t.c.remove(); for (const c of G.webs.cocoons) if (c.target === t.c) c.mesh.removeFromParent(); G.recordEat(t.c.kind, t.c.def); }
      else { t.h.consumed(); for (const c of G.webs.cocoons) if (c.target === t.h) { c.mesh.scale.multiplyScalar(0.7); c.empty = true; } G.recordEat('human', { name: 'Human', latin: 'Homo sapiens' }); G.stats.humans++; G.story.firstHuman && G.story.firstHuman(t.h); }
      if (this.lock === t) this.lock = null;
    }
  }
  stopFeed() { this.feeding = null; this.game.audio.slurpStop(); this.game.player.rig.biting = 0; }

  swingOrZip() {
    const G = this.game, p = G.player, s = p.s;
    if (p.mode === 'swing' || p.mode === 'dangle') { p.releaseRope(true); return; }
    const a = this.aim;
    if (a.kind !== 'surface' || p.silk < 0.04) { G.hud.hint && G.hud.hint('zipFail', 'Aim at a wall, ceiling or anything solid to shoot a line (F).'); return; }
    const d = a.point.distanceTo(p.pos);
    if (d > s * 45) { G.hud.toast('Too far for a line.', 1); return; }
    p.silk -= 0.04;
    // anchor above you + you're in the air or near an edge = swing; otherwise zip straight to it
    const above = a.point.clone().sub(p.pos).dot(G.zone.gravity.clone().negate().normalize()) > s * 2;
    if (above && (p.mode === 'air' || I_isSprint(G))) p.swingFrom(a.point);
    else p.zipTo(a.point, a.normal);
  }
}
function I_isSprint(G) { return G.input.is('sprint'); }
