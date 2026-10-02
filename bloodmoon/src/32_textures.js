
// =====================================================================
// TEXTURES — painted in code on canvases (no image files).
// =====================================================================
function canvasTex(w, h, paint, repeat = true, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); paint(x, w, h);
  const t = new THREE.CanvasTexture(c); if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noiseFill(x, w, h, base, amt, scale = 1, seed = 0) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = (fbm(i / (8 * scale), j / (8 * scale), 4, seed) * 0.6 + (hash2(i, j, seed) - 0.5) * 0.4) * amt;
    const k = (j * w + i) * 4; d[k] = clamp(base[0] + n, 0, 255); d[k + 1] = clamp(base[1] + n, 0, 255); d[k + 2] = clamp(base[2] + n, 0, 255); d[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
}
// tiling version of fbm (wraps at the texture edge)
function tileNoise(i, j, w, per, seed) { // per = cells across the texture
  const fx = (i / w) * per, fy = (j / w) * per, xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi, u = smooth(xf), v = smooth(yf);
  const H = (a, b) => hash2(((a % per) + per) % per, ((b % per) + per) % per, seed);
  return lerp(lerp(H(xi, yi), H(xi + 1, yi), u), lerp(H(xi, yi + 1), H(xi + 1, yi + 1), u), v) * 2 - 1;
}
function tileFbm(i, j, w, per, oct, seed) { let a = 0, amp = 0.5, n = 0, p = per; for (let o = 0; o < oct; o++) { a += tileNoise(i, j, w, p, seed + o) * amp; n += amp; amp *= 0.5; p *= 2; } return a / n; }
const TEX = {};
function makeTextures() {
  const S = 256;
  // ground detail: a grey noise the vertex colours tint
  TEX.ground = canvasTex(S, S, (x, w, h) => { const img = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = tileFbm(i, j, w, 8, 4, 1) * 0.55 + tileFbm(i, j, w, 32, 2, 7) * 0.45; const v = clamp(200 + n * 70, 0, 255), k = (j * w + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); });
  // stone bricks
  TEX.stone = canvasTex(S, S, (x, w, h) => {
    x.fillStyle = '#5c5850'; x.fillRect(0, 0, w, h);
    const rows = 8, bh = h / rows;
    for (let r = 0; r < rows; r++) { const off = r % 2 ? 0.5 : 0; for (let c = -1; c < 5; c++) { const bw = w / 4, bx = (c + off) * bw, sh = 70 + hash2(r, c, 3) * 40; x.fillStyle = `rgb(${sh + 8},${sh + 4},${sh - 4})`; x.fillRect(bx + 2, r * bh + 2, bw - 4, bh - 4); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(bx + 2, r * bh + 2, bw - 4, 3); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(bx + 2, r * bh + bh - 5, bw - 4, 3); } }
    const img = x.getImageData(0, 0, w, h); for (let k = 0; k < img.data.length; k += 4) { const n = (Math.random() - 0.5) * 22; img.data[k] += n; img.data[k + 1] += n; img.data[k + 2] += n; } x.putImageData(img, 0, 0);
  });
  // rough rock
  TEX.rock = canvasTex(S, S, (x, w, h) => { const img = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = tileFbm(i, j, w, 6, 5, 21), c = Math.abs(tileFbm(i, j, w, 12, 3, 23)); const v = 120 + n * 60 - c * 40, k = (j * w + i) * 4; img.data[k] = v; img.data[k + 1] = v * 0.97; img.data[k + 2] = v * 0.92; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); });
  // plaster with dark timber beams
  TEX.timber = canvasTex(S, S, (x, w, h) => {
    noiseFill(x, w, h, [196, 186, 162], 26, 2, 5);
    x.fillStyle = '#3a2716'; const beam = 14;
    x.fillRect(0, 0, beam, h); x.fillRect(w - beam, 0, beam, h); x.fillRect(0, 0, w, beam); x.fillRect(0, h - beam, w, beam); x.fillRect(0, h / 2 - beam / 2, w, beam);
    x.save(); x.translate(w / 2, h / 4); x.rotate(0.62); x.fillRect(-w * 0.35, -beam / 2, w * 0.7, beam); x.restore();
    x.save(); x.translate(w / 2, (h * 3) / 4); x.rotate(-0.62); x.fillRect(-w * 0.35, -beam / 2, w * 0.7, beam); x.restore();
    const img = x.getImageData(0, 0, w, h); for (let k = 0; k < img.data.length; k += 4) { const n = (Math.random() - 0.5) * 16; img.data[k] += n; img.data[k + 1] += n; img.data[k + 2] += n; } x.putImageData(img, 0, 0);
  });
  // wooden planks
  TEX.wood = canvasTex(S, S, (x, w, h) => {
    const n = 6, pw = w / n;
    for (let p = 0; p < n; p++) { const sh = 0.8 + hash2(p, 1, 9) * 0.35; for (let j = 0; j < h; j++) { const g = Math.sin(j * 0.09 + p * 3 + Math.sin(j * 0.02) * 4) * 10; x.fillStyle = `rgb(${(96 + g) * sh},${(66 + g) * sh},${(40 + g * 0.6) * sh})`; x.fillRect(p * pw, j, pw, 1); } x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(p * pw, 0, 2, h); }
  });
  // roof shingles
  TEX.roof = canvasTex(S, S, (x, w, h) => {
    x.fillStyle = '#2e1f1a'; x.fillRect(0, 0, w, h); const rows = 12, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = -1; c < 9; c++) { const sw = w / 8, sx = (c + (r % 2) * 0.5) * sw, sh = 70 + hash2(r, c, 4) * 30; x.fillStyle = `rgb(${sh + 22},${sh * 0.62},${sh * 0.5})`; x.fillRect(sx + 1, r * rh, sw - 2, rh - 2); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(sx + 1, r * rh + rh - 4, sw - 2, 2); }
  });
  TEX.thatch = canvasTex(S, S, (x, w, h) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i += 2) { const v = 120 + Math.sin(i * 0.7 + hash2(i, 0, 2) * 9) * 20 + (hash2(i, j, 1) - 0.5) * 40; x.fillStyle = `rgb(${v},${v * 0.82},${v * 0.48})`; x.fillRect(i, j, 2, 1); } });
  // tree bark
  TEX.bark = canvasTex(128, 128, (x, w, h) => { const img = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = tileFbm(i, j * 0.25, w, 16, 3, 41); const v = 70 + n * 40 + Math.sin(i * 0.5 + n * 6) * 12, k = (j * w + i) * 4; img.data[k] = v; img.data[k + 1] = v * 0.78; img.data[k + 2] = v * 0.6; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); });
  // leaves / needles (tinted by instance colour)
  TEX.leaf = canvasTex(128, 128, (x, w, h) => { const img = x.createImageData(w, h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = tileFbm(i, j, w, 16, 3, 51); const v = 170 + n * 85, k = (j * w + i) * 4; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; } x.putImageData(img, 0, 0); });
  // water normal map (tiling ripples)
  TEX.waterN = canvasTex(256, 256, (x, w, h) => {
    const hgt = new Float32Array(w * h); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) hgt[j * w + i] = tileFbm(i, j, w, 8, 4, 61) + tileFbm(i, j, w, 24, 2, 66) * 0.4;
    const img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const l = hgt[j * w + ((i - 1 + w) % w)], r = hgt[j * w + ((i + 1) % w)], u = hgt[((j - 1 + h) % h) * w + i], d = hgt[((j + 1) % h) * w + i]; let nx = (l - r) * 3, ny = (u - d) * 3, nz = 1; const L = Math.hypot(nx, ny, nz); const k = (j * w + i) * 4; img.data[k] = (nx / L * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / L * 0.5 + 0.5) * 255; img.data[k + 2] = (nz / L * 0.5 + 0.5) * 255; img.data[k + 3] = 255; }
    x.putImageData(img, 0, 0);
  }, true, false);
  // soft round glow for lamps, fires and the moon halo
  TEX.glow = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, false);
  // blood splat decal
  TEX.blood = canvasTex(128, 128, (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0)'; x.fillRect(0, 0, w, h); for (let i = 0; i < 18; i++) { const r = rand(6, 26), a = rand(0, TAU), d = rand(0, 34); x.fillStyle = `rgba(${randi(90, 130)},${randi(4, 12)},${randi(6, 14)},${rand(0.6, 0.95)})`; x.beginPath(); x.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, r * rand(0.5, 1), a, 0, TAU); x.fill(); } for (let i = 0; i < 30; i++) { const a = rand(0, TAU), d = rand(30, 60); x.fillStyle = 'rgba(110,8,10,.8)'; x.beginPath(); x.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rand(1, 3.5), 0, TAU); x.fill(); } }, false);
  // footprint / claw track decal
  TEX.track = canvasTex(64, 64, (x) => { x.fillStyle = 'rgba(30,20,12,.85)'; x.beginPath(); x.ellipse(32, 38, 11, 14, 0, 0, TAU); x.fill(); for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(16 + i * 10.5, 16 - (i === 1 || i === 2 ? 5 : 0), 4.5, 6, 0, 0, TAU); x.fill(); } }, false);
  TEX.ground.repeat.set(1, 1);
}
