// 3D channel letters from the vendored web fonts — no typeface JSON needed.
//
// Text is rasterised into an offscreen canvas with the real font, the glyph coverage is traced
// with marching squares (sub-pixel interpolated, so outlines are smooth), simplified with
// Douglas–Peucker, sorted into outlines + holes by containment, and handed to THREE.Shape →
// ExtrudeGeometry. Result: real extruded sign letters (RENO, ELDORADO…) in any font we ship.
//
//   await fontsReady(['700 100px "Playfair Display"'])
//   const shapes = textShapes('RENO', { font: '"Bebas Neue"', weight: 400, height: 3 })
//   const geo = textGeometry('RENO', { font, height: 3, depth: 0.4, bevel: 0.04, align: 'center' })
//   const { face, side } = textGeometryParts(...)   // front faces vs. returns (two materials)
//   arcText(...)  → per-letter placement along an arc (for the arch banner)
//
// Coordinates: x right, y up, letters in the XY plane, extruded toward +Z; baseline at y = 0.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const shapeCache = new Map();

/** Wait for the listed CSS font specs (e.g. '400 64px "Bebas Neue"') to be usable by canvas. */
export async function fontsReady(specs) {
  if (!document.fonts?.load) return;
  try {
    await Promise.all(specs.map((s) => document.fonts.load(s)));
  } catch {
    // A missing font falls back to the next family in the stack; geometry still builds.
  }
}

/**
 * Trace text into THREE.Shapes.
 * @param {string} text
 * @param {object} o font (CSS family string), weight, style, height (cap height in metres),
 *   px (raster cap height in pixels, quality), tracking (extra letter spacing in em),
 *   tolerance (simplification in px), align 'left'|'center'|'right'
 * @returns {{shapes: THREE.Shape[], width: number, height: number}}
 */
export function textShapes(text, o = {}) {
  const font = o.font || '"Bebas Neue", sans-serif';
  const weight = o.weight ?? 400;
  const style = o.style || 'normal';
  const px = o.px ?? 140;
  const tracking = o.tracking ?? 0;
  const tol = o.tolerance ?? 0.35;
  const key = `${text}|${font}|${weight}|${style}|${px}|${tracking}|${tol}`;
  let traced = shapeCache.get(key);
  if (!traced) {
    traced = traceText(text, { font, weight, style, px, tracking, tol });
    shapeCache.set(key, traced);
  }
  // Scale: px raster cap height → requested metres.
  const s = (o.height ?? 1) / traced.capPx;
  const ax = o.align === 'center' ? -traced.width / 2 : o.align === 'right' ? -traced.width : 0;
  const shapes = traced.loops.map(({ outer, holes }) => {
    const sh = new THREE.Shape(outer.map(([x, y]) => new THREE.Vector2((x + ax) * s, y * s)));
    for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2((x + ax) * s, y * s))));
    return sh;
  });
  return { shapes, width: traced.width * s, height: traced.capPx * s, glyphs: traced.glyphs.map((g) => ({ ...g, x0: (g.x0 + ax) * s, x1: (g.x1 + ax) * s })) };
}

/** Extruded text geometry (one geometry; groups: 0 = faces, 1 = sides). */
export function textGeometry(text, o = {}) {
  const { shapes, width, height } = textShapes(text, o);
  const depth = o.depth ?? 0.2;
  const bevel = o.bevel ?? 0;
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.8,
    bevelSegments: bevel > 0 ? 2 : 0,
    curveSegments: 1,
    steps: 1,
  });
  geo.userData = { width, height };
  return geo;
}

/** Split an extruded text geometry into front/back faces and returns (side walls). */
export function textGeometryParts(text, o = {}) {
  const geo = textGeometry(text, o);
  const parts = splitGroups(geo);
  return { face: parts[0], side: parts[1], width: geo.userData.width, height: geo.userData.height };
}

