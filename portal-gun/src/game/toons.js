// Flat 2D cartoon drawings of the characters, painted with canvas paths.
// They stand in the 3D world like paper cutouts that always face you.
// Every drawing uses a 400-wide box; `h` is the box height, feet sit at the bottom.

const INK = '#1c1b20';

function begin(g) {
  g.lineJoin = 'round';
  g.lineCap = 'round';
}

/** fill + ink outline for a path built by fn */
function shape(g, fn, fill, lw = 6) {
  g.beginPath();
  fn(g);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (lw) {
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.stroke();
  }
}

function ell(g, x, y, rx, ry, fill, lw = 6, rot = 0) {
  shape(g, (c) => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2), fill, lw);
}

function stroke(g, fn, lw = 5, color = INK) {
  g.beginPath();
  fn(g);
  g.lineWidth = lw;
  g.strokeStyle = color;
  g.stroke();
}

/** shade the right part of the last shape (cel shadow), clipped to fn */
function shade(g, fn, color, fromX) {
  g.save();
  g.beginPath();
  fn(g);
  g.clip();
  g.fillStyle = color;
  g.fillRect(fromX, 0, 400, 2000);
  g.restore();
}

function poly(pts) {
  return (c) => {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  };
}

function eye(g, x, y, rx, ry, o = {}) {
  if (o.closed) {
    stroke(g, (c) => c.ellipse(x, y + ry * 0.1, rx * 0.9, ry * 0.35, 0, 0.1 * Math.PI, 0.9 * Math.PI), 5);
    return;
  }
  ell(g, x, y, rx, ry, '#ffffff', o.lw ?? 5);
  const px = x + (o.lookX ?? 0) * rx * 0.3;
  const py = y + (o.lookY ?? 0) * ry * 0.3;
  g.fillStyle = INK;
  if (o.scribble) {
    g.beginPath();
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = o.pupil * (i % 2 ? 0.75 : 1.25);
      g.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r);
    }
    g.fill();
  } else {
    g.beginPath();
    g.arc(px, py, o.pupil, 0, Math.PI * 2);
    g.fill();
  }
  if (o.lid) {
    // droopy upper lid
    g.save();
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = o.lidColor;
    g.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 * o.lid);
    g.restore();
    const ly = y - ry + ry * 2 * o.lid;
    stroke(g, (c) => {
      c.moveTo(x - rx * 0.98, ly + 2);
      c.quadraticCurveTo(x, ly - 4, x + rx * 0.98, ly + 2);
    }, 4);
    ell(g, x, y, rx, ry, null, o.lw ?? 5);
  }
}

/** a simple 4-finger cartoon hand hanging down; side = -1 left, +1 right */
function hand(g, x, y, skin, side, s = 1) {
  shape(g, (c) => {
    c.moveTo(x - 14 * s, y - 6 * s);
    c.bezierCurveTo(x - 20 * s, y + 14 * s, x - 14 * s, y + 30 * s, x - 2 * s, y + 32 * s);
    c.bezierCurveTo(x + 10 * s, y + 34 * s, x + 18 * s, y + 18 * s, x + 15 * s, y - 6 * s);
    c.closePath();
  }, skin, 5);
  // thumb
  shape(g, (c) => c.ellipse(x - side * 16 * s, y + 6 * s, 6 * s, 11 * s, side * 0.5, 0, Math.PI * 2), skin, 5);
  // finger creases
  stroke(g, (c) => {
    c.moveTo(x - 6 * s, y + 18 * s);
    c.lineTo(x - 6 * s, y + 30 * s);
    c.moveTo(x + 5 * s, y + 18 * s);
    c.lineTo(x + 5 * s, y + 31 * s);
  }, 3);
}

function mouthShape(g, x, y, w, open, curve = 0.06) {
  if (open) {
    shape(g, (c) => {
      c.moveTo(x - w / 2, y);
      c.bezierCurveTo(x - w / 3, y - 4, x + w / 3, y - 4, x + w / 2, y);
      c.bezierCurveTo(x + w / 2.6, y + w * 0.55, x - w / 2.6, y + w * 0.55, x - w / 2, y);
    }, '#4a1d22', 5);
    shape(g, (c) => c.ellipse(x, y + w * 0.3, w * 0.22, w * 0.1, 0, 0, Math.PI * 2), '#d9616b', 0);
  } else {
    stroke(g, (c) => {
      c.moveTo(x - w / 2, y);
      c.quadraticCurveTo(x, y + w * curve, x + w / 2, y);
    }, 5);
  }
}

/** how far the upper body drops when sitting */
function sitDrop(p, hipY, footY) {
  return p.sit ? (footY - hipY) * 0.42 : 0;
}

