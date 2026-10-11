// High-level visual effects: explosions, dust, sparks, scorch marks, flashes, camera shake.
import * as THREE from 'three';
import { ParticleSystem } from './particles.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);

function randDir(out = new THREE.Vector3()) {
  const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  return out.set(s * Math.cos(t), u, s * Math.sin(t));
}

function scorchTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() ** 0.7 * S * 0.32;
    const x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    const rr = rnd(S * 0.04, S * 0.16);
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, 'rgba(12,10,9,0.35)');
    grd.addColorStop(1, 'rgba(12,10,9,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  }
  // radial streaks from the blast
  g.strokeStyle = 'rgba(15,12,10,0.25)';
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r0 = S * 0.12, r1 = rnd(S * 0.3, S * 0.48);
    g.lineWidth = rnd(1, 4);
    g.beginPath();
    g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0);
    g.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.smoke = new ParticleSystem(scene, { max: 1600, kind: 'smoke' });
    this.dust = new ParticleSystem(scene, { max: 1200, kind: 'smoke' });
    this.fire = new ParticleSystem(scene, { max: 900, kind: 'fire', additive: true });
    this.sparks = new ParticleSystem(scene, { max: 1200, kind: 'spark', additive: true, stretch: 0.035 });
    this.bits = new ParticleSystem(scene, { max: 900, kind: 'spark', stretch: 0.01 }); // small solid bits (glass glitter, splinters)
    // Fixed pool of lights so adding a flash never triggers a shader recompile.
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffa860, 0, 30, 2);
      l.userData.t = 0; l.userData.dur = 0; l.userData.peak = 0;
      scene.add(l);
      this.lights.push(l);
    }
    this.scorchMat = new THREE.MeshStandardMaterial({ map: scorchTexture(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4 });
    this.decals = [];
    this.shocks = [];
    this.shockGeo = new THREE.SphereGeometry(1, 24, 16);
    this.trauma = 0;
    this.shakeTime = 0;
    this.blur = 0;
  }

  flash(pos, intensity, dur = 0.18, color = 0xffa860, range = 40) {
    const l = this.lights.reduce((a, b) => (a.userData.t / Math.max(a.userData.dur, 1e-3) >= b.userData.t / Math.max(b.userData.dur, 1e-3) ? a : b));
    l.position.copy(pos);
    l.color.set(color);
    l.distance = range;
    l.userData.t = 0; l.userData.dur = dur; l.userData.peak = intensity;
    l.intensity = intensity;
  }

  addTrauma(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  // Explosion. power in kg TNT-equivalent; fuel=true makes a big rolling fireball (fuel/propane).
  explosion(pos, power, { fuel = false, groundY = null, normal = UP } = {}) {
    const k = Math.cbrt(power);
    const fireR = (fuel ? 2.6 : 1.3) * k;
    this.flash(pos, 2500 * k * (fuel ? 1.6 : 1), fuel ? 0.5 : 0.22, 0xffb070, 35 * k + 10);
    // fireball
    const nFire = Math.round((fuel ? 90 : 45) * Math.min(2.2, k));
    for (let i = 0; i < nFire; i++) {
      const d = randDir(_v);
      if (groundY != null && d.y < 0) d.y *= -0.3;
      const sp = rnd(0.5, 1) * fireR * (fuel ? 2.2 : 4.5);
      const hot = new THREE.Color().setHSL(rnd(0.06, 0.11), 1, rnd(0.5, 0.65)).multiplyScalar(fuel ? 3 : 5);
      this.fire.emit({
        pos: pos.clone().addScaledVector(d, rnd(0, 0.3) * fireR), vel: d.clone().multiplyScalar(sp).add(new THREE.Vector3(0, fuel ? 3 : 1, 0)),
        life: rnd(0.25, 0.6) * (fuel ? 2.4 : 1), size: rnd(0.4, 0.8) * fireR, size1: rnd(1.0, 1.6) * fireR,
        color: hot, color1: 0x401004, alpha: 1, alpha1: 0, drag: 3.5, gravity: fuel ? 4 : 1.5, fadeIn: 0.02,
      });
    }
    // core flash sprite
    this.fire.emit({ pos, life: 0.12, size: fireR * 2.5, size1: fireR * 4, color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(8), alpha: 1, alpha1: 0, fadeIn: 0 });
    // smoke column
    const nSmoke = Math.round((fuel ? 60 : 40) * Math.min(2.5, k));
    for (let i = 0; i < nSmoke; i++) {
      const d = randDir(_v);
      if (d.y < 0) d.y *= -0.5;
      const grey = rnd(0.07, 0.16) * (fuel ? 0.6 : 1);
      this.smoke.emit({
        pos: pos.clone().addScaledVector(d, rnd(0.2, 1) * fireR), vel: d.clone().multiplyScalar(rnd(1, 4) * k).add(new THREE.Vector3(0, rnd(1.5, 3.5) * (fuel ? 1.4 : 1), 0)),
        life: rnd(4, 9), size: fireR * rnd(0.8, 1.3), size1: fireR * rnd(2.5, 4.5),
        color: new THREE.Color(grey, grey * 0.97, grey * 0.94), alpha: rnd(0.5, 0.8), alpha1: 0, drag: 1.2, gravity: 0.25, fadeIn: 0.3,
      });
    }
    // sparks / burning fragments
    const nSpark = Math.round(60 * Math.min(2.5, k));
    for (let i = 0; i < nSpark; i++) {
      const d = randDir(_v);
      if (groundY != null && d.y < -0.1) d.y = -d.y * 0.5;
      this.sparks.emit({
        pos, vel: d.clone().multiplyScalar(rnd(10, 45) * Math.min(1.6, k)),
        life: rnd(0.4, 1.6), size: rnd(0.02, 0.05), color: new THREE.Color(1, rnd(0.45, 0.7), 0.2).multiplyScalar(6), alpha: 1, alpha1: 0.6, drag: 0.6, gravity: -9.81,
      });
    }
    // ground dust ring
    if (groundY != null && pos.y - groundY < 2.5 * k) {
      const n = Math.round(46 * Math.min(2, k));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-0.1, 0.1);
        const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        this.dust.emit({
          pos: new THREE.Vector3(pos.x, groundY + 0.25, pos.z).addScaledVector(dir, 0.6 * k), vel: dir.multiplyScalar(rnd(8, 16) * k).add(new THREE.Vector3(0, rnd(0.3, 1.5), 0)),
          life: rnd(2, 4.5), size: 0.6 * k, size1: rnd(2.5, 4) * k, color: 0x8d8170, alpha: 0.55, alpha1: 0, drag: 2.6, gravity: 0.1, fadeIn: 0.05,
        });
      }
    }
    // visible shockwave shell
    const shell = new THREE.Mesh(this.shockGeo, new THREE.MeshBasicMaterial({ color: 0xfff2dd, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.BackSide }));
    shell.position.copy(pos);
    shell.scale.setScalar(0.1);
    this.scene.add(shell);
    this.shocks.push({ mesh: shell, t: 0, dur: 0.28, r: 9 * k });
  }

  scorch(point, normal, size) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), this.scorchMat);
    m.position.copy(point).addScaledVector(normal, 0.01);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    m.rotateZ(Math.random() * Math.PI * 2);
    m.receiveShadow = true;
    this.scene.add(m);
    this.decals.push(m);
    if (this.decals.length > 60) {
      const old = this.decals.shift();
      this.scene.remove(old);
      old.geometry.dispose();
    }
  }

  // Dust/bits when something breaks, colored by its material.
  breakBurst(pos, matId, size) {
    const s = Math.max(0.2, size);
    const dustColor = { concrete: 0xb4b0a6, cinder: 0xa9a59c, wood: 0xb39370, plywood: 0xc2a27c, cardboard: 0xae946e, ice: 0xe8f4fa, plastic: 0x55575a }[matId];
    if (dustColor) {
      const n = Math.round(10 + s * 14);
      for (let i = 0; i < n; i++) {
        const d = randDir(_v);
        this.dust.emit({
          pos: pos.clone().addScaledVector(d, rnd(0, 0.4) * s), vel: d.clone().multiplyScalar(rnd(0.5, 2.5)),
          life: rnd(1.5, 3.5), size: 0.2 * s, size1: rnd(0.8, 1.5) * s, color: dustColor, alpha: matId === 'ice' ? 0.35 : 0.5, alpha1: 0, drag: 2, gravity: -0.15,
        });
      }
    }
    if (matId === 'glass' || matId === 'tempered' || matId === 'ice') {
      const n = matId === 'tempered' ? 140 : 50;
      for (let i = 0; i < n; i++) {
        const d = randDir(_v);
        this.bits.emit({
          pos: pos.clone().addScaledVector(d, rnd(0, 0.5) * s), vel: d.clone().multiplyScalar(rnd(1, 6)),
          life: rnd(0.6, 1.6), size: rnd(0.006, 0.014), color: new THREE.Color(0.85, 0.95, 1).multiplyScalar(1.5), alpha: 0.9, alpha1: 0.4, gravity: -9.81, drag: 0.3,
        });
      }
    }
    if (matId === 'wood' || matId === 'plywood') {
      for (let i = 0; i < 30; i++) {
        const d = randDir(_v);
        this.bits.emit({ pos, vel: d.clone().multiplyScalar(rnd(2, 8)), life: rnd(0.5, 1.3), size: rnd(0.008, 0.02), color: 0x7a5a38, alpha: 1, alpha1: 1, gravity: -9.81, drag: 0.4 });
      }
    }
  }

  impactSparks(pos, normal, n = 12, speed = 6) {
    for (let i = 0; i < n; i++) {
      const d = randDir(_v).add(normal).normalize();
      this.sparks.emit({ pos, vel: d.multiplyScalar(rnd(0.4, 1) * speed), life: rnd(0.15, 0.5), size: 0.015, color: new THREE.Color(1, 0.7, 0.35).multiplyScalar(5), alpha: 1, alpha1: 0.3, gravity: -9.81, drag: 0.5 });
    }
  }

  puff(pos, color = 0x888888, size = 0.3, n = 8) {
    for (let i = 0; i < n; i++) {
      const d = randDir(_v);
      this.dust.emit({ pos: pos.clone().addScaledVector(d, 0.1 * size), vel: d.clone().multiplyScalar(rnd(0.3, 1.2)), life: rnd(0.6, 1.4), size: size * 0.5, size1: size * 1.6, color, alpha: 0.5, alpha1: 0, drag: 2 });
    }
  }

  update(dt, realDt) {
    for (const s of [this.smoke, this.dust, this.fire, this.sparks, this.bits]) s.update(dt);
    for (const l of this.lights) {
      if (l.userData.dur <= 0) continue;
      l.userData.t += dt;
      const t = l.userData.t / l.userData.dur;
      l.intensity = t >= 1 ? 0 : l.userData.peak * (1 - t) * (1 - t);
      if (t >= 1) l.userData.dur = 0;
    }
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.t += dt;
      const t = s.t / s.dur;
      s.mesh.scale.setScalar(0.1 + s.r * Math.sqrt(t));
      s.mesh.material.opacity = 0.22 * (1 - t);
      if (t >= 1) { this.scene.remove(s.mesh); s.mesh.material.dispose(); this.shocks.splice(i, 1); }
    }
    this.trauma = Math.max(0, this.trauma - realDt * 0.9);
    this.shakeTime += realDt;
    this.blur = Math.max(0, this.blur - realDt * 1.2);
  }

  // Camera shake offsets (applied by the player camera rig).
  shake(out) {
    const s = this.trauma * this.trauma;
    const t = this.shakeTime * 28;
    out.x = s * 0.05 * (Math.sin(t * 1.1) + Math.sin(t * 2.3) * 0.5);
    out.y = s * 0.05 * (Math.sin(t * 1.7 + 1) + Math.sin(t * 2.9) * 0.5);
    out.z = s * 0.035 * Math.sin(t * 1.3 + 2);
    return out;
  }
}

export { randDir, rnd };
