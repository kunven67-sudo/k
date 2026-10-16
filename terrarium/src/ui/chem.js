// The chem set: make your own potions the same way as gadgets (mix effects + sliders, or describe it).
// Throw a potion (click) to splash whoever it hits, or press the flip key (R) to drink it yourself.
import { h, clear, btn, slider } from './dom.js';
import { CORES } from '../gadgets/parts.js';
import { settings } from '../core/settings.js';
import { sfx } from '../core/audio.js';
import { fmtMoney, nextId } from '../core/util.js';
import { claudeInvent } from '../talk/llm.js';
import { parseGadget } from './workbench.js';

const POTION_EFFECTS = ['love', 'hate', 'fear', 'rage', 'joy', 'sad', 'calm', 'heal', 'poison', 'sleep', 'speed', 'slow', 'invisible', 'bouncy', 'mutate', 'gravity', 'sticky', 'mind', 'shrink', 'grow', 'freeze', 'fire', 'shield', 'clone'];

function mixColor(effects) {
  let r = 0, g = 0, b = 0;
  for (const k of effects) { const c = CORES[k].color; r += (c >> 16) & 255; g += (c >> 8) & 255; b += c & 255; }
  const n = Math.max(1, effects.length);
  return ((r / n) << 16) | ((g / n) << 8) | (b / n);
}

export function buildChem(ui) {
  const g = ui.g;
  const chem = () => {
    const o = { name: 'My potion', effects: ['love'], power: 5, area: 2, time: 5, count: 3 };
    const body = h('div', { class: 'col' });
    const draw = () => {
      clear(body);
      const nameInp = h('input', { type: 'text', class: 'txt', value: o.name, maxlength: 26 });
      nameInp.addEventListener('input', () => { o.name = nameInp.value; });
      const desc = h('input', { type: 'text', class: 'txt', placeholder: 'Or describe it: "makes them fall in love and dance"', style: { flex: 1 } });
      const color = mixColor(o.effects);
      body.append(
        h('div', { class: 'row' }, desc, btn('Mix it', async () => {
          const text = desc.value.trim();
          if (!text) return;
          let out;
          if (settings.brain === 'claude' && settings.claudeKey) {
            try { out = await claudeInvent('potion', text, { bodies: ['wand'], cores: POTION_EFFECTS, mods: ['burst'], objects: ['chair'] }); ui.toast(out.explain || 'Mixed.'); } catch (e) { ui.toast(e.message); out = parseGadget(text); }
          } else out = parseGadget(text);
          o.effects = (out.cores || []).filter((k) => POTION_EFFECTS.includes(k)).slice(0, 3);
          if (!o.effects.length) o.effects = ['joy'];
          o.name = out.name ? out.name.replace(/(Pistol|Rifle|Wand|Cannon|Staff|Trap pad|Power glove|Grenade launcher)$/i, 'Potion').trim() : o.name;
          o.power = out.power || 5; o.time = out.time || 5;
          sfx('bubble'); draw();
        }, 'primary')),
        h('label', { class: 'field' }, 'Name', nameInp),
        h('div', { class: 'muted' }, 'Ingredients (pick 1 to 3 effects)'),
        h('div', { class: 'chips' }, POTION_EFFECTS.map((k) => h('span', { class: 'chip' + (o.effects.includes(k) ? ' on' : ''), title: CORES[k].desc, onclick: () => {
          if (o.effects.includes(k)) { if (o.effects.length > 1) o.effects = o.effects.filter((x) => x !== k); } else if (o.effects.length < 3) o.effects.push(k); else { ui.toast('3 effects max.'); return; }
          draw();
        } }, h('i', { style: { background: '#' + CORES[k].color.toString(16).padStart(6, '0') } }), CORES[k].label))),
        h('div', { class: 'statgrid' },
          h('span', {}, 'Strength'), slider(1, 10, 1, o.power, (v) => { o.power = v; }), h('span'),
          h('span', {}, 'Splash size'), slider(1, 10, 1, o.area, (v) => { o.area = v; }), h('span'),
          h('span', {}, 'Lasts'), slider(1, 10, 1, o.time, (v) => { o.time = v; }, (v) => (v >= 10 ? 'forever' : v)), h('span'),
          h('span', {}, 'Bottles'), slider(1, 10, 1, o.count, (v) => { o.count = v; }), h('span'),
        ),
        h('div', { class: 'row' }, h('div', { style: { width: '46px', height: '62px', borderRadius: '10px 10px 18px 18px', background: `linear-gradient(180deg, rgba(255,255,255,.15) 0 22%, #${color.toString(16).padStart(6, '0')} 22%)`, border: '2px solid rgba(255,255,255,.4)', boxShadow: `0 0 20px #${color.toString(16).padStart(6, '0')}` } }), h('div', { class: 'muted' }, o.effects.map((k) => CORES[k].desc).join(' + '))),
        g.mode === 'money' ? h('div', { class: 'muted' }, `Ingredients cost ${fmtMoney(o.effects.length * 6 * o.count)}`) : null,
      );
    };
    draw();
    ui.showModal('chem', {
      title: 'Chem set', body, wide: true,
      buttons: [['Brew', () => {
        if (!g.spend(g.mode === 'money' ? o.effects.length * 6 * o.count : 0, `Brewed ${o.name}`)) return;
        const pot = { potion: true, id: 'pot' + nextId(), name: o.name || 'Potion', effects: [...o.effects], power: o.power, area: o.area, time: o.time, uses: o.count, color: mixColor(o.effects) };
        const pl = g.player;
        const free = pl.hotbar.findIndex((t, i) => i >= 2 && i <= 7 && !t);
        if (free >= 0) { pl.hotbar[free] = pot; pl.setGadgetMesh(); ui.toast(`Brewed ${pot.uses} bottles of ${pot.name}. Slot ${free + 1}: click to throw, ${settings.keys.flip.replace('Key', '')} to drink.`); }
        else { g.backpack.push(pot); ui.toast(`Brewed ${pot.name}. It's in your backpack (Tab).`); }
        sfx('bubble'); sfx('steam');
        ui.close();
      }, 'primary']],
    });
  };
  return { chem };
}
