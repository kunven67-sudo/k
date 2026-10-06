// Cloth materials: per-fabric procedural weave (baked once, sampled triplanar in bind space so it
// sticks to the deforming garment), sheen, low-frequency wrinkles, hem stitching, fading and
// wear at hems/knees/elbows, grime rising from the ground, random stains and optional prints
// (chest graphic, back lettering, badges) projected in bind space.
//
//   createClothMaterial({ fabric, color, tierName, wear, dirt, seed, print }) -> material
//   material.userData.u -> live uniforms (uDirt, uWet, uStain...)

import * as THREE from 'three';
import { bakePBR } from '../gfx/textures.js';
import { TileNoise } from '../gfx/noise.js';
import { TRI_VERT_DECL, TRI_VERT_AXES, TRI_VERT_POS, TRI_FRAG_DECL, patch } from './shaderlib.js';

const N = new TileNoise(77);
const fr = (x) => x - Math.floor(x);

/** Fabric definitions: weave function + shading params. scale = texture repeats per metre. */
export const FABRICS = {
  jersey: { scale: 42, rough: 0.86, sheen: 0.6, wrinkle: 0.9, fn(u, v, o) {
    // Knit: rows of little V loops.
    const row = fr(v * 32);
    const col = fr(u * 32 + (row < 0.5 ? row : 1 - row) * 0.6);
    const loop = Math.sin(col * Math.PI) ** 0.6 * Math.sin(row * Math.PI);
    const n = N.fbm(u, v, { freq: 8, octaves: 3 });
    o.h = 0.35 + 0.5 * loop + 0.15 * n;
    const c = 0.82 + 0.14 * loop + 0.08 * n;
    o.r = o.g = o.b = c;
    o.rough = 0.88 - 0.1 * loop;
  } },
  pique: { scale: 40, rough: 0.82, sheen: 0.5, wrinkle: 0.7, fn(u, v, o) {
    const w = N.worley(u, v, 24);
    const n = N.fbm(u, v, { freq: 8, octaves: 3 });
    o.h = 0.25 + 0.7 * Math.min(1, w * 1.6) + 0.05 * n;
    o.r = o.g = o.b = 0.84 + 0.12 * o.h;
    o.rough = 0.82;
  } },
  oxford: { scale: 70, rough: 0.72, sheen: 0.35, wrinkle: 1.0, fn(u, v, o) {
    const a = Math.sin(u * Math.PI * 2 * 40) * 0.5 + 0.5;
    const b = Math.sin(v * Math.PI * 2 * 40) * 0.5 + 0.5;
    const check = (Math.floor(u * 80) + Math.floor(v * 80)) % 2;
    o.h = 0.4 + 0.3 * a * b + 0.15 * check;
    o.r = o.g = o.b = 0.86 + 0.1 * check + 0.05 * N.fbm(u, v, { freq: 16, octaves: 2 });
    o.rough = 0.7 + 0.08 * check;
  } },
  twill: { scale: 48, rough: 0.74, sheen: 0.3, wrinkle: 0.8, fn(u, v, o) {
    const d = fr((u + v) * 48);
    const rib = Math.sin(d * Math.PI) ** 1.5;
    o.h = 0.3 + 0.6 * rib;
    o.r = o.g = o.b = 0.8 + 0.16 * rib + 0.05 * N.fbm(u, v, { freq: 12, octaves: 2 });
    o.rough = 0.74;
  } },
  denim: { scale: 36, rough: 0.82, sheen: 0.2, wrinkle: 1.0, denim: 1, fn(u, v, o) {
    const d = fr((u * 2 + v) * 36);
    const rib = Math.sin(d * Math.PI) ** 1.2;
    const slub = N.fbm(u * 0.25, v * 3, { freq: 4, octaves: 3 });
    const weft = Math.max(0, Math.sin(v * Math.PI * 2 * 72)) ** 6;
    o.h = 0.3 + 0.5 * rib + 0.2 * slub;
    // Blue warp darkness in r; white weft peeks through (a).
    const c = 0.7 + 0.3 * rib * (0.6 + 0.6 * slub) + 0.25 * weft;
    o.r = o.g = o.b = Math.min(1, c);
    o.rough = 0.84;
  } },
  wool: { scale: 30, rough: 0.8, sheen: 0.45, wrinkle: 0.6, fn(u, v, o) {
    const hb = fr(v * 20 + Math.abs(fr(u * 20) - 0.5) * 2 * 0.5);
    const n = N.fbm(u, v, { freq: 16, octaves: 4 });
    o.h = 0.4 + 0.25 * Math.sin(hb * Math.PI * 2) * 0.5 + 0.3 * n;
    o.r = o.g = o.b = 0.86 + 0.1 * n + 0.04 * Math.sin(hb * Math.PI * 2);
    o.rough = 0.8;
  } },
  satin: { scale: 30, rough: 0.38, sheen: 0.9, wrinkle: 0.5, fn(u, v, o) {
    const n = N.fbm(u, v * 0.2, { freq: 6, octaves: 3 });
    o.h = 0.5 + 0.08 * n;
    o.r = o.g = o.b = 0.9 + 0.06 * n;
    o.rough = 0.36 + 0.06 * n;
  } },
  canvas: { scale: 34, rough: 0.86, sheen: 0.15, wrinkle: 0.9, fn(u, v, o) {
    const a = Math.sin(u * Math.PI * 2 * 34) * 0.5 + 0.5;
    const b = Math.sin(v * Math.PI * 2 * 34) * 0.5 + 0.5;
    const n = N.fbm(u, v, { freq: 8, octaves: 3 });
    o.h = 0.3 + 0.35 * Math.max(a, b) + 0.2 * n;
    o.r = o.g = o.b = 0.82 + 0.1 * Math.max(a, b) + 0.08 * n;
    o.rough = 0.88;
  } },
  fleece: { scale: 20, rough: 0.95, sheen: 1.0, wrinkle: 1.1, fn(u, v, o) {
    const n = N.fbm(u, v, { freq: 24, octaves: 4 });
    o.h = 0.5 + 0.4 * n;
    o.r = o.g = o.b = 0.85 + 0.12 * n;
    o.rough = 0.95;
  } },
  nylon: { scale: 26, rough: 0.45, sheen: 0.3, wrinkle: 1.3, fn(u, v, o) {
    const g = Math.max(Math.max(0, Math.sin(u * Math.PI * 2 * 8)) ** 30, Math.max(0, Math.sin(v * Math.PI * 2 * 8)) ** 30);
    const n = N.fbm(u, v, { freq: 6, octaves: 2 });
    o.h = 0.45 + 0.3 * g + 0.1 * n;
    o.r = o.g = o.b = 0.9 + 0.06 * g;
    o.rough = 0.45 + 0.15 * g;
  } },
  leather: { scale: 14, rough: 0.5, sheen: 0.05, wrinkle: 1.0, leather: 1, fn(u, v, o) {
    const w = N.worley(u, v, 18);
    const n = N.fbm(u, v, { freq: 10, octaves: 4 });
    o.h = 0.55 + 0.35 * Math.min(1, w * 2.2) - 0.25 * (1 - Math.min(1, w * 6)) + 0.1 * n;
    o.r = o.g = o.b = 0.8 + 0.18 * Math.min(1, w * 2) + 0.06 * n;
    o.rough = 0.42 + 0.25 * (1 - Math.min(1, w * 3)) + 0.1 * n;
  } },
  crepe: { scale: 40, rough: 0.78, sheen: 0.5, wrinkle: 0.7, fn(u, v, o) {
    const n = N.ridged(u, v, { freq: 12, octaves: 3 });
    o.h = 0.4 + 0.4 * n;
    o.r = o.g = o.b = 0.86 + 0.1 * n;
    o.rough = 0.8;
  } },
  sneaker: { scale: 50, rough: 0.7, sheen: 0.3, wrinkle: 0.4, fn(u, v, o) {
    const a = Math.sin(u * Math.PI * 2 * 30) * 0.5 + 0.5;
    const b = Math.sin((u + v) * Math.PI * 2 * 30) * 0.5 + 0.5;
    o.h = 0.35 + 0.35 * a * b;
    o.r = o.g = o.b = 0.88 + 0.1 * a * b;
    o.rough = 0.7;
  } },
  rubber: { scale: 20, rough: 0.6, sheen: 0, wrinkle: 0.1, fn(u, v, o) {
    const n = N.fbm(u, v, { freq: 8, octaves: 2 });
    o.h = 0.5 + 0.05 * n;
    o.r = o.g = o.b = 0.92 + 0.04 * n;
    o.rough = 0.62;
  } },
};

