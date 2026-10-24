// Elevators: two real cars that run up and down their shafts on a schedule, stop at the floors you can visit, open
// their doors (car doors + landing doors slide), ding, and carry anything inside them (you, bugs, people).
// Tiny you can also ride on the car's roof or drift down the shaft gap.
import * as THREE from 'three';
import { Batch } from './kit.js';
import { SHAFTS, CORE, elev, PLAYABLE } from './tower.js';

const DOOR_W = 0.55, DOOR_H = 2.18;

export class Elevators {
  constructor(zone) {
    this.zone = zone;
    this.cars = [];
    this.landing = [];      // sliding landing doors (playable floors)
    this.stops = [...PLAYABLE].sort((a, b) => b - a); // 48 .. 1
  }
  async build(scene, mats, dyn) {
    const order = this.stops;
    for (let i = 0; i < SHAFTS.length; i++) {
      const S = SHAFTS[i];
      const car = { S, idx: i, y: elev(order[i * 2] || 48), vy: 0, target: null, state: 'doors', doorT: 1, timer: 6 + i * 9, plan: [], dir: -1, at: order[i * 2] || 48, boxes: [], leaves: [], group: new THREE.Group() };
      car.plan = this.makePlan(car.at, i);
      // ----- car body (local space: car floor at y = 0, shaft centre x/z)
      const B = new Batch(mats);
      const cx = (S.x0 + S.x1) / 2, cz = (S.z0 + S.z1) / 2;
      const W = S.x1 - S.x0 - 0.2, D = S.z1 - S.z0 - 0.2, H = 2.6;
      const fz = -D / 2;                    // front (door side, toward the corridor = -z)
      B.box(W, 0.12, D, 'steel', 0, -0.06, 0, 'STRUCT');
      B.box(W - 0.02, 0.012, D - 0.02, 'terrazzo', 0, 0.006, 0, null);
      B.box(W, 0.12, D, 'darkmetal', 0, H + 0.06, 0, 'STRUCT');
      B.box(W - 0.1, 0.01, D - 0.1, 'whitePlastic', 0, H - 0.005, 0, null);
      B.box(1.4, 0.012, 0.5, 'lightPanel', 0, H - 0.012, 0.2, null);
      B.box(W, H, 0.06, 'steel', 0, H / 2, D / 2 - 0.03, 'STRUCT');                         // back wall
      B.box(0.06, H, D, 'steel', -W / 2 + 0.03, H / 2, 0, 'STRUCT'); B.box(0.06, H, D, 'steel', W / 2 - 0.03, H / 2, 0, 'STRUCT');
      const dx = S.door - cx;                                                                // door offset in the car
      const leftW = dx - 0.55 + W / 2, rightW = W / 2 - (dx + 0.55);
      if (leftW > 0.01) B.box(leftW, H, 0.06, 'steel', -W / 2 + leftW / 2, H / 2, fz + 0.03, 'STRUCT');
      if (rightW > 0.01) B.box(rightW, H, 0.06, 'steel', W / 2 - rightW / 2, H / 2, fz + 0.03, 'STRUCT');
      B.box(1.1, H - 2.2, 0.06, 'steel', dx, 2.2 + (H - 2.2) / 2, fz + 0.03, 'STRUCT');
      // handrail, mirror back wall strip, button panel, floor display
      B.box(W - 0.3, 0.04, 0.04, 'chrome', 0, 0.9, D / 2 - 0.09, 'PROP');
      B.box(W - 0.4, 1.2, 0.01, 'chrome', 0, 1.6, D / 2 - 0.065, null);
      B.box(0.18, 0.7, 0.02, 'steel', dx + 0.75, 1.1, fz + 0.07, 'SMALL');
      for (let k = 0; k < 6; k++) B.add(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 14), 'whitePlastic', { p: [dx + 0.75, 0.85 + k * 0.08, fz + 0.085], r: [Math.PI / 2, 0, 0] }, null);
      // roof: crosshead frame + hoist cables up into the dark
      B.box(0.16, 0.4, D + 0.1, 'paintYellow', 0, H + 0.32, 0, 'PROP');
      B.box(W, 0.16, 0.16, 'paintYellow', 0, H + 0.6, 0, 'PROP');
      for (let k = -2; k <= 2; k++) B.add(new THREE.CylinderGeometry(0.006, 0.006, 220, 5), 'darkmetal', { p: [k * 0.05, H + 0.68 + 110, 0] }, null);
      await B.build(car.group, { shadows: true });
      car.group.position.set(cx, car.y, cz);
      scene.add(car.group);
      // display (floor number) above the door inside
      car.disp = makeDisplay();
      car.disp.mesh.position.set(dx, 2.38, fz + 0.065);
      car.group.add(car.disp.mesh);
      // light inside the car (a fixture the light pool can pick)
      car.light = { p: new THREE.Vector3(), color: 0xfff2e0, i: 0.7, r: 5 };
      // colliders (world AABBs, updated as the car moves)
      const local = [
        [-W / 2, -0.12, -D / 2, W / 2, 0, D / 2], [-W / 2, H, -D / 2, W / 2, H + 0.12, D / 2],
        [-W / 2, 0, D / 2 - 0.06, W / 2, H, D / 2], [-W / 2, 0, -D / 2, -W / 2 + 0.06, H, D / 2], [W / 2 - 0.06, 0, -D / 2, W / 2, H, D / 2],
      ];
      if (leftW > 0.01) local.push([-W / 2, 0, fz, -W / 2 + leftW, H, fz + 0.06]);
      if (rightW > 0.01) local.push([W / 2 - rightW, 0, fz, W / 2, H, fz + 0.06]);
      local.push([dx - 0.55, 2.2, fz, dx + 0.55, H, fz + 0.06]);
      for (const L of local) car.boxes.push({ L, b: dyn.add(new THREE.Vector3(), new THREE.Vector3(), { obj: car, tag: 'lift' }) });
      // two car door leaves (slide toward each side)
      const leafMat = await mats.get('steel');
      for (const sd of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, DOOR_H, 0.03), leafMat);
        m.castShadow = true; m.receiveShadow = true;
        car.group.add(m);
        car.leaves.push({ m, sd, x0: dx + sd * DOOR_W / 2, z: fz + 0.1, b: dyn.add(new THREE.Vector3(), new THREE.Vector3(), { obj: car, tag: 'liftdoor', maxSize: 8 }) });
      }
      car.local = { W, D, H, cx, cz, dx, fz };
      this.cars.push(car);
    }
    // landing doors at every playable floor (both shafts)
    const lm = await mats.get('steel');
    for (const S of SHAFTS) for (const n of this.stops) {
      const y0 = elev(n), z = CORE.z0 - 0.02;
      const L = { S, n, y0, open: 0, leaves: [] };
      for (const sd of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.54, DOOR_H, 0.04), lm);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        L.leaves.push({ m, sd, x0: S.door + sd * 0.278, z, b: dyn.add(new THREE.Vector3(), new THREE.Vector3(), { tag: 'landingdoor', maxSize: 8 }) });
      }
      this.landing.push(L);
    }
    this.update(0);
  }
  makePlan(from, i) {
    // ping-pong over every stop; the two cars run out of step
    const s = this.stops, plan = [];
    const down = s.slice(s.indexOf(from) + 1), up = [...s].reverse().slice(1);
    plan.push(...down, ...up);
    return i ? plan.reverse() : plan;
  }
  carAt(p, pad = 0.4) { // the car whose inside volume holds p (air in a car moves with it)
    for (const c of this.cars) {
      const g = c.group.position, L = c.local;
      if (p.x > g.x - L.W / 2 - 0.02 && p.x < g.x + L.W / 2 + 0.02 && p.z > g.z - L.D / 2 - 0.02 && p.z < g.z + L.D / 2 + 0.02 && p.y > g.y - 0.15 && p.y < g.y + L.H + 0.1 + pad) return c;
    }
    return null;
  }
  update(dt) {
    for (const c of this.cars) {
      const prevY = c.y;
      if (c.state === 'doors') {
        c.timer -= dt;
        c.doorT = c.timer > 1.6 ? Math.min(1, c.doorT + dt / 1.4) : Math.max(0, c.doorT - dt / 1.4);
        if (c.timer <= 0 && c.doorT <= 0) {
          if (!c.plan.length) c.plan = this.makePlan(c.at, c.idx === 0 ? 0 : 1);
          c.target = c.plan.shift(); c.state = 'moving';
          this.zone.game.audio && this.zone.game.audio.at && this.zone.game.audio.at('liftStart', c.group.position);
        }
      } else if (c.state === 'moving') {
        const ty = elev(c.target), d = ty - c.y, dist = Math.abs(d);
        const vmax = 7, acc = 1.6;
        const vWant = Math.sign(d) * Math.min(vmax, Math.sqrt(2 * acc * dist));
        c.vy += Math.max(-acc * dt, Math.min(acc * dt, vWant - c.vy));
        c.y += c.vy * dt;
        if (dist < 0.004 || (Math.sign(ty - c.y) !== Math.sign(d) && dist < 0.5)) {
          c.y = ty; c.vy = 0; c.at = c.target; c.state = 'doors'; c.timer = 9;
          this.zone.game.audio && this.zone.game.audio.at && this.zone.game.audio.at('ding', c.group.position);
        }
      }
      c.dy = c.y - prevY;
      c.group.position.y = c.y;
      const g = c.group.position;
      for (const { L, b } of c.boxes) { b.min.set(g.x + L[0], g.y + L[1], g.z + L[2]); b.max.set(g.x + L[3], g.y + L[4], g.z + L[5]); }
      for (const lf of c.leaves) {
        const x = lf.x0 + lf.sd * c.doorT * (DOOR_W - 0.04);
        lf.m.position.set(x, DOOR_H / 2 + 0.005, lf.z);
        lf.b.min.set(g.x + x - DOOR_W / 2, g.y, g.z + lf.z - 0.015); lf.b.max.set(g.x + x + DOOR_W / 2, g.y + DOOR_H - 0.01, g.z + lf.z + 0.015);
      }
      c.light.p.set(g.x, g.y + 2.5, g.z);
      c.disp.set(c.state === 'moving' ? floorAtY(c.y) : c.at, c.state === 'moving' ? Math.sign(c.vy) : 0);
    }
    for (const L of this.landing) {
      const c = this.cars.find(cc => cc.S === L.S);
      const want = c && c.state === 'doors' && c.at === L.n ? c.doorT : 0;
      L.open = want;
      for (const lf of L.leaves) {
        const x = lf.x0 + lf.sd * L.open * 0.5;
        lf.m.position.set(x, L.y0 + 0.012 + DOOR_H / 2, lf.z);
        lf.b.min.set(x - 0.27, L.y0 + 0.012, lf.z - 0.02); lf.b.max.set(x + 0.27, L.y0 + 0.012 + DOOR_H, lf.z + 0.02);
      }
    }
  }
}

function floorAtY(y) { if (y < 8.4 - 2) return 1; return Math.max(2, Math.min(48, Math.round(y / 4.2))); }

// orange dot-matrix floor display inside the car
function makeDisplay() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: true });
  mat.color.setScalar(2.2);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.13), mat);

  let last = '';
  return {
    mesh,
    set(n, dir) {
      const key = n + ':' + dir; if (key === last) return; last = key;
      g.fillStyle = '#0a0503'; g.fillRect(0, 0, 128, 64);
      g.fillStyle = '#ff7a1a'; g.font = 'bold 44px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(n === 1 ? 'L' : String(n), 76, 34);
      if (dir) { g.beginPath(); const y = dir > 0 ? 20 : 44; g.moveTo(22, y + (dir > 0 ? 12 : -12)); g.lineTo(34, y); g.lineTo(10, y); g.fill(); }
      tex.needsUpdate = true;
    },
  };
}
