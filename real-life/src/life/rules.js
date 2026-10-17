// Parents' rules + getting caught (master list §3 kid life, §0 "everything has a cause").
// Nothing is a dice roll: you get caught because someone SAW or HEARD you, because something is
// missing and they noticed when they went to use it, or because you weren't where you were
// supposed to be when they checked on you. Then they come find you and you choose: tell the
// truth, lie, blame your sibling, say sorry or talk back. What happens depends on the parent
// (strict / chill / overprotective / fun / doesn't care), how bad it was, if it's happened
// before, and whether your lie actually holds up against the evidence.
//
//   const rules = new Rules(life)      // listens to rule:maybe / rule:broken / rule:tattle
//   rules.grounded / rules.noScreens   // { until, why } or null
//   rules.allowedHere(pos) -> bool     // are you allowed to be here right now?

import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { el } from '../core/util.js';
import { openPanel, panelOpen } from '../ui/panel.js';
import { me } from './me.js';
import { LOTS, LOT_DEPTH, MAPLE, ELM, PARK } from '../world/layout.js';

// How bad each thing is (0..1) and what it's called when Mom brings it up.
const RULES = {
  cookie: { sev: 0.15, what: 'eating cookies without asking' },
  snooping: { sev: 0.35, what: 'going through our dresser' },
  stealing: { sev: 0.95, what: 'taking money from our dresser' },
  beer: { sev: 1, what: 'drinking beer' },
  'beer-sick': { sev: 1, what: 'drinking beer' },
  'bad-language': { sev: 0.45, what: 'using that kind of language' },
  outside: { sev: 0.5, what: 'leaving without asking' },
  night: { sev: 1, what: 'sneaking out at night' },
  bedtime: { sev: 0.25, what: 'being up past your bedtime' },
  screens: { sev: 0.4, what: 'using screens when you were banned' },
  grounded: { sev: 0.75, what: 'leaving the house while you\'re grounded' },
  shoplifting: { sev: 0.85, what: 'stealing from the store' },
  'skip-school': { sev: 0.9, what: 'skipping school' },
  homework: { sev: 0.3, what: 'not doing your homework' },
};
const STYLE_K = { strict: 1.5, overprotective: 1.25, chill: 0.65, fun: 0.55, 'doesnt-care': 0.2 };
const LOT = LOTS.find((l) => l.family);

save.registerSlice('rules', {
  create: () => ({ grounded: null, noScreens: null, history: {}, traces: [], lies: 0, liesCaught: 0, missingSince: null, warnedBed: -1, lastCheck: 0 }),
});

export class Rules {
  constructor(life) {
    this.life = life;
    this.queue = []; // incidents waiting for a parent to bring them up
    this.active = null; // { parent, incident, t }
    this._offs = [
      bus.on('rule:maybe', (e) => this._maybe(e)),
      bus.on('rule:broken', (e) => this._broken(e)),
      bus.on('rule:tattle', (e) => this._tattle(e)),
      bus.on('clock:hour', () => this._hourly()),
      bus.on('tv:changed', ({ channel }) => channel && this._screens()),
      bus.on('school:note', () => this._incident({ rule: 'homework', sev: 0.3, t: clock.total, evidence: 'call' })),
    ];
  }

  get d() {
    return save.slice('rules');
  }

  get people() {
    return this.life.people;
  }

  get grounded() {
    const g = this.d.grounded;
    return g && g.until > clock.total ? g : null;
  }

  get noScreens() {
    const g = this.d.noScreens;
    return g && g.until > clock.total ? g : null;
  }

  // ---------------------------------------------------------------------- where you may be
  inYard(p) {
    const x0 = LOT.x - 12;
    const x1 = LOT.x + 12;
    return p.x > x0 && p.x < x1 && p.z < -LOT_DEPTH.front + 0.5 && p.z > -LOT_DEPTH.back;
  }

