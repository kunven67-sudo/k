// Turns an item's list of parts into BOTH the 3D model and the physics shapes.
// Same numbers -> same shape, so collisions match what you see.
//
// part: { s: 'box'|'cyl'|'cone'|'sphere'|'capsule'|'hull',
//         size: [w,h,d] (box), r, h, r2 (cone top radius), round (box edge radius),
//         p: [x,y,z], rot: [x,y,z] degrees, mat: 'wood:oak', body: 'main',
//         grain: 'x'|'y'|'z' (wood direction), col: false (no collision), vis: false (no mesh),
//         pts: [[x,y,z]...] (hull), lathe: [[r,y]...] (revolved profile), seg: radial segments, light: {...},
//         uv: 'meter' (default: textures keep real size) | 'atlas' (box: each face gets its own cell of a
//             3x2 label sheet: +x -x +y / -y +z -z) | 'wrap' (cyl/cone/lathe: label wraps around once,
//             bottom->top; caps sample the texture's bottom-left corner) | 'fit' (0..1 on every face),
//         s: 'curve' -> pts: [[x,y,z]...] centerline, r (radius) or rs: [r per point], rounded ends }

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { material, physicalOf } from './materials.js';

const DEG = Math.PI / 180;
const geoCache = new Map();

function partGeometry(pt, tile) {
  const key = JSON.stringify([pt.s, pt.size, pt.r, pt.h, pt.r2, pt.round, pt.seg, pt.grain, tile, pt.pts || 0, pt.lathe || 0, pt.rs || 0, pt.uv || 0, pt.uvRot]);
  if (geoCache.has(key) && !pt.pts) return geoCache.get(key);
  let g;
  switch (pt.s) {
    case 'box': {
      const [w, h, d] = pt.size;
      const r = Math.min(pt.round ?? 0.004, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
      if (pt.uv === 'atlas') { g = new THREE.BoxGeometry(w, h, d); atlasUVBox(g); break; }
      g = r > 0.0015 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
      if (pt.uv === 'fit') break;
      meterUVBox(g, pt.grain || longest(pt.size), tile);
      break;
    }
    case 'cyl': g = new THREE.CylinderGeometry(pt.r, pt.r, pt.h, pt.seg || 20); if (pt.uv === 'wrap') wrapUV(g); else if (pt.uv !== 'fit') meterUVCyl(g, pt.r, pt.h, tile); break;
    case 'cone': g = new THREE.CylinderGeometry(pt.r2, pt.r, pt.h, pt.seg || 20); if (pt.uv === 'wrap') wrapUV(g); else if (pt.uv !== 'fit') meterUVCyl(g, Math.max(pt.r, pt.r2), pt.h, tile); break;
    case 'curve': g = curveGeometry(pt); break;
    case 'sphere': g = new THREE.SphereGeometry(pt.r, pt.seg || 20, Math.max(8, (pt.seg || 20) >> 1)); break;
    case 'capsule': g = new THREE.CapsuleGeometry(pt.r, pt.h, 6, pt.seg || 14); meterUVCyl(g, pt.r, pt.h + pt.r * 2, tile); break;
    case 'hull': {
      // lathe-like: pts are [radius, y] pairs for a revolved profile, or raw [x,y,z] points
      if (pt.lathe) {
        g = new THREE.LatheGeometry(pt.lathe.map(([r, y]) => new THREE.Vector2(r, y)), pt.seg || 28);
        if (pt.uv === 'wrap') wrapUV(g);
      } else {
        g = new THREE.BufferGeometry().setFromPoints(pt.pts.map((p) => new THREE.Vector3(...p)));
      }
      break;
    }
    default: g = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  }
  if (!pt.pts) geoCache.set(key, g);
  return g;
}

function longest([w, h, d]) { return w >= h && w >= d ? 'x' : h >= d ? 'y' : 'z'; }

// UVs in meters so textures keep their real size; U follows the wood grain.
function meterUVBox(g, grain, tile) {
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i)), az = Math.abs(nrm.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = grain === 'y' ? y : z; v = grain === 'y' ? z : y; }      // side faces (x)
    else if (ay >= az) { u = grain === 'z' ? z : x; v = grain === 'z' ? x : z; }              // top/bottom
    else { u = grain === 'y' ? y : x; v = grain === 'y' ? x : y; }                            // front/back (z)
    uv.setXY(i, u / tile + 0.37, v / tile + 0.11);
  }
  uv.needsUpdate = true;
}

