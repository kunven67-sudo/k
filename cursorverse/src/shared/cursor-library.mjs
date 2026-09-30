// The 100 built-in cursors.
// Vector cursors: draw(ctx, t, H) inside a 64x64 unit box (ctx pre-scaled).
// Pixel cursors (px: true): draw(ctx, t, H, S) in device pixels on an S x S canvas.
// t is the animation phase 0..1. hotspot is in units (vector) or grid cells (pixel).
import {
  TAU, ARROW, arrowPath, pathPoly, hsl, rng, starPath, heartPath, sparklePath, roundRectPath,
  cloudPath, boltPoints, strokePts, flamePath, drawEmoji, autoOutline, drawGrid, mirrorRows,
} from './draw-helpers.mjs';

export const CATEGORIES = [
  { id: 'gaming', name: 'Gaming / Neon', emoji: '🎮' },
  { id: 'weapons', name: 'Weapons / Fantasy', emoji: '⚔️' },
  { id: 'cute', name: 'Cute / Animals / Food', emoji: '🐱' },
  { id: 'pixel', name: 'Pixel / Retro', emoji: '👾' },
];

const TIP = [6, 6];
const CENTER = [32, 32];
const list = [];
const add = (def) => list.push({ frames: def.animated ? 16 : 1, fps: 14, ...def });

// ---------------------------------------------------------------- gaming / neon

function neonArrow(ctx, H, color, glowUnits = 6, fill = 'rgba(10,10,24,0.88)') {
  arrowPath(ctx);
  ctx.lineJoin = 'round';
  ctx.fillStyle = fill;
  ctx.fill();
  H.glow(ctx, color, glowUnits);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  H.noGlow(ctx);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

const NEONS = [
  ['cyan', 'Neon Cyan', '#00e5ff'], ['pink', 'Neon Pink', '#ff2bd6'], ['lime', 'Neon Lime', '#7dff2b'],
  ['orange', 'Neon Orange', '#ff8a1f'], ['purple', 'Neon Purple', '#a64dff'], ['red', 'Neon Red', '#ff2946'],
  ['gold', 'Neon Gold', '#ffd21f'],
];
for (const [id, name, color] of NEONS) {
  add({ id: `neon-${id}`, name, cat: 'gaming', hotspot: TIP, draw: (ctx, t, H) => neonArrow(ctx, H, color) });
}

add({
  id: 'rgb-wave', name: 'RGB Wave', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    const g = ctx.createLinearGradient(6, 6, 40, 58);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, hsl(t * 360 + i * 60, 100, 55));
    arrowPath(ctx);
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(10,10,24,0.9)';
    ctx.fill();
    H.glow(ctx, hsl(t * 360, 100, 60), 7);
    ctx.strokeStyle = g;
    ctx.lineWidth = 3.4;
    ctx.stroke();
    H.noGlow(ctx);
  },
});

add({
  id: 'pulse-core', name: 'Pulse Core', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    const p = 0.5 + 0.5 * Math.sin(t * TAU);
    neonArrow(ctx, H, '#00ffc8', 3 + p * 10);
    ctx.globalAlpha = 0.35 + p * 0.5;
    ctx.fillStyle = '#00ffc8';
    ctx.beginPath();
    ctx.arc(17, 32, 3 + p * 2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  },
});

const FLICKER = [1, 1, 1, 0.2, 1, 1, 0.1, 1, 1, 1, 1, 0.35, 1, 0.15, 1, 1];
add({
  id: 'broken-neon', name: 'Broken Neon', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    const a = FLICKER[Math.floor(t * FLICKER.length) % FLICKER.length];
    neonArrow(ctx, H, `rgba(255,60,120,${a})`, 7 * a, 'rgba(10,10,24,0.9)');
  },
});

add({
  id: 'glitch', name: 'Glitch', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    const f = Math.floor(t * 16);
    const r = rng(f * 977 + 3);
    const glitchy = f % 4 === 1 || f % 7 === 3;
    if (glitchy) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.save(); ctx.translate(-2 - r() * 2, 0); arrowPath(ctx); ctx.fillStyle = 'rgba(255,0,80,0.8)'; ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(2 + r() * 2, 1); arrowPath(ctx); ctx.fillStyle = 'rgba(0,240,255,0.8)'; ctx.fill(); ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    arrowPath(ctx);
    ctx.fillStyle = '#f4f4ff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#111';
    ctx.lineJoin = 'round';
    ctx.stroke();
    if (glitchy) {
      for (let i = 0; i < 3; i++) {
        const y = 10 + r() * 40;
        ctx.clearRect(0, y, 64, 1.5 + r() * 2);
        ctx.fillStyle = r() > 0.5 ? '#ff0050' : '#00f0ff';
        ctx.fillRect(4 + r() * 10, y, 10 + r() * 20, 1.2);
      }
    }
  },
});

add({
  id: 'wireframe', name: 'Wireframe', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    arrowPath(ctx);
    ctx.fillStyle = 'rgba(0,20,30,0.55)';
    ctx.fill();
    H.glow(ctx, '#39ff14', 5);
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -t * 14;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.setLineDash([]);
    H.noGlow(ctx);
  },
});

add({
  id: 'sunset', name: 'Sunset Gradient', cat: 'gaming', hotspot: TIP,
  draw(ctx) {
    const g = ctx.createLinearGradient(6, 6, 34, 58);
    g.addColorStop(0, '#7b2ff7'); g.addColorStop(0.5, '#f107a3'); g.addColorStop(1, '#ff9a3c');
    arrowPath(ctx);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5; ctx.strokeStyle = '#140a24'; ctx.stroke();
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  },
});

