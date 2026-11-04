// SHRINKWORKS parts: real scanned objects, the hand tools (glue, wire, pliers, spray paint), the grip handle that turns
// any build into something you hold, batteries, the size ray, the time core, cameras and screens.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as geo from './geo.js';
import { mk, grp, M, P, lens } from './common.js';
import { partMaterial } from '../core/mats.js';
import { assetURL, track } from '../core/assets.js';
import { beamMaterial } from '../fx/shaders.js';
import { worldPos, worldUp, worldDir } from './rt.js';
import { U } from '../game.js';

const mat = (p) => partMaterial(p.mat, p.color);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const box = (p) => [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }];
const glowMat = (c, i = 2.5) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(c), emissiveIntensity: i, roughness: 0.3 });
// the way a tool sits in your hand: its +Y (nozzle) points where your controller points
const POINT_FWD = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

/* ---------------- real scanned objects (Poly Haven, CC0) ---------------- */
// name, file, real density (kg per m3, for the weight), material for sounds + how strong it is
const REAL = [
  ['food_apple_01', 'Apple', 820, 'plastic', 'Food'], ['lemon', 'Lemon', 900, 'plastic', 'Food'], ['food_lime_01', 'Lime', 900, 'plastic', 'Food'],
  ['food_kiwi_01', 'Kiwi', 1000, 'plastic', 'Food'], ['food_avocado_01', 'Avocado', 950, 'plastic', 'Food'], ['yellow_onion', 'Onion', 900, 'plastic', 'Food'],
  ['croissant', 'Croissant', 250, 'fabric', 'Food'], ['bananas', 'Bananas', 900, 'plastic', 'Food'],
  ['wooden_cutting_board', 'Cutting Board', 650, 'planks', 'Kitchen'], ['wooden_bowl_01', 'Wooden Bowl', 450, 'planks', 'Kitchen'],
  ['wooden_spoon', 'Wooden Spoon', 650, 'planks', 'Kitchen'], ['jug_01', 'Jug', 600, 'plastic', 'Kitchen'], ['carved_wooden_plate', 'Wooden Plate', 600, 'planks', 'Kitchen'],
  ['brass_pan_01', 'Brass Pan', 1500, 'gold', 'Kitchen'], ['pot_enamel_01', 'Enamel Pot', 700, 'steel', 'Kitchen'],
  ['pliers', 'Pliers', 3500, 'iron', 'Tools'], ['screwdriver', 'Screwdriver', 1500, 'steel', 'Tools'], ['adjustable_wrench', 'Wrench', 5000, 'iron', 'Tools'],
  ['magnifying_glass_01', 'Magnifying Glass', 900, 'plastic', 'Tools'], ['measuring_tape_01', 'Measuring Tape', 900, 'plastic', 'Tools'],
  ['lightbulb_01', 'Light Bulb', 300, 'glass', 'Tools'], ['drill_01', 'Power Drill', 1100, 'plastic', 'Tools'], ['retro_multimeter', 'Multimeter', 800, 'plastic', 'Tools'],
  ['vintage_flashlight', 'Flashlight', 900, 'steel', 'Tools'], ['cardboard_box_01', 'Cardboard Box', 60, 'fabric', 'Kitchen'], ['wooden_crate_01', 'Wooden Crate', 200, 'planks', 'Kitchen']
];
export const MODELS = {}; // file -> { scene, size (units), pts (hull points in units, for size = natural size) }
export function loadRealModels() {
  const loader = new GLTFLoader();
  return Promise.all(REAL.map(([file]) => track(loader.loadAsync(assetURL('models/real/' + file + '.glb')).then((g) => {
    const root = g.scene;
    root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(root);
    const c = bb.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    root.position.sub(c);
    holder.add(root);
    holder.scale.setScalar(U); // the scans are in meters, the game in units
    holder.updateMatrixWorld(true);
    const pts = [];
    holder.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.geometry.userData.shared = true;
      const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 220));
      for (let i = 0; i < pos.count; i += step) { _a.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); pts.push(_a.x, _a.y, _a.z); }
    });
    MODELS[file] = { scene: holder, size: bb.getSize(new THREE.Vector3()).multiplyScalar(U), pts: new Float32Array(pts) };
  }).catch((e) => console.warn('model', file, e)), 0.4)));
}
function realDef([file, name, dens, m, group]) {
  return {
    id: 'real_' + file, name, cat: 'Real stuff', group, real: file, mat: m, resize: 'uniform', noPaint: true,
    desc: 'A real scanned ' + name.toLowerCase() + '. Grab it, throw it, glue it into a gadget.',
    get size() { const M2 = MODELS[file]; return M2 ? [M2.size.x, M2.size.y, M2.size.z] : [1, 1, 1]; },
    density: dens * 0.6,
    shapes: (p) => {
      const M2 = MODELS[file];
      if (!M2) return [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }];
      const k = p.size.x / M2.size.x;
      const pts = k === 1 ? M2.pts : M2.pts.map((v) => v * k);
      return [{ t: 'hull', pts }];
    },
    mesh: (p) => {
      const M2 = MODELS[file];
      if (!M2) return mk(geo.box(p.size.x, p.size.y, p.size.z), mat(p));
      const o = M2.scene.clone(true);
      o.scale.multiplyScalar(p.size.x / M2.size.x);
      return grp(o);
    }
  };
}

