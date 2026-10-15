'use strict';
// Buy It All — game logic and rendering. Depends on data.js.

const SAVE_KEY = 'buy-it-all-save-v1';
const DAY_START = 7;   // 07:00
const DAY_END = 26;    // 02:00 the next morning — you must sleep after this
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STAT_KEYS = ['hunger', 'thirst', 'energy', 'fun', 'health'];
const STAT_META = {
  hunger: { icon: '🍔', name: 'Food' },
  thirst: { icon: '💧', name: 'Drink' },
  energy: { icon: '⚡', name: 'Energy' },
  fun:    { icon: '😄', name: 'Fun' },
  health: { icon: '❤️', name: 'Health' },
};

let S = null;

// ---------- helpers ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round2 = n => Math.round(n * 100) / 100;
function gauss() {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function money(n, compact) {
  const neg = n < 0;
  n = Math.abs(n);
  let s;
  if (compact && n >= 1e9) s = (n / 1e9).toFixed(2) + 'B';
  else if (compact && n >= 1e6) s = (n / 1e6).toFixed(2) + 'M';
  else if (n < 100 && Math.round(n * 100) % 100 !== 0) s = n.toFixed(2);
  else s = Math.round(n).toLocaleString('en-US');
  return (neg ? '-$' : '$') + s;
}
function clock(h) {
  const hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60) % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
function dur(h) {
  const hh = Math.floor(h + 1e-9), mm = Math.round((h - hh) * 60);
  return (hh ? hh + 'h' : '') + (mm ? (hh ? ' ' : '') + mm + 'm' : '') || '0m';
}
const weekday = d => WEEKDAYS[(d - 1) % 7];

// ---------- state ----------
function newState() {
  return {
    v: 1,
    money: 1500,
    day: 1,
    hour: DAY_START,
    stats: { hunger: 75, thirst: 70, energy: 90, fun: 60, health: 100 },
    job: 'none',
    shifts: 0,
    workedToday: false,
    overtimeToday: false,
    owned: [],          // non-consumables: {uid, id, paid, day, val?, placed?}
    cons: { water: 3, noodles: 3, apple: 2 }, // consumables: id -> count
    ever: {},           // ids ever bought (collection)
    nextUid: 1,
    pc: {},             // slot -> uid
    mining: false,
    home: 'room',
    homes: [],          // ids of homes you own
    housing: 1,         // housing price index
    bank: { savings: 0, loan: 0 },
    stocks: STOCKS.map(s => ({ sym: s.sym, price: s.price, hist: [s.price] })),
    holdings: {},       // sym -> {sh, cost}
    sales: {},          // cat -> {mult, until}
    market: { gpu: 1, gpuUntil: 0, chip: 1, chipUntil: 0, heat: 0 },
    followers: 0,
    eaten: 0,
    ach: {},
    life: { earned: 0, spent: 0, hospital: 0, biggestWin: 0 },
    news: [
      '👋 Welcome to the city! You have $1,500, an empty shared room and big dreams.',
      '💼 Head to <b>Work</b> to get a job, grab food and water at <b>FreshMart</b>, and remember to sleep.',
      '🏆 Goal: buy it all — every item in every store. Rent is due every 7 days.',
    ],
    tab: 'home',
    store: 'grocery',
  };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    const fresh = newState();
    const merged = Object.assign(fresh, s);
    merged.stats = Object.assign(fresh.stats, s.stats);
    merged.life = Object.assign(newState().life, s.life);
    merged.market = Object.assign(newState().market, s.market);
    // keep stock list in sync with data
    merged.stocks = STOCKS.map(d => (s.stocks || []).find(x => x.sym === d.sym) || { sym: d.sym, price: d.price, hist: [d.price] });
    merged.owned = (s.owned || []).filter(o => ITEM[o.id]);
    return merged;
  } catch (e) {
    return null;
  }
}

// ---------- derived values ----------
const itemOf = o => ITEM[o.id];
const findOwned = uid => S.owned.find(o => o.uid === uid);
const countOwned = id => S.owned.filter(o => o.id === id).length;
const ownedCat = cat => S.owned.filter(o => itemOf(o).cat === cat);
const placedFurniture = () => S.owned.filter(o => itemOf(o).cat === 'furniture' && o.placed);
const vehicles = () => ownedCat('vehicles');
const pets = () => ownedCat('pets');
const home = () => HOME[S.home];
const ownsHome = id => S.homes.includes(id);

function hasPerk(p) {
  return S.owned.some(o => {
    const it = itemOf(o);
    return it.perk === p && (it.cat !== 'furniture' || o.placed);
  });
}
const maxOf = (list, key) => list.reduce((m, o) => Math.max(m, itemOf(o)[key] || 0), 0);
const sumOf = (list, key) => list.reduce((m, o) => m + (itemOf(o)[key] || 0), 0);
const bedTier = () => maxOf(placedFurniture(), 'bed');
const comfort = () => sumOf(placedFurniture(), 'comfort');
const bestTV = () => maxOf(placedFurniture(), 'tv');
const suitLevel = () => maxOf(ownedCat('clothing'), 'suit');
const petFun = () => sumOf(pets(), 'petFun');

function commute() {
  let c = 1;
  for (const o of vehicles()) { const it = itemOf(o); if (it.commute) c = Math.min(c, it.commute); }
  return c;
}
const commuteName = () => {
  let best = null;
  for (const o of vehicles()) { const it = itemOf(o); if (it.commute && (!best || it.commute < best.commute)) best = it; }
  return best ? best.name.toLowerCase() : 'on foot';
};
const hasCar = () => vehicles().some(o => itemOf(o).car);
const hasRide = () => vehicles().some(o => itemOf(o).commute);
const garageCap = () => home().garage + 1; // +1 street parking
const garageUsed = () => vehicles().filter(o => !itemOf(o).noGarage).length;

function pcInfo() {
  const parts = {};
  let raw = 0;
  for (const sl of PC_SLOTS) {
    const uid = S.pc[sl.id];
    if (!uid) continue;
    const o = findOwned(uid);
    if (!o) { delete S.pc[sl.id]; continue; }
    parts[sl.id] = itemOf(o);
    raw += parts[sl.id].score || 0;
  }
  const missing = PC_SLOTS.filter(sl => sl.req && !parts[sl.id]).map(sl => sl.name);
  const watts = (parts.cpu ? parts.cpu.watt : 0) + (parts.gpu ? parts.gpu.watt : 0) + 100;
  const cap = parts.psu ? parts.psu.cap : 0;
  const psuOk = !parts.psu || watts <= cap;
  const works = missing.length === 0 && psuOk;
  return { parts, raw, score: works ? raw : 0, missing, watts, cap, psuOk, works };
}
function compScore() {
  const pc = pcInfo();
  let best = pc.score;
  for (const o of S.owned) best = Math.max(best, itemOf(o).laptop || 0);
  return best;
}
function workspaceMult() {
  return 1 + (hasPerk('desk') ? 0.1 : 0) + (hasPerk('chair') ? 0.1 : 0);
}

const itemStatus = it => Math.round(Math.sqrt(it.price) / 4);
function status() {
  let s = 0;
  for (const o of S.owned) s += itemStatus(itemOf(o));
  for (const h of S.homes) s += Math.round(Math.sqrt(HOME[h].buy) / 4);
  if (!ownsHome(S.home)) s += Math.round(Math.sqrt(home().rent * 50) / 4);
  return s;
}

const tracksValue = it => it.cat === 'vehicles' || (it.cat === 'luxury' && !it.cons) || !!it.appr;
function itemValue(o) {
  const it = itemOf(o);
  if (o.val != null) return o.val;
  return round2(o.paid * CATS[it.cat].resale);
}
function priceOf(it) {
  let p = it.price;
  const sale = S.sales[it.cat];
  if (sale && sale.until >= S.day) p *= sale.mult;
  if (it.slot === 'gpu') p *= S.market.gpu;
  if (it.cat === 'pc') p *= S.market.chip;
  return round2(p);
}
const homeValue = id => Math.round(HOME[id].buy * S.housing);
const stockPrice = sym => S.stocks.find(s => s.sym === sym).price;
function stockValue() {
  let v = 0;
  for (const sym in S.holdings) v += S.holdings[sym].sh * stockPrice(sym);
  return v;
}
function netWorth() {
  let n = S.money + S.bank.savings - S.bank.loan + stockValue();
  for (const o of S.owned) n += itemValue(o);
  for (const h of S.homes) n += homeValue(h) * 0.95;
  return n;
}
const loanLimit = () => Math.max(0, Math.round(2000 + 0.5 * (netWorth() + S.bank.loan) - S.bank.loan));

