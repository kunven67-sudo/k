// The story: Dr. Elias Voss, Specimen 8, the notes he left on every floor, the opening cutscene, the breakout,
// hints the first time you need a control, news + social posts, the cinematic size jumps between worlds.
import * as THREE from 'three';
import { elev, PLAYABLE, FLOOR_NAMES } from '../world/tower.js';
import { ZONE_TITLE } from '../world/zones.js';
import { clamp, sizeText, asBig } from '../core/util.js';

export const NOTES = {
  voss1: { title: 'Specimen 8 - log, day 41', by: 'E. Voss', text: 'Dose 4 administered at 23:50. L. hesperus female, 4.0 mm before the dose.\n\nSeven failed. Every one of them collapsed past 2 cm: the shell can\'t hold the body. This one keeps molting. Every molt the shell comes back thicker.\n\nIf it holds, we have what the board wanted. A creature that survives anything.' },
  voss2: { title: 'Private', by: 'E. Voss', text: 'The Marshall contract wants soldiers that heal. That don\'t feel cold, or vacuum, or radiation.\n\nI want more than that. I want to never die.\n\nEight survives because it EATS what would kill it. I started the low doses on myself tonight. Two drops.\n\nI feel fine. Better than fine.' },
  voss3: { title: 'Feed prep, floor 47', by: 'E. Voss', text: 'Moved R-2 (the hissing roach) to the 4-dose regimen. It\'s 9 cm. It hisses at me through the glass.\n\nThe serum doesn\'t care what it\'s in. It only wants it to grow.' },
  voss4: { title: 'Board meeting, 11/03', by: 'E. Voss', text: 'Marshall asked what happens if it gets out.\nI said: it won\'t.\nI said: and if it does, we follow it. We study it. It will be the most important thing that ever happened.\n\nThey laughed. They won\'t be laughing.' },
  voss5: { title: 'Dose log (personal)', by: 'E. Voss', text: 'Six drops. My hands don\'t shake anymore. I don\'t sleep.\n\nI can hear the building. Every footstep, every floor.\n\nIs this how Eight hears the world?' },
  voss6: { title: 'Standing order', by: 'E. Voss', text: 'If Eight reaches the street: activate the black team. Tranquilizers, nets, foam.\n\nALIVE.\n\nWhatever it becomes, it belongs to me.' },
  voss7: { title: 'To security', by: 'E. Voss', text: 'Dr. Voss is not to be disturbed.\n\nAnything leaving floor 48 is to be contained. Not killed. NOT. KILLED.' },
  spec1: { title: 'SPECIMEN 1', by: 'archive', text: 'L. mactans. Dose 1. Day 9.\nThe shell split open in the middle of a molt at 2.1 cm. Archived.' },
  spec2: { title: 'SPECIMEN 2', by: 'archive', text: 'Dose 1.5. Molted six times in four hours, then starved to death between molts. It never got the chance to eat.' },
  spec3: { title: 'SPECIMEN 3', by: 'archive', text: 'Dose 2. At 3 cm its legs could not hold its weight. It could not walk. Euthanized.' },
  spec4: { title: 'SPECIMEN 4', by: 'archive', text: 'Dose 2. Ate Specimen 3 through the glass. Then it stopped eating anything. Archived.' },
  spec5: { title: 'SPECIMEN 5', by: 'archive', text: 'Dose 2.5. Escaped. Found in the air duct two days later. 9 cm. Dried out.' },
  spec6: { title: 'SPECIMEN 6', by: 'archive', text: 'Dose 3. Developed... something. It dissolved its own shell from the inside.\n\nDo not open this jar.' },
  spec7: { title: 'SPECIMEN 7', by: 'archive', text: 'Dose 3.5. Reached 5 cm. Bit Dr. Hale (Hale is fine). Terminated by order of the board.\n\nI disagreed. - E.V.' },
  rec47: { title: 'Sticky note, floor 47', by: 'animal tech', text: 'WHOEVER LEFT R-2\'S TANK CRACKED: it\'s loose on 47. If you see it do NOT touch it, call Voss.\n\nAlso the mice in rack 2 chewed out AGAIN.' },
  rec31: { title: 'Sticky note, floor 31', by: 'office', text: 'Weird scratching in the ceiling above my desk again. Facilities says rats.\n\nSince when do we have rats on 31?' },
  rec20: { title: 'Kitchen whiteboard, floor 20', by: 'night crew', text: 'STOP leaving trash out. There was a rat the size of a cat in the walk-in cooler.' },
  rec9: { title: 'IT log, floor 9', by: 'IT', text: 'Rack 4-11 shows heat spikes at night. Something warm is living in the cable trays.' },
};

