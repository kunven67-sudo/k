// Pets you buy at the pet shop: a pet rat that scurries after you around the
// house (and is a monster when you're tiny), and a leopard gecko in a little
// glass tank on your dresser. E pets them; with treats/crickets in your
// backpack, E feeds them.
import * as THREE from 'three';
import { place } from './engine/assets.js';
import { GROUP, groups } from './engine/physics.js';

const FLOOR = groups(GROUP.NPC, GROUP.WORLD | GROUP.PROP);
const pick = (a) => a[(Math.random() * a.length) | 0];

function geckoMesh() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e8c45a'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 70; i++) { g.fillStyle = '#2a2016'; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 64, 1 + Math.random() * 2.5, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const skin = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.6 });
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.04, 6, 12).rotateX(Math.PI / 2), skin);
  body.scale.set(1.1, 0.75, 1);
  body.position.y = 0.011;
  root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), skin);
  head.scale.set(1, 0.75, 1.35);
  head.position.set(0, 0.013, 0.034);
  root.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 8, 6), new THREE.MeshStandardMaterial({ color: 0x1c1a14, roughness: 0.05 }));
    eye.position.set(s * 0.008, 0.017, 0.038);
    root.add(eye);
  }
  // a fat tail (leopard geckos store fat in it), banded
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.055, 12).rotateX(-Math.PI / 2), skin);
  tail.position.set(0, 0.009, -0.05);
  root.add(tail);
  const legs = [];
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.003, 0.016, 6), belly);
    leg.position.set(x * 0.013, 0.006, z * 0.016);
    leg.rotation.z = x * 1.1;
    root.add(leg);
    legs.push(leg);
  }
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.0006, 0.008), new THREE.MeshStandardMaterial({ color: 0xd8506a }));
  tongue.position.set(0, 0.009, 0.05);
  tongue.visible = false;
  root.add(tongue);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noCollide = true; } });
  root.userData = { head, tail, tongue, legs };
  return root;
}

export class Pets {
  constructor({ scene, player, nav, physics, interact, speech, shops, toast, home }) {
    Object.assign(this, { scene, player, nav, physics, interact, speech, shops, toast, home });
    this.list = [];
  }

  has(kind) { return this.list.some((p) => p.kind === kind); }

