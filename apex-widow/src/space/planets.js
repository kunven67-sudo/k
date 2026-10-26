// Real planets, moons, the Sun and the sky of stars. Textures: Solar System Scope (CC BY 4.0).
// Every builder works in any unit: you pass the radius in the zone's units.
// Shaders are written for Windows GPUs too (no pow() of negatives, smoothstep edges always low -> high).
import * as THREE from 'three';
import { texture } from '../core/assets.js';

const tex = (n, srgb = true) => texture('space/' + n + '.webp', { srgb, aniso: 8 });

// tiny GLSL noise shared by the planet shaders (positions on a unit sphere)
const NOISE = /* glsl */`
float pnH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float pnN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pnH(i), pnH(i + vec3(1,0,0)), f.x), mix(pnH(i + vec3(0,1,0)), pnH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(pnH(i + vec3(0,0,1)), pnH(i + vec3(1,0,1)), f.x), mix(pnH(i + vec3(0,1,1)), pnH(i + vec3(1,1,1)), f.x), f.y), f.z); }
float pnF(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * pnN(p); p *= 2.07; a *= 0.5; } return s; }`;

const BUMP = /* glsl */`
vec3 earthBump(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = normalize(dFdx(surf_pos)); vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`;

// ------------------------------------------------------------------ Earth
// Day map + night city lights + shiny oceans + clouds + cloud shadows + blue atmosphere at the edge.
// Close up (when you're 10 km long and the planet is 12,742 km wide) extra noise detail keeps the ground sharp
// and the night side gets real-looking clusters of street lights.
export async function makeEarth(R, { segments = 128, detail = true, cloudH = 0.006, atmoH = 0.045 } = {}) {
  const [day, night, spec, nrm, clouds] = await Promise.all([tex('earth_day'), tex('earth_night'), tex('earth_spec', false), tex('earth_nrm', false), tex('earth_clouds', false)]);
  const group = new THREE.Group(); group.name = 'earth';
  const uni = { uSun: { value: new THREE.Vector3(1, 0, 0) }, tNight: { value: night }, tSpec: { value: spec }, tClouds: { value: clouds }, uCloudRot: { value: 0 }, uR: { value: R }, uDetail: { value: detail ? 1 : 0 }, uCamDist: { value: R * 3 }, uC: { value: new THREE.Vector3() }, uAtmo: { value: atmoH } };
  const mat = new THREE.MeshStandardMaterial({ map: day, normalMap: nrm, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.85, metalness: 0, envMapIntensity: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = 'varying vec3 vEN; varying vec3 vEP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vEN = normalize(mat3(modelMatrix) * normal); vEP = position;');
    sh.fragmentShader = 'varying vec3 vEN; varying vec3 vEP; uniform vec3 uSun; uniform sampler2D tNight; uniform sampler2D tSpec; uniform sampler2D tClouds; uniform float uCloudRot; uniform float uR; uniform float uDetail; uniform float uCamDist; uniform vec3 uC; uniform float uAtmo;\n' + NOISE + BUMP + '\n' +
      sh.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float eCl = texture2D(tClouds, vec2(fract(vMapUv.x + uCloudRot), vMapUv.y)).g;
          vec3 eDir = normalize(vEP);
          // detail: a few octaves of noise sized to how close the camera is (none from far away)
          float near = uDetail * (1.0 - smoothstep(0.02, 0.6, uCamDist / uR));
          // (each layer of noise fades out where it gets smaller than a pixel, or it shimmers)
          float eFw = length(fwidth(eDir));
          float eA1 = 1.0 - smoothstep(0.12, 0.5, eFw * 900.0 * 8.0), eA2 = 1.0 - smoothstep(0.12, 0.5, eFw * 7000.0 * 8.0);
          if (near > 0.001) {
            float f1 = mix(0.5, pnF(eDir * 900.0), eA1), f2 = mix(0.5, pnF(eDir * 7000.0), eA2);
            float land = 1.0 - texture2D(tSpec, vMapUv).g;
            diffuseColor.rgb *= mix(1.0, 0.72 + 0.5 * f1 * (0.6 + 0.8 * f2), near * land);
            diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 1.0, 1.06), near * (1.0 - land) * f2);
          }
          diffuseColor.rgb *= 1.0 - 0.45 * eCl;`)
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(0.92, 0.38, texture2D(tSpec, vMapUv).g);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          // close up: hills + ridges from noise (bump from screen-space derivatives, works on any size of planet)
          float nearB = uDetail * (1.0 - smoothstep(0.01, 0.25, uCamDist / uR));
          if (nearB > 0.001) {
            vec3 bD = normalize(vEP);
            float bFw = length(fwidth(bD));
            float bA1 = 1.0 - smoothstep(0.1, 0.45, bFw * 1300.0 * 8.0), bA2 = 1.0 - smoothstep(0.1, 0.45, bFw * 9000.0 * 8.0);
            float bH = pnF(bD * 1300.0) * 0.65 * bA1 + pnF(bD * 9000.0) * 0.35 * bA2;
            float bLand = 1.0 - texture2D(tSpec, vMapUv).g;
            normal = earthBump(-vViewPosition, normal, vec2(dFdx(bH), dFdy(bH)) * 2.6 * nearB * bLand, faceDirection);
          }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float eNdl = dot(normalize(vEN), normalize(uSun));
          float eDark = 1.0 - smoothstep(-0.22, 0.06, eNdl);
          vec3 eLights = texture2D(tNight, vMapUv).rgb;
          eLights = mix(eLights, smoothstep(vec3(0.18), vec3(0.95), eLights), uDetail * (1.0 - smoothstep(0.02, 0.4, uCamDist / uR))); // close up: no blurry halos
          float nearL = uDetail * (1.0 - smoothstep(0.02, 0.4, uCamDist / uR));
          // close up the night map is a blur (10 km per pixel), so: much dimmer, broken into clusters + points of light
          if (nearL > 0.001) {
            vec3 lD = normalize(vEP); float lFw = length(fwidth(lD));
            float lA = 1.0 - smoothstep(0.12, 0.5, lFw * 5200.0 * 8.0), lB = 1.0 - smoothstep(0.12, 0.5, lFw * 26000.0 * 8.0);
            float c = pnF(lD * 5200.0), c2 = pnN(lD * 26000.0);
            float pts = mix(1.0, smoothstep(0.62, 0.8, c2) * 3.0, lB);
            eLights *= mix(1.0, 0.28, nearL) * mix(1.0, (0.1 + 1.6 * smoothstep(0.5, 0.78, c)) * pts, nearL * lA);
          }
          totalEmissiveRadiance += eLights * eLights * vec3(1.0, 0.82, 0.55) * 5.0 * eDark * (1.0 - 0.75 * eCl);`)
        .replace('#include <opaque_fragment>', `
          // aerial perspective: haze = how much air is between the camera and this bit of ground
          // (works from orbit, where only the rim is hazy, and standing on it, where the far ground fades into blue)
          vec3 hRo = cameraPosition - uC; vec3 hRd = vWorldPosition0 - cameraPosition; float hDist = length(hRd); hRd /= max(hDist, 1e-6);
          float hRa = uR * (1.0 + uAtmo);
          float hB = dot(hRo, hRd); float hC = dot(hRo, hRo) - hRa * hRa; float hDisc = hB * hB - hC;
          float hIn = 0.0;
          if (hC > 0.0) hIn = hDisc > 0.0 ? max(0.0, -hB - sqrt(max(hDisc, 0.0))) : hDist;
          float hSeg = max(0.0, hDist - hIn);
          float haze = 1.0 - exp(-hSeg / (uR * 0.24));
          float eLit = clamp(eNdl * 0.8 + 0.35, 0.0, 1.0);
          float dusk = 1.0 - smoothstep(0.0, 0.32, abs(eNdl));
          vec3 hCol = mix(vec3(0.34, 0.56, 1.0), vec3(1.0, 0.55, 0.32), dusk * 0.6) * 1.25;
          outgoingLight = mix(outgoingLight, hCol * eLit, haze * (0.45 + 0.4 * eLit));
          #include <opaque_fragment>`);
    // world position for the rim (three only exposes it with some features on)
    sh.vertexShader = 'varying vec3 vWorldPosition0;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWorldPosition0 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWorldPosition0;\n' + sh.fragmentShader;
  };
  mat.customProgramCacheKey = () => 'earth-v2';
  const surface = new THREE.Mesh(new THREE.SphereGeometry(R, segments, segments / 2), mat);
  surface.receiveShadow = true; surface.castShadow = false;
  group.add(surface);
  // clouds: a thin shell a bit above the ground, lit by the sun, dark at night
  const cmat = new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: clouds, transparent: true, depthWrite: false, roughness: 1, metalness: 0, envMapIntensity: 0 });
  cmat.onBeforeCompile = (sh) => {
    sh.uniforms.uR = uni.uR; sh.uniforms.uDetail = uni.uDetail; sh.uniforms.uCamDist = uni.uCamDist;
    sh.vertexShader = 'varying vec3 vCP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vCP = position;');
    sh.fragmentShader = 'varying vec3 vCP; uniform float uR; uniform float uDetail; uniform float uCamDist;\n' + NOISE + '\n' + sh.fragmentShader.replace('#include <alphamap_fragment>', `#include <alphamap_fragment>
      float cNear = uDetail * (1.0 - smoothstep(0.01, 0.3, uCamDist / uR));
      if (cNear > 0.001) {
        vec3 cD = normalize(vCP);
        float cFw = length(fwidth(cD));
        float puff = mix(0.5, pnF(cD * 2200.0), 1.0 - smoothstep(0.12, 0.5, cFw * 2200.0 * 8.0)) * 0.6 + mix(0.5, pnF(cD * 11000.0), 1.0 - smoothstep(0.12, 0.5, cFw * 11000.0 * 8.0)) * 0.4;
        float a0 = diffuseColor.a;
        // thin cloud -> broken puffs, thick cloud stays solid
        float a1 = smoothstep(0.62 - a0 * 0.55, 0.9 - a0 * 0.45, puff + a0 * 0.35);
        diffuseColor.a = mix(a0, a0 * a1 * 1.25, cNear);
        diffuseColor.rgb *= mix(1.0, 0.82 + 0.25 * puff, cNear);
      }`);
  };
  cmat.customProgramCacheKey = () => 'earth-clouds-v1';
  const cl = new THREE.Mesh(new THREE.SphereGeometry(R * (1 + cloudH), segments, segments / 2), cmat);
  cl.receiveShadow = true; group.add(cl);
  const atmo = makeAtmosphere(R, R * (1 + atmoH), new THREE.Color(0.3, 0.56, 1.0), 1.4);
  group.add(atmo.mesh);
  return {
    group, surface, clouds: cl, atmo, uni, R,
    update(dt, sunDirWorld, camPos) {
      uni.uSun.value.copy(sunDirWorld);
      atmo.uni.uSun.value.copy(sunDirWorld);
      cl.rotation.y += dt * 0.004;
      uni.uCloudRot.value = -cl.rotation.y / (Math.PI * 2) + surface.rotation.y / (Math.PI * 2);
      if (camPos) {
        const w = new THREE.Vector3(), sc = new THREE.Vector3(); group.getWorldPosition(w); group.getWorldScale(sc);
        uni.uR.value = R * sc.x; uni.uCamDist.value = Math.max(0, camPos.distanceTo(w) - R * sc.x); uni.uC.value.copy(w);
      }
    },
  };
}

