// TERRARIUM - starts the renderer, the world, the menu, and runs the frame loop.
import * as THREE from 'three';
import { Game } from './game.js';
import { UI } from './ui/ui.js';
import { loadSettings, settings, onSettings } from './core/settings.js';
import { initInput, endFrame, input } from './core/input.js';
import { quality, applyQualitySetting, tickQuality, effectiveQuality } from './core/quality.js';
import { initAudio, applyVolumes } from './core/audio.js';

loadSettings();
const canvas = document.getElementById('game');
const root = document.getElementById('ui');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
} catch (e) {
  root.innerHTML = '<div style="padding:40px;font-size:18px">TERRARIUM needs WebGL. Your browser or graphics driver blocked it. Try Chrome or Edge, and turn on hardware acceleration.</div>';
  throw e;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 1500);
camera.rotation.order = 'YXZ';

initInput(canvas);
const game = new Game(renderer, scene, camera);
try { const look = JSON.parse(localStorage.getItem('terrarium.look') || 'null'); if (look) game.customLook = look; } catch (e) { /* ignore */ }
const ui = new UI(game, root);
game.ui = ui;

// graphics settings -> renderer
function applyGraphics() {
  const q = effectiveQuality();
  renderer.setPixelRatio(Math.min(2.5, (devicePixelRatio || 1) * q.pixel));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = q.shadows;
  const size = q.shadowSize;
  for (const l of [game.world.sun, game.cage.sun]) {
    if (!l || !l.shadow) continue;
    l.castShadow = q.shadows;
    if (l.shadow.mapSize.x !== size) { l.shadow.mapSize.set(size, size); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } }
  }
  game.cage.grassOn = q.grass > 0;
  scene.traverse((o) => { if (o.material && o.material.needsUpdate !== undefined && o.isMesh && o.receiveShadow) o.material.needsUpdate = true; });
}
quality.listeners.add(applyGraphics);
onSettings(() => { applyGraphics(); applyVolumes(); });
applyQualitySetting();
applyGraphics();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); });

// audio needs a click first (browser rule)
addEventListener('pointerdown', () => initAudio(), { once: true });
addEventListener('keydown', () => initAudio(), { once: true });

// the live menu: a small demo world behind the frosted glass
game.newWorld({ demo: true, count: 14, theme: 'mixed' });
game.player.vm.visible = false;
ui.menus.main();

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // tab was hidden
  dt = Math.min(dt, 1 / 20);
  tickQuality(dt);
  try {
    if (ui.state === 'menu') ui.menus.menuCamera(camera, dt);
    game.update(dt);
    ui.update(dt);
  } catch (e) {
    console.error(e);
    acc += 1;
    if (acc < 4) ui.toast('Something went wrong: ' + e.message);
  }
  renderer.render(scene, camera);
  endFrame();
}
requestAnimationFrame(frame);

// for testing from the console / headless browser
window.__game = game;
window.__ui = ui;
void settings; void input;
