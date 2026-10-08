// Dev page: the playable world state (src/states/world.js) with the real engine.
//   world.html?newLife=1            the first morning (opening on the motel floor)
//   world.html?spawn=street&hour=19 on E 4th St at dusk   (spawn: wake room lot office street)
//   &room=23  room number · &opening=0 skip the opening
// Console: __world (state), __world.player, __world.world.
import { runState } from './harness.js';
import { WorldState } from '../src/states/world.js';
import { clock } from '../src/core/clock.js';

window.__clock = clock;

const q = Object.fromEntries(new URLSearchParams(location.search));
runState(WorldState, { ...q, newLife: q.newLife === '1' });

// Deterministic stepping for headless tests (SwiftShader renders ~1 fps, so real time can't be
// used to walk around): __sim(seconds, { keys: ['KeyW'], look: [dx, dy] per step }).
window.__sim = (seconds, { keys = [], look = [0, 0], drag = null } = {}) => {
  const st = window.__world;
  const { input } = window.__gamble;
  const ph = st.physics;
  for (const k of keys) input.keysDown.add(k);
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    input.beginFrame();
    input.look.x = look[0];
    input.look.y = look[1];
    if (drag) {
      input.pointer.dragging = true;
      input.pointer.dx = drag[0];
      input.pointer.dy = drag[1];
    }
    window.__clock.update(1 / 60);
    st.fixedUpdate(1 / 60);
    ph.step();
    ph.sync();
    st.update(1 / 60);
    input.look.x = input.look.y = 0;
    input.pointer.dx = input.pointer.dy = 0;
  }
  for (const k of keys) input.keysDown.delete(k);
  const p = st.player.position;
  return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +st.player.controller.speed.toFixed(2)];
};
