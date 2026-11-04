// The tools you build with. The same tools work with mouse + keyboard and with VR controllers.
import * as THREE from 'three';
import { R, world, raycast, G, groups, owners } from '../core/physics.js';
import { scene, camera } from '../core/render.js';
import { DEFS } from '../parts/defs.js';
import { MATS } from '../core/mats.js';
import {
  bodies, addPart, newBody, weld, createJointChild, removePart, destroyBody, constructOf, serialize, deserialize, rebuildPart,
  wire, unwire, wires, setFrozen, bodyPose, partWorld, blueprintCenter, bumpTopo
} from '../build/core.js';
import { computePlacement, roomFor, setGhost, showGhost, hideGhost } from '../build/place.js';
import { worldPos, worldQuat } from '../parts/rt.js';
import { game } from '../game.js';

export const ICONS = {
  build: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 21 8v8l-9 5-9-5V8z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  grab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-6.5v-1a1.5 1.5 0 0 1 3 0V12m0-5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6.5 6.5 0 0 1-5-2.4L3.4 15.6a1.6 1.6 0 0 1 2.4-2.1L8 15.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  paint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 3h12v6H5z"/><path d="M17 6h2v5h-8v3"/><path d="M10 14h2v7h-2z"/></svg>',
  wire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M7 16.5C11 14 9 9 12.5 8.5S17 8 17 8"/></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M7 11V7a2 2 0 0 1 4 0v3m0-1V5a2 2 0 0 1 4 0v5m0-2a2 2 0 0 1 4 0v6a7 7 0 0 1-7 7c-3 0-4.5-1.5-6-4l-2-4a1.8 1.8 0 0 1 3-1.8L7 14"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20l6-6M4 20v-5M4 20h5M20 4l-6 6M20 4v5M20 4h-5"/></svg>'
};
export const TOOLS = [
  { id: 'build', name: 'Build', key: 'Digit1' }, { id: 'grab', name: 'Grab', key: 'Digit2' }, { id: 'edit', name: 'Edit', key: 'Digit3' },
  { id: 'paint', name: 'Paint', key: 'Digit4' }, { id: 'wire', name: 'Wire', key: 'Digit5' }, { id: 'delete', name: 'Delete', key: 'Digit6' },
  { id: 'hand', name: 'Hand', key: 'Digit7' }, { id: 'scale', name: 'Size', key: 'Digit8' }
];

export const T = {
  tool: 'build', def: DEFS.block, size: new THREE.Vector3(1, 1, 1), mat: null, color: null, props: {}, spin: 0,
  paintMat: 'steel', paintColor: '#c8332b', wireFrom: null, hold: null, aim: null, place: null, placeOK: false
};
const listeners = [];
export function onToolChange(f) { listeners.push(f); }
export function setTool(id) {
  if (T.tool === id) return;
  if (T.hold) letGo();
  T.tool = id;
  T.wireFrom = null;
  if (id !== 'build') hideGhost();
  showWires(id === 'wire' || id === 'edit');
  listeners.forEach((f) => f(id));
  game.sound('ui_select', null, 0.4);
}
export function pickPart(id) {
  const d = DEFS[id];
  if (!d) return;
  T.def = d;
  T.size = new THREE.Vector3(...d.size);
  T.mat = null; T.color = null; T.props = {};
  T.spin = 0;
  setTool('build');
  listeners.forEach((f) => f(T.tool));
}

/* ---------------- undo ---------------- */
const undoStack = [];
export function begin(set) {
  return { data: set ? serialize(set) : null, before: new Set(bodies), keep: set ? new Set(set) : new Set() };
}
export function commit(a) {
  const after = [];
  for (const b of bodies) if (!a.before.has(b) || a.keep.has(b)) after.push(b);
  undoStack.push({ data: a.data, after });
  if (undoStack.length > 40) undoStack.shift();
}
export function undo() {
  const a = undoStack.pop();
  if (!a) { game.toast('Nothing to undo'); return; }
  for (const b of a.after) if (bodies.has(b)) destroyBody(b);
  if (a.data) deserialize(a.data, { keepIds: true });
  game.sound('ui_back', null, 0.6);
  game.toast('Undone');
}
export function recordNew(made) { undoStack.push({ data: null, after: made }); }