/* ---------------- tools you hold (they are real objects too: put them down, they fall) ---------------- */
function glueMesh() {
  const body = geo.lathe('gluebody', [[0.0, -0.6], [0.22, -0.6], [0.25, -0.55], [0.25, 0.3], [0.2, 0.42], [0.09, 0.5], [0.0, 0.5]], 28);
  const nozzle = geo.lathe('gluenozzle', [[0.0, 0.48], [0.1, 0.48], [0.1, 0.56], [0.035, 0.86], [0.012, 0.9], [0.0, 0.9]], 20);
  const white = partMaterial('plastic', '#f2efe6'), orange = partMaterial('plastic', '#e36a1f');
  const glue = new THREE.Mesh(geo.ball(0.035, 10), new THREE.MeshStandardMaterial({ color: 0xf6f1df, roughness: 0.15 }));
  glue.position.y = 0.9; glue.visible = false;
  const g = grp(mk(body, white), mk(nozzle, orange), mk(geo.cyl(0.255, 0.42, 28), partMaterial('plastic', '#2f6fd1'), 0, -0.1, 0), glue);
  g.userData.drip = glue;
  return g;
}
function spoolMesh() {
  const copper = new THREE.MeshStandardMaterial({ color: 0xc87533, metalness: 1, roughness: 0.35 });
  const flange = partMaterial('plastic', '#2b2d31');
  const g = grp(
    mk(geo.cyl(0.4, 0.06, 28), flange, 0, -0.27, 0), mk(geo.cyl(0.4, 0.06, 28), flange, 0, 0.27, 0),
    mk(geo.cyl(0.3, 0.48, 28), copper),
    mk(geo.cyl(0.04, 0.5, 8), copper, 0.2, 0.5, 0),
    mk(geo.cyl(0.07, 0.12, 10), partMaterial('plastic', '#c4271f'), 0.2, 0.78, 0));
  return g;
}
function canMesh(p) {
  const c = p.props.paint || '#c4271f';
  return grp(
    mk(geo.cyl(0.2, 0.9, 28), partMaterial('steel', c), 0, -0.1, 0),
    mk(geo.lathe('candome', [[0.2, 0.35], [0.17, 0.42], [0.07, 0.47], [0, 0.48]], 24), M.chrome),
    mk(geo.cyl(0.06, 0.08, 12), partMaterial('plastic', '#f2efe6'), 0, 0.52, 0),
    mk(geo.cyl(0.21, 0.08, 28), partMaterial('plastic', c), 0, -0.52, 0));
}

