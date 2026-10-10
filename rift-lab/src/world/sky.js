// Sky: real sun + moon positions for the game date, the real phase of the moon,
// real bright stars + the Milky Way at night, moving clouds, sunlight that turns
// orange at sunset because it passes through more air (like real life).

import * as THREE from 'three';
import { Sky as SkyShader } from 'three/addons/objects/Sky.js';
import { BRIGHT_STARS, GALACTIC_POLE } from './stars.js';
import { mulberry32, smoothstep, clamp } from '../core/noise.js';
import { equatorialToWorld } from '../core/time.js';

const DEG = Math.PI / 180;
const STAR_R = 7000;
const MOON_R = 6000;

export class SkySystem {
  constructor({ renderer, scene, clock }) {
    this.renderer = renderer;
    this.scene = scene;
    this.clock = clock;
    this.group = new THREE.Group();
    this.group.name = 'sky';

    // Atmosphere
    this.sky = new SkyShader();
    this.sky.scale.setScalar(10000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.2;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.0045;
    u.mieDirectionalG.value = 0.82;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    this.nightDome = makeNightDome();
    this.group.add(this.nightDome);
    this.stars = makeStars();
    this.group.add(this.stars);
    this.moon = makeMoon();
    this.group.add(this.moon);
    this.clouds = makeClouds();
    this.scene.add(this.clouds); // world space (moves with you on x/z, pattern stays put)
    this.scene.add(this.group);

    // Lights
    this.sunLight = new THREE.DirectionalLight(0xffffff, 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(4096, 4096);
    const sc = this.sunLight.shadow.camera;
    sc.left = -90; sc.right = 90; sc.top = 90; sc.bottom = -90; sc.near = 1; sc.far = 900;
    this.sunLight.shadow.bias = -0.00025;
    this.sunLight.shadow.normalBias = 0.6;
    this.scene.add(this.sunLight, this.sunLight.target);
    this.moonLight = new THREE.DirectionalLight(0x9fb4ff, 0);
    this.scene.add(this.moonLight, this.moonLight.target);
    this.hemi = new THREE.HemisphereLight(0x9fc3ff, 0x4a4232, 0.8);
    this.scene.add(this.hemi);

    this.scene.fog = new THREE.FogExp2(0x9fb3c8, 0.00016);

    // Environment reflections (re-captured as the sun moves)
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new SkyShader();
    this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    this.envTarget = null;
    this.lastEnvSun = new THREE.Vector3(0, -2, 0);
    this.envTimer = 0;

    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.state = { sunAlt: 0, night: 0, dayLight: 1, moonIllum: 0, phase: 0 };
    this.cloudCover = 0.45;
    this.time = 0;
    this.eqToWorld = new THREE.Matrix4();
    this._m4 = new THREE.Matrix4();
    this._origin = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  update(dt, camera) {
    this.time += dt;
    const a = this.clock.sky();
    const sun = this.sunDir.set(a.sun.x, a.sun.y, a.sun.z).normalize();
    const moon = this.moonDir.set(a.moon.x, a.moon.y, a.moon.z).normalize();
    const sunAlt = Math.asin(sun.y) / DEG;
    const night = smoothstep(-2, -14, sunAlt);       // 0 day .. 1 full night
    const twilight = smoothstep(8, -6, sunAlt) * (1 - night);
    this.state.sunAlt = sunAlt;
    this.state.night = night;
    this.state.moonIllum = a.illum;
    this.state.phase = a.phase;

    // Atmosphere follows the camera
    this.group.position.copy(camera.position);
    this.sky.material.uniforms.sunPosition.value.copy(sun).multiplyScalar(1000);

    // Sunlight color: extinction through the air (more air at sunset = redder)
    const s = Math.max(sun.y, -0.05);
    const altDeg = Math.max(sunAlt, -2);
    const airmass = 1 / (Math.max(Math.sin(altDeg * DEG), 0) + 0.50572 * Math.pow(altDeg + 6.07995, -1.6364));
    const tr = [Math.exp(-0.045 * airmass) / 0.956, Math.exp(-0.10 * airmass) / 0.905, Math.exp(-0.22 * airmass) / 0.80];
    const sunUp = smoothstep(-1.5, 3, sunAlt);
    this.sunLight.color.setRGB(clamp(tr[0], 0, 1), clamp(tr[1], 0, 1), clamp(tr[2], 0, 1));
    this.sunLight.intensity = 3.4 * sunUp * (0.35 + 0.65 * smoothstep(0, 0.5, s));
    const target = camera.position;
    // Shadow camera follows you, snapped to texels so shadows don't shimmer
    const texel = 180 / 4096;
    const sx = Math.round(target.x / texel) * texel, sz = Math.round(target.z / texel) * texel;
    this.sunLight.target.position.set(sx, target.y, sz);
    this.sunLight.position.set(sx + sun.x * 400, target.y + Math.max(sun.y, 0.02) * 400, sz + sun.z * 400);
    this.sunLight.castShadow = sunUp > 0.01;

    // Moonlight (only real when the moon is up; brightness follows the phase)
    const moonUp = smoothstep(-1, 4, Math.asin(moon.y) / DEG);
    this.moonLight.intensity = 0.32 * Math.pow(a.illum, 1.5) * moonUp * night;
    this.moonLight.position.copy(target).addScaledVector(moon, 400);
    this.moonLight.target.position.copy(target);

    // Sky light (hemisphere)
    const dayCol = new THREE.Color(0x9cc0ff), duskCol = new THREE.Color(0xd08a6a), nightCol = new THREE.Color(0x1b2338);
    const skyCol = dayCol.clone().lerp(duskCol, twilight * 0.7).lerp(nightCol, night);
    this.hemi.color.copy(skyCol);
    this.hemi.groundColor.setRGB(0.29, 0.26, 0.19).lerp(new THREE.Color(0x0a0a0c), night);
    this.hemi.intensity = 0.95 * (1 - night) + 0.08 + 0.12 * a.illum * moonUp * night;
    this.state.dayLight = 1 - night;

    // Fog (haze) color matches the horizon
    const fogDay = new THREE.Color(0xa9bccf), fogDusk = new THREE.Color(0xc9967a), fogNight = new THREE.Color(0x0b0f19);
    this.scene.fog.color.copy(fogDay).lerp(fogDusk, twilight).lerp(fogNight, night);

    // Stars: rotate with the real sky (sidereal time + latitude)
    setEqToWorld(this.eqToWorld, a.lst, this.clock.latitude);
    this.stars.matrix.copy(this.eqToWorld);
    this.stars.matrixWorldNeedsUpdate = true;
    this.stars.material.uniforms.uVisible.value = night * (1 - 0.6 * this.cloudCover) * (1 - 0.35 * a.illum * moonUp);
    this.stars.material.uniforms.uTime.value = this.time;
    this.nightDome.material.uniforms.uNight.value = night;
    this.nightDome.material.uniforms.uMoonGlow.value = a.illum * moonUp;

    // Moon disc, lit by the real sun direction (so the phase looks right)
    this.moon.position.copy(moon).multiplyScalar(MOON_R);
    // face the viewer: plane normal points back along the moon direction
    this.moon.quaternion.setFromRotationMatrix(this._m4.lookAt(this._origin, moon, this._up));
    const mu = this.moon.material.uniforms;
    mu.uSunDir.value.copy(sun);
    mu.uMoonDir.value.copy(moon);
    mu.uDay.value = 1 - night;
    this.moon.visible = moon.y > -0.05;

    // Clouds drift with the wind
    const cu = this.clouds.material.uniforms;
    cu.uTime.value = this.time;
    cu.uSunDir.value.copy(sun);
    cu.uSunCol.value.copy(this.sunLight.color).multiplyScalar(0.25 + 0.75 * sunUp);
    cu.uSkyCol.value.copy(skyCol);
    cu.uCover.value = this.cloudCover;
    cu.uNight.value = night;
    cu.uCamXZ.value.set(camera.position.x, camera.position.z);

    // Re-capture reflections when the sun has moved a bit
    this.envTimer -= dt;
    if (this.envTimer <= 0 && (this.lastEnvSun.distanceTo(sun) > 0.01 || !this.envTarget)) {
      this.envTimer = 1.5;
      this.lastEnvSun.copy(sun);
      const eu = this.envSky.material.uniforms;
      for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) eu[k].value = u(this.sky)[k].value;
      eu.sunPosition.value.copy(sun).multiplyScalar(1000);
      const prev = this.envTarget;
      this.envTarget = this.pmrem.fromScene(this.envScene, 0, 0.1, 2000);
      this.scene.environment = this.envTarget.texture;
      if (prev) prev.dispose();
    }
    this.scene.environmentIntensity = 0.55 * (1 - night) + 0.06;

    // Your eyes adapt: brighter exposure at night, but night still looks like night
    const exposure = 0.62 + 1.1 * night + 0.25 * twilight;
    this.renderer.toneMappingExposure += (exposure - this.renderer.toneMappingExposure) * Math.min(1, dt * 0.8);
  }
}

function u(sky) { return sky.material.uniforms; }

// Equatorial unit vectors -> world (x east, y up, z south) for a sidereal time + latitude.
function setEqToWorld(m, lstDeg, latDeg) {
  const L = lstDeg * DEG, p = latDeg * DEG;
  const cL = Math.cos(L), sL = Math.sin(L), cp = Math.cos(p), sp = Math.sin(p);
  m.set(
    -sL, cL, 0, 0,
    cp * cL, cp * sL, sp, 0,
    sp * cL, sp * sL, -cp, 0,
    0, 0, 0, 1,
  );
  m.scale(new THREE.Vector3(STAR_R, STAR_R, STAR_R));
}

function makeStars() {
  const rand = mulberry32(777);
  const pos = [], mag = [], tint = [];
  const add = (ra, dec, m, t) => {
    pos.push(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec));
    mag.push(m);
    tint.push(t);
  };
  for (const [, raH, decD, m] of BRIGHT_STARS) add(raH * 15 * DEG, decD * DEG, m, rand());
  // Background stars, crowded toward the galactic plane (the Milky Way)
  const gp = GALACTIC_POLE;
  const pole = new THREE.Vector3(Math.cos(gp.dec) * Math.cos(gp.ra), Math.cos(gp.dec) * Math.sin(gp.ra), Math.sin(gp.dec));
  let made = 0;
  while (made < 9000) {
    const z = rand() * 2 - 1, th = rand() * Math.PI * 2, r = Math.sqrt(1 - z * z);
    const v = new THREE.Vector3(r * Math.cos(th), r * Math.sin(th), z);
    const gl = Math.abs(v.dot(pole)); // sin(galactic latitude)
    const keep = 0.18 + 0.82 * Math.exp(-gl * gl * 30);
    if (rand() > keep) continue;
    const m = 3.4 + Math.pow(rand(), 0.55) * 3.2;
    pos.push(v.x, v.y, v.z);
    mag.push(m);
    tint.push(rand());
    made++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aMag', new THREE.Float32BufferAttribute(mag, 1));
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uVisible: { value: 0 }, uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aMag; attribute float aTint;
      uniform float uTime; uniform float uPixelRatio;
      varying float vBright; varying vec3 vCol; varying float vAlt;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 dir = normalize(mat3(modelMatrix) * position);
        vAlt = dir.y;
        float b = pow(10.0, -0.4 * (aMag - 1.0));
        float tw = 0.85 + 0.15 * sin(uTime * (3.0 + aTint * 5.0) + aTint * 50.0);
        vBright = clamp(b, 0.0, 2.5) * tw;
        vCol = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), aTint);
        gl_PointSize = clamp(1.4 + 2.2 * sqrt(b), 1.0, 6.0) * uPixelRatio;
        gl_Position = projectionMatrix * viewMatrix * wp;
        gl_Position.z = gl_Position.w * 0.99999;
      }`,
    fragmentShader: `
      uniform float uVisible;
      varying float vBright; varying vec3 vCol; varying float vAlt;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        float horizon = smoothstep(-0.02, 0.12, vAlt); // dimmer through thick air near the horizon
        gl_FragColor = vec4(vCol * vBright * a, 1.0) * uVisible * horizon;
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.matrixAutoUpdate = false;
  pts.frustumCulled = false;
  pts.renderOrder = -9;
  return pts;
}

