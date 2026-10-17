// Real-looking trees, pines and bushes, built in code (no low-poly blobs):
//   - deciduous trees: a bark trunk that forks into limbs and twigs, with clusters of leaf
//     cards at the twig ends. Leaf normals point out from the crown, so the light falls on the
//     whole canopy like a real tree instead of on flat paper cards. Seasons: fresh green in
//     spring, deep green in summer, orange/red/yellow in fall, bare branches in winter.
//   - pines: a straight trunk with tiers of drooping needle branches (evergreen).
//   - bushes: dense round leaf clumps.
// Everything is instanced (a handful of draw calls for the whole town) and leaves sway in the
// wind. Far trees (the woods around town) use a lighter version with fewer, bigger cards.
//
//   plantVegetation(group, { trees, pines, bushes, season })   // trees: [{ x, z, rotY, scale, far }]
//   vegetationTick(seconds)

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Rng } from '../core/rng.js';

const uVegTime = { value: 0 };
export function vegetationTick(t) {
  uVegTime.value = t;
}

// ------------------------------------------------------------------ textures
const LEAF_PALETTES = {
  spring: ['#7fae3e', '#8fbd4a', '#6c9c35', '#9cc95a', '#5e8d2e'],
  summer: ['#3f6f28', '#4a7c2f', '#355f22', '#557f33', '#2f5520'],
  fall: ['#c8692a', '#d98a2b', '#b8471f', '#e0b23a', '#9e3a1c', '#c99a33', '#8a5a22'],
};
const texCache = new Map();

function finishTex(c, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** A clump of leaves on transparent background (dense in the middle, ragged at the edges). */
function leafTexture(season) {
  if (texCache.has(`leaf-${season}`)) return texCache.get(`leaf-${season}`);
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const r = new Rng(season.length * 97 + 3);
  const pal = LEAF_PALETTES[season];
  // Twigs first (seen between leaves).
  g.strokeStyle = '#4b3a2a';
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    g.lineWidth = r.range(2, 5);
    g.beginPath();
    g.moveTo(S / 2 + r.range(-30, 30), S / 2 + r.range(-30, 30));
    const a = r.range(0, Math.PI * 2);
    g.quadraticCurveTo(S / 2 + Math.cos(a + 0.4) * 120, S / 2 + Math.sin(a + 0.4) * 120, S / 2 + Math.cos(a) * 220, S / 2 + Math.sin(a) * 220);
    g.stroke();
  }
  for (let i = 0; i < 420; i++) {
    // Denser towards the middle: the card edge disappears into the crown.
    const rad = Math.sqrt(r.next()) * S * 0.46;
    const a = r.range(0, Math.PI * 2);
    const x = S / 2 + Math.cos(a) * rad;
    const y = S / 2 + Math.sin(a) * rad;
    const len = r.range(16, 30);
    const w = len * r.range(0.42, 0.55);
    const rot = r.range(0, Math.PI * 2);
    const base = new THREE.Color(pal[r.int(0, pal.length - 1)]);
    base.offsetHSL(r.range(-0.015, 0.015), r.range(-0.05, 0.05), r.range(-0.07, 0.07));
    // Leaves deeper in the clump are darker (self shadow).
    const depth = 1 - rad / (S * 0.46);
    const lit = base.clone().multiplyScalar(0.72 + 0.4 * (1 - depth * 0.6));
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const grad = g.createLinearGradient(-len, 0, len, 0);
    grad.addColorStop(0, `#${lit.clone().multiplyScalar(0.8).getHexString()}`);
    grad.addColorStop(0.5, `#${lit.getHexString()}`);
    grad.addColorStop(1, `#${lit.clone().multiplyScalar(1.12).getHexString()}`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-len, 0);
    g.quadraticCurveTo(-len * 0.2, -w, len, 0);
    g.quadraticCurveTo(-len * 0.2, w, -len, 0);
    g.fill();
    g.strokeStyle = `rgba(0,0,0,0.18)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-len * 0.9, 0);
    g.lineTo(len * 0.85, 0);
    g.stroke();
    g.restore();
  }
  const t = finishTex(c);
  texCache.set(`leaf-${season}`, t);
  return t;
}

/** A fir / spruce branch: twig through the middle, needles both sides, drooping tips. */
function needleTexture() {
  if (texCache.has('needles')) return texCache.get('needles');
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = new Rng(11);
  const twig = (x0, y0, x1, y1, len, width) => {
    g.strokeStyle = '#4a3726';
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    const n = Math.hypot(x1 - x0, y1 - y0) / 2.2;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      const ang = Math.atan2(y1 - y0, x1 - x0);
      for (const s of [-1, 1]) {
        const a = ang + s * r.range(0.6, 1.0);
        const l = len * (1 - t * 0.45) * r.range(0.7, 1.1);
        const col = new THREE.Color('#2f4a24').offsetHSL(r.range(-0.02, 0.02), r.range(-0.05, 0.05), r.range(-0.06, 0.08));
        g.strokeStyle = `#${col.getHexString()}`;
        g.lineWidth = r.range(1.8, 3.0);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    }
  };
  // A ragged dark mass behind the twigs: the inner needles you can't see through. Without it
  // the thin needle strokes vanish in the smaller mipmaps and far pines look like bare poles.
  g.fillStyle = '#233a1b';
  g.beginPath();
  g.moveTo(14, H / 2);
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const half = (1 - t) * 62 + 6;
    g.lineTo(14 + (W - 40) * t, H / 2 + 26 * t - half * r.range(0.65, 1));
  }
  for (let i = 40; i >= 0; i--) {
    const t = i / 40;
    const half = (1 - t) * 62 + 6;
    g.lineTo(14 + (W - 40) * t, H / 2 + 26 * t + half * r.range(0.65, 1));
  }
  g.closePath();
  g.fill();
  twig(10, H / 2, W - 10, H / 2 + 26, 34, 5);
  for (let i = 0; i < 9; i++) {
    const t = 0.12 + i * 0.09;
    const x = 10 + (W - 20) * t;
    const y = H / 2 + 26 * t;
    const s = i % 2 ? 1 : -1;
    twig(x, y, x + r.range(70, 130), y + s * r.range(40, 85), 24, 3);
  }
  const t = finishTex(c);
  texCache.set('needles', t);
  return t;
}

