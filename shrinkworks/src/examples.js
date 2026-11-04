// Ready-made builds (made from the same parts you have). Written with a tiny helper so joints line up exactly the
// way the Build tool lines them up.
import * as THREE from 'three';
import { DEFS } from './parts/defs.js';

const Y = new THREE.Vector3(0, 1, 0);
// a turn that points a part's up (+Y) along dir
const up = (x, y, z) => new THREE.Quaternion().setFromUnitVectors(Y, new THREE.Vector3(x, y, z).normalize());
const yaw = (deg) => new THREE.Quaternion().setFromAxisAngle(Y, deg * Math.PI / 180);

function blueprint() {
  let pid = 1, bid = 1;
  const bodies = [], wires = [];
  const B = {
    body(pos = [0, 0, 0]) { const b = { id: bid++, p: pos, q: [0, 0, 0, 1], parts: [] }; bodies.push(b); return b; },
    // part(body, type, position in the body, size, { q: Quaternion, m: material, c: color, pr: settings })
    part(b, t, p, s, o = {}) {
      const d = DEFS[t];
      const q = o.q || new THREE.Quaternion();
      const e = { i: pid++, t, p, q: [q.x, q.y, q.z, q.w], s: s || d.size, m: o.m || d.mat, c: o.c, pr: o.pr };
      b.parts.push(e);
      if (d.joint) {
        // the moving half: a new body at the joint, turned like this body, with the rotor on it
        const stub = { def: d, size: new THREE.Vector3(...e.s), props: { ...Object.fromEntries(d.props.map((x) => [x.k, x.def])), ...(o.pr || {}) } };
        const ax = Y.clone().applyQuaternion(q);
        const at = new THREE.Vector3(...p).addScaledVector(ax, d.joint.at(stub));
        const child = B.body([b.p[0] + at.x, b.p[1] + at.y, b.p[2] + at.z]);
        child.parent = b;
        const rp = ax.clone().multiplyScalar(d.joint.rotorAt(stub));
        child.parts.push({ i: pid++, t: d.joint.rotor, p: [rp.x, rp.y, rp.z], q: e.q, s: d.joint.rotorSize(stub), m: e.m, c: e.c, r: e.i });
        e.j = child.id;
        e.child = child;
      }
      return e;
    },
    wire(a, b) { wires.push([a.i, b.i]); },
    done() {
      // weld every part to the parts it touches in the same body
      for (const b of bodies) {
        const boxes = b.parts.map((e) => {
          const d = DEFS[e.t], q = new THREE.Quaternion(...e.q);
          const stub = { def: d, size: new THREE.Vector3(...e.s), props: {} };
          const hx = e.s[0] / 2, hy = d.halfH(stub), hz = e.s[2] / 2;
          const box = new THREE.Box3();
          for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) box.expandByPoint(new THREE.Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(q).add(new THREE.Vector3(...e.p)));
          return box.expandByScalar(0.03);
        });
        b.parts.forEach((e, i) => { e.l = b.parts.filter((o, j) => j !== i && boxes[i].intersectsBox(boxes[j])).map((o) => o.i); });
      }
      for (const b of bodies) { delete b.parent; for (const e of b.parts) delete e.child; }
      return { v: 1, bodies, wires };
    }
  };
  return B;
}

function car() {
  const B = blueprint();
  const c = B.body([0, 0.75, 0]);
  B.part(c, 'plate', [0, 0, 0], [2, 0.25, 4], { m: 'steel', c: '#c8332b' });
  B.part(c, 'seat', [0, 0.575, 0.3], null, { q: yaw(0) });
  B.part(c, 'block', [0, 0.375, -1.6], [1.75, 0.5, 0.75], { m: 'steel', c: '#c8332b' });
  B.part(c, 'pane', [0, 0.46, -0.9], [1.6, 0.7, 0.05], { m: 'glass', q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.35) });
  for (const x of [-0.6, 0.6]) B.part(c, 'light', [x, 0.4, -2.125], null, { q: up(0, 0, -1), pr: { glow: '#fff1d6', bright: 60 } });
  B.part(c, 'speaker', [0, 0.325, 1.8], null, { pr: { snd: 'bell' } });
  // back wheels on blocks under the car (same height as the front ones)
  for (const s of [-1, 1]) {
    B.part(c, 'block', [s * 0.75, -0.375, 1.2], [0.25, 0.5, 0.25], { m: 'iron' });
    B.part(c, 'wheel', [s * (0.875 + 0.21), -0.49, 1.2], [0.9, 0.32, 0.9], { q: up(s, 0, 0), m: 'alu' });
  }
  // front wheels on steering hinges under the car, with a small block to hold each wheel
  for (const s of [-1, 1]) {
    const st = B.part(c, 'steer', [s * 0.75, -0.245, -1.2], [0.5, 0.24, 0.5], { q: up(0, -1, 0), pr: { angle: 32 } });
    const k = st.child;
    B.part(k, 'block', [0, -0.245, 0], [0.25, 0.25, 0.25], { m: 'iron' });
    B.part(k, 'wheel', [s * (0.125 + 0.21), -0.245, 0], [0.9, 0.32, 0.9], { q: up(s, 0, 0), m: 'alu' });
  }
  return B.done();
}

