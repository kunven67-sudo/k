// Micro-detail: procedural surface detail that appears as you get smaller (master list Rule 3).
//
// Every surface material can opt in with a "kind" (plaster, wood, carpet, metal...). In the shader we
// measure how big one screen pixel is on that surface (fwidth of the world position). Detail noise is
// picked at a scale of a few pixels, so there is always fresh detail at the scale you're looking at:
// at 1.75 m you see the normal textures; at 2 mm the plaster turns into pitted rock and the rug turns
// into fuzz. Detail stops above each material's biggest real feature size (it fades in, never pops).
//
// Precision: noise is evaluated relative to a 1 m grid origin near the camera, so float precision
// stays sharp even for sub-millimeter detail far from the world origin.
import * as THREE from 'three';
import { addShaderHook } from './materials.js';

export const DETAIL_KINDS = {
  //            normal strength, albedo variation, roughness variation, largest feature (m), smallest feature (m)
  plaster: { amp: 0.55, alb: 0.07, rough: 0.05, maxF: 0.004, minF: 2e-6 },
  paint: { amp: 0.25, alb: 0.04, rough: 0.08, maxF: 0.002, minF: 2e-6 },
  wood: { amp: 0.4, alb: 0.12, rough: 0.1, maxF: 0.003, minF: 2e-6 },
  carpet: { amp: 1.1, alb: 0.3, rough: 0.02, maxF: 0.012, minF: 2e-6, deep: 0.7 },
  fabric: { amp: 0.9, alb: 0.18, rough: 0.02, maxF: 0.003, minF: 2e-6 },
  metal: { amp: 0.18, alb: 0.05, rough: 0.12, maxF: 0.001, minF: 2e-6 },
  plastic: { amp: 0.12, alb: 0.03, rough: 0.08, maxF: 0.0015, minF: 2e-6 },
  glass: { amp: 0.04, alb: 0.0, rough: 0.05, maxF: 0.0005, minF: 2e-6 },
  food: { amp: 0.9, alb: 0.22, rough: 0.05, maxF: 0.004, minF: 2e-6 },
  stone: { amp: 0.95, alb: 0.22, rough: 0.06, maxF: 0.03, minF: 2e-6 },
  soil: { amp: 1.0, alb: 0.3, rough: 0.03, maxF: 0.02, minF: 2e-6 },
  skin: { amp: 0.35, alb: 0.06, rough: 0.05, maxF: 0.002, minF: 2e-6 },
  chitin: { amp: 0.3, alb: 0.08, rough: 0.1, maxF: 0.0008, minF: 2e-6 },
};

export const detailUniforms = {
  uDetailOrigin: { value: new THREE.Vector3() },
  uDetailOn: { value: 1 },
};

const VERT_DECL = /* glsl */ `
varying vec3 vDetailPos;
uniform vec3 uDetailOrigin;
`;
const VERT_BODY = /* glsl */ `
{
  vec4 dp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    dp = instanceMatrix * dp;
  #endif
  #ifdef USE_BATCHING
    dp = batchingMatrix * dp;
  #endif
  vDetailPos = ( modelMatrix * dp ).xyz - uDetailOrigin;
}
`;

