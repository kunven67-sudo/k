// Slot banks (lane C). createSlotBank builds a row (or back-to-back double row) of Silverlode
// machines of one theme: cabinet statics merged per material for the whole bank, deck buttons /
// stools / stepper drums / levers instanced, one LED material for every edge strip and candle, a
// shared lit bank sign, per-machine screens (shared attract texture while idle), colliders.
//
//   createSlotBank({ engine, physics, tier, casino, id, theme, count, arrangement, position, yaw, rng, denom })
//     → { group, machines, interactables, update(dt, ctx), dispose(), footprint }
//   machine.seatNpc(human) / machine.unseatNpc()
//
// Local frame: machines face +Z (player side), the bank origin is on the machines' front plane
// (row) or on the spine between the two rows (back-to-back). See ../CONTRACT.md.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat } from '../../gfx/materials.js';
import { PartBag, normalizeGeo, matrixOf } from './cabinet/parts.js';
import { buildVideoCabinet } from './cabinet/video.js';
import { buildStepperCabinet, STEPPER_DIM } from './cabinet/stepper.js';
import { stoolGeometries, STOOL } from './cabinet/stool.js';
import { ledMaterial, ledAttrs, buttonMaterial, cabinetMats, THEME_LOOK, DENOM_CANDLE, MAX_MACHINES } from './cabinet/materials.js';
import { logoTexture, bellyTexture, clubDisplayTexture, buttonAtlas, bankSignTexture, drawLogo } from './art/signage.js';
import { createDrums, STRIP_COLUMN, MeterAtlas, topGlassTexture } from './reels3d.js';
import { attractScreen, tickAttracts } from './screen.js';
import { SlotMachine } from './machine.js';
import './strings.js';

export const PITCH = 0.78;
const SEAT_Z = 0.48; // feet when seated / standing spot (between the deck and the stool)
const STOOL_Z = 0.64;
const BACK_HALF = 0.62; // back-to-back: each row's front plane is this far from the spine

const CAMS = {
  // Over the seated player's head (hands on the deck stay in view), looking down at the deck and
  // up the screen; phones in portrait step back so the whole face of the machine fits.
  video: {
    pos: new THREE.Vector3(0.24, 1.86, 1.12),
    target: new THREE.Vector3(0, 1.4, -0.12),
    posNarrow: new THREE.Vector3(0.08, 2.0, 1.75),
    targetNarrow: new THREE.Vector3(0, 1.38, -0.1),
    screenPos: new THREE.Vector3(0.03, 1.66, 0.6),
    screenPosNarrow: new THREE.Vector3(0.0, 1.62, 0.98),
    screenTarget: new THREE.Vector3(0, 1.52, -0.11),
  },
  stepper: {
    pos: new THREE.Vector3(0.26, 1.72, 1.02),
    target: new THREE.Vector3(0.02, 1.26, -0.06),
    posNarrow: new THREE.Vector3(0.08, 1.9, 1.6),
    targetNarrow: new THREE.Vector3(0, 1.18, -0.05),
    screenPos: new THREE.Vector3(0.0, 1.38, 0.5),
    screenPosNarrow: new THREE.Vector3(0.0, 1.4, 0.82),
    screenTarget: new THREE.Vector3(0, 1.22, -0.05),
  },
};

const tierName = (tier) => (typeof tier === 'string' ? tier : tier?.name) || 'high';