/** legs with a walk cycle (phase in radians), or bent when sitting */
function legs(g, pants, shoe, o) {
  const { hipY, footY, lx, rx, w, walk = 0, shoeRx = 34, shoeRy = 17, shoeShade, sit } = o;
  if (sit) {
    const drop = (footY - hipY) * 0.42;
    const kneeY = hipY + drop + w * 0.9;
    for (const x of [lx, rx]) {
      // shins hanging down from the knee
      shape(g, poly([[x - w / 2 + 2, kneeY - 6], [x + w / 2 - 2, kneeY - 6], [x + w / 2 - 4, footY], [x - w / 2 + 4, footY]]), pants, 6);
      // knee (thigh pointing at you)
      shape(g, (c) => c.ellipse(x, kneeY - 8, w * 0.62, w * 0.55, 0, 0, Math.PI * 2), pants, 6);
    }
    for (const x of [lx, rx]) {
      const cx = x + (x < 200 ? -4 : 4);
      shape(g, (c) => {
        c.moveTo(cx - shoeRx, footY + shoeRy * 0.6);
        c.bezierCurveTo(cx - shoeRx, footY - shoeRy, cx + shoeRx, footY - shoeRy * 1.1, cx + shoeRx, footY + shoeRy * 0.6);
        c.closePath();
      }, shoe, 6);
    }
    return;
  }
  const lift = (v) => Math.max(0, v) * 22;
  const sw = Math.sin(walk);
  const ll = lift(sw), rl = lift(-sw);
  for (const [x, l, dx] of [[lx, ll, -sw * 6], [rx, rl, sw * 6]]) {
    shape(g, poly([[x - w / 2, hipY], [x + w / 2, hipY], [x + w / 2 - 2 + dx, footY - l], [x - w / 2 + 2 + dx, footY - l]]), pants, 6);
  }
  for (const [x, l, dx] of [[lx, ll, -sw * 6], [rx, rl, sw * 6]]) {
    const cx = x + dx + (x < 200 ? -6 : 6);
    shape(g, (c) => {
      c.moveTo(cx - shoeRx, footY - l + shoeRy * 0.6);
      c.bezierCurveTo(cx - shoeRx, footY - l - shoeRy, cx + shoeRx, footY - l - shoeRy * 1.1, cx + shoeRx, footY - l + shoeRy * 0.6);
      c.closePath();
    }, shoe, 6);
    if (shoeShade) stroke(g, (c) => {
      c.moveTo(cx - shoeRx + 6, footY - l + shoeRy * 0.15);
      c.lineTo(cx + shoeRx - 6, footY - l + shoeRy * 0.15);
    }, 3, shoeShade);
  }
}

// ---------------------------------------------------------------------------- Morty

function morty(g, p) {
  begin(g);
  const skin = '#f9d3ae';
  const yellow = '#f4df4a';
  const bob = p.bob || 0;
  legs(g, '#3c62ad', '#ffffff', { hipY: 520, footY: 668, lx: 172, rx: 228, w: 50, walk: p.walk, shoeRx: 32, shoeRy: 16, shoeShade: '#c8ccd4', sit: p.sit });
  g.translate(0, bob + sitDrop(p, 520, 668));
  // pants top (hips)
  shape(g, poly([[138, 462], [262, 462], [266, 528], [134, 528]]), '#3c62ad', 6);
  stroke(g, (c) => { c.moveTo(200, 500); c.lineTo(200, 528); }, 4);
  // arms (behind sleeves)
  const swing = Math.sin(p.walk || 0) * 10;
  for (const s of [-1, 1]) {
    const x0 = 200 + s * 104, ax = 200 + s * 112 + s * (s < 0 ? swing : -swing) * 0.4;
    shape(g, poly([[x0 - 11, 392], [x0 + 11, 392], [ax + 10, 506], [ax - 10, 506]]), skin, 5);
    hand(g, ax, 506, skin, s, 0.95);
  }
  // shirt
  const shirt = poly([[165, 300], [112, 318], [74, 350], [90, 404], [118, 396], [122, 476], [278, 476], [282, 396], [310, 404], [326, 350], [288, 318], [235, 300]]);
  shape(g, shirt, yellow, 6);
  shade(g, shirt, 'rgba(190,150,20,0.28)', 262);
  // collar
  shape(g, (c) => { c.moveTo(166, 300); c.quadraticCurveTo(200, 330, 234, 300); }, skin, 5);
  stroke(g, (c) => { c.moveTo(122, 396); c.lineTo(118, 360); c.moveTo(278, 396); c.lineTo(282, 360); }, 4);
  // neck
  shape(g, poly([[182, 282], [218, 282], [220, 312], [180, 312]]), skin, 0);
  // ears
  ell(g, 54, 186, 18, 25, skin, 5);
  ell(g, 346, 186, 18, 25, skin, 5);
  // head
  const head = (c) => {
    c.moveTo(200, 40);
    c.bezierCurveTo(292, 38, 348, 96, 348, 176);
    c.bezierCurveTo(348, 256, 288, 302, 200, 302);
    c.bezierCurveTo(112, 302, 52, 256, 52, 176);
    c.bezierCurveTo(52, 96, 108, 38, 200, 40);
  };
  shape(g, head, skin, 6);
  // hair
  const hair = (c) => {
    c.moveTo(50, 176);
    c.bezierCurveTo(36, 78, 110, 20, 200, 22);
    c.bezierCurveTo(290, 20, 364, 78, 350, 176);
    c.bezierCurveTo(342, 140, 326, 116, 304, 110);
    c.bezierCurveTo(286, 118, 268, 98, 244, 102);
    c.bezierCurveTo(224, 112, 206, 94, 184, 100);
    c.bezierCurveTo(164, 110, 146, 96, 124, 106);
    c.bezierCurveTo(96, 114, 70, 136, 50, 176);
    c.closePath();
  };
  shape(g, hair, '#6e4527', 6);
  stroke(g, (c) => { c.moveTo(120, 58); c.quadraticCurveTo(150, 46, 176, 50); c.moveTo(240, 44); c.quadraticCurveTo(272, 50, 294, 66); }, 4, '#4f301a');
  // eyes
  const wide = p.expr === 'scared';
  eye(g, 154, 178, 43, wide ? 52 : 47, { pupil: wide ? 5 : 6.5, closed: p.eyes === 'closed', lookX: p.lookX, lookY: p.lookY });
  eye(g, 246, 178, 43, wide ? 52 : 47, { pupil: wide ? 5 : 6.5, closed: p.eyes === 'closed', lookX: p.lookX, lookY: p.lookY });
  // brows
  const worry = p.expr === 'scared' || p.expr === 'worried' ? 10 : 0;
  stroke(g, (c) => {
    c.moveTo(128, 122 + worry);
    c.quadraticCurveTo(150, 116, 176, 120 - worry);
    c.moveTo(224, 120 - worry);
    c.quadraticCurveTo(250, 116, 272, 122 + worry);
  }, 5, '#4f301a');
  // nose
  stroke(g, (c) => { c.moveTo(194, 226); c.bezierCurveTo(186, 236, 196, 246, 208, 240); }, 5);
  // mouth
  if (p.expr === 'scared') mouthShape(g, 200, 262, 44, true);
  else mouthShape(g, 200, 264, 46, p.mouth === 'open', p.expr === 'happy' ? 0.3 : 0.04);
}

