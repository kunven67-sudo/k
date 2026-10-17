// People: everyone in Maple Hollow living their day. Each game minute the director asks
// residents.plan() what each person should be doing, and walks them there: Mom leaves for work
// through the garage, the neighbour kids head to the playground after school, the cashier is at
// register 1 when Walmort opens. People inside their houses / at work have no body at all.
// Their memory of you (opinion, what you said, what you asked for) lives in the 'people' slice.
//
//   const people = new People({ world, player, hud, life })
//   people.update(dt)
//   people.byRole('mom') / people.family / people.near(pos, r)
//   people.witnesses(pos, { noise }) -> [npc]    who saw / heard something happen at pos
//   people.memory(npc) -> { opinion, met, talks, facts, said, lastTalk, asks }

import * as THREE from 'three';
import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { Rng } from '../core/rng.js';
import { settings } from '../core/settings.js';
import { me } from '../life/me.js';
import { buildNav } from './nav.js';
import { Npc } from './npc.js';
import { makeResidents, makeWalker, plan } from './residents.js';
import { CAR_MODELS } from '../world/traffic.js';
import { MAPLE, CURB, FAMILY_LOT } from '../world/layout.js';

save.registerSlice('people', {
  create() {
    return { mem: {}, permissions: {}, meals: {} };
  },
});

const _v = new THREE.Vector3();
const FAR = 55; // metres: past this, walking is skipped (you can't really see them)

export class People {
  constructor({ world, player, hud, life, traffic = null }) {
    this.world = world;
    this.traffic = traffic;
    this.player = player;
    this.hud = hud;
    this.life = life;
    this.d = save.slice('people');
    this.nav = buildNav(world);
    world.player = player;
    this.recs = makeResidents(save.life);
    const keep = settings.get('peopleCount') ?? 1;
    // Fewer people setting: drop some neighbours (never your family or the store staff).
    const neigh = this.recs.filter((r) => !r.family && r.role !== 'staff');
    const drop = new Set(neigh.slice(Math.round(neigh.length * Math.min(1, keep))).map((r) => r.id));
    this.npcs = this.recs.filter((r) => !drop.has(r.id)).map((r) => new Npc(world, this.nav, r));
    this.family = this.npcs.filter((n) => n.rec.family);
    for (const n of this.npcs) n.noticesPlayer = n.rec.family || n.rec.role === 'staff' || !!this.d.mem[n.id]?.met;
    this.rng = new Rng(clock.dayIndex * 31 + 7);
    this._houses = new Map(world.town.houses.filter((h) => !h.family).map((h) => [h.lot.id, h]));
    this._spots = this._homeSpots();
    if (traffic) this._parkCars(traffic);
    this._lastPlanAt = -1e9;
    this._planAcc = 0;
    this._said = new Map(); // npc id -> last line key (no repeating every minute)
    world.onNpcSay = (npc, text) => this.say(npc, text);
    this._offs = [bus.on('clock:hour', () => this._hourly())];
    this._replan(true);
  }

  byRole(role) {
    return this.npcs.find((n) => n.rec.role === role);
  }

  get parents() {
    return this.family.filter((n) => n.rec.role !== 'sibling');
  }

  near(pos, r = 6) {
    return this.npcs.filter((n) => !n.away && n.pos.distanceTo(pos) < r);
  }

  memory(npc) {
    const id = npc.id || npc;
    if (npc.rec?.transient) return (npc._mem ||= { opinion: 0, met: false, talks: 0, facts: {}, said: [], lastTalk: -1, asks: {} });
    return (this.d.mem[id] ||= { opinion: npc.rec?.family ? 55 : 0, met: !!npc.rec?.family, talks: 0, facts: {}, said: [], lastTalk: -1, asks: {} });
  }

