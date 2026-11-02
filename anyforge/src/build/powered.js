// Runs every powered part each physics step: reads who is driving, works out signals through wires, then lets each
// part do its thing (spin, push, pull, glow...). Also anti-gravity, portals and the Brain block.
import * as THREE from 'three';
import { world, R, toV, toQ } from '../core/physics.js';
import { bodies, constructOf, constructParts, constructMass, refreshMeta, topo, partWorld, bodyPose, jointAxis, wires } from './core.js';
import { MATS } from '../core/mats.js';
import { worldPos, worldQuat, worldUp } from '../parts/rt.js';
import { PORTAL_COLORS } from '../parts/defs-logic.js';
import { game } from '../game.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const ANALOG = new Set(['drive', 'steer', 'lift', 'pitch', 'roll']);

// controllers: who drives which build this step. { ref: part (seat/remote/brain), input: {drive, steer, lift, pitch, roll, held:Set, edges:Set} }
export const controllers = new Map(); // construct Set -> controller
let activeParts = [], partsVer = -1;
function refreshActive() {
  partsVer = topo;
  activeParts = [];
  for (const b of bodies) for (const p of b.parts) {
    const d = p.def;
    if (d.fixed || d.control || d.frame || d.gate || d.source || d.antigrav || d.portal || d.light || d.explosive || d.horn || d.brainBlock || d.loop) activeParts.push(p);
  }
}
export function allActive() { if (partsVer !== topo) refreshActive(); return activeParts; }

export function setController(seatPart, input) {
  const set = constructOf(seatPart.body);
  controllers.set(set, { ref: seatPart, input });
}
export function clearControllers() { controllers.clear(); }

function chan(input, ch) {
  if (!input) return 0;
  if (ANALOG.has(ch)) return input[ch] || 0;
  return 0;
}

export function powerStep(dt, ctx) {
  const list = allActive();
  for (const b of bodies) if (b.metaDirty) refreshMeta(b);
  markSteering();

  // brain blocks drive their builds when nobody sits in them
  for (const p of list) {
    if (!p.def.brainBlock || !p.props.on) continue;
    const set = constructOf(p.body);
    if (controllers.has(set)) continue;
    const input = brainInput(p, ctx);
    if (input) controllers.set(set, { ref: p, input, brain: true });
  }

  // 1) signal sources first (buttons, switches, sensors, timers)
  for (const p of list) if (p.def.source && !p.def.gate && p.def.fixed) p.def.fixed(p, dt, ctx);
  // 2) gates, a few passes so chains of gates settle
  for (let pass = 0; pass < 3; pass++) {
    for (const p of list) {
      if (!p.def.gate) continue;
      const ins = [...p.wiresIn].map((w) => !!w.from.st.out);
      const on = ins.filter(Boolean).length;
      const mode = p.props.mode;
      p.st.out = mode === 'AND' ? ins.length > 0 && on === ins.length : mode === 'OR' ? on > 0 : mode === 'NOT' ? on === 0 : on === 1;
    }
  }
  // 3) everyone else: work out level / active, then run
  const massCache = new Map();
  const padCache = new Map();
  for (const p of list) if (p.def.id === 'hover' && !p.dead) { const set = constructOf(p.body); padCache.set(set, (padCache.get(set) || 0) + 1); }
  for (const p of list) {
    if (p.dead || p.def.source) continue;
    const d = p.def;
    const set = constructOf(p.body);
    const ctl = controllers.get(set);
    const input = ctl && ctl.input;
    const wired = p.wiresIn.size > 0;
    const signal = wired && [...p.wiresIn].some((w) => w.from.st.out);
    const rising = signal && !p.st.lastSignal;
    p.st.lastSignal = signal;
    let ch = p.props.input || 'none';
    if (!massCache.has(set)) massCache.set(set, constructMass(set));
    p.st.constructMass = massCache.get(set);
    if (d.id === 'hover') p.st.padCount = padCache.get(set) || 1;
    p.st.ctl = input || null;
    p.st.seatQuat = ctl ? worldQuat(ctl.ref, new THREE.Quaternion()) : null;

    // key presses toggle things on and off for good (and set off explosives / horns)
    if (input && input.edges.has(ch)) {
      if (d.control === 'toggle' && !ANALOG.has(ch)) p.props.on = !p.props.on;
      if (d.explosive) { ctx.detonate(p); continue; }
      if (d.horn) d.use(p, ctx);
    }
    if (rising && d.explosive) { ctx.detonate(p); continue; }
    if (rising && d.horn) d.use(p, ctx);

    if (d.control === 'analog') {
      let lv = 0;
      if (input) {
        if (ch === 'auto') lv = autoThrust(p, ctl);
        else if (ch === 'drive' && d.id === 'wheel') lv = wheelLevel(p, ctl, set);
        else if (ch === 'steer' && d.id === 'steer') { lv = input.steer || 0; steerSign(p, ctl); }
        else lv = ANALOG.has(ch) ? chan(input, ch) : (input.held.has(ch) ? 1 : 0);
      }
      if (signal) lv = Math.max(lv, 1);
      if (p.props.on) lv = 1;
      p.st.level = lv;
      p.st.active = Math.abs(lv) > 0.01;
    } else if (d.control === 'toggle') {
      if (input && ANALOG.has(ch)) { p.st.level = chan(input, ch); p.st.active = Math.abs(p.st.level) > 0.01 || !!p.props.on; if (p.props.on && !p.st.level) p.st.level = 1; }
      else { p.st.active = wired ? signal : !!p.props.on; p.st.level = p.st.active ? 1 : 0; }
    } else if (d.light) {
      p.st.active = wired ? signal : !!p.props.on;
    }
    if (d.antigrav) {
      p.st.active = wired ? signal : !!p.props.on;
    }
    if (d.fixed) d.fixed(p, dt, ctx);
  }

  // anti-gravity: the whole build floats while any of its anti-gravity parts is on
  const floaty = new Set();
  for (const p of list) if (p.def.antigrav && p.st.active && !p.dead) floaty.add(constructOf(p.body));
  for (const b of bodies) {
    const want = [...floaty].some((s) => s.has(b));
    if (b.antigrav !== want) {
      b.antigrav = want;
      b.rb.setGravityScale(want ? 0 : 1, true);
      b.rb.setLinearDamping(want ? 0.35 : 0.02);
      b.rb.setAngularDamping(want ? 0.6 : 0.06);
    }
  }
  portals(dt, ctx, list);
  controllers.clear();
}

