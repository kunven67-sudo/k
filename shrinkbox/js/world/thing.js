// A "Thing" is any object in the world: a desk, the Xbox, a soda can, a fan blade.
// It is described as a list of PARTS. Each part has a real shape that is used for BOTH the
// picture and the collision, so what you see is exactly what you bump into.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { R, world, colliderDesc, handleToThing, groups, G } from '../core/physics.js';
import { mat as getMat } from '../core/materials.js';

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
export const things = new Set();

// ---- geometry helpers (UVs in meters) ----------------------------------------------------
export function boxUV(geom) {
  // planar-project UVs by each vertex's main normal axis, in meters
  const p = geom.attributes.position, n = geom.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = p.getZ(i); v = p.getY(i); }
    else if (ny >= nz) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geom;
}
export function cylUV(geom, r, h) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * h);
  return geom;
}

export function quatFrom(rot) {
  if (!rot) return null;
  if (rot.length === 4) return rot;
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  return [_q.x, _q.y, _q.z, _q.w];
}

function partGeometry(p) {
  switch (p.shape) {
    case 'box': return boxUV(new THREE.BoxGeometry(...p.size));
    case 'rbox': {
      const r = Math.min(p.radius, p.size[0] / 2, p.size[1] / 2, p.size[2] / 2) * 0.999;
      return r > 0 ? boxUV(new RoundedBoxGeometry(p.size[0], p.size[1], p.size[2], p.seg || 3, r)) : boxUV(new THREE.BoxGeometry(...p.size));
    }
    case 'cyl': return cylUV(new THREE.CylinderGeometry(p.rTop ?? p.r, p.r, p.h, p.seg || 32, 1, !!p.open), p.r, p.h);
    case 'ball': return new THREE.SphereGeometry(p.r, p.seg || 24, Math.max(8, (p.seg || 24) >> 1));
    case 'capsule': return new THREE.CapsuleGeometry(p.r, p.h, 6, p.seg || 16);
    default: return null;
  }
}

// ---- Thing --------------------------------------------------------------------------------
export class Thing {
  /**
   * opts: name, type ('fixed' | 'dynamic' | 'kinematic'), density (kg/m3), pos [x,y,z], rot (euler or quat)
   */
  constructor(opts = {}) {
    this.name = opts.name || 'thing';
    this.type = opts.type || 'fixed';
    this.density = opts.density ?? 600;
    this.parts = [];
    this.scale = opts.scale || 1;
    this.baseScale = this.scale;
    this.group = new THREE.Group();
    this.group.name = this.name;
    this.startPos = opts.pos || [0, 0, 0];
    this.startQuat = quatFrom(opts.rot) || [0, 0, 0, 1];
    this.body = null;
    this.colliders = [];
    this.tags = new Set(opts.tags || []);
    this.icon = opts.icon || '📦';
    this.spawnId = opts.spawnId || null;
    this.material = opts.surface || 'plastic'; // what the micro world looks like on it
    this.enclosure = opts.enclosure || null;  // interior volume (box in local space) -> inside effects
    this.behaviors = [];
    this.dirt = opts.dirt ?? null; // 0 clean .. 1 filthy (germs); null = typical for its surface
    this.on = false;
  }