  onOurStreet(p) {
    return (p.x > PARK.x0 && p.x < ELM.x - ELM.half && Math.abs(p.z) < LOT_DEPTH.back) || (p.x > PARK.x0 && p.x < PARK.x1 + 3);
  }

  allowedHere(p) {
    if (this.inYard(p)) return true; // our house + yard (grounded = this is all you get)
    if (this.grounded) return false;
    if (clock.age >= 16) return true;
    const perm = this.people.d.permissions;
    const ok = (k) => perm[k] && perm[k].until > clock.total;
    const style = this._strictest()?.rec.style;
    const dayOut = clock.hourFloat >= 7 && clock.hourFloat < 20;
    // Some families let older kids play on the street without asking (in the daytime).
    if (dayOut && this.onOurStreet(p) && (style === 'doesnt-care' || (style === 'chill' && clock.age >= 10) || (style === 'fun' && clock.age >= 11) || clock.age >= 13)) return true;
    if (ok('store')) return true;
    if (ok('outside') && this.onOurStreet(p)) return true;
    return false;
  }

  _strictest() {
    const ps = this.people?.parents || [];
    return ps.reduce((a, b) => (!a || b.rec.traits.strictness > a.rec.traits.strictness ? b : a), null);
  }

  // ---------------------------------------------------------------------- noticing things
  _maybe({ rule, severity, noise = 0.3, amount }) {
    if (clock.age >= 18) return;
    const pos = this.life.player.position;
    const wit = this.people.witnesses(pos, { noise });
    const parent = wit.find((n) => n.rec.family && n.rec.role !== 'sibling');
    const sib = wit.find((n) => n.rec.role === 'sibling');
    const inc = { rule, sev: severity ?? RULES[rule]?.sev ?? 0.3, t: clock.total, amount };
    if (parent) {
      this._incident({ ...inc, evidence: 'seen', by: parent.id });
      return;
    }
    if (sib) {
      // Your brother/sister saw. They tell if they don't like you much, or they're the honest type.
      const m = this.people.memory(sib);
      if (m.opinion < 45 || sib.rec.traits.honesty > 0.75) this._tattle({ rule, by: sib.id, delay: 20 });
      else m.knows = [...(m.knows || []), rule].slice(-6); // they'll keep it... for now
    }
    // Things that leave traces get noticed later (missing beer, money, cookies).
    if (['beer', 'stealing', 'cookie'].includes(rule)) this.d.traces.push({ ...inc, sibHome: !!this.people.byRole('sibling') && !this.people.byRole('sibling').away });
    if (rule === 'beer-sick' && wit.length === 0) {
      // Throwing up is loud... if nobody heard it, at least the bathroom smells.
      this.d.traces.push({ ...inc, rule: 'beer' });
    }
  }

  _broken({ rule, severity, by, witnessed }) {
    if (clock.age >= 18) return;
    if (rule === 'shoplifting' || rule === 'skip-school') {
      // The store has your face on camera; the manager calls home.
      this._incident({ rule, sev: severity ?? 0.85, t: clock.total, evidence: 'call', by: by || null });
      return;
    }
    this._incident({ rule, sev: severity ?? RULES[rule]?.sev ?? 0.4, t: clock.total, evidence: witnessed ? 'seen' : 'heard', by });
  }

  _tattle({ rule, by, delay = 0 }) {
    const sib = this.people.npcs.find((n) => n.id === by);
    if (sib && delay === 0) this.people.say(sib, (sib.rec.age < 10 ? "I'm telling Mom!" : "Oh, you're so dead. I'm telling."), { loud: true });
    this._incident({ rule, sev: RULES[rule]?.sev ?? 0.4, t: clock.total + delay, evidence: 'told', by });
  }

  _screens() {
    if (!this.noScreens) return;
    this._maybe({ rule: 'screens', severity: 0.4, noise: 0.45 });
  }

  _incident(inc) {
    // The same thing twice in a row isn't two incidents.
    if (this.queue.some((q) => q.rule === inc.rule)) return;
    if (this.active?.incident.rule === inc.rule) return;
    this.queue.push(inc);
  }

