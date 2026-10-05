// Tiny people living in the terrarium: they get hungry and thirsty (and die if
// nobody feeds them), drink at the pond, eat what you drop in, pick up the tools
// you give them, chop logs with an axe and break stone off rocks with a pickaxe,
// and build a campfire and shelters from those materials, one real piece at a time.
//
// They walk on their own navmesh at their scale (rocks, logs and anything they
// build block the way), carry things with their hands placed on them (IK), and
// the terrarium's glass, ground and rocks are all real colliders.
import * as THREE from 'three';
import { Navigation, initNavigation } from '../engine/navigation.js';
import { collectTriangles, GROUP, groups } from '../engine/physics.js';
import { solveTwoBone } from '../engine/anim.js';
import { pieceMesh, K, POLE } from './items.js';
import { Site, Fire, nextBlueprint, BLUEPRINTS } from './buildings.js';

// The tiny navmesh is built 20x bigger than the tank, so to Recast/Detour the
// tiny people are full size: its built-in distances (e.g. it drops path corners
// closer than 1 cm, which is 20 cm at their size) then work as designed.
// ScaledNav below converts to and from that space; everything outside it is
// in world meters.
const NS = 20;
const NAV = {
  cs: 0.004 * NS, ch: 0.002 * NS,
  walkableSlopeAngle: 42,
  walkableHeight: 40,     // 8 cm of headroom
  walkableClimb: 8,       // 1.6 cm steps (30 cm to them)
  walkableRadius: 3,      // 1.2 cm from walls and rocks
  maxEdgeLen: 60, maxSimplificationError: 1.3, minRegionArea: 12, mergeRegionArea: 30,
  maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1,
};
const EXT = { x: 0.03, y: 0.05, z: 0.03 };             // how far to look for the navmesh
const GROUND = groups(GROUP.NPC, GROUP.WORLD);           // feet stand on the ground and rocks
const DROP_HIT = groups(GROUP.NPC, GROUP.WORLD | GROUP.PROP);
const GRAVITY = 9.81;

// needs: full to empty in 10 minutes (food) / 7 minutes (water); then health drains
const DRAIN = { hunger: 100 / 600, thirst: 100 / 420, health: 100 / 100 };
const FOOD = 45;
const WATER = 55;
const FIRE_FUEL = 180; // seconds of fire per pole
const IDLE = ['idle_look_around_01', 'idle_look_around_02', 'idle_scratch_head_01', 'idle_stretch_arms_01', 'idle_touch_face_01', 'idle_breathe_01'];
const TALK = ['gestic_talk_neutral_01', 'gestic_talk_neutral_02', 'gestic_talk_relaxed_01', 'gestic_talk_excited_01', 'gestic_talk_self-assured_01'];
const LISTEN = ['gestic_listen_neutral_01', 'gestic_listen_neutral_02', 'gestic_listen_accept_01', 'gestic_listen_relaxed_01'];
const pick = (a) => a[(Math.random() * a.length) | 0];
const smooth = (t) => t * t * (3 - 2 * t);
const PALM = new THREE.Vector3(0.075, 0.03, 0); // grip center seen from the wrist (hand space, meters at full size)
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

// rotate a bone by a world-space rotation (keeps its children attached)
function rotateBoneWorld(bone, axis, angle) {
  if (!bone || !angle) return;
  const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  const r = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(pq.clone().invert().multiply(r).multiply(pq));
  bone.updateMatrixWorld(true);
}

class ScaledNav {
  constructor(group) {
    this.group = group;
    this.nav = new Navigation();
  }
  toN(w) { const l = this.group.worldToLocal(new THREE.Vector3(w.x, w.y, w.z)); return { x: l.x * NS, y: l.y * NS, z: l.z * NS }; }
  toW(n) { return this.group.localToWorld(new THREE.Vector3(n.x / NS, n.y / NS, n.z / NS)); }
  ext(e) { return { x: e.x * NS, y: e.y * NS, z: e.z * NS }; }
  build(tris, config, opts) { this.nav.build(tris, config, opts); }
  closest(w, e = EXT) { const q = this.nav.closest(this.toN(w), this.ext(e)); return q ? this.toW(q) : null; }
  addAgent(w, { radius, height, maxSpeed, maxAcceleration }) {
    const raw = this.nav.addAgent(this.toN(w), { radius: radius * NS, height: height * NS, maxSpeed: maxSpeed * NS, maxAcceleration: maxAcceleration * NS });
    const sn = this;
    return {
      raw,
      position: () => sn.toW(raw.position()),
      velocity: () => { const v = raw.velocity(); return { x: v.x / NS, y: v.y / NS, z: v.z / NS }; },
      requestMoveTarget: (w2) => raw.requestMoveTarget(sn.toN(w2)),
      resetMoveTarget: () => raw.resetMoveTarget(),
      updateParameters: (p) => raw.updateParameters(p.maxSpeed != null ? { ...p, maxSpeed: p.maxSpeed * NS } : p),
    };
  }
  removeAgent(a) { if (a) this.nav.removeAgent(a.raw); }
  // can you actually walk from a to b? (not onto a boulder top or across the pond)
  reachable(a, b, tol = 0.02) {
    const path = this.nav.path(this.toN(a), this.toN(b));
    if (!path?.length) return false;
    const end = this.toW(path[path.length - 1]);
    return Math.hypot(end.x - b.x, end.z - b.z) < tol && Math.abs(end.y - b.y) < 0.03;
  }
  addObstacle(w, { radius, height, half, angle } = {}) {
    return this.nav.addObstacle(this.toN(w), half ? { half: this.ext(half), angle } : { radius: radius * NS, height: height * NS });
  }
  removeObstacle(o) { this.nav.removeObstacle(o); }
  update(dt) { this.nav.update(dt); }
}

// ------------------------------------------------------------------ pieces

class Piece {
  constructor(kind, mesh) {
    this.kind = kind;
    this.mesh = mesh;
    this.state = 'falling';   // falling | floating | ground | stock | carried | tool | gone
    this.vel = new THREE.Vector3();
    this.claimedBy = null;
    this.body = null;         // small static collider while it lies somewhere
    this.reach = null;        // where a tiny person stands to pick it up (world, on the navmesh)
    this.owner = null;        // tools: who carries it
  }
  get isTool() { return this.kind === 'axe' || this.kind === 'pickaxe'; }
}

// ------------------------------------------------------------------ colony

export class Colony {
  constructor({ cage, physics, settings }) {
    this.cage = cage;
    this.tiny = cage.tiny;
    this.group = cage.group;      // terrarium: people and pieces live in its space
    this.world = cage.tiny.world;
    this.physics = physics;
    this.settings = settings;
    this.nav = new ScaledNav(cage.group);
    this.pieces = [];
    this.sites = [];
    this.site = null;             // building in progress
    this.built = [];
    this.fire = null;
    this.residents = new Map();   // human -> Resident
    this.center = null;           // where the camp is (terrarium space)
    this.stock = null;            // stockpile spot
    this.stockCount = { wood: 0, stone: 0, food: 0 };
    this.fx = [];
    this.ready = false;
    this.log = [];                // what happened (for tests and the phone later)
    this.player = null;           // you (set by the game): when you shrink in, they react
    this.vitals = null;
  }

  toWorld(v) { return this.group.localToWorld(new THREE.Vector3(v.x, v.y, v.z)); }
  toLocal(v) { return this.group.worldToLocal(new THREE.Vector3(v.x, v.y, v.z)); }
  note(msg) { this.log.push({ t: performance.now(), msg }); if (this.log.length > 200) this.log.shift(); }

