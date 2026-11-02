// Moving parts (hinges, motors, pistons, springs, wheels) and things that push (thrusters, wings, balloons, gyros).
import * as THREE from 'three';
import * as geo from './geo.js';
import { mk, grp, M, P, INPUTS } from './common.js';
import { partMaterial } from '../core/mats.js';
import { flameMaterial } from '../fx/shaders.js';
import { twoSided } from './defs-logic.js';
import { worldPos, worldUp, worldQuat, push, twist, velAt, clamp, bodyQuat } from './rt.js';

const mat = (p) => partMaterial(p.mat, p.color);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _q = new THREE.Quaternion();

/* ---------------- joints: the base sits on your build, the top half becomes its own moving piece ---------------- */
const bolts = (r, y, n = 6) => {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.add(mk(geo.cyl(r * 0.07, 0.03, 8), M.chrome, Math.cos(a) * r * 0.78, y, Math.sin(a) * r * 0.78));
  }
  return g;
};
function setMotor(p, kind, target, a, b) {
  // only talk to the physics joint when something changed (stops builds from never falling asleep)
  const key = kind + target.toFixed(3) + a + b;
  if (!p.joint || p.st.motorKey === key) return;
  p.st.motorKey = key;
  if (kind === 'vel') { p.joint.configureMotorVelocity(target, a); p.joint.setMotorMaxForce(b); }
  else { p.joint.configureMotorPosition(target, a, b); p.joint.setMotorMaxForce(1e9); }
  p.body.rb.wakeUp();
  if (p.child) p.child.rb.wakeUp();
}

const rotorDisc = {
  id: 'rotor_disc', hidden: true, name: 'Turntable', mat: 'steel',
  shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
  mesh: (p) => grp(mk(geo.cyl(p.size.x / 2, p.size.y, 32), mat(p)), bolts(p.size.x / 2, p.size.y / 2 + 0.01))
};

const hingeLike = (id, name, desc, extra) => ({
  id, name, cat: 'Moving', desc, size: [0.5, 0.24, 0.5], resize: 'round', mat: 'steel',
  shapes: (p) => [{ t: 'cyl', hh: p.size.y / 4, r: p.size.x / 2, p: [0, -p.size.y / 4, 0] }],
  mesh: (p) => grp(mk(geo.cyl(p.size.x / 2, p.size.y / 2, 32), M.iron, 0, -p.size.y / 4, 0)),
  joint: { type: 'revolute', at: () => 0, rotor: 'rotor_disc', rotorSize: (p) => [p.size.x * 0.92, p.size.y / 2, p.size.x * 0.92], rotorAt: (p) => p.size.y / 4 },
  ...extra
});

