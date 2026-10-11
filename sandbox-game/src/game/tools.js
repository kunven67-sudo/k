// Hotbar + every hand-held tool and weapon.
import * as THREE from 'three';
import { R, world, G, groups, QUERY_ALL, QUERY_SOLID, physicsState } from '../engine/physics.js';
import { input } from '../engine/input.js';
import { BY_ID, buildParts } from './catalog.js';
import { MATERIALS, SHAPE_MATERIALS, getMaterial } from '../gfx/materials.js';
import { cyl, sphere, box, merge, translate, rotate } from '../gfx/geom.js';
import {
  spawn, removeEntity, entityFromCollider, partFromCollider, setFrozen, buildVisual,
  addJoint, removeJoint, setEntityMaterial, applyImpulseAt, entities, JOINT_TYPES,
} from './entities.js';
import { explode, lightFuse, detonateAllRemote } from './explosions.js';
import { ctx } from './ctx.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const AIM_GROUPS = groups(0xffff, G.STATIC | G.OBJECT | G.DEBRIS);

export const hotbar = {
  slots: [
    { kind: 'tool', id: 'physgun' },
    { kind: 'item', id: 'crate' },
    { kind: 'tool', id: 'grenade' },
    { kind: 'tool', id: 'rpg' },
    { kind: 'tool', id: 'c4tool' },
    { kind: 'tool', id: 'detonator' },
    { kind: 'tool', id: 'weld' },
    { kind: 'tool', id: 'painter' },
    { kind: 'tool', id: 'remover' },
  ],
  index: 1,
  get current() { return this.slots[this.index]; },
};

const undoStack = [];
const state = {
  snap: true,
  ghostYaw: 0,
  ghostTilt: 0,
  shapeMat: null,
  size: 1,
  hold: null,       // physics gun hold
  hand: null,       // picked up with hands (F)
  weldMode: 0,
  weldA: null,
  paintIdx: 0,
  grenade: null,    // { charge, cooking, fuse }
  rpg: { loaded: true, reload: 0 },
  rockets: [],
  message: '',
  messageT: 0,
};
const WELD_MODES = ['weld', 'glue', 'nails', 'hinge'];

let scene, camera;
let ghost = null, ghostKey = '', ghostBox = new THREE.Box3();
let beam, arc, marker;

export function initTools() {
  scene = ctx.scene; camera = ctx.camera;
  // physics gun beam
  beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 20 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85 }));
  beam.frustumCulled = false; beam.visible = false;
  scene.add(beam);
  // grenade arc preview
  arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 40 }, () => new THREE.Vector3())), new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.15, gapSize: 0.12, transparent: true, opacity: 0.6 }));
  arc.frustumCulled = false; arc.visible = false;
  scene.add(arc);
  marker = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshBasicMaterial({ color: 0x66ccff }));
  marker.visible = false;
  scene.add(marker);
}

export function say(msg, t = 2.2) { state.message = msg; state.messageT = t; }

export function setSlotItem(def, { mat } = {}) {
  // Items go into the spawner slot (2); tools/weapons go to their own slot or the current one.
  if (def.tool) {
    const i = hotbar.slots.findIndex((s) => s.id === def.id);
    if (i >= 0) { hotbar.index = i; return; }
    hotbar.slots[hotbar.index] = { kind: 'tool', id: def.id };
    return;
  }
  let i = hotbar.slots.findIndex((s) => s.kind === 'item');
  if (i < 0) i = hotbar.index;
  hotbar.slots[i] = { kind: 'item', id: def.id };
  hotbar.index = i;
  if (mat) state.shapeMat = mat;
  state.size = 1;
}
export function setShapeMaterial(m) { state.shapeMat = m; }
export function getShapeMaterial() { return state.shapeMat; }

