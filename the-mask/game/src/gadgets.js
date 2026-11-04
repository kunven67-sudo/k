// THE MASK - gadgets. Six clockmaker-made guns (brass, glass, teal), built in code to match the mask:
// Blaster (shoots people), Black Hole Gun, Time Stopper (freeze), Size Ray, Float Ray, Copy Ray (clones).
// Lying around they are props (grab, throw); held, the trigger fires. Your copies fire them again every loop.
import * as THREE from 'three';
import { G, rand, clamp, emit, unlock } from './game.js';
import { world, CANNON, GROUP, raycast } from './physics.js';
import { toon, PAL, glowSprite } from './toon.js';
import { Prop, props } from './props.js';
import { audio } from './audio.js';
import { fx } from './fx.js';

export const GADGETS = [
  { id: 'blaster', name: 'Blaster', color: 0xffb347, cool: 0.16 },
  { id: 'blackhole', name: 'Black Hole Gun', color: 0x9b6bff, cool: 1.2 },
  { id: 'freeze', name: 'Time Stopper', color: 0x9fd8ff, cool: 0.35 },
  { id: 'size', name: 'Size Ray', color: 0xff6fae, cool: 0.35 },
  { id: 'float', name: 'Float Ray', color: 0x8fffc8, cool: 0.35 },
  { id: 'clone', name: 'Copy Ray', color: 0xe2a63b, cool: 0.5 }
];
const byId = Object.fromEntries(GADGETS.map((g) => [g.id, g]));

