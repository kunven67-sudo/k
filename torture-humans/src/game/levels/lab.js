// The mad scientist's basement lab (14 x 10 m, 3 m ceiling).
// Scanned CC0 materials and props; custom glassware built here (terrarium,
// bug tanks, specimen jars, clone tube). Every solid thing has an exact collider.
import * as THREE from 'three';
import { pbr, box, plane, place, loadIndex } from '../engine/assets.js';
import { buildBedroom, BEDROOM } from './bedroom.js';
import { buildLivingRoom, inHouse } from './house.js';
import { buildTinyWorld } from '../cageworld.js';
import { buildTown, inLab } from './town.js';

export const LAB = { w: 14, d: 10, h: 3.0, floorY: 0 };
// the hatch to the bedroom: ladder goes up here
export const HATCH = { x: 5.9, z: -3.9, w: 0.9, d: 0.9 };

const glass = () => new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0, roughness: 0.04, transmission: 1, thickness: 0.006, ior: 1.52,
  transparent: true, opacity: 1, envMapIntensity: 1.2, specularIntensity: 1, side: THREE.DoubleSide,
});
const steel = (c = 0x9aa0a6) => new THREE.MeshStandardMaterial({ color: c, metalness: 1, roughness: 0.35 });

function mesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// glass box with thin real walls (no top) — terrarium / bug tank
function glassTank(w, h, d, { lid = false, frame = 0x2b2b2b } = {}) {
  const g = new THREE.Group();
  const t = 0.008;
  const gm = glass();
  mesh(new THREE.BoxGeometry(w, t, d), gm, 0, t / 2, 0, g);
  mesh(new THREE.BoxGeometry(w, h, t), gm, 0, h / 2, d / 2 - t / 2, g);
  mesh(new THREE.BoxGeometry(w, h, t), gm, 0, h / 2, -d / 2 + t / 2, g);
  mesh(new THREE.BoxGeometry(t, h, d), gm, w / 2 - t / 2, h / 2, 0, g);
  mesh(new THREE.BoxGeometry(t, h, d), gm, -w / 2 + t / 2, h / 2, 0, g);
  // black anodized aluminium frame along the edges
  const fm = new THREE.MeshStandardMaterial({ color: frame, metalness: 0.8, roughness: 0.45 });
  const e = 0.02;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) mesh(new THREE.BoxGeometry(e, h, e), fm, (sx * (w - e)) / 2, h / 2, (sz * (d - e)) / 2, g);
  for (const y of [e / 2, h - e / 2]) {
    for (const sz of [1, -1]) mesh(new THREE.BoxGeometry(w, e, e), fm, 0, y, (sz * (d - e)) / 2, g);
    for (const sx of [1, -1]) mesh(new THREE.BoxGeometry(e, e, d), fm, (sx * (w - e)) / 2, y, 0, g);
  }
  if (lid) {
    const mesh_ = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.6, transparent: true, opacity: 0.85 });
    mesh(new THREE.BoxGeometry(w, 0.01, d), mesh_, 0, h + 0.005, 0, g);
  }
  return g;
}

// specimen jar: lathe-turned glass with a screw-top metal lid
function jar(r = 0.07, h = 0.2) {
  const g = new THREE.Group();
  const pts = [];
  const neck = r * 0.85;
  pts.push(new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.92, 0), new THREE.Vector2(r, r * 0.12));
  pts.push(new THREE.Vector2(r, h * 0.82), new THREE.Vector2(neck, h * 0.9), new THREE.Vector2(neck, h));
  const body = mesh(new THREE.LatheGeometry(pts, 40), glass(), 0, 0, 0, g);
  body.userData.glass = true;
  const lid = mesh(new THREE.CylinderGeometry(neck * 1.06, neck * 1.06, h * 0.08, 40), steel(0xb8b8b8), 0, h + h * 0.035, 0, g);
  lid.userData.lid = true;
  return g;
}

