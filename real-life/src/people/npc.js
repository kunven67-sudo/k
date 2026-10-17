// One townsperson: a body (Person) + walking along nav routes + doing things at places
// (sitting, sleeping, cooking, working a register, watching TV) + talking.
//
//   const npc = new Npc(world, nav, rec)   // rec = saved record from residents.js
//   npc.goTo(nodeId, activity)              // activity: { kind, spot?, yaw?, until? }
//   npc.setAway(where)                      // inside a house / at work: no body in the world
//   npc.update(dt, viewer)

import * as THREE from 'three';
import { Person } from './person.js';
import { CURB } from '../world/layout.js';
import { clamp, dampAngle } from '../core/util.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Npc {
  constructor(world, nav, rec) {
    this.world = world;
    this.nav = nav;
    this.rec = rec;
    this.id = rec.id;
    this.name = rec.name;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.path = [];
    this.pathI = 0;
    this.activity = null; // what to do on arrival / now
    this.away = rec.startAway ?? 'home'; // null = in the world
    this.body = null;
    this.speed = 0;
    this.talkingTo = null;
    this.openedDoors = [];
    this.lookTarget = null;
    this.goal = null; // node id
    this.waitT = 0;
    this._interact = world.interact.add({
      kind: 'npc',
      npc: this,
      priority: 0.4,
      enabled: false,
      getBox: () => this._box,
      label: () => `Talk to ${this.displayName()}`,
      use: () => world.onTalk?.(this),
    });
    this._box = new THREE.Box3();
  }

  get height() {
    return this.body?.height ?? 1.7;
  }

  displayName() {
    return this.rec.call || this.name;
  }

  _ensureBody() {
    if (this.body) return this.body;
    this.body = new Person(this.rec.look, this.rec.age, { name: this.name });
    this.world.scene.add(this.body.root);
    return this.body;
  }

  /** Put the npc somewhere in the world (a node), visible. */
  appearAt(nodeId, yaw = 0) {
    this.away = null;
    const n = this.nav.nodes[nodeId];
    this.pos.copy(n.p);
    this.yaw = yaw;
    this._ensureBody().root.visible = true;
    this._interact.enabled = true;
    this.path = [];
    this.goal = nodeId;
  }

  setAway(where) {
    this.away = where;
    this.path = [];
    this.activity = null;
    if (this.body) this.body.root.visible = false;
    this._interact.enabled = false;
    this._closeDoorsBehind(true);
  }

  goTo(nodeId, activity = null) {
    if (this.away) return false;
    this.activity = activity;
    this.goal = nodeId;
    const nodes = this.nav.path(this.pos, nodeId);
    this.path = nodes.map((n) => n);
    this.pathI = 0;
    if (this.body) this.body.pose = 'stand';
    return this.path.length > 0;
  }

  get arrived() {
    return !this.away && this.pathI >= this.path.length;
  }

  /** Stop and turn to someone (talking). */
  faceTowards(p) {
    _d.copy(p).sub(this.pos);
    this.targetYaw = Math.atan2(_d.x, _d.z);
  }

  update(dt, viewer, player) {
    if (this.away) return;
    const body = this._ensureBody();
    const distToViewer = this.pos.distanceTo(viewer);
    // Walk the path.
    let moving = false;
    if (!this.talkingTo && this.pathI < this.path.length) {
      const node = this.path[this.pathI];
      const target = node.p;
      _d.copy(target).sub(this.pos);
      _d.y = 0;
      const dist = _d.length();
      // Doors: open the one we're about to walk through, close it behind us.
      if (node.door && dist < 1.8 && node.door.target < 0.5) {
        this.world.doors.setOpen(node.door, true);
        this.openedDoors.push({ door: node.door, at: node.p.clone() });
      }
      // Someone (you) standing right in the way: wait politely.
      const blocked = player && player.position.distanceTo(this.pos) < 0.75 && _v.copy(player.position).sub(this.pos).dot(_d) > 0;
      if (blocked) {
        this.waitT += dt;
        if (this.waitT > 0.6 && !this._excused) {
          this._excused = true;
          this.world.onNpcSay?.(this, this.rec.age < 13 ? 'Can I get by?' : 'Excuse me.');
        }
      } else {
        this.waitT = 0;
        this._excused = false;
        const sp = this.walkSpeed();
        const step = Math.min(dist, sp * dt);
        if (dist > 1e-4) {
          this.pos.addScaledVector(_d.normalize(), step);
          this.targetYaw = Math.atan2(_d.x, _d.z);
        }
        // Height follows the next node (stairs/porch steps/curbs).
        this.pos.y += (target.y - this.pos.y) * Math.min(1, dt * 6);
        moving = step > 0.0005;
        if (dist < 0.12) this.pathI++;
      }
    }
    this.speed = moving ? this.walkSpeed() : 0;
    this._closeDoorsBehind(false);
    // Arrived: do the activity.
    const act = this.activity;
    if (!moving && this.pathI >= this.path.length && act) this._doActivity(act, dt);
    else if (moving) {
      body.pose = 'stand';
      body.mood = this.mood || 'neutral';
    }
    this.yaw = dampAngle(this.yaw, this.targetYaw ?? this.yaw, 0.08, dt);
    body.root.position.copy(this._seatPos || this.pos);
    body.root.rotation.y = this._seatYaw ?? this.yaw;
    if (!moving && !act?.spot) this._seatPos = null, (this._seatYaw = null);
    body.setMotion({ speed: this.speed });
    body.lookAt(this.lookTarget || (distToViewer < 3.5 && this.noticesPlayer ? viewer : null));
    // Far away: animate at a lower rate (GT 1030 budget).
    this._animAcc = (this._animAcc || 0) + dt;
    const every = distToViewer > 45 ? 0.25 : distToViewer > 20 ? 0.066 : 0;
    if (this._animAcc >= every) {
      body.update(this._animAcc);
      this._animAcc = 0;
    }
    body.root.visible = distToViewer < (this.world.drawDistance || 140);
    this._box.setFromCenterAndSize(_v.copy(this.pos).setY(this.pos.y + this.height * 0.55), _d.set(0.6, this.height * 1.05, 0.6));
  }

  walkSpeed() {
    const base = this.rec.age < 6 ? 0.9 : this.rec.age < 13 ? 1.2 : this.rec.age > 70 ? 0.95 : 1.35;
    return base * (this.hurry ? 1.6 : 1);
  }

  _doActivity(act, dt) {
    const body = this.body;
    const spot = act.spot;
    if (act.kind === 'sit' || act.kind === 'tv') {
      body.pose = 'sit';
      this._seatPos = spot.at.clone().setY(spot.at.y - 0.47 * (this.height / 1.75));
      this._seatYaw = spot.faceYaw ?? 0;
    } else if (act.kind === 'sleep') {
      body.pose = 'sleep';
      this._seatPos = spot.at.clone().setY(spot.at.y + 0.04);
      this._seatYaw = (spot.rotY ?? 0) + Math.PI;
      // Feet at the root: put them at the foot end of the bed.
      this._seatPos.add(new THREE.Vector3(Math.sin(spot.rotY ?? 0) * 0.85, 0, Math.cos(spot.rotY ?? 0) * 0.85));
    } else {
      body.pose = 'stand';
      this._seatPos = null;
      this._seatYaw = null;
      if (act.yaw != null) this.targetYaw = act.yaw;
      else if (spot?.at) {
        _d.copy(spot.at).sub(this.pos);
        if (_d.lengthSq() > 0.01) this.targetYaw = Math.atan2(_d.x, _d.z);
      }
      // Busy hands (cooking, working the register, washing dishes).
      if (act.kind === 'work' || act.kind === 'cook') {
        this._busyT = (this._busyT || 0) + dt;
        if (this._busyT > 4) {
          this._busyT = 0;
          body.play('interact');
        }
      }
    }
  }

  _closeDoorsBehind(all) {
    if (!this.openedDoors.length) return;
    this.openedDoors = this.openedDoors.filter((o) => {
      const far = all || this.pos.distanceTo(o.at) > 1.6;
      if (!far) return true;
      // Don't slam it on you.
      const p = this.world.player?.position;
      if (p && p.distanceTo(o.at) < 1.1) return true;
      this.world.doors.setOpen(o.door, false);
      return false;
    });
  }

  say(text, seconds = 3) {
    this.body?.talk(seconds);
    this.world.onNpcSay?.(this, text);
  }

  dispose() {
    this.world.interact.remove(this._interact);
    this.body?.dispose();
  }
}

void CURB;
void clamp;
void UP;
