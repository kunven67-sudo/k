// Engine: renderer + post-processing + state machine + main loop.
//
// States (boot, menu, creator, world, …) are classes with this shape:
//   class MyState {
//     constructor(engine) {}
//     async enter(params) {}      // build your scene, then engine.setView(scene, camera)
//     update(dt, realDt) {}       // every rendered frame (dt clamped to 1/20 s)
//     fixedUpdate(step) {}        // optional, 60 Hz, right before physics.step()
//     exit() {}                   // dispose what you created
//     onResize(w, h) {}           // optional
//   }
// Register with engine.register('name', MyState) and switch with engine.go('name', params).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { bus } from './events.js';
import { settings } from './settings.js';
import { currentTier, gpu, device } from './quality.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { clock } from './clock.js';
import { sleep } from './util.js';

const FIXED_STEP = 1 / 60;

// Film grain + vignette + subtle chromatic aberration, applied before tone mapping output.
const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.32 },
    uAberration: { value: 0.0012 },
    uBlur: { value: 0.0 }, // 0..1 hungover / drunk / concussion blur
    uTunnel: { value: 0.0 }, // 0..1 death tunnel vision
    uDesat: { value: 0.0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uAberration, uBlur, uTunnel, uDesat;
    uniform vec3 uTint;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 sampleBlur(vec2 uv, float amt) {
      vec3 c = texture2D(tDiffuse, uv).rgb;
      if (amt <= 0.001) return c;
      vec3 acc = c;
      float r = amt * 0.012;
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398;
        acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r).rgb;
      }
      return acc / 9.0;
    }
    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float dist = length(d);
      vec3 col;
      col.r = sampleBlur(uv + d * uAberration * (1.0 + uBlur * 6.0), uBlur).r;
      col.g = sampleBlur(uv, uBlur).g;
      col.b = sampleBlur(uv - d * uAberration * (1.0 + uBlur * 6.0), uBlur).b;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum), uDesat);
      col *= uTint;
      float vig = smoothstep(0.85, 0.2, dist * (1.0 + uVignette));
      col *= mix(1.0, vig, 0.55 + uVignette * 0.4);
      float tunnel = smoothstep(0.62 - uTunnel * 0.55, 0.15 - uTunnel * 0.15, dist);
      col *= mix(1.0, tunnel, uTunnel);
      float n = hash(uv * vec2(1920.0, 1080.0) + fract(uTime) * 97.0) - 0.5;
      col += n * uGrain * (1.0 - lum * 0.6);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.uiRoot = document.getElementById('ui-root');
    this.fadeEl = document.getElementById('fade');
    this.states = new Map();
    this.state = null;
    this.stateName = null;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
    this.physics = null; // a PhysicsWorld owned by the active state
    this.time = 0;
    this.frame = 0;
    this._acc = 0;
    this._last = performance.now();
    this._transitioning = false;
    this.tier = currentTier();
    this.effects = FilmShader.uniforms; // states tweak uBlur / uTunnel / uTint etc.
    this.bloomStrength = 0.6;
    this._createRenderer();
    this._devEl = null;
    bus.on('quality:changed', (tier) => {
      this.tier = tier;
      this._createRenderer(true);
    });
    bus.on('settings:changed', ({ key }) => {
      if (['bloom', 'filmGrain', 'resolutionScale', 'fov'].includes(key)) this._applySettings();
      if (key === 'devOverlay') this._toggleDev();
    });
    window.addEventListener('resize', () => this._resize());
    window.visualViewport?.addEventListener('resize', () => this._resize());
  }

  _createRenderer(recreate = false) {
    if (recreate && this.renderer) {
      this.composer?.dispose?.();
      this.renderer.dispose();
    }
    const tier = this.tier;
    if (!this.renderer || recreate) {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: tier.antialias,
        powerPreference: 'high-performance',
        stencil: false,
        preserveDrawingBuffer: false,
      });
    }
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = tier.shadows;
    r.shadowMap.type = tier.name === 'ultra' || tier.name === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.composer = new EffectComposer(r);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), this.bloomStrength, 0.55, 0.82);
    this.composer.addPass(this.bloomPass);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
    this.filmPass = new ShaderPass(FilmShader);
    this.filmPass.uniforms = FilmShader.uniforms;
    this.filmPass.material.uniforms = FilmShader.uniforms;
    this.composer.addPass(this.filmPass);
    this._applySettings();
    this._resize();
  }

  _applySettings() {
    const tier = this.tier;
    this.bloomPass.enabled = tier.bloom && settings.get('bloom');
    this.filmPass.enabled = tier.postFx;
    FilmShader.uniforms.uGrain.value = settings.get('filmGrain') ? 0.035 : 0;
    this._resize();
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.tier.pixelRatioCap) * settings.get('resolutionScale');
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(w / 2, h / 2);
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.width = w;
    this.height = h;
    this.state?.onResize?.(w, h);
  }

  setView(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this._resize();
  }

  register(name, StateClass) {
    this.states.set(name, StateClass);
  }

  async fade(toBlack, ms = 600) {
    this.fadeEl.style.setProperty('--fade-ms', `${ms}ms`);
    this.fadeEl.classList.toggle('on', toBlack);
    await sleep(ms);
  }

  async go(name, params = {}, { fade = true, fadeMs = 600 } = {}) {
    if (this._transitioning) return;
    const StateClass = this.states.get(name);
    if (!StateClass) throw new Error(`Unknown state "${name}"`);
    this._transitioning = true;
    try {
      if (fade && this.state) await this.fade(true, fadeMs);
      if (this.state) {
        try {
          this.state.exit?.();
        } catch (err) {
          console.error('[engine] exit failed', err);
        }
      }
      this.uiRoot.replaceChildren();
      input.setPointerLock(false);
      if (this.physics) {
        this.physics.dispose();
        this.physics = null;
      }
      FilmShader.uniforms.uBlur.value = 0;
      FilmShader.uniforms.uTunnel.value = 0;
      FilmShader.uniforms.uDesat.value = 0;
      FilmShader.uniforms.uTint.value.set(1, 1, 1);
      const state = new StateClass(this);
      this.state = state;
      this.stateName = name;
      await state.enter(params);
      bus.emit('state:entered', name);
      this._last = performance.now();
      if (fade) await this.fade(false, fadeMs);
    } finally {
      this._transitioning = false;
    }
  }

  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      this._tick(now);
    };
    requestAnimationFrame(loop);
  }

  _tick(now) {
    let realDt = (now - this._last) / 1000;
    this._last = now;
    if (!(realDt > 0)) realDt = 0;
    const dt = Math.min(realDt, 1 / 20);
    this.time += dt;
    this.frame++;
    input.beginFrame();
    if (input.pressed('dev')) settings.set('devOverlay', !settings.get('devOverlay'));

    // Fixed-step simulation.
    this._acc += dt;
    let steps = 0;
    while (this._acc >= FIXED_STEP && steps < 4) {
      this.state?.fixedUpdate?.(FIXED_STEP);
      this.physics?.step();
      this._acc -= FIXED_STEP;
      steps++;
    }
    if (steps === 4) this._acc = 0;
    this.physics?.sync();

    if (this.state && !this._transitioning) {
      clock.update(dt);
      this.state.update?.(dt, realDt);
    } else if (this.state) {
      this.state.update?.(0, realDt);
    }

    audio.setListener(this.camera);
    FilmShader.uniforms.uTime.value = this.time;
    this.bloomPass.strength = this.bloomStrength;
    if (this.tier.postFx) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    input.endFrame();
    if (this._devEl) this._updateDev(realDt);
  }

  _toggleDev() {
    if (settings.get('devOverlay')) {
      this._devEl = document.createElement('div');
      this._devEl.className = 'dev-overlay';
      document.getElementById('app').appendChild(this._devEl);
    } else if (this._devEl) {
      this._devEl.remove();
      this._devEl = null;
    }
  }

  _updateDev(realDt) {
    this._fps = this._fps ? this._fps * 0.95 + (1 / Math.max(realDt, 1e-4)) * 0.05 : 60;
    if (this.frame % 15) return;
    const info = this.renderer.info;
    this._devEl.textContent =
      `${this._fps.toFixed(0)} fps  tier:${this.tier.name}  state:${this.stateName}\n` +
      `calls:${info.render.calls} tris:${(info.render.triangles / 1000).toFixed(1)}k tex:${info.memory.textures} geo:${info.memory.geometries}\n` +
      `time: ${clock.format({ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}\n` +
      `gpu: ${String(gpu.renderer).slice(0, 48)}${device.isMobile ? ' (mobile)' : ''}`;
  }
}
