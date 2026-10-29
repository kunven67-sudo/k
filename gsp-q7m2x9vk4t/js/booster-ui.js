/* The Booster popup: what's eating your PC (tick what to close), and Yes / No.
   Yes = close the ticked apps nicely + max power + the game gets the CPU first (and next time it does
   this by itself). No = nothing closes and it won't ask about this game again. */
import { h } from './dom.js';
import { icon } from './icons.js';
import { modal } from './modal.js';
import { Sound } from './sound.js';

export function askBoost(opts) {
  return new Promise(function (resolve) {
    const ticked = new Set();
    const list = h('div.bo-list');
    let answer = null;
    let power = true;
    (opts.procs || []).forEach(function (p) {
      const on = !p.never && (p.always || p.cpu >= 3 || p.ramMb >= 500);
      if (on) ticked.add(p.key);
      const box = h('div.bo-check' + (on ? '.on' : ''), { html: icon('check') });
      const mark = h('div.bo-mark', p.never ? 'never close' : p.always ? 'always close' : '');
      const row = h('div.bo-row', { 'data-f': '' },
        box,
        h('div.bo-name', p.name, h('span.bo-use', (p.cpu ? p.cpu + '% CPU · ' : '') + (p.ramMb >= 1024 ? (p.ramMb / 1024).toFixed(1) + ' GB' : p.ramMb + ' MB'))),
        mark,
        h('button.bo-mini', { title: 'Remember: always close ' + p.name, onclick: function (e) { e.stopPropagation(); remember(p, 'always'); } }, 'Always'),
        h('button.bo-mini', { title: 'Remember: never close ' + p.name, onclick: function (e) { e.stopPropagation(); remember(p, 'never'); } }, 'Never'));
      function setOn(v) { if (v) ticked.add(p.key); else ticked.delete(p.key); box.classList.toggle('on', v); }
      row.addEventListener('click', function () { Sound.move(); setOn(!ticked.has(p.key)); });
      function remember(pp, what) {
        Sound.press();
        const now = (what === 'always' && pp.always) || (what === 'never' && pp.never) ? 'forget' : what;
        window.gs.invoke('booster:remember', pp.key, now);
        pp.always = now === 'always';
        pp.never = now === 'never';
        mark.textContent = pp.never ? 'never close' : pp.always ? 'always close' : '';
        if (pp.never) setOn(false);
        if (pp.always) setOn(true);
      }
      list.appendChild(row);
    });
    if (!(opts.procs || []).length) list.appendChild(h('div.dim', { style: { padding: '10px 4px' } }, 'Nothing big is running. A boost can still help: max power + the game gets the CPU first.'));
    const pbox = h('div.bo-check.on', { html: icon('check') });
    const prow = h('div.bo-row.extra', { 'data-f': '' }, pbox, h('div.bo-name', 'Max power while playing', h('span.bo-use', 'Goes back to normal when the game closes')));
    prow.addEventListener('click', function () { power = !power; pbox.classList.toggle('on', power); Sound.move(); });
    const body = h('div', h('div.cgroup', 'Close these (they close nicely, like clicking their X)'), list, h('div.cgroup', 'Also'), prow);
    modal({
      title: opts.title,
      lead: opts.lead,
      body: body,
      onClose: function () { resolve(answer); },
      actions: [
        { label: 'No, don\'t ask again for this game', onClick: function () { answer = { yes: false }; } },
        { label: 'Yes, boost it', kind: 'primary', icon: 'zap', default: true, onClick: function () { answer = { yes: true, keys: Array.from(ticked), power: power }; } }
      ]
    });
  });
}

export function boostResultText(r) {
  if (!r) return 'Boosted';
  const bits = [];
  if (r.closed && r.closed.length) bits.push('closed ' + r.closed.length + (r.closed.length === 1 ? ' app' : ' apps'));
  if (r.power) bits.push('max power on');
  let t = 'Boosted' + (bits.length ? ': ' + bits.join(', ') : '');
  if (r.stubborn && r.stubborn.length) t += '. ' + r.stubborn.join(', ') + ' didn\'t want to close';
  return t;
}
