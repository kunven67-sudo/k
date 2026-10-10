// Bounty Gulch Gold symbols: sheriff's star (wild), wanted poster (scatter), golden revolver,
// cowboy hat, spurred boot, horseshoe and carved-plank card ranks. 128×128 design box.

import { inked, metalGrad, vGrad, rGrad, bevelText, roundRectPath, circlePath, star, sheen, sparkle, artRng, FONTS, METAL, TAU } from './paint.js';

function sheriff(g) {
  const s = new Path2D();
  const pts = 6;
  // six-point star with ball tips
  for (let i = 0; i < pts * 2; i++) {
    const r = i % 2 ? 30 : 56;
    const a = -Math.PI / 2 + (i * Math.PI) / pts;
    const x = 64 + Math.cos(a) * r;
    const y = 66 + Math.sin(a) * r;
    if (i) s.lineTo(x, y);
    else s.moveTo(x, y);
  }
  s.closePath();
  for (let i = 0; i < pts; i++) {
    const a = -Math.PI / 2 + (i * TAU) / pts;
    s.moveTo(64 + Math.cos(a) * 58 + 7, 66 + Math.sin(a) * 58);
    s.arc(64 + Math.cos(a) * 58, 66 + Math.sin(a) * 58, 7, 0, TAU);
  }
  inked(g, s, metalGrad(g, 20, 6, 108, 124, METAL.gold), { inkW: 6, gloss: 0.35 });
  // engraved ring
  const ring = circlePath(64, 66, 28);
  g.save();
  g.strokeStyle = 'rgba(90,50,0,.75)';
  g.lineWidth = 3;
  g.stroke(ring);
  g.strokeStyle = 'rgba(255,240,180,.7)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(64, 67, 26, 0, TAU);
  g.stroke();
  g.restore();
  bevelText(g, 'WILD', 64, 68, { font: `400 26px ${FONTS.western}`, fill: vGrad(g, 54, 80, '#5a1a08', '#2a0a02'), ink: 'rgba(255,230,160,.9)', inkW: 3, inner: null, shadow: false });
  sparkle(g, 92, 30, 10, 0.95);
}

