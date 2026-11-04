// THE MASK - you: your head (camera), your two gloves, moving around, grabbing, throwing, punching and firing.
// VR: the gloves are your controllers. PC/phone: first person, gloves in view, mouse/touch to look.
import * as THREE from 'three';
import { G, clamp, damp, emit, unlock, on } from './game.js';
import { S } from './settings.js';
import { world, CANNON, GROUP, collideCircle } from './physics.js';
import { buildHand } from './hands.js';
import { mountGlove, gadgetMountMatrix } from './mounts.js';
import { input, pollDesktop } from './input.js';
import { audio } from './audio.js';
import { fx } from './fx.js';
import { GADGETS, GADGET_IDS, hitTest } from './gadgets.js';
import { ROOM } from './room.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const EYE = 1.6, CROUCH = 1.12;
// PC view-model spots for the hand frames (camera space)
const REST = [new THREE.Vector3(-0.22, -0.24, -0.5), new THREE.Vector3(0.22, -0.24, -0.5)];
const AIM = [new THREE.Vector3(-0.16, -0.17, -0.38), new THREE.Vector3(0.15, -0.165, -0.38)];
const PUNCH = [new THREE.Vector3(-0.06, -0.1, -0.8), new THREE.Vector3(0.06, -0.1, -0.8)];