/* ---------------- aiming ---------------- */
const AIM_GROUPS = groups(G.WORLD, G.WORLD | G.PARTS | G.HUMAN);
export function aimAt(origin, dir, max = 60) {
  const hit = raycast(origin, dir, max, { groups: AIM_GROUPS });
  return hit;
}
export function aimName(hit) {
  if (!hit || !hit.owner) return '';
  const o = hit.owner;
  if (o.kind === 'part') {
    const p = o.ref.rotorBase || o.ref, d = p.def;
    let s = d.name;
    if (d.seat) s += p.st.rider ? '' : '  ·  E to sit';
    else if (d.remote) s += '  ·  E to drive it';
    else if (d.use) s += '  ·  E to use';
    if (p.body.frozen) s += '  ·  frozen';
    return s;
  }
  if (o.kind === 'human') return o.ref.label();
  return '';
}

/* ---------------- outline of what you point at ---------------- */
const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false }));
outline.renderOrder = 20;
outline.visible = false;
scene.add(outline);
function showOutline(p, color = 0xffffff) {
  if (!p || p.dead) { outline.visible = false; return; }
  if (outline.parent !== p.body.group) p.body.group.add(outline);
  outline.position.copy(p.pos);
  outline.quaternion.copy(p.quat);
  outline.scale.set(p.size.x + 0.03, p.def.halfH(p) * 2 + 0.03, p.size.z + 0.03);
  outline.material.color.set(color);
  outline.visible = true;
}

/* ---------------- each frame: preview / outline ---------------- */
export function toolFrame(ray, dt) {
  const hit = aimAt(ray.origin, ray.dir, T.tool === 'hand' ? 4 : 80);
  T.aim = hit;
  outline.visible = false;
  if (T.hold) { holdFrame(ray, dt); return; }
  if (T.tool === 'build') {
    if (!hit || (hit.owner && hit.owner.kind === 'human' && !T.def.person) || (hit.owner && hit.owner.kind === 'player')) { hideGhost(); T.place = null; return; }
    if (T.def.person) {
      T.place = { wpos: hit.point.clone(), wquat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-ray.dir.x, -ray.dir.z) + Math.PI), seat: seatOf(hit) };
      setGhost(T.def, T.size, T.props, T.mat, T.color);
      T.placeOK = hit.normal.y > 0.5 || !!T.place.seat;
      showGhost(T.place, T.placeOK);
      return;
    }
    setGhost(T.def, T.size, T.props, T.mat || T.def.mat, T.color);
    const pl = computePlacement(hit, T.def, T.size, T.spin, game.settings.grid, ray.dir);
    T.place = pl;
    T.placeOK = roomFor(pl, T.def, T.size);
    showGhost(pl, T.placeOK);
    return;
  }
  const p = hit && hit.owner && hit.owner.kind === 'part' ? hit.owner.ref : null;
  const col = { delete: 0xff5a4f, paint: new THREE.Color(T.paintColor).getHex(), wire: 0x5dff7a, edit: 0x6ab8ff, scale: 0xffd54a, grab: 0xffffff, hand: 0xffffff }[T.tool];
  if (p && T.tool !== 'hand') showOutline(p.rotorBase && T.tool === 'delete' ? p.rotorBase : p, col);
  if (T.tool === 'wire' && T.wireFrom) drawPendingWire(ray, hit);
}
function seatOf(hit) {
  const p = hit && hit.owner && hit.owner.kind === 'part' ? hit.owner.ref : null;
  return p && p.def.seat && !p.st.rider ? p : null;
}

