// Particles + small effects: dust puffs, bug-spray clouds, muzzle flashes, sparks, glass shards, steam, rain,
// molt skin. Everything is sized in the current zone's units and scaled to the spider when it makes sense.
import * as THREE from 'three';
import { rand } from '../core/util.js';

const MAX = 1500;
export class Fx {
  constructor(game) {
    this.game = game;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 4); this.size = new Float32Array(MAX);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */`attribute float size; attribute vec4 color; varying vec4 vC; uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(size * uScale / max(-mv.z, 1e-6), 0.0, 256.0); }`,
      fragmentShader: /* glsl */`varying vec4 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; gl_FragColor = vec4(vC.rgb, vC.a * (1.0 - r)); }`,
    });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    this.parts = []; // {p, v, life, max, size, grow, col:[r,g,b,a], drag, grav}
    this.rain = null; this.shards = [];
  }
  attach(scene) { if (this.points.parent !== scene) scene.add(this.points); this.scene = scene; }
  add(p, v, life, size, col, opts = {}) {
    if (this.parts.length >= MAX) this.parts.shift();
    this.parts.push({ p: p.clone(), v: v.clone(), life, max: life, size, grow: opts.grow || 0, col, drag: opts.drag ?? 1.5, grav: opts.grav ?? 0 });
  }
  dust(point, normal, s, amt = 0.5) {
    for (let i = 0; i < 6 + amt * 10; i++) {
      const v = new THREE.Vector3(rand(-1, 1), rand(0, 1), rand(-1, 1)).add(normal).multiplyScalar(s * rand(0.5, 2));
      this.add(point, v, rand(0.4, 1.0), s * rand(0.3, 0.8), [0.55, 0.52, 0.48, 0.35 * amt + 0.1], { grow: s * 1.2 });
    }
  }
  spray(h, P) {
    if (Math.random() > 0.5) return;
    const n = new THREE.Vector3(h.pos.x + Math.sin(h.yaw) * 0.45, h.pos.y + 1.2, h.pos.z + Math.cos(h.yaw) * 0.45);
    const dir = new THREE.Vector3().subVectors(P.pos, n).normalize();
    for (let i = 0; i < 3; i++) this.add(n, dir.clone().multiplyScalar(rand(1.8, 3)).add(new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3))), rand(0.5, 1.0), 0.04, [0.85, 0.9, 0.95, 0.25], { grow: 0.5, drag: 2.5 });
    this.game.audio && this.game.audio.at && Math.random() < 0.1 && this.game.audio.at('spray', n);
  }
  muzzle(p, yaw) {
    for (let i = 0; i < 6; i++) this.add(p, new THREE.Vector3(Math.sin(yaw) * rand(2, 6), rand(-0.5, 0.5), Math.cos(yaw) * rand(2, 6)), rand(0.04, 0.09), 0.12, [1.0, 0.75, 0.35, 1.0], { grow: 0.3, drag: 4 });
    const L = new THREE.PointLight(0xffb060, 30, 6, 2); L.position.copy(p); this.scene && this.scene.add(L);
    setTimeout(() => L.removeFromParent(), 60);
  }
  ricochet(p) { for (let i = 0; i < 8; i++) this.add(p, new THREE.Vector3(rand(-2, 2), rand(0, 3), rand(-2, 2)), rand(0.1, 0.3), 0.02, [1, 0.8, 0.4, 1], { grav: 9.8, drag: 0.5 }); }
  sparks(p, s, n = 12, col = [1, 0.75, 0.3, 1]) { for (let i = 0; i < n; i++) this.add(p, new THREE.Vector3(rand(-1, 1), rand(0, 1.5), rand(-1, 1)).multiplyScalar(s * 6), rand(0.2, 0.6), s * 0.15, col, { grav: 9.8 / (this.game.zone ? this.game.zone.unit : 1), drag: 0.6 }); }
  goo(p, s, n = 10, col = [0.55, 0.62, 0.25, 0.9]) { for (let i = 0; i < n; i++) this.add(p, new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).multiplyScalar(s * 2), rand(0.3, 0.7), s * 0.18, col, { grav: 9.8 / (this.game.zone ? this.game.zone.unit : 1), drag: 0.8 }); }
  glass(p, s = 1) {
    for (let i = 0; i < 40; i++) this.add(p, new THREE.Vector3(rand(-2, 2), rand(-1, 2), rand(-2, 2)).multiplyScalar(s * 2), rand(0.6, 1.6), 0.03 * s, [0.85, 0.95, 1, 0.8], { grav: 9.8, drag: 0.2 });
  }
  steam(p, s = 1) { this.add(p, new THREE.Vector3(rand(-0.15, 0.15), rand(0.8, 1.4), rand(-0.15, 0.15)).multiplyScalar(s), rand(2, 4), 0.5 * s, [0.75, 0.78, 0.8, 0.12], { grow: 1.6 * s, drag: 0.3 }); }
  shockwave(p, s, col = [1, 0.85, 0.6, 0.6]) { for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; this.add(p, new THREE.Vector3(Math.cos(a), rand(-0.05, 0.1), Math.sin(a)).multiplyScalar(s * 8), rand(0.6, 1.2), s * 0.6, col, { grow: s * 2, drag: 1.2 }); } }
  update(dt) {
    const G = this.game;
    this.mat.uniforms.uScale.value = G.renderer.size().h / (2 * Math.tan(G.camera.fov * Math.PI / 360));
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const P = this.parts[i];
      P.life -= dt;
      if (P.life <= 0) { this.parts.splice(i, 1); continue; }
      P.v.multiplyScalar(Math.exp(-P.drag * dt)); P.v.y -= P.grav * dt;
      P.p.addScaledVector(P.v, dt);
      P.size += P.grow * dt;
    }
    for (const P of this.parts) {
      if (n >= MAX) break;
      const a = P.life / P.max;
      this.pos[n * 3] = P.p.x; this.pos[n * 3 + 1] = P.p.y; this.pos[n * 3 + 2] = P.p.z;
      this.col[n * 4] = P.col[0]; this.col[n * 4 + 1] = P.col[1]; this.col[n * 4 + 2] = P.col[2]; this.col[n * 4 + 3] = P.col[3] * Math.min(1, a * 2);
      this.size[n] = P.size; n++;
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;
    // steam from the street vents
    const Z = G.zone;
    if (Z && Z.city && Z.city.steam) for (const s of Z.city.steam) if (Math.random() < dt * 3 && s.distanceTo(G.camera.position) < 200) this.steam(s, 1);
    this.updateRain(dt);
  }
  // rain: a box of streaks that follows the camera (outside only)
  updateRain(dt) {
    const G = this.game, Z = G.zone;
    const want = Z && Z.city && Z.city.rain > 0.05 && Z.inside && !Z.inside(G.camera.position) && G.player && G.player.sizeM < 400;
    if (!want) { if (this.rain) this.rain.visible = false; return; }
    if (!this.rain) {
      const N = 5000, g = new THREE.BufferGeometry(), p = new Float32Array(N * 6);
      for (let i = 0; i < N; i++) { const x = rand(-1, 1), y = rand(-1, 1), z = rand(-1, 1); p.set([x, y, z, x, y, z], i * 6); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Vector3() }, uS: { value: 20 } },
        vertexShader: /* glsl */`uniform float uT; uniform vec3 uC; uniform float uS; varying float vA;
          void main(){ vec3 p = position; p.y = fract(p.y * 0.5 + 0.5 - uT * 0.9) * 2.0 - 1.0; if (gl_VertexID % 2 == 1) p.y -= 0.035;
            vec3 w = uC + p * uS; vA = 0.32 * (1.0 - abs(p.x)) * (1.0 - abs(p.z)); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
        fragmentShader: /* glsl */`varying float vA; void main(){ gl_FragColor = vec4(0.7, 0.75, 0.82, vA); }` });
      this.rain = new THREE.LineSegments(g, m); this.rain.frustumCulled = false; this.rain.renderOrder = 6;
    }
    if (this.rain.parent !== this.scene) this.scene.add(this.rain);
    this.rain.visible = true;
    const u = this.rain.material.uniforms; u.uT.value += dt; u.uC.value.copy(G.camera.position); u.uS.value = Math.max(4, G.player.sizeM * 12);
  }
}