export function createPlayer(renderer, camera, scene) {
  const rig = new THREE.Group(); rig.name = 'rig'; scene.add(rig); rig.add(camera);
  const P = {
    rig, camera, headPos: new THREE.Vector3(0, EYE, 1.4), headQuat: new THREE.Quaternion(), yaw: 0, pitch: 0,
    eye: EYE, vy: 0, hands: [], inventory: new Map(), lastSpawn: null, hurtPush: new THREE.Vector3(), crouch: false, aimRay: null
  };
  rig.position.set(0, 0, 1.45);

  for (let i = 0; i < 2; i++) {
    const frame = new THREE.Group(); frame.name = 'hand-frame-' + i;
    const glove = mountGlove(buildHand(i ? 'right' : 'left'), i, 1); frame.add(glove);
    camera.add(frame); frame.position.copy(REST[i]);
    const body = new CANNON.Body({ mass: 1, type: CANNON.Body.KINEMATIC, shape: new CANNON.Sphere(0.065), collisionFilterGroup: GROUP.HAND, collisionFilterMask: GROUP.PROP | GROUP.PERSON });
    world.addBody(body);
    P.hands.push({
      i, frame, glove, body, grip: 0, trigger: 0, held: null, gadget: null, holdM: new THREE.Matrix4(),
      pos: new THREE.Vector3(), quat: new THREE.Quaternion(), prev: new THREE.Vector3(), prevQ: new THREE.Quaternion(),
      vel: new THREE.Vector3(), ang: new THREE.Vector3(), hist: [], cool: new Map(), punchT: 1, src: null, gp: null,
      prevBtn: {}, xrGrip: null, xrRay: null
    });
  }
  // watch on the left wrist: shows the loop (teal hand) + a red light while recording
  P.watch = buildWatch(); P.hands[0].glove.add(P.watch);

  /* ---------- VR controllers ---------- */
  for (let k = 0; k < 2; k++) {
    const grip = renderer.xr.getControllerGrip(k), ray = renderer.xr.getController(k);
    rig.add(grip); rig.add(ray);
    const attach = (e) => {
      const side = e.data.handedness === 'left' ? 0 : 1;
      const h = P.hands[side]; h.src = e.data; h.xrGrip = grip; h.xrRay = ray;
      if (G.xr) { grip.add(h.frame); h.frame.position.set(0, 0, 0); h.frame.quaternion.identity(); }
    };
    grip.addEventListener('connected', attach);
    grip.addEventListener('disconnected', () => { for (const h of P.hands) if (h.xrGrip === grip) { h.src = null; h.xrGrip = null; } });
  }
  P.enterXR = () => {
    for (const h of P.hands) { h.xrGrip ? h.xrGrip.add(h.frame) : rig.add(h.frame); h.frame.position.set(0, 0, 0); h.frame.quaternion.identity(); h.frame.visible = !!h.xrGrip; }
    P.pitch = 0; camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0);
  };
  P.exitXR = () => { for (const h of P.hands) { camera.add(h.frame); h.frame.position.copy(REST[h.i]); h.frame.quaternion.identity(); } camera.position.set(0, P.eye, 0); };

  P.haptic = (side, k = 0.5, ms = 40) => {
    const h = P.hands[side]; const a = h.src && h.src.gamepad && h.src.gamepad.hapticActuators && h.src.gamepad.hapticActuators[0];
    if (a && a.pulse) { try { a.pulse(k, ms); } catch (e) { /* no rumble */ } }
    else if (input.pad && input.pad.vibrationActuator) { try { input.pad.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: k * 0.6, weakMagnitude: k }); } catch (e) { /* no rumble */ } }
  };

  /* ---------- holding things ---------- */
  P.grabbable = (h) => { // nearest thing to the glove's palm
    const palm = h.glove.localToWorld(_v.set(0, -0.02, -0.05)).clone();
    let best = null, bd = 0.14;
    for (const e of G.entities) {
      if (e.held || e.eating || e.removed) continue;
      let d;
      if (e.kind === 'person') { d = Infinity; for (const s of e.spheres()) d = Math.min(d, s.c.distanceTo(palm) - s.r); }
      else if (e.half) {
        _m.copy(e.obj.matrixWorld).invert(); const lp = palm.clone().applyMatrix4(_m);
        const hx = e.half.x, hy = e.half.y, hz = e.half.z;
        const cx = clamp(lp.x, -hx, hx), cy = clamp(lp.y, -hy, hy), cz = clamp(lp.z, -hz, hz);
        d = Math.hypot(lp.x - cx, lp.y - cy, lp.z - cz) * e.size;
      } else continue;
      if (e.special === 'mask') d -= 0.04; // the mask wins over its stand
      if (d < bd) { bd = d; best = e; }
    }
    if (best && best.def && best.def.id === 'stand' && G.mask && G.mask.glued) best = G.mask;
    return best;
  };
  P.grab = (h, e) => {
    if (!e) return;
    if (e.kind === 'gadget') { P.equip(h, e); return; }
    h.held = e; e.grab(h);
    h.frame.updateMatrixWorld(true);
    if (e.obj) e.obj.updateMatrixWorld(true);
    const ew = e.kind === 'person' ? bodyMatrix(e) : e.obj.matrixWorld;
    h.holdM.copy(h.frame.matrixWorld).invert().multiply(ew);
    audio.play('grab', h.pos, 0.6); P.haptic(h.i, 0.35, 30);
    if (e.special === 'mask') emit('maskGrabbed');
  };
  P.release = (h, throwIt = true) => {
    const e = h.held; if (!e) return;
    h.held = null;
    const v = avgVel(h).multiplyScalar(throwIt ? 1.15 : 0.3);
    if (v.length() > 3) audio.play('throw', h.pos, clamp(v.length() / 9, 0.3, 1));
    e.release(v, throwIt ? h.ang.clone().multiplyScalar(0.8) : null);
  };
  P.equip = (h, g) => {
    if (h.gadget === g) return;
    if (h.gadget) P.drop(h);
    if (h.held) P.release(h, false);
    const other = P.hands[1 - h.i]; if (other.gadget === g) other.gadget = null;
    h.gadget = g; g.attach(); g.grab(h); audio.play('grab', h.pos, 0.6);
    P.inventory.set(g.gid, g);
  };
  P.drop = (h) => { const g = h.gadget; if (!g) return; h.gadget = null; g.release(avgVel(h), null); };
  P.holster = (h) => { const g = h.gadget; if (!g) return; h.gadget = null; g.release(null, null); g.detach(); };
  P.takeOut = (h, id) => {
    let g = P.inventory.get(id);
    if (g && (g.held && g.held !== h)) g = null;
    if (!g || g.eating) g = G.gadgets.spawn(id, h.pos.clone());
    if (h.gadget && h.gadget !== g) P.holster(h);
    P.equip(h, g);
  };

  /* ---------- getting hit ---------- */
  on('playerHit', (by, dir) => {
    fx.wash(0xb3141f, 0.38, 0.45); audio.play('ouch', P.headPos, 0.9);
    P.haptic(0, 0.9, 120); P.haptic(1, 0.9, 120);
    P.hurtPush.copy(dir).setY(0).normalize().multiplyScalar(G.xr ? 0.5 : 2.2);
  });

  /* ---------- every frame ---------- */
  P.update = (dt) => {
    if (G.xr) updateXR(P, dt); else updateDesktop(P, dt);
    // where the head is
    rig.updateMatrixWorld(true);
    camera.getWorldPosition(P.headPos); camera.getWorldQuaternion(P.headQuat);
    for (const h of P.hands) handPhysics(P, h, dt);
    // putting the mask on: bring it to your face
    if (!G.wearing) for (const h of P.hands) if (h.held && h.held.special === 'mask' && h.held.obj.position.distanceTo(P.headPos) < (G.xr ? 0.26 : 0.6)) P.wearMask(h);
    updateWatch(P);
  };
  P.wearMask = (h) => {
    const m = h.held; h.held = null; m.held = null; m.detach();
    G.wearing = true; unlock('mask');
    audio.play('mask_on', null, 1); fx.wash(0xe8d7a8, 0.75, 1.1); P.haptic(0, 0.6, 80); P.haptic(1, 0.6, 80);
    emit('maskOn');
  };
  // one recording row (see copies.js for the layout)
  P.recordRow = (out) => {
    out[0] = P.headPos.x; out[1] = P.headPos.y; out[2] = P.headPos.z;
    out[3] = P.headQuat.x; out[4] = P.headQuat.y; out[5] = P.headQuat.z; out[6] = P.headQuat.w;
    for (let i = 0; i < 2; i++) {
      const h = P.hands[i], o = i ? 16 : 7;
      out[o] = h.pos.x; out[o + 1] = h.pos.y; out[o + 2] = h.pos.z;
      out[o + 3] = h.quat.x; out[o + 4] = h.quat.y; out[o + 5] = h.quat.z; out[o + 6] = h.quat.w;
      out[o + 7] = h.poseGrip || 0; out[o + 8] = h.poseTrig || 0;
      out[25 + i] = h.gadget ? GADGET_IDS.indexOf(h.gadget.gid) + 1 : 0;
    }
    return out;
  };
  P.fire = (h) => {
    const g = h.gadget; if (!g) return;
    g.obj.updateMatrixWorld(true);
    const origin = g.muzzleWorld(), dir = g.aimDir();
    if (!G.xr) { // PC: aim at what the crosshair is on
      const cam = P.headPos, cd = new THREE.Vector3(0, 0, -1).applyQuaternion(P.headQuat);
      const hit = hitTest(cam, cd, 40, 'you'); const tgt = hit ? hit.point : cam.clone().addScaledVector(cd, 40);
      dir.subVectors(tgt, origin).normalize();
    }
    if (G.gadgets.fire(g.gid, origin, dir, 'you', g)) {
      G.loop.onFire(g.gid, h.i);
      P.haptic(h.i, g.gid === 'blaster' ? 0.45 : 0.7, g.gid === 'blackhole' ? 120 : 45);
      if (!G.xr) h.kick = 1;
    }
  };
  P.spawnFront = (dist = 1.3) => {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(P.headQuat); f.y = 0; if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const p = P.headPos.clone().addScaledVector(f, dist); p.y = 0; collideCircle(p, 0.35);
    return { p, yaw: Math.atan2(-f.x, -f.z) };
  };
  return P;
}

