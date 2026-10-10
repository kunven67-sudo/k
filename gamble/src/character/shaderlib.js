// Shared GLSL snippets + patch helpers for the character materials (skin, fabric, hair, eyes).
//
// Characters have no garment UVs: surface detail is sampled *triplanar in bind space* (the
// skinned mesh's `position` attribute before skinning), so it sticks to the body while it
// deforms. The vertex shader also skins the three bind-space axes so tangent-space detail
// normals can be applied in view space without tangents.

import * as THREE from 'three';

/** Vertex declarations: bind-space position/normal + skinned axes for triplanar normal maps. */
export const TRI_VERT_DECL = /* glsl */ `
varying vec3 vBindPos;
varying vec3 vBindN;
varying vec3 vAxX;
varying vec3 vAxY;
varying vec3 vAxZ;
`;

/** Insert after <skinnormal_vertex> (skinMatrix is in scope there). */
export const TRI_VERT_AXES = /* glsl */ `
vBindN = normal;
#ifdef USE_SKINNING
  vAxX = normalize( normalMatrix * ( skinMatrix * vec4( 1.0, 0.0, 0.0, 0.0 ) ).xyz );
  vAxY = normalize( normalMatrix * ( skinMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
  vAxZ = normalize( normalMatrix * ( skinMatrix * vec4( 0.0, 0.0, 1.0, 0.0 ) ).xyz );
#else
  vAxX = normalize( normalMatrix * vec3( 1.0, 0.0, 0.0 ) );
  vAxY = normalize( normalMatrix * vec3( 0.0, 1.0, 0.0 ) );
  vAxZ = normalize( normalMatrix * vec3( 0.0, 0.0, 1.0 ) );
#endif
`;

/** Insert after <begin_vertex>. */
export const TRI_VERT_POS = /* glsl */ `
vBindPos = position;
`;

export const TRI_FRAG_DECL = /* glsl */ `
varying vec3 vBindPos;
varying vec3 vBindN;
varying vec3 vAxX;
varying vec3 vAxY;
varying vec3 vAxZ;

vec3 triWeights( vec3 n ) {
  vec3 w = pow( abs( normalize( n ) ), vec3( 4.0 ) );
  return w / ( w.x + w.y + w.z + 1e-5 );
}
vec4 triSample( sampler2D t, vec3 p, vec3 w ) {
  return texture2D( t, p.zy ) * w.x + texture2D( t, p.xz ) * w.y + texture2D( t, p.xy ) * w.z;
}
// Tangent-space normal map sampled triplanar → view-space perturbation vector.
vec3 triNormalPert( sampler2D t, vec3 p, vec3 w ) {
  vec2 nx = texture2D( t, p.zy ).xy * 2.0 - 1.0;
  vec2 ny = texture2D( t, p.xz ).xy * 2.0 - 1.0;
  vec2 nz = texture2D( t, p.xy ).xy * 2.0 - 1.0;
  return w.x * ( nx.x * vAxZ + nx.y * vAxY ) + w.y * ( ny.x * vAxX + ny.y * vAxZ ) + w.z * ( nz.x * vAxX + nz.y * vAxY );
}
// Cotangent frame from screen-space derivatives (for UV-mapped normal maps without tangents).
mat3 cotangentFrame( vec3 N, vec3 p, vec2 uv ) {
  vec3 dp1 = dFdx( p );
  vec3 dp2 = dFdy( p );
  vec2 duv1 = dFdx( uv );
  vec2 duv2 = dFdy( uv );
  vec3 dp2perp = cross( dp2, N );
  vec3 dp1perp = cross( N, dp1 );
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float invmax = inversesqrt( max( max( dot( T, T ), dot( B, B ) ), 1e-12 ) );
  return mat3( T * invmax, B * invmax, N );
}
`;

/**
 * Physical lights chunk with an optional wrapped (subsurface-like) diffuse term: light bleeds
 * past the terminator, more in red than in blue, which is what makes skin read as soft flesh
 * instead of painted plastic. Enabled with the SKIN_SSS define + `uSSS` uniform.
 */
export function lightsWithSSS() {
  const src = THREE.ShaderChunk.lights_physical_pars_fragment;
  const line = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
  if (!src.includes(line)) return src; // three changed: fall back to plain lighting
  return src.replace(
    line,
    `#ifdef SKIN_SSS
      float ndlW = dot( geometryNormal, directLight.direction );
      vec3 wrapW = vec3( 0.62, 0.3, 0.2 ) * uSSS;
      vec3 wrapped = clamp( ( vec3( ndlW ) + wrapW ) / ( 1.0 + wrapW ), 0.0, 1.0 );
      // Keep the lit side's energy; only add the scattered rim on the shadow side.
      reflectedLight.directDiffuse += mix( irradiance, wrapped * directLight.color, 0.85 ) * BRDF_Lambert( material.diffuseColor ) * uSSSTint;
    #else
      ${line}
    #endif`,
  );
}

/** Small helper: string-replace an include, throwing early if three renamed it. */
export function patch(src, include, code, where = 'after') {
  const tag = `#include <${include}>`;
  if (!src.includes(tag)) throw new Error(`shader chunk ${include} not found`);
  return src.replace(tag, where === 'after' ? `${tag}\n${code}` : where === 'before' ? `${code}\n${tag}` : code);
}
