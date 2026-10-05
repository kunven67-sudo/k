// Witnesses and the police. Anyone who sees you shrink, grab, throw or squish
// someone reacts: scared people run, brave people call the police. Each call
// raises your wanted level (stars); officers drive in from the edge of town and
// chase you while they can see you. Caught at normal size = busted (sent home).
// Giants are too big to arrest (they call for backup), and a tiny you is too
// small to spot. Out of sight long enough, the wanted level cools down.
import * as THREE from 'three';
import { GROUP, groups } from './engine/physics.js';

const SEVERITY = { shrink: 1, kidnap: 0.8, grab: 0.6, throw: 1, kill: 2, punch: 0.4 };
const WITNESS_LINES = {
  scared: ['Oh my god!', 'What the—?!', 'AAAH!', 'No no no no', 'Run!'],
  brave: ['Hey! Stop that!', 'I\'m calling the police!', 'Somebody call 911!', 'I saw that!', 'You psycho!'],
};
const COP_LINES = {
  chase: ['Stop! Police!', 'Freeze!', 'Hands where I can see them!', 'Stop right there!', 'Don\'t move!'],
  lost: ['Where did they go?', 'Suspect lost...', 'They were just here!'],
  giant: ['We need backup! A LOT of backup!', 'Dispatch, the suspect is... huge', 'Nobody shoot! Just... stay back!'],
  arrest: ['You\'re under arrest!', 'Got you!', 'You have the right to remain silent'],
};
const pick = (a) => a[(Math.random() * a.length) | 0];
const SIGHT = groups(GROUP.NPC, GROUP.WORLD | GROUP.PROP);

export class Police {
  constructor({ humans, player, physics, nav, speech, toast, spawnOfficer, onArrest, area = null }) {
    Object.assign(this, { humans, player, physics, nav, speech, toast, spawnOfficer, onArrest, area });
    this.wanted = 0;        // 0..5 stars
    this.lastSeen = null;   // where the police last saw you
    this.unseen = 0;        // seconds since an officer saw you
    this.calls = [];        // witnesses on the phone: { h, t, sev, pos }
    this.cops = new Set();
    this.dispatching = 0;   // officers on the way
    this.el = document.getElementById('wanted');
    for (const h of humans) if (/^Police_/.test(h.profile.look || '')) this.enlist(h);
  }

  enlist(h) {
    h.isCop = true;
    this.cops.add(h);
    h.brain = (dt) => this.copBrain(h, dt);
  }

  // where your eyes are, and can `h` see point p from where they stand?
  eyeOf(h) {
    const head = h.character.bones.Bip01_Head;
    return head ? head.getWorldPosition(new THREE.Vector3()) : h.position.clone().setY(h.position.y + 1.6 * h.scale);
  }

  canSee(h, p, range = 30) {
    const eye = this.eyeOf(h);
    const to = p.clone().sub(eye);
    const d = to.length();
    if (d > range) return false;
    // behind them and far: didn't notice (close by, they hear it)
    const fwd = new THREE.Vector3(Math.sin(h.yaw), 0, Math.cos(h.yaw));
    if (d > 6 && fwd.dot(to.clone().setY(0).normalize()) < -0.1) return false;
    const hit = this.physics.raycast(eye, to.normalize(), d, { filterGroups: SIGHT, exclude: h.capsule?.collider });
    return !hit || hit.distance > d - 0.4;
  }

  // something bad happened at `pos` (you did it)
  crime(kind, pos, victim = null) {
    const sev = SEVERITY[kind] ?? 0.5;
    let seen = 0;
    for (const h of this.humans) {
      if (h === victim || h.dead || !h.alive || h.tiny || h.scale < 0.5) continue;
      if (!['idle', 'walking'].includes(h.state)) continue;
      if (!this.canSee(h, pos)) continue;
      seen++;
      this.witness(h, sev, pos);
    }
    return seen;
  }

  witness(h, sev, pos) {
    h.emotion.fear = Math.min(1, h.emotion.fear + 0.5);
    h.memory ??= { met: false, kind: 0, mean: 0, last: '' };
    h.memory.mean += sev;
    if (h.isCop) {
      this.speech?.say(h, pick(COP_LINES.chase), { shout: true });
      this.raise(sev, this.player.feet.clone(), 'An officer saw you!');
      return;
    }
    const brave = (h.profile.personality?.bravery ?? 0.5) > 0.4;
    this.speech?.say(h, pick(brave ? WITNESS_LINES.brave : WITNESS_LINES.scared), { shout: true });
    if (brave && !this.calls.some((c) => c.h === h)) {
      // stop, take out the phone, call it in
      h.agent?.resetMoveTarget();
      h.state = 'idle';
      h.timer = 6;
      h.spot = null;
      h.character.play('cell_phone_talk_01');
      this.calls.push({ h, t: 3.5, sev, pos: pos.clone() });
    } else {
      const here = h.position;
      const away = this.nav.randomPoint((q) => Math.hypot(q.x - pos.x, q.z - pos.z) > Math.hypot(here.x - pos.x, here.z - pos.z) + 5 && Math.abs(q.y - here.y) < 0.6);
      if (away) h.goTo(away, { run: true });
    }
  }

