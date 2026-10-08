// Motel rent: talk to the clerk (bus 'talk:clerk') → bubble + choices → pay $45 cash.
// Paid nights run to the next 11 AM checkout. Unpaid at 11 AM → bus 'rent:overdue'
// {room, daysLate} and the clerk comes knocking (spoken line + 'door.knock' at the room door
// if the world gives us a position for it).

import * as THREE from 'three';
import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { t, i18n } from '../core/i18n.js';
import { say } from '../player/voice.js';
import { openDialogue } from './dialogue.js';
import { slice, addCash, nextCheckout, roomNumber, RENT_RATE } from './state.js';
import { sfx } from './sounds.js';

const CLERK_VOICE = { pitch: 0.78, rate: 0.98, male: true };

export class Rent {
  constructor({ engine, world, player, state }) {
    this.engine = engine;
    this.world = world;
    this.player = player;
    this.state = state;
    this.r = slice('rent');
    this.dialogue = null;
    this.offs = [
      bus.on('talk:clerk', (e) => this.talk(e)),
      bus.on('clock:hour', (p) => p.hour === 11 && this.checkDue(p)),
    ];
  }

  get paid() {
    return this.r.paidThroughGameMs > clock.gameMs;
  }

  _when() {
    const lang = i18n.language === 'es' ? 'es-MX' : 'en-US';
    return new Intl.DateTimeFormat(lang, { timeZone: clock.tz, weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(this.r.paidThroughGameMs));
  }

  talk({ clerk, handled } = {}) {
    if (handled) handled.value = true;
    if (this.dialogue && !this.dialogue.closed) return;
    const room = roomNumber(this.state);
    const head = new THREE.Vector3();
    const anchor = () => {
      const r = clerk?.root || clerk?.human?.root;
      if (!r) return this.player?.position ? head.copy(this.player.position).add({ x: 0, y: 2.1, z: 0 }) : null;
      return head.setFromMatrixPosition(r.matrixWorld).add({ x: 0, y: 1.95, z: 0 });
    };
    const speak = (line) => say(line, CLERK_VOICE);
    const paidAhead = this.r.paidThroughGameMs > clock.gameMs + 6 * 3600000;
    const line = paidAhead ? t('life.clerk.greetPaid', { when: this._when() }) : t('life.clerk.greet', { room });
    speak(line);
    const choices = [
      {
        label: t('life.clerk.pay'),
        dim: slice('money').cash < RENT_RATE,
        onPick: (d) => {
          if (!addCash(-RENT_RATE, 'rent')) {
            const l = t('life.clerk.broke');
            speak(l);
            clerk?.human?.play?.('shrug');
            return d.say(l);
          }
          sfx('wallet.open', { gain: 0.6 });
          // A paid night runs to the checkout after whichever is later: now or what's already paid.
          this.r.paidThroughGameMs = nextCheckout(Math.max(clock.gameMs, this.r.paidThroughGameMs));
          this.r.lastPaidGameMs = clock.gameMs;
          save.markDirty();
          bus.emit('rent:paid', { room, paidThroughGameMs: this.r.paidThroughGameMs, amount: RENT_RATE });
          const l = t('life.clerk.thanks');
          speak(l);
          clerk?.human?.play?.('wave');
          d.say(l);
        },
      },
      {
        label: paidAhead ? t('life.clerk.bye') : t('life.clerk.notYet'),
        onPick: (d) => {
          const l = paidAhead ? '…' : t('life.clerk.later');
          if (!paidAhead) speak(l);
          d.say(l, [], 1400);
        },
      },
    ];
    this.dialogue = openDialogue({ engine: this.engine, anchor, name: t('life.clerk.name'), text: line, choices });
    this.dialogueFrom = this.player?.position?.clone?.() || null;
  }

  checkDue(parts) {
    const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
    if (this.paid || this.r.lastKnockDay === dayKey) return;
    this.r.lastKnockDay = dayKey;
    this.r.daysLate = (this.r.daysLate || 0) + 1;
    save.markDirty();
    const room = roomNumber(this.state);
    const line = t('life.clerk.knock', { room });
    // World can react (send the clerk to the door, lock the player out after N days...).
    bus.emit('rent:overdue', { room, daysLate: this.r.daysLate, line });
    const door = this.world?.motel?.roomDoorPosition?.(room) || this.state?.doorPos || null;
    const near = !door || !this.player?.position || this.player.position.distanceTo(door) < 25;
    if (near) {
      if (door) for (let i = 0; i < 3; i++) setTimeout(() => sfx('door.knock', { position: door, gain: 1 }), i * 420);
      setTimeout(() => say(line, { ...CLERK_VOICE, volume: door ? 0.8 : 0.6 }), 1500);
    }
  }

  update() {
    if (!this.dialogue || this.dialogue.closed) return;
    this.dialogue.update();
    // Walking away ends the conversation.
    if (this.dialogueFrom && this.player?.position && this.player.position.distanceTo(this.dialogueFrom) > 3.5) this.dialogue.close();
  }

  dispose() {
    for (const off of this.offs) off();
    this.dialogue?.close();
  }
}