// --------------------------------------------------------------------------- aiming
export function aim(maxDist = 200, filterGroups = AIM_GROUPS, excludeEntity = null) {
  const origin = camera.position;
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const hit = world.castRayAndGetNormal(new R.Ray(origin, dir), maxDist, true, undefined, filterGroups, ctx.player.collider, undefined,
    excludeEntity ? (c) => entityFromCollider(c.handle) !== excludeEntity : undefined);
  if (!hit) return null;
  const rec = partFromCollider(hit.collider.handle);
  return {
    point: origin.clone().addScaledVector(dir, hit.timeOfImpact),
    normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    dist: hit.timeOfImpact, dir,
    entity: rec?.e || null, part: rec?.part || null, collider: hit.collider,
  };
}

function describe(e) {
  if (!e) return '';
  const name = e.def?.name || e.label || (e.defId === 'chunk' ? 'Broken piece' : e.defId === 'rebar' ? 'Rebar' : 'Piece');
  const m = MATERIALS[e.mainMat]?.name || '';
  const kg = e.mass;
  const w = kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : kg >= 10 ? `${kg.toFixed(0)} kg` : `${kg.toFixed(1)} kg`;
  return `${name} · ${m} · ${w}${e.frozen ? ' · frozen' : ''}`;
}

// --------------------------------------------------------------------------- per-frame (input) + per-step (physics)
export function updateToolsFrame(realDt) {
  const slot = hotbar.current;
  // hotbar selection
  for (let i = 0; i < 9; i++) if (input.rawHit('Digit' + (i + 1))) selectSlot(i);
  let wheelFree = true;
  if (state.hold && slot.id === 'physgun') wheelFree = false;
  if (slot.kind === 'item' && input.down('sprint') && BY_ID[slot.id]?.tab === 'Shapes') wheelFree = false;
  if (wheelFree && input.mouse.wheel) selectSlot((hotbar.index + input.mouse.wheel + 9) % 9);

  if (input.hit('snap')) say(`Snap to grid: ${(state.snap = !state.snap) ? 'ON' : 'OFF'}`);
  if (input.hit('undo')) undo();
  if (input.hit('pickup')) togglePickup();

  if (state.hand) handFrame(realDt);
  else {
    if (slot.kind === 'item') spawnerFrame(slot);
    else hideGhost();
    if (slot.kind === 'tool') toolFrame(slot.id, realDt);
  }
  if (slot.id !== 'physgun' && state.hold) releaseHold();
  if (slot.id !== 'grenade' && state.grenade) cancelGrenade();
  if (slot.id !== 'weld') { state.weldA = null; marker.visible = false; }
  arc.visible = !!(state.grenade && slot.id === 'grenade' && !state.hand);
  if (state.messageT > 0) state.messageT -= realDt;
}

function selectSlot(i) {
  if (i === hotbar.index) return;
  hotbar.index = i;
  state.ghostTilt = 0;
}

export function updateToolsStep(dt) {
  if (state.hold) holdStep(dt);
  if (state.hand) handStep(dt);
  if (state.grenade?.cooking) {
    state.grenade.fuse -= dt;
    if (state.grenade.fuse <= 0) {
      // cooked too long: it goes off in your hand
      const p = camera.position.clone().add(new THREE.Vector3(0.25, -0.3, -0.4).applyQuaternion(camera.quaternion));
      state.grenade = null;
      explode(p, 0.18, { shrapnel: 40 });
    }
  }
  if (!state.rpg.loaded) {
    state.rpg.reload -= dt;
    if (state.rpg.reload <= 0) state.rpg.loaded = true;
  }
  updateRockets(dt);
}

// --------------------------------------------------------------------------- spawner
function ghostMaterial(ok) {
  return ok ? ghostMaterial.ok || (ghostMaterial.ok = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.35, depthWrite: false }))
    : ghostMaterial.bad || (ghostMaterial.bad = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.35, depthWrite: false }));
}

function hideGhost() { if (ghost) ghost.visible = false; }