  /** Who sees or hears something at `pos`: same room / line of sight nearby, or loud enough. */
  witnesses(pos, { noise = 0.3, room = null } = {}) {
    const out = [];
    const where = room || this.world.roomAt(pos)?.id || null;
    for (const n of this.npcs) {
      if (n.away || n.activity?.kind === 'sleep') {
        // Asleep: only something really loud wakes them (in the same house).
        if (n.activity?.kind === 'sleep' && noise > 0.85 && n.rec.family && n.pos.distanceTo(pos) < 14) out.push(n);
        continue;
      }
      const d = n.pos.distanceTo(pos);
      const theirRoom = this.world.roomAt(_v.copy(n.pos).setY(n.pos.y + 0.5))?.id || null;
      const sameRoom = where && theirRoom === where;
      const hear = noise * 12; // metres a sound carries
      if ((sameRoom && d < 9) || d < hear || (!where && !theirRoom && d < 14 && this._canSee(n, pos))) out.push(n);
    }
    return out;
  }

  _canSee(npc, pos) {
    const eye = _v.copy(npc.pos).setY(npc.pos.y + npc.height * 0.9);
    const dir = pos.clone().setY(pos.y + 0.8).sub(eye);
    const len = dir.length();
    const hit = this.world.physics.raycast(eye, dir.divideScalar(len), len - 0.4, { exclude: this.player.controller.collider });
    return !hit;
  }

  /** Step out of the driver's door (left side of the parked car). */
  _outOfCar(n) {
    const car = this.traffic?.parked.get(n.rec.car);
    if (!car) return;
    const y = car.home.yaw;
    const f = new THREE.Vector3(Math.sin(y), 0, Math.cos(y));
    n.pos.copy(car.home.at).add(new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(car.size.x / 2 + 0.45)).setY(car.home.at.y);
    n.yaw = Math.atan2(-f.z, f.x);
  }

  /** Every household's car(s) in its driveway; the people who drive to work get one. */
  _parkCars(traffic) {
    const wealth = save.life.family.house.wealth;
    const famModel = { poor: 'NormalCar1', working: 'NormalCar2', middle: 'SUV', rich: 'SportsCar', veryrich: 'SportsCar2' }[wealth] || 'SUV';
    const gd = this.world.home.garageDoor;
    const drivers = this.npcs.filter((n) => n.rec.family && n.rec.role !== 'sibling' && n.rec.job !== 'retired');
    const two = drivers.length > 1 && ['middle', 'rich', 'veryrich'].includes(wealth);
    const spots = two ? [gd.cx - 1.35, gd.cx + 1.35] : [gd.cx - 1.35]; // leave the middle free to walk past
    spots.forEach((x, i) => {
      const id = `car-home-${i}`;
      traffic.park(id, { model: i === 0 ? famModel : wealth === 'veryrich' ? 'SUV' : 'NormalCar2', color: ['#2f4f6f', '#8a8d91'][i], at: new THREE.Vector3(x, CURB, FAMILY_LOT.zf + 3.6), faceYaw: Math.PI, curb: new THREE.Vector3(x, CURB, -MAPLE.half - 0.1) });
      if (drivers[i]) drivers[i].rec.car = id;
    });
    for (const [lotId, h] of this._houses) {
      if (h.house.garageX == null) continue;
      const side = h.lot.side;
      const owner = this.npcs.find((n) => n.rec.home === lotId && n.rec.role === 'adult' && n.rec.job !== 'retired');
      const id = `car-${lotId}`;
      const k = lotId.charCodeAt(1) + lotId.length;
      traffic.park(id, { model: CAR_MODELS[k % 5], color: ['#b8bcc2', '#1d1f24', '#8b1e22', '#1f3f73', '#d9d4c7', '#2f5d3a'][k % 6], at: new THREE.Vector3(h.house.garageX, CURB, side * 13.2), faceYaw: side < 0 ? Math.PI : 0, curb: new THREE.Vector3(h.house.garageX, CURB, side * (MAPLE.half + 0.1)) });
      if (owner) owner.rec.car = id;
    }
  }

