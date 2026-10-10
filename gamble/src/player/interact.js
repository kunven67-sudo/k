// Physical interaction without prompts (DESIGN §39).
//
// Whatever the screen centre (or a touch tap) is on, within arm's reach, is the focus. Nothing is
// drawn: the body answers instead — the head turns to it and the hand reaches toward it.
//   - hinge / slide (doors, drawers, fridge, curtains): hold the mouse button on it and DRAG; the
//     pointer motion is projected on the screen-space tangent of the grab point (around the hinge,
//     or along the slide axis), so the part follows the hand 1:1. Releasing keeps a little of the
//     swing. E (or a tap) nudges it open / shut.
//   - toggle (lights, TV, AC, shower, sink, toilet): E or click.
//   - prop (Rapier dynamic bodies): E picks it up into the right hand; click throws it along the
//     view; E again sets it down.
//   - talk / bed / custom ({ position, onInteract }) descriptors: E or click.
// Events: bus 'interact:begin' / 'interact:end' { target }.
import * as THREE from 'three';
import { RAPIER } from '../core/physics.js';
import { bus } from '../core/events.js';
import { clamp } from '../core/util.js';

const REACH = 2.35;
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

export class Interactor {
  constructor(player) {
    this.player = player;
    this.focus = null; // { it, point }
    this.drag = null; // { it, point(local), lastValue, vel }
    this.carry = null; // { it, body, collider }
    this.reachT = 0;
    this.reachPoint = new THREE.Vector3();
    this.list = [];
  }

  setList(list) {
    this.list = list;
  }

  /** Position used for distance tests: an object's world position or a fixed point. */
  _pos(it, out) {
    if (it.position && !it.object) return out.copy(it.position);
    if (it.object) return it.object.getWorldPosition(out);
    return null;
  }

  /** Find what the view ray (origin, dir) points at within reach of `chest`. */
  pick(origin, dir, chest) {
    const ph = this.player.physics;
    const ex = this.player.controller.collider;
    const hit = ph.raycast(origin, dir, 8, { exclude: ex });
    if (hit && hit.owner && hit.owner.kind && hit.point.distanceTo(chest) < REACH) {
      if (!this.carry || hit.owner !== this.carry.it) return { it: hit.owner, point: hit.point.clone() };
    }
    const wallDist = hit ? hit.distance : 8;
    // Fallback: descriptors without colliders (taps, curtains, the bed): closest to the ray.
    let best = null;
    let bestScore = Infinity;
    for (const it of this.list) {
      if (!it || (this.carry && it === this.carry.it)) continue;
      if (!this._pos(it, _p)) continue;
      if (_p.distanceTo(chest) > (it.reach || REACH)) continue;
      _a.copy(_p).sub(origin);
      const along = _a.dot(dir);
      if (along < 0.1 || along > wallDist + 0.35) continue;
      const perp = _a.addScaledVector(dir, -along).length();
      const tol = (it.radius || 0.22) + 0.04 * along;
      if (perp > tol) continue;
      const score = perp / tol + along * 0.05;
      if (score < bestScore) {
        bestScore = score;
        best = { it, point: _p.clone() };
      }
    }
    return best;
  }

  /** E / tap / click on the current focus. */
  activate(focus = this.focus) {
    const pl = this.player;
    if (this.carry) {
      this._release(false);
      return true;
    }
    if (!focus) return false;
    const it = focus.it;
    this._reach(focus.point);
    bus.emit('interact:begin', { target: it });
    if (it.kind === 'prop' && it.body) this._pickUp(it);
    else if (it.onInteract) it.onInteract(pl);
    else it.toggle?.();
    bus.emit('interact:end', { target: it });
    return true;
  }

  beginDrag(focus = this.focus) {
    if (!focus || this.carry) return false;
    const it = focus.it;
    if (it.kind !== 'hinge' && it.kind !== 'slide') return false;
    it.object.updateWorldMatrix(true, false);
    const local = it.object.worldToLocal(focus.point.clone());
    this.drag = { it, local, vel: 0, last: it.value ?? 0 };
    bus.emit('interact:begin', { target: it });
    return true;
  }

