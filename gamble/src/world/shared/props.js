// Street furniture shared by every outdoor builder (downtown, motel strip, other cities).
//
// Each prop is assembled once from small parts (lathe/cylinder/box geometry + library materials)
// and stamped into a StaticBatch at each placement, so a hundred hydrants still cost one draw
// call per chunk. Every solid prop adds an exact collider (cylinders for round things, boxes for
// boxy things) — if you can see it, you bump into it.
//
//   const P = new Props(ctx)            ctx = { batch, colliders, lights: [], rng }
//   P.downtownLamp(x, z, ry)  P.cobraLight(x, z, ry, {arm, sodium})  P.signalMast(...)
//   P.streetBlade(x, z, ry, name, block)  P.hydrant  P.newsboxes  P.meter  P.trashCan  P.bench
//   P.busShelter  P.powerPole / P.wires  P.chainFence  P.cabinet  P.bollard  P.litter(...)
//
// Night lights: lamps push {pos, color, intensity, distance, height, kind} into ctx.lights; the
// world's light manager turns the nearest few into real lights and the rest into glow sprites /
// wet-street reflections.
// Traffic signals cycle through SIGNAL uniforms (signalUpdate(realTime)).

import * as THREE from 'three';
import { mat } from '../../gfx/materials.js';
import { SIGNS, paintedSignMat, fitText } from './signs.js';
import { chainLinkMat } from './kinds.js';
import { Rng } from '../../core/rng.js';

const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();

// ---- Shared materials ---------------------------------------------------------------------

let MM = null;
export function propMats() {
  if (MM) return MM;
  MM = {
    iron: mat('metal-painted', { color: 0x1b1d1c, wear: 0.35, dirt: 0.45, seed: 41 }),
    green: mat('metal-painted', { color: 0x1f3a2c, wear: 0.4, dirt: 0.4, seed: 42 }),
    galv: mat('aluminum', { color: 0xa9adb0, wear: 0.5, dirt: 0.55, seed: 43 }),
    steel: mat('steel', { wear: 0.5, dirt: 0.4, seed: 44 }),
    yellow: mat('metal-painted', { color: 0xd9a417, wear: 0.6, dirt: 0.5, seed: 45 }),
    signalYellow: mat('metal-painted', { color: 0xc99a1a, wear: 0.4, dirt: 0.5, seed: 46 }),
    black: mat('metal-painted', { color: 0x141414, wear: 0.3, dirt: 0.3, seed: 47 }),
    white: mat('metal-painted', { color: 0xe9e6df, wear: 0.4, dirt: 0.5, seed: 48 }),
    grey: mat('metal-painted', { color: 0x8a8d8a, wear: 0.45, dirt: 0.5, seed: 49 }),
    concrete: mat('concrete', { seed: 51, dirt: 0.55 }),
    wood: mat('wood', { color: 0x6b4a2e, wear: 0.6, dirt: 0.4, varnish: 0.2, seed: 52 }),
    pole: mat('wood-pole'),
    rubber: mat('rubber', { color: 0x161616 }),
    plastic: mat('plastic', { color: 0xffffff, wear: 0.4, dirt: 0.5, seed: 53 }),
    // Cheap reflective glass (no transmission pass): specular reflections from the env map.
    glass: Object.assign(new THREE.MeshStandardMaterial({ color: 0xcfe0e4, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }), { name: 'glass-cheap' }),
    darkGlass: Object.assign(new THREE.MeshStandardMaterial({ color: 0x0b0e10, roughness: 0.05, metalness: 0.1, envMapIntensity: 1.4 }), { name: 'glass-dark' }),
    dirt: mat('dirt', { seed: 54 }),
    paper: mat('paper', { color: 0xe8e1cf, dirt: 0.45 }),
    cardboard: mat('cardboard'),
  };
  MM.lampWarm = glowMat(0xffd7a0, 5.5, 0.04);
  MM.lampLED = glowMat(0xf2f4ff, 6, 0.04);
  MM.lampSodium = glowMat(0xffa24a, 6, 0.03);
  MM.lampDead = glowMat(0x6f5a40, 0.0, 0.0);
  MM.cable = mat('rubber', { color: 0x0f0f0f });
  return MM;
}

const glowCache = new Map();
/** Lamp lens / globe: frosted glass by day, glowing at night (SIGNS.uNight). */
export function glowMat(color, k, dayK = 0) {
  const key = `${color}|${k}|${dayK}`;
  if (glowCache.has(key)) return glowCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: 0xeeeae2, roughness: 0.35, metalness: 0, emissive: color, emissiveIntensity: 1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = SIGNS.uNight;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= mix(${dayK.toFixed(3)}, ${k.toFixed(3)}, uNight);`);
  };
  m.customProgramCacheKey = () => `glow-${k}-${dayK}`;
  m.name = `glow-${color.toString(16)}`;
  glowCache.set(key, m);
  return m;
}

// ---- Traffic signal state -------------------------------------------------------------------

// x: (red, yellow, green) for traffic along Virginia (N–S); y: cross streets (E–W).
// walk: (walk, hand) per axis — pedestrians crossing *parallel* to the traffic that has green.
export const SIGNAL = {
  ns: { value: new THREE.Vector3(0, 0, 1) },
  ew: { value: new THREE.Vector3(1, 0, 0) },
  pedNS: { value: new THREE.Vector2(1, 0) },
  pedEW: { value: new THREE.Vector2(0, 1) },
  phase: 'ns-green',
};

const CYCLE = [
  ['ns-green', 26], ['ns-yellow', 4], ['all-red-1', 2], ['ew-green', 20], ['ew-yellow', 4], ['all-red-2', 2],
];
const CYCLE_LEN = CYCLE.reduce((s, c) => s + c[1], 0);

export function signalUpdate(t) {
  let u = ((t % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
  let phase = CYCLE[0][0];
  let into = 0;
  let len = 1;
  for (const [p, d] of CYCLE) {
    if (u < d) {
      phase = p;
      into = u;
      len = d;
      break;
    }
    u -= d;
  }
  SIGNAL.phase = phase;
  const set = (v, r, y, g) => v.value.set(r, y, g);
  set(SIGNAL.ns, 1, 0, 0);
  set(SIGNAL.ew, 1, 0, 0);
  if (phase === 'ns-green') set(SIGNAL.ns, 0, 0, 1);
  if (phase === 'ns-yellow') set(SIGNAL.ns, 0, 1, 0);
  if (phase === 'ew-green') set(SIGNAL.ew, 0, 0, 1);
  if (phase === 'ew-yellow') set(SIGNAL.ew, 0, 1, 0);
  // Pedestrian heads: WALK for the first 40% of green, flashing hand for the rest, then solid.
  const ped = (green, axisPhase) => {
    if (phase !== axisPhase) return [0, 1];
    if (into < len * 0.4) return [1, 0];
    return [0, Math.floor(t * 2) % 2 === 0 ? 1 : 0.08];
  };
  const a = ped(true, 'ns-green');
  const b = ped(true, 'ew-green');
  SIGNAL.pedNS.value.set(a[0], a[1]);
  SIGNAL.pedEW.value.set(b[0], b[1]);
}

const lensCache = new Map();
function lensMat(axis, idx, color) {
  const key = `${axis}|${idx}`;
  if (lensCache.has(key)) return lensCache.get(key);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.25), roughness: 0.2, emissive: color, emissiveIntensity: 1 });
  const uni = axis === 'ns' ? SIGNAL.ns : axis === 'ew' ? SIGNAL.ew : axis === 'pedNS' ? SIGNAL.pedNS : SIGNAL.pedEW;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSig = uni;
    sh.uniforms.uNight = SIGNS.uNight;
    const isPed = axis.startsWith('ped');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform ${isPed ? 'vec2' : 'vec3'} uSig; uniform float uNight;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float sOn = uSig[${idx}];
        totalEmissiveRadiance *= sOn * mix(6.0, 5.0, uNight) + 0.03;`);
  };
  m.customProgramCacheKey = () => `lens-${axis}-${idx}`;
  m.name = `lens-${axis}-${idx}`;
  lensCache.set(key, m);
  return m;
}

