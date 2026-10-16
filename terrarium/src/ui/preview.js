// One small extra renderer for 3D previews inside menus (gadget workbench, character maker, potions).
import * as THREE from 'three';

let R = null;

export class Preview {
  constructor(canvas, opts = {}) {
    if (!R) {
      R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
      R.outputColorSpace = THREE.SRGBColorSpace;
      R.toneMapping = THREE.ACESFilmicToneMapping;
      R.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      R.localClippingEnabled = true;
    }
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(opts.fov || 35, 1, 0.01, 50);
    this.scene.add(new THREE.HemisphereLight(0xe8f4ff, 0x30302a, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 3, 2.5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x63e6be, 1.2); rim.position.set(-2, 1, -2); this.scene.add(rim);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.dist = opts.dist || 1;
    this.height = opts.height || 0;
    this.spin = 0;
    this.drag = null;
    this.yaw = 0.6; this.pitch = 0.25;
    canvas.addEventListener('mousedown', (e) => { this.drag = { x: e.clientX, y: e.clientY }; });
    addEventListener('mouseup', () => { this.drag = null; });
    canvas.addEventListener('mousemove', (e) => { if (!this.drag) return; this.yaw -= (e.clientX - this.drag.x) * 0.01; this.pitch = Math.max(-0.6, Math.min(1.2, this.pitch + (e.clientY - this.drag.y) * 0.01)); this.drag = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.max(0.2, Math.min(6, this.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
    this.alive = true;
    const loop = () => { if (!this.alive || !canvas.isConnected) { this.alive = false; return; } this.render(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  set(obj, opts = {}) {
    this.root.clear();
    if (obj) this.root.add(obj);
    if (opts.dist) this.dist = opts.dist;
    if (opts.height != null) this.height = opts.height;
  }

  render() {
    const w = this.canvas.clientWidth || 300, hh = this.canvas.clientHeight || 200;
    const pr = Math.min(2, devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * pr) || this.canvas.height !== Math.round(hh * pr)) { this.canvas.width = Math.round(w * pr); this.canvas.height = Math.round(hh * pr); }
    R.setSize(w, hh, false);
    this.cam.aspect = w / hh;
    this.cam.updateProjectionMatrix();
    if (!this.drag) this.yaw += 0.006;
    const d = this.dist;
    this.cam.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * d, this.height + Math.sin(this.pitch) * d, Math.cos(this.yaw) * Math.cos(this.pitch) * d);
    this.cam.lookAt(0, this.height, 0);
    if (this.onFrame) this.onFrame();
    R.render(this.scene, this.cam);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(R.domElement, 0, 0, this.canvas.width, this.canvas.height);
  }

  dispose() { this.alive = false; this.root.clear(); }
}