add({
  id: 'chrome', name: 'Chrome Steel', cat: 'gaming', hotspot: TIP,
  draw(ctx) {
    const g = ctx.createLinearGradient(6, 6, 40, 50);
    ['#fdfdfd', '#9aa3ad', '#f2f5f8', '#5f6872', '#e3e7eb', '#8a939c'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
    arrowPath(ctx);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4.5; ctx.strokeStyle = '#15181c'; ctx.stroke();
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  },
});

function crossLines(ctx, cx, cy, inner, outer) {
  ctx.beginPath();
  ctx.moveTo(cx - outer, cy); ctx.lineTo(cx - inner, cy);
  ctx.moveTo(cx + inner, cy); ctx.lineTo(cx + outer, cy);
  ctx.moveTo(cx, cy - outer); ctx.lineTo(cx, cy - inner);
  ctx.moveTo(cx, cy + inner); ctx.lineTo(cx, cy + outer);
  ctx.stroke();
}
function outlined(ctx, draw, color, width, outline = 'rgba(0,0,0,0.85)') {
  ctx.lineCap = 'round';
  ctx.strokeStyle = outline; ctx.lineWidth = width + 2.4; draw();
  ctx.strokeStyle = color; ctx.lineWidth = width; draw();
}

add({
  id: 'crosshair', name: 'Crosshair', cat: 'gaming', hotspot: CENTER,
  draw(ctx) {
    outlined(ctx, () => crossLines(ctx, 32, 32, 5, 20), '#7dff2b', 2.6);
    ctx.fillStyle = '#7dff2b';
    ctx.beginPath(); ctx.arc(32, 32, 1.8, 0, TAU); ctx.fill();
  },
});
add({
  id: 'red-dot', name: 'Red Dot Sight', cat: 'gaming', hotspot: CENTER,
  draw(ctx, t, H) {
    outlined(ctx, () => { ctx.beginPath(); ctx.arc(32, 32, 14, 0, TAU); ctx.stroke(); }, '#ff3b3b', 2.2);
    H.glow(ctx, '#ff0000', 5);
    ctx.fillStyle = '#ff2020';
    ctx.beginPath(); ctx.arc(32, 32, 3.2, 0, TAU); ctx.fill();
    H.noGlow(ctx);
  },
});
add({
  id: 'sniper', name: 'Sniper Scope', cat: 'gaming', hotspot: CENTER,
  draw(ctx) {
    outlined(ctx, () => { ctx.beginPath(); ctx.arc(32, 32, 22, 0, TAU); ctx.stroke(); }, '#e8e8e8', 2);
    outlined(ctx, () => crossLines(ctx, 32, 32, 0.1, 26), '#e8e8e8', 1.4);
    ctx.fillStyle = '#ff3030';
    for (const d of [7, 13, 19]) {
      for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
        ctx.fillRect(32 + dx - 1.2, 32 + dy - 1.2, 2.4, 2.4);
      }
    }
  },
});
add({
  id: 'spin-target', name: 'Spinning Target', cat: 'gaming', hotspot: CENTER, animated: true,
  draw(ctx, t, H) {
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(t * TAU);
    H.glow(ctx, '#00e5ff', 4);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 17, i * (TAU / 4) + 0.25, (i + 1) * (TAU / 4) - 0.25);
      ctx.stroke();
    }
    ctx.rotate(-t * TAU * 2);
    ctx.strokeStyle = '#ff2bd6';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 10, i * (TAU / 3) + 0.3, (i + 1) * (TAU / 3) - 0.3);
      ctx.stroke();
    }
    ctx.restore();
    H.noGlow(ctx);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(32, 32, 2, 0, TAU); ctx.fill();
  },
});
add({
  id: 'hex-lock', name: 'Hex Lock', cat: 'gaming', hotspot: CENTER, animated: true,
  draw(ctx, t, H) {
    const p = 0.5 + 0.5 * Math.sin(t * TAU);
    const r = 13 + p * 5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    H.glow(ctx, '#ffae00', 3 + p * 6);
    ctx.strokeStyle = '#ffae00';
    ctx.lineWidth = 2.6;
    ctx.stroke();
    H.noGlow(ctx);
    outlined(ctx, () => crossLines(ctx, 32, 32, 3, 8), '#ffffff', 1.6);
  },
});
add({
  id: 'radar', name: 'Radar Sweep', cat: 'gaming', hotspot: CENTER, animated: true,
  draw(ctx, t, H) {
    ctx.fillStyle = 'rgba(0,30,10,0.75)';
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, TAU); ctx.fill();
    const a = t * TAU;
    const g = ctx.createConicGradient(a - 1.4, 32, 32);
    g.addColorStop(0, 'rgba(60,255,120,0)');
    g.addColorStop(0.22, 'rgba(60,255,120,0.75)');
    g.addColorStop(0.2201, 'rgba(60,255,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(32, 32); ctx.arc(32, 32, 22, a - 1.4, a); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#3cff78'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(32, 32, 22, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(32, 32, 13, 0, TAU); ctx.stroke();
    crossLines(ctx, 32, 32, 0, 22);
    const blip = (Math.sin(t * TAU * 2) + 1) / 2;
    H.glow(ctx, '#3cff78', 4);
    ctx.fillStyle = `rgba(160,255,190,${0.4 + blip * 0.6})`;
    ctx.beginPath(); ctx.arc(41, 24, 2.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(25, 40, 1.6, 0, TAU); ctx.fill();
    H.noGlow(ctx);
  },
});
add({
  id: 'plasma-orb', name: 'Plasma Orb', cat: 'gaming', hotspot: CENTER, animated: true,
  draw(ctx, t, H) {
    const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 16);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#d27bff'); g.addColorStop(1, 'rgba(90,0,200,0.15)');
    H.glow(ctx, '#b44dff', 10);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(32, 32, 15, 0, TAU); ctx.fill();
    H.noGlow(ctx);
    ctx.strokeStyle = 'rgba(255,220,255,0.9)';
    ctx.lineWidth = 1.2;
    const r = rng(Math.floor(t * 16) + 11);
    for (let i = 0; i < 4; i++) {
      const a = r() * TAU;
      strokePts(ctx, boltPoints(32, 32, 32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15, 4, 3, r));
    }
  },
});
add({
  id: 'orbit-ring', name: 'Orbit Ring', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    neonArrow(ctx, H, '#4d9bff');
    ctx.save();
    ctx.translate(20, 32);
    ctx.rotate(-0.5);
    ctx.strokeStyle = 'rgba(160,210,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 21, 7, 0, 0, TAU); ctx.stroke();
    const a = t * TAU;
    H.glow(ctx, '#ffffff', 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(Math.cos(a) * 21, Math.sin(a) * 7, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
    H.noGlow(ctx);
  },
});
add({
  id: 'cyber-tri', name: 'Cyber Triangle', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    const pts = [[6, 6], [14, 50], [24, 34], [46, 30]];
    pathPoly(ctx, pts);
    ctx.fillStyle = 'rgba(5,10,25,0.9)';
    ctx.fill();
    H.glow(ctx, '#00f0ff', 5);
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2.6; ctx.lineJoin = 'miter'; ctx.stroke();
    H.noGlow(ctx);
    // circuit trace with a travelling light
    const trace = [[10, 14], [14, 30], [22, 30], [30, 30]];
    ctx.strokeStyle = 'rgba(0,240,255,0.45)'; ctx.lineWidth = 1.2;
    strokePts(ctx, trace);
    const seg = t * 3, i = Math.floor(seg), f = seg - i;
    const [ax, ay] = trace[i], [bx, by] = trace[i + 1];
    H.glow(ctx, '#ffffff', 4);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ax + (bx - ax) * f, ay + (by - ay) * f, 1.8, 0, TAU); ctx.fill();
    H.noGlow(ctx);
  },
});
add({
  id: 'laser-dot', name: 'Laser Pointer', cat: 'gaming', hotspot: CENTER, animated: true,
  draw(ctx, t, H) {
    const p = 0.5 + 0.5 * Math.sin(t * TAU);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 12 + p * 4);
    g.addColorStop(0, 'rgba(255,40,40,0.55)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(32, 32, 16, 0, TAU); ctx.fill();
    H.glow(ctx, '#ff0000', 6);
    ctx.fillStyle = '#ff1a1a';
    ctx.beginPath(); ctx.arc(32, 32, 4, 0, TAU); ctx.fill();
    H.noGlow(ctx);
    ctx.fillStyle = '#ffd0d0';
    ctx.beginPath(); ctx.arc(31, 31, 1.5, 0, TAU); ctx.fill();
  },
});
add({
  id: 'hologram', name: 'Hologram', cat: 'gaming', hotspot: TIP, animated: true,
  draw(ctx, t, H) {
    ctx.save();
    const jitter = Math.floor(t * 16) % 5 === 0 ? 1.2 : 0;
    ctx.translate(jitter, 0);
    arrowPath(ctx);
    ctx.fillStyle = 'rgba(80,220,255,0.35)';
    ctx.fill();
    H.glow(ctx, '#50dcff', 5);
    ctx.strokeStyle = 'rgba(140,235,255,0.95)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
    H.noGlow(ctx);
    arrowPath(ctx);
    ctx.clip();
    ctx.fillStyle = 'rgba(200,250,255,0.5)';
    const off = t * 6;
    for (let y = -6; y < 64; y += 6) ctx.fillRect(0, y + off, 64, 1.3);
    ctx.restore();
  },
});

