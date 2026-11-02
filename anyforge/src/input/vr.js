// VR on Quest 3 (WebXR in its browser). Real hand models (only in VR), walking with the stick, physics hands that
// grab and punch, the right hand points the tools, and the menus float in front of you.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { XRHandMeshModel } from 'three/examples/jsm/webxr/XRHandMeshModel.js';
import { renderer, scene, camera, rig, setQuality, quality } from '../core/render.js';
import { R, world, owners, G, groups } from '../core/physics.js';
import { assetURL, track } from '../core/assets.js';
import { player, movePlayer, standUp } from '../player/player.js';
import { T, TOOLS, ICONS, setTool, primary, secondary, wheel, rotate, undo, use, letGo, holdingThing, onToolChange } from '../tools/tools.js';
import { bodies, constructOf } from '../build/core.js';
import * as menus from '../ui/menus.js';
import { createPanel, drawMenu, hitTest } from '../ui/vrpanel.js';
import { game } from '../game.js';

export const vrSession = { supported: false, active: false, enter: () => {} };
let hooks = null;
const hands = [];         // per side: { side, ray, grip, xhand, source, ctlHand, trackedHand, phys, held, prev, vel }
let handGLB = {};
const panel = createPanel(1.15);
const wristCanvas = document.createElement('canvas');
let wrist = null;
let toastPlane = null, toastT = 0;

export function initVR(h) {
  hooks = h;
  if (navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported('immersive-vr').then((s) => { vrSession.supported = s; if (s && menus.top() && menus.top().id === 'title') menus.refresh(); }).catch(() => {});
  }
  vrSession.enter = enter;
  // real hand models (the same ones Meta's browser uses, packed with the game)
  const loader = new GLTFLoader();
  for (const side of ['left', 'right']) {
    track(loader.loadAsync(assetURL('models/hand-' + side + '.glb')).then((g) => { handGLB[side] = g; }), 0.3);
  }
  for (let i = 0; i < 2; i++) {
    const ray = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i), xhand = renderer.xr.getHand(i);
    rig.add(ray, grip, xhand);
    const H = { i, side: null, ray, grip, xhand, source: null, ctlHand: null, trackedHand: null, phys: null, held: null, prev: new THREE.Vector3(), vel: new THREE.Vector3(), curl: 0, pinch: 0, punchT: 0, btn: [] };
    hands.push(H);
    ray.addEventListener('connected', (e) => onConnect(H, e.data));
    ray.addEventListener('disconnected', () => { H.source = null; H.side = null; });
    // pointer line from the right hand
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    line.scale.z = 4;
    line.visible = false;
    ray.add(line);
    H.line = line;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.visible = false;
    scene.add(dot);
    H.dot = dot;
  }
  scene.add(panel.mesh);
  panel.onClose = () => { menus.closeAll(); };
  // the tool strip on your left wrist
  wristCanvas.width = 1024; wristCanvas.height = 160;
  const wt = new THREE.CanvasTexture(wristCanvas); wt.colorSpace = THREE.SRGBColorSpace;
  wrist = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.05), new THREE.MeshBasicMaterial({ map: wt, transparent: true, toneMapped: false }));
  wrist.userData.tex = wt;
  wrist.visible = false;
  wrist.renderOrder = 31;
  onToolChange(drawWrist);
  // messages in VR
  const tc = document.createElement('canvas'); tc.width = 1024; tc.height = 128;
  const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace;
  toastPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.1), new THREE.MeshBasicMaterial({ map: tt, transparent: true, toneMapped: false, depthTest: false }));
  toastPlane.position.set(0, -0.32, -1.1);
  toastPlane.renderOrder = 40;
  toastPlane.visible = false;
  toastPlane.userData = { c: tc, t: tt };
  camera.add(toastPlane);
  const pcToast = game.toast;
  game.toast = (msg, ms) => { if (game.inVR) vrToast(msg); else pcToast(msg, ms); };
  menus.onMenuChange(() => { if (game.inVR) placePanel(); });
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
    setQuality('low', true); // Quest: keep 72+ fps (shadows near you, fewer lights)
    session.addEventListener('end', () => {
      vrSession.active = false; game.inVR = false;
      for (const H of hands) dropHeld(H);
      panel.mesh.visible = false;
      setQuality('medium', true);
      hooks.end();
    });
    drawWrist();
  } catch (e) {
    game.toast('VR could not start: ' + (e.message || e));
  }
}