  raise(sev, where, msg) {
    const before = Math.ceil(this.wanted);
    this.wanted = Math.min(5, this.wanted + sev);
    this.lastSeen = where;
    this.unseen = 0;
    if (Math.ceil(this.wanted) > before) this.toast?.(`${msg} Wanted: ${'★'.repeat(Math.ceil(this.wanted))}`);
    // more stars, more officers
    const want = Math.min(4, Math.ceil(this.wanted));
    const need = want - this.cops.size - this.dispatching;
    for (let i = 0; i < need; i++) this.dispatch();
  }

  // an officer arrives from far away (edge of town), heading for where you were seen
  dispatch() {
    if (!this.spawnOfficer) return;
    const p = this.player.feet;
    const start = this.nav.randomPoint((q) => Math.hypot(q.x - p.x, q.z - p.z) > 20 && (!this.area || this.area(q)), 60)
      || this.nav.randomPoint((q) => !this.area || this.area(q));
    if (!start) return;
    this.dispatching++;
    Promise.resolve(this.spawnOfficer(start)).then((h) => {
      this.dispatching--;
      if (!h) return;
      h.dispatched = true;
      this.enlist(h);
    }).catch(() => { this.dispatching--; });
  }

  // an officer's mind (returns true when it takes over from the normal townsperson brain)
  copBrain(h, dt) {
    if (this.wanted <= 0 && !h.dispatched) return false; // a normal day on the beat
    const p = this.player;
    h.copT = (h.copT ?? 0) - dt;
    if (h.copT > 0) return true;
    h.copT = 0.5;
    if (this.wanted <= 0) {
      // all clear: dispatched officers leave
      h.leaveT = (h.leaveT ?? 15) - 0.5;
      if (h.state !== 'walking') { const q = this.nav.randomPoint(this.area); if (q) h.goTo(q); }
      if (h.leaveT <= 0) this.retire(h);
      return true;
    }
    const feet = p.feet;
    const giant = p.scale > 3;
    const small = p.scale < 0.3;
    const eye = feet.clone().setY(feet.y + 1.5 * p.scale);
    const sees = !small && this.canSee(h, giant ? eye : feet.clone().setY(feet.y + 1.2 * p.scale), giant ? 80 : 35);
    if (sees) {
      this.lastSeen = feet.clone();
      this.unseen = 0;
      const d = Math.hypot(feet.x - h.position.x, feet.z - h.position.z);
      if (giant) {
        // keep their distance and call for backup
        if (!h.lastSaid || performance.now() - h.lastSaid > 5000) this.speech?.say(h, pick(COP_LINES.giant), { shout: true });
        if (d < 4 * p.scale) { const q = this.nav.randomPoint((r) => Math.hypot(r.x - feet.x, r.z - feet.z) > 5 * p.scale && Math.abs(r.y - h.position.y) < 1); if (q) h.goTo(q, { run: true }); }
        return true;
      }
      if (!h.lastSaid || performance.now() - h.lastSaid > 4000) this.speech?.say(h, pick(COP_LINES.chase), { shout: true });
      if (d < 1.1 && Math.abs(feet.y - h.position.y) < 1) { this.arrest(h); return true; }
      h.goTo(feet, { run: true });
    } else if (this.lastSeen) {
      const d = Math.hypot(this.lastSeen.x - h.position.x, this.lastSeen.z - h.position.z);
      if (d > 1.5) h.goTo(this.lastSeen, { run: true });
      else if (!h.lastSaid || performance.now() - h.lastSaid > 8000) {
        this.speech?.say(h, pick(COP_LINES.lost));
        // look around nearby
        const q = this.nav.randomPoint((r) => Math.hypot(r.x - this.lastSeen.x, r.z - this.lastSeen.z) < 10 && Math.abs(r.y - h.position.y) < 1);
        if (q) h.goTo(q, { run: true });
      }
    }
    return true;
  }

  arrest(cop) {
    this.speech?.say(cop, pick(COP_LINES.arrest), { shout: true, secs: 3 });
    this.wanted = 0;
    this.lastSeen = null;
    this.calls.length = 0;
    this.onArrest?.(cop);
  }

  retire(h) {
    this.cops.delete(h);
    if (h.dispatched) {
      h.dispose(h.character.root.parent);
      const i = this.humans.indexOf(h);
      if (i >= 0) this.humans.splice(i, 1);
    }
  }

  update(dt) {
    // calls in progress
    for (let i = this.calls.length - 1; i >= 0; i--) {
      const c = this.calls[i];
      if (c.h.dead || c.h.state === 'held' || c.h.tiny) { this.calls.splice(i, 1); continue; }
      c.t -= dt;
      if (c.t > 0) continue;
      this.calls.splice(i, 1);
      this.speech?.say(c.h, 'Police? Yes, I want to report...', { secs: 3 });
      this.raise(c.sev, c.pos, `${c.h.profile.name} called the police!`);
    }
    // nobody's seen you for a while: things cool down
    if (this.wanted > 0) {
      this.unseen += dt;
      if (this.unseen > 30) this.wanted = Math.max(0, this.wanted - dt / 20);
      if (this.wanted === 0) { this.lastSeen = null; this.toast?.('The police stopped looking for you'); }
    }
    this.draw();
  }

  draw() {
    if (!this.el) return;
    const n = Math.ceil(this.wanted);
    this.el.hidden = n === 0;
    if (!n) return;
    const html = `${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i>`;
    if (this.el.innerHTML !== html) this.el.innerHTML = html;
    this.el.classList.toggle('seen', this.unseen < 1);
  }
}
