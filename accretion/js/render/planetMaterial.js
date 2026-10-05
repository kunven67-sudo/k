// The planet surface shader: rocky, icy, molten, metal, Earth-like, gas and ice giants,
// hot Jupiters and brown dwarfs. Lighting uses a lunar-style model for airless rock
// and a soft terminator for worlds with air.
import * as THREE from 'three';
import { NOISE, COLOR, LOGDEPTH_VERT_PARS, LOGDEPTH_VERT, LOGDEPTH_FRAG_PARS, LOGDEPTH_FRAG } from './glsl.js';

export const PTYPE = {
  rocky: 0, icy: 1, lava: 2, metal: 3, gasgiant: 4, icegiant: 5, hotjupiter: 6, browndwarf: 7,
};

const VERT = /* glsl */ `
uniform float uLumpy;
uniform float uSeed;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
${LOGDEPTH_VERT_PARS}
${NOISE}

float lump(vec3 p) {
  vec3 o = vec3(uSeed * 0.011, uSeed * 0.007, uSeed * 0.013);
  float h = snoise(p * 0.9 + o) * 0.55 + snoise(p * 1.9 + o * 2.0) * 0.28 + snoise(p * 4.1 + o * 3.0) * 0.12;
  return h;
}

vec3 displaced(vec3 p) {
  return p * (1.0 + uLumpy * lump(p));
}

void main() {
  vec3 p = normalize(position);
  vec3 pos = p;
  vec3 n = p;
  if (uLumpy > 0.002) {
    pos = displaced(p);
    vec3 t1 = normalize(cross(p, abs(p.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(p, t1);
    float e = 0.01;
    vec3 a = displaced(normalize(p + t1 * e));
    vec3 b = displaced(normalize(p + t2 * e));
    n = normalize(cross(a - pos, b - pos));
    if (dot(n, p) < 0.0) n = -n;
  }
  vObj = p;
  vNormalV = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform samplerCube uSurf;
uniform mat3 normalMatrix;
uniform int uType;
uniform float uSeed;
uniform float uTime;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform float uOcean;      // 0..1 how much of the surface is under water
uniform float uIceCap;     // 0..1 polar ice
uniform float uLife;       // 0, 1 living, 2 cities (other worlds)
uniform float uGreen;      // 0..1 plant cover on land
uniform float uCity;       // 0..1 city lights
uniform float uDrift;      // continental drift phase (supercontinent cycle)
uniform float uAurora;     // 0..1 aurora strength
uniform float uVolcano;    // 0..1 active volcanoes glowing on the night side
uniform vec4 uHits[6];     // impact sites: object-space direction, age in seconds (<0 unused)
uniform vec2 uHitSize[6];  // angular size (rad), strength
uniform vec4 uOcc[2];      // eclipsing bodies: view-space centre, radius
uniform float uCut;        // 1 = cutaway: a wedge is removed
uniform float uClose;      // >0 in close-up views: planet radius in view units
uniform float uHeat;       // 0..1 molten glow
uniform float uDamage;     // 0..1 glowing cracks
uniform float uCraters;    // crater visibility
uniform float uRelief;     // bump strength
uniform float uTempK;      // surface temperature (for glow colour)
uniform vec4 uAtmo;        // rgb tint, strength of haze over the surface
uniform vec3 uL0dir; uniform vec3 uL0col;
uniform vec3 uL1dir; uniform vec3 uL1col;
uniform float uAmbient;
uniform float uExposure;
uniform float uEmissive;   // self-glow (brown dwarfs)
uniform float uDetail;     // 0 cheap, 1 full
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
${LOGDEPTH_FRAG_PARS}
${NOISE}
${COLOR}

// plates move back and forth over hundreds of millions of years (the supercontinent cycle)
vec3 drifted(vec3 p) {
  if (uDrift == 0.0) return p;
  float n = snoise(p * 1.1 + vec3(uSeed * 0.013));
  float a = sin(uDrift + n * 2.2) * 0.32 * smoothstep(-0.6, 0.4, n);
  float c = cos(a), s = sin(a);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}
vec4 surf(vec3 p) { return textureCube(uSurf, drifted(p)); }
float gFw = 1.0; // screen footprint of a fragment on the unit sphere (small = close up)

// how much of light 0 reaches this point past any eclipsing moon
float eclipse(vec3 posV, vec3 L) {
  float sh = 1.0;
  for (int i = 0; i < 2; i++) {
    vec4 o = uOcc[i];
    if (o.w <= 0.0) continue;
    vec3 oc = o.xyz - posV;
    float t = dot(oc, L);
    if (t <= 0.0) continue;
    float d = length(oc - L * t);
    // penumbra widens with distance from the eclipsing body (the star is not a point)
    float pen = o.w * 0.12 + t * 0.006;
    sh *= mix(0.04, 1.0, smoothstep(o.w - pen, o.w + pen, d));
  }
  return sh;
}

float elevation(vec4 s) {
  float t = s.r * 2.0 - 1.0;
  float c = (s.g * 2.0 - 1.0) * uCraters;
  return t + c * 1.6;
}

// lunar (Lommel-Seeliger) mixed with Lambert: airless rock looks flat-lit like the Moon
float shadeAirless(float nl, float nv) {
  float ls = min(nl / max(nl + nv, 1e-3) * 2.0, 1.15);
  return mix(nl, ls, 0.45) * step(0.0, nl);
}

vec3 rockyAlbedo(vec4 s, vec3 p, float elev, out float spec, out vec3 emit) {
  spec = 0.0;
  emit = vec3(0.0);
  float region = s.b;
  float lines = s.a;
  float crat = s.g * 2.0 - 1.0;
  vec3 col;
  if (uType == 1) {
    // ice: bright with brownish lineae (like Europa) and blue-white crater floors
    col = mix(uColA, uColB, smoothstep(0.35, 0.7, region));
    col = mix(col, uColC, lines * 0.85);
    col *= 0.9 + 0.2 * smoothstep(-0.1, 0.2, crat);
    spec = 0.15;
  } else if (uType == 3) {
    col = mix(uColA, uColB, smoothstep(0.3, 0.75, region));
    col *= 0.85 + 0.3 * smoothstep(-0.2, 0.3, crat);
    spec = 0.45;
  } else {
    // basalt plains vs bright highlands, fresh crater rims are brighter
    col = mix(uColA, uColB, smoothstep(0.38, 0.62, region + elev * 0.12));
    col = mix(col, uColC, smoothstep(0.55, 0.9, s.r) * 0.6);
    col *= 0.88 + 0.35 * smoothstep(0.02, 0.25, crat);
  }

  float lat = abs(p.y);
  if (uOcean > 0.001) {
    // sea level chosen so roughly uOcean of the surface is under water
    float sea = mix(-0.35, 0.25, uOcean);
    float e = s.r * 2.0 - 1.0 + (s.g * 2.0 - 1.0) * uCraters * 0.4;
    if (e < sea) {
      float depth = clamp((sea - e) * 3.0, 0.0, 1.0);
      col = mix(vec3(0.012, 0.06, 0.09), vec3(0.002, 0.012, 0.05), depth);
      col = mix(col, vec3(0.03, 0.12, 0.13), (1.0 - depth) * 0.6 * (1.0 - smoothstep(0.0, 0.08, sea - e)));
      spec = 1.0;
    } else {
      float moist = region;
      float h = clamp((e - sea) * 2.2, 0.0, 1.0);
      vec3 land;
      float green = max(uGreen, uLife > 0.5 ? 0.85 : 0.0);
      vec3 bare = mix(uColA, uColB, smoothstep(0.35, 0.7, moist));
      bare = mix(bare, uColC, smoothstep(0.4, 0.9, h) * 0.5);
      if (green > 0.01) {
        vec3 forest = vec3(0.03, 0.075, 0.022);
        vec3 grass = vec3(0.085, 0.12, 0.04);
        vec3 desert = vec3(0.32, 0.24, 0.14);
        float dry = smoothstep(0.42, 0.62, 1.0 - moist + (0.35 - abs(lat - 0.3)) * 0.4);
        land = mix(mix(forest, grass, smoothstep(0.4, 0.6, moist)), desert, dry);
        land = mix(land, vec3(0.16, 0.14, 0.12), smoothstep(0.35, 0.75, h));
        // plants spread from the wettest lowlands as cover grows
        float spread = smoothstep(1.0 - green, 1.0 - green + 0.25, moist * 0.7 + (1.0 - h) * 0.3 + 0.15);
        land = mix(bare, land, spread);
      } else {
        land = bare;
      }
      col = land;
    }
  }
  // fine detail up close, where the baked map runs out of pixels
  float near = 1.0 - smoothstep(0.0003, 0.003, gFw);
  if (near > 0.0) {
    float dn = snoise(p * 900.0 + uSeed) * 0.5 + snoise(p * 2700.0 - uSeed) * 0.3 + snoise(p * 8100.0) * 0.2;
    col *= 1.0 + dn * 0.22 * near;
  }
  // polar caps and snow on high ground
  float capEdge = 1.0 - uIceCap * 0.55;
  float n2 = snoise(p * 7.0 + uSeed) * 0.05;
  float ice = smoothstep(capEdge - 0.04, capEdge + 0.04, lat + n2);
  if (uOcean > 0.001) ice = max(ice, smoothstep(0.55, 0.75, s.r) * uIceCap * 1.5);
  col = mix(col, vec3(0.82, 0.86, 0.9), clamp(ice, 0.0, 1.0));

  // molten surface: glowing lava between dark crust plates
  if (uHeat > 0.001 || uType == 2) {
    float heat = uType == 2 ? max(uHeat, 0.65) : uHeat;
    float flowN = snoise(p * 9.0 + vec3(0.0, uTime * 0.03, 0.0)) * 0.5 + 0.5;
    float crack = max(lines, smoothstep(0.62, 0.95, flowN) * 0.6);
    float melt = crack * 0.75 + (1.0 - s.r) * 0.45;
    float molten = smoothstep(1.02 - heat * 0.65, 1.2 - heat * 0.65, melt);
    float T = mix(950.0, 1550.0, molten * (0.6 + 0.4 * flowN));
    emit += blackbody(T) * molten * (0.6 + heat) * 1.1;
    col = mix(col, vec3(0.03, 0.026, 0.022), heat * 0.7);
  }
  // fresh impact sites glow and cool; giant impacts send a shock ring around the world
  for (int i = 0; i < 6; i++) {
    vec4 hit = uHits[i];
    if (hit.w < 0.0) continue;
    float ang = acos(clamp(dot(p, hit.xyz), -1.0, 1.0));
    float size = uHitSize[i].x, k = uHitSize[i].y;
    float cool = exp(-hit.w / (6.0 + 10.0 * k));
    float n = snoise(p * 40.0 + hit.xyz * 7.0) * 0.5 + 0.5;
    float crater = exp(-pow(ang / size, 2.0) * 2.0) * (0.55 + 0.45 * n);
    float T = mix(900.0, 2200.0, cool * crater);
    emit += blackbody(T) * crater * cool * (1.5 + 2.5 * k);
    col = mix(col, vec3(0.03, 0.025, 0.02), crater * 0.6);
    float rr = size + hit.w * (0.25 + 0.35 * k);
    float ring = exp(-pow((ang - rr) / (0.03 + 0.02 * k), 2.0)) * exp(-hit.w / 2.5) * k;
    emit += vec3(1.0, 0.55, 0.25) * ring * 2.0;
  }
  // damage: cracks glowing where the crust has been broken
  if (uDamage > 0.001) {
    float c = smoothstep(1.0 - uDamage, 1.0, lines);
    emit += vec3(1.0, 0.33, 0.07) * c * 3.0 * uDamage;
  }
  return col;
}

// gas giant clouds: zones and belts sheared by jets, storms, turbulence
vec3 gasColor(vec3 p, out float emissive) {
  emissive = 0.0;
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.z, p.x);
  // differential rotation: alternating jets drag the pattern along
  float jet = sin(lat * 9.0 + uSeed) * 0.5;
  float t = uTime * 0.02;
  vec3 q = vec3(cos(lon + jet * t), p.y * 1.0, sin(lon + jet * t));
  vec3 so = vec3(uSeed * 0.01, uSeed * 0.02, 0.0);
  float turb = fbm(q * vec3(2.0, 7.0, 2.0) + so, uDetail > 0.5 ? 6 : 3);
  float warpLat = lat + turb * 0.07 + snoise(q * 3.0 + so) * 0.03;
  float bandFreq = uType == 5 ? 6.0 : 13.0;
  float bands = sin(warpLat * bandFreq + uSeed * 0.7) * 0.5 + 0.5;
  float bands2 = sin(warpLat * bandFreq * 2.3 + uSeed) * 0.5 + 0.5;
  float bandK = uType == 5 ? 0.35 : 1.0;
  vec3 col = mix(uColA, uColB, smoothstep(0.25, 0.75, bands) * bandK);
  col = mix(col, uColC, smoothstep(0.55, 0.95, bands2) * 0.55 * bandK);
  // fine streaks
  float streak = fbm(q * vec3(1.5, 30.0, 1.5) + so * 3.0, uDetail > 0.5 ? 4 : 2);
  col *= uType == 5 ? 0.97 + 0.06 * streak : 0.9 + 0.2 * streak;
  // a large oval storm
  float sLat = sin(uSeed) * 0.45;
  float sLon = uSeed * 1.7 + t * 0.4;
  vec2 d = vec2(atan(sin(lon - sLon), cos(lon - sLon)) * 0.55, lat - sLat);
  float r = length(d * vec2(1.0, 2.2));
  float storm = (1.0 - smoothstep(0.05, 0.16, r));
  float swirl = snoise(vec3(d * 22.0, uSeed) + vec3(0.0, 0.0, atan(d.y, d.x) * 0.6));
  vec3 stormCol = uType == 5 ? vec3(0.02, 0.04, 0.1) : mix(vec3(0.42, 0.12, 0.05), vec3(0.6, 0.35, 0.22), swirl * 0.5 + 0.5);
  col = mix(col, stormCol, storm * 0.85);
  // poles: darker, hazy
  col *= mix(1.0, 0.7, smoothstep(0.6, 1.3, abs(lat)));
  if (uType == 7) {
    // brown dwarf: hot glowing layers seen through dark cloud gaps
    float gaps = smoothstep(0.35, 0.75, turb * 0.5 + 0.5 + bands * 0.2);
    emissive = mix(0.25, 1.0, gaps);
  }
  if (uType == 6) {
    emissive = 0.35 * (0.6 + 0.4 * bands);
  }
  return col;
}

void main() {
  ${LOGDEPTH_FRAG}
  if (uCut > 0.5 && vObj.x > 0.0 && vObj.z > 0.0) discard;
  vec3 p = normalize(vObj);
  gFw = length(fwidth(p));
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(-vViewPos);
  bool gas = uType >= 4;
  vec3 albedo;
  float spec = 0.0;
  vec3 emit = vec3(0.0);
  float selfGlow = 0.0;

  if (!gas) {
    vec4 s = surf(p);
    float e0 = elevation(s);
    // bump from the baked heights
    vec3 t1 = normalize(cross(p, abs(p.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(p, t1);
    float eps = 0.0035;
    float e1 = elevation(surf(normalize(p + t1 * eps)));
    float e2 = elevation(surf(normalize(p + t2 * eps)));
    // flatten the bump under water
    float k = uRelief;
    if (uOcean > 0.001) {
      float sea = mix(-0.35, 0.25, uOcean);
      if (s.r * 2.0 - 1.0 < sea) k *= 0.05;
    }
    vec3 g = ((e1 - e0) * t1 + (e2 - e0) * t2) / eps;
    vec3 bump = normalMatrix * (-g * k * 0.012);
    N = normalize(N + bump);
    albedo = rockyAlbedo(s, p, e0, spec, emit);
  } else {
    albedo = gasColor(p, selfGlow);
  }

  float nv = clamp(dot(N, V), 0.0, 1.0);
  vec3 col = vec3(0.0);
  vec3 Ld[2]; Ld[0] = uL0dir; Ld[1] = uL1dir;
  vec3 Lc[2]; Lc[0] = uL0col; Lc[1] = uL1col;
  float ecl = eclipse(vViewPos, uL0dir);
  for (int i = 0; i < 2; i++) {
    vec3 L = Ld[i];
    float nl = dot(N, L);
    float diff;
    if (gas || uAtmo.a > 0.05) {
      // soft terminator for worlds with air
      diff = clamp((nl + 0.08) / 1.08, 0.0, 1.0);
      diff *= diff * (3.0 - 2.0 * diff) * 0.7 + 0.3 * clamp(nl, 0.0, 1.0);
    } else {
      diff = shadeAirless(clamp(nl, 0.0, 1.0), nv);
    }
    vec3 c = albedo * diff;
    if (spec > 0.0 && nl > 0.0) {
      vec3 H = normalize(L + V);
      float sp = pow(clamp(dot(N, H), 0.0, 1.0), spec > 0.9 ? 180.0 : 40.0);
      float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);
      c += vec3(sp) * spec * (0.25 + fres) * (spec > 0.9 ? 1.6 : 0.4);
    }
    col += c * Lc[i] * (i == 0 ? ecl : 1.0);
  }
  col += albedo * uAmbient;

  // limb darkening on giants
  if (gas) col *= mix(0.55, 1.0, pow(nv, 0.35));

  // haze over the surface for worlds with atmospheres
  if (uAtmo.a > 0.001) {
    float sunF = clamp(dot(normalize(vNormalV), uL0dir) * 0.6 + 0.4, 0.0, 1.0);
    float haze = pow(1.0 - nv, 3.0) * uAtmo.a;
    if (uClose > 0.0) haze = (1.0 - exp(-length(vViewPos) / (uClose * 0.12))) * uAtmo.a * 1.2;
    col = mix(col, uAtmo.rgb * uL0col * sunF, clamp(haze, 0.0, 0.9));
  }

  float nightSide = 1.0 - smoothstep(-0.15, 0.05, dot(normalize(vNormalV), uL0dir));
  // auroras: glowing curtains around the magnetic poles, best seen at night
  if (uAurora > 0.001) {
    float lat = abs(p.y);
    float lon = atan(p.z, p.x);
    float oval = exp(-pow((lat - 0.9) / 0.035, 2.0));
    float curtain = 0.5 + 0.5 * snoise(vec3(lon * 6.0, uTime * 0.15, uSeed));
    float fine = 0.6 + 0.4 * snoise(vec3(lon * 40.0, uTime * 0.6, uSeed));
    vec3 ac = mix(vec3(0.1, 1.0, 0.45), vec3(0.9, 0.2, 0.35), smoothstep(0.88, 0.95, lat + curtain * 0.02));
    emit += ac * oval * curtain * fine * uAurora * (0.25 + 0.75 * nightSide) * 0.6;
  }
  // how big a surface feature looks on screen: lets small things stay small up close
  float fw = length(fwidth(p));
  // volcanoes: hot specks on the dark side
  if (uVolcano > 0.001 && !gas) {
    float v = snoise(p * 70.0 + uSeed * 0.7) * 0.5 + 0.5;
    float spots = smoothstep(0.9, 0.97, v) * (0.6 + 0.4 * sin(uTime * 2.0 + v * 30.0));
    emit += blackbody(1300.0) * spots * uVolcano * (0.3 + 0.7 * nightSide) * 0.8;
  }
  // city lights on the night side
  float cityK = max(uCity, uLife > 1.5 ? 0.85 : 0.0);
  if (cityK > 0.001 && !gas) {
    float night = (1.0 - smoothstep(-0.15, 0.05, dot(normalize(vNormalV), uL0dir)));
    vec4 s = surf(p);
    float sea = mix(-0.35, 0.25, uOcean);
    float e = s.r * 2.0 - 1.0;
    float land = step(sea, e);
    // cities cluster along coasts and in temperate lowlands, as tiny specks
    float coast = 1.0 - smoothstep(0.0, 0.15, e - sea);
    float region = smoothstep(0.5, 0.78, snoise(p * 9.0 + uSeed) * 0.5 + 0.5 + coast * 0.3);
    float n1 = snoise(p * 140.0 + uSeed) * 0.5 + 0.5;
    float n2 = snoise(p * 420.0 + uSeed * 1.7) * 0.5 + 0.5;
    float specks = smoothstep(0.7, 0.92, n1 * 0.55 + n2 * 0.45);
    float region2 = smoothstep(1.0 - cityK * 0.7, 1.08 - cityK * 0.7, snoise(p * 9.0 + uSeed) * 0.5 + 0.5 + coast * 0.25);
    // clusters of towns glow softly from afar; up close they break into specks
    float n0 = snoise(p * 38.0 + uSeed * 0.3) * 0.5 + 0.5;
    // from afar, towns blur into a glow; up close they break into streets of light
    float far = smoothstep(0.0004, 0.004, fw);
    float sprawl = smoothstep(0.58, 0.9, n0) * 0.3 * (0.4 + 0.6 * coast) * far;
    float n3 = snoise(p * 1400.0 + uSeed * 2.3) * 0.5 + 0.5;
    float n4 = snoise(p * 4200.0 + uSeed * 3.1) * 0.5 + 0.5;
    float streets = smoothstep(0.62, 0.8, n3 * 0.6 + n4 * 0.4) * smoothstep(0.45, 0.8, n0) * (1.0 - far);
    float cities = region2 * (sprawl + specks * mix(0.4, 1.0, far) + streets) * land * (1.0 - smoothstep(0.62, 0.85, abs(p.y)));
    emit += vec3(1.0, 0.6, 0.26) * cities * night * (0.5 + cityK * 0.6);
  }

  // self-luminous: brown dwarfs and hot Jupiters glow by their own heat
  if (selfGlow > 0.0) emit += blackbody(uTempK) * selfGlow * uEmissive;

  col += emit;
  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

export function makePlanetMaterial(sharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uSurf: { value: null },
      uType: { value: 0 },
      uSeed: { value: 1 },
      uTime: sharedUniforms.uTime,
      uExposure: sharedUniforms.uExposure,
      uColA: { value: new THREE.Color(0.2, 0.18, 0.16) },
      uColB: { value: new THREE.Color(0.35, 0.32, 0.28) },
      uColC: { value: new THREE.Color(0.5, 0.48, 0.45) },
      uOcean: { value: 0 },
      uIceCap: { value: 0 },
      uLife: { value: 0 },
      uGreen: { value: 0 },
      uCity: { value: 0 },
      uDrift: { value: 0 },
      uAurora: { value: 0 },
      uVolcano: { value: 0 },
      uHits: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 1, 0, -1)) },
      uHitSize: { value: Array.from({ length: 6 }, () => new THREE.Vector2(0.1, 0)) },
      uOcc: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
      uCut: { value: 0 },
      uClose: { value: 0 },
      uHeat: { value: 0 },
      uDamage: { value: 0 },
      uCraters: { value: 1 },
      uRelief: { value: 1 },
      uTempK: { value: 300 },
      uAtmo: { value: new THREE.Vector4(0.4, 0.6, 1, 0) },
      uL0dir: { value: new THREE.Vector3(1, 0, 0) },
      uL0col: { value: new THREE.Color(1, 1, 1) },
      uL1dir: { value: new THREE.Vector3(0, 1, 0) },
      uL1col: { value: new THREE.Color(0, 0, 0) },
      uAmbient: { value: 0.004 },
      uEmissive: { value: 1 },
      uLumpy: { value: 0 },
      uDetail: { value: 1 },
    },
  });
}

// ---------------------------------------------------------------- atmosphere
// Single-scattering raymarch through a thin shell (Rayleigh + Mie).
const ATMO_VERT = /* glsl */ `
varying vec3 vViewPos;
${LOGDEPTH_VERT_PARS}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

