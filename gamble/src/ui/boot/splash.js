// Boot screen 2: LOADED DICE STUDIOS. Two ruby dice are thrown across green felt, bounce off the
// rail and land 6-6. Real Rapier physics: seeds are pre-simulated in a hidden world until one
// lands double six, the trajectory is recorded, then replayed frame-exact (with interpolation)
// alongside clacks timed to the recorded impacts. If no seed hits 6-6 within the budget, the
// best flat-landing roll is used and the dice faces are re-oriented so it still reads 6-6.

import * as THREE from 'three';
import { RAPIER } from '../../core/physics.js';
import { el, injectStyle } from '../../core/util.js';
import { t } from '../../core/i18n.js';
import { mat } from '../../gfx/materials.js';
import { worldUV, bevelBox } from '../../gfx/geom.js';
import { canvasTexture } from '../../gfx/textures.js';
import { Stage, wait, clamp01, ease, loadFonts } from '../three/stage.js';
import { diceAssets, diceGeometry, topFace, FACE_NORMALS, FACE_VALUES } from '../three/dice.js';
import { uiSound, vary } from '../sfx.js';

const SIZE = 1; // die edge (world units)
const G = -32; // gravity, tuned so the roll reads as a satisfying slow-ish tumble
const MAX_STEPS = 420;
const SIX = FACE_VALUES.indexOf(6);

// Table layout: dice are thrown from the left toward a back rail (−z) and a right rail (+x).
const RAIL_BACK_Z = -5.2;
const RAIL_RIGHT_X = 7.5;

function makeWorld() {
  const world = new RAPIER.World({ x: 0, y: G, z: 0 });
  world.timestep = 1 / 60;
  const fixed = (hx, hy, hz, x, y, z, restitution = 0.25) =>
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.8).setRestitution(restitution));
  fixed(40, 0.5, 40, 0, -0.5, 0, 0.2); // felt
  fixed(40, 2, 0.5, 0, 1.5, RAIL_BACK_Z - 0.5, 0.45); // back rail
  fixed(0.5, 2, 40, RAIL_RIGHT_X + 0.5, 1.5, 0, 0.45); // right rail
  return world;
}

function rngFrom(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Simulate one throw; returns recorded frames, impacts and final faces. */
function simulate(seed) {
  const rnd = rngFrom(seed);
  const world = makeWorld();
  const bodies = [0, 1].map((i) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(-9.5 - i * 1.3, 2.4 + i * 0.6 + rnd() * 0.5, 2.2 - i * 1.6 + rnd() * 0.6)
        .setRotation(q)
        .setLinvel(15 + rnd() * 4, 1 + rnd() * 2, -3.2 - rnd() * 2.5)
        .setAngvel({ x: (rnd() - 0.5) * 26, y: (rnd() - 0.5) * 18, z: -8 - rnd() * 14 })
        .setLinearDamping(0.15)
        .setAngularDamping(0.35)
        .setCcdEnabled(true),
    );
    world.createCollider(RAPIER.ColliderDesc.roundCuboid(SIZE / 2 - 0.1, SIZE / 2 - 0.1, SIZE / 2 - 0.1, 0.1).setDensity(1.2).setFriction(0.55).setRestitution(0.35), body);
    return body;
  });
  const frames = []; // per step: Float32Array(14) = 2 × (pos3 + quat4)
  const impacts = []; // {step, die, strength, kind}
  const lastV = bodies.map(() => ({ x: 0, y: 0, z: 0 }));
  let restSteps = 0;
  for (let step = 0; step < MAX_STEPS; step++) {
    world.step();
    const f = new Float32Array(14);
    bodies.forEach((b, i) => {
      const p = b.translation();
      const r = b.rotation();
      f.set([p.x, p.y, p.z, r.x, r.y, r.z, r.w], i * 7);
      // Impact detection from sudden velocity change: vertical flip = felt, horizontal = rail/die.
      const v = b.linvel();
      const dvy = v.y - lastV[i].y;
      const dvh = Math.hypot(v.x - lastV[i].x, v.z - lastV[i].z);
      if (step > 0 && (dvy > 2.2 || dvh > 3.5)) {
        const kind = dvh > dvy && (p.z < RAIL_BACK_Z + 1.2 || p.x > RAIL_RIGHT_X - 1.2) ? 'wall' : 'felt';
        const prev = impacts[impacts.length - 1];
        if (!prev || prev.die !== i || step - prev.step > 3) impacts.push({ step, die: i, strength: Math.min(1, Math.max(dvy, dvh) / 14), kind });
      }
      lastV[i] = { x: v.x, y: v.y, z: v.z };
    });
    frames.push(f);
    const asleep = bodies.every((b) => b.isSleeping() || (Math.hypot(...Object.values(b.linvel())) < 0.02 && Math.hypot(...Object.values(b.angvel())) < 0.05));
    restSteps = asleep ? restSteps + 1 : 0;
    if (restSteps > 20) break;
  }
  const finals = bodies.map((b) => {
    const r = b.rotation();
    const p = b.translation();
    return { ...topFace(new THREE.Quaternion(r.x, r.y, r.z, r.w)), x: p.x, z: p.z };
  });
  world.free();
  return { frames, impacts, finals, settled: restSteps > 20 };
}

