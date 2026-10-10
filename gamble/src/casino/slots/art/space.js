// Saucer Stampede symbols: flying saucer (wild), ringed planet (scatter), little green alien,
// abducted cow, retro rocket, ray gun and neon-tube card ranks. 128×128 design box.

import { inked, metalGrad, vGrad, rGrad, bevelText, roundRectPath, circlePath, sparkle, artRng, FONTS, METAL, TAU } from './paint.js';

function saucer(g) {
  // beam
  g.save();
  const beam = g.createLinearGradient(0, 64, 0, 128);
  beam.addColorStop(0, 'rgba(140,255,170,.55)');
  beam.addColorStop(1, 'rgba(140,255,170,0)');
  g.fillStyle = beam;
  g.beginPath();
  g.moveTo(48, 70);
  g.lineTo(80, 70);
  g.lineTo(104, 128);
  g.lineTo(24, 128);
  g.closePath();
  g.fill();
  g.restore();
  // dome
  const dome = new Path2D();
  dome.ellipse(64, 46, 26, 24, 0, Math.PI, 0);
  dome.closePath();
  inked(g, dome, rGrad(g, 56, 34, 2, 30, '#e8fffb', '#7fe8ff', '#1a7fb0', '#0a3050'), { inkW: 5, gloss: 0.6, bounds: { x: 38, y: 22, w: 52, h: 26 } });
  // pilot silhouette
  g.save();
  g.clip(dome);
  g.fillStyle = 'rgba(40,140,60,.85)';
  g.beginPath();
  g.ellipse(64, 40, 9, 11, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#071a10';
  g.beginPath();
  g.ellipse(60, 39, 3, 4.5, 0.3, 0, TAU);
  g.ellipse(68, 39, 3, 4.5, -0.3, 0, TAU);
  g.fill();
  g.restore();
  // hull
  const hull = new Path2D();
  hull.ellipse(64, 54, 58, 17, 0, 0, TAU);
  inked(g, hull, metalGrad(g, 0, 38, 0, 72, METAL.silver), { inkW: 6, gloss: 0.3, bounds: { x: 6, y: 37, w: 116, h: 34 } });
  const belly = new Path2D();
  belly.ellipse(64, 62, 34, 9, 0, 0, Math.PI);
  g.fillStyle = 'rgba(30,40,55,.55)';
  g.fill(belly);
  // rim lights
  const cols = ['#ff4af0', '#ffe94a', '#4affb4', '#4ac8ff'];
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.08 + (i / 8) * 0.84);
    const x = 64 - Math.cos(a) * 46;
    const y = 56 + Math.sin(a) * 9;
    g.fillStyle = cols[i % 4];
    g.shadowColor = cols[i % 4];
    g.shadowBlur = 8;
    g.beginPath();
    g.arc(x, y, 3.6, 0, TAU);
    g.fill();
  }
  g.shadowBlur = 0;
  bevelText(g, 'WILD', 64, 98, { font: `400 34px ${FONTS.display}`, fill: vGrad(g, 82, 114, '#eaffd0', '#7dff5a', '#1fa82a'), ink: '#06240c', inkW: 7, tracking: 3 });
}

