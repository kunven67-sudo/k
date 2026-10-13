// Two hands, one thing per hand (master list section 5). One source of truth: `this.slots`.
// Models and physics are derived from it every frame, so an item can only ever be in one place:
// the phone can't end up stuck to the gun because the gun isn't a place a phone can go.
//
//   right hand: the tool you're using (shrink ray) or a held prop
//   left hand:  the phone, or a second held prop
//   both:       big things (more than ~half your height) take both hands
//   pockets:    up to 4 small things (less than ~15% of your height)
//
// Holding works with physics, not by teleporting: the prop stays a real body that's pulled toward
// your hand with a force limited by how strong you are at your size, so it bumps into walls instead
// of going through them, and heavy things lag behind.
import * as THREE from 'three';
import { GROUPS, RAPIER } from '../core/physics.js';
import { input } from '../core/input.js';
import { bus } from '../core/events.js';
import { clamp } from '../core/util.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();

export class Hands {
  constructor(player, game) {
    this.player = player;
    this.game = game;
    this.slots = { left: null, right: null }; // { kind: 'prop'|'tool', ref, two?: true }
    this.pockets = []; // props stowed (disabled bodies)
    this.tools = new Map(); // id -> tool object (shrink ray, phone)
    this.look = null; // what the crosshair is on: { prop, point, dist, reachable }
    this.charge = 0;
    this.holdRot = new THREE.Quaternion();
  }

  // --- strength (square-cube law): muscles scale with area (s^2), weight with volume (s^3) ---------
  get maxLift() {
    return 40 * this.player.scale ** 2; // kg you can carry
  }

  get reach() {
    return this.player.height * 0.75;
  }

  holding(slot) {
    return this.slots[slot];
  }

  heldProps() {
    const out = [];
    for (const k of ['right', 'left']) {
      const s = this.slots[k];
      if (s && s.kind === 'prop' && !out.includes(s.ref)) out.push(s.ref);
    }
    return out;
  }

  // ---- aiming / looking at things -------------------------------------------------------------
  updateLook(camera) {
    const physics = this.game.physics;
    const pl = this.player;
    const dir = _v.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const maxD = pl.camDistM + this.reach * 1.6 + pl.height;
    const held = this.heldProps();
    const pred = (c) => {
      const o = physics.ownerOf(c);
      return o !== pl && !(o && held.includes(o));
    };
    const hit = physics.raycast(camera.position, dir, maxD * 4, { excludeBody: pl.body, predicate: pred });
    this.aimPoint = hit ? hit.point : camera.position.clone().addScaledVector(dir, maxD * 4);
    this.aimHit = hit;
    this.look = null;
    if (hit && hit.owner && hit.owner.kind === 'creature') {
      // Looking at an animal: what it is and what it thinks of you (no grabbing live animals yet).
      const d = hit.dist;
      this.look = { creature: hit.owner, point: hit.point, dist: d, reachable: d < pl.camDistM + pl.height * 8 + hit.owner.size * 4 };
      return;
    }
    if (hit && hit.owner && typeof hit.owner.interactText === 'function') {
      const chest = _v2.copy(pl.feet).addScaledVector(THREE.Object3D.DEFAULT_UP, pl.height * 0.6);
      const d = hit.point.distanceTo(chest);
      this.look = { interact: hit.owner, point: hit.point, dist: d, reachable: d < Math.max(this.reach, 0.25) + 0.35 * pl.scale };
      return;
    }
    // Forgiving aim (no-bugs rulebook: small things must always be easy to grab): if the ray lands on
    // the floor/table/wall right next to a small loose thing, snap to the nearest one.
    if (hit && !(hit.owner && hit.owner.kind === 'prop')) {
      const near = this._nearestPropTo(hit.point, dir, camera.position, pl.height * 0.09, held);
      if (near) {
        const chest = _v2.copy(pl.feet).addScaledVector(THREE.Object3D.DEFAULT_UP, pl.height * 0.6);
        const d = near.center.distanceTo(chest);
        this.look = { prop: near.prop, point: near.center, dist: d, reachable: d < this.reach + near.prop.size * 0.5 };
        this.aimHit = { ...hit, owner: near.prop, point: near.center };
        return;
      }
    }
    if (hit && hit.owner && hit.owner.kind === 'prop') {
      const chest = _v2.copy(pl.feet).addScaledVector(THREE.Object3D.DEFAULT_UP, pl.height * 0.6);
      const d = hit.point.distanceTo(chest);
      this.look = { prop: hit.owner, point: hit.point, dist: d, reachable: d < this.reach + hit.owner.size * 0.5 };
    } else if (!hit || hit.dist > maxD) {
      // Generous aim for small things on the floor: sweep a fat sphere along the view if the thin ray missed.
      const sc = physics.sphereCast(camera.position, dir, pl.height * 0.08, maxD, { excludeBody: pl.body, predicate: pred });
      if (sc && sc.owner && sc.owner.kind === 'prop') {
        const p = sc.owner.body.translation();
        const pt = new THREE.Vector3(p.x, p.y, p.z);
        const chest = _v2.copy(pl.feet).addScaledVector(THREE.Object3D.DEFAULT_UP, pl.height * 0.6);
        const d = pt.distanceTo(chest);
        this.look = { prop: sc.owner, point: pt, dist: d, reachable: d < this.reach + sc.owner.size * 0.5 };
      }
    }
  }

