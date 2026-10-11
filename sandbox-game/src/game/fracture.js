// Splits a convex shape into convex chunks with per-material break patterns.
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import { worldUV } from '../gfx/geom.js';

const EPS = 1e-6;
const rnd = (a, b) => a + Math.random() * (b - a);

// Clip a convex point set by plane (n·p = d). Returns [front, back] point sets.
function split(points, n, d) {
  const front = [], back = [], side = points.map((p) => n.dot(p) - d);
  for (let i = 0; i < points.length; i++) (side[i] >= 0 ? front : back).push(points[i]);
  if (!front.length || !back.length) return null;
  // Intersections of every front/back pair lie inside the cut face, so the hull of
  // (kept points + intersections) is exactly the clipped convex polytope.
  for (let i = 0; i < points.length; i++) {
    if (side[i] < 0) continue;
    for (let j = 0; j < points.length; j++) {
      if (side[j] >= 0) continue;
      const t = side[i] / (side[i] - side[j]);
      const p = points[i].clone().lerp(points[j], t);
      front.push(p);
      back.push(p.clone());
    }
  }
  return [dedupe(front), dedupe(back)];
}

function dedupe(pts) {
  const out = [];
  const seen = new Set();
  for (const p of pts) {
    const k = `${Math.round(p.x * 2000)},${Math.round(p.y * 2000)},${Math.round(p.z * 2000)}`;
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  // keep hulls cheap: thin out near-duplicate clusters
  return out.length > 64 ? out.filter((_, i) => i % Math.ceil(out.length / 64) === 0) : out;
}

function bboxOf(points) { return new THREE.Box3().setFromPoints(points); }
function sizeOf(points) { return bboxOf(points).getSize(new THREE.Vector3()); }
function volEst(points) { const s = sizeOf(points); return s.x * s.y * s.z; }

function axes(size) {
  const a = [['x', size.x], ['y', size.y], ['z', size.z]].sort((p, q) => q[1] - p[1]);
  const v = (k) => new THREE.Vector3(k === 'x' ? 1 : 0, k === 'y' ? 1 : 0, k === 'z' ? 1 : 0);
  return { long: v(a[0][0]), mid: v(a[1][0]), thin: v(a[2][0]), dims: [a[0][1], a[1][1], a[2][1]] };
}

function randomUnit() {
  const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(t), u, s * Math.sin(t));
}

// Repeatedly cut the biggest piece until we have `count` pieces.
function cutUntil(pieces, count, planeFor, minVol) {
  let guard = 0;
  while (pieces.length < count && guard++ < count * 6) {
    let bi = 0, bv = -1;
    for (let i = 0; i < pieces.length; i++) { const v = volEst(pieces[i]); if (v > bv) { bv = v; bi = i; } }
    if (bv < minVol) break;
    const piece = pieces[bi];
    const { n, p } = planeFor(piece);
    const r = split(piece, n.normalize(), n.dot(p));
    if (!r || r[0].length < 4 || r[1].length < 4) continue;
    pieces.splice(bi, 1, r[0], r[1]);
  }
  return pieces;
}

function centroid(points) {
  const c = new THREE.Vector3();
  for (const p of points) c.add(p);
  return c.divideScalar(points.length);
}

