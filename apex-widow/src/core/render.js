// Renderer + post-processing for APEX WIDOW.
// Pipeline: scene -> NaN guard -> (AO) -> (depth of field) -> grade + bloom + tone map + vignette (+ vision/hit FX) -> SMAA
// The camera's near/far change every frame (the spider goes from 4 mm to galaxy size), so every effect that reads
// depth gets the camera settings again each frame (postprocessing only copies them when the camera is set).
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, SMAAEffect, SMAAPreset, Effect, BlendFunction, DepthOfFieldEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export const QUALITY = {
  low:    { label: 'Low',    msaa: 0, ao: false, bloom: true, dof: false, shadow: 1024, scale: 0.75, aniso: 2,  hair: 0.25, detail: 0.5,  lights: 2, crowd: 0.4 },
  medium: { label: 'Medium', msaa: 0, ao: false, bloom: true, dof: true,  shadow: 2048, scale: 0.9,  aniso: 4,  hair: 0.5,  detail: 0.75, lights: 4, crowd: 0.7 },
  high:   { label: 'High',   msaa: 2, ao: true,  bloom: true, dof: true,  shadow: 2048, scale: 1.0,  aniso: 8,  hair: 1.0,  detail: 1.0,  lights: 6, crowd: 1.0 },
  ultra:  { label: 'Ultra',  msaa: 4, ao: true,  bloom: true, dof: true,  shadow: 4096, scale: 1.0,  aniso: 16, hair: 1.4,  detail: 1.25, lights: 8, crowd: 1.3 },
};

// exposure + colour grade + film grain + "hunter vision" + hit flash. Runs before tone mapping (HDR in).
class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */`
      uniform float exposure; uniform float saturation; uniform float contrast; uniform vec3 tint; uniform float grain;
      uniform float gTime; uniform float vision; uniform float hurt; uniform float flash; uniform vec3 flashColor;
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = max(inputColor.rgb, 0.0) * exposure;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, saturation);
        // contrast around a mid-grey in log-ish space (safe for 0)
        c = max(vec3(0.18) * pow(max(c / 0.18, vec3(1e-6)), vec3(contrast)), 0.0);
        c *= tint;
        // hunter vision: the world goes cold and dark, warm living things stay bright (they get emissive heat colour)
        if (vision > 0.001) {
          float lv = dot(c, vec3(0.2126, 0.7152, 0.0722));
          vec3 cold = vec3(0.10, 0.16, 0.24) * sqrt(max(lv, 0.0)) * 1.6;
          float hot = smoothstep(0.6, 3.0, max(c.r - c.b * 0.6, 0.0) + max(lv - 1.5, 0.0));
          c = mix(c, mix(cold, c, hot), vision);
        }
        // hurt: red edges
        if (hurt > 0.001) {
          vec2 d = uv - 0.5; float e = smoothstep(0.25, 0.75, length(d * vec2(1.3, 1.0)));
          c = mix(c, c * vec3(1.6, 0.25, 0.2) + vec3(0.06, 0.0, 0.0), e * hurt);
        }
        float n = h12(uv * resolution + fract(gTime * 13.7) * 311.0) - 0.5;
        c += n * grain * (0.25 + sqrt(max(l, 0.0)));
        c = mix(c, flashColor * 3.0, flash);
        outputColor = vec4(max(c, 0.0), inputColor.a);
      }`, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map([
        ['exposure', new THREE.Uniform(1)], ['saturation', new THREE.Uniform(1)], ['contrast', new THREE.Uniform(1.06)],
        ['tint', new THREE.Uniform(new THREE.Vector3(1, 1, 1))], ['grain', new THREE.Uniform(0.018)],
        ['gTime', new THREE.Uniform(0)], ['vision', new THREE.Uniform(0)], ['hurt', new THREE.Uniform(0)],
        ['flash', new THREE.Uniform(0)], ['flashColor', new THREE.Uniform(new THREE.Vector3(1, 1, 1))],
      ]),
    });
  }
}

