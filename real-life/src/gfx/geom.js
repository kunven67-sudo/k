// Geometry helpers that keep textures at real-world scale and add the small bevels that stop
// things looking like untextured blocks.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _n = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * Box-project UVs in (object or provided) space so one texture tile = `tileMeters` meters.
 * Each vertex picks the plane facing its normal's dominant axis — works for walls, floors,
 * boxes and most architecture without per-mesh repeat settings.
 */
export function worldUV(geometry, tileMeters = 1, matrix = null) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nor = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const normalMatrix = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    if (matrix) {
      _p.applyMatrix4(matrix);
      _n.applyMatrix3(normalMatrix).normalize();
    }
    const ax = Math.abs(_n.x);
    const ay = Math.abs(_n.y);
    const az = Math.abs(_n.z);
    let u;
    let v;
    if (ay >= ax && ay >= az) {
      u = _p.x;
      v = _p.z;
    } else if (ax >= az) {
      u = _p.z * Math.sign(_n.x || 1);
      v = _p.y;
    } else {
      u = -_p.x * Math.sign(_n.z || 1);
      v = _p.y;
    }
    uv[i * 2] = u / tileMeters;
    uv[i * 2 + 1] = v / tileMeters;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

// A mesh whose UVs match its material's real-world tile size.
export function meshWithWorldUV(geometry, material, { castShadow = true, receiveShadow = true } = {}) {
  worldUV(geometry, material.userData?.tileMeters ?? 1);
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = castShadow;
  m.receiveShadow = receiveShadow;
  return m;
}

// Box with a small bevel (real objects never have perfectly sharp edges).
export function bevelBox(w, h, d, material, { radius = 0.01, segments = 2, ...shadow } = {}) {
  const r = Math.min(radius, w / 2.01, h / 2.01, d / 2.01);
  const g = r > 0.0005 ? new RoundedBoxGeometry(w, h, d, segments, r) : new THREE.BoxGeometry(w, h, d);
  return meshWithWorldUV(g, material, shadow);
}

// Merge many static meshes that share a material into one draw call (keeps world fast).
export function mergeStatic(meshes, material) {
  const geos = meshes.map((m) => {
    m.updateWorldMatrix(true, false);
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    return g;
  });
  const merged = mergeGeometries(geos, false);
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export { mergeGeometries, mergeVertices };
