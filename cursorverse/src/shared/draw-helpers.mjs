// Drawing helpers shared by the cursor library, effects and backgrounds.
// Vector cursors draw inside a 64x64 "unit" box; `k` is device px per unit.

export const TAU = Math.PI * 2;

export const ARROW = [[6, 6], [6, 50], [17, 40], [25, 58], [33, 54], [25, 37], [40, 37]];

export function pathPoly(ctx, pts, ox = 0, oy = 0, s = 1) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = ox + x * s, py = oy + y * s;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

// Arrow with its tip at (ox + 6s, oy + 6s).
export function arrowPath(ctx, s = 1, ox = 0, oy = 0) {
  pathPoly(ctx, ARROW, ox - 6 * s + 6, oy - 6 * s + 6, s);
}

export function hsl(h, s = 100, l = 50, a = 1) {
  return `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`;
}

export function makeHelpers(k) {
  return {
    k,
    glow(ctx, color, units) {
      ctx.shadowColor = color;
      ctx.shadowBlur = Math.max(0, units * k);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    },
    noGlow(ctx) {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    },
  };
}

// Deterministic pseudo-random numbers so animated frames never jitter between builds.
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function starPath(ctx, cx, cy, spikes, outer, inner, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / spikes;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function heartPath(ctx, cx, cy, size) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.4, cy - s * 0.1, cx - s * 0.75, cy - s * 1.25, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.75, cy - s * 1.25, cx + s * 1.4, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
}

// Four-point twinkle.
export function sparklePath(ctx, cx, cy, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.28;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function cloudPath(ctx, cx, cy, w) {
  const r = w / 4;
  ctx.beginPath();
  ctx.arc(cx - r * 1.2, cy + r * 0.2, r * 0.9, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(cx - r * 0.3, cy - r * 0.6, r * 1.05, Math.PI * 1.0, Math.PI * 1.85);
  ctx.arc(cx + r * 0.9, cy - r * 0.1, r * 0.95, Math.PI * 1.3, Math.PI * 0.5);
  ctx.closePath();
}

// Jagged bolt between two points, jitter picked from `rand`.
export function boltPoints(x1, y1, x2, y2, segments, jitter, rand) {
  const pts = [[x1, y1]];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  for (let i = 1; i < segments; i++) {
    const f = i / segments;
    const off = (rand() - 0.5) * 2 * jitter;
    pts.push([x1 + dx * f + nx * off, y1 + dy * f + ny * off]);
  }
  pts.push([x2, y2]);
  return pts;
}

export function strokePts(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
}

// Teardrop flame whose tip wobbles with t (0..1).
export function flamePath(ctx, x, y, w, h, t, seed = 0) {
  const wob = Math.sin((t + seed) * TAU) * w * 0.25;
  const wob2 = Math.cos((t * 2 + seed) * TAU) * w * 0.12;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + w * 0.6 + wob2, y - h * 0.15, x + w * 0.35 + wob, y - h * 0.6, x + wob, y - h);
  ctx.bezierCurveTo(x - w * 0.35 + wob, y - h * 0.6, x - w * 0.6 - wob2, y - h * 0.15, x, y);
  ctx.closePath();
}

// Color emoji centred on (cx, cy). Windows ships Segoe UI Emoji.
export function drawEmoji(ctx, ch, cx, cy, size) {
  ctx.save();
  ctx.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, cx, cy + size * 0.06);
  ctx.restore();
}

// ---------- pixel art ----------

// Adds a 1px outline (key 'k') around every painted cell of a grid.
export function autoOutline(rows, outlineKey = 'k') {
  const h = rows.length + 2;
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const src = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (y >= 1 && y <= rows.length ? rows[y - 1][x - 1] || '.' : '.')));
  const out = src.map((r) => r.slice());
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y][x] !== '.') continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const c = src[y + dy]?.[x + dx];
        return c && c !== '.';
      });
      if (n) out[y][x] = outlineKey;
    }
  }
  return out.map((r) => r.join(''));
}

// Paints rows of palette keys; '.' is transparent. (x, y, p) are device pixels.
export function drawGrid(ctx, rows, palette, x, y, p) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const col = palette[row[c]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x + c * p, y + r * p, p, p);
    }
  }
}

export function mirrorRows(rows) {
  return rows.map((r) => r.split('').reverse().join(''));
}
