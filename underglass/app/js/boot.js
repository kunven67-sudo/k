// start-up: read how their PC looks, build the fake Windows, start the game loop
import { ipc, toast, DPR } from './util.js';
import { Phys } from './physics.js';
import { initIcons } from './icons.js';
import { loadItems } from './items.js';
import { audio } from './audio.js';
import { Desktop } from './desktop.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { Worlds } from './world/worlds.js';

async function main() {
  const [look] = await Promise.all([ipc.invoke('pc-look'), Phys.init(), loadItems(), audio.ready]);
  await initIcons();
  const desk = new Desktop(look, null);
  const game = new Game(desk, look);
  await desk.build();
  // their real mouse cursor picture (for powers that change the mouse)
  const cur = look.cursors && look.cursors.arrow;
  if (cur) {
    const c = document.createElement('canvas'); c.width = cur.w; c.height = cur.h;
    const bytes = Uint8ClampedArray.from(atob(cur.rgba), ch => ch.charCodeAt(0)); c.getContext('2d').putImageData(new ImageData(bytes, cur.w, cur.h), 0, 0);
    game.cursorImg = c; game.cursorHot = [cur.hx, cur.hy];
  }
  const hud = new Hud(game); await hud.loadSettings();
  game.worlds = new Worlds(game); await game.worlds.load();
  window.UG = game; game.look = look; // for tests
  let last = performance.now(), slowFrames = 0;
  const frame = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    try { game.update(dt); game.draw(); } catch (e) { console.error(e); if (!window.__errShown) { window.__errShown = true; toast('Something broke: ' + e.message, 6000); } }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  addEventListener('beforeunload', () => game.save());
  setInterval(() => game.save(), 60000);
  setTimeout(() => toast('UNDERGLASS: press TAB for the menu. Pull anything to rip it off.', 5200), 900);
  window.__ready = true;
}
main().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:10px;top:10px;z-index:999;color:#f55;background:#000;padding:10px">${String(e.stack || e)}</pre>`); });
