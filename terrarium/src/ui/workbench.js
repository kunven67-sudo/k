// The gadget workbench: endless gadgets from parts (body + up to 3 cores + mod + sliders), a live 3D
// preview built from the parts, type-a-description (built-in parser or your Claude key), blueprints.
import { h, put, clear, btn, slider, setrow, colorInput } from './dom.js';
import { BODIES, CORES, MODS, OBJECT_TYPES, DEFAULT_STATS, blueprint, complexity, instability } from '../gadgets/parts.js';
import { buildGadgetModel } from '../gadgets/model.js';
import { Preview } from './preview.js';
import { settings } from '../core/settings.js';
import { sfx } from '../core/audio.js';
import { fmtMoney, nextId } from '../core/util.js';
import { claudeInvent } from '../talk/llm.js';

// words -> parts, so "a rifle that freezes people and makes them float" just works without any AI
const CORE_WORDS = [
  [/black ?hole/, 'blackhole'], [/time ?stop|stop(s)? time|freeze(s)? time|pause(s)? time/, 'timestop'], [/shrink|small|tiny|smaller/, 'shrink'], [/grow|bigger|giant|huge|enlarge/, 'grow'],
  [/freez|ice|frost|cold/, 'freeze'], [/fire|burn|flame|lava|hot/, 'fire'], [/lightning|shock|electric|zap|taser/, 'lightning'], [/teleport|portal|warp/, 'teleport'],
  [/turn(s)? (them |people |someone |him |her )?into|object|chair|cup|toilet|pumpkin|statue|teddy|shoe|brick|pillow|lamp|trophy|book/, 'object'], [/float|fly|anti.?grav|levitat/, 'gravity'], [/heavy|pin|crush|weigh/, 'heavy'],
  [/push|blast|knock|launch|yeet/, 'push'], [/pull|drag|tractor|reel/, 'pull'], [/love|crush on|romance/, 'love'], [/hate/, 'hate'], [/scare|fear|terrif|afraid/, 'fear'],
  [/rage|angry|mad|furious|fight/, 'rage'], [/happy|joy|dance|laugh/, 'joy'], [/sad|cry|depress/, 'sad'], [/calm|peace|chill|relax/, 'calm'], [/mind|control|obey|hypno/, 'mind'],
  [/clone|copy|duplicate/, 'clone'], [/heal|fix|cure|medic/, 'heal'], [/poison|sick|toxic|venom/, 'poison'], [/sleep|knock.?out|tranq|faint/, 'sleep'], [/explo|bomb|boom|nuke|grenade/, 'explode'],
  [/slice|cut|blade|chop|saw|sword/, 'slice'], [/sticky|glue|goo|web/, 'sticky'], [/invisib|vanish|disappear/, 'invisible'], [/fast|speed|quick/, 'speed'], [/slow/, 'slow'], [/swap|trade places/, 'swap'],
  [/magnet/, 'magnet'], [/bouncy|rubber|bounce/, 'bouncy'], [/mutat|weird body|deform/, 'mutate'], [/money|coin|cash|rich/, 'money'], [/plant|tree|vine|grass/, 'plant'], [/water|wet|splash|rain/, 'water'], [/shield|protect|bubble|armor/, 'shield'],
];
const BODY_WORDS = [[/rifle|sniper|long range/, 'rifle'], [/glove|touch|punch|fist|hand/, 'glove'], [/launcher|lob/, 'grenade'], [/wand|magic/, 'wand'], [/cannon|bazooka/, 'cannon'], [/trap|mine|pad|floor/, 'trap'], [/staff|aura|around me|everyone near/, 'staff'], [/pistol|gun|blaster|ray/, 'pistol']];
const MOD_WORDS = [[/hold|stream|continuous|flamethrower/, 'hold'], [/spray|cone|shotgun|mist/, 'spray'], [/burst|area|splash|explod/, 'burst'], [/chain|jump(s)? to|bounces? between/, 'chain'], [/rain|from the sky|from above/, 'rain'], [/homing|seek|chase|follow/, 'homing'], [/pulse|ring|shockwave|wave/, 'pulse'], [/bolt|bullet|ball|orb|shoot/, 'bolt'], [/beam|laser|ray/, 'beam']];