// the clone machine: tall glass tube, steel caps, glowing fluid
function cloneTube() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.25, 48), steel(0x6d7378), 0, 0.125, 0, g);
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 48), steel(0x6d7378), 0, 2.35, 0, g);
  const tube = mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.95, 48, 1, true), glass(), 0, 1.225, 0, g);
  tube.userData.glass = true;
  const fluid = new THREE.MeshPhysicalMaterial({ color: 0x3cff9a, emissive: 0x0e5a33, emissiveIntensity: 1.5, transmission: 0.7, roughness: 0.1, thickness: 0.8, transparent: true, opacity: 0.55 });
  const f = mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.6, 48), fluid, 0, 1.05, 0, g);
  f.castShadow = false;
  const light = new THREE.PointLight(0x46ff9e, 3, 4, 2);
  light.userData.minor = true;
  light.position.set(0, 1.2, 0);
  g.add(light);
  // hoses up to the ceiling pipes
  const hose = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  for (const a of [0, 2.1, 4.2]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.4, 2.5, Math.sin(a) * 0.4),
      new THREE.Vector3(Math.cos(a) * 0.6, 2.75, Math.sin(a) * 0.6),
      new THREE.Vector3(Math.cos(a) * 0.5, 3.0, Math.sin(a) * 0.5),
    ]);
    mesh(new THREE.TubeGeometry(curve, 16, 0.025, 8), hose, 0, 0, 0, g);
  }
  return g;
}

// surgery table: steel top on a hydraulic column, surgical lamp above
function surgeryTable() {
  const g = new THREE.Group();
  const s = steel(0xc5c9cc);
  mesh(new THREE.BoxGeometry(0.7, 0.06, 2.0), s, 0, 0.9, 0, g);
  mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.85, 24), steel(0x777c80), 0, 0.45, 0, g);
  mesh(new THREE.BoxGeometry(0.6, 0.05, 0.9), steel(0x555a5e), 0, 0.03, 0, g);
  // straps
  const strap = new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 0.75 });
  for (const z of [-0.6, 0, 0.6]) mesh(new THREE.BoxGeometry(0.72, 0.012, 0.07), strap, 0, 0.935, z, g);
  return g;
}

