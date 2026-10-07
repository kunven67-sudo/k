// Coins pouring out of the machine's chute into the tray (fake jackpot / cash-out). Simple
// ballistic + bounce simulation on one InstancedMesh — no physics world needed for a payout.

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { DIM } from './machine.js';

export function createCoinShower(scene, { count = 36, origin, trayY = 1.03 }) {
  const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.012, 18);
  const mesh = new THREE.InstancedMesh(geo, mat('gold'), count);
  mesh.castShadow = true;
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const coins = Array.from({ length: count }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(), life: 0, rest: false }));
  const m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const dq = new THREE.Quaternion();
  const trayZ = [DIM.faceZ + 0.0, DIM.faceZ + 0.34];
  let next = 0;
  let pending = 0;
  let timer = 0;

  function spawn() {
    const c = coins[next];
    next = (next + 1) % count;
    c.p.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, 0));
    c.v.set((Math.random() - 0.5) * 1.2, -0.3 - Math.random() * 0.4, 0.9 + Math.random() * 0.9);
    c.q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    c.w.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22);
    c.life = 6;
    c.rest = false;
    mesh.count = Math.min(count, Math.max(mesh.count, next === 0 ? count : next));
  }

  return {
    /** Pour `n` coins (default: all) over the next second or so. */
    burst(n = count) {
      pending += n;
    },
    update(dt) {
      if (pending > 0) {
        timer -= dt;
        while (timer <= 0 && pending > 0) {
          spawn();
          pending--;
          timer += 0.035;
        }
      }
      if (!mesh.count) return;
      for (let i = 0; i < mesh.count; i++) {
        const c = coins[i];
        if (c.life <= 0) {
          m.makeScale(0, 0, 0);
          mesh.setMatrixAt(i, m);
          continue;
        }
        c.life -= dt;
        if (!c.rest) {
          c.v.y -= 9.8 * dt;
          c.p.addScaledVector(c.v, dt);
          // Inside the tray footprint the floor is the tray; outside it's the carpet.
          const inTray = Math.abs(c.p.x) < 0.47 && c.p.z > trayZ[0] && c.p.z < trayZ[1];
          if (inTray && c.p.z > trayZ[1] - 0.03) {
            c.p.z = trayZ[1] - 0.03;
            c.v.z *= -0.4; // tray lip
          }
          const floor = inTray ? trayY : 0.006;
          if (c.p.y < floor) {
            c.p.y = floor;
            if (Math.abs(c.v.y) < 0.6) {
              c.rest = true;
              // Settle flat with a random spin around the vertical.
              c.q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0));
            } else {
              c.v.y *= -0.35;
              c.v.x *= 0.6;
              c.v.z *= 0.6;
              c.w.multiplyScalar(0.5);
            }
          }
          dq.setFromEuler(new THREE.Euler(c.w.x * dt, c.w.y * dt, c.w.z * dt));
          if (!c.rest) c.q.multiply(dq);
        }
        const s = Math.min(1, c.life * 2); // shrink away at end of life
        m.compose(c.p, c.q, one.set(s, s, s));
        one.set(1, 1, 1);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mesh.removeFromParent();
    },
  };
}
