// Skeleton construction. Chunky cartoon proportions: the head is ~1/5.4 of the height, hands are
// oversized, limbs short and thick. Joint positions are derived from the body sliders, then a
// THREE.Bone hierarchy is created in a relaxed A-pose (arms ~52° down).
//
// Bone axis convention (used by every animation routine): local +Y points along the bone toward
// its child, local +Z is the bone's "front" reference (world forward for spine/limbs, palm normal
// for hands and fingers, world up for feet), local X = Y × Z. So for every limb a positive
// rotation about local X swings the child toward +Z: hip flexion, elbow flexion, finger curl,
// toe-up, jaw open (chin down/back) and eyes looking down are all `+X` rotations.

import * as THREE from 'three';
import { faceLayout, findEyes, faceBonePositions, HEAD_UNIT, JAW_BIND_OPEN } from './headsculpt.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const FINGERS = ['index', 'middle', 'ring', 'pinky'];

// Canonical left-hand layout (meters, before scaling). Frame: x = palm normal, y = toward fingers,
// z = thumb side. Spread angle (deg) fans the fingers; curl (deg) per joint gives a relaxed rest.
export const HAND = {
  palm: { cy: 0.05, half: [0.021, 0.05, 0.046] },
  fingers: {
    index: { base: [-0.001, 0.094, 0.03], len: [0.04, 0.025, 0.02], r: 0.0114, spread: 6 },
    middle: { base: [-0.002, 0.097, 0.0102], len: [0.044, 0.028, 0.021], r: 0.0118, spread: 1.5 },
    ring: { base: [-0.002, 0.094, -0.0094], len: [0.041, 0.026, 0.02], r: 0.011, spread: -4 },
    pinky: { base: [0.0, 0.086, -0.0275], len: [0.032, 0.02, 0.017], r: 0.0099, spread: -10 },
  },
  thumb: { base: [0.012, 0.018, 0.03], dir: [0.42, 0.55, 0.72], len: [0.044, 0.032, 0.026], r: 0.0128 },
  curl: 9,
};

/**
 * Compute bind-pose joint positions (world space, feet at y=0, facing +Z, left = +X).
 */
export function computeJoints(p) {
  const H = p.height;
  const s = H / 1.75;
  const fat = p.fat;
  const mus = p.muscle;
  const old = Math.max(0, (p.age - 45) / 45);
  const headH = H / 5.5;
  const chinY = H - headH;
  const hipY = (0.462 + 0.05 * (p.legs - 0.5)) * H;
  const ankleY = 0.085 * s;
  const kneeY = ankleY + (hipY - ankleY) * 0.49;
  const shoulderY = chinY - 0.072 * s;
  const shoulderHalf = (0.165 + 0.055 * p.shoulders + 0.015 * mus + 0.012 * fat) * s;
  const hipHalf = (0.083 + 0.022 * p.hips + 0.022 * fat) * s;
  const j = {};
  j.root = V(0, 0, 0);
  j.hips = V(0, hipY + 0.05 * s, -0.01 * s);
  j.spine = V(0, hipY + 0.15 * s, -0.015 * s);
  j.chest = V(0, hipY + 0.29 * s, -0.02 * s);
  j.neck = V(0, shoulderY + 0.03 * s, -0.025 * s - old * 0.02 * s);
  j.head = V(0, chinY + 0.035 * s, -0.02 * s - old * 0.015 * s);
  j.headTop = V(0, H, -0.01 * s);
  // Head center: origin of head-mesh space.
  j.headCenter = V(0, chinY + headH * 0.5, 0.0);
  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    j[`clavicle.${side}`] = V(sx * 0.025 * s, shoulderY + 0.005 * s, 0.015 * s);
    const sh = V(sx * shoulderHalf, shoulderY - 0.03 * s, -0.012 * s);
    j[`upperarm.${side}`] = sh;
    // A-pose: arms 52° below horizontal, a touch forward. Heavier bodies hold arms further out.
    const a = THREE.MathUtils.degToRad(52 - fat * 8);
    const dir = V(sx * Math.cos(a), -Math.sin(a), 0.07).normalize();
    const upperLen = 0.255 * s;
    const foreLen = 0.22 * s;
    j[`forearm.${side}`] = sh.clone().addScaledVector(dir, upperLen);
    j[`hand.${side}`] = j[`forearm.${side}`].clone().addScaledVector(dir, foreLen);
    j[`armDir.${side}`] = dir;
    const hip = V(sx * hipHalf, hipY, 0);
    j[`thigh.${side}`] = hip;
    j[`shin.${side}`] = V(sx * hipHalf * 0.93, kneeY, 0.012 * s);
    j[`foot.${side}`] = V(sx * hipHalf * 0.9, ankleY, -0.005 * s);
    j[`toe.${side}`] = V(sx * hipHalf * 0.95, 0.032 * s, 0.135 * s);
    j[`toeTip.${side}`] = V(sx * hipHalf * 0.97, 0.03 * s, 0.205 * s);
    j[`heel.${side}`] = V(sx * hipHalf * 0.9, 0.03 * s, -0.06 * s);
  }
  return { j, s, H, headH, chinY, hipY, kneeY, ankleY, shoulderY, shoulderHalf, hipHalf, handScale: s * (1.1 + 0.28 * p.handSize) };
}

