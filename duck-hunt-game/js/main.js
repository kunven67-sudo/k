// Entry point: wires up the renderer, the main menu, and the whole scene-to-scene game flow.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

import { getSettings, setSetting, getGraphicsPreset, getEffectivePixelRatio } from './settings.js';
import * as achievements from './achievements.js';
import { initAudio, resumeAudio, playUIClick, playAchievementJingle, startAmbientDrone } from './audio.js';
import { FirstPersonController } from './player.js';
import { createKitchenScene, createEntryScene, createBedroomScene } from './scenes/houseScenes.js';
import { createDuckHuntScene } from './scenes/duckHuntScene.js';
import { playCommercial, fadeToBlack, fadeFromBlack, glitchTransition, isDialogueOpen } from './cutscenes.js';
import { determineEnding, showEnding } from './endings.js';

// ---------- Renderer / camera / controller ----------
const canvasContainer = document.getElementById('scene-root');
let preset0 = getGraphicsPreset();
let renderer = new THREE.WebGLRenderer({ antialias: preset0.antialias, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasContainer.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(getSettings().fov, window.innerWidth / window.innerHeight, 0.1, preset0.cameraFar);

let controller = new FirstPersonController(camera, renderer.domElement);

let composer = null, bloomPass = null, renderPass = null;
let activeScene = null;
let gameplayActive = false;
let currentInteractable = null;

function bindControllerEvents() {
  controller.controls.addEventListener('lock', () => hideLockOverlay());
  controller.controls.addEventListener('unlock', () => { if (gameplayActive) showLockOverlay('Click to Resume'); });
}
bindControllerEvents();

function rebuildRenderer(antialias) {
  const oldCanvas = renderer.domElement;
  controller.dispose();
  renderer.dispose();
  renderer = new THREE.WebGLRenderer({ antialias, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  canvasContainer.replaceChild(renderer.domElement, oldCanvas);
  controller = new FirstPersonController(camera, renderer.domElement);
  bindControllerEvents();
  if (activeScene) {
    controller.setColliders(activeScene.colliders);
    controller.footstepSurface = activeScene.floorSurface || 'wood';
  }
  composer = null; bloomPass = null; renderPass = null;
}

function rebuildComposer(preset) {
  // Free the previous composer's render targets - this runs on every scene change while
  // bloom is on, so skipping disposal here would leak a pair of render targets each time.
  if (bloomPass && bloomPass.dispose) bloomPass.dispose();
  if (composer) {
    if (composer.renderTarget1) composer.renderTarget1.dispose();
    if (composer.renderTarget2) composer.renderTarget2.dispose();
  }
  composer = null; bloomPass = null; renderPass = null;
  if (preset.bloom) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(getEffectivePixelRatio(preset));
    composer.setSize(window.innerWidth, window.innerHeight);
    renderPass = new RenderPass(activeScene ? activeScene.scene : new THREE.Scene(), camera);
    composer.addPass(renderPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), preset.bloomStrength, 0.55, 0.82);
    composer.addPass(bloomPass);
  }
}

// Applies the current graphics preset to renderer/camera/composer. `allowRebuild` permits
// recreating the WebGL context itself, which is the only way to toggle antialias after the
// fact - only done right when the player changes the setting from the menu, never mid-scene.
function applyGraphicsSettings(allowRebuild = false) {
  const preset = getGraphicsPreset();
  if (allowRebuild) {
    const attrs = renderer.getContext().getContextAttributes();
    if (!attrs || attrs.antialias !== preset.antialias) rebuildRenderer(preset.antialias);
  }
  renderer.shadowMap.enabled = preset.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(getEffectivePixelRatio(preset));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.far = preset.cameraFar;
  camera.updateProjectionMatrix();
  rebuildComposer(preset);
}
applyGraphicsSettings(false);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Pointer-lock overlay ----------
function showLockOverlay(text) {
  document.getElementById('pointer-lock-text').textContent = text || 'Click to Play';
  document.getElementById('pointer-lock-overlay').classList.remove('hidden');
}
function hideLockOverlay() { document.getElementById('pointer-lock-overlay').classList.add('hidden'); }
document.getElementById('pointer-lock-overlay').addEventListener('click', () => {
  initAudio(); resumeAudio();
  controller.lock();
});

// ---------- Scene management ----------
function teardownScene() {
  if (activeScene) { activeScene.dispose && activeScene.dispose(); activeScene = null; }
}

async function enterFirstPersonScene(builder, extraOpts = {}) {
  applyGraphicsSettings(false);
  teardownScene();
  const bundle = builder({ camera, controller, ...extraOpts });
  bundle.scene.add(camera);
  activeScene = bundle;
  if (renderPass) renderPass.scene = bundle.scene;
  controller.setColliders(bundle.colliders);
  controller.footstepSurface = bundle.floorSurface || 'wood';
  controller.setPosition(bundle.spawn.x, bundle.spawn.y, bundle.spawn.z);
  controller.setYaw(bundle.spawn.yaw);
  gameplayActive = true;
  if (!controller.isLocked) showLockOverlay('Click to Play'); else hideLockOverlay();
  return bundle;
}

function updateInteractPrompt() {
  const promptEl = document.getElementById('interact-prompt');
  if (!activeScene || isDialogueOpen() || !controller.isLocked) {
    promptEl.classList.remove('show');
    currentInteractable = null;
    return;
  }
  const it = controller.getInteractable(activeScene.interactables);
  currentInteractable = it && it.enabled !== false ? it : null;
  if (currentInteractable) {
    promptEl.textContent = `[E] ${currentInteractable.prompt || 'Interact'}`;
    promptEl.classList.add('show');
  } else {
    promptEl.classList.remove('show');
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE' && currentInteractable && !isDialogueOpen()) {
    currentInteractable.onInteract && currentInteractable.onInteract();
  }
});

// ---------- HUD ----------
function updateHud(state) {
  document.getElementById('hud-score').textContent = `Score: ${state.score}`;
  document.getElementById('hud-shells').textContent = `Shells: ${state.shells}/${state.maxShells}`;
  document.getElementById('hud-round').textContent = `Round ${state.round}/${state.totalRounds}`;
}
function showHud() { document.getElementById('hud').classList.remove('hidden'); }
function hideHud() { document.getElementById('hud').classList.add('hidden'); }

// ---------- Achievement toasts ----------
function showAchievementToast(def) {
  playAchievementJingle();
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="toast-title">Achievement Unlocked</div><div class="toast-name">${def.name}</div>`;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 3600);
}
achievements.onUnlock(showAchievementToast);

// ---------- Main menu ----------
function showPanel(name) {
  ['main', 'settings', 'achievements', 'credits'].forEach(p => {
    document.getElementById(`panel-${p}`).classList.toggle('hidden', p !== name);
  });
}

function renderAchievementsPanel() {
  const list = document.getElementById('achievements-list');
  list.innerHTML = '';
  achievements.getAll().forEach(a => {
    const hidden = a.secret && !a.unlocked;
    const item = document.createElement('div');
    item.className = `achievement-item ${a.unlocked ? 'unlocked' : 'locked'}`;
    item.innerHTML = `<div class="achievement-name">${hidden ? '??? (Secret)' : a.name}</div>
      <div class="achievement-desc">${hidden ? 'Keep playing to discover this one.' : a.desc}</div>`;
    list.appendChild(item);
  });
}

function wireSettingsPanel() {
  const s = getSettings();
  const graphicsSelect = document.getElementById('setting-graphics');
  graphicsSelect.value = s.graphics;
  graphicsSelect.addEventListener('change', () => {
    setSetting('graphics', graphicsSelect.value);
    if (graphicsSelect.value === 'ultra') achievements.unlock('graphics_ultra');
    applyGraphicsSettings(true);
    playUIClick();
  });

  const sensSlider = document.getElementById('setting-sensitivity');
  sensSlider.value = s.sensitivity;
  sensSlider.addEventListener('input', () => setSetting('sensitivity', parseFloat(sensSlider.value)));

  const volSlider = document.getElementById('setting-volume');
  volSlider.value = s.volume;
  volSlider.addEventListener('input', () => setSetting('volume', parseFloat(volSlider.value)));

  const fovSlider = document.getElementById('setting-fov');
  fovSlider.value = s.fov;
  fovSlider.addEventListener('input', () => {
    const fov = parseInt(fovSlider.value, 10);
    setSetting('fov', fov);
    camera.fov = fov;
    camera.updateProjectionMatrix();
  });
}

function wireMenuButtons() {
  document.getElementById('btn-play').addEventListener('click', () => { playUIClick(); playGame(); });
  document.getElementById('btn-settings').addEventListener('click', () => { playUIClick(); showPanel('settings'); });
  document.getElementById('btn-achievements').addEventListener('click', () => { playUIClick(); renderAchievementsPanel(); showPanel('achievements'); });
  document.getElementById('btn-credits').addEventListener('click', () => { playUIClick(); showPanel('credits'); });
  document.querySelectorAll('.btn-back').forEach(b => b.addEventListener('click', () => { playUIClick(); showPanel('main'); }));
}

function returnToMainMenu() {
  const fade = document.getElementById('fade-overlay');
  fade.style.opacity = '0';
  fade.style.pointerEvents = 'none';
  hideHud();
  document.getElementById('main-menu').classList.remove('hidden');
  showPanel('main');
  startAmbientDrone('menu');
}

// ---------- Game flow ----------
async function playGame() {
  document.getElementById('main-menu').classList.add('hidden');
  initAudio(); resumeAudio();

  await playCommercial();

  await enterFirstPersonScene(createKitchenScene);
  await activeScene.advance;
  await fadeToBlack(600);

  await enterFirstPersonScene(createEntryScene);
  await fadeFromBlack(600);
  await activeScene.advance;
  await fadeToBlack(600);

  await enterFirstPersonScene(createBedroomScene);
  await fadeFromBlack(600);
  await activeScene.advance;

  await glitchTransition(500);
  await fadeToBlack(400);

  await enterFirstPersonScene(createDuckHuntScene, { onHud: updateHud, onGameEnd: handleGameEnd });
  startAmbientDrone('duckhunt');
  showHud();
  await fadeFromBlack(700);
}

function handleGameEnd(stats) {
  gameplayActive = false;
  controller.unlock();
  hideHud();
  const endingId = determineEnding(stats);
  showEnding(endingId, stats, {
    onMenu: () => { teardownScene(); returnToMainMenu(); },
    onPlayAgain: () => { teardownScene(); playGame(); },
  });
}

// ---------- Render loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;

  if (activeScene) {
    if (!isDialogueOpen()) controller.update(dt);
    activeScene.update(dt, elapsed);
    updateInteractPrompt();

    if (activeScene.mirror) {
      renderer.setRenderTarget(activeScene.mirror.target);
      renderer.render(activeScene.scene, activeScene.mirror.camera);
      renderer.setRenderTarget(null);
    }
    if (composer) composer.render(); else renderer.render(activeScene.scene, camera);
  }
}

// ---------- Init ----------
function init() {
  wireMenuButtons();
  wireSettingsPanel();
  renderAchievementsPanel();
  const startAudio = () => { initAudio(); resumeAudio(); startAmbientDrone('menu'); };
  window.addEventListener('pointerdown', startAudio, { once: true });
  window.addEventListener('keydown', startAudio, { once: true });
  animate();
}
init();
