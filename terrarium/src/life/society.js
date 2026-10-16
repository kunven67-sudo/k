// The tiny society: buildings, stockpiles, tech ages, tribes, leaders, laws, money, culture,
// births, funerals. It decides WHAT needs doing; ai.js decides who does it.
import * as THREE from 'three';
import { BUILD, makeBuildingMesh, makeScaffold } from './buildings.js';
import { TINY, ITEMS } from './items.js';
import { CAGE } from '../world/cage.js';
import { rand, clamp, nextId, bumpId, lerp } from '../core/util.js';
import { sfx } from '../core/audio.js';

export const TECH = [
  { name: 'Stone Age', pts: 0 },
  { name: 'Wood Age', pts: 50 },
  { name: 'Metal Age', pts: 160, needs: 'metal' },
  { name: 'Gunpowder Age', pts: 320, needs: 'powder' },
  { name: 'Electric Age', pts: 560, needs: 'electric' },
  { name: 'Gadget Age', pts: 900 },
];

const TRIBE_NAMES = ['Red Hand', 'Pond People', 'The Glass Wolves', 'Lamp Children', 'Root Clan', 'The Free', 'Stone Fist', 'Night Crows', 'The Faithful', 'Iron Teeth', 'Sun Seekers', 'The Rebels'];
const TRIBE_COLORS = ['#c0392b', '#2471a3', '#239b56', '#d68910', '#7d3c98', '#17a589', '#839192', '#d4ac0d'];
const SYMBOLS = ['X', 'O', 'Y', 'V', 'W', 'Z', 'H', 'A'];

export class Society {
  constructor(game) {
    this.game = game;
    this.buildings = [];
    this.stock = { wood: 0, stone: 0, fiber: 0, food: 8, metal: 0, clay: 0, powder: 0, electric: 0, bandage: 0, medicine: 0, coins: 0, seeds: 0 };
    this.tech = 0;
    this.points = 0;
    this.seen = new Set();
    this.money = 0;          // 0 none, 1 shells, 2 coins
    this.trades = 0;
    this.tribes = [];
    this.leader = null;      // before tribes: one leader for everyone
    this.laws = [];
    this.places = [];
    this.legends = [];
    this.planT = 5;
    this.cultureT = 20;
    this.group = new THREE.Group();
    game.world.lab.add(this.group);
  }

  // ------------------------------------------------------------- buildings
  place(type, x, z, opts = {}) {
    const def = BUILD[type];
    const b = {
      id: opts.id || nextId(), type, x, z, rot: opts.rot ?? rand() * Math.PI * 2, progress: opts.progress ?? 0, need: { ...def.cost }, tribe: opts.tribe ?? null,
      r: def.r * TINY, h: def.h * TINY, solid: !!def.solid, owner: opts.owner || null, label: opts.label || def.label, data: opts.data || {},
    };
    bumpId(b.id);
    if (b.progress >= 1) b.need = {};
    this.buildings.push(b);
    this.makeMesh(b);
    if (b.progress >= 1) this.game.cage.rebuildObstacles(), this.game.nav && (this.game.nav.dirty = true);
    return b;
  }

  makeMesh(b) {
    if (b.mesh) { this.group.remove(b.mesh); }
    const m = makeBuildingMesh(b.type, b.data);
    m.scale.setScalar(TINY);
    m.position.set(b.x, this.game.cage.heightAt(b.x, b.z), b.z);
    m.rotation.y = b.rot;
    m.userData.building = b;
    b.mesh = m;
    this.group.add(m);
    if (b.progress < 1) {
      b.scaffold = makeScaffold(BUILD[b.type].r, BUILD[b.type].h);
      b.scaffold.scale.setScalar(TINY);
      b.scaffold.position.copy(m.position);
      this.group.add(b.scaffold);
    }
    this.updateMeshProgress(b);
  }

  updateMeshProgress(b) {
    const k = clamp(b.progress, 0, 1);
    b.mesh.scale.set(TINY, TINY * Math.max(0.05, k), TINY);
    if (k >= 1 && b.scaffold) { this.group.remove(b.scaffold); b.scaffold = null; }
  }

  remove(b) {
    const i = this.buildings.indexOf(b);
    if (i < 0) return;
    this.buildings.splice(i, 1);
    this.group.remove(b.mesh);
    if (b.scaffold) this.group.remove(b.scaffold);
    this.game.cage.rebuildObstacles();
    if (this.game.nav) this.game.nav.dirty = true;
    for (const p of this.game.people) if (p.home === b.id) p.home = null;
  }