function collection() {
  const all = ITEMS.filter(it => !it.hidden);
  const have = all.filter(it => S.ever[it.id]).length;
  return { have, total: all.length };
}

// ---------- time ----------
const canSpend = h => S.hour + h <= DAY_END + 1e-9;

function passTime(h, mode) {
  const steps = Math.max(1, Math.round(h * 4));
  const dt = h / steps;
  const st = S.stats;
  const heat = S.market.heat === S.day ? 1.5 : 1;
  for (let i = 0; i < steps; i++) {
    const sleeping = mode === 'sleep';
    st.hunger -= (sleeping ? 1 : 2.5) * dt;
    st.thirst -= (sleeping ? 1.3 : 3.4) * heat * dt;
    if (!sleeping) st.energy -= (mode === 'work' ? 4.2 : 3) * dt;
    st.fun -= (mode === 'work' ? 2 : sleeping ? 0.3 : 1.1) * dt;
    if (st.hunger <= 0 || st.thirst <= 0) st.health -= 3 * dt;
    else if (st.energy <= 0) st.health -= 1 * dt;
    else if (st.hunger > 50 && st.thirst > 50 && st.energy > 20) st.health += 0.6 * dt;
    clampStats();
  }
  S.hour += h;
}
function clampStats() {
  for (const k of STAT_KEYS) S.stats[k] = clamp(S.stats[k], 0, 100);
}
function boost(fx) {
  for (const k in fx) S.stats[k] += fx[k];
  clampStats();
}
function checkHealth() {
  if (S.stats.health > 0) return false;
  const bill = 2500;
  charge(bill);
  S.life.hospital++;
  newDay();
  S.hour = 12;
  Object.assign(S.stats, { health: 55, hunger: 60, thirst: 60, energy: 60 });
  S.news.unshift(`🚑 You collapsed and spent the night in hospital. Bill: ${money(bill)}. Eat, drink and sleep!`);
  toast('🚑 You ended up in hospital!', 'bad');
  return true;
}

function earn(n) {
  S.money += n;
  S.life.earned += n;
}
// pay a bill; anything you cannot cover goes on your loan
function charge(n) {
  S.money -= n;
  if (S.money < 0) {
    S.bank.loan += -S.money;
    S.money = 0;
    return false;
  }
  return true;
}

function sleep() {
  const hrs = DAY_END + 5 - S.hour; // until 07:00
  passTime(hrs, 'sleep');
  const restore = hrs * (5.5 + bedTier() * 1.6);
  S.stats.energy = clamp(S.stats.energy + restore, 0, 100);
  if (checkHealth()) return;
  newDay();
  toast(bedTier() ? '😴 You slept well.' : '😴 You slept on the floor. A bed would help a lot.');
}

function newDay() {
  S.day++;
  S.hour = DAY_START;
  S.workedToday = false;
  S.overtimeToday = false;
  const news = [];

  // home comforts and pets
  const morningFun = Math.min(25, comfort() * 0.6 + petFun());
  const healthy = sumOf(placedFurniture(), 'health') + sumOf(S.owned.filter(o => itemOf(o).cat === 'electronics'), 'health');
  boost({ fun: morningFun, health: healthy });

  // markets
  if (S.market.gpuUntil < S.day) S.market.gpu = 1;
  if (S.market.chipUntil < S.day) S.market.chip = 1;
  for (const k in S.sales) if (S.sales[k].until < S.day) delete S.sales[k];
  for (const st of S.stocks) {
    const d = STOCKS.find(x => x.sym === st.sym);
    st.price = Math.max(0.01, st.price * Math.exp(d.drift + d.vol * gauss()));
    st.hist.push(st.price);
    if (st.hist.length > 60) st.hist.shift();
  }
  S.housing = clamp(S.housing * Math.exp(0.0003 + 0.004 * gauss()), 0.6, 3);

  // asset values drift
  for (const o of S.owned) {
    const it = itemOf(o);
    if (o.val == null) continue;
    if (it.cat === 'vehicles') o.val = Math.max(it.price * 0.25, o.val * (1 - it.depr));
    else if (it.appr) o.val = Math.max(1, o.val * (1 + rnd(it.appr[0], it.appr[1])));
  }

  // crypto mining overnight
  const pc = pcInfo();
  if (S.mining) {
    if (pc.works) {
      const moon = stockPrice('MOON');
      const gross = pc.parts.gpu.mine * clamp(moon / 2.5, 0.2, 6) * (S.market.gpu > 1 ? 1.5 : 1);
      const power = pc.watts * 24 / 1000 * 0.15;
      const net = round2(gross - power);
      if (net >= 0) earn(net); else charge(-net);
      news.push(`⛏️ Overnight mining: ${money(gross)} mined, ${money(power)} electricity → <b>${net >= 0 ? '+' : ''}${money(net)}</b>.`);
    } else {
      S.mining = false;
      news.push('⛏️ Mining stopped: your PC is not working.');
    }
  }

  // weekly bills
  if ((S.day - 1) % 7 === 0) news.push(...weeklyBills());

  // daily event
  if (Math.random() < 0.45) {
    const pool = EVENTS.filter(e => !e.cond || e.cond());
    let total = pool.reduce((a, e) => a + e.w, 0), r = Math.random() * total;
    for (const e of pool) { r -= e.w; if (r <= 0) { news.push(e.run()); break; } }
  }

  S.news = news;
}

function weeklyBills() {
  const lines = [];
  const items = [];
  if (!ownsHome(S.home)) items.push(['Rent (' + home().name + ')', home().rent]);
  const tax = S.homes.reduce((a, h) => a + homeValue(h) * 0.0002, 0);
  if (tax) items.push(['Property tax', round2(tax)]);
  const vUp = sumOf(vehicles(), 'upkeep');
  if (vUp) items.push(['Vehicle insurance & upkeep', vUp]);
  const pUp = sumOf(pets(), 'upkeep');
  if (pUp) items.push(['Pet food & vet', pUp]);
  const loanInt = round2(S.bank.loan * 0.015);
  if (loanInt) items.push(['Loan interest (1.5%)', loanInt]);
  const total = items.reduce((a, x) => a + x[1], 0);
  const interest = round2(S.bank.savings * 0.004);
  if (interest) { S.bank.savings += interest; S.life.earned += interest; }
  const ok = charge(total);
  lines.push(`🧾 <b>Weekly bills: ${money(total)}</b> — ` + (items.length ? items.map(x => `${x[0]} ${money(x[1])}`).join(', ') : 'nothing due') + '.');
  if (interest) lines.push(`🏦 Savings interest: +${money(interest)}.`);
  if (!ok) lines.push('⚠️ You could not cover your bills. The rest was added to your loan.');
  return lines;
}

const EVENTS = [
  { w: 2, run() { S.market.gpu = 1.45; S.market.gpuUntil = S.day + 3; return '📈 Crypto craze! Graphics card prices are up 45% and mining pays more for a few days.'; } },
  { w: 2, run() { S.market.chip = 1.2; S.market.chipUntil = S.day + 2; return '🏭 Chip shortage: all PC parts cost 20% more for 3 days.'; } },
  { w: 4, run() {
      const c = pick(['electronics', 'furniture', 'pc', 'clothing', 'vehicles', 'luxury', 'food', 'drinks']);
      const m = c === 'vehicles' ? 0.88 : c === 'luxury' ? 0.9 : pick([0.7, 0.75, 0.8]);
      S.sales[c] = { mult: m, until: S.day + 1 };
      return `🏷️ <b>Sale!</b> ${CATS[c].name} are ${Math.round((1 - m) * 100)}% off today and tomorrow.`;
    } },
  { w: 1, run() { S.stocks.forEach(s => { s.price *= 1.06; s.hist[s.hist.length - 1] = s.price; }); return '🚀 Stock market rally: shares up about 6%.'; } },
  { w: 1, run() { S.stocks.forEach(s => { s.price *= 0.86; s.hist[s.hist.length - 1] = s.price; }); return '📉 Market crash! Shares down about 14%.'; } },
  { w: 1, run() { earn(50); return '💵 You found a $50 bill on the sidewalk.'; } },
  { w: 1, run() { const n = Math.round(rnd(150, 600)); earn(n); return `📬 Tax refund arrived: +${money(n)}.`; } },
  { w: 1, run() { S.market.heat = S.day; return '☀️ Heatwave today — you will get thirsty faster.'; } },
  { w: 1, run() { S.housing *= 1.04; return '🏘️ The housing market is hot: home prices up 4%.'; } },
  { w: 1, cond: () => hasCar(), run() { const n = Math.round(rnd(150, 900)); charge(n); return `🔧 Your car needed repairs: -${money(n)}.`; } },
  { w: 1, cond: () => S.followers >= 300, run() { const n = Math.round(S.followers * rnd(0.1, 0.3)); S.followers += n; return `🎬 One of your stream clips went viral: +${n.toLocaleString()} followers.`; } },
];

