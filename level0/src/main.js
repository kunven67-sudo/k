import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { CELL, H, CH, CHUNK, T, MAP_SIZE, MAP_PAD, hEdge, vEdge, pillar, PILLAR, light } from './gen.js';

// ---------------- settings ----------------
const store = {
  get(k, d) { try { const v = localStorage.getItem('level0.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('level0.' + k, JSON.stringify(v)); } catch {} },
};
const settings = {
  sens: store.get('sens', 1.0),
  volume: store.get('volume', 0.8),
  quality: store.get('quality', 'auto'),   // auto | low | medium | high | ultra
};
const QUALITY = {
  low: { scale: 0.6, bloom: false, radius: 1 },
  medium: { scale: 0.8, bloom: true, radius: 2 },
  high: { scale: 1.0, bloom: true, radius: 2 },
  ultra: { scale: Math.min(2, window.devicePixelRatio || 1) * 1.25, bloom: true, radius: 2 },
};

// ---------------- renderer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const FOG = new THREE.Color(0.36, 0.31, 0.16);
scene.background = FOG.clone();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 80);
scene.add(camera);

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const film = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, black: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; uniform float black; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * 0.006;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      col *= 1.0 - r2 * 0.75;
      float g = rnd(floor(vUv * res) + fract(time * 13.0) * 91.0) - 0.5;
      col += g * 0.028;
      gl_FragColor = vec4(col * (1.0 - black), 1.0);
    }`,
});
composer.addPass(film);

// ---------------- textures ----------------
const loader = new THREE.TextureLoader();
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function tex(name, srgb) {
  const t = loader.load('assets/tex/' + name);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  return t;
}
const TX = {
  carpet: tex('carpet_col.jpg', true), carpetN: tex('carpet_nrm.jpg'), stain: tex('carpet_stain.jpg'),
  ceil: tex('ceil_col.jpg', true), ceilN: tex('ceil_nrm.jpg'),
  wall: tex('wall_col.jpg', true), wallN: tex('wall_nrm.jpg'),
  panel: tex('panel_col.jpg', true),
};
TX.panel.wrapS = TX.panel.wrapT = THREE.ClampToEdgeWrapping;

// ---------------- surface shader ----------------
// kind 0 floor, 1 ceiling, 2 wall. Light comes from the chunk light map (worker-made):
// r = direct light from the fixtures (with wall shadows), g = bounced light, b = distance to the nearest wall.
const surfVS = `
  varying vec3 vW; varying vec3 vN; varying float vD;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz; vN = normal;
    vec4 mv = viewMatrix * w; vD = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const surfFS = `
  uniform sampler2D albedo; uniform sampler2D nrm; uniform sampler2D stain; uniform sampler2D lmap;
  uniform vec2 origin; uniform float mapSpan; uniform float kind; uniform float uvScale;
  uniform vec3 fogColor; uniform float fogDensity; uniform float lit;
  varying vec3 vW; varying vec3 vN; varying float vD;
  const float H = ${H.toFixed(3)};
  vec4 L(vec2 xz){ return texture2D(lmap, (xz - origin) / mapSpan); }
  void main(){
    vec3 n = normalize(vN);
    vec2 uv; vec2 sp = vW.xz;
    if (kind < 0.5) uv = vW.xz;
    else if (kind < 1.5) uv = vW.xz;
    else { uv = abs(n.x) > 0.5 ? vec2(vW.z * sign(n.x), vW.y) : vec2(-vW.x * sign(n.z), vW.y); sp = vW.xz + n.xz * 0.125; }
    uv *= uvScale;
    vec3 a = texture2D(albedo, uv).rgb;
    vec3 tn = texture2D(nrm, uv).xyz * 2.0 - 1.0;
    vec4 m = L(sp);
    float direct = m.r * 2.0, bounce = m.g * 2.0, wd = m.b;
    float shade;
    if (kind < 0.5) {
      float s = texture2D(stain, vW.xz * 0.16).r;
      float s2 = texture2D(stain, vW.xz * 0.045 + 0.37).r;
      a *= mix(1.0, 0.86, smoothstep(0.6, 0.9, s * 0.55 + s2 * 0.55));
      float bump = clamp(0.75 + 0.25 * tn.z + 0.12 * tn.y, 0.6, 1.1);
      float ao = mix(0.62, 1.0, smoothstep(0.0, 0.55, wd * 0.6));
      shade = (direct * 0.95 + bounce * 0.28 + 0.035) * ao * bump;
    } else if (kind < 1.5) {
      float ao = mix(0.55, 1.0, smoothstep(0.0, 0.5, wd * 0.6));
      float bump = clamp(0.8 + 0.2 * tn.z, 0.7, 1.05);
      shade = (bounce * 0.42 + direct * 0.12 + 0.03) * ao * bump;
    } else {
      float y = vW.y / H;
      float hf = mix(0.72, 1.0, smoothstep(0.0, 0.75, y)) * (1.0 - 0.35 * smoothstep(0.86, 1.0, y));
      float aoF = mix(0.55, 1.0, smoothstep(0.0, 0.16, vW.y));
      float aoC = mix(0.7, 1.0, smoothstep(0.0, 0.12, H - vW.y));
      float aoS = mix(0.7, 1.0, smoothstep(0.0, 0.5, wd * 0.6 + 0.12));
      float bump = clamp(0.82 + 0.18 * tn.z - 0.12 * tn.y, 0.6, 1.1);
      shade = (direct * 0.62 * hf + bounce * 0.32 + 0.035) * aoF * aoC * aoS * bump;
    }
    vec3 col = a * shade * lit * vec3(1.0, 0.97, 0.88);
    float f = 1.0 - exp(-pow(vD * fogDensity, 2.0));
    col = mix(col, fogColor, clamp(f, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
  }`;
const fogUniforms = { fogColor: { value: FOG.clone().multiplyScalar(0.55) }, fogDensity: { value: 0.026 } };
function surfMat(kind, albedo, nrm, uvScale, lmap, origin) {
  return new THREE.ShaderMaterial({
    vertexShader: surfVS, fragmentShader: surfFS,
    uniforms: {
      albedo: { value: albedo }, nrm: { value: nrm }, stain: { value: TX.stain }, lmap: { value: lmap },
      origin: { value: origin }, mapSpan: { value: CHUNK + 2 * MAP_PAD }, kind: { value: kind }, uvScale: { value: uvScale },
      lit: { value: 1.05 }, ...fogUniforms,
    },
  });
}
const panelOn = new THREE.ShaderMaterial({
  uniforms: { map: { value: TX.panel }, ...fogUniforms, glow: { value: 3.2 } },
  vertexShader: 'varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
  fragmentShader: `uniform sampler2D map; uniform vec3 fogColor; uniform float fogDensity; uniform float glow; varying vec2 vUv; varying float vD;
    void main(){ vec3 c = texture2D(map, vUv).rgb * glow * vec3(1.0, 0.96, 0.82);
      float f = 1.0 - exp(-pow(vD * fogDensity, 2.0)); gl_FragColor = vec4(mix(c, fogColor, clamp(f,0.0,1.0)), 1.0); }`,
});
const panelOff = panelOn.clone();
panelOff.uniforms = { map: { value: TX.panel }, ...fogUniforms, glow: { value: 0.32 } };

// ---------------- chunks ----------------
const worker = new Worker('worker.js', { type: 'module' });
const chunks = new Map();
let nextId = 1;
const pending = new Map();
worker.onmessage = (e) => {
  const { id, data } = e.data;
  const c = pending.get(id);
  pending.delete(id);
  if (!c || c.dead) return;
  const t = new THREE.DataTexture(data, MAP_SIZE, MAP_SIZE, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  c.lmap = t;
  for (const m of c.mats) m.uniforms.lmap.value = t;
  c.group.visible = true;
  c.ready = true;
};

function pushBox(P, N, x0, x1, z0, z1, y0, y1) {
  const quad = (a, b, c, d, n) => { P.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) N.push(...n); };
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
}

function makeChunk(cx, cz) {
  const group = new THREE.Group();
  group.visible = false;
  const origin = new THREE.Vector2(cx * CHUNK - MAP_PAD, cz * CHUNK - MAP_PAD);
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 255, 255]), 1, 1);
  blank.needsUpdate = true;
  const mFloor = surfMat(0, TX.carpet, TX.carpetN, 1 / 1.2, blank, origin);
  const mCeil = surfMat(1, TX.ceil, TX.ceilN, 1 / 3.6, blank, origin);
  const mWall = surfMat(2, TX.wall, TX.wallN, 1 / 0.8, blank, origin);
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  const plane = (y, flip) => {
    const g = new THREE.BufferGeometry();
    const p = flip
      ? [x0, y, z0, x0 + CHUNK, y, z0, x0 + CHUNK, y, z0 + CHUNK, x0, y, z0, x0 + CHUNK, y, z0 + CHUNK, x0, y, z0 + CHUNK]
      : [x0, y, z0, x0 + CHUNK, y, z0 + CHUNK, x0 + CHUNK, y, z0, x0, y, z0, x0, y, z0 + CHUNK, x0 + CHUNK, y, z0 + CHUNK];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(6).fill(0).flatMap(() => [0, flip ? -1 : 1, 0]), 3));
    return g;
  };
  group.add(new THREE.Mesh(plane(0, false), mFloor));
  group.add(new THREE.Mesh(plane(H, true), mCeil));

  // walls: merge each straight run into one box
  const P = [], N = [];
  const gx = cx * CH, gz = cz * CH;
  for (let z = gz; z < gz + CH; z++) {
    let start = null;
    for (let x = gx; x <= gx + CH; x++) {
      const w = x < gx + CH && hEdge(x, z);
      if (w && start === null) start = x;
      if (!w && start !== null) { pushBox(P, N, start * CELL - T / 2, x * CELL + T / 2, z * CELL - T / 2, z * CELL + T / 2, 0, H); start = null; }
    }
  }
  for (let x = gx; x < gx + CH; x++) {
    let start = null;
    for (let z = gz; z <= gz + CH; z++) {
      const w = z < gz + CH && vEdge(x, z);
      if (w && start === null) start = z;
      if (!w && start !== null) { pushBox(P, N, x * CELL - T / 2, x * CELL + T / 2, start * CELL - T / 2, z * CELL + T / 2, 0, H); start = null; }
    }
  }
  for (let z = gz; z < gz + CH; z++) for (let x = gx; x < gx + CH; x++) if (pillar(x, z)) {
    const s = PILLAR / 2;
    pushBox(P, N, x * CELL - s, x * CELL + s, z * CELL - s, z * CELL + s, 0, H);
  }
  if (P.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    group.add(new THREE.Mesh(g, mWall));
  }

  // light panels (0.6 x 1.2 m fixtures)
  const on = [], off = [], uvOn = [], uvOff = [];
  for (let z = gz; z < gz + CH; z++) for (let x = gx; x < gx + CH; x++) {
    const l = light(x, z); if (!l) continue;
    const px = (x + 0.5) * CELL, pz = (z + 0.5) * CELL, y = H - 0.004, hx = 0.6, hz = 0.3;
    const arr = l === 1 ? on : off, uv = l === 1 ? uvOn : uvOff;
    arr.push(px - hx, y, pz - hz, px + hx, y, pz - hz, px + hx, y, pz + hz, px - hx, y, pz - hz, px + hx, y, pz + hz, px - hx, y, pz + hz);
    uv.push(0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0);
  }
  for (const [arr, uv, mat] of [[on, uvOn, panelOn], [off, uvOff, panelOff]]) {
    if (!arr.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    group.add(new THREE.Mesh(g, mat));
  }
  scene.add(group);
  const c = { cx, cz, group, mats: [mFloor, mCeil, mWall], ready: false, dead: false, lmap: null, blank };
  const id = nextId++;
  pending.set(id, c);
  worker.postMessage({ cx, cz, id });
  return c;
}
function dropChunk(c) {
  c.dead = true;
  scene.remove(c.group);
  c.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of c.mats) m.dispose();
  if (c.lmap) c.lmap.dispose();
  c.blank.dispose();
}
let viewRadius = 2;
function updateChunks(px, pz, all) {
  const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
  const want = [];
  for (let dz = -viewRadius; dz <= viewRadius; dz++) for (let dx = -viewRadius; dx <= viewRadius; dx++) want.push([ccx + dx, ccz + dz, dx * dx + dz * dz]);
  want.sort((a, b) => a[2] - b[2]);
  let made = 0;
  for (const [x, z] of want) {
    const k = x + ',' + z;
    if (!chunks.has(k)) { chunks.set(k, makeChunk(x, z)); if (!all && ++made >= 1) break; }
  }
  for (const [k, c] of chunks) {
    if (Math.abs(c.cx - ccx) > viewRadius + 1 || Math.abs(c.cz - ccz) > viewRadius + 1) { dropChunk(c); chunks.delete(k); }
  }
}

