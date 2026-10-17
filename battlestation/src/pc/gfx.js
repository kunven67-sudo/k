// Drawing helpers for the in-game PC screen (2D canvas). Fonts fall back to whatever the real
// PC has; on Windows that's Segoe UI, so the in-game desktop uses the same font as yours.
export const FONT = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
export const MONO = 'Consolas, "Cascadia Mono", "Courier New", monospace';

export function font(g, size, weight = 400, family = FONT) { g.font = `${weight} ${size}px ${family}`; }

export function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function fillRR(g, x, y, w, h, r, color) { rr(g, x, y, w, h, r); g.fillStyle = color; g.fill(); }
export function strokeRR(g, x, y, w, h, r, color, lw = 1) { rr(g, x + 0.5, y + 0.5, w - 1, h - 1, r); g.strokeStyle = color; g.lineWidth = lw; g.stroke(); }

// text clipped with an ellipsis to fit maxW
export function text(g, s, x, y, maxW, align = 'left') {
  s = String(s ?? '');
  g.textAlign = align;
  if (maxW && g.measureText(s).width > maxW) {
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (g.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
    s = s.slice(0, lo) + '…';
  }
  g.fillText(s, x, y);
}

// word-wrapped paragraph, returns height used
export function para(g, s, x, y, w, lh) {
  const words = String(s).split(/(\s+)/);
  let line = '', yy = y;
  for (const wd of words) {
    if (wd === '\n') { g.fillText(line, x, yy); line = ''; yy += lh; continue; }
    const test = line + wd;
    if (g.measureText(test).width > w && line.trim()) { g.fillText(line, x, yy); line = wd.trimStart(); yy += lh; }
    else line = test;
  }
  if (line) { g.fillText(line, x, yy); yy += lh; }
  return yy - y;
}

export const inside = (px, py, x, y, w, h) => px >= x && py >= y && px < x + w && py < y + h;

// ------------------------------------------------------------- generic icons (drawn, no logos)
const iconCache = new Map();
export function icon(name, size = 32, extra) {
  const key = name + size + (extra || '');
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 32, size / 32);
  drawIcon(g, name, extra);
  iconCache.set(key, c);
  return c;
}

function grad(g, y0, y1, a, b) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; }