/** Bark: vertical ridges + cracks, with a matching normal map. Tiles along the branch. */
function barkTextures(dark = false) {
  const key = `bark-${dark}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = new Rng(dark ? 5 : 3);
  const base = dark ? [58, 48, 40] : [92, 76, 60];
  g.fillStyle = `rgb(${base.join(',')})`;
  g.fillRect(0, 0, W, H);
  const height = new Float32Array(W * H);
  // Ridges: wavy vertical strips of varying width (wrap around horizontally).
  for (let k = 0; k < 26; k++) {
    let x = r.range(0, W);
    const w = r.range(4, 14);
    const amp = r.range(1, 3);
    const f = r.range(0.0015, 0.004);
    const ph = r.range(0, 6);
    for (let y = 0; y < H; y++) {
      const cx = x + Math.sin(y * f * Math.PI * 2 + ph) * amp + Math.sin(y * 0.031 + k) * 0.8;
      for (let dx = -w; dx <= w; dx++) {
        const xx = ((Math.round(cx + dx) % W) + W) % W;
        const v = 1 - Math.abs(dx) / w;
        height[y * W + xx] = Math.max(height[y * W + xx], v * v);
      }
    }
    void x;
  }
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) {
    const h = height[i];
    const n = (r.next() - 0.5) * 18;
    const k = 0.45 + h * 0.75;
    img.data[i * 4] = Math.min(255, base[0] * k + n);
    img.data[i * 4 + 1] = Math.min(255, base[1] * k + n);
    img.data[i * 4 + 2] = Math.min(255, base[2] * k + n * 0.8);
  }
  g.putImageData(img, 0, 0);
  // Normal map from the height field.
  const nc = document.createElement('canvas');
  nc.width = W;
  nc.height = H;
  const ng = nc.getContext('2d');
  const nimg = ng.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const hx = height[y * W + ((x + 1) % W)] - height[y * W + ((x - 1 + W) % W)];
      const hy = height[((y + 1) % H) * W + x] - height[((y - 1 + H) % H) * W + x];
      const v = new THREE.Vector3(-hx * 2.2, -hy * 2.2, 1).normalize();
      const i = (y * W + x) * 4;
      nimg.data[i] = (v.x * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (v.y * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (v.z * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  ng.putImageData(nimg, 0, 0);
  const out = { map: finishTex(c, true), normal: new THREE.CanvasTexture(nc) };
  out.normal.wrapS = out.normal.wrapT = THREE.RepeatWrapping;
  texCache.set(key, out);
  return out;
}

// ------------------------------------------------------------------ materials
const matCache = new Map();

/** Leaf cards: alpha-tested, double sided, normals from the crown (no back-face flip), sway. */
function leafMaterial(map) {
  const key = map.uuid;
  if (matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uVegTime = uVegTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uVegTime;')
      .replace(
        '#include <project_vertex>',
        `{
          float h = max( 0.0, transformed.y - 1.2 );
          vec4 wp = vec4( transformed, 1.0 );
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          wp = modelMatrix * wp;
          float ph = uVegTime * 1.6 + wp.x * 0.31 + wp.z * 0.23;
          transformed.x += sin( ph ) * 0.022 * h + sin( ph * 3.1 + wp.y ) * 0.012;
          transformed.z += cos( ph * 0.83 ) * 0.018 * h;
        }
        #include <project_vertex>`,
      );
    sh.fragmentShader = sh.fragmentShader.replace('normal *= faceDirection;', '');
  };
  m.customProgramCacheKey = () => 'veg-leaf-v1';
  matCache.set(key, m);
  return m;
}