export function createSlotBank({ engine, physics, tier, casino = 'eldorado', id = 'bank', theme = 'wild-west', count = 6, arrangement = 'row', position = new THREE.Vector3(), yaw = 0, rng = null, denom }) {
  const T = tierName(tier ?? engine?.tier);
  const stepper = theme === 'classic-fruit';
  denom ??= stepper ? 0.25 : 0.01;
  count = Math.max(1, Math.min(MAX_MACHINES - 1, count | 0));
  const group = new THREE.Group();
  group.name = `slots:${id}`;
  group.position.copy(position);
  group.rotation.y = yaw;
  group.updateMatrixWorld(true);

  // ---- layout -------------------------------------------------------------------------------------
  const places = []; // { x, z, ry, row }
  if (arrangement === 'back-to-back' && count > 1) {
    const nA = Math.ceil(count / 2);
    const nB = count - nA;
    for (let i = 0; i < nA; i++) places.push({ x: (i - (nA - 1) / 2) * PITCH, z: BACK_HALF, ry: 0, row: 0 });
    for (let i = 0; i < nB; i++) places.push({ x: -(i - (nB - 1) / 2) * PITCH, z: -BACK_HALF, ry: Math.PI, row: 1 });
  } else for (let i = 0; i < count; i++) places.push({ x: (i - (count - 1) / 2) * PITCH, z: 0, ry: 0, row: 0 });
  const rows = arrangement === 'back-to-back' && count > 1 ? 2 : 1;
  const perRow = Math.ceil(count / rows);
  const rowW = perRow * PITCH + 0.12;

  // ---- cabinets (built once per bank, shared by every machine) ---------------------------------------
  const denomColor = DENOM_CANDLE[denom] ?? 0xffd23a;
  const variants = [];
  const cabs = places.map((p, i) => {
    if (!stepper) return null;
    // a classic bank mixes single-line and triple-line steppers like a real retro corner
    const v = rng ? (rng.chance?.(0.35) ? 'three' : 'single') : i % 3 === 2 ? 'three' : 'single';
    variants.push(v);
    return v;
  });
  const cabCache = {};
  const cabFor = (v) => {
    const key = stepper ? `s|${v}` : 'video';
    return (cabCache[key] ||= stepper ? buildStepperCabinet({ variant: v, denomColor, tier: T }) : buildVideoCabinet({ kind: theme === 'space' ? 'ways' : 'lines', denomColor, tier: T }));
  };

  const machineMatrices = places.map((p) => matrixOf(p.x, 0, p.z, 0, p.ry, 0));
  const bags = places.map((p, i) => cabFor(cabs[i]).bag);

  // ---- merged statics ------------------------------------------------------------------------------
  const mats = cabinetMats(theme);
  const meshes = [];
  const merged = PartBag.mergeAll(bags, machineMatrices);
  // end caps: painted slabs with an accent LED stripe closing each row
  const capBag = new PartBag();
  const capLeds = [];
  for (let r = 0; r < rows; r++) {
    const z0 = rows === 2 ? (r === 0 ? BACK_HALF : -BACK_HALF) : 0;
    const dir = r === 0 ? 1 : -1;
    for (const s of [-1, 1]) {
      const x = s * (rowW / 2 + 0.02);
      const h = stepper ? 1.98 : 2.06;
      capBag.box('body', 0.07, h, 0.66, x, h / 2, z0 - dir * 0.29, { r: 0.012, uvTile: 0.8 });
      capBag.box('chrome', 0.075, 0.04, 0.67, x, 0.02, z0 - dir * 0.29, { r: 0.006 });
      capLeds.push({ geo: new THREE.BoxGeometry(0.012, h - 0.3, 0.012), matrix: matrixOf(x, h / 2, z0 + dir * 0.042), kind: 1 });
    }
  }
  const capMerged = PartBag.mergeAll([capBag], [new THREE.Matrix4()]);
  for (const [key, geo] of capMerged) merged.set(key, merged.has(key) ? mergeGeometries([merged.get(key), geo], false) : geo);
  for (const [key, geo] of merged) {
    const m = new THREE.Mesh(geo, mats[key] || mats.dark);
    m.name = `slots:${key}`;
    m.castShadow = key === 'body' || key === 'dark';
    m.receiveShadow = true;
    meshes.push(m);
  }

  // ---- LEDs: every strip, candle, bezel glow and payline in ONE draw call ----------------------------
  const ledMat = ledMaterial();
  const ledGeos = [];
  const SIGN_IDX = MAX_MACHINES - 1;
  places.forEach((p, i) => {
    for (const l of cabFor(cabs[i]).leds) {
      const g = normalizeGeo(l.geo);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(machineMatrices[i], l.matrix));
      ledGeos.push(ledAttrs(g, i, l.kind, { axis: l.axis || 'y', color: l.color, phaseScale: 1.6, phase0: i * 0.37 }));
    }
  });
  for (const l of capLeds) {
    const g = normalizeGeo(l.geo);
    g.applyMatrix4(l.matrix);
    ledGeos.push(ledAttrs(g, SIGN_IDX, l.kind, { axis: 'y', phaseScale: 1.6 }));
  }

  // ---- bank sign (lit, double-sided for back-to-back) --------------------------------------------------
  const signTex = bankSignTexture(theme, denom).clone();
  signTex.wrapS = THREE.RepeatWrapping;
  const signW = Math.max(1.4, rowW - 0.2);
  const signH = 0.36;
  const tiles = Math.max(1, Math.round(signW / (signH * 4)));
  signTex.repeat.set(tiles, 1);
  signTex.needsUpdate = true;
  const signY = stepper ? 2.5 : 2.82;
  const signZ = rows === 2 ? 0 : -0.36;
  const signBag = new PartBag();
  signBag.box('black', signW + 0.08, signH + 0.08, 0.16, 0, signY, signZ, { r: 0.03 });
  signBag.box('chrome', signW + 0.1, 0.02, 0.17, 0, signY + signH / 2 + 0.045, signZ, { r: 0.008 });
  signBag.box('chrome', signW + 0.1, 0.02, 0.17, 0, signY - signH / 2 - 0.045, signZ, { r: 0.008 });
  const postTop = signY - signH / 2 - 0.05;
  const postBase = stepper ? 1.985 : 2.33;
  for (const s of [-1, 1]) signBag.cyl('chrome', 0.022, 0.022, postTop - postBase, s * (signW / 2 - 0.25), (postTop + postBase) / 2, signZ, { seg: 12 });
  for (const [key, geo] of PartBag.mergeAll([signBag], [new THREE.Matrix4()])) {
    const m = new THREE.Mesh(geo, mats[key]);
    m.castShadow = false;
    m.receiveShadow = true;
    meshes.push(m);
  }
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.1, roughness: 0.3 });
  const signFaces = [];
  for (const side of rows === 2 ? [1, -1] : [1]) {
    const g = new THREE.PlaneGeometry(signW, signH);
    if (side < 0) g.rotateY(Math.PI);
    g.translate(0, signY, signZ + side * 0.0815);
    signFaces.push(g);
    for (const yy of [signY + signH / 2 + 0.07, signY - signH / 2 - 0.07]) {
      const lg = new THREE.BoxGeometry(signW, 0.012, 0.012);
      lg.translate(0, yy, signZ + side * 0.075);
      ledGeos.push(ledAttrs(normalizeGeo(lg), SIGN_IDX, yy > signY ? 0 : 1, { axis: 'x', phaseScale: 1.2 }));
    }
  }
  meshes.push(new THREE.Mesh(mergeGeometries(signFaces, false), signMat));

  const ledMesh = new THREE.Mesh(mergeGeometries(ledGeos, false), ledMat);
  ledMesh.name = 'slots:leds';
  meshes.push(ledMesh);
  const look = THEME_LOOK[theme];
  const uState = ledMat.uniforms.uState.value;
  for (let i = 0; i < MAX_MACHINES; i++) {
    ledMat.uniforms.uColor.value[i].set(look.led).multiplyScalar(2.2);
    ledMat.uniforms.uColor2.value[i].set(look.led2).multiplyScalar(2.2);
    uState[i].set(1, 3, 0, 0);
  }
  uState[SIGN_IDX].set(1, 1, 0, 0);

  // ---- lit glass (belly, topper, club display, stepper top glass) ---------------------------------------
  const litGroups = new Map();
  places.forEach((p, i) => {
    const cab = cabFor(cabs[i]);
    for (const l of cab.lit) {
      const key = l.key === 'topglass' ? `topglass|${cabs[i]}` : l.key;
      if (!litGroups.has(key)) litGroups.set(key, []);
      const g = normalizeGeo(l.geo);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(machineMatrices[i], l.matrix));
      litGroups.get(key).push(g);
    }
  });
  for (const [key, geos] of litGroups) {
    const tex =
      key === 'belly' ? bellyTexture(theme) : key === 'topper' ? logoTexture(theme) : key === 'club' ? clubDisplayTexture() : topGlassTexture(key.split('|')[1], drawLogo);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: key === 'club' ? 1.4 : 0.95, roughness: 0.18, metalness: 0 });
    m.name = `slots-lit-${key}`;
    meshes.push(new THREE.Mesh(mergeGeometries(geos, false), m));
  }

  // ---- stools (instanced) ---------------------------------------------------------------------------
  const sg = stoolGeometries(T);
  const stoolMats = { cushion: mat('leather', { color: 0x5e0f18, wear: 0.35, dirt: 0.25 }), chrome: mats.chrome, dark: mats.dark };
  const stoolMeshes = {};
  for (const key of ['cushion', 'chrome', 'dark']) {
    const im = new THREE.InstancedMesh(sg[key], stoolMats[key], places.length);
    im.castShadow = true;
    im.receiveShadow = true;
    stoolMeshes[key] = im;
    meshes.push(im);
  }
  const stoolLocal = [];
  places.forEach((p, i) => {
    const swivel = rng ? rng.range(-0.35, 0.35) : ((i * 37) % 7) * 0.08 - 0.24;
    const m = new THREE.Matrix4().multiplyMatrices(machineMatrices[i], matrixOf(0, 0, STOOL_Z, 0, swivel, 0));
    for (const key in stoolMeshes) stoolMeshes[key].setMatrixAt(i, m);
    stoolLocal.push(new THREE.Vector3(0, 0, STOOL_Z).applyMatrix4(machineMatrices[i]));
  });

  // ---- deck buttons (instanced: rectangles + round SPIN) ---------------------------------------------
  const atlas = buttonAtlas();
  const btnList = []; // { machine, type, inst, mesh, matrix, glow }
  const rect = [];
  const round = [];
  places.forEach((p, i) => {
    for (const b of cabFor(cabs[i]).buttons) (b.round ? round : rect).push({ i, b });
  });
  const mkButtons = (list, geo) => {
    if (!list.length) return null;
    const g = geo.clone();
    const uvs = new Float32Array(list.length * 4);
    const glow = new Float32Array(list.length).fill(0.8);
    list.forEach(({ b }, k) => uvs.set(atlas.rect(b.type), k * 4));
    g.setAttribute('iUv', new THREE.InstancedBufferAttribute(uvs, 4));
    const gAttr = new THREE.InstancedBufferAttribute(glow, 1);
    gAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iGlow', gAttr);
    const im = new THREE.InstancedMesh(g, buttonMaterial(atlas.texture), list.length);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    list.forEach(({ i, b }, k) => {
      const local = matrixOf(b.x, b.y, b.z, b.ang, 0, 0, b.w, b.h, b.d);
      const m = new THREE.Matrix4().multiplyMatrices(machineMatrices[i], local);
      im.setMatrixAt(k, m);
      btnList.push({ machine: i, type: b.type, inst: k, mesh: im, matrix: m.clone(), glowAttr: gAttr, local: new THREE.Vector3(b.x, b.y, b.z), down: 0, ang: b.ang });
    });
    im.computeBoundingSphere();
    meshes.push(im);
    return im;
  };
  const rectGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.18);
  const roundGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
  // top-face UVs for the round button: planar from x/z
  {
    const pos = roundGeo.attributes.position;
    const uv = roundGeo.attributes.uv;
    for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) + 0.5, 0.5 - pos.getZ(k));
  }
  const rectBtns = mkButtons(rect, rectGeo);
  const roundBtns = mkButtons(round, roundGeo);

  // ---- video screens --------------------------------------------------------------------------------
  const screenMeshes = [];
  if (!stepper) {
    const cab = cabFor(null);
    const S = cab.screen;
    const geo = new THREE.PlaneGeometry(S.w, S.h, 1, 16);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const yn = pos.getY(k) / (S.h / 2);
      pos.setZ(k, -S.curve * (1 - yn * yn));
    }
    geo.computeVertexNormals();
    geo.applyMatrix4(S.matrix);
    const attract = attractScreen(theme, denom);
    places.forEach((p, i) => {
      const m = new THREE.MeshStandardMaterial({ color: 0x050506, emissive: 0xffffff, emissiveMap: attract.texture, emissiveIntensity: 1.0, roughness: 0.14, metalness: 0.1 });
      m.name = 'slot-screen';
      const mesh = new THREE.Mesh(geo, m);
      mesh.applyMatrix4(machineMatrices[i]);
      mesh.name = `slots:screen${i}`;
      screenMeshes.push(mesh);
      meshes.push(mesh);
    });
  }

  // ---- stepper drums, levers, reel glass, meters --------------------------------------------------------
  let drums = null;
  let levers = null;
  let meterAtlas = null;
  const leverArm = 0.34;
  if (stepper) {
    const R = STEPPER_DIM.reel;
    const list = [];
    places.forEach((p, i) => {
      const cab = cabFor(cabs[i]);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
      cab.reels.forEach((c, r) => list.push({ center: c.clone().applyMatrix4(machineMatrices[i]), quat: q, column: STRIP_COLUMN(cabs[i], r), initial: (r * 7 + i * 3) % 22 }));
    });
    drums = createDrums(list, { radius: R.radius, width: R.width });
    meshes.push(drums.mesh);
    // reel glass: cheap reflective sheet (no transmission pass)
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.0, depthWrite: false });
    const gGeos = places.map((p, i) => {
      const cab = cabFor(cabs[i]);
      const g = new THREE.PlaneGeometry(cab.glass.w, cab.glass.h);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(machineMatrices[i], cab.glass.matrix));
      return g;
    });
    const glass = new THREE.Mesh(mergeGeometries(gGeos, false), glassMat);
    glass.renderOrder = 2;
    meshes.push(glass);
    // levers: chrome arm + red ball knob, rotating about the hub's X axis
    const armGeo = new THREE.CylinderGeometry(0.011, 0.014, leverArm, 12);
    armGeo.translate(0, leverArm / 2, 0);
    const knobGeo = new THREE.SphereGeometry(0.036, 20, 14);
    knobGeo.translate(0, leverArm + 0.02, 0);
    const knobMat = new THREE.MeshPhysicalMaterial({ color: 0xc8101c, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
    levers = {
      arm: new THREE.InstancedMesh(armGeo, mats.chrome, places.length),
      knob: new THREE.InstancedMesh(knobGeo, knobMat, places.length),
    };
    levers.arm.castShadow = levers.knob.castShadow = true;
    levers.arm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    levers.knob.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    meshes.push(levers.arm, levers.knob);
    // meters
    meterAtlas = new MeterAtlas(places.length);
    const mGeos = places.map((p, i) => {
      const cab = cabFor(cabs[i]);
      const g = new THREE.PlaneGeometry(cab.meter.w, cab.meter.h);
      const [u0, v0, du, dv] = meterAtlas.rect(i);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * du, v0 + uv.getY(k) * dv);
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(machineMatrices[i], cab.meter.matrix));
      return g;
    });
    const meterMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: meterAtlas.texture, emissiveIntensity: 1.6, roughness: 0.2 });
    meshes.push(new THREE.Mesh(mergeGeometries(mGeos, false), meterMat));
  }

  for (const m of meshes) group.add(m);

  // ---- machines -----------------------------------------------------------------------------------------
  const machines = [];
  const bank = {
    theme,
    denom,
    tier: T,
    get engine() {
      return engine;
    },
  };
  places.forEach((p, i) => {
    const cab = cabFor(cabs[i]);
    cab.camera ||= CAMS[cab.kind];
    const mg = new THREE.Group();
    mg.name = `${id}-${i}`;
    mg.position.set(p.x, 0, p.z);
    mg.rotation.y = p.ry;
    group.add(mg);
    mg.updateMatrixWorld(true);
    const seat = {
      pos: new THREE.Vector3(0, 0, SEAT_Z),
      yaw: Math.PI,
      height: STOOL.seatTop,
      radius: 0.42,
      focus: new THREE.Vector3(0, 0.9, STOOL_Z),
      cam: { pos: cab.camera.pos.clone(), target: cab.camera.target.clone() },
    };
    const m = new SlotMachine({ engine, id: `${id}-${i}`, casino, group: mg, bank, index: i, theme, variant: cabs[i], denom, cab, seat });
    machines.push(m);
  });

  // ---- colliders ------------------------------------------------------------------------------------
  const W = group.matrixWorld;
  const qW = new THREE.Quaternion();
  group.getWorldQuaternion(qW);
  const stoolCols = [];
  const npcCols = [];
  if (physics?.addStaticBox) {
    const cab0 = cabFor(cabs[0]);
    for (let r = 0; r < rows; r++) {
      const z0 = rows === 2 ? (r === 0 ? BACK_HALF : -BACK_HALF) : 0;
      const flip = r === 1 ? -1 : 1;
      for (const c of cab0.colliders) {
        const center = new THREE.Vector3(0, c.center.y, z0 + flip * c.center.z).applyMatrix4(W);
        const size = new THREE.Vector3(rowW + 0.16, c.size.y, c.size.z);
        physics.addStaticBox(center, size, qW, { owner: { kind: null, slotBank: id } });
      }
    }
    places.forEach((p, i) => {
      const sp = stoolLocal[i].clone().applyMatrix4(W);
      const owner = machines[i].interactables[0];
      const a = physics.addStaticBox(new THREE.Vector3(sp.x, 0.32, sp.z), new THREE.Vector3(0.13, 0.62, 0.13), qW, { owner });
      const b = physics.addStaticBox(new THREE.Vector3(sp.x, 0.66, sp.z), new THREE.Vector3(0.34, 0.1, 0.34), qW, { owner });
      stoolCols.push([a, b]);
      const np = new THREE.Vector3(0, 0, STOOL_Z - 0.02).applyMatrix4(machineMatrices[i]).applyMatrix4(W);
      const nc = physics.addStaticBox(new THREE.Vector3(np.x, 1.0, np.z), new THREE.Vector3(0.42, 0.7, 0.34), qW, {});
      nc.setEnabled?.(false);
      npcCols.push(nc);
    });
  }

  // ---- bank services used by the machines --------------------------------------------------------------
  const _v = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const anims = [];
  const frustum = new THREE.Frustum();
  const projScreen = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  let frameCam = null;
  let attractStops = null;

  Object.assign(bank, {
    setLed(i, { mode, flash, service, level } = {}) {
      const s = uState[i];
      if (mode != null) s.y = mode;
      if (flash != null) s.z = flash ? 1 : 0;
      if (service != null) s.w = service ? 1 : 0;
      if (level != null) s.x = level;
    },
    screenScale(active) {
      if (!active) return 0.5;
      return T === 'low' ? 0.6 : T === 'medium' ? 0.75 : 1;
    },
    idleStops(machine) {
      attractStops ||= attractScreen(theme, denom).reels.map((R) => Math.round(R.pos) + 1);
      return attractStops.map((s, r) => s + ((machine.index * (r + 2)) % 5));
    },
    useScreen(machine, tex) {
      const mesh = screenMeshes[machine.index];
      if (!mesh) return;
      mesh.material.emissiveMap = tex || attractScreen(theme, denom).texture;
      mesh.material.needsUpdate = true;
    },
    screenFps(machine, ctx) {
      if (machine.active) return T === 'high' || T === 'ultra' ? 30 : 20;
      const cam = ctx?.camera || frameCam;
      if (!cam) return 8;
      const d = cam.position.distanceTo(machine.worldCenter);
      sphere.set(machine.worldCenter, 0.6);
      if (!frustum.intersectsSphere(sphere)) return 0;
      if (d < 5) return machine.npc ? 12 : 4;
      if (d < 14) return machine.npc ? 5 : 2;
      return 0.5;
    },
    pick(machine, ray) {
      const hits = [];
      for (const im of [rectBtns, roundBtns]) {
        if (!im) continue;
        for (const h of ray.intersectObject(im, false)) {
          const b = btnList.find((x) => x.mesh === im && x.inst === h.instanceId);
          if (b && b.machine === machine.index) hits.push({ d: h.distance, type: b.type });
        }
      }
      if (levers) {
        for (const im of [levers.knob, levers.arm]) for (const h of ray.intersectObject(im, false)) if (h.instanceId === machine.index) hits.push({ d: h.distance, type: 'lever' });
      }
      const sm = screenMeshes[machine.index];
      if (sm) for (const h of ray.intersectObject(sm, false)) hits.push({ d: h.distance, type: 'screen' });
      // bill validator mouth: a small sphere test around its anchor
      const bv = machine.toWorld(machine.cab.anchors.bill.pos, _v);
      const dist = ray.ray.distanceToPoint(bv);
      if (dist < 0.05) hits.push({ d: ray.ray.origin.distanceTo(bv), type: 'bill' });
      hits.sort((a, b) => a.d - b.d);
      return hits[0] || null;
    },
    pressButton(machine, type) {
      const b = btnList.find((x) => x.machine === machine.index && x.type === type);
      if (b) b.down = 0.14;
      machine.uiCtl?.pressVisual?.(type === 'lever' ? 'lever' : type);
    },
    buttonWorldPos(machine, type) {
      const b = btnList.find((x) => x.machine === machine.index && x.type === type);
      if (!b) return type === 'spin' && stepper ? bank.leverKnobWorld(machine) : null;
      return b.local.clone().applyMatrix4(machine.group.matrixWorld);
    },
    setStoolCollider(machine, on) {
      for (const c of stoolCols[machine.index] || []) c.setEnabled?.(on);
    },
    setNpcCollider(machine, on) {
      npcCols[machine.index]?.setEnabled?.(on);
    },
    stoolWorld(machine) {
      return stoolLocal[machine.index].clone().applyMatrix4(group.matrixWorld);
    },
    setDrum(machine, r, pos, blur) {
      drums?.setDrum(machine.index * 3 + r, pos, blur);
    },
    setLever(machine, angle) {
      if (!levers) return;
      const hub = machine.cab.anchors.lever.hub;
      _m.copy(machineMatrices[machine.index]).multiply(matrixOf(hub.x, hub.y, hub.z, angle, 0, 0));
      levers.arm.setMatrixAt(machine.index, _m);
      levers.knob.setMatrixAt(machine.index, _m);
      levers.arm.instanceMatrix.needsUpdate = true;
      levers.knob.instanceMatrix.needsUpdate = true;
    },
    leverKnobWorld(machine, angle) {
      const hub = machine.cab.anchors.lever?.hub;
      if (!hub) return null;
      const a = angle ?? machine.lever?.angle ?? 0;
      const local = new THREE.Vector3(hub.x, hub.y + Math.cos(a) * (leverArm + 0.02), hub.z + Math.sin(a) * (leverArm + 0.02));
      return local.applyMatrix4(machine.group.matrixWorld);
    },
    setMeter(machine, credits, bet, paid) {
      if (!meterAtlas) return;
      const blink = machine._meterBlink > 0;
      meterAtlas.set(machine.index, credits, bet, paid, { blink });
    },
    meterBlink(machine, sec) {
      machine._meterBlink = sec;
    },
    flashPaylines(machine) {
      machine.setLed(1, 2.5);
    },
    animateBill(machine, amount, isTicket = false) {
      anims.push(makePaper(machine, isTicket ? 'ticket-in' : 'bill', group));
    },
    animateTicket(machine) {
      anims.push(makePaper(machine, 'ticket-out', group));
    },
  });
  for (const m of machines) {
    if (levers) bank.setLever(m, m.lever.angle);
    m.refreshWorld();
  }

  // ---- update -----------------------------------------------------------------------------------------
  let time = 0;
  function update(dt, ctx = {}) {
    time += dt;
    ledMat.uniforms.uTime.value = time;
    const cam = ctx.camera || engine?.camera;
    if (cam) {
      cam.updateMatrixWorld();
      projScreen.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreen);
      frameCam = cam;
    }
    tickAttracts(dt, engine?.renderer?.info?.render?.frame ?? Math.floor(performance.now() / 8));
    // button press travel + glow
    let dirtyBtn = false;
    for (const b of btnList) {
      const m = machines[b.machine];
      const want = m.phase === 'handpay' ? 0.15 : b.type === 'spin' && m.phase === 'idle' && m.balance > 0 ? 0.9 + 0.5 * Math.sin(time * 4 + b.machine) : 0.75;
      if (Math.abs(b.glowAttr.array[b.inst] - want) > 0.01) {
        b.glowAttr.array[b.inst] = want;
        b.glowAttr.needsUpdate = true;
      }
      if (b.down > 0 || b._wasDown) {
        b.down = Math.max(0, b.down - dt);
        _m.copy(b.matrix);
        if (b.down > 0) {
          const n = new THREE.Vector3(0, Math.cos(b.ang), Math.sin(b.ang)).transformDirection(machineMatrices[b.machine]);
          _m.elements[12] -= n.x * 0.006;
          _m.elements[13] -= n.y * 0.006;
          _m.elements[14] -= n.z * 0.006;
        }
        b.mesh.setMatrixAt(b.inst, _m);
        b.mesh.instanceMatrix.needsUpdate = true;
        b._wasDown = b.down > 0;
        dirtyBtn = true;
      }
    }
    void dirtyBtn;
    for (let k = anims.length - 1; k >= 0; k--) if (!anims[k].update(dt)) anims.splice(k, 1);
    for (const m of machines) {
      if (m._meterBlink > 0) m._meterBlink -= dt;
      m.update(dt, ctx);
    }
    meterAtlas?.flush();
  }

  function dispose() {
    for (const m of machines) m.dispose();
    for (const a of anims) a.dispose?.();
    group.removeFromParent();
    group.traverse((o) => {
      if (o.isMesh) o.geometry?.dispose?.();
    });
    signTex.dispose();
  }

  const footprint = rows === 2 ? { w: rowW + 0.2, d: 3.8 } : { w: rowW + 0.2, d: 2.0 };
  return {
    group,
    machines,
    interactables: machines.flatMap((m) => m.interactables),
    update,
    dispose,
    footprint,
    theme,
    denom,
  };
}

