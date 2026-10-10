// Playing-card art, drawn with canvas paths (no images): real pip layouts, corner indices, court
// cards with mirrored double-ended figures in the classic red / blue / yellow palette, and an
// Eldorado house back (red lattice, gold medallion, white border).
//
// Two 1024² atlases of 146 × 204 px cells (63 × 88 mm at 2.32 px/mm): cells 0..51 are the faces
// (index = suit * 13 + rank), cell 52 the back. CELL_LAYOUT tells the card shader where each is.

import { suitOf, rankOf, RANK_LABELS } from '../rules/blackjack.js';

export const CELL_W = 146;
export const CELL_H = 204;
export const COLS = 7;
export const ROWS = 5;
export const PER_ATLAS = COLS * ROWS;
export const BACK_CELL = 52;
const MM = CELL_W / 63; // px per mm

const RED = '#c0141f';
const BLACK = '#141416';
const INK = { 0: BLACK, 1: RED, 2: RED, 3: BLACK };
const C = { red: '#c42127', blue: '#26489a', yellow: '#f0b92c', black: '#121212', skin: '#f6d6b0', white: '#fbf7ee', gold: '#d9b25c' };

// ---- suit shapes (unit box, centred, height 1) ----------------------------------------------------

function heart(g) {
  g.moveTo(0, 0.5);
  g.bezierCurveTo(-0.15, 0.32, -0.5, 0.1, -0.5, -0.18);
  g.bezierCurveTo(-0.5, -0.4, -0.33, -0.5, -0.24, -0.5);
  g.bezierCurveTo(-0.1, -0.5, -0.02, -0.4, 0, -0.29);
  g.bezierCurveTo(0.02, -0.4, 0.1, -0.5, 0.24, -0.5);
  g.bezierCurveTo(0.33, -0.5, 0.5, -0.4, 0.5, -0.18);
  g.bezierCurveTo(0.5, 0.1, 0.15, 0.32, 0, 0.5);
}

function diamond(g) {
  g.moveTo(0, -0.5);
  g.quadraticCurveTo(0.17, -0.22, 0.39, 0);
  g.quadraticCurveTo(0.17, 0.22, 0, 0.5);
  g.quadraticCurveTo(-0.17, 0.22, -0.39, 0);
  g.quadraticCurveTo(-0.17, -0.22, 0, -0.5);
}

function spade(g) {
  g.moveTo(0, -0.5);
  g.bezierCurveTo(-0.12, -0.33, -0.5, -0.1, -0.5, 0.12);
  g.bezierCurveTo(-0.5, 0.3, -0.36, 0.4, -0.23, 0.4);
  g.bezierCurveTo(-0.12, 0.4, -0.05, 0.34, -0.03, 0.27);
  g.quadraticCurveTo(-0.05, 0.44, -0.18, 0.5);
  g.lineTo(0.18, 0.5);
  g.quadraticCurveTo(0.05, 0.44, 0.03, 0.27);
  g.bezierCurveTo(0.05, 0.34, 0.12, 0.4, 0.23, 0.4);
  g.bezierCurveTo(0.36, 0.4, 0.5, 0.3, 0.5, 0.12);
  g.bezierCurveTo(0.5, -0.1, 0.12, -0.33, 0, -0.5);
}

function club(g) {
  const r = 0.205;
  g.moveTo(r, -0.27);
  g.arc(0, -0.27, r, 0, Math.PI * 2);
  g.moveTo(-0.25 + r, 0.07);
  g.arc(-0.25, 0.07, r, 0, Math.PI * 2);
  g.moveTo(0.25 + r, 0.07);
  g.arc(0.25, 0.07, r, 0, Math.PI * 2);
  g.moveTo(0, -0.1);
  g.lineTo(0.12, 0.05);
  g.lineTo(0, 0.18);
  g.lineTo(-0.12, 0.05);
  g.closePath();
  g.moveTo(-0.04, 0.12);
  g.quadraticCurveTo(-0.05, 0.42, -0.18, 0.5);
  g.lineTo(0.18, 0.5);
  g.quadraticCurveTo(0.05, 0.42, 0.04, 0.12);
  g.closePath();
}

