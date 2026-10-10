// Padded swivel slot stool: puffy round cushion with a low wrap-around back rest, chrome seat pan
// and gas column, a foot ring on three spokes and a weighted dark base. Built once and instanced
// per bank (three draw calls for any number of stools).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { normalizeGeo, matrixOf } from './parts.js';

export const STOOL = { seatTop: 0.69, radius: 0.21 };

let cache = null;

export function stoolGeometries(tier = 'high') {
  if (cache) return cache;
  const seg = tier === 'low' ? 14 : 24;
  // cushion: lathe of a puffy profile (radius, y)
  const prof = [];
  const R = STOOL.radius;
  prof.push(new THREE.Vector2(0, 0.6));
  prof.push(new THREE.Vector2(R - 0.02, 0.6));
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    prof.push(new THREE.Vector2(R - 0.035 + Math.cos(a) * 0.045, 0.645 + Math.sin(a) * 0.045));
  }
  prof.push(new THREE.Vector2(R - 0.05, 0.692));
  prof.push(new THREE.Vector2(0.08, 0.7));
  prof.push(new THREE.Vector2(0, 0.701));
  const cushion = new THREE.LatheGeometry(prof, seg);
  // back rest: a padded arc behind the seat (+Z side = away from the machine)
  const back = new THREE.TorusGeometry(R - 0.01, 0.032, 8, seg, Math.PI * 0.85);
  back.scale(1, 1, 2.4);
  back.rotateX(Math.PI / 2);
  back.rotateY(-Math.PI / 2 - Math.PI * 0.425);
  back.translate(0, 0.79, 0.0);
  const backGeo = new THREE.BoxGeometry(0.03, 0.12, 0.03);
  void backGeo;
  const cushionGeo = mergeGeometries([normalizeGeo(cushion), normalizeGeo(back)], false);

  const chromeParts = [];
  const add = (g, m) => {
    const n = normalizeGeo(g);
    n.applyMatrix4(m);
    chromeParts.push(n);
  };
  add(new THREE.CylinderGeometry(R - 0.03, R - 0.06, 0.02, seg), matrixOf(0, 0.59, 0)); // seat pan
  add(new THREE.CylinderGeometry(0.032, 0.032, 0.5, 14), matrixOf(0, 0.33, 0)); // column
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14), matrixOf(0, 0.5, 0)); // gas sleeve
  add(new THREE.TorusGeometry(0.2, 0.011, 8, seg), matrixOf(0, 0.27, 0, Math.PI / 2, 0, 0)); // foot ring
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.17, 6), matrixOf(Math.cos(a) * 0.11, 0.27, Math.sin(a) * 0.11, 0, -a, Math.PI / 2));
  }
  // back-rest posts
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.01, 0.01, 0.13, 8), matrixOf(s * 0.14, 0.715, 0.13, -0.18, 0, 0));
  const chrome = mergeGeometries(chromeParts, false);

  const base = new THREE.CylinderGeometry(0.2, 0.25, 0.04, seg);
  base.translate(0, 0.02, 0);
  const dark = mergeGeometries([normalizeGeo(base), normalizeGeo(new THREE.CylinderGeometry(0.07, 0.11, 0.05, seg).translate(0, 0.06, 0))], false);
  cache = { cushion: cushionGeo, chrome, dark };
  return cache;
}