const PLIERS = realDef(REAL[15]);
const TOOLS = [
  {
    id: 'tool_glue', name: 'Glue Bottle', cat: 'Tools', desc: 'Squeeze (trigger) to put a drop of glue on anything. Push another thing onto the drop: stuck for good. Glue on the counter or floor holds it in place.',
    size: [0.5, 1.5, 0.5], resize: 'uniform', mat: 'plastic', tool: 'glue', noGlue: true, noPaint: true, density: 250,
    tip: (p) => _c.set(0, 0.9 * p.size.y / 1.5, 0), grip: (p) => _b.set(0, -0.15 * p.size.y / 1.5, 0), gripQ: POINT_FWD,
    shapes: (p) => { const k = p.size.y / 1.5; return [{ t: 'cyl', hh: 0.55 * k, r: 0.25 * k, p: [0, -0.05 * k, 0] }, { t: 'cone', hh: 0.2 * k, r: 0.09 * k, p: [0, 0.7 * k, 0] }]; },
    mesh: (p) => { const g = glueMesh(); g.scale.setScalar(p.size.y / 1.5); return g; },
    frame(p) { const d = p.mesh && p.mesh.userData.drip; if (d) d.visible = (p.st.squeeze || 0) > 0; }
  },
  {
    id: 'tool_wire', name: 'Wire Spool', cat: 'Tools', desc: 'Trigger on a button, switch, sensor, timer or gate, then trigger on what it should turn on. A real wire connects them.',
    size: [0.8, 0.6, 0.8], resize: 'uniform', mat: 'plastic', tool: 'wire', noGlue: true, noPaint: true, density: 900,
    tip: (p) => _c.set(0.2, 0.84, 0).multiplyScalar(p.size.y / 0.6), grip: (p) => _b.set(0, 0, 0), gripQ: POINT_FWD,
    shapes: (p) => { const k = p.size.y / 0.6; return [{ t: 'cyl', hh: 0.3 * k, r: 0.4 * k }]; },
    mesh: (p) => { const g = spoolMesh(); g.scale.setScalar(p.size.y / 0.6); return g; }
  },
  {
    id: 'tool_cutter', name: 'Pliers (Cutter)', cat: 'Tools', desc: 'Trigger close to a part: it comes unglued from its build. Close to a wire: the wire is cut.',
    get size() { const M2 = MODELS.pliers; return M2 ? [M2.size.x, M2.size.y, M2.size.z] : [0.6, 2, 0.2]; },
    resize: 'uniform', mat: 'iron', tool: 'cut', noGlue: true, noPaint: true, density: 3000,
    // the real scan stands along +Y with the jaws at the top (measured: 18 cm long, jaws 2.5 cm wide)
    tip: (p) => _c.set(0, p.size.y * 0.47, 0), grip: (p) => _b.set(0, -p.size.y * 0.2, 0), gripQ: POINT_FWD,
    shapes: (p) => PLIERS.shapes(p),
    mesh: (p) => PLIERS.mesh(p)
  },
  {
    id: 'tool_paint', name: 'Spray Paint', cat: 'Tools', desc: 'Trigger sprays paint on whatever is in front of the nozzle. Change the color in its menu (B / Y while holding it).',
    size: [0.42, 1.12, 0.42], resize: 'uniform', mat: 'steel', tool: 'paint', noGlue: true, noPaint: true, density: 700,
    tip: (p) => _c.set(0, 0.56, 0.0).multiplyScalar(p.size.y / 1.12), grip: (p) => _b.set(0, -0.15, 0), gripQ: POINT_FWD,
    props: [{ k: 'paint', label: 'Paint color', type: 'swatch', def: '#c4271f', rebuild: true }],
    shapes: (p) => { const k = p.size.y / 1.12; return [{ t: 'cyl', hh: 0.53 * k, r: 0.21 * k }]; },
    mesh: (p) => { const g = canMesh(p); g.scale.setScalar(p.size.y / 1.12); return g; }
  }
];