function planet(g) {
  // back ring
  g.save();
  g.translate(64, 62);
  g.rotate(-0.35);
  g.lineWidth = 9;
  g.strokeStyle = '#2a0b30';
  g.beginPath();
  g.ellipse(0, 0, 60, 16, 0, Math.PI, TAU);
  g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = vGrad(g, -16, 16, '#ffd6a0', '#ff8a4a');
  g.stroke();
  g.restore();
  const body = circlePath(64, 62, 38);
  inked(g, body, rGrad(g, 50, 46, 4, 46, '#ffc0f0', '#e04ac0', '#7a1a8a', '#2a0838'), { inkW: 6, gloss: 0.4 });
  g.save();
  g.clip(body);
  g.globalAlpha = 0.35;
  g.strokeStyle = '#ffd6f6';
  for (let i = 0; i < 5; i++) {
    g.lineWidth = 2 + i;
    g.beginPath();
    g.ellipse(64, 40 + i * 12, 46, 5, -0.35, 0, TAU);
    g.stroke();
  }
  g.restore();
  // front ring
  g.save();
  g.translate(64, 62);
  g.rotate(-0.35);
  g.lineWidth = 9;
  g.strokeStyle = '#2a0b30';
  g.beginPath();
  g.ellipse(0, 0, 60, 16, 0, 0, Math.PI);
  g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = vGrad(g, -16, 16, '#fff0c0', '#ffa04a');
  g.stroke();
  g.restore();
  // banner
  const ban = roundRectPath(22, 94, 84, 26, 7);
  inked(g, ban, vGrad(g, 94, 120, '#ffef6a', '#ffb000', '#b05a00'), { inkW: 5, gloss: 0.4, bounds: { x: 22, y: 94, w: 84, h: 26 } });
  bevelText(g, 'BONUS', 64, 108, { font: `400 25px ${FONTS.display}`, fill: '#5a1600', inkW: 0, inner: null, shadow: false, tracking: 2 });
  sparkle(g, 96, 22, 10, 0.95);
  sparkle(g, 20, 34, 6, 0.7);
}

function alien(g) {
  const head = new Path2D();
  head.moveTo(64, 10);
  head.bezierCurveTo(104, 10, 118, 40, 112, 66);
  head.bezierCurveTo(104, 96, 80, 118, 64, 118);
  head.bezierCurveTo(48, 118, 24, 96, 16, 66);
  head.bezierCurveTo(10, 40, 24, 10, 64, 10);
  head.closePath();
  inked(g, head, rGrad(g, 48, 36, 6, 90, '#d6ffb0', '#72d63c', '#2a8a14', '#0a3a06'), { inkW: 6, gloss: 0.35 });
  for (const s of [-1, 1]) {
    const eye = new Path2D();
    eye.ellipse(64 + s * 22, 62, 17, 25, s * -0.62, 0, TAU);
    g.save();
    g.fillStyle = rGrad(g, 64 + s * 22, 58, 2, 28, '#2a2a3a', '#05050a');
    g.fill(eye);
    g.strokeStyle = 'rgba(0,0,0,.6)';
    g.lineWidth = 2;
    g.stroke(eye);
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath();
    g.ellipse(64 + s * 22 - 5, 52, 4.5, 7, s * -0.6, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(140,255,200,.55)';
    g.beginPath();
    g.ellipse(64 + s * 22 + 4, 72, 3, 5, s * -0.6, 0, TAU);
    g.fill();
    g.restore();
  }
  // grin
  g.strokeStyle = '#0a3a06';
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(54, 98);
  g.quadraticCurveTo(64, 104, 74, 98);
  g.stroke();
}

function cow(g) {
  // ears
  for (const s of [-1, 1]) {
    const ear = new Path2D();
    ear.ellipse(64 + s * 46, 44, 16, 9, s * 0.4, 0, TAU);
    inked(g, ear, vGrad(g, 34, 54, '#f2e6e0', '#b9a59a'), { inkW: 5, gloss: 0.2 });
    g.fillStyle = 'rgba(240,140,150,.8)';
    g.beginPath();
    g.ellipse(64 + s * 46, 45, 9, 4.5, s * 0.4, 0, TAU);
    g.fill();
    const horn = new Path2D();
    horn.moveTo(64 + s * 22, 26);
    horn.quadraticCurveTo(64 + s * 34, 6, 64 + s * 26, 2);
    horn.quadraticCurveTo(64 + s * 22, 14, 64 + s * 14, 26);
    horn.closePath();
    inked(g, horn, vGrad(g, 2, 26, '#fffbe6', '#d9c99a'), { inkW: 4, gloss: 0.3 });
  }
  const head = new Path2D();
  head.moveTo(64, 18);
  head.bezierCurveTo(92, 18, 100, 42, 96, 70);
  head.lineTo(32, 70);
  head.bezierCurveTo(28, 42, 36, 18, 64, 18);
  head.closePath();
  inked(g, head, rGrad(g, 56, 34, 4, 60, '#ffffff', '#ece6e2', '#b8aca4'), { inkW: 6, gloss: 0.2 });
  // spots
  g.save();
  g.clip(head);
  g.fillStyle = '#1e1a1c';
  g.beginPath();
  g.moveTo(70, 18);
  g.bezierCurveTo(96, 16, 102, 46, 88, 52);
  g.bezierCurveTo(78, 56, 82, 34, 66, 34);
  g.closePath();
  g.fill();
  g.beginPath();
  g.ellipse(40, 56, 9, 12, 0.4, 0, TAU);
  g.fill();
  g.restore();
  // muzzle
  const muz = new Path2D();
  muz.ellipse(64, 86, 34, 26, 0, 0, TAU);
  inked(g, muz, rGrad(g, 56, 76, 4, 40, '#ffd0d8', '#f29aab', '#c8607a'), { inkW: 6, gloss: 0.35 });
  g.fillStyle = '#6a2236';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(64 + s * 13, 86, 5, 8, s * 0.25, 0, TAU);
    g.fill();
  }
  // eyes (startled — it's being abducted)
  for (const s of [-1, 1]) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(64 + s * 16, 44, 9, 0, TAU);
    g.fill();
    g.strokeStyle = '#1a1a1a';
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(64 + s * 15, 45, 4.5, 0, TAU);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(64 + s * 13.5, 43, 1.6, 0, TAU);
    g.fill();
  }
}

