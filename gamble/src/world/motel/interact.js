// Interactable descriptors for the motel (doors, drawers, curtains, switches, appliances).
//
// Every interactable is a plain object the player module can drive directly:
//   { id, kind: 'hinge'|'slide'|'toggle'|'prop', object, axis, limits: [min, max], value, target,
//     collider, on, toggle(v?), set(v), describe(), onInteract(player), update(dt) }
// - hinge / slide: `value` eases toward `target` (radians / metres along `axis` of `object`);
//   toggle() flips between limits[0] and limits[1]; the player may also set(v) continuously (grab).
//   A box collider follows the moving part so a closed door blocks and an open one does not.
// - toggle: on/off switch; `onToggle(on)` does the real work (lights, TV, AC, water…).
// The physics owner of each collider is the descriptor itself, so interaction raycasts find it.
import * as THREE from 'three';
import { audio } from '../../core/audio.js';
import { t } from '../../core/i18n.js';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

function play(name, obj, o = {}) {
  if (!name) return;
  try {
    obj.getWorldPosition(_p);
    audio.play(name, { bus: 'sfx', position: { x: _p.x, y: _p.y, z: _p.z }, refDistance: 1.5, rate: 0.94 + Math.random() * 0.12, ...o });
  } catch {
    // Audio not unlocked yet — interaction still works silently.
  }
}

/**
 * Moving part with a collider.
 * @param {object} o  id, kind ('hinge'|'slide'), object (pivot), axis ('x'|'y'|'z'), limits,
 *                    physics, box: {size:[x,y,z], offset:[x,y,z]} in the pivot's local space,
 *                    speed (units/s, eased), sounds: {open, close, shut}, label (i18n key), start,
 *                    onChange(value) for parts that do more than move (curtains bunch up)
 */
export function movable(o) {
  const it = {
    id: o.id,
    kind: o.kind,
    object: o.object,
    axis: o.axis || 'y',
    limits: o.limits,
    value: o.start ?? o.limits[0],
    target: o.start ?? o.limits[0],
    collider: null,
    speed: o.speed ?? 2.5,
    get on() {
      return Math.abs(this.target - this.limits[0]) > 1e-3;
    },
    toggle(v) {
      const open = v ?? !this.on;
      this.target = open ? this.limits[1] : this.limits[0];
      play(open ? o.sounds?.open : o.sounds?.close, this.object);
      o.onToggle?.(open);
      return open;
    },
    set(v) {
      this.target = THREE.MathUtils.clamp(v, Math.min(...this.limits), Math.max(...this.limits));
    },
    describe: () => t(o.label || 'motel.it.thing'),
    onInteract() {
      return it.toggle();
    },
    update(dt) {
      if (Math.abs(this.value - this.target) < 1e-4) return;
      // Critically-damped-ish ease with a max speed: doors swing, drawers glide.
      const d = this.target - this.value;
      const step = Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * 8 * dt, this.speed * 0.25 * dt), this.speed * dt);
      this.value += step;
      if (Math.abs(this.target - this.value) < 1e-4) {
        this.value = this.target;
        if (!this.on) play(o.sounds?.shut, this.object);
      }
      apply(this);
    },
  };
  const base = o.object.position.clone();
  const baseRot = o.object.rotation.clone();
  function apply(self) {
    if (self.kind === 'hinge') {
      self.object.rotation.copy(baseRot);
      self.object.rotation[self.axis] = baseRot[self.axis] + self.value;
    } else {
      self.object.position.copy(base);
      self.object.position[self.axis] = base[self.axis] + self.value;
    }
    syncCollider(self);
    o.onChange?.(self.value);
  }
  if (o.physics && o.box) {
    const [sx, sy, sz] = o.box.size;
    it._box = o.box;
    it.collider = o.physics.addStaticBox({ x: 0, y: 0, z: 0 }, { x: sx, y: sy, z: sz }, new THREE.Quaternion(), { owner: it });
  }
  apply(it);
  return it;
}

function syncCollider(it) {
  if (!it.collider) return;
  const [ox, oy, oz] = it._box.offset || [0, 0, 0];
  it.object.updateWorldMatrix(true, false);
  it.object.matrixWorld.decompose(_s, _q, new THREE.Vector3());
  _p.set(ox, oy, oz).applyMatrix4(it.object.matrixWorld);
  it.collider.setTranslation({ x: _p.x, y: _p.y, z: _p.z });
  it.collider.setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
}

/** On/off control (light switch, lamp, TV, AC, shower, sink, flush). */
export function switcher(o) {
  const it = {
    id: o.id,
    kind: 'toggle',
    object: o.object,
    axis: null,
    limits: [0, 1],
    on: !!o.start,
    collider: null,
    toggle(v) {
      this.on = v ?? !this.on;
      play(o.sound ?? 'light.switch', this.object, { gain: o.gain ?? 0.8 });
      o.onToggle?.(this.on);
      return this.on;
    },
    set(v) {
      this.toggle(!!v);
    },
    describe: () => t(o.label || 'motel.it.switch'),
    onInteract() {
      return it.toggle();
    },
    update: o.update || null,
  };
  if (o.physics && o.box) {
    const p = new THREE.Vector3(...(o.box.offset || [0, 0, 0]));
    o.object.updateWorldMatrix(true, false);
    p.applyMatrix4(o.object.matrixWorld);
    o.object.getWorldQuaternion(_q);
    const [sx, sy, sz] = o.box.size;
    it.collider = o.physics.addStaticBox(p, { x: sx, y: sy, z: sz }, _q.clone(), { owner: it });
  }
  return it;
}