/* ---------------- power ---------------- */
const BATTERIES = [
  {
    id: 'battery_aa', name: 'AA Battery', cat: 'Power', battery: 1, desc: 'A real AA battery. Glue it onto a build and its motors, lights and rays work.', size: [0.145, 0.5, 0.145], resize: null, mat: 'steel', density: 2700,
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => grp(mk(geo.cyl(0.0725, 0.4, 20), partMaterial('steel', '#1d1f23'), 0, -0.05, 0), mk(geo.cyl(0.0726, 0.1, 20), partMaterial('steel', '#c88a2a'), 0, 0.2, 0),
      mk(geo.cyl(0.025, 0.02, 12), M.chrome, 0, 0.26, 0))
  },
  {
    id: 'battery_9v', name: '9V Battery', cat: 'Power', battery: 2, desc: 'A real 9 volt battery. More power for small gadgets.', size: [0.26, 0.48, 0.175], resize: null, mat: 'steel', density: 2000,
    shapes: box,
    mesh: (p) => grp(mk(geo.box(0.26, 0.42, 0.175, 0.012), partMaterial('steel', '#2a2c30'), 0, -0.03, 0), mk(geo.box(0.262, 0.05, 0.177, 0.005), partMaterial('steel', '#d7a02a'), 0, 0.18, 0),
      mk(geo.cyl(0.035, 0.04, 6), M.chrome, -0.06, 0.22, 0), mk(geo.cyl(0.04, 0.04, 12), M.chrome, 0.06, 0.22, 0))
  },
  {
    id: 'battery_car', name: 'Car Battery', cat: 'Power', battery: 4, desc: 'A heavy real car battery. Powers big builds. Hard to lift when you are small.', size: [2.4, 1.75, 1.75], resize: null, mat: 'plastic', density: 1700,
    shapes: box,
    mesh: (p) => grp(mk(geo.box(2.4, 1.6, 1.75, 0.05), partMaterial('plastic', '#1a1b1e'), 0, -0.075, 0), mk(geo.box(2.42, 0.14, 1.77, 0.03), partMaterial('plastic', '#2a2b2f'), 0, 0.73, 0),
      mk(geo.cyl(0.12, 0.18, 14), partMaterial('plastic', '#c4271f'), -0.8, 0.86, 0.5), mk(geo.cyl(0.12, 0.18, 14), M.dark, 0.8, 0.86, 0.5))
  },
  {
    id: 'battery_inf', name: 'Infinity Battery', cat: 'Power', battery: 8, desc: 'From your spawner: never runs out and powers anything. Glue it onto any gadget.', size: [0.36, 0.8, 0.36], resize: 'uniform', mat: 'chrome', density: 1200,
    shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
    mesh: (p) => {
      const k = p.size.y / 0.8, core = mk(geo.cyl(0.11, 0.56, 20), glowMat('#38d6ff', 3.2));
      const g = grp(core, mk(geo.cyl(0.18, 0.1, 24), M.chrome, 0, 0.35, 0), mk(geo.cyl(0.18, 0.1, 24), M.chrome, 0, -0.35, 0),
        mk(geo.cyl(0.05, 0.06, 10), M.chrome, 0, 0.43, 0));
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.add(mk(geo.cyl(0.018, 0.62, 6), M.chrome, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16)); }
      g.scale.setScalar(k);
      g.userData.core = core;
      return g;
    },
    frame(p, dt, ctx) { const c = p.mesh && p.mesh.userData.core; if (c) c.material.emissiveIntensity = 2.6 + Math.sin(ctx.time * 3) * 0.6; }
  }
];

