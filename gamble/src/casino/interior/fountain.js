// The Fountain of Fortune — our own design in the spirit of the Eldorado's bronze landmark:
// a round marble basin with eight bronze fish spouting into it, a fluted pedestal carrying a
// scalloped lower bowl whose overflow falls as a thin sheet all around, and three bronze figures
// standing back to back on its drum, arms raised, holding up a gilded upper bowl crowned by a
// golden coin. Six streams spill from the upper bowl's lips onto the lower bowl.
//
// Water moves: the pools use an animated normal field (travelling chop + ring ripples where every
// stream lands + foam), falling water is a scrolling-streak sheet, splashes and mist are GPU
// points updated on the CPU. People toss coins in (E on the rim: 25¢, a wish, a splash).
//
// The figures are real Humans (createHuman) posed with hand IK under the bowl and baked to a
// static bronze mesh — chunky like everyone else in Reno, cast in bronze.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHuman, randomHumanParams } from '../../character/index.js';
import { audio } from '../../core/audio.js';
import { t } from '../../core/i18n.js';
import { Rng } from '../../core/rng.js';
import { addCash, slice } from '../../life/state.js';
import { FLOOR_Y, FOUNTAIN } from '../layout.js';
import { insideOut } from './room.js';

const X = FOUNTAIN.x;
const Z = FOUNTAIN.z;
const F = FLOOR_Y;
const R_BASIN = FOUNTAIN.basinR; // outer wall
const R_IN = R_BASIN - 0.5; // inner wall
const Y_WATER = F + 0.42;
const Y_RIM = F + 0.58;
const R_BOWL = 2.3;
const Y_BOWL = F + 1.62; // lower bowl rim
const Y_DRUM = F + 1.78; // figures stand here
const R_UP = 1.15;
const Y_UP = F + 3.98; // upper bowl rim
const DROPS = 14;

