// The Vireo phone's screen: home, Spawn (shop), Build, Flashlight, Weather, Bank, Lab Notes...

import { h } from './ui.js';
import { CATALOG, ROOMS, STYLES, TABS, getItem, resolve, defaultOptions, buildSpec, tabOf } from '../items/catalog.js';
import { specBounds } from '../items/builder.js';
import { productPhoto } from '../items/photo.js';
import { settings } from '../core/settings.js';
import { moonPhaseName } from '../core/time.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const stars = (r) => '★★★★★'.slice(0, Math.round(r)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(r));

export class PhoneUI {
  constructor(root, svc) {
    this.svc = svc;
    this.el = h('div', { class: 'phone-screen' });
    root.append(this.el);
    this.stack = [];
    this.shop = { tab: 'furniture', room: 'All', style: 'All', aisle: 'All', q: '' };
    this.el.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  show(on) {
    this.el.classList.toggle('on', on);
    if (on && !this.stack.length) this.go('home');
    if (on) this.refreshTop();
  }

  setTransform(css) { if (css) this.el.style.transform = css; }

  go(page, arg) {
    this.stack.push({ page, arg });
    this.render();
  }

  back() {
    if (this.stack.length > 1) this.stack.pop();
    this.render();
  }

  home() { this.stack = [{ page: 'home' }]; this.render(); }

  render() {
    const { page, arg } = this.stack[this.stack.length - 1];
    this.el.innerHTML = '';
    const light = !['home', 'notes', 'rift'].includes(page);
    this.el.className = `phone-screen on ${light ? 'ph-light' : ''}`;
    const body = this[`page_${page}`] ? this[`page_${page}`](arg) : this.page_soon(page);
    this.el.append(body);
    this.status = h('div', { class: 'ph-status' }, h('span', { class: 'time' }, this.svc.clock().formatTime().replace(/ [AP]M/, '')), h('span', { class: 'right' }, '🛰 SAT', h('span', { class: 'ph-batt' })));
    this.el.append(h('div', { class: 'ph-island' }), this.status, h('div', { class: `ph-home-bar ${light ? 'dark' : ''}`, onclick: () => { this.svc.sound('click'); this.home(); } }));
  }

  refreshTop() {
    if (!this.status) return;
    const t = this.status.querySelector('.time');
    if (t) t.textContent = this.svc.clock().formatTime().replace(/ [AP]M/, '');
    const clk = this.el.querySelector('.ph-clock');
    if (clk) clk.textContent = this.svc.clock().formatTime().replace(/ [AP]M/, '');
  }

  header(title, sub) {
    return [h('div', { class: 'ph-head' }, this.stack.length > 1 ? h('span', { class: 'ph-back', onclick: () => { this.svc.sound('click'); this.back(); } }, '‹') : null, h('div', { class: 'ph-title' }, title)), sub ? h('div', { class: 'ph-sub' }, sub) : null];
  }

  // ---------------- home ----------------
  page_home() {
    const c = this.svc.clock();
    const app = (icon, label, bg, onclick, extra = '') => h('div', { class: `ph-app ${extra}`, onclick: () => { this.svc.sound('click'); onclick(); } }, h('i', { style: `background:${bg}` }, icon), h('span', {}, label));
    const flashOn = this.svc.flashlight();
    return h('div', { class: 'ph-page', style: 'padding-top:0' },
      h('div', { class: 'ph-wall' }),
      h('div', { style: 'position:relative;padding-top:70px' },
        h('div', { class: 'ph-clock' }, c.formatTime().replace(/ [AP]M/, '')),
        h('div', { class: 'ph-date' }, c.formatDate().replace(/, \d{4}$/, '')),
        h('div', { class: 'ph-grid' },
          app('🛍️', 'Spawn', 'linear-gradient(135deg,#ff7a59,#ff3d77)', () => this.go('shop')),
          app('🔨', 'Build', 'linear-gradient(135deg,#ffd166,#f4a40b)', () => this.go('build')),
          app('⛅', 'Weather', 'linear-gradient(135deg,#5ac8fa,#2f7ff5)', () => this.go('weather')),
          app('🏦', 'Bank', 'linear-gradient(135deg,#34c759,#0f9d58)', () => this.go('bank')),
          app('📝', 'Lab Notes', 'linear-gradient(135deg,#fff3b0,#f7d154)', () => this.go('notes')),
          app('🗺️', 'Map', 'linear-gradient(135deg,#a8e063,#56ab2f)', () => this.go('map')),
          app('📷', 'Camera', 'linear-gradient(135deg,#8e9196,#3a3d42)', () => this.go('camera')),
          app('🐝', 'Buzzr', 'linear-gradient(135deg,#ffcc00,#ff9500)', () => this.go('buzzr')),
          app('💬', 'Messages', 'linear-gradient(135deg,#5ef08a,#21c45a)', () => this.go('messages')),
          app('🎵', 'Music', 'linear-gradient(135deg,#ff5e7e,#d6246e)', () => this.go('music')),
          app('❤️', 'Vitals', 'linear-gradient(135deg,#ffffff,#ffe1e6)', () => this.go('vitals')),
          app('🌀', 'Rift', 'linear-gradient(135deg,#2a2140,#7d5cff)', () => this.go('rift')),
          app('⚙️', 'Settings', 'linear-gradient(135deg,#9ea3ad,#5f646d)', () => this.svc.openSettings()),
        ),
      ),
      h('div', { class: 'ph-dock' },
        app('🔦', 'Flashlight', flashOn ? '#fff8d6' : 'rgba(255,255,255,0.22)', () => { this.svc.setFlashlight(!this.svc.flashlight()); this.render(); }, flashOn ? 'on' : ''),
        app('🛍️', 'Spawn', 'linear-gradient(135deg,#ff7a59,#ff3d77)', () => this.go('shop')),
        app('🔨', 'Build', 'linear-gradient(135deg,#ffd166,#f4a40b)', () => this.go('build')),
        app('⏩', 'Time', 'linear-gradient(135deg,#bf5af2,#7d2ae8)', () => this.go('time')),
      ),
    );
  }

  // ---------------- Spawn (shop) ----------------
  page_shop() {
    const s = this.shop;
    const pay = this.svc.payMode();
    const tabs = h('div', { class: 'ph-tabs' }, TABS.map((t) => h('div', { class: `ph-tab ${s.tab === t.id ? 'on' : ''} ${t.ready ? '' : 'locked'}`, onclick: () => { this.svc.sound('click'); s.tab = t.id; this.render(); } }, `${t.icon} ${t.label}`)));
    const search = h('input', { type: 'text', placeholder: s.tab === 'food' ? 'Search apples, milk, chips...' : 'Search sofas, beds, fridge...', value: s.q });
    search.addEventListener('input', () => { s.q = search.value; drawCards(); });
    search.addEventListener('keydown', (e) => e.stopPropagation());
    const rooms = h('div', { class: 'ph-tabs' }, ['All', ...ROOMS].map((r) => h('div', { class: `ph-tab ${s.room === r ? 'on' : ''}`, onclick: () => { s.room = r; this.render(); } }, r)));
    const styles = h('div', { class: 'ph-tabs' }, ['All', ...Object.keys(STYLES)].map((st) => h('div', { class: `ph-tab ${s.style === st ? 'on' : ''}`, onclick: () => { s.style = st; this.render(); } }, st === 'All' ? 'All styles' : STYLES[st])));
    const aisles = h('div', { class: 'ph-tabs' }, ['All', ...Object.keys(AISLES)].map((a) => h('div', { class: `ph-tab ${s.aisle === a ? 'on' : ''}`, onclick: () => { s.aisle = a; this.render(); } }, a === 'All' ? 'All aisles' : AISLES[a])));
    const cards = h('div', { class: 'ph-cards' });
    const drawCards = () => {
      cards.innerHTML = '';
      const q = s.q.trim().toLowerCase();
      const furn = s.tab === 'furniture', food = s.tab === 'food';
      const list = CATALOG.filter((it) => it.shop !== false && tabOf(it) === s.tab && (!furn || s.room === 'All' || it.room === s.room) && (!furn || s.style === 'All' || it.style === s.style)
        && (!food || s.aisle === 'All' || it.aisle === s.aisle)
        && (!q || `${it.name} ${it.brand} ${it.room || ''} ${it.aisle || ''} ${it.blurb}`.toLowerCase().includes(q)));
      if (!list.length) cards.append(h('div', { class: 'ph-center', style: 'grid-column:1/3' }, 'Nothing found. Try "sofa" or "lamp".'));
      for (const it of list) {
        const img = h('img', { alt: it.name });
        cards.append(h('div', { class: 'ph-card', onclick: () => { this.svc.sound('click'); this.go('product', { id: it.id, chosen: defaultOptions(it) }); } },
          img, h('div', { class: 't' }, it.name), h('div', { class: 'b' }, it.brand),
          h('div', { class: 'p' }, money(it.price), h('small', {}, `${it.rating.toFixed(1)}★ (${it.reviews.toLocaleString()})`))));
        if (it.food && it.price < 10) cards.lastChild.querySelector('.p').firstChild.textContent = '$' + it.price.toFixed(2);
        // render photos a few at a time so the phone stays smooth
        this.queuePhoto(img, it.id, defaultOptions(it));
      }
    };
    const page = h('div', { class: 'ph-page' }, ...this.header('Spawn', pay ? `Pay mode · balance ${money(this.svc.money())}` : 'Free mode · real prices shown'));
    page.append(h('div', { class: 'ph-search' }, '🔍', search), tabs);
    const tab = TABS.find((t) => t.id === s.tab);
    if (!tab.ready) {
      page.append(h('div', { class: 'ph-center' }, h('div', { style: 'font-size:44px' }, tab.icon), h('h3', { style: 'color:#121316' }, `${tab.label} is coming soon`), `This tab gets filled in a later piece of the build. Furniture is first, then ${tab.id === 'food' ? 'Food (it\'s next!)' : 'Food + everyday stuff'}.`));
      return page;
    }
    if (s.tab === 'furniture') page.append(rooms, styles);
    if (s.tab === 'food') page.append(aisles);
    page.append(cards);
    drawCards();
    return page;
  }

  queuePhoto(img, id, chosen) {
    (this.photoQ ||= []).push({ img, id, chosen });
    if (this.photoTimer) return;
    const tick = () => {
      const job = this.photoQ.shift();
      if (!job) { this.photoTimer = null; return; }
      if (job.img.isConnected) job.img.src = productPhoto(this.svc.renderer, job.id, job.chosen);
      this.photoTimer = setTimeout(tick, 16);
    };
    this.photoTimer = setTimeout(tick, 16);
  }

  page_product({ id, chosen }) {
    const it = getItem(id);
    const { price } = resolve(it, chosen);
    const spec = buildSpec(it, chosen);
    const b = specBounds(spec);
    const imperial = settings.units === 'imperial';
    const dim = (m) => imperial ? `${Math.round(m * 39.37)}"` : `${Math.round(m * 100)} cm`;
    const massTxt = spec.mass < 1
      ? (imperial ? `${(spec.mass * 35.274).toFixed(spec.mass < 0.3 ? 1 : 0)} oz` : `${Math.round(spec.mass * 1000)} g`)
      : spec.mass < 10 ? (imperial ? `${(spec.mass * 2.2046).toFixed(1)} lb` : `${spec.mass.toFixed(1)} kg`)
        : (imperial ? `${Math.round(spec.mass * 2.2046)} lb` : `${Math.round(spec.mass)} kg`);
    const dimTxt = (m) => (m < 0.3 ? (imperial ? `${(m * 39.37).toFixed(1)}"` : `${(m * 100).toFixed(1)} cm`) : dim(m));
    const sizeLine = `${dimTxt(b.max.x - b.min.x)} W × ${dimTxt(b.max.z - b.min.z)} D × ${dimTxt(b.max.y - b.min.y)} H`;
    const hero = h('img', { class: 'ph-hero', src: productPhoto(this.svc.renderer, id, chosen) });
    const page = h('div', { class: 'ph-page', style: 'padding-top:50px' },
      h('div', { class: 'ph-head', style: 'position:absolute;top:50px;left:0;z-index:2' }, h('span', { class: 'ph-back', onclick: () => { this.svc.sound('click'); this.back(); } }, '‹')),
      hero,
      h('div', { class: 'ph-prod' },
        h('h3', {}, it.name), h('div', { class: 'brand' }, it.brand),
        h('div', { style: 'margin-top:6px' }, h('span', { class: 'ph-stars' }, stars(it.rating)), ` ${it.rating.toFixed(1)} · ${it.reviews.toLocaleString()} reviews`),
        h('div', { class: 'price' }, it.food && price < 10 ? '$' + price.toFixed(2) : money(price)),
        h('div', {},
          ...(it.food ? foodBadges(it.food) : [it.flatpack ? h('span', { class: 'ph-badge box' }, '📦 Flat-pack: comes in a box') : h('span', { class: 'ph-badge' }, '✔ Comes assembled')]),
          it.power ? h('span', { class: 'ph-badge warn' }, `⚡ Needs power (${it.power} W)`) : null,
          it.sleep ? h('span', { class: 'ph-badge' }, `💤 You can sleep on it`) : null,
          h('span', { class: 'ph-badge' }, `⚖ ${massTxt}`), h('span', { class: 'ph-badge' }, `📐 ${sizeLine}`)),
        h('p', {}, it.blurb),
        it.food ? nutritionPanel(it) : null,
        ...Object.entries(it.options || {}).map(([k, opt]) => [
          h('div', { class: 'ph-opt' }, opt.label),
          h('div', { class: 'ph-chips' }, opt.choices.map((c) => {
            const on = (chosen[k] ?? opt.def) === c.id;
            const delta = c.mult ? Math.round(it.price * (c.mult - 1)) : (c.price || 0);
            return h('div', { class: `ph-chip ${on ? 'on' : ''}`, onclick: () => {
              this.svc.sound('click');
              const next = { ...chosen, [k]: c.id };
              this.stack[this.stack.length - 1].arg = { id, chosen: next };
              this.render();
            } }, c.label, delta ? h('em', {}, `${delta > 0 ? '+' : '−'}${money(Math.abs(delta))}`) : null);
          })),
        ]).flat(),
        h('div', { class: 'ph-opt' }, 'Reviews'),
        ...(it.quotes || []).map((q) => h('div', { class: 'ph-quote' }, h('span', { class: 'ph-stars' }, stars(Math.max(3, Math.round(it.rating - Math.random())))), h('br'), q)),
      ),
    );
    const pay = this.svc.payMode();
    const canAfford = !pay || this.svc.money() >= price;
    const buy = h('div', { class: `ph-buy ${canAfford ? '' : 'disabled'}`, onclick: () => {
      if (!canAfford) { this.svc.sound('error'); this.svc.toast(`Not enough money. You have ${money(this.svc.money())}.`); return; }
      this.svc.sound('click');
      this.svc.spawn(id, chosen, price);
    } }, pay ? (canAfford ? `Buy · ${money(price)}` : `Need ${money(price - this.svc.money())} more`) : 'Spawn it');
    const wrap = h('div', {}, page, buy);
    return wrap;
  }

  // ---------------- Build ----------------
  page_build() {
    const on = this.svc.buildActive();
    const sw = h('div', { class: `ph-switch ${on ? 'on' : ''}`, onclick: () => { this.svc.sound('click'); this.svc.setBuild(!this.svc.buildActive()); this.render(); } });
    return h('div', { class: 'ph-page' }, ...this.header('Build', 'Move anything like a god tool.'),
      h('div', { class: 'ph-section' },
        h('div', { class: 'ph-row' }, h('b', {}, 'Build mode'), sw),
        h('div', { class: 'ph-row' }, 'Pick up / set down', h('span', {}, 'Click')),
        h('div', { class: 'ph-row' }, 'Turn it', h('span', {}, 'Scroll (Shift = fine)')),
        h('div', { class: 'ph-row' }, 'Freeze in place', h('span', {}, 'R')),
        h('div', { class: 'ph-row' }, 'Delete', h('span', {}, 'X')),
        h('div', { class: 'ph-row' }, 'Undo', h('span', {}, 'Z')),
        h('div', { class: 'ph-row' }, 'Build mode on/off', h('span', {}, 'B')),
        h('p', { style: 'color:#6b6f78;font-size:13px;line-height:1.5' }, 'Without build mode you use your real hands: hold left-click to grab, heavy stuff drags, swing + let go to toss, hold right-click to wind up a throw.'),
      ));
  }

  // ---------------- Weather + time ----------------
  page_weather() {
    const c = this.svc.clock(), sky = this.svc.sky();
    const w = this.svc.weather();
    const imperial = settings.units === 'imperial';
    const temp = imperial ? `${Math.round(w.tempC * 9 / 5 + 32)}°` : `${Math.round(w.tempC)}°`;
    return h('div', { class: 'ph-page', style: 'background:linear-gradient(180deg,#3a7bd5,#6aa9e8);color:#fff' },
      h('div', { style: 'text-align:center;margin-top:30px;font-size:22px;font-weight:600' }, 'Empty World'),
      h('div', { class: 'ph-big' }, temp),
      h('div', { style: 'text-align:center;font-size:18px' }, w.desc),
      h('div', { style: 'text-align:center;opacity:0.85;margin-top:4px' }, `Wind ${imperial ? Math.round(w.windMs * 2.237) + ' mph' : Math.round(w.windMs * 3.6) + ' km/h'} · Clouds ${Math.round(w.clouds * 100)}%`),
      h('div', { class: 'ph-section', style: 'margin-top:26px' },
        ...[['Time', c.formatTime()], ['Date', c.formatDate()], ['Season', c.season()[0].toUpperCase() + c.season().slice(1)], ['Sun', `${sky.state.sunAlt > 0 ? 'up' : 'down'} (${sky.state.sunAlt.toFixed(0)}° high)`], ['Sunrise', w.sunrise], ['Sunset', w.sunset], ['Moon', `${moonPhaseName(sky.state.phase)} · ${Math.round(sky.state.moonIllum * 100)}% lit`]]
          .map(([k, v]) => h('div', { class: 'ph-row', style: 'border-color:rgba(255,255,255,0.25)' }, h('span', {}, k), h('b', {}, v)))));
  }

  page_time() {
    const c = this.svc.clock();
    const opts = [1, 10, 100, 1000];
    return h('div', { class: 'ph-page ph-dark', style: 'background:#0d0e12;color:#eef0f6' }, ...this.header('Time'),
      h('div', { class: 'ph-big' }, c.formatTime()),
      h('div', { class: 'ph-center', style: 'padding:10px 30px;color:#9aa0ab' }, 'Fast-forward makes the world live faster: the sun moves, plants grow, food spoils. You still move at normal speed.'),
      h('div', { class: 'ph-chips', style: 'justify-content:center;padding:0 20px' }, opts.map((m) => h('div', { class: `ph-chip ${c.fastForward === m ? 'on' : ''}`, style: 'background:#1b1d23;color:#fff;border-color:' + (c.fastForward === m ? '#fff' : '#333'), onclick: () => { this.svc.sound('click'); this.svc.setFastForward(m); this.render(); } }, m === 1 ? 'Normal' : `x${m}`))));
  }

  page_bank() {
    const pay = this.svc.payMode();
    return h('div', { class: 'ph-page' }, ...this.header('Bank', 'Coast Federal'),
      h('div', { class: 'ph-big', style: 'font-weight:600;font-size:48px' }, pay ? money(this.svc.money()) : '∞'),
      h('div', { class: 'ph-center', style: 'padding-top:6px' }, pay ? 'Checking account. Spawning things costs real prices in Pay mode.' : 'Free mode: spawning costs nothing. Prices are still shown so you know what things really cost.'),
      h('div', { class: 'ph-section' }, ...(this.svc.transactions() || []).slice(-12).reverse().map((t) => h('div', { class: 'ph-row' }, h('span', {}, t.what), h('b', {}, `−${money(t.amount)}`)))));
  }

  page_notes() {
    return h('div', { class: 'ph-note' },
      h('h2', { style: 'margin:0 0 4px' }, 'Lab Notes'),
      h('div', { style: 'opacity:0.6;font-size:13px;margin-bottom:16px' }, 'The Rift Tool · prototype R-1'),
      h('p', {}, 'Day 412. The rift field finally held for 3 seconds. A coffee mug went from 9 cm tall to about the size of a grain of rice. It kept its shape. The coffee shrank with it.'),
      h('p', {}, 'Things to remember: the square-cube law is real. Shrink something to half size and it weighs an eighth. Grow it and it gets heavy FAST.'),
      h('p', {}, 'Battery is the problem. Big jobs drain it. Need a better cell.'),
      h('p', { style: 'opacity:0.6' }, '(The Rift Tool shows up in a later piece of the build.)'));
  }

  // ---------------- Rift (your size + the tool) ----------------
  page_rift() {
    const r = this.svc.rift(), p = this.svc.player();
    const page = h('div', { class: 'ph-page ph-dark', style: 'background:#0b0a12;color:#eceaf6' }, ...this.header('Rift', 'The Rift Tool · prototype R-1'));
    if (!r || !p) return page;
    const imperial = settings.units === 'imperial';
    const fmt = (m) => (imperial ? (m < 0.3 ? `${(m * 39.37).toFixed(m < 0.05 ? 2 : 1)} in` : `${(m * 3.28084).toFixed(1)} ft`) : (m < 1 ? `${(m * 100).toFixed(m < 0.1 ? 1 : 0)} cm` : `${m.toFixed(2)} m`));
    // slider is logarithmic: 0.03x .. 8x
    const lo = Math.log(0.03), hi = Math.log(8);
    const toSlider = (k) => Math.round(((Math.log(k) - lo) / (hi - lo)) * 1000);
    const fromSlider = (v) => Math.exp(lo + (v / 1000) * (hi - lo));
    const label = h('div', { class: 'ph-big', style: 'font-size:46px;font-weight:600' }, fmt(1.8 * p.size));
    const sub = h('div', { style: 'text-align:center;color:#a99fd6;font-size:13px' }, `x${p.size.toFixed(p.size < 0.1 ? 3 : 2)} · weight ${(75 * p.size ** 3).toFixed(p.size < 0.3 ? 3 : 1)} kg · strength x${(p.size ** 2).toFixed(2)}`);
    const slider = h('input', { type: 'range', min: 0, max: 1000, value: toSlider(this.riftGoal ?? p.size), style: 'width:100%;accent-color:#9b7dff' });
    slider.addEventListener('input', () => { const k = fromSlider(+slider.value); this.riftGoal = k; label.textContent = fmt(1.8 * k); });
    slider.addEventListener('change', () => { this.svc.sound('click'); this.svc.setSelfSize(fromSlider(+slider.value)); });
    const batt = r.batteryMode === 'unlimited' ? '∞' : `${Math.round(r.battery)}%`;
    page.append(label, sub,
      h('div', { class: 'ph-section', style: 'margin-top:18px' }, h('div', { style: 'font-size:12px;color:#8b84ad;margin-bottom:6px' }, 'YOUR SIZE (slide, then let go)'), slider,
        h('div', { style: 'display:flex;justify-content:space-between;font-size:11px;color:#6f688f' }, h('span', {}, 'ant-ish'), h('span', {}, 'normal'), h('span', {}, 'giant'))),
      h('div', { class: 'ph-section', style: 'margin-top:16px' },
        h('div', { class: 'ph-row', style: 'border-color:#2a2740' }, h('span', {}, 'Battery'), h('b', {}, `${batt}${r.batteryMode === 'real' ? ' · charges near a power source' : r.batteryMode === 'recharge' ? ' · self-recharging' : ''}`)),
        h('div', { class: 'ph-row', style: 'border-color:#2a2740' }, h('span', {}, 'Take it out / put away'), h('b', {}, 'G')),
        h('div', { class: 'ph-row', style: 'border-color:#2a2740' }, h('span', {}, 'Shrink / grow'), h('b', {}, 'hold LMB / RMB')),
        h('div', { class: 'ph-row', style: 'border-color:#2a2740' }, h('span', {}, 'Aim at yourself'), h('b', {}, 'V')),
        h('div', { class: 'ph-buy', style: 'position:static;margin:14px 0 6px;background:#7d5cff', onclick: () => { this.svc.sound('click'); this.svc.equipRift(); } }, '🌀 Take out the Rift Tool'),
        h('div', { class: 'ph-buy', style: 'position:static;margin:6px 0;background:#2a2740', onclick: () => { this.svc.sound('click'); this.riftGoal = 1; this.svc.setSelfSize(1); this.render(); } }, 'Back to normal size'),
        h('p', { style: 'color:#8b84ad;font-size:12.5px;line-height:1.5' }, 'Real scaling: half your size = 1/8 your weight but only 1/4 your strength. Tiny you falls slowly and shrugs off drops; giant you breaks under big falls.')));
    return page;
  }

  // ---------------- Vitals (your body) ----------------
  page_vitals() {
    const n = this.svc.needs();
    const page = h('div', { class: 'ph-page' }, ...this.header('Vitals', 'Vireo Health'));
    if (!n || n.mode === 'off') { page.append(h('div', { class: 'ph-center' }, 'Hunger, thirst + sleep are turned off (Settings → Gameplay).')); return page; }
    const w = n.words();
    const imperial = settings.units === 'imperial';
    const ring = (label, val, word, col) => h('div', { class: 'ph-ring' },
      h('div', { class: 'ring', style: `background:conic-gradient(${col} ${Math.round(val * 100)}%, #e8e9ee 0)` }, h('div', { class: 'in' }, `${Math.round(val * 100)}%`)),
      h('b', {}, label), h('span', {}, word));
    page.append(h('div', { class: 'ph-rings' },
      ring('Food', 1 - n.hunger, w.food, '#ff9f43'),
      ring('Water', 1 - Math.min(1, n.thirst), w.water, '#2f9bff'),
      ring('Energy', 1 - Math.min(1, n.tiredness), w.sleep, '#8e6bff')));
    const L = n.log, vol = (l) => imperial ? `${Math.round(l * 33.814)} fl oz` : `${l.toFixed(2)} L`;
    const kg = (k) => imperial ? `${Math.round(k * 2.2046)} lb` : `${k.toFixed(1)} kg`;
    const rows = [
      ['Eaten today', `${Math.round(L.kcalIn)} kcal`], ['Burned today', `${Math.round(L.kcalOut)} kcal`], ['Drank today', vol(L.waterIn)],
      ['Awake for', `${n.awakeH.toFixed(1)} h`], ['Last sleep', L.lastSleepH ? `${L.lastSleepH.toFixed(1)} h` : '—'],
      ['Caffeine', `${Math.round(n.caffeineMg)} mg`], ['Weight', kg(n.weightKg)], ['Condition', w.sick || (n.sick ? 'You ate something risky… 😬' : 'Healthy')],
    ];
    page.append(h('div', { class: 'ph-section' }, ...rows.map(([k, v]) => h('div', { class: 'ph-row' }, h('span', {}, k), h('b', {}, v)))));
    page.append(h('div', { class: 'ph-section', style: 'margin-top:14px' },
      h('div', { class: 'ph-buy', style: 'position:static;margin:6px 0', onclick: () => { this.svc.sound('click'); this.svc.sleepHere(); } }, '💤 Sleep here (on the ground)'),
      h('p', { style: 'color:#6b6f78;font-size:12.5px;line-height:1.5' }, 'Beds sleep best. Click a mattress, bed or sofa to sleep on it. You wake up on your own once you\'re rested (or if you get really hungry or thirsty).')));
    return page;
  }

  page_soon(page) {
    const info = {
      map: ['🗺️', 'Map', 'A real map of your world with GPS is coming.'],
      camera: ['📷', 'Camera', 'Photos, videos and your gallery are coming.'],
      buzzr: ['🐝', 'Buzzr', 'No one to follow yet. People + going viral come with the People piece.'],
      messages: ['💬', 'Messages', 'No contacts yet.'],
      music: ['🎵', 'Music', 'Your music + speakers come later. The game music setting is in Settings → Sound.'],
    }[page] || ['📱', page, 'Coming soon.'];
    return h('div', { class: 'ph-page' }, ...this.header(info[1]), h('div', { class: 'ph-center' }, h('div', { style: 'font-size:54px' }, info[0]), info[2]));
  }
}

const AISLES = { produce: 'Produce', drinks: 'Drinks', bakery: 'Bakery', snacks: 'Snacks', fridge: 'Dairy + meat', frozen: 'Frozen', pantry: 'Pantry' };

function foodBadges(f) {
  const out = [];
  out.push(h('span', { class: 'ph-badge' }, f.keep === 'freezer' ? '❄️ Keep frozen' : f.keep === 'fridge' ? '🧊 Keep refrigerated' : '🏠 Store at room temp'));
  if (f.units) out.push(h('span', { class: 'ph-badge box' }, `📦 ${f.units} inside`));
  if (f.raw) out.push(h('span', { class: 'ph-badge warn' }, '🔥 Cook before eating'));
  if (f.open === 'knife') out.push(h('span', { class: 'ph-badge warn' }, '🔪 Needs a knife'));
  return out;
}

function shelfText(f) {
  const d = (x) => (x >= 365 ? `${Math.round(x / 365 * 10) / 10} yr` : x >= 60 ? `${Math.round(x / 30)} mo` : x >= 14 ? `${Math.round(x / 7)} wk` : x >= 1 ? `${Math.round(x)} day${Math.round(x) === 1 ? '' : 's'}` : `${Math.round(x * 24)} h`);
  const sh = f.shelf || {};
  const bits = [];
  if (sh.room) bits.push(`${d(sh.room)} on the counter`);
  if (sh.fridge) bits.push(`${d(sh.fridge)} in the fridge`);
  if (sh.freezer) bits.push(`${d(sh.freezer)} frozen`);
  return `Keeps about ${bits.join(', ')}${sh.opened ? `; ${d(sh.opened)} once opened` : ''}.`;
}

// a real-looking Nutrition Facts panel for the whole thing
function nutritionPanel(it) {
  const f = it.food;
  const unit = f.units ? getItem(f.unitId) : null;
  const e = (unit ? unit.food.eat : f.eat) || {};
  const row = (label, v, unitTxt, bold = true, indent = false) => (v == null ? null : h('div', { class: `nf-row ${indent ? 'ind' : ''}` }, h('span', {}, bold ? h('b', {}, label) : label, ` ${Math.round(v * 10) / 10}${unitTxt}`)));
  return h('div', { class: 'nf' },
    h('div', { class: 'nf-title' }, 'Nutrition Facts'),
    h('div', { class: 'nf-serv' }, unit ? `Per ${unit.name.toLowerCase()} · ${f.units} per pack` : 'Whole package'),
    h('div', { class: 'nf-cal' }, h('b', {}, 'Calories'), h('b', {}, `${Math.round(e.kcal || 0)}`)),
    row('Total Fat', e.fatG, 'g'), row('Sodium', e.sodiumMg, 'mg'), row('Total Carbohydrate', e.carbsG, 'g'),
    row('Dietary Fiber', e.fiberG, 'g', false, true), row('Total Sugars', e.sugarG, 'g', false, true), row('Protein', e.proteinG, 'g'),
    e.caffeineMg ? row('Caffeine', e.caffeineMg, 'mg') : null,
    h('div', { class: 'nf-foot' }, shelfText(f)));
}