function bodyMatrix(e) {
  const b = e.body;
  return new THREE.Matrix4().compose(new THREE.Vector3(b.position.x, b.position.y, b.position.z), new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w), new THREE.Vector3(1, 1, 1));
}
function avgVel(h) {
  const v = new THREE.Vector3(); if (!h.hist.length) return v;
  for (const x of h.hist) v.add(x); return v.divideScalar(h.hist.length);
}

/* ---------- VR ---------- */
function updateXR(P, dt) {
  const L = P.hands[0], R = P.hands[1];
  const gp = (h) => (h.src && h.src.gamepad) || null;
  const btn = (h, i) => { const g = gp(h); return !!(g && g.buttons[i] && g.buttons[i].pressed); };
  const val = (h, i) => { const g = gp(h); return (g && g.buttons[i] && g.buttons[i].value) || 0; };
  const edge = (h, i) => { const d = btn(h, i), was = h.prevBtn[i]; h.prevBtn[i] = d; return d && !was; };
  const axes = (h) => { const g = gp(h); if (!g) return [0, 0]; const a = g.axes.length >= 4 ? [g.axes[2], g.axes[3]] : [g.axes[0], g.axes[1]]; return a.map((v) => (Math.abs(v) < 0.15 ? 0 : v)); };
  // menu (Y on the left controller)
  if (edge(L, 5)) G.ui.toggleVRMenu();
  const menuOpen = G.ui.vrMenuOpen;
  // move with the left stick, turn with the right stick
  const [mx, my] = axes(L);
  if (mx || my) {
    const yaw = headYaw(P), s = S.moveSpeed * dt;
    _v.set(mx, 0, my).applyAxisAngle(UP, yaw).multiplyScalar(s); P.rig.position.add(_v);
  }
  const [tx] = axes(R);
  if (S.turn === 'snap') {
    if (Math.abs(tx) > 0.7 && !P.snapped) { P.snapped = true; turnAroundHead(P, -Math.sign(tx) * S.snapAngle * Math.PI / 180); }
    if (Math.abs(tx) < 0.3) P.snapped = false;
  } else if (tx) turnAroundHead(P, -tx * 2.2 * dt);
  // keep your head inside the room
  P.rig.updateMatrixWorld(true); P.camera.getWorldPosition(_v);
  const before = _v.clone(); collideCircle(_v, 0.2, 0.3, 2.2);
  P.rig.position.add(_v.sub(before));
  if (P.hurtPush.lengthSq() > 1e-4) { P.rig.position.addScaledVector(P.hurtPush, dt * 3); P.hurtPush.multiplyScalar(Math.exp(-8 * dt)); }

  for (const h of P.hands) {
    h.grip = val(h, 1); h.trigger = val(h, 0);
    const squeeze = h.grip > 0.6, wasSqueeze = h.squeezed; h.squeezed = h.grip > (wasSqueeze ? 0.4 : 0.6);
    if (h.squeezed && !wasSqueeze && !h.held && !h.gadget) P.grab(h, P.grabbable(h));
    if (!h.squeezed && wasSqueeze) { if (h.held) P.release(h, true); else if (h.gadget) P.drop(h); }
    void squeeze;
    const trig = h.trigger > 0.55, wasTrig = h.trigDown; h.trigDown = h.trigger > (wasTrig ? 0.35 : 0.55);
    const pointingAtMenu = menuOpen && h.i === 1;
    if (h.gadget && !pointingAtMenu && h.trigDown && (!wasTrig || h.gadget.gid === 'blaster')) P.fire(h);
    void trig;
    h.poseGrip = h.gadget ? 1 : Math.max(h.grip, h.held ? 1 : 0); h.poseTrig = h.gadget ? h.trigger * 0.4 : h.trigger;
    h.glove.userData.pose(h.poseGrip, h.poseTrig, !h.gadget && h.grip > 0.5 && h.trigger < 0.1);
  }
  if (edge(R, 4)) G.loop.pressRecord();                 // A
  if (edge(R, 5) && P.lastSpawn) G.ui.spawn(P.lastSpawn); // B: same thing again
  if (edge(L, 4)) G.ui.cycleGadget(L);                   // X: next gadget into the left hand
  if (menuOpen && R.xrRay) {
    R.xrRay.updateMatrixWorld(true);
    const o = R.xrRay.getWorldPosition(new THREE.Vector3()), d = new THREE.Vector3(0, 0, -1).applyQuaternion(R.xrRay.getWorldQuaternion(new THREE.Quaternion()));
    G.ui.vrPointer(o, d, R.trigDown && !R.menuTrig);
  }
  R.menuTrig = R.trigDown;
}
function headYaw(P) { const f = _v2.set(0, 0, -1).applyQuaternion(P.camera.getWorldQuaternion(_q)); return Math.atan2(-f.x, -f.z); }
function turnAroundHead(P, a) {
  P.camera.getWorldPosition(_v);
  P.rig.position.sub(_v).applyAxisAngle(UP, a).add(_v);
  P.rig.rotateY(a);
}