  // ---------------------------------------------------------------------- checks over time
  _hourly() {
    const d = this.d;
    const h = clock.hour;
    const parents = (this.people?.parents || []).filter((p) => !p.away);
    // Traces: someone goes to use the thing and it's gone.
    d.traces = d.traces.filter((t) => {
      let found = false;
      const by = parents[0];
      if (!by) return true;
      if (t.rule === 'beer' && (clock.weekday === 5 || clock.weekday === 6) && h === 19) found = true; // Friday/Saturday beer
      if (t.rule === 'beer' && clock.weekday === 6 && h === 11) found = true; // restock: they count
      if (t.rule === 'stealing' && clock.total - t.t > 60 * 20 && (by.rec.traits.nosy > 0.5 || (t.amount || 0) >= 20)) found = true;
      if (t.rule === 'cookie' && h === 20 && (this.life.home.d.missing.cookies || 0) >= 4) found = true;
      if (!found) return clock.total - t.t < 60 * 24 * 8; // old enough: forgotten
      this._incident({ ...t, evidence: 'trace', by: by.id, sibCould: t.sibHome });
      if (t.rule === 'cookie') this.life.home.d.missing.cookies = 0;
      if (t.rule === 'beer') this.life.home.d.missing.beer = 0;
      if (t.rule === 'stealing') this.life.home.d.missing.cash = 0;
      return false;
    });
  }

  update(dt) {
    if (clock.age >= 18) return;
    const d = this.d;
    const pl = this.life.player.position;
    const parents = (this.people?.parents || []).filter((p) => !p.away);
    const awake = parents.filter((p) => p.activity?.kind !== 'sleep');
    // Checking on you: nosy parents look more often. They notice you're gone, not where you went.
    const nosy = Math.max(0.1, ...awake.map((p) => p.rec.traits.nosy));
    const every = 30 + (1 - nosy) * 90; // game minutes
    if (awake.length && clock.total - d.lastCheck > every) {
      d.lastCheck = clock.total;
      if (!this.allowedHere(pl)) {
        if (d.missingSince == null) d.missingSince = clock.total;
      }
    }
    // Bedtime check when they go to bed (nosy ones peek into your room).
    const bedtime = (clock.age < 11 ? 20.5 : 21.5) + (clock.isSchoolDay && clock.weekday !== 5 ? 0 : 1);
    const hf = clock.hourFloat;
    const asleepParents = parents.filter((p) => p.activity?.kind === 'sleep');
    if (asleepParents.length && hf > 22 && hf < 23.5 && d.peekDay !== clock.dayIndex && nosy > 0.4) {
      d.peekDay = clock.dayIndex;
      if (!this.inYard(pl) || !this.life.world.isIndoors(pl)) {
        d.missingSince ??= clock.total;
        d.missingAtNight = true;
      }
    }
    // School day, still at home at 7:50: "You're going to be late!"
    if (this.life.school?._schoolDay() && hf > 7.85 && hf < 8.6 && !this.life.school.d.attended[clock.dayIndex] && this.inYard(pl) && d.nudgeDay !== clock.dayIndex) {
      const seen = this.people.witnesses(pl, { noise: 0.2 }).find((n) => n.rec.family && n.rec.role !== 'sibling');
      if (seen) {
        d.nudgeDay = clock.dayIndex;
        this.people.say(seen, `${save.life.character.name}! You're going to be late for school! Go, go, go!`, { loud: true });
      }
    }
    // Up past bedtime and a parent sees you.
    if (hf > bedtime + 0.25 && hf < 24 && !this.life.player.seat?.spot?.owner && this.inYard(pl)) {
      const seen = this.people.witnesses(pl, { noise: 0.15 }).find((n) => n.rec.family && n.rec.role !== 'sibling');
      if (seen && d.warnedBed !== clock.dayIndex) {
        d.warnedBed = clock.dayIndex;
        d.warnedAt = clock.total;
        this.people.say(seen, `${save.life.character.name}, it's past your bedtime. Bed. Now.`, { loud: true });
      } else if (seen && d.warnedBed === clock.dayIndex && clock.total - d.warnedAt > 45) {
        this._incident({ rule: 'bedtime', sev: 0.25, t: clock.total, evidence: 'seen', by: seen.id });
        d.warnedAt = clock.total + 600;
      }
    }
    // Back home after being missing: they were waiting.
    if (d.missingSince != null && this.inYard(pl)) {
      const night = d.missingAtNight;
      const gone = clock.total - d.missingSince;
      const p = awake[0] || parents[0];
      if (p) {
        this._incident({ rule: this.grounded ? 'grounded' : night ? 'night' : 'outside', sev: (night ? 1 : 0.5) + Math.min(0.4, gone / 600), t: clock.total, evidence: 'seen', by: p.id, gone });
        d.missingSince = null;
        d.missingAtNight = false;
      }
    }
    this._run(dt, parents);
  }

