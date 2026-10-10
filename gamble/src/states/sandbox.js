// Dev sandbox: proves renderer, physics, character controller, input and audio work together.
// Not part of the shipped flow.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld } from '../core/physics.js';
import { input } from '../core/input.js';
import { damp, clamp } from '../core/util.js';

export class SandboxState {
  constructor(engine) {
    this.engine = engine;
  }

  async enter() {
    const e = this.engine;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fb4d8);
    const pmrem = new THREE.PMREMGenerator(e.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(20, 30, 10);
    sun.castShadow = e.tier.shadows;
    sun.shadow.mapSize.setScalar(e.tier.shadowMapSize);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 });
    scene.add(sun, new THREE.HemisphereLight(0xbcd7ff, 0x5a4a3a, 0.6));

    const physics = new PhysicsWorld();
    e.physics = physics;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    physics.addGround(0);

    const boxMat = new THREE.MeshStandardMaterial({ color: 0xb3202a, roughness: 0.5 });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), boxMat);
      m.position.set(-4 + (i % 4) * 0.8, 0.3 + Math.floor(i / 4) * 0.62, -6);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      physics.addDynamicBox(m, { density: 200 });
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 0.3), new THREE.MeshStandardMaterial({ color: 0xd8cfc0 }));
    wall.position.set(0, 1.5, -12);
    wall.castShadow = wall.receiveShadow = true;
    scene.add(wall);
    physics.addStaticBox(wall);

    this.char = physics.createCharacter({ position: { x: 0, y: 1.2, z: 0 } });
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 6, 16), new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.4 }));
    this.body.castShadow = true;
    scene.add(this.body);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.25;

    const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 1000);
    e.setView(scene, camera);
    input.setPointerLock(true);
    this.scene = scene;
  }

  fixedUpdate(step) {
    const c = this.char;
    const speed = input.down('sprint') ? 6 : 2.6;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = fwd.multiplyScalar(input.move.y).add(right.multiplyScalar(input.move.x)).multiplyScalar(speed);
    this.vel.x = damp(this.vel.x, wish.x, 0.08, step);
    this.vel.z = damp(this.vel.z, wish.z, 0.08, step);
    this.vel.y -= 9.81 * step;
    if (c.controller.computedGrounded?.() && this.vel.y < 0) this.vel.y = -0.5;
    if (input.pressed('jump') && c.controller.computedGrounded?.()) this.vel.y = 4.2;
    c.controller.computeColliderMovement(c.collider, { x: this.vel.x * step, y: this.vel.y * step, z: this.vel.z * step });
    const m = c.controller.computedMovement();
    const p = c.body.translation();
    c.body.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
  }

  update(dt) {
    this.yaw -= input.look.x * 0.0025;
    this.pitch = clamp(this.pitch + input.look.y * 0.0025, -0.6, 1.1);
    const p = this.char.body.translation();
    this.body.position.set(p.x, p.y, p.z);
    const cam = this.engine.camera;
    const dist = 3.2;
    cam.position.set(
      p.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist,
      p.y + 0.6 + Math.sin(this.pitch) * dist,
      p.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist
    );
    cam.lookAt(p.x, p.y + 0.6, p.z);
  }

  exit() {
    input.setPointerLock(false);
  }
}