/* ---------------- control: the grip handle ---------------- */
const HANDLE = {
  id: 'handle', name: 'Grip Handle', cat: 'Control', desc: 'Hold any build by this handle like a real gadget. Trigger fires everything set to "Auto" (rays, lasers, thrusters, motors...).',
  size: [0.32, 1.1, 0.5], resize: null, mat: 'rubber', handle: true,
  // where your fist goes, and which way the gadget points (its -Z) when you hold it
  grip: () => _b.set(0, -0.1, 0.05), gripQ: new THREE.Quaternion(), // the gadget points exactly where your controller points
  shapes: (p) => [{ t: 'box', h: [0.15, 0.48, 0.2], p: [0, -0.07, 0.04], q: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.25) }, { t: 'box', h: [0.16, 0.05, 0.25], p: [0, 0.5, 0] }],
  mesh: () => {
    const tilt = new THREE.Group(); tilt.rotation.x = 0.25; tilt.position.set(0, -0.07, 0.04);
    tilt.add(mk(geo.box(0.3, 0.96, 0.4, 0.12), M.rubber));
    for (let i = 0; i < 4; i++) tilt.add(mk(geo.box(0.31, 0.04, 0.3, 0.01), M.dark, 0, -0.3 + i * 0.18, -0.05));
    const trig = mk(geo.box(0.06, 0.22, 0.08, 0.02), M.red, 0, 0.28, -0.32);
    const guard = mk(geo.torus(0.16, 0.022, 20, Math.PI), M.dark, 0, 0.3, -0.28, 0, Math.PI / 2, 0);
    const g = grp(tilt, mk(geo.box(0.32, 0.1, 0.5, 0.02), M.iron, 0, 0.5, 0), trig, guard);
    g.userData.trig = trig;
    return g;
  },
  frame(p) { const t = p.mesh && p.mesh.userData.trig; if (t) t.position.z = -0.32 + (p.st.trig || 0) * 0.07; }
};

/* ---------------- sci-fi: size ray + time core ---------------- */
const SIZE_RAY = {
  id: 'size_ray', name: 'Size Ray', cat: 'Sci-Fi', desc: 'Shrinks or grows whatever its beam hits: parts, real objects, whole builds, even you. Needs a battery.',
  size: [0.32, 0.9, 0.32], resize: 'uniform', mat: 'chrome', electric: true,
  shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
  mesh: (p) => {
    const k = p.size.y / 0.9;
    const grow = p.props.mode === 'grow', col = grow ? '#36e0ff' : '#b26cff';
    const beam = new THREE.Mesh(geo.cyl(0.075, 1, 14), beamMaterial(col)); // ~1.5 cm glowing beam: easy to see in VR
    beam.geometry = beam.geometry.clone().translate(0, 0.5, 0);
    beam.position.y = 0.46; beam.visible = false; beam.renderOrder = 5;
    const lensM = glowMat(col, 1.2);
    const g = grp(mk(geo.cyl(0.13, 0.7, 24), partMaterial('steel', '#2b2d31'), 0, -0.05, 0),
      mk(geo.cyl(0.16, 0.06, 24), M.chrome, 0, -0.3, 0), mk(geo.cyl(0.16, 0.06, 24), M.chrome, 0, 0.0, 0), mk(geo.cyl(0.16, 0.06, 24), M.chrome, 0, 0.28, 0),
      mk(geo.cyl(0.1, 0.16, 20, 0.16), M.chrome, 0, 0.38, 0), mk(geo.cyl(0.085, 0.02, 20), lensM, 0, 0.455, 0), beam);
    g.scale.setScalar(k);
    g.userData.beam = beam; g.userData.lens = lensM;
    return g;
  },
  props: [P.input('auto'), P.on(false), { k: 'mode', label: 'Mode', type: 'choice', options: [['shrink', 'Shrink'], ['grow', 'Grow']], def: 'shrink', rebuild: true },
    P.speed(40), P.range(30, 120)],
  control: 'analog',
  fixed(p, dt, ctx) {
    p.st.len = 0;
    if (!p.st.active) { p.st.acc = 0; return; }
    const k = p.size.y / 0.9;
    const from = worldPos(p, _a, _c.set(0, 0.47 * k, 0)), dir = worldUp(p, _b);
    const range = p.props.range;
    const hit = ctx.ray(from, dir, range, p.body);
    const you = ctx.rayHitsPlayer(from, dir, hit ? hit.toi : range);
    p.st.len = you != null ? you : hit ? hit.toi : range;
    p.st.acc = (p.st.acc || 0) + dt;
    if (p.st.acc < 0.1) return;
    const rate = 0.25 + p.props.speed / 100 * 1.6;
    const f = Math.exp((p.props.mode === 'grow' ? 1 : -1) * rate * p.st.acc * Math.max(0.2, p.st.level));
    p.st.acc = 0;
    if (you != null) ctx.scalePlayer(f);
    else if (hit && hit.owner && hit.owner.kind === 'part' && !ctx.sameBuild(hit.owner.ref, p)) ctx.scaleBuild(hit.owner.ref, f, hit.point);
    if (hit || you != null) ctx.fx.sparks(from.clone().addScaledVector(dir, p.st.len), 3, 1.5, p.props.mode === 'grow' ? 0x36e0ff : 0xb26cff);
  },
  frame(p) {
    const b = p.mesh && p.mesh.userData.beam;
    if (!b) return;
    b.visible = !!p.st.active && (p.st.len || 0) > 0;
    b.scale.set(1, Math.max(0.05, (p.st.len || 0) / (p.size.y / 0.9)), 1);
    p.mesh.userData.lens.emissiveIntensity = p.st.active ? 4 : 1.2;
  },
  loop: 'beam'
};

