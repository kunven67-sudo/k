// Golden Pearl Dragon symbols: the dragon medallion (wild), gold ingot (scatter), flaming pearl
// (hold & spin coin), koi, red lantern, firecrackers, golden fan and jade/gold card ranks.

import { inked, metalGrad, vGrad, rGrad, bevelText, roundRectPath, circlePath, sparkle, artRng, FONTS, METAL, TAU } from './paint.js';

function medallion(g) {
  const disc = circlePath(64, 62, 52);
  inked(g, disc, metalGrad(g, 12, 10, 116, 114, METAL.gold), { inkW: 6, gloss: 0.3 });
  const inner = circlePath(64, 62, 42);
  g.fillStyle = rGrad(g, 56, 50, 4, 50, '#ff5a3a', '#c8101c', '#6a0208');
  g.fill(inner);
  g.strokeStyle = 'rgba(80,40,0,.8)';
  g.lineWidth = 2;
  g.stroke(inner);
  // stylised dragon: an S-coil body with dorsal spikes and a head with whiskers
  g.save();
  g.clip(inner);
  const body = new Path2D();
  body.moveTo(24, 92);
  body.bezierCurveTo(30, 60, 66, 92, 70, 62);
  body.bezierCurveTo(74, 34, 40, 44, 50, 30);
  g.lineCap = 'round';
  g.strokeStyle = '#3a1a00';
  g.lineWidth = 15;
  g.stroke(body);
  g.strokeStyle = metalGrad(g, 0, 26, 0, 96, METAL.gold);
  g.lineWidth = 10;
  g.stroke(body);
  // scale ticks
  g.strokeStyle = 'rgba(120,60,0,.65)';
  g.lineWidth = 1.5;
  for (let t = 0.05; t < 0.95; t += 0.07) {
    const [x, y] = bez(t, [24, 92], [30, 60], [66, 92], [70, 62]);
    g.beginPath();
    g.arc(x, y, 3, 0, Math.PI);
    g.stroke();
  }
  // spikes along the outer curve
  g.fillStyle = metalGrad(g, 0, 26, 0, 96, METAL.goldDark);
  for (let t = 0.12; t < 0.9; t += 0.12) {
    const [x, y] = bez(t, [24, 92], [30, 60], [66, 92], [70, 62]);
    g.beginPath();
    g.moveTo(x - 3, y - 5);
    g.lineTo(x + 1, y - 14);
    g.lineTo(x + 4, y - 4);
    g.fill();
  }
  g.restore();
  // head
  const head = new Path2D();
  head.moveTo(46, 26);
  head.bezierCurveTo(56, 14, 80, 16, 88, 26);
  head.lineTo(98, 30);
  head.lineTo(88, 36);
  head.bezierCurveTo(80, 44, 60, 44, 48, 38);
  head.closePath();
  inked(g, head, metalGrad(g, 0, 16, 0, 44, METAL.gold), { inkW: 4, gloss: 0.3, shadow: false });
  g.fillStyle = '#c8101c';
  g.beginPath();
  g.arc(70, 27, 3, 0, TAU);
  g.fill();
  g.strokeStyle = metalGrad(g, 0, 20, 0, 60, METAL.gold);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(92, 34);
  g.bezierCurveTo(104, 44, 96, 56, 108, 60);
  g.moveTo(52, 22);
  g.bezierCurveTo(46, 10, 56, 8, 52, 2);
  g.stroke();
  bevelText(g, 'WILD', 64, 102, { font: `700 26px ${FONTS.serif}`, fill: metalGrad(g, 0, 90, 0, 114, METAL.gold), ink: '#3a0204', inkW: 6, tracking: 1 });
  sparkle(g, 100, 18, 10, 0.95);
}

