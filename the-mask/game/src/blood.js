// THE MASK - cartoon blood: drops fly, land and leave splats on the floor and walls; pools under bodies.
// No gore: nothing comes off anyone.
import * as THREE from 'three';
import { G, rand } from './game.js';
import { ROOM } from './room.js';
import { S } from './settings.js';
import { toon } from './toon.js';

const MAXD = 260;
let MAXS = 220;
const drops = [];
let dropMesh, splatMesh, splats = [], splatCount = 0, pools = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3();
const UP = new THREE.Vector3(0, 0, 1);

function splatTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d');
  k.translate(64, 64);
  const blob = (r, n, jag, col) => {
    k.fillStyle = col; k.beginPath();
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr = r * (1 - jag + Math.random() * jag * 2); i ? k.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : k.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    k.closePath(); k.fill();
  };
  blob(40, 22, 0.18, '#7d0f17');
  blob(33, 18, 0.12, '#a3161f');
  for (let i = 0; i < 7; i++) { const a = Math.random() * 7, d = 44 + Math.random() * 14; k.save(); k.translate(Math.cos(a) * d, Math.sin(a) * d); blob(3 + Math.random() * 5, 8, 0.2, '#8e121b'); k.restore(); }
  k.fillStyle = 'rgba(255,190,190,0.35)'; k.beginPath(); k.ellipse(-10, -12, 9, 5, -0.6, 0, 7); k.fill(); // wet shine
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export const blood = {
  init(scene) {
    dropMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.011, 0), toon({ color: 0xa3161f }), MAXD);
    dropMesh.count = 0; dropMesh.frustumCulled = false; scene.add(dropMesh);
    const mat = toon({ map: splatTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    splatMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, 400);
    splatMesh.count = 0; splatMesh.frustumCulled = false; splatMesh.receiveShadow = true; splatMesh.renderOrder = 1; scene.add(splatMesh);
  },
  setMax(n) { MAXS = Math.min(400, n); },
  get count() { return splatCount; },
  spray(point, dir, n = 6, k = 1) {
    if (!S.blood) return;
    for (let i = 0; i < n && drops.length < MAXD; i++) {
      const v = new THREE.Vector3(dir.x + rand(-0.6, 0.6), dir.y * 0.5 + rand(0.2, 1.3), dir.z + rand(-0.6, 0.6)).multiplyScalar(rand(1.2, 3.2) * k);
      drops.push({ p: point.clone(), v, s: rand(0.6, 1.6), life: 3 });
    }
  },
  pool(at, r) { if (!S.blood) return; pools.push({ i: this.splat(new THREE.Vector3(at.x, 0, at.z), new THREE.Vector3(0, 1, 0), 0.05), r, t: 0 }); },
  splat(p, n, size) {
    if (!S.blood) return -1;
    const i = splatCount < MAXS ? splatCount++ : (splatCount = MAXS, (this.ring = ((this.ring || 0) + 1) % MAXS));
    _q.setFromUnitVectors(UP, n); _q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * 7));
    _p.copy(p).addScaledVector(n, 0.003 + i * 0.000004);
    _m.compose(_p, _q, _s.set(size, size, size));
    splatMesh.setMatrixAt(i, _m); splatMesh.count = splatCount; splatMesh.instanceMatrix.needsUpdate = true;
    splats[i] = { p: _p.clone(), q: _q.clone() };
    return i;
  },
  clear() { splatCount = 0; splatMesh.count = 0; drops.length = 0; pools.length = 0; this.ring = 0; },
  // rewind: drop the splats made since the loop started
  truncate(n) { if (n < splatCount) { splatCount = n; splatMesh.count = n; pools = pools.filter((p) => p.i < n); } },
  update(dt) {
    const HW = ROOM.W / 2, HD = ROOM.D / 2;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); d.life -= dt;
      let n = null;
      if (d.p.y <= 0.001) { d.p.y = 0; n = _n.set(0, 1, 0); }
      else if (d.p.x <= -HW) { d.p.x = -HW; n = _n.set(1, 0, 0); } else if (d.p.x >= HW) { d.p.x = HW; n = _n.set(-1, 0, 0); }
      else if (d.p.z <= -HD) { d.p.z = -HD; n = _n.set(0, 0, 1); } else if (d.p.z >= HD) { d.p.z = HD; n = _n.set(0, 0, -1); }
      if (n || d.life <= 0) { if (n) this.splat(d.p, n.clone(), 0.035 * d.s + Math.random() * 0.03); drops.splice(i, 1); }
    }
    for (const pl of pools) {
      if (pl.t >= 1) continue;
      pl.t = Math.min(1, pl.t + dt / 4); const s = 0.08 + pl.r * 2 * Math.sqrt(pl.t);
      const sp = splats[pl.i]; if (!sp) continue;
      _m.compose(sp.p, sp.q, _s.set(s, s, s)); splatMesh.setMatrixAt(pl.i, _m); splatMesh.instanceMatrix.needsUpdate = true;
    }
    dropMesh.count = drops.length;
    for (let i = 0; i < drops.length; i++) { const d = drops[i]; _m.compose(d.p, _q.identity(), _s.setScalar(d.s)); dropMesh.setMatrixAt(i, _m); }
    if (drops.length) dropMesh.instanceMatrix.needsUpdate = true;
  }
};
