// Triplanar texturing: wraps a library material (real wood grain, fabric weave, brushed steel...)
// onto any model, even ones made without texture coordinates (the furniture and car kits are
// flat-coloured, no UVs). The texture is projected from the 3 world axes and blended by the
// surface direction, at real-world scale (material.userData.tileMeters), so a couch is fabric
// at fabric size and a table is wood at wood size.
//
//   const m = triplanar(mat('wood', { color: 0x7b5232 }))   // cached per source material

import * as THREE from 'three';

const cache = new Map();

const VERT_DECL = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNrm;
`;
const VERT_BODY = /* glsl */ `
{
  vec4 triP = vec4( transformed, 1.0 );
  vec3 triN = objectNormal;
  #ifdef USE_INSTANCING
    triP = instanceMatrix * triP;
    triN = mat3( instanceMatrix ) * triN;
  #endif
  vTriPos = ( modelMatrix * triP ).xyz;
  vTriNrm = normalize( mat3( modelMatrix ) * triN );
}
`;
const FRAG_DECL = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNrm;
uniform float uTriScale;
vec3 triW;
vec2 triUX, triUY, triUZ;
void triSetup() {
  vec3 n = abs( normalize( vTriNrm ) );
  triW = pow( n, vec3( 4.0 ) );
  triW /= ( triW.x + triW.y + triW.z );
  vec3 p = vTriPos * uTriScale;
  triUX = p.zy; triUY = p.xz; triUZ = p.xy;
}
vec4 triSample( sampler2D t ) {
  return texture2D( t, triUX ) * triW.x + texture2D( t, triUY ) * triW.y + texture2D( t, triUZ ) * triW.z;
}
`;

function patch(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
    .replace('#include <project_vertex>', `${VERT_BODY}\n#include <project_vertex>`);
  let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_DECL}`);
  fs = fs.replace('#include <map_fragment>', `triSetup();
#ifdef USE_MAP
  diffuseColor *= triSample( map );
#endif`);
  fs = fs.replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  roughnessFactor *= triSample( roughnessMap ).g;
#endif`);
  fs = fs.replace('#include <metalnessmap_fragment>', `float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
  metalnessFactor *= triSample( metalnessMap ).b;
#endif`);
  fs = fs.replace('#include <aomap_fragment>', `#ifdef USE_AOMAP
  float ambientOcclusion = ( triSample( aoMap ).r - 1.0 ) * aoMapIntensity + 1.0;
  reflectedLight.indirectDiffuse *= ambientOcclusion;
  reflectedLight.indirectSpecular *= ambientOcclusion;
#endif`);
  // Normal map: one sample per axis, "whiteout" blend into a world normal, then to view space.
  fs = fs.replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP
  {
    vec3 nW = normalize( vTriNrm );
    vec3 tX = texture2D( normalMap, triUX ).xyz * 2.0 - 1.0;
    vec3 tY = texture2D( normalMap, triUY ).xyz * 2.0 - 1.0;
    vec3 tZ = texture2D( normalMap, triUZ ).xyz * 2.0 - 1.0;
    tX.xy *= normalScale; tY.xy *= normalScale; tZ.xy *= normalScale;
    tX = vec3( tX.xy + nW.zy, abs( tX.z ) * nW.x );
    tY = vec3( tY.xy + nW.xz, abs( tY.z ) * nW.y );
    tZ = vec3( tZ.xy + nW.xy, abs( tZ.z ) * nW.z );
    vec3 wN = normalize( tX.zyx * triW.x + tY.xzy * triW.y + tZ.xyz * triW.z );
    normal = normalize( ( viewMatrix * vec4( wN, 0.0 ) ).xyz );
    #ifdef DOUBLE_SIDED
      normal *= faceDirection;
    #endif
  }
#endif`);
  shader.fragmentShader = fs;
}

/** A triplanar copy of a library material. Shares textures; one shader program for all. */
export function triplanar(src, { scale = 1 } = {}) {
  const key = `${src.uuid}|${scale}`;
  let m = cache.get(key);
  if (m) return m;
  m = src.clone();
  m.name = `${src.name}-tri`;
  const tile = (src.userData.tileMeters || 1) * scale;
  const uniforms = { uTriScale: { value: 1 / tile } };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTriScale = uniforms.uTriScale;
    patch(shader);
  };
  m.customProgramCacheKey = () => 'triplanar-v1';
  m.userData = { ...src.userData, triplanar: true };
  cache.set(key, m);
  return m;
}
