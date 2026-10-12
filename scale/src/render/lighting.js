// Sun, sky light and shadows.
//
// Shadows use cascades (CSM): several shadow maps, each covering a bigger area further from the
// camera. The cascade sizes follow the player's height, so at 2 mm tall the first cascade covers a
// few centimeters (crisp shadows of crumbs and fibers) while the last one still covers the whole
// house (so the roof shades the rooms and the sun only comes in through windows).
import * as THREE from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { setCSM } from './materials.js';

export class Lighting {
  constructor(scene, camera, tier) {
    this.scene = scene;
    this.tier = tier;
    this.sunDir = new THREE.Vector3(-0.4, -0.8, -0.35).normalize();
    this.sunColor = new THREE.Color(1, 0.96, 0.9);
    this.sunIntensity = 3.2;
    this.height = 1.75;
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6b5a48, 0.55);
    scene.add(this.hemi);
    this.proxyCam = new THREE.PerspectiveCamera(70, 1, 0.05, 300);
    this.camera = camera;
    if (tier.shadows && tier.cascades > 0) {
      this.csm = new CSM({
        camera: this.proxyCam,
        parent: scene,
        cascades: tier.cascades,
        maxFar: 300,
        mode: 'custom',
        shadowMapSize: tier.shadowSize,
        lightDirection: this.sunDir,
        lightIntensity: this.sunIntensity,
        lightNear: 1,
        lightFar: 600,
        lightMargin: 250,
        shadowBias: -0.0001,
        customSplitsCallback: (n, near, far, breaks) => {
          // Geometric spread from ~6 body heights to the max distance.
          const first = Math.max(near * 4, this.height * 6);
          const ratio = Math.pow(far / first, 1 / Math.max(1, n - 1));
          for (let i = 0; i < n - 1; i++) breaks.push(Math.min(0.999, (first * Math.pow(ratio, i)) / far));
          breaks.push(1);
        },
      });
      this.csm.fade = true;
      for (const l of this.csm.lights) l.shadow.normalBias = 0.02;
      setCSM(this.csm);
    } else {
      this.sun = new THREE.DirectionalLight(this.sunColor, this.sunIntensity);
      scene.add(this.sun, this.sun.target);
      setCSM(null);
    }
    this._lastKey = '';
  }

  setSun(dir, color, intensity) {
    this.sunDir.copy(dir).normalize();
    this.sunColor.copy(color);
    this.sunIntensity = intensity;
  }

  // Call every frame after the camera moved. `height` = player body height in meters.
  update(height) {
    this.height = height;
    const cam = this.camera;
    if (this.csm) {
      const pc = this.proxyCam;
      pc.position.copy(cam.position);
      pc.quaternion.copy(cam.quaternion);
      pc.fov = cam.fov;
      pc.aspect = cam.aspect;
      pc.near = cam.near;
      // Shadows reach ~400 body heights, at least 40 m (whole house), at most 300 m.
      const maxFar = Math.min(300, Math.max(40, height * 400));
      pc.far = maxFar;
      this.csm.maxFar = maxFar;
      // Light box depth: must include the roof and trees above a tiny player.
      const margin = Math.max(60, height * 40);
      this.csm.lightMargin = margin;
      for (const l of this.csm.lights) {
        l.color.copy(this.sunColor);
        l.intensity = this.sunIntensity;
        l.shadow.camera.near = 0.5;
        l.shadow.camera.far = margin * 2 + maxFar;
      }
      pc.updateProjectionMatrix();
      pc.updateMatrixWorld();
      const key = `${pc.near.toPrecision(3)}|${maxFar.toPrecision(3)}|${pc.fov}|${pc.aspect.toFixed(3)}`;
      if (key !== this._lastKey) {
        this.csm.updateFrustums();
        this._lastKey = key;
      }
      this.csm.update();
      // Bias in world units must follow each cascade's texel size or tiny things lose their shadows.
      for (const l of this.csm.lights) {
        const sc = l.shadow.camera;
        sc.updateProjectionMatrix();
        const texel = (sc.right - sc.left) / l.shadow.mapSize.x;
        l.shadow.normalBias = texel * 1.2;
        l.shadow.bias = -(texel * 0.5) / (sc.far - sc.near);
      }
    } else {
      this.sun.color.copy(this.sunColor);
      this.sun.intensity = this.sunIntensity;
      this.sun.position.copy(cam.position).addScaledVector(this.sunDir, -50);
      this.sun.target.position.copy(cam.position);
    }
  }
}
