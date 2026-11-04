// THE MASK - how a glove and a held gadget sit in a "hand frame" (the VR controller's grip, or the PC view hand).
// Same numbers for you and for your copies, so a copy holds things exactly like you did.
import * as THREE from 'three';
export { buildModel as buildGadgetModel, GADGET_IDS } from './gadgets.js';

// glove: fingers forward (-Z), palm facing in, back of the hand facing out. side 0 = left, 1 = right
export function mountGlove(glove, side, scale = 1) {
  glove.position.set(0, -0.012, 0.05).multiplyScalar(scale);
  glove.rotation.set(-0.15, 0, side ? -Math.PI / 2 : Math.PI / 2);
  glove.scale.setScalar(scale);
  return glove;
}
// gadget: handle down through the fist, barrel forward
const GP = [new THREE.Vector3(0.03, 0.025, -0.012), new THREE.Vector3(-0.03, 0.025, -0.012)];
export function mountGadget(m, side, scale = 1) {
  m.position.copy(GP[side]).multiplyScalar(scale);
  m.rotation.set(-0.15, 0, 0);
  m.scale.setScalar(scale);
  return m;
}
export function gadgetMountMatrix(side, out = new THREE.Matrix4()) {
  return out.compose(GP[side], new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, 0)), new THREE.Vector3(1, 1, 1));
}
