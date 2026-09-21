// The three pre-game "house" rooms: kitchen, entry, bedroom. Each builder returns a
// self-contained scene bundle that main.js drives: { scene, colliders, interactables,
// spawn, update, advance, dispose }. `advance` is a Promise that resolves once that
// room's scripted story beat is finished, telling main.js it's safe to transition onward.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import {
  addBox, addCylinder, addSphere, buildRoomShell, buildHumanoid, canvasTexture,
  woodTexture, tileTexture, wallpaperTexture, fabricTexture,
  EYE_HEIGHT, damp, lerp, tween, easeInOut, easeOutBack, disposeObject3D,
} from '../utils.js';
import { getGraphicsPreset } from '../settings.js';
import { unlock } from '../achievements.js';
import { playDoorbell, playDoorCreak, playFootstep, playBoxOpen, playDiscInsert } from '../audio.js';
import { showDialogueSequence, showChoice, showFlavorText } from '../cutscenes.js';

const visitedRooms = new Set();
function markVisited(name) {
  visitedRooms.add(name);
  if (visitedRooms.size >= 3) unlock('explored_house');
}

function addRoomLighting(scene, { warmth = 0xfff2d9, ambient = 0.55, point = 1.1, fogColor = 0x201a14 } = {}) {
  const preset = getGraphicsPreset();
  scene.add(new THREE.AmbientLight(0xffffff, ambient));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 0.2));
  const light = new THREE.PointLight(warmth, point, 14, 2);
  light.position.set(0, 2.4, 0);
  if (preset.shadows) {
    light.castShadow = true;
    light.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    light.shadow.camera.near = 0.3;
    light.shadow.camera.far = 12;
    light.shadow.radius = 2;
  }
  scene.add(light);
  scene.fog = new THREE.Fog(fogColor, 5, Math.max(13, preset.fogFar * 0.28));
  return light;
}

// ---------- Shared humanoid animation helpers ----------
function walkCycle(h, phase, amp = 0.5) {
  h.lLeg.rotation.x = Math.sin(phase) * amp;
  h.rLeg.rotation.x = -Math.sin(phase) * amp;
  h.lArm.rotation.x = -Math.sin(phase) * amp * 0.8;
  h.rArm.rotation.x = Math.sin(phase) * amp * 0.8;
}
function restPose(h) {
  h.lLeg.rotation.x = h.rLeg.rotation.x = 0;
  h.lArm.rotation.x = h.rArm.rotation.x = -0.05;
}
function walkActorTo(h, group, toX, toZ, duration) {
  h.busy = true;
  const fromX = group.position.x, fromZ = group.position.z;
  return tween(duration, p => {
    group.position.x = lerp(fromX, toX, p);
    group.position.z = lerp(fromZ, toZ, p);
    walkCycle(h, p * 16);
  }).then(() => { restPose(h); h.busy = false; });
}
function bendAndLift(h, group) {
  h.busy = true;
  return tween(700, p => {
    const s = Math.sin(p * Math.PI);
    h.hip.rotation.x = s * 0.55;
    group.position.y = -s * 0.18;
  }, easeInOut).then(() => { h.hip.rotation.x = 0; group.position.y = 0; h.busy = false; });
}

// ---------- Small props ----------
function buildDeliveryBox() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#c99a5b', roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.4), mat);
  base.position.y = 0.2;
  base.castShadow = true;
  group.add(base);
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#8a6b3d', roughness: 0.6 });
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.42), tapeMat);
  tape.position.y = 0.4;
  group.add(tape);
  return { group };
}

