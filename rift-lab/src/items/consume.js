// Eating + drinking, mouse only (like everything else):
//   click food            -> you pick it up into your hand (click a multipack -> you take ONE out)
//   click (holding it)    -> open it the real way first (twist the cap, crack the tab, tear the bag,
//                            peel the banana), then every click is a bite or a sip
//   right-click tap       -> set it down where you're looking; hold right-click -> wind up a throw
// Bites leave real bite marks (you turn the apple between bites), drinks drain, finishing leaves the
// core / peel / empty bottle (or nothing). Food warms or chills toward where it sits (a powered fridge
// is ~3.5 °C, its freezer drawer -18 °C) and spoils at the real rate for that temperature. Raw chicken
// and spoiled food can give you food poisoning a few hours later.

import * as THREE from 'three';
import { input } from '../core/input.js';
import { getItem, buildSpec } from './catalog.js';
import { specBounds } from './builder.js';

const REACH = 2.3;
const MAX_ONE_HAND_KG = 6;
const FRIDGE = { W: 0.91, H: 1.78, D: 0.74 };
const OPEN_WORDS = {
  cap: 'You twist the cap off.', tab: 'Pssht. You crack it open.', tear: 'You tear it open.', peel: 'You peel it open.',
  lid: 'You pop the lid open.', wrapper: 'You rip the wrapper open.', carton: 'You open the spout.', twist: 'You undo the twist tie.',
};

// how long it keeps (days) at a temperature: frozen / fridge / room anchors, exponential in between
export function shelfDays(food, tempC, opened) {
  const sh = food.shelf || {};
  const room = sh.room || 1, fridge = sh.fridge || room, freezer = sh.freezer || fridge * 6;
  let d;
  if (tempC <= -8) d = freezer;
  else if (tempC <= 0) d = fridge + (freezer - fridge) * (-tempC / 8);
  else d = fridge * Math.pow(room / fridge, (tempC - 4) / 17); // 4 °C fridge .. 21 °C room, extrapolates beyond
  if (opened && sh.opened > 0) {
    const keepT = food.keep === 'freezer' ? -18 : food.keep === 'fridge' ? 4 : 21;
    const atKeep = keepT <= -8 ? freezer : fridge * Math.pow(room / fridge, (keepT - 4) / 17);
    d = Math.min(d, sh.opened * (d / atKeep));
  }
  return Math.max(0.01, d);
}

export class Consume {
  constructor({ items, camera, physics, player, hands, needs, clock, audio, scene, weather, onMessage, onTip }) {
    Object.assign(this, { items, camera, physics, player, hands, needs, clock, audio, scene });
    this.R = physics.RAPIER;
    this.weather = weather || (() => 18);
    this.onMessage = onMessage || (() => {});
    this.onTip = onTip || (() => {});
    this.held = null;
    this.tickT = 0;
    this.confirm = null;
    hands.busy = () => !!this.held;
    items.onBuilt = (it) => this.applyVisuals(it);
    this._v = new THREE.Vector3();
  }

  isFood(it) { return !!it?.def?.food; }

