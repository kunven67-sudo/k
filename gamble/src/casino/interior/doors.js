// Real entrance doors: tall bronze-framed glass leaves in pairs, hinged at the outer jambs and
// double-acting (they swing either way, like busy casino doors with floor closers).
//
// You can drag a leaf (interact 'hinge' kind, DESIGN §39), press E to push it open away from you,
// or simply walk into it: the leaf in front of you swings away in the direction you're walking
// and the closer brings it back once you're clear. Every leaf has a box collider that follows it,
// so a closed door blocks and an open one doesn't — never an invisible wall or a gap.
//
// All leaves share two InstancedMeshes (frame + glass) → 2 draw calls for every door in the
// building; a leaf's instance matrix is only rewritten while it moves.
//
//   const doors = new DoorSet({ physics, mats });
//   doors.addOpening({ id, p0, p1, inward, y0, height, pairs });   // world points on the hinge line
//   doors.build(group)  → doors.interactables
//   doors.update(dt, playerPos)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { worldUV } from '../../gfx/geom.js';
import { audio } from '../../core/audio.js';
import { t } from '../../core/i18n.js';
import { clamp } from '../../core/util.js';

const UP = new THREE.Vector3(0, 1, 0);
const LEAF_T = 0.055;
const OPEN = 1.32; // radians a walked-through leaf swings to
const _m = new THREE.Matrix4();
const _s = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _sc = new THREE.Vector3();

function leafGeometries(H) {
  // Unit-width leaf in hinge space: x 0..1 (scaled per instance), y 0..H, z centred.
  const frame = [];
  const glass = [];
  const box = (w, h, d, x, y, z, list = frame) => list.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  box(0.085, H, LEAF_T, 0.0425, H / 2, 0); // hinge stile
  box(0.085, H, LEAF_T, 1 - 0.0425, H / 2, 0); // lock stile
  box(1, 0.13, LEAF_T, 0.5, H - 0.065, 0); // top rail
  box(1, 0.28, LEAF_T, 0.5, 0.14, 0); // kick rail
  box(1, 0.02, LEAF_T + 0.01, 0.5, 0.29, 0); // bead over the kick rail
  // Glass stop beads around the light.
  box(0.83, 0.018, 0.012, 0.5, H - 0.139, LEAF_T / 2 - 0.004);
  box(0.83, 0.018, 0.012, 0.5, H - 0.139, -LEAF_T / 2 + 0.004);
  // Pull handles on both faces: vertical bar on two standoffs, near the free edge.
  for (const s of [1, -1]) {
    const bar = new THREE.CylinderGeometry(0.017, 0.017, 1.15, 12).translate(0.84, 1.12, s * 0.085);
    frame.push(bar);
    for (const y of [0.62, 1.62]) frame.push(new THREE.CylinderGeometry(0.011, 0.011, 0.06, 8).rotateX(Math.PI / 2).translate(0.84, y, s * 0.055));
  }
  glass.push(new THREE.BoxGeometry(0.83, H - 0.43, 0.012).translate(0.5, 0.29 + (H - 0.43) / 2, 0));
  const prep = (gs) => {
    const g = mergeGeometries(gs.map((x) => (x.index ? x.toNonIndexed() : x)), false);
    worldUV(g, 0.5);
    return g;
  };
  return { frame: prep(frame), glass: prep(glass) };
}

export class DoorSet {
  constructor({ physics, mats, height = 3.12 }) {
    this.physics = physics;
    this.M = mats;
    this.H = height;
    this.leaves = [];
    this.openings = [];
    this.interactables = [];
    this.statics = []; // { geo, mat } jambs / heads / posts / thresholds (world space)
    this.colliders = []; // [cx, cy, cz, sx, sy, sz, yaw] fixed parts
  }