  add(p) {
    p.pos = p.pos || [0, 0, 0];
    p.quat = quatFrom(p.rot) || null;
    if (p.collide === undefined) p.collide = true;
    this.parts.push(p);
    return p;
  }
  box(size, pos, m, o = {}) { return this.add({ shape: 'box', size, pos, mat: m, ...o }); }
  rbox(size, pos, m, radius, o = {}) { return this.add({ shape: 'rbox', size, pos, mat: m, radius, ...o }); }
  cyl(r, h, pos, m, o = {}) { return this.add({ shape: 'cyl', r, h, pos, mat: m, ...o }); }
  ball(r, pos, m, o = {}) { return this.add({ shape: 'ball', r, pos, mat: m, ...o }); }
  capsule(r, h, pos, m, o = {}) { return this.add({ shape: 'capsule', r, h, pos, mat: m, ...o }); }
  // custom geometry; collider 'hull' (convex) or 'trimesh' (exact, static only) or false
  geo(geometry, pos, m, o = {}) {
    const p = this.add({ shape: 'geo', geometry, pos, mat: m, ...o });
    if (p.collide && p.collide !== true) this._geoCollider(p, p.collide);
    else if (p.collide === true) this._geoCollider(p, this.type === 'fixed' ? 'trimesh' : 'hull');
    return p;
  }
  _geoCollider(p, kind) {
    const g = p.geometry;
    if (kind === 'hull') {
      p.colShape = { shape: 'hull', points: Array.from(g.attributes.position.array) };
    } else {
      const gi = g.index ? g : g.clone();
      if (!gi.index) { const idx = []; for (let i = 0; i < g.attributes.position.count; i++) idx.push(i); gi.setIndex(idx); }
      p.colShape = { shape: 'trimesh', vertices: Array.from(gi.attributes.position.array), indices: new Uint32Array(gi.index.array) };
    }
  }
  // invisible collider only (rarely needed: e.g. liquid sensors)
  sensor(size, pos, o = {}) { return this.add({ shape: 'box', size, pos, visual: false, sensor: true, ...o }); }

  // Build visuals (merged per material for speed) and physics.
  build(scene) {
    this._buildVisuals();
    this.group.position.set(...this.startPos);
    this.group.quaternion.set(...this.startQuat);
    this.group.scale.setScalar(this.scale);
    this.group.userData.thing = this;
    scene.add(this.group);
    this._buildBody();
    things.add(this);
    return this;
  }

  _buildVisuals() {
    for (const m of [...this.group.children]) if (m.userData.thing === this && m.isMesh) { this.group.remove(m); m.geometry.dispose(); }
    this.meshes = {};
    const byMat = new Map();
    for (const p of this.parts) {
      if (p.visual === false) continue;
      let g = p.shape === 'geo' ? p.geometry.clone() : partGeometry(p);
      if (!g) continue;
      _q.set(...(p.quat || [0, 0, 0, 1]));
      _m.compose(_v.set(...p.pos), _q, _s);
      g.applyMatrix4(_m);
      if (g.index) g = g.toNonIndexed();
      if (!g.attributes.uv) boxUV(g);
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      const key = p.group ? 'grp:' + p.group + ':' + (typeof p.mat === 'string' ? p.mat : p.mat.uuid) : p.mesh ? Symbol('own') : (typeof p.mat === 'string' ? p.mat : p.mat.uuid);
      if (!byMat.has(key)) byMat.set(key, { mat: typeof p.mat === 'string' ? getMat(p.mat) : p.mat, geoms: [], parts: [] });
      byMat.get(key).geoms.push(g); byMat.get(key).parts.push(p);
    }
    for (const { mat, geoms, parts } of byMat.values()) {
      const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = parts.some((p) => p.shadow !== false);
      mesh.receiveShadow = true;
      // parts flagged {mesh:true} or {group:'name'} get their own animatable mesh
      if (parts[0].mesh || parts[0].group) {
        for (const pp of parts) pp.meshRef = mesh;
        const pv = parts[0].pivot;
        if (pv) { merged.translate(-pv[0], -pv[1], -pv[2]); mesh.position.set(...pv); }
        const gname = parts[0].group || parts[0].name;
        if (gname) { this.meshes = this.meshes || {}; (this.meshes[gname] = this.meshes[gname] || []).push(mesh); }
      }
      mesh.userData.thing = this;
      this.group.add(mesh);
    }
  }