export function buildFountain(C) {
  const { M, add, colliders, group, interactables, updaters, tier } = C;
  const rng = new Rng('fountain');
  const lathe = (pts, seg = 64) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg).translate(X, 0, Z);

  // ---- basin ----
  add(new THREE.CylinderGeometry(R_BASIN + 0.12, R_BASIN + 0.14, 0.14, 96).translate(X, F + 0.07, Z), M.marbleDark);
  add(new THREE.CylinderGeometry(R_BASIN, R_BASIN, Y_RIM - F - 0.1, 96, 1, true).translate(X, (F + 0.14 + Y_RIM - 0.08) / 2, Z), M.marbleSlab);
  add(new THREE.TorusGeometry(R_BASIN + 0.005, 0.025, 6, 128).rotateX(Math.PI / 2).translate(X, F + 0.3, Z), M.gold, { castShadow: false });
  // Rounded rim cap (red marble), wide enough to sit on.
  const cap = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    cap.push([R_IN + 0.25 + Math.cos(Math.PI - a) * 0.3, Y_RIM - 0.06 + Math.sin(a) * 0.07]);
  }
  add(lathe([[R_IN - 0.02, Y_RIM - 0.1], ...cap, [R_BASIN + 0.06, Y_RIM - 0.1]], 128), M.marbleRed);
  add(insideOut(new THREE.CylinderGeometry(R_IN, R_IN, Y_RIM - F - 0.1, 96, 1, true)).translate(X, (F + Y_RIM - 0.1) / 2, Z), M.marbleSlab, { castShadow: false });
  // Mosaic floor under the water.
  add(new THREE.CircleGeometry(R_IN, 96).rotateX(-Math.PI / 2).translate(X, F + 0.03, Z), mosaicMat(), { uv: 'keep', castShadow: false });
  // The rim collider owns the coin-toss interaction (the view ray hits the rim you're facing).
  const it = { id: 'eldorado-fountain', kind: 'talk', radius: 0.8, reach: 2.4, describe: () => t('casino.it.fountain') };
  colliders.cylinder(X, F, Z, R_BASIN + 0.1, Y_RIM - F, { owner: it });

  // ---- pedestal, lower bowl, drum ----
  add(lathe([[0.75, F], [0.8, F + 0.1], [0.62, F + 0.2], [0.5, F + 0.5], [0.46, F + 0.9], [0.52, F + 1.0], [0.42, F + 1.08], [0.6, F + 1.18], [0.0, F + 1.2]]), M.marbleSlab);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.035, 0.36, 0.03).translate(0.475, F + 0.68, 0).rotateY(a).translate(X, 0, Z), M.marbleDark, { castShadow: false });
  }
  // Scalloped bowl: lathe with a gilded lip and 16 shells around the outside.
  add(lathe([[0.3, F + 1.08], [0.9, F + 1.12], [1.6, F + 1.3], [2.1, F + 1.48], [R_BOWL, Y_BOWL - 0.02], [R_BOWL + 0.05, Y_BOWL], [R_BOWL - 0.08, Y_BOWL + 0.02], [R_BOWL - 0.12, Y_BOWL - 0.1], [1.0, F + 1.35], [0.0, F + 1.32]], 96), M.marbleSlab);
  add(new THREE.TorusGeometry(R_BOWL + 0.02, 0.035, 8, 128).rotateX(Math.PI / 2).translate(X, Y_BOWL - 0.005, Z), M.gold, { castShadow: false });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const shell = new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 0.7).rotateX(-Math.PI / 2 + 0.5);
    add(shell.translate(0, F + 1.4, -1.95).rotateY(a).translate(X, 0, Z), M.gold, { castShadow: false });
  }
  add(lathe([[0.82, Y_BOWL - 0.25], [0.82, Y_DRUM - 0.04], [0.88, Y_DRUM - 0.02], [0.86, Y_DRUM], [0.0, Y_DRUM]], 48), M.marbleRed);
  add(new THREE.TorusGeometry(0.86, 0.03, 6, 64).rotateX(Math.PI / 2).translate(X, Y_DRUM - 0.03, Z), M.gold, { castShadow: false });
  colliders.cylinder(X, F, Z, R_BOWL + 0.25, 5.0);

  // ---- central column + upper bowl + coin finial ----
  add(lathe([[0.22, Y_DRUM], [0.18, Y_DRUM + 0.3], [0.16, Y_UP - 0.6], [0.24, Y_UP - 0.42], [0.0, Y_UP - 0.4]], 32), M.gold);
  add(lathe([[0.2, Y_UP - 0.42], [0.55, Y_UP - 0.36], [0.95, Y_UP - 0.2], [R_UP, Y_UP - 0.03], [R_UP + 0.04, Y_UP], [R_UP - 0.06, Y_UP + 0.01], [R_UP - 0.1, Y_UP - 0.08], [0.0, Y_UP - 0.14]], 64), M.gold);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    add(new THREE.BoxGeometry(0.16, 0.04, 0.22).translate(0, Y_UP - 0.02, -R_UP - 0.07).rotateY(-a).translate(X, 0, Z), M.gold);
  }
  add(lathe([[0.12, Y_UP - 0.1], [0.12, Y_UP + 0.25], [0.2, Y_UP + 0.3], [0.0, Y_UP + 0.32]], 24), M.gold);
  const coin = new THREE.CylinderGeometry(0.42, 0.42, 0.07, 48).rotateX(Math.PI / 2).translate(X, Y_UP + 0.74, Z);
  add(coin, M.gold);
  add(new THREE.TorusGeometry(0.42, 0.03, 8, 48).translate(X, Y_UP + 0.74, Z), M.gold);
  add(new THREE.PlaneGeometry(0.7, 0.7).translate(X, Y_UP + 0.74, Z + 0.037), coinFaceMat(), { uv: 'keep', castShadow: false });
  add(new THREE.PlaneGeometry(0.7, 0.7).rotateY(Math.PI).translate(X, Y_UP + 0.74, Z - 0.037), coinFaceMat(), { uv: 'keep', castShadow: false });

  // ---- bronze figures ----
  const fig = bakeFigures(rng, tier);
  if (fig) add(fig, M.bronze, { uv: 0.8 });

  // ---- fish spouts on the rim ----
  const spouts = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const base = new THREE.Vector3(X, 0, Z).addScaledVector(dir, R_IN + 0.18);
    const g = fishGeometry().rotateY(Math.atan2(-dir.x, -dir.z)).translate(base.x, Y_RIM + 0.02, base.z);
    add(g, M.bronze, { uv: 0.4 });
    const mouth = base.clone().addScaledVector(dir, -0.36).setY(Y_RIM + 0.26);
    spouts.push({ mouth, dir: dir.clone().negate() });
  }

  // ---- water ----
  const waterMat = waterSurfaceMat();
  const fallMat = fallingWaterMat();
  const wGroup = new THREE.Group();
  wGroup.name = 'fountain-water';
  const surf = [
    new THREE.RingGeometry(0.0, R_IN, 96, 4).rotateX(-Math.PI / 2).translate(X, Y_WATER, Z),
    new THREE.RingGeometry(0.85, R_BOWL - 0.06, 96, 2).rotateX(-Math.PI / 2).translate(X, Y_BOWL - 0.035, Z),
    new THREE.CircleGeometry(R_UP - 0.07, 48).rotateX(-Math.PI / 2).translate(X, Y_UP - 0.03, Z),
  ];
  const surfMesh = new THREE.Mesh(mergeGeometries(surf.map((g) => (g.index ? g.toNonIndexed() : g)), false), waterMat);
  surfMesh.renderOrder = 1;
  wGroup.add(surfMesh);
  // Overflow sheet around the lower bowl (flares out a little as it falls).
  const sheet = new THREE.CylinderGeometry(R_BOWL + 0.06, R_BOWL + 0.2, Y_BOWL - Y_WATER, 96, 6, true).translate(X, (Y_BOWL + Y_WATER) / 2, Z);
  bendSheet(sheet, Y_BOWL, Y_WATER);
  const sheetMesh = new THREE.Mesh(sheet, fallMat);
  sheetMesh.renderOrder = 2;
  wGroup.add(sheetMesh);
  // Streams: six from the upper bowl's lips, eight from the fish.
  const streams = [];
  const landings = [];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    const dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a));
    const p0 = new THREE.Vector3(X, Y_UP - 0.01, Z).addScaledVector(dir, R_UP + 0.14);
    const land = new THREE.Vector3(X, Y_BOWL - 0.03, Z).addScaledVector(dir, 1.75);
    streams.push(arcTube(p0, land, 0.35, 0.035, 0.05));
    landings.push(land);
  }
  for (const s of spouts) {
    const land = new THREE.Vector3(X, Y_WATER, Z).addScaledVector(s.dir.clone().negate(), 2.95);
    streams.push(arcTube(s.mouth, land, 0.55, 0.022, 0.03));
    landings.push(land);
  }
  const streamMesh = new THREE.Mesh(mergeGeometries(streams, false), fallMat);
  streamMesh.renderOrder = 2;
  wGroup.add(streamMesh);
  group.add(wGroup);
  // Ripple sources for the surface shader: stream landings + points along the sheet's foot.
  const drops = waterMat.userData.uniforms.uDrops.value;
  landings.slice(0, DROPS - 2).forEach((l, i) => drops[i].set(l.x, l.z, 0.9));
  drops[DROPS - 2].set(X + R_BOWL + 0.2, Z, 0.4);
  drops[DROPS - 1].set(X - R_BOWL - 0.2, Z, 0.4);

  // ---- coins on the bottom ----
  const coins = new Coins(group, rng, C.M);

  // ---- splashes & mist ----
  const spray = new Spray(group, tier, rng);
  for (const l of landings) spray.emitter(l, 1);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    spray.emitter(new THREE.Vector3(X + Math.cos(a) * (R_BOWL + 0.2), Y_WATER, Z + Math.sin(a) * (R_BOWL + 0.2)), 0.35);
  }

  // ---- sound + interaction ----
  let loop = null;
  let tries = 0;
  const center = new THREE.Vector3(X, F + 1.0, Z);
  updaters.push((dt, ctx, st) => {
    const time = st.time;
    waterMat.userData.uniforms.uTime.value = time;
    fallMat.uniforms.uTime.value = time;
    const v = ctx.camera?.position || ctx.viewer;
    const near = v ? v.distanceTo(center) : 99;
    const active = near < 45 && C.group.visible;
    wGroup.visible = active;
    if (active) spray.update(dt, near);
    else spray.points.visible = false;
    coins.update(dt);
    // Water sound: one positional loop (the generator is defined in sounds.js).
    if (!loop && audio.unlocked && tries < 3 && near < 60) {
      tries++;
      try {
        loop = audio.play(audio.generators?.has?.('casino.fountain') ? 'casino.fountain' : 'water.run', { bus: 'ambience', loop: true, gain: 0, position: { x: X, y: F + 1.2, z: Z }, refDistance: 4.5, rolloff: 1.1, maxDistance: 70, reverb: 0.5 });
      } catch {
        loop = null;
      }
    }
    loop?.setGain?.(st.inside > 0.3 && near < 60 ? 0.9 : 0, 0.6);
  });
  // Fallback focus point (touch taps / no collider hit): the rim point nearest the player.
  const rimPt = new THREE.Vector3();
  Object.defineProperty(it, 'position', {
    get() {
      const p = C.lastPlayer;
      if (!p) return rimPt.set(X + R_BASIN, Y_RIM + 0.2, Z);
      const dx = p.x - X;
      const dz = p.z - Z;
      const r = Math.hypot(dx, dz) || 1;
      return rimPt.set(X + (dx / r) * R_BASIN, Y_RIM + 0.2, Z + (dz / r) * R_BASIN);
    },
  });
  Object.assign(it, {
    onInteract(player) {
      const m = slice('money');
      if (!(m.cash >= 0.25) || !addCash(-0.25, 'fountain-wish')) {
        C.toast?.(t('casino.msg.coinBroke'));
        return false;
      }
      player?.human?.play?.('toss-chips', { speed: 1.2 });
      // The coin flies from the hand toward the water near the player.
      const from = player?.position ? player.position.clone().setY(F + 1.3) : new THREE.Vector3(X + R_BASIN, F + 1.3, Z);
      const dir = new THREE.Vector3(X - from.x, 0, Z - from.z).normalize();
      const land = new THREE.Vector3(X, Y_WATER, Z).addScaledVector(dir, -(R_IN - 0.6 - Math.random() * 0.9));
      coins.toss(from, land, () => {
        spray.burst(land, 18);
        sfx('coins.drop', land, 0.5, 1.4);
      });
      sfx('coins.drop', from, 0.25, 1.8);
      C.toast?.(t('casino.msg.coin'));
      return true;
    },
  });
  interactables.push(it);
  return { center, it };
}