function spawnerFrame(slot) {
  const def = BY_ID[slot.id];
  if (!def) return;
  const isShape = def.tab === 'Shapes';
  const mat = isShape ? (state.shapeMat || def.mat) : null;
  if (isShape && input.down('sprint') && input.mouse.wheel) {
    state.size = THREE.MathUtils.clamp(state.size * (input.mouse.wheel < 0 ? 1.1 : 1 / 1.1), 0.25, 4);
  }
  const key = `${def.id}|${mat}|${state.size.toFixed(3)}`;
  if (key !== ghostKey) {
    if (ghost) { scene.remove(ghost); ghost.traverse((o) => o.geometry?.dispose()); }
    ghost = buildVisual(def, mat, state.size);
    ghost.traverse((o) => { if (o.isMesh) { o.material = ghostMaterial(true); o.renderOrder = 5; } });
    ghostBox.setFromObject(ghost, true);
    scene.add(ghost);
    ghostKey = key;
  }
  if (input.hit('reload')) state.ghostYaw += Math.PI / 4;
  if (input.mouseHit(2)) state.ghostTilt = (state.ghostTilt + 1) % 4;

  const hit = aim(60, groups(0xffff, G.STATIC | G.OBJECT));
  if (!hit) { ghost.visible = false; return; }
  ghost.visible = true;
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.ghostYaw + ctx.player.yaw * (state.snap ? 0 : 1))
    .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (state.ghostTilt * Math.PI) / 2));
  if (state.snap) {
    // snapped yaw: nearest 45° step relative to world axes
    const yaw = Math.round((state.ghostYaw) / (Math.PI / 4)) * (Math.PI / 4);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (state.ghostTilt * Math.PI) / 2));
  }
  const center = ghostBox.getCenter(new THREE.Vector3());
  const half = ghostBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const n = hit.normal;
  const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q), ay = new THREE.Vector3(0, 1, 0).applyQuaternion(q), az = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const support = Math.abs(n.dot(ax)) * half.x + Math.abs(n.dot(ay)) * half.y + Math.abs(n.dot(az)) * half.z;
  const p = hit.point.clone();
  if (state.snap) {
    const g = 0.25;
    if (Math.abs(n.y) > 0.9) { p.x = Math.round(p.x / g) * g; p.z = Math.round(p.z / g) * g; }
    else { p.y = Math.round(p.y / g) * g; if (Math.abs(n.x) > Math.abs(n.z)) p.z = Math.round(p.z / g) * g; else p.x = Math.round(p.x / g) * g; }
  }
  const worldCenter = p.addScaledVector(n, support + 0.005);
  const origin = worldCenter.clone().sub(center.clone().applyQuaternion(q));
  ghost.position.copy(origin);
  ghost.quaternion.copy(q);
  // overlap test
  let blocked = false;
  const shape = new R.Cuboid(Math.max(0.005, half.x * 0.9), Math.max(0.005, half.y * 0.9), Math.max(0.005, half.z * 0.9));
  world.intersectionsWithShape(worldCenter, q, shape, () => { blocked = true; return false; }, undefined, groups(0xffff, G.STATIC | G.OBJECT));
  ghost.traverse((o) => { if (o.isMesh) o.material = ghostMaterial(!blocked); });

  if (input.mouseHit(0) && !blocked) {
    const e = spawn(def.id, { pos: origin, quat: q, mat, size: state.size });
    if (e) { undoStack.push(e); ctx.onSpawn?.(e); }
  }
}

function undo() {
  while (undoStack.length) {
    const e = undoStack.pop();
    if (e.alive) { ctx.fx.puff(e.position(), 0x999999, e.radius, 6); removeEntity(e); say('Undo'); return; }
  }
  say('Nothing to undo');
}

