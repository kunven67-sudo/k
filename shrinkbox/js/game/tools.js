// Your tools (1-5): hands, the shrinker, glue gun, duct tape, cutter (objects only).
import * as THREE from 'three';
import { input } from '../core/input.js';
import { R, world } from '../core/physics.js';
import { sfx, loop } from '../core/audio.js';
import { things } from '../world/thing.js';
import { CUT_INTO, buildItem } from '../world/objects/items.js';
import { defMat } from '../core/materials.js';

export const TOOLS = [
  { id: 'hands', icon: '✋', name: 'Hands' },
  { id: 'shrinker', icon: '🔫', name: 'Shrinker' },
  { id: 'glue', icon: '🧴', name: 'Glue gun' },
  { id: 'tape', icon: '🩹', name: 'Duct tape' },
  { id: 'cutter', icon: '✂️', name: 'Cutter' },
];

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion();
const M = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...extra });

// first-person models (meters, held in the right hand)
function toolModel(id) {
  const g = new THREE.Group();
  if (id === 'shrinker') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.16), M(0x2a2f38, { metalness: 0.6 })); g.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.04), M(0x15171b)); grip.position.set(0, -0.06, 0.04); grip.rotation.x = 0.25; g.add(grip);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.012, 0.03, 20), M(0x9aa3ad, { metalness: 1, roughness: 0.2 })); dish.rotation.x = Math.PI / 2; dish.position.z = -0.095; g.add(dish);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 20), M(0xb0612f, { metalness: 1 })); coil.position.z = -0.07; g.add(coil);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8ff6ff, emissive: 0x8ff6ff, emissiveIntensity: 2 })); glow.position.z = -0.108; g.add(glow); g.userData.glow = glow;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.02), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x4ef2ff, emissiveIntensity: 1 })); scr.rotation.x = -Math.PI / 2 + 0.3; scr.position.set(0, 0.024, 0.03); g.add(scr); g.userData.screen = scr;
  } else if (id === 'glue') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.12), M(0x3a7bd5)); g.add(body);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.035), M(0x2b5ea8)); grip.position.set(0, -0.065, 0.035); grip.rotation.x = 0.2; g.add(grip);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.04, 12), M(0xc0c4c8, { metalness: 1 })); nozzle.rotation.x = -Math.PI / 2; nozzle.position.z = -0.08; g.add(nozzle);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.1, 12), M(0xf2f0e6, { transparent: true, opacity: 0.8 })); stick.rotation.x = Math.PI / 2; stick.position.set(0, 0.01, 0.1); g.add(stick);
  } else if (id === 'tape') {
    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.016, 12, 28), M(0x8d9298, { roughness: 0.7 })); roll.rotation.y = Math.PI / 2; g.add(roll);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.046, 20, 1, true), M(0xb08a5a, { side: THREE.DoubleSide })); core.rotation.z = Math.PI / 2; g.add(core);
  } else if (id === 'cutter') {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.13), M(0xf2c218)); g.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.012, 0.03), M(0xdfe3e8, { metalness: 1, roughness: 0.15 })); blade.position.set(0, 0, -0.078); g.add(blade);
  }
  return g;
}

export class Tools {
  constructor(game) {
    this.game = game;
    this.sel = 0;
    this.held = null;
    this.mode = -1;       // shrinker: -1 shrink, +1 grow
    this.charge = 0;
    this.pending = null;  // glue/tape first pick
    this.anims = [];      // scale animations
    this.beams = [];
    this.joints = [];
    this.models = TOOLS.map((t) => toolModel(t.id));
    this.chargeSnd = null;
    game.ui.setTools(TOOLS, 0);
    this.select(0);
  }