  // ------------------------------------------------------------------------------- planning
  _homeSpots() {
    const sp = this.world.home.spots;
    const find = (pred) => sp.find(pred);
    return {
      parentsBed: find((s) => s.kind === 'bed' && s.owner === 'parents'),
      siblingBed: find((s) => s.kind === 'bed' && s.owner === 'sibling'),
      couch: find((s) => s.kind === 'couch'),
      chairs: sp.filter((s) => s.kind === 'seat' && s.table),
      stove: find((s) => s.kind === 'stove'),
      fridge: find((s) => s.kind === 'fridge' && s.room === 'kitchen'),
      sinkKitchen: find((s) => s.kind === 'sink-kitchen'),
    };
  }

  _ctx() {
    return {
      spots: this._spots,
      homeRoom: this.world.home.navRoom,
      stores: this.world.town.stores,
      badWeather: (this.world.weather?.rain ?? this.world.sky?.weather?.rain ?? 0) > 0.3 || (this.world.season === 'winter' && clock.hour > 17),
    };
  }

  /** People from other streets walking through Maple St (more after school, evenings, weekends). */
  _walkers() {
    const h = clock.hourFloat;
    const wd = clock.weekday;
    const weekend = wd === 0 || wd === 6;
    let want = h < 6.5 || h > 21.5 ? 0 : h < 9 ? 1 : h < 15 ? (weekend ? 3 : 1) : h < 19.5 ? 3 : 2;
    if (weekend) want += 1;
    if ((this.world.weather?.rain || 0) > 0.3) want = Math.floor(want / 3);
    if (clock.season === 'winter') want = Math.floor(want * 0.6);
    want = Math.round(want * (settings.get('peopleCount') ?? 1));
    const live = this.npcs.filter((n) => n.rec.transient);
    if (live.length >= want) return;
    // Every few minutes someone new turns onto Maple from Elm or comes up from the park.
    const seed = clock.dayIndex * 1440 + Math.floor(clock.minutes);
    if (seed % 6 !== 0) return;
    const rec = makeWalker(seed);
    const n = new Npc(this.world, this.nav, rec);
    n.noticesPlayer = false;
    const ends = this.nav.nodes.filter((x) => x.tag === 'walk' && Math.abs(x.p.x) > 55 && x.p.x < 64);
    const west = ends.filter((x) => x.p.x < 0);
    const east = ends.filter((x) => x.p.x > 0);
    const fromWest = seed % 12 === 0;
    const a = (fromWest ? west : east)[seed % Math.max(1, (fromWest ? west : east).length)];
    const b = (fromWest ? east : west)[(seed >> 3) % Math.max(1, (fromWest ? east : west).length)];
    if (!a || !b) return;
    n.appearAt(a.id);
    n.hurry = rec.walk === 'jog';
    n.walkTarget = b.id;
    n.goTo(b.id, { kind: 'leave', where: 'gone' });
    this.npcs.push(n);
  }

  _replan(snap = false) {
    this._walkers();
    const ctx = this._ctx();
    for (const n of this.npcs) {
      if (n.rec.transient) continue;
      let p = plan(n.rec, clock, ctx);
      if (p.act?.kind === 'shop' && n.shopDone === clock.dayIndex) p = { at: 'home' };
      if (p.act?.kind === 'cook' && n.rec.family) this._mealTalk(n, p);
      const key = p.at ? `away:${p.at}` : `${p.act.kind}:${p.act.spot?.label || p.act.node || p.act.store || ''}`;
      if (!snap && key === n.planKey) continue;
      n.planKey = key;
      n.plan = p;
      this._apply(n, p, snap);
    }
  }