  _buildBody() {
    let bd;
    if (this.type === 'dynamic') bd = R.RigidBodyDesc.dynamic().setCcdEnabled(true).setLinearDamping(0.05).setAngularDamping(0.15);
    else if (this.type === 'kinematic') bd = R.RigidBodyDesc.kinematicPositionBased();
    else bd = R.RigidBodyDesc.fixed();
    bd.setTranslation(...this.startPos);
    const q = this.startQuat; bd.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] });
    this.body = world.createRigidBody(bd);
    this.body.userData = this;
    this._buildColliders();
  }

  _buildColliders() {
    for (const c of this.colliders) { handleToThing.delete(c.handle); world.removeCollider(c, false); }
    this.colliders = [];
    for (const p of this.parts) {
      if (!p.collide && !p.sensor) continue;
      const spec = p.colShape ? { ...p.colShape, pos: p.pos, quat: p.quat, friction: p.friction, bounce: p.bounce } : p;
      const d = colliderDesc(spec, this.scale);
      if (!d) continue;
      d.setDensity(p.density ?? this.density);
      d.setCollisionGroups(p.sensor ? groups(G.SENSOR, G.PLAYER | G.PROP) : groups(this.type === 'dynamic' ? G.PROP : G.WORLD, 0xffff));
      if (p.sensor) d.setActiveEvents(R.ActiveEvents.COLLISION_EVENTS);
      const c = world.createCollider(d, this.body);
      c.part = p; p.collider = c;
      handleToThing.set(c.handle, this);
      this.colliders.push(c);
    }
  }

  // Shrinker / grower: change the size of the whole object (visuals, collision, mass).
  setScale(k) {
    k = Math.max(1e-4, Math.min(k, 60));
    if (Math.abs(k - this.scale) < 1e-9) return;
    const ratio = k / this.scale;
    this.scale = k;
    this.group.scale.setScalar(k);
    this._buildColliders();
    if (this.body && this.type === 'dynamic') this.body.wakeUp();
    for (const b of this.behaviors) if (b.onScale) b.onScale(this, ratio);
  }

  // Cut a piece off (cutter tool): parts tagged {cut: key} become their own loose object.
  detach(key, scene) {
    const parts = this.parts.filter((p) => p.cut === key);
    if (!parts.length) return null;
    this.parts = this.parts.filter((p) => p.cut !== key);
    this._buildVisuals();
    this._buildColliders();
    this.cuts = [...(this.cuts || []), key];
    const t = this.body.translation(), r = this.body.rotation();
    const piece = new Thing({ name: `${this.name} (${key})`, type: 'dynamic', density: this.density, scale: this.scale, pos: [t.x, t.y, t.z], rot: [r.x, r.y, r.z, r.w], surface: this.material, icon: this.icon });
    for (const p of parts) { const q = { ...p }; delete q.collider; delete q.meshRef; delete q.cut; piece.parts.push(q); }
    piece.build(scene);
    piece.pieceOf = this; piece.pieceKey = key; piece.spawned = true;
    if (this.body) this.body.wakeUp();
    return piece;
  }

  get mass() { return this.body ? this.body.mass() : 0; }
  position(out = new THREE.Vector3()) { const t = this.body.translation(); return out.set(t.x, t.y, t.z); }
  setPosition(x, y, z) { this.body.setTranslation({ x, y, z }, true); this.group.position.set(x, y, z); }

  // local point -> world
  toWorld(v) { return v.multiplyScalar(1).applyMatrix4(this.group.matrixWorld); }

  sync() {
    if (!this.body || this.type === 'fixed') return;
    const t = this.body.translation(), r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }

  update(dt, game) { for (const b of this.behaviors) if (b.update) b.update(this, dt, game); }

  remove(scene) {
    for (const c of this.colliders) handleToThing.delete(c.handle);
    if (this.body) world.removeRigidBody(this.body);
    this.body = null;
    scene.remove(this.group);
    things.delete(this);
  }
}