function sfx(name, p, gain = 0.6, rate = 1) {
  try {
    audio.play(name, { bus: 'sfx', gain, rate: rate * (0.94 + Math.random() * 0.12), position: { x: p.x, y: p.y, z: p.z }, refDistance: 2 });
  } catch {
    /* locked */
  }
}

// ---- statues ------------------------------------------------------------------------------

/** Three people posed under the bowl, baked to one static mesh (world space). */
function bakeFigures(rng, tier) {
  const geos = [];
  const looks = [
    { sex: 'f', age: 30, fat: 0.35, height: 1.72, top: 'dress', hair: 'bun' },
    { sex: 'm', age: 42, fat: 0.45, height: 1.82, top: 'tank' },
    { sex: 'f', age: 58, fat: 0.6, height: 1.66, top: 'dress' },
  ];
  for (let k = 0; k < 3; k++) {
    let h = null;
    try {
      const params = randomHumanParams(new Rng(`fountain-figure-${k}`), { ...looks[k], hair: undefined, outer: 'none', hat: 'none', glasses: 'none' });
      h = createHuman(params, { tier: tier?.name === 'low' ? 'low' : 'medium' });
      const a = (k / 3) * Math.PI * 2 + 0.3;
      const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const tan = new THREE.Vector3(out.z, 0, -out.x);
      h.root.position.set(X, Y_DRUM, Z).addScaledVector(out, 0.36);
      h.root.rotation.y = a;
      h.root.updateMatrixWorld(true);
      // Arms up under the bowl, a little outward; the head tilts up toward it.
      const hand = (s) => new THREE.Vector3(X, Y_UP - 0.36, Z).addScaledVector(out, 0.48).addScaledVector(tan, s * 0.24);
      h.setHandTarget('L', hand(1));
      h.setHandTarget('R', hand(-1));
      h.lookAt(new THREE.Vector3(X, Y_UP + 1.2, Z).addScaledVector(out, 1.2));
      for (let i = 0; i < 40; i++) h.update(1 / 30);
      h.root.updateMatrixWorld(true);
      geos.push(...bakeHuman(h));
    } catch (e) {
      console.warn('[casino] fountain figure failed', e);
    } finally {
      h?.dispose?.();
    }
  }
  if (!geos.length) return null;
  let g = mergeGeometries(geos, false);
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  void rng;
  return g;
}

