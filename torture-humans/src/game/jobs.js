// Odd jobs for money (on your phone under Jobs): deliver a parcel from the
// grocery to a neighbor, find a neighbor's lost ring somewhere in their lawn
// (tiny! shrink down to search the grass), or work a shift at the grocery till.
import * as THREE from 'three';
import { GROUND_Y } from './levels/town.js';

const pick = (a) => a[(Math.random() * a.length) | 0];

export class Jobs {
  constructor({ scene, interact, family, env, hazards, player, toast, phone, spots }) {
    Object.assign(this, { scene, interact, family, env, hazards, player, toast, phone });
    this.doors = (spots || []).filter((s) => s.act === 'door');
    this.grocery = (spots || []).find((s) => s.name === 'Grocery');
    this.active = null;
    if (!this.grocery || !this.doors.length) return;
    const g = this.grocery.p.clone().add(new THREE.Vector3(0.9, 1.0, 0.4));
    // the parcel counter and the till (inside the grocery's door)
    this.interact.add({ at: g, radius: 2.4, label: 'Pick up a parcel to deliver ($8)', when: () => !this.active && this.open(), use: () => this.startParcel() });
    this.interact.add({ at: g.clone().add(new THREE.Vector3(0, 0.3, 0)), radius: 2.4, label: 'Work a 2-hour shift at the till ($12)', when: () => !this.active && this.open() && this.env, use: () => this.shift() });
    // the parcel, carried in front of you
    this.parcel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.26), new THREE.MeshStandardMaterial({ color: 0xb8925a, roughness: 0.9 }));
    this.parcel.visible = false;
    this.parcel.userData.noCollide = true;
    scene.add(this.parcel);
    // the lost ring (2 cm, gold) and its owner
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0022, 10, 24), new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.2 }));
    this.ring.rotation.x = Math.PI / 2 - 0.3;
    this.ring.visible = false;
    this.ring.userData.noCollide = true;
    scene.add(this.ring);
    this.interact.add({ at: () => this.ring.position, radius: 0.6, anyScale: true, label: 'Pick up the ring', when: () => this.ring.visible, use: () => { this.ring.visible = false; this.active.found = true; this.say('Got the ring! Bring it back to their door.'); } });
    this.offerT = 30;
  }

  open() { const h = this.env?.hour ?? 12; return h >= 8 && h < 20; }

  say(t) { this.toast?.(t); }

  doorAt(door) { return door.p.clone().add(new THREE.Vector3(0, 1.1, -0.6)); }

  startParcel() {
    const door = pick(this.doors);
    const name = `the ${pick(['Millers', 'Okafors', 'Nguyens', 'Garcias', 'Kowalskis', 'Patels'])}`;
    this.active = { kind: 'parcel', door, name, pay: 8 };
    this.parcel.visible = true;
    this.active.drop = this.interact.add({ at: this.doorAt(door), radius: 2.2, label: `Deliver the parcel to ${name}`, use: () => this.finish() });
    this.say(`Deliver this to ${name} (a house on your side of the street — check the map).`);
    this.phone?.text('Grocery', `Parcel for ${name}. They're expecting it!`);
  }

  offerRing() {
    const door = pick(this.doors);
    const name = pick(['Mrs. Ellis', 'Mr. Romano', 'Grandma Joy', 'Mr. Chen']);
    // somewhere in the lawn in front of their house
    // on the lawn between their door and the sidewalk (the lawn is 2 cm lower than the path)
    const p = door.p.clone().add(new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2), 0, 0.8 + Math.random() * 1.8));
    p.y = GROUND_Y + 0.003;
    this.ring.position.copy(p);
    this.ring.visible = true;
    this.active = { kind: 'ring', door, name, pay: 15, found: false };
    this.active.drop = this.interact.add({ at: this.doorAt(door), radius: 2.2, anyScale: true, label: `Give ${name} the ring back`, when: () => this.active?.found, use: () => this.finish() });
    this.phone?.text(name, 'I lost my wedding ring in my front lawn!! $15 if you find it. It\'s so tiny in all that grass...');
    this.say(`📱 ${name}: lost a ring in their front lawn. $15 if you find it (it's tiny — try shrinking).`);
  }

  shift() {
    this.active = { kind: 'shift', pay: 12 };
    this.hazards.blackout('You work a shift at the till… beep. beep. beep.', this.player.feet.clone(), { revive: false });
    this.hazards.onMoved = () => {
      this.hazards.onMoved = null;
      this.env.hour = Math.min(23.5, this.env.hour + 2);
      this.finish();
    };
  }

  finish() {
    const a = this.active;
    if (!a) return;
    if (a.drop) this.interact.remove(a.drop);
    this.parcel.visible = false;
    this.family?.addMoney(a.pay);
    this.say(a.kind === 'parcel' ? `Delivered! "${pick(['Thanks, kid!', 'Oh, finally!', 'Here, keep the change.'])}" +$${a.pay}` : a.kind === 'ring' ? `${a.name}: "My ring! Thank you so much!" +$${a.pay}` : `Shift done. +$${a.pay}`);
    this.active = null;
    this.offerT = 120 + Math.random() * 180;
  }

  update(dt, camera) {
    if (!this.grocery) return;
    if (this.parcel.visible) {
      // held in front of you (both arms)
      const s = this.player.scale;
      this.parcel.scale.setScalar(s);
      this.parcel.position.copy(camera.localToWorld(new THREE.Vector3(0, -0.35, -0.55).multiplyScalar(s)));
      this.parcel.quaternion.copy(camera.quaternion);
    }
    // every few minutes, someone posts a lost-ring job
    if (!this.active) {
      this.offerT -= dt;
      if (this.offerT <= 0 && this.open()) this.offerRing();
    }
  }
}
