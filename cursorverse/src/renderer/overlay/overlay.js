// Full-screen, click-through effects layer (one per monitor).
import { FxEngine } from '../../shared/effects.mjs';

const params = new URLSearchParams(location.search);
const ox = Number(params.get('x')) || 0;
const oy = Number(params.get('y')) || 0;
const canvas = document.getElementById('c');
const fx = new FxEngine(canvas);
let visible = false;
let running = false;
let last = performance.now();

function resize() { fx.resize(innerWidth, innerHeight, devicePixelRatio || 1); }
addEventListener('resize', resize);
resize();

// Only animate while something is on screen, so an idle overlay costs nothing.
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const busy = fx.frame(dt);
  const idleOn = fx.cfg.idle?.enabled;
  if (visible && (busy || idleOn)) requestAnimationFrame(loop);
  else running = false;
}
function wake() {
  if (!running && visible) { running = true; last = performance.now(); requestAnimationFrame(loop); }
}

window.fx.onConfig((cfg) => { fx.setConfig(cfg); wake(); });
window.fx.onVisible((v) => {
  visible = v;
  if (!v) { fx.parts = []; fx.ribbon = []; fx.frame(0); }
  wake();
});
window.fx.onPos((p) => { fx.move(p.x - ox, p.y - oy); wake(); });
window.fx.onClick((c) => {
  const x = c.x - ox, y = c.y - oy;
  if (x < -50 || y < -50 || x > innerWidth + 50 || y > innerHeight + 50) return;
  fx.click(x, y, c.button);
  wake();
});
