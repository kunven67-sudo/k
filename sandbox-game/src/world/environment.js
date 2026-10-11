// Sky, sun, fog and image-based lighting (reflections) for a golden-hour look.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { getPreset } from '../settings.js';

export class Environment {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;

    this.sky = new Sky();
    this.sky.scale.setScalar(9000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 5.5;
    u.rayleigh.value = 1.9;
    u.mieCoefficient.value = 0.0055;
    u.mieDirectionalG.value = 0.86;
    scene.add(this.sky);

    this.sun = new THREE.DirectionalLight(0xffd2a6, 3.4);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xa9c2df, 0x6f5d48, 0.55);
    scene.add(this.hemi);

    this.fogColor = new THREE.Color(0xc9b39a);
    scene.fog = new THREE.FogExp2(this.fogColor, 0.0018);
    scene.background = null;

    this.sunDir = new THREE.Vector3();
    this.setSun(7.5, 232);
    this.applyQuality();
  }

  // elevation/azimuth in degrees.
  setSun(elevation, azimuth) {
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    // warmer, dimmer light as the sun gets low
    const e = THREE.MathUtils.clamp(elevation / 40, 0, 1);
    this.sun.color.setHSL(0.075 + e * 0.04, 0.85 - e * 0.55, 0.62 + e * 0.2);
    this.sun.intensity = 1.2 + e * 2.6 + 1.2;
    this.renderer.toneMappingExposure = 0.52 + e * 0.15;
    this.updateEnvMap();
  }

  updateEnvMap() {
    // Render only the sky into a PMREM cube so metal/glass reflect the sunset.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const tmp = new THREE.Scene();
    const sky = new Sky();
    sky.scale.setScalar(9000);
    for (const k in this.sky.material.uniforms) sky.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    tmp.add(sky);
    const rt = pmrem.fromScene(tmp, 0, 0.1, 10000);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    pmrem.dispose();
    sky.material.dispose();
  }

  applyQuality() {
    const p = getPreset();
    this.sun.shadow.mapSize.set(p.shadowMap, p.shadowMap);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    const r = p.shadowRange;
    const cam = this.sun.shadow.camera;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = 600;
    cam.updateProjectionMatrix();
    this.shadowRange = r;
    this.shadowRes = p.shadowMap;
  }

  // Keep the shadow box centered on the player, snapped to texels so shadows don't shimmer.
  follow(pos) {
    const texel = (this.shadowRange * 2) / this.shadowRes;
    const center = pos.clone();
    const light = this.sun;
    const dir = this.sunDir;
    // snap in light space
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir.clone().negate(), new THREE.Vector3(0, 1, 0));
    const inv = m.clone().invert();
    center.applyMatrix4(inv);
    center.x = Math.round(center.x / texel) * texel;
    center.y = Math.round(center.y / texel) * texel;
    center.applyMatrix4(m);
    light.target.position.copy(center);
    light.position.copy(center).addScaledVector(dir, 300);
  }
}
