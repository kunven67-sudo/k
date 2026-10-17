// Buying stuff in walk-in stores (master list §12): take things off shelves (2 hands, more with
// a basket), locked cases need an employee, checkout with a cashier who scans every item,
// Ohio sales tax on non-food, ID checks, cash + change, a real receipt, delivery for big
// furniture, and the alarm if you walk out without paying.

import * as THREE from 'three';
import { el } from '../core/util.js';
import { bus } from '../core/events.js';
import { audio } from '../core/audio.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { me } from './me.js';
import { PRODUCT, TAX_RATE, priceText } from './products.js';
import { setUnitVisible } from '../world/stores.js';
import { openPanel, row } from '../ui/panel.js';

save.registerSlice('shops', {
  create: () => ({ receipts: [], deliveries: [], trust: { grocery: 1, electronics: 1, furniture: 1 }, caught: 0, stock: {} }),
});

const HAND_LIMIT = 2;
const BASKET_LIMIT = 24;

export class Shopping {
  constructor(world, player, hud, life) {
    this.world = world;
    this.player = player;
    this.hud = hud;
    this.life = life;
    this.stores = world.town.stores;
    this.inStore = null;
    for (const s of ['grocery', 'electronics', 'furniture']) this._wire(this.stores[s]);
  }

  get data() {
    return save.slice('shops');
  }

  _wire(S) {
    const W = this.world;
    for (const slot of S.slots) {
      W.interact.add({
        kind: 'shelf',
        slot,
        box: slot.box,
        priority: 0.05,
        label: () => {
          const p = slot.product;
          if (!S.isOpen) return null;
          if (slot.display) return `${p.name} · ${priceText(p.price)} (order for delivery)`;
          if (slot.count <= 0) return `${p.name}: out of stock`;
          if (slot.locked) return `${p.name} · ${priceText(p.price)} (locked, ask for help)`;
          return `Take ${p.name} · ${priceText(p.price)}${p.unit ? ' ' + p.unit : ''}`;
        },
        use: () => this.take(S, slot),
      });
    }
    for (const r of S.registers) {
      W.interact.add({
        kind: 'register',
        box: r.box,
        priority: 0.2,
        label: () => {
          if (!S.isOpen) return null;
          const n = me.unpaid(S.id).length;
          return n ? `Check out (${n} item${n > 1 ? 's' : ''})` : 'Register';
        },
        use: () => this.checkout(S, r),
      });
    }
    if (S.baskets) {
      W.interact.add({
        kind: 'basket',
        box: new THREE.Box3().setFromCenterAndSize(S.baskets.clone().setY(S.baskets.y + 0.5), new THREE.Vector3(0.9, 1, 0.9)),
        label: () => (me.data.flags.basket === S.id ? 'Put the basket back' : 'Grab a basket'),
        use: () => {
          me.data.flags.basket = me.data.flags.basket === S.id ? null : S.id;
          audio.play?.('bag.rustle', { gain: 0.6 });
          this.hud.toast(me.data.flags.basket ? 'You grab a basket.' : 'You put the basket back.');
        },
      });
    }
  }

  capacity(S) {
    return me.data.flags.basket === S.id ? BASKET_LIMIT : HAND_LIMIT;
  }

