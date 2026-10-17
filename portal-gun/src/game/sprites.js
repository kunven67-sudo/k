// 2D cartoon characters standing in the 3D world (paper-cutout billboards).
import * as THREE from '../three.js';
import { TOONS } from './toons.js';
import { LAYER_OVERLAY } from '../render/kit.js';
import { rand, damp } from '../util.js';

const _cam = new THREE.Vector3();
const shadowGeo = new THREE.CircleGeometry(1, 24);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });

export const tint = new THREE.Color(1, 1, 1); // set by the time of day

export class ToonSprite {
  constructor(kind, opts = {}) {
    this.kind = kind;
    this.T = TOONS[kind];
    this.height = this.T.height;
    this.width = (this.height * 400) / this.T.h;
    const px = opts.res ?? 560; // texture height in pixels
    this.scale = px / this.T.h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.ceil(400 * this.scale);
    this.canvas.height = Math.ceil(this.T.h * this.scale);
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, alphaTest: 0.5, side: THREE.DoubleSide, fog: true });
    this.group = new THREE.Group();
    this.group.userData.dynamic = true;
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height), this.mat);
    this.plane.position.y = this.height / 2;
    this.plane.layers.set(LAYER_OVERLAY);
    this.group.add(this.plane);
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.scale.setScalar(this.width * 0.42);
    sh.position.y = 0.015;
    sh.layers.set(LAYER_OVERLAY);
    sh.renderOrder = -1;
    this.group.add(sh);
    this.shadow = sh;

    this.facing = 0; // world yaw the character faces (0 = +Z)
    this.speed = 0;
    this.walk = 0;
    this.talking = false;
    this.talkT = 0;
    this.blinkT = rand(1, 4);
    this.pose = { ...(opts.pose || {}) };
    this.expr = opts.expr || '';
    this.forceView = null;
    this._key = '';
    this.redraw({ walk: 0, mouth: 'closed', eyes: 'open' }, 'front');
  }

  get position() {
    return this.group.position;
  }

  redraw(state, view) {
    const key = `${view}|${state.walk.toFixed(2)}|${state.mouth}|${state.eyes}|${this.expr}|${JSON.stringify(this.pose)}`;
    if (key === this._key) return;
    this._key = key;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.scale(this.scale, this.scale);
    const fn = view === 'back' && this.T.back ? this.T.back : this.T.front;
    fn(g, { ...this.pose, ...state, expr: this.expr, bob: state.walk ? Math.abs(Math.sin(state.walk)) * -8 : 0 });
    this.tex.needsUpdate = true;
  }

  update(dt, camera) {
    // face the camera (rotate around Y only)
    camera.getWorldPosition(_cam);
    const p = this.group.position;
    const toCam = Math.atan2(_cam.x - p.x, _cam.z - p.z);
    this.plane.rotation.y = toCam - this.group.rotation.y;
    // front or back drawing depending on where the camera is vs where they face
    let d = toCam - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const view = this.forceView || (Math.abs(d) > 1.9 ? 'back' : 'front');

    // walk cycle (quantized so we don't repaint every frame)
    let walk = 0;
    if (this.speed > 0.2) {
      this.walk += dt * (5 + this.speed * 2.2);
      walk = Math.round((this.walk % (Math.PI * 2)) / (Math.PI / 4)) * (Math.PI / 4);
    }
    // blink
    this.blinkT -= dt;
    let eyes = this.pose.eyes || 'open';
    if (this.blinkT < 0) {
      eyes = 'closed';
      if (this.blinkT < -0.13) this.blinkT = rand(2, 5);
    }
    let mouth = 'closed';
    if (this.talking) {
      this.talkT += dt;
      mouth = Math.sin(this.talkT * 20) > -0.15 ? 'open' : 'closed';
    }
    this.redraw({ walk, mouth, eyes }, view);
    this.mat.color.lerp(tint, damp(4, dt));
  }
}
