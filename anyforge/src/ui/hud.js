// What sits on top of the game: tool bar, hints, the name of what you point at, messages.
import { TOOLS, ICONS, T } from '../tools/tools.js';
import { game } from '../game.js';

const $ = (id) => document.getElementById(id);
export function buildToolbar() {
  const bar = $('toolbar');
  bar.textContent = '';
  for (const t of TOOLS) {
    const d = document.createElement('div');
    d.className = 'tool' + (T.tool === t.id ? ' on' : '');
    d.dataset.tool = t.id;
    d.innerHTML = `<span class="k">${t.key.replace('Digit', '')}</span>${ICONS[t.id]}<span>${t.name}</span>`;
    bar.appendChild(d);
  }
}
export function markTool() {
  for (const d of document.querySelectorAll('#toolbar .tool')) d.classList.toggle('on', d.dataset.tool === T.tool);
  setHints();
}
const HINTS = {
  build: () => [['Click', 'Place ' + T.def.name], ['Right click', 'Copy a part'], ['Wheel', 'Size'], ['R', 'Turn'], ['Tab', 'All parts']],
  grab: () => T.hold ? [['Let go', 'Drop / throw'], ['Wheel', 'Closer / farther'], ['Hold R + mouse', 'Turn it'], ['Right click', 'Freeze in the air']] : [['Hold click', 'Grab'], ['Right click', 'Freeze / unfreeze a build']],
  edit: () => [['Click', 'Change it (size, material, settings, brain)'], ['Wheel', 'Resize the side you point at']],
  paint: () => [['Click', 'Paint'], ['Shift + click', 'Paint the whole build'], ['Right click', 'Pick a color'], ['Tab', 'Colors']],
  wire: () => T.wireFrom ? [['Click', 'What it should turn on'], ['Click empty space', 'Cancel']] : [['Click', 'Start at a button / switch / sensor / timer'], ['Right click', 'Remove wires']],
  delete: () => [['Click', 'Delete a part'], ['Right click', 'Delete the whole build'], ['Z', 'Undo']],
  hand: () => [['Click', 'Punch / push'], ['Right click or E', 'Use']],
  scale: () => [['Click', 'Grow the build'], ['Right click', 'Shrink the build']]
};
export function setHints() {
  const h = $('hint');
  if (!game.settings.hints || game.inVR) { h.textContent = ''; return; }
  let list;
  if (game.seated) list = [['W A S D', 'Drive'], ['Space / C', 'Up / down'], ['1-4  X  L  H', 'Switches'], ['V', 'Camera'], ['F', 'Get out']];
  else if (game.remoteOn) list = [['W A S D', 'Drive'], ['Space / C', 'Up / down'], ['1-4', 'Switches'], ['E', 'Stop driving']];
  else list = HINTS[T.tool]();
  h.innerHTML = list.map(([k, d]) => `<span><b>${k}</b>${d}</span>`).join('');
}
export function aimLabel(text) {
  const a = $('aim');
  if (a.textContent !== text) a.textContent = text;
  a.classList.toggle('on', !!text);
}
export function toast(msg, ms = 2200) {
  const box = $('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
}
export function status(list) {
  const s = $('status');
  const html = list.map(([cls, t]) => `<span class="${cls}">${t}</span>`).join('');
  if (s.innerHTML !== html) s.innerHTML = html;
}
export function seatHud(text) {
  const s = $('seathud');
  if (!text) { s.hidden = true; return; }
  s.hidden = false;
  if (s.innerHTML !== text) s.innerHTML = text;
}
export function hurtFlash(v) { $('hurt').style.opacity = String(Math.min(1, v)); }
