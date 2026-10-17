// Pause menu (Esc with nothing else open). Time stops while it's up.
//
//   openPause({ engine, onQuit })

import { el } from '../core/util.js';
import { save } from '../core/save.js';
import { clock } from '../core/clock.js';
import { openPanel } from './panel.js';
import { openSettings } from './settings.js';

export function openPause({ engine, onQuit }) {
  engine.paused = true;
  const life = save.life;
  const p = openPanel({
    title: 'Paused',
    sub: `${life.character.name} · age ${Math.floor(clock.age)} · ${clock.weekdayName} ${clock.timeText()}`,
    onClose: () => (engine.paused = false),
  });
  p.setBody([
    el('div', { class: 'rl-list' }, [
      el('button', { class: 'rl-btn go', onclick: () => p.close() }, ['Resume']),
      el('button', { class: 'rl-btn', onclick: () => openSettings() }, ['Settings']),
      el('button', { class: 'rl-btn', onclick: () => { save.commit(); saved.textContent = 'Saved.'; } }, ['Save']),
      el('button', { class: 'rl-btn', onclick: () => { save.commit(); p.close(); onQuit?.(); } }, ['Save + quit to main menu']),
    ]),
  ]);
  const saved = el('p', { class: 'rl-note', style: 'text-align:center' }, ['Your life also saves by itself at midnight and noon.']);
  p.el.querySelector('.rl-body').appendChild(saved);
  p.setButtons([]);
  return p;
}