export function parseGadget(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const cores = [];
  for (const [re, k] of CORE_WORDS) if (re.test(t) && !cores.includes(k)) cores.push(k);
  if (cores.includes('timestop') && cores.includes('freeze') && !/ice|frost|cold/.test(t)) cores.splice(cores.indexOf('freeze'), 1);
  if (!cores.length) cores.push('shrink');
  const body = (BODY_WORDS.find(([re]) => re.test(t)) || [0, 'pistol'])[1];
  const mod = (MOD_WORDS.find(([re]) => re.test(t)) || [0, 'beam'])[1];
  const power = /insane|mega|ultra|super|strongest|max/.test(t) ? 10 : /strong|big|powerful/.test(t) ? 8 : /weak|little|gentle|small amount/.test(t) ? 3 : 5;
  const time = /forever|permanent/.test(t) ? 10 : /short|quick/.test(t) ? 2 : 5;
  const area = /everyone|area|whole|all of them|crowd/.test(t) ? 8 : 3;
  const shots = /shotgun|multi|many|lots/.test(t) ? 4 : 1;
  const obj = OBJECT_TYPES.find((o) => t.includes(o)) || 'chair';
  const name = cores.slice(0, 3).map((k) => CORES[k].label.split(' ')[0]).join('-') + ' ' + BODIES[body].label;
  return { name, body, cores: cores.slice(0, 3), mod, power, area, time, shots, objectType: obj };
}

