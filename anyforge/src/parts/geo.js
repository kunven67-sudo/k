// Shapes for parts. Every shape gets texture coordinates in real meters, so a 3 m beam shows 3 m of steel,
// not one photo stretched out.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const cache = new Map();
function cached(key, make) {
  let g = cache.get(key);
  if (!g) { g = make(); g.userData.shared = true; cache.set(key, g); }
  return g;
}
const r3 = (v) => Math.round(v * 1000) / 1000;

// each face takes the two axes it spans as its texture directions
export function boxUV(g, tile = 1) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i) * Math.sign(n.getX(i) || 1); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i) * -Math.sign(n.getY(i) || 1); }
    else { u = p.getX(i) * -Math.sign(n.getZ(i) || 1); v = p.getY(i); }
    uv[i * 2] = u / tile + 0.5; uv[i * 2 + 1] = v / tile + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function box(sx, sy, sz, bevel = 0.02) {
  return cached(`box${r3(sx)},${r3(sy)},${r3(sz)},${bevel}`, () => {
    const b = Math.min(bevel, Math.min(sx, sy, sz) * 0.25);
    const g = b > 0.003 ? new RoundedBoxGeometry(sx, sy, sz, 2, b) : new THREE.BoxGeometry(sx, sy, sz);
    return boxUV(g);
  });
}

// ramp: full bottom, full back face (-Z), slope goes from the front bottom edge up to the back top edge
export function wedgePoints(sx, sy, sz) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  return [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [-x, y, -z], [x, y, -z]];
}
export function wedge(sx, sy, sz) {
  return cached(`wedge${r3(sx)},${r3(sy)},${r3(sz)}`, () => {
    const P = wedgePoints(sx, sy, sz).map((a) => new THREE.Vector3(...a));
    const tris = [[0, 2, 1], [0, 3, 2], [0, 1, 5], [0, 5, 4], [3, 4, 5], [3, 5, 2], [0, 4, 3], [1, 2, 5]];
    return faceted(P, tris);
  });
}
// corner piece: a pyramid quarter (three square faces + a slope)
export function cornerPoints(sx, sy, sz) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  return [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [-x, y, -z]];
}
export function corner(sx, sy, sz) {
  return cached(`corner${r3(sx)},${r3(sy)},${r3(sz)}`, () => {
    const P = cornerPoints(sx, sy, sz).map((a) => new THREE.Vector3(...a));
    const tris = [[0, 2, 1], [0, 3, 2], [0, 1, 4], [0, 4, 3], [1, 2, 4], [3, 4, 2]];
    return faceted(P, tris);
  });
}
function faceted(P, tris) {
  const pos = [];
  const c = new THREE.Vector3();
  P.forEach((p) => c.add(p)); c.divideScalar(P.length);
  for (const t of tris) {
    let [a, b, d] = t.map((i) => P[i]);
    // make every triangle face outward no matter how it was listed
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
    const mid = new THREE.Vector3().add(a).add(b).add(d).divideScalar(3);
    if (n.dot(mid.sub(c)) < 0) [b, d] = [d, b];
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return boxUV(g);
}

export function cyl(r, h, seg = 28, r2 = r) {
  return cached(`cyl${r3(r)},${r3(h)},${seg},${r3(r2)}`, () => {
    const g = new THREE.CylinderGeometry(r2, r, h, seg, 1);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i) + 0.5, p.getZ(i) + 0.5);
      else uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(r, r2), p.getY(i) + 0.5);
    }
    return g;
  });
}
export function ball(r, seg = 28) {
  return cached(`ball${r3(r)},${seg}`, () => {
    const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.66));
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * Math.PI * r);
    return g;
  });
}
export function cone(r, h, seg = 28) { return cyl(r, h, seg, 0.0001); }

// lathe: spin a side profile ([radius, height] points) around Y, used for nozzles, tires, dishes
export function lathe(key, pts, seg = 32) {
  return cached('lathe' + key, () => {
    const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
    const uv = g.attributes.uv;
    const maxR = Math.max(...pts.map((p) => p[0]));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * maxR, uv.getY(i) * 1.2);
    return g;
  });
}
export function torus(R, r, seg = 32, arc = Math.PI * 2) {
  return cached(`torus${r3(R)},${r3(r)},${seg},${r3(arc)}`, () => new THREE.TorusGeometry(R, r, 12, seg, arc));
}
export function tube(key, curve, segs, r) {
  return cached('tube' + key, () => new THREE.TubeGeometry(curve, segs, r, 8, false));
}

export { mergeVertices };
