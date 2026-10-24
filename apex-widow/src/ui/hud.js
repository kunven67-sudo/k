// The HUD: health number, hunger / silk / venom / molt, size in real units + "as big as", where you are, how hunted
// you are, a minimap, the crosshair + what you're aiming at, subtitles (muffled when you're tiny), news + social feed,
// hints, toasts, title cards, loading screen, cinema bars.
import * as THREE from 'three';
import { CSS } from './style.js';
import { sizeText, asBig, clamp } from '../core/util.js';
import { LEVEL_NAMES } from '../game/wanted.js';
import { FLOOR_NAMES } from '../world/tower.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const HG = '<svg viewBox="0 0 10 16"><path d="M0 0H10L5 7.6L10 16H0L5 8.4Z" fill="#ff2a1f"/></svg>';

export class Hud {
  constructor(game) {
    this.game = game;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const root = this.root = h('div'); root.id = 'ui'; document.body.appendChild(root);
    this.hud = h('div', 'hud off'); root.appendChild(this.hud);
    // stats
    const s = this.stat = h('div', 'stat');
    s.innerHTML = `<div class="hp"><span class="hpn">100</span><span class="lbl">health</span></div><div class="bar hp"><i></i></div>
      <div class="lbl">hunger</div><div class="bar hun"><i></i></div><div class="lbl">silk</div><div class="bar silk"><i></i></div>
      <div class="lbl">venom</div><div class="bar ven"><i></i></div><div class="lbl ml">molt</div><div class="bar molt"><i></i></div>`;
    this.hud.appendChild(s);
    this.el = { hpn: s.querySelector('.hpn'), hp: s.querySelector('.bar.hp i'), hun: s.querySelector('.bar.hun i'), silk: s.querySelector('.bar.silk i'), ven: s.querySelector('.bar.ven i'), molt: s.querySelector('.bar.molt i'), ml: s.querySelector('.ml') };
    const z = this.size = h('div', 'size', '<div class="big">4.0 mm</div><div class="as"></div><div class="zone"></div><div class="wanted"></div><div class="wanted-lbl"></div>');
    this.hud.appendChild(z);
    this.el.big = z.querySelector('.big'); this.el.as = z.querySelector('.as'); this.el.zone = z.querySelector('.zone'); this.el.wanted = z.querySelector('.wanted'); this.el.wl = z.querySelector('.wanted-lbl');
    for (let i = 0; i < 6; i++) this.el.wanted.appendChild(h('b'));
    this.mini = h('canvas', 'mini'); this.mini.width = this.mini.height = 190; this.hud.appendChild(this.mini); this.mg = this.mini.getContext('2d');
    this.cross = h('div', 'cross'); for (const [x, y] of [[9.5, 2], [9.5, 17], [2, 9.5], [17, 9.5]]) { const i = h('i'); i.style.left = x + 'px'; i.style.top = y + 'px'; this.cross.appendChild(i); } this.hud.appendChild(this.cross);
    this.target = h('div', 'target'); this.hud.appendChild(this.target);
    this.feedbar = h('div', 'feedbar', '<i></i>'); this.hud.appendChild(this.feedbar);
    this.obj = h('div', 'obj'); this.obj.style.display = 'none'; this.hud.appendChild(this.obj);
    this.hints = h('div', 'hints'); this.hud.appendChild(this.hints);
    this.feedEl = h('div', 'feed'); this.hud.appendChild(this.feedEl);
    this.danger = h('div', 'danger'); this.hud.appendChild(this.danger);
    // always-on layers (also during cutscenes)
    this.subs = h('div', 'subs'); root.appendChild(this.subs);
    this.toastEl = h('div', 'toast'); this.toastEl.style.opacity = 0; root.appendChild(this.toastEl);
    this.titleEl = h('div', 'title', '<div class="t1"></div><div class="t2"></div>'); this.titleEl.style.opacity = 0; root.appendChild(this.titleEl);
    this.cineT = h('div', 'cine top'); this.cineB = h('div', 'cine bot'); root.appendChild(this.cineT); root.appendChild(this.cineB);
    this.fadeEl = h('div', 'fade'); root.appendChild(this.fadeEl);
    this.loadEl = null;
    this.acc = 0; this.subT = 0; this.toastT = 0; this.titleT = 0;
  }
  show(on) { this.hud.classList.toggle('off', !on); }
  cinema(on) { this.cineT.classList.toggle('on', on); this.cineB.classList.toggle('on', on); }
  fade(to, sec = 1) { this.fadeEl.style.transition = `opacity ${sec}s`; this.fadeEl.style.opacity = to; }
  loading(text, frac) {
    if (text === null) { if (this.loadEl) { const e = this.loadEl; e.style.opacity = 0; setTimeout(() => e.remove(), 650); this.loadEl = null; } return; }
    if (!this.loadEl) {
      this.loadEl = h('div', 'loading', `<div class="logo" style="font-size:64px">APEX WID<span class="o">O${HG}</span>W</div><div class="lt"></div><div class="lb"><i></i></div>`);
      document.body.appendChild(this.loadEl);
    }
    this.loadEl.querySelector('.lt').textContent = text; this.loadEl.querySelector('.lb i').style.width = Math.round((frac || 0) * 100) + '%';
  }
  toast(text, sec = 2.5) { this.toastEl.textContent = text; this.toastEl.style.opacity = 1; this.toastT = sec; }
  title(t1, t2, sec = 3) { this.titleEl.querySelector('.t1').textContent = t1; this.titleEl.querySelector('.t2').textContent = t2 || ''; this.titleEl.style.opacity = 1; this.titleT = sec; }
  objective(t) { this.obj.textContent = t; this.obj.style.display = t ? 'block' : 'none'; }
  subtitle(who, txt, sec = 3, sizeM = 1) {
    const s = this.game.settings; if (!s.subtitles) return;
    const muffled = sizeM < 0.02;
    this.subs.className = 'subs' + (muffled ? ' muffled' : '');
    this.subs.style.fontSize = (s.subSize === 'large' ? 26 : s.subSize === 'small' ? 16 : 20) + 'px';
    this.subs.innerHTML = muffled ? '<span>[ a giant voice booms, too deep to make out ]</span>' : `<span class="who">${who}</span>${txt}`;
    this.subT = sec;
  }
  voice(who, txt, sizeM, pos) {
    const G = this.game; if (!G.player) return;
    const d = pos.distanceTo(G.player.pos); if (d > Math.max(12, G.player.sizeM * 60)) return;
    this.subtitle(who, txt, 3.2, sizeM);
  }
  hint(id, text, key) {
    const d = h('div', '', (key ? `<span class="key">${key}</span>` : '') + text);
    this.hints.appendChild(d);
    setTimeout(() => { d.style.opacity = 0; d.style.transform = 'translateX(-20px)'; setTimeout(() => d.remove(), 700); }, 9000);
  }
  feed(who, text, views, news) {
    const d = h('div', news ? 'news' : '', `<div class="h">${news ? 'BREAKING' : who}${views ? '  &middot;  ' + views.toLocaleString() + ' views' : ''}</div>${text}`);
    this.feedEl.prepend(d); while (this.feedEl.children.length > 4) this.feedEl.lastChild.remove();
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 900); }, 14000);
  }
  wanted(level) { this.el.wl.textContent = LEVEL_NAMES[level] || ''; }
  trophy(title) { const d = h('div', 'trophy', `<span class="key">TROPHY</span>${title}`); this.root.appendChild(d); setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 600); }, 3500); }
  hurt(a) { this.hurtV = Math.min(1, (this.hurtV || 0) + a); }
  vibration(pos) {
    const G = this.game; const v = pos.clone().project(G.camera); if (v.z > 1) return;
    const d = h('div', 'vib'); d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
    this.root.appendChild(d); setTimeout(() => d.remove(), 1000);
  }
  zoneChanged() {}
  applyToggles() {
    const h = this.game.settings.hud || {};
    const vis = (el, on) => { el.style.visibility = on === false ? 'hidden' : ''; };
    vis(this.mini, h.minimap); vis(this.feedEl, h.feed); vis(this.stat, h.meters); vis(this.size, h.size); vis(this.el.wanted, h.wanted); vis(this.el.wl, h.wanted);
    vis(this.target, h.near); vis(this.hints, h.kills); vis(this.toastEl, h.kills);
  }

  update(dt) {
    const G = this.game, p = G.player; if (!p) return;
    // timers (every frame)
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.subs.innerHTML = ''; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.toastEl.style.opacity = 0; }
    if (this.titleT > 0) { this.titleT -= dt; if (this.titleT <= 0) this.titleEl.style.opacity = 0; }
    this.hurtV = Math.max(0, (this.hurtV || 0) - dt * 1.4);
    G.renderer.grade.uniforms.get('hurt').value = this.hurtV + (p.hp < 25 ? 0.25 + 0.15 * Math.sin(G.time * 5) : 0);
    // DOM at ~12 Hz
    this.acc += dt; if (this.acc < 0.08) { this.drawMini(); return; } this.acc = 0;
    this.el.hpn.textContent = Math.max(0, Math.ceil(p.hp));
    this.el.hp.style.width = clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
    this.el.hun.style.width = p.hunger * 100 + '%'; this.el.silk.style.width = p.silk * 100 + '%'; this.el.ven.style.width = p.venom * 100 + '%'; this.el.molt.style.width = p.molt * 100 + '%';
    this.el.ml.innerHTML = p.molt >= 1 ? '<span class="molt-ready">molt ready  &middot;  M</span>' : 'molt ' + Math.floor(p.molt * 100) + '%';
    this.el.big.textContent = sizeText(p.sizeM);
    this.el.as.textContent = 'as big as ' + asBig(p.sizeM);
    const Z = G.zone; let where = Z ? Z.name : '';
    if (Z && Z.floorAt) { const f = Z.floorAt(p.pos); where = f ? (FLOOR_NAMES[f] || 'Floor ' + f).replace(' - ', '  /  ') : Z.inside(p.pos) ? 'VOSS tower  /  core' : 'New Halvern'; }
    this.el.zone.textContent = where;
    const lv = G.wanted ? G.wanted.level : 0; [...this.el.wanted.children].forEach((b, i) => b.classList.toggle('on', i < lv));
    // target under the crosshair / in front of you
    const A = G.actions, fr = A.feeding ? A.feeding.t : (A.lock && A.valid(A.lock) ? A.lock : A.frontTarget ? A.frontTarget(1.4) : null);
    const aim = A.aim;
    let t = fr; if (!t && aim) t = aim.kind === 'creature' ? { type: 'c', c: aim.c } : aim.kind === 'human' ? { type: 'h', h: aim.h } : null;
    if (t && A.valid(t)) {
      const isC = t.type === 'c', hp = isC ? t.c.hp : t.h.hp, mx = isC ? t.c.maxHp : 100;
      const state = isC ? (t.c.state === 'dead' ? 'DEAD' : t.c.wrapped ? 'WRAPPED' : t.c.state === 'paralyzed' ? 'PARALYZED' : t.c.stuck > 0 ? 'WEBBED' : t.c.mode === 'hunt' ? 'HUNTING YOU' : '') : (t.h.state === 'wrapped' ? 'WRAPPED' : t.h.state === 'paralyzed' ? 'PARALYZED' : t.h.noticed ? 'HAS SEEN YOU' : '');
      const near = A.frontTarget && A.frontTarget(1.4);
      const close = near && ((near.type === 'c' && t.type === 'c' && near.c === t.c) || (near.type === 'h' && t.type === 'h' && near.h === t.h));
      let act = '';
      if (close) act = A.helpless(t) ? `<span class="key">E</span>${(A.tMass(t) / p.mass > 0.6 && !(isC ? t.c.wrapped : t.h.state === 'wrapped')) ? 'WRAP' : 'EAT'}` : '<span class="key">LMB</span>BITE';
      const lt = isC ? t.c.def.latin : t.h.role === 'voss' ? 'the man who made you' : '';
      this.target.innerHTML = `<div class="nm">${isC ? t.c.def.name : t.h.name}</div><div class="lt">${lt}</div><div class="bar" style="width:160px;margin:6px auto 2px"><i style="width:${clamp(hp / mx, 0, 1) * 100}%;background:#ff3b30"></i></div><div class="lbl" style="font-size:11px">${Math.max(0, Math.ceil(hp))} / ${Math.ceil(mx)}</div><div class="st">${state}</div><div class="act">${act}</div>`;
      this.target.style.opacity = 1;
    } else if (aim && aim.kind === 'surface' && aim.dist < G.cam.curDist + p.s * 45) { this.target.innerHTML = '<div class="act" style="opacity:.6"><span class="key">F</span>line</div>'; this.target.style.opacity = 1; }
    else this.target.style.opacity = 0;
    // feeding progress
    if (A.feeding) { this.feedbar.style.display = 'block'; this.feedbar.firstChild.style.width = A.feeding.prog * 100 + '%'; } else this.feedbar.style.display = 'none';
    this.drawMini();
  }
  drawMini() {
    const G = this.game, p = G.player, g = this.mg; if (!p || this.mini.style.display === 'none') return;
    const W = 190, R = W / 2, s = p.s, range = Math.max(s * 60, 0.5);
    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(10,10,14,0.6)'; g.beginPath(); g.arc(R, R, R, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; for (const k of [0.33, 0.66]) { g.beginPath(); g.arc(R, R, R * k, 0, 7); g.stroke(); }
    const yaw = Math.atan2(G.camera.getWorldDirection(new THREE.Vector3()).x, G.camera.getWorldDirection(new THREE.Vector3()).z);
    const toMap = (pos) => { const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z; const c = Math.cos(-yaw + Math.PI), sn = Math.sin(-yaw + Math.PI); const x = dx * c - dz * sn, y = dx * sn + dz * c; return [R + x / range * R, R + y / range * R]; };
    const dot = (pos, col, r) => { const [x, y] = toMap(pos); if ((x - R) ** 2 + (y - R) ** 2 > R * R) return; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    const Z = G.zone;
    if (Z && Z.creatures) for (const c of Z.creatures.list) { if (c.state === 'eaten') continue; const big = c.L > p.sizeM * 0.4 || c.mode === 'hunt'; dot(c.pos, c.mode === 'hunt' ? '#ff3b30' : c.helpless ? '#c79bff' : big ? '#e8c060' : 'rgba(232,200,96,0.55)', c.mode === 'hunt' ? 3.5 : 2.2); }
    if (Z && Z.humans) for (const hm of Z.humans.list) if (hm.state !== 'gone' && hm.state !== 'eaten' && Math.abs(hm.pos.y - p.pos.y) < 4) dot(hm.pos, hm.noticed ? '#ff8a7a' : '#ffffff', 3.5);
    if (G.growth.lair) dot(G.growth.lair.pos, '#c79bff', 4);
    g.fillStyle = '#ff2a1f'; g.beginPath(); g.moveTo(R, R - 6); g.lineTo(R + 4, R + 4); g.lineTo(R - 4, R + 4); g.fill();
  }
  frame() {}
}
