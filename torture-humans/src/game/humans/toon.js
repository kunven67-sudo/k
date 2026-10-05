// People made from scratch (no scanned models): a soft, rounded body built
// around the animation skeleton, so every walk/dance/wave clip still plays on
// it. One mesh and one material per person (fast), with a face that really
// moves: blinking lids, eyes that look around, brows, a mouth that smiles,
// frowns, screams and talks (morph targets with the same names the expression
// system uses). Bellies and cheeks jiggle (life.js), shapes are soft and a bit
// goofy. Three looks: 'jiggly' (default), 'cartoony', 'simple'.
//
// buildToon(skeletonTemplate, { seed, gender, job, style }) -> a template like a
// loaded GLB scene (Character clones it).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const STYLES = {
  jiggly: { head: 1.45, eye: 1.55, girth: 1.18, hand: 1.15, soft: 1, round: 1 },
  cartoony: { head: 1.75, eye: 2.0, girth: 1.3, hand: 1.35, soft: 1.3, round: 1.2 },
  simple: { head: 1.1, eye: 1.15, girth: 1.05, hand: 1.05, soft: 0.5, round: 0.8 },
};

const SKIN = [0xf6d3b8, 0xeec3a0, 0xe0ac86, 0xc98e66, 0xa86f4c, 0x8a5636, 0x6b3f26, 0x4e2c1a];
const HAIR = [0x1b1410, 0x3a2416, 0x5e3a1f, 0x8a5a2c, 0xc28b4a, 0xe0c27a, 0xa33a1c, 0x6e6e6e, 0xd9d9d9];
const EYES = [0x3a2a1a, 0x5a3c1e, 0x2f5a8a, 0x3f7a4a, 0x6a6a6a];

// what people wear for their job (shirt, pants, shoes, extras)
const OUTFITS = {
  'police officer': { shirt: 0x24345c, pants: 0x1c2438, shoes: 0x111111, hat: 'police', sleeves: 'short', badge: true },
  firefighter: { shirt: 0xb83a22, pants: 0x3a2a1a, shoes: 0x111111, hat: 'helmet-red', stripes: 0xe6e05a },
  nurse: { shirt: 0x5fb7b2, pants: 0x5fb7b2, shoes: 0xeeeeee, sleeves: 'short' },
  chef: { shirt: 0xf2f0ea, pants: 0x2a2a2a, shoes: 0x222222, hat: 'chef', apron: 0xf2f0ea },
  'office worker': { shirt: 0x4a5560, pants: 0x3a4250, shoes: 0x241a12, tie: 0x9a2a2a },
  builder: { shirt: 0xe07a22, pants: 0x3c4a6a, shoes: 0x5a3a1c, hat: 'helmet-yellow', stripes: 0xd8d8a0 },
  'delivery driver': { shirt: 0x7a4a22, pants: 0x5a3a1e, shoes: 0x2a1c12, hat: 'cap-brown', sleeves: 'short' },
  gardener: { shirt: 0x4f7a34, pants: 0x5a4a32, shoes: 0x3a2a1a, hat: 'cap-green', sleeves: 'short' },
  'security guard': { shirt: 0x1e1e1e, pants: 0x1e1e1e, shoes: 0x111111, badge: true },
  'fitness coach': { shirt: 0xe23a6a, pants: 0x222244, shoes: 0xf2f2f2, sleeves: 'short' },
  carpenter: { shirt: 0x8a3a2a, pants: 0x3a4a6a, shoes: 0x4a2e18, sleeves: 'rolled' },
};