function rocket() {
  const B = blueprint();
  const r = B.body([0, 1.4, 0]);
  B.part(r, 'cylinder', [0, 2.125, 0], [1.4, 4, 1.4], { m: 'plastic', c: '#e8e8e8' });
  B.part(r, 'cone', [0, 4.875, 0], [1.4, 1.5, 1.4], { m: 'steel', c: '#c8332b' });
  B.part(r, 'plate', [0, 0, 0], [3.4, 0.25, 3.4], { m: 'alu' });
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) B.part(r, 'thruster', [x, -0.725, z], [0.75, 1.2, 0.75], { q: up(0, -1, 0), pr: { power: 80 } });
  B.part(r, 'gyro', [0, 0.425, -1.1], null);
  B.part(r, 'seat', [0, 0.575, 1.2], null);
  B.part(r, 'smoke', [0, -0.325, 0], null, { q: up(0, -1, 0), pr: { on: false, input: 'lift' } });
  for (const a of [45, 135, 225, 315]) {
    const q = yaw(a);
    const v = new THREE.Vector3(0, 0, 1.05).applyQuaternion(q);
    B.part(r, 'wedge', [v.x, 0.775, v.z], [0.1, 1.3, 0.7], { q: q.clone().multiply(yaw(180)), m: 'steel', c: '#c8332b' });
  }
  return B.done();
}

function robot() {
  const B = blueprint();
  const b = B.body([0, 0.8, 0]);
  B.part(b, 'block', [0, 0.6, 0], [1.2, 1.2, 1.0], { m: 'steel', c: '#e5762a' });
  B.part(b, 'brain', [0, 1.35, 0.25], null, { pr: { mode: 'follow', target: 'you', speed: 55 } });
  for (const s of [-1, 1]) B.part(b, 'wheel', [s * (0.6 + 0.21), 0.1, 0], [0.8, 0.32, 0.8], { q: up(s, 0, 0), m: 'iron' });
  B.part(b, 'ball', [0, -0.05, 0.25], [0.35, 0.35, 0.35], { m: 'chrome' });
  B.part(b, 'ball', [0, -0.05, -0.25], [0.35, 0.35, 0.35], { m: 'chrome' });
  const neck = B.part(b, 'motor', [0, 1.35, -0.2], [0.4, 0.3, 0.4], { pr: { on: true, speed: 5, input: 'none' } });
  B.part(neck.child, 'block', [0, 0.285, 0], [0.7, 0.45, 0.6], { m: 'steel', c: '#2b2d31' });
  for (const x of [-0.16, 0.16]) B.part(neck.child, 'light', [x, 0.3, -0.45], null, { q: up(0, 0, -1), pr: { glow: '#38d6ff', bright: 25, range: 6 } });
  for (const s of [-1, 1]) {
    const sh = B.part(b, 'balljoint', [s * (0.6 + 0.15), 0.95, 0], [0.3, 0.3, 0.3], { q: up(s, 0, 0) });
    B.part(sh.child, 'beam', [s * 0.2, -0.4, 0], [0.18, 0.9, 0.18], { m: 'alu' });
  }
  return B.done();
}

function blackHoleMachine() {
  const B = blueprint();
  const base = B.body([0, 0.25, 0]);
  B.part(base, 'plate', [0, 0, 0], [3, 0.5, 3], { m: 'concrete' });
  B.part(base, 'cylinder', [0, 1.25, 0], [0.5, 2, 0.5], { m: 'iron' });
  const hole = B.part(base, 'blackhole', [0, 2.85, 0], [1.2, 1.2, 1.2], { pr: { range: 22, power: 45 } });
  const sw = B.part(base, 'switch', [1.2, 0.35, 1.2], null);
  B.wire(sw, hole);
  for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3]]) B.part(base, 'light', [x, 0.4, z], null, { pr: { glow: '#ff9a2a', bright: 30 } });
  const bp = B.done();
  bp.bodies[0].fz = true;
  return bp;
}