// thrusters on Auto fire when their push matches the direction you are asking for
function autoThrust(p, ctl) {
  const c = ctl.input;
  const q = worldQuat(ctl.ref, _q);
  const push = worldUp(p, _a).negate();
  const f = _b.set(0, 0, -1).applyQuaternion(q), r = _c.set(1, 0, 0).applyQuaternion(q);
  const u = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const df = push.dot(f), dr = push.dot(r), du = push.dot(u);
  let lv = 0;
  if (Math.abs(df) > 0.6) lv = Math.max(lv, (c.drive || 0) * Math.sign(df));
  if (Math.abs(du) > 0.6) lv = Math.max(lv, (c.lift || 0) * Math.sign(du));
  if (Math.abs(dr) > 0.6) lv = Math.max(lv, (c.steer || 0) * Math.sign(dr));
  return Math.max(0, lv);
}
function wheelLevel(p, ctl, set) {
  const c = ctl.input;
  const q = worldQuat(ctl.ref, _q);
  const f = _b.set(0, 0, -1).applyQuaternion(q), r = _c.set(1, 0, 0).applyQuaternion(q), u = _a.set(0, 1, 0).applyQuaternion(q);
  // which way this wheel has to spin so the build goes forward
  const axis = jointAxis(p, new THREE.Vector3()).applyQuaternion(toQ(p.body.rb.rotation(), _q2));
  const s = new THREE.Vector3().crossVectors(axis, u).dot(f);
  p.st.driveSign = s >= 0 ? 1 : -1;
  if (Math.abs(s) < 0.3) return 0; // wheel lying flat: do not spin it
  let lv = c.drive || 0;
  if (!set.hasSteer) {
    // tank-style turning: wheels on the right slow down to turn right
    const side = Math.sign(partWorld(p, new THREE.Vector3()).sub(partWorld(ctl.ref, new THREE.Vector3())).dot(r)) || 0;
    lv -= (c.steer || 0) * side;
  }
  return Math.max(-1, Math.min(1, lv));
}
function steerSign(p, ctl) {
  const q = worldQuat(ctl.ref, _q);
  const f = _b.set(0, 0, -1).applyQuaternion(q), u = _c.set(0, 1, 0).applyQuaternion(q);
  const front = Math.sign(partWorld(p, new THREE.Vector3()).sub(partWorld(ctl.ref, new THREE.Vector3())).dot(f)) || 1;
  const up = Math.sign(worldUp(p, _a).dot(u)) || 1;
  p.st.steerSign = front * up;
}
export function markSteering() {
  // remember which builds have steering hinges (then wheels stop doing tank turns)
  for (const b of bodies) {
    const set = constructOf(b);
    if (set.steerVer === topo) continue;
    set.steerVer = topo;
    set.hasSteer = constructParts(set).some((p) => p.def.id === 'steer');
  }
}