// ---- Geometry helpers -----------------------------------------------------------------------

function lathe(profile, segs = 16) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), segs);
}
function cyl(rt, rb, h, segs = 12, y0 = 0, open = false) {
  return new THREE.CylinderGeometry(rt, rb, h, segs, 1, open).translate(0, y0 + h / 2, 0);
}
function box(w, h, d, x = 0, y = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}
function tubeAlong(points, r, segs = 16, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segs, r, radial, false);
}

// A part list entry: { geo, mat, tint?, uv?, cast? }
function stamp(batch, parts, matrix, extra = {}) {
  for (const p of parts) {
    batch.add(p.geo, p.mat, {
      matrix: p.m ? new THREE.Matrix4().multiplyMatrices(matrix, p.m) : matrix,
      tint: p.tint ?? extra.tint,
      uv: p.uv,
      castShadow: p.cast ?? true,
      receiveShadow: true,
      grime: p.grime,
      grimeBase: extra.y ?? 0,
    });
  }
}

const place = (x, y, z, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, ry), new THREE.Vector3(1, 1, 1));

// ---- Props ----------------------------------------------------------------------------------

export class Props {
  constructor(ctx) {
    this.ctx = ctx;
    this.batch = ctx.batch;
    this.col = ctx.colliders;
    this.lights = ctx.lights || (ctx.lights = []);
    this.rng = ctx.rng || new Rng('props');
    this.M = propMats();
    this._cache = new Map();
  }

  _parts(key, build) {
    let p = this._cache.get(key);
    if (!p) {
      p = build();
      this._cache.set(key, p);
    }
    return p;
  }