// ExtrudeGeometry stores caps in group 0 and walls in group 1 — split into separate geometries.
export function splitGroups(geo) {
  const ni = geo.index ? geo.index : null;
  const out = [];
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (const g of geo.groups) {
    const p = [];
    const n = [];
    const u = [];
    for (let k = g.start; k < g.start + g.count; k++) {
      const i = ni ? ni.getX(k) : k;
      p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      u.push(uv.getX(i), uv.getY(i));
    }
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    b.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    b.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    out[g.materialIndex] = out[g.materialIndex] ? mergeGeometries([out[g.materialIndex], b]) : b;
  }
  return out;
}

/**
 * Lay letters along a circular arc (for curved banners). Returns per-letter
 * { char, geo (centred at its own baseline middle), x, y, rot } in the arc's plane.
 * @param {string} text
 * @param {object} o  radius (m, to the baseline), center [cx, cy], height (cap, m), font..., depth,
 *                    spacing (extra em), upright: letters face outward (top away from centre)
 */
export function arcText(text, o) {
  const { shapes: _s, width, glyphs } = textShapes(text, { ...o, align: 'center' });
  void _s;
  const R = o.radius;
  const [cx, cy] = o.center || [0, 0];
  const items = [];
  for (const g of glyphs) {
    if (g.char === ' ') continue;
    const mid = (g.x0 + g.x1) / 2;
    const ang = -mid / R; // positive x → clockwise from the top
    const geo = textGeometry(g.char, { ...o, align: 'center' });
    items.push({
      char: g.char,
      geo,
      x: cx + Math.sin(-ang) * R,
      y: cy + Math.cos(ang) * R,
      rot: ang,
    });
  }
  return { items, width };
}

// ---- Tracing --------------------------------------------------------------------------------

function traceText(text, { font, weight, style, px, tracking, tol }) {
  const fontSpec = `${style} ${weight} ${px}px ${font}`;
  const m = document.createElement('canvas').getContext('2d');
  m.font = fontSpec;
  const metrics = m.measureText('H');
  const capPx = metrics.actualBoundingBoxAscent || px * 0.7;
  // Per-glyph advance so arcs can place letters; tracking adds em-relative spacing.
  const glyphs = [];
  let x = 0;
  for (const ch of text) {
    const w = m.measureText(ch).width;
    glyphs.push({ char: ch, x0: x, x1: x + w });
    x += w + tracking * px;
  }
  const width = Math.max(1, x - tracking * px);
  const pad = Math.ceil(px * 0.3);
  const W = Math.ceil(width + pad * 2);
  const descent = Math.ceil(px * 0.35);
  const H = Math.ceil(capPx + descent + pad * 2);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  g.font = fontSpec;
  g.textBaseline = 'alphabetic';
  const baseY = pad + capPx;
  for (const gl of glyphs) g.fillText(gl.char, pad + gl.x0, baseY);
  const img = g.getImageData(0, 0, W, H).data;
  const field = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) field[i] = img[i * 4] / 255;
  const loops = marchingSquares(field, W, H, 0.5).map((l) => simplify(l, tol)).filter((l) => l.length >= 3);
  // To text space: origin at (pad, baseY), y up.
  const toText = (l) => l.map(([px2, py]) => [px2 - pad, baseY - py]);
  const polys = loops.map(toText).map((pts) => ({ pts, area: signedArea(pts) }));
  // Outlines vs holes: a loop contained in an odd number of other loops is a hole.
  for (const p of polys) {
    const probe = p.pts[0];
    p.depth = polys.reduce((d, q) => (q !== p && Math.abs(q.area) > Math.abs(p.area) && pointInPoly(probe, q.pts) ? d + 1 : d), 0);
  }
  const outers = polys.filter((p) => p.depth % 2 === 0);
  const result = outers.map((o2) => ({ outer: ensureWinding(o2.pts, true), holes: [] }));
  for (const h of polys.filter((p) => p.depth % 2 === 1)) {
    // Assign to the smallest outer that contains it.
    let best = null;
    for (let k = 0; k < outers.length; k++) {
      if (pointInPoly(h.pts[0], outers[k].pts) && (!best || Math.abs(outers[k].area) < Math.abs(outers[best.k].area))) best = { k };
    }
    if (best) result[best.k].holes.push(ensureWinding(h.pts, false));
  }
  return { loops: result, width, capPx, glyphs };
}