function buildDisc() {
  const group = new THREE.Group();
  const labelTex = canvasTexture((c, s) => {
    const grad = c.createRadialGradient(s / 2, s / 2, 8, s / 2, s / 2, s / 2);
    grad.addColorStop(0, '#eef1f5');
    grad.addColorStop(1, '#7c8798');
    c.fillStyle = grad;
    c.fillRect(0, 0, s, s);
    c.fillStyle = '#20242c';
    c.font = 'bold 15px sans-serif';
    c.textAlign = 'center';
    c.fillText('WILDFOWL', s / 2, s * 0.47);
    c.fillText('HUNT', s / 2, s * 0.61);
  }, 128, [1, 1]);
  const mat = new THREE.MeshStandardMaterial({ color: '#dcdcdc', map: labelTex, metalness: 0.6, roughness: 0.3 });
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 24), mat);
  mesh.rotation.x = Math.PI / 2;
  group.add(mesh);
  return { group, mesh };
}

function buildOpenableBox() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#c99a5b', roughness: 0.9 });
  const tapeMat = new THREE.MeshStandardMaterial({ color: '#8a6b3d', roughness: 0.6 });
  const size = 0.42, h = 0.34;
  const base = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), mat);
  base.position.y = h / 2;
  base.castShadow = true;
  group.add(base);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(size + 0.02, 0.05, size * 0.3), tapeMat);
  tape.position.y = h * 0.75;
  group.add(tape);

  function makeFlap(sign) {
    const pivot = new THREE.Group();
    pivot.position.set(0, h, sign * size / 2);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(size, 0.03, size / 2), mat);
    panel.position.z = sign * size / 4;
    panel.castShadow = true;
    pivot.add(panel);
    group.add(pivot);
    return pivot;
  }
  const flapFront = makeFlap(1);
  const flapBack = makeFlap(-1);

  const disc = buildDisc();
  disc.group.position.set(0, h * 0.6, 0);
  disc.group.visible = false;
  group.add(disc.group);

  return { group, flapFront, flapBack, disc, height: h };
}

