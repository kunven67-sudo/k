import * as THREE from '../three.js';
import { EffectComposer } from '../../vendor/three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from '../../vendor/three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from '../../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/three/addons/postprocessing/OutputPass.js';
import { LAYER_WORLD, LAYER_OVERLAY, LAYER_SKY } from './kit.js';

/*
 Frame recipe (high / medium quality):
   1. world + sky            -> rtScene (color + depth texture)
   2. world normals          -> rtNormal
   3. outline composite      -> composer buffer, also copies the depth so...
   4. overlay layer (portals, glass, particles) depth-tests correctly on top
   5. first-person viewmodel (own camera, cleared depth)
   6. bloom + sRGB output
 Low quality skips 2-3 and 6 and draws straight to the screen.
*/

const outlineShader = {
  uniforms: {
    tColor: { value: null },
    tDepth: { value: null },
    tNormal: { value: null },
    texel: { value: new THREE.Vector2() },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000 },
    thickness: { value: 1 },
    lineColor: { value: new THREE.Color(0x14161a) },
    fadeNear: { value: 160 },
    fadeFar: { value: 420 },
    strength: { value: 1 },
    debug: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform sampler2D tNormal;
    uniform vec2 texel;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float thickness;
    uniform vec3 lineColor;
    uniform float fadeNear;
    uniform float fadeFar;
    uniform float strength;
    uniform int debug;
    varying vec2 vUv;

    float viewDist(float d) { return -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }
    vec3 nrm(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }

    void main() {
      vec4 col = texture2D(tColor, vUv);
      float d0 = texture2D(tDepth, vUv).x;
      vec2 ox = vec2(texel.x * thickness, 0.0);
      vec2 oy = vec2(0.0, texel.y * thickness);

      float dl = texture2D(tDepth, vUv - ox).x;
      float dr = texture2D(tDepth, vUv + ox).x;
      float dd = texture2D(tDepth, vUv - oy).x;
      float du = texture2D(tDepth, vUv + oy).x;

      float z0 = viewDist(d0);
      float zl = viewDist(dl), zr = viewDist(dr), zd = viewDist(dd), zu = viewDist(du);
      float zmin = min(min(min(zl, zr), min(zd, zu)), z0);

      // 1/z is linear across a flat surface, so its second difference only
      // lights up at silhouettes, never on floors seen at a grazing angle.
      float w0 = 1.0 / z0;
      float lap = abs(1.0 / zl + 1.0 / zr - 2.0 * w0) + abs(1.0 / zd + 1.0 / zu - 2.0 * w0);
      float depthEdge = smoothstep(0.09, 0.22, lap / w0);

      // normals: the normal pass clears to black, so z < -0.5 means "nothing drawn here".
      // Ignoring those keeps single missing pixels from turning into dots.
      vec3 n0 = nrm(vUv);
      float ne = 0.0;
      if (n0.z > -0.5) {
        vec3 n1 = nrm(vUv - ox), n2 = nrm(vUv + ox), n3 = nrm(vUv - oy), n4 = nrm(vUv + oy);
        if (n1.z > -0.5) ne = max(ne, 1.0 - dot(n0, n1));
        if (n2.z > -0.5) ne = max(ne, 1.0 - dot(n0, n2));
        if (n3.z > -0.5) ne = max(ne, 1.0 - dot(n0, n3));
        if (n4.z > -0.5) ne = max(ne, 1.0 - dot(n0, n4));
      }
      float normalEdge = smoothstep(0.22, 0.42, ne);

      float edge = max(depthEdge, normalEdge);
      edge *= 1.0 - smoothstep(fadeNear, fadeFar, zmin);
      edge *= strength;

      gl_FragColor = vec4(mix(col.rgb, lineColor, edge), 1.0);
      if (debug == 1) gl_FragColor = vec4(texture2D(tNormal, vUv).xyz, 1.0);
      if (debug == 2) gl_FragColor = vec4(vec3(depthEdge, normalEdge, 0.0), 1.0);
      if (debug == 3) gl_FragColor = vec4(vec3(fract(z0)), 1.0);
      gl_FragDepth = d0;
    }`,
};

class WorldPass extends Pass {
  constructor(pipeline) {
    super();
    this.pipeline = pipeline;
    this.needsSwap = true;
  }
  setSize(w, h) {
    this.pipeline.resizeTargets(w, h);
  }
  render(renderer, writeBuffer) {
    this.pipeline.renderWorld(renderer, writeBuffer);
  }
}

export class Pipeline {
  constructor(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 1);
    this.renderer = renderer;

    this.scene = null;
    this.camera = null;
    this.viewScene = null;
    this.viewCamera = null;
    this.quality = 'high';
    this.outlineScale = 1.15;

    this.rtScene = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(4, 4),
    });
    this.rtScene.depthTexture.format = THREE.DepthFormat;
    this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.rtNormal = new THREE.WebGLRenderTarget(4, 4, { type: THREE.UnsignedByteType });
    this.normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

    this.outlineMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(outlineShader.uniforms),
      vertexShader: outlineShader.vertexShader,
      fragmentShader: outlineShader.fragmentShader,
      depthTest: true,
      depthWrite: true,
      depthFunc: THREE.AlwaysDepth,
    });
    this.quad = new FullScreenQuad(this.outlineMaterial);

    this.composer = new EffectComposer(renderer);
    this.worldPass = new WorldPass(this);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.4, 1.0);
    this.output = new OutputPass();
    this.composer.addPass(this.worldPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.output);

    this._w = 1;
    this._h = 1;
  }

  setQuality(q) {
    this.quality = q;
    this.resize(this._w, this._h, true);
  }

  pixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    if (this.quality === 'high') return Math.min(dpr, 2);
    if (this.quality === 'medium') return Math.min(dpr, 1.25);
    return Math.min(dpr, 1);
  }

  resize(w, h, force = false) {
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    if (!force && w === this._w && h === this._h) return;
    this._w = w;
    this._h = h;
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    for (const cam of [this.camera, this.viewCamera]) {
      if (cam) {
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
    }
  }

  resizeTargets(w, h) {
    this.rtScene.setSize(w, h);
    this.rtNormal.setSize(w, h);
    this.outlineMaterial.uniforms.texel.value.set(1 / w, 1 / h);
    // keep lines about the same visual weight at any resolution. Whole pixels only:
    // uneven offsets make the depth test see edges on flat walls.
    this.outlineMaterial.uniforms.thickness.value = Math.max(1, Math.round((h / 1080) * 1.9 * this.outlineScale));
  }

  render(dt) {
    const { renderer, scene, camera } = this;
    if (!scene || !camera) return;
    if (this.quality === 'low') {
      renderer.setRenderTarget(null);
      renderer.clear(true, true, false);
      camera.layers.set(LAYER_SKY);
      renderer.render(scene, camera);
      camera.layers.set(LAYER_WORLD);
      camera.layers.enable(LAYER_OVERLAY);
      renderer.render(scene, camera);
      this.renderViewmodel(renderer);
      camera.layers.set(LAYER_WORLD);
      return;
    }
    this.composer.render(dt);
  }

  renderWorld(renderer, target) {
    const { scene, camera } = this;
    const u = this.outlineMaterial.uniforms;

    // 1. color + depth
    renderer.setRenderTarget(this.rtScene);
    renderer.clear(true, true, false);
    camera.layers.set(LAYER_WORLD);
    camera.layers.enable(LAYER_SKY);
    renderer.render(scene, camera);

    // 2. normals (outlined geometry only)
    camera.layers.set(LAYER_WORLD);
    const oldClear = renderer.getClearColor(new THREE.Color());
    const oldAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(this.rtNormal);
    renderer.clear(true, true, false);
    scene.overrideMaterial = this.normalMaterial;
    const fog = scene.fog;
    scene.fog = null;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    scene.fog = fog;
    renderer.setClearColor(oldClear, oldAlpha);

    // 3. outlines, writing the scene depth back out
    u.tColor.value = this.rtScene.texture;
    u.tDepth.value = this.rtScene.depthTexture;
    u.tNormal.value = this.rtNormal.texture;
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    renderer.setRenderTarget(target);
    renderer.clear(true, true, false);
    this.quad.render(renderer);

    // 4. overlay effects
    camera.layers.set(LAYER_OVERLAY);
    renderer.render(scene, camera);
    camera.layers.set(LAYER_WORLD);

    // 5. viewmodel
    this.renderViewmodel(renderer);
  }

  renderViewmodel(renderer) {
    if (!this.viewScene || !this.viewCamera || !this.viewScene.visible) return;
    renderer.clearDepth();
    renderer.render(this.viewScene, this.viewCamera);
  }
}
