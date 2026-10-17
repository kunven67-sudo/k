// Lighting + sky presets for night (the intro) and day.
import * as THREE from '../three.js';
import { tint } from './sprites.js';

export const PRESETS = {
  night: {
    sky: { top: 0x0b1030, horizon: 0x2a3b74, bottom: 0x10162a, sun: new THREE.Vector3(0.2, -0.4, 0.3), moon: 1, stars: 1, moonDir: new THREE.Vector3(-0.35, 0.42, 0.55) },
    hemi: [0x7f93d9, 0x2a2f4a, 1.35],
    sun: [0xa9bcff, 0.85, new THREE.Vector3(-0.4, 1, 0.6)],
    fog: [0x18213f, 60, 420],
    tint: new THREE.Color(0.6, 0.66, 0.9),
    lamps: true,
  },
  day: {
    sky: { top: 0x3f8ee0, horizon: 0xc4e8ff, bottom: 0x7da35f, sun: new THREE.Vector3(0.45, 0.75, -0.45), moon: 0, stars: 0 },
    hemi: [0xf2f6ff, 0xd9d0bc, 2.15],
    sun: [0xfff3df, 1.2, new THREE.Vector3(0.45, 1, 0.35)],
    fog: [0xbfe0f5, 140, 620],
    tint: new THREE.Color(1, 1, 1),
    lamps: false,
  },
};

export class Environment {
  constructor(scene, sky, gun) {
    this.scene = scene;
    this.sky = sky;
    this.gun = gun;
    this.hemi = new THREE.HemisphereLight();
    this.sun = new THREE.DirectionalLight();
    this.hemi.layers.enableAll();
    this.sun.layers.enableAll();
    scene.add(this.hemi, this.sun, this.sun.target);
    scene.fog = new THREE.Fog(0xffffff, 100, 500);
    this.name = null;
  }

  set(name) {
    const p = PRESETS[name];
    this.name = name;
    this.sky.set(p.sky);
    this.hemi.color.set(p.hemi[0]);
    this.hemi.groundColor.set(p.hemi[1]);
    this.hemi.intensity = p.hemi[2];
    this.sun.color.set(p.sun[0]);
    this.sun.intensity = p.sun[1];
    this.sun.position.copy(p.sun[2]).multiplyScalar(50);
    this.scene.fog.color.set(p.fog[0]);
    this.scene.fog.near = p.fog[1];
    this.scene.fog.far = p.fog[2];
    tint.copy(p.tint);
    this.gun?.setLighting(p.hemi[0], p.hemi[1], p.hemi[2] * (name === 'night' ? 1.15 : 1), p.sun[0], p.sun[1]);
    return p;
  }
}