/* ---------------- main button / second button ---------------- */
export function primary(ray) {
  const hit = T.aim;
  switch (T.tool) {
    case 'build': return place();
    case 'grab': return grab(ray, hit);
    case 'edit': if (hit && hit.owner && (hit.owner.kind === 'part' || hit.owner.kind === 'human')) game.openEditor(hit.owner.kind === 'part' ? (hit.owner.ref) : hit.owner.ref, hit.owner.kind); return;
    case 'paint': return paint(hit, false);
    case 'wire': return wireClick(hit);
    case 'delete': return del(hit, false);
    case 'hand': return game.punch(ray, hit);
    case 'scale': return rescale(hit, 1.25);
  }
}
export function secondary(ray) {
  const hit = T.aim;
  switch (T.tool) {
    case 'build': return eyedrop(hit);
    case 'grab': if (T.hold) return freezeHeld(); if (hit && hit.owner && hit.owner.kind === 'part') return toggleFreeze(hit.owner.ref.body); return;
    case 'edit': return eyedrop(hit);
    case 'paint': return paint(hit, true);
    case 'wire': return unwireAll(hit);
    case 'delete': return del(hit, true);
    case 'hand': return use();
    case 'scale': return rescale(hit, 0.8);
  }
}
export function wheel(d) {
  if (T.hold) { T.hold.dist = THREE.MathUtils.clamp(T.hold.dist - d * 0.6, 1, 60); return; }
  if (T.tool === 'build' && !T.def.person) {
    // bigger / smaller, in steps that stay on the grid
    const k = d < 0 ? 1.25 : 0.8;
    const s = T.size.clone().multiplyScalar(k);
    const r = T.def.resize;
    if (!r) { game.toast('This part has one size'); return; }
    for (const a of ['x', 'y', 'z']) s[a] = Math.max(0.125, Math.min(16, Math.round(s[a] / 0.125) * 0.125));
    if (r === 'uniform' || r === 'uniform-ish') { const v = s.x; s.set(v, T.def.id === 'thruster' ? v * 1.6 : v, v); }
    if (s.equals(T.size)) { const st = d < 0 ? 0.125 : -0.125; s.addScalar(st).clampScalar(0.125, 16); }
    T.size.copy(s);
    game.sound('ui_click', null, 0.25);
    return;
  }
  if (T.tool === 'edit') return resizeFace(T.aim, d < 0 ? 1 : -1);
}
export function rotate(fine) {
  if (T.hold) return;
  T.spin += fine ? Math.PI / 12 : Math.PI / 2;
  game.sound('ui_click', null, 0.3);
}

/* ---------------- Build ---------------- */
function place() {
  const pl = T.place;
  if (!pl) return;
  if (!T.placeOK) { game.sound('ui_error', null, 0.5); game.toast(T.def.person ? 'Put people on the ground, a floor or a seat' : 'Something is in the way'); return; }
  if (T.def.person) {
    const h = game.humans.spawn(T.def, pl.wpos, pl.wquat, pl.seat);
    if (h) game.sound('ui_ok', null, 0.4);
    return;
  }
  const opts = { pos: pl.pos, quat: pl.quat, size: T.size, mat: T.mat || T.def.mat, color: T.color, props: { ...T.props } };
  let a;
  let p;
  if (pl.body) {
    a = begin(constructOf(pl.body));
    p = addPart(pl.body, T.def.id, opts);
    weld(p, pl.target);
  } else {
    a = begin(null);
    const b = newBody(pl.wpos, pl.wquat);
    p = addPart(b, T.def.id, { ...opts, pos: new THREE.Vector3(), quat: new THREE.Quaternion() });
  }
  if (p.def.joint) createJointChild(p);
  commit(a);
  game.sound('attach', pl.wpos, 0.75);
  game.fx.dust(pl.wpos, 2, 0.25);
  game.placed && game.placed(p);
}
function eyedrop(hit) {
  if (!hit || !hit.owner || hit.owner.kind !== 'part') return;
  let p = hit.owner.ref;
  if (p.rotorBase) p = p.rotorBase;
  T.def = p.def; T.size = p.size.clone(); T.mat = p.mat; T.color = p.color; T.props = { ...p.props }; T.spin = 0;
  setTool('build');
  listeners.forEach((f) => f(T.tool));
  game.toast('Copied ' + p.def.name);
}

