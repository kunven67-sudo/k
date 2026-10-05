// Shops on the street: walk up to a door, E opens the counter. Buy with the
// money from chores and allowance, or try to steal (the shopkeeper may see you,
// less likely when you're tiny). What you buy goes in your backpack (Tab / I),
// where you can eat, drink and use it.
import * as THREE from 'three';

const CATALOG = {
  Bakery: [
    { id: 'roll', name: 'Bread roll', price: 2, use: { hunger: 25 } },
    { id: 'donut', name: 'Donut', price: 1, use: { hunger: 10, energy: 5 } },
    { id: 'cake', name: 'Slice of cake', price: 3, use: { hunger: 30, energy: 10 } },
  ],
  Grocery: [
    { id: 'water', name: 'Bottle of water', price: 1, use: { thirst: 40 } },
    { id: 'apple', name: 'Apple', price: 1, use: { hunger: 15, thirst: 5 } },
    { id: 'chips', name: 'Bag of chips', price: 2, use: { hunger: 20, thirst: -5 } },
    { id: 'energy', name: 'Energy drink', price: 3, use: { energy: 40, thirst: 15 } },
  ],
  Diner: [
    { id: 'burger', name: 'Burger', price: 6, use: { hunger: 55 } },
    { id: 'coffee', name: 'Coffee', price: 2, use: { energy: 30, thirst: 10 } },
    { id: 'shake', name: 'Milkshake', price: 4, use: { thirst: 30, hunger: 10 } },
  ],
  Pharmacy: [
    { id: 'bandage', name: 'Bandages', price: 3, use: { health: 20 } },
    { id: 'pills', name: 'Painkillers', price: 5, use: { health: 35 } },
    { id: 'vitamins', name: 'Vitamins', price: 2, use: { energy: 10, health: 5 } },
  ],
  Hardware: [
    { id: 'flashlight', name: 'Flashlight', price: 8, use: null, note: 'Lights the way (F in the dark, soon)' },
    { id: 'tape', name: 'Duct tape', price: 3, use: null, note: 'Fixes everything' },
    { id: 'seedpack', name: 'Seed packet', price: 2, use: null, note: 'For the tiny people\'s farm' },
  ],
  'Pet Shop': [
    { id: 'treats', name: 'Dog treats', price: 2, use: null, note: 'Good boy!' },
    { id: 'crickets', name: 'Box of crickets', price: 3, use: null, note: 'Gecko food' },
  ],
};