// ---- paper in/out (bills into the validator, tickets out of the printer) ------------------------------

const paperCache = {};
function paperMaterial(kind) {
  if (paperCache[kind]) return paperCache[kind];
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'bill') {
    g.fillStyle = '#c9d8b4';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#4a6a3a';
    g.lineWidth = 4;
    g.strokeRect(4, 4, 120, 56);
    g.fillStyle = 'rgba(60,90,50,.5)';
    g.beginPath();
    g.ellipse(64, 32, 16, 20, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = '#f6f5ee';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#222';
    for (let x = 10; x < 118; x += 3) if ((x * 7) % 5 < 3) g.fillRect(x, 40, 2, 16);
    g.fillRect(10, 10, 60, 6);
    g.fillRect(10, 22, 40, 6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  paperCache[kind] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
  return paperCache[kind];
}

function makePaper(machine, kind, bankGroup) {
  const isOut = kind === 'ticket-out';
  const anchor = isOut ? machine.cab.anchors.printer : machine.cab.anchors.bill;
  const w = kind === 'bill' ? 0.066 : 0.065;
  const len = kind === 'bill' ? 0.156 : 0.156;
  const geo = new THREE.PlaneGeometry(w, len);
  geo.rotateX(-Math.PI / 2); // lying flat, length along z
  geo.translate(0, 0, len / 2);
  const mesh = new THREE.Mesh(geo, paperMaterial(kind === 'bill' ? 'bill' : 'ticket'));
  // a little tilted down, sticking out of the slot toward the player
  const holder = new THREE.Group();
  holder.position.copy(anchor.pos);
  holder.rotation.x = 0.35;
  holder.add(mesh);
  machine.group.add(holder);
  let tt = 0;
  const dur = isOut ? 2.6 : 1.3;
  void bankGroup;
  return {
    update(dt) {
      tt += dt;
      let out;
      if (isOut) {
        // printer feeds it out in steps, it hangs there, then the hand takes it
        const feed = Math.min(1, tt / 1.1);
        out = Math.floor(feed * 8) / 8;
        if (tt > 2.1) holder.position.y = anchor.pos.y + (tt - 2.1) * 0.6;
      } else {
        // held out in front of the bezel, then pulled in by the rollers
        out = tt < 0.3 ? 1 : Math.max(0, 1 - (tt - 0.3) / 0.8);
      }
      mesh.position.z = -len * (1 - out);
      mesh.visible = out > 0.02;
      if (tt >= dur) {
        this.dispose();
        return false;
      }
      return true;
    },
    dispose() {
      holder.removeFromParent();
      geo.dispose();
    },
  };
}