function bez(t, a, b, c, d) {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

function ingot(g) {
  const p = new Path2D();
  p.moveTo(8, 50);
  p.bezierCurveTo(14, 44, 26, 44, 34, 54);
  p.bezierCurveTo(40, 34, 88, 34, 94, 54);
  p.bezierCurveTo(102, 44, 114, 44, 120, 50);
  p.bezierCurveTo(116, 76, 100, 96, 64, 96);
  p.bezierCurveTo(28, 96, 12, 76, 8, 50);
  p.closePath();
  inked(g, p, metalGrad(g, 10, 30, 110, 100, METAL.gold), { inkW: 6, gloss: 0.4 });
  const dome = new Path2D();
  dome.ellipse(64, 54, 26, 17, 0, Math.PI, 0);
  dome.bezierCurveTo(90, 62, 38, 62, 38, 54);
  inked(g, dome, metalGrad(g, 0, 36, 0, 62, METAL.gold), { inkW: 4, gloss: 0.6, shadow: false, bounds: { x: 38, y: 36, w: 52, h: 26 } });
  // red ribbon BONUS
  const ban = roundRectPath(20, 98, 88, 24, 6);
  inked(g, ban, vGrad(g, 98, 122, '#ff5a3a', '#c8101c', '#6a0208'), { inkW: 4, gloss: 0.3, bounds: { x: 20, y: 98, w: 88, h: 24 } });
  bevelText(g, 'BONUS', 64, 111, { font: `400 22px ${FONTS.display}`, fill: metalGrad(g, 0, 98, 0, 122, METAL.gold), inkW: 4, inner: null, tracking: 3 });
  sparkle(g, 92, 30, 11, 1);
  sparkle(g, 34, 66, 6, 0.7);
}

/** Flaming pearl. `value` text (e.g. "2.50" or "MINI") is drawn by the screen on top. */
function pearl(g) {
  const r = artRng(3);
  // flames
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + r() * 0.2;
    const len = 34 + r() * 22;
    g.fillStyle = `rgba(255,${120 + (r() * 80) | 0},20,.35)`;
    g.beginPath();
    g.moveTo(64 + Math.cos(a - 0.25) * 30, 64 + Math.sin(a - 0.25) * 30);
    g.quadraticCurveTo(64 + Math.cos(a) * (len + 12), 64 + Math.sin(a) * (len + 12), 64 + Math.cos(a + 0.35) * len * 1.25, 64 + Math.sin(a + 0.35) * len * 1.25);
    g.quadraticCurveTo(64 + Math.cos(a + 0.2) * 40, 64 + Math.sin(a + 0.2) * 40, 64 + Math.cos(a + 0.25) * 30, 64 + Math.sin(a + 0.25) * 30);
    g.fill();
  }
  g.restore();
  const orb = circlePath(64, 64, 36);
  inked(g, orb, rGrad(g, 52, 50, 3, 44, '#fffbea', '#ffd9a0', '#ff8a2a', '#b0300a'), { inkW: 5, gloss: 0.6, rim: 'rgba(255,240,200,.8)' });
  g.save();
  g.clip(orb);
  g.globalAlpha = 0.3;
  g.strokeStyle = '#fff';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(64, 64, 26, -2.6, -1.2);
  g.stroke();
  g.restore();
}

