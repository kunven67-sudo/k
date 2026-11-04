// THE MASK - effects: sparks, time shards, tracers, gadget beams, shockwave rings, and a color wash over your eyes
// (works in VR too: it's a small sphere around the camera, not a screen filter).
import * as THREE from 'three';
import { G, rand } from './game.js';

const MAXP = 900;
let points, pos, col, size, parts = [];
let lines, lpos, lcol, tracers = [];
let wash, washMat, washT = 0, washDur = 1, washPeak = 0;
const beams = [], rings = [];

function pointsMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute vec4 pcol; attribute float psize; varying vec4 vCol; uniform float scale;
      void main(){ vCol = pcol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * scale / max(0.05, -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vCol; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vCol.rgb * a * vCol.a, a * vCol.a); }`
  });
}

export const fx = {
  init(scene, camera) {
    const g = new THREE.BufferGeometry();
    pos = new Float32Array(MAXP * 3); col = new Float32Array(MAXP * 4); size = new Float32Array(MAXP);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    points = new THREE.Points(g, pointsMaterial()); points.frustumCulled = false; points.renderOrder = 6; scene.add(points);
    const lg = new THREE.BufferGeometry(); lpos = new Float32Array(64 * 6); lcol = new Float32Array(64 * 8);
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3).setUsage(THREE.DynamicDrawUsage));
    lg.setAttribute('color', new THREE.BufferAttribute(lcol, 4).setUsage(THREE.DynamicDrawUsage));
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false; scene.add(lines);
    washMat = new THREE.MeshBasicMaterial({ color: 0x2c8c87, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false });
    wash = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 10), washMat); wash.renderOrder = 999; wash.visible = false;
    camera.add(wash);
  },
  // one spark/shard/puff
  particle(p, v, color, { life = 0.6, sz = 0.03, grav = 0, drag = 1.5, fade = 1 } = {}) {
    if (parts.length >= MAXP) parts.shift();
    const c = new THREE.Color(color);
    parts.push({ p: p.clone(), v: v.clone(), c, life, max: life, sz, grav, drag, fade });
  },
  burst(p, color, n = 14, speed = 2.5, opts = {}) {
    for (let i = 0; i < n; i++) this.particle(p, new THREE.Vector3(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1)), color, opts);
  },
  sparks(p, n = 10) { this.burst(p, 0xffc86b, n, 3.2, { life: 0.35, sz: 0.018, grav: 6 }); },
  shards(p, color = 0x3fd0c4, n = 40) { this.burst(p, color, n, 2.2, { life: 1.1, sz: 0.035, grav: -0.5, drag: 2 }); },
  puff(p, color = 0x9aa0b0, n = 10) { this.burst(p, color, n, 0.8, { life: 0.9, sz: 0.09, drag: 3, fade: 0.5 }); },
  tracer(a, b, color = 0xffd27a, life = 0.09) { tracers.push({ a: a.clone(), b: b.clone(), c: new THREE.Color(color), life, max: life }); },
  beam(a, b, color, width = 0.012, life = 0.18) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(width, width, len, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    G.scene.add(m); beams.push({ m, life, max: life });
    this.burst(b, color, 10, 1.4, { life: 0.4, sz: 0.03 });
  },
  ring(p, color, r = 1.5, life = 0.5, normal = null) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    m.position.copy(p); if (normal) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); else m.rotation.x = Math.PI / 2;
    G.scene.add(m); rings.push({ m, r, life, max: life });
  },
  // color over your eyes for a moment (rewind, putting the mask on, getting hit)
  wash(color, peak = 0.5, dur = 0.6) { washMat.color.set(color); washPeak = peak; washDur = dur; washT = dur; wash.visible = true; },
  update(dt) {
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.v.y -= q.grav * dt; q.v.multiplyScalar(Math.exp(-q.drag * dt)); q.p.addScaledVector(q.v, dt);
    }
    for (const q of parts) {
      const k = q.life / q.max;
      pos[n * 3] = q.p.x; pos[n * 3 + 1] = q.p.y; pos[n * 3 + 2] = q.p.z;
      col[n * 4] = q.c.r; col[n * 4 + 1] = q.c.g; col[n * 4 + 2] = q.c.b; col[n * 4 + 3] = Math.pow(k, q.fade);
      size[n] = q.sz * (0.5 + 0.5 * k); n++;
    }
    const g = points.geometry; g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true; g.attributes.pcol.needsUpdate = true; g.attributes.psize.needsUpdate = true;
    let m = 0;
    for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.life -= dt; if (t.life <= 0) tracers.splice(i, 1); }
    for (const t of tracers.slice(-64)) {
      const k = t.life / t.max;
      lpos.set([t.a.x, t.a.y, t.a.z, t.b.x, t.b.y, t.b.z], m * 6);
      lcol.set([t.c.r, t.c.g, t.c.b, k * 0.3, t.c.r, t.c.g, t.c.b, k], m * 8); m++;
    }
    lines.geometry.setDrawRange(0, m * 2); lines.geometry.attributes.position.needsUpdate = true; lines.geometry.attributes.color.needsUpdate = true;
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i]; b.life -= dt; b.m.material.opacity = Math.max(0, b.life / b.max) * 0.9; b.m.scale.x = b.m.scale.z = b.life / b.max;
      if (b.life <= 0) { G.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); beams.splice(i, 1); }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.life -= dt; const k = 1 - r.life / r.max; r.m.scale.setScalar(0.05 + r.r * k); r.m.material.opacity = 1 - k;
      if (r.life <= 0) { G.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); rings.splice(i, 1); }
    }
    if (washT > 0) {
      washT -= dt; const k = Math.max(0, washT / washDur);
      washMat.opacity = washPeak * Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5) * (k < 0.98 ? 1 : (1 - k) * 50);
      if (washT <= 0) wash.visible = false;
    }
  }
};
