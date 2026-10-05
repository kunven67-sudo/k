// Achievements (kept across games) and challenges (special starts with a goal).
import * as F from '../core/format.js';
import { FORM, FORMS, M_SUN, M_EARTH, M_JUP } from '../core/constants.js';
import { LIFE } from '../world/life.js';
import { Galaxy } from '../world/galaxy.js';
import { esc } from './info.js';

const $ = (id) => document.getElementById(id);

// test(game, event) returns true when earned; ev is a world event or null for periodic checks
export const ACHIEVEMENTS = [
  // science
  { id: 'roche', cat: 'Science', name: 'Inside the Roche limit', desc: 'Tear something apart with your tides.', on: 'shatter' },
  { id: 'magma', cat: 'Science', name: 'Magma ocean', desc: 'Get hit so hard your surface melts.', test: (g) => g.world.player.heat > 0.6 && !g.world.player.isStar },
  { id: 'dynamo', cat: 'Science', name: 'Dynamo', desc: 'Grow an iron core that makes a magnetic field.', test: (g) => g.world.planet.field >= 0.15 && !g.world.planet.giant },
  { id: 'moonmaker', cat: 'Science', name: 'Theia', desc: 'Make a moon from the debris of a giant impact.', on: 'moon', when: (e) => e.born },
  { id: 'rings', cat: 'Science', name: 'Lord of the rings', desc: 'Shred a moon into a ring around you.', test: (g) => !!g.world.planet.ring },
  { id: 'deep', cat: 'Science', name: 'Deep time', desc: 'Let a million years pass in seconds.', on: 'deep', when: (e) => e.level > 0 },
  { id: 'fusion', cat: 'Science', name: 'Ignition', desc: 'Start hydrogen fusion in your core.', test: (g) => g.world.player.isStar && !g.world.player.compact },
  { id: 'chandra', cat: 'Science', name: 'Chandrasekhar', desc: 'Explode as a Type Ia supernova.', on: 'supernova', when: (e) => e.self && e.ia },
  { id: 'pulsar', cat: 'Science', name: 'Millisecond pulsar', desc: 'Spin a neutron star over 300 times a second.', test: (g) => g.world.player.compact === 'ns' && (g.world.player.nsSpin || 0) >= 300 },
  { id: 'kerr', cat: 'Science', name: 'Kerr', desc: 'Spin a black hole to 90% of the maximum.', test: (g) => g.world.player.compact === 'bh' && (g.world.player.bhSpin || 0) >= 0.9 },
  { id: 'gw', cat: 'Science', name: 'Ripples in spacetime', desc: 'Merge with another black hole.', on: 'bh-merger' },
  { id: 'kilonova', cat: 'Science', name: 'Gold rush', desc: 'Make gold in a kilonova.', on: 'kilonova' },
  { id: 'biosig', cat: 'Science', name: 'Something breathes', desc: 'Find oxygen and methane in another world’s spectrum.', on: 'biosignature' },
  { id: 'hawking', cat: 'Science', name: 'The last light', desc: 'Watch the universe end.', on: 'universe-end' },
  // survival
  { id: 'sn', cat: 'Survival', name: 'Still here', desc: 'Survive a supernova blast wave.', on: 'blast-hit', when: (e, g) => g.world.player.alive },
  { id: 'storm', cat: 'Survival', name: 'Weathered the storm', desc: 'Live through an asteroid or comet swarm.', on: 'storm' },
  { id: 'closecall', cat: 'Survival', name: 'Close call', desc: 'Escape tides that were tearing you apart.', test: (g) => { const w = g.world; if (w.tidalStress > 0.45) g._cc = true; return g._cc && w.tidalStress === 0 && w.player.alive; } },
  { id: 'grb', cat: 'Survival', name: 'Gamma-ray burst', desc: 'Live through a gamma-ray burst.', on: 'grb' },
  { id: 'reborn', cat: 'Survival', name: 'From the ashes', desc: 'Re-form after being destroyed.', on: 'reborn' },
  { id: 'redgiant', cat: 'Survival', name: 'Outlived the Sun', desc: 'Survive your star swelling into a red giant.', on: 'system-changed', when: (e) => e.to === 'rg' },
  { id: 'billion', cat: 'Survival', name: 'A billion years', desc: 'Stay in one piece for a billion years.', test: (g) => g.world.years - (g.world.player.born || 0) >= 1e9 },
  // life
  { id: 'life', cat: 'Life', name: 'Abiogenesis', desc: 'Life appears on your world.', test: (g) => g.world.life.stage >= LIFE.microbes },
  { id: 'goe', cat: 'Life', name: 'Great Oxygenation', desc: 'Life fills your air with oxygen.', test: (g) => g.world.planet.atm.o2 > 0.05 && g.world.life.stage > 0 },
  { id: 'animals', cat: 'Life', name: 'Cambrian', desc: 'Animals appear.', test: (g) => g.world.life.stage >= LIFE.animals },
  { id: 'minds', cat: 'Life', name: 'Someone home', desc: 'A thinking species appears.', test: (g) => g.world.life.stage >= LIFE.intelligence },
  { id: 'space', cat: 'Life', name: 'Sputnik', desc: 'Your civilisation reaches space.', test: (g) => g.world.life.stage >= LIFE.space },
  { id: 'dart', cat: 'Life', name: 'DART', desc: 'Your civilisation deflects an asteroid.', on: 'deflect' },
  { id: 'dyson', cat: 'Life', name: 'Dyson swarm', desc: 'Your civilisation wraps its star in collectors.', test: (g) => g.world.life.dyson > 0.2 },
  { id: 'survivors', cat: 'Life', name: 'Life finds a way', desc: 'Life survives a mass extinction.', on: 'extinction', when: (e, g) => g.world.life.stage > 0 },
  { id: 'moonlife', cat: 'Life', name: 'Hidden ocean', desc: 'Life appears on one of your moons.', on: 'moon-life' },
  // collection
  { id: 'eat100', cat: 'Collection', name: 'Hungry', desc: 'Eat 100 bodies.', test: (g) => g.world.stats.eaten >= 100 },
  { id: 'eat1000', cat: 'Collection', name: 'Insatiable', desc: 'Eat 1,000 bodies.', test: (g) => g.world.stats.eaten >= 1000 },
  { id: 'eatstar', cat: 'Collection', name: 'Star eater', desc: 'Swallow a star.', on: 'impact', when: (e) => e.star && !e.fragment },
  { id: 'systems', cat: 'Collection', name: 'System collector', desc: 'Eat three star systems.', test: (g) => g.world.stats.systemsEaten >= 3 },
  { id: 'eatlife', cat: 'Collection', name: 'Cosmic horror', desc: 'Swallow a world that was alive.', on: 'impact', when: (e) => !!e.life && !e.fragment },
  { id: 'forms5', cat: 'Collection', name: 'Shapeshifter', desc: 'Become 5 different kinds of thing.', test: (g) => g.world.stats.formsSeen.length >= 5 },
  { id: 'forms12', cat: 'Collection', name: 'Every path', desc: 'Become 12 different kinds of thing.', test: (g) => g.world.stats.formsSeen.length >= 12 },
  { id: 'ocean', cat: 'Collection', name: 'Waterworld', desc: 'Become an ocean world.', test: (g) => g.world.player.form === 'oceanworld' },
  { id: 'diamond', cat: 'Collection', name: 'Diamonds are forever', desc: 'Become a diamond world.', test: (g) => g.world.player.form === 'diamondworld' },
  { id: 'iron', cat: 'Collection', name: 'Heart of iron', desc: 'Become an iron planet.', test: (g) => g.world.player.form === 'ironworld' },
  { id: 'gasgiant', cat: 'Collection', name: 'Jovian', desc: 'Become a gas giant.', test: (g) => g.world.player.form === 'gasgiant' },
  { id: 'wd', cat: 'Collection', name: 'Ember', desc: 'Become a white dwarf.', test: (g) => g.world.player.compact === 'wd' },
  { id: 'ns', cat: 'Collection', name: 'City-sized star', desc: 'Become a neutron star.', test: (g) => g.world.player.compact === 'ns' },
  { id: 'bh', cat: 'Collection', name: 'Event horizon', desc: 'Become a black hole.', test: (g) => g.world.player.compact === 'bh' },
  { id: 'smbh', cat: 'Collection', name: 'Supermassive', desc: 'Grow a black hole past 100,000 Suns.', test: (g) => g.world.player.compact === 'bh' && g.world.player.mass >= 1e5 * M_SUN },
  { id: 'nebula', cat: 'Collection', name: 'Stellar nursery', desc: 'Feed inside a molecular cloud.', on: 'nebula-feed' },
  { id: 'core', cat: 'Collection', name: 'Heart of the galaxy', desc: 'Reach the galactic core.', test: (g) => g.world.field.env.kind === 'core' },
  { id: 'andromeda', cat: 'Collection', name: 'Milkomeda', desc: 'See Andromeda merge with the Milky Way.', test: (g) => g.galaxy.merged >= 1 },
];

