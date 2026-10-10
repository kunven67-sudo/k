// Pocket items drawn in code (canvas): wallet, crumpled cash, cracked phone, motel key card,
// the napkin, the bar receipt. Each returns a canvas at 2x for crisp edges; all cached per state.

import { formatMoney } from '../core/util.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = h * 2;
  const g = c.getContext('2d');
  g.scale(2, 2);
  return [c, g];
}

function grain(g, w, h, amt, seed = 1) {
  const img = g.getImageData(0, 0, w * 2, h * 2);
  let s = seed * 9301;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    s = (s * 16807) % 2147483647;
    const n = ((s / 2147483647) - 0.5) * amt;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
}

function wallet() {
  const [c, g] = canvas(220, 160);
  const lg = g.createLinearGradient(0, 0, 220, 160);
  lg.addColorStop(0, '#5a3a24');
  lg.addColorStop(0.5, '#3f2717');
  lg.addColorStop(1, '#2a190e');
  rr(g, 4, 4, 212, 152, 14);
  g.fillStyle = lg;
  g.fill();
  // Worn, lighter edges and the fold.
  g.strokeStyle = 'rgba(160,110,70,.45)';
  g.lineWidth = 2;
  g.stroke();
  g.setLineDash([4, 4]);
  g.strokeStyle = 'rgba(210,170,120,.45)';
  g.lineWidth = 1.2;
  rr(g, 12, 12, 196, 136, 9);
  g.stroke();
  g.setLineDash([]);
  const fold = g.createLinearGradient(100, 0, 120, 0);
  fold.addColorStop(0, 'rgba(0,0,0,0)');
  fold.addColorStop(0.5, 'rgba(0,0,0,.35)');
  fold.addColorStop(1, 'rgba(255,255,255,.05)');
  g.fillStyle = fold;
  g.fillRect(100, 6, 20, 148);
  // Cracked fake leather: a few pale crazing lines.
  g.strokeStyle = 'rgba(200,160,120,.25)';
  g.lineWidth = 0.8;
  for (let i = 0; i < 18; i++) {
    const x = 20 + Math.random() * 180;
    const y = 20 + Math.random() * 120;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 10);
    g.stroke();
  }
  grain(g, 220, 160, 22, 3);
  return c;
}

function bill(g, x, y, w, h, rot, denom) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const lg = g.createLinearGradient(-w / 2, 0, w / 2, 0);
  lg.addColorStop(0, '#c9d1bd');
  lg.addColorStop(0.5, '#dfe4d2');
  lg.addColorStop(1, '#bfc8b1');
  g.fillStyle = lg;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = '#6f7d63';
  g.lineWidth = 1;
  g.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  // Portrait oval and seal.
  g.fillStyle = 'rgba(70,90,70,.35)';
  g.beginPath();
  g.ellipse(0, 0, h * 0.27, h * 0.34, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(40,80,60,.4)';
  g.beginPath();
  g.arc(-w * 0.3, 2, h * 0.13, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2f4a37';
  g.font = `700 ${Math.round(h * 0.22)}px "Playfair Display", serif`;
  g.fillText(String(denom), w / 2 - h * 0.62, -h / 2 + h * 0.3);
  g.fillText(String(denom), -w / 2 + 8, h / 2 - 8);
  g.restore();
}

function cash(amount) {
  const [c, g] = canvas(220, 140);
  // Crumpled: draw the bill, then facet shading polygons.
  bill(g, 112, 72, 190, 84, -0.06, amount >= 100 ? 100 : amount >= 20 ? 20 : amount >= 5 ? 5 : 1);
  g.save();
  g.translate(112, 72);
  g.rotate(-0.06);
  for (let i = 0; i < 26; i++) {
    const x = (Math.random() - 0.5) * 180;
    const y = (Math.random() - 0.5) * 76;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.12)';
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 30);
    g.lineTo(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 30);
    g.closePath();
    g.fill();
  }
  g.restore();
  grain(g, 220, 140, 14, 5);
  return c;
}

