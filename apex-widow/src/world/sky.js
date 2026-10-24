// Sky dome for Earth zones: real-ish day colours from the sun height, a night sky full of real-looking stars + the
// Milky Way band, the moon with its phase, drifting clouds lit by the city's orange glow, rain darkening.
import * as THREE from 'three';

export class Sky {
  constructor(radius = 9000) {
    this.u = {
      uSun: { value: new THREE.Vector3(0, -0.3, 1).normalize() }, uMoon: { value: new THREE.Vector3(0.3, 0.5, -0.8).normalize() },
      uTime: { value: 0 }, uCloud: { value: 0.55 }, uRain: { value: 0.0 }, uGlow: { value: 1.0 }, uMoonPhase: { value: 0.7 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: /* glsl */`
        varying vec3 vDir; uniform vec3 uSun; uniform vec3 uMoon; uniform float uTime; uniform float uCloud; uniform float uRain; uniform float uGlow; uniform float uMoonPhase;
        float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          vec3 d = normalize(vDir);
          float sunH = uSun.y;                         // -1..1
          float day = smoothstep(-0.12, 0.25, sunH);
          float hor = 1.0 - clamp(d.y, 0.0, 1.0);
          float hor2 = hor * hor;
          // day sky: deep blue up, pale at the horizon; sunset orange near the sun
          vec3 zen = mix(vec3(0.004, 0.006, 0.014), vec3(0.16, 0.34, 0.72), day);
          vec3 hz = mix(vec3(0.02, 0.025, 0.04), vec3(0.62, 0.74, 0.88), day);
          vec3 col = mix(zen, hz, hor2 * hor);
          float sd = max(dot(d, uSun), 0.0);
          float set = 1.0 - smoothstep(-0.05, 0.35, abs(sunH));
          col += vec3(1.0, 0.45, 0.15) * set * sd * sd * sd * 1.2 * hor;
          col += vec3(1.0, 0.85, 0.6) * smoothstep(0.9985, 0.9995, sd) * 30.0 * smoothstep(-0.05, 0.02, sunH);
          col += vec3(1.0, 0.8, 0.55) * sd * sd * sd * sd * sd * sd * sd * sd * 0.6 * day;
          // night: stars + milky way band (fade by day, by clouds, by the city's light pollution near the horizon)
          float night = 1.0 - day;
          if (night > 0.01) {
            vec3 sp = d * 380.0; vec3 ci = floor(sp);
            float st = h3(ci);
            float star = step(0.9965, st) * (1.0 - smoothstep(0.0, 0.62, length(fract(sp) - 0.5))) * (0.4 + 2.2 * h3(ci + 7.0));
            star *= 0.65 + 0.35 * sin(uTime * (2.0 + 5.0 * h3(ci + 3.0)) + st * 40.0);
            vec3 sc = mix(vec3(1.0, 0.75, 0.55), vec3(0.65, 0.78, 1.0), h3(ci + 11.0));
            vec3 gal = normalize(vec3(0.3, 0.6, -0.74));
            float band = exp(-abs(dot(d, gal)) * 7.0) * (0.4 + 0.6 * fbm(d * 6.0));
            col += (sc * star + vec3(0.05, 0.05, 0.07) * band) * night * smoothstep(0.0, 0.25, d.y) * (1.0 - uCloud * 0.8);
            // moon
            float md = dot(d, normalize(uMoon));
            float disc = smoothstep(0.99955, 0.9997, md);
            vec3 mcol = vec3(0.95, 0.93, 0.88) * (0.75 + 0.25 * fbm(d * 220.0));
            col += mcol * disc * 2.4 * night + vec3(0.25, 0.28, 0.35) * smoothstep(0.985, 1.0, md) * 0.25 * night;
          }
          // clouds (2 layers), lit by sun/moon by day and by the orange city glow at night
          if (d.y > -0.05) {
            vec3 cp = d / max(d.y + 0.08, 0.06);
            float c = fbm(cp * 0.9 + vec3(uTime * 0.012, 0.0, uTime * 0.004));
            float cov = smoothstep(0.62 - uCloud * 0.35, 0.92, c);
            vec3 cDay = mix(vec3(0.95), vec3(0.55, 0.58, 0.62), uRain);
            vec3 cNight = vec3(0.12, 0.07, 0.05) * uGlow * (0.5 + 1.2 * hor2) + vec3(0.02, 0.022, 0.03);
            vec3 cc = mix(cNight, cDay * (0.6 + 0.4 * c), day);
            col = mix(col, cc, cov * smoothstep(-0.05, 0.15, d.y));
          }
          // city glow on the horizon at night + rain haze
          col += vec3(0.32, 0.14, 0.05) * uGlow * night * hor2 * hor2 * 0.6;
          col = mix(col, mix(vec3(0.03, 0.035, 0.04), vec3(0.45, 0.48, 0.52), day), uRain * 0.6 * hor);
          if (d.y < 0.0) col *= 0.6;
          gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -10;
  }
  // hours: 0..24
  setTime(hours, dayOfYear = 300) {
    const a = (hours / 24) * Math.PI * 2 - Math.PI / 2;
    const tilt = 0.55;
    this.u.uSun.value.set(Math.cos(a) * 0.6, Math.sin(a) * Math.cos(tilt), Math.cos(a) * 0.4 + 0.3).normalize();
    this.u.uMoon.value.copy(this.u.uSun.value).multiplyScalar(-1).add(new THREE.Vector3(0.2, 0.35, 0.1)).normalize();
    if (this.u.uMoon.value.y < 0.15) this.u.uMoon.value.y = 0.15 + (0.15 - this.u.uMoon.value.y) * 0.3;
  }
  get dayAmount() { const h = this.u.uSun.value.y; return Math.min(1, Math.max(0, (h + 0.12) / 0.37)); }
}
