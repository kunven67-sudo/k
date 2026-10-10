// Chunky display letters G A M B L E drawn as THREE.Shapes (cap height 2, centered on 0,0),
// for extruded gold type. Hand-designed geometric slab forms — no font files needed.

import * as THREE from 'three';

const D = Math.PI / 180;

function poly(points, holes = []) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}

function G() {
  const ring = new THREE.Shape();
  const ro = 1;
  const ri = 0.56;
  const a0 = 38 * D;
  const a1 = 352 * D;
  ring.moveTo(Math.cos(a0) * ro, Math.sin(a0) * ro);
  ring.absarc(0, 0, ro, a0, a1, false);
  ring.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri);
  ring.absarc(0, 0, ri, a1, a0, true);
  ring.closePath();
  const bar = poly([[0.08, -0.16], [0.98, -0.16], [0.98, 0.16], [0.08, 0.16]]);
  const spur = poly([[0.62, -0.9], [0.98, -0.9], [0.98, 0.0], [0.62, 0.0]]);
  return [ring, bar, spur];
}

function A() {
  return [poly(
    [[-1, -1], [-0.55, -1], [-0.38, -0.5], [0.38, -0.5], [0.55, -1], [1, -1], [0.27, 1], [-0.27, 1]],
    [[[-0.24, -0.12], [0.24, -0.12], [0, 0.56]]],
  )];
}

function M() {
  return [poly([[-1, -1], [-0.58, -1], [-0.58, 0.28], [-0.12, -0.5], [0.12, -0.5], [0.58, 0.28], [0.58, -1], [1, -1], [1, 1], [0.56, 1], [0, 0.12], [-0.56, 1], [-1, 1]])];
}

function B() {
  const s = new THREE.Shape();
  s.moveTo(-0.85, -1);
  s.lineTo(0.28, -1);
  s.absarc(0.28, -0.5, 0.5, -90 * D, 90 * D, false);
  s.lineTo(0.22, 0);
  s.absarc(0.22, 0.5, 0.5, -90 * D, 90 * D, false);
  s.lineTo(-0.85, 1);
  s.closePath();
  const lo = new THREE.Path();
  lo.moveTo(-0.4, -0.64);
  lo.lineTo(0.26, -0.64);
  lo.absarc(0.26, -0.45, 0.19, -90 * D, 90 * D, false);
  lo.lineTo(-0.4, -0.26);
  lo.closePath();
  const hi = new THREE.Path();
  hi.moveTo(-0.4, 0.26);
  hi.lineTo(0.2, 0.26);
  hi.absarc(0.2, 0.45, 0.19, -90 * D, 90 * D, false);
  hi.lineTo(-0.4, 0.64);
  hi.closePath();
  s.holes.push(lo, hi);
  return [s];
}

const L = () => [poly([[-0.8, -1], [0.85, -1], [0.85, -0.58], [-0.35, -0.58], [-0.35, 1], [-0.8, 1]])];
const E = () => [poly([[-0.8, -1], [0.85, -1], [0.85, -0.6], [-0.35, -0.6], [-0.35, -0.2], [0.6, -0.2], [0.6, 0.2], [-0.35, 0.2], [-0.35, 0.6], [0.85, 0.6], [0.85, 1], [-0.8, 1]])];

export const LETTER_SHAPES = { G, A, M, B, L, E };
// Half-widths (for spacing and physics boxes).
export const LETTER_HALF_WIDTH = { G: 1, A: 1, M: 1, B: 0.8, L: 0.85, E: 0.85 };

/** Extruded, bevelled letter geometry centered in x/y/z. */
export function letterGeometry(ch, { depth = 0.5, bevel = 0.07, curveSegments = 18 } = {}) {
  const geo = new THREE.ExtrudeGeometry(LETTER_SHAPES[ch](), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  geo.computeBoundingBox();
  const c = new THREE.Vector3();
  geo.boundingBox.getCenter(c);
  geo.translate(0, 0, -c.z); // center depth; keep the designed x/y origin (cap-height centered)
  return geo;
}
