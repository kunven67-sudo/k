// Characters that live in the world: Morty following you, the family hanging around.
import * as THREE from '../three.js';
import { ToonSprite } from './sprites.js';
import { makeBody, GRAVITY } from '../core/physics.js';
import { clamp, damp, pick, rand } from '../util.js';

const _d = new THREE.Vector3();

export class NPC {
  constructor(game, kind, { pos, facing = 0, name, lines = [], mode = 'idle', radius = 0.28, height = null, sit = false, label = null, talkRange = 2.8 } = {}) {
    this.game = game;
    this.kind = kind;
    this.name = name || kind;
    this.sprite = new ToonSprite(kind);
    this.body = makeBody(radius, height ?? this.sprite.height * 0.95);
    this.body.pos.copy(pos);
    this.sprite.facing = facing;
    this.mode = mode;
    this.lines = lines;
    this.lineIdx = 0;
    this.sit = sit;
    this.sprite.pose.sit = sit;
    this.gravity = !sit;
    this.target = null;
    this.trail = [];
    this.stuck = 0;
    this.lastPos = new THREE.Vector3();
    this.lookAtPlayer = true;
    this.interactItem = null;
    this.onTalk = null;
    this.scriptTarget = null;
    this.scriptSpeed = 3.2;
    this.onArrive = null;
    this.hidden = false;
    game.scene.add(this.sprite.group);
    if (lines.length || label) {
      this.interactItem = game.interact.add({
        pos: (out) => out.set(this.body.pos.x, this.body.pos.y + this.sprite.height * 0.7, this.body.pos.z),
        radius: 0.7,
        range: talkRange,
        label: () => (typeof label === 'function' ? label() : label || `Talk to ${this.name}`),
        enabled: () => !this.hidden && this.sprite.group.visible,
        use: () => this.talk(),
      });
    }
    this.sync();
  }

  talk() {
    if (this.onTalk) return this.onTalk(this);
    if (!this.lines.length) return;
    const line = this.lines[this.lineIdx % this.lines.length];
    this.lineIdx++;
    this.game.say(typeof line === 'function' ? line() : line);
  }

  setVisible(v) {
    this.hidden = !v;
    this.sprite.group.visible = v;
  }

  setSit(v) {
    this.sit = v;
    this.sprite.pose.sit = v;
    this.gravity = !v;
  }

  placeAt(pos, facing = null) {
    this.body.pos.copy(pos);
    this.body.vel.set(0, 0, 0);
    if (facing !== null) this.sprite.facing = facing;
    this.trail.length = 0;
    this.sync();
  }

  /** walk somewhere (cutscenes); onArrive fires when there */
  walkTo(p, speed = 3.2, onArrive = null) {
    this.mode = 'script';
    this.scriptTarget = p.clone();
    this.scriptSpeed = speed;
    this.onArrive = onArrive;
  }

  sync() {
    this.sprite.group.position.copy(this.body.pos);
  }

  update(dt) {
    const b = this.body;
    const player = this.game.player;
    let want = null;
    let speed = 0;
    if (this.mode === 'follow') {
      ({ want, speed } = this._follow(dt));
    } else if (this.mode === 'script' && this.scriptTarget) {
      _d.subVectors(this.scriptTarget, b.pos);
      _d.y = 0;
      if (_d.length() < 0.35) {
        this.mode = 'idle';
        const cb = this.onArrive;
        this.onArrive = null;
        this.scriptTarget = null;
        cb?.(this);
      } else {
        want = _d.normalize().clone();
        speed = this.scriptSpeed;
      }
    }
    if (want && !this.sit) {
      b.vel.x += (want.x * speed - b.vel.x) * damp(10, dt);
      b.vel.z += (want.z * speed - b.vel.z) * damp(10, dt);
      this.sprite.facing = Math.atan2(want.x, want.z);
    } else {
      b.vel.x *= Math.max(0, 1 - dt * 10);
      b.vel.z *= Math.max(0, 1 - dt * 10);
    }
    if (this.gravity) {
      b.vel.y += GRAVITY * dt;
      this.game.physics.move(b, dt);
    }
    // face the player when standing around near them
    const hs = Math.hypot(b.vel.x, b.vel.z);
    if (hs < 0.3 && this.lookAtPlayer && player && !this.sit) {
      _d.subVectors(player.body.pos, b.pos);
      if (_d.lengthSq() < 64) {
        const yaw = Math.atan2(_d.x, _d.z);
        let dd = yaw - this.sprite.facing;
        while (dd > Math.PI) dd -= Math.PI * 2;
        while (dd < -Math.PI) dd += Math.PI * 2;
        this.sprite.facing += dd * damp(5, dt);
      }
    }
    this.sprite.speed = hs;
    this.sync();
    this.sprite.update(dt, this.game.camera);
  }

