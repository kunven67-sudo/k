// Mom and Dad. They live by the REAL clock: work on weekdays, cook, eat dinner, watch TV, sleep.
// They text you, call you down for dinner, give chores + allowance. They can't see tiny-you
// (watch your step!), think ant-sized you on a counter is a bug, and if they SEE you shrink
// they freak out and confiscate the watch (it ends up in their dresser - sneak it back).
import * as THREE from 'three';
import { Person } from './people.js';
import { R, world } from '../core/physics.js';
import { phoneNotify } from './objects/phone.js';
import { sfx } from '../core/audio.js';

const N = {
  // upstairs
  bedroom: [-0.6, 0, 0.3], bedDoorIn: [-1.75, 0, -1.2], bedDoorOut: [-2.5, 0, -1.2], hallS: [-2.5, 0, 1.1], hallN: [-2.5, 0, -3.95],
  landing: [-3.44, 0, -3.95], office: [0, 0, -3.0], offDoorOut: [-2.5, 0, -3.0], offDoorIn: [-1.7, 0, -3.0],
  parDoorOut: [-3.55, 0, -4.03], parDoorIn: [-4.5, 0, -4.03], parents: [-5.8, 0, -2.6], parBed: [-6.25, 0, -2.6],
  bathDoorOut: [-3.55, 0, 1.1], bathDoorIn: [-4.5, 0, 1.1], bath: [-5.1, 0, 0.75],
  // stairs
  stairsBottom: [-3.44, -3, 0.25],
  // ground
  hallG: [-3.3, -3, 0.9], frontDoor: [-3.05, -3, 1.55], living: [-0.6, -3, 0.35], couch: [-0.6, -3, 0.15],
  diningN: [-0.5, -3, -1.6], diningSeat: [-1.1, -3, -2.15], passE: [-2.6, -3, -4.0], pass: [-3.44, -3, -4.0], kitchenDoor: [-4.5, -3, -4.0],
  kitchen: [-5.9, -3, -3.5], stove: [-4.7, -3, -3.55], fridge: [-7.85, -3, -3.3], kitchenS: [-5.6, -3, -1.7], denN: [-5.6, -3, -0.5], den: [-6.0, -3, 0.65],
  denE: [-4.4, -3, 0.8], garageIn: [1.6, -3, -2.6], garageOut: [2.7, -3.15, -2.6], garage: [4.0, -3.15, -2.9],
  baseTop: [-4.35, -3, -0.4], baseBottom: [-7.5, -5.6, -0.4], basement: [-5.8, -5.6, -2.2], laundry: [-7.3, -5.6, -3.1],
};
const E = [
  ['bedroom', 'bedDoorIn'], ['bedDoorIn', 'bedDoorOut'], ['bedDoorOut', 'hallS'], ['bedDoorOut', 'hallN'], ['hallS', 'bathDoorOut'], ['bathDoorOut', 'bathDoorIn'], ['bathDoorIn', 'bath'],
  ['hallN', 'landing'], ['hallN', 'offDoorOut'], ['offDoorOut', 'offDoorIn'], ['offDoorIn', 'office'], ['landing', 'parDoorOut'], ['parDoorOut', 'parDoorIn'], ['parDoorIn', 'parents'], ['parents', 'parBed'],
  ['landing', 'stairsBottom'], ['stairsBottom', 'hallG'], ['hallG', 'frontDoor'], ['hallG', 'living'], ['living', 'couch'], ['living', 'diningN'], ['diningN', 'diningSeat'],
  ['diningN', 'passE'], ['passE', 'pass'], ['pass', 'kitchenDoor'], ['kitchenDoor', 'kitchen'], ['kitchen', 'stove'], ['kitchen', 'fridge'], ['kitchen', 'kitchenS'], ['kitchenS', 'denN'], ['denN', 'den'],
  ['den', 'denE'], ['denE', 'hallG'], ['diningN', 'garageIn'], ['garageIn', 'garageOut'], ['garageOut', 'garage'], ['denN', 'baseTop'], ['baseTop', 'baseBottom'], ['baseBottom', 'basement'], ['basement', 'laundry'],
];
const ADJ = {};
for (const [a, b] of E) { (ADJ[a] = ADJ[a] || []).push(b); (ADJ[b] = ADJ[b] || []).push(a); }
const V = (k) => new THREE.Vector3(...N[k]);
function path(from, to) {
  const dist = { [from]: 0 }, prev = {}, open = new Set([from]);
  while (open.size) {
    let cur = null; for (const o of open) if (cur === null || dist[o] < dist[cur]) cur = o;
    open.delete(cur);
    if (cur === to) break;
    for (const n of ADJ[cur] || []) { const d = dist[cur] + V(cur).distanceTo(V(n)); if (dist[n] === undefined || d < dist[n]) { dist[n] = d; prev[n] = cur; open.add(n); } }
  }
  const out = []; let c = to; while (c && c !== from) { out.unshift(c); c = prev[c]; } return c === from ? out : [];
}
function nearestNode(pos) { let best = null, bd = Infinity; for (const k in N) { const d = V(k).distanceTo(pos) + Math.abs(N[k][1] - pos.y) * 3; if (d < bd) { bd = d; best = k; } } return best; }