function phone() {
  const [c, g] = canvas(110, 210);
  rr(g, 5, 5, 100, 200, 16);
  g.fillStyle = '#16171a';
  g.fill();
  g.strokeStyle = '#3a3c42';
  g.lineWidth = 2;
  g.stroke();
  rr(g, 11, 12, 88, 182, 10);
  const sg = g.createLinearGradient(0, 0, 110, 210);
  sg.addColorStop(0, '#1d2333');
  sg.addColorStop(1, '#07080b');
  g.fillStyle = sg;
  g.fill();
  // Spider-web crack.
  g.strokeStyle = 'rgba(255,255,255,.55)';
  g.lineWidth = 0.7;
  const ox = 82;
  const oy = 168;
  for (let i = 0; i < 11; i++) {
    let x = ox;
    let y = oy;
    let a = (i / 11) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    const L = 20 + Math.random() * 120;
    for (let s = 0; s < L; s += 7) {
      a += (Math.random() - 0.5) * 0.5;
      x += Math.cos(a) * 7;
      y += Math.sin(a) * 7;
      if (x < 11 || x > 99 || y < 12 || y > 194) break;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.beginPath();
  g.moveTo(11, 12);
  g.lineTo(60, 12);
  g.lineTo(11, 90);
  g.fill();
  return c;
}

function keycard(room) {
  const [c, g] = canvas(200, 128);
  rr(g, 4, 4, 192, 120, 10);
  g.fillStyle = '#f5f2ea';
  g.fill();
  g.save();
  g.clip();
  // Retro pink/teal motel stripes.
  g.fillStyle = '#e2557f';
  g.fillRect(4, 84, 192, 16);
  g.fillStyle = '#2aa59a';
  g.fillRect(4, 100, 192, 8);
  g.restore();
  // Star logo.
  g.fillStyle = '#e2557f';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 7 : 16;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(30 + Math.cos(a) * r, 36 + Math.sin(a) * r);
  }
  g.fill();
  g.fillStyle = '#2b2b30';
  g.font = 'italic 700 22px "Playfair Display", serif';
  g.fillText('Starlite', 54, 36);
  g.font = '600 9px Inter, sans-serif';
  g.fillStyle = '#6b6b72';
  g.fillText('MOTEL  ·  RENO, NEVADA', 56, 52);
  // Room number in marker.
  g.save();
  g.translate(160, 70);
  g.rotate(-0.12);
  g.fillStyle = '#1b2a6b';
  g.font = '700 26px "Bebas Neue", Inter, sans-serif';
  g.fillText(`#${room}`, -18, 6);
  g.restore();
  // Scuffs.
  g.strokeStyle = 'rgba(0,0,0,.08)';
  for (let i = 0; i < 12; i++) {
    g.beginPath();
    const x = 10 + Math.random() * 180;
    const y = 10 + Math.random() * 100;
    g.moveTo(x, y);
    g.lineTo(x + Math.random() * 30, y + (Math.random() - 0.5) * 4);
    g.stroke();
  }
  return c;
}

function napkin(name, number) {
  const [c, g] = canvas(210, 210);
  g.save();
  g.translate(105, 105);
  g.rotate(0.04);
  g.fillStyle = '#f7f3ea';
  g.shadowColor = 'rgba(0,0,0,.25)';
  g.shadowBlur = 6;
  g.fillRect(-92, -92, 184, 184);
  g.shadowBlur = 0;
  // Embossed border + quarter-fold creases.
  g.strokeStyle = 'rgba(160,150,130,.35)';
  g.setLineDash([2, 3]);
  g.strokeRect(-84, -84, 168, 168);
  g.setLineDash([]);
  g.strokeStyle = 'rgba(0,0,0,.07)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -92);
  g.lineTo(0, 92);
  g.moveTo(-92, 0);
  g.lineTo(92, 0);
  g.stroke();
  // A ring from a glass.
  g.strokeStyle = 'rgba(140,100,60,.18)';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(48, 50, 30, 0.3, 5.6);
  g.stroke();
  // Eyeliner handwriting.
  g.fillStyle = '#231c1f';
  g.font = 'italic 700 30px "Playfair Display", serif';
  g.rotate(-0.08);
  g.fillText(name, -66, -22);
  g.font = 'italic 400 19px "Playfair Display", serif';
  g.fillText(number, -72, 16);
  g.font = 'italic 400 26px "Playfair Display", serif';
  g.fillText('♡', 40, -22);
  g.restore();
  grain(g, 210, 210, 10, 7);
  return c;
}

function receipt() {
  const [c, g] = canvas(130, 230);
  g.fillStyle = '#f4f2ed';
  g.beginPath();
  g.moveTo(8, 6);
  for (let x = 8; x <= 122; x += 6) g.lineTo(x, 6 + (x % 12 ? 3 : 0));
  g.lineTo(122, 222);
  for (let x = 122; x >= 8; x -= 6) g.lineTo(x, 222 - (x % 12 ? 3 : 0));
  g.closePath();
  g.shadowColor = 'rgba(0,0,0,.25)';
  g.shadowBlur = 5;
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = '#3a3a3a';
  g.font = '9px "Special Elite", monospace';
  const lines = ['  ELDORADO  RENO', ' CENTER BAR  #3', '', '04 WHISKEY SOUR  48.00', '02 TEQUILA SHOT  22.00', '', 'SUBTOTAL         70.00', 'TAX               5.78', 'TOTAL            75.78', 'TIP               0.00', '', 'CASH             80.00', 'CHANGE            4.22', '', '  02:47 AM', '  THANK YOU!'];
  lines.forEach((l, i) => g.fillText(l, 14, 26 + i * 12));
  // Thermal fade and a crumple.
  const f = g.createLinearGradient(0, 0, 0, 230);
  f.addColorStop(0, 'rgba(244,242,237,0)');
  f.addColorStop(1, 'rgba(244,242,237,.45)');
  g.fillStyle = f;
  g.fillRect(8, 6, 114, 216);
  g.strokeStyle = 'rgba(0,0,0,.08)';
  g.beginPath();
  g.moveTo(8, 120);
  g.lineTo(122, 112);
  g.stroke();
  return c;
}

/** Open wallet: license on the left sleeve, bills peeking from the right. `license` = img/canvas. */
export function walletOpen(license, amount) {
  const [c, g] = canvas(420, 200);
  for (const [x, flip] of [
    [4, 0],
    [212, 1],
  ]) {
    const lg = g.createLinearGradient(x, 0, x + 204, 0);
    lg.addColorStop(flip ? 1 : 0, '#4a2f1c');
    lg.addColorStop(flip ? 0 : 1, '#2a190e');
    rr(g, x, 4, 204, 192, 12);
    g.fillStyle = lg;
    g.fill();
    g.setLineDash([4, 4]);
    g.strokeStyle = 'rgba(210,170,120,.4)';
    rr(g, x + 8, 12, 188, 176, 8);
    g.stroke();
    g.setLineDash([]);
  }
  // ID window.
  if (license) {
    g.save();
    rr(g, 20, 34, 172, 108, 6);
    g.clip();
    g.drawImage(license, 20, 34, 172, 108);
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(20, 34, 172, 108);
    g.restore();
  }
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.fillRect(16, 150, 180, 8);
  // Bills in the right pocket.
  if (amount > 0) {
    const n = Math.min(5, Math.max(1, Math.round(amount / 20)));
    for (let i = 0; i < n; i++) bill(g, 316 + i * 2, 70 - i * 4, 180, 76, -0.02 + i * 0.015, amount >= 100 ? 100 : 20);
    g.fillStyle = '#2a190e';
    g.fillRect(212, 100, 204, 96);
    g.setLineDash([4, 4]);
    g.strokeStyle = 'rgba(210,170,120,.4)';
    g.beginPath();
    g.moveTo(220, 104);
    g.lineTo(408, 104);
    g.stroke();
    g.setLineDash([]);
  }
  grain(g, 420, 200, 14, 11);
  return c;
}

// ---- casino items (drawn by the casino floor lane) ----

const CASINO_TITLES = { eldorado: 'ELDORADO RESORT CASINO', 'silver-legacy': 'SILVER LEGACY RESORT CASINO', 'circus-circus': 'CIRCUS CIRCUS RENO' };
const ONES = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
function words(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} HUNDRED${n % 100 ? ` ${words(n % 100)}` : ''}`;
  if (n < 1e6) return `${words(Math.floor(n / 1000))} THOUSAND${n % 1000 ? ` ${words(n % 1000)}` : ''}`;
  return String(n);
}

/** TITO cash-out voucher: thermal paper, casino header, barcode, validation number, amount. */
function tito(item) {
  const W = 300;
  const H = 136;
  const [c, g] = canvas(W, H);
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-0.02);
  g.translate(-W / 2, -H / 2);
  const pg = g.createLinearGradient(0, 0, 0, H);
  pg.addColorStop(0, '#fbfaf6');
  pg.addColorStop(1, '#ecebe4');
  g.fillStyle = pg;
  g.fillRect(6, 6, W - 12, H - 12);
  g.fillStyle = '#16161a';
  g.textAlign = 'center';
  g.font = '700 10px "Inter"';
  g.fillText(CASINO_TITLES[item.casino] || String(item.casino || '').toUpperCase(), W / 2, 20);
  g.font = '400 8px "Inter"';
  g.fillText('345 N VIRGINIA ST · RENO NV', W / 2, 30);
  g.font = '700 13px "Bebas Neue"';
  g.fillText('CASHOUT TICKET', W / 2, 44);
  // Barcode (Interleaved 2 of 5 look) from the validation digits.
  const digits = String(item.validation || item.id || '').replace(/\D/g, '').padEnd(18, '0');
  let x = 34;
  for (let i = 0; i < digits.length * 2 && x < W - 34; i++) {
    const d = +digits[i % digits.length];
    const wide = (d + i) % 3 === 0;
    g.fillRect(x, 50, wide ? 3 : 1.4, 26);
    x += (wide ? 3 : 1.4) + ((d + i) % 2 ? 2.4 : 1.4);
  }
  g.font = '400 8px "Inter"';
  g.fillText(`VALIDATION ${item.validation || ''}`, W / 2, 86);
  const amt = Math.round((item.amount || 0) * 100);
  const dollars = Math.floor(amt / 100);
  const cents = amt % 100;
  g.font = '700 7px "Inter"';
  g.fillText(`${words(dollars)} DOLLARS AND ${String(cents).padStart(2, '0')}/100`, W / 2, 97);
  g.font = '700 22px "Inter"';
  g.fillText(`$${(amt / 100).toFixed(2)}`, W / 2, 119);
  g.textAlign = 'left';
  g.font = '400 7px "Inter"';
  const d = new Date(item.issuedMs || Date.now());
  g.fillText(`${d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}  ${d.toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit' })}`, 14, 119);
  g.textAlign = 'right';
  g.fillText(`MACHINE ${String(item.machine || '').toUpperCase().slice(0, 10)}`, W - 14, 112);
  g.fillText('VOID AFTER 90 DAYS', W - 14, 122);
  // Thermal fade + a fold line.
  g.fillStyle = 'rgba(200,190,160,.12)';
  g.fillRect(6, H / 2, W - 12, H / 2 - 6);
  g.strokeStyle = 'rgba(0,0,0,.08)';
  g.beginPath();
  g.moveTo(W * 0.62, 6);
  g.lineTo(W * 0.6, H - 6);
  g.stroke();
  g.restore();
  grain(g, W, H, 10, 17);
  return c;
}

const CHIP_COLORS = { 1: ['#eeeae0', '#2b58a8'], 2.5: ['#e59ab0', '#ffffff'], 5: ['#b11d26', '#f4f0e6'], 25: ['#1c7a3b', '#f4f0e6'], 100: ['#1b1b1d', '#f4f0e6'], 500: ['#5a2a8a', '#f2d24a'], 1000: ['#e3b223', '#1b1b1d'] };

/** A few stacks of clay chips (side view), one per denomination held. */
function chipStacks(item) {
  const W = 200;
  const H = 150;
  const [c, g] = canvas(W, H);
  const counts = Object.entries(item.counts || {}).filter(([, n]) => n > 0).sort((a, b) => +b[0] - +a[0]);
  const n = Math.max(1, counts.length);
  const sw = Math.min(46, (W - 20) / n - 6);
  counts.forEach(([den, cnt], i) => {
    const [col, stripe] = CHIP_COLORS[den] || ['#888', '#fff'];
    const cx = W / 2 + (i - (n - 1) / 2) * (sw + 8);
    const k = Math.min(14, cnt);
    for (let j = 0; j < k; j++) {
      const y = H - 18 - j * 6.2;
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(cx, y, sw / 2, sw * 0.17, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(cx - sw / 2, y - 6, sw, 6);
      g.fillStyle = stripe;
      for (let s = 0; s < 5; s++) g.fillRect(cx - sw / 2 + 2 + s * (sw / 5), y - 5, sw / 12, 4);
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.fillRect(cx - sw / 2, y - 0.8, sw, 0.8);
    }
    const ty = H - 18 - k * 6.2;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(cx, ty, sw / 2, sw * 0.17, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = stripe;
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(cx, ty, sw * 0.32, sw * 0.1, 0, 0, Math.PI * 2);
    g.stroke();
  });
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath();
  g.ellipse(W / 2, H - 10, W * 0.42, 6, 0, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Canvas for a pocket item. */
export function itemCanvas(item, ctx) {
  const extra = item.kind === 'tito' ? `${item.id}` : item.kind === 'chips' ? JSON.stringify(item.counts || {}) : '';
  const key = `${item.kind}:${item.kind === 'cash' ? ctx.cash : ''}:${item.kind === 'keycard' ? ctx.room : ''}:${extra}`;
  if (cache.has(key)) return cache.get(key);
  let c;
  if (item.kind === 'wallet') c = wallet();
  else if (item.kind === 'cash') c = cash(ctx.cash);
  else if (item.kind === 'phone') c = phone();
  else if (item.kind === 'keycard') c = keycard(ctx.room);
  else if (item.kind === 'napkin') c = napkin(item.name, item.number);
  else if (item.kind === 'receipt') c = receipt();
  else if (item.kind === 'tito') c = tito(item);
  else if (item.kind === 'chips') c = chipStacks(item);
  else return null;
  cache.set(key, c);
  return c;
}

export const fmtCash = (v) => formatMoney(v, { cents: v % 1 !== 0 });
