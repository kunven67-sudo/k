// Stink lines: a few thin, wavy, sickly-green wisps rising off an unwashed body.
// One instanced draw call; the waving, rising and fading all happen in the vertex/fragment
// shader (camera-facing ribbons), so the CPU cost is a uniform write per frame.

import * as THREE from 'three';

const COUNT = 7;

const vert = /* glsl */ `
  attribute float aPhase;
  uniform float uTime;
  uniform float uStrength;
  varying float vV;
  varying float vU;
  varying float vLife;
  void main() {
    // Each wisp loops: rise 0..1 over ~3.2 s, offset by its phase.
    float life = fract(uTime * 0.31 + aPhase);
    vLife = life;
    vV = uv.y;
    vU = uv.x;
    vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float y = uv.y * 0.42;
    float wave = sin(uv.y * 9.0 - uTime * 3.1 + aPhase * 17.0) * 0.035 * (0.4 + uv.y)
               + sin(uv.y * 3.7 + uTime * 1.3 + aPhase * 5.0) * 0.02;
    float width = 0.006 + 0.004 * uv.y;
    c.x += wave + (uv.x - 0.5) * width * 2.0;
    c.y += y + life * 0.35;
    gl_Position = projectionMatrix * c;
  }
`;

const frag = /* glsl */ `
  uniform float uStrength;
  varying float vV;
  varying float vU;
  varying float vLife;
  void main() {
    float edge = 1.0 - abs(vU - 0.5) * 2.0;
    float along = smoothstep(0.0, 0.25, vV) * smoothstep(1.0, 0.55, vV);
    float fade = smoothstep(0.0, 0.2, vLife) * smoothstep(1.0, 0.6, vLife);
    float a = edge * along * fade * uStrength * 0.55;
    if (a < 0.004) discard;
    gl_FragColor = vec4(0.52, 0.66, 0.24, a);
  }
`;

export class StinkLines {
  constructor(scene) {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 14);
    const phase = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) phase[i] = i / COUNT + Math.random() * 0.08;
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    this.uniforms = { uTime: { value: 0 }, uStrength: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    // Wisps sit around the torso/shoulders, a little in front and behind.
    const m = new THREE.Matrix4();
    for (let i = 0; i < COUNT; i++) {
      const a = (i / COUNT) * Math.PI * 2 + 0.4;
      const r = 0.22 + (i % 3) * 0.05;
      m.makeTranslation(Math.cos(a) * r, 0.95 + (i % 4) * 0.18, Math.sin(a) * r * 0.7);
      this.mesh.setMatrixAt(i, m);
    }
    this.root = new THREE.Group();
    this.root.add(this.mesh);
    scene.add(this.root);
    this.strength = 0;
  }

  /** strength 0..1 (0 hides the draw call entirely). */
  update(dt, position, strength) {
    this.strength += (strength - this.strength) * Math.min(1, dt * 0.8);
    const on = this.strength > 0.02;
    this.mesh.visible = on;
    if (!on) return;
    this.uniforms.uTime.value += dt;
    this.uniforms.uStrength.value = this.strength;
    if (position) this.root.position.copy(position);
  }

  dispose() {
    this.root.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
