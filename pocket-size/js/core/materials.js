// Material helpers: world-space UV scaling and a "detail normal" injection so surfaces still look
// crisp when a 1.8cm tall camera is pressed right up against them.
import * as THREE from 'three';

export function scaleUV(geo, sx, sy = sx) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}

// BoxGeometry with UVs in world units (1 texture tile = `tile` units) on every face.
export function worldBox(w, h, d, tile = 100) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z ; 4 verts each
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
  }
  uv.needsUpdate = true;
  return g;
}

export function addDetailNormal(mat, scale = 8, strength = 0.6) {
  if (!mat.normalMap || mat.userData.detail) return mat;
  mat.userData.detail = true;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, r) => {
    if (prev) prev(shader, r);
    const chunk = THREE.ShaderChunk.normal_fragment_maps.replace(
      'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
      `vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
       vec3 detN = texture2D( normalMap, vNormalMapUv * ${scale.toFixed(2)} ).xyz * 2.0 - 1.0;
       mapN = normalize( vec3( mapN.xy + detN.xy * ${strength.toFixed(2)}, mapN.z ) );`,
    );
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', chunk);
  };
  mat.customProgramCacheKey = () => `detail${scale}${strength}`;
  mat.needsUpdate = true;
  return mat;
}

// Adds a subtle vertex-shader wind sway to foliage materials. `uTime` is shared.
export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
export function addWind(mat, strength = 1, heightScale = 10, normalized = false) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    const hExpr = normalized ? 'clamp(position.y, 0.0, 1.2)' : `max(0.0, position.y) / ${heightScale.toFixed(2)}`;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        {
          vec4 wp = modelMatrix * mvPosition;
          float hN = ${hExpr};
          float k = hN * hN * ${strength.toFixed(2)} * uWind;
          float sway = sin(uTime * 1.7 + wp.x * 0.05 + wp.z * 0.04) * 0.6 + sin(uTime * 3.1 + wp.x * 0.13) * 0.25;
          mvPosition.x += sway * k;
          mvPosition.z += cos(uTime * 1.3 + wp.z * 0.06) * 0.4 * k;
        }
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => `wind${strength}${heightScale}${normalized}`;
  return mat;
}

export function setEnvIntensity(root, k) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && 'envMapIntensity' in m && !m.userData.envSet) { m.envMapIntensity = (m.envMapIntensity || 1) * k; m.userData.envSet = true; }
  });
}