// ---------------------------------------------------------------------------- Rick

function rickHair(g, cx, cy, color, dark) {
  // big uneven spikes fanning up and out behind the head
  const spikes = [
    [-178, 100], [-166, 132], [-150, 158], [-132, 168], [-114, 166], [-98, 168], [-82, 162], [-66, 168],
    [-48, 166], [-30, 156], [-14, 132], [-2, 100],
  ];
  const pts = [];
  for (let i = 0; i < spikes.length; i++) {
    const [deg, len] = spikes[i];
    const a = (deg * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * len, cy + Math.sin(a) * len * 1.02]);
    if (i < spikes.length - 1) {
      const b = ((deg + spikes[i + 1][0]) / 2) * (Math.PI / 180);
      const r = 96 + (i % 2) * 10;
      pts.push([cx + Math.cos(b) * r, cy + Math.sin(b) * r]);
    }
  }
  const path = (c) => {
    c.moveTo(cx - 92, cy + 30);
    for (const [x, y] of pts) c.lineTo(x, y);
    c.lineTo(cx + 92, cy + 30);
    c.closePath();
  };
  shape(g, path, color, 6);
  for (let i = 0; i < pts.length; i += 2) {
    const [x, y] = pts[i];
    stroke(g, (c) => {
      c.moveTo(cx + (x - cx) * 0.62, cy + (y - cy) * 0.62);
      c.quadraticCurveTo(cx + (x - cx) * 0.8 + 6, cy + (y - cy) * 0.8, cx + (x - cx) * 0.9, cy + (y - cy) * 0.9);
    }, 3, dark);
  }
}