  _nearestPropTo(point, dir, origin, radius, held) {
    const physics = this.game.physics;
    let best = null, bestD = Infinity;
    for (const c of physics.overlaps(new RAPIER.Ball(radius), point)) {
      const o = physics.ownerOf(c);
      if (!o || o.kind !== 'prop' || held.includes(o) || o.pocketed) continue;
      const t = o.body.translation();
      const center = new THREE.Vector3(t.x, t.y, t.z); // body origin = center of mass
      // Distance from the prop to the aim line.
      const along = center.clone().sub(origin).dot(dir);
      const onLine = origin.clone().addScaledVector(dir, along);
      const d = onLine.distanceTo(center);
      if (d < bestD) {
        bestD = d;
        best = { prop: o, center };
      }
    }
    return best;
  }

  promptText() {
    const lk = this.look;
    if (!lk || !lk.reachable) return null;
    if (lk.creature) return ['', lk.creature.describe(this.player)];
    if (lk.interact) return ['E', lk.interact.interactText(this.player)];
    const p = lk.prop;
    if (p.held) return null;
    const m = p.mass;
    const w = m >= 1 ? `${m.toFixed(m < 10 ? 1 : 0)} kg` : m >= 0.001 ? `${(m * 1000).toFixed(m < 0.01 ? 1 : 0)} g` : `${(m * 1e6).toFixed(m < 1e-5 ? 1 : 0)} mg`;
    if (m > this.maxLift) return ['', `${p.name} (${w}) is too heavy for you at this size`];
    return ['E', `Pick up ${p.name} (${w})`];
  }

  // ---- actions ------------------------------------------------------------------------------------
  update(dt) {
    const pl = this.player;
    if (pl.dead) return;
    if (input.pressed('interact') && this.look && this.look.reachable && !pl.heldBy) {
      if (this.look.interact) this.look.interact.interact(this.player);
      else if (this.look.prop) this.pickUp(this.look.prop);
    }
    if (input.pressed('drop')) this.drop();
    if (input.pressed('slot1')) this.equipTool(null);
    if (input.pressed('slot2')) this.equipTool('ray');
    if (input.pressed('slot3') || input.pressed('phone')) this.togglePhone();

    // Throwing: hold Q (any hand) or left click (right hand, no tool) to wind up, release to throw.
    const r = this.slots.right, l = this.slots.left;
    const throwable = r && r.kind === 'prop' ? r : l && l.kind === 'prop' ? l : null;
    const clickThrow = r && r.kind === 'prop';
    const winding = input.down('throw') || (clickThrow && input.down('fire'));
    const let_go = input.released('throw') || (clickThrow && input.released('fire'));
    if (throwable) {
      if (winding) this.charge = Math.min(1, this.charge + dt / 0.8);
      if (let_go && this.charge > 0) {
        this.throwProp(throwable.ref, 0.25 + this.charge * 0.75);
        this.charge = 0;
      }
    } else this.charge = 0;

    // Tools in hand (the shrink ray handles its own fire/alt input).
    for (const k of ['right', 'left']) {
      const s = this.slots[k];
      if (s && s.kind === 'tool') s.ref.update?.(dt, this, k);
    }
    for (const t of this.tools.values()) if (t.alwaysUpdate) t.update?.(dt, this, null);
    void pl;
  }

