// The rest of the house (your bedroom is built in bedroom.js). Real US two-story + basement:
// UPSTAIRS (floor y=0):  hallway with the stairs, bathroom, parents' room (+ walk-in closet), office
// GROUND   (floor y=-3): front hall + front door, living room, dining room, kitchen, den, garage
// BASEMENT (floor y=-5.6): unfinished - laundry, water heater, furnace, storage, the mystery box
// Coordinates: x west(-) / east(+), z north(-) / south(+); the front of the house faces south.
import * as THREE from 'three';
import { Thing, panel, lathe } from './thing.js';
import { colorMat, defMat, drawTexture } from '../core/materials.js';
import { windowFrame } from './bedroom.js';
import { sfx } from '../core/audio.js';

export const FLOORS = { up: 0, ground: -3.0, base: -5.6 };
export const HOUSE = { x0: -8.4, x1: 2.12, z0: -4.6, z1: 1.92, gx1: 8.5 };
const W = 0.12;

// ---------- hinged doors (any wall) ----------
export function makeDoor(game, { name = 'Door', hinge, along, width = 0.82, height = 2.02, swing = 1, locked = null, mat = 'doorWood' }) {
  // along: unit vector [x, z] the closed leaf runs along from the hinge
  const d = new Thing({ name, type: 'kinematic', pos: hinge, surface: 'paint' });
  const [ax, az] = along;
  const ang = Math.atan2(ax, az); // leaf built along +z, rotated to `along`
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
  const at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyQuaternion(q).toArray();
  const qa = [q.x, q.y, q.z, q.w];
  d.box([0.04, height, width - 0.02], at(0, 0.012 + height / 2, width / 2), mat, { rot: qa });
  d.cyl(0.028, 0.06, at(0.05, 1.0, width - 0.08), 'chrome', { rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, Math.PI / 2)).toArray() });
  d.cyl(0.028, 0.06, at(-0.05, 1.0, width - 0.08), 'chrome', { rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, Math.PI / 2)).toArray() });
  d.build(game.engine.scene);
  d.open = 0; d.target = 0;
  d.behaviors.push({
    update(t, dt) {
      t.open += (t.target - t.open) * Math.min(1, dt * 4);
      const qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.open * 1.6 * swing);
      t.body.setNextKinematicRotation({ x: qq.x, y: qq.y, z: qq.z, w: qq.w });
    },
  });
  const knob = new THREE.Vector3(...at(0, 1.0, width - 0.08)).add(new THREE.Vector3(...hinge));
  game.interactables.push({
    name: () => (locked ? `${name} (locked)` : d.target ? `Close ${name.toLowerCase()}` : `Open ${name.toLowerCase()}`), thing: d, pos: knob, radius: 0.35,
    use: () => { if (locked) { game.ui.toast(locked, 3); sfx.thud(0.2, 2); return; } d.target = d.target ? 0 : 1; sfx.thud(0.3, 2); },
  });
  return d;
}