/* ---------------- Grab (move things with a pull, like a tractor beam in your hand) ---------------- */
function grab(ray, hit) {
  if (!hit || !hit.owner) return;
  if (hit.owner.kind === 'human') {
    const h = hit.owner.ref;
    T.hold = { human: h, dist: hit.toi, bone: h.grab(hit.collider) };
    return;
  }
  if (hit.owner.kind !== 'part') return;
  const b = hit.owner.ref.body;
  const { pos, quat } = bodyPose(b);
  const local = hit.point.clone().sub(pos).applyQuaternion(quat.clone().invert());
  T.hold = { body: b, local, dist: hit.toi, frozen: b.frozen, rot: new THREE.Quaternion(), camQ: camera.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(quat) };
  b.rb.wakeUp();
  game.sound('ui_toggle', hit.point, 0.4);
}
export function letGo() {
  const h = T.hold;
  T.hold = null;
  if (h && h.human) h.human.release();
}
export function holdingThing() { return !!T.hold; }
const _t = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
function holdFrame(ray) {
  const h = T.hold;
  _t.copy(ray.origin).addScaledVector(ray.dir, h.dist);
  if (h.human) { h.human.dragTo(h.bone, _t); return; }
  if (!bodies.has(h.body)) { T.hold = null; return; }
  h.target = _t.clone();
  if (h.body.frozen) {
    // frozen builds just follow your aim exactly (great for lining things up)
    const { quat } = bodyPose(h.body);
    const off = h.local.clone().applyQuaternion(quat);
    const np = _t.clone().sub(off);
    for (const b of constructOf(h.body)) {
      if (b === h.body) continue;
      const d = new THREE.Vector3().subVectors(b.group.position, h.body.group.position);
      b.rb.setTranslation(np.clone().add(d), true);
    }
    h.body.rb.setTranslation(np, true);
    for (const b of constructOf(h.body)) game.snapBody(b);
  }
}
// called every physics step: pull the held point toward where you aim
export function holdStep(dt) {
  const h = T.hold;
  if (!h || !h.target || h.human || !bodies.has(h.body) || h.body.frozen) return;
  const rb = h.body.rb;
  const { pos, quat } = bodyPose(h.body);
  const pt = h.local.clone().applyQuaternion(quat).add(pos);
  const v = rb.velocityAtPoint(pt);
  const want = h.target.clone().sub(pt).multiplyScalar(12);
  if (want.length() > 40) want.setLength(40);
  const m = Math.min(rb.mass(), 4000);
  const imp = new THREE.Vector3(want.x - v.x, want.y - v.y, want.z - v.z).multiplyScalar(m * 0.35);
  imp.y += m * 98.1 * dt * rb.gravityScale();
  rb.applyImpulseAtPoint(imp, pt, true);
  const w = rb.angvel();
  rb.setAngvel({ x: w.x * 0.85, y: w.y * 0.85, z: w.z * 0.85 }, true);
}
export function turnHeld(dx, dy) {
  const h = T.hold;
  if (!h || !h.body) return;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(dy * 0.006, dx * 0.006, 0));
  const camQ = camera.getWorldQuaternion(new THREE.Quaternion());
  const turn = camQ.clone().multiply(q).multiply(camQ.clone().invert());
  for (const b of constructOf(h.body)) {
    const { pos, quat } = bodyPose(b);
    const pivot = h.body.group.position;
    b.rb.setRotation(turn.clone().multiply(quat), true);
    if (b !== h.body) b.rb.setTranslation(pos.clone().sub(pivot).applyQuaternion(turn).add(pivot), true);
    b.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    game.snapBody(b);
  }
}
function freezeHeld() {
  const b = T.hold.body;
  T.hold = null;
  if (b) toggleFreeze(b, true);
}
function toggleFreeze(b, on) {
  const set = constructOf(b);
  const to = on === undefined ? !b.frozen : on;
  for (const x of set) setFrozen(x, to);
  game.toast(to ? 'Frozen in place' : 'Unfrozen');
  game.sound(to ? 'ui_ok' : 'ui_back', null, 0.5);
}

