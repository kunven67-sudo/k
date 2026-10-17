// Talking to people (master list §24, type anything). Press E on someone: they stop, turn to
// you, and a chat opens. Type whatever you want; the built-in brain (or your Claude key / a
// local AI, Settings > Talking brain) answers as that person, and what they decide really
// happens: Mom hands you $5, Dad says you can go to the park till 6, the neighbour remembers
// you were rude yesterday.
//
//   const talk = new Talk({ world, player, hud, life, people })
//   talk.open(npc)

import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { settings } from '../core/settings.js';
import { el, injectStyle } from '../core/util.js';
import { openPanel } from '../ui/panel.js';
import { me } from '../life/me.js';
import { think, relation } from './brain.js';
import { aiReply, aiStatus } from './ai.js';
import { speak } from './voice.js';

injectStyle('talk', `
.rl-scrim:has(.rl-panel.talk) { background: transparent; backdrop-filter: none; place-items: center end; padding: 0 4vw; }
.rl-panel.talk { width: min(440px, 92vw); background: rgba(251,248,241,.96); }
.talk-log { display: flex; flex-direction: column; gap: 8px; max-height: 46vh; min-height: 180px; overflow-y: auto; padding: 4px 2px 8px; }
.talk-msg { max-width: 84%; padding: 9px 13px; border-radius: 16px; font: 500 14.5px/1.38 var(--font-ui); animation: rlPop .18s ease both; }
.talk-msg.them { align-self: flex-start; background: #fff; border: 1px solid #eee6d6; border-bottom-left-radius: 5px; }
.talk-msg.you { align-self: flex-end; background: var(--ink); color: #fff; border-bottom-right-radius: 5px; }
.talk-msg.note { align-self: center; background: transparent; color: var(--muted); font-size: 12.5px; padding: 2px 8px; }
.talk-msg.typing { color: var(--muted); letter-spacing: 2px; }
.talk-row { display: flex; gap: 8px; margin-top: 6px; }
.talk-row input { flex: 1; padding: 11px 14px; border-radius: 12px; border: 1px solid #e3dccd; font: 500 15px var(--font-ui); background: #fff; color: var(--ink); outline: none; }
.talk-row input:focus { border-color: var(--accent); }
.talk-row button { padding: 0 16px; border-radius: 12px; border: 0; background: var(--accent); color: #fff; font: 600 14px var(--font-ui); cursor: pointer; }
.talk-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.talk-chips button { padding: 6px 11px; border-radius: 999px; border: 1px solid #e3dccd; background: var(--paper-2); color: var(--ink); font: 500 12.5px var(--font-ui); cursor: pointer; }
.talk-chips button:hover { background: #e9e1d1; }
.talk-meter { display: inline-flex; align-items: center; gap: 6px; }
.talk-meter i { display: inline-block; width: 54px; height: 5px; border-radius: 3px; background: #e6dfd0; overflow: hidden; position: relative; }
.talk-meter i b { position: absolute; left: 0; top: 0; bottom: 0; background: var(--good, #47b26b); border-radius: 3px; }
`);

const REL_LABEL = (op) => (op > 80 ? 'Loves you' : op > 60 ? 'Likes you a lot' : op > 35 ? 'Likes you' : op > 10 ? 'Friendly' : op > -10 ? 'Neutral' : op > -40 ? "Doesn't like you" : 'Can\'t stand you');

export class Talk {
  constructor({ world, player, hud, life, people }) {
    this.world = world;
    this.player = player;
    this.hud = hud;
    this.life = life;
    this.people = people;
    this.npc = null;
    world.onTalk = (npc) => this.open(npc);
  }

  _ctx(npc) {
    const life = save.life;
    const g = me.data.flags.grounded;
    return {
      mem: this.people.memory(npc),
      you: {
        name: life.character.name,
        sex: life.character.sex,
        age: clock.age,
        cash: me.cash,
        smelly: me.needs.hygiene < 0.25,
        grounded: g && g.until > clock.total ? true : false,
        groundedUntil: g ? `${Math.max(1, Math.ceil((g.until - clock.total) / 1440))} more day(s)` : '',
        groundedFor: g?.why || '',
      },
      chores: this.life.chores,
      people: this.people,
      wealth: life.family.house.wealth,
      lastName: this.people.family[0]?.rec.last,
      weather: this.world.weather,
      badWeather: (this.world.weather?.rain || 0) > 0.3,
      homeworkLeft: !!this.life.school?.homeworkLeft,
    };
  }

