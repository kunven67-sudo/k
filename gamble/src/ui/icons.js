// App icon artwork (home screen / PWA), painted in canvas: an oxblood casino chip with a gold
// rim, a sunburst, and a bold gold "G". `maskable` keeps everything inside the 80% safe zone
// on a full-bleed background so Android's shape masks never crop the mark.
// Rendered by dev/ui.html?screen=icons&size=512 and captured to assets/icons/*.png.

const TAU = Math.PI * 2;

export function renderIcon(size = 512, { maskable = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const s = size / 512;
  g.scale(s, s);

  // Background: deep felt-red with a warm center glow.
  const bg = g.createRadialGradient(256, 220, 20, 256, 256, 380);
  bg.addColorStop(0, '#7a1420');
  bg.addColorStop(0.6, '#3a070e');
  bg.addColorStop(1, '#160307');
  g.fillStyle = bg;
  if (maskable) g.fillRect(0, 0, 512, 512);
  else {
    g.beginPath();
    g.roundRect(0, 0, 512, 512, 112);
    g.fill();
  }
  // Sunburst rays.
  g.save();
  g.translate(256, 256);
  for (let i = 0; i < 36; i++) {
    g.rotate(TAU / 36);
    g.fillStyle = i % 2 ? 'rgba(255,190,110,0.05)' : 'rgba(255,120,140,0.035)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(380, -22);
    g.lineTo(380, 22);
    g.fill();
  }
  g.restore();

  const R = maskable ? 170 : 200; // chip radius (maskable stays inside the safe circle)
  g.save();
  g.translate(256, 256);
  // Chip shadow + body.
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 30;
  g.shadowOffsetY = 12;
  g.fillStyle = '#b3172a';
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fill();
  g.shadowColor = 'transparent';
  // Edge inserts (classic clay chip stripes).
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate((i / 8) * TAU);
    g.fillStyle = '#f6edd8';
    g.beginPath();
    g.arc(0, 0, R, -0.13, 0.13);
    g.arc(0, 0, R * 0.8, 0.13, -0.13, true);
    g.fill();
    g.restore();
  }
  // Gold inlay ring.
  const gold = g.createLinearGradient(-R, -R, R, R);
  gold.addColorStop(0, '#fff1b8');
  gold.addColorStop(0.35, '#e0b04e');
  gold.addColorStop(0.65, '#9c6c1c');
  gold.addColorStop(1, '#f2d47c');
  g.strokeStyle = gold;
  g.lineWidth = R * 0.05;
  g.beginPath();
  g.arc(0, 0, R * 0.74, 0, TAU);
  g.stroke();
  // Inner disc.
  const inner = g.createRadialGradient(-R * 0.2, -R * 0.25, 4, 0, 0, R * 0.72);
  inner.addColorStop(0, '#5a0a14');
  inner.addColorStop(1, '#2a0409');
  g.fillStyle = inner;
  g.beginPath();
  g.arc(0, 0, R * 0.71, 0, TAU);
  g.fill();
  // The G.
  g.font = `700 ${R * 1.02}px "Playfair Display", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#1a0205';
  g.fillText('G', R * 0.02, R * 0.1);
  g.fillStyle = gold;
  g.fillText('G', 0, R * 0.06);
  // Specular sheen on the chip.
  const sheen = g.createRadialGradient(-R * 0.45, -R * 0.55, 2, -R * 0.3, -R * 0.4, R * 0.9);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fill();
  g.restore();
  return c;
}
