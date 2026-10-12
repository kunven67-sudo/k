// Product photos for the shopping app, rendered from the real 3D models (not drawings).
//
// How: a tiny studio scene (soft light, light gray backdrop) renders each model into the corner of
// the game canvas right before the frame is drawn, then the pixels are copied into a small 2D canvas.
// The full frame is drawn over it straight after, so you never see it happen. Two photos per frame,
// only when the shop asks for them, so there's no hitch.
//
// The studio uses plain copies of each material (no shadow cascades, no micro detail), which keeps
// the number of extra shaders tiny.
import * as THREE from 'three';

export const THUMB_PX = 256;
export const THUMB_BG = 0xf2f3f5;

export class Thumbs {
  constructor(game) {
    this.game = game;
    this.cache = new Map(); // id -> { canvas, ready }
    this.queue = [];
    this.mats = new Map();
    this.scene = new THREE.Scene();
    this.scene.environment = game.sky?.roomEnv || null;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8f949c, 1.25));
    const key = new THREE.DirectionalLight(0xfff6ea, 2.3);
    key.position.set(2.5, 4, 3);
    const fill = new THREE.DirectionalLight(0xdbe8ff, 0.7);
    fill.position.set(-3, 1.5, -1);
    this.scene.add(key, fill);
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.01, 100);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
  }

  // A canvas that will hold the photo (empty until it's rendered).
  get(def) {
    let e = this.cache.get(def.id);
    if (!e) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = THUMB_PX;
      canvas.className = 'thumb';
      e = { canvas, ready: false };
      this.cache.set(def.id, e);
      this.queue.push(def);
    }
    return e;
  }

  // A copy of a canvas photo for another spot on the page (a canvas can only be in one place).
  copy(def) {
    const e = this.get(def);
    const c = document.createElement('canvas');
    c.width = c.height = THUMB_PX;
    c.className = 'thumb';
    const draw = () => c.getContext('2d').drawImage(e.canvas, 0, 0);
    if (e.ready) draw();
    else (e.waiters ||= []).push(draw);
    return c;
  }

  _plain(m) {
    if (Array.isArray(m)) return m.map((x) => this._plain(x));
    if (!m.isMeshStandardMaterial) return m; // basic/shader materials don't use lights
    let p = this.mats.get(m);
    if (!p) {
      p = new THREE.MeshStandardMaterial({
        color: m.color, map: m.map, normalMap: m.normalMap, normalScale: m.normalScale, roughnessMap: m.roughnessMap,
        roughness: m.isMeshPhysicalMaterial && m.clearcoat ? Math.min(m.roughness, 0.25) : m.roughness,
        metalness: m.metalness, emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity,
        transparent: m.transparent, opacity: m.opacity, side: m.side, alphaTest: m.alphaTest, depthWrite: m.depthWrite,
      });
      this.mats.set(m, p);
    }
    return p;
  }

  // Called by the game right before it draws a frame.
  render(renderer) {
    if (!this.queue.length) return;
    const canvas = renderer.domElement;
    const pr = renderer.getPixelRatio();
    // Shot at up to twice the size and scaled down: smooth edges (the game canvas has no built-in AA).
    const S = Math.min(THUMB_PX * 2, canvas.width, canvas.height);
    if (S < 64) return;
    const oldExposure = renderer.toneMappingExposure;
    const oldColor = renderer.getClearColor(new THREE.Color());
    const oldAlpha = renderer.getClearAlpha();
    const oldTarget = renderer.getRenderTarget();
    const sz = S / pr;
    renderer.setRenderTarget(null);
    renderer.toneMappingExposure = 1;
    renderer.setClearColor(THUMB_BG, 1);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, sz, sz);
    renderer.setScissor(0, 0, sz, sz);
    for (let n = 0; n < 2 && this.queue.length; n++) {
      const def = this.queue.shift();
      const e = this.cache.get(def.id);
      try {
        this._shoot(def, renderer);
        const ctx = e.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, canvas.height - S, S, S, 0, 0, THUMB_PX, THUMB_PX);
        e.ready = true;
        for (const w of e.waiters || []) w();
        e.waiters = null;
      } catch (err) {
        console.warn('[scale] product photo failed for', def.id, err);
      }
    }
    renderer.setScissorTest(false);
    const size = renderer.getSize(new THREE.Vector2());
    renderer.setViewport(0, 0, size.x, size.y);
    renderer.setScissor(0, 0, size.x, size.y);
    renderer.setClearColor(oldColor, oldAlpha);
    renderer.toneMappingExposure = oldExposure;
    renderer.setRenderTarget(oldTarget);
  }

  _shoot(def, renderer) {
    const model = def.build();
    model.traverse((o) => {
      if (o.isMesh) o.material = this._plain(o.material);
    });
    this.holder.add(model);
    this.holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const r = Math.max(1e-5, box.getSize(new THREE.Vector3()).length() * 0.5);
    // Three-quarter view from the front right, a little above (product photo angle).
    const dir = new THREE.Vector3(0.85, 0.62, 1.25).normalize();
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(this.cam.fov / 2))) * 0.98;
    this.cam.position.copy(center).addScaledVector(dir, dist);
    this.cam.near = Math.max(dist - r * 2, dist * 0.01);
    this.cam.far = dist + r * 2;
    this.cam.lookAt(center);
    this.cam.updateProjectionMatrix();
    renderer.render(this.scene, this.cam);
    this.holder.remove(model);
    model.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
    });
  }
}