  select(i) {
    if (this.held && i !== 0) this.drop();
    this.sel = (i + TOOLS.length) % TOOLS.length;
    this.pending = null;
    const hold = this.game.viewModel.toolHold;
    hold.clear();
    if (this.models[this.sel].children.length) hold.add(this.models[this.sel]);
    this.game.ui.setTools(TOOLS, this.sel);
    const id = TOOLS[this.sel].id;
    this.game.ui.setModeTag(id === 'shrinker' ? (this.mode < 0 ? '▼ SHRINK (scroll)' : '▲ GROW (scroll)') : '', this.mode > 0);
  }

  get tool() { return TOOLS[this.sel].id; }

  update(dt) {
    const g = this.game, p = g.player, s = p.s;
    for (let i = 1; i <= 5; i++) if (input.pressed('slot' + i)) this.select(i - 1);
    if (input.pressed('slotNext')) this.select(this.sel + 1);
    if (input.pressed('slotPrev')) this.select(this.sel - 1);
    this.updateAnims(dt);
    this.updateBeams(dt);
    if (this.held) this.updateHeld(dt);
    const id = this.tool;
    const reach = 2.2 * s;
    if (id === 'hands') {
      if (input.pressed('use') && !g.usedInteractThisFrame) { if (this.held) this.drop(); else this.tryGrab(reach); }
      if (input.pressed('grab')) { if (this.held) this.drop(); else this.tryGrab(reach); }
      if (this.held && input.pressed('fire')) this.throwHeld();
      if (this.held && input.held('rotate')) { const b = this.held.body; b.setAngvel({ x: 0, y: 2.5, z: 0 }, true); }
      if (!this.held && input.pressed('fire')) {
        // push / poke whatever you're looking at
        const hit = p.aim(reach);
        if (hit && hit.thing && hit.thing.type === 'dynamic') {
          const k = 70 * s ** 3 * 2.5;
          hit.thing.body.applyImpulseAtPoint({ x: hit.dir.x * k, y: hit.dir.y * k, z: hit.dir.z * k }, hit.point, true);
          sfx.thud(0.15, 2);
        }
      }
    } else if (id === 'shrinker') {
      if (input.scroll) { this.mode = -this.mode; sfx.beep(this.mode < 0 ? 1300 : 800, 0.05, 0.15); this.select(this.sel); }
      if (input.pressed('alt')) { this.mode = -this.mode; this.select(this.sel); }
      if (!this.chargeSnd) this.chargeSnd = loop('charge');
      if (input.held('fire')) {
        this.charge = Math.min(1, this.charge + dt / 1.4);
        this.chargeSnd.set(0.05 + this.charge * 0.06, 1 + this.charge * 2);
      } else {
        this.chargeSnd.set(0);
        if (this.charge > 0.05) this.fireShrinker(this.charge);
        this.charge = 0;
      }
      g.ui.setCharge(this.charge, this.mode);
      const m = this.models[1];
      if (m.userData.glow) { m.userData.glow.material.color.set(this.mode < 0 ? 0x8ff6ff : 0xffc46b); m.userData.glow.material.emissive.set(this.mode < 0 ? 0x8ff6ff : 0xffc46b); m.userData.glow.scale.setScalar(1 + this.charge * 1.5); }
    } else if (id === 'glue' || id === 'tape') {
      if (input.pressed('fire')) this.stick(id, reach);
      if (input.pressed('undo')) this.undoJoint();
    } else if (id === 'cutter') {
      if (input.pressed('fire')) this.cut(reach);
    }
    if (id !== 'shrinker') g.ui.setCharge(0, 0);
  }

