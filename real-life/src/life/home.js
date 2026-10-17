// Using your house (master list §5, §7, §9, §29): fridge, food, toilet, shower, sinks, beds +
// sleeping, couch (and the coins that fall into it), TV channels, radio, piggy bank, dressers,
// the cookie jar, the garage fridge with the adults' beer.
//
// Nothing is random: coins are in the couch because Dad sat there with change in his pocket,
// the fridge has what the family bought, beer goes missing because someone took it.

import * as THREE from 'three';
import { el } from '../core/util.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { me } from './me.js';
import { PRODUCT, priceText } from './products.js';
import { openPanel, row } from '../ui/panel.js';
import { Tv } from './tv.js';

// What a family keeps in the fridge/pantry by wealth (ids from products.js).
const STOCK = {
  house: {
    poor: { milk: 1, bread: 1, eggs: 1, 'peanut-butter': 1, 'cereal-oats': 1, banana: 2, 'microwave-meal': 2, 'water-bottle': 4 },
    working: { milk: 1, bread: 1, eggs: 1, cheese: 1, 'cereal-frosted': 1, apple: 3, banana: 3, 'microwave-meal': 2, 'pizza-frozen': 1, 'koka-12': 1, 'water-bottle': 6, 'oj': 1 },
    middle: { milk: 1, bread: 1, eggs: 1, cheese: 1, yogurt: 4, 'cereal-loops': 1, 'cereal-oats': 1, apple: 4, banana: 4, grapes: 1, 'pizza-frozen': 1, nuggets: 1, 'ice-cream': 1, 'koka-12': 1, 'water-case': 1, oj: 1, 'choc-milk': 1, 'chips-leys': 1 },
    rich: { milk: 1, 'choc-milk': 1, bread: 1, eggs: 1, cheese: 1, yogurt: 6, 'cereal-loops': 1, 'cereal-frosted': 1, apple: 5, orange: 4, grapes: 1, watermelon: 1, 'pizza-frozen': 2, nuggets: 1, 'ice-cream': 2, popsicles: 1, 'koka-12': 1, 'water-case': 1, oj: 1, gatorayd: 4, 'chips-doritoz': 1, oreoz: 1 },
  },
  garage: { poor: { 'water-bottle': 2 }, working: { 'koka-12': 1, 'beer-12': 1 }, middle: { 'beer-12': 1, 'koka-12': 1, 'water-case': 1 }, rich: { 'beer-12': 1, gatorayd: 6, 'koka-12': 1, 'water-case': 1 } },
};

save.registerSlice('home', {
  create: (life) => {
    const wealth = life?.family?.house?.wealth || 'middle';
    const w = wealth === 'veryrich' ? 'rich' : wealth;
    const toUnits = (o) => Object.fromEntries(Object.entries(o).map(([id, n]) => [id, n * (PRODUCT[id]?.food?.servings || 1)]));
    return {
      fridge: toUnits(STOCK.house[w] || STOCK.house.middle),
      garage: toUnits(STOCK.garage[w] || STOCK.garage.middle),
      cookies: 14,
      couchCoins: 0.35,
      parentsCash: wealth === 'poor' ? 8 : wealth === 'working' ? 20 : wealth === 'middle' ? 40 : 100,
      tv: { on: false, channel: 0 },
      radio: { on: false, station: 0 },
      dishes: 0,
      trash: 0.3,
      lastSearch: { couch: -1, dresser: -1 },
      missing: {}, // what parents would notice is gone (beer, cookies, cash)
    };
  },
});

export class Home {
  constructor(world, player, hud, life) {
    this.world = world;
    this.player = player;
    this.hud = hud;
    this.life = life;
    this.house = world.home;
    this.tvs = [];
    for (const s of this.house.spots) this._wire(s);
    this._lastHour = clock.hour;
  }

  get d() {
    return save.slice('home');
  }

  _box(s, size = [0.7, 0.7, 0.7]) {
    return new THREE.Box3().setFromCenterAndSize(s.at, new THREE.Vector3(...size));
  }

