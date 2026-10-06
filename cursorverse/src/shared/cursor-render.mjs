// Turns a cursor definition + customizer settings into RGBA frames.
// Runs in any renderer (UI previews and the hidden engine window).
import { CURSOR_MAP, DEFAULT_CURSOR_ID, hotspotPx } from './cursor-library.mjs';
import { makeHelpers, TAU, rng } from './draw-helpers.mjs';

export const ANIMATIONS = [
  { id: 'none', name: 'None' },
  { id: 'pulse', name: 'Pulse' },
  { id: 'spin', name: 'Spin' },
  { id: 'bounce', name: 'Bounce' },
  { id: 'wobble', name: 'Wobble' },
  { id: 'swing', name: 'Swing' },
  { id: 'float', name: 'Float' },
  { id: 'shake', name: 'Shake' },
  { id: 'flicker', name: 'Flicker' },
  { id: 'rainbow', name: 'Rainbow colors' },
];

export const DEFAULT_CURSOR_SETTINGS = {
  id: DEFAULT_CURSOR_ID,
  size: 32,
  colorMode: 'original', // original | tint | rainbow
  hue: 0,
  saturation: 100,
  brightness: 100,
  tint: '#ff2bd6',
  glow: { enabled: false, color: '#00e5ff', size: 6 },
  outline: { enabled: false, color: '#000000', width: 2 },
  anim: 'none',
  animSpeed: 1,
};

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const imageCache = new Map();
async function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const p = (async () => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  })();
  imageCache.set(src, p);
  return p;
}

// Custom cursors (pixel editor / uploads) are records of data-URL frames.
export async function customToDef(rec) {
  const images = await Promise.all(rec.frames.map(loadImage));
  const n = images.length;
  return {
    id: rec.id,
    name: rec.name,
    custom: true,
    animated: n > 1,
    frames: n,
    fps: rec.fps || 8,
    w: rec.w,
    h: rec.h,
    smooth: !!rec.smooth,
    hotspotSrc: rec.hotspot || [0, 0],
    images,
  };
}

function customLayout(def, S) {
  const scale = def.smooth ? Math.min(S / def.w, S / def.h) : Math.max(1, Math.floor(Math.min(S / def.w, S / def.h))) || Math.min(S / def.w, S / def.h);
  return { scale, dw: def.w * scale, dh: def.h * scale };
}

export function resolveDef(id, customDefs) {
  if (id && id.startsWith('custom:')) {
    const d = customDefs?.get?.(id);
    if (d) return d;
  }
  return CURSOR_MAP.get(id) || CURSOR_MAP.get(DEFAULT_CURSOR_ID);
}

export function defHotspot(def, S) {
  if (def.custom) {
    const { scale } = customLayout(def, S);
    return [def.hotspotSrc[0] * scale, def.hotspotSrc[1] * scale];
  }
  return hotspotPx(def, S);
}

function drawBase(ctx, def, t, S) {
  ctx.save();
  if (def.custom) {
    const { dw, dh } = customLayout(def, S);
    ctx.imageSmoothingEnabled = def.smooth;
    const img = def.images[Math.min(def.images.length - 1, Math.floor(t * def.images.length))];
    ctx.drawImage(img, 0, 0, dw, dh);
  } else if (def.px) {
    ctx.imageSmoothingEnabled = false;
    def.draw(ctx, t, makeHelpers(1), S);
  } else {
    const k = S / 64;
    ctx.scale(k, k);
    def.draw(ctx, t, makeHelpers(k), S);
  }
  ctx.restore();
}

const FLICKER = [1, 1, 0.25, 1, 1, 1, 0.1, 1, 0.6, 1, 1, 1, 0.2, 1, 1, 1];

// Rotations pivot on the hotspot only when it sits near the middle (crosshairs);
// pivoting on a corner tip would swing the drawing out of the canvas.
function pivot(S, hx, hy) {
  const near = Math.hypot(hx - S / 2, hy - S / 2) < S * 0.25;
  return near ? [hx, hy] : [S / 2, S / 2];
}

function applyAnim(ctx, anim, t, S, hx, hy, seed) {
  const a = t * TAU;
  const [px, py] = pivot(S, hx, hy);
  const rotate = (ang, scale = 1) => {
    ctx.translate(px, py); ctx.rotate(ang); ctx.scale(scale, scale); ctx.translate(-px, -py);
  };
  switch (anim) {
    case 'pulse': {
      const s = 1 + 0.12 * Math.sin(a);
      ctx.translate(hx, hy); ctx.scale(s, s); ctx.translate(-hx, -hy);
      break;
    }
    case 'spin': rotate(a, px === hx && py === hy ? 1 : 0.72); break;
    case 'wobble': rotate(Math.sin(a) * 0.22, 0.92); break;
    case 'swing': rotate(Math.sin(a) * 0.45, 0.85); break;
    case 'bounce': ctx.translate(0, -Math.abs(Math.sin(a / 2)) * S * 0.1); break;
    case 'float': ctx.translate(0, Math.sin(a) * S * 0.05); break;
    case 'shake': {
      const r = rng(Math.floor(t * 64) + seed);
      ctx.translate((r() - 0.5) * S * 0.06, (r() - 0.5) * S * 0.06);
      break;
    }
    case 'flicker': ctx.globalAlpha = FLICKER[Math.floor(t * FLICKER.length) % FLICKER.length]; break;
    default: break;
  }
}

