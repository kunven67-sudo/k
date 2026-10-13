// Argentine ants (Linepithema humile): THE ant of the California coast. Workers are 2.6 mm long and
// brown, colonies have many queens (no soldiers), they nest shallow in soil near houses, and they
// make busy trails into kitchens for crumbs and sugar.
//
// How it works (nothing random, everything has a cause):
//  - The colony found the crumbs on your kitchen island days ago (someone ate a cookie there), so
//    there's an established scent trail: lawn -> up the step -> through the half-open sliding door ->
//    across the kitchen floor -> up the back of the island -> under the counter's overhang -> onto the
//    counter -> the crumbs. Ants walk it both ways; the ones coming home carry a bit of food.
//  - Each trip takes a real amount of food: crumbs really shrink, and the nest's food chamber fills up.
//  - Foragers notice small things moving near the trail (by touch, smell and vibration, a few cm) and
//    attack them: bite, pull, swarm. That includes an ant-sized you.
//  - A normal-size you squishes ants you step on.
//  - The nest is real and you can go in (you need to be smaller than about 3 mm): a hole with a ring of
//    dug-out soil, a shaft, a junction, a queen chamber (several queens, real for this species), a brood
//    chamber (eggs, larvae, pupae) and the food chamber. It's pitch black down there, like real life;
//    your eyes light the way.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { phys, std } from '../render/materials.js';
import * as TX from '../render/textures.js';
import { clamp, damp, hash3 } from '../core/util.js';
import { bus } from '../core/events.js';
import { solveKnee } from './creature.js';

const ANT_L = 0.0026;
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _X = new THREE.Vector3();
const _Y = new THREE.Vector3();
const _Z = new THREE.Vector3();
const _lm = new THREE.Matrix4();
const _ls = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _tip = new THREE.Vector3();
const _el = new THREE.Vector3();
const _chest = new THREE.Vector3(); // the player's chest this frame (its own vector: the leg math reuses the others)
const _soleInv = new THREE.Matrix4();
const _lp = new THREE.Vector3();

const cache = new Map();
const once = (k, f) => (cache.has(k) ? cache.get(k) : (cache.set(k, f()), cache.get(k)));

// ---- materials ----------------------------------------------------------------------------------
function antMats() {
  return once('ants', () => ({
    body: phys({ color: 0x4a2f1c, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.25 }, { detail: 'chitin' }),
    leg: std({ color: 0x5e3d24, roughness: 0.45 }, { detail: 'chitin' }),
    food: std({ color: 0xc89a5c, roughness: 0.8 }, { detail: 'food' }),
    egg: phys({ color: 0xf3efe4, roughness: 0.25, clearcoat: 0.6, transmission: 0 }),
    larva: std({ color: 0xefe9da, roughness: 0.5 }, { detail: 'skin' }),
    soil: std({ color: 0x5b4330, roughness: 1 }, { detail: 'soil' }),
    tunnel: (() => {
      const t = TX.generate('antTunnel', 128, (u, v) => {
        const n = TX.fbm(u, v, { freq: 10, oct: 4, seed: 611 });
        const g = hash3(Math.floor(u * 128), Math.floor(v * 128), 0, 612) > 0.93 ? 0.2 : 0;
        const d = 0.55 + n * 0.35 + g;
        return [0.36 * d, 0.27 * d, 0.19 * d, n + g, 1];
      }, { normalStrength: 3 });
      const m = std({ map: t.map, normalMap: t.normalMap, roughness: 1, side: THREE.BackSide }, { detail: 'soil' });
      m.envMapIntensity = 0.06; // underground: almost no light gets in
      return m;
    })(),
    grain: std({ color: 0x6a4f38, roughness: 1 }, { detail: 'soil' }),
  }));
}

// ---- the ant body (one merged mesh, instanced) ---------------------------------------------------
function ellipsoid(cx, cy, cz, rx, ry, rz, w = 14, h = 10) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  g.translate(cx, cy, cz);
  return g;
}

// Worker: head with mandibles and eyes, humped mesosoma, one-node petiole, oval gaster. Facing -Z,
// origin on the ground under the thorax.
function workerGeo(queen = false) {
  const k = queen ? 1.75 : 1;
  const parts = [
    ellipsoid(0, 0.00042 * k, 0, 0.00018 * k * (queen ? 1.25 : 1), 0.00022 * k, 0.00048 * k), // mesosoma
    ellipsoid(0, 0.00041 * k, -0.00074 * k, 0.00026 * k, 0.0002 * k, 0.0003 * k), // head
    ellipsoid(0, 0.00042 * k, 0.00052 * k, 0.0001 * k, 0.00015 * k, 0.00008 * k, 8, 6), // petiole node
    ellipsoid(0, 0.00044 * k, (queen ? 0.0012 : 0.00095) * k, 0.00033 * k * (queen ? 1.35 : 1), 0.0003 * k * (queen ? 1.3 : 1), 0.00045 * k * (queen ? 1.55 : 1)), // gaster
    ellipsoid(0.00024 * k, 0.00047 * k, -0.0008 * k, 0.00006 * k, 0.00007 * k, 0.00006 * k, 6, 5), // eyes
    ellipsoid(-0.00024 * k, 0.00047 * k, -0.0008 * k, 0.00006 * k, 0.00007 * k, 0.00006 * k, 6, 5),
  ];
  for (const s of [-1, 1]) {
    const mand = new THREE.ConeGeometry(0.00007 * k, 0.00028 * k, 5);
    mand.rotateX(-Math.PI / 2);
    mand.rotateY(s * 0.35);
    mand.translate(s * 0.0001 * k, 0.00032 * k, -0.00104 * k);
    parts.push(mand);
  }
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
  g.computeVertexNormals();
  return g;
}

// A unit segment along +Y (scaled per instance into femurs, tibias, antennae).
function unitSegment() {
  const g = new THREE.CylinderGeometry(0.75, 1, 1, 6, 1, false);
  g.translate(0, 0.5, 0);
  return g;
}

// Legs (model space, worker): hip, resting foot spot, femur, tibia. Tripod gait groups.
const LEGS = [
  { hip: [-0.00012, 0.00036, -0.0003], rest: [-0.00085, 0, -0.00095], a: 0.00062, b: 0.0007, g: 0 },
  { hip: [0.00012, 0.00036, -0.0003], rest: [0.00085, 0, -0.00095], a: 0.00062, b: 0.0007, g: 1 },
  { hip: [-0.00014, 0.00034, 0], rest: [-0.00108, 0, 0.00002], a: 0.0007, b: 0.00078, g: 1 },
  { hip: [0.00014, 0.00034, 0], rest: [0.00108, 0, 0.00002], a: 0.0007, b: 0.00078, g: 0 },
  { hip: [-0.00014, 0.00034, 0.0003], rest: [-0.001, 0, 0.0011], a: 0.00078, b: 0.00088, g: 0 },
  { hip: [0.00014, 0.00034, 0.0003], rest: [0.001, 0, 0.0011], a: 0.00078, b: 0.00088, g: 1 },
].map((l) => ({ ...l, hip: new THREE.Vector3().fromArray(l.hip), rest: new THREE.Vector3().fromArray(l.rest), side: Math.sign(l.rest[0]) }));

