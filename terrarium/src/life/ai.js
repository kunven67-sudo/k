// Decisions for tiny people. Every second or so each person scores what they could do
// (needs, danger, work, feelings, orders) and picks a task. Tasks then run step by step.
import * as THREE from 'three';
import { BUILD } from './buildings.js';
import { ITEMS, Item, TINY } from './items.js';
import { CAGE, PAINT } from '../world/cage.js';
import { rand, clamp, angleDiff } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { chatter } from '../talk/chatter.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const RES_LIST = ['wood', 'stone', 'fiber', 'metal', 'clay', 'powder', 'electric'];

// what a person wants to hold, best first
const WEAPON_PREF = ['tinyray', 'rifle', 'pistol', 'zapspear', 'razor', 'sword', 'needle', 'cleaver', 'shard', 'metal_axe', 'toothpick', 'spear', 'knife', 'stone_axe', 'tack', 'club', 'stone_pick', 'metal_pick'];

export class AI {
  constructor(game) {
    this.game = game;
    this.thinkClock = 0;
  }

  stockOf(p) {
    const s = this.game.society;
    if (p.tribe != null) { const t = s.tribes.find((x) => x.id === p.tribe); if (t) return (t.stock ||= { wood: 0, stone: 0, fiber: 0, food: 4, metal: 0, clay: 0, powder: 0, electric: 0, bandage: 0, medicine: 0, coins: 0, seeds: 0 }); }
    return s.stock;
  }

  giveTask(p, task) {
    if (!p.alive || p.kid && task.type !== 'party' && task.type !== 'flee') return;
    p.task = { t: 0, stage: 0, ...task };
    p.stop();
    p.thinkT = 2 + rand();
  }

  // ------------------------------------------------------------- main loop
  update(p, dt) {
    p.thinkT -= dt;
    if (p.thinkT <= 0) { p.thinkT = 0.7 + rand() * 0.6; this.think(p); }
    if (p.task) {
      p.task.t += dt;
      const done = this.run(p, p.task, dt);
      if (done) {
        if (p.task && p.task.order && p.order === p.task.order && !p.task.keepOrder) p.order = null;
        p.task = null; p.anim.action = null; p.anim.crouch = 0; p.thinkT = Math.min(p.thinkT, 0.2);
      }
    } else { p.anim.action = null; }
    // hold things in hand visually
    this.game.attachHeld(p);
  }

  // ------------------------------------------------------------- perception
  danger(p) {
    const g = this.game;
    const pl = g.player;
    const H = p.height;
    // the giant's hand coming down (big player near the cage)
    if (pl.scale > p.scale * 8 && p.inCage) {
      const hd = Math.hypot(pl.handPos.x - p.pos.x, pl.handPos.z - p.pos.z);
      const above = pl.handPos.y - p.pos.y;
      if (hd < H * 6 && above < H * 14 && above > -H) return { kind: 'hand', pos: pl.handPos.clone(), level: (pl.holding ? 0.7 : 0.5) + (hd < H * 2.5 ? 0.4 : 0) };
    }
    // tiny player close by (only scary if they hurt us)
    if (pl.scale < p.scale * 3 && pl.scale > p.scale * 0.3 && p.dist(pl.pos) < H * 6 && p.op < -40 && !pl.disguise) return { kind: 'player', pos: pl.pos.clone(), level: 0.4 };
    // attacker
    if (p.lastAttacker && g.time - p.lastAttackT < 8) {
      const a = p.lastAttacker === 'player' ? pl : p.lastAttacker;
      if (a && (a === pl || a.alive)) return { kind: 'attacker', who: p.lastAttacker, pos: a.pos.clone(), level: 0.8 };
    }
    // bugs that hunt
    for (const b of g.bugs) {
      if (!b.alive || !b.def.hunter) continue;
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (d < H * 7 + b.size) return { kind: 'bug', bug: b, pos: b.pos.clone(), level: 0.7 * (b.size / H > 1 ? 1 : 0.6) };
    }
    // fire / lava
    if (g.cage.lavaPools.length) for (const l of g.cage.lavaPools) if (Math.hypot(l.x - p.pos.x, l.z - p.pos.z) < l.r + H * 3) return { kind: 'lava', pos: new THREE.Vector3(l.x, 0, l.z), level: 0.6 };
    if (p.burning > 0) return { kind: 'fire', pos: p.pos.clone(), level: 1 };
    return null;
  }

  // ------------------------------------------------------------- deciding
  think(p) {
    const g = this.game;
    const n = p.needs;
    const cur = p.task;
    // jailed
    if (p.jailUntil && g.time < p.jailUntil) { if (!cur || cur.type !== 'jailed') this.giveTask(p, { type: 'jailed' }); return; }
    // mind control (orders mode) and accepted orders beat everything except burning
    if (p.order && (!cur || cur.order !== p.order)) {
      if (p.order.until && g.time > p.order.until) p.order = null;
      else { p.task = this.orderTask(p, p.order); p.stop(); return; }
    }
    if (cur && cur.order) return;
    if (cur && (cur.type === 'bury' || cur.type === 'carry') && cur.stage > 0) return;
    // babies + kids
    if (p.kid) return this.thinkKid(p);
    // waking up
    if (p.asleep) {
      const dg = this.danger(p);
      if ((dg && dg.level > 0.6) || (n.energy > 95 && g.world.daylight > 0.1) || n.thirst < 10 || n.hunger < 8) { p.asleep = false; p.anim.lying = false; if (cur && cur.type === 'sleep') p.task = null; }
      else return;
    }
    const dg = this.danger(p);
    const brave = p.has('brave') || p.has('hothead') || p.job === 'cop' || p.job === 'soldier';
    const options = [];
    const add = (score, task) => options.push([score, task]);

    if (dg) {
      if (dg.kind === 'hand') {
        if (p.op < -45 && brave && (p.holding || p.has('crazy'))) add(80, { type: 'attackGiant' });
        else if (p.faith > 55 || p.op > 55) add(60, { type: 'pray', target: null, short: true });
        else if (p.fear > 40 || p.has('coward')) add(70 + p.fear * 0.3, { type: 'flee', from: dg.pos, time: 3 });
        else add(40, { type: 'watch', pos: dg.pos, time: 2 });
      } else if (dg.kind === 'attacker' || dg.kind === 'player') {
        const who = dg.who || 'player';
        const tough = brave || p.has('strong') || p.holding;
        if (tough && p.health > 35 && !(who === 'player' && g.player.scale > p.scale * 4)) add(85, { type: 'fight', target: who, why: 'self-defense' });
        else add(90, { type: 'flee', from: dg.pos, time: 5 });
      } else if (dg.kind === 'bug') {
        if ((brave || p.holding) && p.health > 50 && dg.bug.size < p.height * 3) add(75, { type: 'fight', target: dg.bug, why: 'bug' });
        else add(88, { type: 'flee', from: dg.pos, time: 4 });
      } else add(95, { type: 'flee', from: dg.pos, time: 3 });
    }
    // keep fighting / fleeing if already doing it
    if (cur && (cur.type === 'fight' || cur.type === 'flee') && !cur.done) add(cur.type === 'fight' ? 78 : 80, cur);

    // body needs
    if (p.bleed > 0.3 && p.bandaged <= 0) add(85, { type: 'bandageSelf' });
    if (n.thirst < 45) add((45 - n.thirst) * 2 + 20, { type: 'drink' });
    if (n.hunger < 45) add((45 - n.hunger) * 1.8 + 18, { type: 'eat' });
    const night = g.world.daylight < 0.08;
    if (n.energy < 25 || (night && n.energy < 70)) add((60 - n.energy) * 1.2 + (night ? 30 : 0), { type: 'sleep' });
    if (n.warmth < 40) add((40 - n.warmth) * 1.8 + 10, { type: 'warm' });
    if (n.bladder < 25) add((25 - n.bladder) * 2 + 15, { type: 'toilet' });
    if (n.hygiene < 25 && !night) add((25 - n.hygiene) + 10, { type: 'wash' });
    if (p.sick && g.society.count('hospital', true)) add(30, { type: 'hospital' });

    // helping others
    const hurt = this.nearestPerson(p, (o) => o.alive && o.bleed > 0.25 && o.bandaged <= 0 && o !== p && (p.relOf(o).f > -20), p.height * 40);
    if (hurt) add(30 + p.skill('heal') * 25 + (p.has('kind') ? 15 : 0) + Math.max(0, p.relOf(hurt).f) * 0.3, { type: 'heal', target: hurt });
    const corpse = this.nearestCorpse(p);
    if (corpse && (p.relOf(corpse).f > 30 || p.job === 'priest' || p.has('kind') || p.title)) add(24 + (p.relOf(corpse).f > 30 ? 12 : 0), { type: 'bury', target: corpse });
    // starving and nasty enough: eat a body
    if (n.hunger < 6 && corpse && (p.has('cruel') || p.has('crazy') || n.hunger < 1) && !p.has('kind')) add(60, { type: 'eatCorpse', target: corpse });

    // feelings
    if (n.social < 50) { const f = this.pickFriend(p); if (f) add((50 - n.social) * 0.9 + 10, { type: 'chat', target: f }); }
    if (n.fun < 35) add((35 - n.fun) * 0.8 + 8, { type: 'fun' });
    const crush = this.crushOn(p);
    if (crush && !night) add(22 + p.relOf(crush).l * 0.25 + (p.has('romantic') || p.has('flirty') ? 10 : 0), { type: 'romance', target: crush });
    if (p.faith > 40 && (p.has('religious') || p.faith > 70)) add(12 + p.faith * 0.15, { type: 'pray' });
    if (p.grief > 0.3) add(20 + p.grief * 20, { type: 'mourn' });
    // grudges: fight someone they hate (depends on who they are)
    const enemy = this.enemyOf(p);
    if (enemy) add(enemy.score, { type: 'fight', target: enemy.who, why: enemy.why, lethal: enemy.lethal });
    // escape when they hate it here (setting)
    if (g.settings.escapes && p.op < -30 && (p.has('rebel') || p.has('smart') || p.has('brave')) && p.inCage) add(14 + (-p.op - 30) * 0.2, { type: 'escape' });
    // when the giant is tiny inside: hostile people attack, fans come say hi
    const pl = g.player;
    if (pl.inCage && pl.scale < p.scale * 3 && p.dist(pl.pos) < p.height * 30 && !pl.disguise) {
      if (p.op < -55 && brave && p.health > 50) add(55, { type: 'fight', target: 'player', why: 'revenge' });
      else if (p.op > 50 && rand() < 0.3) add(26, { type: 'greetPlayer' });
    }

    // work (lazy people work less)
    const work = p.has('lazy') ? 0.6 : p.has('hardworking') ? 1.3 : 1;
    const want = this.wantedWeapon(p);
    if (want) add(18 * work + (g.society.atWar(p.tribe) ? 20 : 0), { type: 'craft', item: want });
    const site = g.society.buildJob(p);
    if (site) add((20 + p.skill('build') * 8) * work, { type: 'build', target: site });
    const stock = this.stockOf(p);
    const farm = g.society.find('farm', { done: true, near: p.pos });
    if (farm && (p.job === 'farmer' || stock.food < 10)) add((14 + p.skill('farm') * 10) * work, { type: 'farm', target: farm });
    if (stock.food < 12 + g.people.length) add((16 + p.skill('gather') * 6) * work, { type: 'gather', res: 'food' });
    if (p.skill('tech') > 0.9 || p.has('smart')) { const wb = g.society.find('workbench', { done: true, near: p.pos }) || g.society.find('lab', { done: true, near: p.pos }); if (wb) add((12 + p.skill('tech') * 6) * work, { type: 'research', target: wb }); }
    if (p.job === 'chef' && stock.food >= 2 && g.society.find('campfire', { done: true })) add(14 * work, { type: 'cook' });
    // haul whatever they carry
    const carried = RES_LIST.reduce((s, k) => s + p.inv[k], 0) + p.inv.food;
    if (carried >= 6) add(35, { type: 'haul' });
    else if (carried > 0 && !site) add(14, { type: 'haul' });
    // general gathering of what the next building needs
    const need = this.neededResource(p);
    if (need) add((15 + p.skill('gather') * 5) * work, { type: 'gather', res: need });
    if (g.society.money && p.money > 2 && p.needs.hunger < 60 && g.society.find('market', { done: true })) add(16, { type: 'trade' });
    add(5 + rand() * 4, { type: 'wander' });

    // pick best (a little randomness so they're not robots)
    let best = null, bs = -Infinity;
    for (const [s, t] of options) { const sc = s + rand() * 4; if (sc > bs) { bs = sc; best = t; } }
    if (!best) return;
    if (cur && cur.type === best.type && cur.target === best.target && cur.res === best.res && cur.item === best.item) return;
    if (cur && cur.lock && cur.t < cur.lock && bs < 70) return;
    p.task = best === cur ? cur : { t: 0, stage: 0, ...best };
    if (p.task !== cur) p.stop();
  }