  /** Move someone towards what they should be doing. snap = no walking (load / time skip). */
  _apply(n, p, snap) {
    if (p.at) {
      n.lastExit = p.exit || null;
      const from = n.away;
      if (from) {
        // Neighbours leaving their house (work, school) walk out of the front door and away;
        // coming back they walk up to the door and go in. Nobody pops in or out of thin air.
        const h = this._houses.get(n.rec.home);
        const seen = h && this.nav.nodes[h.navDoor].p.distanceTo(this.player.position) < FAR;
        if (!snap && seen && from === 'home' && p.at !== 'home') {
          n.appearAt(h.navDoor);
          n.goTo(this._exitNode(n, p.exit, p.why), { kind: 'leave', where: p.at });
        } else if (!snap && seen && from !== 'home' && from !== 'init' && p.at === 'home') {
          if (n.rec.car && n.cameFrom === 'driveway' && this.traffic && !this.traffic.parkedCarOf(n.rec.car)) {
            if (!n.waitingCar) {
              n.waitingCar = true;
              this.traffic.arrive(n.rec.car, () => {
                n.waitingCar = false;
                n.appearAt(h.navDriveway ?? h.navDoor);
                this._outOfCar(n);
                n.goTo(h.navDoor, { kind: 'leave', where: 'home' });
              });
            }
            return;
          }
          if (n.rec.car) this.traffic?.restore(n.rec.car);
          if (this._enterNear(n, this._exitNode(n, n.cameFrom, n.cameWhy), h.navDoor)) n.goTo(h.navDoor, { kind: 'leave', where: 'home' });
          else n.away = p.at;
        } else {
          // Off-screen comings and goings still move the car (gone while they're at work).
          if (n.rec.car && p.at !== 'home' && p.exit === 'driveway') this.traffic?.hide(n.rec.car);
          if (n.rec.car && p.at === 'home') this.traffic?.restore(n.rec.car);
          n.away = p.at;
        }
        n.cameFrom = p.exit;
        n.cameWhy = p.why;
        return;
      }
      n.cameFrom = p.exit;
      n.cameWhy = p.why;
      if (snap || !n.body?.root.visible) {
        if (!snap && n.rec.family) bus.emit('family:left', { npc: n, why: p.why });
        if (n.rec.car && p.exit === 'driveway') this.traffic?.hide(n.rec.car);
        return n.setAway(p.at);
      }
      // Walk out (front door / driveway / store doors), then disappear.
      const exit = this._exitNode(n, p.exit, p.why);
      n.goTo(exit, { kind: 'leave', where: p.at });
      if (n.rec.family) bus.emit('family:left', { npc: n, why: p.why });
      return;
    }
    const act = { ...p.act };
    const target = this._targetNode(n, act);
    if (target == null) return;
    if (n.away) {
      // Coming home by car: the car pulls into the driveway first, then they get out.
      if (n.rec.car && (n.cameFrom || n.lastExit) === 'driveway' && this.traffic) {
        const entry = this._entryNode(n);
        const near = !snap && this.nav.nodes[entry].p.distanceTo(this.player.position) < FAR;
        if (near && !this.traffic.parkedCarOf(n.rec.car)) {
          if (n.waitingCar) return;
          n.waitingCar = true;
          this.traffic.arrive(n.rec.car, () => {
            n.waitingCar = false;
            if (!n.away) return;
            n.appearAt(entry);
            this._outOfCar(n);
            n.planKey = null; // re-plan: walks in to whatever they should be doing now
          });
          return;
        }
        this.traffic.restore(n.rec.car);
      }
      if (snap) n.appearAt(target);
      else if (!this._enterNear(n, this._entryNode(n), target, act)) snap = true;
    }
    if (snap) {
      n.appearAt(target);
      n.activity = act;
      n.path = [];
      n.pathI = 0;
      return;
    }
    n.goTo(target, act);
  }

  /**
   * Coming from far away (work, school, the other end of town): only the part of the walk you
   * could actually see is walked. Returns false when the whole route is out of your sight.
   */
  _enterNear(n, entry, target, act) {
    const route = this.nav.route(entry, target);
    const pl = this.player.position;
    const near = route.findIndex((id) => this.nav.nodes[id].p.distanceTo(pl) < FAR);
    if (near < 0) return false;
    n.appearAt(route[Math.max(0, near - 1)]);
    void act;
    return true;
  }

