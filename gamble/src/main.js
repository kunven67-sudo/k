// GAMBLE — entry point. Boots core systems, registers game states and starts the loop.

import { Engine } from './core/engine.js';
import { input } from './core/input.js';
import { audio } from './core/audio.js';
import { initPhysics } from './core/physics.js';
import { save } from './core/save.js';
import { bus } from './core/events.js';
import { STATES, FIRST_STATE } from './states/index.js';

async function main() {
  const canvas = document.getElementById('game-canvas');
  input.attach(canvas);

  // iOS/Chrome only allow audio after a user gesture — unlock on the first one.
  const unlock = () => {
    audio.unlock();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { passive: true });

  await initPhysics();

  const engine = new Engine(canvas);
  window.__gamble = { engine, bus, save, input, audio }; // dev console access
  for (const [name, StateClass] of Object.entries(STATES)) engine.register(name, StateClass);
  engine.start();

  const params = new URLSearchParams(location.search);
  const startState = params.get('state') || FIRST_STATE;
  await engine.go(startState, Object.fromEntries(params), { fade: false });
  save.startAutosave();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  const msg = document.createElement('pre');
  msg.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;color:#f3ead8;background:#0b0a0c;font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap;z-index:999';
  msg.textContent = `GAMBLE failed to start.\n\n${err?.stack || err}`;
  document.body.appendChild(msg);
});
