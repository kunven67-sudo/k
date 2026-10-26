/* HANDS OFF: every icon in the game, drawn by hand in code (no emoji anywhere). */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;

  function poly(c, x, y, r, n, rot) {
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = rot + (i / n) * TAU;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath();
  }
  function ring(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }

  // 24 money icons, one per money name (HO.MONEY order)
  const MONEY_DRAW = [
    /* FLUX: liquid drop */ (c, s) => { c.beginPath(); c.moveTo(0, -s); c.bezierCurveTo(s * 0.75, -s * 0.15, s * 0.75, s * 0.85, 0, s * 0.85); c.bezierCurveTo(-s * 0.75, s * 0.85, -s * 0.75, -s * 0.15, 0, -s); c.stroke(); ring(c, -s * 0.18, s * 0.25, s * 0.18); c.stroke(); },
    /* VOID: tiny black hole */ (c, s) => { ring(c, 0, 0, s * 0.45); c.fill(); c.save(); c.scale(1, 0.32); ring(c, 0, 0, s * 0.95); c.stroke(); c.restore(); ring(c, 0, 0, s * 0.55); c.stroke(); },
    /* STATIC: tv square */ (c, s) => { c.strokeRect(-s * 0.8, -s * 0.65, s * 1.6, s * 1.3); for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-s * 0.6, i * s * 0.22); c.lineTo(s * (i % 2 ? 0.2 : 0.6), i * s * 0.22); c.stroke(); } },
    /* PRISM */ (c, s) => { poly(c, 0, s * 0.1, s * 0.95, 3, -Math.PI / 2); c.stroke(); c.beginPath(); c.moveTo(-s, s * 0.05); c.lineTo(0, s * 0.05); c.lineTo(s * 0.9, -s * 0.35); c.moveTo(0, s * 0.05); c.lineTo(s * 0.9, s * 0.45); c.stroke(); },
    /* SHARDS */ (c, s) => { c.beginPath(); c.moveTo(-s * 0.9, s * 0.6); c.lineTo(-s * 0.2, -s * 0.9); c.lineTo(0, s * 0.3); c.closePath(); c.moveTo(s * 0.1, -s * 0.5); c.lineTo(s * 0.9, -s * 0.1); c.lineTo(s * 0.3, s * 0.9); c.closePath(); c.stroke(); },
    /* ECHO */ (c, s) => { for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(-s * 0.6, 0, s * 0.42 * i, -0.8, 0.8); c.stroke(); } ring(c, -s * 0.6, 0, s * 0.12); c.fill(); },
    /* NULL */ (c, s) => { ring(c, 0, 0, s * 0.75); c.stroke(); c.beginPath(); c.moveTo(-s * 0.9, s * 0.9); c.lineTo(s * 0.9, -s * 0.9); c.stroke(); },
    /* HALO */ (c, s) => { c.save(); c.scale(1, 0.4); ring(c, 0, -s * 1.6, s * 0.85); c.stroke(); c.restore(); ring(c, 0, s * 0.25, s * 0.5); c.stroke(); },
    /* DRIFT */ (c, s) => { for (let k = -1; k <= 1; k++) { c.beginPath(); for (let i = 0; i <= 20; i++) { const x = -s + (i / 20) * 2 * s; const y = k * s * 0.5 + Math.sin(i / 20 * TAU) * s * 0.18; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); } },
    /* APEX */ (c, s) => { c.beginPath(); c.moveTo(-s, s * 0.5); c.lineTo(0, -s * 0.7); c.lineTo(s, s * 0.5); c.moveTo(-s * 0.55, s * 0.9); c.lineTo(0, s * 0.1); c.lineTo(s * 0.55, s * 0.9); c.stroke(); },
    /* PULSE */ (c, s) => { c.beginPath(); c.moveTo(-s, 0); c.lineTo(-s * 0.4, 0); c.lineTo(-s * 0.2, -s * 0.8); c.lineTo(s * 0.1, s * 0.8); c.lineTo(s * 0.3, 0); c.lineTo(s, 0); c.stroke(); },
    /* RIFT */ (c, s) => { c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.25, -s * 0.4); c.lineTo(-s * 0.15, 0); c.lineTo(s * 0.2, s * 0.45); c.lineTo(0, s); c.lineTo(-s * 0.35, s * 0.4); c.lineTo(0, 0); c.lineTo(-s * 0.3, -s * 0.45); c.closePath(); c.stroke(); },
    /* CORE */ (c, s) => { ring(c, 0, 0, s * 0.9); c.stroke(); ring(c, 0, 0, s * 0.55); c.stroke(); ring(c, 0, 0, s * 0.2); c.fill(); },
    /* GHOST */ (c, s) => { c.beginPath(); c.moveTo(-s * 0.7, s * 0.9); c.lineTo(-s * 0.7, -s * 0.1); c.arc(0, -s * 0.1, s * 0.7, Math.PI, 0); c.lineTo(s * 0.7, s * 0.9); for (let i = 0; i < 4; i++) c.lineTo(s * 0.7 - (i + 0.5) * s * 0.35, s * (i % 2 ? 0.9 : 0.6)); c.closePath(); c.stroke(); },
    /* QUANTA */ (c, s) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { ring(c, i * s * 0.6, j * s * 0.6, (i + j) % 2 ? s * 0.12 : s * 0.2); c.fill(); } },
    /* AETHER */ (c, s) => { c.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU * 2.2, r = s * (0.08 + 0.9 * i / 60); const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.stroke(); },
    /* NOVA */ (c, s) => { c.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? s * 0.35 : s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.stroke(); },
    /* ENTROPY */ (c, s) => { const pts = [[-0.7, -0.6, 0.3], [0.2, -0.75, 0.22], [0.6, -0.1, 0.32], [-0.35, 0.15, 0.25], [0.15, 0.55, 0.2], [-0.75, 0.7, 0.15]]; for (const [x, y, r] of pts) { c.save(); c.translate(x * s, y * s); c.rotate(x * 3 + y); c.strokeRect(-r * s, -r * s, r * s * 2, r * s * 2); c.restore(); } },
    /* ZERO */ (c, s) => { c.save(); c.scale(0.7, 1); ring(c, 0, 0, s * 0.9); c.restore(); c.stroke(); c.beginPath(); c.moveTo(-s * 0.45, s * 0.7); c.lineTo(s * 0.45, -s * 0.7); c.stroke(); },
    /* OMEN: an eye */ (c, s) => { c.beginPath(); c.moveTo(-s, 0); c.quadraticCurveTo(0, -s * 0.95, s, 0); c.quadraticCurveTo(0, s * 0.95, -s, 0); c.stroke(); ring(c, 0, 0, s * 0.3); c.fill(); },
    /* SIGNAL */ (c, s) => { for (let i = 0; i < 4; i++) c.fillRect(-s * 0.85 + i * s * 0.47, s * 0.8 - (i + 1) * s * 0.4, s * 0.3, (i + 1) * s * 0.4); },
    /* MASS */ (c, s) => { ring(c, 0, 0, s * 0.55); c.fill(); c.save(); c.rotate(-0.35); c.scale(1, 0.3); ring(c, 0, 0, s * 1.0); c.restore(); c.stroke(); },
    /* EVENT */ (c, s) => { c.beginPath(); c.moveTo(-s, 0); c.lineTo(s, 0); c.stroke(); c.beginPath(); c.arc(0, 0, s * 0.6, Math.PI, 0); c.stroke(); ring(c, 0, -s * 0.15, s * 0.14); c.fill(); },
    /* SILENCE */ (c, s) => { c.beginPath(); c.moveTo(-s, 0); c.lineTo(s, 0); c.stroke(); c.beginPath(); c.moveTo(-s * 0.4, -s * 0.5); c.lineTo(s * 0.4, -s * 0.5); c.moveTo(-s * 0.4, s * 0.5); c.lineTo(s * 0.4, s * 0.5); c.stroke(); },
  ];

  function money(c, idx, x, y, size, color, t) {
    c.save();
    c.translate(x, y);
    if (t !== undefined) c.rotate(Math.sin(t * 0.8) * 0.12);
    c.strokeStyle = color; c.fillStyle = color;
    c.lineWidth = Math.max(1.2, size * 0.11); c.lineJoin = 'round'; c.lineCap = 'round';
    MONEY_DRAW[((idx % MONEY_DRAW.length) + MONEY_DRAW.length) % MONEY_DRAW.length](c, size);
    c.restore();
  }

  // procedural sigils for upgrades: every one is different, built from its seed
  function sigil(c, seed, x, y, size, color, kind) {
    let s = seed >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    c.save();
    c.translate(x, y);
    c.strokeStyle = color; c.fillStyle = color;
    c.lineWidth = Math.max(1, size * 0.09); c.lineJoin = 'round'; c.lineCap = 'round';
    const n = 3 + Math.floor(rnd() * 6);
    const rot = rnd() * TAU;
    if (kind === 'tempo') { poly(c, 0, 0, size, n, rot); c.stroke(); c.beginPath(); c.moveTo(-size * 0.5, -size * 0.35); c.lineTo(size * 0.45, 0); c.lineTo(-size * 0.5, size * 0.35); c.stroke(); }
    else if (kind === 'resonance') { for (let i = 1; i <= 3; i++) { ring(c, 0, 0, size * i / 3); c.stroke(); } poly(c, 0, 0, size * 0.33, n, rot); c.fill(); }
    else {
      poly(c, 0, 0, size, n, rot); c.stroke();
      const inner = Math.floor(rnd() * 4);
      if (inner === 0) { ring(c, 0, 0, size * 0.35); c.fill(); }
      else if (inner === 1) { poly(c, 0, 0, size * 0.55, n, rot + Math.PI / n); c.stroke(); }
      else if (inner === 2) { c.beginPath(); for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; c.moveTo(0, 0); c.lineTo(Math.cos(a) * size, Math.sin(a) * size); } c.stroke(); }
      else { for (let i = 0; i < n; i++) { const a = rot + (i + 0.5) / n * TAU; ring(c, Math.cos(a) * size * 0.55, Math.sin(a) * size * 0.55, size * 0.1); c.fill(); } }
    }
    c.restore();
  }

  // trophies: one shape per group, tinted by whether you have it
  function trophy(c, group, id, x, y, size, color) {
    c.save();
    c.translate(x, y);
    c.strokeStyle = color; c.fillStyle = color;
    c.lineWidth = Math.max(1.4, size * 0.09); c.lineJoin = 'round'; c.lineCap = 'round';
    const k = id.length * 7 + id.charCodeAt(id.length - 1);
    if (group === 'time') { // hourglass
      c.beginPath(); c.moveTo(-size * 0.6, -size * 0.85); c.lineTo(size * 0.6, -size * 0.85); c.lineTo(-size * 0.6, size * 0.85); c.lineTo(size * 0.6, size * 0.85); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-size * 0.25, size * 0.6); c.lineTo(size * 0.25, size * 0.6); c.lineTo(0, size * 0.25); c.closePath(); c.fill();
    } else if (group === 'roast') { // a cracked open hand outline: palm + 4 fingers + a crack
      c.beginPath(); c.moveTo(-size * 0.5, size * 0.9); c.lineTo(-size * 0.55, -size * 0.1);
      for (let i = 0; i < 4; i++) { const fx = -size * 0.5 + i * size * 0.32; c.lineTo(fx, -size * (0.75 - Math.abs(i - 1.5) * 0.12)); c.lineTo(fx + size * 0.2, -size * (0.75 - Math.abs(i - 1.5) * 0.12)); c.lineTo(fx + size * 0.22, -size * 0.15); }
      c.lineTo(size * 0.55, size * 0.9); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-size * 0.1, -size * 0.1); c.lineTo(size * 0.12, size * 0.25); c.lineTo(-size * 0.05, size * 0.5); c.lineTo(size * 0.1, size * 0.85); c.stroke();
    } else if (group === 'number') { // rising bars
      for (let i = 0; i < 4; i++) c.fillRect(-size * 0.85 + i * size * 0.45, size * 0.85 - (i + 1) * size * 0.42, size * 0.3, (i + 1) * size * 0.42);
      c.beginPath(); c.moveTo(-size * 0.9, -size * 0.2); c.lineTo(size * 0.9, -size * 0.95); c.stroke();
    } else { // worlds: rings around a planet
      ring(c, 0, 0, size * 0.45); c.stroke();
      c.save(); c.rotate(-0.4 + (k % 5) * 0.2); c.scale(1, 0.35); ring(c, 0, 0, size); c.restore(); c.stroke();
    }
    c.restore();
  }

  // the mouse cursor (yours, and the fake one that moves by itself)
  function cursor(c, x, y, size, fill, edge) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(0, size); c.lineTo(size * 0.28, size * 0.76); c.lineTo(size * 0.48, size * 1.15);
    c.lineTo(size * 0.62, size * 1.08); c.lineTo(size * 0.42, size * 0.7); c.lineTo(size * 0.78, size * 0.7); c.closePath();
    c.fillStyle = fill; c.fill();
    c.lineWidth = Math.max(1, size * 0.07); c.strokeStyle = edge; c.stroke();
    c.restore();
  }

  root.HOGLYPH = { money, sigil, trophy, cursor, count: MONEY_DRAW.length };
})(typeof window !== 'undefined' ? window : globalThis);