  thinkKid(p) {
    const g = this.game;
    const parent = p.parents.map((id) => g.byId(id)).find((q) => q && q.alive);
    const dg = this.danger(p);
    if (dg && dg.level > 0.4) { if (!p.task || p.task.type !== 'flee') this.giveTask(p, { type: 'flee', from: dg.pos, time: 3 }); return; }
    if (g.world.daylight < 0.08 || p.needs.energy < 25) { if (!p.task || p.task.type !== 'sleep') p.task = { type: 'sleep', t: 0, stage: 0 }; return; }
    // babies stay with mom and get fed by her
    if (p.age === 'baby') {
      if (parent) { p.needs.hunger = Math.min(100, p.needs.hunger + 4); p.needs.thirst = Math.min(100, p.needs.thirst + 4); p.needs.social = 100; }
      if (!p.task || p.task.type !== 'stay') p.task = { type: 'stay', target: parent, t: 0, stage: 0 };
      return;
    }
    if (parent) { p.needs.hunger = Math.max(p.needs.hunger, 40); p.needs.thirst = Math.max(p.needs.thirst, 40); }
    if (p.needs.fun < 60 && rand() < 0.5) { p.task = { type: 'play', t: 0, stage: 0 }; return; }
    p.task = { type: 'stay', target: parent, t: 0, stage: 0 };
  }

  // turn an accepted order into a task
  orderTask(p, o) {
    const g = this.game;
    const base = { t: 0, stage: 0, order: o };
    switch (o.type) {
      case 'romanceCmd': return { ...base, type: 'romance', target: o.target };
      case 'chatCmd': return { ...base, type: 'chat', target: o.target };
      case 'gatherCmd': return { ...base, type: 'gather', res: o.res };
      case 'buildOrder': {
        let b = g.society.buildings.find((x) => x.type === o.what && x.progress < 1);
        if (!b) {
          const near = g.player.inCage ? { x: g.player.feetPos.x, z: g.player.feetPos.z } : { x: p.pos.x, z: p.pos.z };
          const site = g.society.siteFor(o.what, near);
          if (site) { b = g.society.place(o.what, site.x, site.z, { tribe: p.tribe }); g.feed(`${p.name} started a ${b.label.toLowerCase()} because you asked`, 'warm', b); }
        }
        return b ? { ...base, type: 'build', target: b } : { ...base, type: 'wave' };
      }
      default: return { ...base, ...o, order: o };
    }
  }

