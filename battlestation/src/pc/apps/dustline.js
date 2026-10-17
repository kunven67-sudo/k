import { Kit, clientCursor, font, fillRR, text, inside } from './kit.js';
import { MONO } from '../gfx.js';

// DUSTLINE: an old-school raycaster shooter that runs inside the in-game PC.
// How smooth it is depends on the graphics card IN THE IN-GAME PC (and its temperature):
// GT 1030 on Ultra = slideshow, swap in an RTX 4090 = buttery.
const MAP = [
  '111111111111111111111111',
  '100000000020000000000001',
  '103300000020000002220001',
  '103000000000000000020001',
  '100000330000004400020001',
  '100000330000004400000001',
  '122200000000000000000331',
  '100000000044400000000301',
  '100000000040000222000001',
  '103333000040000200000001',
  '100000000000000200044001',
  '100022200000000000044001',
  '100020000033300000000001',
  '100020000030000000000221',
  '100000000030000044400201',
  '144400000000000040000201',
  '100000022200000040000001',
  '100000000200000000003301',
  '100333000200044400003001',
  '100300000000040000000001',
  '100300000000040000222001',
  '100000003330000000200001',
  '100000000000000000000001',
  '111111111111111111111111',
];
const QUALITY = { Low: [320, 180, 4], Medium: [480, 270, 8], High: [640, 360, 16], Ultra: [960, 540, 32] };

function makeTex(kind) {
  const N = 64, a = new Uint32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r, g, b;
    const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const noise = Math.abs(n) * 30;
    if (kind === 1) { // concrete block
      const mortar = y % 16 < 1 || (x + (Math.floor(y / 16) % 2) * 16) % 32 < 1;
      r = g = b = mortar ? 70 : 128 + noise; g -= 4; b -= 10;
    } else if (kind === 2) { // rusty metal panel
      const rivet = (x % 32 === 4 || x % 32 === 27) && (y % 32 === 4 || y % 32 === 27);
      r = 120 + noise + (y % 32 < 2 ? -40 : 0); g = 70 + noise * 0.6; b = 40; if (rivet) { r = g = b = 200; }
    } else if (kind === 3) { // wood crates
      const plank = x % 21 < 1 || y < 2 || y > 61 || x < 2 || x > 61;
      r = plank ? 70 : 140 + noise; g = plank ? 45 : 95 + noise * 0.7; b = plank ? 25 : 50;
      if (Math.abs(x - y) < 2 || Math.abs(x + y - 63) < 2) { r -= 30; g -= 25; b -= 15; }
    } else { // tech wall with a glowing strip
      r = 40 + noise * 0.5; g = 46 + noise * 0.5; b = 58 + noise * 0.5;
      if (y > 28 && y < 34) { r = 40; g = 220; b = 255; }
      if (x % 16 === 0) { r -= 15; g -= 15; b -= 15; }
    }
    a[y * N + x] = (255 << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r);
  }
  return a;
}
const clamp = (v) => Math.max(0, Math.min(255, v | 0));