export const MECH = [
  rotorDisc,
  hingeLike('hinge', 'Hinge', 'Spins freely. Put things on top: they turn around it.', {}),
  hingeLike('motor', 'Motor', 'Spins whatever is on top. Key 2 turns it on and off, or set it to always spin.', {
    size: [0.6, 0.5, 0.6],
    shapes: (p) => [{ t: 'cyl', hh: p.size.y * 0.4, r: p.size.x / 2, p: [0, -p.size.y * 0.1, 0] }],
    mesh: (p) => grp(
      mk(geo.cyl(p.size.x / 2, p.size.y * 0.8, 32), M.iron, 0, -p.size.y * 0.1, 0),
      mk(geo.cyl(p.size.x * 0.52, p.size.y * 0.06, 32), M.dark, 0, -p.size.y * 0.45, 0),
      mk(geo.box(p.size.x * 0.3, p.size.y * 0.3, 0.05), M.yellow, 0, -p.size.y * 0.15, p.size.x / 2 + 0.01)),
    joint: { type: 'revolute', at: (p) => p.size.y * 0.3, rotor: 'rotor_disc', rotorSize: (p) => [p.size.x * 0.9, p.size.y * 0.2, p.size.x * 0.9], rotorAt: (p) => p.size.y * 0.1 },
    props: [P.input('k2'), P.on(false), P.speed(40), P.power(60), P.invert()],
    control: 'toggle',
    fixed(p) {
      const s = p.st.level * (p.props.invert ? -1 : 1);
      setMotor(p, 'vel', s * p.props.speed * 0.25, 20, 100 + p.props.power * p.props.power * 2);
    }
  }),
  hingeLike('steer', 'Steering Hinge', 'Turns left and right with A / D. Put a wheel on it to steer.', {
    props: [P.input('steer'), { k: 'angle', label: 'Turn angle', type: 'slider', min: 5, max: 90, step: 5, def: 30 }, P.invert()],
    control: 'analog',
    fixed(p) {
      let s = p.st.level * (p.props.invert ? -1 : 1) * (p.st.steerSign || 1);
      setMotor(p, 'pos', -s * p.props.angle * Math.PI / 180, 2500, 120);
    },
    init(p) { if (p.joint) p.joint.setLimits(-p.props.angle * Math.PI / 180, p.props.angle * Math.PI / 180); }
  }),
  {
    id: 'balljoint', name: 'Ball Joint', cat: 'Moving', desc: 'Bends any way, like a shoulder. Great for floppy things.', size: [0.4, 0.4, 0.4], resize: 'uniform', mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y * 0.2, r: p.size.x * 0.45, p: [0, -p.size.y * 0.3, 0] }],
    mesh: (p) => grp(mk(geo.cyl(p.size.x * 0.45, p.size.y * 0.4, 28), M.iron, 0, -p.size.y * 0.3, 0)),
    joint: { type: 'spherical', at: (p) => p.size.y * 0.1, rotor: 'ball_head', rotorSize: (p) => [p.size.x * 0.75, p.size.x * 0.75, p.size.x * 0.75], rotorAt: () => 0 }
  },
  {
    id: 'ball_head', hidden: true, name: 'Ball Joint', mat: 'chrome',
    shapes: (p) => [{ t: 'ball', r: p.size.x / 2 }],
    mesh: (p) => mk(geo.ball(p.size.x / 2, 24), M.chrome)
  },
  {
    id: 'piston', name: 'Piston', cat: 'Moving', desc: 'Pushes out and pulls back in. Key 1, or wire a button to it.', size: [0.4, 0.8, 0.4], resize: 'round', mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: (p.size.y - 0.1) / 2, r: p.size.x / 2, p: [0, -0.05, 0] }],
    mesh: (p) => grp(mk(geo.cyl(p.size.x / 2, p.size.y - 0.1, 28), M.iron, 0, -0.05, 0), mk(geo.cyl(p.size.x * 0.56, 0.06, 28), M.dark, 0, p.size.y / 2 - 0.13, 0)),
    joint: { type: 'prismatic', at: (p) => p.size.y / 2 - 0.05, rotor: 'piston_head', rotorSize: (p) => [p.size.x * 1.15, 0.1, p.size.x * 1.15], rotorAt: () => 0 },
    props: [P.input('k1'), P.on(false), { k: 'length', label: 'Push length (m)', type: 'slider', min: 0.25, max: 6, step: 0.25, def: 1.5 }, P.speed(40), P.power(60)],
    control: 'toggle',
    init(p) { if (p.joint) p.joint.setLimits(0, p.props.length); },
    fixed(p) {
      const target = p.st.active ? p.props.length : 0;
      const k = 200 + p.props.speed * 40, d = 30 + p.props.speed * 2;
      setMotor(p, 'pos', target, k, d);
    },
    frame(p) {
      // the shiny rod stretches between the housing and the moving head
      const rod = p.child && p.rotor && p.rotor.mesh && p.rotor.mesh.userData.rod;
      if (!rod) return;
      worldPos(p, _a, _c.set(0, p.size.y / 2 - 0.1, 0));
      worldPos(p.rotor, _b);
      const len = Math.max(0.02, _a.distanceTo(_b));
      rod.scale.set(1, len, 1);
      rod.position.set(0, -len / 2, 0);
    }
  },
  {
    id: 'piston_head', hidden: true, name: 'Piston', mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: 0.05, r: p.size.x / 2 }],
    mesh: (p) => {
      const rod = mk(geo.cyl(p.size.x * 0.22, 1, 16), M.chrome);
      const g = grp(mk(geo.cyl(p.size.x / 2, 0.1, 28), mat(p)), rod);
      g.userData.rod = rod;
      return g;
    }
  },
  {
    id: 'spring', name: 'Spring', cat: 'Moving', desc: 'Squishes and bounces back. Put it between your build and a wheel for suspension.', size: [0.4, 0.8, 0.4], resize: 'round', mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: 0.04, r: p.size.x / 2, p: [0, -p.size.y / 2 + 0.04, 0] }],
    mesh: (p) => {
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 81 }, (_, i) => {
        const t = i / 80, a = t * Math.PI * 2 * 7;
        return new THREE.Vector3(Math.cos(a) * p.size.x * 0.36, t, Math.sin(a) * p.size.x * 0.36);
      }));
      const coil = mk(geo.tube('spring' + p.size.x.toFixed(2), curve, 400, p.size.x * 0.045), M.chrome);
      const g = grp(mk(geo.cyl(p.size.x / 2, 0.08, 24), M.iron, 0, -p.size.y / 2 + 0.04, 0), coil);
      g.userData.coil = coil;
      coil.position.y = -p.size.y / 2 + 0.08;
      coil.scale.y = p.size.y - 0.16;
      return g;
    },
    joint: { type: 'spring', at: (p) => p.size.y / 2 - 0.04, rotor: 'spring_head', rotorSize: (p) => [p.size.x, 0.08, p.size.x], rotorAt: () => 0 },
    props: [{ k: 'stiff', label: 'Stiffness', type: 'slider', min: 5, max: 100, step: 5, def: 45 }, { k: 'bounce', label: 'Bounciness', type: 'slider', min: 0, max: 100, step: 5, def: 30 }],
    init(p) {
      if (!p.joint) return;
      const room = p.size.y - 0.16;
      p.joint.setLimits(-room * 0.85, room * 0.25);
      p.joint.configureMotorPosition(0, p.props.stiff * p.props.stiff * 0.6 + 50, (100 - p.props.bounce) * 0.9 + 4);
    },
    frame(p) {
      const coil = p.mesh && p.mesh.userData.coil;
      if (!coil || !p.rotor) return;
      worldPos(p, _a, _c.set(0, -p.size.y / 2 + 0.08, 0));
      worldPos(p.rotor, _b);
      coil.scale.y = Math.max(0.05, _a.distanceTo(_b) - 0.04);
    }
  },
  {
    id: 'spring_head', hidden: true, name: 'Spring', mat: 'steel',
    shapes: (p) => [{ t: 'cyl', hh: 0.04, r: p.size.x / 2 }],
    mesh: (p) => mk(geo.cyl(p.size.x / 2, 0.08, 24), M.iron)
  },
  {
    id: 'wheel', name: 'Wheel', cat: 'Moving', desc: 'Stick it on the side of a build. With a seat, W / S drives and A / D turns.', size: [0.9, 0.32, 0.9], resize: 'round', mat: 'alu',
    halfH: (p) => (p.size.y + 0.1) / 2,
    shapes: (p) => [{ t: 'cyl', hh: 0.05, r: Math.min(0.12, p.size.x * 0.15), p: [0, -(p.size.y + 0.1) / 2 + 0.05, 0] }],
    mesh: (p) => grp(mk(geo.cyl(Math.min(0.12, p.size.x * 0.15), 0.1, 16), M.iron, 0, -(p.size.y + 0.1) / 2 + 0.05, 0)),
    joint: { type: 'revolute', at: (p) => -(p.size.y + 0.1) / 2 + 0.1, rotor: 'tire', rotorSize: (p) => [p.size.x, p.size.y, p.size.x], rotorAt: (p) => p.size.y / 2 },
    props: [P.input('drive'), P.on(false), P.speed(55), P.power(55), P.invert(), { k: 'grip', label: 'Grip', type: 'slider', min: 10, max: 100, step: 5, def: 70 }],
    control: 'analog',
    fixed(p) {
      const s = p.st.level * (p.props.invert ? -1 : 1) * (p.st.driveSign || 1);
      const r = p.size.x / 2;
      // free rolling when nobody is pressing: a gentle brake so builds do not roll away forever
      if (Math.abs(s) < 0.01) setMotor(p, 'vel', 0, 0.6, 30 + p.props.power * 3);
      else setMotor(p, 'vel', s * (6 + p.props.speed * 0.42) / r, 25, 300 + p.props.power * p.props.power * 3 * r);
    }
  },
  {
    id: 'tire', hidden: true, name: 'Wheel', mat: 'alu',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2, friction: 1.3, bounce: 0.15 }],
    mesh: (p) => {
      const R = p.size.x / 2, W = p.size.y / 2, side = Math.min(0.13, R * 0.3);
      // tire cross-section spun around the axle: rubber sidewalls with rounded shoulders
      const prof = [];
      for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * Math.PI; prof.push([R - side * 0.5 + Math.cos(a) * side * 0.5, Math.sin(a) * W]); }
      const tireG = geo.lathe(`tire${R.toFixed(2)},${W.toFixed(2)}`, [[R - side, -W * 0.92], ...prof, [R - side, W * 0.92]], 40);
      const rim = mk(geo.cyl(R - side * 0.95, W * 1.6, 32), mat(p));
      const hub = mk(geo.cyl(R * 0.22, W * 1.9, 20), M.chrome);
      const g = grp(mk(tireG, M.tire), rim, hub);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mk(geo.cyl(R * 0.04, W * 1.95, 8), M.iron, Math.cos(a) * R * 0.38, 0, Math.sin(a) * R * 0.38));
      }
      return g;
    },
    frictionOf: (p) => p.rotorBase ? 0.4 + p.rotorBase.props.grip / 50 : 1.3
  },

  /* ---------------- pushers ---------------- */
  {
    id: 'thruster', name: 'Thruster', cat: 'Power', desc: 'A rocket. It pushes the opposite way it points. With a seat it fires by itself on the right keys.', size: [0.5, 0.8, 0.5], resize: 'uniform-ish', mat: 'iron',
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const s = p.size.x / 0.5, h = p.size.y;
      const bell = geo.lathe('bell' + s.toFixed(2) + h.toFixed(2), [[0.12 * s, -h / 2 + 0.2], [0.14 * s, -h / 2 + 0.28], [0.16 * s, h * 0.05], [0.22 * s, h * 0.3], [0.25 * s, h / 2], [0.235 * s, h / 2]], 32);
      const bellM = mk(bell, twoSided('iron'));
      const flame = new THREE.Mesh(geo.cone(0.2 * s, 1, 20), flameMaterial());
      flame.geometry = flame.geometry.clone().translate(0, -0.5, 0).rotateX(Math.PI);
      flame.position.y = h / 2;
      flame.visible = false;
      flame.renderOrder = 5;
      const g = grp(mk(geo.cyl(0.24 * s, 0.2, 24), mat(p), 0, -h / 2 + 0.1, 0), bellM, flame);
      g.userData.flame = flame;
      return g;
    },
    props: [P.input('auto'), P.on(false), P.power(50), P.invert()],
    control: 'analog',
    fixed(p, dt) {
      const lv = Math.max(0, p.st.level * (p.props.invert ? -1 : 1));
      p.st.thrust = lv;
      if (lv <= 0) return;
      const vol = p.size.x * p.size.x * p.size.y / 0.2;
      const f = worldUp(p, _a).multiplyScalar(-lv * (300 + p.props.power * 90) * vol);
      push(p.body.rb, f, worldPos(p, _b), dt);
    },
    frame(p, dt) {
      const fl = p.mesh && p.mesh.userData.flame;
      if (!fl) return;
      const lv = p.st.thrust || 0;
      p.st.fl = (p.st.fl || 0) + (lv - (p.st.fl || 0)) * Math.min(1, dt * 14);
      fl.visible = p.st.fl > 0.02;
      fl.material.uniforms.uPower.value = Math.min(1, p.st.fl * 1.4);
      fl.scale.set(1, 0.4 + p.st.fl * 2.4 * (0.9 + Math.random() * 0.2), 1);
    },
    loop: 'thrust'
  },
  {
    id: 'balloon', name: 'Balloon', cat: 'Power', desc: 'Floats up and lifts whatever it is tied to. Pops if you hit it.', size: [1, 1, 1], resize: 'uniform', mat: 'plastic', color: '#d23b3b',
    halfH: (p) => p.size.x * 0.65,
    shapes: (p) => [{ t: 'ball', r: p.size.x / 2, p: [0, p.size.x * 0.15, 0] }],
    density: 15,
    mesh: (p) => {
      const r = p.size.x / 2;
      const m = new THREE.MeshStandardMaterial({ color: p.color || '#d23b3b', roughness: 0.25, metalness: 0, envMapIntensity: 1.2 });
      const b = mk(geo.ball(r, 28), m, 0, r * 0.3, 0);
      b.scale.set(1, 1.12, 1);
      return grp(b, mk(geo.cone(r * 0.12, r * 0.25, 10), m, 0, -r * 0.82, 0, Math.PI));
    },
    props: [{ k: 'lift', label: 'Lift', type: 'slider', min: 5, max: 100, step: 5, def: 40 }],
    fixed(p, dt, ctx) {
      const g = -ctx.gravity;
      if (g <= 0) return;
      const vol = Math.pow(p.size.x, 3);
      push(p.body.rb, _a.set(0, p.props.lift * 4 * vol * g, 0), worldPos(p, _b), dt);
    },
    fragile: true, popSound: true
  },
  {
    id: 'wing', name: 'Wing', cat: 'Power', desc: 'Makes lift when air rushes past it. Planes and gliders need these.', size: [3, 0.08, 1.2], resize: 'xyz', mat: 'alu',
    shapes: (p) => [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }],
    mesh: (p) => mk(geo.box(p.size.x, p.size.y, p.size.z, 0.03), mat(p)),
    fixed(p, dt) {
      const at = worldPos(p, _b);
      const v = velAt(p.body.rb, at, _c);
      const sp = v.length();
      if (sp < 1) return;
      const n = worldUp(p, _a);
      const vn = v.dot(n);
      const area = p.size.x * p.size.z;
      // flat plate in moving air: push back against the part of the airflow that hits the face
      const f = n.multiplyScalar(-vn * sp * area * 0.7);
      if (f.lengthSq() > 4e8) f.setLength(2e4);
      push(p.body.rb, f, at, dt);
    }
  },
  {
    id: 'gyro', name: 'Gyro', cat: 'Power', desc: 'Keeps a build upright and turns it. Ships and planes: A / D turns, Up / Down tilts, Q / E rolls.', size: [0.6, 0.6, 0.6], resize: 'uniform', mat: 'steel',
    shapes: (p) => [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }],
    mesh: (p) => {
      const s = p.size.x;
      const ring1 = mk(geo.torus(s * 0.36, s * 0.03, 40), M.chrome);
      const ring2 = mk(geo.torus(s * 0.3, s * 0.03, 40), M.alu, 0, 0, 0, Math.PI / 2);
      const core = mk(geo.ball(s * 0.12, 16), M.dark);
      const spin = grp(ring1, ring2, core);
      const g = grp(mk(geo.box(s, s * 0.12, s), M.iron, 0, -s * 0.44, 0), spin);
      g.userData.spin = spin;
      return g;
    },
    props: [P.input('auto', [['auto', 'Auto'], ['none', 'Nothing']]), { k: 'level', label: 'Keep level', type: 'toggle', def: true }, P.power(50)],
    fixed(p, dt, ctx) {
      const c = p.st.ctl;
      if (!c && !p.props.level) return;
      const rb = p.body.rb;
      const mass = p.st.constructMass || rb.mass();
      const k = mass * (0.6 + p.props.power / 40);
      const q = bodyQuat(rb, _q);
      const seatQ = p.st.seatQuat || q;
      const fwd = _a.set(0, 0, -1).applyQuaternion(seatQ), right = _b.set(1, 0, 0).applyQuaternion(seatQ), up = _c.set(0, 1, 0).applyQuaternion(seatQ);
      const av = rb.angvel();
      const tq = new THREE.Vector3();
      // turning from the controls: D turns right, Up tilts the nose up, E rolls right
      if (c) {
        tq.addScaledVector(up, -c.steer * 2.2).addScaledVector(right, c.pitch * 1.8).addScaledVector(fwd, c.roll * 2.2);
        tq.multiplyScalar(k * 2);
      }
      // keep level: tilt back toward upright, except on the axis you are tilting yourself
      if (p.props.level) {
        const err = new THREE.Vector3(up.y * 0 - up.z * 1, up.z * 0 - up.x * 0, up.x * 1 - up.y * 0); // up x worldUp
        if (c && Math.abs(c.pitch) > 0.1) err.sub(err.clone().projectOnVector(right));
        if (c && Math.abs(c.roll) > 0.1) err.sub(err.clone().projectOnVector(fwd));
        tq.addScaledVector(err, k * 9);
      }
      // calm down spinning
      tq.x -= av.x * k * 2.4; tq.y -= av.y * k * 2.4; tq.z -= av.z * k * 2.4;
      twist(rb, tq, dt);
      if (p.st.multi) for (const b of p.st.multi) if (b !== rb) { const w = b.angvel(); twist(b, { x: -w.x * b.mass() * 1.5, y: -w.y * b.mass() * 1.5, z: -w.z * b.mass() * 1.5 }, dt); }
    },
    frame(p, dt) {
      const s = p.mesh && p.mesh.userData.spin;
      if (s) { s.rotation.y += dt * 9; s.rotation.x += dt * 2.3; }
    }
  },
  {
    id: 'hover', name: 'Hover Pad', cat: 'Power', desc: 'Floats your build above the ground. Put it under the build, face down.', size: [1, 0.2, 1], resize: 'xyz', mat: 'steel',
    shapes: (p) => [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }],
    mesh: (p) => {
      const glow = new THREE.MeshStandardMaterial({ color: 0x0a1820, emissive: 0x3ad8ff, emissiveIntensity: 0, roughness: 0.4 });
      const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.03), mat(p)),
        mk(geo.box(p.size.x * 0.8, 0.02, p.size.z * 0.8, 0), glow, 0, p.size.y / 2 + 0.006, 0));
      g.userData.glow = glow;
      return g;
    },
    props: [P.input('k3'), P.on(true), { k: 'height', label: 'Float height (m)', type: 'slider', min: 0.5, max: 8, step: 0.5, def: 1.5 }, P.power(60)],
    control: 'toggle',
    fixed(p, dt, ctx) {
      if (!p.st.active) return;
      const from = worldPos(p, _b);
      const dir = worldUp(p, _a);
      const hit = ctx.ray(from, dir, p.props.height * 2.5, p.body);
      p.st.hoverHit = !!hit;
      if (!hit) return;
      const rb = p.body.rb;
      const share = (p.st.constructMass || rb.mass()) / Math.max(1, p.st.padCount || 1);
      const want = p.props.height, d = hit.toi;
      const vel = velAt(rb, from, _c).dot(dir);
      const g = Math.max(2, -ctx.gravity);
      const f = clamp((want - d) * (8 + p.props.power / 6) * g * 0.35 + vel * 3.2, -2 * g, 6 * g) * share;
      push(rb, _c.copy(dir).multiplyScalar(-f), from, dt);
    },
    frame(p) {
      const gl = p.mesh && p.mesh.userData.glow;
      if (gl) gl.emissiveIntensity = p.st.active ? (p.st.hoverHit ? 2.5 : 1) : 0;
    }
  }
];
export const ANALOG_INPUTS = INPUTS;