// ---------------- collision ----------------
const R = 0.28;
function collide(p) {
  const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
  const boxes = [];
  for (let z = cz - 1; z <= cz + 2; z++) for (let x = cx - 1; x <= cx + 2; x++) {
    if (hEdge(x, z)) boxes.push([x * CELL - T / 2, x * CELL + CELL + T / 2, z * CELL - T / 2, z * CELL + T / 2]);
    if (vEdge(x, z)) boxes.push([x * CELL - T / 2, x * CELL + T / 2, z * CELL - T / 2, z * CELL + CELL + T / 2]);
    if (pillar(x, z)) { const s = PILLAR / 2; boxes.push([x * CELL - s, x * CELL + s, z * CELL - s, z * CELL + s]); }
  }
  for (let it = 0; it < 3; it++) for (const [x0, x1, z0, z1] of boxes) {
    const qx = Math.max(x0, Math.min(p.x, x1)), qz = Math.max(z0, Math.min(p.z, z1));
    const dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
    if (d2 < R * R) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = (R - d) / d; p.x += dx * push; p.z += dz * push; }
      else { // center inside the box: push out the short way
        const l = p.x - x0, r = x1 - p.x, b = p.z - z0, f = z1 - p.z, m = Math.min(l, r, b, f);
        if (m === l) p.x = x0 - R; else if (m === r) p.x = x1 + R; else if (m === b) p.z = z0 - R; else p.z = z1 + R;
      }
    }
  }
}

