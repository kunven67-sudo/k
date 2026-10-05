// Realistic skin shader (MeshPhysicalMaterial + injected GLSL):
//  - pre-integrated subsurface scattering: light bleeds red across curved skin (a real skin
//    diffusion profile, d'Eon & Luebke), so shadows get the soft red edge real skin has
//  - translucency: ears, nostrils, eyelids and fingers glow red when lit from behind
//  - procedural pores (densest on the nose/forehead), the crisscross skin microrelief and, when
//    you're tiny, the flat skin-cell plates. All of it is generated from the 3D position, so
//    there's no texture to run out of resolution: the closer you get, the more there is.
//  - melanin + blood color: redder cheeks/nose/ears/lips/knuckles, lighter palms and soles,
//    freckles, moles, real fingernails with half-moons, brows, scalp stubble
//  - live blood flow: flush (running, embarrassed) or go pale (scared)
import * as THREE from 'three';

// ---------- the pre-integrated skin lookup (N·L × curvature) ----------
let LUT = null;
function skinLUT() {
  if (LUT) return LUT;
  // d'Eon's 6-gaussian skin diffusion profile (variances in mm², RGB weights)
  const G = [[0.0064, 0.233, 0.455, 0.649], [0.0484, 0.1, 0.336, 0.344], [0.187, 0.118, 0.198, 0], [0.567, 0.113, 0.007, 0.007], [1.99, 0.358, 0.004, 0], [7.41, 0.078, 0, 0]];
  const R = (d, c) => { let s = 0; for (const g of G) s += g[c + 1] * Math.exp(-d * d / (2 * g[0])) / (2 * Math.PI * g[0]); return s; };
  const W = 64, H = 32, data = new Uint8Array(W * H * 4);
  for (let j = 0; j < H; j++) {
    const curv = Math.pow(j / (H - 1), 2) * 1.0 + 1e-4; // 1/mm
    const r = 1 / curv;
    for (let i = 0; i < W; i++) {
      const nl = i / (W - 1) * 2 - 1, th = Math.acos(nl);
      for (let c = 0; c < 3; c++) {
        let num = 0, den = 0;
        for (let k = -180; k <= 180; k++) {
          const x = k / 180 * Math.PI, d = Math.abs(2 * r * Math.sin(x / 2)), w = R(d, c);
          num += Math.max(0, Math.cos(th + x)) * w; den += w;
        }
        const v = num / den; // linear
        data[(j * W + i) * 4 + c] = Math.round(Math.min(1, Math.pow(v, 1 / 2.2)) * 255);
      }
      data[(j * W + i) * 4 + 3] = 255;
    }
  }
  LUT = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  LUT.magFilter = LUT.minFilter = THREE.LinearFilter; LUT.wrapS = LUT.wrapT = THREE.ClampToEdgeWrapping;
  LUT.needsUpdate = true;
  return LUT;
}

export const NOISE_GLSL = /* glsl */`
uvec3 sk_pcg(uvec3 v) { v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return v; }
vec3 sk_hash(vec3 c) { return vec3(sk_pcg(uvec3(ivec3(c) + 1048576))) * (1.0 / 4294967295.0); }
float sk_vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  float a = sk_hash(i).x, b = sk_hash(i + vec3(1,0,0)).x, c = sk_hash(i + vec3(0,1,0)).x, d = sk_hash(i + vec3(1,1,0)).x;
  float e = sk_hash(i + vec3(0,0,1)).x, f1 = sk_hash(i + vec3(1,0,1)).x, g = sk_hash(i + vec3(0,1,1)).x, h = sk_hash(i + vec3(1,1,1)).x;
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
// cellular noise: x = distance to nearest feature, y = second nearest, z = random id of the nearest
vec3 sk_cell(vec3 p) {
  vec3 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z)); vec3 h = sk_hash(i + o); vec3 r = o + h - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h.z; } else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
// bump mapping for a procedural height (same units as the surface position)
vec3 sk_bump(vec3 pos, vec3 n, float h) {
  vec3 dpdx = dFdx(pos), dpdy = dFdy(pos);
  float dhdx = dFdx(h), dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * n - grad);
}
`;