// a mature Sun-like star near home, for starts that need an old, quiet system
function matureStar(galaxy, m0 = 1.0, age = 4.5e9) {
  const h = galaxy.home;
  return galaxy.addLandmark(h.x + 3.1, h.y + 0.4, h.z - 2.2, { id: `chal-${m0}`, m0, tb: -age, seed: (galaxy.seed ^ 0x5bd1e995) >>> 0 });
}

export const CHALLENGES = [
  {
    id: 'garden', name: 'Garden world', desc: 'Start as a young Earth around a calm Sun-like star. Grow life all the way to animals.', goal: 'Animals on your world',
    start: (gal) => ({ mass: M_EARTH, comp: { rock: 0.55, iron: 0.32, ice: 0.12, carbon: 0.01, gas: 0 }, starRec: matureStar(gal), orbitAU: 0.98, modules: { planet: { H: 0.8, differentiated: true, atm: { n2: 0.8, o2: 0, co2: 0.4, h2o: 0.02, ch4: 0, h2: 0 } } } }),
    check: (g) => g.world.life.stage >= LIFE.animals,
  },
  {
    id: 'spaceage', name: 'Reach for the stars', desc: 'A living world with animals. Keep it safe until its civilisation reaches space.', goal: 'Space age',
    start: (gal) => ({ mass: 1.1 * M_EARTH, comp: { rock: 0.55, iron: 0.32, ice: 0.12, carbon: 0.01, gas: 0 }, starRec: matureStar(gal), orbitAU: 0.98, modules: { planet: { H: 0.55, differentiated: true, atm: { n2: 0.78, o2: 0.21, co2: 0.002, h2o: 0.01, ch4: 1e-6, h2: 0 } }, life: { stage: LIFE.animals, biomass: 0.8, oxProg: 3, timeline: [{ years: 0, stage: LIFE.animals }] } } }),
    check: (g) => g.world.life.stage >= LIFE.space,
  },
  {
    id: 'diamond', name: 'Carbon cutter', desc: 'Begin as a carbon-rich rock. Eat your way into a diamond world.', goal: 'Become a diamond world',
    start: () => ({ mass: 3e21, comp: { rock: 0.35, iron: 0.15, ice: 0.05, carbon: 0.45, gas: 0 } }),
    check: (g) => g.world.player.form === 'diamondworld',
  },
  {
    id: 'ocean', name: 'Waterworld', desc: 'Start as an icy dwarf planet far out in the disk. Become an ocean world.', goal: 'Become an ocean world',
    start: () => ({ mass: 5e21, comp: { rock: 0.35, iron: 0.1, ice: 0.55, carbon: 0, gas: 0 }, orbitAU: 1.2 }),
    check: (g) => g.world.player.form === 'oceanworld',
  },
  {
    id: 'ignite', name: 'Ignition', desc: 'Start as a gas giant. Eat enough hydrogen to become a star.', goal: 'Become a red dwarf star',
    start: () => ({ mass: M_JUP, comp: { rock: 0.03, iron: 0.01, ice: 0.06, carbon: 0, gas: 0.9 }, orbitAU: 6 }),
    check: (g) => g.world.player.isStar && !g.world.player.compact,
  },
  {
    id: 'pulsar', name: 'Spin doctor', desc: 'Start as a slow neutron star. Feed on matter to spin up into a millisecond pulsar.', goal: 'Spin over 300 times a second',
    start: () => ({ mass: 1.4 * M_SUN, compact: 'ns', nsSpin: 2, comp: { iron: 0.2, gas: 0.8 }, orbitAU: 8 }),
    check: (g) => (g.world.player.nsSpin || 0) >= 300,
  },
  {
    id: 'hunger', name: 'Bottomless', desc: 'Start as a 10-Sun black hole. Grow to 1,000 Suns.', goal: 'Reach 1,000 solar masses',
    start: () => ({ mass: 10 * M_SUN, compact: 'bh', comp: { gas: 1 }, bhSpin: 0.2, orbitAU: 12 }),
    check: (g) => g.world.player.mass >= 1000 * M_SUN,
  },
  {
    id: 'sprint', name: 'Star in twenty', desc: 'From a planetesimal, become a star in under 20 minutes of real time.', goal: 'Become a star in 20 minutes',
    start: () => null,
    check: (g) => g.world.player.isStar && !g.world.player.compact && g.world.stats.timePlayed <= 1200,
    fail: (g) => g.world.stats.timePlayed > 1200,
  },
  {
    id: 'end', name: 'The end of everything', desc: 'Start as a supermassive black hole. Use deep time to outlast every star and watch the universe end.', goal: 'Watch the universe end',
    start: () => ({ mass: 4e6 * M_SUN, compact: 'bh', comp: { gas: 1 }, bhSpin: 0.6, orbitAU: 400 }),
    on: 'universe-end',
  },
];