  // ---------------------------------------------------------------------- confronting you
  _run(dt, parents) {
    if (!this.active) {
      const now = clock.total;
      const i = this.queue.findIndex((q) => q.t <= now);
      if (i < 0) return;
      const inc = this.queue[i];
      // Whoever saw it (if home), otherwise any parent at home. Nobody home: it waits.
      const parent = parents.find((p) => p.id === inc.by) || parents.find((p) => p.activity?.kind !== 'sleep') || null;
      if (!parent || (parent.activity?.kind === 'sleep' && inc.evidence !== 'seen')) return;
      this.queue.splice(i, 1);
      this.active = { parent, incident: inc, t: 0, retarget: 0 };
      parent.hurry = true;
      const name = save.life.character.name;
      this.people.say(parent, inc.sev > 0.7 ? `${name.toUpperCase()}! Get over here. NOW.` : `${name}! Come here for a second.`, { loud: true, force: this.inYardNow() });
      return;
    }
    const a = this.active;
    a.t += dt;
    const p = a.parent;
    const pl = this.life.player.position;
    if (p.away) {
      this.active = null;
      this.queue.push(a.incident);
      return;
    }
    // Walk over to you (re-aim every couple of seconds as you move).
    a.retarget -= dt;
    if (a.retarget <= 0 && p.pos.distanceTo(pl) > 1.6 && this.inYard(pl)) {
      a.retarget = 2;
      const node = this.people.nav.nearest(pl, (n) => Math.abs(n.p.y - pl.y) < 0.8);
      p.goTo(node, { kind: 'stand', confront: true });
    }
    const close = p.pos.distanceTo(pl) < 2.2;
    if ((close || a.t > 40) && !panelOpen() && this.inYard(pl)) this._confront(a);
  }

  inYardNow() {
    return this.inYard(this.life.player.position);
  }

