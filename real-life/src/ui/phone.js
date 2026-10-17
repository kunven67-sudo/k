// Your phone (Tab). As a kid it's Mom's old phone: no phone plan, so it only gets internet on
// Wi-Fi (at home, or free store Wi-Fi). Apps: Messages (your family texts you, you can text
// back and ask them stuff), Tasks (chores, homework, what you're allowed to do), Map, Money,
// Music, Weather, Camera + Photos, a web browser, Settings and Save.
//
//   const phone = new Phone({ engine, world, player, hud, life, people, talk })
//   phone.toggle() / phone.open('messages') / phone.text(npc, 'Dinner!')

import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { input } from '../core/input.js';
import { audio } from '../core/audio.js';
import { el, injectStyle } from '../core/util.js';
import { music } from '../audio/music/index.js';
import { me } from '../life/me.js';
import { priceText } from '../life/products.js';
import { think } from '../talk/brain.js';
import { aiReply, brainMode } from '../talk/ai.js';
import { settings } from '../core/settings.js';
import { openSettings } from './settings.js';
import { MAPLE, ELM, LOTS, PARK, PLAZA, SCHOOL, STORES, CULDESAC } from '../world/layout.js';

injectStyle('phone', `
.ph, .ph * { box-sizing: border-box; }
.ph { position: fixed; right: 4vw; bottom: -720px; width: 300px; height: 610px; border-radius: 44px; background: #0d0d10; padding: 12px;
  box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 0 0 2px #2a2a30; transition: bottom .32s cubic-bezier(.2,1,.3,1); z-index: 35; pointer-events: auto; }
.ph.on { bottom: 4vh; }
.ph-screen { position: relative; width: 100%; height: 100%; border-radius: 34px; overflow: hidden; background: linear-gradient(160deg, #3b5f86, #f0a35e); color: #fff; font-family: var(--font-ui); }
.ph-notch { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); width: 92px; height: 24px; border-radius: 14px; background: #0d0d10; z-index: 3; }
.ph-bar { position: absolute; top: 0; left: 0; right: 0; height: 40px; display: flex; align-items: center; justify-content: space-between; padding: 6px 22px 0; font: 600 13px var(--font-ui); z-index: 2; }
.ph-bar .ico { display: flex; gap: 6px; align-items: center; opacity: .95; }
.ph-home { position: absolute; inset: 40px 0 0; padding: 26px 18px; }
.ph-clock { text-align: center; font: 300 58px/1 var(--font-round); letter-spacing: -1px; text-shadow: 0 2px 10px rgba(0,0,0,.2); }
.ph-date { text-align: center; font: 500 14px var(--font-ui); opacity: .9; margin: 6px 0 26px; }
.ph-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px 8px; }
.ph-app { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; border: 0; background: none; color: #fff; font: 500 11px var(--font-ui); position: relative; }
.ph-app .tile { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; box-shadow: 0 3px 8px rgba(0,0,0,.25); }
.ph-app svg { width: 28px; height: 28px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ph-app:hover .tile { filter: brightness(1.08); }
.ph-badge { position: absolute; top: -4px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #ff3b30; font: 700 11px/18px var(--font-ui); }
.ph-view { position: absolute; inset: 0; background: #f6f4ef; color: #18171c; display: flex; flex-direction: column; padding-top: 40px; }
.ph-view .bar2 { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-bottom: 1px solid #e6e1d6; font: 700 17px var(--font-round); }
.ph-view .back { border: 0; background: none; font: 600 15px var(--font-ui); color: #1a73e8; cursor: pointer; padding: 4px 6px 4px 0; }
.ph-body { flex: 1; overflow-y: auto; padding: 10px 12px 14px; }
.ph-item { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: #fff; margin-bottom: 7px; font: 500 13.5px var(--font-ui); cursor: default; }
.ph-item.click { cursor: pointer; }
.ph-item .sub { color: #77727f; font-size: 12px; margin-top: 2px; }
.ph-item .grow { flex: 1; min-width: 0; }
.ph-av { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font: 700 15px var(--font-ui); color: #fff; flex: none; }
.ph-dot { width: 9px; height: 9px; border-radius: 50%; background: #1a73e8; flex: none; }
.ph-msgs { display: flex; flex-direction: column; gap: 6px; }
.ph-msg { max-width: 78%; padding: 8px 11px; border-radius: 17px; font: 500 13.5px/1.35 var(--font-ui); }
.ph-msg.them { align-self: flex-start; background: #e5e5ea; color: #111; border-bottom-left-radius: 5px; }
.ph-msg.you { align-self: flex-end; background: #1a84ff; color: #fff; border-bottom-right-radius: 5px; }
.ph-msg.fail { background: #c9c9cf; }
.ph-msg .t { display: block; font-size: 10.5px; opacity: .55; margin-top: 2px; }
.ph-note { text-align: center; color: #8a8590; font: 500 11.5px var(--font-ui); margin: 4px 0; }
.ph-send { display: flex; gap: 6px; padding: 8px 10px 14px; border-top: 1px solid #e6e1d6; }
.ph-send input { flex: 1; border: 1px solid #ddd6c8; border-radius: 18px; padding: 8px 12px; font: 500 13.5px var(--font-ui); outline: none; }
.ph-send button { border: 0; border-radius: 18px; padding: 0 13px; background: #1a84ff; color: #fff; font: 600 13px var(--font-ui); cursor: pointer; }
.ph-big { font: 700 34px var(--font-round); margin: 6px 0 2px; }
.ph-btn { border: 0; border-radius: 12px; padding: 10px 12px; background: #18171c; color: #fff; font: 600 13px var(--font-ui); cursor: pointer; width: 100%; margin-top: 8px; }
.ph-btn.soft { background: #e9e4d8; color: #18171c; }
.ph-map { width: 100%; border-radius: 12px; background: #dfe8d2; display: block; }
.ph-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.ph-photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; }
.ph-url { margin: 8px 10px 0; padding: 8px 12px; border-radius: 10px; background: #ebe7de; font: 500 12.5px var(--font-ui); color: #555; }
.ph-search { display: flex; gap: 6px; margin: 30px 0 14px; }
.ph-search input { flex: 1; border: 1px solid #ddd6c8; border-radius: 20px; padding: 9px 14px; font: 500 14px var(--font-ui); }
.ph-logo { text-align: center; font: 800 38px var(--font-round); letter-spacing: -1px; margin-top: 30px; }
`);

