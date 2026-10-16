// The lab's machines and your tools: cage control panel, supply shelf, spawn machine, changer,
// backpack, mind headband. (Workbench, computer, chem set and experiment table have their own files.)
import * as THREE from 'three';
import { h, clear, btn, seg, slider, toggle, setrow, colorInput, hex } from './dom.js';
import { settings } from '../core/settings.js';
import { sfx } from '../core/audio.js';
import { fmtMoney, rand } from '../core/util.js';
import { lockPointer } from '../core/input.js';
import { THEMES, NAT, CAGE } from '../world/cage.js';
import { ITEMS, SUPPLY, TINY } from '../life/items.js';
import { BUGS } from '../life/bugs.js';
import { JOBS, JOB_KEYS, TRAITS, SKIN, HAIR_COLORS, CLOTH, PANTS, makeLook } from '../life/looks.js';
import { HAIR_STYLES } from '../life/parts.js';
import { FORMS } from '../player/player.js';
import { CORES } from '../gadgets/parts.js';
import { buildWorkbench } from './workbench.js';
import { buildComputer } from './computer.js';
import { buildChem } from './chem.js';
import { buildExpTable } from './exptable.js';

export function buildPanels(ui) {
  const g = ui.g;
  const P = {};
  const price = (n) => (g.mode === 'money' ? ` ${fmtMoney(n)}` : '');

  // ------------------------------------------------------------- cage control panel
  P.panel = (tab = 'weather') => {
    const tabs = h('div', { class: 'tabs' });
    const body = h('div', { class: 'col' });
    const c = g.cage, W = c.weather;
    const TABS = [['weather', 'Weather + light'], ['time', 'Time'], ['cage', 'Lid + glass'], ['terrain', 'Terrain brush'], ['bugs', 'Drop in bugs'], ['you', 'Go inside']];
    const draw = () => {
      clear(tabs);
      for (const [k, l] of TABS) tabs.append(h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; draw(); } }, l));
      clear(body);
      if (tab === 'weather') {
        const w = (key, label, hint, on = () => {}) => setrow(label, toggle(!!W[key], (v) => { W[key] = v ? 1 : 0; on(v); sfx('click'); }), hint);
        body.append(
          w('rain', 'Rain', 'Sprinklers in the lid. Puts out fires, fills the pond a little.'),
          w('snow', 'Snow', 'Cold. Snow piles up, the pond freezes. They need fire, clothes and shelter.'),
          w('heat', 'Heat lamp', 'Hot and dry. They get thirsty fast. Melts snow.'),
          w('fog', 'Fog', 'Fog machine.'),
          w('storm', 'Thunderstorm', 'Lightning strikes can kill and start fires.'),
          w('quake', 'Earthquake', 'Shakes the table. People fall over, buildings crack.'),
          w('flood', 'Flood', 'The water rises. People who can\'t get to high ground drown.'),
          w('wind', 'Wind fan', 'Blows from the right side.'),
          setrow('Lava vent', h('span', { class: 'row' }, btn('Open a lava vent', () => { const s = g.randomCageSpot(0.15); c.addLava(s.x, s.z); g.feed('A lava vent opened in the cage!', 'bad'); sfx('fire'); }), btn('Cool all lava', () => { c.clearLava(); sfx('steam'); })), 'Burns anything that walks in.'),
          setrow('Cage lamp (their sun)', seg([['auto', 'Follows the clock'], ['on', 'Always on'], ['off', 'Off']], W.lamp, (v) => { W.lamp = v; })),
          setrow('Lab lights', seg([['auto', 'Auto'], ['on', 'On'], ['off', 'Off (dark lab)']], g.world.labLights, (v) => { g.world.labLights = v; })),
        );
      } else if (tab === 'time') {
        body.append(
          setrow('Cage time speed', seg([[0, 'Pause'], [0.25, '0.25x'], [0.5, 'Slow'], [1, '1x'], [2, '2x'], [5, '5x'], [20, '20x']], g.world.speed, (v) => { g.world.speed = v; }), `Also ${settings.keys.slower.replace('Comma', ',')} / ${settings.keys.faster.replace('Period', '.')} keys. At 1x a whole day is 16 minutes.`),
          setrow('Set the time', h('span', { class: 'row' }, ...[[7, 'Morning'], [12, 'Noon'], [18.5, 'Sunset'], [22, 'Night']].map(([t, l]) => btn(l, () => { if (t < g.world.time) g.world.day++; g.world.time = t; sfx('click'); }, 'small')))),
          h('div', { class: 'muted' }, 'They sleep at night (the cage lamp goes dark when the clock says night).'),
        );
      } else if (tab === 'cage') {
        body.append(
          setrow('Lid', seg([[false, 'Closed'], [true, 'Off (wide open)']], c.lidOpen, (v) => { c.setLid(v); sfx('slide'); }), 'With the lid off you can reach in with your hand. They could climb out if they build something tall...'),
          setrow('Hatch', seg([[false, 'Closed'], [true, 'Open']], c.hatchOpen, (v) => { c.setHatch(v); sfx('click'); }), 'A small square door in the lid. Drop things through it.'),
          setrow('Glass', h('span', { class: 'row' }, h('span', {}, `${Math.round(c.glassHP)}/100${c.broken ? ' (CRACKED THROUGH)' : ''}`), btn('Repair the glass' + price(50), () => { if (c.glassHP >= 100) { ui.toast('The glass is fine.'); return; } if (!g.spend(g.mode === 'money' ? 50 : 0, 'Glass repair')) return; g.repairGlass(); sfx('glass'); ui.toast('Glass repaired.'); draw(); }, 'small')), 'Strength is in Settings > Gameplay.'),
          setrow('Graffiti on the glass', btn('Wipe it off', () => { c.graffiti = []; g.rebuildGraffiti(); sfx('steam'); ui.toast('Wiped. They might be mad about it.'); for (const p of g.people) if (p.alive && p.inCage && !p.kid) p.op -= 2; }, 'small')),
          setrow('Rebuild the cage', h('span', { class: 'row' }, Object.entries(THEMES).map(([k, l]) => btn(l, () => {
            if (!confirm(`Replace the terrain with "${l}"? Buildings get flattened. People stay.`)) return;
            for (const b of [...g.society.buildings]) g.society.remove(b);
            c.generate(k, (Math.random() * 1e9) | 0);
            for (const p of g.people) if (p.inCage) { const s = g.randomCageSpot(); g.moveEntity({ kind: 'person', ref: p }, s); }
            g.nav.rebuild(); g.rebuildShore();
            g.feed(`You rebuilt the cage as ${l}.`, 'warm');
            for (const p of g.people) if (p.alive && p.inCage) p.remember('rebuild', 'The world changed overnight. Everything we built is gone.', -30, 'player');
          }, 'small')))),
        );
      } else if (tab === 'terrain') {
        const b = g.brush || { tool: 'raise', radius: 0.08, strength: 1 };
        const tools = [['raise', 'Raise'], ['lower', 'Dig'], ['smooth', 'Smooth'], ['flatten', 'Flatten'], ['paint:grass', 'Grass'], ['paint:dirt', 'Dirt'], ['paint:sand', 'Sand'], ['paint:snow', 'Snow'], ['paint:rock', 'Rock'], ['paint:farm', 'Farm soil'], ['paint:mud', 'Mud']];
        const nat = Object.entries(NAT).map(([k, v]) => ['nat:' + k, v.label]).concat([['erase', 'Remove plants/rocks']]);
        body.append(
          setrow('Shape + paint', seg(tools, b.tool, (v) => { b.tool = v; })),
          setrow('Place nature', seg(nat, b.tool, (v) => { b.tool = v; })),
          setrow('Size', slider(0.02, 0.3, 0.01, b.radius, (v) => { b.radius = v; }, (v) => Math.round(v * 100) + ' cm')),
          setrow('Strength', slider(0.2, 3, 0.1, b.strength, (v) => { b.strength = v; }, (v) => v.toFixed(1))),
          h('div', { class: 'muted' }, 'Pick a tool, press "Use brush", then hold left click on the cage. Right click puts it away. Dig below the water line for ponds and rivers.'),
          h('div', { class: 'row' }, btn('Use brush', () => { g.brush = b; ui.close(); ui.toast('Hold left click on the cage to use the brush. Right click to stop.'); }, 'primary')),
        );
      } else if (tab === 'bugs') {
        const grid = h('div', { class: 'shopgrid' });
        for (const [k, d] of Object.entries(BUGS)) {
          if (d.pet) continue;
          grid.append(h('div', { class: 'shopitem' }, h('b', {}, d.label), h('div', { class: 'muted' }, `${Math.round(d.len * 1000)} mm long${d.hunter ? ' · hunts people' : ''}${d.poison ? ' · venom' : ''}`), g.mode === 'money' ? h('div', { class: 'price' }, fmtMoney(d.price)) : null,
            btn('Drop one in', () => { if (!g.spend(g.mode === 'money' ? d.price : 0, d.label)) return; const s = g.randomCageSpot(0.1); g.spawnBug(k, s.add(new THREE.Vector3(0, 0.05, 0)), 1); g.feed(`You dropped a ${d.label.toLowerCase()} in the cage`, d.hunter ? 'bad' : ''); sfx('drop'); }, 'small')));
        }
        body.append(grid, h('div', { class: 'muted' }, 'A praying mantis is twice as tall as they are. Bugs eat the dead, hunters hunt the living.'));
      } else if (tab === 'you') {
        body.append(
          h('div', { class: 'muted' }, 'The panel has a little teleporter wired into the cage. You can also shrink with your watch and climb in through the hatch.'),
          h('div', { class: 'row' },
            btn('Shrink me and put me inside', () => { const s = g.randomCageSpot(0.2); g.player.setScale(TINY * 1.02); g.player.targetScale = g.player.scale; g.player.pos.copy(s); g.player.vel.set(0, 0, 0); sfx('teleport'); ui.close(); ui.toast('You\'re in the cage, their size. Hold X to grow (the lid stops you unless it\'s open).'); }, 'primary'),
            btn('Get me out (normal size)', () => { g.player.setScale(1); g.player.targetScale = 1; g.player.pos.set(1.95, 0, 1.6); g.player.vel.set(0, 0, 0); sfx('teleport'); ui.close(); }),
          ),
        );
      }
    };
    draw();
    ui.showModal('panel', { title: 'Cage control panel', body, tabs, wide: true });
  };

  // ------------------------------------------------------------- supply shelf
  P.supply = () => {
    const grid = h('div', { class: 'shopgrid' });
    for (const k of SUPPLY) {
      const d = ITEMS[k];
      if (!d) continue;
      const cost = d.price ?? 1;
      const what = d.give ? Object.entries(d.give).map(([r, n]) => `${r} ${n}`).join(', ') : d.weapon ? `weapon (${d.weapon.type})` : d.shelter ? `shelter for ${d.shelter}` : d.kind;
      grid.append(h('div', { class: 'shopitem' }, h('b', {}, d.label), h('div', { class: 'muted' }, what), g.mode === 'money' ? h('div', { class: 'price' }, fmtMoney(cost)) : null,
        btn('Take one', () => {
          if (!g.spend(g.mode === 'money' ? cost : 0, d.label)) return;
          const pl = g.player;
          if (pl.holding) pl.drop(true);
          pl.select(0);
          const it = g.spawnItem(k, pl.handHoldPoint(), 1);
          if (it && pl.grabTarget({ kind: 'item', ref: it })) { ui.close(); ui.toast(`You're holding a ${d.label.toLowerCase()}. Drop it in the cage (open the lid or the hatch).`); }
          else if (it) { it.pos.set(-2.65, 0.95, -0.4); ui.close(); ui.toast('Put it on the shelf.'); }
        }, 'small')));
    }
    ui.showModal('supply', { title: 'Supply shelf', body: h('div', { class: 'col' }, h('div', { class: 'muted' }, 'Real things from your world. To them a pencil is a giant log, a paperclip is a pile of metal, a crumb feeds the whole village.'), grid), wide: true });
  };

  // ------------------------------------------------------------- spawn machine
  P.spawner = () => {
    const o = { sex: rand() < 0.5 ? 'm' : 'f', job: rand.pick(JOB_KEYS), traits: [], name: '', shrink: true, custom: false, look: null };
    const body = h('div', { class: 'col' });
    const draw = () => {
      clear(body);
      const nameInp = h('input', { type: 'text', class: 'txt', placeholder: 'random name', value: o.name, maxlength: 20 });
      nameInp.addEventListener('input', () => { o.name = nameInp.value.trim(); });
      const jobSel = h('select', { class: 'txt' }, JOB_KEYS.map((k) => h('option', { value: k, selected: o.job === k }, JOBS[k].label)));
      jobSel.addEventListener('change', () => { o.job = jobSel.value; if (o.look) { const nl = makeLook({ sex: o.sex, job: o.job }); o.look.shirt = nl.shirt; o.look.top = nl.top; o.look.hat = nl.hat; o.look.hatColor = nl.hatColor; } });
      body.append(
        h('div', { class: 'muted' }, 'Makes a brand-new grown-up person. Pick everything, or leave it random. Kids are only ever born in the cage.'),
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, 'Name', nameInp),
          h('label', { class: 'field' }, 'Job (their skills)', jobSel),
        ),
        setrow('Body', seg([['m', 'Man'], ['f', 'Woman']], o.sex, (v) => { o.sex = v; if (o.look) o.look.sex = v; })),
        setrow('Personality (pick up to 4, or none = random)', h('div', { class: 'chips', style: { maxWidth: '600px' } }, Object.entries(TRAITS).map(([k, l]) => h('span', { class: 'chip' + (o.traits.includes(k) ? ' on' : ''), onclick: () => { if (o.traits.includes(k)) o.traits = o.traits.filter((x) => x !== k); else if (o.traits.length < 4) o.traits.push(k); draw(); } }, l)))),
        setrow('Looks', seg([[false, 'Random'], [true, 'Pick']], o.custom, (v) => { o.custom = v; if (v && !o.look) o.look = makeLook({ sex: o.sex, job: o.job }); draw(); })),
      );
      if (o.custom) {
        const L = o.look;
        const sw = (arr, key) => h('div', { class: 'row' }, arr.map((c) => h('span', { class: 'swatch' + (L[key] === c ? ' on' : ''), style: { background: hex(c) }, onclick: () => { L[key] = c; draw(); } })), colorInput(L[key], (c) => { L[key] = c; }));
        body.append(
          setrow('Skin', sw(SKIN, 'skin')),
          setrow('Hair', seg(HAIR_STYLES.map((s) => [s, s]), L.hair, (v) => { L.hair = v; })),
          setrow('Hair color', sw(HAIR_COLORS, 'hairColor')),
          setrow('Shirt', sw(CLOTH.slice(0, 10), 'shirt')),
          setrow('Pants', sw(PANTS, 'pants')),
          setrow('Height', slider(0.85, 1.15, 0.01, L.height, (v) => { L.height = v; }, (v) => Math.round(v * 175) + ' cm')),
          setrow('Build', slider(0, 1, 0.05, L.fat, (v) => { L.fat = v; }, (v) => (v < 0.3 ? 'skinny' : v < 0.6 ? 'normal' : 'big'))),
          setrow('Beard', toggle(!!L.beard, (v) => { L.beard = v && o.sex === 'm'; })),
          setrow('Glasses', toggle(!!L.glasses, (v) => { L.glasses = v; })),
        );
      }
      body.append(setrow('Then', seg([[true, 'Walk them into the shrink chamber'], [false, 'Leave them full size in the lab']], o.shrink, (v) => { o.shrink = v; }), o.shrink ? 'They come out tiny on the chamber tray.' : 'A full-size scared stranger in your lab. They might try to escape up the stairs.'));
    };
    draw();
    ui.showModal('spawner', {
      title: 'Spawn machine', body, wide: true, buttons: [
        ['Spawn 5 random straight into the cage' + price(250), () => { if (!g.spend(g.mode === 'money' ? 250 : 0, 'Spawn x5')) return; for (let i = 0; i < 5; i++) { const p = g.spawnCagePerson({ fear: 70, op: -15 }); p.remember('arrive', 'I woke up in a glass box', -20); } g.feed('5 new people appeared in the cage', 'warm'); sfx('teleport'); ui.close(); }],
        ['Spawn' + price(60), () => { g.spawnFromMachine({ sex: o.sex, job: o.job, traits: o.traits, name: o.name, look: o.custom ? { ...o.look, sex: o.sex } : null, shrink: o.shrink }); ui.close(); }, 'primary'],
      ],
    });
  };

  // ------------------------------------------------------------- changer
  P.changer = () => {
    const pl = g.player;
    const body = h('div', { class: 'col' });
    const grid = h('div', { class: 'grid3' });
    for (const [k, f] of Object.entries(FORMS)) {
      if (k === 'person') continue;
      grid.append(h('div', { class: 'card click' + (pl.form === k ? ' on' : ''), onclick: () => { pl.changeForm(k); ui.close(); } }, h('b', {}, f.label), h('div', { class: 'muted' }, f.desc)));
    }
    body.append(grid);
    const copyable = g.people.filter((p) => p.alive && !p.kid && p.scale < 0.2);
    body.append(h('div', { style: { marginTop: '10px' } }, h('b', {}, 'Copy a person'), h('div', { class: 'muted' }, FORMS.person.desc + ' Their friends and partner will think you ARE them, unless you act weird.')));
    body.append(h('div', { class: 'chips' }, copyable.length ? copyable.slice(0, 40).map((p) => h('span', { class: 'chip', onclick: () => { pl.changeForm('person', p); ui.close(); } }, p.name + ' ' + p.last)) : h('span', { class: 'muted' }, 'Nobody to copy yet.')));
    if (pl.disguise) body.append(h('div', { class: 'row', style: { marginTop: '10px' } }, btn('Tell them who you really are', () => { const near = g.people.filter((p) => p.alive && !p.kid && p.dist(pl.pos) < pl.height * 15)[0]; if (near) pl.revealDisguise(near); pl.changeForm('scientist'); ui.close(); }, 'danger')));
    ui.showModal('changer', { title: 'The changer', body, wide: true });
  };

  // ------------------------------------------------------------- backpack (Tab)
  P.backpack = () => {
    const pl = g.player;
    const body = h('div', { class: 'col' });
    let picked = null; // {from:'slot'|'pack', i}
    const label = (t) => (!t ? 'empty' : t === 'hand' ? 'Hand' : t === 'bottle' ? 'Glass bottle' : t === 'headband' ? 'Mind headband' : t.potion ? `${t.name} (potion x${t.uses ?? 1})` : t.name);
    const draw = () => {
      clear(body);
      body.append(h('div', { class: 'muted' }, picked ? 'Now click a belt slot or the backpack to move it there.' : 'Click something, then click where it should go. Your tool belt (1-9):'));
      body.append(h('div', { class: 'row' }, pl.hotbar.map((t, i) => h('div', { class: 'card click' + (picked && picked.from === 'slot' && picked.i === i ? ' on' : ''), style: { width: '100px', minHeight: '64px', fontSize: '12px' }, onclick: () => {
        if (!picked) { if (t) { picked = { from: 'slot', i }; } draw(); return; }
        const src = picked.from === 'slot' ? pl.hotbar[picked.i] : g.backpack[picked.i];
        if (picked.from === 'slot') { pl.hotbar[picked.i] = pl.hotbar[i]; pl.hotbar[i] = src; }
        else { g.backpack.splice(picked.i, 1); if (pl.hotbar[i]) g.backpack.push(pl.hotbar[i]); pl.hotbar[i] = src; }
        picked = null; pl.setGadgetMesh(); draw();
      } }, h('div', { class: 'muted' }, String(i + 1)), label(t)))));
      body.append(h('div', { style: { marginTop: '8px' } }, h('b', {}, `Backpack (${g.backpack.length})`)));
      const packRow = h('div', { class: 'row card click', style: { minHeight: '60px' }, onclick: () => {
        if (picked && picked.from === 'slot') { const t = pl.hotbar[picked.i]; if (t === 'hand') { ui.toast('Your hand stays on the belt.'); } else { g.backpack.push(t); pl.hotbar[picked.i] = null; pl.setGadgetMesh(); } picked = null; draw(); }
      } });
      g.backpack.forEach((t, i) => packRow.append(h('span', { class: 'chip' + (picked && picked.from === 'pack' && picked.i === i ? ' on' : ''), onclick: (e) => { e.stopPropagation(); picked = { from: 'pack', i }; draw(); } }, label(t), h('span', { class: 'muted', style: { marginLeft: '6px', cursor: 'pointer' }, onclick: (e) => { e.stopPropagation(); if (confirm(`Throw away ${label(t)}?`)) { g.backpack.splice(i, 1); picked = null; draw(); } } }, '×'))));
      if (!g.backpack.length) packRow.append(h('span', { class: 'muted' }, 'Empty. Make gadgets at the workbench and potions at the chem set.'));
      body.append(packRow);
    };
    draw();
    ui.showModal('backpack', { title: 'Backpack + tool belt', body, wide: true });
  };

  // ------------------------------------------------------------- mind control headband
  P.headband = (p) => {
    if (!p.alive) { ui.toast(`${p.name} is dead.`); return; }
    if (p.kid) { ui.toast('The headband won\'t go on a kid.'); return; }
    const body = h('div', { class: 'col' }, h('div', {}, `Put the mind-control headband on ${p.name}?`), h('div', { class: 'muted' }, 'They will remember everything afterward.'));
    ui.showModal('headband', {
      title: 'Mind headband', body, buttons: [
        ['Take over their body', () => { g.player.possess = p; p.mind = { mode: 'body' }; p.task = null; p.order = null; ui.close(); ui.toast(`You are ${p.name} now. WASD to move, click to attack, ${settings.keys.interact.replace('Key', '')} to leave their body.`); p.remember('mind', 'Something took over my body', -20, 'player'); sfx('electric'); }],
        ['Give orders they must obey (1 min)', () => { p.mind = { mode: 'orders', t: 60 }; ui.close(); ui.focusPerson = p; ui.toast(`${p.name} will obey anything you say for a minute. Press ${settings.keys.talk.replace('Key', '')} to talk.`); p.say('...Yes. What do you want?', { kind: 'chat' }); sfx('electric'); }, 'primary'],
        ['Cancel', () => ui.close()],
      ],
    });
  };

  // ------------------------------------------------------------- the others
  Object.assign(P, buildWorkbench(ui), buildComputer(ui), buildChem(ui), buildExpTable(ui));
  void lockPointer; void CAGE; void CORES;
  return P;
}
