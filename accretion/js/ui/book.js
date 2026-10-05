// The encyclopedia: short, simple facts about everything you've found.
import { FORMS } from '../core/constants.js';
import { LIFE_STAGES } from '../world/life.js';
import { esc } from './info.js';

const $ = (id) => document.getElementById(id);

// key: { cat, name, facts[], hint }
const ENTRIES = {
  // places
  disk: { cat: 'Places', name: 'Protoplanetary disk', hint: 'Start a new world', facts: ['A young star is surrounded by a flat disk of gas and dust left over from its birth.', 'Planets grow inside it. After a few million years the star’s light blows the leftover gas away.', 'Telescopes like ALMA have photographed rings and gaps in disks, carved by young planets.'] },
  belt: { cat: 'Places', name: 'Asteroid belt', hint: 'Fly into a belt', facts: ['Leftover rubble that never became a planet, often because a giant planet’s gravity kept stirring it.', 'All the asteroids in our belt together weigh less than 4% of the Moon.'] },
  oort: { cat: 'Places', name: 'Oort cloud', hint: 'Leave a star system', facts: ['A huge shell of icy comets around a star, reaching out about a light-year.', 'Passing stars nudge comets out of it and send some falling toward the inner system.'] },
  nebula: { cat: 'Places', name: 'Molecular cloud', hint: 'Enter a nebula', facts: ['Cold clouds of gas and dust thousands of times the Sun’s mass. New stars are born inside them.', 'Their red glow is hydrogen lit up by young hot stars. The Orion Nebula is one, 1,300 light-years away.'] },
  core: { cat: 'Places', name: 'Galactic core', hint: 'Travel to the centre of the galaxy', facts: ['The middle of the galaxy is packed with old stars, a million times denser than near the Sun.', 'At the very centre sits Sagittarius A*, a black hole of about 4 million Suns.'] },
  interstellar: { cat: 'Places', name: 'Interstellar space', hint: 'Leave your star behind', facts: ['The gaps between stars are enormous. The nearest star to the Sun is 4.2 light-years away: 40 trillion km.', 'Light takes over four years to cross that gap. Your fastest jets would take thousands.'] },
  galaxy: { cat: 'Places', name: 'The Milky Way', hint: 'Open the galaxy map', facts: ['Our galaxy is a barred spiral about 100,000 light-years across with a few hundred billion stars.', 'The Sun takes about 230 million years to go around the centre once.'] },
  andromeda: { cat: 'Places', name: 'Andromeda', hint: 'Look at the sky in deep time', facts: ['Our nearest big neighbour galaxy, 2.5 million light-years away and falling toward us at 110 km/s.', 'In about 4.5 billion years the two galaxies will collide and slowly merge into one big round galaxy.', 'Stars almost never hit each other in the crash. The gaps between them are too big.'] },
  // objects
  comet: { cat: 'Objects', name: 'Comets', hint: 'Meet a comet swarm', facts: ['Dirty snowballs from the cold outer system. Near a star their ice boils off into a glowing tail.', 'Comets may have brought some of Earth’s water.'] },
  rogue: { cat: 'Objects', name: 'Rogue planets', hint: 'Meet a rogue planet', facts: ['Planets that were thrown out of their systems and now drift alone between the stars.', 'There may be more rogue planets in the galaxy than stars.'] },
  hotjupiter: { cat: 'Objects', name: 'Hot Jupiters', hint: 'Become a gas giant close to a star', facts: ['Gas giants that orbit very close to their star, with years only a few days long.', 'They probably formed further out and spiralled inward through the gas disk.', '51 Pegasi b, the first planet found around a Sun-like star (1995), is one.'] },
  pnebula: { cat: 'Objects', name: 'Planetary nebula', hint: 'Watch a Sun-like star die', facts: ['When a Sun-like star dies, it puffs its outer layers into space as a glowing shell.', 'They have nothing to do with planets: early telescopes just made them look like planets.'] },
  magnetar: { cat: 'Objects', name: 'Magnetars', hint: 'Meet a magnetar', facts: ['Neutron stars with the strongest magnetic fields known, a thousand trillion times Earth’s.', 'Their starquakes release giant flares. One in 2004 was felt by satellites from 30,000 light-years away.'] },
  pulsar: { cat: 'Objects', name: 'Pulsars', hint: 'Become a neutron star', facts: ['Spinning neutron stars that sweep beams of radio waves across space like a lighthouse.', 'Matter falling onto a pulsar can spin it up to hundreds of turns a second: a millisecond pulsar.'] },
  quasar: { cat: 'Objects', name: 'Quasars', hint: 'Feed a black hole fast', facts: ['A supermassive black hole eating so fast that its hot disk outshines its whole galaxy.', 'Matter heats up as it spirals in and shoots out in jets moving close to the speed of light.'] },
  // physics
  roche: { cat: 'Physics', name: 'Roche limit', hint: 'Tear something apart', facts: ['Too close to a bigger body, the pull on your near side is so much stronger than on your far side that you are pulled apart.', 'This is where planetary rings come from. Saturn’s rings sit inside its Roche limit.'] },
  hill: { cat: 'Physics', name: 'Hill sphere', hint: 'Capture a moon', facts: ['The space around a body where its own gravity is stronger than its star’s. Moons must stay inside it.', 'Earth’s Hill sphere is about 1.5 million km across.'] },
  pebbles: { cat: 'Physics', name: 'Pebble accretion', hint: 'Grow inside a disk', facts: ['Gas slows tiny pebbles down so they drift onto bigger bodies. This lets planets grow fast.', 'Without it, it is hard to explain how giant planets formed before the gas disk vanished.'] },
  runaway: { cat: 'Physics', name: 'Runaway gas accretion', hint: 'Grow past 10 Earth masses in a disk', facts: ['Past about 10 Earth masses, a planet’s gravity pulls in disk gas faster and faster.', 'This is probably how Jupiter and Saturn formed so big.'] },
  deeptime: { cat: 'Physics', name: 'Deep time', hint: 'Speed time past ×10,000', facts: ['Earth is 4.5 billion years old. If that were one day, people would arrive in the last 4 seconds.', 'Mountains, oceans, continents and life all change on these huge timescales.'] },
  tides: { cat: 'Physics', name: 'Tidal locking', hint: 'Get locked to your star', facts: ['Tides slowly brake a body’s spin until it always shows the same face. The Moon is locked to Earth.', 'Planets very close to red dwarfs are probably locked: one side always day, the other always night.'] },
  dynamo: { cat: 'Physics', name: 'Magnetic fields', hint: 'Grow an iron core', facts: ['Swirling liquid iron in a planet’s core makes a magnetic field, like a giant electric generator.', 'It shields the air from the star’s wind. Mars lost most of its air after its field died.', 'Where the star’s wind leaks in near the poles, the air glows: auroras.'] },
  tectonics: { cat: 'Physics', name: 'Plate tectonics', hint: 'Get plate tectonics', facts: ['A planet’s crust can break into plates that slowly drift, about as fast as fingernails grow.', 'Every few hundred million years the continents crash together into a supercontinent, then break apart again.', 'Plates recycle carbon, which keeps Earth’s climate steady over billions of years.'] },
  greenhouse: { cat: 'Physics', name: 'Greenhouse effect', hint: 'Have a thick atmosphere', facts: ['Some gases (carbon dioxide, water vapour, methane) let sunlight in but trap heat.', 'Too much and the oceans boil away: a runaway greenhouse, like Venus at 465 °C.', 'Too little and the oceans freeze over completely: a snowball world. Earth was one about 700 million years ago.'] },
  esi: { cat: 'Physics', name: 'Earth Similarity Index', hint: 'Become a rocky planet', facts: ['A score from 0 to 1 for how much a planet is like Earth in size, density, gravity and temperature.', 'Earth is 1.00, Mars 0.70, Venus 0.44.'] },
  hz: { cat: 'Physics', name: 'Habitable zone', hint: 'Get liquid oceans', facts: ['The range of distances from a star where water could be liquid on a planet’s surface.', 'For the Sun it runs from a bit outside Venus to near Mars.'] },
  fusion: { cat: 'Physics', name: 'Nuclear fusion', hint: 'Become a star', facts: ['In a star’s core, hydrogen nuclei crash together and fuse into helium, releasing energy.', 'It needs about 10 million °C. Below about 8% of the Sun’s mass, no body gets that hot.'] },
  degenerate: { cat: 'Physics', name: 'Degenerate matter', hint: 'Become extremely dense', facts: ['Squeeze matter hard enough and electrons themselves push back. White dwarfs are held up this way.', 'Above 1.4 Suns (the Chandrasekhar limit), even that fails.'] },
  hawking: { cat: 'Physics', name: 'Hawking radiation', hint: 'Be a black hole for a very long time', facts: ['Stephen Hawking showed black holes slowly leak energy and lose mass.', 'A black hole like the Sun would take about 10⁶⁷ years to evaporate: far longer than the universe has existed.'] },
  gw: { cat: 'Physics', name: 'Gravitational waves', hint: 'Merge with a black hole', facts: ['Ripples in space itself, sent out when heavy objects like black holes spiral together.', 'First detected by LIGO in 2015, from two black holes merging 1.3 billion light-years away.'] },
  frame: { cat: 'Physics', name: 'Frame dragging', hint: 'Spin a black hole up', facts: ['A spinning black hole drags space around with it, so nothing near it can stay still.', 'Fast-spinning black holes turn more of what they eat into light and jets.'] },
  // dangers
  supernova: { cat: 'Dangers', name: 'Supernovae', hint: 'See a star explode', facts: ['When a massive star’s core turns to iron it collapses in under a second, then explodes.', 'For a few weeks it can outshine its whole galaxy.', 'The iron in your blood was made in stars and spread by explosions like these.'] },
  kilonova: { cat: 'Dangers', name: 'Kilonovae', hint: 'Merge two neutron stars', facts: ['When two neutron stars merge, the blast makes heavy elements like gold and platinum.', 'One seen in 2017 made several Earth masses of gold.'] },
  grb: { cat: 'Dangers', name: 'Gamma-ray bursts', hint: 'Survive a gamma-ray burst', facts: ['The brightest explosions known: beams of gamma rays from collapsing giant stars or merging neutron stars.', 'One pointed at a planet from a few thousand light-years away could strip its ozone layer.'] },
  impact: { cat: 'Dangers', name: 'Giant impacts', hint: 'Get hit by something big', facts: ['The asteroid that ended the dinosaurs was about 10 km wide and hit with the energy of billions of nuclear bombs.', 'Earth’s Moon probably formed when a Mars-sized body called Theia hit the young Earth.'] },
  extinction: { cat: 'Dangers', name: 'Mass extinctions', hint: 'Watch life survive a disaster', facts: ['Earth has had five big mass extinctions. The worst, 252 million years ago, killed about 90% of species.', 'Afterwards, survivors spread into the empty places and new kinds of life appear fast.'] },
  // life
  goe: { cat: 'Life', name: 'Great Oxygenation', hint: 'Grow oxygen-making life', facts: ['About 2.4 billion years ago, microbes that used sunlight started filling Earth’s air with oxygen.', 'At first the oxygen rusted iron in the oceans. Only when that was used up could it build up in the air.'] },
  dart: { cat: 'Life', name: 'Planetary defence', hint: 'Let a civilisation defend you', facts: ['In 2022 NASA’s DART spacecraft crashed into the asteroid Dimorphos and changed its orbit.', 'It was the first time people moved a natural object in space.'] },
  dyson: { cat: 'Life', name: 'Dyson swarms', hint: 'Grow a very advanced civilisation', facts: ['A huge swarm of solar collectors around a star, catching much of its light.', 'Astronomers have searched for stars dimmed in strange ways that might hint at one. None found so far.'] },
  biosig: { cat: 'Life', name: 'Biosignatures', hint: 'Look at a living world’s spectrum', facts: ['Oxygen and methane destroy each other, so finding both in a planet’s air means something keeps making them: probably life.', 'Telescopes read a planet’s air from starlight that passes through it.'] },
  transit: { cat: 'Life', name: 'Transits', hint: 'Use the telescope', facts: ['When a planet passes in front of its star, the star dims slightly. This is how most planets are found.', 'Earth passing in front of the Sun would dim it by only 0.008%.'] },
};

