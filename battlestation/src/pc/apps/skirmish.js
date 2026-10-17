import { Kit, clientCursor, font, fillRR, text } from './kit.js';
import { MONO } from '../gfx.js';
import { makeIcon } from './dustline.js';

// SKIRMISH: an "online" top-down arena shooter. It's played against bots, but it acts online:
// it needs the in-game internet, shows your ping, gets laggy on weak Wi-Fi and kicks you
// with "Connection lost" the moment the router's cable comes out.
const NAMES = ['xXSniperXx', 'toaster_bath', 'mom_get_off', 'NoScopeNate', 'kev1n', 'lagswitch', 'SweatyPalms', 'grandma_gamer', 'BigChungus77', 'el_jefe', 'wifi_warrior', 'potato_aim'];

export class Skirmish {
  static title = 'SKIRMISH'; static icon = 'game'; static w = 1100; static h = 680; static exe = 'Skirmish.exe';
  constructor(os, win) {
    this.os = os; this.win = win; this.kit = new Kit();
    win.img = makeIcon('SK', '#2e86de');
    this.mode = 'menu'; this.keys = new Set(); this.acc = 0; this.t = 0;
    this.W = 1600; this.H = 1000;
    this.msg = '';
  }
  net() { return this.os.g.router; }
  connect() {
    const st = this.net().status(true);
    if (!st.internet) { this.mode = 'menu'; this.msg = 'Can\'t reach the SKIRMISH servers. Check your internet connection.'; return; }
    this.mode = 'connecting'; this.ct = 0;
  }
  startMatch() {
    this.mode = 'play'; this.t = 0;
    this.me = { x: 800, y: 500, hp: 100, k: 0, d: 0, cd: 0, name: this.os.user.name };
    this.bots = NAMES.slice(0, 7).map((n, i) => ({ name: n, x: 200 + Math.random() * 1200, y: 150 + Math.random() * 700, hp: 100, k: 0, d: 0, cd: Math.random(), tx: 800, ty: 500, skill: 0.3 + Math.random() * 0.5, col: `hsl(${i * 50},70%,55%)` }));
    this.shots = [];
    this.walls = [[500, 300, 120, 30], [980, 300, 120, 30], [740, 460, 120, 80], [300, 650, 200, 30], [1100, 650, 200, 30], [200, 200, 30, 160], [1370, 640, 30, 160]];
    this.timeLeft = 180;
  }
  update(dt) {
    const r = this.net();
    const st = r.status(true);
    if (this.mode === 'connecting') { this.ct += dt; if (!st.internet) { this.mode = 'menu'; this.msg = 'Connection failed.'; } else if (this.ct > 2.2) this.startMatch(); return true; }
    if (this.mode !== 'play') { this.cpuLoad = 0.02; this.gpuLoad = 0.02; return this.os.focus === this.win; }
    if (!st.internet) { this.lost = (this.lost || 0) + dt; if (this.lost > 2.5) { this.mode = 'kicked'; this.lost = 0; } }
    else this.lost = 0;
    r.touch(0.4);
    this.cpuLoad = 0.12; this.gpuLoad = Math.min(1, 6 / Math.max(1, this.os.hw.parts.gpu.score) + 0.15);
    const fps = this.os.hw.fps(6);
    this.acc += dt;
    if (this.acc < 1 / fps) return false;
    const fdt = Math.min(0.2, this.acc); this.acc = 0;
    if (!this.lost) this.step(fdt, r.speed(true).ping);
    this.fps = Math.round(1 / fdt);
    return true;
  }
  step(dt, ping) {
    this.t += dt; this.timeLeft -= dt;
    const me = this.me;
    if (me.hp > 0) {
      let mx = 0, my = 0;
      if (this.keys.has('KeyW')) my--; if (this.keys.has('KeyS')) my++; if (this.keys.has('KeyA')) mx--; if (this.keys.has('KeyD')) mx++;
      const l = Math.hypot(mx, my) || 1;
      this.move(me, mx / l * 260 * dt, my / l * 260 * dt);
      me.cd -= dt;
      if (this.firing && me.cd <= 0) { me.cd = 0.16; this.fire(me, this.aimX, this.aimY); }
    } else { me.respawn = (me.respawn || 0) + dt; if (me.respawn > 3) { me.hp = 100; me.respawn = 0; me.x = 200 + Math.random() * 1200; me.y = 200 + Math.random() * 600; } }
    // bots: their movement shows up late on a bad ping (lag)
    const jitter = Math.min(1, ping / 120);
    for (const b of this.bots) {
      if (b.hp <= 0) { b.rs = (b.rs || 0) + dt; if (b.rs > 3) { b.hp = 100; b.rs = 0; b.x = 200 + Math.random() * 1200; b.y = 150 + Math.random() * 700; } continue; }
      const targets = [me, ...this.bots].filter(o => o !== b && o.hp > 0);
      const tg = targets.sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
      if (!tg) continue;
      const d = Math.hypot(tg.x - b.x, tg.y - b.y);
      if (Math.random() < dt * 0.8) { b.tx = tg.x + (Math.random() - 0.5) * 300; b.ty = tg.y + (Math.random() - 0.5) * 300; }
      const dx = b.tx - b.x, dy = b.ty - b.y, dl = Math.hypot(dx, dy) || 1;
      if (dl > 20) this.move(b, dx / dl * 200 * dt, dy / dl * 200 * dt);
      if (Math.random() < jitter * dt * 8) { b.x += (Math.random() - 0.5) * 30 * jitter; b.y += (Math.random() - 0.5) * 30 * jitter; }
      b.cd -= dt;
      if (d < 520 && b.cd <= 0) { b.cd = 0.3 + (1 - b.skill) * 0.6; this.fire(b, tg.x + (Math.random() - 0.5) * 80 * (1 - b.skill), tg.y + (Math.random() - 0.5) * 80 * (1 - b.skill)); }
    }
    for (const s of this.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (this.walls.some(([x, y, w, h]) => s.x > x && s.x < x + w && s.y > y && s.y < y + h)) s.life = 0;
      for (const o of [me, ...this.bots]) {
        if (o === s.from || o.hp <= 0 || s.life <= 0) continue;
        if (Math.hypot(o.x - s.x, o.y - s.y) < 16) { o.hp -= 22; s.life = 0; if (o.hp <= 0) { o.d++; s.from.k++; this.feed = `${s.from.name} eliminated ${o.name}`; this.feedT = 3; } }
      }
    }
    this.shots = this.shots.filter(s => s.life > 0 && s.x > 0 && s.y > 0 && s.x < this.W && s.y < this.H);
    this.feedT = Math.max(0, (this.feedT || 0) - dt);
    if (this.timeLeft <= 0) this.mode = 'over';
  }
  move(o, dx, dy) {
    const hit = (x, y) => x < 15 || y < 15 || x > this.W - 15 || y > this.H - 15 || this.walls.some(([wx, wy, w, h]) => x > wx - 14 && x < wx + w + 14 && y > wy - 14 && y < wy + h + 14);
    if (!hit(o.x + dx, o.y)) o.x += dx;
    if (!hit(o.x, o.y + dy)) o.y += dy;
  }
  fire(o, tx, ty) {
    const dx = tx - o.x, dy = ty - o.y, l = Math.hypot(dx, dy) || 1;
    this.shots.push({ x: o.x + dx / l * 18, y: o.y + dy / l * 18, vx: dx / l * 900, vy: dy / l * 900, life: 1, from: o });
    if (o === this.me) this.os.g.audio?.play('gun.ogg', { vol: 0.18, rate: 1.4 });
  }
  draw(g, w, h) {
    this.kit.begin();
    const cur = clientCursor(this.os, this.win);
    const r = this.net(), st = r.status(true);
    g.fillStyle = '#0d1b2a'; g.fillRect(0, 0, w, h);
    if (this.mode === 'play' || this.mode === 'over' || this.mode === 'kicked') {
      const s = Math.min(w / this.W, h / this.H), ox = (w - this.W * s) / 2, oy = (h - this.H * s) / 2;
      this.view = { s, ox, oy };
      g.save(); g.translate(ox, oy); g.scale(s, s);
      g.fillStyle = '#1b263b'; g.fillRect(0, 0, this.W, this.H);
      g.strokeStyle = 'rgba(255,255,255,0.04)'; for (let x = 0; x < this.W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, this.H); g.stroke(); } for (let y = 0; y < this.H; y += 80) { g.beginPath(); g.moveTo(0, y); g.lineTo(this.W, y); g.stroke(); }
      g.fillStyle = '#415a77'; for (const [x, y, ww, hh] of this.walls) g.fillRect(x, y, ww, hh);
      for (const sh of this.shots) { g.fillStyle = sh.from === this.me ? '#ffd166' : '#ff6b6b'; g.fillRect(sh.x - 3, sh.y - 3, 6, 6); }
      for (const o of [...this.bots, this.me]) {
        if (o.hp <= 0) continue;
        g.fillStyle = o === this.me ? '#4cc9f0' : o.col; g.beginPath(); g.arc(o.x, o.y, 14, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(o.x - 18, o.y - 28, 36, 4); g.fillStyle = '#7CFC00'; g.fillRect(o.x - 18, o.y - 28, 36 * o.hp / 100, 4);
        font(g, 13, 600); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(o === this.me ? 'YOU' : o.name, o.x, o.y - 34); g.textAlign = 'left';
      }
      g.restore();
      // aim from cursor
      if (this.view) { this.aimX = (cur.x - ox) / s; this.aimY = (cur.y - oy) / s; }
      // HUD
      const ping = st.internet ? r.speed(true).ping : 999;
      font(g, 13, 700, MONO);
      g.fillStyle = ping > 80 ? '#ff6b6b' : ping > 40 ? '#ffd166' : '#7CFC00'; g.fillText(`PING ${ping > 900 ? '---' : ping} ms`, 12, 22);
      g.fillStyle = '#ddd'; g.fillText(`${this.fps || 0} FPS`, 12, 40);
      g.textAlign = 'center'; font(g, 18, 700, MONO); g.fillStyle = '#fff'; g.fillText(`${Math.floor(Math.max(0, this.timeLeft) / 60)}:${String(Math.floor(Math.max(0, this.timeLeft) % 60)).padStart(2, '0')}`, w / 2, 26);
      if (this.feedT > 0) { font(g, 13); g.fillStyle = '#fff'; g.fillText(this.feed, w / 2, 48); }
      g.textAlign = 'left';
      font(g, 14, 700); g.fillStyle = '#fff'; g.fillText(`K ${this.me.k}   D ${this.me.d}`, w - 120, 24);
      if (this.me.hp <= 0) { g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, w, h); font(g, 26, 700); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('Respawning…', w / 2, h / 2); g.textAlign = 'left'; }
      if (this.lost && this.mode === 'play') { fillRR(g, w / 2 - 170, h / 2 - 40, 340, 80, 8, 'rgba(0,0,0,0.8)'); font(g, 18, 700); g.fillStyle = '#ff6b6b'; g.textAlign = 'center'; g.fillText('Connection problem…', w / 2, h / 2 - 4); font(g, 13); g.fillStyle = '#ddd'; g.fillText('Trying to reconnect to the server', w / 2, h / 2 + 22); g.textAlign = 'left'; }
      if (this.mode !== 'play') {
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 0, w, h);
        font(g, 34, 800); g.textAlign = 'center'; g.fillStyle = this.mode === 'kicked' ? '#ff6b6b' : '#4cc9f0';
        g.fillText(this.mode === 'kicked' ? 'CONNECTION LOST' : 'MATCH OVER', w / 2, h / 2 - 50);
        font(g, 15); g.fillStyle = '#ddd'; g.fillText(this.mode === 'kicked' ? 'You were disconnected from the server. (Did someone unplug the router?)' : `You got ${this.me.k} kills.`, w / 2, h / 2 - 14);
        g.textAlign = 'left';
        this.kit.button(g, cur, w / 2 - 90, h / 2 + 20, 180, 42, 'Back to menu', () => { this.mode = 'menu'; }, { primary: true, accent: '#4cc9f0' });
      }
      return;
    }
    // menu
    font(g, 64, 800); g.fillStyle = '#4cc9f0'; g.textAlign = 'center'; g.fillText('SKIRMISH', w / 2, h * 0.3);
    font(g, 15); g.fillStyle = '#9fb3c8'; g.fillText('Online arena  ·  WASD move  ·  aim with the mouse  ·  hold click to shoot', w / 2, h * 0.3 + 34);
    g.fillStyle = st.internet ? '#7CFC00' : '#ff6b6b'; g.fillText(st.internet ? `Servers online  ·  ping ${r.speed(true).ping} ms` : 'Servers unreachable (no internet)', w / 2, h * 0.3 + 64);
    if (this.mode === 'connecting') { g.fillStyle = '#fff'; g.fillText('Connecting to EU-West-2…' + '.'.repeat(Math.floor(this.ct * 3) % 4), w / 2, h * 0.55); }
    if (this.msg) { g.fillStyle = '#ffb3b3'; g.fillText(this.msg, w / 2, h * 0.68); }
    g.textAlign = 'left';
    if (this.mode === 'menu') this.kit.button(g, cur, w / 2 - 120, h * 0.48, 240, 50, 'FIND MATCH', () => { this.msg = ''; this.connect(); }, { primary: true, accent: '#4cc9f0', size: 18 });
  }
  mouse(t, x, y, b) {
    if (this.mode === 'play' && b === 0) { if (t === 'down' || t === 'dbl') this.firing = true; else if (t === 'up') this.firing = false; return; }
    if (t === 'down') this.kit.click(x, y);
  }
  key(e) { this.keys.add(e.code); }
  keyUp(e) { this.keys.delete(e.code); }
  cursor() { return this.mode === 'play' ? 'cross' : 'arrow'; }
}
void text;