  async init() {
    await initNavigation();
    const t0 = performance.now();
    // ground triangles, minus deep water and the lava pit (people only wade in the shallows)
    const g = this.tiny.ground;
    g.updateMatrixWorld(true);
    const pos = g.geometry.attributes.position;
    const idx = g.geometry.index;
    // (in navmesh space: terrarium space x20)
    const scaled = (wx, wy, wz) => { _v.set(wx, wy, wz); this.group.worldToLocal(_v); return [_v.x * NS, _v.y * NS, _v.z * NS]; };
    const vertices = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(g.matrixWorld);
      vertices.set(scaled(_v.x, _v.y, _v.z), i * 3);
    }
    const indices = [];
    const lava = this.tiny.features.lava;
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
      const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
      if (this.cage.waterDepth(x, z) > 0.006) continue;
      if (Math.hypot(x - lava.x, z - lava.z) < lava.r * 1.25) continue;
      indices.push(a, b, c);
    }
    const solid = collectTriangles(this.tiny.solid);
    for (let i = 0; i < solid.vertices.length; i += 3) solid.vertices.set(scaled(solid.vertices[i], solid.vertices[i + 1], solid.vertices[i + 2]), i);
    this.nav.build([{ vertices, indices }, solid], NAV, { obstacles: 64, maxAgentRadius: 0.6, tileSize: 48 });
    this.navMs = Math.round(performance.now() - t0);
    this.chooseCamp();
    this.fire = new Fire(this.world, this.center.clone().add(new THREE.Vector3(0, 0.001, 0)));
    this.fireBuilt = false;
    this.ready = true;
  }

  // is there walkable ground right here (not in a rock, not in the water)?
  walkable(local, tol = 0.004) {
    const q = this.nav.closest(this.toWorld(local), EXT);
    if (!q) return false;
    const l = this.toLocal(q);
    return Math.hypot(l.x - local.x, l.z - local.z) < tol;
  }

  // flat, dry, walkable ground in a circle of radius r around (x, z)?
  clearCircle(x, z, r) {
    const y0 = this.cage.surfaceY(x, z);
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = i === 8 ? x : x + Math.cos(a) * r;
      const pz = i === 8 ? z : z + Math.sin(a) * r;
      if (Math.abs(px) > 1.45 - 0.03 || Math.abs(pz) > 0.9 - 0.03) return false;
      const y = this.cage.surfaceY(px, pz);
      if (Math.abs(y - y0) > 0.006) return false;
      if (!this.walkable(new THREE.Vector3(px, y, pz))) return false;
    }
    // grass and ferns would poke through a hut
    for (const p of this.tiny.plants.children) if (Math.hypot(p.position.x - x, p.position.z - z) < r + 0.012) return false;
    for (const s of this.sites) if (Math.hypot(s.group.position.x - x, s.group.position.z - z) < r + s.bp.radius + 0.03) return false;
    if (this.stock && Math.hypot(this.stock.x - x, this.stock.z - z) < r + 0.04) return false;
    return true;
  }

  // The camp: flat open ground, a short walk from the pond, far from the lava,
  // toward the front of the tank (where you usually stand).
  chooseCamp() {
    const { pond, lava } = this.tiny.features;
    let best = null;
    for (let x = -1.2; x <= 1.2; x += 0.05) {
      for (let z = -0.65; z <= 0.65; z += 0.05) {
        const dp = Math.hypot(x - pond.x, z - pond.z);
        const dl = Math.hypot(x - lava.x, z - lava.z);
        if (dp < pond.r + 0.12 || dl < lava.r + 0.4) continue;
        if (!this.clearCircle(x, z, 0.05)) continue;
        const score = -Math.abs(dp - (pond.r + 0.3)) * 2 + z * 0.3 - Math.abs(x) * 0.1;
        if (!best || score > best.score) best = { x, z, score };
      }
    }
    if (!best) best = { x: 0, z: 0.3 };
    this.center = new THREE.Vector3(best.x, this.cage.surfaceY(best.x, best.z), best.z);
    // stockpile: beside the fire, on the side toward the pond
    const toPond = Math.atan2(pond.z - best.z, pond.x - best.x);
    for (let i = 0; i < 12; i++) {
      const a = toPond + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5;
      const x = best.x + Math.cos(a) * 0.075, z = best.z + Math.sin(a) * 0.075;
      if (this.clearCircle(x, z, 0.02)) { this.stock = new THREE.Vector3(x, this.cage.surfaceY(x, z), z); this.stockYaw = a; break; }
    }
    this.stock ??= this.center.clone().add(new THREE.Vector3(0.07, 0, 0));
    this.stockYaw ??= 0;
  }

  // a spot for the next building: the fire in the middle, shelters around it facing the fire
  siteSpot(key) {
    const bp = BLUEPRINTS[key];
    if (key === 'campfire') return { pos: this.center.clone(), yaw: 0 };
    for (let ring = 0; ring < 6; ring++) {
      const R = 0.13 + ring * 0.03 + bp.radius;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + ring * 0.37;
        const x = this.center.x + Math.cos(a) * R, z = this.center.z + Math.sin(a) * R;
        if (!this.clearCircle(x, z, bp.radius)) continue;
        return { pos: new THREE.Vector3(x, this.cage.surfaceY(x, z), z), yaw: Math.atan2(this.center.x - x, this.center.z - z) };
      }
    }
    return null;
  }

  startSite(key) {
    const spot = this.siteSpot(key);
    if (!spot) return null;
    const site = new Site(key, this.world, spot.pos, spot.yaw);
    const o = site.bp.obstacle;
    const c = spot.pos.clone();
    if (o.offset) c.add(o.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spot.yaw));
    // the footprint blocks the way from now on (nobody walks through a half-built wall)
    site.obstacle = this.nav.addObstacle(this.toWorld(c), o.half ? { half: o.half, angle: spot.yaw } : { radius: o.radius, height: o.height });
    this.sites.push(site);
    this.note(`started ${site.bp.name}`);
    return site;
  }

  // ---- pieces

  // You pour things in: they fall from above the aim point and land where they land.
  drop(kind, local, count = 1) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const mesh = pieceMesh(kind);
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (count > 1 ? 0.016 : 0);
      mesh.position.set(local.x + Math.cos(a) * r, local.y + 0.22 + i * 0.012, local.z + Math.sin(a) * r);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.world.add(mesh);
      const p = new Piece(kind, mesh);
      p.vel.set((Math.random() - 0.5) * 0.08, -0.2, (Math.random() - 0.5) * 0.08);
      p.spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(12);
      this.pieces.push(p);
      out.push(p);
    }
    this.note(`dropped ${count} ${kind}`);
    return out;
  }

  // lying on the ground at a spot (made by chopping/mining, or dropped by someone)
  spawnOnGround(kind, local) {
    const p = new Piece(kind, pieceMesh(kind));
    this.world.add(p.mesh);
    p.mesh.position.copy(local);
    this.pieces.push(p);
    this.settle(p, local, new THREE.Vector3(0, 1, 0));
    return p;
  }

  // come to rest lying on a surface: flat things lie flat, turned at random
  settle(p, local, normal) {
    const m = p.mesh;
    const up = new THREE.Vector3(0, 1, 0);
    const tilt = new THREE.Quaternion().setFromUnitVectors(up, normal.clone().normalize());
    const yaw = new THREE.Quaternion().setFromAxisAngle(up, Math.random() * Math.PI * 2);
    if (p.isTool) {
      // tools lie on their side: handle flat on the ground
      m.quaternion.copy(tilt).multiply(yaw).multiply(_q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2));
    } else if (p.kind === 'wood') {
      m.quaternion.copy(tilt).multiply(yaw).multiply(_q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.random() * Math.PI * 2));
    } else {
      m.quaternion.copy(tilt).multiply(yaw);
    }
    m.position.copy(local).addScaledVector(normal, m.userData.rest ?? 0.002);
    p.state = 'ground';
    p.vel.set(0, 0, 0);
    this.updateReach(p);
    this.addCollider(p);
  }

  addCollider(p) {
    this.removeCollider(p);
    p.mesh.updateMatrixWorld(true);
    p.body = this.physics.addStaticMesh(p.mesh, { group: GROUP.PROP })?.body ?? null;
  }

  removeCollider(p) {
    if (p.body) { this.physics.world.removeRigidBody(p.body); p.body = null; }
  }

  // can someone get to it? (on dry walkable ground, not on top of a boulder or in deep water)
  updateReach(p) {
    const w = p.mesh.getWorldPosition(new THREE.Vector3());
    const q = this.nav.closest(w, EXT);
    p.reach = q && Math.hypot(q.x - w.x, q.z - w.z) < 0.016 && Math.abs(q.y - w.y) < 0.02 ? new THREE.Vector3(q.x, q.y, q.z) : null;
  }

  removePiece(p) {
    this.removeCollider(p);
    p.mesh.removeFromParent();
    p.state = 'gone';
    const i = this.pieces.indexOf(p);
    if (i >= 0) this.pieces.splice(i, 1);
    if (p.stockSlot != null) this.stockCount[p.kind] = Math.max(0, this.stockCount[p.kind] - 1);
  }

  updatePieces(dt) {
    const { pond } = this.tiny.features;
    for (const p of this.pieces) {
      if (p.state === 'falling') {
        const m = p.mesh;
        p.vel.y -= GRAVITY * dt;
        const step = p.vel.clone().multiplyScalar(dt);
        const from = this.toWorld(m.position);
        const len = step.length();
        const hit = len > 0 ? this.physics.raycast(from, step.clone().normalize(), len + (m.userData.rest ?? 0.002), { filterGroups: DROP_HIT, exclude: p.body?.collider }) : null;
        m.rotation.x += p.spin.x * dt; m.rotation.y += p.spin.y * dt; m.rotation.z += p.spin.z * dt;
        const l = m.position;
        // into the water: wood and bread float, stone and steel sink
        const water = this.cage.waterDepth(l.x, l.z) > 0 && l.y + step.y <= this.cage.waterY;
        if (water && (p.kind === 'wood' || p.kind === 'food')) {
          p.state = 'floating';
          l.y = this.cage.waterY;
          const a = Math.atan2(l.z - pond.z, l.x - pond.x);
          p.drift = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.004); // washes to the shore
          this.tiny.ripple?.(l, 1, `p${p.mesh.id}`);
          continue;
        }
        if (hit) {
          const local = this.toLocal(hit.point);
          if (this.cage.inLava(local.x, local.z)) { this.tiny.smoke?.(local); p.burned = true; continue; }
          this.settle(p, local, hit.normal.y > 0.3 ? hit.normal : new THREE.Vector3(0, 1, 0));
        } else {
          l.add(step);
          if (l.y < -0.5) p.burned = true; // fell out of the world somehow
        }
      } else if (p.state === 'floating') {
        const l = p.mesh.position;
        l.addScaledVector(p.drift, dt);
        l.y = this.cage.waterY + Math.sin(performance.now() / 600 + p.mesh.id) * 0.0004;
        p.mesh.rotation.y += dt * 0.1;
        // reached the shallows: it's stranded on the bank
        if (this.cage.waterDepth(l.x, l.z) < 0.001) this.settle(p, new THREE.Vector3(l.x, this.cage.surfaceY(l.x, l.z), l.z), new THREE.Vector3(0, 1, 0));
      }
    }
    for (const p of this.pieces.filter((q) => q.burned)) this.removePiece(p);
  }

  // stockpile layout: poles stacked in a crib, stones heaped, bread on a pile
  stockSpot(kind, n) {
    const yaw = this.stockYaw;
    const side = new THREE.Vector3(Math.cos(yaw + Math.PI / 2), 0, Math.sin(yaw + Math.PI / 2));
    const fwd = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const base = this.stock.clone();
    if (kind === 'wood') {
      const layer = Math.floor(n / 5), j = n % 5;
      const p = base.clone().addScaledVector(side, -0.012).addScaledVector(fwd, (j - 2) * POLE.radius * 2.3 + (layer % 2) * POLE.radius);
      p.y = this.cage.surfaceY(p.x, p.z) + POLE.radius + layer * POLE.radius * 1.9;
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), side);
      return { p, q };
    }
    const c = base.clone().addScaledVector(side, kind === 'stone' ? 0.03 : 0.045);
    const a = n * 2.4, r = Math.sqrt(n) * (kind === 'stone' ? 0.0042 : 0.0028);
    const p = c.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    p.y = this.cage.surfaceY(p.x, p.z) + (kind === 'stone' ? 0.003 : 0.002) + Math.max(0, 0.006 - r) * 0.5;
    return { p, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)) };
  }

  putInStock(p) {
    const n = this.stockCount[p.kind]++;
    const { p: at, q } = this.stockSpot(p.kind, n);
    p.mesh.position.copy(at);
    p.mesh.quaternion.copy(q);
    p.state = 'stock';
    p.stockSlot = n;
    this.updateReach(p);
    this.addCollider(p);
  }

  // nearest piece of these kinds that nobody has claimed and someone can reach
  findPiece(kinds, r, { stock = true, loose = true } = {}) {
    kinds = [].concat(kinds);
    const from = r.worldPos();
    let best = null, bestD = Infinity;
    for (const p of this.pieces) {
      if (!kinds.includes(p.kind) || p.claimedBy || !p.reach) continue;
      if (!((p.state === 'ground' && loose) || (p.state === 'stock' && stock))) continue;
      if (p.failedUntil > performance.now()) continue;
      const d = from.distanceTo(p.reach);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  // nearest log (for wood) or rock (for stone) with a spot to stand next to it
  findSource(kind, r) {
    const want = kind === 'wood' ? 'tiny-log' : 'tiny-rock';
    const from = r.worldPos();
    let best = null, bestD = Infinity;
    for (const o of this.tiny.solid.children) {
      if (o.name !== want) continue;
      if (kind === 'stone' && o.userData.tinySize === undefined) {
        const s = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
        o.userData.tinySize = Math.max(s.x, s.z);
      }
      if (kind === 'stone' && o.userData.tinySize < 0.025) continue; // too small to break up
      if (o.userData.failedUntil > performance.now()) continue;
      const bb = new THREE.Box3().setFromObject(o);
      const c = bb.getCenter(new THREE.Vector3());
      const size = bb.getSize(new THREE.Vector3());
      const d = from.distanceTo(c) + (o.userData.workers || 0) * 0.3;
      if (d < bestD) { best = { object: o, center: c, size: Math.max(size.x, size.z) }; bestD = d; }
    }
    return best;
  }

  // ---- people

  admit(human) {
    if (!this.ready || this.residents.has(human)) return;
    const r = new Resident(this, human);
    this.residents.set(human, r);
    this.note(`${human.profile.name} arrived`);
  }

  leave(human) {
    const r = this.residents.get(human);
    if (!r) return;
    r.dispose();
    this.residents.delete(human);
  }

  // you, shrunk into the tank: where you stand (world), or null
  get giant() {
    const p = this.player;
    return p && p.inCage && p.scale < 0.5 && !this.vitals?.dead ? p.feet : null;
  }

  // You punch (while tiny): the nearest tiny person in front of you, within arm's reach.
  punch(camera) {
    const p = this.player;
    if (!p || p.scale >= 0.5) return null;
    const eye = camera.position;
    const dir = camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    let best = null, bestD = Infinity;
    for (const r of this.residents.values()) {
      if (r.dead) continue;
      const to = r.worldPos().sub(p.feet);
      to.y = 0;
      const d = to.length();
      if (d > 0.9 * p.scale || to.normalize().dot(dir) < 0.5) continue;
      if (d < bestD) { best = r; bestD = d; }
    }
    best?.hurt(34, 'beaten by you', eye);
    return best;
  }

  describe(human) {
    return this.residents.get(human)?.describe() ?? null;
  }

  updateResident(human, dt) {
    const r = this.residents.get(human);
    if (r) r.update(dt);
  }

  update(dt) {
    if (!this.ready) return;
    dt = Math.min(0.1, Math.max(0, dt));
    this.nav.update(dt);
    this.updatePieces(dt);
    for (const s of this.sites) s.update(dt);
    this.fire?.update(dt);
    // anyone in the tank without a life here yet (dropped in before the camp was ready)
    for (const h of this.cage.residents) if (!h.dead && h.state === 'caged' && !this.residents.has(h)) this.admit(h);
    // the plan: what to build next
    if (!this.site && this.residents.size) {
      const key = nextBlueprint(this.built, [...this.residents.values()].filter((r) => !r.dead).length);
      if (key) this.site = this.startSite(key);
    }
    if (this.site?.done && !this.site.placing.length) this.finishSite(this.site);
    this.updateFx(dt);
  }

  finishSite(site) {
    this.built.push(site.key);
    this.site = null;
    this.note(`built ${site.bp.name}`);
    for (const r of this.residents.values()) r.celebrate(site);
  }

  // when the firewood goes into the ring, the fire is lit
  lightFire(site) {
    this.fire.group.position.copy(site.group.position).add(new THREE.Vector3(0, 0.001, 0));
    this.fire.addFuel(FIRE_FUEL);
    this.fireBuilt = true;
    this.note('fire lit');
  }

  // wood chips / stone grit flying off a hit
  chips(localPoint, kind) {
    const mat = kind === 'wood'
      ? new THREE.MeshStandardMaterial({ color: 0xc9a26b, roughness: 0.9 })
      : new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.9 });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 0.0004, 0.0006), mat);
      m.position.copy(localPoint);
      this.world.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.15 + Math.random() * 0.2, (Math.random() - 0.5) * 0.25);
      this.fx.push({ m, v, t: 0, life: 1.2 + Math.random() * 0.8 });
    }
  }

  updateFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const l = f.m.position;
      if (!f.rest) {
        f.v.y -= GRAVITY * dt;
        l.addScaledVector(f.v, dt);
        f.m.rotation.x += dt * 20; f.m.rotation.z += dt * 13;
        const g = this.cage.surfaceY(l.x, l.z);
        if (l.y < g) { l.y = g + 0.0002; f.rest = true; }
      }
      if (f.t > f.life + 4) { f.m.removeFromParent(); f.m.geometry.dispose(); this.fx.splice(i, 1); }
    }
  }
}

