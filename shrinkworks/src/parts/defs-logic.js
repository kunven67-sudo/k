// Control parts (seats, buttons, switches, sensors, timers, logic, brains), sci-fi parts and effects.
import * as THREE from 'three';
import * as geo from './geo.js';
import { mk, grp, M, P, lens, labelTexture } from './common.js';
import { partMaterial } from '../core/mats.js';
import { beamMaterial, bubbleMaterial, portalMaterial, blackHoleMaterial, diskMaterial } from '../fx/shaders.js';
import { worldPos, worldUp, worldQuat, push, pushCenter, velAt, clamp, bodyPos } from './rt.js';

const mat = (p) => partMaterial(p.mat, p.color);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const box = (p) => [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }];
const lamp = (color) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(color), emissiveIntensity: 0, roughness: 0.3 });

function seatMesh(p, straps) {
  const w = p.size.x, d = p.size.z, f = M.fabric;
  const g = grp(
    mk(geo.box(w, 0.08, d, 0.02), mat(p), 0, -p.size.y / 2 + 0.04, 0),
    mk(geo.box(w * 0.92, 0.14, d * 0.9, 0.05), f, 0, -p.size.y / 2 + 0.15, 0.02),
    mk(geo.box(w * 0.92, p.size.y * 0.75, 0.14, 0.05), f, 0, -p.size.y / 2 + 0.22 + p.size.y * 0.375, d / 2 - 0.07),
    mk(geo.box(0.06, 0.3, d * 0.8, 0.02), mat(p), -w / 2 + 0.03, -p.size.y / 2 + 0.3, 0.02),
    mk(geo.box(0.06, 0.3, d * 0.8, 0.02), mat(p), w / 2 - 0.03, -p.size.y / 2 + 0.3, 0.02));
  if (straps) {
    for (const x of [-0.16, 0.16]) g.add(mk(geo.box(0.07, p.size.y * 0.7, 0.015, 0.005), M.strap, x * w, -p.size.y / 2 + 0.2 + p.size.y * 0.35, d / 2 - 0.15));
    g.add(mk(geo.box(w * 0.94, 0.07, 0.015, 0.005), M.strap, 0, -p.size.y / 2 + 0.32, -d / 2 + 0.2));
    g.add(mk(geo.box(0.09, 0.07, 0.03, 0.01), M.chrome, 0, -p.size.y / 2 + 0.32, -d / 2 + 0.19));
  }
  return g;
}

const SIGNAL_TARGET_NOTE = 'Wire a button, switch, sensor or timer to it to work it without a seat.';