// --------------------------------------------------------------------------- tools
function toolFrame(id, realDt) {
  switch (id) {
    case 'physgun': return physgunFrame();
    case 'remover': {
      const h = aim(120);
      if (input.mouseHit(0) && h?.entity && !h.entity.permanent) { ctx.fx.puff(h.entity.position(), 0xaaaaaa, h.entity.radius, 8); removeEntity(h.entity); }
      if (input.mouseHit(2) && h?.entity) { setFrozen(h.entity, !h.entity.frozen); say(h.entity.frozen ? 'Frozen' : 'Unfrozen'); }
      return;
    }
    case 'weld': return weldFrame();
    case 'painter': {
      if (input.hit('reload')) state.paintIdx = (state.paintIdx + 1) % SHAPE_MATERIALS.length;
      const h = aim(120);
      if (input.mouseHit(0) && h?.entity) {
        const m = SHAPE_MATERIALS[state.paintIdx];
        setEntityMaterial(h.entity, m);
        ctx.fx.puff(h.point, 0xffffff, 0.3, 5);
        say(`Now made of ${MATERIALS[m].name}`);
      }
      return;
    }
    case 'detonator': {
      if (input.mouseHit(0)) {
        const n = detonateAllRemote(camera.position);
        ctx.onClick?.();
        say(n ? `Detonating ${n} charge${n > 1 ? 's' : ''}` : 'No charges placed');
      }
      if (input.mouseHit(2)) {
        const h = aim(60);
        const r = h?.entity ? lightFuse(h.entity) : false;
        say(r === 'fuse' ? 'Fuse lit! Get back' : r === 'timer' ? 'Timer set: 10 s' : 'Aim at TNT or C4');
      }
      return;
    }
    case 'c4tool': {
      if (input.mouseHit(0)) {
        const h = aim(3.2);
        if (!h) { say('Get closer to stick C4'); return; }
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), h.normal);
        q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ctx.player.yaw));
        const c4 = spawn('c4', { pos: h.point.clone().addScaledVector(h.normal, 0.026), quat: q });
        if (!c4) return;
        undoStack.push(c4);
        if (h.entity && !h.entity.frozen) addJoint('stick', c4, h.point, h.entity, h.point);
        else setFrozen(c4, true);
        ctx.onClick?.();
      }
      return;
    }
    case 'grenade': return grenadeFrame(realDt);
    case 'rpg': return rpgFrame();
  }
}

// physics gun --------------------------------------------------------------
function physgunFrame() {
  if (input.mouseHit(0) && !state.hold) {
    const h = aim(250);
    if (h?.entity && !h.entity.permanent) {
      const e = h.entity;
      if (e.frozen) setFrozen(e, false);
      const local = h.point.clone().sub(e.position()).applyQuaternion(e.quaternion().invert());
      const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ctx.player.yaw, 0));
      state.hold = { e, local, dist: h.dist, rel: camQ.clone().invert().multiply(e.quaternion()) };
      e.body.setGravityScale(0, true);
      e.body.setAngularDamping(4);
    }
  }
  if (!state.hold) { beam.visible = false; ctx.player.lookLocked = false; return; }
  const H = state.hold;
  if (!H.e.alive) { releaseHold(); return; }
  if (input.mouse.wheel) H.dist = THREE.MathUtils.clamp(H.dist * (input.mouse.wheel < 0 ? 1.12 : 1 / 1.12), 1.2, 250);
  // R + mouse rotates the object instead of looking around
  ctx.player.lookLocked = input.down('reload');
  if (ctx.player.lookLocked) {
    const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ctx.player.yaw, 0));
    const wq = camQ.clone().multiply(H.rel);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), input.mouse.dx * 0.006);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0).applyQuaternion(camQ), input.mouse.dy * 0.006);
    H.rel = camQ.clone().invert().multiply(qy.multiply(qx).multiply(wq));
  }
  if (input.mouseHit(2)) { const e = H.e; releaseHold(); setFrozen(e, true); say('Frozen'); return; }
  if (input.mouseUp(0) || !input.mouseDown(0)) { releaseHold(); return; }
  // beam
  const from = camera.position.clone().add(new THREE.Vector3(0.22, -0.2, -0.35).applyQuaternion(camera.quaternion));
  const to = H.e.position().add(H.local.clone().applyQuaternion(H.e.quaternion()));
  const mid = camera.position.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), H.dist * 0.5);
  const pts = beam.geometry.attributes.position;
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const a = from.clone().lerp(mid, t), b = mid.clone().lerp(to, t);
    const p = a.lerp(b, t);
    pts.setXYZ(i, p.x, p.y, p.z);
  }
  pts.needsUpdate = true;
  beam.visible = true;
}