const SHAPES = [spade, heart, diamond, club];

/** Fill a suit symbol of `size` px height at (x, y). */
export function drawSuit(g, suit, x, y, size, color = INK[suit], flip = false) {
  g.save();
  g.translate(x, y);
  if (flip) g.rotate(Math.PI);
  g.scale(size, size);
  g.beginPath();
  SHAPES[suit](g);
  g.fillStyle = color;
  g.fill('nonzero');
  g.restore();
}

// ---- faces ---------------------------------------------------------------------------------------

// Pip positions: [col (0 L, 1 M, 2 R), row (0 top … 1 bottom)].
const PIPS = {
  2: [[1, 0], [1, 1]],
  3: [[1, 0], [1, 0.5], [1, 1]],
  4: [[0, 0], [2, 0], [0, 1], [2, 1]],
  5: [[0, 0], [2, 0], [1, 0.5], [0, 1], [2, 1]],
  6: [[0, 0], [2, 0], [0, 0.5], [2, 0.5], [0, 1], [2, 1]],
  7: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [0, 1], [2, 1]],
  8: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [1, 0.75], [0, 1], [2, 1]],
  9: [[0, 0], [2, 0], [0, 1 / 3], [2, 1 / 3], [1, 0.5], [0, 2 / 3], [2, 2 / 3], [0, 1], [2, 1]],
  10: [[0, 0], [2, 0], [1, 1 / 6], [0, 1 / 3], [2, 1 / 3], [0, 2 / 3], [2, 2 / 3], [1, 5 / 6], [0, 1], [2, 1]],
};

function paper(g, w, h, seed) {
  g.fillStyle = '#f8f5ec';
  g.fillRect(0, 0, w, h);
  // A little tooth and an even warmer edge, so the stock never looks like flat white plastic.
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.globalAlpha = 0.05;
  for (let i = 0; i < 160; i++) {
    g.fillStyle = rnd() < 0.5 ? '#b8ab90' : '#ffffff';
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1);
  }
  g.globalAlpha = 1;
  const grad = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.7);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(150,130,100,0.10)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

function index(g, rank, suit) {
  const label = RANK_LABELS[rank];
  const ink = INK[suit];
  for (const flip of [false, true]) {
    g.save();
    if (flip) {
      g.translate(63 * MM, 88 * MM);
      g.rotate(Math.PI);
    }
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const ten = label === '10';
    g.font = `700 ${(ten ? 7.2 : 8.4) * MM}px "Playfair Display", Georgia, "Times New Roman", serif`;
    if (ten) {
      // Condensed "10" like a real index.
      g.save();
      g.translate(6.1 * MM, 11.6 * MM);
      g.scale(0.78, 1);
      g.fillText('10', 0, 0);
      g.restore();
    } else g.fillText(label, 6.1 * MM, 11.8 * MM);
    drawSuit(g, suit, 6.1 * MM, 16.6 * MM, 5.2 * MM, ink);
    g.restore();
  }
}

