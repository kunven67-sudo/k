// Many copies of one model (trees, bushes, fence posts) drawn with InstancedMesh: one draw call
// per sub-mesh no matter how many copies.
//
//   placeInstances(parent, kit, name, [{ x, y, z, rotY, scale }])

import * as THREE from 'three';
import { assets } from '../gfx/assets.js';
import { floatGeometry } from './builder.js';

const _m = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export function placeInstances(parent, kit, name, list, { shadow = true, receive = true } = {}) {
  if (!list.length) return [];
  const proto = assets.model(kit, name);
  proto.updateMatrixWorld(true);
  const meshes = [];
  proto.traverse((o) => {
    if (!o.isMesh) return;
    _local.copy(o.matrixWorld); // includes the kit scale
    const geo = floatGeometry(o.geometry, !!o.material.map).applyMatrix4(_local);
    geo.computeBoundingSphere();
    const im = new THREE.InstancedMesh(geo, o.material, list.length);
    im.castShadow = shadow;
    im.receiveShadow = receive;
    list.forEach((t, i) => {
      _q.setFromAxisAngle(UP, t.rotY || 0);
      _s.setScalar(t.scale || 1);
      _m.compose(_v.set(t.x, t.y || 0, t.z), _q, _s);
      im.setMatrixAt(i, _m);
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    parent.add(im);
    meshes.push(im);
  });
  return meshes;
}