function rick(g, p) {
  begin(g);
  const skin = '#e3dccb';
  const coat = '#f4f8f8';
  const coatShade = '#cfdde3';
  const shirtC = '#a3d5e8';
  const bob = p.bob || 0;
  legs(g, '#8b6844', '#5a3a22', { hipY: 700, footY: 958, lx: 172, rx: 228, w: 46, walk: p.walk, shoeRx: 34, shoeRy: 16, sit: p.sit });
  g.translate(0, bob + sitDrop(p, 700, 958));
  // shirt behind the open coat
  shape(g, poly([[168, 360], [232, 360], [240, 700], [160, 700]]), shirtC, 6);
  shape(g, poly([[160, 680], [240, 680], [244, 720], [156, 720]]), '#8b6844', 6);
  // coat panels
  for (const s of [-1, 1]) {
    const X = (x) => 200 + s * (x - 200);
    const panel = poly([[X(176), 358], [X(108), 380], [X(94), 460], [X(86), 776], [X(178), 776], [X(180), 530], [X(160), 462], [X(186), 398]]);
    shape(g, panel, coat, 6);
    if (s > 0) shade(g, panel, 'rgba(160,190,205,0.32)', 260);
    stroke(g, (c) => { c.moveTo(X(108), 600); c.lineTo(X(160), 600); }, 4);
    shape(g, poly([[X(186), 398], [X(160), 462], [X(146), 430], [X(176), 372]]), coat, 4);
  }
  for (const s of [-1, 1]) shape(g, poly([[200 + s * 20, 352], [200 + s * 52, 344], [200 + s * 40, 392]]), coatShade, 4);
  // sleeves + hands
  const swing = Math.sin(p.walk || 0) * 12;
  for (const s of [-1, 1]) {
    const sx = 200 + s * 112, hx = 200 + s * 122 + (s < 0 ? swing : -swing) * 0.4;
    shape(g, poly([[sx - 6 * s, 380], [sx + 30 * s, 400], [hx + 24 * s, 630], [hx - 20 * s, 636], [sx - 10 * s, 440]]), coat, 6);
    shape(g, poly([[hx - 18 * s, 626], [hx + 22 * s, 622], [hx + 22 * s, 640], [hx - 18 * s, 644]]), shirtC, 4);
    hand(g, hx + 2 * s, 650, skin, s, 1.05);
  }
  // neck
  shape(g, poly([[178, 316], [222, 316], [224, 362], [176, 362]]), skin, 5);
  // hair fans out behind the head
  rickHair(g, 200, 176, '#a9d4e4', '#7fb1c6');
  // ears
  ell(g, 103, 222, 14, 24, skin, 5);
  ell(g, 297, 222, 14, 24, skin, 5);
  // head: tall cranium, wide cheekbones, long jaw and a chin that sticks out
  const head = (c) => {
    c.moveTo(200, 84);
    c.bezierCurveTo(262, 84, 300, 126, 300, 192);
    c.bezierCurveTo(300, 236, 292, 268, 270, 296);
    c.bezierCurveTo(254, 318, 236, 336, 216, 342);
    c.bezierCurveTo(206, 348, 194, 348, 184, 342);
    c.bezierCurveTo(164, 336, 146, 318, 130, 296);
    c.bezierCurveTo(108, 268, 100, 236, 100, 192);
    c.bezierCurveTo(100, 126, 138, 84, 200, 84);
  };
  shape(g, head, skin, 6);
  // a few spikes in front of the scalp so the hairline reads
  shape(g, (c) => {
    c.moveTo(118, 132);
    c.lineTo(132, 108);
    c.lineTo(148, 122);
    c.lineTo(164, 100);
    c.lineTo(180, 118);
    c.lineTo(200, 96);
    c.lineTo(220, 118);
    c.lineTo(236, 100);
    c.lineTo(252, 122);
    c.lineTo(268, 108);
    c.lineTo(282, 132);
    c.bezierCurveTo(262, 104, 230, 92, 200, 92);
    c.bezierCurveTo(170, 92, 138, 104, 118, 132);
    c.closePath();
  }, '#a9d4e4', 5);
  // the jagged unibrow, sitting right on top of the eyes
  shape(g, (c) => {
    c.moveTo(112, 176);
    c.lineTo(130, 156);
    c.lineTo(150, 168);
    c.lineTo(170, 152);
    c.lineTo(200, 168);
    c.lineTo(230, 152);
    c.lineTo(250, 168);
    c.lineTo(270, 156);
    c.lineTo(288, 176);
    c.lineTo(276, 186);
    c.quadraticCurveTo(240, 172, 200, 184);
    c.quadraticCurveTo(160, 172, 124, 186);
    c.closePath();
  }, '#a9d4e4', 4.5);
  // big eyes, tiny pupils, droopy lids
  const lid = p.drunk ? 0.4 : 0.2;
  eye(g, 160, 214, 36, 33, { pupil: 5, closed: p.eyes === 'closed', lid, lidColor: skin, lookX: p.lookX, lookY: p.lookY });
  eye(g, 240, 214, 36, 33, { pupil: 5, closed: p.eyes === 'closed', lid, lidColor: skin, lookX: p.lookX, lookY: p.lookY });
  // bags under the eyes
  stroke(g, (c) => {
    c.moveTo(130, 246);
    c.quadraticCurveTo(160, 262, 188, 246);
    c.moveTo(212, 246);
    c.quadraticCurveTo(240, 262, 270, 246);
  }, 3.5);
  // nose
  stroke(g, (c) => {
    c.moveTo(196, 230);
    c.bezierCurveTo(192, 254, 182, 270, 190, 280);
    c.bezierCurveTo(198, 288, 214, 284, 214, 272);
  }, 5);
  // cheek lines down to the mouth
  stroke(g, (c) => {
    c.moveTo(150, 262);
    c.quadraticCurveTo(142, 284, 150, 304);
    c.moveTo(252, 262);
    c.quadraticCurveTo(260, 284, 252, 304);
  }, 3.5);
  // wide mouth + chin
  if (p.mouth === 'open') {
    shape(g, (c) => {
      c.moveTo(150, 302);
      c.bezierCurveTo(180, 296, 222, 296, 252, 302);
      c.bezierCurveTo(240, 336, 162, 336, 150, 302);
    }, '#4a1d22', 5);
    shape(g, poly([[164, 303], [238, 303], [234, 312], [168, 312]]), '#f6f1e2', 0);
    shape(g, (c) => c.ellipse(200, 324, 22, 7, 0, 0, Math.PI * 2), '#d9616b', 0);
  } else {
    stroke(g, (c) => {
      c.moveTo(148, 306);
      c.bezierCurveTo(176, 298, 222, 296, 254, 304);
    }, 5.5);
    stroke(g, (c) => { c.moveTo(178, 318); c.quadraticCurveTo(200, 324, 222, 318); }, 3.5);
  }
  stroke(g, (c) => { c.moveTo(190, 334); c.quadraticCurveTo(200, 338, 210, 334); }, 3);
  if (p.drool) {
    stroke(g, (c) => { c.moveTo(236, 310); c.bezierCurveTo(240, 336, 232, 352, 238, 376); }, 7, '#c6efae');
    ell(g, 238, 380, 6, 8, '#c6efae', 0);
  }
}

// ---------------------------------------------------------------------------- the family