// ---------------- sound ----------------
let ac = null, master = null, humGain = null, windGain = null, windFilter = null;
const buffers = {};
async function loadSound(name) {
  const r = await fetch('assets/snd/' + name + '.ogg');
  return ac.decodeAudioData(await r.arrayBuffer());
}
function noiseBuffer(sec, brown) {
  const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
async function startAudio() {
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value = settings.volume; master.connect(ac.destination);
  // fluorescent hum: 120 Hz mains buzz with harmonics + a thin ballast whine + room tone
  humGain = ac.createGain(); humGain.gain.value = 0; humGain.connect(master);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(humGain);
  const saw = ac.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = 120;
  const sg = ac.createGain(); sg.gain.value = 0.05; saw.connect(sg).connect(lp); saw.start();
  for (const [f, g] of [[120, 0.10], [240, 0.05], [360, 0.025], [480, 0.012]]) {
    const o = ac.createOscillator(); o.frequency.value = f + (Math.random() - 0.5) * 0.3;
    const gg = ac.createGain(); gg.gain.value = g; o.connect(gg).connect(humGain); o.start();
  }
  const whine = ac.createOscillator(); whine.frequency.value = 15734 / 2; const wg = ac.createGain(); wg.gain.value = 0.0025;
  whine.connect(wg).connect(humGain); whine.start();
  const hiss = ac.createBufferSource(); hiss.buffer = noiseBuffer(4, false); hiss.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 2.5;
  const hg = ac.createGain(); hg.gain.value = 0.012; hiss.connect(bp).connect(hg).connect(humGain); hiss.start();
  const room = ac.createBufferSource(); room.buffer = noiseBuffer(6, true); room.loop = true;
  const rg = ac.createGain(); rg.gain.value = 0.05; room.connect(rg).connect(humGain); room.start();
  // falling wind
  const wind = ac.createBufferSource(); wind.buffer = noiseBuffer(4, false); wind.loop = true;
  windFilter = ac.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
  windGain = ac.createGain(); windGain.gain.value = 0; wind.connect(windFilter).connect(windGain).connect(master); wind.start();
  const names = ['land', ...Array.from({ length: 9 }, (_, i) => 'step' + i)];
  await Promise.all(names.map(async (n) => { try { buffers[n] = await loadSound(n); } catch {} }));
}
function play(name, vol, rate) {
  if (!ac || !buffers[name]) return;
  const s = ac.createBufferSource(); s.buffer = buffers[name]; s.playbackRate.value = rate || 1;
  const g = ac.createGain(); g.gain.value = vol; s.connect(g).connect(master); s.start();
}

// ---------------- player ----------------
const pos = new THREE.Vector3(CELL * 0.5, 30, CELL * 0.35);
let yaw = Math.PI * 0.85, pitch = 0;
let vy = 0;
let state = 'title';        // title -> fall -> landed -> walk
let landT = 0, stepPhase = 0, lastStep = 0, eyeDip = 0, speedNow = 0;
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'F11') { e.preventDefault(); toggleFull(); } });
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (state === 'fall') return;
  const k = 0.0022 * settings.sens;
  yaw -= e.movementX * k;
  pitch = Math.max(-1.45, Math.min(1.45, pitch - e.movementY * k));
});

