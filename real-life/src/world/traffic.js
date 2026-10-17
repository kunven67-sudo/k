// Cars (master list §17 for later driving; here: the town's traffic). Real cars with real
// colliders (you bump into them, you can't walk through them):
//   - Elm Ave: through traffic both ways, busier at rush hour, quiet at night.
//   - Parked cars in driveways. When Mom leaves for work, she gets in her car, backs out and
//     drives off down Maple to Elm; when she comes home the car comes back and parks first.
//   - Drivers brake for people (you, neighbours) and other cars, and honk if you stand in the road.
// Drive on the right: north is -z, so northbound Elm traffic uses the east lane.
//
//   const traffic = new Traffic(world)
//   traffic.parkedCarOf(ownerId) / traffic.depart(ownerId) / traffic.arrive(ownerId, onParked)

import * as THREE from 'three';
import { clock } from '../core/clock.js';
import { audio } from '../core/audio.js';
import { settings } from '../core/settings.js';
import { assets } from '../gfx/assets.js';
import { carPaint } from '../gfx/realmat.js';
import { ELM, MAPLE, CURB } from './layout.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CAR_MODELS = ['NormalCar1', 'NormalCar2', 'SUV', 'SportsCar', 'SportsCar2', 'Taxi', 'Cop'];
const PAINT = ['#b8bcc2', '#1d1f24', '#f2f2f0', '#8b1e22', '#1f3f73', '#5d6a72', '#2f5d3a', '#c7a46b', '#6a1f45', '#d9d4c7'];
const V = (x, z) => new THREE.Vector3(x, 0, z);
const LANE = 1.9;

export class Traffic {
  constructor(world) {
    this.world = world;
    this.cars = [];
    this.parked = new Map(); // ownerId -> car
    this._spawnT = 2;
    this._honkT = 0;
  }

  static assets() {
    return CAR_MODELS.map((m) => ['autos', m]);
  }