function hoverCar() {
  const B = blueprint();
  const h = B.body([0, 1.2, 0]);
  B.part(h, 'plate', [0, 0, 0], [2.2, 0.25, 3.5], { m: 'alu', c: '#2f6fd1' });
  B.part(h, 'seat', [0, 0.575, 0.4], null);
  for (const [x, z] of [[-0.8, -1.2], [0.8, -1.2], [-0.8, 1.2], [0.8, 1.2]]) B.part(h, 'hover', [x, -0.225, z], [0.8, 0.2, 0.8], { q: up(0, -1, 0), pr: { height: 1.2 } });
  B.part(h, 'thruster', [0, 0.125, 1.75 + 0.4], [0.5, 0.8, 0.5], { q: up(0, 0, 1), pr: { power: 45 } });
  B.part(h, 'thruster', [0, 0.125, -1.75 - 0.3], [0.375, 0.6, 0.375], { q: up(0, 0, -1), pr: { power: 30 } });
  for (const s of [-1, 1]) B.part(h, 'thruster', [s * (1.1 + 0.3), 0.125, 0], [0.375, 0.6, 0.375], { q: up(s, 0, 0), pr: { power: 25 } });
  B.part(h, 'gyro', [0, 0.425, -0.9], null);
  return B.done();
}

function launcher() {
  const B = blueprint();
  const base = B.body([0, 0.25, 0]);
  B.part(base, 'plate', [0, 0, 0], [3, 0.5, 3], { m: 'tread' });
  const pis = B.part(base, 'piston', [0, 0.65, 0], [0.6, 0.8, 0.6], { pr: { length: 2.5, speed: 100, power: 100 } });
  B.part(pis.child, 'plate', [0, 0.1125, 0], [2, 0.125, 2], { m: 'steel', c: '#f2c230' });
  const btn = B.part(base, 'button', [1.25, 0.35, 1.25], null, { pr: { hold: 1.2 } });
  B.wire(btn, pis);
  const bp = B.done();
  bp.bodies[0].fz = true;
  // something to throw
  const box = { id: 99, p: [0, 1.9, 0], q: [0, 0, 0, 1], parts: [{ i: 999, t: 'crate', p: [0, 0, 0], q: [0, 0, 0, 1], s: [0.8, 0.8, 0.8], m: 'planks' }] };
  bp.bodies.push(box);
  return bp;
}

function tower() {
  const B = blueprint();
  const bp = { v: 1, bodies: [], wires: [] };
  let id = 1;
  for (let y = 0; y < 8; y++) {
    for (let i = 0; i < 4; i++) {
      const along = y % 2 === 0;
      const off = (i - 1.5) * 0.75;
      const b = { id: id++, p: along ? [off, 0.25 + y * 0.5, 0] : [0, 0.25 + y * 0.5, off], q: [0, 0, 0, 1], parts: [{ i: id * 10, t: 'crate', p: [0, 0, 0], q: [0, 0, 0, 1], s: along ? [0.7, 0.5, 3] : [3, 0.5, 0.7], m: i === 1 ? 'brick' : 'planks' }] };
      bp.bodies.push(b);
    }
  }
  bp.bodies.push({ id: id++, p: [2.4, 0.45, 0], q: [0, 0, 0, 1], parts: [{ i: 7001, t: 'explosive', p: [0, 0, 0], q: [0, 0, 0, 1], s: [0.6, 0.9, 0.6], m: 'steel', c: '#b3241c' }] });
  bp.bodies.push({ id: id++, p: [-2.4, 0.45, 0.5], q: [0, 0, 0, 1], parts: [{ i: 7002, t: 'explosive', p: [0, 0, 0], q: [0, 0, 0, 1], s: [0.6, 0.9, 0.6], m: 'steel', c: '#b3241c' }] });
  void B;
  return bp;
}

function windmill() {
  const B = blueprint();
  const base = B.body([0, 0.25, 0]);
  B.part(base, 'plate', [0, 0, 0], [2.5, 0.5, 2.5], { m: 'concrete' });
  B.part(base, 'block', [0, 3.25, 0], [0.8, 6, 0.8], { m: 'brick' });
  const m = B.part(base, 'motor', [0, 5.6, -0.4 - 0.25], [0.6, 0.5, 0.6], { q: up(0, 0, -1), pr: { on: true, speed: 6, power: 90, input: 'none' } });
  for (let i = 0; i < 4; i++) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), i * Math.PI / 2);
    const v = new THREE.Vector3(0, 1.95, 0).applyQuaternion(q);
    B.part(m.child, 'block', [v.x, v.y, -0.14], [0.6, 3.6, 0.08], { q, m: 'plywood' });
  }
  const bp = B.done();
  bp.bodies[0].fz = true;
  return bp;
}


