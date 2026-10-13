// Body-part geometry for bugs and spiders: jointed leg segments, shaped bodies, and real hairs.
//
// Real arthropods are covered in hairs (setae): fine ones lying flat and combed back on the body,
// rows of bristles angled toward the tip of each leg, and stiff spines sticking out (orb weavers and
// cellar spiders have lots). Up close those hairs are what make a spider look like a spider and not
// a plastic toy. Each hair here is a tiny tapered spike that takes the color of the skin it grows
// from (it gets that spot's texture coordinates), tinted by a hair color.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hash3 } from '../core/util.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _n = new THREE.Vector3();
const _d = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();

// A segment along +Y from 0 to len, round, with radius profile r(t) (t 0..1).
export function latheSeg(len, r, { radial = 10, segs = 16, flatX = 1, flatZ = 1 } = {}) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector2(Math.max(1e-7, r(t)), t * len));
  }
  // Close the ends.
  pts.unshift(new THREE.Vector2(1e-7, 0));
  pts.push(new THREE.Vector2(1e-7, len));
  const g = new THREE.LatheGeometry(pts, radial);
  if (flatX !== 1 || flatZ !== 1) g.scale(flatX, 1, flatZ);
  g.computeVertexNormals();
  return g;
}

// Leg segment shapes (radius r at their thickest), real spider leg anatomy squeezed into the three
// pieces the leg's motion uses: femur | patella + tibia + metatarsus | tarsus (with claws).
export function legPiece(kind, len, r) {
  if (kind === 'femur') {
    // Narrow at the hip (coxa/trochanter), thickest past the middle.
    return latheSeg(len, (t) => r * (0.72 + 0.3 * Math.sin(Math.PI * Math.min(1, t * 0.95 + 0.05) ** 0.8) + (t > 0.94 ? -0.12 * (t - 0.94) / 0.06 : 0)), { flatX: 0.9 });
  }
  if (kind === 'shank') {
    // Patella knob, tibia, a joint, then the long thin metatarsus.
    return latheSeg(len, (t) => {
      if (t < 0.12) return r * (0.8 + 0.25 * Math.sin((t / 0.12) * Math.PI));
      if (t < 0.52) return r * (0.86 - 0.12 * ((t - 0.12) / 0.4));
      if (t < 0.58) return r * (0.62 + 0.1 * Math.abs(t - 0.55) / 0.03);
      return r * (0.6 - 0.12 * ((t - 0.58) / 0.42));
    }, { segs: 24 });
  }
  // Tarsus: thin, tapering, with the two curved claws at the tip.
  const g = latheSeg(len, (t) => r * (0.48 - 0.16 * t), { segs: 8, radial: 8 });
  const parts = [g];
  for (const s of [-1, 1]) {
    const cl = new THREE.ConeGeometry(r * 0.12, r * 0.9, 5);
    cl.translate(0, r * 0.45, 0);
    cl.rotateZ(s * 0.5);
    cl.rotateX(0.6);
    cl.translate(s * r * 0.08, len, 0);
    parts.push(cl);
  }
  return mergeGeometries(parts.map(prep), false);
}

