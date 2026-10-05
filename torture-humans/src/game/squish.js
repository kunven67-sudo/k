// Stepping on tiny people. Your real foot bones are checked against every tiny
// person on the ground; a foot coming down on them squishes them. What you see
// depends on the gore setting.
import * as THREE from 'three';

let splatTexture = null;
// an irregular blood splat, drawn once (no external image)
function splat() {
  if (splatTexture) return splatTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const blob = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(92,4,6,${a})`);
    grd.addColorStop(0.6, `rgba(120,8,10,${a * 0.9})`);
    grd.addColorStop(1, 'rgba(120,8,10,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };
  blob(128, 128, 70, 0.95);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * 70;
    blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 4 + Math.random() * 16, 0.9);
  }
  splatTexture = new THREE.CanvasTexture(c);
  splatTexture.colorSpace = THREE.SRGBColorSpace;
  return splatTexture;
}

export function bloodSplat(scene, point, size) {
  const mat = new THREE.MeshStandardMaterial({
    map: splat(), transparent: true, roughness: 0.25, metalness: 0, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = Math.random() * Math.PI * 2;
  m.position.copy(point).y += 0.0005;
  m.receiveShadow = true;
  m.userData.noCollide = true;
  scene.add(m);
  return m;
}

export class Squisher {
  constructor({ scene, player, humans, settings }) {
    this.scene = scene;
    this.player = player;
    this.humans = humans;
    this.settings = settings;
    this.lastFeet = {};
  }

  update() {
    const p = this.player;
    if (p.scale < 1 || !p.grounded || p.ladder?.active) return;
    const B = p.character.bones;
    for (const side of ['L', 'R']) {
      const foot = B[`Bip01_${side}_Foot`];
      if (!foot) continue;
      const fp = foot.getWorldPosition(new THREE.Vector3());
      const prev = this.lastFeet[side];
      this.lastFeet[side] = fp.clone();
      // only a foot that is coming down (or planted and moving) squishes
      if (!prev || fp.y > prev.y + 0.002) continue;
      // the sole: from the heel (a bit behind the ankle) to the toes, about 9 cm wide
      const toe = B[`Bip01_${side}_Toe0`]?.getWorldPosition(new THREE.Vector3());
      const fwd = toe ? toe.clone().sub(fp).setY(0) : new THREE.Vector3(0, 0, 0);
      if (fwd.lengthSq() < 1e-6) fwd.set(-Math.sin(p.bodyYaw), 0, -Math.cos(p.bodyYaw));
      fwd.normalize();
      const ps = p.scale;
      const heel = fp.clone().addScaledVector(fwd, -0.06 * ps);
      const soleLen = 0.26 * ps;
      for (const h of this.humans) {
        if (h.dead || h.captured || h.state === 'caged' || !(h.tiny || h.scale < 0.15 * ps)) continue;
        const hp = h.position;
        const rel = new THREE.Vector3(hp.x - heel.x, 0, hp.z - heel.z);
        const along = rel.dot(fwd);
        const across = Math.abs(rel.x * fwd.z - rel.z * fwd.x);
        const under = along > -0.01 * ps && along < soleLen && across < 0.055 * ps + 0.2 * h.scale;
        const low = fp.y - hp.y < 0.13 * ps; // ankle height over the floor they stand on
        if (under && low) {
          const gore = this.settings.get('gameplay.gore');
          h.squish(gore);
          if (gore !== 'none') bloodSplat(this.scene, hp, (gore === 'full' ? 0.22 : 0.12) * Math.max(1, h.scale * 20));
          if (gore === 'full') bloodSplat(this.scene, fp.clone().setY(hp.y), 0.08);
        }
      }
    }
  }
}
