import * as THREE from 'three';

// Whatever is in your right hand: a can from the fridge, a slice of pizza, a mug.
// Left click uses it (drink / eat), E on a table or counter puts it down, G drops it.
export class Held {
  constructor(g) {
    this.g = g;
    this.item = null;
    this.useT = 0;     // 0..1 while bringing it to your mouth
    this.using = false;
    this.ray = new THREE.Raycaster();
    this.ray.far = 2.2;
  }

  get has() { return !!this.item; }

  // item: { obj, name, kind, grip: Vector3 (offset in the hand), onUse(held) -> bool (true = used up), surfaceY }
  take(item) {
    if (this.item) this.putDownAt(null);
    this.item = item;
    item.obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.g.scene.attach(item.obj);
    item.home = item.home || item.obj.position.clone();
    this.g.audio.play('pickup.ogg', { pos: item.obj.getWorldPosition(new THREE.Vector3()), vol: 0.35, jitter: 0.08 });
    item.onTake?.();
  }

  use() {
    const it = this.item;
    if (!it || this.using) return;
    if (it.skipUse?.()) { it.onUse?.(this); return; } // e.g. cracking a can open
    this.using = true;
    this.useT = 0;
    this._fired = false;
  }

  // put it on whatever surface you're looking at (or straight down in front of you)
  putDownAt(point) {
    const it = this.item;
    if (!it) return;
    const g = this.g;
    let p = point;
    if (!p) {
      const cam = g.camera, dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      p = cam.position.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), 0.45);
      p.y = this.floorBelow(p);
    }
    it.obj.position.copy(p);
    it.obj.quaternion.setFromAxisAngle(_up, Math.random() * 6.28);
    it.obj.updateMatrixWorld(true);
    this.item = null;
    this.using = false;
    g.audio.play('pickup.ogg', { pos: p, vol: 0.3, rate: 0.8 });
    it.onPutDown?.(p);
  }

  // where you're looking, if it's a flat top you can put something on
  surfaceHit() {
    const g = this.g;
    this.ray.setFromCamera(_c, g.camera);
    const objs = g.interact.blockers;
    const h = this.ray.intersectObjects(objs, true).find(x => x.face && x.object.visible);
    if (!h) return null;
    const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    if (n.y < 0.8) return null;
    return h.point;
  }

  floorBelow(p) {
    const r = new THREE.Raycaster(p.clone().setY(1.6), new THREE.Vector3(0, -1, 0), 0, 2);
    const h = r.intersectObjects(this.g.interact.blockers, true).find(x => x.face && x.object.visible);
    return h ? h.point.y : 0;
  }

  // called after the body is posed: stick the item in the hand, animate using it
  update(dt, av) {
    const it = this.item;
    if (!it) return;
    if (this.using) {
      this.useT += dt / (it.useTime || 1.6);
      if (!this._fired && this.useT > 0.45) { this._fired = true; const gone = it.onUse?.(this); if (gone) { it.obj.visible = false; this.g.scene.remove(it.obj); this.item = null; this.using = false; return; } }
      if (this.useT >= 1) { this.using = false; this.useT = 0; }
    }
    // in your fist: a bit along the fingers, against the palm, upright
    const hand = av.bones.hand_r, f = av.handFrame.r;
    hand.updateMatrixWorld(true);
    const q = hand.getWorldQuaternion(_qh);
    const fwd = _f.copy(f.fwd).applyQuaternion(q), back = _b.copy(f.back).applyQuaternion(q);
    const g = it.grip || _grip; // [along fingers, out of the palm, along the thumb]
    it.obj.position.setFromMatrixPosition(hand.matrixWorld).addScaledVector(fwd, g.x).addScaledVector(back, -g.y);
    it.obj.position.y -= it.hang ?? 0.05; // the hand wraps around the middle of the thing
    const yaw = Math.atan2(-back.x, -back.z);
    let tilt = 0;
    if (this.using) tilt = Math.sin(Math.min(1, this.useT) * Math.PI) * (it.kind === 'drink' ? 1.5 : 0.25);
    it.obj.quaternion.setFromEuler(_e.set(0, yaw, 0, 'YXZ')).multiply(_qt.setFromAxisAngle(_z, tilt));
  }

  // how far up toward your mouth the hand is (0..1) for the arm pose
  lift() { return this.using ? Math.sin(Math.min(1, this.useT) * Math.PI) : 0; }
}
const _up = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1), _c = new THREE.Vector2(0, 0), _qt = new THREE.Quaternion(), _qh = new THREE.Quaternion();
const _f = new THREE.Vector3(), _b = new THREE.Vector3(), _e = new THREE.Euler();
const _grip = new THREE.Vector3(0.06, 0.04, 0);