  /** Pointer moved (dx, dy in CSS px) while dragging. */
  dragMove(dx, dy, camera, viewport) {
    const d = this.drag;
    if (!d) return;
    const it = d.it;
    const obj = it.object;
    obj.updateWorldMatrix(true, false);
    const grab = _p.copy(d.local).applyMatrix4(obj.matrixWorld);
    // World axis of the part (its parent frame).
    _axis.copy(AXES[it.axis] || AXES.y);
    if (obj.parent) _axis.applyQuaternion(obj.parent.getWorldQuaternion(_q));
    let tangent;
    let unit; // metres of tangent per unit of value
    if (it.kind === 'hinge') {
      const pivot = obj.getWorldPosition(_o);
      const r = _a.copy(grab).sub(pivot);
      r.addScaledVector(_axis, -r.dot(_axis));
      const radius = Math.max(0.15, r.length());
      tangent = _b.copy(_axis).cross(r).normalize();
      unit = radius;
    } else {
      tangent = _b.copy(_axis);
      unit = 1;
    }
    // Screen-space direction of a 10 cm move along the tangent.
    const s0 = grab.clone().project(camera);
    const s1 = grab.clone().addScaledVector(tangent, 0.1).project(camera);
    const sx = ((s1.x - s0.x) * viewport.w) / 2;
    const sy = (-(s1.y - s0.y) * viewport.h) / 2;
    const len2 = sx * sx + sy * sy;
    if (len2 < 1) return;
    const metres = ((dx * sx + dy * sy) / len2) * 0.1; // projection of the pointer delta
    const before = it.target ?? it.value;
    it.set(before + clamp(metres / unit, -0.25, 0.25));
    this._reach(grab);
  }

  endDrag(dt) {
    const d = this.drag;
    if (!d) return;
    // Keep some momentum: carry on a bit in the direction it was moving.
    const it = d.it;
    if (Math.abs(d.vel) > 0.2) it.set((it.target ?? it.value) + clamp(d.vel * 0.18, -0.6, 0.6));
    bus.emit('interact:end', { target: it });
    this.drag = null;
    void dt;
  }

  _reach(point) {
    this.reachPoint.copy(point);
    this.reachT = 0.75;
  }

  _pickUp(it) {
    const body = it.body;
    if (!body) return;
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.carry = { it, body, collider: it.collider };
    this.player.controller.excludeCollider = it.collider || null;
    this.player.human.play?.('reach');
  }

  /** Drop (throw = false) or throw the carried prop along `dir`. */
  _release(throwIt, dir) {
    const c = this.carry;
    if (!c) return;
    c.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const pl = this.player;
    const f = dir || pl.facing(new THREE.Vector3());
    const v = throwIt ? 7.5 : 0.8;
    c.body.setLinvel({ x: f.x * v, y: (throwIt ? 2.2 : 0.4) + f.y * v * 0.6, z: f.z * v }, true);
    if (throwIt) c.body.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }, true);
    pl.controller.excludeCollider = null;
    this.carry = null;
    if (throwIt) pl.human.play?.('throw-dice', { speed: 1.6 });
  }

  throw(dir) {
    if (!this.carry) return false;
    this._release(true, dir);
    return true;
  }

  /** Per-frame: drag velocity, carried prop follows the hand, the hand reaches. */
  update(dt) {
    const pl = this.player;
    const h = pl.human;
    if (this.drag) {
      const it = this.drag.it;
      const v = it.target ?? it.value;
      this.drag.vel = this.drag.vel * 0.7 + ((v - this.drag.last) / Math.max(dt, 1e-3)) * 0.3;
      this.drag.last = v;
    }
    if (this.carry) {
      // Hold it in front of the chest, slightly right; the right hand goes there with it.
      const hold = pl.chest(_o).addScaledVector(pl.facing(_d), 0.38).addScaledVector(pl.right(_a), 0.12);
      hold.y -= 0.12;
      this.carry.body.setNextKinematicTranslation({ x: hold.x, y: hold.y, z: hold.z });
      h.setHandTarget?.('R', hold);
    } else if (this.reachT > 0) {
      this.reachT -= dt;
      h.setHandTarget?.('R', this.reachT > 0.1 ? this.reachPoint : null);
    } else if (this.drag) {
      h.setHandTarget?.('R', this.reachPoint);
    }
  }

  dispose() {
    if (this.carry) this._release(false);
  }
}