function adultBody(g, p, o) {
  const bob = p.bob || 0;
  legs(g, o.pants, o.shoe, { hipY: o.hipY, footY: o.footY, lx: 176, rx: 224, w: 44, walk: p.walk, shoeRx: 30, shoeRy: 15, shoeShade: o.shoeShade, sit: p.sit });
  g.translate(0, bob + sitDrop(p, o.hipY, o.footY));
  shape(g, poly([[148, o.waistY], [252, o.waistY], [256, o.hipY + 30], [144, o.hipY + 30]]), o.pants, 6);
  const swing = Math.sin(p.walk || 0) * 10;
  for (const s of [-1, 1]) {
    const x0 = 200 + s * 92, ax = 200 + s * 100 + (s < 0 ? swing : -swing) * 0.4;
    shape(g, poly([[x0 - 10, o.shoulderY + 30], [x0 + 10, o.shoulderY + 30], [ax + 9, o.handY], [ax - 9, o.handY]]), o.armColor ?? o.skin, 5);
    hand(g, ax, o.handY, o.skin, s, 0.92);
  }
  const top = poly([[172, o.shoulderY - 10], [118, o.shoulderY + 6], [o.sleeve ? 90 : 112, o.shoulderY + 40], [o.sleeve ? 104 : 116, o.shoulderY + (o.sleeve ? 92 : 50)], [124, o.shoulderY + 80], [146, o.waistY + 8], [254, o.waistY + 8], [276, o.shoulderY + 80], [o.sleeve ? 296 : 284, o.shoulderY + (o.sleeve ? 92 : 50)], [o.sleeve ? 310 : 288, o.shoulderY + 40], [282, o.shoulderY + 6], [228, o.shoulderY - 10]]);
  shape(g, top, o.shirt, 6);
  shade(g, top, 'rgba(0,0,0,0.12)', 252);
  o.neckline?.(g);
}

function jerry(g, p) {
  begin(g);
  const skin = '#f3cea6';
  adultBody(g, p, { pants: '#c9ad85', shoe: '#5b4330', hipY: 610, footY: 868, waistY: 560, shoulderY: 330, handY: 590, skin, shirt: '#8fbb6a', sleeve: true });
  // polo collar
  for (const s of [-1, 1]) shape(g, poly([[200, 324], [200 + s * 40, 314], [200 + s * 30, 352]]), '#a6cc84', 4);
  stroke(g, (c) => { c.moveTo(200, 330); c.lineTo(200, 390); }, 4);
  shape(g, poly([[184, 290], [216, 290], [218, 326], [182, 326]]), skin, 5);
  ell(g, 114, 196, 13, 21, skin, 5);
  ell(g, 286, 196, 13, 21, skin, 5);
  const head = (c) => {
    c.moveTo(200, 86);
    c.bezierCurveTo(262, 86, 290, 132, 288, 192);
    c.bezierCurveTo(286, 250, 254, 300, 200, 302);
    c.bezierCurveTo(146, 300, 114, 250, 112, 192);
    c.bezierCurveTo(110, 132, 138, 86, 200, 86);
  };
  shape(g, head, skin, 6);
  // hair with a side part
  shape(g, (c) => {
    c.moveTo(110, 186);
    c.bezierCurveTo(100, 110, 140, 70, 200, 70);
    c.bezierCurveTo(262, 70, 302, 110, 290, 186);
    c.bezierCurveTo(284, 150, 270, 132, 246, 126);
    c.bezierCurveTo(214, 122, 176, 132, 158, 112);
    c.bezierCurveTo(140, 130, 122, 150, 110, 186);
    c.closePath();
  }, '#6b4a2e', 6);
  stroke(g, (c) => { c.moveTo(158, 112); c.quadraticCurveTo(164, 92, 186, 80); }, 4);
  // worried brows
  stroke(g, (c) => { c.moveTo(142, 150); c.quadraticCurveTo(160, 138, 184, 148); c.moveTo(216, 148); c.quadraticCurveTo(240, 138, 258, 150); }, 5, '#4d3420');
  eye(g, 166, 184, 26, 28, { pupil: 5.5, closed: p.eyes === 'closed', lid: 0.3, lidColor: skin, lookX: p.lookX, lookY: p.lookY });
  eye(g, 234, 184, 26, 28, { pupil: 5.5, closed: p.eyes === 'closed', lid: 0.3, lidColor: skin, lookX: p.lookX, lookY: p.lookY });
  stroke(g, (c) => { c.moveTo(196, 206); c.bezierCurveTo(186, 230, 196, 240, 210, 234); }, 5);
  if (p.mouth === 'open') mouthShape(g, 200, 262, 50, true);
  else stroke(g, (c) => { c.moveTo(174, 266); c.quadraticCurveTo(200, 256, 226, 266); }, 5);
}

