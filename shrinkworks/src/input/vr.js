// VR on Quest 3 (WebXR in its browser). Your real hands: grab anything with the grip button, move your real hand, let
// go and it drops or flies (real physics, real weight: small you is weak). Tools work with the trigger: glue, wire,
// pliers, spray paint. Any build you hold by its handle becomes a gadget: the trigger fires it.
// Left stick walks, right stick turns (left / right) and shrinks / grows you (down / up). Trigger with an empty hand = jetpack.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { XRHandMeshModel } from 'three/examples/jsm/webxr/XRHandMeshModel.js';
import { renderer, scene, camera, rig, setQuality } from '../core/render.js';
import { R, world, owners, G, groups, toV, toQ, fromQ } from '../core/physics.js';
import { assetURL, track } from '../core/assets.js';
import { player, movePlayer, setPlayerScale, playerHeight, SIZE_MIN, SIZE_MAX } from '../player/player.js';
import { undo, begin, commit, recordNew } from '../tools/tools.js';
import { bodies, partsById, constructOf, constructMass, setFrozen, newBody, addPart, glueBodies, wire, unwire, wires, detachPart,
  breakJoint, rebuildPart, bodyPose, partWorld, bumpTopo, topo, createJointChild, evenScale, atNormalSize } from '../build/core.js';
import { setController } from '../build/powered.js';
import { loop } from '../core/audio.js';
import { worldPos, worldQuat } from '../parts/rt.js';
import { DEFS } from '../parts/defs.js';
import * as menus from '../ui/menus.js';
import { createPanel, drawMenu, hitTest } from '../ui/vrpanel.js';
import { game, U } from '../game.js';

export const vrSession = { supported: false, active: false, enter: () => {} };
let hooks = null;
const hands = [];
let handGLB = {};
const panel = createPanel(1.15);
const wristCanvas = document.createElement('canvas');
let wrist = null, wristT = 0;
let toastPlane = null, toastT = 0;
const K = () => U * player.scale; // how big your real hands and head are in game units
// first-time tips (each one shows once, ever)
let tipsDone = {};
try { tipsDone = JSON.parse(localStorage.getItem('shrinkworks.tips') || '{}'); } catch (e) { tipsDone = {}; }
function tip(id, text) {
  if (tipsDone[id]) return;
  tipsDone[id] = 1;
  try { localStorage.setItem('shrinkworks.tips', JSON.stringify(tipsDone)); } catch (e) { /* private window */ }
  setTimeout(() => game.toast(text), 300);
}

export function initVR(h) {
  hooks = h;
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then((s) => { vrSession.supported = s; if (s && menus.top() && menus.top().id === 'title') menus.refresh(); }).catch(() => {});
  }
  vrSession.enter = enter;
  const loader = new GLTFLoader();
  for (const side of ['left', 'right']) track(loader.loadAsync(assetURL('models/hand-' + side + '.glb')).then((g) => { handGLB[side] = g; }), 0.3);
  for (let i = 0; i < 2; i++) {
    const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i), xhand = renderer.xr.getHand(i);
    rig.add(ray, grip, xhand);
    const H = { i, side: null, ray, grip, xhand, source: null, ctlHand: null, trackedHand: null, phys: null, held: null,
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(), prev: new THREE.Vector3(), prevQ: new THREE.Quaternion(),
      vel: new THREE.Vector3(), avel: new THREE.Vector3(), vels: [], trig: 0, trigEdge: false, pokeT: 0, wireFrom: null, glueT: 0, paintT: 0, cutHint: 0 };
    hands.push(H);
    ray.addEventListener('connected', (e) => onConnect(H, e.data));
    ray.addEventListener('disconnected', () => { dropHeld(H); H.source = null; H.side = null; });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    line.visible = false;
    ray.add(line);
    H.line = line;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.visible = false;
    scene.add(dot);
    H.dot = dot;
    // the wire you are laying (from the first part to the spool)
    const wl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xc87533 }));
    wl.visible = false; wl.frustumCulled = false;
    scene.add(wl);
    H.wireLine = wl;
  }
  scene.add(panel.mesh);
  panel.onClose = () => { menus.closeAll(); };
  wristCanvas.width = 512; wristCanvas.height = 384;
  const wt = new THREE.CanvasTexture(wristCanvas); wt.colorSpace = THREE.SRGBColorSpace;
  wrist = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.0975), new THREE.MeshBasicMaterial({ map: wt, transparent: true, toneMapped: false }));
  wrist.userData.tex = wt;
  wrist.visible = false;
  wrist.renderOrder = 31;
  const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 128;
  const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
  toastPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), new THREE.MeshBasicMaterial({ map: tt, transparent: true, toneMapped: false, depthTest: false }));
  toastPlane.position.set(0, -0.3, -1.1);
  toastPlane.renderOrder = 40;
  toastPlane.visible = false;
  toastPlane.userData = { c: tc, t: tt };
  camera.add(toastPlane);
  // a dark veil for when you get knocked out
  const veil = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
  veil.renderOrder = 50; veil.visible = false;
  camera.add(veil);
  game.vrVeil = veil;
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xaa0000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
  red.renderOrder = 49; red.visible = false;
  camera.add(red);
  game.vrRed = red;
  const pcToast = game.toast;
  game.toast = (msg, ms) => { if (game.inVR) vrToast(msg); else pcToast(msg, ms); };
  menus.onMenuChange(() => { if (game.inVR) placePanel(); });
  game.heldBodies = heldBodies;
  game.handTouching = handTouching;
  game.vrHands = hands;
  game.vrDots = dots;
  game.vrPanel = panel;
  game.spawnInHand = spawnInHand;
  game.vrHoldStep = holdStep;
  game.vrDropAll = () => { for (const H of hands) dropHeld(H); };
}

async function enter() {
  if (!navigator.xr) { game.toast('This browser has no VR. Open the game link in the Quest 3 browser.'); return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
    renderer.xr.setFramebufferScaleFactor(1);
    await renderer.xr.setSession(session);
    renderer.xr.setFoveation(0.6);
    vrSession.active = true;
    game.inVR = true;
    hooks.start();
    setQuality('low', true); // Quest: keep 72+ fps
    tip('welcome', 'Grip button = grab. Try the glue bottle on the island');
    session.addEventListener('end', () => {
      vrSession.active = false; game.inVR = false;
      for (const H of hands) dropHeld(H);
      panel.mesh.visible = false;
      rig.scale.setScalar(1);
      setQuality('medium', true);
      hooks.end();
    });
  } catch (e) {
    game.toast('VR could not start: ' + (e.message || e));
  }
}