/* ---------- models (grip at the origin, barrel along -Z, muzzle in userData.muzzle) ---------- */
function lathe(points, mat, seg = 16) { const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg); g.rotateX(-Math.PI / 2); return new THREE.Mesh(g, mat); }
function cyl(r1, r2, len, mat, seg = 12) { const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.rotateX(Math.PI / 2); return new THREE.Mesh(g, mat); }
function rbox(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }
function glowMat(color) { return new THREE.MeshBasicMaterial({ color, fog: false }); }
function gear(r, teeth, th, mat) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 2; i++) { const a = i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r * 0.82 : r; const a2 = a + Math.PI / (teeth * 2); i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); s.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr); }
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.3, 0, Math.PI * 2, true); s.holes.push(hole);
  return new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false }), mat);
}
function handle(mat, wood) {
  const g = new THREE.Group();
  const h = rbox(0.032, 0.105, 0.042, wood); h.position.set(0, -0.05, 0.012); h.rotation.x = 0.28; g.add(h);
  const cap = rbox(0.036, 0.014, 0.046, mat); cap.position.set(0, -0.103, 0.028); cap.rotation.x = 0.28; g.add(cap);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 5, 12, Math.PI), mat); guard.rotation.y = Math.PI / 2; guard.rotation.z = Math.PI; guard.position.set(0, -0.012, -0.03); g.add(guard);
  const trig = rbox(0.006, 0.022, 0.008, mat); trig.position.set(0, -0.016, -0.026); trig.rotation.x = -0.3; g.add(trig);
  return g;
}
export const GADGET_IDS = GADGETS.map((g) => g.id);
export function buildModel(id) {
  const brass = toon({ color: PAL.brass }), brassD = toon({ color: PAL.brassDark }), wood = toon({ color: 0x5a2f22 }), ink = toon({ color: 0x2a1d1a });
  const teal = toon({ color: PAL.teal }), cream = toon({ color: PAL.cream });
  const def = byId[id], glow = glowMat(def.color);
  const g = new THREE.Group(); g.name = 'gadget-' + id;
  g.add(handle(brass, wood));
  let muzzle = new THREE.Vector3(0, 0.03, -0.25);
  if (id === 'blaster') {
    const body = rbox(0.034, 0.05, 0.08, brassD); body.position.set(0, 0.025, -0.03); g.add(body);
    const drum = cyl(0.03, 0.03, 0.05, brass, 10); drum.position.set(0, 0.03, -0.06); g.add(drum);
    for (let i = 0; i < 6; i++) { const f = cyl(0.006, 0.006, 0.052, ink, 6); const a = i / 6 * Math.PI * 2; f.position.set(Math.cos(a) * 0.022, 0.03 + Math.sin(a) * 0.022, -0.06); g.add(f); }
    const barrel = cyl(0.012, 0.014, 0.16, brass); barrel.position.set(0, 0.04, -0.16); g.add(barrel);
    const tip = lathe([[0.011, 0], [0.02, 0.01], [0.02, 0.025], [0.012, 0.03]], brassD); tip.position.set(0, 0.04, -0.235); g.add(tip);
    const line = rbox(0.004, 0.006, 0.13, glow); line.position.set(0, 0.058, -0.15); g.add(line);
    const sight = rbox(0.006, 0.014, 0.01, brassD); sight.position.set(0, 0.06, -0.225); g.add(sight);
    const hammer = rbox(0.01, 0.02, 0.02, ink); hammer.position.set(0, 0.058, 0.012); hammer.rotation.x = -0.4; g.add(hammer);
    muzzle = new THREE.Vector3(0, 0.04, -0.27);
  } else if (id === 'blackhole') {
    const back = cyl(0.04, 0.045, 0.06, brassD, 14); back.position.set(0, 0.04, 0.0); g.add(back);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.048, 18, 12), new THREE.MeshBasicMaterial({ color: 0x8e7cff, transparent: true, opacity: 0.28, depthWrite: false })); glass.position.set(0, 0.045, -0.07); g.add(glass);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: 0x050308 })); core.position.copy(glass.position); g.add(core);
    const halo = glowSprite(def.color, 0.09, 0.8); halo.position.copy(glass.position); g.add(halo);
    for (const z of [-0.025, -0.115]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.006, 6, 20), brass); r.position.set(0, 0.045, z); g.add(r); }
    const horn = lathe([[0.024, 0], [0.03, 0.04], [0.05, 0.085], [0.07, 0.11], [0.066, 0.115], [0.044, 0.09]], brass, 18); horn.position.set(0, 0.045, -0.12); g.add(horn);
    const gg = gear(0.03, 9, 0.008, brassD); gg.position.set(0.042, 0.06, -0.01); gg.rotation.y = Math.PI / 2; gg.userData.spin = true; g.add(gg);
    g.userData.core = core;
    muzzle = new THREE.Vector3(0, 0.045, -0.24);
  } else if (id === 'freeze') {
    const body = cyl(0.026, 0.03, 0.12, cream, 12); body.position.set(0, 0.035, -0.05); g.add(body);
    const watch = cyl(0.045, 0.045, 0.016, brass, 20); watch.rotation.set(0, Math.PI / 2, 0); watch.rotateX(Math.PI / 2); watch.position.set(0.03, 0.05, -0.05); g.add(watch);
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), cream); dial.position.set(0.039, 0.05, -0.05); dial.rotation.y = Math.PI / 2; g.add(dial);
    for (let i = 0; i < 12; i++) { const t = rbox(0.002, i % 3 ? 0.005 : 0.009, 0.002, ink); const a = i / 12 * Math.PI * 2; t.position.set(0.04, 0.05 + Math.cos(a) * 0.03, -0.05 + Math.sin(a) * 0.03); t.rotation.x = -a; g.add(t); }
    const hand = rbox(0.002, 0.028, 0.003, glow); hand.position.set(0.041, 0.06, -0.05); g.add(hand); g.userData.hand = hand;
    const crown = cyl(0.008, 0.008, 0.012, brass, 8); crown.rotation.x = 0; crown.position.set(0.03, 0.1, -0.05); crown.rotation.set(0, 0, 0); g.add(crown);
    const barrel = cyl(0.012, 0.016, 0.12, brass); barrel.position.set(0, 0.035, -0.17); g.add(barrel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.014, 14), glow); lens.position.set(0, 0.035, -0.231); lens.rotation.y = Math.PI; g.add(lens);
    muzzle = new THREE.Vector3(0, 0.035, -0.24);
  } else if (id === 'size') {
    const tube = lathe([[0.022, 0], [0.022, 0.06], [0.03, 0.06], [0.03, 0.12], [0.038, 0.12], [0.038, 0.2], [0.03, 0.205]], brass, 16); tube.position.set(0, 0.04, 0.02); g.add(tube);
    for (const z of [-0.04, -0.1, -0.16]) { const r = new THREE.Mesh(new THREE.TorusGeometry(z < -0.12 ? 0.039 : z < -0.06 ? 0.031 : 0.023, 0.004, 5, 18), brassD); r.position.set(0, 0.04, z); g.add(r); }
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.034, 18), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.85 })); lens.position.set(0, 0.04, -0.186); lens.rotation.y = Math.PI; g.add(lens);
    const knob = cyl(0.01, 0.01, 0.02, teal, 8); knob.rotation.set(0, 0, Math.PI / 2); knob.position.set(0.03, 0.04, -0.02); g.add(knob);
    muzzle = new THREE.Vector3(0, 0.04, -0.2);
  } else if (id === 'float') {
    const body = cyl(0.028, 0.024, 0.15, teal, 12); body.position.set(0, 0.035, -0.07); g.add(body);
    for (const z of [-0.01, -0.13]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 5, 16), brass); r.position.set(0, 0.035, z); g.add(r); }
    const mast = cyl(0.004, 0.004, 0.05, brass, 6); mast.rotation.x = 0; mast.rotation.set(Math.PI / 2, 0, 0); mast.position.set(0, 0.085, -0.06); g.add(mast);
    const prop = new THREE.Group(); prop.position.set(0, 0.11, -0.06); prop.userData.spin = true;
    for (let i = 0; i < 3; i++) { const b = rbox(0.07, 0.003, 0.016, cream); b.position.x = 0.035; const p = new THREE.Group(); p.rotation.y = i / 3 * Math.PI * 2; b.rotation.x = 0.35; p.add(b); prop.add(p); }
    g.add(prop);
    const tip = lathe([[0.02, 0], [0.026, 0.02], [0.014, 0.04]], brass); tip.position.set(0, 0.035, -0.145); g.add(tip);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), glow); orb.position.set(0, 0.035, -0.19); g.add(orb);
    muzzle = new THREE.Vector3(0, 0.035, -0.2);
  } else if (id === 'clone') {
    const body = rbox(0.06, 0.05, 0.11, brassD); body.position.set(0, 0.035, -0.06); g.add(body);
    for (const x of [-0.016, 0.016]) {
      const b = cyl(0.012, 0.012, 0.12, brass, 10); b.position.set(x, 0.04, -0.16); g.add(b);
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.01, 12), glow); l.position.set(x, 0.04, -0.221); l.rotation.y = Math.PI; g.add(l);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 12, 1, true), new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.5, side: THREE.DoubleSide })); top.rotation.x = Math.PI / 2; top.position.set(0, 0.072, -0.06); g.add(top);
    const gg = gear(0.022, 8, 0.006, brass); gg.position.set(-0.031, 0.04, -0.05); gg.rotation.y = -Math.PI / 2; gg.userData.spin = true; g.add(gg);
    muzzle = new THREE.Vector3(0, 0.04, -0.23);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData.muzzle = muzzle;
  return g;
}