// ---------------------------------------------------------------- weapons / fantasy
// Weapons are drawn along +x after rotating 45deg around the tip at (5,5),
// so every point / blade tip lands on the hotspot.

function alongDiagonal(ctx, fn) {
  ctx.save();
  ctx.translate(5, 5);
  ctx.rotate(Math.PI / 4);
  fn();
  ctx.restore();
}
function outlineFill(ctx, fill, outline = '#16121c', width = 2.4) {
  ctx.lineJoin = 'round';
  ctx.lineWidth = width; ctx.strokeStyle = outline; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
}

function sword(ctx, H, o) {
  const len = o.len ?? 46, w = o.width ?? 4.6;
  alongDiagonal(ctx, () => {
    // blade
    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (o.curve) {
      ctx.quadraticCurveTo(len * 0.5, -w * 1.6, len, -w * 0.6);
      ctx.lineTo(len, w * 0.6);
      ctx.quadraticCurveTo(len * 0.5, -w * 0.1, 0, 0);
    } else {
      ctx.lineTo(8, -w); ctx.lineTo(len, -w); ctx.lineTo(len, w); ctx.lineTo(8, w);
    }
    ctx.closePath();
    if (o.glow) H.glow(ctx, o.glow, o.glowSize ?? 6);
    const g = ctx.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, o.edge); g.addColorStop(0.45, o.blade); g.addColorStop(0.55, o.blade); g.addColorStop(1, o.edgeDark ?? o.edge);
    outlineFill(ctx, g);
    H.noGlow(ctx);
    if (!o.curve) {
      ctx.strokeStyle = o.fuller ?? 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(len - 2, 0); ctx.stroke();
    }
    // guard
    if (o.round) {
      ctx.beginPath(); ctx.ellipse(len + 1.5, 0, 2.2, w + 3, 0, 0, TAU);
    } else {
      roundRectPath(ctx, len, -w - 5, 3.6, (w + 5) * 2, 1.4);
    }
    outlineFill(ctx, o.guard);
    // grip
    roundRectPath(ctx, len + 3.6, -2.4, o.grip ?? 14, 4.8, 1.2);
    outlineFill(ctx, o.handle);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
    for (let x = len + 6; x < len + 3.6 + (o.grip ?? 14); x += 3) {
      ctx.beginPath(); ctx.moveTo(x, -2.4); ctx.lineTo(x + 1.5, 2.4); ctx.stroke();
    }
    // pommel
    ctx.beginPath(); ctx.arc(len + 5.6 + (o.grip ?? 14), 0, 3.2, 0, TAU);
    outlineFill(ctx, o.pommel ?? o.guard);
  });
}

add({ id: 'sword-iron', name: 'Iron Sword', cat: 'weapons', hotspot: [5, 5],
  draw: (ctx, t, H) => sword(ctx, H, { blade: '#e4e9ef', edge: '#aab4bf', guard: '#6b7079', handle: '#5a3a22' }) });
add({ id: 'sword-gold', name: 'Golden Sword', cat: 'weapons', hotspot: [5, 5],
  draw: (ctx, t, H) => sword(ctx, H, { blade: '#fff0a0', edge: '#e0a91c', guard: '#b87a0f', handle: '#7a1f1f', pommel: '#ff4d4d' }) });
add({ id: 'sword-diamond', name: 'Diamond Sword', cat: 'weapons', hotspot: [5, 5],
  draw: (ctx, t, H) => sword(ctx, H, { blade: '#c8fbff', edge: '#2fc6e0', guard: '#2a8fa3', handle: '#3b2a1a', glow: 'rgba(90,240,255,0.6)', glowSize: 4 }) });