  _wire(s) {
    const add = (it) => this.world.interact.add({ kind: s.kind, spot: s, box: this._box(s, it.size), ...it });
    switch (s.kind) {
      case 'bed':
        add({
          size: [1.0, 0.7, 2.0],
          label: () => (s.owner === 'you' ? (clock.isNight || me.needs.energy < 0.5 ? 'Go to sleep' : 'Lie down / nap') : s.owner === 'parents' ? "Lie on your parents' bed" : 'Lie down'),
          use: () => (s.owner === 'you' && (clock.isNight || me.needs.energy < 0.5) ? this.sleep(s) : this.lieDown(s)),
        });
        break;
      case 'seat':
        add({ size: [0.6, 0.9, 0.6], label: () => `Sit on the ${s.label}`, use: () => this.player.sitOn(s, 'sit') });
        break;
      case 'couch':
        add({
          size: [1.0, 0.9, 2.1],
          label: () => 'Sit on the couch',
          alt: { key: 'F', text: 'Search the cushions' },
          use: () => this.player.sitOn({ ...s, at: s.at.clone() }, 'sit'),
          useAlt: () => this.searchCouch(),
        });
        break;
      case 'tv': {
        const tv = new Tv(this.world, s);
        this.tvs.push(tv);
        add({ size: [0.5, 0.6, (s.size?.[0] || 1) + 0.1], label: () => (tv.on ? `Change channel (${tv.channelName})` : 'Turn on the TV'), alt: { key: 'F', text: 'Turn off' }, use: () => tv.next(), useAlt: () => tv.off() });
        break;
      }
      case 'toilet':
        add({ size: [0.6, 0.8, 0.7], label: () => 'Use the toilet', use: () => this.toilet(s) });
        break;
      case 'shower':
        add({ size: [0.9, 0.9, 1.9], label: () => 'Take a shower', use: () => this.shower(s) });
        break;
      case 'sink-bath':
        add({ size: [0.6, 0.5, 0.7], label: () => (me.data.flags.brushedDay === clock.dayIndex ? 'Wash your hands' : 'Brush your teeth'), alt: { key: 'F', text: 'Drink from the tap' }, use: () => this.bathSink(), useAlt: () => this.drinkTap() });
        break;
      case 'sink-kitchen':
        add({ size: [0.6, 0.5, 0.7], label: () => (this.d.dishes > 0.5 ? 'Do the dishes' : 'Get a glass of water'), use: () => (this.d.dishes > 0.5 ? this.dishes() : this.drinkTap()) });
        break;
      case 'fridge':
        add({ size: [0.8, 1.8, 0.8], label: () => `Open the ${s.label}`, use: () => this.openFridge(s) });
        break;
      case 'cookies':
        add({ size: [0.4, 0.4, 0.4], label: () => (this.d.cookies > 0 ? 'Sneak a cookie' : 'Cookie jar (empty)'), use: () => this.cookie() });
        break;
      case 'microwave':
        add({ size: [0.6, 0.4, 0.5], label: () => 'Use the microwave', use: () => this.microwave() });
        break;
      case 'stove':
        add({ size: [0.6, 0.4, 0.6], label: () => 'Stove', use: () => this.stove() });
        break;
      case 'radio':
        add({ size: [0.5, 0.4, 0.4], label: () => (this.d.radio.on ? 'Change the station' : 'Turn on the radio'), alt: { key: 'F', text: 'Turn off' }, use: () => this.radio(true), useAlt: () => this.radio(false) });
        break;
      case 'piggybank':
        add({ size: [0.4, 0.4, 0.4], priority: 0.3, label: () => `Piggy bank (${priceText(me.data.piggy)})`, use: () => this.piggy() });
        break;
      case 'dresser':
        add({ size: [1.4, 1.0, 0.7], label: () => (s.private ? "Snoop in your parents' dresser" : 'Open your dresser'), use: () => this.dresser(s) });
        break;
      case 'trash-kitchen':
        add({ size: [0.5, 0.7, 0.5], label: () => (this.d.trash > 0.7 ? 'Take out the trash (full)' : 'Trash can'), use: () => this.trash() });
        break;
      case 'desk':
        add({ size: [1.4, 0.4, 0.8], label: () => 'Draw at your desk', use: () => this.activity('You draw for a while.', 'fun', 0.25, 30) });
        break;
      case 'pc':
        add({ size: [0.6, 0.6, 0.5], label: () => 'Play on the PC', use: () => this.activity('You play games on your PC.', 'fun', 0.45, 45) });
        break;
      case 'washer':
        add({ size: [0.7, 0.8, 0.7], label: () => 'Washing machine', use: () => this.hud.toast('Your clothes are clean. (Laundry chores come with parents\' rules.)') });
        break;
      case 'lemonade-kit':
        add({ size: [0.8, 0.8, 0.6], label: () => 'Folding table + pitcher (lemonade stand)', use: () => bus.emit('lemonade:open') });
        break;
      case 'garbage-bin':
        add({ size: [0.8, 1.1, 0.9], label: () => 'Garbage bin', use: () => bus.emit('chore:bin') });
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------------------- actions
  _passTime(minutes, { sleeping = false, fade = false } = {}) {
    this.life.skip(minutes, { sleeping, fade });
  }

  activity(text, need, amount, minutes) {
    me.restore(need, amount);
    this._passTime(minutes);
    this.hud.toast(text);
  }

  toilet(s) {
    if (me.needs.bladder > 0.85) {
      this.hud.toast("You don't need to go.");
      return;
    }
    audio.play?.('home.flush', { position: s.at });
    me.set('bladder', 1);
    me.data.flags.dirtyHands = true;
    this._passTime(3);
    this.hud.toast('Ahh. Better. (Wash your hands.)');
  }

  shower() {
    audio.play?.('home.shower', { gain: 0.7 });
    me.set('hygiene', 1);
    me.restore('energy', 0.05);
    me.data.flags.dirtyHands = false;
    this._passTime(15, { fade: true });
    this.hud.toast('You take a shower. Squeaky clean.');
  }

  bathSink() {
    if (me.data.flags.brushedDay !== clock.dayIndex) {
      me.data.flags.brushedDay = clock.dayIndex;
      me.data.flags.brushStreak = (me.data.flags.brushStreak || 0) + 1;
      me.restore('hygiene', 0.08);
      this._passTime(2);
      this.hud.toast('You brush your teeth for two minutes.');
      return;
    }
    me.data.flags.dirtyHands = false;
    this._passTime(1);
    this.hud.toast('You wash your hands.');
  }

  drinkTap() {
    audio.play?.('home.tap', { gain: 0.6 });
    me.restore('thirst', 0.3);
    me.restore('bladder', -0.12);
    this._passTime(1);
    this.hud.toast('You drink a glass of water.');
  }

  dishes() {
    this.d.dishes = 0;
    this._passTime(15);
    me.restore('fun', -0.05);
    bus.emit('chore:done', { chore: 'dishes' });
    this.hud.toast('You wash the dishes. Mom will notice.');
  }

  cookie() {
    if (this.d.cookies <= 0) return;
    this.d.cookies--;
    this.d.missing.cookies = (this.d.missing.cookies || 0) + 1;
    me.consume('oreoz');
    bus.emit('rule:maybe', { rule: 'cookie', severity: 0.15, noise: 0.3, where: 'kitchen' });
    this.hud.toast('You sneak a cookie. Mmm.');
  }

  searchCouch() {
    const coins = Math.round(this.d.couchCoins * 100) / 100;
    if (coins < 0.01) {
      this.hud.toast('Just crumbs and a hair tie.');
      return;
    }
    this.d.couchCoins = 0;
    me.addCash(coins, 'couch');
    audio.play?.('coins', { gain: 0.6 });
    this.hud.toast(`You dig through the cushions and find ${priceText(coins)} in change.`);
  }

  piggy() {
    const p = openPanel({ title: 'Piggy bank', sub: 'Your savings' });
    const render = () => {
      p.setBody([
        el('p', { class: 'rl-note' }, [`In the piggy bank: ${priceText(me.data.piggy)}. In your pocket: ${priceText(me.cash)}.`]),
        el('div', { class: 'rl-list' }, [
          row('Take money out', 'To spend at the stores', [1, 5, 'all'].map((n) => ({ text: n === 'all' ? 'All' : `$${n}`, onClick: () => move(n, -1) }))),
          row('Put money in', 'Keep it safe at home', [1, 5, 'all'].map((n) => ({ text: n === 'all' ? 'All' : `$${n}`, soft: true, onClick: () => move(n, 1) }))),
        ]),
      ]);
    };
    const move = (n, dir) => {
      const from = dir < 0 ? me.data.piggy : me.cash;
      const amt = Math.min(from, n === 'all' ? from : n);
      if (amt <= 0) return;
      if (dir < 0) {
        me.data.piggy = round(me.data.piggy - amt);
        me.addCash(amt, 'piggy');
      } else {
        me.spend(amt);
        me.data.piggy = round(me.data.piggy + amt);
      }
      audio.play?.('coins', { gain: 0.5 });
      render();
    };
    render();
    p.setButtons([{ text: 'Done', kind: 'go', onClick: () => p.close() }]);
  }

  dresser(s) {
    if (s.private) {
      // Snooping: there's the emergency cash Mom keeps in the sock drawer.
      bus.emit('rule:maybe', { rule: 'snooping', severity: 0.35, noise: 0.2, where: 'master' });
      const cash = this.d.parentsCash;
      const p = openPanel({ title: "Parents' dresser", sub: 'You really shouldn\'t be in here...' });
      p.setBody(el('div', { class: 'rl-list' }, [
        row('Socks, a watch, old birthday cards', null, []),
        row(cash > 0 ? `Emergency cash: ${priceText(cash)}` : 'The cash envelope is empty', cash > 0 ? 'Taking it is stealing from your parents.' : null, cash > 0 ? [{ text: 'Take $5', onClick: () => take(5) }, { text: 'Take all', onClick: () => take(cash) }] : []),
      ]));
      const take = (n) => {
        const amt = Math.min(n, this.d.parentsCash);
        this.d.parentsCash = round(this.d.parentsCash - amt);
        this.d.missing.cash = round((this.d.missing.cash || 0) + amt);
        me.addCash(amt, 'stolen');
        bus.emit('rule:maybe', { rule: 'stealing', severity: 0.9, noise: 0.1, where: 'master', amount: amt });
        p.close();
        this.hud.toast(`You pocket ${priceText(amt)}. Your heart is pounding.`);
      };
      p.setButtons([{ text: 'Close the drawer', onClick: () => p.close() }]);
      return;
    }
    const day = clock.dayIndex;
    const found = this.d.lastSearch.dresser !== day && me.data.flags.dresserDollar !== true;
    if (found) {
      me.data.flags.dresserDollar = true;
      me.addCash(1, 'dresser');
    }
    this.d.lastSearch.dresser = day;
    openPanel({
      title: 'Your dresser',
      body: el('div', { class: 'rl-list' }, [row('T-shirts, jeans, pajamas, socks', 'Clothes you can wear (clothes shopping comes later)'), found ? row('A crumpled $1 bill!', 'From your last birthday card.') : null].filter(Boolean)),
      buttons: [{ text: 'Close', kind: 'go', onClick: (p) => p.close() }],
    });
  }

  trash() {
    if (this.d.trash < 0.7) {
      this.hud.toast('The trash isn\'t full yet.');
      return;
    }
    this.d.trash = 0;
    this._passTime(5);
    bus.emit('chore:done', { chore: 'trash' });
    this.hud.toast('You take the trash bag out to the bin in the garage.');
  }

  radio(on) {
    const r = this.d.radio;
    if (!on) {
      r.on = false;
      bus.emit('radio:set', { on: false });
      return;
    }
    if (r.on) r.station = (r.station + 1) % 4;
    r.on = true;
    bus.emit('radio:set', { on: true, station: r.station, at: this.house.spots.find((x) => x.kind === 'radio')?.at });
    this.hud.toast(['WMHR 97.1 Hits', 'Classic Rock 101.5', 'NPR News 89.7', 'Country 104.3'][r.station]);
  }

  microwave() {
    const cookable = Object.entries(this.d.fridge).filter(([id, n]) => n > 0 && PRODUCT[id]?.food?.cook);
    const mine = Object.entries(me.data.owned).filter(([id, n]) => n > 0 && PRODUCT[id]?.food?.cook);
    const p = openPanel({ title: 'Microwave', sub: 'Heat something up' });
    const list = [...cookable.map(([id]) => ({ id, from: 'fridge' })), ...mine.map(([id]) => ({ id, from: 'mine' }))];
    p.setBody(
      list.length
        ? el('div', { class: 'rl-list' }, list.map((x) => row(PRODUCT[x.id].name, x.from === 'mine' ? 'Yours' : "Family's food", [{ text: 'Heat + eat', onClick: () => (p.close(), this._eat(x.id, x.from, true)) }])))
        : el('div', { class: 'rl-empty' }, ['Nothing to microwave. Buy frozen food at Walmort.']),
    );
  }

  stove() {
    if (clock.age < 12) {
      this.hud.subtitle('Mom (in your head)', 'You are NOT allowed to use the stove by yourself.', 3);
      return;
    }
    this.microwave();
  }

  openFridge(s) {
    const isGarage = s.stock === 'garage';
    const store = isGarage ? this.d.garage : this.d.fridge;
    audio.play?.('fridge.open', { position: s.at });
    const p = openPanel({ title: isGarage ? 'Garage fridge' : 'Fridge', sub: isGarage ? 'Dad\'s drinks and the extra stuff' : 'What your family bought', onClose: () => audio.play?.('fridge.close', { position: s.at }) });
    const render = () => {
      const fam = Object.entries(store).filter(([, n]) => n > 0);
      const mine = isGarage ? [] : Object.entries(me.data.owned).filter(([id, n]) => n > 0 && PRODUCT[id]?.food);
      const rows = [];
      for (const [id, n] of fam) {
        const pr = PRODUCT[id];
        if (!pr) continue;
        const cook = pr.food?.cook;
        rows.push(row(pr.name, `${n} serving${n > 1 ? 's' : ''}${cook ? ' · needs heating' : ''}${pr.food?.alcohol ? ' · adults only' : ''}`, [{ text: cook ? 'Microwave it' : pr.food?.thirst > pr.food?.hunger ? 'Drink' : 'Eat', disabled: !!cook && false, onClick: () => (cook ? (p.close(), this.microwave()) : (this._eat(id, isGarage ? 'garage' : 'fridge'), render())) }]));
      }
      for (const [id, n] of mine) rows.push(row(`${PRODUCT[id].name} (yours)`, `${n}`, [{ text: 'Eat', onClick: () => (this._eat(id, 'mine'), render()) }]));
      p.setBody(rows.length ? el('div', { class: 'rl-list' }, rows) : el('div', { class: 'rl-empty' }, ['Empty. Somebody has to go grocery shopping.']));
    };
    render();
  }

  _eat(id, from, heated = false) {
    const pr = PRODUCT[id];
    const src = from === 'garage' ? this.d.garage : from === 'fridge' ? this.d.fridge : null;
    if (src) {
      if (!(src[id] > 0)) return;
      src[id]--;
    } else {
      me.data.owned[id]--;
      if (me.data.owned[id] <= 0) delete me.data.owned[id];
    }
    if (pr.food?.alcohol) {
      this.d.missing.beer = (this.d.missing.beer || 0) + 1;
      bus.emit('rule:maybe', { rule: 'beer', severity: 1, noise: 0.25, where: 'garage' });
      if (clock.age < 21) {
        // A kid drinking beer gets sick (master list §0/§5): nausea, then throwing up.
        me.data.sick = Math.min(1, (me.data.sick || 0) + 0.6);
        this.hud.toast('Ugh. It tastes awful. Your stomach starts turning...');
        bus.emit('me:sick', { cause: 'beer' });
      }
    }
    if (pr.food?.needsMilk && !((this.d.fridge.milk || 0) > 0)) this.hud.toast('Dry cereal. No milk left.');
    else if (pr.food?.needsMilk) this.d.fridge.milk--;
    me.consume(id);
    this.d.dishes = Math.min(1, this.d.dishes + (heated || pr.food?.needsMilk ? 0.25 : 0.05));
    this.player.body.play(pr.food?.thirst > (pr.food?.hunger || 0) ? 'drink' : 'eat');
    this._passTime(pr.food?.minutes || 3);
    this.hud.toast(`${heated ? 'You heat up and eat' : pr.food?.thirst > (pr.food?.hunger || 0) ? 'You drink' : 'You eat'} ${pr.name.toLowerCase()}.`);
  }

  sleep(s) {
    this.player.sitOn({ at: s.at.clone().setY(s.at.y + 0.02), faceYaw: Math.PI }, 'lie');
    this.life.sleep();
  }

  lieDown(s) {
    this.player.sitOn({ at: s.at.clone().setY(s.at.y + 0.02), faceYaw: Math.PI }, 'lie');
  }

  /** Each game hour: life in the house moves on (dishes pile up, trash fills, couch coins). */
  hourly() {
    const h = clock.hour;
    const d = this.d;
    // Dinner time makes dishes + trash.
    if (h === 19) {
      d.dishes = Math.min(1, d.dishes + 0.7);
      d.trash = Math.min(1, d.trash + 0.25);
    }
    // Dad watches TV in the evening; change falls out of his pocket into the couch.
    if (h === 21) d.couchCoins = round(d.couchCoins + [0.05, 0.1, 0.25, 0.35][clock.dayIndex % 4]);
    // Parents restock groceries on Saturday morning (they go shopping).
    if (clock.weekday === 6 && h === 11) {
      const fresh = save.slice('home');
      const life = save.life;
      const wealth = life?.family?.house?.wealth || 'middle';
      const w = wealth === 'veryrich' ? 'rich' : wealth;
      for (const [id, n] of Object.entries(STOCK.house[w] || STOCK.house.middle)) fresh.fridge[id] = Math.max(fresh.fridge[id] || 0, n * (PRODUCT[id]?.food?.servings || 1));
      d.cookies = Math.max(d.cookies, 14);
    }
  }

  update(dt) {
    for (const tv of this.tvs) tv.update(dt);
  }
}

function round(n) {
  return Math.round(n * 100) / 100;
}