function numberFace(g, rank, suit) {
  const n = rank + 1;
  if (n === 1) {
    // Ace: one large pip; the ace of spades gets the traditional ornate treatment.
    if (suit === 0) {
      g.save();
      g.strokeStyle = BLACK;
      g.lineWidth = 0.5 * MM;
      g.beginPath();
      g.ellipse(31.5 * MM, 44 * MM, 15 * MM, 19 * MM, 0, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 0.25 * MM;
      g.beginPath();
      g.ellipse(31.5 * MM, 44 * MM, 13.6 * MM, 17.6 * MM, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      drawSuit(g, 0, 31.5 * MM, 43 * MM, 25 * MM, BLACK);
      // Filigree inside the spade.
      g.save();
      g.strokeStyle = '#f8f5ec';
      g.lineWidth = 0.45 * MM;
      g.beginPath();
      g.moveTo(31.5 * MM, 35 * MM);
      g.bezierCurveTo(26 * MM, 40 * MM, 27 * MM, 46 * MM, 31.5 * MM, 48 * MM);
      g.bezierCurveTo(36 * MM, 46 * MM, 37 * MM, 40 * MM, 31.5 * MM, 35 * MM);
      g.stroke();
      g.restore();
    } else drawSuit(g, suit, 31.5 * MM, 44 * MM, 17 * MM);
    return;
  }
  const xs = [19 * MM, 31.5 * MM, 44 * MM];
  const y0 = 17.5 * MM;
  const y1 = 70.5 * MM;
  const size = 10.6 * MM;
  for (const [c, r] of PIPS[n]) {
    const y = y0 + (y1 - y0) * r;
    drawSuit(g, suit, xs[c], y, size, INK[suit], r > 0.5);
  }
}

// ---- court cards -------------------------------------------------------------------------------

function outline(g, w = 0.32) {
  g.lineWidth = w * MM;
  g.strokeStyle = C.black;
  g.stroke();
}

function poly(g, pts, fill) {
  g.beginPath();
  g.moveTo(pts[0][0] * MM, pts[0][1] * MM);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * MM, pts[i][1] * MM);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  outline(g);
}

/** One half of a court figure in frame space (mm, 0..41 × 0..33, head near the top). */
function courtHalf(g, rank, suit) {
  const K = rank === 12;
  const Q = rank === 11;
  const J = rank === 10;
  const warm = suit === 1 || suit === 2;
  const robeA = warm ? C.red : C.blue;
  const robeB = warm ? C.blue : C.red;
  const cx = 20.5;
  // Weapon / prop behind the figure.
  g.save();
  if (K) {
    // Sword raised behind the head (left), sceptre for clubs/diamonds.
    g.beginPath();
    g.moveTo(6 * MM, 33 * MM);
    g.lineTo(8.6 * MM, 2.5 * MM);
    g.lineTo(9.8 * MM, 2.5 * MM);
    g.lineTo(8.2 * MM, 33 * MM);
    g.closePath();
    g.fillStyle = suit % 2 ? '#d9dde2' : C.yellow;
    g.fill();
    outline(g, 0.25);
    poly(g, [[5.6, 9], [12.4, 8.4], [12.6, 9.6], [5.8, 10.2]], C.yellow);
  } else if (J) {
    // Halberd shaft with a blade.
    g.beginPath();
    g.moveTo(33.8 * MM, 33 * MM);
    g.lineTo(34.6 * MM, 1.8 * MM);
    g.lineTo(35.6 * MM, 1.8 * MM);
    g.lineTo(35 * MM, 33 * MM);
    g.closePath();
    g.fillStyle = C.yellow;
    g.fill();
    outline(g, 0.25);
    poly(g, [[35.4, 3], [39.5, 5.5], [39.2, 9.5], [35.2, 8]], '#d9dde2');
  }
  g.restore();
  // Shoulders / robe.
  poly(g, [[3, 33], [5, 25.5], [12, 21.8], [29, 21.8], [36, 25.5], [38, 33]], robeA);
  // Robe panels and trim.
  poly(g, [[14, 33], [15.5, 22.5], [25.5, 22.5], [27, 33]], robeB);
  poly(g, [[18.5, 33], [19, 23], [22, 23], [22.5, 33]], C.yellow);
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.arc(20.5 * MM, (25.5 + i * 2.2) * MM, 0.55 * MM, 0, Math.PI * 2);
    g.fillStyle = C.black;
    g.fill();
  }
  // Ermine / collar.
  if (K || Q) {
    poly(g, [[9.5, 24.5], [13, 21.2], [28, 21.2], [31.5, 24.5], [26, 25.6], [15, 25.6]], C.white);
    g.fillStyle = C.black;
    for (const x of [12.5, 16, 20.5, 25, 28.5]) g.fillRect((x - 0.3) * MM, 23 * MM, 0.6 * MM, 1.1 * MM);
  } else {
    poly(g, [[12, 23.5], [14.5, 21.2], [26.5, 21.2], [29, 23.5], [20.5, 25.2]], C.yellow);
  }
  // Hair behind the face.
  if (Q) poly(g, [[13.6, 9], [12.2, 21.5], [15.5, 23], [25.5, 23], [28.8, 21.5], [27.4, 9]], C.yellow);
  else if (J) poly(g, [[14.5, 9], [13.6, 19.5], [16.5, 20.5], [24.5, 20.5], [27.4, 19.5], [26.5, 9]], C.yellow);
  else poly(g, [[14.8, 9], [14, 17], [27, 17], [26.2, 9]], C.white);
  // Neck + face.
  poly(g, [[18.4, 18], [18.4, 21.8], [22.6, 21.8], [22.6, 18]], C.skin);
  g.beginPath();
  g.ellipse(cx * MM, 13.6 * MM, 4.3 * MM, 5.3 * MM, 0, 0, Math.PI * 2);
  g.fillStyle = C.skin;
  g.fill();
  outline(g);
  // Features.
  g.strokeStyle = C.black;
  g.lineWidth = 0.32 * MM;
  g.beginPath();
  g.moveTo(17.8 * MM, 11.8 * MM);
  g.quadraticCurveTo(18.8 * MM, 11.2 * MM, 19.6 * MM, 11.8 * MM);
  g.moveTo(21.4 * MM, 11.8 * MM);
  g.quadraticCurveTo(22.2 * MM, 11.2 * MM, 23.2 * MM, 11.8 * MM);
  g.stroke();
  g.fillStyle = C.black;
  for (const x of [18.7, 22.3]) {
    g.beginPath();
    g.ellipse(x * MM, 12.9 * MM, 0.55 * MM, 0.42 * MM, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.moveTo(20.6 * MM, 12.6 * MM);
  g.quadraticCurveTo(20 * MM, 15 * MM, 21.3 * MM, 15.4 * MM);
  g.stroke();
  g.beginPath();
  g.moveTo(19 * MM, 17 * MM);
  g.quadraticCurveTo(20.5 * MM, 17.7 * MM, 22 * MM, 17 * MM);
  g.strokeStyle = Q ? C.red : C.black;
  g.lineWidth = (Q ? 0.55 : 0.32) * MM;
  g.stroke();
  // Beard + moustache on kings.
  if (K) {
    poly(g, [[16, 15.5], [17.2, 21], [20.5, 23.2], [23.8, 21], [25, 15.5], [22.6, 17.8], [18.4, 17.8]], C.white);
    g.strokeStyle = C.black;
    g.lineWidth = 0.22 * MM;
    g.beginPath();
    for (const x of [18.4, 20.5, 22.6]) {
      g.moveTo(x * MM, 18.6 * MM);
      g.lineTo((x + (x - 20.5) * 0.15) * MM, 21.4 * MM);
    }
    g.stroke();
    poly(g, [[17.8, 16.4], [20.5, 15.6], [23.2, 16.4], [20.5, 16.9]], C.white);
  }
  // Headwear.
  if (K) {
    poly(g, [[14.6, 9.4], [14, 3.2], [16.6, 5.8], [18.3, 1.8], [20.5, 5], [22.7, 1.8], [24.4, 5.8], [27, 3.2], [26.4, 9.4]], C.yellow);
    poly(g, [[14.4, 9.6], [26.6, 9.6], [26.4, 7.8], [14.6, 7.8]], robeA);
    g.fillStyle = robeB;
    for (const x of [16.6, 20.5, 24.4]) {
      g.beginPath();
      g.arc(x * MM, 8.7 * MM, 0.55 * MM, 0, Math.PI * 2);
      g.fill();
    }
  } else if (Q) {
    poly(g, [[15.2, 9.2], [15.2, 5.4], [17.3, 6.8], [18.9, 3.6], [20.5, 6], [22.1, 3.6], [23.7, 6.8], [25.8, 5.4], [25.8, 9.2]], C.yellow);
    g.fillStyle = C.red;
    g.beginPath();
    g.arc(20.5 * MM, 7.6 * MM, 0.7 * MM, 0, Math.PI * 2);
    g.fill();
    // A flower at the chest.
    g.save();
    g.translate(10.5 * MM, 27.5 * MM);
    for (let i = 0; i < 5; i++) {
      g.rotate((Math.PI * 2) / 5);
      g.beginPath();
      g.ellipse(0, 1.2 * MM, 0.8 * MM, 1.3 * MM, 0, 0, Math.PI * 2);
      g.fillStyle = C.red;
      g.fill();
      outline(g, 0.2);
    }
    g.beginPath();
    g.arc(0, 0, 0.75 * MM, 0, Math.PI * 2);
    g.fillStyle = C.yellow;
    g.fill();
    g.restore();
  } else {
    // Jack's cap with a feather.
    poly(g, [[14.2, 9.6], [15.2, 5.6], [20.5, 4.2], [25.8, 5.6], [26.8, 9.6]], robeB);
    poly(g, [[14, 9.8], [27, 9.8], [26.8, 8.4], [14.2, 8.4]], C.yellow);
    g.beginPath();
    g.moveTo(24 * MM, 5.4 * MM);
    g.bezierCurveTo(28 * MM, 1 * MM, 32 * MM, 2 * MM, 31.5 * MM, 4.5 * MM);
    g.bezierCurveTo(29 * MM, 3.8 * MM, 27 * MM, 5 * MM, 24.6 * MM, 6.6 * MM);
    g.closePath();
    g.fillStyle = C.red;
    g.fill();
    outline(g, 0.2);
  }
}

function courtFace(g, rank, suit) {
  const x0 = 11 * MM;
  const y0 = 10.5 * MM;
  const w = 41 * MM;
  const h = 67 * MM;
  g.save();
  g.fillStyle = '#fdfaf2';
  g.fillRect(x0, y0, w, h);
  for (const flip of [false, true]) {
    g.save();
    if (flip) {
      g.translate(x0 + w, y0 + h);
      g.rotate(Math.PI);
    } else g.translate(x0, y0);
    g.beginPath();
    g.rect(0, 0, w, h / 2);
    g.clip();
    courtHalf(g, rank, suit);
    // Suit pip in the frame corner, beside the figure (as on real court cards).
    drawSuit(g, suit, 35.5 * MM, 15.5 * MM, 6 * MM);
    g.restore();
  }
  // Divider and frame.
  g.strokeStyle = C.black;
  g.lineWidth = 0.35 * MM;
  g.beginPath();
  g.moveTo(x0, y0 + h / 2);
  g.lineTo(x0 + w, y0 + h / 2);
  g.stroke();
  g.strokeStyle = INK[suit] === RED ? '#9b1b22' : '#1f3a7a';
  g.lineWidth = 0.55 * MM;
  g.strokeRect(x0, y0, w, h);
  g.restore();
}

function drawFace(g, card) {
  const rank = rankOf(card);
  const suit = suitOf(card);
  paper(g, CELL_W, CELL_H, card + 1);
  index(g, rank, suit);
  if (rank >= 10) courtFace(g, rank, suit);
  else numberFace(g, rank, suit);
}

// ---- back ----------------------------------------------------------------------------------------

function drawBack(g) {
  const w = CELL_W;
  const h = CELL_H;
  paper(g, w, h, 99);
  const b = 3.4 * MM;
  const red = '#8c1420';
  g.fillStyle = red;
  g.fillRect(b, b, w - 2 * b, h - 2 * b);
  // Fine diamond lattice.
  g.save();
  g.beginPath();
  g.rect(b, b, w - 2 * b, h - 2 * b);
  g.clip();
  g.strokeStyle = 'rgba(232,120,120,0.55)';
  g.lineWidth = 0.6;
  const step = 2.9 * MM;
  for (let x = -h; x < w + h; x += step) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + h, h);
    g.moveTo(x, h);
    g.lineTo(x + h, 0);
    g.stroke();
  }
  g.fillStyle = 'rgba(240,200,120,0.55)';
  for (let x = 0; x < w + step; x += step) for (let y = 0; y < h + step; y += step) {
    g.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
    g.fillRect(x + step / 2 - 0.6, y + step / 2 - 0.6, 1.2, 1.2);
  }
  g.restore();
  // Inner gold rule.
  g.strokeStyle = C.gold;
  g.lineWidth = 0.5 * MM;
  g.strokeRect(b + 1.6 * MM, b + 1.6 * MM, w - 2 * b - 3.2 * MM, h - 2 * b - 3.2 * MM);
  g.lineWidth = 0.22 * MM;
  g.strokeRect(b + 2.5 * MM, b + 2.5 * MM, w - 2 * b - 5 * MM, h - 2 * b - 5 * MM);
  // Medallion.
  const cx = w / 2;
  const cy = h / 2;
  g.beginPath();
  g.ellipse(cx, cy, 17 * MM, 22 * MM, 0, 0, Math.PI * 2);
  g.fillStyle = '#6e0e18';
  g.fill();
  g.lineWidth = 1.1 * MM;
  g.strokeStyle = C.gold;
  g.stroke();
  g.beginPath();
  g.ellipse(cx, cy, 15.2 * MM, 20.2 * MM, 0, 0, Math.PI * 2);
  g.lineWidth = 0.3 * MM;
  g.stroke();
  // Crown above the name.
  g.fillStyle = C.gold;
  g.beginPath();
  const cyc = cy - 8.5 * MM;
  g.moveTo(cx - 6 * MM, cyc + 3 * MM);
  g.lineTo(cx - 6.5 * MM, cyc - 2.5 * MM);
  g.lineTo(cx - 3.2 * MM, cyc);
  g.lineTo(cx, cyc - 4 * MM);
  g.lineTo(cx + 3.2 * MM, cyc);
  g.lineTo(cx + 6.5 * MM, cyc - 2.5 * MM);
  g.lineTo(cx + 6 * MM, cyc + 3 * MM);
  g.closePath();
  g.fill();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#f4dc98';
  g.font = `700 ${5.2 * MM}px "Playfair Display", Georgia, serif`;
  g.save();
  g.translate(cx, cy + 0.6 * MM);
  g.scale(0.82, 1);
  g.fillText('ELDORADO', 0, 0);
  g.restore();
  g.font = `400 ${2.6 * MM}px "Playfair Display", Georgia, serif`;
  g.fillText('R E N O', cx, cy + 6.2 * MM);
  // Small diamonds top & bottom of the medallion (rotationally symmetric look).
  for (const s of [-1, 1]) drawSuit(g, 2, cx, cy + s * 15.5 * MM, 4 * MM, C.gold);
}

// ---- atlases -------------------------------------------------------------------------------------

/** Draw the two atlases into canvases (call again after the fonts load to refresh the text). */
export function paintCardAtlases(canvases) {
  for (let a = 0; a < 2; a++) {
    const g = canvases[a].getContext('2d');
    g.fillStyle = '#f8f5ec';
    g.fillRect(0, 0, canvases[a].width, canvases[a].height);
  }
  for (let cell = 0; cell <= BACK_CELL; cell++) {
    const a = cell < PER_ATLAS ? 0 : 1;
    const j = cell - a * PER_ATLAS;
    const g = canvases[a].getContext('2d');
    g.save();
    g.translate((j % COLS) * CELL_W, Math.floor(j / COLS) * CELL_H);
    g.beginPath();
    g.rect(0, 0, CELL_W, CELL_H);
    g.clip();
    if (cell === BACK_CELL) drawBack(g);
    else drawFace(g, cell);
    g.restore();
  }
}