export async function buildLab({ scene, physics, settings }) {
  await loadIndex();
  const { w, d, h } = LAB;
  const statics = new THREE.Group();   // becomes one exact triangle-mesh collider
  const props = new THREE.Group();     // decoration that is also solid
  statics.name = 'lab-statics';
  props.name = 'lab-props';

  // ---- shell: floor, walls, ceiling (with the hatch hole)
  const floor = new THREE.Mesh(plane(w, d), pbr('concrete_floor_worn_001', { size: 2.5 }));
  floor.receiveShadow = true;
  statics.add(floor);
  const wallMat = pbr('concrete_wall_008', { size: 2.4 });   // poured foundation concrete, form-tie holes and all
  const walls = [
    [w, h, 0.3, 0, h / 2, -d / 2 - 0.15],
    [w, h, 0.3, 0, h / 2, d / 2 + 0.15],
    [0.3, h, d, -w / 2 - 0.15, h / 2, 0],
    [0.3, h, d, w / 2 + 0.15, h / 2, 0],
  ];
  for (const [bw, bh, bd, x, y, z] of walls) mesh(box(bw, bh, bd), wallMat, x, y, z, statics);
  // ceiling slab in pieces around the hatch
  const ceil = pbr('plaster_grey_04', { size: 3 });
  const hx0 = HATCH.x - HATCH.w / 2, hx1 = HATCH.x + HATCH.w / 2, hz0 = HATCH.z - HATCH.d / 2, hz1 = HATCH.z + HATCH.d / 2;
  const slab = (x0, x1, z0, z1) => { if (x1 > x0 && z1 > z0) mesh(box(x1 - x0, 0.3, z1 - z0), ceil, (x0 + x1) / 2, h + 0.15, (z0 + z1) / 2, statics); };
  slab(-w / 2, hx0, -d / 2, d / 2);
  slab(hx1, w / 2, -d / 2, d / 2);
  slab(hx0, hx1, -d / 2, hz0);
  slab(hx0, hx1, hz1, d / 2);

  // ---- metal ladder to the hatch (climbed with hands/feet IK, see ladder.js)
  const ladder = new THREE.Group();
  ladder.name = 'ladder';
  const rail = steel(0x8c9296);
  const top = h + 0.3 + 1.0; // rails stick up 1 m above the bedroom floor for grabbing
  for (const sx of [-0.22, 0.22]) mesh(new THREE.BoxGeometry(0.05, top, 0.03), rail, sx, top / 2, 0, ladder);
  const rungs = [];
  for (let y = 0.28; y < h + 0.3; y += 0.28) {
    const r = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 12), rail, 0, y, 0, ladder);
    r.rotation.z = Math.PI / 2;
    rungs.push(y);
  }
  // on the south edge of the hatch: you climb facing south and step out onto the bedroom floor
  ladder.position.set(HATCH.x, 0, HATCH.z + HATCH.d / 2 - 0.04);
  ladder.userData.rungs = rungs;
  statics.add(ladder);

  // ---- terrarium (the main cage) on a heavy steel-and-wood table in the middle
  const table = new THREE.Group();
  const top_ = pbr('oak_wood_planks', { size: 1.5 });
  mesh(box(3.2, 0.08, 2.1), top_, 0, 0.86, 0, table);
  for (const [x, z] of [[-1.5, -0.95], [1.5, -0.95], [-1.5, 0.95], [1.5, 0.95]]) mesh(new THREE.BoxGeometry(0.08, 0.82, 0.08), steel(0x3a3d40), x, 0.41, z, table);
  mesh(new THREE.BoxGeometry(3.0, 0.05, 0.05), steel(0x3a3d40), 0, 0.2, -0.95, table);
  mesh(new THREE.BoxGeometry(3.0, 0.05, 0.05), steel(0x3a3d40), 0, 0.2, 0.95, table);
  table.position.set(0, 0, 0.3);
  statics.add(table);
  const terrarium = glassTank(3.0, 1.2, 1.9, { lid: false });
  terrarium.position.set(0, 0.9, 0.3);
  terrarium.name = 'terrarium';
  // soil bed (the tiny world's heightfield sits on it) + the tiny world itself
  mesh(box(2.96, 0.1, 1.86), pbr('forest_ground_04', { size: 0.6 }), 0, 0.058, 0, terrarium);
  const tiny = await buildTinyWorld(terrarium, { reflections: settings?.get('graphics.reflections') });
  statics.add(terrarium);
  const cageLight = new THREE.SpotLight(0xfff0d0, 25, 5, 0.55, 0.6, 2);
  cageLight.position.set(0, h - 0.1, 0.3);
  cageLight.target.position.set(0, 0.9, 0.3);
  cageLight.castShadow = true;
  cageLight.userData.keyShadow = true; // the one shadow kept on low: the tiny world needs it
  scene.add(cageLight, cageLight.target);

  // ---- bug farm: shelves of tanks with heat lamps (west wall)
  for (let i = 0; i < 2; i++) {
    const shelf = await place(props, 'steel_frame_shelves_01', { x: -6.45, z: -2.2 + i * 2.3, rotY: Math.PI / 2, height: 2.0 });
    shelf.name = 'bug-shelf';
    for (let level = 0; level < 3; level++) {
      const ly = [0.42, 0.98, 1.54][level];
      for (let k = 0; k < 2; k++) {
        const tank = glassTank(0.5, 0.32, 0.36, { lid: true });
        tank.position.set(-6.45, ly, -2.7 + i * 2.3 + k * 0.62);
        tank.name = 'bug-tank';
        props.add(tank);
        mesh(box(0.48, 0.05, 0.34), pbr(['farm_soil', 'dry_ground_rocks', 'pebble_ground_01'][(level + k) % 3], { size: 0.4 }), 0, 0.03, 0, tank);
      }
    }
    const heat = new THREE.PointLight(0xff8a3c, 1.2, 2.2, 2);
    heat.userData.minor = true;
    heat.position.set(-6.2, 1.9, -2.2 + i * 2.3);
    scene.add(heat);
  }

  // ---- gadget wall (north): pegboard + shelves
  const peg = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.8 });
  mesh(new THREE.BoxGeometry(3.4, 1.4, 0.03), peg, -1.5, 1.6, -d / 2 + 0.02, statics).name = 'gadget-wall';
  await place(props, 'steel_frame_shelves_02', { x: 1.4, z: -4.6, height: 2.0 });
  await place(props, 'metal_tool_chest', { x: -3.9, z: -4.55, height: 1.0 });
  await place(props, 'ammo_box', { x: 1.4, y: 1.02, z: -4.6, width: 0.4 });

  // ---- computer desk with camera screens (south wall)
  await place(props, 'metal_office_desk', { x: -2.5, z: 4.45, rotY: Math.PI, width: 1.6 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x050607, emissive: 0x1b3b4a, emissiveIntensity: 2.5, roughness: 0.3 });
  const monitors = [];
  for (let i = 0; i < 3; i++) {
    const mon = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.62, 0.38, 0.04), new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.5 }), 0, 0, 0, mon);
    const scr = mesh(new THREE.PlaneGeometry(0.58, 0.34), screenMat.clone(), 0, 0, -0.021, mon);
    scr.rotation.y = Math.PI;
    scr.name = 'camera-screen';
    monitors.push(scr);
    mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), steel(0x222222), 0, -0.26, 0.02, mon);
    mon.position.set(-3.1 + i * 0.64, 1.18, 4.62);
    mon.rotation.y = (1 - i) * 0.18;
    props.add(mon);
  }
  await place(props, 'desk_lamp_arm_01', { x: -1.75, y: 0.76, z: 4.5, height: 0.5 });
  await place(props, 'GreenChair_01', { x: -2.5, z: 3.7, rotY: Math.PI, height: 0.95 });

  // ---- workbench + chemistry (east side)
  await place(props, 'WoodenTable_01', { x: 5.9, z: 1.0, rotY: Math.PI / 2, width: 1.9 });
  await place(props, 'bench_vice_01', { x: 6.2, y: 0.78, z: 0.5, width: 0.3 });
  await place(props, 'Drill_01', { x: 5.9, y: 0.78, z: 1.3, width: 0.3 });
  await place(props, 'adjustable_wrench', { x: 5.7, y: 0.78, z: 1.6, width: 0.25 });
  await place(props, 'WoodenTable_01', { x: 5.9, z: 3.6, rotY: Math.PI / 2, width: 1.9 });
  await place(props, 'chemistry_set', { x: 5.95, y: 0.78, z: 3.4, width: 0.7 });
  await place(props, 'bunsen_burner', { x: 5.8, y: 0.78, z: 4.1, height: 0.18 });

  // ---- surgery table + lamp, clone tube, human zoo shelves
  const surgery = surgeryTable();
  surgery.position.set(3.2, 0, -2.4);
  surgery.name = 'surgery-table';
  props.add(surgery);
  const surgLight = new THREE.SpotLight(0xf4fbff, 30, 4, 0.45, 0.4, 2);
  surgLight.position.set(3.2, h - 0.35, -2.4);
  surgLight.target.position.set(3.2, 0.9, -2.4);
  surgLight.castShadow = true;
  scene.add(surgLight, surgLight.target);
  await place(props, 'hanging_industrial_lamp', { x: 3.2, y: h - 0.6, z: -2.4, height: 0.6 });

  const clone = cloneTube();
  clone.position.set(-5.8, 0, 3.9);
  clone.name = 'clone-machine';
  props.add(clone);

  const zoo = await place(props, 'steel_frame_shelves_02', { x: 3.4, z: 4.55, rotY: Math.PI, height: 2.0 });
  zoo.name = 'zoo-shelf';
  const jars = [];
  for (const y of [0.42, 0.98, 1.54]) {
    for (let k = 0; k < 4; k++) {
      const j = jar(0.07, 0.2);
      j.position.set(2.85 + k * 0.37, y, 4.55);
      j.name = 'specimen-jar';
      props.add(j);
      jars.push(j);
    }
  }

  // ---- clutter that makes it look lived-in
  await place(props, 'Barrel_01', { x: -6.4, z: -4.4, height: 0.9 });
  await place(props, 'cardboard_box_01', { x: -4.6, z: -4.4, width: 0.5 });
  await place(props, 'WetFloorSign_01', { x: 1.9, z: 2.4, rotY: 0.5, height: 0.6 });
  await place(props, 'metal_trash_can', { x: -0.3, z: 4.5, height: 0.6 });

  // ---- ceiling: pipes and hanging lamps (the lamps really light the room)
  for (const [x, z] of [[-4, -2], [-4, 2.5], [1.5, 3.2], [-1.5, -3.2]]) {
    await place(props, 'hanging_industrial_lamp', { x, y: h - 0.6, z, height: 0.6 });
    const l = new THREE.PointLight(0xffd9a8, 9, 9, 2);
    l.position.set(x, h - 0.65, z);
    l.castShadow = x === -4 && z === -2; // one shadowed lamp is enough for depth; the spots do the rest
    l.shadow.bias = -0.0005;
    scene.add(l);
  }
  // pipes along the ceiling: as long as the wall, but kept under the ceiling (they used to poke up into the yard)
  const pipes = await place(props, 'modular_industrial_pipes_01', { x: -1, y: h - 0.35, z: -4.4, width: 6 });
  {
    const bb = new THREE.Box3().setFromObject(pipes);
    const tall = bb.max.y - bb.min.y;
    if (tall > 0.32) { pipes.scale.y *= 0.32 / tall; pipes.updateMatrixWorld(true); pipes.position.y += (h - 0.36) - new THREE.Box3().setFromObject(pipes).min.y; }
  }
  scene.add(new THREE.HemisphereLight(0x9fb3c8, 0x3a3228, 0.12)); // most fill light now comes from the reflection probe

  // what belongs where, so each part can be hidden when you can't see it (big speed win)
  const labObjs = [...statics.children, ...props.children];
  await buildBedroom({ statics, props, scene, hatch: HATCH });
  const house = await buildLivingRoom({ statics, props, scene });
  const houseObjs = [...statics.children, ...props.children].filter((o) => !labObjs.includes(o));
  const { spots: townSpots, lamps, litWindows, outdoor } = await buildTown({ statics, props, scene });
  const townObjs = [...statics.children, ...props.children].filter((o) => !labObjs.includes(o) && !houseObjs.includes(o));

  scene.add(statics, props);
  physics.addStaticMesh(statics);
  // props: exact mesh colliders too (static); ones you can knock over get dynamic bodies later
  physics.addStaticMesh(props, { filter: (o) => !o.userData.noCollide });

  return {
    spawn: new THREE.Vector3(2.5, 0, 2.0),
    home: new THREE.Vector3(3.6, 3.3, -1.6), // your bedroom (where the police drop you off)
    respawn: new THREE.Vector3(0.6, 0, 2.2), // where you wake up after dying in the tiny world
    defaultVisitors: 3, // people walking around the lab (until the town exists)
    // outside: real sun and sky; the basement has none (see main.js)
    sunDirection: new THREE.Vector3(-0.45, -0.8, -0.4).normalize(),
    sunIntensity: 3,
    sky: 'quadrangle_sunny',
    inLab,
    outdoor: {
      lamps, litWindows, materials: outdoor, ground: 3.28,
      // bedroom window (east wall): where sunlight can come in
      window: { center: new THREE.Vector3(BEDROOM.x1 + 0.075, BEDROOM.floorY + 1.5, -2.6), normal: new THREE.Vector3(1, 0, 0), side: new THREE.Vector3(0, 0, 1), w: 1.4, h: 1.2 },
    },
    // people living in town: they walk the sidewalks, look in shop windows, wait at doors
    town: { people: 8, spots: townSpots, area: (p) => p.y > 3.2 && p.y < 3.6 && Math.abs(p.x) < 44 && p.z > 2 && p.z < 19 },
    zones: { lab: labObjs, house: houseObjs, town: townObjs, inHouse },
    house: { spots: house.spots, lamps: house.lamps, inHouse },
    fog: { color: 0xc4d0dc, near: 80, far: 260 },
    navRoots: [statics, props],
    probe: new THREE.Vector3(0, 1.6, 0.3),   // reflection snapshot from above the terrarium
    probeIntensity: 0.6,
    // test visitors stay on the lab floor (the lab's roof is walkable until the house sits on it)
    wanderArea: (p) => p.y < 1,
    ladder,
    ladderTopFloorY: BEDROOM.floorY,
    hatch: HATCH,
    terrarium,
    tiny,
    monitors,
    jars,
    update() { tiny.world.userData.tick?.(); },
  };
}
