// Cursor trails, click effects and idle effects drawn on a transparent canvas.
// Used by the full-screen overlay and by the preview box in the app.
import { TAU, hsl, starPath, heartPath, sparklePath, boltPoints, strokePts, rng } from './draw-helpers.mjs';

export const TRAILS = [
  { id: 'sparkles', name: 'Sparkles', emoji: '✨' },
  { id: 'fire', name: 'Fire', emoji: '🔥' },
  { id: 'rainbow', name: 'Rainbow Ribbon', emoji: '🌈' },
  { id: 'stars', name: 'Stars', emoji: '⭐' },
  { id: 'bubbles', name: 'Bubbles', emoji: '🫧' },
  { id: 'snow', name: 'Snow', emoji: '❄️' },
  { id: 'hearts', name: 'Hearts', emoji: '💖' },
  { id: 'pixels', name: 'Pixels', emoji: '👾' },
  { id: 'smoke', name: 'Smoke', emoji: '💨' },
  { id: 'electric', name: 'Electric', emoji: '⚡' },
  { id: 'comet', name: 'Comet', emoji: '☄️' },
  { id: 'ghost', name: 'Ghost Echo', emoji: '👻' },
  { id: 'confetti', name: 'Confetti', emoji: '🎊' },
  { id: 'leaves', name: 'Leaves', emoji: '🍃' },
  { id: 'neon', name: 'Neon Line', emoji: '〰️' },
  { id: 'emoji', name: 'Emoji Trail', emoji: '😎' },
];

export const CLICKS = [
  { id: 'ripple', name: 'Ripple', emoji: '💧' },
  { id: 'burst', name: 'Burst', emoji: '💥' },
  { id: 'hearts', name: 'Hearts', emoji: '💕' },
  { id: 'confetti', name: 'Confetti', emoji: '🎉' },
  { id: 'shockwave', name: 'Shockwave', emoji: '🌀' },
  { id: 'stars', name: 'Stars', emoji: '🌟' },
  { id: 'pixels', name: 'Pixel Pop', emoji: '🟪' },
  { id: 'pow', name: 'Comic POW!', emoji: '🗯️' },
  { id: 'lightning', name: 'Lightning', emoji: '🌩️' },
  { id: 'firework', name: 'Firework', emoji: '🎆' },
  { id: 'emoji', name: 'Emoji Burst', emoji: '🤩' },
  { id: 'ring', name: 'Neon Ring', emoji: '⭕' },
];

export const IDLES = [
  { id: 'zzz', name: 'Sleepy zZz', emoji: '💤' },
  { id: 'orbit', name: 'Orbiting Stars', emoji: '🪐' },
  { id: 'pulse', name: 'Pulse Ring', emoji: '📡' },
  { id: 'hearts', name: 'Floating Hearts', emoji: '💗' },
  { id: 'halo', name: 'Angel Halo', emoji: '😇' },
  { id: 'glow', name: 'Breathing Glow', emoji: '🌟' },
  { id: 'bounce', name: 'Bouncing Arrow', emoji: '⬇️' },
  { id: 'dots', name: 'Thinking...', emoji: '💭' },
];