export class Goals {
  constructor(game) {
    this.game = game;
    this.timer = 0;
    this.tab = 'all';
    const p = game.profile;
    p.achievements = p.achievements || {};
    p.challenges = p.challenges || {};
    this.buildTabs();
    this.renderChallengeList();
  }

  get profile() {
    return this.game.profile;
  }

  saveProfile() {
    this.game.saves.setProfile(this.profile);
  }

  buildTabs() {
    const tabs = $('goals-tabs');
    for (const [id, name] of [['all', 'All'], ['Science', 'Science'], ['Survival', 'Survival'], ['Life', 'Life'], ['Collection', 'Collection'], ['chal', 'Challenges']]) {
      const b = document.createElement('button');
      b.className = 'tab';
      b.textContent = name;
      b.dataset.tab = id;
      b.addEventListener('click', () => { this.tab = id; this.render(); });
      tabs.appendChild(b);
    }
  }

  renderChallengeList() {
    const host = $('chal-list');
    host.innerHTML = '';
    for (const c of CHALLENGES) {
      const b = document.createElement('button');
      b.className = 'chal';
      b.innerHTML = `<span>${esc(c.name)}</span><i>${this.profile.challenges[c.id] ? 'Done' : ''}</i><small>${esc(c.desc)}</small>`;
      b.addEventListener('click', () => {
        this.game.selectedChallenge = c;
        for (const o of host.children) o.classList.toggle('on', o === b);
        $('new-note').textContent = `Goal: ${c.goal}`;
      });
      host.appendChild(b);
    }
    this.game.renderChallenges = () => {};
  }

