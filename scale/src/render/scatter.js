// Micro scatter: real 3D detail that only exists near you when you're small enough to see it
// (master list Rule 3): carpet tufts, dust, hairs, crumbs of dirt, grass blades.
//
// Surfaces register rectangles with a kind ('carpet', 'woodfloor', 'tile', 'lawn'...). Each layer
// knows which kinds it grows on, how dense it really is, and how big each piece really is. Around the
// player we fill grid cells deterministically (same spot = same fibers every time, Rule 1), capped by
// the quality tier's budget. Pieces fade out by shrinking when you're too big to notice them.
import * as THREE from 'three';
import { hash3, clamp } from '../core/util.js';
import { std } from './materials.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// --- geometries (unit size, origin at the base) --------------------------------------------------
function tuftGeometry() {
  // A carpet tuft: a twisted bundle of yarn standing up, 1 unit tall, ~0.12 units wide.
  const geos = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const g = new THREE.CylinderGeometry(0.014, 0.03, 1, 4, 3, true);
    g.translate(0, 0.5, 0);
    const pos = g.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      const twist = y * 1.4 + a;
      const r = 0.035 + y * 0.02;
      pos.setX(v, pos.getX(v) + Math.cos(twist) * r + y * y * 0.08 * Math.cos(a));
      pos.setZ(v, pos.getZ(v) + Math.sin(twist) * r + y * y * 0.08 * Math.sin(a));
    }
    geos.push(g);
  }
  return merge(geos);
}

function bladeGeometry() {
  // A grass blade: tapered, curved strip (two-sided), 1 unit tall.
  const g = new THREE.PlaneGeometry(0.06, 1, 1, 6);
  g.translate(0, 0.5, 0);
  const pos = g.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const y = pos.getY(v);
    pos.setX(v, pos.getX(v) * (1 - y * 0.9));
    pos.setZ(v, y * y * 0.25);
  }
  g.computeVertexNormals();
  return g;
}

function hairGeometry() {
  // A loose hair: a thin wavy tube lying on the floor, 1 unit long.
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(i / 12 - 0.5, 0.006 + Math.sin(i * 0.9) * 0.004, Math.sin(i * 0.55) * 0.08));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.004, 4, false);
}

function lumpGeometry(detail = 1) {
  const g = new THREE.IcosahedronGeometry(0.5, detail);
  const pos = g.attributes.position;
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    const n = 1 + Math.sin(x * 9.1 + y * 3.7) * 0.18 + Math.cos(z * 8.3 - x * 2.1) * 0.14;
    pos.setXYZ(v, x * n, y * n * 0.55 + 0.22, z * n);
  }
  g.computeVertexNormals();
  return g;
}