// glow shell around a planet (drawn from the inside so it rims the planet), brighter on the day side
export function makeAtmosphere(R, Ra, color, power = 1) {
  const uni = { uSun: { value: new THREE.Vector3(1, 0, 0) }, uColor: { value: color.clone() }, uK: { value: Math.sqrt(Math.max(0, 1 - (R / Ra) * (R / Ra))) }, uPow: { value: power }, uRaL: { value: Ra }, uRatio: { value: R / Ra } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`varying vec3 vN; varying vec3 vW; varying vec3 vC; varying float vRa; uniform float uRaL;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vC = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vRa = length((modelMatrix * vec4(uRaL, 0.0, 0.0, 0.0)).xyz);
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`varying vec3 vN; varying vec3 vW; varying vec3 vC; varying float vRa; uniform vec3 uSun; uniform vec3 uColor; uniform float uK; uniform float uPow; uniform float uRatio;
      void main(){
        vec3 V = normalize(cameraPosition - vW); vec3 N = normalize(vN);
        float sun = clamp(dot(N, normalize(uSun)) * 0.75 + 0.45, 0.0, 1.0);
        vec3 c = mix(uColor, vec3(1.0, 0.55, 0.3), (1.0 - sun) * sun * 1.2);
        vec3 ro = cameraPosition - vC; float camR = length(ro);
        if (camR < vRa) {
          // inside the air: glow = how much air the view ray goes through (horizon = long path = bright band)
          // (where the view ray hits the planet, the planet is drawn in front of this, so no test needed)
          float tExit = length(vW - cameraPosition);
          float thick = max(vRa - vRa * uRatio, 1e-6);
          float a = 1.0 - exp(-tExit / thick * 0.13);
          a *= a;
          vec3 sc = mix(c, vec3(0.62, 0.8, 1.0), a * 0.35);
          gl_FragColor = vec4(sc * a * sun * uPow, 1.0);
          return;
        }
        float x = clamp(-dot(N, V), 0.0, 1.0);                 // 0 at the outer edge, uK where the ray grazes the planet
        float a = smoothstep(0.0, max(uK, 0.001), x);
        gl_FragColor = vec4(c * a * a * sun * uPow, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(Ra, 64, 32), mat);
  mesh.renderOrder = 2;
  return { mesh, uni };
}

// ------------------------------------------------------------------ any other planet / moon
export const PLANET_DATA = {
  // radius in km, colour of its sky glow (null = none), ring
  mercury: { R: 2439.7, tex: 'mercury', rough: 0.95 },
  venus:   { R: 6051.8, tex: 'venus', atmo: [1.0, 0.85, 0.55], rough: 1 },
  moon:    { R: 1737.4, tex: 'moon', rough: 0.98 },
  mars:    { R: 3389.5, tex: 'mars', atmo: [1.0, 0.6, 0.4], rough: 0.95 },
  jupiter: { R: 69911, tex: 'jupiter', atmo: [0.9, 0.8, 0.65], rough: 1 },
  saturn:  { R: 58232, tex: 'saturn', atmo: [0.95, 0.85, 0.6], rough: 1, ring: [74500, 140220] },
  uranus:  { R: 25362, tex: 'uranus', atmo: [0.6, 0.9, 1.0], rough: 1 },
  neptune: { R: 24622, tex: 'neptune', atmo: [0.4, 0.6, 1.0], rough: 1 },
  ceres:   { R: 473, tex: 'ceres', rough: 1 },
  eris:    { R: 1163, tex: 'eris', rough: 1 },
  makemake:{ R: 715, tex: 'makemake', rough: 1 },
};
export async function makePlanet(name, R) {
  const d = PLANET_DATA[name];
  const map = await tex(d.tex);
  const g = new THREE.Group(); g.name = name;
  const mat = new THREE.MeshStandardMaterial({ map, roughness: d.rough, metalness: 0, envMapIntensity: 0 });
  // gas giants: soft banding moves a little (they spin fast)
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), mat);
  mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  let atmo = null;
  if (d.atmo) { atmo = makeAtmosphere(R, R * (d.R > 20000 ? 1.03 : 1.05), new THREE.Color(...d.atmo), d.R > 20000 ? 0.8 : 1.0); g.add(atmo.mesh); }
  if (d.ring) {
    const rt = await tex('saturn_ring');
    const r0 = R * d.ring[0] / d.R, r1 = R * d.ring[1] / d.R;
    const rg = new THREE.RingGeometry(r0, r1, 160, 1);
    // map the ring texture across the radius
    const pos = rg.attributes.position, uv = rg.attributes.uv;
    for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - r0) / (r1 - r0), 0.5); }
    rt.wrapS = rt.wrapT = THREE.ClampToEdgeWrapping;
    const rm = new THREE.MeshStandardMaterial({ map: rt, alphaMap: rt, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false, envMapIntensity: 0 });
    const ring = new THREE.Mesh(rg, rm); ring.rotation.x = -Math.PI / 2; ring.receiveShadow = true; ring.castShadow = true;
    g.add(ring); g.userData.ring = ring;
  }
  return { group: g, mesh, atmo, R, update(dt, sun) { mesh.rotation.y += dt * (d.R > 20000 ? 0.02 : 0.005); if (atmo) atmo.uni.uSun.value.copy(sun); } };
}