/* ---------------- Paint ---------------- */
function paint(hit, pick) {
  if (!hit || !hit.owner || hit.owner.kind !== 'part') return;
  const p = hit.owner.ref;
  if (pick) { T.paintMat = p.mat; T.paintColor = p.color || MATS[p.mat].color; game.toast('Picked ' + MATS[p.mat].name); game.paintPicked && game.paintPicked(); return; }
  const a = begin(constructOf(p.body));
  const list = game.input && game.input.shift ? [...constructOf(p.body)].flatMap((b) => [...b.parts]) : [p];
  for (const q of list) {
    q.mat = T.paintMat;
    q.color = T.paintColor;
    rebuildPart(q);
  }
  for (const b of constructOf(p.body)) b.metaDirty = true;
  commit(a);
  game.sound('attach', hit.point, 0.4);
}

/* ---------------- Wire ---------------- */
function wireClick(hit) {
  const p = hit && hit.owner && hit.owner.kind === 'part' ? (hit.owner.ref.rotorBase || hit.owner.ref) : null;
  if (!p) { T.wireFrom = null; return; }
  if (!T.wireFrom) {
    if (!p.def.source) { game.toast('Start a wire on a Button, Switch, Sensor, Timer or Logic Gate'); game.sound('ui_error', null, 0.4); return; }
    T.wireFrom = p;
    game.toast(p.def.name + ': now click what it should turn on');
    game.sound('ui_toggle', null, 0.4);
    return;
  }
  if (p === T.wireFrom) { T.wireFrom = null; return; }
  wire(T.wireFrom, p);
  game.toast(T.wireFrom.def.name + ' now works ' + p.def.name);
  game.sound('snap', hit.point, 0.5);
  T.wireFrom = null;
  bumpTopo();
}
function unwireAll(hit) {
  const p = hit && hit.owner && hit.owner.kind === 'part' ? hit.owner.ref : null;
  if (!p) return;
  const n = p.wiresIn.size + p.wiresOut.size;
  for (const w of [...p.wiresIn, ...p.wiresOut]) unwire(w);
  if (n) { game.toast('Wires removed'); game.sound('remove', hit.point, 0.4); }
}
let wiresShown = false;
const wireMat = new THREE.LineBasicMaterial({ color: 0x5dff7a, transparent: true, opacity: 0.9, depthTest: false });
const pending = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), wireMat);
pending.renderOrder = 21; pending.visible = false; pending.frustumCulled = false;
scene.add(pending);
function showWires(on) { wiresShown = on; if (!on) { pending.visible = false; for (const w of wires) if (w.line) w.line.visible = false; } }
export function drawWires() {
  if (!wiresShown) return;
  for (const w of wires) {
    if (!w.line) {
      w.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), wireMat);
      w.line.frustumCulled = false; w.line.renderOrder = 21;
      scene.add(w.line);
    }
    w.line.visible = true;
    const a = partWorld(w.from, _p), b = partWorld(w.to, _t);
    const mid = a.clone().add(b).multiplyScalar(0.5); mid.y += 0.3 + a.distanceTo(b) * 0.1;
    const pos = w.line.geometry.attributes.position;
    pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, mid.x, mid.y, mid.z); pos.setXYZ(2, b.x, b.y, b.z);
    pos.needsUpdate = true;
  }
}
function drawPendingWire(ray, hit) {
  const a = partWorld(T.wireFrom, _p);
  const b = hit ? hit.point : ray.origin.clone().addScaledVector(ray.dir, 4);
  const pos = pending.geometry.attributes.position;
  pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
  pending.visible = true;
}

/* ---------------- Delete ---------------- */
function del(hit, whole) {
  if (!hit || !hit.owner) return;
  if (hit.owner.kind === 'human') { game.humans.remove(hit.owner.ref); game.sound('remove', hit.point, 0.5); return; }
  if (hit.owner.kind !== 'part') return;
  let p = hit.owner.ref;
  if (p.rotorBase) p = p.rotorBase;
  const set = constructOf(p.body);
  const a = begin(set);
  if (whole) { for (const b of [...set]) destroyBody(b); game.toast('Build deleted (Z to undo)'); }
  else removePart(p);
  commit(a);
  game.sound('remove', hit.point, 0.6);
  game.fx.dust(hit.point, 3, 0.3);
}

