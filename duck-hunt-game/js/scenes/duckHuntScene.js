// The "inside the TV" duck-hunting level: 5 rounds of increasing difficulty, a shotgun
// viewmodel, a dog that starts out as a simple retriever and grows steadily stranger from
// round 3 onward, and a final confrontation beat that decides which ending the player earns.
//
// Originality note: the dog's unease is built entirely from staging (lingering stares, being
// somewhere it shouldn't, a real-time TV-reflection that doesn't match reality, distorted
// growls) rather than any creature redesign, and the resolution is an original stand-your-
// ground / back-away / shoot choice - not a copy of any specific existing game's mechanic.
import * as THREE from 'three';
import {
  addBox, addCylinder, addSphere, boxCollider, buildDog, buildDuck,
  carpetTexture, wallpaperTexture, fabricTexture, skyTexture,
  damp, lerp, clamp, randRange, tween, easeInOut, disposeObject3D, triggerDomGlitch,
} from '../utils.js';
import { getGraphicsPreset } from '../settings.js';
import { unlock } from '../achievements.js';
import {
  playShotgunBlast, playPump, playEmptyClick, playDuckQuack, playDuckHitSquawk,
  playDogBark, playDogLaugh, playDogGrowlSting, playDogYelp, playGlitchWhoosh, setHorrorIntensity,
} from '../audio.js';
import { showBanner, showFlavorText } from '../cutscenes.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ROUND_DUCK_COUNTS = [3, 4, 5, 6, 7];
const LAUGH_LINES = [
  "The dog is definitely laughing at you. Rude.",
  "It didn't even try to hide the smirk.",
  "You swear it just shook its head at you.",
  "The dog sits. The dog judges. The dog says nothing.",
];

