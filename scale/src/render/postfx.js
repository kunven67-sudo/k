// Screen effects that make the picture look like a real camera saw it.
//
// Ambient occlusion (AO): in real life, light that bounces around a room reaches open surfaces more
// than tight spots, so corners, the floor under a sofa, the gap where a cup sits on a table and the
// ground right under a spider's feet are a little darker. Games without it look flat and fake. This is
// a fast version (scalable ambient obscurance): from the depth of each pixel it rebuilds the 3D point
// and its surface direction, checks a dozen nearby points, and darkens by how much is around it.
// It runs at half resolution with an edge-aware blur, and its reach follows your size (it works the
// same at 1.75 m and at 2 mm).
//
// Finish: a very soft vignette and fine film grain (a real camera sensor), after anti-aliasing.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const AO_FRAG = /* glsl */ `
#define NS 12
uniform sampler2D tDepth;
uniform vec2 uRes;        // AO target size (pixels)
uniform mat4 uProjInv;
uniform mat4 uProj;
uniform float uRadius;    // reach (view-space meters)
uniform float uIntensity;
uniform float uFrame;
varying vec2 vUv;

vec3 viewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}

void main() {
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec2 px = 1.0 / uRes;
  vec3 Pr = viewPos(vUv + vec2(px.x, 0.0)), Pl = viewPos(vUv - vec2(px.x, 0.0));
  vec3 Pu = viewPos(vUv + vec2(0.0, px.y)), Pd = viewPos(vUv - vec2(0.0, px.y));
  // Pick the smaller step on each axis so edges don't get a smeared normal.
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  // How big the reach looks on screen (in screen heights), clamped so it never costs too much.
  float rS = clamp(uRadius * uProj[1][1] / max(1e-6, -P.z) * 0.5, 3.0 * px.y, 0.12);
  float aspect = uRes.y / uRes.x;
  // Interleaved gradient noise: a different rotation per pixel (the blur smooths it out).
  float rot = 6.2831853 * fract(52.9829189 * fract(dot(gl_FragCoord.xy + uFrame * 5.588238, vec2(0.06711056, 0.00583715))));
  float r2 = uRadius * uRadius;
  float sum = 0.0;
  for (int i = 0; i < NS; i++) {
    float t = (float(i) + 0.5) / float(NS);
    float a = float(i) * 2.3999632 + rot;
    vec2 off = vec2(cos(a) * aspect, sin(a)) * (t * t * 0.85 + 0.15) * rS;
    vec3 v = viewPos(vUv + off) - P;
    float vv = dot(v, v);
    float vn = dot(v, N) - 0.002 * uRadius;
    sum += max(0.0, vn) / (vv + 0.02 * r2) * max(0.0, 1.0 - vv / r2);
  }
  float ao = max(0.0, 1.0 - uIntensity * uRadius * sum * (2.0 / float(NS)));
  gl_FragColor = vec4(vec3(ao * ao), 1.0);
}
`;

// Edge-aware blur: neighbors on the same surface (similar depth) count, others don't.
const BLUR_FRAG = /* glsl */ `
uniform sampler2D tAO;
uniform sampler2D tDepth;
uniform vec2 uDir;        // one texel step in uv
uniform mat4 uProjInv;
varying vec2 vUv;
float vz(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return v.z / v.w;
}
void main() {
  float z0 = vz(vUv);
  float s = 0.0, w = 0.0;
  for (int i = -3; i <= 3; i++) {
    vec2 uv = vUv + uDir * float(i);
    float z = vz(uv);
    float k = exp(-abs(z - z0) / max(1e-6, abs(z0) * 0.04)) * (1.0 - abs(float(i)) / 4.5);
    s += texture2D(tAO, uv).r * k;
    w += k;
  }
  gl_FragColor = vec4(vec3(s / max(w, 1e-5)), 1.0);
}
`;

const COMPOSE_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform sampler2D tAO;
uniform float uStrength;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  float ao = texture2D(tAO, vUv).r;
  // Very bright things (lamps, the sun's glint) are light sources, not surfaces: barely darkened.
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float k = uStrength * (1.0 - smoothstep(1.5, 6.0, lum));
  gl_FragColor = vec4(c.rgb * mix(1.0, ao, k), c.a);
}
`;

