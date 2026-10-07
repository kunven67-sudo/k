// Chasing marquee bulbs: one InstancedMesh of small glass bulbs (+ one for their chrome sockets),
// colors driven per instance in HDR so lit bulbs bloom. Patterns: 'chase', 'alternate',
// 'sparkle', 'all', 'off'. Respects the reduceFlashing setting (slower, softer).

import * as THREE from 'three';
import { settings } from '../../core/settings.js';
import { mat } from '../../gfx/materials.js';

const WARM = new THREE.Color(2.6, 1.55, 0.6);
const DIM = new THREE.Color(0.09, 0.05, 0.025);

/**
 * @param points  array of THREE.Vector3 (bulb centers)
 * @param normal  direction the bulbs face (for socket orientation)
 */
export function createBulbs(points, { radius = 0.06, normal = new THREE.Vector3(0, 0, 1), color = WARM } = {}) {
  const n = points.length;
  const group = new THREE.Group();
  const bulbGeo = new THREE.SphereGeometry(radius, 10, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, n);
  const sockGeo = new THREE.CylinderGeometry(radius * 1.35, radius * 1.5, radius * 0.9, 12);
  sockGeo.rotateX(Math.PI / 2);
  const socks = new THREE.InstancedMesh(sockGeo, mat('chrome'), n);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  const m = new THREE.Matrix4();
  const off = normal.clone().normalize().multiplyScalar(radius * 0.6);
  points.forEach((p, i) => {
    m.compose(p.clone().add(off), q, new THREE.Vector3(1, 1, 1));
    bulbs.setMatrixAt(i, m);
    m.compose(p, q, new THREE.Vector3(1, 1, 1));
    socks.setMatrixAt(i, m);
    bulbs.setColorAt(i, DIM);
  });
  group.add(socks, bulbs);

  let pattern = 'chase';
  let speed = 10;
  const c = new THREE.Color();
  const lit = color.clone();
  return {
    group,
    count: n,
    setPattern(p, s = speed) {
      pattern = p;
      speed = s;
    },
    setColor(col) {
      lit.copy(col);
    },
    update(time) {
      const calm = settings.get('reduceFlashing');
      const t = time * (calm ? speed * 0.35 : speed);
      for (let i = 0; i < n; i++) {
        let v;
        if (pattern === 'chase') v = (Math.floor(t) - i) % 3 === 0 ? 1 : 0.12;
        else if (pattern === 'alternate') v = (Math.floor(t) + i) % 2 ? 1 : 0.1;
        else if (pattern === 'sparkle') v = Math.sin(i * 12.9898 + Math.floor(t) * 78.233) > 0.2 ? 1 : 0.15;
        else if (pattern === 'all') v = 0.85 + 0.15 * Math.sin(time * 3 + i);
        else v = 0.05;
        if (calm) v = 0.35 + v * 0.5;
        c.copy(DIM).lerp(lit, v);
        bulbs.setColorAt(i, c);
      }
      bulbs.instanceColor.needsUpdate = true;
    },
    dispose() {
      bulbGeo.dispose();
      sockGeo.dispose();
      bulbMat.dispose();
    },
  };
}

/** Evenly spaced points around a rounded rectangle (x/y plane, centered at cx, cy). */
export function rectPoints(cx, cy, w, h, spacing, z = 0) {
  const pts = [];
  const per = 2 * (w + h);
  const n = Math.max(4, Math.round(per / spacing));
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per;
    let x;
    let y;
    if (d < w) [x, y] = [-w / 2 + d, h / 2];
    else if ((d -= w) < h) [x, y] = [w / 2, h / 2 - d];
    else if ((d -= h) < w) [x, y] = [w / 2 - d, -h / 2];
    else [x, y] = [-w / 2, -h / 2 + (d - w)];
    pts.push(new THREE.Vector3(cx + x, cy + y, z));
  }
  return pts;
}
