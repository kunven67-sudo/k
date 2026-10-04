// Your in-game phone (P or Tab): Messages, Bank, Shop, Sell, Chores, Camera, Weather.
import { input } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { SHOP, CHORES } from '../game/economy.js';
import { things } from '../world/thing.js';

const $ = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const CSS = `
.phone-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:flex-end;padding-right:6vw;pointer-events:auto;background:rgba(0,0,0,.25)}
.phone{width:min(330px,88vw);height:min(660px,88vh);border-radius:44px;padding:12px;background:#111;box-shadow:0 30px 70px rgba(0,0,0,.7),inset 0 0 0 2px #3a3f46;display:flex}
.pscreen{flex:1;border-radius:34px;overflow:hidden;background:linear-gradient(160deg,#1b2d55,#5a2a63);display:flex;flex-direction:column;color:#fff;font:14px system-ui,sans-serif}
.pbar{display:flex;justify-content:space-between;padding:10px 22px 6px;font:600 13px system-ui}
.papps{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 8px;padding:18px 16px}
.papp{display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:0;color:#fff;font:500 11px system-ui}
.papp i{font-style:normal;width:56px;height:56px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 3px 8px rgba(0,0,0,.3)}
.ptop{display:flex;align-items:center;gap:8px;padding:6px 14px 10px;font:800 18px system-ui}
.ptop button{background:none;border:0;color:#9cf;font:600 15px system-ui}
.pbody{flex:1;overflow-y:auto;background:#0d0f14;padding:10px}
.pitem{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;border-radius:12px;background:#1a1d25;margin-bottom:8px}
.pitem small{display:block;color:#8a93a3;font-size:11px;margin-top:2px}
.pitem button{background:#2f7bf6;border:0;color:#fff;border-radius:10px;padding:7px 11px;font:700 12px system-ui}
.pitem button:disabled{background:#3a3f4a;color:#889}
.pbig{font:800 34px system-ui;padding:14px 4px}
.pmsg{padding:9px 12px;border-radius:16px;background:#262b36;margin:6px 0;max-width:85%}
.pmsg b{display:block;font-size:11px;color:#8ab4ff}
.pphoto{width:100%;border-radius:12px;margin-bottom:8px}
`;

