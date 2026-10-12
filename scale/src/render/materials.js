// Material registry. Every material the world uses goes through prep() so the lighting system
// (cascaded shadows) and our own shader tweaks get applied the same way everywhere.
import * as THREE from 'three';

const registry = new Set();
let csm = null;
const hooks = []; // (shader, material) => void, applied to every registered material

export function setCSM(c) {
  csm = c;
  for (const m of registry) apply(m);
}

export function addShaderHook(fn) {
  hooks.push(fn);
  for (const m of registry) apply(m);
}

function apply(m) {
  m.defines = m.defines || {};
  if (csm) {
    m.defines.USE_CSM = 1;
    m.defines.CSM_CASCADES = csm.cascades;
    if (csm.fade) m.defines.CSM_FADE = '';
    else delete m.defines.CSM_FADE;
  } else {
    delete m.defines.USE_CSM;
    delete m.defines.CSM_CASCADES;
    delete m.defines.CSM_FADE;
  }
  m.onBeforeCompile = (shader, renderer) => {
    if (csm) {
      const breaks = [];
      csm._getExtendedBreaks(breaks);
      shader.uniforms.CSM_cascades = { value: breaks };
      shader.uniforms.cameraNear = { value: csm.camera.near };
      shader.uniforms.shadowFar = { value: Math.min(csm.camera.far, csm.maxFar) };
      csm.shaders.set(m, shader);
    }
    for (const h of hooks) h(shader, m);
    m.userData.onCompile?.(shader, m, renderer); // read late: callers may set it after prep()
  };
  m.customProgramCacheKey = () => `${csm ? 'csm' + csm.cascades : 'nocsm'}|${m.userData.detail || ''}|${m.userData.cacheKey || ''}`;
  m.needsUpdate = true;
}

export function prep(m, { indoor = false, detail = null } = {}) {
  if (detail) m.userData.detail = detail;
  if (registry.has(m)) return m;
  if (indoor && m.envMapIntensity !== undefined) m.envMapIntensity = (m.userData.envBase ?? m.envMapIntensity) * 0.7;
  registry.add(m);
  apply(m);
  return m;
}

export function release(m) {
  registry.delete(m);
  if (csm) csm.shaders.delete(m);
  m.dispose();
}

// Standard PBR material, registered.
export function std(params = {}, opts = {}) {
  return prep(new THREE.MeshStandardMaterial(params), opts);
}

export function phys(params = {}, opts = {}) {
  return prep(new THREE.MeshPhysicalMaterial(params), opts);
}