/* ---------------- Brain block: drives its build toward / away from someone ---------------- */
function brainInput(p, ctx) {
  const at = worldPos(p, _a);
  let target = null;
  if (p.props.target === 'you' || p.props.target === 'any') target = ctx.playerPos.clone();
  if (p.props.target !== 'you') {
    const h = ctx.nearestHuman(at, 80);
    if (h && (!target || h.center().distanceTo(at) < target.distanceTo(at))) target = h.center();
  }
  const mode = p.props.mode;
  if (mode === 'wander' || !target) {
    if (!p.st.wander || ctx.time > p.st.wanderT) { p.st.wander = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40)); p.st.wanderT = ctx.time + 6; }
    target = p.st.wander;
  }
  const q = worldQuat(p, _q).invert();
  const local = target.clone().sub(at).applyQuaternion(q);
  const dist = Math.hypot(local.x, local.z);
  let ang = Math.atan2(local.x, -local.z);
  const sp = p.props.speed / 100;
  let drive = 0, steer = 0;
  if (mode === 'flee') { ang = ang > 0 ? ang - Math.PI : ang + Math.PI; drive = dist < 60 ? 1 : 0; }
  else if (mode === 'follow') drive = dist > 7 ? 1 : dist < 3 ? -0.4 : 0;
  else drive = dist > 1.5 ? 1 : 0;
  steer = Math.max(-1, Math.min(1, ang * 1.8));
  if (Math.abs(ang) > 1.6 && mode !== 'flee') drive *= 0.4;
  const held = new Set(), edges = new Set();
  return { drive: drive * sp, steer, lift: 0, pitch: 0, roll: 0, strafe: 0, held, edges };
}

/* ---------------- portals ---------------- */
const lastSide = new Map();
const cool = new WeakMap();
function portals(dt, ctx, list) {
  const ps = list.filter((p) => p.def.portal && !p.dead && p.props.on);
  if (ps.length < 2) return;
  const byCh = {};
  for (const p of ps) (byCh[p.props.channel] = byCh[p.props.channel] || []).push(p);
  for (const ch in byCh) {
    const g = byCh[ch].sort((a, b) => a.id - b.id);
    if (g.length < 2) continue;
    g.forEach((pin, i) => {
      const pout = g[(i + 1) % g.length];
      const pq = worldQuat(pin, new THREE.Quaternion()), inv = pq.clone().invert();
      const pc = worldPos(pin, new THREE.Vector3(), new THREE.Vector3(0, 0.05, 0));
      const r = pin.size.x / 2 * 0.92;
      const check = (key, point, onCross) => {
        const l = point.clone().sub(pc).applyQuaternion(inv);
        const prev = lastSide.get(key);
        lastSide.set(key, l.z);
        if (prev === undefined || Math.hypot(l.x, l.y) > r) return;
        if ((prev > 0) !== (l.z > 0) && Math.abs(l.z) < 2.5) onCross(l);
      };
      for (const b of bodies) {
        if (b.frozen || constructOf(b).has(pin.body)) continue;
        const set = constructOf(b);
        if ((cool.get(set) || 0) > ctx.time) continue;
        const c = toV(b.rb.worldCom());
        if (c.distanceTo(pc) > r + 6) continue;
        check(pin.id + ':' + b.id, c, () => { teleportSet(set, pin, pout); cool.set(set, ctx.time + 0.6); });
      }
      check(pin.id + ':you', ctx.playerPos, () => ctx.teleportPlayer(transformFor(pin, pout)));
      for (const h of ctx.humansNear(pc, r + 3)) check(pin.id + ':h' + h.id, h.center(), () => h.teleport(transformFor(pin, pout)));
    });
  }
}
// in through one portal, out of the other: turned around so you come out facing away from it
function transformFor(pin, pout) {
  const qin = worldQuat(pin, new THREE.Quaternion()), qout = worldQuat(pout, new THREE.Quaternion());
  const pin0 = worldPos(pin, new THREE.Vector3(), new THREE.Vector3(0, 0.05, 0)), pout0 = worldPos(pout, new THREE.Vector3(), new THREE.Vector3(0, 0.05, 0));
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const rot = qout.clone().multiply(flip).multiply(qin.clone().invert());
  return {
    rot,
    point: (v) => v.clone().sub(pin0).applyQuaternion(rot).add(pout0),
    dir: (v) => v.clone().applyQuaternion(rot)
  };
}
function teleportSet(set, pin, pout) {
  const T = transformFor(pin, pout);
  for (const b of set) {
    const { pos, quat } = bodyPose(b);
    const np = T.point(pos), nq = T.rot.clone().multiply(quat);
    const lv = toV(b.rb.linvel()), av = toV(b.rb.angvel());
    b.rb.setTranslation(np, true);
    b.rb.setRotation(nq, true);
    const nl = T.dir(lv), na = T.dir(av);
    b.rb.setLinvel(nl, true); b.rb.setAngvel(na, true);
    game.snapBody(b);
  }
  game.sound('portal', worldPos(pout, new THREE.Vector3()), 0.8);
}
export { PORTAL_COLORS };