function rng(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  s = s || 12345;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---- a growing mesh: positions, normals, colors, two-bone skinning, morph deltas
class Builder {
  constructor(boneIndex) {
    this.bi = boneIndex;
    this.pos = []; this.nor = []; this.col = []; this.si = []; this.sw = []; this.idx = [];
    this.morphs = new Map(); // name -> Map(vertex -> [dx,dy,dz])
    this.soft = [];          // 0..1: how much this vertex jiggles
  }

  get count() { return this.pos.length / 3; }

  vertex(p, n, color, bones, soft = 0) {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(color.r, color.g, color.b);
    const b = bones.slice(0, 4);
    while (b.length < 4) b.push([0, 0]);
    let total = b.reduce((a, [, w]) => a + w, 0) || 1;
    this.si.push(...b.map(([name]) => (typeof name === 'number' ? name : this.bi[name] ?? 0)));
    this.sw.push(...b.map(([, w]) => w / total));
    this.soft.push(soft);
    return this.count - 1;
  }

  tri(a, b, c) { this.idx.push(a, b, c); }

  morph(name, v, d) {
    if (!this.morphs.has(name)) this.morphs.set(name, new Map());
    this.morphs.get(name).set(v, d);
  }

  // an ellipsoid (center, radii, orientation), skinned by a function of the local point
  ellipsoid(c, r, color, skin, { seg = 16, rings = 12, rot = null, cut = null, soft = 0, flip = false } = {}) {
    const q = rot || new THREE.Quaternion();
    const start = this.count;
    const ids = [];
    for (let i = 0; i <= rings; i++) {
      const v = i / rings, phi = v * Math.PI;
      const row = [];
      for (let j = 0; j <= seg; j++) {
        const u = j / seg, th = u * Math.PI * 2;
        const local = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        if (cut && !cut(local)) { row.push(-1); continue; }
        const p = local.clone().multiply(r).applyQuaternion(q).add(c);
        const n = local.clone().divide(r).normalize().applyQuaternion(q);
        if (flip) n.negate();
        row.push(this.vertex(p, n, typeof color === 'function' ? color(local, p) : color, skin(local, p), typeof soft === 'function' ? soft(local, p) : soft));
      }
      ids.push(row);
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = ids[i][j], b = ids[i + 1][j], c2 = ids[i + 1][j + 1], d = ids[i][j + 1];
        if (a < 0 || b < 0 || c2 < 0 || d < 0) continue;
        if (flip) { this.tri(a, c2, b); this.tri(a, d, c2); } else { this.tri(a, b, c2); this.tri(a, c2, d); }
      }
    }
    return { start, end: this.count, ids };
  }

  // a rounded tube from a to b (radius ra -> rb), capped with half-spheres
  tube(a, b, ra, rb, color, skin, { seg = 12, rings = 6, squash = 1, soft = 0 } = {}) {
    const axis = b.clone().sub(a);
    const len = axis.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
    const start = this.count;
    const rows = [];
    // rings: cap at a (hemisphere), body, cap at b
    const prof = [];
    for (let i = 0; i <= 3; i++) { const t = (i / 3) * (Math.PI / 2); prof.push({ y: -Math.cos(t) * ra, r: Math.sin(t) * ra, t: 0 }); }
    for (let i = 1; i < rings; i++) { const t = i / rings; prof.push({ y: t * len, r: ra + (rb - ra) * t, t }); }
    for (let i = 3; i >= 0; i--) { const t = (i / 3) * (Math.PI / 2); prof.push({ y: len + Math.cos(t) * rb, r: Math.sin(t) * rb, t: 1 }); }
    for (const pr of prof) {
      const row = [];
      for (let j = 0; j <= seg; j++) {
        const th = (j / seg) * Math.PI * 2;
        const local = new THREE.Vector3(Math.cos(th) * pr.r, pr.y, Math.sin(th) * pr.r * squash);
        const p = local.clone().applyQuaternion(q).add(a);
        const dy = pr.y < 0 ? pr.y : pr.y > len ? pr.y - len : 0;
        const n = new THREE.Vector3(Math.cos(th) * pr.r, dy, Math.sin(th) * pr.r * squash).normalize().applyQuaternion(q);
        row.push(this.vertex(p, n, color, skin(Math.min(1, Math.max(0, pr.y / len)), p), soft));
      }
      rows.push(row);
    }
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a1 = rows[i][j], b1 = rows[i + 1][j], c1 = rows[i + 1][j + 1], d1 = rows[i][j + 1];
        this.tri(a1, c1, b1); this.tri(a1, d1, c1);
      }
    }
    return { start, end: this.count };
  }

  // one smooth tube through several joints (a whole leg or arm, no knobby joints).
  // Each stretch belongs to its bone and blends into the next one around the joint.
  chain(points, radii, bones, color, { seg = 14, perSeg = 6, squash = 1, soft = 0, colors = null } = {}) {
    const rows = [];
    let prevN = null;
    const total = points.length - 1;
    const ringAt = (p, dir, r, bonesW, col, sft, capY = 0) => {
      // a frame around the direction (parallel transport keeps it from twisting)
      let n = prevN ? prevN.clone().sub(dir.clone().multiplyScalar(prevN.dot(dir))).normalize() : new THREE.Vector3(0, 0, 1).cross(dir).normalize();
      if (n.lengthSq() < 0.5) n = new THREE.Vector3(1, 0, 0);
      prevN = n.clone();
      const bnorm = dir.clone().cross(n).normalize();
      const row = [];
      for (let j = 0; j <= seg; j++) {
        const th = (j / seg) * Math.PI * 2;
        const off = n.clone().multiplyScalar(Math.cos(th) * r).add(bnorm.clone().multiplyScalar(Math.sin(th) * r * squash));
        const pos = p.clone().add(off);
        const nor = off.clone().normalize().multiplyScalar(Math.sqrt(Math.max(0, 1 - capY * capY))).addScaledVector(dir, capY).normalize();
        row.push(this.vertex(pos, nor, col, bonesW, sft));
      }
      rows.push(row);
    };
    const colAt = (i) => (colors ? colors[i] : color);
    // start cap
    {
      const dir = points[1].clone().sub(points[0]).normalize();
      for (let k = 0; k < 3; k++) {
        const a = (1 - k / 3) * (Math.PI / 2);
        ringAt(points[0].clone().addScaledVector(dir, -Math.cos(a) * radii[0] * 0.8), dir, Math.sin(a) * radii[0] + 1e-4, [[bones[0], 1]], colAt(0), soft, -Math.cos(a));
      }
    }
    for (let i = 0; i < total; i++) {
      const a = points[i], b = points[i + 1];
      const dir = b.clone().sub(a).normalize();
      for (let k = 0; k < perSeg; k++) {
        const t = k / perSeg;
        const w = [[bones[i], 1]];
        if (i > 0 && t < 0.25) w.push([bones[i - 1], 0.5 * (1 - t / 0.25)]);
        if (i < total - 1 && t > 0.75) w.push([bones[i + 1], 0.5 * ((t - 0.75) / 0.25)]);
        // smooth radius through the joints
        const r = radii[i] + (radii[i + 1] - radii[i]) * (0.5 - 0.5 * Math.cos(Math.PI * t));
        ringAt(a.clone().lerp(b, t), dir, r, w, t < 0.5 ? colAt(i) : colAt(i + 1) ?? colAt(i), soft);
      }
    }
    // end cap
    {
      const last = points[total], dir = last.clone().sub(points[total - 1]).normalize();
      for (let k = 0; k <= 3; k++) {
        const a = (k / 3) * (Math.PI / 2);
        ringAt(last.clone().addScaledVector(dir, Math.sin(a) * radii[total] * 0.8), dir, Math.cos(a) * radii[total] + 1e-4, [[bones[total], 1]], colAt(total), soft, Math.sin(a));
      }
    }
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a1 = rows[i][j], b1 = rows[i + 1][j], c1 = rows[i + 1][j + 1], d1 = rows[i][j + 1];
        this.tri(a1, b1, c1); this.tri(a1, c1, d1);
      }
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('soft', new THREE.Float32BufferAttribute(this.soft, 1));
    // (the shapes above wind their triangles clockwise; three.js wants counter-clockwise
    // for the outside, so flip them all, or you'd see the inside of every head and arm)
    const idx = this.idx.slice();
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    const list = [];
    for (const [name, map] of this.morphs) {
      const arr = new Float32Array(this.pos.length);
      for (const [v, d] of map) arr.set(d, v * 3);
      const attr = new THREE.Float32BufferAttribute(arr, 3);
      attr.name = name;
      list.push(attr);
    }
    if (list.length) { g.morphAttributes.position = list; g.morphTargetsRelative = true; }
    g.computeBoundingSphere();
    return g;
  }
}

