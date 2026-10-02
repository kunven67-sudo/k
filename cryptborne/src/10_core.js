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
function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function weighted(list, r = Math.random) {
  let tot = 0; for (const e of list) tot += e[1];
  let x = r() * tot; for (const e of list) { if ((x -= e[1]) < 0) return e[0]; }
  return list[list.length - 1][0];
}
const fmtDate = (ts) => {
  if (!ts) return 'never';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
const fmtNum = (n) => Math.floor(n).toLocaleString();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};

// ---------- settings (per-browser convenience) ----------
const SET = Object.assign({ vol: 70, zoom: 0, shake: true, dmg: true, names: true }, LS.get('cryptborne.settings', {}) || {});
SET.vol = clamp(+SET.vol || 0, 0, 100); SET.zoom = clamp(Math.round(+SET.zoom || 0), -1, 1);
function saveSettings() { LS.set('cryptborne.settings', SET); }

// ---------- sound (tiny synth, starts after first click) ----------
const Sfx = {
  ac: null, master: null, noiseBuf: null, last: {},
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ac = new AC(); this.master = this.ac.createGain(); this.master.connect(this.ac.destination); this.setVol();
      const len = Math.floor(this.ac.sampleRate * 0.5); this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },
  setVol() { if (this.master) this.master.gain.value = (SET.vol / 100) * 0.5; },
  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const ac = this.ac; if (!ac || SET.vol <= 0) return; const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, freq = 1200, delay = 0) {
    const ac = this.ac; if (!ac || !this.noiseBuf || SET.vol <= 0) return; const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = this.noiseBuf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.02);
  },
  play(n) {
    if (!this.ac || SET.vol <= 0) return;
    const now = performance.now(); if (this.last[n] && now - this.last[n] < 40) return; this.last[n] = now; // no stacking spam
    switch (n) {
      case 'swing': this.noise(0.08, 0.18, 2400); break;
      case 'shoot': this.tone(660, 0.08, 'square', 0.07, -300); break;
      case 'magic': this.tone(440, 0.18, 'sawtooth', 0.06, 500); break;
      case 'hit': this.noise(0.07, 0.35, 900); this.tone(180, 0.06, 'square', 0.1, -80); break;
      case 'crit': this.noise(0.1, 0.4, 700); this.tone(300, 0.1, 'square', 0.13, 300); break;
      case 'hurt': this.tone(220, 0.18, 'sawtooth', 0.16, -140); this.noise(0.1, 0.2, 500); break;
      case 'kill': this.tone(300, 0.07, 'square', 0.1, -150); this.noise(0.14, 0.2, 400); break;
      case 'coin': this.tone(988, 0.05, 'square', 0.06); this.tone(1319, 0.1, 'square', 0.06, 0, 0.05); break;
      case 'pickup': this.tone(660, 0.06, 'triangle', 0.14); this.tone(880, 0.08, 'triangle', 0.14, 0, 0.05); break;
      case 'chest': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.07, 0, i * 0.07)); break;
      case 'level': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'square', 0.09, 0, i * 0.09)); break;
      case 'dodge': this.noise(0.15, 0.15, 3000); break;
      case 'block': this.tone(140, 0.08, 'square', 0.16); this.noise(0.06, 0.3, 1800); break;
      case 'parry': this.tone(1200, 0.15, 'triangle', 0.18, -400); this.tone(1800, 0.2, 'sine', 0.1); break;
      case 'portal': this.tone(200, 0.5, 'sine', 0.14, 600); break;
      case 'buy': this.tone(784, 0.06, 'square', 0.08); this.tone(1175, 0.1, 'square', 0.08, 0, 0.06); break;
      case 'error': this.tone(150, 0.15, 'square', 0.1); break;
      case 'drink': this.tone(400, 0.2, 'sine', 0.14, 300); break;
      case 'boss': this.tone(110, 0.6, 'sawtooth', 0.14, -50); this.tone(82, 0.8, 'square', 0.09, 0, 0.2); break;
      case 'death': this.tone(300, 0.7, 'sawtooth', 0.16, -250); break;
      case 'click': this.tone(880, 0.03, 'square', 0.04); break;
      case 'explode': this.noise(0.3, 0.4, 300); break;
      case 'slam': this.noise(0.25, 0.45, 200); this.tone(70, 0.3, 'square', 0.18, -30); break;
    }
  },
};