function onConnect(H, source) {
  H.source = source;
  H.side = source.handedness;
  if (source.hand) {
    if (!H.trackedHand) {
      const fake = { load: (url, cb) => { const g = handGLB[url.includes('left') ? 'left' : 'right']; if (g) cb(g); } };
      const holder = new THREE.Group();
      H.xhand.add(holder);
      H.trackedHand = new XRHandMeshModel(holder, H.xhand, '', H.side, fake);
      H.trackedHolder = holder;
    }
  } else if (!H.ctlHand && handGLB[H.side]) {
    H.ctlHand = makeControllerHand(H.side);
    H.grip.add(H.ctlHand.root);
  }
  if (!H.phys) makePhysHand(H);
  if (H.side === 'left' && wrist.parent !== H.grip) { H.grip.add(wrist); wrist.position.set(0.0, 0.035, 0.1); wrist.rotation.set(-1.15, 0, 0); }
}

/* ---------------- a hand model held on a controller: fingers curl with grip and trigger ---------------- */
const FINGERS = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
function makeControllerHand(side) {
  const g = handGLB[side];
  const root = new THREE.Group();
  const model = g.scene.clone(true);
  const skinned = [];
  model.traverse((o) => { if (o.isSkinnedMesh) { skinned.push(o); o.frustumCulled = false; o.castShadow = true; } });
  const byName = {};
  model.traverse((o) => { if (o.isBone || o.type === 'Bone' || /finger|thumb|wrist/.test(o.name)) byName[o.name] = o; });
  for (const s of skinned) {
    const bones = s.skeleton.bones.map((b) => byName[b.name] || b);
    s.bind(new THREE.Skeleton(bones, s.skeleton.boneInverses), s.bindMatrix);
  }
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8a383, roughness: 0.55, metalness: 0 });
  for (const s of skinned) s.material = mat;
  const open = {}, fist = {};
  for (const n in byName) open[n] = { p: byName[n].position.clone(), q: byName[n].quaternion.clone() };
  for (const f of FINGERS) {
    const chain = f === 'thumb' ? ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip']
      : [f + '-metacarpal', f + '-phalanx-proximal', f + '-phalanx-intermediate', f + '-phalanx-distal', f + '-tip'];
    if (!chain.every((n) => open[n])) continue;
    const cur = chain.map((n) => ({ n, p: open[n].p.clone(), q: open[n].q.clone() }));
    const angles = f === 'thumb' ? [0.3, 0.45, 0.55] : [0.1, 1.2, 1.35, 0.85];
    for (let j = 0; j < angles.length && j < cur.length - 1; j++) {
      const pv = cur[j].p.clone();
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(cur[j].q).normalize();
      const rq = new THREE.Quaternion().setFromAxisAngle(axis, -angles[j]);
      cur[j].q.premultiply(rq);
      for (let k = j + 1; k < cur.length; k++) { cur[k].p.sub(pv).applyQuaternion(rq).add(pv); cur[k].q.premultiply(rq); }
    }
    for (const c of cur) fist[c.n] = { p: c.p, q: c.q };
  }
  root.add(model);
  model.rotation.set(-0.95, 0, 0);
  model.position.set(side === 'left' ? 0.01 : -0.01, -0.02, 0.08);
  return {
    root, set(trigger, squeeze) {
      for (const n in byName) {
        const o = open[n], f = fist[n];
        if (!f) continue;
        const k = n.startsWith('index') ? trigger : n.startsWith('thumb') ? Math.max(trigger, squeeze) * 0.7 : squeeze;
        byName[n].position.lerpVectors(o.p, f.p, k);
        byName[n].quaternion.slerpQuaternions(o.q, f.q, k);
      }
    }
  };
}

/* ---------------- physics hands: push and poke things ---------------- */
// your hand is a real (light) body that chases your controller: it pushes things, but it can't crush a gadget into the
// counter with infinite force (a kinematic hand would rip glued parts off just by pressing on them)
function makePhysHand(H) {
  const rb = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0, -50, 0).setGravityScale(0).lockRotations()
    .setLinearDamping(0).setCcdEnabled(true).setCanSleep(false));
  H.phys = { rb, c: null, r: 0 };
  sizePhysHand(H);
}
function sizePhysHand(H) {
  const r = 0.045 * K();
  if (H.phys.c && Math.abs(r - H.phys.r) < H.phys.r * 0.08) return;
  if (H.phys.c) { owners.delete(H.phys.c.handle); world.removeCollider(H.phys.c, false); }
  // a real hand weighs about 0.5 kg (game mass: 1000 per kg), less when you are small
  const vol = 4 / 3 * Math.PI * r * r * r, mass = 500 * Math.pow(player.scale, 3);
  H.phys.c = world.createCollider(R.ColliderDesc.ball(r).setDensity(mass / vol).setFriction(0.8).setRestitution(0)
    .setCollisionGroups(groups(G.HAND, G.PARTS | G.DEBRIS)), H.phys.rb);
  owners.set(H.phys.c.handle, { kind: 'hand' });
  H.phys.r = r;
}
function drivePhysHands(dt) {
  for (const H of hands) {
    if (!H.phys || !H.source) continue;
    const rb = H.phys.rb, t = rb.translation();
    const d = _v.set(H.pos.x - t.x, H.pos.y - t.y, H.pos.z - t.z);
    // too far behind your real hand (stuck on something, or you just turned): jump to it
    if (d.length() > H.phys.r * 6 || dt <= 0) { rb.setTranslation(H.pos, true); rb.setLinvel({ x: 0, y: 0, z: 0 }, true); continue; }
    d.multiplyScalar(0.9 / dt);
    const max = 250 * Math.max(0.1, player.scale);
    if (d.length() > max) d.setLength(max);
    // real arm strength: the hand speeds up / slows down only so fast (pushing a heavy thing, it lags behind)
    const lv = rb.linvel(), dv = _v2.set(d.x - lv.x, d.y - lv.y, d.z - lv.z), cap = 22 * Math.max(0.1, player.scale);
    if (dv.length() > cap) dv.setLength(cap);
    rb.setLinvel({ x: lv.x + dv.x, y: lv.y + dv.y, z: lv.z + dv.z }, true);
  }
}
// builds your hands are touching right now (they never break from you pressing on them)
function handTouching() {
  const s = new Set();
  for (const H of hands) {
    if (!H.phys || !H.phys.c || !H.phys.c.isEnabled()) continue;
    world.contactPairsWith(H.phys.c, (c2) => { const o = owners.get(c2.handle); if (o && o.kind === 'part') for (const b of constructOf(o.ref.body)) s.add(b); });
  }
  return s;
}
function pulse(H, v, ms) {
  const gp = H.source && H.source.gamepad;
  if (gp && gp.hapticActuators && gp.hapticActuators[0]) { try { gp.hapticActuators[0].pulse(v, ms); } catch (e) { /* no rumble */ } }
}

