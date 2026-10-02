// temporary preview boot (replaced by the real main loop)
const UI = { toast() {} }, Monsters = { nightChange() {} };
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
DEV.gallery = function () {
  const list = [['hero', () => buildHuman(LOOK_PRESETS.wolfborn && lookFromPreset('wolfborn'))], ['hale', () => buildHuman(PEOPLE.hale.look)], ['maud', () => buildHuman(PEOPLE.maud.look)], ['werewolf', () => buildMonsterModel('werewolf')], ['ghoul', () => buildMonsterModel('ghoul')], ['vampire', () => buildMonsterModel('vampire')], ['drowner', () => buildMonsterModel('drowner')], ['troll', () => buildMonsterModel('troll')], ['lord', () => buildMonsterModel('lord_vargrave')], ['demon', () => buildMonsterModel('azgoreth')], ['wolf', () => buildMonsterModel('wolf')], ['deer', () => buildMonsterModel('deer')], ['rabbit', () => buildMonsterModel('rabbit')], ['crow', () => buildMonsterModel('crow')], ['horse', () => buildQuad('horse', 0x5a3a24, 1)], ['wyvern', () => buildMonsterModel('wyvern')]];
  DEV.rigs = [];
  list.forEach(([n, f], i) => { const r = f(); const x = 3 + (i % 8) * 3.4, z = 172 - Math.floor(i / 8) * 6; r.root.position.set(x, heightAt(x, z), z); r.root.rotation.y = 0.25; scene.add(r.root); DEV.rigs.push(r); });
};
function lookFromPreset(k) { const p = LOOK_PRESETS[k], O = LOOK_OPTS; return { body: p.body, skin: O.skin[p.skin], face: p.face, hair: p.hair, hairCol: O.hairCol[p.hairCol], beard: p.beard, scar: p.scar, eyes: O.eyes[p.eyes], coat: O.coat[p.coat], shirt: O.shirt[p.shirt] }; }
DEV.animate = function (t, mode) { for (const r of DEV.rigs) animate(r, { t, speed: mode === 'run' ? 6 : mode === 'walk' ? 1.6 : 0, phase: t * 8, attack: mode === 'attack' ? (t % 1) : -1, air: false }, 0.016); };
