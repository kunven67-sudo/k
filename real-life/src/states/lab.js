// Dev lab: judge people/model looks under nice light. Not part of the game.
//   ?state=lab&scene=people|ages|poses&cam=x,y,z,tx,ty,tz
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Person, preloadPeople, OUTFITS } from '../people/person.js';
import { randomLook, childLook } from '../people/look.js';
import { Rng } from '../core/rng.js';
import { assets } from '../gfx/assets.js';

export class LabState {
  constructor(engine) {
    this.engine = engine;
    this.people = [];
  }

  async enter(params = {}) {
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc9dcea);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(4, 8, 6);
    scene.add(sun, new THREE.HemisphereLight(0xdfeeff, 0x6a5a40, 0.8));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x9cbf7a, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    if (params.scene === 'models') {
      const [kit, ...names] = params.list.split(',');
      await assets.preload(names.map((n) => [kit, n]));
      let x = 0;
      for (const n of names) {
        const m = assets.model(kit, n);
        const b = new THREE.Box3().setFromObject(m);
        m.position.x = x - b.min.x;
        x += b.max.x - b.min.x + 0.5;
        scene.add(m);
      }
      // +Z marker: a red stick pointing at the camera side.
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      stick.position.set(-0.5, 0.05, 0.5);
      scene.add(stick);
      const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
      cam.position.set(x / 2, Math.max(2.5, x * 0.18), x * 0.75 + 2);
      cam.lookAt(x / 2, 0.5, 0);
      e.setView(scene, cam);
      return;
    }
    await preloadPeople();
    const rng = new Rng(+(params.seed || 7));
    const kind = params.scene || 'people';
    const list = [];
    if (kind === 'people') {
      for (const sex of ['m', 'f'])
        for (const o of OUTFITS[sex]) {
          const look = randomLook(rng, { sex, age: 30 });
          look.outfit = { ...look.outfit, head: o, body: o, legs: o, feet: o, topColor: null, bottomColor: null, shoeColor: null };
          list.push([look, 30]);
        }
    } else if (kind === 'ages') {
      const mom = randomLook(rng, { sex: 'f', age: 34 });
      const dad = randomLook(rng, { sex: 'm', age: 36 });
      const kid = childLook(rng, mom, dad, 'm');
      for (const a of [0.5, 2, 5, 8, 12, 15, 22]) list.push([kid, a]);
      list.push([mom, 34], [dad, 36], [randomLook(rng, { sex: 'f', age: 75 }), 75]);
    } else if (kind === 'one') {
      const look = randomLook(rng, { sex: params.sex || 'm', age: 30 });
      for (const pose of (params.pose || 'crawl').split('|')) list.push([look, +(params.age || 30), pose]);
    } else {
      for (let i = 0; i < 10; i++) list.push([randomLook(rng, { age: 30 }), 30]);
    }
    list.forEach(([look, age, pose], i) => {
      const p = new Person(look, age);
      if (pose) p.pose = pose;
      p.root.position.x = (i - (list.length - 1) / 2) * 0.8;
      if (kind === 'poses') {
        p.pose = ['stand', 'sit', 'crawl', 'carry', 'lie', 'stand', 'stand', 'stand', 'stand', 'stand'][i];
        if (i === 5) p.setMotion({ speed: 1.3 });
        if (i === 6) p.setMotion({ speed: 4 });
        if (i === 7) p.play('wave');
        if (i === 8) p.talk(99);
        if (i === 9) p.play('cry', { duration: 99 });
      }
      scene.add(p.root);
      this.people.push(p);
      for (let k = 0; k < 45; k++) p.update(1 / 30); // settle poses (headless renders few frames)
    });
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    const c = (params.cam || `0,1.3,${list.length * 1.15}, 0,0.9,0`).split(',').map(Number);
    cam.position.set(c[0], c[1], c[2]);
    cam.lookAt(c[3], c[4], c[5]);
    e.setView(scene, cam);
  }

  update(dt) {
    for (const p of this.people) p.update(dt);
  }
}