function beth(g, p) {
  begin(g);
  const skin = '#f6d1ab';
  const hairC = '#f1b65a';
  // hair behind the shoulders
  g.save();
  g.translate(0, sitDrop(p, 600, 852));
  shape(g, (c) => {
    c.moveTo(112, 170);
    c.bezierCurveTo(96, 260, 104, 320, 130, 344);
    c.lineTo(270, 344);
    c.bezierCurveTo(296, 320, 304, 260, 288, 170);
    c.closePath();
  }, hairC, 6);
  g.restore();
  adultBody(g, p, { pants: '#f0ece2', shoe: '#b5303a', hipY: 600, footY: 852, waistY: 552, shoulderY: 340, handY: 590, skin, shirt: '#c9323d', sleeve: false, shoeShade: null });
  shape(g, (c) => { c.moveTo(174, 330); c.quadraticCurveTo(200, 360, 226, 330); }, skin, 4);
  shape(g, poly([[186, 296], [214, 296], [216, 334], [184, 334]]), skin, 5);
  const head = (c) => {
    c.moveTo(200, 92);
    c.bezierCurveTo(258, 92, 286, 136, 284, 192);
    c.bezierCurveTo(282, 252, 248, 304, 200, 306);
    c.bezierCurveTo(152, 304, 118, 252, 116, 192);
    c.bezierCurveTo(114, 136, 142, 92, 200, 92);
  };
  shape(g, head, skin, 6);
  // swoopy bangs
  shape(g, (c) => {
    c.moveTo(112, 196);
    c.bezierCurveTo(98, 110, 146, 70, 204, 72);
    c.bezierCurveTo(264, 74, 304, 116, 290, 200);
    c.bezierCurveTo(282, 160, 262, 138, 236, 134);
    c.bezierCurveTo(206, 132, 168, 126, 150, 110);
    c.bezierCurveTo(140, 140, 124, 160, 112, 196);
    c.closePath();
  }, hairC, 6);
  stroke(g, (c) => { c.moveTo(150, 110); c.bezierCurveTo(170, 96, 200, 92, 226, 98); }, 4, '#c98a35');
  eye(g, 166, 190, 27, 31, { pupil: 6, closed: p.eyes === 'closed', lookX: p.lookX, lookY: p.lookY });
  eye(g, 234, 190, 27, 31, { pupil: 6, closed: p.eyes === 'closed', lookX: p.lookX, lookY: p.lookY });
  // lashes
  stroke(g, (c) => {
    for (const [x, s] of [[166, -1], [234, 1]]) {
      c.moveTo(x + s * 22, 174);
      c.lineTo(x + s * 34, 164);
      c.moveTo(x + s * 14, 166);
      c.lineTo(x + s * 20, 152);
    }
  }, 4);
  stroke(g, (c) => { c.moveTo(196, 214); c.bezierCurveTo(188, 234, 198, 240, 210, 236); }, 4.5);
  if (p.mouth === 'open') mouthShape(g, 200, 262, 44, true);
  else shape(g, (c) => c.ellipse(200, 268, 19, 7, 0, 0, Math.PI * 2), '#c7414e', 4);
}

function summer(g, p) {
  begin(g);
  const skin = '#f8d4b0';
  const hairC = '#e87330';
  // ponytail behind
  g.save();
  g.translate(0, sitDrop(p, 588, 832));
  shape(g, (c) => {
    c.moveTo(250, 120);
    c.bezierCurveTo(330, 120, 344, 220, 318, 300);
    c.bezierCurveTo(304, 250, 290, 190, 262, 160);
    c.closePath();
  }, hairC, 6);
  g.restore();
  adultBody(g, p, { pants: '#f2efe8', shoe: '#ffffff', hipY: 588, footY: 832, waistY: 540, shoulderY: 330, handY: 574, skin, shirt: '#f08ab8', sleeve: false, shoeShade: '#c8ccd4' });
  shape(g, (c) => { c.moveTo(176, 322); c.quadraticCurveTo(200, 348, 224, 322); }, skin, 4);
  shape(g, poly([[187, 288], [213, 288], [215, 324], [185, 324]]), skin, 5);
  // phone in her hand
  shape(g, poly([[284, 556], [314, 552], [318, 600], [288, 604]]), '#24262c', 4);
  shape(g, poly([[289, 562], [310, 559], [313, 594], [292, 597]]), '#8fd6ff', 0);
  const head = (c) => {
    c.moveTo(200, 88);
    c.bezierCurveTo(258, 88, 286, 132, 284, 188);
    c.bezierCurveTo(282, 248, 248, 296, 200, 298);
    c.bezierCurveTo(152, 296, 118, 248, 116, 188);
    c.bezierCurveTo(114, 132, 142, 88, 200, 88);
  };
  shape(g, head, skin, 6);
  shape(g, (c) => {
    c.moveTo(112, 190);
    c.bezierCurveTo(100, 108, 146, 66, 202, 68);
    c.bezierCurveTo(262, 70, 302, 110, 288, 192);
    c.bezierCurveTo(278, 150, 256, 132, 226, 128);
    c.bezierCurveTo(196, 126, 166, 120, 152, 104);
    c.bezierCurveTo(140, 134, 124, 154, 112, 190);
    c.closePath();
  }, hairC, 6);
  // hair tie
  ell(g, 262, 120, 9, 9, '#2f2f37', 4);
  const bored = p.expr !== 'happy';
  eye(g, 166, 188, 28, 32, { pupil: 6, closed: p.eyes === 'closed', lid: bored ? 0.34 : 0, lidColor: skin, lookX: p.lookX ?? 0.3, lookY: p.lookY ?? 0.6 });
  eye(g, 234, 188, 28, 32, { pupil: 6, closed: p.eyes === 'closed', lid: bored ? 0.34 : 0, lidColor: skin, lookX: p.lookX ?? 0.3, lookY: p.lookY ?? 0.6 });
  stroke(g, (c) => {
    for (const [x, s] of [[166, -1], [234, 1]]) {
      c.moveTo(x + s * 24, 170);
      c.lineTo(x + s * 36, 160);
      c.moveTo(x + s * 15, 162);
      c.lineTo(x + s * 21, 148);
    }
  }, 4);
  stroke(g, (c) => { c.moveTo(196, 212); c.bezierCurveTo(188, 230, 198, 236, 208, 232); }, 4.5);
  if (p.mouth === 'open') mouthShape(g, 200, 258, 40, true);
  else stroke(g, (c) => { c.moveTo(180, 262); c.quadraticCurveTo(200, 256, 220, 262); }, 5);
}