  // Decorative downtown post: fluted cast-iron base, twin arms with acorn lanterns, banner arms.
  downtownLamp(x, z, ry = 0, { y = 0.15, banner = null } = {}) {
    const M = this.M;
    const H = 5.4;
    const parts = this._parts('dtlamp', () => {
      const out = [];
      // Fluted base: lathe with a ring profile, then flutes via a few slim boxes.
      out.push({ geo: lathe([[0.0, 0], [0.24, 0], [0.24, 0.06], [0.2, 0.1], [0.19, 0.5], [0.15, 0.62], [0.13, 0.66], [0.13, 0.72], [0.1, 0.78], [0.0, 0.78]], 18), mat: M.iron, grime: 0.6 });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        out.push({ geo: box(0.03, 0.4, 0.03, Math.cos(a) * 0.19, 0.3, Math.sin(a) * 0.19), mat: M.iron });
      }
      out.push({ geo: cyl(0.055, 0.075, H - 0.78, 12, 0.78), mat: M.iron });
      // Collar rings.
      for (const yy of [1.6, H - 0.5]) out.push({ geo: cyl(0.085, 0.085, 0.06, 14, yy), mat: M.iron });
      // Twin scroll arms.
      for (const s of [-1, 1]) {
        out.push({ geo: tubeAlong([[0, H - 0.3, 0], [s * 0.3, H - 0.05, 0], [s * 0.62, H + 0.05, 0], [s * 0.78, H - 0.08, 0]], 0.025, 14), mat: M.iron });
        out.push({ geo: tubeAlong([[0, H - 0.75, 0], [s * 0.25, H - 0.5, 0], [s * 0.3, H - 0.25, 0]], 0.016, 10), mat: M.iron });
        // Lantern: cap, globe, bottom finial.
        const lx = s * 0.78;
        out.push({ geo: lathe([[0.0, 0.32], [0.04, 0.32], [0.05, 0.26], [0.17, 0.2], [0.19, 0.16], [0.0, 0.16]], 16).translate(lx, H - 0.5, 0), mat: M.iron });
        out.push({ geo: lathe([[0.0, -0.22], [0.08, -0.2], [0.15, -0.08], [0.16, 0.04], [0.13, 0.16], [0.0, 0.17]], 16).translate(lx, H - 0.5, 0), mat: M.lampWarm, cast: false });
        out.push({ geo: lathe([[0.0, -0.32], [0.03, -0.3], [0.05, -0.22], [0.0, -0.2]], 10).translate(lx, H - 0.5, 0), mat: M.iron });
      }
      // Finial.
      out.push({ geo: lathe([[0.0, 0], [0.06, 0], [0.07, 0.05], [0.03, 0.12], [0.02, 0.25], [0.0, 0.3]], 12).translate(0, H, 0), mat: M.iron });
      // Banner arms.
      out.push({ geo: box(0.7, 0.03, 0.03, 0.35, 4.1, 0), mat: M.iron });
      out.push({ geo: box(0.7, 0.03, 0.03, 0.35, 2.55, 0), mat: M.iron });
      return out;
    });
    const mtx = place(x, y, z, ry);
    stamp(this.batch, parts, mtx, { y });
    if (banner) {
      const bm = banner;
      const g = new THREE.PlaneGeometry(0.62, 1.45);
      // Slight wave so it reads as fabric.
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 6 + p.getY(i) * 2) * 0.025);
      g.computeVertexNormals();
      g.translate(0.38, 3.32, 0.02);
      const g2 = g.clone().rotateY(Math.PI).translate(0, 0, 0);
      this.batch.add(g, bm, { matrix: mtx, uv: 'keep', castShadow: true });
      this.batch.add(g2, bm, { matrix: mtx, uv: 'keep', castShadow: false });
    }
    this.col.cylinder(x, y, z, 0.2, 0.75);
    this.col.cylinder(x, y + 0.75, z, 0.075, H - 0.75);
    for (const s of [-1, 1]) {
      const p = new THREE.Vector3(s * 0.78, H - 0.6, 0).applyMatrix4(mtx);
      this.lights.push({ pos: p, color: 0xffcf96, intensity: 7, distance: 14, kind: 'lamp', height: p.y });
    }
  }

  // Cobra-head street light on a galvanised pole; the arm reaches over the road.
  cobraLight(x, z, ry = 0, { y = 0.15, arm = 2.6, sodium = false, dead = false, h = 8.6 } = {}) {
    const M = this.M;
    const lens = dead ? M.lampDead : sodium ? M.lampSodium : M.lampLED;
    const key = `cobra|${arm}|${h}|${lens.name}`;
    const parts = this._parts(key, () => {
      const out = [];
      out.push({ geo: cyl(0.32, 0.36, 0.5, 14, -0.05), mat: M.concrete, grime: 0.7 });
      out.push({ geo: lathe([[0, 0.45], [0.16, 0.45], [0.16, 0.75], [0.1, 0.85], [0, 0.85]], 8), mat: M.galv });
      out.push({ geo: cyl(0.075, 0.12, h - 0.45, 12, 0.45), mat: M.galv });
      // Arm: rises then runs out horizontally (+X local), slight upward tilt.
      out.push({ geo: tubeAlong([[0, h - 0.6, 0], [0.25, h - 0.15, 0], [0.8, h + 0.05, 0], [arm, h + 0.15, 0]], 0.045, 16, 8), mat: M.galv });
      // Head: flattened teardrop + lens.
      const head = new THREE.SphereGeometry(0.3, 16, 10).scale(1.55, 0.42, 0.85).translate(arm + 0.32, h + 0.12, 0);
      out.push({ geo: head, mat: M.galv });
      out.push({ geo: new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45).scale(1.45, 0.4, 0.75).translate(arm + 0.34, h + 0.1, 0), mat: lens, cast: false });
      // Photocell on top.
      out.push({ geo: cyl(0.04, 0.04, 0.05, 8, h + 0.24).translate(arm + 0.1, 0, 0), mat: M.grey });
      return out;
    });
    const mtx = place(x, y, z, ry);
    stamp(this.batch, parts, mtx, { y });
    this.col.cylinder(x, y, z, 0.12, h);
    if (!dead) {
      const p = new THREE.Vector3(arm + 0.34, h - 0.05, 0).applyMatrix4(mtx);
      this.lights.push({ pos: p, color: sodium ? 0xffa850 : 0xe8eeff, intensity: sodium ? 22 : 26, distance: 24, kind: 'street', height: p.y, flicker: this.rng.chance(0.08) });
    }
  }

  // Signal mast at a corner: pole + horizontal arm over the road with signal heads.
  // `axis`: which traffic stream the heads face ('ns' | 'ew'); arm runs along local +X and the
  // heads face local -Z.
  signalMast(x, z, ry, { y = 0.15, axis = 'ns', arm = 8.5, heads = [3.2, 6.6], blade = null, pedAxes = [] } = {}) {
    const M = this.M;
    const parts = this._parts(`mast|${arm}|${heads.join(',')}|${axis}`, () => {
      const out = [];
      out.push({ geo: cyl(0.36, 0.4, 0.4, 14, -0.1), mat: M.concrete, grime: 0.6 });
      out.push({ geo: lathe([[0, 0.3], [0.22, 0.3], [0.22, 0.42], [0.16, 0.55], [0, 0.55]], 10), mat: M.galv });
      out.push({ geo: cyl(0.13, 0.17, 6.8, 14, 0.3), mat: M.galv });
      out.push({ geo: lathe([[0, 0], [0.14, 0], [0.12, 0.08], [0, 0.12]], 10).translate(0, 7.1, 0), mat: M.galv });
      // Arm + tie rod.
      out.push({ geo: new THREE.CylinderGeometry(0.06, 0.11, arm, 10).rotateZ(Math.PI / 2).translate(arm / 2, 6.3, 0), mat: M.galv });
      out.push({ geo: tubeAlong([[0, 7.05, 0], [arm * 0.45, 6.42, 0]], 0.018, 4, 5), mat: M.galv });
      for (const hx of heads) out.push(...signalHead(M, axis).map((p) => ({ ...p, m: new THREE.Matrix4().makeTranslation(hx, 6.15, 0).multiply(p.m || new THREE.Matrix4()) })));
      // Luminaire on top of the mast (many downtown masts have one).
      out.push({ geo: tubeAlong([[0, 7.0, 0], [0.4, 8.6, 0], [1.6, 8.9, 0]], 0.04, 10, 6), mat: M.galv });
      out.push({ geo: new THREE.BoxGeometry(0.75, 0.12, 0.38).translate(1.85, 8.88, 0), mat: M.galv });
      out.push({ geo: new THREE.PlaneGeometry(0.66, 0.3).rotateX(Math.PI / 2).translate(1.85, 8.815, 0), mat: M.lampLED, cast: false });
      return out;
    });
    const mtx = place(x, y, z, ry);
    stamp(this.batch, parts, mtx, { y });
    this.col.cylinder(x, y, z, 0.17, 7.2);
    const lp = new THREE.Vector3(1.85, 8.7, 0).applyMatrix4(mtx);
    this.lights.push({ pos: lp, color: 0xeef1ff, intensity: 26, distance: 24, kind: 'street', height: lp.y });
    if (blade) {
      // Internally-lit street name sign hanging from the arm.
      const bm = bladeMat(blade.name, blade.block, true);
      const g = new THREE.BoxGeometry(2.4, 0.46, 0.06);
      setBoxFaceUV(g);
      this.batch.add(g, bm, { matrix: new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeTranslation(arm * 0.62 + 1.2, 6.75, 0)), uv: 'keep' });
      this.batch.add(box(0.03, 0.18, 0.03), M.galv, { matrix: new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeTranslation(arm * 0.62 + 0.4, 7.0, 0)) });
      this.batch.add(box(0.03, 0.18, 0.03), M.galv, { matrix: new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeTranslation(arm * 0.62 + 2.0, 7.0, 0)) });
    }
    // Pedestrian heads + push buttons on the pole.
    for (const pa of pedAxes) {
      const ped = pedHead(M, pa.axis);
      const pm = new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeRotationY(pa.ry).setPosition(Math.cos(pa.ry) * 0, 2.9, 0));
      for (const p of ped) this.batch.add(p.geo, p.mat, { matrix: new THREE.Matrix4().multiplyMatrices(pm, p.m || new THREE.Matrix4()), uv: p.uv, castShadow: true });
      const bmx = new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeRotationY(pa.ry).setPosition(0, 1.05, 0));
      this.batch.add(box(0.12, 0.18, 0.08, 0, 0, 0.19), M.signalYellow, { matrix: bmx });
      this.batch.add(cyl(0.03, 0.03, 0.02, 12, 0).rotateX(Math.PI / 2).translate(0, 0.02, 0.24), M.steel, { matrix: bmx });
    }
  }

  // Free-standing street name post (two blades crossing).
  streetPost(x, z, { y = 0.15, a, b }) {
    const M = this.M;
    const mtx = place(x, y, z, 0);
    stamp(this.batch, this._parts('npost', () => [
      { geo: cyl(0.035, 0.035, 3.3, 8, 0), mat: M.galv },
      { geo: lathe([[0, 3.3], [0.05, 3.3], [0.0, 3.4]], 8), mat: M.galv },
    ]), mtx, { y });
    const gA = new THREE.BoxGeometry(1.5, 0.24, 0.025);
    setBoxFaceUV(gA);
    this.batch.add(gA, bladeMat(a.name, a.block), { matrix: place(x + Math.cos(a.ry) * 0.5, y + 3.05, z - Math.sin(a.ry) * 0.5, a.ry), uv: 'keep' });
    const gB = new THREE.BoxGeometry(1.5, 0.24, 0.025);
    setBoxFaceUV(gB);
    this.batch.add(gB, bladeMat(b.name, b.block), { matrix: place(x + Math.cos(b.ry) * 0.5, y + 3.3, z - Math.sin(b.ry) * 0.5, b.ry), uv: 'keep' });
    this.col.cylinder(x, y, z, 0.04, 3.3);
  }

  hydrant(x, z, ry = 0, { y = 0.15 } = {}) {
    const M = this.M;
    const parts = this._parts('hydrant', () => {
      const body = [
        [0.0, 0], [0.16, 0], [0.16, 0.05], [0.12, 0.07], [0.12, 0.1], [0.1, 0.12], [0.1, 0.5], [0.12, 0.52],
        [0.12, 0.56], [0.1, 0.58], [0.11, 0.66], [0.09, 0.72], [0.05, 0.76], [0.03, 0.8], [0.0, 0.81],
      ];
      const out = [{ geo: lathe(body, 16), mat: M.yellow, grime: 0.5 }];
      // Nozzles with caps + chains.
      for (const [a, r, l] of [[0, 0.055, 0.12], [Math.PI, 0.055, 0.12], [Math.PI / 2, 0.075, 0.13]]) {
        const g = new THREE.CylinderGeometry(r, r * 1.05, l, 12).rotateZ(Math.PI / 2).translate(0.1 + l / 2, 0.42, 0).rotateY(a);
        out.push({ geo: g, mat: M.yellow });
        const cap = new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.04, 6).rotateZ(Math.PI / 2).translate(0.1 + l + 0.02, 0.42, 0).rotateY(a);
        out.push({ geo: cap, mat: M.yellow });
      }
      out.push({ geo: cyl(0.02, 0.025, 0.05, 5, 0.8), mat: M.yellow });
      // Base flange bolts.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        out.push({ geo: cyl(0.015, 0.015, 0.03, 6, 0.05).translate(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13), mat: M.steel });
      }
      return out;
    });
    stamp(this.batch, parts, place(x, y, z, ry), { y });
    this.col.cylinder(x, y, z, 0.15, 0.8);
  }

  // A row of 2–4 newspaper vending boxes.
  newsboxes(x, z, ry, n = 3, { y = 0.15 } = {}) {
    const M = this.M;
    const kinds = ['times', 'weekly', 'apts', 'free'];
    const colors = { times: 0x1e3d78, weekly: 0xb52b22, apts: 0xe6b82c, free: 0x2f6d3a };
    const mtx = place(x, y, z, ry);
    for (let i = 0; i < n; i++) {
      const k = kinds[(i + Math.floor(x + z)) % kinds.length];
      const ox = (i - (n - 1) / 2) * 0.56 + this.rng.range(-0.03, 0.03);
      const lr = this.rng.range(-0.05, 0.05);
      const lm = new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeRotationY(lr).setPosition(ox, 0, 0));
      const parts = this._parts(`newsbox|${k}`, () => {
        const out = [];
        out.push({ geo: box(0.5, 0.62, 0.44, 0, 0.62, 0), mat: M.plastic, tint: colors[k], grime: 0.5 });
        out.push({ geo: box(0.52, 0.05, 0.46, 0, 0.955, 0), mat: M.plastic, tint: colors[k] });
        out.push({ geo: box(0.08, 0.32, 0.08, -0.18, 0.16, 0), mat: M.iron });
        out.push({ geo: box(0.08, 0.32, 0.08, 0.18, 0.16, 0), mat: M.iron });
        out.push({ geo: box(0.46, 0.02, 0.4, 0, 0.31, 0), mat: M.iron });
        // Window with the paper behind it.
        const pg = new THREE.PlaneGeometry(0.38, 0.3);
        out.push({ geo: pg.clone().translate(0, 0.74, 0.221), mat: newspaperMat(k), uv: 'keep', cast: false });
        out.push({ geo: box(0.08, 0.06, 0.03, 0.16, 0.5, 0.225), mat: M.steel });
        out.push({ geo: box(0.3, 0.04, 0.03, 0, 0.94, 0.225), mat: M.steel });
        return out;
      });
      stamp(this.batch, parts, lm, { y });
    }
    const w = n * 0.56;
    this.col.box(x, y + 0.5, z, w, 1.0, 0.46, ry);
  }

  parkingMeter(x, z, ry = 0, { y = 0.15 } = {}) {
    const M = this.M;
    const parts = this._parts('meter', () => [
      { geo: cyl(0.035, 0.04, 1.15, 10, 0), mat: M.grey, grime: 0.5 },
      { geo: box(0.2, 0.32, 0.16, 0, 1.3, 0), mat: M.grey },
      { geo: new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 0.8).translate(0, 1.46, 0), mat: M.grey },
      { geo: new THREE.PlaneGeometry(0.13, 0.08).translate(0, 1.36, 0.081), mat: meterScreenMat(), uv: 'keep', cast: false },
      { geo: box(0.06, 0.03, 0.02, 0, 1.22, 0.085), mat: M.black },
    ]);
    stamp(this.batch, parts, place(x, y, z, ry), { y });
    this.col.cylinder(x, y, z, 0.05, 1.15);
    this.col.box(x, y + 1.3, z, 0.2, 0.34, 0.16, ry);
  }

  trashCan(x, z, { y = 0.15, style = 'downtown', ry = 0 } = {}) {
    const M = this.M;
    if (style === 'downtown') {
      const parts = this._parts('can-dt', () => {
        const out = [{ geo: cyl(0.3, 0.3, 0.06, 18, 0.02), mat: M.iron }];
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          out.push({ geo: box(0.05, 0.78, 0.018).rotateY(-a).translate(Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3), mat: M.iron, grime: 0.6 });
        }
        for (const yy of [0.12, 0.8]) out.push({ geo: new THREE.TorusGeometry(0.305, 0.015, 6, 24).rotateX(Math.PI / 2).translate(0, yy, 0), mat: M.iron });
        out.push({ geo: lathe([[0, 0.98], [0.33, 0.9], [0.33, 0.86], [0.0, 0.86]], 18), mat: M.iron });
        out.push({ geo: cyl(0.27, 0.27, 0.6, 14, 0.15, true), mat: M.rubber }); // liner bag inside
        return out;
      });
      stamp(this.batch, parts, place(x, y, z, ry), { y });
      this.col.cylinder(x, y, z, 0.33, 0.98);
    } else {
      // Exposed-aggregate concrete bin with a dented metal lid (4th St).
      const parts = this._parts('can-cc', () => [
        { geo: cyl(0.33, 0.3, 0.85, 14, 0), mat: M.concrete, grime: 0.7 },
        { geo: lathe([[0, 0.97], [0.12, 0.96], [0.26, 0.9], [0.34, 0.87], [0.34, 0.85], [0.0, 0.85]], 14), mat: M.galv },
        { geo: box(0.3, 0.14, 0.03, 0, 0.9, 0.3), mat: M.black },
      ]);
      stamp(this.batch, parts, place(x, y, z, ry), { y });
      this.col.cylinder(x, y, z, 0.34, 0.97);
    }
  }

  bench(x, z, ry, { y = 0.15 } = {}) {
    const M = this.M;
    const parts = this._parts('bench', () => {
      const out = [];
      for (const sx of [-0.8, 0.8]) {
        out.push({ geo: box(0.06, 0.45, 0.55, sx, 0.225, 0), mat: M.iron });
        out.push({ geo: box(0.06, 0.5, 0.06, sx, 0.7, -0.24).rotateX(-0.12), mat: M.iron });
        out.push({ geo: box(0.06, 0.04, 0.5, sx, 0.62, 0.02), mat: M.iron });
      }
      for (let i = 0; i < 4; i++) out.push({ geo: box(1.9, 0.035, 0.1, 0, 0.46, -0.18 + i * 0.12), mat: M.wood });
      for (let i = 0; i < 3; i++) out.push({ geo: box(1.9, 0.09, 0.03, 0, 0.62 + i * 0.12, -0.27 - i * 0.012), mat: M.wood });
      return out;
    });
    stamp(this.batch, parts, place(x, y, z, ry), { y });
    this.col.box(x, y + 0.24, z, 1.9, 0.48, 0.55, ry);
    const back = new THREE.Vector3(0, 0, -0.27).applyAxisAngle(Y, ry);
    this.col.box(x + back.x, y + 0.75, z + back.z, 1.9, 0.5, 0.08, ry);
  }

  // RTC bus shelter facing local +Z (the street).
  busShelter(x, z, ry, { y = 0.15, route = '11 · 18' } = {}) {
    const M = this.M;
    const W = 3.6;
    const D = 1.5;
    const H = 2.45;
    const parts = this._parts('shelter', () => {
      const out = [];
      for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2 - 0.1], [W / 2, D / 2 - 0.1]]) out.push({ geo: box(0.07, H, 0.07, px, H / 2, pz), mat: M.galv });
      out.push({ geo: box(W + 0.3, 0.1, D + 0.25, 0, H + 0.05, 0.05), mat: M.galv });
      out.push({ geo: box(W + 0.2, 0.04, D + 0.15, 0, H + 0.12, 0.05), mat: M.white });
      out.push({ geo: box(W, 0.04, 0.04, 0, 0.12, -D / 2), mat: M.galv });
      out.push({ geo: box(W, 0.04, 0.04, 0, H - 0.1, -D / 2), mat: M.galv });
      // Back glass + side glass (scratched).
      out.push({ geo: new THREE.PlaneGeometry(W - 0.1, H - 0.3).translate(0, H / 2 + 0.03, -D / 2), mat: M.glass, cast: false });
      out.push({ geo: new THREE.PlaneGeometry(D - 0.2, H - 0.3).rotateY(Math.PI / 2).translate(-W / 2, H / 2 + 0.03, 0), mat: M.glass, cast: false });
      // Ad box at the right end (lit at night).
      out.push({ geo: box(0.2, 1.9, 1.3, W / 2 + 0.12, 1.15, 0), mat: M.galv });
      const ad = new THREE.PlaneGeometry(1.18, 1.75);
      out.push({ geo: ad.clone().rotateY(Math.PI / 2).translate(W / 2 + 0.225, 1.15, 0), mat: adMat(), uv: 'keep', cast: false });
      out.push({ geo: ad.clone().rotateY(-Math.PI / 2).translate(W / 2 + 0.015, 1.15, 0), mat: adMat(), uv: 'keep', cast: false });
      // Bench.
      out.push({ geo: box(2.2, 0.05, 0.42, -0.3, 0.46, -D / 2 + 0.3), mat: M.steel });
      for (const bx of [-1.2, 0.6]) out.push({ geo: box(0.05, 0.44, 0.38, bx, 0.22, -D / 2 + 0.3), mat: M.galv });
      return out;
    });
    const mtx = place(x, y, z, ry);
    stamp(this.batch, parts, mtx, { y });
    // Colliders: back wall, side wall, ad box, bench, posts.
    const L = (lx, ly, lz, sx, sy, sz) => {
      const p = new THREE.Vector3(lx, ly, lz).applyMatrix4(mtx);
      this.col.box(p.x, p.y, p.z, sx, sy, sz, ry);
    };
    L(0, H / 2, -D / 2, W, H, 0.08);
    L(-W / 2, H / 2, 0, 0.08, H, D);
    L(W / 2 + 0.12, 1.15, 0, 0.22, 1.9, 1.3);
    L(-0.3, 0.24, -D / 2 + 0.3, 2.2, 0.48, 0.42);
    L(0, H + 0.05, 0.05, W + 0.3, 0.12, D + 0.25);
    for (const [px, pz] of [[-W / 2, D / 2 - 0.1], [W / 2, D / 2 - 0.1]]) L(px, H / 2, pz, 0.08, H, 0.08);
    const lp = new THREE.Vector3(W / 2 + 0.12, 1.2, 0).applyMatrix4(mtx);
    this.lights.push({ pos: lp, color: 0xdfe9ff, intensity: 2.5, distance: 6, kind: 'ad', height: 1.2 });
    // Bus stop sign post at the curb.
    const sp = new THREE.Vector3(-W / 2 - 0.6, 0, D / 2 + 1.1).applyMatrix4(mtx);
    this.busStopSign(sp.x, sp.z, ry, { y, route });
  }

  busStopSign(x, z, ry, { y = 0.15, route = '11' } = {}) {
    const M = this.M;
    const mtx = place(x, y, z, ry);
    stamp(this.batch, this._parts('busstop-post', () => [{ geo: cyl(0.03, 0.03, 3.0, 8, 0), mat: M.galv }]), mtx, { y });
    const g = new THREE.BoxGeometry(0.46, 0.72, 0.02);
    setBoxFaceUV(g);
    const sm = paintedSignMat(`busstop-${route}`, 230, 360, (c, w, h) => {
      c.fillStyle = '#1b4f9c';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff';
      c.fillRect(10, 10, w - 20, h * 0.36);
      c.fillStyle = '#1b4f9c';
      c.font = '400 76px "Bebas Neue"';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('RTC', w / 2, h * 0.2);
      c.fillStyle = '#fff';
      c.font = '400 44px "Bebas Neue"';
      c.fillText('BUS STOP', w / 2, h * 0.52);
      c.font = '400 38px "Bebas Neue"';
      fitText(c, `ROUTES ${route}`, w - 20, 38, (s) => `400 ${s}px "Bebas Neue"`);
      c.fillText(`ROUTES ${route}`, w / 2, h * 0.7);
      c.font = '400 22px "Inter"';
      c.fillText('rtcwashoe.com', w / 2, h * 0.88);
    }, { weather: { grime: 0.3, fade: 0.3 } });
    this.batch.add(g, sm, { matrix: new THREE.Matrix4().multiplyMatrices(mtx, new THREE.Matrix4().makeTranslation(0, 2.55, 0.04)), uv: 'keep' });
    this.col.cylinder(x, y, z, 0.035, 3.0);
  }

  // Wooden utility pole with crossarms, insulators and (optionally) a transformer + light.
  // Returns attachment points for wires (world space): { top: [Vector3 x3], low: [Vector3 x2] }.
  powerPole(x, z, ry = 0, { y = 0.15, transformer = false, light = null, h = 11.5, lean = 0 } = {}) {
    const M = this.M;
    const key = `ppole|${transformer}|${h}`;
    const parts = this._parts(key, () => {
      const out = [];
      const g = new THREE.CylinderGeometry(0.13, 0.17, h, 12, 4);
      g.translate(0, h / 2, 0);
      out.push({ geo: g, mat: M.pole, uv: 'keep' });
      out.push({ geo: box(2.4, 0.11, 0.1, 0, h - 0.5, 0.18), mat: M.wood });
      out.push({ geo: box(1.6, 0.1, 0.1, 0, h - 1.4, 0.18), mat: M.wood });
      for (const s of [-1, 1]) out.push({ geo: tubeAlong([[0, h - 1.0, 0.16], [s * 0.6, h - 0.55, 0.16]], 0.02, 3, 5), mat: M.steel });
      for (const ix of [-1.05, 0, 1.05]) {
        out.push({ geo: lathe([[0, 0], [0.05, 0], [0.06, 0.04], [0.045, 0.06], [0.06, 0.09], [0.045, 0.11], [0.03, 0.16], [0, 0.17]], 10).translate(ix, h - 0.445, 0.18), mat: insulatorMat() });
      }
      for (const ix of [-0.65, 0.65]) out.push({ geo: cyl(0.03, 0.035, 0.12, 8, h - 1.35).translate(ix, 0, 0.18), mat: M.black });
      if (transformer) {
        out.push({ geo: cyl(0.3, 0.3, 1.0, 16, h - 3.2).translate(0, 0, 0.45), mat: M.grey, grime: 0.3 });
        out.push({ geo: lathe([[0, h - 2.2], [0.31, h - 2.2], [0.2, h - 2.1], [0, h - 2.08]], 16).translate(0, 0, 0.45), mat: M.grey });
        out.push({ geo: box(0.1, 0.5, 0.2, 0, h - 2.7, 0.18), mat: M.steel });
        out.push({ geo: tubeAlong([[0.15, h - 2.15, 0.45], [0.4, h - 1.6, 0.3], [0.65, h - 1.33, 0.18]], 0.012, 6, 4), mat: MM.cable });
      }
      // Climbing steps.
      for (let k = 0; k < 9; k++) {
        const yy = 2.6 + k * 0.42;
        const s = k % 2 ? 1 : -1;
        out.push({ geo: cyl(0.012, 0.012, 0.22, 5, 0).rotateZ(Math.PI / 2).translate(s * 0.2, yy, 0), mat: M.steel });
      }
      // Tags & staples: numbered ID plate.
      out.push({ geo: box(0.12, 0.16, 0.01, 0, 2.0, 0.165), mat: M.galv });
      return out;
    });
    const mtx = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, ry, 0, 'YXZ')),
      new THREE.Vector3(1, 1, 1)
    );
    stamp(this.batch, parts, mtx, { y });
    this.col.cylinder(x, y, z, 0.16, h);
    if (light) this._poleLight(mtx, h, light);
    const pt = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(mtx);
    return {
      top: [-1.05, 0, 1.05].map((ix) => pt(ix, h - 0.3, 0.18)),
      low: [-0.65, 0.65].map((ix) => pt(ix, h - 1.25, 0.18)),
      phone: pt(0, h - 3.6, 0.18),
    };
  }

  _poleLight(mtx, h, { sodium = true, dead = false }) {
    const M = this.M;
    const lens = dead ? M.lampDead : sodium ? M.lampSodium : M.lampLED;
    const parts = this._parts(`polelight|${lens.name}`, () => [
      { geo: tubeAlong([[0, h - 4.2, 0.17], [0, h - 4.0, 0.9], [0, h - 3.85, 1.9]], 0.035, 8, 6), mat: M.galv },
      { geo: new THREE.SphereGeometry(0.26, 14, 8).scale(0.75, 0.38, 1.5).translate(0, h - 3.8, 2.15), mat: M.galv },
      { geo: new THREE.SphereGeometry(0.22, 12, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45).scale(0.7, 0.4, 1.4).translate(0, h - 3.82, 2.17), mat: lens, cast: false },
    ]);
    stamp(this.batch, parts, mtx);
    if (!dead) {
      const p = new THREE.Vector3(0, h - 3.95, 2.17).applyMatrix4(mtx);
      this.lights.push({ pos: p, color: sodium ? 0xffa850 : 0xe8eeff, intensity: 18, distance: 20, kind: 'street', height: p.y, flicker: this.rng.chance(0.15) });
    }
  }

  /** Sagging wire between two points (catenary approximated by a parabola). */
  wire(a, b, { sag = null, r = 0.012 } = {}) {
    const len = a.distanceTo(b);
    const s = sag ?? 0.018 * len + 0.15;
    const pts = [];
    const n = Math.max(6, Math.ceil(len / 3));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = new THREE.Vector3().lerpVectors(a, b, t);
      p.y -= 4 * s * t * (1 - t);
      pts.push(p);
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, r, 4, false);
    this.batch.add(g, this.M.cable, { castShadow: false, uv: 'keep' });
  }

  // Chain-link fence along a polyline (posts every ~3 m), optional barbed wire and a gate gap.
  chainFence(points, { y = 0.15, h = 1.85, barbed = true, sag = 0.06, gaps = [] } = {}) {
    const M = this.M;
    const cl = chainLinkMat();
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, z0] = points[i];
      const [x1, z1] = points[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ry = Math.atan2(-(z1 - z0), x1 - x0);
      const n = Math.max(1, Math.round(len / 3));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const px = x0 + (x1 - x0) * t;
        const pz = z0 + (z1 - z0) * t;
        const corner = k === 0 || k === n;
        stamp(this.batch, this._parts(`fpost|${corner}|${h}|${barbed}`, () => {
          const out = [{ geo: cyl(corner ? 0.045 : 0.032, corner ? 0.045 : 0.032, h + 0.05, 10, 0), mat: M.galv }];
          out.push({ geo: lathe([[0, h + 0.05], [corner ? 0.05 : 0.038, h + 0.05], [0, h + 0.1]], 10), mat: M.galv });
          if (barbed) out.push({ geo: box(0.04, 0.04, 0.45, 0, h + 0.15, 0.18).rotateX(-0.75), mat: M.galv });
          return out;
        }), place(px, y, pz, ry), { y });
        this.col.cylinder(px, y, pz, 0.05, h + 0.1);
      }
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      // Fabric: slight sag between posts so it doesn't read as a rigid sheet.
      const segs = n * 4;
      const fg = new THREE.PlaneGeometry(len, h - 0.08, segs, 2);
      const p = fg.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const lx = p.getX(v);
        const u = ((lx / len + 0.5) * n) % 1;
        p.setZ(v, Math.sin(u * Math.PI) * sag * (0.6 + 0.4 * Math.sin(lx * 1.7 + i)));
      }
      fg.computeVertexNormals();
      fg.translate(0, (h - 0.08) / 2 + 0.05, 0);
      this.batch.add(fg, cl, { matrix: place(mx, y, mz, ry), uv: 0.42, castShadow: true });
      // Top rail.
      this.batch.add(new THREE.CylinderGeometry(0.022, 0.022, len, 8).rotateZ(Math.PI / 2).translate(0, h, 0), M.galv, { matrix: place(mx, y, mz, ry) });
      if (barbed) {
        for (let s = 0; s < 3; s++) {
          const off = 0.08 + s * 0.11;
          const yy = y + h + 0.08 + s * 0.09;
          const dz = new THREE.Vector3(0, 0, off).applyAxisAngle(Y, ry);
          this.wire(new THREE.Vector3(x0 + dz.x, yy, z0 + dz.z), new THREE.Vector3(x1 + dz.x, yy, z1 + dz.z), { sag: 0.04, r: 0.006 });
        }
      }
      if (!gaps.includes(i)) this.col.box(mx, y + h / 2, mz, len, h, 0.06, ry);
    }
  }

  cabinet(x, z, ry, { y = 0.15 } = {}) {
    const M = this.M;
    stamp(this.batch, this._parts('cabinet', () => [
      { geo: box(0.9, 0.12, 0.62, 0, 0.06, 0), mat: M.concrete },
      { geo: box(0.8, 1.45, 0.52, 0, 0.845, 0), mat: M.grey, grime: 0.5 },
      { geo: box(0.84, 0.05, 0.56, 0, 1.59, 0), mat: M.grey },
      { geo: box(0.02, 1.2, 0.02, 0.0, 0.85, 0.265), mat: M.black },
      { geo: box(0.05, 0.12, 0.03, 0.3, 0.9, 0.27), mat: M.steel },
    ]), place(x, y, z, ry), { y });
    this.col.box(x, y + 0.81, z, 0.84, 1.62, 0.56, ry);
    return { front: new THREE.Vector3(0, 0, 0.27).applyAxisAngle(Y, ry).add(new THREE.Vector3(x, y, z)), ry };
  }

  bollard(x, z, { y = 0.15 } = {}) {
    stamp(this.batch, this._parts('bollard', () => [
      { geo: cyl(0.11, 0.11, 0.85, 14, 0), mat: this.M.yellow, grime: 0.5 },
      { geo: lathe([[0, 0.85], [0.11, 0.85], [0.08, 0.92], [0, 0.95]], 14), mat: this.M.yellow },
      { geo: cyl(0.112, 0.112, 0.06, 14, 0.66), mat: this.M.white },
    ]), place(x, y, z), { y });
    this.col.cylinder(x, y, z, 0.11, 0.95);
  }

  // Concrete planter box with soil; returns the soil centre for a tree.
  planter(x, z, { y = 0.15, size = 1.5, ry = 0 } = {}) {
    const M = this.M;
    const s = size;
    stamp(this.batch, this._parts(`planter|${s}`, () => {
      const out = [];
      const t = 0.12;
      out.push({ geo: box(s, 0.5, t, 0, 0.25, s / 2 - t / 2), mat: M.concrete, grime: 0.6 });
      out.push({ geo: box(s, 0.5, t, 0, 0.25, -s / 2 + t / 2), mat: M.concrete, grime: 0.6 });
      out.push({ geo: box(t, 0.5, s - 2 * t, s / 2 - t / 2, 0.25, 0), mat: M.concrete, grime: 0.6 });
      out.push({ geo: box(t, 0.5, s - 2 * t, -s / 2 + t / 2, 0.25, 0), mat: M.concrete, grime: 0.6 });
      out.push({ geo: box(s + 0.06, 0.05, s + 0.06, 0, 0.525, 0).translate(0, 0, 0), mat: M.concrete });
      out.push({ geo: new THREE.PlaneGeometry(s - 2 * t, s - 2 * t).rotateX(-Math.PI / 2).translate(0, 0.4, 0), mat: M.dirt, cast: false });
      return out;
    }), place(x, y, z, ry), { y });
    this.col.box(x, y + 0.27, z, s + 0.06, 0.55, s + 0.06, ry);
    return new THREE.Vector3(x, y + 0.4, z);
  }

  // Litter scattered in an area (cups, cans, flattened paper, bottles, butts, a bag).
  litter(x0, z0, x1, z1, n, { y = 0.15, rng } = {}) {
    const r = rng || this.rng;
    const M = this.M;
    const kinds = this._parts('litter', () => ({
      can: [{ geo: new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10).scale(1, 0.55, 1).rotateZ(Math.PI / 2).translate(0, 0.025, 0), mat: litterMat('can'), uv: 'keep' }],
      cup: [{ geo: new THREE.CylinderGeometry(0.045, 0.032, 0.11, 10, 1, true).rotateZ(Math.PI / 2).translate(0, 0.04, 0), mat: litterMat('cup'), uv: 'keep' }],
      paper: [{ geo: crumple(new THREE.PlaneGeometry(0.28, 0.2, 4, 3).rotateX(-Math.PI / 2), 0.02, 3).translate(0, 0.012, 0), mat: litterMat('paper'), uv: 'keep' }],
      bottle: [{ geo: lathe([[0, 0], [0.033, 0], [0.034, 0.16], [0.012, 0.22], [0.012, 0.25], [0, 0.25]], 10).rotateZ(Math.PI / 2).translate(0.12, 0.034, 0), mat: litterMat('bottle') }],
      butt: [{ geo: new THREE.CylinderGeometry(0.004, 0.004, 0.03, 5).rotateZ(Math.PI / 2).translate(0, 0.005, 0), mat: litterMat('butt'), uv: 'keep' }],
      bag: [{ geo: crumple(new THREE.IcosahedronGeometry(0.11, 1), 0.04, 7).scale(1, 0.45, 1).translate(0, 0.04, 0), mat: litterMat('bag'), uv: 'keep' }],
      wrapper: [{ geo: crumple(new THREE.PlaneGeometry(0.12, 0.08, 3, 2).rotateX(-Math.PI / 2), 0.008, 5).translate(0, 0.008, 0), mat: litterMat('wrapper'), uv: 'keep' }],
    }));
    const pool = ['can', 'cup', 'paper', 'paper', 'butt', 'butt', 'butt', 'wrapper', 'wrapper', 'bottle', 'bag'];
    for (let i = 0; i < n; i++) {
      const k = r.pick(pool);
      const x = r.range(x0, x1);
      const z = r.range(z0, z1);
      stamp(this.batch, kinds[k].map((p) => ({ ...p, cast: false })), place(x, y, z, r.range(0, Math.PI * 2)), { y });
    }
    void M;
  }
}

