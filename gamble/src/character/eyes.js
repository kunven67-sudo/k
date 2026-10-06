// Eyes and mouth interior materials.
//
// Eyeballs: a painted texture atlas (left eye in the left half, right eye in the right half, so
// heterochromia is free) with a sclera that has soft vein detail and a pink/grey falloff toward
// the corners, and an iris with radial fibres, a collarette, crypts, a dark limbal ring and the
// pupil. The material is wet (clearcoat cornea) and shades itself with the lids: the upper lid
// casts a soft shadow onto the eyeball and the eye corners are occluded by the socket, which is
// what stops eyes from looking "stuck on".
//
// Teeth/tongue: vertex-coloured, wet, darkened with depth into the mouth and when it is closed.

import * as THREE from 'three';
import { Rng } from '../core/rng.js';
import { EYE_COLOR_HEX } from './schema.js';

const atlasCache = new Map();

function hexRgb(hex) {
  return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Draw one eye (sclera + iris) into ctx at [ox, 0, S, S]. Iris radius = 0.27·S. */
function drawEye(ctx, ox, S, colorName, seed, age) {
  const rng = new Rng(seed);
  const cx = ox + S / 2;
  const cy = S / 2;
  // Sclera: warm off-white, pinker/greyer toward the corners (UV radius 0.5 = eyeball equator).
  const g = ctx.createRadialGradient(cx, cy, S * 0.2, cx, cy, S * 0.5);
  const yel = Math.min(1, Math.max(0, (age - 40) / 50));
  g.addColorStop(0, rgb(mixc([246, 242, 236], [238, 228, 205], yel)));
  g.addColorStop(0.55, rgb(mixc([238, 230, 224], [230, 216, 196], yel)));
  g.addColorStop(1, rgb([214, 168, 160]));
  ctx.fillStyle = g;
  ctx.fillRect(ox, 0, S, S);
  // Veins: thin red branches creeping in from the edge.
  ctx.lineCap = 'round';
  for (let v = 0; v < 26; v++) {
    let a = rng.next() * Math.PI * 2;
    let r = S * (0.5 + rng.next() * 0.04);
    let x = cx + Math.cos(a) * r;
    let y = cy + Math.sin(a) * r;
    const steps = 6 + rng.int(0, 8);
    let w = 0.6 + rng.next() * 0.9;
    for (let s = 0; s < steps; s++) {
      a += rng.gaussian(0, 0.25);
      r -= S * (0.012 + rng.next() * 0.018);
      if (r < S * 0.29) break;
      const nx = cx + Math.cos(a) * r;
      const ny = cy + Math.sin(a) * r;
      ctx.strokeStyle = `rgba(178,48,52,${(0.12 + rng.next() * 0.22) * (r / (S * 0.5))})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      x = nx;
      y = ny;
      w *= 0.85;
    }
  }
  // Iris.
  const base = hexRgb(EYE_COLOR_HEX[colorName] ?? 0x51290f);
  const RI = S * 0.27;
  const RP = RI * 0.38;
  const dark = mixc(base, [10, 8, 6], 0.55);
  const light = mixc(base, [235, 215, 170], colorName.includes('blue') || colorName === 'gray' ? 0.45 : 0.35);
  const ig = ctx.createRadialGradient(cx, cy, RP, cx, cy, RI);
  ig.addColorStop(0, rgb(mixc(base, [200, 150, 60], colorName === 'hazel' || colorName === 'green' ? 0.35 : 0.12)));
  ig.addColorStop(0.45, rgb(light));
  ig.addColorStop(0.8, rgb(base));
  ig.addColorStop(1, rgb(dark));
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(cx, cy, RI, 0, Math.PI * 2);
  ctx.fill();
  // Radial fibres.
  for (let f = 0; f < 220; f++) {
    const a = rng.next() * Math.PI * 2;
    const r0 = RP * (1 + rng.next() * 0.3);
    const r1 = RI * (0.7 + rng.next() * 0.3);
    const c = rng.next() < 0.5 ? light : dark;
    ctx.strokeStyle = rgb(c, 0.12 + rng.next() * 0.22);
    ctx.lineWidth = 0.5 + rng.next() * 1.1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    const am = a + rng.gaussian(0, 0.05);
    ctx.quadraticCurveTo(cx + Math.cos(am) * (r0 + r1) * 0.5, cy + Math.sin(am) * (r0 + r1) * 0.5, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }
  // Collarette (zigzag ring) and crypts.
  ctx.strokeStyle = rgb(mixc(light, [255, 240, 200], 0.3), 0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r = RI * (0.55 + 0.05 * Math.sin(i * 2.7) + 0.02 * rng.next());
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  for (let k = 0; k < 14; k++) {
    const a = rng.next() * Math.PI * 2;
    const r = RI * (0.6 + rng.next() * 0.3);
    ctx.fillStyle = rgb(dark, 0.3);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, RI * 0.05, RI * 0.025, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Limbal ring: dark, soft-edged.
  const lg = ctx.createRadialGradient(cx, cy, RI * 0.86, cx, cy, RI * 1.06);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(0.55, rgb(mixc(dark, [0, 0, 0], 0.5), 0.75));
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(cx, cy, RI * 1.08, 0, Math.PI * 2);
  ctx.fill();
  // Pupil.
  const pg = ctx.createRadialGradient(cx, cy, RP * 0.8, cx, cy, RP * 1.12);
  pg.addColorStop(0, 'rgba(4,3,3,1)');
  pg.addColorStop(1, 'rgba(4,3,3,0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(cx, cy, RP * 1.12, 0, Math.PI * 2);
  ctx.fill();
}

/** Atlas texture for a pair of eyes. */
export function eyeAtlas(colorL, colorR, { size = 256, seed = 1, age = 35 } = {}) {
  const key = `${colorL}|${colorR}|${size}|${Math.round(age / 20)}`;
  let t = atlasCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = size * 2;
  c.height = size;
  const ctx = c.getContext('2d');
  drawEye(ctx, 0, size, colorL, seed * 7 + 1, age);
  drawEye(ctx, size, size, colorR, seed * 7 + 2, age);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  atlasCache.set(key, t);
  return t;
}

/**
 * Eye material: wet cornea (clearcoat) over the painted atlas. A soft occlusion term darkens
 * the eyeball toward the lids and corners (uniform uOcc: per-eye world centre + radius), which
 * keeps eyes from looking pasted on.
 */
export function createEyeMaterial(map, tierName = 'high') {
  const physical = tierName !== 'low';
  const M = physical
    ? new THREE.MeshPhysicalMaterial({ map, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.376, specularIntensity: 0.55 })
    : new THREE.MeshStandardMaterial({ map, roughness: 0.18, metalness: 0 });
  M.name = 'eyes';
  const U = {
    uEyeC: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uHeadUp: { value: new THREE.Vector3(0, 1, 0) },
    uHeadFwd: { value: new THREE.Vector3(0, 0, 1) },
    uEyeR: { value: 0.02 },
    uLidU: { value: new THREE.Vector2(0.5, 0.5) },
  };
  M.userData.u = U;
  M.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEyeW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvEyeW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vEyeW;
uniform vec3 uEyeC[ 2 ];
uniform vec3 uHeadUp;
uniform vec3 uHeadFwd;
uniform float uEyeR;
uniform vec2 uLidU;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float d0 = distance( vEyeW, uEyeC[ 0 ] );
  float d1 = distance( vEyeW, uEyeC[ 1 ] );
  vec3 rel = ( vEyeW - ( d0 < d1 ? uEyeC[ 0 ] : uEyeC[ 1 ] ) ) / uEyeR;
  float lu = d0 < d1 ? uLidU.x : uLidU.y;
  float up = dot( rel, uHeadUp );
  float fwd = dot( rel, uHeadFwd );
  // Upper lid shadow + socket occlusion toward the edges of the visible cap.
  float occ = smoothstep( lu - 0.45, lu + 0.05, up ) * 0.55;
  occ = max( occ, ( 1.0 - smoothstep( 0.45, 0.9, fwd ) ) * 0.45 );
  diffuseColor.rgb *= 1.0 - occ;
}`);
  };
  M.customProgramCacheKey = () => `gamble-eye2-${physical ? 'p' : 's'}`;
  return M;
}

/** Teeth + tongue material (vertex colours), darkened deeper in the mouth and when closed. */
export function createMouthMaterial(tierName = 'high') {
  const physical = tierName !== 'low';
  const M = physical
    ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.15 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0 });
  M.name = 'mouth';
  const U = { uFrontZ: { value: 0 }, uDepth: { value: 0.04 }, uOpen: { value: 0 } };
  M.userData.u = U;
  M.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vMouthZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMouthZ = position.z;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vMouthZ;\nuniform float uFrontZ, uDepth, uOpen;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float depth = clamp( ( uFrontZ - vMouthZ ) / uDepth, 0.0, 1.0 );
  diffuseColor.rgb *= mix( 0.35, 1.0, uOpen ) * mix( 1.0, 0.25, depth );
}`);
  };
  M.customProgramCacheKey = () => `gamble-mouth-${physical ? 'p' : 's'}-1`;
  return M;
}