const APPS = [
  ['messages', 'Messages', '#34c759', 'M4 5h16v11H8l-4 4z'],
  ['tasks', 'Tasks', '#ff9f0a', 'M9 6h11 M9 12h11 M9 18h11 M4 6l1 1 2-2 M4 12l1 1 2-2 M4 18l1 1 2-2'],
  ['map', 'Map', '#30b0c7', 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14'],
  ['money', 'Money', '#2e7d32', 'M3 7h18v10H3z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z M6 10v4 M18 10v4'],
  ['music', 'Music', '#ff2d55', 'M9 18V6l11-2v12 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'],
  ['weather', 'Weather', '#0a84ff', 'M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z'],
  ['camera', 'Camera', '#5e5ce6', 'M4 8h4l2-3h4l2 3h4v11H4z M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'],
  ['photos', 'Photos', '#ff9500', 'M4 5h16v14H4z M4 15l5-5 4 4 3-3 4 4 M15.5 8.5h.01'],
  ['browser', 'Browser', '#1a73e8', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9 M12 3C9.5 5.6 8.2 8.6 8.2 12s1.3 6.4 3.8 9'],
  ['settings', 'Settings', '#8e8e93', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-1-3-2 .3-1.3-1.3L17 5l-3-1-1 2h-2L10 4 7 5l.3 2L6 8.3 4 8l-1 3 2 1v2l-2 1 1 3 2-.3L7.3 17 7 19l3 1 1-2h2l1 2 3-1-.3-2 1.3-1.3 2 .3 1-3-2-1z'],
  ['save', 'Save', '#636366', 'M5 4h11l3 3v13H5z M8 4v5h8V4 M8 20v-6h8v6'],
];
const STATIONS = [
  ['menu-lounge', 'Lo-fi Chill'],
  ['casino-floor', 'Late Night Lounge'],
  ['motel-radio', 'Oldies Radio'],
  ['creator-dmv', 'Waiting Room Jazz'],
];
const PHOTO_KEY = 'reallife.photos.v1';

save.registerSlice('phone', { create: () => ({ threads: {}, unread: {}, musicOn: null, sentMissing: 0 }) });

export class Phone {
  constructor({ engine, world, player, hud, life, people, talk }) {
    Object.assign(this, { engine, world, player, hud, life, people, talk });
    this.isOpen = false;
    this.app = null;
    this.root = el('div', { class: 'ph' });
    this.screen = el('div', { class: 'ph-screen' });
    this.root.append(this.screen);
    engine.uiRoot.appendChild(this.root);
    this._clockT = 0;
    this._offs = [
      bus.on('family:left', ({ npc, why }) => this._leftText(npc, why)),
      bus.on('family:text', ({ npc, text }) => this.text(npc, text)),
    ];
  }

  get d() {
    return save.slice('phone');
  }

  /** On Wi-Fi? (home Wi-Fi reaches the yard; stores have free Wi-Fi). Kids have no data plan. */
  wifi() {
    const p = this.player.position;
    if (clock.age >= 16) return 'data';
    if (this.life.rules?.inYard(p)) return 'home';
    if (this.world.roomAt(p)?.kind === 'store') return 'store';
    return null;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(app = null) {
    this.isOpen = true;
    this.root.classList.add('on');
    input.setPointerLock?.(false);
    document.exitPointerLock?.();
    audio.play?.('ui.open', { gain: 0.35 });
    this.show(app);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove('on');
    this.app = null;
    if (document.activeElement?.blur) document.activeElement.blur();
    input.setPointerLock?.(true);
  }

  update(dt) {
    this._clockT -= dt;
    if (this.isOpen && this._clockT <= 0) {
      this._clockT = 1;
      const bar = this.screen.querySelector('.ph-bar');
      if (bar) bar.replaceWith(this._bar());
      if (!this.app) this.show(null);
      else if (this.app === 'map') this._drawMap();
    }
    this._missingTexts();
  }

  // ---------------------------------------------------------------- screens
  _bar() {
    const w = this.wifi();
    return el('div', { class: 'ph-bar', style: this.app ? 'color:#18171c' : '' }, [
      el('span', {}, [clock.timeText().replace(/ (AM|PM)/, '')]),
      el('span', { class: 'ico' }, [w ? (w === 'data' ? 'LTE' : 'Wi-Fi') : 'No service', el('span', {}, [`${Math.round(60 + 40 * Math.cos(clock.minutes / 300))}%`])]),
    ]);
  }

  show(app) {
    this.app = app;
    const parts = [el('div', { class: 'ph-notch' }), this._bar()];
    if (!app) parts.push(this._home());
    else parts.push(this._view(app));
    this.screen.replaceChildren(...parts);
    if (app === 'map') this._drawMap();
  }

  _home() {
    const unread = Object.values(this.d.unread).reduce((a, b) => a + b, 0);
    return el('div', { class: 'ph-home' }, [
      el('div', { class: 'ph-clock' }, [clock.timeText().replace(/ (AM|PM)/, '')]),
      el('div', { class: 'ph-date' }, [`${clock.weekdayName}, ${clock.season[0].toUpperCase() + clock.season.slice(1)}`]),
      el(
        'div',
        { class: 'ph-grid' },
        APPS.map(([id, name, color, path]) =>
          el('button', { class: 'ph-app', onclick: () => this._launch(id) }, [
            el('div', { class: 'tile', style: `background:${color}`, html: `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>` }),
            name,
            id === 'messages' && unread ? el('span', { class: 'ph-badge' }, [String(unread)]) : null,
          ]),
        ),
      ),
    ]);
  }

  _launch(id) {
    if (id === 'settings') {
      this.close();
      openSettings();
      return;
    }
    if (id === 'camera') return this._photo();
    this.show(id);
  }

  _view(app) {
    const title = APPS.find((a) => a[0] === app)?.[1] || app;
    const back = el('button', { class: 'back', onclick: () => this.show(this._back || null) }, ['‹ Back']);
    this._back = null;
    const body = el('div', { class: 'ph-body' });
    const view = el('div', { class: 'ph-view' }, [el('div', { class: 'bar2' }, [back, title])]);
    const fill = this[`_app_${app.split(':')[0]}`];
    const extra = fill ? fill.call(this, body, app.split(':')[1], view) : null;
    view.append(body);
    if (extra) view.append(extra);
    return view;
  }

  // ---------------------------------------------------------------- messages
  _contacts() {
    return this.people.family.filter((n) => n.rec.role !== 'sibling' || n.rec.age >= 10);
  }

  _app_messages(body, id, view) {
    if (id) return this._thread(body, id, view);
    const list = this._contacts();
    for (const n of list) {
      const th = this.d.threads[n.id] || [];
      const last = th[th.length - 1];
      const un = this.d.unread[n.id] || 0;
      body.append(
        el('div', { class: 'ph-item click', onclick: () => this.show(`messages:${n.id}`) }, [
          el('div', { class: 'ph-av', style: `background:${n.rec.role === 'mom' ? '#e05a8a' : n.rec.role === 'dad' ? '#3a7bd5' : '#8e5ad6'}` }, [n.displayName()[0]]),
          el('div', { class: 'grow' }, [n.displayName(), el('div', { class: 'sub' }, [last ? last.text.slice(0, 38) : 'No messages yet'])]),
          un ? el('span', { class: 'ph-dot' }) : null,
        ]),
      );
    }
    return null;
  }

  _thread(body, id, view) {
    const n = this.people.npcs.find((x) => x.id === id);
    view.querySelector('.bar2').lastChild.textContent = n?.displayName() || 'Messages';
    this._back = 'messages';
    this.d.unread[id] = 0;
    const msgs = el('div', { class: 'ph-msgs' });
    for (const m of this.d.threads[id] || []) msgs.append(el('div', { class: `ph-msg ${m.from}${m.fail ? ' fail' : ''}` }, [m.text, el('span', { class: 't' }, [m.fail ? 'Not delivered' : m.time])]));
    if (!(this.d.threads[id] || []).length) msgs.append(el('div', { class: 'ph-note' }, ['Say hi!']));
    body.append(msgs);
    setTimeout(() => (body.scrollTop = body.scrollHeight), 0);
    const inp = el('input', { placeholder: 'Text message', maxlength: 240 });
    const send = () => {
      const t = inp.value.trim();
      if (!t || !n) return;
      inp.value = '';
      this._send(n, t);
    };
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') send();
    });
    setTimeout(() => inp.focus(), 50);
    return el('div', { class: 'ph-send' }, [inp, el('button', { onclick: send }, ['Send'])]);
  }

  _push(id, msg) {
    (this.d.threads[id] ||= []).push({ ...msg, time: clock.timeText(), t: clock.total });
    if (this.d.threads[id].length > 60) this.d.threads[id].splice(0, this.d.threads[id].length - 60);
  }

  async _send(n, text) {
    if (!this.wifi()) {
      this._push(n.id, { from: 'you', text, fail: true });
      this.show(`messages:${n.id}`);
      return;
    }
    this._push(n.id, { from: 'you', text });
    this.show(`messages:${n.id}`);
    audio.play?.('ui.open', { gain: 0.2, rate: 1.6 });
    // They read it and answer like they would in person (but they can't hand you money over text).
    const ctx = this.talk._ctx(n);
    ctx.texting = true;
    let reply = brainMode() !== 'builtin' ? await aiReply(n, `(by text message) ${text}`, ctx) : null;
    if (reply?.fail) reply = null; // (the reason shows when you talk face to face)
    if (!reply) reply = think(n, text, ctx);
    const busy = n.activity?.kind === 'sleep' ? 9e9 : n.away ? 25 : 6;
    if (busy > 1e8) return; // asleep: they'll see it in the morning (no reply tonight)
    const delay = (busy + Math.min(20, reply.say.length / 4)) * 1000 * 0.4;
    setTimeout(() => {
      if (reply.act && ['money', 'snack', 'allowance'].includes(reply.act.type) && n.pos.distanceTo(this.player.position) > 4) {
        reply.say += reply.act.type === 'snack' ? '' : " I'll give it to you when I see you.";
        reply.act = null;
      }
      this.talk._apply(n, { ...reply, viaText: true }, text, ctx, true);
      this.text(n, reply.say, { quiet: false, fromReply: true });
    }, delay);
  }

  /** A text from someone. Buzz + a little banner if the phone is away. */
  text(n, text, { fromReply = false } = {}) {
    if (!this.wifi() && !fromReply) {
      // It arrives when you're back on Wi-Fi.
      (this._pending ||= []).push([n, text]);
      return;
    }
    this._push(n.id, { from: 'them', text });
    const viewing = this.isOpen && this.app === `messages:${n.id}`;
    if (!viewing) this.d.unread[n.id] = (this.d.unread[n.id] || 0) + 1;
    audio.play?.('ui.open', { gain: 0.4, rate: 0.7 });
    if (!this.isOpen) this.hud.toast(`${n.displayName()}: ${text}`, 4200);
    if (this.isOpen) this.show(this.app);
  }

  _leftText(n, why) {
    if (n.rec.role === 'sibling') return;
    const near = n.pos.distanceTo(this.player.position) < 6;
    if (near) return;
    const ch = this.life.chores?.leftToday || [];
    if (why === 'work') this.text(n, ch.length ? `Off to work. Love you! Don't forget: ${ch.map((c) => c.label.toLowerCase()).join(', ')}.` : 'Off to work. Love you, be good!');
    else if (why === 'groceries') this.text(n, 'Going to Walmort, need anything?');
  }

  _missingTexts() {
    const r = this.life.rules?.d;
    if (!r || r.missingSince == null) {
      this.d.sentMissing = 0;
      if (this._pending?.length && this.wifi()) for (const [n, t] of this._pending.splice(0)) this.text(n, t);
      return;
    }
    const gone = clock.total - r.missingSince;
    const p = this.people.parents.find((x) => !x.away && x.activity?.kind !== 'sleep');
    if (!p) return;
    if (this.d.sentMissing === 0) {
      this.d.sentMissing = 1;
      this.text(p, `Where are you?? Come home right now.`);
    } else if (this.d.sentMissing === 1 && gone > 60) {
      this.d.sentMissing = 2;
      this.text(p, `${save.life.character.name.toUpperCase()}. I'm not kidding. Home. NOW.`);
    }
  }

  // ---------------------------------------------------------------- tasks / money / weather
  _app_tasks(body) {
    const ch = this.life.chores;
    const sc = this.life.school;
    const r = this.life.rules;
    const add = (title, sub, done) => body.append(el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, [title, sub ? el('div', { class: 'sub' }, [sub]) : null]), done != null ? el('span', {}, [done ? 'Done' : '']) : null]));
    body.append(el('div', { class: 'ph-note' }, ['Chores today']));
    if (!ch?.today.length) add('No chores today', null);
    for (const c of ch?.today || []) add(c.label, `${priceText(c.pay)} allowance`, c.done);
    if (ch?.owed > 0) add(`Allowance owed: ${priceText(ch.owed)}`, 'Paid on Sunday (or ask nicely)');
    body.append(el('div', { class: 'ph-note' }, ['School']));
    if (sc?.homeworkLeft) add(`Homework: ${sc.d.homework.subject}`, `${sc.d.homework.topic}. Do it at your desk.`, false);
    else add('No homework right now', null);
    const g = sc?.reportCard();
    if (g) add('Grades', g.map(([s, l]) => `${s} ${l}`).join(' · '));
    body.append(el('div', { class: 'ph-note' }, ['Rules']));
    const perms = this.people.d.permissions;
    const active = Object.entries(perms).filter(([, v]) => v.until > clock.total);
    if (r?.grounded) add('Grounded', `For ${r.grounded.why}. ${Math.ceil((r.grounded.until - clock.total) / 1440)} more day(s).`);
    if (r?.noScreens) add('No screens', `For ${r.noScreens.why}.`);
    for (const [k, v] of active) add(`Allowed: ${{ outside: 'go outside', store: 'go to the plaza', yard: 'play in the yard', stayup: 'stay up late', screens: 'screen time', sweets: 'a treat' }[k] || k}`, `Until ${clock.timeText(clock.minutes + (v.until - clock.total))}`);
    if (!active.length && !r?.grounded) add('Ask before leaving our street', 'Mom or Dad have to say yes.');
    return null;
  }

  _app_money(body) {
    const lem = save.slice('lemonade');
    body.append(
      el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, ['In your pocket', el('div', { class: 'ph-big' }, [priceText(me.cash)])])]),
      el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, ['Piggy bank (at home)', el('div', { class: 'sub' }, [priceText(me.data.piggy)])])]),
      el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, ['Allowance owed', el('div', { class: 'sub' }, [priceText(this.life.chores?.owed || 0)])])]),
      el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, ['Lemonade stand, all time', el('div', { class: 'sub' }, [`${priceText(lem.total)} from ${lem.cupsSold} cups`])])]),
      el('div', { class: 'ph-note' }, [clock.age < 13 ? "You're too young for a bank account. Keep cash in your piggy bank." : 'Bank accounts come in the next update.']),
    );
    return null;
  }

  _app_weather(body) {
    const s = clock.season;
    const base = { spring: 61, summer: 84, fall: 58, winter: 29 }[s];
    const h = clock.hourFloat;
    const temp = Math.round(base + 9 * Math.sin(((h - 9) / 24) * Math.PI * 2));
    const rain = this.world.weather?.rain || 0;
    body.append(
      el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, ['Maple Hollow, OH', el('div', { class: 'ph-big' }, [`${temp}°F`]), el('div', { class: 'sub' }, [rain > 0.3 ? 'Rain' : (this.world.weather?.cloudCover || 0) > 0.6 ? 'Cloudy' : clock.isNight ? 'Clear night' : 'Mostly sunny'])])]),
      el('div', { class: 'ph-note' }, [s === 'winter' ? 'Bundle up. Snow possible tonight.' : s === 'summer' ? 'Hot one. Stay hydrated (good lemonade weather).' : 'Nice out.']),
    );
    return null;
  }

  // ---------------------------------------------------------------- map
  _app_map(body) {
    const c = el('canvas', { class: 'ph-map', width: 552, height: 700 });
    body.append(c, el('div', { class: 'ph-note' }, ['You are the blue dot.']));
    this._mapCanvas = c;
    return null;
  }

  _drawMap() {
    const c = this._mapCanvas;
    if (!c || !c.isConnected) return;
    const x = c.getContext('2d');
    const W = c.width;
    const H = c.height;
    // World x -140..170 -> 0..W (rotated: north up = -z up).
    const sx = (wx) => ((wx + 140) / 312) * W;
    const sz = (wz) => ((wz + 98) / 196) * H;
    const rect = (x0, z0, x1, z1, col) => {
      x.fillStyle = col;
      x.fillRect(sx(x0), sz(z0), sx(x1) - sx(x0), sz(z1) - sz(z0));
    };
    x.fillStyle = '#dfe8d2';
    x.fillRect(0, 0, W, H);
    rect(PARK.x0, PARK.z0, PARK.x1, PARK.z1, '#a9d18e');
    rect(PLAZA.x0, PLAZA.z0, PLAZA.x1, PLAZA.z1, '#cfcfcf');
    rect(SCHOOL.x0, SCHOOL.z0, SCHOOL.x1, SCHOOL.z1, '#e9d2b8');
    rect(MAPLE.x0, -MAPLE.half, MAPLE.x1 + 4, MAPLE.half, '#ffffff');
    rect(ELM.x - ELM.half, ELM.z0, ELM.x + ELM.half, ELM.z1, '#ffffff');
    x.beginPath();
    x.arc(sx(CULDESAC.x), sz(CULDESAC.z), (CULDESAC.r / 312) * W, 0, Math.PI * 2);
    x.fillStyle = '#fff';
    x.fill();
    for (const l of LOTS) {
      rect(l.x - 6, l.side < 0 ? -26 : 14, l.x + 6, l.side < 0 ? -14 : 26, l.family ? '#ff9f0a' : '#b9b2a6');
    }
    for (const s of Object.values(STORES)) rect(s.x0, s.z0, s.x1, s.z1, s.id === 'grocery' ? '#2f6db5' : s.id === 'electronics' ? '#24438a' : '#f2c230');
    x.fillStyle = '#333';
    x.font = 'bold 15px sans-serif';
    x.textAlign = 'center';
    const label = (t, wx, wz) => x.fillText(t, sx(wx), sz(wz));
    label('Maple St', 0, -1 + 6);
    label('Park', (PARK.x0 + PARK.x1) / 2, 0);
    label('School', (SCHOOL.x0 + SCHOOL.x1) / 2, (SCHOOL.z0 + SCHOOL.z1) / 2);
    for (const s of Object.values(STORES)) label(s.name, (s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2 + 5);
    label('Home', LOTS.find((l) => l.family).x, -30);
    x.save();
    x.translate(sx(ELM.x) + 14, sz(60));
    x.rotate(-Math.PI / 2);
    x.fillText('Elm Ave', 0, 0);
    x.restore();
    // You.
    const p = this.player.position;
    const px = sx(p.x);
    const pz = sz(p.z);
    x.fillStyle = 'rgba(26,115,232,.2)';
    x.beginPath();
    x.arc(px, pz, 18, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#1a73e8';
    x.beginPath();
    x.arc(px, pz, 7, 0, Math.PI * 2);
    x.fill();
    const yaw = this.player.yaw;
    x.beginPath();
    x.moveTo(px - Math.sin(yaw) * 16, pz - Math.cos(yaw) * 16);
    x.lineTo(px + Math.cos(yaw) * 5, pz - Math.sin(yaw) * 5);
    x.lineTo(px - Math.cos(yaw) * 5, pz + Math.sin(yaw) * 5);
    x.fill();
  }

  // ---------------------------------------------------------------- music
  _app_music(body) {
    for (const [id, name] of STATIONS) {
      const on = this.d.musicOn === id;
      body.append(el('div', { class: 'ph-item click', onclick: () => this._music(on ? null : id) }, [el('div', { class: 'grow' }, [name, el('div', { class: 'sub' }, [on ? 'Playing on your phone speaker' : 'Tap to play'])]), on ? el('span', {}, ['■']) : el('span', {}, ['▶'])]));
    }
    body.append(el('div', { class: 'ph-note' }, ['Music plays out loud from your phone.']));
    return null;
  }

  _music(id) {
    this.d.musicOn = id;
    if (id) {
      music.play(id, { fade: 0.6, radio: 0.45 });
      bus.emit('phone:music', { on: true });
    } else {
      music.stop({ fade: 0.6 });
      bus.emit('phone:music', { on: false });
    }
    this.show('music');
  }

  // ---------------------------------------------------------------- camera + photos
  _photo() {
    const prevOpen = this.isOpen;
    this.root.style.visibility = 'hidden';
    this.hud.setVisible(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        try {
          const src = this.engine.renderer.domElement;
          const c = document.createElement('canvas');
          c.width = 480;
          c.height = Math.round((480 * src.height) / src.width);
          this.engine.renderer.render(this.engine.scene, this.engine.camera);
          c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
          const url = c.toDataURL('image/jpeg', 0.78);
          const list = loadPhotos();
          list.unshift({ url, t: clock.total, where: this.world.roomAt(this.player.position)?.id || 'outside' });
          try {
            localStorage.setItem(PHOTO_KEY, JSON.stringify(list.slice(0, 24)));
          } catch {
            /* storage full: keep the newest in memory only */
          }
          audio.play?.('ui.open', { gain: 0.6, rate: 2.2 });
          this.hud.toast('Photo saved to your phone.');
        } finally {
          this.root.style.visibility = '';
          this.hud.setVisible(true);
          if (prevOpen) this.show('photos');
        }
      }),
    );
  }

  _app_photos(body) {
    const list = loadPhotos();
    if (!list.length) body.append(el('div', { class: 'ph-note' }, ['No photos yet. Open Camera to take one (it snaps what you see).']));
    else body.append(el('div', { class: 'ph-photos' }, list.map((p) => el('img', { src: p.url, alt: 'photo' }))));
    return null;
  }

  // ---------------------------------------------------------------- browser
  _app_browser(body, page) {
    if (!this.wifi()) {
      body.append(el('div', { class: 'ph-logo', style: 'font-size:22px;margin-top:60px' }, ['No internet connection']), el('div', { class: 'ph-note' }, ["You're not on Wi-Fi. Go home or into a store with free Wi-Fi."]));
      return null;
    }
    this._back = page ? 'browser' : null;
    const url = el('div', { class: 'ph-url' }, [page ? { gazette: 'maplehollowgazette.com', amazan: 'amazan.com', search: 'goggle.com/search' }[page] || 'goggle.com' : 'goggle.com']);
    body.append(url);
    if (!page) {
      const inp = el('input', { placeholder: 'Search Goggle' });
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') this.show('browser:search');
      });
      body.append(
        el('div', { class: 'ph-logo' }, [el('span', { style: 'color:#4285f4' }, ['G']), el('span', { style: 'color:#ea4335' }, ['o']), el('span', { style: 'color:#fbbc05' }, ['g']), el('span', { style: 'color:#4285f4' }, ['g']), el('span', { style: 'color:#34a853' }, ['l']), el('span', { style: 'color:#ea4335' }, ['e'])]),
        el('div', { class: 'ph-search' }, [inp]),
        el('div', { class: 'ph-item click', onclick: () => this.show('browser:gazette') }, [el('div', { class: 'grow' }, ['Maple Hollow Gazette', el('div', { class: 'sub' }, ['Town news'])])]),
        el('div', { class: 'ph-item click', onclick: () => this.show('browser:amazan') }, [el('div', { class: 'grow' }, ['Amazan', el('div', { class: 'sub' }, ['Shop online'])])]),
      );
    } else if (page === 'search') {
      body.append(el('div', { class: 'ph-note' }, ['Results']), el('div', { class: 'ph-item click', onclick: () => this.show('browser:gazette') }, [el('div', { class: 'grow' }, ['Maple Hollow Gazette - Local news', el('div', { class: 'sub' }, ['maplehollowgazette.com'])])]), el('div', { class: 'ph-item click', onclick: () => this.show('browser:amazan') }, [el('div', { class: 'grow' }, ['Amazan.com: Online Shopping', el('div', { class: 'sub' }, ['amazan.com'])])]));
    } else if (page === 'gazette') {
      for (const [h, s] of this._news()) body.append(el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, [el('b', {}, [h]), el('div', { class: 'sub' }, [s])])]));
    } else if (page === 'amazan') {
      body.append(el('div', { class: 'ph-logo', style: 'font-size:28px' }, ['amazan']), el('div', { class: 'ph-note' }, [clock.age < 18 ? 'You need a credit or debit card to order. Ask a parent, or buy it at the stores in the plaza.' : 'Online orders come in the next update.']));
    }
    return null;
  }

  _news() {
    const lem = save.slice('lemonade');
    const out = [
      [`${clock.season === 'winter' ? 'Snow plows ready' : clock.season === 'summer' ? 'Heat advisory this week' : 'Mild week ahead'} for Maple Hollow`, 'The weather service says to plan accordingly.'],
      ['Walmort extends hours', 'The Elm Ave store is now open 7 AM to 11 PM daily.'],
      ['Best Bye gets new graphics cards', '"They sell out in minutes," says an employee. Scalpers spotted in the parking lot.'],
      ['Maple Hollow Elementary book fair next week', 'Parents can volunteer at the front office.'],
    ];
    if (lem.cupsSold > 10) out.unshift(['Local kid\'s lemonade stand a hit on Maple St', `Neighbors say they\'ve sold over ${lem.cupsSold} cups. "Best on the street," one said.`]);
    return out;
  }

  _app_save(body) {
    const l = save.life;
    body.append(
      el('div', { class: 'ph-item' }, [el('div', { class: 'grow' }, [`${l.character.name}'s life`, el('div', { class: 'sub' }, [`Age ${Math.floor(clock.age)} · ${clock.weekdayName} ${clock.timeText()}`])])]),
      el('button', { class: 'ph-btn', onclick: () => (save.commit(), this.hud.toast('Saved.'), this.show('save')) }, ['Save now']),
      el('div', { class: 'ph-note' }, ['The game also saves by itself at midnight and noon. One save per life: you can\'t undo dying.']),
    );
    return null;
  }

  dispose() {
    for (const off of this._offs) off();
    if (this.d.musicOn) music.stop({ fade: 0.3 });
    this.root.remove();
  }
}

function loadPhotos() {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_KEY) || '[]');
  } catch {
    return [];
  }
}
