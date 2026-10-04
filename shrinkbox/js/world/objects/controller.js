// Wireless game controller (~15.3 x 10.3 x 6.1 cm). Hollow, with real ways in: the USB-C port,
// the 3.5 mm headset jack and the gaps around the thumbsticks. Inside: the circuit board, rubber
// button domes, thumbstick sensor modules, two AA batteries and the rumble motors (spinning
// off-center weights) in the grips.
import * as THREE from 'three';
import { Thing, panel, shellGeo } from '../thing.js';
import { defMat, colorMat } from '../../core/materials.js';
import { loop, vol3d } from '../../core/audio.js';

const T = 0.0018;

export function buildController(game, pos, rotY = 0) {
  const c = new Thing({ name: 'Controller', type: 'dynamic', density: 1, pos, rot: [0, rotY, 0], surface: 'plastic', icon: '🕹️', spawnId: 'controller', tags: ['electronic', 'enterable'] });
  const shellMat = defMat('ctrlShell', () => new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.55, side: THREE.DoubleSide }));
  const BX = 0.05, BY = 0.03, Z0 = -0.035, Z1 = 0.02; // body box
  const cz = (Z0 + Z1) / 2, dz = Z1 - Z0;
  // ---------- body ----------
  c.geo(shellGeo([BX * 2, BY, dz], 0.009, ['+y', '+z', '-z', '-y']), [0, BY / 2, cz], shellMat, { collide: false });
  c.box([BX * 2, T, dz], [0, T / 2, cz], shellMat, { density: 1100, cut: 'back shell' });
  c.box([T, BY, dz], [-BX + T / 2, BY / 2, cz], shellMat, { visual: false, density: 1100 });
  c.box([T, BY, dz], [BX - T / 2, BY / 2, cz], shellMat, { visual: false, density: 1100 });
  const sticks = { L: [-0.033, -0.014], R: [0.017, 0.007] };
  const abxy = [[0.036, -0.022, 0xf5c518, 'Y'], [0.036, -0.003, 0x1fb84a, 'A'], [0.027, -0.0125, 0x2f6fe0, 'X'], [0.045, -0.0125, 0xd8312a, 'B']];
  const holes = [
    [sticks.L[0] - 0.0105, sticks.L[1] - 0.0105, sticks.L[0] + 0.0105, sticks.L[1] + 0.0105],
    [sticks.R[0] - 0.0105, sticks.R[1] - 0.0105, sticks.R[0] + 0.0105, sticks.R[1] + 0.0105],
    [-0.029, -0.001, -0.007, 0.017], // d-pad
    [-0.0065, -0.031, 0.0065, -0.018], // guide button
    ...abxy.map(([x, z]) => [x - 0.0048, z - 0.0048, x + 0.0048, z + 0.0048]),
  ];
  panel(c, { axis: 'y', at: BY - T / 2, rect: [-BX, Z0, BX, Z1], holes, thick: T, m: shellMat, o: { density: 1100, visual: false } });
  panel(c, { axis: 'y', at: BY - T / 2, rect: [-BX + 0.0085, Z0 + 0.0085, BX - 0.0085, Z1], holes, thick: T, m: shellMat, o: { collide: false } });
  // front edge: USB-C port + gaps behind the bumpers
  panel(c, { axis: 'z', at: Z0 + T / 2, rect: [-BX, 0, BX, BY], thick: T, m: shellMat,
    holes: [[-0.0042, 0.0115, 0.0042, 0.0141], [-0.046, 0.0235, -0.02, 0.0245], [0.02, 0.0235, 0.046, 0.0245]], o: { density: 1100 } });
  // back edge between the grips: 3.5 mm headset jack, and openings into each grip
  panel(c, { axis: 'z', at: Z1 - T / 2, rect: [-BX, 0, BX, BY], thick: T, m: shellMat,
    holes: [[-0.00175, 0.007, 0.00175, 0.0105], [-0.047, 0.003, -0.027, 0.026], [0.027, 0.003, 0.047, 0.026]], o: { density: 1100 } });
  // ---------- grips (hollow, rumble motors inside) ----------
  const grips = [];
  for (const sx of [-1, 1]) {
    const gp = [sx * 0.038, 0.016, 0.046], rot = [0.12, -sx * 0.32, 0];
    const gw = 0.036, gh = 0.032, gl = 0.062;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
    const at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).add(new THREE.Vector3(...gp)).toArray();
    const qa = [q.x, q.y, q.z, q.w];
    c.geo(shellGeo([gw, gh, gl], 0.014, ['-z']).applyQuaternion(q), gp, shellMat, { collide: false });
    c.box([gw, T, gl], at(0, -gh / 2 + T / 2, 0), shellMat, { rot: qa, visual: false, density: 1100 });
    c.box([gw, T, gl], at(0, gh / 2 - T / 2, 0), shellMat, { rot: qa, visual: false, density: 1100 });
    c.box([T, gh, gl], at(-gw / 2 + T / 2, 0, 0), shellMat, { rot: qa, visual: false, density: 1100 });
    c.box([T, gh, gl], at(gw / 2 - T / 2, 0, 0), shellMat, { rot: qa, visual: false, density: 1100 });
    c.box([gw, gh, T], at(0, 0, gl / 2 - T / 2), shellMat, { rot: qa, visual: false, density: 1100 });
    // rumble motor + off-center weight
    const mpos = at(0, -0.002, 0.012);
    c.cyl(0.0062, 0.018, mpos, 'steel', { rot: [Math.PI / 2 + rot[0], rot[1], 0] });
    const wpos = at(0, -0.002, 0.0, 0);
    const wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)).premultiply(q);
    c.cyl(0.009, 0.004, wpos, 'darkAlu', { rot: [wq.x, wq.y, wq.z, wq.w], group: 'rumble' + sx, pivot: wpos, rTop: 0.009, seg: 12 });
    grips.push({ sx, wpos });
  }
  // ---------- inside the body ----------
  c.box([0.092, 0.0012, 0.05], [0, 0.016, -0.008], 'pcb', { density: 1800 });
  for (const [x, z] of [[-0.03, -0.031], [0.03, -0.031], [-0.03, 0.016], [0.03, 0.016]]) c.cyl(0.0022, 0.015, [x, 0.0083, z], shellMat, { density: 1100 }); // screw posts
  // 2 x AA batteries (they really are AA in this controller)
  const battMat = defMat('aa', () => new THREE.MeshStandardMaterial({ color: 0x23324f, roughness: 0.35, metalness: 0.3 }));
  for (const z of [-0.012, 0.004]) {
    c.cyl(0.0072, 0.05, [0, 0.0082, z], battMat, { rot: [0, 0, Math.PI / 2], density: 2300 });
    c.cyl(0.0025, 0.0015, [0.0257, 0.0082, z], 'chrome', { rot: [0, 0, Math.PI / 2], collide: false });
    const spring = new THREE.TorusGeometry(0.004, 0.0004, 6, 16); spring.rotateY(Math.PI / 2);
    for (let i = 0; i < 3; i++) c.geo(spring.clone(), [-0.027 - i * 0.0012, 0.0082, z], 'steel', { collide: false });
  }
  // rubber domes under the buttons + the buttons themselves
  const rubber = defMat('domeRubber', () => new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.9, transparent: true, opacity: 0.85 }));
  for (const [x, z, col] of abxy) {
    const dome = new THREE.SphereGeometry(0.0042, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    c.geo(dome, [x, 0.0166, z], rubber, { collide: 'hull' });
    c.cyl(0.0012, 0.004, [x, 0.023, z], shellMat, { collide: false });
    c.cyl(0.0044, 0.0055, [x, BY + 0.0005, z], colorMat(0x18191c, 0.3), { density: 1100 });
    c.cyl(0.0038, 0.0004, [x, BY + 0.0034, z], colorMat(col, 0.4), { collide: false });
  }
  // thumbstick modules (the sensors) + sticks
  for (const k of ['L', 'R']) {
    const [x, z] = sticks[k];
    c.box([0.016, 0.0095, 0.016], [x, 0.0215, z], colorMat(0x2b2d33, 0.6), { density: 2000 });
    c.box([0.003, 0.004, 0.007], [x + 0.0095, 0.02, z], colorMat(0x3d3f44, 0.5), { collide: false }); // potentiometer
    c.box([0.007, 0.004, 0.003], [x, 0.02, z + 0.0095], colorMat(0x3d3f44, 0.5), { collide: false });
    c.cyl(0.0022, 0.013, [x, 0.0325, z], 'plasticBlack', { density: 1100 });
    c.cyl(0.0095, 0.0055, [x, 0.0395, z], 'rubberGray', { density: 1100, seg: 28 });
    const ring = new THREE.TorusGeometry(0.0088, 0.0011, 8, 28); ring.rotateX(Math.PI / 2);
    c.geo(ring, [x, 0.0423, z], 'rubber', { collide: false });
  }
  // d-pad + guide button
  c.box([0.02, 0.003, 0.0065], [-0.018, BY + 0.0005, 0.008], 'plasticBlack', { density: 1100 });
  c.box([0.0065, 0.003, 0.02], [-0.018, BY + 0.0005, 0.008], 'plasticBlack', { density: 1100 });
  c.box([0.018, 0.0012, 0.016], [-0.018, 0.0172, 0.008], rubber, { collide: false });
  c.cyl(0.0062, 0.003, [0, BY + 0.0005, -0.0245], defMat('guide', () => new THREE.MeshStandardMaterial({ color: 0xdedede, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.3 })), { density: 1100 });
  // bumpers + triggers
  for (const sx of [-1, 1]) {
    c.rbox([0.03, 0.007, 0.012], [sx * 0.033, BY - 0.002, Z0 - 0.004], shellMat, 0.003, { density: 1100 });
    c.rbox([0.02, 0.022, 0.018], [sx * 0.035, BY - 0.012, Z0 - 0.01], shellMat, 0.005, { density: 1100, rot: [0.5, 0, 0] });
  }
  // USB-C port shell
  c.box([0.0089, 0.0004, 0.007], [0, 0.0144, Z0 + 0.0045], 'steel', { collide: false });
  c.box([0.0089, 0.0004, 0.007], [0, 0.0113, Z0 + 0.0045], 'steel', { collide: false });

  c.build(game.engine.scene);
  c.enclosure = new THREE.Box3(new THREE.Vector3(-BX + T, T, Z0 + T), new THREE.Vector3(BX - T, BY - T, Z1 + 0.06));
  c.rumble = 0; c.rumbleAngle = 0;
  c.behaviors.push(ctrlBehavior);
  c.grips = grips;
  return c;
}

