// Money, allowance, chores, the online shop + deliveries, and selling stuff. All realistic:
// allowance is on Saturday (real date), deliveries come to your bedroom door with a knock,
// and pets cost real-ish money.
import * as THREE from 'three';
import { phoneNotify } from '../world/objects/phone.js';
import { sfx } from '../core/audio.js';
import { Thing } from '../world/thing.js';
import { things } from '../world/thing.js';

export const SHOP = [
  { id: 'cat', cat: 'Pets', icon: '🐱', name: 'Cat (adopted, 2 yrs)', price: 75, pet: 'cat' },
  { id: 'dog', cat: 'Pets', icon: '🐶', name: 'Dog (beagle puppy)', price: 150, pet: 'dog' },
  { id: 'hamster', cat: 'Pets', icon: '🐹', name: 'Hamster + cage', price: 35, pet: 'hamster' },
  { id: 'fish', cat: 'Pets', icon: '🐟', name: 'Goldfish + tank', price: 25, pet: 'fish' },
  { id: 'lizard', cat: 'Pets', icon: '🦎', name: 'Leopard gecko + terrarium', price: 90, pet: 'lizard' },
  { id: 'antfarm', cat: 'Pets', icon: '🐜', name: 'Ant farm', price: 20, pet: 'antfarm' },
  { id: 'basketball', cat: 'Stuff', icon: '🏀', name: 'Basketball', price: 25, spawn: 'basketball' },
  { id: 'lego', cat: 'Stuff', icon: '🧱', name: 'LEGO bricks (10)', price: 15, spawn: 'lego', count: 10 },
  { id: 'car', cat: 'Stuff', icon: '🚗', name: 'Toy car', price: 8, spawn: 'car' },
  { id: 'duck', cat: 'Stuff', icon: '🦆', name: 'Rubber duck', price: 4, spawn: 'duck' },
  { id: 'controller', cat: 'Stuff', icon: '🕹️', name: 'Controller', price: 60, spawn: 'controller' },
  { id: 'soda', cat: 'Food', icon: '🥫', name: 'Soda (sealed)', price: 2, spawn: 'sodaClosed' },
  { id: 'chips', cat: 'Food', icon: '🥔', name: 'Chips', price: 3, spawn: 'chips' },
  { id: 'pizza', cat: 'Food', icon: '🍕', name: 'Pizza slice', price: 4, spawn: 'pizza' },
  { id: 'cookie', cat: 'Food', icon: '🍪', name: 'Cookies (3)', price: 3, spawn: 'cookie', count: 3 },
  { id: 'wipes', cat: 'Cleaning', icon: '🧻', name: 'Disinfecting wipes', price: 5, clean: 'wipes' },
  { id: 'sanitizer', cat: 'Cleaning', icon: '🧴', name: 'Hand sanitizer', price: 3, clean: 'sanitizer' },
];
export const CHORES = [
  { id: 'room', name: 'Clean your room (fewer than 4 things on the floor)', pay: 5 },
  { id: 'dishes', name: 'Bring a mug or cup down to the kitchen sink', pay: 5 },
  { id: 'lights', name: 'Turn off lights in empty rooms (save electricity)', pay: 2 },
];
const DELIVERY_TIME = 90; // seconds ("same-day delivery")

export class Economy {
  constructor(game) {
    this.game = game;
    this.money = 40;
    this.log = [{ t: Date.now(), what: 'Starting balance', amt: 40 }];
    this.orders = [];
    this.messages = [{ from: 'Mom', text: 'Have a good day at school! Clean your room 🙂', t: Date.now() - 3600e3 }];
    this.choresDone = {};
    this.lastAllowance = null;
    this.timer = 0;
  }

  add(amt, what) {
    this.money = Math.round((this.money + amt) * 100) / 100;
    this.log.unshift({ t: Date.now(), what, amt });
    phoneNotify(this.game, 'Bank', `${amt >= 0 ? '+' : '-'}$${Math.abs(amt).toFixed(2)} ${what}. Balance $${this.money.toFixed(2)}`);
  }
  text(from, text) { this.messages.unshift({ from, text, t: Date.now() }); phoneNotify(this.game, from, text); }

  buy(item) {
    if (this.money < item.price) return `Not enough money ($${this.money.toFixed(2)})`;
    this.add(-item.price, `${item.name} (online order)`);
    this.orders.push({ item, eta: this.game.time + DELIVERY_TIME, stage: 0 });
    setTimeout(() => this.text('ShopNow', `📦 ${item.name} is out for delivery! Arriving today.`), 4000);
    return null;
  }

  update(dt) {
    const g = this.game;
    this.timer += dt;
    // deliveries: a parent brings the box up and knocks on your door
    for (const o of this.orders) {
      if (o.stage === 0 && g.time > o.eta) {
        o.stage = 1;
        sfx.knock(); this._lastKnock = g.time;
        this.text('ShopNow', `✅ Delivered: ${o.item.name}. Left at your bedroom door.`);
        g.ui.toast('🚪 *knock knock* Your package is at your door!', 4);
        this.spawnPackage(o.item);
      }
    }
    this.orders = this.orders.filter((o) => o.stage === 0);
    if (this.timer < 2) return; this.timer = 0;
    // germs slowly come back on everything (realistic: bacteria re-colonize surfaces within hours)
    this.germT = (this.germT || 0) + 2;
    if (this.germT > 30) { this.germT = 0; for (const t of things) if (t.dirt !== null && t.dirt !== undefined && t.dirt < 1) t.dirt = Math.min(1, t.dirt + 0.004); }
    // weekly allowance on Saturday (real date)
    const now = new Date(), key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (now.getDay() === 6 && this.lastAllowance !== key) {
      this.lastAllowance = key;
      if (g.grounded) { this.text('Dad', 'No allowance this week. You know why.'); g.grounded = false; }
      else this.add(20, 'Weekly allowance from Mom & Dad');
    }
    // chores
    this.checkChores();
  }

