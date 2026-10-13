// Silk on you: the cocoon a spider wraps you in, and strands stuck to you after walking through webs.
import * as THREE from 'three';
import { std } from '../render/materials.js';
import { makeThin } from '../render/thin.js';
import { hash3 } from '../core/util.js';

function silkTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(240,240,236,0.55)';
  c.fillRect(0, 0, 128, 256);
  // Wrapping bands: many fine strands at slightly different angles (it's wound around and around).
  for (let i = 0; i < 260; i++) {
    const y = hash3(i, 1, 0, 61) * 256, a = (hash3(i, 2, 0, 61) - 0.5) * 0.5;
    c.strokeStyle = `rgba(255,255,255,${0.25 + hash3(i, 3, 0, 61) * 0.6})`;
    c.lineWidth = 0.5 + hash3(i, 4, 0, 61) * 1.5;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(128, y + Math.tan(a) * 128);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class SilkOnPlayer {
  constructor(game) {
    this.game = game;
    const pl = game.player;
    // Cocoon, in the player model's space (built for a 1.75 m body; the model is scaled with you).
    const geo = new THREE.SphereGeometry(1, 24, 18);
    geo.scale(0.33, 0.56, 0.3);
    geo.translate(0, 0.9, 0);
    this.cocoon = new THREE.Mesh(geo, std({ map: silkTexture(), color: 0xffffff, roughness: 0.55, transparent: true, opacity: 0.9, side: THREE.DoubleSide }, { detail: 'fabric' }));
    this.cocoon.visible = false;
    this.cocoon.castShadow = true;
    pl.model.add(this.cocoon); // turns with your body
    // Loose strands caught on you (from walking through webs).
    const strandMat = makeThin(std({ color: 0xf4f6f8, roughness: 0.2, transparent: true, opacity: 0.8, depthWrite: false }, { detail: 'glass' }), { minAlpha: 0.08 });
    const sg = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
    sg.translate(0, 0.5, 0);
    this.strands = new THREE.InstancedMesh(sg, strandMat, 12);
    this.strands.frustumCulled = false;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < 12; i++) {
      // From a spot on the body, trailing off back and down (model space, 1.75 m body).
      p.set((hash3(i, 1, 0, 62) - 0.5) * 0.5, 0.6 + hash3(i, 2, 0, 62) * 1.0, (hash3(i, 3, 0, 62) - 0.5) * 0.3);
      d.set((hash3(i, 4, 0, 62) - 0.5) * 0.6, -0.3 - hash3(i, 5, 0, 62) * 0.5, 0.4 + hash3(i, 6, 0, 62) * 0.5).normalize();
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      m.compose(p, q, s.set(0.0012, 0.25 + hash3(i, 7, 0, 62) * 0.35, 0.0012));
      this.strands.setMatrixAt(i, m);
    }
    this.strands.count = 0;
    pl.model.add(this.strands);
    this.silkT = 0;
  }

  update(dt) {
    const pl = this.game.player;
    const w = pl.wrapped || 0;
    this.cocoon.visible = w > 0.02;
    if (w > 0.02) {
      // Wound from the feet up.
      this.cocoon.scale.set(1, Math.max(0.05, w), 1);
      this.cocoon.position.y = 0;
      this.cocoon.material.opacity = 0.4 + 0.55 * w;
    }
    if (!pl.heldBy && w > 0) pl.wrapped = Math.max(0, w - dt * 0.5); // you tear the rest off once free
    // Strands come off a few at a time as you move around.
    if ((pl.silkOn || 0) > 0) {
      this.silkT += dt;
      if (this.silkT > 6) {
        this.silkT = 0;
        pl.silkOn = Math.max(0, pl.silkOn - 1);
      }
    }
    this.strands.count = Math.min(12, Math.round(pl.silkOn || 0));
  }
}
