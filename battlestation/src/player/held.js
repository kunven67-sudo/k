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
      if (!this._fired && this.useT > 0.45) { this._fired = true; const gone = it.onUse?.(this); if (gone) { this.g.scene.remove(it.obj); this.item = null; this.using = false; return; } }
      if (this.useT >= 1) { this.using = false; this.useT = 0; }
    }
    const hand = av.bones.hand_r;
    hand.updateMatrixWorld(true);
    const m = hand.matrixWorld;
    const off = it.grip || _grip;
    it.obj.position.copy(off).applyMatrix4(m);
    // keep it upright-ish (a can stays standing in your hand) but follow the hand's heading
    const fwd = new THREE.Vector3().setFromMatrixColumn(m, 0);
    const yaw = Math.atan2(fwd.x, fwd.z);
    let tilt = 0;
    if (this.using) tilt = Math.sin(Math.min(1, this.useT) * Math.PI) * (it.kind === 'drink' ? 1.25 : 0.2);
    it.obj.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ')).multiply(_qt.setFromAxisAngle(_x, -tilt));
  }

  // how far up toward your mouth the hand is (0..1) for the arm pose
  lift() { return this.using ? Math.sin(Math.min(1, this.useT) * Math.PI) : 0; }
}
const _up = new THREE.Vector3(0, 1, 0), _x = new THREE.Vector3(1, 0, 0), _c = new THREE.Vector2(0, 0), _qt = new THREE.Quaternion();
const _grip = new THREE.Vector3(0, 0.08, 0.03);
