// SCALE entry point.
import { initPhysics, RAPIER } from './core/physics.js';
import { input } from './core/input.js';
import { Game } from './game.js';
import { CATALOG } from './props/catalog.js';
import { Hud } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { PhoneUI } from './ui/phone.js';
import { TouchControls } from './ui/touch.js';
import { buildTestRoom } from './world/testroom.js';
import { buildMansion } from './world/mansion.js';

async function main() {
  const canvas = document.getElementById('view');
  input.attach(canvas);
  await initPhysics();
  const game = new Game(canvas);
  window.__scale = game; // dev console access + automated tests
  window.__input = input;
  window.__cat = CATALOG;
  window.__RAP = RAPIER;
  const q = new URLSearchParams(location.search);
  const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined);
  const spawnOverride = {};
  if (q.has('x')) spawnOverride.position = [num('x'), num('y') ?? 0, num('z') ?? 0];
  if (q.has('yaw')) spawnOverride.yaw = num('yaw');
  if (q.has('pitch')) spawnOverride.pitch = num('pitch');
  if (q.has('scale')) spawnOverride.scale = num('scale');
  game.debug = q.has('debug');
  game.testMode = q.has('frames');
  await game.loadWorld(q.get('world') === 'test' ? buildTestRoom : buildMansion, spawnOverride);
  if (q.has('face')) game.player.facing = num('face');
  if (q.has('dist')) game.player.camDist = num('dist');
  const ui = document.getElementById('ui');
  game.hud = game.ui.hud = new Hud(ui, game);
  game.ui.phone = new PhoneUI(ui, game);
  game.ui.touch = new TouchControls(ui, game);
  // Menus cover the screen, so automated screenshots skip them unless asked (?menu).
  if (!game.testMode || q.has('menu')) game.ui.menu = new Menu(ui, game);
  if (q.has('frames')) {
    // Test mode: run N fixed frames then flag ready (used by the screenshot harness).
    const n = num('frames');
    for (let i = 0; i < n; i++) game.tick(1 / 60, i === n - 1);
    window.__ready = true;
    return;
  }
  game.start();
  window.__ready = true;
}

main().catch((err) => {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;color:#f3ead8;background:#07080b;font:14px/1.5 monospace;white-space:pre-wrap;z-index:99';
  pre.textContent = `SCALE failed to start.\n\n${err?.stack || err}`;
  document.body.appendChild(pre);
  window.__error = String(err?.stack || err);
});
