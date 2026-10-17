
// ---------- startup ----------
const loader = new GLTFLoader();
loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Soldier.glb', (gltf) => {
  soldierGLTF = gltf;
  player = createPlayer();
  for (const c of CAMPS.slice(0, 4)) { const n = 2 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) spawnKnight(c); c.respawn = 45; }
  ui.weaponCard();
  $('playBtn').disabled = false; $('playBtn').textContent = 'PLAY';
  $('loadText').textContent = 'Ready.';
}, (e) => { if (e.total) $('loadText').textContent = 'Loading the knights... ' + Math.round(e.loaded / e.total * 100) + '%'; },
(err) => { console.error(err); $('loadText').textContent = 'Could not load the knight model. Check your internet and refresh.'; $('playBtn').textContent = 'LOAD FAILED'; });

$('playBtn').onclick = () => {
  if (!soldierGLTF) return;
  audioInit();
  $('title').style.display = 'none';
  $('hud').classList.add('on');
  playing = true; paused = false;
  requestLock();
  ui.message('IRONBLOOD', 1.8);
  setTimeout(() => ui.sub('Knights are camped around the fields. Move the mouse while you click to pick your swing.', 5), 1200);
};
$('respawnBtn').onclick = () => {
  $('death').style.display = 'none';
  respawnPlayer(); deathShown = false; deathT = 0;
  ui.weaponCard(); requestLock(); paused = false;
};

// ---------- main loop ----------
const clock = new THREE.Clock();
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
  const live = playing && !paused && soldierGLTF;
  const dt = live ? realDt * scale : 0;
  clockNow += dt;
  if (live) { elapsed += dt; dayT = (dayT + dt / DAY_SECONDS) % 1; }

  if (soldierGLTF && player.alive !== undefined) {
    if (live) {
      updatePlayer(dt);
      for (const f of fighters) if (f.ai) { tickVitals(f, dt); updateKnight(f, dt); if (!f.alive || f.down) f.updateFall(dt); }
      for (const f of fighters) updateAttack(f, dt);
      updateSpawns(realDt);
    }
    for (const f of fighters) {
      if (live || !f.animatedOnce) { f.animate(live ? dt : 0.016); f.animatedOnce = true; }
      f.armor.uniforms.uBlood.value = f.blood;
      if (f.cape && live) {
        f.b.Spine1.getWorldPosition(_cv); Object.assign(capeCols[0], { x: _cv.x, y: _cv.y, z: _cv.z });
        f.b.Hips.getWorldPosition(_cv); Object.assign(capeCols[1], { x: _cv.x, y: _cv.y, z: _cv.z });
        f.b.LeftLeg.getWorldPosition(_cv); Object.assign(capeCols[2], { x: _cv.x, y: _cv.y + 0.2, z: _cv.z });
        f.b.RightLeg.getWorldPosition(_cv); Object.assign(capeCols[3], { x: _cv.x, y: _cv.y + 0.2, z: _cv.z });
        f.cape.update(Math.max(dt, 0.001), f.root, capeCols);
      }
    }
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
  updateGrass(player.pos.x, player.pos.z, false);
  grassUniforms.uTime.value = elapsed + performance.now() * 0.0002;
  grassUniforms.uPlayer.value.copy(player.pos);
  updateSky();
  animateLife(dt, elapsed);
  const dayK = smooth(-0.04, 0.12, sunDir.y);
  updateAmbience(realDt, dayK);
  let inFight = false;
  for (const f of fighters) if (f.ai && f.alive && f.ai.alert && f.pos.distanceTo(player.pos) < 30) { inFight = true; break; }
  updateMusic(inFight && player.alive);
  if (playing && soldierGLTF) updateCamera(realDt);
  else {
    // title screen: slow drift around the field
    titleOrbit += realDt * 0.05;
    const cx = SPAWN.x, cz = SPAWN.z;
    camera.position.set(cx + Math.cos(titleOrbit) * 9, groundH(cx, cz) + 2.4, cz + Math.sin(titleOrbit) * 9);
    camera.lookAt(cx, groundH(cx, cz) + 1.2, cz);
  }
  sun.position.copy(player.pos).addScaledVector(sunDir, 90); sun.target.position.copy(player.pos);
  moon.position.copy(player.pos).addScaledVector(sunDir, -90); moon.target.position.copy(player.pos);
  envIntensity(dayK);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  if (playing && soldierGLTF) ui.update(realDt);
  renderer.render(scene, camera);
  fpsAcc += realDt; fpsFrames++;
  if (fpsAcc > 0.5) { $('fps').textContent = Math.round(fpsFrames / fpsAcc) + ' FPS | ' + qName; fpsAcc = 0; fpsFrames = 0; }
}
// metal reflections dim at night
let lastEnvK = -1;
function envIntensity(k) {
  const v = 0.25 + 0.75 * k;
  if (Math.abs(v - lastEnvK) < 0.02) return;
  lastEnvK = v;
  scene.traverse(o => { if (o.material && o.material.envMap) o.material.envMapIntensity = (o.material.metalness > 0.95 ? 1.2 : 0.9) * v; });
}
updateGrass(player.pos.x, player.pos.z, true);
frame();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
window.__game = { get player() { return player; }, fighters, setTime: (h) => { dayT = h / 24; }, keys, mouse, settings, gore, stats, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, startAttack: (d, k) => player.startAttack(d, k), start: () => { audioInit(); $('title').style.display = 'none'; $('hud').classList.add('on'); playing = true; paused = false; } };
