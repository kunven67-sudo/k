import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// Graphics presets. "auto" starts at high and steps down if the real GPU can't hold the frame rate.
export const PRESETS = {
  low:    { scale: 0.7,  shadows: false, shadowSize: 512,  ao: false, bloom: false, msaa: 0, mirror: 0.35, aniso: 2 },
  medium: { scale: 0.85, shadows: true,  shadowSize: 1024, ao: false, bloom: true,  msaa: 0, mirror: 0.5,  aniso: 4 },
  high:   { scale: 1.0,  shadows: true,  shadowSize: 2048, ao: true,  bloom: true,  msaa: 4, mirror: 0.75, aniso: 8 },
  ultra:  { scale: 1.0,  shadows: true,  shadowSize: 4096, ao: true,  bloom: true,  msaa: 8, mirror: 1.0,  aniso: 16, hiDPI: true },
};
const ORDER = ['low', 'medium', 'high', 'ultra'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    const r = this.gl;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    RectAreaLightUniformsLib.init();
    this.setting = 'auto';
    this.level = 'high';
    this.p = PRESETS.high;
    this.listeners = [];
    this.fpsSamples = [];
    this.lastStep = 0;
    this.fps = 60;
  }

  setup(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.rebuild();
    addEventListener('resize', () => this.resize());
  }

  rebuild() {
    const p = this.p;
    const r = this.gl;
    const size = this.size();
    if (this.composer) this.composer.dispose?.();
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: p.msaa });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.ao = null;
    if (p.ao) {
      this.ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      this.ao.output = GTAOPass.OUTPUT.Default;
      this.ao.blendIntensity = 0.85;
      this.ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: this.level === 'ultra' ? 16 : 10 });
      this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.composer.addPass(this.ao);
    }
    if (p.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 0.92);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    r.shadowMap.enabled = p.shadows;
    this.resize();
    for (const f of this.listeners) f(this.level, p);
  }

  size() {
    const dpr = this.p.hiDPI ? Math.min(devicePixelRatio, 2) : 1;
    return new THREE.Vector2(Math.floor(innerWidth * dpr * this.p.scale), Math.floor(innerHeight * dpr * this.p.scale));
  }

  resize() {
    const s = this.size();
    const dpr = this.p.hiDPI ? Math.min(devicePixelRatio, 2) : 1;
    this.gl.setPixelRatio(dpr * this.p.scale);
    this.gl.setSize(innerWidth, innerHeight, false);
    this.composer.setPixelRatio(1);
    this.composer.setSize(s.x, s.y);
    if (this.camera) { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); }
  }

  onChange(f) { this.listeners.push(f); }

  set(setting) {
    this.setting = setting;
    const lvl = setting === 'auto' ? 'high' : setting;
    this.level = lvl;
    this.p = PRESETS[lvl];
    this.fpsSamples = [];
    this.lastStep = performance.now();
    if (this.scene) this.rebuild();
  }

  // Called every frame with the real frame time. Auto mode only ever steps down while playing,
  // and steps back up once if there's lots of headroom, so it never flip-flops.
  track(dt) {
    this.fpsSamples.push(dt);
    if (this.fpsSamples.length > 240) this.fpsSamples.shift();
    const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
    this.fps = 1 / Math.max(avg, 1e-3);
    if (this.setting !== 'auto' || this.fpsSamples.length < 180) return;
    const now = performance.now();
    if (now - this.lastStep < 8000) return;
    const i = ORDER.indexOf(this.level);
    if (this.fps < 34 && i > 0) this.stepTo(ORDER[i - 1]);
    else if (this.fps > 75 && i < 2 && !this.steppedDown) this.stepTo(ORDER[i + 1]);
  }

  stepTo(lvl) {
    if (ORDER.indexOf(lvl) < ORDER.indexOf(this.level)) this.steppedDown = true;
    this.level = lvl;
    this.p = PRESETS[lvl];
    this.fpsSamples = [];
    this.lastStep = performance.now();
    this.rebuild();
  }

  render() {
    this.composer.render();
  }

  gpuName() {
    const gl = this.gl.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(raw || '');
  }
}
