// GPU-instanced billboard particles: one draw call per system.
// Sprite textures are drawn procedurally (soft puffs / sparks), like most engines' default sprites.
import * as THREE from 'three';

function makeSprite(kind) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  // value noise for puff breakup
  const N = 16, grid = [];
  for (let i = 0; i < (N + 1) * (N + 1); i++) grid.push(Math.random());
  const noise = (x, y) => {
    const gx = x * N, gy = y * N, ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    const a = grid[iy * (N + 1) + ix], b = grid[iy * (N + 1) + ix + 1], c2 = grid[(iy + 1) * (N + 1) + ix], d = grid[(iy + 1) * (N + 1) + ix + 1];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + d) * sx * sy;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const dx = u - 0.5, dy = v - 0.5;
    const r = Math.sqrt(dx * dx + dy * dy) * 2;
    let a;
    if (kind === 'spark') {
      a = Math.max(0, 1 - r) ** 3;
    } else {
      const n = noise(u * 0.999, v * 0.999) * 0.6 + noise((u * 2) % 1, (v * 2) % 1) * 0.4;
      a = Math.max(0, 1 - r) ** (kind === 'fire' ? 1.4 : 1.8) * (0.55 + n * 0.9);
      a = Math.min(1, a);
    }
    const i = (y * S + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const vert = /* glsl */`
  attribute vec3 iPos;
  attribute vec3 iVel;
  attribute vec2 iSizeRot;
  attribute vec4 iColor;
  varying vec2 vUv;
  varying vec4 vColor;
  uniform float stretch;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vColor = iColor;
    vec4 mvPosition = viewMatrix * vec4(iPos, 1.0);
    vec2 corner = position.xy;
    float c = cos(iSizeRot.y), s = sin(iSizeRot.y);
    vec2 offs = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c) * iSizeRot.x;
    if (stretch > 0.0) {
      // velocity-aligned streaks (sparks)
      vec3 v = (viewMatrix * vec4(iVel, 0.0)).xyz;
      vec2 dir = length(v.xy) > 1e-4 ? normalize(v.xy) : vec2(0.0, 1.0);
      vec2 perp = vec2(-dir.y, dir.x);
      float len = iSizeRot.x + length(v.xy) * stretch;
      offs = dir * corner.y * len + perp * corner.x * iSizeRot.x;
    }
    mvPosition.xy += offs;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const frag = /* glsl */`
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vColor;
  #include <fog_pars_fragment>
  void main() {
    vec4 t = texture2D(map, vUv);
    gl_FragColor = vec4(vColor.rgb, vColor.a * t.a);
    if (gl_FragColor.a < 0.004) discard;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class ParticleSystem {
  constructor(scene, { max = 1500, kind = 'smoke', additive = false, stretch = 0 } = {}) {
    this.max = max;
    this.count = 0;
    this.p = []; // particle state objects
    const geo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSR = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iVel', this.aVel);
    geo.setAttribute('iSizeRot', this.aSR);
    geo.setAttribute('iColor', this.aCol);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, stretch: { value: stretch } }]),
      vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, fog: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    mat.uniforms.map.value = makeSprite(kind);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 3 : 2;
    scene.add(this.mesh);
  }

  // opts: pos, vel, life, size, size1, color (THREE.Color or hex), alpha, alpha1, drag, gravity, rot, spin, grow
  emit(o) {
    if (this.p.length >= this.max) this.p.shift();
    const col = o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color ?? 0xffffff);
    this.p.push({
      x: o.pos.x, y: o.pos.y, z: o.pos.z,
      vx: o.vel?.x ?? 0, vy: o.vel?.y ?? 0, vz: o.vel?.z ?? 0,
      age: 0, life: o.life ?? 1,
      s0: o.size ?? 0.5, s1: o.size1 ?? o.size ?? 0.5,
      r: col.r, g: col.g, b: col.b,
      c1: o.color1 ? new THREE.Color(o.color1) : null,
      a0: o.alpha ?? 1, a1: o.alpha1 ?? 0,
      drag: o.drag ?? 0, grav: o.gravity ?? 0,
      rot: o.rot ?? Math.random() * Math.PI * 2, spin: o.spin ?? (Math.random() - 0.5),
      fadeIn: o.fadeIn ?? 0.05,
    });
  }

  update(dt) {
    const arr = this.p;
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.grav * dt; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rot += p.spin * dt;
      arr[w++] = p;
    }
    arr.length = w;
    const n = Math.min(w, this.max);
    const P = this.aPos.array, V = this.aVel.array, SR = this.aSR.array, C = this.aCol.array;
    for (let i = 0; i < n; i++) {
      const p = arr[i];
      const t = p.age / p.life;
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      V[i * 3] = p.vx; V[i * 3 + 1] = p.vy; V[i * 3 + 2] = p.vz;
      SR[i * 2] = p.s0 + (p.s1 - p.s0) * (1 - (1 - t) * (1 - t));
      SR[i * 2 + 1] = p.rot;
      let r = p.r, g = p.g, b = p.b;
      if (p.c1) { r += (p.c1.r - r) * t; g += (p.c1.g - g) * t; b += (p.c1.b - b) * t; }
      const fi = p.fadeIn > 0 ? Math.min(1, p.age / p.fadeIn) : 1;
      C[i * 4] = r; C[i * 4 + 1] = g; C[i * 4 + 2] = b;
      C[i * 4 + 3] = (p.a0 + (p.a1 - p.a0) * t) * fi;
    }
    this.geo.instanceCount = n;
    for (const a of [this.aPos, this.aVel, this.aSR, this.aCol]) a.needsUpdate = true;
  }
}
