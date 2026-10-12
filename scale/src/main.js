// SCALE entry point.
import { initPhysics } from './core/physics.js';
import { input } from './core/input.js';
import { Game } from './game.js';
import { Hud } from './ui/hud.js';
import { buildTestRoom } from './world/testroom.js';

async function main() {
  const canvas = document.getElementById('view');
  input.attach(canvas);
  await initPhysics();
  const game = new Game(canvas);
  window.__scale = game; // dev console access + automated tests
  const q = new URLSearchParams(location.search);
  const num = (k) => (q.has(k) ? Number(q.get(k)) : undefined);
  const spawnOverride = {};
  if (q.has('x')) spawnOverride.position = [num('x'), num('y') ?? 0, num('z') ?? 0];
  if (q.has('yaw')) spawnOverride.yaw = num('yaw');
  if (q.has('pitch')) spawnOverride.pitch = num('pitch');
  if (q.has('scale')) spawnOverride.scale = num('scale');
  game.debug = q.has('debug');
  game.testMode = q.has('frames');
  await game.loadWorld(buildTestRoom, spawnOverride);
  game.hud = new Hud(document.getElementById('ui'), game);
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
