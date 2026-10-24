// Bugs + small animals: real sizes, real speeds, real masses. They wander, fly, perch, climb, flee from you when you
// are a threat, hunt you when you are small enough to be food, get webbed, paralyzed by venom, wrapped and eaten.
import * as THREE from 'three';
import { MODELS } from './bugmodels.js';
import { SPECIES } from '../spider/species.js';
import { buildSpider } from '../spider/body.js';
import { SpiderRig } from '../spider/rig.js';
import { clamp, rand, pick } from '../core/util.js';

// L = body length (m), mass (kg), speed (m/s), hp, move: fly | walk | crawl | spider
// predator: hunts spiders up to `huntRatio` x its own length; bite = damage per bite
export const KINDS = {
  fruitfly:   { name: 'Fruit fly', latin: 'Drosophila melanogaster', L: 0.0026, mass: 2e-7, speed: 0.35, hp: 0.5, move: 'fly', perch: 0.5, fact: 'Lays its eggs on rotting fruit. Lives about 40 days.' },
  housefly:   { name: 'House fly', latin: 'Musca domestica', L: 0.007, mass: 1.2e-5, speed: 1.8, hp: 2, move: 'fly', perch: 0.65, fact: 'Tastes with its feet. Sees in slow motion compared to you.' },
  moth:       { name: 'Moth', latin: 'Noctuidae', L: 0.02, mass: 1e-4, speed: 1.0, hp: 4, move: 'fly', perch: 0.4, light: true, fact: 'Steers by the moon. Gets lost circling lamps.' },
  cricket:    { name: 'House cricket', latin: 'Acheta domesticus', L: 0.02, mass: 3e-4, speed: 0.12, hp: 8, move: 'walk', jump: 0.45, fact: 'Hears with ears on its front legs. Feeder insect in every lab.' },
  mealworm:   { name: 'Mealworm', latin: 'Tenebrio molitor (larva)', L: 0.025, mass: 1.3e-4, speed: 0.008, hp: 5, move: 'crawl', fact: 'Grows into a darkling beetle. Lab spiders eat thousands.' },
  roach:      { name: 'Cockroach', latin: 'Periplaneta americana', L: 0.03, mass: 9e-4, speed: 1.0, hp: 12, move: 'walk', climb: true, fact: 'Runs 50 body lengths a second and can live a week without its head.' },
  ant:        { name: 'Odorous house ant', latin: 'Tapinoma sessile', L: 0.003, mass: 2e-6, speed: 0.03, hp: 0.6, move: 'walk', climb: true, bite: 0.6, huntRatio: 0.35, swarm: true, fact: 'Smells like rotten coconut when crushed. Follows scent trails.' },
  silverfish: { name: 'Silverfish', latin: 'Lepisma saccharinum', L: 0.012, mass: 1e-5, speed: 0.35, hp: 3, move: 'walk', fact: 'Older than the dinosaurs. Eats paper glue and sugar.' },
  centipede:  { name: 'House centipede', latin: 'Scutigera coleoptrata', L: 0.03, mass: 1e-4, speed: 0.42, hp: 18, move: 'walk', climb: true, bite: 7, huntRatio: 0.9, fact: '15 pairs of legs. Hunts spiders, roaches, silverfish.' },
  gecko:      { name: 'House gecko', latin: 'Hemidactylus frenatus', L: 0.065, mass: 3e-3, speed: 0.9, hp: 45, move: 'walk', climb: true, bite: 14, huntRatio: 0.55, fact: 'Sticky toes hold it on glass and ceilings. Barks at night.' },
  mouse:      { name: 'House mouse', latin: 'Mus musculus', L: 0.085, mass: 2e-2, speed: 1.4, hp: 60, move: 'walk', bite: 10, huntRatio: 0.3, fact: 'Squeezes through a gap the size of a pencil.' },
  rat:        { name: 'Brown rat', latin: 'Rattus norvegicus', L: 0.22, mass: 3e-1, speed: 2.2, hp: 160, move: 'walk', bite: 24, huntRatio: 0.3, fact: 'Swims, climbs, chews through concrete. Lab rats escape a lot.' },
  giantroach: { name: 'Specimen R-2', latin: 'Gromphadorhina portentosa (VOSS mod.)', L: 0.09, mass: 3e-2, speed: 0.25, hp: 220, move: 'walk', climb: true, bite: 16, huntRatio: 0.9, boss: true, fact: 'A hissing cockroach dosed with your serum. Armoured. Angry.' },
  cellar:     { name: 'Cellar spider', latin: 'Pholcus phalangioides', L: 0.008, mass: 2e-5, speed: 0.12, hp: 10, move: 'spider', species: 'cellar', bite: 6, huntRatio: 1.6, fact: 'Hunts other spiders, black widows included, from its messy web.' },
};

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);

