// The tiny universe balls on the desktop, zooming into one (and back out), the world controls, saving.
import { ipc, asset, loadImage, canvas, clamp, lerp, rand, toast, el, esc, DPR, smooth } from '../util.js';
import { WorldScene, WPPM, loadSky } from './scene.js';
import { loadTownTextures, BT, ERAS, JOB_NAMES } from './town.js';
import { spawnItem, BY_ID } from '../items.js';
import { audio } from '../audio.js';
import { HPS, YEAR } from './people.js';

const BALL_R = 28;
export class Worlds {
  constructor(g) { this.g = g; this.balls = []; this.scenes = new Map(); this.inside = null; this.anim = null; this.slow = 1; this.ui = new WorldUI(this); }
  async load() {
    [this.deep, this.galaxy, this.nebula] = await Promise.all(['deepfield', 'galaxy', 'nebula'].map(n => loadImage(asset('space/' + n + '.webp'))));
    const soft = (im) => { const c = canvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'destination-in'; const g = x.createRadialGradient(im.width / 2, im.height / 2, im.width * 0.2, im.width / 2, im.height / 2, im.width * 0.5); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, im.width, im.height); return c; };
    this.galaxy = soft(this.galaxy); this.nebula = soft(this.nebula);
    await Promise.all([loadSky(), loadTownTextures()]);
    this.cv = document.getElementById('world'); this.c = this.cv.getContext('2d'); this.layer = document.getElementById('world-layer');
    this.zf = document.getElementById('zoomfx'); this.zc = this.zf.getContext('2d');
    this.bindInput();
    const idx = await ipc.invoke('load', 'universes.json');
    if (idx && idx.balls) for (const b of idx.balls) { const data = await ipc.invoke('load', 'universe-' + b.id + '.json'); this.spawnBall(Math.min(b.x, innerWidth - 60), Math.min(b.y, innerHeight - 100), data || { id: b.id, seed: b.seed }); }
    const g = this.g; const prevRemove = g.P.onRemove;
    g.P.onRemove = (b) => { if (prevRemove) prevRemove(b); if (b.universe && !this.quiet) this.destroyed(b); };
  }
  spawnBall(x, y, data) {
    if (this.balls.length >= 3) { toast('3 universes is the limit for now.'); return null; }
    const id = data?.id || ('u' + Date.now().toString(36) + Math.floor(Math.random() * 1000));
    const seed = data?.seed || Math.floor(Math.random() * 1e9);
    const tex = canvas(BALL_R * 2 * DPR(), BALL_R * 2 * DPR());
    const b = this.g.P.addCircle(BALL_R, x, y, 0, { tex, tox: -BALL_R, toy: -BALL_R, tw: BALL_R * 2, th: BALL_R * 2, mat: 'glass', kind: 'item', label: 'Tiny Universe', density: 1.4, rest: 0.35 });
    b.universe = id; b.unbreakable = true; b.brk = 1e9; b.noSlice = true; b.seed = seed;
    const scene = new WorldScene(this.g, data && data.hts ? data : { id, seed });
    this.scenes.set(id, scene); this.balls.push(b);
    if (!data) { audio.play('shimmer', { vol: 0.8, rate: 0.8 }); toast('A whole universe. Double-click it to go inside.', 3200); this.saveAll(); }
    return b;
  }
  destroyed(b) {
    this.balls = this.balls.filter(q => q !== b); const s = this.scenes.get(b.universe); this.scenes.delete(b.universe);
    if (s) { const n = s.sim.alive().length; toast(`You destroyed a universe. ${n} ${n === 1 ? 'person' : 'people'} in it are gone forever.`, 4200); }
    ipc.invoke('save', 'universe-' + b.universe + '.json', null); this.saveIndex();
    this.g.fx.flash(0.5, '200,170,255'); this.g.fx.ring(b.x, b.y, 300, '200,160,255', 0.8, 10); audio.play('big_boom', { vol: 0.8, rate: 0.5 });
  }
  clearBalls() { this.quiet = true; for (const b of this.balls.slice()) { this.g.P.remove(b); ipc.invoke('save', 'universe-' + b.universe + '.json', null); this.scenes.delete(b.universe); } this.balls = []; this.quiet = false; this.saveIndex(); }
  saveIndex() { ipc.invoke('save', 'universes.json', { balls: this.balls.map(b => ({ id: b.universe, seed: b.seed, x: Math.round(b.x), y: Math.round(b.y) })) }); }
  saveAll() { this.saveIndex(); for (const [id, s] of this.scenes) { try { ipc.invoke('save', 'universe-' + id + '.json', s.toJSON()); } catch (e) { console.error(e); } } }
  get scene() { return this.inside; }
  // ---------- the ball looks like a glass marble with deep space inside ----------
  drawBall(b, t) {
    const d = DPR(), c = b.tex.getContext('2d'), R = BALL_R * d; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, R * 2, R * 2);
    c.save(); c.beginPath(); c.arc(R, R, R - 0.5, 0, 7); c.clip();
    c.fillStyle = '#02030a'; c.fillRect(0, 0, R * 2, R * 2);
    c.translate(R, R); c.rotate(t * 0.05 - b.a); const s = R * 3.2; c.globalAlpha = 1; c.drawImage(this.deep, -s / 2, -s / 2, s, s);
    c.rotate(t * 0.12); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.55; c.drawImage(this.galaxy, -R * 0.7, -R * 0.7, R * 1.4, R * 1.4); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const g1 = c.createRadialGradient(R * 0.7, R * 0.6, 0, R, R, R); g1.addColorStop(0, 'rgba(255,255,255,0)'); g1.addColorStop(0.75, 'rgba(120,150,255,0.05)'); g1.addColorStop(1, 'rgba(170,200,255,0.55)'); c.fillStyle = g1; c.fillRect(0, 0, R * 2, R * 2);
    const g2 = c.createRadialGradient(R * 0.62, R * 0.5, 0, R * 0.62, R * 0.5, R * 0.55); g2.addColorStop(0, 'rgba(255,255,255,0.75)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.beginPath(); c.ellipse(R * 0.66, R * 0.52, R * 0.42, R * 0.26, -0.5, 0, 7); c.fill();
    c.restore();
  }
  // ---------- going in / out ----------
  async enter(b) {
    if (this.anim || this.inside) return; const s = this.scenes.get(b.universe); if (!s) return;
    this.g.release(); this.g.powers.set(null); this.g.hud.close(); this.g.placing = null;
    this.anim = { t: 0, dur: 3.0, ball: b, s, dir: 1, x: b.x, y: b.y }; this.zf.style.display = 'block';
    audio.play('whoosh', { vol: 0.8, rate: 0.6, noSlow: true }); audio.play('shimmer', { vol: 0.6, rate: 0.7, noSlow: true });
  }
  exit() {
    if (this.anim || !this.inside) return; const s = this.inside; const b = this.balls.find(q => q.universe === s.id);
    this.g.powers.set(null); this.g.placing = null; this.ui.card(null);
    this.snap = canvas(innerWidth, innerHeight); this.snap.getContext('2d').drawImage(this.cv, 0, 0, innerWidth, innerHeight);
    this.anim = { t: 0, dur: 1.3, ball: b, s, dir: -1, x: b ? b.x : innerWidth / 2, y: b ? b.y : innerHeight / 2 };
    this.inside = null; this.layer.classList.remove('on'); this.zf.style.display = 'block'; this.ui.hide();
    audio.play('whoosh', { vol: 0.7, rate: 1.2, noSlow: true }); for (const k of ['day_amb', 'night_amb', 'town_amb', 'pub_amb']) audio.stopLoop('w_' + k);
    this.saveAll();
  }
  drawAnim(dt) {
    const A = this.anim; if (!A) return; const now = performance.now() / 1000; if (A.t0 === undefined) A.t0 = now; A.t = now - A.t0; const k = clamp(A.t / A.dur, 0, 1); const W = innerWidth, H = innerHeight, d = DPR();
    this.zf.width = W * d; this.zf.height = H * d; const c = this.zc; c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
    const diag = Math.hypot(W, H);
    if (A.dir > 0) {
      // 1) the marble grows over the whole screen  2) fly through deep space past a galaxy  3) the sky of the world
      const k1 = smooth(clamp(k / 0.35, 0, 1)), k2 = clamp((k - 0.3) / 0.5, 0, 1), k3 = clamp((k - 0.78) / 0.22, 0, 1);
      const r = lerp(BALL_R, diag, k1 * k1); const cx = lerp(A.x, W / 2, k1), cy = lerp(A.y, H / 2, k1);
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip(); c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      const s1 = Math.max(W, H) * (1.2 + k * 3); c.translate(cx, cy); c.rotate(k * 0.6); c.drawImage(this.deep, -s1 / 2, -s1 / 2, s1, s1);
      c.rotate(-k * 0.6 + k2 * 1.2); const gs = Math.max(W, H) * (0.05 + Math.pow(k2, 2.2) * 5); c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp(k2 * 3, 0, 1) * (1 - k3); c.drawImage(this.galaxy, -gs / 2, -gs / 2, gs, gs);
      c.globalAlpha = clamp(k2 * 2 - 0.6, 0, 0.7) * (1 - k3); const ns = gs * 0.6; c.drawImage(this.nebula, -ns / 2, -ns / 2, ns, ns); c.restore();
      if (k3 > 0) { c.fillStyle = `rgba(200,225,255,${k3 < 0.5 ? k3 * 2 : 1})`; c.fillRect(0, 0, W, H); }
      if (k >= 1) {
        this.inside = A.s; const cz = A.s.cam; if (!A.s.visited) { A.s.visited = true; cz.tz = cz.z = 1.3; cz.tx = cz.x = 0; } cz.ty = cz.y = A.s.terrainY(cz.x) - innerHeight * 0.18 / cz.z; this.layer.classList.add('on'); this.ui.show(A.s);
        this.anim = { t: 0, dur: 0.6, fadeIn: true }; this.g.desk.closeFlyouts();
      }
    }
    if (A.fadeIn) { c.fillStyle = `rgba(200,225,255,${1 - k})`; c.fillRect(0, 0, W, H); if (k >= 1) { this.anim = null; this.zf.style.display = 'none'; } return; }
    if (A.dir < 0) {
      const kk = smooth(k); const r = lerp(diag, BALL_R, kk); const cx = lerp(W / 2, A.ball ? A.ball.x : A.x, kk), cy = lerp(H / 2, A.ball ? A.ball.y : A.y, kk);
      c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip(); const sc = r / diag * 1.2; c.translate(cx, cy); c.scale(sc, sc); c.drawImage(this.snap, -W / 2, -H / 2, W, H);
      c.restore(); c.save(); c.beginPath(); c.arc(cx, cy, r, 0, 7); c.clip(); c.globalAlpha = clamp(kk * 1.6 - 0.3, 0, 1); const s1 = r * 3.2; c.translate(cx, cy); c.drawImage(this.deep, -s1 / 2, -s1 / 2, s1, s1); c.restore();
      if (k >= 1) { this.anim = null; this.zf.style.display = 'none'; }
    }
  }
  // ---------- per frame ----------
  update(dt) {
    const t = performance.now() / 1000;
    for (const b of this.balls) { if (!b.dead) this.drawBall(b, t); }
    for (const [id, s] of this.scenes) s.update(dt, s === this.inside);
    if (this.anim) this.drawAnim(dt);
    if (this.inside) {
      const s = this.inside; this.updateHeld(dt); this.keysPan(dt);
      const d = DPR(); const W = innerWidth, H = innerHeight; if (this.cv.width !== Math.round(W * d)) { this.cv.width = W * d; this.cv.height = H * d; }
      this.c.setTransform(d, 0, 0, d, 0, 0); s.draw(this.c, W, H);
      this.ui.update(dt); this.ambience(s);
    }
  }
  ambience(s) {
    const h = s.sim.hour(); const night = h < 5.5 || h > 20.5; const vol = clamp(1 - (1 / s.cam.z) * 0.15, 0.15, 0.7);
    const nearTown = Math.abs(s.cam.x) < 90 * WPPM && s.sim.alive().length > 6;
    audio.loop('day_amb', night ? 0 : vol * 0.6, 'w_day_amb'); audio.loop('night_amb', night ? vol * 0.7 : 0, 'w_night_amb');
    audio.loop('town_amb', nearTown && !night && s.sim.era >= 2 ? vol * 0.35 : 0, 'w_town_amb');
    const bar = s.buildings.find(b => b.type === 'bar' && !b.gone && b.built >= 1); const barNear = bar && Math.abs(bar.x - s.cam.x) < innerWidth / s.cam.z && (h > 19 || h < 2);
    audio.loop('pub_amb', barNear ? s.volAt(bar.x) * 0.5 : 0, 'w_pub_amb');
  }
  // ---------- input inside the world ----------
  bindInput() {
    const cv = this.cv; let pan = null, downAt = null; this.keys = new Set();
    cv.addEventListener('pointerdown', (e) => {
      const s = this.inside; if (!s) return; audio.resume(); const [wx, wy] = s.toWorld(e.clientX, e.clientY); const g = this.g;
      g.mouse.down = e.button === 0;
      if (e.button === 2 || e.button === 1) { pan = { x: e.clientX, y: e.clientY, cx: s.cam.tx, cy: s.cam.ty }; return; }
      if (g.placing) { this.spawnInside(g.placing, wx, wy); if (!e.shiftKey) g.placing = null; return; }
      if (g.powers.active) { if (g.powers.active === 'resize') g.powers.resizeAt(wx, wy, 1.35); else g.powers.down(e); return; }
      const st = s.stickAt(wx, wy);
      if (g.tool === 'delete') { const b = s.P.bodyAt(wx, wy); if (st) st.s.die('deleted'); else if (b) s.P.remove(b); return; }
      if (st && g.tool === 'hand') { this.held = { s: st.s }; st.s.hold(st.j, wx, wy); this.select(st.s); return; }
      const b = s.P.bodyAt(wx, wy);
      if (b && g.tool === 'hand') { if (e.detail >= 2) g.use(b); const [lx, ly] = b.toLocal(wx, wy); this.held = { b, lx, ly }; b.held = true; b.rb.wakeUp(); return; }
      if (b && (g.tool === 'grow' || g.tool === 'shrink')) { s.P.rescale(b, g.tool === 'grow' ? 1.35 : 0.74); return; }
      if (b && g.tool === 'pin') { s.P.pin(b, !b.pinned); return; }
      if (b && g.tool === 'clone') { const o = { tex: b.tex, tox: b.tox, toy: b.toy, tw: b.tw, th: b.th, mat: b.mat, kind: b.kind, def: b.def, scale: b.scale }; b.r ? s.P.addCircle(b.r, b.x + 10, b.y - 20, b.a, o) : s.P.addPoly(b.poly.map(p => p.slice()), b.x + 10, b.y - 20, b.a, o); return; }
      pan = { x: e.clientX, y: e.clientY, cx: s.cam.tx, cy: s.cam.ty, click: true }; downAt = [e.clientX, e.clientY];
    });
    addEventListener('pointermove', (e) => {
      const s = this.inside; if (!s || !pan) return;
      if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) > 5) pan.click = false;
      s.cam.tx = pan.cx - (e.clientX - pan.x) / s.cam.z; s.cam.ty = pan.cy - (e.clientY - pan.y) / s.cam.z; s.cam.x = s.cam.tx; s.cam.y = s.cam.ty; s.follow = null;
    });
    addEventListener('pointerup', (e) => {
      const s = this.inside; if (!s) return; this.g.mouse.down = false;
      if (this.held) { if (this.held.s) this.held.s.release(this.g.mouse.vx / s.cam.z, this.g.mouse.vy / s.cam.z); if (this.held.b) { this.held.b.held = false; } this.held = null; }
      if (this.g.powers.active) this.g.powers.up(e);
      if (pan && pan.click) this.select(null);
      pan = null;
    });
    cv.addEventListener('wheel', (e) => {
      const s = this.inside; if (!s) return; const [wx, wy] = s.toWorld(e.clientX, e.clientY);
      const nz = clamp(s.cam.tz * Math.pow(1.0015, -e.deltaY), 0.12, 5); s.cam.tz = nz;
      s.cam.tx = wx - (e.clientX - innerWidth / 2) / nz; s.cam.ty = wy - (e.clientY - innerHeight / 2) / nz;
    }, { passive: true });
    cv.addEventListener('contextmenu', (e) => { e.preventDefault(); const s = this.inside; if (!s) return; if (this.g.placing) { this.g.placing = null; return; } if (this.g.powers.active === 'resize') { const [wx, wy] = s.toWorld(e.clientX, e.clientY); this.g.powers.resizeAt(wx, wy, 0.74); } });
    addEventListener('keydown', (e) => {
      if (!this.inside || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return; const k = e.key.toLowerCase(); this.keys.add(k);
      if (k === 'escape') { if (this.g.powers.active || this.g.tool !== 'hand' || this.g.placing) { this.g.powers.set(null); this.g.setTool('hand'); this.g.placing = null; } else this.exit(); }
      if (k === ' ') { if (this.inside.sel) this.inside.follow = this.inside.follow ? null : this.inside.sel; e.preventDefault(); }
      const n = parseInt(e.key); if (!isNaN(n)) this.g.powers.hotkey(n, e.shiftKey);
      if (k === 't') { this.g.timeScale = this.g.timeScale > 0.5 ? 0.18 : 1; audio.slow = this.g.timeScale < 1 ? 0.6 : 1; toast(this.g.timeScale < 1 ? 'Time is slow' : 'Time is normal'); }
      if (k === 'r' && this.g.hud.lastSpawn) { const [wx, wy] = this.inside.mouseWorld(); this.spawnInside(this.g.hud.lastSpawn, wx, wy); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }
  keysPan(dt) { const s = this.inside; const k = this.keys; const sp = 900 * dt / s.cam.z; if (k.has('a') || k.has('arrowleft')) { s.cam.tx -= sp; s.follow = null; } if (k.has('d') || k.has('arrowright')) { s.cam.tx += sp; s.follow = null; } if (k.has('w') || k.has('arrowup')) { s.cam.ty -= sp; s.follow = null; } if (k.has('s') || k.has('arrowdown')) { s.cam.ty += sp; s.follow = null; } }
  updateHeld(dt) {
    const H = this.held, s = this.inside; if (!H) return; const [mx, my] = s.mouseWorld();
    if (H.s) { if (H.s.gone || H.s.mode !== 'held') { this.held = null; return; } H.s.holdX = mx; H.s.holdY = my; return; }
    const b = H.b; if (b.dead) { this.held = null; return; } const [ax, ay] = b.toWorld(H.lx, H.ly); const v = b.rb.linvel(), m = b.mass(), ppm = s.P.ppm;
    const tx = (mx - ax) / ppm * 14, ty = (my - ay) / ppm * 14; const k = Math.min(1, 0.45 * 60 * dt);
    b.rb.applyImpulseAtPoint({ x: (tx - v.x) * m * k, y: (ty - v.y - s.P.g * dt) * m * k }, { x: ax / ppm, y: ay / ppm }, true); b.rb.setAngvel(b.rb.angvel() * 0.92, true);
  }
  spawnInside(id, x, y) {
    const s = this.inside; if (!s) return;
    if (id === 'stickman' || id === 'kid') { const p = s.sim.addPerson(x, id === 'kid'); p.stick.x = x; p.stick.ground = s.groundAt(x, y, p.stick); p.stick.pose(0); p.stick.knock(0, 0); p.stick.pts.forEach(q => { q[1] += y - p.stick.pts[2][1]; }); p.stick.prev = p.stick.pts.map(q => q.slice()); audio.play('pop', { vol: 0.4 }); return; }
    if (id === 'worldball') { toast("You can't put a universe inside a universe. Yet."); return; }
    const it = BY_ID[id]; if (!it) return; const b = spawnItem(s.P, it, x, y, { ppm: WPPM, size: this.g.spawnSize });
    if (b) audio.play('whoosh', { vol: 0.2, rate: 1.6 });
  }
  select(st) { const s = this.inside; s.sel = st; this.ui.card(st); }
}

// ---------- the controls on screen while inside a world ----------
class WorldUI {
  constructor(W) { this.W = W; this.root = document.getElementById('world-ui'); this.t = 0; }
  show(s) {
    this.s = s; const r = this.root; r.innerHTML = '';
    this.bar = el('div', 'wbar', `<div class="wchip btn" data-a="out">&#8592; BACK TO THE DESKTOP</div>
      <div class="wchip btn" data-a="pause">PAUSE</div><div class="wchip btn" data-a="1">1x</div><div class="wchip btn" data-a="3">3x</div><div class="wchip btn" data-a="10">10x</div><div class="wchip btn" data-a="30">30x</div>
      <div class="wchip" data-k="clock"></div><div class="wchip btn" data-a="person">+ PERSON</div><div class="wchip btn" data-a="find">FIND PEOPLE</div>`);
    r.appendChild(this.bar);
    this.bar.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; const s = this.s;
      if (a === 'out') this.W.exit(); else if (a === 'pause') s.speed = s.speed === 0 ? 1 : 0; else if (a === 'person') { this.W.g.placing = 'stickman'; toast('Click where the person goes'); }
      else if (a === 'find') { const ppl = s.sim.alive(); if (ppl.length) { const xs = ppl.map(p => p.stick.x); s.cam.tx = (Math.min(...xs) + Math.max(...xs)) / 2; s.cam.ty = s.terrainY(s.cam.tx) - 120; s.cam.tz = clamp(innerWidth / (Math.max(...xs) - Math.min(...xs) + 600), 0.15, 1.6); } }
      else s.speed = +a;
      this.refreshBar();
    };
    this.feedEl = el('div', 'wfeed'); r.appendChild(this.feedEl);
    for (const f of s.feed.slice(-8)) this.feedAdd(f, true);
    this.cardEl = el('div', 'wcard'); r.appendChild(this.cardEl);
    this.stats = el('div', 'wstats'); r.appendChild(this.stats);
    this.refreshBar(); this.root.style.display = '';
  }
  hide() { this.root.style.display = 'none'; }
  refreshBar() { const s = this.s; this.bar.querySelectorAll('[data-a]').forEach(b => { const a = b.dataset.a; b.classList.toggle('on', (a === 'pause' && s.speed === 0) || (+a === s.speed && s.speed > 0)); }); }
  feedAdd(f, quiet) {
    if (!this.feedEl) return; const d = el('div', f.kind, `<b style="opacity:.55;font-weight:normal">${esc(f.t)}</b> &nbsp;${esc(f.text)}`);
    this.feedEl.prepend(d); while (this.feedEl.children.length > 9) this.feedEl.lastChild.remove();
    if (!quiet && (f.kind === 'tech' || f.kind === 'love')) audio.play('pop_click', { vol: 0.12, rate: 1.6, noSlow: true });
  }
  card(st) {
    this.sel = st; if (!this.cardEl) return; if (!st || !st.person) { this.cardEl.classList.remove('on'); return; }
    this.cardEl.classList.add('on'); this.fillCard();
  }
  fillCard() {
    const st = this.sel, p = st.person, sim = this.s.sim; if (!p) return;
    const age = Math.floor(sim.ageOf(p)); const job = p.job ? JOB_NAMES[p.job] : age < 6 ? 'Little kid' : age < 18 ? 'Student' : age > 67 ? 'Retired' : 'No job';
    const rel = (id) => sim.get(id); const partner = p.partner && rel(p.partner);
    const kids = p.kids.map(rel).filter(Boolean).filter(k => !k.dead); const parents = p.parents.map(rel).filter(Boolean).filter(k => !k.dead);
    const home = sim.byId(p.home);
    const bars = [['Food', p.needs.food], ['Water', p.needs.water], ['Energy', p.needs.energy], ['Fun', p.needs.fun], ['Friends', p.needs.social], ['Health', p.health], ['Mood', p.mood]];
    const doing = { sleep: 'Sleeping', eat: 'Eating', drink: 'Drinking', work: 'Working', school: 'At school', bar: 'At the bar', talk: 'Talking', listen: 'Talking', fight: 'FIGHTING', arrest: 'Arresting someone', hospital: 'At the hospital', follow: 'With mom', play: 'Playing', party: 'Partying', wander: 'Walking around' }[p.plan?.type] || (st.mode === 'held' ? 'Being grabbed by YOU' : st.mode === 'ragdoll' ? 'Falling' : 'Standing');
    const enemies = Object.entries(p.rel).filter(([k, v]) => v < -40).map(([k]) => rel(+k)).filter(q => q && !q.dead).slice(0, 3);
    const friends = Object.entries(p.rel).filter(([k, v]) => v > 50 && +k !== p.partner).map(([k]) => rel(+k)).filter(q => q && !q.dead).slice(0, 4);
    this.cardEl.innerHTML = `<div class="x">✕</div><div class="nm"><i style="background:${p.color}"></i>${esc(p.name)} ${esc(p.last)}</div>
      <div class="sub">${age} years old · ${p.sex === 'f' ? 'woman' : 'man'}${age < 18 ? '' : ''} · ${esc(job)}${p.jail > 0 ? ' · IN JAIL' : ''}${p.preg > 0 ? ' · pregnant' : ''}${p.sick ? ' · sick' : ''}${p.drunk > 0.5 ? ' · drunk' : ''}</div>
      <div class="sub" style="margin-top:-6px">Now: ${esc(doing)} · Home: ${home ? esc(BT[home.type].name) : 'none'}</div>
      ${bars.map(([n, v]) => `<div class="bar"><span>${n}</span><em><b style="width:${clamp(v, 0, 100)}%;background:${v < 25 ? '#ff6a5a' : v < 50 ? '#ffd166' : '#8fe388'}"></b></em></div>`).join('')}
      <div class="think">"${esc(p.thought || sim.thinkLine(p))}"</div>
      <div class="rel">${partner ? `Partner: <b>${esc(partner.name)}</b><br>` : ''}${parents.length ? `Parents: ${parents.map(q => esc(q.name)).join(', ')}<br>` : ''}${kids.length ? `Kids: ${kids.map(q => esc(q.name)).join(', ')}<br>` : ''}${friends.length ? `Friends: ${friends.map(q => esc(q.name)).join(', ')}<br>` : ''}${enemies.length ? `Hates: ${enemies.map(q => esc(q.name)).join(', ')}<br>` : ''}${p.aware > 0.5 ? '<span style="color:#ffd166">Thinks this world is fake.</span><br>' : ''}</div>
      <div style="display:flex;gap:6px;margin-top:10px"><div class="wchip btn" data-c="follow">${this.s.follow === st ? 'STOP FOLLOWING' : 'FOLLOW (SPACE)'}</div></div>`;
    this.cardEl.querySelector('.x').onclick = () => this.W.select(null);
    this.cardEl.querySelector('[data-c=follow]').onclick = () => { this.s.follow = this.s.follow === st ? null : st; this.fillCard(); };
  }
  update(dt) {
    this.t += dt; if (this.t < 0.4) return; this.t = 0; const s = this.s, sim = s.sim;
    const h = sim.hour(); const hh = Math.floor(h), mm = Math.floor((h % 1) * 60);
    this.bar.querySelector('[data-k=clock]').textContent = `DAY ${sim.day()} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · YEAR ${sim.year()} · ${ERAS[sim.era].toUpperCase()} · ${sim.alive().length} PEOPLE`;
    this.stats.innerHTML = `WOOD ${Math.floor(sim.res.wood)} · STONE ${Math.floor(sim.res.stone)} · FOOD ${Math.floor(sim.res.food)}<br>KNOWLEDGE ${Math.floor(sim.know)}${sim.era < 5 ? ' / ' + [0, 60, 220, 600, 1400, 3000][sim.era + 1] : ''} · BORN ${sim.records.born} · DIED ${sim.records.died}`;
    if (this.sel) { if (this.sel.gone || !this.sel.alive) this.card(null); else this.fillCard(); }
  }
}
