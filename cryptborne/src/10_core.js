'use strict';
/* =====================================================================
   CRYPTBORNE — a pixel dungeon crawler. Single file, no assets.
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
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const smooth = (t) => t * t * (3 - 2 * t);
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
const plural = (s) => (/wolf$/i.test(s) ? s.slice(0, -1) + 'ves' : /[^aeiou]y$/i.test(s) ? s.slice(0, -1) + 'ies' : /(s|x|ch|sh)$/i.test(s) ? s + 'es' : s + 's');
const fmtNum = (n) => Math.floor(n).toLocaleString();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

// ---------- settings (per-browser convenience) ----------
const SET = Object.assign({ sfx: 70, music: 55, zoom: 0, shake: true, dmg: true, names: true, weather: true }, LS.get('cryptborne.settings', {}) || {});
if (SET.vol != null && SET.sfx == null) SET.sfx = SET.vol; // settings from version 1
delete SET.vol;
SET.sfx = clamp(+SET.sfx || 0, 0, 100); SET.music = clamp(SET.music == null ? 55 : +SET.music || 0, 0, 100); SET.zoom = clamp(Math.round(+SET.zoom || 0), -1, 1);
function saveSettings() { LS.set('cryptborne.settings', SET); }