let ID = 1;
export class Creature {
  constructor(sys, kind, pos, opts = {}) {
    this.sys = sys; this.id = ID++;
    this.kind = kind; this.def = KINDS[kind];
    this.L = this.def.L * (opts.scale || rand(0.85, 1.15));
    this.mass = this.def.mass * (this.L / this.def.L) ** 3;
    this.hp = this.maxHp = this.def.hp * (this.L / this.def.L) ** 2;
    this.pos = pos.clone(); this.up = new THREE.Vector3(0, 1, 0); this.fwd = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
    this.vel = new THREE.Vector3();
    this.home = pos.clone(); this.homeR = opts.r || 1;
    this.state = this.def.move === 'fly' ? (Math.random() < 0.5 ? 'perch' : 'fly') : 'wander';
    this.venom = 0; this.stuck = 0; this.eaten = 0; this.wrapped = false; this.t = rand(0, 10); this.timer = rand(1, 4);
    this.biteCD = 0; this.target = null; this.speedNow = 0; this.jumpT = 0; this.hiss = 0;
    this.spawnFloor = opts.floor;
    this.buildModel();
    if (this.def.move === 'fly' && this.state === 'perch') this.perchOn(opts.wall);
    else this.snap();
  }
  buildModel() {
    if (this.def.move === 'spider') {
      const sp = SPECIES[this.def.species];
      this.root = buildSpider(sp, { quality: 'low', hairMul: 0.3 });
      this.rig = new SpiderRig(this.root, sp, (o, d, far) => this.sys.zone.collision.raycast(o, d, far, this.L));
      this.model = { root: this.root, anim() {} };
    } else {
      this.model = MODELS[this.kind]();
      this.root = new THREE.Group(); this.root.add(this.model.root);
    }
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.root.scale.setScalar(this.L);
    this.sys.scene.add(this.root);
  }
  get alive() { return this.state !== 'dead' && this.state !== 'eaten'; }
  get helpless() { return this.state === 'paralyzed' || this.state === 'dead' || this.stuck > 0 || this.wrapped; }
  probe(o, d, far) { return this.sys.zone.collision.raycast(o, d, far, this.L); }
  snap() { // drop onto the surface below
    const h = this.probe(_v.copy(this.pos).addScaledVector(this.up, this.L * 0.6), _v2.copy(this.up).negate(), this.L * 50);
    if (h) { this.pos.copy(h.point); this.up.copy(h.normal); }
  }
  perchOn(wall) {
    // find something to sit on: below, or a wall nearby
    const dirs = wall ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1), DOWN] : [DOWN, new THREE.Vector3(rand(-1, 1), -0.5, rand(-1, 1)).normalize()];
    for (const d of dirs) { const h = this.probe(this.pos, d, 3); if (h) { this.pos.copy(h.point); this.up.copy(h.normal); this.state = 'perch'; this.timer = rand(2, 9); return; } }
    this.state = 'fly';
  }

  update(dt, P) {
    this.t += dt; this.biteCD = Math.max(0, this.biteCD - dt);
    if (this.state === 'eaten') return;
    // venom wears off slowly, sticky silk holds for a while
    if (this.stuck > 0) { this.stuck -= dt * (this.def.move === 'fly' ? 0.25 : 0.35) / Math.max(0.3, this.sys.silkPower); if (this.stuck < 0) this.stuck = 0; }
    if (this.state === 'paralyzed') { this.venom -= dt * 0.012 * this.maxHp; if (this.venom < this.maxHp * 0.3 && !this.wrapped) this.state = this.def.move === 'fly' ? 'fly' : 'wander'; }
    const helpless = this.helpless;
    const s = this.L;
    // ---- think: threats + targets
    const toP = P ? _v3.subVectors(P.pos, this.pos) : null;
    const dP = toP ? toP.length() : 1e9;
    const ratio = P ? P.sizeM / s : 0;
    let mode = this.state;
    if (!helpless && P && P.mode !== 'dead') {
      const sense = Math.max(s * 8, P.sizeM * (this.def.move === 'fly' ? 18 : 12));
      const hunter = this.def.bite && ratio < (this.def.huntRatio || 0) && !P.hidden;
      if (hunter && dP < sense * 1.6) mode = 'hunt';
      else if (dP < sense && ratio > 0.3) mode = this.def.move === 'fly' ? 'fly' : 'flee';
      else if (this.state === 'flee' || this.state === 'hunt') mode = this.def.move === 'fly' ? 'fly' : 'wander';
      if (mode === 'flee' && this.state !== 'flee' && this.kind === 'giantroach') this.hiss = 1.2;
      if (this.kind === 'giantroach' && ratio < 1.4 && dP < sense) mode = 'hunt'; // the mutant fights back
    }
    if (helpless) mode = this.state === 'dead' || this.state === 'paralyzed' ? this.state : 'stuck';
    this.mode = mode;
    // ---- move
    let speed = 0;
    if (this.def.move === 'fly' && !helpless) speed = this.flyMove(dt, mode, toP, dP, P);
    else if (this.def.move === 'spider' && !helpless) speed = this.walkMove(dt, mode, toP, dP, P);
    else if (!helpless) speed = this.walkMove(dt, mode, toP, dP, P);
    else if (this.def.move === 'fly' && this.stuck <= 0 && this.state !== 'paralyzed' && this.state !== 'dead' && !this.wrapped) this.state = 'fly';
    if (helpless && !this.grounded && this.def.move === 'fly' && !this.wrapped) this.fall(dt);
    this.speedNow = speed;
    // ---- bite the player
    if (mode === 'hunt' && P && dP < s * 0.75 + P.s * 0.55 && this.biteCD <= 0) {
      this.biteCD = this.kind === 'cellar' ? 0.9 : 1.4;
      const dmg = this.def.bite * (this.sys.game.realistic ? 2.2 : 1) * clamp(1.2 / Math.max(ratio, 0.15), 0.6, 4);
      P.hurt(dmg, cause(this.kind), this);
      this.sys.game.audio && this.sys.game.audio.at && this.sys.game.audio.at('critterBite', this.pos);
    }
    if (this.hiss > 0) { this.hiss -= dt; if (this.sys.game.audio && Math.random() < dt * 2) this.sys.game.audio.at && this.sys.game.audio.at('hiss', this.pos); }
    this.place(dt);
    this.model.anim(this.t, speed / Math.max(s, 1e-6) * 0.02, mode === 'fly' ? 'fly' : this.hiss > 0 ? 'hiss' : mode === 'jump' ? 'jump' : 'walk');
    if (this.state === 'paralyzed' || this.stuck > 0) { // twitching
      this.model.root.rotation.z = Math.sin(this.t * 31) * 0.05 * (this.state === 'paralyzed' ? 0.4 : 1);
    } else this.model.root.rotation.z = 0;
  }

  flyMove(dt, mode, toP, dP, P) {
    const s = this.L, d = this.def;
    if (this.state === 'perch' && mode !== 'fly') {
      this.timer -= dt;
      this.grounded = true;
      if (this.timer > 0) return 0;
      this.state = 'fly'; this.vel.copy(this.up).multiplyScalar(d.speed * 0.5);
    }
    if (mode === 'fly' && this.state === 'perch') { this.state = 'fly'; this.vel.copy(this.up).multiplyScalar(d.speed * 0.6); }
    this.state = 'fly'; this.grounded = false;
    // wander target: around home (moths: the brightest nearby light)
    if (!this.goal || this.pos.distanceTo(this.goal) < s * 3 || (this.timer -= dt) < 0) {
      this.timer = rand(1, 4);
      if (d.light && this.sys.lightNear) { const L = this.sys.lightNear(this.pos); if (L) { this.goal = L.clone().add(_v.set(rand(-0.25, 0.25), rand(-0.3, -0.05), rand(-0.25, 0.25))); } }
      if (!this.goal || !d.light) this.goal = this.home.clone().add(_v.set(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1)).multiplyScalar(this.homeR));
    }
    const want = _v.subVectors(this.goal, this.pos);
    if (toP && dP < Math.max(s * 10, P.sizeM * 20) && P.sizeM / s > 0.3) want.copy(toP).negate().normalize().multiplyScalar(2).add(_v2.set(rand(-1, 1), rand(0, 1), rand(-1, 1)));
    want.normalize().multiplyScalar(d.speed);
    // jittery real fly flight
    want.x += Math.sin(this.t * 7.3 + this.id) * d.speed * 0.6; want.y += Math.sin(this.t * 5.1 + this.id * 3) * d.speed * 0.4; want.z += Math.cos(this.t * 6.7 + this.id) * d.speed * 0.6;
    this.vel.lerp(want, 1 - Math.exp(-dt * 4));
    const step = this.vel.clone().multiplyScalar(dt), sl = step.length();
    if (sl > 1e-9) {
      const dir = step.clone().divideScalar(sl);
      const h = this.probe(this.pos, dir, sl + s);
      if (h) {
        if (Math.random() < d.perch * 0.5) { this.pos.copy(h.point); this.up.copy(h.normal); this.state = 'perch'; this.timer = rand(1.5, 8); this.grounded = true; return 0; }
        this.vel.reflect(h.normal).multiplyScalar(0.5); return this.vel.length();
      }
      this.pos.add(step);
    }
    if (this.vel.lengthSq() > 1e-10) this.fwd.copy(this.vel).normalize();
    this.up.lerp(_v2.set(0, 1, 0), 1 - Math.exp(-dt * 5));
    // don't fly away forever
    if (this.pos.distanceTo(this.home) > this.homeR * 4 + 3) this.goal = this.home.clone();
    return this.vel.length();
  }
  fall(dt) {
    this.vel.y -= 9.8 * dt; const vt = 0.6 + 7 * Math.sqrt(this.L); if (this.vel.length() > vt) this.vel.setLength(vt);
    const step = this.vel.clone().multiplyScalar(dt), sl = step.length();
    const h = sl > 1e-9 ? this.probe(this.pos, step.clone().divideScalar(sl), sl + this.L * 0.3) : null;
    if (h) { this.pos.copy(h.point); this.up.copy(h.normal); this.grounded = true; this.vel.set(0, 0, 0); }
    else this.pos.add(step);
  }
  walkMove(dt, mode, toP, dP, P) {
    const s = this.L, d = this.def;
    this.timer -= dt;
    let spd = d.speed * (mode === 'flee' ? 1.6 : mode === 'hunt' ? 1.3 : this.idle ? 0 : 0.35);
    if (this.timer < 0) { this.timer = rand(0.6, 3); this.idle = Math.random() < 0.35; this.turn = rand(-2, 2); }
    // wanted direction
    let want = _v.copy(this.fwd);
    if (mode === 'flee' && toP) want.copy(toP).negate();
    else if (mode === 'hunt' && toP) want.copy(toP);
    else { want.applyAxisAngle(this.up, this.turn * dt); const back = _v2.subVectors(this.home, this.pos); if (back.length() > this.homeR) want.lerp(back.normalize(), 0.08); }
    want.addScaledVector(this.up, -want.dot(this.up));
    if (want.lengthSq() < 1e-10) want.copy(this.fwd);
    want.normalize();
    this.fwd.lerp(want, 1 - Math.exp(-dt * (mode === 'wander' ? 3 : 8))).normalize();
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    if (this.kind === 'cricket' && mode === 'flee' && this.jumpT <= 0 && Math.random() < dt * 2) { this.jumpT = 0.4; this.vel.copy(this.up).multiplyScalar(0.9).addScaledVector(this.fwd, 0.7); this.grounded = false; }
    if (!this.grounded || this.jumpT > 0) { this.jumpT -= dt; this.fall(dt); return spd; }
    if (spd <= 0) return 0;
    const step = spd * dt;
    const c = _v2.copy(this.pos).addScaledVector(this.up, s * 0.15);
    const ahead = this.probe(c, this.fwd, s * 0.6 + step);
    if (ahead && ahead.normal.dot(this.up) < 0.7) {
      if (d.climb) { const oldUp = this.up.clone(); this.pos.copy(ahead.point); this.up.copy(ahead.normal); this.fwd.copy(oldUp); return spd; }
      this.fwd.reflect(ahead.normal).addScaledVector(this.up, -this.fwd.dot(this.up)).normalize(); this.turn = rand(-3, 3); return 0;
    }
    const cand = _v3.copy(this.pos).addScaledVector(this.fwd, step);
    const down = this.probe(_v.copy(cand).addScaledVector(this.up, s * 0.4), _v2.copy(this.up).negate(), s * 1.2);
    if (down) { this.pos.copy(down.point); this.up.lerp(down.normal, 1 - Math.exp(-dt * 15)).normalize(); }
    else if (d.climb) {
      const o = _v.copy(cand).addScaledVector(this.up, -s * 0.3).addScaledVector(this.fwd, s * 0.1);
      const wrap = this.probe(o, _v2.copy(this.fwd).negate(), s * 0.8);
      if (wrap) { const oldUp = this.up.clone(); this.pos.copy(wrap.point); this.up.copy(wrap.normal); this.fwd.copy(oldUp).negate(); }
      else { this.fwd.negate(); }
    } else { this.fwd.negate(); this.turn = rand(-2, 2); } // edge: turn around (don't fall off the bench)
    return spd;
  }
  place(dt) {
    if (this.rig) { this.root.position.copy(this.pos); this.orient(); this.rig.mode = 'walk'; this.rig.update(dt, this.speedNow / Math.max(this.L, 1e-6)); return; }
    this.root.position.copy(this.pos);
    this.orient();
  }
  orient() {
    const f = _v.copy(this.fwd).addScaledVector(this.up, -this.fwd.dot(this.up));
    if (f.lengthSq() < 1e-8) return; f.normalize();
    const r = _v2.crossVectors(this.up, f).normalize();
    _m.makeBasis(r, this.up, f); _q.setFromRotationMatrix(_m);
    this.root.quaternion.slerp(_q, 0.5);
  }
  // ---- what happens to it
  hurt(dmg, venom = 0) {
    if (!this.alive) return;
    this.hp -= dmg; this.venom += venom;
    if (this.hp <= 0) { this.die(); return; }
    if (this.venom > this.hp * 0.6 && this.state !== 'paralyzed') { this.state = 'paralyzed'; this.grounded = this.def.move !== 'fly'; }
  }
  die() { this.state = 'dead'; this.hp = 0; this.grounded = this.def.move !== 'fly' || this.grounded; this.model.root.rotation.x = 0; this.root.rotateZ(Math.PI * 0.9); }
  webbed(amount) { this.stuck = Math.max(this.stuck, amount); if (this.def.move === 'fly') this.grounded = false; }
  remove() { this.state = 'eaten'; this.root.removeFromParent(); }
}