/* ---------- PC / phone ---------- */
function updateDesktop(P, dt) {
  pollDesktop(dt);
  const paused = G.paused;
  if (!paused) {
    P.yaw += input.look.x; P.pitch = clamp(P.pitch + input.look.y, -1.45, 1.45);
  }
  P.rig.rotation.set(0, P.yaw, 0);
  P.crouch = input.down('KeyC') || input.down('ControlLeft') || (input.padHeld && input.padHeld(11));
  P.eye = damp(P.eye, P.crouch ? CROUCH : EYE, 12, dt);
  const run = input.down('ShiftLeft') || input.down('ShiftRight') || (input.padHeld && input.padHeld(10));
  if (!paused && (input.move.x || input.move.y)) {
    const sp = (run ? 4.2 : 2.3) * (P.crouch ? 0.5 : 1) * dt;
    _v.set(input.move.x, 0, -input.move.y).applyAxisAngle(UP, P.yaw).multiplyScalar(sp); P.rig.position.add(_v);
  }
  if (!paused && (input.hit('Space') || input.padHit[0]) && P.rig.position.y <= 0.001) P.vy = 3.6;
  P.vy -= 9.8 * dt; P.rig.position.y = Math.max(0, P.rig.position.y + P.vy * dt); if (P.rig.position.y <= 0) P.vy = 0;
  if (P.hurtPush.lengthSq() > 1e-4) { P.rig.position.addScaledVector(P.hurtPush, dt); P.hurtPush.multiplyScalar(Math.exp(-6 * dt)); }
  collideCircle(P.rig.position, 0.28, 0.2, 1.7);
  P.camera.position.set(0, P.eye, 0); P.camera.rotation.set(P.pitch, 0, 0, 'YXZ');

  const L = P.hands[0], R = P.hands[1];
  if (!paused) {
    const fireBtn = input.mouseDown[0] || input.padHit[7] || (G.touchFire && G.touchFire());
    const fireHeld = input.mouse[0] || (input.padHeld && input.padHeld(7)) || (G.touchHeld && G.touchHeld('fire'));
    const held = R.held || L.held;
    if (held && fireBtn) { // throw what you're carrying
      const h = R.held ? R : L; const f = new THREE.Vector3(0, 0, -1).applyQuaternion(P.headQuat);
      const e = h.held; h.held = null; e.release(f.multiplyScalar(9).add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 4 - 2, 0));
      audio.play('throw', P.headPos, 0.8);
    } else if (R.gadget && (fireBtn || (fireHeld && R.gadget.gid === 'blaster'))) P.fire(R);
    else if (fireBtn) punch(R);
    if (input.mouseDown[2] || input.padHit[6] || (G.touchPunch && G.touchPunch())) punch(L);
    if (input.hit('KeyE') || input.padHit[2] || (G.touchGrab && G.touchGrab())) {
      if (held) { const h = R.held ? R : L; P.release(h, false); }
      else {
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(P.headQuat);
        const hit = hitTest(P.headPos, f, 2.6, 'you');
        let e = hit && hit.ent;
        if (e && e.def && e.def.id === 'stand' && G.mask && G.mask.glued) e = G.mask; // the mask sits on the stand
        if (e && (e.kind === 'gadget' || e.kind === 'prop' || e.kind === 'person') && !e.held) {
          if (e.kind === 'gadget') P.equip(R, e);
          else { const h = R.gadget ? L : R; h.held = e; e.grab(h); h.holdDist = clamp(hit.dist, 0.9, 1.6); audio.play('grab', P.headPos, 0.6); if (e.special === 'mask') emit('maskGrabbed'); }
        }
      }
    }
    if (input.hit('KeyQ') || input.padHit[1]) { if (R.gadget) P.holster(R); }
    for (let k = 0; k < 7; k++) if (input.hit('Digit' + (k + 1))) { if (k === 0) P.holster(R); else P.takeOut(R, GADGETS[k - 1].id); }
    if (input.wheel || input.padHit[5] || input.padHit[4]) {
      const dirn = input.padHit[4] ? -1 : input.padHit[5] ? 1 : Math.sign(input.wheel); input.wheel = 0;
      const cur = R.gadget ? GADGET_IDS.indexOf(R.gadget.gid) + 1 : 0, n = (cur + dirn + 7) % 7;
      if (n === 0) P.holster(R); else P.takeOut(R, GADGET_IDS[n - 1]);
    }
    if (input.hit('KeyR') || input.padHit[3]) G.loop.pressRecord();
    if (input.hit('KeyF') && P.lastSpawn) G.ui.spawn(P.lastSpawn);
  }
  // where the gloves sit in view
  const bob = Math.sin(G.t * 9) * Math.min(1, Math.hypot(input.move.x, input.move.y)) * 0.012;
  for (const h of P.hands) {
    h.punchT = Math.min(1, h.punchT + dt / 0.3);
    const base = h.gadget ? AIM[h.i] : REST[h.i];
    const k = h.punchT < 1 ? Math.sin(h.punchT * Math.PI) : 0;
    _v.copy(base).lerp(PUNCH[h.i], k); _v.y += bob * (h.i ? 1 : -1);
    const narrow = clamp(P.camera.aspect / 1.6, 0.5, 1); _v.x *= narrow; // tall phone screen: gloves closer in
    if (h.kick) { _v.z += h.kick * 0.05; h.kick = Math.max(0, h.kick - dt * 8); }
    h.frame.position.copy(_v);
    h.frame.rotation.set(h.kick ? h.kick * 0.25 : 0, h.gadget ? (h.i ? 0.06 : -0.06) : (h.i ? 0.15 : -0.15), 0);
    h.poseGrip = h.gadget || h.punchT < 1 || h.held ? 1 : 0.55; h.poseTrig = h.gadget ? 0.3 : h.poseGrip;
    h.glove.userData.pose(h.poseGrip, h.poseTrig, false);
    h.frame.visible = true;
  }
  function punch(h) { if (h.punchT < 0.7) return; h.punchT = 0; audio.play('swing', P.headPos, 0.25); }
}