function holdStep(dt) {
  const H = state.hold;
  if (!H.e.alive) { state.hold = null; return; }
  const e = H.e;
  const target = camera.position.clone().addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), H.dist);
  const grab = e.position().add(H.local.clone().applyQuaternion(e.quaternion()));
  const v = target.sub(grab).multiplyScalar(14);
  if (v.length() > 60) v.setLength(60);
  e.body.setLinvel(v, true);
  const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ctx.player.yaw, 0));
  const want = camQ.multiply(H.rel);
  const dq = want.multiply(e.quaternion().invert());
  if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
  const angle = 2 * Math.acos(Math.min(1, dq.w));
  const s = Math.sqrt(1 - dq.w * dq.w);
  const axis = s > 1e-4 ? new THREE.Vector3(dq.x / s, dq.y / s, dq.z / s) : new THREE.Vector3();
  e.body.setAngvel(axis.multiplyScalar(Math.min(angle * 10, 25)), true);
}

function releaseHold() {
  const H = state.hold;
  if (H?.e.alive) { H.e.body.setGravityScale(1, true); H.e.body.setAngularDamping(0.08); }
  state.hold = null;
  beam.visible = false;
  ctx.player.lookLocked = false;
}

// connector tool ----------------------------------------------------------
function weldFrame() {
  if (input.hit('reload')) { state.weldMode = (state.weldMode + 1) % WELD_MODES.length; state.weldA = null; marker.visible = false; }
  const mode = WELD_MODES[state.weldMode];
  const h = aim(60);
  if (input.mouseHit(2) && h?.entity) {
    const n = h.entity.joints.size;
    for (const j of [...h.entity.joints]) removeJoint(j);
    say(n ? `Removed ${n} connection${n > 1 ? 's' : ''}` : 'Nothing connected');
  }
  if (!input.mouseHit(0) || !h) return;
  if (!state.weldA) {
    if (!h.entity) { say('Click an object first'); return; }
    state.weldA = { e: h.entity, point: h.point.clone(), normal: h.normal.clone(), mat: h.part.mat };
    marker.position.copy(h.point); marker.visible = true;
    say(`${JOINT_TYPES[mode].name}: now click what to attach it to`);
    return;
  }
  const A = state.weldA;
  if (!A.e.alive || h.entity === A.e) { state.weldA = null; marker.visible = false; return; }
  const matB = h.part?.mat || 'concrete';
  const isMetal = (m) => m === 'steel' || m === 'aluminum';
  const isWood = (m) => m === 'wood' || m === 'plywood';
  if (mode === 'weld' && !(isMetal(A.mat) && (isMetal(matB) || !h.entity))) { say('Welding only works on metal. Try Glue or Nails.'); return; }
  if (mode === 'nails' && !(isWood(A.mat) || isWood(matB))) { say('Nails need wood. Try Glue or Weld.'); return; }
  addJoint(mode, A.e, A.point, h.entity, A.point, A.normal);
  if (mode === 'weld') ctx.fx.impactSparks(A.point, A.normal, 18, 3);
  else ctx.fx.puff(A.point, 0xcccccc, 0.08, 3);
  ctx.onClick?.();
  say(`${JOINT_TYPES[mode].name}ed!`.replace('Hingeed', 'Hinged').replace('Nailsed', 'Nailed').replace('Glueed', 'Glued'));
  state.weldA = null;
  marker.visible = false;
}

