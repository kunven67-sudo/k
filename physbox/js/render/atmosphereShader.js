// Shared atmosphere uniforms + GLSL so the sky, terrain, ocean and props all see the same air.
// Positions in shaders are camera-relative (the camera sits at the origin of render space).
// OWNER: render module. This is the agreed interface; the implementation may be upgraded
// (better scattering) but the uniform names and GLSL function signatures must stay the same.
import * as THREE from 'three';

export const atmosUniforms = {
  uSunDir: { value: new THREE.Vector3(0, 0, 1) }, // unit vector toward the Sun (render axes)
  uSunColor: { value: new THREE.Color(1, 1, 1) }, // sun colour above the atmosphere (linear)
  uPlanetCenter: { value: new THREE.Vector3(0, 0, -6371000) }, // camera-relative planet centre
  uPlanetRadius: { value: 6371000 },
  uAtmoHeight: { value: 100000 },
  uRayleigh: { value: new THREE.Vector3(5.802e-6, 13.558e-6, 33.1e-6) },
  uMie: { value: 3.996e-6 },
  uMieG: { value: 0.8 },
  uRayleighH: { value: 8500 },
  uMieH: { value: 1200 },
  uSunIntensity: { value: 22 },
  uHasAtmo: { value: 1 },
  uFogDensity: { value: 0 }, // extra haze/dust (weather, impact winter), 1/m
  uFogColor: { value: new THREE.Color(0.6, 0.65, 0.7) },
};

// Declarations + functions. Include once per shader (after any #include <common>).
//   vec3 atmosAerial(vec3 color, vec3 posRel)   — colour of a surface point seen through the air
//   vec3 atmosSunAt(vec3 posRel)                 — sunlight reaching a point (after extinction)
//   float atmosHeight(vec3 posRel)               — altitude of a point above the planet radius
export const ATMOS_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uPlanetCenter;
uniform float uPlanetRadius;
uniform float uAtmoHeight;
uniform vec3 uRayleigh;
uniform float uMie;
uniform float uMieG;
uniform float uRayleighH;
uniform float uMieH;
uniform float uSunIntensity;
uniform float uHasAtmo;
uniform float uFogDensity;
uniform vec3 uFogColor;

float atmosHeight(vec3 p) { return length(p - uPlanetCenter) - uPlanetRadius; }

// optical depth along a straight segment, few samples (cheap enough for a GT 130)
vec2 atmosDepth(vec3 a, vec3 b) {
  vec2 od = vec2(0.0);
  const int N = 4;
  vec3 st = (b - a) / float(N);
  float ds = length(st);
  for (int i = 0; i < N; i++) {
    float h = max(atmosHeight(a + st * (float(i) + 0.5)), 0.0);
    od += vec2(exp(-h / uRayleighH), exp(-h / uMieH)) * ds;
  }
  return od;
}

vec3 atmosSunAt(vec3 p) {
  if (uHasAtmo < 0.5) return uSunColor;
  // march toward the sun to the top of the atmosphere (approximate with a fixed length)
  float h = max(atmosHeight(p), 0.0);
  vec3 up = normalize(p - uPlanetCenter);
  float mu = dot(up, uSunDir);
  // below the horizon: the planet blocks the sun
  float horizon = smoothstep(-0.02, 0.02, mu + 0.012 * sqrt(max(h, 0.0) / 10000.0));
  float L = min(uAtmoHeight * 4.0, (uAtmoHeight - h) / max(mu, 0.035));
  vec2 od = atmosDepth(p, p + uSunDir * L);
  vec3 tau = uRayleigh * od.x + vec3(uMie * 1.1) * od.y;
  return uSunColor * exp(-tau) * horizon;
}

vec3 atmosAerial(vec3 color, vec3 p) {
  if (uHasAtmo < 0.5) return color;
  vec2 od = atmosDepth(vec3(0.0), p);
  vec3 tau = uRayleigh * od.x + vec3(uMie * 1.1) * od.y;
  vec3 ext = exp(-tau);
  float mu = dot(normalize(p + 1e-6), uSunDir);
  float pr = 0.0596831 * (1.0 + mu * mu);
  float g2 = uMieG * uMieG;
  float pm = 0.1193662 * (1.0 - g2) * (1.0 + mu * mu) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * uMieG * mu, 1e-4), 1.5));
  vec3 sun = atmosSunAt(p * 0.5) * uSunIntensity;
  vec3 inscatter = sun * (uRayleigh * od.x * pr + vec3(uMie) * od.y * pm) * (1.0 - ext) / max(tau, vec3(1e-6));
  vec3 c = color * ext + inscatter;
  float fog = 1.0 - exp(-uFogDensity * length(p));
  float sunUp = dot(normalize(-uPlanetCenter), uSunDir);
  return mix(c, uFogColor * (0.25 + 0.75 * max(sunUp, 0.0)), fog);
}
`;