add({
  id: 'sword-flame', name: 'Flame Sword', cat: 'weapons', hotspot: [5, 5], animated: true,
  draw(ctx, t, H) {
    sword(ctx, H, { blade: '#ffd27a', edge: '#ff6a00', guard: '#3a3a3a', handle: '#241414', glow: '#ff5a00', glowSize: 5 });
    alongDiagonal(ctx, () => {
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 8;
        const h = 7 + 3 * Math.sin((t + i * 0.23) * TAU);
        ctx.save();
        ctx.translate(x, -3);
        flamePath(ctx, 0, 0, 5, h, t, i * 0.3);
        const g = ctx.createLinearGradient(0, 0, 0, -h);
        g.addColorStop(0, 'rgba(255,90,0,0.95)'); g.addColorStop(1, 'rgba(255,230,80,0.7)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      }
    });
  },
});
add({
  id: 'sword-frost', name: 'Frost Sword', cat: 'weapons', hotspot: [5, 5], animated: true,
  draw(ctx, t, H) {
    sword(ctx, H, { blade: '#eafcff', edge: '#7fd8ff', guard: '#3d7fc4', handle: '#1d3557', glow: '#9fe8ff', glowSize: 5 });
    for (let i = 0; i < 3; i++) {
      const p = (t + i / 3) % 1;
      const s = Math.sin(p * Math.PI);
      ctx.fillStyle = `rgba(255,255,255,${s})`;
      sparklePath(ctx, 12 + i * 11, 10 + i * 11 - 6, 2 + s * 3, p);
      ctx.fill();
    }
  },
});
add({
  id: 'sword-shadow', name: 'Shadow Blade', cat: 'weapons', hotspot: [5, 5], animated: true,
  draw(ctx, t, H) {
    const p = 0.5 + 0.5 * Math.sin(t * TAU);
    sword(ctx, H, { blade: '#6e2fa8', edge: '#2a0b45', edgeDark: '#1a0630', guard: '#111', handle: '#2b2b2b', pommel: '#a64dff', glow: '#a64dff', glowSize: 3 + p * 8, fuller: 'rgba(220,160,255,0.6)' });
  },
});
add({ id: 'katana', name: 'Katana', cat: 'weapons', hotspot: [5, 5],
  draw: (ctx, t, H) => sword(ctx, H, { curve: true, len: 44, width: 3, blade: '#f4f6f8', edge: '#9aa4ae', guard: '#c9a227', handle: '#1b1b1b', round: true, grip: 17, pommel: '#c9a227' }) });
add({
  id: 'energy-blade', name: 'Energy Blade', cat: 'weapons', hotspot: [5, 5], animated: true,
  draw(ctx, t, H) {
    const hum = 0.85 + 0.15 * Math.sin(t * TAU * 3);
    alongDiagonal(ctx, () => {
      H.glow(ctx, '#2bd9ff', 10 * hum);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(43,217,255,0.9)';
      ctx.lineWidth = 7 * hum;
      ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(46, 0); ctx.stroke();
      H.noGlow(ctx);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(46, 0); ctx.stroke();
      roundRectPath(ctx, 46, -3.4, 20, 6.8, 1.6);
      const g = ctx.createLinearGradient(0, -3.4, 0, 3.4);
      g.addColorStop(0, '#f2f2f2'); g.addColorStop(0.5, '#8d949b'); g.addColorStop(1, '#3c4146');
      outlineFill(ctx, g);
      ctx.fillStyle = '#222';
      for (let x = 52; x < 64; x += 3) ctx.fillRect(x, -3.4, 1.2, 6.8);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(48, -1, 2, 2);
    });
  },
});
add({ id: 'dagger', name: 'Dagger', cat: 'weapons', hotspot: [5, 5],
  draw: (ctx, t, H) => sword(ctx, H, { len: 28, width: 4, blade: '#eef1f4', edge: '#8e99a4', guard: '#7d5a2a', handle: '#3a2512', grip: 11, pommel: '#caa24a' }) });

function handle(ctx, from, to, color = '#7a4b25', w = 3.6) {
  roundRectPath(ctx, from, -w / 2, to - from, w, 1.4);
  outlineFill(ctx, color);
}

add({
  id: 'battle-axe', name: 'Battle Axe', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      handle(ctx, 4, 68);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -2.2); ctx.lineTo(6, 2.2); ctx.closePath();
      outlineFill(ctx, '#aab4bf');
      ctx.beginPath();
      ctx.moveTo(12, -1.5);
      ctx.quadraticCurveTo(11, -10, 8, -16);
      ctx.quadraticCurveTo(20, -18, 32, -14);
      ctx.quadraticCurveTo(26, -8, 28, -1.5);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -18, 0, 0);
      g.addColorStop(0, '#f5f7fa'); g.addColorStop(1, '#7c8791');
      outlineFill(ctx, g);
      ctx.beginPath();
      ctx.moveTo(14, 1.5); ctx.lineTo(26, 1.5); ctx.lineTo(22, 8); ctx.lineTo(18, 8); ctx.closePath();
      outlineFill(ctx, '#8a939c');
    });
  },
});
add({
  id: 'war-hammer', name: 'War Hammer', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      handle(ctx, 10, 68, '#5b3a1e');
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, -3); ctx.lineTo(10, 3); ctx.closePath();
      outlineFill(ctx, '#b8c0c8');
      roundRectPath(ctx, 8, -13, 12, 26, 2);
      const g = ctx.createLinearGradient(8, 0, 20, 0);
      g.addColorStop(0, '#dfe4ea'); g.addColorStop(1, '#6c757d');
      outlineFill(ctx, g);
      ctx.fillStyle = '#d4a017';
      ctx.fillRect(8, -2, 12, 4);
    });
  },
});
add({
  id: 'trident', name: 'Trident', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      handle(ctx, 16, 70, '#d9a43a', 3.2);
      const prong = (tipX, y) => {
        ctx.beginPath();
        ctx.moveTo(tipX, y); ctx.lineTo(tipX + 6, y - 2.2); ctx.lineTo(tipX + 5, y - 0.9);
        ctx.lineTo(18, y - 0.9); ctx.lineTo(18, y + 0.9); ctx.lineTo(tipX + 5, y + 0.9);
        ctx.lineTo(tipX + 6, y + 2.2); ctx.closePath();
        outlineFill(ctx, '#ffd66b');
      };
      prong(6, -8);
      prong(6, 8);
      prong(0, 0);
      roundRectPath(ctx, 16, -10, 4, 20, 1.5);
      outlineFill(ctx, '#e0a62a');
    });
  },
});
add({
  id: 'scythe', name: 'Reaper Scythe', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      handle(ctx, 12, 70, '#3b2b24', 3.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(4, 16, 16, 20);
      ctx.quadraticCurveTo(10, 10, 14, 1);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 16, 20);
      g.addColorStop(0, '#f0f3f6'); g.addColorStop(1, '#5d6670');
      outlineFill(ctx, g);
      ctx.beginPath(); ctx.arc(14, 0, 2.6, 0, TAU);
      outlineFill(ctx, '#7d2cff');
    });
  },
});
add({
  id: 'spear', name: 'Spear', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      handle(ctx, 14, 70, '#8b5a2b', 3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, -5); ctx.lineTo(16, 0); ctx.lineTo(10, 5); ctx.closePath();
      outlineFill(ctx, '#d6dde4');
      ctx.fillStyle = '#c0392b';
      ctx.beginPath(); ctx.moveTo(17, -2); ctx.lineTo(24, -6); ctx.lineTo(22, 0); ctx.lineTo(24, 6); ctx.lineTo(17, 2); ctx.closePath(); ctx.fill();
    });
  },
});
add({
  id: 'bow', name: 'Bow & Arrow', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      ctx.strokeStyle = '#16121c'; ctx.lineWidth = 4.4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(34, -26); ctx.quadraticCurveTo(18, 0, 34, 26); ctx.stroke();
      ctx.strokeStyle = '#8b4a1c'; ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(34, -26); ctx.quadraticCurveTo(18, 0, 34, 26); ctx.stroke();
      ctx.strokeStyle = '#f2e8d5'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(34, -26); ctx.lineTo(46, 0); ctx.lineTo(34, 26); ctx.stroke();
      handle(ctx, 6, 50, '#c49a6c', 2);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, -3.4); ctx.lineTo(8, 3.4); ctx.closePath();
      outlineFill(ctx, '#aeb7c0');
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.moveTo(44, -1); ctx.lineTo(52, -5); ctx.lineTo(52, -1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(44, 1); ctx.lineTo(52, 5); ctx.lineTo(52, 1); ctx.closePath(); ctx.fill();
    });
  },
});

