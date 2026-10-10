// Composes the player's driver license onto a canvas (CR-80 proportions, 856x540).
// A fictional "Silver State" layout: sunset-to-sage gradient, guilloche security lines, Sierra
// ridge line, the ID photo on the left with a ghost copy on the right, typed fields and a
// hand-written signature. Not a copy of any real license design.
//
//   const canvas = composeLicense({ first, last, age, params, photo /* canvas */ });

import { t } from '../core/i18n.js';
import { Rng, hashString } from '../core/rng.js';

const W = 856;
const H = 540;

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;

/** Deterministic DOB from name + age (so the card never changes on reload). */
export function dobFor(name, age, now = new Date()) {
  const rng = new Rng(hashString(name) || 7);
  const d = new Date(now.getFullYear() - age, now.getMonth(), now.getDate());
  d.setDate(d.getDate() - rng.int(1, 360)); // birthday already passed this year → exactly `age`
  return d;
}

function guilloche(ctx, cx, cy, R, r, d, color, steps = 1400) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2 * 7;
    const x = cx + (R - r) * Math.cos(a) + d * Math.cos(((R - r) / r) * a);
    const y = cy + (R - r) * Math.sin(a) - d * Math.sin(((R - r) / r) * a);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const HAIR_CODE = { black: 'BLK', 'dark-brown': 'BRO', brown: 'BRO', 'light-brown': 'BRO', auburn: 'RED', ginger: 'RED', strawberry: 'RED', blonde: 'BLN', platinum: 'BLN', gray: 'GRY', white: 'WHI', 'dyed-red': 'RED', 'dyed-blue': 'BLU', 'dyed-pink': 'PNK', 'dyed-green': 'GRN' };
const EYE_CODE = { 'dark-brown': 'BRO', brown: 'BRO', hazel: 'HAZ', amber: 'HAZ', green: 'GRN', blue: 'BLU', 'light-blue': 'BLU', gray: 'GRY' };

