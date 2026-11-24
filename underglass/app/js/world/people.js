// The stickmen's lives: needs, jobs, homes, love, babies, school, the bar, fights, police, getting old, dying,
// and the town slowly getting smarter (Stone Age -> Village -> Town -> Industrial -> Modern).
// Piece 1 = built-in brains (free). Piece 2 adds Claude brains (their usage) on top of this.
import { clamp, lerp, rand, randi, pick, chance, esc } from '../util.js';
import { Stick, COLORS } from '../stick.js';
import { firstName, lastName } from '../names.js';
import { BT, ERAS, ERA_TECH, JOB_NAMES, floorY, buildingTop } from './town.js';
import { audio } from '../audio.js';

const HPS = 0.05; // world hours per real second at 1x (1 hour = 20 s, 1 day = 8 min, 1 year = 24 min)
const YEAR = 72; // hours in a year (3 days)
const ADULT = 18;
let W = 36; // px per metre (set from scene)

export class Sim {
  constructor(scene, d) {
    this.S = scene; W = scene.ppm;
    this.time = d.time ?? 7.5; this.era = d.era ?? 0; this.know = d.know ?? 0; this.res = d.res || { wood: 34, stone: 26, food: 40 };
    this.nextPid = d.nextPid || 1; this.nextBid = d.nextBid || 1; this.people = new Map(); this.dead = d.dead || [];
    this.planT = 0; this.jobT = 0; this.feedT = 0; this.records = d.records || { born: 0, died: 0, built: 0 };
    for (const b of d.buildings || []) { this.S.buildings.push(b); if (b.built >= 1 && !b.gone) this.S.addBuildingCols(b); }
    for (const p of d.people || []) this.spawn(p);
    this.S.feed = d.feed || [];
    if (!d.people) this.firstPeople();
  }
  hour() { return this.time % 24; }
  day() { return Math.floor(this.time / 24) + 1; }
  year() { return Math.floor(this.time / YEAR) + 1; }
  ageOf(p) { return (this.time - p.birth) / YEAR; }
  firstPeople() { // every new universe starts with two families who know nothing yet
    const fam = [[lastName(), 2, 1], [lastName(), 2, 1]];
    let x = -6 * W;
    for (const [ln, adults, kids] of fam) {
      const ids = [];
      for (let i = 0; i < adults; i++) { const sex = i ? 'f' : 'm'; const p = this.newPerson({ sex, last: ln, age: rand(22, 34), x: x + i * 1.2 * W }); ids.push(p); }
      ids[0].partner = ids[1].pid; ids[1].partner = ids[0].pid; ids[0].rel[ids[1].pid] = 85; ids[1].rel[ids[0].pid] = 85;
      for (let k = 0; k < kids; k++) { const c = this.newPerson({ last: ln, age: rand(5, 10), x: x + 2 * W, parents: [ids[0].pid, ids[1].pid] }); ids[0].kids.push(c.pid); ids[1].kids.push(c.pid); }
      x += 12 * W;
    }
    this.event('good', 'Two families woke up in a world with nothing. They have to build everything.', 0);
  }
  // ---------- people ----------
  newPerson(o) {
    const sex = o.sex || (chance(0.5) ? 'm' : 'f');
    const p = {
      pid: this.nextPid++, name: o.name || firstName(sex), last: o.last || lastName(), sex, birth: this.time - (o.age ?? 20) * YEAR,
      color: o.color || pick(COLORS), H: rand(1.6, 1.9) * (sex === 'f' ? 0.95 : 1), traits: o.traits || { anger: rand(0, 1), kind: rand(0, 1), smart: rand(0, 1), lazy: rand(0, 1), love: rand(0, 1), brave: rand(0, 1) },
      needs: { food: rand(60, 90), water: rand(60, 90), energy: rand(60, 90), fun: rand(50, 80), social: rand(50, 80) },
      health: 100, mood: 70, anger: 0, drunk: 0, home: null, job: null, work: null, partner: null, parents: o.parents || [], kids: [], rel: {},
      plan: null, thought: '', aware: 0, skill: rand(0, 0.3), life: rand(62, 92), jail: 0, wanted: 0, preg: 0, x: o.x ?? 0,
    };
    this.spawn(p);
    return p;
  }
  spawn(p) {
    const age = this.ageOf(p);
    const s = new Stick({ scene: this.S, x: p.x ?? 0, y: this.S.terrainY(p.x ?? 0) - 40, h: this.heightFor(p, age), kid: age < 16, color: p.color, name: p.name, sex: p.sex });
    s.ground = this.S.groundAt(s.x, s.ground - 200, s); s.pose(0); s.prev = s.pts.map(q => q.slice());
    s.person = p; p.stick = s; this.people.set(p.pid, p); this.S.sticks.push(s);
    if (p.dead) { s.gone = true; }
    return s;
  }
  heightFor(p, age) { const k = 0.3 + 0.7 * Math.pow(clamp(age / 17, 0, 1), 0.85); return p.H * W * k * (age > 70 ? 0.96 : 1); }
  get(pid) { return this.people.get(pid); }
  alive() { return [...this.people.values()].filter(p => !p.dead); }
  addPerson(x, kid) { const p = this.newPerson({ age: kid ? rand(5, 12) : rand(18, 40), x }); this.event('good', `${p.name} ${p.last} just appeared out of nowhere.`, x); p.aware += 0.4; return p; }
  died(s, cause) {
    const p = s.person; if (!p || p.dead) return; p.dead = true; p.cause = cause; this.records.died++;
    const age = Math.floor(this.ageOf(p));
    const how = { explosion: 'was blown up', fire: 'burned', fall: 'fell to death', hit: 'got crushed', laser: 'got hit by laser eyes from the sky', lightning: 'was struck by lightning', 'black hole': 'got pulled into a black hole', erased: 'was erased from existence', deleted: 'was deleted', acid: 'melted in acid', shot: 'was shot', collapse: 'died when a building fell', starved: 'starved', thirst: 'died of thirst', old: 'died of old age', fight: 'was beaten to death', murder: 'was murdered', sick: 'got sick and died' }[cause] || 'died';
    this.event('bad', `${p.name} ${p.last} (${age}) ${how}.`, s.x);
    this.dead.push({ name: p.name + ' ' + p.last, age, cause, day: this.day() }); if (this.dead.length > 200) this.dead.shift();
    // family + friends feel it
    for (const q of this.alive()) {
      const close = q.partner === p.pid || q.parents.includes(p.pid) || p.parents.includes(q.pid) || (q.rel[p.pid] || 0) > 50;
      if (close) { q.mood = Math.max(0, q.mood - 45); q.needs.fun = Math.max(0, q.needs.fun - 40); q.grief = 30; q.thought = `I can't believe ${p.name} is gone.`; if (q.partner === p.pid) q.partner = null; }
    }
    if (this.S.sel === s) this.S.game.worlds.ui.card(null);
  }
  removed(s) { const p = s.person; if (p) { this.people.delete(p.pid); } }
  // ---------- feed ----------
  event(kind, text, x) {
    const f = this.S.feed; const h = this.hour(); const tt = `Day ${this.day()} ${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    f.push({ kind, text, t: tt, x }); if (f.length > 120) f.shift();
    if (this.S.game.worlds?.ui && this.S.game.worlds.inside === this.S) this.S.game.worlds.ui.feedAdd({ kind, text, t: tt });
  }
  // ---------- main tick ----------
  update(dt) {
    const dh = dt * HPS; if (dh <= 0) return; this.time += dh;
    const hour = this.hour();
    this.planT -= dh; this.jobT -= dh;
    if (this.planT <= 0) { this.planT = 1.5; this.townPlan(); }
    if (this.jobT <= 0) { this.jobT = 3; this.assignJobs(); }
    // knowledge
    const pop = this.alive().length; this.know += dh * pop * 0.07;
    if (this.era < 5 && this.know >= ERA_TECH[this.era + 1]) { this.era++; this.event('tech', `NEW AGE: the town reached the ${ERAS[this.era]}. New buildings unlocked.`, 0); audio.play('cheer', { vol: this.S.volAt(0) * 0.5 + 0.1 }); }
    if (chance(dh * 0.3)) { const old = this.S.buildings.filter(b => !b.gone && b.built >= 1 && b.era < this.era && BT[b.type].era <= this.era); if (old.length) { const b = pick(old); b.era = Math.min(this.era, b.era + 1); } }
    // farms grow
    for (const b of this.S.buildings) if (!b.gone && b.type === 'farm' && b.built >= 1) b.crop = Math.min(1, (b.crop ?? 0) + dh / 30);
    for (const p of this.alive()) this.person(p, dh, hour);
  }
  person(p, dh, hour) {
    const s = p.stick; if (!s || !s.alive) return;
    const age = this.ageOf(p); p.age = age;
    // grow up
    const nh = this.heightFor(p, age); if (Math.abs(nh - s.h) > 0.5) { s.setSize(nh); s.kid = age < 16; }
    if (age >= ADULT && p.wasKid) { p.wasKid = false; this.event('good', `${p.name} ${p.last} is all grown up now (18).`, s.x); }
    if (age < ADULT) p.wasKid = true;
    s.speedWalk = (age > 70 ? 0.6 : age < 3 ? 0.55 : 1) * 1.8;
    // needs
    const n = p.needs; const sleeping = p.plan?.type === 'sleep' && p.plan.phase === 'do';
    n.food = clamp(n.food - dh * 4.2, 0, 100); n.water = clamp(n.water - dh * 5.5, 0, 100);
    n.energy = clamp(n.energy + (sleeping ? dh * 14 : -dh * 4), 0, 100); n.fun = clamp(n.fun - dh * 2.6, 0, 100); n.social = clamp(n.social - dh * 2.4, 0, 100);
    p.drunk = Math.max(0, p.drunk - dh * 0.12); s.drunk = p.drunk;
    p.anger = Math.max(0, p.anger - dh * 0.15);
    if (p.grief > 0) p.grief -= dh;
    if (n.food <= 0) p.health -= dh * 2.2; if (n.water <= 0) p.health -= dh * 4;
    if (n.food > 30 && n.water > 30) p.health = Math.min(100, p.health + dh * 0.6);
    if (p.sick) { p.health -= dh * 1.2; if (p.plan?.type === 'hospital' && p.plan.phase === 'do') { p.health += dh * 6; if (chance(dh * 0.4)) { p.sick = false; this.event('good', `The doctors healed ${p.name}.`, s.x); } } }
    else if (chance(dh * 0.0025 * (age > 60 ? 4 : 1))) { p.sick = true; p.thought = 'I feel really sick.'; }
    if (age > p.life && chance(dh * 0.02)) { s.die('old'); return; }
    if (p.health <= 0) { s.die(n.water <= 0 ? 'thirst' : n.food <= 0 ? 'starved' : 'sick'); return; }
    p.mood = clamp(lerp(p.mood, (n.food + n.water + n.energy + n.fun + n.social) / 5 + (p.partner ? 8 : -4) - (p.grief > 0 ? 30 : 0) - (p.sick ? 20 : 0), dh * 0.3), 0, 100);
    // pregnancy
    if (p.preg > 0) { p.preg -= dh; if (p.preg <= 0) this.birth(p); }
    // fire on them
    if (s.onFire > 0) { s.onFire += dh * 10; s.burnLook = Math.min(1, s.onFire / 4); this.S.fx.fire(s.center()[0], s.center()[1], s.h / 90, 1); if (s.mode === 'stand') { s.act = 'panic'; if (!p.panicT) { p.panicT = 1; s.target = clamp(s.x + rand(-15, 15) * W, -200 * W, 200 * W); } } if (s.onFire > 4) { s.die('fire'); return; } if (this.S.inLake(s.x)) { s.onFire = 0; s.burnLook = 0.3; } return; }
    if (s.mode !== 'stand') { if (s.mode === 'held') { p.aware = Math.min(1, p.aware + dh * 3); if (!p.heldOnce) { p.heldOnce = true; p.thought = 'Something reached down from the sky and grabbed me.'; this.event('news', `${p.name} says a giant hand came out of the sky and picked them up.`, s.x); } } p.plan = null; return; }
    if (p.jail > 0) { p.jail -= dh; const j = this.byId(p.jailAt); if (!j || j.gone) { p.jail = 0; } else { if (Math.abs(s.x - (j.x + j.w * W * 0.8)) > W) { s.target = j.x + j.w * W * 0.8; s.act = 'walk'; } else { s.target = null; s.act = 'sit'; s.seatH = s.legLen * 0.5; } if (p.jail <= 0) this.event('news', `${p.name} got out of jail.`, s.x); return; } }
    // run current plan
    if (p.plan) { if (this.runPlan(p, dh, hour) === false) p.plan = null; if (p.plan) return; }
    p.plan = this.choose(p, hour, age);
    if (p.plan) p.plan.phase = 'go';
  }
  // ---------- choosing what to do ----------
  choose(p, hour, age) {
    const n = p.needs, s = p.stick; const night = hour >= 22 || hour < 6; const home = this.byId(p.home);
    if (age < 3) { const mom = this.get(p.parents[1]) || this.get(p.parents[0]); if (mom && !mom.dead && mom.stick) return { type: 'follow', who: mom.pid, until: 1 }; }
    if (n.water < 22) return { type: 'drink', until: 0.4 };
    if (n.food < 20) return { type: 'eat', until: 0.6 };
    if (n.energy < 18 || (night && n.energy < 92)) return { type: 'sleep', b: home?.id, until: 8 };
    if (n.water < 38) return { type: 'drink', until: 0.4 };
    if (n.food < 38) return { type: 'eat', until: 0.6 };
    if (p.sick && this.find('hospital')) return { type: 'hospital', until: 4 };
    if (p.preg > 0 && p.preg < 3) return { type: 'hospital', until: 3, birth: true };
    if (age >= 14 && p.anger > 0.65) { const foe = this.enemyNear(p); if (foe) return { type: 'fight', who: foe.pid, until: 1 }; }
    if (p.job === 'police') { const crook = this.alive().find(q => q.wanted > 0 && q.stick && q.jail <= 0); if (crook) return { type: 'arrest', who: crook.pid, until: 4 }; }
    if (age >= 6 && age < 16 && hour >= 8 && hour < 15 && this.find('school')) return { type: 'school', until: 2 };
    if (p.job && age >= ADULT && hour >= 7.5 && hour < 17.5 && !(p.traits.lazy > 0.85 && chance(0.3))) return { type: 'work', until: 2 };
    if (age >= ADULT && (hour >= 18 || hour < 2) && (n.fun < 60 || p.grief > 0 || p.mood < 35) && this.find('bar')) return { type: 'bar', until: rand(1.5, 3.5) };
    if (n.social < 55 || chance(0.35)) { const f = this.friendNear(p); if (f) return { type: 'talk', who: f.pid, until: rand(0.5, 1.2) }; }
    if (age >= 3 && age < 14 && chance(0.6)) return { type: 'play', until: rand(0.5, 1.5) };
    if (hour >= 18 && hour < 22 && home && chance(0.25) && p.partner) return { type: 'party', b: home.id, until: rand(1, 2) };
    return { type: 'wander', until: rand(0.4, 1.2) };
  }
  // walk somewhere (x, and which floor of which building)
  go(p, x, b, floor = 0) {
    const s = p.stick; const f = b ? Math.min(floor, Math.max(0, (BT[b.type].fl || 1) - 1)) : 0;
    const wantY = b && BT[b.type].fl ? floorY(b, f, W) : null;
    // already on the right floor and close
    const onFloor = wantY === null ? (s.ground > this.S.terrainY(s.x) - 0.6 * W) : Math.abs(s.ground - wantY) < 0.6 * W;
    if (onFloor && Math.abs(s.x - x) < 0.35 * W) { s.target = null; return true; }
    if (!onFloor) {
      // stairs: inside the building, walk to the stairs, then step up/down a floor
      const inB = this.S.buildingAt(s.x);
      if (inB && BT[inB.type].fl > 1 && s.ground < inB.y + 2) {
        const sx = inB.x + inB.w * W - 1.1 * W; if (Math.abs(s.x - sx) > 0.3 * W) { s.target = sx; s.act = p.drunk > 0.5 ? 'walk' : 'walk'; return false; }
        const cur = Math.round((inB.y - s.ground) / (BT[inB.type].fh * W)); const want = inB === b ? f : 0; const nf = cur + Math.sign(want - cur);
        if (nf !== cur) { s.ground = floorY(inB, nf, W); s.pose(0); s.prev = s.pts.map(q => q.slice()); return false; }
      }
      // go to the building first (enter on the ground floor)
      if (b) { const door = b.x + b.w * W * 0.5; if (s.ground < this.S.terrainY(s.x) - 0.6 * W && !(inB === b)) { /* on another building's floor: go down first */ } s.target = Math.abs(s.x - door) > 0.5 * W && !(inB === b) ? door : b.x + b.w * W - 1.1 * W; return false; }
    }
    s.target = x; if (s.act !== 'run' && s.act !== 'panic') s.act = 'walk'; return false;
  }
  runPlan(p, dh, hour) {
    const P = p.plan, s = p.stick, n = p.needs; P.t = (P.t || 0) + dh;
    if (P.t > 10) return false; // stuck: pick something else
    const done = () => { P.left = (P.left ?? P.until) - dh; return P.left <= 0; };
    switch (P.type) {
      case 'sleep': {
        const b = this.byId(P.b) || this.byId(p.home);
        if (b && b.built >= 1 && !b.gone) {
          const T = BT[b.type]; const beds = (T.furn || []).filter(f => f[0] === 'bed'); const i = (p.pid % Math.max(1, beds.length)); const bed = beds[i] || ['bed', 0.4, 0];
          const x = b.x + b.w * W * bed[1]; if (P.phase === 'go') { if (!this.go(p, x, b, bed[2])) return; P.phase = 'do'; }
          s.act = 'sleep'; s.bedH = 0.45 * W; s.target = null;
        } else { if (P.phase === 'go') { P.phase = 'do'; } s.act = 'sleep'; s.bedH = 0; s.target = null; }
        if (P.phase === 'do' && chance(dh * 0.5)) this.S.fx.add({ t: 'zz', x: s.pts[0][0], y: s.pts[0][1] - 10, vx: 6, vy: -10, life: 1.6, age: 0, r: 1 });
        if (n.energy >= 99 && (hour >= 6 && hour < 21)) { s.act = 'idle'; s.bedH = 0; return false; }
        if (n.food < 15 || n.water < 18) { s.act = 'idle'; s.bedH = 0; return false; }
        return;
      }
      case 'drink': {
        const well = this.nearest(s.x, 'well'); const bar = (p.drunk < 0.2 && hour > 18 && this.find('bar')) ? null : null;
        let x = well ? well.x + well.w * W * 0.5 : this.lakeShore(s.x);
        if (this.era >= 3 && this.byId(p.home)?.built >= 1) x = this.byId(p.home).x + this.byId(p.home).w * W * 0.5; // taps at home
        if (P.phase === 'go') { if (!this.go(p, x, this.era >= 3 ? this.byId(p.home) : null)) return; P.phase = 'do'; }
        s.act = 'drink'; n.water = Math.min(100, n.water + dh * 220); if (chance(dh * 2)) audio.play('swallow', { vol: this.S.volAt(s.x) * 0.25, gap: 0.3 });
        if (done()) { s.act = 'idle'; return false; } return;
      }
      case 'eat': {
        const home = this.byId(p.home); const market = this.nearest(s.x, 'market'); const farm = this.nearest(s.x, 'farm');
        const place = (home && home.built >= 1 && this.res.food > 0) ? home : market && this.res.food > 0 ? market : farm;
        if (!place) { if (P.phase === 'go') P.phase = 'forage'; }
        if (P.phase === 'forage') { // no food anywhere: look for berries in the woods
          const t = this.nearestTree(s.x); if (!t) return false; if (!this.go(p, t.x + W, null)) return; s.act = 'eat'; n.food = Math.min(100, n.food + dh * 60); if (done()) return false; return;
        }
        const x = place.x + place.w * W * (place.type === 'farm' ? 0.5 : 0.7);
        if (P.phase === 'go') { if (!this.go(p, x, place.type === 'farm' ? null : place, 0)) return; P.phase = 'do'; if (this.res.food > 0) this.res.food = Math.max(0, this.res.food - 1); else P.hungry = true; }
        s.act = 'eat'; s.target = null; if (!P.hungry) n.food = Math.min(100, n.food + dh * 170); else n.food = Math.min(100, n.food + dh * 20);
        if (chance(dh * 2)) audio.play('eat', { vol: this.S.volAt(s.x) * 0.25, gap: 0.3 });
        if (done()) { s.act = 'idle'; return false; } return;
      }
      case 'work': return this.work(p, dh, hour, done);
      case 'school': {
        const sc = this.find('school'); if (!sc) return false; const seat = 0.35 + (p.pid % 4) * 0.17; const x = sc.x + sc.w * W * seat;
        if (P.phase === 'go') { if (!this.go(p, x, sc)) return; P.phase = 'do'; }
        s.act = 'sit'; s.seatH = s.legLen * 0.62; s.dir = -1; p.skill = Math.min(1, p.skill + dh * 0.01); this.know += dh * 0.08; n.fun -= dh;
        if (done() || hour >= 15) { s.act = 'idle'; return false; } return;
      }
      case 'bar': {
        const bar = this.find('bar'); if (!bar) return false; const stool = [0.35, 0.47, 0.59, 0.75, 0.85][p.pid % 5]; const x = bar.x + bar.w * W * stool;
        if (P.phase === 'go') { if (!this.go(p, x, bar)) return; P.phase = 'do'; if (p.grief > 0 || p.mood < 30) p.thought = 'I just need a drink.'; }
        if (stool < 0.7) { s.act = chance(0.002) ? 'drink' : 'sit'; s.seatH = s.legLen * 0.75; s.dir = -1; } else { s.act = 'dance'; }
        p.drunk = Math.min(1.3, p.drunk + dh * 0.28 * (p.grief > 0 ? 1.6 : 1)); n.fun = Math.min(100, n.fun + dh * 18); n.social = Math.min(100, n.social + dh * 10); n.water = Math.min(100, n.water + dh * 10);
        if (p.drunk > 0.8 && p.traits.anger > 0.55 && chance(dh * 0.25)) { p.anger = 0.8; const foe = this.someoneNear(p, 6 * W); if (foe) { p.rel[foe.pid] = (p.rel[foe.pid] || 0) - 40; this.event('bad', `${p.name} got drunk and started a fight with ${foe.name} at the bar.`, s.x); return false; } }
        if (done()) { s.act = 'idle'; if (p.drunk > 0.6) this.event('news', `${p.name} stumbled home drunk.`, s.x); return false; } return;
      }
      case 'talk': {
        const q = this.get(P.who); if (!q || q.dead || !q.stick || q.stick.mode !== 'stand' || q.jail > 0) return false;
        const qs = q.stick; const side = s.x < qs.x ? -1 : 1; const x = qs.x + side * 0.9 * W;
        if (P.phase === 'go') { if (Math.abs(s.x - x) > 0.4 * W) { s.target = x; s.act = 'walk'; if (Math.abs(s.ground - qs.ground) > W) return false; return; } P.phase = 'do'; if (!q.plan || q.plan.type === 'wander' || q.plan.type === 'play') q.plan = { type: 'listen', who: p.pid, until: P.until, phase: 'do' }; }
        s.target = null; s.dir = qs.x > s.x ? 1 : -1; s.act = 'talk';
        if (chance(dh * 3)) this.chat(p, q);
        n.social = Math.min(100, n.social + dh * 40);
        if (done()) { s.act = 'idle'; return false; } return;
      }
      case 'listen': { const q = this.get(P.who); if (!q || q.dead || !q.stick) return false; s.target = null; s.dir = q.stick.x > s.x ? 1 : -1; s.act = 'talk'; n.social = Math.min(100, n.social + dh * 30); if (done()) { s.act = 'idle'; return false; } return; }
      case 'fight': {
        const q = this.get(P.who); if (!q || q.dead || !q.stick || !q.stick.alive) { p.anger = 0; return false; }
        const qs = q.stick; if (Math.abs(qs.x - s.x) > 1.0 * W) { s.target = qs.x - Math.sign(qs.x - s.x) * 0.8 * W; s.act = 'run'; if (P.t > 3) { p.anger *= 0.5; return false; } return; }
        s.target = null; s.dir = Math.sign(qs.x - s.x) || 1; s.act = 'punch';
        if (s.punchT <= 0) {
          s.punchT = 0.5; audio.play('punch', { vol: this.S.volAt(s.x) * 0.6, gap: 0.1 });
          if (qs.mode === 'stand') qs.knock(s.dir * 160, -60); qs.hurt(0.07 + p.traits.anger * 0.06 + (s.h / qs.h - 1) * 0.1, P.kill ? 'murder' : 'fight');
          q.rel[p.pid] = (q.rel[p.pid] || 0) - 15; q.anger = Math.min(1, q.anger + 0.25); q.thought = `${p.name} is attacking me!`;
          if (!P.told) { P.told = true; this.event('bad', `${p.name} is fighting ${q.name}!`, s.x); this.crowd(s.x); }
          if (!qs.alive) { p.wanted = P.kill || chance(0.5) ? 2 : 1; this.event('bad', `${p.name} ${p.last} killed ${q.name} ${q.last}. Police are looking for ${p.sex === 'f' ? 'her' : 'him'}.`, s.x); p.anger = 0; return false; }
          if (chance(0.3)) { p.wanted = Math.max(p.wanted, 0.5); }
        }
        p.anger -= dh * 0.4; if (p.anger < 0.25 || done()) { s.act = 'idle'; return false; } return;
      }
      case 'arrest': {
        const q = this.get(P.who); const jail = this.find('police'); if (!q || q.dead || !q.stick || !jail || q.jail > 0) return false;
        const qs = q.stick; if (Math.abs(qs.x - s.x) > 0.9 * W) { s.target = qs.x; s.act = 'run'; return; }
        q.jail = 24 * (q.wanted >= 2 ? 3 : 1); q.jailAt = jail.id; q.wanted = 0; q.plan = null; q.anger = 0;
        this.event('news', `Officer ${p.name} arrested ${q.name} ${q.last}.`, s.x); audio.play('siren', { vol: this.S.volAt(s.x) * 0.4, dur: 3 }); return false;
      }
      case 'hospital': {
        const h = this.find('hospital'); if (!h) { if (P.birth) return false; return false; } const x = h.x + h.w * W * [0.25, 0.6][p.pid % 2];
        if (P.phase === 'go') { if (!this.go(p, x, h, 0)) return; P.phase = 'do'; }
        s.act = 'sleep'; s.bedH = 0.45 * W; p.health = Math.min(100, p.health + dh * 8);
        if (done() && !p.sick && !(p.preg > 0)) { s.act = 'idle'; s.bedH = 0; return false; } if (P.t > 9) { s.act = 'idle'; s.bedH = 0; return false; } return;
      }
      case 'follow': { const m = this.get(P.who); if (!m || m.dead || !m.stick) return false; const ms = m.stick; if (ms.act === 'sleep') { s.act = 'sleep'; s.target = null; s.bedH = ms.bedH; s.ground = ms.ground; s.x = ms.x + 0.5 * W; } else { if (Math.abs(ms.x - s.x) > 1.2 * W) { s.target = ms.x + 0.6 * W * (p.pid % 2 ? 1 : -1); s.act = 'walk'; } else if (Math.abs(s.ground - ms.ground) > 0.5 * W) { s.ground = ms.ground; s.x = ms.x + 0.5 * W; } } if (done()) return false; return; }
      case 'play': { if (P.phase === 'go' || P.phase === 'do' && s.target === null) { P.x = clamp(s.x + rand(-6, 6) * W, -150 * W, 150 * W); if (this.S.inLake(P.x)) P.x = s.x; P.phase = 'run'; } if (P.phase === 'run') { if (this.go(p, P.x, null)) P.phase = 'do'; else s.act = 'run'; } else s.act = chance(0.02) ? 'cheer' : s.act; n.fun = Math.min(100, n.fun + dh * 30); if (done()) { s.act = 'idle'; return false; } return; }
      case 'party': { const b = this.byId(P.b); if (!b || b.gone) return false; const x = b.x + b.w * W * rand(0.3, 0.7); if (P.phase === 'go') { if (!this.go(p, x, b, 0)) return; P.phase = 'do'; } s.act = 'dance'; n.fun = Math.min(100, n.fun + dh * 30); if (done()) { s.act = 'idle'; return false; } return; }
      case 'wander': {
        if (P.phase === 'go') { const home = this.byId(p.home); const base = home ? home.x + home.w * W / 2 : s.x; let x = clamp(base + rand(-12, 12) * W, -180 * W, 180 * W); if (this.S.inLake(x)) x = base; P.x = x; P.phase = chance(0.3) ? 'idle' : 'walk'; if (P.phase === 'idle') { s.act = 'idle'; s.target = null; s.headTilt = rand(-0.3, 0.3); } }
        if (P.phase === 'walk' && this.go(p, P.x, null)) P.phase = 'idle';
        if (P.phase === 'idle' && done()) return false; if (P.t > 3) return false; return;
      }
    }
    return false;
  }
  // ---------- work ----------
  work(p, dh, hour, done) {
    const P = p.plan, s = p.stick, j = p.job;
    if (hour >= 17.5) { s.act = 'idle'; return false; }
    if (j === 'builder') {
      const site = this.S.buildings.find(b => !b.gone && b.built < 1 && this.canAfford(b, true));
      if (!site) { s.act = 'idle'; return done() ? false : undefined; }
      const x = site.x + site.w * W * (0.2 + (p.pid % 3) * 0.3);
      if (P.phase === 'go' || P.site !== site.id) { P.site = site.id; P.phase = 'go'; if (!this.go(p, x, null)) return; P.phase = 'do'; }
      s.act = 'punch'; s.dir = site.x + site.w * W / 2 > s.x ? 1 : -1; if (s.punchT <= 0) { s.punchT = 0.6; audio.play('impact_wood', { vol: this.S.volAt(s.x) * 0.3, rate: rand(1.2, 1.5), gap: 0.15 }); }
      if (!site.paid) { if (this.canAfford(site)) { this.pay(site); site.paid = true; } else { s.act = 'idle'; return false; } }
      site.built = Math.min(1, site.built + dh / BT[site.type].time * (1 + p.skill));
      p.skill = Math.min(1, p.skill + dh * 0.003);
      if (site.built >= 1) this.finished(site);
      return done() ? false : undefined;
    }
    if (j === 'gatherer') {
      const t = P.tree !== undefined ? this.S.trees[P.tree] : null;
      if (!t || t.down || P.phase === 'go' && !P.tree) { const nt = this.nearestTree(s.x, true); if (!nt) return false; P.tree = this.S.trees.indexOf(nt); P.phase = 'go'; return; }
      if (P.phase === 'go') { if (!this.go(p, t.x - W * 0.8, null)) return; P.phase = 'do'; }
      s.act = 'punch'; s.dir = 1; if (s.punchT <= 0) { s.punchT = 0.7; audio.play('impact_wood', { vol: this.S.volAt(s.x) * 0.35, rate: rand(0.8, 1), gap: 0.15 }); this.S.fx.bits(t.x - W * 0.3, s.pts[6][1], 2, ['#8a6a44', '#b08a5a'], 60, 2); }
      t.hp -= dh * 0.22; if (t.hp <= 0) { this.res.wood += 14; P.tree = undefined; P.phase = 'go'; }
      return done() ? false : undefined;
    }
    if (j === 'miner') {
      const r = this.S.rocks.filter(q => q.hp > 0).sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0]; if (!r) { this.res.stone += dh * 0.4; return false; }
      if (P.phase === 'go') { if (!this.go(p, r.x + W * 1.2, null)) return; P.phase = 'do'; }
      s.act = 'punch'; s.dir = -1; if (s.punchT <= 0) { s.punchT = 0.8; audio.play('thud', { vol: this.S.volAt(s.x) * 0.35, rate: rand(1.3, 1.6), gap: 0.15 }); this.S.fx.bits(r.x, this.S.terrainY(r.x) - 10, 2, ['#888', '#aaa'], 70, 2); }
      this.res.stone += dh * 2.2; r.hp -= dh * 0.01; if (r.hp <= 0) { r.hp = 0; }
      return done() ? false : undefined;
    }
    const b = this.byId(p.work); if (!b || b.gone || b.built < 1) { p.job = null; p.work = null; return false; }
    const spot = { farmer: rand(0.1, 0.9), shopkeeper: 0.3, bartender: 0.2, teacher: 0.2, scholar: 0.7, doctor: rand(0.2, 0.8), police: 0.3, mayor: 0.5, worker: rand(0.2, 0.8), scientist: 0.35 }[j] ?? 0.5;
    const floor = j === 'scientist' ? p.pid % 2 : j === 'doctor' ? p.pid % 2 : 0;
    if (P.phase === 'go') { P.x = b.x + b.w * W * spot; if (!this.go(p, P.x, b.type === 'farm' ? null : b, floor)) return; P.phase = 'do'; }
    s.target = null;
    switch (j) {
      case 'farmer': s.act = chance(0.5) ? 'carry' : 'punch'; if (s.punchT <= 0) s.punchT = 1; if ((b.crop ?? 0) >= 1) { b.crop = 0; this.res.food += 16; } else this.res.food += dh * 0.25; if (chance(dh)) { P.phase = 'go'; } break;
      case 'teacher': s.act = 'talk'; s.dir = 1; this.know += dh * 0.4; break;
      case 'scholar': s.act = 'read'; this.know += dh * (0.9 + p.traits.smart); break;
      case 'scientist': s.act = 'read'; this.know += dh * (2.6 + p.traits.smart * 2); break;
      case 'worker': s.act = 'carry'; this.know += dh * 0.4; this.res.stone += dh * 0.6; this.res.wood += dh * 0.3; break;
      case 'doctor': s.act = 'idle'; for (const q of this.alive()) if (q.plan?.type === 'hospital') q.health = Math.min(100, q.health + dh * 6); break;
      case 'police': s.act = 'idle'; if (chance(dh * 0.6)) { P.phase = 'go'; } break;
      case 'mayor': s.act = 'talk'; break;
      default: s.act = 'idle';
    }
    p.skill = Math.min(1, p.skill + dh * 0.002);
    return done() ? false : undefined;
  }
  finished(b) {
    b.built = 1; this.records.built++; this.S.addBuildingCols(b);
    // nobody left inside the floor slab
    this.event('good', `A new ${BT[b.type].name.toLowerCase()} was finished.`, b.x);
    if (BT[b.type].cap) { const homeless = this.alive().filter(p => !this.byId(p.home)); let room = BT[b.type].cap; for (const p of homeless) { if (room <= 0) break; this.moveIn(p, b); room--; } }
  }
  moveIn(p, b) { const fam = [p]; if (p.partner) { const q = this.get(p.partner); if (q && !q.dead) fam.push(q); } for (const k of p.kids) { const c = this.get(k); if (c && !c.dead && this.ageOf(c) < ADULT) fam.push(c); } for (const q of fam) q.home = b.id; }
  // ---------- talking, love, babies ----------
  chat(p, q) {
    const T1 = p.traits, T2 = q.traits; const comp = 1 - (Math.abs(T1.anger - T2.anger) + Math.abs(T1.kind - T2.kind) + Math.abs(T1.smart - T2.smart)) / 3;
    let d = (comp - 0.45) * 14 + rand(-4, 6) + (p.drunk > 0.7 ? rand(-10, 4) : 0); if (T1.anger > 0.8 && chance(0.15)) d -= 14;
    p.rel[q.pid] = clamp((p.rel[q.pid] || 0) + d, -100, 100); q.rel[p.pid] = clamp((q.rel[p.pid] || 0) + d * rand(0.6, 1.1), -100, 100);
    const a = p.rel[q.pid], b = q.rel[p.pid]; const ap = this.ageOf(p), aq = this.ageOf(q);
    // gossip: the "this world is fake" idea spreads a little
    if (p.aware > 0.5 && chance(0.25)) { q.aware = Math.min(1, q.aware + (q.traits.smart > 0.6 ? 0.15 : 0.05)); if (q.aware > 0.5 && !q.believer) { q.believer = true; this.event('news', `${q.name} now believes ${p.name}: "this world is not real."`, q.stick?.x); } }
    if (a < -55 && T1.anger > 0.6) { p.anger = Math.min(1, p.anger + 0.4); p.thought = `I really can't stand ${q.name}.`; }
    if (!p.partner && !q.partner && ap >= ADULT && aq >= ADULT && p.sex !== q.sex && a > 60 && b > 60 && Math.abs(ap - aq) < 15 && !p.parents.includes(q.pid) && !q.parents.includes(p.pid) && !this.sibling(p, q) && chance(0.35 + T1.love * 0.3)) {
      p.partner = q.pid; q.partner = p.pid; p.since = this.time; q.since = this.time; p.rel[q.pid] = 85; q.rel[p.pid] = 85;
      this.event('love', `${p.name} and ${q.name} are together now.`, p.stick.x); p.thought = `I love ${q.name}.`; q.thought = `I love ${p.name}.`;
      const home = this.byId(p.home) || this.byId(q.home); if (home) { p.home = home.id; q.home = home.id; }
    }
    if (p.partner === q.pid && a < 15 && chance(0.4)) { p.partner = null; q.partner = null; p.mood -= 30; q.mood -= 35; q.grief = 12; p.thought = `It's over with ${q.name}.`; q.thought = `${p.name} broke up with me. I need a drink.`; this.event('love', `${p.name} broke up with ${q.name}.`, p.stick.x); }
    if (p.partner === q.pid && p.sex !== q.sex) { const mom = p.sex === 'f' ? p : q; const mAge = this.ageOf(mom); const kids = mom.kids.filter(k => this.get(k) && !this.get(k).dead).length; const home = this.byId(mom.home); if (mAge < 42 && !mom.preg && kids < 4 && home && home.built >= 1 && this.time - (mom.lastBaby || -999) > 60 && chance(0.06)) { mom.preg = 54; mom.babyDad = (mom === p ? q : p).pid; mom.thought = 'We are having a baby!'; this.event('love', `${mom.name} is pregnant.`, mom.stick.x); } }
    if (!p.thought || chance(0.3)) p.thought = this.thinkLine(p);
  }
  birth(mom) {
    mom.preg = 0; mom.lastBaby = this.time; const dad = this.get(mom.babyDad);
    const ms = mom.stick; if (!ms || !ms.alive) return;
    const sex = chance(0.5) ? 'm' : 'f'; const namer = dad && !dad.dead && chance(0.5) ? dad : mom;
    const c = this.newPerson({ sex, last: dad ? dad.last : mom.last, age: 0.02, x: ms.x + 0.6 * W, parents: [dad ? dad.pid : 0, mom.pid], color: chance(0.5) ? mom.color : (dad ? dad.color : pick(COLORS)) });
    c.home = mom.home; mom.kids.push(c.pid); if (dad) dad.kids.push(c.pid); this.records.born++;
    c.stick.ground = ms.ground; c.stick.x = ms.x + 0.6 * W;
    this.event('love', `A baby was born. ${namer.name} named ${sex === 'm' ? 'him' : 'her'} ${c.name}.`, ms.x);
    audio.play('baby', { vol: this.S.volAt(ms.x) * 0.5 });
    mom.thought = `${c.name} is perfect.`;
  }
  sibling(p, q) { return p.parents.some(x => x && q.parents.includes(x)); }
  thinkLine(p) {
    const n = p.needs; const s = p.stick; const age = this.ageOf(p);
    if (p.aware > 0.75) return pick(['Why does the sky feel like glass?', 'We are inside something. I know it.', 'Something is watching us from above.', 'This world is not real. I have to find a way out.', 'There is an edge to the world. I saw it.']);
    if (p.grief > 0) return 'I miss them so much.';
    if (n.food < 25) return "I'm starving."; if (n.water < 25) return "I'm so thirsty.";
    if (p.sick) return 'I feel sick.'; if (n.energy < 25) return "I'm exhausted.";
    if (p.drunk > 0.7) return pick(["I'm fine. I'm totally fine.", 'Everything is spinning.', 'I love everybody.']);
    if (p.preg > 0) return 'The baby is coming soon.';
    if (p.partner) { const q = this.get(p.partner); if (q) return pick([`I love ${q.name}.`, `I hope ${q.name} is okay.`, `Going home to ${q.name} later.`]); }
    if (age < 12) return pick(['I want to play!', 'School is boring.', 'When I grow up I want to build stuff.']);
    if (p.job) return pick([`Work as a ${JOB_NAMES[p.job].toLowerCase()} again.`, 'One more day.', 'We are getting better at this.']);
    if (p.mood < 35) return pick(['What is even the point of all this?', 'Nobody needs me.', 'I feel empty.']);
    return pick(['Nice day.', 'I wonder what is past the mountains.', 'I should talk to someone.', 'Life is good.']);
  }
  crowd(x) { for (const q of this.alive()) { const s = q.stick; if (!s || s.mode !== 'stand' || Math.abs(s.x - x) > 10 * W || q.plan?.type === 'fight') continue; if (q.traits.brave > 0.6 && chance(0.6)) { s.act = 'cheer'; q.plan = { type: 'wander', until: 0.4, phase: 'do', t: 0 }; s.target = null; } else { q.plan = { type: 'wander', until: 0.4, phase: 'do', t: 0 }; s.target = s.x + Math.sign(s.x - x || 1) * 8 * W; s.act = 'run'; } } }
  // ---------- finding things ----------
  byId(id) { return id ? this.S.buildings.find(b => b.id === id && !b.gone) : null; }
  find(type) { return this.S.buildings.find(b => b.type === type && !b.gone && b.built >= 1); }
  nearest(x, type) { let best = null, bd = 1e9; for (const b of this.S.buildings) if (b.type === type && !b.gone && b.built >= 1) { const d = Math.abs(b.x - x); if (d < bd) { bd = d; best = b; } } return best; }
  nearestTree(x, big) { let best = null, bd = 1e9; for (const t of this.S.trees) { if (t.down || t.burn > 0 || (big && (t.grow ?? 1) < 0.9) || t.k === 'shrub2') continue; const d = Math.abs(t.x - x); if (d < bd && Math.abs(t.x) > 20 * W) { bd = d; best = t; } } return best; }
  lakeShore(x) { return this.S.lake.x0 + 2 * W; }
  friendNear(p) { const s = p.stick; let best = null, bv = -1e9; for (const q of this.alive()) { if (q === p || !q.stick || q.stick.mode !== 'stand' || q.jail > 0 || this.ageOf(q) < 3) continue; const d = Math.abs(q.stick.x - s.x); if (d > 25 * W) continue; const v = (p.rel[q.pid] || 0) + rand(0, 40) - d / W; if (v > bv) { bv = v; best = q; } } return best; }
  enemyNear(p) { const s = p.stick; for (const q of this.alive()) { if (q === p || !q.stick || q.stick.mode !== 'stand' || q.jail > 0) continue; if ((p.rel[q.pid] || 0) < -40 && Math.abs(q.stick.x - s.x) < 20 * W) return q; } return null; }
  someoneNear(p, r) { const s = p.stick; return this.alive().find(q => q !== p && q.stick && Math.abs(q.stick.x - s.x) < r && q.stick.mode === 'stand'); }
  // ---------- the town plans what to build ----------
  canAfford(b, any) { const c = BT[b.type].cost; if (any && b.paid) return true; return Object.entries(c).every(([k, v]) => (this.res[k] || 0) >= v); }
  pay(b) { for (const [k, v] of Object.entries(BT[b.type].cost)) this.res[k] -= v; }
  townPlan() {
    const ppl = this.alive(); const pop = ppl.length; if (!pop) return;
    const B = this.S.buildings.filter(b => !b.gone); const building = B.filter(b => b.built < 1);
    if (building.length >= 2) return;
    const count = (t) => B.filter(b => b.type === t).length;
    const homeless = ppl.filter(p => !this.byId(p.home)).length;
    const cap = B.filter(b => BT[b.type].cap).reduce((a, b) => a + BT[b.type].cap, 0);
    const want = [];
    if (count('farm') < Math.ceil(pop / 6) && count('farm') < 6) want.push('farm');
    if (this.era <= 2 && count('well') < Math.ceil(pop / 14) && count('well') < 4) want.push('well');
    if (homeless > 0 || cap < pop + 2) want.push(this.era >= 3 ? 'apartment' : this.era >= 1 ? 'house' : 'hut');
    for (const [t, T] of Object.entries(BT)) if (T.era <= this.era && !T.cap && !T.field && !T.well && !count(t) && t !== 'farm') want.push(t);
    for (const t of want) {
      if (building.some(b => b.type === t)) continue;
      const T = BT[t]; const x = this.findSpot(T.w); if (x === null) continue;
      const g = this.S.flatten(x, x + T.w * W);
      const b = { id: this.nextBid++, type: t, x, w: T.w, y: g, era: this.era, built: 0, hp: 1, burn: 0, char: 0 };
      this.S.buildings.push(b); this.event('good', `They started building a ${T.name.toLowerCase()}.`, x);
      return;
    }
  }
  findSpot(wm) {
    const B = this.S.buildings.filter(b => !b.gone); const w = wm * W;
    for (let k = 0; k < 60; k++) {
      const side = k % 2 ? -1 : 1; const x = side > 0 ? k * 3.5 * W : -k * 3.5 * W - w;
      if (Math.abs(x) > 105 * W) continue; if (this.S.inLake(x) || this.S.inLake(x + w) || (x < this.S.lake.x1 + 4 * W && x + w > this.S.lake.x0 - 4 * W)) continue;
      if (B.some(b => x < b.x + b.w * W + 1.5 * W && x + w > b.x - 1.5 * W)) continue;
      const h0 = this.S.terrainY(x), h1 = this.S.terrainY(x + w); if (Math.abs(h0 - h1) > 2.5 * W) continue;
      // trees in the way get cut
      for (const t of this.S.trees) if (t.x > x - W && t.x < x + w + W && !t.down) { t.hp = 0; this.res.wood += 4; }
      return x;
    }
    return null;
  }
  assignJobs() {
    const ppl = this.alive().filter(p => this.ageOf(p) >= ADULT && this.ageOf(p) < 68 && p.jail <= 0);
    const need = [];
    const sites = this.S.buildings.filter(b => !b.gone && b.built < 1).length;
    need.push(['builder', null, sites ? Math.min(3, Math.max(1, Math.ceil(ppl.length / 5))) : 0]);
    need.push(['gatherer', null, this.res.wood < 150 ? Math.max(1, Math.ceil(ppl.length / 8)) : 0]);
    need.push(['miner', null, this.res.stone < 150 && (this.era >= 1 || this.res.stone < 20) ? Math.max(1, Math.ceil(ppl.length / 10)) : 0]);
    for (const b of this.S.buildings) if (!b.gone && b.built >= 1 && BT[b.type].jobs) for (const [j, n] of Object.entries(BT[b.type].jobs)) need.push([j, b.id, n]);
    const have = new Map(); for (const p of ppl) if (p.job) { const k = p.job + (p.work || ''); have.set(k, (have.get(k) || 0) + 1); }
    // people whose job no longer exists lose it
    for (const p of ppl) if (p.job && !need.some(([j, b, n]) => j === p.job && (b || '') === (p.work || '') && n > 0)) { p.job = null; p.work = null; }
    for (const [j, b, n] of need) {
      let cur = ppl.filter(p => p.job === j && (p.work || null) === b).length;
      while (cur < n) {
        const free = ppl.filter(p => !p.job).sort((a, c) => (j === 'scholar' || j === 'scientist' || j === 'teacher' || j === 'doctor' ? c.traits.smart - a.traits.smart : j === 'police' ? c.traits.brave - a.traits.brave : 0))[0];
        if (!free) break; free.job = j; free.work = b; cur++;
        if (j === 'mayor') this.event('news', `${free.name} ${free.last} is the new mayor.`, free.stick?.x);
      }
    }
    // the homeless try to move into free space
    for (const p of this.alive()) if (!this.byId(p.home)) { const h = this.S.buildings.find(b => !b.gone && b.built >= 1 && BT[b.type].cap && this.alive().filter(q => q.home === b.id).length < BT[b.type].cap); if (h) this.moveIn(p, h); }
  }
  buildingLost(b) {
    this.event('bad', `The ${BT[b.type].name.toLowerCase()} was destroyed.`, b.x);
    for (const p of this.alive()) { if (p.home === b.id) { p.home = null; p.mood -= 20; } if (p.work === b.id) { p.job = null; p.work = null; } if (p.plan?.b === b.id) p.plan = null; }
    // rebuild later: leave a free spot (the planner will build again)
  }
  toJSON() {
    const people = this.alive().map(p => { const { stick, plan, ...rest } = p; return { ...rest, x: stick ? stick.x : p.x }; });
    return { time: this.time, era: this.era, know: this.know, res: this.res, nextPid: this.nextPid, nextBid: this.nextBid, people, buildings: this.S.buildings.filter(b => !b.gone).map(({ cols, ...b }) => b), feed: this.S.feed.slice(-60), dead: this.dead.slice(-100), records: this.records };
  }
}
export { HPS, YEAR };
