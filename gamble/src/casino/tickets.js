// TITO tickets (ticket-in / ticket-out). Modern Nevada slots take bills and tickets and pay out
// by printing a barcoded ticket — a physical pocket item that can be lost, stolen or forgotten
// in the machine (DESIGN §19 "Slots pay in TITO tickets", §27 forgotten credits).
//
//   import { tickets } from '../casino/tickets.js';
//   const tk = tickets.print(42.75, { casino: 'eldorado', machine: 'slot-12' });  // into pockets
//   tickets.list()                     → pocket tickets (newest first)
//   tickets.take(tk.id)                → the ticket, removed from pockets (insert into a machine,
//                                        hand to the cage, drop it…), or null
//   tickets.isValid(tk, 'eldorado')    → false if expired or from another casino
//
// Events: bus 'ticket:printed' { ticket }, 'ticket:used' { ticket, where }.

import { bus } from '../core/events.js';
import { clock } from '../core/clock.js';
import { save } from '../core/save.js';
import { slice } from '../life/state.js';

export const TICKET_VOID_DAYS = 90;

function pockets() {
  const inv = slice('inventory');
  if (!inv.pockets) inv.pockets = [];
  return inv.pockets;
}

function validationNumber() {
  // 18 digits printed as 00-0000-0000-0000-0000 like a real voucher.
  let s = '';
  for (let i = 0; i < 18; i++) s += Math.floor(Math.random() * 10);
  return `${s.slice(0, 2)}-${s.slice(2, 6)}-${s.slice(6, 10)}-${s.slice(10, 14)}-${s.slice(14, 18)}`;
}

export const tickets = {
  print(amount, { casino = 'eldorado', machine = '' } = {}) {
    const ticket = {
      id: `tito-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      kind: 'tito',
      amount: Math.round(amount * 100) / 100,
      casino,
      machine,
      issuedMs: clock.gameMs,
      validation: validationNumber(),
    };
    pockets().push(ticket);
    save.markDirty?.();
    bus.emit('ticket:printed', { ticket });
    return ticket;
  },

  list() {
    return pockets().filter((p) => p.kind === 'tito').sort((a, b) => b.issuedMs - a.issuedMs);
  },

  total(casino) {
    return this.list().filter((t) => !casino || t.casino === casino).reduce((s, t) => s + t.amount, 0);
  },

  isValid(ticket, casino) {
    if (!ticket) return false;
    if (casino && ticket.casino !== casino) return false;
    return clock.gameMs - ticket.issuedMs < TICKET_VOID_DAYS * 86400e3;
  },

  take(id, where = '') {
    const p = pockets();
    const i = p.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const [ticket] = p.splice(i, 1);
    save.markDirty?.();
    bus.emit('ticket:used', { ticket, where });
    return ticket;
  },
};
