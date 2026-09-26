// Shared bug anatomy. Bodies are turned on a lathe from a profile (so tapers, segment grooves and
// elytra striae are real geometry, not stretched spheres), legs are jointed and solved with IK so
// the feet plant on the ground, eyes are faceted, wings are veined membranes, and hairs are geometry.
import * as THREE from 'three';
import * as TX from '../core/textures.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- materials
const texCache = new Map();
function detail(kind, repeat) {
  const key = kind + repeat;
  if (!texCache.has(key)) {
    const base = kind === 'hair' ? TX.setae() : TX.cuticle();
    texCache.set(key, repeat === 1 ? base : TX.withRepeat(base, repeat, repeat));
  }
  return texCache.get(key);
}

// Insect cuticle: micro-sculpted base with a separate smooth clear coat, like real chitin.
export function cuticleMat(color, { rough = 0.8, coat = 0.5, coatRough = 0.3, metal = 0, sheen = 0, sheenColor = 0xffffff, iri = 0, hair = false, repeat = hair ? 1 : 3, bump = hair ? 0.6 : 0.45, map = null, side = THREE.FrontSide, transparent = false, opacity = 1 } = {}) {
  const t = detail(hair ? 'hair' : 'cut', repeat);
  const m = new THREE.MeshPhysicalMaterial({
    color, map: map || t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: rough, metalness: metal,
    clearcoat: coat, clearcoatRoughness: coatRough, emissive: 0x000000, side, transparent, opacity,
  });
  m.normalScale = new THREE.Vector2(bump, bump);
  if (sheen) { m.sheen = sheen; m.sheenColor = new THREE.Color(sheenColor); m.sheenRoughness = 0.45; }
  if (iri) { m.iridescence = iri; m.iridescenceIOR = 1.45; m.iridescenceThicknessRange = [180, 520]; }
  return m;
}

// Canvas pattern for lathe parts: u runs around the body (0.5 = the back), v runs tail (0) to head (1).
export function patternMap(key, draw, w = 128, h = 256) {
  const t = TX.drawn(`pat_${key}`, w, h, (c) => draw(c, w, h));
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Legs with rings of a second colour (house centipede, wolf spider, mosquito, ticks).
// Bands sit at (i + offset) / bands along each segment; width is a fraction of the segment.
export function bandedMat(base, band, { bands = 2, width = 0.18, offset = 0.5, rough = 0.8, coat = 0.3 } = {}) {
  const hexs = (c) => '#' + c.toString(16).padStart(6, '0');
  const map = TX.drawn(`bands${base}_${band}_${bands}_${width}_${offset}`, 8, 128, (c, w, h) => {
    c.fillStyle = hexs(base); c.fillRect(0, 0, w, h);
    for (let i = -1; i <= bands; i++) {
      const y = ((i + offset) / bands) * h, bw = width * h;
      const g = c.createLinearGradient(0, y - bw, 0, y + bw);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, hexs(band)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, y - bw, w, bw * 2);
    }
  });
  return cuticleMat(0xffffff, { map, hair: true, rough, coat });
}

export function eyeMat(color = 0x5a1208, rows = 26) {
  const t = TX.facets({ color, rows });
  const m = new THREE.MeshPhysicalMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 0.9, clearcoat: 1, clearcoatRoughness: 0.06, emissive: 0x000000 });
  m.normalScale = new THREE.Vector2(1.2, 1.2);
  return m;
}

// Simple eyes (spiders, ocelli): glassy domes.
export function ocellusMat(color = 0x050505, shine = 0x000000) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, emissive: shine });
}

export function wingMat(kind = 'fly', tint = 0xffffff) {
  return new THREE.MeshPhysicalMaterial({
    map: TX.wingTexture(kind), color: tint, transparent: true, side: THREE.DoubleSide, roughness: 0.18,
    iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [250, 750], depthWrite: false, emissive: 0x000000,
  });
}

export function hairMat(color, rough = 0.65) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, emissive: 0x000000 });
}

