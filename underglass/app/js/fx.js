// Particles + screen effects: fire, smoke, sparks, dust, embers, ice bits, debris, shock rings, flashes, shake, glass cracks.
import { canvas, rand, clamp, pick } from './util.js';

function glow(r, stops) { const c = canvas(r * 2, r * 2), x = c.getContext('2d'); const g = x.createRadialGradient(r, r, 0, r, r, r); stops.forEach(s => g.addColorStop(s[0], s[1])); x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2); return c; }
const SPR = {
  fire: glow(32, [[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,210,90,0.9)'], [0.55, 'rgba(255,110,20,0.45)'], [1, 'rgba(200,40,0,0)']]),
  fireRed: glow(32, [[0, 'rgba(255,160,60,0.9)'], [0.5, 'rgba(220,60,10,0.35)'], [1, 'rgba(120,10,0,0)']]),
  smoke: glow(32, [[0, 'rgba(70,66,62,0.55)'], [0.6, 'rgba(60,58,56,0.25)'], [1, 'rgba(50,50,50,0)']]),
  smokeLight: glow(32, [[0, 'rgba(200,200,200,0.5)'], [0.6, 'rgba(190,190,190,0.2)'], [1, 'rgba(180,180,180,0)']]),
  spark: glow(8, [[0, 'rgba(255,255,220,1)'], [0.4, 'rgba(255,200,80,0.8)'], [1, 'rgba(255,120,0,0)']]),
  blue: glow(16, [[0, 'rgba(240,250,255,1)'], [0.35, 'rgba(140,200,255,0.8)'], [1, 'rgba(60,120,255,0)']]),
  purple: glow(24, [[0, 'rgba(255,230,255,1)'], [0.35, 'rgba(190,90,255,0.8)'], [1, 'rgba(90,0,200,0)']]),
  green: glow(16, [[0, 'rgba(230,255,200,1)'], [0.4, 'rgba(120,255,60,0.75)'], [1, 'rgba(40,160,0,0)']]),
  red: glow(16, [[0, 'rgba(255,240,240,1)'], [0.3, 'rgba(255,40,40,0.9)'], [1, 'rgba(255,0,0,0)']]),
  white: glow(32, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]),
  dust: glow(32, [[0, 'rgba(160,150,135,0.45)'], [1, 'rgba(160,150,135,0)']]),
};
export class FX {
  constructor() { this.p = []; this.rings = []; this.bolts = []; this.flashA = 0; this.flashC = '255,255,255'; this.shakeT = 0; this.shakeA = 0; this.cracks = []; this.max = 2600; this.timeScale = 1; this.decals = []; }
  add(o) { if (this.p.length >= this.max) this.p.splice(0, 200); this.p.push(o); return o; }
  fire(x, y, s = 1, n = 1) {
    for (let i = 0; i < n; i++) this.add({ t: 'fire', x: x + rand(-6, 6) * s, y: y + rand(-4, 4) * s, vx: rand(-20, 20) * s, vy: rand(-90, -40) * s, life: rand(0.35, 0.8), age: 0, r: rand(10, 20) * s, add: true, spr: Math.random() < 0.3 ? SPR.fireRed : SPR.fire });
    if (Math.random() < 0.25 * n) this.add({ t: 'smoke', x, y: y - 20 * s, vx: rand(-15, 15), vy: rand(-60, -30) * s, life: rand(1.2, 2.4), age: 0, r: rand(14, 26) * s, grow: 1.8, spr: SPR.smoke });
    if (Math.random() < 0.12 * n) this.spark(x, y, 1, 120);
  }
  smoke(x, y, s = 1, n = 1, light = false) { for (let i = 0; i < n; i++) this.add({ t: 'smoke', x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-30, 30), vy: rand(-50, -15), life: rand(1.2, 2.8), age: 0, r: rand(14, 30) * s, grow: 2, spr: light ? SPR.smokeLight : SPR.smoke }); }
  spark(x, y, n = 8, sp = 400, spr = SPR.spark) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(0.3, 1) * sp; this.add({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.2, g: 900, life: rand(0.3, 0.9), age: 0, r: rand(2, 4), add: true, spr }); }
  }
  dust(x, y, n = 6, s = 1, color) {
    for (let i = 0; i < n; i++) this.add({ t: 'dust', x: x + rand(-10, 10) * s, y: y + rand(-6, 6) * s, vx: rand(-80, 80) * s, vy: rand(-50, 10) * s, life: rand(0.6, 1.4), age: 0, r: rand(10, 24) * s, grow: 1.5, spr: SPR.dust });
  }
  bits(x, y, n, color, sp = 300, size = 3) { // small solid debris (glass, paint, ash, ice)
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), v = rand(0.2, 1) * sp; this.add({ t: 'bit', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, g: 1400, life: rand(0.7, 1.8), age: 0, r: rand(1, size), c: Array.isArray(color) ? pick(color) : color, rot: rand(0, 6), vr: rand(-12, 12) }); }
  }
  ember(x, y) { this.add({ t: 'spark', x, y, vx: rand(-20, 20), vy: rand(-70, -20), g: -10, life: rand(0.8, 1.6), age: 0, r: rand(1.5, 2.5), add: true, spr: SPR.spark }); }
  glowAt(x, y, r, spr = 'white', life = 0.25) { this.add({ t: 'glow', x, y, vx: 0, vy: 0, life, age: 0, r, add: true, spr: SPR[spr], fixedR: true }); }
  ring(x, y, r, color = '255,255,255', life = 0.45, w = 6) { this.rings.push({ x, y, r, c: color, life, age: 0, w }); }
  bolt(x1, y1, x2, y2, color = '200,225,255', life = 0.25, w = 3) { // jagged lightning
    const pts = [[x1, y1]]; const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 28));
    for (let i = 1; i < n; i++) { const t = i / n; pts.push([x1 + (x2 - x1) * t + rand(-1, 1) * 24, y1 + (y2 - y1) * t + rand(-1, 1) * 24]); }
    pts.push([x2, y2]); this.bolts.push({ pts, c: color, life, age: 0, w });
  }
  flash(a = 0.6, c = '255,255,255') { this.flashA = Math.max(this.flashA, a); this.flashC = c; }
  shake(a, t = 0.4) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
  crack(x, y, size = 1) { // cracks on the "screen glass"
    const lines = []; const n = Math.round(rand(7, 12) * Math.min(1.6, size));
    for (let i = 0; i < n; i++) {
      let a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2), px = x, py = y; const seg = [[px, py]]; const L = rand(120, 420) * size;
      for (let d = 0; d < L;) { const st = rand(18, 50); a += rand(-0.35, 0.35); px += Math.cos(a) * st; py += Math.sin(a) * st; d += st; seg.push([px, py]); if (Math.random() < 0.15) lines.push(branch(px, py, a + rand(-1, 1), L * 0.3)); }
      lines.push(seg);
    }
    const rings = []; for (let k = 1; k <= 3; k++) { const rr = k * rand(26, 46) * size; const seg = []; for (let t = 0; t <= 12; t++) { const aa = t / 12 * Math.PI * 2; seg.push([x + Math.cos(aa) * rr * rand(0.85, 1.15), y + Math.sin(aa) * rr * rand(0.85, 1.15)]); } rings.push(seg); }
    this.cracks.push({ x, y, lines: lines.concat(rings) });
    if (this.cracks.length > 14) this.cracks.shift();
    function branch(bx, by, a, L) { const s = [[bx, by]]; for (let d = 0; d < L;) { const st = rand(14, 36); a += rand(-0.4, 0.4); bx += Math.cos(a) * st; by += Math.sin(a) * st; d += st; s.push([bx, by]); } return s; }
  }
  update(dt) {
    const ts = this.timeScale; const d = dt * ts;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i]; p.age += d; if (p.age >= p.life) { this.p[i] = this.p[this.p.length - 1]; this.p.pop(); continue; }
      if (p.g) p.vy += p.g * d;
      if (p.t === 'fire') { p.vx *= 0.97; p.vy -= 40 * d; }
      if (p.t === 'smoke' || p.t === 'dust') { p.vx *= 0.98; p.vy *= 0.985; }
      p.x += p.vx * d; p.y += p.vy * d; if (p.vr) p.rot += p.vr * d;
      if (p.t === 'bit' && p.floor !== undefined && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
    }
    for (const r of this.rings) r.age += d; this.rings = this.rings.filter(r => r.age < r.life);
    for (const b of this.bolts) b.age += dt; this.bolts = this.bolts.filter(b => b.age < b.life);
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
  }
  shakeOffset() { if (this.shakeA <= 0) return [0, 0]; const a = this.shakeA * Math.min(1, this.shakeT * 3); return [rand(-a, a), rand(-a, a)]; }
  draw(ctx, W, H) {
    // normal particles first, glowing ones after (added light)
    for (const p of this.p) {
      if (p.add) continue; const k = p.age / p.life;
      if (p.t === 'zz') { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff'; ctx.font = `600 ${10 + k * 8}px "UG Cond", sans-serif`; ctx.fillText('z', p.x, p.y); continue; }
      if (!p.spr) continue;
      if (p.t === 'bit') { ctx.fillStyle = p.c; ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2); ctx.restore(); continue; }
      const r = p.r * (1 + (p.grow || 0) * k); ctx.globalAlpha = (1 - k) * (k < 0.1 ? k * 10 : 1);
      ctx.drawImage(p.spr, p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
    for (const p of this.p) {
      if (!p.add) continue; const k = p.age / p.life;
      const r = p.fixedR ? p.r : p.r * (p.t === 'fire' ? (1 - k * 0.6) : 1); ctx.globalAlpha = p.t === 'glow' ? 1 - k : (1 - k);
      if (p.t === 'fire') { const fl = 0.85 + Math.sin(p.age * 40 + p.x) * 0.15; ctx.drawImage(p.spr, p.x - r * 0.6, p.y - r * 1.9 * fl, r * 1.2, r * 2.6 * fl); continue; }
      ctx.drawImage(p.spr, p.x - r, p.y - r, r * 2, r * 2);
    }
    for (const b of this.bolts) {
      const k = 1 - b.age / b.life; ctx.globalAlpha = k;
      for (const [w, a] of [[b.w * 5, 0.18], [b.w * 2, 0.5], [b.w * 0.8, 1]]) {
        ctx.strokeStyle = `rgba(${b.c},${a})`; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.beginPath();
        b.pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const k = r.age / r.life; ctx.strokeStyle = `rgba(${r.c},${(1 - k) * 0.8})`; ctx.lineWidth = r.w * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (0.2 + k * 0.8), 0, Math.PI * 2); ctx.stroke();
    }
  }
  drawCracks(ctx) {
    if (!this.cracks.length) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const c of this.cracks) {
      for (const [w, col] of [[3, 'rgba(0,0,0,0.25)'], [1.2, 'rgba(255,255,255,0.75)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
        for (const s of c.lines) { s.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); }
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 34); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, 7); ctx.fill();
    }
  }
  drawFlash(ctx, W, H) { if (this.flashA > 0) { ctx.fillStyle = `rgba(${this.flashC},${this.flashA})`; ctx.fillRect(0, 0, W, H); } }
}
export { SPR };