// ---------- the structure ----------
export function buildHouse(game) {
  const scene = game.engine.scene;
  const { x0, x1, z0, z1, gx1 } = HOUSE;
  const G = FLOORS.ground, B = FLOORS.base;
  const s = new Thing({ name: 'house', surface: 'paint', tags: ['noShrink'] });
  const wall = (axis, at, from, to, y0, y1, holes = [], m = 'wall', th = W) => panel(s, { axis, at, rect: [from, y0, to, y1], holes, thick: th, m });

  // ===== floor slabs =====
  // upstairs floor (bedroom has its own) with the stairwell opening
  panel(s, { axis: 'y', at: -0.15, rect: [x0, z0, x1, z1], thick: 0.3, m: 'carpet', holes: [[-3.94, -3.58, -2.94, -0.08], [-2.12, -1.92, 2.12, 1.92]] });
  // painted ceiling under the upstairs floor (what you see from the living room)
  panel(s, { axis: 'y', at: -0.306, rect: [x0, z0, x1, z1], thick: 0.008, m: 'ceiling', holes: [[-3.94, -3.58, -2.94, -0.08]], o: { collide: false } });
  // attic floor = upstairs ceiling
  panel(s, { axis: 'y', at: 2.6, rect: [x0, z0, x1, z1], thick: 0.2, m: 'ceiling', holes: [[-2.12, -1.92, 2.12, 1.92]] });
  // ground floor (wood planks) with the basement stair opening
  panel(s, { axis: 'y', at: G - 0.15, rect: [x0, z0, x1, z1], thick: 0.3, m: 'floorWood', holes: [[-7.3, -0.9, -4.1, 0.1]] });
  // basement: concrete slab
  s.box([x1 - x0, 0.2, z1 - z0], [(x0 + x1) / 2, B - 0.1, (z0 + z1) / 2], 'concrete');
  // garage slab (a bit lower, concrete)
  s.box([gx1 - x1, 0.3, z1 - z0], [(x1 + gx1) / 2, G - 0.3, (z0 + z1) / 2], 'concrete');
  s.box([gx1 - x1, 0.15, z1 - z0], [(x1 + gx1) / 2, 0.35, (z0 + z1) / 2], 'ceiling'); // garage ceiling

  // ===== exterior walls (basement -> attic) =====
  const yb = B - 0.2, yt = 2.7;
  // north wall: windows for kitchen, parents' room, office (+ a basement window well)
  wall('z', z0 + W / 2, x0, x1, yb, yt, [[-7.0, G + 1.0, -5.4, G + 2.1], [-7.2, 0.9, -5.6, 2.1], [-0.6, 0.9, 0.6, 2.1], [-3.0, B + 1.7, -2.2, B + 2.15]]);
  // south wall (west of the bedroom): front door, living room window, hallway + bathroom windows
  wall('z', z1 - W / 2, x0, -2.0 - W, yb, yt, [[-3.5, G, -2.62, G + 2.05], [-5.4, 1.45, -4.7, 2.05], [-3.6, 0.9, -2.5, 2.1], [-7.3, G + 1.0, -5.6, G + 2.1]]);
  wall('z', z1 - W / 2, -2.0 - W, x1, yb, -0.2, [[-1.6, G + 0.85, 1.0, G + 2.15]]); // under the bedroom: living room window
  // west wall: parents' + den windows
  wall('x', x0 + W / 2, z0, z1, yb, yt, [[-3.0, 0.9, -1.8, 2.1], [-0.4, G + 1.0, 0.8, G + 2.1]]);
  // east wall (shared with the garage downstairs): office window up, door to the garage down
  wall('x', x1 - W / 2, z0, -1.8 - 0.12, yb, yt, [[-3.6, 0.9, -2.6, 2.1], [-3.0, G, -2.2, G + 2.05]]);
  wall('x', x1 - W / 2, -1.92, z1, yb, -0.2, []);
  // garage walls (one story) with the big roll-up door on the south side
  wall('z', z0 + W / 2, x1, gx1, G - 0.15, 0.5, [[4.5, G + 1.0, 6.0, G + 1.8]]);
  wall('z', z1 - W / 2, x1, gx1, G - 0.15, 0.5, [[3.0, G - 0.15, 7.6, G + 2.1]]);
  wall('x', gx1 - W / 2, z0, z1, G - 0.15, 0.5, []);
  const garageDoor = new Thing({ name: 'garage door', surface: 'metal' });
  for (let i = 0; i < 4; i++) garageDoor.box([4.6, 0.55, 0.04], [5.3, G - 0.15 + 0.29 + i * 0.56, z1 - 0.06], colorMat(0xe8e6e0, 0.5, 0.2));
  garageDoor.build(scene);

  // ===== upstairs interior walls =====
  wall('x', -2.06, z0, -1.8, 0, 2.6, [[-3.4, 0, -2.6, 2.05]]);                      // office west wall (door)
  wall('x', -4.0, z0, z1 - W, 0, 2.6, [[-4.4, 0, -3.66, 2.05], [0.7, 0, 1.5, 2.05]]);  // hallway west wall (parents' + bathroom doors)
  wall('z', 0.24, x0 + W, -4.06, 0, 2.6, [[-7.5, 0, -6.8, 2.05]]);                  // parents' room south wall (closet door)
  wall('x', -6.1, 0.3, z1 - W, 0, 2.6, []);                                          // bathroom / closet
  // stair railing upstairs (you can see down the stairwell)
  for (let z = -3.55; z <= -0.1; z += 0.12) s.box([0.03, 0.9, 0.03], [-2.94, 0.45, z], 'trim');
  s.box([0.06, 0.05, 3.5], [-2.94, 0.92, -1.83], 'deskWood');

  // ===== stairs (13 steps, upstairs landing at the north end -> front hall at the south) =====
  const rise = 3.0 / 13, run = 3.5 / 13;
  for (let i = 1; i <= 13; i++) { // open treads + risers (there's a closet under the stairs)
    const top = -i * rise, zz = -3.58 + (i - 0.5) * run;
    s.box([1.0, 0.04, run + 0.02], [-3.44, top - 0.02, zz + 0.005], 'deskWood');
    s.box([1.0, rise, 0.02], [-3.44, top + rise / 2, zz - run / 2 + 0.01], 'trim');
  }
  // stringers (the sloped boards the steps sit on)
  for (const x of [-3.93, -2.95]) s.box([0.04, 0.3, 3.62], [x, -1.6, -1.83], 'deskWood', { rot: [-Math.atan2(3.0, 3.5), 0, 0] });
  s.box([0.05, 0.05, 3.6], [-2.96, -1.4, -1.83], 'deskWood', { rot: [-0.7, 0, 0] }); // handrail

  // ===== ground floor interior walls =====
  wall('x', -4.0, z0, -0.98, G, -0.3, [[-4.4, G, -3.7, G + 2.05]]);              // kitchen | stairs (passage under the landing)
  wall('z', -1.04, x0 + W, -4.06, G, -0.3, [[-6.4, G, -4.9, G + 2.1]]);           // kitchen | den (wide opening)
  wall('x', -2.94, -3.58, -0.08, G, -0.3, [[-1.2, G, -0.5, G + 1.9]]);            // under-stairs closet door
  wall('z', -1.04, -2.94, x1 - W, G, -0.3, [[-1.6, G, 0.6, G + 2.2]]);            // dining | living (wide opening)

  // ===== basement: posts + beams (unfinished, you see the floor joists) =====
  for (const x of [-6, -3, 0]) s.box([0.1, G - 0.3 - B, 0.1], [x, (B + G - 0.3) / 2, -1.3], 'steel');
  for (let x = x0 + 0.2; x < x1; x += 0.41) s.box([0.045, 0.24, z1 - z0 - 0.3], [x, G - 0.42, (z0 + z1) / 2], 'lightWood', { shadow: false });
  // basement stairs (from the den down, heading west)
  const brise = 2.6 / 11, brun = 3.0 / 11;
  for (let i = 1; i <= 11; i++) {
    const top = G - i * brise, xx = -4.2 - (i - 0.5) * brun;
    s.box([brun, 0.04, 0.95], [xx, top - 0.02, -0.4], 'lightWood');
    s.box([brun, 0.6, 0.04], [xx, top - 0.3, -0.89], 'lightWood', { collide: false });
  }
  s.box([3.1, 0.05, 0.05], [-5.7, G - 1.2, 0.05], 'lightWood', { rot: [0, 0, -0.71] }); // rail
  for (let x = -7.25; x <= -4.15; x += 0.12) s.box([0.03, 0.9, 0.03], [x, G + 0.45, 0.12], 'trim'); // guard around the opening
  s.box([3.2, 0.05, 0.06], [-5.7, G + 0.92, 0.12], 'deskWood');

  // ===== windows (frames + real glass) =====
  const win = (axis, at, a0, a1, y0, y1) => windowFrame(s, axis, at, a0, a1, y0, y1);
  win('z', z0 + W, -7.0, -5.4, G + 1.0, G + 2.1); win('z', z0 + W, -7.2, -5.6, 0.9, 2.1); win('z', z0 + W, -0.6, 0.6, 0.9, 2.1);
  win('z', z1, -5.4, -4.7, 1.45, 2.05); win('z', z1, -3.6, -2.5, 0.9, 2.1); win('z', z1, -7.3, -5.6, G + 1.0, G + 2.1); win('z', z1, -1.6, 1.0, G + 0.85, G + 2.15);
  win('x', x0 + W, -3.0, -1.8, 0.9, 2.1); win('x', x0 + W, -0.4, 0.8, G + 1.0, G + 2.1); win('x', x1, -3.6, -2.6, 0.9, 2.1);

  // ===== floor finishes (thin layers on top of the slabs) =====
  s.box([1.92, 0.006, 1.38], [-5.08, 0.003, 1.05], defMat('tile', () => tileMat()), { friction: 0.5 });           // bathroom tile
  s.box([3.9, 0.006, 2.5], [-0.0, 0.003, -3.2], 'floorWood');                                                         // office
  s.box([4.1, 0.006, 3.4], [-6.17, G + 0.003, -2.78], defMat('tile'), { friction: 0.5 });                             // kitchen tile
  s.box([3.6, 0.01, 2.4], [-0.6, G + 0.005, 0.5], 'rug');                                                              // living room rug
  // baseboards would go here; trim on the stair stringer
  s.build(scene);
  s.material = 'paint';
  game.house = s;

  // ===== doors =====
  makeDoor(game, { name: 'Office door', hinge: [-2.08, 0, -3.38], along: [0, 1], swing: -1 });
  makeDoor(game, { name: "Parents' door", hinge: [-3.98, 0, -4.38], along: [0, 1], swing: 1 });
  makeDoor(game, { name: 'Bathroom door', hinge: [-3.98, 0, 0.72], along: [0, 1], swing: 1 });
  makeDoor(game, { name: 'Closet door', hinge: [-7.48, 0, 0.26], along: [1, 0], swing: -1, width: 0.7 });
  makeDoor(game, { name: 'Closet door', hinge: [-2.92, G, -1.18], along: [0, 1], swing: 1, width: 0.7, height: 1.88 });
  makeDoor(game, { name: 'Garage door', hinge: [2.08, G, -2.98], along: [0, 1], swing: -1, width: 0.78 });
  makeDoor(game, { name: 'Front door', hinge: [-3.48, G, z1 - 0.02], along: [1, 0], swing: -1, width: 0.86, locked: '🔒 Locked. Mom has the key. (The outside world comes in a later update - or grow through the roof!)', mat: colorMat(0x2b4a6f, 0.5) });

  // ===== lights (ceiling lights per room, switches by the doors) =====
  const lights = [];
  const addLight = (name, x, y, z, sw) => {
    const spot = game.lightPool.add({ kind: 'spot', pos: new THREE.Vector3(x, y - 0.09, z), distance: 9 });
    const fill = game.lightPool.add({ kind: 'point', pos: new THREE.Vector3(x, y - 0.3, z), distance: 7 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d8, emissiveIntensity: 0, roughness: 0.3 }));
    dome.rotation.x = Math.PI; dome.position.set(x, y, z); scene.add(dome);
    const L = { name, on: false, set(on) { L.on = on; spot.intensity = on ? 20 : 0; fill.intensity = on ? 4 : 0; dome.material.emissiveIntensity = on ? 2.2 : 0; } };
    lights.push(L);
    if (sw) game.interactables.push({ name: () => `${name} light ${L.on ? 'off' : 'on'}`, pos: new THREE.Vector3(...sw), radius: 0.12, use: () => { L.set(!L.on); sfx.click(0.5); } });
    return L;
  };
  addLight('Hallway', -2.6, 2.6, -1.0, [-2.2, 1.2, -1.75]);
  addLight('Bathroom', -5.05, 2.6, 1.05, [-4.08, 1.2, 0.6]);
  addLight("Parents' room", -6.2, 2.6, -2.1, [-4.08, 1.2, -3.55]);
  addLight('Office', 0, 2.6, -3.2, [-1.98, 1.2, -2.5]);
  addLight('Living room', -0.5, -0.3, 0.4, [-2.0, G + 1.2, 1.7]);
  addLight('Dining room', -0.5, -0.3, -2.8, [-2.86, G + 1.2, -2.0]);
  addLight('Kitchen', -6.2, -0.3, -2.8, [-4.08, G + 1.2, -3.0]);
  addLight('Den', -6.2, -0.3, 0.4, [-4.2, G + 1.2, 1.6]);
  addLight('Front hall', -3.4, -0.3, 0.9, [-2.7, G + 1.2, 1.7]);
  addLight('Garage', 5.3, 0.27, -1.3, [2.25, G + 1.2, -3.1]);
  addLight('Basement', -3, G - 0.3, -1.3, [-4.3, G - 1.0, -0.95]);
  game.houseLights = lights;
  return s;
}

function tileMat() {
  const t = drawTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#e9e6df'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b9b4a8'; c.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); c.beginPath(); c.moveTo(0, i * h / 4); c.lineTo(w, i * h / 4); c.stroke(); }
  }, 'tileTex');
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 1.2, 1 / 1.2);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.25 });
}
void lathe;