// what each parent is doing right now (real clock)
function plan(who, now = new Date()) {
  const day = now.getDay(), h = now.getHours() + now.getMinutes() / 60, weekend = day === 0 || day === 6;
  const mom = who === 'Mom';
  if (h < 6.5 || h >= 23) return { at: 'parBed', pose: 'sleep', what: 'sleeping' };
  if (h < 7.5) return { at: mom ? 'kitchen' : 'bath', what: mom ? 'making coffee' : 'getting ready' };
  if (!weekend && h < (mom ? 16.5 : 17.5)) return h < 8 ? { at: 'frontDoor', what: 'leaving for work', leave: true } : { away: true, what: 'at work' };
  if (weekend && h < 17) {
    const slot = Math.floor(h * 2) % 4;
    return mom ? [{ at: 'laundry', what: 'doing laundry' }, { at: 'kitchen', what: 'in the kitchen' }, { at: 'den', what: 'reading' }, { at: 'office', what: 'paying bills' }][slot]
      : [{ at: 'garage', what: 'fixing something' }, { at: 'couch', what: 'watching the game', pose: 'sit' }, { at: 'garage', what: 'in the garage' }, { at: 'kitchen', what: 'getting a snack' }][slot];
  }
  if (h < 18.5) return mom ? { at: 'stove', what: 'cooking dinner', cook: true } : { at: 'couch', what: 'watching TV', pose: 'sit' };
  if (h < 19.1) return { at: 'diningSeat', what: 'eating dinner', pose: 'sit', dinner: true };
  if (h < 21) return mom ? { at: 'office', what: 'working on the computer' } : { at: 'couch', what: 'watching TV', pose: 'sit' };
  if (h < 22.5) return { at: 'couch', what: 'watching a movie', pose: 'sit' };
  return { at: 'bath', what: 'brushing teeth' };
}