function rocket(g) {
  g.save();
  g.translate(64, 64);
  g.rotate(0.6);
  g.translate(-64, -64);
  // flame
  const fl = new Path2D();
  fl.moveTo(52, 96);
  fl.quadraticCurveTo(64, 142, 76, 96);
  fl.closePath();
  g.fillStyle = vGrad(g, 92, 132, '#fff8c0', '#ffb020', 'rgba(255,60,0,0)');
  g.fill(fl);
  // fins
  for (const s of [-1, 1]) {
    const fin = new Path2D();
    fin.moveTo(64 + s * 16, 66);
    fin.quadraticCurveTo(64 + s * 36, 80, 64 + s * 34, 104);
    fin.lineTo(64 + s * 14, 92);
    fin.closePath();
    inked(g, fin, vGrad(g, 66, 104, '#ff6a5a', '#c01020', '#6a0410'), { inkW: 5, gloss: 0.3 });
  }
  const body = new Path2D();
  body.moveTo(64, 6);
  body.bezierCurveTo(88, 26, 86, 70, 78, 98);
  body.lineTo(50, 98);
  body.bezierCurveTo(42, 70, 40, 26, 64, 6);
  body.closePath();
  inked(g, body, metalGrad(g, 40, 0, 88, 0, METAL.silver), { inkW: 6, gloss: 0.2 });
  // nose cone
  g.save();
  g.clip(body);
  g.fillStyle = vGrad(g, 6, 30, '#ff6a5a', '#c01020');
  g.fillRect(0, 0, 128, 28);
  g.fillStyle = '#1a0c10';
  g.fillRect(0, 27, 128, 2);
  g.restore();
  // porthole
  const ph = circlePath(64, 50, 11);
  inked(g, ph, metalGrad(g, 0, 39, 0, 61, METAL.copper), { inkW: 4, gloss: 0 });
  const glass = circlePath(64, 50, 7);
  g.fillStyle = rGrad(g, 61, 47, 1, 9, '#e0fbff', '#3ab0e0', '#0a3050');
  g.fill(glass);
  g.restore();
  sparkle(g, 24, 24, 8, 0.8);
}