// ---- the trail ---------------------------------------------------------------------------------
// A path over real surfaces: points ~1.5 mm apart, each with the surface normal there.
class Trail {
  constructor(waypoints, step = 0.0015) {
    const P = [], N = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [a, na] = waypoints[i], [b] = waypoints[i + 1];
      const A = new THREE.Vector3().fromArray(a), B = new THREE.Vector3().fromArray(b);
      const n = new THREE.Vector3().fromArray(na).normalize();
      const len = A.distanceTo(B);
      const k = Math.max(1, Math.ceil(len / step));
      for (let j = 0; j < k; j++) {
        P.push(A.clone().lerp(B, j / k));
        N.push(n.clone());
      }
    }
    const last = waypoints[waypoints.length - 1];
    P.push(new THREE.Vector3().fromArray(last[0]));
    N.push(new THREE.Vector3().fromArray(last[1]).normalize());
    // Smooth the normals a little across corners (an ant tips over an edge, it doesn't snap).
    const Ns = N.map((n, i) => n.clone().add(N[Math.max(0, i - 1)]).add(N[Math.min(N.length - 1, i + 1)]).normalize());
    this.p = P;
    this.n = Ns;
    this.d = [0];
    for (let i = 1; i < P.length; i++) this.d.push(this.d[i - 1] + P[i].distanceTo(P[i - 1]));
    this.length = this.d[this.d.length - 1];
  }

  // Point, normal and forward direction at distance s along the trail.
  sample(s, outP, outN, outF, hint = 0) {
    s = clamp(s, 0, this.length);
    let i = clamp(hint, 0, this.d.length - 2);
    while (i < this.d.length - 2 && this.d[i + 1] < s) i++;
    while (i > 0 && this.d[i] > s) i--;
    const t = (s - this.d[i]) / Math.max(1e-9, this.d[i + 1] - this.d[i]);
    outP.lerpVectors(this.p[i], this.p[i + 1], t);
    outN.lerpVectors(this.n[i], this.n[i + 1], t).normalize();
    outF.subVectors(this.p[i + 1], this.p[i]).normalize();
    return i;
  }
}

// ---- the colony --------------------------------------------------------------------------------
export class AntColony {
  constructor(game, { entrance, route, food = [], workers = 700, nestWorkers = 30, lidMaterial = null }) {
    this.game = game;
    this.lidMaterial = lidMaterial;
    this.kind = 'colony';
    this.entrance = new THREE.Vector3().fromArray(entrance);
    this.foodProps = food; // props the colony knows about at the end of the trail
    this.foodStored = 0; // grams carried home
    this.t = 0;
    const M = antMats();
    this.M = M;

    // Nest first (it defines where the inside part of the trail runs). The trail leaves the hole on the
    // side facing where it goes next.
    this.nest = this._buildNest(game, M, new THREE.Vector3().fromArray(route[0][0]));
    // Trail: food storage chamber -> brood chamber -> junction -> up the shaft -> out -> the route -> food.
    const inside = this.nest.trailInside; // from the food chamber up to the entrance rim
    this.trail = new Trail([...inside, ...route]);
    this.entranceD = this.nest.entranceD; // distance along the trail where the entrance is

    // Instanced bodies (workers + queens), legs, antennae, carried food.
    const maxAnts = workers + nestWorkers + 8;
    this.bodies = new THREE.InstancedMesh(workerGeo(false), M.body, maxAnts);
    this.queenMesh = new THREE.InstancedMesh(workerGeo(true), M.body, 8);
    this.legMesh = new THREE.InstancedMesh(unitSegment(), M.leg, 4000);
    this.foodMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.food, maxAnts);
    for (const im of [this.bodies, this.queenMesh, this.legMesh, this.foodMesh]) {
      im.frustumCulled = false;
      im.castShadow = false;
      im.receiveShadow = true;
      im.count = 0;
      game.scene.add(im);
    }
    this.bodies.castShadow = true;

