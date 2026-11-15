// Use animations made for one skeleton on another skeleton with the same bone names
// (Mixamo humans, or the WildMesh animals). Only the top bone (hips/pelvis) needs converting,
// because its parent (the armature) can be rotated/scaled differently in each file.
import * as THREE from 'three';

const base = n => n.replace(/^mixamorig\d*:?/, 'mixamorig:').replace(/_\d+$/, '');

export function boneMap(root) {
  const m = {};
  root.traverse(o => { if (o.isBone || o.type === 'Bone' || o.isObject3D) { const k = base(o.name); if (!(k in m)) m[k] = o; } });
  return m;
}

// srcRoot/dstRoot: scenes in rest pose. topName: base name of the moving top bone ('mixamorig:Hips', 'Pelvis').
export function retargetClips(clips, srcRoot, dstRoot, topName, { keepPos = true, inPlace = true } = {}) {
  srcRoot.updateMatrixWorld(true); dstRoot.updateMatrixWorld(true);
  const S = boneMap(srcRoot), D = boneMap(dstRoot);
  const sTop = S[topName], dTop = D[topName];
  if (!sTop || !dTop) return [];
  const Ps = sTop.parent.getWorldQuaternion(new THREE.Quaternion()), Pd = dTop.parent.getWorldQuaternion(new THREE.Quaternion());
  const C = Pd.clone().invert().multiply(Ps);
  const sMat = sTop.parent.matrixWorld.clone(), dInv = dTop.parent.matrixWorld.clone().invert();
  const sY = sTop.getWorldPosition(new THREE.Vector3()).y - srcRoot.getWorldPosition(new THREE.Vector3()).y;
  const dY = dTop.getWorldPosition(new THREE.Vector3()).y - dstRoot.getWorldPosition(new THREE.Vector3()).y;
  const k = Math.abs(sY) > 1e-6 ? dY / sY : 1;
  const out = [];
  for (const clip of clips) {
    const tracks = [];
    for (const t of clip.tracks) {
      const dot = t.name.lastIndexOf('.'); const bn = base(t.name.slice(0, dot)), prop = t.name.slice(dot + 1);
      const dst = D[bn]; if (!dst) continue;
      if (bn === topName && prop === 'quaternion') {
        const v = t.values.slice(), q = new THREE.Quaternion();
        for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i).premultiply(C).toArray(v, i); }
        tracks.push(new THREE.QuaternionKeyframeTrack(dst.name + '.quaternion', t.times, v));
      } else if (bn === topName && prop === 'position') {
        if (!keepPos) continue;
        const v = t.values.slice(), p = new THREE.Vector3(), first = new THREE.Vector3();
        for (let i = 0; i < v.length; i += 3) {
          p.fromArray(v, i).applyMatrix4(sMat); // world
          if (i === 0) first.copy(p);
          if (inPlace) { p.x = first.x; p.z = first.z; }
          p.y = (p.y - srcRoot.position.y) * k + dstRoot.position.y; p.x *= k; p.z *= k;
          p.applyMatrix4(dInv).toArray(v, i);
        }
        tracks.push(new THREE.VectorKeyframeTrack(dst.name + '.position', t.times, v));
      } else if (prop === 'quaternion') {
        tracks.push(new THREE.QuaternionKeyframeTrack(dst.name + '.quaternion', t.times, t.values));
      }
    }
    out.push(new THREE.AnimationClip(clip.name, clip.duration, tracks));
  }
  return out;
}

// stop a clip from walking the model away (top bone drifting in world X/Z)
export function pinRoot(clip, root) {
  root.updateMatrixWorld(true);
  let best = null, bestDepth = 99;
  for (const t of clip.tracks) {
    if (!t.name.endsWith('.position')) continue;
    const o = root.getObjectByName(t.name.slice(0, t.name.lastIndexOf('.'))); if (!o) continue;
    let d = 0; for (let p = o.parent; p; p = p.parent) d++;
    if (d < bestDepth) { bestDepth = d; best = [t, o]; }
  }
  if (!best) return clip;
  const [t, o] = best, M = o.parent.matrixWorld, inv = M.clone().invert(), v = t.values, p = new THREE.Vector3(), f = new THREE.Vector3();
  for (let i = 0; i < v.length; i += 3) {
    p.fromArray(v, i).applyMatrix4(M); if (i === 0) f.copy(p);
    p.x = f.x; p.z = f.z; p.applyMatrix4(inv).toArray(v, i);
  }
  return clip;
}
