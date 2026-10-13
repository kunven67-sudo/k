// What each spider species does. Nothing random: each reacts to what it senses (vibrations in its web,
// what it sees, how big you are next to it), the way the real species does.
import * as THREE from 'three';
import { clamp, damp, angDiff } from '../core/util.js';
import { bus } from '../core/events.js';
import { input } from '../core/input.js';
import { Spider, spiderDef, SPECIES } from './spider.js';
import { segmentGeo } from './creature.js';
import { std } from '../render/materials.js';
import { makeThin } from '../render/thin.js';
import { CATALOG } from '../props/catalog.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

// Venom strength by species: how much one bite does compared to the spider's weight. Black widow venom
// (latrotoxin) is famously strong; the others are mild for people but deadly to bug-sized prey.
const VENOM = { widow: 1500, orb: 30, jumper: 50, cellar: 20 };

let dragMat = null;
function dragline() {
  dragMat ??= makeThin(std({ color: 0xf2f5f8, roughness: 0.2, transparent: true, opacity: 0.7, depthWrite: false }, { detail: 'glass' }), { minAlpha: 0.06 });
  const m = new THREE.Mesh(segmentGeo(1, 1, 1, 5), dragMat);
  m.frustumCulled = false;
  m.visible = false;
  return m;
}

// Shared hunting logic for spiders with webs (and the jumping spider's bite/wrap/feed part).
class Hunter extends Spider {
  constructor(game, def, opts) {
    super(game, def, opts);
    this.key = opts.key;
    this.state = 'rest';
    this.stateT = 0;
    this.prey = null;
    this.biteCD = 0;
    this.drag = dragline();
    game.scene.add(this.drag);
  }

  _set(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
  }

  // You compared to it: bite-sized prey, or something far too big to mess with.
  rel(pl) {
    const r = pl.height / this.size;
    return { prey: !pl.dead && r < 1.4, threat: r > 3 };
  }

  // One bite: venom by its weight vs. yours (a widow is deadly to a bug-sized you, a bad day for a
  // full-size you, and the others barely matter to a full-size person).
  bite(pl) {
    const myMass = this.mass, yourMass = 70 * pl.scale ** 3;
    const dose = (VENOM[this.key] * myMass) / yourMass;
    pl.envenom(dose);
    const dmg = clamp(Math.round(3 * this.size / pl.height), 1, 25);
    pl.hurt(dmg, { cause: `Bitten by a ${this.name.toLowerCase()}`, at: pl.feet.clone().addScaledVector(UP, pl.height * 0.5), dir: _v.subVectors(pl.feet, this.pos).normalize(), gore: false });
    if (dose > 0.5) bus.emit('toast', { text: `The ${this.name.toLowerCase()} bit you! Venom is spreading. Grow NOW (hold X) before you can't move`, secs: 4 });
    else if (this.key === 'widow') bus.emit('toast', { text: 'A black widow bit you. Real black widow venom causes painful muscle cramps: in real life, get to a doctor or hospital', secs: 6 });
    else bus.emit('toast', 'A spider bit you (it stings, but its venom is harmless at your size)');
    bus.emit('spider:bite', this);
  }

  // Wrapped in silk, then eaten (hurt over time). Growing big enough breaks the wrap.
  feed(dt, pl) {
    pl.wrapped = Math.min(1, (pl.wrapped || 0) + dt / 4);
    if (pl.wrapped >= 1 && !pl.dead) {
      this.feedT = (this.feedT || 0) + dt;
      if (this.feedT > 1.2) {
        this.feedT = 0;
        pl.hurt(Math.max(2, Math.round(4 * this.size / pl.height)), { cause: `Wrapped in silk and eaten by a ${this.name.toLowerCase()}`, at: pl.feet.clone().addScaledVector(UP, pl.height * 0.5), dir: UP, gore: true });
      }
    }
  }

  dispose() {
    this.drag.removeFromParent();
    super.dispose();
  }
}

// ---- web hunters: orb weaver, black widow, cellar spider -------------------------------------------------
class WebSpider extends Hunter {
  constructor(game, def, opts) {
    super(game, def, opts);
    this.turnRate = 6;
    if (opts.web) {
      this.home = opts.web.hub;
      this.enterWeb(opts.web, this.home);
      opts.web.owner = this;
      this._place(false);
    }
  }