  // ------------------------------------------------------------ following
  recordTrail(playerPos) {
    const last = this.trail[this.trail.length - 1];
    if (!last || last.distanceToSquared(playerPos) > 0.36) {
      this.trail.push(playerPos.clone());
      if (this.trail.length > 80) this.trail.shift();
    }
  }

  _follow(dt) {
    const b = this.body;
    const player = this.game.player;
    const pp = player.body.pos;
    const dist = Math.hypot(pp.x - b.pos.x, pp.z - b.pos.z);
    const dy = Math.abs(pp.y - b.pos.y);
    // too far (or stuck on another floor): catch up off-screen
    if (dist > 16 || (dy > 2.5 && dist > 6) || this.stuck > 2.2) {
      this._catchUp();
      return { want: null, speed: 0 };
    }
    if (dist < 2.0 && dy < 1.5) {
      this.trail.length = 0;
      this.stuck = 0;
      return { want: null, speed: 0 };
    }
    // drop trail points we're already past
    while (this.trail.length && Math.hypot(this.trail[0].x - b.pos.x, this.trail[0].z - b.pos.z) < 0.6) this.trail.shift();
    let target = this.trail[0];
    if (!target || this.trail.length > 40) target = pp;
    _d.set(target.x - b.pos.x, 0, target.z - b.pos.z);
    if (_d.lengthSq() < 1e-4) return { want: null, speed: 0 };
    const speed = dist > 7 ? 6.2 : dist > 4 ? 4.6 : 3.4;
    // stuck detection
    const moved = this.lastPos.distanceTo(b.pos);
    this.lastPos.copy(b.pos);
    if (moved < speed * dt * 0.25) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt);
    return { want: _d.normalize().clone(), speed };
  }

  _catchUp() {
    const player = this.game.player;
    const fwd = player.forward();
    // try a few spots behind / beside the player
    const tries = [
      [-1.6, 0], [-1.6, 0.9], [-1.6, -0.9], [0, 1.4], [0, -1.4], [-2.5, 0],
    ];
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    for (const [f, r] of tries) {
      const p = player.body.pos.clone().addScaledVector(fwd, f).addScaledVector(right, r);
      const y = this.game.physics.floorBelow(p.x, player.body.pos.y + 1.0, p.z, 3);
      if (Math.abs(y - player.body.pos.y) > 0.5) continue;
      if (this.game.physics.pointBlocked(p.x, y + 0.5, p.z, this.body.radius)) continue;
      if (this.game.physics.pointBlocked(p.x, y + 1.2, p.z, this.body.radius)) continue;
      p.y = y;
      this.placeAt(p, player.yaw + Math.PI);
      this.stuck = 0;
      return true;
    }
    this.stuck = 0;
    return false;
  }
}

/** chatter Morty says now and then while following you around */
export class IdleChatter {
  constructor(game, who, lines, min = 35, max = 70) {
    this.game = game;
    this.who = who;
    this.lines = lines.slice();
    this.min = min;
    this.max = max;
    this.t = rand(min * 0.6, max * 0.6);
    this.enabled = true;
  }
  update(dt) {
    if (!this.enabled || this.game.dialogue.busy || this.game.cutscene) return;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = rand(this.min, this.max);
      const line = pick(this.lines);
      this.game.say([[this.who, line]]);
    }
  }
}

export { clamp };