// ---------- actions ----------
function buy(id, n) {
  n = n || 1;
  const it = ITEM[id];
  const unit = priceOf(it);
  const cost = round2(unit * n);
  if (S.money < cost) return toast(`Not enough cash — you need ${money(cost)}.`, 'bad');
  if (it.cat === 'vehicles' && !it.noGarage && garageUsed() + n > garageCap())
    return toast(`No parking space (${garageCap()} spots). Sell a vehicle or move somewhere with a garage.`, 'bad');
  if (it.gives && !hasPerk('fridge')) return toast('You need a fridge placed at home to store groceries.', 'bad');

  S.money = round2(S.money - cost);
  S.life.spent += cost;
  S.ever[id] = 1;
  if (it.cons) {
    const key = it.gives ? it.gives[0] : id;
    S.cons[key] = (S.cons[key] || 0) + (it.gives ? it.gives[1] : 1) * n;
  } else {
    for (let i = 0; i < n; i++) {
      const o = { uid: S.nextUid++, id, paid: unit, day: S.day };
      if (tracksValue(it)) o.val = round2(unit * (it.cat === 'vehicles' ? 0.85 : it.cat === 'luxury' ? 0.9 : 0.8));
      if (it.cat === 'furniture') o.placed = placedFurniture().length < home().slots;
      S.owned.push(o);
      if (it.slot && !S.pc[it.slot]) S.pc[it.slot] = o.uid;
      if (it.cat === 'furniture' && !o.placed) toast('No room at home — it went into storage.', 'warn');
    }
  }
  toast(`${it.icon} Bought ${n > 1 ? n + '× ' : ''}${it.name} for ${money(cost)}`);
}