// ---------------------------------------------------------------- body parts (lathe)
// o: { len, rad, peak (0..1 where it's widest, from the tail), p (0.5 = ellipse, lower = boxier,
//      higher = pointier), ridges, ridgeDepth, grooves, grooveDepth, wide, flat, phi0, phiLen }
function profileR(t, o) {
  const pk = o.peak ?? 0.5;
  const s = pk === 0.5 ? t : Math.pow(t, Math.log(0.5) / Math.log(pk));
  let r = Math.pow(Math.max(0, 4 * s * (1 - s)), o.p ?? 0.5);
  if (o.ridges) { const f = (t * o.ridges) % 1; r *= 1 - (o.ridgeDepth ?? 0.06) * Math.pow(1 - f, 6); }
  return r;
}

export function latheGeo(o) {
  return cached('L' + JSON.stringify(o), () => {
    const n = o.segs ?? Math.max(18, (o.ridges || 0) * 6 + 14);
    const R = o.radial ?? 20;
    const phi0 = o.phi0 ?? 0, phiL = o.phiLen ?? Math.PI * 2;
    const full = phiL >= Math.PI * 2 - 1e-6;
    const wide = o.wide ?? 1, flat = o.flat ?? 1;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r0 = Math.max(1e-4, profileR(t, o)) * o.rad;
      const z = t * o.len - o.len / 2;
      for (let k = 0; k <= R; k++) {
        const u = k / R, phi = phi0 + u * phiL;
        let r = r0;
        if (o.grooves) r *= 1 - (o.grooveDepth ?? 0.03) * (0.5 + 0.5 * Math.cos(phi * o.grooves));
        pos.push(r * Math.sin(phi) * wide, -r * Math.cos(phi) * flat, z);
        uv.push(u, t);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < R; k++) {
        const a = i * (R + 1) + k, b = a + R + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nr = g.attributes.normal;
    if (full) {
      // weld the seam so it doesn't show as a crease
      for (let i = 0; i <= n; i++) {
        const a = i * (R + 1), b = a + R;
        const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b);
        const l = Math.hypot(x, y, z) || 1;
        nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l);
      }
    }
    for (let k = 0; k <= R; k++) { nr.setXYZ(k, 0, 0, -1); nr.setXYZ(n * (R + 1) + k, 0, 0, 1); }
    return g;
  });
}

