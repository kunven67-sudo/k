// Renderer, camera, the sky (real HDR photos), sun + shadows, light pool and graphics quality.
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { assetURL, track } from './assets.js';

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.domElement.id = 'view';

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 600);
// The rig moves the player around; the camera sits inside it (in VR the headset moves the camera inside the rig).
export const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);

/* ---------- sun ---------- */
export const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.shadow.radius = 2;
sun.castShadow = true;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sunDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize();
export function sunDirection() { return sunDir; }

/* ---------- skies ---------- */
const SKIES = {
  // the room's light comes from a real indoor HDR photo; the window shows a real sky photo; the sun shines in from outside
  // the shadow light comes from above (like the ceiling lights): everything on the counters gets a real shadow under it
  day: { hdr: 'room', bg: 'day', sun: 2.2, env: 0.8, exposure: 1.0, sunColor: 0xfff3e6, sunDir: [0.16, 0.95, 0.26] }
};
const skyCache = {};
const pmrem = new THREE.PMREMGenerator(renderer);
let currentSky = null;
export function skyName() { return currentSky; }

function brightestDirection(tex) {
  // the sun (or moon) is the brightest spot in the HDR photo: aim the real light from there
  const { data, width, height } = tex.image;
  const stride = data.length / (width * height);
  let best = -1, bi = 0;
  for (let y = 0; y < height / 2; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * stride;
      const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
      if (l > best) { best = l; bi = y * width + x; }
    }
  }
  const px = bi % width, py = Math.floor(bi / width);
  const u = (px + 0.5) / width, v = 1 - (py + 0.5) / height; // flipY: row 0 = top of the picture
  const lat = (v - 0.5) * Math.PI, lon = (u - 0.5) * 2 * Math.PI;
  return new THREE.Vector3(Math.cos(lon) * Math.cos(lat), Math.sin(lat), Math.sin(lon) * Math.cos(lat)).normalize();
}

function horizonColor(img) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, 256, 128);
  const d = g.getImageData(0, 62, 256, 3).data;
  let r = 0, gg = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4;
  return new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

function loadSky(name) {
  if (skyCache[name]) return skyCache[name];
  const cfg = SKIES[name];
  const hdr = new HDRLoader().setDataType(THREE.FloatType).loadAsync(assetURL('sky/' + cfg.hdr + '.hdr'));
  const bg = new THREE.TextureLoader().loadAsync(assetURL('sky/' + cfg.bg + '.jpg'));
  skyCache[name] = Promise.all([hdr, bg]).then(([h, b]) => {
    h.mapping = THREE.EquirectangularReflectionMapping;
    const dir = brightestDirection(h);
    const env = pmrem.fromEquirectangular(h).texture;
    h.dispose();
    b.mapping = THREE.EquirectangularReflectionMapping;
    b.colorSpace = THREE.SRGBColorSpace;
    b.generateMipmaps = false;
    b.minFilter = THREE.LinearFilter;
    return { env, bg: b, dir, horizon: horizonColor(b.image) };
  });
  return track(skyCache[name], 3);
}

export async function setSky(name) {
  const s = await loadSky(name);
  const cfg = SKIES[name];
  currentSky = name;
  scene.background = s.bg;
  scene.environment = s.env;
  scene.environmentIntensity = cfg.env;
  envBase = cfg.env;
  if (cfg.sunDir) sunDir.set(...cfg.sunDir).normalize(); else sunDir.copy(s.dir);
  sun.color.set(cfg.sunColor);
  sun.intensity = cfg.sun;
  renderer.toneMappingExposure = cfg.exposure;
  scene.fog = null;
  skyListeners.forEach((f) => f(name));
}
const skyListeners = [];
export function onSky(f) { skyListeners.push(f); }
export function preloadSkies() { return Promise.all(Object.keys(SKIES).map(loadSky)); }

