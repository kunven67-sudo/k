/* HANDS OFF (real): every GPU program. WebGL2 / GLSL ES 3.00.
   Units: one unit = the Schwarzschild radius of the black hole (the hole sits at the origin of its place). */
(function (root) {
  'use strict';

  const VERT = `#version 300 es
layout(location = 0) in vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
precision highp samplerCube;
#define PI 3.14159265
#define TAU 6.28318531
`;

  // noise lives in a 64^3 texture (4 tileable gradient noises, period 16), blackbody colors in a 1D table
  const COMMON = `
uniform sampler3D u_noise;
uniform sampler2D u_bb;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
float hash13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y)*p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3*vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx)*p3.zyx); }
float N1(vec3 p){ return textureLod(u_noise, p*0.0625, 0.0).r*2.0 - 1.0; }
vec4 N4(vec3 p){ return textureLod(u_noise, p*0.0625, 0.0)*2.0 - 1.0; }
float fbm(vec3 p, int oct){ float v = 0.0, a = 0.5; for (int i = 0; i < 8; i++) { if (i >= oct) break; v += a*N1(p); p = p*2.03 + vec3(3.1, 1.7, 7.3); a *= 0.5; } return v; }
float ridged(vec3 p, int oct){ float v = 0.0, a = 0.5; for (int i = 0; i < 8; i++) { if (i >= oct) break; float n = 1.0 - abs(N1(p)); v += a*n*n; p = p*2.07 + vec3(5.2, 3.3, 1.1); a *= 0.5; } return v; }
// real color of a hot body (CIE 1931 -> linear sRGB, brightest channel = 1)
vec3 bb(float T){ return textureLod(u_bb, vec2(clamp(log(T*0.001)/log(40.0), 0.0, 1.0), 0.5), 0.0).rgb; }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// cube map face + (s,t) -> direction (OpenGL face layout)
vec3 faceDir(int f, vec2 st){
  vec2 c = st*2.0 - 1.0;
  if (f == 0) return vec3(1.0, -c.y, -c.x);
  if (f == 1) return vec3(-1.0, -c.y, c.x);
  if (f == 2) return vec3(c.x, 1.0, c.y);
  if (f == 3) return vec3(c.x, -1.0, -c.y);
  if (f == 4) return vec3(c.x, -c.y, 1.0);
  return vec3(-c.x, -c.y, -1.0);
}
// gnomonic coordinates around a sky direction
vec2 tang(vec3 d, vec3 c, vec3 up){ vec3 e1 = normalize(cross(up, c)); vec3 e2 = cross(c, e1); float z = max(dot(d, c), 1e-3); return vec2(dot(d, e1), dot(d, e2))/z; }
`;

  // ------------------------------------------------------------------ the sky of each place (built once into a cube map)
  const SKY = HEAD + COMMON + `
uniform int u_face;
uniform vec2 u_size;
uniform int u_place;
uniform float u_seed;
uniform vec3 u_c0, u_c1, u_c2;   // directions that matter for this place (what sits behind the hero, etc.)
out vec4 o;

// the Milky Way: band of unresolved stars, a bulge, dust lanes, pink star nurseries
vec3 milky(vec3 d, vec3 n, vec3 core, float amt){
  float lat = asin(clamp(dot(d, n), -1.0, 1.0));
  float ac = acos(clamp(dot(d, core), -1.0, 1.0));
  float bulge = exp(-pow(ac/0.38, 2.0)) + 0.3*exp(-pow(ac/0.95, 2.0));
  float width = 0.10 + 0.09*bulge;
  float band = exp(-lat*lat/(width*width));
  float haze = exp(-lat*lat/0.30);
  vec3 q = d*3.2 + u_seed;
  float clump = fbm(q*2.0, 6);
  float lum = band*(0.45 + 1.1*max(clump + 0.15, 0.0) + 1.6*bulge) + haze*0.10;
  float dust = smoothstep(-0.08, 0.32, fbm(q*2.7 + 7.0, 6) + 0.35*fbm(q*8.0, 4)) * exp(-pow(lat/(width*0.6), 2.0));
  lum *= 1.0 - 0.9*dust;
  vec3 c = mix(bb(5600.0), bb(4200.0), clamp(bulge, 0.0, 1.0))*lum;
  float hii = smoothstep(0.42, 0.72, fbm(q*6.0 + 3.0, 5))*band*(1.0 - dust);
  c += vec3(1.0, 0.22, 0.38)*hii*0.32;
  float blue = smoothstep(0.5, 0.8, fbm(q*9.0 - 5.0, 4))*band*(1.0 - dust);
  c += bb(14000.0)*blue*0.18;
  return c*amt;
}

// glowing gas lit from inside + dust in front of it (Carina / Orion style)
vec3 emission(vec2 uv, float seed, vec3 ha, vec3 o3, float amt){
  vec3 p = vec3(uv*1.6, seed);
  vec3 w = vec3(fbm(p + vec3(1.7, 9.2, 0.0), 5), fbm(p + vec3(8.3, 2.8, 0.0), 5), 0.0);
  float n1 = fbm(p + 1.6*w, 7);
  float n2 = fbm(p*1.6 + 2.2*w + 5.0, 7);
  float gas = smoothstep(-0.25, 0.65, n1);
  float oiii = smoothstep(0.0, 0.75, n2)*smoothstep(1.4, 0.2, length(uv));
  float dustN = fbm(p*2.4 - 1.3*w + 11.0, 7);
  float dust = smoothstep(0.02, 0.42, dustN);
  // rims of dust lit by the stars inside the cloud
  float rim = smoothstep(0.0, 0.12, dustN)*(1.0 - smoothstep(0.12, 0.3, dustN));
  float fade = exp(-dot(uv, uv)*0.55);
  vec3 c = ha*gas*gas*1.4 + o3*oiii*0.9 + vec3(1.0, 0.75, 0.45)*rim*gas*1.2;
  c *= 1.0 - 0.92*dust;
  return c*fade*amt;
}

// a spiral galaxy seen at an angle (uv in galaxy radii)
vec3 galaxy(vec2 uv, float incl, float spin, float arms, float twist, float seed){
  uv = rot(spin)*uv;
  uv.y /= max(cos(incl), 0.08);
  float r = length(uv), th = atan(uv.y, uv.x);
  float ph = th - twist*log(r + 0.04);
  float wob = 0.35*fbm(vec3(uv*5.0, seed), 4);
  float arm = pow(0.5 + 0.5*cos(arms*ph + wob*3.0), 3.0);
  float dlane = pow(0.5 + 0.5*cos(arms*ph + 0.55 + wob*3.0), 10.0);
  float disk = exp(-r/0.28);
  float bulge = exp(-r*r/0.012) + 0.4*exp(-r/0.08);
  float clumps = smoothstep(0.35, 0.8, fbm(vec3(uv*14.0, seed + 3.0), 4));
  vec3 c = bb(4300.0)*bulge*2.2;
  c += bb(7000.0)*disk*(0.25 + 0.9*arm)*(1.0 - 0.75*dlane*smoothstep(0.05, 0.25, r));
  c += vec3(1.0, 0.3, 0.55)*clumps*arm*disk*0.9;
  c += bb(16000.0)*smoothstep(0.55, 0.85, fbm(vec3(uv*22.0, seed - 2.0), 3))*arm*disk*0.8;
  // edge-on dust lane through the middle
  c *= 1.0 - 0.8*exp(-pow(uv.y*cos(incl)/0.012, 2.0))*smoothstep(0.85, 0.2, r)*smoothstep(0.6, 1.4, incl);
  return c;
}

// faint galaxies far away, everywhere
vec3 farGalaxies(vec3 d){
  vec3 c = vec3(0.0);
  vec3 p = d*26.0;
  vec3 id = floor(p);
  vec3 h = hash33(id + 4.0);
  if (h.x > 0.72) {
    vec3 gc = normalize(id + 0.3 + 0.4*h);
    vec2 uv = tang(d, gc, abs(gc.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0))/(0.0035 + 0.006*h.y);
    if (dot(uv, uv) < 4.0 && dot(d, gc) > 0.0) c += galaxy(uv, h.z*1.4, h.y*6.0, 2.0, 2.5, h.x*9.0)*0.06;
  }
  return c;
}

// the Pillars of Creation (Eagle Nebula, in JWST colors): dark dust columns, glowing edges where the young stars above eat them
float pillarShape(vec2 uv, vec2 base, vec2 top, float w0, float w1, float seed){
  vec2 pa = uv - base, ba = top - base;
  float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
  vec2 wq = uv + 0.06*vec2(fbm(vec3(uv*3.0, seed), 4), fbm(vec3(uv*3.0, seed + 5.0), 4));
  float wid = mix(w0, w1, h)*(1.0 + 0.35*fbm(vec3(wq*5.0, seed + 1.0), 5));
  float dist = length(wq - base - ba*h);
  float body = smoothstep(wid, wid*0.25, dist);
  float head = smoothstep(w1*1.5, w1*0.2, length((wq - top - vec2(0.03, w1*0.2))*vec2(1.0, 1.4))*(1.0 + 0.9*fbm(vec3(wq*6.0, seed + 2.0), 4)));
  return max(body, head*0.8);
}
float pillars(vec2 uv){
  float d = 0.0;
  d = max(d, pillarShape(uv, vec2(-0.66, -1.7), vec2(-0.36, 0.5), 0.44, 0.2, 1.0));
  d = max(d, pillarShape(uv, vec2(0.04, -1.7), vec2(0.17, -0.12), 0.36, 0.16, 4.0));
  d = max(d, pillarShape(uv, vec2(0.64, -1.7), vec2(0.54, -0.5), 0.28, 0.13, 7.0));
  return d;
}
float baseCloud(vec2 uv){ return smoothstep(-0.9, -1.45, uv.y + 0.25*fbm(vec3(uv*2.5, 9.0), 5));
}
vec3 eagle(vec3 d){
  vec2 uv = tang(d, u_c0, vec3(0.0, 1.0, 0.0))*2.6;
  if (dot(d, u_c0) < 0.0) uv = vec2(9.0);
  vec3 p = vec3(uv*1.2, 3.0);
  // blue-teal glow of ionized gas behind, warmer toward the hot stars up top
  float haze = smoothstep(-0.5, 0.7, fbm(p + 0.9*fbm(p*1.7, 4), 6));
  vec3 bg = mix(vec3(0.015, 0.05, 0.08), vec3(0.12, 0.28, 0.38), haze);
  bg += vec3(0.55, 0.42, 0.3)*smoothstep(0.0, 1.8, uv.y + 0.3*fbm(p*2.0, 4))*0.25;
  bg *= exp(-dot(uv, uv)*0.1);
  float m = pillars(uv);
  float bc = baseCloud(uv);
  float mottle = fbm(vec3(uv*3.5, 5.0), 5);
  float dens = clamp(max(m, bc)*(0.75 + 0.45*mottle), 0.0, 1.0);
  // light from the stars up and to the right: the edges facing them glow
  vec2 L = normalize(vec2(0.35, 1.0));
  float rim = clamp(m - pillars(uv + L*0.05), 0.0, 1.0);
  float rimWide = clamp(m - pillars(uv + L*0.14), 0.0, 1.0);
  vec3 body = mix(vec3(0.05, 0.022, 0.01), vec3(0.32, 0.15, 0.06), smoothstep(-0.4, 0.6, mottle + 0.4*rimWide));
  vec3 c = mix(bg, body, dens*0.96);
  c += vec3(1.0, 0.5, 0.2)*rim*1.5 + vec3(1.0, 0.6, 0.3)*rimWide*0.3;
  c += vec3(1.0, 0.22, 0.25)*pow(rim, 3.0)*1.2;                                  // thin H-alpha fringe
  // wisps boiling off the heads
  c += vec3(0.9, 0.55, 0.32)*smoothstep(0.55, 0.9, fbm(vec3(uv*9.0, 8.0), 4))*rimWide*0.7;
  // little red jets from baby stars inside
  c += vec3(1.0, 0.18, 0.12)*smoothstep(0.78, 0.95, fbm(vec3(uv*26.0, 8.0), 3))*m*0.5;
  return c*1.2;
}

// the Crab Nebula: orange-red filaments around a blue ghost of synchrotron light
vec3 crab(vec3 d){
  vec2 uv = tang(d, u_c0, vec3(0.0, 1.0, 0.0));
  if (dot(d, u_c0) < 0.0) return vec3(0.0);
  uv = rot(0.5)*uv;
  vec2 e = uv/vec2(0.95, 0.68);
  float r = length(e);
  vec3 p = vec3(e*2.2, 1.0);
  float warp = fbm(p*1.3, 4);
  float shell = smoothstep(1.1, 0.75, r + 0.18*warp);
  float fil = ridged(p*1.6 + warp*1.5, 6);
  fil = pow(clamp(fil*1.25 - 0.35, 0.0, 1.0), 2.5);
  vec3 c = vec3(0.0);
  c += vec3(0.45, 0.62, 1.0)*exp(-r*r/0.28)*0.9*(0.7 + 0.5*fbm(p*3.0, 4));                  // synchrotron glow
  c += mix(vec3(1.0, 0.32, 0.12), vec3(1.0, 0.78, 0.35), smoothstep(0.3, 0.9, fbm(p*4.0 + 2.0, 4)))*fil*shell*2.2;
  c += vec3(0.25, 1.0, 0.5)*fil*shell*smoothstep(0.4, 0.9, r)*0.25;                          // [OIII] fringe
  return c;
}

void main(){
  vec2 st = gl_FragCoord.xy/u_size;
  vec3 d = normalize(faceDir(u_face, st));
  vec3 c = vec3(0.0);
  vec3 up = vec3(0.0, 1.0, 0.0);
  if (u_place == 0) {          // EVENT HORIZON: Milky Way + a Carina-like nebula
    c += milky(d, u_c1, u_c2, 0.9);
    float f = dot(d, u_c0);
    if (f > 0.0) c += emission(tang(d, u_c0, up)*0.9, 2.0 + u_seed, vec3(1.0, 0.36, 0.22), vec3(0.2, 0.75, 0.85), 1.1)*smoothstep(0.0, 0.3, f);
  } else if (u_place == 1) {   // PILLARS
    c += milky(d, u_c1, u_c2, 0.35);
    c += eagle(d)*smoothstep(0.0, 0.35, dot(d, u_c0));
  } else if (u_place == 2) {   // RINGED GIANT: deep sky, Milky Way, zodiacal glow
    c += milky(d, u_c1, u_c2, 1.0);
    float f = dot(d, u_c0);
    if (f > 0.0) c += emission(tang(d, u_c0, up)*1.4, 7.0 + u_seed, vec3(1.0, 0.3, 0.4), vec3(0.3, 0.5, 1.0), 0.35)*smoothstep(0.0, 0.3, f);
  } else if (u_place == 3) {   // PULSAR in the Crab
    c += milky(d, u_c1, u_c2, 0.45);
    c += crab(d)*1.2;
  } else if (u_place == 4) {   // QUASAR: we're inside the core of a galaxy
    float ac = acos(clamp(dot(d, u_c2), -1.0, 1.0));
    float lat = asin(clamp(dot(d, u_c1), -1.0, 1.0));
    float core = exp(-pow(ac/0.7, 2.0))*1.6 + exp(-pow(ac/1.6, 2.0))*0.5;
    vec3 q = d*3.0 + u_seed;
    float dust = smoothstep(-0.05, 0.35, fbm(q*2.4, 6))*exp(-pow(lat/0.22, 2.0));
    c += bb(4600.0)*core*(0.55 + 0.5*fbm(q*4.0, 5))*(1.0 - 0.9*dust);
    c += milky(d, u_c1, u_c2, 0.6);
    c += vec3(1.0, 0.3, 0.5)*smoothstep(0.5, 0.8, fbm(q*7.0, 4))*exp(-pow(lat/0.12, 2.0))*0.4;
  } else {                     // COLLISION: two galaxies tearing each other apart
    c += milky(d, u_c1, u_c2, 0.25);
    vec2 a = tang(d, u_c0, up);
    float fa = dot(d, u_c0);
    if (fa > 0.0) {
      c += galaxy((a - vec2(-0.22, 0.05))/0.36, 0.9, 0.6, 2.0, 2.6, 1.0)*1.6;
      c += galaxy((a - vec2(0.24, -0.08))/0.30, 0.5, -1.1, 2.0, 3.0, 5.0)*1.5;
      // tidal tails: long faint streams of stars thrown out by the collision
      vec2 t1 = a - vec2(-0.22, 0.05);
      float tail1 = exp(-pow((length(t1 - vec2(-0.25, 0.25)) - 0.42)/0.05, 2.0))*smoothstep(0.1, -0.35, t1.y - t1.x*0.7);
      vec2 t2 = a - vec2(0.24, -0.08);
      float tail2 = exp(-pow((length(t2 - vec2(0.3, -0.22)) - 0.40)/0.05, 2.0))*smoothstep(-0.1, 0.35, t2.y - t2.x*0.6);
      float clump = 0.6 + 0.8*fbm(vec3(a*12.0, 4.0), 4);
      c += bb(8000.0)*(tail1 + tail2)*clump*0.35;
      // where they overlap, a burst of new stars
      c += vec3(1.0, 0.35, 0.6)*smoothstep(0.55, 0.85, fbm(vec3(a*18.0, 9.0), 4))*exp(-dot(a - vec2(0.02, -0.02), a - vec2(0.02, -0.02))/0.02)*1.4;
    }
  }
  c += farGalaxies(d);
  o = vec4(c, 1.0);
}`;

  // ------------------------------------------------------------------ the hero + the sky, per pixel (also used for the reflection probe)
  const HERO = HEAD + COMMON + `
uniform vec2 u_res;
uniform vec3 u_camPos;
uniform mat3 u_camRot;
uniform float u_tanHalf;
uniform float u_aspect;
uniform float u_time;
uniform int u_kind;          // 0 black hole, 1 planet, 2 pulsar, 3 two black holes
uniform samplerCube u_sky;
uniform samplerCube u_sky2;
uniform float u_skyMix;
uniform mat3 u_skyRot;
uniform float u_starAmt;
uniform float u_skyGain;
uniform int u_steps;
uniform float u_folds;
uniform vec4 u_scrim;        // center (px), radius (px)
uniform float u_scrimA;
uniform int u_probe;
uniform int u_face;
uniform vec3 u_hole;
uniform mat3 u_heroRot;      // world -> hero space (disk / rings / spin in the xz plane)
uniform vec4 u_hA, u_hB, u_hC;
uniform vec3 u_sun;          // sun direction (world)
uniform vec4 u_b1, u_b2;     // two black holes: position + size
uniform float u_jit;
out vec4 o;

// ---- sky: the place's cube map + real stars, computed per pixel so they stay sharp ----
vec3 stars(vec3 d, float fp){
  vec3 acc = vec3(0.0);
  for (int L = 0; L < 3; L++) {
    float N = L == 0 ? 60.0 : L == 1 ? 150.0 : 380.0;
    // where the sky is squeezed so hard one pixel covers many stars, they blur into the glow instead of sparkling
    float res = smoothstep(1.1, 0.4, fp*N);
    if (res <= 0.0) continue;
    vec3 c = floor(d*N);
    vec3 h = hash33(c + float(L)*31.7);
    float keep = L == 0 ? 0.5 : L == 1 ? 0.16 : 0.07;
    if (hash13(c*0.73 + float(L)*3.1) > keep) continue;
    vec3 sd = normalize(c + 0.15 + 0.7*h);
    vec3 sc = sd*N;
    if (any(notEqual(floor(sc), c))) continue;
    vec3 f = fract(sc);
    if (any(lessThan(f, vec3(0.06))) || any(greaterThan(f, vec3(0.94)))) continue;
    float m = hash13(c*1.31 + float(L)*7.0);
    float flux = L == 0 ? pow(m, 60.0)*25.0 + 0.09*pow(m, 3.0) : L == 1 ? pow(m, 40.0)*1.0 + 0.028*m*m : 0.018*m*m*m;
    float tr = hash13(c*2.17 + 5.0);
    float T = tr < 0.30 ? mix(2900.0, 3900.0, tr/0.30) : tr < 0.62 ? mix(3900.0, 5600.0, (tr - 0.30)/0.32)
            : tr < 0.85 ? mix(5600.0, 8000.0, (tr - 0.62)/0.23) : tr < 0.96 ? mix(8000.0, 15000.0, (tr - 0.85)/0.11) : mix(15000.0, 32000.0, (tr - 0.96)/0.04);
    float sig = max(fp*0.45, 1.4e-4);
    vec3 dd = d - sd;
    float psf = exp(-dot(dd, dd)/(sig*sig));
    float tw = 0.85 + 0.15*sin(u_time*3.0 + m*80.0);
    acc += bb(T)*flux*psf*(fp*fp)/(PI*sig*sig)*3.2*tw*res;
  }
  return acc;
}
vec3 skyCol(vec3 d, float fp){
  vec3 q = u_skyRot*d;
  vec3 s = textureLod(u_sky, q, 0.0).rgb;
  if (u_skyMix > 0.0) s = mix(s, textureLod(u_sky2, q, 0.0).rgb, u_skyMix);
  return s*u_skyGain + stars(q, fp)*u_starAmt;
}

// ---- black hole: light rays bent for real (Schwarzschild), a hot disk with Doppler beaming ----
float diskProfile(float r, float rin){ float x = rin/r; return pow(x, 0.75)*pow(max(1.0 - sqrt(x), 0.0), 0.25)*2.05; }
vec4 diskSample(vec3 h, vec3 vdir){
  float r = length(h.xz);
  float rin = u_hA.x, rout = u_hA.y;
  if (r < rin*0.985 || r > rout) return vec4(0.0);
  float tp = diskProfile(r, rin);
  float beta = min(sqrt(0.5/max(r - 1.0, 0.05)), 0.75);
  vec3 orb = normalize(vec3(-h.z, 0.0, h.x));
  vec3 toObs = -normalize(vdir);
  float gam = inversesqrt(1.0 - beta*beta);
  float g = 1.0/(gam*(1.0 - beta*dot(orb, toObs)))*sqrt(max(1.0 - 1.0/r, 0.03));
  float ang = atan(h.z, h.x);
  float om = u_hA.w*pow(r, -1.5);
  float P = 26.0;
  float t1 = mod(u_time, P), t2 = mod(u_time + P*0.5, P);
  float w1 = pow(sin(PI*t1/P), 2.0);
  float a1 = ang - om*t1, a2 = ang - om*t2 + 2.7;
  vec3 q1 = vec3(cos(a1)*2.3, sin(a1)*2.3, r*1.9);
  vec3 q2 = vec3(cos(a2)*2.3, sin(a2)*2.3, r*1.9 + 4.0);
  float s1 = fbm(q1, 5) + 0.5*fbm(vec3(cos(a1)*7.0, sin(a1)*7.0, r*6.5), 3);
  float s2 = fbm(q2, 5) + 0.5*fbm(vec3(cos(a2)*7.0, sin(a2)*7.0, r*6.5 + 3.0), 3);
  float st = mix(s2, s1, w1);
  float lanes = 0.75 + 0.25*sin(r*7.5 + 2.0*st);
  float dens = smoothstep(rin*0.985, rin*1.12, r)*(1.0 - smoothstep(rout*0.55, rout, r));
  float clump = smoothstep(-0.45, 0.6, st);
  dens *= clamp(0.18 + 1.45*clump, 0.0, 1.7)*lanes;
  float T = u_hA.z*tp*g*(0.85 + 0.3*clump);
  float I = u_hB.z*pow(max(tp*g, 0.0), 4.0)*(0.25 + 0.75*smoothstep(0.0, 0.7, tp));
  vec3 col = bb(T)*I*(0.3 + 0.9*clump);
  float a = clamp(dens*(1.05 - 0.55*(r - rin)/(rout - rin)), 0.0, 0.97);
  return vec4(col, a);
}
// relativistic jets: where the view ray passes closest to each jet's axis, integrate the glow across it
vec3 jetOne(vec3 p, vec3 v, float s){
  vec3 ax = vec3(0.0, s, 0.0);
  float b = dot(v, ax), d = dot(v, p), e = dot(ax, p);
  float den = max(1.0 - b*b, 0.003);
  float sc = (b*e - d)/den, tc = (e - b*d)/den;
  if (sc < 0.0 || tc < 1.0) return vec3(0.0);
  vec3 q = (p + v*sc) - ax*tc;
  float wid = 0.35 + tc*0.045;
  float path = min(wid*1.7725/sqrt(den), 9.0);
  float core = exp(-dot(q, q)/(wid*wid));
  float knot = 0.45 + 1.2*smoothstep(-0.25, 0.65, N1(vec3(0.0, tc*0.14 - u_time*1.1, s*9.0)));
  float fall = smoothstep(1.5, 6.0, tc)*exp(-tc/38.0);
  float del = 1.0/(2.6*(1.0 - 0.925*dot(ax, -v)));
  return mix(vec3(0.5, 0.58, 1.0), vec3(1.0), core*0.5)*core*knot*fall*pow(del, 2.4)*path/(wid*1.5 + 0.3);
}
vec3 jets(vec3 p, vec3 v){ return (jetOne(p, v, 1.0) + jetOne(p, v, -1.0))*u_hB.w; }
void traceBH(vec3 ro, vec3 rd, out vec3 emit, out float alpha, out vec3 dout, out float cap){
  emit = vec3(0.0); alpha = 0.0; cap = 0.0;
  vec3 p = u_heroRot*(ro - u_hole);
  vec3 v = u_heroRot*rd;
  float Rb = u_hC.x;
  if (u_hB.y > 0.5) emit += jets(p, v);
  float tca = -dot(p, v);
  float b = length(cross(p, v));
  bool outside = dot(p, p) > Rb*Rb;
  if (outside && (b > Rb*0.95 || tca < 0.0)) {           // never comes close: bend it once, the weak-field way
    vec3 bh = normalize(-(p + v*tca) + 1e-6);
    float al = tca > 0.0 ? 2.0/max(b, 1.0) : 0.0;
    dout = transpose(u_heroRot)*normalize(v*cos(al) + bh*sin(al));
    return;
  }
  if (outside) { float c = dot(p, p) - Rb*Rb; p += v*(tca - sqrt(max(tca*tca - c, 0.0))); }
  vec3 hv = cross(p, v);
  float h2 = dot(hv, hv);
  bool disk = u_hB.x > 0.5;
  bool done = false;
  for (int i = 0; i < 600; i++) {
    if (i >= u_steps) break;
    float r2 = dot(p, p);
    float r = sqrt(r2);
    float dt = clamp(0.2*(r - 0.85), 0.018, 1.5);
    vec3 acc = -1.5*h2*p/(r2*r2*r);
    vec3 vh = v + acc*(0.5*dt);
    vec3 pn = p + vh*dt;
    float rn2 = dot(pn, pn);
    float rn = sqrt(rn2);
    vec3 vn = vh - 1.5*h2*pn/(rn2*rn2*rn)*(0.5*dt);
    if (disk && p.y*pn.y <= 0.0) {
      float f = p.y/(p.y - pn.y + 1e-9);
      vec4 dc = diskSample(mix(p, pn, f), mix(v, vn, f));
      emit += (1.0 - alpha)*dc.rgb*dc.a;
      alpha += (1.0 - alpha)*dc.a;
    }
    p = pn; v = vn;
    if (rn2 < 1.0) { cap = 1.0; done = true; break; }
    if (rn2 > Rb*Rb && dot(p, v) > 0.0) { done = true; break; }
    if (alpha > 0.985) { done = true; break; }
  }
  if (!done && dot(p, p) < 9.0) cap = 1.0;   // still circling the photon sphere: practically never gets out
  v = normalize(v);
  // the last bit of bending past the edge of the box
  float bo = length(cross(p, v));
  float ro2 = length(p);
  vec3 bh = normalize(-(p - v*dot(p, v)) + 1e-6);
  float tail = (1.0/max(bo, 1.0))*(1.0 - sqrt(max(ro2*ro2 - bo*bo, 0.0))/max(ro2, 1e-3));
  v = normalize(v*cos(tail) + bh*sin(tail));
  dout = transpose(u_heroRot)*v;
}

// ---- ringed giant ----
float ringDens(float r){
  float d = 0.0;
  d += 0.14*smoothstep(1.23, 1.26, r)*(1.0 - smoothstep(1.50, 1.53, r));
  d += 0.88*smoothstep(1.52, 1.57, r)*(1.0 - smoothstep(1.93, 1.95, r));
  d += 0.05*smoothstep(1.95, 1.96, r)*(1.0 - smoothstep(2.02, 2.03, r));
  d += 0.58*smoothstep(2.02, 2.03, r)*(1.0 - smoothstep(2.26, 2.27, r));
  d *= 1.0 - 0.95*exp(-pow((r - 2.214)/0.005, 2.0));
  d += 0.55*exp(-pow((r - 2.324)/0.003, 2.0));
  float fine = 0.7 + 0.3*N1(vec3(r*190.0, 0.5, 0.5)) + 0.15*N1(vec3(r*640.0, 3.5, 1.5));
  return clamp(d*fine*(0.88 + 0.24*N1(vec3(r*35.0, 1.0, 2.0))), 0.0, 1.0);
}
vec3 ringAlb(float r){ return mix(vec3(0.5, 0.47, 0.43), vec3(0.88, 0.78, 0.62), smoothstep(1.5, 1.85, r))*(0.88 + 0.12*N1(vec3(r*55.0, 7.0, 1.0))); }
vec3 planetAlb(vec3 n){
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.z, n.x);
  float wind = sin(lat*6.0)*0.7 + sin(lat*13.0 + 1.0)*0.3;
  float lo = lon + u_time*0.006*wind*u_hA.w;
  vec3 sp = vec3(cos(lo)*cos(lat), sin(lat), sin(lo)*cos(lat));
  float turb = fbm(vec3(sp.x*2.5, sp.y*7.0, sp.z*2.5)*1.5, 6);
  float la = lat + 0.03*turb + 0.012*fbm(sp*14.0, 4);
  float bands = 0.5 + 0.5*sin(la*21.0 + 1.4*sin(la*6.0));
  float fine = 0.5 + 0.5*sin(la*67.0 + 3.0*turb);
  vec3 c = mix(vec3(0.5, 0.36, 0.2), vec3(0.9, 0.78, 0.55), bands);
  c = mix(c, vec3(0.98, 0.9, 0.74), fine*0.25);
  c *= 0.85 + 0.3*fbm(vec3(sp.x*8.0, sp.y*60.0, sp.z*8.0), 3);
  c = mix(c, vec3(0.52, 0.58, 0.62), smoothstep(1.0, 1.4, abs(lat)));
  // a big storm
  vec3 sc = normalize(vec3(cos(1.1 + u_time*0.004), 0.42, sin(1.1 + u_time*0.004)));
  float storm = smoothstep(0.17, 0.05, length((sp - sc)*vec3(1.0, 2.2, 1.0)) + 0.03*turb);
  c = mix(c, vec3(0.95, 0.9, 0.82), storm*0.8);
  return c;
}
void planetScene(vec3 ro, vec3 rd, out vec3 emit, out float alpha, out vec3 dout, out float cap){
  emit = vec3(0.0); alpha = 0.0; cap = 0.0; dout = rd;
  vec3 p = u_heroRot*(ro - u_hole), v = u_heroRot*rd;
  vec3 L = normalize(u_heroRot*u_sun);
  float R = u_hA.x;
  float tca = -dot(p, v);
  float b2 = dot(p, p) - tca*tca;
  float tP = 1e9;
  if (b2 < R*R && tca > 0.0) tP = tca - sqrt(R*R - b2);
  float tR = abs(v.y) > 1e-5 ? -p.y/v.y : -1.0;
  vec3 pr = p + v*tR;
  float rr = length(pr.xz)/R;
  float rd2 = tR > 0.0 ? ringDens(rr) : 0.0;
  vec3 lightCol = bb(5800.0)*u_hB.x;
  if (tP < 1e8) {
    vec3 hp = p + v*tP, n = normalize(hp);
    float ndl = dot(n, L);
    float mu = max(dot(n, -v), 0.0);
    vec3 alb = planetAlb(n);
    float lit = max(ndl, 0.0);
    // shadow of the rings on the planet
    float ts = -hp.y/L.y;
    float rs = ts > 0.0 ? ringDens(length((hp + L*ts).xz)/R) : 0.0;
    lit *= 1.0 - 0.85*rs;
    vec3 c = alb*lightCol*lit*pow(mu, 0.18);
    c *= mix(vec3(1.0, 0.62, 0.42), vec3(1.0), smoothstep(0.0, 0.3, ndl));
    // ring shine on the night side
    float rshine = max(-ndl, 0.0)*(0.5 + 0.5*sign(n.y*L.y))*0.012;
    c += alb*lightCol*rshine;
    emit = c; cap = 1.0; alpha = 1.0;
  }
  // thin glowing atmosphere at the edge
  float bb2 = sqrt(max(b2, 0.0));
  if (tca > 0.0 && bb2 < R*1.035) {
    vec3 cp = p + v*tca, n = normalize(cp);
    float day = smoothstep(-0.2, 0.45, dot(n, L));
    float h = (bb2 - R)/(R*0.035);
    float glow = exp(-abs(h)*2.2)*day;
    emit += mix(vec3(1.0, 0.55, 0.3), vec3(0.75, 0.82, 1.0), day)*lightCol*glow*0.22;
  }
  // rings
  if (rd2 > 0.001 && tR < tP) {
    vec3 alb = ringAlb(rr);
    float sameSide = sign(L.y)*sign(p.y);
    float phase = 0.5 + 0.5*dot(-v, L);
    vec3 ringL;
    if (sameSide > 0.0) ringL = alb*lightCol*abs(L.y)*(0.55 + 0.45*phase)*1.6;
    else ringL = alb*lightCol*rd2*(1.0 - rd2)*(0.15 + 2.2*pow(max(dot(v, L), 0.0), 6.0));   // lit from behind
    // the planet's shadow across the rings
    vec3 rp = pr;
    float tc2 = dot(-rp, L);
    float sb2 = dot(rp, rp) - tc2*tc2;
    if (tc2 > 0.0 && sb2 < R*R) ringL *= 0.02;
    emit = mix(emit, ringL, rd2);
    alpha = mix(alpha, 1.0, rd2);
  }
  // the sun itself
  float sd = dot(v, L);
  emit += (1.0 - alpha)*bb(5800.0)*(smoothstep(0.99996, 0.99999, sd)*900.0 + pow(max(sd, 0.0), 2000.0)*20.0);
}

// ---- pulsar: a spinning neutron star with lighthouse beams ----
float beamGlow(vec3 p, vec3 v, vec3 ax, float maxT){
  // closest approach between the view ray and the beam's axis
  vec3 w0 = p;
  float b = dot(v, ax), d = dot(v, w0), e = dot(ax, w0);
  float den = max(1.0 - b*b, 0.004);
  float sc = (b*e - d)/den, tc = (e - b*d)/den;
  if (tc < 0.0 || sc < 0.0 || sc > maxT) return 0.0;
  vec3 q = (p + v*sc) - ax*tc;
  float D2 = dot(q, q);
  float wid = 0.035 + tc*0.03;
  float path = wid*1.7725/sqrt(den);
  return exp(-D2/(wid*wid))*min(path, 1.5)*exp(-tc/12.0)*smoothstep(0.3, 1.2, tc)/(wid*4.0 + 0.08);
}
void pulsarScene(vec3 ro, vec3 rd, out vec3 emit, out float alpha, out vec3 dout, out float cap){
  emit = vec3(0.0); alpha = 0.0; cap = 0.0;
  vec3 p = u_heroRot*(ro - u_hole), v = u_heroRot*rd;
  float Rn = u_hA.x, VR = u_hA.y;
  float spin = u_time*u_hA.z;
  float tilt = u_hA.w;
  vec3 m = normalize(vec3(sin(tilt)*cos(spin), cos(tilt), sin(tilt)*sin(spin)));
  float tca = -dot(p, v);
  float b2 = dot(p, p) - tca*tca;
  float b = sqrt(max(b2, 0.0));
  float tS = 1e9;
  if (b < Rn && tca > 0.0) tS = tca - sqrt(Rn*Rn - b2);
  vec3 bh = normalize(-(p + v*tca) + 1e-6);
  float al = tca > 0.0 ? 2.0*u_hB.z/max(b, Rn) : 0.0;
  dout = transpose(u_heroRot)*normalize(v*cos(al) + bh*sin(al));
  // beams
  float maxT = min(tS, 1e4);
  float bg = beamGlow(p, v, m, maxT) + beamGlow(p, v, -m, maxT);
  emit += vec3(0.62, 0.72, 1.0)*bg*u_hB.x;
  // wind torus, inner ring, polar jets and the magnetic field (volume)
  float t0 = max(0.0, tca - VR), t1 = min(tca + VR, tS);
  if (t1 > t0) {
    float dt = (t1 - t0)/48.0;
    float jit = hash12(gl_FragCoord.xy + u_jit);
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 48; i++) {
      vec3 q = p + v*(t0 + (float(i) + jit)*dt);
      float r = length(q);
      float rho = length(q.xz);
      float ang = atan(q.z, q.x);
      float kn = 0.5 + 0.9*smoothstep(-0.2, 0.6, N1(vec3(cos(ang - u_time*0.15)*3.0, sin(ang - u_time*0.15)*3.0, rho*0.8)));
      float torus = exp(-pow((rho - 7.5)/1.3, 2.0) - q.y*q.y/0.5)*kn;
      float ring = exp(-pow((rho - 3.2)/0.25, 2.0) - q.y*q.y/0.04)*(0.6 + 0.6*kn);
      float jet = exp(-rho*rho/pow(0.25 + 0.05*abs(q.y), 2.0))*smoothstep(1.0, 3.0, abs(q.y))*exp(-abs(q.y)/10.0)
                * (0.6 + 0.8*smoothstep(-0.2, 0.5, N1(vec3(0.0, abs(q.y)*0.5 - u_time*2.0, q.y > 0.0 ? 3.0 : 9.0))));
      float cm = dot(q/max(r, 1e-3), m);
      float s2 = max(1.0 - cm*cm, 1e-3);
      float lf = fract(log2(r/s2)*1.6);
      float field = exp(-pow(lf - 0.5, 2.0)/0.004)*exp(-r/3.5)*smoothstep(Rn*1.3, Rn*3.0, r);
      acc += (vec3(0.65, 0.78, 1.0)*torus*0.55 + vec3(0.75, 0.85, 1.0)*ring*0.9 + vec3(0.6, 0.65, 1.0)*jet*1.4 + vec3(0.75, 0.45, 1.0)*field*0.35)*dt;
    }
    emit += acc*u_hB.y;
  }
  if (tS < 1e8) {
    vec3 hp = p + v*tS, n = normalize(hp);
    float spot = exp(-(1.0 - abs(dot(n, m)))/0.08);
    emit += bb(30000.0)*(9.0 + 60.0*spot);
    cap = 1.0; alpha = 1.0;
  }
  // when a beam sweeps across you
  float face = max(dot(m, -v), dot(-m, -v));
  emit += vec3(0.55, 0.65, 1.0)*pow(max(face, 0.0), 220.0)*u_hB.w;
}

// ---- two black holes about to merge (thin lens, strong field near each shadow) ----
void binaryScene(vec3 ro, vec3 rd, out vec3 emit, out float alpha, out vec3 dout, out float cap){
  emit = vec3(0.0); alpha = 0.0; cap = 0.0;
  vec3 d = rd;
  vec4 B0 = u_b1, B1 = u_b2;
  if (dot(u_b2.xyz - ro, rd) < dot(u_b1.xyz - ro, rd)) { B0 = u_b2; B1 = u_b1; }
  for (int k = 0; k < 2; k++) {
    vec4 B = k == 0 ? B0 : B1;
    vec3 oc = B.xyz - ro;
    float tca = dot(oc, d);
    if (tca <= 0.0) continue;
    vec3 bv = oc - d*tca;
    float b = length(bv);
    float bc = 2.598*B.w;
    if (b < bc) { cap = 1.0; break; }
    float al = min(max(2.0*B.w/b, -log(b/bc - 1.0) - 0.40), 3.0);
    d = normalize(d*cos(al) + (bv/b)*sin(al));
  }
  dout = d;
}

vec3 foldDir(vec3 rc, float n){
  float a = atan(rc.y, rc.x), seg = TAU/n;
  a = mod(a, seg); a = abs(a - seg*0.5);
  float r = length(rc.xy);
  return vec3(r*cos(a), r*sin(a), rc.z);
}

void main(){
  vec3 ro = u_camPos, rd;
  if (u_probe == 1) rd = normalize(faceDir(u_face, gl_FragCoord.xy/u_res));
  else {
    vec2 q = gl_FragCoord.xy/u_res*2.0 - 1.0;
    vec3 rc = vec3(q.x*u_aspect*u_tanHalf, q.y*u_tanHalf, 1.0);
    if (u_folds > 0.5) rc = foldDir(rc, u_folds);
    rd = normalize(u_camRot*rc);
  }
  vec3 emit, dir; float a, cap;
  if (u_kind == 0) traceBH(ro, rd, emit, a, dir, cap);
  else if (u_kind == 1) planetScene(ro, rd, emit, a, dir, cap);
  else if (u_kind == 2) pulsarScene(ro, rd, emit, a, dir, cap);
  else binaryScene(ro, rd, emit, a, dir, cap);
  float fp = clamp(length(fwidth(dir)), 1e-4, 0.05);
  vec3 col = emit + (1.0 - a)*(1.0 - cap)*skyCol(dir, fp);
  if (u_probe == 0 && u_scrimA > 0.0) {
    vec2 s = (gl_FragCoord.xy - u_scrim.xy)/u_scrim.zw;
    col *= 1.0 - u_scrimA*exp(-dot(s, s)*1.6);
  }
  o = vec4(max(col, vec3(0.0)), 1.0);
}`;

  // ------------------------------------------------------------------ things in front: 3D chrome number, liquid mercury, a glass cube
  const OBJ = HEAD + COMMON + `
uniform vec2 u_res;
uniform vec3 u_camPos;
uniform mat3 u_camRot;
uniform float u_tanHalf;
uniform float u_aspect;
uniform float u_time;
uniform samplerCube u_probe;
uniform vec4 u_proj;          // near, far
// number
uniform sampler2D u_atlas;
uniform vec4 u_atlasInfo;     // cols, rows, cell w (em), cell h (em)
uniform vec4 u_glyph;         // sdf range (em), depth (em), bevel (em), drum radius (em)
uniform int u_nSlots;
uniform vec4 u_slotA[18];     // x (em), drum value or -1, static glyph index, scale
uniform vec4 u_slotB[18];     // flip angle, wobble, 0, 0
uniform vec3 u_numC;          // number center in camera space
uniform float u_em;           // world size of one em
uniform mat3 u_numRot;        // camera space -> number space
uniform vec4 u_numBox;        // x min/max, y min/max (em)
uniform float u_numOn;
uniform float u_numHot;       // glow when something big happens
uniform int u_steps;
// mercury
uniform int u_nBalls;
uniform vec4 u_balls[14];
uniform vec4 u_merc;          // bound center (world), bound radius
uniform float u_mercK;
uniform float u_mercOn;
uniform float u_ripple;
// glass
uniform vec3 u_gPos;
uniform mat3 u_gRot;
uniform vec4 u_gSize;         // half size, corner radius
uniform float u_gOn;
uniform float u_disp;         // dispersion on/off
// light
uniform vec3 u_lightDir;
uniform vec3 u_lightCol;
out vec4 o;

vec3 env(vec3 d){ return textureLod(u_probe, d, 0.0).rgb; }

// ---- number ----
float glyph2D(vec2 g, float idx){
  float cols = u_atlasInfo.x, rows = u_atlasInfo.y, cw = u_atlasInfo.z, ch = u_atlasInfo.w;
  vec2 cell = vec2(mod(idx, cols), floor(idx/cols));
  vec2 lc = vec2(g.x/cw + 0.5, 0.5 - g.y/ch);
  vec2 cl = clamp(lc, vec2(0.004), vec2(0.996));
  float s = (textureLod(u_atlas, (cell + cl)/vec2(cols, rows), 0.0).r - 0.5)*2.0*u_glyph.x;
  vec2 bd = abs(g) - vec2(cw, ch)*0.5;
  return max(s, length(max(bd, 0.0)) - 0.0);
}
float extrude(float d2, float z){
  float D = u_glyph.y, bev = u_glyph.z;
  vec2 w = vec2(d2 + bev, abs(z - D*0.5) - D*0.5 + bev);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - bev;
}
float glyphAt(vec3 q, float idx, float ang, float sc){
  // q: relative to the drum axis (x along the axis). The glyph is printed on the curved face of the drum
  float R = u_glyph.w;
  vec2 yz = rot(ang)*q.yz;
  float rho = length(yz);
  float phi = atan(yz.x, -yz.y);
  vec3 g = vec3(q.x, R*phi, R - rho)/sc;
  return extrude(glyph2D(g.xy, idx), g.z)*sc;
}
float slotSDF(vec3 p, int i){
  vec4 A = u_slotA[i], B = u_slotB[i];
  float R = u_glyph.w;
  vec3 q = vec3(p.x - A.x, p.y, p.z - R);
  float sc = max(A.w, 0.02);
  q.yz = rot(B.x)*q.yz;
  if (A.y < 0.0) return glyphAt(q, A.z, 0.0, sc);
  float v = A.y;
  float k0 = floor(v), f = v - k0;
  float step = 0.6283;
  float a0 = f*step;                      // the current digit rolls up and away
  float a1 = (f - 1.0)*step;              // the next one comes up from below
  float sc0 = sc*smoothstep(0.55, 0.12, abs(a0));
  float sc1 = sc*smoothstep(0.55, 0.12, abs(a1));
  float d = 1e3;
  if (sc0 > 0.03) d = min(d, glyphAt(q, mod(k0, 10.0), a0, sc0));
  if (sc1 > 0.03) d = min(d, glyphAt(q, mod(k0 + 1.0, 10.0), a1, sc1));
  return d;
}
float numSDF(vec3 p){
  float d = 1e3;
  for (int i = 0; i < 18; i++) {
    if (i >= u_nSlots) break;
    if (abs(p.x - u_slotA[i].x) > u_atlasInfo.z*0.75) continue;
    d = min(d, slotSDF(p, i));
  }
  return d;
}
vec3 numNormal(vec3 p){
  vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy*numSDF(p + e.xyy) + e.yyx*numSDF(p + e.yyx) + e.yxy*numSDF(p + e.yxy) + e.xxx*numSDF(p + e.xxx));
}
bool marchNumber(vec3 rc, out float tHit, out vec3 nN, out vec3 pN){
  // number space is in em units
  vec3 ro = u_numRot*(-u_numC)/u_em;
  vec3 rd = u_numRot*rc;
  vec3 bmin = vec3(u_numBox.x, u_numBox.z, -0.1), bmax = vec3(u_numBox.y, u_numBox.w, u_glyph.w*0.7 + u_glyph.y);
  vec3 inv = 1.0/rd;
  vec3 t0 = (bmin - ro)*inv, t1 = (bmax - ro)*inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float ta = max(max(tn.x, tn.y), tn.z), tb = min(min(tf.x, tf.y), tf.z);
  if (tb < max(ta, 0.0)) return false;
  float t = max(ta, 0.0);
  for (int i = 0; i < 160; i++) {
    if (i >= u_steps) break;
    vec3 p = ro + rd*t;
    float d = numSDF(p);
    if (d < 0.0012) { pN = p; nN = numNormal(p); tHit = t*u_em; return true; }
    t += max(d*0.8, 0.002);
    if (t > tb) return false;
  }
  return false;
}

// ---- mercury ----
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0); return mix(b, a, h) - k*h*(1.0 - h); }
float mercSDF(vec3 p){
  float d = 1e3;
  for (int i = 0; i < 14; i++) {
    if (i >= u_nBalls) break;
    d = smin(d, length(p - u_balls[i].xyz) - u_balls[i].w, u_mercK);
  }
  vec3 q = (p - u_merc.xyz)*6.0;
  d += u_ripple*0.012*(sin(q.x + u_time*2.1)*sin(q.y*1.1 - u_time*1.7)*sin(q.z*0.9 + u_time*1.3));
  return d;
}
vec3 mercNormal(vec3 p){
  vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy*mercSDF(p + e.xyy) + e.yyx*mercSDF(p + e.yyx) + e.yxy*mercSDF(p + e.yxy) + e.xxx*mercSDF(p + e.xxx));
}
bool sphereHit(vec3 ro, vec3 rd, vec3 c, float r, out float ta, out float tb){
  vec3 oc = ro - c;
  float b = dot(oc, rd), cc = dot(oc, oc) - r*r, h = b*b - cc;
  if (h < 0.0) return false;
  h = sqrt(h);
  ta = -b - h; tb = -b + h;
  return tb > 0.0;
}
bool marchMerc(vec3 ro, vec3 rd, out float tHit){
  float ta, tb;
  if (!sphereHit(ro, rd, u_merc.xyz, u_merc.w, ta, tb)) return false;
  float t = max(ta, 0.0);
  for (int i = 0; i < 90; i++) {
    float d = mercSDF(ro + rd*t);
    if (d < 0.001) { tHit = t; return true; }
    t += d*0.85;
    if (t > tb) return false;
  }
  return false;
}

// ---- glass cube ----
float boxSDF(vec3 p){ vec3 q = abs(p) - u_gSize.xyz + u_gSize.w; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - u_gSize.w; }
float glassSDF(vec3 p){ return boxSDF(transpose(u_gRot)*(p - u_gPos)); }
vec3 glassNormal(vec3 p){
  vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy*glassSDF(p + e.xyy) + e.yyx*glassSDF(p + e.yyx) + e.yxy*glassSDF(p + e.yxy) + e.xxx*glassSDF(p + e.xxx));
}
bool marchGlass(vec3 ro, vec3 rd, out float tHit){
  float ta, tb;
  if (!sphereHit(ro, rd, u_gPos, length(u_gSize.xyz)*1.02, ta, tb)) return false;
  float t = max(ta, 0.0);
  for (int i = 0; i < 64; i++) {
    float d = glassSDF(ro + rd*t);
    if (d < 0.0008) { tHit = t; return true; }
    t += d;
    if (t > tb) return false;
  }
  return false;
}
// where a ray inside the box comes out (flat faces exact, then a few steps for the rounded edges)
float boxExit(vec3 q, vec3 dir){
  vec3 o = transpose(u_gRot)*(q - u_gPos), d = transpose(u_gRot)*dir;
  vec3 h = u_gSize.xyz;
  vec3 tt = (sign(d)*h - o)/(d + sign(d)*1e-6 + vec3(1e-9));
  float t = max(min(min(tt.x, tt.y), tt.z), 0.0);
  for (int i = 0; i < 6; i++) { float s = glassSDF(q + dir*t); if (abs(s) < 0.0005) break; t += s; }
  return t;
}
// one wavelength through the glass: in, maybe bounce inside, out
vec3 throughGlass(vec3 p, vec3 rd, vec3 n, float ior, out float thick){
  vec3 t1 = refract(rd, n, 1.0/ior);
  vec3 q = p - n*0.003;
  vec3 dir = t1;
  thick = 0.0;
  for (int bounce = 0; bounce < 3; bounce++) {
    float t = boxExit(q, dir);
    q += dir*t; thick += t;
    vec3 n2 = glassNormal(q);
    vec3 outd = refract(dir, -n2, ior);
    if (dot(outd, outd) > 0.0) return outd;
    dir = reflect(dir, -n2);
    q -= n2*0.003;
  }
  return dir;
}

float depthOf(vec3 wp){
  float z = dot(wp - u_camPos, u_camRot[2]);
  float n = u_proj.x, f = u_proj.y;
  float ndc = (f + n)/(f - n) - 2.0*f*n/((f - n)*max(z, n));
  return clamp(ndc*0.5 + 0.5, 0.0, 1.0);
}
float fresnel(float c, float f0){ return f0 + (1.0 - f0)*pow(1.0 - clamp(c, 0.0, 1.0), 5.0); }

void main(){
  vec2 q = gl_FragCoord.xy/u_res*2.0 - 1.0;
  vec3 rc = normalize(vec3(q.x*u_aspect*u_tanHalf, q.y*u_tanHalf, 1.0));
  vec3 rd = u_camRot*rc;
  vec3 ro = u_camPos;
  float best = 1e9; int what = 0;
  float tN, tM, tG; vec3 nN, pN;
  if (u_numOn > 0.01 && marchNumber(rc, tN, nN, pN)) { best = tN; what = 1; }
  // inside the liquid metal (diving through it)
  if (u_mercOn > 0.01 && mercSDF(ro) < 0.0) {
    vec3 n = normalize(rd + 0.35*N4(rd*6.0 + u_time).xyz);
    vec3 c = env(reflect(rd, n))*0.85 + vec3(0.9)*pow(max(dot(n, -rd), 0.0), 30.0);
    o = vec4(c*u_mercOn, 1.0); gl_FragDepth = 0.0; return;
  }
  if (u_mercOn > 0.01 && marchMerc(ro, rd, tM) && tM < best) { best = tM; what = 2; }
  if (u_gOn > 0.01 && marchGlass(ro, rd, tG) && tG < best) { best = tG; what = 3; }
  if (what == 0) discard;
  vec3 col; float alpha = 1.0;
  vec3 wp = ro + rd*best;
  if (what == 1) {
    // polished chrome
    mat3 back = transpose(u_numRot);
    vec3 n = normalize(u_camRot*(back*nN));
    vec3 rw = reflect(rd, n);
    float c = max(dot(n, -rd), 0.0);
    vec3 F0 = vec3(0.86, 0.87, 0.9);
    vec3 F = F0 + (1.0 - F0)*pow(1.0 - c, 5.0);
    vec3 e = env(rw);
    // chrome lives on contrast: the drum's curve sweeps each digit through a bright sky, a dark horizon, a warm floor
    vec3 rc2 = transpose(u_camRot)*rw;
    float y = rc2.y;
    vec3 skyC = mix(vec3(1.9, 1.95, 2.1), vec3(0.18, 0.24, 0.42), smoothstep(0.02, 0.55, y));
    vec3 floorC = mix(u_lightCol*0.08 + vec3(0.03, 0.02, 0.02), u_lightCol*0.55 + vec3(0.2, 0.13, 0.08), smoothstep(-0.03, -0.55, y));
    vec3 studio = y > 0.0 ? skyC : floorC;
    studio *= 1.0 - 0.94*exp(-pow((y + 0.015)/0.045, 2.0));     // the horizon line
    studio += u_lightCol*0.8*pow(max(dot(rw, u_lightDir), 0.0), 30.0);
    col = F*(studio*0.75 + e*1.4);
    col += u_lightCol*4.0*pow(max(dot(rw, u_lightDir), 0.0), 600.0);
    // dark seams between letters and in the bevel, so it reads
    float ao = clamp(numSDF(pN + nN*0.05)/0.05, 0.0, 1.0);
    col *= 0.35 + 0.65*ao;
    col += u_numHot*vec3(0.25, 0.9, 1.0)*pow(1.0 - c, 3.0)*1.5;
    alpha = u_numOn;
    wp = u_camPos + rd*best;
  } else if (what == 2) {
    vec3 n = mercNormal(wp);
    vec3 rw = reflect(rd, n);
    float c = max(dot(n, -rd), 0.0);
    vec3 F = vec3(fresnel(c, 0.74));
    vec3 e = env(rw);
    float sky = smoothstep(-0.3, 0.9, rw.y);
    // a mirror: it shows the hole, the disk and the stars, plus the big soft glow of the disk on its curve
    col = F*(e*1.7 + mix(vec3(0.02), u_lightCol*0.12 + vec3(0.05), sky) + u_lightCol*0.8*pow(max(dot(rw, u_lightDir), 0.0), 5.0));
    col += u_lightCol*3.0*pow(max(dot(rw, u_lightDir), 0.0), 900.0);
    alpha = u_mercOn;
  } else {
    vec3 n = glassNormal(wp);
    float c = max(dot(n, -rd), 0.0);
    float F = fresnel(c, 0.045);
    vec3 refl = env(reflect(rd, n));
    float th;
    vec3 tr;
    if (u_disp > 0.5) {
      float thr, thg, thb;
      vec3 dr = throughGlass(wp, rd, n, 1.505, thr);
      vec3 dg = throughGlass(wp, rd, n, 1.523, thg);
      vec3 dbb = throughGlass(wp, rd, n, 1.548, thb);
      tr = vec3(env(dr).r, env(dg).g, env(dbb).b);
      th = thg;
    } else {
      vec3 dg = throughGlass(wp, rd, n, 1.52, th);
      tr = env(dg);
    }
    vec3 absorb = exp(-th*vec3(0.35, 0.12, 0.2));
    col = mix(tr*absorb*1.15, refl + u_lightCol*0.35*pow(max(dot(reflect(rd, n), u_lightDir), 0.0), 8.0), F);
    // the bevels catch the light like real cut glass
    float bev = 1.0 - smoothstep(0.0, 0.25, abs(dot(n, normalize(u_gRot[0]))) * abs(dot(n, normalize(u_gRot[1]))) * abs(dot(n, normalize(u_gRot[2]))) * 0.0 + max(max(abs(dot(n, u_gRot[0])), abs(dot(n, u_gRot[1]))), abs(dot(n, u_gRot[2]))) - 0.75);
    col += (u_lightCol*0.25 + vec3(0.25))*bev*0.35;
    col += u_lightCol*2.5*pow(max(dot(reflect(rd, n), u_lightDir), 0.0), 700.0);
    alpha = u_gOn;
  }
  o = vec4(col*alpha, alpha);
  gl_FragDepth = depthOf(wp);
}`;

  // ------------------------------------------------------------------ dust in the light, sparks (points)
  const PART_V = `#version 300 es
layout(location = 0) in vec4 a_p;      // position (world), size (world)
layout(location = 1) in vec4 a_c;      // color (hdr), alpha
uniform mat4 u_vp;
uniform float u_pxScale;
out vec4 v_c;
void main(){
  vec4 cp = u_vp*vec4(a_p.xyz, 1.0);
  gl_Position = cp;
  float sz = a_p.w*u_pxScale/max(cp.w, 0.01);
  gl_PointSize = clamp(sz, 1.0, 64.0);
  float shrink = clamp(sz, 0.15, 1.0);          // tiny points fade instead of shimmering
  v_c = vec4(a_c.rgb*shrink*shrink, a_c.a);
}`;
  const PART_F = HEAD + `
in vec4 v_c;
out vec4 o;
void main(){
  vec2 d = gl_PointCoord*2.0 - 1.0;
  float r = dot(d, d);
  if (r > 1.0) discard;
  float a = exp(-r*3.5)*v_c.a;
  o = vec4(v_c.rgb*a, 0.0);
}`;

  // ------------------------------------------------------------------ bloom (Call of Duty style chain)
  const DOWN = HEAD + `
uniform sampler2D u_src;
uniform sampler2D u_obj;
uniform vec2 u_srcTexel;
uniform vec2 u_dst;
uniform int u_karis;
out vec4 o;
vec3 s(vec2 uv){
  vec3 c = textureLod(u_src, uv, 0.0).rgb;
  if (u_karis == 1) { vec4 ob = textureLod(u_obj, uv, 0.0); c = c*(1.0 - ob.a) + ob.rgb; }
  return c;
}
float lw(vec3 c){ return 1.0/(1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main(){
  vec2 uv = gl_FragCoord.xy/u_dst;
  vec2 t = u_srcTexel;
  vec3 a = s(uv + t*vec2(-2.0, 2.0)), b = s(uv + t*vec2(0.0, 2.0)), c = s(uv + t*vec2(2.0, 2.0));
  vec3 d = s(uv + t*vec2(-2.0, 0.0)), e = s(uv), f = s(uv + t*vec2(2.0, 0.0));
  vec3 g = s(uv + t*vec2(-2.0, -2.0)), h = s(uv + t*vec2(0.0, -2.0)), i = s(uv + t*vec2(2.0, -2.0));
  vec3 j = s(uv + t*vec2(-1.0, 1.0)), k = s(uv + t*vec2(1.0, 1.0)), l = s(uv + t*vec2(-1.0, -1.0)), m = s(uv + t*vec2(1.0, -1.0));
  vec3 r;
  if (u_karis == 1) {
    vec3 g0 = (a + b + d + e)*0.25, g1 = (b + c + e + f)*0.25, g2 = (d + e + g + h)*0.25, g3 = (e + f + h + i)*0.25, g4 = (j + k + l + m)*0.25;
    float w0 = lw(g0), w1 = lw(g1), w2 = lw(g2), w3 = lw(g3), w4 = lw(g4);
    r = (g0*w0*0.125 + g1*w1*0.125 + g2*w2*0.125 + g3*w3*0.125 + g4*w4*0.5)/(w0*0.125 + w1*0.125 + w2*0.125 + w3*0.125 + w4*0.5);
  } else {
    r = e*0.125 + (a + c + g + i)*0.03125 + (b + d + f + h)*0.0625 + (j + k + l + m)*0.125;
  }
  o = vec4(max(r, vec3(0.0)), 1.0);
}`;
  const UP = HEAD + `
uniform sampler2D u_src;
uniform vec2 u_srcTexel;
uniform vec2 u_dst;
uniform float u_radius;
out vec4 o;
vec3 s(vec2 uv){ return textureLod(u_src, uv, 0.0).rgb; }
void main(){
  vec2 uv = gl_FragCoord.xy/u_dst;
  vec2 t = u_srcTexel*u_radius;
  vec3 r = s(uv)*4.0;
  r += (s(uv + vec2(-t.x, 0.0)) + s(uv + vec2(t.x, 0.0)) + s(uv + vec2(0.0, -t.y)) + s(uv + vec2(0.0, t.y)))*2.0;
  r += s(uv + vec2(-t.x, -t.y)) + s(uv + vec2(t.x, -t.y)) + s(uv + vec2(-t.x, t.y)) + s(uv + vec2(t.x, t.y));
  o = vec4(r/16.0, 1.0);
}`;

  // ------------------------------------------------------------------ the lens: bloom, tone, the HUD, and reality breaking
  const POST = HEAD + COMMON + `
uniform sampler2D u_scene;
uniform sampler2D u_obj;
uniform sampler2D u_bloom;
uniform sampler2D u_streak;
uniform sampler2D u_ui;
uniform vec2 u_res;
uniform float u_time;
uniform float u_exposure;
uniform float u_bloomAmt;
uniform float u_streakAmt;
uniform float u_glitch;
uniform vec3 u_lens;
uniform vec3 u_shock;
uniform float u_rewind;
uniform float u_flash;
uniform vec3 u_flashCol;
uniform float u_flip;
uniform float u_mirror;
uniform float u_melt;
uniform float u_invert;
uniform float u_uiWarp;
uniform float u_scan;
uniform float u_shake;
uniform float u_hue;
uniform float u_uiOn;
uniform float u_fade;
out vec4 o;
vec3 aces(vec3 x){
  const mat3 i = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 oo = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = i*x;
  vec3 a = v*(v + 0.0245786) - 0.000090537;
  vec3 b = v*(0.983729*v + 0.4329510) + 0.238081;
  return clamp(oo*(a/b), 0.0, 1.0);
}
vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 hueRot(vec3 c, float a){
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c*ca + cross(k, c)*sin(a) + k*dot(k, c)*(1.0 - ca);
}
vec3 scene(vec2 uv){ vec4 ob = textureLod(u_obj, uv, 0.0); return textureLod(u_scene, uv, 0.0).rgb*(1.0 - ob.a) + ob.rgb; }
void main(){
  vec2 uv = gl_FragCoord.xy/u_res;
  float aspect = u_res.x/u_res.y;
  vec2 c = uv - 0.5;
  c += u_shake*0.01*vec2(sin(u_time*71.0), cos(u_time*63.0));
  if (u_flip > 0.001) { vec2 a = vec2(c.x*aspect, c.y)*rot(u_flip*PI); c = vec2(a.x/aspect, a.y); }
  if (u_mirror > 0.001) { float k = cos(u_mirror*PI); c.x = c.x/(abs(k) < 0.04 ? 0.04*sign(k + 1e-4) : k); }
  uv = c + 0.5;
  vec2 d = vec2((uv.x - u_shock.x)*aspect, uv.y - u_shock.y);
  float dl = length(d);
  float sq = (dl - u_shock.z*1.25)/0.075;
  float amp = (1.0 - u_shock.z)*0.045*exp(-sq*sq);
  vec2 shockOff = dl > 0.0001 ? vec2(d.x/aspect, d.y)/dl*amp : vec2(0.0);
  vec2 ld = vec2((uv.x - u_lens.x)*aspect, uv.y - u_lens.y);
  float lr = length(ld);
  vec2 lensOff = lr > 0.0001 ? -vec2(ld.x/aspect, ld.y)/lr*u_lens.z*0.006/(lr*lr*8.0 + 0.06) : vec2(0.0);
  float row = floor(uv.y*48.0), tick = floor(u_time*14.0);
  float g = hash12(vec2(row, tick));
  float tear = step(1.0 - u_glitch*0.28, g)*(hash12(vec2(row*3.1, tick + 1.0)) - 0.5)*0.12*u_glitch;
  float block = step(1.0 - u_glitch*0.06, hash12(vec2(floor(uv.x*12.0), floor(uv.y*9.0) + tick*7.0)))*0.04*u_glitch;
  float vhs = u_rewind*(sin(uv.y*60.0 + u_time*90.0)*0.004 + (hash12(vec2(floor(uv.y*90.0), floor(u_time*40.0))) - 0.5)*0.012);
  vec2 su = uv + shockOff + vec2(tear + block + vhs, 0.0);
  // the lens itself: a little chromatic fringe toward the edges, more when reality is breaking
  vec2 fromC = su - 0.5;
  float ca = 0.0004 + dot(fromC, fromC)*0.0014 + u_glitch*0.0075 + u_rewind*0.006 + u_flash*0.003;
  vec3 col;
  col.r = scene(su + fromC*ca*4.0 + vec2(ca, 0.0)).r;
  col.g = scene(su).g;
  col.b = scene(su - fromC*ca*4.0 - vec2(ca, 0.0)).b;
  vec3 bl = textureLod(u_bloom, su, 0.0).rgb;
  col = mix(col, bl, u_bloomAmt);
  // anamorphic streak from the brightest lights
  vec3 sk = vec3(0.0);
  for (int i = -6; i <= 6; i++) {
    float o2 = float(i)/6.0;
    sk += max(textureLod(u_streak, su + vec2(o2*0.22, 0.0), 0.0).rgb - 1.2, 0.0)*exp(-abs(o2)*3.0);
  }
  col += sk*u_streakAmt*vec3(0.55, 0.7, 1.0);
  col *= u_exposure;
  if (u_hue != 0.0) col = max(hueRot(col, u_hue), vec3(0.0));
  col = aces(col);
  col = toSRGB(col);
  col *= u_fade;
  // the HUD rides on the glass: bends a little with reality, stays readable
  vec2 uu = uv + (shockOff + lensOff + vec2(tear*0.35 + vhs, 0.0))*u_uiWarp;
  if (u_melt > 0.001) { float cm = floor(uu.x*90.0); uu.y += u_melt*(0.02 + 0.09*hash12(vec2(cm, 3.0)))*(0.6 + 0.4*sin(u_time*2.0 + cm)); }
  float uca = ca*0.35*u_uiWarp;
  vec4 ui = texture(u_ui, uu), uiR = texture(u_ui, uu + vec2(uca, 0.0)), uiB = texture(u_ui, uu - vec2(uca, 0.0));
  vec3 uic = vec3(uiR.r, ui.g, uiB.b);
  float ua = max(ui.a, max(uiR.a, uiB.a))*u_uiOn;
  col = col*(1.0 - ua) + uic*u_uiOn;
  if (u_rewind > 0.001) {
    float lines = step(0.965, hash12(vec2(floor(uv.y*140.0), floor(u_time*50.0))));
    float band = smoothstep(0.06, 0.0, abs(fract(uv.y*0.7 + u_time*1.8) - 0.5));
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(lum)*vec3(0.85, 0.95, 1.15), 0.45*u_rewind);
    col += (lines*0.35 + band*0.25)*u_rewind;
  }
  col *= 1.0 - u_scan*0.12*(0.5 + 0.5*sin(gl_FragCoord.y*PI));
  float vig = smoothstep(1.3, 0.3, length(vec2((uv.x - 0.5)*aspect, uv.y - 0.5)));
  col *= mix(1.0, vig, 0.5);
  col += (hash12(gl_FragCoord.xy + fract(u_time)*100.0) - 0.5)*0.03;
  col = mix(col, 1.0 - col, u_invert);
  col += u_flashCol*u_flash;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

  const COPY = HEAD + `
uniform sampler2D u_src;
uniform vec2 u_res;
out vec4 o;
void main(){ o = vec4(texelFetch(u_src, ivec2(gl_FragCoord.xy*vec2(textureSize(u_src, 0))/u_res), 0).rgb, 1.0); }`;

  root.HOGFX2_SHADERS = { VERT, HEAD, COMMON, SKY, HERO, OBJ, PART_V, PART_F, DOWN, UP, POST, COPY };
})(typeof window !== 'undefined' ? window : globalThis);
