// Playing cards as ONE instanced mesh per table (63 × 88 × 0.3 mm, rounded corners): the face,
// back and edge are picked per instance from the two card atlases (cardart.js) in a patched
// MeshStandardMaterial, so a full table of cards is a single draw call.
//
//   const deck = new CardMeshes({ capacity: 64 });   group.add(deck.mesh)
//   const c = deck.spawn(cardValue, pos, cardQuat(yaw, faceUp));   c.pos.y += …; c.commit();
//   deck.free(c)
// Positions are in the parent (table) space.

import * as THREE from 'three';
import { paintCardAtlases, CELL_W, CELL_H, COLS, PER_ATLAS, BACK_CELL } from './cardart.js';

export const CARD_W = 0.063;
export const CARD_H = 0.088;
export const CARD_T = 0.0003;
const R = 0.0035;

let atlas = null;
function atlases() {
  if (atlas) return atlas;
  const canvases = [0, 1].map(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    return c;
  });
  paintCardAtlases(canvases);
  const tex = canvases.map((c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  });
  atlas = { canvases, tex };
  // Repaint once the casino fonts are in (canvas text falls back to Georgia until then).
  if (document.fonts?.load) {
    Promise.all([document.fonts.load('700 20px "Playfair Display"'), document.fonts.load('400 20px "Playfair Display"')])
      .then(() => {
        paintCardAtlases(canvases);
        for (const t of tex) t.needsUpdate = true;
      })
      .catch(() => {});
  }
  return atlas;
}

function cardGeometry() {
  const shape = new THREE.Shape();
  const w = CARD_W / 2;
  const h = CARD_H / 2;
  shape.moveTo(-w + R, -h);
  shape.lineTo(w - R, -h);
  shape.absarc(w - R, -h + R, R, -Math.PI / 2, 0, false);
  shape.lineTo(w, h - R);
  shape.absarc(w - R, h - R, R, 0, Math.PI / 2, false);
  shape.lineTo(-w + R, h);
  shape.absarc(-w + R, h - R, R, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w, -h + R);
  shape.absarc(-w + R, -h + R, R, Math.PI, Math.PI * 1.5, false);
  const pts = shape.getPoints(5);
  if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  const tris = THREE.ShapeUtils.triangulateShape(pts, []);
  const pos = [];
  const nor = [];
  const uv = [];
  const side = [];
  const idx = [];
  const T = CARD_T / 2;
  // 2D y maps to −Z so the top of the face points away from whoever the card faces (+Z side).
  const push = (x, y, z, nx, ny, nz, u, v, s) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
    uv.push(u, v);
    side.push(s);
    return pos.length / 3 - 1;
  };
  const top = pts.map((p) => push(p.x, T, -p.y, 0, 1, 0, (p.x + w) / CARD_W, (p.y + h) / CARD_H, 0));
  for (const [a, b, c] of tris) idx.push(top[a], top[c], top[b]);
  const bot = pts.map((p) => push(p.x, -T, -p.y, 0, -1, 0, 1 - (p.x + w) / CARD_W, (p.y + h) / CARD_H, 1));
  for (const [a, b, c] of tris) idx.push(bot[a], bot[b], bot[c]);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const nx = q.y - p.y;
    const nz = q.x - p.x;
    const l = Math.hypot(nx, nz) || 1;
    const a = push(p.x, T, -p.y, nx / l, 0, nz / l, 0, 0, 2);
    const b = push(q.x, T, -q.y, nx / l, 0, nz / l, 0, 0, 2);
    const c = push(q.x, -T, -q.y, nx / l, 0, nz / l, 0, 0, 2);
    const d = push(p.x, -T, -p.y, nx / l, 0, nz / l, 0, 0, 2);
    idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  // Make sure the winding faces outward on both sides (flip triangles whose normal disagrees).
  const P = g.attributes.position.array;
  const N = g.attributes.normal.array;
  const I = g.index.array;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    if (gx * N[a] + gy * N[a + 1] + gz * N[a + 2] < 0) {
      const tmp = I[t + 1];
      I[t + 1] = I[t + 2];
      I[t + 2] = tmp;
    }
  }
  return g;
}