// ---- Small material factories ---------------------------------------------------------------

function crumple(g, amt, seed) {
  const r = new Rng(seed);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + r.range(-amt, amt) * 0.5, p.getY(i) + r.range(-amt, amt), p.getZ(i) + r.range(-amt, amt) * 0.5);
  }
  g.computeVertexNormals();
  return g;
}

const smallCache = new Map();
function cached(key, f) {
  if (!smallCache.has(key)) smallCache.set(key, f());
  return smallCache.get(key);
}

function insulatorMat() {
  return cached('insulator', () => new THREE.MeshStandardMaterial({ color: 0x5a7f6e, roughness: 0.18, metalness: 0, transparent: false }));
}

export function litterMat(k) {
  return cached(`litter-${k}`, () => {
    if (k === 'can') return paintedSignMat('litter-can', 128, 64, (g, w, h) => {
      g.fillStyle = '#b81d24';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ddd';
      g.fillRect(0, 0, w, 6);
      g.fillRect(0, h - 6, w, 6);
      g.fillStyle = '#fff';
      g.font = '400 30px "Bebas Neue"';
      g.fillText('COLA', 30, 44);
    }, { metal: 0.6, rough: 0.35 });
    if (k === 'cup') return paintedSignMat('litter-cup', 128, 64, (g, w, h) => {
      g.fillStyle = '#f2efe8';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#c8202a';
      g.fillRect(0, 20, w, 18);
    });
    if (k === 'paper') return paintedSignMat('litter-paper', 128, 96, (g, w, h) => {
      g.fillStyle = '#ddd6c6';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(40,40,40,0.6)';
      for (let i = 0; i < 10; i++) g.fillRect(8, 10 + i * 8, w - 16 - (i % 3) * 20, 3);
    });
    if (k === 'bottle') return new THREE.MeshPhysicalMaterial({ color: 0x5a3a12, roughness: 0.12, transmission: 0.6, thickness: 0.01, transparent: true });
    if (k === 'butt') return new THREE.MeshStandardMaterial({ color: 0xd9b88a, roughness: 0.9 });
    if (k === 'bag') return new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    return paintedSignMat('litter-wrapper', 64, 64, (g, w, h) => {
      g.fillStyle = '#e8b51e';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#7b1f12';
      g.fillRect(0, h * 0.35, w, h * 0.3);
    }, { metal: 0.3, rough: 0.4 });
  });
}

