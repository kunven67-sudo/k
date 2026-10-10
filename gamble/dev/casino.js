// Dev page: the playable world with the Eldorado casino floor (src/casino, lane A).
//   casino.html?spawn=foyer|pit|cage|slots|fountain|bar|classic|fourth|entrance   (default foyer)
//   &quality=low|medium|high|ultra   force a tier   ·   &hour=21   time of day
// Console: __world (state), __casino (the interior), __casinoPerf() draw calls / triangles of the
// current view, __sim(sec, {keys, look}) deterministic stepping for headless tests.
import { settings } from '../src/core/settings.js';
import { clock } from '../src/core/clock.js';

const q = Object.fromEntries(new URLSearchParams(location.search));
if (q.quality) settings.set('quality', q.quality);
window.__clock = clock;

const { runState } = await import('./harness.js');
const { WorldState } = await import('../src/states/world.js');
const spawn = `casino${(q.spawn || 'foyer')[0].toUpperCase()}${(q.spawn || 'foyer').slice(1)}`;
runState(WorldState, { ...q, spawn, newLife: false, opening: '0' }).then(() => {
  window.__casino = window.__world?.world?.casino;
});

// Draw calls / triangles of one plain render of the current view (the composer's passes would
// otherwise reset renderer.info mid-frame).
window.__casinoPerf = () => {
  const { engine } = window.__gamble;
  const r = engine.renderer;
  const st = window.__world;
  r.info.autoReset = false;
  r.info.reset();
  r.render(st.scene, st.camera);
  const out = { calls: r.info.render.calls, triangles: r.info.render.triangles, tier: engine.tier.name, lights: 0 };
  r.info.autoReset = true;
  st.scene.traverseVisible((o) => o.isLight && o.isPointLight && out.lights++);
  return out;
};

// Deterministic stepping for headless tests (SwiftShader renders ~1 fps).
window.__sim = (seconds, { keys = [], look = [0, 0] } = {}) => {
  const st = window.__world;
  const { input } = window.__gamble;
  const ph = st.physics;
  for (const k of keys) input.keysDown.add(k);
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    input.beginFrame();
    input.look.x = look[0];
    input.look.y = look[1];
    window.__clock.update(1 / 60);
    st.fixedUpdate(1 / 60);
    ph.step();
    ph.sync();
    st.update(1 / 60);
    input.look.x = input.look.y = 0;
  }
  for (const k of keys) input.keysDown.delete(k);
  const p = st.player.position;
  return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)];
};
