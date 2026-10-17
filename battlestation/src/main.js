import * as THREE from 'three';
import { Game } from './game.js';

const game = new Game();
window.__game = game;
game.boot().catch(e => {
  console.error(e);
  const t = document.getElementById('loadtext');
  if (t) t.textContent = 'Something broke while loading: ' + (e && e.message ? e.message : e);
});
export { THREE };