// ---------------- menus ----------------
const $ = (id) => document.getElementById(id);
const title = $('title'), pause = $('pause');
function lock() { renderer.domElement.requestPointerLock?.(); }
function toggleFull() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
title.addEventListener('click', async () => {
  title.style.display = 'none';
  lock();
  if (!ac) await startAudio(); else ac.resume();
  state = 'fall';
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (!locked && state !== 'title') { pause.style.display = 'flex'; keys.clear(); ac?.suspend(); }
  if (locked) { pause.style.display = 'none'; ac?.resume(); }
});
$('resume').onclick = () => lock();
$('full').onclick = () => toggleFull();
$('quit').onclick = () => { fetch('/quit').catch(() => {}); setTimeout(() => window.close(), 150); };
const sens = $('sens'), vol = $('vol'), qual = $('qual');
sens.value = settings.sens; vol.value = settings.volume; qual.value = settings.quality;
sens.oninput = () => { settings.sens = +sens.value; store.set('sens', settings.sens); };
vol.oninput = () => { settings.volume = +vol.value; store.set('volume', settings.volume); if (master) master.gain.value = settings.volume; };
qual.onchange = () => { settings.quality = qual.value; store.set('quality', settings.quality); applyQuality(); };
setInterval(() => fetch('/alive').catch(() => {}), 10000);