/* ---------- a fixed pool of point lights (changing the number of lights would make every material recompile) ---------- */
const POOL = [];
export function initLightPool(n) {
  for (const l of POOL) scene.remove(l);
  POOL.length = 0;
  for (let i = 0; i < n; i++) {
    const l = new THREE.PointLight(0xffffff, 0, 12, 2);
    l.castShadow = false;
    scene.add(l);
    POOL.push(l);
  }
}
// three.js measures lamp distances in camera space: in VR the camera rig is scaled to your size (x10 at normal size,
// x0.1 when you are tiny), which would make lamps 100x too bright. viewScale undoes that for every point light.
let viewScale = 1;
const FIXED = [];
export function addFixedLight(l) { l.userData.base = { i: l.intensity, d: l.distance }; FIXED.push(l); scene.add(l); return l; }
let envBase = 0.8;
export function setViewScale(k) {
  viewScale = k;
  // Quest: the two lamp lights are the priciest thing per pixel (x2 eyes): in VR the room light covers for them
  const xr = renderer.xr.isPresenting;
  for (const l of FIXED) { l.visible = !xr; l.intensity = l.userData.base.i / (k * k); l.distance = l.userData.base.d / k; }
  scene.environmentIntensity = envBase + (xr ? 0.18 : 0);
}
// wants: [{ pos, color, intensity, range }] -> the nearest ones get real lights, the rest only glow
const _cam = new THREE.Vector3();
export function assignLights(wants) {
  camera.getWorldPosition(_cam);
  wants.sort((a, b) => a.pos.distanceToSquared(_cam) - b.pos.distanceToSquared(_cam));
  const k = viewScale;
  for (let i = 0; i < POOL.length; i++) {
    const l = POOL[i], w = wants[i];
    if (w) { l.position.copy(w.pos); l.color.copy(w.color); l.intensity = w.intensity / (k * k); l.distance = w.range / k; }
    else l.intensity = 0;
  }
}

/* ---------- graphics quality ---------- */
export const QUALITY = {
  low: { ratio: 0.75, shadow: 1024, span: 24, shadows: true, lights: 2, aniso: 2, far: 600 },
  medium: { ratio: 1, shadow: 2048, span: 30, shadows: true, lights: 5, aniso: 4, far: 600 },
  high: { ratio: 1.25, shadow: 2048, span: 36, shadows: true, lights: 7, aniso: 8, far: 600 },
  ultra: { ratio: 2, shadow: 4096, span: 40, shadows: true, lights: 10, aniso: 16, far: 600 }
};
const ORDER = ['low', 'medium', 'high', 'ultra'];
let qName = 'medium';
let autoMode = true;
export function quality() { return qName; }
export function isAuto() { return autoMode; }
export function setQuality(name, auto = false) {
  autoMode = auto;
  qName = name;
  const q = QUALITY[name];
  const xr = renderer.xr.isPresenting;
  if (!xr) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
  if (sun.shadow.mapSize.x !== q.shadow) {
    sun.shadow.mapSize.set(q.shadow, q.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  const s = q.span;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 400 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.castShadow = q.shadows;
  camera.far = q.far;
  camera.updateProjectionMatrix();
  if (POOL.length !== q.lights) initLightPool(q.lights);
  qualityListeners.forEach((f) => f(q));
}
const qualityListeners = [];
export function onQuality(f) { qualityListeners.push(f); }
export function qualitySettings() { return QUALITY[qName]; }

// Auto: watch the real frame rate and step down when it drops, step back up when there is lots of room.
let fpsT = 0, fpsN = 0, goodFor = 0, badFor = 0, xrBad = 0;
export let fps = 60;
export function autoQualityTick(dt) {
  fpsT += dt; fpsN++;
  if (fpsT < 1) return;
  fps = fpsN / fpsT;
  fpsT = 0; fpsN = 0;
  // Quest: if the headset can't keep up for a few seconds, drop the shadows (the most expensive part), never lag
  if (renderer.xr.isPresenting) {
    if (fps < 62) xrBad++; else xrBad = 0;
    if (xrBad >= 4 && sun.castShadow) { sun.castShadow = false; xrBad = 0; }
    return;
  }
  if (!autoMode || document.hidden) return;
  const i = ORDER.indexOf(qName);
  if (fps < 48) { badFor++; goodFor = 0; } else if (fps > 58) { goodFor++; badFor = 0; } else { goodFor = 0; badFor = 0; }
  if (badFor >= 3 && i > 0) { setQuality(ORDER[i - 1], true); badFor = 0; }
  // auto never goes past High by itself: Ultra is your call
  if (goodFor >= 12 && i < 2) { setQuality(ORDER[i + 1], true); goodFor = 0; }
}

/* shadows follow the player so they stay sharp near you */
const _p = new THREE.Vector3();
// scale = how big you are (1 = normal): when you shrink, the shadows shrink around you so tiny things get sharp shadows
let spanNow = 0;
export function updateSun(focus, scale = 1) {
  const q = QUALITY[qName];
  const span = Math.max(0.6, Math.min(q.span, q.span * scale * 1.2));
  if (Math.abs(span - spanNow) > spanNow * 0.08) {
    spanNow = span;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 400 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 0.03 * span / q.span + 0.002;
  }
  const snap = span / 12; // move in steps so shadow edges do not shimmer
  _p.set(Math.round(focus.x / snap) * snap, Math.round(focus.y / snap) * snap, Math.round(focus.z / snap) * snap);
  sun.target.position.copy(_p);
  sun.position.copy(_p).addScaledVector(sunDir, 150);
}

export function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