// ------------------------------------------------------------------ a resident

class Resident {
  constructor(colony, human) {
    this.c = colony;
    this.h = human;
    this.hunger = 70 + Math.random() * 30;
    this.thirst = 60 + Math.random() * 40;
    this.health = 100;
    this.carry = null;      // piece in hands / on the shoulder
    this.tool = null;       // axe or pickaxe
    this.pose = null;       // what the arms are doing (set by the current task)
    this.face = null;       // turn toward this (world)
    this.doing = 'looking around';
    this.co = null;         // current task (a generator)
    this.ikw = { R: 0, L: 0 };
    this.ikLast = { R: null, L: null };
    this.crouch = 0;
    this.dead = false;
    this.think = 0.5;
    this.threatCheck = 0;
    this.agent = null;
    this.wade = null;
    const s = human.scale;
    // stand on the navmesh if we landed on it; otherwise (in the pond) wade out first
    const w = this.worldPos();
    const q = colony.nav.closest(w, EXT);
    if (q && Math.hypot(q.x - w.x, q.z - w.z) < 0.004) this.addAgent(q);
    else {
      const far = colony.nav.closest(w, { x: 0.5, y: 0.2, z: 0.5 });
      this.wade = far ? new THREE.Vector3(far.x, far.y, far.z) : null;
      this.doing = 'wading out of the water';
    }
    this.capsule = colony.physics.addKinematicCapsule(human, { radius: 0.26 * s, height: 1.75 * s, position: w, group: GROUP.TINY });
    human.character.root.rotation.order = 'YXZ';
  }

