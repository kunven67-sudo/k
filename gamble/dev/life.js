// Dev page for the LIFE module (needs, rent, phone, pockets) on a tiny test set: a carpeted
// floor, the player's Human and a stand-in clerk. Doesn't need the world or the player module.
//
//   ?open=phone [&app=clock|messages|wallet|maps|camera]   phone up (unlocked when app given)
//   ?open=pockets [&inspect=wallet|napkin|...]             pockets view
//   ?open=rent                                             clerk dialogue
//   ?hygiene=5 &energy=8 &hunger=10 &bladder=5 &temp=35.6  start needs (stink lines etc.)
//   ?lang=es   ?pos=205,-30 (map GPS position)
// Keys: P phone, I pockets, E talk to clerk, WASD walk.

import * as THREE from 'three';
import { runState } from './harness.js';
import { createHuman, randomHumanParams } from '../src/character/index.js';
import { input } from '../src/core/input.js';
import { bus } from '../src/core/events.js';
import { settings } from '../src/core/settings.js';
import '../src/audio/index.js'; // registers the shared sound names (ui.type, cloth.rustle…)
import { initLife } from '../src/life/index.js';
import { slice } from '../src/life/state.js';

const _f = new THREE.Vector3();

class LifeDev {
  constructor(engine) {
    this.engine = engine;
  }

  async enter(q) {
    if (q.lang) settings.set?.('language', q.lang);
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1d1a17);
    scene.fog = new THREE.Fog(0x1d1a17, 8, 22);
    const cam = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
    e.setView(scene, cam);
    this.scene = scene;
    this.cam = cam;

    // Motel-room light: warm lamp + cool window fill.
    scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x3a2a1c, 0.9));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
    sun.position.set(3, 6, 4);
    scene.add(sun);
    const lamp = new THREE.PointLight(0xffb066, 12, 9, 2);
    lamp.position.set(-1.6, 1.9, 1.2);
    scene.add(lamp);

    // Floor: worn motel carpet (procedural canvas pattern).
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#4b2f33';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,220,190' : '20,10,10'},${Math.random() * 0.08})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    g.strokeStyle = 'rgba(214,170,90,.18)';
    g.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(64 + (k % 2) * 128, 64 + (k >> 1) * 128, 40, 0, Math.PI * 2);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    tex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    // A back wall so the bubble/phone have something behind them.
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), new THREE.MeshStandardMaterial({ color: 0x8c7a5c, roughness: 0.9 }));
    wall.position.set(0, 3, -4);
    scene.add(wall);

    // Needs overrides from the URL.
    const n = slice('needs');
    for (const k of Object.keys(n)) if (q[k] != null) n[k] = +q[k];

    const tier = e.tier;
    const human = createHuman(randomHumanParams(Number(q.seed || 11)), { tier });
    scene.add(human.root);
    const clerk = { human: createHuman(randomHumanParams(Number(q.seed || 11) + 5, { sex: 'male' }), { tier }) };
    clerk.root = clerk.human.root;
    clerk.root.position.set(-1.4, 0, -1.8);
    clerk.root.rotation.y = 0.5;
    scene.add(clerk.root);
    this.clerk = clerk;

    const pos = (q.pos || '0,0').split(',').map(Number);
    this.player = { human, position: new THREE.Vector3(pos[0] || 0, 0, pos[1] || 0), yaw: Math.PI };
    this.yaw = Math.PI * 0.85;
    this.life = initLife({ engine: e, world: {}, player: this.player, state: { roomNumber: Number(q.room || 6) } });
    window.__life = this.life;
    window.__dev = this;

    // Scripted openings for screenshots.
    setTimeout(() => this._script(q), 400);
  }

  _script(q) {
    const L = this.life;
    if (q.open === 'phone') {
      L.phone.open();
      if (q.app) {
        setTimeout(() => L.phone.unlock(), 700);
        setTimeout(() => L.phone.openApp(q.app), 1500);
      }
    } else if (q.open === 'pockets') {
      L.pockets.open();
      if (q.inspect) setTimeout(() => L.pockets.inspect(L.pockets.items().find((i) => i.kind === q.inspect)), 1200);
    } else if (q.open === 'rent') {
      bus.emit('talk:clerk', { clerk: this.clerk, player: this.player, handled: { value: false } });
    }
  }

  update(dt) {
    const p = this.player;
    // Tiny walker: WASD relative to the camera.
    const mx = input.move.x;
    const my = input.move.y;
    const speed = 1.4 * Math.hypot(mx, my);
    if (speed > 0.01) {
      const ang = this.yaw + Math.atan2(mx, my);
      p.position.x -= Math.sin(ang) * speed * dt;
      p.position.z -= Math.cos(ang) * speed * dt;
      p.yaw = ang + Math.PI;
    }
    p.human.root.position.copy(p.position);
    p.human.root.rotation.y = p.yaw;
    p.human.setLocomotion({ speed, turnRate: 0 });
    if (input.pressed('interact')) bus.emit('talk:clerk', { clerk: this.clerk, player: p, handled: { value: false } });
    p.human.update(dt);
    this.clerk.human.update(dt);
    this.life.update(dt);

    // Over-the-shoulder camera.
    const target = _f.copy(p.position).add({ x: 0, y: 1.45, z: 0 });
    this.cam.position.set(target.x + Math.sin(this.yaw) * 2.6 + 0.5, target.y + 0.35, target.z + Math.cos(this.yaw) * 2.6);
    this.cam.lookAt(target.x - 0.3, target.y - 0.1, target.z - 0.6);
  }

  exit() {
    this.life?.dispose();
  }
}

runState(LifeDev);