  // ---------- taking ----------
  take(item, part) {
    const f = item.def.food;
    item.state ||= {};
    if (f.units) {
      const taken = item.state.taken || 0;
      if (taken >= f.units) { this.onMessage(`The ${item.def.name.split(',')[0]} is empty.`); return; }
      const unitDef = getItem(f.unitId);
      if (!unitDef) return;
      // where that unit sits in the pack, in the world
      const idx = f.units - taken - 1;
      const spec = buildSpec(item.def, item.chosen);
      const unitParts = spec.parts.filter((p) => p.unit === idx);
      const b = specBounds({ parts: unitParts });
      const local = new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2);
      const t = item.bodies.main.translation(), r = item.bodies.main.rotation();
      const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
      const pos = local.applyQuaternion(q).add(new THREE.Vector3(t.x, t.y, t.z));
      item.state.taken = taken + 1;
      item.state.unitMass = unitDef.mass;
      const pack = this.rebuild(item);
      const unit = this.items.spawn(f.unitId, {}, { position: pos, quaternion: q }, { state: { tempC: pack.state.tempC, spoil: pack.state.spoil } });
      this.sound('take');
      this.hold(unit);
      return;
    }
    const ps = this.player.size || 1;
    if (item.mass > MAX_ONE_HAND_KG * ps * ps) { this.onMessage(ps < 0.8 ? `At your size that ${item.def.name.split(',')[0].toLowerCase()} is way too heavy to hold. Hold left-click to drag it.` : `That's ${Math.round(item.mass)} kg: too heavy to hold in one hand. Hold left-click to drag it.`); return; }
    this.sound('take');
    this.hold(item);
  }

  hold(item) {
    const R = this.R;
    for (const b of Object.values(item.bodies)) { b.setBodyType(R.RigidBodyType.KinematicPositionBased, true); b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
    for (const c of item.colliders) c.setEnabled(false);
    const b = specBounds(item.spec);
    const size = new THREE.Vector3(); b.getSize(size);
    const center = new THREE.Vector3(); b.getCenter(center);
    const prev = this.held;
    const g = item.groups.main;
    this.held = {
      item, size, center, maxDim: Math.max(size.x, size.y, size.z), charge: 0, rDown: false, anim: null,
      // smooth pickup: start from where it was in the world
      from: prev?.item === item ? null : { pos: g.position.clone(), quat: g.quaternion.clone(), t: 0 },
    };
    this.onTip('eat', 'Holding food: <b>click</b> to open it, then click to take a bite or a sip. <b>Right-click</b> sets it down, hold right-click to throw it.', 9);
  }

  // re-create an item from its state (opened / eaten / taken out). Returns the new item.
  rebuild(item) {
    const wasHeld = this.held?.item === item;
    const saved = item.serialize();
    const b = item.bodies.main, t = b.translation(), r = b.rotation();
    this.items.remove(item);
    const nu = this.items.spawn(saved.id, saved.chosen, { position: new THREE.Vector3(t.x, t.y, t.z), quaternion: new THREE.Quaternion(r.x, r.y, r.z, r.w) }, saved);
    nu.noBreakUntil = 0;
    if (wasHeld) { const anim = this.held.anim; this.held = null; this.hold(nu); this.held.from = null; this.held.anim = anim; }
    return nu;
  }

  // ---------- per frame ----------
  update(dt) {
    this.tickT -= dt;
    if (this.tickT <= 0) { this.tick(0.5 - this.tickT); this.tickT = 0.5; }
    const h = this.held;
    if (!h) return;
    if (!this.items.items.includes(h.item)) { this.held = null; return; }
    if (h.anim) {
      h.anim.t += dt;
      if (!h.anim.done && h.anim.t >= h.anim.hit) { h.anim.done = true; h.anim.fn(); }
      if (h.anim.t >= h.anim.len) h.anim = null;
      return;
    }
    if (!input.locked || this.player.dead) return;
    if (input.mousePressed(0)) this.useHeld();
    if (input.mouse(2)) { h.charge = Math.min(1, h.charge + dt / 0.8); h.rDown = true; }
    else if (h.rDown) {
      h.rDown = false;
      if (h.charge < 0.18) this.putDown(); else this.throwHeld(h.charge);
      if (this.held) this.held.charge = 0;
    }
  }

  // after physics + item sync: draw the held thing in your hand
  lateUpdate(dt) {
    const h = this.held;
    if (!h || !this.items.items.includes(h.item)) return;
    const cam = this.camera;
    const S = this.player.size || 1;
    const m = h.maxDim / S; // how big it is compared to you
    // resting in your right hand, lower right of your view, turned a little toward you
    const handPos = new THREE.Vector3(0.15 + m * 0.25, -0.16 - m * 0.3, -0.34 - m * 0.55).multiplyScalar(S);
    const handQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, -0.35 + (h.item.state.turn || 0), 0.04));
    let pos = handPos, q = handQ;
    if (h.anim) {
      const a = h.anim, k = Math.sin(Math.min(1, a.t / a.len) * Math.PI); // 0 -> 1 -> 0
      const e = k * k * (3 - 2 * k);
      if (a.kind === 'sip') {
        // tip it back so the opening comes to your mouth
        const tipQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.75, -0.1, 0));
        q = handQ.clone().slerp(tipQ, e);
        const top = new THREE.Vector3(0, h.size.y - h.center.y, 0).applyQuaternion(tipQ);
        const mouth = new THREE.Vector3(0, -0.055, -0.07).multiplyScalar(S).sub(top);
        pos = handPos.clone().lerp(mouth, e);
      } else if (a.kind === 'bite') {
        const mouth = new THREE.Vector3(0, -0.07, -0.11 - m * 0.42).multiplyScalar(S);
        pos = handPos.clone().lerp(mouth, e);
        q = handQ.clone().slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, h.item.state.turn || 0, 0)), e);
      } else if (a.kind === 'open') {
        pos = handPos.clone().add(new THREE.Vector3(-0.06 * e, 0.05 * e, 0.04 * e).multiplyScalar(S));
        q = handQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a.spin ? e * 1.2 : 0, a.spin ? 0 : e * 0.2)));
      }
    }
    // world pose of the item's origin: hand point minus its own center
    const worldQ = cam.getWorldQuaternion(new THREE.Quaternion()).multiply(q);
    const worldPos = pos.clone().applyMatrix4(cam.matrixWorld).sub(h.center.clone().applyQuaternion(worldQ));
    if (h.from) {
      h.from.t = Math.min(1, h.from.t + dt / 0.22);
      const e = h.from.t * h.from.t * (3 - 2 * h.from.t);
      worldPos.lerpVectors(h.from.pos, worldPos, e);
      worldQ.slerpQuaternions(h.from.quat, worldQ, e);
      if (h.from.t >= 1) h.from = null;
    }
    for (const g of Object.values(h.item.groups)) { g.position.copy(worldPos); g.quaternion.copy(worldQ); }
    h.worldPos = worldPos; h.worldQ = worldQ;
  }

  // ---------- open / bite / sip ----------
  useHeld() {
    const h = this.held, it = h.item, f = it.def.food, s = it.state;
    const needs = this.needs;
    if (f.units) { this.onMessage('Set it down first, then click it to take one out.'); return; }
    if (s.finished) { this.onMessage(f.kind === 'drink' ? 'It\'s empty.' : 'Nothing left but the ' + (f.leftover === 'keep' ? 'scraps' : 'wrapper') + '. Right-click to set it down or hold right-click to toss it.'); return; }
    if (f.open === 'knife') { this.onMessage('You need a knife and a cutting board to cut into that (kitchen tools come with the Everyday tab).'); return; }
    if (f.open && !s.opened) {
      h.anim = { kind: 'open', t: 0, len: 0.5, hit: 0.25, spin: f.open === 'cap' || f.open === 'twist', fn: () => {
        s.opened = true;
        this.sound('open-' + f.open);
        this.onMessage(OPEN_WORDS[f.open] || 'Opened.');
        this.rebuild(it);
      } };
      return;
    }
    const drink = f.kind === 'drink';
    if (needs) {
      if (needs.nauseous && !drink) { this.onMessage('You feel way too sick to eat anything.'); return; }
      if (!drink && needs.stuffed) { this.onMessage('You\'re stuffed. Not one more bite.'); return; }
      if (drink && needs.stomachL > 2.2) { this.onMessage('Your stomach is sloshing. Give it a minute.'); return; }
    }
    // raw food: real people hesitate
    if (f.raw && !s.cooked && !(this.confirm && this.confirm.item === it && performance.now() - this.confirm.at < 4000)) {
      this.confirm = { item: it, at: performance.now() };
      this.onMessage(`That's raw. It's meant to be cooked first${f.rawRisk > 0.05 ? ' (it can make you really sick)' : ''}. Click again to eat it anyway.`);
      return;
    }
    const spoiled = (s.spoil || 0) >= 1;
    h.anim = { kind: drink ? 'sip' : 'bite', t: 0, len: drink ? 1.0 : 0.75, hit: drink ? 0.5 : 0.36, fn: () => this.bite(spoiled) };
  }

  bite(spoiled) {
    const h = this.held;
    if (!h) return;
    let it = h.item;
    const f = it.def.food, s = it.state;
    const drink = f.kind === 'drink';
    this.sound(f.sound || (drink ? 'gulp' : 'chew'));
    if (spoiled && !s.spoilNoticed) {
      // you taste it and spit it out
      s.spoilNoticed = true;
      this.onMessage(drink ? 'Bleh. It\'s gone bad. 🤢 You spit it out.' : 'That tastes off... it\'s gone bad. 🤢 You spit it out.');
      if (Math.random() < 0.15) this.needs?.poison(0.35);
      return;
    }
    // a bite is the size of YOUR mouth: tiny you nibbles, giant you swallows it whole
    const ps = this.player.size || 1, rel = Math.pow(ps / (it.scale || 1), 3);
    const portion = Math.min(s.left ?? 1, rel / f.bites);
    const sc = Math.pow(it.scale || 1, 3) / Math.pow(ps, 3); // real amounts -> what it means to your body
    const n = {};
    for (const [k, v] of Object.entries(f.eat || {})) n[k] = v * portion * sc;
    const vol = (drink ? (f.eat.waterL || 0.3) : (f.netKg || 0.1) * 1.1) * portion * sc;
    this.needs?.consume(n, vol);
    s.left = Math.max(0, (s.left ?? 1) - portion);
    s.ate = (s.ate || 0) + 1;
    if (s.ate === 1) {
      const t = s.tempC ?? 20;
      const temp = drink ? (t < 7 ? ' Ice cold.' : t > 30 ? ' Warm, kind of gross.' : '') : (t < 0 ? ' Frozen solid, ow.' : '');
      this.onMessage(`${f.taste?.[Math.floor(Math.random() * f.taste.length)] || 'Not bad.'}${temp}`);
    }
    // food poisoning risk (rolled once per item)
    if (!s.riskRolled) {
      s.riskRolled = true;
      const raw = f.raw && !s.cooked ? f.rawRisk || 0 : 0;
      const bad = spoiled ? Math.min(0.8, 0.35 + ((s.spoil || 1) - 1) * 0.3) : 0;
      const risk = 1 - (1 - raw) * (1 - bad);
      if (risk > 0 && Math.random() < risk) this.needs?.poison(0.4 + Math.random() * 0.4);
    }
    // bite mark where your teeth went
    if (f.bite === 'dent') this.addBiteMark(it);
    s.turn = (s.turn || 0) + 0.75; // turn it a bit for the next bite, like you really would
    if (s.left <= 0.001) {
      s.finished = true;
      if (f.leftover === 'remove') {
        this.held = null;
        this.items.remove(it);
        this.onMessage(drink ? 'All gone.' : 'Finished it.');
        return;
      }
      this.onMessage(drink ? 'Empty.' : 'Finished it.');
    }
    if (f.bite !== 'none' || s.finished) it = this.rebuild(it);
  }

  // where the bite lands on the eat mesh: the point closest to your mouth, then a sphere of
  // tooth-sized radius is carved out (stored so it survives saving + rebuilding)
  addBiteMark(it) {
    const mouthWorld = new THREE.Vector3(0, -0.07, -0.05).applyMatrix4(this.camera.matrixWorld);
    let best = null;
    for (const g of Object.values(it.groups)) g.traverse((o) => {
      if (!o.isMesh || !o.userData.part?.eat) return;
      o.updateWorldMatrix(true, false);
      const local = o.worldToLocal(mouthWorld.clone());
      const pos = o.geometry.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const d = v.distanceToSquared(local);
        if (!best || d < best.d) best = { d, o, i, v: v.clone() };
      }
    });
    if (!best) return;
    const idx = it.spec.parts.indexOf(best.o.userData.part);
    const nrm = new THREE.Vector3().fromBufferAttribute(best.o.geometry.attributes.normal, best.i).normalize();
    const ps = this.player.size || 1;
    const R = Math.min(0.03, Math.max(0.012, this.held.maxDim / ps * 0.24)) * ps;
    if (R < 0.0015 || (it.state.bites || []).length > 60) return; // nibbles too small to see
    const c = best.v.clone().addScaledVector(nrm, -R * 0.42);
    (it.state.bites ||= []).push([idx, +c.x.toFixed(4), +c.y.toFixed(4), +c.z.toFixed(4), +R.toFixed(4)]);
  }

  // called every time a food item is built: replay bite marks, ripeness + spoilage colors
  applyVisuals(it) {
    const f = it.def?.food;
    if (!f) return;
    const s = it.state || {};
    const meshes = [];
    for (const g of Object.values(it.groups)) g.traverse((o) => { if (o.isMesh && o.userData.part) meshes.push(o); });
    // bite marks
    for (const [idx, x, y, z, R] of s.bites || []) {
      const part = it.spec.parts[idx];
      const mesh = meshes.find((m) => m.userData.part === part);
      if (!mesh) continue;
      if (!mesh.userData.ownGeo) { mesh.geometry = biteable(mesh.geometry); mesh.userData.ownGeo = true; }
      carve(mesh.geometry, new THREE.Vector3(x, y, z), R);
    }
    this.recolor(it, meshes);
  }

  // ripening (bananas go green -> yellow -> spotty -> brown) + going bad
  recolor(it, meshes) {
    const f = it.def.food, s = it.state || {};
    if (!meshes) { meshes = []; for (const g of Object.values(it.groups)) g.traverse((o) => { if (o.isMesh && o.userData.part) meshes.push(o); }); }
    const spoil = s.spoil || 0;
    for (const m of meshes) {
      const p = m.userData.part;
      let col = null;
      if (p.ripen && f.ripen?.colors?.length) {
        const cs = f.ripen.colors, k = Math.min(cs.length - 1.001, Math.max(0, spoil) * (cs.length - 1));
        col = new THREE.Color(cs[Math.floor(k)]).lerp(new THREE.Color(cs[Math.floor(k) + 1]), k % 1);
      } else if ((p.eat || p.leftover) && spoil > 0.8) {
        col = new THREE.Color(0xffffff).lerp(new THREE.Color(0x7d7550), Math.min(0.65, (spoil - 0.8) * 0.9));
      }
      if (!col) continue;
      if (!m.material.userData.own) { m.material = m.material.clone(); m.material.userData.own = true; }
      m.material.color.copy(col);
    }
    s.visSpoil = Math.round(spoil * 20) / 20;
  }

  // ---------- putting down + throwing ----------
  putDown() {
    const h = this.held;
    if (!h) return;
    const cam = this.camera.position, dir = this.camera.getWorldDirection(this._v.set(0, 0, 0)).clone();
    const own = new Set(h.item.colliders.map((c) => c.handle));
    const ray = new this.R.Ray({ x: cam.x, y: cam.y, z: cam.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.physics.world.castRayAndGetNormal(ray, REACH, true, undefined, undefined, this.player.collider, undefined, (c) => !own.has(c.handle));
    const yaw = Math.atan2(-dir.x, -dir.z) + Math.PI; // front faces you
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    let pos;
    if (hit && hit.normal.y > 0.55) {
      pos = new THREE.Vector3(cam.x + dir.x * hit.timeOfImpact, cam.y + dir.y * hit.timeOfImpact + 0.004, cam.z + dir.z * hit.timeOfImpact);
    } else {
      // nothing flat in reach: you just let go of it in front of you
      pos = h.worldPos ? h.worldPos.clone() : cam.clone().addScaledVector(dir, 0.5);
      q.copy(h.worldQ || q);
    }
    this.release(pos, q, null);
  }

  throwHeld(charge) {
    const h = this.held;
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const pos = h.worldPos ? h.worldPos.clone() : this.camera.position.clone().addScaledVector(dir, 0.5);
    const m = h.item.mass;
    const speed = Math.min(22, (40 * charge) / Math.max(0.25, m));
    this.release(pos, h.worldQ || new THREE.Quaternion(), new THREE.Vector3(dir.x * speed, dir.y * speed + 1.2 * charge, dir.z * speed));
    this.sound('throw');
  }

  release(pos, quat, vel) {
    const h = this.held;
    const it = h.item;
    this.held = null;
    const R = this.R;
    // rebuild so the collision shape matches what's left (eaten, opened, finished)
    const main = it.bodies.main;
    main.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    main.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true);
    const nu = this.rebuild(it);
    for (const b of Object.values(nu.bodies)) b.setBodyType(R.RigidBodyType.Dynamic, true);
    if (vel) nu.bodies.main.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
    nu.noBreakUntil = vel ? 0 : performance.now() + 800;
    nu.wake();
  }

  dropHeld() { if (this.held) this.putDown(); }

  // ---------- temperature + spoiling (twice a second) ----------
  tick(realDt) {
    const hours = (realDt * this.clock.rate) / 3600;
    if (hours <= 0) return;
    const ambient = this.weather();
    const fridges = this.items.items.filter((x) => x.itemId === 'fridge-kelvin');
    for (const fr of fridges) this.fridgeTick(fr, ambient, hours);
    for (const it of this.items.items) {
      const f = it.def?.food;
      if (!f) continue;
      const s = (it.state ||= {});
      const env = this.envTemp(it, fridges, ambient);
      if (s.tempC == null) s.tempC = f.keep === 'freezer' ? -18 : f.keep === 'fridge' ? 4 : env; // fresh from the store
      const tau = 0.6 * Math.cbrt(Math.max(0.02, it.mass) / 0.4);   // game hours to mostly match the air around it
      s.tempC += (env - s.tempC) * (1 - Math.exp(-hours / tau));
      s.spoil = (s.spoil || 0) + hours / 24 / shelfDays(f, s.tempC, s.opened);
      if (Math.abs(Math.round(s.spoil * 20) / 20 - (s.visSpoil ?? 0)) >= 0.05 && this.held?.item !== it && (f.ripen || s.spoil > 0.8)) this.recolor(it);
    }
  }

  fridgeTick(fr, ambient, hours) {
    const s = (fr.state ||= {});
    s.fridgeC ??= ambient; s.freezerC ??= ambient;
    const open = this.fridgeOpen(fr);
    const on = !!s.powered;
    const towards = (cur, target, tau) => cur + (target - cur) * (1 - Math.exp(-hours / tau));
    s.fridgeC = on && !open.doors ? towards(s.fridgeC, 3.5, 1.2) : towards(s.fridgeC, ambient, open.doors ? 0.4 : 9);
    s.freezerC = on && !open.drawer ? towards(s.freezerC, -18, 2.5) : towards(s.freezerC, ambient, open.drawer ? 0.5 : 12);
  }

  fridgeOpen(fr) {
    const m = fr.bodies.main.rotation(), qm = new THREE.Quaternion(m.x, m.y, m.z, m.w);
    const doors = ['doorL', 'doorR'].some((n) => { const r = fr.bodies[n]?.rotation(); return r && qm.angleTo(new THREE.Quaternion(r.x, r.y, r.z, r.w)) > 0.15; });
    let drawer = false;
    if (fr.bodies.freezer) {
      const a = fr.bodies.main.translation(), b = fr.bodies.freezer.translation();
      drawer = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 0.05;
    }
    return { doors, drawer };
  }

  envTemp(it, fridges, ambient) {
    if (this.held?.item === it) return Math.min(30, ambient + 4); // in your warm hand
    const p = it.position;
    for (const fr of fridges) {
      const local = this.toLocal(fr.bodies.main, p);
      const { W, H, D } = FRIDGE;
      if (Math.abs(local.x) < W / 2 - 0.03 && local.y > 0.64 && local.y < H - 0.03 && local.z > -D / 2 + 0.04 && local.z < D / 2) return fr.state.fridgeC ?? ambient;
      if (fr.bodies.freezer) {
        const l2 = this.toLocal(fr.bodies.freezer, p);
        if (Math.abs(l2.x) < W / 2 - 0.05 && l2.y > 0.08 && l2.y < 0.56 && l2.z > D / 2 - 0.53 && l2.z < D / 2 - 0.01) return fr.state.freezerC ?? ambient;
      }
    }
    return ambient;
  }

  toLocal(body, p) {
    const t = body.translation(), r = body.rotation();
    return p.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert());
  }

  // ---------- sounds ----------
  sound(kind) {
    const a = this.audio;
    if (!a?.ctx) return;
    const B = (o) => a.burst(o), T = (o) => a.tone(o);
    switch (kind) {
      case 'take': B({ dur: 0.06, freq: 900, q: 1, gain: 0.06 }); break;
      case 'throw': B({ dur: 0.18, freq: 500, q: 0.6, gain: 0.07, attack: 0.05 }); break;
      case 'crunch': for (const d of [0, 0.06, 0.13, 0.32, 0.42]) B({ dur: 0.05 + Math.random() * 0.03, freq: 2400 + Math.random() * 1800, q: 1.2, gain: 0.16, delay: d }); B({ dur: 0.1, freq: 300, type: 'lowpass', gain: 0.18, buffer: a.brown }); break;
      case 'crisp': for (let i = 0; i < 10; i++) B({ dur: 0.025, freq: 3500 + Math.random() * 3000, q: 1.5, gain: 0.1, delay: i * 0.035 + Math.random() * 0.02 }); break;
      case 'chew': for (const d of [0, 0.22, 0.45, 0.68]) B({ dur: 0.12, freq: 420, type: 'lowpass', gain: 0.16, buffer: a.brown, delay: d }); break;
      case 'soft': B({ dur: 0.16, freq: 380, type: 'lowpass', gain: 0.16, buffer: a.brown }); B({ dur: 0.12, freq: 380, type: 'lowpass', gain: 0.12, buffer: a.brown, delay: 0.3 }); break;
      case 'slurp': B({ dur: 0.35, freq: 1100, q: 2, gain: 0.08 }); T({ freq: 160, freqEnd: 90, dur: 0.12, gain: 0.08, type: 'triangle', delay: 0.4 }); break;
      case 'fizz': B({ dur: 0.7, freq: 6500, q: 0.8, gain: 0.035 }); // falls through to the gulps
      // eslint-disable-next-line no-fallthrough
      case 'gulp': for (const d of [0, 0.38]) { T({ freq: 170, freqEnd: 85, dur: 0.13, gain: 0.12, type: 'triangle', delay: d }); B({ dur: 0.09, freq: 260, type: 'lowpass', gain: 0.12, buffer: a.brown, delay: d }); } break;
      case 'open-cap': for (let i = 0; i < 5; i++) B({ dur: 0.02, freq: 3200, q: 3, gain: 0.08, delay: i * 0.03 }); break;
      case 'open-tab': T({ freq: 1800, freqEnd: 900, dur: 0.03, gain: 0.1, type: 'square' }); B({ dur: 0.45, freq: 5200, q: 0.7, gain: 0.12, delay: 0.02 }); break;
      case 'open-tear': B({ dur: 0.3, freq: 2200, q: 0.6, gain: 0.12, attack: 0.05 }); break;
      case 'open-peel': B({ dur: 0.35, freq: 1300, q: 1, gain: 0.08, attack: 0.08 }); break;
      case 'open-lid': T({ freq: 700, freqEnd: 300, dur: 0.06, gain: 0.1, type: 'triangle' }); B({ dur: 0.05, freq: 1800, q: 2, gain: 0.08 }); break;
      case 'open-wrapper': for (let i = 0; i < 12; i++) B({ dur: 0.02, freq: 3000 + Math.random() * 3000, q: 2, gain: 0.07, delay: i * 0.03 }); break;
      case 'open-carton': B({ dur: 0.18, freq: 800, q: 1, gain: 0.1 }); break;
      case 'open-twist': for (let i = 0; i < 6; i++) B({ dur: 0.02, freq: 2500 + Math.random() * 2000, q: 2, gain: 0.05, delay: i * 0.05 }); break;
      default: B({ dur: 0.1, freq: 600, q: 1, gain: 0.08 });
    }
  }

  dispose() { this.held = null; this.hands.busy = null; if (this.items.onBuilt) this.items.onBuilt = null; }
}

