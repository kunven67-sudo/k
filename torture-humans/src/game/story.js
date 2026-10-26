// Story mode: "Tiny Town Ruler". Ten missions on top of the sandbox: shrink your
// first citizens, keep them alive, help them build, hide it all from Mom and the
// police, deal with escapes, and face the ending your choices earned:
//   kind ruler (they build you a statue), overthrown (they shrink YOU), busted.
//
// Cutscenes are speech bubbles + a caption bar while the camera turns to whoever
// is talking. Each mission makes sure what it needs exists when you continue a
// saved story (the world save doesn't keep who's in the tank), so a story can
// always be picked up where it was left.
import * as THREE from 'three';
import { TOWN_LOOKS, nameFor, jobOf } from './humans/looks.js';

const KEY = 'torture-humans-story-1';
const TINY = 0.05;
const _v = new THREE.Vector3();

// ---- small helpers

const alive = (h) => h && !h.dead && h.alive !== false;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Story {
  constructor(game, { spawnPerson, toast }) {
    this.g = game;
    this.spawnPerson = spawnPerson;
    this.toast = toast;
    this.active = false;
    this.state = null;      // what gets saved (see fresh())
    this.mission = null;    // the running mission's live data
    this.scene = null;      // the cutscene that's playing
    this.ending = null;
    this.makeUi();
    this.hookGame();
  }

  static saved() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  }

  static clear() {
    try { localStorage.removeItem(KEY); } catch { /* private mode */ }
  }

  fresh() {
    return {
      v: 1, index: 0, done: false,
      // how you've treated your tiny people (decides the ending)
      care: { samples: 0, sum: 0, deaths: 0, hurts: 0, tinier: 0, lost: 0, fed: 0, built: 0 },
      mayor: null,
      ending: null,
    };
  }

  // ---- start / continue / save

  begin({ resume = false } = {}) {
    const saved = resume ? Story.saved() : null;
    this.state = saved && saved.v === 1 && Number.isInteger(saved.index) ? { ...this.fresh(), ...saved, care: { ...this.fresh().care, ...saved.care } } : this.fresh();
    this.active = true;
    this.g.mode = 'story';
    this.ui.root.hidden = false;
    if (this.state.done) { this.showEnding(this.state.ending || 'kind', { replay: true }); return; }
    this.startMission(this.state.index, { resumed: !!saved });
  }

  save() {
    if (!this.active || !this.state) return;
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* full or private */ }
  }

  get missionNumber() { return (this.state?.index ?? 0) + 1; }

  // ---- the world, from the story's point of view

  get cage() { return this.g.cage; }
  get colony() { return this.g.colony; }

  // tiny people living in the tank right now
  citizens() {
    const c = this.cage;
    if (!c) return [];
    return [...c.residents].filter((h) => alive(h) && h.state === 'caged');
  }

  // people out in the world you could shrink (not your parents, not cops on a call)
  townsfolk() {
    return this.g.humans.filter((h) => alive(h) && !h.tiny && h.scale > 0.5 && !h.isParent && !h.villager && ['idle', 'walking', 'away'].includes(h.state) && !h.copBusy && !h.storyRole);
  }

  // put someone straight into the tank (used when you continue a saved story:
  // the world save doesn't remember who was in there)
  cageNow(h) {
    const c = this.cage;
    if (!c || !h) return false;
    if (h.agent) { h.nav.removeAgent(h.agent); h.agent = null; }
    if (h.capsule) { h.physics.removeCapsule(h.capsule); h.capsule = null; }
    h.shrinking = null;
    h.scale = TINY;
    h.tiny = true;
    h.character.root.visible = true;
    h.emotion.fear = 0.3;
    c.drop(h, c.group.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.2, (Math.random() - 0.5) * 1)), null);
    return true;
  }

  // missions where you need someone to shrink: if hardly anyone is out on the
  // street (most are at work in the daytime), visitors walk into town
  crowd(min = 3) {
    if (this.spawning || (this.visitors ?? 0) >= 8 || !this.spawnPerson) return;
    const out = this.townsfolk().filter((h) => h.state !== 'away').length;
    if (out >= min) return;
    const spots = this.g.level.town?.spots;
    if (!spots?.length) return;
    const look = TOWN_LOOKS[(Math.random() * TOWN_LOOKS.length) | 0];
    const spot = spots[(Math.random() * spots.length) | 0];
    this.spawning = true;
    this.spawnPerson(look, { name: nameFor(look), job: jobOf(look), at: spot.p })
      .then((h) => { if (h) this.visitors = (this.visitors ?? 0) + 1; })
      .catch((e) => console.warn('[story] visitor', e.message))
      .finally(() => { this.spawning = false; });
  }

  ensureCitizens(n) {
    let have = this.citizens().length;
    // people out on the street first, then anyone (even if they're at work right now)
    const folk = this.townsfolk().sort((a, b) => (a.state === 'away') - (b.state === 'away'));
    for (const h of folk) {
      if (have >= n) break;
      if (this.cageNow(h)) have++;
    }
  }

  // how they're doing, 0..1 (fed, watered, healthy, not terrified)
  wellbeing() {
    const col = this.colony;
    const list = this.citizens();
    if (!list.length) return null;
    let sum = 0;
    for (const h of list) {
      const r = col?.residents.get(h);
      const body = r ? Math.min(r.hunger, r.thirst, r.health) / 100 : 0.7;
      const mind = 1 - Math.max(h.emotion.fear * 0.6, h.emotion.anger, h.emotion.sadness * 0.8);
      sum += body * 0.65 + THREE.MathUtils.clamp(mind, 0, 1) * 0.35;
    }
    return sum / list.length;
  }

  // 0..100: how good a ruler you've been
  kindness() {
    const c = this.state.care;
    const avg = c.samples ? c.sum / c.samples : 0.6;
    return THREE.MathUtils.clamp(avg * 100 - c.deaths * 14 - c.hurts * 5 - c.tinier * 6 - c.lost * 4 + Math.min(10, c.fed) + c.built * 4, 0, 100);
  }

  // watch what happens to the tiny people (for the ending)
  hookGame() {
    const g = this.g;
    const col = g.colony;
    if (col) {
      const punch = col.punch.bind(col);
      col.punch = (...a) => { const r = punch(...a); if (r && this.active) this.state.care.hurts++; return r; };
      col.onDrop = (kind, n) => { if (!this.active) return; if (kind === 'food') this.state.care.fed += 1; const m = this.mission; if (m?.started) m.def.onDrop?.(this, m, kind, n); };
    }
    this.known = new Map(); // tiny person -> { dead, tinier } already counted
  }

  watchCare(dt) {
    const s = this.state.care;
    this.careT = (this.careT ?? 0) - dt;
    if (this.careT <= 0) {
      this.careT = 5;
      const w = this.wellbeing();
      if (w !== null) { s.samples++; s.sum += w; }
    }
    for (const h of this.cage?.residents || []) {
      let k = this.known.get(h);
      if (!k) { k = { dead: false, tinier: false }; this.known.set(h, k); }
      if (!k.dead && (h.dead || h.alive === false)) { k.dead = true; s.deaths++; this.say(null, `${h.profile.name} died. The others saw it happen…`); }
      if (!k.tinier && h.scale < TINY * 0.8 && !h.dead) { k.tinier = true; s.tinier++; }
    }
    const built = this.colony?.built.length ?? 0;
    if (built > (this.builtSeen ?? built)) s.built += built - this.builtSeen;
    this.builtSeen = built;
  }

  // ---- missions

  startMission(i, { resumed = false } = {}) {
    if (i >= MISSIONS.length) { this.finish(); return; }
    this.state.index = i;
    const def = MISSIONS[i];
    this.mission = { def, t: 0, step: 0, data: {}, resumed };
    def.prepare?.(this, this.mission);
    this.save();
    this.setGoal(null);
    this.ui.title.textContent = `Mission ${i + 1} of ${MISSIONS.length}: ${def.title}`;
    this.play(def.intro?.(this, this.mission) || [], () => {
      def.start?.(this, this.mission);
      this.mission.started = true;
    });
  }

  completeMission() {
    const m = this.mission;
    if (!m || m.completing) return;
    m.completing = true;
    this.setGoal(null);
    this.g.audio?.tone?.(660, 0.15, { type: 'triangle', gain: 0.15 });
    this.toast?.(`✔ Mission complete: ${m.def.title}`);
    const outro = m.def.outro?.(this, m) || [];
    this.play(outro, () => {
      // (the last mission's end plays the finale itself)
      if (m.def.end?.(this, m) === 'handled' || this.ending) return;
      this.startMission(this.state.index + 1);
    });
  }

  // mission failed: what went wrong, then try it again
  failMission(why) {
    const m = this.mission;
    if (!m || m.completing) return;
    m.completing = true;
    this.setGoal(null);
    m.def.end?.(this, m);
    this.play([{ text: `✖ ${why}` }, { text: 'Try again!' }], () => this.startMission(this.state.index));
  }

  // ---- the ending

  finish(kind) {
    const k = kind || (this.kindness() >= 50 ? 'kind' : 'overthrown');
    this.state.done = true;
    this.state.ending = k;
    this.save();
    this.showEnding(k);
  }

  showEnding(kind, { replay = false } = {}) {
    this.ending = kind;
    this.mission = null;
    this.setGoal(null);
    const E = ENDINGS[kind] || ENDINGS.kind;
    const c = this.state.care;
    const el = this.ui.end;
    el.innerHTML = `<div class="box">
      <h1>${E.title}</h1>
      <p>${E.text}</p>
      <div class="stats">
        <span>How kind a ruler: <b>${Math.round(this.kindness())}/100</b></span>
        <span>Times they ate: <b>${c.fed}</b></span>
        <span>Things built: <b>${c.built}</b></span>
        <span>Tiny people lost: <b>${c.deaths + c.lost}</b></span>
      </div>
      <p class="small">There are 3 endings: 😇 Kind ruler · 😈 Overthrown · 🚔 Busted</p>
      <button data-act="keep" class="main">▶ Keep playing (sandbox)</button>
      <button data-act="again">📖 Play the story again</button>
    </div>`;
    el.hidden = false;
    this.g.input.enabled = false;
    this.g.input.clear();
    if (document.pointerLockElement) document.exitPointerLock?.();
    el.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      el.hidden = true;
      if (b.dataset.act === 'again') { Story.clear(); this.state = this.fresh(); this.ending = null; this.startMission(0); }
      else { this.active = false; this.g.mode = 'sandbox'; this.ui.root.hidden = true; }
      this.g.input.enabled = true;
      this.g.input.target?.requestPointerLock?.()?.catch?.(() => {});
    };
    if (!replay) this.g.audio?.tone?.(523, 0.4, { type: 'triangle', gain: 0.15 });
  }

  // ---- cutscenes: lines of { who, text, look, secs, act }

  play(lines, done) {
    if (!lines.length) { done?.(); return; }
    this.scene = { lines, i: -1, t: 0, done };
    this.g.input.enabled = false;
    this.g.input.clear();
    this.ui.bars.hidden = false;
    this.next();
  }

  next() {
    const sc = this.scene;
    if (!sc) return;
    sc.i++;
    if (sc.i >= sc.lines.length) {
      this.scene = null;
      this.ui.bars.hidden = true;
      this.ui.caption.hidden = true;
      this.g.input.enabled = true;
      sc.done?.();
      return;
    }
    const line = sc.lines[sc.i];
    sc.t = 0;
    sc.min = 0.6;
    sc.secs = line.secs ?? Math.max(2.6, line.text.length * 0.055);
    line.act?.(this);
    const who = typeof line.who === 'function' ? line.who(this) : line.who;
    sc.look = line.look ? (typeof line.look === 'function' ? line.look(this) : line.look) : who && who !== 'you' ? who : null;
    this.say(who, line.text);
  }

  // a speech bubble over the speaker plus the caption at the bottom
  say(who, text) {
    const cap = this.ui.caption;
    const name = who === 'you' ? 'You' : who?.profile?.name ?? '';
    cap.innerHTML = `${name ? `<b>${name}:</b> ` : ''}${text}`;
    cap.classList.toggle('narrator', !name);
    cap.hidden = false;
    if (who && who !== 'you' && who.character) this.g.speech.say(who, text, { secs: Math.max(3, text.length * 0.06) });
    clearTimeout(this.capTimer);
    if (!this.scene) this.capTimer = setTimeout(() => { if (!this.scene) cap.hidden = true; }, 4500);
  }

  skipLine() {
    if (!this.scene || this.scene.t < this.scene.min) return;
    this.next();
  }

  updateScene(dt) {
    const sc = this.scene;
    sc.t += dt;
    // turn to look at whoever is talking (or what the line points at)
    const target = sc.look;
    if (target) {
      const p = target.isVector3 ? target : this.headOf(target);
      if (p) {
        const pl = this.g.player, eye = this.g.camera.position;
        const d = _v.copy(p).sub(eye);
        const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
        let dy = yaw - pl.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const k = 1 - Math.exp(-dt * 4);
        pl.yaw += dy * k;
        pl.pitch += (THREE.MathUtils.clamp(pitch, -1.2, 1.2) - pl.pitch) * k;
      }
    }
    if (sc.t >= sc.secs) this.next();
  }

  headOf(h) {
    const root = h.character?.root;
    if (!root) return null;
    const head = h.character.bones?.Bip01_Head;
    return (head || root).getWorldPosition(new THREE.Vector3());
  }

  // ---- what you have to do right now (top left)

  setGoal(text, sub = '') {
    const g = this.ui.goal;
    if (!text) { g.hidden = true; this.goalText = ''; return; }
    const html = `<b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`;
    if (html !== this.goalText) { g.innerHTML = html; this.goalText = html; }
    g.hidden = false;
  }

  // ---- every frame

  update(dt) {
    if (!this.active) return;
    if (this.scene) { this.updateScene(dt); return; }
    if (this.ending || !this.mission?.started) return;
    this.watchCare(dt);
    const m = this.mission;
    m.t += dt;
    if (m.def.needsPeople) this.crowd(3);
    const r = m.def.update(this, m, dt);
    if (r === 'done') this.completeMission();
    else if (typeof r === 'string' && r.startsWith('fail:')) this.failMission(r.slice(5));
    this.saveT = (this.saveT ?? 10) - dt;
    if (this.saveT <= 0) { this.saveT = 10; this.save(); }
  }

  // ---- the screen bits

  makeUi() {
    const root = document.createElement('div');
    root.id = 'story';
    root.hidden = true;
    root.innerHTML = `
      <div class="goalbox" hidden><div class="mtitle"></div><div class="goal"></div></div>
      <div class="bars" hidden><div class="top"></div><div class="bottom"></div></div>
      <div class="caption" hidden></div>
      <div class="ending" hidden></div>`;
    document.body.appendChild(root);
    const q = (s) => root.querySelector(s);
    const goalbox = q('.goalbox');
    this.ui = { root, title: q('.mtitle'), goalWrap: goalbox, goal: q('.goal'), bars: q('.bars'), caption: q('.caption'), end: q('.ending') };
    // the goal box shows whenever there's a goal
    const goalEl = this.ui.goal;
    const show = () => { goalbox.hidden = goalEl.hidden; };
    new MutationObserver(show).observe(goalEl, { attributes: true, attributeFilter: ['hidden'] });
    goalEl.hidden = true;
    // click / Space / Enter: next line
    addEventListener('keydown', (e) => { if (this.scene && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); this.skipLine(); } });
    addEventListener('mousedown', () => { if (this.scene) this.skipLine(); });
  }
}