/* ---------------- grabbing ---------------- */
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
// your strength: a real adult lifts about 30 kg with one hand. Strength drops with size cubed (no ant powers).
export function liftLimit() { return 30000 * Math.pow(player.scale, 3); }
function heldBodies() {
  const s = new Set();
  for (const H of hands) if (H.held) { const p = partsById.get(H.held.id); if (p) for (const b of constructOf(p.body)) s.add(b); }
  return s;
}
function nearestPart(at, r, exclude, prefer) {
  let best = null, bd = Infinity;
  world.intersectionsWithShape(at, { x: 0, y: 0, z: 0, w: 1 }, new R.Ball(r), (c) => {
    const o = owners.get(c.handle);
    if (o && o.kind === 'part' && !o.ref.dead && o.ref !== exclude && (!exclude || o.ref.body !== exclude.body)) {
      const d = partWorld(o.ref, _v2).distanceTo(at) - (prefer && prefer(o.ref) ? 1e6 : 0);
      if (d < bd) { bd = d; best = o.ref; }
    }
    return true;
  }, undefined, groups(G.WORLD, G.PARTS));
  return best;
}
// the pose a held part keeps relative to your hand (tools + handles snap into your fist, the rest stays the way you grabbed it)
function holdPose(H, p) {
  const d = p.def, k = K();
  if (d.gripQ && d.grip) {
    const q = d.gripQ.clone();
    const g = scaledPoint(p, d.grip);
    return { pos: g.applyQuaternion(q).negate(), quat: q, snap: true };
  }
  const pq = worldQuat(p, _q2), pp = worldPos(p, _v2);
  const inv = H.quat.clone().invert();
  return { pos: pp.clone().sub(H.pos).applyQuaternion(inv).divideScalar(k), quat: inv.multiply(pq), snap: false, k };
}
// a tool's grip / tip point at whatever size the tool is now
function scaledPoint(p, fn) {
  const r = evenScale(p);
  return r === 1 ? fn(p).clone() : atNormalSize(p, () => fn(p).clone()).multiplyScalar(r);
}
function tryGrab(H) {
  const k = K();
  // a grip handle or a tool counts first if it is within reach (you hold gadgets by their handle, like real ones)
  let p = nearestPart(H.pos, 0.075 * k, null, (q) => q.def.handle || q.def.tool);
  if (!p) return false;
  if (p.rotorBase && !p.def.handle) { /* grabbing the moving half of a joint is fine: it is its own body */ }
  const set = constructOf(p.body);
  const twoHands = hands.some((o) => o !== H && o.held && partsById.get(o.held.id) && set.has(partsById.get(o.held.id).body));
  if (twoHands) tip('two', 'Both hands on it: pull apart = bigger, push together = smaller');
  const wasFrozen = [...set].some((b) => b.frozen);
  for (const b of set) if (b.frozen) setFrozen(b, false);
  const pose = holdPose(H, p);
  const other = hands.find((o) => o !== H && o.held && partsById.get(o.held.id) && set.has(partsById.get(o.held.id).body));
  H.held = { id: p.id, pose, freeze: wasFrozen || !!(other && other.held.freeze), heavy: false };
  if (H.phys && H.phys.c) H.phys.c.setEnabled(false);
  pulse(H, 0.35, 30);
  game.sound('soft', H.pos, 0.35, player.scale < 0.3 ? 1.5 : 1);
  if (p.def.tool === 'glue') tip('glue', 'Trigger squeezes a glue drop onto whatever the nozzle touches');
  else tip('grab', 'Let go and it drops. Throw it like for real');
  return true;
}
function dropHeld(H, throwIt = true) {
  const h = H.held;
  H.held = null;
  if (H.phys && H.phys.c) H.phys.c.setEnabled(true);
  H.wireFrom = null;
  if (!h) return;
  const p = partsById.get(h.id);
  if (!p || p.dead) return;
  const set = constructOf(p.body);
  // still held by the other hand: nothing changes
  for (const o of hands) if (o.held && o.held.id !== undefined) { const q = partsById.get(o.held.id); if (q && set.has(q.body)) return; }
  if (h.freeze) {
    for (const b of set) { b.rb.setLinvel({ x: 0, y: 0, z: 0 }, false); b.rb.setAngvel({ x: 0, y: 0, z: 0 }, false); setFrozen(b, true); }
    game.sound('snap', worldPos(p, _v), 0.3, 1.6);
    return;
  }
  if (throwIt && !h.heavy) {
    // let go = it keeps your hand's real speed (throwing works like real life)
    const b = p.body;
    const v = averageVel(H);
    b.rb.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    b.rb.setAngvel({ x: H.avel.x * 0.8, y: H.avel.y * 0.8, z: H.avel.z * 0.8 }, true);
  }
}
function averageVel(H) {
  _v.set(0, 0, 0);
  if (!H.vels.length) return _v;
  for (const v of H.vels) _v.add(v);
  return _v.divideScalar(H.vels.length);
}

