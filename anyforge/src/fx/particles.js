// Particles: fire, smoke, sparks, dust and blood drops. One draw call per kind (points that always face you).
import * as THREE from 'three';
import { scene, camera, renderer } from '../core/render.js';

function cloudTexture(soft) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  // soft puff with a little lumpy noise so smoke does not look like perfect circles
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = (x - 64) / 64, dy = (y - 64) / 64, r = Math.sqrt(dx * dx + dy * dy);
    const n = soft ? 1 : 0.75 + 0.25 * Math.sin(x * 0.21 + Math.sin(y * 0.17) * 3) * Math.cos(y * 0.19 + Math.sin(x * 0.13) * 2);
    const a = Math.max(0, 1 - r) ** (soft ? 2 : 1.6) * n;
    const i = (y * 128 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.min(255, a * 255);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Pool {
  constructor(n, { additive = false, soft = false, gravity = 0, drag = 0, ground = false } = {}) {
    this.n = n; this.gravity = gravity; this.drag = drag; this.groundHit = ground;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grow = new Float32Array(n); this.base = new Float32Array(n * 4); this.next = 0; this.live = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: cloudTexture(soft) }, uScale: { value: 600 } },
      vertexShader: `attribute float size; attribute vec4 color; varying vec4 vC;
        uniform float uScale;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = size * uScale / max(0.1, -mv.z); }`,
      fragmentShader: `uniform sampler2D uTex; varying vec4 vC;
        void main(){ vec4 t = texture2D(uTex, gl_PointCoord); float a = t.a * vC.a; if (a < 0.003) discard; gl_FragColor = vec4(vC.rgb * ${additive ? 'a' : '1.0'}, a);
        #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.mat = m;
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 8 : 7;
    scene.add(this.points);
    this.geo = g;
    this.onGround = null;
  }
  emit(p, v, color, alpha, size, life, grow = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.base.set([color.r, color.g, color.b, alpha], i * 4);
    this.size[i] = size; this.grow[i] = grow;
    this.life[i] = life; this.max[i] = life;
  }
  update(dt) {
    const h = renderer.getSize(_s).y * renderer.getPixelRatio();
    this.mat.uniforms.uScale.value = renderer.xr.isPresenting ? 900 : h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let live = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.col[i * 4 + 3] !== 0) this.col[i * 4 + 3] = 0; continue; }
      live++;
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] += this.gravity * dt;
      const d = 1 - this.drag * dt;
      this.vel[k] *= d; this.vel[k + 1] *= d; this.vel[k + 2] *= d;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      if (this.groundHit && this.pos[k + 1] < 0.02) {
        if (this.onGround) this.onGround(this.pos[k], this.pos[k + 2], this.base[i * 4], this.size[i]);
        this.life[i] = 0; this.col[i * 4 + 3] = 0; continue;
      }
      const t = this.life[i] / this.max[i];
      this.size[i] += this.grow[i] * dt;
      this.col[i * 4] = this.base[i * 4]; this.col[i * 4 + 1] = this.base[i * 4 + 1]; this.col[i * 4 + 2] = this.base[i * 4 + 2];
      this.col[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 10 + 0.3);
    }
    this.live = live;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}
const _s = new THREE.Vector2();
const C = new THREE.Color(), V = new THREE.Vector3(), V2 = new THREE.Vector3();
const rnd = (a = 1) => (Math.random() * 2 - 1) * a;

export function makeFX() {
  const fire = new Pool(500, { additive: true, drag: 1.2 });
  const smoke = new Pool(700, { soft: false, drag: 0.6 });
  const spark = new Pool(400, { additive: true, gravity: -9.8, drag: 0.4, soft: true });
  const blood = new Pool(400, { gravity: -9.8, drag: 0.2, soft: true, ground: true });
  const dust = new Pool(300, { soft: true, drag: 1.5 });

  // blood that lands leaves a flat stain on the ground that fades after a while
  const stains = [];
  const stainTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (0.5 + Math.random() * 0.5) + ')';
      g.beginPath(); g.arc(32 + rnd(14), 32 + rnd(14), 4 + Math.random() * 12, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const stainMat = new THREE.MeshStandardMaterial({ map: stainTex, color: 0x5a0606, transparent: true, depthWrite: false, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const stainGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  blood.onGround = (x, z, r, size) => {
    if (stains.length > 140) { const old = stains.shift(); scene.remove(old.m); }
    const m = new THREE.Mesh(stainGeo, stainMat);
    m.position.set(x, 0.012, z);
    m.rotation.y = Math.random() * 6.3;
    m.scale.setScalar(0.08 + size * 2.2);
    scene.add(m);
    stains.push({ m, t: 70 });
  };

  const fx = {
    gore: 'some',
    fire(p, n = 30, scale = 1) {
      for (let i = 0; i < n; i++) {
        V.set(rnd(), rnd() * 0.6 + 0.6, rnd()).normalize().multiplyScalar((2 + Math.random() * 7) * scale);
        C.setRGB(1, 0.45 + Math.random() * 0.35, 0.12);
        fire.emit(V2.copy(p).addScaledVector(V, 0.05), V, C, 0.9, (0.6 + Math.random() * 1.2) * scale, 0.35 + Math.random() * 0.5, 2.5 * scale);
      }
    },
    smoke(p, v = null, color = '#5d5d5d', size = 1.5, n = 1) {
      for (let i = 0; i < n; i++) {
        C.set(color);
        V.set(rnd(0.5), 0.6 + Math.random() * 0.6, rnd(0.5));
        if (v) V.add(v);
        smoke.emit(V2.set(p.x + rnd(0.15), p.y + rnd(0.15), p.z + rnd(0.15)), V, C, 0.42, size * (0.6 + Math.random() * 0.6), 2.5 + Math.random() * 2.5, size * 0.9);
      }
    },
    sparks(p, n = 14, speed = 6, color = 0xffc070) {
      C.set(color);
      for (let i = 0; i < n; i++) {
        V.set(rnd(), Math.random() * 1.2, rnd()).normalize().multiplyScalar(speed * (0.3 + Math.random()));
        spark.emit(p, V, C, 1, 0.05 + Math.random() * 0.05, 0.4 + Math.random() * 0.6);
      }
    },
    dust(p, n = 6, size = 0.8) {
      C.set('#a69b8a');
      for (let i = 0; i < n; i++) {
        V.set(rnd(1.5), Math.random() * 0.8, rnd(1.5));
        dust.emit(V2.set(p.x + rnd(0.3), p.y, p.z + rnd(0.3)), V, C, 0.35, size * (0.5 + Math.random()), 1 + Math.random(), size);
      }
    },
    // blood drops fly out of the hit spot along the hit direction; amount follows the Gore setting
    blood(p, dir, amount = 1) {
      if (fx.gore === 'off') return;
      const n = Math.round((fx.gore === 'max' ? 22 : 9) * amount);
      for (let i = 0; i < n; i++) {
        V.copy(dir).multiplyScalar(1 + Math.random() * 2.5).add(V2.set(rnd(1.4), Math.random() * 1.8, rnd(1.4)));
        C.setRGB(0.32 + Math.random() * 0.12, 0.01, 0.01);
        blood.emit(p, V, C, 1, 0.02 + Math.random() * 0.035, 1.6);
      }
    },
    explosion(p, scale = 1) {
      fx.fire(p, Math.round(60 * scale), scale);
      for (let i = 0; i < 14 * scale; i++) {
        fx.smoke(V.set(p.x + rnd(scale), p.y + Math.random() * scale, p.z + rnd(scale)), V2.set(rnd(3), 2 + Math.random() * 3, rnd(3)), '#3b3836', 2.5 * scale);
      }
      fx.sparks(p, Math.round(40 * scale), 14 * scale);
    },
    update(dt) {
      fire.update(dt); smoke.update(dt); spark.update(dt); blood.update(dt); dust.update(dt);
      for (let i = stains.length - 1; i >= 0; i--) {
        const s = stains[i];
        s.t -= dt;
        if (s.t <= 0) { scene.remove(s.m); stains.splice(i, 1); }
      }
    },
    clearStains() { for (const s of stains) scene.remove(s.m); stains.length = 0; }
  };
  return fx;
}