// ---------- KITCHEN ----------
export function createKitchenScene({ camera }) {
  markVisited('kitchen');
  const scene = new THREE.Scene();

  const floorTex = tileTexture('#e3dcc9', '#cfc6ac', [3, 2.5]);
  const wallTex = wallpaperTexture('#f0e2c2', '#dfcf9e', [3, 2]);
  const { group: room, colliders } = buildRoomShell({ width: 6, depth: 5, height: 2.8, floorTex, wallTex, ceilingColor: '#f4efe2' });
  scene.add(room);
  addRoomLighting(scene, { warmth: 0xffe6b0, ambient: 0.55, point: 1.2, fogColor: 0x2b2013 });

  // Fridge
  addBox(room, colliders, { x: -2.62, y: 0.95, z: -1.0, sx: 0.7, sy: 1.9, sz: 0.68, color: '#d7dbe0', roughness: 0.4, metalness: 0.3 });
  addBox(room, colliders, { x: -2.3, y: 0.95, z: -1.0, sx: 0.04, sy: 0.4, sz: 0.05, color: '#8a8f97', collide: false });

  // Stove against back wall
  const stoveX = -1.1, stoveZ = -2.15;
  addBox(room, colliders, { x: stoveX, y: 0.45, z: stoveZ, sx: 1.0, sy: 0.9, sz: 0.62, color: '#3c3c3c' });
  addBox(room, colliders, { x: stoveX, y: 0.42, z: stoveZ + 0.15, sx: 0.7, sy: 0.06, sz: 0.05, color: '#555555', collide: false });
  addCylinder(room, colliders, { x: stoveX - 0.25, y: 0.91, z: stoveZ - 0.05, radiusTop: 0.12, radiusBottom: 0.12, height: 0.02, color: '#151515' });
  addCylinder(room, colliders, { x: stoveX + 0.25, y: 0.91, z: stoveZ - 0.05, radiusTop: 0.12, radiusBottom: 0.12, height: 0.02, color: '#151515' });

  // Counter, right of stove
  addBox(room, colliders, { x: 1.5, y: 0.45, z: -2.15, sx: 2.4, sy: 0.9, sz: 0.6, color: '#ffffff', map: woodTexture() });
  addBox(room, colliders, { x: 1.5, y: 0.92, z: -2.15, sx: 2.5, sy: 0.05, sz: 0.68, color: '#efe7d6', collide: false });

  // Table + chairs
  const tableTex = woodTexture('#a3703f', '#7c5127', [1, 1]);
  addBox(room, colliders, { x: 0.6, y: 0.75, z: 1.3, sx: 1.5, sy: 0.08, sz: 1.0, color: '#ffffff', map: tableTex });
  [[-0.65, -0.4], [-0.65, 0.4], [0.65, -0.4], [0.65, 0.4]].forEach(([dx, dz]) => {
    addBox(room, colliders, { x: 0.6 + dx, y: 0.38, z: 1.3 + dz, sx: 0.06, sy: 0.75, sz: 0.06, color: '#6b4225', collide: false });
  });
  function chair(x, z, rotY = 0) {
    addBox(room, colliders, { x, y: 0.42, z, sx: 0.42, sy: 0.06, sz: 0.42, color: '#7c5127', rotY });
    addBox(room, colliders, { x: x - Math.sin(rotY) * 0.19, y: 0.72, z: z - Math.cos(rotY) * 0.19, sx: 0.42, sy: 0.5, sz: 0.06, color: '#7c5127', rotY, collide: false });
  }
  chair(0.6, 0.55, 0);
  chair(0.6, 2.05, Math.PI);
  chair(-0.35, 1.3, -Math.PI / 2);

  addBox(room, colliders, { x: 0.6, y: 0.005, z: 1.3, sx: 1.9, sy: 0.01, sz: 1.5, color: '#8a3b3b', collide: false });

  // Mom, at the stove
  const mom = buildHumanoid({ shirt: '#c1548a', skin: '#e8b48d', pants: '#3a3a4a', hair: '#5c3a26' });
  mom.group.position.set(stoveX + 0.55, 0, stoveZ + 0.55);
  mom.group.rotation.y = Math.PI * 0.85;
  scene.add(mom.group);

  const interactMom = { object: mom.group, name: 'mom', range: 2.6, enabled: true, prompt: 'Talk to Mom', onInteract: null };

  let resolveAdvance;
  const advance = new Promise(r => { resolveAdvance = r; });

  interactMom.onInteract = async () => {
    interactMom.enabled = false;
    mom.facingPlayer = true;
    await showDialogueSequence([
      { speaker: 'You', text: 'Hey Mom, can I get that new hunting game? The one with all the ducks?' },
      { speaker: 'Mom', text: "The one that's basically a whole shooting gallery in a cardboard box? Sure, why not." },
      { speaker: 'You', text: 'Yes! Thank you, thank you, thank you!' },
    ]);
    const choice = await showChoice('How do you react?', [
      { label: 'Fist pump!', value: 'hype' },
      { label: 'Play it cool.', value: 'cool' },
    ]);
    if (choice === 'hype') {
      await showDialogueSequence([
        { speaker: 'You', text: 'YESSSS!' },
        { speaker: 'Mom', text: 'Okay, okay. Save some of that energy for the actual game.' },
      ]);
    } else {
      await showDialogueSequence([
        { speaker: 'You', text: 'Cool. Cool cool cool. Very chill about this.' },
        { speaker: 'Mom', text: 'Mm-hm. Sure you are.' },
      ]);
    }
    await showDialogueSequence([
      { speaker: 'Mom', text: "Don't thank me yet, it hasn't even shipped. Now scoot, I've got dinner on." },
    ]);
    unlock('talked_to_mom');
    resolveAdvance();
  };

  function update(dt, elapsed) {
    if (!mom.busy) {
      const stir = Math.sin(elapsed * 3.2);
      mom.rArm.rotation.x = -1.0 + stir * 0.35;
      mom.rArm.rotation.z = 0.15 + stir * 0.15;
      mom.lArm.rotation.x = -0.2 + Math.sin(elapsed * 1.6) * 0.05;
    }
    if (mom.facingPlayer) {
      const dx = camera.position.x - mom.group.position.x;
      const dz = camera.position.z - mom.group.position.z;
      const targetYaw = Math.atan2(dx, dz);
      mom.group.rotation.y = damp(mom.group.rotation.y, targetYaw, 5, dt);
    }
  }

  return {
    scene, colliders, interactables: [interactMom],
    spawn: { x: 0.6, y: EYE_HEIGHT, z: 2.3, yaw: 0 },
    floorSurface: 'tile', update, advance,
    dispose: () => disposeObject3D(scene),
  };
}

