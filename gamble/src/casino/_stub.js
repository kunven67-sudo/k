// Placeholder station used until the tables / slots lanes land their real builders.
// Same signature and return shape as the real factories (see CONTRACT.md).
import * as THREE from 'three';
import { Station } from './station.js';

export function stubStation({ engine, physics, id, casino = 'eldorado', position, yaw = 0, w = 2, d = 1.2, h = 0.9, color = 0x2a5a3a, seats = 1 }) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = yaw;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  box.position.set(0, h / 2, -0.2);
  box.castShadow = box.receiveShadow = true;
  group.add(box);
  group.updateWorldMatrix(true, true);
  physics?.addStaticBox?.(box);
  const list = [];
  for (let i = 0; i < seats; i++) {
    const x = seats > 1 ? (i / (seats - 1) - 0.5) * (w - 0.6) : 0;
    list.push({ pos: new THREE.Vector3(x, 0, d / 2 + 0.35), yaw: Math.PI, height: 0.68, cam: { pos: new THREE.Vector3(x, 1.5, d / 2 + 0.9), target: new THREE.Vector3(x, 0.8, -0.2) } });
  }
  const st = new Station({ engine, id, casino, group, seats: list });
  st.footprint = { w, d: d + 1.2 };
  return st;
}
