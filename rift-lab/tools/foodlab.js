// Dev tool: checks one grocery aisle file. Validates every item against FOOD_CONTRACT.md,
// drop-tests it in real physics, renders store photos + a real-scale lineup.
// Results land in window.__foodlab (read by the headless runner).

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initPhysics, Physics } from '../src/core/physics.js';
import { registerItems, getItem, buildSpec } from '../src/items/catalog.js';
import { buildVisual, specBounds } from '../src/items/builder.js';
import { ItemManager } from '../src/items/manager.js';
import { productPhoto } from '../src/items/photo.js';

const out = { errors: [], items: [], photos: {}, lineup: null, done: false };
window.__foodlab = out;
window.addEventListener('error', (e) => out.errors.push(String(e.message)));

const AISLES = ['produce', 'drinks', 'bakery', 'snacks', 'fridge', 'frozen', 'pantry'];
const OPEN = [null, 'cap', 'tab', 'tear', 'peel', 'lid', 'wrapper', 'carton', 'twist', 'knife'];
const BITE = ['dent', 'hide', 'level', 'none'];
const SOUND = ['crunch', 'chew', 'soft', 'slurp', 'gulp', 'fizz', 'crisp'];

function validate(def, all) {
  const p = [];
  const need = (cond, msg) => { if (!cond) p.push(msg); };
  need(typeof def.id === 'string' && def.id.startsWith(def.aisle + '-'), 'id must start with aisle + "-"');
  need(AISLES.includes(def.aisle), 'bad aisle');
  for (const k of ['name', 'brand', 'blurb']) need(typeof def[k] === 'string' && def[k].length > 1, `missing ${k}`);
  need(def.price > 0, 'price must be > 0');
  need(def.mass > 0, 'mass must be > 0');
  need(def.rating >= 1 && def.rating <= 5, 'rating 1..5');
  need(Number.isFinite(def.reviews), 'reviews');
  need(Array.isArray(def.quotes) && def.quotes.length >= 1, 'quotes');
  const f = def.food;
  need(!!f, 'missing food block');
  if (!f) return p;
  need(['food', 'drink'].includes(f.kind), 'food.kind');
  need(f.eat && f.eat.kcal >= 0 && f.eat.waterL >= 0, 'food.eat.kcal + waterL');
  need(f.bites >= 1, 'food.bites >= 1');
  need(BITE.includes(f.bite), 'food.bite');
  need(OPEN.includes(f.open ?? null), 'food.open');
  need(['room', 'fridge', 'freezer'].includes(f.keep), 'food.keep');
  need(f.shelf && f.shelf[f.keep] > 0, 'food.shelf[keep] > 0');
  need(SOUND.includes(f.sound), 'food.sound');
  need(['keep', 'remove'].includes(f.leftover), 'food.leftover');
  need(Array.isArray(f.taste) && f.taste.length >= 1, 'food.taste');
  if (f.units) need(!!f.unitId && (all.some((d) => d.id === f.unitId) || !!getItem(f.unitId)), `unitId ${f.unitId} not found (define it in this aisle)`);
  if (f.kind === 'drink') need(f.bite === 'level' || f.bite === 'none', 'drinks use bite level (or none)');
  let spec;
  try { spec = buildSpec(def, {}); } catch (e) { p.push('build() threw: ' + e.message); return p; }
  need(Math.abs((spec.mass || 0) - def.mass) < 1e-6, `build().mass ${spec.mass} != item mass ${def.mass}`);
  const parts = spec.parts;
  if (!f.units) {
    const eat = parts.filter((x) => x.eat), liq = parts.filter((x) => x.liquid);
    if (f.bite === 'dent' || f.bite === 'hide') need(eat.length > 0, 'no eat parts');
    if (f.bite === 'hide') need(eat.every((x) => Number.isInteger(x.eat) && x.eat >= 1), 'hide: eat parts need eat: 1..n');
    if (f.bite === 'level') need(liq.length > 0, 'level: no liquid parts');
  } else {
    const slots = new Set(parts.filter((x) => Number.isInteger(x.unit)).map((x) => x.unit));
    need(slots.size === f.units, `units ${f.units} but ${slots.size} different unit: i numbers on parts`);
    for (const u of slots) need(parts.some((x) => x.unit === u && x.col !== false), `unit ${u} has no collision shape of its own`);
  }
  if (f.open && f.open !== 'knife') need(parts.some((x) => x.closed || x.opened), `open '${f.open}' but no closed/opened parts (what changes when it opens?)`);
  if (f.leftover === 'keep' && !f.units) need(parts.some((x) => x.leftover || x.pack), 'leftover keep but no leftover/pack parts');
  need(parts.some((x) => x.col !== false), 'no collision shapes');
  const b = specBounds(spec), s = new THREE.Vector3(); b.getSize(s);
  const vol = s.x * s.y * s.z;
  const dens = def.mass / Math.max(1e-9, vol);
  need(dens > 30 && dens < 1500, `density ${dens.toFixed(0)} kg/m3 from bounds ${s.toArray().map((v) => v.toFixed(3)).join(' x ')}`);
  need(Math.abs(b.min.y) < 0.004, `bottom should be at y=0 (is ${b.min.y.toFixed(4)})`);
  // materials resolve (missing ones come out magenta)
  const { groups } = buildVisual(spec);
  for (const g of Object.values(groups)) g.traverse((o) => { if (o.isMesh && o.material.color?.getHex() === 0xff00ff) p.push(`material '${o.userData.part?.mat}' not found`); });
  return p;
}