// ---------- ENTRY ----------
export function createEntryScene({ camera }) {
  markVisited('entry');
  const scene = new THREE.Scene();

  const floorTex = woodTexture('#8a6239', '#6b4a28', [2, 2]);
  const wallTex = wallpaperTexture('#d8cdb8', '#c4b394', [2, 2]);
  const { group: room, colliders } = buildRoomShell({ width: 4.5, depth: 4, height: 2.8, floorTex, wallTex, ceilingColor: '#efe9db' });
  scene.add(room);
  addRoomLighting(scene, { warmth: 0xffe9c2, ambient: 0.5, point: 1.0, fogColor: 0x231a10 });

  addBox(room, colliders, { x: 1.9, y: 0.4, z: 0.6, sx: 0.5, sy: 0.8, sz: 0.4, color: '#6b4225' });
  addCylinder(room, colliders, { x: -1.9, y: 0.9, z: 0.9, radiusTop: 0.03, radiusBottom: 0.03, height: 1.8, color: '#4a3320', collide: true });
  addBox(room, colliders, { x: 0, y: 0.005, z: 0.3, sx: 2.0, sy: 0.01, sz: 1.2, color: '#5b3a55', collide: false });

  const doorWidth = 0.95, doorHeight = 2.05;
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.5, 0, -1.93);
  const doorMat = new THREE.MeshStandardMaterial({ color: '#5a3d24', roughness: 0.7 });
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, 0.06), doorMat);
  doorPanel.position.set(doorWidth / 2, doorHeight / 2, 0);
  doorPanel.castShadow = true;
  doorPivot.add(doorPanel);
  addSphere(doorPivot, { x: doorWidth - 0.12, y: doorHeight / 2, z: 0.05, radius: 0.035, color: '#d8c878', metalness: 0.6, roughness: 0.3 });
  room.add(doorPivot);
  colliders.push(new THREE.Box3(
    new THREE.Vector3(-0.5, 0, -2.0), new THREE.Vector3(0.45, doorHeight, -1.86)
  ));

  const doorInteract = { object: doorPanel, name: 'door', range: 3.2, enabled: false, prompt: 'Open the door', onInteract: null };

  const courier = buildHumanoid({ shirt: '#8a7d5a', skin: '#caa06e', pants: '#4a4438', hair: '#241a12' });
  courier.group.visible = false;
  courier.group.position.set(0, 0, -1.75);
  scene.add(courier.group);

  const box = buildDeliveryBox();
  box.group.visible = false;
  scene.add(box.group);

  const mom = buildHumanoid({ shirt: '#c1548a', skin: '#e8b48d', pants: '#3a3a4a', hair: '#5c3a26' });
  mom.group.position.set(1.3, 0, 0.3);
  mom.group.rotation.y = -Math.PI / 2;
  scene.add(mom.group);

  let resolveAdvance;
  const advance = new Promise(r => { resolveAdvance = r; });

  const bellTimer = setTimeout(() => {
    playDoorbell();
    showFlavorText('The doorbell rings.');
    doorInteract.enabled = true;
  }, 1400);

  doorInteract.onInteract = async () => {
    doorInteract.enabled = false;
    playDoorCreak();
    await tween(700, p => { doorPivot.rotation.y = -p * 1.7; }, easeInOut);
    courier.group.visible = true;
    await walkActorTo(courier, courier.group, 0, -0.7, 1300);
    await bendAndLift(courier, courier.group);
    box.group.position.set(0.35, 0, -0.55);
    box.group.visible = true;
    playFootstep('wood');
    await showDialogueSequence([
      { speaker: 'Delivery Person', text: 'Package for... a very lucky kid, I guess. Just leaving it here!' },
    ]);
    await walkActorTo(courier, courier.group, 0, -1.75, 1200);
    courier.group.visible = false;
    playDoorCreak();
    await tween(600, p => { doorPivot.rotation.y = -1.7 + p * 1.7; }, easeInOut);

    await walkActorTo(mom, mom.group, 0.35, -0.2, 1000);
    await bendAndLift(mom, mom.group);
    box.group.visible = false;
    await showDialogueSequence([
      { speaker: 'Mom', text: 'Well, look at that! Go wash up - I will bring this up to your room.' },
    ]);
    resolveAdvance();
  };

  function update(dt, elapsed) {
    if (!mom.busy) mom.group.position.y = Math.sin(elapsed * 1.3) * 0.008;
  }

  return {
    scene, colliders, interactables: [doorInteract],
    spawn: { x: 0, y: EYE_HEIGHT, z: 1.4, yaw: 0 },
    floorSurface: 'wood', update, advance,
    dispose: () => { clearTimeout(bellTimer); disposeObject3D(scene); },
  };
}