  // ---------------- hands ----------------
  strength() { return 30 * this.game.player.s ** 3; } // kg you can lift at your size (a normal person: ~30 kg)
  tryGrab(reach) {
    const g = this.game, hit = g.player.aim(reach);
    if (!hit || !hit.thing) return;
    const t = hit.thing;
    if (t.type !== 'dynamic') { if (t.name !== 'room') g.ui.toast(`🧱 ${t.name} is fixed in place. Shrink it first to move it.`); return; }
    const m = t.mass;
    if (m > this.strength()) { g.ui.toast(`🏋️ Too heavy: ${fmtMass(m)}. At your size you can lift about ${fmtMass(this.strength())}.`); return; }
    this.held = t;
    t.body.wakeUp();
    t.body.setAngularDamping(4);
    const bb = new THREE.Box3().setFromObject(t.group);
    this.holdDist = Math.max(0.35 * g.player.s, bb.getSize(_v).length() * 0.6 + 0.25 * g.player.s);
    sfx.click(0.25);
  }
  updateHeld(dt) {
    const g = this.game, t = this.held, p = g.player;
    if (!t.body || !things.has(t)) { this.held = null; return; }
    const cam = g.engine.camera;
    const fwd = _v.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const target = _w.copy(cam.position).addScaledVector(fwd, this.holdDist);
    const pos = t.position(new THREE.Vector3());
    const d = target.sub(pos);
    if (d.length() > this.holdDist * 3 + 0.5 * p.s) { this.drop(); return; } // got stuck behind something
    const v = d.multiplyScalar(Math.min(1 / dt, 12));
    const max = 15 * p.s + 0.5; if (v.length() > max) v.setLength(max);
    t.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    t.body.setGravityScale(0, true);
  }
  drop() {
    const t = this.held; this.held = null;
    if (t && t.body) { t.body.setGravityScale(1, true); t.body.setAngularDamping(0.15); }
  }
  throwHeld() {
    const t = this.held, g = this.game; this.drop();
    if (!t || !t.body) return;
    const fwd = _v.set(0, 0, -1).applyQuaternion(g.engine.camera.quaternion);
    const speed = 9 * g.player.s * Math.min(1, Math.sqrt(this.strength() / Math.max(t.mass, 1e-9)) * 0.5);
    t.body.setLinvel({ x: fwd.x * speed, y: fwd.y * speed + 1.5 * g.player.s, z: fwd.z * speed }, true);
    sfx.whoosh(false, 0.15, 0.3);
  }

  // ---------------- shrinker ----------------
  fireShrinker(charge) {
    const g = this.game, p = g.player, s = p.s;
    const hit = p.aim(80 * s);
    const cam = g.engine.camera;
    const from = cam.position.clone().add(new THREE.Vector3(0.12, -0.12, -0.3).multiplyScalar(s).applyQuaternion(cam.quaternion));
    const to = hit ? hit.point : cam.position.clone().add(new THREE.Vector3(0, 0, -30 * s).applyQuaternion(cam.quaternion));
    this.beam(from, to, this.mode);
    sfx.zap(0.35); sfx.whoosh(this.mode > 0, 0.25, 0.4);
    if (!hit || !hit.thing) return;
    const t = hit.thing;
    if (t.name === 'room' || t.tags.has('noShrink')) { g.ui.toast('🧱 The shrinker can\'t shrink the house itself.'); return; }
    const f = this.mode < 0 ? 1 / (1 + 3 * charge) : 1 + 3 * charge;
    let target = Math.max(1e-3, Math.min(t.scale * f, 50));
    if (this.mode > 0) target = this.limitGrowth(t, target);
    if (target === t.scale) return;
    if (t.type === 'fixed' || t.type === 'kinematic') this.makeDynamic(t);
    this.breakJoints(t);
    this.anims.push({ t, from: t.scale, to: target, k: 0 });
  }
  limitGrowth(t, target) {
    // can't grow taller than the room (or wider than it)
    const bb = new THREE.Box3().setFromObject(t.group), size = bb.getSize(_v).divideScalar(t.scale);
    const maxK = Math.min(2.4 / Math.max(size.y, 1e-6), 3.8 / Math.max(size.x, size.z, 1e-6));
    if (target > maxK) { this.game.ui.toast('📏 That would be too big for the room!'); return Math.max(t.scale, maxK); }
    return target;
  }
  makeDynamic(t) {
    t.type = 'dynamic';
    t.body.setBodyType(R.RigidBodyType.Dynamic, true);
    t._buildColliders();
    // fixed furniture: its pieces should weigh like wood
    if (t.density === 600) t.density = 650;
  }
  updateAnims(dt) {
    for (const a of this.anims) {
      a.k = Math.min(1, a.k + dt / 0.6);
      const e = a.k * a.k * (3 - 2 * a.k);
      if (a.t.body) a.t.setScale(a.from * Math.pow(a.to / a.from, e));
      for (const m of a.t.group.children) if (m.material && m.material.emissive) { /* subtle flash */ }
    }
    this.anims = this.anims.filter((a) => a.k < 1);
  }
  beam(from, to, mode) {
    const g = this.game;
    const len = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(0.004 * g.player.s, 0.004 * g.player.s, len, 6, 1, true);
    geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: mode < 0 ? 0x8ff6ff : 0xffc46b, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(geo, mat); m.position.copy(from); m.lookAt(to); m.frustumCulled = false;
    const light = new THREE.PointLight(mode < 0 ? 0x8ff6ff : 0xffc46b, 2 * g.player.s ** 1.5, 0.6 * g.player.s, 1.5); light.position.copy(to);
    g.engine.scene.add(m, light);
    this.beams.push({ m, light, life: 0.3 });
  }
  updateBeams(dt) {
    for (const b of this.beams) {
      b.life -= dt; b.m.material.opacity = Math.max(0, b.life / 0.3); b.light.intensity *= 0.85;
      if (b.life <= 0) { this.game.engine.scene.remove(b.m, b.light); b.m.geometry.dispose(); }
    }
    this.beams = this.beams.filter((b) => b.life > 0);
  }

