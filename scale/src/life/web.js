// Spider webs: real thread layouts, real silk.
//
// A web is a net of threads between points (some glued to walls, branches, the floor). Each thread is
// a kind of silk with its real thickness and strength:
//   frame     8 um wide, the strong outer lines            dry
//   radial    5 um, the spokes of an orb web               dry (the spider walks on these)
//   capture   3 um + glue droplets, the orb's spiral        STICKY
//   tangle    4 um, a cobweb's messy scaffolding           dry
//   gumfoot   4 um, black widow trip lines to the floor    STICKY at the bottom; snaps off the floor and
//                                                          yanks whatever touched it up into the air
//   sheet     2.5 um, a cellar spider's loose sheet        dry, but tangles legs (no glue)
// Silk is about as strong as steel for its thickness (1.1 billion pascals). You are as strong as a
// person your size: about 1000 N at 1.75 m, scaling with your size squared. So at 2.6 mm you can't
// break even one capture thread (it holds ~3.5 mN, you push ~2 mN); at about 1 cm you snap them.
//  - Too strong for you: dry threads stop you like ropes; sticky ones catch you. Struggling only
//    tangles you in more threads (like a real fly). Grow until you're stronger than what holds you.
//  - You're stronger: you walk through, breaking threads, and get strands stuck on you.
// Everything that touches a web makes it vibrate; its spider feels that and knows where it came from.
import * as THREE from 'three';
import { std, phys } from '../render/materials.js';
import { makeThin } from '../render/thin.js';
import { hash3, clamp } from '../core/util.js';
import { bus } from '../core/events.js';
import { input } from '../core/input.js';

export const SILK = {
  frame: { r: 4e-6, sigma: 1.1e9 },
  radial: { r: 2.5e-6, sigma: 1.1e9 },
  hub: { r: 2e-6, sigma: 1.1e9 },
  capture: { r: 1.5e-6, sigma: 0.5e9, sticky: true, glue: 12e-6 },
  tangle: { r: 2e-6, sigma: 1.0e9 },
  support: { r: 2e-6, sigma: 1.0e9 },
  gumfoot: { r: 2e-6, sigma: 1.0e9, sticky: true, glue: 22e-6 },
  sheet: { r: 1.25e-6, sigma: 0.8e9, entangle: true },
  retreat: { r: 1.5e-6, sigma: 1.0e9 },
  drag: { r: 3e-6, sigma: 1.1e9 },
};
const strengthOf = (k) => SILK[k].sigma * Math.PI * SILK[k].r ** 2;
// How hard you can pull (N): ~1000 N for a 1.75 m person, scaling with size squared.
export const playerStrength = (H) => 1000 * (H / 1.75) ** 2;

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Vector3();
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _r = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _s = new THREE.Vector3();

// Closest points between segments p0-p1 and q0-q1. Returns squared distance; fills outP / outQ.
function segSeg(p0, p1, q0, q1, outP, outQ) {
  _d1.subVectors(p1, p0);
  _d2.subVectors(q1, q0);
  _r.subVectors(p0, q0);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r);
  let s, t;
  if (a <= 1e-18 && e <= 1e-18) {
    s = t = 0;
  } else if (a <= 1e-18) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = _d1.dot(_r);
    if (e <= 1e-18) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = _d1.dot(_d2), den = a * e - b * b;
      s = den > 1e-24 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  outP.copy(p0).addScaledVector(_d1, s);
  outQ.copy(q0).addScaledVector(_d2, t);
  return outP.distanceToSquared(outQ);
}

let silkMat = null, glueMat = null;
function mats() {
  if (!silkMat) {
    // Silk: clear, glossy, catches the light (that glint is how you spot webs in real life).
    silkMat = makeThin(std({ color: 0xf2f5f8, roughness: 0.16, metalness: 0, transparent: true, opacity: 0.75, depthWrite: false, envMapIntensity: 1.6 }, { detail: 'glass' }), { minAlpha: 0.06 });
    glueMat = phys({ color: 0xffffff, roughness: 0.03, clearcoat: 1, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 2 }, { detail: 'glass' });
  }
  return { silkMat, glueMat };
}