// ---------- BEDROOM ----------
export function createBedroomScene({ camera }) {
  markVisited('bedroom');
  const scene = new THREE.Scene();

  const floorTex = woodTexture('#9c7148', '#7a5636', [2.5, 2.5]);
  const wallTex = wallpaperTexture('#bcd4e0', '#a9c3d1', [3, 2]);
  const { group: room, colliders } = buildRoomShell({ width: 5, depth: 5, height: 2.8, floorTex, wallTex, ceilingColor: '#eef2f5' });
  scene.add(room);
  addRoomLighting(scene, { warmth: 0xd9e8ff, ambient: 0.5, point: 0.9, fogColor: 0x141820 });

  // Bed
  addBox(room, colliders, { x: -1.9, y: 0.28, z: -1.0, sx: 1.0, sy: 0.5, sz: 2.0, color: '#6b4225' });
  addBox(room, colliders, { x: -1.9, y: 0.58, z: -1.0, sx: 0.95, sy: 0.18, sz: 1.9, color: '#e3ecf5', collide: false });
  addBox(room, colliders, { x: -1.9, y: 0.7, z: -1.85, sx: 0.9, sy: 0.18, sz: 0.22, color: '#f7fafc', collide: false });
  addBox(room, colliders, { x: -1.9, y: 0.63, z: -0.3, sx: 0.95, sy: 0.05, sz: 0.7, color: '#ffffff', map: fabricTexture('#4a6b8a'), collide: false });

  // Desk + console + TV
  const deskX = 0.6, deskZ = -2.1;
  addBox(room, colliders, { x: deskX, y: 0.72, z: deskZ, sx: 1.6, sy: 0.06, sz: 0.7, color: '#ffffff', map: woodTexture() });
  [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]].forEach(([dx, dz]) => {
    addBox(room, colliders, { x: deskX + dx, y: 0.36, z: deskZ + dz, sx: 0.06, sy: 0.72, sz: 0.06, color: '#5c3a20', collide: false });
  });
  addBox(room, colliders, { x: deskX - 0.4, y: 0.79, z: deskZ + 0.15, sx: 0.35, sy: 0.08, sz: 0.28, color: '#2a2a2a', collide: false });
  addBox(room, colliders, { x: deskX - 0.4, y: 0.83, z: deskZ + 0.0, sx: 0.22, sy: 0.015, sz: 0.02, color: '#111111', collide: false });

  const tvTex = canvasTexture((c, s) => { c.fillStyle = '#0a0a12'; c.fillRect(0, 0, s, s); }, 128, [1, 1]);
  const tvCanvasEl = tvTex.image;
  const tvMat = new THREE.MeshStandardMaterial({ map: tvTex, emissive: '#111111', emissiveMap: tvTex, emissiveIntensity: 0.5, roughness: 0.6 });
  const tvScreen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.04), tvMat);
  tvScreen.position.set(deskX + 0.3, 1.05, deskZ + 0.1);
  room.add(tvScreen);
  addBox(room, colliders, { x: deskX + 0.3, y: 1.05, z: deskZ + 0.13, sx: 0.6, sy: 0.45, sz: 0.05, color: '#1a1a1a', collide: false });
  addBox(room, colliders, { x: deskX, y: 0.42, z: deskZ + 0.75, sx: 0.4, sy: 0.06, sz: 0.4, color: '#3a3a3a' });

  // Shelf with other game cases
  addBox(room, colliders, { x: 2.15, y: 1.3, z: 0.4, sx: 0.3, sy: 0.04, sz: 1.6, color: '#6b4225' });
  ['#c14a4a', '#4a8ac1', '#4ac17a', '#c1a34a', '#8a4ac1'].forEach((c, i) => {
    addBox(room, colliders, { x: 2.08, y: 1.42, z: -0.2 + i * 0.3, sx: 0.03, sy: 0.22, sz: 0.16, color: c, collide: false });
  });

  // The delivered box
  const box = buildOpenableBox();
  box.group.position.set(deskX - 0.3, 0, deskZ + 1.1);
  room.add(box.group);

  const boxInteract = { object: box.group, name: 'box', range: 2.6, enabled: true, prompt: 'Open the box', state: 'closed', onInteract: null };

  let resolveAdvance;
  const advance = new Promise(r => { resolveAdvance = r; });

  async function insertDiscSequence() {
    const handGroup = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: '#e2b48a', roughness: 0.8 });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.14), skinMat);
    handGroup.add(hand);
    const heldDisc = box.disc.mesh.clone();
    heldDisc.position.set(0, 0.02, -0.1);
    handGroup.add(heldDisc);
    handGroup.position.set(0.2, -0.28, -0.4);
    handGroup.rotation.set(0.15, -0.3, 0);
    camera.add(handGroup);
    box.disc.group.visible = false;

    await tween(450, p => {
      handGroup.position.x = lerp(0.2, 0.06, p);
      handGroup.position.y = lerp(-0.28, -0.14, p);
    }, easeInOut);
    await tween(350, p => { handGroup.position.z = lerp(-0.4, -0.62, p); });
    playDiscInsert();
    const tctx = tvCanvasEl.getContext('2d');
    tctx.fillStyle = `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`;
    tctx.fillRect(0, 0, 128, 128);
    tctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 40; i++) tctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
    tvTex.needsUpdate = true;
    tvMat.emissiveIntensity = 1.6;
    await tween(300, p => {
      handGroup.position.z = lerp(-0.62, -0.35, p);
      handGroup.position.x = lerp(0.06, 0.2, p);
    });
    camera.remove(handGroup);
  }

  boxInteract.onInteract = async () => {
    if (boxInteract.state === 'closed') {
      boxInteract.enabled = false;
      playBoxOpen();
      await Promise.all([
        tween(600, p => { box.flapFront.rotation.x = -p * 2.0; }, easeOutBack),
        tween(600, p => { box.flapBack.rotation.x = p * 2.0; }, easeOutBack),
      ]);
      box.disc.group.visible = true;
      await tween(300, p => { box.disc.group.position.y = box.height * 0.6 + p * 0.08; });
      unlock('opened_box');
      boxInteract.state = 'open';
      boxInteract.prompt = 'Insert the disc';
      boxInteract.enabled = true;
    } else if (boxInteract.state === 'open') {
      boxInteract.enabled = false;
      boxInteract.state = 'inserting';
      await insertDiscSequence();
      unlock('inserted_disc');
      resolveAdvance();
    }
  };

  return {
    scene, colliders, interactables: [boxInteract],
    spawn: { x: 0, y: EYE_HEIGHT, z: 1.8, yaw: 0 },
    floorSurface: 'wood', update: () => {}, advance,
    dispose: () => disposeObject3D(scene),
  };
}
