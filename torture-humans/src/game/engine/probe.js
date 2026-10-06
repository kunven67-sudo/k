// Reflection probe: a 360° snapshot of the surroundings that every shiny thing
// (water, glass, metal, wet floors) reflects, and that also gives soft bounced
// light. Indoors there's no sky to reflect, so without this, water looks like paint.
import * as THREE from 'three';

// assign=false: just return the snapshot (the caller decides when to use it)
export function bakeEnvironment(renderer, scene, position, { size = 256, near = 0.05, far = 60, intensity = 0.7, assign = true, previous = null } = {}) {
  const target = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cam = new THREE.CubeCamera(near, far, target);
  cam.position.copy(position);
  const prevEnv = scene.environment;
  const prevBg = scene.background;
  scene.environment = null; // don't reflect the old reflection into the new one
  if (!assign) scene.background = null;
  scene.add(cam);
  cam.update(renderer, scene);
  scene.remove(cam);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(target.texture).texture;
  pmrem.dispose();
  target.dispose();
  if (!assign) {
    scene.environment = prevEnv === previous ? env : prevEnv;
    scene.background = prevBg;
    previous?.dispose?.();
    return env;
  }
  prevEnv?.dispose?.();
  scene.environment = env;
  scene.environmentIntensity = intensity;
  return env;
}