// Safety net: one NaN/Inf pixel (a shader doing pow() of a negative number on a Windows PC, for example) would get
// smeared over the whole screen by bloom = black screen. Broken pixels become black, crazy-bright ones get capped.
class SanitizeEffect extends Effect {
  constructor() {
    super('SanitizeEffect', /* glsl */`
      bool ssBad(float v) { return (floatBitsToUint(v) & 0x7f800000u) == 0x7f800000u; }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        if (ssBad(c.r) || ssBad(c.g) || ssBad(c.b) || max(c.r, max(c.g, c.b)) > 2000.0) c = vec3(0.0);
        outputColor = vec4(clamp(c, 0.0, 512.0), ssBad(inputColor.a) ? 1.0 : inputColor.a);
      }`, { blendFunction: BlendFunction.SET });
  }
}

// chromatic split + slight lens warp for big hits, glitches and the black hole
class LensEffect extends Effect {
  constructor() {
    super('LensEffect', /* glsl */`
      uniform float split; uniform float warp;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        if (split < 0.0005 && warp < 0.0005) { outputColor = inputColor; return; }
        vec2 d = uv - 0.5;
        vec2 w = uv + d * dot(d, d) * warp;
        vec2 o = d * split;
        float r = texture2D(inputBuffer, w + o).r;
        float g = texture2D(inputBuffer, w).g;
        float b = texture2D(inputBuffer, w - o).b;
        outputColor = vec4(r, g, b, inputColor.a);
      }`, { blendFunction: BlendFunction.SET, uniforms: new Map([['split', new THREE.Uniform(0)], ['warp', new THREE.Uniform(0)]]) });
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, stencil: false, depth: false, powerPreference: 'high-performance', alpha: false });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFShadowMap;
    this.r.info.autoReset = false;
    this.gpu = '';
    try {
      const gl = this.r.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
      this.gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch (e) {}
    this.software = /swiftshader|llvmpipe|basic render|software/i.test(this.gpu);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dynScale = 1; this.frameTimes = [];
    this.scene = null; this.camera = null; this.time = 0;
    this.dofStrength = 0; this.dofFocus = 1; this.dofRange = 1;
    this.lastNear = -1; this.lastFar = -1;
    this.maxAniso = this.r.capabilities.getMaxAnisotropy();
    let q = 'auto';
    try { q = localStorage.getItem('aw.quality') || 'auto'; } catch (e) {}
    this.setQuality(q, true);
    window.addEventListener('resize', () => this.resize());
  }

  // 'auto' picks a starting preset from the GPU name and then dynamic resolution keeps it smooth
  pickAuto() {
    const g = this.gpu.toLowerCase();
    if (this.software) return 'low';
    if (/gt 10[1-3]0|gt 7[0-9]0|mx ?[1-4]\d0|intel|uhd|iris|hd graphics|radeon\(tm\) graphics|vega [3-8]\b|adreno|mali|apple m1/.test(g)) return 'medium';
    if (/rtx [2-5]0[6-9]0|rtx [3-5]0[7-9]0|rx [67][7-9]00|rx 9\d{3}/.test(g)) return 'ultra';
    return 'high';
  }

  setQuality(name, initial = false) {
    this.qSetting = QUALITY[name] || name === 'auto' ? name : 'auto';
    const real = this.qSetting === 'auto' ? this.pickAuto() : this.qSetting;
    this.qName = real; this.q = QUALITY[real];
    try { localStorage.setItem('aw.quality', this.qSetting); } catch (e) {}
    this.autoRes = this.qSetting === 'auto' || this.qSetting === 'low' || this.qSetting === 'medium';
    this.dynScale = 1;
    this.buildComposer();
    if (!initial && this.onQuality) this.onQuality(this.q);
  }

  buildComposer() {
    if (this.composer) this.composer.dispose();
    const q = this.q;
    const cam = this.camera || new THREE.PerspectiveCamera();
    const scn = this.scene || new THREE.Scene();
    const ms = Math.min(q.msaa, this.r.capabilities.maxSamples || 0);
    this.composer = new EffectComposer(this.r, { frameBufferType: THREE.HalfFloatType, multisampling: ms });
    this.renderPass = new RenderPass(scn, cam);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new EffectPass(cam, new SanitizeEffect()));
    this.aoPass = null;
    if (q.ao) {
      const s = this.size();
      this.aoPass = new N8AOPostPass(scn, cam, s.w, s.h);
      Object.assign(this.aoPass.configuration, {
        aoRadius: 0.5, distanceFalloff: 1.0, intensity: 2.0, color: new THREE.Color(0, 0, 0),
        halfRes: this.qName !== 'ultra', depthAwareUpsampling: true, aoSamples: this.qName === 'ultra' ? 16 : 10,
        denoiseSamples: 8, denoiseRadius: 12, gammaCorrection: false,
      });
      this.composer.addPass(this.aoPass);
    }
    this.dof = new DepthOfFieldEffect(cam, { worldFocusDistance: 1, worldFocusRange: 1, bokehScale: 2.5, resolutionScale: 0.5 });
    this.dofPass = new EffectPass(cam, this.dof, new SanitizeEffect());
    this.dofPass.enabled = false;
    this.composer.addPass(this.dofPass);
    this.grade = new GradeEffect();
    this.bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.3, intensity: 1.0, radius: 0.7, levels: 8 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    this.vignette = new VignetteEffect({ offset: 0.3, darkness: 0.6 });
    this.lens = new LensEffect();
    const fx = [this.grade];
    if (q.bloom) fx.push(this.bloom);
    fx.push(this.tone, this.vignette);
    this.mainPass = new EffectPass(cam, ...fx);
    this.composer.addPass(this.mainPass);
    this.lensPass = new EffectPass(cam, this.lens);
    this.composer.addPass(this.lensPass);
    if (!ms) this.composer.addPass(new EffectPass(cam, new SMAAEffect({ preset: SMAAPreset.HIGH })));
    this.resize();
    if (this.scene) this.setView(this.scene, this.camera);
  }

  setView(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.renderPass.mainScene = scene; this.renderPass.mainCamera = camera;
    if (this.aoPass) { this.aoPass.scene = scene; this.aoPass.camera = camera; }
    for (const p of this.composer.passes) { p.mainScene = scene; p.mainCamera = camera; }
    this.lastNear = -1;
    this.resize();
  }

  // call after changing camera.near/far: every depth-reading effect needs the new numbers
  syncCamera() {
    const c = this.camera;
    if (c.near === this.lastNear && c.far === this.lastFar) return;
    this.lastNear = c.near; this.lastFar = c.far;
    for (const p of this.composer.passes) if (p.fullscreenMaterial && p.fullscreenMaterial.copyCameraSettings) p.fullscreenMaterial.copyCameraSettings(c);
    if (this.dof) {
      this.dof.cocMaterial.copyCameraSettings(c);
      for (const k of ['maskPass', 'cocPass']) {
        const p = this.dof[k]; if (!p) continue;
        for (const mat of [p.fullscreenMaterial, p.overrideMaterial]) if (mat && mat.copyCameraSettings) mat.copyCameraSettings(c);
      }
    }
  }

  // strength 0 = off. focus/range in world units (focus = distance to the spider, range grows with its size)
  setDOF(strength, focus, range) {
    const on = strength > 0.02 && this.q.dof;
    this.dofPass.enabled = on;
    if (!on) return;
    this.dof.cocMaterial.worldFocusDistance = focus;
    this.dof.cocMaterial.worldFocusRange = range;
    this.dof.bokehScale = 1 + strength * 3.5;
  }

  size() {
    return { w: this.canvas.clientWidth || window.innerWidth, h: this.canvas.clientHeight || window.innerHeight };
  }

  resize() {
    const { w, h } = this.size();
    const pr = this.dpr * this.q.scale * this.dynScale;
    this.r.setPixelRatio(pr);
    this.composer.setSize(w, h, false);
    if (this.aoPass) this.aoPass.setSize(Math.round(w * pr), Math.round(h * pr));
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.pixelRatio = pr;
  }

  // dynamic resolution: keeps the effects and drops pixels when frames get slow
  trackFrame(dt) {
    if (!this.autoRes) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 60) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    let s = this.dynScale;
    if (avg > 1 / 36 && s > 0.55) s = Math.max(0.55, s - 0.08);
    else if (avg < 1 / 56 && s < 1) s = Math.min(1, s + 0.04);
    if (s !== this.dynScale) { this.dynScale = s; this.resize(); }
  }

  render(dt) {
    this.time += dt;
    this.grade.uniforms.get('gTime').value = this.time;
    this.syncCamera();
    this.r.info.reset();
    this.composer.render(dt);
  }
}