const ATMO_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCenter;    // planet centre in view space
uniform float uRp;       // planet radius (view units)
uniform float uRa;       // atmosphere top radius
uniform vec3 uBetaR;     // Rayleigh scattering colour weights
uniform float uMie;
uniform float uDensity;
uniform vec3 uL0dir; uniform vec3 uL0col;
uniform float uExposure;
varying vec3 vViewPos;
${LOGDEPTH_FRAG_PARS}

vec2 raySphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r * r;
  float h = b * b - cc;
  if (h < 0.0) return vec2(1e30, -1e30);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  ${LOGDEPTH_FRAG}
  // Work relative to the planet centre, starting from this fragment on the shell,
  // so the maths stays precise however far away the planet is.
  vec3 rd = normalize(vViewPos);
  vec3 pf = vViewPos - uCenter;
  float camT = -length(vViewPos);
  float b = dot(pf, rd);
  float hA = b * b - (dot(pf, pf) - uRa * uRa);
  if (hA < 0.0) discard;
  hA = sqrt(hA);
  float r0 = -b - hA, r1 = -b + hA;
  float t0 = max(min(r0, r1), camT);
  float t1 = max(r0, r1);
  float hP = b * b - (dot(pf, pf) - uRp * uRp);
  if (hP > 0.0) {
    float tp = -b - sqrt(hP);
    if (tp > t0) t1 = min(t1, tp);
  }
  if (t1 <= t0) discard;
  float H = (uRa - uRp) * 0.25;
  const int STEPS = 10;
  float dt = (t1 - t0) / float(STEPS);
  vec3 L = uL0dir;
  float mu = dot(rd, L);
  float phaseR = 0.0596831 * (1.0 + mu * mu);
  float g = 0.76;
  float phaseM = 0.1193662 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odView = 0.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 pos = pf + rd * (t0 + dt * (float(i) + 0.5));
    float hgt = max(length(pos) - uRp, 0.0);
    float dens = exp(-hgt / H) * dt;
    odView += dens;
    // optical depth toward the sun (cheap: Chapman-like estimate)
    vec3 up = normalize(pos);
    float cosZ = dot(up, L);
    vec2 tl = raySphere(pos, L, vec3(0.0), uRp);
    float shadow = (tl.x < tl.y && tl.x > 0.0) ? 0.0 : 1.0;
    float odSun = exp(-hgt / H) * H / max(cosZ + 0.15, 0.02);
    vec3 att = exp(-(uBetaR * (odView + odSun) + uMie * 1.1 * (odView + odSun)) * uDensity / H * 0.18);
    sumR += dens * att * shadow;
    sumM += dens * att * shadow;
  }
  vec3 col = (sumR * uBetaR * phaseR + sumM * uMie * phaseM) * uDensity / H * 6.0;
  col = min(col * uL0col, vec3(20.0));
  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