  // ---------------- glue gun + duct tape ----------------
  stick(kind, reach) {
    const g = this.game, hit = g.player.aim(reach);
    if (!hit || !hit.thing) return;
    const t = hit.thing;
    if (!this.pending) {
      this.pending = { t, point: hit.point.clone(), normal: hit.normal.clone() };
      g.ui.toast(kind === 'glue' ? '🧴 Glue on! Now click the thing to stick it to.' : '🩹 Tape on one side. Click the other thing.', 2.5);
      sfx.tick(0.25, 0.6);
      return;
    }
    const first = this.pending; this.pending = null;
    const a = first.t;
    if (a === t) { g.ui.toast('Pick two different things.', 2); return; }
    if (!a.body || !t.body) return;
    const pa = first.point;
    // joint anchors: the contact point, expressed in each body's local frame
    const toLocal = (th, wp) => { const tr = th.body.translation(), rr = th.body.rotation(); _q.set(rr.x, rr.y, rr.z, rr.w).invert(); return wp.clone().sub(_v.set(tr.x, tr.y, tr.z)).applyQuaternion(_q); };
    const la = toLocal(a, pa), lb = toLocal(t, pa);
    const ra = a.body.rotation(), rb = t.body.rotation();
    const qa = new THREE.Quaternion(ra.x, ra.y, ra.z, ra.w), qb = new THREE.Quaternion(rb.x, rb.y, rb.z, rb.w);
    const frameB = qb.clone().invert().multiply(qa); // keeps the current relative rotation
    const jd = R.JointData.fixed({ x: la.x, y: la.y, z: la.z }, { x: 0, y: 0, z: 0, w: 1 }, { x: lb.x, y: lb.y, z: lb.z }, { x: frameB.x, y: frameB.y, z: frameB.z, w: frameB.w });
    const joint = world.createImpulseJoint(jd, a.body, t.body, true);
    // the visible glue blob / tape strip
    const s = g.player.s;
    const mark = kind === 'glue'
      ? new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), defMat('hotglue', () => new THREE.MeshPhysicalMaterial({ color: 0xf6f2e0, roughness: 0.2, transmission: 0.5, transparent: true, opacity: 0.85 })))
      : new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.0006, 0.08), defMat('ducttape', () => new THREE.MeshStandardMaterial({ color: 0x8d9298, roughness: 0.6, metalness: 0.2 })));
    const markParent = a.type === 'dynamic' ? a.group : t.group;
    const lp = markParent.worldToLocal(pa.clone());
    mark.position.copy(lp); mark.scale.setScalar(Math.max(0.15, Math.min(4, s * 2)) / markParent.scale.x);
    if (kind === 'tape') mark.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), first.normal.clone().applyQuaternion(markParent.getWorldQuaternion(new THREE.Quaternion()).invert()));
    markParent.add(mark);
    this.joints.push({ a, b: t, joint, kind, mark, parent: markParent });
    a.body.wakeUp(); t.body.wakeUp();
    sfx.tick(0.35, kind === 'glue' ? 0.5 : 1.2);
    g.ui.toast(kind === 'glue' ? `🧴 Glued ${a.name} to ${t.name}` : `🩹 Taped ${a.name} to ${t.name}`, 2);
  }
  breakJoints(t) {
    for (const j of this.joints.filter((j) => j.a === t || j.b === t)) this.removeJoint(j);
  }
  removeJoint(j) {
    try { world.removeImpulseJoint(j.joint, true); } catch { /* already gone */ }
    j.parent.remove(j.mark);
    this.joints = this.joints.filter((x) => x !== j);
  }
  undoJoint() { const j = this.joints[this.joints.length - 1]; if (j) { this.removeJoint(j); this.game.ui.toast('↩️ Unstuck', 1.5); } }

  // ---------------- cutter (objects only) ----------------
  cut(reach) {
    const g = this.game, hit = g.player.aim(reach);
    if (!hit || !hit.thing) return;
    const t = hit.thing;
    if (t.tags.has('alive')) { g.ui.toast('✂️ The cutter is for objects only.'); return; }
    // food gets cut in half
    if (t.spawnId && t.spawnId in CUT_INTO && CUT_INTO[t.spawnId]) {
      const pos = t.position(new THREE.Vector3()), into = CUT_INTO[t.spawnId], k = t.scale;
      t.remove(g.engine.scene);
      for (const side of [-1, 1]) {
        const half = buildItem(g, into, [pos.x + side * 0.01 * k, pos.y + 0.005 * k, pos.z], side > 0 ? Math.PI : 0);
        half.spawned = true; if (k !== 1) half.setScale(k);
      }
      sfx.tick(0.4, 0.8); sfx.tick(0.3, 0.6);
      g.ui.toast(`✂️ Cut the ${t.name} in half`, 2);
      return;
    }
    const keys = [...new Set(t.parts.filter((p) => p.cut).map((p) => p.cut))];
    if (!keys.length) { g.ui.toast(`✂️ Can't cut ${t.name} open (yet)`, 2); return; }
    const piece = t.detach(keys[0], g.engine.scene);
    if (piece) {
      piece.body.applyImpulse({ x: hit.normal.x * piece.mass * 0.3, y: piece.mass * 0.4, z: hit.normal.z * piece.mass * 0.3 }, true);
      sfx.tick(0.4, 0.7); setTimeout(() => sfx.tick(0.35, 0.9), 90); setTimeout(() => sfx.thud(0.2, 2.5), 400);
      g.ui.toast(`✂️ Cut the ${keys[0]} off the ${t.name}`, 2.5);
    }
  }
}

export function fmtMass(kg) {
  if (kg >= 1) return kg.toFixed(1) + ' kg';
  if (kg >= 0.001) return (kg * 1000).toFixed(kg < 0.01 ? 1 : 0) + ' g';
  if (kg >= 1e-6) return (kg * 1e6).toFixed(0) + ' mg';
  return (kg * 1e9).toFixed(0) + ' µg';
}
