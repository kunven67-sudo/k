// Turns an item's list of parts into BOTH the 3D model and the physics shapes.
// Same numbers -> same shape, so collisions match what you see.
//
// part: { s: 'box'|'cyl'|'cone'|'sphere'|'capsule'|'hull',
//         size: [w,h,d] (box), r, h, r2 (cone top radius), round (box edge radius),
//         p: [x,y,z], rot: [x,y,z] degrees, mat: 'wood:oak', body: 'main',
//         grain: 'x'|'y'|'z' (wood direction), col: false (no collision), vis: false (no mesh),
//         pts: [[x,y,z]...] (hull), seg: radial segments, light: {...} }

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { material, physicalOf } from './materials.js';

const DEG = Math.PI / 180;
const geoCache = new Map();

function partGeometry(pt, tile) {
  const key = JSON.stringify([pt.s, pt.size, pt.r, pt.h, pt.r2, pt.round, pt.seg, pt.grain, tile, pt.pts ? pt.pts.length : 0, pt.uvRot]);
  if (geoCache.has(key) && !pt.pts) return geoCache.get(key);
  let g;
  switch (pt.s) {
    case 'box': {
      const [w, h, d] = pt.size;
      const r = Math.min(pt.round ?? 0.004, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
      g = r > 0.0015 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
      meterUVBox(g, pt.grain || longest(pt.size), tile);
      break;
    }
    case 'cyl': g = new THREE.CylinderGeometry(pt.r, pt.r, pt.h, pt.seg || 20); meterUVCyl(g, pt.r, pt.h, tile); break;
    case 'cone': g = new THREE.CylinderGeometry(pt.r2, pt.r, pt.h, pt.seg || 20); meterUVCyl(g, Math.max(pt.r, pt.r2), pt.h, tile); break;
    case 'sphere': g = new THREE.SphereGeometry(pt.r, pt.seg || 20, Math.max(8, (pt.seg || 20) >> 1)); break;
    case 'capsule': g = new THREE.CapsuleGeometry(pt.r, pt.h, 6, pt.seg || 14); meterUVCyl(g, pt.r, pt.h + pt.r * 2, tile); break;
    case 'hull': {
      // lathe-like: pts are [radius, y] pairs for a revolved profile, or raw [x,y,z] points
      if (pt.lathe) {
        g = new THREE.LatheGeometry(pt.lathe.map(([r, y]) => new THREE.Vector2(r, y)), pt.seg || 28);
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
    const geo = partGeometry(pt, mat.userData.tile || 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...(pt.p || [0, 0, 0]));
    mesh.quaternion.copy(partQuat(pt));
    if (pt.scale) mesh.scale.set(...pt.scale);
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
    case 'hull': return (pt.volume ?? 0.001);
    default: return 0.001;
  }
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
    let half;
    if (pt.s === 'box') half = new THREE.Vector3(pt.size[0] / 2, pt.size[1] / 2, pt.size[2] / 2);
    else if (pt.s === 'sphere') half = new THREE.Vector3(pt.r, pt.r, pt.r);
    else if (pt.s === 'capsule') half = new THREE.Vector3(pt.r, pt.h / 2 + pt.r, pt.r);
    else if (pt.s === 'cyl' || pt.s === 'cone') { const r = Math.max(pt.r, pt.r2 || 0); half = new THREE.Vector3(r, pt.h / 2, r); }
    else { const g = partGeometry(pt, 1); g.computeBoundingBox(); const s = new THREE.Vector3(); g.boundingBox.getSize(s); half = s.multiplyScalar(0.5); }
    const c = new THREE.Vector3(...(pt.p || [0, 0, 0]));
    // rotate the box corners
    const q = partQuat(pt);
    tmp.makeEmpty();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      tmp.expandByPoint(new THREE.Vector3(half.x * sx, half.y * sy, half.z * sz).applyQuaternion(q).add(c));
    }
    box.union(tmp);
  }
  return box;
}