// label sheet: 3 columns x 2 rows -> +x -x +y (top row) / -y +z -z (bottom row)
function atlasUVBox(g) {
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const cu = (f % 3) / 3, cv = f < 3 ? 0.5 : 0;
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, cu + uv.getX(i) / 3, cv + uv.getY(i) / 2); }
  }
  uv.needsUpdate = true;
}

// u = once around with the seam at the back: u 0.5 (the middle of the label) faces the front (+z);
// v = bottom->top of the part; cylinder caps -> the texture's bottom-left corner
function wrapUV(g) {
  g.rotateY(Math.PI);
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nrm.getY(i)) > 0.97 && g.type === 'CylinderGeometry') { uv.setXY(i, 0.01, 0.01); continue; }
    uv.setXY(i, uv.getX(i), (pos.getY(i) - y0) / Math.max(1e-6, y1 - y0));
  }
  uv.needsUpdate = true;
}

// a bent tube along a centerline with rounded ends (bananas, carrots, hot dogs, cables)
function curveGeometry(pt) {
  const pts = pt.pts.map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts);
  const n = Math.max(12, pts.length * 8), radial = pt.seg || 14;
  const rAt = (t) => {
    if (!pt.rs) return pt.r;
    const f = t * (pt.rs.length - 1), i = Math.min(pt.rs.length - 2, Math.floor(f));
    return pt.rs[i] + (pt.rs[i + 1] - pt.rs[i]) * (f - i);
  };
  const frames = curve.computeFrenetFrames(n, false);
  const verts = [], norms = [], uvs = [], idx = [];
  // ring of vertices at each step; the first/last rings pinch to a point for rounded tips
  const cap = 4;
  const rings = [];
  for (let k = 0; k <= cap; k++) rings.push({ t: 0, s: Math.sin((k / cap) * Math.PI / 2), back: (1 - Math.cos((k / cap) * Math.PI / 2)) });
  for (let i = 1; i < n; i++) rings.push({ t: i / n, s: 1, back: 1 });
  for (let k = cap; k >= 0; k--) rings.push({ t: 1, s: Math.sin((k / cap) * Math.PI / 2), back: (1 - Math.cos((k / cap) * Math.PI / 2)), end: true });
  rings.forEach((ring, ri) => {
    const fi = Math.round(ring.t * n);
    const P = curve.getPointAt(ring.t), T = curve.getTangentAt(ring.t), N = frames.normals[fi], B = frames.binormals[fi];
    const r = rAt(ring.t);
    const off = (1 - ring.back) * r * (ring.end ? 1 : -1);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dir = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
      const v = P.clone().addScaledVector(T, off).addScaledVector(dir, r * ring.s);
      verts.push(v.x, v.y, v.z);
      const nn = dir.clone().multiplyScalar(ring.s).addScaledVector(T, (ring.end ? 1 : -1) * Math.sqrt(Math.max(0, 1 - ring.s * ring.s)));
      norms.push(nn.x, nn.y, nn.z);
      uvs.push(j / radial, ri / (rings.length - 1));
    }
  });
  const row = radial + 1;
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * row + j, b = a + row;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function meterUVCyl(g, r, h, tile) {
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    uv.setXY(i, pos.getY(i) / tile, (a * r) / tile);
  }
  uv.needsUpdate = true;
}

export function partQuat(pt) {
  const q = new THREE.Quaternion();
  if (pt.rot) q.setFromEuler(new THREE.Euler(pt.rot[0] * DEG, pt.rot[1] * DEG, pt.rot[2] * DEG));
  return q;
}

