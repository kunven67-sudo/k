// The cutaway: a wedge removed from your world so you can see its layers,
// glowing with their real temperatures, slowly churning where they flow.
import * as THREE from 'three';
import { NOISE, COLOR, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';
import { blackbody } from '../core/phys.js';

const MAXL = 12;

const VERT = /* glsl */ `
varying vec2 vP;
varying vec3 vNormalV;
${LOGDEPTH_VERT_PARS}
void main() {
  vP = position.xy;
  vNormalV = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH_VERT}
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uR[${MAXL}];
uniform vec3 uC[${MAXL}];
uniform vec3 uE[${MAXL}];
uniform float uFlow[${MAXL}];
uniform int uN;
uniform float uTime;
uniform float uProbe;
uniform float uSeed;
uniform vec3 uL0dir;
uniform vec3 uL0col;
uniform float uExposure;
uniform float uSelf;
varying vec2 vP;
varying vec3 vNormalV;
${LOGDEPTH_FRAG_PARS}
${NOISE}
${COLOR}
void main() {
  ${LOGDEPTH_FRAG}
  float r = length(vP);
  if (r > 1.0) discard;
  vec3 col = uC[0];
  vec3 emit = uE[0];
  float flow = uFlow[0];
  float r0 = 0.0, r1 = uR[0];
  for (int i = 0; i < ${MAXL}; i++) {
    if (i >= uN) break;
    if (r <= uR[i]) { col = uC[i]; emit = uE[i]; flow = uFlow[i]; r1 = uR[i]; break; }
    r0 = uR[i];
  }
  // churning in fluid layers: convection cells rising and sinking
  float ang = atan(vP.y, vP.x);
  float tt = uTime * 0.08;
  float n = snoise(vec3(ang * 3.0 + tt, r * 9.0 - tt * 0.7, uSeed));
  float cell = snoise(vec3(vP * 7.0, tt + uSeed));
  float churn = flow * (0.18 * n + 0.12 * cell);
  col *= 1.0 + churn;
  emit *= 1.0 + churn * 2.0;
  // a thin dark line between layers
  float edge = min(abs(r - r1), abs(r - r0));
  col *= mix(0.55, 1.0, smoothstep(0.0, 0.006, edge));
  float nl = max(dot(normalize(vNormalV), uL0dir), 0.0);
  vec3 lit = col * (0.08 + 0.5 * nl) * min(uL0col, vec3(1.2)) + col * uSelf;
  // the depth probe
  float pr = uProbe < 0.0 ? 1.0 : smoothstep(0.002, 0.008, abs(r - uProbe));
  vec3 outc = lit + emit;
  outc = mix(vec3(0.55, 0.78, 1.0) * 2.0, outc, pr);
  gl_FragColor = vec4(outc * uExposure, 1.0);
}
`;

function halfDisk() {
  // a half disk (y from -1 to 1, x >= 0) made of rings so the edge is round
  const g = new THREE.CircleGeometry(1, 128, -Math.PI / 2, Math.PI);
  return g;
}

export class Cutaway {
  constructor(shared) {
    this.group = new THREE.Group();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uR: { value: new Array(MAXL).fill(1) },
        uC: { value: Array.from({ length: MAXL }, () => new THREE.Color()) },
        uE: { value: Array.from({ length: MAXL }, () => new THREE.Color(0, 0, 0)) },
        uFlow: { value: new Array(MAXL).fill(0) },
        uN: { value: 1 },
        uTime: shared.uTime,
        uProbe: { value: -1 },
        uSeed: { value: 1 },
        uL0dir: { value: new THREE.Vector3(1, 0, 0) },
        uL0col: { value: new THREE.Color(1, 1, 1) },
        uExposure: shared.uExposure,
        uSelf: { value: 0.15 },
      },
      side: THREE.DoubleSide,
    });
    const geo = halfDisk();
    // face 1: the x = 0 plane, on the z > 0 side
    const a = new THREE.Mesh(geo, this.mat);
    a.rotation.y = -Math.PI / 2;
    // face 2: the z = 0 plane, on the x > 0 side
    const b = new THREE.Mesh(geo, this.mat);
    this.group.add(a, b);
    this.group.traverse((o) => { o.frustumCulled = false; });
    this.group.visible = false;
  }

  // struct: from structureOf(); temps: temperature (K) of each layer
  setLayers(struct, temps, seed) {
    const u = this.mat.uniforms;
    const L = struct.layers.slice(0, MAXL);
    u.uN.value = L.length;
    L.forEach((l, i) => {
      u.uR.value[i] = l.r1;
      u.uC.value[i].setRGB(l.color[0], l.color[1], l.color[2]);
      const T = temps[i] || 0;
      // hot rock and metal glow by their own heat
      const k = Math.min(1, Math.max(0, (T - 900) / 2500));
      const bb = blackbody(Math.min(Math.max(T, 1000), 40000));
      const e = k * k * (struct.kind === 'star' ? 2.5 : 0.4);
      u.uE.value[i].setRGB(bb[0] * e, bb[1] * e, bb[2] * e);
      u.uFlow.value[i] = /convect|magma|Liquid|outer|metal|Molecular|envelope|mantle|Ocean|fusion|Fusion/i.test(l.name) ? 1 : 0.15;
    });
    u.uSeed.value = (seed % 97) + 0.5;
    u.uSelf.value = struct.kind === 'star' ? 1 : 0.12;
  }
}
