// Blood drops, blood on the ground, gun flashes, explosions.
import * as THREE from 'three';

function splatTexture() {
  // a liquid splat with soft edges + darker clots (used for drops + ground pools)
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const blob = (x, y, r, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.7, `rgba(255,255,255,${a * 0.9})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  blob(128, 128, 70, 1);
  for (let i = 0; i < 26; i++) { const a = Math.random() * 7, d = 40 + Math.random() * 70; blob(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 6 + Math.random() * 18, 0.95); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,200,110,0.9)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) { const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 14 + Math.random() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  return new THREE.CanvasTexture(c);
}

export class FX {
  constructor(scene, audio) {
    this.scene = scene; this.audio = audio; this.bloodAmount = 1;
    const splat = splatTexture();
    // drops
    this.maxDrops = 1500; this.drops = [];
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshStandardMaterial({ color: 0x5a0000, roughness: 0.25, metalness: 0 }), this.maxDrops);
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.dropMesh.count = 0; this.dropMesh.frustumCulled = false; scene.add(this.dropMesh);
    // pools on the ground
    this.maxPools = 260; this.pools = []; this.poolIdx = 0;
    const pm = new THREE.MeshStandardMaterial({ color: 0x3d0000, roughness: 0.15, metalness: 0, transparent: true, alphaMap: splat, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.poolMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pm, this.maxPools);
    this.poolMesh.count = 0; this.poolMesh.frustumCulled = false; this.poolMesh.receiveShadow = true; scene.add(this.poolMesh);
    // flashes / fire / smoke sprites
    this.glow = glowTexture(); this.smoke = smokeTexture(); this.sprites = [];
    this.lights = [];
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffb060, 0, 12, 2); l.visible = false; scene.add(l); this.lights.push(l); }
    this.shake = 0;
  }
  // spray of blood from p in direction dir
  blood(p, dir = null, n = 20, speed = 3) {
    n = Math.round(n * this.bloodAmount); if (n <= 0) return;
    for (let i = 0; i < n; i++) {
      if (this.drops.length >= this.maxDrops) this.drops.shift();
      const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8, (Math.random() - 0.5)).multiplyScalar(speed);
      if (dir) v.addScaledVector(dir, speed * (0.4 + Math.random() * 0.8));
      this.drops.push({ p: p.clone(), v, s: 0.006 + Math.random() * 0.014, life: 3 });
    }
  }
  pool(x, z, size) {
    if (this.bloodAmount <= 0) return;
    const i = this.poolIdx++ % this.maxPools; const m = new THREE.Matrix4();
    const s = size * (0.7 + Math.random() * 0.6);
    m.compose(new THREE.Vector3(x, 0.004 + (i % 7) * 0.0004, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28), new THREE.Vector3(s, 1, s));
    this.poolMesh.setMatrixAt(i, m); this.poolMesh.count = Math.min(this.maxPools, Math.max(this.poolMesh.count, i + 1)); this.poolMesh.instanceMatrix.needsUpdate = true;
  }
  sprite(tex, p, size, life, { add = true, color = 0xffffff, rise = 0, grow = 0, opacity = 1 } = {}) {
    const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity });
    const s = new THREE.Sprite(m); s.position.copy(p); s.scale.setScalar(size); this.scene.add(s);
    this.sprites.push({ s, life, max: life, rise, grow, opacity });
  }
  light(p, power, life, color = 0xffb060) {
    const l = this.lights.find(l => !l.visible) || this.lights[0];
    l.position.copy(p); l.color.set(color); l.intensity = power; l.visible = true; l.userData = { life, max: life, power };
  }
  muzzle(p) { this.sprite(this.glow, p, 0.35, 0.06); this.light(p, 30, 0.06); }
  dust(p) { this.sprite(this.smoke, p, 0.4, 0.8, { add: false, color: 0x8a7f6c, rise: 0.4, grow: 0.8, opacity: 0.7 }); }
  explosion(p) {
    this.sprite(this.glow, p.clone().setY(p.y + 0.6), 7, 0.35);
    this.sprite(this.glow, p.clone().setY(p.y + 1.2), 4, 0.6, { color: 0xff7a30 });
    for (let i = 0; i < 9; i++) this.sprite(this.smoke, p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 3)), 3 + Math.random() * 2, 2.5 + Math.random() * 2, { add: false, color: 0x2b2722, rise: 1.2, grow: 2.2, opacity: 0.85 });
    this.light(p.clone().setY(p.y + 1), 400, 0.5, 0xffa040);
    this.audio.play('boom', { pos: p, vol: 1.2, far: 200 });
    this.shake = Math.max(this.shake, 1);
  }
  update(dt) {
    // drops
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    let n = 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.v.y -= 9.81 * dt; d.p.addScaledVector(d.v, dt); d.life -= dt;
      if (d.p.y <= 0.005) { if (Math.random() < 0.25) this.pool(d.p.x, d.p.z, 0.05 + d.s * 8); this.drops.splice(i, 1); continue; }
      if (d.life <= 0) { this.drops.splice(i, 1); continue; }
    }
    for (const d of this.drops) { sc.set(d.s, d.s * (1 + Math.min(2, d.v.length() * 0.3)), d.s); q.setFromUnitVectors(_up, _t.copy(d.v).normalize()); m.compose(d.p, q, sc); this.dropMesh.setMatrixAt(n++, m); }
    this.dropMesh.count = n; this.dropMesh.instanceMatrix.needsUpdate = true;
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]; s.life -= dt; const k = s.life / s.max;
      if (s.life <= 0) { this.scene.remove(s.s); s.s.material.dispose(); this.sprites.splice(i, 1); continue; }
      s.s.material.opacity = s.opacity * Math.min(1, k * 2); s.s.position.y += s.rise * dt; s.s.scale.multiplyScalar(1 + s.grow * dt * 0.3);
    }
    for (const l of this.lights) if (l.visible) { const u = l.userData; u.life -= dt; l.intensity = u.power * Math.max(0, u.life / u.max); if (u.life <= 0) l.visible = false; }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
}
const _up = new THREE.Vector3(0, 1, 0), _t = new THREE.Vector3();