// Orthonormal basis quaternion from a bone direction (Y) and a front reference (Z).
function basisQuat(yDir, zRef) {
  const y = yDir.clone().normalize();
  let z = zRef.clone().addScaledVector(y, -zRef.dot(y));
  if (z.lengthSq() < 1e-8) z = Math.abs(y.y) < 0.9 ? V(0, 1, 0) : V(0, 0, 1);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  z.crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

/** Hand frame vectors for a side (world space): Y along hand, Z forward, P palm normal. */
export function handFrame(dims, side) {
  const dir = dims.j[`armDir.${side}`].clone();
  const z = V(0, 0, 1).addScaledVector(dir, -dir.z).normalize();
  const x = new THREE.Vector3().crossVectors(dir, z).normalize();
  const palm = side === 'L' ? x.clone() : x.clone().negate();
  return { origin: dims.j[`hand.${side}`].clone(), y: dir, z, palm };
}

// Canonical hand coordinate (palm, along, thumb) → world point.
export function handToWorld(frame, scale, c, out = new THREE.Vector3()) {
  return out
    .copy(frame.origin)
    .addScaledVector(frame.palm, c[0] * scale)
    .addScaledVector(frame.y, c[1] * scale)
    .addScaledVector(frame.z, c[2] * scale);
}

/** Finger joint chains in canonical hand space: name → array of 4 points (3 bones + tip). */
export function fingerChains() {
  const chains = {};
  const rot = (v, axis, deg) => v.clone().applyAxisAngle(axis, THREE.MathUtils.degToRad(deg));
  const X = V(1, 0, 0);
  const Z = V(0, 0, 1);
  for (const f of FINGERS) {
    const d = HAND.fingers[f];
    // Spread rotates the finger direction toward the thumb side (z); curl bends toward the palm (+x).
    const sp = THREE.MathUtils.degToRad(d.spread);
    let dir = V(0, Math.cos(sp), Math.sin(sp));
    const pts = [V(...d.base)];
    for (let i = 0; i < 3; i++) {
      // Curl axis: perpendicular to finger dir within the hand plane.
      const axis = new THREE.Vector3().crossVectors(dir, X).normalize();
      dir = rot(dir, axis, HAND.curl * (i === 0 ? 0.6 : 1));
      pts.push(pts[i].clone().addScaledVector(dir, d.len[i]));
    }
    chains[f] = pts;
  }
  const t = HAND.thumb;
  let dir = V(...t.dir).normalize();
  const pts = [V(...t.base)];
  for (let i = 0; i < 3; i++) {
    pts.push(pts[i].clone().addScaledVector(dir, t.len[i]));
    // Thumb bends toward the palm/fingers as it goes.
    dir = rot(dir, Z, i === 0 ? 4 : 10).add(V(0.06, 0.04, -0.12)).normalize();
  }
  chains.thumb = pts;
  return chains;
}

/**
 * Create the bone hierarchy. Returns { bones, byName, skeleton, dims, rest } where rest holds bind
 * local quaternions/positions for every bone (animation composes on top of them).
 */
export function buildRig(params) {
  const dims = computeJoints(params);
  const { j } = dims;
  const fwd = V(0, 0, 1);
  const up = V(0, 1, 0);
  const defs = []; // [name, parent, worldPos, worldQuat]
  const add = (name, parent, pos, tail, zRef = fwd) => {
    defs.push([name, parent, pos.clone(), basisQuat(tail.clone().sub(pos), zRef)]);
  };
  add('root', null, j.root, V(0, 1, 0));
  add('hips', 'root', j.hips, j.spine);
  add('spine', 'hips', j.spine, j.chest);
  add('chest', 'spine', j.chest, j.neck);
  add('neck', 'chest', j.neck, j.head);
  add('head', 'neck', j.head, j.headTop);
  // Face bones: placed from the facial layout (head space → world bind space). They all use the
  // world-aligned basis, so their local axes are x = left, y = up, z = forward.
  const L = faceLayout(params);
  findEyes(params, L);
  const hsc = dims.headH / HEAD_UNIT;
  const toW = (h) => V(j.headCenter.x + h[0] * hsc, j.headCenter.y + h[1] * hsc, j.headCenter.z + h[2] * hsc);
  const ID = new THREE.Quaternion();
  const FB = faceBonePositions(L);
  defs.push(['jaw', 'head', toW(FB.jaw), ID.clone()]);
  defs.push(['tongue', 'jaw', toW([0, L.mouthY - 0.012, 0.06]), ID.clone()]);
  defs.push(['lip.U', 'head', toW(FB['lip.U']), ID.clone()]);
  defs.push(['lip.D', 'jaw', toW(FB['lip.D']), ID.clone()]);
  defs.push(['nose', 'head', toW(FB.nose), ID.clone()]);
  for (const side of ['L', 'R']) {
    const e = L.eyes[side === 'L' ? 0 : 1];
    const ec = toW([e.c.x, e.c.y, e.c.z]);
    defs.push([`eye.${side}`, 'head', ec, ID.clone()]);
    defs.push([`lidU.${side}`, 'head', ec.clone(), ID.clone()]);
    defs.push([`lidD.${side}`, 'head', ec.clone(), ID.clone()]);
    for (const n of ['corner', 'cheek', 'brow.in', 'brow.out']) defs.push([`${n}.${side}`, 'head', toW(FB[`${n}.${side}`]), ID.clone()]);
  }
  dims.L = L;
  dims.hsc = hsc;
  dims.headToWorld = toW;
  // Soft-tissue jiggle bones (translation springs; see anim/jiggle.js).
  const ys = dims.s;
  defs.push(['belly', 'spine', V(0, j.spine.y - 0.03 * ys, 0.09 * ys), basisQuat(up, fwd)]);
  defs.push(['breast.L', 'chest', V(0.075 * ys, j.chest.y - 0.02 * ys, 0.1 * ys), basisQuat(up, fwd)]);
  defs.push(['breast.R', 'chest', V(-0.075 * ys, j.chest.y - 0.02 * ys, 0.1 * ys), basisQuat(up, fwd)]);
  defs.push(['butt.L', 'hips', V(0.07 * ys, j.hips.y - 0.06 * ys, -0.09 * ys), basisQuat(up, fwd)]);
  defs.push(['butt.R', 'hips', V(-0.07 * ys, j.hips.y - 0.06 * ys, -0.09 * ys), basisQuat(up, fwd)]);

  const chains = fingerChains();
  for (const side of ['L', 'R']) {
    add(`clavicle.${side}`, 'chest', j[`clavicle.${side}`], j[`upperarm.${side}`]);
    add(`upperarm.${side}`, `clavicle.${side}`, j[`upperarm.${side}`], j[`forearm.${side}`]);
    add(`forearm.${side}`, `upperarm.${side}`, j[`forearm.${side}`], j[`hand.${side}`]);
    const hf = handFrame(dims, side);
    const hs = dims.handScale;
    const midBase = handToWorld(hf, hs, HAND.fingers.middle.base);
    add(`hand.${side}`, `forearm.${side}`, j[`hand.${side}`], midBase, hf.palm);
    defs.push([`upperarmFat.${side}`, `upperarm.${side}`, j[`upperarm.${side}`].clone().lerp(j[`forearm.${side}`], 0.5), defs[defs.length - 3][3].clone()]);
    for (const f of [...FINGERS, 'thumb']) {
      const pts = chains[f].map((c) => handToWorld(hf, hs, [c.x, c.y, c.z]));
      let parent = `hand.${side}`;
      for (let i = 0; i < 3; i++) {
        const name = `${f}${i + 1}.${side}`;
        add(name, parent, pts[i], pts[i + 1], hf.palm);
        parent = name;
      }
      j[`${f}Tip.${side}`] = pts[3];
    }
    add(`thigh.${side}`, 'hips', j[`thigh.${side}`], j[`shin.${side}`]);
    add(`shin.${side}`, `thigh.${side}`, j[`shin.${side}`], j[`foot.${side}`]);
    add(`foot.${side}`, `shin.${side}`, j[`foot.${side}`], j[`toe.${side}`], up);
    add(`toe.${side}`, `foot.${side}`, j[`toe.${side}`], j[`toeTip.${side}`], up);
  }

  const bones = [];
  const byName = {};
  const worldQ = {};
  const worldP = {};
  const rest = {};
  for (const [name, parent, pos, q] of defs) {
    const b = new THREE.Bone();
    b.name = name;
    worldQ[name] = q;
    worldP[name] = pos;
    if (parent) {
      const pq = worldQ[parent];
      const pinv = pq.clone().invert();
      b.position.copy(pos).sub(worldP[parent]).applyQuaternion(pinv);
      b.quaternion.copy(pinv.multiply(q));
      byName[parent].add(b);
    } else {
      b.position.copy(pos);
      b.quaternion.copy(q);
    }
    rest[name] = { q: b.quaternion.clone(), p: b.position.clone() };
    byName[name] = b;
    bones.push(b);
  }
  const boneIndex = new Map(bones.map((b, i) => [b.name, i]));
  // The mouth is sculpted slightly open; the jaw's rest pose closes it.
  rest.jaw.q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -JAW_BIND_OPEN));
  return { bones, byName, boneIndex, dims, rest, worldQ, worldP };
}