/** Search seeds until a clean 6-6 (both dice flat, apart, in frame). */
function findRoll(maxTries = 48) {
  let fallback = null;
  const base = (Math.random() * 1e9) | 0;
  for (let i = 0; i < maxTries; i++) {
    const r = simulate(base + i * 7919);
    const ok = r.settled && r.finals.every((f) => f.flatness > 0.985 && f.x > -2 && f.x < RAIL_RIGHT_X - 0.6 && f.z > RAIL_BACK_Z + 0.6 && f.z < 3) &&
      Math.hypot(r.finals[0].x - r.finals[1].x, r.finals[0].z - r.finals[1].z) > 1.3;
    if (!ok) continue;
    if (r.finals.every((f) => f.value === 6)) return { ...r, offsets: [new THREE.Quaternion(), new THREE.Quaternion()] };
    fallback ||= r;
  }
  if (!fallback) return null;
  // Re-orient each die's faces so the face that lands on top is the six.
  const offsets = fallback.finals.map((f) => new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[SIX], FACE_NORMALS[f.face]));
  return { ...fallback, offsets };
}

// Gold layout printed on the felt (craps-style pass line), one transparent decal plane.
function feltPrint() {
  const tex = canvasTexture('ui-splash-print', 1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(236,206,128,0.85)';
    g.fillStyle = 'rgba(236,206,128,0.85)';
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(40, 60, w - 80, h - 120, 120);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(70, 90, w - 140, h - 180, 96);
    g.stroke();
    g.font = '700 64px "Playfair Display", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PASS LINE', w / 2, h - 128);
    g.font = 'italic 400 38px "Playfair Display", serif';
    g.fillText('pays even money', w / 2, h - 186);
    g.font = '400 30px "Bebas Neue", sans-serif';
    g.fillText('D O N \u2019 T   P A S S   B A R', w / 2, 140);
  });
  const geo = new THREE.PlaneGeometry(14, 7);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(0.5, 0.003, -1.6);
  m.rotation.y = 0.04;
  m.receiveShadow = true;
  return m;
}

const CSS = /* css */ `
.sp-name { position: absolute; left: 0; right: 0; bottom: calc(10% + var(--safe-bottom)); padding: 4% 0; text-align: center; pointer-events: none; color: #f6e7c1; font-size: calc(16px * var(--text-scale));
  background: radial-gradient(50% 50% at 50% 50%, rgba(2,12,6,.55), transparent 100%); opacity: 0; transition: opacity 1.2s ease; }
.sp-name.on { opacity: 1; }
.sp-name .a { font: 700 clamp(2em, 6.5vw, 3.6em)/1 var(--font-casino); letter-spacing: .14em; text-transform: uppercase; opacity: 0; filter: blur(8px);
  text-shadow: 0 2px 0 rgba(0,0,0,.6), 0 0 30px rgba(255,214,140,.25); transition: opacity 1.4s ease, filter 1.4s ease, letter-spacing 2.4s cubic-bezier(.2,.8,.2,1); }
.sp-name .b { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 12px; font: 400 clamp(.9em, 2.4vw, 1.2em)/1 var(--font-display); letter-spacing: .8em; color: #d7b56a; opacity: 0; transition: opacity 1.2s .5s ease; }
.sp-name .b::before, .sp-name .b::after { content: ''; width: 60px; height: 1px; background: currentColor; opacity: .6; }
.sp-name.on .a { opacity: 1; filter: blur(0); letter-spacing: .06em; }
.sp-name.on .b { opacity: 1; }
`;