    // The ants. Foragers are spread along the trail (half going out, half coming home with food).
    this.ants = [];
    const out = this.trail.length - this.entranceD;
    for (let i = 0; i < workers; i++) {
      const h = hash3(i, 1, 0, 77);
      const dir = i % 2 ? 1 : -1;
      this.ants.push(this._ant({
        mode: 'trail',
        s: this.entranceD + ((i + 0.5) / workers) * out * 0.98,
        dir,
        carrying: dir < 0,
        lat: (h - 0.5),
        speed: 0.022 + hash3(i, 2, 0, 77) * 0.008,
        id: i,
      }));
    }
    // Nest workers tend the queens and brood (walking little loops in the chambers).
    for (let i = 0; i < nestWorkers; i++) this.ants.push(this._ant({ mode: 'tend', id: workers + i, ch: i % 3, loop: hash3(i, 9, 0, 3) }));
    this.queens = this.nest.queens;
    this.deadAnts = [];
    this.legIdx = 0;
    game.updatables.add(this);
    game.colonies = game.colonies || [];
    game.colonies.push(this);
    game.underground.push({ contains: (p) => this.inNest(p) });
    // Your light when you're down in the nest (eyes glowing on dark soil).
    this.headLamp = game.lighting.addLamp({ position: new THREE.Vector3(), color: 0xbff8ff, intensity: 0, range: 1, cone: 1.25, on: false, priority: true, underground: true, dir: new THREE.Vector3(0, -1, 0) });
  }

  _ant(o) {
    return {
      mode: 'trail', s: 0, dir: 1, carrying: false, lat: 0, speed: 0.024, id: 0, phase: 0,
      pos: new THREE.Vector3(), n: new THREE.Vector3(0, 1, 0), f: new THREE.Vector3(0, 0, -1),
      hint: 0, pause: 0, alive: true, biteT: 0, ...o,
    };
  }

  // ---- the nest: entrance, shaft, junction, chambers (real geometry you can walk in) ----------------
  _buildNest(game, M, exitToward) {
    const E = this.entrance;
    const group = new THREE.Group();
    group.name = 'ant-nest';
    game.scene.add(group);
    const R = 0.002; // tunnel radius (4 mm wide)
    const physics = game.physics;
    const colliders = [];
    const addMesh = (geo, mat, collide = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      group.add(m);
      // Tunnels and rooms are walked from the inside (their material draws the inside too).
      if (collide) colliders.push(physics.staticTrimesh(geo, m.matrixWorld, null, { inside: true }));
      return m;
    };
    const at = (x, y, z) => new THREE.Vector3(E.x + x, E.y + y, E.z + z);

    // Surface: a 3 cm patch of bare dirt with the entrance hole (r 3 mm) in the middle.
    const plate = new THREE.Shape();
    const HS = 0.015;
    plate.moveTo(-HS, -HS);
    plate.lineTo(HS, -HS);
    plate.lineTo(HS, HS);
    plate.lineTo(-HS, HS);
    plate.lineTo(-HS, -HS);
    const hole = new THREE.Path();
    hole.absarc(0, 0, 0.003, 0, Math.PI * 2, true);
    plate.holes.push(hole);
    const plateMat = std({ color: 0x5a4330, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { detail: 'soil' });
    // The bare dirt is a ragged round patch (wider than the gap in the lawn, so it hides its corners).
    const rag = new THREE.Shape();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r = 0.0215 + Math.sin(a * 5 + 1.3) * 0.0016 + Math.sin(a * 11 + 0.4) * 0.0009;
      if (i === 0) rag.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else rag.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    rag.holes.push(hole);
    const pg = new THREE.ShapeGeometry(rag, 24);
    pg.rotateX(-Math.PI / 2);
    pg.translate(E.x, E.y + 0.00002, E.z);
    addMesh(pg, plateMat, false);
    // The ground over the whole nest (10 cm): solid, with just the entrance hole. Lawn covers it.
    const lid = new THREE.Shape();
    lid.moveTo(-0.05, -0.05);
    lid.lineTo(0.05, -0.05);
    lid.lineTo(0.05, 0.05);
    lid.lineTo(-0.05, 0.05);
    lid.lineTo(-0.05, -0.05);
    lid.holes.push(hole);
    const lg = new THREE.ShapeGeometry(lid, 32);
    lg.rotateX(-Math.PI / 2);
    lg.translate(E.x, E.y, E.z);
    colliders.push(physics.staticTrimesh(lg, new THREE.Matrix4()));
    // Its grass top (the lawn around it is cut away over the nest). Texture coordinates come from world
    // position, the same way the lawn's are, so the grass lines up with no seam.
    if (this.lidMaterial) {
      const top = lg.clone();
      const p = top.attributes.position, uv = top.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
      const lm = new THREE.Mesh(top, this.lidMaterial);
      lm.receiveShadow = true;
      group.add(lm);
    }
    // Dug-out soil grains piled in a ring around the hole (the little mound you see on lawns).
    const grainGeo = new THREE.IcosahedronGeometry(1, 0);
    const grains = new THREE.InstancedMesh(grainGeo, M.grain, 420);
    let gi = 0;
    for (let i = 0; i < 420; i++) {
      const a = i * 2.39996;
      const r = 0.0034 + Math.sqrt((i % 60) / 60) * 0.0085;
      const h = Math.max(0, 1 - Math.abs(r - 0.0055) / 0.006) * 0.0016 * (0.6 + 0.4 * hash3(i, 3, 0, 5));
      const size = 0.00018 + hash3(i, 4, 0, 5) * 0.00022;
      _q.setFromEuler(new THREE.Euler(i, i * 0.7, i * 1.3));
      grains.setMatrixAt(gi++, _m.compose(_v.set(E.x + Math.cos(a) * r, E.y + h * (i % 3 === 0 ? 1 : 0.6) + size * 0.4, E.z + Math.sin(a) * r), _q, _s.setScalar(size)));
    }
    grains.count = gi;
    grains.receiveShadow = true;
    grains.castShadow = true;
    group.add(grains);

    // Inside: a shaft straight down 9 mm into a junction room, then gently sloping tunnels: junction ->
    // queens, junction -> brood -> food store. Real Argentine ant nests are shallow (a few cm), with
    // winding tunnels; every slope here is under ~22 degrees so a tiny you can walk them.
    const nodes = {
      J: { c: at(0, -0.013, 0), r: [0.0055, 0.004, 0.0055] }, // junction
      Q: { c: at(-0.022, -0.019, -0.024), r: [0.013, 0.0055, 0.0105] }, // queens
      B: { c: at(0.027, -0.018, -0.013), r: [0.012, 0.005, 0.0095] }, // brood
      F: { c: at(0.028, -0.026, 0.022), r: [0.011, 0.0045, 0.009] }, // food storage
    };
    // A room is an ellipsoid with its floor squashed flat (ants level their chambers).
    const FLAT = 0.55;
    const unsquash = (nd, y) => {
      const fy = nd.c.y - nd.r[1] * FLAT;
      return y < fy ? fy + (y - fy) / 0.25 : y;
    };
    const inRoom = (nd, v) => { // > 0 = inside the room's open space
      const x = (v.x - nd.c.x) / nd.r[0], y = (unsquash(nd, v.y) - nd.c.y) / nd.r[1], z = (v.z - nd.c.z) / nd.r[2];
      return 1 - (x * x + y * y + z * z);
    };
    // Floor height of a room at (x, z).
    const floorAt = (nd, x, z) => {
      const fx = (x - nd.c.x) / nd.r[0], fz = (z - nd.c.z) / nd.r[2];
      const y0 = nd.c.y - nd.r[1] * Math.sqrt(Math.max(0, 1 - fx * fx - fz * fz));
      const fy = nd.c.y - nd.r[1] * FLAT;
      return y0 < fy ? fy + (y0 - fy) * 0.25 : y0;
    };
    // Normal pointing into the room at a wall point (unsquashed part of the ellipsoid).
    const wallNormal = (nd, p) => new THREE.Vector3(-(p.x - nd.c.x) / nd.r[0] ** 2, -(p.y - nd.c.y) / nd.r[1] ** 2, -(p.z - nd.c.z) / nd.r[2] ** 2).normalize();
    const holes = new Map(); // room -> [{ p: where a tunnel meets the wall, d: its direction, r: its radius }]
    const addHole = (k, p, d, r) => {
      if (!holes.has(k)) holes.set(k, []);
      // The hole is a hair smaller than the tunnel (wall and tube overlap: no cracks), and nudged up so
      // that overlap is a tiny lip at the floor (you step over it) rather than a low lintel overhead.
      const dn = d.clone().normalize();
      const lift = UP.clone().addScaledVector(dn, -dn.y).multiplyScalar(0.03 * r);
      holes.get(k).push({ p: p.clone().add(lift), d: dn, r });
    };
    // Tunnels are trimmed to end right at the room walls (no stub poking into the room), and each room's
    // hole is a little smaller than its tunnel, so wall and tube overlap: no crack to see or slip through.
    const tube = (curve, segs, radius, rooms) => {
      const g = clipMesh(new THREE.TubeGeometry(curve, segs, radius, 14, false), (v) => Math.max(...rooms.map((k) => inRoom(nodes[k], v))));
      addMesh(g, M.tunnel);
    };
    // Shaft: vertical tube from the surface hole down into the junction's ceiling.
    const shaftTop = at(0, 0.0004, 0), shaftBot = at(0, -0.013 + 0.0035, 0);
    tube(new THREE.LineCurve3(shaftTop, shaftBot), 8, 0.003, ['J']);
    addHole('J', shaftBot, UP, 0.003);

    // Where a tunnel heading toward `toward` leaves room `nd`: on its wall, with the tunnel's floor at
    // the room's floor (so you walk straight in).
    const doorway = (nd, toward) => {
      const ux = toward.x - nd.c.x, uz = toward.z - nd.c.z;
      const ul = Math.hypot(ux, uz) || 1;
      const dx = ux / ul, dz = uz / ul;
      const yOff = -nd.r[1] * FLAT + R; // tunnel center height in the room
      const f = Math.sqrt(Math.max(0.05, 1 - (yOff / nd.r[1]) ** 2));
      const t = f / Math.sqrt((dx / nd.r[0]) ** 2 + (dz / nd.r[2]) ** 2);
      return { p: new THREE.Vector3(nd.c.x + dx * t, nd.c.y + yOff, nd.c.z + dz * t), d: new THREE.Vector3(dx, 0, dz) };
    };
    // A tunnel from room a to room b. It bends out to one side (`side` = +1 / -1) just enough to keep
    // its steepest spot under MAX_SLOPE, and descends evenly along its length.
    const MAX_SLOPE = 20;
    const tunnels = [];
    const slopeOf = (curve, A, B) => {
      let prev = null, maxG = 0;
      for (let i = 0; i <= 240; i++) {
        const c = curve.getPointAt(i / 240);
        if (inRoom(A, c) > 0 || inRoom(B, c) > 0) {
          prev = null;
          continue;
        }
        if (prev) maxG = Math.max(maxG, Math.abs(c.y - prev.y) / Math.max(1e-9, Math.hypot(c.x - prev.x, c.z - prev.z)));
        prev = c;
      }
      return THREE.MathUtils.radToDeg(Math.atan(maxG));
    };
    const tunnel = (a, b, side) => {
      const A = nodes[a], B = nodes[b];
      let grade = Math.tan(THREE.MathUtils.degToRad(MAX_SLOPE - 3));
      let best = null;
      for (let attempt = 0; attempt < 14; attempt++) {
        let ta = B.c, tb = A.c, da, db, oa, ob, bend;
        for (let it = 0; it < 4; it++) {
          da = doorway(A, ta);
          db = doorway(B, tb);
          oa = da.p.clone().addScaledVector(da.d, 0.002); // 2 mm straight out of each door
          ob = db.p.clone().addScaledVector(db.d, 0.002);
          const need = Math.abs(da.p.y - db.p.y) / grade; // horizontal length the slope needs
          const mid = oa.clone().lerp(ob, 0.5);
          const perp = new THREE.Vector3(-(ob.z - oa.z), 0, ob.x - oa.x).normalize().multiplyScalar(side);
          const len = (o) => {
            bend = mid.clone().addScaledVector(perp, o);
            return 0.004 + Math.hypot(bend.x - oa.x, bend.z - oa.z) + Math.hypot(ob.x - bend.x, ob.z - bend.z);
          };
          let lo = 0, hi = 0.06;
          if (len(0) < need) for (let k = 0; k < 40; k++) (len((lo + hi) / 2) < need ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2));
          else hi = 0;
          len(hi);
          ta = tb = bend; // doors face the bend
        }
        // Even descent along the horizontal path door -> out -> bend -> out -> door, with points every
        // ~2.5 mm so the smooth curve hugs the path.
        const path = [da.p, oa, bend, ob, db.p];
        const flat = [path[0]];
        for (let i = 1; i < path.length; i++) {
          const n = Math.max(1, Math.round(Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z) / 0.0025));
          for (let j = 1; j <= n; j++) flat.push(path[i - 1].clone().lerp(path[i], j / n));
        }
        const cum = [0];
        for (let i = 1; i < flat.length; i++) cum.push(cum[i - 1] + Math.hypot(flat[i].x - flat[i - 1].x, flat[i].z - flat[i - 1].z));
        const L = cum[cum.length - 1];
        const pts = flat.map((q, i) => new THREE.Vector3(q.x, da.p.y + (db.p.y - da.p.y) * (cum[i] / L), q.z));
        // The ends reach a little into each room (the tube is trimmed at the walls).
        pts.unshift(da.p.clone().addScaledVector(da.d, -0.0012));
        pts.push(db.p.clone().addScaledVector(db.d, -0.0012));
        const curve = new THREE.CatmullRomCurve3(pts);
        const slope = slopeOf(curve, A, B);
        best = { a, b, curve, da, db, maxSlope: slope };
        if (slope <= MAX_SLOPE) break;
        grade *= 0.9; // too steep somewhere: lengthen the path and try again
      }
      tube(best.curve, Math.ceil(best.curve.getLength() / 0.0008), R, [a, b]);
      addHole(a, best.da.p, best.da.d, R);
      addHole(b, best.db.p, best.db.d, R);
      tunnels.push(best);
      return best;
    };
    tunnel('J', 'Q', 1);
    const tJB = tunnel('J', 'B', 1);
    const tBF = tunnel('B', 'F', -1);

    // Rooms with holes where the tunnels come in.
    const w = new THREE.Vector3();
    const inHole = (hs, v) => {
      let best = -Infinity;
      for (const h of hs) {
        w.subVectors(v, h.p);
        const along = w.dot(h.d); // + = out of the room, into the tunnel
        if (along < -h.r || along > h.r * 2.5) continue; // only this stretch of wall
        best = Math.max(best, h.r * 0.95 - Math.sqrt(Math.max(0, w.lengthSq() - along * along)));
      }
      return best;
    };
    for (const [k, nd] of Object.entries(nodes)) {
      const g = new THREE.SphereGeometry(1, 56, 34).toNonIndexed();
      g.scale(nd.r[0], nd.r[1], nd.r[2]);
      g.translate(nd.c.x, nd.c.y, nd.c.z);
      const p = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
      const fy = nd.c.y - nd.r[1] * FLAT;
      for (let i = 0; i < p.count; i++) {
        // Smooth normal straight from the shape (before the squash), then the floor squash itself.
        const y0 = p.getY(i);
        _v.set((p.getX(i) - nd.c.x) / nd.r[0] ** 2, (y0 - nd.c.y) / nd.r[1] ** 2, (p.getZ(i) - nd.c.z) / nd.r[2] ** 2);
        if (y0 < fy) {
          p.setY(i, fy + (y0 - fy) * 0.25);
          _v.y *= 4;
        }
        _v.normalize();
        nrm.setXYZ(i, _v.x, _v.y, _v.z);
        // Planar texture coordinates so the soil texture shows evenly.
        uv.setXY(i, (p.getX(i) + p.getY(i) * 0.5) * 120, (p.getZ(i) + p.getY(i) * 0.5) * 120);
      }
      addMesh(clipMesh(g, (v) => inHole(holes.get(k) || [], v)), M.tunnel);
    }

    // Behind every wall: dark soil, so a hairline crack between a tunnel and a room shows dirt (never the
    // lawn next door), and solid ground under the whole nest.
    {
      const shellMat = std({ color: 0x1b130d, roughness: 1, side: THREE.BackSide }, { detail: 'soil' });
      shellMat.envMapIntensity = 0.06;
      const SH = 0.0495, top = E.y - 0.0004, bot = E.y - 0.075;
      const box = new THREE.BoxGeometry(SH * 2, top - bot, SH * 2);
      box.translate(E.x, (top + bot) / 2, E.z);
      // Drop the box's top face (+y, the third group); the top is a sheet with the entrance hole.
      const idx = box.index.array, keep = [];
      for (const gr of box.groups) if (gr.materialIndex !== 2) for (let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx[i]);
      box.setIndex(keep);
      box.clearGroups();
      const sheet = new THREE.ShapeGeometry(lid, 32);
      sheet.rotateX(-Math.PI / 2);
      sheet.translate(E.x, top, E.z);
      for (const g of [box, sheet]) group.add(new THREE.Mesh(g, shellMat));
      physics.staticBox(E.x, bot - 0.01, E.z, 0.05, 0.01, 0.05);
    }

    // The trail inside: food store -> across the food room -> tunnel -> across the brood room -> tunnel ->
    // across the junction -> up its wall and ceiling into the shaft -> up the shaft -> over the rim.
    const J = nodes.J, Q = nodes.Q, B = nodes.B, F = nodes.F;
    const pts = [];
    const push = (p, n) => pts.push([[p.x, p.y, p.z], [n.x, n.y, n.z]]);
    const doorBottom = (t, k) => (t.a === k ? t.da : t.db).p.clone().addScaledVector(UP, -R);
    const acrossFloor = (nd, from, to) => {
      const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.001));
      for (let i = 0; i <= n; i++) {
        const x = from.x + ((to.x - from.x) * i) / n, z = from.z + ((to.z - from.z) * i) / n;
        push(_v.set(x, floorAt(nd, x, z) + 0.00002, z), UP);
      }
    };
    const alongTunnel = (t, reverse) => {
      const A = nodes[t.a], Bn = nodes[t.b];
      for (let i = 0; i <= 80; i++) {
        const u = reverse ? 1 - i / 80 : i / 80;
        const c = t.curve.getPointAt(u);
        if (inRoom(A, c) > -0.02 || inRoom(Bn, c) > -0.02) continue; // the rooms' floors take over there
        const tg = t.curve.getTangentAt(u);
        const up = UP.clone().addScaledVector(tg, -tg.y).normalize(); // "up" across the tunnel floor
        push(c.addScaledVector(up, -R * 0.98), up);
      }
    };
    // The far side of a room from its doors (where the brood / food piles are kept, off the path).
    const farSide = (nd, ...ts) => {
      const d = new THREE.Vector3();
      for (const t of ts) d.add((t.a === Object.keys(nodes).find((k) => nodes[k] === nd) ? t.da : t.db).d);
      return d.set(-d.x, 0, -d.z).normalize();
    };
    const farF = farSide(F, tBF), farB = farSide(B, tJB, tBF);
    const storeC = new THREE.Vector3(F.c.x + farF.x * F.r[0] * 0.3, 0, F.c.z + farF.z * F.r[2] * 0.3);
    const startF = new THREE.Vector3(F.c.x - farF.x * F.r[0] * 0.1, 0, F.c.z - farF.z * F.r[2] * 0.1);
    acrossFloor(F, startF, doorBottom(tBF, 'F'));
    alongTunnel(tBF, true);
    acrossFloor(B, doorBottom(tBF, 'B'), doorBottom(tJB, 'B'));
    alongTunnel(tJB, true);
    // Out of the junction toward where the trail goes outside.
    const u = new THREE.Vector3(exitToward.x - E.x, 0, exitToward.z - E.z).normalize();
    const edge = Math.cos(Math.asin(FLAT)) * J.r[0]; // where the floor meets the wall
    acrossFloor(J, doorBottom(tJB, 'J'), new THREE.Vector3(J.c.x + u.x * edge * 0.9, 0, J.c.z + u.z * edge * 0.9));
    // Up the wall and across the ceiling (upside down) to the shaft.
    const topA = Math.acos(0.0029 / J.r[0]);
    for (const a of [-Math.asin(FLAT) + 0.05, -0.3, 0, 0.35, 0.7, topA]) {
      const q = new THREE.Vector3(J.c.x + u.x * J.r[0] * Math.cos(a), J.c.y + J.r[1] * Math.sin(a), J.c.z + u.z * J.r[0] * Math.cos(a));
      push(q, wallNormal(J, q));
    }
    // Up the shaft wall (facing the middle) and over the little rim at the top.
    const ceilY = J.c.y + J.r[1] * Math.sin(topA);
    const inward = u.clone().negate();
    push(new THREE.Vector3(E.x + u.x * 0.00296, ceilY + 0.0002, E.z + u.z * 0.00296), inward);
    push(new THREE.Vector3(E.x + u.x * 0.00296, E.y + 0.0002, E.z + u.z * 0.00296), inward);
    push(new THREE.Vector3(E.x + u.x * 0.00302, E.y + 0.00045, E.z + u.z * 0.00302), u.clone().add(UP).normalize());
    push(new THREE.Vector3(E.x + u.x * 0.0034, E.y + 0.00002, E.z + u.z * 0.0034), UP);
    let entranceD = 0;
    for (let i = 1; i < pts.length; i++) entranceD += _v.fromArray(pts[i][0]).distanceTo(_v2.fromArray(pts[i - 1][0]));

    // Brood chamber (on the far side from the doors, off the trail): piles of eggs, larvae, pupae.
    const bc = new THREE.Vector3(B.c.x + farB.x * B.r[0] * 0.35, 0, B.c.z + farB.z * B.r[2] * 0.35);
    const side = new THREE.Vector3(-farB.z, 0, farB.x);
    const onB = (x, z, lift) => _v.set(x, floorAt(B, x, z) + lift, z);
    // Eggs (0.3 mm, glossy, sticky): workers keep them in little piles, so they're carried as a clump.
    const eggs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), M.egg, 90);
    for (let i = 0; i < 90; i++) {
      const k = i % 3, j = Math.floor(i / 3), a = j * 2.39996, rr = Math.sqrt(j / 30) * 0.00095;
      const px = bc.x + side.x * (k - 1) * 0.0026 + farB.x * (k === 1 ? 0.0012 : 0), pz = bc.z + side.z * (k - 1) * 0.0026 + farB.z * (k === 1 ? 0.0012 : 0);
      const h = (1 - rr / 0.00095) * 0.0004; // a mound: highest in the middle
      _q.setFromEuler(new THREE.Euler(hash3(i, 1, 0, 41) * 3, a, hash3(i, 2, 0, 41) * 3));
      eggs.setMatrixAt(i, _m.compose(onB(px + Math.cos(a) * rr, pz + Math.sin(a) * rr, 0.0001 + h), _q, _s.set(0.00011, 0.00011, 0.00016)));
    }
    // Larvae (curled white grubs) in a loose ring in front of the eggs.
    const larvaGeo = new THREE.TorusGeometry(0.0003, 0.00019, 6, 10, Math.PI * 1.3);
    const larvae = new THREE.InstancedMesh(larvaGeo, M.larva, 26);
    const lc = bc.clone().addScaledVector(farB, -0.0035);
    for (let i = 0; i < 26; i++) {
      const a = i * 2.1, r = 0.0011 + (i % 4) * 0.0006;
      _q.setFromEuler(new THREE.Euler(Math.PI / 2, a, 0));
      larvae.setMatrixAt(i, _m.compose(onB(lc.x + Math.cos(a) * r, lc.z + Math.sin(a) * r, 0.0002), _q, _s.setScalar(1 + (i % 3) * 0.25)));
    }
    // Pupae: pale, still ants lying on their side in a row behind the eggs (no cocoon in this species).
    const pupae = new THREE.InstancedMesh(workerGeo(false), M.larva, 14);
    for (let i = 0; i < 14; i++) {
      const o = (i - 6.5) * 0.0009;
      const x = bc.x + farB.x * 0.0034 + side.x * o, z = bc.z + farB.z * 0.0034 + side.z * o;
      _q.setFromEuler(new THREE.Euler(0, Math.atan2(farB.x, farB.z) + (i % 3 - 1) * 0.3, (Math.PI / 2) * (i % 2 ? 1 : -1), 'YXZ'));
      pupae.setMatrixAt(i, _m.compose(onB(x, z, 0.00036), _q, _s.setScalar(0.95)));
    }
    for (const im of [eggs, larvae, pupae]) {
      im.receiveShadow = true;
      group.add(im);
    }
    // Food chamber store: bits the foragers bring home (count grows as they deliver).
    const store = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), M.food, 400);
    store.count = 0;
    group.add(store);

    // Queens: 3 of them in the queen chamber, each with a few attendants.
    const queens = [0, 1, 2].map((i) => {
      const x = Q.c.x - 0.005 + i * 0.005, z = Q.c.z + (i - 1) * 0.003;
      return { pos: new THREE.Vector3(x, floorAt(Q, x, z), z), yaw: 0.8 + i * 1.9, phase: i };
    });

    // Points along every tunnel (for "is this spot inside the nest's open space?").
    const tunnelPts = [];
    for (const t of tunnels) for (let i = 0; i <= 64; i++) tunnelPts.push(t.curve.getPointAt(i / 64));

    // Self-check (cheap, at load): slopes, and nothing cutting through anything else.
    const problems = [];
    for (const t of tunnels) {
      if (t.maxSlope > MAX_SLOPE + 2) problems.push(`tunnel ${t.a}-${t.b} slope ${t.maxSlope.toFixed(0)} deg`);
      for (let i = 0; i <= 200; i++) {
        const c = t.curve.getPointAt(i / 200);
        if (Math.abs(c.x - E.x) > 0.047 || Math.abs(c.z - E.z) > 0.047) problems.push(`tunnel ${t.a}-${t.b} leaves the nest area`);
        for (const [k, nd] of Object.entries(nodes)) {
          if (k === t.a || k === t.b) continue;
          const x = (c.x - nd.c.x) / (nd.r[0] + R + 0.001), y = (c.y - nd.c.y) / (nd.r[1] + R + 0.001), z = (c.z - nd.c.z) / (nd.r[2] + R + 0.001);
          if (x * x + y * y + z * z < 1) problems.push(`tunnel ${t.a}-${t.b} runs into room ${k}`);
        }
        for (const o of tunnels) {
          if (o === t || o.a === t.a || o.a === t.b || o.b === t.a || o.b === t.b) continue;
          for (let j = 0; j <= 60; j++) if (o.curve.getPointAt(j / 60).distanceTo(c) < R * 2 + 0.001) problems.push(`tunnels ${t.a}-${t.b} and ${o.a}-${o.b} touch`);
        }
      }
    }
    for (const t of tunnels) if (t.a === 'J' || t.b === 'J') {
      const d = (t.a === 'J' ? t.da : t.db).d;
      if (d.dot(u) > Math.cos(THREE.MathUtils.degToRad(55))) problems.push(`junction door ${t.a}-${t.b} is in the way of the climb out`);
    }
    if (problems.length) console.warn('ant nest layout:', [...new Set(problems)].join('; '));

    return {
      group, nodes, colliders, store, storeC, queens, trailInside: pts, entranceD, tunnels, tunnelPts, R, shaftBot, floorAt, inRoom,
      bounds: new THREE.Box3(at(-0.05, -0.08, -0.05), at(0.05, 0.001, 0.05)),
    };
  }

  // Is this point inside the nest (underground)?
  inNest(p) {
    return this.nest.bounds.containsPoint(p) && p.y < this.entrance.y - 0.0005;
  }

  // Is this point in the nest's open space (a room, a tunnel or the shaft), not in solid soil?
  _inCavity(p) {
    const N = this.nest;
    for (const nd of Object.values(N.nodes)) if (N.inRoom(nd, p) > -0.2) return true;
    const E = this.entrance;
    if (Math.hypot(p.x - E.x, p.z - E.z) < 0.0036 && p.y > N.shaftBot.y - 0.002) return true;
    const rr = (N.R * 1.6) ** 2;
    for (const q of N.tunnelPts) if (q.distanceToSquared(p) < rr) return true;
    return false;
  }

  // Safety net: if a physics slip ever leaves you inside the solid soil between rooms, you're put back
  // on the floor of the nearest room (instead of being stuck in the dark forever).
  _rescue(pl) {
    let best = null, bd = Infinity;
    for (const nd of Object.values(this.nest.nodes)) {
      const d = nd.c.distanceToSquared(pl.feet);
      if (d < bd) { bd = d; best = nd; }
    }
    pl.teleport(_v.set(best.c.x, this.nest.floorAt(best, best.c.x, best.c.z) + 0.00002, best.c.z));
  }

  // ---- per frame ----------------------------------------------------------------------------------
  update(dt) {
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    const pl = this.game.player;
    const cam = this.game.camera.position;
    const tr = this.trail;
    const playerSmall = pl.height < 0.03;
    const plChest = _chest.copy(pl.feet).addScaledVector(UP, pl.height * 0.5);
    // Your boots, when you're big enough to step on ants: only ants under a sole that's down on the ground
    // get crushed (like real life: most of a trail survives someone walking along it).
    const soles = pl.height > 0.25 && pl.grounded && !pl.dead && Math.hypot(pl.vel.x, pl.vel.z) > pl.height * 0.3 ? this._soles(pl) : null;
    const plMoving = Math.hypot(pl.vel.x, pl.vel.z) > pl.height * 0.3;

    let bi = 0, fi = 0;
    this.legIdx = 0;
    for (const a of this.ants) {
      if (!a.alive) continue;
      if (a.mode === 'trail') this._walkTrail(a, dt);
      else if (a.mode === 'tend') this._tend(a, dt);
      else if (a.mode === 'attack') this._attack(a, dt, pl);

      // Notice a small moving thing near you (ants defend their trail).
      if (a.mode === 'trail' && playerSmall && !pl.dead && a.pos.distanceToSquared(plChest) < (0.012 + pl.height) ** 2 && plMoving) {
        a.mode = 'attack';
        a.resumeS = a.s;
      }
      // A big you squishes ants under your boots (real: ants are flattened by shoes).
      if (soles && a.n.y > 0.7) {
        const dx = a.pos.x - pl.feet.x, dz = a.pos.z - pl.feet.z;
        if (dx * dx + dz * dz < (pl.height * 0.4) ** 2 && this._underSole(a.pos, soles)) this._squish(a);
      }

      // Draw: body always (when it's not too far to see at all), legs only up close.
      const dc = a.pos.distanceTo(cam);
      if (ANT_L / dc < 0.00035) continue;
      this._matrix(a, _m);
      this.bodies.setMatrixAt(bi++, _m);
      if (a.carrying) {
        _v.set(0, 0.00035, -0.0012).applyMatrix4(_m);
        _m.compose(_v, _q.identity(), _s.setScalar(0.00028));
        this.foodMesh.setMatrixAt(fi++, _m);
        this._matrix(a, _m);
      }
      if (ANT_L / dc > 0.012) this._legs(a, _m);
    }
    // Queens (slow, attended) and dead ants (flattened).
    let qi = 0;
    for (const q of this.queens) {
      const dc = q.pos.distanceTo(cam);
      if (ANT_L * 1.8 / dc < 0.00035) continue;
      _q.setFromAxisAngle(UP, q.yaw + Math.sin(this.t * 0.2 + q.phase) * 0.1);
      _m.compose(q.pos, _q, _s.setScalar(1));
      this.queenMesh.setMatrixAt(qi++, _m);
      if (ANT_L * 1.8 / dc > 0.012) {
        const qa = { pos: q.pos, n: UP, f: _v2.set(-Math.sin(q.yaw), 0, -Math.cos(q.yaw)), phase: this.t * 0.6 + q.phase, speed: 0.001 };
        this._legs(qa, _m, 1.75);
      }
    }
    const maxB = this.bodies.instanceMatrix.count;
    for (const d of this.deadAnts) {
      if (bi >= maxB) break;
      if (ANT_L / d.pos.distanceTo(cam) < 0.00035) continue;
      this.bodies.setMatrixAt(bi++, d.m);
    }
    this.bodies.count = bi;
    this.queenMesh.count = qi;
    this.foodMesh.count = fi;
    this.legMesh.count = this.legIdx;
    for (const im of [this.bodies, this.queenMesh, this.foodMesh, this.legMesh]) im.instanceMatrix.needsUpdate = true;

    // Stuck in the soil? (see _rescue)
    if (this.inNest(pl.feet) && !pl.dead && !pl.heldBy && pl.height < 0.02) {
      _v.copy(pl.feet).addScaledVector(UP, pl.height * 0.5);
      this.lostT = this._inCavity(_v) ? 0 : (this.lostT || 0) + dt;
      if (this.lostT > 0.4) {
        this.lostT = 0;
        this._rescue(pl);
      }
    } else this.lostT = 0;

    // Your light underground.
    const inside = this.inNest(this.game.camera.position) || this.inNest(pl.feet);
    this.headLamp.on = inside;
    if (inside) {
      const H = pl.height;
      // From your eyes (inside a tunnel your head is near the ceiling, so not above it), shining where
      // you look and a little down.
      const cp = Math.cos(pl.pitch);
      this.headLamp.position.copy(pl.feet).addScaledVector(UP, pl.eyeHeight * 0.97);
      this.headLamp.position.x -= Math.sin(pl.yaw) * H * 0.08;
      this.headLamp.position.z -= Math.cos(pl.yaw) * H * 0.08;
      this.headLamp.range = H * 20;
      // Brightness for a lit patch ~4 body heights ahead. (The renderer treats anything closer than 10
      // cm as 10 cm away, so at this size the light doesn't get brighter up close: it's set for that.)
      this.headLamp.intensity = 7 * Math.max((4 * H) ** 2, 0.01);
      this.headLamp.dir.set(-Math.sin(pl.yaw) * cp, Math.sin(pl.pitch) - 0.35, -Math.cos(pl.yaw) * cp).normalize();
    }
  }

  // Walking the scent trail. Going out (+1) toward food; coming home (-1) with food.
  _walkTrail(a, dt) {
    const tr = this.trail;
    a.s += a.dir * a.speed * (a.carrying ? 0.8 : 1) * dt;
    a.phase += a.speed * dt / (ANT_L * 0.55) * Math.PI;
    if (a.s >= tr.length - 0.0005) {
      // At the food: take a bite-sized load (about 0.1 mg) if there's food, then head home.
      a.s = tr.length - 0.0005;
      a.dir = -1;
      a.carrying = this._takeFood();
    } else if (a.s <= 0.0003) {
      // Home: drop the food in the store and go back out.
      a.s = 0.0003;
      a.dir = 1;
      if (a.carrying) this._store();
      a.carrying = false;
    }
    a.hint = tr.sample(a.s, a.pos, a.n, a.f, a.hint);
    if (a.dir < 0) a.f.negate();
    // Spread across the trail (each ant has its own lane) with a little wobble, like real trails.
    const side = _v.crossVectors(a.f, a.n).normalize();
    const width = a.s < this.entranceD ? 0.0006 : 0.0022;
    const off = (a.lat + Math.sin(this.t * 3.1 + a.id * 1.7) * 0.12) * width;
    a.pos.addScaledVector(side, off);
    // Wobble the heading a bit too (ants zig-zag as they sniff the trail).
    a.f.addScaledVector(side, Math.cos(this.t * 3.1 + a.id * 1.7) * 0.25).normalize();
  }

  // Nest workers walk slow loops in their chamber.
  _tend(a, dt) {
    const nd = [this.nest.nodes.Q, this.nest.nodes.B, this.nest.nodes.F][a.ch];
    const t = this.t * 0.25 + a.loop * 6.28;
    const rx = nd.r[0] * (0.35 + a.loop * 0.3), rz = nd.r[2] * (0.35 + (1 - a.loop) * 0.3);
    const x = nd.c.x + Math.cos(t) * rx, z = nd.c.z + Math.sin(t) * rz;
    a.pos.set(x, this.nest.floorAt(nd, x, z) + 0.00002, z);
    a.f.set(-Math.sin(t) * rx, 0, Math.cos(t) * rz).normalize();
    a.n.set(0, 1, 0);
    a.speed = 0.25 * Math.hypot(rx, rz) * 0.8;
    a.phase += a.speed * dt / (ANT_L * 0.55) * Math.PI;
  }

  // Attacking something small: run at it over the ground, bite, hold on.
  _attack(a, dt, pl) {
    const target = _v2.copy(pl.feet);
    const d = a.pos.distanceTo(target);
    if (pl.dead || pl.height >= 0.03 || d > 0.08) {
      // Lost it (or it got big): go back to the trail where it left.
      a.mode = 'trail';
      a.s = a.resumeS ?? a.s;
      return;
    }
    // Move along the ground toward you (ants are fast for their size: about 3 cm/s).
    const dir = _v.subVectors(target, a.pos);
    dir.y = 0;
    const L = dir.length();
    if (L > pl.radius + ANT_L * 0.4) {
      dir.divideScalar(L);
      const step = Math.min(L, 0.03 * dt);
      a.pos.addScaledVector(dir, step);
      a.f.copy(dir);
      a.phase += 0.03 * dt / (ANT_L * 0.55) * Math.PI;
      // Stay on the ground under it.
      const hit = this.game.physics.raycast(_v.copy(a.pos).addScaledVector(UP, 0.003), { x: 0, y: -1, z: 0 }, 0.006, { predicate: (c) => this.game.physics.ownerOf(c) !== pl });
      if (hit) {
        a.pos.y = hit.point.y;
        a.n.copy(hit.normal);
      }
    } else {
      // Biting. Each bite is weak, but many ants add up. Damage depends on your size vs. an ant.
      a.biteT -= dt;
      if (a.biteT <= 0) {
        a.biteT = 0.55;
        const dmg = Math.max(1, Math.round(2.2 * clamp(ANT_L / pl.height, 0.3, 3)));
        pl.hurt(dmg, { cause: 'Swarmed by Argentine ants', at: _v.copy(pl.feet).addScaledVector(UP, pl.height * 0.3), dir: _v2.subVectors(pl.feet, a.pos).normalize(), gore: true });
        bus.emit('ant:bite', a);
      }
    }
  }

  // The two boot soles (model space: a 10.4 x 26 cm sole under each ankle at 1.75 m), as inverse
  // matrices, for soles that are down on the ground right now.
  _soles(pl) {
    const B = pl.model?.userData?.bones;
    if (!B) return null;
    this._soleMats ??= [new THREE.Matrix4(), new THREE.Matrix4()];
    const out = [];
    ['ankleL', 'ankleR'].forEach((k, i) => {
      const bone = B[k];
      bone.updateWorldMatrix(true, false);
      // Sole bottom in world space: is it on the ground (within a couple of percent of your height)?
      _lp.set(0, -0.079, -0.06).applyMatrix4(bone.matrixWorld);
      if (_lp.y - pl.feet.y > pl.height * 0.025) return; // this foot is in the air (mid-step)
      out.push(this._soleMats[i].copy(bone.matrixWorld).invert());
    });
    return out.length ? out : null;
  }

  _underSole(p, soles) {
    for (const inv of soles) {
      _lp.copy(p).applyMatrix4(inv);
      if (Math.abs(_lp.x) < 0.056 && Math.abs(_lp.z + 0.06) < 0.135 && _lp.y < -0.04 && _lp.y > -0.13) return true;
    }
    return false;
  }

  _takeFood() {
    // Real food on the counter: shrink it by what the ant carries away (0.1 mg per load).
    for (const p of this.foodProps) {
      if (!p || !this.game.props.has(p) || p.held || p.pocketed) continue;
      const end = this.trail.p[this.trail.p.length - 1];
      const tp = p.body.translation();
      if (Math.hypot(tp.x - end.x, tp.y - end.y, tp.z - end.z) > 0.12) continue;
      const m = p.mass;
      if (m < 0.0000005) continue;
      const s = p.scale * Math.cbrt(Math.max(0, 1 - 0.0000001 / m));
      if (s < 0.05) {
        p.dispose();
        continue;
      }
      p.setScale(s, { force: true });
      return true;
    }
    return false;
  }

  _store() {
    this.foodStored += 0.0001;
    const st = this.nest.store;
    if (st.count < st.instanceMatrix.count) {
      // A growing heap on the far side of the food room (off the trail).
      const F = this.nest.nodes.F, c = this.nest.storeC;
      const i = st.count;
      const a = i * 2.39996, r = Math.sqrt(i / 400) * 0.0035;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      _q.setFromEuler(new THREE.Euler(i, i * 0.5, 0));
      st.setMatrixAt(i, _m.compose(_v.set(x, this.nest.floorAt(F, x, z) + 0.00015 + (1 - r / 0.0035) * 0.0007 * Math.min(1, i / 150), z), _q, _s.setScalar(0.00024)));
      st.count++;
      st.instanceMatrix.needsUpdate = true;
    }
  }

  _squish(a) {
    a.alive = false;
    // The body stays there, flattened (and the others will carry it away to the refuse pile later).
    this._matrix(a, _m);
    _m.scale(_s.set(1.25, 0.25, 1.1));
    this.deadAnts.push({ pos: a.pos.clone(), m: _m.clone() });
    if (this.deadAnts.length > 120) this.deadAnts.shift();
    bus.emit('ant:squished', a);
  }

  // Body matrix: forward = f, up = n.
  _matrix(a, out, k = 1) {
    _Y.copy(a.n);
    _Z.copy(a.f).negate();
    _X.crossVectors(_Y, _Z).normalize();
    _Z.crossVectors(_X, _Y).normalize();
    out.makeBasis(_X, _Y, _Z);
    out.scale(_s.setScalar(k));
    out.setPosition(a.pos);
    return out;
  }

  // Six legs with a tripod gait, solved per leg (two bones), plus elbowed antennae.
  _legs(a, bodyM, k = 1) {
    const im = this.legMesh;
    const max = im.instanceMatrix.count;
    const stride = 0.00055 * k;
    const moving = a.speed > 0.0005;
    for (const l of LEGS) {
      if (this.legIdx + 2 > max) return;
      const ph = a.phase + l.g * Math.PI;
      const foot = _v.copy(l.rest).multiplyScalar(k);
      if (moving) {
        foot.z += -Math.sin(ph) * stride * 0.5;
        foot.y += Math.max(0, Math.cos(ph)) * 0.00022 * k;
      }
      const hip = _v2.copy(l.hip).multiplyScalar(k);
      const knee = solveKnee(hip, foot, l.a * k, l.b * k, _v3.set(l.side * 0.7, 1, 0).normalize(), _knee);
      this._seg(hip, knee, 0.00007 * k, bodyM);
      this._seg(knee, foot, 0.000055 * k, bodyM);
    }
    // Antennae: scape forward and out, then the long bent part angling down (they tap the ground).
    for (const sx of [-1, 1]) {
      if (this.legIdx + 2 > max) return;
      const base = _v.set(sx * 0.00011 * k, 0.00049 * k, -0.00092 * k);
      const elbow = _v2.set(sx * 0.00034 * k, (0.00068 + Math.sin(a.phase * 0.7 + sx) * 0.00006) * k, -0.00138 * k);
      this._seg(base, elbow, 0.00004 * k, bodyM);
      const tip = _tip.set(sx * 0.00055 * k, (0.0004 + Math.sin(a.phase * 0.9 + sx * 2) * 0.0001) * k, -0.0021 * k);
      this._seg(_el.copy(elbow), tip, 0.000035 * k, bodyM);
    }
  }

  _seg(from, to, r, bodyM) {
    const d = _s.subVectors(to, from);
    const len = d.length();
    if (len < 1e-9) return;
    _q.setFromUnitVectors(UP, d.divideScalar(len));
    _lm.compose(from, _q, _ls.set(r, len, r));
    this.legMesh.setMatrixAt(this.legIdx++, _lm.premultiply(bodyM));
  }
}