export class AOPass extends Pass {
  constructor(view) {
    super();
    this.view = view;
    this.needsSwap = true;
    this.radius = 0.5; // set every frame from your size
    this.strength = 0.85;
    this.half = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: false });
    this.half2 = this.half.clone();
    this.aoMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: AO_FRAG,
      uniforms: { tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uProjInv: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() }, uRadius: { value: 0.5 }, uIntensity: { value: 0.9 }, uFrame: { value: 0 } },
      depthTest: false, depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: BLUR_FRAG,
      uniforms: { tAO: { value: null }, tDepth: { value: null }, uDir: { value: new THREE.Vector2() }, uProjInv: { value: new THREE.Matrix4() } },
      depthTest: false, depthWrite: false,
    });
    this.composeMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: COMPOSE_FRAG,
      uniforms: { tDiffuse: { value: null }, tAO: { value: null }, uStrength: { value: 0.85 } },
      depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.aoMat);
    this.frame = 0;
  }

  setSize(w, h) {
    const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2));
    this.half.setSize(hw, hh);
    this.half2.setSize(hw, hh);
    this.aoMat.uniforms.uRes.value.set(hw, hh);
  }

  render(renderer, writeBuffer, readBuffer) {
    const cam = this.view.lastCam;
    const depth = readBuffer.depthTexture;
    if (!cam || !depth) {
      // Nothing to work with: pass the picture through.
      this.composeMat.uniforms.tDiffuse.value = readBuffer.texture;
      this.composeMat.uniforms.uStrength.value = 0;
      this.quad.material = this.composeMat;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
      return;
    }
    const u = this.aoMat.uniforms;
    u.tDepth.value = depth;
    u.uProj.value.copy(cam.projectionMatrix);
    u.uProjInv.value.copy(cam.projectionMatrixInverse);
    u.uRadius.value = this.radius;
    u.uFrame.value = this.frame++ % 64;
    this.quad.material = this.aoMat;
    renderer.setRenderTarget(this.half);
    this.quad.render(renderer);
    // Blur: across, then down.
    const b = this.blurMat.uniforms;
    b.tDepth.value = depth;
    b.uProjInv.value.copy(cam.projectionMatrixInverse);
    this.quad.material = this.blurMat;
    b.tAO.value = this.half.texture;
    b.uDir.value.set(1 / this.half.width, 0);
    renderer.setRenderTarget(this.half2);
    this.quad.render(renderer);
    b.tAO.value = this.half2.texture;
    b.uDir.value.set(0, 1 / this.half.height);
    renderer.setRenderTarget(this.half);
    this.quad.render(renderer);
    // Apply.
    const c = this.composeMat.uniforms;
    c.tDiffuse.value = readBuffer.texture;
    c.tAO.value = this.half.texture;
    c.uStrength.value = this.strength;
    this.quad.material = this.composeMat;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.half.dispose();
    this.half2.dispose();
    this.aoMat.dispose();
    this.blurMat.dispose();
    this.composeMat.dispose();
    this.quad.dispose();
  }
}

// Last step: soft vignette + fine animated film grain (like a real camera), in display colors.
export const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.22 }, uGrain: { value: 0.022 } },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // A gentle S-curve and a touch of saturation (what a camera's picture style does).
      c.rgb = clamp((c.rgb - 0.5) * 1.06 + 0.5, 0.0, 1.0);
      float g = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = clamp(mix(vec3(g), c.rgb, 1.05), 0.0, 1.0);
      vec2 q = vUv - 0.5;
      c.rgb *= 1.0 - uVignette * smoothstep(0.1, 0.75, dot(q, q) * 2.0);
      float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0, vec2(0.06711056, 0.00583715))));
      // Grain shows more in the darks, like film and camera sensors.
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb += (n - 0.5) * uGrain * (1.2 - lum);
      gl_FragColor = c;
    }
  `,
};
