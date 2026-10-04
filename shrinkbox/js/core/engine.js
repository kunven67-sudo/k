// Renderer, scene, camera and the realistic lighting (real sun position from your real clock).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { settings, resolveQuality } from './settings.js';
import { setTextureRes } from './textures.js';

export const QUALITY = {
  low: { pixel: 0.75, shadows: false, shadowRes: 512, bloom: false, aa: false, tex: 256 },
  medium: { pixel: 1, shadows: true, shadowRes: 1024, bloom: false, aa: true, tex: 512 },
  high: { pixel: 1, shadows: true, shadowRes: 2048, bloom: true, aa: true, tex: 512 },
  ultra: { pixel: 1.5, shadows: true, shadowRes: 4096, bloom: true, aa: true, tex: 1024 },
};

export class Engine {
  constructor(container) {
    this.qname = resolveQuality();
    this.q = QUALITY[this.qname];
    setTextureRes(this.q.tex);
    this.renderer = new THREE.WebGLRenderer({ antialias: this.q.aa, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    const r = this.renderer;
    r.setPixelRatio(Math.min(devicePixelRatio, 2) * this.q.pixel);
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = this.q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.active = this.scene; // the scene being drawn (the room, or the germ world)
    this.scene.background = new THREE.Color(0x87a8c8);
    this.camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.02, 400);
    this.scene.add(this.camera);

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;

    this._setupLights();
    this._setupPost();
    addEventListener('resize', () => this.resize());
  }

  _setupLights() {
    const s = this.scene;
    // Sun (comes in through the window). Its shadow box follows the player and shrinks with you,
    // so shadows stay sharp even when you're ant-sized.
    this.sun = new THREE.DirectionalLight(0xfff1dc, 3);
    this.sun.castShadow = this.q.shadows;
    this.sun.shadow.mapSize.set(this.q.shadowRes, this.q.shadowRes);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    s.add(this.sun, this.sun.target);
    this.sky = new THREE.HemisphereLight(0xbfd6ff, 0x5a4a3a, 0.35);
    s.add(this.sky);
  }

  _setupPost() {
    this.composer = null;
    if (!this.q.bloom) return;
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.4, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  // Real sun position for the west coast (37.5 N, 122 W) from the real clock.
  sunDirection(date = new Date(), out = new THREE.Vector3()) {
    const lat = 37.5 * Math.PI / 180;
    const day = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 864e5);
    const decl = -23.44 * Math.PI / 180 * Math.cos(2 * Math.PI / 365 * (day + 10));
    // local solar time from UTC and longitude (works wherever the player really is)
    const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const solar = utcH - 122 / 15; // hours
    const H = (solar - 12) * 15 * Math.PI / 180;
    const alt = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H));
    let az = Math.acos(Math.max(-1, Math.min(1, (Math.sin(decl) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat)))));
    if (H > 0) az = 2 * Math.PI - az; // azimuth from north, clockwise
    // world: -Z = north, +X = east
    out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
    return out;
  }

  // Updates sun/sky from real time. Returns daylight 0..1.
  updateDaylight(focus, playerScale) {
    const dir = this.sunDirection();
    const day = Math.max(0, Math.min(1, (dir.y + 0.08) / 0.25));
    const warm = Math.max(0, Math.min(1, 1 - dir.y / 0.35));
    this.sun.color.setRGB(1, 0.95 - warm * 0.25, 0.88 - warm * 0.45);
    this.sun.intensity = day * 3.2;
    // follow the player with the shadow camera (size scales with the player)
    const span = Math.max(0.05, Math.min(7, 9 * playerScale));
    const cam = this.sun.shadow.camera;
    cam.left = -span; cam.right = span; cam.top = span; cam.bottom = -span;
    cam.near = 0.01; cam.far = 60;
    cam.updateProjectionMatrix();
    this.sun.shadow.normalBias = 0.02 * Math.min(1, span / 7);
    this.sun.shadow.bias = -0.0004;
    this.sun.position.copy(focus).addScaledVector(dir.y > 0 ? dir : dir.set(0.3, 0.6, 0.2), 25);
    this.sun.target.position.copy(focus);
    // sky color
    const night = new THREE.Color(0x0a1020), noon = new THREE.Color(0x8fb4dc), dusk = new THREE.Color(0xe39a6a);
    const c = night.clone().lerp(noon, day);
    if (day > 0 && day < 1) c.lerp(dusk, Math.sin(day * Math.PI) * 0.45);
    this.scene.background.copy(c);
    this.sky.intensity = 0.06 + day * 0.32;
    this.sky.color.copy(c).lerp(new THREE.Color(0xffffff), 0.4);
    this.scene.environmentIntensity = 0.12 + day * 0.28;
    this.daylight = day;
    return day;
  }

  setScene(scene, rig = []) {
    this.active = scene;
    if (this.renderPass) this.renderPass.scene = scene;
    for (const o of [this.camera, ...rig]) scene.add(o);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    if (this.composer) this.composer.setSize(innerWidth, innerHeight);
  }

  render() {
    if (this.composer) this.composer.render(); else this.renderer.render(this.active, this.camera);
  }
}
