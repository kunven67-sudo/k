'use strict';
/* =====================================================================
   BLOOD MOON HUNTER — a first-person monster hunting game in one file.
   3D by three.js (MIT). Everything else (world, models, music, sound)
   is generated in code.
   ===================================================================== */

// ---------- small helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const chance = (p) => Math.random() < p;
const TAU = Math.PI * 2;
const dist2 = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const smooth = (t) => t * t * (3 - 2 * t);
const smoothstep = (a, b, x) => smooth(clamp((x - a) / (b - a), 0, 1));
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function weighted(list, r = Math.random) {
  let tot = 0; for (const e of list) tot += e[1];
  let x = r() * tot; for (const e of list) { if ((x -= e[1]) < 0) return e[0]; }
  return list[list.length - 1][0];
}
const hash2 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const fmtDate = (ts) => {
  if (!ts) return 'never';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
const fmtNum = (n) => Math.floor(n).toLocaleString();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (s) => (/wolf$/i.test(s) ? s.slice(0, -1) + 'ves' : /[^aeiou]y$/i.test(s) ? s.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/i.test(s) ? s + 'es' : s + 's');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

// ---------- noise (seeded value noise + fbm) ----------
const NOISE_SEED = 1337;
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s + NOISE_SEED), b = hash2(xi + 1, yi, s + NOISE_SEED), c = hash2(xi, yi + 1, s + NOISE_SEED), d = hash2(xi + 1, yi + 1, s + NOISE_SEED);
  return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
}
function fbm(x, y, oct = 5, s = 0) { let a = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { a += vnoise(x * f, y * f, s + i * 17) * amp; n += amp; amp *= 0.5; f *= 2.03; } return a / n; }
function ridged(x, y, oct = 4, s = 0) { let a = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { a += (1 - Math.abs(vnoise(x * f, y * f, s + i * 31))) * amp; n += amp; amp *= 0.5; f *= 2.1; } return a / n; }
// distance from a point to a polyline [[x,z],...] — returns [dist, t along, segment index]
function polyDist(px, pz, pts) {
  let best = 1e9, bi = 0, bt = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(px - qx, pz - qz);
    if (d < best) { best = d; bi = i; bt = t; }
  }
  return [best, bt, bi];
}
// Catmull-Rom smoothing of a path so roads and the river curve naturally
function smoothPath(pts, steps = 6) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

// ---------- settings (per-browser convenience) ----------
const SET = Object.assign({ sfx: 75, music: 55, sens: 50, fov: 75, quality: 'high', gore: true, shake: true, invertY: false, subtitles: true }, LS.get('bloodmoon.settings', {}) || {});
SET.sfx = clamp(+SET.sfx || 0, 0, 100); SET.music = clamp(SET.music == null ? 55 : +SET.music || 0, 0, 100); SET.sens = clamp(+SET.sens || 50, 5, 100); SET.fov = clamp(+SET.fov || 75, 60, 100);
if (!['low', 'medium', 'high'].includes(SET.quality)) SET.quality = 'high';
function saveSettings() { LS.set('bloodmoon.settings', SET); }