/* ---------- shared: hand speed, carried things, punches, physics spheres ---------- */
function handPhysics(P, h, dt) {
  h.frame.updateMatrixWorld(true);
  h.frame.getWorldPosition(h.pos); h.frame.getWorldQuaternion(h.quat);
  const v = _v.subVectors(h.pos, h.prev).divideScalar(Math.max(dt, 1e-3));
  if (h.prev.lengthSq() === 0 || v.length() > 20) v.set(0, 0, 0); // a jump that big is tracking loss, not a punch
  h.vel.copy(v); h.hist.push(v.clone()); if (h.hist.length > 5) h.hist.shift();
  _q.copy(h.prevQ).invert().premultiply(h.quat); // rotation this frame
  const ang = 2 * Math.acos(clamp(_q.w, -1, 1)); const ax = _v2.set(_q.x, _q.y, _q.z); if (ax.lengthSq() > 1e-8) ax.normalize();
  h.ang.copy(ax).multiplyScalar(ang / Math.max(dt, 1e-3));
  h.prev.copy(h.pos); h.prevQ.copy(h.quat);
  // the physics glove
  h.body.position.set(h.pos.x, h.pos.y, h.pos.z); h.body.velocity.set(h.vel.x, h.vel.y, h.vel.z);
  // carried thing
  if (h.held) {
    const e = h.held;
    if (G.xr) { _m.multiplyMatrices(h.frame.matrixWorld, h.holdM); }
    else { // PC: floats in front of you
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(P.headQuat);
      if (e.special === 'mask') h.holdDist = damp(h.holdDist || 1, -0.2, 2.5, dt); // the mask comes up to your face
      const target = P.headPos.clone().addScaledVector(f, (h.holdDist || 1.1) + (e.radius || 0.3) * 0.5); target.y -= 0.15;
      const cur = e.kind === 'person' ? new THREE.Vector3(e.body.position.x, e.body.position.y, e.body.position.z) : e.obj.position.clone();
      cur.lerp(target, 1 - Math.exp(-14 * dt));
      const q = e.kind === 'person' ? new THREE.Quaternion().setFromAxisAngle(UP, P.yaw + Math.PI) : e.obj.quaternion;
      _m.compose(cur, q, new THREE.Vector3(1, 1, 1));
    }
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3(); _m.decompose(pos, quat, sc);
    const old = e.kind === 'person' ? new THREE.Vector3(e.body.position.x, e.body.position.y, e.body.position.z) : e.obj.position.clone();
    const vel = pos.clone().sub(old).divideScalar(Math.max(dt, 1e-3));
    if (vel.length() > 30) vel.setLength(30);
    e.holdAt(pos, quat, vel);
    if (e.removed) h.held = null;
  }
  // held gadget: handle in the fist
  if (h.gadget) {
    const g = h.gadget;
    _m.multiplyMatrices(h.frame.matrixWorld, gadgetMountMatrix(h.i, _m2));
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), sc = new THREE.Vector3(); _m.decompose(pos, quat, sc);
    pos.sub(g.model.position.clone().applyQuaternion(quat)); // the model sits off-center inside its prop
    g.holdAt(pos, quat, h.vel);
    if (g.removed) { g.attach(); }
  }
  // punches (any fast glove)
  const sp = h.vel.length();
  if (sp > 1.8 && !h.held) {
    const wp = h.glove.localToWorld(_v.set(0, 0, -0.06)).clone();
    for (const p of G.people.list) {
      if (p.removed || (h.cool.get(p) || 0) > G.t) continue;
      for (const s of p.spheres()) {
        if (s.c.distanceTo(wp) < s.r + 0.08) {
          h.cool.set(p, G.t + 0.3);
          const dir = h.vel.clone().normalize(), dmg = clamp((sp - 1.5) * 8, 5, 45);
          audio.play('punch', wp, clamp(sp / 6, 0.4, 1)); P.haptic(h.i, clamp(sp / 6, 0.4, 1), 60);
          p.hurt(dmg, dir, wp.clone(), 'punch', 'you');
          if (p.state === 'tumble') p.push(dir, sp * 14);
          emit('personShot', p, 'you');
          break;
        }
      }
    }
    for (const c of G.loop.copies) {
      if (c.gone || (h.cool.get(c) || 0) > G.t) continue;
      if (c.facePos.distanceTo(wp) < 0.45 || c.bodyPos.distanceTo(wp) < 0.38) {
        h.cool.set(c, G.t + 0.4); c.hit(h.vel.clone().normalize(), clamp(sp / 4, 0.5, 2));
        audio.play('punch', wp, 0.7); P.haptic(h.i, 0.6, 50);
      }
    }
  }
}