  // a building is destroyed by the giant, an earthquake, fire...
  smash(b, by) {
    const g = this.game;
    g.fx.burst(new THREE.Vector3(b.x, g.cage.heightAt(b.x, b.z) + b.h * 0.5, b.z), [0x7a5232, 0x8a8780, 0xc2a65a], 26, b.h * 2, 1.4);
    sfx('crack', { vol: g.audibleVol(new THREE.Vector3(b.x, 0.9, b.z), 1) });
    // a few resources survive
    const back = BUILD[b.type].cost;
    for (const [k, v] of Object.entries(back)) this.stock[k] = (this.stock[k] || 0) + Math.floor(v * 0.3 * b.progress);
    // anyone inside gets hurt
    for (const p of g.people) if (p.alive && p.inCage && Math.hypot(p.pos.x - b.x, p.pos.z - b.z) < b.r) p.hurt({ dmg: 25, type: 'crush', dir: new THREE.Vector3(0, -1, 0), from: by });
    this.remove(b);
    if (by === 'player') {
      for (const p of g.people) if (p.alive && !p.kid && p.inCage) { p.op = clamp(p.op - 6, -100, 100); p.remember('smash', `The giant destroyed our ${BUILD[b.type].label.toLowerCase()}`, -6, 'player'); }
      g.feed(`You destroyed their ${BUILD[b.type].label.toLowerCase()}`, 'bad');
    }
  }

  find(type, opts = {}) {
    let best = null, bd = Infinity;
    for (const b of this.buildings) {
      if (b.type !== type) continue;
      if (opts.done && b.progress < 1) continue;
      if (opts.tribe !== undefined && b.tribe !== opts.tribe && b.tribe !== null) continue;
      if (opts.near) { const d = Math.hypot(b.x - opts.near.x, b.z - opts.near.z); if (d < bd) { bd = d; best = b; } } else return b;
    }
    return best;
  }

  count(type, done = false) { return this.buildings.filter((b) => b.type === type && (!done || b.progress >= 1)).length; }

  nearFire(pos, r) {
    for (const b of this.buildings) if ((b.type === 'campfire' || b.type === 'forge' || b.type === 'effigy') && b.progress >= 1 && Math.hypot(b.x - pos.x, b.z - pos.z) < r + b.r) return b;
    for (const it of this.game.items) if (it.type === 'candle' && Math.hypot(it.pos.x - pos.x, it.pos.z - pos.z) < r * 2) return it;
    return null;
  }

  sheltersFree(tribe) {
    let cap = 0;
    for (const b of this.buildings) if (b.progress >= 1 && BUILD[b.type].shelter && (tribe == null || b.tribe == null || b.tribe === tribe)) cap += BUILD[b.type].shelter;
    for (const it of this.game.items) if (it.def.shelter && this.game.cage.inside(it.pos.x, it.pos.z)) cap += it.def.shelter;
    return cap;
  }

  camp(tribe) {
    if (tribe != null) { const t = this.tribes.find((x) => x.id === tribe); if (t) return t.camp; }
    const sp = this.find('stockpile');
    if (sp) return { x: sp.x, z: sp.z };
    return null;
  }

