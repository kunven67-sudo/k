// Post-processing: gravitational lensing around black holes, and the final
// camera look (filmic tone mapping, slight vignette, grain, damage flashes).
import * as THREE from 'three';

export const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAspect: { value: 1 },
    uCount: { value: 0 },
    uLens: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
    uGlow: { value: [0, 0, 0, 0] },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAspect;
    uniform int uCount;
    uniform vec4 uLens[4];   // xy: screen uv, z: Einstein radius, w: shadow radius (in screen-height units)
    uniform float uGlow[4];  // how brightly hot gas lights up the photon ring
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      vec2 src = uv;
      float shadow = 1.0;
      float ring = 0.0;
      vec3 ringGlow = vec3(0.0);
      for (int i = 0; i < 4; i++) {
        if (i >= uCount) break;
        vec4 L = uLens[i];
        vec2 d = (uv - L.xy) * vec2(uAspect, 1.0);
        float r = length(d);
        float thE = L.z;
        // point-mass lens: light from behind is bent outward by thetaE^2 / r
        float defl = thE * thE / max(r, 1e-5);
        vec2 dir = d / max(r, 1e-5);
        src -= dir * defl / vec2(uAspect, 1.0);
        shadow *= smoothstep(L.w * 0.97, L.w * 1.02, r);
        float rg = exp(-pow((r - L.w * 1.04) / (L.w * 0.035), 2.0));
        ring += rg * 0.6;
        // light that has looped around the hole: a thin glowing ring (as in the EHT images)
        float ang = atan(d.y, d.x);
        ringGlow += vec3(1.0, 0.72, 0.42) * rg * uGlow[i] * (0.55 + 0.45 * sin(ang + 0.6));
      }
      // light bent in from off-screen: clamp to the edge and fade
      vec2 off = max(abs(src - 0.5) - 0.5, 0.0);
      vec2 s = clamp(src, 0.001, 0.999);
      vec3 base = texture2D(tDiffuse, s).rgb * (1.0 - clamp(length(off) * 4.0, 0.0, 0.85));
      // the photon ring: light that orbited the hole before escaping
      vec3 col = base * shadow * (1.0 + ring * 0.6) + ringGlow;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// Keeps extreme HDR values (and any NaN) from smearing the bloom into blocks
export const ClampShader = {
  uniforms: { tDiffuse: { value: null }, uMax: { value: 8 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uMax;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // drop broken pixels (NaN, or overflowed half-floats) so bloom can't smear them
      if (any(isnan(c)) || any(isinf(c)) || max(c.r, max(c.g, c.b)) > 6.0e4) c = vec3(0.0);
      c = max(c, vec3(0.0));
      float m = max(c.r, max(c.g, c.b));
      // soft-knee compression above uMax keeps colour ratios
      if (m > uMax) c *= (uMax + log(1.0 + m - uMax)) / m;
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uDamage: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.025 },
    uAberration: { value: 0.0012 },
    uSaturation: { value: 1.0 },
    uVision: { value: 0 },
    uTexel: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uDamage;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uSaturation;
    uniform int uVision;
    uniform vec2 uTexel;
    varying vec2 vUv;

    // false-colour palettes for the invisible kinds of light
    vec3 thermal(float t) {
      vec3 a = vec3(0.0), b = vec3(0.32, 0.02, 0.45), c = vec3(0.95, 0.35, 0.05), d = vec3(1.0, 0.95, 0.75);
      return t < 0.33 ? mix(a, b, t / 0.33) : t < 0.7 ? mix(b, c, (t - 0.33) / 0.37) : mix(c, d, (t - 0.7) / 0.3);
    }
    vec3 xray(float t) {
      vec3 a = vec3(0.0), b = vec3(0.1, 0.05, 0.45), c = vec3(0.35, 0.75, 1.0), d = vec3(1.0);
      return t < 0.4 ? mix(a, b, t / 0.4) : t < 0.8 ? mix(b, c, (t - 0.4) / 0.4) : mix(c, d, (t - 0.8) / 0.2);
    }
    vec3 radio(float t) {
      vec3 a = vec3(0.0), b = vec3(0.45, 0.05, 0.05), c = vec3(1.0, 0.55, 0.1), d = vec3(1.0, 1.0, 0.6);
      return t < 0.35 ? mix(a, b, t / 0.35) : t < 0.75 ? mix(b, c, (t - 0.35) / 0.4) : mix(c, d, (t - 0.75) / 0.25);
    }

    // ACES filmic (Narkowicz fit)
    vec3 aces(vec3 x) {
      const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 3.1) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      vec2 cc = uv - 0.5;
      float r2 = dot(cc, cc);
      // slight lens colour fringing toward the edges
      vec2 off = cc * r2 * uAberration * 8.0 * (1.0 + uDamage * 4.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      col += uFlashColor * uFlash;
      if (uVision == 1) {
        // infrared: warm things glow, dust turns see-through
        float heat = dot(col, vec3(0.62, 0.28, 0.1));
        col = thermal(1.0 - exp(-heat * 2.2));
      } else if (uVision == 2) {
        // X-rays: only the very hottest things show: star coronae, neutron stars, black-hole disks
        float l = dot(col, vec3(0.1, 0.3, 0.6));
        col = xray(smoothstep(1.2, 7.0, l));
      } else if (uVision == 3) {
        // radio: broad, blurry glows
        vec3 acc = vec3(0.0);
        for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) acc += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * uTexel * 6.0).rgb;
        acc /= 25.0;
        float r = dot(acc, vec3(0.4, 0.35, 0.25));
        col = radio(1.0 - exp(-r * 3.0));
      } else {
        col = aces(col);
      }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      // damage: red pulse around the edges
      float edge = smoothstep(0.12, 0.5, r2 * 2.0);
      col = mix(col, col * vec3(1.0, 0.25, 0.2) + vec3(0.25, 0.0, 0.0) * edge, uDamage * edge);
      col *= 1.0 - uVignette * smoothstep(0.08, 0.6, r2 * 1.6);
      col = toSRGB(col);
      col += (rnd(uv * 1000.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
