// temporary preview boot (replaced by the real main loop)
const UI = { toast() {} }, Sfx = { play() {} }, Music = { sting() {} }, Monsters = { nightChange() {} };
const DEV = { cam: { x: 0, y: 40, z: 260, yaw: 0, pitch: -0.15 } };
function devBoot() {
  makeTextures(); makeMaterials(); genTerrain(); initRenderer();
  WORLD.root = new THREE.Group(); scene.add(WORLD.root);
  buildGround(); buildWater(); buildTreeTypes(); placeTrees(); buildRocksAndBushes(); buildGrass(); buildHerbs(); buildLightPool(); buildPlaces(); RainFX.init();
  $('#loading').hidden = true;
}
function devFrame(dt) {
  const c = DEV.cam; camera.position.set(c.x, c.y, c.z); camera.rotation.set(c.pitch, c.yaw, 0, 'YXZ');
  G.time += dt; Weather.tick(dt); updateSkyAndLight(dt, camera.position); updateGroundLOD(c.x, c.z); updateTrees(c.x, c.z); updateGrass(c.x, c.z); updateWater(dt); updateLights(dt, c.x, c.y, c.z); updateAnims(dt, G.time);
  RainFX.update(dt, Weather.rainK(), false);
  renderer.clear(); renderer.render(scene, camera);
}
window.addEventListener('load', () => { try { devBoot(); } catch (e) { console.error(e); } });