/* ---------- a gadget lying in the world is a prop with a gun on it ---------- */
export class Gadget extends Prop {
  constructor(id, pos) {
    const mdl = buildModel(id);
    super({ id: 'gadget:' + id, mass: 0.9 }, mdl, { pos });
    this.kind = 'gadget'; this.gid = id; this.gdef = byId[id]; this.cool = 0; this.flags = mdl;
  }
  muzzleWorld(out = new THREE.Vector3()) { return this.model.localToWorld(out.copy(this.model.userData.muzzle)); }
  aimDir(out = new THREE.Vector3()) { return out.set(0, 0, -1).applyQuaternion(this.obj.getWorldQuaternion(new THREE.Quaternion())); }
  update(dt) {
    super.update(dt); this.cool = Math.max(0, this.cool - dt);
    this.model.traverse((o) => { if (o.userData.spin) o.rotation.z += dt * (this.held ? 9 : 1.5); });
  }
}

export const gadgets = {
  list: [], holes: [], orbs: [],
  spawn(id, pos) { const g = new Gadget(id, pos); this.list.push(g); props.list.push(g); return g; },
  // pull the trigger. who = 'you' or the copy that's firing it
  fire(id, origin, dir, who = 'you', gad = null) {
    if (gad) { if (gad.cool > 0) return false; gad.cool = byId[id].cool; }
    const def = byId[id];
    if (id === 'blaster') this.blast(origin, dir, who);
    else if (id === 'blackhole') this.shootOrb(origin, dir);
    else this.ray(id, origin, dir, def.color, who);
    if (who === 'you') emit('fired', id, origin.clone(), dir.clone());
    return true;
  },
  blast(origin, dir, who) {
    audio.play('zap', origin, 0.8);
    fx.burst(origin, 0xffd27a, 6, 1.2, { life: 0.12, sz: 0.04 });
    const h = hitTest(origin, dir, 40, who);
    const end = h ? h.point : origin.clone().addScaledVector(dir, 40);
    fx.tracer(origin, end, 0xffd27a, 0.1);
    if (!h) return;
    if (h.ent && h.ent.kind === 'person') {
      audio.play('hit', h.point, 1);
      h.ent.hurt(h.head ? 120 : 34, dir, h.point, 'shot', who);
      if (h.ent.state === 'tumble') h.ent.push(dir, 60);
      emit('personShot', h.ent, who);
    } else if (h.ent && h.ent.kind === 'copy') {
      h.ent.shot(dir, h.point);
    } else {
      fx.sparks(h.point, 10); audio.play(Math.random() < 0.3 ? 'ping' : 'tap', h.point, 0.6);
      if (h.ent && h.ent.impulse) h.ent.impulse(dir, 5, h.point);
    }
  },
  ray(id, origin, dir, color, who) {
    const h = hitTest(origin, dir, 25, who);
    this.lastHit = h && { kind: h.ent && h.ent.kind, id: h.ent && (h.ent.type || (h.ent.def && h.ent.def.id)), d: h.dist, o: origin.toArray(), dir: dir.toArray() };
    const end = h ? h.point : origin.clone().addScaledVector(dir, 25);
    fx.beam(origin, end, color, 0.01, 0.2);
    if (!h || !h.ent) { audio.play('tap', end, 0.3); return; }
    const e = h.ent;
    if (id === 'freeze') {
      if (e.frozen) e.unfreeze(); else { e.freeze(8); audio.play('freeze', h.point, 0.9); fx.ring(e.pos.clone().setY(h.point.y), 0x9fd8ff, 0.8, 0.5); if (e.kind !== 'person' && e.pos.y > 0.6 && e.body && e.body.velocity.length() > 0.5) unlock('freeze'); }
    } else if (id === 'size') {
      const old = e.size, next = old === 1 ? 2 : old > 1 ? 0.4 : 1;
      e.sizedBig = e.sizedBig || next > 1; if (e.sizedBig && next < 1) unlock('size');
      e.setSize(next); audio.play(next > old ? 'grow' : 'shrink', h.point, 0.9);
      fx.burst(h.point, color, 18, 1.5, { life: 0.5, sz: 0.035 });
    } else if (id === 'float') {
      e.setFloat(!e.floating); audio.play(e.floating ? 'float' : 'land', h.point, 0.9);
    } else if (id === 'clone') {
      audio.play('clone', h.point, 1); fx.burst(h.point, color, 24, 2, { life: 0.6, sz: 0.04 });
      if (e.kind === 'person') { G.people.clone(e); unlock('clone'); }
      else if (e.kind === 'copy') { G.loop.cloneCopy(e); unlock('clone'); }
      else if (e.kind === 'gadget') { this.spawn(e.gid, e.pos.clone().add(new THREE.Vector3(0, 0.2, 0))); unlock('clone'); }
      else if (e.kind === 'prop' && !e.special) { props.clone(e); unlock('clone'); }
    }
  },
  /* black hole: an orb flies, then opens into a hole that eats everything near it */
  shootOrb(origin, dir) {
    if (this.holes.length + this.orbs.length >= 3) return;
    audio.play('bh_fire', origin, 0.9);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: 0x050308 }));
    m.add(glowSprite(0x9b6bff, 0.35, 0.9)); m.position.copy(origin); G.scene.add(m);
    this.orbs.push({ m, v: dir.clone().multiplyScalar(6), life: 1.1 });
  },
  openHole(p) {
    audio.play('bh_open', p, 1);
    const g = new THREE.Group(); g.position.copy(p);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    g.add(core);
    const disk = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.85, 48, 1), diskMaterial()); disk.rotation.x = -Math.PI / 2 + 0.35; g.add(disk);
    const halo = glowSprite(0x9b6bff, 1.6, 0.7); g.add(halo);
    G.scene.add(g);
    fx.ring(p, 0x9b6bff, 2.5, 0.6);
    this.holes.push({ g, disk, core, p: p.clone(), life: 6, max: 6, hum: audio.hum(p), eaten: 0 });
  },
  update(dt) {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]; o.life -= dt;
      const step = o.v.clone().multiplyScalar(dt);
      const hit = raycast(o.m.position, step.clone().normalize(), step.length() + 0.06, GROUP.ROOM | GROUP.PROP);
      if (hit) o.m.position.copy(hit.point).addScaledVector(hit.normal, 0.35); else o.m.position.add(step);
      fx.particle(o.m.position, new THREE.Vector3(), 0x9b6bff, { life: 0.3, sz: 0.05 });
      if (hit || o.life <= 0) { G.scene.remove(o.m); this.orbs.splice(i, 1); const p = o.m.position.clone(); p.y = clamp(p.y, 0.5, 2.5); this.openHole(p); }
    }
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i]; h.life -= dt;
      const k = Math.min(1, (h.max - h.life) * 3) * Math.min(1, h.life * 2);
      h.g.scale.setScalar(Math.max(0.01, k));
      h.disk.rotation.z -= dt * 3; h.disk.material.uniforms.time.value += dt;
      if (Math.random() < 0.7) { // stuff spiraling in
        const a = Math.random() * 7, r = rand(0.8, 1.6);
        const p = h.p.clone().add(new THREE.Vector3(Math.cos(a) * r, rand(-0.3, 0.3), Math.sin(a) * r));
        const v = h.p.clone().sub(p).multiplyScalar(1.6).add(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(1.4));
        fx.particle(p, v, Math.random() < 0.5 ? 0x9b6bff : 0xffc86b, { life: 0.6, sz: 0.025, drag: 0 });
      }
      // eat what came too close
      for (const e of [...G.entities]) {
        if (e.eating || e.held || e.special === 'mask') continue;
        const c = e.kind === 'person' ? e.center() : e.pos;
        if (c.distanceTo(h.p) < 0.32 + 0.25 * Math.min(2, e.size || 1)) eat(e, h);
      }
      for (const c of G.loop ? G.loop.copies : []) if (!c.gone && c.facePos.distanceTo(h.p) < 0.5) c.shatter(true);
      if (h.life <= 0) { // collapse: everything left gets thrown out
        h.hum.stop(); audio.play('bh_end', h.p, 1); fx.ring(h.p, 0xffffff, 3, 0.5); fx.burst(h.p, 0x9b6bff, 50, 6, { life: 0.8, sz: 0.04 });
        for (const e of G.entities) {
          const c = e.kind === 'person' ? e.center() : e.pos, d = c.distanceTo(h.p);
          if (d > 4 || e.held || e.frozen) continue;
          const dir = c.clone().sub(h.p).normalize(); dir.y = Math.abs(dir.y) + 0.4;
          if (e.kind === 'person') e.push(dir, 120 * (1 - d / 4) * Math.pow(e.size, 3));
          else if (e.impulse) e.impulse(dir, e.body.mass * 6 * (1 - d / 4));
        }
        G.scene.remove(h.g); this.holes.splice(i, 1);
      }
    }
    for (const e of [...G.entities]) if (e.eating) {
      e.eating -= dt; const k = Math.max(0, e.eating / 0.35);
      const o = e.kind === 'person' ? e.root : e.obj;
      o.scale.setScalar(Math.max(0.001, (e.size || 1) * k));
      if (e.eatTo) o.position.lerp(e.eatTo, 1 - Math.exp(-12 * dt));
      if (e.eating <= 0) { e.eating = 0; o.scale.setScalar(e.size || 1); e.detach(); }
    }
    this.pullPeople();
  },
  // forces every physics step: black holes pull, floating things hover
  preStep() {
    for (const e of G.entities) {
      const b = e.body; if (!b || b.type !== CANNON.Body.DYNAMIC || e.eating) continue;
      if (e.floating) {
        const target = 1.5 + (e.uid % 5) * 0.15;
        b.force.y += b.mass * (9.82 + (target - b.position.y) * 4 - b.velocity.y * 2.2);
        b.torque.x += b.mass * 0.02 * Math.sin(G.t + e.uid); b.torque.y += b.mass * 0.02;
      }
      for (const h of this.holes) {
        const dx = h.p.x - b.position.x, dy = h.p.y - b.position.y, dz = h.p.z - b.position.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 4.5 || d < 1e-3) continue;
        const s = 26 * Math.min(1, (h.max - h.life) * 2) / Math.max(d, 0.5);
        b.force.x += b.mass * (dx / d * s - dz / d * 3); b.force.y += b.mass * (dy / d * s + 9.82 * 0.7); b.force.z += b.mass * (dz / d * s + dx / d * 3);
      }
    }
  },
  pullPeople() { // people standing near a hole get lifted off their feet
    for (const h of this.holes) for (const p of G.people.list) {
      if (p.removed || p.state === 'tumble' || p.frozen || p.held || p.eating) continue;
      if (p.center().distanceTo(h.p) < 3.2) p.tumble(h.p.clone().sub(p.center()).normalize().multiplyScalar(2));
    }
  },
  clear() { for (const g of this.list.slice()) if (!g.held) { g.detach(); } this.list = this.list.filter((g) => g.held); props.list = props.list.filter((p) => p.kind !== 'gadget' || p.held); }
};
world.addEventListener('preStep', () => gadgets.preStep());