  describe() {
    const pl = this.game.player;
    const r = this.rel(pl);
    const what = this.state === 'feed' ? 'feeding' : this.state === 'hunt' ? 'coming for what hit its web' : this.state === 'hide' || this.state === 'drop' ? 'hiding from you' : 'waiting for vibrations';
    return `${this.name} · ${what}${r.prey ? ' · you are prey to it' : r.threat ? ' · you are a giant to it' : ''}`;
  }

  think(dt) {
    if (this.mode !== 'web' && this.mode !== 'dangle') return;
    const pl = this.game.player, w = this.web;
    this.stateT += dt;
    this.biteCD = Math.max(0, this.biteCD - dt);
    const r = this.rel(pl);
    const chest = _v3.copy(pl.feet).addScaledVector(UP, pl.height * 0.5);
    const dist = chest.distanceTo(this.pos);
    const caught = pl.heldBy === w && w.stuck;
    this.wantSpeed = 0;
    // Something big coming close: get away (into the retreat, or drop on a safety line).
    if (r.threat && dist < pl.height * 0.6 + this.sp.legs[0] * this.scale * 2 && !caught) {
      if (this.state !== 'hide' && this.state !== 'drop') this.onThreat();
    } else if (caught && r.prey) {
      if (this.state !== 'hunt' && this.state !== 'feed') {
        this._set('hunt');
        const target = w.nearestNode(chest, { dryOnly: true });
        this.webGo(target);
      }
    } else if (this.state === 'hunt' || this.state === 'feed') {
      // The prey got away (or grew): go home.
      this._set('home');
      this.webGo(this.home);
    }
    switch (this.state) {
      case 'hunt':
        this.wantSpeed = this.sp.speed * this.scale * 1.6;
        if (dist < this.size * 1.4 + pl.height * 0.6) {
          this._set('feed');
          if (this.biteCD <= 0) {
            this.bite(pl);
            this.biteCD = 6;
          }
        } else if (this.webArrived) {
          // Walked as far as the dry threads go: step onto the closest thread to you (even sticky).
          this.webGo(w.nearestNode(chest));
        }
        break;
      case 'feed':
        this.feed(dt, pl);
        if (this.biteCD <= 0 && !pl.dead) {
          this.bite(pl);
          this.biteCD = 6;
        }
        break;
      case 'home':
        this.wantSpeed = this.sp.speed * this.scale;
        if (this.webArrived) this._set('rest');
        break;
      case 'hide':
        this.wantSpeed = this.sp.speed * this.scale * 1.8;
        if (this.stateT > 6 && !(r.threat && dist < pl.height * 1.2 + this.sp.legs[0] * this.scale * 3)) {
          this._set('home');
          this.webGo(this.home);
        }
        break;
      default:
        break;
    }
  }

  onThreat() {
    this._set('hide');
    this.webGo(this.web.retreat ?? this.home);
  }
}

// Garden orb weaver: waits head-down at the hub; drops on a safety line when something huge comes.
class OrbWeaver extends WebSpider {
  onThreat() {
    this._set('drop');
    this.mode = 'dangle';
    this.dropFrom = this.web.nodes[this.home].clone();
    this.dropDepth = 0;
  }

  _dangle(dt) {
    const pl = this.game.player;
    const away = !(this.rel(pl).threat && pl.feet.distanceTo(this.dropFrom) < pl.height * 1.5 + 0.3);
    const want = away && this.stateT > 5 ? 0 : this.size * 9;
    this.dropDepth = damp(this.dropDepth, want, away && this.stateT > 5 ? 1.5 : 4, dt);
    this.pos.copy(this.dropFrom).addScaledVector(UP, -this.dropDepth);
    this.up.lerp(_v.set(0, 0, 1), Math.min(1, dt * 6)).normalize();
    this._setFwd(_v2.set(0, -1, 0));
    // The safety line it hangs from.
    const d = this.drag;
    d.visible = this.dropDepth > this.size * 0.2;
    d.position.copy(this.pos);
    d.scale.set(3e-6, this.dropDepth, 3e-6);
    d.quaternion.identity();
    if (away && this.stateT > 5 && this.dropDepth < this.size * 0.15) {
      d.visible = false;
      this.enterWeb(this.web, this.home);
      this._set('rest');
    }
  }
}

// Western black widow: hangs belly-up in her tangle; hides in her retreat; bites big you only when
// pressed against her skin (real: widows are shy and bite in self-defense).
class BlackWidow extends WebSpider {
  onPlayerContact(pl) {
    if (this.biteCD > 0 || pl.height < this.size * 2) return;
    this.biteCD = 8;
    this.bite(pl);
  }
}