// A body part mesh centred on the origin, running along +z (tail at -len/2, front at +len/2).
export function part(o, mat, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(latheGeo(o), mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Hairs growing out of a lathe part (same `o`), lying back toward the tail by `lay`.
export function hairGeo(o, { count = 60, len = 0.05, r = 0.004, lay = 0.8, minUp = -0.4, seed = 1, tMin = 0.05, tMax = 0.95 } = {}) {
  return cached('H' + JSON.stringify(o) + [count, len, r, lay, minUp, seed, tMin, tMax].join(','), () => {
    const rnd = rng(seed * 977 + 13);
    const pos = [], nor = [];
    const wide = o.wide ?? 1, flat = o.flat ?? 1, phi0 = o.phi0 ?? 0, phiL = o.phiLen ?? Math.PI * 2;
    const back = new V3(0, 0, -1), up = new V3(0, 1, 0), s1 = new V3(), s2 = new V3();
    let made = 0, guard = 0;
    while (made < count && guard++ < count * 30) {
      const t = tMin + rnd() * (tMax - tMin);
      const phi = phi0 + rnd() * phiL;
      if (-Math.cos(phi) < minUp) continue;
      const r0 = profileR(t, o) * o.rad;
      const dr = (profileR(Math.min(1, t + 0.01), o) - profileR(Math.max(0, t - 0.01), o)) * o.rad / (0.02 * o.len);
      const p = new V3(r0 * Math.sin(phi) * wide, -r0 * Math.cos(phi) * flat, t * o.len - o.len / 2);
      const n = new V3(Math.sin(phi) / wide, -Math.cos(phi) / flat, -dr).normalize();
      const dir = n.clone().addScaledVector(back, lay).normalize();
      const L = len * (0.55 + rnd() * 0.9);
      p.addScaledVector(n, -r * 1.5);
      const tip = p.clone().addScaledVector(dir, L + r * 1.5);
      s1.crossVectors(dir, Math.abs(dir.y) > 0.9 ? back : up).normalize();
      s2.crossVectors(dir, s1).normalize();
      const b = [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2; return p.clone().addScaledVector(s1, Math.cos(a) * r).addScaledVector(s2, Math.sin(a) * r); });
      for (let i = 0; i < 3; i++) {
        const b0 = b[i], b1 = b[(i + 1) % 3];
        pos.push(b0.x, b0.y, b0.z, b1.x, b1.y, b1.z, tip.x, tip.y, tip.z);
        for (let k = 0; k < 3; k++) nor.push(n.x, n.y, n.z);
      }
      made++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  });
}

export function hairs(o, opts, mat, host) {
  const m = new THREE.Mesh(hairGeo(o, opts), mat);
  if (host) host.add(m);
  return m;
}

// Tapered (optionally beaded or clubbed) tube along a curve: antennae, cerci, proboscis, horns.
export function tubeGeo(points, { r0 = 0.02, r1 = 0.01, segs = 20, radial = 5, beads = 0, beadAmt = 0.3, club = 0 } = {}) {
  return cached('T' + JSON.stringify(points) + [r0, r1, segs, radial, beads, beadAmt, club].join(','), () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new V3(p[0], p[1], p[2])));
    const g = new THREE.TubeGeometry(curve, segs, r0, radial, false);
    const pos = g.attributes.position, P = new V3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      curve.getPointAt(t, P);
      let k = 1 + (r1 / r0 - 1) * t;
      if (beads) k *= 1 - beadAmt * (1 - Math.sqrt(Math.abs(Math.sin(Math.PI * t * beads))));
      if (club) k *= 1 + club * clamp((t - 0.72) / 0.2, 0, 1) * (t > 0.97 ? 0.4 : 1);
      if (i === segs) k *= 0.35;
      for (let j = 0; j <= radial; j++) {
        const vi = i * (radial + 1) + j;
        pos.setXYZ(vi, P.x + (pos.getX(vi) - P.x) * k, P.y + (pos.getY(vi) - P.y) * k, P.z + (pos.getZ(vi) - P.z) * k);
      }
    }
    return g;
  });
}

export function tube(points, opts, mat, parent) {
  const m = new THREE.Mesh(tubeGeo(points, opts), mat);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Mirror an [x,y,z] point list to the other side.
export const mirror = (pts, s) => pts.map(([x, y, z]) => [x * s, y, z]);

export function eye(r, mat, parent, x, y, z, sx = 1, sy = 1, sz = 1) {
  const geo = cached(`E${r}`, () => new THREE.SphereGeometry(r, 22, 16));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  // turn the sphere's poles away so the facets are even where you look at them
  m.rotation.z = Math.PI / 2;
  if (parent) parent.add(m);
  return m;
}

// ---------------------------------------------------------------- wings
export function wingPair(parent, mat, { length, width, x = 0, y = 0, z = 0 }) {
  const geo = cached(`W${length}_${width}`, () => { const g = new THREE.PlaneGeometry(length, width); g.translate(length / 2, 0, 0); g.rotateX(Math.PI / 2); return g; });
  return [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * s, y, z);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    if (s < 0) m.scale.x = -1;
    pivot.add(m);
    pivot.userData.side = s;
    parent.add(pivot);
    return pivot;
  });
}

// sweep: 0 = straight out, ~1.4 = folded back along the body. flap: raise the tips.
export function poseWings(wings, sweep, flap, tilt = 0) {
  for (const w of wings) { const s = w.userData.side; w.rotation.set(tilt, sweep * s, flap * s); }
}