/* ---------- the wrist watch ---------- */
import { toon, PAL } from './toon.js';
function buildWatch() {
  const g = new THREE.Group();
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.007, 6, 18), toon({ color: 0x3c2219 })); strap.scale.set(1, 0.74, 1.6); g.add(strap);
  const caseM = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.009, 18), toon({ color: PAL.brass })); caseM.position.y = 0.036; g.add(caseM);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.017, 18), toon({ color: 0xfaf3e2 })); face.rotation.x = -Math.PI / 2; face.position.y = 0.0412; g.add(face);
  const hand = new THREE.Group(); hand.position.y = 0.0418; g.add(hand);
  const hm = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.0008, 0.014), new THREE.MeshBasicMaterial({ color: PAL.teal })); hm.position.z = -0.006; hand.add(hm);
  const rec = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a3a })); rec.position.set(0.012, 0.0425, 0.012); g.add(rec);
  g.position.set(0, 0, 0.03); g.userData = { hand, rec };
  return g;
}
function updateWatch(P) {
  const w = P.watch.userData;
  w.hand.rotation.y = -G.loop.frac * Math.PI * 2;
  w.rec.visible = G.loop.mode === 'record' ? G.loop.recording && Math.sin(G.t * 8) > 0 : G.wearing && G.loop.frac > 0.85 && Math.sin(G.t * 10) > 0;
}
