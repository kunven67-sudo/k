// Your phone (P): messages (Mom texts you), a map of town with you and the
// people around, the weather, your bank balance, and your wanted level.
import * as THREE from 'three';

const APPS = [['messages', '💬', 'Messages'], ['map', '🗺️', 'Map'], ['weather', '⛅', 'Weather'], ['bank', '🏦', 'Bank'], ['wanted', '🚓', 'Wanted']];

export class Phone {
  constructor({ input, player, env, family, police, humans, level, canvas }) {
    Object.assign(this, { input, player, env, family, police, humans, level, canvas });
    this.el = document.getElementById('phone');
    this.messages = [];
    this.app = null;
    this.unread = 0;
    this.el?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-app]');
      if (b) { this.app = b.dataset.app === 'home' ? null : b.dataset.app; if (this.app === 'messages') this.unread = 0; this.render(); }
    });
    addEventListener('keydown', (e) => {
      if (this.isOpen && (e.code === 'KeyP' || e.code === 'Escape')) { e.preventDefault(); this.close(); }
    });
  }

  get isOpen() { return this.el && !this.el.hidden; }

  text(from, msg) {
    const h = this.env?.hour ?? 12;
    this.messages.push({ from, msg, at: `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}` });
    if (this.messages.length > 40) this.messages.shift();
    this.unread++;
    if (this.isOpen) this.render();
  }

  open() {
    if (!this.el) return;
    this.el.hidden = false;
    this.input.enabled = false;
    this.input.clear();
    document.exitPointerLock?.();
    this.render();
  }

  close() {
    this.el.hidden = true;
    this.input.enabled = true;
    this.canvas?.requestPointerLock?.()?.catch?.(() => {});
  }

  render() {
    if (!this.el) return;
    const h = this.env?.hour ?? 12;
    const clock = `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
    let body = '';
    if (!this.app) {
      body = `<div class="apps">${APPS.map(([id, icon, name]) => `<button data-app="${id}"><span>${icon}</span>${name}${id === 'messages' && this.unread ? `<b class="badge">${this.unread}</b>` : ''}</button>`).join('')}</div>`;
    } else if (this.app === 'messages') {
      body = this.messages.length ? this.messages.slice().reverse().map((m) => `<div class="msg"><b>${m.from}</b> <small>${m.at}</small><div>${m.msg}</div></div>`).join('') : '<p>No messages.</p>';
    } else if (this.app === 'map') {
      body = '<canvas width="240" height="300"></canvas><p class="legend"><i style="color:#3fa9ff">●</i> you &nbsp; <i style="color:#ff5b4a">●</i> police &nbsp; <i style="color:#ffd84a">●</i> Mom/Dad</p>';
    } else if (this.app === 'weather') {
      const w = this.env?.weather?.state ?? 'clear';
      const icon = { clear: (this.env?.night ?? 0) > 0.5 ? '🌙' : '☀️', cloudy: '☁️', rain: '🌧️', snow: '🌨️' }[w];
      const day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][((this.env?.day ?? 1) - 1) % 7];
      body = `<div class="big">${icon}</div><p>${day}, ${clock}</p><p>${Math.round(this.env?.temperature ?? 15)}°C, ${w}</p>`;
    } else if (this.app === 'bank') {
      body = `<div class="big">$${this.family?.money ?? 0}</div><p>Allowance: $10 every Sunday. Chores pay extra.</p>`;
    } else if (this.app === 'wanted') {
      const n = Math.ceil(this.police?.wanted ?? 0);
      body = `<div class="big">${n ? '★'.repeat(n) : '—'}</div><p>${n ? 'The police are looking for you. Stay out of sight (or shrink).' : 'Nobody is looking for you. For now.'}</p>`;
    }
    this.el.innerHTML = `<div class="bar">${clock}<span>📶 🔋</span></div><div class="screen">${body}</div><button class="home" data-app="home">${this.app ? '‹ Back' : 'P / Esc to close'}</button>`;
    if (this.app === 'map') this.drawMap(this.el.querySelector('canvas'));
  }

  drawMap(cv) {
    const g = cv.getContext('2d');
    // town: x -50..50, z -25..30 -> canvas (rotated so the street runs up the screen)
    const X = (z) => 10 + ((z + 25) / 55) * 220, Y = (x) => 290 - ((x + 50) / 100) * 280;
    g.fillStyle = '#7da35a'; g.fillRect(0, 0, 240, 300);
    g.fillStyle = '#555'; g.fillRect(X(9), 0, X(16) - X(9), 300);             // the road
    g.fillStyle = '#c9c4ba'; g.fillRect(X(7), 0, X(9) - X(7), 300); g.fillRect(X(16), 0, X(18) - X(16), 300);
    g.fillStyle = '#b9533e'; g.fillRect(X(-5), Y(7), X(0) - X(-5), Y(-4) - Y(7)); // your house
    g.fillStyle = '#fff'; g.font = '9px sans-serif'; g.fillText('home', X(-4), Y(2));
    const shops = (this.level?.town?.spots || []).filter((s) => s.act === 'shop');
    for (const s of shops) { g.fillStyle = '#8a7f72'; g.fillRect(X(18.6), Y(s.p.x + 5.9), 22, 22); g.fillStyle = '#fff'; g.fillText(s.name, X(23), Y(s.p.x + 1)); }
    const dot = (p, c, r = 3) => { g.fillStyle = c; g.beginPath(); g.arc(X(p.z), Y(p.x), r, 0, 7); g.fill(); };
    for (const h of this.humans) {
      if (h.dead || h.state === 'away' || h.villager) continue;
      if (h.isCop) dot(h.position, '#ff5b4a');
      else if (h.isParent) dot(h.position, '#ffd84a');
      else if (!h.tiny) dot(h.position, '#ddd', 2);
    }
    const f = this.player.feet;
    dot(f, '#3fa9ff', 5);
    // which way you face
    g.strokeStyle = '#3fa9ff'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(X(f.z), Y(f.x)); g.lineTo(X(f.z - Math.cos(this.player.yaw) * 4), Y(f.x - Math.sin(this.player.yaw) * 4)); g.stroke();
  }

  update(dt) {
    if (!this.isOpen && this.input.pressed('phone')) this.open();
    if (this.isOpen && this.app === 'map') { this.mapT = (this.mapT ?? 0) - dt; if (this.mapT <= 0) { this.mapT = 0.5; this.drawMap(this.el.querySelector('canvas')); } }
    const badge = document.getElementById('phonebadge');
    if (badge) { badge.hidden = !this.unread; badge.textContent = `📱 ${this.unread}`; }
  }
}

// ---- saving and loading (F5 / F9, and every 2 minutes)

const KEY = 'torture-humans-save-1';

export function saveGame(g) {
  const p = g.player, f = g.family;
  const data = {
    v: 1,
    at: Date.now(),
    hour: g.env?.hour, day: g.env?.day, weather: g.env?.weather?.state,
    player: { feet: p.feet.toArray(), scale: p.inCage ? 1 : p.scale, yaw: p.yaw },
    vitals: { health: g.vitals.health, hunger: g.vitals.hunger, thirst: g.vitals.thirst, energy: g.vitals.energy },
    money: f?.money ?? 0,
    chores: f ? [...f.chores.keys()] : [],
    given: f?.given ? [...f.given] : [],
    watchBackAt: f?.watchBackAt ?? null,
    lastAllowanceDay: f?.lastAllowanceDay ?? 0,
    bag: g.shops ? [...g.shops.bag.entries()].map(([id, e]) => [id, e.n]) : [],
    pets: g.pets ? g.pets.list.map((x) => ({ kind: x.kind, name: x.profile.name, love: x.love })) : [],
    messages: g.phone?.messages ?? [],
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export async function loadGame(g) {
  let d;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
  if (!d || d.v !== 1) return false;
  if (g.env && d.hour !== undefined) { g.env.hour = d.hour; g.env.day = d.day ?? 1; }
  if (g.env?.setWeather && d.weather) g.env.setWeather(d.weather);
  const p = g.player;
  p.inCage = false;
  p.setScale(d.player.scale ?? 1, new THREE.Vector3().fromArray(d.player.feet));
  p.yaw = d.player.yaw ?? p.yaw;
  Object.assign(g.vitals, d.vitals || {});
  const f = g.family;
  if (f) {
    f.money = 0; f.addMoney(d.money ?? 0);
    f.given = new Set(d.given || []);
    for (const k of d.chores || []) { f.chores.delete(k); f.give(k, null); }
    f.watchBackAt = d.watchBackAt ?? null;
    p.watchTaken = f.watchTaken;
    f.lastAllowanceDay = d.lastAllowanceDay ?? 0;
  }
  if (g.shops) {
    g.shops.bag.clear();
    for (const [id, n] of d.bag || []) { const it = g.shops.find(id); if (it) g.shops.bag.set(id, { item: it, n }); }
  }
  if (g.pets) for (const pt of d.pets || []) if (!g.pets.has(pt.kind)) { await g.pets.adopt(pt.kind, { quiet: true }); const x = g.pets.list.find((q) => q.kind === pt.kind); if (x) { x.profile.name = pt.name; x.love = pt.love ?? 0.5; } }
  if (g.phone) { g.phone.messages = d.messages || []; g.phone.unread = 0; }
  return true;
}