  get challenge() {
    const id = this.game.challenge;
    return id ? CHALLENGES.find((c) => c.id === id) : null;
  }

  unlock(a) {
    if (this.profile.achievements[a.id]) return;
    this.profile.achievements[a.id] = Date.now();
    this.saveProfile();
    toast('Achievement', a.name, a.desc);
    this.game.audio.swell(false);
  }

  onEvent(e) {
    for (const a of ACHIEVEMENTS) {
      if (a.on === e.type && !this.profile.achievements[a.id] && (!a.when || a.when(e, this.game))) this.unlock(a);
    }
    const c = this.challenge;
    if (c && c.on === e.type) this.completeChallenge(c);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1;
    const g = this.game;
    if (g.state !== 'playing' || !g.world.player.alive) return;
    for (const a of ACHIEVEMENTS) {
      if (a.test && !this.profile.achievements[a.id]) {
        try { if (a.test(g)) this.unlock(a); } catch { /* not applicable right now */ }
      }
    }
    const c = this.challenge;
    if (c && !g.challengeDone) {
      if (c.check && c.check(g)) this.completeChallenge(c);
      else if (c.fail && c.fail(g) && !g.challengeFailed) {
        g.challengeFailed = true;
        toast('Challenge failed', c.name, 'Keep playing, or start the challenge again from the title screen.');
      }
    }
  }