export class Web {
  constructor(game, { name = 'Spider web', owner = null } = {}) {
    this.game = game;
    this.kind = 'web';
    this.name = name;
    this.owner = owner; // the spider whose web it is
    this.nodes = []; // Vector3
    this.anchored = []; // glued to something solid
    this.edges = []; // { a, b, k, broken, strength }
    this.cell = 0.01;
    this.grid = new Map();
    this.stuck = null; // { edges: Set, point: Vector3, lift: 0.. }
    this._from = new THREE.Vector3();
    this._to = new THREE.Vector3();
    this._cp = new THREE.Vector3();
    this._cq = new THREE.Vector3();
    this._at = new THREE.Vector3();
    this.vib = { p: new THREE.Vector3(), t: -99, amp: 0 };
    this.t = 0;
  }

  node(p, anchored = false) {
    this.nodes.push(p.clone());
    this.anchored.push(anchored);
    return this.nodes.length - 1;
  }

  edge(a, b, k) {
    if (a === b) return -1;
    this.edges.push({ a, b, k, broken: false, strength: strengthOf(k), sticky: !!SILK[k].sticky, entangle: !!SILK[k].entangle });
    return this.edges.length - 1;
  }

  // Build the drawing, the lookup grid and the bounds; start living.
  finish() {
    const { silkMat } = mats();
    const g = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    g.translate(0, 0.5, 0);
    this.mesh = new THREE.InstancedMesh(g, silkMat, this.edges.length);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 2;
    for (let i = 0; i < this.edges.length; i++) this._place(i);
    this.game.scene.add(this.mesh);
    // Glue droplets (only drawn up close, see _drops).
    this.drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mats().glueMat, 3000);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    this.drops.renderOrder = 3;
    this.game.scene.add(this.drops);
    this._lastDropCam = new THREE.Vector3(1e9, 0, 0);
    this.bounds = new THREE.Box3();
    for (const p of this.nodes) this.bounds.expandByPoint(p);
    this.bounds.expandByScalar(0.01);
    this._regrid();
    // Feeling things touch it, every physics step (so a fast tiny you can't skip through).
    this.game.playerConstraints = this.game.playerConstraints || [];
    this._constraint = (pl) => this._touch(pl);
    this.game.playerConstraints.push(this._constraint);
    this.game.updatables.add(this);
    this.game.webs = this.game.webs || [];
    this.game.webs.push(this);
    return this;
  }

  _place(i) {
    const e = this.edges[i];
    const A = this.nodes[e.a], B = this.nodes[e.b];
    const len = A.distanceTo(B);
    if (e.broken || len < 1e-9) {
      _m.makeScale(0, 0, 0);
    } else {
      _quat.setFromUnitVectors(UP, _p.subVectors(B, A).divideScalar(len));
      const r = SILK[e.k].r;
      _m.compose(A, _quat, _s.set(r, len, r));
    }
    this.mesh.setMatrixAt(i, _m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  _regrid() {
    this.grid.clear();
    const c = this.cell;
    this.edges.forEach((e, i) => {
      const A = this.nodes[e.a], B = this.nodes[e.b];
      const x0 = Math.floor(Math.min(A.x, B.x) / c), x1 = Math.floor(Math.max(A.x, B.x) / c);
      const y0 = Math.floor(Math.min(A.y, B.y) / c), y1 = Math.floor(Math.max(A.y, B.y) / c);
      const z0 = Math.floor(Math.min(A.z, B.z) / c), z1 = Math.floor(Math.max(A.z, B.z) / c);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const k = `${x},${y},${z}`;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(i);
      }
    });
  }

  // Edges whose cells overlap a box around p.
  near(p, r, out = new Set()) {
    const c = this.cell;
    for (let x = Math.floor((p.x - r) / c); x <= Math.floor((p.x + r) / c); x++)
      for (let y = Math.floor((p.y - r) / c); y <= Math.floor((p.y + r) / c); y++)
        for (let z = Math.floor((p.z - r) / c); z <= Math.floor((p.z + r) / c); z++) {
          const l = this.grid.get(`${x},${y},${z}`);
          if (l) for (const i of l) out.add(i);
        }
    return out;
  }

  // Nearest point on any unbroken thread within maxD of p (for spiders' feet). Returns null if none.
  pointOnThreads(p, maxD, out, { dryOnly = false } = {}) {
    let best = maxD * maxD, found = false;
    for (const i of this.near(p, maxD)) {
      const e = this.edges[i];
      if (e.broken || (dryOnly && e.sticky)) continue;
      const A = this.nodes[e.a], B = this.nodes[e.b];
      _d1.subVectors(B, A);
      const t = clamp(_d2.subVectors(p, A).dot(_d1) / Math.max(1e-18, _d1.lengthSq()), 0, 1);
      _q.copy(A).addScaledVector(_d1, t);
      const d = _q.distanceToSquared(p);
      if (d < best) {
        best = d;
        out.copy(_q);
        found = true;
      }
    }
    return found ? out : null;
  }

  nearestNode(p, { dryOnly = false } = {}) {
    let best = Infinity, bi = -1;
    for (let i = 0; i < this.nodes.length; i++) {
      if (dryOnly && !this._dryNode(i)) continue;
      const d = this.nodes[i].distanceToSquared(p);
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    return bi;
  }

  _dryNode(i) {
    this._adj ??= this._buildAdj();
    return this._adj[i].some(([, ei]) => !this.edges[ei].sticky && !this.edges[ei].broken);
  }

  _buildAdj() {
    const adj = this.nodes.map(() => []);
    this.edges.forEach((e, i) => {
      adj[e.a].push([e.b, i]);
      adj[e.b].push([e.a, i]);
    });
    return adj;
  }

  // Shortest way along unbroken threads (spiders walk on the dry ones when they can).
  path(from, to, { avoidSticky = true } = {}) {
    this._adj ??= this._buildAdj();
    const n = this.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const done = new Uint8Array(n);
    dist[from] = 0;
    // Small webs: a simple O(n^2) Dijkstra is fast enough and keeps the code obvious.
    for (let it = 0; it < n; it++) {
      let u = -1, bd = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < bd) {
        bd = dist[i];
        u = i;
      }
      if (u < 0 || u === to) break;
      done[u] = 1;
      for (const [v, ei] of this._adj[u]) {
        const e = this.edges[ei];
        if (e.broken) continue;
        const w = this.nodes[u].distanceTo(this.nodes[v]) * (e.sticky && avoidSticky ? 6 : 1);
        if (dist[u] + w < dist[v]) {
          dist[v] = dist[u] + w;
          prev[v] = u;
        }
      }
    }
    if (from !== to && prev[to] < 0) return null;
    const out = [to];
    for (let u = to; u !== from; u = prev[u]) out.push(prev[u]);
    return out.reverse();
  }

  vibrate(p, amp) {
    this.vib.p.copy(p);
    this.vib.t = this.t;
    this.vib.amp = Math.max(amp, this.t - this.vib.t < 0.3 ? this.vib.amp : 0);
  }

  _break(i, why = 'break') {
    const e = this.edges[i];
    if (e.broken) return;
    e.broken = true;
    this._place(i);
    this.vibrate(this.nodes[e.a].clone().lerp(this.nodes[e.b], 0.5), 1.5);
    if (why === 'walk') this.game.player.silkOn = Math.min(12, (this.game.player.silkOn || 0) + 1);
  }

  // ---- you and the web (every physics step) -------------------------------------------------------
  _touch(pl) {
    if (pl.dead || pl.heldBy) return;
    const H = pl.height, r = pl.radius;
    _p.copy(pl.feet).addScaledVector(UP, H * 0.5);
    if (!this.bounds.containsPoint(_p) && this.bounds.distanceToPoint(_p) > H + pl.feet.distanceTo(pl.prevFeet)) return;
    const strong = playerStrength(H);
    // Check the whole way you moved this step, in slices thinner than you (threads are far thinner
    // than a step: without this a fast tiny you could hop right through a web).
    const from = this._from.copy(pl.prevFeet), to = this._to.copy(pl.feet);
    const n = clamp(Math.ceil(from.distanceTo(to) / (r * 0.7)), 1, 24);
    const cand = this.near(_p.lerpVectors(from, to, 0.5).addScaledVector(UP, H * 0.5), H * 0.6 + from.distanceTo(to) * 0.5 + 0.002);
    const cp = this._cp, cq = this._cq, at = this._at;
    for (let k = 1; k <= n; k++) {
      at.lerpVectors(from, to, k / n);
      _a.copy(at).addScaledVector(UP, r);
      _b.copy(at).addScaledVector(UP, Math.max(r, H - r));
      for (const i of cand) {
        const e = this.edges[i];
        if (e.broken) continue;
        const A = this.nodes[e.a], B = this.nodes[e.b];
        const rr = r + SILK[e.k].r;
        const d2 = segSeg(_a, _b, A, B, cp, cq);
        if (d2 >= rr * rr) continue;
        if (strong > e.strength * 1.5) {
          // You're far stronger: it snaps as you walk through (and some of it sticks to you).
          this._break(i, 'walk');
          continue;
        }
        if (e.sticky || e.entangle) {
          pl.feet.copy(at);
          this._catch(pl, i, cq);
          return;
        }
        // A dry thread you can't break: it stops you like a tight rope.
        const d = Math.sqrt(d2);
        const push = _q.subVectors(cp, cq);
        if (d > 1e-9) push.divideScalar(d);
        else push.set(1, 0, 0);
        if (push.y < 0) push.y = 0;
        push.normalize();
        pl.feet.copy(at).addScaledVector(push, rr - d + r * 0.02);
        this.vibrate(cq, 0.4);
        return;
      }
    }
  }

  _catch(pl, i, at) {
    const e = this.edges[i];
    this.stuck = { edges: new Set([i]), point: pl.feet.clone().addScaledVector(UP, pl.height * 0.5), lift: 0, liftTo: 0, gum: null };
    pl.grabbed(this);
    this.vibrate(at, 2);
    // A black widow's gumfoot line: it pops off the floor and the line springs up, lifting you.
    if (e.k === 'gumfoot') {
      const bottom = this.anchored[e.a] && this.nodes[e.a].y < this.nodes[e.b].y ? e.a : e.b;
      const top = bottom === e.a ? e.b : e.a;
      this.anchored[bottom] = false;
      this.stuck.gum = { bottom, top };
      this.stuck.liftTo = Math.min(0.02, this.nodes[top].distanceTo(this.nodes[bottom]) * 0.55);
      bus.emit('toast', { text: 'A black widow trip line snapped off the floor and yanked you up! Grow (hold X) to snap the silk', secs: 5 });
    } else {
      bus.emit('toast', { text: 'Stuck in spider silk! At this size it\'s stronger than you, and struggling tangles you more. Grow (hold X) to snap it', secs: 5 });
    }
  }

  holdHint(touch) {
    return touch ? 'Grow to snap the silk (struggling tangles you more)' : 'Hold <kbd>X</kbd> to grow and snap the silk (struggling tangles you more)';
  }

  // What's holding you: the threads you're tangled in (plus their glue).
  holdingForce() {
    if (!this.stuck) return 0;
    let f = 0;
    for (const i of this.stuck.edges) if (!this.edges[i].broken) f += this.edges[i].strength * (this.edges[i].sticky ? 1.6 : 1);
    // Wrapped by the spider: bands of fine silk around you (about as strong as eight frame lines).
    f += (this.game.player.wrapped || 0) * 8 * strengthOf('frame');
    return f;
  }

  release(pl, why) {
    if (!this.stuck) return;
    for (const i of this.stuck.edges) this._break(i);
    this.stuck = null;
    if (pl.heldBy === this) pl.released(this, new THREE.Vector3(0, Math.sqrt(pl.height) * 0.3, 0));
    if (why) bus.emit('toast', why);
  }

  // ---- per frame ---------------------------------------------------------------------------------
  update(dt) {
    this.t += dt;
    const pl = this.game.player;
    const S = this.stuck;
    if (S) {
      if (pl.heldBy !== this) {
        // Something else took you (the spider carrying you off), or you respawned.
        this.stuck = null;
      } else {
        // Hanging where the silk holds you (a gumfoot line lifts you as it springs back).
        if (S.gum) {
          S.lift = Math.min(S.liftTo, S.lift + dt * S.liftTo * 4);
          const bn = this.nodes[S.gum.bottom];
          bn.copy(S.point).addScaledVector(UP, S.lift);
          this.edges.forEach((e, i) => {
            if (e.a === S.gum.bottom || e.b === S.gum.bottom) this._place(i);
          });
        }
        _p.copy(S.point).addScaledVector(UP, S.lift);
        // Struggling makes the web shake.
        const shake = this.t - this.vib.t < 0.25 ? Math.sin(this.t * 60) * pl.height * 0.03 : 0;
        _p.x += shake;
        pl.holdAt(_p);
        const strong = playerStrength(pl.height);
        const hold = this.holdingForce();
        pl.struggle = clamp(strong / Math.max(1e-12, hold), 0, 0.99);
        if (!pl.dead && strong > hold) this.release(pl, 'You got strong enough to snap the silk!');
        else if (!pl.dead && (pl.paralysis ?? 0) < 0.85 && (input.pressed('jump') || input.pressed('interact'))) {
          // Pulling at it: not strong enough, so you just get more of it on you (real flies do this).
          this.vibrate(_p, 2.5);
          for (const i of this.near(_p, pl.height)) {
            const e = this.edges[i];
            if (e.broken || S.edges.has(i)) continue;
            if (this.nodes[e.a].distanceTo(_p) < pl.height * 1.2 || this.nodes[e.b].distanceTo(_p) < pl.height * 1.2) {
              S.edges.add(i);
              break;
            }
          }
        }
      }
    }
    this._drops();
    // Far away and tiny on screen: don't draw it at all.
    const cam = this.game.camera.position;
    const size = this.bounds.getSize(_q).length();
    this.mesh.visible = size / Math.max(1e-6, this.bounds.distanceToPoint(cam) + 1e-6) > 0.004;
  }

  // Glue droplets on sticky threads near the camera, when you're small enough to see them.
  _drops() {
    const pl = this.game.player, cam = this.game.camera.position;
    const R = clamp(pl.height * 6, 0.0015, 0.03);
    if (pl.height > 0.04 || this.bounds.distanceToPoint(cam) > R) {
      this.drops.count = 0;
      return;
    }
    if (this._lastDropCam.distanceTo(cam) < R * 0.2) return;
    this._lastDropCam.copy(cam);
    let n = 0;
    const max = this.drops.instanceMatrix.count;
    for (const i of this.near(cam, R)) {
      const e = this.edges[i];
      const glue = SILK[e.k].glue;
      if (e.broken || !glue) continue;
      const A = this.nodes[e.a], B = this.nodes[e.b];
      const len = A.distanceTo(B);
      const step = glue * 5;
      const count = Math.min(400, Math.floor(len / step));
      for (let j = 1; j < count && n < max; j++) {
        _p.copy(A).lerp(B, j / count);
        if (_p.distanceToSquared(cam) > R * R) continue;
        const sz = glue * (0.7 + 0.6 * hash3(i, j, 0, 991));
        _m.compose(_p, _quat.identity(), _s.set(sz, sz * 0.9, sz));
        this.drops.setMatrixAt(n++, _m);
      }
      if (n >= max) break;
    }
    this.drops.count = n;
    this.drops.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.game.updatables.delete(this);
    this.game.playerConstraints = (this.game.playerConstraints || []).filter((f) => f !== this._constraint);
    this.mesh.removeFromParent();
    this.drops.removeFromParent();
    this.game.webs = (this.game.webs || []).filter((w) => w !== this);
  }
}