function makeNightDome() {
  const g = new THREE.SphereGeometry(8000, 32, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: { value: 0 }, uMoonGlow: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p; gl_Position.z = gl_Position.w * 0.999999; }',
    fragmentShader: `
      uniform float uNight; uniform float uMoonGlow; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 zen = vec3(0.004, 0.006, 0.014), hor = vec3(0.025, 0.035, 0.06);
        vec3 c = mix(hor, zen, pow(h, 0.5)) * (1.0 + uMoonGlow * 2.5);
        gl_FragColor = vec4(c * uNight, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

function makeMoon() {
  const radius = MOON_R * Math.tan(0.2595 * DEG) * 1.08;
  const g = new THREE.PlaneGeometry(radius * 2, radius * 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() }, uDay: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p; gl_Position.z = gl_Position.w * 0.99998; }',
    fragmentShader: `
      uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform float uDay; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r2 = dot(p, p);
        if (r2 > 1.0) discard;
        // sphere normal in a frame facing the viewer
        vec3 fwd = -normalize(uMoonDir);
        vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
        vec3 up = cross(fwd, right);
        vec3 nrm = normalize(right * p.x + up * p.y + fwd * sqrt(1.0 - r2));
        float lit = smoothstep(-0.03, 0.08, dot(nrm, normalize(uSunDir)));
        // maria (the dark "seas") + craters
        float m = n(p * 2.2 + 3.0) * 0.6 + n(p * 5.0) * 0.3 + n(p * 13.0) * 0.1;
        float albedo = mix(0.55, 0.95, smoothstep(0.35, 0.65, m));
        vec3 col = vec3(1.0, 0.97, 0.9) * albedo * lit * 1.6;
        col += vec3(0.02, 0.025, 0.035) * (1.0 - lit); // earthshine on the dark part
        float edge = smoothstep(1.0, 0.96, r2);
        float alpha = edge * mix(1.0, 0.55, uDay) * max(lit, 0.08 * (1.0 - uDay));
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = -8;
  return m;
}

