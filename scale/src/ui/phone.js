// Your phone's screen (shown big on the right side of the screen while the phone is in your hand).
// Wave 1 app: Haul, a shopping app. Everything in it is real stuff at real size, weight and price.
// In sandbox mode it's free and arrives instantly through a rift (see props/spawn.js).
import { CATALOG } from '../props/catalog.js';
import '../props/items.js';
import '../life/mantis.js';
import { hash3, formatLength } from '../core/util.js';
import { bus } from '../core/events.js';
import { input } from '../core/input.js';

const ICON = {
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 4 7 12l8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M4 8h16l-1.4 11.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 8z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  orders: '<svg viewBox="0 0 24 24"><rect x="4" y="3.5" width="16" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>',
  wifi: '<svg viewBox="0 0 24 24"><path d="M2.5 8.5a14 14 0 0 1 19 0M5.8 12a9.3 9.3 0 0 1 12.4 0M9 15.4a4.6 4.6 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/></svg>',
  signal: '<svg viewBox="0 0 24 24"><rect x="3" y="15" width="3.2" height="5" rx="1" fill="currentColor"/><rect x="8" y="11.5" width="3.2" height="8.5" rx="1" fill="currentColor"/><rect x="13" y="8" width="3.2" height="12" rx="1" fill="currentColor"/><rect x="18" y="4.5" width="3.2" height="15.5" rx="1" fill="currentColor"/></svg>',
  battery: '<svg viewBox="0 0 28 24"><rect x="1.5" y="6" width="22" height="12" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.6" opacity="0.55"/><rect x="3.6" y="8.1" width="15" height="7.8" rx="1.8" fill="currentColor"/><path d="M25.2 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.55"/></svg>',
};

const CATS = ['All', 'Electronics', 'Pets & bugs', 'Furniture', 'Food & drink', 'Toys', 'Home', 'Kitchen', 'Sports', 'Office', 'Garden', 'Containers'];