// ---------------- quality ----------------
let scale = 1, autoLevel = 2;
const AUTO = ['low', 'medium', 'high'];
function applyQuality() {
  const q = settings.quality === 'auto' ? QUALITY[AUTO[autoLevel]] : QUALITY[settings.quality];
  scale = q.scale; bloom.enabled = q.bloom; viewRadius = q.radius;
  const aniso = settings.quality === 'ultra' ? Math.min(16, maxAniso) : Math.min(8, maxAniso);
  for (const k in TX) if (TX[k].anisotropy !== aniso) { TX[k].anisotropy = aniso; TX[k].needsUpdate = true; }
  resize();
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px';
  const pw = Math.max(1, Math.round(w * scale)), ph = Math.max(1, Math.round(h * scale));
  renderer.setDrawingBufferSize(pw, ph, 1);
  composer.setPixelRatio(1);
  composer.setSize(pw, ph);
  bloom.resolution.set(pw / 2, ph / 2);
  film.uniforms.res.value.set(pw, ph);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
applyQuality();

// ---------------- main loop ----------------
updateChunks(pos.x, pos.z, true);
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, fpsT = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  let black = 0;

  if (state === 'title') {
    black = 1;
  } else if (state === 'fall') {
    vy = Math.max(-14, vy - 9.8 * dt);
    pos.y += vy * dt;
    const above = pos.y > H + 0.05;
    black = above ? 1 : 0;
    if (windGain) { windGain.gain.value = above ? Math.min(0.5, -vy / 14 * 0.5) : 0; windFilter.frequency.value = 300 + (-vy) * 40; }
    if (humGain) humGain.gain.value = above ? 0 : 0.6;
    // wait in the dark until the rooms around the landing spot are ready
    const k = Math.floor(pos.x / CHUNK) + ',' + Math.floor(pos.z / CHUNK);
    if (pos.y < H + 1.5 && !chunks.get(k)?.ready) { pos.y = H + 1.5; }
    if (pos.y <= 0.6) {
      pos.y = 0.6; state = 'landed'; landT = 0; vy = 0;
      play('land', 0.9, 1.0);
      setTimeout(() => play('step3', 0.35, 0.8), 140);
    }
  } else if (state === 'landed') {
    landT += dt;
    const k = Math.min(1, landT / 2.6);
    const e = k * k * (3 - 2 * k);
    pos.y = 0.6 + (1.65 - 0.6) * e;
    pitch = Math.max(pitch, -0.9 + 0.9 * e) * 1;
    if (landT > 2.6) state = 'walk';
  }

  if (state === 'walk' && document.pointerLockElement === renderer.domElement) {
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    move.set(0, 0, 0);
    if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(fwd);
    if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(fwd);
    if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
    if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const target = move.lengthSq() > 0 ? (run ? 3.4 : 1.45) : 0;
    speedNow += (target - speedNow) * Math.min(1, dt * 8);
    if (move.lengthSq() > 0) { move.normalize(); lastDir.copy(move); }
    const ox = pos.x, oz = pos.z;
    pos.x += lastDir.x * speedNow * dt; pos.z += lastDir.z * speedNow * dt;
    collide(pos);
    const moved = Math.hypot(pos.x - ox, pos.z - oz);
    stepPhase += moved / (run ? 0.85 : 0.68) * Math.PI;
    if (Math.floor(stepPhase / Math.PI) !== lastStep && moved > 0.0005) {
      lastStep = Math.floor(stepPhase / Math.PI);
      play('step' + Math.floor(Math.random() * 9), (run ? 0.55 : 0.38) * (0.85 + Math.random() * 0.3), 0.9 + Math.random() * 0.2);
    }
    pos.y = 1.65;
  }
  // head bob + slight sway
  const bobA = state === 'walk' ? Math.min(1, speedNow / 1.45) : 0;
  const bob = Math.abs(Math.sin(stepPhase * 0.5)) * 0.032 * bobA * (speedNow > 2 ? 1.4 : 1);
  const sway = Math.sin(stepPhase * 0.5) * 0.012 * bobA;
  camera.position.set(pos.x + Math.cos(yaw) * sway, pos.y + bob - 0.016 * bobA, pos.z - Math.sin(yaw) * sway);
  const breathe = Math.sin(t * 1.3) * 0.0025;
  camera.rotation.set(0, 0, 0);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch + breathe;
  camera.rotation.z = state === 'landed' ? (1 - Math.min(1, landT / 2.6)) * 0.12 : Math.sin(stepPhase * 0.5) * 0.004 * bobA;

  // hum louder right under a light
  if (humGain && state !== 'fall' && state !== 'title') {
    const lx = Math.floor(pos.x / CELL), lz = Math.floor(pos.z / CELL);
    let near = 0;
    for (let z = lz - 1; z <= lz + 1; z++) for (let x = lx - 1; x <= lx + 1; x++) if (light(x, z) === 1) {
      const d = Math.hypot(pos.x - (x + 0.5) * CELL, pos.z - (z + 0.5) * CELL);
      near = Math.max(near, 1 - Math.min(1, d / 3.5));
    }
    const target = 0.45 + near * 0.35;
    humGain.gain.value += (target - humGain.gain.value) * Math.min(1, dt * 3);
  }

  updateChunks(pos.x, pos.z, false);
  film.uniforms.time.value = t;
  film.uniforms.black.value = black;
  composer.render(dt);

  // auto quality: watch the frame time
  if (settings.quality === 'auto' && state === 'walk') {
    fpsAcc += dt; fpsN++; fpsT += dt;
    if (fpsT > 2.5) {
      const fps = fpsN / fpsAcc;
      if (fps < 45 && autoLevel > 0) { autoLevel--; applyQuality(); }
      else if (fps > 58 && autoLevel < AUTO.length - 1) { autoLevel++; applyQuality(); }
      fpsAcc = 0; fpsN = 0; fpsT = 0;
    }
  }
  window.__dbg = { state, pos: pos.toArray(), chunks: chunks.size, ready: [...chunks.values()].filter((c) => c.ready).length, scale };
}
const lastDir = new THREE.Vector3();
frame();
window.__test = {
  start: () => { title.style.display = 'none'; state = 'fall'; },
  skip: () => { state = 'walk'; pos.y = 1.65; },
  setView: (x, z, y, p) => { pos.x = x; pos.z = z; yaw = y; pitch = p; },
  move: (x, z) => { pos.x = x; pos.z = z; collide(pos); return [pos.x, pos.z]; },
};
