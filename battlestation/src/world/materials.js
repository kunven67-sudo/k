import * as THREE from 'three';
import { getURL } from '../core/assets.js';

// Real-world size (meters) one texture tile covers, from Poly Haven's scan data.
export const TEX_SIZE = {
  laminate_floor_02: 1.7, painted_plaster_wall: 2.0, marble_01: 1.5, granite_tile: 2.3, oak_veneer_01: 1.83,
  knitted_fleece: 0.27, jogging_melange: 0.27, rough_linen: 0.27, polar_fleece: 0.27, curly_teddy_natural: 0.33,
  terry_cloth: 0.36, fabric_leather_02: 0.5, kitchen_wood: 0.6, white_oak_veneer: 0.5,
};

const loader = new THREE.TextureLoader();
const texCache = new Map();
let maxAniso = 8;
export function setAniso(a) { maxAniso = a; for (const t of texCache.values()) { t.then(x => { x.anisotropy = a; x.needsUpdate = true; }); } }

export function tex(name, srgb = true) {
  const key = name + (srgb ? ':s' : ':l');
  if (!texCache.has(key)) {
    texCache.set(key, getURL(name).then(u => loader.loadAsync(u)).then(t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.anisotropy = maxAniso;
      return t;
    }));
  }
  return texCache.get(key);
}

const matCache = new Map();
// PBR material from a Poly Haven texture set. UVs on our geometry are in meters, so repeat = 1 / tile size.
export async function pbr(id, o = {}) {
  const key = id + JSON.stringify(o);
  if (matCache.has(key)) return matCache.get(key);
  const p = (async () => {
    const [map, nor, arm] = await Promise.all([
      tex(`textures/${id}_Diffuse.webp`, true),
      tex(`textures/${id}_nor_gl.webp`, false),
      tex(`textures/${id}_arm.webp`, false).catch(() => null),
    ]);
    const s = 1 / ((TEX_SIZE[id] || 1) * (o.scale || 1));
    const m = new THREE.MeshStandardMaterial({
      map: map.clone(), normalMap: nor.clone(), color: o.color ?? 0xffffff,
      roughness: o.roughness ?? 1, metalness: o.metalness ?? 0,
      normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
      envMapIntensity: o.env ?? 1,
    });
    if (arm) {
      m.roughnessMap = arm.clone();
      if (o.useMetal) m.metalnessMap = m.roughnessMap;
      if (o.ao !== false) { m.aoMap = m.roughnessMap; m.aoMapIntensity = o.ao ?? 0.8; }
    }
    for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) { t.repeat.set(s, s); t.needsUpdate = true; }
    if (o.rotate) for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) { t.rotation = o.rotate; }
    if (o.tintMap) m.map = null;
    return m;
  })();
  matCache.set(key, p);
  return p;
}

// Box-projected UVs in meters, so every surface tiles at its real size no matter how big it is.
export function worldUV(geo, rotUV = false) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    if (rotUV) [u, v] = [v, u];
    uv[i * 2] = u; uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Plain painted / plastic / metal materials (no texture needed).
export function paint(color, roughness = 0.6, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

// Procedural canvas texture helper.
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = maxAniso;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Subtle roughness variation so flat paint/plastic isn't perfectly uniform (fingerprints, wear).
let _smudge;
export function smudgeTex() {
  if (_smudge) return _smudge;
  _smudge = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = 'rgb(200,200,200)'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 28;
      const v = 150 + Math.random() * 105;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.25)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, false);
  return _smudge;
}