const money = (p) => {
  const d = Math.floor(p);
  const c = Math.round((p - d) * 100);
  return `<span class="cur">$</span>${d.toLocaleString('en-US')}<sup>${String(c).padStart(2, '0')}</sup>`;
};
const massText = (m) => (m >= 1 ? `${m.toFixed(m < 10 ? 1 : 0)} kg` : m >= 0.001 ? `${(m * 1000).toFixed(m < 0.01 ? 1 : 0)} g` : `${(m * 1e6).toFixed(0)} mg`);
// Ratings come from the item itself (same item, same rating, every time).
const rating = (id) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const r = 3.7 + hash3(h, 1) * 1.25;
  return { stars: Math.min(5, Math.round(r * 10) / 10), count: Math.round(14 + hash3(h, 2) ** 2 * 9800) };
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class PhoneUI {
  constructor(root, game) {
    this.game = game;
    this.open = false;
    this.cat = 'All';
    this.query = '';
    this.tab = 'shop';
    this.page = null; // product id when a product page is open
    this.qty = 1;
    this.mySize = false;
    this.el = document.createElement('div');
    this.el.className = 'phone-ui interactive';
    this.el.innerHTML = `
      <div class="ph-frame">
        <div class="ph-screen">
          <div class="ph-status"><span class="ph-time">9:41</span><span class="ph-island"></span><span class="ph-icons">${ICON.signal}${ICON.wifi}${ICON.battery}</span></div>
          <div class="hl-app">
            <header class="hl-head">
              <div class="hl-top"><div class="hl-logo">haul<i></i></div><button class="hl-x" aria-label="Put the phone away">${ICON.close}</button></div>
              <label class="hl-search">${ICON.search}<input type="search" placeholder="Search Haul" autocomplete="off" spellcheck="false"></label>
            </header>
            <nav class="hl-cats"></nav>
            <main class="hl-body"></main>
            <footer class="hl-tabs"><button data-tab="shop">${ICON.shop}<span>Shop</span></button><button data-tab="orders">${ICON.orders}<span>Orders</span></button></footer>
          </div>
          <div class="ph-homebar"></div>
        </div>
      </div>`;
    root.appendChild(this.el);
    this.$ = (q) => this.el.querySelector(q);
    this.body = this.$('.hl-body');
    this.search = this.$('.hl-search input');
    this.items = Object.values(CATALOG).filter((d) => d.shop !== false && d.price !== undefined);
    // Popular stuff first (like a real store's front page), then by department and price.
    const FEATURED = ['gpu', 'mantis', 'console', 'controller', 'smartphone', 'basketball', 'donut', 'soda_can', 'duck', 'tv65', 'pc_tower', 'apple', 'gummy_red'];
    const rank = (d) => (FEATURED.includes(d.id) ? FEATURED.indexOf(d.id) : 100 + CATS.indexOf(d.category));
    this.items.sort((a, b) => rank(a) - rank(b) || a.price - b.price);

    // Categories (only ones that have something in them).
    const cats = CATS.filter((c) => c === 'All' || this.items.some((d) => d.category === c));
    this.$('.hl-cats').innerHTML = cats.map((c) => `<button data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    this.$('.hl-cats').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.cat = b.dataset.cat;
      this.page = null;
      this.tab = 'shop';
      this.render();
    });
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim().toLowerCase();
      this.page = null;
      this.tab = 'shop';
      this.render();
    });
    this.search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        this.search.blur();
        this.close();
      }
      e.stopPropagation();
    });
    this.$('.hl-tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      this.tab = b.dataset.tab;
      this.page = null;
      this.render();
    });
    this.$('.hl-x').addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => this._click(e));
    // Don't let clicks on the phone reach the game underneath.
    for (const ev of ['mousedown', 'pointerdown', 'wheel', 'touchstart']) this.el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

    bus.on('phone', (on) => (on ? this.show() : this.hide()));
    bus.on('frame', () => {
      if (this.open && this.game.frame % 30 === 0) this._clock();
    });
  }

  close() {
    // Putting the phone away is a real action (your hand lowers it), so it goes through the hands.
    const h = this.game.player?.hands;
    if (h && h.slots.left?.kind === 'tool' && h.slots.left.ref.id === 'phone') h.togglePhone();
    else this.hide();
  }

  show() {
    if (this.open) return;
    this.open = true;
    this.el.classList.add('show');
    this._clock();
    this.render();
    input.releaseLock();
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.el.classList.remove('show');
    this.search.blur();
  }

  _clock() {
    const d = new Date();
    this.$('.ph-time').textContent = `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  _list() {
    const q = this.query;
    return this.items.filter((d) => {
      if (this.cat !== 'All' && d.category !== this.cat) return false;
      if (!q) return true;
      const hay = `${d.name} ${d.brand || ''} ${d.category} ${d.material}`.toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }

  render() {
    for (const b of this.el.querySelectorAll('.hl-cats button')) b.classList.toggle('on', b.dataset.cat === this.cat && this.tab === 'shop');
    for (const b of this.el.querySelectorAll('.hl-tabs button')) b.classList.toggle('on', b.dataset.tab === this.tab);
    this.el.classList.toggle('in-page', !!this.page);
    if (this.tab === 'orders') return this._renderOrders();
    if (this.page) return this._renderPage(CATALOG[this.page]);
    const list = this._list();
    this.body.scrollTop = 0;
    if (!list.length) {
      this.body.innerHTML = `<div class="hl-empty"><b>No results for “${esc(this.query)}”</b><span>Try another word, like “phone”, “food” or “chair”.</span></div>`;
      return;
    }
    const head = this.query ? `${list.length} result${list.length === 1 ? '' : 's'}` : this.cat === 'All' ? 'Delivered right now, through a rift' : this.cat;
    this.body.innerHTML = `<div class="hl-banner"><b>Sandbox mode</b><span>Everything is free and arrives instantly.</span></div><div class="hl-sub">${esc(head)}</div><div class="hl-grid"></div>`;
    this.body.querySelector('.hl-grid').append(...list.map((d) => this._card(d)));
  }

  // One card per product, made once and reused (its photo is drawn once).
  _card(d) {
    this.cards ||= new Map();
    let card = this.cards.get(d.id);
    if (card) return card;
    const r = rating(d.id);
    card = document.createElement('button');
    card.className = 'hl-card';
    card.dataset.id = d.id;
    card.innerHTML = `<div class="hl-img"></div><div class="hl-name">${esc(d.name)}</div><div class="hl-rate"><span class="st" style="--r:${r.stars / 5}">${ICON.star.repeat(5)}<i>${ICON.star.repeat(5)}</i></span><span>${r.count.toLocaleString('en-US')}</span></div><div class="hl-price">${money(d.price)}</div><div class="hl-ship">${ICON.bolt}Arrives now</div>`;
    if (this.game.thumbs) card.querySelector('.hl-img').appendChild(this.game.thumbs.get(d).canvas);
    this.cards.set(d.id, card);
    return card;
  }

  _renderPage(d) {
    if (!d) {
      this.page = null;
      return this.render();
    }
    const r = rating(d.id);
    const s = this.game.player?.scale ?? 1;
    const deliverScale = this.mySize ? s : 1;
    const sizeNow = d.size * deliverScale;
    const massNow = d.mass * deliverScale ** 3;
    this.body.scrollTop = 0;
    this.body.innerHTML = `
      <div class="hl-pagebar"><button class="hl-back" data-act="back">${ICON.back}<span>Back</span></button></div>
      <div class="hl-hero"></div>
      <div class="hl-pinfo">
        ${d.brand ? `<div class="hl-brand">${esc(d.brand)}</div>` : ''}
        <h2>${esc(d.name)}</h2>
        <div class="hl-rate big"><span class="st" style="--r:${r.stars / 5}">${ICON.star.repeat(5)}<i>${ICON.star.repeat(5)}</i></span><span>${r.stars.toFixed(1)} · ${r.count.toLocaleString('en-US')} ratings</span></div>
        <div class="hl-price big">${money(d.price)} <em>Free in sandbox</em></div>
        <div class="hl-specs">
          <div><span>Size</span><b>${formatLength(sizeNow)}</b></div>
          <div><span>Weight</span><b>${massText(massNow)}</b></div>
          <div><span>Material</span><b class="cap">${esc(d.material)}</b></div>
        </div>
        <div class="hl-opt"><span>Deliver at</span>
          <div class="hl-seg"><button data-act="real" class="${this.mySize ? '' : 'on'}">Real size</button><button data-act="mine" class="${this.mySize ? 'on' : ''}">Your scale (x${s < 0.01 ? s.toExponential(1) : s.toFixed(s < 1 ? 3 : 2)})</button></div>
        </div>
        <div class="hl-opt"><span>Quantity</span>
          <div class="hl-qty"><button data-act="minus" aria-label="Less">−</button><b>${this.qty}</b><button data-act="plus" aria-label="More">+</button></div>
        </div>
        <button class="hl-buy" data-act="buy">${ICON.bolt}<span>Get it now · Free</span></button>
        <p class="hl-note">Arrives through a small rift in front of you, or where you're pointing if that's a floor or table close by.</p>
      </div>`;
    if (this.game.thumbs) this.body.querySelector('.hl-hero').appendChild(this.game.thumbs.copy(d));
  }

  _renderOrders() {
    const orders = this.game.spawner?.orders || [];
    this.body.scrollTop = 0;
    if (!orders.length) {
      this.body.innerHTML = `<div class="hl-empty"><b>No orders yet</b><span>Things you get show up here.</span></div>`;
      return;
    }
    const t = (d) => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.body.innerHTML = `<div class="hl-sub">Your orders</div><div class="hl-orders">${orders.map((o, i) => `
      <button class="hl-order" data-id="${o.id}" data-i="${i}"><div class="hl-oimg"></div><div><b>${esc(o.name)}${o.qty > 1 ? ` x${o.qty}` : ''}</b><span>${o.scale === 1 ? 'Real size' : `At x${o.scale < 0.01 ? o.scale.toExponential(1) : o.scale.toFixed(3)} scale`} · ${t(o.time)}</span><em>Delivered</em></div></button>`).join('')}</div>`;
    if (this.game.thumbs) {
      this.body.querySelectorAll('.hl-order').forEach((el) => {
        const d = CATALOG[el.dataset.id];
        if (d) el.querySelector('.hl-oimg').appendChild(this.game.thumbs.copy(d));
      });
    }
  }

  _click(e) {
    const card = e.target.closest('.hl-card, .hl-order');
    if (card) {
      this.page = card.dataset.id;
      this.tab = 'shop';
      this.qty = 1;
      this.render();
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const d = CATALOG[this.page];
    switch (b.dataset.act) {
      case 'back':
        this.page = null;
        this.render();
        break;
      case 'real':
        this.mySize = false;
        this.render();
        break;
      case 'mine':
        this.mySize = true;
        this.render();
        break;
      case 'minus':
        this.qty = Math.max(1, this.qty - 1);
        this.render();
        break;
      case 'plus':
        this.qty = Math.min(10, this.qty + 1);
        this.render();
        break;
      case 'buy': {
        if (!d || !this.game.spawner) return;
        const scale = this.mySize ? this.game.player.scale : 1;
        this.game.spawner.order(d, { scale, qty: this.qty });
        bus.emit('toast', `Rift delivery: ${this.qty > 1 ? `${this.qty} x ` : ''}${d.name}`);
        b.classList.add('done');
        b.querySelector('span').textContent = 'On its way!';
        setTimeout(() => {
          if (b.isConnected) {
            b.classList.remove('done');
            b.querySelector('span').textContent = 'Get it now · Free';
          }
        }, 1200);
        break;
      }
    }
  }
}