export const LOGIC = [
  /* ---------------- control ---------------- */
  {
    id: 'seat', name: 'Seat', cat: 'Control', desc: 'Sit in it (E) to drive the build: W / S, A / D, Space / C, keys 1-4. You face the way the seat faces.', size: [0.7, 0.9, 0.7], resize: null, mat: 'steel',
    shapes: (p) => [{ t: 'box', h: [p.size.x / 2, 0.12, p.size.z / 2], p: [0, -p.size.y / 2 + 0.12, 0] }, { t: 'box', h: [p.size.x / 2, p.size.y * 0.4, 0.08], p: [0, 0.05, p.size.z / 2 - 0.08] }],
    mesh: (p) => seatMesh(p, false), density: 300, seat: true
  },
  {
    id: 'strapchair', name: 'Strap Chair', cat: 'Control', desc: 'A seat with straps. Put a human or dummy on it and they cannot get off. You can still change their brain and heart.', size: [0.7, 0.9, 0.7], resize: null, mat: 'iron',
    shapes: (p) => [{ t: 'box', h: [p.size.x / 2, 0.12, p.size.z / 2], p: [0, -p.size.y / 2 + 0.12, 0] }, { t: 'box', h: [p.size.x / 2, p.size.y * 0.4, 0.08], p: [0, 0.05, p.size.z / 2 - 0.08] }],
    mesh: (p) => seatMesh(p, true), density: 400, seat: true, straps: true
  },
  {
    id: 'remote', name: 'Remote Control', cat: 'Control', desc: 'Drive a build from outside: press E on it, the camera follows the build. Press E again to stop.', size: [0.4, 0.2, 0.4], resize: null, mat: 'plastic', color: '#2b2d31',
    shapes: box,
    mesh: (p) => {
      const l = lamp('#34ff7a');
      const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.03), mat(p)), mk(geo.cyl(0.015, 0.35, 8), M.chrome, p.size.x * 0.3, 0.25, p.size.z * 0.3),
        mk(geo.ball(0.04, 10), l, -0.08, p.size.y / 2, 0));
      g.userData.lamp = l;
      return g;
    },
    remote: true,
    frame(p) { const l = p.mesh && p.mesh.userData.lamp; if (l) l.emissiveIntensity = p.st.driving ? 3 : 0.3; }
  },
  {
    id: 'button', name: 'Button', cat: 'Control', desc: 'Press it (E, or poke it in VR). Sends a signal down its wires for a moment.', size: [0.4, 0.2, 0.4], resize: null, mat: 'steel',
    shapes: box, source: true,
    mesh: (p) => {
      const cap = mk(geo.cyl(0.12, 0.08, 24), M.red, 0, p.size.y / 2 + 0.03, 0);
      const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.03), mat(p)), cap);
      g.userData.cap = cap;
      return g;
    },
    props: [{ k: 'hold', label: 'Signal time (s)', type: 'slider', min: 0.1, max: 10, step: 0.1, def: 1 }],
    use(p, ctx) { p.st.until = ctx.time + p.props.hold; ctx.sound('button', worldPos(p, _a), 0.7); },
    fixed(p, dt, ctx) { p.st.out = (p.st.until || 0) > ctx.time; },
    frame(p) { const c = p.mesh && p.mesh.userData.cap; if (c) c.position.y = p.size.y / 2 + (p.st.out ? 0.005 : 0.03); }
  },
  {
    id: 'switch', name: 'Switch', cat: 'Control', desc: 'Flip it on or off (E). Stays that way.', size: [0.4, 0.2, 0.4], resize: null, mat: 'steel',
    shapes: box, source: true,
    mesh: (p) => {
      const lever = mk(geo.box(0.05, 0.3, 0.05, 0.01), M.chrome, 0, 0.15, 0);
      const pivot = grp(lever, mk(geo.ball(0.05, 12), M.red, 0, 0.3, 0));
      pivot.position.y = p.size.y / 2;
      const l = lamp('#ff4a3a');
      const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.03), mat(p)), pivot, mk(geo.box(0.08, 0.02, 0.05, 0.005), l, 0, p.size.y / 2 + 0.005, p.size.z / 2 - 0.07));
      g.userData.pivot = pivot; g.userData.lamp = l;
      return g;
    },
    props: [P.on(false)],
    use(p, ctx) { p.props.on = !p.props.on; ctx.sound('button', worldPos(p, _a), 0.7); },
    fixed(p) { p.st.out = !!p.props.on; },
    frame(p) {
      const u = p.mesh && p.mesh.userData;
      if (!u || !u.pivot) return;
      u.pivot.rotation.x = p.st.out ? 0.5 : -0.5;
      u.lamp.emissiveIntensity = p.st.out ? 2.5 : 0;
    }
  },
  {
    id: 'sensor', name: 'Sensor', cat: 'Control', desc: 'Sends a signal when anything comes close: people, you, other builds.', size: [0.4, 0.3, 0.4], resize: null, mat: 'plastic', color: '#d9d9d9',
    shapes: box, source: true,
    mesh: (p) => {
      const l = lamp('#ffb020');
      const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.04), mat(p)), mk(geo.ball(0.1, 20), lens, 0, p.size.y / 2, 0), mk(geo.ball(0.03, 8), l, 0.12, p.size.y / 2, 0.12));
      g.userData.lamp = l;
      return g;
    },
    props: [P.range(4, 30), { k: 'who', label: 'Notices', type: 'choice', options: [['all', 'Anything'], ['people', 'People'], ['you', 'Only you'], ['builds', 'Builds']], def: 'all' }],
    fixed(p, dt, ctx) {
      p.st.tick = ((p.st.tick || 0) + 1) % 6;
      if (p.st.tick) return; // looking 10 times a second is plenty
      const at = worldPos(p, _a), r = p.props.range, who = p.props.who;
      let seen = false;
      if ((who === 'all' || who === 'you') && ctx.playerPos.distanceTo(at) < r) seen = true;
      if (!seen && (who === 'all' || who === 'people')) seen = ctx.humansNear(at, r).length > 0;
      if (!seen && (who === 'all' || who === 'builds')) seen = ctx.bodiesNear(at, r, p).length > 0;
      p.st.out = seen;
    },
    frame(p) { const l = p.mesh && p.mesh.userData.lamp; if (l) l.emissiveIntensity = p.st.out ? 3 : 0.1; }
  },
  {
    id: 'timer', name: 'Timer', cat: 'Control', desc: 'Turns its signal on and off by itself, over and over.', size: [0.5, 0.3, 0.3], resize: null, mat: 'plastic', color: '#2b2d31',
    shapes: box, source: true,
    mesh: (p) => {
      const screen = new THREE.MeshBasicMaterial({ map: labelTexture('0.0', { bg: '#081008', fg: '#5dff7a', font: 'bold 70px monospace' }) });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), screen);
      s.position.set(0, 0, -p.size.z / 2 - 0.002);
      s.rotation.y = Math.PI;
      const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.03), mat(p)), s);
      g.userData.screen = screen;
      return g;
    },
    props: [{ k: 'every', label: 'Every (s)', type: 'slider', min: 0.2, max: 30, step: 0.1, def: 2 }, { k: 'for', label: 'On for (s)', type: 'slider', min: 0.1, max: 30, step: 0.1, def: 1 }, P.on(true)],
    fixed(p, dt, ctx) {
      if (!p.props.on) { p.st.out = false; return; }
      p.st.t = ((p.st.t || 0) + dt) % Math.max(0.2, p.props.every);
      p.st.out = p.st.t < p.props.for;
    },
    frame(p) {
      const s = p.mesh && p.mesh.userData.screen;
      if (!s) return;
      const txt = p.props.on ? (Math.max(0.2, p.props.every) - (p.st.t || 0)).toFixed(1) : 'OFF';
      if (txt !== p.st.shown) {
        p.st.shown = txt;
        s.map.dispose();
        s.map = labelTexture(txt, { bg: '#081008', fg: p.st.out ? '#ffffff' : '#5dff7a', font: 'bold 70px monospace' });
      }
    }
  },
  {
    id: 'logic', name: 'Logic Gate', cat: 'Control', desc: 'Mixes signals: AND (all on), OR (any on), NOT (flips it), XOR (only one on).', size: [0.4, 0.2, 0.4], resize: null, mat: 'plastic', color: '#1f5d3a',
    shapes: box, source: true,
    mesh: (p) => {
      const m = new THREE.MeshStandardMaterial({ map: labelTexture(p.props.mode, { bg: '#1f5d3a', fg: '#e9ffe9', font: 'bold 72px sans-serif' }), roughness: 0.5 });
      const top = new THREE.Mesh(new THREE.PlaneGeometry(p.size.x * 0.8, p.size.z * 0.4), m);
      top.rotation.x = -Math.PI / 2;
      top.position.y = p.size.y / 2 + 0.002;
      return grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.03), mat(p)), top);
    },
    props: [{ k: 'mode', label: 'Type', type: 'choice', options: [['AND', 'AND'], ['OR', 'OR'], ['NOT', 'NOT'], ['XOR', 'XOR']], def: 'AND', rebuild: true }],
    gate: true
  },
  {
    id: 'brain', name: 'Brain Block', cat: 'Control', desc: 'Gives a build a mind of its own: it drives itself to chase, run away from, or follow people.', size: [0.5, 0.3, 0.5], resize: null, mat: 'plastic', color: '#26282d',
    shapes: box,
    mesh: (p) => {
      const l = lamp('#ff3df0');
      const chip = mk(geo.box(p.size.x * 0.6, 0.04, p.size.z * 0.6, 0.01), l, 0, p.size.y / 2, 0);
      const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.04), mat(p)), chip);
      g.userData.lamp = l;
      return g;
    },
    props: [{ k: 'mode', label: 'Mind', type: 'choice', options: [['chase', 'Chase'], ['flee', 'Run away'], ['follow', 'Follow'], ['wander', 'Wander']], def: 'chase' },
      { k: 'target', label: 'Who', type: 'choice', options: [['you', 'You'], ['people', 'People'], ['any', 'Anyone']], def: 'you' }, P.on(true), P.speed(60)],
    brainBlock: true,
    frame(p, dt, ctx) { const l = p.mesh && p.mesh.userData.lamp; if (l) l.emissiveIntensity = p.props.on ? 1.6 + Math.sin(ctx.time * 6) * 0.6 : 0; }
  },

  /* ---------------- sci-fi ---------------- */
  {
    id: 'blackhole', name: 'Black Hole', cat: 'Sci-Fi', desc: 'A tiny black hole in a cage. Pulls everything in, and swallows what touches the middle.', size: [1.2, 1.2, 1.2], resize: 'uniform', mat: 'iron',
    shapes: (p) => {
      const s = p.size.x, out = [];
      for (const y of [-0.45, 0.45]) out.push({ t: 'box', h: [s / 2, s * 0.05, s / 2], p: [0, y * s, 0] });
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push({ t: 'box', h: [s * 0.04, s * 0.42, s * 0.04], p: [x * s * 0.45, 0, z * s * 0.45] });
      return out;
    },
    mesh: (p, ctx) => {
      const s = p.size.x, g = new THREE.Group();
      for (const y of [-0.45, 0.45]) g.add(mk(geo.box(s, s * 0.1, s, 0.02), mat(p), 0, y * s, 0));
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(mk(geo.box(s * 0.08, s * 0.84, s * 0.08, 0.01), M.chrome, x * s * 0.45, 0, z * s * 0.45));
      const hole = new THREE.Mesh(geo.ball(s * 0.32, 40), blackHoleMaterial(ctx && ctx.skyTexture()));
      hole.renderOrder = 6;
      const disk = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.95, s * 0.95), diskMaterial());
      disk.rotation.x = -Math.PI / 2 + 0.25;
      disk.renderOrder = 5;
      g.add(hole, disk);
      g.userData.hole = hole; g.userData.disk = disk;
      return g;
    },
    props: [P.input('k3'), P.on(true), P.range(18, 80), P.power(50), { k: 'eat', label: 'Swallows things', type: 'toggle', def: true }],
    control: 'toggle', loop: 'hole',
    fixed(p, dt, ctx) {
      if (!p.st.active) return;
      const at = worldPos(p, _a), R = p.props.range, eatR = p.size.x * 0.33;
      const G = 40 + p.props.power * 9;
      for (const o of ctx.bodiesNear(at, R, p)) {
        const c = o.rb.worldCom();
        _b.set(at.x - c.x, at.y - c.y, at.z - c.z);
        const d = Math.max(_b.length(), 0.3);
        if (p.props.eat && d < eatR + o.radius * 0.5) { ctx.swallow(o, at); continue; }
        const f = Math.min(G * o.rb.mass() * 30 / (d * d), o.rb.mass() * 160);
        pushCenter(o.rb, _b.normalize().multiplyScalar(f), dt);
        // spiral, so it orbits a little before falling in
        const v = o.rb.linvel();
        o.rb.setLinvel({ x: v.x * 0.995, y: v.y * 0.995, z: v.z * 0.995 }, true);
      }
      for (const h of ctx.humansNear(at, R)) {
        const hp = h.center(), dir = _b.subVectors(at, hp), d = Math.max(dir.length(), 0.3);
        if (p.props.eat && d < eatR + 0.4) { ctx.swallowHuman(h, at); continue; }
        h.pull(dir.normalize(), Math.min(G * 30 / (d * d), 160), dt);
      }
      const pd = _c.subVectors(at, ctx.playerPos), pdist = Math.max(pd.length(), 0.5);
      if (pdist < R) ctx.pullPlayer(pd.normalize(), Math.min(G * 22 / (pdist * pdist), 60), dt, pdist < eatR + 0.6 ? at : null);
    },
    frame(p, dt) {
      const u = p.mesh && p.mesh.userData;
      if (!u || !u.hole) return;
      p.st.glow = (p.st.glow || 0) + ((p.st.active ? 1 : 0) - (p.st.glow || 0)) * Math.min(1, dt * 2);
      u.hole.material.uniforms.uPower.value = p.st.glow;
      u.disk.material.uniforms.uPower.value = p.st.glow;
      u.hole.visible = u.disk.visible = p.st.glow > 0.01;
    }
  },
  {
    id: 'antigrav', name: 'Anti-Gravity', cat: 'Sci-Fi', desc: 'Turns gravity off for the whole build it is stuck on. It floats.', size: [0.6, 0.3, 0.6], resize: 'uniform', mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const glow = new THREE.MeshStandardMaterial({ color: 0x081018, emissive: 0x5a8cff, emissiveIntensity: 0 });
      const ring = mk(geo.torus(p.size.x * 0.38, p.size.x * 0.05, 32), glow, 0, p.size.y / 2, 0, Math.PI / 2);
      const g = grp(mk(geo.cyl(p.size.x / 2, p.size.y, 32), mat(p)), ring);
      g.userData.glow = glow;
      return g;
    },
    props: [P.input('k3'), P.on(true)], control: 'toggle', antigrav: true,
    frame(p, dt, ctx) { const g = p.mesh && p.mesh.userData.glow; if (g) g.emissiveIntensity = p.st.active ? 2 + Math.sin(ctx.time * 3) * 0.5 : 0; }
  },
  {
    id: 'magnet', name: 'Magnet', cat: 'Sci-Fi', desc: 'Pulls metal things (steel, iron, aluminum, gold, chrome) toward it. Sticks them on when close.', size: [0.8, 0.6, 0.4], resize: 'uniform', mat: 'steel', color: '#c8332b',
    shapes: (p) => [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }],
    mesh: (p) => {
      const s = p.size.x;
      const red = mat(p);
      const arc = mk(geo.torus(s * 0.3, s * 0.1, 24, Math.PI), red, 0, -p.size.y / 2 + s * 0.42, 0, Math.PI, 0, 0);
      return grp(arc, mk(geo.box(s * 0.2, s * 0.22, s * 0.2, 0.01), red, -s * 0.3, p.size.y / 2 - s * 0.22, 0),
        mk(geo.box(s * 0.2, s * 0.22, s * 0.2, 0.01), red, s * 0.3, p.size.y / 2 - s * 0.22, 0),
        mk(geo.box(s * 0.21, s * 0.08, s * 0.21, 0.01), M.chrome, -s * 0.3, p.size.y / 2 - s * 0.04, 0),
        mk(geo.box(s * 0.21, s * 0.08, s * 0.21, 0.01), M.chrome, s * 0.3, p.size.y / 2 - s * 0.04, 0));
    },
    props: [P.input('k3'), P.on(true), P.range(10, 40), P.power(50)], control: 'toggle',
    fixed(p, dt, ctx) {
      if (!p.st.active) return;
      const at = worldPos(p, _a, _d.set(0, p.size.y / 2, 0)), R = p.props.range;
      for (const o of ctx.bodiesNear(at, R, p)) {
        if (!o.metal) continue;
        const c = o.rb.worldCom();
        _b.set(at.x - c.x, at.y - c.y, at.z - c.z);
        const d = Math.max(_b.length(), 0.4);
        const f = Math.min((30 + p.props.power * 12) * o.metal * 40 / (d * d), o.rb.mass() * 60 + 2000);
        _b.normalize().multiplyScalar(f);
        pushCenter(o.rb, _b, dt);
        push(p.body.rb, _b.negate(), at, dt); // equal and opposite: a magnet pulls itself too
      }
    }
  },
  {
    id: 'forcefield', name: 'Force Field', cat: 'Sci-Fi', desc: 'A glowing bubble that shoves everything out. Your own build is safe inside.', size: [0.6, 0.4, 0.6], resize: null, mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const bub = new THREE.Mesh(geo.ball(1, 40), bubbleMaterial('#4fc8ff'));
      bub.renderOrder = 4;
      const g = grp(mk(geo.cyl(p.size.x / 2, p.size.y, 28), mat(p)), mk(geo.ball(p.size.x * 0.28, 20), lens, 0, p.size.y / 2, 0), bub);
      g.userData.bubble = bub;
      return g;
    },
    props: [P.input('k4'), P.on(true), P.range(5, 25), P.power(60)], control: 'toggle', loop: 'beam',
    fixed(p, dt, ctx) {
      if (!p.st.active) return;
      const at = worldPos(p, _a), R = p.props.range, k = 20 + p.props.power * 3;
      for (const o of ctx.bodiesNear(at, R + 1, p)) {
        const c = o.rb.worldCom();
        _b.set(c.x - at.x, c.y - at.y, c.z - at.z);
        const d = Math.max(_b.length(), 0.2);
        if (d > R + o.radius) continue;
        const n = _b.divideScalar(d);
        const v = o.rb.linvel(), inward = -(v.x * n.x + v.y * n.y + v.z * n.z);
        const f = o.rb.mass() * (k * (1 - Math.min(1, (d - o.radius) / R)) + Math.max(0, inward) * 25);
        pushCenter(o.rb, _c.copy(n).multiplyScalar(f), dt);
        p.st.hit = 1;
      }
      for (const h of ctx.humansNear(at, R + 0.5)) { const hp = h.center(); h.pull(_b.subVectors(hp, at).normalize(), k * 1.2, dt); p.st.hit = 1; }
      const pd = _c.subVectors(ctx.playerPos, at);
      if (pd.length() < R + 0.4 && !ctx.playerInside(p)) ctx.pushPlayer(pd.normalize(), 14, dt);
    },
    frame(p, dt) {
      const b = p.mesh && p.mesh.userData.bubble;
      if (!b) return;
      p.st.g = (p.st.g || 0) + ((p.st.active ? 1 : 0) - (p.st.g || 0)) * Math.min(1, dt * 3);
      b.visible = p.st.g > 0.01;
      b.scale.setScalar(p.props.range * (0.6 + 0.4 * p.st.g));
      b.material.uniforms.uPower.value = p.st.g;
      p.st.hit = Math.max(0, (p.st.hit || 0) - dt * 3);
      b.material.uniforms.uHit.value = p.st.hit;
    }
  },
  {
    id: 'tractor', name: 'Tractor Beam', cat: 'Sci-Fi', desc: 'Grabs the first thing in front of it and pulls it close. Holds it there.', size: [0.6, 0.5, 0.6], resize: null, mat: 'alu',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const dish = mk(geo.lathe('dish', [[0.05, 0.0], [0.18, 0.04], [0.28, 0.12], [0.3, 0.16]], 32), twoSided('chrome'), 0, p.size.y / 2 - 0.16, 0);
      const beam = new THREE.Mesh(geo.cyl(0.18, 1, 20, 0.05), beamMaterial('#7dffb5'));
      beam.geometry = beam.geometry.clone().translate(0, 0.5, 0);
      beam.position.y = p.size.y / 2 - 0.05;
      beam.visible = false;
      beam.renderOrder = 5;
      const g = grp(mk(geo.cyl(p.size.x / 2, p.size.y - 0.15, 28), mat(p), 0, -0.075, 0), dish, beam);
      g.userData.beam = beam;
      return g;
    },
    props: [P.input('k4'), P.on(false), P.range(30, 80), { k: 'hold', label: 'Hold distance (m)', type: 'slider', min: 1, max: 15, step: 0.5, def: 3 }, P.power(60)], control: 'toggle', loop: 'beam',
    fixed(p, dt, ctx) {
      p.st.len = 0;
      if (!p.st.active) { p.st.grab = null; return; }
      const from = worldPos(p, _a, _d.set(0, p.size.y / 2, 0)), dir = worldUp(p, _b);
      const hit = ctx.ray(from, dir, p.props.range, p.body);
      p.st.len = hit ? hit.toi : p.props.range;
      const target = _c.copy(from).addScaledVector(dir, p.props.hold);
      if (hit && hit.owner && hit.owner.kind === 'part' && !ctx.sameBuild(hit.owner.ref, p)) {
        const rb = hit.owner.ref.body.rb, m = rb.mass(), c = rb.worldCom();
        const k = 6 + p.props.power / 10;
        const v = rb.linvel();
        const f = new THREE.Vector3(target.x - c.x, target.y - c.y, target.z - c.z).multiplyScalar(k * k * m * 0.5)
          .add(new THREE.Vector3(-v.x, -v.y, -v.z).multiplyScalar(2 * k * m * 0.7))
          .add(new THREE.Vector3(0, -ctx.gravity * m * rb.gravityScale(), 0));
        pushCenter(rb, f, dt);
      } else if (hit && hit.owner && hit.owner.kind === 'human') {
        hit.owner.ref.pullTo(target, 1 + p.props.power / 50, dt);
      }
    },
    frame(p) {
      const b = p.mesh && p.mesh.userData.beam;
      if (!b) return;
      b.visible = !!p.st.active && p.st.len > 0.1;
      b.scale.set(1, Math.max(0.1, (p.st.len || 0) / (p.meshScale || 1)), 1);
    }
  },
  {
    id: 'portal', name: 'Portal', cat: 'Sci-Fi', desc: 'Place two of the same color: whatever goes in one comes out the other. You too.', size: [2, 2.4, 0.3], resize: 'uniform', mat: 'steel',
    halfH: (p) => p.size.y / 2,
    shapes: (p) => {
      const s = p.size.x / 2, out = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        out.push({ t: 'box', h: [s * 0.32, 0.09, 0.12], p: [Math.cos(a) * s * 1.02, Math.sin(a) * s * 1.02 + 0.05, 0], q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + Math.PI / 2) });
      }
      return out;
    },
    mesh: (p) => {
      const s = p.size.x / 2;
      const color = PORTAL_COLORS[p.props.channel] || '#3ab0ff';
      const ring = mk(geo.torus(s * 1.02, 0.1, 48), mat(p), 0, 0.05, 0);
      const face = new THREE.Mesh(new THREE.CircleGeometry(s * 0.95, 48), portalMaterial(color));
      face.position.y = 0.05;
      face.renderOrder = 3;
      const glowR = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: new THREE.Color(color), emissiveIntensity: 2 });
      return grp(ring, face, mk(geo.torus(s * 0.96, 0.03, 48), glowR, 0, 0.05, 0));
    },
    props: [{ k: 'channel', label: 'Color', type: 'choice', options: [['blue', 'Blue'], ['orange', 'Orange'], ['green', 'Green'], ['purple', 'Purple']], def: 'blue', rebuild: true }, P.on(true)],
    portal: true
  },
  {
    id: 'slowfield', name: 'Slow-Mo Field', cat: 'Sci-Fi', desc: 'Everything inside the bubble moves in slow motion. Bullets, cars, people.', size: [0.6, 0.4, 0.6], resize: null, mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const bub = new THREE.Mesh(geo.ball(1, 40), bubbleMaterial('#ffcf4a'));
      bub.renderOrder = 4;
      const g = grp(mk(geo.cyl(p.size.x / 2, p.size.y, 28), mat(p)), mk(geo.ball(p.size.x * 0.28, 20), lens, 0, p.size.y / 2, 0), bub);
      g.userData.bubble = bub;
      return g;
    },
    props: [P.input('k4'), P.on(true), P.range(6, 25), { k: 'slow', label: 'How slow', type: 'slider', min: 10, max: 95, step: 5, def: 80 }], control: 'toggle',
    fixed(p, dt, ctx) {
      if (!p.st.active) return;
      const at = worldPos(p, _a), R = p.props.range, keep = 1 - p.props.slow / 100 * 0.35;
      for (const o of ctx.bodiesNear(at, R, p)) {
        const v = o.rb.linvel(), w = o.rb.angvel();
        // heavy drag every step: falling things drift down slowly too
        o.rb.setLinvel({ x: v.x * keep, y: v.y * keep, z: v.z * keep }, true);
        o.rb.setAngvel({ x: w.x * keep, y: w.y * keep, z: w.z * keep }, true);
      }
      for (const h of ctx.humansNear(at, R)) h.slow(keep);
    },
    frame(p, dt) {
      const b = p.mesh && p.mesh.userData.bubble;
      if (!b) return;
      b.visible = !!p.st.active;
      b.scale.setScalar(p.props.range);
      b.material.uniforms.uPower.value = p.st.active ? 0.8 : 0;
    }
  },
  {
    id: 'laser', name: 'Laser', cat: 'Sci-Fi', desc: 'A hot beam. Shatters glass, pops balloons, sets off explosives and knocks people back.', size: [0.3, 0.6, 0.3], resize: null, mat: 'iron',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const beam = new THREE.Mesh(geo.cyl(0.025, 1, 10), beamMaterial('#ff2a2a'));
      beam.geometry = beam.geometry.clone().translate(0, 0.5, 0);
      beam.position.y = p.size.y / 2;
      beam.visible = false;
      beam.renderOrder = 5;
      const g = grp(mk(geo.cyl(p.size.x / 2, p.size.y, 20), mat(p)), mk(geo.cyl(p.size.x * 0.3, 0.06, 16), M.chrome, 0, p.size.y / 2, 0), beam);
      g.userData.beam = beam;
      return g;
    },
    props: [P.input('k4'), P.on(false), P.range(60, 150)], control: 'toggle',
    fixed(p, dt, ctx) {
      p.st.len = 0;
      if (!p.st.active) return;
      const from = worldPos(p, _a, _d.set(0, p.size.y / 2 + 0.01, 0)), dir = worldUp(p, _b);
      const hit = ctx.ray(from, dir, p.props.range, p.body);
      p.st.len = hit ? hit.toi : p.props.range;
      if (hit) ctx.laserHit(hit, dir, dt, p);
    },
    frame(p) {
      const b = p.mesh && p.mesh.userData.beam;
      if (!b) return;
      b.visible = !!p.st.active;
      b.scale.set(1, Math.max(0.05, (p.st.len || 0) / (p.meshScale || 1)), 1);
    }
  },

  /* ---------------- effects ---------------- */
  {
    id: 'light', name: 'Light', cat: 'Effects', desc: 'A real light. Lights up everything around it, best at night. L turns it on and off.', size: [0.3, 0.3, 0.3], resize: null, mat: 'steel',
    halfH: () => 0.15,
    shapes: () => [{ t: 'cyl', hh: 0.06, r: 0.12, p: [0, -0.09, 0] }, { t: 'ball', r: 0.11, p: [0, 0.04, 0] }],
    mesh: (p) => {
      const bulbM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(p.props.glow), emissiveIntensity: 0, roughness: 0.2, transparent: true, opacity: 0.92 });
      const g = grp(mk(geo.cyl(0.12, 0.12, 20), mat(p), 0, -0.09, 0), mk(geo.ball(0.11, 20), bulbM, 0, 0.04, 0));
      g.children[1].castShadow = false;
      g.userData.bulb = bulbM;
      return g;
    },
    props: [P.input('l', [['l', 'Key L'], ['k1', 'Key 1'], ['k2', 'Key 2'], ['k3', 'Key 3'], ['k4', 'Key 4'], ['none', 'Nothing']]), P.on(true), P.color('#ffd9a0'),
      { k: 'bright', label: 'Brightness', type: 'slider', min: 5, max: 100, step: 5, def: 50 }, P.range(12, 40)],
    control: 'toggle', light: true,
    frame(p) {
      const b = p.mesh && p.mesh.userData.bulb;
      if (b) { b.emissive.set(p.props.glow); b.emissiveIntensity = p.st.active ? 3 : 0; }
    }
  },
  {
    id: 'explosive', name: 'Explosive Barrel', cat: 'Effects', desc: 'Goes boom: press X in a seat, wire a button to it, press E on it, or hit it hard.', size: [0.6, 0.9, 0.6], resize: 'uniform', mat: 'steel', color: '#b3241c',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const r = p.size.x / 2, h = p.size.y;
      const tex = labelTexture('DANGER', { bg: '#f2c230', fg: '#111', w: 512, h: 128, font: 'bold 64px sans-serif', stripes: true });
      tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 2;
      const label = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
      const band = mk(new THREE.CylinderGeometry(r * 1.006, r * 1.006, h * 0.28, 32, 1, true), label);
      return grp(mk(geo.cyl(r, h, 32), mat(p)), band, mk(geo.cyl(r * 1.02, 0.04, 32), M.iron, 0, h * 0.3, 0), mk(geo.cyl(r * 1.02, 0.04, 32), M.iron, 0, -h * 0.3, 0));
    },
    props: [P.input('x', [['x', 'Key X'], ['k1', 'Key 1'], ['k2', 'Key 2'], ['k3', 'Key 3'], ['k4', 'Key 4'], ['none', 'Nothing']]), P.power(60), { k: 'impact', label: 'Blows up when hit hard', type: 'toggle', def: true }],
    explosive: true,
    use(p, ctx) { ctx.detonate(p); }
  },
  {
    id: 'speaker', name: 'Horn', cat: 'Effects', desc: 'Makes a sound. H in a seat, E on it, or wire it.', size: [0.4, 0.4, 0.4], resize: null, mat: 'plastic', color: '#2b2d31',
    shapes: box,
    mesh: (p) => grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.04), mat(p)),
      mk(geo.lathe('spk', [[0.02, 0], [0.08, 0.02], [0.15, 0.06], [0.16, 0.07]], 24), M.dark, 0, p.size.y / 2 - 0.07, 0)),
    props: [P.input('h', [['h', 'Key H'], ['k1', 'Key 1'], ['k2', 'Key 2'], ['k3', 'Key 3'], ['k4', 'Key 4'], ['none', 'Nothing']]),
      { k: 'snd', label: 'Sound', type: 'choice', options: [['bell', 'Bell'], ['gong', 'Gong'], ['zap', 'Zap'], ['spring', 'Boing']], def: 'bell' }],
    horn: true,
    use(p, ctx) { ctx.sound(p.props.snd, worldPos(p, _a), 1); }
  },
  {
    id: 'smoke', name: 'Smoke Maker', cat: 'Effects', desc: 'Leaves a smoke trail. Looks great on planes and rockets.', size: [0.3, 0.4, 0.3], resize: null, mat: 'iron',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => grp(mk(geo.cyl(p.size.x / 2, p.size.y, 20), mat(p)), mk(geo.cyl(p.size.x * 0.3, 0.05, 16), M.dark, 0, p.size.y / 2, 0)),
    props: [P.input('k4'), P.on(true), { k: 'smokeColor', label: 'Color', type: 'swatch', def: '#e8e8e8' }], control: 'toggle',
    frame(p, dt, ctx) {
      if (!p.st.active) return;
      p.st.acc = (p.st.acc || 0) + dt;
      if (p.st.acc < 0.04) return;
      p.st.acc = 0;
      ctx.fx.smoke(worldPos(p, _a, _d.set(0, p.size.y / 2 + 0.05, 0)), worldUp(p, _b).multiplyScalar(1.5), p.props.smokeColor, 1.2);
    }
  }
];

export function twoSided(key) {
  const id = '2s' + key;
  if (!twoSided[id]) { twoSided[id] = partMaterial(key).clone(); twoSided[id].side = THREE.DoubleSide; }
  return twoSided[id];
}
export const PORTAL_COLORS = { blue: '#3ab0ff', orange: '#ff9a2a', green: '#4dff8a', purple: '#c065ff' };