  // ------------------------------------------------------------- helpers
  nearestPerson(p, filter, maxD = Infinity) {
    let best = null, bd = maxD;
    for (const o of this.game.peopleNear(p.pos, maxD)) { if (o === p || !filter(o)) continue; const d = p.dist(o.pos); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  nearestCorpse(p) {
    let best = null, bd = p.height * 60;
    for (const o of this.game.people) if (!o.alive && !o.buried && !o.carriedBy && o.inCage && !o.objectForm) { const d = p.dist(o.pos); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  pickFriend(p) {
    const g = this.game;
    let best = null, bs = -Infinity;
    for (const o of g.peopleNear(p.pos, p.height * 60)) {
      if (o === p || !o.alive || o.kid && o.age === 'baby' || o.asleep || o.busyBody || !o.inCage) continue;
      const r = p.relOf(o);
      const s = r.f + r.l * 0.5 + (p.partner === o.id ? 40 : 0) - p.dist(o.pos) / p.height + rand() * 20;
      if (r.f < -30) continue;
      if (s > bs) { bs = s; best = o; }
    }
    return best;
  }

  crushOn(p) {
    if (p.kid) return null;
    const g = this.game;
    let best = null, bs = 30;
    for (const o of g.peopleNear(p.pos, p.height * 60)) {
      if (o === p || !o.alive || o.kid || o.busyBody) continue;
      if (p.partner && p.partner !== o.id && !(p.has('flirty') && p.has('liar'))) continue; // cheaters gonna cheat
      const r = p.relOf(o);
      if (r.l > bs) { bs = r.l; best = o; }
    }
    return best;
  }

  enemyOf(p) {
    const g = this.game;
    let best = null;
    for (const o of g.peopleNear(p.pos, p.height * 40)) {
      if (o === p || !o.alive || o.kid || o.busyBody || !o.inCage) continue;
      const r = p.relOf(o);
      let s = 0, why = '', lethal = false;
      if (r.f < -55) { s = (-r.f - 55) * 0.8 + (p.has('hothead') ? 25 : 0) + (p.has('cruel') ? 20 : 0) - (p.has('kind') ? 30 : 0) - (p.has('coward') ? 30 : 0) - (p.has('calm') ? 15 : 0); why = 'grudge'; lethal = p.has('cruel') || p.has('crazy') || r.f < -85; }
      if (g.society.enemyTribe(p.tribe, o.tribe) && !p.has('coward')) { s = Math.max(s, 30 + (p.job === 'soldier' || p.job === 'cop' ? 20 : 0) + (p.holding ? 10 : 0)); why = 'war'; lethal = true; }
      // jealousy: someone flirting with my partner
      if (p.partner && o.partner !== p.id && o.relOf(g.byId(p.partner) || o).l > 50 && p.has('jealous')) { s = Math.max(s, 35); why = 'jealous'; }
      if (s > 25 && (!best || s > best.score)) best = { who: o, score: s, why, lethal };
    }
    return best;
  }

  wantedWeapon(p) {
    if (p.handsLeft === 0) return null;
    const g = this.game;
    const tech = g.society.tech;
    const stock = this.stockOf(p);
    const has = p.holding ? WEAPON_PREF.indexOf(p.holding.type) : 99;
    // pick the best thing they can make that is better than what they hold
    const role = p.job === 'cop' || p.job === 'soldier' || p.job === 'hunter' || p.has('cruel') || p.has('hothead') || g.society.atWar(p.tribe) ? 'fighter' : 'worker';
    const list = role === 'fighter' ? ['tinyray', 'rifle', 'pistol', 'zapspear', 'sword', 'cleaver', 'bow', 'spear', 'knife', 'club'] : ['metal_axe', 'metal_pick', 'stone_axe', 'stone_pick', 'spear'];
    for (const t of list) {
      const d = ITEMS[t];
      if (d.tech > tech || !d.recipe) continue;
      const rank = WEAPON_PREF.indexOf(t);
      if (has <= rank && rank >= 0) continue;
      if (p.holding && p.holding.type === t) continue;
      if (Object.entries(d.recipe).every(([k, v]) => (stock[k] || 0) + (p.inv[k] || 0) >= v)) return t;
      // gather for it if it's a basic tool and nothing else is going on
      if (!p.holding && t === 'stone_axe') return t;
    }
    return null;
  }

  neededResource(p) {
    const s = this.game.society;
    const stock = this.stockOf(p);
    const site = s.buildJob(p);
    if (site) for (const [k, v] of Object.entries(s.missing(site))) if ((stock[k] || 0) < v) return k;
    if (stock.wood < 8) return 'wood';
    if (stock.stone < 5) return 'stone';
    if (stock.fiber < 5) return 'fiber';
    if (s.tech >= 2 && stock.metal < 4 && this.findDeposit(p, 'metal')) return 'metal';
    return null;
  }

  // where to get a resource: deposits (your-world items) first, then nature
  findDeposit(p, res) {
    let best = null, bd = Infinity;
    for (const it of this.game.items) {
      if (!it.pool || !(it.pool[res] > 0) || it.heldBy) continue;
      if (!this.game.cage.inside(it.pos.x, it.pos.z)) continue;
      const d = p.dist(it.pos);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  findNature(p, type, filter) {
    let best = null, bd = Infinity;
    for (const o of this.game.cage.nat) {
      if (o.type !== type && !(Array.isArray(type) && type.includes(o.type))) continue;
      if (filter && !filter(o)) continue;
      const d = Math.hypot(o.x - p.pos.x, o.z - p.pos.z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  findItem(p, filter, maxD = Infinity) {
    let best = null, bd = maxD;
    for (const it of this.game.items) {
      if (it.heldBy || !filter(it)) continue;
      const d = p.dist(it.pos);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  waterSpot(p) {
    const c = this.game.cage;
    let best = null, bd = Infinity;
    // a few random probes + the cached shore list
    const shore = this.game.shore || [];
    for (const s of shore) { const d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z); if (d < bd) { bd = d; best = s; } }
    const it = this.findItem(p, (i) => i.pool && i.pool.water > 0 && c.inside(i.pos.x, i.pos.z));
    if (it && p.dist(it.pos) < bd) return { x: it.pos.x, z: it.pos.z, item: it };
    const well = this.game.society.find('well', { done: true, near: p.pos });
    if (well && Math.hypot(well.x - p.pos.x, well.z - p.pos.z) < bd) return { x: well.x, z: well.z, well };
    return best;
  }

  // go somewhere; returns true when close enough
  go(p, x, z, range, run = false) {
    const target = _v.set(x, 0, z);
    if (!p.goal || Math.hypot(p.goal.x - x, p.goal.z - z) > Math.max(range * 0.5, p.height * 0.5) || (p.run !== run)) p.moveTo(target, run, range);
    if (Math.hypot(x - p.pos.x, z - p.pos.z) <= Math.max(range, p.height * 0.35)) { p.stop(); return true; }
    // stuck check
    if (p.task) {
      const tk = p.task;
      tk.lastD = tk.lastD ?? Infinity;
      const d = Math.hypot(x - p.pos.x, z - p.pos.z);
      if (tk.t > (tk.checkT || 0)) { tk.checkT = tk.t + 4; if (d > tk.lastD - p.height * 0.3) tk.stuckN = (tk.stuckN || 0) + 1; else tk.stuckN = 0; tk.lastD = d; if (tk.stuckN >= 3) { tk.failed = true; } }
    }
    return false;
  }

  face(p, x, z) { p.yaw += angleDiff(p.yaw, Math.atan2(x - p.pos.x, z - p.pos.z)) * 0.3; }

  // ------------------------------------------------------------- tasks
  run(p, tk, dt) {
    if (tk.failed) return true;
    const g = this.game;
    const H = p.height;
    const stock = this.stockOf(p);
    switch (tk.type) {
      case 'wander': {
        if (!tk.dest) {
          const home = g.society.camp(p.tribe);
          const cx = home && rand() < 0.6 ? home.x : p.pos.x, cz = home && rand() < 0.6 ? home.z : p.pos.z;
          tk.dest = { x: clamp(cx + (rand() - 0.5) * H * 30, CAGE.x0 + 0.02, CAGE.x1 - 0.02), z: clamp(cz + (rand() - 0.5) * H * 30, CAGE.z0 + 0.02, CAGE.z1 - 0.02) };
          if (!p.inCage) tk.dest = { x: p.pos.x + (rand() - 0.5) * H * 10, z: p.pos.z + (rand() - 0.5) * H * 10 };
        }
        if (this.go(p, tk.dest.x, tk.dest.z, H)) { p.anim.action = rand() < 0.3 ? 'talk' : null; return tk.t > 6; }
        if (g.time - p.lastSpeak > 25 && rand() < 0.004) p.say(chatter(p, 'idle', g), { kind: 'think' });
        return tk.t > 20;
      }
      case 'watch': {
        p.stop(); p.anim.action = rand() < 0.01 ? 'point' : p.anim.action;
        this.face(p, tk.pos.x, tk.pos.z);
        if (tk.t < 0.1 && g.time - p.lastSpeak > 6 && rand() < 0.4) p.say(chatter(p, 'giant', g));
        return tk.t > tk.time;
      }
      case 'flee': {
        if (!tk.dest || tk.t > (tk.re || 0)) {
          tk.re = tk.t + 1.2;
          const away = _v2.set(p.pos.x - tk.from.x, 0, p.pos.z - tk.from.z);
          if (away.lengthSq() < 1e-10) away.set(rand() - 0.5, 0, rand() - 0.5);
          away.normalize();
          // hide in a shelter if one is close
          const sh = g.society.buildings.find((b) => b.progress >= 1 && BUILD[b.type].shelter && Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < H * 15);
          if (sh && tk.kind !== 'fire') tk.dest = { x: sh.x, z: sh.z };
          else tk.dest = { x: clamp(p.pos.x + away.x * H * 12, CAGE.x0 + 0.02, CAGE.x1 - 0.02), z: clamp(p.pos.z + away.z * H * 12, CAGE.z0 + 0.02, CAGE.z1 - 0.02) };
          if (!p.inCage) tk.dest = { x: p.pos.x + away.x * H * 10, z: p.pos.z + away.z * H * 10 };
          if (g.time - p.lastSpeak > 3 && rand() < 0.5) p.say(chatter(p, 'flee', g), { kind: 'scared' });
        }
        this.go(p, tk.dest.x, tk.dest.z, H * 0.5, true);
        p.anim.action = p.legsLeft === 0 ? null : (tk.t % 2 < 1 && p.fear > 70 ? 'flail' : null);
        if (tk.t > tk.time) { tk.done = true; return true; }
        return false;
      }
      case 'fight': return this.fight(p, tk, dt);
      case 'attackGiant': {
        const pl = g.player;
        // throw stones / spears up at the hand, or stab the finger if it's close
        const hd = Math.hypot(pl.handPos.x - p.pos.x, pl.handPos.z - p.pos.z);
        this.face(p, pl.handPos.x, pl.handPos.z);
        if (hd < H * 1.4 && pl.handPos.y - p.pos.y < H * 2.2) {
          p.anim.action = p.holding ? 'stab' : 'punch';
          if (tk.t > (tk.next || 0)) { tk.next = tk.t + 0.8; p.anim.at = 0; g.player.handHit(p, p.holding ? (p.holding.def.weapon ? p.holding.def.weapon.dmg : 5) : 2); }
        } else if (hd < H * 10) {
          p.stop(); p.anim.action = 'throw';
          if (tk.t > (tk.next || 0)) { tk.next = tk.t + 1.5; p.anim.at = 0; g.throwAt(p, pl.handPos.clone()); if (rand() < 0.3) p.say(chatter(p, 'fightGiant', g), { kind: 'angry' }); }
        } else this.go(p, pl.handPos.x, pl.handPos.z, H);
        return tk.t > 8;
      }
      case 'eat': return this.eat(p, tk, dt);
      case 'eatCorpse': {
        const c = tk.target;
        if (!c || c.alive || c.buried) return true;
        if (!this.go(p, c.pos.x, c.pos.z, H * 0.6)) return tk.failed;
        p.anim.action = 'eat'; p.anim.crouch = 0.6;
        if (tk.t > 6 && !tk.done) {
          tk.done = true;
          p.needs.hunger = Math.min(100, p.needs.hunger + 60);
          c.eaten = (c.eaten || 0) + 1;
          if (g.settings.gore === 'max' && c.body.canCut('lShoulder')) c.body.sever('lShoulder');
          g.feed(`${p.name} was so hungry they ate part of ${c.name}'s body`, 'bad', p);
          p.remember('cannibal', `I ate ${c.name}`, -30);
          for (const o of g.peopleNear(p.pos, H * 20)) if (o !== p && o.alive && !o.kid) { o.relOf(p).f -= 50; o.fear += 15; }
          if (rand() < 0.4) p.getSick('sick', 0.5);
          return true;
        }
        return false;
      }
      case 'drink': {
        if (!tk.spot) { tk.spot = this.waterSpot(p); if (!tk.spot) { p.say(chatter(p, 'thirsty', g)); return true; } }
        if (!this.go(p, tk.spot.x, tk.spot.z, H * 0.7)) return tk.failed;
        p.anim.action = 'drink'; p.anim.crouch = 0.7;
        p.needs.thirst = Math.min(100, p.needs.thirst + dt * 12);
        if (tk.spot.item && tk.spot.item.pool) { tk.spot.item.pool.water -= dt * 0.5; if (tk.spot.item.pool.water <= 0) g.removeItem(tk.spot.item); }
        // dirty pond water can make you sick
        if (!tk.spot.item && !tk.spot.well && tk.t > 1 && !tk.rolled) { tk.rolled = true; const dirty = g.deadNearWater(tk.spot) ? 0.25 : 0.015; if (rand() < dirty) p.getSick('stomach', 0.35); }
        return p.needs.thirst > 97;
      }
      case 'sleep': {
        if (!tk.spot) {
          const home = this.homeFor(p);
          tk.spot = home ? { x: home.x + (rand() - 0.5) * home.r * 0.6, z: home.z + (rand() - 0.5) * home.r * 0.6 } : (() => { const c = g.society.camp(p.tribe); return c ? { x: c.x + (rand() - 0.5) * H * 6, z: c.z + (rand() - 0.5) * H * 6 } : { x: p.pos.x, z: p.pos.z }; })();
          p.sheltered = !!home;
        }
        if (!p.asleep && !this.go(p, tk.spot.x, tk.spot.z, H * 0.6)) return tk.failed;
        p.asleep = true; p.anim.lying = true;
        p.task = null; // stays asleep; think() wakes them
        return true;
      }
      case 'warm': {
        const fire = g.society.nearFire(p.pos, H * 60) || g.society.find('campfire', { done: true, near: p.pos });
        if (!fire) return true;
        const fx = fire.x ?? fire.pos.x, fz = fire.z ?? fire.pos.z;
        if (!this.go(p, fx + Math.cos(p.id) * H * 1.2, fz + Math.sin(p.id) * H * 1.2, H * 0.5)) return tk.failed;
        this.face(p, fx, fz); p.anim.action = 'sit';
        return p.needs.warmth > 85 || tk.t > 40;
      }
      case 'toilet': {
        if (!tk.spot) { const l = g.society.find('latrine', { done: true, near: p.pos }); const b = this.findNature(p, 'bush'); tk.spot = l ? { x: l.x, z: l.z } : b ? { x: b.x, z: b.z } : { x: p.pos.x + H * 3, z: p.pos.z }; tk.latrine = !!l; }
        if (!this.go(p, tk.spot.x, tk.spot.z, H * (tk.latrine ? 0.8 : 1.2))) return tk.failed;
        p.anim.crouch = 0.5;
        if (tk.t > 3) { p.needs.bladder = 100; if (!tk.latrine) p.needs.hygiene -= 5; return true; }
        return false;
      }
      case 'wash': {
        if (!tk.spot) tk.spot = this.waterSpot(p);
        if (!tk.spot) return true;
        if (!this.go(p, tk.spot.x, tk.spot.z, H * 0.5)) return tk.failed;
        p.anim.action = 'bandage';
        p.needs.hygiene = Math.min(100, p.needs.hygiene + dt * 10);
        return p.needs.hygiene > 95;
      }
      case 'hospital': {
        const h = g.society.find('hospital', { done: true, near: p.pos });
        if (!h || !p.sick) return true;
        if (!this.go(p, h.x, h.z, h.r)) return tk.failed;
        p.anim.lying = true; p.sick.t -= dt * 4;
        return tk.t > 30 || !p.sick;
      }
      case 'bandageSelf': {
        if (p.handsLeft === 0) { p.say(chatter(p, 'help', g), { kind: 'scared' }); return true; }
        p.stop(); p.anim.action = 'bandage';
        if (tk.t > 2.5) { this.applyBandage(p, p, stock); return true; }
        return false;
      }
      case 'heal': {
        const o = tk.target;
        if (!o || !o.alive || o.bandaged > 0 || o.bleed < 0.05) return true;
        if (!this.go(p, o.pos.x, o.pos.z, H * 0.7, true)) return tk.failed;
        this.face(p, o.pos.x, o.pos.z); p.anim.action = 'bandage';
        if (tk.t > 1 && !tk.said) { tk.said = true; p.say(chatter(p, 'heal', g, o)); }
        if (tk.t > 3.5) { this.applyBandage(p, o, stock); o.relOf(p).f += 15; return true; }
        return false;
      }
      case 'bury': return this.bury(p, tk, dt);
      case 'mourn': {
        const grave = g.society.buildings.find((b) => b.type === 'grave' && b.data && p.rel.get(b.data.who) && p.rel.get(b.data.who).f > 30) || g.society.find('grave');
        if (grave) { if (!this.go(p, grave.x, grave.z + H, H)) return tk.failed; this.face(p, grave.x, grave.z); }
        p.anim.action = 'cry';
        if (tk.t > 1 && !tk.said && g.time - p.lastSpeak > 10) { tk.said = true; p.say(chatter(p, 'grief', g), { kind: 'sad' }); }
        return tk.t > 15;
      }
      case 'chat': return this.chat(p, tk, dt);
      case 'romance': return this.romance(p, tk, dt);
      case 'fun': {
        if (!tk.kind) tk.kind = rand.pick(p.job === 'musician' || p.job === 'artist' ? ['drum', 'paint', 'dance'] : ['dance', 'swim', 'run', 'dance']);
        if (tk.kind === 'swim') { if (!tk.spot) tk.spot = this.waterSpot(p); if (tk.spot && !this.go(p, tk.spot.x, tk.spot.z, H * 0.3)) return tk.failed; }
        if (tk.kind === 'run') { if (!tk.dest || p.arrived()) { tk.dest = { x: clamp(p.pos.x + (rand() - 0.5) * H * 20, CAGE.x0 + 0.03, CAGE.x1 - 0.03), z: clamp(p.pos.z + (rand() - 0.5) * H * 20, CAGE.z0 + 0.03, CAGE.z1 - 0.03) }; } this.go(p, tk.dest.x, tk.dest.z, H, true); }
        else p.stop();
        p.anim.action = tk.kind === 'drum' ? 'drum' : tk.kind === 'paint' ? 'paint' : tk.kind === 'dance' ? 'dance' : null;
        if (tk.kind === 'drum' && rand() < dt * 4) sfx('drum', { vol: g.audibleVol(p.pos, 0.5), pitch: 2.5 });
        p.needs.fun = Math.min(100, p.needs.fun + dt * 3);
        return p.needs.fun > 95 || tk.t > 30;
      }
      case 'party': {
        const f = tk.target;
        if (!f || f.progress < 1) return true;
        const a = (p.id * 1.7) % (Math.PI * 2);
        if (!this.go(p, f.x + Math.cos(a) * f.r * 2.2, f.z + Math.sin(a) * f.r * 2.2, H * 0.6)) return tk.failed;
        p.anim.action = p.job === 'musician' || (p.id % 5 === 0) ? 'drum' : 'dance';
        if (p.anim.action === 'drum' && rand() < dt * 3) sfx('drum', { vol: g.audibleVol(p.pos, 0.4), pitch: 2.4 });
        p.needs.fun = Math.min(100, p.needs.fun + dt * 2.5); p.needs.social = Math.min(100, p.needs.social + dt * 2);
        // dancing next to someone you like makes sparks fly
        if (rand() < dt * 0.05) { const o = this.nearestPerson(p, (q) => q.alive && !q.kid && q.task && q.task.type === 'party', H * 6); if (o) { p.relOf(o).f += 3; if (this.compatible(p, o)) p.relOf(o).l += 4; } }
        return tk.t > 45;
      }
      case 'pray': {
        const st = g.society.find('statue', { done: true, near: p.pos }) || g.society.find('shrine', { done: true, near: p.pos });
        if (st && !tk.short) { if (!this.go(p, st.x, st.z + st.r * 1.5, H)) return tk.failed; this.face(p, st.x, st.z); } else p.stop();
        p.anim.action = tk.short ? 'worship' : rand() < 0.5 ? 'pray' : 'worship';
        p.faith = Math.min(100, p.faith + dt * 0.2);
        p.needs.fun = Math.min(100, p.needs.fun + dt);
        if (tk.t > 0.5 && !tk.said && g.time - p.lastSpeak > 8) { tk.said = true; p.say(chatter(p, 'pray', g), { kind: 'love' }); }
        return tk.t > (tk.short ? 4 : 15);
      }
      case 'greetPlayer': {
        const pl = g.player;
        if (!this.go(p, pl.pos.x, pl.pos.z, H * 1.5)) return tk.t > 12;
        this.face(p, pl.pos.x, pl.pos.z); p.anim.action = 'wave';
        if (!tk.said) { tk.said = true; p.say(chatter(p, 'greet', g), { kind: 'love' }); }
        return tk.t > 5;
      }
      case 'gather': return this.gather(p, tk, dt);
      case 'haul': {
        const c = g.society.camp(p.tribe);
        if (!c) { for (const k of RES_LIST) stock[k] += p.inv[k], p.inv[k] = 0; return true; }
        if (!this.go(p, c.x, c.z, H * 1.5)) return tk.failed;
        p.anim.action = 'carry';
        if (tk.t > 0.6) {
          for (const k of RES_LIST) { stock[k] = (stock[k] || 0) + p.inv[k]; if (p.inv[k] > 0) g.society.note(k); p.inv[k] = 0; }
          stock.food += p.inv.food; p.inv.food = 0;
          return true;
        }
        return false;
      }
      case 'build': return this.build(p, tk, dt);
      case 'craft': return this.craft(p, tk, dt);
      case 'research': {
        const wb = tk.target;
        if (!wb || wb.progress < 1) return true;
        if (!this.go(p, wb.x, wb.z, wb.r + H * 0.6)) return tk.failed;
        this.face(p, wb.x, wb.z); p.anim.action = 'build';
        g.society.addPoints(dt * (0.25 + p.skill('tech') * 0.4) * (p.has('smart') ? 1.5 : 1) * (wb.type === 'lab' ? 2 : 1));
        if (rand() < dt * 0.05 && g.time - p.lastSpeak > 20) p.say(chatter(p, 'research', g), { kind: 'think' });
        return tk.t > 25;
      }
      case 'farm': {
        const f = tk.target;
        if (!f || f.progress < 1) return true;
        if (!this.go(p, f.x + (rand() - 0.5) * f.r, f.z + (rand() - 0.5) * f.r, f.r * 0.7)) return tk.failed;
        p.anim.action = 'dig';
        f.data.tended = 60;
        if ((f.data.grow || 0) >= 1) { f.data.grow = 0; stock.food += 14; g.feed(`${p.name} harvested the farm`, 'warm', p); return true; }
        return tk.t > 15;
      }
      case 'cook': {
        const fire = g.society.find('campfire', { done: true, near: p.pos });
        if (!fire || stock.food < 2) return true;
        if (!this.go(p, fire.x + H, fire.z, H * 0.6)) return tk.failed;
        this.face(p, fire.x, fire.z); p.anim.action = 'build';
        if (tk.t > 8) { stock.food += 3; return true; }
        return false;
      }
      case 'trade': {
        const m = g.society.find('market', { done: true, near: p.pos });
        if (!m || p.money <= 0) return true;
        if (!this.go(p, m.x, m.z, m.r + H * 0.5)) return tk.failed;
        p.anim.action = 'talk';
        if (tk.t > 3) {
          const price = 1 + ((rand() * 3) | 0);
          if (stock.food > 0 && p.money >= price) {
            p.money -= price; stock.food -= 1; p.needs.hunger = Math.min(100, p.needs.hunger + 25);
            const seller = this.nearestPerson(p, (o) => o.alive && !o.kid && (o.has('greedy') || o.job === 'cashier' || o.job === 'farmer'), H * 30);
            if (seller) seller.money += price;
            g.society.trades++;
            if (rand() < 0.3) g.feed(`${p.name} bought food${seller ? ' from ' + seller.name : ''} for ${price} ${g.society.money === 2 ? 'coins' : 'shells'}`, 'warm', p);
          }
          return true;
        }
        return false;
      }
      case 'graffiti': {
        if (!tk.spot) {
          const sides = [[p.pos.x, CAGE.z1 - 0.004, 0], [p.pos.x, CAGE.z0 + 0.004, 1], [CAGE.x0 + 0.004, p.pos.z, 2], [CAGE.x1 - 0.004, p.pos.z, 3]];
          sides.sort((a, b) => Math.hypot(a[0] - p.pos.x, a[1] - p.pos.z) - Math.hypot(b[0] - p.pos.x, b[1] - p.pos.z));
          tk.spot = { x: clamp(sides[0][0], CAGE.x0 + 0.05, CAGE.x1 - 0.05), z: clamp(sides[0][1], CAGE.z0 + 0.05, CAGE.z1 - 0.05), side: sides[0][2] };
        }
        if (!this.go(p, tk.spot.x, tk.spot.z, H * 0.9)) return tk.failed;
        p.anim.action = 'paint';
        if (tk.t > 5) { g.addGraffiti(p, tk.spot, g.society.graffitiText(p)); return true; }
        return false;
      }
      case 'escape': return this.escape(p, tk, dt);
      case 'jailed': {
        const j = g.society.find('jail', { done: true, near: p.pos });
        if (j) this.go(p, j.x, j.z, j.r * 0.4); else return true;
        p.anim.action = rand() < 0.01 ? 'bang' : p.anim.action;
        return g.time > p.jailUntil;
      }
      case 'stay': {
        const t = tk.target;
        if (!t || !t.alive) { p.anim.action = p.age === 'baby' ? 'cry' : null; return tk.t > 5; }
        const d = p.dist(t.pos);
        if (d > H * (p.age === 'baby' ? 2 : 4)) this.go(p, t.pos.x + H * 0.6, t.pos.z, H * 1.5, d > H * 10);
        else { p.stop(); p.anim.action = p.age === 'baby' ? (p.needs.hunger < 30 ? 'cry' : 'sit') : null; }
        return tk.t > 8;
      }
      case 'play': {
        if (!tk.dest || p.arrived()) tk.dest = { x: clamp(p.pos.x + (rand() - 0.5) * H * 14, CAGE.x0 + 0.03, CAGE.x1 - 0.03), z: clamp(p.pos.z + (rand() - 0.5) * H * 14, CAGE.z0 + 0.03, CAGE.z1 - 0.03) };
        this.go(p, tk.dest.x, tk.dest.z, H, true);
        p.anim.action = tk.t % 6 < 2 ? 'dance' : null;
        p.needs.fun = Math.min(100, p.needs.fun + dt * 3);
        return tk.t > 15;
      }
      // ---------------- orders from the player (brain.js turns words into these)
      case 'follow': {
        const t = tk.target === 'player' ? g.player : tk.target;
        if (!t || (t.alive === false)) return true;
        if (tk.guard) {
          const foe = t === g.player ? g.player.lastHitBy : (t.lastAttacker && t.lastAttacker !== 'player' ? t.lastAttacker : null);
          if (foe && foe.alive && foe !== p && !foe.kid && g.time - (t === g.player ? g.player.lastHitT : t.lastAttackT) < 6) { p.task = { type: 'fight', target: foe, t: 0, stage: 0, why: 'protect', order: tk.order, keepOrder: true }; return false; }
        }
        const tp = t === g.player ? g.player.feetPos : t.pos;
        if (t === g.player && g.player.scale > p.scale * 4) { p.stop(); p.anim.action = 'wave'; this.face(p, tp.x, tp.z); return false; }
        const d = Math.hypot(tp.x - p.pos.x, tp.z - p.pos.z);
        if (d > H * 3) this.go(p, tp.x, tp.z, H * 2, d > H * 8); else { p.stop(); this.face(p, tp.x, tp.z); }
        return false;
      }
      case 'come': {
        const tp = g.player.scale > p.scale * 4 ? g.player.handGround() : g.player.feetPos;
        if (this.go(p, tp.x, tp.z, H * 1.5, true)) { p.anim.action = 'wave'; return tk.t > 3; }
        return tk.failed || tk.t > 30;
      }
      case 'stay_here': case 'stop': { p.stop(); p.anim.action = null; return tk.t > (tk.time || 30); }
      case 'go_away': { if (!tk.from) tk.from = g.player.feetPos.clone(); tk.type = 'flee'; tk.time = 6; return false; }
      case 'sit': { p.stop(); p.anim.action = 'sit'; return tk.t > 20; }
      case 'dance': { p.stop(); p.anim.action = 'dance'; p.needs.fun = Math.min(100, p.needs.fun + dt * 2); return tk.t > 20; }
      case 'wave': { p.stop(); p.anim.action = 'wave'; return tk.t > 4; }
      case 'hide': {
        if (!tk.dest) { const sh = g.society.buildings.find((b) => b.progress >= 1 && (BUILD[b.type].shelter || b.type === 'tower')); const tr = this.findNature(p, ['tree', 'bush', 'pine', 'rock']); tk.dest = sh ? { x: sh.x, z: sh.z } : tr ? { x: tr.x, z: tr.z } : { x: p.pos.x, z: p.pos.z }; }
        if (this.go(p, tk.dest.x, tk.dest.z, H * 0.8, true)) { p.anim.action = 'cower'; return tk.t > 20; }
        return tk.failed;
      }
      case 'dropit': { if (p.holding) g.dropHeld(p); return true; }
      case 'give_player': {
        if (!p.holding) return true;
        if (g.player.scale > p.scale * 4) { p.anim.action = 'hold'; if (tk.t > 2) { g.player.receiveFrom(p); return true; } return false; }
        if (this.go(p, g.player.feetPos.x, g.player.feetPos.z, H * 1.5)) { g.player.receiveFrom(p); return true; }
        return tk.failed;
      }
      default: return true;
    }
  }

  homeFor(p) {
    const g = this.game;
    const b = p.home != null ? g.society.buildings.find((x) => x.id === p.home && x.progress >= 1) : null;
    if (b) return b;
    // claim a spot in a shelter with room
    for (const s of g.society.buildings) {
      if (s.progress < 1 || !BUILD[s.type].shelter) continue;
      if (g.society.tribes.length && s.tribe != null && s.tribe !== p.tribe) continue;
      const users = g.people.filter((q) => q.alive && q.home === s.id).length;
      if (users < BUILD[s.type].shelter) { p.home = s.id; return s; }
    }
    // dollhouse / castle you dropped in
    const dh = g.items.find((it) => it.def.shelter && g.cage.inside(it.pos.x, it.pos.z));
    if (dh) return { x: dh.pos.x, z: dh.pos.z, r: dh.radius * 0.6 };
    return null;
  }

  applyBandage(healer, o, stock) {
    const g = this.game;
    if (stock.bandage > 0) stock.bandage--;
    else if (stock.fiber > 0) stock.fiber--;
    else if (healer.inv.fiber > 0) healer.inv.fiber--;
    // a medic's bandage works better
    o.bandaged = 120 + healer.skill('heal') * 80;
    o.bleed *= 0.4;
    if (o.sick && (healer.job === 'doctor' || healer.job === 'nurse') && stock.medicine > 0) { stock.medicine--; o.sick = null; }
    if (o !== healer) { healer.remember('helped', `I patched up ${o.name}`, 5, o.id); o.remember('helped', `${healer.name} saved me`, 15, healer.id); }
  }

  // ------------------------------------------------------------- eating
  eat(p, tk, dt) {
    const g = this.game;
    const H = p.height;
    const stock = this.stockOf(p);
    if (!tk.src) {
      if (p.inv.food > 0) tk.src = { kind: 'inv' };
      else if (stock.food > 0 && g.society.camp(p.tribe)) { const c = g.society.camp(p.tribe); tk.src = { kind: 'stock', x: c.x, z: c.z }; }
      else {
        const dep = this.findItem(p, (i) => i.pool && i.pool.food > 0 && g.cage.inside(i.pos.x, i.pos.z));
        const fit = this.findItem(p, (i) => i.def.kind === 'food' && g.cage.inside(i.pos.x, i.pos.z));
        const bush = this.findNature(p, 'bush', (o) => o.food > 0);
        const shroom = this.findNature(p, 'mushroom');
        const farm = g.society.buildings.find((b) => b.type === 'farm' && b.progress >= 1 && (b.data.grow || 0) > 0.5);
        const cands = [];
        if (dep) cands.push([p.dist(dep.pos), { kind: 'dep', item: dep, x: dep.pos.x, z: dep.pos.z }]);
        if (fit) cands.push([p.dist(fit.pos), { kind: 'item', item: fit, x: fit.pos.x, z: fit.pos.z }]);
        if (bush) cands.push([Math.hypot(bush.x - p.pos.x, bush.z - p.pos.z), { kind: 'bush', o: bush, x: bush.x, z: bush.z }]);
        if (shroom && (p.needs.hunger < 20 || !bush)) cands.push([Math.hypot(shroom.x - p.pos.x, shroom.z - p.pos.z) * 1.3, { kind: 'shroom', o: shroom, x: shroom.x, z: shroom.z }]);
        if (farm) cands.push([Math.hypot(farm.x - p.pos.x, farm.z - p.pos.z), { kind: 'farm', b: farm, x: farm.x, z: farm.z }]);
        // hunt a small bug when brave and armed
        const bug = g.bugs.find((b) => b.alive && !b.def.hunter && b.inCage && b.size < H * 2);
        if (bug && (p.holding || p.has('brave')) && p.needs.hunger < 30) cands.push([p.dist(bug.pos) * 1.5, { kind: 'hunt', bug }]);
        const deadBug = g.bugs.find((b) => !b.alive && b.meat > 0 && b.inCage);
        if (deadBug) cands.push([p.dist(deadBug.pos), { kind: 'bugmeat', bug: deadBug, x: deadBug.pos.x, z: deadBug.pos.z }]);
        cands.sort((a, b) => a[0] - b[0]);
        tk.src = cands.length ? cands[0][1] : { kind: 'none' };
      }
    }
    const s = tk.src;
    switch (s.kind) {
      case 'none':
        if (tk.t < 0.2 && g.time - p.lastSpeak > 15) p.say(chatter(p, 'hungry', g), { kind: 'sad' });
        return true;
      case 'hunt':
        if (!s.bug.alive) { tk.src = { kind: 'bugmeat', bug: s.bug, x: s.bug.pos.x, z: s.bug.pos.z }; return false; }
        tk.hunt ||= { type: 'fight', target: s.bug, why: 'food', t: 0, stage: 0, lethal: true };
        tk.hunt.t += dt;
        this.fight(p, tk.hunt, dt);
        return tk.t > 60;
      case 'inv':
        p.stop(); p.anim.action = 'eat';
        if (tk.t > 2) { p.inv.food--; p.needs.hunger = Math.min(100, p.needs.hunger + 30); return true; }
        return false;
      default: {
        const range = s.item ? s.item.radius + H * 0.4 : s.b ? s.b.r : H * 0.9;
        if (!this.go(p, s.x, s.z, range)) return tk.failed;
        p.anim.action = 'eat';
        if (s.kind === 'shroom' && s.o) p.anim.crouch = 0.6;
        if (tk.t < 2.2) return false;
        if (s.kind === 'stock') { if (stock.food > 0) { stock.food--; p.needs.hunger = Math.min(100, p.needs.hunger + 35); } }
        else if (s.kind === 'dep') { if (s.item.pool && s.item.pool.food > 0) { s.item.pool.food -= 6; p.needs.hunger = Math.min(100, p.needs.hunger + 40); p.inv.food += 1; if (s.item.pool.water) p.needs.thirst = Math.min(100, p.needs.thirst + 25); if (s.item.pool.food <= 0) g.removeItem(s.item); } }
        else if (s.kind === 'item') { if (!s.item.heldBy && g.items.includes(s.item)) { p.needs.hunger = Math.min(100, p.needs.hunger + (s.item.def.food || 20)); if (s.item.def.raw && rand() < 0.3) p.getSick('stomach', 0.3); g.removeItem(s.item); } }
        else if (s.kind === 'bush') { if (s.o.food > 0) { s.o.food--; g.cage.dirty = true; p.needs.hunger = Math.min(100, p.needs.hunger + 22); } }
        else if (s.kind === 'shroom') { if (g.cage.nat.includes(s.o)) { p.needs.hunger = Math.min(100, p.needs.hunger + 18); if (s.o.poison) { p.getSick('poison', 0.8); g.feed(`${p.name} ate a poison mushroom`, 'bad', p); p.say(rand.pick(['Ugh... my stomach...', 'That mushroom was bad...', 'I don\'t feel good']), { kind: 'sad' }); } g.cage.removeNat(s.o); } }
        else if (s.kind === 'farm') { if ((s.b.data.grow || 0) > 0.5) { s.b.data.grow -= 0.3; p.needs.hunger = Math.min(100, p.needs.hunger + 30); } }
        else if (s.kind === 'bugmeat') { if (s.bug.meat > 0) { s.bug.meat--; p.needs.hunger = Math.min(100, p.needs.hunger + 35); if (!g.society.nearFire(p.pos, H * 6) && rand() < 0.25) p.getSick('stomach', 0.3); } }
        return true;
      }
    }
  }

  // ------------------------------------------------------------- gathering
  gather(p, tk, dt) {
    const g = this.game;
    const H = p.height;
    const tool = p.holding && p.holding.def;
    if (!tk.src) {
      const res = tk.res;
      const dep = res === 'food' ? null : this.findDeposit(p, res);
      if (res === 'wood') {
        const tree = this.findNature(p, ['tree', 'pine', 'palm', 'log']);
        const stick = this.findItem(p, (i) => i.type === 'stick' && g.cage.inside(i.pos.x, i.pos.z), H * 40);
        const cands = [];
        if (dep) cands.push([p.dist(dep.pos) * (tool && tool.chop ? 0.7 : 1.4), { kind: 'dep', item: dep }]);
        if (tree) cands.push([Math.hypot(tree.x - p.pos.x, tree.z - p.pos.z), { kind: 'tree', o: tree }]);
        if (stick) cands.push([p.dist(stick.pos) * 0.6, { kind: 'pickup', item: stick }]);
        cands.sort((a, b) => a[0] - b[0]);
        tk.src = cands.length ? cands[0][1] : null;
      } else if (res === 'stone') {
        const rock = this.findNature(p, 'rock');
        const peb = this.findItem(p, (i) => (i.type === 'pebble' || i.type === 'stone') && g.cage.inside(i.pos.x, i.pos.z), H * 40);
        if (peb) tk.src = { kind: 'pickup', item: peb };
        else if (dep && (!rock || p.dist(dep.pos) < Math.hypot(rock.x - p.pos.x, rock.z - p.pos.z))) tk.src = { kind: 'dep', item: dep };
        else if (rock) tk.src = { kind: 'rock', o: rock };
      } else if (res === 'fiber') {
        if (dep) tk.src = { kind: 'dep', item: dep };
        else {
          // any grassy spot nearby
          for (let i = 0; i < 12; i++) { const x = p.pos.x + (rand() - 0.5) * H * 16, z = p.pos.z + (rand() - 0.5) * H * 16; if (g.cage.inside(x, z, 0.02) && g.cage.paintAt(x, z) === PAINT.grass && !g.cage.isWater(x, z)) { tk.src = { kind: 'grass', x, z }; break; } }
        }
      } else if (res === 'clay') {
        const s = this.waterSpot(p);
        if (s && !s.item && !s.well) tk.src = { kind: 'clay', x: s.x, z: s.z };
      } else if (res === 'food') {
        const bush = this.findNature(p, 'bush', (o) => o.food > 1);
        if (bush) tk.src = { kind: 'bush', o: bush };
        else { const d2 = this.findItem(p, (i) => i.pool && i.pool.food > 0 && g.cage.inside(i.pos.x, i.pos.z)); if (d2) tk.src = { kind: 'dep', item: d2, res: 'food' }; }
      } else if (dep) tk.src = { kind: 'dep', item: dep };
      if (!tk.src) {
        if (!tk.complained && g.time - p.lastSpeak > 20) { tk.complained = true; p.say(chatter(p, 'noResource', g, null, tk.res), { kind: 'think' }); }
        return true;
      }
    }
    const s = tk.src;
    let x, z, range;
    if (s.item) { if (!g.items.includes(s.item) || s.item.heldBy) return true; x = s.item.pos.x; z = s.item.pos.z; range = s.item.radius + H * 0.5; }
    else if (s.o) { if (!g.cage.nat.includes(s.o)) return true; x = s.o.x; z = s.o.z; range = s.o.s * 0.006 + H * 0.6; if (s.o.type === 'rock') range = 0.018 * s.o.s + H * 0.4; if (s.o.type === 'bush') range = 0.015 * s.o.s + H * 0.4; }
    else { x = s.x; z = s.z; range = H * 0.6; }
    if (!this.go(p, x, z, range)) return tk.failed;
    this.face(p, x, z);
    const rate = (0.6 + p.skill('gather') * 0.4) * (p.has('strong') ? 1.3 : 1) * (p.handsLeft === 2 ? 1 : p.handsLeft === 1 ? 0.6 : 0.15);
    tk.work = (tk.work || 0) + dt * rate;
    switch (s.kind) {
      case 'pickup':
        p.anim.action = null; p.anim.crouch = 0.7;
        if (tk.work > 0.8) { const it = s.item; p.inv[it.def.res] += it.def.amt; g.removeItem(it); return true; }
        return false;
      case 'tree': {
        const chop = tool && tool.chop ? tool.chop : 0;
        p.anim.action = chop ? 'chop' : 'build';
        if (chop && rand() < dt * 2.5) { sfx('chop', { vol: g.audibleVol(p.pos, 0.35), pitch: 2.2 }); g.fx.burst(new THREE.Vector3(x, p.pos.y + H * 0.5, z), [0x8a6a40, 0xa08050], 2, H * 0.4, 0.6); }
        if (!chop) { // no axe: break off sticks slowly
          if (tk.work > 5) { p.inv.wood += 1; if (!tk.saidAxe && rand() < 0.4) { tk.saidAxe = true; p.say(rand.pick(['I need an axe for this', 'This would be so much faster with an axe', 'My hands are killing me']), { kind: 'think' }); } return true; }
          return false;
        }
        if (tk.work > 2.5 / chop) {
          tk.work = 0;
          s.o.hp -= 1;
          p.inv.wood += 1;
          if (s.o.hp <= 0) {
            g.cage.removeNat(s.o);
            g.feed(`${p.name} chopped down a tree`, '', p);
            sfx('thud', { vol: g.audibleVol(p.pos, 0.6), pitch: 2 });
            for (let i = 0; i < 3; i++) g.spawnItem('log', new THREE.Vector3(x + (rand() - 0.5) * 0.02, g.cage.heightAt(x, z) + 0.004, z + (rand() - 0.5) * 0.02), TINY);
            if (rand() < 0.5) g.cage.addNat('tree', clamp(x + (rand() - 0.5) * 0.15, CAGE.x0 + 0.03, CAGE.x1 - 0.03), clamp(z + (rand() - 0.5) * 0.15, CAGE.z0 + 0.03, CAGE.z1 - 0.03), 0.8 + rand() * 0.4).grow = 0.05;
            return true;
          }
          return p.inv.wood >= 6;
        }
        return false;
      }
      case 'rock': {
        const mine = tool && tool.mine ? tool.mine : 0;
        p.anim.action = mine ? 'mine' : 'build';
        if (mine && rand() < dt * 2.5) { sfx('mine', { vol: g.audibleVol(p.pos, 0.3), pitch: 2 }); g.fx.burst(new THREE.Vector3(x, p.pos.y + H * 0.3, z), 0x8a8780, 2, H * 0.3, 0.6); }
        if (tk.work > (mine ? 2.5 / mine : 6)) {
          tk.work = 0;
          p.inv.stone += 1;
          s.o.hp -= mine ? 1 : 0.3;
          g.cage.dirty = true;
          if (s.o.hp <= 0) { g.cage.removeNat(s.o); return true; }
          return p.inv.stone >= 6 || !mine;
        }
        return false;
      }
      case 'grass':
        p.anim.action = 'dig'; p.anim.crouch = 0.5;
        if (tk.work > 2) { p.inv.fiber += 1; tk.work = 0; return p.inv.fiber >= 6 || rand() < 0.3; }
        return false;
      case 'clay':
        p.anim.action = 'dig';
        if (tk.work > 3) { p.inv.clay += 1; tk.work = 0; return p.inv.clay >= 4; }
        return false;
      case 'bush':
        p.anim.action = 'eat';
        if (tk.work > 2) { if (s.o.food > 0) { s.o.food--; p.inv.food += 1; g.cage.dirty = true; } tk.work = 0; return s.o.food <= 0 || p.inv.food >= 4; }
        return false;
      case 'dep': {
        const it = s.item;
        const res = s.res || tk.res;
        const need = it.def.needs;
        const toolPow = need === 'chop' ? (tool && tool.chop) || 0.25 : 1;
        p.anim.action = need === 'chop' && tool && tool.chop ? 'chop' : res === 'metal' ? 'hammer' : 'build';
        if (rand() < dt * 2) sfx(need === 'chop' ? 'chop' : res === 'metal' ? 'mine' : 'hammer', { vol: g.audibleVol(p.pos, 0.3), pitch: 2 });
        if (tk.work > 2 / toolPow) {
          tk.work = 0;
          if (!it.pool || !(it.pool[res] > 0)) return true;
          it.pool[res] -= 1;
          if (res === 'food') p.inv.food += 1; else p.inv[res] = (p.inv[res] || 0) + 1;
          g.society.note(res);
          // the special stuff (matches -> powder + fire, batteries -> electricity, pennies -> coins)
          if (it.pool.coins > 0 && g.society.money) { it.pool.coins--; p.money++; }
          const left = Object.values(it.pool).reduce((a, b) => a + Math.max(0, b), 0);
          if (left <= 0) { g.feed(`They used up the whole ${it.def.label.toLowerCase()}`, '', p); g.removeItem(it); return true; }
          return (p.inv[res] || 0) >= 6;
        }
        return false;
      }
      default: return true;
    }
  }

  // ------------------------------------------------------------- building
  build(p, tk, dt) {
    const g = this.game;
    const b = tk.target;
    const H = p.height;
    if (!b || b.progress >= 1 || !g.society.buildings.includes(b)) return true;
    const stock = this.stockOf(p);
    const miss = g.society.missing(b);
    const needKeys = Object.keys(miss);
    if (needKeys.length) {
      // fetch from the stockpile
      const have = needKeys.find((k) => (stock[k] || 0) > 0 || (p.inv[k] || 0) > 0);
      if (!have) { // nothing in storage: go gather it
        p.task = { type: 'gather', res: needKeys[0], t: 0, stage: 0 };
        return false;
      }
      if (!tk.carrying) {
        if (p.inv[have] > 0) { tk.carrying = { k: have, n: Math.min(p.inv[have], miss[have]) }; p.inv[have] -= tk.carrying.n; }
        else {
          const c = g.society.camp(p.tribe);
          if (c && !this.go(p, c.x, c.z, H * 1.5)) return tk.failed;
          const n = Math.min(stock[have], miss[have], 4);
          stock[have] -= n;
          tk.carrying = { k: have, n };
        }
      }
      p.anim.action = 'carry';
      if (!this.go(p, b.x, b.z, b.r + H * 0.6)) return tk.failed;
      b.need[tk.carrying.k] = Math.max(0, (b.need[tk.carrying.k] || 0) - tk.carrying.n);
      tk.carrying = null;
      return false;
    }
    // work on it
    const a = (p.id * 2.3) % (Math.PI * 2);
    if (!this.go(p, b.x + Math.cos(a) * (b.r + H * 0.4), b.z + Math.sin(a) * (b.r + H * 0.4), H * 0.6)) return tk.failed;
    this.face(p, b.x, b.z);
    p.anim.action = 'hammer';
    if (rand() < dt * 3) sfx('hammer', { vol: g.audibleVol(p.pos, 0.3), pitch: 2.2 });
    const def = BUILD[b.type];
    b.progress = Math.min(1, b.progress + dt * (0.6 + p.skill('build') * 0.5) * (p.handsLeft ? 1 : 0.1) / def.work);
    g.society.updateMeshProgress(b);
    if (b.progress >= 1) {
      g.feed(`${p.name} finished the ${def.label.toLowerCase()}`, 'warm', b);
      g.cage.rebuildObstacles();
      g.nav.dirty = true;
      p.remember('built', `I built the ${def.label.toLowerCase()}`, 8);
      return true;
    }
    return tk.t > 40;
  }

  // ------------------------------------------------------------- crafting
  craft(p, tk, dt) {
    const g = this.game;
    const d = ITEMS[tk.item];
    if (!d || !d.recipe) return true;
    const stock = this.stockOf(p);
    const can = Object.entries(d.recipe).every(([k, v]) => (stock[k] || 0) + (p.inv[k] || 0) >= v);
    if (!can) {
      const missing = Object.entries(d.recipe).find(([k, v]) => (stock[k] || 0) + (p.inv[k] || 0) < v);
      if (missing && ['wood', 'stone', 'fiber', 'metal', 'clay'].includes(missing[0])) { p.task = { type: 'gather', res: missing[0], t: 0, stage: 0 }; return false; }
      return true;
    }
    const station = d.tech >= 2 ? (g.society.find('forge', { done: true, near: p.pos }) || g.society.find('workbench', { done: true, near: p.pos })) : g.society.find('workbench', { done: true, near: p.pos });
    if (station && !this.go(p, station.x, station.z, station.r + p.height * 0.6)) return tk.failed;
    if (station) this.face(p, station.x, station.z);
    p.anim.action = 'hammer';
    if (rand() < dt * 2) sfx('hammer', { vol: g.audibleVol(p.pos, 0.25), pitch: 2.4 });
    if (tk.t > 4 + (d.tech || 0) * 2) {
      for (const [k, v] of Object.entries(d.recipe)) { let need = v; const fromInv = Math.min(p.inv[k] || 0, need); p.inv[k] -= fromInv; need -= fromInv; stock[k] -= need; }
      const it = g.spawnItem(tk.item, p.pos.clone(), TINY * p.look.height, { owner: p.id });
      if (p.holding) g.dropHeld(p);
      g.giveHeld(p, it);
      g.feed(`${p.name} made a ${d.label.toLowerCase()}`, d.weapon && d.weapon.type === 'shot' ? 'bad' : '', p);
      if (tk.item === 'tinyray') g.feed(`${p.name} built a tiny shrink ray. It's pointed at YOU.`, 'bad', p);
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------- talking + love
  compatible(a, b) {
    if (a.kid || b.kid) return false;
    // most people like the other sex; some don't (random per person, fixed by id)
    const aGay = (a.id * 7919) % 10 === 0, bGay = (b.id * 7919) % 10 === 0;
    const aLikes = aGay ? a.sex === b.sex : a.sex !== b.sex;
    const bLikes = bGay ? a.sex === b.sex : a.sex !== b.sex;
    return aLikes && bLikes;
  }

  chat(p, tk, dt) {
    const g = this.game;
    const o = tk.target;
    if (!o || !o.alive || o.asleep || o.busyBody) return true;
    const H = p.height;
    if (!this.go(p, o.pos.x, o.pos.z, H * 1.2)) return tk.failed || tk.t > 25;
    this.face(p, o.pos.x, o.pos.z);
    if (!o.task || (o.task.type !== 'chat' && o.task.type !== 'fight' && o.task.type !== 'flee' && !o.order)) { o.task = { type: 'chat', target: p, t: 0, stage: 0, passive: true }; o.stop(); }
    if (o.task && o.task.type === 'chat' && o.task.target === p) { o.yaw += angleDiff(o.yaw, Math.atan2(p.pos.x - o.pos.x, p.pos.z - o.pos.z)) * 0.3; o.anim.action = 'talk'; }
    p.anim.action = 'talk';
    if (tk.passive) return tk.t > 10;
    tk.lineT = (tk.lineT || 0) - dt;
    if (tk.lineT <= 0) {
      tk.lineT = 2.5 + rand() * 2;
      const speaker = tk.turn ? o : p, listener = tk.turn ? p : o;
      tk.turn = !tk.turn;
      speaker.say(chatter(speaker, 'chat', g, listener), { kind: 'chat' });
      // feelings change depending on personalities
      const r = listener.relOf(speaker), r2 = speaker.relOf(listener);
      let delta = 3;
      if (speaker.has('grumpy') || speaker.has('cruel')) delta -= 4;
      if (speaker.has('funny') || speaker.has('kind')) delta += 3;
      if (listener.has('loner')) delta -= 2;
      if (speaker.tribe != null && speaker.tribe !== listener.tribe) delta -= 2;
      if (speaker.has('liar') && rand() < 0.2) { delta -= 6; listener.remember('lie', `${speaker.name} lied to me`, -5, speaker.id); }
      r.f = clamp(r.f + delta + rand() * 3 - 1, -100, 100);
      r2.f = clamp(r2.f + delta * 0.6, -100, 100);
      if (this.compatible(p, o) && r.f > 25) { r.l = clamp(r.l + 1.5 + (listener.has('romantic') ? 1.5 : 0), 0, 100); }
      // gossip about the giant spreads opinions
      if (rand() < 0.3) { listener.op = clamp(listener.op + (speaker.op - listener.op) * 0.08, -100, 100); listener.faith = clamp(listener.faith + (speaker.faith - listener.faith) * 0.06, 0, 100); }
      p.needs.social = Math.min(100, p.needs.social + 7); o.needs.social = Math.min(100, o.needs.social + 7);
      p.needs.fun = Math.min(100, p.needs.fun + 2);
    }
    return p.needs.social > 92 || tk.t > 30;
  }

  romance(p, tk, dt) {
    const g = this.game;
    const o = tk.target;
    if (!o || !o.alive || o.busyBody) return true;
    const H = p.height;
    if (!this.go(p, o.pos.x, o.pos.z, H * 0.7)) return tk.failed || tk.t > 25;
    this.face(p, o.pos.x, o.pos.z);
    const r = p.relOf(o), r2 = o.relOf(p);
    if (!tk.asked) {
      tk.asked = true;
      // do they like you back?
      const likes = this.compatible(p, o) && r2.f > 10 && (r2.l > 20 || rand() < 0.3) && !(o.partner && o.partner !== p.id && !o.has('flirty'));
      if (!likes) {
        p.say(chatter(p, 'flirt', g, o), { kind: 'love' });
        setTimeout(() => o.alive && o.say(chatter(o, 'reject', g, p), { kind: 'chat' }), 1500);
        r.l = Math.max(0, r.l - 15); r.f -= 5;
        p.remember('rejected', `${o.name} turned me down`, -10, o.id);
        return true;
      }
      p.say(chatter(p, 'flirt', g, o), { kind: 'love' });
      if (!o.order) { o.task = { type: 'chat', target: p, t: 0, stage: 0, passive: true }; o.stop(); }
    }
    p.anim.action = 'hug';
    if (rand() < dt * 1.5) g.fx.burst(p.headPos(_v.clone()).add(_v2.set(0, H * 0.2, 0)), 0xff5f9e, 1, H * 0.6, 0.4, { float: true, life: 1.2 });
    r.l = clamp(r.l + dt * 2.5, 0, 100); r2.l = clamp(r2.l + dt * 2, 0, 100);
    if (tk.t > 6) {
      if (!p.partner && !o.partner && r.l > 60 && r2.l > 55) {
        p.partner = o.id; o.partner = p.id;
        g.feed(`${p.name} and ${o.name} are together now`, 'love', p);
        sfx('heart');
      } else if (p.partner === o.id && !p.married && r.l > 85 && r2.l > 80 && rand() < 0.3) {
        p.married = o.married = true;
        g.feed(`WEDDING! ${p.name} and ${o.name} got married`, 'love', p);
        for (const q of g.peopleNear(p.pos, H * 40)) if (q.alive && q !== p && q !== o && !q.kid && rand() < 0.6) this.giveTask(q, { type: 'party', target: { x: p.pos.x, z: p.pos.z, r: H * 2, progress: 1 } });
        sfx('heart');
      } else if (p.partner && p.partner !== o.id) {
        // cheating! if anyone saw it, drama
        const ex = g.byId(p.partner);
        g.feed(`${p.name} is cheating on ${ex ? ex.name : 'their partner'} with ${o.name}`, 'bad', p);
        if (ex && ex.alive && ex.dist(p.pos) < H * 25) {
          ex.relOf(p).l -= 50; ex.relOf(p).f -= 40; ex.relOf(o).f -= 60;
          ex.say(rand.pick(['ARE YOU SERIOUS?!', 'I SAW THAT!', 'We\'re done!']), { kind: 'angry' });
          if (ex.relOf(p).l < 30) { ex.partner = null; p.partner = null; ex.married = p.married = false; g.feed(`${ex.name} broke up with ${p.name}`, 'bad', ex); }
        }
      }
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------- fighting
  fight(p, tk, dt) {
    const g = this.game;
    const H = p.height;
    let t = tk.target;
    const isPlayer = t === 'player';
    if (isPlayer) t = g.player;
    if (!t || (t.alive === false) || (t !== g.player && t.objectForm)) { tk.done = true; this.afterFight(p, tk); return true; }
    if (!isPlayer && t.kid) return true; // never kids
    // cowards and badly hurt people run
    if (p.health < 25 && !tk.lethal && !p.has('brave')) { this.giveTask(p, { type: 'flee', from: t.pos.clone(), time: 6 }); return false; }
    const tp = isPlayer ? g.player.feetPos : t.pos;
    const w = p.holding && p.holding.def.weapon ? p.holding.def.weapon : { type: 'blunt', dmg: 6, reach: 0.55, speed: 1.3 };
    const reach = (w.reach || 0.6) * H / 1.75 * 1.75;
    const d = Math.hypot(tp.x - p.pos.x, tp.z - p.pos.z);
    if (!tk.yelled) { tk.yelled = true; p.say(chatter(p, isPlayer ? 'fightGiant' : 'fight', g, isPlayer ? null : t), { kind: 'angry' }); }
    if (w.ranged) {
      if (d > reach * 0.9) { this.go(p, tp.x, tp.z, reach * 0.7, true); return false; }
      p.stop(); this.face(p, tp.x, tp.z);
      p.anim.action = 'aim';
      if (tk.t > (tk.next || 0.8)) {
        tk.next = tk.t + 1 / w.speed;
        p.anim.action = 'shoot'; p.anim.at = 0;
        g.shoot(p, t, w);
      }
    } else {
      if (d > reach) { this.go(p, tp.x, tp.z, reach * 0.8, true); p.anim.action = null; return tk.t > 60; }
      p.stop(); this.face(p, tp.x, tp.z);
      if (tk.t > (tk.next || 0)) {
        tk.next = tk.t + (1.1 + rand() * 0.5) / (w.speed || 1) / (p.skill('fight') > 1 ? 1.2 : 1);
        p.anim.action = w.type === 'pierce' ? 'stab' : w.type === 'blade' ? 'swing' : 'punch';
        p.anim.at = 0;
        tk.strikeAt = tk.t + 0.22;
      }
      if (tk.strikeAt && tk.t >= tk.strikeAt) {
        tk.strikeAt = 0;
        // hit chance: skill vs dodge (scared office workers swing wild)
        const skill = 0.5 + p.skill('fight') * 0.2 + (p.has('strong') ? 0.1 : 0) - (p.fear > 70 ? 0.2 : 0);
        const dodge = isPlayer ? 0.15 : 0.1 + (t.skill ? t.skill('fight') * 0.1 : 0) + (t.has && t.has('coward') ? 0.1 : 0);
        if (rand() < skill - dodge) {
          const dmg = (w.dmg || 6) * (0.7 + rand() * 0.6) * (p.has('strong') ? 1.25 : 1) * (p.handsLeft === 0 ? 0.4 : 1);
          const dir = _v2.set(tp.x - p.pos.x, 0.3, tp.z - p.pos.z).normalize().clone();
          if (isPlayer) g.player.takeHit(dmg, p, w.type);
          else if (t.isBug) t.hurt(dmg, p, w.type);
          else {
            const parts = ['torso', 'torso', 'head', 'lArm', 'rArm', 'lLeg', 'rLeg'];
            const part = rand.pick(parts);
            const point = part === 'head' ? t.headPos(new THREE.Vector3()) : t.center(new THREE.Vector3());
            const wasAlive = t.alive;
            t.hurt({ dmg, type: w.type, from: p, dir, point, part });
            if (w.shock) { t.stun = 2; g.fx.burst(point, 0x60c0ff, 6, H, 1, { glow: true }); }
            if (wasAlive && !t.alive) { p.kills++; this.onKill(p, t, tk); }
          }
          sfx(w.type === 'blade' ? 'slice' : 'hit', { vol: g.audibleVol(p.pos, 0.5), pitch: 1.6 });
        }
      }
    }
    // a non-lethal fight ends once the other guy is beaten up
    if (!tk.lethal && !isPlayer && !t.isBug && (t.health < 35 || t.ko > 0)) { tk.done = true; this.afterFight(p, tk); return true; }
    if (isPlayer && g.player.scale > p.scale * 4) return true;
    return tk.t > 90;
  }

  onKill(p, victim, tk) {
    const g = this.game;
    p.remember('kill', `I killed ${victim.name}`, p.has('cruel') ? 5 : -40, victim.id);
    // witnesses report murder unless it was war / self defense / an execution
    if (tk.why !== 'war' && tk.why !== 'self-defense' && tk.why !== 'execute' && tk.why !== 'order-mind') {
      const witnesses = g.peopleNear(p.pos, p.height * 25).filter((o) => o.alive && o !== p && !o.kid && !o.asleep);
      for (const o of witnesses) { o.relOf(p).f -= 40; o.fear = Math.min(100, o.fear + 20); }
      if (witnesses.length) g.society.crime(p, 'murder', victim);
    }
  }

  afterFight(p, tk) {
    p.anim.action = null;
    if (tk.why === 'jealous' || tk.why === 'grudge') { const t = tk.target; if (t && t.relOf) { p.relOf(t).f = Math.min(p.relOf(t).f + 20, 0); } }
  }

  // ------------------------------------------------------------- funerals
  bury(p, tk, dt) {
    const g = this.game;
    const c = tk.target;
    const H = p.height;
    if (!c || c.alive || c.buried) { if (tk.carrying) { c && (c.carriedBy = null); } return true; }
    if (tk.stage === 0) {
      if (c.carriedBy && c.carriedBy !== p) return true;
      if (!this.go(p, c.pos.x, c.pos.z, H * 0.7)) return tk.failed;
      tk.stage = 1;
      c.carriedBy = p;
      tk.spot = g.society.graveSpot();
      if (!tk.spot) { c.carriedBy = null; return true; }
      if (rand() < 0.5) p.say(chatter(p, 'bury', g, c), { kind: 'sad' });
    }
    if (tk.stage === 1) {
      // carry the body in their arms
      p.anim.action = 'carry';
      const hold = p.center(_v.clone()).add(_v2.set(Math.sin(p.yaw) * H * 0.25, H * 0.05, Math.cos(p.yaw) * H * 0.25));
      c.body.pin(1, hold);
      c.body.wake();
      if (!this.go(p, tk.spot.x, tk.spot.z, H * 0.6)) { if (tk.failed) { c.body.unpin(); c.carriedBy = null; } return tk.failed; }
      c.body.unpin();
      tk.stage = 2; tk.digT = 0;
    }
    if (tk.stage === 2) {
      p.anim.action = 'dig';
      tk.digT += dt;
      if (rand() < dt * 2) g.fx.burst(new THREE.Vector3(tk.spot.x, g.cage.heightAt(tk.spot.x, tk.spot.z), tk.spot.z), 0x5e3f22, 2, H * 0.3, 0.5);
      if (tk.digT > 6) {
        c.buried = true; c.carriedBy = null;
        c.body.hidden = true; c.body.hideAll();
        const gr = g.society.place('grave', tk.spot.x, tk.spot.z, { progress: 1, data: { who: c.id, cross: p.has('religious') || p.job === 'priest' }, label: `Grave of ${c.name}`, rot: 0 });
        void gr;
        g.feed(`${p.name} buried ${c.name}`, '', p);
        // mourners
        for (const o of g.peopleNear(p.pos, H * 50)) if (o.alive && !o.kid && o !== p && (o.relOf(c).f > 25 || o.relOf(c).l > 30)) this.giveTask(o, { type: 'mourn' });
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------- escaping
  escape(p, tk, dt) {
    const g = this.game;
    const c = g.cage;
    const H = p.height;
    if (!tk.spot) {
      // the closest glass wall
      const opts = [[p.pos.x, CAGE.z1 - H * 0.4, 0], [p.pos.x, CAGE.z0 + H * 0.4, 1], [CAGE.x0 + H * 0.4, p.pos.z, 2], [CAGE.x1 - H * 0.4, p.pos.z, 3]];
      opts.sort((a, b) => Math.hypot(a[0] - p.pos.x, a[1] - p.pos.z) - Math.hypot(b[0] - p.pos.x, b[1] - p.pos.z));
      tk.spot = { x: clamp(opts[0][0], CAGE.x0 + 0.03, CAGE.x1 - 0.03), z: clamp(opts[0][1], CAGE.z0 + 0.03, CAGE.z1 - 0.03), side: opts[0][2] };
      if (!tk.said) { tk.said = true; p.say(chatter(p, 'escape', g), { kind: 'angry' }); }
    }
    if (!this.go(p, tk.spot.x, tk.spot.z, H * 0.5)) return tk.failed;
    // hit the glass with whatever they have
    p.anim.action = p.holding ? 'swing' : 'bang';
    if (tk.t > (tk.next || 0)) {
      tk.next = tk.t + 1.2;
      const w = p.holding && p.holding.def.weapon;
      const power = (w ? w.dmg : 3) * (p.has('strong') ? 1.4 : 1);
      g.hitGlass(p, tk.spot, power);
    }
    return tk.t > 40;
  }
}