  completeChallenge(c) {
    const g = this.game;
    if (g.challengeDone) return;
    g.challengeDone = true;
    this.profile.challenges[c.id] = Date.now();
    this.saveProfile();
    toast('Challenge complete', c.name, c.goal);
    g.hud.log(`Challenge complete: ${c.name}`, 'big');
    g.audio.swell(true);
  }

  goalLine() {
    const c = this.challenge;
    if (!c) return '';
    return `${this.game.challengeDone ? 'Done' : 'Goal'}: ${c.goal}`;
  }

  // ---------------------------------------------------------------- sheet

  open() {
    this.render();
  }

  render() {
    for (const b of document.querySelectorAll('#goals-tabs .tab')) b.classList.toggle('on', b.dataset.tab === this.tab);
    const got = ACHIEVEMENTS.filter((a) => this.profile.achievements[a.id]).length;
    $('goals-title').textContent = `Achievements · ${got} of ${ACHIEVEMENTS.length}`;
    const body = $('goals-body');
    if (this.tab === 'chal') {
      const cur = this.challenge;
      body.innerHTML = `${cur ? `<p class="prose">Current challenge: <b>${esc(cur.name)}</b>. ${esc(cur.desc)} ${this.game.challengeDone ? '<span style="color:var(--food)">Complete.</span>' : ''}</p>` : '<p class="note">Start a challenge from the title screen: New game → Challenges.</p>'}
        <div class="ach" style="margin-top:14px">${CHALLENGES.map((c) => `<div class="${this.profile.challenges[c.id] ? 'got' : ''}">${this.profile.challenges[c.id] ? '<em>Complete</em>' : ''}<b>${esc(c.name)}</b><small>${esc(c.desc)}</small></div>`).join('')}</div>`;
      return;
    }
    const list = ACHIEVEMENTS.filter((a) => this.tab === 'all' || a.cat === this.tab);
    body.innerHTML = `<div class="ach">${list.map((a) => {
      const t = this.profile.achievements[a.id];
      return `<div class="${t ? 'got' : ''}">${t ? `<em>${new Date(t).toLocaleDateString()}</em>` : `<em style="color:var(--dim)">${a.cat}</em>`}<b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div>`;
    }).join('')}</div>`;
  }
}

export function toast(head, title, text = '') {
  const host = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="eyebrow">${esc(head)}</div><div><b>${esc(title)}</b>${text ? `<br><span class="note">${esc(text)}</span>` : ''}</div>`;
  host.appendChild(el);
  while (host.children.length > 3) host.firstChild.remove();
  setTimeout(() => { el.style.transition = 'opacity 0.8s'; el.style.opacity = '0'; }, 6000);
  setTimeout(() => el.remove(), 7000);
}

export { FORM, FORMS, F, Galaxy };