export function makeAtmosphereMaterial(sharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: {
      uCenter: { value: new THREE.Vector3() },
      uRp: { value: 1 },
      uRa: { value: 1.03 },
      uBetaR: { value: new THREE.Vector3(0.18, 0.42, 1.0) },
      uMie: { value: 0.12 },
      uDensity: { value: 1 },
      uL0dir: { value: new THREE.Vector3(1, 0, 0) },
      uL0col: { value: new THREE.Color(1, 1, 1) },
      uExposure: sharedUniforms.uExposure,
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- clouds
const CLOUD_FRAG = /* glsl */ `
precision highp float;
uniform float uSeed;
uniform float uTime;
uniform float uCover;
uniform vec3 uTint;
uniform vec3 uL0dir; uniform vec3 uL0col;
uniform float uExposure;
uniform float uStorm;      // hurricanes over warm oceans
uniform float uLightning;  // flashes on the night side
uniform vec4 uOcc[2];
uniform float uCut;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
${LOGDEPTH_FRAG_PARS}
${NOISE}
void main() {
  ${LOGDEPTH_FRAG}
  if (uCut > 0.5 && vObj.x > 0.0 && vObj.z > 0.0) discard;
  vec3 p = normalize(vObj);
  float lat = p.y;
  float t = uTime * 0.004;
  // winds blow in latitude bands
  float wind = sin(lat * 3.0) * t;
  vec3 q = vec3(p.x * cos(wind) - p.z * sin(wind), p.y, p.x * sin(wind) + p.z * cos(wind));
  vec3 so = vec3(uSeed * 0.03, 0.0, uSeed * 0.02);
  // winds stretch clouds along latitude; two levels of warping make swirls
  vec3 qs = q * vec3(1.0, 1.7, 1.0);
  vec3 w1 = vec3(fbm(qs * 1.6 + so, 4), fbm(qs * 1.6 + so + 4.1, 4), fbm(qs * 1.6 + so + 8.3, 4));
  vec3 w2 = vec3(fbm(qs * 3.1 + w1 * 1.3 + so, 3), fbm(qs * 3.1 + w1 * 1.3 + so + 2.7, 3), 0.0);
  float c = fbm(qs * 4.0 + vec3(w2.xy, w1.z) * 1.1 + so, 6) * 0.5 + 0.5;
  // fine wisps on top
  c += (fbm(qs * 14.0 + w1 * 2.0 + so, 3)) * 0.08;
  // storm belts sit in mid-latitudes, clear skies in the subtropics
  float belt = 0.75 + 0.25 * cos(lat * 6.0);
  float th = 0.5 + (0.5 - uCover) * 0.34;
  float d = clamp((c * belt - th) / 0.22, 0.0, 1.0);
  float cover = pow(d, 1.3);
  // hurricanes: spiral storms with a clear eye, turning the other way south of the equator
  if (uStorm > 0.0) {
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float la = (0.22 + 0.12 * fract(sin(uSeed * 3.1 + fi * 7.7) * 91.7)) * (fi == 1.0 ? -1.0 : 1.0);
      float lo = uSeed * 1.3 + fi * 2.1 - uTime * 0.0025 * (1.0 + fi * 0.3);
      vec3 c0 = vec3(cos(lo) * sqrt(1.0 - la * la), la, sin(lo) * sqrt(1.0 - la * la));
      vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), c0));
      vec3 e2 = cross(c0, e1);
      vec2 uv = vec2(dot(p, e1), dot(p, e2));
      if (dot(p, c0) < 0.0) continue;
      float r = length(uv);
      float th2 = atan(uv.y, uv.x) * sign(la);
      float arms = 0.5 + 0.5 * sin(2.0 * th2 + log(r + 0.003) * 7.0 + uTime * 0.05);
      float body = 1.0 - smoothstep(0.03, 0.13 + 0.03 * fi, r);
      float eye = smoothstep(0.004, 0.012, r);
      cover = max(cover, body * eye * mix(0.55, 1.0, arms) * uStorm);
    }
  }
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(-vViewPos);
  float nl = dot(N, uL0dir);
  float diff = clamp((nl + 0.12) / 1.12, 0.0, 1.0);
  vec3 col = uTint * diff * uL0col;
  // reddened light near the terminator
  col *= mix(vec3(1.0, 0.55, 0.35), vec3(1.0), smoothstep(-0.05, 0.25, nl));
  // moons' shadows
  for (int i = 0; i < 2; i++) {
    vec4 o = uOcc[i];
    if (o.w <= 0.0) continue;
    vec3 oc = o.xyz - vViewPos;
    float t = dot(oc, uL0dir);
    if (t <= 0.0) continue;
    float dd = length(oc - uL0dir * t);
    float pen = o.w * 0.12 + t * 0.006;
    col *= mix(0.04, 1.0, smoothstep(o.w - pen, o.w + pen, dd));
  }
  // lightning in thick cloud on the night side
  if (uLightning > 0.0) {
    float night = 1.0 - smoothstep(-0.1, 0.05, nl);
    vec3 cell = floor(p * 34.0);
    float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719)) + floor(uTime * 9.0) * 1.7) * 43758.5453);
    float flash = step(0.993, h) * smoothstep(0.4, 0.9, cover) * night * uLightning;
    col += vec3(0.75, 0.82, 1.0) * flash * 2.5;
  }
  float edge = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
  gl_FragColor = vec4(col * uExposure, cover * 0.92 * (1.0 - edge * 0.4));
}
`;

const CLOUD_VERT = /* glsl */ `
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

export function makeCloudMaterial(sharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: {
      uSeed: { value: 1 },
      uTime: sharedUniforms.uTime,
      uCover: { value: 0.1 },
      uStorm: { value: 0 },
      uLightning: { value: 0 },
      uCut: { value: 0 },
      uOcc: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] },
      uTint: { value: new THREE.Color(0.95, 0.95, 0.95) },
      uL0dir: { value: new THREE.Vector3(1, 0, 0) },
      uL0col: { value: new THREE.Color(1, 1, 1) },
      uExposure: sharedUniforms.uExposure,
    },
    transparent: true,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------- rings
const RING_VERT = /* glsl */ `
varying vec3 vLocal;
varying vec3 vViewPos;
varying vec3 vWorldN;
${LOGDEPTH_VERT_PARS}
void main() {
  vLocal = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vWorldN = normalize(normalMatrix * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}
`;

const RING_FRAG = /* glsl */ `
precision highp float;
uniform float uInner;
uniform float uOuter;
uniform float uSeed;
uniform float uOpacity;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uCenter;   // planet centre, view space
uniform float uRp;      // planet radius, view units
uniform vec3 uL0dir; uniform vec3 uL0col;
uniform float uExposure;
varying vec3 vLocal;
varying vec3 vViewPos;
varying vec3 vWorldN;
${LOGDEPTH_FRAG_PARS}
${NOISE}
void main() {
  ${LOGDEPTH_FRAG}
  float r = length(vLocal.xy);
  if (r < uInner || r > uOuter) discard;
  float x = (r - uInner) / (uOuter - uInner);
  // ringlets and gaps: layered 1D noise in radius
  float d = 0.0;
  d += 0.55 * (snoise(vec3(r * 9.0, uSeed, 0.0)) * 0.5 + 0.5);
  d += 0.3 * (snoise(vec3(r * 38.0, uSeed * 1.7, 0.0)) * 0.5 + 0.5);
  d += 0.15 * (snoise(vec3(r * 140.0, uSeed * 2.3, 0.0)) * 0.5 + 0.5);
  float gap = (1.0 - smoothstep(0.0, 0.012, abs(x - (0.55 + 0.1 * sin(uSeed))))) ;
  d *= 1.0 - gap * 0.95;
  d *= smoothstep(0.0, 0.06, x) * (1.0 - smoothstep(0.92, 1.0, x));
  float dens = clamp(d * 1.25 - 0.15, 0.0, 1.0) * uOpacity;
  vec3 col = mix(uColA, uColB, smoothstep(0.3, 0.8, x + (d - 0.5) * 0.3));
  // lit from the sun's side; small grains glow when back-lit (forward scattering)
  vec3 V = normalize(-vViewPos);
  float nl = abs(dot(vWorldN, uL0dir));
  float back = pow(clamp(dot(-V, uL0dir), 0.0, 1.0), 6.0);
  float lit = 0.25 + 0.75 * nl + back * 1.4 * (1.0 - dens);
  // the planet's shadow across the rings
  vec3 pos = vViewPos;
  vec3 oc = pos - uCenter;
  float b = dot(oc, uL0dir);
  float c = dot(oc, oc) - uRp * uRp;
  float h = b * b - c;
  float shadow = (h > 0.0 && -b - sqrt(h) > 0.0) ? 0.06 : 1.0;
  gl_FragColor = vec4(col * lit * shadow * uL0col * uExposure, dens);
}
`;

export function makeRingMaterial(sharedUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uInner: { value: 1.3 },
      uOuter: { value: 2.3 },
      uSeed: { value: 1 },
      uOpacity: { value: 0.8 },
      uColA: { value: new THREE.Color(0.55, 0.5, 0.42) },
      uColB: { value: new THREE.Color(0.75, 0.68, 0.55) },
      uCenter: { value: new THREE.Vector3() },
      uRp: { value: 1 },
      uL0dir: { value: new THREE.Vector3(1, 0, 0) },
      uL0col: { value: new THREE.Color(1, 1, 1) },
      uExposure: sharedUniforms.uExposure,
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
