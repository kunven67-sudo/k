
// =====================================================================
// CREATURES — beasts painted big, shaded and outlined (Moonlighter style).
// Each returns frames facing right: [idle, move1..move4] plus .atk (attack).
// Colours come from the monster's palette: 1 main, 2 second, 3 third,
// e eyes, w eye-whites/highlight, t teeth, n nose.
// =====================================================================
function cCanvas(w, h, fn) {
  const [c, x] = mkCanvas(w, h);
  const D = {
    px(i, j, col) { if (!col) return; x.fillStyle = col; x.fillRect(Math.round(i), Math.round(j), 1, 1); },
    rect(i, j, ww, hh, col) { if (!col) return; x.fillStyle = col; x.fillRect(Math.round(i), Math.round(j), Math.round(ww), Math.round(hh)); },
    // filled ellipse; colFn(nx, ny) picks the colour from the normalised position (-1..1) so blobs get light and shadow
    ell(cx, cy, rx, ry, colFn) {
      for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) {
        const nx = (i + 0.5 - cx) / rx, ny = (j + 0.5 - cy) / ry; if (nx * nx + ny * ny > 1) continue;
        const col = typeof colFn === 'function' ? colFn(nx, ny) : colFn; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
      }
    },
    poly(pts, col) { // pixel-exact polygon fill
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [a, b] of pts) { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); }
      x.fillStyle = col;
      for (let j = Math.floor(y0); j <= Math.ceil(y1); j++) for (let i = Math.floor(x0); i <= Math.ceil(x1); i++) {
        const px0 = i + 0.5, py0 = j + 0.5; let inside = false;
        for (let k = 0, l = pts.length - 1; k < pts.length; l = k++) { const [ax, ay] = pts[k], [bx, by] = pts[l]; if ((ay > py0) !== (by > py0) && px0 < ((bx - ax) * (py0 - ay)) / (by - ay) + ax) inside = !inside; }
        if (inside) x.fillRect(i, j, 1, 1);
      }
    },
    line(ax, ay, bx, by, col, w = 1) { const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1); x.fillStyle = col; for (let s = 0; s <= n; s++) x.fillRect(Math.round(ax + ((bx - ax) * s) / n - (w - 1) / 2), Math.round(ay + ((by - ay) * s) / n - (w - 1) / 2), w, w); },
  };
  fn(D); outlineCanvas(c); return c;
}
const lit = (base, light, dark, k = 0.4) => (nx, ny) => (ny > 0.45 || (ny > 0.2 && nx > 0.6) ? dark : ny < -k && nx < 0.35 ? light : base);
const CREATURE_PAINT = {
  slime(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 1.3), c3 = p[3] || shade(c1, 0.7), eye = p.e || '#1a1020', wht = p.w || '#ffffff';
    const frame = (squish, blink, angry) => cCanvas(24, 19, (D) => {
      const rx = 10.5 + squish, ry = 7.5 - squish * 0.7;
      D.ell(12, 18 - ry, rx, ry, lit(c1, c2, c3, 0.35)); D.rect(12 - rx + 1.5, 17, rx * 2 - 3, 1, c3);
      D.ell(12 - rx * 0.45, 18 - ry * 1.45, 2, 1.4, shade(c2, 1.15)); D.px(12 - rx * 0.45 + 2.5, 18 - ry * 1.55, '#ffffff'); D.px(12 - rx * 0.45 - 0.5, 18 - ry * 1.55, '#ffffff');
      D.px(16, 15, shade(c1, 1.15)); D.px(6, 14, shade(c1, 1.1)); D.px(9, 16, shade(c3, 1.2));
      const ey = Math.round(18 - ry * 1.05);
      for (const ex of [8, 14]) { if (blink) D.rect(ex, ey + 1, 2, 1, eye); else { D.rect(ex, ey - 1, 2, 3, eye); D.px(ex, ey - 1, wht); } }
      if (angry) { D.px(7, ey - 2, eye); D.px(16, ey - 2, eye); }
      D.rect(11, ey + 3, 2, 1, shade(c3, 0.8));
    });
    const f = [frame(0, false), frame(0.8, false), frame(0, false), frame(-0.6, false), frame(0, true)]; f.atk = frame(1.4, false, true); return f;
  },
  bat(p) {
    const c1 = p[1], c2 = shade(c1, 1.35), c3 = shade(c1, 0.7), eye = p.e, fang = p.t || '#ffffff';
    const frame = (wing) => cCanvas(28, 18, (D) => {
      const wy = [-6, -1, 4][wing];
      for (const s of [-1, 1]) { const sx = 14 + s * 3, tip = 14 + s * 13; D.poly([[sx, 8], [14 + s * 8, 6 + wy * 0.6], [tip, 5 + wy], [14 + s * 11, 10 + wy * 0.4], [14 + s * 8, 9 + wy * 0.2], [14 + s * 6, 12], [sx, 11]], c3); D.line(sx, 8, tip, 5 + wy, c1); }
      D.ell(14, 10, 4.5, 4.5, lit(c1, c2, c3)); D.poly([[10.5, 7], [11, 2.5], [13, 6]], c1); D.poly([[17.5, 7], [17, 2.5], [15, 6]], c1);
      D.px(12, 9, eye); D.px(16, 9, eye); D.px(13, 9, shade(eye, 0.6)); D.px(15, 9, shade(eye, 0.6)); D.px(13, 12, fang); D.px(15, 12, fang);
    });
    const f = [frame(0), frame(1), frame(2), frame(1)]; f.atk = frame(2); return f;
  },
  wolf(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 0.7), belly = shade(c1, 1.18), eye = p.e, nose = p.n || '#120a10';
    const frame = (k, atk) => cCanvas(32, 21, (D) => {
      const ph = (k / 4) * TAU, legs = [[10, Math.sin(ph) * 2.2], [13, -Math.sin(ph) * 2.2], [20, -Math.sin(ph) * 2.2], [23, Math.sin(ph) * 2.2]], bob = k % 2 ? -0.5 : 0;
      // tail
      D.poly([[6, 9 + bob], [1, 5 + Math.sin(ph) * 1.5], [2, 3 + Math.sin(ph)], [7, 7 + bob]], c2); D.px(1, 4 + Math.round(Math.sin(ph)), belly);
      // far legs (darker)
      for (const [lx, sw] of [legs[1], legs[3]]) { D.line(lx, 12 + bob, lx + sw, 18, shade(c1, 0.72), 2); D.rect(lx + sw - 1, 18, 3, 1, shade(c2, 0.8)); }
      // body
      D.ell(16, 11 + bob, 10, 5, (nx, ny) => (ny < -0.35 ? c2 : ny > 0.45 ? belly : c1)); D.ell(21, 10 + bob, 5, 5.5, (nx, ny) => (ny < -0.4 ? c2 : ny > 0.4 ? belly : c1));
      for (const [lx, sw] of [legs[0], legs[2]]) { D.line(lx, 13 + bob, lx + sw, 18, c1, 2); D.rect(lx + sw - 1, 18, 3, 1, c2); }
      // head
      const hy = 7 + bob + (atk ? 1 : 0);
      D.ell(26, hy, 4.5, 3.8, (nx, ny) => (ny < -0.4 ? c2 : c1)); D.poly([[23, hy - 2], [23.5, hy - 7], [26, hy - 3]], c2); D.poly([[26, hy - 3], [27.5, hy - 7], [28.5, hy - 2]], c2);
      D.rect(28, hy, 4, 2.5, c1); D.rect(28, hy + 2, 4, 1, belly); D.px(31, hy, nose); D.px(27, hy - 1, eye); D.px(26, hy - 1, shade(eye, 0.55));
      if (atk) { D.rect(28, hy + 3, 4, 2, '#5a1a1e'); D.px(29, hy + 3, '#ffffff'); D.px(31, hy + 3, '#ffffff'); }
    });
    const f = [frame(0), frame(1), frame(2), frame(3), frame(4)]; f[0] = frame(0); f.atk = frame(1, true); return f;
  },
  spider(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 1.4), eye = p.e, fang = p.t || '#efe4cc';
    const frame = (k, atk) => cCanvas(30, 20, (D) => {
      const ph = (k / 4) * TAU;
      const leg = (bx, by, kx, ky, fx, fy, col) => { D.line(bx, by, kx, ky, col); D.line(kx, ky, fx, fy, col); };
      for (let i = 0; i < 4; i++) { const sw = Math.sin(ph + i * 1.6) * 1.6, dark = shade(c1, 0.75); leg(15 + i, 10, 9 + i * 4 + sw, 3 + (i % 2), 5 + i * 6 + sw, 18, dark); }
      D.ell(9, 10, 7.5, 6.5, lit(c1, c2, shade(c1, 0.7))); D.ell(9, 8, 2.5, 2, c2); D.px(6, 12, c2); D.px(12, 13, c2);
      D.ell(19, 11, 4.5, 4, lit(c1, c2, shade(c1, 0.7)));
      for (let i = 0; i < 4; i++) { const sw = Math.sin(ph + i * 1.6 + Math.PI) * 1.6; leg(17 + i * 0.5, 12, 10 + i * 5 + sw, 6 + (i % 2), 6 + i * 6.5 + sw, 18, c1); }
      D.px(21, 9, eye); D.px(22, 10, eye); D.px(20, 10, eye); D.px(22, 8, shade(eye, 1.3));
      D.line(23, 12, 24, atk ? 16 : 14, fang); D.line(21, 13, 22, atk ? 16 : 15, fang);
    });
    const f = [frame(0), frame(1), frame(2), frame(3), frame(0)]; f.atk = frame(1, true); return f;
  },
  frog(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 1.3), belly = p[3] || shade(c1, 1.5), eye = p.e, wht = p.w || '#ffe04a';
    const frame = (crouch, atk) => cCanvas(24, 18, (D) => {
      const by = crouch;
      D.ell(6, 14, 4.5, 3, shade(c1, 0.75)); D.rect(2, 16, 5, 1, shade(c1, 0.65));
      D.ell(12, 12 + by * 0.5, 9.5, 5.5 - by * 0.5, (nx, ny) => (ny > 0.25 ? belly : ny < -0.4 && nx < 0.3 ? c2 : c1));
      D.px(8, 9 + by, c2); D.px(13, 8 + by, c2); D.px(10, 11 + by, shade(c1, 0.8));
      for (const ex of [9, 16]) { D.ell(ex, 6 + by, 2.6, 2.6, wht); D.rect(ex - 0.5, 5 + by, 1.5, 2.5, eye); }
      D.rect(15, 13, 6, 1, shade(c1, 0.6)); D.rect(17, 16, 4, 1, c1);
      if (atk) { D.rect(20, 12, 4, 2, '#d85a7a'); D.px(23, 11, '#d85a7a'); }
    });
    const f = [frame(0), frame(1), frame(0), frame(-1), frame(0)]; f.atk = frame(0, true); return f;
  },
  scorpion(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 1.3), c3 = shade(c1, 0.72), eye = p.e;
    const frame = (k, atk) => cCanvas(32, 20, (D) => {
      const ph = (k / 4) * TAU;
      for (let i = 0; i < 3; i++) { const sw = Math.sin(ph + i * 2) * 1.5; D.line(12 + i * 3, 14, 10 + i * 4 + sw, 18, c3); }
      // tail arcs up and over the back to the stinger
      const tail = atk ? [[7, 13], [4, 10], [4, 6], [7, 3], [12, 2], [17, 4]] : [[7, 13], [4, 10], [4, 6], [6, 3], [10, 2], [13, 4 + Math.sin(ph) * 0.8]];
      tail.forEach(([tx, ty], i) => D.ell(tx, ty, 2.4 - i * 0.15, 2.2 - i * 0.12, lit(c1, c2, c3)));
      const [sx, sy] = tail[tail.length - 1]; D.poly([[sx, sy], [sx + 3, sy + (atk ? 3 : 2)], [sx + 1, sy + 2]], '#2a1a0a');
      D.ell(14, 13, 7.5, 3.6, lit(c1, c2, c3)); D.ell(21, 13, 3.5, 3, lit(c1, c2, c3)); for (let i = 0; i < 3; i++) D.px(10 + i * 3, 11, c2);
      const cl = atk ? 2 : Math.sin(ph) * 0.8;
      D.line(22, 13, 26, 10 + cl, c1, 2); D.ell(27.5, 9 + cl, 2.8, 2, lit(c1, c2, c3)); D.rect(29, 7 + cl, 2.5, 1, c1); D.rect(29, 10 + cl, 2.5, 1, c1);
      D.line(22, 15, 26, 15 - cl, c3, 1); D.px(23, 11, eye); D.px(22, 11, shade(eye, 1.4));
      for (let i = 0; i < 3; i++) { const sw = Math.sin(ph + i * 2 + Math.PI) * 1.5; D.line(13 + i * 3, 15, 13 + i * 4 + sw, 18, c1); }
    });
    const f = [frame(0), frame(1), frame(2), frame(3), frame(0)]; f.atk = frame(0, true); return f;
  },
  crab(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 1.3), belly = p[3] || shade(c1, 1.5), c3 = shade(c1, 0.7), eye = p.e;
    const frame = (k, snap) => cCanvas(30, 20, (D) => {
      const ph = (k / 4) * TAU;
      for (let i = 0; i < 3; i++) { const sw = Math.sin(ph + i) * 1.4; D.line(9 - i * 2, 14, 4 - i * 2 + sw, 18, c3, 1); D.line(21 + i * 2, 14, 26 + i * 2 - sw, 18, c3, 1); }
      D.line(12, 9, 12, 4, c1); D.line(18, 9, 18, 4, c1); D.ell(12, 3.5, 1.6, 1.6, eye); D.ell(18, 3.5, 1.6, 1.6, eye); D.px(11, 3, '#ffffff'); D.px(17, 3, '#ffffff');
      D.ell(15, 12, 10, 5.5, (nx, ny) => (ny > 0.35 ? belly : ny < -0.4 && nx < 0.3 ? c2 : c1)); D.px(10, 9, c2); D.px(13, 8, c2);
      for (const s of [-1, 1]) { const cx = 15 + s * 11, up = Math.sin(ph) * 0.8; D.ell(cx, 8 + up, 3.5, 3, lit(c1, c2, c3)); const open = snap ? 2.5 : 1; D.poly([[cx + s * 1, 6 + up], [cx + s * 4, 3 - open + up], [cx + s * 2.5, 6 + up]], c1); D.poly([[cx + s * 1, 9 + up], [cx + s * 4.5, 8 + up], [cx + s * 2, 7 + up]], c1); D.line(15 + s * 6, 12, cx, 10 + up, c1, 2); }
    });
    const f = [frame(0), frame(1), frame(2), frame(3), frame(0)]; f.atk = frame(0, true); return f;
  },
  crystal(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 0.6), eye = p.e || '#ffffff', hi = shade(c1, 1.25);
    const frame = (k) => cCanvas(24, 30, (D) => {
      const o = Math.sin((k / 4) * TAU);
      D.poly([[4 + o, 10], [7 + o, 4], [9 + o, 12], [6 + o, 20]], c2); D.poly([[20 - o, 9], [17 - o, 3], [15 - o, 12], [18 - o, 19]], c2);
      D.poly([[12, 1], [18, 13], [12, 28], [6, 13]], c1); D.poly([[12, 1], [18, 13], [12, 28]], shade(c1, 0.8)); D.poly([[12, 1], [8, 11], [12, 9]], hi);
      D.line(12, 3, 12, 26, shade(c1, 0.9)); D.ell(12, 13, 2.2, 2.2, eye); D.px(12, 13, '#ffffff');
      D.poly([[8 + o * 0.5, 24], [10 + o * 0.5, 22], [11 + o * 0.5, 27]], c2);
    });
    const f = [frame(0), frame(1), frame(2), frame(3), frame(0)]; f.atk = frame(2); return f;
  },
  wyrm(p) {
    const c1 = p[1], c2 = p[2] || shade(c1, 1.3), c3 = p[3] || shade(c1, 0.7), eye = p.e, horn = p.w || '#ffffff';
    const frame = (k, atk) => cCanvas(40, 26, (D) => {
      const ph = (k / 4) * TAU;
      D.poly([[17, 9], [12, 1 + Math.sin(ph) * 2], [21, 5], [27, 1 + Math.sin(ph) * 2], [24, 9]], c3);
      for (let i = 0; i <= 14; i++) { const t = i / 14, x = 3 + t * 24, y = 18 - t * 6 + Math.sin(ph + t * 5) * 2.2, r = 2 + t * 3.2; D.ell(x, y, r, r * 0.9, (nx, ny) => (ny > 0.35 ? c2 : ny < -0.4 ? shade(c1, 1.12) : c1)); }
      for (let i = 2; i < 13; i += 3) { const t = i / 14, x = 3 + t * 24, y = 18 - t * 6 + Math.sin(ph + t * 5) * 2.2 - (2 + t * 3.2); D.px(x, y, horn); }
      const hx = 31, hy = 8 + (atk ? 1 : 0);
      D.ell(hx, hy, 5, 4, lit(c1, shade(c1, 1.15), c3)); D.rect(hx + 3, hy, 5, 3, c1); D.rect(hx + 3, hy + 2, 5, 1, c2); D.px(hx + 7, hy, c3);
      D.line(hx - 2, hy - 3, hx - 6, hy - 7, horn); D.line(hx, hy - 3, hx - 2, hy - 7, horn); D.px(hx + 1, hy - 1, eye); D.px(hx, hy - 1, shade(eye, 0.6));
      if (atk) { D.rect(hx + 4, hy + 3, 4, 2, '#3a1a2a'); D.px(hx + 7, hy + 4, '#c8eeff'); }
      D.line(24, 15, 25, 21, c3, 2); D.line(14, 17, 14, 22, c3, 2);
    });
    const f = [frame(0), frame(1), frame(2), frame(3), frame(0)]; f.atk = frame(1, true); return f;
  },
};