// ---------------------------------------------------------------- legs
function mergeGeos(list) {
  const pos = [], nor = [], uv = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    if (g.attributes.uv) uv.push(...g.attributes.uv.array); else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

// A tapered capsule running from x=0 to x=len, with optional spines pointing toward the tip.
function segGeo(len, r0, r1, radial, spines) {
  return cached(`S${len.toFixed(4)}_${r0.toFixed(5)}_${r1.toFixed(5)}_${radial}_${spines}`, () => {
    const g = new THREE.CapsuleGeometry(r0, len, 2, radial);
    const p = g.attributes.position, h = len / 2, k1 = r1 / r0;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), t = clamp((y + h) / len, 0, 1), k = 1 + (k1 - 1) * t;
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
      if (y > h) p.setY(i, h + (y - h) * k1);
    }
    g.rotateZ(-Math.PI / 2);
    g.translate(len / 2, 0, 0);
    if (!spines) return g;
    const rnd = rng(Math.round(len * 1000 + spines));
    const parts = [g];
    for (let i = 0; i < spines; i++) {
      const x = len * (0.25 + rnd() * 0.7), a = rnd() * Math.PI * 2;
      const rr = r0 + (r1 - r0) * (x / len);
      const c = new THREE.ConeGeometry(rr * 0.28, rr * 3.2, 4);
      c.translate(0, rr * 1.6, 0);
      c.rotateZ(-0.9);
      c.rotateX(a);
      c.translate(x, 0, 0);
      parts.push(c);
    }
    return mergeGeos(parts);
  });
}

export class Leg {
  constructor({ mat, coxa = 0, femur, tibia, tarsus = 0, r, radial = 6, spines = 0, coxaAngle = -0.4, tarsusAngle = -0.3, shadow = true }) {
    this.root = new THREE.Group();
    this.coxa = coxa; this.a = femur; this.b = tibia; this.tarsus = tarsus;
    this.ca = coxaAngle; this.ta = tarsusAngle;
    const seg = (parent, len, ra, rb, sp) => {
      const j = new THREE.Group(); parent.add(j);
      const m = new THREE.Mesh(segGeo(len, ra, rb, radial, sp), mat); m.castShadow = shadow; j.add(m);
      const end = new THREE.Group(); end.position.x = len; j.add(end);
      return { j, end };
    };
    let base = this.root;
    if (coxa > 0) { const c = seg(base, coxa, r * 1.35, r * 1.15, 0); c.j.rotation.z = coxaAngle; base = c.end; }
    this.fe = seg(base, femur, r * 1.15, r * 0.92, spines);
    this.ti = seg(this.fe.end, tibia, r * 0.88, r * 0.66, spines);
    if (tarsus > 0) this.tr = seg(this.ti.end, tarsus, r * 0.6, r * 0.32, 0);
  }

  // Put the tip of the foot at (h outward, y up) in the vertical plane at angle `yaw`; knee up.
  solve(yaw, h, y) {
    this.root.rotation.y = yaw;
    const a = this.a, b = this.b;
    const cx = this.coxa * Math.cos(this.ca), cy = this.coxa * Math.sin(this.ca);
    const tx = h - this.tarsus * Math.cos(this.ta) - cx, ty = y - this.tarsus * Math.sin(this.ta) - cy;
    const D = clamp(Math.hypot(tx, ty), Math.abs(a - b) + 1e-4, a + b - 1e-4);
    const th = Math.atan2(ty, tx);
    const alpha = Math.acos(clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1));
    const inner = Math.acos(clamp((a * a + b * b - D * D) / (2 * a * b), -1, 1));
    const fAbs = th + alpha, tAbs = fAbs - (Math.PI - inner);
    this.fe.j.rotation.z = fAbs - (this.coxa ? this.ca : 0);
    this.ti.j.rotation.z = tAbs - fAbs;
    if (this.tr) this.tr.j.rotation.z = this.ta - tAbs;
  }
}

const tmpS = new V3();

// Walks a set of legs: each foot plants on the ground during stance and swings forward in an arc.
// legs: [{ leg, hip: [x,y,z], foot: [x,z], phase }] in `frame` space (the body group).
export class Gait {
  constructor(frame, legs, { stride = 0.4, lift = 0.1, duty = 0.62, speedRef = 5, hangDrop = 0.5 } = {}) {
    this.frame = frame; this.legs = legs;
    this.stride = stride; this.lift = lift; this.duty = duty; this.speedRef = speedRef; this.hangDrop = hangDrop;
    this.cycle = Math.random(); this.amp = 0; this.air = 0; this.t = Math.random() * 10;
    for (const L of legs) { L.leg.root.position.set(L.hip[0], L.hip[1], L.hip[2]); frame.add(L.leg.root); }
    this.update(0, 0);
  }