// ---- builders (every web is laid out the way that species really builds it) ------------------------

// Directions spread evenly over a sphere (Fibonacci), for probing around a spot.
function sphereDirs(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return out;
}

function rayHit(game, from, dir, max) {
  const physics = game.physics;
  return physics.raycast(from, dir, max, { predicate: (c) => { const o = physics.ownerOf(c); return !(o && (o.kind === 'creature' || o === game.player || o.held)); } });
}

// Orb web (garden orb weaver): frame lines glued to what's around, ~30 radial spokes, a hub, a free
// zone, then a sticky spiral wound from the outside in, about 3.5 mm apart.
export function buildOrbWeb(game, { center, normal, radius = 0.14, spokes = 28, spacing = 0.0035, owner = null, seed = 1 }) {
  const w = new Web(game, { name: 'Orb web', owner });
  const n = normal.clone().normalize();
  const ax = new THREE.Vector3().crossVectors(n, UP);
  if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
  ax.normalize();
  const ay = new THREE.Vector3().crossVectors(ax, n).normalize(); // "up" in the web's plane
  const P = (ang, d) => center.clone().addScaledVector(ax, Math.cos(ang) * d).addScaledVector(ay, Math.sin(ang) * d);
  // Anchor lines: the spider glues its frame to the nearest solid things all around (branches, the
  // ground): look in 16 directions in the web's plane, keep the closest hit in each of 5 sectors.
  const anchors = [];
  const sectors = 5;
  for (let k = 0; k < sectors; k++) {
    let best = null;
    for (let j = 0; j < 4; j++) {
      const ang = ((k + (j + 0.5) / 4) / sectors) * Math.PI * 2 + (hash3(k, j, seed, 71) - 0.5) * 0.2;
      const dir = P(ang, 1).sub(center).normalize();
      const hit = rayHit(game, center, dir, radius * 6);
      if (hit && hit.dist > radius * 0.9 && (!best || hit.dist < best.d)) best = { ang, d: hit.dist, p: hit.point.clone(), solid: true };
    }
    if (!best) {
      const ang = ((k + 0.5) / sectors) * Math.PI * 2;
      best = { ang, d: radius * 1.6, p: P(ang, radius * 1.6), solid: false };
    }
    anchors.push(best);
  }
  // Frame polygon: just inside the anchors.
  const corners = anchors.map((a) => ({ ang: a.ang, d: Math.min(a.d * 0.85, radius * 1.25), i: -1, ai: -1 }));
  for (const c of corners) {
    c.i = w.node(P(c.ang, c.d));
  }
  corners.forEach((c, k) => {
    const an = anchors[k];
    c.ai = w.node(an.p, an.solid);
    w.edge(c.ai, c.i, 'frame');
    w.edge(c.i, corners[(k + 1) % corners.length].i, 'frame');
  });
  // Where a spoke at angle `ang` meets the frame polygon (2D, in the web plane).
  const frameDist = (ang) => {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let best = radius * 1.2;
    for (let k = 0; k < corners.length; k++) {
      const c0 = corners[k], c1 = corners[(k + 1) % corners.length];
      const x0 = Math.cos(c0.ang) * c0.d, y0 = Math.sin(c0.ang) * c0.d, x1 = Math.cos(c1.ang) * c1.d, y1 = Math.sin(c1.ang) * c1.d;
      const ex = x1 - x0, ey = y1 - y0, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-9) continue;
      const t = (x0 * ey - y0 * ex) / den, u = (x0 * dy - y0 * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
    }
    return best;
  };
  // Spokes: nodes along each one where the hub ring and the spiral cross it.
  const hub = w.node(center);
  const hubR = radius * 0.06, freeR = radius * 0.17;
  const spokeAng = [], spokeLen = [], spokeNodes = [];
  for (let j = 0; j < spokes; j++) {
    const ang = (j / spokes) * Math.PI * 2 + (hash3(j, seed, 2, 72) - 0.5) * 0.06;
    spokeAng.push(ang);
    spokeLen.push(frameDist(ang));
    spokeNodes.push([]);
  }
  // Hub: a few tight non-sticky rings.
  const hubRings = 4;
  const ring = [];
  for (let q = 1; q <= hubRings; q++) {
    const row = [];
    for (let j = 0; j < spokes; j++) {
      const id = w.node(P(spokeAng[j], (q / hubRings) * hubR));
      spokeNodes[j].push({ d: (q / hubRings) * hubR, id });
      row.push(id);
    }
    ring.push(row);
  }
  for (const row of ring) for (let j = 0; j < spokes; j++) w.edge(row[j], row[(j + 1) % spokes], 'hub');
  // Capture spiral: one continuous sticky line, from the outside in.
  let prev = -1;
  const outer = 0.9;
  for (let s = 0; ; s++) {
    const j = s % spokes;
    const d = spokeLen[j] * outer - (s / spokes) * spacing;
    if (d < freeR) break;
    const id = w.node(P(spokeAng[j], d));
    spokeNodes[j].push({ d, id });
    if (prev >= 0) w.edge(prev, id, 'capture');
    prev = id;
  }
  // Spoke threads: hub center -> nodes in order -> the frame.
  for (let j = 0; j < spokes; j++) {
    const list = spokeNodes[j].sort((a, b) => a.d - b.d);
    let last = hub;
    for (const nd of list) {
      w.edge(last, nd.id, 'radial');
      last = nd.id;
    }
    const fid = w.node(P(spokeAng[j], spokeLen[j]));
    w.edge(last, fid, 'radial');
    // The frame node is on the frame line: join it to the nearest frame corner so it hangs off it.
    let bk = 0, bd = Infinity;
    corners.forEach((c, k) => {
      const dd = w.nodes[c.i].distanceTo(w.nodes[fid]);
      if (dd < bd) {
        bd = dd;
        bk = k;
      }
    });
    w.edge(fid, corners[bk].i, 'frame');
  }
  w.hub = hub;
  w.plane = { center: center.clone(), normal: n, ax, ay };
  return w.finish();
}