async function run() {
  const aisle = new URLSearchParams(location.search).get('aisle');
  let list;
  try { list = (await import(`../src/items/food/${aisle}.js?v=${Date.now()}`)).default; } catch (e) { out.errors.push('import failed: ' + e.message + '\n' + e.stack); out.done = true; return; }
  registerItems(list.map((d) => ({ tab: 'food', ...d })));
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1600, 900);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  document.body.append(renderer.domElement);

  // physics drop test: each item dropped 5 cm onto a flat floor, 4 s
  const RAPIER = await initPhysics();
  const physics = new Physics(RAPIER);
  physics.world.createCollider(RAPIER.ColliderDesc.cuboid(100, 0.5, 100).setTranslation(0, -0.5, 0).setFriction(0.8));
  const scene = new THREE.Scene();
  const items = new ItemManager({ physics, scene });

  let x = 0;
  for (const def of list) {
    const rec = { id: def.id, problems: [] };
    try { rec.problems = validate(def, list); } catch (e) { rec.problems.push('validate threw: ' + e.message); }
    try {
      const spec = buildSpec(getItem(def.id), {});
      const b = specBounds(spec), s = new THREE.Vector3(); b.getSize(s);
      rec.size_cm = s.toArray().map((v) => +(v * 100).toFixed(1));
      const it = items.spawn(def.id, {}, { position: new THREE.Vector3(x, 0.05, 0), quaternion: new THREE.Quaternion() });
      rec.physMass = +it.mass.toFixed(3);
      rec._it = it; rec._x = x;
      x += Math.max(0.3, s.x + 0.3);
    } catch (e) { rec.problems.push('spawn threw: ' + e.message); }
    out.items.push(rec);
  }
  for (let i = 0; i < 240; i++) physics.update(1 / 60);
  for (const rec of out.items) {
    const it = rec._it;
    delete rec._it;
    if (!it) continue;
    const t = it.bodies.main.translation(), r = it.bodies.main.rotation(), v = it.bodies.main.linvel();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
    rec.drop = { moved_cm: +(Math.hypot(t.x - rec._x, t.z) * 100).toFixed(1), y_cm: +(t.y * 100).toFixed(1), tilt_deg: +(Math.acos(Math.min(1, up.y)) * 57.3).toFixed(1), speed: +Math.hypot(v.x, v.y, v.z).toFixed(3) };
    if (rec.drop.speed > 0.05) rec.problems.push(`still moving after 4 s (${rec.drop.speed} m/s): unstable or rolling`);
    if (rec.drop.y_cm < -1) rec.problems.push('sank into the floor');
    if (rec.drop.tilt_deg > 20 && !list.find((d) => d.id === rec.id).food?.mayTip) rec.problems.push(`tipped over ${rec.drop.tilt_deg} deg when set down`);
    delete rec._x;
  }

  // store photos
  for (const def of list) {
    try { out.photos[def.id] = productPhoto(renderer, def.id, {}); } catch (e) { out.errors.push(`photo ${def.id}: ${e.message}`); }
  }

  // lineup: everything side by side at real scale on a wood counter, with a 30 cm ruler
  const ls = new THREE.Scene();
  ls.background = new THREE.Color(0xeeece8);
  const pm = new THREE.PMREMGenerator(renderer);
  ls.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(2, 5, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  ls.add(sun, new THREE.HemisphereLight(0xffffff, 0xcfc8bd, 0.6));
  const counter = new THREE.Mesh(new THREE.BoxGeometry(60, 0.04, 2), new THREE.MeshStandardMaterial({ color: 0xc8b49a, roughness: 0.6 }));
  counter.position.y = -0.02; counter.receiveShadow = true; ls.add(counter);
  let lx = 0;
  for (const def of list) {
    const spec = buildSpec(getItem(def.id), {});
    const b = specBounds(spec), s = new THREE.Vector3(); b.getSize(s);
    const g = new THREE.Group();
    for (const gg of Object.values(buildVisual(spec).groups)) g.add(gg);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.position.x = lx + s.x / 2 - (b.min.x + b.max.x) / 2;
    ls.add(g);
    lx += s.x + 0.04;
  }
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.004, 0.03), new THREE.MeshStandardMaterial({ color: 0xf2d24b }));
  ruler.position.set(-0.2, 0.002, 0.2); ls.add(ruler);
  const left = -0.4, width = lx - left;
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 100);
  const cx = left + width / 2;
  const hfov = Math.atan(Math.tan(15 * Math.PI / 180) * 16 / 9);
  const dist = Math.max(0.6, (width / 2) / Math.tan(hfov) * 1.3);
  cam.position.set(cx, dist * 0.42, dist);
  cam.lookAt(cx, 0.08, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setRenderTarget(null);
  renderer.render(ls, cam);
  out.lineup = renderer.domElement.toDataURL('image/png');
  out.done = true;
}

run().catch((e) => { out.errors.push(String(e.stack || e)); out.done = true; });