export function buildWorkbench(ui) {
  const g = ui.g;
  const unlocked = (k) => g.mode !== 'money' || CORES[k].tier === 0 || (g.unlocks && g.unlocks.has('core:' + k));
  const bodyOk = (k) => g.mode !== 'money' || !BODIES[k].price || (g.unlocks && g.unlocks.has('body:' + k));

  const workbench = (start) => {
    const bp = start ? JSON.parse(JSON.stringify(start)) : blueprint('My gadget', 'pistol', ['shrink'], 'beam');
    bp.stats = { ...DEFAULT_STATS, ...bp.stats };
    const left = h('div', { class: 'col' });
    const cv = h('canvas', { class: 'preview', style: { width: '100%', height: '230px', borderRadius: '10px', background: 'radial-gradient(circle at 50% 40%, #213536, #0b1213)' } });
    const pv = new Preview(cv, { dist: 0.75, height: 0.02, fov: 30 });
    const info = h('div', { class: 'col' });
    const right = h('div', { class: 'col' }, cv, info);
    const refresh3d = () => { const m = buildGadgetModel(bp); m.rotation.y = Math.PI / 2; pv.set(m); };
    const drawInfo = () => {
      clear(info);
      const cost = Math.round(complexity(bp) * 0.5);
      put(info, 
        h('div', {}, h('b', {}, bp.name || 'Unnamed'), ' ', h('span', { class: 'muted' }, `${BODIES[bp.body].label} · ${MODS[bp.mod].label}`)),
        h('div', {}, bp.cores.map((k) => h('span', { class: 'tag', style: { color: '#' + CORES[k].color.toString(16).padStart(6, '0') } }, CORES[k].label))),
        h('div', { class: 'muted' }, bp.cores.map((k) => CORES[k].desc).join(' + ')),
        h('div', { class: 'muted' }, `Complexity ${complexity(bp)} · sells for about ${fmtMoney(complexity(bp))} online${g.mode === 'money' ? ` · costs ${fmtMoney(cost)} in parts to build` : ''}`),
        settings.backfires ? h('div', { class: 'muted', style: { color: '#ffb347' } }, `Backfire chance: ${Math.round(instability(bp) * 100)}%`) : null,
      );
    };
    const draw = () => {
      clear(left);
      const nameInp = h('input', { type: 'text', class: 'txt', value: bp.name, maxlength: 30 });
      nameInp.addEventListener('input', () => { bp.name = nameInp.value; drawInfo(); });
      const desc = h('textarea', { class: 'txt', rows: 2, placeholder: 'Or just describe it: "a rifle that turns people into toilets and makes them float"', style: { width: '100%', resize: 'vertical' } });
      const descBtn = btn(settings.brain === 'claude' && settings.claudeKey ? 'Invent it (Claude)' : 'Invent it', async () => {
        const text = desc.value.trim();
        if (!text) return;
        let out;
        if (settings.brain === 'claude' && settings.claudeKey) {
          descBtn.disabled = true; descBtn.textContent = 'Thinking...';
          try { out = await claudeInvent('gadget', text, { bodies: Object.keys(BODIES), cores: Object.keys(CORES), mods: Object.keys(MODS), objects: OBJECT_TYPES }); ui.toast(out.explain || 'Designed.'); } catch (e) { ui.toast(e.message + ' Using the built-in inventor.'); out = parseGadget(text); }
          descBtn.disabled = false;
        } else out = parseGadget(text);
        bp.name = out.name || bp.name; bp.body = BODIES[out.body] ? out.body : 'pistol'; bp.cores = (out.cores || []).filter((k) => CORES[k]).slice(0, 3); if (!bp.cores.length) bp.cores = ['shrink'];
        bp.mod = MODS[out.mod] ? out.mod : 'beam';
        bp.stats = { power: clampI(out.power, 1, 10), area: clampI(out.area, 1, 10), time: clampI(out.time, 1, 10), shots: clampI(out.shots, 1, 5) };
        bp.opts.objectType = OBJECT_TYPES.includes(out.objectType) ? out.objectType : 'chair';
        bp.opts.color = null;
        const locked = bp.cores.filter((k) => !unlocked(k));
        if (locked.length) ui.toast(`Needs parts you haven't bought yet: ${locked.map((k) => CORES[k].label).join(', ')} (lab computer shop).`);
        sfx('ui');
        draw(); refresh3d(); drawInfo();
      }, 'primary');
      put(left, 
        h('div', { class: 'row' }, desc), h('div', { class: 'row' }, descBtn, h('span', { class: 'muted' }, settings.brain === 'claude' && settings.claudeKey ? 'Uses your Claude key.' : 'Built-in inventor (add your Claude key in Settings for a smarter one).')),
        h('hr', { class: 'sep' }),
        h('label', { class: 'field' }, 'Name', nameInp),
        h('div', { class: 'muted' }, 'Body'),
        h('div', { class: 'chips' }, Object.entries(BODIES).map(([k, b]) => h('span', { class: 'chip' + (bp.body === k ? ' on' : '') + (bodyOk(k) ? '' : ' locked'), title: b.desc, onclick: () => { if (!bodyOk(k)) { ui.toast(`Buy the ${b.label} body in the lab computer shop.`); return; } bp.body = k; draw(); refresh3d(); drawInfo(); } }, b.label))),
        h('div', { class: 'muted' }, 'Cores (pick 1 to 3)'),
        h('div', { class: 'chips' }, Object.entries(CORES).map(([k, c]) => h('span', { class: 'chip' + (bp.cores.includes(k) ? ' on' : '') + (unlocked(k) ? '' : ' locked'), title: c.desc, onclick: () => {
          if (!unlocked(k)) { ui.toast(`Buy the ${c.label} core in the lab computer shop.`); return; }
          if (bp.cores.includes(k)) { if (bp.cores.length > 1) bp.cores = bp.cores.filter((x) => x !== k); }
          else if (bp.cores.length < 3) bp.cores.push(k);
          else { ui.toast('3 cores max. Click one to remove it.'); return; }
          bp.opts.color = null; bp.opts.pads = false; bp.opts.tractor = false; bp.opts.cycleEmotion = false;
          draw(); refresh3d(); drawInfo();
        } }, h('i', { style: { background: '#' + c.color.toString(16).padStart(6, '0') } }), c.label))),
        h('div', { class: 'muted' }, 'Mod (how it fires)'),
        h('div', { class: 'chips' }, Object.entries(MODS).map(([k, m]) => h('span', { class: 'chip' + (bp.mod === k ? ' on' : ''), title: m.desc, onclick: () => { bp.mod = k; draw(); refresh3d(); drawInfo(); } }, m.label))),
        h('div', { class: 'statgrid' },
          h('span', {}, 'Power'), slider(1, 10, 1, bp.stats.power, (v) => { bp.stats.power = v; refresh3d(); drawInfo(); }), h('span'),
          h('span', {}, 'Area'), slider(1, 10, 1, bp.stats.area, (v) => { bp.stats.area = v; drawInfo(); }), h('span'),
          h('span', {}, 'Time'), slider(1, 10, 1, bp.stats.time, (v) => { bp.stats.time = v; drawInfo(); }, (v) => (v >= 10 ? 'forever' : v)), h('span'),
          h('span', {}, 'Shots'), slider(1, 5, 1, bp.stats.shots, (v) => { bp.stats.shots = v; drawInfo(); }), h('span'),
        ),
        bp.cores.includes('object') ? setrow('Turns people into', h('select', { class: 'txt', onchange: (e) => { bp.opts.objectType = e.target.value; } }, OBJECT_TYPES.map((o) => h('option', { value: o, selected: bp.opts.objectType === o }, o)))) : null,
        setrow('Glow color', h('span', { class: 'row' }, colorInput(bp.opts.color ?? CORES[bp.cores[0]].color, (c) => { bp.opts.color = c; refresh3d(); }), btn('Auto', () => { bp.opts.color = null; refresh3d(); }, 'small'))),
        g.blueprints.length ? h('div', { class: 'muted', style: { marginTop: '6px' } }, 'Your blueprints') : null,
        h('div', { class: 'chips' }, g.blueprints.map((b, i) => h('span', { class: 'chip', onclick: () => { Object.assign(bp, JSON.parse(JSON.stringify(b))); bp.id = 'bp' + nextId(); draw(); refresh3d(); drawInfo(); } }, b.name, h('span', { class: 'muted', style: { marginLeft: '6px' }, onclick: (e) => { e.stopPropagation(); if (confirm(`Delete blueprint "${b.name}"?`)) { g.blueprints.splice(i, 1); draw(); } } }, '×')))),
      );
    };
    draw(); refresh3d(); drawInfo();
    const build = () => {
      const cost = Math.round(complexity(bp) * 0.5);
      if (!g.spend(g.mode === 'money' ? cost : 0, `Built ${bp.name}`)) return;
      const made = JSON.parse(JSON.stringify(bp));
      made.id = 'bp' + nextId();
      made.charge = 1;
      const pl = g.player;
      const free = pl.hotbar.findIndex((t, i) => i >= 2 && i <= 7 && !t);
      if (free >= 0) { pl.hotbar[free] = made; pl.setGadgetMesh(); ui.toast(`Built ${made.name}. It's on your belt, slot ${free + 1}.`); }
      else { g.backpack.push(made); ui.toast(`Built ${made.name}. Your belt is full, so it's in your backpack (Tab).`); }
      sfx('hammer'); sfx('electric');
      if (!g.blueprints.some((b) => b.name === made.name && JSON.stringify(b.cores) === JSON.stringify(made.cores))) g.blueprints.push(JSON.parse(JSON.stringify(made)));
    };
    ui.showModal('workbench', {
      title: 'Gadget workbench', body: h('div', { class: 'wb' }, left, right), wide: true,
      onClose: () => pv.dispose(),
      buttons: [['Save blueprint', () => { g.blueprints.push(JSON.parse(JSON.stringify(bp))); ui.toast('Blueprint saved.'); sfx('ui'); }], ['Build it', build, 'primary']],
    });
  };
  return { workbench };
}

function clampI(v, a, b) { v = Math.round(Number(v) || a); return Math.max(a, Math.min(b, v)); }