const HINTS = {
  move: ['WASD', 'Walk. Walk into a wall to climb it. Spiders walk on anything.'],
  look: ['MOUSE', 'Look around. Mouse wheel = zoom.'],
  bite: ['LEFT CLICK', 'Bite. Venom paralyzes.'],
  eat: ['E', 'Eat what you paralyzed or webbed. Big prey gets wrapped first.'],
  web: ['RIGHT CLICK', 'Shoot a web ball. Flies are too fast to catch any other way.'],
  zip: ['F', 'Shoot a line at what you aim at and zip to it. Jump first to swing.'],
  drop: ['X', 'Drop down on a silk line. W climbs back up.'],
  molt: ['M', 'Molt when your skin is full. You come out bigger.'],
  lair: ['L', 'Spin a lair. Rest there (R) to save.'],
};

export class Story {
  constructor(game) { this.game = game; this.reset(); }
  reset(saved) {
    this.flags = saved ? { ...saved.flags } : { escaped: false, lair: false, firstHuman: false };
    this.notes = saved ? { ...saved.notes } : {};
    this.hintsShown = {}; this.cut = null; this.transitioning = false; this.musicOverride = null; this.feedT = 0; this.alarmT = 0;
  }
  saveState() { return { flags: this.flags, notes: this.notes }; }

