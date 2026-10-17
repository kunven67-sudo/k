// REAL LIFE — entry point: boots the core systems, registers the game states, starts the loop.

import { Engine } from './core/engine.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { initPhysics } from './core/physics.js';
import { save } from './core/save.js';
import { bus } from './core/events.js';
import { clock } from './core/clock.js';
import { STATES, FIRST_STATE } from './states/index.js';

async function main() {
  const canvas = document.getElementById('game-canvas');
  input.attach(canvas);
  const unlock = () => audio.unlock();
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { passive: true });

  await initPhysics();
  const engine = new Engine(canvas);
  window.__rl = { engine, bus, save, input, audio, clock }; // dev console access
  for (const [name, StateClass] of Object.entries(STATES)) engine.register(name, StateClass);
  engine.start();

  const params = new URLSearchParams(location.search);
  const start = params.get('state') || FIRST_STATE;
  await engine.go(start, Object.fromEntries(params), { fade: false });
  save.startAutosave();
}

main().catch((err) => {
  console.error(err);
  const msg = document.createElement('pre');
  msg.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;color:#fbf8f2;background:#16151a;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;z-index:999';
  msg.textContent = `REAL LIFE failed to start.\n\n${err?.stack || err}`;
  document.body.appendChild(msg);
});
