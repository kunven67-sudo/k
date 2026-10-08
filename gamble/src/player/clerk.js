// The Starlite's night-and-day clerk: a tired older man on a stool behind the bulletproof glass.
// Idles (the Human's own breathing / weight shifts), watches the player through the glass when
// they come near, and owns the 'office-window' talk interactable (DESIGN §34: paying rent is
// handled by the life module through bus 'talk:clerk').
import * as THREE from 'three';
import { createHuman, randomHumanParams } from '../character/index.js';
import { bus } from '../core/events.js';
import { t } from '../core/i18n.js';
import { Rng } from '../core/rng.js';
import { say } from './voice.js';
import './strings.js';

const _v = new THREE.Vector3();

export class Clerk {
  constructor({ spawn, desk, tier, getPlayer }) {
    const params = randomHumanParams(new Rng('starlite-clerk'), { uniform: 'clerk', sex: 'm', age: 63, fat: 0.62, height: 1.72 });
    this.human = createHuman(params, { tier });
    this.root = this.human.root;
    // Faces the window (+Z), standing just behind the counter.
    this.root.position.set(spawn.x, spawn.y, spawn.z + 0.45); // close to the glass, where the light reaches
    this.root.rotation.y = 0;
    this.getPlayer = getPlayer;
    this.time = Math.random() * 10;
    this.near = false;
    this._look = new THREE.Vector3();
    this.window = {
      id: 'office-window',
      kind: 'talk',
      position: new THREE.Vector3(desk.x, desk.y + 1.3, -18.3),
      radius: 0.55,
      reach: 2.6,
      describe: () => t('player.frontDesk'),
      onInteract: (player) => {
        this.human.lookAt(player?.head?.(_v) || null);
        this.human.play('wave-off', { speed: 0.8 });
        // If nobody handles the conversation (life module absent), he at least answers.
        const handled = { value: false };
        bus.emit('talk:clerk', { clerk: this, player, handled });
        if (!handled.value) say(t('player.clerkHey'), { pitch: 0.78, rate: 0.98 });
        return true;
      },
    };
  }

  update(dt, camPos) {
    const d = this.root.position.distanceTo(camPos);
    // Off-screen and far: freeze him entirely (no skinning, no animation).
    const active = d < 38;
    if (this.root.visible !== active) this.root.visible = active;
    if (!active) return;
    this.time += dt;
    const p = this.getPlayer?.();
    if (p) {
      const pd = p.position.distanceTo(this.root.position);
      const near = pd < 7.5;
      if (near) this.human.lookAt(p.head(this._look));
      else if (this.near) this.human.lookAt(null);
      this.near = near;
      // Glances down at his little TV now and then when nobody's there.
      if (!near && Math.sin(this.time * 0.21) > 0.6) this.human.lookAt(_v.set(this.root.position.x - 1.2, this.root.position.y + 1.6, this.root.position.z - 0.6));
    }
    this.human.update(dt);
  }

  dispose() {
    this.root.removeFromParent();
    this.human.dispose?.();
  }
}