// grenade -----------------------------------------------------------------
function grenadeFrame(realDt) {
  if (input.mouseHit(0) && !state.grenade) state.grenade = { charge: 0, cooking: false, fuse: rnd(4.0, 5.0) };
  const g = state.grenade;
  if (!g) return;
  if (input.mouseDown(0)) g.charge = Math.min(1, g.charge + realDt / 0.9);
  if (input.mouseHit(2) && !g.cooking) { g.cooking = true; say('Spoon off: it\'s cooking!'); ctx.onClick?.(); }
  const { pos, vel } = throwParams(g.charge);
  // arc preview
  const p = arc.geometry.attributes.position;
  const pp = pos.clone(), vv = vel.clone();
  for (let i = 0; i < 40; i++) {
    p.setXYZ(i, pp.x, pp.y, pp.z);
    pp.addScaledVector(vv, 0.05); vv.y -= 9.81 * 0.05;
  }
  p.needsUpdate = true;
  arc.computeLineDistances();
  if (input.mouseUp(0)) {
    const e = spawnGrenade(pos, vel, g.fuse);
    if (e) undoStack.push(e);
    state.grenade = null;
  }
}

function throwParams(charge) {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  dir.y += 0.12; dir.normalize();
  const pos = camera.position.clone().add(new THREE.Vector3(0.25, -0.15, -0.45).applyQuaternion(camera.quaternion));
  const vel = dir.multiplyScalar(6 + charge * 14).add(ctx.player.vel.clone().multiplyScalar(0.8));
  return { pos, vel };
}

function cancelGrenade() { state.grenade = null; arc.visible = false; }

function grenadeParts() {
  const body = sphere(0.032, 16); body.scale(1, 1.18, 1);
  return [{
    shape: { type: 'ball', r: 0.034 }, mat: 'steel', pos: [0, 0, 0], rot: [0, 0, 0], mass: 0.4,
    meshes: [
      { geo: body, mat: 'steel', paint: 0x4a5236, roughness: 0.7, metalness: 0.3 },
      { geo: merge([translate(cyl(0.012, 0.014, 0.022, 10), 0, 0.044, 0), translate(box(0.012, 0.075, 0.006), 0.022, 0.01, 0)]), mat: 'steel', paint: 0x6d6f5a, roughness: 0.5 },
    ],
  }];
}

function spawnGrenade(pos, vel, fuse) {
  const e = spawn(null, { pos, vel, angVel: { x: rnd(-8, 8), y: rnd(-4, 4), z: rnd(-8, 8) }, ccd: true, parts: grenadeParts() });
  if (!e) return null;
  e.defId = 'grenade';
  e.label = 'Frag Grenade';
  e.explosive = { kind: 'grenade', power: 0.18, shrapnel: 45, countdown: fuse };
  e.parts[0].collider.setRestitution(0.3);
  ctx.onClick?.();
  return e;
}

// rocket launcher ---------------------------------------------------------
function rpgFrame() {
  if (input.hit('reload') && !state.rpg.loaded && state.rpg.reload <= 0) state.rpg.reload = 2.8;
  if (!input.mouseHit(0)) return;
  if (!state.rpg.loaded) { say(state.rpg.reload > 0 ? 'Reloading...' : 'Press R to reload'); return; }
  state.rpg.loaded = false;
  state.rpg.reload = 2.8;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const pos = camera.position.clone().add(new THREE.Vector3(0.18, -0.1, -0.7).applyQuaternion(camera.quaternion));
  const mesh = rocketMesh();
  mesh.position.copy(pos);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), fwd);
  scene.add(mesh);
  state.rockets.push({ pos, vel: fwd.clone().multiplyScalar(115).add(ctx.player.vel), fwd, t: 0, mesh });
  // launch flash + backblast cone behind you
  const back = fwd.clone().negate();
  const tail = camera.position.clone().addScaledVector(back, 0.6);
  ctx.fx.flash(pos, 600, 0.08, 0xffc080, 15);
  for (let i = 0; i < 30; i++) {
    const d = back.clone().add(new THREE.Vector3(rnd(-0.4, 0.4), rnd(-0.3, 0.4), rnd(-0.4, 0.4))).normalize();
    ctx.fx.smoke.emit({ pos: tail, vel: d.multiplyScalar(rnd(6, 16)), life: rnd(1.5, 3.5), size: 0.3, size1: rnd(1.5, 2.6), color: 0xbdb7ad, alpha: 0.5, alpha1: 0, drag: 2.5, gravity: 0.3 });
  }
  for (const e of entities.values()) {
    const to = e.position().sub(camera.position);
    const d = to.length();
    if (d > 5 || to.normalize().dot(back) < 0.6 || e.frozen) continue;
    applyImpulseAt(e, back.clone().multiplyScalar(Math.min(e.mass * 8, 120) * (1 - d / 5)), e.position());
  }
  ctx.player.pitch += 0.035;
  ctx.fx.addTrauma(0.25);
  ctx.onRpgFire?.();
}

function rocketMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(rotate(cyl(0.022, 0.022, 0.6, 12), Math.PI / 2, 0, 0), getMaterial('steel', { color: 0x4f5546, roughness: 0.6 }));
  const head = new THREE.Mesh(translate(rotate(cyl(0.0, 0.042, 0.28, 14), -Math.PI / 2, 0, 0), 0, 0, -0.42), getMaterial('steel', { color: 0x59604a, roughness: 0.5 }));
  g.add(body, head);
  return g;
}

function updateRockets(dt) {
  for (let i = state.rockets.length - 1; i >= 0; i--) {
    const r = state.rockets[i];
    r.t += dt;
    if (r.t > 0.12) r.vel.addScaledVector(r.fwd, 260 * dt * (r.t < 0.6 ? 1 : 0)); // sustainer motor
    r.vel.y -= 9.81 * 0.35 * dt;
    const step = r.vel.clone().multiplyScalar(dt);
    const len = step.length();
    const hit = world.castRayAndGetNormal(new R.Ray(r.pos, step.clone().normalize()), len, true, undefined, groups(0xffff, G.STATIC | G.OBJECT | G.DEBRIS), ctx.player.collider);
    if (hit || r.t > 4.6) {
      const p = hit ? r.pos.clone().addScaledVector(step.normalize(), Math.max(0, hit.timeOfImpact - 0.05)) : r.pos.clone();
      scene.remove(r.mesh);
      state.rockets.splice(i, 1);
      explode(p, 0.6, { shrapnel: 30 });
      continue;
    }
    r.pos.add(step);
    r.mesh.position.copy(r.pos);
    r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), r.vel.clone().normalize());
    const tail = r.pos.clone().addScaledVector(r.vel.clone().normalize(), -0.35);
    ctx.fx.fire.emit({ pos: tail, life: 0.05, size: 0.25, size1: 0.1, color: new THREE.Color(1, 0.75, 0.4).multiplyScalar(6), alpha: 1, alpha1: 0 });
    ctx.fx.smoke.emit({ pos: tail, vel: new THREE.Vector3(rnd(-0.3, 0.3), rnd(0, 0.4), rnd(-0.3, 0.3)), life: rnd(2, 4), size: 0.15, size1: rnd(0.8, 1.4), color: 0xd6d3cc, alpha: 0.45, alpha1: 0, drag: 1.2, gravity: 0.2 });
  }
}

// hands (F) ---------------------------------------------------------------
const MAX_LIFT = 30; // kg a person can comfortably carry in front of them

function togglePickup() {
  if (state.hand) { dropHand(0); return; }
  const h = aim(2.6, groups(0xffff, G.OBJECT | G.DEBRIS | G.STATIC));
  if (!h?.entity || h.entity.frozen) { say('Nothing to pick up'); return; }
  const e = h.entity;
  if (e.mass > MAX_LIFT) { say(`Too heavy to lift (${e.mass >= 1000 ? (e.mass / 1000).toFixed(1) + ' t' : Math.round(e.mass) + ' kg'})`); return; }
  releaseHold();
  const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ctx.player.yaw, 0));
  state.hand = { e, rel: camQ.invert().multiply(e.quaternion()), charge: 0 };
  e.body.setAngularDamping(5);
  hideGhost();
}