// forms and life stages become entries too
for (const f of FORMS) ENTRIES[`form:${f.id}`] = { cat: 'What you can be', name: f.name, hint: 'Become it', facts: f.facts };
LIFE_STAGES.forEach((s, i) => { if (i > 0 && s.fact) ENTRIES[`life:${s.id}`] = { cat: 'Life', name: s.name, hint: 'Grow life', facts: [s.fact] }; });

const EVENT_KEYS = {
  shatter: 'roche', disrupt: 'roche', moon: 'hill', deep: 'deeptime', storm: 'comet', rogue: 'rogue', supernova: 'supernova', 'distant-supernova': 'supernova',
  grb: 'grb', 'magnetar-flare': 'magnetar', 'gas-capture': 'runaway', 'planetary-nebula': 'pnebula', kilonova: 'kilonova', 'bh-merger': 'gw',
  extinction: 'extinction', deflect: 'dart', biosignature: 'biosig', 'universe-end': 'hawking', impact: null,
};

export class Book {
  constructor(game) {
    this.game = game;
    this.sel = null;
    this.cat = 'all';
    const p = game.profile;
    p.seen = p.seen || {};
    this.timer = 0;
    const tabs = $('book-tabs');
    const cats = ['all', ...new Set(Object.values(ENTRIES).map((e) => e.cat))];
    for (const c of cats) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.textContent = c === 'all' ? 'All' : c;
      b.dataset.tab = c;
      b.addEventListener('click', () => { this.cat = c; this.render(); });
      tabs.appendChild(b);
    }
  }

  see(key) {
    if (!ENTRIES[key]) return;
    const p = this.game.profile;
    if (p.seen[key]) return;
    p.seen[key] = Date.now();
    this.dirty = true;
  }

  onEvent(e) {
    const k = EVENT_KEYS[e.type];
    if (k) this.see(k);
    if (e.type === 'impact' && !e.fragment && e.rel > 0.05) this.see('impact');
    if (e.type === 'life') { this.see(`life:${e.id}`); if (e.id === 'oxygen') this.see('goe'); }
    if (e.type === 'stage' && e.to) this.see(`form:${e.to}`);
  }

  // things you notice just by being somewhere
  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 2;
    const g = this.game, w = g.world, p = w.player;
    if (g.state !== 'playing' || !p.alive) return;
    const env = w.field.env.kind;
    if (env === 'disk') { this.see('disk'); this.see('pebbles'); }
    if (env === 'belt') this.see('belt');
    if (env === 'oort') this.see('oort');
    if (env === 'nebula') this.see('nebula');
    if (env === 'core') this.see('core');
    if (env === 'interstellar') this.see('interstellar');
    this.see(`form:${p.form}`);
    const pm = w.planet;
    if (!pm.giant) {
      this.see('esi');
      if (pm.field > 0.15) this.see('dynamo');
      if (pm.tectonics) this.see('tectonics');
      if (pm.P > 0.5 || pm.oceanState === 'steam' || pm.iceCover > 0.9) this.see('greenhouse');
      if (pm.oceanState === 'liquid') this.see('hz');
      if (pm.locked) this.see('tides');
    }
    if (p.isStar) this.see('fusion');
    if (p.compact === 'wd' || p.form === 'degenerate') this.see('degenerate');
    if (p.compact === 'ns') this.see('pulsar');
    if (p.compact === 'bh' && (p.bhSpin || 0) > 0.5) this.see('frame');
    if (p.compact === 'bh' && g.feedMass > 0.6) this.see('quasar');
    if (p.form === 'gasgiant' && p.temp > 1000) this.see('hotjupiter');
    if (w.life.stage >= 8) this.see('dart');
    if (w.life.dyson > 0) this.see('dyson');
    if (this.dirty) { this.dirty = false; g.saves.setProfile(g.profile); }
  }

  open() {
    this.render();
  }

  render() {
    const seen = this.game.profile.seen;
    for (const b of document.querySelectorAll('#book-tabs .tab')) b.classList.toggle('on', b.dataset.tab === this.cat);
    const keys = Object.keys(ENTRIES).filter((k) => this.cat === 'all' || ENTRIES[k].cat === this.cat);
    const found = Object.keys(ENTRIES).filter((k) => seen[k]).length;
    $('book-title').textContent = `What you've found · ${found} of ${Object.keys(ENTRIES).length}`;
    const list = $('book-list');
    list.innerHTML = '';
    let lastCat = null;
    for (const k of keys.sort((a, b) => (ENTRIES[a].cat === ENTRIES[b].cat ? 0 : ENTRIES[a].cat < ENTRIES[b].cat ? -1 : 1))) {
      const e = ENTRIES[k];
      if (this.cat === 'all' && e.cat !== lastCat) {
        const h = document.createElement('div');
        h.className = 'eyebrow';
        h.style.margin = '10px 0 4px 10px';
        h.textContent = e.cat;
        list.appendChild(h);
        lastCat = e.cat;
      }
      const b = document.createElement('button');
      b.className = `item${seen[k] ? '' : ' locked'}${this.sel === k ? ' on' : ''}`;
      b.innerHTML = seen[k] ? `${esc(e.name)}` : `???<small>${esc(e.hint)}</small>`;
      b.addEventListener('click', () => { this.sel = k; this.render(); });
      list.appendChild(b);
    }
    const det = $('book-detail');
    const e = ENTRIES[this.sel];
    if (!e) { det.innerHTML = '<p class="note">Pick an entry. New entries unlock as you find things.</p>'; return; }
    if (!seen[this.sel]) { det.innerHTML = `<div class="block"><h3>${esc(e.cat)}</h3><p class="prose">Not found yet. ${esc(e.hint)}.</p></div>`; return; }
    det.innerHTML = `<div class="block"><h3>${esc(e.cat)}</h3><h2 style="margin:4px 0 6px;font:400 22px/1.15 var(--font-display);letter-spacing:.05em;text-transform:uppercase">${esc(e.name)}</h2>
      <ul class="hist">${e.facts.map((f) => `<li style="grid-template-columns:minmax(0,1fr)"><span class="prose">${esc(f)}</span></li>`).join('')}</ul></div>`;
  }
}