// every physics step: held things chase your hand (with your real strength), tools + gadgets get your trigger
const _tp = new THREE.Vector3(), _tq = new THREE.Quaternion(), _bp = new THREE.Vector3(), _bq = new THREE.Quaternion();
function holdStep(dt, gravity) {
  const k = K();
  drivePhysHands(dt);
  const driven = new Set();
  for (const H of hands) {
    const h = H.held;
    if (!h) continue;
    const p = partsById.get(h.id);
    if (!p || p.dead) { dropHeld(H, false); continue; }
    const b = p.body;
    if (b.frozen) { // glued to the counter while you held it: it stays, you let go
      H.held = null; if (H.phys && H.phys.c) H.phys.c.setEnabled(true);
      pulse(H, 0.8, 80); game.toast('Glued in place'); continue;
    }
    // where the part should be: your hand pose x the grab pose
    // tools + handles keep their own size in your fist; other things keep where you grabbed them (in hand-sized steps)
    _tq.copy(H.quat).multiply(h.pose.quat);
    _tp.copy(h.pose.pos).multiplyScalar(h.pose.snap ? 1 : k).applyQuaternion(H.quat).add(H.pos);
    // -> where the body has to be (the part sits somewhere on its body)
    _bq.copy(_tq).multiply(_q.copy(p.quat).invert());
    _bp.copy(p.pos).applyQuaternion(_bq).negate().add(_tp);
    // both hands on the same build: it goes halfway between where each hand wants it
    if (driven.has(b)) continue;
    driven.add(b);
    const O = hands.find((o) => o !== H && o.held && partsById.get(o.held.id) && partsById.get(o.held.id).body === b);
    if (O) {
      const op = partsById.get(O.held.id);
      const oq = O.quat.clone().multiply(O.held.pose.quat);
      const ot = O.held.pose.pos.clone().multiplyScalar(O.held.pose.snap ? 1 : k).applyQuaternion(O.quat).add(O.pos);
      const obq = oq.clone().multiply(op.quat.clone().invert());
      const obp = op.pos.clone().applyQuaternion(obq).negate().add(ot);
      _bp.lerp(obp, 0.5);
      _bq.slerp(obq, 0.5);
    }
    const set = constructOf(b);
    const mass = constructMass(set);
    const limit = liftLimit();
    const strong = mass <= limit;
    h.heavy = !strong;
    const cur = toV(b.rb.translation(), _v), cq = toQ(b.rb.rotation(), _q2);
    const lv = b.rb.linvel(), av = b.rb.angvel();
    // velocity that gets there this step (gravity pre-cancelled so it does not sag)
    const want = _bp.clone().sub(cur).multiplyScalar(0.92 / Math.max(dt, 1e-3));
    want.y -= gravity * dt * b.rb.gravityScale();
    // turn the BODY so the part you hold ends up the way your hand holds it (parts can sit at any angle on their body)
    const dq = _bq.clone().multiply(cq.clone().invert());
    if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
    const ang = 2 * Math.acos(Math.min(1, dq.w)), sn = Math.sqrt(1 - dq.w * dq.w);
    const wantW = sn > 1e-5 ? new THREE.Vector3(dq.x / sn, dq.y / sn, dq.z / sn).multiplyScalar(ang * 0.85 / Math.max(dt, 1e-3)) : new THREE.Vector3();
    const maxV = 260 * Math.max(0.15, player.scale);
    if (want.length() > maxV) want.setLength(maxV);
    if (wantW.length() > 40) wantW.setLength(40);
    if (dt === 0) {
      // time is stopped (Time Core): you are not, so what you hold still moves with your hand
      b.rb.setTranslation(_bp, false); b.rb.setRotation(fromQ(_bq), false);
      game.snapBody(b);
    } else if (strong) {
      b.rb.setLinvel(want, true);
      b.rb.setAngvel(wantW, true);
    } else {
      // too heavy for you: you can only pull as hard as your arm can (it drags, tips, or does not move)
      const f = limit / mass;
      const dv = want.clone().sub(_v2.set(lv.x, lv.y, lv.z));
      const maxDv = Math.abs(gravity) * 1.4 * f * dt;
      if (dv.length() > maxDv) dv.setLength(maxDv);
      b.rb.setLinvel({ x: lv.x + dv.x, y: lv.y + dv.y, z: lv.z + dv.z }, true);
      const dw = wantW.sub(_v2.set(av.x, av.y, av.z)).multiplyScalar(Math.min(1, f));
      b.rb.setAngvel({ x: av.x + dw.x, y: av.y + dw.y, z: av.z + dw.z }, true);
      // it slipped out of your hand
      if (cur.distanceTo(_bp) > 0.4 * k) { dropHeld(H, false); pulse(H, 0.6, 60); game.toast('Too heavy for you at this size'); continue; }
    }
    // gadget: your trigger drives everything on Auto / Key 1 in the build
    if (!p.def.tool) {
      const handle = [...b.parts].find((q) => q.def.handle) || p;
      handle.st.trig = H.trig;
      setController(handle, { drive: 0, steer: 0, lift: 0, pitch: 0, roll: 0, held: new Set(H.trig > 0.5 ? ['k1'] : []), edges: new Set(H.trigEdge ? ['k1'] : []), hand: H.trig });
    }
  }
  for (const H of hands) H.trigEdge = false;
}

/* ---------------- spawning straight into your hand ---------------- */
function spawnInHand(type, which) {
  const d = DEFS[type];
  if (!d) return null;
  const H = hands.find((h) => h.side === (which || 'right') && h.source && !h.held) || hands.find((h) => h.source && !h.held);
  const k = K();
  // small you gets parts made at your size (a 10 cm block would be a building to you), so you can build at any size
  const sc = player.scale < 0.7 ? player.scale : 1;
  const size = new THREE.Vector3(...d.size).multiplyScalar(sc);
  // put it in your fist the way you would hold it (tools + handles), or just in front of your palm
  const stub = { def: d, size, props: Object.fromEntries(d.props.map((x) => [x.k, x.def])) };
  let pose;
  if (d.gripQ && d.grip) { const q = d.gripQ.clone(); pose = { pos: scaledPoint(stub, d.grip).applyQuaternion(q).negate(), quat: q, snap: true }; }
  else { const r = Math.max(size.x, size.y, size.z) * 0.5; pose = { pos: new THREE.Vector3(0, 0, -(0.03 + r / k)), quat: new THREE.Quaternion(), snap: false }; }
  let at, q;
  if (H) { at = pose.pos.clone().multiplyScalar(pose.snap ? 1 : k).applyQuaternion(H.quat).add(H.pos); q = H.quat.clone().multiply(pose.quat); }
  else {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_q)); fwd.y = 0; fwd.normalize();
    at = camera.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, 0.5 * k); q = new THREE.Quaternion();
  }
  const b = newBody(at, q);
  const p = addPart(b, type, sc !== 1 ? { size } : {});
  if (d.joint) createJointChild(p);
  recordNew([...constructOf(b)]);
  if (H) {
    H.held = { id: p.id, pose, freeze: false, heavy: false };
    if (H.phys && H.phys.c) H.phys.c.setEnabled(false);
    pulse(H, 0.4, 40);
  }
  game.sound('attach', at, 0.5);
  return p;
}

