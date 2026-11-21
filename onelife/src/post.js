// Final picture pass: electron vision (when you're smaller than light), what near-light speed really does
// to what you see (things bunch up in front, blue ahead / red behind), reality tearing past light speed,
// heat, injury, sonic boom flash, fades.
import * as THREE from 'three';

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
    this.U = {
      tDiff: { value: this.rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 },
      uElectron: { value: 0 }, uBeta: { value: 0 }, uBreak: { value: 0 }, uHeat: { value: 0 }, uHurt: { value: 0 },
      uFlash: { value: 0 }, uFade: { value: 0 }, uBlur: { value: 0 }, uGlitch: { value: 0 }, uDesat: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({
      uniforms: this.U, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
varying vec2 vUv; uniform sampler2D tDiff; uniform vec2 uRes; uniform float uTime, uElectron, uBeta, uBreak, uHeat, uHurt, uFlash, uFade, uBlur, uGlitch, uDesat;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 hue(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a); return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca); }
void main(){
  vec2 uv = vUv, c = uv - 0.5; c.x *= uRes.x / uRes.y;
  float r = length(c);
  // relativistic aberration: everything squeezes toward the direction you're going
  float b = clamp(uBeta, 0.0, 0.995);
  if (b > 0.0) { float s = mix(1.0, sqrt((1.0 - b) / (1.0 + b)), 0.85); vec2 d = c * mix(1.0, s, smoothstep(0.0, 0.9, r)); d.x /= uRes.x / uRes.y; uv = 0.5 + d; }
  // reality breaking: blocks slide out of place
  if (uBreak > 0.0) {
    vec2 blk = floor(uv * vec2(18.0, 10.0) + floor(uTime * 9.0));
    float g = step(1.0 - uBreak * 0.45, h(blk));
    uv += (vec2(h(blk + 1.3), h(blk + 7.1)) - 0.5) * 0.25 * g * uBreak;
    uv.x += sin(uv.y * 80.0 + uTime * 30.0) * 0.01 * uBreak;
  }
  if (uGlitch > 0.0) { float line = step(0.985 - uGlitch * 0.1, h(vec2(floor(uv.y * 90.0), floor(uTime * 20.0)))); uv.x += line * (h(vec2(uTime)) - 0.5) * 0.08 * uGlitch; }
  // motion blur toward the middle when very fast
  vec3 col = vec3(0.0);
  if (uBlur > 0.001) { vec2 dir = (uv - 0.5) * uBlur * 0.12; for (int i = 0; i < 8; i++) col += texture2D(tDiff, uv - dir * float(i) / 8.0).rgb; col /= 8.0; }
  else col = texture2D(tDiff, uv).rgb;
  if (uBreak > 0.0) { col.r = mix(col.r, texture2D(tDiff, uv + vec2(0.012, 0.0) * uBreak).r, 0.8); col.b = mix(col.b, texture2D(tDiff, uv - vec2(0.012, 0.0) * uBreak).b, 0.8); }
  // doppler: light ahead shifts blue (and brighter), light at the edges shifts red
  if (b > 0.0) { float ahead = 1.0 - smoothstep(0.0, 0.8, r); col = mix(col, hue(col, -1.4 * b) * (1.0 + 2.5 * b), ahead * b); col = mix(col, col * vec3(1.3, 0.35, 0.2), (1.0 - ahead) * b); col *= mix(1.0, 0.25, (1.0 - ahead) * b * b); }
  // electron vision: smaller than light, so the suit "sees" with electrons, like a scanning microscope
  if (uElectron > 0.0) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    vec2 px = 1.0 / uRes; float e = abs(dot(texture2D(tDiff, uv + vec2(px.x, 0)).rgb - texture2D(tDiff, uv - vec2(px.x, 0)).rgb, vec3(0.33))) + abs(dot(texture2D(tDiff, uv + vec2(0, px.y)).rgb - texture2D(tDiff, uv - vec2(0, px.y)).rgb, vec3(0.33)));
    float sem = pow(clamp(l * 1.25 + e * 2.2, 0.0, 1.0), 0.85) + (h(uv * uRes + uTime) - 0.5) * 0.07;
    // false color, like scientists color real electron microscope pictures: shape from the electron image, color from what it is
    vec3 hue = col / max(1e-3, max(col.r, max(col.g, col.b)));
    col = mix(col, sem * mix(vec3(1.0), hue, 0.85) * 1.2, uElectron);
  }
  if (uBreak > 0.6) col = mix(col, 1.0 - col, smoothstep(0.6, 1.2, uBreak) * step(0.5, h(vec2(floor(uTime * 6.0)))));
  // heat haze glow (hypersonic air)
  col += vec3(1.0, 0.45, 0.12) * uHeat * smoothstep(0.25, 0.9, r) * 0.9;
  // injury: colour drains, red at the edges
  float gray = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(col, vec3(gray), uDesat);
  col = mix(col, col * vec3(0.55, 0.05, 0.05), smoothstep(0.35, 0.95, r) * uHurt);
  col *= 1.0 - smoothstep(0.55, 1.15, r) * 0.38; // lens vignette
  col = mix(col, vec3(1.0), uFlash);
  col *= 1.0 - uFade;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); this.quad.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.quad); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) { this.rt.setSize(w, h); this.U.uRes.value.set(w, h); }
  render(scene, camera, t) {
    this.U.uTime.value = t;
    this.r.setRenderTarget(this.rt); this.r.render(scene, camera);
    this.r.setRenderTarget(null); this.r.render(this.scene, this.cam);
  }
}