  get s() { return this.h.scale; }
  get ch() { return this.h.character; }
  get root() { return this.h.character.root; }
  worldPos() { return this.root.getWorldPosition(new THREE.Vector3()); }

  addAgent(p) {
    const s = this.s;
    this.agent = this.c.nav.addAgent(p, { radius: 0.013, height: 0.088, maxSpeed: 1.35 * s, maxAcceleration: 6 * s });
    this.wade = null;
  }

  // body directions in world space (Rocketbox faces +Z)
  frame() {
    const y = this.h.yaw;
    const fwd = new THREE.Vector3(Math.sin(y), 0, Math.cos(y));
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3(-Math.cos(y), 0, Math.sin(y));
    return { fwd, up, right };
  }

  bone(name) { return this.ch.bones[name]; }
  bonePos(name) { return this.bone(name)?.getWorldPosition(new THREE.Vector3()); }

  describe() {
    const bits = [];
    if (this.dead) return `${this.h.profile.name} is dead (${this.deathCause})`;
    if (this.thirst < 25) bits.push('very thirsty'); else if (this.thirst < 50) bits.push('thirsty');
    if (this.hunger < 25) bits.push('starving'); else if (this.hunger < 50) bits.push('hungry');
    if (this.health < 60) bits.push('weak');
    if (this.tool) bits.push(`has the ${this.tool.kind}`);
    return `${this.h.profile.name}: ${this.doing}${bits.length ? ` (${bits.join(', ')})` : ''}`;
  }

  // ---- task helpers (generators: `const dt = yield` waits one frame)

  *wait(sec) {
    while (sec > 0) sec -= yield;
  }

  // walk (or run) there on the navmesh; false if it can't get there
  *walkTo(targetWorld, arrive = 0.01, { run = false, ext = EXT } = {}) {
    if (!this.agent) return false;
    const q = this.c.nav.closest(targetWorld, ext);
    if (!q || !this.c.nav.reachable(this.worldPos(), q)) return false;
    this.speedMul = run ? 2.3 : 1;
    this.agent.requestMoveTarget(q);
    let t = 0, still = 0;
    for (;;) {
      const dt = yield;
      t += dt;
      const p = this.agent.position();
      const d = Math.hypot(p.x - q.x, p.z - q.z);
      if (d < arrive) break;
      const v = this.agent.velocity();
      const sp = Math.hypot(v.x, v.z);
      // the crowd slows agents down over the last ~2 body widths: nearly there and slow = there
      if (d < Math.max(arrive * 2, 0.028) && sp < 0.01 && t > 0.4) break;
      if (sp < 0.0015) still += dt; else still = 0;
      if (still > 1.5 && d < arrive * 3) break;         // someone's in the spot: close enough
      if (still > 6 || t > 90) { this.halt(); return false; }
    }
    this.halt();
    return true;
  }

  halt() {
    this.agent?.resetMoveTarget();
    this.speedMul = 1;
  }

  // crouch down, reach for a piece on the ground, stand up with it
  *pickUp(p) {
    this.face = p.mesh.getWorldPosition(new THREE.Vector3());
    this.crouch = 1;
    yield* this.wait(0.35);
    const target = p.mesh.getWorldPosition(new THREE.Vector3());
    this.pose = { R: target, L: p.kind === 'wood' || p.kind === 'stone' ? target : null };
    yield* this.wait(0.45);
    this.c.removeCollider(p);
    if (p.state === 'stock') { this.c.stockCount[p.kind] = Math.max(0, this.c.stockCount[p.kind] - 1); p.stockSlot = null; }
    p.state = p.isTool ? 'tool' : 'carried';
    this.pose = null;
    if (p.isTool) { this.tool = p; p.owner = this; } else this.carry = p;
    this.crouch = 0;
    yield* this.wait(0.35);
    this.face = null;
  }

  // put what we carry down on the ground in front of us
  dropCarried() {
    const p = this.carry;
    if (!p) return;
    this.carry = null;
    const { fwd } = this.frame();
    const at = this.c.toLocal(this.worldPos().addScaledVector(fwd, 0.012));
    at.y = this.c.cage.surfaceY(at.x, at.z);
    p.claimedBy = null;
    this.c.settle(p, at, new THREE.Vector3(0, 1, 0));
  }

  dropTool() {
    const p = this.tool;
    if (!p) return;
    this.tool = null;
    p.owner = null;
    p.claimedBy = null;
    const { right } = this.frame();
    const at = this.c.toLocal(this.worldPos().addScaledVector(right, 0.008));
    at.y = this.c.cage.surfaceY(at.x, at.z);
    this.c.settle(p, at, new THREE.Vector3(0, 1, 0));
  }

  // ---- tasks

