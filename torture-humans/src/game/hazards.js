// What the world does to you: wading and drinking in the pond, burning in the
// lava, and waking up back in the lab when you die in the tiny world.
import * as THREE from 'three';

export class Hazards {
  constructor({ player, cage, vitals, input, respawn }) {
    this.player = player;
    this.cage = cage;
    this.vitals = vitals;
    this.input = input;
    this.respawn = respawn;
    this.fading = null;
    vitals.onDeath = (cause) => this.die(cause);
  }

  die(cause) {
    const msg = {
      lava: 'You fell in the lava… and woke up in the lab, dizzy.',
      starved: 'You starved… and woke up in the lab. Eat something!',
      dehydrated: 'You passed out from thirst… and woke up in the lab.',
    }[cause] || 'You blacked out… and woke up in the lab.';
    this.fading = { t: 0, msg };
  }

  // fade to black with a message, move you somewhere (full size), fade back in
  blackout(msg, to, { revive = false, busted = false } = {}) {
    if (this.fading) return;
    this.fading = { t: 0, msg, to, revive, busted };
  }

  update(dt) {
    const p = this.player;
    const cage = this.cage;
    p.speedMul = 1;
    p.inWater = false;
    if (cage && p.inCage && p.scale < 1 && !this.fading) {
      const local = cage.group.worldToLocal(p.feet.clone());
      if (cage.inLava(local.x, local.z)) {
        this.vitals.damage(45 * dt, 'lava');
        this.vitals.hurtFlash = Math.max(this.vitals.hurtFlash, 0.9); // the edges of your view burn red
      }
      const depth = cage.waterDepth(local.x, local.z);
      if (depth > 0.004) {
        p.inWater = true;
        // wading: the deeper, the slower (0.5 = up to your waist)
        p.speedMul = THREE.MathUtils.clamp(1 - depth / (0.09 * p.scale / 0.05), 0.35, 0.8);
        if (p.actualSpeed > 0.005) cage.tiny?.ripple?.(local, dt, 'player');
        if (this.input.pressed('interact')) this.vitals.drink(12);
      }
    }
    // death: fade to black, move you to the lab at full size, fade back in
    const f = this.fading;
    const box = document.getElementById('blackout');
    if (f) {
      f.t += dt;
      if (box) {
        box.hidden = false;
        box.style.opacity = String(f.t < 1 ? f.t : f.t < 3 ? 1 : Math.max(0, 4 - f.t));
        box.querySelector('span').textContent = f.msg;
        box.classList.toggle('busted', !!f.busted);
      }
      if (f.t >= 1 && !f.moved) {
        f.moved = true;
        p.inCage = false;
        p.setScale(1, f.to || this.respawn);
        if (!f.to || f.revive) this.vitals.revive(60);
        this.onMoved?.(f);
      }
      if (f.t >= 4) { this.fading = null; if (box) box.hidden = true; }
    }
  }
}