const VERT_PRE = /* glsl */`
attribute vec4 aSkinA;
attribute vec4 aSkinB;
attribute vec4 aNail;
attribute vec2 aBrow;
varying vec2 vBrow;
varying vec4 vSkinA;
varying vec4 vSkinB;
varying vec4 vNail;
varying vec3 vRest;
`;
const VERT_MAIN = /* glsl */`
vSkinA = aSkinA; vSkinB = aSkinB; vNail = aNail; vRest = position; vBrow = aBrow;
`;

const FRAG_PRE = /* glsl */`
varying vec4 vSkinA;   // redness, pore density, thinness, lips
varying vec4 vSkinB;   // brow, scalp, palm/sole, ear
varying vec4 vNail;    // nail u (along the last finger bone, -1 = not a fingertip), back-of-finger, sideways, curvature (1/mm)
varying vec3 vRest;    // rest position (model units = meters on a 1.75 m body)
varying vec2 vBrow;    // along (0 inner .. 1 outer), across (-1 .. 1) the eyebrow
uniform sampler2D uSkinLUT;
uniform float uObjScale;   // world size of 1 model unit
uniform float uBlood;      // how much blood shows (lighter skin = more)
uniform float uFlush;      // -1 pale (scared/cold) .. +1 flushed (running, embarrassed)
uniform float uOil;        // T-zone shine
uniform float uFreckles;
uniform float uAge;        // 0 kid .. 1 old
uniform float uSeed;
uniform vec3 uHairColor;
uniform float uBrowDensity;
uniform float uStubble;    // scalp hair showing through (buzz cuts)
uniform float uBeard;      // shaved beard shadow (adult men)
uniform float uWet;
vec3 gSkinN; float gSkinCurv; float gSkinThin; vec3 gSkinRaw; float gNail; float gLip; float gBrow;
${NOISE_GLSL}
// eyebrow hairs: each one a thin tapering stroke; inner hairs grow up, the rest sweep outward
float browHairs(vec2 bc, float m, float fwmm) {
  if (m <= 0.001 || bc.x < -0.5) return 0.0;
  float xm = bc.x * 43.0, ym = bc.y * mix(4.2, 1.9, clamp(bc.x, 0.0, 1.0));
  float ang = mix(1.25, 0.2, smoothstep(0.0, 0.38, bc.x)) - 0.3 * smoothstep(0.72, 1.0, bc.x);
  vec2 d = vec2(cos(ang), sin(ang)), nn = vec2(-d.y, d.x);
  vec2 q = vec2(dot(vec2(xm, ym), d), dot(vec2(xm, ym), nn));
  float cov = 0.0;
  for (int layer = 0; layer < 2; layer++) {
    vec2 cs = vec2(6.5, 0.3);
    vec2 qq = q / cs + float(layer) * vec2(0.37, 0.5);
    vec2 ci = floor(qq);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 0; i++) {
      vec2 c = ci + vec2(float(i), float(j));
      vec3 h = sk_hash(vec3(c, float(layer) + uSeed * 10.0));
      float start = c.x + h.x, len = 0.55 + 0.6 * h.z;
      float along = qq.x - start;
      if (along < 0.0 || along > len) continue;
      float f = along / len;
      float lat = (qq.y - (c.y + h.y)) * cs.y - 0.18 * f * f;
      float w = mix(0.055, 0.018, f);
      cov = max(cov, smoothstep(w, w * 0.25, abs(lat)) * (0.65 + 0.35 * h.x));
    }
  }
  float edge = smoothstep(1.25, 0.55, abs(bc.y)) * smoothstep(-0.06, 0.08, bc.x) * smoothstep(1.08, 0.92, bc.x);
  cov *= edge;
  // too far to see single hairs: average them
  cov = mix(cov, 0.72 * edge, smoothstep(0.05, 0.22, fwmm));
  return cov * smoothstep(0.0, 0.5, m) * uBrowDensity;
}
`;