  _confront(a) {
    const p = a.parent;
    const inc = a.incident;
    const R = RULES[inc.rule] || { what: 'what you did' };
    const name = save.life.character.name;
    p.talkingTo = this.life.player;
    p.lookTarget = this.life.player.camera.position;
    p.mood = inc.sev > 0.6 ? 'angry' : 'neutral';
    if (p.body) p.body.mood = p.mood;
    const sib = this.people.byRole('sibling');
    const opening = {
      seen: `I saw you, ${name}. ${cap(R.what)}? Really?`,
      heard: `I heard that. ${cap(R.what)}? Excuse me?`,
      told: `${sib?.rec.name || 'Somebody'} told me you were ${R.what}. Is that true?`,
      trace: inc.rule === 'beer' ? 'There are beers missing from the garage fridge. Do you know anything about that?' : inc.rule === 'stealing' ? `There's ${inc.amount ? '$' + inc.amount.toFixed(0) : 'money'} missing from my dresser. Did you take it?` : 'Somebody ate almost all the cookies. Was that you?',
      call:
        inc.rule === 'skip-school'
          ? `The school called me at work. You weren't in class today. Where were you?`
          : inc.rule === 'homework'
            ? 'Your teacher sent a note home. You didn\'t turn in your homework?'
            : `The manager at the store just called me. They say you tried to walk out without paying. ${name}, what were you thinking?`,
    }[inc.evidence] || `We need to talk about ${R.what}.`;
    const extra = inc.rule === 'outside' || inc.rule === 'night' ? ` Where were you?! I've been worried sick${inc.gone > 120 ? ' for hours' : ''}.` : '';
    const panel = openPanel({ title: `${p.displayName()} wants a word`, sub: inc.sev > 0.7 ? 'You are in big trouble.' : inc.sev > 0.35 ? "You're in trouble." : 'Uh oh.', closable: false, className: 'talk' });
    const log = el('div', { class: 'talk-log' });
    const say = (who, text) => {
      log.appendChild(el('div', { class: `talk-msg ${who}` }, [text]));
      log.scrollTop = log.scrollHeight;
    };
    say('them', opening + extra);
    this.people.say(p, opening + extra, { force: true });
    panel.setBody([log]);
    const canLie = inc.evidence === 'trace' || inc.evidence === 'told' || inc.evidence === 'heard';
    const canBlame = sib && !sib.away && (inc.evidence === 'trace' ? inc.sibCould !== false : inc.evidence === 'heard') && inc.rule !== 'outside' && inc.rule !== 'night';
    const opts = [
      { text: 'Tell the truth', kind: 'go', choice: 'truth' },
      { text: "I'm sorry", choice: 'sorry' },
      canLie ? { text: inc.evidence === 'told' ? "They're lying!" : "It wasn't me", choice: 'lie' } : null,
      canBlame ? { text: `It was ${sib.rec.name}!`, choice: 'blame' } : null,
      { text: 'Talk back', choice: 'argue' },
    ].filter(Boolean);
    panel.setButtons(opts.map((o) => ({ text: o.text, kind: o.kind, onClick: () => this._decide(a, o.choice, panel, say) })));
  }

  _decide(a, choice, panel, say) {
    const p = a.parent;
    const inc = a.incident;
    const d = this.d;
    const T = p.rec.traits;
    const mem = this.people.memory(p);
    const times = (d.history[inc.rule] = (d.history[inc.rule] || 0) + 1);
    const style = p.rec.style;
    let pts = inc.sev * 10 * (STYLE_K[style] ?? 1) * (1 + 0.5 * (times - 1));
    let line = '';
    let believed = false;
    const sib = this.people.byRole('sibling');
    if (choice === 'truth' || choice === 'sorry') {
      pts *= choice === 'sorry' ? 0.55 : 0.6;
      line = pick(p, T.warmth > 0.5 ? ["Thank you for being honest. I'm still disappointed.", "Okay. I appreciate you telling the truth. But there are consequences."] : ["At least you're not lying about it.", 'Fine. You know what comes next.']);
      mem.opinion -= inc.sev * 4;
    } else if (choice === 'lie' || choice === 'blame') {
      // A lie holds when the evidence is weak and they trust you (you haven't been caught lying).
      const trust = mem.opinion - d.liesCaught * 18 - (choice === 'blame' ? 5 : 0);
      const weak = inc.evidence === 'trace' || (inc.evidence === 'heard' && choice === 'blame') || (inc.evidence === 'told' && this.people.memory(sib || p).opinion < 30);
      believed = weak && trust > 35 + inc.sev * 25;
      d.lies++;
      if (believed) {
        pts = 0;
        if (choice === 'blame' && sib) {
          this.people.memory(sib).opinion -= 20;
          line = `${sib.rec.name}? ...Okay. ${sib.rec.name}, get in here!`;
        } else line = pick(p, ['Hm. Okay. I believe you... this time.', "Alright. Sorry for accusing you, honey."]);
      } else {
        d.liesCaught++;
        pts *= 1.6;
        mem.opinion -= 8;
        line = pick(p, ["Don't lie to me. That makes it so much worse.", `I KNOW it was you. And now you're lying to my face?`]);
        if (choice === 'blame' && sib) this.people.memory(sib).opinion -= 10;
      }
    } else {
      pts *= 1.5;
      mem.opinion -= 6;
      line = pick(p, ['Excuse me? Do NOT talk to me like that.', "Oh, you want to argue? Keep going and it's a week."]);
    }
    const punish = this._punish(pts, inc);
    say('you', { truth: 'Yeah... it was me.', sorry: "I'm sorry. I won't do it again.", lie: inc.evidence === 'told' ? "They're lying! I didn't do anything!" : "It wasn't me, I swear.", blame: `It was ${sib?.rec.name}!`, argue: "That's not fair! You never let me do anything!" }[choice]);
    say('them', `${line}${punish.text ? ' ' + punish.text : ''}`);
    this.people.say(p, `${line}${punish.text ? ' ' + punish.text : ''}`, { force: true });
    bus.emit('rule:caught', { rule: inc.rule, choice, believed, punish });
    panel.setButtons([{ text: 'Okay...', kind: 'go', onClick: () => panel.close() }]);
    panel.setTitle(`${p.displayName()} wants a word`, punish.label || (believed ? 'You got away with it.' : 'Lecture'));
    const done = () => {
      p.talkingTo = null;
      p.lookTarget = null;
      p.hurry = false;
      p.planKey = null; // back to what they were doing
      this.active = null;
    };
    const oldClose = panel.close;
    panel.close = () => {
      oldClose();
      done();
    };
  }