function wand(ctx, stick, tip) {
  alongDiagonal(ctx, () => {
    roundRectPath(ctx, 6, -2, 46, 4, 2);
    outlineFill(ctx, stick);
    ctx.fillStyle = tip;
    ctx.fillRect(6, -2, 7, 4);
  });
}
add({
  id: 'star-wand', name: 'Star Wand', cat: 'weapons', hotspot: [9, 9], animated: true,
  draw(ctx, t, H) {
    wand(ctx, '#ff8fd8', '#ffe066');
    const p = 0.5 + 0.5 * Math.sin(t * TAU);
    H.glow(ctx, '#ffe066', 4 + p * 6);
    starPath(ctx, 9, 9, 5, 8.5, 3.8, -Math.PI / 2 + t * 0.6);
    outlineFill(ctx, '#ffe066', '#7a4a00', 1.8);
    H.noGlow(ctx);
    for (let i = 0; i < 3; i++) {
      const q = (t + i / 3) % 1;
      ctx.fillStyle = `rgba(255,255,255,${1 - q})`;
      sparklePath(ctx, 20 + i * 5 + q * 6, 4 + i * 6 - q * 3, 1.5 + (1 - q) * 2);
      ctx.fill();
    }
  },
});
add({
  id: 'magic-wand', name: 'Magic Wand', cat: 'weapons', hotspot: [6, 6], animated: true,
  draw(ctx, t) {
    wand(ctx, '#1b1b1f', '#f7f7f7');
    const r = rng(Math.floor(t * 16) * 31 + 7);
    for (let i = 0; i < 6; i++) {
      const q = (t * 2 + i / 6) % 1;
      const a = r() * TAU;
      ctx.fillStyle = hsl(i * 60 + t * 360, 100, 70, 1 - q);
      sparklePath(ctx, 6 + Math.cos(a) * q * 14, 6 + Math.sin(a) * q * 14, 2.4 * (1 - q) + 0.6);
      ctx.fill();
    }
  },
});
function staff(ctx, wood = '#6b4423') {
  alongDiagonal(ctx, () => {
    roundRectPath(ctx, 12, -2.4, 58, 4.8, 2);
    outlineFill(ctx, wood);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    for (let x = 20; x < 66; x += 9) { ctx.beginPath(); ctx.moveTo(x, -2.4); ctx.lineTo(x + 2, 2.4); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(16, 0); ctx.lineTo(10, 6); ctx.lineTo(14, 0); ctx.closePath();
    outlineFill(ctx, '#b08d57');
  });
}
add({
  id: 'fire-staff', name: 'Fire Staff', cat: 'weapons', hotspot: [11, 11], animated: true,
  draw(ctx, t, H) {
    staff(ctx);
    H.glow(ctx, '#ff6a00', 10);
    const g = ctx.createRadialGradient(11, 11, 1, 11, 11, 8);
    g.addColorStop(0, '#fff6c2'); g.addColorStop(0.5, '#ffa200'); g.addColorStop(1, '#ff3d00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(11, 11, 6.5, 0, TAU); ctx.fill();
    H.noGlow(ctx);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(11 + (i - 1) * 3.2, 8);
      flamePath(ctx, 0, 0, 4.2, 9 + 3 * Math.sin((t + i * 0.3) * TAU), t, i * 0.4);
      ctx.fillStyle = i === 1 ? 'rgba(255,220,90,0.95)' : 'rgba(255,110,0,0.9)';
      ctx.fill();
      ctx.restore();
    }
  },
});
add({
  id: 'ice-staff', name: 'Ice Staff', cat: 'weapons', hotspot: [10, 10], animated: true,
  draw(ctx, t, H) {
    staff(ctx, '#4a5d73');
    const p = 0.5 + 0.5 * Math.sin(t * TAU);
    H.glow(ctx, '#7fe3ff', 4 + p * 8);
    ctx.save();
    ctx.translate(11, 11);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0); ctx.closePath();
    const g = ctx.createLinearGradient(-5, -11, 5, 8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#3bc9ff');
    outlineFill(ctx, g, '#0d3b66', 1.6);
    ctx.restore();
    H.noGlow(ctx);
  },
});
add({
  id: 'storm-staff', name: 'Storm Staff', cat: 'weapons', hotspot: [11, 11], animated: true,
  draw(ctx, t, H) {
    staff(ctx, '#3b3b4f');
    H.glow(ctx, '#b3a1ff', 8);
    ctx.fillStyle = '#6e5bff';
    ctx.beginPath(); ctx.arc(11, 11, 6, 0, TAU); ctx.fill();
    H.noGlow(ctx);
    const r = rng(Math.floor(t * 16) * 13 + 5);
    ctx.strokeStyle = '#f3f0ff';
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) {
      const a = r() * TAU;
      strokePts(ctx, boltPoints(11, 11, 11 + Math.cos(a) * 12, 11 + Math.sin(a) * 12, 4, 2.6, r));
    }
  },
});
add({
  id: 'space-blaster', name: 'Space Blaster', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      roundRectPath(ctx, 0, -2.6, 16, 5.2, 1.5); outlineFill(ctx, '#9aa3ad');
      roundRectPath(ctx, 12, -6, 26, 12, 3);
      const g = ctx.createLinearGradient(0, -6, 0, 6);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#8e9aa6');
      outlineFill(ctx, g);
      ctx.fillStyle = '#ff3fa4'; ctx.fillRect(16, -1.5, 18, 3);
      ctx.beginPath(); ctx.moveTo(28, 5); ctx.lineTo(40, 18); ctx.lineTo(34, 21); ctx.lineTo(24, 6); ctx.closePath();
      outlineFill(ctx, '#3c4652');
      ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(34, 0, 2, 0, TAU); ctx.fill();
    });
  },
});
add({
  id: 'laser-pistol', name: 'Laser Pistol', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      roundRectPath(ctx, 0, -2.2, 12, 4.4, 1); outlineFill(ctx, '#e04040');
      roundRectPath(ctx, 10, -5, 26, 10, 2); outlineFill(ctx, '#2d2f36');
      ctx.fillStyle = '#ff5555'; ctx.fillRect(13, -1, 20, 2);
      ctx.beginPath(); ctx.moveTo(26, 4); ctx.lineTo(34, 20); ctx.lineTo(28, 22); ctx.lineTo(21, 5); ctx.closePath();
      outlineFill(ctx, '#4a2c1a');
    });
  },
});
add({
  id: 'shuriken', name: 'Shuriken', cat: 'weapons', hotspot: [18, 18], animated: true, frames: 12,
  draw(ctx, t) {
    ctx.save();
    ctx.translate(18, 18);
    ctx.rotate(t * TAU / 4);
    starPath(ctx, 0, 0, 4, 15, 4.5, 0);
    const g = ctx.createLinearGradient(-15, -15, 15, 15);
    g.addColorStop(0, '#f4f6f8'); g.addColorStop(1, '#5f6a75');
    outlineFill(ctx, g);
    ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU);
    ctx.fillStyle = '#16121c'; ctx.fill();
    ctx.restore();
  },
});
add({
  id: 'mana-crystal', name: 'Mana Crystal', cat: 'weapons', hotspot: [5, 5], animated: true,
  draw(ctx, t, H) {
    const p = 0.5 + 0.5 * Math.sin(t * TAU);
    alongDiagonal(ctx, () => {
      H.glow(ctx, '#3f8cff', 3 + p * 9);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(14, -9); ctx.lineTo(40, -6); ctx.lineTo(46, 0); ctx.lineTo(40, 6); ctx.lineTo(14, 9); ctx.closePath();
      const g = ctx.createLinearGradient(0, -9, 0, 9);
      g.addColorStop(0, '#bfe0ff'); g.addColorStop(0.5, '#3f8cff'); g.addColorStop(1, '#1b3fa6');
      outlineFill(ctx, g, '#0b1a40', 2);
      H.noGlow(ctx);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(46, 0); ctx.moveTo(14, -9); ctx.lineTo(14, 9); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${p})`;
      sparklePath(ctx, 28, -3, 3); ctx.fill();
    });
  },
});
add({
  id: 'pickaxe', name: 'Diamond Pickaxe', cat: 'weapons', hotspot: [5, 5],
  draw(ctx) {
    alongDiagonal(ctx, () => {
      handle(ctx, 8, 66, '#8b5a2b', 4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(12, -8, 30, -22);
      ctx.lineTo(28, -15);
      ctx.quadraticCurveTo(14, -2, 12, 0);
      ctx.quadraticCurveTo(14, 2, 28, 15);
      ctx.lineTo(30, 22);
      ctx.quadraticCurveTo(12, 8, 0, 0);
      ctx.closePath();
      outlineFill(ctx, '#5ff2ff');
    });
  },
});

// ---------------------------------------------------------------- cute / animals / food

function miniArrow(ctx, fill = '#ffffff', stroke = '#2a2140') {
  ctx.save();
  arrowPath(ctx, 0.62, 4, 4);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.6; ctx.strokeStyle = stroke; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}
const MINI_TIP = [4, 4];

function emojiCursor(id, name, ch, anim, arrowColor = '#ffffff') {
  add({
    id, name, cat: 'cute', hotspot: MINI_TIP, animated: !!anim,
    draw(ctx, t) {
      miniArrow(ctx, arrowColor);
      let dx = 0, dy = 0, rot = 0, sc = 1;
      if (anim === 'hop') dy = -Math.abs(Math.sin(t * Math.PI)) * 7;
      if (anim === 'waddle') { rot = Math.sin(t * TAU) * 0.22; dx = Math.sin(t * TAU) * 1.5; }
      if (anim === 'spin') rot = t * TAU;
      if (anim === 'wiggle') rot = Math.sin(t * TAU * 2) * 0.15;
      if (anim === 'pulse') sc = 1 + Math.sin(t * TAU) * 0.08;
      ctx.save();
      ctx.translate(41 + dx, 42 + dy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      drawEmoji(ctx, ch, 0, 0, 30);
      ctx.restore();
    },
  });
}

add({
  id: 'kitty', name: 'Kitty', cat: 'cute', hotspot: MINI_TIP,
  draw(ctx) {
    miniArrow(ctx, '#ffc2e2');
    const cx = 41, cy = 42;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 4); ctx.lineTo(cx - 13, cy - 20); ctx.lineTo(cx - 4, cy - 12);
    ctx.lineTo(cx + 4, cy - 12); ctx.lineTo(cx + 13, cy - 20); ctx.lineTo(cx + 15, cy - 4);
    ctx.quadraticCurveTo(cx + 16, cy + 13, cx, cy + 13);
    ctx.quadraticCurveTo(cx - 16, cy + 13, cx - 15, cy - 4);
    ctx.closePath();
    outlineFill(ctx, '#ffffff', '#2a2140', 2.4);
    ctx.fillStyle = '#ff9ccf';
    ctx.beginPath(); ctx.moveTo(cx - 12, cy - 9); ctx.lineTo(cx - 11.5, cy - 16); ctx.lineTo(cx - 7, cy - 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 12, cy - 9); ctx.lineTo(cx + 11.5, cy - 16); ctx.lineTo(cx + 7, cy - 11); ctx.fill();
    ctx.fillStyle = '#2a2140';
    ctx.beginPath(); ctx.arc(cx - 6, cy, 2.2, 0, TAU); ctx.arc(cx + 6, cy, 2.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7eb6';
    ctx.beginPath(); ctx.moveTo(cx - 1.6, cy + 3); ctx.lineTo(cx + 1.6, cy + 3); ctx.lineTo(cx, cy + 5); ctx.fill();
    ctx.strokeStyle = '#2a2140'; ctx.lineWidth = 0.8;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 9, cy + 4); ctx.lineTo(cx + s * 17, cy + 2);
      ctx.moveTo(cx + s * 9, cy + 6); ctx.lineTo(cx + s * 17, cy + 7);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,120,170,0.45)';
    ctx.beginPath(); ctx.arc(cx - 9, cy + 5, 2.4, 0, TAU); ctx.arc(cx + 9, cy + 5, 2.4, 0, TAU); ctx.fill();
  },
});
add({
  id: 'paw', name: 'Paw Print', cat: 'cute', hotspot: MINI_TIP,
  draw(ctx) {
    miniArrow(ctx, '#ffe0b3');
    const fill = () => outlineFill(ctx, '#ff9f5a', '#4a2a14', 2);
    ctx.beginPath(); ctx.ellipse(41, 47, 9, 7.5, 0, 0, TAU); fill();
    [[29, 36, -0.4], [36, 29, -0.15], [46, 29, 0.15], [53, 36, 0.4]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.ellipse(x, y, 3.8, 5, r, 0, TAU); fill();
    });
  },
});
add({
  id: 'heartbeat', name: 'Heartbeat', cat: 'cute', hotspot: MINI_TIP, animated: true,
  draw(ctx, t, H) {
    miniArrow(ctx, '#ffd6e7');
    const beat = t < 0.15 ? Math.sin((t / 0.15) * Math.PI) : t > 0.25 && t < 0.4 ? Math.sin(((t - 0.25) / 0.15) * Math.PI) * 0.7 : 0;
    const s = 26 + beat * 6;
    H.glow(ctx, '#ff3d7f', 3 + beat * 6);
    heartPath(ctx, 41, 44, s);
    const g = ctx.createLinearGradient(30, 30, 52, 58);
    g.addColorStop(0, '#ff7aa8'); g.addColorStop(1, '#e8154f');
    outlineFill(ctx, g, '#5a0a24', 2);
    H.noGlow(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(35, 38, 2.5, 3.5, -0.6, 0, TAU); ctx.fill();
  },
});
add({
  id: 'love-arrow', name: 'Love Arrow', cat: 'cute', hotspot: TIP,
  draw(ctx) {
    const g = ctx.createLinearGradient(6, 6, 34, 58);
    g.addColorStop(0, '#ffb3d1'); g.addColorStop(1, '#ff4f9a');
    arrowPath(ctx);
    outlineFill(ctx, g, '#5a0a34', 2.6);
    ctx.fillStyle = '#ffffff';
    heartPath(ctx, 15, 30, 9); ctx.fill();
    heartPath(ctx, 44, 52, 11);
    outlineFill(ctx, '#ff2e7a', '#5a0a34', 1.8);
  },
});
add({
  id: 'twinkle', name: 'Twinkle Star', cat: 'cute', hotspot: MINI_TIP, animated: true,
  draw(ctx, t, H) {
    miniArrow(ctx, '#fff7c2');
    const s = 1 + Math.sin(t * TAU) * 0.08;
    ctx.save();
    ctx.translate(41, 43);
    ctx.scale(s, s);
    ctx.rotate(Math.sin(t * TAU) * 0.12);
    H.glow(ctx, '#ffe066', 6);
    starPath(ctx, 0, 0, 5, 18, 8.5);
    outlineFill(ctx, '#ffe066', '#6b4a00', 2);
    H.noGlow(ctx);
    ctx.fillStyle = '#3a2a00';
    const blink = t > 0.85 && t < 0.95;
    if (blink) { ctx.fillRect(-6, 0, 4, 1.2); ctx.fillRect(2, 0, 4, 1.2); } else {
      ctx.beginPath(); ctx.arc(-4, 0, 1.8, 0, TAU); ctx.arc(4, 0, 1.8, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 3, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.restore();
  },
});
add({
  id: 'boo', name: 'Boo Buddy', cat: 'cute', hotspot: MINI_TIP, animated: true,
  draw(ctx, t) {
    miniArrow(ctx, '#e8e6ff');
    const y = Math.sin(t * TAU) * 3;
    ctx.save();
    ctx.translate(41, 42 + y);
    ctx.beginPath();
    ctx.moveTo(-13, 14);
    ctx.lineTo(-13, -2);
    ctx.arc(0, -2, 13, Math.PI, 0);
    ctx.lineTo(13, 14);
    const w = Math.sin(t * TAU * 2) * 1.5;
    for (let i = 0; i < 4; i++) {
      const x0 = 13 - i * 6.5;
      ctx.quadraticCurveTo(x0 - 3.25, 10 + (i % 2 ? w : -w), x0 - 6.5, 14);
    }
    ctx.closePath();
    outlineFill(ctx, '#ffffff', '#35305a', 2.2);
    ctx.fillStyle = '#35305a';
    ctx.beginPath(); ctx.ellipse(-5, -2, 2, 3, 0, 0, TAU); ctx.ellipse(5, -2, 2, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,130,180,0.5)';
    ctx.beginPath(); ctx.arc(-8, 3, 2.2, 0, TAU); ctx.arc(8, 3, 2.2, 0, TAU); ctx.fill();
    ctx.restore();
  },
});

emojiCursor('puppy', 'Puppy', '🐶');
emojiCursor('bunny', 'Bunny', '🐰', 'hop');
emojiCursor('teddy', 'Teddy Bear', '🐻');
emojiCursor('panda', 'Panda', '🐼', 'wiggle');
emojiCursor('fox', 'Fox', '🦊');
emojiCursor('froggy', 'Froggy', '🐸', 'hop');
emojiCursor('duck', 'Duck', '🦆', 'waddle');
emojiCursor('unicorn', 'Unicorn', '🦄');
emojiCursor('hamster', 'Hamster', '🐹', 'wiggle');
emojiCursor('pizza', 'Pizza', '🍕');
emojiCursor('donut', 'Donut', '🍩', 'spin');
emojiCursor('cookie', 'Cookie', '🍪');
emojiCursor('ice-cream', 'Ice Cream', '🍦');
emojiCursor('burger', 'Burger', '🍔', 'pulse');
emojiCursor('taco', 'Taco', '🌮');
emojiCursor('cupcake', 'Cupcake', '🧁');
emojiCursor('strawberry', 'Strawberry', '🍓', 'wiggle');

add({
  id: 'rainbow-arrow', name: 'Rainbow Arrow', cat: 'cute', hotspot: TIP, animated: true,
  draw(ctx, t) {
    const cols = ['#ff4d4d', '#ff9f1a', '#ffe14d', '#4dff88', '#4dc3ff', '#9d6bff'];
    ctx.save();
    arrowPath(ctx);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4; ctx.strokeStyle = '#2a2140'; ctx.stroke();
    ctx.clip();
    const band = 7, off = t * band * cols.length;
    for (let i = -cols.length; i < 14; i++) {
      ctx.fillStyle = cols[((i % cols.length) + cols.length) % cols.length];
      ctx.save();
      ctx.translate(0, -off % (band * cols.length));
      ctx.beginPath();
      ctx.moveTo(-10, i * band); ctx.lineTo(80, i * band - 20); ctx.lineTo(80, i * band - 20 + band); ctx.lineTo(-10, i * band + band);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    arrowPath(ctx);
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  },
});
add({
  id: 'sleepy-cloud', name: 'Sleepy Cloud', cat: 'cute', hotspot: MINI_TIP,
  draw(ctx) {
    miniArrow(ctx, '#dff3ff');
    cloudPath(ctx, 41, 46, 38);
    outlineFill(ctx, '#ffffff', '#3a5a80', 2.2);
    ctx.strokeStyle = '#3a5a80'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(35, 45, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(46, 45, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,150,190,0.55)';
    ctx.beginPath(); ctx.arc(31, 49, 2.2, 0, TAU); ctx.arc(50, 49, 2.2, 0, TAU); ctx.fill();
  },
});

// ---------------------------------------------------------------- pixel / retro
// Pixel cursors live on a 16x16 grid; p = device pixels per cell.

function pixelSize(S) { return Math.max(1, Math.floor(S / 16)); }

const PX_ARROW = [
  'k.........',
  'kk........',
  'kwk.......',
  'kwwk......',
  'kwwwk.....',
  'kwwwwk....',
  'kwwwwwk...',
  'kwwwwwwk..',
  'kwwwwwwwk.',
  'kwwwwwkkkk',
  'kwwkwwk...',
  'kwk.kwwk..',
  'kk..kwwk..',
  'k....kwwk.',
  '.....kwwk.',
  '......kk..',
];
const PX_MINI_ARROW = [
  'k.....',
  'kk....',
  'kwk...',
  'kwwk..',
  'kwwwk.',
  'kwwwwk',
  'kwwkkk',
  'kwk...',
  'kk....',
];
function pxArrow(id, name, fill, outline, glow) {
  add({
    id, name, cat: 'pixel', px: true, hotspot: [0, 0],
    draw(ctx, t, H, S) {
      const p = pixelSize(S);
      if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = p * 3; }
      drawGrid(ctx, PX_ARROW, { k: outline, w: fill }, 0, 0, p);
      ctx.shadowBlur = 0;
    },
  });
}
pxArrow('px-classic', 'Classic 95', '#ffffff', '#000000');
pxArrow('px-dark', 'Classic Dark', '#000000', '#ffffff');
pxArrow('px-gameboy', 'Game Boy', '#9bbc0f', '#0f380f');
pxArrow('px-amber', 'Amber CRT', '#ffb000', '#3a2000', 'rgba(255,176,0,0.8)');

add({
  id: 'px-hand', name: 'Pixel Hand', cat: 'pixel', px: true, hotspot: [3, 0],
  draw(ctx, t, H, S) {
    const rows = [
      '...kk......',
      '..kwwk.....',
      '..kwwk.....',
      '..kwwk.....',
      '..kwwkkk...',
      '..kwwkwwkk.',
      'kkkwwkwwkwk',
      'kwwkwwwwwwk',
      'kwwwwwwwwwk',
      '.kwwwwwwwwk',
      '..kwwwwwwwk',
      '..kwwwwwwk.',
      '...kwwwwwk.',
      '...kwwwwk..',
      '...kkkkkk..',
    ];
    drawGrid(ctx, rows, { k: '#000', w: '#fff' }, pixelSize(S), 0, pixelSize(S));
  },
});

// Diagonal pixel sword generated from a material palette.
function pxSwordRows() {
  const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
  for (let i = 1; i <= 9; i++) {
    g[i][i] = 'B';
    if (i + 1 < 16) g[i][i + 1] = 'b';
    if (i - 1 >= 0 && i > 1) g[i][i - 1] = 'b';
  }
  g[0][0] = 'b'; g[0][1] = 'b'; g[1][0] = 'b';
  for (let d = -3; d <= 3; d++) {
    const x = 10 + d, y = 10 - d;
    if (x >= 0 && y >= 0 && x < 16 && y < 16) g[y][x] = 'g';
  }
  g[11][11] = 'h'; g[12][12] = 'h'; g[11][12] = 'H'; g[12][11] = 'H';
  g[13][13] = 'p'; g[14][14] = 'p'; g[13][14] = 'p'; g[14][13] = 'p';
  return g.map((r) => r.join(''));
}
const PX_SWORD = autoOutline(pxSwordRows());
const SWORD_MATERIALS = [
  ['wood', 'Wood Sword', '#c49a5a', '#8a6232'],
  ['stone', 'Stone Sword', '#a4a4a4', '#6d6d6d'],
  ['iron', 'Iron Sword px', '#ffffff', '#c6c6c6'],
  ['gold', 'Gold Sword px', '#fff27a', '#e0b320'],
  ['diamond', 'Diamond Sword px', '#8ff6ff', '#2cc7d6'],
];
for (const [mid, name, b, B] of SWORD_MATERIALS) {
  add({
    id: `px-sword-${mid}`, name, cat: 'pixel', px: true, hotspot: [1, 1],
    draw(ctx, t, H, S) {
      drawGrid(ctx, PX_SWORD, { k: '#1a1a1a', b, B, g: '#5a3a1e', h: '#8a5a2b', H: '#5a3a1e', p: '#3d2a14' }, 0, 0, pixelSize(S));
    },
  });
}

const PX_PICKAXE = autoOutline([
  'dddd......',
  'DDDDd.....',
  '...dDh....',
  '....dDh...',
  '.....hh...',
  '...d..hh..',
  '...d...hh.',
  '...d....hh',
]);
add({
  id: 'px-pickaxe', name: 'Pixel Pickaxe', cat: 'pixel', px: true, hotspot: [1, 1],
  draw(ctx, t, H, S) {
    drawGrid(ctx, PX_PICKAXE, { k: '#1a1a1a', d: '#5ff2ff', D: '#2ab7c6', h: '#8a5a2b' }, 0, 0, pixelSize(S));
  },
});

// Companion pixel cursors: mini arrow + sprite; sprite frames animate with t.
function pxCompanion(id, name, frames, palette, opts = {}) {
  const outlined = frames.map((f) => autoOutline(f));
  add({
    id, name, cat: 'pixel', px: true, hotspot: [0, 0],
    animated: outlined.length > 1 || !!opts.animated,
    frames: opts.frameCount ?? (outlined.length > 1 ? outlined.length * 2 : 1),
    fps: opts.fps ?? 6,
    draw(ctx, t, H, S) {
      const p = pixelSize(S);
      drawGrid(ctx, PX_MINI_ARROW, { k: '#000', w: '#fff' }, 0, 0, p);
      const i = Math.floor(t * outlined.length) % outlined.length;
      const dy = opts.bob ? Math.round(Math.sin(t * TAU)) : 0;
      drawGrid(ctx, outlined[i], { k: '#111', ...palette }, 5 * p, (5 + dy) * p, p);
    },
  });
}

const HEART = ['.rr.rr.', 'rRrrrrr', 'rRrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const HEART_SMALL = ['.......', '.rr.rr.', '.rRrrr.', '.rrrrr.', '..rrr..', '...r...', '.......'];
pxCompanion('px-heart', 'Pixel Heart', [HEART, HEART_SMALL], { r: '#ff2a4d', R: '#ffb3c1' }, { fps: 4 });

const STAR = ['...y...', '...y...', 'yyyYyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.y...y.'];
const STAR_SHINE = ['...w...', '...y...', 'yyyWyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.y...y.'];
pxCompanion('px-star', 'Pixel Star', [STAR, STAR, STAR_SHINE], { y: '#ffd400', Y: '#fff6a0', w: '#ffffff', W: '#ffffff' }, { fps: 5 });

const COIN_A = ['.yyyy.', 'yYyyyo', 'yYyyyo', 'yYyyyo', 'yyyyyo', '.oooo.'];
const COIN_B = ['..yy..', '.yYyo.', '.yYyo.', '.yYyo.', '.yyyo.', '..oo..'];
const COIN_C = ['..yo..', '..yo..', '..yo..', '..yo..', '..yo..', '..yo..'];
pxCompanion('px-coin', 'Spinning Coin', [COIN_A, COIN_B, COIN_C, mirrorRows(COIN_B)], { y: '#ffcc00', Y: '#fff2a0', o: '#c98a00' }, { fps: 8, frameCount: 8 });

const GHOST_A = ['..www..', '.wwwww.', 'wwbwbww', 'wwbwbww', 'wwwwwww', 'wwwwwww', 'w.ww.ww'];
const GHOST_B = ['..www..', '.wwwww.', 'wwbwbww', 'wwbwbww', 'wwwwwww', 'wwwwwww', 'ww.ww.w'];
pxCompanion('px-ghost', 'Pixel Ghost', [GHOST_A, GHOST_B], { w: '#f2f2ff', b: '#2a3cff' }, { bob: true, fps: 4 });

const ALIEN_A = ['g.....g', '.g...g.', '.ggggg.', 'gwgggwg', 'ggggggg', '.g.g.g.', 'g.....g'];
const ALIEN_B = ['.g...g.', '.g...g.', '.ggggg.', 'gwgggwg', 'ggggggg', '.g.g.g.', '.g...g.'];
pxCompanion('px-alien', 'Pixel Alien', [ALIEN_A, ALIEN_B], { g: '#39ff14', w: '#ffffff' }, { fps: 3 });

pxCompanion('px-mushroom', 'Pixel Mushroom', [['..rrr..', '.rwrrw.', 'rrrrrrr', 'rwrrrwr', '..sss..', '..sss..']], { r: '#e52521', w: '#ffffff', s: '#ffe0b8' });

const POTION = (b) => ['..c..', '..c..', '.ggg.', 'gpppg', `gp${b}pg`, 'gpppg', '.ggg.'];
pxCompanion('px-potion', 'Pixel Potion', [POTION('p'), POTION('w'), POTION('p')], { c: '#8a5a2b', g: '#bde8ff', p: '#b13cff', w: '#f0c8ff' }, { fps: 4 });

pxCompanion('px-skull', 'Pixel Skull', [['.wwwww.', 'wwwwwww', 'w.ww.ww', 'w.ww.ww', 'wwwwwww', '.w.w.w.']], { w: '#f4f1e1' });
pxCompanion('px-key', 'Pixel Key', [['yyy......', 'y.yyyyyyy', 'yyy..y.y.']], { y: '#ffcc33' });

const GEM = (s) => ['.ccc.', `c${s}ccc`, 'ccccc', '.ccc.', '..c..'];
pxCompanion('px-gem', 'Pixel Gem', [GEM('c'), GEM('w'), GEM('c'), GEM('c')], { c: '#ff2ad4', w: '#ffffff' }, { fps: 5 });

const FIRE_A = ['..r...', '.rr.r.', '.rorr.', 'rooorr', 'royyor', '.ryyr.'];
const FIRE_B = ['...r..', '.r.rr.', '.rror.', 'rrooor', 'royyor', '.ryyr.'];
const FIRE_C = ['..r.r.', '..rr..', '.roor.', 'rooyor', 'royyor', '.ryyr.'];
pxCompanion('px-fire', 'Pixel Fire', [FIRE_A, FIRE_B, FIRE_C], { r: '#ff3b00', o: '#ff9500', y: '#fff04d' }, { fps: 8 });

const HG = (top, bot) => ['wwwww', `.${top}.`, '..s..', `.${bot}.`, 'wwwww'];
pxCompanion('px-hourglass', 'Hourglass',
  [HG('sss', '...'), HG('.s.', '.s.'), HG('...', 'sss'), HG('...', 'sss')],
  { w: '#c9a26b', s: '#ffd96b' }, { fps: 4 });

add({
  id: 'px-terminal', name: 'Terminal', cat: 'pixel', px: true, hotspot: [0, 0], animated: true, frames: 2, fps: 2,
  draw(ctx, t, H, S) {
    const p = pixelSize(S);
    drawGrid(ctx, PX_MINI_ARROW, { k: '#003b00', w: '#33ff33' }, 0, 0, p);
    const rows = t < 0.5 ? ['g....', '.g...', '..g..', '.g...', 'g..gg'] : ['g....', '.g...', '..g..', '.g...', 'g....'];
    ctx.fillStyle = 'rgba(0,20,0,0.85)';
    ctx.fillRect(6 * p, 8 * p, 8 * p, 7 * p);
    drawGrid(ctx, rows, { g: '#33ff33' }, 7 * p, 9 * p, p);
  },
});
add({
  id: 'px-crosshair', name: '8-bit Crosshair', cat: 'pixel', px: true, hotspot: [6, 6],
  draw(ctx, t, H, S) {
    const rows = autoOutline([
      '.....r.....',
      '.....r.....',
      '...........',
      '...........',
      '...........',
      'rr...r...rr',
      '...........',
      '...........',
      '...........',
      '.....r.....',
      '.....r.....',
    ]);
    drawGrid(ctx, rows, { k: '#000', r: '#ff2a2a' }, pixelSize(S), pixelSize(S), pixelSize(S));
  },
});

export const CURSORS = list;
export const CURSOR_MAP = new Map(list.map((c) => [c.id, c]));
export const DEFAULT_CURSOR_ID = 'neon-cyan';

export function cursorsIn(cat) {
  return list.filter((c) => c.cat === cat);
}

// Hotspot in device pixels for a cursor rendered at S px.
export function hotspotPx(def, S) {
  if (def.px) {
    const p = pixelSize(S);
    // px-hand and px-crosshair draw with a one-cell offset.
    const off = def.id === 'px-hand' ? [1, 0] : def.id === 'px-crosshair' ? [1, 1] : [0, 0];
    return [(def.hotspot[0] + off[0]) * p + Math.floor(p / 2), (def.hotspot[1] + off[1]) * p + Math.floor(p / 2)];
  }
  return [def.hotspot[0] * (S / 64), def.hotspot[1] * (S / 64)];
}