/* ---------------- Edit: resize the face you point at with the mouse wheel ---------------- */
function resizeFace(hit, dir) {
  if (!hit || !hit.owner || hit.owner.kind !== 'part') return;
  const p = hit.owner.ref;
  const r = p.def.resize;
  if (!r || p.def.joint) { game.toast(p.def.joint ? 'Joint parts keep the size you placed them with' : 'This part has one size'); return; }
  const { quat } = bodyPose(p.body);
  const local = hit.normal.clone().applyQuaternion(quat.clone().multiply(p.quat).invert());
  const ax = Math.abs(local.x) > Math.abs(local.y) && Math.abs(local.x) > Math.abs(local.z) ? 'x' : Math.abs(local.y) > Math.abs(local.z) ? 'y' : 'z';
  const sign = Math.sign(local[ax]) || 1;
  const step = 0.125 * dir;
  const a = begin(constructOf(p.body));
  const before = p.size.clone();
  if (r === 'uniform' || r === 'uniform-ish') p.size.multiplyScalar(Math.max(0.125, before.x + step) / before.x);
  else if (r === 'round' && ax !== 'y') { const v = Math.max(0.125, before.x + step); p.size.x = v; p.size.z = v; }
  else p.size[ax] = Math.max(0.05, Math.min(30, before[ax] + step));
  // grow out from the face you point at, so the other side stays put
  if (r === 'xyz' || (r === 'round' && ax === 'y')) {
    const grow = (p.size[ax] - before[ax]) / 2 * sign;
    const v = new THREE.Vector3(); v[ax] = grow;
    p.pos.add(v.applyQuaternion(p.quat));
  }
  rebuildPart(p);
  commit(a);
  game.sound('ui_click', null, 0.3);
}

/* ---------------- Size tool: grow or shrink a whole build ---------------- */
function rescale(hit, k) {
  if (!hit || !hit.owner) return;
  if (hit.owner.kind === 'human') { game.toast('People stay their real size'); return; }
  if (hit.owner.kind !== 'part') return;
  const set = constructOf(hit.owner.ref.body);
  const data = serialize(set);
  let big = 0, small = 99;
  for (const bd of data.bodies) for (const pd of bd.parts) { big = Math.max(big, ...pd.s); small = Math.min(small, ...pd.s); }
  if (k > 1 && big * k > 40) { game.toast('That is as big as it gets'); return; }
  if (k < 1 && small * k < 0.04) { game.toast('That is as small as it gets'); return; }
  const a = begin(set);
  const box = blueprintCenter(data);
  const c = box.getCenter(new THREE.Vector3());
  const bottom = box.min.y;
  for (const b of [...set]) destroyBody(b);
  const pos = c.clone();
  pos.y = bottom + (c.y - bottom) * k + (bottom > 0.05 ? 0 : 0.02);
  deserialize(data, { xf: { origin: c, pos, quat: new THREE.Quaternion() }, keepIds: true, scale: k });
  commit(a);
  game.sound(k > 1 ? 'zap' : 'pop', hit.point, 0.6, k > 1 ? 0.8 : 1.3);
}

/* ---------------- Use (E): sit, press, flip, light the fuse, take the remote ---------------- */
export function use() {
  const hit = aimAt(game.useRay.origin, game.useRay.dir, 4);
  if (!hit || !hit.owner) return false;
  if (hit.owner.kind === 'human') { game.humans.use(hit.owner.ref); return true; }
  if (hit.owner.kind !== 'part') return false;
  let p = hit.owner.ref;
  if (p.rotorBase && !p.def.use) p = p.rotorBase;
  if (p.def.seat) { game.sitIn(p); return true; }
  if (p.def.remote) { game.takeRemote(p); return true; }
  if (p.def.use) { p.def.use(p, game.partCtx); return true; }
  return false;
}