  take(S, slot) {
    const p = slot.product;
    if (!S.isOpen) return;
    if (slot.display) {
      const already = me.unpaid(S.id).some((it) => it.id === p.id && it.order);
      if (already) {
        this.hud.toast(`${p.name} is already on your order.`);
        return;
      }
      me.give(p.id, { paid: false, from: S.id });
      me.data.bag[me.data.bag.length - 1].order = true;
      this.hud.toast(`${p.name} added to your order. Pay at the register, it gets delivered.`);
      return;
    }
    if (slot.count <= 0) return;
    if (slot.locked) {
      this.hud.subtitle('Employee', `Need the ${p.name}? I'll grab one and bring it to the register for you.`, 4);
      // Real Best Buy: the employee carries it to the register, it's yours to pay for there.
    }
    const carried = me.unpaid(S.id).length;
    if (carried >= this.capacity(S)) {
      this.hud.toast(me.data.flags.basket === S.id ? 'Your basket is full.' : 'Your hands are full. Grab a basket by the door.');
      return;
    }
    // Hide the front-most visible unit.
    const unit = slot.units.find((u) => !u.taken);
    if (unit) {
      unit.taken = true;
      setUnitVisible(slot, unit, false);
    }
    slot.count--;
    me.give(p.id, { paid: false, from: S.id });
    me.data.bag[me.data.bag.length - 1].slot = S.slots.indexOf(slot);
    audio.play?.('item.pickup', { gain: 0.6 });
  }

  /** Put an unpaid item back on its shelf. */
  putBack(S, item) {
    const slot = S.slots[item.slot];
    if (slot) {
      const unit = [...slot.units].reverse().find((u) => u.taken);
      if (unit) {
        unit.taken = false;
        setUnitVisible(slot, unit, true);
      }
      slot.count = Math.min(slot.max, slot.count + 1);
    }
    me.removeItem(item);
  }

  checkout(S, reg) {
    const items = me.unpaid(S.id);
    if (!items.length) {
      this.hud.subtitle('Cashier', 'Hi! Let me know when you\'re ready.', 2.5);
      return;
    }
    const age = Math.floor(clock.age);
    const lines = [];
    const refused = [];
    for (const it of items) {
      const p = PRODUCT[it.id];
      if (p.age && age < p.age) refused.push(it);
      else lines.push(it);
    }
    for (const it of refused) this.putBack(S, it);
    const sub = round(lines.reduce((n, it) => n + PRODUCT[it.id].price, 0));
    const taxable = round(lines.filter((it) => PRODUCT[it.id].taxed).reduce((n, it) => n + PRODUCT[it.id].price, 0));
    const tax = round(taxable * TAX_RATE);
    const total = round(sub + tax);
    const panel = openPanel({ title: S.name, sub: 'Checkout', wide: false });
    const list = el('div', { class: 'rl-list' });
    const totals = el('div', { style: 'margin-top:10px;font:600 14px var(--font-ui)' });
    panel.setBody([refused.length ? el('p', { class: 'rl-note' }, [`"Can I see your ID?" You're ${age}. The ${refused.map((r) => PRODUCT[r.id].name).join(', ')} goes back.`]) : null, list, totals]);
    // Scan line by line with a beep.
    let i = 0;
    const scanNext = () => {
      if (panel.closed) return;
      if (i < lines.length) {
        const p = PRODUCT[lines[i].id];
        list.appendChild(row(p.name, p.taxed ? 'taxable' : 'food (no tax)', [{ text: priceText(p.price), soft: true, onClick: () => {} }]));
        audio.play?.('store.beep', { gain: 0.5 });
        i++;
        setTimeout(scanNext, 260);
        return;
      }
      totals.replaceChildren(
        el('div', {}, [`Subtotal: ${priceText(sub)}`]),
        el('div', {}, [`Sales tax (${(TAX_RATE * 100).toFixed(2)}%): ${priceText(tax)}`]),
        el('div', { style: 'font:700 18px var(--font-round);margin-top:4px' }, [`Total: ${priceText(total)}`]),
        el('div', { class: 'rl-note' }, [`You have ${priceText(me.cash)} cash.`]),
      );
      const canPay = me.cash + 1e-6 >= total && lines.length > 0;
      panel.setButtons([
        { text: 'Put stuff back', onClick: () => this._putBackPanel(S, panel) },
        { text: canPay ? `Pay ${priceText(total)} cash` : 'Not enough cash', kind: canPay ? 'go' : 'dim', onClick: () => canPay && this._pay(S, lines, { sub, tax, total }, panel) },
      ]);
    };
    panel.setButtons([]);
    scanNext();
  }