const FRAG_DECL = /* glsl */ `
varying vec3 vDetailPos;
uniform vec3 uDetailOrigin;
uniform float uDetailOn;
uniform vec4 uDetailK;   // amp, albedo, rough, deep (darkening when zoomed in: the floor of a carpet pile)
uniform vec2 uDetailF;   // largest feature, smallest feature (m)
float dtl_value = 0.5;
float dtl_weight = 0.0;

uint dtl_hash( uvec3 x ) {
  x = ( ( x >> 8u ) ^ x.yzx ) * 1103515245u;
  x = ( ( x >> 8u ) ^ x.yzx ) * 1103515245u;
  x = ( ( x >> 8u ) ^ x.yzx ) * 1103515245u;
  return x.x;
}
float dtl_h( vec3 c ) { return float( dtl_hash( uvec3( ivec3( c ) + ivec3( 1 << 22 ) ) ) & 0xffffffu ) / 16777215.0; }

// Value noise with analytic gradient. cell = integer lattice coord (exact), f = fractional part.
vec4 dtl_noised( vec3 cell, vec3 f ) {
  // Quintic fade: no visible lattice creases in the lighting.
  vec3 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 );
  vec3 du = 30.0 * f * f * ( f * ( f - 2.0 ) + 1.0 );
  float a = dtl_h( cell ), b = dtl_h( cell + vec3( 1, 0, 0 ) ), c = dtl_h( cell + vec3( 0, 1, 0 ) ), d = dtl_h( cell + vec3( 1, 1, 0 ) );
  float e = dtl_h( cell + vec3( 0, 0, 1 ) ), g = dtl_h( cell + vec3( 1, 0, 1 ) ), h = dtl_h( cell + vec3( 0, 1, 1 ) ), k = dtl_h( cell + vec3( 1, 1, 1 ) );
  float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + h, k6 = a - b - e + g, k7 = -a + b + c - d + e - g - h + k;
  float v = k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  vec3 grad = du * vec3( k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y );
  return vec4( v, grad );
}

// One octave at frequency 2^lvl cycles per meter, lattice-aligned with the world origin.
vec4 dtl_octave( float lvl ) {
  float fr = exp2( lvl );
  vec3 p = vDetailPos * fr;
  vec3 cell = floor( p ) + uDetailOrigin * fr; // origin is integer meters -> exact integer lattice
  vec4 n = dtl_noised( cell, fract( p ) );
  n.yzw *= fr;
  return n;
}

// Returns (value 0..1, world gradient). Weight fades detail in below the material's largest feature.
vec4 dtl_sample( out float weight ) {
  vec3 fw = fwidth( vDetailPos );
  float px = max( max( fw.x, fw.y ), fw.z ) + 1e-12;
  float target = px * 5.0;                    // features about 5 pixels wide
  float lvl = clamp( -log2( target ), -log2( uDetailF.x ), -log2( uDetailF.y ) );
  float l0 = floor( lvl );
  float t = lvl - l0;
  vec4 a = dtl_octave( l0 );
  vec4 b = dtl_octave( l0 + 1.0 );
  vec4 c = dtl_octave( l0 - 1.0 );
  vec4 n = mix( a, b, t ) * 0.65 + c * 0.35;
  // Fade in as the pixel gets smaller than the largest real feature of this material.
  weight = smoothstep( uDetailF.x * 1.2, uDetailF.x * 0.35, target ) * uDetailOn;
  // Don't grade gradient beyond what the pixel can show (prevents sparkle).
  n.yzw /= exp2( l0 );
  return n;
}
`;

const FRAG_NORMAL = /* glsl */ `
{
  float dtlW;
  vec4 dn = dtl_sample( dtlW );
  dtl_value = mix( 0.5, dn.x, dtlW );
  dtl_weight = dtlW;
  if ( dtlW > 0.001 ) {
    vec3 gv = mat3( viewMatrix ) * dn.yzw;           // world gradient -> view space
    vec3 gt = gv - dot( gv, normal ) * normal;        // tangential part only
    normal = normalize( normal - gt * uDetailK.x * dtlW * 1.6 );
  }
}
`;

function kindOf(m) {
  const k = m.userData.detail;
  return k ? DETAIL_KINDS[k] || null : null;
}

// Install the hook (once). Materials opt in with material.userData.detail = 'plaster' etc.
let installed = false;
export function installDetail(enabled = true) {
  detailUniforms.uDetailOn.value = enabled ? 1 : 0;
  if (installed || !enabled) return;
  installed = true;
  addShaderHook((shader, m) => {
    const k = kindOf(m);
    if (!k) return;
    shader.uniforms.uDetailOrigin = detailUniforms.uDetailOrigin;
    shader.uniforms.uDetailOn = detailUniforms.uDetailOn;
    shader.uniforms.uDetailK = { value: new THREE.Vector4(k.amp, k.alb, k.rough, k.deep || 0) };
    shader.uniforms.uDetailF = { value: new THREE.Vector2(k.maxF, k.minF) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp( roughnessFactor + ( dtl_value - 0.5 ) * uDetailK.z, 0.02, 1.0 );')
      .replace('#include <lights_fragment_begin>', 'diffuseColor.rgb *= ( 1.0 + ( dtl_value - 0.5 ) * 2.0 * uDetailK.y ) * ( 1.0 - uDetailK.w * dtl_weight );\n#include <lights_fragment_begin>');
  });
}

// Keep the noise origin snapped to whole meters near the camera.
export function updateDetail(camera) {
  const p = camera.position;
  detailUniforms.uDetailOrigin.value.set(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
}
