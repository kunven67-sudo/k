// Thin things (spider legs, silk threads, antennae): drawn at least a fraction of a pixel wide.
//
// A cellar spider's leg is 0.12 mm thick and a silk thread 0.003 mm. In real life your eye still sees
// them as faint lines (light gets spread over a whole receptor). On a screen, anything thinner than a
// pixel breaks into flickering dots. So these materials widen themselves to about 0.7 pixel when
// they'd be thinner, and (for see-through ones like silk) get fainter by exactly how much of that
// pixel they really cover. Up close they're their true size.
//
// Works on cylinders built along +Y (segmentGeo, instanced or not): the radius is the local x/z part.
import { addShaderHook } from './materials.js';

export const thinUniforms = { uPixelAngle: { value: 0.002 } };

let installed = false;
export function installThin() {
  if (installed) return;
  installed = true;
  addShaderHook((shader, m) => {
    if (!m.userData.thin) return;
    shader.uniforms.uPixelAngle = thinUniforms.uPixelAngle;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPixelAngle;\nvarying float vThinCover;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          mat4 tm = modelMatrix;
          #ifdef USE_INSTANCING
            tm = modelMatrix * instanceMatrix;
          #endif
          float sx = length( tm[ 0 ].xyz );
          vec3 axisW = ( tm * vec4( 0.0, transformed.y, 0.0, 1.0 ) ).xyz;
          float rw = length( transformed.xz ) * sx;
          float need = distance( axisW, cameraPosition ) * uPixelAngle * 0.55;
          float k = rw > 0.0 ? max( 1.0, need / rw ) : 1.0;
          transformed.xz *= k;
          vThinCover = 1.0 / k;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vThinCover;')
      .replace('#include <opaque_fragment>', `${m.transparent ? `diffuseColor.a *= max(vThinCover, ${(m.userData.thinMin ?? 0).toFixed(3)});\n` : ''}#include <opaque_fragment>`);
  });
}

// Mark a material as thin (call once, before it's first drawn).
// minAlpha: see-through thin things never fade below this (silk still glints when it's far away).
export function makeThin(m, { minAlpha = 0 } = {}) {
  m.userData.thin = true;
  m.userData.thinMin = minAlpha;
  m.userData.cacheKey = (m.userData.cacheKey || '') + '|thin' + minAlpha;
  m.needsUpdate = true;
  return m;
}

// Each frame: how big one pixel is, as an angle.
export function updateThin(camera, heightPx) {
  thinUniforms.uPixelAngle.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, heightPx);
}