function handFrame(realDt) {
  const H = state.hand;
  if (!H.e.alive) { state.hand = null; return; }
  if (input.mouseDown(0)) H.charge = Math.min(1, H.charge + realDt / 0.8);
  if (input.mouseUp(0)) dropHand(H.charge);
}

function handStep(dt) {
  const H = state.hand;
  if (!H || !H.e.alive) { state.hand = null; return; }
  const e = H.e;
  const target = camera.position.clone().add(new THREE.Vector3(0, -0.15, -0.6 - e.radius).applyQuaternion(camera.quaternion));
  const to = target.sub(e.position());
  // heavier things lag behind your hands
  const gain = 16 * (1 - (e.mass / MAX_LIFT) * 0.6);
  const v = to.multiplyScalar(gain);
  if (v.length() > 12) v.setLength(12);
  e.body.setLinvel(v, true);
  if (to.length() > 1.6) { dropHand(0); return; }
  const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ctx.player.yaw, 0));
  const dq = camQ.multiply(H.rel).multiply(e.quaternion().invert());
  if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
  const angle = 2 * Math.acos(Math.min(1, dq.w)), s = Math.sqrt(1 - dq.w * dq.w);
  if (s > 1e-4) e.body.setAngvel({ x: (dq.x / s) * angle * 8, y: (dq.y / s) * angle * 8, z: (dq.z / s) * angle * 8 }, true);
}

function dropHand(charge) {
  const H = state.hand;
  state.hand = null;
  if (!H?.e.alive) return;
  H.e.body.setAngularDamping(0.08);
  if (charge > 0.05) {
    const speed = Math.min(16, (2 + charge * 11) * Math.sqrt(4 / Math.max(0.5, H.e.mass)));
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    H.e.body.setLinvel(dir.multiplyScalar(speed).add(ctx.player.vel), true);
    H.e.body.setAngvel({ x: rnd(-3, 3), y: rnd(-3, 3), z: rnd(-3, 3) }, true);
  }
}

// --------------------------------------------------------------------------- HUD text
export function toolStatus() {
  const slot = hotbar.current;
  let line = '';
  const aimed = aim(80);
  const looking = aimed?.entity ? describe(aimed.entity) : '';
  if (state.hand) line = `Holding ${describe(state.hand.e)} · LMB throw (hold for power) · F drop`;
  else if (slot.kind === 'item') {
    const def = BY_ID[slot.id];
    const mat = def.tab === 'Shapes' ? MATERIALS[state.shapeMat || def.mat].name + ' ' : '';
    line = `${mat}${def.name}${def.tab === 'Shapes' ? ` ×${state.size.toFixed(2)}` : ''} · LMB place · R rotate · RMB tilt · G snap ${state.snap ? 'on' : 'off'}${def.tab === 'Shapes' ? ' · Shift+scroll size' : ''}`;
  } else {
    const t = BY_ID[slot.id];
    if (slot.id === 'weld') line = `${t.name}: ${JOINT_TYPES[WELD_MODES[state.weldMode]].name} (R to change) · RMB remove connections`;
    else if (slot.id === 'painter') line = `${t.name}: ${MATERIALS[SHAPE_MATERIALS[state.paintIdx]].name} (R to change)`;
    else if (slot.id === 'rpg') line = `${t.name} · ${state.rpg.loaded ? 'loaded' : state.rpg.reload > 0 ? 'reloading...' : 'empty (R)'}`;
    else if (slot.id === 'grenade' && state.grenade) line = `${state.grenade.cooking ? `COOKING ${state.grenade.fuse.toFixed(1)}s` : 'Pin pulled · RMB to cook'} · release to throw`;
    else line = `${t.name} · ${t.desc}`;
  }
  return { line, looking: state.messageT > 0 ? state.message : looking };
}

export function resetTools() {
  releaseHold();
  state.hand = null;
  state.grenade = null;
  for (const r of state.rockets) scene.remove(r.mesh);
  state.rockets = [];
  undoStack.length = 0;
}
