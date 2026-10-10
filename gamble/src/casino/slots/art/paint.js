// Canvas painting helpers for slot art: metal gradients, glossy fills with a dark ink outline,
// bevelled text, stars, sparkles. Everything is drawn at a 128-unit design size and scaled, so a
// symbol looks the same in a 64 px NPC screen and a 160 px close-up atlas.

export const TAU = Math.PI * 2;

export const FONTS = {
  display: '"Bebas Neue", "Inter", sans-serif',
  western: '"Rye", "Playfair Display", serif',
  serif: '"Playfair Display", Georgia, serif',
  neon: '"Monoton", "Bebas Neue", sans-serif',
  ui: '"Inter", system-ui, sans-serif',
};

let fontsPromise = null;
/** Resolve when the vendored fonts used by slot art are ready (or after a short timeout). */
export function slotFontsReady() {
  if (fontsPromise) return fontsPromise;
  if (typeof document === 'undefined' || !document.fonts?.load) return (fontsPromise = Promise.resolve(false));
  const faces = ['400 40px "Bebas Neue"', '400 40px "Rye"', '700 40px "Playfair Display"', 'italic 400 40px "Playfair Display"', '400 40px "Monoton"', '700 20px "Inter"', '600 20px "Inter"'];
  fontsPromise = Promise.race([
    Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))).then(() => true),
    new Promise((r) => setTimeout(() => r(false), 2500)),
  ]);
  return fontsPromise;
}

/** Metal palettes for linear gradients (top → bottom). */
export const METAL = {
  gold: ['#fff7cf', '#ffd862', '#e0a420', '#8f5a06', '#f6cf55', '#fff2b0'],
  goldDark: ['#f7d88a', '#c99227', '#8a5a0c', '#4a2c04', '#b07a1a', '#e9c060'],
  silver: ['#ffffff', '#d9dee4', '#9aa3ad', '#4d555f', '#c4ccd4', '#f4f7fa'],
  copper: ['#ffe0c4', '#f0a060', '#b5592a', '#5a2410', '#d8804a', '#ffd2a8'],
  steel: ['#e8ecef', '#b4bcc4', '#7d8791', '#3a4048', '#9aa4ae', '#d5dbe0'],
  jade: ['#d9ffe9', '#63d69a', '#178a52', '#063d22', '#3cb877', '#bff5d6'],
  ruby: ['#ffd0d0', '#ff4a4a', '#c3101c', '#5a0208', '#e0303a', '#ffb0b0'],
};

export function metalGrad(g, x0, y0, x1, y1, pal = METAL.gold) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  const stops = [0, 0.22, 0.48, 0.52, 0.8, 1];
  pal.forEach((c, i) => gr.addColorStop(stops[i], c));
  return gr;
}

export function vGrad(g, y0, y1, ...colors) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  colors.forEach((c, i) => gr.addColorStop(i / Math.max(1, colors.length - 1), c));
  return gr;
}

export function rGrad(g, x, y, r0, r1, ...colors) {
  const gr = g.createRadialGradient(x, y, r0, x, y, r1);
  colors.forEach((c, i) => gr.addColorStop(i / Math.max(1, colors.length - 1), c));
  return gr;
}

/**
 * The signature slot-symbol look: drop shadow, thick dark ink outline, gradient body, inner rim
 * highlight and a glossy top sheen clipped to the shape.
 */
export function inked(g, path, fill, { ink = '#1a0c06', inkW = 7, rim = 'rgba(255,255,255,.55)', rimW = 2, gloss = 0.45, shadow = true, bounds = null } = {}) {
  g.save();
  if (shadow) {
    g.shadowColor = 'rgba(0,0,0,.55)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 4;
  }
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = ink;
  g.lineWidth = inkW;
  g.stroke(path);
  g.restore();
  g.save();
  g.fillStyle = fill;
  g.fill(path);
  if (rim) {
    g.clip(path);
    g.strokeStyle = rim;
    g.lineWidth = rimW * 2;
    g.stroke(path);
  }
  g.restore();
  if (gloss > 0) sheen(g, path, gloss, bounds);
}

/** Glossy elliptical highlight across the top of a shape. */
export function sheen(g, path, amount = 0.45, bounds = null) {
  const b = bounds || { x: 0, y: 0, w: 128, h: 128 };
  g.save();
  g.clip(path);
  const gr = g.createLinearGradient(0, b.y, 0, b.y + b.h * 0.55);
  gr.addColorStop(0, `rgba(255,255,255,${amount})`);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(b.x + b.w * 0.45, b.y + b.h * 0.08, b.w * 0.62, b.h * 0.42, -0.12, 0, TAU);
  g.fill();
  g.restore();
}

export function star(cx, cy, points, rOut, rIn, rot = -Math.PI / 2) {
  const p = new Path2D();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) p.lineTo(x, y);
    else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

export function roundRectPath(x, y, w, h, r) {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
}

export function circlePath(x, y, r) {
  const p = new Path2D();
  p.arc(x, y, r, 0, TAU);
  return p;
}

/** Four-point twinkle. */
export function sparkle(g, x, y, r, alpha = 1, color = '255,255,240') {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${color},${alpha})`);
  gr.addColorStop(0.25, `rgba(${color},${alpha * 0.35})`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = `rgba(${color},${alpha})`;
  g.beginPath();
  g.moveTo(x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.fill();
  g.restore();
}

/** Bevelled display text: dark ink outline, gradient fill, thin bright inner line. */
export function bevelText(g, text, x, y, { font, fill, ink = '#1a0c06', inkW = 8, inner = 'rgba(255,255,255,.6)', innerW = 1.5, shadow = true, align = 'center', baseline = 'middle', maxW = 0, tracking = 0 } = {}) {
  g.save();
  g.font = font;
  g.textAlign = align;
  g.textBaseline = baseline;
  if (tracking && 'letterSpacing' in g) g.letterSpacing = `${tracking}px`;
  if (maxW) {
    const w = g.measureText(text).width;
    if (w > maxW) {
      g.translate(x, y);
      g.scale(maxW / w, 1);
      g.translate(-x, -y);
    }
  }
  g.lineJoin = 'round';
  if (shadow) {
    g.shadowColor = 'rgba(0,0,0,.6)';
    g.shadowBlur = 6;
    g.shadowOffsetY = 3;
  }
  if (inkW) {
    g.strokeStyle = ink;
    g.lineWidth = inkW;
    g.strokeText(text, x, y);
  }
  g.shadowColor = 'transparent';
  g.fillStyle = fill;
  g.fillText(text, x, y);
  if (inner) {
    g.strokeStyle = inner;
    g.lineWidth = innerW;
    g.strokeText(text, x, y);
  }
  g.restore();
}

/** A gem-cut facet look inside a path (for diamonds / jewels). */
export function facets(g, cx, cy, r, n, alpha = 0.25) {
  g.save();
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * TAU;
    const a1 = ((i + 1) / n) * TAU;
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.9)' : 'rgba(0,0,0,.5)';
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    g.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Deterministic tiny PRNG for art details (grain, speckles). */
export function artRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Fine print grain over the current canvas region (keeps flat fills from looking digital). */
export function grain(g, x, y, w, h, amount = 10, seed = 7) {
  const img = g.getImageData(x, y, w, h);
  const d = img.data;
  const r = artRng(seed);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const n = (r() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, x, y);
}