  open(npc) {
    if (this.npc) return;
    this.npc = npc;
    npc.talkingTo = this.player;
    npc.lookTarget = this.player.camera.position;
    const mem = this.people.memory(npc);
    const rel = relation(npc.rec);
    const relWord = rel === 'parent' ? `Your ${npc.rec.call.toLowerCase()}` : rel === 'sibling' ? `Your ${npc.rec.sex === 'f' ? 'sister' : 'brother'}` : rel === 'staff' ? cap(npc.rec.job) : mem.met ? (npc.rec.address ? `Neighbour · ${npc.rec.address}` : 'Neighbour') : 'Someone you haven\'t met';
    this.log = el('div', { class: 'talk-log' });
    this.input = el('input', { type: 'text', placeholder: `Say something to ${npc.displayName()}...`, maxlength: 300, autocomplete: 'off' });
    const sendBtn = el('button', { onclick: () => this._send() }, ['Say']);
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this._send();
      }
      e.stopPropagation();
    });
    const chips = el('div', { class: 'talk-chips' }, this._chips(npc).map((c) => el('button', { onclick: () => this._send(c) }, [c])));
    this.meter = el('span', { class: 'talk-meter' });
    this._meter();
    const st = aiStatus();
    const brain = settings.get('aiBrain') === 'builtin' ? '' : st.ok ? (st.mode === 'claude' ? ' · Claude brain' : ' · Local AI brain') : ' · built-in brain';
    this.panel = openPanel({
      title: mem.met || rel !== 'adult' ? (rel === 'parent' ? npc.rec.call : npc.rec.name) : 'Someone',
      sub: '',
      className: 'talk',
      body: [this.log, el('div', { class: 'talk-row' }, [this.input, sendBtn]), chips],
      buttons: [],
      onClose: () => this._closed(),
    });
    this.panel.setTitle(this.panel.el.querySelector('h2').firstChild.textContent, '');
    this.panel.el.querySelector('.sub')?.remove();
    const sub = el('span', { class: 'sub' }, [`${relWord}${brain}  ·  `, this.meter]);
    this.panel.el.querySelector('h2').appendChild(sub);
    this._note(this._opener(npc));
    setTimeout(() => this.input?.focus(), 60);
  }

  /** While talking, your view turns to them (they sit left of the chat box). */
  update(dt) {
    const npc = this.npc;
    if (!npc || npc.away) return;
    const p = this.player;
    const eye = p.camera.position;
    const head = (npc._seatPos || npc.pos).clone();
    head.y += npc.height * (npc._seatPos ? 0.62 : 0.9);
    const dx = head.x - eye.x;
    const dz = head.z - eye.z;
    const wide = window.innerWidth > 700;
    const yaw = Math.atan2(-dx, -dz) - (wide ? 0.32 : 0);
    const pitch = Math.atan2(head.y - eye.y, Math.hypot(dx, dz));
    let dy = yaw - p.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const k = 1 - Math.pow(0.004, dt);
    p.yaw += dy * k;
    p.pitch += (pitch - p.pitch) * k;
  }

  _meter() {
    if (!this.npc) return;
    const op = this.people.memory(this.npc).opinion;
    const pct = Math.max(0, Math.min(100, (op + 100) / 2));
    this.meter.replaceChildren(el('i', {}, [el('b', { style: `width:${pct}%;background:${op < -10 ? 'var(--bad,#ef5b4c)' : op < 15 ? 'var(--warn,#f5b942)' : 'var(--good,#47b26b)'}` })]), REL_LABEL(op));
  }

  _opener(npc) {
    const a = npc.activity?.kind;
    if (a === 'sleep') return `${npc.displayName()} is asleep.`;
    if (a === 'cook') return `${npc.displayName()} is cooking.`;
    if (a === 'tv') return `${npc.displayName()} is watching TV.`;
    if (a === 'work' && npc.rec.role === 'staff') return `${npc.rec.name} is working the register.`;
    return `${npc.displayName()} turns to you.`;
  }

  _chips(npc) {
    const rel = relation(npc.rec);
    if (rel === 'parent') return ['Hi!', 'Can I have $5?', 'Can I go outside?', 'Any chores?', "I'm hungry", 'Can I have my allowance?', 'Bye'];
    if (rel === 'staff') return ['Hi', 'Can you help me find something?', 'Are you hiring?', 'Bye'];
    if (rel === 'kid' || rel === 'sibling') return ['Hi', 'Wanna play?', "What's your name?", 'Bye'];
    return ['Hi', "What's your name?", 'How are you?', 'What do you do?', 'Bye'];
  }

  _add(kind, text) {
    const m = el('div', { class: `talk-msg ${kind}` }, [text]);
    this.log.appendChild(m);
    this.log.scrollTop = this.log.scrollHeight;
    return m;
  }

  _note(text) {
    if (this._viaText || !this.log || !this.npc) this.hud.toast(text);
    else this._add('note', text);
  }

  async _send(textIn) {
    const text = (textIn ?? this.input.value).trim();
    if (!text || !this.npc || this._busy) return;
    this.input.value = '';
    this._busy = true;
    const npc = this.npc;
    this._add('you', text);
    const ctx = this._ctx(npc);
    const typing = this._add('them typing', '...');
    let reply = null;
    if (settings.get('aiBrain') !== 'builtin') reply = await aiReply(npc, text, ctx);
    if (!reply) {
      await new Promise((r) => setTimeout(r, 350 + Math.min(900, text.length * 12)));
      reply = think(npc, text, ctx);
    }
    typing.remove();
    if (this.npc !== npc) {
      this._busy = false;
      return;
    }
    this._apply(npc, reply, text, ctx);
    this._busy = false;
  }

  _apply(npc, reply, text, ctx, viaText = false) {
    this._viaText = viaText;
    const mem = ctx.mem;
    mem.talks = (mem.talks || 0) + 1;
    mem.lastTalk = clock.total;
    if (reply.met || mem.talks > 0) mem.met = true;
    npc.noticesPlayer = true;
    if (reply.opinion) mem.opinion = Math.max(-100, Math.min(100, mem.opinion + reply.opinion));
    if (reply.mood) npc.mood = reply.mood === 'neutral' ? null : reply.mood;
    mem.said = [...(mem.said || []), { t: Math.round(clock.total), you: text.slice(0, 200), them: reply.say.slice(0, 200) }].slice(-12);
    if (!viaText) {
      this._add('them', reply.say);
      const h = speak(npc, reply.say, { position: npc.pos.clone().setY(npc.pos.y + npc.height * 0.9), mood: reply.mood });
      npc.body?.talk(h?.duration || Math.min(6, 1 + reply.say.length / 14));
      if (reply.anim) npc.body?.play(reply.anim);
    }
    if (npc.body && npc.mood) npc.body.mood = npc.mood;
    this._act(npc, reply.act, ctx);
    if (!viaText) this._meter();
    this._viaText = false;
    bus.emit('talk:said', { npc, text, reply });
  }

  /** Do what they decided (the game double-checks every action). */
  _act(npc, act, ctx) {
    if (!act) return;
    const rel = relation(npc.rec);
    const wealthCap = { poor: 3, working: 6, middle: 12, rich: 30, veryrich: 80 }[ctx.wealth] ?? 12;
    switch (act.type) {
      case 'money': {
        if (rel !== 'parent' && rel !== 'adult') break;
        const amt = Math.max(0, Math.min(+act.amount || 0, rel === 'parent' ? wealthCap : 5));
        if (amt <= 0) break;
        me.addCash(amt, 'gift');
        npc.body?.play('interact');
        this._note(`${npc.displayName()} gives you $${amt.toFixed(2)}.`);
        break;
      }
      case 'permit': {
        if (rel !== 'parent') break;
        const hours = Math.max(0.25, Math.min(6, +act.hours || 1));
        const key = String(act.key || 'misc');
        this.people.d.permissions[key] = { until: clock.total + hours * 60, by: npc.id, at: clock.total };
        if (key === 'outside' || key === 'store' || key === 'yard') this._note(`Allowed: ${key === 'store' ? 'going to the plaza' : key === 'yard' ? 'playing in the yard' : 'going outside'} until ${clock.timeText(clock.minutes + hours * 60)}.`);
        bus.emit('permission:given', { key, hours, by: npc.id });
        break;
      }
      case 'chore':
        if (this.life.chores?.offer(act.id)) this._note(`New chore: ${this.life.chores.today.find((c) => c.id === act.id)?.label}.`);
        break;
      case 'allowance': {
        const amt = this.life.chores?.payOut() || 0;
        if (amt > 0) this._note(`${npc.displayName()} gives you $${amt.toFixed(2)} allowance.`);
        break;
      }
      case 'snack': {
        if (rel !== 'parent') break;
        const snack = ['a peanut butter and jelly sandwich', 'a ham and cheese sandwich', 'apple slices with peanut butter', 'a grilled cheese'][clock.dayIndex % 4];
        this._note(`${npc.displayName()} makes you ${snack}.`);
        me.restore('hunger', 0.28);
        this.life.home.d.dishes = Math.min(1, (this.life.home.d.dishes || 0) + 0.1);
        if (!this._viaText) setTimeout(() => this.panel?.close(), 900);
        this.life.skip(6);
        break;
      }
      case 'rule':
        bus.emit('rule:broken', { rule: act.rule, severity: act.severity || 0.4, by: npc.id, where: this.world.roomAt(this.player.position)?.id || 'outside', witnessed: true });
        break;
      case 'tattle':
        bus.emit('rule:tattle', { rule: act.rule, by: npc.id });
        break;
      case 'end':
        if (!this._viaText) setTimeout(() => this.panel?.close(), 1400);
        break;
      default:
        break;
    }
  }

  _closed() {
    const npc = this.npc;
    this.npc = null;
    this.panel = null;
    if (!npc) return;
    npc.talkingTo = null;
    npc.lookTarget = null;
    // They keep an eye on you for a moment, then go back to what they were doing.
    npc.noticesPlayer = true;
  }

  dispose() {
    this.panel?.close();
    this.world.onTalk = null;
  }
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