function koi(g) {
  g.save();
  g.translate(64, 64);
  g.rotate(-0.5);
  g.translate(-64, -64);
  // tail
  const tail = new Path2D();
  tail.moveTo(30, 66);
  tail.bezierCurveTo(14, 50, 6, 44, 4, 40);
  tail.bezierCurveTo(12, 62, 10, 76, 4, 92);
  tail.bezierCurveTo(12, 86, 20, 80, 30, 70);
  tail.closePath();
  inked(g, tail, vGrad(g, 40, 92, '#ffd0a0', '#ff7a2a', '#d0400a'), { inkW: 4, gloss: 0.2 });
  const body = new Path2D();
  body.moveTo(28, 68);
  body.bezierCurveTo(44, 44, 86, 36, 112, 56);
  body.bezierCurveTo(122, 64, 118, 74, 108, 78);
  body.bezierCurveTo(82, 92, 46, 88, 28, 68);
  body.closePath();
  inked(g, body, rGrad(g, 80, 54, 4, 70, '#fff6ea', '#ffe0c0', '#f0b080'), { inkW: 5, gloss: 0.3 });
  g.save();
  g.clip(body);
  // orange patches + scales
  g.fillStyle = '#ff5a14';
  g.beginPath();
  g.ellipse(84, 52, 18, 10, 0.2, 0, TAU);
  g.ellipse(52, 70, 14, 8, -0.3, 0, TAU);
  g.fill();
  g.fillStyle = '#d01a10';
  g.beginPath();
  g.ellipse(100, 60, 8, 6, 0, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(160,60,20,.35)';
  g.lineWidth = 1;
  for (let x = 40; x < 100; x += 7) {
    for (let y = 50; y < 86; y += 7) {
      g.beginPath();
      g.arc(x + ((y / 7) % 2) * 3.5, y, 4, 0.2, Math.PI - 0.2);
      g.stroke();
    }
  }
  g.restore();
  // fins
  for (const [x, y, rot] of [[64, 82, 0.6], [80, 44, -2.4]]) {
    const fin = new Path2D();
    fin.ellipse(x, y, 12, 5, rot, 0, TAU);
    inked(g, fin, 'rgba(255,170,110,.9)', { inkW: 3, gloss: 0, shadow: false });
  }
  // eye + whisker
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(106, 62, 3.2, 0, TAU);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(105, 61, 1, 0, TAU);
  g.fill();
  g.strokeStyle = '#8a3a10';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(114, 70);
  g.quadraticCurveTo(122, 80, 116, 88);
  g.stroke();
  g.restore();
  // splash
  for (const [x, y, rr] of [[20, 20, 4], [30, 12, 3], [110, 106, 4], [98, 116, 2.5]]) {
    g.fillStyle = 'rgba(170,230,255,.85)';
    g.beginPath();
    g.arc(x, y, rr, 0, TAU);
    g.fill();
  }
}

function lantern(g) {
  // tassel
  g.strokeStyle = '#1a0402';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(64, 104);
  g.lineTo(64, 124);
  g.stroke();
  g.strokeStyle = vGrad(g, 104, 124, '#ff4a3a', '#a00a10');
  g.lineWidth = 4;
  g.stroke();
  const body = new Path2D();
  body.ellipse(64, 62, 46, 40, 0, 0, TAU);
  inked(g, body, rGrad(g, 50, 46, 4, 58, '#ffb070', '#ff3a20', '#b0080e', '#4a0204'), { inkW: 6, gloss: 0.35 });
  g.save();
  g.clip(body);
  g.strokeStyle = 'rgba(80,0,0,.45)';
  g.lineWidth = 2;
  for (const k of [-0.75, -0.42, 0, 0.42, 0.75]) {
    g.beginPath();
    g.ellipse(64, 62, 46 * Math.abs(k) + 0.1, 40, 0, 0, TAU);
    g.stroke();
  }
  // glow inside
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = rGrad(g, 64, 62, 0, 40, 'rgba(255,220,120,.45)', 'rgba(255,120,40,0)');
  g.fillRect(0, 0, 128, 128);
  g.restore();
  for (const y of [18, 96]) {
    const cap = roundRectPath(38, y, 52, 12, 4);
    inked(g, cap, metalGrad(g, 0, y, 0, y + 12, METAL.gold), { inkW: 4, gloss: 0.4, bounds: { x: 38, y, w: 52, h: 12 } });
  }
  // gold lattice knot on the paper (a classic lantern ornament)
  g.save();
  g.translate(64, 62);
  g.rotate(Math.PI / 4);
  const knot = new Path2D();
  knot.rect(-13, -13, 26, 26);
  knot.rect(-7, -7, 14, 14);
  g.lineWidth = 6;
  g.strokeStyle = '#5a0204';
  g.stroke(knot);
  g.lineWidth = 3;
  g.strokeStyle = metalGrad(g, -14, -14, 14, 14, METAL.gold);
  g.stroke(knot);
  g.restore();
  g.strokeStyle = '#1a0402';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(64, 18);
  g.lineTo(64, 4);
  g.stroke();
}

function firecrackers(g) {
  const tubes = [[40, 30, -0.35], [64, 22, 0], [88, 30, 0.35], [52, 46, -0.15], [76, 46, 0.15]];
  for (const [x, y, rot] of tubes) {
    g.save();
    g.translate(x, y + 30);
    g.rotate(rot);
    const t = roundRectPath(-11, -32, 22, 64, 5);
    inked(g, t, metalGrad(g, -11, 0, 11, 0, ['#ff9a8a', '#ff3a2a', '#c0101a', '#6a0208', '#d01a20', '#ff6a5a']), { inkW: 4, gloss: 0.3, bounds: { x: -11, y: -32, w: 22, h: 64 } });
    g.fillStyle = metalGrad(g, 0, -4, 0, 4, METAL.gold);
    g.fillRect(-11, -4, 22, 6);
    g.fillRect(-11, -28, 22, 4);
    g.fillRect(-11, 24, 22, 4);
    g.restore();
  }
  // fuse + spark
  g.strokeStyle = '#3a2a10';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(64, 22);
  g.quadraticCurveTo(70, 10, 82, 8);
  g.stroke();
  sparkle(g, 84, 8, 14, 1, '255,230,140');
  const cord = new Path2D();
  cord.moveTo(30, 104);
  cord.quadraticCurveTo(64, 120, 98, 104);
  g.strokeStyle = metalGrad(g, 0, 100, 0, 120, METAL.gold);
  g.lineWidth = 5;
  g.stroke(cord);
}

function fan(g) {
  const ribs = 11;
  const cx = 64;
  const cy = 108;
  const R = 92;
  const a0 = Math.PI * 1.12;
  const a1 = Math.PI * 1.88;
  const leaf = new Path2D();
  leaf.moveTo(cx + Math.cos(a0) * 26, cy + Math.sin(a0) * 26);
  leaf.arc(cx, cy, R, a0, a1);
  leaf.arc(cx, cy, 26, a1, a0, true);
  leaf.closePath();
  inked(g, leaf, rGrad(g, cx, cy, 20, R, '#fff0c0', '#ffcc4a', '#e04a20', '#9a0a10'), { inkW: 6, gloss: 0.3 });
  g.save();
  g.clip(leaf);
  // folds
  for (let i = 0; i < ribs * 2; i++) {
    const a = a0 + ((a1 - a0) * i) / (ribs * 2);
    g.fillStyle = i % 2 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.12)';
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, R + 2, a, a + (a1 - a0) / (ribs * 2));
    g.closePath();
    g.fill();
  }
  // painted plum blossoms
  for (const [x, y] of [[40, 42], [84, 34], [62, 56], [96, 58]]) {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU;
      g.fillStyle = 'rgba(255,240,245,.9)';
      g.beginPath();
      g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.4, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#c8101c';
    g.beginPath();
    g.arc(x, y, 2, 0, TAU);
    g.fill();
  }
  g.restore();
  g.strokeStyle = metalGrad(g, 0, 20, 0, 110, METAL.goldDark);
  g.lineWidth = 2.5;
  for (let i = 0; i <= ribs; i++) {
    const a = a0 + ((a1 - a0) * i) / ribs;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    g.lineTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
    g.stroke();
  }
  const pin = circlePath(cx, cy - 2, 7);
  inked(g, pin, metalGrad(g, 0, cy - 9, 0, cy + 5, METAL.gold), { inkW: 3, gloss: 0.5, shadow: false });
}