// ---------- pixel sprite helpers ----------
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function spr(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const [c, x] = mkCanvas(w, h);
  for (let j = 0; j < h; j++) { const r = rows[j]; for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } } }
  return c;
}
const _flip = new WeakMap(), _white = new WeakMap(), _red = new WeakMap();
function flipped(c) {
  let f = _flip.get(c);
  if (!f) { const [n, x] = mkCanvas(c.width, c.height); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0); _flip.set(c, (f = n)); }
  return f;
}
function tinted(c, map, color) {
  let f = map.get(c);
  if (!f) { const [n, x] = mkCanvas(c.width, c.height); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); map.set(c, (f = n)); }
  return f;
}
const whiteOf = (c) => tinted(c, _white, '#ffffff');
const redOf = (c) => tinted(c, _red, '#ff4040');

// People: drawn from rectangles so every villager, merchant and the hero has a full body with walk cycle.
// (x, y) is the point between the feet. Body box is 12 x 20 pixels.
function drawHuman(ctx, x, y, L, st) {
  const f = st.face || 1, ox = Math.round(x) - 6, oy = Math.round(y) - 20;
  const R = (ix, iy, w, h, c) => { if (!c) return; ctx.fillStyle = c; ctx.fillRect(f === 1 ? ox + ix : ox + 12 - ix - w, oy + iy, w, h); };
  const ph = st.moving ? Math.sin(st.walk || 0) : 0;
  const legA = ph > 0.35 ? 3 : 4, legB = ph < -0.35 ? 3 : 4;
  const armF = st.moving ? Math.round(ph) : 0, armB = -armF;
  const dark = L.shirtDark || L.shirt;
  // legs + shoes
  if (!L.robe) {
    R(3, 15, 2, legA, L.pants); R(3, 15 + legA, 2, 1, L.shoes);
    R(7, 15, 2, legB, L.pants); R(7, 15 + legB, 2, 1, L.shoes);
  } else {
    R(2, 9, 8, 10, L.robe); R(3, 19, 2, 1, L.shoes); R(7, 19, 2, 1, L.shoes);
  }
  // back arm
  R(0, 10 + armB, 2, 4, st.armor || dark); R(0, 14 + armB, 2, 1, L.skin);
  // torso
  if (!L.robe) R(2, 9, 8, 6, L.shirt);
  R(2, 14, 8, 1, L.belt || '#3a2616');
  if (L.apron) R(3, 10, 6, 5, L.apron);
  if (st.armor) {
    R(2, 9, 8, 5, st.armor); R(2, 9, 8, 1, st.trim || '#ffffff55'); R(5, 10, 2, 3, st.trim || '#ffffff55');
    R(1, 9, 2, 2, st.trim || st.armor); R(9, 9, 2, 2, st.trim || st.armor);
  }
  // head
  R(3, 2, 6, 7, L.skin);
  R(6, 5, 1, 1, '#1b1020'); R(8, 5, 1, 1, '#1b1020');
  if (L.blush) R(7, 7, 2, 1, L.blush);
  switch (L.hairStyle | 0) {
    case 0: R(3, 1, 6, 2, L.hair); R(3, 3, 1, 3, L.hair); break; // short
    case 1: R(3, 1, 6, 2, L.hair); R(2, 2, 2, 7, L.hair); R(4, 3, 1, 1, L.hair); break; // long
    case 2: R(4, 1, 4, 1, L.skin); break; // bald
    case 3: R(3, 1, 6, 2, L.hair); R(3, 0, 1, 1, L.hair); R(5, 0, 1, 1, L.hair); R(7, 0, 2, 1, L.hair); R(3, 3, 1, 2, L.hair); break; // spiky
  }
  if (L.beard) { R(4, 7, 5, 2, L.beard); R(3, 6, 1, 2, L.beard); }
  if (L.hat) { R(2, 0, 8, 2, L.hat); R(1, 2, 10, 1, L.hat); }
  if (st.helm) { R(3, 1, 6, 3, st.helm); R(2, 3, 1, 4, st.helm); R(3, 4, 1, 1, st.helm); }
  // front arm (hand position is where weapons attach)
  R(10, 10 + armF, 2, 4, st.armor || L.shirt); R(10, 14 + armF, 2, 1, L.skin);
}

// palette used by the hero; armor recolours the torso
const HERO_LOOK = { skin: '#f0c08a', hair: '#5a3417', hairStyle: 3, shirt: '#3e6cb8', shirtDark: '#2c4e88', pants: '#4a3a2a', shoes: '#25190f', belt: '#6b4a1e' };