function onConnect(H, source) {
  H.source = source;
  H.side = source.handedness;
  if (source.hand) {
    // real tracked hands: the official hand mesh follows your real fingers
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
  if (H.side === 'left' && wrist.parent !== H.grip) { H.grip.add(wrist); wrist.position.set(0.0, 0.05, 0.11); wrist.rotation.set(-1.2, 0, 0); }
}

/* ---------------- a hand model held on a controller: fingers curl with grip and trigger ---------------- */
const FINGERS = ['thumb', 'index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
function makeControllerHand(side) {
  const g = handGLB[side];
  const root = new THREE.Group();
  const model = g.scene.clone(true);
  // bones are flat (no parent chain): we pose each bone ourselves, open <-> fist
  const skinned = [];
  model.traverse((o) => { if (o.isSkinnedMesh) { skinned.push(o); o.frustumCulled = false; o.castShadow = true; } });
  // the skinned mesh in the clone still points at the original bones: rebind to the clone's bones
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
    const cur = chain.map((n) => ({ n, p: open[n].p.clone(), q: open[n].q.clone() }));
    // bend each knuckle toward the palm; everything past that knuckle swings with it
    const angles = f === 'thumb' ? [0.3, 0.45, 0.55] : [0.1, 1.2, 1.35, 0.85];
    for (let j = 0; j < angles.length && j < cur.length - 1; j++) {
      const pv = cur[j].p.clone();
      const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(cur[j].q).normalize();
      const rq = new THREE.Quaternion().setFromAxisAngle(axis, -angles[j]);
      cur[j].q.premultiply(rq);
      for (let k = j + 1; k < cur.length; k++) {
        cur[k].p.sub(pv).applyQuaternion(rq).add(pv);
        cur[k].q.premultiply(rq);
      }
    }
    for (const c of cur) fist[c.n] = { p: c.p, q: c.q };
  }
  root.add(model);
  // sit the hand around the controller: palm on the grip, fingers wrapping forward and down
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

/* ---------------- physics hands: push things, grab with grip, punch people ---------------- */
function makePhysHand(H) {
  const rb = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -50, 0));
  const c = world.createCollider(R.ColliderDesc.ball(0.055).setDensity(1).setCollisionGroups(groups(G.HAND, G.PARTS | G.DEBRIS)), rb);
  owners.set(c.handle, { kind: 'hand' });
  H.phys = { rb, c };
}
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _d = new THREE.Vector3();
function palmPos(H, out) {
  H.grip.updateWorldMatrix(true, false);
  return out.set(0, -0.01, 0.02).applyMatrix4(H.grip.matrixWorld);
}
function tryGrab(H) {
  const at = palmPos(H, new THREE.Vector3());
  let best = null;
  world.intersectionsWithShape(at, { x: 0, y: 0, z: 0, w: 1 }, new R.Ball(0.13), (c) => {
    const o = owners.get(c.handle);
    if (o && (o.kind === 'part' || o.kind === 'human')) { best = { c, o }; return false; }
    return true;
  }, undefined, groups(G.WORLD, G.PARTS | G.HUMAN));
  if (!best) return;
  if (best.o.kind === 'human') {
    const h = best.o.ref;
    H.held = { human: h, bone: h.grab(best.c) };
    pulse(H, 0.4, 40);
    return;
  }
  const body = best.o.ref.body;
  if (body.frozen) { game.toast('That build is frozen: right trigger + Grab tool moves it'); return; }
  const t = body.rb.translation(), r = body.rb.rotation();
  const inv = new THREE.Quaternion(r.x, r.y, r.z, r.w).invert();
  const local = at.clone().sub(_v.set(t.x, t.y, t.z)).applyQuaternion(inv);
  H.phys.rb.setTranslation(at, true);
  const jd = R.JointData.spherical({ x: 0, y: 0, z: 0 }, local);
  const joint = world.createImpulseJoint(jd, H.phys.rb, body.rb, true);
  H.held = { body, joint };
  pulse(H, 0.4, 40);
  game.sound('soft', at, 0.4);
}
function dropHeld(H) {
  const h = H.held;
  H.held = null;
  if (!h) return;
  if (h.joint && h.joint.isValid()) world.removeImpulseJoint(h.joint, true);
  if (h.human) h.human.release(H.vel.clone());
}
function pulse(H, v, ms) {
  const gp = H.source && H.source.gamepad;
  if (gp && gp.hapticActuators && gp.hapticActuators[0]) { try { gp.hapticActuators[0].pulse(v, ms); } catch (e) { /* no rumble */ } }
}