function prep(g) {
  g = g.index ? g.toNonIndexed() : g;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Add hairs to a geometry. Hairs grow from random-looking (but fixed) spots, spread evenly by area.
//  count: how many; len: [min, max] length; th: thickness at the root; tint: hair color multiplier;
//  comb(pos, normal, out): the direction hairs lean toward (along the surface); lean: 0 = straight
//  out, 1 = lying flat along comb; seed: different pattern per part.
export function withHairs(geo, { count, len, th, tint = [1, 1, 1], comb, lean = 0.6, seed = 1, spines = null }) {
  const base = prep(geo.clone());
  const pos = base.attributes.position, nrm = base.attributes.normal, uv = base.attributes.uv;
  const triN = pos.count / 3;
  // Area table for even spreading.
  const cum = new Float32Array(triN);
  let total = 0;
  for (let i = 0; i < triN; i++) {
    _a.fromBufferAttribute(pos, i * 3);
    _b.fromBufferAttribute(pos, i * 3 + 1);
    _c.fromBufferAttribute(pos, i * 3 + 2);
    total += _t1.subVectors(_b, _a).cross(_t2.subVectors(_c, _a)).length() * 0.5;
    cum[i] = total;
  }
  const P = [], N = [], U = [], C = [];
  const pushHair = (root, n, dir, L, T, uu, vv, col) => {
    // A three-sided spike: a small triangle at the root, a point at the tip.
    const side = _t1.crossVectors(dir, n).normalize();
    if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
    const up2 = _t2.crossVectors(side, dir).normalize();
    const tip = _d.copy(root).addScaledVector(dir, L);
    const corners = [0, 1, 2].map((k) => {
      const a = (k / 3) * Math.PI * 2;
      return root.clone().addScaledVector(side, Math.cos(a) * T).addScaledVector(up2, Math.sin(a) * T);
    });
    for (let k = 0; k < 3; k++) {
      const p0 = corners[k], p1 = corners[(k + 1) % 3];
      const fn = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(tip, p0)).normalize();
      for (const p of [p0, p1, tip]) {
        P.push(p.x, p.y, p.z);
        N.push(fn.x, fn.y, fn.z);
        U.push(uu, vv);
        C.push(col[0], col[1], col[2]);
      }
    }
  };
  const grow = (n, L, T, leanK, col, sd) => {
    for (let h = 0; h < n; h++) {
      const pick = hash3(h, sd, 1, 4401) * total;
      let lo = 0, hi = triN - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < pick) lo = mid + 1;
        else hi = mid;
      }
      let u = hash3(h, sd, 2, 4402), v = hash3(h, sd, 3, 4403);
      if (u + v > 1) {
        u = 1 - u;
        v = 1 - v;
      }
      const i0 = lo * 3;
      _a.fromBufferAttribute(pos, i0);
      _b.fromBufferAttribute(pos, i0 + 1);
      _c.fromBufferAttribute(pos, i0 + 2);
      const root = new THREE.Vector3().copy(_a).addScaledVector(_t1.subVectors(_b, _a), u).addScaledVector(_t2.subVectors(_c, _a), v);
      _n.fromBufferAttribute(nrm, i0).add(_t1.fromBufferAttribute(nrm, i0 + 1)).add(_t2.fromBufferAttribute(nrm, i0 + 2)).normalize();
      const n0 = _n.clone();
      const along = comb(root, n0, new THREE.Vector3());
      along.addScaledVector(n0, -along.dot(n0));
      if (along.lengthSq() < 1e-12) along.set(0, 1, 0).addScaledVector(n0, -n0.y);
      along.normalize();
      // Lean: mostly along the comb direction, a little out from the skin; each hair a bit different.
      const k = leanK * (0.85 + 0.3 * hash3(h, sd, 4, 4404));
      const dir = new THREE.Vector3().copy(n0).multiplyScalar(1 - k).addScaledVector(along, k).normalize();
      const Lh = L[0] + (L[1] - L[0]) * hash3(h, sd, 5, 4405);
      const uu = uv.getX(i0) * (1 - u - v) + uv.getX(i0 + 1) * u + uv.getX(i0 + 2) * v;
      const vv = uv.getY(i0) * (1 - u - v) + uv.getY(i0 + 1) * u + uv.getY(i0 + 2) * v;
      const vb = 0.8 + 0.4 * hash3(h, sd, 6, 4406); // each hair a little lighter or darker
      pushHair(root.addScaledVector(n0, -T * 0.5), n0, dir, Lh, T, uu, vv, [col[0] * vb, col[1] * vb, col[2] * vb]);
    }
  };
  grow(count, len, th, lean, tint, seed);
  if (spines) grow(spines.count, spines.len, spines.th, spines.lean ?? 0.35, spines.tint ?? tint, seed + 77);
  const hair = new THREE.BufferGeometry();
  hair.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  hair.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  hair.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  hair.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  base.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3).fill(1), 3));
  for (const k of Object.keys(base.attributes)) if (!hair.attributes[k]) base.deleteAttribute(k);
  // Two groups: skin (material 0) and hairs (material 1, their own color and shine).
  return mergeGeometries([base, hair], true);
}

// Plain version of a geometry with a white color attribute (so it can share a vertex-colored material).
export function plain(geo) {
  const g = prep(geo.clone());
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  return g;
}

// Hairs along a leg piece lean toward the tip (+Y).
export const combDistal = (p, n, out) => out.set(0, 1, 0);
// Body hairs lie combed back (+Z) and down the sides.
export const combBack = (p, n, out) => out.set(0, -0.25, 1);