export function composeLicense({ first, last, age, params = {}, photo }) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const name = `${first} ${last}`.trim();
  const rng = new Rng(hashString(name + age) || 3);

  // Card body.
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#f6e4c4');
  g.addColorStop(0.45, '#eef0e2');
  g.addColorStop(1, '#cfe0d4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Security pattern.
  guilloche(ctx, W * 0.62, H * 0.56, 230, 37, 70, 'rgba(70,120,140,0.16)');
  guilloche(ctx, W * 0.62, H * 0.56, 150, 23, 40, 'rgba(190,120,60,0.16)');
  for (let y = 0; y < H; y += 6) {
    ctx.strokeStyle = 'rgba(80,110,100,0.06)';
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, y + 2.5 * Math.sin(x * 0.04 + y * 0.3));
    ctx.stroke();
  }
  // Sierra ridge + sagebrush band at the bottom.
  ctx.fillStyle = 'rgba(96,124,132,0.28)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 12) ctx.lineTo(x, H - 92 - 38 * Math.sin(x * 0.011) - 22 * Math.sin(x * 0.037 + 1) - rng.range(0, 6));
  ctx.lineTo(W, H);
  ctx.fill();
  ctx.fillStyle = 'rgba(110,140,100,0.3)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, H - 46 - 10 * Math.sin(x * 0.05) - rng.range(0, 8));
  ctx.lineTo(W, H);
  ctx.fill();

  // Header band.
  const hg = ctx.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, '#1f3f63');
  hg.addColorStop(1, '#2f6a7c');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, 92);
  ctx.fillStyle = '#d8b25a';
  ctx.fillRect(0, 92, W, 4);
  ctx.fillStyle = '#f6e9c6';
  ctx.font = '54px Rye, serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('NEVADA', 34, 68);
  ctx.font = '600 15px Inter, sans-serif';
  ctx.fillStyle = 'rgba(246,233,198,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(t('creator.lic_state'), W - 34, 38);
  ctx.font = '700 30px "Bebas Neue", Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(t('creator.license').toUpperCase(), W - 34, 72);
  ctx.textAlign = 'left';

  // Photo (with a thin frame) + ghost photo.
  const px = 34, py = 118, pw = 236, ph = 299;
  ctx.fillStyle = '#2b3a4a';
  ctx.fillRect(px - 3, py - 3, pw + 6, ph + 6);
  if (photo) ctx.drawImage(photo, px, py, pw, ph);
  if (photo) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.filter = 'grayscale(1)';
    ctx.drawImage(photo, W - 150, H - 196, 108, 137);
    ctx.restore();
  }

  // Fields.
  const dob = dobFor(name, age);
  const now = new Date();
  const exp = new Date(now.getFullYear() + 8, dob.getMonth(), dob.getDate());
  const dl = `${rng.int(1, 9)}${String(rng.int(0, 999999999)).padStart(9, '0')}`;
  const label = (txt, x, y) => {
    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillStyle = '#9b3b2c';
    ctx.fillText(txt, x, y);
  };
  const value = (txt, x, y, size = 24) => {
    ctx.font = `${size}px "Special Elite", "Courier New", monospace`;
    ctx.fillStyle = '#16212c';
    ctx.fillText(txt, x, y);
  };
  const fx = 300;
  label(`4d ${t('creator.lic_dl')}`, fx, 136);
  value(dl, fx + 64, 138, 28);
  label(`3 ${t('creator.lic_dob')}`, fx, 176);
  value(fmt(dob), fx + 64, 178, 26);
  label(`4b ${t('creator.lic_exp')}`, fx + 270, 176);
  value(fmt(exp), fx + 340, 178, 20);
  ctx.font = '700 34px Inter, sans-serif';
  ctx.fillStyle = '#16212c';
  ctx.fillText((last || '').toUpperCase(), fx, 228);
  ctx.font = '600 26px Inter, sans-serif';
  ctx.fillText((first || '').toUpperCase(), fx, 260);
  value(t('creator.lic_addr'), fx, 294, 19);
  const hIn = Math.round((params.height ?? 1.75) / 0.0254);
  const sexCode = 'X';
  label(`15 ${t('creator.lic_sex')}`, fx, 338); value(sexCode, fx, 364, 22);
  label(`16 ${t('creator.lic_hgt')}`, fx + 80, 338); value(`${Math.floor(hIn / 12)}'-${pad(hIn % 12)}"`, fx + 80, 364, 22);
  label(`18 ${t('creator.lic_eyes')}`, fx + 200, 338); value(EYE_CODE[params.eyeColor] || 'BRO', fx + 200, 364, 22);
  label(`19 ${t('creator.lic_hair')}`, fx + 300, 338); value(params.hairStyle === 'bald' ? 'BAL' : HAIR_CODE[params.hairColor] || 'XXX', fx + 300, 364, 22);
  label(`9 ${t('creator.lic_class')}`, fx, 402); value('C', fx + 70, 404, 22);
  label(`4a ${t('creator.lic_iss')}`, fx + 120, 402); value(fmt(now), fx + 180, 404, 18);
  // Donor heart.
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  const hx = fx + 410, hy = 392;
  ctx.moveTo(hx, hy + 8);
  ctx.bezierCurveTo(hx - 16, hy - 4, hx - 6, hy - 16, hx, hy - 6);
  ctx.bezierCurveTo(hx + 6, hy - 16, hx + 16, hy - 4, hx, hy + 8);
  ctx.fill();

  // Signature: slanted italic + a pen flourish.
  ctx.save();
  ctx.translate(px + 6, 474);
  ctx.rotate(-0.04);
  ctx.font = 'italic 38px "Playfair Display", Georgia, serif';
  ctx.fillStyle = '#1b2a6b';
  ctx.fillText(`${first} ${last}`.trim(), 0, 0);
  const sw = ctx.measureText(`${first} ${last}`).width;
  ctx.strokeStyle = '#1b2a6b';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-4, 10);
  ctx.bezierCurveTo(sw * 0.3, 18, sw * 0.7, 2, sw + 20, 12);
  ctx.stroke();
  ctx.restore();

  // Holographic sheen across the whole card.
  const sh = ctx.createLinearGradient(0, H, W, 0);
  sh.addColorStop(0.35, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(200,255,240,0.13)');
  sh.addColorStop(0.55, 'rgba(255,220,250,0.11)');
  sh.addColorStop(0.7, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Edge.
  roundRect(ctx, 1, 1, W - 2, H - 2, 33);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  return c;
}