// Build the visual: one THREE.Group per body, meshes positioned in item space.
export function buildVisual(spec) {
  const groups = {};
  for (const name of Object.keys(spec.bodies || { main: {} })) groups[name] = new THREE.Group();
  if (!groups.main) groups.main = new THREE.Group();
  const lights = [];
  for (const pt of spec.parts) {
    if (pt.vis === false) continue;
    const mat = material(pt.mat || 'wood:oak');
    const geo = partGeometry(pt, (mat.userData.tile || 1) * (pt.uvScale || 1));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...(pt.p || [0, 0, 0]));
    mesh.quaternion.copy(partQuat(pt));
    if (pt.scale) mesh.scale.set(...pt.scale);
    if (pt.levelScale != null) {
      // a drink going down: squash it toward its own bottom
      if (!geo.boundingBox) geo.computeBoundingBox();
      mesh.scale.y *= pt.levelScale;
      mesh.position.y += geo.boundingBox.min.y * (pt.scale ? pt.scale[1] : 1) * (1 - pt.levelScale);
    }
    mesh.castShadow = !mat.userData.glass;
    mesh.receiveShadow = true;
    mesh.userData.part = pt;
    (groups[pt.body || 'main'] || groups.main).add(mesh);
    if (pt.light) lights.push({ ...pt.light, body: pt.body || 'main', mesh });
  }
  return { groups, lights };
}

function partVolume(pt) {
  switch (pt.s) {
    case 'box': return pt.size[0] * pt.size[1] * pt.size[2] * (pt.hollow ?? 1);
    case 'cyl': return Math.PI * pt.r * pt.r * pt.h * (pt.hollow ?? 1);
    case 'cone': return (Math.PI * pt.h / 3) * (pt.r * pt.r + pt.r * pt.r2 + pt.r2 * pt.r2) * (pt.hollow ?? 1);
    case 'sphere': return (4 / 3) * Math.PI * pt.r ** 3 * (pt.hollow ?? 1);
    case 'capsule': return (Math.PI * pt.r * pt.r * pt.h + (4 / 3) * Math.PI * pt.r ** 3) * (pt.hollow ?? 1);
    case 'hull': return (pt.volume ?? latheVolume(pt) ?? 0.001);
    case 'curve': { let v = 0; for (let i = 1; i < pt.pts.length; i++) { const r = pt.rs ? (pt.rs[i] + pt.rs[i - 1]) / 2 : pt.r; v += Math.PI * r * r * Math.hypot(...pt.pts[i].map((c, k) => c - pt.pts[i - 1][k])); } return v * (pt.hollow ?? 1); }
    default: return 0.001;
  }
}

function latheVolume(pt) {
  if (!pt.lathe) return null;
  let v = 0;
  for (let i = 1; i < pt.lathe.length; i++) { const [r0, y0] = pt.lathe[i - 1], [r1, y1] = pt.lathe[i]; v += (Math.PI * Math.abs(y1 - y0) / 3) * (r0 * r0 + r0 * r1 + r1 * r1); }
  return v * (pt.hollow ?? 1) * (pt.scale ? pt.scale[0] * pt.scale[1] * pt.scale[2] : 1);
}

