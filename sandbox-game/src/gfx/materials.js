// Physical + visual definitions for every material in the game.
// Visual textures come from assets/textures/<material>/{albedo,normal,roughness}.jpg when present
// (real photo-scanned CC0 textures); until then the materials use plain PBR values.
import * as THREE from 'three';
import ASSETS from 'virtual:assets';

// breakDV: velocity change (m/s) in a single hit that breaks it. Infinity = never shatters.
// blast: how much explosion damage it takes (1 = normal).
export const MATERIALS = {
  wood:      { name: 'Wood',     density: 600,  friction: 0.6,  restitution: 0.15, breakDV: 9,   blast: 1.0, color: 0x9c7349, inner: 0xd9b98a, roughness: 0.78, metalness: 0, fracture: 'splinter', impact: 'wood' },
  plywood:   { name: 'Plywood',  density: 550,  friction: 0.6,  restitution: 0.12, breakDV: 7,   blast: 1.2, color: 0xc7a073, inner: 0xe0c49a, roughness: 0.8,  metalness: 0, fracture: 'layers',   impact: 'wood' },
  steel:     { name: 'Metal',    density: 7850, friction: 0.42, restitution: 0.1,  breakDV: Infinity, dentDV: 4, blast: 0.25, color: 0x8b8f94, roughness: 0.42, metalness: 1, fracture: 'none', impact: 'metal' },
  aluminum:  { name: 'Aluminum', density: 2700, friction: 0.4,  restitution: 0.1,  breakDV: Infinity, dentDV: 1.5, blast: 0.8, color: 0xc4c8cc, roughness: 0.3, metalness: 1, fracture: 'none', impact: 'metal' },
  glass:     { name: 'Glass',    density: 2500, friction: 0.3,  restitution: 0.05, breakDV: 2.2, blast: 3.0, color: 0xcfe3e6, inner: 0xa9d2d6, roughness: 0.04, metalness: 0, opacity: 0.22, fracture: 'shards', impact: 'glass' },
  tempered:  { name: 'Tempered Glass', density: 2500, friction: 0.3, restitution: 0.05, breakDV: 4.5, blast: 2.5, color: 0xcfe3e6, inner: 0xa9d2d6, roughness: 0.04, metalness: 0, opacity: 0.22, fracture: 'cubes', impact: 'glass' },
  ice:       { name: 'Ice',      density: 917,  friction: 0.03, restitution: 0.05, breakDV: 4,   blast: 1.6, color: 0xd6ecf7, inner: 0xeaf6fc, roughness: 0.08, metalness: 0, opacity: 0.82, fracture: 'ice', impact: 'ice' },
  concrete:  { name: 'Concrete', density: 2400, friction: 0.85, restitution: 0.05, breakDV: 11,  blast: 0.6, color: 0x9d9b96, inner: 0xb3b0a8, roughness: 0.95, metalness: 0, fracture: 'chunks', rebar: true, impact: 'concrete' },
  cinder:    { name: 'Cinder Block', density: 1300, friction: 0.85, restitution: 0.05, breakDV: 7, blast: 0.9, color: 0x8f8d88, inner: 0xa29f98, roughness: 0.98, metalness: 0, fracture: 'chunks', impact: 'concrete' },
  rubber:    { name: 'Rubber',   density: 1100, friction: 1.1,  restitution: 0.78, breakDV: Infinity, blast: 0.5, tearBlast: 60, color: 0x1d1d1f, roughness: 0.9, metalness: 0, fracture: 'tear', impact: 'rubber' },
  plastic:   { name: 'Plastic',  density: 950,  friction: 0.5,  restitution: 0.2,  breakDV: 8,   blast: 1.2, color: 0x2a2c2f, inner: 0x3a3c40, roughness: 0.55, metalness: 0, fracture: 'chunks', impact: 'plastic' },
  cardboard: { name: 'Cardboard', density: 120, friction: 0.7,  restitution: 0.05, breakDV: 7,   blast: 2.0, color: 0xb08a5a, inner: 0xc9a77a, roughness: 0.95, metalness: 0, fracture: 'chunks', impact: 'cardboard' },
  tnt:       { name: 'TNT',      density: 1600, friction: 0.6,  restitution: 0.1,  breakDV: Infinity, blast: 1.0, color: 0xa8231c, roughness: 0.7, metalness: 0, fracture: 'none', impact: 'plastic' },
};

// Materials the paint/material tool and the Shapes tab can choose from.
export const SHAPE_MATERIALS = ['wood', 'plywood', 'steel', 'glass', 'tempered', 'ice', 'concrete', 'rubber', 'tnt'];

const texCache = new Map();
function assetTexture(path, srgb) {
  if (!ASSETS[path]) return null;
  if (texCache.has(path)) return texCache.get(path);
  const tex = new THREE.TextureLoader().load(ASSETS[path]);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set(path, tex);
  return tex;
}

const matCache = new Map();

// Get a shared THREE material. `opts.color` paints it (e.g. a blue oil drum),
// `opts.inner` returns the freshly-broken interior look.
export function getMaterial(id, opts = {}) {
  const key = `${id}|${opts.color ?? ''}|${opts.inner ? 1 : 0}|${opts.roughness ?? ''}|${opts.metalness ?? ''}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? ''}`;
  if (matCache.has(key)) return matCache.get(key);
  const m = MATERIALS[id] || MATERIALS.wood;
  const albedo = assetTexture(`textures/${id}/albedo.jpg`, true);
  const normal = assetTexture(`textures/${id}/normal.jpg`, false);
  const rough = assetTexture(`textures/${id}/roughness.jpg`, false);
  const color = opts.inner ? (m.inner ?? m.color) : (opts.color ?? m.color);
  const params = {
    color,
    roughness: opts.roughness ?? (opts.inner ? Math.min(1, m.roughness + 0.15) : m.roughness),
    metalness: opts.metalness ?? m.metalness,
  };
  if (albedo && opts.color == null) params.map = albedo;
  if (normal) params.normalMap = normal;
  if (rough) params.roughnessMap = rough;
  if (m.opacity != null) {
    params.transparent = true;
    params.opacity = opts.inner ? Math.min(1, m.opacity + 0.25) : m.opacity;
    params.depthWrite = false;
    params.side = THREE.DoubleSide;
  }
  if (opts.emissive != null) { params.emissive = opts.emissive; params.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  const mat = new THREE.MeshStandardMaterial(params);
  if (m.opacity != null) mat.envMapIntensity = 1.6;
  matCache.set(key, mat);
  return mat;
}

export function isTransparent(id) { return MATERIALS[id]?.opacity != null; }