let wrinkleTex = null;
function wrinkles() {
  if (wrinkleTex) return wrinkleTex;
  const n2 = new TileNoise(901);
  wrinkleTex = bakePBR('cloth-wrinkles', 256, (u, v, o) => {
    // Long soft folds: stretched ridged noise, mostly horizontal bands (around limbs).
    const r = n2.ridged(u, v * 0.35, { freq: 3, octaves: 3 });
    const f = n2.fbm(u * 0.5, v, { freq: 2, octaves: 2 });
    o.h = 0.5 + 0.45 * (r - 0.5) + 0.2 * (f - 0.5);
    o.r = o.g = o.b = 0.5 + 0.5 * o.h;
  }, { normalStrength: 3.5 });
  return wrinkleTex;
}

const fabricCache = new Map();
function fabricTex(kind) {
  let t = fabricCache.get(kind);
  if (!t) {
    t = bakePBR(`fabric-${kind}`, 256, FABRICS[kind].fn, { normalStrength: kind === 'leather' ? 3 : 2.2 });
    fabricCache.set(kind, t);
  }
  return t;
}

const BLANK = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  t.needsUpdate = true;
  return t;
})();

/**
 * Cloth material. print: { tex, center:[x,y], size:[w,h], side: 1 front / -1 back } in bind
 * space (metres) — used for shirt graphics, SECURITY lettering, badges and name tags.
 */
