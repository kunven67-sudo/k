
// ---------- startup: build the world, generate the forests, load the knights ----------
buildWorld();
let modelReady = false;
const loader = new GLTFLoader();
loadScans(() => { try { buildNature(); } catch (e) { console.error('nature failed', e); natureReady = true; } });
// a real photographed sky lights and reflects on everything in daytime
new RGBELoader().load('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr', (t) => { t.mapping = THREE.EquirectangularReflectionMapping; hdrEnv = pmrem.fromEquirectangular(t).texture; t.dispose(); });
loadGLB(loader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb', (gltf) => {
  soldierGLTF = gltf; modelReady = true;
}, (err) => { console.error(err); $('loadText').textContent = 'Could not load the knight model. Check your internet and refresh.'; $('playBtn').textContent = 'LOAD FAILED'; });
loadFaces(loader);
let worldStarted = false;
function checkReady() {
  const pct = Math.round(((texDone / Math.max(1, texPending)) * 0.35 + (modelReady ? 0.15 : 0) + (scansLoaded / SCANS.length) * 0.45 + (natureReady ? 0.05 : 0)) * 100);
  if (!worldStarted) $('loadText').textContent = 'Loading the world... ' + pct + '%';
  if (worldStarted || !modelReady || !natureReady || !facesReady || texDone < texPending) return;
  worldStarted = true;
  player = createPlayer();
  initVillage();
  initLegends();
  for (const c of CAMPS.slice(0, 5)) { const n = 2 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) spawnKnight(c); c.respawn = 45; }
  ui.weaponCard();
  captureSkyEnv(sunDir, true);
  $('playBtn').disabled = false; $('playBtn').textContent = 'PLAY';
  $('loadText').textContent = 'Ready.';
}
$('playBtn').onclick = () => {
  if (!worldStarted) return;
  audioInit();
  $('title').style.display = 'none';
  $('hud').classList.add('on');
  playing = true; paused = false;
  requestLock();
  ui.message('IRONBLOOD', 1.8);
  setTimeout(() => ui.sub('Knights are camped around the fields. Move the mouse while you click to pick your swing.', 5), 1200);
  ui.hotbar();
  if (!magic.intro) { magic.intro = 1; saveMagic(true); setTimeout(() => { ui.message('MAGIC', 1.6); ui.sub('You still remember the one spell your mother taught you: Water Ball. Hold R to chant it, let go to cast. G opens your spellbook.', 7); }, 7000); }
};
$('respawnBtn').onclick = () => {
  $('death').style.display = 'none';
  respawnPlayer(); deathShown = false; deathT = 0;
  ui.weaponCard(); requestLock(); paused = false;
};

