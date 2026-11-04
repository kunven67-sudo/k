// Fonts + canvas text helpers (fonts come from the GS3 kit folder, so menus match the console look).
const U = (p) => (globalThis.SB_URL ? globalThis.SB_URL(p) : p); // one-file version: files come from inside the page
export const FONT = 'Inter, "Open Sans", "Segoe UI", system-ui, sans-serif';
export const CAPTION_FONT = '"Open Sans", Inter, "Segoe UI", system-ui, sans-serif';

export async function loadFonts(base = 'gs3kit/fonts/') {
  const list = [
    ['Inter', 'inter-latin-wght-normal.woff2', { weight: '100 900' }],
    ['Open Sans', 'open-sans-latin-400-normal.woff2', { weight: '400' }],
    ['Open Sans', 'open-sans-latin-600-normal.woff2', { weight: '600' }]
  ];
  await Promise.all(list.map(async ([fam, file, d]) => {
    try { const f = new FontFace(fam, `url(${U(base + file)})`, d); await f.load(); document.fonts.add(f); } catch (e) { /* system font fallback */ }
  }));
}

// wrap text to lines that fit `maxW` (canvas ctx already has font set)
export function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// TikTok-style caption: white bold text with dark outline, centered
export function drawCaption(g, text, cx, cy, maxW, size) {
  g.save();
  g.font = `600 ${size}px ${CAPTION_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = wrap(g, text, maxW); const lh = size * 1.32;
  let y = cy - (lines.length - 1) * lh / 2;
  g.lineJoin = 'round'; g.lineWidth = Math.max(3, size * 0.16); g.strokeStyle = 'rgba(0,0,0,0.92)';
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = size * 0.2;
  for (const l of lines) { g.strokeText(l, cx, y); y += lh; }
  g.shadowBlur = 0; g.fillStyle = '#fff'; y = cy - (lines.length - 1) * lh / 2;
  for (const l of lines) { g.fillText(l, cx, y); y += lh; }
  g.restore();
}

export function drawText(g, text, x, y, { size = 32, weight = 600, color = '#fff', align = 'left', base = 'alphabetic', maxW, font = FONT } = {}) {
  g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  if (maxW) g.fillText(text, x, y, maxW); else g.fillText(text, x, y);
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export function fmtYears(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(/\.0$/, '') + ' billion';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + ' million';
  return n.toLocaleString('en-US');
}
export const fmtHeight = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;