function makeClouds() {
  const g = new THREE.PlaneGeometry(36000, 36000, 1, 1);
  g.rotateX(Math.PI / 2); // face down
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
      uSkyCol: { value: new THREE.Color() }, uCover: { value: 0.45 }, uNight: { value: 0 }, uCamXZ: { value: new THREE.Vector2() },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol;
      uniform float uCover; uniform float uNight; uniform vec2 uCamXZ;
      varying vec3 vWorld;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float nn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<6;i++){ s+=a*nn(p); p=mat2(1.6,1.2,-1.2,1.6)*p; a*=0.5; } return s; }
      float density(vec2 p){
        vec2 w = vec2(fbm(p * 0.6 + uTime * 0.004), fbm(p * 0.6 + 7.3 - uTime * 0.003));
        float d = fbm(p + w * 0.9 + vec2(uTime * 0.006, uTime * 0.002));
        return smoothstep(1.0 - uCover - 0.05, 1.0 - uCover + 0.35, d);
      }
      void main(){
        vec2 p = vWorld.xz / 2600.0;
        float d = density(p);
        if (d < 0.01) discard;
        // light from the sun side: sample density a little toward the sun
        float toward = density(p + normalize(uSunDir.xz + 1e-4) * 0.06);
        float light = clamp(1.0 - (toward - d) * 1.6 - d * 0.35, 0.2, 1.0);
        vec3 lit = uSunCol * 1.25 + uSkyCol * 0.45;
        vec3 shade = uSkyCol * 0.55 + vec3(0.06);
        vec3 col = mix(shade, lit, light);
        col = mix(col, vec3(0.004, 0.005, 0.009), uNight * 0.985);
        // fade toward the horizon (distance)
        float dist = length(vWorld.xz - uCamXZ);
        float fade = smoothstep(17000.0, 6000.0, dist);
        gl_FragColor = vec4(col, d * 0.92 * fade);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const m = new THREE.Mesh(g, mat);
  m.position.y = 1600;
  m.frustumCulled = false;
  m.renderOrder = -7;
  // Clouds sit in the world (not glued to the camera) but follow it on x/z so they never end
  m.onBeforeRender = (renderer, scene, camera) => { m.position.x = camera.position.x; m.position.z = camera.position.z; m.updateMatrixWorld(); };
  return m;
}
