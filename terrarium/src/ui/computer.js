// The lab computer: shop (gadget parts, pets, bugs), sell gadgets online, bank, computer jobs,
// spy cameras (cage + street), and the news log.
import { h, clear, btn } from './dom.js';
import { CORES, BODIES, complexity } from '../gadgets/parts.js';
import { BUGS } from '../life/bugs.js';
import { sfx } from '../core/audio.js';
import { fmtMoney, rand } from '../core/util.js';

const TIER_PRICE = [0, 80, 200, 500];
export const JOBS_PC = [
  { name: 'Fix a bug in a website', hours: 2, pay: 60 },
  { name: 'Grade chemistry homework', hours: 3, pay: 85 },
  { name: 'Design a phone case', hours: 3, pay: 95 },
  { name: 'Write a science paper', hours: 5, pay: 180 },
  { name: 'Analyze DNA samples for a lab', hours: 6, pay: 240 },
  { name: 'Hack together a robot vacuum app', hours: 4, pay: 150 },
];
export const CAMS = [
  { name: 'Cage cam 1: front glass', pos: [0, 1.25, 0.45], look: [0, 1.0, -0.6] },
  { name: 'Cage cam 2: overhead', pos: [0, 2.6, -0.45], look: [0, 0.9, -0.5] },
  { name: 'Cage cam 3: tiny-eye view', pos: [-0.9, 0.9, 0.05], look: [0.3, 0.86, -0.7] },
  { name: 'Lab corner', pos: [6.5, 2.9, 5.5], look: [0, 0.6, -0.5] },
  { name: 'Front door (outside)', pos: [3, 6.2, 10], look: [0, 3.6, 6] },
  { name: 'Street corner', pos: [24, 7.5, 24], look: [5, 3.5, 17] },
];