  // pick a free spot near the camp for a new building
  siteFor(type, near) {
    const g = this.game;
    const c = g.cage;
    const r = BUILD[type].r * TINY;
    const center = near || this.camp() || { x: (CAGE.x0 + CAGE.x1) / 2, z: (CAGE.z0 + CAGE.z1) / 2 };
    for (let tries = 0; tries < 80; tries++) {
      const ang = rand() * Math.PI * 2, dist = (0.03 + tries * 0.006) * (0.6 + rand() * 0.8);
      const x = center.x + Math.cos(ang) * dist, z = center.z + Math.sin(ang) * dist;
      if (!c.inside(x, z, r + 0.01)) continue;
      if (c.isWater(x, z) || c.isWater(x + r, z) || c.isWater(x - r, z) || c.isWater(x, z + r) || c.isWater(x, z - r)) continue;
      const h = c.heightAt(x, z);
      if (Math.abs(c.heightAt(x + r, z) - h) > r * 0.5 || Math.abs(c.heightAt(x, z + r) - h) > r * 0.5) continue;
      if (this.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r + 0.006)) continue;
      if (c.obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 0.003)) continue;
      if (g.items.some((it) => it.def.big && Math.hypot(it.pos.x - x, it.pos.z - z) < it.radius + r)) continue;
      return { x, z };
    }
    return null;
  }

  // ------------------------------------------------------------- planning
  update(dt) {
    const g = this.game;
    const alive = g.people.filter((p) => p.alive && p.inCage && !p.objectForm);
    const adults = alive.filter((p) => !p.kid);
    // fires flicker
    for (const b of this.buildings) if (b.mesh.userData.flame && b.progress >= 1) { const f = b.mesh.userData.flame; f.scale.setScalar(0.85 + Math.random() * 0.3); if (Math.random() < dt * 8) g.fx.fire(new THREE.Vector3(b.x, g.cage.heightAt(b.x, b.z) + b.h * 0.4, b.z), TINY * 1.75); }
    // farms grow food
    for (const b of this.buildings) if (b.type === 'farm' && b.progress >= 1) { b.data.grow = Math.min(1, (b.data.grow || 0) + dt / (b.data.tended > 0 ? 160 : 600)); b.data.tended = Math.max(0, (b.data.tended || 0) - dt); }
    this.planT -= dt;
    if (this.planT <= 0 && adults.length) { this.planT = 12; this.plan(adults); }
    this.cultureT -= dt;
    if (this.cultureT <= 0 && adults.length) { this.cultureT = 25 + rand() * 20; this.culture(adults); }
    this.politicsT = (this.politicsT || 30) - dt;
    if (this.politicsT <= 0 && adults.length >= 3) { this.politicsT = 45; this.politics(adults); }
    // tech up
    const next = TECH[this.tech + 1];
    if (next && this.points >= next.pts && (!next.needs || this.seen.has(next.needs))) {
      this.tech++;
      g.feed(`The tiny people reached the ${TECH[this.tech].name}!`, 'warm');
      sfx('cash');
      for (const p of adults) p.remember('tech', `We reached the ${TECH[this.tech].name}`, 8);
      if (this.tech >= 2 && !this.money && this.trades > 3) this.inventMoney(1);
    }
    if (this.money === 1 && this.tech >= 2 && this.seen.has('metal') && this.count('forge', true)) this.inventMoney(2);
  }

  addPoints(n) { this.points += n; }
  note(res) { if (!this.seen.has(res)) { this.seen.add(res); if (['metal', 'powder', 'electric'].includes(res)) this.game.feed(`They found ${res === 'electric' ? 'electricity' : res}. New things are possible.`, 'warm'); } }

  inventMoney(level) {
    if (this.money >= level) return;
    this.money = level;
    this.game.feed(level === 1 ? 'The tiny people invented money: shells and pebbles!' : 'They started minting real metal coins!', 'warm');
    for (const p of this.game.people) if (p.alive && !p.kid) p.money += level === 1 ? 5 : 3;
  }

  // what should be built next? one plan at a time per tribe
  plan(adults) {
    const groups = this.tribes.length ? this.tribes.map((t) => ({ tribe: t.id, members: adults.filter((p) => p.tribe === t.id) })) : [{ tribe: null, members: adults }];
    for (const grp of groups) {
      if (!grp.members.length) continue;
      const pending = this.buildings.filter((b) => b.progress < 1 && b.tribe === grp.tribe);
      if (pending.length >= 2) continue;
      const has = (t) => this.buildings.some((b) => b.type === t && (b.tribe === grp.tribe || b.tribe === null));
      const n = grp.members.length;
      const faith = grp.members.reduce((s, p) => s + p.faith, 0) / n;
      const hate = grp.members.filter((p) => p.op < -50).length;
      const near = this.camp(grp.tribe);
      let want = null;
      if (!has('stockpile')) {
        const c = near || this.findCampSpot();
        if (c) this.place('stockpile', c.x, c.z, { tribe: grp.tribe, progress: 1 });
        continue;
      }
      if (!has('campfire')) want = 'campfire';
      else if (!has('workbench')) want = 'workbench';
      else if (this.sheltersFree(grp.tribe) < n) want = this.tech >= 1 ? (this.stock.stone >= 8 && rand() < 0.4 ? 'house' : 'hut') : 'leanto';
      else if (this.tech >= 1 && !has('farm')) want = 'farm';
      else if (!has('latrine') && n >= 4) want = 'latrine';
      else if (this.tech >= 1 && !has('well') && n >= 6) want = 'well';
      else if (faith > 35 && !has('statue') && this.tech >= 1) want = 'statue';
      else if (hate >= Math.max(2, n * 0.4) && !has('effigy')) want = 'effigy';
      else if (faith > 50 && !has('shrine') && this.tech >= 1) want = 'shrine';
      else if (this.money && !has('market') && n >= 5) want = 'market';
      else if (this.tech >= 2 && this.seen.has('metal') && !has('forge')) want = 'forge';
      else if (this.tech >= 2 && this.laws.length && !has('jail')) want = 'jail';
      else if (this.tech >= 2 && !has('hospital') && n >= 8) want = 'hospital';
      else if (this.tribes.length > 1 && this.atWar(grp.tribe) && this.count('wall') < 6) want = rand() < 0.3 ? 'tower' : 'wall';
      else if (this.tech >= 4 && !has('lab')) want = 'lab';
      else if (this.tech >= 4 && this.count('lamp') < 4) want = 'lamp';
      else if (this.tech >= 2 && !has('arena') && grp.members.some((p) => p.has('cruel') && p.title === 'Leader')) want = 'arena';
      else if (grp.tribe != null && !this.buildings.some((b) => b.type === 'flag' && b.tribe === grp.tribe)) want = 'flag';
      if (!want) continue;
      if (BUILD[want].tech > this.tech) continue;
      const site = this.siteFor(want, near);
      if (!site) continue;
      const t = this.tribes.find((x) => x.id === grp.tribe);
      const b = this.place(want, site.x, site.z, { tribe: grp.tribe, data: want === 'flag' && t ? { color: t.color, symbol: t.symbol } : {} });
      if (want === 'statue' || want === 'effigy' || want === 'shrine') this.game.feed(want === 'effigy' ? 'They are building a burning effigy of YOU' : `They started building a ${BUILD[want].label.toLowerCase()}`, want === 'effigy' ? 'bad' : 'warm', b);
    }
  }

  findCampSpot() {
    const g = this.game;
    const people = g.people.filter((p) => p.alive && p.inCage);
    let cx = 0, cz = 0;
    for (const p of people) { cx += p.pos.x; cz += p.pos.z; }
    if (people.length) { cx /= people.length; cz /= people.length; } else { cx = (CAGE.x0 + CAGE.x1) / 2; cz = (CAGE.z0 + CAGE.z1) / 2; }
    // walk toward flat dry ground
    const s = this.siteFor('stockpile', { x: cx, z: cz });
    return s;
  }

  // next job for a worker: deliver resources or work on a site
  buildJob(p) {
    let best = null, bd = Infinity;
    for (const b of this.buildings) {
      if (b.progress >= 1) continue;
      if (this.tribes.length && b.tribe !== null && b.tribe !== p.tribe) continue;
      const d = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  missing(b) {
    const out = {};
    for (const [k, v] of Object.entries(b.need)) if (v > 0) out[k] = v;
    return out;
  }

  // ------------------------------------------------------------- politics
  politics(adults) {
    const g = this.game;
    // leader for everybody before there are tribes
    if (!this.tribes.length) {
      const L = this.pickLeader(adults, this.leader);
      if (L && L !== this.leader) {
        const old = this.leader;
        this.leader = L;
        for (const p of adults) p.title = p === L ? 'Leader' : p.title === 'Leader' ? '' : p.title;
        g.feed(old ? `${L.name} took over as leader from ${old.name}` : `${L.name} became the leader`, 'warm', L);
        if (L.has('smart') || L.job === 'cop' || L.job === 'lawyer' || L.job === 'teacher') this.makeLaws(L);
      }
      // split into tribes when there are enough people and real grudges
      if (adults.length >= 7 && this.grudges(adults) > adults.length * 0.6) this.formTribes(adults);
    } else {
      for (const t of this.tribes) {
        const members = adults.filter((p) => p.tribe === t.id);
        if (!members.length) continue;
        const L = this.pickLeader(members, t.leader && g.byId(t.leader));
        if (L && (!t.leader || L.id !== t.leader)) { t.leader = L.id; L.title = 'Chief'; g.feed(`${L.name} leads the ${t.name} now`, 'warm', L); }
        t.camp = t.camp || { x: members[0].pos.x, z: members[0].pos.z };
      }
      // war or peace between tribes
      for (const a of this.tribes) for (const b of this.tribes) {
        if (a.id >= b.id) continue;
        const ma = adults.filter((p) => p.tribe === a.id), mb = adults.filter((p) => p.tribe === b.id);
        if (!ma.length || !mb.length) continue;
        let s = 0, n = 0;
        for (const p of ma) for (const q of mb) { s += p.relOf(q).f; n++; }
        const avg = s / Math.max(1, n);
        const la = g.byId(a.leader), lb = g.byId(b.leader);
        const warlike = [la, lb].some((l) => l && (l.has('cruel') || l.has('hothead') || l.has('greedy')));
        const key = a.id + ':' + b.id;
        const war = this.wars && this.wars.has(key);
        if (!war && avg < -18 && warlike) { (this.wars ||= new Set()).add(key); g.feed(`WAR! The ${a.name} and the ${b.name} are at war`, 'bad'); }
        else if (war && (avg > -5 || [la, lb].every((l) => !l || l.has('kind') || l.has('calm')))) { this.wars.delete(key); g.feed(`The ${a.name} and the ${b.name} made peace`, 'warm'); }
      }
    }
    // revenge on the leader if people hate them (revolution)
    const lead = this.leader;
    if (lead && lead.alive) {
      const haters = adults.filter((p) => p !== lead && p.relOf(lead).f < -40 && (p.has('rebel') || p.has('hothead') || p.has('brave')));
      if (haters.length >= 3) {
        g.feed(`Revolution! ${haters.length} people turned on ${lead.name}`, 'bad', lead);
        for (const h of haters) g.ai.giveTask(h, { type: 'fight', target: lead, why: 'revolution' });
        this.leader = null;
      }
    }
  }

  pickLeader(group, current) {
    let best = null, bs = -Infinity;
    for (const p of group) {
      if (!p.alive || p.kid) continue;
      let s = 0;
      if (p.has('leader')) s += 40;
      if (p.has('follower') || p.has('coward')) s -= 30;
      if (p.has('smart')) s += 10;
      if (['cop', 'lawyer', 'teacher', 'soldier', 'priest', 'coach'].includes(p.job)) s += 15;
      if (p.has('cruel') && p.has('strong')) s += 25; // the bully way
      for (const q of group) if (q !== p) s += q.relOf(p).f * 0.25;
      if (p === current) s += 20; // leaders stick unless clearly beaten
      if (s > bs) { bs = s; best = p; }
    }
    return best;
  }

  grudges(adults) {
    let n = 0;
    for (const p of adults) for (const [, r] of p.rel) if (r.f < -25) n++;
    return n / 2;
  }

  formTribes(adults) {
    const g = this.game;
    const leaders = adults.filter((p) => p.has('leader') || p === this.leader).slice(0, 3);
    if (leaders.length < 2) {
      // the most disliked strong person starts a rival group
      const rival = adults.filter((p) => !leaders.includes(p)).sort((a, b) => (b.has('rebel') + b.has('hothead') + b.has('brave')) - (a.has('rebel') + a.has('hothead') + a.has('brave')))[0];
      if (rival) leaders.push(rival);
    }
    if (leaders.length < 2) return;
    const names = [...TRIBE_NAMES].sort(() => rand() - 0.5);
    this.tribes = leaders.map((l, i) => ({ id: i + 1, name: names[i], color: TRIBE_COLORS[i % TRIBE_COLORS.length], symbol: SYMBOLS[i % SYMBOLS.length], leader: l.id, camp: null }));
    for (const p of adults) {
      if (leaders.includes(p)) { p.tribe = this.tribes[leaders.indexOf(p)].id; continue; }
      let best = null, bs = -999;
      leaders.forEach((l, i) => { const s = p.relOf(l).f + (p.partner && g.byId(p.partner) && g.byId(p.partner).tribe === i + 1 ? 50 : 0) + rand() * 10; if (s > bs) { bs = s; best = this.tribes[i]; } });
      p.tribe = bs > -40 || !p.has('loner') ? best.id : null;
    }
    // kids follow a parent
    for (const k of g.people.filter((p) => p.kid)) { const par = k.parents.map((id) => g.byId(id)).find(Boolean); if (par) k.tribe = par.tribe; }
    // second tribe gets its own camp on the other side
    const c = this.camp(null);
    this.tribes[0].camp = c ? { ...c } : { x: CAGE.x0 + 0.5, z: (CAGE.z0 + CAGE.z1) / 2 };
    for (let i = 1; i < this.tribes.length; i++) {
      const cx = c && c.x < (CAGE.x0 + CAGE.x1) / 2 ? CAGE.x1 - 0.45 - i * 0.1 : CAGE.x0 + 0.45 + i * 0.1;
      const s = this.siteFor('stockpile', { x: cx, z: (CAGE.z0 + CAGE.z1) / 2 + (i - 1) * 0.3 });
      this.tribes[i].camp = s || { x: cx, z: (CAGE.z0 + CAGE.z1) / 2 };
      if (s) this.place('stockpile', s.x, s.z, { tribe: this.tribes[i].id, progress: 1 });
    }
    for (const b of this.buildings) if (b.tribe === null) b.tribe = this.tribes[0].id;
    g.feed(`The cage split into tribes: ${this.tribes.map((t) => 'the ' + t.name).join(' and ')}`, 'warm');
    this.leader = null;
  }

  atWar(tribe) {
    if (!this.wars || tribe == null) return false;
    for (const k of this.wars) if (k.split(':').map(Number).includes(tribe)) return true;
    return false;
  }

  enemyTribe(a, b) {
    if (!this.wars || a == null || b == null || a === b) return false;
    return this.wars.has(Math.min(a, b) + ':' + Math.max(a, b));
  }

  makeLaws(L) {
    if (this.laws.length) return;
    this.laws = ['No killing', 'No stealing'];
    if (L.has('religious')) this.laws.push('Pray to the Giant');
    if (L.has('cruel')) this.laws.push('Obey the leader');
    this.game.feed(`${L.name} made laws: ${this.laws.join(', ')}`, 'warm', L);
  }

  // a crime was seen. The leader decides what happens (depends on who the leader is)
  crime(criminal, kind, victim) {
    const g = this.game;
    const L = this.tribes.length ? g.byId((this.tribes.find((t) => t.id === criminal.tribe) || {}).leader) : this.leader;
    if (!L || !L.alive || L === criminal || !this.laws.length) return;
    let punish = 'warn';
    if (kind === 'murder') punish = L.has('cruel') ? 'execute' : this.count('jail', true) ? 'jail' : L.has('kind') ? 'exile' : 'beat';
    else if (kind === 'theft') punish = this.count('jail', true) && rand() < 0.5 ? 'jail' : L.has('cruel') ? 'beat' : 'warn';
    g.feed(`${L.name} punished ${criminal.name} for ${kind === 'murder' ? 'killing ' + (victim ? victim.name : 'someone') : 'stealing'}: ${{ execute: 'death', jail: 'jail', exile: 'kicked out', beat: 'a beating', warn: 'a warning' }[punish]}`, 'bad', criminal);
    criminal.remember('punished', `${L.name} punished me (${punish})`, -20, L.id);
    criminal.relOf(L).f -= 25;
    if (punish === 'execute' || punish === 'beat') {
      const guard = g.people.find((p) => p.alive && !p.kid && p !== criminal && (p.job === 'cop' || p.job === 'soldier' || p.has('strong')) && (p.tribe === criminal.tribe)) || L;
      g.ai.giveTask(guard, { type: 'fight', target: criminal, why: punish, lethal: punish === 'execute' });
    } else if (punish === 'jail') {
      const j = this.find('jail', { done: true });
      if (j) { criminal.jailUntil = g.time + 120; criminal.moveTo(new THREE.Vector3(j.x, 0, j.z)); }
    } else if (punish === 'exile') {
      criminal.tribe = null; criminal.exiled = true;
    }
  }

  // ------------------------------------------------------------- culture
  culture(adults) {
    const g = this.game;
    const r = rand();
    const p = rand.pick(adults);
    if (!p || !p.alive) return;
    if (r < 0.25) {
      // a story about the giant
      const kind = p.op > 40 ? 'kind' : p.op < -40 ? 'cruel' : 'strange';
      const tales = {
        kind: ['The Giant fed us when we were starving', 'The Giant watches over us from the sky', 'One day the Giant will lift us to the real world'],
        cruel: ['The Giant takes people and they never come back', 'The Giant crushed a man with one finger', 'The sky is the Giant\'s face and it hates us'],
        strange: ['Nobody knows what the Giant wants', 'Some say the Giant was tiny once', 'The light in the sky turns off when the Giant sleeps'],
      };
      const t = rand.pick(tales[kind]);
      if (!this.legends.includes(t)) { this.legends.push(t); if (this.legends.length > 12) this.legends.shift(); }
      p.say(t, { kind: 'think' });
    } else if (r < 0.45) {
      // graffiti on the glass
      const near = Math.min(p.pos.x - CAGE.x0, CAGE.x1 - p.pos.x, p.pos.z - CAGE.z0, CAGE.z1 - p.pos.z) < 0.15;
      if (near || p.has('rebel') || p.job === 'artist') g.ai.giveTask(p, { type: 'graffiti' });
    } else if (r < 0.6) {
      // name a place
      if (this.places.length < 10) {
        const c = g.cage;
        const spot = rand.pick(c.nat.filter((o) => o.type === 'rock' || o.type === 'tree' || o.type === 'pine'));
        const water = c.isWater(p.pos.x + 0.02, p.pos.z);
        const names = water ? ['Death Pond', 'Blue Pond', 'The Drinking Hole', 'Mirror Lake'] : spot ? (spot.type === 'rock' ? ['Giant\'s Rock', 'Skull Rock', 'Lookout Rock', 'Old Stone'] : ['Hanging Tree', 'The Big Oak', 'Lovers Tree', 'Old Tree']) : ['The Edge', 'Glass Wall', 'The Bottom'];
        const name = rand.pick(names);
        if (!this.places.some((q) => q.name === name)) { this.places.push({ name, x: spot ? spot.x : p.pos.x, z: spot ? spot.z : p.pos.z }); g.feed(`${p.name} named a place "${name}"`, 'warm', p); }
      }
    } else if (r < 0.8 && g.world.daylight < 0.25) {
      // party at the fire at night
      const fire = this.find('campfire', { done: true, near: p.pos });
      if (fire) { for (const q of adults) if (q.alive && !q.asleep && q.needs.fun < 70 && rand() < 0.6) g.ai.giveTask(q, { type: 'party', target: fire }); g.feed('Party at the campfire!', 'warm', fire); }
    }
  }

  // graffiti text depends on how they feel about you
  graffitiText(p) {
    const g = this.game;
    const dead = g.people.filter((q) => !q.alive && q.inCage);
    if (p.op < -70 && (p.has('cruel') || p.has('hothead'))) return rand.pick(['DIE GIANT', 'WE WILL GET YOU', 'MONSTER']);
    if (p.op < -30) return rand.pick(['LET US OUT', 'HELP', 'FREE US', 'WHY']);
    if (p.op > 50) return rand.pick(['WE LOVE YOU', 'THANK YOU GIANT', 'BLESS THE GIANT']);
    if (dead.length && rand() < 0.4) return `RIP ${rand.pick(dead).name.toUpperCase()}`;
    const t = this.tribes.find((x) => x.id === p.tribe);
    if (t && rand() < 0.4) return t.name.toUpperCase();
    return `${p.name.toUpperCase()} WAS HERE`;
  }

  // ------------------------------------------------------------- births + deaths
  tryBirths() {
    const g = this.game;
    for (const p of g.people) {
      if (!p.alive || p.kid || p.sex !== 'f' || !p.partner || p.pregnant || !p.inCage) continue;
      const q = g.byId(p.partner);
      if (!q || !q.alive || q.kid || q.sex === p.sex) continue;
      if (p.relOf(q).l < 70 || q.relOf(p).l < 60) continue;
      if (p.needs.hunger < 35 || this.sheltersFree(p.tribe) < 1) continue;
      if (rand() < 0.25) { p.pregnant = g.world.day + 1.5 + rand(); p.babyDad = q.id; }
    }
    for (const p of g.people) {
      if (!p.pregnant || !p.alive) continue;
      if (g.world.day + g.world.time / 24 >= p.pregnant) { p.pregnant = null; this.birth(p, g.byId(p.babyDad)); }
    }
  }

  birth(mom, dad) {
    const g = this.game;
    const sex = rand() < 0.5 ? 'm' : 'f';
    const skin = new THREE.Color(mom.look.skin).lerp(new THREE.Color(dad ? dad.look.skin : mom.look.skin), 0.5).getHex();
    const baby = g.spawnPerson({ age: 'baby', sex, scale: mom.scale, pos: mom.pos.clone().add(new THREE.Vector3(mom.height * 0.4, 0, 0)), lookOpts: { skin, hairColor: rand() < 0.5 ? mom.look.hairColor : dad ? dad.look.hairColor : mom.look.hairColor }, parents: dad ? [mom.id, dad.id] : [mom.id], last: dad ? dad.last : mom.last, traits: [], op: (mom.op + (dad ? dad.op : mom.op)) / 2 });
    baby.tribe = mom.tribe;
    mom.kids.push(baby.id); if (dad) dad.kids.push(baby.id);
    for (const par of [mom, dad]) if (par) { par.relOf(baby).f = 90; baby.relOf(par).f = 90; par.remember('baby', `My baby ${baby.name} was born`, 40, baby.id); }
    g.feed(`A baby was born: ${baby.name} ${baby.last} (mom: ${mom.name}${dad ? ', dad: ' + dad.name : ''})`, 'love', baby);
    sfx('heart');
  }

  onDeath(p) {
    const g = this.game;
    for (const o of g.people) {
      if (o === p || !o.alive) continue;
      const r = o.rel.get(p.id);
      if (!r) continue;
      if (r.l > 40 || r.f > 50 || o.kids.includes(p.id) || p.kids.includes(o.id)) {
        o.grief = Math.min(1, o.grief + 0.6 + r.l / 200);
        o.remember('grief', `${p.name} died`, -50, p.id);
        if (o.partner === p.id) o.partner = null;
      }
    }
    if (this.leader === p) this.leader = null;
    for (const t of this.tribes) if (t.leader === p.id) t.leader = null;
    // name a place after a famous death
    if (p.cause === 'drowned' && !this.places.some((q) => q.name === 'Death Pond')) this.places.push({ name: 'Death Pond', x: p.pos.x, z: p.pos.z });
  }

  graveSpot() {
    const g = this.game;
    const graves = this.buildings.filter((b) => b.type === 'grave');
    const base = graves.length ? { x: graves[0].x, z: graves[0].z } : (() => { const c = this.camp() || { x: 0, z: -0.5 }; return { x: c.x + (c.x < 0 ? 0.25 : -0.25), z: c.z + 0.15 }; })();
    for (let i = 0; i < 40; i++) {
      const x = base.x + ((i % 5) - 2) * 0.035, z = base.z + Math.floor(i / 5) * 0.05;
      if (!g.cage.inside(x, z, 0.02) || g.cage.isWater(x, z)) continue;
      if (this.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 0.012)) continue;
      return { x, z };
    }
    return this.siteFor('grave');
  }

  // ------------------------------------------------------------- save/load
  save() {
    return {
      b: this.buildings.map((b) => ({ id: b.id, type: b.type, x: b.x, z: b.z, rot: b.rot, progress: b.progress, need: b.need, tribe: b.tribe, owner: b.owner, data: b.data, label: b.label })),
      stock: this.stock, tech: this.tech, points: this.points, seen: [...this.seen], money: this.money, trades: this.trades,
      tribes: this.tribes, wars: this.wars ? [...this.wars] : [], leader: this.leader ? this.leader.id : null, laws: this.laws, places: this.places, legends: this.legends,
    };
  }

  load(d) {
    for (const b of [...this.buildings]) this.remove(b);
    for (const b of d.b || []) { const nb = this.place(b.type, b.x, b.z, { id: b.id, rot: b.rot, progress: b.progress, tribe: b.tribe, owner: b.owner, data: b.data, label: b.label }); nb.need = b.need || {}; }
    Object.assign(this.stock, d.stock || {});
    this.tech = d.tech || 0; this.points = d.points || 0; this.seen = new Set(d.seen || []); this.money = d.money || 0; this.trades = d.trades || 0;
    this.tribes = d.tribes || []; this.wars = new Set(d.wars || []); this.laws = d.laws || []; this.places = d.places || []; this.legends = d.legends || [];
    this.leaderId = d.leader;
  }

  resolveRefs() { if (this.leaderId) this.leader = this.game.byId(this.leaderId) || null; }
}

export { lerp, ITEMS };