// Cellar spider: when disturbed it whirls in its web so fast it turns into a blur (a real defense).
class CellarSpider extends WebSpider {
  onThreat() {
    this._set('hide');
    this.whirlT = 4;
  }

  animate(dt) {
    super.animate(dt);
    this.whirlT = Math.max(0, (this.whirlT || 0) - dt);
    const k = Math.min(1, this.whirlT);
    const b = this.bodyG;
    b.position.x = Math.sin(this.t * 31) * this.sp.ride * 0.8 * k;
    b.position.z = Math.cos(this.t * 31) * this.sp.ride * 0.8 * k;
  }
}

// ---- red-backed jumping spider: sees you, stalks, pounces --------------------------------------------
class JumpingSpider extends Hunter {
  constructor(game, def, opts) {
    super(game, def, opts);
    this.turnRate = 7;
    this.struggle = 0;
    this.wave = 0;
  }

  describe() {
    const r = this.rel(this.game.player);
    const what = { stalk: 'stalking you', leap: 'jumping!', hold: 'biting', watch: 'watching you', curious: 'curious about you', flee: 'hopping away' }[this.state] || 'hunting by sight';
    return `${this.name} · ${what}${r.prey ? ' · you are prey to it' : ''}`;
  }

  holdHint(touch) {
    return touch ? 'Tap jump fast to pull free' : 'Spam <kbd>Space</kbd> to pull free, or grow';
  }

  think(dt) {
    const pl = this.game.player;
    this.stateT += dt;
    this.biteCD = Math.max(0, this.biteCD - dt);
    if (this.mode === 'leap') return;
    if (this.state === 'hold') return this._hold(dt, pl);
    const L = this.size;
    const chest = _v3.copy(pl.feet).addScaledVector(UP, pl.height * 0.5);
    const head = _v.copy(this.pos).addScaledVector(this.up, this.sp.ride * this.scale * 1.3);
    const dist = head.distanceTo(chest);
    const moving = Math.hypot(pl.vel.x, pl.vel.y, pl.vel.z) > pl.height * 0.05;
    // Jumping spiders have the sharpest eyes of any spider: they notice movement far away (~30 body
    // lengths) and still things closer.
    const sees = !pl.dead && dist < L * (moving ? 40 : 12) && this.canSee(head, chest, pl.height, moving, { fov: 2.9, still: 0.02, motion: 0.004 });
    if (sees) {
      this.lastSeen = (this.lastSeen || new THREE.Vector3()).copy(chest);
      this.seenT = this.t;
    }
    const recent = this.t - (this.seenT ?? -99) < 3;
    const r = this.rel(pl);
    this.wantSpeed = 0;
    this.targetDir = null;
    this.wave = damp(this.wave, this.state === 'curious' ? 1 : 0, 6, dt);
    if (!recent) return this._set('rest');
    _v2.subVectors(this.lastSeen, this.pos);
    this.targetDir = _v2.clone(); // turn to face you (it always does: that's how it sees you clearly)
    if (r.threat || (!r.prey && dist < pl.height * 0.8 + L * 2)) {
      this._set(dist < pl.height * 0.4 + L * 3 ? 'flee' : 'curious');
      if (this.state === 'flee') {
        this.targetDir.negate();
        this.wantSpeed = this.sp.speed * this.scale * 1.4;
      }
      return;
    }
    if (r.prey) {
      if (dist > L * 5) {
        this._set('stalk');
        this.wantSpeed = this.sp.speed * this.scale * 0.45; // slow, crouched creep
      } else if (this.biteCD <= 0 && Math.acos(clamp(this.fwd.dot(_v2.normalize()), -1, 1)) < 0.35) {
        this._jumpAt(this.lastSeen);
      } else this._set('watch');
    } else this._set('watch');
  }

  // A real jump: it fixes a safety line, then leaps on a ballistic arc (up to ~20+ body lengths).
  _jumpAt(target) {
    this._set('leap');
    this.mode = 'leap';
    this.leapFrom = this.pos.clone();
    const d = _v.subVectors(target, this.pos);
    const flat = Math.hypot(d.x, d.z);
    const T = clamp(Math.sqrt(Math.max(flat, this.size) / 9.81) * 1.1, 0.06, 0.6);
    this.leapVel = new THREE.Vector3(d.x / T, d.y / T + 0.5 * 9.81 * T, d.z / T);
    this.leapT = 0;
    this.up.set(0, 1, 0);
  }

