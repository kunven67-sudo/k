// Lemonade stand (master list §3 kid hustles). Buy the stuff at Walmort (lemons + sugar, or a
// tub of mix, plus cups; ice makes it way better on hot days), use the folding table in the
// garage, pick your price and set up at the end of the driveway. People walking by decide for
// real reasons: hot day or cold, the price, if they're nice to kids, if they like you, if
// they have money on them. Pack up to count your money.
//
//   const stand = new LemonadeStand(life)    // listens to 'lemonade:open'

import * as THREE from 'three';
import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { el } from '../core/util.js';
import { assets } from '../gfx/assets.js';
import { audio } from '../core/audio.js';
import { openPanel, row } from '../ui/panel.js';
import { me } from './me.js';
import { PRODUCT, priceText } from './products.js';
import { CURB, LOTS } from '../world/layout.js';

const LOT = LOTS.find((l) => l.family);
const CUPS_PER = { lemons: 2.5, mix: 20, sugar: 40, cups: 50, ice: 20 }; // cups one item makes
const LINES = {
  buy: ['One please!', "Ooh, lemonade! I'll take one.", 'How could I say no to that face. One cup.', 'Perfect, I was dying out here.', "Here you go, keep the change."],
  good: ['Mmm, that hits the spot.', 'Wow, that\'s good!', 'Fresh! You made this?', 'Nice and cold, thanks!'],
  meh: ['...Little sour. Thanks though.', "It's okay. Needs more sugar.", 'Warm lemonade, huh.'],
  pass: ['Not today, sorry!', 'Ha, maybe later kid.', 'Good luck!', 'Cute stand!'],
};

save.registerSlice('lemonade', { create: () => ({ total: 0, cupsSold: 0, best: 0, days: 0 }) });

export class LemonadeStand {
  constructor(life) {
    this.life = life;
    this.open = null; // { price, cups, ice, sugar, sold, money, served:Set }
    this.group = null;
    this._offs = [bus.on('lemonade:open', () => this.menu())];
    assets.preload([
      ['furniture', 'table'],
      ['furniture', 'chair'],
      ['food', 'lemon'],
      ['food', 'glass'],
      ['food', 'cup'],
    ]);
  }

  get world() {
    return this.life.world;
  }

  /** What you have for lemonade (in your bag + at home). */
  supplies() {
    const have = {};
    const count = (id, n) => {
      const kind = PRODUCT[id]?.lemonade;
      if (kind) have[kind] = (have[kind] || 0) + n;
    };
    for (const it of me.items()) if (it.paid) count(it.id, 1);
    for (const [id, n] of Object.entries(me.data.owned)) count(id, n);
    // Mom's lemons in the fridge count too (she'll notice, but it's for a good cause).
    const fridge = this.life.home.d.fridge || {};
    for (const [id, n] of Object.entries(fridge)) if (PRODUCT[id]?.lemonade) count(id, n / (PRODUCT[id]?.food?.servings || 1));
    return have;
  }

  /** How many cups you can make. */
  canMake(h) {
    const cups = Math.floor((h.cups || 0) * CUPS_PER.cups);
    const fromMix = Math.floor((h.mix || 0) * CUPS_PER.mix);
    const fromLemons = Math.min(Math.floor((h.lemons || 0) * CUPS_PER.lemons), Math.floor((h.sugar || 0) * CUPS_PER.sugar));
    return { drink: fromMix + fromLemons, cups, total: Math.min(cups, fromMix + fromLemons), fresh: fromLemons > 0, sugar: (h.sugar || 0) > 0 || fromMix > 0 };
  }

