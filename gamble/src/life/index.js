// LIFE systems entry: needs + body cues, money, rent, the phone in hand, pockets.
//
//   import { initLife } from '../life/index.js';
//   const life = initLife({ engine, world, player, state });   // → { update(dt), dispose(), ... }
//
// Plugs into the world state; works with any `player` that has `human`, `position` and
// (optionally) `controller` — code is defensive so the dev page can pass a bare Human.

import './strings.js';
import './sounds.js';
import { bus } from '../core/events.js';
import { input } from '../core/input.js';
import { Needs } from './needs.js';
import { Rent } from './rent.js';
import { StinkLines } from './stink.js';
import { Phone } from './phone/phone.js';
import { Pockets } from './pockets.js';
import { slice, addCash } from './state.js';

export { addCash, slice };

export function initLife({ engine, world, player, state } = {}) {
  const needs = new Needs({ engine, player, world });
  const rent = new Rent({ engine, world, player, state });
  const phone = new Phone({ engine, player, state });
  const pockets = new Pockets({ engine, player, state });
  const stink = new StinkLines(engine.scene);

  // Speed limits from the body (and the phone in hand) ride on top of the controller's own cap.
  // The controller rewrites speedCap every fixed step, so wrap fixedUpdate to apply ours last.
  const ctrl = player?.controller;
  const origFixed = ctrl?.fixedUpdate;
  let cap = 99;
  if (ctrl && origFixed) {
    ctrl.fixedUpdate = function (step, o) {
      if (cap < 99) {
        this.speedCap = Math.min(this.speedCap ?? 99, cap);
        if (o && cap < 3) o = { ...o, sprint: false };
      }
      return origFixed.call(this, step, o);
    };
  }

  const offs = [
    bus.on('life:phone-open-request', () => phone.open()),
    bus.on('phone:open', () => pockets.isOpen && pockets.close()),
  ];

  function update(dt) {
    // Phone (P / Tab / touch 📱) and pockets (I).
    if (input.pressed('phone') && !pockets.isOpen) phone.toggle();
    if (input.pressed('pockets') && !phone.isOpen) pockets.toggle();

    needs.update(dt);
    rent.update(dt);
    phone.update(dt);
    pockets.update(dt);
    stink.update(dt, player?.position, needs.stink);

    // Walking with the phone up is a careful shuffle; the body may slow you further.
    cap = Math.min(needs.speedCap, phone.isOpen ? 1.15 : 99, pockets.isOpen ? 0.6 : 99);
  }

  function dispose() {
    for (const off of offs) off();
    if (ctrl && origFixed) ctrl.fixedUpdate = origFixed;
    needs.dispose();
    rent.dispose();
    phone.dispose();
    pockets.dispose();
    stink.dispose();
  }

  return { update, dispose, needs, rent, phone, pockets, stink, addCash };
}