function eat(e, h) {
  e.eating = 0.35; e.eatTo = h.p.clone(); h.eaten++;
  if (e.body) { e.body.type = CANNON.Body.KINEMATIC; e.body.velocity.setZero(); }
  audio.play('bh_eat', h.p, 0.7); unlock('blackhole');
  emit('eaten', e);
}

function diskMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vP; void main(){ vUv = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform float time;
      void main(){ float r = length(vP.xy); float a = atan(vP.y, vP.x);
        float t = clamp((r - 0.24) / 0.61, 0.0, 1.0);
        float swirl = 0.55 + 0.45 * sin(a * 3.0 + r * 14.0 - time * 6.0);
        vec3 hot = mix(vec3(1.0, 0.85, 0.55), vec3(0.6, 0.35, 1.0), t);
        float k = (1.0 - t) * (1.0 - t) * swirl;
        gl_FragColor = vec4(hot * k * 1.4, k); }`
  });
}

/* ---------- what does a shot hit? people + copies by their hit spheres, everything else by physics ---------- */
const _oc = new THREE.Vector3();
function raySphere(o, d, c, r) {
  _oc.subVectors(o, c); const b = _oc.dot(d), cc = _oc.lengthSq() - r * r, disc = b * b - cc;
  if (disc < 0) return -1; const t = -b - Math.sqrt(disc); return t > 0 ? t : -1;
}
export function hitTest(origin, dir, len, who = 'you') {
  let best = null;
  const ph = raycast(origin, dir, len, GROUP.ROOM | GROUP.PROP);
  if (ph) best = { ent: ph.body.ent || null, point: ph.point, normal: ph.normal, dist: ph.dist };
  for (const p of G.people.list) {
    if (p.removed || p.eating) continue;
    if (p.pos.distanceTo(origin) > len + 3) continue;
    for (const s of p.spheres()) {
      const t = raySphere(origin, dir, s.c, s.r);
      if (t > 0 && (!best || t < best.dist)) best = { ent: p, point: origin.clone().addScaledVector(dir, t), normal: null, dist: t, head: s.head };
    }
  }
  for (const c of G.loop ? G.loop.copies : []) {
    if (c.gone || c === who) continue;
    const t = raySphere(origin, dir, c.facePos, 0.4);
    if (t > 0 && (!best || t < best.dist)) best = { ent: c, point: origin.clone().addScaledVector(dir, t), dist: t };
    const t2 = raySphere(origin, dir, c.bodyPos, 0.32);
    if (t2 > 0 && (!best || t2 < best.dist)) best = { ent: c, point: origin.clone().addScaledVector(dir, t2), dist: t2 };
  }
  return best;
}
