// Starts the game: engine, menu scene, main menu. Dev/test links: ?play=1 (skip the menu), ?skip=1 (skip the intro),
// ?zone=earth&size=20000 (jump straight to a world at a size, metres), ?menu=0.
import { Game } from './game.js';
import { MenuScene } from '../ui/menuScene.js';

export async function startGame(canvas, q, hideBoot) {
  const bar = document.getElementById('bootbar'), msg = document.getElementById('bootmsg');
  const set = (t, f) => { if (msg) msg.textContent = t; if (bar) bar.style.width = Math.round(f * 100) + '%'; };
  set('starting the engine', 0.15);
  const G = new Game(canvas, q);
  set('spinning the web', 0.45);
  G.menuScene = new MenuScene(G);
  try { await G.menuScene.build(); } catch (e) { console.error('menu scene failed', e); G.menuScene = null; }
  set('ready', 1);
  G.start();
  canvas.addEventListener('mousedown', () => { if (G.state === 'play' && !G.input.locked && !G.menus.open) G.input.lock(); });
  if (q.get('play') || q.get('zone')) {
    hideBoot();
    await G.newRun({ difficulty: q.get('diff') || undefined, skipIntro: !!q.get('skip') || !!q.get('zone') });
    if (q.get('zone')) await G.debugJump(q.get('zone'), parseFloat(q.get('size') || '0'));
  } else {
    G.menus.main();
    hideBoot();
  }
}