/* ---------------- tools ---------------- */
const dots = []; // glue drops on parts: { part, local, mesh } / on the counter: { world, mesh }
const dotGeo = new THREE.SphereGeometry(1, 14, 10);
const dotMat = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.12, transparent: true, opacity: 0.9 });
function addDot(owner, point, normal, size) {
  const m = new THREE.Mesh(dotGeo, dotMat);
  m.scale.set(size, size * 0.45, size);
  m.quaternion.setFromUnitVectors(_v.set(0, 1, 0), normal);
  m.castShadow = false;
  if (owner.kind === 'part') {
    const p = owner.ref;
    const inv = worldQuat(p, _q).invert();
    const local = point.clone().sub(worldPos(p, _v2)).applyQuaternion(inv);
    m.position.copy(local);
    m.quaternion.premultiply(inv);
    p.mesh.add(m);
    dots.push({ part: p, local, mesh: m, size });
  } else {
    m.position.copy(point);
    scene.add(m);
    dots.push({ world: point.clone(), mesh: m, size });
  }
}
function removeDot(i) { const d = dots[i]; if (d.mesh.parent) d.mesh.parent.remove(d.mesh); dots.splice(i, 1); }
export function clearDots() { for (let i = dots.length - 1; i >= 0; i--) removeDot(i); }
// every physics step: a part pressed onto a glue drop sticks for good
export function glueStep() {
  for (let i = dots.length - 1; i >= 0; i--) {
    const d = dots[i];
    if (d.part && (d.part.dead || !d.part.mesh)) { removeDot(i); continue; }
    const at = d.part ? worldPos(d.part, _v, d.local) : d.world;
    let other = null;
    world.intersectionsWithShape(at, { x: 0, y: 0, z: 0, w: 1 }, new R.Ball(d.size * 0.9), (c) => {
      const o = owners.get(c.handle);
      if (!o) return true;
      if (o.kind === 'part' && !o.ref.dead && !o.ref.def.noGlue && (!d.part || o.ref.body !== d.part.body)) { other = o; return false; }
      if (o.kind === 'ground' && d.part) { other = o; return false; }
      return true;
    }, undefined, groups(G.WORLD, G.WORLD | G.PARTS), undefined, d.part ? d.part.body.rb : undefined);
    if (!other) continue;
    if (d.part && other.kind === 'ground') {
      for (const b of constructOf(d.part.body)) { b.rb.setLinvel({ x: 0, y: 0, z: 0 }, false); setFrozen(b, true); }
      game.sound('soft', at, 0.5, 0.7);
      removeDot(i);
      continue;
    }
    const q = other.ref;
    if (!d.part) { // drop on the counter: whatever lands on it is held in place
      for (const b of constructOf(q.body)) { b.rb.setLinvel({ x: 0, y: 0, z: 0 }, false); setFrozen(b, true); }
      game.sound('soft', at, 0.5, 0.7);
      removeDot(i);
      continue;
    }
    const a = begin(new Set([...constructOf(d.part.body), ...constructOf(q.body)]));
    const res = glueBodies(d.part.body, q.body, d.part, q);
    removeDot(i);
    if (!res) { game.toast('Those two both swing on joints: glue one of them to something solid first'); continue; }
    commit(a);
    game.sound('attach', at, 0.6);
    tip('stuck', 'Stuck for good! Glue on a battery and a grip handle = a gadget');
    for (const H of hands) if (H.held) { const hp = partsById.get(H.held.id); if (hp && (hp === d.part || hp === q || hp.body === res)) pulse(H, 0.7, 70); }
  }
}
function toolTip(p, out) { return worldPos(p, out, scaledPoint(p, p.def.tip)); }
function toolDir(p, out) { return out.set(0, 1, 0).applyQuaternion(worldQuat(p, _q)); }

function useTool(H, p, dt) {
  const t = p.def.tool, k = K(), ts = Math.max(p.size.x, p.size.y, p.size.z) / Math.max(...p.def.size);
  const tip = toolTip(p, new THREE.Vector3());
  p.st.squeeze = t === 'glue' ? H.trig : 0;
  if (t === 'glue') {
    H.glueT -= dt;
    if (H.trig > 0.6 && H.glueT <= 0) {
      const pr = world.projectPoint(tip, true, undefined, groups(G.WORLD, G.WORLD | G.PARTS), undefined, p.body.rb);
      if (pr) {
        const pt = toV(pr.point, new THREE.Vector3());
        const dist = pt.distanceTo(tip);
        const o = owners.get(pr.collider.handle);
        if (o && dist < 0.3 * ts && (o.kind === 'ground' || (o.kind === 'part' && !o.ref.def.noGlue))) {
          const n = pr.isInside ? toolDir(p, new THREE.Vector3()).negate() : tip.clone().sub(pt).normalize();
          addDot(o, pt.addScaledVector(n, 0.01 * ts), n, 0.07 * ts);
          game.sound('pop', pt, 0.35, 1.6);
          pulse(H, 0.25, 25);
          tip('drop', 'Now push another part onto the glue drop');
          H.glueT = 0.3;
        }
      }
    }
    return;
  }
  if (t === 'wire') {
    if (H.wireFrom && H.wireFrom.dead) H.wireFrom = null;
    if (H.trigEdge) {
      const q = nearestPart(tip, 0.45 * ts, p);
      const tgt = q ? (q.rotorBase || q) : null;
      if (!tgt) { if (H.wireFrom) game.toast('Wire cancelled'); H.wireFrom = null; return; }
      if (!H.wireFrom) {
        if (!tgt.def.source) { game.toast('Start the wire on a button, switch, sensor, timer or logic gate'); game.sound('ui_error', null, 0.4); return; }
        H.wireFrom = tgt; game.sound('ui_toggle', tip, 0.5); pulse(H, 0.3, 30);
        game.toast(tgt.def.name + ': now touch what it should turn on');
        return;
      }
      if (tgt === H.wireFrom) { H.wireFrom = null; return; }
      const a = begin(new Set([...constructOf(H.wireFrom.body), ...constructOf(tgt.body)]));
      wire(H.wireFrom, tgt); bumpTopo(); commit(a);
      game.sound('snap', tip, 0.6); pulse(H, 0.5, 40);
      game.toast(H.wireFrom.def.name + ' now works the ' + tgt.def.name);
      H.wireFrom = null;
    }
    return;
  }
  if (t === 'cut') {
    if (!H.trigEdge) return;
    // a wire close to the jaws?
    let bestW = null, bd = 0.35 * ts;
    for (const w of wires) {
      const a = partWorld(w.from, new THREE.Vector3()), b = partWorld(w.to, new THREE.Vector3());
      const d = new THREE.Line3(a, b).closestPointToPoint(tip, true, new THREE.Vector3()).distanceTo(tip);
      if (d < bd) { bd = d; bestW = w; }
    }
    if (bestW) { unwire(bestW); bumpTopo(); game.sound('snap', tip, 0.6, 1.4); pulse(H, 0.5, 40); game.toast('Wire cut'); return; }
    const q = nearestPart(tip, 0.4 * ts, p);
    if (!q) return;
    const a = begin(constructOf(q.body));
    if (q.rotorBase) breakJoint(q.rotorBase);
    else if (q.child) breakJoint(q);
    else if (q.body.parts.size > 1) detachPart(q);
    else { game.toast('That is not glued to anything'); return; }
    bumpTopo();
    commit(a);
    game.sound('crack', tip, 0.7, 1.3); pulse(H, 0.7, 50);
    return;
  }
  if (t === 'paint') {
    H.paintT -= dt;
    if (H.trig < 0.5) return;
    const dir = toolDir(p, new THREE.Vector3());
    if (Math.random() < 0.5) game.fx.sparks(tip.clone().addScaledVector(dir, 0.1 * ts), 2, 0.6 * ts, new THREE.Color(p.props.paint).getHex());
    if (H.paintT > 0) return;
    H.paintT = 0.12;
    const hit = game.partCtx.ray(tip, dir, 2.2 * ts, p.body);
    if (hit && hit.owner && hit.owner.kind === 'part') {
      const q = hit.owner.ref;
      if (!q.def.noPaint && q.color !== p.props.paint) { q.color = p.props.paint; rebuildPart(q); game.sound('piston', hit.point, 0.15, 2); }
    }
  }
}