export class PhoneUI {
  constructor(game) {
    this.game = game; this.el = null; this.photos = [];
    const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  }
  get open() { return !!this.el; }
  toggle() { if (this.el) this.close(); else this.show(); }
  show(app = 'home') {
    const g = this.game;
    if (g.watch && g.elsewhere) { g.ui.toast('📱 Your phone is huge right now... grow back first.'); return; }
    g.panelOpen = true; input.enabled = false; input.exitLock();
    this.el = $(`<div class="phone-wrap click"><div class="phone"><div class="pscreen"><div class="pbar"><span class="pt"></span><span>📶 🔋 ${Math.round((g.phone?.battery ?? 0.6) * 100)}%</span></div><div class="pview" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div></div></div>`);
    this.el.addEventListener('pointerdown', (e) => { if (e.target === this.el) this.close(); });
    g.ui.root.append(this.el);
    g.ui.closePanel = () => this.close();
    this.app(app);
    this.tick = setInterval(() => { const t = this.el?.querySelector('.pt'); if (t) t.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }, 1000);
    this.el.querySelector('.pt').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  close() {
    const g = this.game;
    if (!this.el) return;
    this.el.remove(); this.el = null; clearInterval(this.tick);
    g.panelOpen = false; if (g.playing) { input.enabled = true; input.requestLock(); }
  }
  app(name) {
    const g = this.game, eco = g.economy, v = this.el.querySelector('.pview');
    v.innerHTML = '';
    const top = (title) => { const t = $(`<div class="ptop"><button>‹ Home</button>${title}</div>`); t.firstChild.onclick = () => this.app('home'); v.append(t); const b = $('<div class="pbody"></div>'); v.append(b); return b; };
    sfx.click(0.2);
    if (name === 'home') {
      const apps = [['msgs', '💬', 'Messages', '#2fbf4f'], ['bank', '🏦', 'Bank', '#1f6feb'], ['shop', '🛒', 'Shop', '#f28c28'], ['sell', '💸', 'Sell', '#8a3ffc'], ['chores', '✅', 'Chores', '#e5484d'], ['camera', '📷', 'Camera', '#555'], ['weather', '⛅', 'Weather', '#2aa8e0'], ['photos', '🖼️', 'Photos', '#d6409f']];
      const grid = $('<div class="papps"></div>');
      for (const [id, ic, label, col] of apps) { const b = $(`<button class="papp"><i style="background:${col}">${ic}</i>${label}</button>`); b.onclick = () => this.app(id); grid.append(b); }
      v.append($(`<div style="text-align:center;padding:26px 0 6px;font:200 54px system-ui">${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M/i, '')}</div>`));
      v.append($(`<div style="text-align:center;font:500 14px system-ui;opacity:.8">${new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</div>`));
      v.append(grid);
    } else if (name === 'msgs') {
      const b = top('Messages');
      for (const m of eco.messages.slice(0, 40)) b.append($(`<div class="pmsg"><b>${m.from} · ${new Date(m.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b>${m.text}</div>`));
    } else if (name === 'bank') {
      const b = top('Bank');
      b.append($(`<div class="pbig">$${eco.money.toFixed(2)}</div>`));
      if (g.grounded) b.append($('<div class="pitem">⚠️ Grounded: no allowance this week</div>'));
      b.append($('<div style="color:#8a93a3;font-size:12px;margin:6px 2px">Allowance: $20 every Saturday · chores pay extra</div>'));
      for (const l of eco.log.slice(0, 30)) b.append($(`<div class="pitem"><span>${l.what}<small>${new Date(l.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span><b style="color:${l.amt >= 0 ? '#3fdc7f' : '#ff6b6b'}">${l.amt >= 0 ? '+' : '-'}$${Math.abs(l.amt).toFixed(2)}</b></div>`));
    } else if (name === 'shop') {
      const b = top('ShopNow');
      b.append($(`<div style="color:#8a93a3;font-size:12px;margin:2px 2px 8px">Balance $${eco.money.toFixed(2)} · same-day delivery to your door</div>`));
      let cat = null;
      for (const it of SHOP) {
        if (it.cat !== cat) { cat = it.cat; b.append($(`<div style="font:800 13px system-ui;margin:10px 2px 6px;color:#ffcf7a">${cat}</div>`)); }
        const row = $(`<div class="pitem"><span>${it.icon} ${it.name}<small>$${it.price}</small></span><button ${eco.money < it.price ? 'disabled' : ''}>Buy</button></div>`);
        row.querySelector('button').onclick = () => { const err = eco.buy(it); if (err) g.ui.toast(err); else { g.ui.toast(`🛒 Ordered ${it.name}! Arrives at your door soon.`, 3); this.app('shop'); } };
        b.append(row);
      }
    } else if (name === 'sell') {
      const b = top('Sell');
      b.append($('<div style="color:#8a93a3;font-size:12px;margin:2px 2px 8px">Sell stuff you own. A buyer picks it up.</div>'));
      const mine = [...things].filter((t) => t.body && t.type === 'dynamic' && t.spawnId && !t.pieceOf && !['pillow'].includes(t.spawnId));
      if (!mine.length) b.append($('<div class="pitem">Nothing to sell right now.</div>'));
      for (const t of mine.slice(0, 40)) {
        const row = $(`<div class="pitem"><span>${t.icon} ${t.name}</span><button>Sell</button></div>`);
        row.querySelector('button').onclick = () => { const p = eco.sell(t); g.ui.toast(`💸 Sold ${t.name} for $${p.toFixed(2)}`); this.app('sell'); };
        b.append(row);
      }
    } else if (name === 'chores') {
      const b = top('Chores');
      const day = new Date().toDateString();
      for (const c of CHORES) b.append($(`<div class="pitem"><span>${eco.choresDone[c.id] === day ? '✅' : '⬜'} ${c.name}<small>pays $${c.pay}</small></span></div>`));
    } else if (name === 'camera') {
      this.close();
      g.ui.toast('📷 Taking a photo...', 1.2);
      g.takePhoto = (url) => { this.photos.unshift({ url, t: Date.now() }); g.ui.toast('📷 Saved to Photos', 2); sfx.click(0.6); };
    } else if (name === 'photos') {
      const b = top('Photos');
      if (!this.photos.length) b.append($('<div class="pitem">No photos yet. Use the Camera app!</div>'));
      for (const ph of this.photos) {
        const img = $(`<img class="pphoto" src="${ph.url}">`); b.append(img);
        const dl = $(`<a class="pitem" download="shrinkbox-${ph.t}.png" href="${ph.url}" style="color:#9cf;text-decoration:none">⬇️ Save to your real computer</a>`); b.append(dl);
      }
    } else if (name === 'weather') {
      const b = top('Weather');
      const h = new Date().getHours(), m = new Date().getMonth();
      const temp = Math.round(60 + 12 * Math.sin((m - 3) / 12 * 6.28) + 8 * Math.sin((h - 9) / 24 * 6.28));
      b.append($(`<div class="pbig">${temp}°F ☀️</div>`));
      b.append($('<div class="pitem">West Coast · mild and mostly sunny<small>Rain is rare this time of year</small></div>'));
      b.append($('<div class="pitem">🌎 Small earthquakes are normal here. Most you won\'t even feel.</div>'));
    }
  }
}