function jadeRank(text, pal) {
  return (g) => {
    const font = `700 ${text.length > 1 ? 64 : 82}px ${FONTS.serif}`;
    g.save();
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,0,0,.6)';
    g.shadowBlur = 8;
    g.shadowOffsetY = 4;
    g.strokeStyle = '#1a0604';
    g.lineWidth = 12;
    g.strokeText(text, 64, 68);
    g.shadowColor = 'transparent';
    g.strokeStyle = metalGrad(g, 0, 24, 0, 110, METAL.gold);
    g.lineWidth = 6;
    g.strokeText(text, 64, 68);
    g.fillStyle = metalGrad(g, 0, 26, 0, 110, pal);
    g.fillText(text, 64, 68);
    g.restore();
  };
}

export const DRAGON_ART = {
  W: medallion,
  S: ingot,
  C: pearl,
  H1: koi,
  H2: lantern,
  H3: firecrackers,
  H4: fan,
  A: jadeRank('A', METAL.ruby),
  K: jadeRank('K', METAL.jade),
  Q: jadeRank('Q', ['#e6f0ff', '#7aa8ff', '#2a4ab0', '#0a1450', '#4a6ad0', '#c0d6ff']),
  J: jadeRank('J', ['#ffe6ff', '#e07aff', '#8a2ab0', '#3a0a50', '#b04ad0', '#f0c0ff']),
  T: jadeRank('10', METAL.copper),
};

export function dragonReelBg(g, w, h) {
  g.fillStyle = vGrad(g, 0, h, '#3a0406', '#22020a', '#3a0406');
  g.fillRect(0, 0, w, h);
  // faint cloud scroll pattern
  g.strokeStyle = 'rgba(255,190,90,.07)';
  g.lineWidth = 2;
  const r = artRng(4);
  for (let i = 0; i < 26; i++) {
    const x = r() * w;
    const y = r() * h;
    const s = 8 + r() * 12;
    g.beginPath();
    g.arc(x, y, s, Math.PI, TAU);
    g.arc(x + s * 1.5, y, s * 0.5, Math.PI, TAU);
    g.stroke();
  }
}