function drawIcon(g, name, extra) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  switch (name) {
    case 'folder':
      fillRR(g, 2, 7, 13, 6, 2, '#e8a93a');
      fillRR(g, 2, 9, 28, 19, 2.5, grad(g, 9, 28, '#ffd36b', '#f2b237'));
      fillRR(g, 2, 12, 28, 16, 2.5, grad(g, 12, 28, '#ffcf55', '#f0a92e'));
      break;
    case 'pc':
      fillRR(g, 3, 5, 26, 17, 2, '#3a3f46'); fillRR(g, 5, 7, 22, 13, 1, grad(g, 7, 20, '#3fa9f5', '#1565c0'));
      g.fillStyle = '#5a6068'; g.fillRect(13, 22, 6, 3); fillRR(g, 9, 25, 14, 2.5, 1, '#5a6068');
      break;
    case 'bin':
      g.fillStyle = 'rgba(200,220,240,0.35)'; g.beginPath(); g.moveTo(7, 9); g.lineTo(25, 9); g.lineTo(23, 29); g.lineTo(9, 29); g.closePath(); g.fill();
      g.strokeStyle = '#cfe3f5'; g.lineWidth = 1.4; g.stroke();
      fillRR(g, 5, 6, 22, 3.5, 1.5, '#dbe9f6');
      for (const x of [12, 16, 20]) { g.beginPath(); g.moveTo(x, 12); g.lineTo(x - (x - 16) * 0.1, 26); g.strokeStyle = 'rgba(160,190,220,0.8)'; g.stroke(); }
      break;
    case 'notepad':
      fillRR(g, 6, 3, 20, 26, 2, '#ffffff'); g.fillStyle = '#2b88d8'; g.fillRect(6, 3, 20, 5);
      g.fillStyle = '#9db2c7'; for (let i = 0; i < 5; i++) g.fillRect(9, 12 + i * 3.4, 14 - (i === 4 ? 6 : 0), 1.3);
      break;
    case 'browser': {
      const gr = g.createRadialGradient(12, 11, 2, 16, 16, 15); gr.addColorStop(0, '#5fd4ff'); gr.addColorStop(1, '#0a6fc2');
      g.fillStyle = gr; g.beginPath(); g.arc(16, 16, 13, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(16, 16, 5.5, 13, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(3, 16); g.lineTo(29, 16); g.moveTo(5.5, 9.5); g.lineTo(26.5, 9.5); g.moveTo(5.5, 22.5); g.lineTo(26.5, 22.5); g.stroke();
      break;
    }
    case 'settings':
      g.save(); g.translate(16, 16);
      g.fillStyle = '#8f99a3';
      for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-2.6, -14, 5.2, 6); }
      g.beginPath(); g.arc(0, 0, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2d3238'; g.beginPath(); g.arc(0, 0, 4.5, 0, Math.PI * 2); g.fill();
      g.restore();
      break;
    case 'taskmgr':
      fillRR(g, 3, 4, 26, 24, 3, '#1f6f43');
      g.strokeStyle = '#7cf0a6'; g.lineWidth = 2; g.beginPath(); g.moveTo(6, 21); g.lineTo(11, 16); g.lineTo(15, 19); g.lineTo(20, 10); g.lineTo(26, 13); g.stroke();
      break;
    case 'terminal':
      fillRR(g, 3, 5, 26, 22, 3, '#1e1e1e'); strokeRR(g, 3, 5, 26, 22, 3, '#555');
      g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 12); g.lineTo(12, 16); g.lineTo(8, 20); g.stroke();
      g.fillStyle = '#ddd'; g.fillRect(14, 19, 8, 2);
      break;
    case 'calc':
      fillRR(g, 6, 3, 20, 26, 3, '#30343a'); fillRR(g, 8, 5, 16, 6, 1.5, '#9fd3a8');
      g.fillStyle = '#5b6168'; for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 3; c2++) fillRR(g, 8 + c2 * 5.6, 13 + r * 5, 4.4, 3.8, 1, c2 === 2 ? '#e8822e' : '#6b7178');
      break;
    case 'paint':
      fillRR(g, 4, 4, 24, 24, 4, '#fff');
      for (const [x, y, col] of [[11, 11, '#e53935'], [20, 10, '#43a047'], [10, 20, '#1e88e5'], [20, 20, '#fdd835']]) { g.fillStyle = col; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
      break;
    case 'store':
      fillRR(g, 4, 9, 24, 19, 3, '#2b2f36'); g.strokeStyle = '#8ab4f8'; g.lineWidth = 2; g.beginPath(); g.arc(16, 9, 5, Math.PI, 0); g.stroke();
      fillRR(g, 9, 14, 14, 10, 2, '#8ab4f8');
      break;
    case 'gamepad':
      fillRR(g, 3, 10, 26, 14, 7, '#3b4250');
      g.fillStyle = '#d5d9e0'; g.fillRect(8, 15.5, 6, 2); g.fillRect(10, 13.5, 2, 6);
      for (const [x, y, col] of [[21, 14.5, '#e57373'], [24, 17, '#81c784'], [18, 17, '#64b5f6'], [21, 19.5, '#ffd54f']]) { g.fillStyle = col; g.beginPath(); g.arc(x, y, 1.6, 0, Math.PI * 2); g.fill(); }
      break;
    case 'library':
      fillRR(g, 3, 3, 26, 26, 6, grad(g, 3, 29, '#1b2838', '#2a475e'));
      g.fillStyle = '#c7d5e0'; g.beginPath(); g.arc(20, 12, 4.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(11, 21, 3.2, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#c7d5e0'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(11, 21); g.lineTo(20, 12); g.stroke();
      break;
    case 'image':
      fillRR(g, 3, 6, 26, 20, 2, '#e9f1fb'); g.fillStyle = '#8bc34a'; g.beginPath(); g.moveTo(5, 24); g.lineTo(13, 14); g.lineTo(19, 20); g.lineTo(23, 16); g.lineTo(27, 24); g.closePath(); g.fill();
      g.fillStyle = '#ffca28'; g.beginPath(); g.arc(22, 11, 2.5, 0, Math.PI * 2); g.fill();
      break;
    case 'file':
      g.fillStyle = '#f4f6f8'; g.beginPath(); g.moveTo(7, 3); g.lineTo(20, 3); g.lineTo(26, 9); g.lineTo(26, 29); g.lineTo(7, 29); g.closePath(); g.fill();
      g.fillStyle = '#c9d2dc'; g.beginPath(); g.moveTo(20, 3); g.lineTo(26, 9); g.lineTo(20, 9); g.closePath(); g.fill();
      break;
    case 'drive':
      fillRR(g, 3, 9, 26, 14, 3, grad(g, 9, 23, '#9aa3ad', '#6c747d')); g.fillStyle = '#36e27a'; g.fillRect(23, 18, 3, 2);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(6, 12, 14, 1.5);
      break;
    case 'game': {
      // tile with initials for games without a real icon
      const [a, b] = (extra || 'GA').split('|');
      fillRR(g, 2, 2, 28, 28, 6, b || '#4a5568');
      g.fillStyle = '#fff'; g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(a.slice(0, 2), 16, 17);
      break;
    }
    case 'user':
      g.fillStyle = '#5a6b7d'; g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#c9d6e2'; g.beginPath(); g.arc(16, 12.5, 5.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(16, 27, 10, 7, 0, Math.PI, 0); g.fill();
      break;
    case 'power':
      g.strokeStyle = '#e8e8e8'; g.lineWidth = 2.4; g.beginPath(); g.arc(16, 17, 9, -Math.PI * 0.32, Math.PI * 1.32); g.stroke();
      g.beginPath(); g.moveTo(16, 5); g.lineTo(16, 15); g.stroke();
      break;
    case 'search':
      g.strokeStyle = '#e8e8e8'; g.lineWidth = 2.4; g.beginPath(); g.arc(14, 14, 7, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(19.5, 19.5); g.lineTo(26, 26); g.stroke();
      break;
    case 'taskview':
      g.strokeStyle = '#e8e8e8'; g.lineWidth = 1.8; strokeRR(g, 5, 9, 15, 15, 2, '#e8e8e8', 1.8); strokeRR(g, 12, 6, 15, 15, 2, '#e8e8e8', 1.8);
      break;
    default:
      fillRR(g, 4, 4, 24, 24, 5, '#607d8b');
  }
}

// Windows-style start logo: four tiles in the accent color
export function startLogo(g, x, y, s, color) {
  const t = s * 0.46, gap = s * 0.08;
  const gr = g.createLinearGradient(x, y, x + s, y + s);
  gr.addColorStop(0, lighten(color, 0.25)); gr.addColorStop(1, color);
  g.fillStyle = gr;
  for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) fillRR(g, x + a * (t + gap), y + b * (t + gap), t, t, s * 0.06, gr);
}

export function lighten(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * k); gg = Math.round(gg + (255 - gg) * k); b = Math.round(b + (255 - b) * k);
  return `rgb(${r},${gg},${b})`;
}

// Default wallpaper (used until a scan brings your real one): soft abstract waves
export function defaultWallpaper(w, h, dark = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, dark ? '#0b1a33' : '#9cc6f2'); bg.addColorStop(1, dark ? '#173b6e' : '#dcebfb');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) {
    const gr = g.createLinearGradient(0, h * 0.3, w, h);
    const a = 0.08 + i * 0.035;
    gr.addColorStop(0, `rgba(80,170,255,${a})`); gr.addColorStop(1, `rgba(30,90,200,${a * 0.4})`);
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, h * (0.55 + i * 0.05));
    for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.55 + i * 0.05) + Math.sin(x / w * Math.PI * 2 + i * 0.8) * h * 0.08 - Math.cos(x / w * Math.PI + i) * h * 0.1);
    g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.fill();
  }
  return c;
}