// ---- the person

export function buildToon(template, { seed = 'x', gender = 'm', job = '', style = 'jiggly' } = {}) {
  const S = STYLES[style] || STYLES.jiggly;
  const R = rng(seed);
  const pickR = (a) => a[Math.floor(R() * a.length)];
  const root = SkeletonUtils.clone(template);
  let orig = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !orig) orig = o; });
  const sk = orig.skeleton;
  const boneIndex = Object.fromEntries(sk.bones.map((b, i) => [b.name, i]));
  const J = (name) => (boneIndex[name] === undefined ? null : new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[boneIndex[name]].clone().invert()));
  const B = new Builder(boneIndex);
  const female = gender === 'f';

  // who they are
  const outfit = OUTFITS[job] || {
    shirt: pickR([0x3a6fb0, 0xb03a3a, 0x3a8a4a, 0xd8b04a, 0x7a4ab0, 0xe8e2d4, 0x2a2a2a, 0xe07a9a, 0x4ab0b0]),
    pants: pickR([0x2a3550, 0x3a3a3a, 0x5a4a32, 0x1e2a44, 0x6a6a72]),
    shoes: pickR([0x1a1a1a, 0x4a2e18, 0xeeeeee, 0x8a2a2a]),
    sleeves: pickR(['long', 'short', 'short']),
    skirt: female && R() < 0.45,
  };
  const skin = new THREE.Color(pickR(SKIN));
  const hairC = new THREE.Color(pickR(HAIR));
  const eyeC = new THREE.Color(pickR(EYES));
  const shirt = new THREE.Color(outfit.shirt), pants = new THREE.Color(outfit.pants), shoes = new THREE.Color(outfit.shoes);
  const lips = skin.clone().lerp(new THREE.Color(0xb0424a), female ? 0.45 : 0.25);
  const white = new THREE.Color(0xf7f5ef), dark = new THREE.Color(0x141010);
  const weight = 0.85 + R() * 0.45;           // thin .. chubby
  const belly = Math.max(0, weight - 1) * 1.6 + (R() < 0.3 ? 0.15 : 0);
  const girth = S.girth * weight;
  const hairStyle = female ? pickR(['long', 'long', 'bun', 'ponytail', 'short', 'curly']) : pickR(['short', 'short', 'buzz', 'bald', 'curly', 'short']);

  // ---- skinning helpers
  const one = (name) => () => [[name, 1]];
  // a limb owned by `bone`, blending into its parent at the start and its child at the end
  const limb = (bone, parent, child) => (t) => {
    const w = [[bone, 1]];
    if (parent && t < 0.18) w.push([parent, (1 - t / 0.18) * 0.5]);
    if (child && t > 0.82) w.push([child, ((t - 0.82) / 0.18) * 0.5]);
    return w;
  };

  // ---- legs and shoes: one smooth tube from the hip to the ankle
  for (const s of ['L', 'R']) {
    const hip = J(`Bip01_${s}_Thigh`), knee = J(`Bip01_${s}_Calf`), ankle = J(`Bip01_${s}_Foot`), toe = J(`Bip01_${s}_Toe0`);
    const legC = outfit.skirt ? skin : pants;
    const top = hip.clone().add(new THREE.Vector3(Math.sign(hip.x) * 0.01, 0.04, 0));
    B.chain([top, knee, ankle.clone().add(new THREE.Vector3(0, 0.02, 0))], [0.1 * girth, 0.068 * girth, 0.05 * S.girth], [`Bip01_${s}_Thigh`, `Bip01_${s}_Calf`, `Bip01_${s}_Foot`], legC, { soft: 0.3 });
    // shoe: a big soft rounded lump from the heel to past the toes
    const heel = ankle.clone().add(new THREE.Vector3(0, -0.055, -0.035));
    const tip = toe.clone().add(new THREE.Vector3(0, 0.035, 0.04));
    B.chain([heel, tip], [0.058, 0.06], [`Bip01_${s}_Foot`, `Bip01_${s}_Toe0`], shoes, { squash: 0.75, seg: 12, perSeg: 5 });
  }

  // ---- torso: soft rounded rings from the hips up to the shoulders (a bit of belly)
  const sw = female ? 0.95 : 1.05;  // shoulder width
  const torsoRings = [
    // y, half width, half depth, belly, chest
    [0.83, 0.15, 0.115, 0, 0], [0.9, 0.17, 0.13, 0, 0], [0.98, 0.172, 0.13, 0.3, 0], [1.06, 0.165, 0.13, 0.7, 0], [1.14, 0.165, 0.135, 1, 0],
    [1.22, 0.172, 0.135, 0.6, 0.4], [1.3, 0.185 * sw, 0.13, 0.2, 1], [1.38, 0.2 * sw, 0.12, 0, 0.6], [1.44, 0.19 * sw, 0.11, 0, 0], [1.49, 0.13, 0.085, 0, 0], [1.53, 0.065, 0.06, 0, 0],
  ];
  const torsoBone = (y) => {
    const spine = [['Bip01_Pelvis', 0.9], ['Bip01_Spine', 1.02], ['Bip01_Spine1', 1.17], ['Bip01_Spine2', 1.33], ['Bip01_Neck', 1.52]];
    if (y <= spine[0][1]) return [['Bip01_Pelvis', 1]];
    for (let i = 0; i < spine.length - 1; i++) {
      const [a, ya] = spine[i], [b, yb] = spine[i + 1];
      if (y <= yb) { const t = THREE.MathUtils.clamp((y - ya) / (yb - ya), 0, 1); return [[a, 1 - t], [b, t]]; }
    }
    return [['Bip01_Neck', 1]];
  };
  {
    const seg = 32;
    const rows = [];
    const waist = 0.97;
    // 4 smooth in-between rings per ring (Catmull-Rom), so stripes, belts and the
    // collar come out sharp instead of smeared across a big band
    const fine = [];
    for (let i = 0; i < torsoRings.length - 1; i++) {
      const p0 = torsoRings[Math.max(0, i - 1)], p1 = torsoRings[i], p2 = torsoRings[i + 1], p3 = torsoRings[Math.min(torsoRings.length - 1, i + 2)];
      for (let k = 0; k < 4; k++) {
        const t = k / 4, t2 = t * t, t3 = t2 * t;
        fine.push(p1.map((_, n) => 0.5 * (2 * p1[n] + (-p0[n] + p2[n]) * t + (2 * p0[n] - 5 * p1[n] + 4 * p2[n] - p3[n]) * t2 + (-p0[n] + 3 * p1[n] - 3 * p2[n] + p3[n]) * t3)));
      }
    }
    fine.push(torsoRings[torsoRings.length - 1]);
    for (const [y, rx0, rz0, bel, chest] of fine) {
      const rx = rx0 * girth, rz = rz0 * girth;
      const row = [];
      for (let j = 0; j <= seg; j++) {
        const th = (j / seg) * Math.PI * 2;
        const front = Math.max(0, Math.sin(th));
        // a soft superellipse (rounder than a box, fuller than an ellipse)
        const c = Math.cos(th), sn = Math.sin(th);
        const k = 2.6;
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / k), ez = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / k);
        const bulge = bel * belly * 0.09 * front * front + (female ? chest * 0.035 * front * front * Math.max(0, 1 - Math.abs(c) * 2.2) : 0);
        const p = new THREE.Vector3(ex * rx, y, ez * rz + bulge - 0.012);
        const n = new THREE.Vector3(ex / rx, 0, ez / rz).normalize();
        const softness = (bel * front * (0.4 + belly)) + (female ? chest * front * 0.5 : 0);
        let col = y < waist ? pants : shirt;
        if (outfit.skirt && y < waist) col = pants;
        if (y > 1.5) col = skin;
        if (outfit.tie && y > 1.04 && y < 1.47 && Math.abs(c) < 0.1 && front > 0.9) col = new THREE.Color(outfit.tie);
        if (outfit.apron && y > 0.86 && y < 1.32 && front > 0.55) col = new THREE.Color(outfit.apron).multiplyScalar(0.96);
        if (outfit.stripes && (Math.abs(y - 1.06) < 0.02 || Math.abs(y - 1.3) < 0.02)) col = new THREE.Color(outfit.stripes);
        if (outfit.badge && y > 1.27 && y < 1.36 && c > 0.22 && c < 0.48 && front > 0.7) col = new THREE.Color(0xd4b04a);
        if (Math.abs(y - waist) < 0.012 && !outfit.skirt) col = new THREE.Color(0x2a2018); // belt
        row.push(B.vertex(p, n, col, torsoBone(y), softness * S.soft));
      }
      rows.push(row);
    }
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < seg; j++) { const a = rows[i][j], b = rows[i + 1][j], c = rows[i + 1][j + 1], d = rows[i][j + 1]; B.tri(a, c, b); B.tri(a, d, c); }
    const bottom = B.vertex(new THREE.Vector3(0, 0.8, -0.012), new THREE.Vector3(0, -1, 0), pants, [['Bip01_Pelvis', 1]]);
    for (let j = 0; j < seg; j++) B.tri(rows[0][j + 1], rows[0][j], bottom);
    if (outfit.skirt) {
      // a skirt that flares out from the waist (outside and lining, so it isn't see-through from below)
      const top = 0.97, hem = 0.6, sseg = 24, srings = 6;
      const sk = [];
      for (const side of [1, -1]) {
        const rowsS = [];
        for (let i = 0; i <= srings; i++) {
          const t = i / srings, y = top + (hem - top) * t;
          const flare = 1 + t * t * 0.55;
          const rx = 0.172 * girth * flare + (side < 0 ? -0.004 : 0), rz = 0.138 * girth * flare + (side < 0 ? -0.004 : 0);
          const row = [];
          for (let j = 0; j <= sseg; j++) {
            const th = (j / sseg) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
            const p = new THREE.Vector3(c * rx, y, sn * rz - 0.012);
            const n = new THREE.Vector3(c / rx, 0.25, sn / rz).normalize().multiplyScalar(side);
            const legSide = c >= 0 ? 'L' : 'R';
            const w = t * 0.55 * Math.abs(c);   // the sides follow the legs a bit when walking
            const col = side > 0 ? (i === srings ? pants.clone().multiplyScalar(0.8) : pants) : pants.clone().multiplyScalar(0.55);
            row.push(B.vertex(p, n, col, [['Bip01_Pelvis', 1 - w], [`Bip01_${legSide}_Thigh`, w]], 0.35 * t * S.soft));
          }
          rowsS.push(row);
        }
        sk.push([rowsS, side]);
      }
      for (const [rowsS, side] of sk) for (let i = 0; i < srings; i++) for (let j = 0; j < sseg; j++) {
        const a = rowsS[i][j], b = rowsS[i + 1][j], c = rowsS[i + 1][j + 1], d = rowsS[i][j + 1];
        if (side > 0) { B.tri(a, c, b); B.tri(a, d, c); } else { B.tri(a, b, c); B.tri(a, c, d); }
      }
    }
  }

  // ---- arms (one smooth tube from inside the shoulder to the wrist) and mitten-ish hands
  for (const s of ['L', 'R']) {
    const cl = J(`Bip01_${s}_Clavicle`), sh = J(`Bip01_${s}_UpperArm`), el = J(`Bip01_${s}_Forearm`), wr = J(`Bip01_${s}_Hand`);
    const inShoulder = cl.clone().lerp(sh, 0.55).add(new THREE.Vector3(0, -0.02, 0));
    const lowerC = outfit.sleeves === 'short' || outfit.sleeves === 'rolled' ? skin : shirt;
    B.chain([inShoulder, sh, el, wr], [0.075 * girth, 0.068 * girth, 0.055 * girth, 0.042 * S.girth], [`Bip01_${s}_Clavicle`, `Bip01_${s}_UpperArm`, `Bip01_${s}_Forearm`, `Bip01_${s}_Hand`], shirt, { colors: [shirt, shirt, lowerC, outfit.sleeves === 'long' || !outfit.sleeves ? shirt : skin], soft: 0.2 });
    // palm: a soft paddle from the wrist to the knuckles
    const k1 = J(`Bip01_${s}_Finger1`), k4 = J(`Bip01_${s}_Finger4`);
    const knuckles = k1.clone().lerp(k4, 0.5);
    const palmC = wr.clone().lerp(knuckles, 0.6);
    const palmDir = knuckles.clone().sub(wr).normalize();
    const across = k1.clone().sub(k4).normalize();
    const palmQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, palmDir, across.clone().cross(palmDir).normalize()));
    B.ellipsoid(palmC, new THREE.Vector3(0.05, 0.058, 0.027).multiplyScalar(S.hand), skin, () => [[`Bip01_${s}_Hand`, 1]], { rot: palmQ, seg: 14, rings: 10 });
    // chunky fingers (they still bend with the finger bones, so hands grip)
    for (const f of [0, 1, 2, 3, 4]) {
      const base = `Bip01_${s}_Finger${f}`;
      const pts = [J(base), J(`${base}1`), J(`${base}2`)];
      const tipP = pts[2].clone().add(pts[2].clone().sub(pts[1]).multiplyScalar(0.6));
      const r = (f === 0 ? 0.015 : 0.0125) * S.hand;
      B.chain([pts[0], pts[1], pts[2], tipP], [r, r * 0.97, r * 0.93, r * 0.85], [base, `${base}1`, `${base}2`, `${base}2`], skin, { seg: 8, perSeg: 2 });
    }
  }

  // ---- neck and head
  const neck = J('Bip01_Neck'), headJ = J('Bip01_Head');
  B.tube(neck.clone().add(new THREE.Vector3(0, -0.01, 0)), headJ.clone().add(new THREE.Vector3(0, 0.03, 0.01)), 0.058 * Math.sqrt(girth), 0.055, skin, (t) => [['Bip01_Neck', 1 - t * 0.5], ['Bip01_Head', t * 0.5]]);
  // the head grows upward from the neck (bigger heads look friendlier and goofier)
  const H = S.head;
  const hc = new THREE.Vector3(0, 1.672 + (H - 1) * 0.105, 0.03);   // head center
  const hr = new THREE.Vector3(0.1 * H * (0.96 + weight * 0.05), 0.115 * H, 0.108 * H);
  const faceFront = (l) => l.z;
  // (the whole face is on the head bone: the small face bones aren't posed the same in the
  // file as in the bind pose, so anything weighted to them gets dragged out of place)
  const blush = skin.clone().lerp(new THREE.Color(0xe8746a), 0.35 * Math.min(1, skin.getHSL({}).l * 1.6) ** 2); // (faint on darker skin)
  const head = B.ellipsoid(hc, hr, (l) => (l.z > 0.55 && Math.abs(l.x) > 0.38 && Math.abs(l.x) < 0.7 && l.y < -0.05 && l.y > -0.42 ? blush : skin), one('Bip01_Head'), { seg: 24, rings: 18, soft: (l) => Math.max(0, l.z) * THREE.MathUtils.clamp(-l.y, 0, 1) * 0.6 * S.soft });
  // ears
  for (const sx of [-1, 1]) B.ellipsoid(new THREE.Vector3(sx * hr.x * 0.98, hc.y - 0.005, hc.z - 0.01), new THREE.Vector3(0.012, 0.028, 0.02).multiplyScalar(H), skin, one('Bip01_Head'), { seg: 8, rings: 6 });
  // nose
  const noseP = new THREE.Vector3(0, hc.y - 0.028 * H, hc.z + hr.z * 0.97);
  B.ellipsoid(noseP, new THREE.Vector3(0.014, 0.018, 0.016).multiplyScalar(H * (0.85 + R() * 0.4)), skin.clone().lerp(new THREE.Color(0xd0806a), 0.15), one('Bip01_Head'), { seg: 10, rings: 8 });

  // eyes: white ball, colored iris, black pupil, skin lid that blinks; they turn with the eye bones
  const eyeR = 0.017 * S.eye * Math.min(1.25, H);
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const ec = new THREE.Vector3(sx * 0.034 * H, hc.y + 0.008 * H, hc.z + hr.z * 0.86 - eyeR * 0.35);
    const eb = `Bip01_${s}Eye`;
    B.ellipsoid(ec, new THREE.Vector3(eyeR, eyeR, eyeR), (l) => (l.z > 0.93 ? dark : l.z > 0.8 ? eyeC : white), one('Bip01_Head'), { seg: 16, rings: 12 });
    // the upper lid: a shell just outside the eye covering its top; blinking rotates it down over the eye
    // (open, it just touches the top of the iris: awake, not sleepy)
    const lidR = eyeR * 1.16;
    const lid = B.ellipsoid(ec, new THREE.Vector3(lidR, lidR, lidR), skin.clone().multiplyScalar(0.97), one('Bip01_Head'), { seg: 16, rings: 16, cut: (l) => l.y > 0.45 });
    const blink = `AK_${s === 'L' ? '09_EyeBlinkLeft' : '10_EyeBlinkRight'}`;
    const wide = `AK_${s === 'L' ? '21_EyeWideLeft' : '22_EyeWideRight'}`;
    const squint = `AK_${s === 'L' ? '19_EyeSquintLeft' : '20_EyeSquintRight'}`;
    const rotate = (ang) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), ang);
    for (let v = lid.start; v < lid.end; v++) {
      const p = new THREE.Vector3(B.pos[v * 3], B.pos[v * 3 + 1], B.pos[v * 3 + 2]).sub(ec);
      const d = (q) => p.clone().applyQuaternion(q).sub(p).toArray();
      B.morph(blink, v, d(rotate(1.12)));
      B.morph(squint, v, d(rotate(0.4)));
      B.morph(wide, v, d(rotate(-0.3)));
    }
    // brow: a soft dark bar above the eye
    const browC = new THREE.Vector3(sx * 0.036 * H, ec.y + eyeR + 0.012 * H, hc.z + hr.z * 0.88);
    const brow = B.ellipsoid(browC, new THREE.Vector3(0.024 * H, 0.0055 * H, 0.008), hairC.clone().multiplyScalar(0.8), one('Bip01_Head'), { seg: 10, rings: 5, rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, sx * -0.08)) });
    const inner = `AK_03_BrowInnerUp`, down = `AK_${s === 'L' ? '01_BrowDownLeft' : '02_BrowDownRight'}`, outer = `AK_${s === 'L' ? '04_BrowOuterUpLeft' : '05_BrowOuterUpRight'}`;
    for (let v = brow.start; v < brow.end; v++) {
      const x = B.pos[v * 3] - browC.x;
      const toInner = THREE.MathUtils.clamp(0.5 - (x * sx) / (0.048 * H), 0, 1); // 1 at the inner end
      B.morph(inner, v, [0, 0.012 * H * toInner, 0]);
      B.morph(down, v, [0, -0.008 * H * (0.4 + toInner * 0.6), 0.002]);
      B.morph(outer, v, [0, 0.01 * H * (1 - toInner), 0]);
    }
  }

  // mouth: dark inside with lips around; smiles, frowns, opens, stretches
  {
    const mc = new THREE.Vector3(0, hc.y - 0.06 * H, hc.z + hr.z * 0.9);
    const mw = 0.03 * H * (female ? 0.95 : 1.05), mh = 0.006 * H;
    const mouth = B.ellipsoid(mc, new THREE.Vector3(mw, mh, 0.01), (l) => (Math.abs(l.y) > 0.55 ? lips : dark), one('Bip01_Head'), { seg: 16, rings: 8 });
    for (let v = mouth.start; v < mouth.end; v++) {
      const x = (B.pos[v * 3] - mc.x) / mw, y = (B.pos[v * 3 + 1] - mc.y) / mh;
      const side = x > 0 ? 'L' : 'R';
      const corner = Math.max(0, Math.abs(x) - 0.3) / 0.7;
      const lower = y < 0 ? 1 : 0;
      B.morph(`AK_${side === 'L' ? '44_MouthSmileLeft' : '45_MouthSmileRight'}`, v, [x * 0.004 * H, corner * corner * 0.012 * H, 0]);
      B.morph(`AK_${side === 'L' ? '30_MouthFrownLeft' : '31_MouthFrownRight'}`, v, [0, -corner * corner * 0.01 * H, 0]);
      B.morph(`AK_${side === 'L' ? '46_MouthStretchLeft' : '47_MouthStretchRight'}`, v, [x * 0.008 * H, 0, 0]);
      B.morph('AK_25_JawOpen', v, [0, -lower * (1 - Math.abs(x) * 0.6) * 0.03 * H, 0]);
    }
    // resting face: a small friendly smile, and the mouth follows the curve of the face
    for (let v = mouth.start; v < mouth.end; v++) {
      const x = (B.pos[v * 3] - mc.x) / mw;
      B.pos[v * 3 + 1] += x * x * 0.0045 * H;
      B.pos[v * 3 + 2] -= x * x * 0.006 * H;
    }
  }

  // ---- hair (on the head bone; moves with the head)
  const hairCap = (top = 1.04, lowBack = -0.1, lowFront = 0.45, puff = 1.05) => B.ellipsoid(hc.clone().add(new THREE.Vector3(0, 0.006, -0.004)), hr.clone().multiply(new THREE.Vector3(puff * top, puff * top, puff * top)), hairC, one('Bip01_Head'), {
    seg: 22, rings: 14, cut: (l) => l.y > (l.z > 0 ? lowFront : lowBack) - (l.z < 0 ? 0 : 0),
  });
  if (hairStyle === 'short') hairCap(1.04, 0.05, 0.5);
  else if (hairStyle === 'buzz') hairCap(1.015, -0.1, 0.55, 1.0);
  else if (hairStyle === 'curly') {
    hairCap(1.06, -0.05, 0.45, 1.06);
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, e = 0.2 + R() * 0.8;
      const l = new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - e * e), e, Math.sin(a) * Math.sqrt(1 - e * e));
      if (l.z > 0.55 && l.y < 0.75) continue;
      B.ellipsoid(hc.clone().add(l.clone().multiply(hr).multiplyScalar(1.08)), new THREE.Vector3(1, 1, 1).multiplyScalar(0.028 * H), hairC, one('Bip01_Head'), { seg: 8, rings: 6 });
    }
  } else if (hairStyle === 'long' || hairStyle === 'ponytail' || hairStyle === 'bun') {
    hairCap(1.05, -0.4, 0.5);
    if (hairStyle === 'long') {
      // a curtain of hair down the back to the shoulders (soft: it sways)
      B.ellipsoid(hc.clone().add(new THREE.Vector3(0, -0.11 * H, -0.04 * H)), new THREE.Vector3(hr.x * 1.08, 0.15 * H, hr.z * 0.75), hairC, (l) => [['Bip01_Head', 0.7 + l.y * 0.3], ['Bip01_Neck', 0.3 - l.y * 0.3]], { seg: 18, rings: 10, cut: (l) => l.z < 0.35, soft: (l) => Math.max(0, -l.y) * 0.6 });
    } else if (hairStyle === 'ponytail') {
      const tieP = hc.clone().add(new THREE.Vector3(0, 0.03 * H, -hr.z * 1.0));
      B.tube(tieP, tieP.clone().add(new THREE.Vector3(0, -0.16 * H, -0.05)), 0.028 * H, 0.012 * H, hairC, () => [['Bip01_Head', 1]], { seg: 8, rings: 4, soft: 0.7 });
    } else {
      B.ellipsoid(hc.clone().add(new THREE.Vector3(0, 0.08 * H, -0.07 * H)), new THREE.Vector3(0.045, 0.04, 0.045).multiplyScalar(H), hairC, one('Bip01_Head'), { seg: 12, rings: 8 });
    }
  }

  // ---- hats that go with the job
  const hat = outfit.hat;
  if (hat) {
    const top = hc.clone().add(new THREE.Vector3(0, hr.y * 0.72, -0.005));
    if (hat === 'police' || hat.startsWith('cap')) {
      const c = new THREE.Color(hat === 'police' ? 0x1c2438 : hat === 'cap-brown' ? 0x6a4422 : 0x3f6a2e);
      B.ellipsoid(top, new THREE.Vector3(hr.x * 1.08, hr.y * 0.42, hr.z * 1.08), c, one('Bip01_Head'), { seg: 18, rings: 8, cut: (l) => l.y > -0.05 });
      B.ellipsoid(top.clone().add(new THREE.Vector3(0, -0.005, hr.z * 0.9)), new THREE.Vector3(hr.x * 0.85, 0.008, hr.z * 0.55), hat === 'police' ? new THREE.Color(0x111111) : c, one('Bip01_Head'), { seg: 14, rings: 4, cut: (l) => l.z > -0.1 });
      if (hat === 'police') B.ellipsoid(top.clone().add(new THREE.Vector3(0, 0.02, hr.z * 1.04)), new THREE.Vector3(0.016, 0.018, 0.005), new THREE.Color(0xd4b04a), one('Bip01_Head'), { seg: 8, rings: 6 });
    } else if (hat === 'chef') {
      B.tube(top.clone().add(new THREE.Vector3(0, -0.01, 0)), top.clone().add(new THREE.Vector3(0, 0.12 * H, 0)), hr.x * 0.95, hr.x * 1.25, new THREE.Color(0xfafafa), one('Bip01_Head'), { seg: 16, rings: 3 });
    } else if (hat.startsWith('helmet')) {
      B.ellipsoid(top.clone().add(new THREE.Vector3(0, -0.02, 0)), hr.clone().multiplyScalar(1.12).setY(hr.y * 0.75), new THREE.Color(hat === 'helmet-red' ? 0xc0291a : 0xf2c21a), one('Bip01_Head'), { seg: 18, rings: 8, cut: (l) => l.y > -0.15 });
    }
  }

  // ---- the mesh
  const geo = B.geometry();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  mat.name = 'toon_body';
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'toon';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  orig.parent.add(mesh);
  mesh.bind(sk, orig.bindMatrix);
  // the scanned meshes go (we only kept their skeleton)
  const old = [];
  root.traverse((o) => { if (o.isSkinnedMesh && o !== mesh) old.push(o); });
  for (const o of old) o.removeFromParent();
  root.userData.toon = { style, hairStyle, seed: String(seed) };
  return root;
}