export const EMOJI_CHOICES = ['⭐', '💖', '🔥', '🍕', '😎', '👾', '🌸', '💎', '🦆', '🐱', '⚡', '🍩', '🎮', '💀', '🌈', '🍀'];
const POW_WORDS = ['POW!', 'BAM!', 'ZAP!', 'BOOM!', 'WHAM!', 'CLICK!', 'KAPOW!', 'BONK!'];
const CONFETTI_COLORS = ['#ff4d6d', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f1c'];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class FxEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.parts = [];
    this.ribbon = [];
    this.cfg = { trail: { enabled: false }, click: { enabled: false }, idle: { enabled: false } };
    this.pos = null;
    this.lastMove = 0;
    this.time = 0;
    this.dpr = 1;
    this.rand = Math.random;
    this.acc = 0;
  }

  resize(w, h, dpr = 1) {
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.w = w; this.h = h;
  }

  setConfig(cfg) {
    if (cfg) this.cfg = cfg;
    this.maxParts = cfg?.lowPower ? 250 : 700;
  }

  color(c, offset = 0) {
    return c.rainbow ? hsl(this.time * 120 + offset, 100, 62) : c.color;
  }

  // ------------------------------------------------ input
  move(x, y) {
    const now = this.time;
    const prev = this.pos;
    this.pos = { x, y };
    this.lastMove = now;
    const tr = this.cfg.trail;
    if (!tr?.enabled || !prev) return;
    const dist = Math.hypot(x - prev.x, y - prev.y);
    if (dist < 0.5) return;
    if (['rainbow', 'comet', 'neon', 'electric'].includes(tr.type)) {
      this.ribbon.push({ x, y, t: now });
      return;
    }
    const amount = clamp(Number(tr.amount) || 1, 0.2, 3);
    this.acc += (dist / 9) * amount;
    const n = Math.min(12, Math.floor(this.acc));
    this.acc -= n;
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / n;
      this.spawnTrail(tr, prev.x + (x - prev.x) * f, prev.y + (y - prev.y) * f, (x - prev.x) / Math.max(1, dist), (y - prev.y) / Math.max(1, dist));
    }
  }

  spawnTrail(tr, x, y, dx, dy) {
    const r = this.rand;
    const size = clamp(Number(tr.size) || 1, 0.3, 3);
    const life = 0.5 + 0.6 * clamp(Number(tr.length) || 1, 0.2, 3);
    const base = { x, y, vx: (r() - 0.5) * 30, vy: (r() - 0.5) * 30, age: 0, life, size, color: this.color(tr, r() * 60), rot: r() * TAU, vr: (r() - 0.5) * 6, kind: tr.type };
    switch (tr.type) {
      case 'fire': Object.assign(base, { vy: -40 - r() * 50, vx: (r() - 0.5) * 20, life: life * 0.7, size: size * (5 + r() * 5) }); break;
      case 'bubbles': Object.assign(base, { vy: -20 - r() * 30, size: size * (3 + r() * 5), life: life * 1.3 }); break;
      case 'snow': Object.assign(base, { vy: 30 + r() * 30, vx: (r() - 0.5) * 20, size: size * (2 + r() * 3), life: life * 1.4, color: tr.rainbow ? base.color : '#ffffff' }); break;
      case 'hearts': Object.assign(base, { vy: -30 - r() * 20, size: size * (6 + r() * 5) }); break;
      case 'pixels': Object.assign(base, { size: size * (3 + Math.floor(r() * 3)) }); break;
      case 'smoke': Object.assign(base, { vy: -15 - r() * 15, size: size * (6 + r() * 6), life: life * 1.5, color: tr.rainbow ? base.color : tr.color }); break;
      case 'ghost': Object.assign(base, { vx: 0, vy: 0, size: size * 9, life: life * 0.6 }); break;
      case 'confetti': Object.assign(base, { vy: 20 + r() * 40, vx: (r() - 0.5) * 60, size: size * 4, color: CONFETTI_COLORS[Math.floor(r() * 6)] }); break;
      case 'leaves': Object.assign(base, { vy: 25 + r() * 25, vx: (r() - 0.5) * 50, size: size * 6, color: tr.rainbow ? base.color : ['#58b947', '#8bc34a', '#f4a259', '#d65f3c'][Math.floor(r() * 4)] }); break;
      case 'emoji': Object.assign(base, { vy: -10 - r() * 20, size: size * 16, text: tr.emoji || '⭐' }); break;
      case 'stars': Object.assign(base, { size: size * (4 + r() * 4) }); break;
      default: Object.assign(base, { size: size * (2.5 + r() * 3.5) }); break;
    }
    void dx; void dy;
    this.add(base);
  }

  add(p) {
    if (this.parts.length >= this.maxParts) this.parts.shift();
    this.parts.push(p);
  }

  click(x, y) {
    const c = this.cfg.click;
    if (!c?.enabled) return;
    const r = this.rand;
    const size = clamp(Number(c.size) || 1, 0.3, 3);
    const col = () => this.color(c, r() * 90);
    const burst = (n, speed, extra) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r() * 0.3;
        const sp = speed * (0.6 + r() * 0.6) * size;
        this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: 0.6 + r() * 0.4, size: size * (2 + r() * 3), color: col(), rot: r() * TAU, vr: (r() - 0.5) * 10, ...extra(i) });
      }
    };
    switch (c.type) {
      case 'ripple':
        for (let i = 0; i < 3; i++) this.add({ x, y, age: -i * 0.12, life: 0.7, size, color: col(), kind: 'ring', maxR: 40 * size, width: 3 });
        break;
      case 'shockwave':
        this.add({ x, y, age: 0, life: 0.5, size, color: col(), kind: 'ring', maxR: 90 * size, width: 8, fill: true });
        break;
      case 'ring':
        this.add({ x, y, age: 0, life: 0.6, size, color: col(), kind: 'ring', maxR: 28 * size, width: 4, glow: true });
        break;
      case 'burst': burst(18, 220, () => ({ kind: 'dot', drag: 3 })); break;
      case 'hearts': burst(10, 150, () => ({ kind: 'heart', size: size * (7 + r() * 5), drag: 2.5, gravity: -40 })); break;
      case 'confetti': burst(28, 260, () => ({ kind: 'confetti', color: CONFETTI_COLORS[Math.floor(r() * 6)], size: size * 4, drag: 2, gravity: 220 })); break;
      case 'stars': burst(10, 190, () => ({ kind: 'star', size: size * (6 + r() * 4), drag: 2.5 })); break;
      case 'pixels': burst(16, 200, () => ({ kind: 'pixel', size: size * (3 + Math.floor(r() * 3)), drag: 3, gravity: 120 })); break;
      case 'emoji': burst(8, 170, () => ({ kind: 'emoji', text: c.emoji || '💥', size: size * 20, drag: 2.5, gravity: 60 })); break;
      case 'pow':
        this.add({ x, y, age: 0, life: 0.7, size, color: col(), kind: 'pow', text: POW_WORDS[Math.floor(r() * POW_WORDS.length)], rot: (r() - 0.5) * 0.5 });
        break;
      case 'lightning':
        for (let i = 0; i < 4; i++) {
          const a = r() * TAU;
          const len = (40 + r() * 50) * size;
          this.add({ x, y, x2: x + Math.cos(a) * len, y2: y + Math.sin(a) * len, age: 0, life: 0.25, size, color: col(), kind: 'bolt', seed: Math.floor(r() * 1e6) });
        }
        break;
      case 'firework':
        this.add({ x, y, age: 0, life: 0.18, size, color: col(), kind: 'ring', maxR: 10 * size, width: 3 });
        burst(32, 260, (i) => ({ kind: 'spark', drag: 1.8, gravity: 90, color: this.color({ ...c, rainbow: true }, i * 11), life: 0.9 + r() * 0.5 }));
        break;
      default:
        burst(12, 180, () => ({ kind: 'dot', drag: 3 }));
    }
  }

  // ------------------------------------------------ frame
  frame(dt) {
    this.time += dt;
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    let drew = false;

    // ribbons
    const tr = this.cfg.trail;
    const keep = 0.25 + 0.3 * clamp(Number(tr?.length) || 1, 0.2, 3);
    while (this.ribbon.length && this.time - this.ribbon[0].t > keep) this.ribbon.shift();
    if (this.ribbon.length > 1 && tr?.enabled) { this.drawRibbon(tr, keep); drew = true; }

    // particles
    const alive = [];
    for (const p of this.parts) {
      p.age += dt;
      if (p.age > p.life) continue;
      alive.push(p);
      if (p.age < 0) continue;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.vx) p.x += p.vx * dt;
      if (p.vy) p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      this.drawPart(p);
      drew = true;
    }
    this.parts = alive;

    // idle
    const idle = this.cfg.idle;
    if (idle?.enabled && this.pos) {
      const still = this.time - this.lastMove;
      const delay = clamp(Number(idle.delay) || 3, 0.5, 60);
      if (still > delay) { this.drawIdle(idle, still - delay); drew = true; }
    }
    return drew || this.ribbon.length > 0;
  }

  drawRibbon(tr, keep) {
    const { ctx } = this;
    const pts = this.ribbon;
    const size = clamp(Number(tr.size) || 1, 0.3, 3);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const f = 1 - (this.time - b.t) / keep;
      if (f <= 0) continue;
      let color = tr.rainbow || tr.type === 'rainbow' ? hsl(i * 8 + this.time * 200, 100, 60, f) : tr.color;
      ctx.globalAlpha = tr.type === 'rainbow' ? 1 : f;
      if (tr.type === 'comet') {
        ctx.shadowColor = tr.rainbow ? color : tr.color;
        ctx.shadowBlur = 12;
        ctx.lineWidth = size * 9 * f;
      } else if (tr.type === 'neon') {
        ctx.shadowColor = tr.rainbow ? color : tr.color;
        ctx.shadowBlur = 10;
        ctx.lineWidth = size * 3;
      } else if (tr.type === 'electric') {
        ctx.shadowColor = tr.rainbow ? color : tr.color;
        ctx.shadowBlur = 8;
        ctx.lineWidth = size * 1.6;
        const r = rng(Math.floor(this.time * 30) + i * 13);
        ctx.strokeStyle = color;
        strokePts(ctx, boltPoints(a.x, a.y, b.x, b.y, 3, 5 * size, r));
        continue;
      } else {
        ctx.lineWidth = size * 7 * f;
      }
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPart(p) {
    const { ctx } = this;
    const f = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = clamp(f, 0, 1);
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    ctx.translate(p.x, p.y);
    switch (p.kind) {
      case 'sparkles':
      case 'spark':
        ctx.shadowColor = p.color; ctx.shadowBlur = 8;
        sparklePath(ctx, 0, 0, p.size * (0.5 + f * 0.8), p.rot);
        ctx.fill();
        break;
      case 'fire': {
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
        g.addColorStop(0, `rgba(255,240,150,${f})`);
        g.addColorStop(0.4, `rgba(255,140,0,${f * 0.8})`);
        g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (0.6 + f * 0.6), 0, TAU); ctx.fill();
        break;
      }
      case 'stars':
      case 'star':
        ctx.rotate(p.rot);
        ctx.shadowColor = p.color; ctx.shadowBlur = 6;
        starPath(ctx, 0, 0, 5, p.size, p.size * 0.45);
        ctx.fill();
        break;
      case 'bubbles':
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.stroke();
        ctx.globalAlpha *= 0.7;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-p.size * 0.35, -p.size * 0.35, p.size * 0.22, 0, TAU); ctx.fill();
        break;
      case 'snow':
        ctx.shadowColor = '#bfe9ff'; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
        break;
      case 'hearts':
      case 'heart':
        ctx.rotate(p.rot * 0.2);
        heartPath(ctx, 0, 0, p.size * 2);
        ctx.fill();
        break;
      case 'pixels':
      case 'pixel':
        ctx.fillRect(Math.round(-p.size / 2), Math.round(-p.size / 2), p.size, p.size);
        break;
      case 'smoke':
        ctx.globalAlpha = f * 0.35;
        ctx.beginPath(); ctx.arc(0, 0, p.size * (1.8 - f), 0, TAU); ctx.fill();
        break;
      case 'ghost':
        ctx.globalAlpha = f * 0.45;
        ctx.shadowColor = p.color; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, p.size * f, 0, TAU); ctx.fill();
        break;
      case 'confetti':
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2 * Math.abs(Math.cos(p.rot * 2)) + 1);
        break;
      case 'leaves':
        ctx.rotate(p.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, TAU); ctx.fill();
        break;
      case 'emoji':
        ctx.font = `${p.size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.rotate(p.rot * 0.3);
        ctx.fillText(p.text, 0, 0);
        break;
      case 'ring': {
        const k = clamp(p.age / p.life, 0, 1);
        const rad = 4 + p.maxR * (1 - (1 - k) ** 3);
        if (p.glow) { ctx.shadowColor = p.color; ctx.shadowBlur = 14; }
        ctx.lineWidth = p.width * (1 - k * 0.7);
        ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.stroke();
        if (p.fill) { ctx.globalAlpha = (1 - k) * 0.18; ctx.fill(); }
        break;
      }
      case 'pow': {
        const k = p.age / p.life;
        const s = (k < 0.15 ? k / 0.15 : 1) * 1.1 * p.size;
        ctx.rotate(p.rot);
        ctx.scale(s, s);
        starPath(ctx, 0, 0, 12, 46, 30, 0);
        ctx.fillStyle = '#ffe14d';
        ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#1a1a1a'; ctx.stroke();
        ctx.font = 'bold 22px "Comic Sans MS","Impact",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 4; ctx.strokeStyle = '#1a1a1a';
        ctx.strokeText(p.text, 0, 1);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 1);
        break;
      }
      case 'bolt': {
        const r = rng(p.seed + Math.floor(p.age * 40));
        ctx.translate(-p.x, -p.y);
        ctx.shadowColor = p.color; ctx.shadowBlur = 12;
        ctx.lineWidth = 2.2 * p.size;
        strokePts(ctx, boltPoints(p.x, p.y, p.x2, p.y2, 6, 9 * p.size, r));
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.9;
        strokePts(ctx, boltPoints(p.x, p.y, p.x2, p.y2, 6, 4 * p.size, r));
        break;
      }
      default:
        ctx.beginPath(); ctx.arc(0, 0, p.size * (0.5 + f * 0.5), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawIdle(idle, t) {
    const { ctx } = this;
    const { x, y } = this.pos;
    const col = idle.color || '#ffffff';
    const fadeIn = clamp(t / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = fadeIn;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    switch (idle.type) {
      case 'zzz':
        ctx.font = 'bold 16px "Segoe UI",sans-serif';
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.6 + i / 3) % 1);
          ctx.globalAlpha = fadeIn * Math.sin(k * Math.PI);
          ctx.font = `bold ${10 + k * 12}px "Segoe UI",sans-serif`;
          ctx.fillText('Z', x + 18 + k * 22, y - 6 - k * 34);
        }
        break;
      case 'orbit':
        ctx.shadowBlur = 8;
        for (let i = 0; i < 3; i++) {
          const a = t * 3 + (i * TAU) / 3;
          starPath(ctx, x + Math.cos(a) * 24, y + Math.sin(a) * 12 - 4, 5, 5, 2.2);
          ctx.fill();
        }
        break;
      case 'pulse': {
        const k = (t * 0.8) % 1;
        ctx.globalAlpha = fadeIn * (1 - k);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(x, y, 6 + k * 30, 0, TAU); ctx.stroke();
        break;
      }
      case 'hearts':
        for (let i = 0; i < 3; i++) {
          const k = ((t * 0.5 + i / 3) % 1);
          ctx.globalAlpha = fadeIn * Math.sin(k * Math.PI);
          heartPath(ctx, x + 16 + Math.sin(k * 6 + i) * 6, y - k * 40, 12);
          ctx.fillStyle = i % 2 ? '#ff5c9d' : col;
          ctx.fill();
        }
        break;
      case 'halo':
        ctx.shadowBlur = 12;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x + 6, y - 14 + Math.sin(t * 3) * 2, 14, 5, 0, 0, TAU); ctx.stroke();
        break;
      case 'glow': {
        const k = 0.5 + 0.5 * Math.sin(t * 3);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 30 + k * 12);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = fadeIn * (0.25 + k * 0.3);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 44, 0, TAU); ctx.fill();
        break;
      }
      case 'bounce': {
        const b = Math.abs(Math.sin(t * 4)) * 8;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(x - 7, y - 30 - b); ctx.lineTo(x + 7, y - 30 - b); ctx.lineTo(x, y - 20 - b);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'dots':
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath(); ctx.ellipse(x + 30, y - 24, 20, 12, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 14, y - 10, 3.5, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = Math.floor(t * 3) % 3 === i ? '#333' : '#999';
          ctx.beginPath(); ctx.arc(x + 22 + i * 8, y - 24, 2.6, 0, TAU); ctx.fill();
        }
        break;
      default: break;
    }
    ctx.restore();
  }
}