function drawBadge(ctx, variant, t, S, color) {
  if (variant === 'normal') return;
  const r = Math.max(3, S * 0.13);
  const cx = S - r - 1, cy = S - r - 1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = 'rgba(12,12,24,0.9)';
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  if (variant === 'link') {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, r * 0.28);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.4, cy + r * 0.4); ctx.lineTo(cx + r * 0.4, cy - r * 0.4);
    ctx.moveTo(cx - r * 0.05, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy + r * 0.05);
    ctx.stroke();
  } else if (variant === 'busy') {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, t * TAU, t * TAU + Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.restore();
}

export function frameCountFor(def, cfg, variant = 'normal') {
  const override = cfg.anim && cfg.anim !== 'none';
  const rainbow = cfg.colorMode === 'rainbow';
  if (!def.animated && !override && !rainbow && variant !== 'busy') return 1;
  let n = def.animated ? def.frames : 1;
  if (override || rainbow || variant === 'busy') n = Math.max(n, 16);
  return Math.min(n, 48);
}

export function fpsFor(def, cfg) {
  const base = def.animated ? def.fps : 14;
  return Math.max(1, Math.min(60, base * (Number(cfg.animSpeed) || 1)));
}

// Renders one frame into ctx (S x S). Used by previews and by buildFrames.
export function renderFrame(ctx, def, cfg, t, S, variant = 'normal', scratch) {
  const c = { ...DEFAULT_CURSOR_SETTINGS, ...cfg };
  const [hx, hy] = defHotspot(def, S);
  const a = scratch?.a || makeCanvas(S, S);
  const b = scratch?.b || makeCanvas(S, S);
  if (a.width !== S) { a.width = S; a.height = S; b.width = S; b.height = S; }
  const actx = a.getContext('2d');
  const bctx = b.getContext('2d');

  // 1. base drawing + motion
  actx.setTransform(1, 0, 0, 1, 0, 0);
  actx.globalAlpha = 1;
  actx.clearRect(0, 0, S, S);
  actx.save();
  applyAnim(actx, c.anim, t, S, hx, hy, 7);
  // the definition's own animation keeps running underneath the override
  drawBase(actx, def, def.animated ? t : 0, S);
  actx.restore();

  // 2. color
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, S, S);
  const hue = (Number(c.hue) || 0) + (c.colorMode === 'rainbow' ? t * 360 : 0);
  const filters = [];
  if (hue % 360 !== 0) filters.push(`hue-rotate(${hue}deg)`);
  if (Number(c.saturation) !== 100) filters.push(`saturate(${c.saturation}%)`);
  if (Number(c.brightness) !== 100) filters.push(`brightness(${c.brightness}%)`);
  bctx.filter = filters.length ? filters.join(' ') : 'none';
  bctx.drawImage(a, 0, 0);
  bctx.filter = 'none';
  if (c.colorMode === 'tint') {
    bctx.globalCompositeOperation = 'color';
    bctx.fillStyle = c.tint;
    bctx.fillRect(0, 0, S, S);
    bctx.globalCompositeOperation = 'destination-in';
    bctx.drawImage(a, 0, 0);
    bctx.globalCompositeOperation = 'source-over';
  }

  // 3. outline + glow, then the colored cursor on top
  ctx.save();
  ctx.clearRect(0, 0, S, S);
  if (c.outline?.enabled) {
    const w = Math.max(1, Number(c.outline.width) || 2) * (S / 48);
    actx.globalCompositeOperation = 'source-in';
    actx.fillStyle = c.outline.color;
    actx.fillRect(0, 0, S, S);
    actx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU;
      ctx.drawImage(a, Math.cos(ang) * w, Math.sin(ang) * w);
    }
  }
  if (c.glow?.enabled) {
    ctx.shadowColor = c.glow.color;
    ctx.shadowBlur = Math.max(0, Number(c.glow.size) || 6) * (S / 48) * 1.6;
    ctx.drawImage(b, 0, 0);
    ctx.shadowBlur = 0;
  }
  ctx.drawImage(b, 0, 0);
  drawBadge(ctx, variant, t, S, c.glow?.enabled ? c.glow.color : '#00e5ff');
  ctx.restore();
  return [hx, hy];
}

// Full build: returns { frames: [{width,height,data}], hotspot, fps }.
export function buildFrames(def, cfg, S, variant = 'normal') {
  const n = frameCountFor(def, cfg, variant);
  const out = makeCanvas(S, S);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  const scratch = { a: makeCanvas(S, S), b: makeCanvas(S, S) };
  const frames = [];
  let hotspot = [0, 0];
  for (let i = 0; i < n; i++) {
    hotspot = renderFrame(ctx, def, cfg, i / n, S, variant, scratch);
    const img = ctx.getImageData(0, 0, S, S);
    frames.push({ width: S, height: S, data: img.data });
  }
  return { frames, hotspot, fps: fpsFor(def, cfg) };
}