// a denser copy of the mesh so bite marks look round, not blocky
function biteable(geo) {
  if (geo.type === 'LatheGeometry') {
    const { points, segments } = geo.parameters;
    const dense = [];
    for (let i = 0; i < points.length - 1; i++) for (let k = 0; k < 3; k++) dense.push(points[i].clone().lerp(points[i + 1], k / 3));
    dense.push(points[points.length - 1].clone());
    const g = new THREE.LatheGeometry(dense, Math.min(96, segments * 2));
    if (geo.attributes.uv) {
      // keep the wrap-style UVs (v = height) that labels/skins expect
      g.computeBoundingBox();
      const pos = g.attributes.position, uv = g.attributes.uv, y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y;
      for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - y0) / Math.max(1e-6, y1 - y0));
    }
    return g;
  }
  if (geo.type === 'SphereGeometry') { const p = geo.parameters; return new THREE.SphereGeometry(p.radius, Math.min(96, p.widthSegments * 2), Math.min(64, p.heightSegments * 2)); }
  return geo.clone();
}

// carve a bite: every vertex inside the tooth sphere moves inward (along its normal) onto the
// sphere's far side, like a real bite out of an apple
function carve(geo, c, R) {
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const v = new THREE.Vector3(), n = new THREE.Vector3(), w = new THREE.Vector3();
  let moved = false;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    w.subVectors(v, c);
    const d2 = w.lengthSq();
    if (d2 >= R * R) continue;
    n.fromBufferAttribute(nrm, i).normalize();
    const wn = w.dot(n);
    const t = wn + Math.sqrt(Math.max(0, wn * wn - d2 + R * R));
    v.addScaledVector(n, -t);
    pos.setXYZ(i, v.x, v.y, v.z);
    moved = true;
  }
  if (moved) { pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere(); }
}