function poopy(g, p) {
  begin(g);
  const y = '#f3d34a';
  const bob = p.bob || 0;
  legs(g, y, '#3b2a1d', { hipY: 470, footY: 556, lx: 170, rx: 230, w: 16, walk: p.walk, shoeRx: 26, shoeRy: 13 });
  g.translate(0, bob);
  for (const s of [-1, 1]) {
    stroke(g, (c) => { c.moveTo(200 + s * 118, 300); c.quadraticCurveTo(200 + s * 150, 360, 200 + s * 140, 420); }, 13);
    stroke(g, (c) => { c.moveTo(200 + s * 118, 300); c.quadraticCurveTo(200 + s * 150, 360, 200 + s * 140, 420); }, 7, y);
    hand(g, 200 + s * 140, 420, y, s, 0.7);
  }
  const body = (c) => {
    c.moveTo(200, 60);
    c.bezierCurveTo(290, 60, 334, 180, 326, 300);
    c.bezierCurveTo(318, 420, 268, 480, 200, 482);
    c.bezierCurveTo(132, 480, 82, 420, 74, 300);
    c.bezierCurveTo(66, 180, 110, 60, 200, 60);
  };
  shape(g, body, y, 6);
  shade(g, body, 'rgba(200,140,0,0.22)', 280);
  eye(g, 160, 200, 36, 44, { pupil: 8, closed: p.eyes === 'closed', lookX: p.lookX, lookY: p.lookY });
  eye(g, 240, 200, 36, 44, { pupil: 8, closed: p.eyes === 'closed', lookX: p.lookX, lookY: p.lookY });
  if (p.mouth === 'open') mouthShape(g, 200, 300, 60, true);
  else stroke(g, (c) => { c.moveTo(166, 296); c.quadraticCurveTo(200, 324, 234, 296); }, 5);
}

function butter(g, p) {
  begin(g);
  const metal = '#c3ccd3';
  // treads
  for (const s of [-1, 1]) shape(g, poly([[200 + s * 40, 330], [200 + s * 110, 330], [200 + s * 116, 380], [200 + s * 34, 380]]), '#4a535b', 6);
  shape(g, (c) => c.roundRect(110, 180, 180, 160, 30), metal, 6);
  shade(g, (c) => c.roundRect(110, 180, 180, 160, 30), 'rgba(0,0,0,0.12)', 250);
  shape(g, (c) => c.ellipse(200, 140, 82, 66, 0, 0, Math.PI * 2), metal, 6);
  shape(g, (c) => c.roundRect(140, 122, 120, 34, 16), '#2b3036', 5);
  shape(g, (c) => c.roundRect(150, 130, 100, 18, 9), p.sad ? '#ff9a4a' : '#ff5a3a', 0);
  stroke(g, (c) => { c.moveTo(230, 76); c.lineTo(236, 40); }, 5);
  ell(g, 236, 36, 8, 8, '#ff5a3a', 4);
  for (const s of [-1, 1]) {
    stroke(g, (c) => { c.moveTo(200 + s * 90, 230); c.lineTo(200 + s * 130, 290); }, 10);
    stroke(g, (c) => { c.moveTo(200 + s * 90, 230); c.lineTo(200 + s * 130, 290); }, 4, '#6b747c');
    shape(g, poly([[200 + s * 120, 290], [200 + s * 146, 286], [200 + s * 140, 310], [200 + s * 126, 304]]), metal, 4);
  }
}

// ---------------------------------------------------------------------------- back views

function backHead(g, cx, cy, rx, ry, color, lw = 6) {
  ell(g, cx, cy, rx, ry, color, lw);
}

function mortyBack(g, p) {
  begin(g);
  const skin = '#f9d3ae';
  legs(g, '#3c62ad', '#ffffff', { hipY: 520, footY: 668, lx: 172, rx: 228, w: 50, walk: p.walk, shoeRx: 32, shoeRy: 16, shoeShade: '#c8ccd4' });
  g.translate(0, p.bob || 0);
  shape(g, poly([[138, 462], [262, 462], [266, 528], [134, 528]]), '#3c62ad', 6);
  for (const s of [-1, 1]) {
    shape(g, poly([[200 + s * 104 - 11, 392], [200 + s * 104 + 11, 392], [200 + s * 112 + 10, 506], [200 + s * 112 - 10, 506]]), skin, 5);
    hand(g, 200 + s * 112, 506, skin, s, 0.95);
  }
  shape(g, poly([[165, 300], [112, 318], [74, 350], [90, 404], [118, 396], [122, 476], [278, 476], [282, 396], [310, 404], [326, 350], [288, 318], [235, 300]]), '#e8d23f', 6);
  ell(g, 54, 186, 18, 25, skin, 5);
  ell(g, 346, 186, 18, 25, skin, 5);
  shape(g, (c) => {
    c.moveTo(200, 24);
    c.bezierCurveTo(296, 22, 352, 92, 350, 178);
    c.bezierCurveTo(350, 252, 292, 300, 200, 300);
    c.bezierCurveTo(108, 300, 50, 252, 50, 178);
    c.bezierCurveTo(48, 92, 104, 22, 200, 24);
  }, '#6e4527', 6);
  shape(g, (c) => { c.moveTo(130, 270); c.quadraticCurveTo(200, 312, 270, 270); c.lineTo(250, 300); c.quadraticCurveTo(200, 320, 150, 300); c.closePath(); }, skin, 0);
  stroke(g, (c) => { c.moveTo(150, 120); c.quadraticCurveTo(200, 100, 250, 120); c.moveTo(130, 200); c.quadraticCurveTo(200, 180, 270, 200); }, 4, '#4f301a');
}