// one ray, many powers: copy things, pin them in the air, let them go, make them float, launch them, erase them
const FX_MODES = [['clone', 'Clone (copies it)'], ['freeze', 'Freeze (pins it in the air)'], ['unfreeze', 'Unfreeze'], ['float', 'Float (no gravity)'],
  ['launch', 'Launch (shoves it away)'], ['erase', 'Erase (B = undo)']];
const FX_COLOR = { clone: '#4dff88', freeze: '#d8f4ff', unfreeze: '#ffd24d', float: '#38d6ff', launch: '#ff8a2a', erase: '#ff3b3b' };
const FX_RAY = {
  id: 'fx_ray', name: 'Effect Ray', cat: 'Sci-Fi', desc: 'A beam with a power you pick in its menu: clone, freeze in the air, unfreeze, float, launch or erase whatever it hits. Needs a battery.',
  size: [0.32, 0.9, 0.32], resize: 'uniform', mat: 'chrome', electric: true,
  shapes: (p) => [{ t: 'cyl', hh: p.size.y / 2, r: p.size.x / 2 }],
  mesh: (p) => {
    const k = p.size.y / 0.9, col = FX_COLOR[p.props.mode] || '#4dff88';
    const beam = new THREE.Mesh(geo.cyl(0.075, 1, 14), beamMaterial(col)); // ~1.5 cm glowing beam: easy to see in VR
    beam.geometry = beam.geometry.clone().translate(0, 0.5, 0);
    beam.position.y = 0.46; beam.visible = false; beam.renderOrder = 5;
    const lensM = glowMat(col, 1.2);
    const g = grp(mk(geo.cyl(0.14, 0.62, 24), partMaterial('steel', '#e8e8e8'), 0, -0.09, 0),
      mk(geo.cyl(0.16, 0.05, 24), partMaterial('plastic', col), 0, -0.28, 0), mk(geo.cyl(0.16, 0.05, 24), partMaterial('plastic', col), 0, 0.12, 0),
      mk(geo.cyl(0.1, 0.2, 20, 0.15), M.chrome, 0, 0.34, 0), mk(geo.cyl(0.085, 0.02, 20), lensM, 0, 0.455, 0), beam);
    g.scale.setScalar(k);
    g.userData.beam = beam; g.userData.lens = lensM;
    return g;
  },
  props: [P.input('auto'), P.on(false), { k: 'mode', label: 'Power', type: 'choice', options: FX_MODES, def: 'clone', rebuild: true }, P.range(30, 120)],
  control: 'analog',
  fixed(p, dt, ctx) {
    p.st.len = 0;
    p.st.cool = Math.max(0, (p.st.cool || 0) - dt);
    if (!p.st.active) { p.st.last = null; return; }
    const k = p.size.y / 0.9;
    const from = worldPos(p, _a, _c.set(0, 0.47 * k, 0)), dir = worldUp(p, _b);
    const range = p.props.range, mode = p.props.mode;
    const hit = ctx.ray(from, dir, range, p.body);
    const you = mode === 'launch' ? ctx.rayHitsPlayer(from, dir, hit ? hit.toi : range) : null;
    p.st.len = you != null ? you : hit ? hit.toi : range;
    if (p.st.cool > 0) return;
    if (you != null) { ctx.launchPlayer(dir); p.st.cool = 0.5; return; }
    if (!hit || !hit.owner || hit.owner.kind !== 'part' || ctx.sameBuild(hit.owner.ref, p)) return;
    const target = hit.owner.ref;
    // one zap per thing for freeze / unfreeze / float / erase; clone + launch repeat while you hold the trigger
    if ((mode !== 'clone' && mode !== 'launch') && p.st.last === target.body) return;
    p.st.last = target.body;
    ctx.effect(mode, target, hit.point, dir);
    p.st.cool = mode === 'clone' ? 0.9 : mode === 'launch' ? 0.35 : 0.2;
    ctx.fx.sparks(hit.point, 8, 2.5, new THREE.Color(FX_COLOR[mode]).getHex());
  },
  frame(p) {
    const b = p.mesh && p.mesh.userData.beam;
    if (!b) return;
    b.visible = !!p.st.active && (p.st.len || 0) > 0;
    b.scale.set(1, Math.max(0.05, (p.st.len || 0) / (p.size.y / 0.9)), 1);
    p.mesh.userData.lens.emissiveIntensity = p.st.active ? 4 : 1.2;
  },
  loop: 'beam'
};

