// Dedicated ID-photo camera. Renders the subject's head and shoulders straight-on into the
// bottom-left corner of the main canvas (so the renderer's tone mapping / sRGB output apply),
// copies those pixels into a 300x380 2D canvas in the same task, and lets the next engine frame
// overwrite the corner. Adds a touch of DMV "look": flat flash light, slight overexposure.

import * as THREE from 'three';

export const PHOTO_W = 300;
export const PHOTO_H = 380;

export class PhotoRig {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(18, PHOTO_W / PHOTO_H, 0.1, 10);
  }

  /** Returns a canvas with the ID photo of `human` (whose head centre is at headY). */
  capture(human, headY) {
    const r = this.renderer;
    const cam = this.camera;
    cam.position.set(0, headY + 0.01, 1.35);
    cam.lookAt(0, headY - 0.045, 0);
    cam.updateMatrixWorld();
    human.root.updateMatrixWorld(true);

    const pr = r.getPixelRatio();
    const size = r.getSize(new THREE.Vector2());
    const vw = PHOTO_W / pr;
    const vh = PHOTO_H / pr;
    const exposure = r.toneMappingExposure;
    r.toneMappingExposure = exposure * 1.04;
    r.setRenderTarget(null);
    r.setScissorTest(true);
    r.setViewport(0, 0, vw, vh);
    r.setScissor(0, 0, vw, vh);
    r.render(this.scene, cam);

    const out = document.createElement('canvas');
    out.width = PHOTO_W;
    out.height = PHOTO_H;
    const ctx = out.getContext('2d');
    const src = r.domElement;
    const sh = Math.round(vh * pr);
    const sw = Math.round(vw * pr);
    ctx.filter = 'contrast(1.06) saturate(0.9) brightness(1.03)';
    ctx.drawImage(src, 0, src.height - sh, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
    ctx.filter = 'none';
    // Faint vignette + warm cast typical of an old booth camera.
    const g = ctx.createRadialGradient(PHOTO_W / 2, PHOTO_H * 0.45, PHOTO_W * 0.3, PHOTO_W / 2, PHOTO_H * 0.5, PHOTO_W * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,20,40,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
    ctx.fillStyle = 'rgba(255,200,150,0.04)';
    ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);

    r.setScissorTest(false);
    r.setViewport(0, 0, size.x, size.y);
    r.setScissor(0, 0, size.x, size.y);
    r.toneMappingExposure = exposure;
    return out;
  }

  dispose() {}
}