// ---------- main loop ----------
const clock = new THREE.Clock();
let animTick = 0;
initTalk();
initCastBox();
let fpsAcc = 0, fpsFrames = 0, elapsed = 0, deathShown = false, deathT = 0, titleOrbit = 0;
const capeCols = [{ x: 0, y: 0, z: 0, r: 0.21 }, { x: 0, y: 0, z: 0, r: 0.2 }, { x: 0, y: 0, z: 0, r: 0.12 }, { x: 0, y: 0, z: 0, r: 0.12 }];
const _cv = new THREE.Vector3();
function frame() {
  requestAnimationFrame(frame);
  const realDt = Math.min(clock.getDelta(), 0.05);
  let scale = 1;
  if (hitStopT > 0) { hitStopT -= realDt; scale = 0.1; }
  if (slowmoT > 0) { slowmoT -= realDt; scale *= slowmo; if (slowmoT <= 0) slowmo = 1; }
  if (finisherCam > 0) finisherCam -= realDt;
  const live = playing && !paused && worldStarted;
  const dt = live ? realDt * scale : 0;
  // tests can run the world several steps per drawn frame (fast-forward)
  const reps = live && window.__steps ? window.__steps : 1;
  for (let rep = 0; rep < reps; rep++) {
  clockNow += dt;
  if (live) { elapsed += dt; dayT = (dayT + dt / DAY_SECONDS) % 1; }

  if (worldStarted) {
    if (live) {
      updatePlayer(dt);
      for (const f of fighters) if (f.ai) { tickVitals(f, dt); updateKnight(f, dt); if (!f.alive || f.down) f.updateFall(dt); }
      for (const f of fighters) updateAttack(f, dt);
      updateVillage(dt);
      updateVillageMagic(dt);
      updateSpawns(realDt);
    }
    animTick++;
    for (const f of fighters) {
      if (f.inside) continue;
      // far away people move their bodies less often (saves a lot of time)
      const far = !f.isPlayer && f.alive && f.pos.distanceToSquared(camera.position) > 45 * 45;
      if (far && f.animatedOnce && (animTick + f.animSlot) % 3) { f.skipDt = (f.skipDt || 0) + dt; continue; }
      if (live || !f.animatedOnce) { f.animate(live ? dt + (f.skipDt || 0) : 0.016); f.skipDt = 0; f.animatedOnce = true; }
      if (f.staff) placeStaff(f);
      f.armor.uniforms.uBlood.value = f.blood;
      if (f.cape && live) {
        f.b.Spine1.getWorldPosition(_cv); Object.assign(capeCols[0], { x: _cv.x, y: _cv.y, z: _cv.z });
        f.b.Hips.getWorldPosition(_cv); Object.assign(capeCols[1], { x: _cv.x, y: _cv.y, z: _cv.z });
        f.b.LeftLeg.getWorldPosition(_cv); Object.assign(capeCols[2], { x: _cv.x, y: _cv.y + 0.2, z: _cv.z });
        f.b.RightLeg.getWorldPosition(_cv); Object.assign(capeCols[3], { x: _cv.x, y: _cv.y + 0.2, z: _cv.z });
        f.cape.update(Math.max(dt, 0.001), f.root, capeCols);
      }
    }
    if (live) updateScene(dt);
    updateMagic(dt, realDt, elapsed);
    updateLegends(dt, realDt);
    gore.update(dt);
    // death screen
    if (!player.alive && playing) {
      deathT += realDt;
      if (deathT > 2.6 && !deathShown) {
        deathShown = true; playerDied();
        $('deathSub').textContent = 'Killed by ' + (player.lastHitBy ? player.lastHitBy.name : 'blood loss') + (settings.hard ? '. Hardcore: your strength is gone.' : '.');
        $('death').style.display = 'flex'; paused = true;
        if (document.pointerLockElement) document.exitPointerLock();
      }
    }
  }
  }
  checkReady();
  updateGrass(player.pos.x, player.pos.z, false);
  const wt = elapsed + performance.now() * 0.0002;
  grassUniforms.uTime.value = wt;
  grassUniforms.uPlayer.value.copy(player.pos);
  const lightK = updateSky(realDt);
  captureSkyEnv(sunDir, false);
  animateLife(dt, elapsed, player.pos);
  updateWeather(realDt, wt);
  updateMagicWorld(dt * reps, realDt, wt);
  updateFires(realDt, wt, lightK.night);
  clothUniforms.uTime.value = wt;
  if (natureReady) updateNature(realDt, wt);
  river.material.uniforms.time.value += realDt * 0.35;
  river.material.uniforms.sunDirection.value.copy(sunDir);
  const dayK = smooth(-0.04, 0.12, sunDir.y);
  updateAmbience(realDt, dayK);
  let inFight = false;
  for (const f of fighters) if (f.ai && f.alive && f.ai.alert && f.pos.distanceTo(player.pos) < 30) { inFight = true; break; }
  updateMusic(inFight && player.alive);
  if (window.__camOv) { camera.position.copy(window.__camOv.p); camera.lookAt(window.__camOv.t); } // test shots only
  else if (playing && worldStarted) { updateCamera(realDt); cameraFx(elapsed); eyeCamera(); }
  else {
    // title screen: slow drift around the field
    titleOrbit += realDt * 0.05;
    const cx = SQUARE.x, cz = SQUARE.z;
    camera.position.set(cx + Math.cos(titleOrbit) * 34, groundH(cx, cz) + 9, cz + Math.sin(titleOrbit) * 34);
    camera.lookAt(cx, groundH(cx, cz) + 3, cz);
  }
  sun.position.copy(player.pos).addScaledVector(sunDir, 90); sun.target.position.copy(player.pos);
  moon.position.copy(player.pos).addScaledVector(sunDir, -90); moon.target.position.copy(player.pos);
  stars.position.copy(camera.position);
  if (playing && worldStarted) ui.update(realDt);
  composer.render();
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsFrames / fpsAcc) + ' FPS | ' + qName; fpsAcc = 0; fpsFrames = 0; }
}
updateGrass(player.pos.x, player.pos.z, true);
frame();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
window.__game = { get player() { return player; }, fighters, setTime: (h) => { dayT = h / 24; }, keys, mouse, settings, gore, stats, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, startAttack: (d, k) => player.startAttack(d, k), start: () => { audioInit(); $('title').style.display = 'none'; $('hud').classList.add('on'); playing = true; paused = false; } };
window.__V = { villagers, vsave, openTalk, say, startRaid, startScene, endTalk, openShop, closeShop, raid, interactTarget, get talk() { return talk; }, get scene() { return scene0; }, get uiOpen() { return uiOpen; }, get state() { return { paused, playing, hitStopT, slowmo, slowmoT, cutscene, uiOpen, passedOut, finisherCam }; } };
window.__W = { SQUARE, CASTLE, BRIDGE, BATTLE_X, FORTRESS, groundH };
window.__dbg = () => ({ modelReady, natureReady, texDone, texPending, worldStarted, scans: scansLoaded + '/' + SCANS.length, cells: natureCells.size, inst: [...natureCells.values()].flat().reduce((a, m) => a + m.count, 0), fps: $('fps').textContent });
window.__R = { renderer, composer, camera };
window.__pause = (v) => { paused = v; }; window.__book = () => openBook(); window.__riverDist = (x, z) => riverDist(x, z); window.__houses = VHOUSES;
window.__solid = (x, z, pad) => solidAt(x, z, pad); window.__clear = (x, z, r) => !circles.some(c => (c.x - x) ** 2 + (c.z - z) ** 2 < r * r) && riverDist(x, z) > 25 && slopeAt(x, z) < 0.2;
window.__M = { get elapsed() { return elapsed; }, magic, SPELL, castSpell, learnSpell, cast, startChant, releaseChant, spawnMage, CAMPS, ignite, igniteDisc, burning, freezeWater, iceSheets, knockDown, mfx, projs, effects, wind, get lockTarget() { return lockTarget; }, set lockTarget(v) { lockTarget = v; } };