// albedo, roughness and the bump height, all from the rest position
const FRAG_COLOR = /* glsl */`
{
  vec3 P = vRest + uSeed * 7.31;
  float red = vSkinA.x, poreD = vSkinA.y, lip = vSkinA.w;
  float browM = vSkinB.x, scalp = vSkinB.y, palm = vSkinB.z;
  vec3 base = diffuseColor.rgb;
  float lum = dot(base, vec3(0.299, 0.587, 0.114));
  // blood showing through: much more visible on light skin
  float blood = uBlood * (red + 0.12) * (1.0 + max(uFlush, 0.0) * 1.6) * (1.0 + min(uFlush, 0.0) * 0.8);
  base *= mix(vec3(1.0), vec3(1.0, 0.72, 0.70), clamp(blood, 0.0, 1.0));
  base = mix(base, vec3(lum) * vec3(1.02, 1.0, 1.03), clamp(-uFlush, 0.0, 1.0) * 0.18); // pale
  // mottling: real skin is never one flat color
  float m1 = sk_vnoise(P * 34.0), m2 = sk_vnoise(P * 140.0);
  base *= 0.955 + 0.06 * m1 + 0.03 * m2;
  base *= mix(vec3(1.0), vec3(1.0, 0.9, 0.88), smoothstep(0.55, 0.85, sk_vnoise(P * 9.0 + 3.0)) * 0.35 * uBlood);
  // lighter palms + soles (less melanin there)
  base = mix(base, mix(base, vec3(0.62, 0.45, 0.38), 0.55), palm * smoothstep(0.35, 0.05, lum));
  // freckles + moles
  if (uFreckles > 0.0) {
    vec3 fc = sk_cell(P * 420.0);
    float freck = uFreckles * smoothstep(0.42, 0.18, fc.x) * step(fc.z, 0.35) * (0.35 + red * 0.8) * (1.0 - lip);
    base *= mix(vec3(1.0), vec3(0.72, 0.56, 0.44), clamp(freck, 0.0, 1.0));
  }
  vec3 mc = sk_cell(P * 26.0);
  float mole = smoothstep(0.075, 0.045, mc.x) * step(mc.z, 0.045) * (1.0 - lip);
  base = mix(base, base * vec3(0.38, 0.26, 0.2), mole);
  // lips: thinner skin, more blood, a crisp border
  vec3 lipCol = base * mix(vec3(0.86, 0.56, 0.56), vec3(0.78, 0.6, 0.62), smoothstep(0.35, 0.1, lum));
  lipCol *= 1.0 - min(uFlush, 0.0) * vec3(0.05, 0.12, -0.02); // bluish when very cold/scared
  float lipM = smoothstep(0.35, 0.65, lip);
  base = mix(base, lipCol, lipM);
  gLip = lipM;
  // shaved beard shadow + scalp stubble
  base = mix(base, base * mix(vec3(1.0), uHairColor * 1.4 + 0.15, 0.6), uStubble * scalp * smoothstep(0.3, 0.7, sk_vnoise(P * 2600.0)) * 0.9);
  base = mix(base, base * vec3(0.86, 0.88, 0.92), uStubble * scalp * 0.5);
  // eyebrows: individual hairs
  float fwmm = max(length(dFdx(vRest)), length(dFdy(vRest))) * 1000.0;
  float browHair = browHairs(vBrow, browM, fwmm);
  base = mix(base, uHairColor * (0.85 + 0.3 * sk_vnoise(P * 3000.0)), clamp(browHair, 0.0, 0.95));
  gBrow = browHair;
  // fingernails: keratin plate over a pink bed, white half-moon at the base and a free edge at the tip
  float nu = vNail.x;
  float nailEdge = max(max(smoothstep(0.5, 0.42, (nu - 0.62) * 1.0 * 2.2), 0.0), 0.0);
  float inNail = step(0.0, nu) * smoothstep(0.42, 0.62, vNail.y) * smoothstep(0.62, 0.48, abs(vNail.z)) * smoothstep(0.34, 0.42, nu) * smoothstep(1.12, 1.0, nu);
  gNail = inNail;
  vec3 bed = mix(base, vec3(0.86, 0.62, 0.6) * (0.55 + lum * 0.7), 0.55);
  vec3 nailCol = mix(bed, vec3(0.93, 0.88, 0.84), smoothstep(0.5, 0.38, nu) * 0.75); // half-moon
  nailCol = mix(nailCol, vec3(0.95, 0.93, 0.88), smoothstep(0.93, 1.0, nu));   // free edge
  base = mix(base, nailCol, inNail);
  // age spots for older people
  base *= mix(vec3(1.0), vec3(0.8, 0.7, 0.6), uAge * smoothstep(0.62, 0.8, sk_vnoise(P * 60.0)) * 0.6 * (1.0 - lip));
  diffuseColor.rgb = base;
}
`;