function meterScreenMat() {
  return cached('meter-screen', () => paintedSignMat('meter-screen', 128, 80, (g, w, h) => {
    g.fillStyle = '#7d8f73';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1e2a18';
    g.font = '400 40px "Bebas Neue"';
    g.textAlign = 'center';
    g.fillText('EXPIRED', w / 2, h * 0.66);
  }, { weather: { grime: 0.2, fade: 0.1, scratches: 0.4 } }));
}

function newspaperMat(k) {
  return cached(`paper-${k}`, () => paintedSignMat(`newsbox-${k}`, 256, 200, (g, w, h) => {
    g.fillStyle = '#e9e4d6';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#151515';
    g.textAlign = 'center';
    const titles = { times: 'The Truckee Times', weekly: 'RENO WEEKLY', apts: 'APARTMENT GUIDE', free: 'NEVADA JOBS' };
    g.font = k === 'times' ? '700 30px "Playfair Display"' : '400 36px "Bebas Neue"';
    fitText(g, titles[k], w - 16, k === 'times' ? 30 : 36, (s) => (k === 'times' ? `700 ${s}px "Playfair Display"` : `400 ${s}px "Bebas Neue"`));
    g.fillText(titles[k], w / 2, 34);
    g.fillRect(8, 42, w - 16, 2);
    g.font = '400 26px "Bebas Neue"';
    const heads = { times: 'LOCAL MAN WINS BIG, LOSES BIGGER', weekly: 'THE BEST TACOS ON 4TH', apts: 'MOVE IN SPECIAL $99', free: 'NOW HIRING · DEALERS' };
    fitText(g, heads[k], w - 16, 26, (s) => `400 ${s}px "Bebas Neue"`);
    g.fillText(heads[k], w / 2, 72);
    g.fillStyle = '#8b8577';
    g.fillRect(10, 86, w * 0.45, 70);
    g.fillStyle = 'rgba(30,30,30,0.55)';
    for (let i = 0; i < 9; i++) g.fillRect(w * 0.52, 88 + i * 8, w * 0.42, 3);
    for (let i = 0; i < 4; i++) g.fillRect(10, 164 + i * 8, w - 20, 3);
    // Scuffed plexi window: streaks.
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.moveTo(0, h * 0.2);
    g.lineTo(w * 0.35, 0);
    g.lineTo(w * 0.5, 0);
    g.lineTo(0, h * 0.4);
    g.fill();
  }, { weather: { grime: 0.45, fade: 0.3 } }));
}

