/* Task manager: what's running on the PC, how much it uses, and End task (closes it nicely, then for real
   if it hides in the tray like Discord). Light: one quick check every 5 seconds, only while it's open. */
import { h } from './dom.js';
import { icon } from './icons.js';
import { modal } from './modal.js';
import { Sound } from './sound.js';

export function openTasks(toast) {
  const head = h('div.tm-head', 'Checking…');
  const list = h('div.tm-list');
  let timer = null, open = true, busy = false;
  const ending = new Set();
  const gb = function (mb) { return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB'; };

  async function refresh() {
    if (!open || busy) return;
    busy = true;
    let r = null;
    try { r = await window.gs.invoke('tasks:list'); } catch (e) { r = null; }
    busy = false;
    if (!open || !r) return;
    head.textContent = '';
    head.append(
      h('span', h('b', (r.busy.cpu || 0) + '%'), ' CPU'),
      h('span', h('b', gb(r.busy.totalMb - r.busy.freeMb)), ' of ' + gb(r.busy.totalMb) + ' memory used'),
      h('span.me', 'Game System 3: ', h('b', r.self.cpu + '%'), ' CPU, ' + gb(r.self.ramMb)));
    const had = list.querySelector('.focus');
    const focusKey = had && had.dataset.key;
    list.textContent = '';
    r.apps.forEach(function (a) {
      const end = h('button.btn.tm-end', { 'data-f': '', dataset: { key: a.key }, onclick: function () { endTask(a, end); } },
        h('span', { html: icon('x') }), ending.has(a.key) ? 'Ending…' : 'End task');
      if (ending.has(a.key)) end.disabled = true;
      list.appendChild(h('div.tm-row',
        h('div.tm-name', a.name, a.count > 1 ? h('span.n', a.count + ' parts') : null),
        h('div.tm-cpu' + (a.cpu >= 10 ? '.hot' : ''), a.cpu + '%'),
        h('div.tm-ram' + (a.ramMb >= 1024 ? '.hot' : ''), gb(a.ramMb)),
        end));
    });
    if (!r.apps.length) list.appendChild(h('div.gp-empty', 'Nothing else is running.'));
    if (focusKey) { const again = list.querySelector('[data-key="' + focusKey + '"]'); if (again) m.focus(again); }
    else m.refocus();
  }

  async function endTask(a, btn) {
    if (ending.has(a.key)) return;
    Sound.press();
    ending.add(a.key);
    btn.disabled = true;
    btn.lastChild.textContent = 'Ending…';
    const r = await window.gs.invoke('tasks:end', a.key);
    ending.delete(a.key);
    if (toast) toast(r && r.ok ? { kind: 'good', text: 'Closed ' + a.name + (r.forced ? ' (it didn\'t want to, so I made it)' : '') } : { kind: 'warn', text: 'Couldn\'t close ' + a.name + '. Windows may need admin for that one.' });
    refresh();
  }

  const m = modal({
    title: 'Task manager', lead: 'What\'s running on your PC. End task closes it (for real, even apps that hide in the taskbar corner).',
    body: h('div', head, h('div.tm-cols', h('span', 'App'), h('span', 'CPU'), h('span', 'Memory'), h('span')), list), wide: true,
    onClose: function () { open = false; clearInterval(timer); }
  });
  refresh();
  timer = setInterval(refresh, 5000);
  return m;
}