// Collider descriptions per body. Densities are scaled so the whole item weighs spec.mass (kg).
export function buildColliders(R, spec) {
  const out = {};
  let raw = 0;
  const parts = spec.parts.filter((p) => p.col !== false);
  for (const pt of parts) raw += partVolume(pt) * physicalOf(pt.mat || 'wood').density;
  const scale = spec.mass && raw > 0 ? spec.mass / raw : 1;
  for (const pt of parts) {
    const phys = physicalOf(pt.mat || 'wood');
    let desc = null;
    let densityFix = 1;
    if (pt.s === 'box') {
      const [w, h, d] = pt.size;
      const r = Math.min(pt.round ?? 0.004, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
      desc = r > 0.0015 ? R.ColliderDesc.roundCuboid(w / 2 - r, h / 2 - r, d / 2 - r, r) : R.ColliderDesc.cuboid(w / 2, h / 2, d / 2);
      // the physics engine weighs a rounded box by its inner core only, so make the core denser
      if (r > 0.0015) densityFix = (w * h * d) / Math.max(1e-6, (w - 2 * r) * (h - 2 * r) * (d - 2 * r));
    } else if (pt.s === 'cyl') desc = R.ColliderDesc.cylinder(pt.h / 2, pt.r);
    else if (pt.s === 'sphere') desc = R.ColliderDesc.ball(pt.r);
    else if (pt.s === 'capsule') desc = R.ColliderDesc.capsule(pt.h / 2, pt.r);
    else if (pt.s === 'curve') {
      // a chain of capsules along the centerline (each weighs its share)
      const segs = [];
      for (let i = 1; i < pt.pts.length; i++) {
        const a = new THREE.Vector3(...pt.pts[i - 1]), b = new THREE.Vector3(...pt.pts[i]);
        const r = pt.rs ? Math.min(pt.rs[i], pt.rs[i - 1]) : pt.r;
        segs.push({ a, b, r });
      }
      const q0 = partQuat(pt), p0 = new THREE.Vector3(...(pt.p || [0, 0, 0]));
      for (const { a, b, r } of segs) {
        const len = a.distanceTo(b);
        const mid = a.clone().add(b).multiplyScalar(0.5).applyQuaternion(q0).add(p0);
        const dir = b.clone().sub(a).normalize().applyQuaternion(q0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const d = R.ColliderDesc.capsule(Math.max(0.0005, len / 2 - r * 0.5), r).setTranslation(mid.x, mid.y, mid.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setDensity(phys.density * scale * (pt.hollow ?? 1)).setFriction(pt.friction ?? phys.friction).setRestitution(0.05);
        (out[pt.body || 'main'] ||= []).push({ desc: d, part: pt, phys });
      }
      continue;
    }
    else if (pt.s === 'cone' || pt.s === 'hull') {
      const geo = partGeometry(pt, 1);
      const arr = new Float32Array(geo.attributes.position.array);
      if (pt.scale) for (let i = 0; i < arr.length; i += 3) { arr[i] *= pt.scale[0]; arr[i + 1] *= pt.scale[1]; arr[i + 2] *= pt.scale[2]; }
      desc = R.ColliderDesc.convexHull(arr);
    }
    if (!desc) continue;
    const q = partQuat(pt);
    desc.setTranslation(...(pt.p || [0, 0, 0])).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setDensity(phys.density * scale * (pt.hollow ?? 1) * densityFix).setFriction(pt.friction ?? phys.friction).setRestitution(0.05);
    const body = pt.body || 'main';
    (out[body] ||= []).push({ desc, part: pt, phys });
  }
  return out;
}

// Axis-aligned size of the item (for placing it on the ground and the ghost preview).
export function specBounds(spec) {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const pt of spec.parts) {
    if (pt.vis === false && pt.col === false) continue;
    let lo, hi;
    const sym = (x, y, z) => { lo = new THREE.Vector3(-x, -y, -z); hi = new THREE.Vector3(x, y, z); };
    if (pt.s === 'box') sym(pt.size[0] / 2, pt.size[1] / 2, pt.size[2] / 2);
    else if (pt.s === 'sphere') sym(pt.r, pt.r, pt.r);
    else if (pt.s === 'capsule') sym(pt.r, pt.h / 2 + pt.r, pt.r);
    else if (pt.s === 'cyl' || pt.s === 'cone') { const r = Math.max(pt.r, pt.r2 || 0); sym(r, pt.h / 2, r); }
    else {
      // lathes + curves aren't centered on their origin: use their real extents
      const g = partGeometry(pt, 1); g.computeBoundingBox();
      lo = g.boundingBox.min.clone(); hi = g.boundingBox.max.clone();
      if (pt.scale) { lo.multiply(new THREE.Vector3(...pt.scale)); hi.multiply(new THREE.Vector3(...pt.scale)); }
    }
    const c = new THREE.Vector3(...(pt.p || [0, 0, 0]));
    // rotate the box corners
    const q = partQuat(pt);
    tmp.makeEmpty();
    for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) {
      tmp.expandByPoint(new THREE.Vector3(x, y, z).applyQuaternion(q).add(c));
    }
    box.union(tmp);
  }
  return box;
}
