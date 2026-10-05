// Dev harness: boots the real engine with a single state so modules can be viewed in isolation.
// Usage in a dev page:
//   import { runState } from './harness.js';
//   import { MyState } from '../src/.../my-state.js';
//   runState(MyState, { some: 'params' });
import { Engine } from '../src/core/engine.js';
import { input } from '../src/core/input.js';
import { audio } from '../src/core/audio.js';
import { initPhysics } from '../src/core/physics.js';
import { bus } from '../src/core/events.js';

export async function runState(StateClass, params = {}, extraStates = {}) {
  const canvas = document.getElementById('game-canvas');
  input.attach(canvas);
  const unlock = () => audio.unlock();
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { passive: true });
  await initPhysics();
  const engine = new Engine(canvas);
  window.__gamble = { engine, bus, input, audio };
  engine.register('dev', StateClass);
  for (const [k, v] of Object.entries(extraStates)) engine.register(k, v);
  engine.start();
  await engine.go('dev', { ...Object.fromEntries(new URLSearchParams(location.search)), ...params }, { fade: false });
  window.__ready = true;
  return engine;
}