function adMat() {
  return cached('shelter-ad', () => paintedSignMat('shelter-ad-kslv', 300, 440, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0b2a5c');
    grd.addColorStop(1, '#06132b');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c24a';
    g.font = '400 120px "Bebas Neue"';
    g.textAlign = 'center';
    g.fillText('8', w / 2, h * 0.38);
    g.fillStyle = '#fff';
    g.font = '400 58px "Bebas Neue"';
    g.fillText('KSLV NEWS', w / 2, h * 0.52);
    g.font = '400 30px "Bebas Neue"';
    g.fillText('ON YOUR SIDE', w / 2, h * 0.6);
    g.fillText('SINCE 1962', w / 2, h * 0.66);
    g.fillStyle = '#d23c2a';
    g.fillRect(0, h * 0.8, w, h * 0.08);
    g.fillStyle = '#fff';
    g.font = '400 30px "Bebas Neue"';
    g.fillText('LIVE AT 5 · 6 · 11', w / 2, h * 0.86);
  }, { lit: 2.2, weather: { grime: 0.15, fade: 0.15 } }));
}

const bladeCache = new Map();
/** Green street-name blade (white legend, block number), optionally internally lit. */
export function bladeMat(name, block = '', lit = false) {
  const key = `${name}|${block}|${lit}`;
  if (bladeCache.has(key)) return bladeCache.get(key);
  const m = paintedSignMat(`blade-${key}`, 512, 96, (g, w, h) => {
    g.fillStyle = '#0d5a33';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f2f2ee';
    g.lineWidth = 4;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#f5f5f0';
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    const parts = name.split(' ');
    const prefix = /^(N|S|E|W)$/.test(parts[0]) ? parts.shift() : '';
    const suffix = /^(St|Ave|Row|Blvd|Way)$/.test(parts[parts.length - 1]) ? parts.pop() : '';
    let x = 18;
    if (prefix) {
      g.font = '600 34px "Inter"';
      g.fillText(prefix, x, h * 0.42);
      x += g.measureText(prefix).width + 10;
    }
    const main = parts.join(' ');
    const size = fitText(g, main, w - x - 110, 64, (s) => `600 ${s}px "Inter"`);
    g.font = `600 ${size}px "Inter"`;
    g.fillText(main, x, h * 0.54);
    x += g.measureText(main).width + 10;
    if (suffix) {
      g.font = '600 34px "Inter"';
      g.fillText(suffix, x, h * 0.42);
    }
    if (block) {
      g.textAlign = 'right';
      g.font = '600 26px "Inter"';
      g.fillText(block, w - 16, h * 0.5);
    }
  }, { lit: lit ? 1.4 : 0, rough: 0.35, weather: { grime: 0.2, fade: 0.15, rust: 0.05, scratches: 0.15 } });
  bladeCache.set(key, m);
  return m;
}