  _targetNode(n, act) {
    const S = this.world.town.stores;
    switch (act.kind) {
      case 'sit':
      case 'tv':
      case 'sleep':
      case 'cook':
      case 'stand':
      case 'work': {
        if (act.spot) {
          if (act.kind === 'tv' && act.alt) act.offset = this._side(act.spot, act.spot.width > 1.5 ? 0.55 : 0.4);
          if (act.kind === 'tv' && !act.alt) act.offset = this._side(act.spot, act.spot.width > 1.5 ? -0.55 : -0.4);
          if (act.kind === 'sleep' && act.spot.owner === 'parents') act.offset = this._side(act.spot, n.rec.primary ? -0.38 : 0.38, true);
          return act.spot.nav;
        }
        return act.node;
      }
      case 'wander-store':
        return this._pick(S[act.store].navLoop);
      case 'shop':
        n.shopStore = act.store;
        n.shopStep = 0;
        return S[act.store].navOutside;
      case 'play': {
        // Kids near the park go to the playground; the rest play in front of their house.
        const h = this._houses.get(n.rec.home);
        const pg = this.nav.nodes.find((x) => x.spot === 'playground');
        if (!h || (pg && this.nav.nodes[h.navDoor].p.distanceTo(pg.p) < 45)) return pg?.id;
        const door = this.nav.nodes[h.navDoor].p;
        return this._pick(this.nav.nodes.filter((x) => (x.tag === 'walk' || x.tag === 'yard') && x.p.distanceTo(door) < 14).map((x) => x.id));
      }
      case 'walk-park':
        return this._pick(this.nav.nodes.filter((x) => x.tag === 'park').map((x) => x.id));
      case 'walk-street':
        return this._pick(this.nav.nodes.filter((x) => x.tag === 'walk' && x.p.x < 60).map((x) => x.id));
      default:
        return null;
    }
  }

  /** Offset sideways from a seat/bed (left/right of where it faces). */
  _side(spot, d, bed = false) {
    const yaw = bed ? spot.rotY ?? 0 : spot.faceYaw ?? 0;
    return new THREE.Vector3(Math.cos(yaw) * d, 0, -Math.sin(yaw) * d);
  }

  _pick(list) {
    return list[this.rng.int(0, list.length - 1)];
  }

  _exitNode(n, exit, why) {
    const home = this.world.home;
    if (why === 'school' && n.rec.age >= 6 && this.world.schoolDoorNode != null) return this.world.schoolDoorNode;
    if (n.rec.role === 'staff') return this.world.town.stores[n.rec.store].navOutside;
    if (n.rec.family) {
      if (exit === 'driveway') return home.navDriveway;
      const front = home.doors.find((d) => d.name === 'Front door');
      return front?.outsideNode ?? home.navDriveway;
    }
    const h = this._houses.get(n.rec.home);
    return (exit === 'driveway' && h?.navDriveway) || h?.navDoor;
  }

  /** Coming back: through the same way they left (car in the driveway, front door...). */
  _entryNode(n) {
    return this._exitNode(n, n.cameFrom || n.lastExit || (n.rec.family ? 'front' : 'door'), n.cameWhy);
  }

  // ------------------------------------------------------------------------------- per frame
  update(dt) {
    const viewer = this.player.position;
    // Plan once per game minute; a big jump (sleep, time skip) snaps everyone into place.
    const now = clock.total;
    if (now - this._lastPlanAt >= 1) {
      const snap = now - this._lastPlanAt > 20;
      this._lastPlanAt = now;
      this._replan(snap);
    }
    const vis = [];
    for (const n of this.npcs) {
      if (n.away) continue;
      n.update(dt, viewer, this.player);
      // Walking off somewhere far from you: they're gone once you couldn't see them anyway.
      if (n.activity?.kind === 'leave' && n.pos.distanceTo(viewer) > FAR + 5 && !n.arrived && !n.rec.transient) {
        n.setAway(n.activity.where);
        continue;
      }
      if (n.arrived) this._arrived(n, dt);
      vis.push(n);
    }
    this._spacing(vis, dt);
    if (this.npcs.some((n) => n._dead)) {
      for (const n of this.npcs) if (n._dead) n.dispose();
      this.npcs = this.npcs.filter((n) => !n._dead);
    }
  }