  _putBackPanel(S, prev) {
    prev.close();
    const p = openPanel({ title: 'Put something back', sub: S.name });
    const render = () => {
      const items = me.unpaid(S.id);
      p.setBody(items.length ? el('div', { class: 'rl-list' }, items.map((it) => row(PRODUCT[it.id].name, priceText(PRODUCT[it.id].price), [{ text: 'Put back', onClick: () => (this.putBack(S, it), render()) }]))) : el('div', { class: 'rl-empty' }, ['Nothing left to buy.']));
    };
    render();
    p.setButtons([{ text: 'Back to the register', kind: 'go', onClick: () => (p.close(), this.checkout(S)) }]);
  }

  _pay(S, lines, { sub, tax, total }, panel) {
    const given = cashGiven(me.cash, total);
    if (!me.spend(total)) return;
    const change = round(given - total);
    audio.play?.('store.register', { gain: 0.7 });
    const now = clock.calendarDate;
    const receipt = {
      store: S.name,
      storeId: S.id,
      when: `${clock.dateText()} ${clock.year}  ${clock.timeText()}`,
      lines: lines.map((it) => ({ name: PRODUCT[it.id].name, price: PRODUCT[it.id].price, taxed: PRODUCT[it.id].taxed })),
      sub,
      tax,
      total,
      cash: given,
      change,
      n: Math.floor(1000 + ((clock.total * 7) % 9000)),
    };
    void now;
    for (const it of lines) {
      it.paid = true;
      if (it.order) {
        // Big furniture: delivered tomorrow morning to the house.
        this.data.deliveries.push({ id: it.id, day: clock.dayIndex + 1, hour: 10 });
        me.removeItem(it);
      }
    }
    me.data.stats.itemsBought += lines.length;
    this.data.receipts.unshift(receipt);
    this.data.receipts.length = Math.min(this.data.receipts.length, 20);
    me.data.flags.basket = null;
    bus.emit('shop:paid', { store: S.id, receipt });
    panel.close();
    showReceipt(receipt);
  }

  /** Every frame: entering/leaving stores (shoplifting alarm). */
  update() {
    const room = this.world.roomAt(this.player.position);
    const S = room?.kind === 'store' ? room.store : null;
    if (S !== this.inStore) {
      const left = this.inStore;
      this.inStore = S;
      if (left) this._left(left);
      if (S) bus.emit('shop:entered', { store: S.id });
    }
  }

  _left(S) {
    if (me.data.flags.basket === S.id) me.data.flags.basket = null;
    const unpaid = me.unpaid(S.id);
    if (!unpaid.length) return;
    // The anti-theft gates beep. Stores have a greeter/cashier watching the door: you get
    // stopped (a kid can't outrun an adult who's standing right there).
    audio.play?.('store.alarm', { gain: 0.9 });
    this.data.caught++;
    this.data.trust[S.id] = Math.max(0, (this.data.trust[S.id] ?? 1) - 0.35);
    for (const it of [...unpaid]) {
      if (it.order) me.removeItem(it);
      else this.putBack(S, it);
    }
    this.player.place(S.entrance.clone(), Math.PI / 2);
    this.hud.subtitle('Store employee', "Whoa whoa, hold on! You didn't pay for that. I'm calling your parents.", 4.5);
    bus.emit('rule:broken', { rule: 'shoplifting', where: S.id, severity: 0.8 });
  }

  /** Called each game hour: deliveries arrive. */
  hourly() {
    const d = this.data;
    const due = d.deliveries.filter((x) => clock.dayIndex >= x.day && clock.hour >= x.hour);
    if (!due.length) return;
    d.deliveries = d.deliveries.filter((x) => !due.includes(x));
    for (const x of due) {
      me.data.owned[x.id] = (me.data.owned[x.id] || 0) + 1;
      bus.emit('delivery:arrived', { id: x.id });
    }
    this.hud.toast(`Delivery: ${due.map((x) => PRODUCT[x.id].name).join(', ')} is at your house.`);
  }
}