function barkMaterial(dark) {
  const key = `bark-${dark}`;
  if (matCache.has(key)) return matCache.get(key);
  const t = barkTextures(dark);
  const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(1.4, 1.4), roughness: 0.95, metalness: 0 });
  matCache.set(key, m);
  return m;
}

// ------------------------------------------------------------------ geometry builders
const UP = new THREE.Vector3(0, 1, 0);

/** Tapered cylinder from a to b; UVs wrap once around and repeat every 1.2 m along it. */
function limb(a, b, r0, r1, seg = 6) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (len / 1.2));
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** A card (two triangles) at c, random orientation, size s; normals point away from `centre`. */
function card(c, s, rng, centre, upBias = 0.35) {
  const g = new THREE.PlaneGeometry(s, s);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)));
  g.applyQuaternion(q);
  g.translate(c.x, c.y, c.z);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(centre).normalize();
    v.y += upBias;
    v.normalize();
    nor.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

function deciduous(seed, far) {
  const rng = new Rng(seed);
  const wood = [];
  const leaves = [];
  const tips = [];
  const trunkTop = new THREE.Vector3(rng.range(-0.25, 0.25), rng.range(2.8, 3.8), rng.range(-0.25, 0.25));
  wood.push(limb(new THREE.Vector3(0, -0.1, 0), trunkTop, 0.26, 0.17, far ? 5 : 8));
  const n = 4 + rng.int(0, 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const t = rng.range(0.45, 0.85); // angle from vertical
    const d = new THREE.Vector3(Math.cos(a) * Math.sin(t), Math.cos(t), Math.sin(a) * Math.sin(t));
    const start = trunkTop.clone().addScaledVector(UP, -rng.range(0, 0.9));
    const end = start.clone().addScaledVector(d, rng.range(2.2, 3.3));
    wood.push(limb(start, end, 0.14, 0.06, far ? 4 : 6));
    tips.push(end);
    const subs = far ? 1 : 2 + rng.int(0, 1);
    for (let j = 0; j < subs; j++) {
      const s = start.clone().lerp(end, rng.range(0.45, 0.85));
      const d2 = d.clone().add(new THREE.Vector3(rng.range(-0.9, 0.9), rng.range(0.1, 0.6), rng.range(-0.9, 0.9))).normalize();
      const e2 = s.clone().addScaledVector(d2, rng.range(1.0, 1.8));
      if (!far) wood.push(limb(s, e2, 0.06, 0.025, 4));
      tips.push(e2);
    }
  }
  const leader = trunkTop.clone().add(new THREE.Vector3(rng.range(-0.3, 0.3), rng.range(1.8, 2.6), rng.range(-0.3, 0.3)));
  wood.push(limb(trunkTop, leader, 0.12, 0.04, far ? 4 : 6));
  tips.push(leader);
  const centre = tips.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(tips.length);
  centre.y -= 0.6;
  const per = far ? 3 : 9;
  const size = far ? 2.4 : 1.45;
  for (const tip of tips)
    for (let k = 0; k < per; k++) {
      const p = tip.clone().add(new THREE.Vector3(rng.range(-1, 1), rng.range(-0.7, 0.8), rng.range(-1, 1)).multiplyScalar(far ? 1.1 : 0.95));
      leaves.push(card(p, size * rng.range(0.8, 1.2), rng, centre));
    }
  // Fill the inside of the crown so you can't see straight through it.
  const fill = far ? 6 : 22;
  for (let k = 0; k < fill; k++) {
    const p = centre.clone().add(new THREE.Vector3(rng.range(-1.6, 1.6), rng.range(-0.6, 1.4), rng.range(-1.6, 1.6)));
    leaves.push(card(p, size * 1.1, rng, centre, 0.2));
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(leaves) };
}

