// Small canvas charts: the life timeline, spectra, transit light curves,
// the cross-section of a world, and a telescope's blurry view of a planet.
import { LIFE_STAGES } from '../world/life.js';
import * as F from '../core/format.js';

const INK = '#e8ecf2', DIM = '#8a93a5', LINE = 'rgba(232,236,242,0.12)';

export function setupCanvas(cv, h = null) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = cv.clientWidth || 600;
  const hh = h || cv.clientHeight || 180;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(hh * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hh);
  ctx.font = '400 11px "IBM Plex Mono", ui-monospace, monospace';
  return { ctx, w, h: hh };
}

function css(name, fallback) {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim();
  return v || fallback;
}

// stages of life over the age of your world, with mass extinctions marked
export function drawLifeTimeline(cv, life, ageNow) {
  const { ctx, w, h } = setupCanvas(cv);
  const padL = 112, padR = 12, padT = 10, padB = 24;
  const n = LIFE_STAGES.length;
  const X = (y) => padL + (w - padL - padR) * Math.min(1, y / Math.max(ageNow, 1));
  const Y = (s) => padT + (h - padT - padB) * (1 - s / (n - 1));
  ctx.strokeStyle = LINE;
  ctx.fillStyle = DIM;
  ctx.textBaseline = 'middle';
  for (let s = 0; s < n; s++) {
    const y = Y(s);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    if (s % 1 === 0 && (h > 220 || s % 2 === 0 || s === n - 1)) ctx.fillText(LIFE_STAGES[s].short, 6, y);
  }
  // time axis
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const yv = (ageNow * i) / 4;
    const x = X(yv);
    ctx.fillText(i === 0 ? 'formed' : F.yearsShort(yv), Math.min(x - (i === 0 ? 0 : 20), w - 60), h - padB + 8);
  }
  const lifeCol = css('--life', '#9be37a');
  const bad = css('--danger', '#ff5a4e');
  // the step line
  const tl = life.timeline || [];
  ctx.strokeStyle = lifeCol;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let s = 0, x0 = X(0);
  ctx.moveTo(x0, Y(0));
  for (const ev of tl) {
    const x = X(ev.years);
    ctx.lineTo(x, Y(s));
    ctx.lineTo(x, Y(ev.stage));
    s = ev.stage;
  }
  ctx.lineTo(X(ageNow), Y(s));
  ctx.stroke();
  ctx.lineWidth = 1;
  // extinctions
  for (const ex of life.extinctions || []) {
    const x = X(ex.years);
    ctx.strokeStyle = bad;
    ctx.globalAlpha = 0.4 + 0.6 * Math.min(1, ex.k);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// molecules and where they absorb (micrometres), for spectra
const BANDS = {
  h2o: [[0.94, 0.03, 0.4], [1.13, 0.04, 0.5], [1.4, 0.08, 0.9], [1.9, 0.1, 1], [2.7, 0.15, 1]],
  co2: [[1.6, 0.04, 0.3], [2.0, 0.06, 0.5], [2.7, 0.08, 0.6], [4.3, 0.15, 1.2]],
  ch4: [[1.15, 0.04, 0.3], [1.7, 0.06, 0.6], [2.3, 0.1, 0.8], [3.3, 0.15, 1.1]],
  o2: [[0.69, 0.01, 0.4], [0.76, 0.015, 0.9], [1.27, 0.02, 0.5]],
  o3: [[0.6, 0.12, 0.35]],
  na: [[0.589, 0.012, 1.2]],
  co: [[2.35, 0.05, 0.4], [4.6, 0.12, 0.8]],
  nh3: [[1.5, 0.05, 0.4], [2.0, 0.05, 0.4], [3.0, 0.1, 0.6]],
};
const MOL_NAMES = { h2o: 'H₂O', co2: 'CO₂', ch4: 'CH₄', o2: 'O₂', o3: 'O₃', na: 'Na', co: 'CO', nh3: 'NH₃' };

// abundances: { h2o, co2, ch4, o2, o3, na, co, nh3 } as 0..1 strengths; haze: 0..1 flattens features
export function drawSpectrum(cv, ab, opts = {}) {
  const { ctx, w, h } = setupCanvas(cv);
  const padL = 40, padR = 10, padT = 18, padB = 24;
  const lo = 0.5, hi = 5;
  const X = (um) => padL + (w - padL - padR) * (Math.log(um / lo) / Math.log(hi / lo));
  const N = 260;
  const vals = [];
  const haze = opts.haze || 0;
  for (let i = 0; i < N; i++) {
    const um = lo * Math.pow(hi / lo, i / (N - 1));
    // Rayleigh scattering rises toward blue light
    let v = 0.25 * Math.pow(0.6 / um, 4) * (opts.rayleigh ?? 0.5);
    for (const [k, bands] of Object.entries(BANDS)) {
      const a = ab[k] || 0;
      if (a <= 0) continue;
      for (const [c, wd, s] of bands) v += a * s * Math.exp(-(((um - c) / wd) ** 2));
    }
    v = v * (1 - haze * 0.75) + haze * 0.35;
    vals.push([um, v]);
  }
  const vmax = Math.max(1.2, ...vals.map((q) => q[1])) * 1.1;
  const Y = (v) => padT + (h - padT - padB) * (1 - v / vmax);
  ctx.strokeStyle = LINE;
  ctx.fillStyle = DIM;
  ctx.textBaseline = 'top';
  for (const um of [0.5, 0.7, 1, 1.5, 2, 3, 4, 5]) {
    const x = X(um);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
    ctx.fillText(`${um}`, x - 6, h - padB + 6);
  }
  ctx.save();
  ctx.translate(10, h / 2 + 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('absorbed →', 0, 0);
  ctx.restore();
  ctx.fillText('µm', w - padR - 16, h - padB + 6);
  // noise like a real instrument
  const noise = opts.noise ?? 0.04;
  ctx.fillStyle = css('--info', '#8cc8ff');
  for (let i = 0; i < vals.length; i += 5) {
    const [um, v] = vals[i];
    const nv = v + (Math.sin(i * 12.9898 + (opts.seed || 1)) * 43758.5453 % 1) * noise;
    ctx.fillRect(X(um) - 1.5, Y(nv) - 1.5, 3, 3);
  }
  ctx.strokeStyle = css('--amber', '#ffb24a');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  vals.forEach(([um, v], i) => (i ? ctx.lineTo(X(um), Y(v)) : ctx.moveTo(X(um), Y(v))));
  ctx.stroke();
  ctx.lineWidth = 1;
  // label the strongest feature of each molecule present
  ctx.fillStyle = INK;
  ctx.textBaseline = 'bottom';
  const placed = [];
  for (const [k, bands] of Object.entries(BANDS)) {
    if ((ab[k] || 0) < 0.08) continue;
    const b = bands.reduce((a, c) => (c[2] > a[2] ? c : a));
    const x = X(b[0]);
    let y = Y((vals.find((q) => q[0] >= b[0]) || [0, 0])[1]) - 4;
    for (const p of placed) if (Math.abs(p[0] - x) < 34 && Math.abs(p[1] - y) < 12) y -= 12;
    placed.push([x, y]);
    ctx.fillText(MOL_NAMES[k], x - 10, Math.max(12, y));
  }
}

// brightness of a star over a transit: a dip as the planet crosses
export function drawLightCurve(cv, depth, opts = {}) {
  const { ctx, w, h } = setupCanvas(cv);
  const padL = 52, padR = 10, padT = 12, padB = 24;
  const dur = 0.24;
  const d = Math.max(depth, 1e-6);
  const span = Math.max(d * 1.6, 2e-4);
  const Y = (v) => padT + (h - padT - padB) * ((1 - v) / span + 0.12);
  const X = (t) => padL + (w - padL - padR) * t;
  ctx.strokeStyle = LINE;
  ctx.fillStyle = DIM;
  ctx.textBaseline = 'middle';
  for (const v of [1, 1 - d]) {
    ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - padR, Y(v)); ctx.stroke();
    ctx.fillText(v === 1 ? '100%' : `-${F.nice(d * 100)}%`, 2, Y(v));
  }
  ctx.textBaseline = 'top';
  ctx.fillText(`time → (${opts.hours ? `${F.nice(opts.hours)} h transit` : 'transit'})`, padL, h - padB + 8);
  const pts = 180;
  const noise = d * 0.08 + 2e-5;
  ctx.fillStyle = css('--info', '#8cc8ff');
  for (let i = 0; i < pts; i++) {
    const t = i / (pts - 1);
    const x = (t - 0.5) / dur;
    let v = 1;
    if (Math.abs(x) < 0.5) {
      // limb darkening rounds the bottom of the dip
      const r = Math.min(1, Math.abs(x) * 2);
      v = 1 - d * (1 - 0.35 * r * r);
    } else if (Math.abs(x) < 0.56) {
      v = 1 - d * (1 - (Math.abs(x) - 0.5) / 0.06) * 0.65;
    }
    const n = ((Math.sin(i * 91.7 + (opts.seed || 3)) * 43758.5453) % 1) * noise;
    ctx.fillRect(X(t) - 1.5, Y(v + n) - 1.5, 3, 3);
  }
}

// a slice through a world: layers from the centre out, with a probe marker
export function drawCrossSection(cv, struct, probeF = null, t = 0) {
  const { ctx, w, h } = setupCanvas(cv);
  const R = Math.min(w * 0.42, h * 0.46);
  const cx = w * 0.5, cy = h * 0.52;
  const layers = struct.layers;
  // the uncut lower half shows your outside
  const top = layers[layers.length - 1].color.map((x) => Math.round(Math.min(1, x) * 255 * 0.5));
  const outer = ctx.createRadialGradient(cx - R * 0.3, cy + R * 0.2, R * 0.1, cx, cy, R);
  outer.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
  outer.addColorStop(1, 'rgb(8,9,12)');
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  // draw from the outside in
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    const c = L.color.map((x) => Math.round(Math.min(1, x) * 255));
    const r = R * L.r1;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, `rgb(${c[0]},${c[1]},${c[2]})`);
    g.addColorStop(1, `rgb(${Math.round(c[0] * 0.7)},${Math.round(c[1] * 0.7)},${Math.round(c[2] * 0.7)})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, Math.PI * 1.0, Math.PI * 2.0);
    ctx.closePath();
    ctx.fill();
    // convection cells in fluid layers
    if (/convect|magma|outer|Liquid|metal|Molecular|envelope|mantle/i.test(L.name)) {
      const r0 = i > 0 ? R * layers[i - 1].r1 : 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      const cells = 7;
      for (let k = 0; k < cells; k++) {
        const a = Math.PI + (Math.PI * (k + 0.5)) / cells;
        const rr = (r + r0) / 2;
        const rad = Math.max(2, (r - r0) * 0.35);
        ctx.beginPath();
        const ph = t * 0.6 * (k % 2 ? 1 : -1);
        ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, rad, ph, ph + Math.PI * 1.5);
        ctx.stroke();
      }
    }
  }
  // labels on the right half
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  let lastY = 1e9;
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    const r0 = i > 0 ? layers[i - 1].r1 : 0;
    const rm = (L.r1 + r0) / 2;
    let y = cy - R * rm * 0.25 - 10;
    const x = cx + R * rm;
    y = Math.min(y, lastY - 14);
    lastY = y;
    ctx.strokeStyle = 'rgba(232,236,242,0.35)';
    ctx.beginPath(); ctx.moveTo(x, cy - 2); ctx.lineTo(x, y + 6); ctx.stroke();
    ctx.fillText(L.name, Math.min(x + 4, w - ctx.measureText(L.name).width - 4), y);
  }
  // the probe
  if (probeF != null) {
    const y = cy - R * probeF;
    ctx.strokeStyle = css('--info', '#8cc8ff');
    ctx.beginPath(); ctx.moveTo(cx, cy - R * 1.08); ctx.lineTo(cx, y); ctx.stroke();
    ctx.fillStyle = css('--info', '#8cc8ff');
    ctx.beginPath(); ctx.arc(cx, y, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(232,236,242,0.25)';
  ctx.beginPath(); ctx.moveTo(cx - R - 6, cy); ctx.lineTo(cx + R + 6, cy); ctx.stroke();
}

// what a telescope sees of a distant world: a few blurry pixels of colour
export function drawBlurryWorld(cv, look, seed = 1, opts = {}) {
  const { ctx, w, h } = setupCanvas(cv);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const px = opts.pixels || 18;
  const cell = Math.min(w, h) / px;
  const ox = (w - cell * px) / 2, oy = (h - cell * px) / 2;
  const pal = look.pal || [[0.4, 0.4, 0.4], [0.5, 0.5, 0.5], [0.6, 0.6, 0.6]];
  const phase = opts.phase ?? 0.6;
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const rr = px * 0.3 * (opts.size || 1);
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const x = (i + 0.5 - px / 2) / rr, y = (j + 0.5 - px / 2) / rr;
    const d = Math.hypot(x, y);
    // a soft disk smeared by the telescope's blur
    let v = Math.exp(-Math.pow(Math.max(0, d - 0.6) * 1.8, 2)) * (d < 1.6 ? 1 : 0.3);
    const lit = Math.min(1, Math.max(0, (x * Math.cos(phase) + 0.6) * 0.9 + 0.3));
    v *= lit;
    const band = (Math.sin(y * 7 + seed) * 0.5 + 0.5);
    let c;
    if (look.ocean > 0.3 && rnd() < look.ocean) c = [0.08, 0.22, 0.5];
    else c = pal[Math.floor(band * 2.99)] || pal[0];
    if (look.clouds > 0.3 && rnd() < look.clouds * 0.7) c = [0.85, 0.85, 0.85];
    const n = 0.85 + rnd() * 0.3;
    const g = (k) => Math.round(Math.min(255, (c[k] * v * n + rnd() * 0.04) * 255 * 1.4));
    ctx.fillStyle = `rgb(${g(0)},${g(1)},${g(2)})`;
    ctx.fillRect(ox + i * cell, oy + j * cell, Math.ceil(cell), Math.ceil(cell));
  }
  // the star's glare blocked by a coronagraph
  if (opts.coronagraph) {
    ctx.strokeStyle = 'rgba(140,200,255,0.35)';
    ctx.strokeRect(ox, oy, cell * px, cell * px);
  }
}
