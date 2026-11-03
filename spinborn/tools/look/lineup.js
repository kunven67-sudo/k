// Dev lookbook: all anime models side by side under the NASA sky (open tools/look/lineup.html after building with --entry)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
const files = (new URLSearchParams(location.search).get('m') || 'AvatarSample_A,AvatarSample_B,AvatarSample_C,boy,girl').split(',');
const r = new THREE.WebGLRenderer({ antialias: true }); r.setSize(innerWidth, innerHeight); r.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 500);
cam.position.set(0, 1.0, 6.2); cam.lookAt(0, 0.85, 0);
new THREE.TextureLoader().load('../../assets/sky/milkyway_4k.jpg', t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.background = t; });
scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x202030, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(1, 3, 4); scene.add(d);
const L = new GLTFLoader(); L.register(p => new VRMLoaderPlugin(p));
const vrms = [];
files.forEach((f, i) => L.load(`../../assets/anime/${f}.vrm`, g => {
  const v = g.userData.vrm; VRMUtils.rotateVRM0(v); v.scene.position.x = (i - (files.length - 1) / 2) * 1.05; scene.add(v.scene);
  const h = v.humanoid; h.getNormalizedBoneNode('leftUpperArm').rotation.z = -1.2; h.getNormalizedBoneNode('rightUpperArm').rotation.z = 1.2;
  v.scene.traverse(o => { if (o.isMesh && /robo_arm|backpack|anim_logo|armgear/i.test(o.name + (o.material && o.material.name))) o.visible = false; });
  vrms.push(v); window.loaded = vrms.length;
}));
r.setAnimationLoop(() => { for (const v of vrms) v.update(1 / 60); r.render(scene, cam); });