function raygun(g) {
  g.save();
  g.translate(64, 64);
  g.rotate(-0.25);
  g.translate(-64, -64);
  // grip
  const grip = new Path2D();
  grip.moveTo(34, 60);
  grip.lineTo(52, 60);
  grip.lineTo(46, 112);
  grip.bezierCurveTo(40, 118, 26, 116, 24, 108);
  grip.closePath();
  inked(g, grip, vGrad(g, 60, 116, '#ff5a6a', '#b0102a', '#5a0414'), { inkW: 5, gloss: 0.3 });
  g.strokeStyle = 'rgba(0,0,0,.35)';
  g.lineWidth = 2;
  for (let y = 72; y < 108; y += 8) {
    g.beginPath();
    g.moveTo(31, y);
    g.lineTo(48, y);
    g.stroke();
  }
  // body
  const body = new Path2D();
  body.moveTo(18, 44);
  body.bezierCurveTo(18, 30, 40, 26, 58, 32);
  body.lineTo(84, 40);
  body.lineTo(84, 64);
  body.lineTo(58, 70);
  body.bezierCurveTo(40, 74, 18, 62, 18, 44);
  body.closePath();
  inked(g, body, metalGrad(g, 0, 28, 0, 72, METAL.silver), { inkW: 6, gloss: 0.4 });
  // rings
  for (const x of [88, 100, 112]) {
    const r = new Path2D();
    r.ellipse(x, 52, 5, 16 - (x - 88) * 0.25, 0, 0, TAU);
    inked(g, r, metalGrad(g, 0, 36, 0, 68, METAL.copper), { inkW: 4, gloss: 0.3, shadow: false });
  }
  // emitter
  const em = circlePath(120, 52, 6);
  g.fillStyle = rGrad(g, 120, 52, 0, 10, '#ffffff', '#7affd0', 'rgba(0,255,160,0)');
  g.fill(em);
  // fin + power cell
  const fin = new Path2D();
  fin.moveTo(30, 34);
  fin.lineTo(22, 14);
  fin.lineTo(44, 30);
  fin.closePath();
  inked(g, fin, vGrad(g, 14, 34, '#ff5a6a', '#b0102a'), { inkW: 4, gloss: 0 });
  const cell = roundRectPath(40, 40, 30, 12, 6);
  g.fillStyle = vGrad(g, 40, 52, '#d6ffe0', '#3aff9a', '#0a8a4a');
  g.shadowColor = '#3aff9a';
  g.shadowBlur = 10;
  g.fill(cell);
  g.shadowBlur = 0;
  g.restore();
  sparkle(g, 112, 30, 10, 0.9, '200,255,230');
}

/** Neon tube letters: a coloured glow, a white-hot core and a dark mounting outline. */
function neonRank(text, color) {
  return (g) => {
    const size = text.length > 1 ? 70 : 88;
    g.save();
    g.font = `400 ${size}px ${FONTS.display}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(8,4,20,.9)';
    g.lineWidth = 14;
    g.strokeText(text, 64, 68);
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.strokeStyle = color;
    g.lineWidth = 8;
    g.strokeText(text, 64, 68);
    g.shadowBlur = 6;
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2.5;
    g.strokeText(text, 64, 68);
    g.globalAlpha = 0.25;
    g.fillStyle = color;
    g.fillText(text, 64, 68);
    g.restore();
  };
}

export const SPACE_ART = {
  W: saucer,
  S: planet,
  H1: alien,
  H2: cow,
  H3: rocket,
  H4: raygun,
  A: neonRank('A', '#ff3ea5'),
  K: neonRank('K', '#38d9ff'),
  Q: neonRank('Q', '#7dff4a'),
  J: neonRank('J', '#ffd23a'),
  T: neonRank('10', '#b46aff'),
};

/** Deep-space reel background with stars. */
export function spaceReelBg(g, w, h) {
  g.fillStyle = vGrad(g, 0, h, '#0a0620', '#140a38', '#0a0620');
  g.fillRect(0, 0, w, h);
  const r = artRng(9);
  for (let i = 0; i < 120; i++) {
    const a = r();
    g.fillStyle = `rgba(255,255,255,${0.15 + a * 0.6})`;
    g.fillRect(r() * w, r() * h, a > 0.9 ? 2 : 1, a > 0.9 ? 2 : 1);
  }
  const neb = g.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.6);
  neb.addColorStop(0, 'rgba(160,60,255,.18)');
  neb.addColorStop(1, 'rgba(160,60,255,0)');
  g.fillStyle = neb;
  g.fillRect(0, 0, w, h);
}
