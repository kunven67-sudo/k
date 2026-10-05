// Sneakers: the upper is cut from the bodysuit's feet (so it fits every foot), smoothed so the toes
// don't show, then given a flat rubber sole with tread. The body stands on the sole (SOLE_H).
import * as THREE from 'three';
import { garmentGeometry } from './clothes.js';
import { NOISE_GLSL } from './skin.js';

export const SOLE_H = 0.026; // model units (2.6 cm on a 1.75 m body)

export function shoeGeometry(shape) {
  const g = garmentGeometry(shape, 'shoe');
  const p = g.attributes.position, n = g.attributes.normal;
  let minY = Infinity; for (let i = 0; i < p.count; i++) minY = Math.min(minY, p.getY(i));
  // bottom of the foot -> flat sole on the floor, a little wider than the foot
  const sole = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), ny = n.getY(i);
    const low = THREE.MathUtils.smoothstep(minY + 0.03 - y, 0, 0.03); // 1 at the very bottom
    if (ny < -0.2 || low > 0.6) {
      const k = THREE.MathUtils.smoothstep(-ny, 0.2, 0.7);
      p.setY(i, THREE.MathUtils.lerp(y, -SOLE_H, k));
      p.setX(i, p.getX(i) + n.getX(i) * 0.004 * k); p.setZ(i, p.getZ(i) + n.getZ(i) * 0.004 * k);
    }
  }
  for (let i = 0; i < p.count; i++) sole[i] = 1 - THREE.MathUtils.smoothstep(p.getY(i), -SOLE_H + 0.012, -SOLE_H + 0.03);
  g.setAttribute('aSole', new THREE.BufferAttribute(sole, 1));
  g.computeVertexNormals();
  return g;
}

export function createShoeMaterial(color) {
  const c = new THREE.Color(color);
  const mat = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.4 });
  const u = mat.userData.u = { uObjScaleF: { value: 1 } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute float aSole; varying float vSole; varying vec3 vShoeP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSole = aSole; vShoeP = position;');
    sh.fragmentShader = `varying float vSole; varying vec3 vShoeP; uniform float uObjScaleF;\n${NOISE_GLSL}\nfloat gShoeH; float gShoeS;\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        float s = smoothstep(0.35, 0.65, vSole);
        // white rubber midsole with a thin dark stripe, the upper in the shoe color with a canvas weave
        vec3 rub = vec3(0.86, 0.85, 0.82) * (0.95 + 0.06 * sk_vnoise(vShoeP * 800.0));
        float stripe = smoothstep(0.02, 0.0, abs(vSole - 0.42)) * 0.6;
        float weave = sk_vnoise(vShoeP * 2600.0);
        diffuseColor.rgb = mix(diffuseColor.rgb * (0.92 + 0.1 * weave), rub, s);
        diffuseColor.rgb *= 1.0 - stripe * 0.5;
        gShoeH = mix(weave * 0.00008, 0.0, s) + s * step(0.97, vSole) * (0.5 + 0.5 * sin(vShoeP.x * 900.0) * sin(vShoeP.z * 900.0)) * 0.0004;
        gShoeS = s;
      }`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = sk_bump(-vViewPosition, normal, gShoeH * uObjScaleF);\nroughnessFactor = mix(roughnessFactor, 0.85, gShoeS);');
  };
  mat.customProgramCacheKey = () => 'mh-shoe-1';
  return mat;
}