  checkChores() {
    const g = this.game, room = { x0: -2, x1: 2, z0: -1.8, z1: 1.8 };
    const dayKey = new Date().toDateString();
    const done = (id) => this.choresDone[id] === dayKey;
    const finish = (c) => { this.choresDone[c.id] = dayKey; this.add(c.pay, `Chore: ${c.name.split(' (')[0]}`); };
    // room: count loose spawned things lying on the bedroom floor
    if (!done('room')) {
      let n = 0, any = false;
      for (const t of things) {
        if (!t.spawned || !t.body) continue; any = true;
        const p = t.body.translation();
        if (p.x > room.x0 && p.x < room.x1 && p.z > room.z0 && p.z < room.z1 && p.y < 0.15 && p.y > -0.1) n++;
      }
      if (any && n < 4 && this._roomWasMessy) finish(CHORES[0]);
      if (n >= 6) this._roomWasMessy = true;
    }
    if (!done('dishes')) {
      for (const t of things) {
        if (t.spawnId !== 'cup' || !t.body) continue;
        const p = t.body.translation();
        if (Math.abs(p.x + 6.2) < 0.32 && Math.abs(p.z + 4.15) < 0.22 && p.y < -2.0) { finish(CHORES[1]); break; }
      }
    }
  }

  spawnPackage(item) {
    const g = this.game;
    // a cardboard box by your bedroom door (in the hallway side of the doorway)
    const box = new Thing({ name: `Package: ${item.name}`, type: 'dynamic', density: 150, pos: [-1.6, 0.05, -1.25], icon: '📦', surface: 'paper' });
    const c = 'cardboard', T = 0.006, w = item.pet === 'dog' || item.pet === 'cat' ? 0.6 : 0.4;
    box.box([w, T, w * 0.7], [0, T / 2, 0], c); box.box([w, w * 0.6, T], [0, w * 0.3, w * 0.35 - T / 2], c); box.box([w, w * 0.6, T], [0, w * 0.3, -w * 0.35 + T / 2], c);
    box.box([T, w * 0.6, w * 0.7], [w / 2 - T / 2, w * 0.3, 0], c); box.box([T, w * 0.6, w * 0.7], [-w / 2 + T / 2, w * 0.3, 0], c);
    box.box([w, T, w * 0.7], [0, w * 0.6, 0], c, { cut: 'tape seal' });
    box.box([0.05, T * 1.2, w * 0.71], [0, w * 0.6 + 0.001, 0], colorTape(), { collide: false, cut: 'tape seal' });
    box.build(g.engine.scene);
    box.spawned = true; box.package = item;
    g.interactables.push({
      name: `Open package (${item.name})`, thing: box, local: new THREE.Vector3(0, w * 0.6, 0), radius: w * 0.5,
      use: () => this.openPackage(box),
    });
  }

  openPackage(box) {
    const g = this.game, item = box.package; if (!item || box.opened) return;
    box.opened = true;
    const p = box.position(new THREE.Vector3());
    box.detach('tape seal', g.engine.scene);
    sfx.tick(0.4, 0.7);
    if (item.pet) { g.pets?.adopt(item.pet, p); g.ui.toast(`${item.icon} Your new ${item.name.split(' (')[0].split(' +')[0]}!`, 4); }
    else if (item.spawn) { for (let i = 0; i < (item.count || 1); i++) g.spawner.spawn(item.spawn, [p.x + (Math.random() - 0.5) * 0.15, p.y + 0.35 + i * 0.03, p.z + (Math.random() - 0.5) * 0.15]); }
    else if (item.clean) { g.cleaning = g.cleaning || {}; g.cleaning[item.clean] = (g.cleaning[item.clean] || 0) + (item.clean === 'wipes' ? 20 : 1); g.ui.toast(item.clean === 'wipes' ? '🧻 20 wipes! Tool 6 (🧽): click something to wipe the germs off it.' : '🧴 Sanitizer! Tool 6 (🧽): press E to clean your hands.', 5); }
  }

  sell(t) {
    const prices = { controller: 30, phone: 120, xbox: 200, soda: 0.5, sodaClosed: 1, basketball: 10, lego: 0.3, car: 3, duck: 1, chair: 15, table: 25, keyboard: 12, mouse: 6 };
    const price = prices[t.spawnId] ?? 2;
    t.remove(this.game.engine.scene);
    this.add(price, `Sold ${t.name} online`);
    return price;
  }
}

let tapeMat = null;
function colorTape() { if (!tapeMat) tapeMat = new THREE.MeshStandardMaterial({ color: 0xc9a66b, roughness: 0.4, transparent: true, opacity: 0.85 }); return tapeMat; }
