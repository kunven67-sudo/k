import * as THREE from '../three.js';
import { LAYER_SKY } from './kit.js';

const vert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pinned to the far plane
  }`;

const frag = /* glsl */ `
  uniform vec3 top;
  uniform vec3 horizon;
  uniform vec3 bottom;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  uniform float sunSize;
  uniform vec3 moonDir;
  uniform float moon;
  uniform float stars;
  uniform float time;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, bottom, clamp(-h * 3.0, 0.0, 1.0));

    // cartoon sun: hard disc with a soft halo
    float sd = dot(d, normalize(sunDir));
    float disc = smoothstep(cos(sunSize), cos(sunSize * 0.92), sd);
    col = mix(col, sunColor * 1.6, disc);
    col += sunColor * 0.25 * pow(max(sd, 0.0), 24.0);

    // moon with a couple of craters
    if (moon > 0.0) {
      vec3 md = normalize(moonDir);
      float m = dot(d, md);
      float mr = 0.035;
      float body = smoothstep(cos(mr), cos(mr * 0.9), m);
      vec3 tx = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
      vec3 ty = cross(tx, md);
      vec2 uv = vec2(dot(d, tx), dot(d, ty)) / mr;
      float crater = smoothstep(0.32, 0.26, length(uv - vec2(0.3, 0.25))) + smoothstep(0.22, 0.17, length(uv - vec2(-0.35, -0.2))) + smoothstep(0.16, 0.12, length(uv - vec2(0.05, -0.45)));
      vec3 mc = mix(vec3(1.25, 1.22, 1.05), vec3(0.85, 0.85, 0.78), clamp(crater, 0.0, 1.0));
      col = mix(col, mc, body * moon);
      col += vec3(0.25, 0.3, 0.45) * pow(max(m, 0.0), 300.0) * moon;
    }

    // stars
    if (stars > 0.0 && h > -0.05) {
      vec3 g = floor(d * 220.0);
      float s = hash(g);
      float tw = 0.6 + 0.4 * sin(time * 2.0 + s * 40.0);
      float star = step(0.9965, s) * tw;
      col += vec3(star) * stars * 1.4 * smoothstep(-0.05, 0.2, h);
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

export class Sky {
  constructor() {
    this.uniforms = {
      top: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0.3, 0.6, -0.5) },
      sunColor: { value: new THREE.Color(1, 0.95, 0.75) },
      sunSize: { value: 0.045 },
      moonDir: { value: new THREE.Vector3(-0.4, 0.45, -0.6) },
      moon: { value: 0 },
      stars: { value: 0 },
      time: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
    this.mesh.renderOrder = -1000;
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER_SKY);
  }

  set({ top, horizon, bottom, sun = null, sunColor = null, sunSize = null, moon = 0, stars = 0, moonDir = null }) {
    const u = this.uniforms;
    u.top.value.set(top);
    u.horizon.value.set(horizon);
    u.bottom.value.set(bottom);
    if (sun) u.sunDir.value.copy(sun).normalize();
    if (sunColor !== null) u.sunColor.value.set(sunColor);
    if (sunSize !== null) u.sunSize.value = sunSize;
    if (moonDir) u.moonDir.value.copy(moonDir).normalize();
    u.moon.value = moon;
    u.stars.value = stars;
  }

  update(camera, t) {
    this.mesh.position.copy(camera.position);
    this.uniforms.time.value = t;
  }
}