function pine(seed, far) {
  const rng = new Rng(seed);
  const H = rng.range(9, 13);
  const wood = [limb(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, H, 0), 0.24, 0.04, far ? 5 : 7)];
  const cards = [];
  const tiers = far ? 7 : 12;
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1);
    const y = 1.6 + k * (H - 2.0);
    const len = (1 - k) * 2.6 + 0.5;
    const n = far ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.7 + rng.range(-0.2, 0.2);
      const droop = rng.range(0.25, 0.45);
      // Each drooping branch = two crossed cards: one lying flat-ish (seen from above/below)
      // and one standing up along the branch (seen from the side). With only the flat one a pine
      // looked like a bare pole from street level.
      for (const stand of [false, true]) {
        const g = new THREE.PlaneGeometry(len, len * (stand ? 0.42 : 0.55));
        g.translate(len / 2, 0, 0);
        if (!stand) g.rotateX(-Math.PI / 2 + rng.range(-0.25, 0.25));
        g.rotateZ(-droop);
        g.rotateY(a);
        g.translate(0, y, 0);
        const nor = g.attributes.normal;
        const pos = g.attributes.position;
        const v = new THREE.Vector3();
        for (let j = 0; j < pos.count; j++) {
          v.set(pos.getX(j), 0.9, pos.getZ(j)).normalize();
          nor.setXYZ(j, v.x, v.y, v.z);
        }
        cards.push(g);
      }
    }
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(cards) };
}

function bush(seed) {
  const rng = new Rng(seed);
  const cards = [];
  const centre = new THREE.Vector3(0, 0.25, 0);
  for (let k = 0; k < 26; k++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * 0.55;
    const p = new THREE.Vector3(Math.cos(a) * r, rng.range(0.25, 0.85) * (1 - r * 0.6), Math.sin(a) * r);
    cards.push(card(p, rng.range(0.55, 0.8), rng, centre, 0.3));
  }
  return mergeGeometries(cards);
}

// ------------------------------------------------------------------ planting
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function instanced(parent, geo, material, list, { shadow = true } = {}) {
  if (!list.length) return null;
  geo.computeBoundingSphere();
  const im = new THREE.InstancedMesh(geo, material, list.length);
  list.forEach((t, i) => {
    _q.setFromAxisAngle(UP, t.rotY || 0);
    _s.setScalar(t.scale || 1);
    _m.compose(_v.set(t.x, t.y || 0, t.z), _q, _s);
    im.setMatrixAt(i, _m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.castShadow = shadow;
  im.receiveShadow = true;
  parent.add(im);
  return im;
}

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export function plantVegetation(parent, { trees = [], pines = [], bushes = [], season = 'summer' }) {
  const VARIANTS = 4;
  const leafTex = season === 'winter' ? null : leafTexture(season);
  const leafMat = leafTex ? leafMaterial(leafTex) : null;
  const bark = barkMaterial(false);
  const barkDark = barkMaterial(true);
  for (const far of [false, true]) {
    for (let v = 0; v < VARIANTS; v++) {
      const list = trees.filter((t, i) => !!t.far === far && i % VARIANTS === v);
      if (!list.length) continue;
      const g = cached(`tree-${v}-${far}`, () => deciduous(101 + v * 37, far));
      instanced(parent, g.wood, bark, list, { shadow: !far });
      if (leafMat) instanced(parent, g.leaves, leafMat, list, { shadow: !far });
    }
    for (let v = 0; v < 3; v++) {
      const list = pines.filter((t, i) => !!t.far === far && i % 3 === v);
      if (!list.length) continue;
      const g = cached(`pine-${v}-${far}`, () => pine(301 + v * 53, far));
      instanced(parent, g.wood, barkDark, list, { shadow: !far });
      instanced(parent, g.leaves, leafMaterial(needleTexture()), list, { shadow: !far });
    }
  }
  if (bushes.length) {
    // Bushes are evergreen boxwood/yew in winter, normal leaves the rest of the year.
    const bt = season === 'winter' || season === 'fall' ? leafTexture('summer') : leafTexture(season);
    for (let v = 0; v < 3; v++) {
      const list = bushes.filter((t, i) => i % 3 === v);
      instanced(parent, cached(`bush-${v}`, () => bush(501 + v * 19)), leafMaterial(bt), list, { shadow: true });
    }
  }
}
