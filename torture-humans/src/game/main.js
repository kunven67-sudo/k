// Game entry: boots the engine and runs the main loop.
import * as THREE from 'three';
import { Settings } from './engine/settings.js';
import { Input } from './engine/input.js';
import { initPhysics, Physics } from './engine/physics.js';
import { Renderer } from './engine/renderer.js';
import { AnimLibrary, Character, loadAvatar, baseClips } from './engine/anim.js';
import { Player } from './player.js';
import { buildTestLevel } from './levels/test-level.js';
import { buildLab } from './levels/lab.js';

const params = new URLSearchParams(location.search);

export async function boot() {
  const canvas = document.getElementById('game');
  const settings = new Settings();
  // test hook: ?gfx={"bloom":false} overrides graphics settings
  if (params.get('gfx')) settings.set({ graphics: JSON.parse(params.get('gfx')) });
  await initPhysics();
  const physics = new Physics();
  const input = new Input(canvas, settings);
  const renderer = new Renderer(canvas, settings);
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.02, 700);
  const scene = new THREE.Scene();

  const levels = { lab: buildLab, test: buildTestLevel };
  const level = await (levels[params.get('level')] || buildLab)({ scene, physics, renderer: renderer.renderer });

  const lib = new AnimLibrary('assets/anims/');
  await lib.require(baseClips('m'));
  const avatar = await loadAvatar('assets/avatars/Male_Adult_01.glb');
  const character = new Character(avatar, lib, { gender: 'm' });
  const player = new Player({ physics, input, settings, camera, character, scene, position: level.spawn });
  if (params.get('cam')) player.mode = params.get('cam');
  if (level.ladder) player.setLadder(level.ladder, level.ladderTopFloorY);

  renderer.sunIntensity = level.sunIntensity;
  renderer.setScene(scene, camera, { sunDirection: level.sunDirection });
  addEventListener('resize', () => renderer.resize());
  canvas.addEventListener('click', () => input.lockPointer());

  const fpsEl = document.getElementById('fps');
  const hintEl = document.getElementById('hint');
  let last = performance.now();
  const game = { scene, camera, physics, input, renderer, player, settings, character, level, frame: 0 };
  window.game = game; // for tests and debugging

  // test hook: drive the player without a real keyboard
  game.simulate = (seconds, { keys = [], look = [0, 0] } = {}) => {
    for (const k of keys) { input.down.add(k); input.pressedCodes.add(k); }
    const n = Math.max(1, Math.round(seconds * 60));
    for (let i = 0; i < n; i++) step(1 / 60, look.map((v) => v / n));
    for (const k of keys) input.down.delete(k);
  };

  function step(dt, look) {
    input.beginFrame();
    if (look) { input.mouseDX += look[0] / 0.0022; input.mouseDY += look[1] / 0.0022; }
    physics.update(dt, (fixed) => player.fixedUpdate(fixed));
    player.update(dt, physics.alpha);
    level.update?.(dt);
    input.endFrame();
    game.frame++;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!params.has('paused')) step(dt);
    const hint = player.interactHint;
    if (hintEl && hintEl.textContent !== (hint || '')) { hintEl.textContent = hint || ''; hintEl.hidden = !hint; }
    if (renderer.render(now) && fpsEl) {
      fpsEl.hidden = !settings.get('graphics.showFps');
      fpsEl.textContent = `${renderer.fps} FPS`;
    }
  }
  requestAnimationFrame(loop);
  game.ready = true;
  return game;
}

boot().catch((err) => {
  console.error(err);
  const box = document.getElementById('error');
  if (box) { box.hidden = false; box.textContent = `Something broke while loading: ${err.message}`; }
});
