// Slot machines (lane C). STUB — replaced by the slots lane (see ../CONTRACT.md).
import * as THREE from 'three';
import { stubStation } from '../_stub.js';

export function createSlotBank({ count = 6, position, yaw = 0, id = 'bank', ...opts }) {
  const group = new THREE.Group();
  const machines = [];
  const pitch = 0.78;
  for (let i = 0; i < count; i++) {
    const off = new THREE.Vector3((i - (count - 1) / 2) * pitch, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const m = stubStation({ ...opts, id: `${id}-${i}`, position: position.clone().add(off), yaw, w: 0.72, d: 0.8, h: 1.8, color: 0x3a2a5a, seats: 1 });
    m.seatNpc = () => {};
    m.unseatNpc = () => {};
    machines.push(m);
    group.add(m.group);
  }
  return {
    group,
    machines,
    interactables: machines.flatMap((m) => m.interactables),
    update: (dt, ctx) => machines.forEach((m) => m.update(dt, ctx)),
    dispose: () => machines.forEach((m) => m.dispose()),
    footprint: { w: count * pitch, d: 2.0 },
  };
}
