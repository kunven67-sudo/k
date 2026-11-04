// THE MASK - KayKit characters (CC0). Each body is merged into ONE skinned mesh (arms, legs, head, hat, cape and the
// weapon it holds) so a room full of people stays cheap to draw on a Quest. All five share one skeleton, so they all
// play the animations stored in hooded.glb.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './toon.js';

const KEEP = {
  hooded: ['Rogue_Cape'], knight: ['1H_Sword', 'Round_Shield', 'Knight_Helmet', 'Knight_Cape'], barbarian: ['1H_Axe', 'Barbarian_Hat', 'Barbarian_Cape'],
  mage: ['2H_Staff', 'Mage_Hat', 'Mage_Cape'], rogue: ['Knife', 'Knife_Offhand', 'Rogue_Cape']
};
export const CHARS = {};
export let CLIPS = [];
export const TYPES = ['knight', 'barbarian', 'mage', 'rogue'];

export async function loadChars(base, loader) {
  const names = ['hooded', ...TYPES];
  const gls = await Promise.all(names.map((n) => loader.loadAsync(base + 'assets/people/' + n + '.glb')));
  gls.forEach((gl, i) => { CHARS[names[i]] = mergeChar(gl.scene, KEEP[names[i]]); });
  CLIPS = gls[0].animations;
}

function prep(g) { // one attribute layout for every part so they can be merged
  const n = g.attributes.position.count, out = new THREE.BufferGeometry();
  const f32 = (a, size) => { const arr = new Float32Array(n * size); for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) arr[i * size + k] = a ? a.getComponent(i, k) : 0; return new THREE.BufferAttribute(arr, size); };
  out.setAttribute('position', f32(g.attributes.position, 3));
  out.setAttribute('normal', f32(g.attributes.normal, 3));
  out.setAttribute('uv', f32(g.attributes.uv, 2));
  const si = new Uint16Array(n * 4); const a = g.attributes.skinIndex;
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) si[i * 4 + k] = a ? a.getComponent(i, k) : 0;
  out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  out.setAttribute('skinWeight', f32(g.attributes.skinWeight, 4));
  const idx = g.index ? Array.from(g.index.array) : [...Array(n).keys()];
  out.setIndex(idx);
  return out;
}

function mergeChar(scene, keep) {
  const skinned = [], statics = [];
  scene.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); else if (o.isMesh) statics.push(o); });
  const base = skinned[0], skel = base.skeleton;
  skel.pose(); scene.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(base.matrixWorld).invert();
  const geos = [];
  for (const m of skinned) {
    if (!/Arm|Body|Head|Leg/.test(m.name) && !keep.some((k) => m.name.startsWith(k))) continue;
    const g = prep(m.geometry);
    // remap this mesh's joint list onto the base skeleton (same bones, maybe different order)
    if (m.skeleton !== skel) {
      const map = m.skeleton.bones.map((b) => skel.bones.indexOf(b));
      const si = g.attributes.skinIndex.array; for (let i = 0; i < si.length; i++) si[i] = Math.max(0, map[si[i]]);
    }
    geos.push(g);
  }
  for (const m of statics) {
    if (!keep.includes(m.name)) continue;
    let bone = m.parent; while (bone && !bone.isBone) bone = bone.parent;
    const bi = Math.max(0, skel.bones.indexOf(bone));
    const g = prep(m.geometry);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, m.matrixWorld));
    const si = g.attributes.skinIndex.array, sw = g.attributes.skinWeight.array;
    for (let i = 0; i < si.length; i += 4) { si[i] = bi; si[i + 1] = si[i + 2] = si[i + 3] = 0; sw[i] = 1; sw[i + 1] = sw[i + 2] = sw[i + 3] = 0; }
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  const mat = toon({ map: base.material.map });
  const mesh = new THREE.SkinnedMesh(merged, mat);
  mesh.name = 'body'; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  base.parent.add(mesh);
  mesh.bind(skel, base.bindMatrix);
  for (const m of [...skinned, ...statics]) if (m.parent) m.parent.remove(m);
  return scene;
}

// a new body of that type, plus its animation player
export function makeBody(type) {
  const root = SkeletonUtils.clone(CHARS[type]);
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const mesh = root.getObjectByName('body');
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  const act = (name) => {
    if (actions[name]) return actions[name];
    const clip = CLIPS.find((c) => c.name === name); if (!clip) return null;
    return (actions[name] = mixer.clipAction(clip));
  };
  let cur = null;
  // switch to an animation with a short blend
  const play = (name, { fade = 0.18, loop = true, speed = 1, restart = false } = {}) => {
    const a = act(name); if (!a) return null;
    if (cur === a && !restart) { a.timeScale = speed; return a; }
    a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.timeScale = speed;
    a.enabled = true; a.setEffectiveWeight(1);
    if (cur && fade > 0) { a.play(); cur.crossFadeTo(a, fade, false); } else { mixer.stopAllAction(); a.play(); }
    cur = a;
    return a;
  };
  return { root, bones, mesh, mixer, act, play, current: () => cur };
}