// Make a ring of boxes = a hollow tube wall you can actually go inside (cans, cups, pots).
export function tubeWall(t, { r, h, thick, y = 0, seg = 24, m, gap = null, x = 0, z = 0 }) {
  // gap: [startAngle, endAngle] where there is no wall (an opening)
  const arc = (Math.PI * 2) / seg;
  const w = 2 * (r + thick / 2) * Math.tan(arc / 2) * 1.02;
  for (let i = 0; i < seg; i++) {
    const a = (i + 0.5) * arc;
    if (gap && a > gap[0] && a < gap[1]) continue;
    t.box([w, h, thick], [x + Math.cos(a) * (r + thick / 2), y, z + Math.sin(a) * (r + thick / 2)], m, { rot: [0, -a + Math.PI / 2, 0], visual: false });
  }
  // the visual is a smooth open cylinder pair (outside + inside) instead of the boxes
  const outer = cylUV(new THREE.CylinderGeometry(r + thick, r + thick, h, 48, 1, true), r, h);
  const inner = cylUV(new THREE.CylinderGeometry(r, r, h, 48, 1, true), r, h);
  inner.scale(-1, 1, 1); // flip so the inside faces inward
  inner.computeVertexNormals();
  t.geo(outer, [x, y, z], m, { collide: false });
  t.geo(inner, [x, y, z], m, { collide: false });
}

export function lathe(points, seg = 48, phiStart = 0, phiLength = Math.PI * 2) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg, phiStart, phiLength);
}

// A flat panel (wall, console side) with rectangular HOLES cut in it (windows, doors, ports,
// slots). It is split into boxes around the holes, so the holes are real - you can go through.
// axis: which local axis the panel faces ('x' | 'y' | 'z'). rect = [u0, v0, u1, v1] in the panel
// plane, at offset `at` along the axis. holes = [[u0, v0, u1, v1], ...]
export function panel(t, { axis = 'z', at = 0, rect, holes = [], thick, m, o = {} }) {
  const us = new Set([rect[0], rect[2]]), vs = new Set([rect[1], rect[3]]);
  for (const h of holes) { us.add(Math.max(rect[0], Math.min(rect[2], h[0]))); us.add(Math.max(rect[0], Math.min(rect[2], h[2]))); vs.add(Math.max(rect[1], Math.min(rect[3], h[1]))); vs.add(Math.max(rect[1], Math.min(rect[3], h[3]))); }
  const U = [...us].sort((a, b) => a - b), V = [...vs].sort((a, b) => a - b);
  const inHole = (u, v) => holes.some((h) => u > h[0] && u < h[2] && v > h[1] && v < h[3]);
  for (let j = 0; j < V.length - 1; j++) {
    let start = null;
    for (let i = 0; i <= U.length - 1; i++) {
      const solid = i < U.length - 1 && !inHole((U[i] + U[i + 1]) / 2, (V[j] + V[j + 1]) / 2) && U[i + 1] - U[i] > 1e-6;
      if (solid && start === null) start = i;
      if (!solid && start !== null) {
        const u0 = U[start], u1 = U[i], v0 = V[j], v1 = V[j + 1];
        const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, w = u1 - u0, h = v1 - v0;
        if (h > 1e-6) {
          if (axis === 'z') t.box([w, h, thick], [cu, cv, at], m, o);
          else if (axis === 'x') t.box([thick, h, w], [at, cv, cu], m, o);
          else t.box([w, thick, h], [cu, at, cv], m, o);
        }
        start = null;
      }
    }
  }
}

// A grille of bars (vents): real gaps between the bars that tiny-you can fall/walk through.
// axis = the direction the grille faces. rect in plane coords; bar = bar width; gap = hole size.
export function grille(t, { axis = 'y', at = 0, rect, bar, gap, thick, m, cross = true, o = {} }) {
  const [u0, v0, u1, v1] = rect;
  const put = (size, pos, th = thick) => {
    if (axis === 'y') t.box([size[0], th, size[1]], [pos[0], at, pos[1]], m, o);
    else if (axis === 'z') t.box([size[0], size[1], th], [pos[0], pos[1], at], m, o);
    else t.box([th, size[1], size[0]], [at, pos[1], pos[0]], m, o);
  };
  const stops = (a, b) => {
    const out = [];
    for (let x = a + bar / 2; x < b - bar / 2 - gap * 0.3; x += bar + gap) out.push(x);
    out.push(b - bar / 2);
    return out;
  };
  for (const u of stops(u0, u1)) put([bar, v1 - v0], [u, (v0 + v1) / 2]);
  if (cross) for (const v of stops(v0, v1)) put([u1 - u0, bar], [(u0 + u1) / 2, v], thick * 0.94);
}