function bakeHuman(h) {
  const out = [];
  const v = new THREE.Vector3();
  h.root.traverse((m) => {
    if (!m.isMesh || Array.isArray(m.material)) return;
    if (m.material.transparent || m.material.alphaTest > 0 || m === h.mouth) return;
    const src = m.geometry;
    const pos = src.attributes.position;
    if (!pos || pos.count < 60) return;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      m.getVertexPosition(i, v);
      v.applyMatrix4(m.matrixWorld);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    if (src.index) g.setIndex(Array.from(src.index.array));
    out.push(g.index ? g.toNonIndexed() : g);
  });
  return out;
}

function fishGeometry() {
  // Stylised dolphin-fish leaping out of the rim: lathe body bent along a curve + tail fan.
  const parts = [];
  const body = new THREE.LatheGeometry([[0, -0.32], [0.07, -0.26], [0.12, -0.12], [0.13, 0.02], [0.1, 0.16], [0.06, 0.26], [0.035, 0.32], [0.05, 0.34], [0.0, 0.35]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  // Bend: rotate rings progressively so the fish arches up and points inward.
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const a = (y + 0.32) * 1.6;
    const r = p.getZ(i);
    p.setXYZ(i, p.getX(i), y * Math.cos(a * 0.5) - r * Math.sin(a * 0.5) + 0.12, r * Math.cos(a * 0.5) + y * Math.sin(a * 0.5));
  }
  body.computeVertexNormals();
  body.rotateX(-Math.PI / 2 + 0.5);
  parts.push(body.index ? body.toNonIndexed() : body);
  const tail = new THREE.ConeGeometry(0.14, 0.18, 3).scale(1, 1, 0.25).rotateX(Math.PI).translate(0, 0.02, 0.32);
  parts.push(tail.index ? tail.toNonIndexed() : tail);
  return mergeGeometries(parts, false);
}

/** Parabolic stream as a tube from p0 to p1 with apex `lift` above p0. */
function arcTube(p0, p1, lift, r0, r1) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    const p = p0.clone().lerp(p1, u);
    p.y = p0.y + (p1.y - p0.y) * u * u + lift * 4 * u * (1 - u) * 0.6;
    pts.push(p);
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 1, 6, false);
  // Taper: thin at the lip, thicker as it falls and spreads.
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const c = new THREE.CatmullRomCurve3(pts);
  const pp = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    c.getPointAt(Math.min(1, u), pp);
    q.fromBufferAttribute(pos, i).sub(pp);
    const r = r0 + (r1 - r0) * u;
    q.multiplyScalar(r);
    pos.setXYZ(i, pp.x + q.x, pp.y + q.y, pp.z + q.z);
  }
  g.computeVertexNormals();
  return g.index ? g.toNonIndexed() : g;
}