// Map a box's ±Z faces to the full texture (and the edges to a sliver) — for sign blades.
export function setBoxFaceUV(g) {
  const uv = g.attributes.uv;
  const nor = g.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nz = nor.getZ(i);
    // BoxGeometry already lays each face's U left→right as seen from outside, so the back face
    // reads correctly without flipping; only the thin edges get a sliver of the border colour.
    if (Math.abs(nz) < 0.5) uv.setXY(i, 0.01, 0.5);
  }
  uv.needsUpdate = true;
  return g;
}

function signalHead(M, axis) {
  // 3-section head with visors and a back plate with a reflective yellow border; faces local +Z.
  const out = [];
  out.push({ geo: box(0.36, 1.06, 0.26, 0, -0.55, 0), mat: M.black });
  out.push({ geo: box(0.62, 1.3, 0.02, 0, -0.55, -0.14), mat: M.black });
  out.push({ geo: box(0.66, 1.34, 0.012, 0, -0.55, -0.155), mat: M.signalYellow });
  out.push({ geo: box(0.04, 0.2, 0.04, 0, 0.05, 0), mat: M.galv });
  const cols = [0xff2a12, 0xffa516, 0x25ff8a];
  for (let i = 0; i < 3; i++) {
    const yy = -0.22 - i * 0.33;
    out.push({ geo: new THREE.CylinderGeometry(0.13, 0.13, 0.03, 20).rotateX(Math.PI / 2).translate(0, yy, 0.135), mat: lensMat(axis, i, cols[i]), cast: false });
    // Visor (open-bottom hood).
    out.push({ geo: new THREE.CylinderGeometry(0.15, 0.15, 0.26, 16, 1, true, -Math.PI / 2 - 1.3, 2.6 + Math.PI / 2).rotateX(Math.PI / 2).translate(0, yy, 0.27), mat: M.black });
  }
  // Heads hang facing local -Z (toward traffic approaching along the arm's right-hand side).
  for (const p of out) p.geo.rotateY(Math.PI);
  return out;
}

function pedHead(M, axis) {
  const out = [];
  out.push({ geo: box(0.4, 0.42, 0.22, 0, 0, 0.26), mat: M.black });
  out.push({ geo: box(0.44, 0.04, 0.2, 0, 0.23, 0.36), mat: M.black });
  out.push({ geo: new THREE.PlaneGeometry(0.15, 0.3).translate(-0.08, 0, 0.375), mat: lensMat(axis, 1, 0xff6a1a), cast: false, uv: 'keep' });
  out.push({ geo: new THREE.PlaneGeometry(0.15, 0.3).translate(0.08, 0, 0.375), mat: lensMat(axis, 0, 0xe8f4ff), cast: false, uv: 'keep' });
  return out;
}