export class Dustline {
  static title = 'DUSTLINE'; static icon = 'game'; static w = 1024; static h = 640; static exe = 'Dustline.exe';
  constructor(os, win) {
    this.os = os; this.win = win; this.kit = new Kit();
    win.img = makeIcon('DL', '#b5651d');
    this.mode = 'menu';
    this.quality = 'High';
    this.textures = [null, makeTex(1), makeTex(2), makeTex(3), makeTex(4)];
    this.acc = 0; this.frames = 0; this.fpsShown = 0; this.fpsT = 0;
    this.keys = new Set();
    this.setup();
    this.mem = 900;
  }
  setup() {
    const [w, h] = QUALITY[this.quality];
    this.c = document.createElement('canvas'); this.c.width = w; this.c.height = h;
    this.cx = this.c.getContext('2d');
    this.img = this.cx.createImageData(w, h);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.zbuf = new Float32Array(w);
  }
  reset() {
    this.p = { x: 2.5, y: 2.5, a: 0.3, hp: 100, ammo: 12, mag: 12, reserve: 60, kills: 0 };
    this.enemies = [];
    for (let k = 0; k < 9; k++) {
      let x, y;
      do { x = 3 + Math.random() * 19; y = 3 + Math.random() * 19; } while (MAP[y | 0][x | 0] !== '0' || Math.hypot(x - 2.5, y - 2.5) < 6);
      this.enemies.push({ x, y, hp: 3, cd: 1 + Math.random() * 2, hit: 0, dead: 0 });
    }
    this.shot = 0; this.hurt = 0; this.recoil = 0;
  }
  start() { this.reset(); this.mode = 'play'; this.os.capture = this.win; }
  // simulated frame rate from the in-game parts
  simFps() { return this.os.hw.fps(QUALITY[this.quality][2]); }
  update(dt) {
    if (this.mode !== 'play') { this.cpuLoad = 0.02; this.gpuLoad = 0.03; return this.os.focus === this.win; }
    const fps = this.simFps();
    this.cpuLoad = 0.25; this.gpuLoad = Math.min(1, 0.4 + QUALITY[this.quality][2] / Math.max(1, this.os.hw.parts.gpu.score) * 0.6);
    this.acc += dt;
    if (this.acc < 1 / fps) return false;
    const fdt = Math.min(0.25, this.acc);
    this.acc = 0;
    this.step(fdt);
    this.render();
    this.frames++; this.fpsT += fdt;
    if (this.fpsT > 0.5) { this.fpsShown = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    return true;
  }
  look(dx) { if (this.mode === 'play') this.p.a += dx * 0.0035; }
  step(dt) {
    const p = this.p, k = this.keys;
    const sp = (k.has('ShiftLeft') ? 4.2 : 2.8) * dt;
    let mx = 0, my = 0;
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    if (k.has('KeyW')) { mx += ca; my += sa; }
    if (k.has('KeyS')) { mx -= ca; my -= sa; }
    if (k.has('KeyA')) { mx += sa; my -= ca; }
    if (k.has('KeyD')) { mx -= sa; my += ca; }
    const l = Math.hypot(mx, my) || 1;
    mx = mx / l * sp; my = my / l * sp;
    const free = (x, y) => MAP[y | 0]?.[x | 0] === '0';
    if (free(p.x + mx * 1.5, p.y)) p.x += mx;
    if (free(p.x, p.y + my * 1.5)) p.y += my;
    this.shot = Math.max(0, this.shot - dt * 8); this.hurt = Math.max(0, this.hurt - dt * 2); this.recoil *= Math.pow(0.001, dt);
    if (this.reload > 0) { this.reload -= dt; if (this.reload <= 0) { const n = Math.min(p.mag - p.ammo, p.reserve); p.ammo += n; p.reserve -= n; } }
    for (const e of this.enemies) {
      if (e.hp <= 0) { e.dead += dt; continue; }
      e.hit = Math.max(0, e.hit - dt * 4);
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
      const sees = this.los(e.x, e.y, p.x, p.y);
      if (sees && d > 1.6) { const ex = e.x + dx / d * dt * 1.4, ey = e.y + dy / d * dt * 1.4; if (free(ex, e.y)) e.x = ex; if (free(e.x, ey)) e.y = ey; }
      e.cd -= dt;
      if (sees && d < 9 && e.cd <= 0) { e.cd = 1.2 + Math.random() * 1.6; if (Math.random() < 0.55) { p.hp -= 6 + Math.random() * 6; this.hurt = 1; this.os.g.audio?.beep(160, 0.08, { vol: 0.04, type: 'sawtooth' }); } }
    }
    if (p.hp <= 0) { this.mode = 'dead'; this.os.capture = null; }
    if (this.enemies.every(e => e.hp <= 0)) { this.mode = 'win'; this.os.capture = null; }
  }
  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 4);
    for (let i = 1; i < n; i++) { const t = i / n; if (MAP[(y0 + (y1 - y0) * t) | 0][(x0 + (x1 - x0) * t) | 0] !== '0') return false; }
    return true;
  }
  fire() {
    const p = this.p;
    if (this.reload > 0) return;
    if (p.ammo <= 0) { this.os.g.audio?.beep(900, 0.03, { vol: 0.03 }); return; }
    p.ammo--; this.shot = 1; this.recoil = 0.06;
    this.os.g.audio?.play('gun.ogg', { vol: 0.35, rate: 0.9 + Math.random() * 0.2 });
    // hitscan toward the crosshair
    let best = null;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      let ang = Math.atan2(dy, dx) - p.a;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(ang) < 0.22 / d + 0.02 && this.los(p.x, p.y, e.x, e.y) && (!best || d < best.d)) best = { e, d };
    }
    if (best) { best.e.hp--; best.e.hit = 1; if (best.e.hp <= 0) p.kills++; }
  }
  render() {
    const W = this.c.width, H = this.c.height, buf = this.buf, p = this.p;
    const fov = 0.66;
    const dirX = Math.cos(p.a), dirY = Math.sin(p.a);
    const plX = -dirY * fov, plY = dirX * fov;
    const ultra = this.quality === 'Ultra' || this.quality === 'High';
    const horizon = (H / 2 + this.recoil * H) | 0;
    // ceiling + floor (High/Ultra: per-pixel floor casting, the expensive part)
    for (let y = 0; y < H; y++) {
      const isFloor = y > horizon;
      const rowD = Math.abs(H / 2 / (y - horizon + 0.0001));
      const shadeK = Math.min(1, 1.6 / rowD);
      if (ultra && isFloor) {
        const fx0 = p.x + rowD * (dirX - plX), fy0 = p.y + rowD * (dirY - plY);
        const stepX = rowD * 2 * plX / W, stepY = rowD * 2 * plY / W;
        let fx = fx0, fy = fy0;
        for (let x = 0; x < W; x++) {
          const tx = (fx * 64) & 63, ty = (fy * 64) & 63;
          const c = ((tx ^ ty) & 16) ? 70 : 58;
          const v = (c * shadeK) | 0;
          buf[y * W + x] = (255 << 24) | ((v * 0.9) << 16) | ((v * 0.95) << 8) | v;
          fx += stepX; fy += stepY;
        }
      } else {
        const v = isFloor ? (55 * shadeK) | 0 : (22 + 30 * Math.max(0, 1 - y / horizon)) | 0;
        const col = isFloor ? (255 << 24) | ((v * 0.85) << 16) | ((v * 0.9) << 8) | v : (255 << 24) | ((v * 1.3) << 16) | ((v * 1.1) << 8) | v;
        buf.fill(col, y * W, y * W + W);
      }
    }
    // walls
    for (let x = 0; x < W; x++) {
      const cam = 2 * x / W - 1;
      const rdx = dirX + plX * cam, rdy = dirY + plY * cam;
      let mx = p.x | 0, my = p.y | 0;
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let sx, sy, sdx, sdy, side = 0;
      if (rdx < 0) { sx = -1; sdx = (p.x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - p.x) * ddx; }
      if (rdy < 0) { sy = -1; sdy = (p.y - my) * ddy; } else { sy = 1; sdy = (my + 1 - p.y) * ddy; }
      let hit = 0, guard = 0;
      while (!hit && guard++ < 64) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        hit = +(MAP[my]?.[mx] || 1);
      }
      const dist = side === 0 ? sdx - ddx : sdy - ddy;
      this.zbuf[x] = dist;
      const lh = (H / dist) | 0;
      const y0 = Math.max(0, horizon - lh / 2) | 0, y1 = Math.min(H - 1, horizon + lh / 2) | 0;
      let wx = side === 0 ? p.y + dist * rdy : p.x + dist * rdx;
      wx -= Math.floor(wx);
      const tx = (wx * 64) | 0;
      const tex = this.textures[hit] || this.textures[1];
      const shade = Math.min(1, 2.2 / dist) * (side ? 0.78 : 1);
      for (let y = y0; y <= y1; y++) {
        const ty = (((y - horizon + lh / 2) / lh) * 64) & 63;
        const c = tex[ty * 64 + tx];
        const r = (c & 255) * shade, gg = ((c >> 8) & 255) * shade, b = ((c >> 16) & 255) * shade;
        buf[y * W + x] = (255 << 24) | (b << 16) | (gg << 8) | r;
      }
    }
    this.cx.putImageData(this.img, 0, 0);
    // enemies (billboards, far to near)
    const g = this.cx;
    const sorted = this.enemies.map(e => ({ e, d: Math.hypot(e.x - p.x, e.y - p.y) })).sort((a, b) => b.d - a.d);
    for (const { e, d } of sorted) {
      if (e.dead > 1.2) continue;
      const rx = e.x - p.x, ry = e.y - p.y;
      const inv = 1 / (plX * dirY - dirX * plY);
      const tX = inv * (dirY * rx - dirX * ry), tY = inv * (-plY * rx + plX * ry);
      if (tY <= 0.1) continue;
      const sxp = (W / 2) * (1 + tX / tY);
      const sh = Math.abs(H / tY);
      const col = Math.round(sxp);
      if (col < 0 || col >= W || this.zbuf[col] < tY) continue;
      const shade = Math.min(1, 2.5 / d);
      const dying = e.hp <= 0;
      g.save();
      g.translate(sxp, horizon + sh * 0.5);
      if (dying) g.rotate(Math.min(1.5, e.dead * 3));
      const s = sh / 100;
      g.fillStyle = e.hit > 0 ? `rgba(255,255,255,${shade})` : `rgb(${120 * shade | 0},${30 * shade | 0},${30 * shade | 0})`;
      g.fillRect(-14 * s, -88 * s, 28 * s, 52 * s);
      g.fillStyle = `rgb(${200 * shade | 0},${160 * shade | 0},${130 * shade | 0})`; g.beginPath(); g.arc(0, -98 * s, 11 * s, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgb(${40 * shade | 0},${40 * shade | 0},${50 * shade | 0})`; g.fillRect(-12 * s, -36 * s, 10 * s, 36 * s); g.fillRect(2 * s, -36 * s, 10 * s, 36 * s);
      g.fillStyle = '#222'; g.fillRect(10 * s, -70 * s, 22 * s, 6 * s);
      g.restore();
    }
    // weapon
    const bob = Math.sin(performance.now() / 160) * 3 * (this.keys.size ? 1 : 0.2);
    const gw = W * 0.22;
    g.save(); g.translate(W * 0.62, H - gw * 0.55 + bob + this.recoil * H * 0.8);
    g.fillStyle = '#2a2a2e'; g.fillRect(0, 0, gw, gw * 0.3); g.fillStyle = '#3a3a40'; g.fillRect(gw * 0.1, -gw * 0.08, gw * 0.75, gw * 0.12);
    g.fillStyle = '#1b1b1f'; g.fillRect(gw * 0.55, gw * 0.25, gw * 0.18, gw * 0.4);
    if (this.shot > 0.5) { g.fillStyle = `rgba(255,220,120,${this.shot})`; g.beginPath(); g.arc(gw * 0.05, gw * -0.02, gw * 0.12 * this.shot, 0, Math.PI * 2); g.fill(); }
    g.restore();
    if (this.hurt > 0) { g.fillStyle = `rgba(200,0,0,${this.hurt * 0.35})`; g.fillRect(0, 0, W, H); }
  }
  draw(g, w, h) {
    this.kit.begin();
    const cur = clientCursor(this.os, this.win);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    if (this.mode === 'play' || this.mode === 'dead' || this.mode === 'win') {
      g.imageSmoothingEnabled = this.quality !== 'Low';
      g.drawImage(this.c, 0, 0, w, h);
      g.imageSmoothingEnabled = true;
      // HUD
      g.fillStyle = '#fff'; g.fillRect(w / 2 - 1, h / 2 - 9, 2, 6); g.fillRect(w / 2 - 1, h / 2 + 3, 2, 6); g.fillRect(w / 2 - 9, h / 2 - 1, 6, 2); g.fillRect(w / 2 + 3, h / 2 - 1, 6, 2);
      font(g, 28, 700, MONO); g.fillStyle = this.p.hp < 30 ? '#ff5555' : '#fff'; g.fillText(`${Math.max(0, Math.ceil(this.p.hp))}`, 24, h - 24);
      g.textAlign = 'right'; g.fillStyle = '#fff'; g.fillText(this.reload > 0 ? 'RELOAD' : `${this.p.ammo} / ${this.p.reserve}`, w - 24, h - 24); g.textAlign = 'left';
      font(g, 14, 700, MONO); g.fillStyle = '#ffeb3b'; g.fillText(`${this.fpsShown} FPS`, 12, 22);
      g.fillStyle = '#ccc'; font(g, 12, 400, MONO); g.fillText(`${this.os.hw.parts.gpu.name}  ·  ${this.quality}  ·  ${Math.round(this.os.hw.temps.gpu)}°C`, 12, 40);
      g.fillText(`Targets left: ${this.enemies.filter(e => e.hp > 0).length}`, 12, 58);
      if (this.mode !== 'play') {
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, w, h);
        font(g, 44, 700); g.fillStyle = this.mode === 'win' ? '#7CFC00' : '#ff5555'; g.textAlign = 'center';
        g.fillText(this.mode === 'win' ? 'AREA CLEAR' : 'YOU DIED', w / 2, h / 2 - 20);
        g.textAlign = 'left';
        this.kit.button(g, cur, w / 2 - 80, h / 2 + 10, 160, 40, 'Play again', () => this.start(), { primary: true, accent: '#ff9f43' });
        this.kit.button(g, cur, w / 2 - 80, h / 2 + 60, 160, 36, 'Menu', () => { this.mode = 'menu'; });
      } else if (this.os.capture !== this.win) {
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, w, h);
        font(g, 20, 600); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('Paused - click to keep playing', w / 2, h / 2); g.textAlign = 'left';
      }
      return;
    }
    // menu
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b1a0e'); gr.addColorStop(1, '#0d0806'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    font(g, 72, 800); g.fillStyle = '#ff9f43'; g.textAlign = 'center'; g.fillText('DUSTLINE', w / 2, h * 0.28);
    font(g, 15); g.fillStyle = '#d7c3b0'; g.fillText('WASD move  ·  mouse aim  ·  click shoot  ·  R reload  ·  Shift run  ·  Esc pause', w / 2, h * 0.28 + 36);
    g.textAlign = 'left';
    this.kit.button(g, cur, w / 2 - 110, h * 0.42, 220, 48, 'PLAY', () => this.start(), { primary: true, accent: '#ff9f43', size: 18 });
    font(g, 13, 600); g.fillStyle = '#d7c3b0'; g.textAlign = 'center'; g.fillText('GRAPHICS', w / 2, h * 0.42 + 84); g.textAlign = 'left';
    Object.keys(QUALITY).forEach((q, k) => {
      const x = w / 2 - 200 + k * 100;
      this.kit.button(g, cur, x, h * 0.42 + 96, 92, 34, q, () => { this.quality = q; this.setup(); }, this.quality === q ? { bg: '#ff9f43', color: '#000' } : {});
    });
    const est = Math.round(this.simFps());
    font(g, 13); g.fillStyle = est < 30 ? '#ff7b7b' : est < 55 ? '#ffd166' : '#7CFC00'; g.textAlign = 'center';
    g.fillText(`Expected on your ${this.os.hw.parts.gpu.name}: about ${est} FPS`, w / 2, h * 0.42 + 160);
    if (this.os.hw.parts.gpu.yours) { g.fillStyle = '#a58f7c'; g.fillText('Lagging? Swap a better graphics card into the in-game PC (turn it off first!).', w / 2, h * 0.42 + 184); }
    g.textAlign = 'left';
  }
  mouse(t, x, y, b) {
    if (t !== 'down' && t !== 'dbl') return;
    if (this.mode === 'play') { if (this.os.capture !== this.win) this.os.capture = this.win; else if (b === 0) this.fire(); return; }
    this.kit.click(x, y);
  }
  captureClick(b, down) { if (down && b === 0) this.fire(); }
  key(e) {
    this.keys.add(e.code);
    if (e.code === 'KeyR' && this.mode === 'play' && this.p.ammo < this.p.mag && this.p.reserve > 0) { this.reload = 1.4; this.os.g.audio?.play('reload.ogg', { vol: 0.3 }); }
    if (e.code === 'Escape') this.os.capture = null;
  }
  keyUp(e) { this.keys.delete(e.code); }
  close() { if (this.os.capture === this.win) this.os.capture = null; }
}

export function makeIcon(t, col) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  fillRR(g, 2, 2, 60, 60, 12, col);
  g.fillStyle = '#fff'; g.font = '800 26px Arial'; g.textAlign = 'center'; g.fillText(t, 32, 42);
  return c;
}
void text; void inside;