/* ---------------- menu panel ---------------- */
function placePanel() {
  const open = menus.isOpen();
  panel.mesh.visible = open && game.inVR;
  if (!open) return;
  panel.scroll = 0;
  camera.updateWorldMatrix(true, false);
  const head = camera.getWorldPosition(new THREE.Vector3());
  const f = camera.getWorldDirection(new THREE.Vector3()); f.y = 0; f.normalize();
  panel.mesh.position.copy(head).addScaledVector(f, 1.1);
  panel.mesh.position.y = head.y - 0.12;
  panel.mesh.lookAt(head.x, panel.mesh.position.y, head.z);
  drawMenu(panel, menus.top());
}
function drawWrist() {
  if (!wrist) return;
  const g = wristCanvas.getContext('2d');
  g.clearRect(0, 0, 1024, 160);
  g.fillStyle = 'rgba(12,14,18,.85)';
  g.beginPath(); g.roundRect ? g.roundRect(0, 0, 1024, 160, 30) : g.rect(0, 0, 1024, 160); g.fill();
  const w = 1024 / TOOLS.length;
  TOOLS.forEach((t, i) => {
    if (T.tool === t.id) { g.fillStyle = '#fff'; g.fillRect(i * w + 6, 8, w - 12, 144); }
    g.fillStyle = T.tool === t.id ? '#0d0f12' : '#e9edf2';
    g.font = '600 30px ' + ((window.GS3Console && GS3Console.theme().font) || 'sans-serif');
    g.textAlign = 'center';
    g.fillText(t.name, i * w + w / 2, 92);
  });
  wrist.userData.tex.needsUpdate = true;
}
function vrToast(msg) {
  const { c, t } = toastPlane.userData;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 128);
  g.fillStyle = 'rgba(12,14,18,.82)';
  g.beginPath(); g.roundRect ? g.roundRect(0, 14, 1024, 100, 24) : g.rect(0, 14, 1024, 100); g.fill();
  g.fillStyle = '#fff'; g.font = '500 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(msg).slice(0, 60), 512, 66);
  t.needsUpdate = true;
  toastPlane.visible = true;
  toastT = 3;
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

