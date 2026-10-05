// Bakes planet surfaces (terrain, craters, regions, fissures) into cube textures
// once per world, so the live shader can afford lots of detail.
import * as THREE from 'three';
import { NOISE } from './glsl.js';

const BAKE_FRAG = /* glsl */ `
precision highp float;
uniform int uFace;
uniform float uSeed;
uniform float uCraterDensity;
varying vec2 vUv;
${NOISE}

vec3 faceDir(int face, vec2 uv) {
  float sc = uv.x * 2.0 - 1.0;
  float tc = uv.y * 2.0 - 1.0;
  if (face == 0) return vec3(1.0, -tc, -sc);
  if (face == 1) return vec3(-1.0, -tc, sc);
  if (face == 2) return vec3(sc, 1.0, tc);
  if (face == 3) return vec3(sc, -1.0, -tc);
  if (face == 4) return vec3(sc, -tc, 1.0);
  return vec3(-sc, -tc, -1.0);
}

float craterLayer(vec3 p, float freq, float density, float seed) {
  vec3 q = p * freq;
  vec3 i = floor(q);
  vec3 f = fract(q);
  float h = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++) {
    vec3 o = vec3(float(x), float(y), float(z));
    vec3 cell = i + o;
    vec3 r = hash33(cell + seed);
    if (r.z > density) continue;
    vec3 c = o + 0.15 + r * 0.7;
    float rad = 0.18 + 0.42 * pow(hash13(cell * 1.31 + seed), 2.2);
    float d = length(f - c) / rad;
    if (d > 1.8) continue;
    float bowl = d < 1.0 ? (d * d - 1.0) : 0.0;
    // flat floors and central peaks on the bigger craters
    float floorK = smoothstep(0.35, 0.6, rad);
    bowl = mix(bowl, max(bowl, -0.55), floorK);
    float peak = floorK * 0.35 * exp(-d * d * 30.0);
    float rim = 0.32 * exp(-pow((d - 1.0) / 0.2, 2.0));
    float ejecta = 0.08 * exp(-(d - 1.0) * 3.0) * step(1.0, d);
    h += (bowl * 0.85 + rim + peak + ejecta) * rad;
  }
  return h;
}

void main() {
  vec3 p = normalize(faceDir(uFace, vUv));
  vec3 so = vec3(uSeed * 0.0131, uSeed * 0.0177, uSeed * 0.0093);
  // R: terrain height
  vec3 w = vec3(fbm(p * 1.3 + so, 4), fbm(p * 1.3 + so + 5.2, 4), fbm(p * 1.3 + so + 9.7, 4));
  float cont = fbm(p * 1.1 + w * 0.6 + so, 7);
  float mtn = ridged(p * 3.1 + w * 0.4 + so * 1.7, 7);
  float terrain = cont * 0.75 + (mtn - 0.45) * 0.55 * smoothstep(-0.1, 0.35, cont);
  // G: craters at several scales (big basins down to small pits)
  float cr = 0.0;
  cr += craterLayer(p, 2.2, 0.35 * uCraterDensity, uSeed) * 0.9;
  cr += craterLayer(p, 5.5, 0.5 * uCraterDensity, uSeed + 7.0) * 0.6;
  cr += craterLayer(p, 13.0, 0.6 * uCraterDensity, uSeed + 13.0) * 0.4;
  cr += craterLayer(p, 31.0, 0.7 * uCraterDensity, uSeed + 29.0) * 0.25;
  cr += craterLayer(p, 70.0, 0.75 * uCraterDensity, uSeed + 41.0) * 0.12;
  // B: large albedo regions (maria, plains, continents' moisture)
  float region = fbm(p * 0.8 + so * 2.3 + w * 0.3, 5);
  // A: fissures / lineae / cracks
  vec3 pw = p * 2.6 + w * 0.9 + so;
  float l1 = pow(1.0 - abs(snoise(pw)), 14.0);
  float l2 = pow(1.0 - abs(snoise(pw * 2.3 + 3.1)), 18.0) * 0.7;
  float l3 = pow(1.0 - abs(snoise(pw * 5.1 + 8.4)), 22.0) * 0.45;
  float lines = clamp(l1 + l2 + l3, 0.0, 1.0);
  gl_FragColor = vec4(terrain * 0.5 + 0.5, cr * 0.5 + 0.5, region * 0.5 + 0.5, lines);
}
`;

const BAKE_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class SurfaceBaker {
  constructor(renderer) {
    this.renderer = renderer;
    this.cache = new Map();
    this.budget = 160e6;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: BAKE_VERT,
      fragmentShader: BAKE_FRAG,
      uniforms: { uFace: { value: 0 }, uSeed: { value: 0 }, uCraterDensity: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.queue = [];
  }

  key(seed, size) {
    return `${seed}:${size}`;
  }

  // returns a cube texture; may return a lower-res stand-in while baking
  get(seed, size = 256) {
    const k = this.key(seed, size);
    const now = performance.now();
    let e = this.cache.get(k);
    if (e) {
      e.used = now;
      return e.rt.texture;
    }
    e = this.bake(seed, size);
    e.used = now;
    e.bytes = size * size * 6 * 8 * 1.34;
    this.cache.set(k, e);
    this.evict(now);
    return e.rt.texture;
  }

  // free textures nobody has asked for in a while, oldest first, once over budget
  evict(now) {
    let total = 0;
    for (const e of this.cache.values()) total += e.bytes;
    if (total < this.budget) return;
    const old = [...this.cache.entries()].filter(([, e]) => now - e.used > 8000).sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of old) {
      if (total < this.budget) break;
      e.rt.dispose();
      this.cache.delete(k);
      total -= e.bytes;
    }
  }

  bake(seed, size) {
    const rt = new THREE.WebGLCubeRenderTarget(size, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const prevAuto = r.autoClear;
    r.autoClear = true;
    this.mat.uniforms.uSeed.value = (seed % 9973) + 0.37;
    this.mat.uniforms.uCraterDensity.value = 1;
    for (let f = 0; f < 6; f++) {
      this.mat.uniforms.uFace.value = f;
      r.setRenderTarget(rt, f);
      r.render(this.scene, this.cam);
    }
    r.setRenderTarget(prev);
    r.autoClear = prevAuto;
    return { rt };
  }
}