  // Physics step: pull held props toward the hands.
  fixedUpdate(dt) {
    for (const k of ['right', 'left']) {
      const s = this.slots[k];
      if (!s || s.kind !== 'prop') continue;
      if (s.two && k === 'left') continue; // two-handed props are driven once
      this._drive(s.ref, this.holdTarget(k, s), dt);
    }
  }

  // Where a held prop should be (world space).
  holdTarget(side, slot) {
    const pl = this.player;
    const H = pl.height;
    const prop = slot.ref;
    const yaw = pl.yaw;
    const fwd = _v.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const out = new THREE.Vector3().copy(pl.feet);
    if (slot.two) {
      out.y += H * 0.55;
      out.addScaledVector(fwd, H * 0.22 + prop.size * 0.55);
      out.y += prop.size * 0.1;
    } else {
      out.y += H * 0.5;
      out.addScaledVector(fwd, H * 0.2 + prop.size * 0.3);
      out.addScaledVector(right, (side === 'right' ? 1 : -1) * H * 0.17);
    }
    return out;
  }

  _drive(prop, target, dt) {
    const b = prop.body;
    const t = b.translation();
    const lv = b.linvel();
    const pos = _v2.set(t.x, t.y, t.z);
    const want = target.clone().sub(pos).multiplyScalar(14);
    const maxSpeed = 6 * Math.sqrt(this.player.scale) + 0.5 * this.player.scale;
    if (want.length() > maxSpeed) want.setLength(maxSpeed);
    // Strength-limited acceleration (heavy things lag, light things snap).
    const aMax = (this.maxLift * 9.81 * 2.5) / Math.max(1e-9, prop.mass);
    const dv = want.sub(new THREE.Vector3(lv.x, lv.y, lv.z));
    const lim = aMax * dt;
    if (dv.length() > lim) dv.setLength(lim);
    b.setLinvel({ x: lv.x + dv.x, y: lv.y + dv.y, z: lv.z + dv.z }, true);
    // Keep it upright-ish and turned with you.
    const r = b.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    _qi.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.player.yaw).multiply(this.holdRot);
    const diff = _qi.multiply(_q.clone().invert());
    if (diff.w < 0) diff.set(-diff.x, -diff.y, -diff.z, -diff.w);
    const ang = 2 * Math.acos(clamp(diff.w, -1, 1));
    const axis = new THREE.Vector3(diff.x, diff.y, diff.z);
    if (axis.lengthSq() > 1e-10) axis.normalize();
    const av = axis.multiplyScalar(Math.min(ang * 10, 12));
    b.setAngvel({ x: av.x, y: av.y, z: av.z }, true);
    // Dropped automatically if it gets stuck far away (it's caught on something).
    if (pos.distanceTo(target) > this.player.height * 1.5 + prop.size) this.release(prop);
  }

  pickUp(prop) {
    if (prop.held) return false;
    if (prop.mass > this.maxLift) {
      bus.emit('toast', `${prop.name} is too heavy for you at this size`);
      return false;
    }
    const two = prop.size > this.player.height * 0.45;
    if (two) {
      // Both hands needed: put tools away first; refuse if a prop is in either hand.
      for (const k of ['right', 'left']) {
        const s = this.slots[k];
        if (s && s.kind === 'prop') {
          bus.emit('toast', 'Your hands are full');
          return false;
        }
        if (s && s.kind === 'tool') this._stowTool(k);
      }
      const slot = { kind: 'prop', ref: prop, two: true };
      this.slots.right = slot;
      this.slots.left = slot;
    } else {
      let side = !this.slots.right ? 'right' : !this.slots.left ? 'left' : null;
      if (!side && this.slots.right.kind === 'tool') {
        this._stowTool('right');
        side = 'right';
      }
      if (!side) {
        bus.emit('toast', 'Both hands are full (G to drop)');
        return false;
      }
      this.slots[side] = { kind: 'prop', ref: prop };
    }
    prop.held = true;
    prop.setGroups(GROUPS.held);
    prop.body.setGravityScale(0, true);
    prop.body.wakeUp();
    // Remember how it was turned relative to you so it doesn't spin around when grabbed.
    const r = prop.body.rotation();
    _q.set(r.x, r.y, r.z, r.w);
    this.holdRot.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -this.player.yaw).multiply(_q);
    bus.emit('pickup', prop);
    return true;
  }

  release(prop) {
    for (const k of ['right', 'left']) if (this.slots[k] && this.slots[k].ref === prop) this.slots[k] = null;
    prop.held = false;
    prop.setGroups(GROUPS.prop);
    prop.body.setGravityScale(1, true);
    prop.body.wakeUp();
  }

  drop() {
    const s = this.slots.right?.kind === 'prop' ? this.slots.right : this.slots.left?.kind === 'prop' ? this.slots.left : null;
    if (!s) return;
    this.release(s.ref);
    bus.emit('drop', s.ref);
  }

  throwProp(prop, power) {
    this.release(prop);
    const pl = this.player;
    // Throw energy comes from muscle (scales with s^3); speed = sqrt(2E/m), capped by arm speed.
    const E = 150 * pl.scale ** 3 * power;
    const v = Math.min(Math.sqrt((2 * E) / Math.max(1e-9, prop.mass)), 28 * Math.sqrt(pl.scale) * power);
    const dir = this.aimPoint.clone().sub(prop.object.position).normalize();
    dir.y += 0.08;
    dir.normalize();
    const lv = prop.body.linvel();
    prop.body.setLinvel({ x: lv.x + dir.x * v, y: lv.y + dir.y * v, z: lv.z + dir.z * v }, true);
    bus.emit('throw', { prop, speed: v });
  }

  // ---- tools (shrink ray, phone) --------------------------------------------------------------
  addTool(id, tool) {
    this.tools.set(id, tool);
    tool.id = id;
    tool.setVisible?.(false);
  }

  _stowTool(side) {
    const s = this.slots[side];
    if (s && s.kind === 'tool') {
      s.ref.setVisible?.(false);
      s.ref.active = false;
      this.slots[side] = null;
    }
  }

  // Right-hand tool. null = empty hands.
  equipTool(id) {
    const cur = this.slots.right;
    if (cur && cur.kind === 'tool' && cur.ref.id === id) return;
    if (cur && cur.kind === 'tool') this._stowTool('right');
    if (!id) return;
    const tool = this.tools.get(id);
    if (!tool) return;
    if (cur && cur.kind === 'prop') {
      if (!this._pocket(cur.ref)) {
        bus.emit('toast', `Drop the ${cur.ref.name} first (G)`);
        return;
      }
    }
    this.slots.right = { kind: 'tool', ref: tool };
    tool.setVisible?.(true);
    tool.active = true;
  }

  // The phone always goes in the LEFT hand.
  togglePhone() {
    const phone = this.tools.get('phone');
    if (!phone) return;
    const cur = this.slots.left;
    if (cur && cur.kind === 'tool' && cur.ref === phone) {
      this._stowTool('left');
      bus.emit('phone', false);
      return;
    }
    if (cur && cur.kind === 'prop') {
      if (cur.two) {
        bus.emit('toast', `Put down the ${cur.ref.name} first (G)`);
        return;
      }
      if (!this._pocket(cur.ref)) {
        bus.emit('toast', `No room in your pockets for the ${cur.ref.name}`);
        return;
      }
    }
    this.slots.left = { kind: 'tool', ref: phone };
    phone.setVisible?.(true);
    phone.active = true;
    bus.emit('phone', true);
  }

  // Small things go in pockets (disabled until taken out).
  _pocket(prop) {
    if (prop.size > this.player.height * 0.15 || this.pockets.length >= 4) return false;
    this.release(prop);
    prop.body.setEnabled(false);
    prop.object.visible = false;
    prop.pocketed = true;
    this.pockets.push(prop);
    bus.emit('toast', `${prop.name} in your pocket`);
    return true;
  }

  // Invariant check used by the tests: every prop is in at most one place.
  check() {
    const seen = new Set();
    for (const k of ['right', 'left']) {
      const s = this.slots[k];
      if (!s) continue;
      if (s.two && k === 'left') continue;
      if (seen.has(s.ref)) return `item ${s.ref.name || s.ref.id} in two slots`;
      seen.add(s.ref);
    }
    for (const p of this.pockets) {
      if (seen.has(p)) return `item ${p.name} both in hand and pocket`;
      seen.add(p);
    }
    return null;
  }
}
