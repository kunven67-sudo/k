// Stars, coronae, black-hole accretion disks, neutron-star beams.
import * as THREE from 'three';
import { NOISE, COLOR, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

const SPHERE_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
${LOGDEPTH_VERT_PARS}
void main() {
  vObj = normalize(position);
  vNormalV = normalize(normalMatrix * vObj);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

// ---------------------------------------------------------------- star surface
const STAR_FRAG = /* glsl */ `
precision highp float;
uniform float uTempK;
uniform float uIntensity;
uniform float uTime;
uniform float uSeed;
uniform float uExposure;
uniform float uDetail;
uniform float uActivity;  // flares & spots (red dwarfs are very active)
uniform float uCut;
uniform vec4 uFlare;      // a flare: object-space direction, strength
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
${LOGDEPTH_FRAG_PARS}
${NOISE}
${COLOR}
void main() {
  ${LOGDEPTH_FRAG}
  if (uCut > 0.5 && vObj.x > 0.0 && vObj.z > 0.0) discard;
  vec3 p = normalize(vObj);
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(-vViewPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  float t = uTime * 0.05;
  vec3 so = vec3(uSeed * 0.013, uSeed * 0.007, uSeed * 0.019);
  // granulation: convection cells boiling on the surface
  float g = 0.0;
  if (uDetail > 0.5) {
    float c1 = 1.0 - abs(snoise(p * 55.0 + so + vec3(0.0, t, 0.0)));
    float c2 = 1.0 - abs(snoise(p * 110.0 + so * 2.0 - vec3(t, 0.0, t)));
    g = c1 * 0.65 + c2 * 0.35;
    g = g * g;
  }
  float sg = snoise(p * 9.0 + so + vec3(t * 0.2)) * 0.5 + 0.5;
  // sunspots live at mid latitudes
  float lat = abs(p.y);
  float spotN = fbm(p * 3.5 + so + vec3(0.0, t * 0.05, 0.0), 4) * 0.5 + 0.5;
  float spots = uActivity < -1.0 ? 0.0 : smoothstep(0.72 - uActivity * 0.06, 0.79, spotN) * smoothstep(0.05, 0.2, lat) * (1.0 - smoothstep(0.45, 0.75, lat));
  float umbra = smoothstep(0.77, 0.81, spotN) * spots;
  // faculae: bright patches near the limb
  float fac = smoothstep(0.55, 0.65, spotN) * (1.0 - spots) * pow(1.0 - mu, 2.0);
  // limb darkening
  float limb = 1.0 - 0.62 * (1.0 - mu) - 0.18 * (1.0 - mu) * (1.0 - mu);
  float T = uTempK * (0.94 + 0.08 * g + 0.03 * sg) * (1.0 - spots * 0.22 - umbra * 0.25) * pow(limb, 0.25);
  // filtered-telescope look: a little extra saturation so the star's colour reads
  vec3 col = blackbody(T);
  col = max(mix(vec3(luma(col)), col, 1.55), 0.0);
  float I = uIntensity * limb * (0.7 + 0.5 * g + 0.1 * sg + fac * 0.5) * (1.0 - spots * 0.55 - umbra * 0.35);
  if (uFlare.w > 0.0) {
    float ang = acos(clamp(dot(p, normalize(uFlare.xyz)), -1.0, 1.0));
    float fl = exp(-pow(ang / 0.09, 2.0)) * (0.7 + 0.3 * snoise(p * 80.0 + vec3(uTime)));
    I *= 1.0 + fl * uFlare.w * 3.0;
    col = mix(col, vec3(1.0), fl * min(uFlare.w, 1.0) * 0.6);
  }
  gl_FragColor = vec4(col * min(I * uExposure, 600.0), 1.0);
}
`;

export function makeStarMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: SPHERE_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: {
      uTempK: { value: 5772 },
      uIntensity: { value: 20 },
      uTime: shared.uTime,
      uSeed: { value: 1 },
      uExposure: shared.uExposure,
      uDetail: { value: 1 },
      uActivity: { value: 0 },
      uCut: { value: 0 },
      uFlare: { value: new THREE.Vector4(0, 1, 0, 0) },
    },
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- glow billboard
// Corona, glare and telescope diffraction spikes (the 6+2 pattern of JWST's mirror)
const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
${LOGDEPTH_VERT_PARS}
uniform float uSize;   // half-size in view units
void main() {
  vUv = position.xy;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

const GLOW_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uCore;      // star radius as a fraction of the billboard half-size
uniform float uSpikes;
uniform float uCorona;
uniform float uHalo;
uniform float uSeed;
uniform float uTime;
uniform float uExposure;
varying vec2 vUv;
${LOGDEPTH_FRAG_PARS}
${NOISE}
float spike(vec2 d, float ang, float width) {
  vec2 dir = vec2(cos(ang), sin(ang));
  float along = abs(dot(d, dir));
  float across = abs(d.x * dir.y - d.y * dir.x);
  return exp(-across / width) * exp(-along * 2.2);
}
void main() {
  ${LOGDEPTH_FRAG}
  float r = length(vUv);
  if (r > 1.0) discard;
  float rs = r / max(uCore, 1e-4);   // in star radii
  float glow = 0.0;
  // tight inner glow around the disk, plus a halo only for small/distant stars
  glow += 0.7 * exp(-max(rs - 1.0, 0.0) * 3.5) / max(rs * rs, 1.0);
  glow += 0.05 * exp(-max(rs - 1.0, 0.0) * 0.6) / max(rs, 1.0);
  glow += uHalo * (0.5 * exp(-r * 9.0) + 0.06 * exp(-r * 3.0));
  // corona streamers
  if (uCorona > 0.0) {
    float ang = atan(vUv.y, vUv.x);
    float st = snoise(vec3(cos(ang) * 3.0, sin(ang) * 3.0, uSeed + uTime * 0.01)) * 0.5 + 0.5;
    float st2 = snoise(vec3(cos(ang) * 9.0, sin(ang) * 9.0, uSeed * 2.0)) * 0.5 + 0.5;
    glow += uCorona * pow(st * 0.7 + st2 * 0.3, 3.0) * exp(-max(rs - 1.0, 0.0) * 1.6) / max(rs, 1.0) * step(1.0, rs);
  }
  float sp = 0.0;
  if (uSpikes > 0.0) {
    for (int i = 0; i < 3; i++) sp += spike(vUv, float(i) * 1.0471976 + 1.5707963, 0.004 + 0.002 * r);
    sp += 0.4 * spike(vUv, 0.0, 0.003);
    sp *= uSpikes;
  }
  float a = (glow + sp) * (1.0 - smoothstep(0.75, 1.0, r));
  gl_FragColor = vec4(uColor * a * min(uIntensity * uExposure, 200.0), 1.0);
}
`;

export function makeGlowMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(1, 0.95, 0.85) },
      uIntensity: { value: 1 },
      uCore: { value: 0.1 },
      uSpikes: { value: 0.5 },
      uCorona: { value: 0.5 },
      uHalo: { value: 1 },
      uSeed: { value: 1 },
      uTime: shared.uTime,
      uSize: { value: 1 },
      uExposure: shared.uExposure,
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- accretion disk
const DISK_VERT = /* glsl */ `
varying vec2 vLocal;
varying vec3 vViewPos;
varying vec3 vTangentV;
${LOGDEPTH_VERT_PARS}
void main() {
  vLocal = position.xy;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  // orbital velocity direction (counter-clockwise in the disk plane)
  vec2 tdir = normalize(vec2(-position.y, position.x));
  vTangentV = normalize(normalMatrix * vec3(tdir, 0.0));
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

const DISK_FRAG = /* glsl */ `
precision highp float;
uniform float uInner;
uniform float uOuter;
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uTempIn;
uniform float uExposure;
uniform float uBeta;     // orbital speed at the inner edge as a fraction of c
uniform float uFeed;     // how much material is falling in right now
varying vec2 vLocal;
varying vec3 vViewPos;
varying vec3 vTangentV;
${LOGDEPTH_FRAG_PARS}
${NOISE}
${COLOR}
void main() {
  ${LOGDEPTH_FRAG}
  float r = length(vLocal);
  if (r < uInner || r > uOuter) discard;
  float x = r / uInner;
  float phi = atan(vLocal.y, vLocal.x);
  // Keplerian shear: inner parts orbit faster
  float omega = pow(x, -1.5);
  float ph = phi - omega * uTime * 0.8;
  vec3 q = vec3(cos(ph) * x, sin(ph) * x, uSeed);
  float n1 = fbm(vec3(log(x) * 6.0, ph * 2.0, uSeed), 5);
  float n2 = snoise(vec3(log(x) * 22.0, ph * 5.0, uSeed + 3.0));
  float streaks = 0.55 + 0.45 * n1 + 0.2 * n2;
  // temperature profile of a thin disk
  float prof = pow(x, -0.75) * pow(max(1.0 - sqrt(1.0 / x), 0.0), 0.25);
  float T = uTempIn * prof * 1.6;
  // Doppler beaming: the side swinging toward you is brighter and bluer
  vec3 V = normalize(-vViewPos);
  float beta = uBeta / sqrt(x);
  float cosT = dot(vTangentV, V);
  float gamma = 1.0 / sqrt(1.0 - beta * beta);
  float D = 1.0 / (gamma * (1.0 - beta * cosT));
  vec3 col = blackbody(T * D);
  float I = uIntensity * pow(prof, 1.5) * pow(D, 3.5) * streaks;
  float edge = (1.0 - smoothstep(uOuter * 0.55, uOuter, r)) * smoothstep(uInner, uInner * 1.15, r);
  float alpha = clamp(edge * (0.4 + 0.6 * streaks) * (0.6 + 0.4 * uFeed), 0.0, 1.0);
  gl_FragColor = vec4(col * I * edge * uExposure, alpha);
}
`;

export function makeDiskMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
    uniforms: {
      uInner: { value: 1 },
      uOuter: { value: 6 },
      uTime: shared.uTime,
      uSeed: { value: 1 },
      uIntensity: { value: 8 },
      uTempIn: { value: 9000 },
      uExposure: shared.uExposure,
      uBeta: { value: 0.45 },
      uFeed: { value: 0.5 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- pulsar beams
const BEAM_VERT = /* glsl */ `
varying vec3 vLocal;
${LOGDEPTH_VERT_PARS}
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;
const BEAM_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uExposure;
varying vec3 vLocal;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  // cone along +y from 0 to 1, radius grows with y
  float y = clamp(vLocal.y + 0.5, 0.0, 1.0);
  float rr = length(vLocal.xz) / max(y * 0.5 + 0.02, 0.02);
  float a = exp(-rr * rr * 3.0) * pow(1.0 - y, 1.6);
  gl_FragColor = vec4(uColor * a * uIntensity * uExposure, 1.0);
}
`;

export function makeBeamMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: BEAM_VERT,
    fragmentShader: BEAM_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(0.55, 0.7, 1.0) },
      uIntensity: { value: 3 },
      uExposure: shared.uExposure,
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------- neutron star surface
const NS_FRAG = /* glsl */ `
precision highp float;
uniform float uIntensity;
uniform float uExposure;
uniform vec3 uMagAxis;  // object space
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
${LOGDEPTH_FRAG_PARS}
${NOISE}
void main() {
  ${LOGDEPTH_FRAG}
  vec3 p = normalize(vObj);
  float mu = clamp(dot(normalize(vNormalV), normalize(-vViewPos)), 0.0, 1.0);
  float cap = pow(abs(dot(p, uMagAxis)), 18.0);
  float n = snoise(p * 12.0 + uTime * 0.2) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.55, 0.68, 1.0), vec3(1.0), cap * 0.8 + n * 0.1);
  float I = uIntensity * (0.6 + 0.4 * mu) * (1.0 + cap * 1.5);
  gl_FragColor = vec4(col * I * uExposure, 1.0);
}
`;

export function makeNeutronMaterial(shared) {
  return new THREE.ShaderMaterial({
    vertexShader: SPHERE_VERT,
    fragmentShader: NS_FRAG,
    uniforms: {
      uIntensity: { value: 4 },
      uExposure: shared.uExposure,
      uMagAxis: { value: new THREE.Vector3(0.4, 0.9, 0).normalize() },
      uTime: shared.uTime,
    },
  });
}
