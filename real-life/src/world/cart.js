// A real wire shopping cart and a red plastic hand basket (the kit ones looked like toys).
// The wire mesh is a see-through texture on the basket walls, so a cart is a few hundred
// triangles, not thousands of tiny wires. Carts lined up at the door are merged into one mesh
// per material.
//
//   cartRow(root, [{ x, y, z, rotY }, ...])     // nested row of carts
//   basketStack(root, x, y, z, count)

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture } from '../gfx/textures.js';

const WIRE_TILE = 0.055; // metres per wire square

let _mats = null;
function mats() {
  if (_mats) return _mats;
  const wireTex = canvasTexture('cart-wire', 64, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, 6);
    c.fillRect(0, 0, 6, h);
  }, { repeat: true });
  const slotTex = canvasTexture('basket-slots', 64, 64, (c, w, h) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
    c.clearRect(8, 14, w - 16, 18);
    c.clearRect(8, 40, w - 16, 18);
  }, { repeat: true });
  _mats = {
    wire: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, map: wireTex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.85, roughness: 0.35 }),
    tube: new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.85, roughness: 0.3 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8242a, roughness: 0.45 }),
    black: new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.8 }),
    basket: new THREE.MeshStandardMaterial({ color: 0xc8242a, map: slotTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 }),
  };
  return _mats;
}

/** A flat quad through 4 points (a, b, c, d in order) with UVs in wire squares. */
function quad(a, b, c, d, tile = WIRE_TILE) {
  const g = new THREE.BufferGeometry();
  const ab = a.distanceTo(b) / tile;
  const ad = a.distanceTo(d) / tile;
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, ab, 0, ab, ad, 0, ad], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** A thin round tube between two points. */
function tube(a, b, r = 0.009, seg = 6) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

let _cart = null;
/** One cart in local space: front = +x, handle at -x. Returns geometry lists per material. */
function cartParts() {
  if (_cart) return _cart;
  // Basket corners: back is taller + wider, the front slopes forward at the top.
  const bb = [V(-0.4, 0.52, -0.27), V(0.36, 0.52, -0.22), V(0.36, 0.52, 0.22), V(-0.4, 0.52, 0.27)]; // bottom
  const tt = [V(-0.46, 0.96, -0.28), V(0.48, 0.96, -0.23), V(0.48, 0.96, 0.23), V(-0.46, 0.96, 0.28)]; // top
  const wire = [
    quad(bb[0], bb[1], bb[2], bb[3]),
    quad(bb[0], bb[1], tt[1], tt[0]),
    quad(bb[3], bb[2], tt[2], tt[3]),
    quad(bb[1], bb[2], tt[2], tt[1]),
    quad(bb[0], bb[3], tt[3], tt[0]),
    quad(V(-0.38, 0.2, -0.2), V(0.38, 0.2, -0.17), V(0.38, 0.2, 0.17), V(-0.38, 0.2, 0.2)), // bottom tray
  ];
  const tubes = [];
  for (let i = 0; i < 4; i++) tubes.push(tube(tt[i], tt[(i + 1) % 4], 0.008), tube(bb[i], tt[i], 0.007));
  // Chassis: two rails, back legs up to the basket, handle arms.
  for (const s of [-1, 1]) {
    tubes.push(tube(V(-0.42, 0.14, s * 0.21), V(0.4, 0.14, s * 0.17), 0.012));
    tubes.push(tube(V(-0.42, 0.14, s * 0.21), V(-0.44, 0.52, s * 0.26), 0.012));
    tubes.push(tube(V(0.36, 0.14, s * 0.17), V(0.34, 0.52, s * 0.21), 0.01));
    tubes.push(tube(V(-0.46, 0.96, s * 0.28), V(-0.56, 1.0, s * 0.27), 0.011));
  }
  const red = [];
  const handle = new THREE.CylinderGeometry(0.02, 0.02, 0.58, 10);
  handle.rotateX(Math.PI / 2);
  handle.translate(-0.57, 1.0, 0);
  red.push(handle);
  const black = [];
  for (const [x, z] of [[-0.4, -0.2], [-0.4, 0.2], [0.38, -0.16], [0.38, 0.16]]) {
    const w = new THREE.CylinderGeometry(0.06, 0.06, 0.035, 12);
    w.rotateX(Math.PI / 2);
    w.translate(x, 0.06, z);
    black.push(w);
    tubes.push(tube(V(x, 0.06, z), V(x, 0.14, z), 0.008));
  }
  _cart = { wire, tube: tubes, red, black };
  return _cart;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

function addMerged(root, lists, M) {
  for (const [k, geos] of Object.entries(lists)) {
    if (!geos.length) continue;
    // mergeGeometries needs matching attributes: strip everything but position/normal/uv.
    const clean = geos.map((g) => {
      const n = g.index ? g.toNonIndexed() : g.clone();
      for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a);
      return n;
    });
    const mesh = new THREE.Mesh(mergeGeometries(clean), M[k]);
    mesh.castShadow = k !== 'wire' && k !== 'basket';
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

/** A row of carts (each { x, y, z, rotY }) merged into one mesh per material. */
export function cartRow(root, list) {
  const parts = cartParts();
  const out = { wire: [], tube: [], red: [], black: [] };
  for (const c of list) {
    _m.compose(V(c.x, c.y, c.z), _q.setFromAxisAngle(UP, c.rotY || 0), ONE);
    for (const k of Object.keys(out)) for (const g of parts[k]) out[k].push(g.clone().applyMatrix4(_m));
  }
  addMerged(root, out, mats());
}

/** A stack of red hand baskets (slotted plastic, two folded handles each). */
export function basketStack(root, x, y, z, count = 4) {
  const out = { basket: [], black: [] };
  for (let i = 0; i < count; i++) {
    const yy = y + i * 0.07;
    const b = [V(-0.2, yy, -0.14), V(0.2, yy, -0.14), V(0.2, yy, 0.14), V(-0.2, yy, 0.14)];
    const t = [V(-0.23, yy + 0.22, -0.17), V(0.23, yy + 0.22, -0.17), V(0.23, yy + 0.22, 0.17), V(-0.23, yy + 0.22, 0.17)];
    const tile = 0.04;
    out.basket.push(quad(b[0], b[1], b[2], b[3], 0.5), quad(b[0], b[1], t[1], t[0], tile), quad(b[3], b[2], t[2], t[3], tile), quad(b[1], b[2], t[2], t[1], tile), quad(b[0], b[3], t[3], t[0], tile));
    for (const s of [-1, 1]) out.black.push(tube(V(-0.2, yy + 0.22, s * 0.17), V(0.2, yy + 0.22, s * 0.17), 0.008, 5));
  }
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  addMerged(g, out, mats());
  root.add(g);
}