export class Shops {
  constructor({ spots, interact, input, player, family, vitals, police, speech, humans, toast, canvas }) {
    Object.assign(this, { interact, input, player, family, vitals, police, speech, humans, toast, canvas });
    this.bag = new Map(); // id -> { item, n }
    this.panel = document.getElementById('shop');
    this.bagEl = document.getElementById('bag');
    this.open = null;
    for (const s of spots || []) {
      if (s.act !== 'shop') continue;
      const at = s.p.clone().add(new THREE.Vector3(0.9, 1.2, 0.4));
      const name = s.name;
      this.interact.add({
        at, radius: 2.4, anyScale: true,
        label: name === 'Bank' ? 'Bank' : name === 'Police' ? 'Police station' : `Go into the ${name}`,
        use: () => this.show(name, at),
      });
    }
    this.panel?.addEventListener('click', (e) => this.onClick(e));
    this.bagEl?.addEventListener('click', (e) => this.onBagClick(e));
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && (this.open || !this.bagEl?.hidden)) { e.preventDefault(); this.close(); }
      else if ((e.code === 'Tab' || e.code === 'KeyI') && this.bagEl && !this.bagEl.hidden) { e.preventDefault(); this.close(); }
    });
  }

  get money() { return this.family?.money ?? 0; }
  pay(n) { this.family?.addMoney(-n); }

  modal(on) {
    this.input.enabled = !on;
    this.input.clear();
    if (on) document.exitPointerLock?.();
    else this.canvas?.requestPointerLock?.()?.catch?.(() => {});
  }

  show(name, at) {
    if (!this.panel) return;
    this.open = { name, at };
    this.modal(true);
    this.render();
    this.panel.hidden = false;
  }

  close() {
    if (this.open) { this.open = null; this.panel.hidden = true; }
    if (this.bagEl && !this.bagEl.hidden) this.bagEl.hidden = true;
    this.modal(false);
  }

  render() {
    const { name } = this.open;
    let rows = '';
    if (name === 'Bank') {
      rows = `<p>Your money: <b>$${this.money}</b>. The vault is right there behind the counter…</p>
        <button data-act="rob">Rob the bank 💰 (very, very illegal)</button>`;
    } else if (name === 'Police') {
      const w = Math.ceil(this.police?.wanted ?? 0);
      rows = w ? `<p>You're wanted (${'★'.repeat(w)}). Turning yourself in costs a $20 fine.</p><button data-act="surrender">Turn yourself in</button>`
        : '<p>"Can I help you, kid?" The officer looks at you suspiciously.</p>';
    } else {
      rows = (CATALOG[name] || []).map((it) => `<div class="row"><span>${it.name}${it.note ? ` <i>${it.note}</i>` : ''}</span>
        <button data-buy="${it.id}" ${this.money < it.price ? 'disabled' : ''}>Buy $${it.price}</button>
        <button data-steal="${it.id}" class="steal">Steal</button></div>`).join('');
    }
    this.panel.innerHTML = `<h3>${name}</h3>${rows}<div class="foot">You have <b>$${this.money}</b> · <button data-act="close">Leave (Esc)</button></div>`;
  }

  find(id) { for (const list of Object.values(CATALOG)) for (const it of list) if (it.id === id) return it; return null; }

  addToBag(it) {
    const e = this.bag.get(it.id) || { item: it, n: 0 };
    e.n++;
    this.bag.set(it.id, e);
  }

  onClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') return this.close();
    if (b.dataset.buy) {
      const it = this.find(b.dataset.buy);
      if (!it || this.money < it.price) return;
      this.pay(it.price);
      this.addToBag(it);
      this.toast?.(`Bought: ${it.name} (in your backpack — Tab)`);
      return this.render();
    }
    if (b.dataset.steal) return this.steal(this.find(b.dataset.steal), 1);
    if (b.dataset.act === 'rob') return this.steal({ id: 'cash', name: '$200 in cash' }, 3);
    if (b.dataset.act === 'surrender') {
      this.pay(Math.min(20, this.money));
      this.police.wanted = 0;
      this.police.lastSeen = null;
      this.toast?.('You turned yourself in. $20 fine. The police stop looking for you.');
      return this.close();
    }
  }

  // stealing: the shopkeeper sees you most of the time (a tiny thief rarely)
  steal(it, sev) {
    if (!it) return;
    const tiny = this.player.scale < 0.3;
    const caught = Math.random() < (tiny ? 0.1 : sev > 1 ? 0.95 : 0.55);
    if (it.id === 'cash') { if (!caught || Math.random() < 0.5) this.family?.addMoney(200); }
    else this.addToBag(it);
    const where = this.open.at.clone();
    this.close();
    if (caught) {
      this.toast?.(`The shopkeeper saw you! "THIEF! Somebody call the police!"`);
      this.police?.raise(sev, this.player.feet.clone(), 'The shopkeeper called the police!');
      this.police?.crime('steal', where, null);
    } else this.toast?.(`You got away with ${it.name}${tiny ? ' (nobody notices someone your size)' : ''}`);
  }

  // ---- backpack

  toggleBag() {
    if (!this.bagEl) return;
    if (!this.bagEl.hidden) return this.close();
    this.renderBag();
    this.bagEl.hidden = false;
    this.modal(true);
  }

  renderBag() {
    const rows = [...this.bag.values()].map(({ item, n }) => `<div class="row"><span>${item.name} ×${n}${item.note ? ` <i>${item.note}</i>` : ''}</span>
      ${item.use ? `<button data-use="${item.id}">${item.use.thirst > 20 ? 'Drink' : item.use.health ? 'Use' : 'Eat'}</button>` : ''}
      <button data-drop="${item.id}">Drop</button></div>`).join('') || '<p>Empty. Buy something at the shops across the street.</p>';
    this.bagEl.innerHTML = `<h3>Backpack</h3>${rows}<div class="foot">$${this.money} · <button data-act="close">Close (Tab)</button></div>`;
  }

  onBagClick(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'close') return this.close();
    const id = b.dataset.use || b.dataset.drop;
    const entry = this.bag.get(id);
    if (!entry) return;
    if (b.dataset.use) {
      const u = entry.item.use;
      const v = this.vitals;
      if (u.hunger) v.hunger = THREE.MathUtils.clamp(v.hunger + u.hunger, 0, 100);
      if (u.thirst) v.thirst = THREE.MathUtils.clamp(v.thirst + u.thirst, 0, 100);
      if (u.energy) v.energy = THREE.MathUtils.clamp(v.energy + u.energy, 0, 100);
      if (u.health) v.health = THREE.MathUtils.clamp(v.health + u.health, 0, 100);
      this.toast?.(`Mmm. ${entry.item.name}.`);
    }
    if (--entry.n <= 0) this.bag.delete(id);
    this.renderBag();
  }

  update() {
    if (this.input.pressed('inventory') && !this.open && this.bagEl?.hidden) this.toggleBag();
  }
}