// ------------------------------------------------------------------ the Sun (or any star)
// Boiling surface (texture + moving noise), limb darkening, a corona glow sprite. Colour from temperature.
export function starColor(K) {
  // blackbody approximation (Tanner Helland), returns linear-ish RGB 0..1
  const t = K / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = (v) => Math.min(1, Math.max(0, v / 255));
  return new THREE.Color(c(r), c(g), c(b)).convertSRGBToLinear();
}
export async function makeSun(R, { K = 5772, glow = 1 } = {}) {
  const map = await tex('sun');
  const col = starColor(K);
  const uni = { tMap: { value: map }, uTime: { value: 0 }, uCol: { value: col }, uBright: { value: 28 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP; void main(){ vUv = uv; vP = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`varying vec2 vUv; varying vec3 vN; varying vec3 vW; varying vec3 vP; uniform sampler2D tMap; uniform float uTime; uniform vec3 uCol; uniform float uBright;
      ${NOISE}
      void main(){
        vec3 d = normalize(vP);
        float n = pnF(d * 9.0 + vec3(uTime * 0.03, uTime * 0.02, -uTime * 0.025));
        float g = pnN(d * 60.0 + vec3(0.0, uTime * 0.2, 0.0));
        vec3 t = texture2D(tMap, vUv).rgb;
        float mu = clamp(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0, 1.0);
        float limb = 0.35 + 0.65 * sqrt(mu);              // limb darkening
        vec3 c = uCol * (0.55 + 0.6 * dot(t, vec3(0.33)) + 0.35 * n + 0.15 * g) * limb;
        gl_FragColor = vec4(c * uBright, 1.0);
      }`,
  });
  const g = new THREE.Group(); g.name = 'sun';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), mat); g.add(mesh);
  // corona: a soft additive sprite
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,240,210,0.55)'); gr.addColorStop(0.45, 'rgba(255,190,120,0.12)'); gr.addColorStop(1, 'rgba(255,160,80,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace;
  const sm = new THREE.SpriteMaterial({ map: st, color: col.clone().multiplyScalar(6 * glow), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const corona = new THREE.Sprite(sm); corona.scale.setScalar(R * 7); g.add(corona);
  return { group: g, mesh, corona, uni, R, update(dt) { uni.uTime.value += dt; mesh.rotation.y += dt * 0.01; } };
}

// ------------------------------------------------------------------ the sky: the Milky Way photo all around
export async function makeStarSky(radius, bright = 0.55) {
  const map = await tex('milkyway');
  const mat = new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, depthWrite: false, fog: false, color: new THREE.Color(bright, bright, bright) });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), mat);
  m.renderOrder = -20; m.frustumCulled = false;
  m.onBeforeRender = (r, s, cam) => { m.position.copy(cam.position); const k = cam.far * 0.6; m.scale.setScalar(k / radius); m.updateMatrixWorld(); };
  return m;
}

// real-looking point stars (bright ones twinkle a little), drawn in a shell around the camera
export function makeStarPoints(n = 6000, radius = 1) {
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos[i * 3] = r * Math.cos(a) * radius; pos[i * 3 + 1] = u * radius; pos[i * 3 + 2] = r * Math.sin(a) * radius;
    const K = 2800 + Math.pow(Math.random(), 2.2) * 20000; const c = starColor(K);
    const m = Math.pow(Math.random(), 6) * 6 + 0.25;
    col[i * 3] = c.r * m; col[i * 3 + 1] = c.g * m; col[i * 3 + 2] = c.b * m; size[i] = 1 + Math.pow(Math.random(), 8) * 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`attribute float size; attribute vec3 color; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * 1.6; }`,
    fragmentShader: /* glsl */`varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = 1.0 - smoothstep(0.0, 0.5, r); gl_FragColor = vec4(vC * a * a, 1.0); }`,
  });
  const p = new THREE.Points(g, mat); p.frustumCulled = false; p.renderOrder = -19;
  p.onBeforeRender = (r, s, cam) => { p.position.copy(cam.position); p.scale.setScalar(cam.far * 0.5 / radius); p.updateMatrixWorld(); };
  return p;
}
