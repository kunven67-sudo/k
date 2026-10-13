// Doors (and the secret bookshelf): hinged panels that swing open/closed when you press E.
// The panel is a kinematic physics body, so a closed door really blocks you, and an opening door
// pushes loose things out of the way. Real interior doors stop ~1.5 cm above the floor, so a
// mouse-sized you can squeeze under and an ant-sized you walks under easily.
import * as THREE from 'three';
import { RAPIER, GROUPS } from '../core/physics.js';
import { damp } from '../core/util.js';
import { std } from '../render/materials.js';
import { bus } from '../core/events.js';

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class Door {
  // hinge: world position of the hinge at the bottom of the door.
  // width, height, thick: panel size. yaw: closed direction (panel extends from the hinge along +X
  // rotated by yaw). openAngle: radians (positive swings counter-clockwise seen from above).
  constructor(game, { hinge, width = 0.9, height = 2.03, thick = 0.04, yaw = 0, openAngle = 1.75, gap = 0.015, model = null, name = 'Door', locked = false, onOpen = null, prompt = null, interactPoint = null }) {
    this.game = game;
    this.kind = 'door';
    this.name = name;
    this.hinge = new THREE.Vector3().fromArray(hinge);
    this.width = width;
    this.height = height;
    this.yaw = yaw;
    this.openAngle = openAngle;
    this.angle = 0;
    this.target = 0;
    this.locked = locked;
    this.onOpen = onOpen;
    this.customPrompt = prompt;
    this.interactPoint = interactPoint;
    this.immuneToRay = true; // part of the building

    this.object = new THREE.Group();
    this.object.position.copy(this.hinge);
    this.object.rotation.y = yaw;
    this.panel = model || defaultPanel(width, height - gap, thick);
    this.panel.position.y = gap;
    this.object.add(this.panel);
    this.object.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    game.scene.add(this.object);

    const physics = game.physics;
    this.body = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.hinge.x, this.hinge.y, this.hinge.z));
    const c = physics.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, (height - gap) / 2, thick / 2).setTranslation(width / 2, gap + (height - gap) / 2, 0).setCollisionGroups(GROUPS.static),
      this.body
    );
    physics.own(c, this);
    this._apply();
    game.updatables.add(this);
  }

  get open() {
    return this.target > 0.5;
  }

  interactText() {
    if (this.customPrompt) return this.customPrompt(this);
    if (this.locked) return `${this.name} is locked`;
    return this.open ? `Close ${this.name.toLowerCase()}` : `Open ${this.name.toLowerCase()}`;
  }

  // Doorknobs need a hand: tiny you can't turn one (master list section 5).
  canUse(player) {
    return player.height > 0.35;
  }

  interact(player) {
    if (this.locked) return;
    if (!this.canUse(player)) {
      bus.emit('toast', 'Too small to turn the handle. Real doors have a gap underneath, try crawling under.');
      return;
    }
    this.target = this.open ? 0 : 1;
    if (this.target === 1) this.onOpen?.(this);
  }

  _apply() {
    _q.setFromAxisAngle(UP, this.yaw + this.angle * this.openAngle);
    this.body.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    this.object.quaternion.copy(_q);
  }

  update(dt) {
    const prev = this.angle;
    this.angle = damp(this.angle, this.target, 4.5, dt);
    if (Math.abs(this.angle - this.target) < 1e-3) this.angle = this.target;
    if (this.angle !== prev) this._apply();
  }
}

function defaultPanel(w, h, t) {
  const g = new THREE.Group();
  const mat = std({ color: 0xf1efe9, roughness: 0.5 }, { indoor: true, detail: 'paint' });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, t), mat);
  slab.position.set(w / 2, h / 2, 0);
  g.add(slab);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), std({ color: 0x9a9da2, metalness: 1, roughness: 0.25 }, { indoor: true, detail: 'metal' }));
  for (const s of [-1, 1]) {
    const k = knob.clone();
    k.position.set(w - 0.07, 0.98, s * (t / 2 + 0.03));
    g.add(k);
  }
  return g;
}
