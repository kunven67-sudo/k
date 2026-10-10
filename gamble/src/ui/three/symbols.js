// Classic reel symbols painted in canvas (no image files): lucky 7, BAR, cherries, bell, star,
// diamond, horseshoe — plus big letters for the logo reels. All sized relative to the cell.

const TAU = Math.PI * 2;

function seven(g, w, h) {
  g.save();
  g.translate(w / 2, h / 2);
  g.font = `400 ${h * 0.7}px "Rye", serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = h * 0.06;
  g.strokeStyle = '#2a0508';
  g.strokeText('7', 0, h * 0.04);
  const gr = g.createLinearGradient(0, -h * 0.3, 0, h * 0.3);
  gr.addColorStop(0, '#ff4a4a');
  gr.addColorStop(0.5, '#c8101c');
  gr.addColorStop(1, '#7a0610');
  g.fillStyle = gr;
  g.fillText('7', 0, h * 0.04);
  g.restore();
}

function bar(g, w, h) {
  const bw = w * 0.74;
  const bh = h * 0.34;
  g.save();
  g.translate(w / 2, h / 2);
  g.fillStyle = '#121010';
  g.beginPath();
  g.roundRect(-bw / 2, -bh / 2, bw, bh, bh * 0.18);
  g.fill();
  g.strokeStyle = '#d6a945';
  g.lineWidth = h * 0.025;
  g.stroke();
  g.fillStyle = '#fff6df';
  g.font = `400 ${bh * 0.86}px "Bebas Neue", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BAR', 0, bh * 0.05);
  g.restore();
}

function cherry(g, w, h) {
  g.save();
  g.translate(w / 2, h / 2);
  g.strokeStyle = '#3d6b1f';
  g.lineWidth = h * 0.035;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-w * 0.16, h * 0.08);
  g.quadraticCurveTo(-w * 0.05, -h * 0.25, w * 0.1, -h * 0.3);
  g.moveTo(w * 0.15, h * 0.12);
  g.quadraticCurveTo(w * 0.15, -h * 0.15, w * 0.1, -h * 0.3);
  g.stroke();
  g.fillStyle = '#4f8a2a';
  g.beginPath();
  g.ellipse(w * 0.2, -h * 0.3, w * 0.12, h * 0.05, -0.4, 0, TAU);
  g.fill();
  for (const [x, y] of [[-w * 0.16, h * 0.18], [w * 0.15, h * 0.22]]) {
    const gr = g.createRadialGradient(x - w * 0.04, y - h * 0.05, 1, x, y, h * 0.14);
    gr.addColorStop(0, '#ff7a7a');
    gr.addColorStop(0.5, '#c4101e');
    gr.addColorStop(1, '#5c0510');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, h * 0.13, 0, TAU);
    g.fill();
  }
  g.restore();
}

function bell(g, w, h) {
  g.save();
  g.translate(w / 2, h / 2);
  const gr = g.createLinearGradient(-w * 0.25, 0, w * 0.25, 0);
  gr.addColorStop(0, '#9c6a10');
  gr.addColorStop(0.4, '#ffd76a');
  gr.addColorStop(1, '#a87412');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, -h * 0.32);
  g.bezierCurveTo(w * 0.2, -h * 0.32, w * 0.18, h * 0.05, w * 0.3, h * 0.2);
  g.lineTo(-w * 0.3, h * 0.2);
  g.bezierCurveTo(-w * 0.18, h * 0.05, -w * 0.2, -h * 0.32, 0, -h * 0.32);
  g.fill();
  g.fillStyle = '#6e4a0c';
  g.beginPath();
  g.arc(0, h * 0.25, h * 0.06, 0, TAU);
  g.fill();
  g.restore();
}

function star(g, w, h) {
  g.save();
  g.translate(w / 2, h / 2);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? h * 0.15 : h * 0.34;
    const a = (i / 10) * TAU - Math.PI / 2;
    g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  const gr = g.createRadialGradient(0, -h * 0.05, 2, 0, 0, h * 0.35);
  gr.addColorStop(0, '#fff2a8');
  gr.addColorStop(1, '#d89a12');
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = h * 0.02;
  g.strokeStyle = '#7a5208';
  g.stroke();
  g.restore();
}

function diamond(g, w, h) {
  g.save();
  g.translate(w / 2, h / 2);
  const gr = g.createLinearGradient(-w * 0.3, -h * 0.3, w * 0.3, h * 0.3);
  gr.addColorStop(0, '#bfefff');
  gr.addColorStop(0.5, '#3aa6e0');
  gr.addColorStop(1, '#14507a');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-w * 0.28, -h * 0.1);
  g.lineTo(-w * 0.14, -h * 0.26);
  g.lineTo(w * 0.14, -h * 0.26);
  g.lineTo(w * 0.28, -h * 0.1);
  g.lineTo(0, h * 0.3);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.6)';
  g.lineWidth = h * 0.012;
  g.beginPath();
  g.moveTo(-w * 0.28, -h * 0.1);
  g.lineTo(w * 0.28, -h * 0.1);
  g.moveTo(-w * 0.08, -h * 0.1);
  g.lineTo(0, h * 0.3);
  g.lineTo(w * 0.08, -h * 0.1);
  g.stroke();
  g.restore();
}

export const SYMBOLS = { seven, bar, cherry, bell, star, diamond };
export const SYMBOL_NAMES = Object.keys(SYMBOLS);

/** Big gold-outlined letter (logo reels). */
export function letter(g, ch, w, h, { color = '#b5121b' } = {}) {
  g.save();
  g.font = `700 ${h * 0.66}px "Playfair Display", serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = h * 0.05;
  g.strokeStyle = '#d6a945';
  g.strokeText(ch, w / 2, h * 0.53);
  g.fillStyle = color;
  g.fillText(ch, w / 2, h * 0.53);
  g.restore();
}

export function drawSymbol(g, name, w, h) {
  (SYMBOLS[name] || star)(g, w, h);
}