  /**
   * One doorway. p0/p1: world points (feet level) at each end of the hinge line, mid-wall.
   * inward: world normal into the building. pairs: number of door pairs side by side.
   */
  addOpening({ id, p0, p1, inward, y0, height, pairs = 1, depth = 0.4 }) {
    let a = p0.clone();
    let b = p1.clone();
    const along = b.clone().sub(a).setY(0).normalize();
    // Local frame: x along the opening, y up, z = x × y must point inward.
    if (new THREE.Vector3().crossVectors(along, UP).dot(inward) < 0) {
      [a, b] = [b, a];
      along.negate();
    }
    const W = a.distanceTo(b);
    const H = height ?? this.H;
    const basis = new THREE.Matrix4().makeBasis(along, UP, new THREE.Vector3().crossVectors(along, UP));
    const rot = new THREE.Quaternion().setFromRotationMatrix(basis);
    const yaw = Math.atan2(along.z, along.x);
    const jamb = 0.075;
    const post = 0.12;
    const inner = W - 2 * jamb - (pairs - 1) * post;
    const leafW = inner / (pairs * 2) - 0.004;
    const local = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(rot).add(a);
    // Frame parts (bronze): jambs, head with a transom bar, mullion posts, brass threshold.
    const add = (lx, ly, lz, sx, sy, sz, m, collide = true) => {
      const g = new THREE.BoxGeometry(sx, sy, sz);
      g.applyQuaternion(rot);
      const c = local(lx, ly, lz);
      g.translate(c.x, c.y, c.z);
      this.statics.push({ geo: g, mat: m });
      if (collide) this.colliders.push([c.x, c.y, c.z, sx, sy, sz, rot.clone()]);
    };
    const top = y0 + H;
    add(jamb / 2, y0 + H / 2 + 0.05, 0, jamb, H + 0.1, depth + 0.02, this.M.bronzeFrame);
    add(W - jamb / 2, y0 + H / 2 + 0.05, 0, jamb, H + 0.1, depth + 0.02, this.M.bronzeFrame);
    add(W / 2, top + 0.06, 0, W, 0.12, depth + 0.02, this.M.bronzeFrame, false);
    for (let k = 1; k < pairs; k++) {
      const x = jamb + k * (inner / pairs) + (k - 0.5) * post;
      add(x, y0 + H / 2, 0, post, H, 0.14, this.M.bronzeFrame);
    }
    add(W / 2, y0 + 0.008, 0, W, 0.016, depth + 0.1, this.M.brass, false);
    // Leaves.
    const opening = { id, a, along, rot, yaw, W, y0, H, leaves: [] };
    for (let p = 0; p < pairs; p++) {
      const x0 = jamb + p * (inner / pairs + post);
      const x1 = x0 + inner / pairs;
      for (const side of [0, 1]) {
        const hingeX = side === 0 ? x0 + 0.002 : x1 - 0.002;
        const pivot = new THREE.Object3D();
        pivot.position.copy(local(hingeX, y0 + 0.012, 0));
        pivot.quaternion.copy(rot);
        if (side === 1) pivot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.PI));
        pivot.updateMatrix();
        const leaf = this._leaf(`${id}:${p}:${side}`, pivot, leafW);
        opening.leaves.push(leaf);
      }
    }
    this.openings.push(opening);
    return opening;
  }

  _leaf(id, pivot, w) {
    const self = this;
    const leaf = {
      id,
      kind: 'hinge',
      object: pivot,
      axis: 'y',
      limits: [-1.45, 1.45],
      value: 0,
      target: 0,
      speed: 2.2,
      w,
      collider: null,
      index: this.leaves.length,
      baseQ: pivot.quaternion.clone(),
      idle: 0,
      held: 0,
      get on() {
        return Math.abs(this.target) > 0.05;
      },
      set(v) {
        this.target = clamp(v, -1.45, 1.45);
        this.held = 2.5; // someone is holding it: the closer waits
      },
      toggle(v, from) {
        const open = v ?? !this.on;
        if (open) this.target = this._awayFrom(from) * OPEN;
        else this.target = 0;
        this.held = open ? 3 : 0;
        return open;
      },
      _awayFrom(p) {
        if (!p) return 1;
        // Player side of the leaf: positive local z → swing toward -z (positive angle).
        _m.compose(pivot.position, this.baseQ, _sc.set(1, 1, 1)).invert();
        const lz = _v.copy(p).applyMatrix4(_m).z;
        return lz >= 0 ? 1 : -1;
      },
      describe: () => t('casino.it.door'),
      onInteract(player) {
        return leaf.toggle(undefined, player?.position);
      },
      // Stepped by DoorSet.update (not per-interactable), so it moves exactly once a frame.
    };
    void self;
    this.leaves.push(leaf);
    return leaf;
  }

  build(group) {
    const { frame, glass } = leafGeometries(this.H);
    const n = this.leaves.length;
    this.frameMesh = new THREE.InstancedMesh(frame, this.M.bronzeFrame, n);
    this.glassMesh = new THREE.InstancedMesh(glass, this.M.glassDoor, n);
    this.frameMesh.name = 'casino-door-frames';
    this.glassMesh.name = 'casino-door-glass';
    this.frameMesh.castShadow = true;
    this.frameMesh.receiveShadow = true;
    this.glassMesh.renderOrder = 2;
    group.add(this.frameMesh, this.glassMesh);
    for (const leaf of this.leaves) {
      group.add(leaf.object);
      leaf.object.updateMatrixWorld(true);
      if (this.physics) {
        const it = leaf;
        it.collider = this.physics.addStaticBox({ x: 0, y: 0, z: 0 }, { x: leaf.w, y: this.H, z: LEAF_T + 0.02 }, new THREE.Quaternion(), { owner: it });
      }
      this._apply(leaf);
      this.interactables.push(leaf);
    }
    this.frameMesh.computeBoundingSphere();
    this.glassMesh.computeBoundingSphere();
    for (const c of this.colliders) this.physics?.addStaticBox({ x: c[0], y: c[1], z: c[2] }, { x: c[3], y: c[4], z: c[5] }, c[6]);
    return this;
  }

  _apply(leaf) {
    const p = leaf.object;
    p.quaternion.copy(leaf.baseQ).multiply(_q.setFromAxisAngle(UP, leaf.value));
    p.updateMatrix();
    p.updateMatrixWorld(true);
    _s.makeScale(leaf.w, 1, 1);
    _m.multiplyMatrices(p.matrixWorld, _s);
    this.frameMesh.setMatrixAt(leaf.index, _m);
    this.glassMesh.setMatrixAt(leaf.index, _m);
    this.frameMesh.instanceMatrix.needsUpdate = true;
    this.glassMesh.instanceMatrix.needsUpdate = true;
    if (leaf.collider) {
      _p.set(leaf.w / 2, this.H / 2, 0).applyMatrix4(p.matrixWorld);
      p.getWorldQuaternion(_q);
      leaf.collider.setTranslation({ x: _p.x, y: _p.y, z: _p.z });
      leaf.collider.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    }
  }

  _step(leaf, dt) {
    const d = leaf.target - leaf.value;
    if (Math.abs(d) < 1e-4) return;
    const closing = Math.abs(leaf.target) < Math.abs(leaf.value);
    const max = closing ? 1.1 : leaf.speed;
    // Fast start, eased arrival; closers slow the last few degrees (latch speed).
    let step = Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * 7 * dt, 0.3 * dt), max * dt);
    if (closing && Math.abs(leaf.value) < 0.25) step *= 0.55;
    const before = leaf.value;
    leaf.value += step;
    if (Math.abs(leaf.target - leaf.value) < 1e-4) leaf.value = leaf.target;
    if (Math.abs(before) < 0.02 && Math.abs(leaf.value) >= 0.02) this._sound('door.open', leaf, 0.5, 0.82);
    if (Math.abs(before) >= 0.01 && Math.abs(leaf.value) < 0.01 && leaf.target === 0) {
      leaf.value = 0;
      this._sound('door.close', leaf, 0.35, 0.9);
    }
    this._apply(leaf);
  }

  _sound(name, leaf, gain, rate) {
    try {
      leaf.object.getWorldPosition(_p);
      audio.play(name, { bus: 'sfx', gain, rate: rate * (0.95 + Math.random() * 0.1), position: { x: _p.x, y: _p.y + 1.2, z: _p.z }, refDistance: 2 });
    } catch {
      /* audio locked */
    }
  }

  /** Walk-through behaviour + closers. `player` = { position, velocity } (world). */
  update(dt, player) {
    for (const leaf of this.leaves) {
      leaf.held = Math.max(0, leaf.held - dt);
      if (player) {
        _m.compose(leaf.object.position, leaf.baseQ, _sc.set(1, 1, 1)).invert();
        const lp = _v.copy(player.position).applyMatrix4(_m);
        const near = lp.x > -0.35 && lp.x < leaf.w + 0.35 && Math.abs(lp.z) < 1.05 && lp.y > -1 && lp.y < 2.5;
        if (near) {
          // Velocity in the leaf's frame: walking toward the plane pushes the leaf away.
          const lv = _p.copy(player.velocity).applyQuaternion(_q.copy(leaf.baseQ).invert());
          const toward = lp.z > 0 ? -lv.z : lv.z;
          if (toward > 0.35 && Math.abs(lp.z) < 0.95 && Math.abs(leaf.target) < 0.6) {
            leaf.target = (lp.z >= 0 ? 1 : -1) * OPEN;
            leaf.held = 1.2;
          }
          if (Math.abs(leaf.value) > 0.05) leaf.held = Math.max(leaf.held, 0.8); // don't close on someone
        }
      }
      // Closer: once nobody holds it, it swings back.
      if (leaf.held <= 0 && leaf.target !== 0) leaf.target = 0;
      this._step(leaf, dt);
    }
  }

  /** How open the most-open leaf of `opening id` is, 0..1 (street sound through the doors). */
  openness() {
    let m = 0;
    for (const l of this.leaves) m = Math.max(m, Math.abs(l.value) / OPEN);
    return clamp(m, 0, 1);
  }
}