function useItem(id) {
  if (!S.cons[id]) return;
  const it = ITEM[id];
  if (!it.lottery && !canSpend(0.25)) return toast('It is very late. Go to sleep.', 'bad');
  S.cons[id]--;
  if (!S.cons[id]) delete S.cons[id];
  if (it.lottery) return scratch(it);
  boost(it.fx || {});
  S.eaten++;
  passTime(0.25, 'awake');
  if (!checkHealth()) toast(`${it.icon} ${it.name}: ` + Object.entries(it.fx).map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${STAT_META[k].name}`).join(', '));
}

function scratch(it) {
  const r = Math.random();
  let win = 0;
  if (it.lottery === 'lotto') {
    if (r < 1 / 5000) win = 1000000;
    else if (r < 1 / 5000 + 1 / 500) win = 1000;
    else if (r < 0.022) win = 20;
    else if (r < 0.12) win = 4;
  } else {
    if (r < 1 / 2000) win = 10000;
    else if (r < 1 / 2000 + 1 / 100) win = 100;
    else if (r < 0.06) win = 20;
    else if (r < 0.26) win = 5;
  }
  if (win) {
    earn(win);
    S.life.biggestWin = Math.max(S.life.biggestWin, win);
    toast(`${it.icon} WINNER! You won ${money(win)}!`, win >= 1000 ? 'gold' : 'good');
  } else {
    toast(`${it.icon} No luck this time.`);
  }
}

function sell(uid) {
  const i = S.owned.findIndex(o => o.uid === uid);
  if (i < 0) return;
  const o = S.owned[i], it = itemOf(o);
  for (const k in S.pc) if (S.pc[k] === uid) delete S.pc[k];
  S.owned.splice(i, 1);
  if (it.cat === 'pets') return toast(`${it.icon} You found a loving new home for your ${it.name.toLowerCase()}.`);
  const v = itemValue(o);
  earn(v);
  toast(`Sold ${it.name} for ${money(v)}`);
}

function placeItem(uid) {
  const o = findOwned(uid);
  if (!o) return;
  if (placedFurniture().length >= home().slots) return toast('No free space at home. Store something or move to a bigger place.', 'bad');
  o.placed = true;
}
function storeItem(uid) {
  const o = findOwned(uid);
  if (o) o.placed = false;
}

function install(uid) {
  const o = findOwned(uid);
  if (!o) return;
  S.pc[itemOf(o).slot] = uid;
  const pc = pcInfo();
  if (!pc.psuOk) toast(`⚠️ Power draw ${pc.watts}W is more than your ${pc.cap}W power supply. Upgrade the PSU!`, 'warn');
}
function uninstall(slot) { delete S.pc[slot]; }

function jobUnmet(job) {
  const r = job.req || {}, out = [];
  if (r.shifts && S.shifts < r.shifts) out.push(`${r.shifts} shifts worked (you: ${S.shifts})`);
  if (r.vehicle && !hasRide()) out.push('a bike, scooter or vehicle');
  if (r.car && !hasCar()) out.push('a car');
  if (r.phone && !hasPerk('phone')) out.push('a smartphone');
  if (r.suit && suitLevel() < r.suit) out.push(r.suit > 1 ? 'a designer suit' : 'a business suit or dress');
  if (r.comp && compScore() < r.comp) out.push(`a computer with score ${r.comp}+ (you: ${compScore()})`);
  if (r.status && status() < r.status) out.push(`${r.status} status (you: ${status()})`);
  return out;
}
function jobReqList(job) {
  const r = job.req || {}, out = [];
  if (r.shifts) out.push([`${r.shifts} shifts worked`, S.shifts >= r.shifts]);
  if (r.vehicle) out.push(['Bike, scooter or vehicle', hasRide()]);
  if (r.car) out.push(['A car', hasCar()]);
  if (r.phone) out.push(['A smartphone', hasPerk('phone')]);
  if (r.suit) out.push([r.suit > 1 ? 'Designer suit' : 'Business suit or dress', suitLevel() >= r.suit]);
  if (r.comp) out.push([`Computer score ${r.comp}+`, compScore() >= r.comp]);
  if (r.status) out.push([`${r.status} status`, status() >= r.status]);
  return out;
}
function applyJob(id) {
  const job = JOB[id];
  const unmet = jobUnmet(job);
  if (unmet.length) return toast('You still need: ' + unmet.join(', '), 'bad');
  S.job = id;
  toast(`${job.icon} You are now a ${job.name.toLowerCase()}!`, 'good');
}

function shiftHours() { return 8 + 2 * commute(); }
function payMult() {
  let m = 1;
  if (S.stats.fun < 15) m -= 0.2;
  if (S.stats.health < 30) m -= 0.2;
  return m;
}
function work() {
  const job = JOB[S.job];
  if (S.job === 'none') return toast('Get a job on the job board first.', 'bad');
  if (S.workedToday) return toast('You already worked today. Try overtime.', 'bad');
  const unmet = jobUnmet(job);
  if (unmet.length) return toast('You no longer meet this job\'s requirements: ' + unmet.join(', '), 'bad');
  const h = shiftHours();
  if (!canSpend(h)) return toast(`A shift takes ${dur(h)} with your commute — it is too late today.`, 'bad');
  if (S.stats.energy < 15) return toast('You are too tired to work. Sleep, nap or have a coffee.', 'bad');
  passTime(h, 'work');
  const pay = round2(job.wage * 8 * payMult() * rnd(1, 1.1));
  earn(pay);
  S.shifts++;
  S.workedToday = true;
  if (!checkHealth()) toast(`${job.icon} Shift done! You earned ${money(pay)}.`, 'good');
}
function overtime() {
  const job = JOB[S.job];
  if (!S.workedToday || S.overtimeToday) return;
  if (!canSpend(3)) return toast('Too late for overtime.', 'bad');
  if (S.stats.energy < 20) return toast('Too tired for overtime.', 'bad');
  passTime(3, 'work');
  const pay = round2(job.wage * 3 * 1.5 * payMult());
  earn(pay);
  S.overtimeToday = true;
  if (!checkHealth()) toast(`⏱️ Overtime done: +${money(pay)}.`, 'good');
}

// Home activities
const ACTIVITIES = [
  { id: 'nap', icon: '😴', name: 'Take a nap', h: 2, hint: () => `+${16 + bedTier() * 4} Energy`,
    run() { passTime(2, 'sleep'); boost({ energy: 16 + bedTier() * 4 }); return 'You feel refreshed.'; } },
  { id: 'park', icon: '🌳', name: 'Walk in the park', h: 1, hint: () => '+8 Fun, +2 Health',
    run() { passTime(1, 'awake'); boost({ fun: 8, health: 2 }); return 'Fresh air!'; } },
  { id: 'workout', icon: '🏋️', name: 'Work out', h: 1, hint: () => hasPerk('gym') ? '+7 Health, +5 Fun (home gym)' : '+4 Health, −10 Energy',
    need: () => S.stats.energy >= 15 || 'Too tired',
    run() { passTime(1, 'work'); boost(hasPerk('gym') ? { health: 7, fun: 5, energy: -6 } : { health: 4, energy: -10 }); return 'Good workout.'; } },
  { id: 'tv', icon: '📺', name: 'Watch TV', h: 2, hint: () => `+${bestTV()} Fun`,
    need: () => bestTV() > 0 || 'Needs a TV placed at home',
    run() { passTime(2, 'awake'); boost({ fun: bestTV() }); return 'Binge-watching time.'; } },
  { id: 'console', icon: '🕹️', name: 'Play console', h: 2, hint: () => hasPerk('console') && bestTV() ? '+24 Fun' : '+16 Fun',
    need: () => (hasPerk('console') && bestTV() > 0) || hasPerk('handheld') || 'Needs a console + TV, or a handheld',
    run() { passTime(2, 'awake'); const f = hasPerk('console') && bestTV() ? 24 : 16; boost({ fun: f }); return 'GG!'; } },
  { id: 'vr', icon: '🥽', name: 'VR session', h: 1, hint: () => '+18 Fun',
    need: () => hasPerk('vr') || 'Needs a VR headset',
    run() { passTime(1, 'awake'); boost({ fun: 18, energy: -4 }); return 'That felt real.'; } },
  { id: 'pcgame', icon: '🎮', name: 'PC gaming', h: 2, hint: () => `+${Math.round(8 + Math.min(30, pcInfo().score / 6))} Fun`,
    need: () => pcInfo().works || 'Needs a working PC',
    run() { passTime(2, 'awake'); boost({ fun: Math.round(8 + Math.min(30, pcInfo().score / 6)) }); return 'Max settings!'; } },
  { id: 'freelance', icon: '💻', name: 'Freelance gig', h: 3, hint: () => `≈ ${money(freelancePay())}`,
    need: () => compScore() > 0 ? (S.stats.energy >= 15 || 'Too tired') : 'Needs a laptop or working PC',
    run() { passTime(3, 'work'); const p = round2(freelancePay() * rnd(0.85, 1.15)); earn(p); boost({ energy: -6 }); return `Client paid ${money(p)}.`; } },
  { id: 'stream', icon: '🎙️', name: 'Stream games', h: 3, hint: () => `${S.followers.toLocaleString()} followers`,
    need: () => pcInfo().works ? (hasPerk('streamkit') || 'Needs a streaming kit') : 'Needs a working PC',
    run() {
      passTime(3, 'awake');
      const sc = pcInfo().score;
      const gain = Math.round((4 + sc / 6) * rnd(0.5, 1.6) + S.followers * rnd(0.01, 0.04));
      S.followers += gain;
      const pay = round2(S.followers * 0.035 * rnd(0.5, 1.5) + (Math.random() < 0.1 ? rnd(20, 200) : 0));
      earn(pay);
      boost({ fun: 10, energy: -5 });
      return `+${gain.toLocaleString()} followers, ${money(pay)} in subs and donations.`;
    } },
  { id: 'drive', icon: '🛣️', name: 'Go for a ride', h: 1, hint: () => `+${Math.min(40, maxOf(vehicles(), 'fun'))} Fun`,
    need: () => vehicles().length > 0 || 'Needs a vehicle',
    run() { passTime(1, 'awake'); const best = vehicles().reduce((b, o) => itemOf(o).fun > (b ? itemOf(b).fun : -1) ? o : b, null); boost({ fun: Math.min(40, itemOf(best).fun) }); return `You took the ${itemOf(best).name.toLowerCase()} out.`; } },
  { id: 'pets', icon: '🐾', name: 'Play with pets', h: 1, hint: () => `+${petFun() * 2} Fun`,
    need: () => pets().length > 0 || 'Needs a pet',
    run() { passTime(1, 'awake'); boost({ fun: petFun() * 2, health: 1 }); return 'Pure joy.'; } },
  { id: 'games', icon: '🎱', name: 'Arcade & pool', h: 1, hint: () => '+14 Fun',
    need: () => hasPerk('arcade') || hasPerk('pool') || 'Needs an arcade cabinet or pool table',
    run() { passTime(1, 'awake'); boost({ fun: 14 }); return 'New high score!'; } },
  { id: 'photo', icon: '📷', name: 'Photo shoot', h: 2, hint: () => '+12 Fun, sell photos',
    need: () => hasPerk('camera') || hasPerk('drone') || 'Needs a camera or drone',
    run() { passTime(2, 'awake'); boost({ fun: 12 }); const p = round2(rnd(10, hasPerk('camera') && hasPerk('drone') ? 220 : 120)); earn(p); return `You sold some photos for ${money(p)}.`; } },
];
function freelancePay() { return (compScore() * 2.2 + 15) * workspaceMult() * payMult(); }

function doActivity(id) {
  const a = ACTIVITIES.find(x => x.id === id);
  const ok = a.need ? a.need() : true;
  if (ok !== true) return toast(ok, 'bad');
  if (!canSpend(a.h)) return toast('Not enough time left today. Go to sleep.', 'bad');
  const msg = a.run();
  if (!checkHealth()) toast(`${a.icon} ${msg}`, 'good');
}

// Homes
function moveTo(id) {
  const h = HOME[id];
  const vCount = garageUsed();
  if (vCount > h.garage + 1) return toast(`${h.name} only has parking for ${h.garage + 1}. Sell some vehicles first.`, 'bad');
  if (!ownsHome(id)) {
    if (S.money < h.rent) return toast(`You need the first week's rent: ${money(h.rent)}.`, 'bad');
    S.money -= h.rent;
    S.life.spent += h.rent;
  }
  S.home = id;
  const placed = placedFurniture();
  for (let i = h.slots; i < placed.length; i++) placed[i].placed = false;
  if (placed.length > h.slots) toast(`Some furniture didn't fit and went into storage.`, 'warn');
  toast(`${h.icon} You moved into the ${h.name.toLowerCase()}!`, 'good');
}
function buyHome(id) {
  const h = HOME[id], p = homeValue(id);
  if (S.money < p) return toast(`You need ${money(p)} to buy this. Try the bank or stocks.`, 'bad');
  S.money -= p;
  S.life.spent += p;
  S.homes.push(id);
  toast(`🔑 You bought the ${h.name.toLowerCase()}!`, 'gold');
  if (S.home !== id) moveTo(id);
}
function sellHome(id) {
  if (S.home === id) return toast('You cannot sell the home you live in. Move out first.', 'bad');
  const v = Math.round(homeValue(id) * 0.95);
  S.homes = S.homes.filter(x => x !== id);
  earn(v);
  toast(`Sold the ${HOME[id].name.toLowerCase()} for ${money(v)}.`);
}

// Bank & stocks
function bank(kind, amt) {
  const b = S.bank;
  if (kind === 'deposit') { amt = Math.min(amt, S.money); if (amt <= 0) return; S.money -= amt; b.savings += amt; }
  if (kind === 'withdraw') { amt = Math.min(amt, b.savings); if (amt <= 0) return; b.savings -= amt; S.money += amt; }
  if (kind === 'borrow') { amt = Math.min(amt, loanLimit()); if (amt <= 0) return toast('The bank won\'t lend you more right now.', 'bad'); b.loan += amt; S.money += amt; }
  if (kind === 'repay') { amt = Math.min(amt, b.loan, S.money); if (amt <= 0) return; b.loan -= amt; S.money -= amt; }
  b.savings = round2(b.savings); b.loan = round2(b.loan); S.money = round2(S.money);
  toast(`🏦 ${kind[0].toUpperCase() + kind.slice(1)}: ${money(amt)}`);
}
function trade(sym, kind, amt) {
  const p = stockPrice(sym);
  const h = S.holdings[sym] || { sh: 0, cost: 0 };
  if (kind === 'buy') {
    amt = Math.min(amt, S.money);
    if (amt < 0.01) return toast('Not enough cash.', 'bad');
    h.sh += amt / p; h.cost += amt; S.money = round2(S.money - amt);
    S.holdings[sym] = h;
    toast(`📈 Bought ${money(amt)} of ${sym}`);
  } else {
    if (!h.sh) return;
    const frac = Math.min(1, kind === 'sellhalf' ? 0.5 : 1);
    const value = round2(h.sh * frac * p);
    h.sh -= h.sh * frac; h.cost -= h.cost * frac;
    S.money = round2(S.money + value);
    if (h.sh < 1e-9) delete S.holdings[sym];
    toast(`📉 Sold ${money(value)} of ${sym}`);
  }
}

