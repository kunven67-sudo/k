// Sierra Sevens reel-strip art (the printed film on the stepper's drums): the Sierra wild shield,
// red sevens, single/double/triple BARs and cherries. Drawn in a 128×128 design box.

import { inked, metalGrad, vGrad, rGrad, bevelText, roundRectPath, circlePath, sheen, sparkle, FONTS, METAL, TAU } from './paint.js';

/** Wild: a gold-rimmed shield with the snowy Sierra peaks and a red WILD ribbon. */
function wild(g) {
  const shield = new Path2D();
  shield.moveTo(64, 8);
  shield.bezierCurveTo(84, 16, 102, 16, 114, 12);
  shield.bezierCurveTo(118, 58, 104, 98, 64, 122);
  shield.bezierCurveTo(24, 98, 10, 58, 14, 12);
  shield.bezierCurveTo(26, 16, 44, 16, 64, 8);
  shield.closePath();
  inked(g, shield, metalGrad(g, 0, 8, 0, 122, METAL.gold), { inkW: 7, gloss: 0 });
  // inner field: dusk sky
  g.save();
  g.translate(64, 66);
  g.scale(0.8, 0.8);
  g.translate(-64, -66);
  g.fillStyle = vGrad(g, 14, 118, '#0b2a6b', '#1f5fc4', '#7cc0ff');
  g.fill(shield);
  g.clip(shield);
  // peaks
  const m = new Path2D();
  m.moveTo(0, 104);
  m.lineTo(30, 60);
  m.lineTo(42, 74);
  m.lineTo(64, 38);
  m.lineTo(88, 72);
  m.lineTo(98, 62);
  m.lineTo(128, 104);
  m.closePath();
  g.fillStyle = vGrad(g, 38, 104, '#ffffff', '#c9d9ee', '#5a6f8f');
  g.fill(m);
  g.fillStyle = '#3a4b66';
  g.beginPath();
  g.moveTo(64, 38);
  g.lineTo(72, 66);
  g.lineTo(80, 60);
  g.lineTo(88, 72);
  g.lineTo(64, 104);
  g.closePath();
  g.globalAlpha = 0.35;
  g.fill();
  g.globalAlpha = 1;
  g.restore();
  sheen(g, shield, 0.35);
  // ribbon
  const rb = new Path2D();
  rb.moveTo(6, 70);
  rb.lineTo(122, 70);
  rb.lineTo(114, 82);
  rb.lineTo(122, 94);
  rb.lineTo(6, 94);
  rb.lineTo(14, 82);
  rb.closePath();
  inked(g, rb, vGrad(g, 70, 94, '#ff5a4a', '#c8101c', '#7a0610'), { inkW: 5, gloss: 0.3, bounds: { x: 6, y: 70, w: 116, h: 24 } });
  bevelText(g, 'WILD', 64, 83, { font: `400 27px ${FONTS.display}`, fill: metalGrad(g, 0, 70, 0, 94, METAL.gold), inkW: 5, tracking: 2 });
  sparkle(g, 40, 24, 9, 0.9);
}

/** The red seven: a custom-cut 7 with a white inline and navy ink. */
function seven(g) {
  const p = new Path2D();
  p.moveTo(22, 14);
  p.lineTo(110, 14);
  p.lineTo(110, 32);
  p.bezierCurveTo(88, 56, 74, 84, 70, 118);
  p.lineTo(40, 118);
  p.bezierCurveTo(44, 86, 60, 58, 80, 38);
  p.lineTo(40, 38);
  p.lineTo(36, 46);
  p.lineTo(22, 46);
  p.closePath();
  g.save();
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(0,0,0,.5)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 4;
  g.strokeStyle = '#0d1b4a';
  g.lineWidth = 16;
  g.stroke(p);
  g.shadowColor = 'transparent';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.stroke(p);
  g.restore();
  inked(g, p, vGrad(g, 14, 118, '#ff6b5a', '#e01422', '#8c0610'), { inkW: 0, shadow: false, gloss: 0.5, rim: 'rgba(255,200,200,.5)' });
}

function barPlate(g, cy, h, trim) {
  const p = roundRectPath(12, cy - h / 2, 104, h, h * 0.22);
  inked(g, p, vGrad(g, cy - h / 2, cy + h / 2, '#3a3a3e', '#0c0c0e', '#1c1c20'), { inkW: 5, rim: trim, rimW: 2.5, gloss: 0.25, bounds: { x: 12, y: cy - h / 2, w: 104, h } });
  bevelText(g, 'BAR', 64, cy + 1, { font: `400 ${h * 0.86}px ${FONTS.display}`, fill: vGrad(g, cy - h / 2, cy + h / 2, '#ffffff', '#e6e1d4'), inkW: 0, inner: null, shadow: false, tracking: 3 });
}

function bars(n) {
  return (g) => {
    const trims = { 1: '#e9eef5', 2: '#ff4a4a', 3: '#ffcc3a' };
    const h = n === 1 ? 40 : n === 2 ? 32 : 27;
    const gap = n === 1 ? 0 : n === 2 ? 38 : 33;
    for (let i = 0; i < n; i++) barPlate(g, 64 + (i - (n - 1) / 2) * gap, h, trims[n]);
  };
}

function cherry(g) {
  // stems
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = '#1a2a08';
  g.lineWidth = 9;
  const stems = new Path2D();
  stems.moveTo(42, 84);
  stems.quadraticCurveTo(52, 46, 82, 22);
  stems.moveTo(88, 90);
  stems.quadraticCurveTo(84, 52, 82, 22);
  g.stroke(stems);
  g.strokeStyle = vGrad(g, 20, 90, '#8fd14a', '#3c7a14');
  g.lineWidth = 4.5;
  g.stroke(stems);
  g.restore();
  // leaf
  const leaf = new Path2D();
  leaf.moveTo(82, 22);
  leaf.bezierCurveTo(96, 8, 118, 12, 122, 22);
  leaf.bezierCurveTo(110, 34, 92, 34, 82, 22);
  inked(g, leaf, vGrad(g, 10, 34, '#a6e05a', '#3f8a1c'), { inkW: 5, gloss: 0.3 });
  g.strokeStyle = 'rgba(20,60,10,.6)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(84, 23);
  g.quadraticCurveTo(100, 20, 118, 22);
  g.stroke();
  // fruit
  for (const [x, y, r] of [[40, 90, 26], [88, 96, 26]]) {
    const c = circlePath(x, y, r);
    inked(g, c, rGrad(g, x - r * 0.35, y - r * 0.4, r * 0.1, r * 1.2, '#ff8a8a', '#e0101c', '#7a0008', '#3a0004'), { inkW: 6, gloss: 0, rim: 'rgba(255,160,160,.35)' });
    g.save();
    g.globalAlpha = 0.85;
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.beginPath();
    g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.28, r * 0.16, -0.6, 0, TAU);
    g.fill();
    g.restore();
  }
}

export const CLASSIC_ART = {
  W: wild,
  7: seven,
  B3: bars(3),
  B2: bars(2),
  B1: bars(1),
  CH: cherry,
  '-': () => {},
};