export function buildComputer(ui) {
  const g = ui.g;
  g.unlocks = g.unlocks || new Set();

  const computer = (tab = 'shop') => {
    const tabs = h('div', { class: 'tabs' });
    const body = h('div', { class: 'col' });
    const TABS = [['shop', 'Shop'], ['sell', 'Sell online'], ['bank', 'Bank'], ['jobs', 'Jobs'], ['cams', 'Cameras'], ['news', 'News']];
    const money = g.mode === 'money';
    const draw = () => {
      clear(tabs);
      for (const [k, l] of TABS) tabs.append(h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, l));
      clear(body);
      if (money) body.append(h('div', { class: 'money', style: { marginBottom: '6px' } }, `Wallet ${fmtMoney(g.money)}${g.bank ? '   ·   Bank ' + fmtMoney(g.bank) : ''}`));
      else body.append(h('div', { class: 'muted' }, 'Creative mode: everything is free and unlocked.'));
      if (tab === 'shop') {
        body.append(h('b', {}, 'Gadget parts'));
        const grid = h('div', { class: 'shopgrid' });
        for (const [k, c] of Object.entries(CORES)) {
          if (c.tier === 0) continue;
          const own = !money || g.unlocks.has('core:' + k);
          grid.append(h('div', { class: 'shopitem' }, h('b', { style: { color: '#' + c.color.toString(16).padStart(6, '0') } }, c.label + ' core'), h('div', { class: 'muted' }, c.desc), own ? h('span', { class: 'tag' }, 'owned') : h('span', { class: 'price' }, fmtMoney(TIER_PRICE[c.tier])),
            own ? null : btn('Buy', () => { if (!g.spend(TIER_PRICE[c.tier], c.label + ' core')) return; g.unlocks.add('core:' + k); sfx('cash'); draw(); }, 'small')));
        }
        for (const [k, b] of Object.entries(BODIES)) {
          if (!b.price) continue;
          const own = !money || g.unlocks.has('body:' + k);
          grid.append(h('div', { class: 'shopitem' }, h('b', {}, b.label + ' body'), h('div', { class: 'muted' }, b.desc), own ? h('span', { class: 'tag' }, 'owned') : h('span', { class: 'price' }, fmtMoney(b.price)),
            own ? null : btn('Buy', () => { if (!g.spend(b.price, b.label + ' body')) return; g.unlocks.add('body:' + k); sfx('cash'); draw(); }, 'small')));
        }
        body.append(grid, h('b', { style: { marginTop: '10px' } }, 'Pets (they live in the lab)'));
        const pets = h('div', { class: 'shopgrid' });
        for (const [k, d] of Object.entries(BUGS)) {
          if (!d.pet) continue;
          pets.append(h('div', { class: 'shopitem' }, h('b', {}, d.label), h('div', { class: 'muted' }, d.desc || ''), money ? h('span', { class: 'price' }, fmtMoney(d.price)) : null,
            btn('Buy', () => {
              if (!g.spend(money ? d.price : 0, d.label)) return;
              const pos = g.player.pos.clone(); pos.x += 0.8; pos.y = 0.05;
              const pet = g.spawnBug(k, pos, 1);
              if (pet) { pet.name = d.names ? rand.pick(d.names) : d.label; pet.tame = 100; g.feed(`Your new ${d.label.toLowerCase()} ${pet.name} arrived in a box`, 'warm'); }
              sfx('cash'); ui.close();
            }, 'small')));
        }
        body.append(pets);
      } else if (tab === 'sell') {
        const all = [...g.player.hotbar.map((t, i) => ({ t, where: 'slot', i })), ...g.backpack.map((t, i) => ({ t, where: 'pack', i }))].filter((x) => x.t && typeof x.t === 'object' && !x.t.potion);
        body.append(h('div', { class: 'muted' }, 'Sell a gadget you built right now, or list a blueprint: people order copies every day and you get paid each morning.'));
        const grid = h('div', { class: 'shopgrid' });
        for (const x of all) {
          const v = Math.round(complexity(x.t) * 0.8);
          grid.append(h('div', { class: 'shopitem' }, h('b', {}, x.t.name), h('div', { class: 'muted' }, x.t.cores.map((k) => CORES[k].label).join(' + ')), h('span', { class: 'price' }, fmtMoney(v)), btn('Sell it', () => {
            if (!confirm(`Sell ${x.t.name} for ${fmtMoney(v)}?`)) return;
            if (x.where === 'slot') { g.player.hotbar[x.i] = null; g.player.setGadgetMesh(); } else g.backpack.splice(x.i, 1);
            if (money) g.addMoney(v, `Sold ${x.t.name}`); else ui.toast('Sold (money only counts in Money mode).');
            draw();
          }, 'small')));
        }
        if (!all.length) grid.append(h('div', { class: 'muted' }, 'No gadgets to sell.'));
        body.append(grid, h('b', { style: { marginTop: '10px' } }, 'Listed blueprints'));
        g.listings = g.listings || [];
        const lg = h('div', { class: 'chips' });
        for (const b of g.blueprints) {
          const listed = g.listings.some((l) => l.name === b.name);
          lg.append(h('span', { class: 'chip' + (listed ? ' on' : ''), onclick: () => { if (listed) g.listings = g.listings.filter((l) => l.name !== b.name); else g.listings.push({ name: b.name, value: complexity(b), sold: 0 }); draw(); } }, `${b.name} · ${fmtMoney(complexity(b))}${listed ? ' (listed)' : ''}`));
        }
        body.append(lg, h('div', { class: 'muted' }, `${g.listings.length} listed. Sold so far: ${g.listings.reduce((s, l) => s + l.sold, 0)}.`));
      } else if (tab === 'bank') {
        g.bank = g.bank || 0;
        const amt = h('input', { type: 'number', class: 'txt', value: 100, min: 1, style: { width: '120px' } });
        body.append(
          h('div', {}, `In the bank: ${fmtMoney(g.bank)}. It earns 2% every in-game day.`),
          h('div', { class: 'row' }, amt,
            btn('Deposit', () => { const n = Math.min(g.money, Math.max(0, Number(amt.value) || 0)); if (!n) return; g.money -= n; g.bank += n; sfx('cash'); draw(); }),
            btn('Withdraw', () => { const n = Math.min(g.bank, Math.max(0, Number(amt.value) || 0)); if (!n) return; g.bank -= n; g.money += n; sfx('cash'); draw(); })),
          money ? null : h('div', { class: 'muted' }, 'The bank only matters in Money mode.'),
        );
      } else if (tab === 'jobs') {
        body.append(h('div', { class: 'muted' }, 'Work from the lab. Time flies while you work (the cage keeps living at 20x).'));
        const grid = h('div', { class: 'shopgrid' });
        for (const j of JOBS_PC) grid.append(h('div', { class: 'shopitem' }, h('b', {}, j.name), h('div', { class: 'muted' }, `${j.hours} hours`), h('span', { class: 'price' }, fmtMoney(j.pay)), btn('Do it', () => { ui.close(); g.startJob(j); }, 'small')));
        body.append(grid);
      } else if (tab === 'cams') {
        body.append(h('div', { class: 'muted' }, 'Spy cameras. Watch without them seeing you. Left/right arrows switch cameras, Esc to stop.'));
        body.append(h('div', { class: 'grid3' }, CAMS.map((c, i) => h('div', { class: 'card click', onclick: () => { ui.close(true); g.startCams(i); } }, h('b', {}, c.name)))));
      } else if (tab === 'news') {
        const list = h('div', { class: 'col', style: { maxHeight: '55vh', overflow: 'auto' } });
        for (const n of [...g.news].reverse().slice(0, 120)) list.append(h('div', { class: 'feed', style: { position: 'static', width: 'auto' } }, h('div', { class: 'item ' + (n.kind || '') }, `Day ${n.day}: ${n.text}`)));
        body.append(list);
      }
    };
    draw();
    ui.showModal('computer', { title: 'Lab computer', body, tabs, wide: true });
  };

  // every new day: listed gadgets sell, the bank pays interest
  const dailyMoney = () => {
    if (g.mode !== 'money') return;
    let total = 0;
    for (const l of g.listings || []) { const n = Math.floor(rand() * 3); l.sold += n; total += n * Math.round(l.value * 0.35); }
    if (total) g.addMoney(total, 'Online gadget sales');
    if (g.bank) { const i = Math.round(g.bank * 0.02); g.bank += i; if (i) g.feed(`The bank paid you ${fmtMoney(i)} interest.`, 'warm'); }
  };

  return { computer, dailyMoney };
}