const TIME_CORE = {
  id: 'time_core', name: 'Time Core', cat: 'Sci-Fi', desc: 'Messes with time while it is on: Rewind (the world goes back, up to 15 seconds), Slow motion, or Stop time. You are not affected. Needs a battery.',
  size: [0.7, 0.7, 0.7], resize: 'uniform', mat: 'gold', electric: true,
  shapes: (p) => [{ t: 'box', h: [p.size.x / 2, p.size.y / 2, p.size.z / 2] }],
  mesh: (p) => {
    const k = p.size.x / 0.7;
    const col = p.props.mode === 'slow' ? '#ffb020' : p.props.mode === 'stop' ? '#e8f4ff' : '#38d6ff';
    const coreM = glowMat(col, 1.5);
    const core = mk(geo.ball(0.16, 24), coreM);
    const ring1 = mk(geo.torus(0.24, 0.018, 32), M.chrome), ring2 = mk(geo.torus(0.24, 0.018, 32), M.chrome);
    ring2.rotation.x = Math.PI / 2;
    const spin = grp(ring1, ring2);
    const g = grp(core, spin);
    const brass = partMaterial('gold');
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.add(mk(geo.cyl(0.025, 0.7, 8), brass, sx * 0.33, 0, sy * 0.33));
      g.add(mk(geo.box(0.7, 0.05, 0.05, 0.01), brass, 0, sx * 0.33, sy * 0.33));
      g.add(mk(geo.box(0.05, 0.05, 0.7, 0.01), brass, sx * 0.33, sy * 0.33, 0));
    }
    g.scale.setScalar(k);
    g.userData.spin = spin; g.userData.core = coreM;
    return g;
  },
  props: [P.input('auto'), P.on(false), { k: 'mode', label: 'What it does', type: 'choice', options: [['rewind', 'Rewind time'], ['slow', 'Slow motion'], ['stop', 'Stop time']], def: 'rewind', rebuild: true }],
  control: 'toggle',
  fixed(p, dt, ctx) { if (p.st.active) ctx.timeRequest(p.props.mode, p); },
  frame(p, dt) {
    const u = p.mesh && p.mesh.userData;
    if (!u || !u.spin) return;
    u.spin.rotation.y += dt * (p.st.active ? (p.props.mode === 'rewind' ? -9 : 2) : 0.4);
    u.spin.rotation.z += dt * (p.st.active ? 3 : 0.2);
    u.core.emissiveIntensity = p.st.active ? 5 : 1.5;
  }
};