export function vrFrame(dt, frame, { ray, playing }) {
  const L = hands.find((h) => h.side === 'left'), Rr = hands.find((h) => h.side === 'right');
  toastT -= dt;
  if (toastT <= 0 && toastPlane) toastPlane.visible = false;
  for (const H of hands) {
    if (!H.source) continue;
    const trig = val(H, 0), sq = val(H, 1);
    if (H.ctlHand) { H.ctlHand.root.visible = !H.source.hand; H.ctlHand.set(trig, sq); }
    if (H.trackedHand) { H.trackedHand.updateMesh(); H.trackedHolder.visible = !!H.source.hand; }
    // physics hand follows the palm; its speed is your punch speed
    const pp = palmPos(H, _p);
    H.vel.copy(pp).sub(H.prev).divideScalar(Math.max(dt, 1e-3));
    H.prev.copy(pp);
    if (H.phys) H.phys.rb.setNextKinematicTranslation(pp);
  }
  // pointing ray (right hand, or left if there is no right)
  const P = Rr || L;
  if (P) {
    P.ray.updateWorldMatrix(true, false);
    ray.origin.setFromMatrixPosition(P.ray.matrixWorld);
    ray.dir.set(0, 0, -1).applyQuaternion(P.ray.getWorldQuaternion(_q)).normalize();
  }
  // menu open: point and click on the floating panel
  if (menus.isOpen()) {
    for (const H of hands) { H.line.visible = H === P; H.dot.visible = false; }
    panelPointer(P, ray, dt);
    if (L && edge(L, 5)) hooks.menuToggle();
    return null;
  }
  panel.mesh.visible = false;
  if (!playing) return null;

  // seat: sticks drive the build
  if (player.seat || player.remote) {
    for (const H of hands) H.line.visible = false;
    if (L && edge(L, 3)) { hooks.getOut(); return null; }
    if (L && edge(L, 5)) hooks.menuToggle();
    const held = new Set(), edges = new Set();
    const map = [[Rr, 4, 'k1'], [Rr, 5, 'k2'], [L, 4, 'x'], [Rr, 1, 'k3'], [L, 1, 'k4']];
    for (const [H, i, k] of map) { if (!H) continue; if (btn(H, i)) held.add(k); if (edge(H, i)) edges.add(k); }
    return {
      drive: L ? -axis(L, 3) : 0, steer: L ? axis(L, 2) : 0,
      lift: (Rr ? val(Rr, 0) : 0) - (L ? val(L, 0) : 0), pitch: Rr ? -axis(Rr, 3) : 0, roll: Rr ? axis(Rr, 2) : 0, held, edges
    };
  }

  // walking / flying with the left stick, turning with the right
  const s = game.settings;
  camera.updateWorldMatrix(true, false);
  const headYaw = new THREE.Euler().setFromQuaternion(camera.getWorldQuaternion(_q), 'YXZ').y;
  const mx = L ? axis(L, 2) : 0, mz = L ? -axis(L, 3) : 0;
  const ry = Rr ? axis(Rr, 3) : 0, rx = Rr ? axis(Rr, 2) : 0;
  if (L && edge(L, 4)) { player.fly = !player.fly; player.vel.y = 0; game.toast(player.fly ? 'Flying: right stick up / down' : 'Walking'); }
  if (L && edge(L, 5)) hooks.menuToggle();
  const holdingTool = holdingThing();
  movePlayer(dt, { x: mx * s.vrSmoothSpeed / 4.6, z: mz * s.vrSmoothSpeed / 4.6, up: player.fly && !holdingTool && ry < -0.5, down: player.fly && !holdingTool && ry > 0.5, sprint: L && btn(L, 3) }, headYaw);
  if (holdingTool && ry) wheel(ry > 0 ? 0.15 : -0.15);
  // turning: snap (comfortable) or smooth; turns around your head, not the middle of the room
  turnCool -= dt;
  let turn = 0;
  if (s.snapTurn) { if (Math.abs(rx) > 0.7 && turnCool <= 0) { turn = -Math.sign(rx) * s.turnAngle * Math.PI / 180; turnCool = 0.3; } if (Math.abs(rx) < 0.3) turnCool = 0; }
  else turn = -rx * 2.2 * dt;
  if (turn) {
    const head = camera.getWorldPosition(new THREE.Vector3());
    rig.position.sub(head).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn).add(head);
    rig.rotateY(turn);
    player.pos.x = rig.position.x; player.pos.z = rig.position.z;
    // keep the capsule under your head
  }
  rig.position.x = player.pos.x; rig.position.z = player.pos.z; rig.position.y = player.pos.y;

  // hands: grab with grip, punch by swinging
  for (const H of hands) {
    if (!H.source) continue;
    if (edge(H, 1) || (H.source.hand && pinching(H) && !H.held)) tryGrab(H);
    if (release(H, 1) || (H.held && H.source.hand && !pinching(H))) dropHeld(H);
    if (H.held && H.held.human) H.held.human.dragTo(H.held.bone, palmPos(H, _v));
    if (H.held && H.held.body && !bodies.has(H.held.body)) H.held = null;
    H.punchT -= dt;
    if (!H.held && H.punchT <= 0 && H.vel.length() > 2.2) punchCheck(H);
  }
  // tools with the right hand: trigger = main action, left trigger = second action, A = turn part, B = undo
  if (Rr) {
    Rr.line.visible = true;
    const hit = T.aim;
    Rr.line.scale.z = hit ? Math.min(hit.toi, 30) : 4;
    Rr.dot.visible = !!hit;
    if (hit) Rr.dot.position.copy(hit.point);
    // pointing at the wrist strip picks a tool
    const onWrist = wristHit(ray);
    if (onWrist >= 0) { Rr.dot.visible = false; if (edge(Rr, 0)) setTool(TOOLS[onWrist].id); }
    else {
      if (edge(Rr, 0)) primary(ray);
      if (release(Rr, 0) && holdingThing()) letGo();
    }
    if (edge(Rr, 4)) { if (!use()) rotate(false); }
    if (edge(Rr, 5)) undo();
    if (edge(Rr, 3)) { const i = TOOLS.findIndex((t) => t.id === T.tool); setTool(TOOLS[(i + 1) % TOOLS.length].id); }
  }
  if (L && edge(L, 0)) secondary(ray);
  if (L) { L.line.visible = false; L.dot.visible = false; }
  if (wrist) wrist.visible = true;
  return null;
}
function pinching(H) {
  const j = H.xhand.joints;
  if (!j || !j['thumb-tip'] || !j['index-finger-tip']) return false;
  return j['thumb-tip'].position.distanceTo(j['index-finger-tip'].position) < 0.025;
}
function wristHit(ray) {
  if (!wrist || !wrist.visible) return -1;
  raycaster.set(ray.origin, ray.dir);
  const h = raycaster.intersectObject(wrist, false)[0];
  if (!h) return -1;
  return Math.min(TOOLS.length - 1, Math.floor(h.uv.x * TOOLS.length));
}
function punchCheck(H) {
  const at = palmPos(H, _d);
  let hit = null;
  world.intersectionsWithShape(at, { x: 0, y: 0, z: 0, w: 1 }, new R.Ball(0.09), (c) => {
    const o = owners.get(c.handle);
    if (o && o.kind === 'human') { hit = { c, h: o.ref }; return false; }
    return true;
  }, undefined, groups(G.WORLD, G.HUMAN));
  if (!hit) return;
  const sp = H.vel.length();
  game.humans.punch(hit.h, at.clone(), H.vel.clone().normalize(), Math.min(14, sp * 1.6), hit.c);
  H.punchT = 0.25;
  pulse(H, Math.min(1, sp / 6), 60);
}
function panelPointer(P, ray, dt) {
  if (!P) return;
  raycaster.set(ray.origin, ray.dir);
  const h = raycaster.intersectObject(panel.mesh, false)[0];
  P.line.scale.z = h ? h.distance : 3;
  const t = h ? hitTest(panel, h.uv) : null;
  const hov = t ? t.i : -1;
  // scroll with the right stick
  const sy = axis(P, 3);
  if (sy) { panel.scroll = Math.max(0, Math.min(panel.maxScroll, panel.scroll + sy * 900 * dt)); panelRedraw = 0; }
  if (edge(P, 0) && t) {
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