// Black widow cobweb: a messy 3D tangle in a sheltered corner, a dense retreat right in the corner,
// and sticky gumfoot lines running straight down to the floor.
export function buildTangleWeb(game, { center, size = 0.18, corner = null, gumfoots = 9, owner = null, seed = 2 }) {
  const w = new Web(game, { name: 'Black widow cobweb', owner });
  const anchors = [];
  for (const d of sphereDirs(30)) {
    const hit = rayHit(game, center, d, size * 1.6);
    if (hit) anchors.push({ p: hit.point.clone(), n: hit.normal.clone(), id: w.node(hit.point, true) });
  }
  // Tangle nodes: a loose cloud, denser up high (the widow hangs in the upper part).
  const inner = [];
  for (let i = 0; i < 26; i++) {
    const p = center.clone().add(new THREE.Vector3((hash3(i, seed, 1, 81) - 0.5) * size, (hash3(i, seed, 2, 81) - 0.25) * size * 0.7, (hash3(i, seed, 3, 81) - 0.5) * size));
    inner.push({ p, id: w.node(p) });
  }
  const link = (from, list, k, kind) => {
    const sorted = list.filter((x) => x.id !== from.id).sort((a, b) => a.p.distanceToSquared(from.p) - b.p.distanceToSquared(from.p));
    for (let i = 0; i < Math.min(k, sorted.length); i++) w.edge(from.id, sorted[i].id, kind);
  };
  for (const n of inner) {
    link(n, inner, 3, 'tangle');
    link(n, anchors, 2, 'tangle');
  }
  // Retreat: a dense little knot of silk tucked into the corner.
  if (corner) {
    const rc = corner.clone();
    const knot = [];
    for (let i = 0; i < 16; i++) {
      const p = rc.clone().add(new THREE.Vector3((hash3(i, seed, 4, 82) - 0.5) * 0.03, (hash3(i, seed, 5, 82)) * 0.03, (hash3(i, seed, 6, 82) - 0.5) * 0.03));
      knot.push({ p, id: w.node(p) });
    }
    for (const n of knot) link(n, knot, 4, 'retreat');
    link(knot[0], inner, 3, 'tangle');
    w.retreat = knot[0].id;
  }
  // Gumfoot lines from the lower tangle straight down to the floor, sticky at the bottom.
  const low = inner.slice().sort((a, b) => a.p.y - b.p.y).slice(0, gumfoots);
  for (const n of low) {
    const hit = rayHit(game, n.p, new THREE.Vector3(0, -1, 0), size * 3);
    if (!hit || hit.normal.y < 0.7) continue;
    const foot = hit.point.clone();
    const mid = foot.clone().add(new THREE.Vector3(0, Math.min(0.015, n.p.y - foot.y - 0.002), 0));
    const m = w.node(mid), f = w.node(foot, true);
    w.edge(n.id, m, 'support');
    w.edge(f, m, 'gumfoot');
  }
  w.hub = inner.slice().sort((a, b) => b.p.y - a.p.y)[0].id; // where she hangs: up in the tangle
  return w.finish();
}