  _leap(dt) {
    const pl = this.game.player;
    this.leapT += dt;
    this.leapVel.y -= 9.81 * dt;
    const step = _v.copy(this.leapVel).multiplyScalar(dt);
    const physics = this.game.physics;
    const hit = physics.raycast(this.pos, _v2.copy(step).normalize(), step.length() + this.size * 0.1, this._rayOpts());
    this.pos.add(step);
    this._setFwd(_v3.set(this.leapVel.x, 0, this.leapVel.z));
    // Safety line back to where it jumped from.
    const dl = this.drag;
    dl.visible = true;
    dl.position.copy(this.leapFrom);
    const len = this.leapFrom.distanceTo(this.pos);
    dl.quaternion.setFromUnitVectors(UP, _v3.subVectors(this.pos, this.leapFrom).normalize());
    dl.scale.set(2.5e-6, len, 2.5e-6);
    // Got you?
    const chest = _v3.copy(pl.feet).addScaledVector(UP, pl.height * 0.5);
    if (!pl.dead && !pl.heldBy && chest.distanceTo(this.pos) < this.size * 0.9 + pl.radius && this.rel(pl).prey) {
      this.mode = 'surface';
      this._set('hold');
      this.struggle = 0;
      pl.grabbed(this);
      this.bite(pl);
      this.biteCD = 5;
      return;
    }
    if (hit || this.leapT > 1.5) {
      if (hit) this.pos.copy(hit.point);
      this.mode = 'air';
      this.velY = Math.min(0, this.leapVel.y);
      this.biteCD = 2;
      this._set('watch');
      this.dragHideT = 1.5; // the safety line hangs there a moment
    }
  }

  _hold(dt, pl) {
    this.wantSpeed = 0;
    if (pl.heldBy !== this || pl.dead && this.stateT > 12) {
      if (pl.heldBy === this) pl.released(this);
      this.drag.visible = false;
      return this._set('watch');
    }
    // Holds you in its fangs, in front of its face.
    _v.copy(this.pos).addScaledVector(this.up, this.sp.ride * this.scale).addScaledVector(this.fwd, this.size * 0.55);
    pl.holdAt(_v);
    this.drag.visible = false;
    // Pull free (you're strong for your size) unless the venom has you, or grow out of its grip.
    if (!pl.dead && (pl.paralysis ?? 0) < 0.85) {
      if (input.pressed('jump') || input.pressed('interact')) this.struggle += 0.09 * clamp((pl.height / this.size) * 3, 0.15, 2);
      this.struggle = Math.max(0, this.struggle - dt * 0.25);
      pl.struggle = this.struggle;
      let why = null;
      if (this.struggle >= 1) why = 'You pulled free of its fangs!';
      else if (pl.height > this.size * 1.6) why = 'You got too big for it to hold';
      if (why) {
        pl.released(this, _v2.copy(this.fwd).multiplyScalar(Math.sqrt(pl.height) * 0.6).setY(Math.sqrt(pl.height) * 0.4));
        bus.emit('toast', why);
        this.biteCD = 4;
        return this._set('flee');
      }
    }
    if (this.biteCD <= 0 && !pl.dead) {
      this.bite(pl);
      this.biteCD = 5;
    }
    if ((pl.paralysis ?? 0) > 0.8) this.feed(dt, pl);
  }

  animate(dt) {
    super.animate(dt);
    if (this.dragHideT > 0 && (this.dragHideT -= dt) <= 0 && this.mode !== 'leap') this.drag.visible = false;
    // Curious: the front pair of legs comes up and waves (real jumping spiders do this).
    if (this.wave > 0.02 && this.legsVisible) {
      for (const l of this.legs) {
        if (l.pair !== 0) continue;
        _v.copy(l.rest).add(_v2.set(0, this.size * 0.35 * this.wave, -this.size * 0.1));
        _v.y += Math.sin(this.t * 9 + l.side) * this.size * 0.06 * this.wave;
        this.model.localToWorld(l.foot.copy(_v));
        l.t = 1;
      }
    }
  }
}

// ---- catalog --------------------------------------------------------------------------------------------
const CLASSES = { widow: BlackWidow, orb: OrbWeaver, jumper: JumpingSpider, cellar: CellarSpider };
export const SPIDER_DEFS = {};
for (const [key, cls] of Object.entries(CLASSES)) {
  const def = spiderDef(key, null);
  def.spawn = (game, opts = {}) => new cls(game, def, { ...opts, key });
  SPIDER_DEFS[key] = def;
  CATALOG[def.id] = def;
}

export function makeSpider(game, key, opts = {}) {
  return new CLASSES[key](game, SPIDER_DEFS[key], { ...opts, key });
}
export { SPECIES };