const _v = new THREE.Vector3();
const ctrlBehavior = {
  update(c, dt, game) {
    // when the console is on, you're "playing": the guide button glows and it rumbles sometimes
    const playing = game.xbox && game.xbox.on;
    defMat('guide').emissiveIntensity = playing ? 1.4 : 0;
    if (playing && Math.random() < dt * 0.12) c.rumbleT = 0.4 + Math.random() * 1.2;
    c.rumbleT = Math.max(0, (c.rumbleT || 0) - dt);
    c.rumble += ((c.rumbleT > 0 ? 1 : 0) - c.rumble) * Math.min(1, dt * 10);
    c.rumbleAngle += c.rumble * 220 * dt;
    for (const g of c.grips) for (const m of c.meshes?.['rumble' + g.sx] || []) m.rotation.z = c.rumbleAngle * g.sx;
    if (c.rumble > 0.05 && c.body) {
      const k = c.rumble * 0.0006 * c.scale ** 3 * 2000;
      c.body.applyImpulse({ x: (Math.random() - 0.5) * k, y: Math.random() * k * 0.5, z: (Math.random() - 0.5) * k }, true);
    }
    if (!c.snd) c.snd = loop('rumble');
    const p = game.player;
    if (game.micro) { c.snd.set(0); return; }
    const local = c.group.worldToLocal(p.center(_v.clone()));
    const inside = c.enclosure.containsPoint(local);
    if (inside) { game.inside = c; game.insideEcho = 0.3; if (c.rumble > 0.1) p.shake = Math.max(p.shake, c.rumble); }
    const d = c.position(_v).distanceTo(p.feet);
    c.snd.set(c.rumble * vol3d(d, inside ? 1 : 0.3, p.s) * 0.8, 1);
  },
};