/* ---------------- menu panel ---------------- */
function placePanel() {
  const open = menus.isOpen();
  panel.mesh.visible = open && game.inVR;
  if (!open) return;
  panel.scroll = 0;
  const k = K();
  camera.updateWorldMatrix(true, false);
  const head = camera.getWorldPosition(new THREE.Vector3());
  const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
  panel.mesh.scale.setScalar(k * 0.78); // about 90 cm wide, about 95 cm in front of you (at any size)
  panel.mesh.position.copy(head).addScaledVector(f, 0.95 * k);
  panel.mesh.position.y = head.y - 0.12 * k;
  panel.mesh.lookAt(head.x, panel.mesh.position.y, head.z);
  drawMenu(panel, menus.top());
}
// the left wrist: your size, your health, and what the buttons do right now
let hints = [];
function drawWrist() {
  const g = wristCanvas.getContext('2d');
  g.clearRect(0, 0, 512, 384);
  g.fillStyle = 'rgba(12,14,18,.84)';
  g.beginPath(); g.roundRect ? g.roundRect(0, 0, 512, 384, 34) : g.rect(0, 0, 512, 384); g.fill();
  const font = (window.GS3Console && GS3Console.theme().font) || 'sans-serif';
  const h = playerHeight() / U; // meters
  const txt = h >= 1 ? h.toFixed(2) + ' m' : h >= 0.1 ? Math.round(h * 100) + ' cm' : (h * 100).toFixed(1) + ' cm';
  g.fillStyle = '#9aa3ad'; g.font = '600 26px ' + font; g.textAlign = 'left';
  g.fillText('YOUR SIZE', 34, 50);
  g.fillStyle = '#fff'; g.font = '700 64px ' + font;
  g.fillText(txt, 30, 118);
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(34, 142, 444, 18);
  g.fillStyle = player.hp > 50 ? '#5aa339' : player.hp > 25 ? '#f2c230' : '#c8332b';
  g.fillRect(34, 142, 444 * player.hp / 100, 18);
  g.fillStyle = '#9aa3ad'; g.font = '600 22px ' + font;
  g.fillText(player.jet > 0 ? 'JETPACK ON' : (game.settings.damage ? 'HEALTH' : 'HEALTH (damage off)'), 34, 190);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(34, 206, 444, 2);
  g.font = '500 25px ' + font; g.fillStyle = '#e9edf2';
  hints.slice(0, 5).forEach((l, i) => g.fillText(l, 34, 244 + i * 32));
  wrist.userData.tex.needsUpdate = true;
}
function hintsFor(L, Rr) {
  const hp = (H) => H && H.held && partsById.get(H.held.id);
  const r = hp(Rr), l = hp(L), out = [];
  const say = (p) => {
    const t = p.def.tool;
    if (t === 'glue') return 'Trigger: squeeze a glue drop';
    if (t === 'wire') return 'Trigger: touch a button, then a motor';
    if (t === 'cut') return 'Trigger: unglue a part / cut a wire';
    if (t === 'paint') return 'Trigger: spray paint';
    const set = constructOf(p.body);
    for (const b of set) for (const q of b.parts) if (q.def.handle || (q.props.input === 'auto' && (q.def.control || q.def.electric))) return 'Trigger: fire your gadget';
    return 'Push it on glue to stick it';
  };
  if (r) out.push(say(r)); if (l && l !== r) out.push(say(l));
  if (r && l && r.body === l.body) out.push('Pull hands apart: bigger');
  if (r || l) out.push('A/X: stays in air   B/Y: its menu');
  else out.push('Grip: grab    Y: spawn parts', 'Trigger (empty hand): jetpack', 'R stick: turn, down/up = size', 'B: undo    A: sit / use');
  return out;
}
function vrToast(msg) {
  const { c, t } = toastPlane.userData;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 128);
  g.fillStyle = 'rgba(12,14,18,.82)';
  g.beginPath(); g.roundRect ? g.roundRect(0, 14, 1024, 100, 24) : g.rect(0, 14, 1024, 100); g.fill();
  g.fillStyle = '#fff'; g.font = '500 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(msg).slice(0, 64), 512, 66);
  t.needsUpdate = true;
  toastPlane.visible = true;
  toastT = 3.2;
}

/* ---------------- every frame in VR ---------------- */
const raycaster = new THREE.Raycaster();
let turnCool = 0, panelRedraw = 0;
const was = {};
function btn(H, i) { const gp = H.source && H.source.gamepad; return !!(gp && gp.buttons[i] && gp.buttons[i].pressed); }
function val(H, i) { const gp = H.source && H.source.gamepad; return gp && gp.buttons[i] ? gp.buttons[i].value : 0; }
function axis(H, i) { const gp = H.source && H.source.gamepad; const v = gp && gp.axes[i] ? gp.axes[i] : 0; return Math.abs(v) < 0.15 ? 0 : v; }
function edge(H, i) { const k = H.side + i; const now = btn(H, i); const e = now && !was[k]; was[k] = now; return e; }
function release(H, i) { const k = H.side + 'r' + i; const now = btn(H, i); const e = !now && was[k]; was[k] = now; return e; }
function pinching(H) {
  const j = H.xhand.joints;
  if (!j || !j['thumb-tip'] || !j['index-finger-tip']) return false;
  return j['thumb-tip'].position.distanceTo(j['index-finger-tip'].position) < 0.025;
}
const headOff = new THREE.Vector3();
let lastScale = 1, jetLoop = null, jetBuzz = 0, two = null;
// both hands on the same thing: pull apart to make it bigger, push together to make it smaller
function twoHandResize(L, Rr) {
  const a = L && L.held && partsById.get(L.held.id), b = Rr && Rr.held && partsById.get(Rr.held.id);
  if (!a || !b || a.body !== b.body) { two = null; return; }
  const d = L.pos.distanceTo(Rr.pos);
  if (!two || two.body !== a.body) { two = { body: a.body, d0: d, applied: 1 }; return; }
  const step = d / Math.max(1e-4, two.d0) / two.applied;
  if (Math.abs(step - 1) < 0.06) return;
  const set = constructOf(a.body);
  if (set.size === 1 && a.body.parts.size === 1 && a.def.resize && !a.def.joint) {
    const ns = a.size.clone().multiplyScalar(step);
    if (Math.max(ns.x, ns.y, ns.z) > 60 || Math.min(ns.x, ns.y, ns.z) < 0.02) return;
    a.size.copy(ns); rebuildPart(a); a.body.metaDirty = true;
  } else game.partCtx.scaleBuild(a, step);
  two.applied *= step;
  game.sound('ui_toggle', null, 0.2, step > 1 ? 1.4 : 0.8);
  pulse(L, 0.2, 20); pulse(Rr, 0.2, 20);
  const p = partsById.get(Rr.held.id) || a, m = Math.max(p.size.x, p.size.y, p.size.z) / U;
  game.toast(p.def.name + ': ' + (m >= 1 ? m.toFixed(2) + ' m' : (m * 100).toFixed(m < 0.1 ? 1 : 0) + ' cm'));
}