function round(n) {
  return Math.round(n * 100) / 100;
}

/** The bills you'd hand over (real cashiers count back change). */
function cashGiven(have, total) {
  const bills = [1, 5, 10, 20, 50, 100];
  for (const b of bills) {
    const n = Math.ceil(total / b) * b;
    if (n <= have + 1e-6 && n - total < b) return n;
  }
  return Math.min(have, Math.ceil(total));
}

export function showReceipt(r) {
  const paper = el('div', { class: 'receipt' }, [
    el('div', { class: 'r-store' }, [r.store.toUpperCase()]),
    el('div', { class: 'r-small' }, ['MAPLE HOLLOW, OH']),
    el('div', { class: 'r-small' }, [r.when]),
    el('div', { class: 'r-sep' }, ['-'.repeat(32)]),
    ...r.lines.map((l) => el('div', { class: 'r-line' }, [el('span', {}, [l.name.toUpperCase().slice(0, 22)]), el('span', {}, [`${l.price.toFixed(2)}${l.taxed ? ' T' : ' N'}`])])),
    el('div', { class: 'r-sep' }, ['-'.repeat(32)]),
    el('div', { class: 'r-line' }, [el('span', {}, ['SUBTOTAL']), el('span', {}, [r.sub.toFixed(2)])]),
    el('div', { class: 'r-line' }, [el('span', {}, [`TAX ${(TAX_RATE * 100).toFixed(2)}%`]), el('span', {}, [r.tax.toFixed(2)])]),
    el('div', { class: 'r-line r-big' }, [el('span', {}, ['TOTAL']), el('span', {}, [r.total.toFixed(2)])]),
    el('div', { class: 'r-line' }, [el('span', {}, ['CASH']), el('span', {}, [r.cash.toFixed(2)])]),
    el('div', { class: 'r-line' }, [el('span', {}, ['CHANGE DUE']), el('span', {}, [r.change.toFixed(2)])]),
    el('div', { class: 'r-sep' }, ['-'.repeat(32)]),
    el('div', { class: 'r-small' }, [`# ITEMS SOLD ${r.lines.length}   TC# ${r.n}`]),
    el('div', { class: 'r-barcode' }),
    el('div', { class: 'r-small' }, ['THANK YOU FOR SHOPPING']),
  ]);
  openPanel({ title: 'Receipt', sub: 'You keep it in your pocket', body: paper, buttons: [{ text: 'Done', kind: 'go', onClick: (p) => p.close() }], className: 'receipt-panel' });
}

import { injectStyle } from '../core/util.js';
injectStyle('receipt', `
.receipt { margin: 4px auto 6px; width: 290px; padding: 16px 16px 20px; background: #fdfcf7; color: #222; font: 14px/1.35 var(--font-receipt);
  box-shadow: 0 2px 8px rgba(0,0,0,.12); clip-path: polygon(0 0, 100% 0, 100% 97%, 95% 100%, 90% 97%, 85% 100%, 80% 97%, 75% 100%, 70% 97%, 65% 100%, 60% 97%, 55% 100%, 50% 97%, 45% 100%, 40% 97%, 35% 100%, 30% 97%, 25% 100%, 20% 97%, 15% 100%, 10% 97%, 5% 100%, 0 97%); }
.receipt .r-store { text-align: center; font-weight: 700; font-size: 20px; letter-spacing: 2px; }
.receipt .r-small { text-align: center; font-size: 12px; }
.receipt .r-sep { overflow: hidden; white-space: nowrap; color: #888; }
.receipt .r-line { display: flex; justify-content: space-between; gap: 8px; }
.receipt .r-big { font-weight: 700; font-size: 16px; }
.receipt .r-barcode { height: 40px; margin: 10px 20px 6px; background: repeating-linear-gradient(90deg, #111 0 2px, transparent 2px 4px, #111 4px 5px, transparent 5px 8px, #111 8px 11px, transparent 11px 12px); }
`);
