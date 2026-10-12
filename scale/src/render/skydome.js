// Temporary daytime sky (physical scattering model) + image-based lighting from it.
// Replaced by the full day/night sky (sun, moon, stars, clouds, California coast horizon) later in Wave 1.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class SkyDome {
  constructor(renderer, worldScene, lighting) {
    this.renderer = renderer;
    this.worldScene = worldScene;
    this.lighting = lighting;
    this.scene = new THREE.Scene();
    this.sky = new Sky();
    this.sky.scale.setScalar(1000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;
    this.scene.add(this.sky);
    // A copy of the sky without the sun disc, used only for ambient/reflection lighting. The sun's
    // direct light comes from the shadowed sun light; counting the disc again would light rooms
    // through their roofs.
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(1000);
    this.envSky.material = this.sky.material.clone();
    this.envSky.material.fragmentShader = this.envSky.material.fragmentShader.replace('L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', '');
    this.envScene.add(this.envSky);
    // The ground: below the horizon the world reflects much less light than the sky gives.
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(900, 48), new THREE.MeshBasicMaterial({ color: 0x3b3a34, side: THREE.DoubleSide }));
    this.envGround.rotation.x = -Math.PI / 2;
    this.envGround.position.y = -2;
    this.envScene.add(this.envGround);
    this.elevation = 42; // degrees
    this.azimuth = 215;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this._apply();
  }

  setSun(elevation, azimuth) {
    this.elevation = elevation;
    this.azimuth = azimuth;
    this._apply();
  }

  _apply() {
    const phi = THREE.MathUtils.degToRad(90 - this.elevation);
    const theta = THREE.MathUtils.degToRad(this.azimuth);
    const sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(sunPos);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) this.envSky.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    this.envSky.material.uniforms.sunPosition.value.copy(sunPos);
    const e = Math.max(0, Math.sin(THREE.MathUtils.degToRad(this.elevation)));
    const warm = new THREE.Color(1, 0.62, 0.38).lerp(new THREE.Color(1, 0.97, 0.92), Math.min(1, e * 2.2));
    this.lighting.setSun(sunPos.clone().negate(), warm, 0.2 + 3.4 * Math.min(1, e * 1.6));
    // Environment lighting from the sky (reflections + soft ambient).
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
    this.worldScene.environment = this.envRT.texture;
    this.envGround.material.color.setRGB(0.23, 0.22, 0.19).multiplyScalar(0.3 + 0.9 * e);
    this.worldScene.environmentIntensity = 0.85;
    // Ambient comes from the sky map (which indoor materials scale down); the hemisphere light is
    // only a faint fill so rooms don't get lit through their walls.
    this.lighting.hemi.intensity = 0.04 + 0.06 * e;
  }

  update(dt, camera) {}
}