  // ------------------------------------------------------------------ opening: Voss injects you
  play(name) {
    if (name !== 'injection') return;
    const G = this.game, Z = G.zone, F = Z.floors[48], T = F.ctx.tank, p = G.player;
    G.state = 'cutscene'; G.controlsOn = false; G.hud.show(false); G.hud.cinema(true);
    const voss = Z.humans.list.find(h => h.role === 'voss');
    const Y = elev(48);
    const tankC = new THREE.Vector3(T.x, T.y + 0.1, T.z);
    const sp = p.pos.clone();
    this.cut = { t: 0, voss, steps: [], skipAt: 1.2 };
    const C = (pos, look, fov = 45, near = null) => { G.cam.mode = 'cinematic'; G.cam.cine = { pos: pos.clone(), look: look.clone(), fov, near }; };
    const syr = makeSyringe(); syr.visible = false; Z.scene.add(syr); this.cut.syr = syr;
    const say = (who, txt, t) => G.hud.subtitle(who, txt, t, p.sizeM);
    const S = [
      [0.0, () => { G.hud.title('VOSS BIOGENETICS', 'Floor 48  -  11:47 PM', 4); C(new THREE.Vector3(-13.4, Y + 1.65, -7.6), new THREE.Vector3(-9.2, Y + 1.0, -12.4), 50); G.audio.heartbeat(0.3); }],
      [0.1, (t) => { G.cam.cine.pos.lerp(new THREE.Vector3(-11.6, Y + 1.45, -9.3), 0.004); }, 4.6],
      [4.6, () => { C(sp.clone().add(new THREE.Vector3(0.028, 0.006, -0.03)), sp.clone().add(new THREE.Vector3(0, 0.002, 0)), 40); }],
      [4.7, (t) => { G.cam.cine.pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0); G.cam.cine.pos.lerp(sp.clone().add(new THREE.Vector3(-0.02, 0.01, -0.035)), 0.01); }, 2.6],
      [7.3, () => { C(sp.clone().add(new THREE.Vector3(0.01, 0.006, -0.012)), new THREE.Vector3(-9.25, Y + 1.72, -13.0), 55); if (voss) { voss.yaw = 0; voss.play('Idle'); } }],
      [7.6, () => say('Dr. Elias Voss', 'Specimen 8. Let\'s try again.', 3.6)],
      [9.0, () => { this.lidUp = 0; }],
      [9.0, (t, dt) => { this.lidUp = Math.min(1, (this.lidUp || 0) + dt * 0.8); Z.setLid && Z.setLid(this.lidUp); }, 1.6],
      [10.5, () => { C(sp.clone().add(new THREE.Vector3(0.03, 0.012, 0.0)), sp.clone().add(new THREE.Vector3(0, 0.004, 0)), 38); syr.visible = true; syr.position.copy(sp).add(new THREE.Vector3(0, 0.11, 0)); if (voss) voss.play('Interact'); }],
      [10.5, (t, dt) => { syr.position.y = Math.max(sp.y + p.s * 0.55, syr.position.y - dt * 0.05); }, 2.2],
      [12.6, () => { G.audio.bite(); G.cam.addShake(0.4); p.rig.excite = 1; G.renderer.grade.uniforms.get('flash').value = 0.0; this.dose = 0; }],
      [12.9, (t, dt) => { syr.position.y += dt * 0.08; }, 1.5],
      [13.2, () => { C(sp.clone().add(new THREE.Vector3(-0.012, 0.022, -0.02)), sp.clone(), 62); G.audio.heartbeat(0.8); }],
      [13.2, (t, dt) => { // blur, heartbeat, the body twitches and swells
        this.dose += dt; const k = this.dose;
        G.dofOverride = [1, G.camera.position.distanceTo(p.pos), p.s * 0.6]; G.renderer.vignette.darkness = 0.6 + Math.min(0.35, k * 0.1);
        if (Math.floor(k * 1.4) !== Math.floor((k - dt) * 1.4)) G.audio.heartbeat(0.9);
        p.targetSize = 0.004 * (1 + Math.min(0.14, k * 0.04)); p.sizeM = p.targetSize;
        p.body.position.copy(p.pos).add(new THREE.Vector3((Math.random() - 0.5) * p.s * 0.03, 0, (Math.random() - 0.5) * p.s * 0.03));
        G.renderer.grade.uniforms.get('saturation').value = 1 - Math.min(0.6, k * 0.18);
      }, 3.4],
      [16.6, () => { G.dofOverride = null; G.renderer.vignette.darkness = 0.6; G.renderer.grade.uniforms.get('saturation').value = 1; syr.visible = false; this.lidUp = 1; C(new THREE.Vector3(T.x + 0.12, T.y + 0.06, T.z - T.D / 2 - 0.12), new THREE.Vector3(T.x + T.W / 2 - 0.06, T.y + 0.025, T.z - T.D / 2), 40); }],
      [16.6, (t, dt) => { this.lidUp = Math.max(0, this.lidUp - dt * 1.2); Z.setLid && Z.setLid(this.lidUp); }, 1.0],
      [17.2, () => { Z.crackTank && Z.crackTank(); G.audio.at('glass', new THREE.Vector3(T.x + T.W / 2 - 0.06, T.y, T.z - T.D / 2)); G.cam.addShake(0.5); }],
      [18.2, () => { say('Dr. Elias Voss', '...no. No, no, no.', 2.6); C(new THREE.Vector3(-8.4, Y + 1.3, -14.6), new THREE.Vector3(-9.25, Y + 1.5, -13.0), 50); if (voss) voss.play('Run_Back') }],
      [19.6, () => { Z.alarm && Z.alarm(true); G.audio.at('alarm', G.camera.position); }],
      [21.0, () => this.endCut()],
    ];
    this.cut.steps = S.map(([at, fn, dur]) => ({ at, fn, dur: dur || 0, done: false }));
  }
  endCut() {
    const G = this.game, Z = G.zone, c = this.cut; if (!c) return;
    if (c.syr) c.syr.removeFromParent();
    Z.setLid && Z.setLid(0); Z.crackTank && Z.crackTank();
    Z.alarm && Z.alarm(true);
    const voss = c.voss; if (voss) { voss.state = 'walk'; voss.path = [new THREE.Vector3(-9.25, voss.pos.y, -14.5), new THREE.Vector3(-13, voss.pos.y, -9.5), new THREE.Vector3(-13, voss.pos.y, -7.5), new THREE.Vector3(-3.5, voss.pos.y, -6.4)]; voss.pathI = 0; voss.onPathEnd = 'leave'; }
    G.dofOverride = null; G.renderer.grade.uniforms.get('saturation').value = 1; G.renderer.vignette.darkness = 0.6;
    G.player.targetSize = G.player.sizeM = 0.0046;
    G.cam.mode = 'orbit'; G.cam.cine = null; G.cam.yaw = Math.PI; G.cam.pitch = 0.35;
    this.cut = null;
    G.hud.cinema(false); G.hud.show(true);
    G.startPlay();
    G.hud.objective('Get out of the tank. The crack in the front glass.');
    setTimeout(() => this.hint('move'), 800); setTimeout(() => this.hint('look'), 5000);
  }
  update(dt) {
    const G = this.game, c = this.cut;
    if (c) {
      c.t += dt;
      for (const s of c.steps) {
        if (c.t < s.at) continue;
        if (!s.done) { s.done = true; s.fn(0, dt); }
        else if (s.dur && c.t < s.at + s.dur) s.fn(c.t - s.at, dt);
      }
      if (c.t > c.skipAt && (G.input.hit('jump') || G.input.pressed.has('Enter') || G.input.pressed.has('Escape'))) this.endCut();
      return;
    }
    if (G.state !== 'play' || !G.player || !G.zone) return;
    const p = G.player, Z = G.zone;
    // the breakout: out of the tank
    if (!this.flags.escaped && Z.floors && Z.floors[48]) {
      const T = Z.floors[48].ctx.tank;
      const out = Math.abs(p.pos.x - T.x) > T.W / 2 + 0.003 || Math.abs(p.pos.z - T.z) > T.D / 2 + 0.003 || p.pos.y > T.y + T.H + 0.02;
      if (out) { this.flags.escaped = true; G.hud.objective('Escape the VOSS tower. Eat, grow, find a way down.'); G.hud.toast('You\'re out. CONTAINMENT BREACH - floor 48.', 3); G.wanted.alert(1, p.pos); setTimeout(() => this.hint('bite'), 2500); setTimeout(() => this.hint('web'), 9000); setTimeout(() => this.hint('eat'), 16000); }
    }
    // hints by situation
    if (p.mode === 'ground' && p.up.y < 0.3 && !this.hintsShown.zip) setTimeout(() => this.hint('zip'), 1000);
    if (p.molt >= 1) this.hint('molt');
    if (this.flags.escaped && G.runTime > 240) this.hint('lair');
    // floor title when you arrive somewhere new
    if (Z.floorAt) { const f = Z.floorAt(p.pos); if (f && f !== this.lastFloor) { this.lastFloor = f; if (FLOOR_NAMES[f]) G.hud.title(FLOOR_NAMES[f], 'VOSS BIOGENETICS', 2.5); } }
    // the news + social feed grows with you
    this.feedT -= dt;
    if (this.feedT <= 0) { this.feedT = 20 + Math.random() * 25; this.news(); }
  }
  hint(k) { if (this.hintsShown[k] || !this.game.settings.hints) return; this.hintsShown[k] = true; const h = HINTS[k]; if (h) this.game.hud.hint(k, h[1], h[0]); }
  readNote(id) {
    const n = NOTES[id]; if (!n) return;
    this.notes[id] = true; this.game.stats.notes[id] = true;
    this.game.menus.note(n);
  }
  firstHuman(h) {
    if (this.flags.firstHuman) return; this.flags.firstHuman = true;
    const G = this.game; G.slowmo = 2.2; G.hud.toast('The first one. They will never stop hunting you now.', 4); G.wanted.alert(3, h.pos);
  }
  posted(h) { const G = this.game; G.hud.feed('@' + h.name.split(' ')[0].toLowerCase() + '_' + Math.floor(Math.random() * 99), pick(['ok WHAT is this spider. floor ' + (h.floor || '?') + ' at VOSS', 'this thing is NOT normal', 'black widow??? the size of my HAND???', 'they told us the lab was empty']), Math.floor(200 + Math.random() * 90000)); }
  news() {
    const G = this.game, p = G.player; if (!p || !this.flags.escaped) return;
    const m = p.sizeM;
    if (m < 0.03) return;
    const lines = m < 0.3 ? ['Reports of a large spider at VOSS Biogenetics tower. Company says: "routine pest control."', 'Night staff evacuated from two floors of the VOSS tower downtown.'] :
      m < 3 ? ['BREAKING: something the size of a dog is loose inside the VOSS tower. Police are on scene.', 'VOSS CEO Dr. Elias Voss: "There is no danger to the public."'] :
      m < 100 ? ['BREAKING: "SPECIMEN 8" - the giant spider is in the streets of New Halvern. Stay indoors.', 'National Guard deployed to New Halvern.'] :
      ['It is taller than the towers. New Halvern is being evacuated.', 'The President will address the nation on Specimen 8 tonight.'];
    G.hud.feed('NEWS', pick(lines), null, true);
  }
  // ------------------------------------------------------------------ cinematic jump to the next world
  async transition(next) {
    const G = this.game; if (this.transitioning) return; this.transitioning = true;
    G.state = 'transition'; G.controlsOn = false;
    G.hud.fade(1, 1.6);
    await new Promise(r => setTimeout(r, 1700));
    try { await G.enterZone(next, { from: G.zone.id }); } catch (e) { console.error(e); }
    G.hud.title(ZONE_TITLE[next] || next, 'You are ' + sizeText(G.player.sizeM) + ', as big as ' + asBig(G.player.sizeM), 4);
    G.hud.fade(0, 2.0);
    G.startPlay();
    this.transitioning = false;
  }
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

function makeSyringe() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 16), glass); barrel.position.y = 0.045;
  const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x40ff7a, emissive: 0x20a040, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 })); liq.position.y = 0.03;
  const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xdddddd })); plunger.position.y = 0.09;
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.00025, 0.0004, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.2 })); needle.position.y = 0.0;
  g.add(barrel, liq, plunger, needle);
  return g;
}
