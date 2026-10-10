// A stand-in driver license for dev pages / lives without a creator card: drawn in code,
// generic "STATE OF NEVADA"-style layout with a silhouette instead of a photo.

import { save } from '../../core/save.js';

let cached = null;

export function licenseFallback() {
  if (cached) return cached.cloneNode(true);
  const W = 512;
  const H = 322;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#dfe8f2');
  bg.addColorStop(0.5, '#f4f1e8');
  bg.addColorStop(1, '#d9e4dd');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Guilloche security pattern.
  g.strokeStyle = 'rgba(60,110,160,.13)';
  for (let k = 0; k < 26; k++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 6) g.lineTo(x, 40 + k * 11 + Math.sin(x / 38 + k) * 8);
    g.stroke();
  }
  g.fillStyle = '#1e3f6e';
  g.fillRect(0, 0, W, 48);
  g.fillStyle = '#fff';
  g.font = '700 22px Inter, sans-serif';
  g.fillText('NEVADA', 18, 32);
  g.font = '600 13px Inter, sans-serif';
  g.fillText('DRIVER LICENSE', W - 150, 30);
  // Photo silhouette.
  g.fillStyle = '#9fb0c4';
  g.fillRect(20, 66, 132, 170);
  g.fillStyle = '#6d7f95';
  g.beginPath();
  g.arc(86, 128, 34, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(86, 236, 60, 50, 0, Math.PI, 0);
  g.fill();
  const ch = save.life?.character;
  const last = (ch?.name?.last || 'DOE').toUpperCase();
  const first = (ch?.name?.first || 'JOHN').toUpperCase();
  g.fillStyle = '#16233a';
  g.font = '600 11px Inter, sans-serif';
  const row = (lab, val, y) => {
    g.fillStyle = '#b3202a';
    g.fillText(lab, 172, y);
    g.fillStyle = '#16233a';
    g.font = '700 17px Inter, sans-serif';
    g.fillText(val, 200, y);
    g.font = '600 11px Inter, sans-serif';
  };
  row('LN', last, 86);
  row('FN', first, 112);
  row('DL', '1702' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0'), 146);
  row('EXP', '10/07/2030', 172);
  row('CLASS', 'C', 198);
  g.font = 'italic 26px "Playfair Display", serif';
  g.fillStyle = '#20304d';
  g.fillText(`${first[0]}${first.slice(1).toLowerCase()} ${last[0]}${last.slice(1).toLowerCase()}`, 176, 262);
  g.fillStyle = 'rgba(30,63,110,.12)';
  g.font = '900 84px Inter, sans-serif';
  g.fillText('NV', W - 136, H - 26);
  c.style.cssText = 'display:block;width:100%;height:auto';
  cached = c;
  return c;
}