const LINES = {
  greet: ['Hey kiddo.', 'Hi sweetie!', 'There you are.', 'Hey. Homework done?'],
  chore: ['Did you clean your room yet?', 'Don\'t forget to take your dishes down.', 'You\'re not on that Xbox all day, right?'],
  freak: ['WHAT?! What just happened?!', 'Did you just... SHRINK?!', 'Okay. Okay. That is NOT normal. Give me that watch. NOW.'],
  search: ['Where did you go?!', 'Honey? HONEY! Where are you?!', 'Come out right now!'],
  bug: ['Ew, a bug!', 'Ugh, is that an ant?', 'Gross. Hold on...'],
  shrunk: ['WHAT DID YOU DO TO ME?!', 'Grow me back RIGHT NOW!', 'You are SO grounded when I\'m big again!', 'Please... just make me normal again.'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Parent extends Person {
  constructor(game, o) {
    super(game, { ...o, personality: 'parent' });
    this.isParent = true; this.fullHeight = o.height;
    this.node = nearestNode(this.feet); this.route = []; this.plan = null; this.away = false;
    this.voicePitch = o.name === 'Mom' ? 1.15 : 0.75;
    this.trust = 0.9; this.fear = 0;
  }

  get shrunk() { return this.height < this.fullHeight * 0.8; }

  update(dt) {
    const g = this.game, p = g.player;
    if (this.held) { super.update(dt); return; }
    if (this.shrunk) { this.updateShrunk(dt); return; }
    const pl = plan(this.name);
    this.planNow = pl;
    // leave for work / come home through the front door
    if (pl.away) { if (!this.away) this.setAway(true); return; }
    if (this.away) { this.setAway(false); this.feet.copy(V('frontDoor')); this.node = 'frontDoor'; this.route = []; }
    // events: dinner call, cooking
    if (pl.dinner && !this._dinnerCalled) { this._dinnerCalled = true; phoneNotify(g, this.name, 'Dinner\'s ready! Come down 🍝'); this.say('DINNER!'); }
    if (!pl.dinner) this._dinnerCalled = false;
    if (g.stoveThing) { if (pl.cook && this.node === 'stove' && !this.route.length) g.stoveThing.on = true; else if (this.name === 'Mom' && !pl.cook && g.stoveThing.on && !g.stoveThing._byPlayer) g.stoveThing.on = false; }
    // react to what you do
    if (this.state !== 'confiscate') this.watchPlayer(dt);
    // go where the plan says (or chase you to take the watch)
    let goal = this.state === 'confiscate' ? nearestNode(g.macroFeet()) : pl.at;
    if (goal !== this.goal) { this.goal = goal; this.route = path(this.node, goal); }
    let speed = 0;
    const tgt = this.state === 'confiscate' && this.route.length === 0 ? g.macroFeet().clone() : this.route.length ? V(this.route[0]) : null;
    if (tgt) {
      const d = tgt.clone().sub(this.feet); d.y = 0;
      if (d.length() < (this.route.length ? 0.25 : 0.9)) { if (this.route.length) this.node = this.route.shift(); }
      else { this.yaw += Math.atan2(Math.sin(Math.atan2(d.x, d.z) - this.yaw), Math.cos(Math.atan2(d.x, d.z) - this.yaw)) * Math.min(1, dt * 5); speed = this.state === 'confiscate' ? 1.5 : 1.0; }
    }
    const v = speed * 1.3;
    this.vel.x = Math.sin(this.yaw) * v; this.vel.z = Math.cos(this.yaw) * v;
    this.vel.y = this.grounded ? 0 : this.vel.y - 9.81 * dt;
    const res = this.mover.move(this.feet, this.vel.clone().multiplyScalar(dt), { r: 0.22, h: this.height, grounded: this.grounded, snap: this.grounded, stepH: 0.38, maxSlopeCos: 0.6 });
    this.grounded = res.grounded;
    // sleeping: lie down in bed
    const sleeping = pl.pose === 'sleep' && !this.route.length && this.node === 'parBed';
    this.sleeping = sleeping;
    this.model.root.position.copy(this.feet);
    if (sleeping) {
      const off = this.name === 'Mom' ? -0.45 : 0.45;
      this.model.root.position.set(-7.3 + 0.9, 0.62, -2.6 + off); this.model.root.rotation.set(0, -Math.PI / 2, -Math.PI / 2); this.model.root.rotateX(0);
      this.headPos = new THREE.Vector3(-8.15, 0.72, -2.6 + off);
    } else { this.model.root.rotation.set(0, this.yaw, 0); this.headPos = null; }
    this.body.setNextKinematicTranslation({ x: this.feet.x, y: this.feet.y + this.height / 2, z: this.feet.z });
    this.model.animate(dt, speed, pl.pose === 'sit' && !speed ? 'sit' : 'walk', g.time);
    this.sayT = Math.max(0, (this.sayT || 0) - dt);
    this.model.mouth.scale.y = this.sayT > 0 ? 1 + Math.abs(Math.sin(g.time * 18)) * 3 : 1;
    // confiscation: reach you while you're normal-ish size
    if (this.state === 'confiscate') {
      const d = this.feet.distanceTo(g.macroFeet());
      if (d < 1.2 && g.realS() > 0.5 && !g.micro) this.takeWatch();
      if (g.realS() < 0.2 && g.time > (this._searchCd || 0)) { this._searchCd = g.time + 6; this.say(pick(LINES.search)); }
      if (g.time > this.confiscateUntil) { this.state = 'idle'; this.say('...I must be losing my mind.'); }
    }
  }

  setAway(a) {
    this.away = a; this.model.root.visible = !a; this.collider.setEnabled(!a);
    if (a) this.feet.set(-3.0, -3, 2.5);
  }

  canSee(target) {
    if (this.away || this.sleeping) return false;
    const eye = this.feet.clone(); eye.y += this.height * 0.93;
    const to = target.clone().sub(eye), d = to.length();
    if (d > 9) return false;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (fwd.dot(to.clone().setY(0).normalize()) < 0.25) return false;
    const ray = new R.Ray(eye, to.clone().normalize());
    const hit = world.castRay(ray, d - 0.05, true, R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.collider);
    return !hit;
  }

  watchPlayer(dt) {
    const g = this.game, p = g.player;
    if (g.micro) return;
    const real = p.height;
    // 1) seeing the watch in action
    if (g.watch.changing && real > 0.02 && !this.caughtOnce && this.canSee(p.center(new THREE.Vector3()))) {
      this.caughtOnce = true; this.state = 'confiscate'; this.confiscateUntil = g.time + 90;
      this.say(pick(LINES.freak)); sfx.thud(0.4, 1.4);
      g.ui.toast(`😱 ${this.name} SAW you change size!`, 4);
      return;
    }
    const d = this.feet.distanceTo(p.feet);
    // 2) tiny you near their feet: they can't see you - watch out!
    if (real < 0.05 && d < 1.2 && this.vel.lengthSq() > 0.1) {
      if (!this._feetTip) { this._feetTip = 1; g.ui.toast('👣 Giant feet coming! They can\'t see you at this size.', 3); }
      if (d < 0.18 && p.feet.y < this.feet.y + 0.05 && g.time > (this._stepCd || 0)) { this._stepCd = g.time + 2; p.hurt(65, 'stepped on'); sfx.thud(1, 0.6); }
    }
    // 3) ant-sized you on a table/counter in plain view: "a bug!"
    if (real < 0.012 && real > 0.0005 && d < 1.6 && p.feet.y > this.feet.y + 0.5 && this.canSee(p.center(new THREE.Vector3()))) {
      this._bugT = (this._bugT || 0) + dt;
      if (this._bugT > 0.5 && !this._bugSaid) { this._bugSaid = true; this.say(pick(LINES.bug)); g.ui.toast('🪳 They think you\'re a bug! MOVE!', 3); this._bugAt = p.feet.clone(); }
      if (this._bugT > 2.5) {
        this._bugT = 0; this._bugSaid = false; sfx.thud(1, 1.2);
        if (p.feet.distanceTo(this._bugAt) < 0.08) p.hurt(80, 'swatted'); else this.say('Missed it...');
      }
    } else { this._bugT = 0; this._bugSaid = false; }
    // 4) say hi sometimes when you're normal size
    if (real > 1.2 && d < 2.5 && g.time > (this._greetCd || 0) && this.canSee(p.head(new THREE.Vector3()))) { this._greetCd = g.time + 60; this.say(pick(Math.random() < 0.6 ? LINES.greet : LINES.chore)); }
  }

  takeWatch() {
    const g = this.game;
    this.state = 'idle';
    g.watch.confiscated = true;
    if (g.player.s !== 1) g.player.setScale(1);
    this.say('This goes in MY dresser. You\'re grounded, mister. No allowance this week.');
    g.grounded = true;
    g.ui.toast('⌚ The watch got confiscated! It\'s in your parents\' dresser... sneak it back.', 6);
    g.interactables.push({
      name: 'Take the watch back (sneaky...)', thing: g.dresser, local: new THREE.Vector3(0, 0.9, 0), radius: 0.4,
      use: () => {
        if (!g.watch.confiscated) return;
        if (g.parents.some((pp) => !pp.away && !pp.sleeping && pp.canSee(g.player.head(new THREE.Vector3())))) { g.ui.toast('👀 Not while they\'re watching!'); return; }
        g.watch.confiscated = false; sfx.click(0.5); g.ui.toast('⌚ Got the watch back! Don\'t get caught again.', 4);
      },
    });
  }

  updateShrunk(dt) {
    const g = this.game;
    super.update(dt); // tiny-person behaviour (flees giants, can be picked up, talks)
    if (g.time > (this._yellCd || 0)) { this._yellCd = g.time + 8; this.say(pick(LINES.shrunk)); }
  }
}

export function buildParents(game) {
  game.parents = [
    new Parent(game, { name: 'Mom', height: 1.66, pos: N.kitchen, seed: 5, look: { skin: '#e8b892', hair: '#5a3a1e', hairStyle: 'long', top: '#7a4f7a', pants: '#2b3a55', shoes: '#ddd' } }),
    new Parent(game, { name: 'Dad', height: 1.8, pos: N.couch, seed: 9, look: { skin: '#e8b892', hair: '#2b1d14', hairStyle: 'short', top: '#3f5f5a', pants: '#3b3a36', shoes: '#3b2a1e' } }),
  ];
  for (const p of game.parents) game.people.push(p);
  return game.parents;
}

// what parents say when you talk to them
export function parentReply(p, text, ctx) {
  const t = text.toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (p.shrunk) {
    if (has('sorry')) return 'Sorry isn\'t going to make me big again!';
    if (has('grow', 'big', 'fix')) return 'YES. Do it. Now. Carefully.';
    return pick(LINES.shrunk);
  }
  if (ctx.ratio < 0.2) return 'Is someone talking? ...Must be the TV.';
  if (has('hi', 'hello', 'hey', 'yo', 'wsp')) return pick(LINES.greet);
  if (has('money', 'allowance', 'cash')) return p.game.grounded ? 'You\'re grounded. No allowance this week.' : 'Allowance is on Saturday. Do your chores!';
  if (has('chore', 'help', 'do')) return 'Clean your room and bring your dishes down. That\'s $5 each.';
  if (has('watch')) return p.game.watch.confiscated ? 'That watch is staying locked up until we figure out what it is.' : 'What watch? Where\'d you get that?';
  if (has('dinner', 'food', 'hungry', 'eat')) return 'Dinner is at 6:30. There are snacks in the pantry.';
  if (has('love')) return 'Love you too, kiddo.';
  if (has('pet', 'dog', 'cat')) return 'If you want a pet, you buy it with your own money. And YOU take care of it.';
  if (has('where', 'doing')) return `I'm ${p.planNow ? p.planNow.what : 'busy'}.`;
  return pick(['Mm-hm.', 'Okay, sweetie.', 'We\'ll talk about it later.', 'Did you finish your homework?']);
}
