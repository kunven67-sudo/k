// Merge a model's meshes by material: one draw call per material instead of one per part.
// A sofa built from 15 boxes becomes 2-3 draws; a bookshelf with 200 books becomes ~10.
// Meshes with a name (e.g. 'screen', which later shows TV content) and instanced meshes stay separate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _inv = new THREE.Matrix4();
const _m = new THREE.Matrix4();

export function mergeByMaterial(root, { keepNamed = true } = {}) {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const groups = new Map(); // material -> { geos, cast, receive }
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (keepNamed && o.name) return;
    _m.multiplyMatrices(_inv, o.matrixWorld);
    let g = o.geometry.clone();
    g.applyMatrix4(_m);
    if (g.index) g = g.toNonIndexed();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    // Mirrored transforms (negative scale) flip winding; fix it so faces don't turn inside out.
    if (_m.determinant() < 0) {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i += 3) {
        for (const a of [p, n, u]) {
          const s = a.itemSize;
          for (let c = 0; c < s; c++) {
            const t = a.array[(i + 1) * s + c];
            a.array[(i + 1) * s + c] = a.array[(i + 2) * s + c];
            a.array[(i + 2) * s + c] = t;
          }
        }
      }
    }
    const key = o.material;
    if (!groups.has(key)) groups.set(key, { geos: [], cast: false, receive: false });
    const e = groups.get(key);
    e.geos.push(g);
    e.cast = e.cast || o.castShadow;
    e.receive = e.receive || o.receiveShadow;
    remove.push(o);
  });
  for (const o of remove) o.removeFromParent();
  for (const [mat, e] of groups) {
    const merged = mergeGeometries(e.geos, false);
    for (const g of e.geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = e.cast;
    mesh.receiveShadow = e.receive;
    root.add(mesh);
  }
  // Drop empty groups left behind.
  const empties = [];
  root.traverse((o) => {
    if (o !== root && o.isGroup && o.children.length === 0) empties.push(o);
  });
  for (const o of empties) o.removeFromParent();
  return root;
}