export function createDuckHuntScene({ camera, controller, onHud, onGameEnd }) {
  const scene = new THREE.Scene();
  const preset = getGraphicsPreset();
  const colliders = [];

  // ---------- Room shell ----------
  const floorTex = carpetTexture('#6b3f3f', [4, 5]);
  const wallTex = wallpaperTexture('#7d6a8a', '#6a5876', [3, 2]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshStandardMaterial({ color: '#2a2530', roughness: 1 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 4;
  scene.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
  function wall(cx, cz, w, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), wallMat);
    m.position.set(cx, 2, cz);
    m.receiveShadow = true;
    scene.add(m);
    colliders.push(boxCollider(cx, 2, cz, w, 4, d));
  }
  wall(0, 6.1, 10.4, 0.2);   // south wall (mirror TV mounted here, behind the player)
  wall(-5.1, 0, 0.2, 12);    // west
  wall(5.1, 0, 0.2, 12);     // east
  wall(-4.25, -6.1, 1.5, 0.2); // north-left, flanking the window
  wall(4.25, -6.1, 1.5, 0.2);  // north-right
  addBox(scene, colliders, { x: 0, y: 3.85, z: -6.1, sx: 7.3, sy: 0.3, sz: 0.2, color: '#3a3040', collide: false });
  // Invisible collider across the window opening so the player can't wander into the "yard".
  colliders.push(boxCollider(0, 2, -6.05, 6.9, 4, 0.3));

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 3.5), new THREE.MeshPhysicalMaterial({
    color: '#bcd9ea', transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, side: THREE.DoubleSide,
  }));
  glass.position.set(0, 2, -6.0);
  scene.add(glass);

  const sky = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ map: skyTexture(), fog: true }));
  sky.position.set(0, 10, -26);
  scene.add(sky);

  // Furniture
  const COUCH = { x: -3.0, z: 3.2 };
  addBox(scene, colliders, { x: COUCH.x, y: 0.28, z: COUCH.z, sx: 1.8, sy: 0.5, sz: 0.8, color: '#ffffff', map: fabricTexture('#5a4a7a') });
  addBox(scene, colliders, { x: COUCH.x, y: 0.65, z: COUCH.z - 0.35, sx: 1.8, sy: 0.55, sz: 0.18, color: '#ffffff', map: fabricTexture('#5a4a7a'), collide: false });
  addBox(scene, colliders, { x: COUCH.x - 0.85, y: 0.5, z: COUCH.z, sx: 0.18, sy: 0.4, sz: 0.8, color: '#4a3a63', collide: false });
  addBox(scene, colliders, { x: COUCH.x + 0.85, y: 0.5, z: COUCH.z, sx: 0.18, sy: 0.4, sz: 0.8, color: '#4a3a63', collide: false });
  const COUCH_TOP = { x: COUCH.x + 0.3, y: 0.6, z: COUCH.z };

  addBox(scene, colliders, { x: -4.75, y: 1.4, z: -1.5, sx: 0.35, sy: 2.6, sz: 1.3, color: '#5c3a20' });
  ['#c14a4a', '#4a8ac1', '#c1a34a', '#4ac17a', '#8a4ac1', '#c17a4a'].forEach((c, i) => {
    addBox(scene, colliders, { x: -4.6, y: 0.6 + (i % 3) * 0.7, z: -2.0 + Math.floor(i / 3) * 0.9, sx: 0.05, sy: 0.5, sz: 0.18, color: c, collide: false });
  });

  addBox(scene, colliders, { x: 0, y: 0.005, z: 2.0, sx: 3.5, sy: 0.01, sz: 2.6, color: '#ffffff', map: carpetTexture('#7a3b3b'), collide: false });

  const lampX = COUCH.x + 1.35, lampZ = COUCH.z + 0.6;
  addCylinder(scene, colliders, { x: lampX, y: 0.75, z: lampZ, radiusTop: 0.025, radiusBottom: 0.04, height: 1.5, color: '#2a2a2a', collide: true });
  addSphere(scene, { x: lampX, y: 1.55, z: lampZ, radius: 0.22, color: '#f2e2b8', emissive: '#f2c878' });
  const lampLight = new THREE.PointLight(0xffcf8a, 0.7, 6, 2);
  lampLight.position.set(lampX, 1.5, lampZ);
  scene.add(lampLight);

  // ---------- Lighting + fog (graphics-preset driven) ----------
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xfff2d0, 1.1);
  sunLight.position.set(-6, 8, -10);
  if (preset.shadows) {
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    sunLight.shadow.camera.left = -10; sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10; sunLight.shadow.camera.bottom = -10;
    sunLight.shadow.camera.far = 40;
  }
  scene.add(sunLight);
  scene.fog = new THREE.Fog(0xbcd9ea, 8, preset.fogFar);

  let horrorLevel = 0;
  function applyHorrorVisuals(level) {
    horrorLevel = level;
    const normalFog = new THREE.Color(0xbcd9ea), eerieFog = new THREE.Color(0x11131c);
    scene.fog.color.copy(normalFog).lerp(eerieFog, level);
    sunLight.intensity = lerp(1.1, 0.3, level);
    ambientLight.intensity = lerp(0.5, 0.2, level);
    lampLight.intensity = lerp(0.7, 1.5, level);
    setHorrorIntensity(level);
  }

  // ---------- Mirror TV (real render-to-texture "screen behind you") ----------
  const mirrorTarget = new THREE.WebGLRenderTarget(512, 384, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const mirrorCamera = new THREE.PerspectiveCamera(58, 512 / 384, 0.1, 40);
  mirrorCamera.position.set(0, 2.3, -4.6);
  mirrorCamera.lookAt(0, 1.5, 4);
  mirrorCamera.layers.enable(1); // sees layer-1 "phantom" objects the main camera never does
  const mirrorScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: mirrorTarget.texture }));
  mirrorScreen.position.set(0, 1.9, 5.86);
  mirrorScreen.rotation.y = Math.PI;
  // Layer 3 is "main camera only" - keeps the screen mesh out of its own render target
  // (otherwise the mirror would recursively frame itself every frame).
  mirrorScreen.layers.set(3);
  camera.layers.enable(3);
  scene.add(mirrorScreen);
  addBox(scene, colliders, { x: 0, y: 1.9, z: 5.93, sx: 2.8, sy: 1.8, sz: 0.08, color: '#111111', collide: false });

  // ---------- Shotgun viewmodel ----------
  function buildShotgun() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.4, metalness: 0.6 });
    const wood = new THREE.MeshStandardMaterial({ color: '#5c3a20', roughness: 0.7 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.85, 10), metal);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0, 0.05, -0.55);
    group.add(barrel);
    const pumpMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), wood);
    pumpMesh.rotation.z = Math.PI / 2;
    pumpMesh.position.set(0, 0.02, -0.35);
    group.add(pumpMesh);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.25), metal);
    receiver.position.set(0, 0.03, -0.12);
    group.add(receiver);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.5), wood);
    stock.position.set(0, -0.01, 0.18);
    group.add(stock);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), wood);
    grip.position.set(0, -0.08, -0.02);
    grip.rotation.x = 0.3;
    group.add(grip);
    return { group, pumpMesh };
  }
  const gun = buildShotgun();
  const gunBase = { x: 0.28, y: -0.28, z: -0.55 };
  const gunPumpBaseZ = -0.35;
  gun.group.position.set(gunBase.x, gunBase.y, gunBase.z);
  gun.group.rotation.y = -0.04;
  camera.add(gun.group);

  function playRecoil() {
    tween(80, p => {
      gun.group.position.z = gunBase.z + p * 0.1;
      gun.group.rotation.x = -p * 0.14;
    }).then(() => tween(180, p => {
      gun.group.position.z = lerp(gunBase.z + 0.1, gunBase.z, p);
      gun.group.rotation.x = lerp(-0.14, 0, p);
    }, easeInOut));
    tween(70, p => { gun.pumpMesh.position.z = gunPumpBaseZ - p * 0.1; })
      .then(() => tween(160, p => { gun.pumpMesh.position.z = lerp(gunPumpBaseZ - 0.1, gunPumpBaseZ, p); }));
  }

  // ---------- Dog ----------
  const dog = buildDog();
  dog.group.visible = false;
  dog.shootable = false;
  dog.staring = false;
  dog.busy = false;
  scene.add(dog.group);
  const DOG_HOME = { x: 0, z: -7.2 };

  function dogLegCycle(phase) {
    dog.legs[0].rotation.x = Math.sin(phase) * 0.6;
    dog.legs[1].rotation.x = -Math.sin(phase) * 0.6;
    dog.legs[2].rotation.x = -Math.sin(phase) * 0.6;
    dog.legs[3].rotation.x = Math.sin(phase) * 0.6;
  }
  function dogRest() { dog.legs.forEach(l => { l.rotation.x = 0; }); }
  function dogWalkTo(toX, toZ, duration) {
    dog.busy = true;
    const fromX = dog.group.position.x, fromZ = dog.group.position.z;
    dog.group.rotation.y = Math.atan2(-(toZ - fromZ), (toX - fromX));
    return tween(duration, p => {
      dog.group.position.x = lerp(fromX, toX, p);
      dog.group.position.z = lerp(fromZ, toZ, p);
      dogLegCycle(p * 20);
      dog.tailPivot.rotation.y = Math.sin(p * 20) * 0.4;
    }).then(() => { dogRest(); dog.busy = false; });
  }
  function showDog() {
    dog.group.visible = true;
    dog.group.position.set(DOG_HOME.x, 0, DOG_HOME.z);
    dog.group.rotation.y = -Math.PI / 2;
    dog.shootable = true;
  }
  function hideDog() {
    dog.group.visible = false;
    dog.shootable = false;
    dog.staring = false;
  }
  function dogLaughBounce() {
    return tween(1000, p => {
      dog.headPivot.rotation.z = Math.sin(p * Math.PI * 5) * 0.3;
      dog.group.position.y = Math.abs(Math.sin(p * Math.PI * 5)) * 0.08;
    }).then(() => { dog.group.position.y = 0; dog.headPivot.rotation.z = 0; });
  }

  // ---------- Ducks ----------
  const ducks = [];
  let ducksSpawnedTotal = 0;
  const raycaster = new THREE.Raycaster();
  const DUCK_COLORS = ['#5a4a3a', '#3d4f3a', '#4a3d52', '#4a3a2f'];

  function spawnDuck(n) {
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -9 : 9, endX = fromLeft ? 9 : -9;
    const z = randRange(-20, -9);
    const baseY = randRange(2.6, 5.6);
    const amplitude = randRange(0.5, 1.3);
    const duration = Math.max(3500, (7500 - (n - 1) * 700)) * randRange(0.9, 1.1);
    const parts = buildDuck(DUCK_COLORS[Math.floor(Math.random() * DUCK_COLORS.length)]);
    parts.group.position.set(startX, baseY, z);
    parts.group.rotation.y = fromLeft ? Math.PI / 2 : -Math.PI / 2;
    scene.add(parts.group);
    playDuckQuack();
    ducksSpawnedTotal++;
    const rec = {
      mesh: parts.group, parts, state: 'flying', startTime: performance.now(), duration,
      startX, endX, z, baseY, amplitude, phase: Math.random() * 10, fallVel: 0, resolveFate: null,
    };
    rec.fate = new Promise(res => { rec.resolveFate = res; });
    ducks.push(rec);
    return rec.fate;
  }

  function updateDucks(dt, elapsed) {
    ducks.forEach(d => {
      if (d.state === 'flying') {
        const p = clamp((performance.now() - d.startTime) / d.duration, 0, 1);
        d.mesh.position.x = lerp(d.startX, d.endX, p);
        d.mesh.position.y = d.baseY + Math.sin(p * Math.PI * 3 + d.phase) * d.amplitude;
        d.mesh.position.z = d.z;
        d.parts.lWing.rotation.x = Math.sin(elapsed * 16 + d.phase) * 0.8;
        d.parts.rWing.rotation.x = Math.sin(elapsed * 16 + d.phase) * 0.8;
        if (p >= 1) { d.state = 'escaped'; d.resolveFate(); }
      } else if (d.state === 'falling') {
        d.fallVel += 14 * dt;
        d.mesh.position.y -= d.fallVel * dt;
        d.mesh.rotation.z += dt * 9;
        d.mesh.rotation.x += dt * 4;
        if (d.mesh.position.y <= 0.15) { d.mesh.position.y = 0.15; d.state = 'down'; d.resolveFate(); }
      }
    });
  }

  function cleanupResolvedDucks() {
    for (let i = ducks.length - 1; i >= 0; i--) {
      const d = ducks[i];
      if (d.state === 'escaped' || d.state === 'retrieved' || d.state === 'down') {
        disposeObject3D(d.mesh);
        scene.remove(d.mesh);
        ducks.splice(i, 1);
      }
    }
  }

  async function retrieveDownedDucks() {
    const downed = ducks.filter(d => d.state === 'down').slice(0, 3);
    for (const d of downed) {
      if (ended) return;
      await dogWalkTo(d.mesh.position.x, d.mesh.position.z, 1400);
      if (ended) return;
      d.mesh.visible = false;
      d.state = 'retrieved';
      await wait(250);
      if (ended) return;
      await dogWalkTo(DOG_HOME.x, DOG_HOME.z, 1200);
    }
  }

  // ---------- Escalation beats ----------
  async function phantomOnCouch() {
    const phantom = buildDog('#8a6a4a', '#5c4530');
    phantom.group.position.set(COUCH_TOP.x, COUCH_TOP.y, COUCH_TOP.z);
    phantom.group.rotation.y = Math.PI / 2;
    scene.add(phantom.group);
    playDogGrowlSting();
    triggerDomGlitch(250);
    await wait(1900);
    triggerDomGlitch(300);
    disposeObject3D(phantom.group);
    scene.remove(phantom.group);
    await wait(200);
  }

  async function phantomInMirror() {
    const phantom = buildDog('#7a5a3a', '#4a3620');
    phantom.group.traverse(o => { if (o.isMesh) o.layers.set(1); });
    phantom.group.position.set(1.1, 0.3, 3.2);
    phantom.group.rotation.y = Math.PI;
    scene.add(phantom.group);
    playDogGrowlSting();
    await wait(2500);
    disposeObject3D(phantom.group);
    scene.remove(phantom.group);
  }

  async function runWeirdBeat(n) {
    const level = clamp((n - 2) / 3, 0, 1);
    applyHorrorVisuals(level);
    if (n === 3) {
      playDogGrowlSting();
      showFlavorText("It stops. It's just... staring at you.", 2800);
      dog.staring = true;
      await wait(2200);
      dog.staring = false;
      unlock('something_off');
      if (!ended) unlock('dont_look_away');
    } else if (n === 4) {
      showFlavorText("Wait - how did it get inside?", 2600);
      await phantomOnCouch();
      unlock('something_off');
      if (!ended) unlock('dont_look_away');
    } else if (n === 5) {
      showFlavorText("The screen behind you shows something that isn't there.", 3000);
      await phantomInMirror();
    }
  }

  async function runConfrontation() {
    showFlavorText('Something about this round feels different.', 2600);
    applyHorrorVisuals(1);
    await wait(1400);
    if (ended) return 'shot';
    showDog();
    dog.group.position.set(0, 0, -4.5);
    dog.group.rotation.y = -Math.PI / 2;
    dog.staring = true;
    playDogGrowlSting();
    showFlavorText("It's just standing there. Staring. It hasn't blinked once.", 3600);
    await wait(600);

    const holdDuration = 7000;
    const start = performance.now();
    let backHeldMs = 0;
    let outcome = null;
    while (performance.now() - start < holdDuration) {
      if (ended) { outcome = 'shot'; break; }
      if (controller.move.back) {
        backHeldMs += 120;
        if (backHeldMs >= 1000) { outcome = 'fled'; break; }
      }
      await wait(120);
    }
    if (!outcome) outcome = ended ? 'shot' : 'stood';
    dog.staring = false;

    if (outcome === 'fled') {
      showFlavorText("You back away. The dog doesn't follow. It just watches you go.", 2800);
      await wait(1400);
    } else if (outcome === 'stood') {
      showFlavorText("You hold your ground. Slowly, its ears relax. It sits.", 3000);
      playDogBark();
      await tween(600, p => { dog.headPivot.rotation.x = -Math.sin(p * Math.PI) * 0.2; });
      await wait(1200);
    }
    hideDog();
    return outcome;
  }

  async function runPeacefulEnding() {
    showDog();
    dog.group.position.set(DOG_HOME.x, 0, DOG_HOME.z);
    showFlavorText('The dog trots over and just... sits with you. Huh.', 3200);
    await dogWalkTo(0, 3.6, 1800);
    await tween(1200, p => {
      dog.tailPivot.rotation.y = Math.sin(p * Math.PI * 8) * 0.6;
      dog.group.position.y = Math.abs(Math.sin(p * Math.PI * 6)) * 0.05;
    });
    dog.group.position.y = 0;
    await wait(800);
  }

  // ---------- Score / round state ----------
  let score = 0, shells = 3, maxShells = 3, roundNumber = 0;
  let ducksHitTotal = 0, missesTotal = 0, totalShotsFired = 0, consecutiveMisses = 0;
  let ducksHitThisRound = 0, missesThisRound = 0;
  let reloading = false, reloadFinishedAt = 0;
  let ended = false;
  let inputEnabled = true;

  function reportHud() {
    onHud({ score, shells, maxShells, round: roundNumber, totalRounds: ROUND_DUCK_COUNTS.length });
  }

  function hitDuck(d) {
    d.state = 'falling';
    playDuckHitSquawk();
    ducksHitTotal++; ducksHitThisRound++;
    consecutiveMisses = 0;
    score += 100 + roundNumber * 10;
    if (ducksHitTotal === 1) unlock('first_duck');
    reportHud();
  }

  function registerMiss() {
    missesTotal++; missesThisRound++;
    consecutiveMisses++;
    if (consecutiveMisses >= 5) unlock('cold_streak');
  }

  function finishGame(extra) {
    if (ended) return;
    ended = true;
    inputEnabled = false;
    hideDog();
    onGameEnd({
      score, ducksHit: ducksHitTotal, ducksTotal: ducksSpawnedTotal, misses: missesTotal,
      totalShots: totalShotsFired, dogShot: false, pacifist: totalShotsFired === 0,
      confrontationOutcome: extra.confrontationOutcome || 'none',
    });
  }

  function hitDog() {
    if (ended) return;
    playDogYelp();
    // A quick startled flinch - cartoonish, not graphic: ears back, a step away, then still.
    const fromX = dog.group.position.x, fromZ = dog.group.position.z;
    const awayAngle = dog.group.rotation.y;
    tween(450, p => {
      dog.headPivot.rotation.x = -p * 0.4;
      dog.group.position.x = fromX - Math.sin(awayAngle) * p * 0.3;
      dog.group.position.z = fromZ - Math.cos(awayAngle) * p * 0.3;
    });
    ended = true;
    inputEnabled = false;
    const stats = {
      score, ducksHit: ducksHitTotal, ducksTotal: ducksSpawnedTotal, misses: missesTotal,
      totalShots: totalShotsFired, dogShot: true, pacifist: false, confrontationOutcome: 'shot',
    };
    wait(900).then(() => onGameEnd(stats));
  }

  function fire() {
    if (!inputEnabled || ended || reloading) return;
    if (shells <= 0) { playEmptyClick(); return; }
    shells--;
    totalShotsFired++;
    if (totalShotsFired === 1) unlock('first_shot');
    playShotgunBlast();
    playRecoil();
    reportHud();

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    raycaster.set(camera.position, forward);
    raycaster.far = 90;
    const targets = [];
    const map = new Map();
    ducks.filter(d => d.state === 'flying').forEach(d => {
      d.mesh.traverse(o => { if (o.isMesh) { targets.push(o); map.set(o, { type: 'duck', ref: d }); } });
    });
    if (dog.shootable) dog.group.traverse(o => { if (o.isMesh) { targets.push(o); map.set(o, { type: 'dog' }); } });

    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const info = map.get(hits[0].object);
      if (info.type === 'duck') hitDuck(info.ref); else hitDog();
    } else {
      registerMiss();
    }
    if (reloadFinishedAt && performance.now() - reloadFinishedAt < 1500) unlock('reload_pressure');
  }

  async function reload() {
    if (!inputEnabled || ended || reloading || shells === maxShells) return;
    reloading = true;
    playPump();
    await tween(550, p => {
      gun.group.rotation.z = Math.sin(p * Math.PI) * 0.25;
      gun.group.position.y = gunBase.y - Math.sin(p * Math.PI) * 0.05;
    });
    playPump();
    await wait(250);
    shells = maxShells;
    reloadFinishedAt = performance.now();
    reloading = false;
    reportHud();
  }

  function onMouseDown(e) { if (e.button === 0 && controller.isLocked) fire(); }
  function onKeyDown(e) { if (e.code === 'KeyR') reload(); }
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('keydown', onKeyDown);

  // ---------- Round orchestration ----------
  async function runIntermission(n) {
    if (ended) return;
    if (missesThisRound === 0 && ducksHitThisRound === ROUND_DUCK_COUNTS[n - 1]) unlock('perfect_round');
    if (n === 1) unlock('round1_clear');
    if (n === 3) unlock('round3_clear');
    if (n === 5) unlock('final_round_clear');

    showDog();
    await retrieveDownedDucks();
    if (ended) return;

    if (missesThisRound >= 3) {
      playDogLaugh();
      showFlavorText(LAUGH_LINES[Math.floor(Math.random() * LAUGH_LINES.length)]);
      await dogLaughBounce();
    }
    if (ended) return;

    if (n >= 3) await runWeirdBeat(n);
    if (ended) return;

    hideDog();
    missesThisRound = 0; ducksHitThisRound = 0;
    cleanupResolvedDucks();

    if (n === 5) await concludeGame();
  }

  async function concludeGame() {
    if (ended) return;
    if (totalShotsFired === 0) {
      await runPeacefulEnding();
      finishGame({ confrontationOutcome: 'skipped' });
      return;
    }
    const outcome = await runConfrontation();
    if (ended) return;
    finishGame({ confrontationOutcome: outcome });
  }

  async function runRound(n) {
    if (ended) return;
    roundNumber = n;
    reportHud();
    showBanner(`Round ${n}`, 1400);
    await wait(1600);
    if (ended) return;

    const count = ROUND_DUCK_COUNTS[n - 1];
    const stagger = Math.max(500, 1400 - (n - 1) * 150);
    const fates = [];
    for (let i = 0; i < count; i++) {
      if (ended) return;
      fates.push(spawnDuck(n));
      await wait(stagger);
    }
    await Promise.all(fates);
    if (ended) return;
    await runIntermission(n);
    if (ended || n >= ROUND_DUCK_COUNTS.length) return;
    await runRound(n + 1);
  }

  showBanner('The screen flickers to life...', 1800);
  wait(2000).then(() => { if (!ended) runRound(1); });
  reportHud();

  // ---------- Frame update ----------
  function updateGunBob(dt, elapsed) {
    const moving = controller.isMoving && !reloading;
    const targetY = gunBase.y + (moving ? Math.sin(elapsed * 10) * 0.012 : 0);
    const targetX = gunBase.x + (moving ? Math.sin(elapsed * 5) * 0.006 : 0);
    gun.group.position.y = damp(gun.group.position.y, targetY, 9, dt);
    gun.group.position.x = damp(gun.group.position.x, targetX, 9, dt);
  }
  function updateDogIdle(dt, elapsed) {
    if (!dog.group.visible || dog.busy) return;
    if (dog.staring) {
      const dx = camera.position.x - dog.group.position.x;
      const dz = camera.position.z - dog.group.position.z;
      dog.group.rotation.y = damp(dog.group.rotation.y, Math.atan2(-dz, dx), 4, dt);
    } else {
      dog.tailPivot.rotation.y = Math.sin(elapsed * 7) * 0.5;
    }
  }

  function update(dt, elapsed) {
    updateDucks(dt, elapsed);
    updateGunBob(dt, elapsed);
    updateDogIdle(dt, elapsed);
    if (horrorLevel > 0 && Math.random() < horrorLevel * dt * 0.6) triggerDomGlitch(140);
    // Keep the mirror render target rendered every frame from a second camera - the actual
    // draw call happens in main.js's render loop, which reads `mirror` off this bundle.
  }

  function dispose() {
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('keydown', onKeyDown);
    camera.remove(gun.group);
    mirrorTarget.dispose();
    disposeObject3D(scene);
  }

  return {
    scene, colliders, interactables: [],
    spawn: { x: 0, y: 1.65, z: 4.2, yaw: 0 },
    floorSurface: 'carpet', update, dispose,
    mirror: { camera: mirrorCamera, target: mirrorTarget },
  };
}