function checkAchievements() {
  const pc = pcInfo();
  const nw = netWorth();
  const has = id => countOwned(id) > 0;
  const c = collection();
  const cond = {
    first_buy: S.life.spent > 0,
    first_job: S.job !== 'none',
    week1: S.day >= 8,
    month1: S.day >= 30,
    bed: S.owned.some(o => itemOf(o).bed),
    pc_built: pc.works,
    pc_beast: pc.works && pc.score >= 170,
    gpu_top: has('gpu6') || has('gpu7'),
    first_car: hasCar(),
    supercar: has('super') || has('hyper'),
    fleet: vehicles().length >= 5,
    furnished: placedFurniture().length >= 10,
    homeowner: S.homes.length > 0,
    mansion: ownsHome('mansion'),
    island: ownsHome('island'),
    pets3: pets().length >= 3,
    foodie: S.eaten >= 100,
    lucky: S.life.biggestWin >= 1000,
    streamer: S.followers >= 10000,
    investor: stockValue() >= 10000,
    ceo: S.job === 'ceo',
    yacht: has('yacht'),
    jet: has('jet'),
    nw10k: nw >= 1e4,
    nw100k: nw >= 1e5,
    nw1m: nw >= 1e6,
    nw1b: nw >= 1e9,
    collector: c.have === c.total,
    hospital: S.life.hospital > 0,
  };
  for (const a of ACHIEVEMENTS) {
    if (cond[a.id] && !S.ach[a.id]) {
      S.ach[a.id] = S.day;
      toast(`🏆 Achievement unlocked: ${a.name}`, 'gold');
    }
  }
}

// ---------- UI ----------
function toast(msg, kind) {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3300);
}

const TABS = [
  ['home', '🏠', 'Home'], ['work', '💼', 'Work'], ['shop', '🛍️', 'Shop'], ['pc', '🖥️', 'PC Build'],
  ['garage', '🚗', 'Garage'], ['bank', '🏦', 'Bank'], ['inv', '🎒', 'Stuff'], ['trophies', '🏆', 'Trophies'],
];

function render() {
  checkAchievements();
  renderHud();
  document.getElementById('tabs').innerHTML = TABS.map(([id, ic, name]) =>
    `<button class="tab ${S.tab === id ? 'on' : ''}" data-act="tab" data-arg="${id}"><span>${ic}</span>${name}</button>`).join('');
  const views = { home: viewHome, work: viewWork, shop: viewShop, pc: viewPC, garage: viewGarage, bank: viewBank, inv: viewInv, trophies: viewTrophies };
  document.getElementById('view').innerHTML = views[S.tab]();
  save();
}

function renderHud() {
  const late = S.hour >= 24;
  const bars = STAT_KEYS.map(k => {
    const v = Math.round(S.stats[k]);
    const cls = v < 20 ? 'low' : v < 45 ? 'mid' : '';
    return `<div class="stat ${cls}" title="${STAT_META[k].name}: ${v}/100">
      <span class="si">${STAT_META[k].icon}</span>
      <div class="bar"><i style="width:${v}%"></i></div>
      <span class="sv">${v}</span></div>`;
  }).join('');
  document.getElementById('hud').innerHTML = `
    <div class="hud-top">
      <div class="brand">🛍️ Buy It All</div>
      <div class="clock ${late ? 'late' : ''}">Day ${S.day} · ${weekday(S.day)} · ${clock(S.hour)}</div>
      <div class="cash">💵 ${money(S.money)}</div>
      <div class="nw" title="Cash + savings + stocks + stuff + homes − loans">Net worth ${money(netWorth(), true)}</div>
    </div>
    <div class="stats">${bars}</div>`;
}

function btn(label, act, arg, opts) {
  opts = opts || {};
  return `<button class="btn ${opts.cls || ''}" data-act="${act}" ${arg != null ? `data-arg="${arg}"` : ''} ${opts.arg2 != null ? `data-arg2="${opts.arg2}"` : ''} ${opts.disabled ? 'disabled' : ''} ${opts.title ? `title="${opts.title}"` : ''}>${label}</button>`;
}
function fxText(fx) {
  return Object.entries(fx || {}).map(([k, v]) => `<span class="fx ${v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v} ${STAT_META[k].icon}</span>`).join('');
}