// Marching squares over a scalar field → closed polylines (pixel coordinates, y down).
function marchingSquares(f, W, H, iso) {
  const segs = new Map(); // key of start point → list of segments
  const edgePt = (x0, y0, x1, y1) => {
    const a = f[y0 * W + x0];
    const b = f[y1 * W + x1];
    const t = (iso - a) / (b - a || 1e-6);
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  };
  const key = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  const segments = [];
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = f[y * W + x] > iso ? 1 : 0;
      const tr = f[y * W + x + 1] > iso ? 1 : 0;
      const br = f[(y + 1) * W + x + 1] > iso ? 1 : 0;
      const bl = f[(y + 1) * W + x] > iso ? 1 : 0;
      const idx = tl * 8 + tr * 4 + br * 2 + bl;
      if (idx === 0 || idx === 15) continue;
      const T = () => edgePt(x, y, x + 1, y);
      const R = () => edgePt(x + 1, y, x + 1, y + 1);
      const B = () => edgePt(x, y + 1, x + 1, y + 1);
      const L = () => edgePt(x, y, x, y + 1);
      // Segments oriented so the inside (value > iso) is always on the same side.
      switch (idx) {
        case 1: segments.push([L(), B()]); break;
        case 2: segments.push([B(), R()]); break;
        case 3: segments.push([L(), R()]); break;
        case 4: segments.push([R(), T()]); break;
        case 5: segments.push([L(), T()], [R(), B()]); break;
        case 6: segments.push([B(), T()]); break;
        case 7: segments.push([L(), T()]); break;
        case 8: segments.push([T(), L()]); break;
        case 9: segments.push([T(), B()]); break;
        case 10: segments.push([T(), R()], [B(), L()]); break;
        case 11: segments.push([T(), R()]); break;
        case 12: segments.push([R(), L()]); break;
        case 13: segments.push([R(), B()]); break;
        case 14: segments.push([B(), L()]); break;
        default: break;
      }
    }
  }
  for (const s of segments) {
    const k = key(s[0]);
    if (!segs.has(k)) segs.set(k, []);
    segs.get(k).push(s);
  }
  const used = new Set();
  const loops = [];
  for (const s of segments) {
    if (used.has(s)) continue;
    const loop = [s[0]];
    let cur = s;
    used.add(cur);
    for (let guard = 0; guard < 200000; guard++) {
      loop.push(cur[1]);
      const nextList = segs.get(key(cur[1]));
      const nxt = nextList?.find((q) => !used.has(q));
      if (!nxt) break;
      used.add(nxt);
      cur = nxt;
    }
    if (loop.length > 3) {
      loop.pop(); // closing point duplicates the start
      loops.push(loop);
    }
  }
  return loops;
}

// Douglas–Peucker on a closed loop (split at the farthest pair so both halves simplify well).
function simplify(pts, tol) {
  if (pts.length < 8) return pts;
  let far = 0;
  let best = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const a = dp(pts.slice(0, far + 1), tol);
  const b = dp(pts.slice(far).concat([pts[0]]), tol);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1e-9;
  let maxD = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  const l = dp(pts.slice(0, idx + 1), tol);
  const r = dp(pts.slice(idx), tol);
  return l.slice(0, -1).concat(r);
}

function signedArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return a / 2;
}

function pointInPoly([x, y], p) {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const xi = p[i][0];
    const yi = p[i][1];
    const xj = p[j][0];
    const yj = p[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// THREE.ShapeUtils treats counter-clockwise as outer; holes clockwise.
function ensureWinding(pts, ccw) {
  const isCCW = signedArea(pts) < 0; // with the (xj - xi)(yj + yi) formula, CCW → negative
  return isCCW === ccw ? pts : pts.slice().reverse();
}