function bendSheet(g, yTop, yBot) {
  // Water leaving a lip shoots out a little before dropping: push the upper third outward.
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const u = (yTop - y) / (yTop - yBot); // 0 top … 1 bottom
    const dx = p.getX(i) - X;
    const dz = p.getZ(i) - Z;
    const r = Math.hypot(dx, dz);
    const push = 0.08 * Math.sin(Math.min(1, u * 2.2) * Math.PI * 0.5) * (1 - u * 0.3);
    p.setX(i, X + (dx / r) * (r + push));
    p.setZ(i, Z + (dz / r) * (r + push));
  }
  g.computeVertexNormals();
}

// ---- materials -----------------------------------------------------------------------------

const GLSL_NOISE = /* glsl */ `
  float fhash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fhash(i), fhash(i + vec2(1.0, 0.0)), f.x), mix(fhash(i + vec2(0.0, 1.0)), fhash(i + vec2(1.0, 1.0)), f.x), f.y);
  }`;

function waterSurfaceMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0x0f3436, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.74, envMapIntensity: 0.7, depthWrite: false });
  const uniforms = { uTime: { value: 0 }, uDrops: { value: Array.from({ length: DROPS }, () => new THREE.Vector3()) } };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        uniform float uTime;
        uniform vec3 uDrops[${DROPS}];
        ${GLSL_NOISE}
        vec3 waterField(vec2 p, float t) {
          vec2 g = vec2(0.0);
          float foam = 0.0;
          vec2 k1 = vec2(3.1, 1.2); g += 0.012 * cos(dot(k1, p) - 2.3 * t) * k1;
          vec2 k2 = vec2(-1.7, 2.9); g += 0.010 * cos(dot(k2, p) - 2.9 * t) * k2;
          vec2 k3 = vec2(5.3, -4.1); g += 0.006 * cos(dot(k3, p) - 4.4 * t) * k3;
          vec2 k4 = vec2(-7.7, -6.2); g += 0.004 * cos(dot(k4, p) - 6.1 * t) * k4;
          for (int i = 0; i < ${DROPS}; i++) {
            vec3 d = uDrops[i];
            vec2 q = p - d.xy;
            float r = length(q) + 1e-3;
            float e = exp(-r * 1.4) * d.z;
            g += e * 0.045 * cos(r * 24.0 - t * 10.0 + float(i) * 1.7) * 24.0 * (q / r);
            foam += exp(-r * 4.0) * d.z * (0.6 + 0.4 * fnoise(q * 18.0 + t * 3.0));
          }
          return vec3(g, foam);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wf = waterField(vWPos.xz, uTime);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.94), clamp(wf.z, 0.0, 1.0) * 0.75);
        diffuseColor.a = mix(diffuseColor.a, 0.95, clamp(wf.z, 0.0, 1.0));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 nW = normalize(vec3(-wf.x, 1.0, -wf.y));
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);`);
  };
  m.customProgramCacheKey = () => 'casino-water-surface';
  m.name = 'fountain-water';
  return m;
}

function fallingWaterMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      ${GLSL_NOISE}
      void main() {
        // Tubes flow along u; the sheet (cylinder) flows down v. Detect by the uv range use:
        float along = vUv.x;
        float across = vUv.y;
        #ifdef SHEET
        #endif
        float flow = along * 9.0 - uTime * 2.6;
        float s1 = fnoise(vec2(across * 40.0, flow * 2.0));
        float s2 = fnoise(vec2(across * 90.0 + 7.0, flow * 4.5 - uTime));
        float streak = smoothstep(0.35, 0.95, s1 * 0.6 + s2 * 0.5);
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        vec3 deep = vec3(0.22, 0.36, 0.36);
        vec3 col = mix(deep, vec3(0.95, 0.96, 0.92), streak * 0.65 + fres * 0.3);
        float a = 0.025 + streak * 0.3 + fres * 0.28;
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

function mosaicMat() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const rng = new Rng('mosaic');
  g.fillStyle = '#1d5a5a';
  g.fillRect(0, 0, 1024, 1024);
  const cx = 512;
  // Tesserae in concentric rings: teal field, gold sunburst, deep blue border.
  for (let r = 8; r < 512; r += 9) {
    const n = Math.floor((Math.PI * 2 * r) / 9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ray = Math.abs(Math.sin(a * 8)) > 0.86 && r < 380;
      const ring = (r > 420 && r < 450) || (r > 160 && r < 175);
      let col = ray ? [200 + rng.int(0, 40), 160 + rng.int(0, 30), 60] : ring ? [180, 140, 50] : r > 460 ? [20, 40, 70] : [20 + rng.int(0, 25), 80 + rng.int(0, 30), 85 + rng.int(0, 25)];
      g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      g.save();
      g.translate(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
      g.rotate(a);
      g.fillRect(-3.6, -3.6, 7.2, 7.2);
      g.restore();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
  m.name = 'fountain-mosaic';
  return m;
}

let coinFace = null;
function coinFaceMat() {
  if (coinFace) return coinFace;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  const gr = g.createRadialGradient(110, 100, 10, 128, 128, 120);
  gr.addColorStop(0, '#fff2b8');
  gr.addColorStop(0.6, '#e2b24a');
  gr.addColorStop(1, '#9a6a1c');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8a5a14';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.stroke();
  // A star and an E for Eldorado, struck in relief.
  g.fillStyle = '#b8862e';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 26 : 62;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r);
  }
  g.fill();
  g.font = '700 54px "Playfair Display"';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff0c0';
  g.fillText('E', 128, 134);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  coinFace = new THREE.MeshStandardMaterial({ map: tex, metalness: 1, roughness: 0.25, transparent: true, alphaTest: 0.5 });
  coinFace.name = 'fountain-coin-face';
  return coinFace;
}

// ---- coins in the water -------------------------------------------------------------------

class Coins {
  constructor(group, rng, M) {
    this.max = 420;
    this.n = 0;
    const g = new THREE.CylinderGeometry(0.0121, 0.0121, 0.0018, 14);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc8c4bc, metalness: 1, roughness: 0.3 });
    mat.name = 'fountain-coins';
    this.mesh = new THREE.InstancedMesh(g, mat, this.max);
    this.mesh.name = 'fountain-coins';
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < 300; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.range(0.03, 1)) * (R_IN - 0.15);
      if (r < 0.85) continue;
      this._put(m4, X + Math.cos(a) * r, F + 0.035 + rng.range(0, 0.004), Z + Math.sin(a) * r, rng);
      col.set(rng.chance(0.7) ? 0xc9c6bf : rng.chance(0.5) ? 0xb8763a : 0xd8b860).multiplyScalar(rng.range(0.6, 1));
      this.mesh.setColorAt(this.n - 1, col);
    }
    this.mesh.count = this.n;
    this.mesh.computeBoundingSphere();
    this.mesh.boundingSphere.radius = R_BASIN;
    group.add(this.mesh);
    this.flying = [];
    this.rng = rng;
    void M;
  }

  _put(m4, x, y, z, rng, tilt = 0.25) {
    if (this.n >= this.max) return -1;
    m4.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-tilt, tilt), rng.range(0, 6.28), rng.range(-tilt, tilt))), new THREE.Vector3(1, 1, 1));
    this.mesh.setMatrixAt(this.n, m4);
    this.n++;
    this.mesh.instanceMatrix.needsUpdate = true;
    return this.n - 1;
  }

  toss(from, land, onSplash) {
    const i = this._put(new THREE.Matrix4(), from.x, from.y, from.z, this.rng, 3);
    if (i < 0) return;
    this.mesh.count = this.n;
    this.mesh.setColorAt(i, new THREE.Color(0xd2cec6));
    this.mesh.instanceColor.needsUpdate = true;
    this.flying.push({ i, from: from.clone(), land, t: 0, dur: 0.75, onSplash, sinking: false });
  }

  update(dt) {
    if (!this.flying.length) return;
    const m4 = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (const f of this.flying) {
      f.t += dt;
      if (!f.sinking) {
        const u = Math.min(1, f.t / f.dur);
        p.copy(f.from).lerp(f.land, u);
        p.y = f.from.y + (f.land.y - f.from.y) * u + Math.sin(u * Math.PI) * 0.7;
        q.setFromEuler(new THREE.Euler(f.t * 22, f.t * 5, 0));
        if (u >= 1) {
          f.sinking = true;
          f.t = 0;
          f.onSplash?.();
        }
      } else {
        // Flutters down to the mosaic.
        const u = Math.min(1, f.t / 1.6);
        p.copy(f.land).setY(Y_WATER + (F + 0.036 - Y_WATER) * (1 - (1 - u) * (1 - u)));
        p.x += Math.sin(f.t * 9) * 0.02 * (1 - u);
        q.setFromEuler(new THREE.Euler(Math.sin(f.t * 7) * 0.6 * (1 - u), f.t, 0));
        if (u >= 1) f.done = true;
      }
      m4.compose(p, q, new THREE.Vector3(1, 1, 1));
      this.mesh.setMatrixAt(f.i, m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.flying = this.flying.filter((f) => !f.done);
  }
}

// ---- spray particles ------------------------------------------------------------------------

class Spray {
  constructor(group, tier, rng) {
    const scale = tier?.particlesScale ?? ({ low: 0.35, medium: 0.6, high: 1, ultra: 1.4 }[tier?.name] ?? 0.6);
    this.n = Math.round(700 * scale);
    this.rng = rng;
    this.pos = new Float32Array(this.n * 3);
    this.vel = new Float32Array(this.n * 3);
    this.life = new Float32Array(this.n);
    this.max = new Float32Array(this.n);
    this.size = new Float32Array(this.n);
    this.alpha = new Float32Array(this.n);
    this.emitters = [];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(X, F + 2, Z), 7);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha; varying float vA; uniform float uScale;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / max(0.5, -mv.z);
          vA = aAlpha;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float a = smoothstep(0.5, 0.15, d) * vA;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vec3(0.93, 0.97, 1.0) * 1.15, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.name = 'fountain-spray';
    this.points.renderOrder = 4;
    group.add(this.points);
    this.geo = g;
    this.cursor = 0;
    this.acc = 0;
  }

  emitter(p, rate) {
    this.emitters.push({ p: p.clone(), rate });
  }

  _spawn(p, up = 1, spread = 0.9, big = false) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.n;
    const r = this.rng;
    this.pos[i * 3] = p.x + r.range(-0.08, 0.08);
    this.pos[i * 3 + 1] = p.y + 0.02;
    this.pos[i * 3 + 2] = p.z + r.range(-0.08, 0.08);
    this.vel[i * 3] = r.range(-spread, spread);
    this.vel[i * 3 + 1] = r.range(0.8, 2.2) * up;
    this.vel[i * 3 + 2] = r.range(-spread, spread);
    this.max[i] = big ? r.range(1.2, 2.2) : r.range(0.35, 0.7);
    this.life[i] = this.max[i];
    this.size[i] = big ? r.range(0.25, 0.5) : r.range(0.012, 0.03);
  }

  burst(p, n) {
    for (let k = 0; k < n; k++) this._spawn(p, 1.3, 1.1);
  }

  update(dt, dist) {
    this.points.visible = true;
    // Fewer particles when far (you can't see individual drops past ~25 m).
    const k = dist < 18 ? 1 : dist < 30 ? 0.5 : 0.2;
    this.acc += dt * this.n * 1.6 * k;
    while (this.acc > 1) {
      this.acc -= 1;
      const e = this.emitters[Math.floor(this.rng.next() * this.emitters.length)];
      if (this.rng.next() > e.rate) continue;
      const mist = this.rng.next() < 0.08;
      this._spawn(e.p, mist ? 0.25 : 1, mist ? 0.25 : 0.9, mist);
    }
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const big = this.size[i] > 0.1;
      this.vel[i * 3 + 1] -= (big ? 0.3 : 9.8) * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (big) this.size[i] += dt * 0.15;
      const u = this.life[i] / this.max[i];
      this.alpha[i] = big ? Math.sin(u * Math.PI) * 0.09 : Math.min(1, u * 3) * 0.75;
      if (!big && this.pos[i * 3 + 1] < Y_WATER - 0.02) this.life[i] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
  }
}