function viewHome() {
  const h = home();
  const placed = placedFurniture();
  const late = S.hour >= 24;
  const news = S.news.length ? `<section class="card news">
      <div class="card-h"><h2>📰 Today</h2>${btn('Dismiss', 'dismiss', null, { cls: 'ghost sm' })}</div>
      ${S.news.map(n => `<p>${n}</p>`).join('')}</section>` : '';
  const tiles = [];
  for (let i = 0; i < h.slots; i++) {
    const o = placed[i];
    tiles.push(o ? `<div class="tile" title="${itemOf(o).name}"><b>${itemOf(o).icon}</b><small>${itemOf(o).name}</small></div>` : '<div class="tile empty"></div>');
  }
  const petsRow = pets().length ? `<div class="pets">${pets().map(o => `<span title="${itemOf(o).name}">${itemOf(o).icon}</span>`).join('')}</div>` : '';
  const acts = ACTIVITIES.map(a => {
    const ok = a.need ? a.need() : true;
    const reason = ok === true ? (canSpend(a.h) ? '' : 'Too late today') : ok;
    return `<button class="act" data-act="activity" data-arg="${a.id}" ${reason ? 'disabled' : ''}>
      <b>${a.icon}</b><span>${a.name}</span><small>${reason || `${dur(a.h)} · ${a.hint()}`}</small></button>`;
  }).join('');
  const pantry = Object.keys(S.cons).filter(id => !ITEM[id].lottery).map(id => {
    const it = ITEM[id];
    return `<button class="chip" data-act="use" data-arg="${id}" title="${it.name}">${it.icon} <span>${S.cons[id]}</span></button>`;
  }).join('');
  const pc = pcInfo();
  return `${news}
  ${late ? `<div class="banner bad">🌙 It's ${clock(S.hour)} — ${S.hour >= DAY_END ? 'you have to sleep now.' : 'you should sleep soon (you must by 02:00).'}</div>` : ''}
  <div class="grid2">
    <section class="card">
      <div class="card-h"><h2>${h.icon} ${h.name}</h2><span class="muted">${ownsHome(S.home) ? 'Owned' : `Rent ${money(h.rent)}/week`}</span></div>
      <div class="room">${tiles.join('')}</div>
      ${petsRow}
      <div class="kv">
        <span>Furniture</span><b>${placed.length}/${h.slots}</b>
        <span>Comfort</span><b>${comfort()}</b>
        <span>Bed</span><b>${['Floor 😣', 'Air mattress', 'Single bed', 'Queen bed', 'King bed'][bedTier()]}</b>
        <span>Next bills</span><b>Day ${S.day + 7 - ((S.day - 1) % 7)}</b>
      </div>
      <div class="row">${btn('🏬 Furniture store', 'goStore', 'homenest', { cls: 'ghost' })}${btn('🏠 Bigger place', 'goStore', 'realty', { cls: 'ghost' })}</div>
    </section>
    <section class="card">
      <div class="card-h"><h2>🌙 Rest</h2></div>
      <button class="big" data-act="sleep">😴 Sleep until 07:00<small>Restores ~${Math.round(Math.min(100, (DAY_END + 5 - S.hour) * (5.5 + bedTier() * 1.6)))} energy</small></button>
      <h3>🍽️ Kitchen</h3>
      <div class="chips">${pantry || '<span class="muted">Nothing to eat or drink. Visit FreshMart!</span>'}</div>
      ${!pantry ? btn('🛒 Go to FreshMart', 'goStore', 'grocery') : ''}
      <h3>📋 You</h3>
      <div class="kv">
        <span>Job</span><b>${JOB[S.job].icon} ${JOB[S.job].name}</b>
        <span>Getting around</span><b>${commuteName()}</b>
        <span>PC</span><b>${pc.works ? `Score ${pc.score}` : 'Not built'}</b>
        <span>Status</span><b>⭐ ${status().toLocaleString()}</b>
      </div>
    </section>
  </div>
  <section class="card">
    <div class="card-h"><h2>🎯 Things to do</h2><span class="muted">${S.hour < DAY_END ? `${dur(DAY_END - S.hour)} left before you must sleep` : 'Time to sleep'}</span></div>
    <div class="acts">${acts}</div>
  </section>
  <p class="foot">${btn('🔄 New game', 'newgame', null, { cls: 'ghost sm' })} Progress saves automatically in this browser.</p>`;
}

function viewWork() {
  const job = JOB[S.job];
  const h = shiftHours();
  const unmet = S.job !== 'none' ? jobUnmet(job) : [];
  let workBtn;
  if (S.job === 'none') workBtn = '<p class="muted">You are unemployed. Pick a job below — fast food hires anyone.</p>';
  else if (S.workedToday) workBtn = `<p class="good">✅ You worked today.</p>` +
      (S.overtimeToday ? '' : `<button class="big" data-act="overtime" ${canSpend(3) && S.stats.energy >= 20 ? '' : 'disabled'}>⏱️ Overtime (3h at 1.5×)<small>≈ ${money(job.wage * 4.5 * payMult())}</small></button>`);
  else workBtn = `<button class="big" data-act="work" ${canSpend(h) && S.stats.energy >= 15 && !unmet.length ? '' : 'disabled'}>
      ${job.icon} Work a shift<small>${dur(h)} incl. commute (${commuteName()}) · ≈ ${money(job.wage * 8 * payMult())}</small></button>
      ${!canSpend(h) ? '<p class="bad">Too late for a full shift today.</p>' : ''}
      ${S.stats.energy < 15 ? '<p class="bad">Too tired to work.</p>' : ''}`;
  const warn = [];
  if (S.stats.fun < 15) warn.push('😩 You are miserable: −20% pay. Have some fun!');
  if (S.stats.health < 30) warn.push('🤒 You are unwell: −20% pay.');
  const board = JOBS.filter(j => j.id !== 'none').map(j => {
    const reqs = jobReqList(j);
    const ok = reqs.every(r => r[1]);
    const cur = j.id === S.job;
    return `<div class="job ${cur ? 'cur' : ''} ${ok ? '' : 'locked'}">
      <div class="job-h"><b>${j.icon} ${j.name}</b><span class="wage">${money(j.wage)}/h</span></div>
      <div class="reqs">${reqs.length ? reqs.map(r => `<span class="${r[1] ? 'ok' : 'no'}">${r[1] ? '✓' : '✗'} ${r[0]}</span>`).join('') : '<span class="ok">✓ No requirements</span>'}</div>
      ${cur ? '<span class="tag">Current job</span>' : btn(ok ? 'Apply' : 'Locked', 'apply', j.id, { cls: ok ? 'sm' : 'sm ghost', disabled: !ok })}
    </div>`;
  }).join('');
  return `<div class="grid2">
    <section class="card">
      <div class="card-h"><h2>${job.icon} ${job.name}</h2>${job.wage ? `<span class="wage">${money(job.wage)}/h</span>` : ''}</div>
      ${workBtn}
      ${warn.map(w => `<p class="bad">${w}</p>`).join('')}
      ${unmet.length ? `<p class="bad">You no longer meet: ${unmet.join(', ')}</p>` : ''}
      <div class="kv"><span>Shifts worked</span><b>${S.shifts}</b><span>Lifetime earnings</span><b>${money(S.life.earned)}</b></div>
    </section>
    <section class="card tips">
      <h2>💡 Career tips</h2>
      <p>🚲 A bike unlocks delivery jobs and cuts your commute.</p>
      <p>🤵 A suit gets you into an office. A designer suit gets you to the top.</p>
      <p>🖥️ Tech jobs need a computer: a laptop works at first, senior roles need a real PC build.</p>
      <p>⭐ Status comes from everything you own — the director and CEO roles need lots of it.</p>
      <p>💻 Freelancing, streaming and crypto mining at home are extra income.</p>
    </section>
  </div>
  <section class="card"><h2>📋 Job board</h2><div class="jobs">${board}</div></section>`;
}

function itemTags(it) {
  const t = [];
  if (it.fx) t.push(fxText(it.fx));
  if (it.slot === 'cpu' || it.slot === 'gpu') t.push(`<span class="fx">Score ${it.score}</span><span class="fx">${it.watt}W</span>`);
  else if (it.slot === 'psu') t.push(`<span class="fx">${it.cap}W</span>`);
  else if (it.score) t.push(`<span class="fx">Score ${it.score}</span>`);
  if (it.mine) t.push(`<span class="fx">⛏️ ${money(it.mine)}/night</span>`);
  if (it.laptop) t.push(`<span class="fx">Computer score ${it.laptop}</span>`);
  if (it.comfort) t.push(`<span class="fx">Comfort ${it.comfort}</span>`);
  if (it.bed) t.push(`<span class="fx">Bed tier ${it.bed}</span>`);
  if (it.tv) t.push(`<span class="fx">TV +${it.tv} fun</span>`);
  if (it.cat === 'vehicles') {
    if (it.commute) t.push(`<span class="fx">Commute ${Math.round(it.commute * 60)}m</span>`);
    t.push(`<span class="fx">Fun ${it.fun}</span>`);
    if (it.upkeep) t.push(`<span class="fx neg">${money(it.upkeep)}/wk</span>`);
    if (it.noGarage) t.push('<span class="fx">No garage needed</span>');
  }
  if (it.petFun) t.push(`<span class="fx">+${it.petFun} 😄/day</span><span class="fx neg">${money(it.upkeep)}/wk</span>`);
  if (it.suit) t.push(`<span class="fx">${it.suit > 1 ? 'Executive' : 'Office'} attire</span>`);
  if (it.appr) t.push('<span class="fx">Value changes</span>');
  if (!it.cons) t.push(`<span class="fx">⭐ ${itemStatus(it)}</span>`);
  return t.join('');
}

function itemCard(it) {
  const p = priceOf(it);
  const onSale = p < it.price;
  const pricier = p > it.price;
  const owned = it.cons ? (S.cons[it.gives ? it.gives[0] : it.id] || 0) : countOwned(it.id);
  const afford = S.money >= p;
  const buttons = it.cons
    ? btn('Buy', 'buy', it.id, { arg2: 1, disabled: !afford }) + (p * 5 <= 1000 ? btn('×5', 'buy', it.id, { arg2: 5, cls: 'ghost', disabled: S.money < p * 5 }) : '')
    : btn('Buy', 'buy', it.id, { arg2: 1, disabled: !afford });
  return `<div class="item ${afford ? '' : 'poor'}">
    ${owned ? `<span class="owned">${it.cons ? '×' + owned : owned > 1 ? 'Own ×' + owned : 'Owned'}</span>` : ''}
    ${S.ever[it.id] ? '' : '<span class="new" title="Not in your collection yet">NEW</span>'}
    <div class="ico">${it.icon}</div>
    <div class="nm">${it.name}</div>
    ${it.desc ? `<div class="ds">${it.desc}</div>` : ''}
    <div class="tags">${itemTags(it)}</div>
    <div class="price">${onSale ? `<s>${money(it.price)}</s> <b class="sale">${money(p)}</b>` : pricier ? `<b class="bad">${money(p)}</b>` : `<b>${money(p)}</b>`}</div>
    <div class="row">${buttons}</div>
  </div>`;
}

function viewShop() {
  const store = STORES.find(s => s.id === S.store);
  const chips = STORES.map(s => `<button class="store ${s.id === S.store ? 'on' : ''}" data-act="store" data-arg="${s.id}">${s.icon} ${s.name}</button>`).join('');
  const sales = Object.entries(S.sales).filter(([, v]) => v.until >= S.day).map(([c, v]) => `🏷️ ${CATS[c].name} −${Math.round((1 - v.mult) * 100)}%`);
  if (S.market.gpu > 1) sales.push('📈 Graphics cards +45%');
  if (S.market.chip > 1) sales.push('🏭 PC parts +20%');
  let body;
  if (store.homes) body = viewRealty();
  else body = store.cats.map(c => {
    const items = ITEMS.filter(it => it.cat === c && !it.hidden);
    return `<h3 class="cat">${CATS[c].icon} ${CATS[c].name}</h3><div class="items">${items.map(itemCard).join('')}</div>`;
  }).join('');
  return `<div class="stores">${chips}</div>
    <section class="card store-h"><h2>${store.icon} ${store.name}</h2><p class="muted">${store.blurb}</p>
    ${sales.length ? `<div class="sales">${sales.map(s => `<span>${s}</span>`).join('')}</div>` : ''}
    ${store.id === 'automax' ? `<p class="muted">Parking: ${garageUsed()}/${garageCap()} used. Boats and aircraft don't need parking.</p>` : ''}
    ${store.id === 'homenest' ? `<p class="muted">Space at home: ${placedFurniture().length}/${home().slots} used.</p>` : ''}
    ${store.id === 'bytes' ? '<p class="muted">Parts install automatically into empty slots. Manage your build in <b>PC Build</b>.</p>' : ''}
    </section>${body}`;
}

function viewRealty() {
  return `<div class="homes">${HOMES.map(h => {
    const cur = S.home === h.id, own = ownsHome(h.id);
    const value = h.buy ? homeValue(h.id) : 0;
    const acts = [];
    if (cur) acts.push('<span class="tag">You live here</span>');
    else if (own) acts.push(btn('Move in (free)', 'move', h.id));
    else if (h.rent) acts.push(btn(`Rent · ${money(h.rent)}/wk`, 'move', h.id, { disabled: S.money < h.rent }));
    if (h.buy && !own) acts.push(btn(`Buy · ${money(value, true)}`, 'buyhome', h.id, { cls: 'gold', disabled: S.money < value }));
    if (own && !cur) acts.push(btn(`Sell · ${money(value * 0.95, true)}`, 'sellhome', h.id, { cls: 'ghost' }));
    return `<div class="home ${cur ? 'cur' : ''}">
      <div class="ico">${h.icon}</div>
      <div><b>${h.name}</b> ${own ? '<span class="tag">Owned</span>' : ''}
      <div class="tags"><span class="fx">🛋️ ${h.slots} furniture</span><span class="fx">🅿️ ${h.garage + 1} parking</span>${h.buy ? `<span class="fx">⭐ ${Math.round(Math.sqrt(h.buy) / 4)} when owned</span>` : ''}</div></div>
      <div class="row">${acts.join('')}</div></div>`;
  }).join('')}</div>
  <p class="muted">Owned homes have no rent, but pay 0.02% property tax weekly. Prices follow the housing market (now ${Math.round(S.housing * 100)}%).</p>`;
}

function viewPC() {
  const pc = pcInfo();
  const spare = slot => S.owned.filter(o => itemOf(o).slot === slot && S.pc[slot] !== o.uid);
  const rows = PC_SLOTS.map(sl => {
    const cur = pc.parts[sl.id];
    const spares = spare(sl.id);
    return `<div class="slot ${cur ? '' : sl.req ? 'missing' : 'opt'}">
      <div class="slot-n">${sl.name}${sl.req ? '' : ' <small>(optional)</small>'}</div>
      <div class="slot-p">${cur ? `${cur.icon} ${cur.name} <small class="muted">${cur.score ? 'score ' + cur.score : ''}${cur.watt ? ' · ' + cur.watt + 'W' : ''}${cur.cap ? cur.cap + 'W' : ''}</small>` : '<span class="muted">Empty</span>'}</div>
      <div class="row">${cur ? btn('Remove', 'uninstall', sl.id, { cls: 'ghost sm' }) : ''}
      ${spares.map(o => btn(`Install ${itemOf(o).name}`, 'install', o.uid, { cls: 'sm' })).join('')}</div>
    </div>`;
  }).join('');
  let state;
  if (pc.works) state = `<p class="good">✅ Your PC boots! Score <b>${pc.score}</b>.</p>`;
  else if (pc.missing.length) state = `<p class="bad">Missing: ${pc.missing.join(', ')}</p>`;
  else state = `<p class="bad">⚡ Power supply too weak: needs ${pc.watts}W, has ${pc.cap}W.</p>`;
  const moon = stockPrice('MOON');
  const mineEst = pc.works ? pc.parts.gpu.mine * clamp(moon / 2.5, 0.2, 6) * (S.market.gpu > 1 ? 1.5 : 1) - pc.watts * 24 / 1000 * 0.15 : 0;
  const tiers = [[10, 'IT support'], [25, 'Junior developer'], [90, 'Senior developer'], [140, 'Tech lead'], [170, '🔥 Absolute beast']];
  return `<div class="grid2">
    <section class="card">
      <div class="card-h"><h2>🖥️ Your PC</h2>${btn('🧩 Shop parts', 'goStore', 'bytes', { cls: 'ghost sm' })}</div>
      <div class="pcviz ${pc.works ? 'on' : ''}">${pc.parts.case ? pc.parts.case.icon : '⬜'}<span>${pc.parts.gpu ? pc.parts.gpu.icon : ''}${pc.parts.monitor ? pc.parts.monitor.icon : ''}</span></div>
      ${state}
      <div class="kv">
        <span>Raw score</span><b>${pc.raw}</b>
        <span>Power draw</span><b>${pc.watts}W / ${pc.cap || '—'}W</b>
        <span>Freelance rate</span><b>≈ ${money(freelancePay())} / gig</b>
        <span>Desk & chair bonus</span><b>+${Math.round((workspaceMult() - 1) * 100)}%</b>
      </div>
    </section>
    <section class="card">
      <h2>⛏️ Crypto mining</h2>
      <p class="muted">Leave your PC mining MoonCoin overnight. Earnings depend on your graphics card and the MOON price (now ${money(moon)}). Electricity costs $0.15/kWh.</p>
      <p>Estimated: <b class="${mineEst >= 0 ? 'good' : 'bad'}">${mineEst >= 0 ? '+' : ''}${money(mineEst)}</b> per night</p>
      ${btn(S.mining ? '⏹️ Stop mining' : '▶️ Start mining', 'mining', null, { cls: S.mining ? 'ghost' : '', disabled: !pc.works && !S.mining })}
      <h3>Score unlocks</h3>
      <div class="reqs">${tiers.map(([n, t]) => `<span class="${compScore() >= n ? 'ok' : 'no'}">${compScore() >= n ? '✓' : '✗'} ${n}: ${t}</span>`).join('')}</div>
    </section>
  </div>
  <section class="card"><h2>🧩 Build</h2><div class="slots">${rows}</div></section>`;
}

function viewGarage() {
  const vs = vehicles();
  const parked = vs.filter(o => !itemOf(o).noGarage);
  const other = vs.filter(o => itemOf(o).noGarage);
  const spots = [];
  for (let i = 0; i < garageCap(); i++) {
    const o = parked[i];
    spots.push(o ? `<div class="spot"><b>${itemOf(o).icon}</b><small>${itemOf(o).name}</small></div>` : `<div class="spot empty"><small>${i === garageCap() - 1 && home().garage < garageCap() - 1 ? 'Street' : 'Free'}</small></div>`);
  }
  const card = o => {
    const it = itemOf(o);
    return `<div class="line"><span class="ico">${it.icon}</span><div><b>${it.name}</b><div class="tags">${it.commute ? `<span class="fx">Commute ${Math.round(it.commute * 60)}m</span>` : ''}<span class="fx">Fun ${it.fun}</span><span class="fx neg">${money(it.upkeep)}/wk</span></div></div>
      <div class="val">Worth ${money(itemValue(o))}<small>paid ${money(o.paid)}</small></div>${btn('Sell', 'sell', o.uid, { cls: 'ghost sm' })}</div>`;
  };
  return `<section class="card">
    <div class="card-h"><h2>🚗 Garage</h2>${btn('🛒 AutoMax Motors', 'goStore', 'automax', { cls: 'ghost sm' })}</div>
    <div class="garage">${spots.join('')}</div>
    <p class="muted">Commute: <b>${Math.round(commute() * 60)} min</b> each way (${commuteName()}). Weekly upkeep: <b>${money(sumOf(vs, 'upkeep'))}</b>. Bigger homes have more parking.</p>
    ${vs.length ? vs.filter(o => !itemOf(o).noGarage).map(card).join('') : '<p class="muted">No vehicles yet. Start with a bike — it unlocks delivery jobs!</p>'}
  </section>
  ${other.length ? `<section class="card"><h2>⚓ Marina & hangar</h2>${other.map(card).join('')}</section>` : ''}`;
}

function spark(hist) {
  const w = 120, h = 32;
  const lo = Math.min(...hist), hi = Math.max(...hist), span = hi - lo || 1;
  const pts = hist.map((v, i) => `${(i / Math.max(1, hist.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / span * (h - 4)).toFixed(1)}`).join(' ');
  const up = hist[hist.length - 1] >= hist[0];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" class="${up ? 'up' : 'down'}"/></svg>`;
}

function viewBank() {
  const b = S.bank;
  const amts = [100, 1000, 10000, 100000];
  const amtBtns = (kind, max) => amts.filter(a => a <= Math.max(100, max)).map(a => btn(money(a, true), 'bank', kind, { arg2: a, cls: 'sm', disabled: max <= 0 })).join('') + btn('All', 'bank', kind, { arg2: 'all', cls: 'sm ghost', disabled: max <= 0 });
  const rows = S.stocks.map(st => {
    const d = STOCKS.find(x => x.sym === st.sym);
    const prev = st.hist.length > 1 ? st.hist[st.hist.length - 2] : st.price;
    const ch = (st.price / prev - 1) * 100;
    const h = S.holdings[st.sym];
    const val = h ? h.sh * st.price : 0;
    const pl = h ? val - h.cost : 0;
    return `<div class="stock">
      <div><b>${st.sym}</b><small>${d.name}</small></div>
      ${spark(st.hist)}
      <div class="sp"><b>${money(st.price)}</b><small class="${ch >= 0 ? 'good' : 'bad'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2)}%</small></div>
      <div class="sp">${h ? `<b>${money(val)}</b><small class="${pl >= 0 ? 'good' : 'bad'}">${pl >= 0 ? '+' : ''}${money(pl)}</small>` : '<small class="muted">—</small>'}</div>
      <div class="row">${[100, 1000, 10000].map(a => btn('+' + money(a, true), 'trade', st.sym, { arg2: 'buy:' + a, cls: 'sm', disabled: S.money < a })).join('')}
      ${btn('Max', 'trade', st.sym, { arg2: 'buy:all', cls: 'sm ghost', disabled: S.money < 1 })}
      ${h ? btn('Sell ½', 'trade', st.sym, { arg2: 'sellhalf', cls: 'sm ghost' }) + btn('Sell all', 'trade', st.sym, { arg2: 'sellall', cls: 'sm ghost' }) : ''}</div>
    </div>`;
  }).join('');
  return `<div class="grid2">
    <section class="card">
      <h2>🏦 Savings</h2>
      <div class="kv"><span>Cash</span><b>${money(S.money)}</b><span>Savings (0.4%/week)</span><b>${money(b.savings)}</b></div>
      <h3>Deposit</h3><div class="row">${amtBtns('deposit', S.money)}</div>
      <h3>Withdraw</h3><div class="row">${amtBtns('withdraw', b.savings)}</div>
    </section>
    <section class="card">
      <h2>💳 Loans</h2>
      <div class="kv"><span>Loan (1.5%/week)</span><b class="${b.loan ? 'bad' : ''}">${money(b.loan)}</b><span>You can borrow</span><b>${money(loanLimit())}</b></div>
      <h3>Borrow</h3><div class="row">${amtBtns('borrow', loanLimit())}</div>
      <h3>Repay</h3><div class="row">${amtBtns('repay', Math.min(b.loan, S.money))}</div>
      <p class="muted">Bills you can't pay are added to your loan automatically.</p>
    </section>
  </div>
  <section class="card"><div class="card-h"><h2>📈 Stock market</h2><span class="muted">Portfolio ${money(stockValue())}</span></div>
  <p class="muted">Prices move every day. You can buy fractional shares. MoonCoin is very risky.</p>
  <div class="stocks">${rows}</div></section>`;
}

function viewInv() {
  const cons = Object.keys(S.cons).map(id => {
    const it = ITEM[id];
    return `<div class="line"><span class="ico">${it.icon}</span><div><b>${it.name}</b> <span class="muted">×${S.cons[id]}</span><div class="tags">${it.fx ? fxText(it.fx) : `<span class="fx">${it.desc}</span>`}</div></div>
      ${btn(it.lottery ? 'Scratch' : ITEM[id].cat === 'drinks' ? 'Drink' : 'Eat', 'use', id, { cls: 'sm' })}</div>`;
  }).join('');
  const groups = Object.keys(CATS).filter(c => !['food', 'drinks'].includes(c)).map(c => {
    const list = ownedCat(c);
    if (!list.length) return '';
    return `<h3 class="cat">${CATS[c].icon} ${CATS[c].name} <span class="muted">(${list.length})</span></h3>` + list.map(o => {
      const it = itemOf(o);
      const installed = Object.values(S.pc).includes(o.uid);
      const extra = [];
      if (it.cat === 'furniture') extra.push(o.placed ? btn('Store', 'store-item', o.uid, { cls: 'ghost sm' }) : btn('Place', 'place', o.uid, { cls: 'sm' }));
      if (it.cat === 'pets') extra.push(btn('Rehome', 'sell', o.uid, { cls: 'ghost sm' }));
      else extra.push(btn(`Sell ${money(itemValue(o))}`, 'sell', o.uid, { cls: 'ghost sm' }));
      return `<div class="line"><span class="ico">${it.icon}</span>
        <div><b>${it.name}</b> ${installed ? '<span class="tag">In PC</span>' : ''}${it.cat === 'furniture' ? `<span class="tag ${o.placed ? '' : 'dim'}">${o.placed ? 'At home' : 'In storage'}</span>` : ''}
        <div class="muted small">Bought day ${o.day} for ${money(o.paid)}${o.val != null ? ` · now worth ${money(o.val)}` : ''}</div></div>
        <div class="row">${extra.join('')}</div></div>`;
    }).join('');
  }).join('');
  return `<section class="card"><h2>🍽️ Kitchen & tickets</h2>${cons || '<p class="muted">Empty. Buy food and drinks at FreshMart.</p>'}</section>
  <section class="card"><h2>🎒 Your stuff</h2>${groups || '<p class="muted">You don\'t own anything yet. Go shopping!</p>'}</section>`;
}

function viewTrophies() {
  const c = collection();
  const pct = Math.round(c.have / c.total * 100);
  const byCat = Object.keys(CATS).map(cat => {
    const all = ITEMS.filter(it => it.cat === cat && !it.hidden);
    const have = all.filter(it => S.ever[it.id]).length;
    return `<div class="cc"><span>${CATS[cat].icon} ${CATS[cat].name}</span><div class="bar"><i style="width:${have / all.length * 100}%"></i></div><b>${have}/${all.length}</b></div>`;
  }).join('');
  const ach = ACHIEVEMENTS.map(a => `<div class="ach ${S.ach[a.id] ? 'got' : ''}"><b>${a.icon}</b><div><span>${a.name}</span><small>${a.desc}${S.ach[a.id] ? ` · day ${S.ach[a.id]}` : ''}</small></div></div>`).join('');
  return `<section class="card">
    <div class="card-h"><h2>🏆 Collection</h2><b>${c.have}/${c.total} (${pct}%)</b></div>
    <div class="bar big"><i style="width:${pct}%"></i></div>
    <div class="collect">${byCat}</div>
  </section>
  <section class="card"><div class="card-h"><h2>🎖️ Achievements</h2><b>${Object.keys(S.ach).length}/${ACHIEVEMENTS.length}</b></div><div class="achs">${ach}</div></section>
  <section class="card"><h2>📊 Life stats</h2><div class="kv">
    <span>Days lived</span><b>${S.day}</b><span>Earned</span><b>${money(S.life.earned)}</b><span>Spent</span><b>${money(S.life.spent)}</b>
    <span>Things eaten</span><b>${S.eaten}</b><span>Followers</span><b>${S.followers.toLocaleString()}</b><span>Status</span><b>⭐ ${status().toLocaleString()}</b>
    <span>Hospital visits</span><b>${S.life.hospital}</b><span>Biggest ticket win</span><b>${money(S.life.biggestWin)}</b>
  </div></section>`;
}

// ---------- input ----------
function handle(act, arg, arg2) {
  switch (act) {
    case 'tab': S.tab = arg; window.scrollTo(0, 0); break;
    case 'store': S.store = arg; break;
    case 'goStore': S.tab = 'shop'; S.store = arg; window.scrollTo(0, 0); break;
    case 'buy': buy(arg, Number(arg2) || 1); break;
    case 'use': useItem(arg); break;
    case 'sell': sell(Number(arg)); break;
    case 'place': placeItem(Number(arg)); break;
    case 'store-item': storeItem(Number(arg)); break;
    case 'install': install(Number(arg)); break;
    case 'uninstall': uninstall(arg); break;
    case 'mining': S.mining = !S.mining; toast(S.mining ? '⛏️ Mining will run overnight.' : '⛏️ Mining stopped.'); break;
    case 'apply': applyJob(arg); break;
    case 'work': work(); break;
    case 'overtime': overtime(); break;
    case 'sleep': sleep(); break;
    case 'activity': doActivity(arg); break;
    case 'move': moveTo(arg); break;
    case 'buyhome': buyHome(arg); break;
    case 'sellhome': sellHome(arg); break;
    case 'dismiss': S.news = []; break;
    case 'bank': {
      const max = { deposit: S.money, withdraw: S.bank.savings, borrow: loanLimit(), repay: Math.min(S.bank.loan, S.money) }[arg];
      bank(arg, arg2 === 'all' ? max : Number(arg2));
      break;
    }
    case 'trade': {
      const [kind, amt] = arg2.split(':');
      trade(arg, kind, amt === 'all' ? S.money : Number(amt));
      break;
    }
    case 'newgame':
      if (confirm('Start a new game? Your current progress will be lost.')) { S = newState(); toast('New game started.'); }
      break;
  }
  render();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  handle(b.dataset.act, b.dataset.arg, b.dataset.arg2);
});

S = load() || newState();
render();
