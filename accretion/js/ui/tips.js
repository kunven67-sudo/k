// The tutorial at the start, and a short tip the first time something new happens.
const $ = (id) => document.getElementById(id);

const STEPS = [
  { text: 'Click the view, then move the mouse to look around.', done: (g, s) => s.look > 300 },
  { text: 'Hold <kbd>W</kbd> to fire your volcanic jets forward. Every burst costs a little of your mass, so use them gently.', done: (g, s) => s.thrust > 1.2 },
  { text: 'Green brackets mark things smaller than you: food. Drift into one slowly. Fast hits blast rock off you.', done: (g, s) => s.ate > 0 },
  { text: 'Red means bigger than you. Its gravity can tear you apart, so keep your distance.', done: (g, s) => s.t > 7 },
  { text: 'Hold <kbd>X</kbd> to brake: your jets match the local orbit. Press <kbd>T</kbd> to lock onto what’s under the crosshair.', done: (g, s) => s.brake > 0.6 || s.t > 12 },
  { text: 'Press <kbd>.</kbd> to speed up time, <kbd>,</kbd> to slow it. Past ×10,000 comes deep time: millions of years a second, once you’re calm in orbit.', done: (g) => g.world.warp > 1 || g.world.deep > 0 },
  { text: 'Press <kbd>I</kbd> for your info screen, <kbd>M</kbd> for the galaxy map, <kbd>L</kbd> for the telescope, <kbd>J</kbd> for the encyclopedia.', done: (g, s) => s.opened || s.t > 14 },
  { text: 'That’s it. What you eat decides what you become. The line under your name shows where your diet is taking you.', done: (g, s) => s.t > 9 },
];

const TIPS = {
  stage: 'The bar under your name fills as you grow. The line below it is your forecast: what your diet will turn you into next.',
  storm: 'A swarm is coming. Swarm rocks move fast, so match their speed (hold <kbd>X</kbd> with them locked) before you swallow them.',
  disrupt: 'You’re inside its Roche limit: your tides pull it into a stream of debris that spirals in. Hold <kbd>E</kbd> to pull the pieces in faster.',
  moon: 'Moons orbit inside your Hill sphere. Get too close to one and your tides shred it into a ring.',
  deep: 'In deep time, ages pass in seconds. Stars age, life evolves, the galaxy changes. Thrust or press <kbd>,</kbd> to come back.',
  'deep-blocked': 'Deep time needs calm: no jets, nothing big nearby, and a stable orbit or empty space.',
  life: 'Life is fragile. A big impact can cause a mass extinction, and a giant one can melt your surface and kill everything.',
  'gas-capture': 'You’re pulling in hydrogen from the disk. Keep it up and you’ll become a gas giant, then maybe a star. Leave the disk to stay rocky.',
  giant: 'Your core is out of hydrogen. Your planets close in will be swallowed as you swell.',
  'life-wake': 'Your civilisation will grow while you watch. It will try to protect you from asteroids. Lock a target with <kbd>T</kbd> to let one through.',
  extinction: 'Survivors fill the empty niches quickly. Evolution speeds up for a while after a mass extinction.',
  collapse: 'You collapsed. Neutron stars spin faster as they eat; black holes spin up too and grow brighter jets.',
  'sn-warning': 'A supernova is about to go off nearby. Get as far away as you can, or hide behind something big.',
  ablate: 'A star is boiling you away. Move further out before you lose too much.',
  stripped: 'Something bigger is pulling you apart. Fire your jets away from it now.',
  'warp-blocked': 'Time warp only works far from big bodies, so that nothing sneaks up on you.',
  colony: 'Colonies spread your life beyond one world.',
  grb: 'Gamma-ray bursts can strip a planet’s ozone layer from thousands of light-years away.',
  rogue: 'Rogue planets drift between the stars with no sun of their own. There may be more of them than stars.',
  'system-near': null,
};

export class Tips {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.showing = 0;
    this.step = -1;
    this.stats = { look: 0, thrust: 0, ate: 0, brake: 0, t: 0, opened: false };
    const p = game.profile;
    p.tips = p.tips || {};
  }

  startTutorial() {
    this.step = 0;
    this.stats = { look: 0, thrust: 0, ate: 0, brake: 0, t: 0, opened: false };
    this.show('Tutorial', STEPS[0].text, 999);
  }

  stopTutorial() {
    this.step = -1;
    this.hide();
  }

  show(head, html, secs = 8) {
    $('tip-head').textContent = head;
    $('tip-text').innerHTML = html;
    $('tip').hidden = false;
    this.showing = secs;
  }

  hide() {
    $('tip').hidden = true;
    this.showing = 0;
  }

  tip(key) {
    const g = this.game;
    if (!g.settings.hints) return;
    const p = g.profile;
    if (p.tips[key] || !TIPS[key]) return;
    p.tips[key] = 1;
    g.saves.setProfile(p);
    if (this.step >= 0) this.queue.push(TIPS[key]);
    else if (this.showing > 0) this.queue.push(TIPS[key]);
    else this.show('Tip', TIPS[key]);
  }

  onEvent(e) {
    if (e.type === 'impact' && !e.fragment) this.stats.ate++;
    if (e.type === 'deep' && e.level > 0) this.tip('deep');
    else if (TIPS[e.type] !== undefined) this.tip(e.type);
  }

  update(dt) {
    const g = this.game;
    if (g.state !== 'playing') { if (!$('tip').hidden && this.step < 0) this.hide(); return; }
    const s = this.stats;
    if (this.step >= 0) {
      s.t += dt;
      s.look += Math.abs(g.input.mouseDX) + Math.abs(g.input.mouseDY);
      if (g.world.input.level > 0) s.thrust += dt;
      if (g.world.input.brake) s.brake += dt;
      if (g.sheet) s.opened = true;
      const st = STEPS[this.step];
      if (st.done(g, s)) {
        this.step++;
        s.t = 0;
        if (this.step >= STEPS.length) { this.step = -1; this.hide(); return; }
        this.show(`Tutorial ${this.step + 1}/${STEPS.length}`, STEPS[this.step].text, 999);
      }
      if (g.sheet) $('tip').hidden = true;
      else if ($('tip').hidden) $('tip').hidden = false;
      return;
    }
    if (this.showing > 0) {
      this.showing -= dt;
      if (g.sheet) $('tip').hidden = true;
      if (this.showing <= 0) this.hide();
    } else if (this.queue.length && !g.sheet) {
      this.show('Tip', this.queue.shift());
    }
  }
}