  async adopt(kind, { quiet = false } = {}) {
    if (this.has(kind)) return false;
    const pet = { kind, alive: true, profile: { name: kind === 'rat' ? pick(['Squeaky', 'Nibbles', 'Remy', 'Cheddar']) : pick(['Gizmo', 'Mango', 'Spot', 'Leo']) }, love: 0.5, t: 0 };
    const holder = new THREE.Group();
    this.scene.add(holder);
    if (kind === 'rat') {
      const m = await place(holder, 'street_rat', { x: 0, y: 0, z: 0, width: 0.24 }).catch(() => null);
      if (!m) { this.scene.remove(holder); return false; }
      m.traverse((o) => { o.userData.noCollide = true; });
      pet.model = m;
      const start = this.home?.spots?.tv?.p ?? this.player.feet;
      holder.position.copy(start);
      pet.agent = this.nav.addAgent(start, { radius: 0.08, height: 0.12, maxSpeed: 1.6 });
    } else {
      // a 30 cm glass tank on your dresser, with sand, a hide and a water dish
      const fy = 3.3, top = fy + 0.9;
      const at = new THREE.Vector3(4.6, top, -4.72);
      holder.position.copy(at);
      const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.35, thickness: 0.003 });
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.2), glass);
      tank.position.y = 0.08;
      tank.userData.noCollide = true;
      holder.add(tank);
      const sand = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.02, 0.19), new THREE.MeshStandardMaterial({ color: 0xd8b880, roughness: 1 }));
      sand.position.y = 0.01;
      holder.add(sand);
      const hide = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.9, side: THREE.DoubleSide }));
      hide.position.set(-0.1, 0.02, 0.02);
      holder.add(hide);
      const gecko = geckoMesh();
      gecko.position.set(0.04, 0.02, 0);
      holder.add(gecko);
      pet.model = gecko;
      pet.tank = holder;
    }
    pet.holder = holder;
    pet.character = { root: kind === 'rat' ? holder : pet.model, bones: {} }; // for speech bubbles
    this.list.push(pet);
    this.interact.add({
      at: () => pet.model.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.05, 0)),
      radius: 1.8,
      label: () => (this.food(kind) ? `Feed ${pet.profile.name}` : `Pet ${pet.profile.name}`),
      use: () => this.touch(pet),
    });
    if (!quiet) this.toast?.(`${pet.profile.name} the ${kind === 'rat' ? 'pet rat' : 'leopard gecko'} is yours! ${kind === 'rat' ? 'They\'ll follow you around the house.' : 'Their tank is on your dresser.'}`);
    return true;
  }

  food(kind) {
    const id = kind === 'rat' ? 'treats' : 'crickets';
    return this.shops?.bag.get(id) ? id : null;
  }

  touch(pet) {
    const id = this.food(pet.kind);
    if (id) {
      const e = this.shops.bag.get(id);
      if (--e.n <= 0) this.shops.bag.delete(id);
      pet.love = Math.min(1, pet.love + 0.3);
      this.speech?.say(pet, pet.kind === 'rat' ? '*nom nom* squeak!' : '*snap* (a cricket vanishes)');
      if (pet.kind === 'gecko') pet.lick = 1.5;
    } else {
      pet.love = Math.min(1, pet.love + 0.1);
      this.speech?.say(pet, pet.kind === 'rat' ? pick(['squeak!', '*happy bruxing*', '*sniff sniff*']) : pick(['*blinks slowly*', '*licks its eye*', '*wags tail*']));
      if (pet.kind === 'gecko') pet.lick = 1;
    }
  }

  update(dt) {
    const p = this.player;
    for (const pet of this.list) {
      pet.t += dt;
      if (pet.kind === 'rat') this.updateRat(pet, dt, p);
      else this.updateGecko(pet, dt);
    }
  }

  updateRat(pet, dt, p) {
    const a = pet.agent;
    if (!a) return;
    pet.think = (pet.think ?? 0) - dt;
    const here = a.position();
    const f = p.feet;
    const dYou = Math.hypot(f.x - here.x, f.z - here.z);
    if (pet.think <= 0) {
      pet.think = 0.6;
      // follow you when you're close-ish and normal-sized; otherwise explore the house
      const big = p.scale > 0.5 && p.scale < 3;
      if (big && dYou < 10 && dYou > 0.9 && Math.abs(f.y - here.y) < 1) {
        // to your feet, but not under them
        const back = new THREE.Vector3(here.x - f.x, 0, here.z - f.z).normalize().multiplyScalar(0.55);
        const q = this.nav.closest(f.clone().add(back));
        if (q) a.requestMoveTarget(q);
      } else if (big && dYou <= 0.9) {
        a.resetMoveTarget();
      } else if (!big && p.scale < 0.2 && dYou < 1.5) {
        // you're tiny: it sniffs over to check you out
        const q = this.nav.closest(f);
        if (q) a.requestMoveTarget(q);
      } else if (Math.random() < 0.15) {
        const q = this.nav.randomPoint((r) => (this.home?.inHouse ? this.home.inHouse(r) : true) && Math.hypot(r.x - here.x, r.z - here.z) < 4);
        if (q) a.requestMoveTarget(q);
      }
    }
    const v = a.velocity();
    const speed = Math.hypot(v.x, v.z);
    const hit = this.physics.raycast({ x: here.x, y: here.y + 0.3, z: here.z }, { x: 0, y: -1, z: 0 }, 0.8, { filterGroups: FLOOR });
    const h = pet.holder;
    h.position.set(here.x, hit ? hit.point.y : here.y, here.z);
    if (speed > 0.05) {
      const want = Math.atan2(v.x, v.z);
      let d = want - h.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      h.rotation.y += d * (1 - Math.exp(-dt * 10));
    }
    // scurry: quick little hops and a nose that never stops twitching
    const m = pet.model;
    m.position.y = speed > 0.05 ? Math.abs(Math.sin(pet.t * 22)) * 0.012 : 0;
    m.rotation.x = speed > 0.05 ? Math.sin(pet.t * 22) * 0.08 : Math.sin(pet.t * 9) * 0.015;
  }

  updateGecko(pet, dt) {
    const u = pet.model.userData;
    pet.look = (pet.look ?? 0) - dt;
    if (pet.look <= 0) { pet.look = 2 + Math.random() * 5; pet.headTo = (Math.random() - 0.5) * 0.8; if (Math.random() < 0.3) pet.lick = 0.6; }
    u.head.rotation.y += ((pet.headTo ?? 0) - u.head.rotation.y) * (1 - Math.exp(-dt * 4));
    u.tail.rotation.y = Math.sin(pet.t * 1.3) * 0.15 * (pet.love + 0.2);
    pet.lick = Math.max(0, (pet.lick ?? 0) - dt);
    u.tongue.visible = pet.lick > 0 && Math.sin(pet.t * 30) > 0;
    // breathing
    pet.model.scale.y = 1 + Math.sin(pet.t * 2.5) * 0.03;
  }
}