  /** People standing around don't stand inside each other (or inside you): small push apart. */
  _spacing(list, dt) {
    const pl = this.player.position;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a._seatPos || a.talkingTo) continue;
      const moving = a.speed > 0;
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j];
        if (moving && b.speed > 0) continue; // two people walking just pass each other
        _v.copy(a.pos).sub(b._seatPos || b.pos);
        _v.y = 0;
        const d = _v.length();
        const min = 0.62;
        if (d < min && Math.abs(a.pos.y - b.pos.y) < 1) {
          if (d < 1e-3) _v.set(Math.cos(i * 2.4), 0, Math.sin(i * 2.4));
          a.pos.addScaledVector(_v.normalize(), Math.min(min - d, (moving ? 0.6 : 1.2) * dt));
        }
      }
      _v.copy(a.pos).sub(pl);
      _v.y = 0;
      const dp = _v.length();
      if (!moving && dp < 0.55 && dp > 1e-3 && Math.abs(a.pos.y - pl.y) < 1) a.pos.addScaledVector(_v.normalize(), Math.min(0.55 - dp, 0.8 * dt));
    }
  }

  /** After a detour (buying lemonade, talking): carry on with what they were doing. */
  resume(n) {
    if (n.away) return;
    if (n.rec.transient) n.goTo(n.walkTarget, { kind: 'leave', where: 'gone' });
    else n.planKey = null;
  }

  _arrived(n, dt) {
    const act = n.activity;
    if (!act) return;
    const S = this.world.town.stores;
    if (act.kind === 'leave') {
      // Reached the driveway: get in the car and drive off.
      if (n.rec.car && act.where !== 'home' && this.nav.nodes[n.goal]?.p.distanceTo(this.traffic?.parkedCarOf(n.rec.car)?.home.at || new THREE.Vector3(1e9, 0, 0)) < 6) this.traffic.depart(n.rec.car);
      n.setAway(act.where);
      if (n.rec.transient) n._dead = true;
      return;
    }
    // Wandering kinds: pause (real seconds), then pick the next place.
    n.idleT = (n.idleT || 0) + dt;
    if (act.kind === 'wander-store' && n.idleT > 6) {
      n.idleT = -this.rng.range(0, 9);
      n.goTo(this._pick(S[act.store].navLoop), act);
    } else if (act.kind === 'walk-park' || act.kind === 'walk-street' || act.kind === 'play') {
      if (n.idleT > (act.kind === 'play' ? 20 : 2)) {
        n.idleT = 0;
        n.goTo(this._targetNode(n, act) ?? n.goal, act);
      }
    } else if (act.kind === 'shop') {
      // Outside -> in the doors -> around the store -> a register -> back out. Then home.
      const st = S[n.shopStore];
      const steps = [st.navEntrance, st.navLoop[1], st.navLoop[2], st.navLoop[3], st.registers[0].navCustomer, st.navOutside];
      if (n.shopStep < steps.length) {
        if (n.shopStep === 5) this._sayOnce(n, 'shop-paid', null);
        n.goTo(steps[n.shopStep++], act);
      } else {
        n.shopDone = clock.dayIndex;
        n.planKey = null;
      }
    }
  }

  // ------------------------------------------------------------------------------- family life
  _mealTalk(n, p) {
    const h = clock.hourFloat;
    const meal = h < 12 ? 'breakfast' : 'dinner';
    const key = `${clock.dayIndex}:${meal}`;
    if (this.d.meals[key]) return;
    // Calls you when the food is about ready (a few minutes before the table time).
    const weekend = clock.weekday === 0 || clock.weekday === 6;
    const ready = meal === 'breakfast' ? (weekend ? 8.8 : 7.3) : 18.4;
    if (h < ready - 0.1 || h > ready + 0.25) return;
    this.d.meals[key] = { called: true };
    const line = meal === 'breakfast' ? `${save.life.character.name}! Breakfast is ready!` : `${save.life.character.name}! Dinner! Come eat!`;
    const home = this.world.isIndoors(this.player.position) && this.player.position.distanceTo(n.pos) < 30;
    if (home) this.say(n, line, { loud: true });
    else bus.emit('family:text', { npc: n, text: meal === 'breakfast' ? 'Breakfast is ready, where are you?' : 'Dinner is on the table. Come home!' });
    void p;
  }

  /** Someone sitting / lying on this spot right now. */
  occupant(spot) {
    return this.npcs.find((n) => !n.away && n.arrived && n.activity?.spot === spot && !n.activity.offset);
  }

  /** 'breakfast' / 'dinner' while the family meal is on the table (and you haven't eaten it). */
  mealOn() {
    const h = clock.hourFloat;
    const meal = h >= 6.5 && h < 9.5 ? 'breakfast' : h >= 18.3 && h < 19.6 ? 'dinner' : null;
    if (!meal || this.d.meals[`${clock.dayIndex}:${meal}`]?.ate) return null;
    if (!this.d.meals[`${clock.dayIndex}:${meal}`]?.called) return null;
    return meal;
  }

  /** You sat at the table while dinner/breakfast is on: you eat with your family. */
  tryFamilyMeal() {
    const meal = this.mealOn();
    if (!meal) return false;
    const key = `${clock.dayIndex}:${meal}`;
    const m = (this.d.meals[key] ||= {});
    if (m.ate) return false;
    const cook = this.parents.find((n) => !n.away);
    if (!cook) return false;
    m.ate = true;
    const menus = {
      breakfast: ['scrambled eggs and toast', 'pancakes with syrup', 'cereal and a banana', 'waffles', 'oatmeal with brown sugar'],
      dinner: ['spaghetti and meatballs', 'tacos', 'meatloaf and mashed potatoes', 'chicken and rice', 'pizza night', 'grilled cheese and tomato soup', 'chili'],
    };
    const wealth = save.life.family.house.wealth;
    const list = menus[meal];
    const food = list[(clock.dayIndex * 3 + (meal === 'dinner' ? 1 : 0)) % list.length];
    me.restore('hunger', meal === 'dinner' ? 0.55 : 0.4);
    me.restore('thirst', 0.15);
    me.restore('social', 0.15);
    this.life.home.d.dishes = Math.min(1, (this.life.home.d.dishes || 0) + 0.35);
    for (const p of this.family) this.memory(p).opinion = Math.min(100, this.memory(p).opinion + 0.5);
    this.life.skip(20);
    this.hud.toast(`You eat ${food} with your family.${wealth === 'poor' && meal === 'dinner' ? ' Small portions, but it\'s warm.' : ''}`);
    bus.emit('family:meal', { meal, food });
    return true;
  }

  _hourly() {
    // Skipped dinner while home -> Mom/Dad notice (they saved you a plate).
    const key = `${clock.dayIndex}:dinner`;
    if (clock.hour === 20 && this.d.meals[key]?.called && !this.d.meals[key].ate) {
      for (const p of this.parents) this.memory(p).opinion -= 1.5;
      this.d.meals[key].missed = true;
      const p = this.parents.find((x) => !x.away);
      if (p) this.say(p, "You missed dinner. There's a plate in the fridge for you.", { loud: true });
      bus.emit('family:missed-meal', { meal: 'dinner' });
    }
    // Tidy old meal records.
    for (const k of Object.keys(this.d.meals)) if (+k.split(':')[0] < clock.dayIndex - 2) delete this.d.meals[k];
  }

  // ------------------------------------------------------------------------------- speech
  _sayOnce(n, key, text) {
    if (this._said.get(n.id) === key) return;
    this._said.set(n.id, key);
    if (text) this.say(n, text);
  }

  say(n, text, { loud = false, force = false } = {}) {
    const d = n.pos.distanceTo(this.player.position);
    const sameHouse = n.rec.family && this.world.isIndoors(this.player.position) && this.world.isIndoors(n.pos);
    if (!force && d > (loud ? 28 : 9) && !(loud && sameHouse)) return;
    n.body?.talk(Math.min(6, 1 + text.length / 14));
    bus.emit('npc:say', { npc: n, text });
    if (settings.get('subtitles') !== false) this.hud.subtitle(n.displayName(), text, Math.min(7, 2 + text.length / 16));
  }

  dispose() {
    for (const off of this._offs) off();
    for (const n of this.npcs) n.dispose();
    this.world.onNpcSay = null;
  }
}
