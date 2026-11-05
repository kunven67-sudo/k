// Shader effects for the sci-fi parts: rocket flame, beams, force-field bubble, portal surface, black hole.
import * as THREE from 'three';

export const fxTime = { value: 0 };
const NOISE = `
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }
`;

// rocket / jet flame: a cone whose tip flickers; vUv.y = 0 at the nozzle, 1 at the tip
export function flameMaterial(color = new THREE.Color(1, 0.55, 0.2), core = new THREE.Color(0.75, 0.85, 1)) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fxTime, uPower: { value: 0 }, uColor: { value: color }, uCore: { value: core } },
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uTime, uPower; uniform vec3 uColor, uCore; varying vec2 vUv; varying vec3 vP;
      void main(){
        float y = 1.0 - vUv.y;
        float n = fbm(vec3(vP.x * 6.0, vP.y * 3.0 - uTime * 14.0, vP.z * 6.0));
        float body = smoothstep(1.0, 0.0, y + n * 0.35) * uPower;
        float coreA = smoothstep(0.45, 0.0, y) * uPower;
        vec3 c = mix(uColor, uCore, coreA) * (1.5 + 2.5 * coreA);
        float a = clamp(body * (0.55 + 0.45 * n), 0.0, 1.0);
        if (a < 0.01) discard;
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}

// beams (tractor beam, laser): soft glowing tube, brighter in the middle
export function beamMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fxTime, uColor: { value: new THREE.Color(color) }, uPower: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN, vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uPower; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN, vV;
      void main(){
        float edge = abs(dot(vN, vV));
        float rings = 0.75 + 0.25 * sin(vUv.y * 60.0 - uTime * 12.0);
        float a = pow(edge, 1.6) * rings * uPower;
        gl_FragColor = vec4(uColor * (1.2 + edge) * a, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}

// force field / slow field bubble: see-through in the middle, glowing at the edges, with moving hex-ish ripples
export function bubbleMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fxTime, uColor: { value: new THREE.Color(color) }, uPower: { value: 1 }, uHit: { value: 0 } },
    vertexShader: `varying vec3 vN, vV, vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `${NOISE}
      uniform float uTime, uPower, uHit; uniform vec3 uColor; varying vec3 vN, vV, vP;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float fres = f * f * f;
        float n = fbm(normalize(vP) * 5.0 + vec3(0.0, uTime * 0.4, 0.0));
        float lines = smoothstep(0.47, 0.5, abs(fract(n * 6.0) - 0.5));
        float a = (fres * 0.9 + lines * 0.12 + 0.03 + uHit * 0.25) * uPower;
        gl_FragColor = vec4(uColor * a * 1.6, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}

// portal surface: swirling light, fully lit at the rim
export function portalMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fxTime, uColor: { value: new THREE.Color(color) }, uPower: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uTime, uPower; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
        float ang = atan(p.y, p.x);
        float sw = fbm(vec3(cos(ang + r * 6.0 - uTime * 2.0) * 2.0, sin(ang + r * 6.0 - uTime * 2.0) * 2.0, r * 3.0 - uTime * 0.5));
        float rim = smoothstep(0.75, 1.0, r);
        vec3 c = mix(uColor * 0.25, uColor * 2.2, sw * 0.8 + rim);
        float a = (0.7 + 0.3 * sw) * uPower;
        gl_FragColor = vec4(c * a + vec3(1.0) * pow(1.0 - r, 6.0) * 0.6 * uPower, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
}

// black hole: the sphere bends the sky behind it (real lensing of the sky photo) and goes pure black in the middle
export function blackHoleMaterial(envTex) {
  return new THREE.ShaderMaterial({
    uniforms: { uEnv: { value: envTex }, uPower: { value: 0 }, uTime: fxTime },
    vertexShader: `varying vec3 vW, vC; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vC = (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uEnv; uniform float uPower, uTime; varying vec3 vW, vC;
      #define PI 3.14159265
      vec2 eq(vec3 d){ return vec2(atan(d.z, d.x) / (2.0 * PI) + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5); }
      void main(){
        vec3 ro = cameraPosition, rd = normalize(vW - cameraPosition);
        vec3 oc = vC - ro; float t = dot(oc, rd); vec3 closest = ro + rd * t;
        float rad = length(vW - vC);           // this sphere's radius in the world
        float b = length(closest - vC) / rad;  // 0 = straight at the hole, 1 = grazing the edge
        float hz = 0.33 * uPower;              // event horizon (pure black)
        if (b < hz) { gl_FragColor = vec4(0.0, 0.0, 0.0, uPower); return; }
        vec3 toC = normalize(vC - closest);
        float bend = uPower * 0.55 * pow(hz / b, 1.4);
        vec3 d = normalize(rd + toC * bend);
        vec3 sky = texture2D(uEnv, eq(d)).rgb;
        float ring = smoothstep(0.06, 0.0, abs(b - hz * 1.18)) * uPower;   // thin bright photon ring
        float fade = smoothstep(1.0, 0.65, b);
        vec3 col = sky + vec3(1.0, 0.85, 0.6) * ring * 1.5;
        gl_FragColor = vec4(col, fade * uPower);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false
  });
}

// glowing accretion disk around the black hole
export function diskMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: fxTime, uPower: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${NOISE}
      uniform float uTime, uPower; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0; float r = length(p);
        if (r > 1.0 || r < 0.38) discard;
        float ang = atan(p.y, p.x);
        float n = fbm(vec3(cos(ang - uTime * (1.6 / r)) * 3.0 * r, sin(ang - uTime * (1.6 / r)) * 3.0 * r, r * 8.0));
        float glow = smoothstep(1.0, 0.4, r) * smoothstep(0.38, 0.48, r);
        vec3 hot = mix(vec3(1.0, 0.35, 0.08), vec3(1.0, 0.92, 0.75), smoothstep(0.9, 0.42, r));
        float a = glow * (0.45 + 0.75 * n) * uPower;
        gl_FragColor = vec4(hot * a * 2.4, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}

// soft round glow sprite (light bulbs, explosions)
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