// ---------------------------------------------------------------------------
// The missions. Each: title, prepare (make sure what it needs exists), intro
// lines, start, update -> 'done' | 'fail:why' | null (and sets the goal text),
// outro lines, end (clean up).

const near = (a, b, r) => a.distanceTo(b) < r;

const MISSIONS = [
  // 1 ---------------------------------------------------------------------
  {
    title: 'It works!',
    needsPeople: true,
    intro: () => [
      { text: 'Your secret basement lab. Three years of work, and tonight the shrink ray is finally finished.' },
      { who: 'you', text: 'Okay. Okay okay okay. Time to test it.' },
      { text: 'Hold LEFT click to charge the ray, let go to fire. RIGHT click grows things back.' },
    ],
    start: (s, m) => { m.data.objects = new Set(); m.data.tinyBefore = new Set(s.g.humans.filter((h) => h.tiny || h.scale < 0.5)); s.g.hands.select(0); },
    update: (s, m) => {
      const props = s.g.level.props?.children || [];
      if (m.step === 0) {
        s.setGoal('Shrink an object with the shrink ray', 'Aim at a box, a bin, the TV… anything in the lab');
        if (props.some((o) => (o.userData.k ?? 1) < 0.95)) { m.step = 1; s.toast('It WORKS! 🎉'); s.say('you', 'IT WORKS! Now… a real test. A person.'); }
        return null;
      }
      s.setGoal('Shrink a person', 'Climb the ladder (E), go outside and zap someone in town');
      const victim = s.g.humans.find((h) => alive(h) && !m.data.tinyBefore.has(h) && h.scale < 0.5 && !h.villager);
      if (victim) { m.data.victim = victim; return 'done'; }
      return null;
    },
    outro: (s, m) => [
      { who: (x) => m.data.victim, text: 'WHAT?! What did you DO to me?!' },
      { who: 'you', text: 'Science. I did science to you.' },
    ],
  },

  // 2 ---------------------------------------------------------------------
  {
    title: 'A new home',
    prepare: (s, m) => {
      // continuing a saved story: someone is already tiny out there? if not, put one in the tank
      if (m.resumed && !s.g.humans.some((h) => alive(h) && h.tiny && !h.villager)) s.ensureCitizens(1);
    },
    intro: () => [
      { text: 'A tiny person can\'t live out on the street. Someone could step on them.' },
      { text: 'The terrarium in your lab has soil, water, a pond… it could be a whole little world.' },
      { text: 'Press 2 for the catching jar: click a tiny person to scoop them up, then click again at the terrarium to drop them in.' },
    ],
    update: (s, m) => {
      const c = s.citizens();
      if (m.step === 0) {
        s.setGoal('Put a tiny person in the terrarium', 'Jar (2): catch them, carry them home, drop them in the tank');
        if (c.length >= 1) { m.step = 1; m.data.first = c[0]; s.say(c[0], 'Where am I? Is that… a giant face?'); }
        return null;
      }
      s.setGoal('Feed them: pour crumbs into the tank', 'Supplies (3): press R until it says bread crumbs, then click over the tank');
      return m.data.fed ? 'done' : null;
    },
    onDrop: (s, m, kind) => { if (kind === 'food' && m.step === 1) m.data.fed = true; },
    outro: (s, m) => [
      { who: () => s.citizens()[0], text: 'Food! Real bread! …Okay. Maybe this place isn\'t so bad.' },
      { text: 'Your first citizen. Keep them fed and watered, or they won\'t last long.' },
    ],
  },

  // 3 ---------------------------------------------------------------------
  {
    title: 'Population: 3',
    needsPeople: true,
    prepare: (s, m) => { if (m.resumed) s.ensureCitizens(1); },
    intro: () => [
      { who: 'you', text: 'One person isn\'t a town. It\'s just a lonely guy in a box.' },
      { text: 'Every citizen brings their job with them: builders build faster, chefs feed everyone, cops keep order…' },
    ],
    start: (s, m) => { m.data.start = s.citizens().length; },
    update: (s) => {
      const n = s.citizens().length;
      s.setGoal(`Have 3 tiny citizens in the terrarium (${Math.min(n, 3)}/3)`, 'Shrink people in town, catch them with the jar, bring them home');
      return n >= 3 ? 'done' : null;
    },
    outro: (s) => [
      { who: () => s.citizens()[1], text: 'Hey, I know you! You\'re from the bakery, right?' },
      { who: () => s.citizens()[2], text: 'Great. Trapped in a fish tank with my neighbors.' },
      { text: 'Population: 3. A town is born.' },
    ],
  },

  // 4 ---------------------------------------------------------------------
  {
    title: 'Shelter',
    prepare: (s) => s.ensureCitizens(3),
    intro: () => [
      { who: () => null, text: 'Your citizens are sleeping on bare dirt. They need a campfire and a roof.' },
      { text: 'They build by themselves, but they need materials: wooden poles and stones. Tools help them gather more.' },
    ],
    start: (s, m) => { m.data.built0 = s.colony?.built.length ?? 0; },
    update: (s, m) => {
      const col = s.colony;
      if (!col) return 'done'; // (no tiny world in this build)
      const fire = col.built.includes('campfire');
      const shelter = col.built.some((b) => b !== 'campfire');
      const site = col.site ? ` · building: ${col.site.bp.name} ${Math.round(col.site.progress * 100)}%` : '';
      s.setGoal(fire ? 'Help them build a shelter' : 'Help them build a campfire, then a shelter',
        `Supplies (3): pour wooden poles and stones, or a tiny axe / pickaxe${site}`);
      return fire && shelter ? 'done' : null;
    },
    outro: (s) => [
      { who: () => s.citizens()[0], text: 'A ROOF! We have a roof!' },
      { text: 'Your tiny town has its first building. They cheer. You\'re kind of proud.' },
    ],
  },

  // 5 ---------------------------------------------------------------------
  {
    title: 'Mom\'s coming!',
    prepare: (s) => s.ensureCitizens(3),
    intro: (s) => [
      { text: 'Your phone buzzes.' },
      { who: () => momOf(s), text: 'Honey? I keep hearing tiny screaming from your room. I\'m coming up to check!' },
      { text: 'If Mom finds the hatch open, it\'s over. Get up to your bedroom before she does, and don\'t be holding anyone.' },
    ],
    start: (s, m) => {
      const mom = momOf(s);
      m.data.mom = mom;
      m.data.limit = 45;
      if (!mom) return;
      mom.storyRole = 'mom';
      m.data.oldBrain = mom.brain;
      const target = new THREE.Vector3(3.2, 3.3, -1.2); // your bedroom, just inside the door
      m.data.target = target;
      // (on a retry she may still be up there: she goes back to the kitchen first)
      const kitchen = s.g.level.house?.spots?.counter?.p;
      m.data.phase = kitchen && mom.position.distanceTo(target) < 4 ? 'kitchen' : 'up';
      mom.brain = () => {
        if (mom.state === 'away' || m.data.arrived) return true;
        if (m.data.phase === 'kitchen') {
          if (!m.data.walking) { m.data.walking = true; if (!mom.goTo(kitchen)) m.data.phase = 'up'; }
          else if (mom.position.distanceTo(kitchen) < 1.2) { m.data.phase = 'up'; m.data.walking = false; }
          return true;
        }
        if (!m.data.walking) { m.data.walking = true; mom.goTo(target, { run: false }); }
        return true;
      };
    },
    update: (s, m) => {
      const mom = m.data.mom;
      const left = Math.max(0, m.data.limit - m.t);
      const p = s.g.player;
      const inBedroom = p.feet.y > 3.0 && p.feet.x > 2.5 && p.feet.x < 7 && p.feet.z > -5 && p.feet.z < 0 && p.scale > 0.5;
      s.setGoal(`Get to your bedroom before Mom! (${fmtTime(left)})`, 'Up the ladder (E). Put any tiny person down first');
      if (!mom) return m.t > 5 ? 'done' : null;
      // she arrives (or the time runs out)
      const arrived = m.data.phase === 'up' && mom.agent && near(mom.position, m.data.target, 1.2);
      if (arrived || left <= 0) {
        m.data.arrived = true;
        const holding = s.g.hands.items.some((it) => it.held || it.inside);
        if (!inBedroom) return 'fail:Mom walked in, saw the hatch open… and climbed down. She found everything.';
        if (holding) return 'fail:Mom saw the tiny person in your hand. "What. Is. THAT."';
        return 'done';
      }
      return null;
    },
    outro: (s, m) => [
      { who: () => m.data.mom, text: 'Oh. You\'re just… here. Reading. Okay.' },
      { who: () => m.data.mom, text: 'Must be the pipes again. Dinner at seven!' },
      { who: 'you', text: '*phew*' },
    ],
    end: (s, m) => {
      const mom = m.data.mom;
      if (mom) { mom.brain = m.data.oldBrain; mom.storyRole = null; }
    },
  },

  // 6 ---------------------------------------------------------------------
  {
    title: 'Missing persons',
    needsPeople: true,
    prepare: (s) => s.ensureCitizens(3),
    intro: (s) => [
      { text: 'The town has noticed. Posters everywhere: MISSING. HAVE YOU SEEN THESE PEOPLE?' },
      { text: 'The police are asking questions. Your town needs a 4th citizen, but nobody can see you do it.' },
      { text: 'If someone sees you shrink a person, they call the cops (★). Lose them before you finish.' },
    ],
    start: (s, m) => { m.data.n0 = s.citizens().length; s.g.phone?.text?.('Police', 'Have you seen these people? Several residents are missing. Call us with any information.'); },
    update: (s, m) => {
      const n = s.citizens().length;
      const wanted = s.g.police?.wanted ?? 0;
      if (wanted > 0) {
        s.setGoal('You were seen! Lose the police', 'Hide until the ★ goes away (stay out of sight)');
        return null;
      }
      s.setGoal(`Bring home a 4th citizen without being seen (${Math.min(n, 4)}/4)`, 'Check that nobody is watching before you zap');
      return n >= Math.max(4, m.data.n0 + 1) ? 'done' : null;
    },
    outro: () => [
      { text: 'Nobody saw a thing. The police have no leads.' },
      { who: 'you', text: 'I\'m basically a ghost.' },
    ],
  },

  // 7 ---------------------------------------------------------------------
  {
    title: 'The Mayor',
    prepare: async (s, m) => {
      s.ensureCitizens(4);
      // the mayor gives a speech by the fountain in the park
      const spot = s.g.level.town?.spots?.find((p) => p.name === 'fountain');
      if (!spot || !s.spawnPerson) return;
      m.data.loading = true;
      const mayor = await s.spawnPerson('Business_Male_01', { name: 'Mayor Bigsby', job: 'mayor', at: spot.p }).catch(() => null);
      m.data.loading = false;
      if (!mayor) return;
      mayor.storyRole = 'mayor';
      mayor.isMayor = true;
      m.data.mayor = mayor;
      mayor.brain = () => {
        if (mayor.tiny || mayor.state !== 'idle' && mayor.state !== 'walking') return false;
        mayor.speechT = (mayor.speechT ?? 0) - 1 / 60;
        if (mayor.speechT <= 0) {
          mayor.speechT = 9;
          s.g.speech.say(mayor, ['…and THAT is why this town needs a new parking lot!', 'Vote Bigsby! Big town, big dreams!', 'People keep going missing? Nonsense. Nobody is missing.'][(Math.random() * 3) | 0], { secs: 5 });
          mayor.character.play('talking_01');
        }
        return true;
      };
    },
    intro: (s, m) => [
      { text: 'Every town needs a leader. Yours needs one too.' },
      { text: 'Mayor Bigsby is giving a speech by the fountain in the park right now.' },
      { who: 'you', text: 'Why find a new mayor when I can just… borrow the real one?' },
    ],
    update: (s, m) => {
      const mayor = m.data.mayor;
      if (m.data.loading) { s.setGoal('…'); return null; }
      if (!mayor) return 'done'; // (couldn't load: skip)
      if (mayor.dead) return 'fail:The mayor didn\'t survive. The whole town is in mourning.';
      if (mayor.state === 'caged') { s.state.mayor = mayor.profile.name; return 'done'; }
      s.setGoal(mayor.tiny ? 'Bring the tiny mayor to your terrarium' : 'Shrink Mayor Bigsby (by the fountain in the park)', mayor.tiny ? 'Jar (2), then drop him in the tank' : 'There are a lot of witnesses. Be quick!');
      return null;
    },
    outro: (s, m) => [
      { who: () => m.data.mayor, text: 'Do you know who I AM?! I am the MAYOR!' },
      { who: () => s.citizens().find((h) => h !== m.data.mayor), text: 'Not anymore, buddy. Down here you\'re just Bob.' },
      { who: () => m.data.mayor, text: '…Fine. But I\'m still in charge. Everyone, a meeting by the fire!' },
      { text: 'Your tiny town has a mayor. He immediately promises a parking lot.' },
    ],
    end: (s, m) => { if (m.data.mayor) { m.data.mayor.brain = null; m.data.mayor.storyRole = null; } },
  },

  // 8 ---------------------------------------------------------------------
  {
    title: 'Escape attempt',
    prepare: (s) => s.ensureCitizens(4),
    intro: (s) => [
      { text: 'CRACK. A corner of the terrarium glass has a crack in it.' },
      { who: () => s.citizens()[0], text: 'NOW! Everybody RUN!' },
      { text: 'Some of your citizens squeeze out onto the lab floor. If they reach the wall, they\'re gone for good.' },
    ],
    start: (s, m) => {
      const list = s.citizens().filter((h) => !h.isMayor).slice(0, 2);
      m.data.runners = [];
      for (const h of list) if (escapeCage(h)) m.data.runners.push(h);
      m.data.limit = 120;
      s.g.hands.select(1);
    },
    update: (s, m) => {
      const run = m.data.runners;
      const free = run.filter((h) => alive(h) && h.state !== 'caged');
      const left = Math.max(0, m.data.limit - m.t);
      s.setGoal(`Catch the runaways (${run.length - free.length}/${run.length}) · ${fmtTime(left)}`, 'Jar (2): scoop them off the floor and put them back in the tank');
      if (!run.length || !free.length) return 'done';
      if (left <= 0) {
        // the ones still loose make it to the wall
        for (const h of free) { s.state.care.lost++; h.state = 'away'; h.character.root.visible = false; if (h.agent) { h.nav.removeAgent(h.agent); h.agent = null; } if (h.capsule) { h.physics.removeCapsule(h.capsule); h.capsule = null; } }
        m.data.lost = free.length;
        return 'done';
      }
      return null;
    },
    outro: (s, m) => (m.data.lost
      ? [{ text: `${m.data.lost} of them squeezed through a crack in the wall. They're gone.` }, { who: 'you', text: 'They\'ll be back. They always come back… right?' }]
      : [{ who: () => m.data.runners[0], text: 'So close! We were SO close!' }, { text: 'Everyone is back in the tank. You tape up the crack.' }]),
  },

  // 9 ---------------------------------------------------------------------
  {
    title: 'Rebellion?',
    prepare: (s) => s.ensureCitizens(3),
    intro: (s) => (s.kindness() >= 50
      ? [
        { text: 'Something is going on in the terrarium. They\'re all gathered around the fire…' },
        { who: () => s.citizens()[0], text: 'SURPRISE! We\'re throwing a party for the Giant!' },
        { text: 'You\'ve been a good ruler. They actually like you.' },
      ]
      : [
        { text: 'Something is going on in the terrarium. They\'ve stopped working.' },
        { who: () => s.citizens()[0], text: 'We\'re hungry, we\'re scared, and we\'re DONE. No more work for the Giant!' },
        { text: 'This is a rebellion. Win them back: feed them, give them water, and don\'t hurt anyone.' },
      ]),
    start: (s, m) => {
      m.data.party = s.kindness() >= 50;
      for (const h of s.citizens()) {
        const r = s.colony?.residents.get(h);
        if (m.data.party) { h.emotion.joy = 1; r?.halt?.(); h.character.play(['dancing_silly', 'dancing_cool', 'dancing_neutral'][(Math.random() * 3) | 0], { loop: true }); }
        else { h.emotion.anger = 0.9; h.character.setEmotion?.('anger', 0.8); }
      }
    },
    update: (s, m) => {
      if (m.data.party) {
        const p = s.g.player;
        s.setGoal('Go see the party', 'Walk up to the terrarium (or press F there to shrink yourself in and join!)');
        return s.cage?.canDropFrom(s.g.camera.position) || p.inCage ? 'done' : null;
      }
      const w = s.wellbeing() ?? 1;
      s.setGoal(`Win them back (happiness ${Math.round(w * 100)}% / 70%)`, 'Supplies (3): crumbs and seeds. They need water too: the pond. Don\'t hurt anyone');
      if (w >= 0.7 && m.t > 20) return 'done';
      return null;
    },
    outro: (s, m) => (m.data.party
      ? [{ who: () => s.citizens()[1], text: 'Three cheers for the Giant! Hip hip—' }, { text: 'HOORAY! The tiny town loves you.' }]
      : [{ who: () => s.citizens()[0], text: 'Fine. FINE. We\'ll go back to work. But we\'re watching you.' }]),
    end: (s) => { for (const h of s.citizens()) { h.character.stopOneShot?.(0.3); h.emotion.anger = Math.min(h.emotion.anger, 0.3); } },
  },

  // 10 --------------------------------------------------------------------
  {
    title: 'The Final Day',
    prepare: (s) => s.ensureCitizens(3),
    intro: (s) => [
      { text: 'Your phone explodes with messages.' },
      { text: '"POLICE ARE ON YOUR STREET. THEY HAVE A WARRANT. THEY KNOW."' },
      { who: 'you', text: 'Oh no. Oh no no no.' },
      { text: 'Survive the raid. If they catch you, it\'s over.' },
    ],
    start: (s, m) => {
      m.data.limit = 150;
      const pol = s.g.police;
      if (pol) {
        m.data.arrest = pol.onArrest;
        pol.onArrest = (cop) => { m.data.caught = true; m.data.arrest?.(cop); };
        pol.raise?.(3, s.g.level.home?.clone?.() ?? s.g.player.feet.clone(), 'The police are raiding your house!');
      }
    },
    update: (s, m) => {
      const left = Math.max(0, m.data.limit - m.t);
      s.setGoal(`Don't get caught! (${fmtTime(left)})`, 'Hide, run, or… shrink yourself small enough that they can\'t find you');
      if (m.data.caught) return 'done';
      if (left <= 0) return 'done';
      return null;
    },
    outro: (s, m) => (m.data.caught ? [{ text: 'The handcuffs click.' }] : [{ text: 'The sirens fade away. They didn\'t find you.' }]),
    end: (s, m) => {
      const pol = s.g.police;
      if (pol && m.data.arrest) pol.onArrest = m.data.arrest;
      if (m.data.caught) { s.finish('busted'); return 'handled'; }
      if (pol) pol.wanted = 0;
      const kind = s.kindness() >= 50;
      if (kind) {
        s.play([
          { text: 'When you get back to the lab, the tiny people are waiting for you.' },
          { who: () => s.citizens()[0], text: 'We hid every bit of evidence while they searched. Nobody\'s taking OUR giant.' },
          { text: 'In the middle of their town stands something new: a statue. Of you.' },
        ], () => { addStatue(s); s.finish('kind'); });
      } else {
        s.play([
          { text: 'When you get back to the lab, it\'s… quiet. Too quiet.' },
          { who: () => s.citizens()[0], text: 'Hey, Giant. Looking for THIS?' },
          { text: 'They\'ve dragged the shrink ray to the edge of the tank. All of them, pushing the trigger together.' },
          { text: 'ZAP.', act: (x) => x.g.player.resizeTo?.(0.05) },
        ], () => s.finish('overthrown'));
      }
      return 'handled';
    },
  },
];