// Removes the parts of a triangle mesh where inside(point) > 0. Triangles that cross the edge are split
// (down to 1/2^depth of their size) so the cut follows the edge closely. Every attribute (normals, UVs)
// is carried along.
function clipMesh(geo, inside, depth = 3) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const names = ['position', ...Object.keys(src.attributes).filter((n) => n !== 'position')];
  const attrs = names.map((n) => src.attributes[n]);
  const stride = attrs.reduce((s, a) => s + a.itemSize, 0);
  const read = (i) => {
    const r = new Array(stride);
    let o = 0;
    for (const a of attrs) for (let c = 0; c < a.itemSize; c++) r[o++] = a.array[i * a.itemSize + c];
    return r;
  };
  const P = new THREE.Vector3();
  const ins = (r) => inside(P.set(r[0], r[1], r[2]));
  const mid = (a, b) => a.map((x, i) => (x + b[i]) * 0.5);
  const cen = (a, b, c) => a.map((x, i) => (x + b[i] + c[i]) / 3);
  const out = [];
  const emit = (a, b, c) => out.push(...a, ...b, ...c);
  const tri = (a, b, c, d) => {
    const ia = ins(a) > 0, ib = ins(b) > 0, ic = ins(c) > 0;
    if (ia && ib && ic) return;
    if (!ia && !ib && !ic && (d > 0 || ins(cen(a, b, c)) <= 0)) return emit(a, b, c);
    if (d >= depth) {
      if (ins(cen(a, b, c)) <= 0) emit(a, b, c);
      return;
    }
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    tri(a, ab, ca, d + 1);
    tri(ab, b, bc, d + 1);
    tri(ca, bc, c, d + 1);
    tri(ab, bc, ca, d + 1);
  };
  for (let i = 0; i < src.attributes.position.count; i += 3) tri(read(i), read(i + 1), read(i + 2), 0);
  const n = out.length / stride;
  const g = new THREE.BufferGeometry();
  let o = 0;
  for (let k = 0; k < names.length; k++) {
    const sz = attrs[k].itemSize, arr = new Float32Array(n * sz);
    for (let v = 0; v < n; v++) for (let c = 0; c < sz; c++) arr[v * sz + c] = out[v * stride + o + c];
    if (names[k] === 'normal') {
      for (let v = 0; v < n; v++) {
        const l = Math.hypot(arr[v * 3], arr[v * 3 + 1], arr[v * 3 + 2]) || 1;
        arr[v * 3] /= l;
        arr[v * 3 + 1] /= l;
        arr[v * 3 + 2] /= l;
      }
    }
    g.setAttribute(names[k], new THREE.BufferAttribute(arr, sz));
    o += sz;
  }
  return g;
}