function cardMaterial() {
  const { tex } = atlases();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uAtlasA = { value: tex[0] };
    sh.uniforms.uAtlasB = { value: tex[1] };
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aCell;
        attribute float aSide;
        varying vec2 vCardUv;
        varying float vAtlas;
        varying float vSide;`
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        {
          float cell = aSide < 0.5 ? aCell : ${BACK_CELL}.0;
          float atl = step(${PER_ATLAS}.0 - 0.5, cell);
          float j = cell - atl * ${PER_ATLAS}.0;
          float col = mod(j, ${COLS}.0);
          float row = floor(j / ${COLS}.0 + 0.001);
          vec2 cs = vec2(${CELL_W}.0 / 1024.0, ${CELL_H}.0 / 1024.0);
          vCardUv = vec2((col + uv.x) * cs.x, 1.0 - (row + 1.0 - uv.y) * cs.y);
          vAtlas = atl;
          vSide = aSide;
        }`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uAtlasA;
        uniform sampler2D uAtlasB;
        varying vec2 vCardUv;
        varying float vAtlas;
        varying float vSide;`
      )
      .replace(
        '#include <map_fragment>',
        `{
          vec4 ca = texture2D(uAtlasA, vCardUv);
          vec4 cb = texture2D(uAtlasB, vCardUv);
          vec4 tc = mix(ca, cb, vAtlas);
          if (vSide > 1.5) tc = vec4(0.86, 0.85, 0.8, 1.0);
          diffuseColor *= tc;
        }`
      );
  };
  m.customProgramCacheKey = () => 'gamble-card-v1';
  return m;
}

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3(1, 1, 1);
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
const _flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
const _yawQ = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

/** Card orientation: yaw about +Y (0 = face reads from +Z), face up/down, optional tilt (rad about X). */
export function cardQuat(yaw = 0, faceUp = true, tilt = 0, out = new THREE.Quaternion()) {
  _yawQ.setFromAxisAngle(Y, yaw);
  out.copy(_yawQ);
  if (tilt) out.multiply(_tilt.setFromAxisAngle(X, tilt));
  if (!faceUp) out.multiply(_flip);
  return out;
}

class Card {
  constructor(deck, id) {
    this.deck = deck;
    this.id = id;
    this.value = -1;
    this.pos = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.faceUp = false;
    this.alive = false;
  }

  commit() {
    if (!this.alive) return;
    this.deck.mesh.setMatrixAt(this.id, _m.compose(this.pos, this.quat, _s));
    this.deck.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Change the printed card (e.g. a face-down card is assigned when it's turned). */
  setValue(v) {
    this.value = v;
    this.deck.cellAttr.setX(this.id, v);
    this.deck.cellAttr.needsUpdate = true;
  }
}

export class CardMeshes {
  constructor({ capacity = 64 } = {}) {
    const geo = cardGeometry();
    this.cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geo.setAttribute('aCell', this.cellAttr);
    this.mesh = new THREE.InstancedMesh(geo, cardMaterial(), capacity);
    this.mesh.name = 'cards';
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, 0), 3);
    this.cards = [];
    this.freeIds = [];
    for (let i = capacity - 1; i >= 0; i--) {
      this.mesh.setMatrixAt(i, _zero);
      this.freeIds.push(i);
      this.cards[i] = new Card(this, i);
    }
  }

  spawn(value, pos, quat) {
    const id = this.freeIds.pop();
    if (id === undefined) return null;
    const c = this.cards[id];
    c.alive = true;
    c.setValue(value);
    c.pos.copy(pos);
    c.quat.copy(quat);
    c.commit();
    return c;
  }

  free(c) {
    if (!c || !c.alive) return;
    c.alive = false;
    this.mesh.setMatrixAt(c.id, _zero);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.freeIds.push(c.id);
  }

  get used() {
    return this.mesh.count - this.freeIds.length;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.removeFromParent();
  }
}

/** The atlas canvases (dev page preview). */
export function cardAtlasCanvases() {
  return atlases().canvases;
}