  menu() {
    if (this.open) return this.packUp();
    const h = this.supplies();
    const m = this.canMake(h);
    const p = openPanel({ title: 'Lemonade stand', sub: 'Set up at the end of the driveway' });
    let price = 0.5;
    const render = () => {
      const lines = [
        row('Lemons', h.lemons ? `${Math.floor(h.lemons)} (about ${Math.floor(h.lemons * CUPS_PER.lemons)} cups)` : 'none'),
        row('Sugar', h.sugar ? 'yes' : 'none (lemons need sugar)'),
        row('Lemonade mix', h.mix ? `${Math.floor(h.mix)} tub${h.mix >= 2 ? 's' : ''} (${Math.floor(h.mix * CUPS_PER.mix)} cups)` : 'none'),
        row('Cups', h.cups ? `${Math.floor(h.cups * CUPS_PER.cups)}` : 'none'),
        row('Ice', h.ice ? 'yes (cold = more sales on hot days)' : 'none'),
      ];
      const why = m.total > 0 ? null : !h.cups ? 'You need cups. Walmort sells them.' : m.drink === 0 ? 'You need lemons + sugar, or a tub of lemonade mix (Walmort).' : null;
      p.setBody([
        el('div', { class: 'rl-list' }, lines),
        el('p', { class: 'rl-note' }, [why || `You can make ${m.total} cups. Price per cup:`]),
        m.total > 0
          ? el('div', { class: 'talk-chips' }, [0.25, 0.5, 0.75, 1, 1.5, 2].map((v) => el('button', { style: v === price ? 'background:var(--ink);color:#fff' : '', onclick: () => ((price = v), render()) }, [priceText(v)])))
          : null,
      ]);
      p.setButtons(m.total > 0 ? [{ text: 'Cancel', onClick: () => p.close() }, { text: `Set up (${priceText(price)} a cup)`, kind: 'go', onClick: () => (p.close(), this.setUp(price, h, m)) }] : [{ text: 'Okay', kind: 'go', onClick: () => p.close() }]);
    };
    render();
  }

  setUp(price, h, m) {
    const wealthy = ['rich', 'veryrich'].includes(save.life.family.house.wealth);
    // Use up the supplies for the pitcher(s).
    const used = { cups: m.total / CUPS_PER.cups, ice: h.ice ? 1 : 0 };
    if (m.fresh) {
      const lemonCups = Math.min(m.total, Math.floor((h.lemons || 0) * CUPS_PER.lemons));
      used.lemons = Math.ceil(lemonCups / CUPS_PER.lemons);
      used.sugar = lemonCups / CUPS_PER.sugar;
      used.mix = Math.max(0, (m.total - lemonCups) / CUPS_PER.mix);
    } else used.mix = m.total / CUPS_PER.mix;
    this._consume(used);
    this.open = { price, cups: m.total, ice: !!h.ice, fresh: m.fresh, sold: 0, money: 0, served: new Set(), started: clock.total, wealthy };
    this.life.skip(10, { fade: true });
    setTimeout(() => this._build(), 600);
    this.life.hud.toast(`You set up the stand: ${m.total} cups at ${priceText(price)}. Stay at the stand to sell.`, 5000);
  }

  /** Take whole items for what the pitcher used (partial ones stay "opened" = gone). */
  _consume(used) {
    for (const [kind, amount] of Object.entries(used)) {
      let left = Math.ceil(amount - 1e-6);
      if (left <= 0) continue;
      const takeFrom = (list) => {
        for (let i = list.length - 1; i >= 0 && left > 0; i--) {
          if (PRODUCT[list[i].id]?.lemonade === kind && list[i].paid) {
            me.removeItem(list[i]);
            left--;
          }
        }
      };
      takeFrom([...me.data.bag]);
      for (const [id, n] of Object.entries(me.data.owned)) {
        if (left <= 0) break;
        if (PRODUCT[id]?.lemonade !== kind) continue;
        const k = Math.min(n, left);
        me.data.owned[id] -= k;
        if (me.data.owned[id] <= 0) delete me.data.owned[id];
        left -= k;
      }
      const fridge = this.life.home.d.fridge;
      for (const id of Object.keys(fridge)) {
        if (left <= 0) break;
        if (PRODUCT[id]?.lemonade !== kind) continue;
        const per = PRODUCT[id]?.food?.servings || 1;
        const k = Math.min(fridge[id], left * per);
        fridge[id] -= k;
        left -= Math.ceil(k / per);
      }
    }
  }