const ENDINGS = {
  kind: { title: '😇 The Kind Ruler', text: 'Your tiny town thrives. They grow crops, light fires, argue about the parking lot, and every morning someone polishes your statue. You never shrank anyone again… well, almost never.' },
  overthrown: { title: '😈 Overthrown', text: 'You ruled with fear, and fear doesn\'t last. Now you\'re the tiny one, and the new rulers of the terrarium have some ideas about how to treat you.' },
  busted: { title: '🚔 Busted', text: 'The police found the lab, the ray, and a fish tank full of missing people. Everyone was grown back. You get a very long time to think about what you did.' },
};

// ---- helpers used by the missions

function momOf(s) {
  const f = s.g.family;
  if (!f) return null;
  return (f.members || []).find((h) => h.profile.name === 'Mom' && alive(h)) || s.g.humans.find((h) => h.profile.name === 'Mom' && alive(h)) || null;
}

// out of the tank onto the lab floor, tiny, scared, running
function escapeCage(h) {
  const cage = h.cage;
  if (!cage) return false;
  cage.colony?.leave(h);
  cage.residents.delete(h);
  const out = cage.exitPoint(h.character.root.getWorldPosition(new THREE.Vector3()));
  out.x += (Math.random() - 0.5) * 0.6;
  h.cage = null;
  h.emotion.fear = 0.9;
  h.placeAt(out, cage.group.parent ?? h.character.root.parent);
  return true;
}

// a little stone statue of you in the middle of their town
function addStatue(s) {
  const col = s.colony;
  if (!col?.center) return;
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a978f, roughness: 0.9 });
  const g = new THREE.Group();
  const add = (geo, y) => { const m = new THREE.Mesh(geo, stone); m.position.y = y; m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.03, 0.034, 0.02, 16), 0.01);           // plinth
  add(new THREE.CapsuleGeometry(0.012, 0.03, 4, 10), 0.05);               // body
  add(new THREE.SphereGeometry(0.014, 14, 10), 0.085);                    // big head
  const arm = add(new THREE.CapsuleGeometry(0.004, 0.026, 4, 8), 0.07);   // waving arm
  arm.position.x = 0.016; arm.rotation.z = -0.6;
  g.position.copy(col.center).add(new THREE.Vector3(0.06, 0, 0.04));
  col.world.add(g);
}