/** Runs the splash on `stage` (a fresh Stage). Resolves when finished or skipped. */
export async function runSplash(engine, root, skip, host = {}) {
  injectStyle('gx-boot-splash', CSS);
  await loadFonts();
  const roll = findRoll();
  const stage = new Stage(engine, { fov: 34, background: 0x020202, envIntensity: 0.35 });
  host.stage = stage; // the boot state drives stage.update(dt)
  const { scene, camera, tier } = stage;

  // --- table: felt + padded leather rails with a brass strip
  const feltMat = mat('felt', { color: 0x11603c, dirt: 0.25, wear: 0.35 });
  const feltGeo = new THREE.PlaneGeometry(60, 40);
  feltGeo.rotateX(-Math.PI / 2);
  worldUV(feltGeo, feltMat.userData.tileMeters * 3);
  const felt = new THREE.Mesh(feltGeo, feltMat);
  felt.receiveShadow = true;
  scene.add(felt);
  const leather = mat('leather', { color: 0x3a1410 });
  // Rails meet in a corner (back rail runs to the right rail's outer edge).
  const backLen = RAIL_RIGHT_X + 1.4 + 30;
  const back = bevelBox(backLen, 1.6, 1.4, leather, { radius: 0.5, segments: 4 });
  back.position.set(RAIL_RIGHT_X + 1.4 - backLen / 2, 0.8, RAIL_BACK_Z - 0.7);
  const rightLen = 20 - (RAIL_BACK_Z - 1.4);
  const right = bevelBox(1.4, 1.6, rightLen, leather, { radius: 0.5, segments: 4 });
  right.position.set(RAIL_RIGHT_X + 0.7, 0.8, 20 - rightLen / 2);
  scene.add(back, right);
  scene.add(feltPrint());
  for (const m of [back, right]) {
    worldUV(m.geometry, leather.userData.tileMeters * 2);
    m.receiveShadow = m.castShadow = true;
  }

  // --- light: one warm pool from above, like a lamp over the table
  scene.add(new THREE.HemisphereLight(0x6b5a48, 0x050403, 0.35));
  const spot = new THREE.SpotLight(0xffe2b8, 900, 60, 0.55, 0.65, 2);
  spot.position.set(1.5, 18, 2);
  spot.target.position.set(2, 0, -1.5);
  spot.castShadow = tier.shadows;
  spot.shadow.mapSize.setScalar(Math.min(2048, tier.shadowMapSize));
  spot.shadow.bias = -0.0004;
  spot.shadow.radius = 4;
  scene.add(spot, spot.target);

  // --- dice
  const { material } = diceAssets();
  const geo = diceGeometry(SIZE);
  const dice = [0, 1].map((i) => {
    const holder = new THREE.Group();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    if (roll) m.quaternion.copy(roll.offsets[i]);
    holder.add(m);
    holder.visible = false;
    scene.add(holder);
    return holder;
  });

  const name = el('div', { class: 'sp-name' }, [el('div', { class: 'a', text: t('ui.splash.studio') }), el('div', { class: 'b', text: t('ui.splash.studios').toUpperCase() })]);
  root.appendChild(name);

  // Camera: high, looking down the felt toward where the dice will rest.
  const rest = roll ? new THREE.Vector3((roll.finals[0].x + roll.finals[1].x) / 2, 0.5, (roll.finals[0].z + roll.finals[1].z) / 2) : new THREE.Vector3(2, 0.5, -2);
  const camFrom = new THREE.Vector3(-1, 13, 11.5);
  const camTo = rest.clone().add(new THREE.Vector3(-0.2, 6.4, 3.4)); // high enough that the 6-6 reads
  const look = new THREE.Vector3();

  let elapsed = 0;
  let impactIdx = 0;
  const frames = roll?.frames || [];
  const done = new Promise((resolve) => {
    let named = false;
    stage.onUpdate((dt) => {
      elapsed += dt;
      const fpos = elapsed * 60;
      const i0 = Math.min(frames.length - 1, Math.floor(fpos));
      const i1 = Math.min(frames.length - 1, i0 + 1);
      const a = fpos - Math.floor(fpos);
      if (frames.length) {
        dice.forEach((d, k) => {
          d.visible = true;
          const f0 = frames[i0];
          const f1 = frames[i1];
          const o = k * 7;
          d.position.set(f0[o] + (f1[o] - f0[o]) * a, f0[o + 1] + (f1[o + 1] - f0[o + 1]) * a, f0[o + 2] + (f1[o + 2] - f0[o + 2]) * a);
          d.quaternion.set(f0[o + 3], f0[o + 4], f0[o + 5], f0[o + 6]).slerp(new THREE.Quaternion(f1[o + 3], f1[o + 4], f1[o + 5], f1[o + 6]), a);
        });
        while (roll && impactIdx < roll.impacts.length && roll.impacts[impactIdx].step <= i0) {
          const hit = roll.impacts[impactIdx++];
          uiSound(hit.kind === 'wall' ? 'dice.hit-wall' : 'dice.hit-felt', { gain: 0.25 + hit.strength * 0.75, rate: vary(0.1), bus: 'sfx' });
        }
      }
      // Slow push-in that settles over the resting dice.
      const ct = ease.inOutCubic(clamp01(elapsed / 5.5));
      look.lerpVectors(new THREE.Vector3(0, 0, -1), rest, ease.outCubic(clamp01(elapsed / 3.5)));
      camera.position.lerpVectors(camFrom, camTo, ct);
      // Portrait screens: pull back along the view so both dice stay in frame.
      if (camera.aspect < 1.2) camera.position.sub(look).multiplyScalar(Math.min(2.2, 1.2 / camera.aspect)).add(look);
      camera.lookAt(look);
      const settledAt = frames.length / 60;
      if (!named && elapsed > settledAt + 0.15) {
        named = true;
        uiSound('splash.dice-land', { bus: 'sfx' });
        name.classList.add('on');
      }
      if (elapsed > settledAt + 3.4) {
        resolve();
        return false;
      }
    });
  });
  uiSound('splash.dice-roll', { bus: 'sfx' });
  await Promise.race([done, wait(1e9, skip)]);
  await engine.fade(true, skip.requested ? 250 : 700);
  name.remove();
  stage.dispose();
  return stage;
}
