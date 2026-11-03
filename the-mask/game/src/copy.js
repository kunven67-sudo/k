// THE MASK - a copy of you: hooded body (KayKit Rogue_Hooded, CC0) + your mask on its face + your gloves.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { toonify, ghostify } from './toon.js';
import { buildMask } from './mask.js';

const HIDE = /Knife|Crossbow|Throwable|Sword|Shield|Axe|Staff|Wand|Spellbook|Mug/i;
let base = null;
export async function loadCopyBase(url) {
  if (base) return base;
  const gl = await new GLTFLoader().loadAsync(url);
  base = { scene: gl.scene, clips: gl.animations };
  return base;
}

// face box of the hooded head, measured once in the rest pose (model units)
function faceAnchor(root) {
  root.updateMatrixWorld(true);
  let head = null; root.traverse((o) => { if (o.isBone && o.name === 'head') head = o; });
  const headMesh = root.getObjectByName('Rogue_Head_Hooded');
  const box = new THREE.Box3().setFromObject(headMesh || head);
  return { head, box };
}

export function makeCopy(color, { scale = 0.78 } = {}) {
  const root = SkeletonUtils.clone(base.scene);
  root.traverse((o) => { if (HIDE.test(o.name)) o.visible = false; });
  toonify(root);
  if (color !== null) ghostify(root, color);
  root.scale.setScalar(scale);

  // mask on the face: placed in the rest pose, then parented to the head bone so it follows every move
  const { head, box } = faceAnchor(root);
  const size = new THREE.Vector3(), center = new THREE.Vector3(); box.getSize(size); box.getCenter(center);
  const mask = buildMask();
  const faceW = size.x * 0.56;
  mask.scale.setScalar(faceW / 0.172);
  const target = new THREE.Matrix4().compose(
    new THREE.Vector3(center.x, center.y - size.y * 0.06, box.max.z - size.z * 0.06),
    root.getWorldQuaternion(new THREE.Quaternion()),
    new THREE.Vector3().setScalar(faceW / 0.172)
  );
  const local = new THREE.Matrix4().copy(head.matrixWorld).invert().multiply(target);
  local.decompose(mask.position, mask.quaternion, mask.scale);
  head.add(mask);
  if (color !== null) {
    mask.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(color).multiplyScalar(0.12); } });
  }

  const mixer = new THREE.AnimationMixer(root);
  const play = (name, time = 0, loop = true) => {
    const clip = base.clips.find((c) => c.name === name);
    if (!clip) return null;
    mixer.stopAllAction();
    const a = mixer.clipAction(clip); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true;
    a.play(); a.time = time; mixer.update(0);
    return a;
  };
  root.userData = { mixer, play, mask };
  return root;
}
