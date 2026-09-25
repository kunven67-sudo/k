// Cinematic post-processing chain: macro depth of field (the "tiny world" look), bloom,
// filmic tone mapping, FXAA, and a final grade with grain / vignette / damage / pixelation.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from '../vendor/three/examples/jsm/postprocessing/Pass.js';
import { FXAAShader } from '../vendor/three/examples/jsm/shaders/FXAAShader.js';
import { getPreset, getSettings } from './settings.js';

const DOFShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000 },
    focus: { value: 5 },
    aperture: { value: 1 },
    maxBlur: { value: 8 },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth;
    uniform float cameraNear, cameraFar, focus, aperture, maxBlur;
    uniform vec2 resolution;
    varying vec2 vUv;
    float viewDist(vec2 uv) {
      float d = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
    }
    float coc(float dist) {
      return clamp(aperture * abs(dist - focus) / max(dist, 1e-3), 0.0, 1.0) * maxBlur;
    }
    void main() {
      float dist = viewDist(vUv);
      float c = coc(dist);
      vec4 base = texture2D(tDiffuse, vUv);
      if (c < 0.5) { gl_FragColor = base; return; }
      vec3 acc = base.rgb; float wsum = 1.0;
      const int N = 28;
      const float GA = 2.39996323;
      for (int i = 1; i < N; i++) {
        float fi = float(i);
        float r = sqrt(fi / float(N)) * c;
        float a = fi * GA;
        vec2 off = vec2(cos(a), sin(a)) * r / resolution;
        vec2 suv = vUv + off;
        vec3 s = texture2D(tDiffuse, suv).rgb;
        float sc = coc(viewDist(suv));
        // Sharp foreground must not smear into blurred background and vice versa.
        float w = smoothstep(r - 1.0, r + 0.5, sc) + 0.02;
        // Mild highlight boost gives the round bokeh "balls" of a macro lens.
        float lum = dot(s, vec3(0.299, 0.587, 0.114));
        w *= 1.0 + smoothstep(1.0, 3.0, lum) * 2.0;
        acc += s * w; wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, base.a);
    }`,
};

// Reads the depth texture of whichever render target the scene was just drawn into.
class DOFPass extends Pass {
  constructor() {
    super();
    this.uniforms = THREE.UniformsUtils.clone(DOFShader.uniforms);
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: DOFShader.vertexShader, fragmentShader: DOFShader.fragmentShader });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.uniforms.tDiffuse.value = readBuffer.texture;
    this.uniforms.tDepth.value = readBuffer.depthTexture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); }
}

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    resolution: { value: new THREE.Vector2(1, 1) },
    grain: { value: 0.05 },
    vignette: { value: 0.35 },
    aberration: { value: 0.0015 },
    damage: { value: 0 },
    heat: { value: 0 },
    pixelate: { value: 0 },
    scanlines: { value: 0 },
    saturation: { value: 1.05 },
    contrast: { value: 1.04 },
    tint: { value: new THREE.Vector3(1, 1, 1) },
    glitch: { value: 0 },
    blackout: { value: 0 },
  },
  vertexShader: DOFShader.vertexShader,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float time, grain, vignette, aberration, damage, heat, pixelate, scanlines, saturation, contrast, glitch, blackout;
    uniform vec2 resolution; uniform vec3 tint;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      if (pixelate > 0.5) {
        vec2 px = resolution / pixelate;
        uv = (floor(uv * px) + 0.5) / px;
      }
      if (glitch > 0.0) {
        float band = floor(uv.y * 24.0 + time * 30.0);
        float g = step(1.0 - glitch * 0.35, rand(vec2(band, floor(time * 20.0))));
        uv.x += (rand(vec2(band, time)) - 0.5) * 0.12 * g * glitch;
      }
      if (heat > 0.0) {
        uv.x += sin(uv.y * 60.0 + time * 6.0) * 0.0025 * heat;
        uv.y += cos(uv.x * 50.0 + time * 5.0) * 0.0018 * heat;
      }
      vec2 dir = uv - 0.5;
      float ab = aberration * (1.0 + damage * 3.0 + glitch * 6.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ab).b;
      // grade
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      col *= tint;
      if (heat > 0.0) col = mix(col, col * vec3(1.25, 0.95, 0.75) + vec3(0.06, 0.02, 0.0), heat * 0.6);
      if (scanlines > 0.0) col *= 1.0 - scanlines * (0.5 + 0.5 * sin(vUv.y * resolution.y * 1.6));
      // vignette + damage
      float v = smoothstep(0.85, 0.2, length(dir * vec2(1.0, 0.8)));
      col *= mix(1.0 - vignette, 1.0, v);
      col = mix(col, vec3(0.55, 0.0, 0.0), damage * (1.0 - v) * 0.85);
      // grain
      col += (rand(vUv * resolution + fract(time) * 100.0) - 0.5) * grain;
      col *= 1.0 - blackout;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = null; this.camera = null;
    this.enabled = false;
    this.fx = { damage: 0, heat: 0, pixelate: 0, scanlines: 0, glitch: 0, aberration: 0.0015, saturation: 1.05, contrast: 1.04, tint: new THREE.Vector3(1, 1, 1), blackout: 0 };
    this.focus = 5; this.aperture = 0.9; this.maxBlur = 7;
    this.dofOverride = null; // force DOF on (cutscenes) regardless of preset, if post is enabled
    this.build();
  }

  build() {
    this.disposeComposer();
    const preset = getPreset();
    this.preset = preset;
    this.enabled = preset.post;
    if (!this.enabled) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    const pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType });
    rt.depthTexture = new THREE.DepthTexture(size.x * pr, size.y * pr);
    rt.depthTexture.type = THREE.UnsignedIntType;
    rt.texture.name = 'PocketSize.rt';
    this.composer = new EffectComposer(this.renderer, rt);
    // The clone shares its depth texture's GPU source with rt1 - give it its own to avoid a feedback loop.
    this.composer.renderTarget2.depthTexture = new THREE.DepthTexture(size.x * pr, size.y * pr);
    this.composer.renderTarget2.depthTexture.type = THREE.UnsignedIntType;
    this.composer.setPixelRatio(pr);
    this.composer.setSize(size.x, size.y);
    this.renderPass = new RenderPass(this.scene || new THREE.Scene(), this.camera || new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.dofPass = new DOFPass();
    this.composer.addPass(this.dofPass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.35, 0.6, 0.9);
    this.composer.addPass(this.bloomPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);
    this.resize(size.x, size.y);
  }

  disposeComposer() {
    if (!this.composer) return;
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    if (this.composer.renderTarget1.depthTexture) this.composer.renderTarget1.depthTexture.dispose();
    if (this.composer.renderTarget2.depthTexture) this.composer.renderTarget2.depthTexture.dispose();
    if (this.bloomPass) this.bloomPass.dispose();
    if (this.dofPass) this.dofPass.dispose();
    this.composer = null;
  }

  setScene(scene, camera) {
    this.scene = scene; this.camera = camera;
    if (this.renderPass) { this.renderPass.scene = scene; this.renderPass.camera = camera; }
  }

  resize(w, h) {
    if (!this.composer) return;
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.dofPass.uniforms.resolution.value.set(w * pr, h * pr);
    this.fxaaPass.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    this.finalPass.uniforms.resolution.value.set(w * pr, h * pr);
    this.bloomPass.resolution.set(w, h);
  }

  render(dt, time) {
    if (!this.enabled || !this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const s = getSettings();
    const p = this.preset;
    const dofOn = this.dofOverride !== null ? this.dofOverride : p.dof;
    this.dofPass.enabled = dofOn && this.maxBlur > 0.3;
    const cam = this.camera;
    const u = this.dofPass.uniforms;
    u.cameraNear.value = cam.near; u.cameraFar.value = cam.far;
    u.focus.value = this.focus; u.aperture.value = this.aperture;
    u.maxBlur.value = this.maxBlur * this.renderer.getPixelRatio();
    this.bloomPass.enabled = p.bloom;
    this.fxaaPass.enabled = p.fxaa && this.fx.pixelate < 0.5;
    const f = this.finalPass.uniforms;
    f.time.value = time;
    f.grain.value = s.filmGrain ? 0.045 : 0;
    f.vignette.value = 0.38;
    f.aberration.value = this.fx.aberration;
    f.damage.value = this.fx.damage;
    f.heat.value = this.fx.heat;
    f.pixelate.value = this.fx.pixelate * this.renderer.getPixelRatio();
    f.scanlines.value = this.fx.scanlines;
    f.glitch.value = this.fx.glitch;
    f.saturation.value = this.fx.saturation;
    f.contrast.value = this.fx.contrast;
    f.tint.value.copy(this.fx.tint);
    f.blackout.value = this.fx.blackout;
    this.composer.render(dt);
  }
}