// Collision for a slanted ring (cone section) from (r0, y0) to (r1, y1): can shoulders, cups,
// bowls, pots. Each segment is a thin box tilted along the slope. Collision only.
export function coneWall(t, { r0, y0, r1, y1, thick, seg = 24, m = 'alu', x = 0, z = 0, gap = null, o = {} }) {
  const arc = (Math.PI * 2) / seg;
  const L = Math.hypot(r1 - r0, y1 - y0);
  const tilt = Math.atan2(r1 - r0, y1 - y0); // lean outward going up
  const rm = (r0 + r1) / 2, ym = (y0 + y1) / 2;
  const nOff = (thick / 2) * Math.cos(tilt), yOff = -(thick / 2) * Math.sin(tilt);
  const w = 2 * (Math.max(r0, r1) + thick) * Math.tan(arc / 2) * 1.04;
  const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), qt = new THREE.Quaternion();
  for (let i = 0; i < seg; i++) {
    const a = (i + 0.5) * arc;
    if (gap && a > gap[0] && a < gap[1]) continue;
    qa.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0));
    qt.setFromEuler(new THREE.Euler(tilt, 0, 0));
    q.copy(qa).multiply(qt);
    t.box([w, L, thick], [x + Math.cos(a) * (rm + nOff), ym + yOff, z + Math.sin(a) * (rm + nOff)], m, { rot: [q.x, q.y, q.z, q.w], visual: false, ...o });
  }
}

// Collision for a flat round disc (lids, plates) made of strips, with an optional rectangular
// hole (e.g. the opening on a soda can). Collision only.
export function diskStrips(t, { r, y, thick, strip, hole = null, m = 'alu', o = {} }) {
  for (let xs = -r + strip / 2; xs < r; xs += strip) {
    const half = Math.sqrt(Math.max(0, r * r - (Math.abs(xs) + strip / 2) ** 2)) + strip * 0.3;
    if (half <= 0) continue;
    if (hole && xs > hole[0] && xs < hole[2]) {
      if (-half < hole[1]) { const a = -half, b = hole[1]; t.box([strip, thick, b - a], [xs, y, (a + b) / 2], m, { visual: false, ...o }); }
      if (half > hole[3]) { const a = hole[3], b = half; t.box([strip, thick, b - a], [xs, y, (a + b) / 2], m, { visual: false, ...o }); }
    } else t.box([strip, thick, half * 2], [xs, y, 0], m, { visual: false, ...o });
  }
}

// Smooth rounded-box SKIN (visual only) with some flat faces removed, so they can be replaced
// by panels that have real holes. remove: ['+y', '-z', ...]. Rendered double-sided so the inside
// of the shell is visible when you're in there.
export function shellGeo(size, radius, remove = []) {
  const g = new RoundedBoxGeometry(size[0], size[1], size[2], 3, radius).toNonIndexed();
  const p = g.attributes.position, n = g.attributes.normal, keep = [];
  const half = [size[0] / 2, size[1] / 2, size[2] / 2];
  const dirs = remove.map((r) => ({ axis: 'xyz'.indexOf(r[1]), sign: r[0] === '+' ? 1 : -1 }));
  for (let i = 0; i < p.count; i += 3) {
    let drop = false;
    for (const d of dirs) {
      let flat = true;
      for (let k = 0; k < 3; k++) {
        const c = [p.getX(i + k), p.getY(i + k), p.getZ(i + k)][d.axis];
        const nn = [n.getX(i + k), n.getY(i + k), n.getZ(i + k)][d.axis];
        if (Math.abs(c - d.sign * half[d.axis]) > 1e-5 || nn * d.sign < 0.999) flat = false;
      }
      if (flat) drop = true;
    }
    if (!drop) keep.push(i);
  }
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name], arr = new Float32Array(keep.length * 3 * a.itemSize);
    keep.forEach((i, j) => { for (let k = 0; k < 3; k++) for (let c = 0; c < a.itemSize; c++) arr[(j * 3 + k) * a.itemSize + c] = a.array[(i + k) * a.itemSize + c]; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return boxUV(out);
}