function cause(kind) {
  return { cellar: 'caught by a cellar spider', centipede: 'eaten by a house centipede', gecko: 'eaten by a gecko', mouse: 'eaten by a mouse', rat: 'eaten by a rat', giantroach: 'crushed by Specimen R-2', ant: 'swarmed by ants' }[kind] || 'eaten by a ' + KINDS[kind].name.toLowerCase();
}

export class Creatures {
  constructor(zone) {
    this.zone = zone; this.game = zone.game; this.scene = zone.scene;
    this.list = []; this.groups = [];
    this.silkPower = 1;
    this.respawnT = 10;
    this.lightNear = (p) => {
      let best = null, bd = 6;
      for (const L of this.zone.pool ? this.zone.pool.fixtures : []) { const d = L.p.distanceTo(p); if (d < bd) { bd = d; best = L.p; } }
      return best;
    };
  }
  spawnGroup(g) {
    const grp = { ...g, alive: [] };
    this.groups.push(grp);
    for (let i = 0; i < g.n; i++) this.spawnIn(grp);
  }
  spawnIn(grp, avoid) {
    const p = new THREE.Vector3(grp.x + rand(-1, 1) * grp.r, grp.y + 0.5, grp.z + rand(-1, 1) * grp.r);
    if (KINDS[grp.kind].move === 'fly') p.y = grp.y + rand(-0.3, 0.6) * Math.min(1.5, grp.r);
    if (avoid && p.distanceTo(avoid) < 2) return null;
    const c = new Creature(this, grp.kind, p, { r: grp.r, wall: grp.wall });
    c.group = grp; grp.alive.push(c); this.list.push(c);
    return c;
  }
  update(dt) {
    const G = this.game, P = G.player && G.state !== 'dead' ? G.player : null;
    const cam = G.camera.position;
    this.silkPower = P ? (P.sp.stats.silk || 1) * (1 + 0.15 * P.evo.silk) * Math.sqrt(Math.max(0.1, P.sizeM / 0.004)) * 0.5 : 1;
    const fov = G.camera.fov * Math.PI / 180, H = G.renderer.size().h;
    for (const c of this.list) {
      if (c.state === 'eaten') continue;
      const dc = c.pos.distanceTo(cam);
      const px = c.L / Math.max(dc, 1e-6) / Math.tan(fov / 2) * H * 0.5;
      // far + tiny = sleep (cheap), but anything near the player keeps thinking
      const near = P ? c.pos.distanceTo(P.pos) < Math.max(3, P.sizeM * 40) : false;
      c.root.visible = px > 0.6 || near;
      if (!near && px < 0.6) { c.sleepT = (c.sleepT || 0) + dt; if (c.sleepT < 0.5) continue; c.update(c.sleepT, null); c.sleepT = 0; continue; }
      c.update(dt, P);
    }
    // the floors restock (vents, gaps under doors): prey comes back when you aren't looking
    this.respawnT -= dt;
    if (this.respawnT <= 0 && P) {
      this.respawnT = 14;
      for (const g of this.groups) {
        g.alive = g.alive.filter(c => c.state !== 'eaten');
        if (g.alive.length < g.n && !KINDS[g.kind].boss && Math.random() < 0.5) this.spawnIn(g, P.pos);
      }
      this.list = this.list.filter(c => c.state !== 'eaten');
    }
  }
  // queries
  near(p, r, filter) { const out = []; for (const c of this.list) if (c.state !== 'eaten' && c.pos.distanceTo(p) < r + c.L * 0.5 && (!filter || filter(c))) out.push(c); return out; }
  nearest(p, r, filter) { let best = null, bd = r; for (const c of this.list) { if (c.state === 'eaten' || (filter && !filter(c))) continue; const d = c.pos.distanceTo(p) - c.L * 0.5; if (d < bd) { bd = d; best = c; } } return best; }
  // ray against creature spheres (web shots, aiming)
  raycast(o, d, far, minL = 0) {
    let best = null, bt = far;
    for (const c of this.list) {
      if (c.state === 'eaten' || c.L < minL) continue;
      const ctr = _v.copy(c.pos).addScaledVector(c.up, c.L * 0.2);
      const oc = _v2.subVectors(ctr, o), t = oc.dot(d);
      if (t < 0 || t > bt) continue;
      const r = c.L * 0.55 + far * 0.004;
      if (oc.lengthSq() - t * t < r * r) { bt = t; best = c; }
    }
    return best ? { c: best, t: bt } : null;
  }
}