  *drink() {
    const { pond } = this.c.tiny.features;
    this.doing = 'going to drink';
    const me = this.c.toLocal(this.worldPos());
    // a dew drop nearby in the morning beats walking to the pond
    const drop = this.c.details?.dewNear(me, 0.25);
    if (drop) {
      drop.drunk = true;
      const at = this.c.toWorld(drop.p);
      if (yield* this.walkTo(at, 0.014)) {
        this.doing = 'drinking dew';
        this.face = at;
        this.crouch = 1;
        try {
          this.pose = { R: at, L: at, grip: 0.3 };
          yield* this.wait(0.8);
          this.pose = { R: 'mouth', grip: 0.3 };
          yield* this.wait(1.0);
          this.thirst = Math.min(100, this.thirst + WATER * 0.6);
        } finally { this.pose = null; this.crouch = 0; this.face = null; }
        return;
      }
    }
    const a = Math.atan2(me.z - pond.z, me.x - pond.x) + (Math.random() - 0.5) * 0.6;
    const shore = new THREE.Vector3(pond.x + Math.cos(a) * pond.r * 0.72, 0, pond.z + Math.sin(a) * pond.r * 0.72);
    shore.y = this.c.cage.surfaceY(shore.x, shore.z);
    if (!(yield* this.walkTo(this.c.toWorld(shore), 0.012))) return;
    this.doing = 'drinking';
    const center = this.c.toWorld(new THREE.Vector3(pond.x, this.c.cage.waterY, pond.z));
    this.face = center;
    this.crouch = 1;
    yield* this.wait(0.6);
    try {
      for (let i = 0; i < 3; i++) {
        // cup water with the right hand...
        const here = this.worldPos();
        const dir = center.clone().sub(here).setY(0).normalize();
        const water = here.clone().addScaledVector(dir, 0.028 * this.s / K);
        water.y = this.c.toWorld(new THREE.Vector3(0, this.c.cage.waterY, 0)).y;
        this.pose = { R: water, grip: 0.35 };
        yield* this.wait(0.9);
        this.c.tiny.ripple?.(this.c.toLocal(water), 1, `d${this.h.id}`);
        // ...and bring it to the mouth
        this.pose = { R: 'mouth', grip: 0.35 };
        yield* this.wait(1.0);
        this.thirst = Math.min(100, this.thirst + WATER / 3);
      }
    } finally {
      this.pose = null;
      this.crouch = 0;
      this.face = null;
    }
    yield* this.wait(0.4);
  }

  *eat(p) {
    p.claimedBy = this;
    try {
      this.doing = 'getting food';
      if (!(yield* this.walkTo(p.reach, 0.016))) { p.failedUntil = performance.now() + 45000; return; }
      if (p.state !== 'ground' && p.state !== 'stock') return;
      yield* this.pickUp(p);
      this.doing = 'eating';
      const full = p.mesh.scale.x;
      for (let i = 0; i < 4 && this.carry === p; i++) {
        this.pose = { R: 'mouth', holdFood: true };
        yield* this.wait(0.8);
        p.mesh.scale.setScalar(full * (1 - (i + 1) * 0.22));
        this.hunger = Math.min(100, this.hunger + FOOD / 4);
        this.pose = { holdFood: true };
        yield* this.wait(0.9);
      }
      if (this.carry === p) { this.carry = null; this.c.removePiece(p); }
    } finally {
      this.pose = null;
      if (p.claimedBy === this) p.claimedBy = null;
      if (this.carry === p && p.state === 'carried') this.dropCarried();
    }
  }

  *fetchTool(p) {
    p.claimedBy = this;
    try {
      this.doing = `going to pick up the ${p.kind}`;
      if (!(yield* this.walkTo(p.reach, 0.016))) { p.failedUntil = performance.now() + 45000; return; }
      if (p.state !== 'ground' && p.state !== 'stock') return;
      yield* this.pickUp(p);
      this.h.emotion.joy = Math.min(1, this.h.emotion.joy + 0.3);
      this.c.note(`${this.h.profile.name} took the ${p.kind}`);
    } finally {
      if (p.claimedBy === this && p !== this.tool) p.claimedBy = null;
    }
  }

  // bring a piece somewhere: a building slot, the fire, or the stockpile
  *deliver(p, dest) {
    p.claimedBy = this;
    if (dest.slot) dest.slot.claimedBy = this;
    try {
      if (this.carry !== p) {
        this.doing = `fetching ${p.kind}`;
        if (!(yield* this.walkTo(p.reach, 0.016))) { p.failedUntil = performance.now() + 45000; return; }
        if (p.state !== 'ground' && p.state !== 'stock') return;
        yield* this.pickUp(p);
      }
      if (dest.slot) {
        this.doing = `building the ${dest.site.bp.name}`;
        const at = this.c.toWorld(dest.site.slotPoint(dest.slot));
        if (!(yield* this.walkTo(at, 0.03, { ext: { x: 0.1, y: 0.1, z: 0.1 } }))) return;
        this.face = at;
        if (dest.slot.work === 'low') { this.crouch = 1; yield* this.wait(0.4); }
        this.pose = { R: at, L: at };
        yield* this.wait(0.45);
        this.carry = null;
        p.state = 'placed';
        const i = this.c.pieces.indexOf(p);
        if (i >= 0) this.c.pieces.splice(i, 1);
        const site = dest.site;
        site.place(dest.slot, p.mesh, 0.45, (mesh) => {
          mesh.updateMatrixWorld(true);
          this.c.physics.addStaticMesh(mesh, { group: GROUP.PROP });
          if (dest.slot.firewood) this.c.lightFire(site);
        });
        yield* this.wait(0.4);
      } else if (dest.fire) {
        this.doing = 'feeding the fire';
        const at = dest.fire.group.getWorldPosition(new THREE.Vector3());
        if (!(yield* this.walkTo(at, 0.03, { ext: { x: 0.08, y: 0.08, z: 0.08 } }))) return;
        this.face = at;
        this.crouch = 1;
        yield* this.wait(0.4);
        this.pose = { R: at, L: at };
        yield* this.wait(0.4);
        this.carry = null;
        this.c.removePiece(p);
        dest.fire.addFuel(FIRE_FUEL);
        yield* this.wait(0.3);
      } else {
        this.doing = `bringing ${p.kind} to the pile`;
        const at = this.c.toWorld(this.c.stock);
        if (!(yield* this.walkTo(at, 0.03))) return;
        this.face = at;
        this.crouch = 1;
        yield* this.wait(0.5);
        this.carry = null;
        p.claimedBy = null;
        this.c.putInStock(p);
        yield* this.wait(0.3);
      }
    } finally {
      this.pose = null;
      this.crouch = 0;
      this.face = null;
      if (dest.slot && dest.slot.claimedBy === this) dest.slot.claimedBy = null;
      if (p.claimedBy === this) p.claimedBy = null;
      if (this.carry === p) this.dropCarried();
    }
  }

  // chop wood off a log (axe) / break stone off a rock (pickaxe), then bring it
  *harvest(kind, then) {
    const src = this.c.findSource(kind, this);
    if (!src) return;
    const o = src.object;
    o.userData.workers = (o.userData.workers || 0) + 1;
    let made = null;
    try {
      this.doing = kind === 'wood' ? 'going to chop wood' : 'going to break stone';
      // stand beside it on our side (not on top of it)
      const toMe = this.worldPos().sub(src.center).setY(0).normalize();
      const beside = src.center.clone().addScaledVector(toMe, src.size / 2 + 0.015);
      const bl = this.c.toLocal(beside);
      beside.y = this.c.toWorld({ x: bl.x, y: this.c.cage.surfaceY(bl.x, bl.z), z: bl.z }).y;
      const reach = src.size / 2 + 0.04;
      if (!(yield* this.walkTo(beside, 0.02)) && !(yield* this.walkTo(src.center, 0.02, { ext: { x: reach, y: 0.02, z: reach } }))) { o.userData.failedUntil = performance.now() + 60000; return; }
      this.doing = kind === 'wood' ? 'chopping wood' : 'breaking stone';
      this.face = src.center.clone();
      yield* this.wait(0.3);
      // where the blade meets the wood/rock: straight ahead, at the surface
      const here = this.worldPos();
      const dir = src.center.clone().sub(here).setY(0).normalize();
      const from = here.clone().add(new THREE.Vector3(0, 0.03, 0));
      const hit = this.c.physics.raycast(from, src.center.clone().sub(from).normalize(), 0.3, { filterGroups: GROUND });
      const contact = hit ? hit.point : here.clone().addScaledVector(dir, 0.03);
      for (let i = 0; i < 4; i++) {
        yield* this.swing(contact, kind);
      }
      // the piece falls beside us
      const side = this.frame().right.multiplyScalar(0.012);
      const at = this.c.toLocal(here.clone().addScaledVector(dir, 0.008).add(side));
      at.y = this.c.cage.surfaceY(at.x, at.z);
      made = this.c.spawnOnGround(kind, at);
      this.c.note(`${this.h.profile.name} made ${kind}`);
    } finally {
      this.pose = null;
      this.face = null;
      o.userData.workers = Math.max(0, (o.userData.workers || 1) - 1);
    }
    if (made?.reach) yield* this.deliver(made, then(made));
  }