/** Re-place a bone in world bind space (used to move eye bones before binding). */
export function setBoneWorld(rig, name, pos) {
  const b = rig.byName[name];
  const parent = b.parent;
  const pq = rig.worldQ[parent.name].clone().invert();
  b.position.copy(pos).sub(rig.worldP[parent.name]).applyQuaternion(pq);
  rig.worldP[name] = pos.clone();
  rig.rest[name].p.copy(b.position);
}

/** Add a chain of bones (hair guides, cloth) under `parentName` from world-space points. */
export function addChain(rig, prefix, parentName, points, zRef = new THREE.Vector3(0, 0, 1)) {
  const names = [];
  let parent = parentName;
  for (let i = 0; i < points.length - 1; i++) {
    const name = `${prefix}${i}`;
    const q = basisQuat(points[i + 1].clone().sub(points[i]), zRef);
    const b = new THREE.Bone();
    b.name = name;
    const pq = rig.worldQ[parent].clone().invert();
    b.position.copy(points[i]).sub(rig.worldP[parent]).applyQuaternion(pq);
    b.quaternion.copy(pq.multiply(q));
    rig.byName[parent].add(b);
    rig.byName[name] = b;
    rig.worldQ[name] = q;
    rig.worldP[name] = points[i].clone();
    rig.rest[name] = { q: b.quaternion.clone(), p: b.position.clone(), len: points[i + 1].distanceTo(points[i]) };
    rig.boneIndex.set(name, rig.bones.length);
    rig.bones.push(b);
    names.push(name);
    parent = name;
  }
  return names;
}

export { basisQuat };