// Vertex color = ambient occlusion by height: deep in a pile or a lawn it's much darker.
function heightAO(g, min = 0.25, power = 0.8) {
  const pos = g.attributes.position;
  g.computeBoundingBox();
  const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
  const c = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const t = Math.pow((pos.getY(v) - y0) / Math.max(1e-6, y1 - y0), power);
    const k = min + (1 - min) * t;
    c[v * 3] = c[v * 3 + 1] = c[v * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

function merge(geos) {
  let count = 0;
  for (const g of geos) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const idx = [];
  let off = 0;
  for (const g of geos) {
    g.computeVertexNormals();
    pos.set(g.attributes.position.array, off * 3);
    nrm.set(g.attributes.normal.array, off * 3);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx.push(gi[i] + off);
    off += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setIndex(idx);
  return out;
}

// --- layers ------------------------------------------------------------------------------------
// spacing: average distance between pieces (m). size: real height/length range (m).
// show: the piece is drawn while player height < size * show (too big to notice beyond that).
export const LAYERS = [
  { id: 'tufts', on: ['carpet'], geo: () => heightAO(tuftGeometry(), 0.18, 0.7), spacing: 0.0028, size: [0.009, 0.012], width: 0.0016 / 0.17, show: 60, color: 'surface', vary: 0.22, tilt: 0.25, budget: 1 },
  { id: 'lint', on: ['carpet'], geo: () => lumpGeometry(1), spacing: 0.02, size: [0.0008, 0.002], width: 1, show: 300, color: 0x9a9384, vary: 0.2, tilt: 0, budget: 0.15 },
  { id: 'dust', on: ['woodfloor', 'tile', 'table'], geo: () => lumpGeometry(0), spacing: 0.006, size: [0.0001, 0.0005], width: 1, show: 600, color: 0x8b8578, vary: 0.25, tilt: 0, budget: 0.35 },
  { id: 'hair', on: ['woodfloor', 'tile', 'carpet'], geo: hairGeometry, spacing: 0.09, size: [0.03, 0.09], width: 1, show: 20, color: 0x2b1d14, vary: 0.4, tilt: 0, budget: 0.05, flat: true },
  { id: 'blades', on: ['lawn'], geo: () => heightAO(bladeGeometry(), 0.3, 0.6), spacing: 0.006, size: [0.04, 0.09], width: 1, show: 25, color: 0x4f7a2c, vary: 0.3, tilt: 0.35, budget: 1, side: THREE.DoubleSide },
  { id: 'soil', on: ['lawn', 'dirt'], geo: () => lumpGeometry(0), spacing: 0.004, size: [0.0004, 0.0016], width: 1, show: 300, color: 0x5a4632, vary: 0.3, tilt: 0, budget: 0.3 },
];

export class Scatter {
  constructor(game) {
    this.game = game;
    this.surfaces = [];
    this.budget = { low: 0, medium: 5000, high: 9000, ultra: 16000 }[game.tier.name] ?? 5000;
    this.fadeNear = { value: 0 };
    this.layers = LAYERS.map((L) => this._makeLayer(L));
    this._lastKey = '';
  }

  // kind: 'carpet' | 'woodfloor' | 'tile' | 'lawn' | 'dirt' | 'table'; color used by tufts.
  addSurface({ minX, maxX, minZ, maxZ, y, kind, color = 0x808080 }) {
    this.surfaces.push({ minX, maxX, minZ, maxZ, y, kind, color: new THREE.Color(color) });
    this._lastKey = '';
  }

  _makeLayer(L) {
    const max = Math.max(1, Math.floor(this.budget * L.budget));
    const geo = L.geo();
    const mat = std({ color: 0xffffff, roughness: 0.92, side: L.side || THREE.FrontSide, vertexColors: !!geo.attributes.color }, { indoor: true });
    // Fibers/blades right in front of the camera dissolve (screen-door) so they never block the view.
    mat.userData.cacheKey = 'scatterfade';
    mat.userData.onCompile = (shader) => {
      shader.uniforms.uFadeNear = this.fadeNear;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFadeNear;')
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          {
            float d = length( vViewPosition );
            float t = clamp( ( d - uFadeNear * 0.45 ) / ( uFadeNear * 0.55 ), 0.0, 1.0 );
            // Interleaved gradient noise: an even, stripe-free dissolve pattern.
            float ign = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
            if ( t < 1.0 && ign > t ) discard;
          }`);
    };
    const mesh = new THREE.InstancedMesh(geo, mat, max);
    mesh.count = 0;
    // Culled as a whole by the bounding sphere around the filled area (so the far depth pass and
    // shadow cascades that can't see it skip it).
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.game.scene.add(mesh);
    return { L, mesh, max };
  }

  update() {
    const pl = this.game.player;
    if (!pl || this.budget === 0) return;
    const H = pl.height;
    const f = pl.renderFeet;
    this.fadeNear.value = pl.firstPerson ? H * 0.3 : pl.camDistM * 0.85;
    // Rebuild when you've moved a few body lengths or changed size by 10%.
    const step = H * 3;
    const key = `${Math.round(f.x / step)},${Math.round(f.z / step)},${Math.round(Math.log(H) * 10)},${this.surfaces.length}`;
    if (key === this._lastKey) return;
    this._lastKey = key;
    for (const layer of this.layers) this._fill(layer, f, H);
  }

  _fill(layer, center, H) {
    const { L, mesh, max } = layer;
    const sizeAvg = (L.size[0] + L.size[1]) / 2;
    // Too big to notice these? Hide the layer.
    if (H > sizeAvg * L.show) {
      mesh.count = 0;
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    // Radius that fits the budget at this layer's real density.
    const area = (max * L.spacing * L.spacing) / Math.PI;
    const R = Math.min(Math.sqrt(area), H * 60);
    const fade = clamp((sizeAvg * L.show - H) / (sizeAvg * L.show * 0.5), 0, 1); // shrink-in near the visibility limit
    const sp = L.spacing;
    let n = 0;
    const color = new THREE.Color();
    for (const s of this.surfaces) {
      if (!L.on.includes(s.kind)) continue;
      const x0 = Math.max(s.minX, center.x - R), x1 = Math.min(s.maxX, center.x + R);
      const z0 = Math.max(s.minZ, center.z - R), z1 = Math.min(s.maxZ, center.z + R);
      if (x0 >= x1 || z0 >= z1) continue;
      const i0 = Math.floor(x0 / sp), i1 = Math.floor(x1 / sp);
      const j0 = Math.floor(z0 / sp), j1 = Math.floor(z1 / sp);
      for (let i = i0; i <= i1 && n < max; i++) {
        for (let j = j0; j <= j1 && n < max; j++) {
          const h1 = hash3(i, j, 1, L.id.length * 97 + 13);
          const h2 = hash3(i, j, 2, L.id.length * 97 + 13);
          const h3 = hash3(i, j, 3, L.id.length * 97 + 13);
          const x = (i + h1) * sp, z = (j + h2) * sp;
          if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) continue;
          const dx = x - center.x, dz = z - center.z;
          const d2 = dx * dx + dz * dz;
          if (d2 > R * R) continue;
          // Thin out toward the edge of the radius so the border doesn't show.
          const edge = Math.sqrt(d2) / R;
          if (edge > 0.7 && h3 < (edge - 0.7) / 0.3) continue;
          const size = (L.size[0] + (L.size[1] - L.size[0]) * h3) * fade;
          _p.set(x, s.y, z);
          const tilt = L.tilt * (h1 - 0.5);
          if (L.flat) _e.set(0, h2 * Math.PI * 2, 0);
          else _e.set(tilt, h3 * Math.PI * 2, L.tilt * (h2 - 0.5));
          _q.setFromEuler(_e);
          // width === 1: uniform scale (lumps, hairs); otherwise width is the real XZ scale.
          const w = L.width === 1 ? size : L.width * Math.max(0.2, fade);
          _s.set(w, size, w);
          _m.compose(_p, _q, _s);
          mesh.setMatrixAt(n, _m);
          if (L.color === 'surface') color.copy(s.color);
          else color.set(L.color);
          const v = 1 + (hash3(i, j, 4, 7) - 0.5) * 2 * L.vary;
          color.multiplyScalar(v);
          mesh.setColorAt(n, color);
          n++;
        }
      }
    }
    mesh.count = n;
    if (!mesh.boundingSphere) mesh.boundingSphere = new THREE.Sphere();
    mesh.boundingSphere.center.set(center.x, center.y, center.z);
    mesh.boundingSphere.radius = R + L.size[1] * 2;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