function wanted(g) {
  const r = artRng(11);
  const p = new Path2D();
  // torn-edge parchment
  const L = 16;
  const R = 112;
  const T = 8;
  const B = 122;
  p.moveTo(L, T);
  for (let x = L; x <= R; x += 8) p.lineTo(x, T + r() * 4);
  for (let y = T; y <= B; y += 8) p.lineTo(R - r() * 4, y);
  for (let x = R; x >= L; x -= 8) p.lineTo(x, B - r() * 4);
  for (let y = B; y >= T; y -= 8) p.lineTo(L + r() * 4, y);
  p.closePath();
  inked(g, p, rGrad(g, 64, 60, 10, 90, '#fff3d0', '#f0d79a', '#c99a52'), { inkW: 5, gloss: 0, rim: 'rgba(120,70,20,.4)' });
  // burnt edges
  g.save();
  g.clip(p);
  const burn = g.createRadialGradient(64, 64, 40, 64, 64, 80);
  burn.addColorStop(0, 'rgba(120,60,10,0)');
  burn.addColorStop(1, 'rgba(90,40,5,.55)');
  g.fillStyle = burn;
  g.fillRect(0, 0, 128, 128);
  g.restore();
  bevelText(g, 'WANTED', 64, 26, { font: `400 21px ${FONTS.western}`, fill: '#3a1a08', inkW: 0, inner: null, shadow: false, maxW: 88 });
  // outlaw silhouette
  g.save();
  g.fillStyle = '#4a2a10';
  g.beginPath();
  g.ellipse(64, 60, 13, 15, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.ellipse(64, 47, 26, 5, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.roundRect(52, 36, 24, 13, 5);
  g.fill();
  g.beginPath();
  g.moveTo(38, 92);
  g.quadraticCurveTo(42, 72, 64, 72);
  g.quadraticCurveTo(86, 72, 90, 92);
  g.closePath();
  g.fill();
  g.restore();
  // BONUS stamp
  g.save();
  g.translate(64, 102);
  g.rotate(-0.12);
  const stamp = roundRectPath(-42, -14, 84, 28, 5);
  g.fillStyle = 'rgba(200,20,20,.88)';
  g.fill(stamp);
  g.strokeStyle = '#fff1d0';
  g.lineWidth = 2;
  g.strokeRect(-38, -10, 76, 20);
  bevelText(g, 'BONUS', 0, 1, { font: `400 22px ${FONTS.display}`, fill: '#fff6e0', inkW: 0, inner: null, shadow: false, tracking: 2 });
  g.restore();
  // nail
  g.fillStyle = rGrad(g, 62, 12, 0, 6, '#e0e0e0', '#555');
  g.beginPath();
  g.arc(64, 14, 4, 0, TAU);
  g.fill();
}

function revolver(g) {
  g.save();
  g.translate(64, 64);
  g.rotate(-0.32);
  g.translate(-64, -64);
  const gold = metalGrad(g, 0, 40, 0, 84, METAL.gold);
  // barrel
  const barrel = roundRectPath(50, 46, 72, 14, 4);
  inked(g, barrel, gold, { inkW: 5, gloss: 0.3, bounds: { x: 50, y: 46, w: 72, h: 14 } });
  const rib = roundRectPath(50, 42, 70, 6, 2);
  inked(g, rib, metalGrad(g, 0, 42, 0, 48, METAL.goldDark), { inkW: 4, gloss: 0 });
  // frame
  const frame = new Path2D();
  frame.moveTo(30, 44);
  frame.lineTo(54, 44);
  frame.lineTo(58, 72);
  frame.lineTo(44, 78);
  frame.lineTo(30, 70);
  frame.closePath();
  inked(g, frame, gold, { inkW: 5, gloss: 0.2 });
  // cylinder
  const cyl = roundRectPath(36, 46, 22, 24, 6);
  inked(g, cyl, metalGrad(g, 0, 46, 0, 70, METAL.goldDark), { inkW: 4, gloss: 0.4, bounds: { x: 36, y: 46, w: 22, h: 24 } });
  g.strokeStyle = 'rgba(60,30,0,.7)';
  g.lineWidth = 1.5;
  for (const y of [52, 58, 64]) {
    g.beginPath();
    g.moveTo(39, y);
    g.lineTo(55, y);
    g.stroke();
  }
  // grip (pearl)
  const grip = new Path2D();
  grip.moveTo(30, 46);
  grip.bezierCurveTo(18, 52, 8, 80, 12, 104);
  grip.lineTo(32, 108);
  grip.bezierCurveTo(34, 90, 40, 76, 46, 70);
  grip.closePath();
  inked(g, grip, rGrad(g, 22, 74, 2, 40, '#fffaf0', '#e9ddc8', '#b9a88c'), { inkW: 5, gloss: 0.3, rim: 'rgba(255,255,255,.7)' });
  g.fillStyle = metalGrad(g, 0, 70, 0, 80, METAL.gold);
  g.beginPath();
  g.arc(24, 80, 3.5, 0, TAU);
  g.fill();
  // trigger guard + hammer
  g.lineWidth = 5;
  g.strokeStyle = '#1a0c06';
  g.beginPath();
  g.arc(48, 80, 9, 0.1, Math.PI * 0.9);
  g.stroke();
  g.lineWidth = 2.5;
  g.strokeStyle = metalGrad(g, 0, 72, 0, 90, METAL.gold);
  g.stroke();
  const hammer = new Path2D();
  hammer.moveTo(28, 44);
  hammer.lineTo(20, 34);
  hammer.lineTo(26, 32);
  hammer.lineTo(34, 44);
  hammer.closePath();
  inked(g, hammer, gold, { inkW: 4, gloss: 0 });
  // engraving scroll
  g.strokeStyle = 'rgba(110,60,0,.6)';
  g.lineWidth = 1.2;
  for (let x = 62; x < 116; x += 10) {
    g.beginPath();
    g.arc(x, 53, 3, 0, Math.PI * 1.5);
    g.stroke();
  }
  g.restore();
  sparkle(g, 100, 34, 9, 0.9);
}

function hat(g) {
  const felt = vGrad(g, 20, 104, '#c08a50', '#8a5428', '#4a2a10');
  // brim
  const brim = new Path2D();
  brim.moveTo(6, 80);
  brim.bezierCurveTo(10, 66, 30, 76, 64, 76);
  brim.bezierCurveTo(98, 76, 118, 66, 122, 80);
  brim.bezierCurveTo(118, 100, 90, 104, 64, 104);
  brim.bezierCurveTo(38, 104, 10, 100, 6, 80);
  brim.closePath();
  inked(g, brim, vGrad(g, 66, 104, '#b07a40', '#6a3c18', '#3a1e08'), { inkW: 6, gloss: 0.2 });
  // crown
  const crown = new Path2D();
  crown.moveTo(30, 82);
  crown.bezierCurveTo(26, 50, 32, 22, 46, 20);
  crown.bezierCurveTo(54, 19, 58, 28, 64, 28);
  crown.bezierCurveTo(70, 28, 74, 19, 82, 20);
  crown.bezierCurveTo(96, 22, 102, 50, 98, 82);
  crown.bezierCurveTo(82, 88, 46, 88, 30, 82);
  crown.closePath();
  inked(g, crown, felt, { inkW: 6, gloss: 0.3 });
  // crease shadow
  g.save();
  g.clip(crown);
  g.fillStyle = 'rgba(40,20,5,.35)';
  g.beginPath();
  g.ellipse(64, 34, 8, 16, 0, 0, TAU);
  g.fill();
  g.restore();
  // band
  const band = new Path2D();
  band.moveTo(31, 70);
  band.bezierCurveTo(50, 76, 78, 76, 97, 70);
  band.lineTo(98, 81);
  band.bezierCurveTo(78, 87, 50, 87, 30, 81);
  band.closePath();
  inked(g, band, vGrad(g, 70, 86, '#3a1a0a', '#1a0a04'), { inkW: 3, gloss: 0 });
  // concho
  const c = circlePath(64, 78, 6);
  inked(g, c, metalGrad(g, 0, 72, 0, 84, METAL.silver), { inkW: 3, gloss: 0.5 });
  // stitched brim edge
  g.save();
  g.setLineDash([3, 4]);
  g.strokeStyle = 'rgba(255,220,170,.45)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(12, 82);
  g.bezierCurveTo(20, 97, 50, 99, 64, 99);
  g.bezierCurveTo(78, 99, 108, 97, 116, 82);
  g.stroke();
  g.restore();
}

function boot(g) {
  const leather = vGrad(g, 6, 116, '#a05a28', '#6a3410', '#3a1a06');
  const b = new Path2D();
  b.moveTo(40, 8);
  b.lineTo(82, 8);
  b.lineTo(80, 68);
  b.bezierCurveTo(88, 76, 112, 80, 120, 92);
  b.bezierCurveTo(124, 100, 120, 106, 112, 106);
  b.lineTo(66, 106);
  b.lineTo(62, 114);
  b.lineTo(40, 114);
  b.lineTo(42, 70);
  b.closePath();
  inked(g, b, leather, { inkW: 6, gloss: 0.3 });
  // pull tabs & stitching
  g.save();
  g.clip(b);
  g.strokeStyle = 'rgba(255,215,150,.75)';
  g.lineWidth = 1.6;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(52, 16);
  g.bezierCurveTo(48, 30, 70, 34, 62, 50);
  g.bezierCurveTo(56, 60, 72, 64, 66, 72);
  g.moveTo(44, 72);
  g.bezierCurveTo(60, 76, 70, 74, 80, 70);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = 'rgba(30,12,2,.55)';
  g.fillRect(36, 98, 90, 18);
  g.restore();
  // heel
  const heel = roundRectPath(40, 104, 22, 12, 3);
  inked(g, heel, vGrad(g, 104, 116, '#3a1e0a', '#1a0a02'), { inkW: 4, gloss: 0 });
  // spur
  g.save();
  g.strokeStyle = '#1a0c06';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(42, 98);
  g.lineTo(22, 96);
  g.stroke();
  g.strokeStyle = metalGrad(g, 0, 90, 0, 102, METAL.silver);
  g.lineWidth = 3;
  g.stroke();
  g.restore();
  const rowel = star(18, 96, 8, 15, 5, 0.2);
  inked(g, rowel, metalGrad(g, 0, 80, 0, 112, METAL.silver), { inkW: 4, gloss: 0.4 });
  g.fillStyle = '#2a2a2a';
  g.beginPath();
  g.arc(18, 96, 3, 0, TAU);
  g.fill();
}

function horseshoe(g) {
  const p = new Path2D();
  p.moveTo(26, 118);
  p.lineTo(20, 70);
  p.bezierCurveTo(14, 30, 40, 8, 64, 8);
  p.bezierCurveTo(88, 8, 114, 30, 108, 70);
  p.lineTo(102, 118);
  p.lineTo(80, 118);
  p.lineTo(84, 72);
  p.bezierCurveTo(88, 44, 78, 32, 64, 32);
  p.bezierCurveTo(50, 32, 40, 44, 44, 72);
  p.lineTo(48, 118);
  p.closePath();
  inked(g, p, metalGrad(g, 10, 8, 118, 118, METAL.gold), { inkW: 6, gloss: 0.4 });
  // groove + nail holes
  g.save();
  g.strokeStyle = 'rgba(90,50,0,.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(37, 112);
  g.lineTo(32, 70);
  g.bezierCurveTo(28, 38, 46, 20, 64, 20);
  g.bezierCurveTo(82, 20, 100, 38, 96, 70);
  g.lineTo(91, 112);
  g.stroke();
  g.fillStyle = '#3a2004';
  for (const [x, y] of [[33, 96], [30, 72], [36, 46], [95, 96], [98, 72], [92, 46]]) {
    g.beginPath();
    g.roundRect(x - 2.5, y - 4, 5, 8, 1.5);
    g.fill();
  }
  g.restore();
  sparkle(g, 40, 26, 9, 0.9);
}

/** Card ranks carved into weathered plank with a coloured enamel fill and brass rim. */
function rank(text, color, color2) {
  return (g) => {
    const plank = roundRectPath(18, 20, 92, 88, 10);
    g.save();
    g.globalAlpha = 0.0;
    g.restore();
    const font = `400 ${text.length > 1 ? 66 : 84}px ${FONTS.western}`;
    g.save();
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,.6)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 4;
    g.strokeStyle = '#1a0c06';
    g.lineWidth = 12;
    g.strokeText(text, 64, 70);
    g.shadowColor = 'transparent';
    g.strokeStyle = metalGrad(g, 0, 26, 0, 110, METAL.gold);
    g.lineWidth = 6;
    g.strokeText(text, 64, 70);
    g.fillStyle = vGrad(g, 30, 108, color2, color, '#1a0804');
    g.fillText(text, 64, 70);
    // top sheen
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.fillRect(0, 26, 128, 30);
    g.restore();
    void plank;
  };
}

export const WEST_ART = {
  W: sheriff,
  S: wanted,
  H1: revolver,
  H2: hat,
  H3: boot,
  H4: horseshoe,
  A: rank('A', '#b3261e', '#ff7a5a'),
  K: rank('K', '#1f6f8b', '#6fd3f0'),
  Q: rank('Q', '#3d7a2a', '#a6e07a'),
  J: rank('J', '#7a3a9a', '#d9a0ff'),
  T: rank('10', '#c86a10', '#ffc86a'),
};

/** Reel background behind the symbols (dark weathered wood). */
export function westReelBg(g, w, h) {
  g.fillStyle = vGrad(g, 0, h, '#2a170c', '#1a0e07', '#2a170c');
  g.fillRect(0, 0, w, h);
  const r = artRng(5);
  g.globalAlpha = 0.18;
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = r() < 0.5 ? '#000' : '#6a4024';
    g.lineWidth = 1 + r() * 2;
    const x = r() * w;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + (r() - 0.5) * 20, h * 0.3, x + (r() - 0.5) * 20, h * 0.6, x + (r() - 0.5) * 10, h);
    g.stroke();
  }
  g.globalAlpha = 1;
  void sheen;
}
