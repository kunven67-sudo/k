// Dev lookbook: 4 characters showing the power looks, on the platform under the NASA sky.
import * as THREE from 'three';
import { Character } from '../../src/character.js';
import { newCharacter } from '../../src/flow.js';
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.05, 500);
const Q = new URLSearchParams(location.search); const hero = Q.get('hero');
if (hero) { cam.fov = 28; cam.updateProjectionMatrix(); const x = (+hero - 1.5) * 1.7; cam.position.set(x + 0.35, 1.05, 3.1); cam.lookAt(x, 0.95, 0); } else { cam.position.set(0, 1.35, 6.6); cam.lookAt(0, 1.05, 0); }
const pm = new THREE.PMREMGenerator(r);
new THREE.TextureLoader().load('assets/sky/milkyway_4k.jpg', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.background = t; scene.backgroundRotation.set(0.25, 2.2, 0); scene.environment = pm.fromEquirectangular(t).texture; window.sky = 1; });
scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x202030, 1.4)); const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(1.5, 3, 4); scene.add(d);
const rim = new THREE.DirectionalLight(0x8fb0ff, 3); rim.position.set(-2, 2, -3); scene.add(rim);
const plat = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.2, 0.15, 96), new THREE.MeshStandardMaterial({ color: 0x0c0e14, metalness: 0.9, roughness: 0.18 })); plat.position.y = -0.075; scene.add(plat);
const mk = (g, race, look, st, extra = {}) => { const C = newCharacter(g, ''); Object.assign(C, { race, raceLook: look, height: g === 'girl' ? 65 : 71 }, extra); Object.assign(C.stats, st); return C; };
const list = [
  mk('boy', 'Human', 'skin', { str: 1, dur: 1, spd: 2, iq: 3, fight: 1 }, { personality: 'Shy' }),
  mk('girl', 'Kryptonian', 'kryptonian', { str: 12, dur: 12, spd: 10, iq: 5, fight: 6, pm: 6 }, { powers: [{ name: 'Laser Eyes' }], auraColor: '#3b8bff', raceBoost: 1 }),
  mk('boy', 'Saiyan', 'saiyan', { str: 16, dur: 15, spd: 12, iq: 5, fight: 9, pm: 7 }, { powers: [{ name: 'Ki Blasts' }], extras: { saiyan_form: 'Super Saiyan 2' }, raceBoost: 2 }),
  mk('girl', 'Devil', 'devil', { str: 18, dur: 18, spd: 13, iq: 8, fight: 8, pm: 8 }, { personality: 'Cruel', title: 'The Scarlet Demon', powers: [{ name: 'Reality Warping' }], raceBoost: 3 })
];
const chars = [];
if (Q.get('noskin')) for (const c of list) c.raceLook = 'skin';
(async () => {
  for (let i = 0; i < list.length; i++) {
    const ch = new Character(); await ch.build(list[i], { pose: 'Idle' });
    ch.root.position.x = (i - 1.5) * 1.7; ch.root.rotation.y = -(i - 1.5) * 0.12; scene.add(ch.root); chars.push(ch);
    if (ch.fx) ch.fx.setEnv(scene.environment);
    if (Q.get('noshell')) for (const sh of ch.shells) sh.visible = false;
    if (Q.get('nofx')) ch.fx.group.visible = false;
    if (Q.get('nospring')) ch.vrm.springBoneManager = null;
    if (Q.get('list')) { const a = []; ch.vrm.scene.traverse(o => { if (o.isMesh && /Bottoms|Tops|Body_00/.test(JSON.stringify((Array.isArray(o.material) ? o.material : [o.material]).map(m => m.name)))) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) a.push([m.name, m.alphaTest, m.transparent, m.opacity, m.side, m.alphaToCoverage]); }); window.mats = (window.mats || []).concat([a]); }
    if (Q.get('list')) { const out = []; ch.vrm.scene.traverse(o => { if (o.isMesh) out.push(o.name + ':' + (Array.isArray(o.material) ? o.material.map(m => m.name + (m.isOutline ? '(OL)' : '')).join('|') : o.material.name + (o.material.isOutline ? '(OL)' : ''))); }); window.meshlist = (window.meshlist || []).concat([out]); }
  }
  window.loaded = chars.length;
})();
let last = performance.now();
r.setAnimationLoop(() => { const n = performance.now(), dt = Math.min(0.05, (n - last) / 1000); last = n; for (const c of chars) c.update(dt); r.render(scene, cam); });
