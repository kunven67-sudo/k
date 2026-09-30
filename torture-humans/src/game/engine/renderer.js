// Renderer + post effects, driven by the graphics settings.
// Chain: scene -> [GTAO] -> [bloom] -> output (tone map + sRGB) -> [SMAA | FXAA]
// Shadows: cascaded shadow maps (CSM) for the sun, sharp near you, wide far away.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { CSM } from 'three/addons/csm/CSM.js';
import { SHADOW_MAP_SIZE, SHADOW_CASCADES } from './settings.js';

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // soft edges come from shadow.radius
    this.renderer.setClearColor(0x000000);
    this.scene = null;
    this.camera = null;
    this.csm = null;
    this.composer = null;
    this.fps = 0;
    this.frameTimes = [];
    this.lastRender = 0;
    this.unsub = settings.onChange((data, patch) => { if (patch.graphics) this.apply(); });
  }

  // sunDirection: null for indoor levels (no sun, no cascaded shadows)
  setScene(scene, camera, { sunDirection = new THREE.Vector3(-0.4, -1, -0.3) } = {}) {
    this.scene = scene;
    this.camera = camera;
    this.sunDirection = sunDirection ? sunDirection.clone().normalize() : null;
    this.apply();
  }

  get g() {
    return this.settings.get('graphics');
  }

  apply() {
    if (!this.scene) return;
    const g = this.g;
    const r = this.renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * (g.resolutionScale || 1));
    r.setSize(w, h, false);
    r.toneMappingExposure = g.brightness || 1;
    this.camera.aspect = w / h;
    this.camera.fov = g.fov || 75;
    this.camera.far = g.drawDistance || 700;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog?.isFog) this.scene.fog.far = (g.drawDistance || 700) * 0.95;

    // --- sun shadows
    this.csm?.remove();
    this.csm?.dispose();
    this.csm = null;
    const size = SHADOW_MAP_SIZE[g.shadows] || 0;
    r.shadowMap.enabled = size > 0;
    // indoor lamps with shadows follow the shadow quality too
    this.scene.traverse((o) => {
      if (o.isLight && o.castShadow && !o.userData.csm) {
        o.shadow.mapSize.setScalar(Math.max(256, size / 4));
        o.shadow.map?.dispose();
        o.shadow.map = null;
      }
    });
    if (size > 0 && this.sunDirection) {
      this.csm = new CSM({
        maxFar: g.shadowDistance || 100,
        cascades: SHADOW_CASCADES[g.shadows] || 2,
        mode: 'practical',
        parent: this.scene,
        shadowMapSize: size,
        lightDirection: this.sunDirection,
        lightIntensity: this.sunIntensity ?? 3,
        camera: this.camera,
        shadowBias: -0.0002,
        lightMargin: 60,
      });
      for (const l of this.csm.lights) {
        l.color.copy(this.sunColor ?? new THREE.Color(0xfff2e0));
        l.shadow.normalBias = 0.02;
        l.shadow.radius = 2;
      }
      this.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) this.csm.setupMaterial(m); });
    }
    this.buildComposer();
    // anisotropic filtering on every texture
    const aniso = Math.min(g.anisotropy || 1, r.capabilities.getMaxAnisotropy());
    this.scene.traverse((o) => {
      for (const m of [].concat(o.material || [])) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
          if (m[k] && m[k].anisotropy !== aniso) { m[k].anisotropy = aniso; m[k].needsUpdate = true; }
        }
      }
    });
  }

  // new materials added later (spawned objects) need the CSM shader hook too
  setupMaterial(material) {
    if (this.csm) for (const m of [].concat(material)) this.csm.setupMaterial(m);
  }

  buildComposer() {
    const g = this.g;
    const r = this.renderer;
    this.composer?.dispose();
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: g.antialias === 'msaa' ? 4 : 0,
    });
    const composer = new EffectComposer(r, target);
    composer.setPixelRatio(1);
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (g.ssao) {
      const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1, thickness: 1, scale: 1, samples: g.shadows === 'ultra' ? 16 : 8 });
      ao.blendIntensity = 0.9;
      composer.addPass(ao);
    }
    // bloom only for things far brighter than daylight (lamps, screens, ray beams);
    // the sky is HDR too, so a low threshold would wash the whole picture out like fog
    if (g.bloom) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.4, 6);
      bloom.name = 'bloom';
      composer.addPass(bloom);
    }
    composer.addPass(new OutputPass());
    if (g.antialias === 'smaa') composer.addPass(new SMAAPass(size.x, size.y));
    else if (g.antialias === 'fxaa') composer.addPass(new FXAAPass());
    this.composer = composer;
  }

  resize() {
    this.apply();
  }

  // returns false when this frame was skipped by the FPS limit
  render(now = performance.now()) {
    const limit = this.g.fpsLimit || 0;
    if (limit > 0 && now - this.lastRender < 1000 / limit - 0.5) return false;
    this.frameTimes.push(now);
    while (this.frameTimes.length && now - this.frameTimes[0] > 1000) this.frameTimes.shift();
    this.fps = this.frameTimes.length;
    this.lastRender = now;
    this.csm?.update();
    this.composer.render();
    return true;
  }

  dispose() {
    this.unsub?.();
    this.csm?.remove();
    this.csm?.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