/* ---------------- SHRINKWORKS gadgets ---------------- */
// every electric example gets an Infinity Battery welded on top of its main body
function withBattery(data) {
  const b = data.bodies[0];
  if (!b || b.parts.some((e) => DEFS[e.t] && DEFS[e.t].battery)) return data;
  let top = -Infinity, under = null;
  for (const e of b.parts) {
    const d = DEFS[e.t];
    if (!d) continue;
    const stub = { def: d, size: new THREE.Vector3(...e.s), props: {} };
    const box = new THREE.Box3();
    const q = new THREE.Quaternion(...e.q), hx = e.s[0] / 2, hy = d.halfH(stub), hz = e.s[2] / 2;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) box.expandByPoint(new THREE.Vector3(sx * hx, sy * hy, sz * hz).applyQuaternion(q).add(new THREE.Vector3(...e.p)));
    if (Math.abs(e.p[0]) < 1.5 && Math.abs(e.p[2]) < 1.5 && box.max.y > top) { top = box.max.y; under = e; }
  }
  if (!under) return data;
  const id = Math.max(...data.bodies.flatMap((x) => x.parts.map((e) => e.i))) + 1;
  b.parts.push({ i: id, t: 'battery_inf', p: [under.p[0], top + 0.4, under.p[2]], q: [0, 0, 0, 1], s: [0.36, 0.8, 0.36], m: 'chrome', l: [under.i] });
  under.l = [...(under.l || []), id];
  return data;
}
function rayGun(mode) {
  const B = blueprint();
  const c = B.body([0, 0.6, 0]);
  B.part(c, 'handle', [0, 0, 0]);
  B.part(c, 'size_ray', [0, 0.71, -0.2], null, { q: up(0, 0, -1), pr: { mode, speed: 45 } });
  B.part(c, 'battery_aa', [0.24, 0.63, 0.02], null, { q: up(0, 0, 1) });
  return B.done();
}
function fxGun(mode) {
  const B = blueprint();
  const c = B.body([0, 0.6, 0]);
  B.part(c, 'handle', [0, 0, 0]);
  B.part(c, 'fx_ray', [0, 0.71, -0.2], null, { q: up(0, 0, -1), pr: { mode } });
  B.part(c, 'battery_aa', [0.24, 0.63, 0.02], null, { q: up(0, 0, 1) });
  return B.done();
}
function rewindRemote() {
  const B = blueprint();
  const c = B.body([0, 0.6, 0]);
  B.part(c, 'handle', [0, 0, 0]);
  B.part(c, 'time_core', [0, 0.78, -0.05], [0.45, 0.45, 0.45], { pr: { mode: 'rewind' } });
  B.part(c, 'battery_aa', [0.3, 0.63, 0.1], null, { q: up(0, 0, 1) });
  return B.done();
}
function slowMoGrenade() {
  const B = blueprint();
  const c = B.body([0, 0.3, 0]);
  const core = B.part(c, 'time_core', [0, 0, 0], [0.5, 0.5, 0.5], { pr: { mode: 'slow' } });
  const sw = B.part(c, 'switch', [0, 0.35, 0], [0.3, 0.2, 0.3]);
  B.part(c, 'battery_9v', [0.49, 0, 0], null, { q: up(1, 0, 0) });
  B.wire(sw, core);
  return B.done();
}
function spyCam() {
  const B = blueprint();
  const cam = B.body([0, 0.15, -1.6]);
  B.part(cam, 'plate', [0, 0, 0], [1, 0.3, 1], { m: 'iron' });
  B.part(cam, 'pipe', [0, 0.85, 0], [0.12, 1.4, 0.12], { m: 'chrome' });
  B.part(cam, 'camera', [0, 1.73, 0], null, { pr: { channel: 1 } });
  B.part(cam, 'battery_9v', [0.3, 0.39, 0.25]);
  const scr = B.body([0, 0.15, 0.6]);
  B.part(scr, 'plate', [0, 0, 0], [1.4, 0.3, 0.8], { m: 'iron' });
  B.part(scr, 'screen', [0, 0.65, 0], null, { pr: { channel: 1 } });
  B.part(scr, 'battery_9v', [0.55, 0.39, -0.2]);
  return B.done();
}
// stand under it and poke the red button: the ray shrinks you. Green grows you back.
function shrinkBooth() {
  const B = blueprint();
  const c = B.body([0, 0.15, 0]);
  B.part(c, 'plate', [0, 0, 0], [9, 0.3, 9], { m: 'tread' });
  B.part(c, 'pipe', [3.6, 10.15, 3.6], [0.5, 20, 0.5], { m: 'steel', c: '#e8e8e8' });
  B.part(c, 'plate', [1.8, 20.3, 1.8], [4.4, 0.3, 4.4], { m: 'steel', c: '#e8e8e8' });
  const shrink = B.part(c, 'size_ray', [-0.5, 19.7, 0], [0.5, 1.4, 0.5], { q: up(0, -1, 0), pr: { mode: 'shrink', speed: 55, range: 40 } });
  const grow = B.part(c, 'size_ray', [0.5, 19.7, 0], [0.5, 1.4, 0.5], { q: up(0, -1, 0), pr: { mode: 'grow', speed: 55, range: 40 } });
  B.part(c, 'block', [3.6, 10, 3.0], [0.9, 1.4, 0.7], { m: 'plastic', c: '#2b2d31' });
  const red = B.part(c, 'button', [3.6, 10.35, 2.6], [0.6, 0.3, 0.6], { q: up(0, 0, -1), pr: { hold: 1.2 } });
  const green = B.part(c, 'button', [3.6, 9.65, 2.6], [0.6, 0.3, 0.6], { q: up(0, 0, -1), pr: { hold: 1.2 } });
  B.part(c, 'battery_car', [2.6, 1.025, 2.4]);
  B.wire(red, shrink);
  B.wire(green, grow);
  const d = B.done();
  for (const e of d.bodies[0].parts) if (e.t === 'button' && e.p[1] < 10) e.c = '#5aa339';
  d.frozen = true;
  return d;
}