function rickBack(g, p) {
  begin(g);
  const skin = '#e0dbcb';
  legs(g, '#8b6844', '#5a3a22', { hipY: 700, footY: 958, lx: 172, rx: 228, w: 46, walk: p.walk, shoeRx: 34, shoeRy: 16 });
  g.translate(0, p.bob || 0);
  const coatBack = poly([[176, 350], [108, 380], [92, 460], [84, 776], [316, 776], [308, 460], [292, 380], [224, 350]]);
  shape(g, coatBack, '#f4f8f8', 6);
  shade(g, coatBack, 'rgba(160,190,205,0.3)', 250);
  stroke(g, (c) => { c.moveTo(200, 560); c.lineTo(200, 776); }, 4);
  for (const s of [-1, 1]) {
    const sx = 200 + s * 112, hx = 200 + s * 122;
    shape(g, poly([[sx - 6 * s, 380], [sx + 30 * s, 400], [hx + 24 * s, 630], [hx - 20 * s, 636], [sx - 10 * s, 440]]), '#f4f8f8', 6);
    hand(g, hx + 2 * s, 650, skin, s, 1.05);
  }
  shape(g, poly([[180, 318], [220, 318], [222, 362], [178, 362]]), skin, 5);
  ell(g, 101, 214, 14, 23, skin, 5);
  ell(g, 299, 214, 14, 23, skin, 5);
  rickHair(g, 200, 196, '#a9d4e4', '#7fb1c6');
  shape(g, (c) => {
    c.moveTo(200, 92);
    c.bezierCurveTo(272, 92, 302, 150, 298, 220);
    c.bezierCurveTo(294, 280, 260, 330, 200, 334);
    c.bezierCurveTo(140, 330, 106, 280, 102, 220);
    c.bezierCurveTo(98, 150, 128, 92, 200, 92);
  }, '#a9d4e4', 6);
  stroke(g, (c) => { c.moveTo(150, 150); c.lineTo(170, 260); c.moveTo(200, 120); c.lineTo(200, 280); c.moveTo(250, 150); c.lineTo(230, 260); }, 3, '#7fb1c6');
}

/** Morty asleep in bed, seen from above: head on the pillow, blanket up to the chin */
export function mortyAsleep(g, p = {}) {
  begin(g);
  const skin = '#f9d3ae';
  shape(g, (c) => c.roundRect(40, 30, 320, 150, 40), '#f6f6f0', 6);
  // head (slightly turned)
  ell(g, 206, 120, 104, 92, skin, 6);
  shape(g, (c) => {
    c.moveTo(104, 120);
    c.bezierCurveTo(96, 50, 150, 22, 206, 24);
    c.bezierCurveTo(264, 24, 316, 52, 308, 124);
    c.bezierCurveTo(290, 92, 256, 78, 206, 80);
    c.bezierCurveTo(156, 80, 120, 94, 104, 120);
    c.closePath();
  }, '#6e4527', 6);
  // closed eyes, open snoring mouth
  stroke(g, (c) => {
    c.moveTo(150, 122);
    c.quadraticCurveTo(172, 136, 194, 122);
    c.moveTo(218, 122);
    c.quadraticCurveTo(240, 136, 262, 122);
  }, 6);
  if (p.awake) {
    ell(g, 172, 124, 24, 26, '#fff', 5);
    ell(g, 240, 124, 24, 26, '#fff', 5);
    ell(g, 172, 126, 4, 4, INK, 0);
    ell(g, 240, 126, 4, 4, INK, 0);
  }
  shape(g, (c) => c.ellipse(206, 176, 16, p.snore ? 12 : 7, 0, 0, Math.PI * 2), '#4a1d22', 5);
  // blanket
  shape(g, (c) => {
    c.moveTo(20, 196);
    c.quadraticCurveTo(206, 168, 380, 196);
    c.lineTo(392, 600);
    c.lineTo(8, 600);
    c.closePath();
  }, '#5a8fd0', 6);
  stroke(g, (c) => { c.moveTo(60, 260); c.quadraticCurveTo(200, 240, 340, 268); c.moveTo(80, 380); c.quadraticCurveTo(210, 360, 330, 390); }, 4, '#3f6fae');
}

export const TOONS = {
  morty: { h: 700, height: 1.5, front: morty, back: mortyBack },
  rick: { h: 990, height: 1.98, front: rick, back: rickBack },
  jerry: { h: 890, height: 1.8, front: jerry, back: null },
  beth: { h: 870, height: 1.72, front: beth, back: null },
  summer: { h: 850, height: 1.66, front: summer, back: null },
  poopy: { h: 580, height: 1.05, front: poopy, back: null },
  butter: { h: 400, height: 0.42, front: butter, back: null },
};

/** paint a character into a canvas (scale = pixels per drawing unit) */
export function paintToon(kind, pose = {}, scale = 0.64, view = 'front') {
  const T = TOONS[kind];
  const c = document.createElement('canvas');
  c.width = Math.ceil(400 * scale);
  c.height = Math.ceil(T.h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  const fn = view === 'back' && T.back ? T.back : T.front;
  fn(g, pose);
  return c;
}