export function createClothMaterial({ fabric = 'jersey', color = 0x808080, tierName = 'high', wear = 0.2, dirt = 0.1, seed = 1, prints = [], sole = null } = {}) {
  const F = FABRICS[fabric] || FABRICS.jersey;
  const physical = tierName !== 'low';
  const col = new THREE.Color().setHex(color, THREE.SRGBColorSpace);
  const M = physical
    ? new THREE.MeshPhysicalMaterial({ color: col, roughness: F.rough, metalness: 0, sheen: F.sheen, sheenRoughness: 0.6, sheenColor: col.clone().lerp(new THREE.Color(1, 1, 1), 0.35), side: THREE.DoubleSide })
    : new THREE.MeshStandardMaterial({ color: col, roughness: F.rough, metalness: 0, side: THREE.DoubleSide });
  if (fabric === 'leather' && physical) {
    M.clearcoat = 0.35;
    M.clearcoatRoughness = 0.45;
  }
  M.name = `cloth-${fabric}`;
  const tex = fabricTex(fabric);
  const pr = prints.slice(0, 3);
  const U = {
    uFab: { value: tex.map },
    uFabN: { value: tex.normalMap },
    uFabO: { value: tex.ormMap },
    uWr: { value: wrinkles().normalMap },
    uScale: { value: F.scale },
    uWrinkle: { value: F.wrinkle },
    uWear: { value: wear },
    uDirt: { value: dirt },
    uSeed: { value: (seed % 997) * 0.137 },
    uDenim: { value: F.denim ? 1 : 0 },
    uSole: { value: sole ? new THREE.Vector4(sole.height, ...new THREE.Color().setHex(sole.color, THREE.SRGBColorSpace).toArray()) : new THREE.Vector4(-1, 0, 0, 0) },
    uPrint: { value: pr.map((p) => p.tex).concat([BLANK, BLANK, BLANK]).slice(0, 3) },
    uPrintRect: { value: [0, 1, 2].map((i) => (pr[i] ? new THREE.Vector4(pr[i].center[0], pr[i].center[1], pr[i].size[0], pr[i].size[1]) : new THREE.Vector4(0, -9, 0, 0))) },
    uPrintSide: { value: [0, 1, 2].map((i) => (pr[i] ? pr[i].side : 0)) },
  };
  M.userData.u = U;
  M.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    let vs = sh.vertexShader;
    vs = patch(vs, 'common', `${TRI_VERT_DECL}
attribute vec4 aCloth;
varying vec4 vCloth;`);
    vs = patch(vs, 'skinnormal_vertex', TRI_VERT_AXES);
    vs = patch(vs, 'begin_vertex', `${TRI_VERT_POS}
vCloth = aCloth;`);
    sh.vertexShader = vs;
    let fs = sh.fragmentShader;
    fs = patch(fs, 'common', `${TRI_FRAG_DECL}
uniform sampler2D uFab, uFabN, uFabO, uWr;
uniform float uScale, uWrinkle, uWear, uDirt, uSeed, uDenim;
uniform vec4 uSole;
uniform sampler2D uPrint[ 3 ];
uniform vec4 uPrintRect[ 3 ];
uniform float uPrintSide[ 3 ];
varying vec4 vCloth;
vec3 gTW;
float hashC( vec3 p ) { return fract( sin( dot( p, vec3( 12.9898, 78.233, 37.719 ) ) ) * 43758.5453 ); }
float vnoise( vec3 p ) {
  vec3 i = floor( p ); vec3 f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  float a = mix( mix( hashC( i ), hashC( i + vec3( 1, 0, 0 ) ), f.x ), mix( hashC( i + vec3( 0, 1, 0 ) ), hashC( i + vec3( 1, 1, 0 ) ), f.x ), f.y );
  float b = mix( mix( hashC( i + vec3( 0, 0, 1 ) ), hashC( i + vec3( 1, 0, 1 ) ), f.x ), mix( hashC( i + vec3( 0, 1, 1 ) ), hashC( i + vec3( 1, 1, 1 ) ), f.x ), f.y );
  return mix( a, b, f.z );
}`);
    fs = patch(fs, 'map_fragment', `
{
  gTW = triWeights( vBindN );
  vec3 P = vBindPos * uScale;
  vec4 fab = triSample( uFab, P, gTW );
  float hem = vCloth.x;
  float n1 = vnoise( vBindPos * 9.0 + uSeed );
  float n2 = vnoise( vBindPos * 31.0 + uSeed * 3.0 );
  vec3 col = diffuseColor.rgb * ( 0.55 + 0.5 * fab.r );
  // Denim: lighter weft showing through + fading at hems, knees and seat (wear).
  float fade = uWear * ( ( 1.0 - smoothstep( 0.0, 0.25, hem ) ) * 0.6 + smoothstep( 0.55, 0.85, n1 ) * 0.5 );
  col = mix( col, mix( col * 1.9 + 0.05, vec3( 0.75, 0.8, 0.86 ), 0.25 ), uDenim * clamp( fade + fab.r * 0.12, 0.0, 0.8 ) );
  col = mix( col, col * 1.15 + 0.02, ( 1.0 - uDenim ) * fade * 0.35 );
  // Stitch line ~9 mm from every hem (dashed by a bind-space coordinate).
  float stitchBand = smoothstep( 0.15, 0.17, hem ) * ( 1.0 - smoothstep( 0.2, 0.22, hem ) );
  float dash = step( 0.45, fract( ( vBindPos.x + vBindPos.y + vBindPos.z ) * 260.0 ) );
  col = mix( col, mix( col * 0.62, vec3( 0.78, 0.6, 0.3 ), uDenim * 0.8 ), stitchBand * dash * 0.7 );
  // Inner hem strip slightly darker (inside of the fabric).
  col *= 1.0 - vCloth.w * 0.3;
  // Grime rises from the ground; stains are random blotches.
  float hgt = vCloth.y;
  float grime = uDirt * ( 1.0 - smoothstep( 0.05, 0.75, hgt ) ) * ( 0.6 + 0.6 * n2 );
  col = mix( col, col * vec3( 0.62, 0.55, 0.46 ), clamp( grime, 0.0, 0.85 ) );
  float stain = smoothstep( 0.78, 0.84, vnoise( vBindPos * 6.0 + uSeed * 7.0 ) ) * smoothstep( 0.2, 0.9, uDirt + uWear * 0.5 );
  col = mix( col, col * vec3( 0.7, 0.62, 0.52 ), stain * 0.6 );
  // Shoe soles.
  if ( uSole.x > 0.0 ) {
    float s = 1.0 - smoothstep( uSole.x - 0.002, uSole.x + 0.002, vBindPos.y );
    col = mix( col, uSole.yzw * ( 0.9 + 0.1 * n2 ), s );
  }
  // Prints (planar projection in bind space, front or back). Unrolled: sampler indices must be
  // constant in GLSL ES.
  #define APPLY_PRINT( I ) { vec4 R = uPrintRect[ I ]; float side = uPrintSide[ I ]; vec2 q = ( vec2( vBindPos.x * side, vBindPos.y ) - R.xy ) / R.zw + 0.5; if ( q.x > 0.0 && q.x < 1.0 && q.y > 0.0 && q.y < 1.0 && vBindN.z * side > 0.25 ) { vec4 pc = texture2D( uPrint[ I ], q ); col = mix( col, pc.rgb * ( 0.85 + 0.15 * fab.r ), pc.a * ( 1.0 - uWear * 0.35 * n2 ) ); } }
  APPLY_PRINT( 0 )
  APPLY_PRINT( 1 )
  APPLY_PRINT( 2 )
  diffuseColor.rgb = col;
}`);
    fs = patch(fs, 'roughnessmap_fragment', `
{
  vec4 o = triSample( uFabO, vBindPos * uScale, gTW );
  roughnessFactor = clamp( o.g + ( uDirt * 0.1 ), 0.05, 1.0 );
  if ( uSole.x > 0.0 && vBindPos.y < uSole.x ) roughnessFactor = 0.75;
}`);
    fs = patch(fs, 'normal_fragment_maps', `
{
  vec3 pert = triNormalPert( uFabN, vBindPos * uScale, gTW ) * 0.55;
  vec3 wr = triNormalPert( uWr, vBindPos * vec3( 3.0, 7.0, 3.0 ) + uSeed, gTW ) * 0.5 * uWrinkle;
  normal = normalize( normal + pert + wr );
}`);
    sh.fragmentShader = fs;
  };
  M.customProgramCacheKey = () => `gamble-cloth-${physical ? 'p' : 's'}-${pr.length}`;
  return M;
}
