// The renderer. Draws the world from a camera whose near/far planes follow the player's size.
//
// Why two passes: a depth buffer only has so much precision between near and far. At 2 mm tall the
// near plane is ~0.1 mm away, but you still want to see the ceiling 2.5 m up and the street 40 m
// away. One pass from 0.1 mm to 4 km would z-fight everywhere. So when the range is too big we draw
// the far part first (from a split distance outward), clear depth, then draw the near part. Each
// pass has a healthy near/far ratio. The sky is drawn first in its own scene at infinity.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

const SPLIT_RATIO = 8000; // max far/near ratio per pass

class ScaleScenePass extends Pass {
  constructor(view) {
    super();
    this.view = view;
    this.needsSwap = false;
    this.clear = true;
  }

  render(renderer, writeBuffer, readBuffer) {
    const v = this.view;
    const cam = v.camera;
    const scene = v.scene;
    if (!cam || !scene) return;
    const oldAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);

    // Sky at infinity (no shadow work for it).
    renderer.shadowMap.needsUpdate = false;
    if (v.skyScene) {
      const sc = v.skyCam;
      sc.fov = cam.fov;
      sc.aspect = cam.aspect;
      sc.quaternion.copy(cam.quaternion);
      sc.updateProjectionMatrix();
      sc.updateMatrixWorld();
      renderer.render(v.skyScene, sc);
      renderer.clearDepth();
    }

    // Shadows: render the shadow maps once per frame, on the first world pass only.
    renderer.shadowMap.needsUpdate = true;
    const near = cam.near;
    const far = cam.far;
    const split = near * SPLIT_RATIO;
    if (far > split * 1.02) {
      const fc = v.farCam;
      fc.copy(cam, false);
      fc.near = split * 0.97;
      fc.far = far;
      fc.updateProjectionMatrix();
      fc.matrixWorld.copy(cam.matrixWorld);
      fc.matrixWorldInverse.copy(cam.matrixWorldInverse);
      renderer.render(scene, fc);
      renderer.clearDepth();
      const nc = v.nearCam;
      nc.copy(cam, false);
      nc.near = near;
      nc.far = split;
      nc.updateProjectionMatrix();
      nc.matrixWorld.copy(cam.matrixWorld);
      nc.matrixWorldInverse.copy(cam.matrixWorldInverse);
      renderer.render(scene, nc);
      v.passes = 2;
    } else {
      renderer.render(scene, cam);
      v.passes = 1;
    }
    renderer.autoClear = oldAuto;
  }
}

export class View {
  constructor(canvas, tier) {
    this.canvas = canvas;
    this.tier = tier;
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = tier.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;
    r.info.autoReset = false;
    this.renderer = r;
    this.scene = null;
    this.camera = null;
    this.skyScene = null;
    this.skyCam = new THREE.PerspectiveCamera(70, 1, 1, 1e6);
    this.farCam = new THREE.PerspectiveCamera();
    this.nearCam = new THREE.PerspectiveCamera();
    this.passes = 1;

    const size = this._size();
    this.composer = new EffectComposer(r);
    this.composer.setPixelRatio(this._pixelRatio());
    this.composer.setSize(size.w, size.h);
    this.scenePass = new ScaleScenePass(this);
    this.composer.addPass(this.scenePass);
    if (tier.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.w, size.h), 0.16, 0.25, 1.6);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    if (tier.aa === 'smaa') {
      this.aa = new SMAAPass();
      this.composer.addPass(this.aa);
    } else if (tier.aa === 'fxaa') {
      this.aa = new ShaderPass(FXAAShader);
      this.composer.addPass(this.aa);
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _pixelRatio() {
    return Math.min(window.devicePixelRatio || 1, this.tier.pixelRatio);
  }

  _size() {
    return { w: Math.max(1, this.canvas.clientWidth || window.innerWidth), h: Math.max(1, this.canvas.clientHeight || window.innerHeight) };
  }

  resize() {
    const { w, h } = this._size();
    const pr = this._pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    if (this.aa && this.aa.material?.uniforms?.resolution) this.aa.material.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  setView(scene, camera, skyScene = null) {
    // World matrices are updated once per frame in render(), not once per pass.
    scene.matrixWorldAutoUpdate = false;
    this.scene = scene;
    this.camera = camera;
    this.skyScene = skyScene;
    this.resize();
  }

  render() {
    if (!this.scene || !this.camera) return;
    this.renderer.info.reset();
    this.scene.updateMatrixWorld();
    this.camera.updateMatrixWorld();
    this.composer.render();
  }
}
