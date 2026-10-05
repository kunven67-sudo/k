// Full-screen tools (info, telescope, encyclopedia, goals, sandbox, map).
// While one is open the simulation waits, and the mouse is free for clicking.
import { InfoSheet } from './info.js';

const $ = (id) => document.getElementById(id);

export function installSheets(game, extra = {}) {
  const sheets = { info: new InfoSheet(game), ...extra };
  const elOf = (name) => (name === 'map' ? $('map-ui') : $(`sheet-${name}`));
  game.sheets = sheets;
  game.sheet = null;

  game.openSheet = (name) => {
    if (game.state !== 'playing') return;
    const s = sheets[name];
    if (!s) return;
    if (name === 'sandbox' && game.mode !== 'sandbox') {
      game.hud.log('Sandbox tools are only in sandbox mode', 'info');
      return;
    }
    if (game.sheet) game.closeSheet();
    game.sheet = name;
    game.input.releaseLock();
    const el = elOf(name);
    if (el) el.hidden = false;
    game.hud.el.hud.hidden = true;
    s.open?.();
  };

  game.closeSheet = () => {
    if (!game.sheet) return;
    const name = game.sheet;
    sheets[name]?.close?.();
    const el = elOf(name);
    if (el) el.hidden = true;
    game.sheet = null;
    game.hud.setMode(game.hud.mode);
    game.last = performance.now();
  };

  Object.defineProperty(game, 'sheetPauses', { get: () => !!game.sheet || !!game.photoOn });

  for (const btn of document.querySelectorAll('[data-close]')) btn.addEventListener('click', () => game.closeSheet());

  const prev = game.everyFrame;
  game.everyFrame = (dt) => {
    prev?.(dt);
    if (game.sheet) sheets[game.sheet]?.update?.(dt);
  };
}