  _build() {
    const g = new THREE.Group();
    const at = new THREE.Vector3(LOT.x + 7.5, CURB, -8.2);
    g.position.copy(at);
    const table = assets.model('furniture', 'table');
    table.scale.multiplyScalar(0.78);
    g.add(table);
    const tb = new THREE.Box3().setFromObject(table);
    table.position.set(-(tb.min.x + tb.max.x) / 2, 0, -(tb.min.z + tb.max.z) / 2);
    const top = tb.max.y;
    // Hand-painted sign taped to the front.
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#fff6c9';
    x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#f2c230';
    x.lineWidth = 14;
    x.strokeRect(8, 8, 496, 240);
    x.fillStyle = '#e8a013';
    x.font = 'bold 92px "Comic Sans MS", "Chalkboard SE", cursive';
    x.textAlign = 'center';
    x.fillText('LEMONADE', 256, 118);
    x.fillStyle = '#d23b2a';
    x.font = 'bold 84px "Comic Sans MS", "Chalkboard SE", cursive';
    const pr = this.open.price;
    x.fillText(pr < 1 ? `${Math.round(pr * 100)}¢` : `$${pr.toFixed(pr % 1 ? 2 : 0)}`, 256, 215);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sw = Math.min(0.9, (tb.max.x - tb.min.x) * 0.92);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    sign.position.set(0, top - sw / 4 - 0.03, tb.max.z - (tb.min.z + tb.max.z) / 2 + 0.012);
    g.add(sign);
    // Pitcher (glass of lemonade, big) + cups + lemons.
    const pitcher = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 18), new THREE.MeshStandardMaterial({ color: 0xf7e36b, roughness: 0.15, transparent: true, opacity: 0.85 }));
    pitcher.position.set(-0.2, top + 0.12, 0);
    g.add(pitcher);
    for (let i = 0; i < 4; i++) {
      const cup = assets.model('food', 'cup');
      cup.scale.multiplyScalar(0.55);
      cup.position.set(0.12 + (i % 2) * 0.1, top, -0.06 + Math.floor(i / 2) * 0.1);
      g.add(cup);
    }
    for (let i = 0; i < 3; i++) {
      const l = assets.model('food', 'lemon');
      l.position.set(-0.42 + i * 0.07, top, 0.08 - (i % 2) * 0.05);
      g.add(l);
    }
    const chair = assets.model('furniture', 'chair');
    chair.rotation.y = 0;
    chair.position.set(0, 0, -0.75);
    g.add(chair);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.world.scene.add(g);
    this.group = g;
    this.at = at;
    // A spot for customers to walk up to (front, on the sidewalk side).
    const nav = this.life.people.nav;
    this.customerNode = nav.add(at.clone().add(new THREE.Vector3(0, 0, 0.95)), { tag: 'walk' });
    nav.link(this.customerNode, nav.nearest(at.clone().setZ(-6.2), (n) => n.tag === 'walk' && n.id !== this.customerNode));
    this.seat = { at: at.clone().add(new THREE.Vector3(0, 0.45, -0.72)), faceYaw: 0, label: 'stand chair' };
    this._it = this.world.interact.add({
      kind: 'lemonade',
      box: new THREE.Box3().setFromCenterAndSize(at.clone().setY(at.y + 0.5), new THREE.Vector3(1.2, 1.1, 0.9)),
      label: () => (this.open ? `Lemonade stand (${this.open.cups - this.open.sold} cups left, ${priceText(this.open.money)})` : 'Lemonade stand'),
      use: () => this.life.player.sitOn(this.seat, 'sit'),
      alt: { key: 'F', text: 'Pack up' },
      useAlt: () => this.packUp(),
    });
  }

  /** Every frame: people walking by may come over. */
  update(dt) {
    const o = this.open;
    if (!o || !this.group) return;
    const pl = this.life.player.position;
    const manned = pl.distanceTo(this.at) < 3.2;
    const people = this.life.people;
    // Customers on their way / buying.
    for (const n of people.npcs) {
      if (n.away || n.rec.role === 'staff') continue;
      if (n._lemonade === 'walking') {
        if (n.goal !== this.customerNode) n._lemonade = 'done'; // something else came up
        else if (n.arrived) this._sell(n);
        continue;
      }
      if (n._lemonade || o.served.has(n.id) || !manned) continue;
      if (o.sold >= o.cups) continue;
      if (n.pos.distanceTo(this.at) > 10 || n.activity?.kind === 'sleep' || n.talkingTo) continue;
      o.served.add(n.id);
      if (this._wants(n)) {
        n._lemonade = 'walking';
        n.goTo(this.customerNode, { kind: 'stand', yaw: Math.PI, lemonade: true });
      } else if (n.pos.distanceTo(pl) < 9 && n.rec.age > 12) people.say(n, pick(LINES.pass, n));
    }
  }

  /** A real decision: thirst/weather, price vs. who they are, kindness, opinion of you. */
  _wants(n) {
    const o = this.open;
    const R = n.rec;
    const people = this.life.people;
    const op = people.memory(n).opinion;
    const s = clock.season;
    const hot = s === 'summer' ? 0.4 : s === 'spring' ? 0.15 : s === 'fall' ? 0 : -0.45;
    const rain = (this.world.weather?.rain || 0) > 0.3 ? -0.6 : 0;
    const budget = R.age < 10 ? 0.5 : R.age < 16 ? 1.5 : R.role === 'retiree' ? 2 : 3;
    if (o.price > budget) return false; // they just don't have that on them / won't pay that
    const priceK = (o.price / budget) * 0.6;
    const family = R.family ? 0.5 : 0;
    const score = 0.25 + hot + rain + (R.traits.warmth - 0.5) * 0.6 + (op / 100) * 0.4 + (o.ice && s === 'summer' ? 0.15 : 0) - priceK + family + (n.mood === 'angry' ? -0.4 : 0);
    return score > 0.4;
  }

  _sell(n) {
    const o = this.open;
    n._lemonade = 'done';
    if (o.sold >= o.cups) {
      this.life.people.say(n, 'Aw, sold out? Next time!');
      this.life.people.resume(n);
      return;
    }
    const tip = n.rec.traits.warmth > 0.75 && n.rec.age > 25 && o.price < 1 ? 0.25 : 0;
    const paid = o.price + tip;
    o.sold++;
    o.money = Math.round((o.money + paid) * 100) / 100;
    me.addCash(paid, 'lemonade');
    audio.play?.('coins', { gain: 0.5, position: this.at });
    const people = this.life.people;
    people.memory(n).opinion = Math.min(100, people.memory(n).opinion + 2);
    people.memory(n).met = true;
    n.body?.play('interact');
    people.say(n, pick(LINES.buy, n));
    const good = o.fresh ? (o.ice || clock.season !== 'summer') : o.ice;
    setTimeout(() => {
      if (!n.away) people.say(n, pick(good ? LINES.good : LINES.meh, n));
      n.body?.play('drink');
    }, 2200);
    setTimeout(() => people.resume(n), 3200); // back to where they were going
    if (o.sold >= o.cups) this.life.hud.toast('Sold out! Pack up the stand (F).', 4000);
  }

  packUp() {
    const o = this.open;
    if (!o) return;
    const d = save.slice('lemonade');
    d.total += o.money;
    d.cupsSold += o.sold;
    d.best = Math.max(d.best, o.money);
    d.days++;
    const hours = (clock.total - o.started) / 60;
    this.open = null;
    for (const n of this.life.people.npcs) n._lemonade = null;
    if (this.group) {
      this.world.scene.remove(this.group);
      this.group.traverse((x) => x.material?.map?.dispose?.());
      this.group = null;
    }
    if (this._it) this.world.interact.remove(this._it);
    this._it = null;
    if (this.life.player.seat?.label === 'stand chair') this.life.player.stand();
    const p = openPanel({ title: 'Stand closed', sub: `${hours.toFixed(1)} hours` });
    p.setBody([
      el('div', { class: 'rl-list' }, [
        row('Cups sold', `${o.sold} of ${o.cups}`),
        row('Money made', priceText(o.money)),
        row('Best day so far', priceText(d.best)),
      ]),
      el('p', { class: 'rl-note' }, [o.sold === 0 ? (clock.season === 'winter' ? 'Nobody wants lemonade when it\'s freezing out. Try a hot day!' : 'Nobody came by... try when more people are out walking (after school, evenings, weekends).') : o.money > 10 ? 'Nice! That\'s real money.' : 'Not bad for a lemonade stand.']),
    ]);
    p.setButtons([{ text: 'Done', kind: 'go', onClick: () => p.close() }]);
    bus.emit('lemonade:closed', { sold: o.sold, money: o.money });
  }

  dispose() {
    for (const off of this._offs) off();
    if (this.group) this.world.scene.remove(this.group);
    if (this._it) this.world.interact.remove(this._it);
  }
}

function pick(arr, n) {
  return arr[(n.rec.name.length * 7 + Math.floor(clock.total)) % arr.length];
}