// Cellar spider web: a loose, irregular sheet and tangle hanging in a ceiling corner.
export function buildSheetWeb(game, { center, size = 0.22, owner = null, seed = 3 }) {
  const w = new Web(game, { name: 'Cellar spider web', owner });
  const anchors = [];
  for (const d of sphereDirs(26)) {
    if (d.y < -0.2) continue; // anchored up and to the sides (walls, ceiling)
    const hit = rayHit(game, center, d, size * 1.5);
    if (hit) anchors.push({ p: hit.point.clone(), id: w.node(hit.point, true) });
  }
  const inner = [];
  for (let i = 0; i < 34; i++) {
    const p = center.clone().add(new THREE.Vector3((hash3(i, seed, 1, 91) - 0.5) * size, (hash3(i, seed, 2, 91) - 0.6) * size * 0.35, (hash3(i, seed, 3, 91) - 0.5) * size));
    inner.push({ p, id: w.node(p) });
  }
  const link = (from, list, k) => {
    const sorted = list.filter((x) => x.id !== from.id).sort((a, b) => a.p.distanceToSquared(from.p) - b.p.distanceToSquared(from.p));
    for (let i = 0; i < Math.min(k, sorted.length); i++) w.edge(from.id, sorted[i].id, 'sheet');
  };
  for (const n of inner) {
    link(n, inner, 4);
    link(n, anchors, 1);
  }
  w.hub = inner.slice().sort((a, b) => a.p.distanceToSquared(center) - b.p.distanceToSquared(center))[0].id;
  return w.finish();
}