  /** Points -> what actually happens. */
  _punish(pts, inc) {
    const d = this.d;
    const day = 1440;
    const out = { text: '', label: '' };
    if (inc.rule === 'stealing' && inc.amount) {
      const back = Math.min(me.cash + me.data.piggy, inc.amount);
      const fromCash = Math.min(me.cash, back);
      me.spend(fromCash);
      me.data.piggy = Math.max(0, me.data.piggy - (back - fromCash));
      this.life.home.d.parentsCash += back;
      out.text += `Give me back the $${back.toFixed(0)}.`;
    }
    if (pts < 1.5) {
      out.label = 'Just a warning';
      return out;
    }
    if (pts < 3.5) {
      const lost = this.life.chores?.d.owed || 0;
      if (this.life.chores) this.life.chores.d.owed = 0;
      out.text += lost > 0 ? ` No allowance this week.` : ' Go to your room and think about it.';
      out.label = lost > 0 ? 'Lost your allowance' : 'Sent to your room';
      return out;
    }
    if (pts < 7) {
      const days = pts < 5 ? 1 : 2;
      d.noScreens = { until: clock.total + days * day, why: RULES[inc.rule]?.what };
      out.text += ` No TV, no games, no computer for ${days === 1 ? 'a day' : days + ' days'}.`;
      out.label = `No screens for ${days} day${days > 1 ? 's' : ''}`;
      return out;
    }
    const days = pts < 11 ? 1 : pts < 15 ? 2 : 3;
    d.grounded = { until: clock.total + days * day, why: RULES[inc.rule]?.what };
    me.data.flags.grounded = d.grounded;
    if (pts >= 11) d.noScreens = { until: clock.total + days * day, why: RULES[inc.rule]?.what };
    out.text += ` You're grounded for ${days === 1 ? 'a day' : days + ' days'}.${pts >= 11 ? ' And no screens.' : ''}`;
    out.label = `Grounded for ${days} day${days > 1 ? 's' : ''}`;
    return out;
  }

  dispose() {
    for (const off of this._offs) off();
  }
}

function pick(p, arr) {
  return arr[(p.rec.name.length + Math.floor(clock.total)) % arr.length];
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

void MAPLE;