  // ------------------------------------------------------------------ cars
  _make(model, color) {
    const m = assets.model('autos', model);
    if (color) {
      // Repaint the body (realmat marked it as car paint) in this car's colour.
      const paint = carPaint(new THREE.Color(color).getHex());
      m.traverse((o) => {
        if (o.isMesh && o.material.userData?.carPaint) o.material = paint;
      });
    }
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
      }
    });
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const g = new THREE.Group();
    m.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    g.add(m);
    // Headlights / tail lights glow at night (sprites, no real lights: cheap on a GT 1030).
    const lights = [];
    for (const [dz, col, sx] of [[size.z / 2 + 0.02, 0xfff1d0, 0.55], [-size.z / 2 - 0.02, 0xff2a1a, 0.32]]) {
      for (const dx of [-size.x * 0.33, size.x * 0.33]) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        sp.position.set(dx, size.y * 0.42, dz);
        sp.scale.setScalar(sx);
        g.add(sp);
        lights.push(sp);
      }
    }
    this.world.scene.add(g);
    const kin = this.world.physics.addKinematicBox({ x: size.x * 0.92, y: size.y * 0.9, z: size.z * 0.95 }, g.position, { owner: { kind: 'car' } });
    return { group: g, size, kin, lights, speed: 0, path: null, i: 0, yaw: 0, state: 'drive', honked: 0, blockedT: 0 };
  }

  _remove(car) {
    this.world.scene.remove(car.group);
    this.world.physics.removeBody(car.kin.body);
    this.cars = this.cars.filter((c) => c !== car);
  }

  _place(car, p, yaw) {
    // On the road surface or up on the curb level (driveways), 12 cm apart.
    const onRoad = (Math.abs(p.z) <= MAPLE.half + 0.05 && p.x <= ELM.x + ELM.half) || Math.abs(p.x - ELM.x) <= ELM.half + 0.05;
    p = p.clone().setY(onRoad ? 0 : CURB);
    car.group.position.copy(p);
    car.group.rotation.y = yaw;
    car.yaw = yaw;
    car.kin.move(p, yaw);
  }

  // ------------------------------------------------------------------ parked cars + trips
  /** A car parked in a driveway, nose to the garage. drivewayEnd = where the driveway meets the street. */
  park(ownerId, { model, color, at, faceYaw, curb }) {
    const car = this._make(model, color);
    car.owner = ownerId;
    car.state = 'parked';
    car.home = { at: at.clone(), yaw: faceYaw, curb: curb.clone() };
    this._place(car, at, faceYaw);
    this.cars.push(car);
    this.parked.set(ownerId, car);
    return car;
  }

  /**
   * Shoppers' cars in the plaza lot (they never move, so all of them are merged into one mesh
   * per material: a full lot for a handful of draw calls). Nose-in at the wheel stop.
   */
  fillLot(stalls) {
    let seed = 77;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const groups = new Map(); // material -> geometries
    const models = CAR_MODELS.filter((m) => m !== 'Taxi' && m !== 'Cop');
    const tmp = new THREE.Group();
    for (const s of stalls) {
      if (s.reserved || rnd() > 0.42) continue;
      const m = assets.model('autos', models[Math.floor(rnd() * models.length)]);
      const paint = carPaint(new THREE.Color(PAINT[Math.floor(rnd() * PAINT.length)]).getHex());
      m.traverse((o) => {
        if (o.isMesh && o.material.userData?.carPaint) o.material = paint;
      });
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      m.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      const g = new THREE.Group();
      g.add(m);
      const yaw = s.row === 0 ? -Math.PI / 2 : Math.PI / 2;
      // Pulled up close to the wheel stop, a little off-centre like real parking.
      const inset = 2.75 - size.z / 2 - 0.35;
      g.position.set(s.x + (s.row === 0 ? -inset : inset), CURB, s.z + (rnd() - 0.5) * 0.3);
      g.rotation.y = yaw + (rnd() - 0.5) * 0.06;
      tmp.add(g);
      tmp.updateMatrixWorld(true);
      g.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
        // The car files store positions as packed (quantized) integers; moving them in place
        // would clamp every car to a 2 m blob at the origin, so copy into plain floats first.
        const geo = new THREE.BufferGeometry();
        for (const a of ['position', 'normal', 'uv']) {
          const at = src.attributes[a];
          if (!at) continue;
          const arr = new Float32Array(at.count * at.itemSize);
          for (let i = 0; i < at.count; i++) for (let k = 0; k < at.itemSize; k++) arr[i * at.itemSize + k] = at.getComponent(i, k);
          geo.setAttribute(a, new THREE.BufferAttribute(arr, at.itemSize));
        }
        geo.applyMatrix4(o.matrixWorld);
        if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((geo.attributes.position.count) * 2), 2));
        if (!groups.has(o.material)) groups.set(o.material, []);
        groups.get(o.material).push(geo);
      });
      tmp.remove(g);
      this.world.physics.addStaticBox({ x: g.position.x, y: CURB + size.y * 0.45, z: g.position.z }, { x: size.z * 0.95, y: size.y * 0.9, z: size.x * 0.92 }, null);
    }
    for (const [material, geos] of groups) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.world.scene.add(mesh);
    }
  }

  parkedCarOf(ownerId) {
    const c = this.parked.get(ownerId);
    return c && c.state === 'parked' ? c : null;
  }

  /** Owner gets in and drives off: backs out (turning to face east), then away to Elm and north. */
  depart(ownerId) {
    const car = this.parkedCarOf(ownerId);
    if (!car) return false;
    const h = car.home;
    const side = h.curb.z < 0 ? -1 : 1; // which side of Maple the house is on
    // Reverse out in an arc so the car ends up pointing east (yaw = +90 deg).
    car.reverse = [h.at.clone(), V(h.at.x, side * (MAPLE.half + 0.8)), V(h.at.x - 2.6, side * LANE)];
    car.revYaw = [h.yaw, h.yaw, Math.PI / 2];
    car.ri = 1;
    car.path = [V(h.at.x + 6, LANE), V(ELM.x - ELM.half - 2, LANE), V(ELM.x + 0.5, LANE - 2.5), V(ELM.x + LANE, -8), V(ELM.x + LANE, -110)];
    car.i = 0;
    car.state = 'reversing';
    car.cruise = 7.5;
    audio.play?.('car.pass', { position: car.group.position, gain: 0.35, refDistance: 5 });
    return true;
  }

  /** The car comes home (south on Elm, right onto Maple westbound) and parks nose-in. */
  arrive(ownerId, onParked) {
    const car = this.parked.get(ownerId);
    if (!car) return false;
    const h = car.home;
    const side = h.curb.z < 0 ? -1 : 1;
    car.path = [V(ELM.x - LANE, -110), V(ELM.x - LANE, -8), V(ELM.x - ELM.half - 1, -LANE), V(h.at.x + 7, -LANE), V(h.at.x + 1.6, side < 0 ? -LANE - 1.0 : LANE + 0.6), V(h.at.x, h.curb.z), h.at.clone()];
    car.i = 0;
    this._place(car, car.path[0], Math.PI);
    car.state = 'arriving';
    car.cruise = 9;
    car.onParked = onParked;
    car.group.visible = true;
    return true;
  }

  /** Nobody saw it: the car is just gone (owner at work) / back in the driveway. */
  hide(ownerId) {
    const car = this.parked.get(ownerId);
    if (!car || car.state !== 'parked') return;
    this._finish(car);
  }

  restore(ownerId) {
    const car = this.parked.get(ownerId);
    if (!car || car.state === 'parked') return;
    car.state = 'parked';
    car.speed = 0;
    car.group.visible = true;
    this._place(car, car.home.at, car.home.yaw);
  }

  // ------------------------------------------------------------------ through traffic on Elm
  _spawnThrough(dt) {
    const h = clock.hourFloat;
    const rush = (h > 7 && h < 9) || (h > 16 && h < 18.5);
    const night = h < 6 || h > 22;
    const interval = (rush ? 5 : night ? 38 : 11) / Math.max(0.05, settings.get('carCount') ?? 1);
    this._spawnT -= dt;
    if (this._spawnT > 0) return;
    this._spawnT = interval * (0.7 + ((clock.total * 7.3) % 0.6));
    if (this.cars.filter((c) => c.through).length >= 8) return;
    const north = Math.floor(clock.total * 13) % 2 === 0;
    const model = CAR_MODELS[Math.floor(clock.total * 17) % 6];
    const car = this._make(model, PAINT[Math.floor(clock.total * 31) % PAINT.length]);
    car.through = true;
    car.state = 'drive';
    car.cruise = 11 + ((clock.total * 3.1) % 2.5);
    car.path = north ? [V(ELM.x + LANE, 105), V(ELM.x + LANE, -110)] : [V(ELM.x - LANE, -105), V(ELM.x - LANE, 110)];
    car.i = 0;
    this._place(car, car.path[0], north ? Math.PI : 0);
    // Don't spawn on top of another car.
    if (this.cars.some((c) => c !== car && c.group.position.distanceTo(car.group.position) < 9)) {
      this._remove(car);
      return;
    }
    this.cars.push(car);
  }

  // ------------------------------------------------------------------ per frame
  update(dt, { viewer, people }) {
    this._spawnThrough(dt);
    const night = clock.isNight || clock.hourFloat > 19.5 || clock.hourFloat < 6.8;
    this._honkT -= dt;
    for (const car of [...this.cars]) {
      if (car.state === 'parked' || car.state === 'away') continue;
      if (car.state === 'reversing') {
        // Slowly back out of the driveway, checking behind for people.
        const from = car.reverse[car.ri - 1];
        const target = car.reverse[car.ri];
        const d = target.clone().sub(car.group.position).setY(0);
        const blocked = this._blocked(car, viewer, people, d.clone().normalize(), 4);
        const v = blocked ? 0 : 1.8;
        if (d.length() < 0.08) {
          car.ri++;
          if (car.ri >= car.reverse.length) {
            car.state = 'drive';
            car.i = 0;
            car.speed = 2;
          }
          continue;
        }
        const len = d.length();
        const seg = target.distanceTo(from) || 1;
        const k = 1 - len / seg;
        const yaw = car.revYaw[car.ri - 1] + angleDiff(car.revYaw[car.ri - 1], car.revYaw[car.ri]) * Math.max(0, Math.min(1, k));
        this._place(car, car.group.position.clone().addScaledVector(d.normalize(), Math.min(len, v * dt)), yaw);
        continue;
      }
      // Follow the path.
      const tgt = car.path[car.i];
      if (!tgt) {
        this._finish(car);
        continue;
      }
      const to = tgt.clone().sub(car.group.position).setY(0);
      const dist = to.length();
      const ahead = new THREE.Vector3(Math.sin(car.yaw), 0, Math.cos(car.yaw));
      const look = Math.max(5, car.speed * 1.6 + 4);
      const blocked = this._blocked(car, viewer, people, ahead, look);
      const last = car.i === car.path.length - 1;
      let want = blocked ? 0 : car.cruise;
      if (last && car.state === 'arriving') want = Math.min(want, Math.max(0.8, dist * 0.9));
      // Slow down for turns.
      const next = car.path[car.i + 1];
      if (next && dist < 10) {
        const turn = Math.abs(angleDiff(Math.atan2(to.x, to.z), Math.atan2(next.x - tgt.x, next.z - tgt.z)));
        if (turn > 0.5) want = Math.min(want, 4.5);
      }
      car.speed += Math.max(-9 * dt, Math.min(3.2 * dt, want - car.speed));
      if (car.speed < 0) car.speed = 0;
      if (blocked && car.speed < 0.3) {
        car.blockedT += dt;
        // Somebody standing in the road: honk (not too often).
        if (blocked === 'player' && car.blockedT > 2.2 && this._honkT <= 0) {
          this._honkT = 4;
          audio.play?.('car.horn', { position: car.group.position, gain: 0.6, refDistance: 6 });
        }
      } else car.blockedT = 0;
      const step = Math.min(dist, car.speed * dt);
      if (dist > 0.01) {
        // Steer towards the next point and roll forward along the nose (cars don't slide sideways).
        const desired = Math.atan2(to.x, to.z);
        const err = angleDiff(car.yaw, desired);
        const yaw = car.yaw + Math.sign(err) * Math.min(Math.abs(err), dt * (1.2 + car.speed * 0.32));
        const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const pos = car.group.position.clone().addScaledVector(fwd, step);
        // Parking: the last few centimetres go straight to the spot.
        if (last && dist < 0.8) pos.copy(car.group.position).addScaledVector(to.normalize(), step);
        this._place(car, pos, yaw);
        if (dist < 3.5 && Math.abs(err) > 1.3 && !last) car.i++; // can't make that tight turn: next point
      }
      if (dist < Math.max(0.6, car.speed * dt * 1.5)) car.i++;
      for (const l of car.lights) l.material.opacity = night ? (l.material.color.r > 0.9 && l.material.color.g < 0.5 ? 0.9 : 0.95) : 0;
    }
  }

  /** Something in front: you, a person, or a car. Returns 'player' | 'person' | 'car' | false. */
  _blocked(car, viewer, people, dir, range) {
    const p = car.group.position;
    const half = car.size.x / 2 + 0.6;
    const front = car.size.z / 2;
    const test = (q) => {
      const rel = q.clone().sub(p).setY(0);
      const fwd = rel.dot(dir);
      if (fwd < front - 0.3 || fwd > front + range) return false;
      const side = Math.abs(rel.x * dir.z - rel.z * dir.x);
      return side < half;
    };
    if (viewer && Math.abs(viewer.y - p.y) < 2.5 && test(viewer)) return 'player';
    for (const n of people || []) if (!n.away && test(n.pos)) return 'person';
    for (const c of this.cars) if (c !== car && c.state !== 'away' && test(c.group.position)) return 'car';
    return false;
  }

  _finish(car) {
    if (car.through) {
      this._remove(car);
      return;
    }
    if (car.state === 'arriving') {
      car.state = 'parked';
      car.speed = 0;
      this._place(car, car.home.at, car.home.yaw);
      const cb = car.onParked;
      car.onParked = null;
      cb?.();
      return;
    }
    // Drove off: gone until it comes home.
    car.state = 'away';
    car.group.visible = false;
    car.kin.move(new THREE.Vector3(0, -50, 0), 0);
  }

  dispose() {
    for (const c of [...this.cars]) this._remove(c);
  }
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