const FRAG_NORMAL = /* glsl */`
{
  vec3 P = vRest + uSeed * 7.31;
  gSkinN = normal;
  gSkinCurv = sqrt(clamp(vNail.w, 0.0, 1.0));
  gSkinThin = vSkinA.z;
  // how big is one pixel on the skin? (fade detail we can't resolve, so nothing shimmers)
  float fw = max(length(dFdx(vRest)), length(dFdy(vRest)));
  float h = 0.0;
  // gentle large-scale unevenness
  h += (sk_vnoise(P * 90.0) - 0.5) * 0.00005;
  // pores (~0.55 mm apart where they're dense)
  float poreFade = 1.0 - smoothstep(0.00018, 0.0006, fw);
  if (poreFade > 0.0) {
    vec3 c = sk_cell(P / 0.00055);
    float has = step(c.z, vSkinA.y * 0.95);
    float r = 0.16 + 0.12 * fract(c.z * 37.0);
    h -= has * pow(1.0 - smoothstep(0.0, r, c.x), 2.0) * 0.00004 * poreFade * (1.0 - gNail) * (1.0 - gLip);
    // microrelief: the polygon network of fine furrows
    vec3 c2 = sk_cell(P / 0.00038 + 11.0);
    h -= (1.0 - smoothstep(0.0, 0.07, c2.y - c2.x)) * 0.000022 * poreFade * (1.0 - gNail);
  }
  // skin-cell plates (~35 µm), only when you're tiny
  float cellFade = 1.0 - smoothstep(0.000012, 0.00004, fw);
  if (cellFade > 0.0) {
    vec3 c3 = sk_cell(P / 0.000035);
    h += (smoothstep(0.0, 0.12, c3.y - c3.x) * 0.0000025 + fract(c3.z * 13.0) * 0.000002) * cellFade;
  }
  // lips: fine vertical creases
  h -= gLip * smoothstep(0.55, 0.9, sk_vnoise(vec3(P.x * 2200.0, P.y * 160.0, P.z * 2200.0))) * 0.00004 * (1.0 - smoothstep(0.0002, 0.0008, fw));
  // nail plate: raised a little, with fine lengthwise ridges
  h += gNail * (0.00012 + sk_vnoise(vec3(P.x * 4000.0, P.y * 300.0, P.z * 4000.0)) * 0.000008);
  // brows: the hairs lie on top of the skin
  h += gBrow * 0.00005;
  normal = sk_bump(-vViewPosition, normal, h * uObjScale);
  // roughness: oily T-zone shines, lips and nails are glossy, palms are matte
  float oily = smoothstep(0.55, 0.9, vSkinA.y) * uOil;
  roughnessFactor = clamp(roughnessFactor - oily * 0.14 - gLip * 0.16 - gNail * 0.3 + vSkinB.z * 0.06 - uWet * 0.3, 0.12, 1.0);
}
`;

