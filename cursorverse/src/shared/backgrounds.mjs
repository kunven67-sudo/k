// Animated backgrounds for the app and the browser home page.
// Each one: { id, name, emoji, create(w, h) -> state, draw(ctx, state, w, h, t, dt) }
import { TAU, hsl, rng } from './draw-helpers.mjs';

const R = Math.random;

export const BACKGROUNDS = [
  {
    id: 'starfield', name: 'Warp Starfield', emoji: '🚀',
    create: (w, h) => ({ stars: Array.from({ length: 380 }, () => ({ x: (R() - 0.5) * w, y: (R() - 0.5) * h, z: R() * w })) }),
    draw(ctx, s, w, h, t, dt) {
      ctx.fillStyle = '#03030b'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      for (const st of s.stars) {
        const pz = st.z;
        st.z -= dt * w * 0.25;
        if (st.z < 1) { st.x = (R() - 0.5) * w; st.y = (R() - 0.5) * h; st.z = w; continue; }
        const k = w / st.z, pk = w / pz;
        const x = cx + st.x * k, y = cy + st.y * k;
        const px = cx + st.x * pk, py = cy + st.y * pk;
        const b = Math.min(1, 1.3 - st.z / w);
        ctx.strokeStyle = `rgba(200,220,255,${b})`;
        ctx.lineWidth = Math.max(0.5, 2.2 * (1 - st.z / w));
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
    },
  },
  {
    id: 'matrix', name: 'Matrix Rain', emoji: '💚',
    create: (w, h) => ({ cols: Array.from({ length: Math.ceil(w / 16) }, () => R() * h / 16), buf: null }),
    draw(ctx, s, w, h, t, dt) {
      ctx.fillStyle = 'rgba(0,8,2,0.16)'; ctx.fillRect(0, 0, w, h);
      ctx.font = '15px monospace';
      s.acc = (s.acc || 0) + dt;
      if (s.acc < 0.05) return;
      s.acc = 0;
      s.cols.forEach((y, i) => {
        const ch = String.fromCharCode(0x30a0 + Math.floor(R() * 96));
        ctx.fillStyle = R() > 0.96 ? '#d8ffd8' : '#1fff6a';
        ctx.fillText(ch, i * 16, y * 16);
        s.cols[i] = y * 16 > h && R() > 0.975 ? 0 : y + 1;
      });
    },
    trails: true,
  },
  {
    id: 'neon-grid', name: 'Synthwave Grid', emoji: '🌆',
    create: () => ({}),
    draw(ctx, s, w, h, t) {
      const hor = h * 0.58;
      const sky = ctx.createLinearGradient(0, 0, 0, hor);
      sky.addColorStop(0, '#12002b'); sky.addColorStop(1, '#5a0f5e');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hor);
      const sun = ctx.createLinearGradient(0, hor - h * 0.32, 0, hor);
      sun.addColorStop(0, '#ffe45e'); sun.addColorStop(1, '#ff2d95');
      ctx.fillStyle = sun;
      ctx.beginPath(); ctx.arc(w / 2, hor, h * 0.26, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#5a0f5e';
      for (let i = 0; i < 7; i++) {
        const y = hor - h * 0.02 - i * h * 0.03;
        ctx.fillRect(w / 2 - h * 0.3, y, h * 0.6, 2 + i * 0.6);
      }
      ctx.fillStyle = '#0a0014'; ctx.fillRect(0, hor, w, h - hor);
      ctx.strokeStyle = '#ff2bd6'; ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 8;
      const off = (t * 0.6) % 1;
      for (let i = 0; i < 18; i++) {
        const k = (i + off) / 18;
        const y = hor + (h - hor) * k * k;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let i = -20; i <= 20; i++) {
        ctx.beginPath(); ctx.moveTo(w / 2 + i * 12, hor); ctx.lineTo(w / 2 + i * w * 0.12, h); ctx.stroke();
      }
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'fireflies', name: 'Fireflies', emoji: '✨',
    create: (w, h) => ({ f: Array.from({ length: 90 }, () => ({ x: R() * w, y: R() * h, a: R() * TAU, s: 10 + R() * 25, p: R() * TAU })) }),
    draw(ctx, s, w, h, t, dt) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#04121a'); g.addColorStop(1, '#0b2a1c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const f of s.f) {
        f.a += (R() - 0.5) * dt * 2;
        f.x = (f.x + Math.cos(f.a) * f.s * dt + w) % w;
        f.y = (f.y + Math.sin(f.a) * f.s * dt + h) % h;
        const b = 0.5 + 0.5 * Math.sin(t * 2 + f.p);
        const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
        rg.addColorStop(0, `rgba(230,255,140,${b})`); rg.addColorStop(1, 'rgba(230,255,140,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(f.x, f.y, 9, 0, TAU); ctx.fill();
      }
    },
  },
  {
    id: 'aurora', name: 'Aurora', emoji: '🌌',
    create: () => ({}),
    draw(ctx, s, w, h, t) {
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let band = 0; band < 3; band++) {
        const hue = 140 + band * 50 + Math.sin(t * 0.2 + band) * 20;
        ctx.fillStyle = hsl(hue, 90, 55, 0.12);
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) {
          const y = h * (0.35 + band * 0.08) + Math.sin(x * 0.004 + t * 0.5 + band * 2) * h * 0.08 + Math.sin(x * 0.011 + t * 0.9) * h * 0.03;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      if (!s.stars) { const r = rng(4); s.stars = Array.from({ length: 150 }, () => [r(), r() * 0.6, r()]); }
      for (const [x, y, b] of s.stars) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * b * (0.5 + 0.5 * Math.sin(t * 2 + b * 9))})`;
        ctx.fillRect(x * w, y * h, 1.5, 1.5);
      }
    },
  },
  {
    id: 'waves', name: 'Ocean Waves', emoji: '🌊',
    create: () => ({}),
    draw(ctx, s, w, h, t) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0b3d91'); g.addColorStop(1, '#001233');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = `rgba(${40 + i * 20},${140 + i * 15},255,${0.12 + i * 0.03})`;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * (0.45 + i * 0.1) + Math.sin(x * 0.008 + t * (0.6 + i * 0.2) + i) * 18);
        ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
      }
    },
  },
  {
    id: 'bubbles', name: 'Bubbles', emoji: '🫧',
    create: (w, h) => ({ b: Array.from({ length: 60 }, () => ({ x: R() * w, y: R() * h, r: 4 + R() * 26, v: 15 + R() * 40 })) }),
    draw(ctx, s, w, h, t, dt) {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#ff9ecf'); g.addColorStop(1, '#8ec5ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const b of s.b) {
        b.y -= b.v * dt;
        if (b.y < -b.r) { b.y = h + b.r; b.x = R() * w; }
        const x = b.x + Math.sin(t + b.r) * 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, b.y, b.r, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.18, 0, TAU); ctx.fill();
      }
    },
  },
  {
    id: 'snow', name: 'Snowfall', emoji: '❄️',
    create: (w, h) => ({ f: Array.from({ length: 220 }, () => ({ x: R() * w, y: R() * h, r: 0.8 + R() * 2.6, v: 20 + R() * 50 })) }),
    draw(ctx, s, w, h, t, dt) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b2a49'); g.addColorStop(1, '#465a86');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      for (const f of s.f) {
        f.y += f.v * dt; f.x += Math.sin(t + f.r * 3) * 12 * dt;
        if (f.y > h) { f.y = -4; f.x = R() * w; }
        ctx.globalAlpha = 0.5 + f.r / 6;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },
  {
    id: 'galaxy', name: 'Galaxy Swirl', emoji: '🌀',
    create: () => { const r = rng(9); return { p: Array.from({ length: 900 }, () => ({ d: r() ** 1.6, a: r() * TAU, arm: Math.floor(r() * 3), c: r() })) }; },
    draw(ctx, s, w, h, t) {
      ctx.fillStyle = '#05010f'; ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, rad = Math.min(w, h) * 0.48;
      for (const p of s.p) {
        const a = p.a * 0.25 + p.arm * (TAU / 3) + p.d * 5 - t * 0.08 * (1.2 - p.d);
        const x = cx + Math.cos(a) * p.d * rad * 1.3, y = cy + Math.sin(a) * p.d * rad * 0.7;
        ctx.fillStyle = hsl(260 + p.c * 80, 90, 70 + (1 - p.d) * 20, 0.8);
        ctx.fillRect(x, y, 1.6, 1.6);
      }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad * 0.25);
      g.addColorStop(0, 'rgba(255,230,255,0.8)'); g.addColorStop(1, 'rgba(255,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad * 0.25, 0, TAU); ctx.fill();
    },
  },
  {
    id: 'rain', name: 'Rain on Glass', emoji: '🌧️',
    create: (w, h) => ({ d: Array.from({ length: 260 }, () => ({ x: R() * w, y: R() * h, l: 8 + R() * 18, v: 500 + R() * 400 })) }),
    draw(ctx, s, w, h, t, dt) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1d2b3a'); g.addColorStop(1, '#0d141c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(170,200,230,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of s.d) {
        d.y += d.v * dt; d.x -= d.v * dt * 0.08;
        if (d.y > h) { d.y = -d.l; d.x = R() * (w + 60); }
        ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.l * 0.08, d.y + d.l);
      }
      ctx.stroke();
    },
  },
  {
    id: 'network', name: 'Particle Network', emoji: '🕸️',
    create: (w, h) => ({ n: Array.from({ length: 80 }, () => ({ x: R() * w, y: R() * h, vx: (R() - 0.5) * 30, vy: (R() - 0.5) * 30 })) }),
    draw(ctx, s, w, h, t, dt) {
      ctx.fillStyle = '#0a0f1f'; ctx.fillRect(0, 0, w, h);
      for (const p of s.n) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < s.n.length; i++) {
        for (let j = i + 1; j < s.n.length; j++) {
          const a = s.n[i], b = s.n[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 140) {
            ctx.strokeStyle = `rgba(0,229,255,${(1 - d / 140) * 0.5})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.fillStyle = '#7ff3ff';
      for (const p of s.n) ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    },
  },
  {
    id: 'lava', name: 'Lava Lamp', emoji: '🫠',
    create: (w, h) => ({ b: Array.from({ length: 9 }, (_, i) => ({ x: R() * w, y: R() * h, r: 60 + R() * 90, p: i * 0.7, s: 0.1 + R() * 0.2 })) }),
    draw(ctx, s, w, h, t) {
      ctx.fillStyle = '#1a0526'; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of s.b) {
        const x = b.x + Math.sin(t * b.s + b.p) * w * 0.15;
        const y = (h / 2) + Math.sin(t * b.s * 0.8 + b.p * 2) * h * 0.4;
        const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        g.addColorStop(0, hsl(300 + b.p * 20, 100, 60, 0.55)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, b.r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },
  {
    id: 'pixel-sky', name: 'Pixel Sky', emoji: '☁️',
    create: (w, h) => { const r = rng(21); return { c: Array.from({ length: 10 }, () => ({ x: r() * w, y: r() * h * 0.6, s: 3 + Math.floor(r() * 4), v: 8 + r() * 20 })) }; },
    draw(ctx, s, w, h, t, dt) {
      const bands = ['#5fcde4', '#6ad0e6', '#7ad6ea', '#8cdcee', '#a0e3f2'];
      bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, (i * h) / bands.length, w, h / bands.length + 1); });
      ctx.fillStyle = '#ffffff';
      for (const c of s.c) {
        c.x += c.v * dt;
        if (c.x > w + 100) c.x = -120;
        const p = c.s * 4;
        const shape = ['..XXX...', '.XXXXXX.', 'XXXXXXXX'];
        shape.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === 'X') ctx.fillRect(Math.round(c.x + rx * p), Math.round(c.y + ry * p), p, p); }));
      }
      ctx.fillStyle = '#4caf50';
      for (let x = 0; x < w; x += 16) ctx.fillRect(x, h - 40 - ((x / 16) % 3) * 4, 16, 60);
      ctx.fillStyle = '#8d5524'; ctx.fillRect(0, h - 20, w, 20);
    },
  },
];

export const BG_MAP = new Map(BACKGROUNDS.map((b) => [b.id, b]));

// Runs a background on a canvas; returns a controller with stop()/setBackground().
export function runBackground(canvas, id, { lowPower = false } = {}) {
  const ctx = canvas.getContext('2d');
  let def = BG_MAP.get(id) || BACKGROUNDS[0];
  let state = null;
  let raf = 0;
  let last = performance.now();
  let t = 0;
  let w = 0, h = 0;
  let paused = false;
  const minFrame = lowPower ? 1000 / 30 : 0;

  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 2);
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state = def.create(w, h);
  };
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    if (paused || document.hidden) { last = now; return; }
    if (now - last < minFrame) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    def.draw(ctx, state, w, h, t, dt);
  };
  const ro = new ResizeObserver(size);
  ro.observe(canvas);
  size();
  raf = requestAnimationFrame(loop);
  return {
    setBackground(nid) { def = BG_MAP.get(nid) || BACKGROUNDS[0]; state = def.create(w, h); },
    pause(p) { paused = p; },
    stop() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