export function vrFrame(dt, frame, { ray, playing }) {
  const L = hands.find((h) => h.side === 'left' && h.source), Rr = hands.find((h) => h.side === 'right' && h.source);
  toastT -= dt;
  if (toastT <= 0 && toastPlane) toastPlane.visible = false;
  const k = K();
  rig.scale.setScalar(k);
  if (game.vrVeil) { const o = player.dead > 0 ? Math.min(1, (2.2 - player.dead) * 3) : 0; game.vrVeil.material.opacity = o; game.vrVeil.visible = o > 0.01; }
  if (game.vrRed) { const o = Math.min(0.45, (game.hurt || 0) * 0.5); game.vrRed.material.opacity = o; game.vrRed.visible = o > 0.01; }

  // walking (your real steps count too), turning, shrinking
  if (playing && !player.seat && !player.remote && !menus.isOpen()) {
    const s = game.settings;
    turnCool -= dt;
    const rx = Rr ? axis(Rr, 2) : 0, ry = Rr ? axis(Rr, 3) : 0;
    let turn = 0;
    if (s.snapTurn) { if (Math.abs(rx) > 0.7 && turnCool <= 0) { turn = -Math.sign(rx) * s.turnAngle * Math.PI / 180; turnCool = 0.3; } if (Math.abs(rx) < 0.3) turnCool = 0; }
    else turn = -rx * 2.2 * dt;
    if (turn) rig.rotateY(turn);
    // right stick up / down: grow / shrink (your suit's size control)
    if (Math.abs(ry) > 0.35 && Math.abs(ry) > Math.abs(rx)) {
      const want = player.scale * Math.exp(-ry * 1.1 * dt);
      if (!setPlayerScale(want) && ry < 0 && !game.noRoomT) { game.toast('No room to grow here'); game.noRoomT = 1; }
    }
    if (Rr && edge(Rr, 3)) { if (setPlayerScale(1)) game.toast('Back to normal size'); else game.toast('No room to grow here'); }
  }
  if (game.noRoomT) game.noRoomT = Math.max(0, game.noRoomT - dt);
  const k2 = K();
  rig.scale.setScalar(k2);

  // hand poses (world): palm position, pointing direction, real speed
  camera.updateWorldMatrix(true, false);
  for (const H of hands) {
    if (!H.source) continue;
    const trig = val(H, 0), sq = val(H, 1);
    if (H.ctlHand) { H.ctlHand.root.visible = !H.source.hand; H.ctlHand.set(trig, sq); }
    if (H.trackedHand) { H.trackedHand.updateMesh(); H.trackedHolder.visible = !!H.source.hand; }
  }

  if (!player.seat) {
    // keep your body under your real head: steps you take in your room move you in the game
    const headYaw = new THREE.Euler().setFromQuaternion(camera.getWorldQuaternion(_q), 'YXZ').y;
    headOff.set(camera.position.x, 0, camera.position.z).multiplyScalar(k2).applyQuaternion(rig.quaternion);
    let dx = rig.position.x + headOff.x - player.pos.x, dz = rig.position.z + headOff.z - player.pos.z;
    if (player.teleported || Math.hypot(dx, dz) > 1.5 * k2 || lastScale !== player.scale) { dx = 0; dz = 0; player.teleported = false; }
    lastScale = player.scale;
    let mx = 0, mz = 0, jet = 0, sprint = false;
    if (playing && !player.remote && !menus.isOpen()) {
      mx = L ? axis(L, 2) : 0; mz = L ? -axis(L, 3) : 0;
      sprint = !!(L && btn(L, 3));
      for (const H of hands) if (H.source && !H.held && !H.overPanel) jet = Math.max(jet, val(H, 0) > 0.15 ? val(H, 0) : 0);
    }
    if (player.dead > 0) { mx = mz = jet = 0; }
    movePlayer(dt, { x: mx * game.settings.vrSmoothSpeed / 3, z: mz * game.settings.vrSmoothSpeed / 3, sprint, jet, dx, dz }, headYaw);
    // jetpack: you hear it and feel it in the hand that pulls the trigger
    if (jet > 0.05) {
      if (!jetLoop) jetLoop = loop('loop_thrust');
      if (jetLoop) jetLoop.set(0.2 + jet * 0.45, player.pos, 1.25 - Math.min(0.5, player.scale * 0.3));
      jetBuzz -= dt;
      if (jetBuzz <= 0) { jetBuzz = 0.1; for (const H of hands) if (H.source && !H.held && val(H, 0) > 0.15) pulse(H, 0.12 + jet * 0.25, 90); }
    } else if (jetLoop) { jetLoop.stop(); jetLoop = null; }
    rig.position.set(player.pos.x - headOff.x, player.pos.y, player.pos.z - headOff.z);
  }
  rig.updateMatrixWorld(true);

  for (const H of hands) {
    if (!H.source) continue;
    H.grip.updateWorldMatrix(true, false); H.ray.updateWorldMatrix(true, false);
    H.prev.copy(H.pos); H.prevQ.copy(H.quat);
    H.pos.set(0, -0.01, 0.03).applyMatrix4(H.grip.matrixWorld);
    H.ray.getWorldQuaternion(H.quat);
    if (dt > 0) {
      const v = H.pos.clone().sub(H.prev).divideScalar(dt);
      if (v.length() < 400 * k2) { H.vels.push(v); if (H.vels.length > 5) H.vels.shift(); }
      const dq = H.quat.clone().multiply(H.prevQ.clone().invert());
      if (dq.w < 0) { dq.x = -dq.x; dq.y = -dq.y; dq.z = -dq.z; dq.w = -dq.w; }
      const a = 2 * Math.acos(Math.min(1, dq.w)), sn = Math.sqrt(1 - dq.w * dq.w);
      if (sn > 1e-4) H.avel.set(dq.x / sn, dq.y / sn, dq.z / sn).multiplyScalar(Math.min(30, a / dt)); else H.avel.set(0, 0, 0);
    }
    if (H.phys) sizePhysHand(H);
    const trig = val(H, 0);
    if (trig > 0.55 && H.trig <= 0.55) H.trigEdge = true;
    H.trig = trig;
  }
  // pointing ray (right hand, or left if there is no right)
  const P = (Rr && !Rr.held) ? Rr : (L && !L.held) ? L : (Rr || L);
  if (P) {
    ray.origin.setFromMatrixPosition(P.ray.matrixWorld);
    ray.dir.set(0, 0, -1).applyQuaternion(P.quat).normalize();
  }
  for (const H of hands) H.overPanel = false;
  if (wrist) wrist.visible = !player.seat;
  wristT -= dt;
  if (wristT <= 0 && wrist) { wristT = 0.25; hints = hintsFor(L, Rr); drawWrist(); }

  // menu open: point and click on the floating panel
  if (menus.isOpen()) {
    for (const H of hands) { H.line.visible = H === P; H.dot.visible = false; }
    if (P) P.overPanel = true;
    panelPointer(P, ray, dt);
    if (L && edge(L, 5)) hooks.menuToggle();
    return null;
  }
  panel.mesh.visible = false;
  for (const H of hands) H.line.visible = false;
  if (!playing) return null;

  // seat: sticks drive the build
  if (player.seat || player.remote) {
    if (L && edge(L, 3)) { hooks.getOut(); return null; }
    if (L && edge(L, 5)) hooks.menuToggle();
    const held = new Set(), edges = new Set();
    const map = [[Rr, 4, 'k1'], [Rr, 5, 'k2'], [L, 4, 'x'], [Rr, 1, 'k3'], [L, 1, 'k4']];
    for (const [H, i, kk] of map) { if (!H) continue; if (btn(H, i)) held.add(kk); if (edge(H, i)) edges.add(kk); }
    return {
      drive: L ? -axis(L, 3) : 0, steer: L ? axis(L, 2) : 0,
      lift: (Rr ? val(Rr, 0) : 0) - (L ? val(L, 0) : 0), pitch: Rr ? -axis(Rr, 3) : 0, roll: Rr ? axis(Rr, 2) : 0, held, edges
    };
  }
  if (player.dead > 0) { for (const H of hands) if (H.held) dropHeld(H, false); return null; }

  // hands: grip grabs, letting go drops / throws
  for (const H of hands) {
    if (!H.source) continue;
    const pinch = H.source.hand && pinching(H);
    if (edge(H, 1) || (pinch && !H.held && !H.pinched)) tryGrab(H);
    if (release(H, 1) || (H.held && H.source.hand && !pinch)) dropHeld(H);
    H.pinched = pinch;
    const hp = H.held && partsById.get(H.held.id);
    // A / X while holding: it stays in the air when you let go (or falls again)
    if (hp && edge(H, 4)) {
      H.held.freeze = !H.held.freeze;
      game.toast(H.held.freeze ? 'Let go: it stays right there in the air' : 'Let go: it falls');
      pulse(H, 0.3, 30);
    } else if (!hp && H.side === 'right' && edge(H, 4)) useNear(H);
    // B / Y while holding: its menu (settings, size, color, save, delete)
    if (hp && edge(H, 5)) { hooks.openEditor(hp); return null; }
    if (!hp && H.side === 'left' && edge(H, 5)) { hooks.openParts(); tip('menu', 'Point at a part and pull the trigger: it lands in your hand'); return null; }
    if (!hp && H.side === 'right' && edge(H, 5)) undo();
    if (hp && hp.def.tool) useTool(H, hp, dt);
    // laying a wire: show it
    if (H.wireFrom && hp && hp.def.tool === 'wire') {
      const a = partWorld(H.wireFrom, new THREE.Vector3()), b = toolTip(hp, new THREE.Vector3());
      const pos = H.wireLine.geometry.attributes.position;
      pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
      H.wireLine.visible = true;
    } else H.wireLine.visible = false;
    if (H === Rr) twoHandResize(L, Rr);
    // poke: buttons and switches react to your fingertip
    H.pokeT -= dt;
    if (!H.held && H.pokeT <= 0) {
      const tip = new THREE.Vector3(0, -0.02, -0.07).applyMatrix4(H.grip.matrixWorld);
      const q = nearestPart(tip, 0.022 * k2);
      if (q && q.def.use && !q.def.seat && !q.def.remote) { q.def.use(q, game.partCtx); H.pokeT = 0.5; pulse(H, 0.4, 30); }
    }
  }
  return null;
}
// A with an empty right hand: sit in a seat, take a remote, flip a switch, press a button (touching or pointing at it)
function useNear(H) {
  const k = K();
  let q = nearestPart(H.pos, 0.12 * k);
  if (!q) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(H.quat);
    const hit = game.partCtx.ray(H.pos, dir, 3 * k);
    if (hit && hit.owner && hit.owner.kind === 'part') q = hit.owner.ref;
  }
  if (!q) return;
  q = q.rotorBase || q;
  if (q.def.seat) game.sitIn(q);
  else if (q.def.remote) game.takeRemote(q);
  else if (q.def.use) q.def.use(q, game.partCtx);
  pulse(H, 0.3, 30);
}
function panelPointer(P, ray, dt) {
  if (!P) return;
  raycaster.set(ray.origin, ray.dir);
  const h = raycaster.intersectObject(panel.mesh, false)[0];
  P.line.scale.z = (h ? h.distance : 3 * K()) / K();
  const t = h ? hitTest(panel, h.uv) : null;
  const hov = t ? t.i : -1;
  const sy = axis(P, 3);
  if (sy) { panel.scroll = Math.max(0, Math.min(panel.maxScroll, panel.scroll + sy * 900 * dt)); panelRedraw = 0; }
  if (edge(P, 0) && t) {
    game.menuHand = P.side;
    if (t.r.slide) { panel.drag = t.i; t.r.slide(t.fx); }
    else if (t.r.on) { game.sound('ui_click', null, 0.5); t.r.on(); pulse(P, 0.2, 20); if (menus.isOpen()) drawMenu(panel, menus.top()); }
  }
  if (panel.drag != null && btn(P, 0) && t && t.i === panel.drag && t.r.slide) t.r.slide(t.fx);
  if (!btn(P, 0)) panel.drag = null;
  panelRedraw -= dt;
  if (hov !== panel.hover || panelRedraw <= 0 || panel.drag != null) {
    panel.hover = hov;
    panelRedraw = 0.25;
    if (menus.isOpen()) drawMenu(panel, menus.top());
  }
}