const DIRECT = /* glsl */`
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	{
		// subsurface: diffuse light wraps around curved skin, red travels farthest
		float nlS = dot( gSkinN, directLight.direction );
		vec3 sss = texture2D( uSkinLUT, vec2( nlS * 0.5 + 0.5, gSkinCurv ) ).rgb;
		sss = sss * sss; // stored with gamma 2 for precision
		reflectedLight.directDiffuse += sss * directLight.color * BRDF_Lambert( material.diffuseColor );
		// translucency: thin parts glow from light behind them
		vec3 Lt = normalize( directLight.direction + gSkinN * 0.35 );
		float bt = pow( saturate( dot( geometryViewDir, - Lt ) ), 3.0 ) * gSkinThin;
		reflectedLight.directDiffuse += bt * gSkinRaw * material.diffuseColor * vec3( 1.0, 0.26, 0.14 ) * 0.9;
	}
}
`;

export function createSkinMaterial({ tone = '#c68a64', hair = '#2b1d14', freckles = 0, age = 0.3, seed = 0, brows = 1, stubble = 0, beard = 0 } = {}) {
  const color = new THREE.Color(tone);
  const lum = color.r * 0.3 + color.g * 0.59 + color.b * 0.11; // linear
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.5, metalness: 0, ior: 1.4, specularIntensity: 1,
    sheen: 0.35, sheenRoughness: 0.5, sheenColor: color.clone().lerp(new THREE.Color(1, 1, 1), 0.35),
  });
  mat.defines = { MH_SKIN: '' };
  const u = mat.userData.u = {
    uSkinLUT: { value: skinLUT() },
    uObjScale: { value: 1 },
    uBlood: { value: THREE.MathUtils.clamp(0.25 + lum * 1.3, 0.2, 0.75) },
    uFlush: { value: 0 }, uOil: { value: 0.6 }, uFreckles: { value: freckles }, uAge: { value: age },
    uSeed: { value: (seed % 1000) / 1000 }, uHairColor: { value: new THREE.Color(hair) },
    uBrowDensity: { value: brows }, uStubble: { value: stubble }, uBeard: { value: beard }, uWet: { value: 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = VERT_PRE + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_MAIN);
    let fs = FRAG_PRE + sh.fragmentShader;
    fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR);
    fs = fs.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL);
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'mh-skin-1';
  return mat;
}

// The lighting includes are shared by every material, so the skin versions are swapped in behind a
// define that only skin programs set (MH_SKIN).
function patchChunks() {
  const C = THREE.ShaderChunk;
  const re = /(reflectedLight\.directSpecular \+= irradiance \* BRDF_GGX\( directLight\.direction, geometryViewDir, geometryNormal, material \);)\s*(reflectedLight\.directDiffuse \+= irradiance \* BRDF_Lambert\( material\.diffuseColor \);)\s*\}/;
  if (!re.test(C.lights_physical_pars_fragment)) { console.warn('skin: lights chunk changed; plain diffuse'); return false; }
  C.lights_physical_pars_fragment = C.lights_physical_pars_fragment.replace(re, (m, a, b) => `#ifdef MH_SKIN\n${DIRECT}\n#else\n${a}\n${b}\n}\n#endif`);
  let n = 0;
  C.lights_fragment_begin = C.lights_fragment_begin.replace(/(get(Directional|Point|Spot)LightInfo\([^;]*\);)/g, (m) => { n++; return `${m}\n#ifdef MH_SKIN\ngSkinRaw = directLight.color;\n#endif\n`; });
  if (n < 3) console.warn('skin: light info hooks', n);
  return true;
}
export const skinPatched = patchChunks();