// points: convex hull points of the part (local space). hit: local hit point. energy ~ 0..3.
export function fracturePoints(points, style, hit, energy = 1) {
  const size = sizeOf(points);
  const ax = axes(size);
  const vol = size.x * size.y * size.z;
  const h = hit ? hit.clone() : centroid(points);
  let pieces = [points.map((p) => p.clone())];
  const E = THREE.MathUtils.clamp(energy, 0.3, 3);

  switch (style) {
    case 'splinter': {
      // Wood: break across near the hit with an angled, jagged cut, then split lengthwise along the grain.
      const cross = ax.long.clone().add(ax.mid.clone().multiplyScalar(rnd(-0.7, 0.7))).add(ax.thin.clone().multiplyScalar(rnd(-0.5, 0.5)));
      const r = split(pieces[0], cross.normalize(), cross.dot(h));
      if (r) pieces = r;
      const count = Math.round(4 + E * 2.5);
      cutUntil(pieces, count, (pc) => {
        const c = centroid(pc);
        const n = ax.mid.clone().multiplyScalar(rnd(0.6, 1)).add(ax.thin.clone().multiplyScalar(rnd(-1, 1))).add(ax.long.clone().multiplyScalar(rnd(-0.08, 0.08)));
        return { n, p: c.add(randomUnit().multiplyScalar(sizeOf(pc).length() * 0.08)) };
      }, vol * 0.004);
      break;
    }
    case 'layers': {
      // Plywood: veneer layers peel apart, then each tears across.
      for (const t of [-0.17, 0.17]) {
        const next = [];
        for (const pc of pieces) {
          const n = ax.thin.clone();
          const r = split(pc, n, n.dot(centroid(points)) + t * ax.dims[2]);
          next.push(...(r || [pc]));
        }
        pieces = next;
      }
      cutUntil(pieces, Math.round(5 + E * 2), (pc) => ({ n: ax.long.clone().add(ax.mid.clone().multiplyScalar(rnd(-1, 1))), p: centroid(pc).lerp(h, 0.4) }), vol * 0.01);
      break;
    }
    case 'shards': {
      // Glass: radial cracks from the impact point, then concentric breaks -> long sharp shards.
      const nRadial = Math.round(5 + E * 2);
      const base = Math.random() * Math.PI;
      for (let i = 0; i < nRadial; i++) {
        const a = base + (i / nRadial) * Math.PI + rnd(-0.2, 0.2);
        const n = ax.long.clone().multiplyScalar(Math.cos(a)).add(ax.mid.clone().multiplyScalar(Math.sin(a)));
        const next = [];
        for (const pc of pieces) { const r = split(pc, n, n.dot(h)); next.push(...(r || [pc])); }
        pieces = next;
      }
      cutUntil(pieces, Math.min(28, pieces.length + Math.round(4 + E * 4)), (pc) => {
        const c = centroid(pc);
        const radial = c.clone().sub(h); radial.addScaledVector(ax.thin, -radial.dot(ax.thin));
        const n = radial.lengthSq() > EPS ? radial.normalize() : ax.long.clone();
        n.add(ax.long.clone().multiplyScalar(rnd(-0.3, 0.3))).add(ax.mid.clone().multiplyScalar(rnd(-0.3, 0.3)));
        n.addScaledVector(ax.thin, -n.dot(ax.thin));
        return { n, p: c };
      }, vol * 0.002);
      break;
    }
    case 'cubes': {
      // Tempered glass: the whole pane crumbles into small cubes at once.
      const cell = Math.max(ax.dims[0] / 7, 0.1);
      const nl = Math.min(8, Math.ceil(ax.dims[0] / cell)), nm = Math.min(7, Math.ceil(ax.dims[1] / cell));
      const bb = bboxOf(points);
      const lo = bb.min.dot(ax.long), mlo = bb.min.dot(ax.mid);
      for (let i = 1; i < nl; i++) {
        const next = [];
        for (const pc of pieces) { const r = split(pc, ax.long, lo + (i * ax.dims[0]) / nl + rnd(-0.01, 0.01)); next.push(...(r || [pc])); }
        pieces = next;
      }
      for (let i = 1; i < nm; i++) {
        const next = [];
        for (const pc of pieces) { const r = split(pc, ax.mid, mlo + (i * ax.dims[1]) / nm + rnd(-0.01, 0.01)); next.push(...(r || [pc])); }
        pieces = next;
      }
      break;
    }
    case 'ice': {
      const radial = Math.round(3 + E);
      for (let i = 0; i < radial; i++) {
        const n = randomUnit();
        const next = [];
        for (const pc of pieces) { const r = pc.length > 3 && volEst(pc) > vol * 0.05 ? split(pc, n, n.dot(h)) : null; next.push(...(r || [pc])); }
        pieces = next;
      }
      cutUntil(pieces, Math.round(7 + E * 3), (pc) => ({ n: randomUnit(), p: centroid(pc) }), vol * 0.006);
      break;
    }
    case 'tear': {
      cutUntil(pieces, 2 + Math.round(Math.random() * 2), (pc) => ({ n: randomUnit(), p: centroid(pc).lerp(h, 0.5) }), vol * 0.05);
      break;
    }
    case 'chunks':
    default: {
      // Concrete / plastic / cardboard: chunky irregular pieces, smaller near the impact.
      const count = Math.round(5 + E * 3);
      cutUntil(pieces, count, (pc) => {
        const c = centroid(pc).lerp(h, 0.35).add(randomUnit().multiplyScalar(sizeOf(pc).length() * 0.12));
        return { n: randomUnit(), p: c };
      }, vol * 0.003);
      break;
    }
  }
  return pieces.filter((pc) => pc.length >= 4 && volEst(pc) > vol * 0.0003);
}

// Build render geometry for a chunk. Faces on the original surface keep the outer material (group 0);
// faces created by the break get the raw "inside" material (group 1).
export function chunkGeometry(points, originalPoints) {
  const hull = new ConvexHull().setFromPoints(originalPoints);
  const planes = hull.faces.map((f) => ({ n: f.normal.clone(), d: f.normal.dot(f.midpoint) }));
  let geo = new ConvexGeometry(points);
  geo = worldUV(geo);
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const triCount = pos.count / 3;
  const outer = [], inner = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, t * 3); b.fromBufferAttribute(pos, t * 3 + 1); c.fromBufferAttribute(pos, t * 3 + 2);
    m.copy(a).add(b).add(c).divideScalar(3);
    const onSurface = planes.some((p) => Math.abs(p.n.dot(m) - p.d) < 0.002);
    (onSurface ? outer : inner).push(t);
  }
  const order = [...outer, ...inner];
  const P = new Float32Array(pos.count * 3), N = new Float32Array(pos.count * 3), U = new Float32Array(pos.count * 2);
  order.forEach((t, i) => {
    for (let k = 0; k < 3; k++) {
      const src = t * 3 + k, dst = i * 3 + k;
      P[dst * 3] = pos.getX(src); P[dst * 3 + 1] = pos.getY(src); P[dst * 3 + 2] = pos.getZ(src);
      N[dst * 3] = nor.getX(src); N[dst * 3 + 1] = nor.getY(src); N[dst * 3 + 2] = nor.getZ(src);
      U[dst * 2] = uv.getX(src); U[dst * 2 + 1] = uv.getY(src);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.addGroup(0, outer.length * 3, 0);
  out.addGroup(outer.length * 3, inner.length * 3, 1);
  return out;
}

export { centroid, sizeOf };