  // speed is in world units/s; airborne pulls the legs up into a dangling pose.
  update(dt, speed, airborne = false) {
    const f = this.frame;
    const unit = f.parent ? f.getWorldScale(tmpS).x : 1;
    const ls = speed / (unit || 1);
    const gy = -f.position.y / f.scale.y;
    this.t += dt;
    this.amp = damp(this.amp, ls > 0.05 * this.speedRef ? 1 : 0, 6, dt);
    this.air = damp(this.air, airborne ? 1 : 0, 8, dt);
    const stride = this.stride * clamp(ls / this.speedRef, 0.3, 1.3);
    this.cycle = (this.cycle + (dt * ls * this.duty) / Math.max(1e-3, stride)) % 1;
    const duty = this.duty;
    for (const L of this.legs) {
      const ph = (this.cycle + L.phase) % 1;
      let dz, dy = 0;
      if (ph < duty) dz = stride * (0.5 - ph / duty);
      else { const u = (ph - duty) / (1 - duty); dz = stride * (u - 0.5); dy = this.lift * Math.sin(Math.PI * u); }
      let fx = L.foot[0], fz = L.foot[1] + dz * this.amp, fy = gy + dy * this.amp;
      if (this.air > 0.001) {
        // tuck in and dangle, swaying a little
        const hx = L.hip[0] + (L.foot[0] - L.hip[0]) * 0.55, hz = L.hip[2] + (L.foot[1] - L.hip[2]) * 0.6 - this.hangDrop * 0.3;
        const hy = L.hip[1] - this.hangDrop + Math.sin(this.t * 2 + L.phase * 6) * this.hangDrop * 0.06;
        fx += (hx - fx) * this.air; fz += (hz - fz) * this.air; fy += (hy - fy) * this.air;
      }
      const vx = fx - L.hip[0], vy = fy - L.hip[1], vz = fz - L.hip[2];
      L.leg.solve(Math.atan2(-vz, vx), Math.hypot(vx, vz), vy);
    }
  }
}

// Standard phase offsets.
export const TRIPOD = (i, s) => ((i % 2 === 0) === (s > 0) ? 0.5 : 0);
export const TETRAPOD = (i, s) => ((i % 2 === 0) === (s > 0) ? 0.5 : 0) + (i >= 2 ? 0.25 : 0);
export const WAVE = (n) => (i, s) => ((i / n) * 1.6 + (s > 0 ? 0.5 : 0)) % 1;

// Pairs of legs from a table of [hipX, hipY, hipZ, footX, footZ, opts?] (right side; mirrored).
// Unless fit is false, the foot is pushed along the hip->foot direction until the leg is extended by
// `reach` of its length, so legs sit naturally whatever their size.
export function legSet(frame, table, legOpts, gaitOpts = {}, phaseFn = TRIPOD) {
  const legs = [];
  const gy = -frame.position.y / frame.scale.y;
  table.forEach(([hx, hy, hz, fx, fz, opts], i) => {
    const o = { ...legOpts, ...(opts || {}) };
    let foot = [fx, fz];
    if (gaitOpts.fit !== false) {
      const reach = o.reach ?? gaitOpts.reach ?? 0.74;
      const ca = o.coxaAngle ?? -0.4, ta = o.tarsusAngle ?? -0.3, coxa = o.coxa || 0, tars = o.tarsus || 0;
      const dy = gy - hy - tars * Math.sin(ta) - coxa * Math.sin(ca);
      const R = reach * (o.femur + o.tibia);
      const hor = Math.sqrt(Math.max(0, R * R - dy * dy)) + tars * Math.cos(ta) + coxa * Math.cos(ca);
      const dx = fx - hx, dz = fz - hz, l = Math.hypot(dx, dz) || 1;
      foot = [hx + (dx / l) * hor, hz + (dz / l) * hor];
    }
    for (const s of [-1, 1]) legs.push({ leg: new Leg(o), hip: [hx * s, hy, hz], foot: [foot[0] * s, foot[1]], phase: phaseFn(i, s) });
  });
  return new Gait(frame, legs, gaitOpts);
}