/* ---------------- effects: camera + screen (what the camera sees, live) ---------------- */
const CHANNEL = { k: 'channel', label: 'Channel', type: 'choice', options: [[1, '1'], [2, '2'], [3, '3'], [4, '4']], def: 1 };
const CAMERA = {
  id: 'camera', name: 'Camera', cat: 'Effects', desc: 'Films what is in front of its lens (the -Z side). Every Screen on the same channel shows it live. Needs a battery.',
  size: [0.5, 0.36, 0.42], resize: 'uniform', mat: 'plastic', color: '#2b2d31', electric: true, camera: true,
  shapes: box,
  mesh: (p) => {
    const k = p.size.x / 0.5;
    const led = glowMat('#ff2a2a', 0);
    const g = grp(mk(geo.box(0.5, 0.36, 0.34, 0.04), mat(p), 0, 0, 0.04), mk(geo.cyl(0.11, 0.12, 24), M.dark, 0, 0, -0.17, Math.PI / 2, 0, 0),
      mk(geo.cyl(0.085, 0.02, 24), lens, 0, 0, -0.235, Math.PI / 2, 0, 0), mk(geo.ball(0.02, 8), led, 0.18, 0.12, -0.14));
    g.scale.setScalar(k);
    g.userData.led = led;
    return g;
  },
  props: [CHANNEL, P.on(true)], control: 'toggle',
  frame(p) { const l = p.mesh && p.mesh.userData.led; if (l) l.emissiveIntensity = p.st.active ? 3 : 0; }
};
const SCREEN = {
  id: 'screen', name: 'Screen', cat: 'Effects', desc: 'Shows what a Camera on the same channel sees, live. Make a periscope, a security camera, a remote car with a view...',
  size: [1.6, 1.0, 0.08], resize: 'xyz', mat: 'plastic', color: '#1d1f23', electric: true, screen: true,
  shapes: box,
  mesh: (p) => {
    const disp = new THREE.MeshBasicMaterial({ color: 0x050607, toneMapped: false });
    disp.userData.own = true;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(p.size.x * 0.92, p.size.y * 0.88), disp);
    face.position.z = p.size.z / 2 + 0.004;
    const g = grp(mk(geo.box(p.size.x, p.size.y, p.size.z, 0.02), mat(p)), face);
    g.userData.face = face;
    return g;
  },
  props: [CHANNEL, P.on(true)], control: 'toggle'
};

export const SHRINK = [...REAL.map(realDef), ...TOOLS, ...BATTERIES, HANDLE, SIZE_RAY, FX_RAY, TIME_CORE, CAMERA, SCREEN];
export const ELECTRIC = new Set(['motor', 'piston', 'gyro', 'hover', 'light', 'laser', 'speaker', 'magnet', 'blackhole', 'antigrav', 'forcefield',
  'tractor', 'portal', 'slowfield', 'size_ray', 'fx_ray', 'time_core', 'camera', 'screen']);