const LIST0 = [
  { name: 'Shrink Gun', desc: 'Hold it by the handle, pull the trigger: whatever the beam hits gets smaller.', make: () => rayGun('shrink') },
  { name: 'Grow Gun', desc: 'Same, but things get bigger. Try it on an apple.', make: () => rayGun('grow') },
  { name: 'Clone Gun', desc: 'Pull the trigger at anything: a copy pops out. Copy a whole gadget, an apple, anything.', make: () => fxGun('clone') },
  { name: 'Freeze Gun', desc: 'Pins whatever it hits right where it is, even in mid-air. Throw something, then freeze it.', make: () => fxGun('freeze') },
  { name: 'Launcher Gun', desc: 'Shoves whatever it hits across the kitchen.', make: () => fxGun('launch') },
  { name: 'Eraser Gun', desc: 'Makes things disappear. B (undo) brings them back.', make: () => fxGun('erase') },
  { name: 'Rewind Remote', desc: 'Hold the trigger: the whole kitchen goes back in time (up to 15 seconds). You do not.', make: rewindRemote },
  { name: 'Slow-Mo Cube', desc: 'Flip its switch: everything moves in slow motion until you flip it back.', make: slowMoGrenade },
  { name: 'Spy Cam', desc: 'A camera on a stand and a screen showing what it sees, live.', make: spyCam },
  { name: 'Shrink Booth', desc: 'Stand under it. Red button shrinks you, green grows you back.', make: shrinkBooth },
  { name: 'Toy Car', desc: 'Shrink down, sit in it (A in VR, E on PC). Sticks or W / S drive.', make: car },
  { name: 'Rocket', desc: 'Sit, hold Space to take off. The gyro keeps it straight.', make: rocket },
  { name: 'Robot Buddy', desc: 'Follows you around. Its head looks around by itself.', make: robot },
  { name: 'Black Hole Machine', desc: 'Flip the switch (E). Stand back.', make: blackHoleMachine },
  { name: 'Hover Car', desc: 'Floats. W forward, A / D turn, S brake.', make: hoverCar },
  { name: 'Launcher', desc: 'Press the button. Put stuff on the plate.', make: launcher },
  { name: 'Firecracker Tower', desc: 'A tower with two little explosive barrels. Throw something at a barrel.', make: tower },
  { name: 'Windmill', desc: 'A big spinning windmill on a motor.', make: windmill }
];

// electric examples get a battery so they work right away
export const EXAMPLES = LIST0.map((e) => ({ ...e, make: () => withBattery(e.make()) }));