  // one full swing of the axe / pickaxe (arms and tool driven by IK)
  *swing(contact, kind) {
    const T = { up: 0.75, hold: 0.12, down: 0.2, after: 0.45 };
    let t = 0;
    let hitDone = false;
    for (;;) {
      const dt = yield;
      t += dt;
      let phase;
      if (t < T.up) phase = { k: 1 - smooth(t / T.up) };                           // 1 = at the hit, 0 = raised
      else if (t < T.up + T.hold) phase = { k: 0 };
      else if (t < T.up + T.hold + T.down) { const u = (t - T.up - T.hold) / T.down; phase = { k: u * u }; }
      else phase = { k: 1 };
      this.pose = { swing: phase.k, contact };
      if (!hitDone && t >= T.up + T.hold + T.down) {
        hitDone = true;
        this.c.chips(this.c.toLocal(contact), kind);
      }
      if (t >= T.up + T.hold + T.down + T.after) break;
    }
  }

  *wander() {
    this.doing = 'looking around';
    const c = this.c.center;
    let target = null;
    for (let i = 0; i < 10 && !target; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.05 + Math.random() * 0.25;
      const p = new THREE.Vector3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r);
      if (Math.abs(p.x) > 1.4 || Math.abs(p.z) > 0.85 || !this.c.cage.isWalkable(p.x, p.z)) continue;
      p.y = this.c.cage.surfaceY(p.x, p.z);
      target = p;
    }
    if (target) yield* this.walkTo(this.c.toWorld(target), 0.015);
    if (Math.random() < 0.6) this.ch.play(pick(IDLE));
    yield* this.wait(2 + Math.random() * 4);
  }

  // warm up by the fire for a while
  *sitByFire() {
    const f = this.c.fire;
    const at = f.group.getWorldPosition(new THREE.Vector3());
    const a = Math.random() * Math.PI * 2;
    const spot = at.clone().add(new THREE.Vector3(Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045));
    this.doing = 'warming up by the fire';
    if (!(yield* this.walkTo(spot, 0.012))) return;
    this.face = at;
    this.crouch = 1;
    try {
      yield* this.wait(6 + Math.random() * 6);
    } finally {
      this.crouch = 0;
      this.face = null;
    }
  }

  // run at the giant (you) and punch
  *fight() {
    this.doing = 'fighting you';
    this.dropCarried();
    const h = this.h;
    h.emotion.anger = Math.min(1, h.emotion.anger + 0.6);
    h.emotion.fear = Math.max(0, h.emotion.fear - 0.3);
    let t = 0;
    try {
      while (t < 25) {
        const g = this.c.giant;
        if (!g) return;
        const d = this.worldPos().distanceTo(g);
        if (d > 0.35) return;                       // you got away
        if (d > 0.034) {
          // chase (re-aim now and then)
          if (!this.agent) return;
          this.speedMul = 2.3;
          this.agent.requestMoveTarget(g);
          yield* this.wait(0.3);
          t += 0.3;
          continue;
        }
        this.halt();
        this.face = g.clone();
        // a jab at your belly: arm out fast, then back
        const target = g.clone().add(new THREE.Vector3(0, 1.0 * this.c.player.scale * 0.95, 0));
        this.pose = { R: target, grip: 1 };
        yield* this.wait(0.18);
        if (this.c.giant && this.worldPos().distanceTo(this.c.giant) < 0.042) this.c.vitals?.damage(2 + Math.random() * 3, 'beaten up by tiny people');
        this.pose = null;
        yield* this.wait(0.45 + Math.random() * 0.3);
        t += 0.8;
      }
    } finally {
      this.pose = null;
      this.face = null;
      this.halt();
    }
  }

  // run from the giant
  *flee() {
    this.doing = 'running from you';
    this.dropCarried();
    const h = this.h;
    h.emotion.fear = 1;
    const g = this.c.giant;
    if (!g) return;
    const away = this.worldPos().sub(g).setY(0).normalize();
    for (let i = 0; i < 6; i++) {
      const a = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5;
      const dir = away.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      const spot = this.worldPos().addScaledVector(dir, 0.35);
      if (yield* this.walkTo(spot, 0.03, { run: true, ext: { x: 0.08, y: 0.08, z: 0.08 } })) break;
    }
    this.ch.play('idle_nervous_01');
    yield* this.wait(2);
  }

  // hit (by you): hurts, and a hit person is shaken or furious
  hurt(amount, cause, from) {
    if (this.dead) return;
    this.health -= amount;
    this.h.emotion.fear = Math.min(1, this.h.emotion.fear + 0.4);
    this.h.emotion.anger = Math.min(1, this.h.emotion.anger + 0.3);
    this.h.character.setEmotion('pain', 1);
    // a bloody nose / split lip where the punch landed (gore setting decides)
    const gore = this.c.settings?.get?.('gameplay.gore') ?? 'some';
    this.h.life?.addStain(this.bonePos('Bip01_Head') ?? this.worldPos(), 0.05, gore === 'full' ? 1.5 : gore === 'some' ? 1 : 0);
    // knocked back a little
    if (this.agent && from) {
      const back = this.worldPos().sub(from).setY(0).normalize();
      this.agent.requestMoveTarget(this.worldPos().addScaledVector(back, 0.03));
    }
    this.c.note(`${this.h.profile.name} was hit`);
    if (this.health <= 0) this.die(cause);
  }

  // go and talk to someone nearby (they stop and listen, then answer)
  *chat(other) {
    other.interrupt(other.listen(this));
    this.doing = `talking to ${other.h.profile.name}`;
    const them = other.worldPos();
    const here = this.worldPos();
    const meet = them.clone().add(here.clone().sub(them).setY(0).normalize().multiplyScalar(0.022));
    if (!(yield* this.walkTo(meet, 0.008))) { other.chatWith = null; return; }
    this.chatWith = other;
    for (let i = 0; i < 3 && other.chatWith === this; i++) {
      this.face = other.worldPos();
      this.ch.play(pick(TALK));
      yield* this.wait(2.5 + Math.random());
      this.ch.play(pick(LISTEN));
      yield* this.wait(2 + Math.random());
    }
    this.face = null;
    this.chatWith = null;
    if (other.chatWith === this) other.chatWith = null;
  }

  *listen(other) {
    this.chatWith = other;
    this.doing = `talking to ${other.h.profile.name}`;
    let t = 0;
    while (this.chatWith === other && t < 20) {
      t += yield;
      this.face = other.worldPos();
      if (!this.ch.oneShot && Math.random() < 0.01) this.ch.play(pick(Math.random() < 0.5 ? TALK : LISTEN));
    }
    this.face = null;
    this.chatWith = null;
  }

  interrupt(task) {
    this.co?.return();
    this.co = task;
    this.co.next(0);
  }

  // ---- deciding what to do next

  choose() {
    const c = this.c;
    if (this.thirst < 45) return this.drink();
    if (this.hunger < 50) { const f = c.findPiece('food', this); if (f) return this.eat(f); }
    // a tool lying around that nobody uses: take it
    if (!this.tool && !this.carry) {
      const t = c.findPiece(['axe', 'pickaxe'], this);
      if (t) return this.fetchTool(t);
    }
    // keep the fire going
    if (c.fireBuilt && c.fire.fuel < 90 && !c.fire.feeding) {
      const w = c.findPiece('wood', this);
      if (w) { c.fire.feeding = this; const task = this.deliver(w, { fire: c.fire }); return (function* () { try { yield* task; } finally { c.fire.feeding = null; } })(); }
    }
    // build: bring the next piece the building needs (from the ground or the pile),
    // or make it with the tool we have
    const site = c.site;
    if (site) {
      for (const kind of ['stone', 'wood']) {
        const slot = site.openSlot(kind);
        if (!slot) continue;
        const p = c.findPiece(kind, this);
        if (p) return this.deliver(p, { site, slot });
      }
      for (const kind of ['stone', 'wood']) {
        const need = kind === 'wood' ? 'axe' : 'pickaxe';
        if (this.tool?.kind === need && site.missing(kind) > this.onTheWay(kind)) {
          return this.harvest(kind, (made) => {
            const slot = site.openSlot(kind);
            return slot && !site.done ? { site, slot } : { stock: true };
          });
        }
      }
    }
    // tidy up: loose things go to the pile
    const loose = c.findPiece(['wood', 'stone', 'food'], this, { stock: false });
    if (loose) return this.deliver(loose, { stock: true });
    if (this.hunger < 80) { const f = c.findPiece('food', this); if (f) return this.eat(f); }
    if (this.thirst < 70) return this.drink();
    // stock up with the tool when there's nothing else to do
    if (this.tool && c.stockCount[this.tool.kind === 'axe' ? 'wood' : 'stone'] < 10 && Math.random() < 0.5) {
      return this.harvest(this.tool.kind === 'axe' ? 'wood' : 'stone', () => ({ stock: true }));
    }
    // free time: talk to someone, sit by the fire, or wander
    if (Math.random() < 0.35) {
      const me = this.worldPos();
      const other = [...c.residents.values()].find((o) => o !== this && !o.dead && !o.chatWith && o.agent && o.idle && o.worldPos().distanceTo(me) < 0.3);
      if (other) return this.chat(other);
    }
    if (c.fireBuilt && c.fire.burning && Math.random() < 0.4) return this.sitByFire();
    return this.wander();
  }

  // how many of this material others are already making for the building
  onTheWay(kind) {
    let n = 0;
    for (const r of this.c.residents.values()) if (r !== this && r.doing.startsWith(kind === 'wood' ? 'going to chop' : 'going to break')) n++;
    for (const r of this.c.residents.values()) if (r !== this && r.doing.startsWith(kind === 'wood' ? 'chopping' : 'breaking')) n++;
    return n;
  }

  get idle() {
    return this.doing === 'looking around' || this.doing === 'warming up by the fire';
  }

  celebrate(site) {
    if (this.dead || this.carry || this.pose || !this.idle) return;
    if (this.worldPos().distanceTo(site.group.getWorldPosition(new THREE.Vector3())) > 0.4) return;
    this.h.emotion.joy = Math.min(1, this.h.emotion.joy + 0.6);
    this.ch.play(pick(['cheer_01', 'cheer_02', 'claphands_01']));
  }

  // ---- every frame

  update(dt) {
    if (this.dead) return;
    const h = this.h;
    this.needs(dt);
    if (this.dead) return;
    // task
    this.think -= dt;
    if (!this.co && this.think <= 0 && !this.wade && this.agent) {
      this.co = this.choose();
      this.co.next(0);
    }
    // you shrank yourself in: fight you or run
    this.threatCheck -= dt;
    if (this.threatCheck <= 0 && this.agent) {
      this.threatCheck = 0.5;
      const g = this.c.giant;
      if (g && !this.doing.startsWith('fighting') && !this.doing.startsWith('running')) {
        const d = this.worldPos().distanceTo(g);
        if (d < 0.25) {
          const pers = h.profile.personality;
          const friends = [...this.c.residents.values()].filter((o) => o !== this && !o.dead && o.worldPos().distanceTo(g) < 0.3).length;
          const courage = pers.bravery * 0.6 + pers.temper * 0.3 + h.emotion.anger * 0.4 + friends * 0.08 - (this.health < 50 ? 0.3 : 0);
          if (courage > 0.55) this.interrupt(this.fight());
          else this.interrupt(this.flee());
        }
      }
    }
    // really thirsty/hungry: drop what you're doing
    if (this.co && this.thirst < 15 && !this.doing.includes('drink')) this.interrupt(this.drink());
    if (this.co) {
      const r = this.co.next(dt);
      if (r.done) { this.co = null; this.think = 0.3 + Math.random() * 0.6; }
    }
    this.syncBody(dt);
    if (this.dead) return;
    h.updateFace();
    this.ch.crouch += ((this.crouch ? 1 : 0) - this.ch.crouch) * (1 - Math.exp(-dt * 6));
    this.ch.footIK = true;
    this.ch.update(dt, { groundAt: (x, y, z) => this.groundAt(x, y, z) });
    this.applyPose(dt);
  }

  needs(dt) {
    const h = this.h;
    this.hunger = Math.max(0, this.hunger - DRAIN.hunger * dt);
    this.thirst = Math.max(0, this.thirst - DRAIN.thirst * dt);
    if (this.hunger <= 0) this.health -= DRAIN.health * dt * 0.8;
    if (this.thirst <= 0) this.health -= DRAIN.health * dt;
    if (this.hunger > 40 && this.thirst > 40) this.health = Math.min(100, this.health + dt * 0.5);
    // how they feel: hunger and thirst make them sad (and scared when it gets bad)
    const low = Math.min(this.hunger, this.thirst);
    h.emotion.sadness = Math.max(h.emotion.sadness * Math.exp(-dt * 0.05), THREE.MathUtils.clamp((45 - low) / 45, 0, 1));
    if (low < 15) h.emotion.fear = Math.max(h.emotion.fear, 0.5);
    h.emotion.fear = Math.max(0.05, h.emotion.fear - dt * 0.02);
    h.emotion.joy = Math.max(0.1, h.emotion.joy - dt * 0.01);
    if (this.health <= 0) this.die(this.thirst <= 0 ? 'thirst' : 'hunger');
  }

  groundAt(x, y, z) {
    const hit = this.c.physics.raycast({ x, y, z }, { x: 0, y: -1, z: 0 }, 0.08, { filterGroups: GROUND });
    return hit ? hit.point.y : null;
  }

  // body follows the crowd agent (or wades out of the water on its own)
  syncBody(dt) {
    const h = this.h;
    const root = this.root;
    const s = this.s;
    let p, v;
    if (this.agent) {
      // slower when carrying a pole, and when weak from hunger or thirst
      const weak = Math.min(this.hunger, this.thirst) < 15 ? 0.6 : 1;
      const load = this.carry?.kind === 'wood' || this.carry?.kind === 'stone' ? 0.8 : 1;
      const want = 1.35 * s * weak * load * (this.speedMul || 1);
      if (Math.abs((this.lastMax || 0) - want) > 1e-5) { this.agent.updateParameters({ maxSpeed: want }); this.lastMax = want; }
      p = this.agent.position();
      v = this.agent.velocity();
    } else {
      p = this.worldPos();
      v = { x: 0, y: 0, z: 0 };
      if (this.wade) {
        const to = this.wade.clone().sub(p).setY(0);
        const d = to.length();
        if (d < 0.004) this.addAgent(this.wade);
        else {
          const sp = 0.8 * s;
          to.normalize().multiplyScalar(Math.min(d, sp * dt));
          p = p.clone().add(to);
          v = { x: (to.x / Math.max(dt, 1e-4)), y: 0, z: (to.z / Math.max(dt, 1e-4)) };
        }
      }
    }
    const ground = this.groundAt(p.x, p.y + 0.03, p.z);
    const local = this.c.toLocal({ x: p.x, y: ground ?? p.y, z: p.z });
    root.position.copy(local);
    const speed = Math.hypot(v.x, v.z);
    let want = null;
    if (speed > 0.004) want = Math.atan2(v.x, v.z);
    else if (this.face) { const d = this.face.clone().sub(this.worldPos()); want = Math.atan2(d.x, d.z); }
    if (want !== null) {
      let d = want - h.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      h.yaw += d * (1 - Math.exp(-dt * 8));
    }
    root.rotation.set(0, h.yaw, 0);
    this.ch.speed = speed / s;
    if (this.capsule) this.c.physics.placeCapsule(this.capsule, this.worldPos());
    // water and lava
    if (this.c.cage.inLava(local.x, local.z)) { this.die('lava'); return; }
    if (this.c.cage.waterDepth(local.x, local.z) > 0.002 && speed > 0.002) {
      this.c.tiny.ripple?.(local, dt, h.id);
      h.emotion.fear = Math.min(1, h.emotion.fear + dt * 0.1);
    }
  }

  // ---- arms (after the animation): carrying, reaching, swinging a tool

  armIK(side, wrist, w, poleDir) {
    const B = this.ch.bones;
    const up = B[`Bip01_${side}_UpperArm`], lo = B[`Bip01_${side}_Forearm`], hand = B[`Bip01_${side}_Hand`];
    if (!up || !lo || !hand || w <= 0.001) return;
    const pole = up.getWorldPosition(new THREE.Vector3()).add(poleDir);
    solveTwoBone(up, lo, hand, wrist, w, pole);
  }

  applyPose(dt) {
    const ch = this.ch;
    const s = this.s;
    const { fwd, up, right } = this.frame();
    this.root.updateMatrixWorld(true);
    const want = { R: null, L: null };
    let gripR = 0, gripL = 0;
    const pose = this.pose;
    const elbowR = right.clone().multiplyScalar(0.3 * s).addScaledVector(up, -0.5 * s).addScaledVector(fwd, -0.25 * s);
    const elbowL = right.clone().multiplyScalar(-0.3 * s).addScaledVector(up, -0.5 * s).addScaledVector(fwd, -0.25 * s);
    const mouth = () => this.bonePos('Bip01_Head').addScaledVector(fwd, 0.1 * s).addScaledVector(up, -0.02 * s);

    // a tool swing: the tool moves along an arc; both hands follow its handle
    let toolPose = null;
    if (pose?.swing !== undefined && this.tool) {
      const chest = this.bonePos('Bip01_Spine2');
      const pivot = chest.clone().addScaledVector(fwd, 0.12 * s).addScaledVector(up, 0.12 * s).addScaledVector(right, 0.06 * s);
      const rel = pose.contact.clone().sub(pivot);
      const hitAngle = THREE.MathUtils.clamp(Math.atan2(rel.y, Math.max(0.001, rel.clone().setY(0).length())), -1.3, -0.1);
      const top = 1.9; // raised back over the shoulder
      const th = THREE.MathUtils.lerp(top, hitAngle, pose.swing);
      const d = fwd.clone().multiplyScalar(Math.cos(th)).addScaledVector(up, Math.sin(th));
      const edge = fwd.clone().multiplyScalar(Math.sin(th)).addScaledVector(up, -Math.cos(th));
      const x = d.clone().cross(edge).normalize();
      const origin = pivot.clone().addScaledVector(d, 0.18 * s);
      // lean into the hit
      rotateBoneWorld(this.bone('Bip01_Spine1'), up.clone().cross(fwd).normalize(), Math.max(0, -th) * 0.35 * pose.swing);
      toolPose = { origin, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, d, edge)) };
      want.R = origin.clone().addScaledVector(d, 0.3 * s).addScaledVector(d, -0.08 * s);
      want.L = origin.clone().addScaledVector(d, 0.05 * s).addScaledVector(d, -0.08 * s);
      gripR = gripL = 0.95;
    } else if (pose) {
      const target = (t) => (t === 'mouth' ? mouth().addScaledVector(up, -0.06 * s) : t ? t.clone() : null);
      if (pose.R) want.R = target(pose.R);
      if (pose.L) want.L = target(pose.L).addScaledVector(right, -0.08 * s);
      if (pose.R && pose.L) want.R.addScaledVector(right, 0.08 * s);
      gripR = pose.grip ?? 0.6;
      gripL = pose.grip ?? 0.6;
    }

    // carrying: poles on the right shoulder, stones and bread in both hands
    const p = this.carry;
    if (p && !(pose?.holdFood)) {
      const neck = this.bonePos('Bip01_Neck') || this.bonePos('Bip01_Head');
      const shR = this.bonePos('Bip01_R_UpperArm');
      if (p.kind === 'wood' && neck && shR) {
        const rest = neck.clone().lerp(shR, 0.6).addScaledVector(up, 0.07 * s);
        const dir = fwd.clone().multiplyScalar(Math.cos(0.18)).addScaledVector(up, Math.sin(0.18));
        this.placeCarried(p, rest.clone().addScaledVector(dir, 0.1 * s), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir));
        if (!want.R) { want.R = rest.clone().addScaledVector(dir, 0.3 * s).addScaledVector(up, -0.07 * s); gripR = 0.9; }
      } else {
        const pelvis = this.bonePos('Bip01_Pelvis');
        const at = pelvis.clone().addScaledVector(fwd, 0.26 * s).addScaledVector(up, 0.16 * s);
        this.placeCarried(p, at, new THREE.Quaternion().setFromAxisAngle(up, this.h.yaw));
        const half = p.mesh.userData.size / 2 + 0.03 * s;
        if (!want.R) { want.R = at.clone().addScaledVector(right, half).addScaledVector(fwd, -0.04 * s); gripR = 0.5; }
        if (!want.L) { want.L = at.clone().addScaledVector(right, -half).addScaledVector(fwd, -0.04 * s); gripL = 0.5; }
      }
    }

    // arms
    const k = 1 - Math.exp(-dt * 10);
    for (const side of ['R', 'L']) {
      const target = want[side];
      this.ikw[side] += ((target ? 1 : 0) - this.ikw[side]) * k;
      if (target) this.ikLast[side] = target;
      const t = this.ikLast[side];
      if (t) {
        // aim the wrist a palm's length short of the grip point
        const sh = this.bonePos(`Bip01_${side}_UpperArm`);
        const wrist = t.clone().addScaledVector(t.clone().sub(sh).normalize(), -0.07 * s);
        this.armIK(side, wrist, this.ikw[side], side === 'R' ? elbowR : elbowL);
      }
    }
    if (gripR) ch.grip('R', gripR, { thumb: 0.6 });
    if (gripL) ch.grip('L', gripL, { thumb: 0.6 });

    // things in hand follow the hand
    if (p && pose?.holdFood) {
      const hand = this.bone('Bip01_R_Hand');
      const hq = hand.getWorldQuaternion(new THREE.Quaternion());
      this.placeCarried(p, hand.getWorldPosition(new THREE.Vector3()).add(PALM.clone().multiplyScalar(s).applyQuaternion(hq)), hq);
    }
    const tool = this.tool;
    if (tool) {
      if (toolPose) this.placeCarried(tool, toolPose.origin, toolPose.q);
      else if (p) {
        // hands full: the tool rides on the back
        const back = this.bonePos('Bip01_Spine2').addScaledVector(fwd, -0.13 * s);
        const d = up.clone().multiplyScalar(0.8).addScaledVector(right, 0.6).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(d.clone().cross(fwd.clone().negate()).normalize(), d, fwd.clone().negate()));
        this.placeCarried(tool, back.addScaledVector(d, -0.4 * s), q);
      } else {
        // in the right hand, handle along the hand (pinky -> index), head forward
        const hand = this.bone('Bip01_R_Hand');
        const hq = hand.getWorldQuaternion(new THREE.Quaternion());
        const handZ = new THREE.Vector3(0, 0, 1).applyQuaternion(hq);
        const handX = new THREE.Vector3(1, 0, 0).applyQuaternion(hq);
        const grip = hand.getWorldPosition(new THREE.Vector3()).add(PALM.clone().multiplyScalar(s).applyQuaternion(hq));
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(handX.clone().cross(handZ).normalize(), handZ, handX.clone().negate()));
        this.placeCarried(tool, grip.addScaledVector(handZ, -0.62 * s), q);
      }
    }
  }

  // a carried piece: world transform -> the tiny world's space
  placeCarried(p, worldPos, worldQ) {
    const m = p.mesh;
    const parent = m.parent;
    parent.updateMatrixWorld(true);
    m.position.copy(parent.worldToLocal(worldPos.clone()));
    const pq = parent.getWorldQuaternion(new THREE.Quaternion());
    m.quaternion.copy(pq.invert().multiply(worldQ));
  }

  // ---- death

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.deathCause = cause;
    this.co?.return();
    this.co = null;
    this.dropCarried();
    this.dropTool();
    this.dispose();
    const h = this.h;
    if (cause === 'lava') { h.burn(); return; }
    h.dead = true;
    h.state = 'dead';
    h.character.setEmotion('pain', 0.6);
    h.character.stopOneShot(0.2);
    this.c.note(`${h.profile.name} died of ${cause}`);
    h.collapse(this.c.cage.surfaceY(this.root.position.x, this.root.position.z));
    for (const r of this.c.residents.values()) {
      if (r === this || r.dead) continue;
      r.h.emotion.sadness = Math.min(1, r.h.emotion.sadness + 0.6);
      r.h.emotion.fear = Math.min(1, r.h.emotion.fear + 0.3);
    }
    h.onDeath?.(h, cause);
  }

  dispose() {
    if (this.co && !this.dead) { this.co.return(); this.co = null; }
    if (this.carry) this.dropCarried();
    if (this.tool) this.dropTool();
    if (this.agent) { this.c.nav.removeAgent(this.agent); this.agent = null; }
    if (this.capsule) { this.c.physics.removeCapsule(this.capsule); this.capsule = null; }
  }
}
