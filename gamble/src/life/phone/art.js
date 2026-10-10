// Generated art for the phone: the crack web, the stock wallpaper and the app icons.
// Everything is drawn in code once and cached.

export const SCREEN_W = 278;
export const SCREEN_H = 591;

/** Seeded PRNG so the same phone always has the same cracks. */
function mulberry(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A spider-web crack from a drop on the lower-right corner: jagged radial cracks that fork,
 * short concentric "rings" between neighbours near the impact, and a few long runners.
 * Returns an SVG string (white hairlines + a darker under-stroke so they read on any wallpaper).
 */
export function crackSVG(seed = 7) {
  const r = mulberry(seed);
  const ox = SCREEN_W * 0.82;
  const oy = SCREEN_H * 0.86;
  const paths = [];
  const rays = [];
  const N = 13;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + r() * 0.35;
    const len = 40 + r() * (i % 3 === 0 ? 420 : 160);
    let x = ox;
    let y = oy;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const pts = [];
    let ang = a;
    for (let s = 0; s < len; ) {
      const step = 6 + r() * 16;
      ang += (r() - 0.5) * 0.45;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      s += step;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      pts.push([x, y]);
      // Forks.
      if (r() < 0.08 && s > 30) {
        let fx = x;
        let fy = y;
        let fa = ang + (r() < 0.5 ? -1 : 1) * (0.4 + r() * 0.5);
        let fd = `M${fx.toFixed(1)} ${fy.toFixed(1)}`;
        for (let k = 0, fl = 20 + r() * 60; k < fl; k += 8) {
          fa += (r() - 0.5) * 0.5;
          fx += Math.cos(fa) * 8;
          fy += Math.sin(fa) * 8;
          fd += ` L${fx.toFixed(1)} ${fy.toFixed(1)}`;
        }
        paths.push({ d: fd, w: 0.55 });
      }
    }
    rays.push(pts);
    paths.push({ d, w: i % 3 === 0 ? 0.9 : 0.7 });
  }
  // Concentric ring segments joining neighbouring rays near the impact.
  for (let ring = 0; ring < 3; ring++) {
    const idx = 1 + ring * 2;
    for (let i = 0; i < N; i++) {
      const p = rays[i][idx];
      const q = rays[(i + 1) % N][idx + (r() < 0.5 ? 0 : 1)];
      if (!p || !q || r() < 0.3) continue;
      const mx = (p[0] + q[0]) / 2 + (r() - 0.5) * 6;
      const my = (p[1] + q[1]) / 2 + (r() - 0.5) * 6;
      paths.push({ d: `M${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`, w: 0.6 });
    }
  }
  const under = paths.map((p) => `<path d="${p.d}" stroke="rgba(0,0,0,.35)" stroke-width="${p.w + 0.9}" transform="translate(.6 .8)"/>`).join('');
  const over = paths.map((p) => `<path d="${p.d}" stroke="rgba(255,255,255,.62)" stroke-width="${p.w}"/>`).join('');
  // The impact point itself: a little crushed star with a frosted halo.
  const halo = `<radialGradient id="ph-imp"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  return `<svg class="ph-cracks" viewBox="0 0 ${SCREEN_W} ${SCREEN_H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
<defs>${halo}</defs><g fill="none" stroke-linecap="round" stroke-linejoin="round">${under}${over}</g>
<circle cx="${ox}" cy="${oy}" r="22" fill="url(#ph-imp)"/></svg>`;
}

let wallpaperURL = null;
/** The stock wallpaper: dusk-blue gradient with soft overlapping "material" waves and grain. */
export function wallpaper() {
  if (wallpaperURL) return wallpaperURL;
  const c = document.createElement('canvas');
  c.width = SCREEN_W * 2;
  c.height = SCREEN_H * 2;
  const g = c.getContext('2d');
  g.scale(2, 2);
  const bg = g.createLinearGradient(0, 0, SCREEN_W * 0.4, SCREEN_H);
  bg.addColorStop(0, '#1b2a4a');
  bg.addColorStop(0.55, '#2c2350');
  bg.addColorStop(1, '#0d1020');
  g.fillStyle = bg;
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const waves = [
    ['rgba(84,122,214,.55)', 0.42, 60],
    ['rgba(138,92,206,.45)', 0.56, 80],
    ['rgba(232,120,150,.30)', 0.68, 50],
    ['rgba(30,40,90,.65)', 0.8, 70],
  ];
  for (const [col, yy, amp] of waves) {
    g.beginPath();
    g.moveTo(0, SCREEN_H);
    for (let x = 0; x <= SCREEN_W; x += 4) {
      const y = SCREEN_H * yy + Math.sin(x / 70 + yy * 9) * amp * 0.5 + Math.sin(x / 33 + yy * 3) * amp * 0.15;
      g.lineTo(x, y);
    }
    g.lineTo(SCREEN_W, SCREEN_H);
    g.closePath();
    g.fillStyle = col;
    g.shadowColor = 'rgba(0,0,0,.4)';
    g.shadowBlur = 18;
    g.fill();
  }
  g.shadowBlur = 0;
  // Grain so it isn't a perfect gradient (cheap screens band anyway).
  const img = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  wallpaperURL = c.toDataURL('image/jpeg', 0.86);
  return wallpaperURL;
}

// App icons: [background, svg glyph]. Glyphs are 24x24 line drawings.
const glyph = (inner, color = '#fff') =>
  `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const APP_ICONS = {
  clock: ['linear-gradient(160deg,#2b2f38,#121418)', glyph('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>')],
  messages: ['linear-gradient(160deg,#4f8cf7,#2a5fd0)', glyph('<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.8V16h0A1.5 1.5 0 0 1 4 14.5z"/>')],
  wallet: ['linear-gradient(160deg,#2f9e6e,#176245)', glyph('<rect x="3.5" y="6" width="17" height="12.5" rx="2.5"/><path d="M15 12h5.5"/><circle cx="16.3" cy="12" r=".6" fill="#fff"/><path d="M6 6l9-2.5 1 2.5"/>')],
  maps: ['linear-gradient(160deg,#f2f0ea,#d9d4c7)', glyph('<path d="M9 4.5 4 6.5v13l5-2 6 2 5-2v-13l-5 2z" stroke="#4a4f57"/><path d="M9 4.5v13M15 6.5v13" stroke="#4a4f57"/><path d="M12 13.5s-2.6-2.7-2.6-4.4a2.6 2.6 0 0 1 5.2 0c0 1.7-2.6 4.4-2.6 4.4z" fill="#e8483d" stroke="#e8483d"/>', '#4a4f57')],
  camera: ['linear-gradient(160deg,#4a4d55,#24262b)', glyph('<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>')],
  settings: ['linear-gradient(160deg,#8a8f98,#5a5f68)', glyph('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>')],
  phoneApp: ['linear-gradient(160deg,#3ccf6a,#1f9a47)', glyph('<path d="M7.5 4h2.2l1.4 4-1.8 1.2a10 10 0 0 0 4.5 4.5l1.2-1.8 4 1.4v2.2A2 2 0 0 1 17 17.5 13.5 13.5 0 0 1 5.5 6 2 2 0 0 1 7.5 4z"/>')],
  browser: ['linear-gradient(160deg,#f7f7f8,#d8d9de)', glyph('<circle cx="12" cy="12" r="8.5" stroke="#3b6fe0"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17" stroke="#3b6fe0"/>', '#3b6fe0')],
};
